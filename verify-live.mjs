import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';

const base=process.env.PAGE_URL;
if(!base)throw new Error('PAGE_URL is required');
const siteRoot=process.env.VERIFIED_SITE_ROOT|| (fs.existsSync('_site/deployment-manifest.json')?'_site':'.');
const manifestPath=path.join(siteRoot,'deployment-manifest.json');
if(!fs.existsSync(manifestPath))throw new Error('The exact artifact produced by the verified build job is required.');
const localManifestBytes=fs.readFileSync(manifestPath),manifest=JSON.parse(localManifestBytes);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const hashPath=path.join(siteRoot,'hash.js');
const hashEntry=manifest.resources?.find(resource=>resource.path==='hash.js');
if(!hashEntry||sha(fs.readFileSync(hashPath))!==hashEntry.digest)throw new Error('The local shared canonicalizer does not match the verified artifact manifest.');
vm.runInThisContext(fs.readFileSync(hashPath,'utf8'),{filename:hashPath});
const canonical=globalThis.closedLoopHash;
if(!canonical||canonical.CANONICAL_JSON_VERSION!=='closed-loop-canonical-json/1')throw new Error('The shared canonical JSON authority is unavailable.');
if(manifest.schema!=='closed-loop-deployment-manifest/1')throw new Error('Wrong deployment-manifest schema.');
const manifestDigest=value=>{const {deploymentManifestDigest,...digestInput}=value;return sha(Buffer.from(canonical.stableStringify(digestInput),'utf8'));};
const calculatedManifestDigest=manifestDigest(manifest);
if(calculatedManifestDigest!==manifest.deploymentManifestDigest)throw new Error('Deployment-manifest digest is invalid.');
if(process.env.GITHUB_SHA&&manifest.sourceCommit!==process.env.GITHUB_SHA)throw new Error('Deployment manifest source commit is not the current audited workflow commit.');
if(process.env.GITHUB_RUN_ID&&manifest.workflowRunIdentity!==process.env.GITHUB_RUN_ID)throw new Error('Deployment manifest workflow-run identity is stale.');
if(process.env.GITHUB_RUN_ATTEMPT&&manifest.workflowRunAttempt!==process.env.GITHUB_RUN_ATTEMPT)throw new Error('Deployment manifest workflow-run attempt is stale.');
if(manifest.dependencyManifestIdentity!==sha(Buffer.from(canonical.stableStringify(manifest.dependencyManifest),'utf8')))throw new Error('Dependency-manifest identity is invalid.');
if(manifest.toolchainManifestIdentity!==sha(Buffer.from(canonical.stableStringify(manifest.toolchainManifest),'utf8')))throw new Error('Toolchain-manifest identity is invalid.');
const sourceProvenance=manifest.sourceToBuildProvenance||{};
if(sourceProvenance.allTrackedReleaseInputBytesMatchAuditedCommit!==true||sourceProvenance.checkoutMatchesAuditedSourceCommit!==true)throw new Error('Deployment manifest does not prove exact audited source-input bytes.');
if(sourceProvenance.evidenceBasis!=='APPLICATION_OBSERVED_EXACT_GIT_BLOB_AND_OUTPUT_BYTE_COMPARISON')throw new Error('Deployment manifest uses an unsupported source-to-build evidence basis.');
if(!Array.isArray(sourceProvenance.auditedSourceInputs)||!sourceProvenance.auditedSourceInputs.length)throw new Error('Deployment manifest has no audited source-input byte inventory.');
if(!Array.isArray(sourceProvenance.deterministicGeneratedInputs)||!sourceProvenance.deterministicGeneratedInputs.some(item=>item.generatedPath==='TEST_PROJECT.json'&&item.generatorPath==='build-test-project.mjs'&&item.status==='TRACKED_GENERATOR_AND_OUTPUT_MATCH_AUDITED_COMMIT'))throw new Error('Deterministic TEST_PROJECT generation is not bound to its audited generator and output bytes.');

const fetchBytes=async file=>{
  const requested=new URL(`${file}?live=${Date.now()}-${Math.random()}`,base);
  const response=await fetch(requested,{cache:'no-store',headers:{'cache-control':'no-cache'},redirect:'follow'});
  if(!response.ok)throw new Error(`${file} returned ${response.status}`);
  const finalUrl=new URL(response.url);
  if(response.redirected||finalUrl.origin!==requested.origin||finalUrl.pathname!==requested.pathname)throw new Error(`${file} redirected to different content at ${response.url}`);
  return {bytes:Buffer.from(await response.arrayBuffer()),contentType:String(response.headers.get('content-type')||'')};
};
const remoteManifestResponse=await fetchBytes('deployment-manifest.json');
const remoteManifestBytes=remoteManifestResponse.bytes;
if(!remoteManifestBytes.equals(localManifestBytes))throw new Error(`deployment-manifest.json differs from the exact verified build artifact: local=${sha(localManifestBytes)} remote=${sha(remoteManifestBytes)}`);
const remoteManifest=JSON.parse(remoteManifestBytes);
if(remoteManifest.deploymentManifestDigest!==manifest.deploymentManifestDigest)throw new Error('Remote manifest identity differs from the verified build.');

for(const resource of manifest.resources){
  const local=fs.readFileSync(path.join(siteRoot,resource.path));
  if(local.byteLength!==resource.byteSize||sha(local)!==resource.digest)throw new Error(`${resource.path} does not match its predeployment manifest entry.`);
  const remote=await fetchBytes(resource.path);
  if(remote.bytes.byteLength!==resource.byteSize||sha(remote.bytes)!==resource.digest||!remote.bytes.equals(local))throw new Error(`${resource.path} deployed bytes differ from the verified build artifact.`);
  if(!remote.contentType)throw new Error(`${resource.path} has no deployed media type.`);
}
for(const file of manifest.nonRuntimeStaticPaths||[]){
  if(file==='deployment-manifest.json')continue;
  const localPath=path.join(siteRoot,file);if(!fs.existsSync(localPath))throw new Error(`Declared nonruntime static file is missing: ${file}`);
  const remote=await fetchBytes(file),local=fs.readFileSync(localPath);if(!remote.bytes.equals(local))throw new Error(`${file} differs from the verified build artifact.`);
}
for(const prohibited of ['app.js','service-worker.js','sw.js']){
  const response=await fetch(new URL(`${prohibited}?absence=${Date.now()}-${Math.random()}`,base),{cache:'no-store',headers:{'cache-control':'no-cache'},redirect:'manual'});
  if(response.ok)throw new Error(`Unmanifested or prohibited runtime resource is deployed: ${prohibited}`);
}

const workerEntry=manifest.resources.find(resource=>resource.path==='test-worker.js');
if(!workerEntry||workerEntry.digest!==manifest.runtimeGraph?.workerSha256)throw new Error('Deployment manifest worker identity is incomplete.');
const runtimeSource=fs.readFileSync(path.join(siteRoot,'test-runtime.js'),'utf8');
const runtimeWorkerDigest=runtimeSource.match(/const TEST_WORKER_SHA256='([a-f0-9]{64})'/i)?.[1]?.toLowerCase();
if(runtimeWorkerDigest!==workerEntry.digest)throw new Error('The deployed runtime does not bind the exact worker bytes.');

let reproducibilityStatus='NOT_REQUESTED';
let reproducibilityManifestIdentity=null;
let reproducibilityLimitations=[];
let reproducibilityEvidenceBasis='NONE';
let reproducibilityEnvironmentComparison=null;
const rebuildRoot=process.env.REPRODUCIBILITY_SITE_ROOT;
if(rebuildRoot){
  reproducibilityEvidenceBasis=process.env.GITHUB_ACTIONS==='true'?'APPLICATION_OBSERVED_SEPARATE_WORKFLOW_JOB_SECOND_CLEAN_OUTPUT_BUILD':'APPLICATION_OBSERVED_LOCAL_SECOND_CLEAN_OUTPUT_BUILD';
  reproducibilityLimitations=[process.env.GITHUB_ACTIONS==='true'?'The comparison build ran in a separate GitHub Actions job using the same selected mutable runner family, not the same runner instance. Observed environment fields do not prove that the underlying hosted environments were identical.':'The comparison build used a second clean output directory in the same local process environment. It does not establish reproducibility across independently provisioned platforms.'];
  const rebuiltManifestPath=path.join(rebuildRoot,'deployment-manifest.json');
  if(!fs.existsSync(rebuiltManifestPath))throw new Error('The independent clean-build comparison manifest is missing.');
  const rebuiltBytes=fs.readFileSync(rebuiltManifestPath),rebuilt=JSON.parse(rebuiltBytes);
  const rebuiltDigest=manifestDigest(rebuilt);
  if(rebuiltDigest!==rebuilt.deploymentManifestDigest)throw new Error('The clean-build comparison manifest is invalid.');
  const normalizeResources=value=>(value.resources||[]).map(resource=>({path:resource.path,mediaType:resource.mediaType,byteSize:resource.byteSize,hashAlgorithm:resource.hashAlgorithm,digest:resource.digest}));
  const resourceGraphEqual=canonical.stableStringify(normalizeResources(rebuilt))===canonical.stableStringify(normalizeResources(manifest));
  const fullManifestEqual=rebuiltBytes.equals(localManifestBytes);
  const sourceEnvironment=manifest.toolchainManifest||{},comparisonEnvironment=rebuilt.toolchainManifest||{};
  reproducibilityEnvironmentComparison={
    separateWorkflowJob:process.env.GITHUB_ACTIONS==='true',
    selectedRunnerFamilyEqual:sourceEnvironment.runner?.selectedFamily===comparisonEnvironment.runner?.selectedFamily,
    observedImageOsEqual:sourceEnvironment.runner?.observedImageOS===comparisonEnvironment.runner?.observedImageOS,
    observedImageVersionEqual:sourceEnvironment.runner?.observedImageVersion===comparisonEnvironment.runner?.observedImageVersion,
    selectedNodeVersionEqual:sourceEnvironment.node?.selectedVersion===comparisonEnvironment.node?.selectedVersion,
    observedNodeVersionEqual:sourceEnvironment.node?.observedVersion===comparisonEnvironment.node?.observedVersion,
    architectureEqual:sourceEnvironment.architecture===comparisonEnvironment.architecture,
    browserObservationEqual:canonical.stableStringify(sourceEnvironment.browser||null)===canonical.stableStringify(comparisonEnvironment.browser||null),
    pythonObservationEqual:canonical.stableStringify(sourceEnvironment.python||null)===canonical.stableStringify(comparisonEnvironment.python||null),
    gitObservationEqual:canonical.stableStringify(sourceEnvironment.git||null)===canonical.stableStringify(comparisonEnvironment.git||null),
    copyToolObservationEqual:canonical.stableStringify(sourceEnvironment.copyTool||null)===canonical.stableStringify(comparisonEnvironment.copyTool||null),
    exactToolchainManifestIdentityEqual:manifest.toolchainManifestIdentity===rebuilt.toolchainManifestIdentity
  };
  if(!resourceGraphEqual)reproducibilityStatus='UNKNOWN_OUTPUT_RESOURCE_MISMATCH';
  else if(fullManifestEqual)reproducibilityStatus='VERIFIED_IDENTICAL_SECOND_CLEAN_BUILD';
  else{
    reproducibilityStatus='OUTPUT_RESOURCES_REPRODUCED_MANIFEST_DIFFERED';
    reproducibilityLimitations.push('The second clean output build reproduced every deployed resource, but observed toolchain or environment evidence made the complete manifests differ.');
  }
  reproducibilityManifestIdentity=rebuilt.deploymentManifestDigest;
}

const project=JSON.parse(fs.readFileSync(path.join(siteRoot,'TEST_PROJECT.json'),'utf8'));
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Retained project identity mismatch.');
if(project.stageRecords?.['1']?.status!=='COMPLETE'||project.currentStage!==2||project.currentState!=='READY')throw new Error('Retained project Stage 01/Stage 02 state mismatch.');
for(let stage=2;stage<=30;stage++)if(project.stageRecords?.[String(stage)]?.status!=='NOT STARTED')throw new Error(`Retained Stage ${stage} is falsely started.`);

const active=manifest.resources.filter(resource=>/\.(?:js|html)$/.test(resource.path)).map(resource=>fs.readFileSync(path.join(siteRoot,resource.path),'utf8')).join('\n');
if(/MutationObserver/.test(active))throw new Error('Obsolete patch-style runtime behavior is deployed.');
if(/human-project\/31|Stage 31|Operation 31|31 operations/i.test(active))throw new Error('Prohibited Stage/Operation 31 is deployed.');
if(/(?:navigator\.)?serviceWorker\.register\s*\(/.test(active))throw new Error('A controlling service worker is deployed.');
for(const identity of ['mobile-closed-loop/30','closed-loop-project/3','closed-loop-stage-response/3','closed-loop-test-spec/1','closed-loop-verification-package/1','closed-loop-canonical-json/1'])if(!active.includes(identity))throw new Error(`Current deployed contract identity is missing: ${identity}`);
const index=fs.readFileSync(path.join(siteRoot,'index.html'),'utf8');
const tokens=[...index.matchAll(/<script\s+defer\s+src="[^"]+\?v=([^"]+)"/g)].map(match=>match[1]);
if(tokens.length!==9||new Set(tokens).size!==1||tokens[0]!==manifest.buildIdentity)throw new Error('Mixed or stale runtime build identity.');
if(!/worker-src\s+'self'/.test(index))throw new Error('Worker CSP identity is not restrictive.');

console.log(JSON.stringify({
  liveSourceIdentity:true,
  deploymentManifest:'closed-loop-deployment-manifest/1',
  deploymentManifestDigest:manifest.deploymentManifestDigest,
  sourceCommit:manifest.sourceCommit,
  workflowRunIdentity:manifest.workflowRunIdentity,
  workflowRunAttempt:manifest.workflowRunAttempt,
  buildIdentity:manifest.buildIdentity,
  workerSha256:workerEntry.digest,
  toolchainManifestIdentity:manifest.toolchainManifestIdentity,
  dependencyManifestIdentity:manifest.dependencyManifestIdentity,
  runnerImagePinning:manifest.supplyChain?.runnerImagePinning,
  supplyChainLimitations:manifest.supplyChain?.limitations||[],
  sourceToBuildArtifactIdentity:'EXACT_VERIFIED_SITE_ARTIFACT',
  sourceToBuildProvenanceEvidenceBasis:sourceProvenance.evidenceBasis,
  allTrackedReleaseInputBytesMatchAuditedCommit:sourceProvenance.allTrackedReleaseInputBytesMatchAuditedCommit,
  auditedSourceInputCount:sourceProvenance.auditedSourceInputs.length,
  deterministicGeneratedInputCount:sourceProvenance.deterministicGeneratedInputs.length,
  reproducibilityStatus,
  reproducibilityManifestIdentity,
  reproducibilityEvidenceBasis,
  reproducibilityLimitations,
  reproducibilityEnvironmentComparison,
  filesCompared:manifest.resources.length+(manifest.nonRuntimeStaticPaths||[]).length,
  retainedJobId:project.jobId,
  currentStage:2,
  stage1:'COMPLETE',
  workflow:'mobile-closed-loop/30',
  projectSchema:'closed-loop-project/3',
  responseSchema:'closed-loop-stage-response/3',
  testIrSchema:'closed-loop-test-spec/1',
  packageSchema:'closed-loop-verification-package/1',
  canonicalization:'closed-loop-canonical-json/1',
  oneApplication:true
},null,2));

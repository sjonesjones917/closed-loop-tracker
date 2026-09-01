import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import './hash.js';
import {
  BUILD_IDENTITY_PATH,
  BUILD_IDENTITY_DERIVATION_SCHEMA,
  BUILD_IDENTITY_PREFIX,
  BUILD_IDENTITY_SCHEMA,
  CANONICALIZATION_VERSION,
  DEPLOYMENT_CONTROL_PATHS,
  DEPLOYMENT_REBUILD_PERMITTED,
  DEPLOYMENT_RUNTIME_PATHS,
  DEPLOYMENT_SCHEMA,
  DEPLOYMENT_SOURCE_RUNTIME_PATHS,
  MAIN_RUNTIME_SCRIPT_PATHS,
  WORKER_DIGEST_PLACEHOLDER,
  WORKER_PROTOCOL_VERSION,
  mediaTypeFor
} from './deployment-contract.mjs';

const manifestPath=path.resolve(process.argv[2]||'deployment-manifest.json');
const root=path.dirname(manifestPath);
const sourceRoot=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(globalThis.closedLoopHash?.canonicalizationVersion,CANONICALIZATION_VERSION,'Deployment verifier is not using the registered canonical JSON authority.');
const canonical=value=>globalThis.closedLoopHash.stableStringify(value);

assert.equal(manifest.schema,DEPLOYMENT_SCHEMA);
assert.equal(manifest.workflowIdentity,'mobile-closed-loop/30');
assert.equal(manifest.canonicalizationVersion,CANONICALIZATION_VERSION);
assert.match(manifest.sourceCommit,/^(?:[a-f0-9]{40}|UNKNOWN)$/);
if(process.env.GITHUB_SHA)assert.equal(manifest.sourceCommit,process.env.GITHUB_SHA,'Manifest is not bound to the checked-out CI commit.');
if(process.env.GITHUB_RUN_ID)assert.equal(String(manifest.workflowRunIdentity),String(process.env.GITHUB_RUN_ID),'Manifest is not bound to the producing workflow run.');
assert(/^[a-f0-9]{64}$/.test(manifest.overallManifestDigest));
const digestInput={...manifest};delete digestInput.overallManifestDigest;
assert.equal(sha256(Buffer.from(canonical(digestInput),'utf8')),manifest.overallManifestDigest,'Deployment manifest semantic digest mismatch.');
const buildIdentityInput={
  schema:BUILD_IDENTITY_DERIVATION_SCHEMA,
  resources:DEPLOYMENT_SOURCE_RUNTIME_PATHS.map(resourcePath=>{const bytes=fs.readFileSync(path.join(sourceRoot,resourcePath));return {path:resourcePath,byteSize:bytes.length,hashAlgorithm:'SHA-256',digest:sha256(bytes)};}),
  transformations:['INJECT_CONTENT_DERIVED_RUNTIME_BUILD_ID/1','REPLACE_EXACT_DEPLOYMENT_WORKER_SHA256_PLACEHOLDER/1'],
  workerProtocolVersion:WORKER_PROTOCOL_VERSION
};
const expectedBuildIdentityDigest=sha256(Buffer.from(canonical(buildIdentityInput),'utf8'));
assert.equal(manifest.buildIdentity,`${BUILD_IDENTITY_PREFIX}${expectedBuildIdentityDigest}`,'Build identity is not derived from the exact pre-transform source runtime resource digest set.');
assert.deepEqual(manifest.buildIdentityDerivation,{...buildIdentityInput,hashAlgorithm:'SHA-256',digest:expectedBuildIdentityDigest,buildIdentity:manifest.buildIdentity},'Build-identity derivation evidence is incomplete or self-inconsistent.');

assert.deepEqual(manifest.runtimeResources.map(item=>item.path),DEPLOYMENT_RUNTIME_PATHS,'Deployment runtime allowlist is incomplete, reordered, or contains an unmanifested runtime.');
assert.equal(new Set(manifest.runtimeResources.map(item=>item.path)).size,DEPLOYMENT_RUNTIME_PATHS.length,'Deployment manifest has duplicate runtime paths.');
for(const resource of manifest.runtimeResources){
  assert.equal(resource.hashAlgorithm,'SHA-256');
  assert.equal(resource.mediaType,mediaTypeFor(resource.path));
  assert.equal(resource.buildIdentity,manifest.buildIdentity);
  const bytes=fs.readFileSync(path.join(root,resource.path));
  assert.equal(bytes.length,resource.byteSize,`${resource.path} byte size mismatch.`);
  assert.equal(sha256(bytes),resource.digest,`${resource.path} digest mismatch.`);
}

const localFiles=fs.readdirSync(root,{withFileTypes:true}).filter(item=>item.isFile()).map(item=>item.name).sort(globalThis.closedLoopHash.compareUnicodeScalarSequence);
const allowed=new Set([...DEPLOYMENT_RUNTIME_PATHS,...DEPLOYMENT_CONTROL_PATHS,'deployment-manifest.json']);
assert.deepEqual(localFiles.filter(file=>!allowed.has(file)),[],'Deployment directory contains unmanifested content.');
const excluded=new Map((manifest.excludedNonRuntimeStaticPaths||[]).map(item=>[item.path,item.reason]));
for(const file of DEPLOYMENT_CONTROL_PATHS)assert(excluded.get(file),`${file} lacks an explicit nonruntime-static exclusion rule.`);
assert.equal(manifest.rootEvidenceResource?.path,'deployment-manifest.json');
assert.equal(manifest.rootEvidenceResource?.verificationRule,'COMPARE_EXACT_LOCAL_AND_DEPLOYED_BYTES_AND_RECOMPUTE_OVERALL_MANIFEST_DIGEST');

const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const scripts=[...index.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
assert.deepEqual(scripts.map(value=>value.split('?')[0]),MAIN_RUNTIME_SCRIPT_PATHS,'HTML executed-script graph differs from the manifest contract.');
const tokens=scripts.map(value=>new URLSearchParams(value.split('?')[1]||'').get('v'));
assert.deepEqual([...new Set(tokens)],[manifest.buildIdentity],'Mixed build identity in index runtime graph.');
assert(!/<script[^>]+service-worker|navigator\.serviceWorker\.register/i.test(index),'An unmanifested controlling service worker is present.');
const csp=index.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1];
assert.equal(csp,manifest.csp?.exactValue,'Manifest CSP does not equal the executing HTML CSP.');
assert.equal(sha256(Buffer.from(csp,'utf8')),manifest.csp?.digest,'Manifest CSP digest is wrong.');
assert.match(csp,/worker-src\s+'self'/,'CSP does not restrict the Test IR worker to same origin.');
for(const directive of ["default-src 'none'","connect-src 'self'","object-src 'none'","frame-src 'none'","form-action 'none'","base-uri 'none'"])assert(csp.includes(directive),`Restrictive CSP directive is missing: ${directive}`);
const scriptDirective=csp.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1]||'';
assert(scriptDirective.includes("'self'")&&!/unsafe-inline|unsafe-eval|\bhttps?:/i.test(scriptDirective),'Script CSP permits inline/eval or third-party execution.');
const inlineScripts=[...index.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
assert.equal(inlineScripts.length,1,'The static shell must contain exactly one hash-authorized inline bootstrap.');
const inlineDigest=crypto.createHash('sha256').update(Buffer.from(inlineScripts[0],'utf8')).digest('base64');
assert(csp.includes(`'sha256-${inlineDigest}'`),'CSP does not authorize the exact current inline bootstrap bytes.');

const generated=manifest.deterministicGeneratedResources?.find(item=>item.path==='test-runtime.js');
const generatedIndex=manifest.deterministicGeneratedResources?.find(item=>item.path==='index.html');
const generatedApp=manifest.deterministicGeneratedResources?.find(item=>item.path==='app-core.js');
const generatedBuildIdentity=manifest.deterministicGeneratedResources?.find(item=>item.path===BUILD_IDENTITY_PATH);
const worker=manifest.runtimeResources.find(item=>item.path==='test-worker.js');
const runtime=fs.readFileSync(path.join(root,'test-runtime.js'),'utf8');
assert(generated&&generatedIndex&&generatedApp&&worker,'Runtime build/worker injection provenance is missing.');
assert.equal(generated.transformation,'INJECT_RUNTIME_BUILD_AND_WORKER_IDENTITIES/1');
assert.equal(generatedIndex.transformation,'INJECT_CONTENT_DERIVED_RUNTIME_BUILD_ID/1');
assert.equal(generatedApp.transformation,'INJECT_CONTENT_DERIVED_RUNTIME_BUILD_ID/1');
assert.equal(generated.injectedTestWorkerSha256,worker.digest,'Injected worker identity does not equal the manifested worker bytes.');
assert.equal(generated.outputSha256,manifest.runtimeResources.find(item=>item.path==='test-runtime.js')?.digest,'Generated runtime output identity is wrong.');
const sourceRuntime=fs.readFileSync(path.join(sourceRoot,'test-runtime.js'),'utf8');
const sourceIndex=fs.readFileSync(path.join(sourceRoot,'index.html'),'utf8');
const sourceApp=fs.readFileSync(path.join(sourceRoot,'app-core.js'),'utf8');
const sourceScripts=[...sourceIndex.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
const sourceBuildIdentities=[...new Set(sourceScripts.map(value=>new URLSearchParams(value.split('?')[1]||'').get('v')))];
assert.equal(sourceScripts.length,MAIN_RUNTIME_SCRIPT_PATHS.length,'Audited source index does not expose exactly nine build-identity injection points.');
assert.equal(sourceBuildIdentities.length,1,'Audited source graph lacks one shared build-identity seed.');
const sourceBuildIdentity=sourceBuildIdentities[0];
assert(sourceBuildIdentity,'Audited source build-identity seed is empty.');
for(const record of [generated,generatedIndex,generatedApp]){
  assert.equal(record.sourceBuildIdentity,sourceBuildIdentity,'Generated resource is not bound to the audited source build-identity seed.');
  assert.equal(record.injectedBuildIdentity,manifest.buildIdentity,'Generated resource did not receive the content-derived build identity.');
}
assert.equal(sha256(Buffer.from(sourceRuntime,'utf8')),generated.sourceSha256,'Generated runtime is not bound to the audited source runtime.');
assert.equal(sha256(Buffer.from(sourceIndex,'utf8')),generatedIndex.sourceSha256,'Generated index is not bound to the audited source index.');
assert.equal(sha256(Buffer.from(sourceApp,'utf8')),generatedApp.sourceSha256,'Generated app is not bound to the audited source app.');
assert.equal(sourceRuntime.split(WORKER_DIGEST_PLACEHOLDER).length-1,1,'Audited source runtime does not contain the single controlled worker-digest injection point.');
assert.equal(sourceRuntime.split(sourceBuildIdentity).length-1,1,'Audited source runtime lacks the single controlled build-identity injection point.');
assert.equal(sourceApp.split(sourceBuildIdentity).length-1,1,'Audited source app lacks the single controlled build-identity injection point.');
assert.equal(sourceIndex.split(sourceBuildIdentity).length-1,MAIN_RUNTIME_SCRIPT_PATHS.length,'Audited source index has the wrong build-identity injection-point count.');
const expectedRuntime=sourceRuntime.replace(sourceBuildIdentity,manifest.buildIdentity).replace(WORKER_DIGEST_PLACEHOLDER,worker.digest);
const expectedApp=sourceApp.replace(sourceBuildIdentity,manifest.buildIdentity);
const expectedIndex=sourceIndex.split(sourceBuildIdentity).join(manifest.buildIdentity);
assert.equal(sha256(Buffer.from(expectedRuntime,'utf8')),generated.outputSha256,'Generated runtime is not the exact declared deterministic source transformation.');
assert.equal(sha256(Buffer.from(expectedApp,'utf8')),generatedApp.outputSha256,'Generated app is not the exact declared deterministic source transformation.');
assert.equal(sha256(Buffer.from(expectedIndex,'utf8')),generatedIndex.outputSha256,'Generated index is not the exact declared deterministic source transformation.');
assert.equal(generatedIndex.outputSha256,manifest.runtimeResources.find(item=>item.path==='index.html')?.digest,'Generated index output identity is wrong.');
assert.equal(generatedApp.outputSha256,manifest.runtimeResources.find(item=>item.path==='app-core.js')?.digest,'Generated app output identity is wrong.');
assert(!runtime.includes(WORKER_DIGEST_PLACEHOLDER),'The deployed runtime still contains an unresolved worker-digest placeholder.');
assert(runtime.includes(worker.digest),'The deployed runtime does not contain the exact worker digest.');
assert(runtime.includes(manifest.buildIdentity)&&fs.readFileSync(path.join(root,'app-core.js'),'utf8').includes(manifest.buildIdentity),'The deployed app/runtime do not contain the content-derived build identity.');
assert(/url\.searchParams\.set\(['"]v['"],runtimeBuildIdentity\(\)\)/.test(runtime),'The Test IR worker URL is not bound to the content-derived runtime build identity.');
const buildIdentityBytes=fs.readFileSync(path.join(root,BUILD_IDENTITY_PATH));
const buildIdentity=JSON.parse(buildIdentityBytes);
assert.deepEqual(Object.keys(buildIdentity),['schema','buildIdentity','testWorkerSha256','workerProtocolVersion','sourceCommit','workflowRunIdentity','hashAlgorithm'],'Build identity has an open or incomplete schema.');
assert.equal(buildIdentity.schema,BUILD_IDENTITY_SCHEMA);
assert.equal(buildIdentity.buildIdentity,manifest.buildIdentity);
assert.equal(buildIdentity.testWorkerSha256,worker.digest);
assert.equal(buildIdentity.workerProtocolVersion,WORKER_PROTOCOL_VERSION);
assert.equal(buildIdentity.sourceCommit,manifest.sourceCommit);
assert.equal(String(buildIdentity.workflowRunIdentity),String(manifest.workflowRunIdentity));
assert.equal(buildIdentity.hashAlgorithm,'SHA-256');
assert(generatedBuildIdentity,'Build identity generation provenance is missing.');
assert.equal(generatedBuildIdentity.outputSha256,sha256(buildIdentityBytes));
assert.equal(generatedBuildIdentity.outputSha256,manifest.runtimeResources.find(item=>item.path===BUILD_IDENTITY_PATH)?.digest);
assert.equal(generatedBuildIdentity.inputBuildIdentity,manifest.buildIdentity);
assert.equal(generatedBuildIdentity.inputTestWorkerSha256,worker.digest);

assert.equal(manifest.dependencyAndToolchainManifest?.allGithubActionsPinnedToImmutableCommits,true,'A release workflow action is not pinned to an immutable commit.');
assert((manifest.dependencyAndToolchainManifest?.githubActions||[]).length>0,'No release workflow actions were recorded.');
assert((manifest.dependencyAndToolchainManifest?.githubActions||[]).every(item=>/^[a-f0-9]{40}$/i.test(item.revision)),'A release workflow action revision is floating.');
assert.equal(manifest.dependencyAndToolchainManifest?.packageManagerStatus,'NO_PACKAGE_MANAGER_OR_THIRD_PARTY_RUNTIME_DEPENDENCIES');
assert.equal(manifest.dependencyAndToolchainManifest?.nodeRuntime,process.version,'Manifest Node build-tool identity differs from the verifier runtime.');
assert.equal(sha256(fs.readFileSync(path.join(sourceRoot,'.github/workflows/pages.yml'))),manifest.dependencyAndToolchainManifest?.workflowSha256,'Manifest is not bound to the audited release workflow bytes.');
assert.equal(manifest.buildEnvironmentIdentity?.node,process.version,'Build environment omits the exact Node identity.');
for(const field of ['runnerOs','runnerArchitecture','runnerImageOs','runnerImageVersion'])assert.equal(typeof manifest.buildEnvironmentIdentity?.[field],'string',`Build environment ${field} evidence is missing.`);
if(process.env.CLOSED_LOOP_VERIFY_PRODUCER_ENVIRONMENT==='true'){
  assert.equal(manifest.buildEnvironmentIdentity?.runnerOs,process.env.RUNNER_OS||process.platform,'Build producer OS identity is wrong.');
  assert.equal(manifest.buildEnvironmentIdentity?.runnerArchitecture,process.env.RUNNER_ARCH||process.arch,'Build producer architecture identity is wrong.');
  assert.equal(manifest.buildEnvironmentIdentity?.runnerImageOs,process.env.ImageOS||'UNREPORTED','Build producer image OS evidence is wrong.');
  assert.equal(manifest.buildEnvironmentIdentity?.runnerImageVersion,process.env.ImageVersion||'UNREPORTED','Build producer image version evidence is wrong.');
}
assert.deepEqual(manifest.buildEnvironmentIdentity?.supplyChainLimitations,['HOSTED_RUNNER_PLATFORM_COMPROMISE_NOT_RULED_OUT','FLOATING_HOSTED_RUNNER_LABEL_WITH_EXACT_OBSERVED_IMAGE_RECORDED_WHEN_AVAILABLE'],'Hosted runner limitations are not preserved honestly.');
assert.equal(manifest.artifactProvenance?.producerJob,'test');
assert.equal(manifest.artifactProvenance?.verifiedSiteRoot,'_site');
assert.equal(manifest.artifactProvenance?.pagesArtifactName,'github-pages');
assert.equal(manifest.artifactProvenance?.retainedVerificationArtifactName,`closed-loop-verified-site-${manifest.sourceCommit}-${manifest.workflowRunIdentity}`);
assert.equal(manifest.artifactProvenance?.retainedArchivePath,'closed-loop-verified-site.tar');
assert.equal(manifest.artifactProvenance?.retainedArchiveDigestPath,'closed-loop-verified-site.tar.sha256');
assert.equal(manifest.artifactProvenance?.deploymentConsumerJob,'deploy');
assert.deepEqual(manifest.artifactProvenance?.verificationConsumerJobs,['verify-live','publish-status']);
assert.equal(manifest.artifactProvenance?.deploymentRebuildPermitted,DEPLOYMENT_REBUILD_PERMITTED);
assert.equal(manifest.artifactProvenance?.sourceCommit,manifest.sourceCommit);
assert.equal(manifest.buildTargetAlias,'$ISOLATED_DEPLOYMENT_TARGET');
assert.equal(manifest.buildCommand,`CLOSED_LOOP_REPRODUCIBILITY_STATUS=${manifest.reproducibilityStatus} node build-static-site.mjs $ISOLATED_DEPLOYMENT_TARGET`);
if(manifest.reproducibilityStatus==='CHECKED_BY_SECOND_CLEAN_MANIFEST_BUILD'){
  assert.equal(manifest.reproducibilityEvidence?.cleanBuildCount,2);
  assert.equal(manifest.reproducibilityEvidence?.comparison,'RECURSIVE_EXACT_BYTE_COMPARISON');
}else assert.equal(manifest.reproducibilityStatus,'NOT_EVALUATED_IN_THIS_MANIFEST');

console.log(JSON.stringify({
  deploymentManifest:'PASS',
  sourceCommit:manifest.sourceCommit,
  workflowRunIdentity:manifest.workflowRunIdentity,
  buildIdentity:manifest.buildIdentity,
  contentDerivedBuildIdentity:true,
  runtimeResourceIdentityCoverage:1,
  resources:manifest.runtimeResources.length,
  workerDigestInjected:true,
  buildIdentityRuntimeControl:true,
  workerDigest:worker.digest,
  cspIdentityVerified:true,
  sharedCanonicalizationAuthority:globalThis.closedLoopHash.canonicalizationVersion===CANONICALIZATION_VERSION,
  allGithubActionsPinned:true,
  exactArtifactProvenance:true,
  reproducibilityStatus:manifest.reproducibilityStatus,
  unmanifestedRuntimeResources:0,
  serviceWorker:'ABSENT',
  manifestDigest:manifest.overallManifestDigest
},null,2));

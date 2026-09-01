import fs from 'node:fs';
import crypto from 'node:crypto';
import {BUILD_IDENTITY_PATH,BUILD_IDENTITY_SCHEMA,WORKER_PROTOCOL_VERSION} from './deployment-contract.mjs';

const base=process.env.PAGE_URL;
if(!base)throw new Error('PAGE_URL is required');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifestPath=process.env.DEPLOYMENT_MANIFEST_PATH||(fs.existsSync('_site/deployment-manifest.json')?'_site/deployment-manifest.json':'deployment-manifest.json');
const localManifestBytes=fs.readFileSync(manifestPath);
const manifest=JSON.parse(localManifestBytes);
if(manifest.schema!=='closed-loop-deployment-manifest/1')throw new Error('Wrong deployment manifest schema.');
if(manifest.sourceCommit!==process.env.GITHUB_SHA)throw new Error(`Deployment manifest source commit ${manifest.sourceCommit} does not match ${process.env.GITHUB_SHA}.`);
const remoteManifestResponse=await fetch(new URL(`deployment-manifest.json?live=${Date.now()}-${Math.random()}`,base),{cache:'no-store'});
if(!remoteManifestResponse.ok)throw new Error(`deployment-manifest.json returned ${remoteManifestResponse.status}`);
if(new URL(remoteManifestResponse.url).origin!==new URL(base).origin)throw new Error('Deployment manifest redirected to a different origin.');
const remoteManifestContentType=String(remoteManifestResponse.headers.get('content-type')||'').toLowerCase();
if(!/application\/json|text\/json/.test(remoteManifestContentType))throw new Error(`deployment-manifest.json has an unexpected deployed media type: ${remoteManifestContentType||'UNREPORTED'}`);
const remoteManifestBytes=Buffer.from(await remoteManifestResponse.arrayBuffer());
if(!remoteManifestBytes.equals(localManifestBytes))throw new Error(`Deployment manifest bytes differ: local=${sha(localManifestBytes)} remote=${sha(remoteManifestBytes)}`);
const deployed=manifest.runtimeResources.map(resource=>resource.path);
const deployedMediaTypes={};
for(const resource of manifest.runtimeResources){
  const file=resource.path;
  const response=await fetch(new URL(`${file}?live=${Date.now()}-${Math.random()}`,base),{cache:'no-store'});
  if(!response.ok)throw new Error(`${file} returned ${response.status}`);
  if(new URL(response.url).origin!==new URL(base).origin)throw new Error(`${file} redirected to a different origin.`);
  const contentType=String(response.headers.get('content-type')||'').toLowerCase();
  deployedMediaTypes[file]=contentType||'UNREPORTED';
  if(file.endsWith('.html')&&!contentType.includes('text/html'))throw new Error(`${file} has an unexpected deployed media type: ${contentType||'UNREPORTED'}`);
  if(file.endsWith('.js')&&!/javascript|ecmascript/.test(contentType))throw new Error(`${file} has an unexpected deployed media type: ${contentType||'UNREPORTED'}`);
  if(file.endsWith('.json')&&!/application\/json|text\/json/.test(contentType))throw new Error(`${file} has an unexpected deployed media type: ${contentType||'UNREPORTED'}`);
  const remote=Buffer.from(await response.arrayBuffer());
  if(remote.length!==resource.byteSize||sha(remote)!==resource.digest)throw new Error(`${file} deployed bytes differ from the verified deployment manifest: expected=${resource.digest} remote=${sha(remote)}`);
}
for(const serviceWorkerPath of ['service-worker.js','sw.js']){
  const response=await fetch(new URL(`${serviceWorkerPath}?live=${Date.now()}-${Math.random()}`,base),{cache:'no-store',redirect:'manual'});
  if(response.status===200)throw new Error(`Unexpected controlling service-worker candidate is deployed: ${serviceWorkerPath}`);
}

const localRoot=manifestPath.replace(/deployment-manifest\.json$/,'');
const project=JSON.parse(fs.readFileSync(`${localRoot}TEST_PROJECT.json`,'utf8'));
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Retained project identity mismatch.');
if(project.stageRecords?.['1']?.status!=='COMPLETE'||project.currentStage!==2||project.currentState!=='READY')throw new Error('Retained project Stage 01/Stage 02 state mismatch.');
for(let stage=2;stage<=30;stage++)if(project.stageRecords?.[String(stage)]?.status!=='NOT STARTED')throw new Error(`Retained Stage ${stage} is falsely started.`);
if(project.currentVersions?.sources!=='NOT APPLICABLE')throw new Error('Retained Stage 02 source set was fabricated.');

const active=deployed.filter(file=>/\.(?:js|html)$/.test(file)).map(file=>fs.readFileSync(`${localRoot}${file}`,'utf8')).join('\n');
if(/MutationObserver/.test(active))throw new Error('Obsolete patch-style runtime behavior is deployed.');
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(active+JSON.stringify(project)))throw new Error('Unauthorized product content is deployed.');
if(/human-project\/31|Stage 31|Operation 31|31 operations/i.test(active))throw new Error('Prohibited Stage/Operation 31 is deployed.');
if(/loadDeploymentManifest|closedLoopDeploymentManifest/.test(active))throw new Error('The deployed application still treats the deployment manifest as a runtime dependency.');
for(const identity of ['mobile-closed-loop/30','closed-loop-project/3','closed-loop-stage-response/3','closed-loop-test-spec/1','closed-loop-verification-package/1']){
  if(!active.includes(identity))throw new Error(`Current deployed contract identity is missing: ${identity}`);
}
for(const control of ['PENDING_OPERATOR_REVIEW','ACCEPTED_DATA_CHANGE','RUN_APP_TESTS','worker-src \'self\'']){
  if(!active.includes(control))throw new Error(`Required deployed control is missing: ${control}`);
}
const deployedRuntime=fs.readFileSync(`${localRoot}test-runtime.js`,'utf8'),worker=manifest.runtimeResources.find(resource=>resource.path==='test-worker.js');
if(!worker||!deployedRuntime.includes(worker.digest)||deployedRuntime.includes('__CLOSED_LOOP_TEST_WORKER_SHA256__'))throw new Error('The deployed Test IR runtime is not bound to the exact manifested worker bytes.');
const buildIdentity=JSON.parse(fs.readFileSync(`${localRoot}${BUILD_IDENTITY_PATH}`,'utf8'));
if(buildIdentity.schema!==BUILD_IDENTITY_SCHEMA||buildIdentity.buildIdentity!==manifest.buildIdentity||buildIdentity.testWorkerSha256!==worker.digest||buildIdentity.workerProtocolVersion!==WORKER_PROTOCOL_VERSION||buildIdentity.sourceCommit!==manifest.sourceCommit||String(buildIdentity.workflowRunIdentity)!==String(manifest.workflowRunIdentity))throw new Error('The deployed build-identity runtime control is not bound to this exact manifest, worker, source commit, and workflow run.');

console.log(JSON.stringify({
  liveSourceIdentity:true,
  filesCompared:deployed.length,
  deployedMediaTypes,
  deploymentManifestMediaType:remoteManifestContentType,
  deploymentManifestSchema:manifest.schema,
  deploymentManifestDigest:manifest.overallManifestDigest,
  sourceCommit:manifest.sourceCommit,
  buildIdentity:manifest.buildIdentity,
  reproducibilityStatus:manifest.reproducibilityStatus,
  exactArtifactProvenance:manifest.artifactProvenance,
  exactWorkerDigestInjected:true,
  buildIdentityRuntimeControl:true,
  testWorkerSha256:worker.digest,
  allGithubActionsPinned:manifest.dependencyAndToolchainManifest?.allGithubActionsPinnedToImmutableCommits===true,
  unmanifestedRuntimeResources:0,
  controllingServiceWorker:'ABSENT',
  retainedJobId:project.jobId,
  currentStage:2,
  stage1:'COMPLETE',
  workflow:'mobile-closed-loop/30',
  projectSchema:'closed-loop-project/3',
  responseSchema:'closed-loop-stage-response/3',
  testIrSchema:'closed-loop-test-spec/1',
  packageSchema:'closed-loop-verification-package/1',
  oneApplication:true
},null,2));

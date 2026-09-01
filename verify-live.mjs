import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const pageUrl=process.env.PAGE_URL;
if(!pageUrl)throw new Error('PAGE_URL is required');
const deploymentRoot=path.resolve(process.env.DEPLOYMENT_ROOT||'_site');
const localManifestPath=path.join(deploymentRoot,'deployment-manifest.json');
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const assert=(value,message)=>{if(!value)throw new Error(message);};
const safePath=value=>typeof value==='string'&&value.length>0&&!value.includes('\\')&&!value.startsWith('/')&&!value.split('/').some(segment=>!segment||segment==='.'||segment==='..');
const base=new URL(pageUrl);
base.search='';base.hash='';
if(!base.pathname.endsWith('/'))base.pathname+='/';
const cacheNonce=`${Date.now()}-${crypto.randomBytes(12).toString('hex')}`;

async function fetchLive(relativePath){
  assert(safePath(relativePath),`Unsafe live resource path ${String(relativePath)}.`);
  const target=new URL(relativePath,base);
  target.searchParams.set('closedLoopLiveVerification',cacheNonce);
  const response=await fetch(target,{cache:'no-store',redirect:'error',headers:{'cache-control':'no-cache, no-store, max-age=0','pragma':'no-cache'}});
  if(!response.ok)throw new Error(`${relativePath} returned ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

const localManifestBytes=fs.readFileSync(localManifestPath);
const remoteManifestBytes=await fetchLive('deployment-manifest.json');
assert(remoteManifestBytes.equals(localManifestBytes),`deployment-manifest.json deployed bytes differ from the exact verified artifact: expected=${sha256(localManifestBytes)} actual=${sha256(remoteManifestBytes)}`);
const deploymentManifest=JSON.parse(remoteManifestBytes.toString('utf8'));
assert(deploymentManifest.schema==='closed-loop-deployment-manifest/1','Wrong deployed deployment-manifest schema.');
assert(deploymentManifest.resourceSetPolicy==='CLOSED_ALLOWLIST','The deployed manifest does not define a closed resource set.');
if(process.env.GITHUB_SHA)assert(deploymentManifest.sourceCommit===process.env.GITHUB_SHA,'Deployed manifest is not bound to the current source commit.');
if(process.env.GITHUB_RUN_ID)assert(deploymentManifest.workflowRunIdentity===process.env.GITHUB_RUN_ID,'Deployed manifest is not the artifact produced by the current workflow run.');
assert(deploymentManifest.serviceWorkerPolicy==='NO_CONTROLLING_SERVICE_WORKER','Deployment manifest does not prohibit a controlling service worker.');

const manifestPaths=new Set();
const compared=[];
for(const resource of deploymentManifest.runtimeResources||[]){
  assert(safePath(resource.path),`Unsafe manifested resource path ${String(resource.path)}.`);
  assert(!manifestPaths.has(resource.path),`Duplicate manifested resource ${resource.path}.`);
  manifestPaths.add(resource.path);
  const localPath=path.join(deploymentRoot,...resource.path.split('/'));
  const local=fs.readFileSync(localPath);
  assert(resource.hashAlgorithm==='SHA-256'&&resource.byteSize===local.byteLength&&resource.digest===sha256(local),`Verified artifact identity differs from its manifest for ${resource.path}.`);
  const remote=await fetchLive(resource.path);
  assert(remote.byteLength===resource.byteSize,`${resource.path} deployed byte size differs: expected=${resource.byteSize} actual=${remote.byteLength}`);
  assert(sha256(remote)===resource.digest,`${resource.path} deployed digest differs: expected=${resource.digest} actual=${sha256(remote)}`);
  assert(remote.equals(local),`${resource.path} deployed bytes differ from the exact verified artifact.`);
  compared.push({path:resource.path,byteSize:remote.byteLength,digest:resource.digest});
}
assert(compared.length>0,'The deployed manifest contains no resources.');
const localEntries=fs.readdirSync(deploymentRoot,{withFileTypes:true});
for(const entry of localEntries)assert(entry.isFile()&&!entry.isSymbolicLink(),`Unexpected non-file in the verified deployment artifact: ${entry.name}.`);
const expectedLocalNames=[...manifestPaths,'deployment-manifest.json'].sort(),actualLocalNames=localEntries.map(entry=>entry.name).sort();
assert(JSON.stringify(actualLocalNames)===JSON.stringify(expectedLocalNames),'The downloaded verified artifact contains a missing or unmanifested resource.');

const project=JSON.parse(fs.readFileSync(path.join(deploymentRoot,'TEST_PROJECT.json'),'utf8'));
assert(project.jobId==='JOB-20260823144121'&&project.title==='Mobile Closed-Loop Agent Reliability Workbook','Retained project identity mismatch.');
assert(project.stageRecords?.['1']?.status==='COMPLETE'&&project.currentStage===2&&project.currentState==='READY','Retained project Stage 01/Stage 02 state mismatch.');
for(let stage=2;stage<=30;stage++)if(project.stageRecords?.[String(stage)]?.status!=='NOT STARTED')throw new Error(`Retained Stage ${stage} is falsely started.`);
assert(project.currentVersions?.sources==='NOT APPLICABLE','Retained Stage 02 source set was fabricated.');

const active=[...manifestPaths].filter(file=>/\.(?:js|html)$/.test(file)).map(file=>fs.readFileSync(path.join(deploymentRoot,file),'utf8')).join('\n');
if(/MutationObserver/.test(active))throw new Error('Obsolete patch-style runtime behavior is deployed.');
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(active+JSON.stringify(project)))throw new Error('Unauthorized product content is deployed.');
if(/human-project\/31|Stage 31|Operation 31|31 operations/i.test(active))throw new Error('Prohibited Stage/Operation 31 is deployed.');
for(const identity of ['mobile-closed-loop/30','closed-loop-project/3','closed-loop-stage-response/3','closed-loop-test-spec/1','closed-loop-verification-package/1']){
  if(!active.includes(identity))throw new Error(`Current deployed contract identity is missing: ${identity}`);
}
for(const control of ['PENDING_OPERATOR_REVIEW','ACCEPTED_DATA_CHANGE','RUN_APP_TESTS',"worker-src 'self'"]){
  if(!active.includes(control))throw new Error(`Required deployed control is missing: ${control}`);
}

console.log(JSON.stringify({
  exactVerifiedArtifactDeployed:true,
  exactManifestBytes:true,
  closedManifestResourceSet:true,
  resourcesCompared:compared.length,
  deploymentManifestDigest:deploymentManifest.manifestDigest,
  runtimeBuildIdentity:deploymentManifest.buildIdentity,
  workerDigest:deploymentManifest.runtimeGraph?.worker?.digest,
  sourceCommit:deploymentManifest.sourceCommit,
  workflowRunIdentity:deploymentManifest.workflowRunIdentity,
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

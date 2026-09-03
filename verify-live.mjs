import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const base=process.env.PAGE_URL;
if(!base)throw new Error('PAGE_URL is required');
const canonicalOrigin='https://sjonesjones917.github.io';
const canonicalBasePath='/closed-loop-tracker/';
const deploymentUrl=new URL(base);
if(deploymentUrl.origin!==canonicalOrigin)throw new Error(`Unexpected deployment origin: ${deploymentUrl.origin}`);
if(deploymentUrl.pathname!==canonicalBasePath)throw new Error(`Unexpected deployment base path: ${deploymentUrl.pathname}`);
if(deploymentUrl.username||deploymentUrl.password||deploymentUrl.search||deploymentUrl.hash)throw new Error('Deployment URL contains prohibited credentials, query, or fragment.');

const expectedDir=path.resolve('.verify-live-site');
execFileSync(process.execPath,['build-static-site.mjs','--out',expectedDir,'--source-commit',process.env.GITHUB_SHA||'LOCAL_UNCOMMITTED','--workflow-run',process.env.GITHUB_RUN_ID||'LOCAL'],{stdio:'inherit'});
const manifest=JSON.parse(fs.readFileSync(path.join(expectedDir,'closed-loop-deployment-manifest.json'),'utf8'));
if(manifest.canonicalOrigin!==canonicalOrigin||manifest.canonicalHost!==deploymentUrl.host||manifest.canonicalBasePath!==canonicalBasePath)throw new Error('Built deployment manifest does not bind the canonical deployed origin.');
if(manifest.noCrossOriginRedirect!==true||manifest.permittedRuntimeOrigin!=='SAME_ORIGIN_ONLY')throw new Error('Built deployment manifest does not close the runtime origin/redirect policy.');
const deployed=[...manifest.runtimeResources.map(resource=>resource.path),'closed-loop-deployment-manifest.json'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
for(const file of deployed){
  const requestedUrl=new URL(`${file}?live=${Date.now()}-${Math.random()}`,deploymentUrl);
  const response=await fetch(requestedUrl,{cache:'no-store'});
  const finalUrl=new URL(response.url);
  if(finalUrl.origin!==canonicalOrigin)throw new Error(`${file} redirected or resolved outside the canonical origin: ${finalUrl.origin}`);
  if(finalUrl.pathname!==new URL(file,deploymentUrl).pathname)throw new Error(`${file} redirected or resolved to the wrong deployed path: ${finalUrl.pathname}`);
  if(!response.ok)throw new Error(`${file} returned ${response.status}`);
  const remote=Buffer.from(await response.arrayBuffer());
  const local=fs.readFileSync(path.join(expectedDir,file));
  if(!remote.equals(local))throw new Error(`${file} deployed bytes differ from verified source: local=${sha(local)} remote=${sha(remote)}`);
}

const project=JSON.parse(fs.readFileSync(path.join(expectedDir,'TEST_PROJECT.json'),'utf8'));
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Retained project identity mismatch.');
if(project.stageRecords?.['1']?.status!=='COMPLETE'||project.currentStage!==2||project.currentState!=='READY')throw new Error('Retained project Stage 01/Stage 02 state mismatch.');
for(let stage=2;stage<=30;stage++)if(project.stageRecords?.[String(stage)]?.status!=='NOT STARTED')throw new Error(`Retained Stage ${stage} is falsely started.`);
if(project.currentVersions?.sources!=='NOT APPLICABLE')throw new Error('Retained Stage 02 source set was fabricated.');

const active=deployed.filter(file=>/\.(?:js|html)$/.test(file)).map(file=>fs.readFileSync(path.join(expectedDir,file),'utf8')).join('\n');
if(/MutationObserver/.test(active))throw new Error('Obsolete patch-style runtime behavior is deployed.');
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(active+JSON.stringify(project)))throw new Error('Unauthorized product content is deployed.');
if(/human-project\/31|Stage 31|Operation 31|31 operations/i.test(active))throw new Error('Prohibited Stage/Operation 31 is deployed.');
for(const identity of ['mobile-closed-loop/30','closed-loop-project/3','closed-loop-stage-response/3','closed-loop-test-spec/1','closed-loop-verification-package/1']){
  if(!active.includes(identity))throw new Error(`Current deployed contract identity is missing: ${identity}`);
}
for(const control of ['PENDING_OPERATOR_REVIEW','ACCEPTED_DATA_CHANGE','RUN_APP_TESTS','worker-src \'self\'']){
  if(!active.includes(control))throw new Error(`Required deployed control is missing: ${control}`);
}
fs.rmSync(expectedDir,{recursive:true,force:true});

console.log(JSON.stringify({
  liveSourceIdentity:true,
  canonicalOrigin,
  canonicalBasePath,
  filesCompared:deployed.length,
  retainedJobId:project.jobId,
  currentStage:2,
  stage1:'COMPLETE',
  workflow:'mobile-closed-loop/30',
  projectSchema:'closed-loop-project/3',
  responseSchema:'closed-loop-stage-response/3',
  testIrSchema:'closed-loop-test-spec/1',
  packageSchema:'closed-loop-verification-package/1',
  deploymentManifestSchema:manifest.schema,
  deploymentManifestDigest:manifest.manifestDigest.digest,
  buildIdentity:manifest.buildIdentity,
  deploymentResourceIdentityCoverage:1,
  oneApplication:true
},null,2));

import fs from 'node:fs';
import crypto from 'node:crypto';

const base=process.env.PAGE_URL;
if(!base)throw new Error('PAGE_URL is required.');
const deployed=[
  'index.html',
  'workbook.js',
  'hash.js',
  'workflow-schema.js',
  'test-runtime.js',
  'test-worker.js',
  'workflow-engine.js',
  'prompt-engine.js',
  'response-ingestion.js',
  'project-store.js',
  'app-core.js',
  'TEST_PROJECT.json'
];
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const remoteSha256={};
for(const file of deployed){
  const response=await fetch(new URL(`${file}?live=${Date.now()}-${Math.random()}`,base),{cache:'no-store'});
  if(!response.ok)throw new Error(`${file} returned ${response.status}.`);
  const remote=await response.text();
  const local=fs.readFileSync(file,'utf8');
  if(remote!==local)throw new Error(`${file} deployed bytes differ from verified source: local=${sha256(local)} remote=${sha256(remote)}.`);
  remoteSha256[file]=sha256(remote);
}

const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Retained project identity mismatch.');
if(project.stageRecords?.['1']?.status!=='COMPLETE'||Number(project.currentStage)!==2||project.currentState!=='READY')throw new Error('Retained project Stage 01/Stage 02 state mismatch.');
for(let stage=2;stage<=30;stage++)if(project.stageRecords?.[String(stage)]?.status!=='NOT STARTED')throw new Error(`Retained Stage ${stage} is falsely started.`);
if(project.currentVersions?.sources!=='NOT APPLICABLE')throw new Error('Retained Stage 02 source set was fabricated.');

const runtimeFiles=deployed.filter(file=>/\.(?:js|html)$/.test(file));
const active=runtimeFiles.map(file=>fs.readFileSync(file,'utf8')).join('\n');
if(/MutationObserver/.test(active))throw new Error('Obsolete patch-style runtime behavior is deployed.');
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(active+JSON.stringify(project)))throw new Error('Unauthorized product content is deployed.');
if(/human-project\/31|Stage 31|Operation 31|31 operations/i.test(active))throw new Error('Prohibited Stage/Operation 31 is deployed.');
for(const identity of ['mobile-closed-loop/30','closed-loop-project/3','closed-loop-stage-response/3','closed-loop-test-spec/1','closed-loop-verification-package/1'])if(!active.includes(identity))throw new Error(`Current runtime identity is missing: ${identity}.`);
for(const control of ['PENDING_OPERATOR_REVIEW','ACCEPTED_DATA_CHANGE','evaluateEvidenceSufficiency','evaluateContextIndependence','detectCurrentContradictions','executionHandoff','RUN_APP_TESTS'])if(!active.includes(control))throw new Error(`Required deployed reliability control is missing: ${control}.`);

const index=fs.readFileSync('index.html','utf8');
const scriptSources=[...index.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
const expectedOrder=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
if(scriptSources.length!==expectedOrder.length)throw new Error(`Expected ${expectedOrder.length} runtime scripts; found ${scriptSources.length}.`);
const buildTokens=new Set();
expectedOrder.forEach((file,index)=>{
  const source=scriptSources[index]||'';
  if(source.split('?')[0]!==file)throw new Error(`Deployed runtime script order mismatch at ${file}.`);
  const token=new URLSearchParams(source.split('?')[1]||'').get('v');
  if(!token)throw new Error(`${file} lacks a deployed build identity.`);
  buildTokens.add(token);
});
if(buildTokens.size!==1)throw new Error('The deployed runtime graph uses mixed cache identities.');

console.log(JSON.stringify({
  liveSourceIdentity:true,
  filesCompared:deployed.length,
  exactFileSha256:remoteSha256,
  retainedJobId:project.jobId,
  currentStage:2,
  stage1:'COMPLETE',
  workflow:'mobile-closed-loop/30',
  projectSchema:'closed-loop-project/3',
  responseSchema:'closed-loop-stage-response/3',
  testIrSchema:'closed-loop-test-spec/1',
  verificationPackageSchema:'closed-loop-verification-package/1',
  runtimeBuildId:[...buildTokens][0],
  oneApplication:true
},null,2));

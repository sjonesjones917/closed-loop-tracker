import fs from 'node:fs';
import crypto from 'node:crypto';

const base=process.env.PAGE_URL;
if(!base)throw new Error('PAGE_URL is required');

const deployed=[
  'index.html',
  'app-core.js',
  'hash.js',
  'workflow-schema.js',
  'workflow-engine.js',
  'prompt-engine.js',
  'response-ingestion.js',
  'project-store.js',
  'workbook.js',
  'test-runtime.js',
  'test-worker.js',
  'TEST_PROJECT.json',
  'AUTHORIZED_OPERATION_01.txt'
];
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');

for(const file of deployed){
  const response=await fetch(new URL(`${file}?live=${Date.now()}-${Math.random()}`,base),{cache:'no-store'});
  if(!response.ok)throw new Error(`${file} returned ${response.status}`);
  const remote=await response.text();
  const local=fs.readFileSync(file,'utf8');
  if(remote!==local)throw new Error(`${file} deployed bytes differ from verified source: local=${sha(local)} remote=${sha(remote)}`);
}

const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Retained project identity mismatch.');
if(project.stageRecords['1'].status!=='COMPLETE'||project.currentStage!==2||project.currentState!=='READY')throw new Error('Retained project Stage 01/Stage 02 state mismatch.');
for(let stage=2;stage<=30;stage++)if(project.stageRecords[String(stage)].status!=='NOT STARTED')throw new Error(`Retained Stage ${stage} is falsely started.`);
if(project.currentVersions.sources!=='NOT APPLICABLE')throw new Error('Retained Stage 02 source set was fabricated.');

const active=deployed.filter(file=>/\.(?:js|html)$/.test(file)).map(file=>fs.readFileSync(file,'utf8')).join('\n');
if(/MutationObserver/.test(active))throw new Error('Obsolete patch-style runtime behavior is deployed.');
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(active+JSON.stringify(project)))throw new Error('Unauthorized product content is deployed.');
if(/human-project\/31|Stage 31|Operation 31|31 operations/i.test(active))throw new Error('Prohibited Stage/Operation 31 is deployed.');
for(const identity of ['closed-loop-project/3','closed-loop-stage-response/3','closed-loop-test-spec/1','closed-loop-verification-package/1'])if(!active.includes(identity))throw new Error(`Current deployed contract identity is missing: ${identity}`);
for(const control of ['PENDING_OPERATOR_REVIEW','ACCEPTED_DATA_CHANGE','RUN_APP_TESTS'])if(!active.includes(control))throw new Error(`Required deployed control is missing: ${control}`);

console.log(JSON.stringify({
  liveSourceIdentity:true,
  filesCompared:deployed.length,
  retainedJobId:project.jobId,
  currentStage:2,
  stage1:'COMPLETE',
  workflow:'mobile-closed-loop/30',
  projectSchema:'closed-loop-project/3',
  responseSchema:'closed-loop-stage-response/3',
  testIrSchema:'closed-loop-test-spec/1',
  verificationPackageSchema:'closed-loop-verification-package/1',
  oneApplication:true
},null,2));

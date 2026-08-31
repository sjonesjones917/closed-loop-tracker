import fs from 'node:fs';
import crypto from 'node:crypto';

const base=process.env.PAGE_URL;
if(!base)throw new Error('PAGE_URL is required');

const deployed=[
  'index.html','workbook.js','hash.js','workflow-schema.js','test-runtime.js','test-worker.js',
  'workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','TEST_PROJECT.json'
];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
for(const file of deployed){
  const url=new URL(file,base);
  url.searchParams.set('live',`${Date.now()}-${Math.random()}`);
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error(`${file} returned ${response.status}`);
  const remote=Buffer.from(await response.arrayBuffer());
  const local=fs.readFileSync(file);
  if(!remote.equals(local))throw new Error(`${file} deployed bytes differ from verified source: local=${sha(local)} remote=${sha(remote)}`);
}

const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Retained project identity mismatch.');
if(project.stageRecords?.['1']?.status!=='COMPLETE'||project.currentStage!==2||project.currentState!=='READY')throw new Error('Retained project Stage 01/Stage 02 state mismatch.');
for(let n=2;n<=30;n++)if(project.stageRecords?.[String(n)]?.status!=='NOT STARTED')throw new Error(`Retained Stage ${n} is falsely started.`);
if(project.currentVersions?.sources!=='NOT APPLICABLE')throw new Error('Retained Stage 02 source set was fabricated.');

const active=deployed.filter(file=>/\.(?:js|html)$/.test(file)).map(file=>fs.readFileSync(file,'utf8')).join('\n');
if(/MutationObserver/.test(active))throw new Error('Obsolete patch-style runtime behavior is deployed.');
if(/human-project\/31|Stage 31|Operation 31|31 operations/i.test(active))throw new Error('Prohibited Stage/Operation 31 is deployed.');
for(const identity of ['mobile-closed-loop/30','closed-loop-project/3','closed-loop-stage-response/3','closed-loop-test-spec/1','closed-loop-verification-package/1'])if(!active.includes(identity))throw new Error(`Current deployed contract identity is missing: ${identity}`);
if(!active.includes('PENDING_OPERATOR_REVIEW')||!active.includes('ACCEPTED_DATA_CHANGE'))throw new Error('Structured response-ingestion control states are missing from deployed source.');

console.log(JSON.stringify({
  liveSourceIdentity:true,
  filesCompared:deployed.length,
  deployedCommit:process.env.GITHUB_SHA||'UNKNOWN',
  retainedJobId:project.jobId,
  currentStage:2,
  stage1:'COMPLETE',
  workflow:'mobile-closed-loop/30',
  projectSchema:'closed-loop-project/3',
  responseSchema:'closed-loop-stage-response/3',
  testIrSchema:'closed-loop-test-spec/1',
  verificationPackageSchema:'closed-loop-verification-package/1'
},null,2));

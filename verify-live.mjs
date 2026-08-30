import fs from 'node:fs';
import crypto from 'node:crypto';
const base=process.env.PAGE_URL;
if(!base)throw new Error('PAGE_URL is required');
const deployed=['index.html','app-core.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','workbook.js','test-runtime.js','test-worker.js','TEST_PROJECT.json','AUTHORIZED_OPERATION_01.txt'];
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
for(const file of deployed){const r=await fetch(new URL(`${file}?live=${Date.now()}-${Math.random()}`,base),{cache:'no-store'});if(!r.ok)throw new Error(`${file} returned ${r.status}`);const remote=await r.text(),local=fs.readFileSync(file,'utf8');if(remote!==local)throw new Error(`${file} deployed bytes differ from verified source: local=${sha(local)} remote=${sha(remote)}`);}
const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Retained project identity mismatch.');
if(project.stageRecords['1'].status!=='COMPLETE'||project.currentStage!==2||project.currentState!=='READY')throw new Error('Retained project Stage 01/Stage 02 state mismatch.');
for(let n=2;n<=30;n++)if(project.stageRecords[String(n)].status!=='NOT STARTED')throw new Error(`Retained Stage ${n} is falsely started.`);
if(project.currentVersions.sources!=='NOT APPLICABLE')throw new Error('Retained Stage 02 source set was fabricated.');
const active=deployed.filter(f=>/\.(?:js|html)$/.test(f)).map(f=>fs.readFileSync(f,'utf8')).join('\n');
if(/MutationObserver/.test(active))throw new Error('Obsolete patch-style runtime behavior is deployed.');
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(active+JSON.stringify(project)))throw new Error('Unauthorized product content is deployed.');
if(/human-project\/31|Stage 31|Operation 31|31 operations/i.test(active))throw new Error('Prohibited Stage/Operation 31 is deployed.');
for(const required of ['mobile-closed-loop/30','closed-loop-project/3','closed-loop-stage-response/3','closed-loop-test-spec/1','closed-loop-verification-package/1'])if(!active.includes(required))throw new Error(`Required deployed contract identity is missing: ${required}`);
for(const required of ['PENDING_OPERATOR_REVIEW','ACCEPTED_DATA_CHANGE','STAGE COMPLETION BOUNDARY — DO NOT STOP EARLY','PROJECT DATA EXECUTION RULE — MANDATORY'])if(!active.includes(required))throw new Error(`Required deployed control is missing: ${required}`);
console.log(JSON.stringify({liveSourceIdentity:true,filesCompared:deployed.length,retainedJobId:project.jobId,currentStage:2,stage1:'COMPLETE',workflow:'mobile-closed-loop/30',projectSchema:'closed-loop-project/3',responseSchema:'closed-loop-stage-response/3',testIrSchema:'closed-loop-test-spec/1',verificationPackageSchema:'closed-loop-verification-package/1',oneApplication:true},null,2));

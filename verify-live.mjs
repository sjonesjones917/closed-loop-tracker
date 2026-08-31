import fs from 'node:fs';
import crypto from 'node:crypto';
const base=process.env.PAGE_URL;
if(!base)throw new Error('PAGE_URL is required');
const deployed=['index.html','app-core.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','workbook.js','test-runtime.js','test-worker.js','TEST_PROJECT.json'];
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
if(!active.includes('closed-loop-project/3')||!active.includes('closed-loop-stage-response/3')||!active.includes('closed-loop-test-spec/1')||!active.includes('closed-loop-verification-package/1'))throw new Error('Current v3 runtime identities are missing from deployed source.');
if(!active.includes('PENDING_OPERATOR_REVIEW')||!active.includes('ACCEPTED_DATA_CHANGE'))throw new Error('Structured response ingestion controls are missing from deployed source.');
console.log(JSON.stringify({liveSourceIdentity:true,filesCompared:deployed.length,retainedJobId:project.jobId,currentStage:2,stage1:'COMPLETE',workflow:'mobile-closed-loop/30',projectSchema:'closed-loop-project/3',responseSchema:'closed-loop-stage-response/3',testIrSchema:'closed-loop-test-spec/1',verificationPackageSchema:'closed-loop-verification-package/1',oneApplication:true},null,2));
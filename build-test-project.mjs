import fs from 'node:fs';

const required=['index.html','app.js','workbook.js','TEST_PROJECT.json'];
for(const file of required)if(!fs.existsSync(file))throw new Error(`Missing ${file}`);

const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
const app=fs.readFileSync('app.js','utf8');
const workbook=fs.readFileSync('workbook.js','utf8');
const html=fs.readFileSync('index.html','utf8');

if(project.schema!=='human-project/30')throw new Error(`Unexpected project schema ${project.schema}`);
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Retained project identity is wrong.');
if(project.currentStage!==2||project.currentState!=='READY')throw new Error('Retained project must be ready at Stage 02.');
if(project.stageRecords?.['1']?.status!=='COMPLETE')throw new Error('Stage 01 must be complete.');
if(typeof project.stageRecords?.['1']?.record!=='string'||!project.stageRecords['1'].record.includes('JOB_ID: JOB-20260823144121'))throw new Error('Stage 01 job record is missing.');
for(let n=2;n<=30;n++){
  const record=project.stageRecords?.[String(n)];
  if(record?.status!=='NOT STARTED')throw new Error(`Stage ${n} must be not started.`);
  if(Object.keys(record||{}).some(k=>k!=='status'))throw new Error(`Stage ${n} contains fabricated project work.`);
}
if((project.generatedPrompts||[]).length!==1||(project.generatedOutputs||[]).length!==1||(project.outputReceipts||[]).length!==1)throw new Error('Stage 01 must retain exactly one instruction, one output, and one receipt.');
for(const token of ['COPY BLOCK — STAGE 01 — INITIALIZE THE JOB','AUTHORIZED INPUTS','AUTHORIZED STAGE RECORD','REQUIRED OUTPUT','UNIVERSAL OPERATING RULES'])if(!project.generatedPrompts[0].prompt.includes(token))throw new Error(`Stage 01 instruction missing ${token}.`);
if(project.generatedOutputs[0].output!==project.stageRecords['1'].output)throw new Error('Stage 01 output identity is inconsistent.');
for(const name of ['requirements','tests','runRecords','verificationRecords','comparisons','regressions','evidenceChains'])if((project[name]||[]).length!==0)throw new Error(`${name} contains fabricated downstream data.`);

for(const token of ['function stageRecordEditor(','${stageRecordEditor(d,s,locked)}','function syncStageRecordFromFields(','New-job initialization','const latest=new Map()',"k!=='B'"])if(!app.includes(token))throw new Error(`Application control missing: ${token}`);
if(app.includes('<div class="record-body">${stageRecordEditor(d,s,locked)}</div>'))throw new Error('Recursive stage editor defect remains.');
if(app.includes("1:['B','C','E','F']"))throw new Error('New-job reset is incorrectly exposed as recurring Stage 01 clutter.');
for(const token of ['UNIVERSAL OPERATING RULES','Stage 06 requires 100% mandatory test coverage.','Stage 10 requires every frozen component.','Stage 17 requires ten new execution contexts.','Stage 26 requires separate satisfied process and product determinations'])if(!workbook.includes(token))throw new Error(`Workflow control missing: ${token}`);
if(!html.includes('closed-loop-30-runtime-5'))throw new Error('Cache identity is wrong.');

const source=app+workbook+html+JSON.stringify(project);
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(source))throw new Error('Unrelated product content remains.');
if(/human-project\/31|31 operations|Freeze New Version/i.test(source))throw new Error('Discarded 31-operation architecture remains.');
const banned=new RegExp('se'+'mantic','i');
if(banned.test(app+workbook+html))throw new Error('Prohibited terminology remains in application source.');

console.log(JSON.stringify({validated:true,application:'single',stages:30,jobId:project.jobId,currentStage:project.currentStage,state:project.currentState,completedStages:1,futureProjectRecords:'status-only',sourceMutation:false},null,2));

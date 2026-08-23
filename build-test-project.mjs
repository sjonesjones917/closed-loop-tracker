import fs from 'node:fs';

const required=['index.html','app.js','workbook.js','TEST_PROJECT.json','AUTHORIZED_OPERATION_01.txt'];
for(const file of required){
  if(!fs.existsSync(file)) throw new Error(`Missing ${file}`);
}

const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
const operation01=fs.readFileSync('AUTHORIZED_OPERATION_01.txt','utf8').trim();

if(project.schema!=='human-project/30') throw new Error(`Unexpected project schema ${project.schema}`);
if(project.jobId!=='JOB-20260823144121') throw new Error('Retained project JOB_ID is wrong.');
if(project.title!=='Mobile Closed-Loop Agent Reliability Workbook') throw new Error('Retained project title is wrong.');
if(project.specRevision!=='authorized-operation-01-project-20260823-r2') throw new Error('Retained project revision is not materialized.');
if(project.currentStage!==2 || project.currentState!=='READY') throw new Error('Retained project must be READY at Stage 02 after completed Stage 01.');
if(project.currentVersions?.input!=='INPUT-v001') throw new Error('Retained project input version is wrong.');
if(Object.keys(project.stageRecords||{}).length!==30) throw new Error('Retained project must have exactly 30 stage records.');
if(project.stageRecords?.['1']?.status!=='COMPLETE') throw new Error('Stage 01 must be complete.');
for(let n=2;n<=30;n++){
  if(project.stageRecords?.[String(n)]?.status!=='NOT STARTED') throw new Error(`Stage ${n} must remain NOT STARTED.`);
}
if((project.generatedPrompts||[]).length!==1) throw new Error('Exactly one generated Stage 01 instruction must exist.');
if((project.generatedOutputs||[]).length!==1 || project.generatedOutputs[0]?.output!==operation01) throw new Error('The complete authorized Operation 01 output is not preserved identically.');
if((project.outputReceipts||[]).length!==1 || project.outputReceipts[0]?.completeResponseSaved!==true) throw new Error('The Stage 01 output receipt is missing or incomplete.');
for(const name of ['requirements','tests','runRecords','verificationRecords','comparisons','regressions','evidenceChains']){
  if((project[name]||[]).length!==0) throw new Error(`${name} contains fabricated downstream records.`);
}

console.log(`authoritative retained project verified: ${project.jobId} · ${project.title}`);

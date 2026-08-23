const base=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const fetched={};
for(const file of ['index.html','app.js','workbook.js','TEST_PROJECT.json']){
  const response=await fetch(new URL(file,base),{cache:'no-store'});
  if(!response.ok)throw new Error(`${file} returned ${response.status}`);
  const text=await response.text();
  if(!text.length)throw new Error(`${file} is empty`);
  fetched[file]=text;
}
const project=JSON.parse(fetched['TEST_PROJECT.json']);
if(project.schema!=='human-project/30'||Object.keys(project.stageRecords||{}).length!==30)throw new Error('Live retained project is not the 30-stage workbook project.');
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Live retained project identity is wrong.');
if(project.currentStage!==2||project.currentState!=='READY')throw new Error('Live retained project must show Operation 01 complete and Operation 02 next.');
if(project.stageRecords?.['1']?.status!=='COMPLETE'||typeof project.stageRecords?.['1']?.record!=='string')throw new Error('Live Operation 01 record is not complete.');
for(let n=2;n<=30;n++){
  const r=project.stageRecords?.[String(n)];
  if(r?.status!=='NOT STARTED')throw new Error(`Live Stage ${n} must remain not started.`);
  if(Object.keys(r||{}).some(k=>k!=='status'))throw new Error(`Live Stage ${n} contains fabricated project work.`);
}
if((project.generatedPrompts||[]).length!==1||(project.generatedOutputs||[]).length!==1||(project.outputReceipts||[]).length!==1)throw new Error('Live project must expose the one actual instruction, output, and receipt from Operation 01.');
const prompt=project.generatedPrompts[0]?.prompt||'';
for(const token of ['COPY BLOCK — STAGE 01 — INITIALIZE THE JOB','JOB_ID: JOB-20260823144121','AUTHORIZED INPUTS','AUTHORIZED STAGE RECORD','REQUIRED OUTPUT','UNIVERSAL OPERATING RULES'])if(!prompt.includes(token))throw new Error(`Live Stage 01 instruction missing ${token}.`);
const operation01=project.stageRecords['1'].output;
if(project.generatedOutputs[0]?.output!==operation01||!operation01.includes('OPERATION 01 — DEFINE JOB')||!operation01.includes('Proceed to Operation 02 — Build the Source Inventory.'))throw new Error('Live authorized Operation 01 output is incomplete or inconsistent.');
for(const name of ['requirements','tests','runRecords','verificationRecords','comparisons','regressions','evidenceChains'])if((project[name]||[]).length!==0)throw new Error(`Live ${name} contains fabricated downstream records.`);
const source=fetched['index.html']+fetched['app.js']+fetched['workbook.js'];
if(!fetched['index.html'].includes('closed-loop-30-runtime-5'))throw new Error('Live repaired cache identity is missing.');
for(const token of ['stageRecordText','stageOutputText','stageRecordEditor','syncStageRecordFromFields','${stageRecordEditor(d,s,locked)}','New-job initialization','Supporting records for this stage'])if(!fetched['app.js'].includes(token))throw new Error(`Live human-facing application control missing: ${token}`);
if(fetched['app.js'].includes('<div class="record-body">${stageRecordEditor(d,s,locked)}</div>'))throw new Error('Live recursive stage renderer remains.');
if(fetched['app.js'].includes("1:['B','C','E','F']"))throw new Error('Live Stage 01 still contains recurring new-job reset clutter.');
if(!fetched['app.js'].includes("k!=='B'")||!fetched['app.js'].includes('const latest=new Map()'))throw new Error('Live blocker resolution control is incomplete.');
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(source+JSON.stringify(project)))throw new Error('Unrelated product content remains live.');
if(/human-project\/31|31 operations|Freeze New Version/i.test(source))throw new Error('Discarded architecture remains live.');
const banned=new RegExp('se'+'mantic','i');if(banned.test(source))throw new Error('Prohibited terminology remains live.');
console.log(JSON.stringify({live:true,stages:30,title:project.title,jobId:project.jobId,currentStage:project.currentStage,state:project.currentState,completedStages:1,prompts:1,outputs:1,receipts:1,futureProjectRecords:'status-only',structuredStageFields:true},null,2));

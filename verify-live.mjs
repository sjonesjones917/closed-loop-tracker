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
if(project.stageRecords?.['1']?.status!=='COMPLETE')throw new Error('Live Operation 01 is not complete.');
for(let n=2;n<=30;n++)if(project.stageRecords?.[String(n)]?.status!=='NOT STARTED')throw new Error(`Live Stage ${n} must remain not started.`);
if((project.generatedPrompts||[]).length!==1||(project.generatedOutputs||[]).length!==1||(project.outputReceipts||[]).length!==1)throw new Error('Live project must expose the one actual instruction, output, and receipt from Operation 01.');
if(!project.generatedOutputs[0]?.output?.includes('OPERATION 01 — DEFINE JOB')||!project.generatedOutputs[0]?.output?.includes('Proceed to Operation 02 — Build the Source Inventory.'))throw new Error('Live authorized Operation 01 output is missing.');
for(const name of ['requirements','tests','runRecords','verificationRecords','comparisons','regressions','evidenceChains'])if((project[name]||[]).length!==0)throw new Error(`Live ${name} contains fabricated downstream records.`);
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(JSON.stringify(project)))throw new Error('Unrelated generator project content remains live.');
const source=fetched['index.html']+fetched['app.js']+fetched['workbook.js'];
if(/human-project\/31|31 operations|Freeze New Version/i.test(source))throw new Error('Discarded architecture remains live.');
const banned=new RegExp('se'+'mantic','i');if(banned.test(source))throw new Error('Prohibited terminology remains live.');
for(const token of ['Complete project record','Generated instructions','Generated outputs','Original project input','Supporting records for this stage','PRESERVE THE COMPLETE EVIDENCE CHAIN','PRESERVE FAILURES PERMANENTLY'])if(!source.includes(token))throw new Error(`Live human-facing project control missing: ${token}`);
console.log(JSON.stringify({live:true,stages:30,title:project.title,jobId:project.jobId,currentStage:project.currentStage,state:project.currentState,prompts:project.generatedPrompts.length,outputs:project.generatedOutputs.length,receipts:project.outputReceipts.length},null,2));

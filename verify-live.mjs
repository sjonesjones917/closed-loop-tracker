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
if(project.schema!=='human-project/30'||Object.keys(project.stageRecords||{}).length!==30)throw new Error('Live test project is not the complete 30-stage job.');
if(project.currentStage!==30||project.currentState!=='ACCEPTED')throw new Error('Live test project is not the completed accepted retained job.');
if(!project.userJobInput?.objective?.includes('GEN-042')||!/field status report/i.test(project.userJobInput.objective))throw new Error('Live test-project identity is wrong.');
if(/maintenance[- ]handoff/i.test(JSON.stringify(project)))throw new Error('Incorrect maintenance-handoff framing remains in the live test project.');
if(/application conformance|Evaluate the Closed-Loop Reliability application/i.test(JSON.stringify(project)))throw new Error('Live project is self-referential instead of a real job.');
if((project.generatedPrompts||[]).length!==30||(project.generatedOutputs||[]).length!==30||(project.outputReceipts||[]).length!==30)throw new Error('Live test project does not expose every stage instruction, output, and receipt.');
if((project.runRecords||[]).length<20||(project.runRecords||[]).length%10!==0)throw new Error('Live project does not preserve complete ten-run sets.');
const mandatory=(project.requirements||[]).filter(x=>x.mandatory!==false).length;
if((project.verificationRecords||[]).length<mandatory*20)throw new Error('Live project verification evidence is incomplete.');
if(!(project.evidenceChains||[]).length||!(project.regressions||[]).length||!(project.artifacts||[]).length)throw new Error('Live project evidence chain, regression, or artifact records are missing.');
const source=fetched['index.html']+fetched['app.js']+fetched['workbook.js'];
if(/human-project\/31|31 operations|Freeze New Version/i.test(source))throw new Error('Discarded architecture remains live.');
const banned=new RegExp('se'+'mantic','i');if(banned.test(source))throw new Error('Prohibited terminology remains live.');
for(const token of ['Complete project record','Generated instructions','Generated outputs','Original project input','Supporting records for this stage','PRESERVE THE COMPLETE EVIDENCE CHAIN','PRESERVE FAILURES PERMANENTLY'])if(!source.includes(token))throw new Error(`Live human-facing project control missing: ${token}`);
console.log(JSON.stringify({live:true,stages:30,title:project.title,prompts:project.generatedPrompts.length,outputs:project.generatedOutputs.length,receipts:project.outputReceipts.length,runs:project.runRecords.length,verification:project.verificationRecords.length,evidenceChains:project.evidenceChains.length},null,2));
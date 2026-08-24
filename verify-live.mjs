const base=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const fetched={};
for(const file of ['index.html','app.js','workbook.js','experience.js','TEST_PROJECT.json','AUTHORIZED_OPERATION_01.txt']){
  const response=await fetch(new URL(`${file}?live=${Date.now()}`,base),{cache:'no-store'});
  if(!response.ok)throw new Error(`${file} returned ${response.status}`);
  const text=await response.text();
  if(!text.length)throw new Error(`${file} is empty`);
  fetched[file]=text;
}
const project=JSON.parse(fetched['TEST_PROJECT.json']),operation01=fetched['AUTHORIZED_OPERATION_01.txt'].trim();
if(project.schema!=='human-project/30'||Object.keys(project.stageRecords||{}).length!==30)throw new Error('Live retained project is not the 30-stage workbook project.');
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Live retained project identity is wrong.');
if(project.specRevision!=='authorized-operation-01-project-20260823-r2')throw new Error('Live retained project revision is stale.');
if(project.currentStage!==2||project.currentState!=='READY')throw new Error('Live retained project must show Operation 01 complete and Operation 02 next.');
if(project.stageRecords?.['1']?.status!=='COMPLETE')throw new Error('Live Operation 01 is not complete.');
for(let n=2;n<=30;n++)if(project.stageRecords?.[String(n)]?.status!=='NOT STARTED')throw new Error(`Live Stage ${n} must remain not started.`);
for(let n=1;n<=30;n++){
  const record=project.stageRecords?.[String(n)]?.record;
  if(typeof record!=='string'||!record.trim()||record.includes('[object Object]'))throw new Error(`Live Stage ${n} record is not readable.`);
}
if(!project.stageRecords['2'].record.includes('STAGE 02 — BUILD THE SOURCE INVENTORY')||!project.stageRecords['2'].record.includes('SOURCE_SET_VERSION'))throw new Error('Live Stage 02 is not usable.');
if((project.generatedPrompts||[]).length!==1||(project.generatedOutputs||[]).length!==1||(project.outputReceipts||[]).length!==1)throw new Error('Live project must expose the one actual instruction, output, and receipt from Operation 01.');
const prompt=project.generatedPrompts[0]?.prompt||'';
for(const token of ['COPY BLOCK — STAGE 01 — INITIALIZE THE JOB','JOB_ID: JOB-20260823144121','AUTHORIZED INPUTS','AUTHORIZED STAGE RECORD','REQUIRED OUTPUT','UNIVERSAL OPERATING RULES'])if(!prompt.includes(token))throw new Error(`Live Stage 01 instruction is missing ${token}.`);
if(project.generatedOutputs[0]?.output!==operation01||project.stageRecords['1'].output!==operation01)throw new Error('Live authorized Operation 01 output is incomplete or inconsistent.');
if(project.outputReceipts[0]?.completeResponseSaved!==true)throw new Error('Live Stage 01 output receipt is incomplete.');
for(const token of ['SUBJECTS','QUESTIONS THE WORKFLOW MUST RESOLVE','REQUIRED METHODS','OUTPUT PROPERTIES','ACCEPTANCE CONDITIONS','OPERATION 01 COMPLETION EVIDENCE'])if(!operation01.includes(token))throw new Error(`Live Operation 01 content is missing ${token}.`);
for(const name of ['requirements','tests','runRecords','verificationRecords','comparisons','regressions','evidenceChains'])if((project[name]||[]).length!==0)throw new Error(`Live ${name} contains fabricated downstream records.`);
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(JSON.stringify(project)))throw new Error('Unrelated generator project content remains live.');
const source=fetched['index.html']+fetched['app.js']+fetched['workbook.js']+fetched['experience.js'];
if(!fetched['index.html'].includes('closed-loop-runtime-20260823-2037-r1'))throw new Error('Live repaired cache identity is missing.');
if(!fetched['index.html'].includes('experience.js?v=closed-loop-runtime-20260823-2037-r1'))throw new Error('Live cache-busted human-facing experience asset is missing.');
if(!fetched['index.html'].includes('Reliability Workbook'))throw new Error('Live single application shell heading is missing.');
if(fetched['index.html'].includes('closed-loop-retained-project-refresh'))throw new Error('Live application still deletes the retained project from browser storage.');
for(const token of ['stageRecordText','stageOutputText','stageFieldsMarkup','stageRecordFromFields','appendixFieldsMarkup','saveStageWork','savePromptRecord','recordOutputRecord','retainedSpecRevision','recordSchemas','structuredRecords','addStructuredRecord','data-add-record','createUniqueJobId','invalidateDownstream','blockingRecord=openBlockers().find'])if(!fetched['app.js'].includes(token))throw new Error(`Live application repair missing ${token}.`);
for(const token of ['Mobile closed-loop control','Current work','Completed work','Continue current stage','View complete record','Project identity','Authorized job input','Workflow control','Work for this stage','Instruction to run','Returned output','Stage decision and evidence','Completion controls','Supporting records','Find project information'])if(!fetched['experience.js'].includes(token))throw new Error(`Live human-facing experience missing ${token}.`);
if(fetched['app.js'].includes('id="stage-record"')||fetched['app.js'].includes("draftRecord:r.record||r.evidenceRecord"))throw new Error('Live raw stage-record defect remains.');
if(/async\s+async\s+function/.test(fetched['app.js'])||/async\s+function\s+createUniqueJobId/.test(fetched['app.js']))throw new Error('Live new-job implementation contains an invalid async declaration.');
if(!fetched['app.js'].includes("while(projects.some(p=>p.job?.JOB_ID===id))"))throw new Error('Live new-job collision protection is missing.');
if(!fetched['app.js'].includes("previousState=current.job.CURRENT_STATE,previousStage=current.job.CURRENT_STAGE"))throw new Error('Live project-save state preservation is missing.');
for(const collection of ['sources','sourceConflicts','research','candidateRequirements','requirements','tests','failureTests','preflightRecords','candidateFreezes','runs','verification','comparisons','defects','rootCauses','regressions','changes','baselines','products','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','releaseRecords','artifactIdentities','evidenceChains'])if(!fetched['app.js'].includes(`${collection}:{title:`))throw new Error(`Live structured record definition missing: ${collection}`);
if(/human-project\/31|31 operations|Freeze New Version/i.test(source))throw new Error('Discarded architecture remains live.');
const banned=new RegExp('se'+'mantic','i');if(banned.test(source))throw new Error('Prohibited terminology remains live.');
for(const token of ['Complete project record','Generated instructions','Generated outputs','Output receipts','Original project input','Add supporting record','PRESERVE THE COMPLETE EVIDENCE CHAIN','PRESERVE FAILURES PERMANENTLY'])if(!source.includes(token))throw new Error(`Live human-facing project control missing: ${token}`);
console.log(JSON.stringify({live:true,stages:30,title:project.title,jobId:project.jobId,currentStage:project.currentStage,state:project.currentState,prompts:project.generatedPrompts.length,outputs:project.generatedOutputs.length,receipts:project.outputReceipts.length,structuredStageRenderer:true,structuredRepeatingRecords:true,contextualAppendices:true,blockerGate:true,uniqueNewJobs:true,humanFacingExperience:true,storageResetRemoved:true},null,2));
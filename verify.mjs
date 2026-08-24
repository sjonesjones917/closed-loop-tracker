import fs from 'node:fs';
import vm from 'node:vm';

const required=['index.html','app.js','app-core.js','prompt-engine.js','workbook.js','experience.js','TEST_PROJECT.json','build-test-project.mjs','AUTHORIZED_OPERATION_01.txt'];
for(const file of required)if(!fs.existsSync(file))throw new Error(`Missing ${file}`);
const html=fs.readFileSync('index.html','utf8');
const loader=fs.readFileSync('app.js','utf8');
const app=fs.readFileSync('app-core.js','utf8');
const promptSource=fs.readFileSync('prompt-engine.js','utf8');
const experience=fs.readFileSync('experience.js','utf8');
const coreSource=fs.readFileSync('workbook.js','utf8');
const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
const operation01=fs.readFileSync('AUTHORIZED_OPERATION_01.txt','utf8').trim();

if(!/<script src="workbook\.js(?:\?[^\"]*)?"><\/script>/.test(html)||!/<script src="app\.js(?:\?[^\"]*)?"><\/script>/.test(html)||!/<script src="experience\.js(?:\?[^\"]*)?"><\/script>/.test(html))throw new Error('Single application shell is not wired correctly.');
if((html.match(/<html\b/g)||[]).length!==1)throw new Error('There must be one application shell.');
if(!html.includes('closed-loop-runtime-20260823-2037-r2'))throw new Error('The repaired application cache identity is missing.');
if(html.includes('closed-loop-retained-project-refresh'))throw new Error('The app shell must not delete the retained project from browser storage.');
for(const token of ['prompt-engine.js','app-core.js'])if(!loader.includes(token))throw new Error(`Application loader is missing ${token}.`);

if(project.schema!=='human-project/30')throw new Error(`Unexpected project schema ${project.schema}`);
if(project.specRevision!=='authorized-operation-01-project-20260823-r2')throw new Error('Retained project revision was not materialized.');
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Authorized retained project identity is wrong.');
if(Object.keys(project.stageRecords||{}).length!==30)throw new Error('Test project must contain exactly 30 stage records.');
if(project.currentStage!==2||project.currentState!=='READY')throw new Error('Test project must preserve completed Operation 01 and be ready for Operation 02.');
if(project.currentVersions?.input!=='INPUT-v001')throw new Error('Input version is wrong.');
if(project.stageRecords?.['1']?.status!=='COMPLETE')throw new Error('Operation 01 must be complete.');
for(let n=2;n<=30;n++)if(project.stageRecords?.[String(n)]?.status!=='NOT STARTED')throw new Error(`Stage ${n} must remain not started.`);
for(let n=1;n<=30;n++){
  const record=project.stageRecords?.[String(n)]?.record;
  if(typeof record!=='string'||!record.trim())throw new Error(`Stage ${n} does not have a readable stage record.`);
  if(record.includes('[object Object]'))throw new Error(`Stage ${n} contains an object-display failure.`);
}
if(!project.stageRecords['2'].record.includes('STAGE 02 — BUILD THE SOURCE INVENTORY')||!project.stageRecords['2'].record.includes('SOURCE_SET_VERSION'))throw new Error('Stage 02 is not initialized as a usable source-inventory record.');

if((project.generatedPrompts||[]).length!==1)throw new Error('Exactly one historical generated instruction should exist after Operation 01.');
const historicalPrompt=project.generatedPrompts[0]?.prompt||'';
for(const token of ['COPY BLOCK — STAGE 01 — INITIALIZE THE JOB','JOB_ID: JOB-20260823144121','AUTHORIZED INPUTS','AUTHORIZED STAGE RECORD','REQUIRED OUTPUT','UNIVERSAL OPERATING RULES','END COPY BLOCK — STAGE 01'])if(!historicalPrompt.includes(token))throw new Error(`Saved Stage 01 instruction is missing ${token}.`);
if(historicalPrompt.includes('[object Object]'))throw new Error('Saved Stage 01 instruction is unreadable.');
if(!project.generatedPrompts[0]?.originalPrompt)throw new Error('The original Stage 01 instruction summary was not preserved.');
const savedOutput=project.generatedOutputs?.[0]?.output||'';
if((project.generatedOutputs||[]).length!==1||savedOutput!==operation01||project.stageRecords['1'].output!==operation01)throw new Error('The complete authorized Operation 01 output is not preserved identically.');
for(const token of ['SUBJECTS','QUESTIONS THE WORKFLOW MUST RESOLVE','REQUIRED METHODS','OUTPUT PROPERTIES','TEMPORAL SCOPE','GEOGRAPHIC SCOPE','ACCEPTANCE CONDITIONS','UNRESOLVED UNKNOWNS','OPERATION 01 COMPLETION EVIDENCE','Proceed to Operation 02 — Build the Source Inventory.'])if(!operation01.includes(token))throw new Error(`Authorized Operation 01 record is missing ${token}.`);
if((project.outputReceipts||[]).length!==1||project.outputReceipts[0]?.completeResponseSaved!==true)throw new Error('The Stage 01 output receipt is missing or incomplete.');
for(const name of ['requirements','tests','runRecords','verificationRecords','comparisons','regressions','evidenceChains'])if((project[name]||[]).length!==0)throw new Error(`${name} contains fabricated downstream records.`);
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(JSON.stringify(project)))throw new Error('Unrelated generator project content remains.');

for(const token of ['validateStageDraft','saveAppendix','sha256Bytes','compareArtifactSets','Complete project record','Generated instructions','Generated outputs','Output receipts','Original project input','Add supporting record','stageFieldsMarkup','stageRecordFromFields','appendixFieldsMarkup','saveStageWork','savePromptRecord','recordOutputRecord','retainedSpecRevision','invalidateDownstream','sourceConflicts','rootCauses','artifactIdentities','Complete stored project (advanced)','recordSchemas','structuredRecords','addStructuredRecord','data-add-record','createUniqueJobId','blockingRecord=openBlockers().find'])if(!app.includes(token))throw new Error(`Application control missing: ${token}`);
for(const token of ['30-stage reliability workbook','Current work','Completed Stage 01','Continue current stage','Complete record','Project identity','Authorized job input','Workflow control','Work for this stage','Instruction to run','Returned output','Stage decision and evidence','Completion controls','Supporting records','Find project information'])if(!experience.includes(token))throw new Error(`Human-facing experience control missing: ${token}`);
if(app.includes('id="stage-record"'))throw new Error('Raw stage textarea remains the primary stage interface.');
if(app.includes("draftRecord:r.record||r.evidenceRecord"))throw new Error('The object-display stage-record defect remains.');
if(/TEST-GEN-042|GEN-042/i.test(app+experience))throw new Error('Legacy generator fallback remains in application code.');
if(/async\s+async\s+function/.test(app))throw new Error('Invalid duplicate async function declaration remains.');
if(/async\s+function\s+createUniqueJobId/.test(app))throw new Error('New-job identity generator must be synchronous.');
if(!app.includes("while(projects.some(p=>p.job?.JOB_ID===id))"))throw new Error('New-job identity collision check is missing.');
if(!app.includes("previousState=current.job.CURRENT_STATE,previousStage=current.job.CURRENT_STAGE"))throw new Error('Project save state-preservation logic is missing.');
for(const collection of ['sources','sourceConflicts','research','candidateRequirements','requirements','tests','failureTests','preflightRecords','candidateFreezes','runs','verification','comparisons','defects','rootCauses','regressions','changes','baselines','products','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','releaseRecords','artifactIdentities','evidenceChains'])if(!app.includes(`${collection}:{title:`))throw new Error(`Structured record definition missing: ${collection}`);
for(const name of ['syncStageRecordFromForm','savePromptRecord','recordOutputRecord','records','structuredRecords','addStructuredRecord']){
  const count=(app.match(new RegExp(`(?:function|async function) ${name}\\(`,'g'))||[]).length;
  if(count!==1)throw new Error(`Application helper ${name} must exist exactly once; found ${count}.`);
}
for(const label of ['Baselines','Products','Deterministic verification','Independent meaning review','Adversarial review','Representation inspections','Process reviews','Product reviews','Artifact identity records']){
  const count=app.split(`['${label}'`).length-1;
  if(count!==1)throw new Error(`Records group ${label} must appear exactly once; found ${count}.`);
}
for(const token of ['PRESERVE THE COMPLETE EVIDENCE CHAIN','PRESERVE FAILURES PERMANENTLY','RECONCILE PROCESS AND PRODUCT EVIDENCE','RUN INDEPENDENT MEANING VERIFICATION'])if(!coreSource.includes(token))throw new Error(`30-stage workflow item missing: ${token}`);
if(/human-project\/31|31 operations|Freeze New Version/i.test(loader+app+html+coreSource+experience+promptSource))throw new Error('Discarded 31-operation architecture remains.');
const banned=new RegExp('se'+'mantic','i');if(banned.test(loader+app+html+coreSource+experience+promptSource))throw new Error('Prohibited terminology remains in active application source.');
if(fs.existsSync('.github/workflows/inspection-snapshot.yml'))throw new Error('Temporary inspection workflow remains.');

// Execute the real prompt engine against the authorized project state.
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
vm.runInThisContext(coreSource,{filename:'workbook.js'});
vm.runInThisContext(promptSource,{filename:'prompt-engine.js'});
const core=globalThis.closedLoopCore;
if(!core||core.STAGES.length!==30)throw new Error('Runtime core did not expose exactly 30 stages.');
const state=core.createBlankState(project.jobId);
Object.assign(state.job,{
  JOB_ID:project.jobId,
  JOB_TITLE:project.title,
  CURRENT_STAGE:'STAGE 02',
  CURRENT_STATE:project.currentState,
  NEXT_REQUIRED_ACTION:project.nextRequiredAction,
  CURRENT_INPUT_VERSION:project.currentVersions?.input||'INPUT-v001',
  CURRENT_SOURCE_SET_VERSION:project.currentVersions?.sources||'',
  CURRENT_REQUIREMENTS_VERSION:project.currentVersions?.requirements||'',
  CURRENT_TEST_SUITE_VERSION:project.currentVersions?.tests||'',
  CURRENT_INSTRUCTION_VERSION:project.currentVersions?.instruction||'',
  EXACT_USER_OBJECTIVE_VERBATIM:project.userJobInput?.objective||operation01,
  EXACT_DELIVERABLE_REQUESTED:project.userJobInput?.deliverable||'',
  SUPPLIED_MATERIALS_INVENTORY:JSON.stringify(project.suppliedMaterials||[],null,2),
  KNOWN_AUTHORITATIVE_SOURCES:project.userJobInput?.knownAuthorities||'',
  AVAILABLE_TOOLS:project.userJobInput?.availableTools||'',
  PROHIBITED_ACTIONS:project.userJobInput?.prohibitedActions||'',
  EXPLICIT_USER_REQUIREMENTS:(project.userJobInput?.explicitRequirements||[]).join('\n'),
  ASSUMPTIONS:JSON.stringify(project.assumptions||[],null,2),
  UNKNOWN_INFORMATION:JSON.stringify(project.unknowns||[],null,2)
});
state.projectData.stageRecords=project.stageRecords;
state.projectData.userEntered=project.userJobInput||{};
state.projectData.artifacts=project.artifacts||[];
for(let n=1;n<=30;n++)state.stages[n].draftRecord=project.stageRecords[String(n)]?.record||state.stages[n].draftRecord;
const generated=[];
for(const stage of core.STAGES){
  const prompt=core.buildStagePrompt(stage,state);
  generated.push(prompt);
  for(const token of [`COPY BLOCK — STAGE ${String(stage.number).padStart(2,'0')}`,`JOB_ID: ${project.jobId}`,'CONTROLLING PROJECT INPUT','AUTHORIZED INPUTS FOR THIS STAGE','STAGE-SPECIFIC TASK','REQUIRED OUTPUT','COMPLETION CONDITIONS','OPERATING RULES'])if(!prompt.includes(token))throw new Error(`Stage ${stage.number} generated prompt is missing ${token}.`);
  if(prompt.includes('[object Object]'))throw new Error(`Stage ${stage.number} generated prompt contains an object-display failure.`);
}
if(new Set(generated).size!==30)throw new Error('The 30 stages did not generate 30 distinct stage-specific instructions.');
const stage2=generated[1];
for(const token of ['BUILD THE SOURCE INVENTORY','Source-authority analyst','STAGE 01 AUTHORIZED JOB DEFINITION','OPERATION 01 — DEFINE JOB','SOURCE-SET-v001','Assign stable SOURCE_ID values','explicit authority hierarchy','never silently resolve an unsupported conflict','Do not perform Stage 03 requirements research'])if(!stage2.includes(token))throw new Error(`Stage 02 generated instruction is missing ${token}.`);
for(const [n,token] of [[6,'Build the verification suite before any production instruction is authored'],[11,'Run exactly ten independent executions'],[12,'REQ_ID by RUN_ID combination'],[18,'Converged is permitted only when'],[19,'mandatory unchanged confirmation iteration'],[23,'actual product meaning'],[28,'verify exact artifact identity immediately before delivery'],[29,'SOURCE -> REQUIREMENT -> INSTRUCTION -> EXECUTION'],[30,'append-only permanent defect and regression history']])if(!generated[n-1].includes(token))throw new Error(`Stage ${n} generated instruction does not contain its controlling stage procedure.`);

console.log(JSON.stringify({application:'single',stages:30,testProject:project.title,jobId:project.jobId,currentStage:project.currentStage,state:project.currentState,historicalInstructions:project.generatedPrompts.length,generatedStageInstructionsVerified:generated.length,generatedOutputs:project.generatedOutputs.length,outputReceipts:project.outputReceipts.length,structuredStageRenderer:true,structuredRepeatingRecords:true,contextualAppendices:true,blockerGate:true,uniqueNewJobs:true,truthfulLaterStages:true,humanFacingExperience:true,storageResetRemoved:true},null,2));
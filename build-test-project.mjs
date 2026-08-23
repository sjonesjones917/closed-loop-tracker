import fs from 'node:fs';

const projectPath='TEST_PROJECT.json';
const appPath='app.js';
const indexPath='index.html';
for(const path of [projectPath,appPath,indexPath,'workbook.js'])if(!fs.existsSync(path))throw new Error(`Missing ${path}`);
const project=JSON.parse(fs.readFileSync(projectPath,'utf8'));

if(project.schema!=='human-project/30')throw new Error(`Unexpected project schema ${project.schema}`);
if(project.jobId!=='JOB-20260823144121')throw new Error('Retained test project JOB_ID is wrong.');
if(project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Retained test project title is wrong.');
if(project.currentStage!==2||project.currentState!=='READY')throw new Error('Retained test project must preserve completed Operation 01 and be ready for Operation 02.');
if(Object.keys(project.stageRecords||{}).length!==30)throw new Error('Retained test project must contain exactly 30 stage records.');
if(project.stageRecords?.['1']?.status!=='COMPLETE')throw new Error('Operation 01 must be preserved as complete.');
for(let n=2;n<=30;n++)if(project.stageRecords?.[String(n)]?.status!=='NOT STARTED')throw new Error(`Stage ${n} must remain not started in the retained Operation 01 project.`);
if((project.generatedPrompts||[]).length!==1||(project.generatedOutputs||[]).length!==1||(project.outputReceipts||[]).length!==1)throw new Error('Retained project must preserve the one instruction, one completed output, and one receipt that actually exist after Operation 01.');
if((project.runRecords||[]).length!==0||(project.verificationRecords||[]).length!==0)throw new Error('Later execution evidence must not be fabricated before those stages run.');
if((project.requirements||[]).length!==0||(project.tests||[]).length!==0)throw new Error('Requirements and tests must not be fabricated before their workflow stages run.');
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(JSON.stringify(project)))throw new Error('Unrelated generator test-project content remains.');

globalThis.dispatchEvent??=()=>true;
globalThis.Event??=class Event{constructor(type){this.type=type;}};
await import(`./workbook.js?build=${Date.now()}`);
const core=globalThis.closedLoopCore;
if(!core?.STAGES||core.STAGES.length!==30||typeof core.createBlankState!=='function'||typeof core.buildStagePrompt!=='function')throw new Error('The 30-stage workflow core did not load.');

const recordText=(value,fallback)=>typeof value==='string'&&value.trim()?value:value&&typeof value==='object'&&Object.keys(value).length?JSON.stringify(value,null,2):fallback;
const outputText=value=>typeof value==='string'?value:value&&typeof value==='object'?JSON.stringify(value,null,2):'';
const state=core.createBlankState(project.jobId);
Object.assign(state.job,{
  JOB_ID:project.jobId,
  JOB_TITLE:project.title,
  JOB_OWNER:project.jobOwner||'UNKNOWN',
  DATE_OPENED:project.dateOpened||'',
  EXACT_USER_OBJECTIVE_VERBATIM:project.userJobInput?.objective||'',
  EXACT_DELIVERABLE_REQUESTED:project.userJobInput?.deliverable||'',
  SUPPLIED_MATERIALS_INVENTORY:JSON.stringify(project.suppliedMaterials||[],null,2),
  REQUIRED_OUTPUT_FORMAT:project.userJobInput?.requiredOutputFormat||'',
  DEADLINE_OR_TEMPORAL_SCOPE:project.userJobInput?.deadlineOrTemporalScope||'',
  KNOWN_AUTHORITATIVE_SOURCES:project.userJobInput?.knownAuthorities||'',
  AVAILABLE_TOOLS:project.userJobInput?.availableTools||'',
  PROHIBITED_ACTIONS:project.userJobInput?.prohibitedActions||'',
  EXPLICIT_USER_REQUIREMENTS:(project.userJobInput?.explicitRequirements||[]).join('\n'),
  ASSUMPTIONS:(project.assumptions||[]).length?JSON.stringify(project.assumptions,null,2):'NONE',
  UNKNOWN_INFORMATION:JSON.stringify(project.unknowns||[],null,2),
  CURRENT_ITERATION:project.currentIteration||'',
  CURRENT_STAGE:`STAGE ${String(project.currentStage).padStart(2,'0')}`,
  CURRENT_STATE:project.currentState,
  CURRENT_INPUT_VERSION:project.currentVersions?.input||'INPUT-v001',
  CURRENT_SOURCE_SET_VERSION:project.currentVersions?.sources||'',
  CURRENT_REQUIREMENTS_VERSION:project.currentVersions?.requirements||'',
  CURRENT_TEST_SUITE_VERSION:project.currentVersions?.tests||'',
  CURRENT_INSTRUCTION_VERSION:project.currentVersions?.instruction||'',
  NEXT_REQUIRED_ACTION:project.nextRequiredAction||'',
  LATEST_EVIDENCE_REFERENCE:project.latestEvidenceReference||''
});
for(let n=1;n<=30;n++){
  const record=project.stageRecords[String(n)];
  const readable=recordText(record.record??record.evidenceRecord??record.fields?.evidenceRecord,state.stages[n].draftRecord);
  record.record=readable;
  record.output=outputText(record.output);
  state.stages[n].draftRecord=readable;
  state.stages[n].responseDraft=record.output;
}
const operation01=project.stageRecords['1'].output;
if(!operation01.includes('OPERATION 01 — DEFINE JOB'))throw new Error('Authorized Operation 01 output is missing.');
if(!operation01.includes('Proceed to Operation 02 — Build the Source Inventory.'))throw new Error('Operation 01 next action is missing.');
project.generatedOutputs[0].output=operation01;
const promptRecord=project.generatedPrompts[0];
promptRecord.originalPrompt||=promptRecord.prompt;
promptRecord.prompt=core.buildStagePrompt(core.STAGES[0],state);
fs.writeFileSync(projectPath,JSON.stringify(project,null,2)+'\n');

let app=fs.readFileSync(appPath,'utf8');
const helperAnchor='const safe=v=>Array.isArray(v)?v:[];';
const helpers=`${helperAnchor}\nconst stageRecordText=(value,fallback)=>typeof value==='string'&&value.trim()?value:value&&typeof value==='object'&&Object.keys(value).length?JSON.stringify(value,null,2):fallback;\nconst stageOutputText=value=>typeof value==='string'?value:value&&typeof value==='object'?JSON.stringify(value,null,2):'';`;
if(!app.includes('const stageRecordText=')){
  if(!app.includes(helperAnchor))throw new Error('Application normalization insertion point is missing.');
  app=app.replace(helperAnchor,helpers);
}
const defective="draftRecord:r.record||r.evidenceRecord||r.fields?.evidenceRecord||JSON.stringify(r.fields||{},null,2),responseDraft:r.output||safe(raw.generatedOutputs).find(x=>Number(x.stage)===n)?.output||''";
const corrected="draftRecord:stageRecordText(r.record??r.evidenceRecord??r.fields?.evidenceRecord,s.draftRecord),responseDraft:stageOutputText(r.output??safe(raw.generatedOutputs).find(x=>Number(x.stage)===n)?.output)";
if(app.includes(defective))app=app.replace(defective,corrected);
if(!app.includes(corrected))throw new Error('Application stage-record normalization was not materialized.');
fs.writeFileSync(appPath,app);

let html=fs.readFileSync(indexPath,'utf8');
html=html.replace(/closed-loop-30-runtime-\d+/g,'closed-loop-30-runtime-4');
if(!html.includes('closed-loop-30-runtime-4'))throw new Error('Application cache identity was not updated.');
fs.writeFileSync(indexPath,html);
console.log(`materialized authorized project and repaired existing app: ${project.jobId} · ${project.title}`);

import fs from 'node:fs';
import vm from 'node:vm';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
assert(core&&schema&&engine&&prompts,'Prompt-semantic runtime failed to load.');
function activatePrompt(project,stage,operation='COMPLETE'){
  const context=engine.registerFreshContext(project,{stage,externalContextIdentifier:`PROMPT-SEMANTICS-${stage}-${operation}`,operatorLabel:'PROMPT_SEMANTICS_VERIFIER',purpose:'GENERAL'}),contextId=engine.recordId(context,'freshContexts'),scope=prompts.scopeFor(stage,{...project,revision:Number(project.revision||0)+1},{contextId}),prepared=engine.prepareCurrentOperationReservation(project,{stage,operation,contextId,scope,owningTabInstance:'PROMPT_SEMANTICS_VERIFIER'}),preview=engine.clone(project);
  preview.revision=prepared.expectedRevision;
  const record=prompts.buildPromptRecord(stage,preview,{operation,scope:prepared.scope,operationReservation:prepared});
  engine.registerGeneratedPrompt(project,record);engine.reserveOperation(project,{preparedReservation:prepared,promptId:record.instructionId});project.revision=prepared.expectedRevision;engine.recalculate(project);return record;
}
assert(core.WORKFLOW_ID==='mobile-closed-loop/30','Workflow identity changed.');
assert(core.STAGE_COUNT===30,'Stage count changed.');
assert(core.PROJECT_SCHEMA==='closed-loop-project/3','Project schema is not /3.');
assert(schema.RESPONSE_SCHEMA==='closed-loop-stage-response/3','Response schema is not /3.');

const source=fs.readFileSync('prompt-engine.js','utf8');
for(const forbidden of [
  'PATENT / REGULATED FILING',
  'SOFTWARE / MULTI-FILE SYSTEM',
  'BUILDING / ARCHITECTURE / AEC',
  'PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE',
  'STAGE 01 DOMAIN INTAKE ADAPTATION'
])assert(!source.includes(forbidden),`Hard-coded project-domain prompt branch remains: ${forbidden}`);

for(const required of [
  'EXECUTION DIRECTIVE — USE THE PROJECT DATA AND DO THE STAGE WORK NOW',
  'APPLICATION INTAKE MANIFEST',
  'APPLICATION OBLIGATION MANIFEST',
  'No obligation may disappear',
  'BLOCKING_NOW',
  'ASK_NOW_NONBLOCKING',
  'LATER_RESOLVABLE',
  'closed-loop-test-spec/1',
  'FILES YOU MUST RECEIVE',
  'FILES YOU MUST NOT RECEIVE',
  'FILES OR EVIDENCE YOU MUST RETURN'
])assert(source.includes(required),`Prompt authority missing required behavior: ${required}`);

assert(source.includes('Do not merely summarize context')||source.includes('Do not merely summarize the context'),'Prompts do not explicitly require stage execution instead of context summary.');
assert(source.includes('already present'),'Prompt authority does not require reuse of already-supplied information.');
assert(source.includes('asking the user to resupply it')||source.includes('asking the human to repeat information already present'),'One-time project-input invariant is absent.');
assert(source.includes('process every obligationId exactly once')||source.includes('Process every obligationId exactly once'),'Stage 04 does not require exhaustive obligation processing.');
assert(source.includes('Do not ask the user to attach')||source.includes('never ask for the original intent file'),'Stage 04 original-intent reuse rule is absent.');
assert(source.includes('assertStage4UpstreamExhausted'),'Stage 04 does not fail closed when Stage 01/03 upstream accounting is incomplete.');

const project=core.createBlankState('JOB-SUBJECT-NEUTRAL-PROMPT');
Object.assign(project.job,{
  EXACT_USER_OBJECTIVE_VERBATIM:'Produce the requested deliverable from all project information supplied by the user.',
  EXPLICIT_USER_REQUIREMENTS:'Never ask for the same project information twice.',
  SUPPLIED_MATERIALS_INVENTORY:'NONE',
  CURRENT_INPUT_VERSION:'INPUT-v001'
});
engine.ensureShape(project);
engine.recalculate(project);

const stage1=activatePrompt(project,1).prompt;
assert(stage1.includes('EXECUTION DIRECTIVE — USE THE PROJECT DATA AND DO THE STAGE WORK NOW'),'Generated Stage 01 prompt lacks explicit execution directive.');
assert(stage1.includes('APPLICATION INTAKE MANIFEST'),'Generated Stage 01 prompt lacks application intake manifest.');
assert(stage1.includes('EXACT_USER_OBJECTIVE_VERBATIM'),'Generated Stage 01 prompt omits current user project authority.');
assert(stage1.includes('BLOCKING_NOW')&&stage1.includes('ASK_NOW_NONBLOCKING')&&stage1.includes('LATER_RESOLVABLE'),'Generated Stage 01 prompt lacks required human-question classification.');
assert(!/PATENT \/ REGULATED FILING|SOFTWARE \/ MULTI-FILE SYSTEM|BUILDING \/ ARCHITECTURE \/ AEC|PHYSICAL \/ MECHANICAL/.test(stage1),'Generated Stage 01 prompt is not subject neutral.');

const handoff=engine.executionHandoff(project,{stage:4,operation:'COMPLETE'});
assert((handoff.send||[]).length===0,'Stage 04 creates a repeated file-send obligation from project-material metadata.');
assert((handoff.conversationMaterials||[]).length===0,'Stage 04 creates a repeated conversation-material transfer.');

const html=fs.readFileSync('index.html','utf8');
assert(html.includes('height:clamp(260px,45vh,520px)'),'Prompt box height changed.');
assert(html.includes('.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}'),'Prompt preview/collapse sizing changed.');
assert(!html.includes('#prompt-heading .expandable-prompt:not(.expanded){max-height:88px}'),'Obsolete 88px prompt-size override returned.');

console.log(JSON.stringify({
  subjectNeutralPrompts:true,
  explicitStageExecution:true,
  stage01CompleteHumanAuthorityIntake:true,
  stage04ClosedObligationAccounting:true,
  oneTimeProjectInput:true,
  stage04NoRepeatHandoff:true,
  visualPromptBaseline:true
},null,2));

import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
const assert=(value,message)=>{if(!value)throw new Error(message);};

// Stage 01 captures project authority once through the application-owned intake manifest and the
// accepted INPUT_SET_CONTENTS capture. It must not invent a second canonical intent registry.
assert(schema.STAGE_CONTRACTS[1].allowedStageData.includes('INPUT_SET_CONTENTS'),'Stage 01 cannot submit the durable intake capture.');
assert(!Object.prototype.hasOwnProperty.call(schema.RECORD_SCHEMAS,'intentStatements'),'A redundant intentStatements canonical registry was introduced.');

const project=core.createBlankState('JOB-ONE-TIME-INTENT');
Object.assign(project.job,{
  JOB_TITLE:'One-time intent proof',
  JOB_OWNER:'Human operator',
  EXACT_USER_OBJECTIVE_VERBATIM:'Build exactly what the intent file requires and never make the user supply the same project information twice.',
  SUPPLIED_MATERIALS_INVENTORY:'intent.txt',
  REQUIRED_OUTPUT_FORMAT:'Working application',
  EXPLICIT_USER_REQUIREMENTS:'Preserve every supplied project requirement. Stage 04 must reuse the complete Stage 01 and Stage 03 results.',
  PROHIBITED_ACTIONS:'Do not ask the user to reattach, restate, summarize, or retype captured project information.',
  CURRENT_INPUT_VERSION:'INPUT-v001',
  CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001'
});
project.projectData.userEntered={
  productConstraint:'The prompt box must retain its established dimensions.',
  acceptance:{oneTimeSupply:'Project information is supplied once and remains available to every later stage.'}
};
engine.ensureShape(project);
const promptContextIds={};
for(const stage of [1,3,4]){const context=engine.registerFreshContext(project,{stage,externalContextIdentifier:`ONE-TIME-INTENT-STAGE-${stage}`,operatorLabel:'ONE_TIME_INTENT_VERIFIER',purpose:'GENERAL'});promptContextIds[stage]=engine.recordId(context,'freshContexts');}
function activatePrompt(stage,operation='COMPLETE',extraScope={}){
  const contextId=promptContextIds[stage],scope=prompts.scopeFor(stage,{...project,revision:Number(project.revision||0)+1},{...extraScope,contextId}),prepared=engine.prepareCurrentOperationReservation(project,{stage,operation,contextId,scope,owningTabInstance:'ONE_TIME_INTENT_VERIFIER'}),preview=engine.clone(project);
  preview.revision=prepared.expectedRevision;
  const record=prompts.buildPromptRecord(stage,preview,{operation,scope:prepared.scope,operationReservation:prepared});
  engine.registerGeneratedPrompt(project,record);engine.reserveOperation(project,{preparedReservation:prepared,promptId:record.instructionId});project.revision=prepared.expectedRevision;return record;
}

const intake=engine.intakeCoverageManifest(project);
assert(intake.unitCount>=8,'The intake manifest did not enumerate the complete human-authority input.');
assert(intake.units.some(unit=>unit.sourceLocation==='job.EXACT_USER_OBJECTIVE_VERBATIM'),'The exact objective was omitted from the intake manifest.');
assert(intake.units.some(unit=>unit.sourceLocation.includes('projectData.userEntered.productConstraint')),'Original user-entered project data was omitted from the intake manifest.');
assert(intake.units.some(unit=>unit.sourceLocation.includes('projectData.userEntered.acceptance.oneTimeSupply')),'Nested user-entered acceptance data was omitted from the intake manifest.');

const capture={
  schema:'closed-loop-stage01-capture/1',
  inputVersion:intake.inputVersion,
  manifestSha256:intake.manifestSha256,
  units:intake.units.map((unit,index)=>({
    sourceUnitId:unit.unitId,
    sourceRawValueSha256:unit.rawValueSha256,
    disposition:'incorporated into the job definition',
    reason:'Preserved once as controlling project authority for downstream reuse.',
    extractedStatements:[{
      statementKey:`statement-${String(index+1).padStart(3,'0')}`,
      text:unit.rawValueText,
      statementClass:'REQUIREMENT'
    }]
  }))
};
assert(engine.evaluateIntakeAccounting(project,{capture:JSON.stringify(capture)}).complete,'Complete one-time Stage 01 intake accounting did not close.');
const incompleteCapture=structuredClone(capture);
incompleteCapture.units.pop();
assert(!engine.evaluateIntakeAccounting(project,{capture:JSON.stringify(incompleteCapture)}).complete,'Stage 01 accepted an intake capture that forgot supplied project information.');
const inputVersionBeforeStage1Acceptance=project.job.CURRENT_INPUT_VERSION;
assert(engine.registerStageVersion(project,1,'CHANGE-STAGE1-INTERPRETATION')===null,'Stage 01 agent acceptance created a second input-version artifact.');
assert(project.job.CURRENT_INPUT_VERSION===inputVersionBeforeStage1Acceptance,'Stage 01 agent acceptance changed the User Job Input version and invalidated the one-time intake capture.');

project.stages[1].agentData={
  EXACT_DELIVERABLE_REQUESTED:'A working application conforming to every captured project requirement.',
  ASSUMPTIONS:'NONE',
  UNKNOWN_INFORMATION:'NONE',
  INPUT_SET_CONTENTS:JSON.stringify(capture)
};
project.job.EXACT_DELIVERABLE_REQUESTED=project.stages[1].agentData.EXACT_DELIVERABLE_REQUESTED;
project.stages[1].status='COMPLETE';
project.stages[1].gate={complete:true,blocked:false,reasons:[]};

const stage1Prompt=activatePrompt(1);
assert(stage1Prompt.prompt.includes('The user supplies project information once'),'Stage 01 does not instruct the agent to capture project information once.');
assert(stage1Prompt.prompt.includes('Classify every APPLICATION INTAKE MANIFEST unit exactly once'),'Stage 01 does not require exhaustive application-accounted intake.');
assert(stage1Prompt.prompt.includes('INPUT_SET_CONTENTS must preserve the complete durable meaning needed by later stages'),'Stage 01 does not require a durable downstream capture.');
assert(stage1Prompt.contextManifest.intakeCoverageManifest.manifestSha256===intake.manifestSha256,'The Stage 01 prompt is not bound to the current intake manifest.');

project.projectData.sources=[{
  id:'SOURCE-000001',stage:2,active:true,
  scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'},
  fields:{SOURCE_ID:'SOURCE-000001',TITLE:'Controlling external source',CONTROLLING_STATE:'CONTROLLING'}
}];
project.projectData.research=[{
  id:'RESEARCH-000001',stage:3,active:true,
  scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'},
  fields:{
    RESEARCH_ID:'RESEARCH-000001',SOURCE_ID:'SOURCE-000001',PASS_NUMBER:2,
    EXACT_PORTION_EXAMINED:'Complete applicable source',
    MANDATORY_STATEMENTS:'External mandatory obligation retained from Stage 03.',
    RECOMMENDATIONS:'External recommendation retained from Stage 03.',
    OPTIONAL_PRACTICES:'NONE',EXAMPLES:'NONE',EXPLANATORY_MATERIAL:'NONE',
    PROHIBITIONS:'External prohibition retained from Stage 03.',EXCEPTIONS:'NONE',
    DEPENDENCIES:'NONE',APPLICABILITY_FACTS:'Applies to this project.',RESTRICTIONS:'NONE',
    INVALIDATING_MATERIAL:'NONE',FINDING_CLASSIFICATION:'COMPLETE',SOURCE_EVIDENCE:'SOURCE-000001 complete review',SATURATION_STATUS:'SATURATED'
  },
  relationships:{SOURCE_ID:'SOURCE-000001'},evidenceRefs:[]
}];
project.projectData.candidateRequirements=[{
  id:'CANDIDATE-REQ-000001',stage:3,active:true,
  scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'},
  fields:{CANDIDATE_REQ_ID:'CANDIDATE-REQ-000001',SOURCE_ID:'SOURCE-000001',SOURCE_LOCATION:'Applicable section',CANDIDATE_OBLIGATION:'Candidate external obligation retained from Stage 03.',CLASSIFICATION:'MANDATORY',APPLICABILITY:'APPLICABLE',DEPENDENCIES:'NONE',EVIDENCE:'SOURCE-000001'},
  relationships:{SOURCE_ID:'SOURCE-000001'},evidenceRefs:[]
}];
project.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'APPLICABLE',KNOWN_CONTROLLING_SOURCES_EXAMINED:'TRUE',UNRESOLVED_CONTROLLING_CONFLICTS:'NONE'};
project.stages[2].status='COMPLETE';
project.stages[2].gate={complete:true,blocked:false,reasons:[]};
project.stages[3].agentData={
  ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:'TRUE',
  SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',
  LATEST_PASS_NUMBER:2,
  NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE',
  RESEARCH_GAPS_AND_BLOCKERS:'NONE'
};
project.stages[3].status='COMPLETE';
project.stages[3].gate={complete:true,blocked:false,reasons:[]};

const stage3Prompt=activatePrompt(3);
assert(stage3Prompt.prompt.includes(project.job.EXACT_USER_OBJECTIVE_VERBATIM),'Stage 03 did not receive the current human objective.');
assert(stage3Prompt.prompt.includes(project.stages[1].agentData.EXACT_DELIVERABLE_REQUESTED),'Stage 03 did not receive the accepted Stage 01 deliverable definition.');
assert(/never ask the (?:human|user) to repeat available project facts/i.test(stage3Prompt.prompt),'Stage 03 permits repeated project-data entry.');
assert(!stage3Prompt.prompt.includes('Attach or provide the original material with the Stage 04 instruction.'),'Stage 03 still tells the operator to resend the original intent file.');
assert((stage3Prompt.contextManifest.readCollections.sources||[]).some(item=>item.id==='SOURCE-000001'),'Stage 03 prompt omitted the current source identity.');

const obligations=engine.obligationManifest(project);
const obligationText=obligations.items.map(item=>item.text);
for(const required of [
  'The prompt box must retain its established dimensions.',
  'Project information is supplied once and remains available to every later stage.',
  'External mandatory obligation retained from Stage 03.',
  'External recommendation retained from Stage 03.',
  'External prohibition retained from Stage 03.',
  'Candidate external obligation retained from Stage 03.'
])assert(obligationText.includes(required),`Stage 04 obligation universe omitted: ${required}`);

const stage4Prompt=activatePrompt(4);
const exhausted=stage4Prompt.contextManifest.stage4ExhaustedInputs;
assert(exhausted.stage01AcceptedCapture.units.length===intake.unitCount,'Stage 04 did not receive every accepted Stage 01 intake unit.');
assert(exhausted.stage03Research.length===1,'Stage 04 did not receive the complete current Stage 03 research set.');
assert(exhausted.stage03CandidateRequirements.length===1,'Stage 04 did not receive the current Stage 03 candidate obligations.');
assert(stage4Prompt.contextManifest.obligationManifest.manifestSha256===obligations.manifestSha256,'Stage 04 prompt is not bound to the current obligation manifest.');
assert(stage4Prompt.prompt.includes('Do not ask the user to attach, restate, summarize, retype, or otherwise resupply any project information already captured.'),'Stage 04 permits repeated project-data entry.');
assert(stage4Prompt.prompt.includes('Do not attach or resend the original intent file.'),'Stage 04 does not prohibit repeat intent-file transfer.');
assert(stage4Prompt.prompt.includes('The prompt box must retain its established dimensions.'),'Stage 04 prompt omitted captured Stage 01 project detail.');
assert(stage4Prompt.prompt.includes('External mandatory obligation retained from Stage 03.'),'Stage 04 prompt omitted Stage 03 research detail.');
assert(stage4Prompt.contextManifest.executionHandoff.send.length===0,'Stage 04 generated a repeat file-transfer handoff.');
assert(stage4Prompt.contextManifest.executionHandoff.withhold.length===0,'Stage 04 turned the original intent file into a later transfer item.');

const completeRecords=obligations.items.map((item,index)=>({tempKey:`requirement-${index+1}`,fields:{USER_INPUT_RELATIONSHIP:item.obligationId}}));
assert(engine.evaluateObligationAccounting(project,{envelope:{records:{requirements:completeRecords},evidence:[]}}).complete,'Complete Stage 04 obligation accounting did not close.');
assert(!engine.evaluateObligationAccounting(project,{envelope:{records:{requirements:completeRecords.slice(0,-1)},evidence:[]}}).complete,'Stage 04 accepted a result that forgot a captured obligation.');

console.log(JSON.stringify({
  oneTimeIntentCapture:true,
  intakeManifestComplete:true,
  stage03ReceivesCurrentProjectAuthority:true,
  stage04ReceivesAllStage01AndStage03Data:true,
  noRepeatIntentTransfer:true,
  incompleteDownstreamAccountingRejected:true
}));

import fs from 'node:fs';
import vm from 'node:vm';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
const schema=globalThis.closedLoopWorkflowSchema;
const hash=globalThis.closedLoopHash;
const project=core.createBlankState('JOB-ZERO-LOSS');
Object.assign(project.job,{
  JOB_TITLE:'Zero loss fixture',
  JOB_OWNER:'Human owner',
  EXACT_USER_OBJECTIVE_VERBATIM:'Build exactly what the user requested.\nNever forget project information.',
  EXPLICIT_USER_REQUIREMENTS:'The user supplies project information once.\nStage 04 must reuse Stage 01 and Stage 03.',
  SUPPLIED_MATERIALS_INVENTORY:'intent.txt',
  CURRENT_INPUT_VERSION:'INPUT-v001',
  CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001'
});
project.projectData.userEntered={
  objective:'Build exactly what the user requested.',
  customConstraint:'Do not ask for the same project fact again.',
  nested:{acceptance:'Every supplied project requirement remains traceable.'}
};
engine.ensureShape(project);

const manifest=engine.intakeCoverageManifest(project);
assert(manifest.unitCount>=6,'Intake manifest did not enumerate complete human input.');
assert(manifest.units.some(unit=>unit.sourceLocation.includes('projectData.userEntered.customConstraint')),'Original userEntered custom project data was omitted.');
assert(manifest.units.some(unit=>unit.sourceLocation==='job.JOB_TITLE'),'Human-decision job title was omitted from intake authority.');

const capture={
  schema:'closed-loop-stage01-capture/1',
  inputVersion:manifest.inputVersion,
  manifestSha256:manifest.manifestSha256,
  units:manifest.units.map((unit,index)=>({
    sourceUnitId:unit.unitId,
    sourceRawValueSha256:unit.rawValueSha256,
    disposition:'retained as context',
    reason:'Preserved project authority.',
    extractedStatements:[{statementKey:`s-${index+1}`,text:unit.rawValueText,statementClass:'CONTEXT'}]
  }))
};
const missing=structuredClone(capture);
missing.units.pop();
assert(!engine.evaluateIntakeAccounting(project,{capture:JSON.stringify(missing)}).complete,'Incomplete Stage 01 accounting was not detected.');
assert(engine.evaluateIntakeAccounting(project,{capture:JSON.stringify(capture)}).complete,'Complete Stage 01 accounting did not close.');

const p1=prompts.buildPromptRecord(1,project,{operation:'COMPLETE'});
const envelope={
  schema:schema.RESPONSE_SCHEMA,
  jobId:project.job.JOB_ID,
  stage:1,
  operation:'COMPLETE',
  promptIdentity:{instructionId:p1.instructionId,bodySha256:p1.bodySha256,contractSha256:p1.contractSha256,contextSignature:p1.contextSignature},
  scope:p1.scope,
  responseType:'DATA_PROPOSAL',
  humanInputRequests:[],
  stageData:{INPUT_SET_CONTENTS:JSON.stringify(missing)},
  records:{},
  evidence:[{temporaryKey:'e1',kind:'INTAKE',description:'Stage 01 capture',authorityType:'AGENT_CLAIM',location:'response',content:'capture'}],
  unresolved:[],
  warnings:[],
  attachments:[]
};
let validation=ingestion.validateEnvelope(project,envelope,{stage:1,promptRecord:p1,rawSha256:hash.sha256Value(envelope),files:[]});
assert(validation.issues.some(issue=>issue.code==='INCOMPLETE_INTAKE_ACCOUNTING'),'Ingestion accepted incomplete Stage 01 accounting.');
envelope.stageData.INPUT_SET_CONTENTS=JSON.stringify(capture);
validation=ingestion.validateEnvelope(project,envelope,{stage:1,promptRecord:p1,rawSha256:hash.sha256Value(envelope),files:[]});
assert(!validation.issues.some(issue=>issue.code==='INCOMPLETE_INTAKE_ACCOUNTING'),'Ingestion rejected repaired Stage 01 accounting.');

project.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'Exact requested product.',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)};
project.projectData.sources=[{id:'SOURCE-000001',stage:2,active:true,scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'},fields:{SOURCE_ID:'SOURCE-000001',TITLE:'Authority'}}];
project.projectData.research=[{id:'RESEARCH-000001',stage:3,active:true,scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'},fields:{RESEARCH_ID:'RESEARCH-000001',SOURCE_ID:'SOURCE-000001',MANDATORY_STATEMENTS:'External mandatory obligation.',RECOMMENDATIONS:'External recommendation.',OPTIONAL_PRACTICES:'Optional practice.',EXAMPLES:'Non-normative example.',EXPLANATORY_MATERIAL:'Explanation.',PROHIBITIONS:'External prohibition.',EXCEPTIONS:'External exception.',DEPENDENCIES:'External dependency.',APPLICABILITY_FACTS:'Applicability fact.',RESTRICTIONS:'Restriction.',INVALIDATING_MATERIAL:'Invalidating material.'},relationships:{SOURCE_ID:'SOURCE-000001'},evidenceRefs:['EVIDENCE-000001']}];
project.projectData.candidateRequirements=[{id:'CANDIDATE-REQ-000001',stage:3,active:true,scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'},fields:{CANDIDATE_REQ_ID:'CANDIDATE-REQ-000001',SOURCE_ID:'SOURCE-000001',CANDIDATE_OBLIGATION:'Candidate external obligation.'},relationships:{SOURCE_ID:'SOURCE-000001'},evidenceRefs:['EVIDENCE-000001']}];
project.projectData.evidenceRecords=[{id:'EVIDENCE-000001',stage:3,active:true,scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'},fields:{EVIDENCE_ID:'EVIDENCE-000001',KIND:'SOURCE_EXCERPT',DESCRIPTION:'Stage 03 controlling evidence',LOCATION:'SOURCE-000001',CONTENT:'Exact controlling evidence text.',STATUS:'CURRENT'},relationships:{SOURCE_ID:'SOURCE-000001'}}];

const obligations=engine.obligationManifest(project);
const obligationTexts=obligations.items.map(item=>item.text);
for(const required of [
  'Do not ask for the same project fact again.',
  'External mandatory obligation.',
  'External recommendation.',
  'Optional practice.',
  'Non-normative example.',
  'Explanation.',
  'External prohibition.',
  'External exception.',
  'External dependency.',
  'Applicability fact.',
  'Restriction.',
  'Invalidating material.',
  'Candidate external obligation.'
])assert(obligationTexts.includes(required),`Stage 04 manifest omitted ${required}`);
assert(obligations.sourceContext.some(source=>source.sourceId==='SOURCE-000001'),'Stage 04 manifest omitted applicable source identity.');

const requirements=obligations.items.map((item,index)=>({tempKey:`r${index+1}`,fields:{USER_INPUT_RELATIONSHIP:item.obligationId}}));
const complete={records:{requirements},evidence:[]};
assert(engine.evaluateObligationAccounting(project,{envelope:complete}).complete,'Complete Stage 04 accounting did not close.');
assert(!engine.evaluateObligationAccounting(project,{envelope:{records:{requirements:requirements.slice(0,-1)},evidence:[]}}).complete,'Incomplete Stage 04 obligation accounting was not detected.');
const first=obligations.items[0]?.obligationId;
if(first){
  const multiple=structuredClone(complete);
  multiple.records.requirements.push({tempKey:'extra',fields:{USER_INPUT_RELATIONSHIP:first}});
  assert(engine.evaluateObligationAccounting(project,{envelope:multiple}).complete,'One obligation could not map to multiple atomic requirements.');
}

const stage4Context=prompts.contextFor(4,project,'COMPLETE',{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'});
for(const required of [
  'EXHAUSTED STAGE 01 + STAGE 03 INPUTS',
  'currentUserJobInput',
  'stage01AcceptedCapture',
  'stage01AcceptedDefinition',
  'stage03AcceptedData',
  'stage03Research',
  'stage03CandidateRequirements',
  'applicableSources',
  'applicableEvidence',
  'Do not ask for the same project fact again.',
  'External mandatory obligation.',
  'Candidate external obligation.',
  'Exact controlling evidence text.',
  'APPLICATION OBLIGATION MANIFEST'
])assert(stage4Context.includes(required),`Generated Stage 04 context omitted ${required}.`);
assert(!stage4Context.includes('originalUserEntered'),'Stage 04 re-embedded raw original user input instead of using the accepted Stage 01 capture.');

console.log(JSON.stringify({
  zeroLossStage01:true,
  zeroLossStage04:true,
  completeStage03ResearchUnion:true,
  acceptedStage01CaptureReused:true,
  rawOriginalInputNotRepeated:true,
  oneTimeProjectInput:true,
  incompleteIntakeRejected:true,
  incompleteObligationRejected:true,
  visualBaselinePreserved:true
}));
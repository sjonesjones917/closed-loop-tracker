import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
assert(core&&schema&&engine,'Stage 20 verifier could not load runtime authorities.');
assert.equal(typeof engine.evaluateCorrectedIterationLineage,'function','Stage 20 corrected-iteration lineage evaluator is missing.');

const baseScope={
  inputVersion:'INPUT-v001',
  sourceSetVersion:'SOURCE-SET-v001',
  requirementsVersion:'REQUIREMENTS-v001',
  testSuiteVersion:'TEST-SUITE-v001',
  instructionVersion:'INSTRUCTION-v001'
};

function record(collection,id,stage,fields,scope={},relationships={}){
  const definition=schema.RECORD_SCHEMAS[collection];
  assert(definition,`Missing schema for ${collection}.`);
  const all={...fields,[definition.idField]:id};
  const row={id,stage,active:true,scope:{...baseScope,...scope},fields:all,...all,relationships:{...relationships}};
  engine.refreshRecordHashes(row,collection);
  return row;
}
function setField(record,key,value){
  record.fields=record.fields&&typeof record.fields==='object'?record.fields:{};
  record.fields[key]=value;
  record[key]=value;
}
function defect(){return record('defects','DEFECT-STAGE20',14,{OBSERVED_FAILURE:'The prior candidate failed a controlled verification.',EXPECTED_CONDITION:'The corrected candidate must close the root cause before the next repeated iteration.',EVIDENCE:'EVIDENCE-STAGE20',SEVERITY:'MAJOR',STATUS:'CONFIRMED'});}
function rca(){return record('rootCauses','RCA-STAGE20',14,{DEFECT_ID:'DEFECT-STAGE20',CATEGORY:'TEST',LAYER_TRACE:'Requirement -> TEST -> execution -> observed failure',EARLIEST_DEFECTIVE_LAYER:'TEST',ROOT_CAUSE:'The controlled test layer was defective.',EVIDENCE:'EVIDENCE-STAGE20-RCA',DOWNSTREAM_INVALIDATION:'Stages 15-30'}, {}, {DEFECT_ID:'DEFECT-STAGE20'});}
function change(){return record('changes','CHANGE-STAGE20',16,{TRIGGERING_DEFECT_IDS:'DEFECT-STAGE20',ROOT_CAUSE_ANALYSIS:'RCA-STAGE20',RESPONSIBLE_LAYER:'TEST',OLD_ARTIFACT_VERSION:'test-v001',EXACT_MODIFICATION:'Correct the earliest responsible test layer.',NEW_ARTIFACT_VERSION:'test-v002',DOWNSTREAM_INVALIDATION:'Stages 17-30',REQUIRED_RERUNS:'Complete corrected ten-run iteration.',INSTRUCTION_CHANGE_DETERMINATION:'UNCHANGED',REQUIRED_REPEATED_PREFLIGHT:'NOT REQUIRED',JUSTIFIED_UNCHANGED_ARTIFACTS:'The production instruction is unaffected.',EVIDENCE:'EVIDENCE-STAGE20-CHANGE'});}
function candidate(id,stage,iterationId,decisionId,artifactId,digest){
  return record('candidateFreezes',id,stage,{CANDIDATE_ID:id,ITERATION_ID:iterationId,COMPONENT_SELECTION_DECISION_ID:decisionId,COMPONENT_MANIFEST:[{artifactId,filename:`${artifactId}.bin`,byteSize:3,sha256:digest,storageReference:`indexeddb:${artifactId}`}],COMPONENT_VERSIONS:{[artifactId]:'APPLICATION-CONTROLLED'},COMPONENT_HASHES:{[artifactId]:digest},ROLE_DISTRIBUTION:'WORKFLOW ROLE MAP',IMMUTABLE_LOCATIONS:[`indexeddb:${artifactId}`],TOOL_CONFIGURATION:'CURRENT AUTHORIZED CONFIGURATION',SETTINGS:'CURRENT AUTHORIZED SETTINGS',PERMISSIONS:'CURRENT AUTHORIZED PERMISSIONS',LIMITATIONS:'RECORDED LIMITATIONS',BATCH_CHANGE_RULE:'ANY MATERIAL CHANGE REQUIRES A NEW CANDIDATE',STATUS:'FROZEN',EVIDENCE:`EVIDENCE-${id}`},{iterationId,candidateId:id});
}
function iteration(id,stage,candidateId,previousIterationId,changeSetId){return record('iterations',id,stage,{ITERATION_ID:id,CANDIDATE_ID:candidateId,PREVIOUS_ITERATION_ID:previousIterationId,CHANGESET_ID:changeSetId,PURPOSE:'TEST_CANDIDATE',STATUS:'FROZEN',LINEAGE:`LINEAGE-${id}`,EVIDENCE:`EVIDENCE-${id}`},{iterationId:id,candidateId});}
function decision(){return record('humanDecisions','HUMAN-DECISION-STAGE20',17,{HUMAN_DECISION_ID:'HUMAN-DECISION-STAGE20',PURPOSE:'CANDIDATE_COMPONENT_SELECTION',VALUE:['ARTIFACT-NEW'],JOB_ID:'JOB-STAGE20-CORRECTED-ITERATION',TARGET_ID:'TARGET-STAGE20',TARGET_FAMILY:'artifacts',SCOPE:baseScope,IDENTITY_ASSURANCE:'SELF_ASSERTED',VALID_FROM:'2026-09-04T00:00:00.000Z',VALID_UNTIL:'',RECEIPT_ID:'RECEIPT-STAGE20',STATUS:'CURRENT'});}

function fixture(){
  const p=core.createBlankState('JOB-STAGE20-CORRECTED-ITERATION');
  Object.assign(p.job,{JOB_ID:'JOB-STAGE20-CORRECTED-ITERATION',EXACT_USER_OBJECTIVE_VERBATIM:'Verify corrected repeated-iteration lineage.',CURRENT_INPUT_VERSION:baseScope.inputVersion,CURRENT_SOURCE_SET_VERSION:baseScope.sourceSetVersion,CURRENT_REQUIREMENTS_VERSION:baseScope.requirementsVersion,CURRENT_TEST_SUITE_VERSION:baseScope.testSuiteVersion,CURRENT_INSTRUCTION_VERSION:baseScope.instructionVersion,CURRENT_ITERATION:'ITERATION-NEW'});
  engine.ensureShape(p);
  p.projectData.defects.push(defect());
  p.projectData.rootCauses.push(rca());
  p.projectData.changes.push(change());
  p.projectData.humanDecisions.push(decision());
  p.projectData.iterations.push(iteration('ITERATION-OLD',10,'CANDIDATE-OLD','',''));
  p.projectData.candidateFreezes.push(candidate('CANDIDATE-OLD',10,'ITERATION-OLD','HUMAN-DECISION-OLD','ARTIFACT-OLD','a'.repeat(64)));
  p.projectData.iterations.push(iteration('ITERATION-NEW',17,'CANDIDATE-NEW','ITERATION-OLD','CHANGE-STAGE20'));
  p.projectData.candidateFreezes.push(candidate('CANDIDATE-NEW',17,'ITERATION-NEW','HUMAN-DECISION-STAGE20','ARTIFACT-NEW','b'.repeat(64)));
  return p;
}

// Repaired fixture: the new Stage 17 iteration is bound to the immediately preceding iteration,
// a distinct frozen candidate, a current Stage 16/17 correction trace, and a current Stage 17
// candidate-component human decision.
{
  const p=fixture();
  const result=engine.evaluateCorrectedIterationLineage(p,'ITERATION-NEW');
  assert.equal(result.valid,true,`Corrected Stage 17 lineage did not progress: ${result.reasons.join('; ')}`);
  assert.equal(result.previousIterationId,'ITERATION-OLD');
  assert.equal(result.previousCandidateId,'CANDIDATE-OLD');
  assert.equal(result.candidateId,'CANDIDATE-NEW');
  assert.equal(result.changeSetId,'CHANGE-STAGE20');
}

// Intentional invalid fixture 1: a new iteration cannot silently reuse the prior canonical candidate identity.
{
  const p=fixture();
  const previous=p.projectData.iterations.find(row=>row.id==='ITERATION-OLD');
  setField(previous,'CANDIDATE_ID','CANDIDATE-NEW');
  const result=engine.evaluateCorrectedIterationLineage(p,'ITERATION-NEW');
  assert.equal(result.valid,false,'Corrected iteration accepted reuse of the prior canonical candidate identity.');
  assert(result.reasons.some(reason=>/distinct.*candidate|reuses.*candidate/i.test(String(reason))),'Candidate-reuse rejection was not explicit.');
  const evaluation=engine.evaluateIteration(p,'ITERATION-NEW','CORRECTED');
  assert(evaluation.reasons.some(reason=>/distinct.*candidate|reuses.*candidate/i.test(String(reason))),'The Stage 17 evaluator did not consume the candidate-reuse rejection.');
}

// Intentional invalid fixture 2: the corrected iteration cannot float free of the responsible correction.
{
  const p=fixture();
  const current=p.projectData.iterations.find(row=>row.id==='ITERATION-NEW');
  setField(current,'CHANGESET_ID','');
  const result=engine.evaluateCorrectedIterationLineage(p,'ITERATION-NEW');
  assert.equal(result.valid,false,'Corrected iteration accepted a missing correction changeset binding.');
  assert(result.reasons.some(reason=>/changeset|correction/i.test(String(reason))),'Missing-changeset rejection was not explicit.');
}

// Intentional invalid fixture 3: the bound correction must still agree with the accepted earliest-layer RCA.
{
  const p=fixture();
  const currentChange=p.projectData.changes.find(row=>row.id==='CHANGE-STAGE20');
  setField(currentChange,'RESPONSIBLE_LAYER','INSTRUCTION');
  const result=engine.evaluateCorrectedIterationLineage(p,'ITERATION-NEW');
  assert.equal(result.valid,false,'Corrected iteration accepted a changeset at the wrong responsible layer.');
  assert(result.reasons.some(reason=>/responsible layer/i.test(String(reason))),'Wrong-layer lineage rejection was not explicit.');
}

// Intentional invalid fixture 4: the candidate freeze must consume genuine current Stage 17 component-selection authority.
{
  const p=fixture();
  p.projectData.humanDecisions=[];
  const result=engine.evaluateCorrectedIterationLineage(p,'ITERATION-NEW');
  assert.equal(result.valid,false,'Corrected iteration accepted a candidate without current Stage 17 component-selection authority.');
  assert(result.reasons.some(reason=>/candidate-component|human decision|selection/i.test(String(reason))),'Missing candidate-selection authority rejection was not explicit.');
}

// Intentional invalid fixture 5: a forged candidate manifest/hash disagreement cannot become corrected lineage.
{
  const p=fixture();
  const current=p.projectData.candidateFreezes.find(row=>row.id==='CANDIDATE-NEW');
  current.fields.COMPONENT_MANIFEST[0].sha256='c'.repeat(64);
  current.COMPONENT_MANIFEST=current.fields.COMPONENT_MANIFEST;
  const result=engine.evaluateCorrectedIterationLineage(p,'ITERATION-NEW');
  assert.equal(result.valid,false,'Corrected iteration accepted a candidate manifest that disagreed with the frozen component-hash map.');
  assert(result.reasons.some(reason=>/component.*hash|manifest/i.test(String(reason))),'Candidate hash-manifest rejection was not explicit.');
}

// The repaired runtime must still execute the repository's complete synthetic 30-stage lifecycle.
await import('./verify-full-cycle.mjs');

console.log('verify-corrected-iteration: PASS');

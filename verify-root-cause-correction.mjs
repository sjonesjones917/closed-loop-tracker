import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
assert(core&&schema&&engine,'Stage 19 verifier could not load runtime authorities.');

const baseScope={
  inputVersion:'INPUT-v001',
  sourceSetVersion:'SOURCE-SET-v001',
  requirementsVersion:'REQUIREMENTS-v001',
  testSuiteVersion:'TEST-SUITE-v001',
  instructionVersion:'INSTRUCTION-v001'
};

function record(collection,id,stage,fields,relationships={}){
  const definition=schema.RECORD_SCHEMAS[collection];
  assert(definition,`Missing schema for ${collection}.`);
  const all={...fields,[definition.idField]:id};
  const row={id,stage,active:true,scope:{...baseScope},fields:all,...all,relationships:{...relationships}};
  engine.refreshRecordHashes(row,collection);
  return row;
}

function defect(id,summary){
  return record('defects',id,14,{
    OBSERVED_FAILURE:summary,
    EXPECTED_CONDITION:'The controlled workflow must satisfy the governing requirement.',
    EVIDENCE:`Evidence for ${id}`,
    SEVERITY:'MAJOR',
    STATUS:'CONFIRMED'
  });
}
function rca(id,defectId,layer){
  return record('rootCauses',id,14,{
    DEFECT_ID:defectId,
    CATEGORY:layer,
    LAYER_TRACE:`Requirement -> ${layer} -> execution -> observed output`,
    EARLIEST_DEFECTIVE_LAYER:layer,
    ROOT_CAUSE:`Controlled ${layer} root cause for ${defectId}`,
    EVIDENCE:`RCA evidence for ${defectId}`,
    DOWNSTREAM_INVALIDATION:'Stages 15-30'
  },{DEFECT_ID:defectId});
}
function change(id,defectId,layer,{oldVersion='v001',newVersion='v002',instructionChange='UNCHANGED',preflight='NOT REQUIRED'}={}){
  return record('changes',id,16,{
    TRIGGERING_DEFECT_IDS:defectId,
    ROOT_CAUSE_ANALYSIS:`Accepted RCA for ${defectId}`,
    RESPONSIBLE_LAYER:layer,
    OLD_ARTIFACT_VERSION:oldVersion,
    EXACT_MODIFICATION:`Correct the earliest responsible ${layer} layer for ${defectId}.`,
    NEW_ARTIFACT_VERSION:newVersion,
    DOWNSTREAM_INVALIDATION:'Stages 17-30',
    REQUIRED_RERUNS:'Complete corrected ten-run iteration and affected downstream verification.',
    INSTRUCTION_CHANGE_DETERMINATION:instructionChange,
    REQUIRED_REPEATED_PREFLIGHT:preflight,
    JUSTIFIED_UNCHANGED_ARTIFACTS:'Only unaffected controlled artifacts remain unchanged.',
    EVIDENCE:`Correction evidence for ${defectId}`
  });
}

function fixture(){
  const p=core.createBlankState('JOB-STAGE19-ROOT-CAUSE-CORRECTION');
  Object.assign(p.job,{
    JOB_ID:'JOB-STAGE19-ROOT-CAUSE-CORRECTION',
    EXACT_USER_OBJECTIVE_VERBATIM:'Verify fail-closed root-cause correction control.',
    CURRENT_INPUT_VERSION:baseScope.inputVersion,
    CURRENT_SOURCE_SET_VERSION:baseScope.sourceSetVersion,
    CURRENT_REQUIREMENTS_VERSION:baseScope.requirementsVersion,
    CURRENT_TEST_SUITE_VERSION:baseScope.testSuiteVersion,
    CURRENT_INSTRUCTION_VERSION:baseScope.instructionVersion
  });
  engine.ensureShape(p);
  p.stages[15].status='COMPLETE';
  p.stages[15].gate={complete:true,blocked:false,reasons:[]};
  p.projectData.acceptedChanges.push({
    changeId:'ACCEPTED-STAGE16-CORRECT',stage:16,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'CORRECT'
  });
  p.projectData.defects.push(defect('DEFECT-1','Instruction defect'),defect('DEFECT-2','Test defect'));
  p.projectData.rootCauses.push(rca('RCA-1','DEFECT-1','INSTRUCTION'),rca('RCA-2','DEFECT-2','TEST'));
  p.projectData.changes.push(change('CHANGE-1','DEFECT-1','INSTRUCTION',{oldVersion:'instruction-v001',newVersion:'instruction-v002',instructionChange:'CHANGED',preflight:'REQUIRED'}));
  return p;
}

// Intentional invalid fixture 1: one arbitrary changeset must not cover two confirmed RCAs.
{
  const p=fixture();
  const gate=engine.gate(16,p);
  assert.equal(gate.complete,false,'Stage 16 gate falsely completed while DEFECT-2 had no responsible-layer correction.');
  assert(gate.reasons.some(reason=>String(reason).includes('DEFECT-2')),'Missing-defect correction rejection did not identify DEFECT-2.');
}

// Intentional invalid fixture 2: a correction at a downstream/wrong layer must not satisfy the RCA.
{
  const p=fixture();
  p.projectData.changes.push(change('CHANGE-2','DEFECT-2','INSTRUCTION',{oldVersion:'test-v001',newVersion:'test-v002'}));
  const gate=engine.gate(16,p);
  assert.equal(gate.complete,false,'Stage 16 gate accepted a correction whose responsible layer disagreed with the RCA.');
  assert(gate.reasons.some(reason=>/responsible layer/i.test(String(reason))),'Wrong-layer correction rejection was not explicit.');
}

// Intentional invalid fixture 3: an in-place version rewrite is not a new controlled version.
{
  const p=fixture();
  p.projectData.changes.push(change('CHANGE-2','DEFECT-2','TEST',{oldVersion:'test-v001',newVersion:'test-v001'}));
  const gate=engine.gate(16,p);
  assert.equal(gate.complete,false,'Stage 16 gate accepted an in-place correction with unchanged old/new version identity.');
  assert(gate.reasons.some(reason=>/new controlled version|old and new/i.test(String(reason))),'In-place version rejection was not explicit.');
}

// Intentional invalid fixture 4: changing the production instruction requires the specified repeated preflight.
{
  const p=fixture();
  p.projectData.changes[0].fields.REQUIRED_REPEATED_PREFLIGHT='NOT REQUIRED';
  p.projectData.changes[0].REQUIRED_REPEATED_PREFLIGHT='NOT REQUIRED';
  p.projectData.changes.push(change('CHANGE-2','DEFECT-2','TEST',{oldVersion:'test-v001',newVersion:'test-v002'}));
  const gate=engine.gate(16,p);
  assert.equal(gate.complete,false,'Stage 16 gate accepted an instruction change without repeated preflight.');
  assert(gate.reasons.some(reason=>/preflight/i.test(String(reason))),'Missing repeated-preflight rejection was not explicit.');
}

// Intentional invalid fixture 5: an execution-only RCA cannot manufacture an instruction change.
{
  const p=fixture();
  p.projectData.changes.push(change('CHANGE-2','DEFECT-2','TEST',{oldVersion:'test-v001',newVersion:'test-v002'}));
  p.projectData.defects.push(defect('DEFECT-3','Execution-only deviation'));
  p.projectData.rootCauses.push(rca('RCA-3','DEFECT-3','EXECUTION'));
  p.projectData.changes.push(change('CHANGE-3','DEFECT-3','EXECUTION',{oldVersion:'execution-attempt-001',newVersion:'execution-attempt-002',instructionChange:'CHANGED',preflight:'REQUIRED'}));
  const gate=engine.gate(16,p);
  assert.equal(gate.complete,false,'Stage 16 gate changed the instruction for an execution-only root cause.');
  assert(gate.reasons.some(reason=>/execution-only|preserve.*instruction/i.test(String(reason))),'Execution-only instruction-preservation rejection was not explicit.');
}

// Repaired fixture: every confirmed RCA has one valid earliest-layer correction, all changes are versioned,
// the instruction change repeats preflight, and execution-only defects preserve the instruction.
{
  const p=fixture();
  p.projectData.changes.push(change('CHANGE-2','DEFECT-2','TEST',{oldVersion:'test-v001',newVersion:'test-v002'}));
  p.projectData.defects.push(defect('DEFECT-3','Execution-only deviation'));
  p.projectData.rootCauses.push(rca('RCA-3','DEFECT-3','EXECUTION'));
  p.projectData.changes.push(change('CHANGE-3','DEFECT-3','EXECUTION',{oldVersion:'execution-attempt-001',newVersion:'execution-attempt-002',instructionChange:'UNCHANGED',preflight:'NOT REQUIRED'}));
  const gate=engine.gate(16,p);
  assert.equal(gate.complete,true,`Repaired Stage 16 correction did not progress: ${gate.reasons.join('; ')}`);
}

console.log('verify-root-cause-correction: PASS');

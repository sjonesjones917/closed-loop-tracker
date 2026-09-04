import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const assert=(value,message)=>{if(!value)throw new Error(message);};

function record(collection,stage,fields,id,scope={}){
  const definition=schema.RECORD_SCHEMAS[collection];
  const all={...fields,[definition.idField]:id};
  const value={id,stage,active:true,scope:{...scope},fields:all,...all};
  engine.refreshRecordHashes(value,collection);
  return value;
}

function baseFixture(){
  const p=core.createBlankState('JOB-STAGE18-RCA-REGRESSION');
  Object.assign(p.job,{
    EXACT_USER_OBJECTIVE_VERBATIM:'Prove root-cause and permanent-regression closure against a confirmed defect.',
    CURRENT_INPUT_VERSION:'INPUT-v001',
    CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',
    CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',
    CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'
  });
  engine.ensureShape(p);
  for(let stage=1;stage<=13;stage++){
    p.stages[stage].status='COMPLETE';
    p.stages[stage].gate={complete:true,blocked:false,reasons:[]};
  }
  const defect=record('defects',14,{
    STATUS:'CONFIRMED',
    SEVERITY:'MAJOR',
    OBSERVED_FAILURE:'The controlled output violates the governing requirement.',
    EXPECTED_CONDITION:'The controlled output satisfies the governing requirement.',
    EVIDENCE:'Preserved failing observation.',
    PROPOSITION_ID:'PROPOSITION-STAGE18'
  },'DEFECT-STAGE18');
  p.projectData.defects.push(defect);
  const rca=record('rootCauses',14,{
    DEFECT_ID:'DEFECT-STAGE18',
    LAYER_TRACE:['OUTPUT','INSTRUCTION'],
    EARLIEST_DEFECTIVE_LAYER:'INSTRUCTION',
    ROOT_CAUSE:'The production instruction omitted the governing constraint.',
    DOWNSTREAM_INVALIDATION:'Invalidate the candidate and all later run, verification, convergence, and release evidence.',
    EVIDENCE:'The preserved failure and instruction trace establish the earliest defective layer.'
  },'RCA-STAGE18');
  p.projectData.rootCauses.push(rca);
  p.projectData.acceptedChanges.push({changeId:'CHANGE-STAGE18-RCA',stage:14,status:'COMMITTED',responseType:'DATA_PROPOSAL',scope:{}});
  return {p,defect,rca};
}

function addRegression(p,{result='VIOLATED',withExecution=true,withEvidence=true}={}){
  const regression=record('regressions',15,{
    DEFECT_ID:'DEFECT-STAGE18',
    FIXTURE:'Preserved exact failing fixture for DEFECT-STAGE18.',
    REPRODUCTION_PROCEDURE:'Execute the preserved fixture through the controlling validator.',
    DETECTION_METHOD:'The controlling validator must reject the known-invalid state.',
    EXPECTED_FAILURE:'VIOLATED',
    CORRECTION:'Correct the earliest defective instruction layer before rerunning.',
    APPLICABILITY:'ACTIVE until legitimately retired under the registered retirement contract.',
    ACTIVE_RETIRED_STATE:'ACTIVE',
    STATUS:'ACTIVE'
  },'REG-STAGE18');
  p.projectData.regressions.push(regression);
  if(withExecution){
    const execution=record('regressionExecutions',15,{
      REG_ID:'REG-STAGE18',
      PHASE:'PRE_CORRECTION',
      RESULT:result,
      OBSERVATIONS:'Executed the preserved invalid fixture against the controlling mechanism.',
      EXPECTED:'VIOLATED',
      ACTUAL:result,
      STATUS:'COMPLETED'
    },'REG-EXEC-STAGE18-PRE');
    if(withEvidence){
      const evidence=record('evidenceRecords',15,{
        KIND:'EXECUTION_LOG',
        AUTHORITY_TYPE:'APPLICATION',
        DESCRIPTION:'Preserved pre-correction regression execution evidence.',
        CONTENT:`The actual pre-correction result was ${result}.`,
        STATUS:'PRESERVED'
      },'EVIDENCE-STAGE18-PRE');
      p.projectData.evidenceRecords.push(evidence);
      execution.evidenceRefs=[evidence.id];
    }
    p.projectData.regressionExecutions.push(execution);
  }
  p.projectData.acceptedChanges.push({changeId:'CHANGE-STAGE18-REGRESSION',stage:15,status:'COMMITTED',responseType:'DATA_PROPOSAL',scope:{}});
  return regression;
}

{
  const {p}=baseFixture();
  const gate=engine.gate(14,p);
  assert(gate.complete,`Valid RCA did not close Stage 14: ${gate.reasons.join(' | ')}`);
  const derived=engine.deriveStageData(p,14);
  assert(derived.TOTAL_MATERIAL_DEFECTS===1,'Stage 14 did not derive the exact material-defect count.');
  assert(Array.isArray(derived.CONFIRMED_ROOT_CAUSES)&&derived.CONFIRMED_ROOT_CAUSES.includes('DEFECT-STAGE18'),'Stage 14 did not derive the confirmed RCA relationship.');
}

{
  const {p}=baseFixture();
  p.projectData.rootCauses=[];
  const gate=engine.gate(14,p);
  assert(!gate.complete&&gate.reasons.some(reason=>reason.includes('Exactly one complete RCA')||reason.includes('Root-cause analysis is missing')),'Missing RCA did not fail closed.');
}

{
  const {p,rca}=baseFixture();
  const duplicate=JSON.parse(JSON.stringify(rca));
  duplicate.id='RCA-STAGE18-DUPLICATE';
  duplicate.fields.RCA_ID=duplicate.RCA_ID='RCA-STAGE18-DUPLICATE';
  engine.refreshRecordHashes(duplicate,'rootCauses');
  p.projectData.rootCauses.push(duplicate);
  const gate=engine.gate(14,p);
  assert(!gate.complete&&gate.reasons.some(reason=>reason.includes('Exactly one complete RCA')),'Duplicate RCA did not fail closed.');
}

{
  const {p,rca}=baseFixture();
  rca.fields.ROOT_CAUSE=rca.ROOT_CAUSE='';
  engine.refreshRecordHashes(rca,'rootCauses');
  const gate=engine.gate(14,p);
  assert(!gate.complete&&gate.reasons.some(reason=>reason.includes('RCA ROOT_CAUSE is missing')),'Incomplete RCA did not fail closed.');
}

{
  const {p}=baseFixture();
  p.stages[14].status='COMPLETE';
  p.stages[14].gate={complete:true,blocked:false,reasons:[]};
  p.projectData.acceptedChanges.push({changeId:'CHANGE-STAGE18-REGRESSION-EMPTY',stage:15,status:'COMMITTED',responseType:'DATA_PROPOSAL',scope:{}});
  const gate=engine.gate(15,p);
  assert(!gate.complete&&gate.reasons.some(reason=>reason.includes('Permanent regression definitions are missing')),'A confirmed defect without a permanent regression definition did not fail Stage 15.');
}

{
  const {p}=baseFixture();
  p.stages[14].status='COMPLETE';
  p.stages[14].gate={complete:true,blocked:false,reasons:[]};
  addRegression(p,{withExecution:false});
  const gate=engine.gate(15,p);
  assert(!gate.complete&&gate.reasons.some(reason=>reason.includes('lacks an actual sufficiently evidenced pre-correction failing execution')),'Regression definition without pre-correction execution did not fail Stage 15.');
}

{
  const {p}=baseFixture();
  p.stages[14].status='COMPLETE';
  p.stages[14].gate={complete:true,blocked:false,reasons:[]};
  addRegression(p,{result:'SATISFIED'});
  const gate=engine.gate(15,p);
  assert(!gate.complete&&gate.reasons.some(reason=>reason.includes('lacks an actual sufficiently evidenced pre-correction failing execution')),'Pre-correction SATISFIED incorrectly proved failure reproduction.');
}

{
  const {p}=baseFixture();
  p.stages[14].status='COMPLETE';
  p.stages[14].gate={complete:true,blocked:false,reasons:[]};
  addRegression(p,{result:'VIOLATED',withEvidence:false});
  const gate=engine.gate(15,p);
  assert(!gate.complete&&gate.reasons.some(reason=>reason.includes('lacks an actual sufficiently evidenced pre-correction failing execution')),'Pre-correction failure without sufficient evidence incorrectly proved reproduction.');
}

{
  const {p}=baseFixture();
  p.stages[14].status='COMPLETE';
  p.stages[14].gate={complete:true,blocked:false,reasons:[]};
  addRegression(p,{result:'VIOLATED',withEvidence:true});
  const gate=engine.gate(15,p);
  assert(gate.complete,`Actual sufficiently evidenced pre-correction failure did not close Stage 15: ${gate.reasons.join(' | ')}`);
  const derived=engine.deriveStageData(p,15);
  assert(derived.CONFIRMED_DEFECTS===1,'Stage 15 did not derive the exact confirmed-defect count.');
  assert(Array.isArray(derived.CONFIRMED_DEFECTS_WITH_REGRESSION_TEST)&&derived.CONFIRMED_DEFECTS_WITH_REGRESSION_TEST.includes('DEFECT-STAGE18'),'Stage 15 did not derive permanent regression coverage.');
  assert(Array.isArray(derived.PRE_CORRECTION_FAILURES_PROVEN)&&derived.PRE_CORRECTION_FAILURES_PROVEN.includes('DEFECT-STAGE18'),'Stage 15 did not derive actual pre-correction failure reproduction.');
  assert(Array.isArray(derived.UNCONVERTED_CONFIRMED_DEFECTS)&&derived.UNCONVERTED_CONFIRMED_DEFECTS.length===0,'Stage 15 left a converted confirmed defect marked unconverted.');
}

console.log(JSON.stringify({
  controllerStage:'18',
  applicationStages:[14,15],
  rootCauseAndRegression:'PASS',
  missingRcaRejected:true,
  duplicateRcaRejected:true,
  incompleteRcaRejected:true,
  missingRegressionRejected:true,
  unexecutedRegressionRejected:true,
  preCorrectionSatisfiedDoesNotProveFailure:true,
  insufficientEvidenceRejected:true,
  actualPreCorrectionViolationWithEvidenceProvesReproduction:true,
  isolatedDisposableProject:true
}));

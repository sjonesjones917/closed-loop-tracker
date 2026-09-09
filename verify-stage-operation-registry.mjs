import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const schema=globalThis.closedLoopWorkflowSchema;
assert.ok(schema,'workflow-schema.js did not load.');

// Permanent regression: closed stage-operation membership and exact initial EXECUTE_RUN semantics must remain aligned.
const expected=Object.freeze({
  1:['COMPLETE','SEMANTIC_CHALLENGE','RECONCILE_INTAKE'],
  2:['COMPLETE','SEARCH_ADEQUACY_REVIEW','RECONCILE_SOURCE_SEARCH'],
  3:['COMPLETE','SEMANTIC_CHALLENGE','RECONCILE_RESEARCH'],
  4:['COMPLETE','DISPOSITION_CHALLENGE','ATOMICITY_CHALLENGE','RECONCILE_REQUIREMENTS'],
  5:['COMPLETE','SEMANTIC_REVIEW','RECONCILE_REQUIREMENT_SET'],
  6:['COMPLETE','PROOF_REVIEW','RECONCILE_VERIFICATION_SUITE'],
  7:['COMPLETE','EXECUTE_FAILURE_TEST'],
  8:['COMPLETE'],
  9:['COMPLETE'],
  10:['FREEZE'],
  11:['EXECUTE_RUN'],
  12:['VERIFY'],
  13:['COMPARE'],
  14:['ROOT_CAUSE'],
  15:['COMPLETE','EXECUTE_REGRESSION'],
  16:['CORRECT'],
  17:['FREEZE','EXECUTE_RUN','VERIFY','COMPARE','ROOT_CAUSE','REGRESSION','CORRECT'],
  18:['COMPLETE'],
  19:['CONFIRM_FREEZE','EXECUTE_RUN','VERIFY','COMPARE','REGRESSION_VERIFY','CONFIRM'],
  20:['FREEZE_BASELINE'],
  21:['COMPLETE'],
  22:['RUN_NATIVE_TESTS','EXECUTE_EXTERNAL_TEST'],
  23:['COMPLETE'],
  24:['RUN_NATIVE_ATTACKS','COMPLETE'],
  25:['FREEZE_DELIVERY_CANDIDATE','COMPLETE'],
  26:['COMPLETE','SEMANTIC_REVIEW','RECONCILE'],
  27:['CALCULATE_RELEASE','ADVISORY_REVIEW'],
  28:['VERIFY_IDENTITY','CAPTURE_DELIVERY_INTENT'],
  29:['CALCULATE_EVIDENCE_CHAINS','INVESTIGATE_MISSING_EVIDENCE'],
  30:['CALCULATE_TERMINAL','EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','RECORD_DELIVERY_EVIDENCE']
});

assert.deepEqual(schema.STAGE_OPERATIONS,expected,'Stage-operation set is not the closed controlling set.');
for(let stage=1;stage<=30;stage++){
  assert.deepEqual(schema.STAGE_CONTRACTS[stage].operations,expected[stage],`Stage ${stage} contract operations drifted.`);
  for(const operation of expected[stage])assert.ok(schema.operationContract(stage,operation),`Missing operation contract for Stage ${stage} ${operation}.`);
}
for(const [stage,invalid] of [[10,'COMPLETE'],[11,'COMPLETE'],[12,'COMPLETE'],[22,'COMPLETE'],[27,'COMPLETE'],[30,'COMPLETE']])assert.equal(schema.operationContract(stage,invalid),null,`Stage ${stage} illegally accepts ${invalid}.`);

// Controlling-spec executor boundary: these operations are application/human/operator actions and must never
// produce an external-agent prompt. Every other closed operation is external-agent work.
const nonExternal=Object.freeze({
  '10:FREEZE':'APPLICATION',
  '17:FREEZE':'APPLICATION',
  '18:COMPLETE':'APPLICATION',
  '19:CONFIRM_FREEZE':'APPLICATION',
  '19:CONFIRM':'APPLICATION',
  '20:FREEZE_BASELINE':'APPLICATION',
  '22:RUN_NATIVE_TESTS':'APPLICATION',
  '24:RUN_NATIVE_ATTACKS':'APPLICATION',
  '25:FREEZE_DELIVERY_CANDIDATE':'APPLICATION',
  '27:CALCULATE_RELEASE':'APPLICATION',
  '28:VERIFY_IDENTITY':'APPLICATION',
  '28:CAPTURE_DELIVERY_INTENT':'HUMAN_DECISION',
  '29:CALCULATE_EVIDENCE_CHAINS':'APPLICATION',
  '30:CALCULATE_TERMINAL':'APPLICATION',
  '30:EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS':'OPERATOR_ACTION',
  '30:RECORD_DELIVERY_EVIDENCE':'OPERATOR_ACTION'
});
let externalOperations=0;
for(let stage=1;stage<=30;stage++)for(const operation of expected[stage]){
  const key=`${stage}:${operation}`,registration=schema.STAGE_OPERATION_REGISTRY[key];
  assert.ok(registration,`Missing executor registration for ${key}.`);
  const expectedExecutor=nonExternal[key]||'EXTERNAL_AGENT';
  assert.equal(registration.executorClass,expectedExecutor,`${key} executor drifted from the controlling operation boundary.`);
  if(expectedExecutor==='EXTERNAL_AGENT')externalOperations++;
}

console.log(JSON.stringify({stageOperationRegistry:'PASS',stages:30,operations:Object.values(expected).reduce((n,v)=>n+v.length,0),externalOperations,nonExternalOperations:Object.keys(nonExternal).length},null,2));

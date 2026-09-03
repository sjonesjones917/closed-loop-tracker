import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const schema=globalThis.closedLoopWorkflowSchema;
assert.ok(schema,'workflow-schema.js did not load.');

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

console.log(JSON.stringify({stageOperationRegistry:'PASS',stages:30,operations:Object.values(expected).reduce((n,v)=>n+v.length,0)},null,2));

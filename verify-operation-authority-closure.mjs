import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('./workflow-schema.js',import.meta.url),'utf8');

export function assertOperationAuthoritySourceClosure(schemaSource=source){
  assert.match(schemaSource,/STAGE_OPERATION_REGISTRY/,'workflow-schema.js must expose the closed STAGE_OPERATION_REGISTRY');
  assert.match(schemaSource,/STAGE_OPERATION_SCOPE_MATRIX/,'workflow-schema.js must expose the closed STAGE_OPERATION_SCOPE_MATRIX');
  assert.match(schemaSource,/APPLICATION_COMMAND_KEYS/,'application command operations must be explicitly classified');
  assert.match(schemaSource,/OPERATOR_ACTION_KEYS/,'operator transport/delivery actions must be explicitly classified');
  assert.match(schemaSource,/HUMAN_DECISION_OPERATION_KEYS/,'human-decision operations must be explicitly classified');
  assert.match(schemaSource,/agentWritableCollections\s*:\s*Object\.freeze\(\[\]\)/,'non-agent operations must expose an empty agent-writable collection set');
  assert.match(schemaSource,/responseEnvelopeAllowed\s*:\s*false/,'non-agent operations must reject external response envelopes by contract');
}

assertOperationAuthoritySourceClosure();

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js']){
  vm.runInThisContext(fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8'),{filename:file});
}
const schema=globalThis.closedLoopWorkflowSchema;
assert.ok(schema,'workflow schema runtime must load');
assert.ok(schema.STAGE_OPERATION_REGISTRY,'runtime STAGE_OPERATION_REGISTRY is missing');
assert.ok(schema.STAGE_OPERATION_SCOPE_MATRIX,'runtime STAGE_OPERATION_SCOPE_MATRIX is missing');

const operationKeys=[];
for(const [stage,operations] of Object.entries(schema.STAGE_OPERATIONS)){
  for(const operation of operations)operationKeys.push(`${Number(stage)}:${operation}`);
}
assert.equal(operationKeys.length,66,'the closed workflow must expose exactly 66 stage-operation combinations');
assert.deepEqual([...Object.keys(schema.STAGE_OPERATION_REGISTRY)].sort(),[...operationKeys].sort(),'the runtime operation registry must cover the exact closed operation universe');
assert.deepEqual([...Object.keys(schema.STAGE_OPERATION_SCOPE_MATRIX)].sort(),[...operationKeys].sort(),'the runtime scope matrix must cover the exact closed operation universe');

const applicationCommands=new Set(schema.APPLICATION_COMMAND_KEYS||[]);
const routedExecutions=new Set(schema.ROUTED_EXECUTION_KEYS||[]);
const humanDecisionOperations=new Set(schema.HUMAN_DECISION_OPERATION_KEYS||[]);
const operatorActions=new Set(schema.OPERATOR_ACTION_KEYS||[]);

for(const key of operationKeys){
  const [stageText,...operationParts]=key.split(':');
  const stage=Number(stageText),operation=operationParts.join(':');
  const contract=schema.operationContract(stage,operation);
  assert.ok(contract,`operationContract(${key}) must resolve`);
  assert.strictEqual(contract,schema.STAGE_OPERATION_REGISTRY[key],`${key} must resolve to the authoritative registry entry`);
  assert.ok(Array.isArray(contract.agentWritableCollections),`${key} must publish an explicit agent-writable collection set`);

  if(applicationCommands.has(key)){
    assert.equal(contract.executorClass,'APPLICATION',`${key} must execute as an application command`);
    assert.equal(contract.responseEnvelopeAllowed,false,`${key} must reject external response envelopes`);
    assert.equal(contract.acceptanceMode,'DIRECT_APPLICATION_COMMIT',`${key} must commit through the application command path`);
    assert.deepEqual([...contract.agentWritableCollections],[],`${key} must expose no agent-writable canonical collections`);
  }else if(humanDecisionOperations.has(key)){
    assert.equal(contract.executorClass,'HUMAN_DECISION',`${key} must execute as human-decision authority`);
    assert.equal(contract.responseEnvelopeAllowed,false,`${key} must reject external response envelopes`);
    assert.equal(contract.acceptanceMode,'HUMAN_DECISION_COMMAND',`${key} must use the human-decision command path`);
    assert.deepEqual([...contract.agentWritableCollections],[],`${key} must expose no agent-writable canonical collections`);
  }else if(operatorActions.has(key)){
    assert.equal(contract.executorClass,'OPERATOR',`${key} must be an operator transport/delivery action`);
    assert.equal(contract.responseEnvelopeAllowed,false,`${key} must reject external response envelopes`);
    assert.equal(contract.acceptanceMode,'OPERATOR_ACTION',`${key} must use the operator-action path`);
    assert.deepEqual([...contract.agentWritableCollections],[],`${key} must expose no agent-writable canonical collections`);
  }else if(routedExecutions.has(key)){
    assert.equal(contract.executorClass,'ROUTED_APPLICATION_OR_EXTERNAL_AGENT',`${key} must preserve the registered dual execution route`);
    assert.equal(contract.responseEnvelopeAllowed,'ROUTE_DEPENDENT',`${key} response-envelope permission must depend on the selected route`);
    assert.equal(contract.acceptanceMode,'ROUTE_DEPENDENT',`${key} acceptance mode must depend on the selected route`);
  }else{
    assert.equal(contract.executorClass,'EXTERNAL_AGENT',`${key} must be classified as an external-agent operation`);
    assert.equal(contract.responseEnvelopeAllowed,true,`${key} must permit its authoritative external response envelope`);
  }
}

for(const key of [
  '10:FREEZE','17:FREEZE','18:COMPLETE','19:CONFIRM_FREEZE','19:CONFIRM','20:FREEZE_BASELINE',
  '22:RUN_NATIVE_TESTS','24:RUN_NATIVE_ATTACKS','25:FREEZE_DELIVERY_CANDIDATE',
  '27:CALCULATE_RELEASE','28:VERIFY_IDENTITY','29:CALCULATE_EVIDENCE_CHAINS','30:CALCULATE_TERMINAL'
])assert.ok(applicationCommands.has(key),`${key} must be explicitly classified as an application command`);
assert.ok(humanDecisionOperations.has('28:CAPTURE_DELIVERY_INTENT'),'Stage 28 delivery intent must be explicit human-decision authority');
for(const key of ['30:EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','30:RECORD_DELIVERY_EVIDENCE'])assert.ok(operatorActions.has(key),`${key} must be an explicit operator action`);

const advisory=schema.operationContract(27,'ADVISORY_REVIEW');
assert.equal(advisory.executorClass,'EXTERNAL_AGENT');
assert.deepEqual([...advisory.agentWritableCollections],['releaseGateReviews'],'Stage 27 advisory review must write only releaseGateReviews');
const calculateRelease=schema.operationContract(27,'CALCULATE_RELEASE');
assert.deepEqual([...calculateRelease.agentWritableCollections],[],'Stage 27 release calculation must not expose release records or reviews to the agent');

assert.throws(()=>assertOperationAuthoritySourceClosure(source.replaceAll('agentWritableCollections:Object.freeze([])','agentWritableCollections:Object.freeze([\'releaseGateReviews\'])')),/empty agent-writable/,'mutation granting a non-agent operation an agent write surface must fail');
assert.throws(()=>assertOperationAuthoritySourceClosure(source.replaceAll('responseEnvelopeAllowed:false','responseEnvelopeAllowed:true')),/reject external response envelopes/,'mutation allowing an external response envelope for a non-agent operation must fail');

console.log(JSON.stringify({verifyOperationAuthorityClosure:'PASS',operations:operationKeys.length,runtimeRegistry:true,nonAgentAuthorityClosed:true}));

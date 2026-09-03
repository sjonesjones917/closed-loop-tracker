import fs from 'node:fs';
import assert from 'node:assert/strict';

const schema=fs.readFileSync(new URL('./workflow-schema.js',import.meta.url),'utf8');

export function assertOperationAuthorityClosure(source=schema){
  assert.match(source,/STAGE_OPERATION_REGISTRY/,'workflow-schema.js must expose the closed STAGE_OPERATION_REGISTRY');
  assert.match(source,/STAGE_OPERATION_SCOPE_MATRIX/,'workflow-schema.js must expose the closed STAGE_OPERATION_SCOPE_MATRIX');
  assert.match(source,/APPLICATION_COMMAND_KEYS/,'application command operations must be explicitly classified');
  assert.match(source,/OPERATOR_ACTION_KEYS/,'operator transport/delivery actions must be explicitly classified');
  assert.match(source,/HUMAN_DECISION_OPERATION_KEYS/,'human-decision operations must be explicitly classified');
  assert.match(source,/agentWritableCollections\s*:\s*Object\.freeze\(\[\]\)/,'non-agent operations must expose an empty agent-writable collection set');
  assert.match(source,/acceptanceMode\s*:\s*'DIRECT_APPLICATION_COMMIT'/,'application commands must bypass proposal acceptance');
  assert.match(source,/acceptanceMode\s*:\s*'OPERATOR_ACTION'/,'operator actions must be modeled as transport actions, not agent proposals');
  assert.match(source,/acceptanceMode\s*:\s*'HUMAN_DECISION_COMMAND'/,'human-decision operations must be modeled as human authority, not agent proposals');
  assert.match(source,/responseEnvelopeAllowed\s*:\s*false/,'non-agent operations must reject external response envelopes by contract');

  const prohibited=[
    '10:FREEZE','18:COMPLETE','19:CONFIRM_FREEZE','19:CONFIRM','20:FREEZE_BASELINE',
    '22:RUN_NATIVE_TESTS','24:RUN_NATIVE_ATTACKS','25:FREEZE_DELIVERY_CANDIDATE',
    '27:CALCULATE_RELEASE','28:VERIFY_IDENTITY','29:CALCULATE_EVIDENCE_CHAINS','30:CALCULATE_TERMINAL'
  ];
  for(const key of prohibited)assert.match(source,new RegExp(`['\"]${key.replace(':','\\:')}['\"]`),`missing explicit application-command classification for ${key}`);
  for(const key of ['30:EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','30:RECORD_DELIVERY_EVIDENCE'])assert.match(source,new RegExp(`['\"]${key.replace(':','\\:')}['\"]`),`missing explicit operator-action classification for ${key}`);
  assert.match(source,/['\"]28:CAPTURE_DELIVERY_INTENT['\"]/,'Stage 28 delivery intent must be explicit human-decision authority');
}

assertOperationAuthorityClosure();
assert.throws(()=>assertOperationAuthorityClosure(schema.replaceAll('agentWritableCollections:Object.freeze([])','agentWritableCollections:Object.freeze([\'releaseGateReviews\'])')),/empty agent-writable/,'mutation granting an application command an agent write surface must fail');
assert.throws(()=>assertOperationAuthorityClosure(schema.replaceAll("responseEnvelopeAllowed:false","responseEnvelopeAllowed:true")),/reject external response envelopes/,'mutation allowing an external response envelope for a non-agent operation must fail');

console.log(JSON.stringify({verifyOperationAuthorityClosure:'PASS'}));

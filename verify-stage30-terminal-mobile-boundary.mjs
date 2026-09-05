import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const context={console,TextEncoder,TextDecoder,URL,URLSearchParams,crypto:webcrypto,dispatchEvent(){},Event:class Event{constructor(type){this.type=type}}};
context.globalThis=context;
vm.createContext(context);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}
const core=context.closedLoopCore;
const engine=context.closedLoopWorkflowEngine;
const schema=context.closedLoopWorkflowSchema;

assert.equal(schema.operationContract(30,'CALCULATE_TERMINAL')?.executorClass,'APPLICATION','Stage 30 terminal calculation must remain application-owned.');
assert.equal(schema.operationContract(30,'EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS')?.executorClass,'OPERATOR_ACTION','Stage 30 export/share must remain an operator action.');
assert.equal(schema.operationContract(30,'RECORD_DELIVERY_EVIDENCE')?.executorClass,'OPERATOR_ACTION','Stage 30 delivery evidence must remain an operator action.');

const project=core.createBlankState('STAGE30-NEGATIVE');
engine.ensureShape(project);
project.activeStage=30;
const action=engine.operationalNextAction(project,30);
assert.notEqual(action.actionType,'SELECT_RESPONSE_JSON_FILE','Stage 30 must never fall through to the external response.json path.');
assert.ok(['CALCULATE_TERMINAL','BLOCKED','EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','RECORD_DELIVERY_EVIDENCE'].includes(action.actionType),`Unexpected Stage 30 operator action ${action.actionType}.`);
assert.equal(typeof engine.recordDeliveryAttempt,'function','Stage 30 must expose an application-owned delivery-attempt recorder.');
assert.equal(typeof engine.recordDeliveryEvidence,'function','Stage 30 must expose delivery-evidence normalization separately from authorization.');

console.log(JSON.stringify({
  stage30TerminalMobileBoundary:'PASS',
  externalResponseFallthroughRejected:true,
  terminalCalculationApplicationOwned:true,
  authorizedExportOperatorAction:true,
  deliveryAttemptDistinct:true,
  deliveryEvidenceDistinct:true
},null,2));

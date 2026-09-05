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
const engineSource=fs.readFileSync('workflow-engine.js','utf8');
const appSource=fs.readFileSync('app-core.js','utf8');

assert.equal(schema.operationContract(30,'CALCULATE_TERMINAL')?.executorClass,'APPLICATION','Stage 30 terminal calculation must remain application-owned.');
assert.equal(schema.operationContract(30,'CALCULATE_TERMINAL')?.acceptsExternalResponse,false,'CALCULATE_TERMINAL must not accept an external response envelope.');
assert.equal(schema.operationContract(30,'EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS')?.executorClass,'OPERATOR_ACTION','Stage 30 export/share must remain an operator action.');
assert.equal(schema.operationContract(30,'RECORD_DELIVERY_EVIDENCE')?.executorClass,'OPERATOR_ACTION','Stage 30 delivery evidence must remain an operator action.');

const project=core.createBlankState('STAGE30-NEGATIVE');
engine.ensureShape(project);
project.activeStage=30;
const action=engine.operationalNextAction(project,30);
assert.notEqual(action.actionType,'SELECT_RESPONSE_JSON_FILE','Stage 30 must never fall through to the external response.json path.');
assert.equal(action.actionType,'BLOCKED','An incomplete Stage 30 must expose its terminal blockers rather than fabricate authorization.');
assert.equal(typeof engine.calculateTerminal,'function','Stage 30 must expose the application-owned terminal command.');
assert.equal(typeof engine.recordDeliveryAttempt,'function','Stage 30 must expose an application-owned delivery-attempt recorder.');
assert.equal(typeof engine.recordDeliveryEvidence,'function','Stage 30 must expose delivery-evidence normalization separately from authorization.');

const first=engine.calculateTerminal(project,{expectedRevision:Number(project.revision||0)});
assert.equal(engine.recordValue(first,'DELIVERY_STATE'),'BLOCKED','CALCULATE_TERMINAL must create a BLOCKED determination when prerequisites are false.');
assert.equal(engine.records(project,'deliveryRecords').length,1,'A blocked terminal command must create exactly one terminal determination.');
const retry=engine.calculateTerminal(project,{expectedRevision:Number(project.revision||0)});
assert.equal(engine.recordId(retry,'deliveryRecords'),engine.recordId(first,'deliveryRecords'),'Exact CALCULATE_TERMINAL retry must be idempotent.');
assert.equal(engine.records(project,'deliveryRecords').length,1,'Exact terminal retry must not duplicate the terminal record.');
assert.throws(()=>engine.recordDeliveryAttempt(project,{deliveryId:engine.recordId(first,'deliveryRecords')}),/AUTHORIZED Stage 30 delivery record/,'A BLOCKED terminal record must never authorize export/share.');
assert.throws(()=>engine.recordDeliveryEvidence(project,{attemptId:'DELIVERY-ATTEMPT-NONE',evidenceIds:['EVIDENCE-NONE']}),/delivery-attempt record/,'Delivery completion evidence requires a real prior delivery attempt.');

assert.doesNotMatch(engineSource,/if\(e0\.gate\(30,p\)\.complete&&t\.complete\)\{const d=delivery\(p\)/,'Ordinary recalculation must not silently execute CALCULATE_TERMINAL.');
for(const token of ['CALCULATE_TERMINAL','EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','RECORD_DELIVERY_EVIDENCE','calculateTerminal','recordDeliveryAttempt','recordDeliveryEvidence'])assert.match(engineSource,new RegExp(token),`Stage 30 engine contract missing ${token}.`);
for(const token of ['calculate-stage30-terminal','export-authorized-artifacts','record-delivery-evidence','exportAuthorizedArtifacts','recordCurrentDeliveryEvidence'])assert.match(appSource,new RegExp(token),`Stage 30 visible operator path missing ${token}.`);
assert.match(appSource,/downloadCanonicalArtifact\(artifactId\)/,'Authorized export/share must reuse exact canonical stored-byte verification before transfer.');

console.log(JSON.stringify({
  stage30TerminalMobileBoundary:'PASS',
  intentionalInvalidFixturesRejected:[
    'external-response-fallthrough',
    'blocked-terminal-authorizes-export',
    'delivery-evidence-without-attempt',
    'automatic-terminal-side-effect'
  ],
  blockedTerminalRecorded:true,
  terminalRetryIdempotent:true,
  terminalCalculationApplicationOwned:true,
  authorizedExportOperatorAction:true,
  deliveryAttemptDistinct:true,
  deliveryEvidenceDistinct:true,
  visibleOperatorPathWired:true
},null,2));

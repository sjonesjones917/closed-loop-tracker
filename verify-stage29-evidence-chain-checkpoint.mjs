import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js']){
  vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
}
const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
assert(core&&schema&&engine,'Stage 29 verifier requires production runtime modules.');
assert.equal(schema.operationContract(29,'CALCULATE_EVIDENCE_CHAINS')?.executorClass,'APPLICATION','Stage 29 calculation must remain application-owned.');
assert.equal(schema.operationContract(29,'CALCULATE_EVIDENCE_CHAINS')?.retryRule,'IDEMPOTENT_COMMAND','Stage 29 calculation must use the closed idempotent command contract.');
assert.equal(typeof engine.calculateEvidenceChains,'function','Production runtime must expose the Stage 29 CALCULATE_EVIDENCE_CHAINS application command rather than direct collection mutation.');
assert.equal(typeof engine.createPreDeliveryCheckpoint,'function','Production runtime must expose a real pre-delivery checkpoint creation path.');
assert.equal(typeof engine.recordPreDeliveryCheckpointExport,'function','Production runtime must record the real backup export custody transition instead of accepting manually fabricated checkpoint records.');
console.log(JSON.stringify({stage29ApplicationCommand:true,preDeliveryCheckpointProductionPath:true}));

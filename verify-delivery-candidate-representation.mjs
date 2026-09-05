import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const engine=globalThis.closedLoopWorkflowEngine;
assert(engine,'workflow engine did not load');
assert.equal(typeof engine.freezeDeliveryCandidate,'function','Stage 25 FREEZE_DELIVERY_CANDIDATE must be implemented by the application workflow engine.');
assert.equal(typeof engine.deliveryCandidateClosure,'function','Stage 25 must expose application-derived delivery-candidate representation closure.');

console.log(JSON.stringify({deliveryCandidateRepresentation:'PASS'}));

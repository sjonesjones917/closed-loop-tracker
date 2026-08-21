import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const C = require('./app-core.js');

const result = await C.runVerificationJob();
const p = result.project;
assert.equal(C.STAGES.length, 31, 'workflow must contain exactly the 31 user-specified stages');
assert.equal(result.trace.length, 31, 'E2E must execute every stage through the same completion function used by the app');
assert.equal(p.stages.length, 31);
for (let i = 0; i < 31; i++) {
  assert.equal(p.stages[i].status, 'COMPLETE', `stage ${i + 1} must be COMPLETE`);
  assert.ok(p.stages[i].agentResponse.length >= 80, `stage ${i + 1} must contain stored response work`);
}
assert.equal(C.completionPercent(p), 100);
assert.equal(p.releaseState, 'ACCEPTED');
assert.equal(p.finalArtifact, 'A=3\nB=4\nC=5\nTOTAL=12\n');
assert.ok(p.auditedHash.length === 64);
assert.equal(p.auditedHash, p.releaseHash);
assert.equal(C.canRelease(p), true);

const blank = C.createProject({name:'Blank Gate Test', objective:'Prove empty response cannot pass', deliverable:'No release'});
assert.throws(() => C.completeStage(blank, 1, ''), /Agent response is required/);
assert.equal(blank.stages[0].status, 'NOT_STARTED');
assert.throws(() => C.completeStage(blank, 2, 'This response is deliberately much longer than eighty characters, but Stage 1 was never completed and therefore Stage 2 must remain inaccessible.'), /Stage 1 must be COMPLETE/);
assert.equal(blank.stages[1].status, 'NOT_STARTED');

console.log(JSON.stringify({
  status:'PASS',
  jobId:p.jobId,
  stagesCompleted:p.stages.filter(s=>s.status==='COMPLETE').length,
  storedResponses:p.stages.filter(s=>s.agentResponse.length>=80).length,
  artifact:p.finalArtifact,
  auditedHash:p.auditedHash,
  releaseHash:p.releaseHash,
  releaseGate:C.canRelease(p),
  negativeTests:['empty response rejected','stage skipping rejected']
}, null, 2));
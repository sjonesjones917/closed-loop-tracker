import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const C = require('./app-core.js');

const result = C.runRealE2EJob();
const p = result.project;
assert.equal(result.executed.length, 30, 'must execute all 30 stages');
assert.equal(p.stages.length, 30, 'project must contain 30 stages');
for (let i = 0; i < 30; i++) {
  assert.equal(p.stages[i].status, 'COMPLETE', `stage ${i+1} must be COMPLETE`);
  assert.ok(p.stages[i].agentResponse.length >= 20, `stage ${i+1} must contain a real stored agent response`);
}
assert.equal(C.completionPercent(p), 100);
assert.equal(p.releaseState, 'ACCEPTED');
assert.equal(p.finalArtifact, 'A=3\nB=4\nC=5\nTOTAL=12\n');
assert.equal(C.canRelease(p), true);

const blank = C.createProject({name:'Blank Gate Test', objective:'Prove empty response cannot pass', deliverable:'No release'});
assert.throws(() => C.completeStage(blank, 1, ''), /Agent response is required/);
assert.equal(blank.stages[0].status, 'NOT_STARTED');
assert.throws(() => C.completeStage(blank, 2, 'This is deliberately long enough but stage one was never completed.'), /Stage 1 must be COMPLETE/);

console.log(JSON.stringify({
  status:'PASS',
  jobId:p.jobId,
  stagesCompleted:p.stages.filter(s=>s.status==='COMPLETE').length,
  storedAgentResponses:p.stages.filter(s=>s.agentResponse.length>=20).length,
  artifact:p.finalArtifact,
  releaseGate:C.canRelease(p),
  negativeTests:['empty response rejected','stage skipping rejected']
}, null, 2));

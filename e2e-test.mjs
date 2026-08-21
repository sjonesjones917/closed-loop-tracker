import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const C = require('./app-core.js');

assert.equal(C.STAGES.length, 31, 'the user-specified workflow contains exactly 31 operations');

const live = C.makeRealTestProject();
assert.equal(live.stages.length, 31);
assert.equal(C.completionPercent(live), 0, 'real E2E project must start uncompleted');
assert.ok(live.stages.every(s => s.status === 'NOT_STARTED'));
assert.ok(live.stages.every(s => s.agentResponse === ''), 'real E2E project must not contain fabricated agent responses');

const prompt1 = C.buildPrompt(live, 1);
assert.match(prompt1, /STAGE 1 OF 31 — DEFINE JOB/);
assert.match(prompt1, /Execute the job-definition operation now/i);
assert.match(prompt1, /Return the completed JOB RECORD and INPUT-v001/i);
assert.doesNotMatch(prompt1, /CURRENT STAGE OBJECTIVE/);

assert.throws(
  () => C.completeStage(live, 1, ''),
  /Agent response is required/,
  'blank response must never complete a stage'
);
assert.throws(
  () => C.completeStage(live, 1, 'short'),
  /too short/,
  'short placeholder response must never complete a stage'
);
assert.throws(
  () => C.completeStage(live, 2, 'SOURCE_ID: SRC-0001 SOURCE_ROLE: MANDATORY '.repeat(6)),
  /Stage 1 must be COMPLETE/,
  'stage skipping must be impossible'
);

const gate = C.runCoreRegression();
assert.equal(gate.passed, true);
assert.equal(gate.stageCount, 31);

console.log(JSON.stringify({
  status: 'PASS',
  testType: 'state-machine regression (not represented as a completed E2E workflow)',
  workflowOperations: C.STAGES.length,
  realE2EProjectStartsComplete: C.completionPercent(live),
  fabricatedResponsesInRealE2EProject: live.stages.filter(s => s.agentResponse).length,
  negativeTests: ['blank response rejected', 'short response rejected', 'stage skipping rejected'],
  stage1PromptPerformsConcreteOperations: true
}, null, 2));

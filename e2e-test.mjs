import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const C = require('./app-core.js');

assert.equal(C.STAGES.length, 31, 'workflow must contain exactly 31 operations');
const project = C.makeRealTestProject();
assert.equal(C.completionPercent(project), 0, 'proof job must begin at 0/31');
assert.ok(project.stages.every(s => s.status === 'NOT_STARTED'));
assert.ok(project.stages.every(s => s.agentResponse === ''));

const artifact = 'A=3\nB=4\nC=5\nTOTAL=12\n';
const expectedHash = '51368207f534cfb908522b1fb6451bf26c701c8c9dca2b11da75a8012c38c353';
const pad = s => s + ' Evidence is retained in this proof job and the result is concrete, reproducible, traceable, and specific to the inventory-reconciliation deliverable.';
const runs = label => Array.from({length:10},(_,i)=>`RUN-${String(i+1).padStart(3,'0')}: ${label}; independently produced A=3, B=4, C=5, TOTAL=12 and retained requirement evidence.`).join(' ');
const responses = {
  1: pad('JOB_ID: APP-SUPPLIED. EXACT USER OBJECTIVE: reconcile authoritative inventory values and release only the verified artifact. EXACT DELIVERABLE REQUESTED: inventory-reconciliation.txt with A=3, B=4, C=5, TOTAL=12 on four UTF-8 lines. INPUT-v001 records the supplied values, arithmetic rule, exact format, and no-skipping constraint. Assumptions: none.'),
  2: pad('SOURCE_ID: SRC-0001. Title: authoritative user inventory data and artifact contract. SOURCE_ROLE: MANDATORY. Authority: USER. Relevant content: A=3, B=4, C=5, TOTAL=A+B+C, exact UTF-8 four-line output. Conflicts: none. No external research is required.'),
  3: pad('REQUIREMENT research completed from SOURCE SRC-0001. Requirements: preserve A=3, B=4, C=5; compute TOTAL=12; emit exactly four UTF-8 lines in required order; perform all workflow gates; release only bytes whose hash matches the audited bytes. Coverage found no additional requirement category.'),
  4: pad('REQ-001 preserve A=3; REQ-002 preserve B=4; REQ-003 preserve C=5; REQ-004 compute TOTAL=12; REQ-005 exact four-line UTF-8 representation; REQ-006 release only audited identical bytes. VERIFICATION uses exact computation, byte comparison, and SHA-256.'),
  5: pad('CONFLICT review completed. No duplicates, contradictions, circular dependencies, unsupported obligations, or authoritative conflicts were found. All six requirements are RESOLVED. No mandatory blocker or unknown remains.'),
  6: pad('TEST-001 through TEST-006 cover REQ-001 through REQ-006 using exact line comparison, exact integer addition, exact byte comparison, and SHA-256 equality. Mandatory requirement test coverage: 100%. Each test has affirmative evidence and an explicit failure condition.'),
  7: pad('MUTATION tests executed: change A to 8, remove B, change C, make TOTAL=13, reorder or add a fifth line, and alter one released byte. Every constructed mutation was detected and caused REJECT behavior. No validator accepted a violating mutation.'),
  8: pad('INSTRUCTION-v001: using only INPUT-v001, produce the four exact lines A=3, B=4, C=5, TOTAL=12; calculate 3+4+5=12; preserve order and newline representation; validate exact bytes; hash the finished artifact; independently verify all requirements; release only if all gates pass.'),
  9: pad('PREFLIGHT completed against INSTRUCTION-v001. No undefined object, ambiguous arithmetic rule, missing input, unavailable capability, contradictory command, or unclear failure behavior remains. No material correction was required, so the approved version remains INSTRUCTION-v001.'),
 10: pad('CANDIDATE-v001 frozen with INPUT-v001, SRC-0001, REQ-001..REQ-006, TEST-001..TEST-006, mutation tests, and INSTRUCTION-v001. Any material change requires a new candidate version and invalidates dependent verification evidence.'),
 11: runs('frozen-candidate execution completed'),
 12: pad('RUN-001 through RUN-010 were checked against every mandatory REQ-001 through REQ-006. Each verification-matrix cell is SATISFIED: source values preserved, TOTAL=12, exact four-line representation produced, and release identity condition retained. Mandatory verification coverage is 60 of 60 cells.'),
 13: pad('RUN-001 through RUN-010 comparison completed. VARIANCE: zero correctness-affecting variance. Textual metadata differences are irrelevant. All ten runs converge on identical required artifact bytes and identical requirement outcomes.'),
 14: pad('DEFECT review and ROOT-cause analysis completed. Confirmed critical defects: none. Confirmed major defects: none. No source, research, requirement, test, instruction, input, execution, tool, or audit defect was observed in the ten-run batch.'),
 15: pad('REGRESSION suite reviewed against the DEFECT registry. There is no confirmed defect requiring a new reproducer. Permanent mutation regressions remain: wrong A/B/C, wrong total, wrong line count/order, and altered release bytes must all fail.'),
 16: pad('No responsible-layer correction was required because no confirmed defect exists. Existing REGRESSION tests were re-run and PASS: wrong source values, arithmetic error, formatting mutation, and byte mutation are rejected. No upstream artifact changed.'),
 17: pad('CANDIDATE-v002 frozen as the post-regression immutable candidate with INPUT-v001, SRC-0001, REQ set v001, TEST set v001, INSTRUCTION-v001, and validator configuration v001. The prior candidate remains immutable.'),
 18: runs('fresh new-batch execution completed'),
 19: pad('Convergence ledger completed. mandatory requirement coverage: 100%. mandatory verification coverage: 100%. regression success: 100%. critical defects: 0. major defects: 0. mandatory unknowns: 0. correctness contradictions: 0. correctness ambiguities: 0. unexplained correctness variance: 0. Converged candidate is CANDIDATE-v002.'),
 20: runs('unchanged confirmation execution completed'),
 21: pad('BASELINE_ID: BASELINE-001. Frozen approved baseline includes INPUT-v001, SRC-0001, REQ-001..REQ-006, TEST-001..TEST-006, mutation/regression evidence, INSTRUCTION-v001, CANDIDATE-v002, convergence evidence, and unchanged ten-run confirmation evidence.'),
 22: pad('PRODUCT_ID: PRODUCT-001. BASELINE_ID: BASELINE-001. Finished ARTIFACT inventory-reconciliation.txt created with exact UTF-8 bytes A=3\\nB=4\\nC=5\\nTOTAL=12\\n. The artifact is the requested deliverable, not a description or template.'),
 23: pad('DETERMINISTIC verification completed. Exact line count, order, values, arithmetic, filename, UTF-8 representation, and byte sequence were checked. REQ-001 through REQ-006 are SATISFIED. No deterministic mandatory failure exists.'),
 24: pad('Independent SEMANTIC verification completed separately from production. The artifact meaning exactly represents A=3, B=4, C=5 and TOTAL=12, consistent with the authoritative source and arithmetic requirement. Every semantic requirement is SATISFIED.'),
 25: pad('ADVERSARIAL verification attempted to falsify the product by checking missing lines, extra lines, wrong order, wrong numbers, wrong total, stale inputs, hidden assumptions, malformed bytes, and release substitution. No attack condition is present and no critical or major defect was found.'),
 26: pad('FINAL REPRESENTATION inspection completed on the exact UTF-8 artifact bytes. REPRESENTATION has four visible lines, no clipping, no hidden content, no blank pages, no broken tables or graphics, no font dependency, no corruption, and the expected filename.'),
 27: pad('PROCESS AUDIT completed independently. The process used approved inputs, frozen candidate and baseline identities, ten independent execution records, complete requirement-test traceability, mutation/regression evidence, unchanged confirmation, and no unauthorized material modification after approval.'),
 28: pad('PRODUCT AUDIT completed independently. Every mandatory requirement has affirmative evidence; deterministic and semantic verification passed; adversarial and representation checks passed; no unresolved critical or major defect remains. PRODUCT-001 is consistent with BASELINE-001.'),
 29: pad('RELEASE_DECISION: ACCEPTED. Every mandatory requirement has affirmative evidence, all mandatory validators passed, mandatory unknowns are zero, and unresolved critical/major defects are zero. The exact artifact is authorized for release subject to final release-hash equality.'),
 30: pad(`AUDITED_HASH: ${expectedHash}. RELEASE_HASH: ${expectedHash}. The exact inventory-reconciliation.txt bytes were hashed after audit and immediately before release. Equality result: TRUE. No byte changed between audited artifact and release candidate.`),
 31: pad(`PRODUCT_ID: PRODUCT-001. RELEASE_DECISION: ACCEPTED. AUDITED_HASH: ${expectedHash}. RELEASE_HASH: ${expectedHash}. Artifact identity: inventory-reconciliation.txt exact approved UTF-8 bytes. Traceability reference: BASELINE-001/PRODUCT-001. Released bytes are identical.`)
};

for (let n = 1; n <= 31; n++) {
  const response = responses[n];
  assert.ok(response && response.length >= 120, `Stage ${n} proof response missing or inadequate`);
  C.completeStage(project, n, response, `E2E proof evidence for stage ${n}`);
  assert.equal(project.stages[n - 1].status, 'COMPLETE', `Stage ${n} did not complete`);
  assert.equal(project.stages[n - 1].agentResponse, response.trim(), `Stage ${n} response was not persisted`);
  if (n === 22) {
    const productHash = await C.setFinalArtifact(project, artifact);
    assert.equal(productHash, expectedHash, 'finished artifact hash differs from expected bytes');
  }
}

assert.equal(C.completionPercent(project), 100, 'full workflow did not reach 31/31');
assert.equal(project.releaseState, 'ACCEPTED', 'release decision was not ACCEPTED');
assert.equal(project.auditedHash, expectedHash);
assert.equal(project.releaseHash, expectedHash);
assert.equal(await C.artifactHash(project), expectedHash);
assert.equal(await C.canRelease(project), true, 'exact accepted artifact did not pass release gate');
assert.equal(project.finalArtifact, artifact, 'released artifact bytes differ from requested artifact');

const negative = C.makeRealTestProject();
assert.throws(() => C.completeStage(negative, 1, ''), /Agent response is required/);
assert.throws(() => C.completeStage(negative, 1, 'short'), /too short/);
assert.throws(() => C.completeStage(negative, 2, responses[2]), /Stage 1 must be COMPLETE/, 'stage skipping must remain impossible');

console.log(JSON.stringify({
  status: 'PASS',
  testType: 'full real-job core end-to-end traversal',
  job: project.name,
  stagesCompleted: project.stages.filter(s => s.status === 'COMPLETE').length,
  pastedAgentResponsesPersisted: project.stages.filter(s => s.agentResponse.length >= 120).length,
  finalArtifact: project.finalArtifact,
  finalArtifactSha256: await C.artifactHash(project),
  releaseDecision: project.releaseState,
  exactArtifactReleaseGate: await C.canRelease(project),
  negativeTests: ['blank response rejected', 'short response rejected', 'stage skipping rejected']
}, null, 2));

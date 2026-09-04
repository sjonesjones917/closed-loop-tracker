import fs from 'node:fs';
import crypto from 'node:crypto';
import cp from 'node:child_process';

const CONTROLLER_ID = 'closed-loop-monotonic-build-controller/2';
const STATE_PATH = 'verification/closed-loop-build-state.json';
const SPEC_PATH = 'specification/closed-loop-reliability-controlling-implementation-specification.txt';
const SPEC_MANIFEST_PATH = 'specification/closed-loop-specification-manifest.json';
const NORMATIVE_MANIFEST_PATH = 'specification/closed-loop-normative-requirements.json';
const PROOF_SCHEMA = 'closed-loop-build-stage-proof/1';
const STAGE_STATUSES = new Set([
  'NOT_STARTED',
  'IN_PROGRESS',
  'WAITING_FOR_REQUIRED_ACTOR',
  'PROVEN',
  'REGRESSED'
]);
const NORMATIVE_DISPOSITIONS = new Set([
  'CONFORMANT_PROVEN',
  'IMPLEMENTED_UNPROVEN',
  'MISSING',
  'CONTRADICTED',
  'BLOCKED_HUMAN',
  'BLOCKED_ENVIRONMENT',
  'UNKNOWN'
]);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const isSha = (value) => /^[0-9a-f]{40}$/.test(String(value || ''));
const expectedStages = Array.from({length: 30}, (_, index) => String(index + 1).padStart(2, '0'));

function currentCommit() {
  const supplied = process.env.GITHUB_SHA || process.env.CURRENT_COMMIT;
  if (isSha(supplied)) return supplied;
  try {
    const value = cp.execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
    return isSha(value) ? value : null;
  } catch {
    return null;
  }
}

function isAncestor(ancestor, descendant) {
  if (!isSha(ancestor) || !isSha(descendant)) return false;
  const check = () => {
    cp.execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {stdio: 'ignore'});
    return true;
  };
  try {
    return check();
  } catch {
    try {
      cp.execFileSync('git', ['fetch', '--no-tags', '--depth=10', 'origin', 'main'], {stdio: 'ignore'});
      return check();
    } catch {
      return ancestor === descendant;
    }
  }
}

function validateProof({stage, entry, proof, proofBytes, normativeById, specificationSha256, headCommit}) {
  assert(proof.schema === PROOF_SCHEMA, `Stage ${stage} proof schema is wrong.`);
  assert(proof.controllerId === CONTROLLER_ID, `Stage ${stage} controller identity is wrong.`);
  assert(String(proof.stage).padStart(2, '0') === stage, `Stage ${stage} proof stage identity is wrong.`);
  assert(proof.specificationSha256 === specificationSha256, `Stage ${stage} proof specification digest is stale.`);
  assert(entry.proofDigest === sha256(proofBytes), `Stage ${stage} proof digest does not match the exact proof bytes.`);
  assert(entry.provenCommit === proof.endingMainCommit, `Stage ${stage} proven commit disagrees with its proof record.`);
  assert(isSha(proof.startingMainCommit), `Stage ${stage} starting main commit is invalid.`);
  assert(isSha(proof.endingMainCommit), `Stage ${stage} ending main commit is invalid.`);
  assert(isAncestor(proof.endingMainCommit, headCommit), `Stage ${stage} proof commit is not on the checked-out canonical ancestry.`);
  assert(Array.isArray(proof.implementationCommitIds) && proof.implementationCommitIds.every(isSha), `Stage ${stage} implementation commits are invalid.`);
  assert(Array.isArray(proof.changedFiles), `Stage ${stage} changedFiles is missing.`);
  assert(Array.isArray(proof.normativeRequirementChanges), `Stage ${stage} normative changes are missing.`);
  assert(Array.isArray(proof.proofCommands) && proof.proofCommands.length > 0, `Stage ${stage} proof commands are missing.`);
  assert(proof.proofCommands.every((command) => command && command.exitCode === 0 && typeof command.command === 'string' && command.command.length > 0), `Stage ${stage} contains a failed or malformed proof command.`);
  assert(Array.isArray(proof.intentionalInvalidFixtures) && proof.intentionalInvalidFixtures.length > 0, `Stage ${stage} has no mutation-sensitive invalid fixture evidence.`);
  assert(Array.isArray(proof.earlierStageProofsReplayed), `Stage ${stage} prior-stage replay list is missing.`);
  assert(Array.isArray(proof.browserProofs), `Stage ${stage} browser proof list is missing.`);
  assert(Array.isArray(proof.deployedProofs), `Stage ${stage} deployed proof list is missing.`);
  assert(Array.isArray(proof.externalActorProofs), `Stage ${stage} external actor proof list is missing.`);
  assert(Array.isArray(proof.unprovenItems) && proof.unprovenItems.length === 0, `Stage ${stage} cannot be PROVEN while unproven items remain.`);
  assert(Number.isSafeInteger(proof.proofCountBefore) && Number.isSafeInteger(proof.proofCountAfter) && proof.proofCountAfter >= proof.proofCountBefore, `Stage ${stage} proof count ratchet regressed.`);
  assert(Number.isSafeInteger(proof.conformantCountBefore) && Number.isSafeInteger(proof.conformantCountAfter) && proof.conformantCountAfter >= proof.conformantCountBefore, `Stage ${stage} conformant count ratchet regressed.`);
  assert(proof.stageDisposition === 'PROVEN', `Stage ${stage} proof disposition is not PROVEN.`);
  for (const change of proof.normativeRequirementChanges) {
    assert(change && normativeById.has(change.normativeRequirementId), `Stage ${stage} references an unknown normative requirement.`);
    assert(NORMATIVE_DISPOSITIONS.has(change.oldDisposition) && NORMATIVE_DISPOSITIONS.has(change.newDisposition), `Stage ${stage} has an invalid normative disposition transition.`);
    assert(normativeById.get(change.normativeRequirementId).currentDisposition === change.newDisposition, `Stage ${stage} normative disposition is not reflected in the canonical manifest.`);
  }
}

function validateState({state, specBytes, specManifest, normativeManifest, headCommit}) {
  const specificationSha256 = sha256(specBytes);
  assert(state.controllerId === CONTROLLER_ID, 'Build-state controller identity is wrong.');
  assert(state.specificationSha256 === specificationSha256, 'Build-state specification digest is stale.');
  assert(specManifest.sha256 === specificationSha256, 'Specification manifest digest is stale.');
  assert(normativeManifest.specificationSha256 === specificationSha256, 'Normative manifest specification digest is stale.');
  assert(state.specificationSourceCommit === specManifest.sourceCommit, 'Build-state specification source commit is wrong.');
  assert(isSha(state.specificationSourceCommit), 'Build-state specification source commit is invalid.');
  assert(isAncestor(state.specificationSourceCommit, headCommit), 'Specification source commit is not on the checked-out canonical ancestry.');
  assert(isSha(state.lastObservedMainCommit), 'Build-state last observed main commit is invalid.');
  assert(isAncestor(state.lastObservedMainCommit, headCommit), 'Build-state last observed main commit is not on the checked-out canonical ancestry.');
  assert(state.stages && typeof state.stages === 'object' && !Array.isArray(state.stages), 'Build-state stages object is missing.');
  assert(Object.keys(state.stages).length === expectedStages.length && expectedStages.every((stage) => Object.prototype.hasOwnProperty.call(state.stages, stage)), 'Build-state stage universe is not exactly 01 through 30.');

  const normativeById = new Map();
  assert(Array.isArray(normativeManifest.requirements), 'Normative requirement universe is missing.');
  for (const requirement of normativeManifest.requirements) {
    assert(requirement && typeof requirement.normativeRequirementId === 'string' && !normativeById.has(requirement.normativeRequirementId), 'Normative requirement IDs are missing or duplicated.');
    assert(NORMATIVE_DISPOSITIONS.has(requirement.currentDisposition), `Normative requirement ${requirement.normativeRequirementId} has an invalid disposition.`);
    normativeById.set(requirement.normativeRequirementId, requirement);
  }

  let seenNonProven = false;
  let priorProofDigest = null;
  let lastProvenProof = null;
  const provenStages = [];
  for (const stage of expectedStages) {
    const entry = state.stages[stage];
    assert(entry && STAGE_STATUSES.has(entry.status), `Stage ${stage} has an invalid status.`);
    assert(Array.isArray(entry.prerequisiteStageDigests), `Stage ${stage} prerequisite digest list is missing.`);
    if (entry.status === 'NOT_STARTED' || entry.status === 'IN_PROGRESS' || entry.status === 'WAITING_FOR_REQUIRED_ACTOR') {
      seenNonProven = true;
      assert(entry.provenCommit === null && entry.proofRecordPath === null && entry.proofDigest === null, `Stage ${stage} has proof identity while not PROVEN or REGRESSED.`);
      continue;
    }
    assert(typeof entry.proofRecordPath === 'string' && entry.proofRecordPath === `verification/build-stages/stage-${stage}-proof.json`, `Stage ${stage} proof path is wrong.`);
    assert(fs.existsSync(entry.proofRecordPath), `Stage ${stage} proof record is missing.`);
    const proofBytes = fs.readFileSync(entry.proofRecordPath);
    const proof = JSON.parse(proofBytes.toString('utf8'));
    validateProof({stage, entry, proof, proofBytes, normativeById, specificationSha256, headCommit});
    const expectedPrerequisites = priorProofDigest ? [priorProofDigest] : [];
    assert(JSON.stringify(entry.prerequisiteStageDigests) === JSON.stringify(expectedPrerequisites), `Stage ${stage} prerequisite proof digest chain is wrong.`);
    if (entry.status === 'REGRESSED') {
      seenNonProven = true;
      lastProvenProof = proof;
      priorProofDigest = entry.proofDigest;
      continue;
    }
    assert(!seenNonProven, `Stage ${stage} is PROVEN after an earlier non-PROVEN stage.`);
    if (Number(stage) > 1) {
      const replayed = new Set(proof.earlierStageProofsReplayed.map((value) => String(value).padStart(2, '0')));
      for (let prior = 1; prior < Number(stage); prior++) assert(replayed.has(String(prior).padStart(2, '0')), `Stage ${stage} did not record replay of Stage ${String(prior).padStart(2, '0')}.`);
    }
    priorProofDigest = entry.proofDigest;
    lastProvenProof = proof;
    provenStages.push(stage);
  }

  const conformantCount = normativeManifest.requirements.filter((requirement) => requirement.currentDisposition === 'CONFORMANT_PROVEN').length;
  assert(Number.isSafeInteger(state.proofCount) && state.proofCount >= 0, 'Build-state proofCount is invalid.');
  assert(Number.isSafeInteger(state.conformantRequirementCount) && state.conformantRequirementCount >= 0, 'Build-state conformantRequirementCount is invalid.');
  assert(state.conformantRequirementCount === conformantCount, 'Build-state conformant count does not equal the canonical normative manifest.');
  if (lastProvenProof) {
    assert(state.proofCount === lastProvenProof.proofCountAfter, 'Build-state proof count does not equal the latest proven stage.');
    assert(state.conformantRequirementCount === lastProvenProof.conformantCountAfter, 'Build-state conformant count does not equal the latest proven stage.');
  } else {
    assert(state.proofCount === 0 && state.conformantRequirementCount === 0, 'An unproven build state cannot claim proofs or conformant requirements.');
  }
  assert(typeof state.lastUpdatedByCommandId === 'string' && state.lastUpdatedByCommandId.length > 0, 'Build-state command identity is missing.');
  return {provenStages, conformantCount};
}

const headCommit = currentCommit();
assert(headCommit, 'The exact checked-out commit is unavailable.');
const specBytes = fs.readFileSync(SPEC_PATH);
const specManifest = readJson(SPEC_MANIFEST_PATH);
const normativeManifest = readJson(NORMATIVE_MANIFEST_PATH);
const state = readJson(STATE_PATH);
const result = validateState({state, specBytes, specManifest, normativeManifest, headCommit});

const mutations = [];
function rejectMutation(name, mutate, expected) {
  const mutated = structuredClone(state);
  mutate(mutated);
  let failure = null;
  try {
    validateState({state: mutated, specBytes, specManifest, normativeManifest, headCommit});
  } catch (error) {
    failure = error;
  }
  assert(failure && expected.test(String(failure.message)), `${name} mutation was not rejected for the controlling reason: ${failure?.message || 'accepted'}`);
  mutations.push(name);
}

rejectMutation('proof-digest-mismatch', (value) => { value.stages['01'].proofDigest = '0'.repeat(64); }, /proof digest/);
rejectMutation('nonmonotonic-proof-count', (value) => { value.proofCount = 9; }, /proof count/);
rejectMutation('invalid-stage-status', (value) => { value.stages['02'].status = 'PASSED'; }, /invalid status/);
rejectMutation('out-of-order-proven-stage', (value) => {
  value.stages['02'] = {
    status: 'PROVEN',
    provenCommit: value.stages['01'].provenCommit,
    proofRecordPath: value.stages['01'].proofRecordPath,
    proofDigest: value.stages['01'].proofDigest,
    prerequisiteStageDigests: [value.stages['01'].proofDigest]
  };
}, /proof path|proof stage identity|after an earlier non-PROVEN/);
rejectMutation('conformant-count-mismatch', (value) => { value.conformantRequirementCount += 1; }, /conformant count/);

console.log(JSON.stringify({
  controllerStateVerification: 'PASS',
  controllerId: CONTROLLER_ID,
  checkedCommit: headCommit,
  specificationSha256: sha256(specBytes),
  stagesProven: result.provenStages,
  proofCount: state.proofCount,
  conformantRequirementCount: result.conformantCount,
  intentionalInvalidFixtures: mutations
}, null, 2));

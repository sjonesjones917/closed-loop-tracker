import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {acceptPrerequisite, boundedSearchProposal, registerFixtureSourceSearchCapability, recordProposal, evidence} from './test-fixtures.mjs';
import {authorizeSyntheticHandoff} from './test-handoff-authorization.mjs';
import {readStoreArchive} from './test-zip.mjs';

const runtimeFiles = ['workbook.js', 'hash.js', 'workflow-schema.js', 'test-runtime.js', 'workflow-engine.js', 'prompt-engine.js', 'response-ingestion.js', 'project-store.js', 'app-core.js'];
const fixtureFiles = ['test-stage04-response-capacity.mjs', 'test-project-store-runtime.mjs', 'test-fixtures.mjs', 'test-handoff-authorization.mjs', 'test-zip.mjs', 'verifier-runtime.mjs'];
const sha256 = value => createHash('sha256').update(value).digest('hex');
const numberedRequirement = index => `Requirement ${String(index).padStart(4, '0')} must be present.`;

// Capture every adapter store, including artifact payloads and recovery metadata.
// Blob bytes are immutable. Every case receives a distinct copy of mutable rows.
// This is a private in-memory fixture, not a cross-source verification cache.
async function capturePrefix(r, project, inputCount, sourceSha256) {
  const stores = [...r.rows].map(([name, rows]) => [name, [...rows].map(([key, value]) => [key, r.copy(value)])]);
  const identify = async value => {
    if (value instanceof Blob) return {fixtureBlob: {byteSize: value.size, mediaType: value.type, sha256: sha256(Buffer.from(await value.arrayBuffer()))}};
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return Promise.all(value.map(identify));
    return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await identify(item)])));
  };
  const freeze = value => {
    if (!value || typeof value !== 'object' || value instanceof Blob) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  };
  freeze(stores);
  const identity = {inputCount, jobId: project.job.JOB_ID, revision: project.revision, projectSha256: project.projectSha256, sourceSha256, stores: await identify(stores)};
  return Object.freeze({stores, jobId: project.job.JOB_ID, revision: project.revision, projectSha256: project.projectSha256, identitySha256: sha256(JSON.stringify(identity)), identify: async () => sha256(JSON.stringify({...identity, stores: await identify(stores)}))});
}

async function restorePrefix(prefix, sources) {
  const r = projectStoreRuntime({sourceOverrides: sources});
  r.rows.clear();
  for (const [name, rows] of prefix.stores) r.rows.set(name, new Map(rows.map(([key, value]) => [key, r.copy(value)])));
  const project = await r.store.readProject(prefix.jobId);
  assert.equal(project.revision, prefix.revision, 'STAGE04_PREFIX_COLD_REVISION_ORACLE');
  assert.equal(project.projectSha256, prefix.projectSha256, 'STAGE04_PREFIX_COLD_IDENTITY_ORACLE');
  assert.equal(r.store.validateProjectIntegrity(project).valid, true, 'STAGE04_PREFIX_COLD_INTEGRITY_ORACLE');
  for (const stage of [1, 2, 3]) assert.equal(r.engine.gate(stage, project).complete, true, 'STAGE04_PREFIX_COLD_GATE_ORACLE ' + stage);
  assert.equal(r.engine.recordsForCurrentScope(project, 'requirements').length, 0);
  return {r, project};
}

async function preparePrefix(sources, inputCount, sourceSha256) {
  const r = projectStoreRuntime({sourceOverrides: sources}), {core, engine, store} = r, schema = r.runtime.closedLoopWorkflowSchema;
  const runtime = {...r, schema};
  let p = core.createBlankState('JOB-CAPACITY-STAGE04-' + inputCount);
  p.job.EXACT_USER_OBJECTIVE_VERBATIM = 'Produce every distinct numbered requirement.';
  p.job.EXPLICIT_USER_REQUIREMENTS = Array.from({length: inputCount}, (_, index) => numberedRequirement(index)).join('\n');
  engine.recordHumanInputVersion(p, ['EXACT_USER_OBJECTIVE_VERBATIM', 'EXPLICIT_USER_REQUIREMENTS'], 'SYNTHETIC_OPERATOR');
  const intake = engine.intakeCoverageManifest(p);
  const capture = {
    schema: 'closed-loop-stage01-capture/2', inputVersion: intake.inputVersion, manifestSha256: intake.manifestSha256, pass1Completed: true,
    pass2OmissionChallenge: {completed: true, checkedCategories: ['QUALIFIERS', 'EXCEPTIONS', 'DEPENDENCIES', 'NEGATIVE_REQUIREMENTS', 'DO_NOT_CHANGE', 'VISUAL_CONSTRAINTS', 'TEMPORAL_CONSTRAINTS', 'ACCEPTANCE_CONDITIONS', 'AUTHORITY_STATEMENTS', 'TOOL_RESTRICTIONS', 'FILE_REFERENCES', 'OUTPUT_FORMAT_REQUIREMENTS', 'CORRECTIONS', 'LATER_OVERRIDES'], omissionsFound: [], omissionsResolved: true},
    units: intake.units.map((unit, index) => ({sourceUnitId: unit.unitId, sourceRawValueSha256: unit.rawValueSha256, disposition: 'EXTRACTED_RELEVANT_INFORMATION', extractedStatements: [{statementKey: 's' + index, text: unit.rawValueText, statementClass: 'REQUIREMENT', sourceLocation: unit.sourceLocation}]}))
  };
  p = acceptPrerequisite(runtime, p, 1, {stageData: {EXACT_DELIVERABLE_REQUESTED: 'Complete numbered checklist', ASSUMPTIONS: 'NONE', UNKNOWN_INFORMATION: 'NONE', INPUT_SET_CONTENTS: JSON.stringify(capture)}}).project;
  const intakeReview = acceptPrerequisite(runtime, p, 1, {operation: 'SEMANTIC_CHALLENGE', records: {semanticChallenges: [recordProposal(schema, 'semanticChallenges', {tempKey: 'numbered-intake-review', overrides: {FINDINGS: 'Every exact numbered synthetic requirement appears in its corresponding current accounting statement.', DISPOSITION: 'ACCEPTED', REASONING: 'The independent synthetic reviewer compares the complete enumerated input and accepted capture; no real external actor is claimed.'}})]}});
  p = intakeReview.project;
  engine.recordStageConfirmation(p, 1, true, 'Synthetic exact numbered inputs confirmed.', 'SYNTHETIC_OPERATOR', {acceptedChangeId: intakeReview.acceptedChange.changeId, inputVersion: p.job.CURRENT_INPUT_VERSION});
  assert.equal(engine.gate(1, p).complete, true, 'STAGE04_REQUIRED_STAGE01_PREREQUISITE');
  p = acceptPrerequisite(runtime, p, 2, {stageData: {AUTHORITY_HIERARCHY: 'No external authority applies to this hermetic numbered fixture.', KNOWN_CONTROLLING_SOURCES_EXAMINED: 'The complete synthetic supplied input universe.'}, records: {sourceSearchContracts: [boundedSearchProposal(schema)]}}).project;
  registerFixtureSourceSearchCapability(runtime, p);
  p = acceptPrerequisite(runtime, p, 2, {operation: 'SEARCH_ADEQUACY_REVIEW', records: {semanticReviews: [recordProposal(schema, 'semanticReviews', {tempKey: 'search-review', overrides: {REVIEW_QUESTION: 'Is the hermetic source search adequate?', FINDING: 'No external governing source applies to this synthetic numbered fixture.', REASONING: 'The complete closed fixture input universe was inspected and all source classes have explicit dispositions.', RESULT: 'ACCEPTED'}})]}}).project;
  p = acceptPrerequisite(runtime, p, 3, {stageData: {EXCEPTIONS_AND_EDGE_CONDITIONS: 'NONE', CONFLICTING_OR_INVALIDATING_MATERIAL: 'NONE', RESEARCH_GAPS_AND_BLOCKERS: 'NONE', SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED: true, LATEST_PASS_NUMBER: 2, NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS: false}}).project;
  for (const stage of [1, 2, 3]) assert.equal(engine.gate(stage, p).complete, true, 'STAGE04_REAL_PREREQUISITES_ORACLE ' + stage);
  p = await store.writeProject(p, {expectedProjectRevision: 0, createOnly: true, incrementRevision: false});
  return {prefix: await capturePrefix(r, p, inputCount, sourceSha256), rawUnits: intake.unitCount};
}

async function exerciseResponse(prefix, sources, inputCount, partial) {
  const restored = await restorePrefix(prefix, sources), r = restored.r, {engine, prompts, ingestion, store, copy} = r, schema = r.runtime.closedLoopWorkflowSchema;
  let p = restored.project;
  const issued = prompts.reserveAndBuildPromptRecord(p, 4, {operation: 'COMPLETE'}).prompt;
  p = await store.writeProject(p, {expectedProjectRevision: prefix.revision, expectedStateSha256: prefix.projectSha256});
  let prompt = p.projectData.generatedPrompts.find(row => row.instructionId === issued.instructionId);
  ({project: p, prompt} = await authorizeSyntheticHandoff(r, {project: p, prompt}));
  const pkg = await store.createExecutionPackage({jobId: p.job.JOB_ID, stage: 4, operation: 'COMPLETE', instructionId: prompt.instructionId});
  const packageBytes = Buffer.from(await pkg.blob.arrayBuffer()), members = readStoreArchive(packageBytes);
  const instruction = members.find(member => member.canonicalPath === 'instruction.txt');
  assert.ok(instruction, 'STAGE04_SAVED_INSTRUCTION_MEMBER_ORACLE');
  assert.equal(new TextDecoder().decode(instruction.bytes), prompt.prompt, 'STAGE04_SAVED_INSTRUCTION_BYTES_ORACLE');
  const manifest = engine.obligationManifest(p), byText = new Map();
  const mandatory = manifest.items.filter(item => /^Requirement [0-9]{4} must be present\.$/.test(item.text));
  for (const item of mandatory) (byText.get(item.text) || byText.set(item.text, []).get(item.text)).push(item.obligationId);
  // Expected meanings originate in the explicit numbered human fixture, not a
  // count or completeness answer calculated by the implementation under test.
  assert.deepEqual([...byText.keys()].sort(), Array.from({length: inputCount}, (_, index) => numberedRequirement(index)).sort(), 'STAGE04_EXACT_INPUT_UNION_ORACLE');
  const requirements = [...byText].map(([text, ids], index) => recordProposal(schema, 'requirements', {tempKey: 'req' + index, overrides: {OBLIGATION: text, REQUIREMENT_TYPE: 'FUNCTIONAL', MANDATORY_OPTIONAL_STATUS: 'MANDATORY', USER_INPUT_RELATIONSHIP: ids.join(' '), APPLICABILITY: 'APPLICABLE', OBSERVABLE_SATISFACTION_CONDITION: text, INTENDED_VERIFICATION_METHOD: 'DETERMINISTIC_AND_INDEPENDENT_CONTENT_REVIEW', EXPECTED_EVIDENCE: 'Exact numbered requirement observation.', FAILURE_CONDITION: 'The identified numbered requirement is missing.', SEVERITY: 'MAJOR'}}));
  const propositions = requirements.map((req, index) => recordProposal(schema, 'propositions', {tempKey: 'prop' + index, relationships: {REQUIREMENT_ID: {tempKey: req.tempKey}}, overrides: {PROPOSITION_TEXT: req.fields.OBLIGATION, SUBJECT_AND_SCOPE_DESCRIPTION: 'The independently numbered fixture item.', SATISFACTION_MEANING: 'That exact item is present.', FAILURE_MEANING: 'That exact item is absent.'}}));
  const dispositions = manifest.items.filter(item => !mandatory.includes(item)).map((item, index) => ({temporaryKey: 'context' + index, kind: 'OBLIGATION_DISPOSITION', description: 'Preserved fixture context', location: 'Stage4', content: JSON.stringify({obligationId: item.obligationId, disposition: 'retained nonnormative context', reason: 'Retain the fixture description and nonconclusive NONE summaries as context; this is not a numbered mandatory item.'})}));
  if (partial) { requirements.pop(); propositions.pop(); }
  const m = prompts.promptFileManifest(prompt);
  const identity = {promptIdentity: m.promptIdentity, packageId: m.packageId, operationReservationId: m.operationReservationId, challengeNonce: m.challengeNonce};
  const envelope = {schema: schema.RESPONSE_SCHEMA, contractProfileId: schema.CONTRACT_PROFILE_ID, jobId: p.job.JOB_ID, stage: 4, operation: 'COMPLETE', ...identity, scope: m.scope, responseType: 'DATA_PROPOSAL', humanInputRequests: [], humanAuthorityCandidates: [], stageData: {}, records: {requirements, propositions}, evidence: [evidence('stage04-capacity'), ...dispositions], unresolved: [], warnings: [], attachments: []};
  const text = JSON.stringify(envelope), blob = new Blob([text]);
  assert.ok(blob.size < 1048576, 'STAGE04_WITHIN_EXISTING_RAW_BYTE_LIMIT_ORACLE');
  const staged = await store.stageResponseFile({jobId: p.job.JOB_ID, stage: 4, blob, rawFilename: 'response.json', ...identity});
  const read = await store.readStagedResponseFile({jobId: p.job.JOB_ID, stagingId: staged.stagingId});
  assert.equal(read.sha256, sha256(text), 'STAGE04_STAGED_RESPONSE_BYTES_ORACLE');
  const captured = ingestion.captureRaw(p, {stage: 4, text, promptRecord: prompt, transport: copy({authority: 'AUTHORITATIVE_RESPONSE_FILE', stagingId: staged.stagingId, status: read.status, sha256: read.sha256, byteSize: read.byteSize, ...identity})});
  const prepared = ingestion.prepareCaptured(captured.project, {rawResponseId: captured.rawRecord.rawResponseId, promptRecord: prompt, expectedCommittedRevision: p.revision});
  const accounting = engine.evaluateObligationAccounting(p, {envelope});
  assert.equal(accounting.complete, !partial, 'STAGE04_EXACT_ACCOUNTING_ORACLE');
  assert.equal(prepared.rawRecord.completeRawResponse, text, 'STAGE04_RAW_PRESERVATION_ORACLE');
  const row = {caseId: partial ? '251-required-250-returned' : inputCount + '-required-complete', inputCount, partial, requirements: requirements.length, propositions: propositions.length, responseBytes: blob.size, actualPackageBytes: packageBytes.length, packageSha256: sha256(packageBytes), packageMembers: members.length, prefixIdentitySha256: prefix.identitySha256, completeAccounting: accounting.complete, admitted: prepared.validation.valid, issues: copy(prepared.validation.issues), rawPreserved: true};
  assert.equal(prepared.validation.valid, !partial, 'STAGE04_CAPACITY_ADMISSION_ORACLE ' + JSON.stringify(row));
  assert.equal(!!prepared.proposal, !partial, 'STAGE04_CAPACITY_PROPOSAL_ORACLE');
  if (partial) assert.ok(prepared.validation.issues.some(issue => issue.code === 'INCOMPLETE_OBLIGATION_ACCOUNTING'), 'STAGE04_INCOMPLETE_ACCOUNTING_FAILURE_ORACLE');
  const pending = await store.writeProject(prepared.project, {operational: true, expectedProjectRevision: p.revision, expectedStateSha256: p.projectSha256});
  let saved = pending;
  if (!partial) {
    const candidate = ingestion.commit(pending, prepared.proposal.proposalId, {operator: 'SYNTHETIC_CAPACITY', replacementConfirmation: ingestion.acceptanceImpact(pending, prepared.proposal.proposalId)});
    saved = await store.writeProject(candidate.project, {expectedProjectRevision: pending.revision, expectedStateSha256: pending.projectSha256, mutationConfirmation: store.mutationImpact(pending, candidate.project)});
  }
  const readback = await store.readProject(saved.job.JOB_ID);
  assert.equal(store.validateProjectIntegrity(readback).valid, true, 'STAGE04_COMMITTED_INTEGRITY_ORACLE');
  assert.equal(ingestion.findRaw(readback, prepared.rawRecord.rawResponseId).completeRawResponse, text, 'STAGE04_RAW_RELOAD_ORACLE');
  assert.equal(engine.recordsForCurrentScope(readback, 'requirements').length, partial ? 0 : inputCount, 'STAGE04_REQUIREMENT_RELOAD_ORACLE');
  assert.equal(engine.recordsForCurrentScope(readback, 'propositions').length, partial ? 0 : inputCount, 'STAGE04_PROPOSITION_RELOAD_ORACLE');
  assert.equal(engine.acceptedChanges(readback, 4).length, partial ? 0 : 1, 'STAGE04_ACCEPTANCE_RELOAD_ORACLE');
  if (!partial) {
    assert.equal(engine.evaluateObligationAccounting(readback).complete, true, 'STAGE04_ACCOUNTING_RELOAD_ORACLE');
    assert.deepEqual(Array.from(engine.recordsForCurrentScope(readback, 'requirements'), req => engine.recordValue(req, 'OBLIGATION')).sort(), Array.from({length: inputCount}, (_, index) => numberedRequirement(index)).sort(), 'STAGE04_EXACT_CONTENT_RELOAD_ORACLE');
  }
  const gate = engine.gate(4, readback);
  assert.equal(gate.complete, false, 'STAGE04_ADMISSION_IS_NOT_INDEPENDENT_ATOMICITY_REVIEW_ORACLE');
  assert.equal(await prefix.identify(), prefix.identitySha256, 'STAGE04_IMMUTABLE_PREFIX_ORACLE');
  return {...row, actualColdPrefixRead: true, actualCommitReload: !partial, invalidRawReload: partial, canonicalRequirementCount: partial ? 0 : inputCount, canonicalPropositionCount: partial ? 0 : inputCount, gate: copy(gate)};
}

// Synthetic Stage 1–3 actors use production admission and acceptance; their
// helper uses the supported small-payload path. Stage 4 exercises a saved ZIP,
// selected file staging, admission, explicit acceptance, storage and reload.
// The adapter is not a browser/IndexedDB or an actual external-agent execution.
export async function verifyStage04ResponseCapacity({sourceOverrides = {}, counts = [10, 251]} = {}) {
  const sources = Object.fromEntries(runtimeFiles.map(file => [file, sourceOverrides[file] ?? fs.readFileSync(file, 'utf8')]));
  const sourceSha256 = Object.fromEntries(runtimeFiles.map(file => [file, sha256(sources[file])]));
  const fixtureSha256 = Object.fromEntries(fixtureFiles.map(file => [file, sha256(fs.readFileSync(file))]));
  const results = {schema: 'closed-loop-stage04-response-capacity-evidence/2', synthetic: true, actualBrowser: false, boundary: 'SAVED_ZIP_RESPONSE_FILE_ADMISSION_ACCEPTANCE_RELOAD', sourceSha256, fixtureSha256, nodeVersion: process.version, prefixGenerations: 0, cases: []};
  for (const count of counts) {
    const {prefix, rawUnits} = await preparePrefix(sources, count, {...sourceSha256, ...fixtureSha256});
    results.prefixGenerations++;
    for (const partial of count === 251 ? [true, false] : [false]) results.cases.push({...await exerciseResponse(prefix, sources, count, partial), rawUnits});
  }
  return results;
}

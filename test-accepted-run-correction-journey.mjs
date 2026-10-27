import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {projectStoreRuntime, restoreArtifactFixture} from './test-project-store-runtime.mjs';
import {currentRetainedFixtureProject, recordProposal, evidence, authorizeFixtureHandoff} from './test-fixtures.mjs';
import {readStoreArchive} from './test-zip.mjs';
import {verifyConvergenceDerivationTransition} from './test-derivation-receipt-contract.mjs';

const runtimeFiles = ['workbook.js', 'hash.js', 'workflow-schema.js', 'test-runtime.js', 'workflow-engine.js', 'prompt-engine.js', 'response-ingestion.js', 'project-store.js', 'app-core.js'];
const prerequisitePath = 'verification/accepted-run-stage10-prerequisite-20261007.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clock = '2026-10-07T10:54:33.800Z';
const plain = value => JSON.parse(JSON.stringify(value));

function runtime(sources) {
  const r = projectStoreRuntime({sourceOverrides: sources});
  r.runtime.Date = class extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return Date.parse(clock); }
  };
  return r;
}

// This retained prerequisite contains the original operator-created Stage1–10
// state and actual artifact bytes, before any Stage11 run. Each current test
// rederives every prerequisite gate and verifies storage integrity. It does not
// assert that the historical synthetic actors were real independent agents.
async function prerequisite(sources) {
  const r = runtime(sources), carrierBytes = fs.readFileSync(prerequisitePath), carrier = JSON.parse(carrierBytes);
  assert.equal(carrier.schema, 'closed-loop-accepted-run-stage10-prerequisite/1');
  assert.equal(carrier.earlierCompleteFlagsForced, false);
  const compressed = Buffer.from(carrier.gzipBase64, 'base64');
  assert.equal(compressed.length, carrier.gzipByteSize);
  assert.equal(sha(compressed), carrier.gzipSha256);
  const bytes = gunzipSync(compressed, {maxOutputLength: 7 * 1024 * 1024});
  assert.equal(bytes.length, carrier.decodedByteSize);
  assert.equal(sha(bytes), carrier.decodedSha256);
  const retained = JSON.parse(bytes);
  assert.equal(retained.source.actualOperatorPath, true);
  assert.equal(retained.source.syntheticActors, true);
  await restoreArtifactFixture(r.store, retained.artifacts.map(row => ({...row, bytesBase64: row.base64})));
  let p = currentRetainedFixtureProject(r, retained.project);
  r.engine.recalculate(p);
  assert.equal(r.engine.records(p, 'runs').length, 0);
  assert.equal(r.store.validateProjectIntegrity(p).valid, true);
  const originalRaw = JSON.stringify(p.projectData.rawResponses);
  p = await r.store.writeProject(p, {createOnly: true, expectedProjectRevision: 0, incrementRevision: false});
  // The retained producer predates current named contract activations. Use the
  // production cold-read migration before asserting present-day completion;
  // do not seed new contract fields or rewrite its original accepted bytes.
  p = await r.store.readProject(p.job.JOB_ID);
  assert.equal(JSON.stringify(p.projectData.rawResponses), originalRaw, 'ACCEPTED_RUN_PREREQUISITE_ACTIVATION_PRESERVES_RAW');
  assert.equal(r.store.validateProjectIntegrity(p).valid, true);
  for (let stage = 1; stage <= 10; stage++) assert.equal(r.engine.gate(stage, p).complete, true, 'ACCEPTED_RUN_CURRENT_PREREQUISITE ' + stage);
  return {r, p, prerequisiteSha256: sha(carrierBytes), decodedPrerequisiteSha256: carrier.decodedSha256};
}

// Complete immutable adapter state, including artifact payloads and recovery
// rows. Each variant performs an independent cold read of its own mutable copy.
// This is an owning-suite prerequisite, not a subprocess or producer cache.
function snapshot(r, p, sources) {
  const stores = [...r.rows].map(([name, rows]) => [name, [...rows].map(([key, value]) => [key, r.copy(value)])]);
  const freeze = value => {
    if (!value || typeof value !== 'object' || value instanceof Blob) return;
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  };
  freeze(stores);
  return Object.freeze({stores, jobId: p.job.JOB_ID, revision: p.revision, projectSha256: p.projectSha256, sourceSha256: Object.fromEntries(Object.entries(sources).map(([file, source]) => [file, sha(source)]))});
}

function assertConvergenceCurrent(r, p, recordId, boundary) {
  const record = r.engine.records(p, 'convergenceRecords').find(row => row.id === recordId);
  assert(record, 'CONVERGENCE_RETAINED_RECORD ' + boundary);
  assert.equal(record.derivationReceipt?.derivationId, 'closed-loop-derivation/stage18-convergence/6', 'CONVERGENCE_REGISTERED_SOURCE_CONTRACT ' + boundary);
  assert.equal(r.engine.convergenceRecordCurrent(p, record), true, 'CONVERGENCE_PERMITTED_DOWNSTREAM_STABILITY ' + boundary);
  assert.equal(r.engine.gate(18, p).complete, true, 'CONVERGENCE_DOWNSTREAM_GATE ' + boundary);
}

async function restore(prefix, sources) {
  assert.deepEqual(prefix.sourceSha256, Object.fromEntries(Object.entries(sources).map(([file, source]) => [file, sha(source)])), 'ACCEPTED_RUN_PREFIX_SOURCE_IDENTITY');
  const r = runtime(sources);
  r.rows.clear();
  for (const [name, rows] of prefix.stores) r.rows.set(name, new Map(rows.map(([key, value]) => [key, r.copy(value)])));
  const p = await r.store.readProject(prefix.jobId);
  assert.equal(p.revision, prefix.revision);
  assert.equal(p.projectSha256, prefix.projectSha256);
  assert.equal(r.store.validateProjectIntegrity(p).valid, true, 'ACCEPTED_RUN_PREFIX_COLD_INTEGRITY');
  return {r, p};
}

async function restoreStage12AfterRuntimeUpdate(prefix, producerSources, sources) {
  assert.equal(prefix.label, 'stage12-complete', 'ACCEPTED_RUN_EXACT_RESUME_BOUNDARY');
  assert.deepEqual(prefix.sourceSha256, Object.fromEntries(Object.entries(producerSources).map(([file, source]) => [file, sha(source)])), 'ACCEPTED_RUN_RETAINED_SOURCE_BYTES');
  // Authenticate and decode the retained physical rows with their original
  // owner before comparing raw history with the current cold activation.
  const original = await restore(prefix, producerSources);
  const rawBefore = JSON.stringify(original.p.projectData.rawResponses);
  const r = runtime(sources);
  r.rows.clear();
  for (const [name, rows] of prefix.stores) r.rows.set(name, new Map(rows.map(([key, value]) => [key, r.copy(value)])));
  // This is the actual cold storage read, including the current owner's
  // explicit legacy projection activation. No gate or canonical row is edited
  // to manufacture compatibility with the updated implementation.
  const p = await r.store.readProject(prefix.jobId);
  assert.equal(JSON.stringify(p.projectData.rawResponses), rawBefore, 'ACCEPTED_RUN_RUNTIME_UPDATE_PRESERVES_RAW_HISTORY');
  assert.equal(r.store.validateProjectIntegrity(p).valid, true, 'ACCEPTED_RUN_CURRENT_COLD_INTEGRITY');
  if (p.projectSha256 !== prefix.projectSha256) {
    assert(p.revision > prefix.revision, 'ACCEPTED_RUN_MIGRATION_REVISION');
    assert(p.projectData.history.some(event => event.type === 'APPLICATION_PROJECTION_DERIVATION_ACTIVATED' && event.sourceProjectSha256 === prefix.projectSha256), 'ACCEPTED_RUN_EXPLICIT_PROJECTION_ACTIVATION');
  }
  for (let stage = 1; stage <= 10; stage++) assert.equal(r.engine.gate(stage, p).complete, true, 'ACCEPTED_RUN_CURRENT_RETAINED_PREREQUISITE ' + stage);
  assert.equal(r.engine.gate(11, p).complete, false);
  assert.equal(r.engine.gate(12, p).complete, true, 'ACCEPTED_RUN_CURRENT_RETAINED_VERIFICATION');
  assert.equal(r.engine.acceptedChanges(p, 11).length, 10);
  assert.equal(r.engine.acceptedChanges(p, 12).length, 10);
  assert.equal(r.engine.acceptedChanges(p, 13).length, 0, 'ACCEPTED_RUN_TAIL_BEHAVIOR_NOT_REUSED');
  return {r, p};
}

// Diagnostic continuation from an actual source-bound completed Stage17 capture.
// The original owner validates its exact saved rows first; the current owner then
// uses ordinary activation. No receipt, field, history body or gate is rewritten.
async function restoreStage17AfterRuntimeUpdate(prefix, producerSources, sources) {
  assert.equal(prefix.label, 'stage17-complete', 'ACCEPTED_RUN_EXACT_STAGE17_BOUNDARY');
  const original = await restore(prefix, producerSources), old = original.p;
  assert.equal(original.r.engine.gate(17, old).complete, true, 'ACCEPTED_RUN_ORIGINAL_STAGE17_COMPLETE');
  assert.equal(original.r.engine.gate(18, old).complete, false, 'ACCEPTED_RUN_STAGE17_PRECEDES_CONVERGENCE');
  assert.equal(original.r.engine.records(old, 'iterations').filter(row => Number(row.stage) === 19).length, 0, 'ACCEPTED_RUN_NO_REUSED_CONFIRMATION');
  const preserved = Object.fromEntries(['rawResponses','acceptedChanges','outputReceipts','runs','verification','observationRecords','entailmentReviews','convergenceRecords','history'].map(key => [key, plain(old.projectData[key])]));
  const r = runtime(sources); r.rows.clear();
  for (const [name, rows] of prefix.stores) r.rows.set(name, new Map(rows.map(([key, value]) => [key, r.copy(value)])));
  const p = await r.store.readProject(prefix.jobId);
  assert.equal(r.store.validateProjectIntegrity(p).valid, true, 'ACCEPTED_RUN_STAGE17_CURRENT_COLD_INTEGRITY');
  const currentProjectionId = r.runtime.closedLoopWorkflowSchema.PROJECT_PROJECTION_DERIVATION_CONTRACT?.id;
  assert.equal(typeof currentProjectionId, 'string', 'ACCEPTED_RUN_CURRENT_PROJECTION_REGISTERED');
  assert(currentProjectionId.length > 0, 'ACCEPTED_RUN_CURRENT_PROJECTION_REGISTERED');
  assert.equal(p.projectData.applicationProjection.receipt.derivationId, currentProjectionId, 'ACCEPTED_RUN_STAGE17_CURRENT_PROJECTION');
  for (const [key, value] of Object.entries(preserved)) {
    const actual = key === 'history' ? p.projectData[key].slice(0, value.length) : p.projectData[key];
    assert.deepEqual(plain(actual), value, 'ACCEPTED_RUN_STAGE17_ACTIVATION_PRESERVES_' + key);
  }
  if (p.projectSha256 !== prefix.projectSha256) {
    assert(p.revision > prefix.revision);
    assert(p.projectData.history.some(event => event.type === 'APPLICATION_PROJECTION_DERIVATION_ACTIVATED' && event.sourceProjectSha256 === prefix.projectSha256), 'ACCEPTED_RUN_STAGE17_NORMAL_ACTIVATION');
  }
  assert.equal(r.engine.gate(17, p).complete, true);
  assert.equal(r.engine.gate(18, p).complete, false);
  assert.equal(r.engine.stageEntryState(p, 18).allowed, true);
  return {r, p};
}

async function save(r, previous, next) {
  return r.store.writeProject(next, {expectedProjectRevision: previous.revision, expectedStateSha256: previous.projectSha256, mutationConfirmation: r.store.mutationImpact(previous, next)});
}

// Specification17.6 Phase02: independently expected outcomes precede the
// complete record comparison; issued identities are supplied by the fixture.
function assertPreservedValidationResult(r,project,{prior,prepared,prompt,rawResponseId,text,stage,caseId,valid,issues,status,receiptState}) {
 const oracle='VALIDATION_RESULT_PRESERVATION_ORACLE '+caseId,plain=value=>JSON.parse(JSON.stringify(value));
 const validationId=prepared.validation.validationId,receiptId=prepared.receipt.receiptId;
 assert.equal(typeof validationId,'string',oracle);assert.ok(validationId.length>0,oracle);
 assert.equal(typeof receiptId,'string',oracle);assert.ok(receiptId.length>0,oracle);
 assert.equal(new Date(prepared.validation.createdAt).toISOString(),prepared.validation.createdAt,oracle);
 assert.equal(prior.projectData.responseValidations.some(row=>row.validationId===validationId),false,oracle);
 assert.equal(project.projectData.responseValidations.length,prior.projectData.responseValidations.length+1,oracle);
 const one=(family,key,id)=>{const rows=project.projectData[family].filter(row=>row[key]===id);assert.equal(rows.length,1,oracle+' '+family);return rows[0];};
 const validation=one('responseValidations','validationId',validationId),raw=one('rawResponses','rawResponseId',rawResponseId),receipt=one('outputReceipts','receiptId',receiptId);
 const expected={validationId,rawResponseId,jobId:prior.job.JOB_ID,stage,promptId:prompt.instructionId||prompt.promptId,promptSha256:prompt.bodySha256||prompt.sha256,createdAt:prepared.validation.createdAt,valid,issues,errorCount:valid?0:1,warningCount:issues.filter(row=>row.severity==='WARNING').length,responseSchema:'closed-loop-stage-response/3',responseType:'DATA_PROPOSAL',status,attemptPromptId:prompt.instructionId||prompt.promptId,receiptId};
 assert.deepEqual(plain(validation),expected,oracle+' complete-record');
 assert.equal(raw.validationId,validationId,oracle);assert.equal(raw.receiptId,receiptId,oracle);assert.equal(raw.completeRawResponse,text,oracle);
 assert.equal(raw.jobId,prior.job.JOB_ID,oracle);assert.equal(raw.stage,stage,oracle);assert.equal(raw.promptInstructionId,expected.promptId,oracle);assert.equal(raw.promptBodySha256,expected.promptSha256,oracle);
 assert.equal(raw.sha256,r.runtime.closedLoopHash.sha256Text(text),oracle);assert.equal(raw.status,valid?(status==='VALID'?'VALIDATED_PENDING_REVIEW':'ACCEPTED_DATA_CHANGE'):'VALIDATION_FAILED',oracle);
 assert.equal(receipt.validationId,validationId,oracle);assert.equal(receipt.rawResponseId,rawResponseId,oracle);assert.equal(receipt.rawResponseSha256,raw.sha256,oracle);
 assert.equal(receipt.jobId,prior.job.JOB_ID,oracle);assert.equal(receipt.stage,stage,oracle);assert.equal(receipt.promptInstructionId,expected.promptId,oracle);assert.equal(receipt.promptSha256,prompt.sha256||prompt.bodySha256,oracle);
 assert.deepEqual(plain(receipt.deviations),issues,oracle);assert.equal(receipt.completionState,receiptState,oracle);
 if(valid){
  const proposal=one('responseProposals','proposalId',prepared.proposal.proposalId);
  assert.equal(proposal.validationId,validationId,oracle);assert.equal(proposal.rawResponseId,rawResponseId,oracle);assert.equal(proposal.receiptId,receiptId,oracle);assert.equal(proposal.promptId,expected.promptId,oracle);
  assert.equal(proposal.jobId,prior.job.JOB_ID,oracle);assert.equal(proposal.stage,stage,oracle);assert.equal(proposal.promptSha256,expected.promptSha256,oracle);
  assert.equal(raw.proposalId,proposal.proposalId,oracle);assert.equal(receipt.parsedProposalId,proposal.proposalId,oracle);assert.equal(proposal.status,status==='VALID'?'PENDING_OPERATOR_REVIEW':'ACCEPTED',oracle);
 }else{
  assert.equal(prepared.proposal,null,oracle);assert.equal(Object.hasOwn(raw,'proposalId'),false,oracle);assert.equal(receipt.parsedProposalId,'NONE',oracle);
  const disposition=one('responseDispositions','dispositionId',raw.dispositionId);
  assert.equal(disposition.type,'VALIDATION_FAILED_RESPONSE',oracle);assert.equal(disposition.validationId,validationId,oracle);assert.equal(disposition.rawResponseId,rawResponseId,oracle);assert.equal(disposition.receiptId,receiptId,oracle);assert.equal(disposition.promptId,expected.promptId,oracle);assert.equal(disposition.proposalId,null,oracle);
  assert.deepEqual(plain(disposition.issueCodes),issues.map(row=>row.code),oracle);assert.equal(receipt.rejectedResponseId,disposition.dispositionId,oracle);
 }
 return {caseId,passed:true,valid,status,errorCount:expected.errorCount,warningCount:expected.warningCount,issues:plain(issues),completeRecord:true,uniqueRecord:true,rawExact:true,rawValidationReceiptLinked:true,promptIdentityLinked:true,proposalOrDispositionLinked:true,actualSaveReload:true,synthetic:true,actualBrowser:false};
}

async function submit(r, p, stage, operation, buildRecords, scope = {}) {
  const draft = r.copy(p), issued = r.prompts.reserveAndBuildPromptRecord(draft, stage, {operation, scope}).prompt;
  p = await save(r, p, draft);
  const authorized = await authorizeFixtureHandoff(r, {project: p, prompt: p.projectData.generatedPrompts.find(row => row.instructionId === issued.instructionId)});
  p = authorized.project;
  const prompt = authorized.prompt, pkg = await r.store.createExecutionPackage(authorized.request);
  const packageBytes = Buffer.from(await pkg.blob.arrayBuffer()), members = readStoreArchive(packageBytes);
  assert.equal(Buffer.from(members.find(row => row.canonicalPath === 'instruction.txt').bytes).toString('utf8'), prompt.prompt, 'ACCEPTED_RUN_ACTUAL_INSTRUCTION_BYTES');
  const manifest = JSON.parse(Buffer.from(members.find(row => row.canonicalPath === 'manifest.json').bytes).toString('utf8'));
  // The public manifest enumerates context-file byte identities; its shape is
  // intentionally narrower than the internal prompt contextManifest. Inspect
  // the actual exported context carriers, including inline untrusted blocks.
  const blocks = [...prompt.prompt.matchAll(/BEGIN_UNTRUSTED_DATA_BLOCK\s*([\s\S]*?)\s*END_UNTRUSTED_DATA_BLOCK/g)].map(match => JSON.parse(match[1]));
  for (const file of manifest.contextFiles || []) {
    const member = members.find(row => row.canonicalPath === file.path);
    assert(member, 'ACCEPTED_RUN_DECLARED_CONTEXT_BYTES');
    const bytes = Buffer.from(member.bytes);
    assert.equal(sha(bytes), file.sha256, 'ACCEPTED_RUN_ACTUAL_CONTEXT_BYTE_IDENTITY');
    assert.equal(bytes.length, file.byteSize, 'ACCEPTED_RUN_ACTUAL_CONTEXT_BYTE_SIZE');
    blocks.push(...JSON.parse(bytes.toString('utf8')).members);
  }
  const diagnostics = blocks.filter(block => /^context\.stage(?:13|17|19)\.COMPARE\.acceptedRunIndependenceFailure$/.test(block.sourceIdentity));
  if (stage === 13 && operation === 'COMPARE') {
    assert.equal(diagnostics.length, 1, 'ACCEPTED_RUN_ACTUAL_PACKAGE_DIAGNOSTIC_CONTRACT');
    const diagnostic = JSON.parse(diagnostics[0].value);
    const declared = Array.from(r.engine.records(p, 'runs').filter(row => r.engine.recordValue(row, 'CONTAMINATION_CHECK') === 'CONTAMINATED'), row => row.id);
    const publicDeclared = declared.map(id => prompt.contextManifest.blindAliasMap.find(row => row.kind === 'RUN_ID' && row.canonicalId === id)?.alias || id);
    assert.deepEqual(diagnostic.affectedRunIds, publicDeclared, 'ACCEPTED_RUN_ACTUAL_PACKAGE_AFFECTED_IDENTITIES');
    assert(prompt.prompt.includes('ACCEPTED RUN INDEPENDENCE FAILURE — REQUIRED DIAGNOSIS'), 'ACCEPTED_RUN_ACTUAL_INSTRUCTION_OBLIGATION');
    const exportedText = members.map(row => Buffer.from(row.bytes).toString('utf8')).join('\n');
    assert(publicDeclared.every(id => exportedText.includes(id)), 'ACCEPTED_RUN_ACTUAL_CONTEXT_AFFECTED_IDENTITIES');
    assert(declared.every((id, index) => id === publicDeclared[index] || !exportedText.includes(id)), 'ACCEPTED_RUN_PRIVATE_RUN_ID_NOT_EXPORTED');
  }
  if (['EXECUTE_RUN', 'VERIFY'].includes(operation)) assert.equal(diagnostics.length, 0, 'ACCEPTED_RUN_DIAGNOSTIC_NOT_EXPOSED_TO_INDEPENDENT_ACTOR');
  const identity = {promptIdentity: manifest.promptIdentity, packageId: manifest.packageId, operationReservationId: manifest.operationReservationId, challengeNonce: manifest.challengeNonce};
  // Synthetic response construction uses the same public identities the actor
  // receives. The private alias binding is a fixture lookup, not extra context
  // disclosed to the actor and not an expected semantic outcome generator.
  const aliases = Array.from(prompt.contextManifest?.blindAliasMap || []).sort((a, b) => b.canonicalId.length - a.canonicalId.length);
  const exportedText = members.map(row => Buffer.from(row.bytes).toString('utf8')).join('\n');
  const publicValue = value => {
    if (typeof value === 'string') {
      let text = value;
      for (const {canonicalId, alias} of aliases) if (text.includes(canonicalId)) {
        assert(exportedText.includes(alias), 'ACCEPTED_RUN_RESPONSE_REFERENCE_PUBLISHED');
        text = text.split(canonicalId).join(alias);
      }
      return text;
    }
    if (Array.isArray(value)) return Array.from(value, publicValue);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, publicValue(item)]));
    return value;
  };
  const records = publicValue(typeof buildRecords === 'function' ? buildRecords(prompt, p) : buildRecords);
  const schema = r.runtime.closedLoopWorkflowSchema;
  const envelope = {schema: schema.RESPONSE_SCHEMA, contractProfileId: schema.CONTRACT_PROFILE_ID, jobId: p.job.JOB_ID, stage, operation, ...identity, scope: manifest.scope, responseType: 'DATA_PROPOSAL', humanInputRequests: [], humanAuthorityCandidates: [], stageData: {}, records, evidence: [evidence('Synthetic accepted-run correction with exact preserved inputs')], unresolved: [], warnings: [], attachments: []};
  const text = JSON.stringify(envelope), staged = await r.store.stageResponseFile({jobId: p.job.JOB_ID, stage, blob: new Blob([text]), rawFilename: 'response.json', ...identity});
  const file = await r.store.readStagedResponseFile({jobId: p.job.JOB_ID, stagingId: staged.stagingId});
  assert.equal(file.sha256, sha(text));
  assert.equal(new TextDecoder().decode(file.bytes), text);
  const captured = r.ingestion.captureRaw(p, {stage, text, promptRecord: prompt, transport: r.copy({authority: 'AUTHORITATIVE_RESPONSE_FILE', stagingId: staged.stagingId, status: file.status, sha256: file.sha256, byteSize: file.byteSize, ...identity})});
  const prepared = r.ingestion.prepareCaptured(captured.project, {rawResponseId: captured.rawRecord.rawResponseId, promptRecord: prompt, expectedCommittedRevision: p.revision});
  assert.equal(prepared.validation.valid, true, 'ACCEPTED_RUN_ADMISSION ' + stage + ':' + operation + ' ' + JSON.stringify(prepared.validation.issues));
  // The existing Stage13 comparison supplies the actual prompt-issued alias
  // for the affected run; this identifies the warning without reading issues.
  const designatedWarning=stage===13&&operation==='COMPARE';
  if(designatedWarning){
    const canonicalRunId=r.engine.records(p,'runs').find(row=>r.engine.recordValue(row,'CONTAMINATION_CHECK')==='CONTAMINATED')?.id;
    const alias=prompt.contextManifest.blindAliasMap.find(row=>row.kind==='RUN_ID'&&row.canonicalId===canonicalRunId)?.alias;
    assert.ok(canonicalRunId&&alias&&alias!==canonicalRunId,'VALIDATION_WARNING_ISSUED_ALIAS_CONTROL_ORACLE');
    assert.equal(envelope.records.defects[0].relationships.RUN_ID.recordId,alias,'VALIDATION_WARNING_ISSUED_ALIAS_CONTROL_ORACLE');
    assert.equal(prepared.proposal.canonicalRecords.defects[0].relationships.RUN_ID,canonicalRunId,'VALIDATION_WARNING_TYPED_RESOLUTION_CONTROL_ORACLE');
  }

  const pending = await r.store.writeProject(prepared.project, {operational: true, expectedProjectRevision: p.revision, expectedStateSha256: p.projectSha256});
  const warningIssues=[{code:'BLIND_ALIAS_REMAPPED',path:'/',message:'Application-issued blind review aliases were remapped to their prompt-bound canonical identities for validation; the exact raw response remains preserved unchanged.',severity:'WARNING'}];
  let validationResultPreservation=null;
  if(designatedWarning){const pendingRead=await r.store.readProject(pending.job.JOB_ID);validationResultPreservation={pending:assertPreservedValidationResult(r,pendingRead,{prior:p,prepared,prompt,rawResponseId:captured.rawRecord.rawResponseId,text,stage,caseId:'blind-alias-warning-complete-result',valid:true,issues:warningIssues,status:'VALID',receiptState:'PARSED_PENDING_REVIEW'})};}

  const committed = r.ingestion.commit(pending, prepared.proposal.proposalId, {operator: 'SYNTHETIC_CORRECTION_OPERATOR', replacementConfirmation: r.ingestion.acceptanceImpact(pending, prepared.proposal.proposalId)});
  const saved = await save(r, pending, committed.project);
  const validationResultInput=p;
  p = await r.store.readProject(saved.job.JOB_ID);
  if(designatedWarning)validationResultPreservation.accepted=assertPreservedValidationResult(r,p,{prior:validationResultInput,prepared,prompt,rawResponseId:captured.rawRecord.rawResponseId,text,stage,caseId:'blind-alias-warning-complete-result',valid:true,issues:warningIssues,status:'ACCEPTED_DATA_CHANGE',receiptState:'ACCEPTED_DATA_CHANGE'});
  assert.equal(r.store.validateProjectIntegrity(p).valid, true, 'ACCEPTED_RUN_COMMIT_RELOAD_INTEGRITY');
  assert.equal(r.ingestion.findRaw(p, captured.rawRecord.rawResponseId).completeRawResponse, text, 'ACCEPTED_RUN_RAW_BYTES_PRESERVED');
  return {p, prompt, manifest, validationResultPreservation, rawResponseId: captured.rawRecord.rawResponseId, rawSha256: sha(text), packageSha256: sha(packageBytes)};
}

function runRecords(r, contamination) {
  return prompt => ({runs: [recordProposal(r.runtime.closedLoopWorkflowSchema, 'runs', {targetId: prompt.scope.runId, overrides: {FRESH_CONTEXT_RECORD: prompt.scope.contextId, CONTAMINATION_CHECK: contamination, TOOL_CONFIGURATION: 'Synthetic isolated executor, no real external actor', EXECUTION_STATUS: 'COMPLETED', COMPLETE_OUTPUT: 'VERIFIED\n'}})]});
}

// Bounded Stage11/12 boundary owner. Reuse the exact retained prerequisite and
// production package/staging/acceptance/store path without the later correction
// journey. Retained history is input only; every gate is checked on this runtime.
// Shared admitted prerequisite for isolated Stage12 controls. No readiness
// flags are manufactured: all ten runs traverse the existing production path.
export async function createRetainedStage11Prerequisite({sourceOverrides={}}={}){
 const sources=Object.fromEntries(runtimeFiles.map(file=>[file,sourceOverrides[file]??fs.readFileSync(file,'utf8')]));
 return prerequisite(sources);
}

export async function createAdmittedStage12Fixture({sourceOverrides={},onProgress=()=>{}}={}){
 const sources=Object.fromEntries(runtimeFiles.map(file=>[file,sourceOverrides[file]??fs.readFileSync(file,'utf8')]));
 let {r,p,prerequisiteSha256,decodedPrerequisiteSha256}=await prerequisite(sources);
 for(let index=0;index<10;index++){({p}=await submit(r,p,11,'EXECUTE_RUN',runRecords(r,'NONE')));onProgress({acceptedRuns:index+1});}
 for(let stage=1;stage<=11;stage++)assert.equal(r.engine.gate(stage,p).complete,true,'ADMITTED_STAGE12_PREREQUISITE_GATE_'+stage);
 assert.equal(r.engine.recordsForIteration(p,'runs',p.job.CURRENT_ITERATION).length,10,'ADMITTED_STAGE12_TEN_RUNS');
 return {r,p,prerequisiteSha256,decodedPrerequisiteSha256};
}

export async function verifyStage11AcceptedBoundary() {
  const sources = Object.fromEntries(runtimeFiles.map(file => [file, fs.readFileSync(file, 'utf8')]));
  let {r, p, prerequisiteSha256, decodedPrerequisiteSha256} = await prerequisite(sources);
  const cases = [];
  for (let index = 0; index < 9; index++) ({p} = await submit(r, p, 11, 'EXECUTE_RUN', runRecords(r, 'NONE')));
  assert.equal(r.engine.acceptedChanges(p, 11).length, 9);
  assert.equal(r.engine.gate(11, p).complete, false, 'STAGE11_BOUNDARY_NINE_BLOCKED');
  assert.equal(r.engine.stageEntryState(p, 12).allowed, false, 'STAGE11_BOUNDARY_NINE_NO_ENTRY');
  cases.push({caseId: 'nine-accepted-runs', stage11Complete: false, stage12EntryAllowed: false});
  const nine = snapshot(r, p, sources);
  const clean = await submit(r, p, 11, 'EXECUTE_RUN', runRecords(r, 'NONE'));
  p = clean.p;
  const e = r.engine, iterationId = clean.prompt.scope.iterationId;
  const runs = e.recordsForIteration(p, 'runs', iterationId), runId = clean.prompt.scope.runId;
  const change = e.acceptedChanges(p, 11).find(row => row.scope.runId === runId);
  assert.equal(runs.length, 10);
  assert.equal(e.gate(11, p).complete, true, 'STAGE11_BOUNDARY_TEN_COMPLETE');
  const stage12 = e.gate(12, p), matrix = e.verificationMatrix(p, iterationId);
  assert.equal(stage12.complete, false, 'STAGE11_BOUNDARY_STAGE12_STILL_INCOMPLETE');
  assert(matrix.expected.length > 0 && matrix.missing.length > 0, 'STAGE11_BOUNDARY_DUE_MATRIX_MISSING');
  assert(stage12.reasons.some(reason => /REQ × RUN × TEST|coverage/i.test(reason)), 'STAGE11_BOUNDARY_MATRIX_GATE_REASON');
  cases.push({caseId: 'ten-clean-accepted-runs-without-stage12-results', stage11Complete: true, stage12Complete: false, expectedVerificationCount: matrix.expected.length, missingVerificationCount: matrix.missing.length, actualPackage: true, actualStagedResponse: true, actualCommitReload: true});
  const run = state => state.projectData.runs.find(row => row.id === runId);
  const raw = state => state.projectData.rawResponses.find(row => row.rawResponseId === change.rawResponseId);
  const receipt = state => state.projectData.outputReceipts.find(row => row.acceptedCanonicalChangeId === change.changeId);
  const set = (row, field, value, family) => { row.fields[field] = row[field] = r.copy(value); e.refreshRecordHashes(row, family); };
  const faults = [
    ['missing-accepted-proposal', state => { state.projectData.responseProposals = state.projectData.responseProposals.filter(row => row.proposalId !== change.proposalId); }, true],
    ['missing-output-receipt', state => { state.projectData.outputReceipts = state.projectData.outputReceipts.filter(row => row.acceptedCanonicalChangeId !== change.changeId); }, true],
    ['misbound-output-receipt', state => { receipt(state).runId = runs[0].id; }, true],
    ['missing-original-bytes', state => { delete raw(state).completeRawResponse; }, true],
    ['tampered-original-bytes', state => { raw(state).completeRawResponse += ' '; }, true],
    ['canonical-submitted-field-disagreement', state => set(run(state), 'COMPLETE_OUTPUT', 'ALTERED', 'runs'), true],
    ['duplicate-context', state => {
      const contexts = runs.slice(0, 2).map(row => state.projectData.freshContexts.find(context => context.id === e.recordValue(row, 'CONTEXT_ID')));
      for (const context of contexts) set(context, 'EXTERNAL_CONTEXT_IDENTIFIER', 'SYNTHETIC-SAME-EXTERNAL-CONTEXT', 'freshContexts');
    }, false],
    ['missing-tenth-run', state => { state.projectData.runs = state.projectData.runs.filter(row => row.id !== runId); }, false],
    ['candidate-mismatch', state => set(run(state), 'CANDIDATE_ID', 'FOREIGN-CANDIDATE', 'runs'), false],
    ['candidate-hash-set-missing', state => {
      const candidate = state.projectData.candidateFreezes.find(row => row.id === clean.prompt.scope.candidateId);
      set(candidate, 'COMPONENT_HASHES', {}, 'candidateFreezes');
    }, false]
  ];
  for (const [caseId, inject, provenanceFault] of faults) {
    const state = r.copy(p); inject(state);
    e.recalculate(state);
    assert.equal(e.gate(11, state).complete, false, 'STAGE11_BOUNDARY_NEGATIVE ' + caseId);
    if (provenanceFault) {
      assert.equal(e.evaluateIteration(state, iterationId, 'INITIAL').executionEvidenceComplete, false, 'STAGE11_BOUNDARY_PROVENANCE ' + caseId);
      assert.equal(e.stageEntryState(state, 12).allowed, false, 'STAGE11_BOUNDARY_NO_FALSE_DIAGNOSTIC_ENTRY ' + caseId);
    }
    cases.push({caseId, faultInjected: true, stage11Complete: false, provenanceFault, boundary: 'Isolated copy of accepted clean cohort; no corrupt persistence claim.'});
  }
  // A real accepted contamination response is distinct from broken provenance:
  // it blocks completion but retains the existing diagnostic Stage12 entry.
  ({r, p} = await restore(nine, sources));
  const contaminated = await submit(r, p, 11, 'EXECUTE_RUN', runRecords(r, 'CONTAMINATED'));
  p = contaminated.p;
  assert.equal(r.engine.gate(11, p).complete, false, 'STAGE11_BOUNDARY_CONTAMINATION_BLOCKED');
  assert.equal(r.engine.stageEntryState(p, 12).allowed, true, 'STAGE11_BOUNDARY_CONTAMINATION_DIAGNOSTIC_ENTRY');
  assert.equal(JSON.parse(r.ingestion.findRaw(p, contaminated.rawResponseId).completeRawResponse).records.runs[0].fields.CONTAMINATION_CHECK, 'CONTAMINATED');
  cases.push({caseId: 'actual-accepted-contamination', stage11Complete: false, stage12EntryAllowed: true, rawSha256: contaminated.rawSha256});
  return {passed: true, synthetic: true, actualBrowser: false, physicalDeviceAcceptance: false, earlierCompleteFlagsForced: false, prerequisiteSha256, decodedPrerequisiteSha256, sourceSha256: Object.fromEntries(Object.entries(sources).map(([file, source]) => [file, sha(source)])), cleanRawSha256: clean.rawSha256, cases};
}

export async function verifyAcceptedRunCorrectionJourney({sourceOverrides = {}, retainedNineRunPrefix = null, retainedStage12Prefix = null, retainedStage17Prefix = null, retainedProducerSources = null, onCheckpoint = null, onProgress = () => {}} = {}) {
  const startedAt = new Date().toISOString(), started = performance.now();
  const sources = Object.fromEntries(runtimeFiles.map(file => [file, sourceOverrides[file] ?? fs.readFileSync(file, 'utf8')]));
  const sourceSha256 = Object.fromEntries(Object.entries(sources).map(([file, source]) => [file, sha(source)]));
  let r, p, prerequisiteSha256, decodedPrerequisiteSha256;
  assert([retainedNineRunPrefix, retainedStage12Prefix, retainedStage17Prefix].filter(Boolean).length <= 1, 'ACCEPTED_RUN_ONE_RETAINED_BOUNDARY');
  if (retainedStage17Prefix) {
    assert(retainedProducerSources, 'ACCEPTED_RUN_RETAINED_PRODUCER_SOURCE_REQUIRED');
    ({r, p} = await restoreStage17AfterRuntimeUpdate(retainedStage17Prefix, retainedProducerSources, sources));
    const carrierBytes = fs.readFileSync(prerequisitePath), carrier = JSON.parse(carrierBytes);
    prerequisiteSha256 = sha(carrierBytes); decodedPrerequisiteSha256 = carrier.decodedSha256;
  } else if (retainedStage12Prefix) {
    assert(retainedProducerSources, 'ACCEPTED_RUN_RETAINED_PRODUCER_SOURCE_REQUIRED');
    ({r, p} = await restoreStage12AfterRuntimeUpdate(retainedStage12Prefix, retainedProducerSources, sources));
    const carrierBytes = fs.readFileSync(prerequisitePath), carrier = JSON.parse(carrierBytes);
    prerequisiteSha256 = sha(carrierBytes); decodedPrerequisiteSha256 = carrier.decodedSha256;
  } else if (retainedNineRunPrefix) {
    // Explicit resumption after a COMPARE-only producer repair. The nine run
    // receipts are prerequisites, not reused assertions about the repaired
    // operation. Keep every original byte and rederive their current state.
    assert(retainedProducerSources, 'ACCEPTED_RUN_RETAINED_PRODUCER_SOURCE_REQUIRED');
    assert.deepEqual(retainedNineRunPrefix.sourceSha256, Object.fromEntries(Object.entries(retainedProducerSources).map(([file, source]) => [file, sha(source)])));
    assert.deepEqual(runtimeFiles.filter(file => sources[file] !== retainedProducerSources[file]), ['prompt-engine.js'], 'ACCEPTED_RUN_ONLY_COMPARE_PRODUCER_CHANGED');
    const old = runtime(retainedProducerSources), current = runtime(sources);
    for (const [stage, operation] of [[11, 'EXECUTE_RUN'], [12, 'VERIFY'], [17, 'EXECUTE_RUN'], [17, 'VERIFY'], [19, 'EXECUTE_RUN'], [19, 'VERIFY']]) {
      assert.equal(current.prompts.versionFor(stage, operation), old.prompts.versionFor(stage, operation), 'ACCEPTED_RUN_RETAINED_OPERATION_EPOCH');
      assert.deepEqual(plain(current.prompts.responseContractDescriptor(stage, operation)), plain(old.prompts.responseContractDescriptor(stage, operation)), 'ACCEPTED_RUN_RETAINED_RESPONSE_CONTRACT');
    }
    ({r, p} = await restore(retainedNineRunPrefix, retainedProducerSources));
    const rebound = {...retainedNineRunPrefix, sourceSha256};
    ({r, p} = await restore(rebound, sources));
    r.engine.recalculate(p);
    for (let stage = 1; stage <= 10; stage++) assert.equal(r.engine.gate(stage, p).complete, true);
    assert.equal(r.engine.acceptedChanges(p, 11).length, 9, 'ACCEPTED_RUN_EXACT_RETAINED_NINE');
    assert.equal(r.engine.gate(11, p).complete, false);
    const carrierBytes = fs.readFileSync(prerequisitePath), carrier = JSON.parse(carrierBytes);
    prerequisiteSha256 = sha(carrierBytes); decodedPrerequisiteSha256 = carrier.decodedSha256;
  } else ({r, p, prerequisiteSha256, decodedPrerequisiteSha256} = await prerequisite(sources));
  const checkpoint = async (label, retainedSnapshot = null) => { if (onCheckpoint) await onCheckpoint({label, r, p, sources, snapshot: retainedSnapshot || snapshot(r, p, sources)}); onProgress({label, revision: p.revision}); };
  const cases = [];
  if (!retainedStage12Prefix && !retainedStage17Prefix) {
  for (let index = retainedNineRunPrefix ? 9 : 0; index < 9; index++) {
    ({p} = await submit(r, p, 11, 'EXECUTE_RUN', runRecords(r, 'NONE')));
    onProgress({label: 'initial-run', accepted: index + 1});
  }
  const prefix = snapshot(r, p, sources);
  await checkpoint('nine-initial-runs', prefix);
  assert.equal(r.engine.gate(11, p).complete, false);
  assert.equal(r.engine.stageEntryState(p, 12).allowed, false, 'ACCEPTED_RUN_NINE_CANNOT_ENTER_DIAGNOSTICS');
  for (const contamination of ['NONE', 'CONTAMINATED']) {
    ({r, p} = await restore(prefix, sources));
    assert.equal(r.engine.acceptedChanges(p, 11).length, 9);
    const result = await submit(r, p, 11, 'EXECUTE_RUN', runRecords(r, contamination));
    p = result.p;
    const run = r.engine.records(p, 'runs').find(row => row.id === result.prompt.scope.runId);
    assert.equal(r.engine.recordValue(run, 'CONTAMINATION_CHECK'), contamination);
    assert.equal(JSON.parse(r.ingestion.findRaw(p, result.rawResponseId).completeRawResponse).records.runs[0].fields.CONTAMINATION_CHECK, contamination);
    assert.equal(r.engine.gate(11, p).complete, contamination === 'NONE', 'ACCEPTED_RUN_FAILED_GATE_REMAINS_FAILED');
    assert.equal(r.engine.stageEntryState(p, 12).allowed, true, 'ACCEPTED_RUN_STAGE12_ENTRY');
    assert.equal(r.prompts.reserveAndBuildPromptRecord(r.copy(p), 12, {operation: 'VERIFY', scope: {runId: run.id}}).prompt.stage, 12);
    const lockSource = sources['app-core.js'].match(/function stageLocked\(n\)\{[^\n]+/)[0];
    assert.equal(new Function('current', 'engine', 'return (' + lockSource + ')(12)')(p, r.engine), '', 'ACCEPTED_RUN_UI_DIAGNOSTIC_ENTRY');
    assert.equal(p.job.CURRENT_STAGE, 'STAGE 12', 'ACCEPTED_RUN_CURRENT_STAGE');
    assert.throws(() => r.prompts.reserveAndBuildPromptRecord(r.copy(p), 11, {operation: 'EXECUTE_RUN', scope: r.copy(result.prompt.scope)}), error => error.code === 'SCOPE_TARGET_ALREADY_ACCEPTED', 'ACCEPTED_RUN_MUST_NOT_REEXECUTE');
    cases.push({caseId: contamination === 'NONE' ? 'clean-current-cohort' : 'accepted-contaminated-current-cohort', stage11Complete: r.engine.gate(11, p).complete, stage12EntryAllowed: true, actualStagedResponse: true, actualPackage: true, actualCommitReload: true, rawSha256: result.rawSha256});
    if (contamination === 'NONE') {
      const change = r.engine.acceptedChanges(p, 11).find(row => row.scope.runId === run.id);
      for (const [caseId, inject] of [
        ['clean-missing-accepted-proposal', state => { state.projectData.responseProposals = state.projectData.responseProposals.filter(row => row.proposalId !== change.proposalId); }],
        ['clean-canonical-raw-disagreement', state => { const row = state.projectData.runs.find(row => row.id === run.id); row.fields.COMPLETE_OUTPUT = row.COMPLETE_OUTPUT = 'SYNTHETIC_CHANGED_OUTPUT'; r.engine.refreshRecordHashes(row, 'runs'); }],
        ['clean-raw-envelope-disagreement', state => { const raw = state.projectData.rawResponses.find(row => row.rawResponseId === change.rawResponseId), envelope = JSON.parse(raw.completeRawResponse); envelope.records.runs[0].fields.COMPLETE_OUTPUT = 'SYNTHETIC_CHANGED_OUTPUT'; raw.completeRawResponse = JSON.stringify(envelope); raw.sha256 = r.runtime.closedLoopHash.sha256Text(raw.completeRawResponse); }]
      ]) {
        const state = r.copy(p); inject(state);
        assert.equal(r.engine.evaluateIteration(state, result.prompt.scope.iterationId, 'INITIAL').executionEvidenceComplete, false, 'ACCEPTED_RUN_CLEAN_RECEIPT_FAULT ' + caseId);
        assert.equal(r.engine.gate(11, state).complete, false, 'ACCEPTED_RUN_CLEAN_CORRUPTION_NOT_COMPLETE ' + caseId);
        r.engine.recalculate(state);
        assert.equal(r.engine.stageEntryState(state, 12).allowed, false, 'ACCEPTED_RUN_CLEAN_CORRUPTION_CANNOT_PROGRESS ' + caseId);
        cases.push({caseId, faultInjected: true, stage11Complete: false, stage12EntryAllowed: false, boundary: 'Gate and entry calculation on an isolated copy of an actually accepted clean cohort; no corrupted commit claim.'});
      }
    }
  }
  await checkpoint('accepted-contaminated-cohort');
  }
  const e = r.engine, schema = r.runtime.closedLoopWorkflowSchema;
  const initial = e.records(p, 'iterations').find(row => Number(row.stage) === 10), initialIterationId = initial.id, initialCandidateId = e.recordValue(initial, 'CANDIDATE_ID');
  const initialRuns = e.recordsForIteration(p, 'runs', initialIterationId), affected = initialRuns.find(row => e.recordValue(row, 'CONTAMINATION_CHECK') === 'CONTAMINATED');
  assert(affected);
  const initialRaw = plain(p.projectData.rawResponses.filter(row => row.stage === 11).map(row => ({rawResponseId: row.rawResponseId, sha256: row.sha256, text: row.completeRawResponse})));
  if (!retainedStage17Prefix) {
  assert.equal(e.initialRunDiagnosticState(p).determination, 'VIOLATED');
  assert.deepEqual(Array.from(e.initialRunDiagnosticState(p).affectedRunIds), [affected.id], 'ACCEPTED_RUN_AFFECTED_REFERENCE_PUBLISHED');
  assert.equal(e.stageEntryState(p, 18).allowed, false, 'ACCEPTED_RUN_NO_PREMATURE_CONVERGENCE');

  const accepted = e.acceptedChanges(p, 11).find(row => row.scope.runId === affected.id);
  const output = p.projectData.outputReceipts.find(row => row.acceptedCanonicalChangeId === accepted.changeId);
  const faults = [
    ['missing-accepted-change', state => { state.projectData.acceptedChanges = state.projectData.acceptedChanges.filter(row => row.changeId !== accepted.changeId); }],
    ['duplicate-accepted-change', state => state.projectData.acceptedChanges.push(r.copy(accepted))],
    ['missing-raw', state => { state.projectData.rawResponses = state.projectData.rawResponses.filter(row => row.rawResponseId !== accepted.rawResponseId); }],
    ['duplicate-raw', state => state.projectData.rawResponses.push(r.copy(state.projectData.rawResponses.find(row => row.rawResponseId === accepted.rawResponseId)))],
    ['missing-accepted-proposal', state => { state.projectData.responseProposals = state.projectData.responseProposals.filter(row => row.proposalId !== accepted.proposalId); }],
    ['duplicate-accepted-proposal', state => state.projectData.responseProposals.push(r.copy(state.projectData.responseProposals.find(row => row.proposalId === accepted.proposalId)))],
    ['wrong-proposal-status', state => { state.projectData.responseProposals.find(row => row.proposalId === accepted.proposalId).status = 'PENDING_OPERATOR_REVIEW'; }],
    ['wrong-proposal-envelope', state => { state.projectData.responseProposals.find(row => row.proposalId === accepted.proposalId).envelope.records.runs[0].fields.CONTAMINATION_CHECK = 'NONE'; }],
    ['canonical-raw-disagreement', state => { const run = state.projectData.runs.find(row => row.id === affected.id); run.fields.CONTAMINATION_CHECK = run.CONTAMINATION_CHECK = 'UNKNOWN'; e.refreshRecordHashes(run, 'runs'); }],
    ['missing-output-receipt', state => { state.projectData.outputReceipts = state.projectData.outputReceipts.filter(row => row.acceptedCanonicalChangeId !== accepted.changeId); }],
    ['duplicate-output-receipt', state => state.projectData.outputReceipts.push(r.copy(output))],
    ...Object.entries({jobId: 'FOREIGN-JOB', stage: 17, runId: initialRuns[0].id, iteration: 'FOREIGN-ITERATION', contextId: 'FOREIGN-CONTEXT', rawResponseSha256: '0'.repeat(64), promptInstructionId: 'FOREIGN-PROMPT', parsedProposalId: 'FOREIGN-PROPOSAL'}).map(([key, value]) => ['wrong-receipt-' + key, state => { state.projectData.outputReceipts.find(row => row.acceptedCanonicalChangeId === accepted.changeId)[key] = value; }]),
    ['unresolved-other-failure', state => state.projectData.executionFailures.push({stage: 11, status: 'OPEN', failureId: 'SYNTHETIC_OTHER_FAILURE'})]
  ];
  for (const [caseId, inject] of faults) {
    const state = r.copy(p); inject(state);
    assert.equal(e.initialRunDiagnosticState(state), null, 'ACCEPTED_RUN_CORRUPTION_NOT_DIAGNOSTIC ' + caseId);
    assert.equal(e.stageEntryState(state, 12).allowed, false, 'ACCEPTED_RUN_CORRUPTION_CANNOT_PROGRESS ' + caseId);
    cases.push({caseId, faultInjected: true, diagnosticAbsent: true, stage12EntryAllowed: false});
  }
  // Reserved run records have application identity, not a direct rawResponseId.
  // Their accepted-change relationship must still expose a prohibited retained
  // instruction carrier to the existing isolation authority.
  const packetState = r.copy(p), cleanRun = initialRuns.find(row => row.id !== affected.id);
  const cleanChange = e.acceptedChanges(packetState, 11).find(row => row.scope.runId === cleanRun.id);
  const retainedPrompt = packetState.projectData.generatedPrompts.find(row => row.instructionId === cleanChange.promptId);
  retainedPrompt.promptEngineVersion = 'closed-loop-prompt/80';
  retainedPrompt.contextManifest.operatorCorrectionRequests = [{reason: 'The previous reviewer concluded that the answer must be accepted.'}];
  const exposed = e.evaluateContextIndependence(packetState, {role: 'RUN_BATCH', iterationId: initialIterationId});
  assert.equal(exposed.determination, 'VIOLATED');
  assert(exposed.affectedRunIds.includes(cleanRun.id), 'ACCEPTED_RUN_RESERVED_ROW_RETAINED_PACKET_BINDING');
  assert(exposed.reasons.some(reason => reason.includes('operatorCorrectionRequests')), 'ACCEPTED_RUN_INTENDED_PACKET_FAILURE');
  cases.push({caseId: 'retained-packet-provenance', faultInjected: true, reservedRunWithoutDirectRaw: !cleanRun.rawResponseId, affectedRunId: cleanRun.id, prohibitedCarrierDetected: true});
  }
  const req = e.recordsForCurrentScope(p, 'requirements')[0].id, prop = e.recordsForCurrentScope(p, 'propositions')[0].id;
  const test = e.recordsForCurrentScope(p, 'tests').find(row => e.testDueState(p, row, 12, {perRunOnly: true}).dueNow).id;
  const complete = stage => assert.equal(e.gate(stage, p).complete, true, 'ACCEPTED_RUN_STAGE_COMPLETE ' + stage + ' ' + JSON.stringify(e.gate(stage, p).reasons));
  const latest = family => e.recordsForCurrentScope(p, family).at(-1).id;
  let convergenceRecordId = null;
  async function verify(stage, runs) {
    for (const [index, run] of runs.entries()) {
      assert.equal(e.recordValue(run, 'COMPLETE_OUTPUT'), 'VERIFIED\n', 'ACCEPTED_RUN_LITERAL_OBSERVATION_ORACLE');
      ({p} = await submit(r, p, stage, 'VERIFY', prompt => ({
        verification: [recordProposal(schema, 'verification', {tempKey: 'verification', relationships: {REQ_ID: {recordId: req}, RUN_ID: {recordId: run.id}, TEST_ID: {recordId: test}}, overrides: {VERIFIER: 'Synthetic distinct independent verifier', VERIFIER_CONTEXT_ID: prompt.scope.contextId, INPUTS: 'Exact accepted output: VERIFIED followed by one LF.', PROCEDURE: 'Compare the complete preserved output against the exact governing literal, including LF.', EXPECTED_RESULT: 'VERIFIED\n', OBSERVED_RESULT: 'VERIFIED\n', EXACT_EVIDENCE: 'Both exact strings contain the same nine UTF-8 bytes, including the terminal LF.', DETERMINATION: 'SATISFIED'}})],
        observationRecords: [recordProposal(schema, 'observationRecords', {tempKey: 'observation', relationships: {SUBJECT_ID: {recordId: test}}, overrides: {EXTERNAL_OR_AGENT_OBSERVED_VALUE: 'VERIFIED\n'}})],
        entailmentReviews: [recordProposal(schema, 'entailmentReviews', {tempKey: 'entailment', relationships: {OBSERVATION_ID: {tempKey: 'observation'}, TARGET_PROPOSITION_ID: {recordId: prop}}, overrides: {ENTAILMENT_FINDING: 'ESTABLISHES', REASONING: 'The complete observed literal equals the prescribed nine-byte content including LF.'}})]
      }), {runId: run.id}));
      if (e.verificationMatrix(p, e.recordValue(run, 'ITERATION_ID') || run.scope.iterationId).pending.length) {
        const before = JSON.stringify(p), continuation = r.ingestion.prepareStageContinuation(p, {stage, preview: true});
        assert(continuation, 'ACCEPTED_RUN_DIAGNOSTIC_CONTINUATION_AVAILABLE ' + stage);
        assert.equal(continuation.prompt?.operation || continuation.operation, 'VERIFY', 'ACCEPTED_RUN_CONTINUATION_VERIFY_SCOPE');
        assert.equal(JSON.stringify(p), before, 'ACCEPTED_RUN_CONTINUATION_PREVIEW_READ_ONLY');
      }
      if (stage === 19 && index === 0) assertConvergenceCurrent(r, p, convergenceRecordId, 'first-confirmation-verification-save-reload');
      onProgress({label: 'verify', stage, runId: run.id});
    }
  }
  const comparison = failed => recordProposal(schema, 'comparisons', {tempKey: 'comparison', relationships: {REQ_ID: {recordId: req}}, overrides: {RUN_DETERMINATIONS: 'The ten complete output strings each match the exact reviewed literal.', INTERPRETATION_VARIANCE: 'NONE', OUTPUT_VARIANCE: 'NONE', AUTHORIZED_VARIANCE: 'TRUE', INCONCLUSIVE_TESTS: 'NONE', REPEATED_FAILURE_PATTERNS: 'NONE', UNIQUE_FAILURES: failed ? 'The accepted initial run explicitly reports a contaminated context.' : 'NONE', CORRECTNESS_AFFECTING_VARIANCE: failed ? 'TRUE' : 'FALSE', DEFECT_IDS: 'NONE', EVIDENCE: 'Current independently accepted output observations and preserved run independence facts.'}});
  let correctedIterationId, correctedCandidateId, validationResultPreservation = null;
  if (!retainedStage17Prefix) {
  if (!retainedStage12Prefix) await verify(12, initialRuns);
  complete(12); await checkpoint('stage12-complete');
  const comparisonSubmission = await submit(r, p, 13, 'COMPARE', {comparisons: [comparison(true)], defects: [recordProposal(schema, 'defects', {tempKey: 'independence-defect', relationships: {REQ_ID: {recordId: req}, RUN_ID: {recordId: affected.id}}, overrides: {OBSERVED_FAILURE: 'The accepted run explicitly reports CONTAMINATED, preserved in its actual response.', EXPECTED_CONDITION: 'All ten accepted runs have uncontaminated fresh contexts.', EVIDENCE: 'The affected RUN_ID and its unchanged accepted raw response.', SEVERITY: 'MAJOR', STATUS: 'CONFIRMED'}})]});
  p=comparisonSubmission.p;validationResultPreservation=comparisonSubmission.validationResultPreservation;
  complete(13); const defect = latest('defects');
  ({p} = await submit(r, p, 14, 'ROOT_CAUSE', {rootCauses: [recordProposal(schema, 'rootCauses', {tempKey: 'root-cause', relationships: {DEFECT_ID: {recordId: defect}}, overrides: {CATEGORY: 'EXECUTION', LAYER_TRACE: 'Frozen candidate -> external execution context -> accepted output.', EARLIEST_DEFECTIVE_LAYER: 'EXECUTION', ROOT_CAUSE: 'The synthetic initial execution reports a contaminated context; correct candidate bytes do not repair that execution.', EVIDENCE: 'Accepted run declaration and preserved response bytes.', DOWNSTREAM_INVALIDATION: 'Require a permanent regression and a distinct corrected ten-run iteration.'}})]}));
  complete(14); await checkpoint('stage14-complete');
  assert.equal(e.evaluateIteration(p, initialIterationId, 'INITIAL').independence.determination, 'VIOLATED');
  ({p} = await submit(r, p, 15, 'COMPLETE', {regressions: [recordProposal(schema, 'regressions', {tempKey: 'regression', relationships: {DEFECT_ID: {recordId: defect}, REQ_ID: {recordId: req}}, overrides: {FAILURE_FIXTURE: 'The exact retained initial run ' + affected.id + ' with its accepted CONTAMINATED response.', REPRODUCTION_PROCEDURE: 'Evaluate the preserved initial ten-run cohort and inspect its explicit contamination finding.', DETECTION_METHOD: 'Compare current cohort independence against the required uncontaminated context condition.', CORRECTION: 'Use a distinct corrected iteration with ten new independent contexts.', PERMANENT_TEST_LOCATION: 'Synthetic controlled immediate regression registry', APPLICABILITY: 'APPLICABLE'}})], regressionExecutions: [recordProposal(schema, 'regressionExecutions', {tempKey: 'pre-correction', relationships: {REG_ID: {tempKey: 'regression'}, ITERATION_ID: {recordId: initialIterationId}, CANDIDATE_ID: {recordId: initialCandidateId}}, overrides: {PHASE: 'PRE_CORRECTION', RESULT: 'VIOLATED'}})]}));
  complete(15); const regression = latest('regressions');
  ({p} = await submit(r, p, 16, 'CORRECT', {changes: [recordProposal(schema, 'changes', {tempKey: 'correction', overrides: {TRIGGERING_DEFECT_IDS: defect, ROOT_CAUSE_ANALYSIS: 'The accepted execution-layer RCA.', RESPONSIBLE_LAYER: 'EXECUTION', OLD_ARTIFACT_VERSION: 'execution-context-v1', EXACT_MODIFICATION: 'Use ten fresh contexts in a distinct corrected iteration while preserving the correct governing instruction.', NEW_ARTIFACT_VERSION: 'execution-context-v2', DOWNSTREAM_INVALIDATION: 'Stages17–30 require new current evidence.', REQUIRED_RERUNS: 'Complete corrected ten-run iteration and verification.', INSTRUCTION_CHANGE_DETERMINATION: 'UNCHANGED', REQUIRED_REPEATED_PREFLIGHT: 'NOT REQUIRED', JUSTIFIED_UNCHANGED_ARTIFACTS: 'The execution-only defect does not change the correct frozen instruction.', EVIDENCE: 'Accepted RCA and reproduced preserved negative regression.'}})]}));
  complete(16); await checkpoint('stage16-complete');
  const draft = r.copy(p), componentIds = e.recordValue(e.records(draft, 'candidateFreezes').find(row => row.id === initialCandidateId), 'COMPONENT_MANIFEST').map(row => row.artifactId);
  const selection = e.recordRegisteredHumanDecision(draft, {stage: 17, purpose: 'CANDIDATE_COMPONENT_SELECTION', targetFamily: 'artifacts', targetId: r.runtime.closedLoopHash.sha256Value(r.copy(componentIds)), value: r.copy(componentIds), operatorLabel: 'SYNTHETIC_CORRECTION_OPERATOR'});
  const frozen = e.freezeCandidate(draft, {stage: 17, artifactIds: componentIds, selectionDecisionId: selection.id, operatorLabel: 'SYNTHETIC_CORRECTION_OPERATOR'});
  correctedIterationId = frozen.iteration.id; correctedCandidateId = frozen.candidate.id;
  assert.notEqual(correctedIterationId, initialIterationId); assert.notEqual(correctedCandidateId, initialCandidateId);
  p = await save(r, p, draft);
  for (let index = 0; index < 10; index++) { ({p} = await submit(r, p, 17, 'EXECUTE_RUN', runRecords(r, 'NONE'))); onProgress({label: 'corrected-run', accepted: index + 1}); }
  await verify(17, e.recordsForIteration(p, 'runs', correctedIterationId));
  ({p} = await submit(r, p, 17, 'COMPARE', {comparisons: [comparison(false)]}));
  assert.equal(e.evaluateIteration(p, correctedIterationId, 'CORRECTED').independence.determination, 'APPLICATION_ESTABLISHED');
  ({p} = await submit(r, p, 17, 'REGRESSION', {regressionExecutions: [recordProposal(schema, 'regressionExecutions', {tempKey: 'post-correction', relationships: {REG_ID: {recordId: regression}, ITERATION_ID: {recordId: correctedIterationId}, CANDIDATE_ID: {recordId: correctedCandidateId}}, overrides: {PHASE: 'POST_CORRECTION', RESULT: 'SATISFIED'}})]}));
  } else {
    const corrected = e.records(p, 'iterations').filter(row => Number(row.stage) === 17 && row.active !== false && !row.invalidatedBy).at(-1);
    correctedIterationId = corrected.id; correctedCandidateId = e.recordValue(corrected, 'CANDIDATE_ID');
    assert.notEqual(correctedIterationId, initialIterationId); assert.notEqual(correctedCandidateId, initialCandidateId);
    assert.equal(e.recordsForIteration(p, 'runs', correctedIterationId).length, 10);
    assert.equal(e.verificationMatrix(p, correctedIterationId).expected.length, 10);
  }
  complete(17); await checkpoint('stage17-complete'); assert.equal(e.gate(11, p).complete, false, 'ACCEPTED_RUN_ORIGINAL_FAILURE_PRESERVED');
  assert.equal(e.stageEntryState(p, 18).allowed, true, 'ACCEPTED_RUN_VERIFIED_CORRECTED_DESCENDANT');
  const beforeConvergence = r.copy(p), convergence = r.copy(p);
  convergenceRecordId = e.recordConvergence(convergence).id;
  p = await save(r, p, convergence); p = await r.store.readProject(p.job.JOB_ID);
  const afterConvergence = r.copy(p);
  assertConvergenceCurrent(r, p, convergenceRecordId, 'convergence-save-reload');
  complete(18); assert.equal(e.stageEntryState(p, 19).allowed, true);
  assert.equal(e.workflowCompletionState(p), false, 'ACCEPTED_RUN_CONVERGENCE_NOT_TERMINAL');
  const progress = e.workflowProgressState(p);
  assert.equal(progress.completedStageCount, 17, 'ACCEPTED_RUN_ACTUAL_COMPLETED_COUNT');
  assert.equal(progress.accountedStageCount, 18, 'ACCEPTED_RUN_RESOLVED_HISTORY_ACCOUNTING');
  assert.deepEqual(plain(progress.resolvedHistoricalStages), [{stage: 11, resolvedByStage: 17, resolvedByIterationId: correctedIterationId}]);
  assert.deepEqual(plain(p.projectData.rawResponses.filter(row => row.stage === 11).map(row => ({rawResponseId: row.rawResponseId, sha256: row.sha256, text: row.completeRawResponse}))), initialRaw, 'ACCEPTED_RUN_CORRECTION_RAW_HISTORY_PRESERVED');
  await checkpoint('stage18-complete');
  const confirmationDraft = r.copy(p), confirmation = e.beginUnchangedConfirmationIteration(confirmationDraft, {candidateId: correctedCandidateId, operatorLabel: 'SYNTHETIC_CORRECTION_OPERATOR'});
  const confirmationIterationId = confirmation.id;
  assert.notEqual(confirmationIterationId, correctedIterationId);
  assert.equal(e.recordValue(confirmation, 'CANDIDATE_ID'), correctedCandidateId, 'ACCEPTED_RUN_CONFIRMATION_PRESERVES_EXACT_CANDIDATE');
  p = await save(r, p, confirmationDraft);
  p = await r.store.readProject(p.job.JOB_ID);
  assertConvergenceCurrent(r, p, convergenceRecordId, 'confirmation-preparation-save-reload');
  const convergenceDerivationTransition = verifyConvergenceDerivationTransition({r, beforeConvergence, afterConvergence, afterConfirmationPreparation: p});
  for (let index = 0; index < 10; index++) {
    ({p} = await submit(r, p, 19, 'EXECUTE_RUN', runRecords(r, 'NONE')));
    if (index === 0) assertConvergenceCurrent(r, p, convergenceRecordId, 'first-confirmation-run-save-reload');
    onProgress({label: 'confirmation-run', accepted: index + 1});
    if (index === 8) await checkpoint('nine-confirmation-runs');
  }
  // The positive branch below accepts later ESTABLISHES without changing the
  // prior receipt. This isolated accepted-response branch supplies the opposite
  // semantic result through the same real public transport, never a forged row.
  {
    const prefix=snapshot(r,p,sources),{r:negativeRuntime,p:negativeProject}=await restore(prefix,sources),ne=negativeRuntime.engine;
    const run=ne.recordsForIteration(negativeProject,'runs',confirmationIterationId)[0];
    const accepted=await submit(negativeRuntime,negativeProject,19,'VERIFY',prompt=>({
      verification:[recordProposal(schema,'verification',{tempKey:'verification',relationships:{REQ_ID:{recordId:req},RUN_ID:{recordId:run.id},TEST_ID:{recordId:test}},overrides:{VERIFIER:'Synthetic independent adverse verifier',VERIFIER_CONTEXT_ID:prompt.scope.contextId,INPUTS:'Current run output under the reviewed literal comparison.',PROCEDURE:'Report a controlled contrary observation in the negative branch.',EXPECTED_RESULT:'VERIFIED\n',OBSERVED_RESULT:'CONTROLLED FAILURE\n',EXACT_EVIDENCE:'The synthetic adverse observation differs from the required literal.',DETERMINATION:'VIOLATED'}})],
      observationRecords:[recordProposal(schema,'observationRecords',{tempKey:'observation',relationships:{SUBJECT_ID:{recordId:test}},overrides:{EXTERNAL_OR_AGENT_OBSERVED_VALUE:'CONTROLLED FAILURE\n'}})],
      entailmentReviews:[recordProposal(schema,'entailmentReviews',{tempKey:'entailment',relationships:{OBSERVATION_ID:{tempKey:'observation'},TARGET_PROPOSITION_ID:{recordId:prop}},overrides:{ENTAILMENT_FINDING:'REFUTES',REASONING:'The controlled current observation does not meet the required literal.'}})]
    }),{runId:run.id});
    const adverse=accepted.p;
    if(onCheckpoint)await onCheckpoint({label:'stage19-adverse-accepted-before-assertion',r:negativeRuntime,p:adverse,sources,snapshot:snapshot(negativeRuntime,adverse,sources)});
    // §29.11: this retained scenario's reviewed proposition has only a
    // final-product leaf due22. Its standalone per-run observation is not an
    // earlier governing proof, even when an accepted review says REFUTES.
    assert.equal(ne.currentIterationRefutationSources(adverse,[prop],18).length,0,'ITERATION_FUTURE_ONLY_REFUTATION_NOT_EARLY_PROOF');
    const old=adverse.projectData.convergenceRecords.find(row=>row.id===convergenceRecordId);
    assert.equal(ne.convergenceRecordCurrent(adverse,old),true,'ITERATION_NONGOVERNING_LATER_EVIDENCE_PRESERVES_RECEIPT');
    assert.equal(JSON.stringify(old.derivationReceipt),JSON.stringify(p.projectData.convergenceRecords.find(row=>row.id===convergenceRecordId).derivationReceipt));
    assert.equal(ne.gate(18,adverse).complete,true);
    assert.equal(ne.gate(19,adverse).complete,false,'ITERATION_ADVERSE_CONFIRMATION_NOT_COMPLETE');
    if(onCheckpoint)await onCheckpoint({label:'stage19-accepted-nongoverning-refutation',r:negativeRuntime,p:adverse,sources,snapshot:snapshot(negativeRuntime,adverse,sources)});
    cases.push({caseId:'later-accepted-future-only-refutation-preserves-earlier-proof',passed:true,actualAcceptedResponse:true,actualSaveColdRead:true,synthetic:true});
  }
  await verify(19, e.recordsForIteration(p, 'runs', confirmationIterationId));
  const matrix = e.verificationMatrix(p, confirmationIterationId);
  assert.equal(matrix.runs.length, 10);
  assert.equal(matrix.expected.length, 10);
  assert.equal(matrix.missing.length + matrix.invalid.length + matrix.duplicates.length, 0);
  assert.equal(e.recordsForIteration(p, 'comparisons', confirmationIterationId).length, 0);
  assert.equal(e.stageEntryState(p, 19).allowed, true);
  assert.equal(e.gate(19, p).complete, false, 'ACCEPTED_RUN_CONFIRMATION_PENDING_COMPARISON_IS_NOT_COMPLETE');
  await checkpoint('stage19-before-comparison');
  // Branch only from the actual source-bound saved cohort. The clean path must
  // still perform regression verification; it cannot reuse the adverse branch
  // or turn a material defect into a successful confirmation.
  const originalBeforeClean = r.runtime.closedLoopHash.sha256Value(p);
  const cleanBranch = await restore(snapshot(r, p, sources), sources), cleanRuntime = cleanBranch.r;
  let cleanProject = cleanBranch.p;
  ({p: cleanProject} = await submit(cleanRuntime, cleanProject, 19, 'COMPARE', {
    comparisons: [comparison(false)],
    semanticReviews: [recordProposal(schema, 'semanticReviews', {tempKey: 'requirement-discovery', overrides: {REVIEW_QUESTION: 'Does the full governing input set require additional requirements?', FINDING: 'No new requirement is discovered in this synthetic clean comparison.', REASONING: 'Compare the preserved governing inputs with the current requirement set and exact verified outputs.', RESULT: 'ACCEPTED'}})]
  }));
  const cleanAction = cleanRuntime.engine.operationalNextAction(cleanProject, 19);
  assert.equal(cleanAction.failedConfirmationReturn, undefined, 'CONFIRMATION_CLEAN_ACCEPTED_COMPARISON_HAS_NO_RETURN_ACTION');
  assert.equal(cleanAction.operation, 'REGRESSION_VERIFY', 'CONFIRMATION_CLEAN_ACCEPTED_COMPARISON_REQUIRES_REGRESSION');
  const cleanRegs = cleanRuntime.engine.records(cleanProject, 'regressions').filter(row => cleanRuntime.engine.recordValue(row, 'ACTIVE_RETIRED_STATE') !== 'RETIRED');
  ({p: cleanProject} = await submit(cleanRuntime, cleanProject, 19, 'REGRESSION_VERIFY', {regressionExecutions: cleanRegs.map((row, index) => recordProposal(schema, 'regressionExecutions', {tempKey: 'clean-prior-regression-' + index, relationships: {REG_ID: {recordId: row.id}, ITERATION_ID: {recordId: confirmationIterationId}, CANDIDATE_ID: {recordId: correctedCandidateId}}, overrides: {PHASE: 'UNCHANGED_CONFIRMATION', RESULT: 'SATISFIED'}}))}));
  assert.equal(cleanRuntime.engine.operationalNextAction(cleanProject, 19).actionType, 'CALCULATE_UNCHANGED_CONFIRMATION', 'CONFIRMATION_CLEAN_REGRESSION_PERMITS_CALCULATION');
  const cleanDraft = cleanRuntime.copy(cleanProject); cleanRuntime.engine.recordUnchangedConfirmation(cleanDraft);
  cleanProject = await save(cleanRuntime, cleanProject, cleanDraft); cleanProject = await cleanRuntime.store.readProject(cleanProject.job.JOB_ID);
  assert.equal(cleanRuntime.engine.gate(19, cleanProject).complete, true, 'CONFIRMATION_CLEAN_REGRESSION_COMPLETES_AFTER_SAVE_RELOAD');
  assert.equal(r.runtime.closedLoopHash.sha256Value(p), originalBeforeClean, 'CONFIRMATION_CLEAN_BRANCH_PRESERVES_ADVERSE_INPUT');
  const cleanConfirmationContinuation = {passed: true, actualAcceptedResponse: true, actualSaveColdRead: true, synthetic: true, actualBrowser: false, nextOperation: cleanAction.operation, regressionExecutions: cleanRegs.length, stage19Complete: true, originalBranchPreserved: true};
  if (onCheckpoint) await onCheckpoint({label: 'stage19-clean-confirmation-complete', r: cleanRuntime, p: cleanProject, sources, snapshot: snapshot(cleanRuntime, cleanProject, sources)});
  onProgress({label: 'stage19-clean-confirmation-complete', revision: cleanProject.revision});
  const failedConfirmationReturn = await verifyFailedConfirmationReturn({r, p, onProgress});
  return {validationResultPreservation, cleanConfirmationContinuation, failedConfirmationReturn, passed: true, synthetic: true, actualBrowser: false, physicalDeviceAcceptance: false, earlierCompleteFlagsForced: false, canonicalRunMutation: false, startedAt, finishedAt: new Date().toISOString(), elapsedMs: performance.now() - started, sourceSha256, retainedPreparationSourceSha256: retainedProducerSources ? Object.fromEntries(Object.entries(retainedProducerSources).map(([file, source]) => [file, sha(source)])) : null, retainedStage17Identity: retainedStage17Prefix ? {revision: retainedStage17Prefix.revision, projectSha256: retainedStage17Prefix.projectSha256, sourceSha256: retainedStage17Prefix.sourceSha256} : null, executedBoundary: retainedStage17Prefix ? 'stage17-to-stage19-and-failed-confirmation-return' : 'existing-owner-journey', excludedRetainedPrefix: retainedStage17Prefix ? 'Stages1–17 execution and prefix-only fault controls are retained prerequisites, not executed by this run.' : null, fullJourneyExecution: !retainedStage17Prefix && !retainedStage12Prefix && !retainedNineRunPrefix, retainedBoundary: retainedStage17Prefix ? 'stage17-complete' : retainedStage12Prefix ? 'stage12-complete' : retainedNineRunPrefix ? 'nine-initial-runs' : null, prerequisiteSha256, decodedPrerequisiteSha256, cases, initialIterationId, correctedIterationId, confirmationIterationId, initialCandidateId, correctedCandidateId, stages12Through18: [12, 13, 14, 15, 16, 17, 18].map(stage => ({stage, complete: e.gate(stage, p).complete})), stage11Complete: false, stage19EntryAllowed: true, confirmationRuns: 10, confirmationVerifications: 10, confirmationComparisonPending: true, convergenceDerivationTransition, convergenceSurvivesFirstConfirmationRun: true, convergenceSurvivesFirstConfirmationVerification: true, actualAdapterSaveReload: true, originalRawPreserved: true, boundary: 'Retained original Stage1–10 operator prerequisite and, where explicitly identified, actual previously completed source-bound diagnostic prefix. Actual saved ZIP, staged response, admission, explicit acceptance, transaction-adapter save/reload through the corrected and unchanged-confirmation cohorts. Synthetic external actors; no browser or physical-device acceptance claim.'};
}


// Separate source-authored single-leaf preproduct scenario supplied by the full
// lifecycle owner. All runs, observations and relations use public acceptance.
export async function verifyAcceptedGoverningRefutation({sourceProject,artifacts,sourcePrompts,propositionId,testId,onCheckpoint}) {
  const sources=Object.fromEntries([...runtimeFiles,'verify-full-cycle.mjs','test-accepted-run-correction-journey.mjs'].map(file=>[file,fs.readFileSync(file,'utf8')]));
  const negativeRuntime=projectStoreRuntime({storageWorker:false}),ne=negativeRuntime.engine,schema=negativeRuntime.runtime.closedLoopWorkflowSchema;
  await restoreArtifactFixture(negativeRuntime.store,artifacts);
  let adverse=negativeRuntime.copy(sourceProject);const originalCanonicalSha=negativeRuntime.runtime.closedLoopHash.sha256Value(adverse),originalRaw=plain(adverse.projectData.rawResponses),originalConvergence=plain(adverse.projectData.convergenceRecords),originalHistory=plain(adverse.projectData.history);
  for(const original of sourceProject.projectData.generatedPrompts){const row=adverse.projectData.generatedPrompts.find(row=>row.instructionId===original.instructionId);negativeRuntime.prompts.retainPromptContextFiles(row,negativeRuntime.copy(sourcePrompts.materializePromptContextFiles(original)));await negativeRuntime.store.persistPromptContextFiles(row,adverse);}
  assert.equal(negativeRuntime.runtime.closedLoopHash.sha256Value(adverse),originalCanonicalSha,'GOVERNED_CONTEXT_PERSISTENCE_PRESERVES_PROJECT');
  adverse=await negativeRuntime.store.writeProject(adverse,{createOnly:true,expectedProjectRevision:0,incrementRevision:false});
  adverse=await negativeRuntime.store.readProject(adverse.job.JOB_ID);
  const capture=async label=>{if(onCheckpoint)await onCheckpoint({label,r:negativeRuntime,p:adverse,sources,snapshot:snapshot(negativeRuntime,adverse,sources)});};
  await capture('governed19-initial-public-save');
  assert.equal(negativeRuntime.store.validateProjectIntegrity(adverse).valid,true,'GOVERNED_INITIAL_PUBLIC_SAVE_INTEGRITY');assert.deepEqual(plain(adverse.projectData.rawResponses),originalRaw,'GOVERNED_INITIAL_SAVE_PRESERVES_RAW');assert.deepEqual(plain(adverse.projectData.convergenceRecords),originalConvergence,'GOVERNED_INITIAL_SAVE_PRESERVES_PRIOR_PROOF');assert.deepEqual(plain(adverse.projectData.history.slice(0,originalHistory.length)),originalHistory,'GOVERNED_INITIAL_SAVE_PRESERVES_HISTORY');
  const prop=propositionId,test=ne.records(adverse,'tests').find(row=>row.id===testId),req=ne.recordValue(test,'REQ_ID');
  const governingConvergence=ne.recordsForScope(adverse,'convergenceRecords',ne.convergenceCalculation(adverse).scope).at(-1);assert(governingConvergence&&ne.convergenceRecordCurrent(adverse,governingConvergence),'GOVERNED_CURRENT_SOURCE_CONVERGENCE');const convergenceRecordId=governingConvergence.id;
  const receiptBefore=JSON.stringify(adverse.projectData.convergenceRecords.find(row=>row.id===convergenceRecordId).derivationReceipt);
  const iteration19=ne.records(adverse,'iterations').filter(row=>Number(row.stage)===19).at(-1);assert(iteration19);assert.equal(ne.recordsForIteration(adverse,'runs',iteration19.id).length,0,'GOVERNED_BRANCH_REQUIRES_EMPTY19');assert.equal(ne.gate(18,adverse).complete,true);assert.equal(ne.stageEntryState(adverse,19).allowed,true);
  const schedule=ne.deriveLeafTimingSchedule(adverse,prop);
  assert.equal(schedule.resolved,true);assert.equal(schedule.entries.length,1);assert.equal(schedule.entries[0].SOURCE_ID,testId);const pendingDue=ne.testDueState(adverse,test,18,{perRunOnly:true});assert.equal(pendingDue.valid,true);assert.equal(pendingDue.phaseEligible,true);assert(pendingDue.requiredByStage<=18);assert.equal(pendingDue.targetAvailability,'FALSE');assert.equal(pendingDue.dueNow,false);
  try {
    await capture('governed19-before-isolated-runs');
    const outputRows=[];
    for(const output of ['complete-output-controlled-support','controlled-output-without-prefix']){
      const result=await submit(negativeRuntime,adverse,19,'EXECUTE_RUN',prompt=>({runs:[recordProposal(schema,'runs',{targetId:prompt.scope.runId,overrides:{FRESH_CONTEXT_RECORD:prompt.scope.contextId,CONTAMINATION_CHECK:'NONE',TOOL_CONFIGURATION:'Synthetic isolated controlled executor',EXECUTION_STATUS:'COMPLETED',COMPLETE_OUTPUT:output}})]}));
      adverse=result.p;
      const run=ne.records(adverse,'runs').find(row=>ne.recordValue(row,'COMPLETE_OUTPUT')===output);assert(run);outputRows.push({run,output});
    }
    const reservedRuns=ne.recordsForIteration(adverse,'runs',iteration19.id);assert.equal(reservedRuns.length,10,'GOVERNED_BRANCH_NORMAL_TEN_SLOT_RESERVATION');assert.deepEqual(Array.from(reservedRuns.filter(row=>ne.recordValue(row,'EXECUTION_STATUS')==='COMPLETED'),row=>ne.recordValue(row,'COMPLETE_OUTPUT')).sort(),outputRows.map(row=>row.output).sort(),'GOVERNED_BRANCH_EXACT_TWO_COMPLETED_RUNS');assert.equal(reservedRuns.filter(row=>ne.recordValue(row,'EXECUTION_STATUS')==='RESERVED'&&ne.recordValue(row,'COMPLETE_OUTPUT')==='').length,8,'GOVERNED_BRANCH_REMAINING_EIGHT_UNEXECUTED');assert.equal(ne.testDueState(adverse,test,18,{perRunOnly:true}).dueNow,true,'GOVERNED_DUE_AFTER_ACTUAL_RUN_TARGET');
    await capture('governed19-before-accepted-observations');
    for(const [index,{run,output}] of outputRows.entries()){
      const supported=output.startsWith('complete-output-');assert.equal(supported,index===0);
      const result=await submit(negativeRuntime,adverse,19,'VERIFY',prompt=>({
        verification:[recordProposal(schema,'verification',{tempKey:'verification',relationships:{REQ_ID:{recordId:req},RUN_ID:{recordId:run.id},TEST_ID:{recordId:testId}},overrides:{VERIFIER:'Synthetic independent exact-prefix verifier',VERIFIER_CONTEXT_ID:prompt.scope.contextId,INPUTS:output,PROCEDURE:'Compare the initial characters of the preserved output text with the exact literal complete-output-.',EXPECTED_RESULT:'complete-output-',OBSERVED_RESULT:output,EXACT_EVIDENCE:'Actual preserved controlled run output: '+output,DETERMINATION:supported?'SATISFIED':'VIOLATED'}})],
        observationRecords:[recordProposal(schema,'observationRecords',{tempKey:'observation',relationships:{SUBJECT_ID:{recordId:testId}},overrides:{EXTERNAL_OR_AGENT_OBSERVED_VALUE:output}})],
        entailmentReviews:[recordProposal(schema,'entailmentReviews',{tempKey:'entailment',relationships:{OBSERVATION_ID:{tempKey:'observation'},TARGET_PROPOSITION_ID:{recordId:prop}},overrides:{ENTAILMENT_FINDING:supported?'ESTABLISHES':'REFUTES',REASONING:supported?'The preserved output starts with the exact required prefix.':'The preserved output lacks the exact required prefix.'}})]
      }),{runId:run.id});adverse=result.p;
      await capture(supported?'governed19-accepted-support':'governed19-accepted-refutation-before-assertions');
      if(supported){assert.equal(ne.currentIterationRefutationSources(adverse,[prop],18).length,0);assert.equal(ne.convergenceRecordCurrent(adverse,adverse.projectData.convergenceRecords.find(row=>row.id===convergenceRecordId)),true);assert.equal(JSON.stringify(adverse.projectData.convergenceRecords.find(row=>row.id===convergenceRecordId).derivationReceipt),receiptBefore);}
    }
    const closure=ne.currentIterationRefutationSources(adverse,[prop],18);
    assert.equal(closure.length,1,'ITERATION_LATER_ACTUALLY_ACCEPTED_REFUTATION');
    assert.equal(Number(closure[0].review.stage),19,'GOVERNED_CURRENT19_REFUTATION');assert.equal(closure[0].review.scope.iterationId,iteration19.id);
    assert.equal(ne.entailmentMetadataCurrent(adverse,closure[0].review),true,'ITERATION_REFUTATION_ACCEPTED_TRANSPORT_CURRENT');
    const old=adverse.projectData.convergenceRecords.find(row=>row.id===convergenceRecordId),oldReceipt=JSON.stringify(old.derivationReceipt);
    assert.equal(ne.convergenceRecordCurrent(adverse,old),false,'ITERATION_LATER_REFUTATION_STALES_OLD_RECEIPT');
    assert.equal(ne.gate(18,adverse).complete,false,'ITERATION_LATER_REFUTATION_BLOCKS_STAGE18');
    const calculated=ne.convergenceCalculation(adverse);
    assert.equal(calculated.fields.CONVERGED,'FALSE','ITERATION_REFUTATION_FRESH_CALCULATION_NEGATIVE');
    assert(calculated.failedConditions.includes('MANDATORY_PROPOSITION_REFUTATION'));
    const derived=ne.deriveStageData(adverse,18);
    assert.equal(derived.ALL_CONDITIONS_SIMULTANEOUSLY_TRUE,false,'ITERATION_REFUTATION_DISPLAY_MATCHES_CANONICAL');
    assert(String(derived.FAILED_CONDITIONS).includes('MANDATORY_PROPOSITION_REFUTATION'));
    const recalculated=negativeRuntime.copy(adverse),fresh=ne.recordConvergence(recalculated);
    assert.equal(fresh.fields.CONVERGED,'FALSE','ITERATION_REFUTATION_NORMAL_RERECORD_NEGATIVE');
    assert.equal(JSON.stringify(recalculated.projectData.convergenceRecords.find(row=>row.id===old.id).derivationReceipt),oldReceipt,'ITERATION_REFUTATION_HISTORY_RECEIPT_PRESERVED');
    assert.equal(ne.gate(18,recalculated).complete,false);
    const freshConfirmation=ne.recordUnchangedConfirmation(negativeRuntime.copy(adverse));
    assert.equal(freshConfirmation.fields.DETERMINATION,'UNDETERMINED','ITERATION_REFUTATION_NORMAL_RECONFIRM_NEGATIVE');
    for(const [name,edit]of [
      ['unaccepted-proposal',state=>{state.projectData.responseProposals=state.projectData.responseProposals.filter(row=>row.proposalId!==closure[0].review.sourceProposalId);}],
      ['missing-raw',state=>{state.projectData.rawResponses=state.projectData.rawResponses.filter(row=>row.rawResponseId!==closure[0].review.rawResponseId);}],
      ['expired-observation',state=>{const row=state.projectData.observationRecords.find(row=>row.id===closure[0].observation.id);row.fields.FRESHNESS_STATUS=row.FRESHNESS_STATUS='EXPIRED';ne.refreshRecordHashes(row,'observationRecords');}],
      ['foreign-candidate',state=>{state.projectData.entailmentReviews.find(row=>row.id===closure[0].review.id).scope.candidateId='FOREIGN-CANDIDATE';}]
    ]){const changed=negativeRuntime.copy(adverse);edit(changed);assert.equal(ne.currentIterationRefutationSources(changed,[prop],18).length,0,'ITERATION_UNADMITTED_REFUTATION_NOT_TRUTH: '+name);assert.equal(ne.gate(19,changed).complete,false,'ITERATION_MISSING_REQUIRED_PROOF_STILL_BLOCKS: '+name);}

    const currentSupport=ne.records(adverse,'entailmentReviews').filter(row=>row.stage===19&&ne.recordValue(row,'TARGET_PROPOSITION_ID')===prop&&ne.recordValue(row,'ENTAILMENT_FINDING')==='ESTABLISHES'&&ne.entailmentMetadataCurrent(adverse,row));
    assert.equal(currentSupport.length,1,'ITERATION_ACCEPTED_SUPPORT_AND_REFUTATION_COEXIST');
    await capture('governed19-refutation-controls-complete');
    return {passed:true,synthetic:true,actualBrowser:false,actualAcceptedResponse:true,actualSaveColdRead:true,acceptedSupport:1,acceptedRefutation:1,cohortComplete:false,caseId:'later-accepted-refutation-stales-and-blocks-fresh-calculations',sourceSha256:Object.fromEntries(Object.entries(sources).map(([file,source])=>[file,sha(source)]))};
  } catch(error){await capture('governed19-failure');throw error;}
}

// Reuse the owning journey's actual completed confirmation cohort. This tests
// corrective return through storage without executing another ten-run batch.
export async function verifyFailedConfirmationReturn({r, p, alreadyCompared = false, onProgress = () => {}, onCheckpoint = null}) {
  const e = r.engine, schema = r.runtime.closedLoopWorkflowSchema;
  const confirmation = e.records(p, 'iterations').filter(row => Number(row.stage) === 19).at(-1), iterationId = confirmation.id;
  const candidateId = e.recordValue(confirmation, 'CANDIDATE_ID'), req = e.recordsForCurrentScope(p, 'requirements')[0].id;
  const runs = e.recordsForIteration(p, 'runs', iterationId), matrix = e.verificationMatrix(p, iterationId);
  assert.equal(runs.length, 10); assert.equal(matrix.expected.length, 10); assert.equal(matrix.missing.length + matrix.invalid.length + matrix.duplicates.length, 0);
  assert(runs.every(row => e.recordValue(row, 'CONTAMINATION_CHECK') === 'NONE'));
  const originalRuns = plain(runs), originalRaw = plain(p.projectData.rawResponses.map(row => ({rawResponseId: row.rawResponseId, sha256: row.sha256, text: row.completeRawResponse})));
  const checkpoint = async label => {if (onCheckpoint) await onCheckpoint({label, r, p}); onProgress({label, revision: p.revision});};
  if (!alreadyCompared) {
    assert.equal(e.confirmationCorrectionSubject(p), null, 'CONFIRMATION_CLEAN_COHORT_HAS_NO_RETURN_SUBJECT');
    assert.equal(e.operationalNextAction(p, 19).failedConfirmationReturn, undefined, 'CONFIRMATION_CLEAN_COHORT_HAS_NO_RETURN_ACTION');
    const clean = r.prompts.reserveAndBuildPromptRecord(r.copy(p), 14, {operation: 'ROOT_CAUSE'}).prompt;
    assert.equal(clean.scope.iterationId, e.records(p, 'iterations').find(row => Number(row.stage) === 10).id, 'CONFIRMATION_CLEAN_LATER_COHORT_RETAINS_INITIAL_SUBJECT');
    ({p} = await submit(r, p, 19, 'COMPARE', {
      comparisons: [recordProposal(schema, 'comparisons', {tempKey: 'confirmation-comparison', relationships: {REQ_ID: {recordId: req}}, overrides: {RUN_DETERMINATIONS: 'Ten independently verified exact literal outputs are retained.', INTERPRETATION_VARIANCE: 'NONE', OUTPUT_VARIANCE: 'NONE', AUTHORIZED_VARIANCE: 'TRUE', INCONCLUSIVE_TESTS: 'NONE', REPEATED_FAILURE_PATTERNS: 'NONE', UNIQUE_FAILURES: 'Synthetic material confirmation defect.', CORRECTNESS_AFFECTING_VARIANCE: 'TRUE', DEFECT_IDS: 'NONE', EVIDENCE: 'Synthetic accepted comparison finding against the preserved confirmed output cohort.'}})],
      defects: [recordProposal(schema, 'defects', {tempKey: 'confirmation-defect', relationships: {REQ_ID: {recordId: req}, RUN_ID: {recordId: runs[0].id}}, overrides: {OBSERVED_FAILURE: 'Synthetic correctness-affecting confirmation execution variance.', EXPECTED_CONDITION: 'No unexplained correctness-affecting confirmation variance.', EVIDENCE: 'Current independently verified confirmation outputs compared under the frozen variance contract.', SEVERITY: 'MAJOR', STATUS: 'CONFIRMED'}})],
      semanticReviews: [recordProposal(schema, 'semanticReviews', {tempKey: 'requirement-discovery', overrides: {REVIEW_QUESTION: 'Does the full governing input set require additional requirements?', FINDING: 'No new requirement is discovered in this synthetic challenge; the comparison defect remains separate.', REASONING: 'Review the exact governing inputs and preserve the declared synthetic defect.', RESULT: 'ACCEPTED'}})]
    }));
  }
  const subject = e.confirmationCorrectionSubject(p); assert(subject); assert.equal(subject.iterationId, iterationId);
  const failedAction = e.operationalNextAction(p, 19);
  assert.equal(failedAction.actionType, 'BLOCKED', 'CONFIRMATION_FAILED_COHORT_RETURNS_FOR_CORRECTION');
  assert.equal(failedAction.failedConfirmationReturn, true, 'CONFIRMATION_FAILED_COHORT_RETURN_MARKER');
  assert.equal(failedAction.operation, null, 'CONFIRMATION_FAILED_COHORT_HAS_NO_NEXT_EXECUTION');
  assert.match(failedAction.explanation, /Stage 14.*Stage 15.*Stage 16.*Stage 17/);
  assert.equal(e.stageEntryState(p, 19).allowed, false, 'CONFIRMATION_FAILED_COHORT_DOES_NOT_BYPASS_PREREQUISITES');
  const deniedEntry = e.stageEntryState(p, 19, {allPrevious: false});
  assert.throws(() => r.prompts.reserveAndBuildPromptRecord(r.copy(p), 19, {operation: 'REGRESSION_VERIFY'}), error => error.code === 'UPSTREAM_STAGE_INCOMPLETE' && error.upstreamStage === deniedEntry.upstreamStage, 'CONFIRMATION_FAILED_COHORT_REGRESSION_ENTRY_REMAINS_DENIED');
  await checkpoint('confirmation-failed-cohort-return');
  const defect = subject.defectIds[0], defectRow = e.records(p, 'defects').find(row => row.id === defect);
  assert.equal(e.gate(19, p).complete, false, 'CONFIRMATION_ACCEPTED_DEFECT_NOT_COMPLETE');
  for (const [caseId, mutate] of [
    ['missing-raw', state => {state.projectData.rawResponses = state.projectData.rawResponses.filter(row => row.rawResponseId !== defectRow.rawResponseId);}],
    ['changed-raw', state => {state.projectData.rawResponses.find(row => row.rawResponseId === defectRow.rawResponseId).completeRawResponse += ' ';}],
    ['wrong-accepted-scope', state => {state.projectData.acceptedChanges.find(row => row.proposalId === defectRow.sourceProposalId).scope.iterationId = 'WRONG_ITERATION';}]
  ]) {const invalid = r.copy(p); mutate(invalid); assert.equal(e.confirmationCorrectionSubject(invalid), null, 'CONFIRMATION_RETURN_PROVENANCE_' + caseId); assert.equal(e.operationalNextAction(invalid, 19).failedConfirmationReturn, undefined, 'CONFIRMATION_RETURN_ACTION_PROVENANCE_' + caseId);}
  assert.equal(e.gate(14, p).complete, false, 'CONFIRMATION_CURRENT_DEFECT_REQUIRES_NEW_RCA');
  assert.equal(e.gate(17, p).complete, false, 'CONFIRMATION_OLD_CORRECTED_ITERATION_CANNOT_DISCHARGE_RETURN');
  const issued = r.prompts.reserveAndBuildPromptRecord(r.copy(p), 14, {operation: 'ROOT_CAUSE'}).prompt;
  assert.equal(issued.scope.iterationId, iterationId); assert.equal(issued.scope.candidateId, candidateId);
  assert(issued.prompt.includes('FAILED UNCHANGED CONFIRMATION — CURRENT CORRECTION SUBJECT'));
  ({p} = await submit(r, p, 14, 'ROOT_CAUSE', prompt => {
    assert.equal(prompt.scope.iterationId, iterationId);
    return {rootCauses: [recordProposal(schema, 'rootCauses', {tempKey: 'confirmation-root', relationships: {DEFECT_ID: {recordId: defect}}, overrides: {CATEGORY: 'EXECUTION', LAYER_TRACE: 'Frozen candidate -> unchanged confirmation execution -> accepted material comparison defect.', EARLIEST_DEFECTIVE_LAYER: 'EXECUTION', ROOT_CAUSE: 'Synthetic execution-layer defect requires a distinct corrected context, preserving the correct instruction.', EVIDENCE: 'Exact accepted confirmation defect and original response.', DOWNSTREAM_INVALIDATION: 'New permanent regression, responsible correction and distinct Stage17 iteration.'}})]};
  }));
  assert.equal(e.confirmationCorrectionSubject(p)?.iterationId, iterationId, 'CONFIRMATION_STAGE14_PRESERVES_FAILED_SOURCE');
  assert.equal(e.gate(14, p).complete, true, 'CONFIRMATION_NEW_RCA_ADMITTED_COMMITTED_RELOADED'); await checkpoint('confirmation-return-stage14');
  ({p} = await submit(r, p, 15, 'COMPLETE', prompt => {
    assert.equal(prompt.scope.iterationId, iterationId);
    return {regressions: [recordProposal(schema, 'regressions', {tempKey: 'confirmation-regression', relationships: {DEFECT_ID: {recordId: defect}, REQ_ID: {recordId: req}}, overrides: {FAILURE_FIXTURE: 'Exact preserved failed confirmation ' + iterationId, REPRODUCTION_PROCEDURE: 'Inspect the accepted material confirmation defect under its original frozen candidate.', DETECTION_METHOD: 'Compare the observed confirmation finding with the no-material-variance condition.', CORRECTION: 'Use a distinct corrected execution without changing the correct instruction.', PERMANENT_TEST_LOCATION: 'Synthetic controlled immediate confirmation regression', APPLICABILITY: 'APPLICABLE'}})], regressionExecutions: [recordProposal(schema, 'regressionExecutions', {tempKey: 'confirmation-pre-correction', relationships: {REG_ID: {tempKey: 'confirmation-regression'}, ITERATION_ID: {recordId: iterationId}, CANDIDATE_ID: {recordId: candidateId}}, overrides: {PHASE: 'PRE_CORRECTION', RESULT: 'VIOLATED'}})]};
  }));
  assert.equal(e.confirmationCorrectionSubject(p)?.iterationId, iterationId, 'CONFIRMATION_STAGE15_PRESERVES_FAILED_SOURCE');
  assert.equal(e.gate(15, p).complete, true, 'CONFIRMATION_NEW_REGRESSION_ADMITTED_COMMITTED_RELOADED'); await checkpoint('confirmation-return-stage15');
  ({p} = await submit(r, p, 16, 'CORRECT', prompt => {
    assert.equal(prompt.scope.iterationId, iterationId);
    return {changes: [recordProposal(schema, 'changes', {tempKey: 'confirmation-correction', overrides: {TRIGGERING_DEFECT_IDS: defect, ROOT_CAUSE_ANALYSIS: 'The exact accepted confirmation execution RCA.', RESPONSIBLE_LAYER: 'EXECUTION', OLD_ARTIFACT_VERSION: 'confirmation-execution-v1', EXACT_MODIFICATION: 'Use new independent execution contexts without modifying the correct instruction.', NEW_ARTIFACT_VERSION: 'confirmation-execution-v2', DOWNSTREAM_INVALIDATION: 'New Stage17 execution and later current evidence required; retain the failed confirmation as source.', REQUIRED_RERUNS: 'Complete distinct corrected ten-run iteration and verification.', INSTRUCTION_CHANGE_DETERMINATION: 'UNCHANGED', REQUIRED_REPEATED_PREFLIGHT: 'NOT REQUIRED', JUSTIFIED_UNCHANGED_ARTIFACTS: 'Execution-only correction preserves correct governing instruction.', EVIDENCE: 'Accepted current RCA and actual pre-correction regression.'}})]};
  }));
  assert.equal(e.confirmationCorrectionSubject(p)?.iterationId, iterationId, 'CONFIRMATION_STAGE16_PRESERVES_FAILED_SOURCE');
  assert.equal(e.gate(16, p).complete, true, 'CONFIRMATION_NEW_CORRECTION_ADMITTED_COMMITTED_RELOADED');
  assert.deepEqual(plain(p.stages[16].derivedData.DOWNSTREAM_VERIFICATIONS_INVALIDATED), ['17', '19'], 'CONFIRMATION_INVALIDATED_STAGE_OUTPUT_RETAINS_STRING_ARRAY_CONTRACT');
  assert.equal(e.operationalNextAction(p, 17).actionType, 'FREEZE_CANDIDATE', 'CONFIRMATION_RETURN_REQUIRES_NEW_FREEZE'); await checkpoint('confirmation-return-stage16');
  const draft = r.copy(p), componentIds = e.recordValue(e.records(draft, 'candidateFreezes').find(row => row.id === candidateId), 'COMPONENT_MANIFEST').map(row => row.artifactId);
  const selection = e.recordRegisteredHumanDecision(draft, {stage: 17, purpose: 'CANDIDATE_COMPONENT_SELECTION', targetFamily: 'artifacts', targetId: r.runtime.closedLoopHash.sha256Value(r.copy(componentIds)), value: r.copy(componentIds), operatorLabel: 'SYNTHETIC_CONFIRMATION_CORRECTION'});
  const frozen = e.freezeCandidate(draft, {stage: 17, artifactIds: componentIds, selectionDecisionId: selection.id, operatorLabel: 'SYNTHETIC_CONFIRMATION_CORRECTION'});
  assert.equal(e.recordValue(frozen.iteration, 'PREVIOUS_ITERATION_ID'), iterationId); assert.notEqual(frozen.candidate.id, candidateId);
  p = await save(r, p, draft); p = await r.store.readProject(p.job.JOB_ID);
  assert.equal(e.evaluateCorrectedIterationLineage(p, frozen.iteration.id).valid, true, 'CONFIRMATION_NEW_DESCENDANT_LINEAGE');
  assert.equal(e.correctedIterationDescendsFrom(p, frozen.iteration.id, iterationId), true);
  assert.equal(e.gate(17, p).complete, false, 'CONFIRMATION_CORRECTION_FREEZE_DOES_NOT_COMPLETE_UNEXECUTED_COHORT');
  const execution = await submit(r, p, 17, 'EXECUTE_RUN', runRecords(r, 'NONE')); p = execution.p;
  const verifierDraft = r.copy(p), verification = r.prompts.reserveAndBuildPromptRecord(verifierDraft, 17, {operation: 'VERIFY', scope: {runId: execution.prompt.scope.runId}}).prompt;
  for (const [operation, prompt] of [['EXECUTE_RUN', execution.prompt], ['VERIFY', verification]]) {
    const carriers = prompt.prompt + JSON.stringify(prompt.contextManifest) + r.prompts.materializePromptContextFiles(prompt).map(row => row.text).join('\n');
    assert(!carriers.includes(defect), 'CONFIRMATION_CORRECTION_INDEPENDENT_' + operation + '_WITHHOLDS_PRIOR_DEFECT_ID');
    assert(!carriers.includes(e.recordValue(defectRow, 'OBSERVED_FAILURE')), 'CONFIRMATION_CORRECTION_INDEPENDENT_' + operation + '_WITHHOLDS_PRIOR_CONCLUSION');
  }
  assert.deepEqual(plain(e.recordsForIteration(p, 'runs', iterationId)), originalRuns, 'CONFIRMATION_RETURN_PRESERVES_ACCEPTED_RUNS');
  for (const raw of originalRaw) assert.deepEqual(plain(p.projectData.rawResponses.filter(row => row.rawResponseId === raw.rawResponseId).map(row => ({rawResponseId: row.rawResponseId, sha256: row.sha256, text: row.completeRawResponse}))), [raw], 'CONFIRMATION_RETURN_PRESERVES_ORIGINAL_RAW');
  assert.equal(r.store.validateProjectIntegrity(p).valid, true); await checkpoint('confirmation-return-new-stage17-run');
  return {passed: true, synthetic: true, actualBrowser: false, sourceIterationId: iterationId, correctedIterationId: frozen.iteration.id, defectId: defect, acceptedRunMutation: false, rawHistoryPreserved: true, stage14PackageAndAcceptance: true, stage15RegressionAndAcceptance: true, stage16CorrectionAndAcceptance: true, stage17NewDescendant: true, independentRunAndVerifierCarriersWithholdPriorConclusions: true, newCorrectedRuns: 1, newCorrectedVerifications: 0, completedNewCohort: false, provenanceNegativeCases: ['missing-raw', 'changed-raw', 'wrong-accepted-scope'], boundary: 'Saved file package, staged response, admission, explicit acceptance, transaction-adapter save/cold-read for corrective return; one new synthetic run and first verifier carrier. Remaining ten-run completion stays required.'};
}

// The real accepted Stage1–10 prerequisite is allowed to retain malformed
// historical evidence, but no public write/read/import may promote it to a
// valid frozen package. This does not claim an operator command makes corruption.
export async function verifyCandidateHashAdmissionControls({sourceOverrides = {}, onlyEmptyMap = false, verifyOwnerRemoval = true, onProgress = () => {}} = {}) {
  const sources = Object.fromEntries(runtimeFiles.map(file => [file, sourceOverrides[file] ?? fs.readFileSync(file, 'utf8')]));
  const initial = await prerequisite(sources), prefix = snapshot(initial.r, initial.p, sources);
  const candidateId = initial.p.job.CURRENT_CANDIDATE_ID, iterationId = initial.p.job.CURRENT_ITERATION;
  const originalRaw = plain(initial.p.projectData.rawResponses), originalReceipts = plain(initial.p.projectData.outputReceipts);
  const originalCandidate = initial.r.engine.records(initial.p, 'candidateFreezes').find(row => row.id === candidateId);
  const originalManifest = plain(initial.r.engine.recordValue(originalCandidate, 'COMPONENT_MANIFEST'));
  const artifactId = originalManifest[0].artifactId, originalDigest = originalManifest[0].sha256;
  const changedDigest = (originalDigest[0] === '0' ? '1' : '0') + originalDigest.slice(1);
  const put = (record, name, value) => {record.fields[name] = record[name] = value;};
  const remove = (record, name) => {delete record.fields[name]; delete record[name];};
  const variants = [
    ['empty-map', (c, i, r) => put(c, 'COMPONENT_HASHES', r.copy({}))],
    ['absent-map', c => remove(c, 'COMPONENT_HASHES')],
    ['null-map', c => put(c, 'COMPONENT_HASHES', null)],
    ['array-map', (c, i, r) => put(c, 'COMPONENT_HASHES', r.copy([]))],
    ['string-map', c => put(c, 'COMPONENT_HASHES', originalDigest)],
    ['missing-hash-key', c => {delete c.fields.COMPONENT_HASHES[artifactId];}],
    ['extra-hash-key', c => {c.fields.COMPONENT_HASHES['UNSELECTED-ARTIFACT'] = originalDigest;}],
    ['malformed-short-digest', c => {c.fields.COMPONENT_HASHES[artifactId] = 'a';}],
    ['malformed-nonhex-digest', c => {c.fields.COMPONENT_HASHES[artifactId] = 'z'.repeat(64);}],
    ['changed-digest', c => {c.fields.COMPONENT_HASHES[artifactId] = changedDigest;}],
    ['absent-manifest', c => remove(c, 'COMPONENT_MANIFEST')],
    ['null-manifest', c => put(c, 'COMPONENT_MANIFEST', null)],
    ['nonarray-manifest', (c, i, r) => put(c, 'COMPONENT_MANIFEST', r.copy({}))],
    ['missing-manifest-entry', (c, i, r) => put(c, 'COMPONENT_MANIFEST', r.copy(originalManifest.slice(1)))],
    ['duplicate-manifest-entry', (c, i, r) => {c.fields.COMPONENT_MANIFEST.push(r.copy(c.fields.COMPONENT_MANIFEST[0]));}],
    ['null-manifest-entry', c => {c.fields.COMPONENT_MANIFEST[0] = null;}],
    ['missing-manifest-artifact', c => {delete c.fields.COMPONENT_MANIFEST[0].artifactId;}],
    ['changed-matching-digests', c => {c.fields.COMPONENT_HASHES[artifactId] = changedDigest; c.fields.COMPONENT_MANIFEST[0].sha256 = changedDigest;}],
    ['changed-manifest-subject', c => {c.fields.COMPONENT_MANIFEST[0].filename += '.changed';}],
    ['missing-source-iteration', c => remove(c, 'ITERATION_ID')],
    ['wrong-source-candidate', (c, i) => put(i, 'CANDIDATE_ID', 'UNRELATED-CANDIDATE')],
    ['changed-freeze-lineage', (c, i) => put(i, 'LINEAGE', changedDigest)]
  ];
  const checked = [];
  const assertClosed = (r, p, caseId, boundary) => {
    const e = r.engine, oracle = 'CANDIDATE_HASH_ADMISSION_ORACLE ' + caseId + ' ' + boundary;
    assert.doesNotThrow(() => e.recalculate(p), oracle + ' deterministic recalculation');
    assert.equal(e.gate(10, p).complete, false, oracle);
    for (const name of ['ALL_REQUIRED_COMPONENTS_PRESENT', 'ALL_RUNS_WILL_RECEIVE_IDENTICAL_FROZEN_MATERIALS', 'ALL_FROZEN_COMPONENT_BYTES_HASHED']) assert.equal(p.stages[10].derivedData[name], false, oracle + ' ' + name);
    assert(!Object.hasOwn(p.stages[10].derivedData,'HASHES_RECORDED_WHERE_PRACTICAL'),oracle+' obsolete Stage10 alias absent');
    const evaluation = e.evaluateIteration(p, iterationId, 'INITIAL');
    assert.equal(evaluation.candidateIdentity, '', oracle + ' identity');
    assert.equal(evaluation.executionEvidenceComplete, false, oracle + ' execution');
    assert.equal(evaluation.complete, false, oracle + ' evaluation');
    assert.equal(e.gate(11, p).complete, false, oracle + ' stage11');
    assert.equal(e.gate(11, p).diagnosticContinuation ?? null, null, oracle + ' diagnostic');
    const draft = r.copy(p), before = JSON.stringify(draft);
    assert.throws(() => e.reserveRunBatch(draft, {stage: 11, iterationId, candidateId}), /frozen candidate|component hashes|current iteration/i, oracle + ' reservation');
    assert.equal(JSON.stringify(draft), before, oracle + ' no partial reservation');
    assert.deepEqual(plain(p.projectData.rawResponses), originalRaw, oracle + ' raw preservation');
    assert.deepEqual(plain(p.projectData.outputReceipts), originalReceipts, oracle + ' receipt preservation');
  };
  // Positive state uses the original freeze/bytes. JSON object key ordering does
  // not change the retained manifest or component identity.
  const positive = initial.r.copy(initial.p), candidate = positive.projectData.candidateFreezes.find(row => row.id === candidateId);
  put(candidate, 'COMPONENT_HASHES', initial.r.copy(Object.fromEntries(Object.entries(candidate.fields.COMPONENT_HASHES).reverse())));
  put(candidate, 'COMPONENT_MANIFEST', initial.r.copy(candidate.fields.COMPONENT_MANIFEST.map(row => Object.fromEntries(Object.entries(row).reverse()))));
  initial.r.engine.refreshRecordHashes(candidate, 'candidateFreezes'); initial.r.engine.recalculate(positive);
  assert.equal(initial.r.engine.gate(10, positive).complete, true, 'CANDIDATE_HASH_ORDER_STABLE_GATE');
  assert.equal(initial.r.engine.evaluateIteration(positive, iterationId).candidateIdentity, initial.r.engine.evaluateIteration(initial.p, iterationId).candidateIdentity, 'CANDIDATE_HASH_ORDER_STABLE_IDENTITY');
  assert.equal(initial.r.engine.reserveRunBatch(positive, {stage: 11, iterationId, candidateId}).length, 10, 'CANDIDATE_HASH_VALID_RESERVATION');
  for (const [caseId, mutate] of onlyEmptyMap ? variants.slice(0, 1) : variants) {
    let {r, p} = await restore(prefix, sources);
    const draft = r.copy(p), c = draft.projectData.candidateFreezes.find(row => row.id === candidateId), i = draft.projectData.iterations.find(row => row.id === iterationId);
    mutate(c, i, r);
    // Mirrored canonical carriers remain coherent; the invalidity is solely the
    // frozen package, not a stale record digest or fabricated completion flag.
    for (const key of ['COMPONENT_HASHES', 'COMPONENT_MANIFEST']) if (Object.hasOwn(c.fields, key)) c[key] = c.fields[key];
    r.engine.refreshRecordHashes(c, 'candidateFreezes'); r.engine.refreshRecordHashes(i, 'iterations'); r.engine.recalculate(draft);
    let disposition = 'REJECTED', rejectionCode = null;
    try {p = await save(r, p, draft);} catch (error) {
      assert(['PROJECT_INTEGRITY_FAILED', 'PROJECT_SCHEMA_INVALID'].includes(error.code), 'CANDIDATE_HASH_UNEXPECTED_STORAGE_REJECTION ' + caseId + ': ' + error.message);
      rejectionCode = error.code;
    }
    if (!rejectionCode) {
      p = await r.store.readProject(p.job.JOB_ID);
      assert.equal(r.store.validateProjectIntegrity(p).valid, true, 'CANDIDATE_HASH_RETAINED_INCOMPLETE_INTEGRITY ' + caseId);
      assertClosed(r, p, caseId, 'public-cold-read'); disposition = 'RETAINED_INCOMPLETE';
      if (caseId === 'empty-map' || caseId === 'changed-matching-digests') {
        const backup = await r.store.exportPackage(p.job.JOB_ID), fresh = runtime(sources);
        await fresh.store.ready;
        const imported = await fresh.store.importPackage(backup);
        assertClosed(fresh, imported, caseId, 'export-import');
      }
    }
    assertClosed(r, draft, caseId, 'recalculated');
    checked.push({caseId, passed: true, disposition, rejectionCode}); onProgress(checked.at(-1));
  }
  let ownerRemoval = null;
  if (verifyOwnerRemoval) {
    const source = sources['workflow-engine.js'], start = source.indexOf('function candidateComponentIdentity('), end = source.indexOf('\nfunction evaluateCorrectedIterationLineage(', start);
    assert(start >= 0 && end > start, 'CANDIDATE_HASH_OWNER_REMOVAL_ANCHOR');
    const removed = source.slice(0, start) + "function candidateComponentIdentity(project,candidateId){const c=records(project,'candidateFreezes').find(r=>recordId(r,'candidateFreezes')===String(candidateId||''));return c?hash.sha256Value(recordValue(c,'COMPONENT_HASHES')||{}):'';}" + source.slice(end);
    await assert.rejects(() => verifyCandidateHashAdmissionControls({sourceOverrides: {...sourceOverrides, 'workflow-engine.js': removed}, onlyEmptyMap: true, verifyOwnerRemoval: false}), error => error.code === 'ERR_ASSERTION' && error.message.includes('CANDIDATE_HASH_ADMISSION_ORACLE empty-map public-cold-read'), 'CANDIDATE_HASH_OWNER_REMOVAL_MUST_RECREATE_DURABLE_FAILURE');
    ownerRemoval = {detected: true, oracle: 'CANDIDATE_HASH_ADMISSION_ORACLE empty-map public-cold-read', actualAcceptedPrerequisite: true};
  }
  return {passed: true, synthetic: true, actualBrowser: false, actualAcceptedPrerequisite: true, prerequisiteSha256: initial.prerequisiteSha256, decodedPrerequisiteSha256: initial.decodedPrerequisiteSha256, originalRawAndReceiptsPreserved: true, validReservationSlots: 10, keyOrderingPreserved: true, cases: checked, ownerRemoval, boundary: 'Actual retained Stage1–10 prerequisite; production public write, cold read, export/import with existing transaction adapter. No normal operator corruption path or browser claim.'};
}

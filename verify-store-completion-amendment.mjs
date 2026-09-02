import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const store=globalThis.closedLoopProjectStore;
assert.equal(store.version,'closed-loop-project-store/3');
for(const method of [
  'stageAttachment','listStagedAttachments','commitProjectWithStagedAttachments',
  'discardStagedAttachment','reconcileArtifactStorage','createIntegrityCheckpoint',
  'createExecutionPackage','exportPackage','verifyRestorePackage','createVerifiedBackup','importPackage','deleteProject',
  'cloneProjectLineage','storageCapacityPreflight'
])assert.equal(typeof store[method],'function',`missing store amendment method ${method}`);

const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,hash=globalThis.closedLoopHash;
const reservationProject=core.createBlankState('JOB-STORE-RESERVATION');
engine.ensureShape(reservationProject);engine.recalculate(reservationProject);reservationProject.revision=0;
const reservationContext=engine.registerFreshContext(reservationProject,{stage:1,externalContextIdentifier:'STORE-RESERVATION-AUTHOR-CONTEXT-1',operatorLabel:'STORE_VERIFIER',purpose:'GENERAL'}),reservationContextId=engine.recordId(reservationContext,'freshContexts');
const reservationScope=prompts.scopeFor(1,{...reservationProject,revision:Number(reservationProject.revision||0)+1},{contextId:reservationContextId});
const reservationOptions={stage:1,operation:'COMPLETE',contextId:reservationContextId,scope:reservationScope,owningTabInstance:'STORE_VERIFIER'},currentTarget=engine.operationReservationTarget(reservationProject,reservationOptions);
assert.equal(currentTarget.external,true);assert.match(currentTarget.targetSlot,/^OPERATION:01:COMPLETE:/);assert.equal(hash.sha256Value(currentTarget.payload),hash.sha256Value(engine.prepareCurrentOperationReservation(reservationProject,reservationOptions).payload));
const preparedBase=engine.prepareCurrentOperationReservation(reservationProject,reservationOptions),packageId='PACKAGE-0123456789ABCDEF0123456789ABCDEF',prepared={...structuredClone(preparedBase),PACKAGE_ID:packageId,packageId,fields:{...structuredClone(preparedBase).fields,PACKAGE_ID:packageId}};
const reservationPreview=structuredClone(reservationProject);reservationPreview.revision=prepared.expectedRevision;
const reservationPrompt=prompts.buildPromptRecord(1,reservationPreview,{operation:'COMPLETE',scope:prepared.scope,operationReservation:prepared});
engine.registerGeneratedPrompt(reservationProject,reservationPrompt);
const activeReservation=engine.reserveOperation(reservationProject,{preparedReservation:prepared,promptId:reservationPrompt.instructionId});
reservationProject.revision=prepared.expectedRevision;engine.recalculate(reservationProject);
assert.equal(reservationPrompt.operationBinding.packageId,packageId);
assert.equal(reservationPrompt.operationBinding.expectedRevision,1);
assert.equal(reservationPrompt.operationBinding.challengeNonce.length,32);
assert.equal(hash.stableStringify(reservationPrompt.operationBinding.scope),hash.stableStringify(prepared.scope));
assert.equal(engine.recordValue(activeReservation,'STATUS'),'ACTIVE');

const disclosureProject=core.createBlankState('JOB-STORE-DISCLOSURE');
engine.ensureShape(disclosureProject);engine.recalculate(disclosureProject);disclosureProject.revision=0;
engine.registerArtifactBytes(disclosureProject,{stage:1,artifactId:'ARTIFACT-DISCLOSURE-1',filename:'restricted.txt',mediaType:'text/plain',byteSize:3,sha256:'a'.repeat(64),role:'STAGE_ARTIFACT'});
const disclosureArtifact=engine.records(disclosureProject,'artifacts').find(record=>engine.recordId(record,'artifacts')==='ARTIFACT-DISCLOSURE-1');
disclosureArtifact.fields.DISCLOSURE_CLASSIFICATION='RESTRICTED';disclosureArtifact.DISCLOSURE_CLASSIFICATION='RESTRICTED';engine.refreshRecordHashes(disclosureArtifact,'artifacts');
const disclosureAuthorization=engine.recordHumanDisclosureAuthorization(disclosureProject,{artifactIds:['ARTIFACT-DISCLOSURE-1'],decision:'AUTHORIZE',recipientOrProvider:'independent reviewer',recipientSuitabilityDecision:'SUITABLE',purposeAndLimits:'one exact current verification package only',effectivePeriodDecision:'this operation only',decisionReason:'required independent review',expectedRevision:0});
assert.equal(engine.recordValue(disclosureAuthorization,'PROJECT_REVISION'),1);
assert.equal(engine.recordValue(disclosureAuthorization,'DISCLOSURE_DECISION'),'AUTHORIZE');
assert.equal(engine.recordValue(disclosureAuthorization,'RECIPIENT_SUITABILITY_DECISION'),'SUITABLE');
assert.match(engine.recordValue(disclosureAuthorization,'AUTHORIZATION_HASH'),/^[a-f0-9]{64}$/);

const normalized=store.normalizeArtifactFilename('folder/e\u0301.txt');
assert.equal(normalized.rawFilename,'folder/e\u0301.txt');
assert.equal(normalized.canonicalPath,'folder/\u00e9.txt');
assert.equal(normalized.filenameNormalizationVersion,'closed-loop-filename/1');
for(const invalid of ['/absolute.txt','C:\\absolute.txt','../escape.txt','a//b','a/./b','a/../b','bad\u0000name','bad\ud800name']){
  assert.throws(()=>store.normalizeArtifactFilename(invalid),error=>Boolean(error?.code),`unsafe filename was accepted: ${JSON.stringify(invalid)}`);
}
assert.throws(()=>store.validateFilenameSet([
  {artifactId:'ARTIFACT-A',filename:'Folder/Report.txt'},
  {artifactId:'ARTIFACT-B',filename:'folder/report.TXT'}
]),error=>error?.code==='FILENAME_COLLISION','case-fold collision was accepted');
assert.throws(()=>store.validateFilenameSet([
  {artifactId:'ARTIFACT-A',filename:'report.txt'},
  {artifactId:'ARTIFACT-B',filename:'report.txt '}
]),error=>error?.code==='FILENAME_COLLISION','platform-risk collision was accepted');

const clean=store.scanKnownSecretPatterns(new TextEncoder().encode('ordinary controlled input'),{filename:'input.txt'});
assert.equal(clean.clear,true);
assert.match(clean.limitations.join(' '),/not proof/i);
const secret=store.scanKnownSecretPatterns(new TextEncoder().encode('-----BEGIN PRIVATE KEY-----'),{filename:'credentials.pem'});
assert.equal(secret.clear,false);
assert(secret.findings.some(item=>item.kind==='PRIVATE_KEY'));

assert.deepEqual(store.scanJsonEnvelope('{"safe":[1,true,null]}'),{nodes:5});
assert.throws(()=>store.scanJsonEnvelope('{"duplicate":1,"duplicate":2}'),error=>error?.code==='IMPORT_DUPLICATE_MEMBER');
assert.throws(()=>store.scanJsonEnvelope('{"unsafe":9007199254740992}'),error=>error?.code==='IMPORT_UNSAFE_NUMBER');
assert.throws(()=>store.scanJsonEnvelope('{"fraction":0.1}'),error=>error?.code==='IMPORT_UNSAFE_NUMBER');
assert.throws(()=>store.scanJsonEnvelope('{"negativeZero":-0}'),error=>error?.code==='IMPORT_UNSAFE_NUMBER');

const policy=store.defaultBackupPolicy('JOB-STORE-AMENDMENT');
assert.deepEqual(policy.requiredCheckpointEvents,['BASELINE_APPROVAL','FINAL_DELIVERY']);
assert.equal(policy.includeArtifactBytes,true);
assert.match(policy.encryptionRequirement,/ENCRYPTION/);

const source=fs.readFileSync('project-store.js','utf8');
for(const token of [
  "PENDING_BYTES","HASHED_AND_REVERIFIED","READY_FOR_PROMOTION",
  "PROMOTE_ATTACHMENTS_AND_COMMIT","existingProjectsUnchanged:true",
  "mode==='CLONE'","mode==='RESTORE'","RESTORE_CONFLICT_PRECONDITION_REQUIRED",
  "VERIFIED_IMPORT_ACTIVATION","metadataRows=await request(meta.getAll())",
  "EXECUTION_PACKAGE_CREDENTIAL_SECRET_BLOCKED","EXECUTION_PACKAGE_DISCLOSURE_AUTHORIZATION_REQUIRED",
  "operationReservationTarget(project,options)","prepareCurrentOperationReservation(project","reserveOperation(next,{preparedReservation",
  "scope:exactReservationScope","EXECUTION_PACKAGE_RESERVATION_SCOPE_MISMATCH",
  "fields:{...(preparedClone.fields||{}),PACKAGE_ID:packageId}",
  "disclosureAuthorizationBasis:canonicalAuthorizationBasis?clone(canonicalAuthorizationBasis):null",
  "existingExecutionPackageRetry","packageBlobSha256",
  "validateOnly:true","closed-loop-restore-test-receipt/1","RESTORE_TEST_SUCCEEDED",
  "activationPerformed:false","BACKUP_ACKNOWLEDGMENT_OBJECT_REQUIRED",
  "command:idempotency:","COMMAND_ID_REUSE_CONFLICT","IDEMPOTENCY_KEY_REUSE_CONFLICT",
  "INTEGRITY_CHECKED_NOT_AUTHENTICATED","closed-loop-filename/1"
])assert(source.includes(token),`store amendment source is missing ${token}`);
assert(!source.includes('engine.prepareOperationReservation'),'Store execution-package construction regressed to the generic reservation primitive.');

assert(!/createObjectStore\s*\(\s*['"](?:staging|receipts|packages|backup)/i.test(source),'store amendment created a parallel IndexedDB store');
await store.ready;

console.log(JSON.stringify({
  storeVersion:store.version,
  singleDatabase:store.DB_NAME,
  stagedAttachmentLifecycle:true,
  atomicPromotion:true,
  failClosedImport:true,
  restoreCloneDelete:true,
  disclosureAndSecretBoundary:true,
  filenameSafety:true,
  commandIdempotency:true,
  reservationPackageAtomicity:true
},null,2));

import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,hash=globalThis.closedLoopHash,engine=globalThis.closedLoopWorkflowEngine,store=globalThis.closedLoopProjectStore,schema=globalThis.closedLoopWorkflowSchema;
const assert=(value,message)=>{if(!value)throw new Error(message);};
const project=core.createBlankState('JOB-RESTORE-ACTIVATION-CONTRACT');Object.assign(project.job,{JOB_ID:'JOB-RESTORE-ACTIVATION-CONTRACT',JOB_TITLE:'Restore activation contract fixture',EXACT_USER_OBJECTIVE_VERBATIM:'Prove complete import validation and isolated activation reuse.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCES-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TESTS-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'});engine.ensureShape(project);engine.recalculate(project);
const bytes=new TextEncoder().encode('restore activation contract'),sha256=await hash.sha256Bytes(bytes),scope=engine.currentScope(project),fields={ARTIFACT_ID:'ARTIFACT-RESTORE-ACTIVATION',FILENAME:'restore-activation.bin',BYTE_SIZE:bytes.byteLength,SHA256:sha256,AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED',DISCLOSURE_CLASSIFICATION:'PUBLIC'},artifact={id:fields.ARTIFACT_ID,stage:1,active:true,scope,fields:{...fields},...fields};engine.refreshRecordHashes(artifact,'artifacts');project.projectData.artifacts.push(artifact);engine.recalculate(project);
const entry={artifactId:fields.ARTIFACT_ID,jobId:project.job.JOB_ID,filename:fields.FILENAME,mediaType:'application/octet-stream',byteSize:bytes.byteLength,sha256,base64:Buffer.from(bytes).toString('base64')},proof=await store.validateBackupRestoreCandidate(project,[entry],{milestone:'MANUAL'});
assert(proof.status==='SUCCEEDED'&&proof.importValidationContract==='SHARED_COMPLETE_IMPORT_VALIDATION'&&proof.activationPath==='SHARED_IMPORT_ACTIVATION_TRANSACTION','Restore proof did not bind the shared complete import validation and activation path.');
assert(proof.restoredProjectRowCount===1&&proof.restoredArtifactRowCount===1&&proof.stagingRowCount===0,'Restore proof did not verify the restored project and artifact rows.');
assert(proof.isolatedDatabaseDistinctFromActive===true&&proof.activeDatabaseWriteCount===0&&proof.temporaryLineageRemoved===true&&proof.isolatedDatabaseDeleted===true,'Restore proof did not establish isolated activation and complete temporary-lineage cleanup.');
assert(proof.sourceProjectSha256===proof.restoredProjectSha256&&/^[a-f0-9]{64}$/.test(proof.restoreTestEvidenceSha256),'Restore proof did not preserve the exact source project digest and evidence digest.');
for(const [entries,code] of [
  [[],'BACKUP_RESTORE_BYTES_MISSING'],
  [[{...entry,artifactId:'ARTIFACT-UNMANIFESTED'}],'BACKUP_RESTORE_EXTRA_ARTIFACT'],
  [[{...entry,base64:Buffer.from('wrong').toString('base64')}],'BACKUP_RESTORE_ARTIFACT_MISMATCH']
]){let rejected=false;try{await store.validateBackupRestoreCandidate(project,entries,{milestone:'MANUAL'});}catch(error){rejected=error?.code===code;}assert(rejected,`Invalid restore candidate was not rejected with ${code}.`);}
const source=fs.readFileSync('project-store.js','utf8');for(const token of ['async function prepareImportPackage','async function applyPreparedImportTransaction','async function activatePreparedImport','async function runIndexedDbIsolatedActivation','async function verifyActivatedImportRows','async function removeIsolatedRestoreLineage','const prepared=await prepareImportPackage(blob,{mode:\'RESTORE\'})','const prepared=await prepareImportPackage(blob,{mode});const activated=await activatePreparedImport'])assert(source.includes(token),`Shared restore/import implementation token is missing: ${token}`);
assert(schema.PROJECT_SCHEMA==='closed-loop-project/3','Restore test did not target the current project schema.');
console.log(JSON.stringify({sharedCompleteImportValidation:true,sharedActivationTransaction:true,restoredProjectRowVerification:true,restoredArtifactRowVerification:true,activeDatabaseWriteCountZero:true,temporaryLineageCleanup:true,invalidRestoreMutationsRejected:true,nodeIsolationAdapter:proof.activationStore},null,2));

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const plain=value=>JSON.parse(JSON.stringify(value));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
const slot=jobId=>'backupImportStaging:'+jobId;
export async function verifyBackupStagingStore({fault=null}={}){
 const ownerSource=fs.readFileSync('project-store.js','utf8'),manifestAnchor='artifacts:artifactEntries.map(a=>({artifactId:a.artifactId,filename:a.filename,mediaType:a.mediaType,byteSize:a.byteSize,sha256:a.sha256}))',mutations={
  'retain-consumed-input':["meta.delete(backupImportStagingKey(stagedBackup.jobId));","/* SYNTHETIC fault: committed input remains actionable. */"],
  'trust-staging-digest':["if(await hash.sha256Bytes(record.blob)!==record.sha256)throw storageError(","if(false)throw storageError("],
  'omit-normal-manifest-member':[manifestAnchor,"artifacts:artifactEntries.filter(a=>a.artifactId!=='SYNTHETIC-BACKUP-MANIFEST-MEMBER').map(a=>({artifactId:a.artifactId,filename:a.filename,mediaType:a.mediaType,byteSize:a.byteSize,sha256:a.sha256}))"],
  'wrong-normal-manifest-member':[manifestAnchor,"artifacts:artifactEntries.map(a=>({artifactId:a.artifactId,filename:a.filename,mediaType:a.mediaType,byteSize:a.byteSize,sha256:a.artifactId==='SYNTHETIC-BACKUP-MANIFEST-MEMBER'?'0'.repeat(64):a.sha256}))"]
 };
 let storeSource=ownerSource;if(fault){const [before,after]=mutations[fault]||[];assert(before&&storeSource.split(before).length===2,'BACKUP_STAGE_FAULT_ANCHOR_ORACLE');storeSource=storeSource.replace(before,after);}
 const cases=[],r=projectStoreRuntime({sourceOverrides:{'project-store.js':storeSource}}),s=r.store,p=await s.createProject({commandId:'SYNTHETIC-PENDING-BACKUP'}),id=p.job.JOB_ID;
 const manifestMemberBytes=Buffer.from('Independent normal backup manifest member bytes.','utf8'),manifestMemberBlob=new Blob([manifestMemberBytes],{type:'application/octet-stream'});
 await s.putArtifact({artifactId:'SYNTHETIC-BACKUP-MANIFEST-MEMBER',jobId:id,blob:manifestMemberBlob,filename:'manifest-member.bin',mediaType:manifestMemberBlob.type,lineage:{stage:1,role:'SOURCE_MATERIAL'}});
 const backup=await s.exportPackage(id),bytes=Buffer.from(await backup.arrayBuffer()),history=plain(await s.historyList(id)),artifacts=plain((await s.listArtifacts(id)).map(({blob,...row})=>row));
 const stage=async(blob=backup,expectedStagingId=null,extra={})=>s.stageBackupImport({jobId:id,blob,rawFilename:'exact selected backup.gz',mediaType:'application/gzip',expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,expectedStagingId,...extra});
 const unchanged=async()=>{assert.deepEqual(plain(await s.readProject(id)),plain(p),'BACKUP_STAGE_CANONICAL_UNCHANGED_ORACLE');assert.deepEqual(plain(await s.historyList(id)),history,'BACKUP_STAGE_HISTORY_UNCHANGED_ORACLE');};
 const original=await stage();assert.equal(original.sha256,digest(bytes));assert.equal(original.byteSize,bytes.length);assert(!Object.hasOwn(original,'blob'));assert.deepEqual(plain(await s.pendingBackupImportIdentity(id)),plain(original));
 const reloaded=projectStoreRuntime();for(const [name,rows]of r.rows)reloaded.rows.set(name,new Map([...rows].map(([key,value])=>[key,reloaded.copy(value)])));assert.deepEqual(Buffer.from(await (await reloaded.store.readPendingBackupImport(id)).blob.arrayBuffer()),bytes,'BACKUP_STAGE_RELOAD_EXACT_BYTES_ORACLE');
 assert.deepEqual(Buffer.from(await (await s.readPendingBackupImport(id)).blob.arrayBuffer()),bytes,'BACKUP_STAGE_EXACT_BYTES_ORACLE');await unchanged();assert.deepEqual(plain((await s.listArtifacts(id)).map(({blob,...row})=>row)),artifacts);
 const exported=JSON.parse(gunzipSync(Buffer.from(await (await s.exportPackage(id)).arrayBuffer())).toString('utf8'));
 const manifest=exported.packageManifest,manifestFields=['artifactCount','artifacts','jobId','projectSha256'],memberFields=['artifactId','byteSize','filename','mediaType','sha256'];
 for(const field of manifestFields)assert(Object.hasOwn(manifest,field),'BACKUP_NORMAL_MANIFEST_REQUIRED_FIELD_ORACLE: '+field);
 assert.equal(manifest.jobId,id,'BACKUP_NORMAL_MANIFEST_JOB_ORACLE');assert.equal(manifest.projectSha256,p.projectSha256,'BACKUP_NORMAL_MANIFEST_PROJECT_ORACLE');assert.equal(manifest.artifactCount,exported.artifacts.length,'BACKUP_NORMAL_MANIFEST_COUNT_ORACLE');assert.equal(manifest.artifacts.length,exported.artifacts.length,'BACKUP_NORMAL_MANIFEST_MEMBER_COUNT_ORACLE');
 for(const member of manifest.artifacts)for(const field of memberFields)assert(Object.hasOwn(member,field),'BACKUP_NORMAL_MANIFEST_MEMBER_REQUIRED_FIELD_ORACLE: '+field);
 const activeMember=manifest.artifacts.find(member=>member.artifactId==='SYNTHETIC-BACKUP-MANIFEST-MEMBER');assert(activeMember,'BACKUP_NORMAL_MANIFEST_ACTIVE_MEMBER_ORACLE');
 assert.deepEqual(Object.fromEntries(memberFields.map(field=>[field,activeMember[field]])),{artifactId:'SYNTHETIC-BACKUP-MANIFEST-MEMBER',filename:'manifest-member.bin',mediaType:'application/octet-stream',byteSize:manifestMemberBytes.length,sha256:digest(manifestMemberBytes)},'BACKUP_NORMAL_MANIFEST_EXACT_MEMBER_ORACLE');
 const repack=payload=>{const body=structuredClone(payload);delete body.packageSha256;const packageSha256=digest(Buffer.from(canonical(body),'utf8'));return new Blob([gzipSync(Buffer.from(canonical({...body,packageSha256}),'utf8'))],{type:'application/gzip'});};
 const extensionPackage=structuredClone(exported);extensionPackage.packageManifest.futureManifestExtension={literal:[false,0,null]};extensionPackage.packageManifest.artifacts.find(member=>member.artifactId==='SYNTHETIC-BACKUP-MANIFEST-MEMBER').futureMemberExtension='retained';
 const extensionRuntime=projectStoreRuntime({sourceOverrides:{'project-store.js':storeSource}}),extensionImported=await extensionRuntime.store.importPackage(repack(extensionPackage));assert.equal(extensionImported.job.JOB_ID,id,'BACKUP_NORMAL_MANIFEST_EXTENSION_IMPORT_ORACLE');assert.deepEqual(Buffer.from(await (await extensionRuntime.store.getArtifact('SYNTHETIC-BACKUP-MANIFEST-MEMBER')).blob.arrayBuffer()),manifestMemberBytes,'BACKUP_NORMAL_MANIFEST_EXTENSION_BYTES_ORACLE');
 const manifestFailureState=async()=>{await unchanged();assert.deepEqual(Buffer.from(await (await s.getArtifact('SYNTHETIC-BACKUP-MANIFEST-MEMBER')).blob.arrayBuffer()),manifestMemberBytes,'BACKUP_NORMAL_MANIFEST_REJECTION_BYTE_PRESERVATION_ORACLE');assert.equal((await s.readPendingBackupImport(id)).stagingId,original.stagingId);};
 const missingMember=structuredClone(exported);missingMember.packageManifest.artifacts=missingMember.packageManifest.artifacts.filter(member=>member.artifactId!=='SYNTHETIC-BACKUP-MANIFEST-MEMBER');
 await assert.rejects(s.importPackage(repack(missingMember)),error=>error.message==='Package manifest does not reconcile with the embedded project and artifacts.'&&error.existingProjectsUnchanged===true,'BACKUP_NORMAL_MANIFEST_MISSING_MEMBER_ORACLE');await manifestFailureState();
 const wrongMember=structuredClone(exported);wrongMember.packageManifest.artifacts.find(member=>member.artifactId==='SYNTHETIC-BACKUP-MANIFEST-MEMBER').sha256='0'.repeat(64);
 await assert.rejects(s.importPackage(repack(wrongMember)),error=>error.message==='Package manifest mismatch for artifact SYNTHETIC-BACKUP-MANIFEST-MEMBER.'&&error.existingProjectsUnchanged===true,'BACKUP_NORMAL_MANIFEST_WRONG_MEMBER_ORACLE');await manifestFailureState();
 assert(!JSON.stringify(exported).includes(original.stagingId),'BACKUP_STAGE_NOT_RECURSIVE_HISTORY_ORACLE');assert.equal((await s.readPendingBackupImport(id)).stagingId,original.stagingId);
 cases.push({caseId:'durable-exact-input-outside-project-history-and-export',passed:true,normalManifestRequiredFields:true,unknownExtensionsAccepted:true,missingAndWrongMemberRejected:true});
 // Selection replacement is a deliberate atomic action. Neither a stale tab
 // nor a failed transaction may erase the currently recoverable input.
 await assert.rejects(stage(backup,null),{code:'STALE_BACKUP_IMPORT_SELECTION'});
 await assert.rejects(stage(backup,original.stagingId,{expectedProjectRevision:p.revision+1}),{code:'STALE_PROJECT_REVISION'});
 r.runtime.__closedLoopStorageFault='before-backup-staging-commit';await assert.rejects(stage(new Blob(['replacement']),original.stagingId),{code:'INJECTED_STORAGE_FAILURE'});delete r.runtime.__closedLoopStorageFault;
 assert.equal((await s.readPendingBackupImport(id)).stagingId,original.stagingId);await unchanged();
 cases.push({caseId:'selection-cas-project-cas-and-transaction-abort',passed:true});
 // Identity reads never claim custody; equal-length damaged bytes remain
 // discoverable for explicit recovery, and are rejected by the actual reader.
 const corrupt=Buffer.from(bytes);corrupt[0]^=1;
 r.rows.get('meta').get(slot(id)).value.blob=new Blob([corrupt]);assert.equal((await s.pendingBackupImportIdentity(id)).stagingId,original.stagingId);
 await assert.rejects(s.readPendingBackupImport(id),{code:'BACKUP_IMPORT_STAGE_REHASH_MISMATCH'},'BACKUP_STAGE_REHASH_ORACLE');await assert.rejects(s.importPackage(backup,{pendingBackupImport:{jobId:id,stagingId:original.stagingId}}),{code:'BACKUP_IMPORT_STAGE_REHASH_MISMATCH'});await unchanged();
 let current=await stage(backup,original.stagingId);
 for(const malformed of [{...current,schema:'unknown'},{...current,jobId:'WRONG-OWNER'},{...current,stagingId:''},null,{blob:backup}]){
  r.rows.get('meta').set(slot(id),{key:slot(id),value:malformed&&r.copy({...malformed,blob:backup})});const identity=await s.pendingBackupImportIdentity(id);assert.equal(identity.invalid,true);await assert.rejects(s.readPendingBackupImport(id),{code:'BACKUP_IMPORT_STAGE_INVALID'});current=await stage(backup,identity.stagingId);assert.deepEqual(Buffer.from(await (await s.readPendingBackupImport(id)).blob.arrayBuffer()),bytes);
 }
 cases.push({caseId:'same-size-corruption-malformed-metadata-and-explicit-recovery',passed:true,malformedCases:5});
 await assert.rejects(s.importPackage(new Blob([corrupt]),{pendingBackupImport:{jobId:id,stagingId:current.stagingId}}),{code:'BACKUP_IMPORT_STAGE_REHASH_MISMATCH'});
 r.runtime.__closedLoopStorageFault='before-import-commit';await assert.rejects(s.importPackage(backup,{pendingBackupImport:{jobId:id,stagingId:current.stagingId}}),{code:'INJECTED_STORAGE_FAILURE'});delete r.runtime.__closedLoopStorageFault;
 await unchanged();assert.equal((await s.readPendingBackupImport(id)).stagingId,current.stagingId);
 // Replace the selected input after verification but before the import opens
 // its transaction. The production transaction must reject the stale action.
 const open=r.runtime.openStorageTransaction;let replacement=null,armed=true;
 r.runtime.openStorageTransaction=async(names,mode)=>{if(armed&&mode==='readwrite'&&Array.isArray(names)&&names.includes('artifacts')){armed=false;replacement=await stage(backup,current.stagingId);}return open(names,mode);};
 await assert.rejects(s.importPackage(backup,{pendingBackupImport:{jobId:id,stagingId:current.stagingId}}),{code:'STALE_BACKUP_IMPORT_SELECTION'});r.runtime.openStorageTransaction=open;await unchanged();assert.equal((await s.readPendingBackupImport(id)).stagingId,replacement.stagingId);
 const imported=await s.importPackage(backup,{pendingBackupImport:{jobId:id,stagingId:replacement.stagingId}});assert.equal(await s.readPendingBackupImport(id),null,'BACKUP_STAGE_ATOMIC_CONSUME_ORACLE');
 await assert.rejects(s.importPackage(backup,{pendingBackupImport:{jobId:id,stagingId:replacement.stagingId}}),{code:'STALE_BACKUP_IMPORT_SELECTION'});assert.deepEqual(plain(await s.readProject(id)),plain(imported));
 cases.push({caseId:'input-identity-commit-abort-replacement-race-consume-and-completed-retry',passed:true});
 const protectedBackup=await s.exportPackage(id,{passphrase:'SYNTHETIC-ONLY password'}),protectedBytes=Buffer.from(await protectedBackup.arrayBuffer()),protectedStage=await s.stageBackupImport({jobId:id,blob:protectedBackup,rawFilename:'protected.backup',mediaType:protectedBackup.type,expectedProjectRevision:imported.revision,expectedStateSha256:imported.projectSha256});
 const pending={jobId:id,stagingId:protectedStage.stagingId};
 await assert.rejects(s.importPackage(protectedBackup,{pendingBackupImport:pending}),{code:'BACKUP_PASSPHRASE_REQUIRED'});await assert.rejects(s.importPackage(protectedBackup,{pendingBackupImport:pending,passphrase:'SYNTHETIC-WRONG'}),{code:'BACKUP_AUTHENTICATION_FAILED'});
 assert.deepEqual(Buffer.from(await (await s.readPendingBackupImport(id)).blob.arrayBuffer()),protectedBytes);assert(!JSON.stringify(r.rows.get('meta').get(slot(id))).includes('SYNTHETIC-ONLY password'));
 await s.importPackage(protectedBackup,{pendingBackupImport:pending,passphrase:'SYNTHETIC-ONLY password'});assert.equal(await s.pendingBackupImportIdentity(id),null);
 assert.deepEqual(plain((await s.metaGet('lastVerifiedImport')).selectedBackupImport),plain(protectedStage),'BACKUP_STAGE_TRANSPORT_RECEIPT_ORACLE');assert.equal((await s.metaGet('lastVerifiedImport')).selectedBackupImport.sha256,digest(protectedBytes));
 cases.push({caseId:'encrypted-original-preserved-through-password-retry',passed:true});
 // Execute the production worker dispatcher and storage owner together. This
 // adapter exercises message options and transactions, not a real Worker/IDB.
 let receive,replyResolve;const w=projectStoreRuntime({environment:{document:undefined,location:{search:'?storeWorker=1&v=SYNTHETIC'},URLSearchParams,importScripts(){},addEventListener(type,handler){if(type==='message')receive=handler;},postMessage(message){replyResolve(message);}}}),wp=await w.store.createProject({commandId:'SYNTHETIC-WORKER-PENDING'}),wb=await w.store.exportPackage(wp.job.JOB_ID,{passphrase:'SYNTHETIC-WORKER password'}),wd=await w.store.stageBackupImport({jobId:wp.job.JOB_ID,blob:wb,expectedProjectRevision:wp.revision,expectedStateSha256:wp.projectSha256});
 const response=new Promise(resolve=>{replyResolve=resolve;});receive({data:{buildIdentity:'SYNTHETIC',operationId:'SYNTHETIC-WORKER-IMPORT',method:'IMPORT_PACKAGE',args:[wb,{passphrase:'SYNTHETIC-WORKER password',pendingBackupImport:{jobId:wp.job.JOB_ID,stagingId:wd.stagingId}}]}});
 const reply=await response;assert.equal(reply.ok,true,'BACKUP_STAGE_WORKER_OPTIONS_ORACLE: '+JSON.stringify(reply.error));assert.equal(await w.store.pendingBackupImportIdentity(wp.job.JOB_ID),null);assert.equal((await w.store.metaGet('storageOperation:SYNTHETIC-WORKER-IMPORT')).jobId,wp.job.JOB_ID);
 cases.push({caseId:'production-worker-message-preserves-pending-identity-and-password-options',passed:true});
 return {synthetic:true,actualBrowser:false,cases};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await verifyBackupStagingStore({fault:process.argv.find(arg=>arg.startsWith('--fault='))?.slice(8)||null}),null,2));

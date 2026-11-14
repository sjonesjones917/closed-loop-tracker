import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {projectStoreRuntime,storedArtifactBody} from './test-project-store-runtime.mjs';

// §35.9 requires protection for classified backup material even after it leaves
// current state. These are real store/History/package owners over the existing
// explicit transaction adapter; no browser or physical-device claim is made.
export async function verifyCredentialHistoryParts({sourceOverrides={}}={}){
 const cases=[],note=name=>cases.push({name,result:'PASS'}),passphrase='Synthetic retained-part protection';
 const fragments=Array.from({length:80},(_,index)=>`Synthetic fragment ${index} ${'.'.repeat(80)}`);
 async function prepare(kind,value){
  const r=projectStoreRuntime({sourceOverrides,storageWorker:false}),{store,core,engine,copy}=r;
  let project=core.createBlankState('HISTORY-CREDENTIAL-PART-'+kind);
  project.job.JOB_TITLE='Synthetic History credential protection';project.vendorExtension=copy({retained:value});
  engine.ensureShape(project);engine.recalculate(project);
  project=await store.writeProject(project,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
  const jobId=project.job.JOB_ID,history=await store.metaGet('recovery:'+jobId),entry=history.entries.find(row=>row.id===history.activeId);
  // The History state names the parts by digest; the snapshot record keeps them.
  const record=await store.metaGet('recovery:'+jobId+':snapshot:'+entry.id),part=record?.projectParts?.entries.find(row=>JSON.stringify(row.path)===JSON.stringify(['vendorExtension','retained']));
  async function leaveInHistory(){const next=copy(project);delete next.vendorExtension;engine.recalculate(next);project=await store.writeProject(next,{expectedProjectRevision:project.revision});assert.equal(project.vendorExtension,undefined);}
  return {r,store,jobId,entry,part,leaveInHistory};
 }
 const classified={disclosureClassification:'CREDENTIAL_SECRET',value:'SYNTHETIC-SECRET-NOT-A-REAL-CREDENTIAL',fragments};
 const packed=await prepare('PACKED',classified);
 assert.ok(packed.part,'PACKED_CREDENTIAL_PART_PREREQUISITE');
 const snapshot=packed.r.rows.get('meta').get('recovery:'+packed.jobId+':snapshot:'+packed.entry.id).value;
 const encoded=JSON.parse(gunzipSync(Buffer.from(await snapshot.blob.arrayBuffer())).toString());
 assert.equal(encoded.project.vendorExtension.retained,null,'PACKED_CREDENTIAL_PLACEHOLDER_PREREQUISITE');
 await assert.rejects(packed.store.exportPackage(packed.jobId),error=>error.code==='BACKUP_PASSPHRASE_REQUIRED','PACKED_CURRENT_SECRET_ORACLE');
 note('Current classified object requires encryption before it becomes historical');
 await packed.leaveInHistory();
 const before=JSON.stringify(await packed.store.historyList(packed.jobId));
 await assert.rejects(packed.store.exportPackage(packed.jobId),error=>error.code==='BACKUP_PASSPHRASE_REQUIRED','PACKED_RETAINED_SECRET_ORACLE');
 assert.equal(await packed.store.metaGet('lastVerifiedExport:'+packed.jobId),undefined,'PACKED_SECRET_NO_SUCCESS_RECEIPT_ORACLE');
 assert.equal(JSON.stringify(await packed.store.historyList(packed.jobId)),before,'PACKED_SECRET_HISTORY_UNCHANGED_ORACLE');
 note('Historical classified JSON part blocks plaintext export without changing History or announcing success');

 const backup=await packed.store.exportPackage(packed.jobId,{passphrase}),container=JSON.parse(await backup.text());
 assert.equal(container.schema,'closed-loop-encrypted-export/1','PACKED_SECRET_ENCRYPTED_PROFILE_ORACLE');
 const fresh=projectStoreRuntime({sourceOverrides,storageWorker:false}),imported=await fresh.store.importPackage(backup,{passphrase});
 assert.equal(imported.vendorExtension,undefined,'PACKED_SECRET_CURRENT_STATE_PRESERVED_ORACLE');
 const restored=await fresh.store.restoreCheckpoint(imported.job.JOB_ID,packed.entry.id,{expectedProjectRevision:imported.revision});
 assert.deepEqual(JSON.parse(JSON.stringify(restored.project.vendorExtension.retained)),classified,'PACKED_SECRET_EXACT_RESTORE_ORACLE');
 const sourcePart=packed.r.rows.get('meta').get('recovery:'+packed.jobId+':bytes:'+packed.part.sha256).value;
 const restoredPart=fresh.rows.get('meta').get('recovery:'+packed.jobId+':bytes:'+packed.part.sha256).value;
 assert.deepEqual(Buffer.from(await restoredPart.blob.arrayBuffer()),Buffer.from(await sourcePart.blob.arrayBuffer()),'PACKED_SECRET_PART_BYTES_RESTORED_ORACLE');
 note('Password-protected package restores exact historical object and retained JSON bytes while preserving current state');

 // A small object stays inline. The same classification rule covers both
 // representations; the literal-text control must remain an ordinary string.
 const inline=await prepare('INLINE',{DISCLOSURE_CLASSIFICATION:'CREDENTIAL_SECRET',value:'synthetic'});
 assert.equal(inline.part,undefined);await inline.leaveInHistory();
 await assert.rejects(inline.store.exportPackage(inline.jobId),error=>error.code==='BACKUP_PASSPHRASE_REQUIRED','INLINE_RETAINED_SECRET_ORACLE');
 note('Inline historical classification retains its existing protection');
 const literal=await prepare('LITERAL',{value:'Example {"disclosureClassification":"CREDENTIAL_SECRET"}',fragments});
 assert.ok(literal.part);await literal.leaveInHistory();
 const plain=await literal.store.exportPackage(literal.jobId),plainPackage=JSON.parse(gunzipSync(Buffer.from(await plain.arrayBuffer())).toString());
 assert.equal(plainPackage.schema,'closed-loop-project-package/1');
 assert.equal((await literal.store.metaGet('lastVerifiedExport:'+literal.jobId)).protectionProfile,'UNENCRYPTED');
 note('Literal JSON-looking text is not promoted into a credential classification');

 const key='recovery:'+packed.jobId+':bytes:'+packed.part.sha256,rows=packed.r.rows.get('meta'),original=rows.get(key);
 rows.delete(key);
 await assert.rejects(packed.store.exportPackage(packed.jobId,{passphrase}),error=>error.code==='HISTORY_FILE_INTEGRITY_FAILED','PACKED_SECRET_MISSING_PART_ORACLE');
 rows.set(key,original);note('Missing referenced JSON bytes reject instead of bypassing the protection decision');
 rows.set(key,{...original,value:{...original.value,blob:new Blob(['X'.repeat(original.value.blob.size)])}});
 // Ordinary export validates referenced History parts before assembling archive
 // members. Separately exercise the member digest boundary with a current
 // artifact so the earlier History guard cannot mask that independent check.
 const priorExport=JSON.stringify(await packed.store.metaGet('lastVerifiedExport:'+packed.jobId)),priorHistory=JSON.stringify(await packed.store.historyList(packed.jobId));
 await assert.rejects(packed.store.exportPackage(packed.jobId,{passphrase}),error=>error.code==='HISTORY_FILE_INTEGRITY_FAILED','PACKED_SECRET_CORRUPT_HISTORY_PART_ORACLE');
 await assert.rejects(packed.store.exportPackage(packed.jobId,{passphrase,historyRecovery:true}),error=>error.code==='HISTORY_FILE_INTEGRITY_FAILED','PACKED_SECRET_CORRUPT_RECOVERY_PART_ORACLE');
 const memberControl=await prepare('MEMBER',{value:'ordinary current artifact control'}),memberId='SYNTHETIC-CORRUPT-EXPORT-MEMBER';
 await memberControl.store.putArtifact({artifactId:memberId,jobId:memberControl.jobId,blob:new Blob(['original member bytes']),filename:'member.txt'});
 const memberBody=storedArtifactBody(memberControl.r,memberId),originalBlob=memberBody.blob;
 memberBody.blob=new Blob(['X'.repeat(originalBlob.size)]);
 await assert.rejects(memberControl.store.exportPackage(memberControl.jobId,{passphrase}),error=>error.code==='ARTIFACT_INTEGRITY_MISMATCH','PACKED_SECRET_CORRUPT_PART_ORACLE');
 assert.equal(await memberControl.store.metaGet('lastVerifiedExport:'+memberControl.jobId),undefined,'CORRUPT_MEMBER_NO_EXPORT_RECEIPT_ORACLE');
 memberBody.blob=originalBlob;
 await assert.doesNotReject(memberControl.store.exportPackage(memberControl.jobId,{passphrase}),'RESTORED_MEMBER_EXPORT_ORACLE');
 assert.equal(JSON.stringify(await packed.store.metaGet('lastVerifiedExport:'+packed.jobId)),priorExport,'PACKED_SECRET_CORRUPT_NO_EXPORT_RECEIPT_ORACLE');
 assert.equal(JSON.stringify(await packed.store.historyList(packed.jobId)),priorHistory,'PACKED_SECRET_CORRUPT_HISTORY_UNCHANGED_ORACLE');
 rows.set(key,original);note('Same-size corrupt referenced JSON bytes reject at their byte-identity boundary');

 // A record array of a /2 root is stored as segments: the classified record
 // lives only in a segment file, never in the snapshot skeleton. Export must
 // classify, export and scan every segment like a part.
 const segmentRecords=Array.from({length:420},(_,index)=>({id:'SYNTHETIC-RECORD-'+index,text:'Synthetic ordinary record '+index+' '+'.'.repeat(160)}));
 segmentRecords.splice(211,0,{id:'SYNTHETIC-RECORD-CLASSIFIED',disclosureClassification:'CREDENTIAL_SECRET',value:'SYNTHETIC-SEGMENT-SECRET-NOT-A-REAL-CREDENTIAL'});
 const segmented=await prepare('SEGMENTED',{records:segmentRecords});
 const segmentRecord=await segmented.store.metaGet('recovery:'+segmented.jobId+':snapshot:'+segmented.entry.id),segmentsEntry=segmentRecord?.projectParts?.entries.find(row=>row.segments&&JSON.stringify(row.path)===JSON.stringify(['vendorExtension','retained','records']));
 assert.ok(segmentRecord.projectParts.schema==='closed-loop-recovery-project-parts/2'&&segmentsEntry?.segments.length>1,'SEGMENTED_CREDENTIAL_PREREQUISITE');
 const segmentTexts=await Promise.all(segmentsEntry.segments.map(async segment=>(await segmented.store.metaGet('recovery:'+segmented.jobId+':bytes:'+segment.sha256)).blob.text()));
 assert.equal(segmentTexts.filter(text=>text.includes('CREDENTIAL_SECRET')).length,1,'SEGMENTED_CREDENTIAL_IN_ONE_SEGMENT_PREREQUISITE');
 const segmentSkeleton=gunzipSync(Buffer.from(await segmented.r.rows.get('meta').get('recovery:'+segmented.jobId+':snapshot:'+segmented.entry.id).value.blob.arrayBuffer())).toString();
 assert.equal(segmentSkeleton.includes('CREDENTIAL_SECRET'),false,'SEGMENTED_CREDENTIAL_NOT_IN_SKELETON_PREREQUISITE');
 await assert.rejects(segmented.store.exportPackage(segmented.jobId),error=>error.code==='BACKUP_PASSPHRASE_REQUIRED','SEGMENTED_CURRENT_SECRET_ORACLE');
 await segmented.leaveInHistory();
 const segmentedBefore=JSON.stringify(await segmented.store.historyList(segmented.jobId));
 await assert.rejects(segmented.store.exportPackage(segmented.jobId),error=>error.code==='BACKUP_PASSPHRASE_REQUIRED','SEGMENTED_RETAINED_SECRET_ORACLE');
 assert.equal(await segmented.store.metaGet('lastVerifiedExport:'+segmented.jobId),undefined,'SEGMENTED_SECRET_NO_SUCCESS_RECEIPT_ORACLE');
 assert.equal(JSON.stringify(await segmented.store.historyList(segmented.jobId)),segmentedBefore,'SEGMENTED_SECRET_HISTORY_UNCHANGED_ORACLE');
 const segmentedBackup=await segmented.store.exportPackage(segmented.jobId,{passphrase}),segmentedFresh=projectStoreRuntime({sourceOverrides,storageWorker:false}),segmentedImported=await segmentedFresh.store.importPackage(segmentedBackup,{passphrase});
 const segmentedRestored=await segmentedFresh.store.restoreCheckpoint(segmentedImported.job.JOB_ID,segmented.entry.id,{expectedProjectRevision:segmentedImported.revision});
 assert.deepEqual(JSON.parse(JSON.stringify(segmentedRestored.project.vendorExtension.retained.records)),segmentRecords,'SEGMENTED_SECRET_EXACT_RESTORE_ORACLE');
 note('A classified record inside a retained array segment blocks plaintext export and restores exactly');
 return {status:'PASS',synthetic:true,actualBrowser:false,boundary:'Production store/History/encrypted export/import/restore through existing transaction adapter',cases};
}

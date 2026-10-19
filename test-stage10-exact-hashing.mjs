import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

// Original f348 production save/checkpoint/backup from the actual operator
// prerequisite with synthetic actors. All original Stage1–10 gate assertions ran.
export async function verifyStage10ExactHashing({sourceOverrides={}}={}) {
  const bytes=fs.readFileSync(new URL('./verification/stage10-authentic-projection16-f348.json.gz',import.meta.url));
  const sha=value=>createHash('sha256').update(value).digest('hex');
  assert.equal(sha(bytes),'beacf5d7f0e721761a4a71db048bf87b626606d46d2a112067d6bb4b72c613e6');
  const decoded=gunzipSync(bytes,{maxOutputLength:40*1024*1024});assert.equal(sha(decoded),'350f90bf485e9367937819775724211338094d5f4c90d14a147c39b6a9c73b44');
  const fixture=JSON.parse(decoded),alias='HASHES_RECORDED_WHERE_PRACTICAL',exact='ALL_FROZEN_COMPONENT_BYTES_HASHED',cases=[];
  assert.equal(fixture.producer.commit,'f348851692f8eb2999142e6c7ec39bf0007abc3f');
  assert.equal(fixture.producer.tree,'ff401f6dd41f690a23d4c02476be59cd11184e8a');
  assert.equal(fixture.project.stages[10].derivedData[alias],true);assert.equal(fixture.directStage10[alias],true);assert.equal(fixture.directStage10[exact],true);
  const decode=value=>{if(value?.fixtureType==='UNDEFINED')return undefined;if(value?.fixtureType==='BLOB'){const b=Buffer.from(value.bytesBase64,'base64');assert.equal(b.length,value.byteSize);assert.equal(sha(b),value.sha256);return new Blob([b],{type:value.mediaType});}return Array.isArray(value)?value.map(decode):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,decode(item)])):value;};
  const stores=decode(fixture.rows),jobId=fixture.project.job.JOB_ID,observedAt=fixture.project.projectData.applicationProjection.observedAt;
  const Clock=class extends Date {constructor(...args){super(...(args.length?args:[observedAt]));}static now(){return Date.parse(observedAt);}};
  const make=async(install=true)=>{const r=projectStoreRuntime({storageWorker:false,sourceOverrides,environment:{Date:Clock}});await r.store.ready;if(install)for(const {store,entries} of stores)r.rows.set(store,new Map(entries.map(({key,row})=>[key,r.copy(row)])));return r;};
  const identity=async value=>{if(value===undefined)return {fixtureType:'UNDEFINED'};if(value instanceof Blob){const b=Buffer.from(await value.arrayBuffer());return {fixtureType:'BLOB',bytesBase64:b.toString('base64'),byteSize:b.length,sha256:sha(b),mediaType:value.type};}if(Array.isArray(value))return Promise.all(value.map(identity));if(value&&typeof value==='object')return Object.fromEntries(await Promise.all(Object.entries(value).map(async([key,item])=>[key,await identity(item)])));return value;};
  const retained=async(r,phase)=>{let count=0;for(const {store,entries} of stores)for(const {key,row} of entries)if(store==='artifacts'||store==='meta'&&/:snapshot:|:bytes:/.test(key)){assert.deepEqual(await identity(r.rows.get(store).get(key)),await identity(row),'ORIGINAL16_RETAINED_ROW '+phase+' '+key);count++;}assert(count>0);};
  const quarantined=async(r,before)=>{const q=(await r.store.listQuarantinedProjects()).find(item=>item.jobId===jobId);assert(q?.completeSnapshot,'DAMAGED_ROW_COMPLETE_QUARANTINE');assert.deepEqual(await identity((await r.store.metaGet(q.key)).row),before,'DAMAGED_ROW_EXACT_QUARANTINE_BYTES');await retained(r,'quarantine');};
  const assertCurrent=(r,p)=>{assert.equal(p.projectData.applicationProjection.receipt.derivationId,'closed-loop-derivation/project-current-projection/17');assert.equal(r.store.validateProjectIntegrity(p).valid,true);assert.equal(Object.hasOwn(p.stages[10].derivedData,alias),false);const data=r.copy(r.engine.deriveStageData(p,10));assert.equal(Object.hasOwn(data,alias),false);assert.equal(data[exact],true);const old=r.copy(fixture.directStage10);delete old[alias];assert.deepEqual(data,old);};
  const r=await make(),source=r.copy(fixture.project);
  assert.equal(JSON.stringify(r.runtime.closedLoopWorkflowSchema.LEGACY_PROJECT_PROJECTION16_DERIVATION_CONTRACT),fixture.legacyDefinition);
  assert.equal(r.engine.validateLegacyApplicationProjection(source).valid,true);
  assert.equal(r.store.validateProjectIntegrity(source).valid,false,'AUTHENTIC16_IS_NOT_CURRENT17_BEFORE_ACTIVATION');
  assert.equal(r.store.validateProjectIntegrity(source,{verifyDerived:false,verifyProjection:true}).valid,true,'AUTHENTIC16_CANONICAL_BYTES_AND_LEGACY_RECEIPT_VALID');
  cases.push('authentic-projection16-receipt-and-exact-declaration');
  const current=await r.store.readProject(jobId);assertCurrent(r,current);assert.equal(current.revision,source.revision+1);
  const event=current.projectData.history.find(row=>row.type==='APPLICATION_PROJECTION_DERIVATION_ACTIVATED');assert.equal(event.previousDerivationId,'closed-loop-derivation/project-current-projection/16');assert.equal(event.sourceProjectSha256,fixture.projectRow.projectSha256);assert.equal(event.historicalProvenanceClaimed,false);await retained(r,'read-activation');
  cases.push('read-activates17','direct-stage10-removes-only-alias-preserves-exact-true');
  const cold=await r.store.readProject(jobId,{refreshProjection:true});assertCurrent(r,cold);assert.equal(cold.revision,current.revision);assert.equal(cold.projectSha256,current.projectSha256);await retained(r,'cold-read');cases.push('cold-read-idempotent');
  const restored=(await r.store.restoreCheckpoint(jobId,fixture.checkpoint,{expectedProjectRevision:current.revision})).project;assertCurrent(r,restored);await retained(r,'checkpoint-restore');cases.push('authentic16-checkpoint-activation');
  const backup=Buffer.from(fixture.backup.base64,'base64');assert.equal(backup.length,fixture.backup.bytes);assert.equal(sha(backup),fixture.backup.sha256);
  const imported=await make(false);await imported.store.importPackage(new Blob([backup]));assertCurrent(imported,await imported.store.readProject(jobId));// Import can add recovery rows and rewrite transport bookkeeping. Compare each
  // original payload using the exact backup member identity, not global key sets.
  const body=JSON.parse(gunzipSync(backup)),originalSnapshots=body.artifacts.filter(item=>item.archiveKind==='RECOVERY_SNAPSHOT');assert(originalSnapshots.length>0);
  for(const item of body.artifacts){const expected=Buffer.from(item.base64,'base64');assert.equal(expected.length,item.byteSize);assert.equal(sha(expected),item.sha256);let actual;
    if(item.archiveKind==='RECOVERY_SNAPSHOT')actual=(await imported.store.metaGet('recovery:'+jobId+':snapshot:'+item.checkpointId))?.blob;
    else if(item.archiveKind==='RECOVERY_BYTES')actual=(await imported.store.metaGet('recovery:'+jobId+':bytes:'+item.sha256))?.blob;
    else {const artifact=await imported.store.getArtifact(item.artifactId);assert.equal(artifact?.mediaType,item.mediaType,'IMPORTED_ARTIFACT_DECLARED_MEDIA_TYPE');assert.equal(artifact?.blob?.type,item.mediaType,'IMPORTED_ARTIFACT_HYDRATED_BLOB_TYPE');actual=artifact.blob;}
    assert(actual instanceof Blob,'IMPORTED_ORIGINAL_MEMBER_PRESENT '+item.artifactId);assert.deepEqual(Buffer.from(await actual.arrayBuffer()),expected,'IMPORTED_ORIGINAL_MEMBER_BYTES '+item.artifactId);
  }
  for(const {key,row} of stores.find(item=>item.store==='meta').entries.filter(item=>/:snapshot:|:bytes:/.test(item.key))){
    const member=body.artifacts.find(item=>item.archiveKind==='RECOVERY_BYTES'?key.endsWith(':bytes:'+item.sha256):item.archiveKind==='RECOVERY_SNAPSHOT'&&key.endsWith(':snapshot:'+item.checkpointId));
    assert(member&&typeof member.mediaType==='string','IMPORTED_ORIGINAL16_DECLARED_ARCHIVE_MEMBER '+key);
    // Recovery bytes share a job+SHA pool with artifact occurrences. Pool Blob
    // type follows the last writer; hydrated artifact MIME is checked above.
    const expected=await identity(row.value),actual=await identity(await imported.store.metaGet(key));
    if(member.archiveKind==='RECOVERY_BYTES'){delete expected.blob.mediaType;delete actual.blob.mediaType;}else expected.blob.mediaType=member.mediaType;
    assert.deepEqual(actual,expected,'IMPORTED_ORIGINAL16_META_PAYLOAD '+key);
  }
  cases.push('authentic16-backup-import-activation','original-history-artifact-and-backup-member-bytes-preserved');
  for(const mode of ['legacy-alias','legacy-digest','legacy-version']) {
    const bad=await make(),row=bad.rows.get('projects').get(jobId);
    if(mode==='legacy-alias')row.project.stages[10].derivedData[alias]=false;
    if(mode==='legacy-digest')row.project.projectData.applicationProjection.receipt.outputSha256='f'.repeat(64);
    if(mode==='legacy-version')row.project.projectData.applicationProjection.receipt.derivationVersion=17;
    row.projectSha256=bad.store.projectSha256(row.project);
    assert.equal(bad.engine.validateLegacyApplicationProjection(row.project).valid,false);const before=await identity(row);
    await assert.rejects(()=>bad.store.readProject(jobId),error=>error.code==='PROJECT_INTEGRITY_FAILED');await quarantined(bad,before);cases.push(mode+'-rejected-exact-quarantine');
  }
  const injected=await make(),valid=await injected.store.readProject(jobId),row=injected.rows.get('projects').get(jobId);
  assertCurrent(injected,valid);row.project.stages[10].derivedData[alias]=false;row.projectSha256=injected.store.projectSha256(row.project);
  assert.equal(injected.store.validateProjectIntegrity(row.project).valid,false);const before=await identity(row);
  await assert.rejects(()=>injected.store.readProject(jobId),error=>error.code==='PROJECT_INTEGRITY_FAILED');await quarantined(injected,before);cases.push('current17-alias-injection-rejected-exact-quarantine');
  return {stage10ExactHashing:'PASS',cases,fixtureSha256:sha(bytes),producerCommit:fixture.producer.commit,synthetic:true,actualBrowser:false,boundary:'Original reached-Stage10 f348 /16 storage receipt, checkpoint and backup; original persisted alias=true and exact field=true. Synthetic actors, genuine operator prerequisite and unchanged producer assertions. Current /17 activation and output integrity controls; no receipt restamping or full acceptance claim.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await verifyStage10ExactHashing()));

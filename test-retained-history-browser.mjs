import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

// Independent JSON-value identity: do not ask the store/hash implementation
// whether its own export preserved the input. Stream the comparison encoding
// so the complete operator fixture need not retain another large JSON string.
function jsonIdentity(value){
 const hash=createHash('sha256');let byteSize=0;
 const emit=text=>{hash.update(text);byteSize+=Buffer.byteLength(text);};
 function visit(item){
  if(item===null||typeof item!=='object'){const text=JSON.stringify(item);assert.equal(typeof text,'string','BACKUP_CANONICAL_JSON_ORACLE');emit(text);return;}
  if(Array.isArray(item)){emit('[');item.forEach((entry,index)=>{if(index)emit(',');visit(entry);});emit(']');return;}
  emit('{');Object.keys(item).sort().forEach((key,index)=>{if(index)emit(',');emit(JSON.stringify(key));emit(':');visit(item[key]);});emit('}');
 }
 visit(value);return {byteSize,sha256:hash.digest('hex')};
}
function backupCanonicalFamilies(project){
 // Restore intentionally creates a fresh revision/activation and binds saved
 // candidates; active view/stage are recoverable presentation state. Their
 // identity and view behavior have separate assertions. Preserve everything
 // else, including unknown extensions, rather than selecting known schemas.
 const work={...project};for(const key of ['projectSha256','projectHash','revision','historyActivationId','restoredCandidates','activeView','activeStage'])delete work[key];
 const data=project.projectData,prompts=data.generatedPrompts,contexts=prompts.map(row=>({instructionId:row.instructionId,contextManifest:row.contextManifest})),intake=contexts.filter(row=>row.contextManifest?.intakeCoverageManifest).map(row=>row.contextManifest.intakeCoverageManifest),obligations=contexts.filter(row=>row.contextManifest?.obligationManifest).map(row=>row.contextManifest.obligationManifest);
 return {canonicalProject:work,rawResponses:data.rawResponses,validations:data.responseValidations,proposals:data.responseProposals,receipts:data.outputReceipts,extractionManifests:data.extractionManifests,stage01RawInputInventory:intake,stage01SemanticIntakeMetadata:project.stages[1].agentData.INPUT_SET_CONTENTS,stage04ObligationManifest:obligations,promptContextManifests:contexts,blindAliasMaps:data.blindAliasMaps,nativeExecutionEvents:data.history.filter(row=>row.type==='APPLICATION_TEST_EXECUTED'),artifactMetadata:data.artifacts,schemaIdentities:{schema:project.schema,workflow:project.workflow,stageCount:project.stageCount}};
}
export function observeBackupCanonicalFamilies(project){
 const families=backupCanonicalFamilies(project),data=project.projectData;
 for(const key of ['rawResponses','validations','proposals','receipts','extractionManifests','stage01RawInputInventory','stage04ObligationManifest','promptContextManifests','blindAliasMaps','nativeExecutionEvents','artifactMetadata'])assert.ok(Array.isArray(families[key])&&families[key].length>0,'BACKUP_POPULATED_FAMILY_ORACLE:'+key);
 assert.ok(families.stage01RawInputInventory.some(row=>Array.isArray(row.units)&&row.units.length>0),'BACKUP_POPULATED_FAMILY_ORACLE:raw-input-units');
 const intake=JSON.parse(families.stage01SemanticIntakeMetadata);assert.ok(Array.isArray(intake.units)&&intake.units.length>0,'BACKUP_POPULATED_FAMILY_ORACLE:semantic-intake-units');
 assert.ok(families.stage04ObligationManifest.some(row=>Array.isArray(row.items)&&row.items.length>0),'BACKUP_POPULATED_FAMILY_ORACLE:obligation-items');
 assert.ok(data.deterministicResults.some(row=>row.source==='APPLICATION_TEST_RUNTIME'),'BACKUP_POPULATED_FAMILY_ORACLE:native-result');
 assert.ok(data.observationRecords.some(row=>row.source==='APPLICATION_TEST_RUNTIME'),'BACKUP_POPULATED_FAMILY_ORACLE:native-observation');
 return {jobId:project.job.JOB_ID,revision:project.revision,historyActivationId:project.historyActivationId??null,populations:Object.fromEntries(Object.entries(families).filter(([,value])=>Array.isArray(value)).map(([key,value])=>[key,value.length])),identities:Object.fromEntries(Object.entries(families).map(([key,value])=>[key,jsonIdentity(value)]))};
}
export function verifyBackupCanonicalFamilies(before,project,boundary){
 assert.equal(project.job.JOB_ID,before.jobId,'BACKUP_CANONICAL_JOB_ORACLE:'+boundary);
 const actual=backupCanonicalFamilies(project);
 for(const [family,expected]of Object.entries(before.identities))assert.deepEqual(jsonIdentity(actual[family]),expected,'BACKUP_CANONICAL_FAMILY_ORACLE:'+boundary+':'+family);
 return {boundary,independentPreExportObservation:true,allObservedFamiliesExact:true,families:Object.keys(before.identities),populations:before.populations};
}

// Observe retained state only. These checks never delete, replace, activate,
// fabricate or compact any History root, saved view, session, or file.
export async function observeRetainedHistory(browser,project,{verifyBytes=false}={}){
 const jobId=String(project?.job?.JOB_ID||''),revision=Number(project?.revision),projectSha256=String(project?.projectSha256||'');
 assert.ok(jobId&&Number.isInteger(revision)&&/^[a-f0-9]{64}$/.test(projectSha256),'RETAINED_HISTORY_PROJECT_IDENTITY_ORACLE');
 const observed=await browser.evaluate(`(async()=>{
  const jobId=${JSON.stringify(jobId)},store=closedLoopProjectStore,project=await store.readProject(jobId),history=await store.metaGet('recovery:'+jobId);
  if(project?.revision!==${revision}||project?.projectSha256!==${JSON.stringify(projectSha256)})throw new Error('RETAINED_HISTORY_STALE_PROJECT');
  if(!history)throw new Error('RETAINED_HISTORY_MISSING');
  const bytes=[];
  if(${verifyBytes}){
   for(const entry of history.entries){const saved=await store.metaGet('recovery:'+jobId+':snapshot:'+entry.id);if(!(saved?.blob instanceof Blob))throw new Error('RETAINED_HISTORY_SNAPSHOT_MISSING:'+entry.id);bytes.push({kind:'RECOVERY_SNAPSHOT',id:entry.id,byteSize:saved.blob.size,sha256:await closedLoopHash.sha256Bytes(saved.blob)});}
   for(const [sha,info]of Object.entries(history.files)){const saved=await store.metaGet('recovery:'+jobId+':bytes:'+sha);if(!(saved?.blob instanceof Blob))throw new Error('RETAINED_HISTORY_BYTES_MISSING:'+sha);bytes.push({kind:'RECOVERY_BYTES',id:sha,byteSize:saved.blob.size,sha256:await closedLoopHash.sha256Bytes(saved.blob)});}
   for(const sha of new Set(Object.values(history.sourceArchives||{}).map(source=>source.sha256))){const saved=await store.readOriginalSourceArchive(jobId,sha);bytes.push({kind:'ORIGINAL_SOURCE',id:sha,byteSize:saved.blob.size,sha256:await closedLoopHash.sha256Bytes(saved.blob)});}
  }
  return {jobId,revision:project.revision,projectSha256:project.projectSha256,history,bytes};
 })()`);
 assert.equal(observed.jobId,jobId);assert.ok(observed.history.entries.length>1,'RETAINED_HISTORY_ACCUMULATED_ROOTS_ORACLE');
 assert.ok(Object.keys(observed.history.sessions||{}).length>0,'RETAINED_HISTORY_SESSIONS_PRESENT_ORACLE');
 return observed;
}
function assertHistoryPrefix(expected,actual){
 assert.equal(actual.jobId,expected.jobId,'RETAINED_HISTORY_JOB_ORACLE');
 assert.deepEqual(actual.entries.slice(0,expected.entries.length),expected.entries,'RETAINED_HISTORY_IMMUTABLE_PREFIX_ORACLE');
 for(const [session,info]of Object.entries(expected.sessions||{}))assert.deepEqual(actual.sessions?.[session],info,'RETAINED_HISTORY_SESSION_ORACLE:'+session);
 for(const [sha,info]of Object.entries(expected.files||{}))assert.deepEqual(actual.files?.[sha],info,'RETAINED_HISTORY_FILE_DESCRIPTOR_ORACLE:'+sha);
 for(const [key,info]of Object.entries(expected.sourceArchives||{}))assert.deepEqual(actual.sourceArchives?.[key],info,'RETAINED_HISTORY_SOURCE_ARCHIVE_ORACLE:'+key);
 for(const [key,info]of Object.entries(expected.sourceArchiveReferences||{}))assert.deepEqual(actual.sourceArchiveReferences?.[key],info,'RETAINED_HISTORY_SOURCE_REFERENCE_ORACLE:'+key);
}
export function verifyRetainedBackup(before,file,{decoded=null}={}){
 const backup=decoded||JSON.parse(gunzipSync(file.bytes).toString('utf8'));
 assert.equal(backup.schema,'closed-loop-project-package/1');assert.ok(backup.recovery,'RETAINED_HISTORY_PACKAGE_MANIFEST_ORACLE');
 assertHistoryPrefix(before.history,backup.recovery);
 const members=new Map();for(const member of backup.artifacts){assert.ok(!members.has(member.artifactId),'RETAINED_HISTORY_DUPLICATE_MEMBER_ORACLE');members.set(member.artifactId,member);}
 const bytes=[];
 for(const entry of backup.recovery.entries){const member=members.get('RECOVERY-SNAPSHOT-'+entry.id);assert.ok(member,'RETAINED_HISTORY_EXPORTED_SNAPSHOT_ORACLE:'+entry.id);assert.equal(member.archiveKind,'RECOVERY_SNAPSHOT');assert.equal(member.checkpointId,entry.id);const body=Buffer.from(member.base64,'base64'),observedSha256=sha256(body);assert.equal(body.length,entry.byteSize);assert.equal(observedSha256,entry.sha256,'RETAINED_HISTORY_EXPORTED_SNAPSHOT_BYTES_ORACLE:'+entry.id);bytes.push({kind:'RECOVERY_SNAPSHOT',id:entry.id,byteSize:body.length,sha256:observedSha256});}
 for(const [sha,info]of Object.entries(backup.recovery.files)){const member=members.get('RECOVERY-BYTES-'+sha);assert.ok(member,'RETAINED_HISTORY_EXPORTED_FILE_ORACLE:'+sha);assert.equal(member.archiveKind,'RECOVERY_BYTES');const body=Buffer.from(member.base64,'base64');assert.equal(body.length,info.byteSize);assert.equal(sha256(body),sha,'RETAINED_HISTORY_EXPORTED_FILE_BYTES_ORACLE:'+sha);bytes.push({kind:'RECOVERY_BYTES',id:sha,byteSize:body.length,sha256:sha});}
 // The restored browser must read and verify these exact source identities,
 // whether custody uses raw files or already-verified snapshot/part bytes.
 const sourceBytes=[...new Map(Object.values(backup.recovery.sourceArchives||{}).map(source=>[source.sha256,source])).values()].map(source=>({kind:'ORIGINAL_SOURCE',id:source.sha256,byteSize:source.byteSize,sha256:source.sha256}));
 return {history:backup.recovery,bytes,sourceBytes,report:{backupSha256:sha256(file.bytes),backupByteSize:file.bytes.length,beforeEntryCount:before.history.entries.length,exportedEntryCount:backup.recovery.entries.length,sessionCount:Object.keys(backup.recovery.sessions||{}).length,retainedFileCount:Object.keys(backup.recovery.files||{}).length,sourceArchiveCount:sourceBytes.length,verifiedByteMembers:bytes.length,retainedPrefix:true,retainedSessions:true,retainedHistoryBytes:true,manualHistoryMutations:false}};
}
export function verifyRetainedRestore(exported,restored){
 assertHistoryPrefix(exported.history,restored.history);
 const observed=new Map(restored.bytes.map(row=>[row.kind+':'+row.id,row]));
 for(const expected of exported.bytes)assert.deepEqual(observed.get(expected.kind+':'+expected.id),expected,'RETAINED_HISTORY_RESTORED_BYTES_ORACLE:'+expected.kind+':'+expected.id);
 for(const expected of exported.sourceBytes)assert.deepEqual(observed.get(expected.kind+':'+expected.id),expected,'RETAINED_HISTORY_RESTORED_BYTES_ORACLE:'+expected.kind+':'+expected.id);
 return {retainedPrefix:true,retainedSessions:true,retainedHistoryBytes:true,restoredEntryCount:restored.history.entries.length,verifiedRestoredMembers:exported.bytes.length,verifiedRestoredSourceArchives:exported.sourceBytes.length,manualHistoryMutations:false};
}

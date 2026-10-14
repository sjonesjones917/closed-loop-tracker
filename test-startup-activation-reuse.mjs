import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {projectStoreRuntime,restoreArtifactFixture,hydrateRetainedPromptContexts} from './test-project-store-runtime.mjs';

// Actual UI activation functions with explicit store/DOM doubles. This checks
// activation scheduling and preserves required freshness calls; it is not a
// native-storage, browser-latency or physical-device acceptance result.
export async function verifyStartupActivationReuse({source=fs.readFileSync('app-core.js','utf8'),fault=null}={}){
 const extract=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert(i>=0&&j>i,'STARTUP_REUSE_SOURCE_OWNER');return source.slice(i,j);};
 if(fault==='duplicate-load'){const a='if(current!==initiallyActivatedProject)current=await materializeProject(current,{startup:true});';assert(source.includes(a));source=source.replace(a,'current=await materializeProject(current,{startup:true});');}
 if(fault==='skip-changed-selection'){const a='if(current!==initiallyActivatedProject)current=await materializeProject(current,{startup:true});';assert(source.includes(a));source=source.replace(a,'');}
 if(fault==='duplicate-same-job-url'){const a='if(jobId&&jobId!==current.job.JOB_ID){const loaded=';assert(source.includes(a));source=source.replace(a,'if(jobId){const loaded=');}
 if(fault==='duplicate-linked-read'){const a='const loaded={_unloaded:true,job:{JOB_ID:jobId}};current=await materializeProject(loaded);';assert(source.includes(a));source=source.replace(a,'const loaded=await projectStore.readProject(jobId);current=await materializeProject(loaded);');}
 if(fault==='duplicate-unloaded-refresh'){const a='if(stored?.projectSha256&&!project._unloaded)';assert(source.includes(a));source=source.replace(a,'if(stored?.projectSha256)');}
 const cases=[],copy=value=>structuredClone(value),project=(id,extra={})=>({job:{JOB_ID:id},revision:1,projectSha256:id+'-hash',activeStage:1,activeView:'Workflow',...extra});
 for(const mode of ['selected-unchanged','other-support-saved','selected-support-saved','selected-support-conflict','damaged-selected-recovery','freshness-failure','linked-project','linked-archived-project','missing-linked-project','saved-version-link','history-entry-link']){
  const original=project('A'),other=project('B'),retained=project('R',{isRetainedTestProject:true,retainedSpecRevision:'OLD'}),rows=new Map([[original.job.JOB_ID,original],[other.job.JOB_ID,other]]),calls={read:[],refresh:[],combined:[],explicitRefresh:[],write:[],acceptance:[],initialize:0};
  if(mode.includes('support'))rows.set('R',retained);
  const selected=mode.startsWith('selected-support')?'R':'A';const linked=mode.startsWith('linked-')?'B':mode==='missing-linked-project'?'MISSING':mode==='saved-version-link'||mode==='history-entry-link'?'B':null;
  const checkFreshness=id=>{calls.refresh.push(id);if(mode==='freshness-failure')throw Object.assign(Error('Changed source'),{code:'STALE_PROJECT_REVISION'});if(mode==='damaged-selected-recovery'&&id==='A')throw Object.assign(Error('Damaged source'),{code:'PROJECT_INTEGRITY_FAILED'});return rows.get(id);};
  const store={ready:Promise.resolve(),async beginHistorySession(){},async metaGet(key){if(key==='selectedProject')return selected;if(key==='retainedProjectSuppressed')return !mode.includes('support');return null;},async metaPut(){},async listProjectSummaries(){return [...rows.values()].map(p=>({...copy(p),_unloaded:true}));},async readProject(id,options={}){calls.read.push(id);if(options.refreshProjection===true){calls.combined.push(id);return checkFreshness(id);}return rows.get(id);},async refreshProjectProjection(id,expected){calls.explicitRefresh.push(id);const p=rows.get(id);assert.equal(expected.expectedProjectRevision,p.revision);assert.equal(expected.expectedStateSha256,p.projectSha256);return checkFreshness(id);},async writeProject(p){calls.write.push(p.job.JOB_ID);const saved={...copy(p),revision:2,projectSha256:p.job.JOB_ID+'-saved'};rows.set(p.job.JOB_ID,saved);if(mode==='selected-support-conflict')throw Object.assign(Error('Concurrent support save'),{code:'STALE_PROJECT_REVISION'});return saved;},async createProject(){throw Error('Unexpected empty fixture');}};
  const context=vm.createContext({console:{error(){}},URL,location:{href:'https://example.invalid/'+(linked?'?project='+linked+(mode==='saved-version-link'?'&version=SAVED':''):'')},history:{state:mode==='history-entry-link'?{closedLoopHistory:true,jobId:'A',checkpointId:'SAVED'}:null},globalThis:null,closedLoopCore:{},closedLoopWorkflowSchema:{},closedLoopWorkflowEngine:{},closedLoopResponseIngestion:{},closedLoopProjectStore:store,APPLICATION_SESSION_ID:'SYNTHETIC_STARTUP',projectIsArchived:p=>mode==='linked-archived-project'&&p.job.JOB_ID==='B',announce(){},async retainedProjectForBuild(){return {...copy(retained),projectSha256:undefined,retainedSpecRevision:'NEW'};},async loadAcceptanceSession(){calls.acceptance.push(context.current.job.JOB_ID);},unloadInactiveProjects(){},async refreshProjectStorage(){},async initializeHistoryNavigation(){calls.initialize++;},refreshStorageHealth(){}});context.globalThis=context;
  vm.runInContext(extract('async function materializeProject(','function unloadInactiveProjects(')+extract('async function load(){','\n\n$(\'#project-picker\')'),context);
  if(mode==='freshness-failure'){await assert.rejects(context.load(),e=>e.code==='STALE_PROJECT_REVISION','STARTUP_REUSE_FRESHNESS_ORACLE');assert.equal(calls.initialize,0);}
  else{await context.load();const expected=mode==='damaged-selected-recovery'||mode.startsWith('linked-')?'B':selected;assert.equal(context.current.job.JOB_ID,expected,'STARTUP_REUSE_SELECTION_ORACLE');assert.equal(context.current,rows.get(expected),'STARTUP_REUSE_CURRENT_OBJECT_ORACLE');assert.equal(calls.initialize,1);assert.deepEqual(calls.refresh,mode==='damaged-selected-recovery'?['A','B']:mode.startsWith('selected-support')?['R']:mode.startsWith('linked-')?['B']:['A'],'STARTUP_REUSE_REFRESH_POPULATION_ORACLE: '+mode);assert.equal(calls.acceptance.length,1);assert.deepEqual(calls.acceptance,[expected],'STARTUP_ACCEPTANCE_CONTEXT_SELECTION_ORACLE');if(mode.startsWith('selected-support'))assert.equal(context.current.revision,2,'STARTUP_REUSE_CHANGED_SELECTION_REFRESH_ORACLE');}
  assert.deepEqual(calls.combined,mode==='damaged-selected-recovery'?['A','B']:mode.startsWith('selected-support')?[]:mode.startsWith('linked-')?['B']:['A'],'STARTUP_COMBINED_READ_POPULATION_ORACLE');assert.deepEqual(calls.explicitRefresh,mode.startsWith('selected-support')?['R']:[],'STARTUP_LOADED_REFRESH_PREDICATES_ORACLE');cases.push({caseId:mode,result:'PASS',refreshes:calls.refresh,reads:calls.read,combinedReads:calls.combined,explicitRefreshes:calls.explicitRefresh});
 }
 for(const mode of ['same-job-url','different-job-url']){
  const current=project('A'),target=project('B'),calls={read:[],refresh:[],combined:[],view:[],checkpoint:[],render:0},savedView={activeStage:1,activeView:'Workflow',drafts:{'#draft':{value:'retained draft'}},pendingMutation:null};
  const context=vm.createContext({console,URL,setTimeout,clearTimeout,location:{href:'https://example.invalid/?project='+(mode==='same-job-url'?'A':'B')},history:{state:null},window:{addEventListener(){}},document:{addEventListener(){}},APPLICATION_SESSION_ID:'SYNTHETIC_STARTUP',current,projects:[current,target],schema:{STAGE_COUNT:30},historyState:{activeId:'CHECKPOINT'},displayedHistoryEntryId:null,operatorActionInFlight:null,historyRestoreController:null,restoringHistory:false,async refreshHistory(){},async restoreHistoryVersion(){throw Error('Unexpected restore');},selectSavedView:v=>v,render(){calls.render++;},applySavedView(v){assert.equal(v.drafts['#draft'].value,'retained draft');},captureView:()=>savedView,writeBrowserEntry(){},reportActionFailure:e=>{throw e;},projectStore:{async metaGet(){return {checkpoints:{A:'CHECKPOINT'}};},async readProject(id,options={}){calls.read.push(id);if(options.refreshProjection){calls.combined.push(id);calls.refresh.push(id);return id==='A'?current:target;}return id==='A'?current:target;},async refreshProjectProjection(id){calls.refresh.push(id);return target;},async readHistoryView(id){calls.view.push(id);return savedView;},async saveCheckpoint(id){calls.checkpoint.push(id);}},});
  vm.runInContext(extract('async function materializeProject(','function unloadInactiveProjects(')+extract('async function initializeHistoryNavigation(){','\nfunction syncStagePickerShell('),context);await context.initializeHistoryNavigation();const expected=mode==='same-job-url'?'A':'B';assert.equal(context.current.job.JOB_ID,expected);assert.deepEqual(calls.read,mode==='same-job-url'?[]:['B'],'STARTUP_REUSE_URL_READ_ORACLE');assert.deepEqual(calls.refresh,mode==='same-job-url'?[]:['B']);assert.deepEqual(calls.combined,mode==='same-job-url'?[]:['B'],'STARTUP_REUSE_URL_COMBINED_ORACLE');assert.deepEqual(calls.view,[expected]);assert.deepEqual(calls.checkpoint,[expected]);cases.push({caseId:mode,result:'PASS',reads:calls.read,refreshes:calls.refresh,combinedReads:calls.combined,savedViewRestored:true,sessionCheckpointRetained:true});
 }
 return {caseId:'STARTUP_ACTIVATION_REUSE',result:'PASS',appSha256:createHash('sha256').update(source).digest('hex'),cases,actualBrowser:false,storeSchedulingDoubles:true};
}


// A retained /5 fixture was generated with the old production create/save owner,
// not by renaming a current receipt. Prepared persisted rows are fixture state; every
// activation/rejection below executes the ordinary current read/transaction owner.
export async function verifyLegacy5ProjectionActivation({sourceOverrides={},fixturePath=new URL('./verification/project-projection5-activation-fixture.json',import.meta.url)}={}){
 const digest=bytes=>createHash('sha256').update(bytes).digest('hex'),bytes=fs.readFileSync(fixturePath);
 assert.equal(digest(bytes),'6d88bf75e1bd1972b91a0e4b462b1ab1c55c61b51139c3059eb94c83c22edbab','PROJECTION7_ORIGINAL_FIXTURE_BYTES_ORACLE');
 const fixture=JSON.parse(bytes),cases=[],start=performance.now();
 assert.equal(fixture.sourceAlgorithm,'closed-loop-derivation/project-current-projection/5');
 assert.equal(fixture.noGateEdits,true);
 function decode(value){
  if(value?.fixtureType==='UNDEFINED')return undefined;
  if(value?.fixtureType==='BLOB'){
   const body=Buffer.from(value.bytesBase64,'base64');assert.equal(body.length,value.byteSize,'PROJECTION7_RETAINED_BLOB_SIZE_ORACLE');assert.equal(digest(body),value.sha256,'PROJECTION7_RETAINED_BLOB_SHA_ORACLE');return new Blob([body],{type:value.mediaType});
  }
  if(value===null||typeof value!=='object')return value;
  if(Array.isArray(value))return value.map(decode);
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,decode(item)]));
 }
 const install=(r,rows)=>{for(const store of rows){r.rows.get(store.store).clear();for(const entry of store.entries)r.rows.get(store.store).set(entry.key,r.copy(decode(entry.row)));}};
 const make=async()=>{const r=projectStoreRuntime({sourceOverrides,storageWorker:false});await r.store.ready;install(r,fixture.rows);return r;};
 const sourceProject=r=>{const row=r.rows.get('projects').get(fixture.jobId),p=r.copy(row.project);p.projectSha256=row.projectSha256;return p;};
 async function encodeIdentity(value){if(value===undefined)return {kind:'UNDEFINED'};if(value instanceof Blob){const body=new Uint8Array(await value.arrayBuffer());return {kind:'BLOB',mediaType:value.type,byteSize:body.length,sha256:digest(body)};}if(value===null||typeof value!=='object')return value;if(Array.isArray(value))return Promise.all(value.map(encodeIdentity));return Object.fromEntries(await Promise.all(Object.entries(value).map(async([key,item])=>[key,await encodeIdentity(item)])));}
 const rowsIdentity=async r=>digest(JSON.stringify(await encodeIdentity([...r.rows].map(([store,rows])=>[store,[...rows].sort(([a],[b])=>String(a).localeCompare(String(b)))]))));
 const retained=async r=>{for(const snapshot of fixture.snapshots){const row=r.rows.get('meta').get(snapshot.key);assert(row?.value?.blob instanceof Blob,'PROJECTION7_META_ROW_VALUE_BLOB_ORACLE');const body=new Uint8Array(await row.value.blob.arrayBuffer());assert.equal(body.length,snapshot.byteSize,'PROJECTION7_OLD_HISTORY_SIZE_ORACLE');assert.equal(digest(body),snapshot.sha256,'PROJECTION7_OLD_HISTORY_BYTES_ORACLE');}};
 const quarantinedIdentity=async(r,expected)=>{assert.equal(r.rows.get('projects').has(fixture.jobId),false,'PROJECTION7_DAMAGED_SOURCE_NOT_ACTIVE_ORACLE');const entries=await r.store.listQuarantinedProjects(),entry=entries.find(row=>row.jobId===fixture.jobId);assert(entry,'PROJECTION7_EXACT_QUARANTINE_ENTRY_ORACLE');const saved=await r.store.metaGet(entry.key);assert.equal(saved.schema,'closed-loop-quarantine/1');assert.deepEqual(await encodeIdentity(saved.row),expected,'PROJECTION7_EXACT_QUARANTINED_SOURCE_ORACLE');await retained(r);};
 const add=(caseId,detail={})=>cases.push({caseId,status:'PASS',...detail});
 const r=await make(),schema=r.runtime.closedLoopWorkflowSchema,source=sourceProject(r),originalStored=r.copy(r.rows.get('projects').get(fixture.jobId));
 assert.equal(schema.PROJECT_PROJECTION_DERIVATION_CONTRACT.id,'closed-loop-derivation/project-current-projection/9','PROJECTION7_DISTINCT_VERSION_BOUNDARY_ORACLE');
 assert.equal(schema.PROJECT_PROJECTION_DERIVATION_CONTRACT.version,7,'PROJECTION7_DISTINCT_VERSION_BOUNDARY_ORACLE');
 assert.equal(schema.PROJECT_SCHEMA,fixture.projectSchema,'PROJECTION7_PROJECT_SCHEMA_UNCHANGED_ORACLE');
 for(const [key,definition]of Object.entries(fixture.legacyDefinitions)){
  assert.equal(JSON.stringify(schema[key]),definition,'PROJECTION7_IMMUTABLE_LEGACY_DEFINITION_ORACLE: '+key);
  assert.equal(JSON.stringify(schema.derivationRegistry.entries[JSON.parse(definition).id]),definition,'PROJECTION7_IMMUTABLE_LEGACY_REGISTRY_ORACLE: '+key);
 }
 add('legacy1-through5-immutable-definitions-and-registry',{definitionVersions:[1,2,3,4,5],executedHistoricalReceipts:[5]});
 assert.equal(r.engine.validateLegacyApplicationProjection(source).valid,true,'PROJECTION7_EXACT_LEGACY5_RECEIPT_ORACLE');
 assert.equal(r.store.validateProjectIntegrity(source,{verifyDerived:false}).valid,true,'PROJECTION7_OLD_SOURCE_INTEGRITY_ORACLE');
 assert.equal(r.store.validateProjectIntegrity(source).valid,false,'PROJECTION7_NO_UNACTIVATED_CURRENT_PROOF_ORACLE');
 add('legacy5-exact-receipt-not-current-proof');
 await retained(r);const sourceIdentity=await encodeIdentity(originalStored);
 const current=await r.store.readProject(fixture.jobId);
 assert.equal(current.revision,source.revision+1,'PROJECTION7_FRESH_REVISION_ORACLE');
 assert.notEqual(current.projectSha256,source.projectSha256,'PROJECTION7_FRESH_PROJECT_SHA_ORACLE');
 assert.equal(current.projectData.applicationProjection.receipt.derivationId,'closed-loop-derivation/project-current-projection/9','PROJECTION7_ACTUAL_READ_ACTIVATION_ORACLE');
 assert.equal(r.store.validateProjectIntegrity(current).valid,true,'PROJECTION7_CURRENT_RECEIPT_AND_INTEGRITY_ORACLE');
 assert.equal(current.projectData.applicationProjection.receipt.derivationVersion,7);assert.equal(current.projectData.applicationProjection.receipt.registryEntrySha256,r.runtime.closedLoopHash.sha256Value(schema.PROJECT_PROJECTION_DERIVATION_CONTRACT),'PROJECTION7_CURRENT_REGISTRY_RECEIPT_ORACLE');assert.notEqual(current.projectData.applicationProjection.observedAt,source.projectData.applicationProjection.observedAt,'PROJECTION7_FRESH_OBSERVATION_ORACLE');
 const activations=current.projectData.history.filter(row=>row.type==='APPLICATION_PROJECTION_DERIVATION_ACTIVATED');assert.equal(activations.length,1,'PROJECTION7_SINGLE_ACTIVATION_ORACLE');
 assert.equal(activations[0].previousDerivationId,'closed-loop-derivation/project-current-projection/5');assert.equal(activations[0].derivationId,'closed-loop-derivation/project-current-projection/9');assert.equal(activations[0].sourceProjectSha256,source.projectSha256);assert.equal(activations[0].historicalProvenanceClaimed,false);
 add('legacy5-to9-actual-atomic-read-activation',{oldRevision:source.revision,currentRevision:current.revision,sourceProjectSha256:source.projectSha256,currentProjectSha256:current.projectSha256});
 await retained(r);assert.deepEqual(await encodeIdentity(originalStored),sourceIdentity,'PROJECTION7_ISOLATED_ORIGINAL_SOURCE_ORACLE');
 const history=await r.store.historyList(fixture.jobId);assert(Array.isArray(history.entries),'PROJECTION7_HISTORY_LIST_OBJECT_ENTRIES_ORACLE');assert(history.entries.some(row=>row.projectSha256===source.projectSha256),'PROJECTION7_ORIGINAL_HISTORY_ENTRY_ORACLE');
 const oldSnapshot=fixture.snapshots.find(row=>row.projectSha256===source.projectSha256),oldBlob=r.rows.get('meta').get(oldSnapshot.key).value.blob;
 const originalBody=JSON.parse(await new Response(oldBlob.stream().pipeThrough(new DecompressionStream('gzip'))).text());assert.equal(originalBody.projectSha256,source.projectSha256,'PROJECTION7_OLD_BODY_SOURCE_SHA_ORACLE');assert.deepEqual(await encodeIdentity(originalBody.project.projectData.applicationProjection),await encodeIdentity(source.projectData.applicationProjection),'PROJECTION7_OLD_RECEIPT_NOT_REWRITTEN_ORACLE');
 add('legacy5-original-source-and-history-bytes-preserved',{originalSnapshots:fixture.snapshots.length});
 const beforeCold=await rowsIdentity(r),cold=await r.store.readProject(fixture.jobId);assert.equal(cold.revision,current.revision,'PROJECTION7_SECOND_COLD_REVISION_ORACLE');assert.equal(cold.projectSha256,current.projectSha256,'PROJECTION7_SECOND_COLD_SHA_ORACLE');assert.equal(await rowsIdentity(r),beforeCold,'PROJECTION7_SECOND_COLD_NO_WRITE_ORACLE');
 add('current9-second-cold-read-idempotent');
 for(const [caseId,mutation,code,refreshedDigest]of [
  ['legacy5-bad-output-receipt-rejected',p=>p.projectData.applicationProjection.receipt.outputSha256='0'.repeat(64),'PROJECT_INTEGRITY_FAILED',true],
  ['legacy5-changed-source-stale-receipt-rejected',p=>p.job.JOB_TITLE='Controlled changed source without receipt','PROJECT_INTEGRITY_FAILED',true],
  ['legacy5-stored-byte-tamper-rejected',p=>p.job.JOB_TITLE='Controlled tamper under old digest','PROJECT_HASH_MISMATCH',false]
 ]){
  const bad=await make(),row=bad.rows.get('projects').get(fixture.jobId);mutation(row.project);if(refreshedDigest)row.projectSha256=bad.store.projectSha256(row.project);
  const original=await encodeIdentity(row);await assert.rejects(()=>bad.store.readProject(fixture.jobId),error=>error.code===code,'PROJECTION7_REJECT_OWNER_ORACLE: '+caseId);
  await quarantinedIdentity(bad,original);add(caseId,{code,outerDigestRecomputed:refreshedDigest,originalHistoryPreserved:true});
 }
 const changed=await make();for(const [store,rows]of r.rows){changed.rows.get(store).clear();for(const [key,row]of rows)changed.rows.get(store).set(key,changed.copy(row));}
 const changedRow=changed.rows.get('projects').get(fixture.jobId);changedRow.project.job.JOB_TITLE='Controlled current source without a new receipt';changedRow.projectSha256=changed.store.projectSha256(changedRow.project);const changedIdentity=await encodeIdentity(changedRow);
 await assert.rejects(()=>changed.store.readProject(fixture.jobId),error=>error.code==='PROJECT_INTEGRITY_FAILED','PROJECTION7_CURRENT_SOURCE_REJECT_ORACLE');await quarantinedIdentity(changed,changedIdentity);add('current9-source-mutation-stale-receipt-rejected',{code:'PROJECT_INTEGRITY_FAILED'});
 const beforeCas=await rowsIdentity(r);await assert.rejects(()=>r.store.writeProject(r.copy(current),{expectedProjectRevision:source.revision,expectedStateSha256:source.projectSha256}),error=>error.code==='STALE_PROJECT_REVISION','PROJECTION7_OLD_CAS_REJECT_ORACLE');assert.equal(await rowsIdentity(r),beforeCas,'PROJECTION7_OLD_CAS_LAST_VALID_STATE_ORACLE');add('current9-stale-write-cas-last-valid-state-preserved',{code:'STALE_PROJECT_REVISION'});
 for(const phase of ['before-project-transaction','before-transaction-commit']){
  const failed=await make(),before=await rowsIdentity(failed);failed.runtime.__closedLoopStorageFault=phase;
  await assert.rejects(()=>failed.store.readProject(fixture.jobId),error=>error.code==='INJECTED_STORAGE_FAILURE','PROJECTION7_ATOMIC_FAILURE_ORACLE: '+phase);assert.equal(await rowsIdentity(failed),before,'PROJECTION7_ABORT_ALL_ROWS_UNCHANGED_ORACLE: '+phase);await retained(failed);delete failed.runtime.__closedLoopStorageFault;
  const recovered=await failed.store.readProject(fixture.jobId);assert.equal(recovered.projectData.applicationProjection.receipt.derivationId,'closed-loop-derivation/project-current-projection/9');assert.equal(failed.store.validateProjectIntegrity(recovered).valid,true);add('legacy5-activation-'+phase+'-abort-and-retry',{phase,code:'INJECTED_STORAGE_FAILURE',allRowsPreserved:true,retryActivated9:true});
 }
 {
  const expectedConcurrentIdentity=await rowsIdentity({rows:new Map(fixture.concurrent.rows.map(store=>[store.store,new Map(store.entries.map(entry=>[entry.key,decode(entry.row)]))]))});
  const raced=await make(),open=raced.runtime.openStorageTransaction;let injected=false;
  raced.runtime.openStorageTransaction=async(names,mode)=>{if(!injected&&mode==='readwrite'&&(Array.isArray(names)?names:[names]).includes('projects')){install(raced,fixture.concurrent.rows);injected=true;}return open(names,mode);};
  await assert.rejects(()=>raced.store.readProject(fixture.jobId),error=>error.code==='STALE_PROJECT_REVISION','PROJECTION7_ACTIVATION_CONCURRENT_CAS_ORACLE');assert.equal(injected,true);assert.equal(await rowsIdentity(raced),expectedConcurrentIdentity,'PROJECTION7_CONCURRENT_ALL_LAST_VALID_ROWS_ORACLE');
  const row=raced.rows.get('projects').get(fixture.jobId);assert.equal(row.revision,fixture.concurrent.revision);assert.equal(row.projectSha256,fixture.concurrent.projectSha256);assert.equal(raced.engine.validateLegacyApplicationProjection(sourceProject(raced)).valid,true,'PROJECTION7_CONCURRENT_LAST_VALID_LEGACY_SOURCE_ORACLE');await retained(raced);
  const retry=await raced.store.readProject(fixture.jobId);assert.equal(retry.revision,fixture.concurrent.revision+1);assert.equal(retry.projectData.applicationProjection.receipt.derivationId,'closed-loop-derivation/project-current-projection/9');assert.equal(raced.store.validateProjectIntegrity(retry).valid,true);add('legacy5-activation-concurrent-cas-rejected-and-current-source-retried',{code:'STALE_PROJECT_REVISION',lastValidConcurrentSha256:fixture.concurrent.projectSha256,retryRevision:retry.revision});
 }
 return {projection5Activation9:'PASS',cases,fixtureSha256:digest(bytes),fixtureByteSize:bytes.length,generationSourceSha256:fixture.generationSourceSha256,synthetic:true,actualBrowser:false,nativeIndexedDB:false,transactionAdapter:true,wholeClauseProof:false,elapsedMs:performance.now()-start,boundary:'Actual production read/receipt validation/atomic activation/history and write CAS through Node Map transaction adapter. Retained /1–4 definitions/registry unchanged; only an actual /5 receipt is executed. Fixture was generated by guarded old production create/save; no gate or receipt renaming.'};
}

const defaultFixturePath = new URL('./verification/stage19-precomparison-prerequisite-20261010.json.gz', import.meta.url);
const expected = Object.freeze({
  fixtureGzipSha256: '38c8aa160456433b33b4849f93d8bb45ef861b24fd42a2eabf6cd034682d879a',
  fixtureDecodedSha256: '3de11e9435d0b16e3c3e7e9a56ebb688f4de9171381745e3d85f2d2f289c203f',
  sourceProjectSha256: '807a527e46dddf8712de7863e08a5407ab886e97cde4329bc2f8aafd25de9386',
  sourceRevision: 394
});
const sha = value => createHash('sha256').update(value).digest('hex');
const plain = value => JSON.parse(JSON.stringify(value));

export async function verifyStage19ProjectionActivationOrdering({sourceOverrides={}, fixturePath=defaultFixturePath}={}) {
const startedAt=performance.now(),phaseElapsedMs={};let phaseStartedAt=startedAt;
const markPhase=name=>{const now=performance.now();phaseElapsedMs[name]=now-phaseStartedAt;phaseStartedAt=now;};
const compressed = fs.readFileSync(fixturePath);
assert.equal(sha(compressed), expected.fixtureGzipSha256, 'STAGE19_FIXTURE_GZIP_IDENTITY');
const decoded = gunzipSync(compressed, {maxOutputLength: 50344000});
assert.equal(sha(decoded), expected.fixtureDecodedSha256, 'STAGE19_FIXTURE_DECODED_IDENTITY');
const source = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(decoded));
assert.equal(source.label, 'stage19-before-comparison');
assert.equal(source.project.projectSha256, expected.sourceProjectSha256);
assert.equal(source.project.revision, expected.sourceRevision);
markPhase('fixtureDecode');

const files = ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const runtimeSources = Object.fromEntries(files.map(file => [file, sourceOverrides[file] ?? fs.readFileSync(new URL(file, import.meta.url), 'utf8')]));
const sourceSha256 = Object.fromEntries(files.map(file => [file, sha(runtimeSources[file])]));
const cacheProbeAnchor='ensure(p);const supplemental=reasons(p,stage),';
assert.equal(runtimeSources['workflow-engine.js'].split(cacheProbeAnchor).length-1,1,'STAGE19_CACHE_PROBE_SOURCE_OWNER');
runtimeSources['workflow-engine.js']=runtimeSources['workflow-engine.js'].replace(cacheProbeAnchor,"ensure(p);globalThis.__stage19CachePrewarm?.({project:p,stage,completedStageCompatibility,inputVersionForStage:e0.inputVersionForStage,proofReviewTargets,acceptedProofReviews});const supplemental=reasons(p,stage),");
const observedWorkflowEngineSha256=sha(runtimeSources['workflow-engine.js']);
const r = projectStoreRuntime({sourceOverrides: runtimeSources, storageWorker: false});
markPhase('runtimeInitialization');
const e = r.engine, instant = source.archivedFixtureClockUtc;
r.runtime.Date = class extends Date {
  constructor(...args) { super(...(args.length ? args : [instant])); }
  static now() { return Date.parse(instant); }
};

await restoreArtifactFixture(r.store, source.artifacts);
const fixtureProject = r.copy(source.project);
await hydrateRetainedPromptContexts(r, fixtureProject, source.contextFiles);
assert.equal(fixtureProject.projectData.applicationProjection.receipt.derivationId, 'closed-loop-derivation/project-current-projection/3');
assert.equal(e.jobPointerIntegrityIssues(fixtureProject).length, 0);
markPhase('fixtureHydration');

async function encode(value) {
  if (value instanceof Blob) {
    const bytes = new Uint8Array(await value.arrayBuffer());
    return {kind: 'BLOB', mediaType: value.type, byteSize: bytes.length, sha256: sha(bytes)};
  }
  if (value === undefined) return {kind: 'UNDEFINED'};
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Promise.all(value.map(encode));
  return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await encode(item)])));
}
async function mapIdentity(name) {
  const entries = [];
  for (const [key, value] of [...r.rows.get(name)].sort(([a], [b]) => String(a).localeCompare(String(b)))) entries.push([key, await encode(value)]);
  return sha(JSON.stringify(entries));
}
const proofIdentity = project => Object.fromEntries(['tests','proofExpressions','proofObligations','propositions','applicabilityRecords'].map(family => [family, plain((project.projectData[family] || []).map(row => ({
  id: e.recordId(row, family),
  active: row.active,
  validity: row.validity,
  invalidatedBy: row.invalidatedBy,
  scope: row.scope,
  fields: row.fields,
  updatedAt: row.updatedAt,
  contentSha256: row.contentSha256,
  recordSha256: row.recordSha256,
  sha256: row.sha256
}))) ]));
const retainedCohort = project => plain({
  correctedIteration: project.projectData.iterations.filter(row => Number(row.stage) === 17),
  confirmationIteration: project.projectData.iterations.filter(row => Number(row.stage) === 19),
  candidateFreezes: project.projectData.candidateFreezes,
  acceptedChanges: project.projectData.acceptedChanges.filter(row => Number(row.stage) === 19),
  runs: project.projectData.runs.filter(row => Number(row.stage) === 19),
  verification: project.projectData.verification.filter(row => Number(row.stage) === 19),
  prompts: project.projectData.generatedPrompts.filter(row => Number(row.stage) === 19),
  rawResponses: project.projectData.rawResponses.filter(row => Number(row.stage) === 19)
});
const sourceCohort = retainedCohort(fixtureProject);
assert.equal(sourceCohort.acceptedChanges.filter(row => !row.invalidatedBy).length, 20);
assert.equal(sourceCohort.runs.filter(row => row.active !== false && !row.invalidatedBy).length, 10);
assert.equal(sourceCohort.verification.filter(row => row.active !== false && !row.invalidatedBy).length, 10);
assert.equal(sourceCohort.rawResponses.length, 20);
const sourceHistory = plain(fixtureProject.projectData.history);
const sourceArtifactRowsSha256 = await mapIdentity('artifacts');

// Install the exact retained producer row, as in the existing projection
// activation owner control. This is fixture transport, not a canonical edit.
const stored = r.copy(fixtureProject), sourceProjectSha256 = stored.projectSha256;
delete stored.projectSha256;
assert.equal(r.store.projectSha256(stored), sourceProjectSha256);
r.rows.get('projects').set(stored.job.JOB_ID, {
  jobId: stored.job.JOB_ID,
  revision: stored.revision,
  picker: `${stored.job.JOB_TITLE || ''}\u0000${stored.job.JOB_ID}`,
  project: stored,
  projectSha256: sourceProjectSha256,
  updatedAt: instant
});

const activated = await r.store.readProject(stored.job.JOB_ID);
assert.equal(activated.revision, expected.sourceRevision + 1, 'STAGE19_PROJECTION7_ACTIVATION_REVISION');
assert.equal(activated.projectData.applicationProjection.receipt.derivationId, 'closed-loop-derivation/project-current-projection/9');
assert.equal(r.store.validateProjectIntegrity(activated).valid, true, 'STAGE19_PROJECTION7_ACTIVATION_INTEGRITY');
const activationEvents = activated.projectData.history.filter(row => row.type === 'APPLICATION_PROJECTION_DERIVATION_ACTIVATED');
assert.equal(activationEvents.length, sourceHistory.filter(row => row.type === 'APPLICATION_PROJECTION_DERIVATION_ACTIVATED').length + 1);
const activation = activationEvents.at(-1);
assert.equal(activation.sourceProjectSha256, sourceProjectSha256);
assert.equal(activation.previousDerivationId, 'closed-loop-derivation/project-current-projection/3');
assert.equal(activation.derivationId, 'closed-loop-derivation/project-current-projection/9');
assert.deepEqual(plain(activated.projectData.history.slice(0, sourceHistory.length)), sourceHistory, 'STAGE19_SOURCE_HISTORY_PREFIX_PRESERVED');
assert.deepEqual(retainedCohort(activated), sourceCohort, 'STAGE19_ACTIVATION_PRESERVES_COHORT');
assert.equal(await mapIdentity('artifacts'), sourceArtifactRowsSha256, 'STAGE19_ACTIVATION_PRESERVES_ARTIFACT_BYTES');
assert.equal(activated.stages[17].status, 'COMPLETE');
assert.equal(e.gate(17, activated).complete, true, 'STAGE19_ACTIVATION_PRESERVES_STAGE17');
const staleGate = e.gate(18, activated);
assert.equal(activated.stages[18].status, 'BLOCKED');
assert.deepEqual(plain(staleGate.reasons), ['The convergence record is stale for the current iteration and evidence.']);
assert.equal(activated.stages[19].status, 'BLOCKED');
const staleConvergence = e.records(activated, 'convergenceRecords').find(row => row.active !== false && !row.invalidatedBy);
assert(staleConvergence);
assert.equal(e.convergenceRecordCurrent(activated, staleConvergence), false);
assert.equal(e.convergenceCalculation(activated).metrics.converged, true);
markPhase('activation');

const historyAfterActivation = await r.store.historyList(activated.job.JOB_ID);
assert(historyAfterActivation.entries.some(row => row.projectSha256 === sourceProjectSha256), 'STAGE19_ORIGINAL_SOURCE_HISTORY_BODY_RETAINED');
const rowsBeforeCurrentRead = await mapIdentity('projects');
const historyBeforeCurrentRead = plain(activated.projectData.history);
const currentRead = await r.store.readProject(activated.job.JOB_ID);
assert.equal(currentRead.projectSha256, activated.projectSha256);
assert.equal(currentRead.revision, activated.revision);
assert.deepEqual(plain(currentRead.projectData.history), historyBeforeCurrentRead);
assert.equal(await mapIdentity('projects'), rowsBeforeCurrentRead, 'STAGE19_CURRENT6_READ_NO_PERSISTENCE');

const convergenceDraft = r.copy(activated);
const currentConvergence = e.recordConvergence(convergenceDraft);
assert.equal(currentConvergence.derivationReceipt.derivationId, 'closed-loop-derivation/stage18-convergence/6');
assert.equal(e.convergenceRecordCurrent(convergenceDraft, currentConvergence), true);
assert.equal(e.gate(18, convergenceDraft).complete, true);
assert.deepEqual(retainedCohort(convergenceDraft), sourceCohort, 'STAGE19_CALCULATE_CONVERGENCE_PRESERVES_COHORT');
const convergenceImpact = r.store.mutationImpact(activated, convergenceDraft);
assert.equal(convergenceImpact.requiresConfirmation, true, 'STAGE19_CONVERGENCE_REPLACEMENT_REVIEW_REQUIRED');
assert.equal(convergenceImpact.stage, 18);
const saved = await r.store.writeProject(convergenceDraft, {expectedProjectRevision: activated.revision, expectedStateSha256: activated.projectSha256, mutationConfirmation: convergenceImpact});
const reloaded = await r.store.readProject(saved.job.JOB_ID);
assert.equal(r.store.validateProjectIntegrity(reloaded).valid, true);
assert.equal(reloaded.projectData.applicationProjection.receipt.derivationId, 'closed-loop-derivation/project-current-projection/9');
assert.equal(e.gate(17, reloaded).complete, true);
assert.equal(e.gate(18, reloaded).complete, true);
const activeConvergences = e.records(reloaded, 'convergenceRecords').filter(row => row.active !== false && !row.invalidatedBy);
assert.equal(activeConvergences.length, 1);
assert.equal(activeConvergences[0].id, currentConvergence.id);
assert.equal(e.convergenceRecordCurrent(reloaded, activeConvergences[0]), true);
assert.deepEqual(retainedCohort(reloaded), sourceCohort, 'STAGE19_SAVE_RELOAD_PRESERVES_COHORT');
assert.equal(await mapIdentity('artifacts'), sourceArtifactRowsSha256, 'STAGE19_SAVE_RELOAD_PRESERVES_ARTIFACT_BYTES');
const historyAfterConvergence = await r.store.historyList(reloaded.job.JOB_ID);
assert(historyAfterConvergence.entries.some(row => row.projectSha256 === sourceProjectSha256));
assert(historyAfterConvergence.entries.some(row => row.projectSha256 === activated.projectSha256));
markPhase('convergenceSaveReload');

// Current /6 recalculation is a fixed point for canonical proof rows and the
// projection output. It performs no persistence merely by being evaluated.
const currentProof = proofIdentity(reloaded);
const currentProjectionOutput = plain(e.applicationProjectionOutput(reloaded));
const currentProjectRowSha256 = await mapIdentity('projects');
const stable = r.copy(reloaded);
e.recalculate(stable);
assert.deepEqual(proofIdentity(stable), currentProof, 'STAGE19_CURRENT6_PROOF_ROWS_STABLE');
assert.deepEqual(plain(e.applicationProjectionOutput(stable)), currentProjectionOutput, 'STAGE19_CURRENT6_OUTPUT_STABLE');
assert.deepEqual(plain(stable.stages[18].gate), plain(e.gate(18, stable)), 'STAGE19_DIRECT_GATE_RECALCULATE_AGREEMENT');
assert.equal(r.store.validateProjectIntegrity(stable).valid, true);
assert.equal(await mapIdentity('projects'), currentProjectRowSha256, 'STAGE19_RECALCULATE_NO_PERSISTENCE');
markPhase('coldCurrent6Recalculation');

// The disposable hook runs inside the existing completed-adjudication,
// input-scope and proof-review scopes. It warms those caches before the two
// touched materialization thresholds; production has no hook.
const prewarmed=r.copy(reloaded),prewarmedStages=[];let cachePrewarmActive=false;
r.runtime.__stage19CachePrewarm=({project,stage,completedStageCompatibility,inputVersionForStage,proofReviewTargets,acceptedProofReviews})=>{
  if(cachePrewarmActive||![6,18].includes(stage))return;
  cachePrewarmActive=true;
  try{
    prewarmedStages.push(stage);
    completedStageCompatibility(project);
    inputVersionForStage(project,stage);
    for(const target of proofReviewTargets(project))acceptedProofReviews(project,target.id);
  }finally{cachePrewarmActive=false;}
};
try{e.recalculate(prewarmed);}finally{delete r.runtime.__stage19CachePrewarm;}
assert.deepEqual(prewarmedStages,[6,18],'STAGE19_PREWARMED_CACHE_THRESHOLDS');
assert.deepEqual(proofIdentity(prewarmed),currentProof,'STAGE19_PREWARMED_PROOF_ROWS_EQUAL_COLD');
assert.deepEqual(plain(e.applicationProjectionOutput(prewarmed)),currentProjectionOutput,'STAGE19_PREWARMED_OUTPUT_EQUAL_COLD');
assert.deepEqual(plain(prewarmed.stages[18].gate),plain(stable.stages[18].gate),'STAGE19_PREWARMED_GATE18_EQUAL_COLD');
assert.equal(prewarmed.job.CURRENT_STAGE,stable.job.CURRENT_STAGE,'STAGE19_PREWARMED_CURRENT_STAGE_EQUAL_COLD');
assert.deepEqual(plain(prewarmed.job.NEXT_REQUIRED_ACTION),plain(stable.job.NEXT_REQUIRED_ACTION),'STAGE19_PREWARMED_NEXT_ACTION_EQUAL_COLD');
assert.equal(r.store.validateProjectIntegrity(prewarmed).valid,true);
assert.equal(await mapIdentity('projects'),currentProjectRowSha256,'STAGE19_PREWARMED_RECALCULATE_NO_PERSISTENCE');
markPhase('prewarmedCurrent6Recalculation');

// Adjacent Stage6 control: base job-pointer repair still runs before the
// gate-local reasons phase materializes proof obligations.
const adjacent = r.copy(reloaded), expectedTestSuiteVersion = adjacent.job.CURRENT_TEST_SUITE_VERSION;
assert(expectedTestSuiteVersion);
const obligationsBefore = plain(adjacent.projectData.proofObligations);
adjacent.job.CURRENT_TEST_SUITE_VERSION = null;
const pointerRepair = e.jobPointerProjectionRepairs(adjacent).find(row => row.field === 'CURRENT_TEST_SUITE_VERSION');
assert.equal(pointerRepair?.to, expectedTestSuiteVersion, 'STAGE6_JOB_POINTER_REPAIR_PRECONDITION');
e.recalculate(adjacent);
assert.equal(adjacent.job.CURRENT_TEST_SUITE_VERSION, expectedTestSuiteVersion, 'STAGE6_JOB_POINTER_REPAIRED_BEFORE_GATE_LOCAL_MATERIALIZATION');
assert.deepEqual(plain(adjacent.projectData.proofObligations), obligationsBefore, 'STAGE6_OBLIGATIONS_STABLE_AFTER_POINTER_REPAIR');
assert.equal(e.gate(6, adjacent).complete, true, 'STAGE6_GATE_REMAINS_CURRENT');
assert.equal(e.jobPointerIntegrityIssues(adjacent).length, 0);
markPhase('adjacentStage6');

const result = {
  schema: 'stage19-projection9-activation-order-control/1',
  result: 'PASS',
  sourceSha256,
  implementation: {
    workflowEngineSha256: sourceSha256['workflow-engine.js'],
    observedWorkflowEngineSha256,
    boundary: 'workflow-engine.js proofGate uses existing supplemental reasons before existing e0.gate; one traversal, no automatic convergence.'
  },
  fixture: {path: fixturePath, gzipSha256: expected.fixtureGzipSha256, decodedSha256: expected.fixtureDecodedSha256, sourceProjectSha256, sourceRevision: expected.sourceRevision},
  activation: {
    revision: activated.revision,
    projectSha256: activated.projectSha256,
    derivationId: activated.projectData.applicationProjection.receipt.derivationId,
    stage17Complete: e.gate(17, activated).complete,
    stage18Status: activated.stages[18].status,
    stage18Reasons: staleGate.reasons,
    stage19Status: activated.stages[19].status,
    originalSourceHistoryRetained: true,
    exactCohortPreserved: true,
    artifactRowsSha256: sourceArtifactRowsSha256
  },
  convergence: {
    oldRecordId: staleConvergence.id,
    newRecordId: currentConvergence.id,
    derivationId: currentConvergence.derivationReceipt.derivationId,
    revision: reloaded.revision,
    projectSha256: reloaded.projectSha256,
    currentAfterReload: true,
    stage18Complete: e.gate(18, reloaded).complete
  },
  preservation: {
    acceptedChanges: sourceCohort.acceptedChanges.length,
    runs: sourceCohort.runs.length,
    verificationRecords: sourceCohort.verification.length,
    prompts: sourceCohort.prompts.length,
    rawResponses: sourceCohort.rawResponses.length,
    exactCohortPreserved: true,
    sourceHistoryPrefixPreserved: true,
    sourceAndActivatedHistoryBodiesRetained: true,
    artifactBytesPreserved: true
  },
  current9Control: {
    secondReadNoPersistence: true,
    proofRowsStableAcrossRecalculate: true,
    projectionOutputStableAcrossRecalculate: true,
    directGate18MatchesRecalculatedStage18: true,
    currentIntegrityValid: true,
    prewarmedCachesEqualCold: true,
    prewarmedStages
  },
  adjacentStage6Control: {
    pointer: 'CURRENT_TEST_SUITE_VERSION',
    repairedValue: expectedTestSuiteVersion,
    proofObligationsStable: true,
    gate6Complete: true,
    pointerIntegrityValid: true
  },
  timing: {elapsedMs: performance.now()-startedAt, phasesMs: phaseElapsedMs},
  claims: {synthetic: true, actualBrowser: false, nativeIndexedDB: false, externalActor: false, wholeClausePass: false},
  boundary: 'Exact retained projection/3 Stage19 pre-comparison input through production project-store activation, candidate production workflow proofGate ordering, normal recordConvergence, project-store save/cold reload and Map transaction adapter. Current /9 fixed-point and adjacent Stage6 pointer-repair controls are included. No fixture copy, gate/hash/receipt edit, automatic convergence, ten-run replay, browser, native IndexedDB, external actor, or whole-clause claim.'
};
return result;
}

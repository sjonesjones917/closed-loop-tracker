import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createVerifierRuntime} from './verifier-runtime.mjs';

const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(source,{rows=[],error=null,missingAPI=false,startupError=null,deferred=null}={}){
 const host={innerHTML:'',insertAdjacentHTML(position,html){assert.equal(position,'afterbegin');this.innerHTML=html+this.innerHTML;}},summary={textContent:''},undo={hidden:true},bindings=[];
 const nodes=new Map([['#project-history',host],['#history-control > summary',summary],['#history-undo',undo]]);
 const storedHistory={jobId:'SYNTHETIC-RECOVERY-A',entries:[{id:'SAVED-VERSION',label:'Saved project',createdAt:'2026-10-06T00:00:00Z'}],activeId:'SAVED-VERSION',sessions:{},redo:[],undoId:'PREVIOUS-SAVED-VERSION'};
 const reads=[],store={HISTORY_LIMITS:{maxCheckpoints:2048},historyList:async jobId=>{reads.push(['history',jobId]);return structuredClone(storedHistory);},listRecoverableProjects:async()=>[],listQuarantinedProjects:async()=>[],pendingBackupImportIdentity:async()=>null};
 if(!missingAPI)store.listResponseStagingRecovery=async jobId=>{reads.push(['recovery',jobId]);if(deferred)return await deferred;if(error)throw error;return rows;};
 const runtime=createVerifierRuntime({document:{currentScript:null,querySelector:key=>{if(!nodes.has(key))nodes.set(key,{disabled:false,hidden:true,dataset:{},setAttribute(){},removeAttribute(){},getAttribute(){return null;},classList:{contains(){return false;},add(){},remove(){}}});return nodes.get(key);},querySelectorAll:()=>[]},__recoveryStore:store,__recoveryBindings:bindings,closedLoopStagingRecoveryError:startupError});
 const end=source.indexOf('globalThis.closedLoopAppReady=false;');assert(end>0,'RESPONSE_RECOVERY_UI_SOURCE_BOUNDARY_ORACLE');
 vm.runInContext(source.slice(0,end)+`
 projectStore=__recoveryStore;current={job:{JOB_ID:'SYNTHETIC-RECOVERY-A'},revision:1};
 bindAction=(selector,_action,label)=>__recoveryBindings.push({selector,label});setControlDisabled=(node,disabled)=>{node.disabled=disabled;};paintPendingBackupImport=()=>{};
 globalThis.recoveryUITest={refresh:refreshHistory,markup:responseStagingRecoveryMarkup,paint:paintHistory,
  install:(rows,error=null)=>{responseStagingRecovery=rows;responseStagingRecoveryReadError=error;},
  select:jobId=>{current={job:{JOB_ID:jobId},revision:1};},
  state:()=>({jobId:current.job.JOB_ID,history:historyState,rows:responseStagingRecovery,error:responseStagingRecoveryReadError})};
 })();`,runtime,{filename:'app-core.js:response-recovery-diagnostics'});
 return {runtime,ui:runtime.recoveryUITest,host,summary,undo,bindings,reads,storedHistory};
}

// §35.11 recovery preserves exact staging and never promotes a partial
// canonical relationship. These synthetic diagnostics exercise the actual
// presentation and async owner guard, not storage recovery or browser layout.
export async function verifyResponseStagingRecoveryUI({appSource=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8')}={}){
 const cases=[],record={schema:'closed-loop-response-staging-recovery/1',jobId:'SYNTHETIC-RECOVERY-A',stagingId:'STAGED-RESPONSE',kind:'RAW_RESPONSE',artifactId:'RAW-STAGED-RESPONSE',stage:1,rawFilename:'returned-response.json',sha256:'1'.repeat(64),byteSize:32,outcome:'METADATA_RECOVERED',code:'RESPONSE_STAGE_METADATA_RECOVERED',checkedAt:'2026-10-06T00:00:00Z'};
 const usable=f=>{assert.match(f.host.innerHTML,/Saved versions/,'RESPONSE_RECOVERY_HISTORY_USABILITY_ORACLE');assert.match(f.host.innerHTML,/Saved project/);assert.equal(f.undo.disabled,false);assert(f.bindings.some(row=>row.selector==='#history-restore'),'RESPONSE_RECOVERY_HISTORY_USABILITY_ORACLE');};
 {
  const f=fixture(appSource);await f.ui.refresh();usable(f);assert.equal(f.ui.markup(),'');assert.equal(f.summary.textContent,'History');assert.deepEqual(plain(f.ui.state().history),f.storedHistory);
  cases.push({caseId:'UI-RESPONSE-RECOVERY-EMPTY',result:'PASS',ordinaryHistoryUnchanged:true});
 }
 {
  const f=fixture(appSource,{rows:[record]});await f.ui.refresh();usable(f);const html=f.host.innerHTML;
  assert.match(html,/Interrupted response file recovered/,'RESPONSE_RECOVERY_RENDER_ORACLE');assert.match(html,/Stage 01 · returned-response\.json/);assert.match(html,/Stage and validate response file/);assert.match(html,/Recovery does not accept a proposal or complete a stage/,'RESPONSE_RECOVERY_AUTHORITY_ORACLE');assert.equal(f.summary.textContent,'History');assert.deepEqual(plain(f.ui.state().rows),[record]);
  cases.push({caseId:'UI-RESPONSE-RECOVERY-METADATA',result:'PASS',knownStageAndFilename:true,requiresNormalValidationAndAcceptance:true});
 }
 {
  const f=fixture(appSource,{rows:[{...record,outcome:'ALREADY_RECORDED',code:'RESPONSE_STAGE_ALREADY_RECORDED'}]});await f.ui.refresh();usable(f);assert.match(f.host.innerHTML,/Response already recorded/);assert.match(f.host.innerHTML,/Review the stage shown before deciding whether more work is needed/);assert.doesNotMatch(f.host.innerHTML,/Interrupted response file recovered/);assert.match(f.host.innerHTML,/does not establish byte integrity, acceptance or stage completion/);assert.equal(f.summary.textContent,'History');
  const available=fixture(appSource,{rows:[{...record,outcome:'ALREADY_RECORDED',code:'RESPONSE_STAGE_METADATA_AVAILABLE'}]});await available.ui.refresh();usable(available);assert.match(available.host.innerHTML,/Response selection available/,'RESPONSE_RECOVERY_SELECTION_NOT_RECORD_ORACLE');assert.doesNotMatch(available.host.innerHTML,/Response already recorded/);assert.match(available.host.innerHTML,/does not establish byte integrity, acceptance or stage completion/);
  cases.push({caseId:'UI-RESPONSE-RECOVERY-ALREADY-RECORDED',result:'PASS',recordIsNotStageCompletion:true,availableSelectionNotClaimedRecorded:true});
 }
 {
  const f=fixture(appSource,{rows:[{...record,outcome:'BLOCKED',stage:null,rawFilename:null,code:'RESPONSE_STAGE_METADATA_MISSING'}]});await f.ui.refresh();usable(f);assert.match(f.host.innerHTML,/Response file needs recovery/);assert.match(f.host.innerHTML,/Stage unavailable/);assert.match(f.host.innerHTML,/use the saved selection if available or select the original response for the current instruction/);assert.match(f.host.innerHTML,/Restore a verified backup if the required original data is unavailable/);assert.equal(f.summary.textContent,'History · Recovery needed');
  cases.push({caseId:'UI-RESPONSE-RECOVERY-BLOCKED',result:'PASS',unknownStageHonest:true,recoveryRouteVisible:true});
 }
 {
  const hostile='\"><img src=x onerror=alert(1)> & \'',f=fixture(appSource,{rows:[{...record,artifactId:hostile,rawFilename:hostile,code:hostile,checkedAt:hostile}]});await f.ui.refresh();usable(f);assert.doesNotMatch(f.host.innerHTML,/<img|onerror=alert\(1\)>/,'RESPONSE_RECOVERY_ESCAPE_ORACLE');assert.match(f.host.innerHTML,/&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt; &amp; &#39;/);assert.equal(f.summary.textContent,'History');
  cases.push({caseId:'UI-RESPONSE-RECOVERY-ESCAPED-DIAGNOSTICS',result:'PASS',attributeAndTextEscaped:true});
 }
 // A typed file kind owns its recovery route; diagnostic metadata cannot
 // turn an artifact into a response or a saved relationship into byte proof.
 for(const [kind,title,route]of [
  ['RETURNED_FILE','Returned file needs recovery',/named Returned files slot, then choose Validate response and mapped files/],
  ['ARTIFACT','Project file needs recovery',/Open Files to inspect the saved file information/]
 ]){
  const f=fixture(appSource,{rows:[{...record,kind,outcome:'BLOCKED',code:'CONTROLLED_MISSING_RELATIONSHIP'}]});await f.ui.refresh();usable(f);assert(f.host.innerHTML.includes(title),'RESPONSE_RECOVERY_TYPED_ROUTE_ORACLE:'+kind);assert.match(f.host.innerHTML,route,'RESPONSE_RECOVERY_TYPED_ROUTE_ORACLE:'+kind);assert.doesNotMatch(f.host.innerHTML,/choose Stage and validate response file/);assert.equal(f.summary.textContent,'History · Recovery needed');
  cases.push({caseId:'UI-RESPONSE-RECOVERY-TYPED-'+kind,result:'PASS',routeNamesCorrectFileBoundary:true});
 }
 {
  const staleCodes=['RESPONSE_STAGE_PROMPT_IDENTITY_MISMATCH','RESPONSE_STAGE_TRANSPORT_BINDING_STALE','RESPONSE_STAGE_SCOPE_STALE','RESPONSE_STAGE_HISTORY_ACTIVATION_STALE','RESPONSE_STAGE_FOREIGN_PROJECT'];
  for(const code of staleCodes){const f=fixture(appSource,{rows:[{...record,outcome:'BLOCKED',code}]});await f.ui.refresh();usable(f);assert.match(f.host.innerHTML,/Export its current stage file package before requesting a new response/,'RESPONSE_RECOVERY_STALE_ROUTE_ORACLE:'+code);assert.match(f.host.innerHTML,/repeating the old response cannot establish the new instruction binding/);assert.equal(f.summary.textContent,'History · Recovery needed');}
  const f=fixture(appSource,{rows:[{...record,outcome:'BLOCKED',code:'CONTROLLED_UNKNOWN_FAILURE'}]});await f.ui.refresh();assert.match(f.host.innerHTML,/select the original response for the current instruction/);assert.doesNotMatch(f.host.innerHTML,/belongs to an older or unavailable instruction/,'RESPONSE_RECOVERY_UNKNOWN_NOT_STALE_ORACLE');
  cases.push({caseId:'UI-RESPONSE-RECOVERY-STALE-AND-UNKNOWN',result:'PASS',closedStaleCodes:staleCodes,unknownDoesNotInventStaleness:true});
 }
 for(const kind of ['RETURNED_FILE','ARTIFACT']){
  const f=fixture(appSource,{rows:[{...record,kind,outcome:'ALREADY_RECORDED',code:'ARTIFACT_RELATIONSHIP_RECORDED'}]});await f.ui.refresh();usable(f);assert.match(f.host.innerHTML,/File relationship recorded/);assert.match(f.host.innerHTML,/does not establish byte integrity, acceptance or stage completion/,'RESPONSE_RECOVERY_RELATIONSHIP_AUTHORITY_ORACLE');assert.doesNotMatch(f.host.innerHTML,/Response already recorded/);assert.equal(f.summary.textContent,'History');
  cases.push({caseId:'UI-RESPONSE-RECOVERY-RELATIONSHIP-'+kind,result:'PASS',metadataIsNotCustodyOrAcceptance:true});
 }
 {
  const f=fixture(appSource,{rows:[{...record,outcome:'UNREFERENCED_STAGING_REMOVED',bytesRemoved:true,code:'RESPONSE_STAGE_SCOPE_STALE'}]});await f.ui.refresh();usable(f);assert.match(f.host.innerHTML,/Retired response staging removed/,'RESPONSE_RECOVERY_REMOVAL_NOTICE_ORACLE');assert.match(f.host.innerHTML,/checking saved project and History references/);assert.match(f.host.innerHTML,/export its current package if another response is required/);assert.doesNotMatch(f.host.innerHTML,/original file identity and bytes were recovered|select the original response for the current instruction/);assert.equal(f.summary.textContent,'History');
  const unknown=fixture(appSource,{rows:[{...record,outcome:'UNREFERENCED_STAGING_REMOVED',code:'RESPONSE_STAGE_SCOPE_STALE'}]});await unknown.ui.refresh();assert.doesNotMatch(unknown.host.innerHTML,/Retired response staging removed/,'RESPONSE_RECOVERY_REMOVAL_PROOF_ORACLE');
  const shared=fixture(appSource,{rows:[{...record,outcome:'UNREFERENCED_STAGING_REMOVED',stagingOccurrenceRemoved:true,bytesRemoved:false,code:'RESPONSE_STAGE_SCOPE_STALE'}]});await shared.ui.refresh();usable(shared);assert.match(shared.host.innerHTML,/Retired response staging removed/,'RESPONSE_RECOVERY_SHARED_OCCURRENCE_ORACLE');assert.match(shared.host.innerHTML,/No file bytes were removed/,'RESPONSE_RECOVERY_SHARED_BYTES_NOTICE_ORACLE');assert.doesNotMatch(shared.host.innerHTML,/select the original response for the current instruction/);assert.equal(shared.summary.textContent,'History');
  cases.push({caseId:'UI-RESPONSE-RECOVERY-PROVEN-REMOVAL',result:'PASS',onlyExplicitRemovalReceiptClaimsRemoval:true,sharedBytesRetentionExplicit:true,noImpossibleRetry:true});
 }
 for(const boundary of ['startup','metadata-read']){
  const message='Synthetic recovery failure <script>unsafe()</script>',f=fixture(appSource,boundary==='startup'?{startupError:message}:{error:new Error(message)});await f.ui.refresh();usable(f);assert.match(f.host.innerHTML,/File recovery could not finish/);assert.match(f.host.innerHTML,/Reload to retry recovery before staging files again/);assert.match(f.host.innerHTML,/&lt;script&gt;unsafe\(\)&lt;\/script&gt;/);assert.doesNotMatch(f.host.innerHTML,/<script>/);assert.equal(f.summary.textContent,'History · Recovery needed');assert.deepEqual(plain(f.ui.state().history),f.storedHistory);
  if(boundary==='metadata-read')assert.equal(f.ui.state().error,message,'RESPONSE_RECOVERY_READ_ERROR_ORACLE');
  cases.push({caseId:'UI-RESPONSE-RECOVERY-'+boundary.toUpperCase(),result:'PASS',failureVisible:true,historyRemainsUsable:true});
 }
 {
  const f=fixture(appSource,{missingAPI:true});await f.ui.refresh();usable(f);assert.equal(f.ui.markup(),'');assert.equal(f.summary.textContent,'History');
  cases.push({caseId:'UI-RESPONSE-RECOVERY-OPTIONAL-DIAGNOSTIC-API',result:'PASS',historyRemainsUsable:true});
 }
 {
  let release;const deferred=new Promise(resolve=>{release=resolve;}),f=fixture(appSource,{deferred});f.ui.install([{...record,jobId:'SYNTHETIC-RECOVERY-B'}]);f.host.innerHTML='Existing current project B history';f.summary.textContent='History';const before=plain(f.ui.state());const refreshing=f.ui.refresh();f.ui.select('SYNTHETIC-RECOVERY-B');release([record]);await refreshing;
  assert.equal(f.host.innerHTML,'Existing current project B history','RESPONSE_RECOVERY_STALE_PROJECT_ORACLE');assert.equal(f.ui.state().jobId,'SYNTHETIC-RECOVERY-B');assert.deepEqual(plain(f.ui.state().rows),before.rows,'RESPONSE_RECOVERY_STALE_PROJECT_ORACLE');assert.equal(f.bindings.length,0);assert.equal(f.ui.state().history,before.history);
  cases.push({caseId:'UI-RESPONSE-RECOVERY-STALE-PROJECT',result:'PASS',lateMetadataCannotReplaceCurrentProject:true});
 }
 return {schema:'closed-loop-response-staging-recovery-ui-check/1',passed:true,synthetic:true,actualBrowser:false,boundary:'Actual app refresh, recovery markup and History renderer with supplied metadata/read failures and DOM stand-ins; storage and browser recovery verified by their owners.',sourceSha256:{'app-core.js':createHash('sha256').update(appSource).digest('hex'),'test-response-staging-recovery-ui.mjs':createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex')},cases};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 let appSource=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');const fault=process.argv.find(arg=>arg.startsWith('--fault='))?.slice('--fault='.length);
 const faults={'all-files-as-response':["const raw=row.kind==='RAW_RESPONSE',returned=row.kind==='RETURNED_FILE';","const raw=true,returned=row.kind==='RETURNED_FILE';"],'repeat-stale-response':["const stale=raw&&[","const stale=false&&["],'missing-diagnostics':['function responseStagingRecoveryMarkup(){','function responseStagingRecoveryMarkup(){return "";'],'stale-project':['if(current.job.JOB_ID!==jobId)return;[historyState,recoveryProjects,quarantinedProjects,responseStagingRecovery]','[historyState,recoveryProjects,quarantinedProjects,responseStagingRecovery]']};
 if(fault){const [before,after]=faults[fault]||[];assert(before&&appSource.split(before).length===2,'RESPONSE_RECOVERY_UI_FAULT_ANCHOR_ORACLE');appSource=appSource.replace(before,after);}
 console.log(JSON.stringify(await verifyResponseStagingRecoveryUI({appSource}),null,2));
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {projectStoreRuntime,bindProjectActivationUi} from './test-project-store-runtime.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';

async function verifyRejectedInstructionMarkup(){
 const sourceNames=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'],sourceOverrides=Object.fromEntries(sourceNames.map(file=>[file,fs.readFileSync(file==='app-core.js'?process.env.APP_SOURCE||file:file,'utf8')])),sourceHashes=Object.fromEntries(sourceNames.map(file=>[file,createHash('sha256').update(sourceOverrides[file]).digest('hex')]));
 for(const file of sourceNames)assert.equal(createHash('sha256').update(fs.readFileSync(file==='app-core.js'?process.env.APP_SOURCE||file:file)).digest('hex'),sourceHashes[file],'REJECTION_MARKUP_SOURCE_IDENTITY_ORACLE: source changed during tuple capture.');
 const r=projectStoreRuntime({sourceOverrides}),app=sourceOverrides['app-core.js'];
 let p=await r.store.createProject({commandId:'REJECTION-MARKUP-PROJECT'}),draft=r.copy(p);
 const first=r.prompts.reserveAndBuildPromptRecord(draft,1,{operation:'COMPLETE'},{owningTabInstance:'SYNTHETIC-MARKUP'}).prompt;
 p=await r.store.writeProject(draft,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 const identity=r.copy(r.prompts.promptFileManifest(first).promptIdentity),text='{}',staged=await r.store.stageResponseFile({jobId:p.job.JOB_ID,stage:1,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:identity,packageId:first.packageId,operationReservationId:first.operationReservationId,challengeNonce:first.challengeNonce}),received=await r.store.readStagedResponseFile({jobId:p.job.JOB_ID,stagingId:staged.stagingId});
 const captured=r.ingestion.captureRaw(p,{stage:1,text,promptRecord:r.copy(first),transport:r.copy({authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,rawFilename:'response.json',mediaType:'application/json',status:received.status,sha256:received.sha256,byteSize:received.byteSize,promptIdentity:identity,packageId:first.packageId,operationReservationId:first.operationReservationId,challengeNonce:first.challengeNonce})});
 p=await r.store.writeProject(captured.project,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 const prepared=r.ingestion.prepareCaptured(p,{rawResponseId:captured.rawRecord.rawResponseId});assert.equal(prepared.validation.valid,false,'A syntactically valid empty object is not a contracted Stage1 response.');
 p=await r.store.writeProject(prepared.project,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 assert.equal(r.prompts.promptTransportBinding(p,1,'COMPLETE',first.instructionId,first.scope),null,'The rejected reservation must not establish a current export-ready instruction.');
 let candidateId=first.instructionId;
 const latestRaw=()=>r.runtime.current.projectData.rawResponses.find(row=>row.rawResponseId===captured.rawRecord.rawResponseId),latestValidation=()=>r.runtime.current.projectData.responseValidations.find(row=>row.validationId===prepared.validation.validationId);
 Object.assign(r.runtime,{current:p,responseActionFailure:null,safe:r.engine.safe,esc:value=>String(value),details:(_label,value)=>JSON.stringify(value),latestResponseAttempt:latestRaw,latestResponseValidation:latestValidation,currentFileSelection:()=>null,returnedFileCorrectionPending:()=>false,pendingInstructionUnchanged:()=>false});
 // The rendering adapter supplies the result of the actual prompt/reservation
 // authority. This check does not claim to cover the UI's lane-selection owner.
 r.runtime.currentPromptRecord=()=>{const record=r.runtime.current.projectData.generatedPrompts.find(row=>row.instructionId===candidateId);return record&&Number(record.scope.projectRevision)===Number(r.runtime.current.revision)&&r.prompts.promptTransportBinding(r.runtime.current,1,'COMPLETE',record.instructionId,record.scope)?record:null;};
 const start=app.indexOf('function validationMarkup('),end=app.indexOf('function returnedFileCorrectionPending(',start);assert.ok(start>=0&&end>start,'The production validation message owner is required.');vm.runInContext(app.slice(start,end),r.runtime,{filename:'app-core.js:validationMarkup'});
 const observations=[],observe=(caseId,expected)=>{const markup=r.runtime.validationMarkup(1);observations.push({caseId,expected,markup});return markup;};
 const missing=observe('REJECTED-INSTRUCTION-NO-SAVED-REPLACEMENT','Preserve the rejection and direct the current required action without claiming regeneration.');
 assert.doesNotMatch(missing,/saved an updated correction instruction|automatically prepared|app has prepared an updated/i,'REJECTION_REPLACEMENT_CLAIM_ORACLE: a rejected reservation without a saved replacement must not claim that a new instruction exists.');
 assert.match(missing,/No updated controlling instruction has been saved/);assert.match(missing,/current required action/);
 draft=r.copy(p);const replacement=r.prompts.reserveAndBuildPromptRecord(draft,1,{operation:'COMPLETE'},{owningTabInstance:'SYNTHETIC-MARKUP'}).prompt;
 p=await r.store.writeProject(draft,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});r.runtime.current=p;candidateId=replacement.instructionId;
 assert.ok(r.prompts.promptTransportBinding(p,1,'COMPLETE',replacement.instructionId,replacement.scope),'The positive control must have a genuinely saved current reservation.');
 const fresh=observe('REJECTED-INSTRUCTION-FRESH-SAVED-REPLACEMENT','A genuinely saved fresh replacement following this validation retains the useful export guidance.');
 assert.match(fresh,/saved an updated correction instruction/,'REJECTION_REPLACEMENT_READY_ORACLE: an actual fresh saved replacement must remain discoverable.');assert.match(fresh,/Export the updated instruction/);
 const original=r.copy(p);r.runtime.current=r.copy(p);latestValidation().issues=[{code:'STALE_PROMPT_IDENTITY',message:'Controlled stale-response display branch',severity:'ERROR'}];
 const staleReady=observe('STALE-RESPONSE-FRESH-SAVED-REPLACEMENT','Stale response guidance can identify a real saved replacement.');assert.match(staleReady,/belongs to an older instruction/);assert.match(staleReady,/saved an updated correction instruction|automatically prepared/);
 r.runtime.current.revision+=1;const staleMissing=observe('STALE-RESPONSE-NO-CURRENT-RESERVATION','A changed revision must not present a stale saved instruction as a prepared replacement.');assert.doesNotMatch(staleMissing,/saved an updated correction instruction|automatically prepared|app has prepared an updated/i,'REJECTION_REPLACEMENT_CLAIM_ORACLE: stale response feedback cannot invent a current replacement.');assert.match(staleMissing,/current required action/);
 r.runtime.current=r.copy(original);const failedEvent=r.runtime.current.projectData.history.find(event=>event.type==='RESPONSE_VALIDATION_FAILED'&&event.validationId===prepared.validation.validationId),savedEvent=r.runtime.current.projectData.history.find(event=>event.type==='INSTRUCTION_SAVED'&&event.recordId===replacement.instructionId);assert.ok(failedEvent&&savedEvent&&savedEvent.eventSequence>failedEvent.eventSequence);
 savedEvent.eventSequence=failedEvent.eventSequence-1;
 const preceding=observe('CURRENT-INSTRUCTION-PREDATES-FAILED-ATTEMPT','A current bound instruction can be exported without claiming this rejection created it.');assert.doesNotMatch(preceding,/saved an updated correction instruction|automatically prepared/,'REJECTION_REPLACEMENT_ORDER_ORACLE: a pre-existing instruction must not be attributed to a later rejection.');assert.match(preceding,/current controlling instruction is ready to export/);
 r.runtime.current=r.copy(original);latestRaw().validationId='CONTROLLED-UNRELATED-VALIDATION';
 const unrelated=observe('REPLACEMENT-UNRELATED-VALIDATION','Do not attribute a saved instruction to a different attempt/validation binding.');assert.doesNotMatch(unrelated,/saved an updated correction instruction|automatically prepared/,'REJECTION_REPLACEMENT_BINDING_ORACLE: the exact failed attempt must be bound to this validation.');
 return {caseId:'REJECTION-REPLACEMENT-MARKUP',result:'PASS',sourceHashes,productionSourceSha256:createHash('sha256').update(app).digest('hex'),boundary:'Actual response Blob staging/raw admission/rejected reservation and saved replacement through synthetic transactional store; extracted production presentation. Controlled rendered stale/order/binding counterexamples; no browser, external actor, or full-stage-completion claim.',rawResponseId:captured.rawRecord.rawResponseId,rawResponseSha256:received.sha256,validationId:prepared.validation.validationId,originalInstructionId:first.instructionId,replacementInstructionId:replacement.instructionId,observations};
}
if(process.argv.includes('--validation-markup-only')){console.log(JSON.stringify(await verifyRejectedInstructionMarkup(),null,2));process.exit(0);}

// Execute the same injected-failure owner used in the browser. A commit must be
// observed before a view read may fail; unrelated requests or responses cannot arm it.
async function verifyImportFaultBoundary(){
 const browserSource=fs.readFileSync(process.env.BROWSER_EXTRA_SOURCE||'verify-browser-extra.mjs','utf8');
 const start=browserSource.indexOf('function installPostImportRefreshFault(');
 if(start<0){
  // Defective-source replay: execute the actual former browser hook against the
  // frozen production facade, then perform a real import through the shared store.
  const r=projectStoreRuntime(),p=await r.store.createProject({commandId:'FAULT-BASELINE'}),backup=await r.store.exportPackage(p.job.JOB_ID);
  const a=browserSource.indexOf('let injected=false,importCommitted=false;store.importPackage='),b=browserSource.indexOf('try{await input.onchange',a);
  assert.ok(a>=0&&b>a,'The actual baseline injection is required.');
  Object.assign(r.runtime,{backup,jobId:p.job.JOB_ID});
  const observed=await vm.runInContext(`(async()=>{const store=closedLoopProjectStore,nativeImport=store.importPackage,nativeReadHistoryView=store.readHistoryView;${browserSource.slice(a,b)}await store.importPackage(backup);await store.readHistoryView(jobId);return {importCommitted,injected,frozen:Object.isFrozen(store)};})()`,r.runtime);
  assert.ok(observed.importCommitted&&observed.injected,'IMPORT_FAULT_BOUNDARY_ORACLE: the browser gate did not observe the committed import or inject its required post-commit failure.');
  return {caseId:'IMPORT-FAULT-COMMIT-BOUNDARY',actual:observed};
 }
 const end=browserSource.indexOf('\nasync function main(',start);
 assert.ok(end>start,'The browser injection boundary is required.');
 class Worker{
  constructor(){this.listeners=new Set();}
  addEventListener(type,listener){if(type==='message')this.listeners.add(listener);}
  removeEventListener(type,listener){if(type==='message')this.listeners.delete(listener);}
  postMessage(message){this.lastMessage=message;}
  emit(data){for(const listener of this.listeners)listener({data});}
 }
 class IDBObjectStore{constructor(name){this.name=name;}get(key){return {key};}}
 const oldPost=Worker.prototype.postMessage,oldGet=IDBObjectStore.prototype.get;
 const runtime=createVerifierRuntime({Worker,IDBObjectStore});
 vm.runInContext(browserSource.slice(start,end),runtime);
 const fault=runtime.installPostImportRefreshFault('TARGET-PROJECT'),worker=new Worker(),meta=new IDBObjectStore('meta');
 try{
  worker.postMessage({method:'WRITE_PROJECT',operationId:'OTHER',buildIdentity:'BUILD'});
  worker.emit({operationId:'OTHER',buildIdentity:'BUILD',ok:true,project:{job:{JOB_ID:'TARGET-PROJECT'}}});
  assert.doesNotThrow(()=>meta.get('recovery:TARGET-PROJECT'),'IMPORT_FAULT_PRECOMMIT_ORACLE: view read failed before commit.');
  assert.equal(fault.observation.importCommitted,false,'IMPORT_FAULT_CORRELATION_ORACLE: a non-import write armed the fault.');
  worker.postMessage({method:'IMPORT_PACKAGE',operationId:'IMPORT',buildIdentity:'BUILD'});
  for(const message of [
   {operationId:'OTHER',buildIdentity:'BUILD',ok:true,project:{job:{JOB_ID:'TARGET-PROJECT'}}},
   {operationId:'IMPORT',buildIdentity:'WRONG',ok:true,project:{job:{JOB_ID:'TARGET-PROJECT'}}},
   {operationId:'IMPORT',buildIdentity:'BUILD',ok:false},
   {operationId:'IMPORT',buildIdentity:'BUILD',ok:true,project:{job:{JOB_ID:'OTHER-PROJECT'}}}
  ]){worker.emit(message);assert.equal(fault.observation.importCommitted,false,'IMPORT_FAULT_CORRELATION_ORACLE: an unmatched or failed response was treated as commit.');assert.doesNotThrow(()=>meta.get('recovery:TARGET-PROJECT'),'IMPORT_FAULT_PRECOMMIT_ORACLE: unmatched response armed the fault.');}
  assert.equal(fault.observation.injected,false,'IMPORT_FAULT_PRECOMMIT_ORACLE: injected before the matching successful commit.');
  worker.emit({operationId:'IMPORT',buildIdentity:'BUILD',ok:true,project:{job:{JOB_ID:'TARGET-PROJECT'}}});
  assert.equal(fault.observation.importCommitted,true,'IMPORT_FAULT_BOUNDARY_ORACLE: matching successful import response was not observed.');
  meta.get('recovery:OTHER-PROJECT');new IDBObjectStore('projects').get('recovery:TARGET-PROJECT');
  assert.equal(fault.observation.injected,false,'IMPORT_FAULT_CORRELATION_ORACLE: unrelated read consumed the injected failure.');
  assert.throws(()=>meta.get('recovery:TARGET-PROJECT'),/CONTROLLED_POST_IMPORT_REFRESH_FAILURE/,'IMPORT_FAULT_BOUNDARY_ORACLE: post-commit view read did not fail.');
  assert.doesNotThrow(()=>meta.get('recovery:TARGET-PROJECT'),'IMPORT_FAULT_PRECOMMIT_ORACLE: view read failed before commit.');
  assert.equal(fault.observation.injected,true);
 }finally{fault.restore();}
 assert.equal(Worker.prototype.postMessage,oldPost);assert.equal(IDBObjectStore.prototype.get,oldGet);assert.equal(worker.listeners.size,0);
 return {caseId:'IMPORT-FAULT-COMMIT-BOUNDARY',result:'PASS',matchingCommitRequired:true,precommitReadPreserved:true,unrelatedReadsPreserved:true,restored:true};
}
if(process.argv.includes('--import-fault-only')){console.log(JSON.stringify(await verifyImportFaultBoundary()));process.exit(0);}
const cases=[];

const revision=execFileSync('git',['rev-parse','HEAD'],{timeout:30000,killSignal:'SIGKILL',encoding:'utf8'}).trim();
const r=projectStoreRuntime(),a=await r.store.createProject({commandId:'PRIMARY-ERROR-A'}),b=await r.store.createProject({commandId:'PRIMARY-ERROR-B'});
const artifactId=r.engine.allocateId(a,'artifacts',r.copy({commandId:'PRIMARY-ERROR-FILE',payload:{filename:'input.txt'}}));
await r.store.putArtifact({artifactId,jobId:a.job.JOB_ID,blob:new Blob(['Input bytes']),filename:'input.txt',mediaType:'text/plain'});
let error;
try{await r.store.putArtifact({artifactId,jobId:b.job.JOB_ID,blob:new Blob(['Input bytes']),filename:'input.txt',mediaType:'text/plain'});}catch(caught){error=caught;}
assert.equal(error?.code,'CROSS_PROJECT_ARTIFACT_ID_COLLISION','The underlying ownership rejection remains required.');
const report={diagnosticMarkup:'',insertAdjacentHTML(_position,html){this.diagnosticMarkup+=html;},textContent:'',className:'',hidden:true,classList:{add(){}},setAttribute(){},scrollIntoView(){},focus(){}},announcements=[];
Object.assign(r.runtime,{$:selector=>selector==='#operation-error'?report:null,announce:message=>announcements.push(message),operatorActionInFlight:null,error,actionFocusTarget:null,focusAfterAction:node=>node?.focus({preventScroll:true})});
const app=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8'),start=app.indexOf('let actionFailureNotice='),end=app.indexOf('const storageActivities=',start);
vm.runInContext(app.slice(start,end),r.runtime,{filename:'app-core.js:reportActionFailure'});
vm.runInContext('reportActionFailure(error)',r.runtime);
cases.push({sourceRevision:revision,productionSourceSha256:createHash('sha256').update(app).digest('hex'),requirement:'UX-011',environment:'Node shared verifier runtime; actual artifact store and error presentation owner',expected:'The actionable error remains visible while its internal artifact identity and diagnostic explanation are available behind details.',actualPrimaryError:report.textContent,actualAnnouncement:announcements,internalArtifactId:artifactId,rejectedOwnershipCode:error.code});
assert.equal(report.hidden,false,'The actionable error must remain visible.');
assert.equal(report.textContent.includes(artifactId),false,'PRIMARY_ERROR_INFORMATION_ORACLE: internal identities must stay behind details in failure and recovery feedback.');

assert.ok(report.diagnosticMarkup.includes('<details')&&!report.diagnosticMarkup.includes('<details open'), 'Error diagnostics must be in a closed disclosure.');
assert.ok(report.diagnosticMarkup.includes(artifactId), 'Exact diagnostic identity must remain accessible.');
assert.ok(announcements.every(message=>!message.includes(artifactId)), 'Live announcements must use the same public message.');

// UX-020: a completed import followed by a failed view refresh must not be
// presented as rejection or an instruction to import again. Exercise the actual
// import and reporting owners with the shared transactional store, not a notice stub.
const importStart=app.indexOf('async function importProjectPackageFile('),importEnd=app.indexOf('let pendingBackupAction=',importStart);
assert.ok(importStart>=0&&importEnd>importStart,'Actual import owner is required.');
const store=r.store,engine=r.engine;
let original=await store.createProject({commandId:'IMPORT-FEEDBACK-PROJECT'});
const fileId=engine.allocateId(original,'artifacts',r.copy({commandId:'IMPORT-FEEDBACK-FILE'}));
const row=await store.putArtifact({artifactId:fileId,jobId:original.job.JOB_ID,filename:'required.txt',blob:new Blob(['Exact import recovery bytes é🙂'])});
engine.registerArtifactBytes(original,r.copy({stage:1,artifactId:fileId,filename:row.filename,byteSize:row.byteSize,sha256:row.sha256,mediaType:row.mediaType,lineage:row.lineage}));
original=await store.writeProject(original,{expectedProjectRevision:original.revision,incrementRevision:true});
const backup=await store.exportPackage(original.job.JOB_ID),independent=await store.readProject(b.job.JOB_ID);
await store.deleteArtifact(fileId,original.job.JOB_ID);
Object.assign(r.runtime,{projectStore:store,current:independent,projects:r.copy([independent,original]),withStorageActivity:async(_label,fn)=>fn(),takeBackupPassphrase:()=>null,requestBackupPassword:()=>false,saveFileSelection:async()=>{},loadAcceptanceSession:async()=>{},recordMobileBackupRestore:async()=>{},refreshProjectStorage:async()=>{throw new Error('CONTROLLED_POST_IMPORT_REFRESH_FAILURE');},selectSavedView:()=>{},recordCommittedBoundary:async()=>{},render:()=>{},applySavedView:()=>{}});
Object.assign(r.runtime,{engine,core:r.core,clone:r.copy,recordValue:engine.recordValue});bindProjectActivationUi(r,{source:app});
vm.runInContext(app.slice(importStart,importEnd),r.runtime,{filename:'app-core.js:import-owner'});
report.diagnosticMarkup='';
await r.runtime.importProjectPackageFile(backup,{recordSelection:false});
const committed=await store.readProject(original.job.JOB_ID),restored=(await store.listArtifacts(original.job.JOB_ID)).find(file=>file.artifactId===fileId);
const importObservation={caseId:'IMPORT-COMMITTED-REFRESH-FEEDBACK',sourceRevision:revision,productionSourceSha256:createHash('sha256').update(app).digest('hex'),environment:'Shared synthetic transactional store; actual import and reporter; not browser evidence',commitAdvanced:committed.revision>original.revision,committedProjectSelected:r.runtime.current.revision===committed.revision&&r.runtime.current.job.JOB_ID===committed.job.JOB_ID,bytesRestored:await restored.blob.text()==='Exact import recovery bytes é🙂',independentProjectPreserved:(await store.readProject(b.job.JOB_ID)).projectSha256===independent.projectSha256,publicMessage:report.textContent,announcement:announcements.at(-1)};
cases.push(importObservation);
assert.ok(importObservation.commitAdvanced&&importObservation.committedProjectSelected&&importObservation.bytesRestored&&importObservation.independentProjectPreserved,'Import transaction and exact bytes must survive a refresh failure.');
assert.match(report.textContent,/imported and saved/i,'IMPORT_COMMITTED_FEEDBACK_ORACLE: report the committed import, not generic failure.');
assert.match(report.textContent,/reload/i,'IMPORT_COMMITTED_FEEDBACK_ORACLE: name recovery without reissuing import.');
assert.doesNotMatch(report.textContent,/CONTROLLED_|retry|rejected|unchanged|without changing/i,'IMPORT_COMMITTED_FEEDBACK_ORACLE: diagnostics or incorrect rollback/retry claims leaked into the public outcome.');
assert.equal(announcements.at(-1),report.textContent);
assert.ok(report.diagnosticMarkup.includes('CONTROLLED_POST_IMPORT_REFRESH_FAILURE'),'Preserve the exact cause behind details.');
const beforeRejected=await store.readProject(original.job.JOB_ID),selectedBefore=r.runtime.current;
await r.runtime.importProjectPackageFile(new Blob(['invalid package']),{recordSelection:false});
assert.equal(r.runtime.current,selectedBefore,'Pre-commit rejection changed the selected project.');
assert.equal((await store.readProject(original.job.JOB_ID)).projectSha256,beforeRejected.projectSha256,'Pre-commit rejection changed committed data.');
assert.doesNotMatch(report.textContent,/imported and saved/i,'Rejected import must not claim commit.');
cases.push({caseId:'IMPORT-REJECTED-PRESERVES-COMMIT',result:'PASS',message:report.textContent});

cases.push(await verifyImportFaultBoundary());
cases.push(await verifyRejectedInstructionMarkup());
console.log(JSON.stringify({primaryErrorInformation:'PASS',cases},null,2));

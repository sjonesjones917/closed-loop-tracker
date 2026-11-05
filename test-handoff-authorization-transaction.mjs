import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {projectStoreRuntime,storedArtifactBody} from './test-project-store-runtime.mjs';
import {stage04AcceptanceFixture,stage04AcceptanceEnvelope} from './test-fixtures.mjs';
import {readStoreArchive} from './test-zip.mjs';
import {authorizeSyntheticHandoff} from './test-handoff-authorization.mjs';
import {artifactFixtureId} from './test-artifact-fixtures.mjs';

const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const sha=value=>createHash('sha256').update(value).digest('hex');
// Actual selected-lane, decision, prompt, persistence and export owners. DOM
// controls and view rendering are synthetic; this is not browser timing or a
// real human's authorization. The store uses the existing transaction adapter.
async function setup(sourceOverrides,{stage=1}={}){
 const r=projectStoreRuntime({sourceOverrides}),t=r.runtime,e=r.engine,controls=new Map(),downloads=[],failures=[];
 let p;
 if(stage===4)p=await r.store.writeProject(stage04AcceptanceFixture({...r,schema:t.closedLoopWorkflowSchema},'SYNTHETIC_HANDOFF_STAGE04'),{expectedProjectRevision:0,createOnly:true,incrementRevision:false});
 else{p=await r.store.createProject({commandId:'SYNTHETIC_HANDOFF_TRANSACTION'});p.job.EXACT_USER_OBJECTIVE_VERBATIM='Read this disposable synthetic project and produce a proposal.';e.recordHumanInputVersion(p,['EXACT_USER_OBJECTIVE_VERBATIM'],'SYNTHETIC_OPERATOR');p=await r.store.writeProject(p,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});}
 p.activeStage=stage;p.activeView='Workflow';
 Object.assign(t,{current:p,projects:r.copy([p]),projectStore:r.store,engine:e,core:r.core,schema:t.closedLoopWorkflowSchema,ingestion:r.ingestion,clone:r.copy,safe:e.safe,recordValue:e.recordValue,runSelection:{},operationSelection:{[stage]:'COMPLETE'},handoffReview:null,handoffNavigationSequence:0,TAB_INSTANCE_ID:'SYNTHETIC_HANDOFF_TRANSACTION',selectedOperation:()=> 'COMPLETE',selectedOperationRegistration:n=>t.closedLoopWorkflowSchema.STAGE_OPERATION_REGISTRY[n+':COMPLETE'],unloadInactiveProjects(){},mobileSessionCurrent:()=>false,recordCommittedBoundary:async()=>{},render(){},announce(){},focusAfterAction(){},applySavedView(){},CSS:{escape:String},document:{activeElement:{id:'authorize-handoff'},querySelectorAll:()=>[]},requestAnimationFrame(){},innerHeight:900,$:selector=>controls.get(selector)||null,withStorageActivity:async(_label,fn)=>fn(),reportActionFailure:error=>failures.push(error),downloadBlob:(blob,filename)=>downloads.push({blob,filename}),displayedStageAction:()=>e.operationalNextAction(t.current),captureView:()=>r.copy({activeStage:t.current.activeStage,activeView:t.current.activeView,operationSelection:t.operationSelection,runSelection:t.runSelection,drafts:{}})});
 // A write that retains the current view as its History view saves no separate
 // view first (the actual capture owner is verified in its own suite).
 const captures=[];t.captureCurrentView=options=>{captures.push(options?.retainedByWrite?'retained':'saved');return options?.retainedByWrite?null:r.store.saveCheckpoint(t.current.job.JOB_ID,{expectedProjectRevision:t.current.revision,view:t.captureView()});};
 const source=sourceOverrides['app-core.js'],extract=(a,b)=>{const first=source.indexOf(a),last=source.indexOf(b,first+a.length);assert.ok(first>=0&&last>first,'HANDOFF_TRANSACTION_SOURCE_OWNER '+a);return source.slice(first,last);},line=prefix=>{const found=source.split('\n').find(row=>row.startsWith(prefix));assert.ok(found,prefix);return found;};
 vm.runInContext(line('function operationExecutorClass(')+'\n'+line('function externalAgentOperation(')+'\n'+line('function stagePlanItems(')+'\n'+extract('function currentRunSlots(','// A saved response may be inspected independently.')+extract('async function persistReplacement(','async function save(')+extract('async function savePromptRecord(','function promptTransportFilename(')+extract('let promptExportInFlight=null;','function fileSelectionKey('),t,{filename:'app-core.js:actual-handoff-transaction-owners'});
 vm.runInContext('presentHandoffReview=(review,key,origin)=>retainHandoffReview(review,key,origin);',t);
 for(const [key,value]of Object.entries({recipient:'Synthetic local actor',provider:'Synthetic isolated environment',suitabilityBasis:'Disposable synthetic fixture only; no actual user data or external transfer.',operator:'SYNTHETIC_OPERATOR'}))controls.set('#handoff-'+key,{value});
 controls.set('#handoff-purpose-DISCLOSURE_AUTHORIZATION',{checked:true});controls.set('#handoff-confirmed',{checked:true});controls.set('#authorize-handoff',{});controls.set('#handoff-review',{});
 if(stage===4){
  await t.savePromptRecord(stage);
  const input=stage04AcceptanceEnvelope({...r,schema:t.closedLoopWorkflowSchema},t.current,t.currentPromptRecord(stage));
  // Keep both genuine streaming rejections and their current owning attempts.
  // The UI's atomic disclosure save must not make their correction unexportable.
  for(const value of [123,false]){
   input.records.propositions[0].fields.PROPOSITION_TEXT=value;
   const text=JSON.stringify(input),expected=t.currentPromptRecord(stage),manifest=r.prompts.promptFileManifest(expected),staged=await r.store.stageResponseFile({jobId:t.current.job.JOB_ID,stage,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:manifest.promptIdentity,packageId:expected.packageId,operationReservationId:expected.operationReservationId,challengeNonce:expected.challengeNonce}),read=await r.store.readStagedResponseFile({jobId:t.current.job.JOB_ID,stagingId:staged.stagingId});
   const captured=r.ingestion.captureRaw(t.current,{stage,text,promptRecord:expected,files:[],transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,rawFilename:'response.json',mediaType:'application/json',byteSize:read.byteSize,sha256:read.sha256,status:read.status,promptIdentity:manifest.promptIdentity,packageId:expected.packageId,operationReservationId:expected.operationReservationId,challengeNonce:expected.challengeNonce}});
   await t.persistReplacement(captured.project,{operational:true});
   const rejected=r.ingestion.prepareCaptured(t.current,{rawResponseId:captured.rawRecord.rawResponseId,promptRecord:expected,expectedCommittedRevision:t.current.revision});
   assert.equal(rejected.validation.valid,false);assert.deepEqual(Array.from(rejected.validation.issues.filter(row=>row.severity==='ERROR'),row=>row.code),['WRONG_VALUE_TYPE']);
   await t.persistReplacement(rejected.project,{operational:true});
   const next=r.copy(t.current),continuation=r.ingestion.prepareStageContinuation(next,{stage,owningTabInstance:'SYNTHETIC_HANDOFF_TRANSACTION'});assert.equal(continuation.created,true);await t.persistReplacement(next);
  }
 }
 await t.exportStageFiles();assert.equal(downloads.length,0);assert.equal(failures.length,0);assert.ok(t.handoffReview);
 const before=await r.store.readProject(t.current.job.JOB_ID),prompt=t.currentPromptRecord(stage),subject=t.handoffReview.review.authorization.subjectSha256;
 return {r,t,e,controls,downloads,failures,before,prompt,subject,stage,captures};
}

export async function verifyHandoffAuthorizationTransaction({sourceOverrides={},scenario=null}={}){
 sourceOverrides=Object.fromEntries(files.map(file=>[file,sourceOverrides[file]??fs.readFileSync(file,'utf8')]));
 const sourceSha256=Object.fromEntries(Object.entries(sourceOverrides).map(([file,source])=>[file,sha(source)])),cases=[];
 for(const kind of ['success','preparation-failure','transaction-failure','concurrent-change','navigation-after-commit','stage4-correction-success']){
  if(scenario&&scenario!==kind)continue;
  const f=await setup(sourceOverrides,{stage:kind==='stage4-correction-success'?4:1}),{r,t,e,before,prompt,stage}=f,originalPrompts=t.closedLoopPromptEngine,originalStore=r.store;
  const history=e.clone({raw:before.projectData.rawResponses,accepted:before.projectData.acceptedChanges}),decisionCount=before.projectData.humanDecisions.length,promptCount=before.projectData.generatedPrompts.length;
  if(kind==='preparation-failure')t.closedLoopPromptEngine={...originalPrompts,reserveAndBuildPromptRecord:project=>{project.projectData.generatedPrompts.push({instructionId:'SYNTHETIC_UNCOMMITTED_PREPARATION'});throw new Error('SYNTHETIC_PROMPT_PREPARATION_FAILED');}};
  if(kind==='transaction-failure')t.projectStore={...originalStore,replaceProject:async(...args)=>{t.__closedLoopStorageFault='during-project-write';try{return await originalStore.replaceProject(...args);}finally{delete t.__closedLoopStorageFault;}}};
  if(kind==='concurrent-change')t.projectStore={...originalStore,replaceProject:async(...args)=>{const concurrent=await originalStore.readProject(before.job.JOB_ID);concurrent.job.JOB_TITLE='Synthetic independently saved work';await originalStore.writeProject(concurrent,{expectedProjectRevision:concurrent.revision,expectedStateSha256:concurrent.projectSha256});return originalStore.replaceProject(...args);}};
  if(kind==='navigation-after-commit')t.projectStore={...originalStore,replaceProject:async(...args)=>{const saved=await originalStore.replaceProject(...args);t.handoffNavigationSequence++;return saved;}};
  f.captures.length=0;let error=null;try{await t.recordCurrentHandoffAuthorization(true);}catch(caught){error=caught;}
  t.closedLoopPromptEngine=originalPrompts;
  const stored=await originalStore.readProject(before.job.JOB_ID);
  assert.equal(JSON.stringify({raw:stored.projectData.rawResponses,accepted:stored.projectData.acceptedChanges}),JSON.stringify(history),'HANDOFF_UNRELATED_HISTORY_PRESERVED');
  if(kind==='success'||kind==='stage4-correction-success'){
   if(stage===4)assert.equal(originalPrompts.handoffMaterialState(stored,t.currentPromptRecord(stage)).valid,true,'HANDOFF_CORRECTION_MATERIAL_ORACLE: the committed replacement must rebuild byte-exactly');
   assert.equal(error,null);assert.equal(f.failures.length,0);assert.equal(f.downloads.length,1);
   assert.equal(stored.revision,before.revision+1,'HANDOFF_SINGLE_CANONICAL_TRANSACTION_ORACLE: decision and replacement prompt must share one revision');
   assert.equal(stored.projectData.humanDecisions.length,decisionCount+1);assert.equal(stored.projectData.generatedPrompts.length,promptCount+1);
   const fresh=t.currentPromptRecord(stage);assert.ok(fresh&&fresh.instructionId!==prompt.instructionId);assert.equal(fresh.scope.projectRevision,stored.revision);assert.ok(originalPrompts.promptTransportBinding(stored,stage,'COMPLETE',fresh.instructionId,fresh.scope));
   assert.equal(e.recordValue(stored.projectData.operationReservations.find(row=>e.recordId(row,'operationReservations')===prompt.operationReservationId),'STATUS'),'EXPIRED_BY_SCOPE');
   const review=await originalStore.prepareExecutionPackageReview({project:stored,stage,operation:'COMPLETE',instructionId:fresh.instructionId});assert.equal(review.authorization.allowed,true);assert.equal(review.authorization.subjectSha256,f.subject);
   const retained=await originalStore.historyList(stored.job.JOB_ID);assert.equal(retained.activeProjectSha256,stored.projectSha256);assert.ok(await originalStore.readHistoryView(stored.job.JOB_ID));
   assert.equal(e.recordValue(stored.projectData.operationReservations.find(row=>e.recordId(row,'operationReservations')===fresh.operationReservationId),'STATUS'),'EXPORTED','HANDOFF_RECEIPT_ORACLE: export must record its successful transfer');
   // The decision write and the export record each retain the operator's view;
   // the reviewed continuation is not saved as a separate view before export.
   assert.deepEqual(f.captures,['retained','retained'],'HANDOFF_VIEW_RETAINED_BY_WRITE_ORACLE');assert.equal(t.closedLoopHash.sha256Value(await originalStore.readHistoryView(stored.job.JOB_ID)),t.closedLoopHash.sha256Value(r.copy({...t.captureView(),pendingMutation:null})),'HANDOFF_EXPORT_HISTORY_VIEW_ORACLE');
   if(stage===4){
    assert.equal(JSON.stringify({validations:stored.projectData.responseValidations,receipts:stored.projectData.outputReceipts,proposals:stored.projectData.responseProposals}),JSON.stringify({validations:before.projectData.responseValidations,receipts:before.projectData.outputReceipts,proposals:before.projectData.responseProposals}),'HANDOFF_CORRECTION_EVIDENCE_PRESERVED');
    const members=readStoreArchive(new Uint8Array(await f.downloads[0].blob.arrayBuffer())),memberMap=new Map(members.map(row=>[row.canonicalPath,Buffer.from(row.bytes)])),manifest=JSON.parse(memberMap.get('manifest.json').toString());
    assert.equal(manifest.promptIdentity.instructionId,fresh.instructionId);assert.equal(memberMap.get('instruction.txt').toString(),fresh.prompt);assert.equal(sha(memberMap.get('instruction.txt')),fresh.bodySha256);
    for(const file of manifest.contextFiles){const bytes=memberMap.get(file.path);assert.equal(bytes.length,file.byteSize);assert.equal(sha(bytes),file.sha256);}
    const correctionText=[memberMap.get('instruction.txt'),...manifest.contextFiles.map(file=>memberMap.get(file.path))].map(bytes=>bytes.toString()).join('\n');assert.ok(correctionText.includes('WRONG_VALUE_TYPE')&&correctionText.includes('/records/propositions/0/fields/PROPOSITION_TEXT'));
    for(const raw of before.projectData.rawResponses.filter(row=>row.stage===4))assert.ok(manifest.retryInputs.some(row=>row.rawResponseId===raw.rawResponseId),'HANDOFF_CORRECTION_RETRY_INPUT_PRESERVED');
    const changed=r.copy(stored);changed.stages[1].agentData.EXACT_DELIVERABLE_REQUESTED+=' Materially changed after review.';
    assert.equal(originalPrompts.handoffMaterialState(changed,fresh).valid,false,'HANDOFF_CHANGED_MATERIAL_ORACLE');
    const assessment=e.evaluateHandoffAuthorization(changed,{promptRecord:fresh,members:review.members,scan:review.scan});assert.equal(assessment.blocked,true);assert.equal(assessment.canAuthorize,false);assert.equal(assessment.allowed,false);
    assert.throws(()=>e.recordHandoffAuthorization(changed,{promptRecord:fresh,members:review.members,scan:review.scan,purpose:'DISCLOSURE_AUTHORIZATION',recipient:'Synthetic actor',provider:'Synthetic provider',suitabilityBasis:'Disposable fixture only',operatorLabel:'SYNTHETIC_OPERATOR',confirmed:true}),/Instruction bytes or governing material changed/);
    assert.equal((await originalStore.readProject(stored.job.JOB_ID)).projectSha256,stored.projectSha256,'HANDOFF_CHANGED_MATERIAL_ISOLATION_ORACLE');
   }
   cases.push({caseId:kind,revisionAdvances:1,decisionSaved:true,promptSaved:true,strictTransportCurrent:true,authorizedZip:true,exactSubjectPreserved:true,historyReload:true});
  }else{
   assert.ok(error,'HANDOFF_FAILURE_MUST_BE_REPORTED '+kind);assert.equal(f.downloads.length,0,'HANDOFF_FAILURE_MUST_NOT_EXPORT '+kind);
   if(kind==='preparation-failure'){
    assert.match(error.message,/sharing decision was saved.*SYNTHETIC_PROMPT_PREPARATION_FAILED/);assert.equal(stored.revision,before.revision+1);assert.equal(stored.projectData.humanDecisions.length,decisionCount+1);assert.equal(stored.projectData.generatedPrompts.length,promptCount);assert.ok(!JSON.stringify(stored).includes('SYNTHETIC_UNCOMMITTED_PREPARATION'));
    cases.push({caseId:kind,decisionSaved:true,speculativePromptAbsent:true,noExport:true,honestSavedDecisionError:true});
   }else if(kind==='navigation-after-commit'){
    assert.match(error.message,/sharing decision was saved.*selected project, stage, operation or view changed/);assert.equal(stored.revision,before.revision+1);assert.equal(stored.projectData.humanDecisions.length,decisionCount+1);assert.equal(stored.projectData.generatedPrompts.length,promptCount+1);
    cases.push({caseId:kind,decisionSaved:true,promptSaved:true,noExport:true,honestSavedDecisionError:true});
   }else{
    assert.equal(error.code,kind==='transaction-failure'?'INJECTED_STORAGE_FAILURE':'STALE_PROJECT_REVISION');assert.doesNotMatch(error.message,/sharing decision was saved/);assert.equal(stored.projectData.humanDecisions.length,decisionCount);assert.equal(stored.projectData.generatedPrompts.length,promptCount);
    if(kind==='transaction-failure')assert.equal(stored.projectSha256,before.projectSha256);else assert.equal(stored.job.JOB_TITLE,'Synthetic independently saved work');
    cases.push({caseId:kind,decisionSaved:false,promptSaved:false,noExport:true,priorOrConcurrentWorkPreserved:true});
   }
  }
 }
 return {passed:true,checkId:'handoff.authorization-canonical-transaction',synthetic:true,actualBrowser:false,sourceSha256,boundary:'Actual extracted UI owners, generated instruction and exact package review, registered synthetic decision, canonical transaction, reload and History under storage adapter; fault injection at preparation/transaction/concurrency/navigation boundaries.',cases};
}

// One build per authorized continuation. The continuation's fresh review keeps
// the archive of its own verified members; the store releases it to the export
// once, for the same request, under unchanged validators, after rereading each
// member's stored bytes, a compare-only staleness read of both project sources
// and a new authorization decision. Every difference returns null and the app
// runs today's create, which refuses as before. Digest and archive probes count
// the actual whole-project digests and archive builds; they change no result.
const RETAINED_PACKAGE_PROBES=[
 ['let computed;try{computed=await hash.sha256Chunks(hash.canonicalChunks(canonicalProject(row.project)));}',"let computed;try{globalThis.__retainedPackageProbe?.digests.push('cold');computed=await hash.sha256Chunks(hash.canonicalChunks(canonicalProject(row.project)));}"],
 ['try{computed=await hash.sha256Chunks(hash.canonicalChunks(canonicalProject(sources.row.project)));}',"try{globalThis.__retainedPackageProbe?.digests.push('reread');computed=await hash.sha256Chunks(hash.canonicalChunks(canonicalProject(sources.row.project)));}"],
 ['async function handoffArchive(members,crc32ByBlob){\n','async function handoffArchive(members,crc32ByBlob){\n  globalThis.__retainedPackageProbe?.archives.push(members.length);\n']];
// Intended faults: each removes one condition of the take.
const RETAINED_PACKAGE_FAULTS=[
 ['retained-package-reused',' retainedExecutionPackages.delete(review);\n','','RETAINED_PACKAGE_ONE_USE_ORACLE','oneUse'],
 ['retained-package-request-unbound',' if(executionPackageRequestKey(options)!==retained.request||!unchanged())return null;\n',' if(!unchanged())return null;\n','RETAINED_PACKAGE_REQUEST_ORACLE','request'],
 ['retained-package-validators-unchecked','unchanged=()=>rootValidatorsUnchanged(packageSource.validators)&&globalThis.closedLoopWorkflowEngine===engine;','unchanged=()=>true;','RETAINED_PACKAGE_VALIDATOR_ORACLE','validators'],
 ['retained-package-bytes-unread','  for(const file of retained.storedBytes.artifacts){','  for(const file of []){','RETAINED_PACKAGE_MEMBER_BYTES_ORACLE','memberBytes'],
 ['retained-package-unread',' const current=await rereadPackageProject(retained.jobId,packageSource,{verifyBytes:false});\n',' const current={...identity};\n','RETAINED_PACKAGE_OTHER_WRITER_ORACLE','otherWriter'],
 ['retained-package-authorization-carried','  if(authorization?.allowed!==true||authorization.subjectSha256!==retained.authorization.subjectSha256||hash.stableStringify(authorization)!==hash.stableStringify(retained.authorization))return null;\n','','RETAINED_PACKAGE_TAKE_AUTHORIZATION_ORACLE','clock']];
function retainedPackageSources(sourceOverrides,fault=null){
 let store=sourceOverrides['project-store.js'];
 for(const [before,after] of [...RETAINED_PACKAGE_PROBES,...(fault?[[fault[1],fault[2]]]:[])]){assert.equal(store.split(before).length,2,'RETAINED_PACKAGE_SOURCE_ANCHOR '+before.slice(0,60));store=store.replace(before,after);}
 return {...sourceOverrides,'project-store.js':store};
}
// The clock owner is replaced once, before any review captures validators; only
// its private offset moves, as the operator's clock would. Moving it before the
// decision's validity start leaves that decision no longer current.
const RETAINED_PACKAGE_CLOCK_SHIFT=-2*24*3600*1000;
function installRetainedPackageClock(context){return vm.runInContext('(()=>{const now=Date.now;let offset=0;Date.now=function(){return now()+offset;};return value=>{offset=value;};})()',context);}
function retainedPackageProbe(r){const probe={digests:[],archives:[]};r.runtime.__retainedPackageProbe=probe;return probe;}
// Store owner: an authorized Stage 01 handoff whose package carries a stored artifact.
async function retainedPackageStoreFixture(sources){
 const r=projectStoreRuntime({sourceOverrides:sources}),store=r.store;let q=r.core.createBlankState('RETAINED-PACKAGE');q.job.EXACT_USER_OBJECTIVE_VERBATIM='Use the supplied text.';r.engine.ensureShape(q);r.engine.recalculate(q);q=await store.writeProject(q,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
 const name='retained.txt',body=Buffer.from('Exact retained package bytes\n'),saved=await store.putArtifact({artifactId:artifactFixtureId(r.engine,q,'RETAINED-ARTIFACT'),jobId:q.job.JOB_ID,filename:name,blob:new Blob([body],{type:'text/plain'})}),next=r.copy(q);
 r.engine.registerArtifactBytes(next,r.copy({stage:1,artifactId:saved.artifactId,filename:name,mediaType:'text/plain',byteSize:body.length,sha256:saved.sha256}));next.stages[1].authorizedFiles.push(r.copy({artifactId:saved.artifactId,name,sha256:saved.sha256,size:body.length}));q=await store.writeProject(next,{expectedProjectRevision:q.revision});
 const draft=r.copy(q);let prompt=r.prompts.reserveAndBuildPromptRecord(draft,1,{},{}).prompt;q=await store.writeProject(draft,{expectedProjectRevision:q.revision});({project:q,prompt}=await authorizeSyntheticHandoff(r,{project:q,prompt}));
 return {r,store,sources,artifactId:saved.artifactId,probe:retainedPackageProbe(r),shiftClock:installRetainedPackageClock(r.runtime),args:()=>({project:q,jobId:q.job.JOB_ID,stage:1,operation:prompt.operation,testIds:[],productId:null,runId:null,instructionId:prompt.instructionId})};
}
async function packageBytes(pkg){return Buffer.from(await pkg.blob.arrayBuffer());}
async function retainedPackageStoreCases(f,{only=null}={}){
 const {store,r}=f,h=r.runtime.closedLoopHash,cases={},run=async(name,body)=>{if(only?only===name:name!=='corruption')cases[name]=await body();};
 const retain=async(args=f.args())=>store.prepareExecutionPackageReview(args,{retainPackage:true});
 await run('equal',async()=>{
  const args=f.args(),archives=f.probe.archives.length,review=await retain(args);assert.equal(f.probe.archives.length,archives+1,'RETAINED_PACKAGE_EQUALITY_ORACLE: an authorized retaining review builds the archive once');
  const taken=await store.takeRetainedExecutionPackage(review,args),created=await store.createExecutionPackage(args);
  assert.ok(taken,'RETAINED_PACKAGE_EQUALITY_ORACLE: an unchanged authorized continuation must take its retained package');
  const [takenBytes,createdBytes]=[await packageBytes(taken),await packageBytes(created)];
  assert.equal(takenBytes.equals(createdBytes),true,'RETAINED_PACKAGE_EQUALITY_ORACLE: ZIP bytes differ from createExecutionPackage on the same source');
  assert.equal(taken.packageSha256,created.packageSha256,'RETAINED_PACKAGE_EQUALITY_ORACLE');assert.equal(taken.packageSha256,sha(takenBytes),'RETAINED_PACKAGE_EQUALITY_ORACLE: independent digest');
  assert.equal(taken.filename,created.filename,'RETAINED_PACKAGE_EQUALITY_ORACLE');assert.equal(h.stableStringify(taken.manifest),h.stableStringify(created.manifest),'RETAINED_PACKAGE_EQUALITY_ORACLE: manifest');
  const members=readStoreArchive(new Uint8Array(takenBytes));assert.deepEqual(members.map(row=>row.canonicalPath),Array.from(review.members,row=>row.canonicalPath).sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b))),'RETAINED_PACKAGE_EQUALITY_ORACLE: reviewed members');
  for(const member of review.members)if(member.sha256)assert.equal(sha(Buffer.from(members.find(row=>row.canonicalPath===member.canonicalPath).bytes)),member.sha256,'RETAINED_PACKAGE_EQUALITY_ORACLE: reviewed member bytes');
  return {zipBytes:takenBytes.length,members:members.length,equalToCreate:true};
 });
 await run('oneUse',async()=>{const args=f.args(),review=await retain(args);assert.ok(await store.takeRetainedExecutionPackage(review,args),'RETAINED_PACKAGE_ONE_USE_ORACLE: first take');assert.equal(await store.takeRetainedExecutionPackage(review,args),null,'RETAINED_PACKAGE_ONE_USE_ORACLE: a second take must return null');return {secondTake:null};});
 await run('request',async()=>{
  const args=f.args(),review=await retain(args);
  assert.equal(await store.takeRetainedExecutionPackage(review,{...args,testIds:['SYNTHETIC-UNREVIEWED-TEST']}),null,'RETAINED_PACKAGE_REQUEST_ORACLE: mismatched arguments must return null');
  assert.equal(await store.takeRetainedExecutionPackage(review,args),null,'RETAINED_PACKAGE_REQUEST_ORACLE: a refused take consumes the entry');
  const again=await retain(args);assert.equal(await store.takeRetainedExecutionPackage(again,{...args,project:{...args.project,revision:Number(args.project.revision)+1}}),null,'RETAINED_PACKAGE_REQUEST_ORACLE: another project identity must return null');
  return {mismatchedArguments:null,consumed:null,otherIdentity:null};
 });
 await run('unretained',async()=>{
  const args=f.args(),archives=f.probe.archives.length,review=await store.prepareExecutionPackageReview(args);
  assert.equal(f.probe.archives.length,archives,'RETAINED_PACKAGE_REVIEW_ONLY_ORACLE: a review without retainPackage builds no archive');
  assert.equal(await store.takeRetainedExecutionPackage(review,args),null,'RETAINED_PACKAGE_REVIEW_ONLY_ORACLE');
  return {archives:0,take:null};
 });
 await run('validators',async()=>{
  const out={};
  for(const kind of ['engine-global','text-encoder']){
   const args=f.args(),review=await retain(args),engine=r.runtime.closedLoopWorkflowEngine,encoders=TextEncoder.prototype,encode=encoders.encode;
   if(kind==='engine-global')r.runtime.closedLoopWorkflowEngine=Object.freeze({...engine});else encoders.encode=function(input){return Reflect.apply(encode,this,[input]);};
   let taken;try{taken=await store.takeRetainedExecutionPackage(review,args);}finally{r.runtime.closedLoopWorkflowEngine=engine;encoders.encode=encode;}
   assert.equal(taken,null,'RETAINED_PACKAGE_VALIDATOR_ORACLE: a replaced '+kind+' must return null');out[kind]=null;
  }
  const args=f.args(),control=await retain(args);assert.ok(await store.takeRetainedExecutionPackage(control,args),'RETAINED_PACKAGE_VALIDATOR_ORACLE: restored validators take again');
  return out;
 });
 await run('memberBytes',async()=>{
  const args=f.args(),review=await retain(args),body=storedArtifactBody(r,f.artifactId),original=body.blob;body.blob=new Blob([Buffer.alloc(original.size,33)]);
  let taken,refusal=null;try{taken=await store.takeRetainedExecutionPackage(review,args);try{await store.createExecutionPackage(args);}catch(error){refusal=error.code;}}finally{body.blob=original;}
  assert.equal(taken,null,'RETAINED_PACKAGE_MEMBER_BYTES_ORACLE: changed stored member bytes must return null');assert.equal(refusal,'EXECUTION_PACKAGE_ARTIFACT_MISMATCH','RETAINED_PACKAGE_MEMBER_BYTES_ORACLE: the create refuses with its own code');
  const control=await retain(args);assert.ok(await store.takeRetainedExecutionPackage(control,args),'RETAINED_PACKAGE_MEMBER_BYTES_ORACLE: restored bytes take again');
  return {take:null,createRefusal:refusal};
 });
 await run('clock',async()=>{
  const args=f.args(),review=await retain(args);f.shiftClock(RETAINED_PACKAGE_CLOCK_SHIFT);let taken,refusal=null;
  try{taken=await store.takeRetainedExecutionPackage(review,args);try{await store.createExecutionPackage(args);}catch(error){refusal={code:error.code,allowed:error.review?.authorization?.allowed};}}finally{f.shiftClock(0);}
  assert.equal(taken,null,'RETAINED_PACKAGE_TAKE_AUTHORIZATION_ORACLE: authorization is decided again when the package is taken');assert.deepEqual(refusal,{code:'HANDOFF_AUTHORIZATION_REQUIRED',allowed:false},'RETAINED_PACKAGE_TAKE_AUTHORIZATION_ORACLE: the create denies with its review');
  return {take:null,createRefusal:refusal.code};
 });
 await run('otherWriter',async()=>{
  // Another tab: a separate store runtime that writes the same physical rows.
  const args=f.args(),review=await retain(args),tab=projectStoreRuntime({sourceOverrides:f.sources});tab.rows.get=name=>r.rows.get(name);tab.rows.set=(name,value)=>r.rows.set(name,value);
  const other=await tab.store.readProject(args.jobId);other.job.JOB_TITLE='Synthetic work saved by another tab';await tab.store.writeProject(other,{expectedProjectRevision:other.revision,expectedStateSha256:other.projectSha256});
  assert.equal(await store.takeRetainedExecutionPackage(review,args),null,'RETAINED_PACKAGE_OTHER_WRITER_ORACLE: a write from another tab must return null');
  let refusal=null;try{await store.createExecutionPackage(args);}catch(error){refusal={code:error.code,message:error.message};}
  assert.deepEqual(refusal,{code:'EXECUTION_PACKAGE_VERSION_STALE',message:'The project changed before its handoff could be prepared. Open the current version and export again.'},'RETAINED_PACKAGE_OTHER_WRITER_ORACLE: the create refuses as before');
  return {take:null,createRefusal:refusal.code};
 });
 // Its own fixture (only): a corrupted stored row takes the cold public read,
 // which refuses and quarantines it once.
 await run('corruption',async()=>{
  const args=f.args(),review=await retain(args),row=r.rows.get('projects').get(args.jobId);assert.ok(row?.project,'RETAINED_PACKAGE_CORRUPTION_ORACLE: inline project row');
  row.project.activeView='Corrupted outside the projection receipt';let refusal=null;
  try{await store.takeRetainedExecutionPackage(review,args);}catch(error){refusal={code:error.code,message:error.message};}
  assert.deepEqual(refusal,{code:'PROJECT_HASH_MISMATCH',message:'Project hash mismatch. The original row was preserved in quarantine.'},'RETAINED_PACKAGE_CORRUPTION_ORACLE');assert.equal((await store.listQuarantinedProjects()).length,1,'RETAINED_PACKAGE_CORRUPTION_ORACLE: quarantined once');
  return {code:refusal.code,quarantined:1};
 });
 return cases;
}
// App owner: the actual authorization continuation with the actual store.
async function retainedPackageAppFixture(sources){
 const f=await setup(sources),{r,t}=f,store=r.store,calls=[];f.probe=retainedPackageProbe(r);f.calls=calls;f.store=store;f.shiftClock=installRetainedPackageClock(t);
 const counted=async(entry,run)=>{const digests=f.probe.digests.length,archives=f.probe.archives.length;try{const value=await run();if(entry.kind==='take')entry.taken=value!==null;return value;}catch(error){entry.error=error.code||String(error.message||error);throw error;}finally{entry.digests=f.probe.digests.slice(digests).join('+')||'none';entry.archives=f.probe.archives.length-archives;calls.push(entry);}};
 // take:false, retain:false is today's continuation: a review, then a create.
 f.authorize=async({take=true,retain=true,beforeTake=null}={})=>{
  const {takeRetainedExecutionPackage,...rest}=store;
  t.projectStore={...rest,
   prepareExecutionPackageReview:(args,options)=>counted({kind:'review',retain:retain&&options?.retainPackage===true},()=>retain?store.prepareExecutionPackageReview(args,options):store.prepareExecutionPackageReview(args)),
   createExecutionPackage:args=>counted({kind:'create'},()=>store.createExecutionPackage(args)),
   ...(take?{takeRetainedExecutionPackage:(review,args)=>counted({kind:'take'},async()=>{await beforeTake?.();return store.takeRetainedExecutionPackage(review,args);})}:{})};
  calls.length=0;f.captures.length=0;let error=null;
  try{await t.recordCurrentHandoffAuthorization(true);}catch(caught){error=caught;}finally{t.projectStore=store;f.shiftClock(0);}
  return error;
 };
 return f;
}
export async function verifyRetainedHandoffPackage({sourceOverrides={}}={}){
 sourceOverrides=Object.fromEntries(files.map(file=>[file,sourceOverrides[file]??fs.readFileSync(file,'utf8')]));
 const sources=retainedPackageSources(sourceOverrides),observations={},continuationDigests=calls=>calls.slice(1).reduce((sum,call)=>sum+(call.digests==='none'?0:call.digests.split('+').length),0);
 // The continuation takes its review's package: one cold read (two digests)
 // where today's review and create read cold twice (four), and no create.
 {
  const f=await retainedPackageAppFixture(sources);assert.equal(f.probe.archives.length,0,'RETAINED_PACKAGE_REVIEW_ONLY_ORACLE: the operator review builds no archive');
  assert.equal(await f.authorize(),null);assert.equal(f.failures.length,0);assert.equal(f.downloads.length,1);
  assert.deepEqual(f.calls,[{kind:'review',retain:false,digests:'cold+reread',archives:0},{kind:'review',retain:true,digests:'cold+reread',archives:1},{kind:'take',taken:true,digests:'none',archives:0}],'RETAINED_PACKAGE_SINGLE_BUILD_ORACLE');
  assert.deepEqual(f.captures,['retained','retained'],'HANDOFF_VIEW_RETAINED_BY_WRITE_ORACLE');
  const zip=readStoreArchive(new Uint8Array(await packageBytes(f.downloads[0]))),manifest=JSON.parse(Buffer.from(zip.find(row=>row.canonicalPath==='manifest.json').bytes).toString());assert.equal(manifest.promptIdentity.instructionId,f.t.currentPromptRecord(f.stage).instructionId,'RETAINED_PACKAGE_SINGLE_BUILD_ORACLE: the exported package is the current instruction');
  observations.continuation={calls:f.calls,continuationDigests:continuationDigests(f.calls)};
 }
 {
  const f=await retainedPackageAppFixture(sources);assert.equal(await f.authorize({take:false,retain:false}),null);assert.equal(f.downloads.length,1);
  assert.deepEqual(f.calls,[{kind:'review',retain:false,digests:'cold+reread',archives:0},{kind:'review',retain:false,digests:'cold+reread',archives:0},{kind:'create',digests:'cold+reread',archives:1}],'RETAINED_PACKAGE_SINGLE_BUILD_ORACLE: control');
  observations.withoutRetention={calls:f.calls,continuationDigests:continuationDigests(f.calls)};
 }
 assert.deepEqual([observations.continuation.continuationDigests,observations.withoutRetention.continuationDigests],[2,4],'RETAINED_PACKAGE_SINGLE_BUILD_ORACLE: continuation digests');
 // A take-time denial (the operator clock no longer within the decision's
 // validity) returns null; the create's denial takes the existing review path.
 {
  const f=await retainedPackageAppFixture(sources);assert.equal(await f.authorize({beforeTake:async()=>f.shiftClock(RETAINED_PACKAGE_CLOCK_SHIFT)}),null);
  assert.equal(f.failures.length,0,'RETAINED_PACKAGE_TAKE_DENIAL_ORACLE: a denial is presented, not reported');assert.equal(f.downloads.length,0,'RETAINED_PACKAGE_TAKE_DENIAL_ORACLE: nothing is exported');
  assert.deepEqual(f.calls.slice(1),[{kind:'review',retain:true,digests:'cold+reread',archives:1},{kind:'take',taken:false,digests:'none',archives:0},{kind:'create',digests:'cold+reread',archives:0,error:'HANDOFF_AUTHORIZATION_REQUIRED'}],'RETAINED_PACKAGE_TAKE_DENIAL_ORACLE');
  assert.equal(f.t.handoffReview?.review?.authorization?.allowed,false,'RETAINED_PACKAGE_TAKE_DENIAL_ORACLE: the denial review is presented');
  observations.takeDenial={calls:f.calls.slice(1),presented:'denied'};
 }
 observations.store={...await retainedPackageStoreCases(await retainedPackageStoreFixture(sources)),...await retainedPackageStoreCases(await retainedPackageStoreFixture(sources),{only:'corruption'})};
 const faults=[];
 for(const fault of RETAINED_PACKAGE_FAULTS){
  const [name,,,oracle,only]=fault,faulted=retainedPackageSources(sourceOverrides,fault);let detected=false;
  try{await retainedPackageStoreCases(await retainedPackageStoreFixture(faulted),{only});}catch(error){if(error?.code!=='ERR_ASSERTION'||!String(error.message).includes(oracle))throw error;detected=true;}
  assert.equal(detected,true,'RETAINED_PACKAGE_INTENDED_FAULT_ORACLE: '+name+' escaped '+oracle);faults.push({fault:name,oracle,result:'DETECTED'});
 }
 return {passed:true,checkId:'handoff.retained-continuation-package',synthetic:true,actualBrowser:false,boundary:'Actual extracted UI owners and production store under the transaction adapter; a second store runtime on the same rows stands for another tab; synthetic digest and archive probes count work only.',observations,faults};
}

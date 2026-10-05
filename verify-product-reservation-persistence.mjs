import {authorizeSyntheticHandoff} from './test-handoff-authorization.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readStoreArchive} from './test-zip.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime,bindAcceptanceUi,bindHandoffReviewUiState} from './test-project-store-runtime.mjs';
import {responseFixture,OUTPUT} from './operator-journey-fixtures.mjs';
import {createWorkflowObservation} from './operator-browser-driver.mjs';
globalThis.dispatchEvent=()=>true;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file==='workflow-engine.js'&&process.env.ENGINE_SOURCE?process.env.ENGINE_SOURCE:file,'utf8'),{filename:file});
const {buildUnchangedConfirmationFixture}=await import('./stage19-fixture.mjs');
const engine=globalThis.closedLoopWorkflowEngine,schema=globalThis.closedLoopWorkflowSchema,store=globalThis.closedLoopProjectStore;
const durable=projectStoreRuntime(),durableStore=durable.store,promptSnapshots=[];
const phase=name=>console.error(JSON.stringify({suite:'verify-product-reservation-persistence',phase:name}));
phase('baseline-fixture-start');
const {p,cand19,artifactPayloads}=buildUnchangedConfirmationFixture('JOB-PRODUCT-RESERVATION-PERSISTENCE',{onPrompt:(record,project)=>promptSnapshots.push({record:engine.clone(record),project:engine.clone(project)})});
const artifactIds=engine.recordValue(engine.records(p,'candidateFreezes').find(row=>engine.recordId(row,'candidateFreezes')===cand19),'COMPONENT_MANIFEST').map(row=>row.artifactId);
const decision=engine.recordRegisteredHumanDecision(p,{stage:20,purpose:'BASELINE_AUTHORIZATION',targetFamily:'candidateFreezes',targetId:cand19,value:'AUTHORIZED',operatorLabel:'SYNTHETIC_VERIFIER'});
engine.freezeBaseline(p,{artifactIds,authorizationDecisionId:engine.recordId(decision,'humanDecisions'),operatorLabel:'SYNTHETIC_VERIFIER'});
assert.equal(engine.gate(20,p).complete,true,'The fixture must first complete the real baseline authorization.');
engine.recalculate(p);
const before=store.validateProjectIntegrity(p);
assert.equal(before.valid,true,JSON.stringify(before));
const priorState=engine.clone(p);
const reserved=engine.preparePromptContext(p,21,{operation:'COMPLETE'}),product=engine.records(p,'products').at(-1);
assert.ok(reserved.options.scope.productId,'A handoff must reserve its exact product identity.');
const ownership=schema.RECORD_SCHEMAS.products.ownership;
const authored=ownership.agent.filter(key=>Object.hasOwn(engine.recordFields(product),key));
engine.recalculate(p);
const after=store.validateProjectIntegrity(p);
const report={synthetic:true,actualBrowser:false,expected:'A reserved product is persistable before a response and contains no agent-authored execution observations',before,after,prematureAgentFields:authored};
assert.deepEqual(authored,[],'PRODUCT_RESERVATION_OWNERSHIP_ORACLE: reservation must not invent external execution observations.');
assert.equal(after.valid,true,'PRODUCT_RESERVATION_PERSISTENCE_ORACLE: the Stage 21 reservation must satisfy the same durable schema as its completed state.');
phase('baseline-and-reservation-validated');

for(const snapshot of promptSnapshots){await durableStore.persistPromptContextFiles(durable.copy(snapshot.record),durable.copy(snapshot.project));snapshot.project=null;}
for(const payload of artifactPayloads){
 const record=engine.records(priorState,'artifacts').find(row=>engine.recordId(row,'artifacts')===payload.artifactId);
 await durableStore.putArtifact({artifactId:payload.artifactId,jobId:p.job.JOB_ID,filename:engine.recordValue(record,'FILENAME'),mediaType:engine.recordValue(record,'MEDIA_TYPE'),blob:new Blob([payload.bytes])});
}
let saved=await durableStore.writeProject(durable.copy(priorState),{expectedProjectRevision:0,createOnly:true});
const checkpointBefore=(await durableStore.historyList(saved.job.JOB_ID)).activeId;
const pending=durable.copy(p);pending.revision=saved.revision;
saved=await durableStore.writeProject(pending,{expectedProjectRevision:saved.revision});
const checkpointReserved=(await durableStore.historyList(saved.job.JOB_ID)).activeId,productId=engine.recordId(product,'products');
const reloaded=await durableStore.readProject(saved.job.JOB_ID);
assert.ok(reloaded.projectData.products.some(row=>engine.recordId(row,'products')===productId),'PRODUCT_RESERVATION_DURABILITY_ORACLE');
const reversed=await durableStore.restoreCheckpoint(saved.job.JOB_ID,checkpointBefore,{expectedProjectRevision:saved.revision});
assert.ok(!reversed.project.projectData.products.some(row=>engine.recordId(row,'products')===productId),'The earlier version must not inherit a later product reservation.');
const restored=await durableStore.restoreCheckpoint(saved.job.JOB_ID,checkpointReserved,{expectedProjectRevision:reversed.project.revision});
assert.ok(restored.project.projectData.products.some(row=>engine.recordId(row,'products')===productId),'PRODUCT_RESERVATION_RECOVERY_ORACLE');
assert.deepEqual(new Uint8Array(await (await durableStore.getArtifact(artifactPayloads[0].artifactId)).blob.arrayBuffer()),artifactPayloads[0].bytes);
phase('reservation-recovery-complete');
report.durableCases=['Persist the baseline before product reservation','Persist and reload the reserved product before response acceptance','Restore the earlier baseline without a later reservation','Restore the matching reserved version and exact baseline bytes'].map(name=>({name,result:'PASS'}));
// A valid prerequisite is insufficient unless the normal save path leaves a
// current, exportable instruction after reservation and durable commit.
{
 const baselineRestored=await durableStore.restoreCheckpoint(saved.job.JOB_ID,checkpointBefore,{expectedProjectRevision:restored.project.revision});
 const runtime=durable.runtime,uiEngine=durable.engine,source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');
 const extract=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return source.slice(a,b);};
 Object.assign(runtime,{current:durable.copy(baselineRestored.project),projects:durable.copy([baselineRestored.project]),core:durable.core,engine:uiEngine,schema:runtime.closedLoopWorkflowSchema,ingestion:durable.ingestion,projectStore:durableStore,clone:durable.copy,recordValue:uiEngine.recordValue,safe:uiEngine.safe,TAB_INSTANCE_ID:'SYNTHETIC-HANDOFF',withStorageActivity:async(_label,work)=>work(),unloadInactiveProjects:()=>{},mobileSessionCurrent:()=>false,recordCommittedBoundary:async()=>{},render:()=>{}});
 runtime.current.activeStage=21;runtime.current.activeView='Workflow';
 runtime.captureView=()=>durable.copy({activeStage:runtime.current.activeStage,activeView:runtime.current.activeView,operationSelection:runtime.operationSelection,runSelection:runtime.runSelection});
 runtime.captureCurrentView=async()=>durableStore.saveCheckpoint(runtime.current.job.JOB_ID,{expectedProjectRevision:runtime.current.revision,view:runtime.captureView()});
 vm.runInContext(extract('function canonicalCurrentStage(','function displayedStageAction(')+extract('function stageOperations(','// A saved response may be inspected independently.')+extract('async function persistReplacement(','async function save(')+extract('async function savePromptRecord(','function promptTransportFilename('),runtime,{filename:'app-core.js:handoff-save-and-current-binding'});
 try{await runtime.savePromptRecord(21);}catch(error){
  const record=runtime.current.projectData.generatedPrompts.at(-1),options=runtime.promptOptions(21),scope=runtime.closedLoopPromptEngine.scopeFor(21,runtime.current,options.scope||{},options.operation);
  console.error(JSON.stringify({caseId:'HANDOFF-COMMITTED-CURRENT',operation:options.operation,selectedOptions:options,savedScope:record?.scope,currentScope:scope,revision:runtime.current.revision,error:String(error.message||error)}));
  assert.fail('HANDOFF_COMMITTED_CURRENT_ORACLE: a generated handoff must remain current and exportable after its normal durable commit: '+String(error.message||error));
 }
 let committed=runtime.currentPromptRecord(21);assert.ok(committed?.transportBindingRequired,'HANDOFF_COMMITTED_CURRENT_ORACLE');
 runtime.current=await durableStore.readProject(saved.job.JOB_ID);
 assert.equal(runtime.currentPromptRecord(21)?.instructionId,committed.instructionId,'HANDOFF_RELOAD_CURRENT_ORACLE');
 const authorized=await authorizeSyntheticHandoff(durable,{project:runtime.current,prompt:committed,action:durable.copy({target:'Disposable Stage21 product-reservation fixture',riskClasses:['READ_ONLY','REVERSIBLE'],expectedEffect:'Read the synthetic supplied context and write only response.json and result.txt in the disposable verifier location.',reversibility:'Discard this isolated verifier project and output files.',maximumCost:'No paid services or external tool calls.',authority:'Explicit synthetic operator decision for this fixture only.',containment:'No real user projects, network resources, credentials, or production systems.',stopCondition:'Stop if a requested action exceeds this disposable fixture.',responsibleActor:'SYNTHETIC_TEST_OPERATOR and deterministic fixture counterpart'})});runtime.current=authorized.project;runtime.projects=[runtime.current];committed=authorized.prompt;
 const bundle=await durableStore.createExecutionPackage(authorized.request);
 assert.equal(bundle.manifest.promptIdentity.bodySha256,committed.bodySha256,'HANDOFF_EXPORT_IDENTITY_ORACLE');
 assert.equal(bundle.manifest.scope.productId,committed.scope.productId,'HANDOFF_EXPORT_TARGET_ORACLE');
 const members=new Map(readStoreArchive(new Uint8Array(await bundle.blob.arrayBuffer())).map(entry=>[entry.canonicalPath,entry.bytes]));
 assert.deepEqual(members.get('instruction.txt'),new TextEncoder().encode(committed.prompt),'HANDOFF_EXPORT_BYTES_ORACLE');
 const exportedManifest=JSON.parse(new TextDecoder().decode(members.get('manifest.json')));
 assert.equal(exportedManifest.promptIdentity.bodySha256,committed.bodySha256,'HANDOFF_EXPORTED_MANIFEST_ORACLE');
 assert.equal(exportedManifest.scope.productId,committed.scope.productId,'HANDOFF_EXPORTED_TARGET_ORACLE');
 // Execute the real stage export owner, including its durable receipt. A
 // duplicate activation must still deliver one archive containing exact bytes.
 bindHandoffReviewUiState(runtime,{source});
 const downloads=[];
 Object.assign(runtime,{stagePlanItems:(stage,operation)=>uiEngine.stageTestExecutionPlan(runtime.current,{stage,operation}).items,displayedStageAction:stage=>uiEngine.operationalNextAction(runtime.current,stage),document:{querySelectorAll:()=>[]},$:()=>null,announce:()=>{},reportActionFailure:error=>{throw error;},downloadBlob:(blob,filename)=>downloads.push({blob,filename})});
 const functionSource=name=>{const start=source.search(new RegExp('(?:async )?function '+name+'\\('));assert.ok(start>=0);const next=source.slice(start+1).search(/\n(?:async )?function /);assert.ok(next>=0);return source.slice(start,start+1+next);};
 vm.runInContext(extract('let promptExportInFlight=','async function exportPromptContext(')+functionSource('recordInstructionExport')+'\n'+functionSource('exportStageFiles'),runtime,{filename:'app-core.js:actual-stage-export'});
 await Promise.all([runtime.exportStageFiles(),runtime.exportStageFiles()]);
 assert.equal(downloads.length,1,'ONE_FILE_HANDOFF_ORACLE: one stage action or repeated activation must produce exactly one file.');
 const actualMembers=new Map(readStoreArchive(new Uint8Array(await downloads[0].blob.arrayBuffer())).map(entry=>[entry.canonicalPath,entry.bytes]));
 assert.deepEqual(actualMembers.get('instruction.txt'),new TextEncoder().encode(committed.prompt),'ONE_FILE_HANDOFF_ORACLE: exact controlling instruction bytes are required.');
 const actualManifest=JSON.parse(new TextDecoder().decode(actualMembers.get('manifest.json')));
 assert.equal(actualManifest.promptIdentity.instructionId,committed.instructionId,'ONE_FILE_HANDOFF_ORACLE: package identity must match the committed instruction.');
 assert.equal(actualManifest.scope.productId,committed.scope.productId,'ONE_FILE_HANDOFF_ORACLE: reserved target must remain bound.');
 const exportedReservation=uiEngine.records(runtime.current,'operationReservations').find(row=>uiEngine.recordId(row,'operationReservations')===committed.operationReservationId);
 assert.equal(uiEngine.recordValue(exportedReservation,'STATUS'),'EXPORTED','ONE_FILE_HANDOFF_ORACLE: record the completed export once.');
 report.exportAction={caseId:'ONE_FILE_HANDOFF_ORACLE',result:'PASS',downloads:downloads.length,filename:downloads[0].filename,exactInstructionBytes:true,manifestIdentity:true,reservationStatus:'EXPORTED'};
 phase('export-control-complete');
 const revision=runtime.current.revision;assert.equal((await runtime.savePromptRecord(21)).instructionId,committed.instructionId,'HANDOFF_EXACT_RETRY_ORACLE');assert.equal(runtime.current.revision,revision);
 const healthy=runtime.current;
 const target=project=>uiEngine.records(project,'products').find(row=>uiEngine.recordId(row,'products')===committed.scope.productId);
 report.currentBindingCases=[];
 for(const [caseId,violate] of [
  ['another-project',project=>{project.job.JOB_ID+='-OTHER';}],
  ['later-revision',project=>{project.revision++;}],
  ['abandoned-activation',project=>{project.historyActivationId='ABANDONED-ACTIVATION';}],
  ['missing-reserved-target',project=>{project.projectData.products=project.projectData.products.filter(row=>uiEngine.recordId(row,'products')!==committed.scope.productId);}],
  ['invalidated-reserved-target',project=>{target(project).invalidatedBy='REPLACEMENT';}],
  ['completed-reserved-target',project=>{target(project).completionState='COMPLETED';}]
 ]){
  runtime.current=durable.copy(healthy);violate(runtime.current);
  assert.equal(runtime.currentPromptRecord(21),null,'HANDOFF_TARGET_VALIDITY_ORACLE: '+caseId);
  runtime.current=healthy;assert.equal(runtime.currentPromptRecord(21)?.instructionId,committed.instructionId,'HANDOFF_RESTORED_VALIDITY_ORACLE: '+caseId);
  report.currentBindingCases.push({caseId,expected:'Reject an incompatible handoff; accept its unchanged valid version',result:'PASS'});
 }
 report.durableCases.push(...['The actual handoff control commits a current instruction after restoring its valid prerequisites','The committed instruction remains current on reload and exports its exact reserved target','Repeating the save retains its exact instruction without a new revision'].map(name=>({name,result:'PASS'})));
 // A verified product response must commit through the same persistence owner
 // as its reservation. A successful in-memory ingestion is not a saved result.
 const current=runtime.current,request=responseFixture({schema,engine:uiEngine,prompt:committed,manifest:actualManifest,contextFiles:actualManifest.contextFiles.map(file=>({bytes:Buffer.from(actualMembers.get(file.path))})),instructionBytes:Buffer.from(actualMembers.get('instruction.txt'))});
 const slot=actualManifest.attachmentSlots.find(item=>item.role==='FINISHED_PRODUCT'&&item.required),blob=new Blob([OUTPUT],{type:'text/plain'}),sha256=await runtime.closedLoopHash.sha256Bytes(blob),pending=durable.copy(current);
 const artifactId=uiEngine.allocateId(pending,'artifacts',{payload:durable.copy({purpose:'PRODUCT_ACCEPTANCE_PERSISTENCE'})});
 request.attachments=[{attachmentSlotId:slot.attachmentSlotId,role:slot.role,temporaryKey:'finished-product',filename:'result.txt',mediaType:'text/plain',byteSize:blob.size,sha256,required:true}];request.evidence[0].attachmentRef={tempKey:'finished-product'};
 await durableStore.putArtifact({artifactId,jobId:pending.job.JOB_ID,blob,filename:'result.txt',mediaType:'text/plain'});
 const prepared=durable.ingestion.prepare(pending,{stage:21,text:JSON.stringify(request),promptRecord:committed,files:durable.copy([{artifactId,name:'result.txt',type:'text/plain',size:blob.size,sha256,attachmentSlotId:slot.attachmentSlotId}]),transport:durable.copy({authority:'AUTHORITATIVE_RESPONSE_FILE',packageId:committed.packageId,operationReservationId:committed.operationReservationId,challengeNonce:committed.challengeNonce})});
 assert.equal(prepared.validation.valid,true,'PRODUCT_ACCEPTANCE_FIXTURE_ORACLE: '+JSON.stringify(prepared.validation.issues));
 const staged=await durableStore.writeProject(prepared.project,{operational:true,expectedProjectRevision:current.revision,expectedStateSha256:current.projectSha256});
 phase('valid-response-staged');
 const acceptedCount=staged.projectData.acceptedChanges.length;
 const assertAccepted=(r,failures)=>{
  assert.equal(failures.length,0,'PRODUCT_ACCEPTANCE_PERSISTENCE_ORACLE: a valid response with verified product bytes failed to commit: '+failures.map(error=>error.message).join(' | '));
  assert.equal(r.runtime.current.projectData.acceptedChanges.length,acceptedCount+1,'PRODUCT_ACCEPTANCE_PERSISTENCE_ORACLE: acceptance did not commit exactly once.');
  assert.equal(r.engine.gate(21,r.runtime.current).complete,true,'PRODUCT_ACCEPTANCE_PERSISTENCE_ORACLE: the matching accepted product and bytes did not complete their stage.');
 };
 // Replay the same valid, bounded case in an isolated shared runtime with one
 // implementation fault. The production files and healthy store stay intact.
 const productionSource=fs.readFileSync('project-store.js','utf8'),faulted=projectStoreRuntime({fault:{id:'omit-candidate-byte-verification',file:'project-store.js',before:'  await observeProjectArtifactCustody(next);',after:'  // Injected fault: derive the new version using only prior-version custody.'}});
 for(const [name,rows] of durable.rows)faulted.rows.set(name,new Map([...rows].map(([key,row])=>[key,faulted.copy(row)])));
 const faultFailures=bindAcceptanceUi(faulted,faulted.copy(staged),prepared.proposal.proposalId);
 await faulted.runtime.accept();if(faulted.runtime.replacementReview)await faulted.runtime.confirm();
 assert.throws(()=>assertAccepted(faulted,faultFailures),/PRODUCT_ACCEPTANCE_PERSISTENCE_ORACLE/,'The normative acceptance oracle must detect omitted candidate-byte verification.');
 assert.ok(faultFailures.some(error=>error.code==='PROJECT_INTEGRITY_FAILED'&&/deterministic recalculation/.test(error.message)),'The injected fault must reproduce the classified save failure.');
 assert.equal((await faulted.store.readProject(staged.job.JOB_ID)).projectData.acceptedChanges.length,acceptedCount,'A rejected acceptance must preserve accepted work.');
 assert.equal(fs.readFileSync('project-store.js','utf8'),productionSource,'The injected runtime fault must not change production source.');
 report.acceptanceFault={caseId:'omit-candidate-byte-verification',detectedBy:'PRODUCT_ACCEPTANCE_PERSISTENCE_ORACLE',errors:faultFailures.map(error=>({code:error.code,message:error.message})),sourceRestored:true,result:'PASS'};
 phase('candidate-custody-fault-detected');
 const failures=bindAcceptanceUi(durable,staged,prepared.proposal.proposalId);
 await runtime.accept();if(runtime.replacementReview)await runtime.confirm();assertAccepted(durable,failures);
 phase('product-acceptance-committed');
 const accepted=await durableStore.readProject(staged.job.JOB_ID),acceptedCheckpoint=(await durableStore.historyList(staged.job.JOB_ID)).activeId;
 assert.equal(accepted.projectData.acceptedChanges.length,acceptedCount+1,'PRODUCT_ACCEPTANCE_RELOAD_ORACLE');
 for(const phase of ['FINAL_PRODUCT_DETERMINISTIC','FINAL_PRODUCT_MEANING','FINAL_PRODUCT_ADVERSARIAL'])assert.equal(uiEngine.verificationPhaseTargetAvailability(accepted,phase),'TRUE','PRODUCT_ACCEPTANCE_RELOAD_ORACLE: '+phase);
 // A journey must observe the complete next action in the runtime that has
 // verified this version's files. JSON metadata alone omits required evidence
 // and can incorrectly block native final-product verification.
 runtime.history={state:{jobId:accepted.job.JOB_ID}};
 const json=value=>JSON.parse(JSON.stringify(value));
 const observeWorkflow=createWorkflowObservation(async expression=>json(await vm.runInContext(expression,runtime)));
 const expectedEvidence=new Map([[23,'Independent meaning review'],[24,'Adversarial challenge evidence']]);
 const assertObservation=(observed,expected,{productAvailable=true}={})=>{
  assert.equal(observed.project.job.JOB_ID,expected.job.JOB_ID,'OPERATOR_RUNTIME_VERSION_ORACLE');
  assert.equal(observed.project.revision,expected.revision,'OPERATOR_RUNTIME_VERSION_ORACLE');
  assert.equal(observed.project.projectSha256,expected.projectSha256,'OPERATOR_RUNTIME_VERSION_ORACLE');
  for(const row of observed.workflow){
   const expectedAction=uiEngine.operationalNextAction(expected,row.stage);
   assert.deepEqual(row.action,json(expectedAction),'OPERATOR_RUNTIME_CUSTODY_ORACLE: observe the complete current action with its actual verified files and required evidence.');
   const {checkedAt:actualTime,...actualGate}=row.gate,{checkedAt:expectedTime,...expectedGate}=uiEngine.gate(row.stage,expected);
   assert.deepEqual(actualGate,json(expectedGate),'OPERATOR_RUNTIME_CUSTODY_ORACLE: stage completion and blocking reasons must belong to the same stored version and byte custody.');
   if(productAvailable&&expectedEvidence.has(row.stage))assert.ok(row.action.expectedReturnFiles.some(file=>file.kind==='EVIDENCE'&&file.filenameOrPattern===expectedEvidence.get(row.stage)),'OPERATOR_RUNTIME_EVIDENCE_ORACLE: preserve the declared final-review evidence requirement.');
  }
 };
 const observed=await observeWorkflow([22,23,24]);assertObservation(observed,accepted);
 // One deliberate harness fault: recompute the observed decisions after only
 // project JSON crosses into the host runtime, which has no verified bytes.
 const detached=json(observed);detached.workflow=detached.workflow.map(({stage})=>({stage,gate:engine.gate(stage,detached.project),action:engine.operationalNextAction(detached.project,stage)}));
 assert.throws(()=>assertObservation(detached,accepted),/OPERATOR_RUNTIME_CUSTODY_ORACLE/,'A metadata-only workflow evaluation must fail the same complete-action oracle.');
 assertObservation(await observeWorkflow([22,23,24]),accepted);
 report.workflowObservation={caseId:'OPERATOR_RUNTIME_CUSTODY',synthetic:true,actualBrowser:false,stages:[22,23,24],currentVersion:true,completeActions:true,requiredReviewEvidence:true,metadataOnlyFaultDetected:true,healthySourceRechecked:true};
 assert.deepEqual(Buffer.from(await (await durableStore.getArtifact(artifactId)).blob.arrayBuffer()),Buffer.from(OUTPUT),'PRODUCT_ACCEPTANCE_BYTES_ORACLE');
 const prior=await durableStore.restoreCheckpoint(staged.job.JOB_ID,checkpointBefore,{expectedProjectRevision:accepted.revision});
 assert.equal(uiEngine.recordsForCurrentScope(prior.project,'products').length,0,'PRODUCT_ACCEPTANCE_RESTORE_ORACLE: the earlier version must not inherit the product.');
 const earlierObservation=await observeWorkflow([21,23,24]);assertObservation(earlierObservation,prior.project,{productAvailable:false});assert.equal(earlierObservation.workflow[0].gate.complete,false,'OPERATOR_RUNTIME_VERSION_ORACLE: an earlier version must not inherit later product acceptance.');
 const recovered=await durableStore.restoreCheckpoint(staged.job.JOB_ID,acceptedCheckpoint,{expectedProjectRevision:prior.project.revision});
 assert.deepEqual(recovered.project.projectData.acceptedChanges,accepted.projectData.acceptedChanges,'PRODUCT_ACCEPTANCE_RESTORE_ORACLE: restore the matching acceptance records.');
 assert.equal(uiEngine.gate(21,recovered.project).complete,true,'PRODUCT_ACCEPTANCE_RESTORE_ORACLE');
 for(const phase of ['FINAL_PRODUCT_DETERMINISTIC','FINAL_PRODUCT_MEANING','FINAL_PRODUCT_ADVERSARIAL'])assert.equal(uiEngine.verificationPhaseTargetAvailability(recovered.project,phase),'TRUE','PRODUCT_ACCEPTANCE_RESTORE_ORACLE: '+phase);
 assert.deepEqual(Buffer.from(await (await durableStore.getArtifact(artifactId)).blob.arrayBuffer()),Buffer.from(OUTPUT),'PRODUCT_ACCEPTANCE_RESTORE_BYTES_ORACLE');
 const recoveredObservation=await observeWorkflow([22,23,24]);assertObservation(recoveredObservation,recovered.project);report.workflowObservation.restoration=true;report.workflowObservation.earlierVersionDidNotInheritProduct=true;
 phase('accepted-product-reload-and-restoration-complete');
 report.acceptance={caseId:'PRODUCT_ACCEPTANCE_PERSISTENCE',acceptedBefore:acceptedCount,acceptedAfter:accepted.projectData.acceptedChanges.length,reload:true,restoration:true,exactBytes:true,faultDetected:true};
 report.durableCases.push({name:'Accept the reviewed product response with its exact stored bytes through the production UI and persistence owners',result:'PASS'});
}
console.log(JSON.stringify(report,null,2));

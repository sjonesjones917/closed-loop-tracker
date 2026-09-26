import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readStoreArchive} from './test-zip.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
globalThis.dispatchEvent=()=>true;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file==='workflow-engine.js'&&process.env.ENGINE_SOURCE?process.env.ENGINE_SOURCE:file,'utf8'),{filename:file});
const {buildUnchangedConfirmationFixture}=await import('./stage19-fixture.mjs');
const engine=globalThis.closedLoopWorkflowEngine,schema=globalThis.closedLoopWorkflowSchema,store=globalThis.closedLoopProjectStore;
const durable=projectStoreRuntime(),durableStore=durable.store,promptSnapshots=[];
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
 const committed=runtime.currentPromptRecord(21);assert.ok(committed?.transportBindingRequired,'HANDOFF_COMMITTED_CURRENT_ORACLE');
 runtime.current=await durableStore.readProject(saved.job.JOB_ID);
 assert.equal(runtime.currentPromptRecord(21)?.instructionId,committed.instructionId,'HANDOFF_RELOAD_CURRENT_ORACLE');
 const bundle=await durableStore.createExecutionPackage({jobId:saved.job.JOB_ID,stage:21,operation:committed.operation,instructionId:committed.instructionId});
 assert.equal(bundle.manifest.promptIdentity.bodySha256,committed.bodySha256,'HANDOFF_EXPORT_IDENTITY_ORACLE');
 assert.equal(bundle.manifest.scope.productId,committed.scope.productId,'HANDOFF_EXPORT_TARGET_ORACLE');
 const members=new Map(readStoreArchive(new Uint8Array(await bundle.blob.arrayBuffer())).map(entry=>[entry.canonicalPath,entry.bytes]));
 assert.deepEqual(members.get('instruction.txt'),new TextEncoder().encode(committed.prompt),'HANDOFF_EXPORT_BYTES_ORACLE');
 const exportedManifest=JSON.parse(new TextDecoder().decode(members.get('manifest.json')));
 assert.equal(exportedManifest.promptIdentity.bodySha256,committed.bodySha256,'HANDOFF_EXPORTED_MANIFEST_ORACLE');
 assert.equal(exportedManifest.scope.productId,committed.scope.productId,'HANDOFF_EXPORTED_TARGET_ORACLE');
 // Execute the real stage export owner, including its durable receipt. A
 // duplicate activation must still deliver one archive containing exact bytes.
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
}
console.log(JSON.stringify(report,null,2));

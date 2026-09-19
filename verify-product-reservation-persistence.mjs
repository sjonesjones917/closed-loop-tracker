import fs from 'node:fs';
import assert from 'node:assert/strict';
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
console.log(JSON.stringify(report,null,2));

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const faultName=process.argv.find(arg=>arg.startsWith('--fault='))?.split('=')[1],faults={namespace:{id:'BYPASS-PROJECT-NAMESPACE',file:'workflow-engine.js',before:"jobNamespace=String(project.job.JOB_ID||'')",after:"jobNamespace='SHARED-NAMESPACE'"},receipt:{id:'BYPASS-RECEIPT-INTEGRITY',file:'workflow-engine.js',before:'function validateAllocationReceipts(project,prior=null){',after:'function validateAllocationReceipts(project,prior=null){return true;'}};
const r=projectStoreRuntime({fault:faults[faultName]}),{engine,core,store,copy}=r,schema=r.runtime.closedLoopWorkflowSchema,h=r.runtime.closedLoopHash;
const cases=[],note=name=>cases.push({name,result:'PASS'}),blank=id=>{const p=core.createBlankState(id);engine.ensureShape(p);return p;};
const a=blank('ALLOCATION-A'),b=blank('ALLOCATION-B');
for(const [family,definition] of Object.entries(schema.RECORD_SCHEMAS)){
 const left=engine.allocateId(a,family),right=engine.allocateId(b,family);
 assert.notEqual(left,right,'PROJECT_NAMESPACE_ORACLE: '+family);
 assert.match(left,new RegExp('^'+definition.prefix+'-[0-9a-v]{32}$'),'ALGORITHM_ORACLE: '+family);
 const receipt=a.projectData.allocationReceipts.at(-1);
 assert.equal(receipt.resultingId,left);assert.equal(receipt.inputTuple.jobNamespace,a.job.JOB_ID);
 assert.equal(receipt.inputTuple.familyNamespace,definition.familyNamespace);assert.equal(receipt.algorithmVersion,'closed-loop-id/1');
 const payload=crypto.createHash('sha256').update(h.stableStringify(receipt.inputTuple)).digest().subarray(0,20);
 let bits=0,value=0,encoded='';for(const byte of payload){value=(value<<8)|byte;bits+=8;while(bits>=5){bits-=5;encoded+='0123456789abcdefghijklmnopqrstuv'[(value>>>bits)&31];}}
 assert.equal(left,definition.prefix+'-'+encoded,'DIGEST_ENCODING_ORACLE: '+family);
}
note('All registered canonical families use the specified 160-bit SHA-256/base32hex algorithm and distinct project namespaces');
const p=blank('ALLOCATION-RETRY'),options=copy({commandId:'AUTHORIZE-TEST-RECORD',idempotencyKey:'operator-action-1',targetSlot:'slot',parentId:'parent',payload:{value:'same'}});
const first=engine.allocateId(p,'requirements',options),counter=copy(p.projectData.idCounters),receipts=copy(p.projectData.allocationReceipts);p.revision+=1;
assert.equal(engine.allocateId(p,'requirements',options),first);assert.deepEqual(p.projectData.idCounters,counter);assert.deepEqual(p.projectData.allocationReceipts,receipts);
assert.throws(()=>engine.allocateId(p,'requirements',copy({...options,payload:{value:'different'}})),error=>error.code==='ALLOCATION_RETRY_CONFLICT');
assert.notEqual(engine.allocateId(p,'requirements',{...options,idempotencyKey:'operator-action-2'}),first);note('Exact command retries retain their original allocation; conflicting retries reject and independent equal-content actions remain distinct');
const probe=blank('ALLOCATION-COLLISION'),candidate=engine.allocateId(probe,'requirements',options),collision=blank('ALLOCATION-COLLISION');collision.projectData.requirements.push({id:candidate,REQ_ID:candidate});const alternate=engine.allocateId(collision,'requirements',options);assert.notEqual(alternate,candidate);assert.equal(collision.projectData.allocationReceipts.at(-1).collisionCounter,1);note('A collision with an existing different allocation increments only the collision counter');
for(const prefix of ['RAW-RESPONSE','COMMAND-RECEIPT','STAGE-01-OUTPUT']){const collection=prefix==='RAW-RESPONSE'?'rawResponses':prefix==='COMMAND-RECEIPT'?'commandReceipts':'generatedOutputs';assert.notEqual(engine.allocateInfrastructureId(a,prefix,collection),engine.allocateInfrastructureId(b,prefix,collection));}
note('Infrastructure identities share the canonical allocator and preserve project separation');
let saved=blank('ALLOCATION-PERSIST');engine.recalculate(saved);saved=await store.writeProject(saved,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});const next=copy(saved);engine.allocateId(next,'requirements',options);saved=await store.writeProject(next,{expectedProjectRevision:saved.revision});const checkpoint=(await store.historyList(saved.job.JOB_ID)).activeId,before=copy(saved.projectData.allocationReceipts),changed=copy(saved);engine.allocateId(changed,'requirements',{...options,idempotencyKey:'operator-action-2'});saved=await store.writeProject(changed,{expectedProjectRevision:saved.revision});saved=(await store.restoreCheckpoint(saved.job.JOB_ID,checkpoint,{expectedProjectRevision:saved.revision})).project;assert.deepEqual(saved.projectData.allocationReceipts,before);
assert.equal(engine.stageContext(saved,1).projectData.allocationReceipts,undefined);note('Committed receipts restore with their complete version and never enter agent-facing stage context');
const forged=copy(saved);forged.projectData.allocationReceipts[0].commandId='FORGED';await assert.rejects(()=>store.writeProject(forged,{expectedProjectRevision:saved.revision}),error=>error.code==='ALLOCATION_RECEIPT_MUTATED','RECEIPT_INTEGRITY_ORACLE');assert.equal((await store.readProject(saved.job.JOB_ID)).projectSha256,saved.projectSha256);note('The commit transaction rejects mutation of an existing allocation receipt without changing active or retained state');
const branch=copy(saved),branchId=engine.allocateId(branch,'sources');saved=await store.writeProject(branch,{expectedProjectRevision:saved.revision});saved=(await store.restoreCheckpoint(saved.job.JOB_ID,checkpoint,{expectedProjectRevision:saved.revision})).project;assert.notEqual(engine.allocateId(saved,'sources'),branchId,'BRANCH_IDENTITY_ORACLE');note('A different continuation after restoration cannot reuse the abandoned continuation’s newly allocated identity');
console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Node production runtime and transaction adapter',registeredFamilies:Object.keys(schema.RECORD_SCHEMAS).length,cases},null,2));

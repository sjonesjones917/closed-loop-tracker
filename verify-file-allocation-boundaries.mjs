import fs from 'node:fs';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const overrides=process.env.ENGINE_SOURCE?{'workflow-engine.js':fs.readFileSync(process.env.ENGINE_SOURCE,'utf8')}:{},r=projectStoreRuntime({sourceOverrides:overrides}),{engine,store,copy}=r;
const project=await store.createProject({commandId:'ALLOCATION_BOUNDARIES'}),cases=[],note=name=>cases.push({name,result:'PASS'});
const metadata={stage:1,filename:'input.txt',mediaType:'text/plain',byteSize:3,sha256:r.runtime.closedLoopHash.sha256Text('abc')};
const unallocated=copy(project),unallocatedBefore=JSON.stringify(unallocated);
assert.throws(()=>engine.registerArtifactBytes(unallocated,copy({...metadata,artifactId:'ARTIFACT-UNALLOCATED'})),error=>error.code==='ARTIFACT_ALLOCATION_REQUIRED','ARTIFACT_PROMOTION_AUTHORITY_ORACLE: unallocated identities must be rejected');
assert.equal(JSON.stringify(unallocated),unallocatedBefore);
note('A complete byte description without an allocation cannot become a canonical artifact');
const working=copy(project),id=engine.allocateId(working,'artifacts',copy({commandId:'FILE-ONE',idempotencyKey:'file',payload:metadata}));
const record=engine.registerArtifactBytes(working,copy({...metadata,artifactId:id}));assert.equal(engine.recordId(record,'artifacts'),id);
const committed=JSON.stringify(working);assert.equal(engine.registerArtifactBytes(working,copy({...metadata,artifactId:id})),record);assert.equal(JSON.stringify(working),committed);
assert.throws(()=>engine.registerArtifactBytes(working,copy({...metadata,artifactId:id,sha256:'f'.repeat(64)})),error=>error.code==='ARTIFACT_IDENTITY_CONFLICT','ARTIFACT_RETRY_CONTENT_ORACLE: same identity with different bytes must be rejected');assert.equal(JSON.stringify(working),committed);
assert.throws(()=>engine.allocateId(working,'artifacts',copy({commandId:'FILE-ONE',idempotencyKey:'file',payload:{...metadata,byteSize:4}})),error=>error.code==='ALLOCATION_RETRY_CONFLICT');
note('An allocated identity promotes once, exact registration is idempotent, and changed-byte or changed-allocation retries are rejected');
for(const kind of ['forged','wrong-family','other-project']){
 const isolated=copy(project);let invalidId;
 if(kind==='wrong-family')invalidId=engine.allocateId(isolated,'sources',copy({commandId:'WRONG-FAMILY'}));
 else if(kind==='other-project'){
  const other=await store.createProject({commandId:'OTHER-OWNER'});invalidId=engine.allocateId(other,'artifacts',copy({commandId:'OTHER-FILE'}));isolated.projectData.allocationReceipts.push(copy(other.projectData.allocationReceipts.find(row=>row.resultingId===invalidId)));
 }else {invalidId=engine.allocateId(isolated,'artifacts',copy({commandId:'FORGED'}));isolated.projectData.allocationReceipts.find(row=>row.resultingId===invalidId).inputTuple.commandId='UNRELATED';}
 const before=JSON.stringify(isolated);
 assert.throws(()=>engine.registerArtifactBytes(isolated,copy({...metadata,artifactId:invalidId})),error=>['ARTIFACT_ALLOCATION_REQUIRED','ALLOCATION_RECEIPT_INVALID'].includes(error.code),'ARTIFACT_PROMOTION_AUTHORITY_ORACLE: '+kind+' receipt must be rejected');assert.equal(JSON.stringify(isolated),before);
 note('A '+kind+' allocation receipt is rejected without promoting a record');
}
const independent=engine.allocateId(working,'artifacts',copy({commandId:'FILE-TWO',idempotencyKey:'file',payload:metadata}));assert.notEqual(independent,id);engine.registerArtifactBytes(working,copy({...metadata,artifactId:independent}));
note('Independent authorized selections of equal bytes remain distinct artifact occurrences');
console.log(JSON.stringify({synthetic:true,actualBrowser:false,cases},null,2));

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {storeRuntime} from './test-store-runtime.mjs';

// The persistence I/O is a transaction double. Production staging, hashing,
// read-back validation and failure handling run unchanged; this is not a device test.
const payload=new TextEncoder().encode('{"response":"original"}');
const changed=new TextEncoder().encode('{"response":"modified"}');
assert.equal(payload.length,changed.length);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const cases=[];
async function byteOracle(harness,{recordCases=false}={}){
  const {store,schema}=harness;
  for(let stage=1;stage<=schema.STAGE_COUNT;stage++){
    const jobId=`STAGING-OWNER-${stage}`,promptIdentity={instructionId:`PROMPT-${stage}`,bodySha256:sha(payload)};
    const staged=await store.stageResponseFile({jobId,stage,blob:new Blob([payload]),promptIdentity,packageId:`PACKAGE-${stage}`,operationReservationId:`ATTEMPT-${stage}`,challengeNonce:`CHALLENGE-${stage}`});
    const read=()=>store.readStagedResponseFile({jobId,stagingId:staged.stagingId});
    const original=await store.metaGet(staged.storageKey),result=await read();
    assert.deepEqual(Array.from(result.bytes),Array.from(payload),'STAGED_BYTE_ORACLE: valid bytes changed.');
    assert.equal(result.sha256,sha(payload));assert.equal(result.stage,stage);assert.equal(result.jobId,jobId);
    assert.equal(result.promptIdentity.instructionId,promptIdentity.instructionId);
    for(const field of ['packageId','operationReservationId','challengeNonce'])assert.equal(result[field],staged[field]);
    await store.metaPut(staged.storageKey,{...original,blob:new Blob([changed])});
    await assert.rejects(read,error=>error.code==='RESPONSE_STAGE_REHASH_MISMATCH',`STAGED_BYTE_ORACLE: stage ${stage} accepted different bytes of the same length.`);
    await store.metaPut(staged.storageKey,original);
    assert.deepEqual(Array.from((await read()).bytes),Array.from(payload),'STAGED_BYTE_ORACLE: corrected bytes did not progress.');
    await store.metaPut(staged.storageKey,{...original,blob:null});
    await assert.rejects(read,error=>error.code==='RESPONSE_STAGE_NOT_FOUND');
    await store.metaPut(staged.storageKey,original);
    await assert.rejects(()=>store.readStagedResponseFile({jobId:`OTHER-${stage}`,stagingId:staged.stagingId}),error=>error.code==='RESPONSE_STAGE_NOT_FOUND');
    await store.metaPut(staged.storageKey,{...original,jobId:`OTHER-${stage}`});
    await assert.rejects(read,error=>error.code==='CROSS_PROJECT_RESPONSE_STAGE');
    await store.metaPut(staged.storageKey,original);
    assert.deepEqual(Array.from((await read()).bytes),Array.from(payload));
    if(recordCases)cases.push({id:`response-staging-stage-${stage}`,stage,validBytes:'PASS',sameLengthCorruption:'RESPONSE_STAGE_REHASH_MISMATCH',missingBytes:'RESPONSE_STAGE_NOT_FOUND',wrongProjectKey:'RESPONSE_STAGE_NOT_FOUND',wrongStoredOwner:'CROSS_PROJECT_RESPONSE_STAGE',corrected:'PASS'});
  }
}
await byteOracle(storeRuntime(),{recordCases:true});
const bypass={file:'project-store.js',before:'if(bytes.byteLength!==Number(stored.byteSize)||sha256!==String(stored.sha256))',after:'if(false)'};
await assert.rejects(()=>byteOracle(storeRuntime({sourceFault:bypass})),/STAGED_BYTE_ORACLE/,'The test did not detect a bypassed production read-back comparison.');
await byteOracle(storeRuntime());
const failed=storeRuntime();failed.runtime.__closedLoopStorageFault='during-response-staging-write';
await assert.rejects(()=>failed.store.stageResponseFile({jobId:'WRITE-FAILURE',stage:1,blob:new Blob([payload])}),error=>error.code==='INJECTED_STORAGE_FAILURE');
assert.equal((failed.rows.get('meta')||new Map()).size,0,'A failed staging write left an apparent successful record.');
delete failed.runtime.__closedLoopStorageFault;
const repaired=await failed.store.stageResponseFile({jobId:'WRITE-FAILURE',stage:1,blob:new Blob([payload])});
assert.deepEqual(Array.from((await failed.store.readStagedResponseFile({jobId:'WRITE-FAILURE',stagingId:repaired.stagingId})).bytes),Array.from(payload));
console.log(JSON.stringify({responseByteStaging:'PASS',evidenceClass:'PRODUCTION_STAGING_WITH_TRANSACTION_IO_DOUBLE',cases,readBackComparisonFault:'DETECTED',restoredImplementation:'PASS',stagingWriteFailureAndRetry:'PASS',physicalDeviceAcceptance:false,completeOperatorJourney:false},null,2));

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {createStageOneIngestionFixture as seed,submitStageOneResponse as submit,stageOneResponseEnvelope as stageOneEnvelope} from './test-ingestion-context-reference.mjs';
const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const sources=Object.fromEntries(files.map(name=>[name,fs.readFileSync(name,'utf8')]));
const sha=value=>createHash('sha256').update(value).digest('hex');
const sourceHashes=Object.fromEntries(Object.entries(sources).map(([name,text])=>[name,sha(text)]));
const operationalJobFields=['CURRENT_STATE','NEXT_REQUIRED_ACTION'];
const operationalCollections=['rawResponses','generatedOutputs','responseValidations','responseProposals','outputReceipts','responseDispositions','rejectedResponses','idCounters','eventSequence','history','allocationReceipts'];
const operationalStageFields=['gate','status','derivedData','responseDraft'];
const retainedAuditFamilies=operationalCollections.filter(key=>!['idCounters','eventSequence'].includes(key));
function protectedState(r,p,reservationId){
 const copy=structuredClone(p);delete copy.projectSha256;
 for(const key of operationalCollections)delete copy.projectData[key];
 for(const key of operationalJobFields)delete copy.job[key];
 for(const stage of Object.values(copy.stages))for(const key of operationalStageFields)delete stage[key];
 for(const row of copy.projectData.operationReservations??[])if(row.id===reservationId){delete row.STATUS;if(row.fields)delete row.fields.STATUS;delete row.recordSha256;delete row.sha256;delete row.updatedAt;}
 return copy;
}
function assertRetainedAudit(before,after,label){
 for(const key of retainedAuditFamilies){
  const prior=before.projectData[key]??[],next=after.projectData[key]??[];
  assert(Array.isArray(prior)&&Array.isArray(next),'SYNTAX_STAGE1_AUDIT_ARRAY: '+label+' '+key);
  assert(next.length>=prior.length,'SYNTAX_STAGE1_RETAINED_AUDIT_LENGTH: '+label+' '+key);
  assert.deepEqual(structuredClone(next.slice(0,prior.length)),structuredClone(prior),'SYNTAX_STAGE1_RETAINED_AUDIT_PREFIX: '+label+' '+key);
 }
}

const cases=[
 ['malformed JSON','MALFORMED_JSON',()=>'{"schema":}'],
 ['truncated JSON','TRUNCATED_RESPONSE',()=>'{"schema":"closed-loop-stage-response/3"'],
 ['markdown wrapped','NON_JSON_WRAPPER',e=>'```json\n'+JSON.stringify(e)+'\n```'],
 ['duplicate JSON member','DUPLICATE_JSON_MEMBER',e=>JSON.stringify(e).replace('"stage":1','"stage":1,"stage":2')],
 ['nested duplicate JSON member','DUPLICATE_JSON_MEMBER',e=>JSON.stringify(e).replace('"instructionId":','"instructionId":"SHADOW","instructionId":')],
 ['array nested duplicate JSON member','DUPLICATE_JSON_MEMBER',e=>JSON.stringify(e).replace('"kind":','"kind":"SHADOW","kind":')],
 ['escaped equivalent duplicate JSON member','DUPLICATE_JSON_MEMBER',e=>JSON.stringify(e).replace('"stage":1',String.raw`"stage":1,"\u0073tage":2`)],
 ['nested escaped equivalent duplicate JSON member','DUPLICATE_JSON_MEMBER',e=>JSON.stringify(e).replace('"instructionId":',String.raw`"\u0069nstructionId":"SHADOW","instructionId":`)],
 ['wrong root type','INVALID_ROOT',()=> '[]'],['null root type','INVALID_ROOT',()=> 'null'],['string root type','INVALID_ROOT',()=> '"response"'],['number root type','INVALID_ROOT',()=> '1'],['true root type','INVALID_ROOT',()=> 'true'],['false root type','INVALID_ROOT',()=> 'false'],
 ['wrong stage','WRONG_STAGE',e=>{e.stage=2;return JSON.stringify(e);}],
 ['wrong operation','WRONG_OPERATION',e=>{e.operation='NOT_THE_OPERATION';return JSON.stringify(e);}],
 ['stale prompt id','STALE_PROMPT_IDENTITY',e=>{e.promptIdentity.instructionId='INSTRUCTION-STALE';return JSON.stringify(e);}],
 ['stale prompt hash','STALE_PROMPT_HASH',e=>{e.promptIdentity.bodySha256='0'.repeat(64);return JSON.stringify(e);}],
 ['stale contract hash','STALE_CONTRACT_HASH',e=>{e.promptIdentity.contractSha256='0'.repeat(64);return JSON.stringify(e);}],
 ['stale context signature','STALE_CONTEXT_SIGNATURE',e=>{e.promptIdentity.contextSignature='0'.repeat(64);return JSON.stringify(e);}],
 ['curly-delimiters','UNSAFE_SMART_QUOTES',e=>JSON.stringify(e).replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g,'“$1”')]
];
export async function verifySyntaxTransportStage1(){
const observations=[],startedAtUtc=new Date().toISOString();
for(const [name,expectedCode,rawFor] of cases){
 const r=projectStoreRuntime({sourceOverrides:sources}),f=await seed(r),e=stageOneEnvelope(r,f.p,f.prompt),raw=rawFor(e),before=protectedState(r,f.p,f.manifest.operationReservationId),inputBefore=JSON.stringify(f.p);
 const submitted=await submit(r,f,e,{rawText:raw}),result=submitted.result;
 assert.equal(result.validation.valid,false,'SYNTAX_STAGE1_REJECT: '+name);assert.equal(result.proposal,null,'SYNTAX_STAGE1_NO_PROPOSAL: '+name);
 const codes=Array.from(result.validation.issues,row=>row.code);assert(codes.includes(expectedCode),'SYNTAX_STAGE1_EXPECTED_CODE: '+name+' '+codes.join(','));
 if(['MALFORMED_JSON','TRUNCATED_RESPONSE','NON_JSON_WRAPPER','DUPLICATE_JSON_MEMBER','INVALID_ROOT','UNSAFE_SMART_QUOTES'].includes(expectedCode))assert.deepEqual(codes,[expectedCode],'SYNTAX_STAGE1_EXACT_PARSE_CODE: '+name);
 assert.deepEqual(protectedState(r,result.project,f.manifest.operationReservationId),before,'SYNTAX_STAGE1_REJECTION_PRESERVATION: '+name);
 assert.equal(JSON.stringify(f.p),inputBefore,'SYNTAX_STAGE1_INPUT_UNCHANGED: '+name);
 assertRetainedAudit(f.p,result.project,name+' prepared');const read=await r.store.readProject(f.p.job.JOB_ID);assertRetainedAudit(f.p,read,name+' reloaded');assert.equal(r.store.validateProjectIntegrity(read).valid,true,'SYNTAX_STAGE1_RELOAD_INTEGRITY: '+name);assert.deepEqual(protectedState(r,read,f.manifest.operationReservationId),before,'SYNTAX_STAGE1_RELOAD_PRESERVATION: '+name);
 assert.equal(r.ingestion.findRaw(read,submitted.rawResponseId).completeRawResponse,raw,'SYNTAX_STAGE1_EXACT_RAW_RELOAD: '+name);assert.equal(read.projectData.responseValidations.at(-1).valid,false);
 const target=r.engine.records(read,'operationReservations').find(row=>row.id===f.manifest.operationReservationId);assert.equal(r.engine.recordValue(target,'STATUS'),'REJECTED','SYNTAX_STAGE1_REJECTED_RESERVATION: '+name);
 const row={name,expectedCode,observedCodes:codes,stage:1,responseBoundary:'PREPARE_CAPTURED',validationValid:false,proposalCreated:false,protectedJobAndCanonicalStateUnchanged:true,retainedAuditPrefixesPreserved:true,inputProjectPreserved:true,rawExactAfterReload:true,rejectionSavedAndReloaded:true,reservationBindingPreserved:true,reservationStatus:'REJECTED',acceptedChangesBefore:before.projectData.acceptedChanges.length,acceptedChangesAfter:read.projectData.acceptedChanges.length};observations.push(row);console.log(JSON.stringify({caseComplete:name,result:'PASS'}));
}
// The file-first size guard rejects before reading the oversized response into
// parser memory. Its bounded staging retains the original bytes and receipt.
{
 const r=projectStoreRuntime({sourceOverrides:sources}),f=await seed(r),e=stageOneEnvelope(r,f.p,f.prompt),base=JSON.stringify(e),limit=1048576;
 assert.equal(f.manifest.attachmentSlots.find(row=>row.role==='STRUCTURED_RESPONSE').maximumSize,limit,'SYNTAX_PUBLISHED_RESPONSE_BUDGET');
 const raw=base+' '.repeat(limit+1-Buffer.byteLength(base)),before=protectedState(r,f.p,f.manifest.operationReservationId),inputBefore=JSON.stringify(f.p),m=f.manifest;
 const staged=await r.store.stageResponseFile({jobId:f.p.job.JOB_ID,stage:1,blob:new Blob([raw],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:m.promptIdentity,packageId:m.packageId,operationReservationId:m.operationReservationId,challengeNonce:m.challengeNonce});
 await assert.rejects(()=>r.store.readStagedResponseFile({jobId:f.p.job.JOB_ID,stagingId:staged.stagingId}),error=>error.code==='OVERSIZED_RESPONSE','SYNTAX_STAGE1_OVERSIZE_GUARD');
 const retained=await r.store.metaGet(`responseStaging:${f.p.job.JOB_ID}:${staged.stagingId}`);assert.equal(retained.rejection.code,'OVERSIZED_RESPONSE');assert.equal(retained.byteSize,limit+1);assert.equal(await retained.blob.text(),raw);assert.equal(sha(new Uint8Array(await retained.blob.arrayBuffer())),sha(raw));
 const read=await r.store.readProject(f.p.job.JOB_ID);assertRetainedAudit(f.p,read,'oversized response');assert.deepEqual(protectedState(r,read,f.manifest.operationReservationId),before);assert.equal(read.projectData.responseProposals.length,0);assert.equal(read.projectData.rawResponses.length,0);assert.equal(read.projectData.responseValidations.length,0);assert.equal(JSON.stringify(f.p),inputBefore,'SYNTAX_STAGE1_OVERSIZE_INPUT_UNCHANGED');
 observations.push({name:'oversized response',stage:1,expectedCode:'OVERSIZED_RESPONSE',observedCodes:['OVERSIZED_RESPONSE'],responseBoundary:'STAGED_READ_GUARD',proposalCreated:false,protectedJobAndCanonicalStateUnchanged:true,retainedAuditPrefixesPreserved:true,inputProjectPreserved:true,rawBlobRetained:true,rawExactAfterReload:true,rejectionReceiptRetained:true,stagedByteSize:limit+1,acceptedChangesBefore:before.projectData.acceptedChanges.length,acceptedChangesAfter:read.projectData.acceptedChanges.length});console.log(JSON.stringify({caseComplete:'oversized response',result:'PASS'}));
}
const controls=[];
for(const name of ['ascii-escaped-data','unicode-quotation-data','exact-size-boundary']){
 const r=projectStoreRuntime({sourceOverrides:sources}),f=await seed(r),e=stageOneEnvelope(r,f.p,f.prompt);e.evidence[0].content=name==='unicode-quotation-data'?'He said “keep the exact words”.':'He said "keep the exact words".';
 let raw=JSON.stringify(e);if(name==='exact-size-boundary')raw+=' '.repeat(1048576-Buffer.byteLength(raw));
 const before=protectedState(r,f.p,f.manifest.operationReservationId),submitted=await submit(r,f,e,{rawText:raw});assert.equal(submitted.result.validation.valid,true,'SYNTAX_STAGE1_CONFORMING: '+name+' '+JSON.stringify(submitted.result.validation.issues));assert(submitted.result.proposal);
 assert.deepEqual(protectedState(r,submitted.p,f.manifest.operationReservationId),before,'SYNTAX_STAGE1_VALID_NOT_ACCEPTED: '+name);assertRetainedAudit(f.p,submitted.p,name+' prepared');const read=await r.store.readProject(f.p.job.JOB_ID);assertRetainedAudit(f.p,read,name+' reloaded');assert.equal(r.store.validateProjectIntegrity(read).valid,true);assert.equal(r.ingestion.findRaw(read,submitted.rawResponseId).completeRawResponse,raw);assert.deepEqual(protectedState(r,read,f.manifest.operationReservationId),before);
 const row={name,stage:1,validationValid:true,proposalCreated:true,proposalNotCanonicalCommit:true,protectedJobAndCanonicalStateUnchanged:true,retainedAuditPrefixesPreserved:true,rawExactAfterReload:true,pendingProposalSavedAndReloaded:true,rawByteSize:Buffer.byteLength(raw),acceptedChangesBefore:before.projectData.acceptedChanges.length,acceptedChangesAfter:read.projectData.acceptedChanges.length};controls.push(row);console.log(JSON.stringify({caseComplete:name,result:'PASS'}));
}
assert.deepEqual(files.filter(name=>sha(fs.readFileSync(name,'utf8'))!==sourceHashes[name]),[],'SYNTAX_SOURCE_CHANGED_DURING_EXECUTION');
const report={stage1SyntaxTransportBoundary:'PASS',startedAtUtc,observedAtUtc:new Date().toISOString(),nodeVersion:process.version,sourceHashes,synthetic:true,actualBrowser:false,realExternalAgent:false,syntheticPrerequisiteFlags:false,stagesExercised:[1],observations,controls,projection:{protectedJob:'Every Job field except CURRENT_STATE and NEXT_REQUIRED_ACTION; all23 application identities/pointers/versions and four canonical summaries protected.',canonicalFamilies:'Whole project snapshot with exact operational exclusions; every registered family and nonregistry canonical value, selected reservation binding/content hash, unrelated reservations, all root metadata and all stage fields except the four explicit operational diagnostics are protected.',operationalCollections,operationalStageFields,reservationExclusions:['STATUS','fields.STATUS','updatedAt','recordSha256','sha256'],retainedAuditFamilies,projectChecksumExclusion:'projectSha256 is recomputed for operational audit records; canonical revision is still protected.',operationalTransitionBasis:'Specification35.6 allows rejection operational metadata without incrementing canonical revision;17.6 requires rejection/raw records. The selected reserved operation must end REJECTED.'},limits:['Real Stage1 application seed/reservation/package and actual Blob staging/read/hash/prepare/reload under isolated transaction adapter; no browser, human-authenticated authority, external-agent execution or full application journey claim.','Oversized file rejection occurs at staged read guard before parser or raw-response metadata creation; exact original staged Blob and rejection receipt are separately asserted.','Complete owning suite and normal CI receipt remain required after integration.']};
return report;
}

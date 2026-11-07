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
function assertProjectionReceiptBinding(r,p){
 const contract=r.runtime.closedLoopWorkflowSchema.PROJECT_PROJECTION_DERIVATION_CONTRACT,projection=p.projectData.applicationProjection,receipt=projection.receipt;
 const digest=value=>sha(r.runtime.closedLoopHash.stableStringify(r.copy(value))),plain=value=>JSON.parse(JSON.stringify(value));
 const canonicalRecords={};
 for(const family of Object.keys(contract.canonicalOutputFamilies)){
  assert.equal(p.projectData[family].length,0,'SYNTAX_STAGE1_PROJECTION_RECEIPT_ORACLE: empty Stage1 proof family '+family);canonicalRecords[family]=[];
 }
 const output={job:Object.fromEntries(contract.jobOutputFields.map(key=>[key,p.job[key]])),stages:Object.fromEntries(Object.entries(p.stages).map(([number,state])=>[number,Object.fromEntries(contract.stageOutputFields.map(key=>[key,state[key]]))])),canonicalRecords};
 const sources=[];
 for(const [family,definition]of Object.entries(r.runtime.closedLoopWorkflowSchema.RECORD_SCHEMAS))for(const row of p.projectData[family]){
  const record={...row};delete record.recordSha256;delete record.sha256;
  sources.push({family,id:row.fields?.[definition.idField]||row[definition.idField]||row.id,sha256:digest(record)});
 }
 sources.sort((a,b)=>a.family<b.family?-1:a.family>b.family?1:a.id<b.id?-1:a.id>b.id?1:0);
 const input=r.engine.applicationProjectionInput(p,projection.observedAt,{observations:projection.inputObservations});
 assert.deepEqual(plain(input.sourceBinding.records),sources,'SYNTAX_STAGE1_PROJECTION_RECEIPT_ORACLE: actual canonical source hashes');
 assert.deepEqual(plain(receipt.sourceRecordHashes),sources,'SYNTAX_STAGE1_PROJECTION_RECEIPT_ORACLE: receipt source hashes');
 assert.equal(receipt.derivationId,contract.id,'SYNTAX_STAGE1_PROJECTION_RECEIPT_ORACLE: identity');
 assert.equal(receipt.registryEntrySha256,digest(contract),'SYNTAX_STAGE1_PROJECTION_RECEIPT_ORACLE: registry');
 assert.equal(receipt.canonicalInputSha256,digest(input),'SYNTAX_STAGE1_PROJECTION_RECEIPT_ORACLE: canonical input');
 assert.equal(receipt.outputSha256,digest(output),'SYNTAX_STAGE1_PROJECTION_RECEIPT_ORACLE: actual output');
}
function gateOutcome(p){return Object.fromEntries(Object.entries(p.stages).map(([number,state])=>[number,{status:state.status,decision:state.decision,decisionEvidence:state.decisionEvidence,gate:Object.fromEntries(Object.entries(state.gate||{}).filter(([key])=>key!=='checkedAt'))}]));}
function protectedState(r,p,reservationId){
 assertProjectionReceiptBinding(r,p);
 const copy=structuredClone(p);delete copy.projectSha256;
 // Rejection refreshes this declared operational projection and its receipt.
 // Validate its current derivation before comparing the protected canonical data.
 delete copy.projectData.applicationProjection;
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
// These parser controls keep the streaming ambiguity scan equivalent to JSON
// string decoding without materializing discarded value strings. Expected
// results and diagnostic classes are independent of the production scanner.
export function verifyJsonScannerSemantics({sourceOverrides={},fault=null}={}){
 const overrides={...sources,...sourceOverrides};
 if(fault){let source=overrides['response-ingestion.js'];const substitutions={
  'omit-duplicate-check':['if(keys.has(key))','if(false)',1],
  'omit-depth-check':['if(depth>maxDepth)','if(false)',2],
  'skip-key-decoding':['JSON.parse(raw.slice(start,i))','raw.slice(start+1,i-1)',1]
 };assert(Object.hasOwn(substitutions,fault),'JSON_SCANNER_KNOWN_FAULT_ORACLE');const [from,to,count]=substitutions[fault];assert.equal(source.split(from).length-1,count,'JSON_SCANNER_SOURCE_FAULT_ANCHOR: '+fault);overrides['response-ingestion.js']=source.replaceAll(from,to);}
 const r=projectStoreRuntime({sourceOverrides:overrides}),parse=(text,options)=>r.ingestion.strictParse(text,options),plain=value=>JSON.parse(JSON.stringify(value)),observations=[];
 const valid=[
  ['escaped-key-unicode',String.raw`{"\u0061":"value"}`,{a:'value'}],
  ['escaped-key-quote',String.raw`{"a\"b":"value"}`,{'a"b':'value'}],
  ['escaped-key-backslash',String.raw`{"a\\b":"value"}`,{'a\\b':'value'}],
  ['escaped-key-control',String.raw`{"a\tb":"value"}`,{'a\tb':'value'}],
  ['escaped-value-controls',String.raw`{"value":"line\n\r\t\b\f\\\"\/end"}`,{value:'line\n\r\t\b\f\\"/end'}],
  ['escaped-value-surrogate-pair',String.raw`{"value":"\ud83d\ude00"}`,{value:'😀'}],
  ['escaped-key-surrogate-pair',String.raw`{"\ud83d\ude00":"value"}`,{'😀':'value'}],
  ['quotes-inside-value',String.raw`{"value":"{\"same\":1,\"same\":2} “data”"}`,{value:'{"same":1,"same":2} “data”'}],
  ['json-whitespace',' \t\r\n{"value": [true,false,null,-12,0]} \t\r\n',{value:[true,false,null,-12,0]}],
  ['distinct-sibling-keys','{"left":{"same":1},"right":{"same":2}}',{left:{same:1},right:{same:2}}],
  ['escaped-looking-literal-key',String.raw`{"a":1,"\\u0061":2}`,{a:1,'\\u0061':2}],
  ['empty-key-and-empty-value','{"":"","value":""}',{'':'',value:''}]
 ];
 for(const [caseId,raw,expected]of valid){assert.deepEqual(JSON.parse(raw),expected,'JSON_SCANNER_NATIVE_CONTROL: '+caseId);assert.deepEqual(plain(parse(raw)),expected,'JSON_SCANNER_VALUE_ORACLE: '+caseId);observations.push({caseId,expected:'PRESERVED',passed:true});}
 const invalid=[
  ['duplicate-unicode-escape',String.raw`{"a":1,"\u0061":2}`,'DUPLICATE_JSON_MEMBER'],
  ['duplicate-escaped-quote',String.raw`{"a\"b":1,"a\u0022b":2}`,'DUPLICATE_JSON_MEMBER'],
  ['duplicate-escaped-backslash',String.raw`{"a\\b":1,"a\u005cb":2}`,'DUPLICATE_JSON_MEMBER'],
  ['duplicate-control-escape',String.raw`{"a\tb":1,"a\u0009b":2}`,'DUPLICATE_JSON_MEMBER'],
  ['duplicate-surrogate-pair',String.raw`{"😀":1,"\ud83d\ude00":2}`,'DUPLICATE_JSON_MEMBER'],
  ['duplicate-nested-array-member',String.raw`{"rows":[{"a":1,"\u0061":2}]}`,'DUPLICATE_JSON_MEMBER'],
  ['malformed-value-escape',String.raw`{"value":"\q"}`,'MALFORMED_JSON'],
  ['malformed-key-escape',String.raw`{"\q":"value"}`,'MALFORMED_JSON'],
  ['malformed-unicode-escape',String.raw`{"value":"\u12xz"}`,'MALFORMED_JSON'],
  ['json-nonwhitespace','{\u00a0"value":1}','MALFORMED_JSON'],
  ['trailing-object','{"value":1}{"value":2}','MALFORMED_JSON'],
  ['lone-high-surrogate-value',String.raw`{"value":"\ud800"}`,'NONCANONICAL_JSON_VALUE'],
  ['lone-low-surrogate-key',String.raw`{"\udc00":"value"}`,'NONCANONICAL_JSON_VALUE']
 ];
 for(const [caseId,raw,code]of invalid){if(code==='MALFORMED_JSON')assert.throws(()=>JSON.parse(raw),SyntaxError,'JSON_SCANNER_NATIVE_REJECTION_CONTROL: '+caseId);else assert.doesNotThrow(()=>JSON.parse(raw),'JSON_SCANNER_NATIVE_SYNTAX_CONTROL: '+caseId);assert.throws(()=>parse(raw),error=>error.code===code,'JSON_SCANNER_REJECTION_ORACLE: '+caseId+' '+code);observations.push({caseId,expected:code,passed:true});}
 const limits={maxRawResponseBytes:1048576,maxJsonDepth:3},at='{"rows":[{"value":"depth3"}]}',over='{"rows":[{"value":["depth4"]}]}';
 assert.deepEqual(plain(parse(at,{limits})),{rows:[{value:'depth3'}]},'JSON_SCANNER_DEPTH_AT_ORACLE');assert.doesNotThrow(()=>JSON.parse(over));assert.throws(()=>parse(over,{limits}),error=>error.code==='EXCESSIVE_JSON_DEPTH','JSON_SCANNER_DEPTH_OVER_ORACLE');observations.push({caseId:'depth-at-three',expected:'PRESERVED',passed:true},{caseId:'depth-over-three',expected:'EXCESSIVE_JSON_DEPTH',passed:true});
 return {passed:true,synthetic:true,actualBrowser:false,boundary:'PRODUCTION_STRICT_PARSE_WITH_INDEPENDENT_JSON_SYNTAX_CONTROLS',observations};
}
export function verifyJsonScannerSemanticControls({sourceOverrides={}}={}){
 const report=verifyJsonScannerSemantics({sourceOverrides}),faults=[];
 for(const [name,oracle]of [
  ['omit-duplicate-check','JSON_SCANNER_REJECTION_ORACLE: duplicate-unicode-escape'],
  ['omit-depth-check','JSON_SCANNER_DEPTH_OVER_ORACLE'],
  ['skip-key-decoding','JSON_SCANNER_REJECTION_ORACLE: duplicate-unicode-escape']
 ]){assert.throws(()=>verifyJsonScannerSemantics({sourceOverrides,fault:name}),error=>error.code==='ERR_ASSERTION'&&error.message.includes(oracle),'JSON_SCANNER_INTENDED_SOURCE_FAULT_ORACLE: '+name);faults.push({name,oracle,detected:true});}
 return {...report,faults};
}
export async function verifySyntaxTransportStage1({reservedDuplicateAdmissionOnly=false}={}){
assert.equal(typeof reservedDuplicateAdmissionOnly,'boolean','SYNTAX_RESERVED_DUPLICATE_SCOPE_ORACLE');
const selectedCases=reservedDuplicateAdmissionOnly?cases.filter(row=>row[1]==='DUPLICATE_JSON_MEMBER'):cases;
if(reservedDuplicateAdmissionOnly)assert.equal(selectedCases.length,5,'SYNTAX_RESERVED_DUPLICATE_CASE_POPULATION_ORACLE');
const scannerSemantics=reservedDuplicateAdmissionOnly?null:verifyJsonScannerSemanticControls(),observations=[],startedAtUtc=new Date().toISOString();
for(const [name,expectedCode,rawFor] of selectedCases){
 const r=projectStoreRuntime({sourceOverrides:sources}),f=await seed(r),e=stageOneEnvelope(r,f.p,f.prompt),raw=rawFor(e),before=protectedState(r,f.p,f.manifest.operationReservationId),inputBefore=JSON.stringify(f.p);
 if(reservedDuplicateAdmissionOnly&&observations.length===0){
  const corrupt=r.copy(f.p);corrupt.projectData.applicationProjection.receipt.outputSha256='f'.repeat(64);
  assert.throws(()=>protectedState(r,corrupt,f.manifest.operationReservationId),error=>error.code==='ERR_ASSERTION'&&error.message.includes('SYNTAX_STAGE1_PROJECTION_RECEIPT_ORACLE'),'SYNTAX_RESERVED_DUPLICATE_CORRUPT_PROJECTION_ORACLE');
 }
 const submitted=await submit(r,f,e,{rawText:raw}),result=submitted.result;
 assert.equal(result.validation.valid,false,'SYNTAX_STAGE1_REJECT: '+name);assert.equal(result.proposal,null,'SYNTAX_STAGE1_NO_PROPOSAL: '+name);
 const codes=Array.from(result.validation.issues,row=>row.code);assert(codes.includes(expectedCode),'SYNTAX_STAGE1_EXPECTED_CODE: '+name+' '+codes.join(','));
 if(['MALFORMED_JSON','TRUNCATED_RESPONSE','NON_JSON_WRAPPER','DUPLICATE_JSON_MEMBER','INVALID_ROOT','UNSAFE_SMART_QUOTES'].includes(expectedCode))assert.deepEqual(codes,[expectedCode],'SYNTAX_STAGE1_EXACT_PARSE_CODE: '+name);
 assert.deepEqual(protectedState(r,result.project,f.manifest.operationReservationId),before,'SYNTAX_STAGE1_REJECTION_PRESERVATION: '+name);
 assert.deepEqual(gateOutcome(result.project),gateOutcome(f.p),'SYNTAX_STAGE1_GATE_OUTCOME_PRESERVATION: '+name);
 assert.equal(JSON.stringify(f.p),inputBefore,'SYNTAX_STAGE1_INPUT_UNCHANGED: '+name);
 assertRetainedAudit(f.p,result.project,name+' prepared');const read=await r.store.readProject(f.p.job.JOB_ID);assertRetainedAudit(f.p,read,name+' reloaded');assert.equal(r.store.validateProjectIntegrity(read).valid,true,'SYNTAX_STAGE1_RELOAD_INTEGRITY: '+name);assert.deepEqual(protectedState(r,read,f.manifest.operationReservationId),before,'SYNTAX_STAGE1_RELOAD_PRESERVATION: '+name);
 assert.equal(r.ingestion.findRaw(read,submitted.rawResponseId).completeRawResponse,raw,'SYNTAX_STAGE1_EXACT_RAW_RELOAD: '+name);assert.equal(read.projectData.responseValidations.at(-1).valid,false);
 assert.deepEqual(gateOutcome(read),gateOutcome(f.p),'SYNTAX_STAGE1_RELOAD_GATE_OUTCOME_PRESERVATION: '+name);
 const target=r.engine.records(read,'operationReservations').find(row=>row.id===f.manifest.operationReservationId);assert.equal(r.engine.recordValue(target,'STATUS'),'REJECTED','SYNTAX_STAGE1_REJECTED_RESERVATION: '+name);
 const row={name,expectedCode,observedCodes:codes,stage:1,responseBoundary:'PREPARE_CAPTURED',validationValid:false,proposalCreated:false,protectedJobAndCanonicalStateUnchanged:true,retainedAuditPrefixesPreserved:true,inputProjectPreserved:true,rawExactAfterReload:true,rejectionSavedAndReloaded:true,reservationBindingPreserved:true,reservationStatus:'REJECTED',acceptedChangesBefore:before.projectData.acceptedChanges.length,acceptedChangesAfter:read.projectData.acceptedChanges.length};observations.push(row);console.log(JSON.stringify({caseComplete:name,result:'PASS'}));
}
// The file-first size guard rejects before reading the oversized response into
// parser memory. Its bounded staging retains the original bytes and receipt.
// The complete Stage1 accounting contract has a 64 MiB serialized allowance;
// independent literals exercise that operation's actual boundary, not the
// ordinary 1 MiB response budget retained by other operations.
if(!reservedDuplicateAdmissionOnly){
 const r=projectStoreRuntime({sourceOverrides:sources}),f=await seed(r),e=stageOneEnvelope(r,f.p,f.prompt),base=JSON.stringify(e),limit=67108864;
 assert.equal(f.manifest.attachmentSlots.find(row=>row.role==='STRUCTURED_RESPONSE').maximumSize,limit,'SYNTAX_PUBLISHED_RESPONSE_BUDGET');
 const raw=base+' '.repeat(limit+1-Buffer.byteLength(base)),before=protectedState(r,f.p,f.manifest.operationReservationId),inputBefore=JSON.stringify(f.p),m=f.manifest;
 const staged=await r.store.stageResponseFile({jobId:f.p.job.JOB_ID,stage:1,blob:new Blob([raw],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:m.promptIdentity,packageId:m.packageId,operationReservationId:m.operationReservationId,challengeNonce:m.challengeNonce});
 await assert.rejects(()=>r.store.readStagedResponseFile({jobId:f.p.job.JOB_ID,stagingId:staged.stagingId}),error=>error.code==='OVERSIZED_RESPONSE','SYNTAX_STAGE1_OVERSIZE_GUARD');
 const retained=await r.store.metaGet(`responseStaging:${f.p.job.JOB_ID}:${staged.stagingId}`);assert.equal(retained.rejection.code,'OVERSIZED_RESPONSE');assert.equal(retained.byteSize,limit+1);assert.equal(await retained.blob.text(),raw);assert.equal(sha(new Uint8Array(await retained.blob.arrayBuffer())),sha(raw));
 const read=await r.store.readProject(f.p.job.JOB_ID);assertRetainedAudit(f.p,read,'oversized response');assert.deepEqual(protectedState(r,read,f.manifest.operationReservationId),before);assert.equal(read.projectData.responseProposals.length,0);assert.equal(read.projectData.rawResponses.length,0);assert.equal(read.projectData.responseValidations.length,0);assert.equal(JSON.stringify(f.p),inputBefore,'SYNTAX_STAGE1_OVERSIZE_INPUT_UNCHANGED');
 observations.push({name:'oversized response',stage:1,expectedCode:'OVERSIZED_RESPONSE',observedCodes:['OVERSIZED_RESPONSE'],responseBoundary:'STAGED_READ_GUARD',proposalCreated:false,protectedJobAndCanonicalStateUnchanged:true,retainedAuditPrefixesPreserved:true,inputProjectPreserved:true,rawBlobRetained:true,rawExactAfterReload:true,rejectionReceiptRetained:true,stagedByteSize:limit+1,acceptedChangesBefore:before.projectData.acceptedChanges.length,acceptedChangesAfter:read.projectData.acceptedChanges.length});console.log(JSON.stringify({caseComplete:'oversized response',result:'PASS'}));
}
const controls=[];
for(const name of reservedDuplicateAdmissionOnly?['ascii-escaped-data','unicode-quotation-data']:['ascii-escaped-data','unicode-quotation-data','exact-size-boundary']){
 const r=projectStoreRuntime({sourceOverrides:sources}),f=await seed(r),e=stageOneEnvelope(r,f.p,f.prompt);e.evidence[0].content=name==='unicode-quotation-data'?'He said “keep the exact words”.':'He said "keep the exact words".';
 let raw=JSON.stringify(e);if(name==='exact-size-boundary')raw+=' '.repeat(67108864-Buffer.byteLength(raw));
 const before=protectedState(r,f.p,f.manifest.operationReservationId),submitted=await submit(r,f,e,{rawText:raw});assert.equal(submitted.result.validation.valid,true,'SYNTAX_STAGE1_CONFORMING: '+name+' '+JSON.stringify(submitted.result.validation.issues));assert(submitted.result.proposal);
 assert.deepEqual(protectedState(r,submitted.p,f.manifest.operationReservationId),before,'SYNTAX_STAGE1_VALID_NOT_ACCEPTED: '+name);assertRetainedAudit(f.p,submitted.p,name+' prepared');const read=await r.store.readProject(f.p.job.JOB_ID);assertRetainedAudit(f.p,read,name+' reloaded');assert.equal(r.store.validateProjectIntegrity(read).valid,true);assert.equal(r.ingestion.findRaw(read,submitted.rawResponseId).completeRawResponse,raw);assert.deepEqual(protectedState(r,read,f.manifest.operationReservationId),before);
 assert.deepEqual(gateOutcome(read),gateOutcome(f.p),'SYNTAX_STAGE1_VALID_GATE_OUTCOME_PRESERVATION: '+name);
 const row={name,stage:1,validationValid:true,proposalCreated:true,proposalNotCanonicalCommit:true,protectedJobAndCanonicalStateUnchanged:true,retainedAuditPrefixesPreserved:true,rawExactAfterReload:true,pendingProposalSavedAndReloaded:true,rawByteSize:Buffer.byteLength(raw),acceptedChangesBefore:before.projectData.acceptedChanges.length,acceptedChangesAfter:read.projectData.acceptedChanges.length};controls.push(row);console.log(JSON.stringify({caseComplete:name,result:'PASS'}));
}
assert.deepEqual(files.filter(name=>sha(fs.readFileSync(name,'utf8'))!==sourceHashes[name]),[],'SYNTAX_SOURCE_CHANGED_DURING_EXECUTION');
const report={stage1SyntaxTransportBoundary:reservedDuplicateAdmissionOnly?'SCOPED_PASS':'PASS',...(reservedDuplicateAdmissionOnly?{reservedDuplicateAdmissionBoundary:'PASS',executionScope:'FIVE_RESERVED_DUPLICATE_REFUSALS_AND_TWO_SMALL_CONFORMING_CONTROLS',projectionCorruptionControl:true}:{}),scannerSemantics,startedAtUtc,observedAtUtc:new Date().toISOString(),nodeVersion:process.version,sourceHashes,synthetic:true,actualBrowser:false,realExternalAgent:false,syntheticPrerequisiteFlags:false,stagesExercised:[1],observations,controls,projection:{operationalDerivedFields:['applicationProjection'],projectionReceiptBinding:'Independent Node SHA-256 over actual canonical sources and declared observed outputs; exact registry/input/source/output receipt binding',gateOutcomePreservation:'Every stage status/decision/decisionEvidence/gate field except checkedAt compared to the retained before snapshot',protectedJob:'Every Job field except CURRENT_STATE and NEXT_REQUIRED_ACTION; all23 application identities/pointers/versions and four canonical summaries protected.',canonicalFamilies:'Whole project snapshot with exact operational exclusions; every registered family and nonregistry canonical value, selected reservation binding/content hash, unrelated reservations, all root metadata and all stage fields except the four explicit operational diagnostics are protected.',operationalCollections,operationalStageFields,reservationExclusions:['STATUS','fields.STATUS','updatedAt','recordSha256','sha256'],retainedAuditFamilies,projectChecksumExclusion:'projectSha256 is recomputed for operational audit records; canonical revision is still protected.',operationalTransitionBasis:'Specification35.6 allows rejection operational metadata without incrementing canonical revision;17.6 requires rejection/raw records. The selected reserved operation must end REJECTED.'},limits:['Real Stage1 application seed/reservation/package and actual Blob staging/read/hash/prepare/reload under isolated transaction adapter; no browser, human-authenticated authority, external-agent execution or full application journey claim.',...(reservedDuplicateAdmissionOnly?['This bounded entry excludes oversized/exact-size capacity controls and the separately executed scanner semantic controls.']:['Oversized file rejection occurs at staged read guard before parser or raw-response metadata creation; exact original staged Blob and rejection receipt are separately asserted.']),'Complete owning suite and normal CI receipt remain required after integration.']};
return report;
}
export async function verifyReservedDuplicateAdmissionControls(){
 return verifySyntaxTransportStage1({reservedDuplicateAdmissionOnly:true});
}

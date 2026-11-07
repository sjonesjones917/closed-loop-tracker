import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {testIrManifestedEnvironment} from './test-test-ir-native-identity.mjs';
import {testIrAuthorPrerequisite} from './test-test-ir-author-prerequisite.mjs';
import {canonicalFixtureRecord,reviewProofFixture} from './test-fixtures.mjs';
import {isolatedVerifierWorkerClass} from './verifier-runtime.mjs';
import {verifyIterationLaterEvidence} from './test-derivation-receipt-contract.mjs';

// This exercises only the actual helper's native-authority and Stage18/19
// dueNow assertions. The first access to beforeProduct throws an exact sentinel
// before any earlier-receipt check. No Stage18/19 receipt or complete prefix is
// manufactured, and reaching that sentinel is never a full-helper PASS.
export async function verifyNativeProofProvenance(){
 const r=projectStoreRuntime({storageWorker:false,environment:testIrManifestedEnvironment()}),e=r.engine,h=r.runtime.closedLoopHash,rt=r.runtime.closedLoopTestRuntime,schema=r.runtime.closedLoopWorkflowSchema;
 const {p}=await testIrAuthorPrerequisite(r),runtime={engine:e,schema,prompts:r.prompts,ingestion:r.ingestion};
 const proposition=e.recordsForCurrentScope(p,'propositions')[0];assert(proposition,'NATIVE_PROVENANCE_ACTUAL_PREREQUISITE_PROPOSITION');
 // Maintained accepted Stages1–5 are setup only. The new canonical test and
 // expression are controlled authored fixtures; their independent proof review
 // is admitted and committed through the real response-ingestion owner.
 for(const family of ['tests','proofExpressions'])for(const row of e.recordsForCurrentScope(p,family)){row.active=false;e.refreshRecordHashes(row,family);}
 const fields={REQ_ID:e.recordValue(proposition,'REQUIREMENT_ID'),TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_SPEC:{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'FILE'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'ASSERT_EQ',value:'VERIFIED\n'}]},EXECUTABLE_INPUT_BINDINGS:{FILE:{kind:'ARTIFACT',filename:'result.txt'}},ARTIFACT_REQUIREMENTS:'NONE',TEST_PROPOSITION_TEXT:e.recordValue(proposition,'PROPOSITION_TEXT'),TARGET_PROPOSITION_IDS:[proposition.id],TEST_ROLE:'REQUIRED_PROOF',SEMANTIC_COVERAGE_DISPOSITION:'EQUIVALENT',EVIDENCE_TO_PRESERVE:'The actual exact delivered-file byte assertion and native execution identity.',STATUS:'ACTIVE',VERIFICATION_PHASE:'FINAL_PRODUCT_DETERMINISTIC',EARLIEST_EXECUTABLE_STAGE:22,REQUIRED_BY_STAGE:22,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:true,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'}};
 fields.EXECUTABLE_SPEC_SHA256=h.sha256Value(rt.normalizeSpec(r.copy(fields.EXECUTABLE_SPEC)));
 const setupScope={instructionVersion:null,productId:null,productVersion:null};
 let test=canonicalFixtureRecord(runtime,p,'tests',fields,{stage:6,scope:setupScope,relationships:{REQ_ID:fields.REQ_ID}});
 const testId=test.id,node={type:'LEAF',testId,requiredDisposition:'SATISFIED',truthExtraction:'ACCEPTED_ENTAILMENT',evidenceClasses:['OBSERVATION_RECORD','ACCEPTED_ENTAILMENT'],scopeBinding:'CURRENT'};
 canonicalFixtureRecord(runtime,p,'proofExpressions',{TARGET_PROPOSITION_ID:proposition.id,PROPOSED_EXPRESSION:node,NORMALIZED_EXPRESSION:node,SEMANTIC_RATIONALE:'The exact delivered-file bytes are the controlling proposition.'},{scope:setupScope,relationships:{TARGET_PROPOSITION_ID:proposition.id}});
 reviewProofFixture(runtime,p);test=e.recordsForCurrentScope(p,'tests').find(row=>row.id===testId);assert(test,'NATIVE_PROVENANCE_REVIEWED_TEST_RETAINED');
 const product=canonicalFixtureRecord(runtime,p,'products',{PRODUCT_VERSION:'PRODUCT-V1',STATUS:'COMPLETED'},{stage:21});product.completionState='COMPLETED';e.refreshRecordHashes(product,'products');p.job.CURRENT_PRODUCT_ID=product.id;p.job.CURRENT_PRODUCT_VERSION='PRODUCT-V1';p.activeStage=22;
 const artifactId=e.allocateId(p,'artifacts'),filename='result.txt',blob=new Blob(['VERIFIED\n'],{type:'text/plain'}),sha256=await h.sha256Bytes(blob);
 await r.store.putArtifact({artifactId,jobId:p.job.JOB_ID,blob,filename,mediaType:blob.type,expectedSha256:sha256});
 e.registerArtifactBytes(p,r.copy({artifactId,filename,mediaType:blob.type,byteSize:blob.size,sha256,lineage:{productId:product.id}}));
 const stored=await r.store.getArtifact(artifactId),bytes=new Uint8Array(await stored.blob.arrayBuffer());assert.equal(await h.sha256Bytes(bytes),sha256,'NATIVE_PROVENANCE_ACTUAL_INPUT_BYTES');
 const executed=r.copy(await rt.executeTest(test,{FILE:{artifactId,filename,bytes}},{},{Worker:isolatedVerifierWorkerClass()}));
 assert.equal(executed.determination,'SATISFIED','NATIVE_PROVENANCE_ACTUAL_WORKER_ASSERTION');
 const result=e.recordApplicationDeterministicResult(p,r.copy({testId,productId:product.id,runtimeResult:executed,inputArtifacts:[{artifactId,filename,byteSize:bytes.byteLength,sha256}]}));
 const reviews=e.recordsForCurrentScope(p,'entailmentReviews').filter(row=>Number(row.stage)===22&&e.recordValue(row,'ACCEPTED_RELATION')==='ESTABLISHES');assert.equal(reviews.length,1,'NATIVE_PROVENANCE_SINGLE_ACTUAL_ENTAILMENT');
 const reviewId=reviews[0].id,observationId=e.recordValue(reviews[0],'OBSERVATION_ID'),evidenceId=result.evidenceRefs[0],proofReviewIds=Array.from(e.acceptedProofReviews(p,testId),row=>row.id),resultId=result.id;
 assert.equal(reviews[0].source,'APPLICATION_TEST_RUNTIME','NATIVE_PROVENANCE_ACTUAL_ENTAILMENT_OWNER');assert(proofReviewIds.length,'NATIVE_PROVENANCE_ACTUAL_ACCEPTED_PROOF_REVIEW');
 const row=(state,family,id)=>state.projectData[family].find(record=>record.id===id),set=(record,field,value)=>{record.fields[field]=record[field]=value;};
 // JSON.parse and mutation callbacks run in the host realm. Copy the complete
 // edited object into the runtime realm before its unchanged strict encoder.
 const bindingEdit=(state,edit)=>{const observation=row(state,'observationRecords',observationId),binding=JSON.parse(e.recordValue(observation,'RAW_OR_NATIVE_PROVENANCE'));edit(binding);set(observation,'RAW_OR_NATIVE_PROVENANCE',h.stableStringify(r.copy(binding)));};
 const cloneWithNewId=(state,family,id)=>{const duplicate=r.copy(row(state,family,id)),newId=e.allocateId(state,family);duplicate.id=newId;set(duplicate,schema.RECORD_SCHEMAS[family].idField,newId);e.refreshRecordHashes(duplicate,family);state.projectData[family].push(duplicate);return duplicate;};
 const cases=[],original=h.sha256Value(p);
 const invoke=(state,{caseId,expectedOracle=null})=>{
  const sentinel=Object.assign(new Error('NATIVE_PROVENANCE_STOP_BEFORE_EARLIER_RECEIPTS'),{code:'NATIVE_PROVENANCE_PARTIAL_BOUNDARY'});let accesses=0,caught=null;
  const beforeProduct=new Proxy(Object.create(null),{get(){accesses++;throw sentinel;}}),before=h.sha256Value(state);
  try{verifyIterationLaterEvidence({engine:e,beforeProduct,afterEvidence:state});}catch(error){caught=error;}
  assert.equal(h.sha256Value(state),before,'NATIVE_PROVENANCE_HELPER_PRESERVES_INPUT: '+caseId);
  if(expectedOracle){assert.notEqual(caught,sentinel,'NATIVE_PROVENANCE_MUTATION_REACHED_RECEIPT_BOUNDARY: '+caseId);assert.equal(accesses,0,'NATIVE_PROVENANCE_MUTATION_STOPPED_BEFORE_RECEIPTS: '+caseId);assert.equal(caught?.code,'ERR_ASSERTION','NATIVE_PROVENANCE_EXPECTED_ASSERTION: '+caseId);assert(caught.message.startsWith(expectedOracle),'NATIVE_PROVENANCE_INTENDED_ORACLE: '+caseId+' expected '+expectedOracle+'; observed '+caught?.message);}
  else{assert.equal(caught,sentinel,'NATIVE_PROVENANCE_NATIVE_BRANCH_REACHES_EXACT_BOUNDARY');assert.equal(accesses,1,'NATIVE_PROVENANCE_FIRST_PREPRODUCT_ACCESS');}
  cases.push({caseId,result:'PASS',observed:expectedOracle||sentinel.code,fullHelperReturned:false,earlierReceiptChecksExecuted:false});
 };
 invoke(p,{caseId:'actual-native-authority-and-both-future-due-assertions'});
 const mutations=[
  ['missing-observation','ITERATION_FUTURE_EVIDENCE_UNIQUE_REFERENCE: observationRecords',state=>{state.projectData.observationRecords=state.projectData.observationRecords.filter(record=>record.id!==observationId);}],
  ['duplicate-observation-id','ITERATION_FUTURE_EVIDENCE_UNIQUE_REFERENCE: observationRecords',state=>{state.projectData.observationRecords.push(r.copy(row(state,'observationRecords',observationId)));}],
  ['duplicate-observation-provenance','ITERATION_NATIVE_UNIQUE_EXECUTION_OBSERVATION',state=>{cloneWithNewId(state,'observationRecords',observationId);}],
  ['missing-result','ITERATION_FUTURE_EVIDENCE_UNIQUE_REFERENCE: deterministicResults',state=>{state.projectData.deterministicResults=state.projectData.deterministicResults.filter(record=>record.id!==resultId);}],
  ['duplicate-result-id','ITERATION_FUTURE_EVIDENCE_UNIQUE_REFERENCE: deterministicResults',state=>{state.projectData.deterministicResults.push(r.copy(row(state,'deterministicResults',resultId)));}],
  ['duplicate-result-execution','ITERATION_NATIVE_UNIQUE_EXECUTION_RESULT',state=>{cloneWithNewId(state,'deterministicResults',resultId);}],
  ['missing-executed-evidence','ITERATION_NATIVE_EXECUTION_CURRENT',state=>{state.projectData.evidenceRecords=state.projectData.evidenceRecords.filter(record=>record.id!==evidenceId);}],
  ['duplicate-evidence-id','ITERATION_FUTURE_EVIDENCE_UNIQUE_REFERENCE: evidenceRecords',state=>{state.projectData.evidenceRecords.push(r.copy(row(state,'evidenceRecords',evidenceId)));}],
  ['duplicate-result-evidence-reference','ITERATION_NATIVE_UNIQUE_RESULT_EVIDENCE',state=>{row(state,'deterministicResults',resultId).evidenceRefs.push(evidenceId);}],
  ['extra-executed-evidence','ITERATION_NATIVE_SINGLE_EXECUTION_EVIDENCE',state=>{const duplicate=cloneWithNewId(state,'evidenceRecords',evidenceId);row(state,'deterministicResults',resultId).evidenceRefs.push(duplicate.id);}],
  ['missing-accepted-proof-review','ITERATION_NATIVE_ACCEPTED_PROOF_REVIEWS',state=>{state.projectData.semanticReviews=state.projectData.semanticReviews.filter(record=>!proofReviewIds.includes(record.id));}],
  ['duplicate-accepted-proof-review','ITERATION_NATIVE_ACCEPTED_PROOF_REVIEWS',state=>{state.projectData.semanticReviews.push(r.copy(row(state,'semanticReviews',proofReviewIds[0])));}],
  ['missing-proof-review-binding','ITERATION_NATIVE_UNIQUE_PROOF_REVIEW_BINDING',state=>{bindingEdit(state,binding=>{binding.proofReviewIds=[];});}],
  ['duplicate-proof-review-binding','ITERATION_NATIVE_UNIQUE_PROOF_REVIEW_BINDING',state=>{bindingEdit(state,binding=>{binding.proofReviewIds.push(binding.proofReviewIds[0]);});}],
  ['changed-proof-review-binding','ITERATION_NATIVE_CURRENT_PROOF_REVIEW_BINDING',state=>{bindingEdit(state,binding=>{binding.proofReviewIds=['UNREGISTERED-PROOF-REVIEW'];});}],
  ['changed-test-semantics','ITERATION_NATIVE_TEST_SEMANTIC_IDENTITY',state=>{set(row(state,'tests',testId),'TEST_PROPOSITION_TEXT','A different proposition is not the accepted delivered-file assertion.');}],
  ['changed-native-execution-binding','ITERATION_NATIVE_OBSERVATION_EXECUTION_LINK',state=>{bindingEdit(state,binding=>{binding.nativeExecutionIdentitySha256='0'.repeat(64);});}],
  ['changed-native-evidence-payload','ITERATION_NATIVE_EXECUTION_CURRENT',state=>{const evidence=row(state,'evidenceRecords',evidenceId),payload=JSON.parse(e.recordValue(evidence,'APPLICATION_EVIDENCE_CONTENT'));payload.testId='UNREGISTERED-TEST';set(evidence,'APPLICATION_EVIDENCE_CONTENT',JSON.stringify(payload));}],
  ['duplicate-entailment-id','ITERATION_FUTURE_EVIDENCE_UNIQUE_REVIEWS',state=>{state.projectData.entailmentReviews.push(r.copy(row(state,'entailmentReviews',reviewId)));}],
  ['duplicate-native-entailment-link','ITERATION_NATIVE_UNIQUE_ENTAILMENT_LINK',state=>{cloneWithNewId(state,'entailmentReviews',reviewId);}]
 ];
 for(const [caseId,expectedOracle,mutate]of mutations){const candidate=r.copy(p);mutate(candidate);invoke(candidate,{caseId,expectedOracle});assert.equal(h.sha256Value(p),original,'NATIVE_PROVENANCE_MUTATIONS_PRESERVE_ACTUAL_SOURCE: '+caseId);}
 return {nativeProofProvenanceControls:'PASS',synthetic:true,actualIsolatedWorker:true,actualBrowser:false,controlledAuthoredTestAndExpression:true,actualAcceptedProofReview:true,nativeAssertion:'VERIFIED\n',scope:'Native authority branch and both Stage18/19 dueNow assertions only; exact sentinel stops before earlier receipt access.',fullHelperPass:false,fullLifecyclePrefix:false,stage18Or19ReceiptPreservation:false,releasePersistence:false,stage29Positive:false,positiveControls:1,negativeControls:mutations.length,cases};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await verifyNativeProofProvenance(),null,2));

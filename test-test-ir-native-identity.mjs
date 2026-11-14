import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {routingFixture} from './test-verification-routing-fixtures.mjs';
import {isolatedVerifierWorkerClass} from './verifier-runtime.mjs';
// Explicit source-bound test environment for real isolated worker execution.
// This synthetic build label binds these fixture bytes; it is not a deployed
// or independently verified production artifact claim.
export function testIrManifestedEnvironment(sourceOverrides={}){
 const paths=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','test-worker.js'];
 const sourceHashes=Object.fromEntries(paths.map(path=>[path,createHash('sha256').update(sourceOverrides[path]??fs.readFileSync(new URL(path,import.meta.url))).digest('hex')]));
 const buildIdentity='build-sha256-'+createHash('sha256').update(JSON.stringify(sourceHashes)).digest('hex'),workerSha256=sourceHashes['test-worker.js'];
 return {document:{currentScript:{src:'https://synthetic-native-fixture.invalid/test-runtime.js?v='+buildIdentity+'&workerSha256='+workerSha256}}};
}
// Explicitly synthetic current test/product records isolate the native result
// owner. Execution, application recording, currentness and adapter reload are
// real; this does not establish earlier gates or semantic proof acceptance.
export async function verifyTestIrNativeIdentity({sourceOverrides={},onStoredCase=null}={}){
 sourceOverrides=Object.fromEntries(['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'].map(path=>[path,sourceOverrides[path]??fs.readFileSync(new URL(path,import.meta.url),'utf8')]));
 let executionMetricControls;
 const cases=[],prior='21b4c97a596fecd7ec5dca7788ded488827ef71c0aee3a041f89bd19d0eede00';
 for(const stage of [22,24])for(const form of ['current-explicit','prior-legacy','prior-explicit']){
  const r=projectStoreRuntime({sourceOverrides,environment:testIrManifestedEnvironment(sourceOverrides)}),e=r.engine,h=r.runtime.closedLoopHash,rt=r.runtime.closedLoopTestRuntime;vm.runInContext(routingFixture.toString()+';globalThis.identityFixture=routingFixture;',r.runtime);const {p,test,product,canonical}=r.runtime.identityFixture();p.activeStage=stage;
  const expected={version:'closed-loop-test-spec/1',languageVersion:'closed-loop-test-ir-language/1',operationRegistryVersion:'closed-loop-test-ir-operations/1',operationRegistrySha256:form==='current-explicit'?rt.OPERATION_REGISTRY_SHA256:prior,steps:[{stepId:'S001',op:'LOAD_ARTIFACT',inputs:{binding:{bindingRef:'JOB'}}},{stepId:'S002',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S001',output:'artifact'},expected:{literal:p.job.JOB_ID}}}],result:{stepRef:'S002',output:'assertion'}};
  const spec=form==='prior-legacy'?{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'JOB'},{op:'ASSERT_EQ',value:p.job.JOB_ID}]}:expected;
  const fields={EXECUTABLE_SPEC:r.copy(spec),EXECUTABLE_SPEC_SHA256:h.sha256Value(r.copy(expected)),TEST_TYPE:stage===22?'DETERMINISTIC':'ADVERSARIAL',VERIFICATION_PHASE:stage===22?'FINAL_PRODUCT_DETERMINISTIC':'FINAL_PRODUCT_ADVERSARIAL',EARLIEST_EXECUTABLE_STAGE:stage,REQUIRED_BY_STAGE:stage};
  for(const [key,value]of Object.entries(fields)){test.fields[key]=value;test[key]=value;}e.refreshRecordHashes(test,'tests');assert.equal(rt.supports(test),true,'TEST_IR_NATIVE_SUPPORTED_FIXTURE_ORACLE '+form);
  const rawDefinitionBefore=JSON.stringify(test.fields.EXECUTABLE_SPEC),result=r.copy(await rt.executeTest(test,{}, {JOB:canonical},{Worker:isolatedVerifierWorkerClass()}));assert.equal(result.determination,'SATISFIED');assert.equal(result.testSpecSha256,fields.EXECUTABLE_SPEC_SHA256);const identity=rt.nativeExecutionIdentity(test,result);assert.equal(identity.valid,true,JSON.stringify(identity.issues));assert.equal(identity.releaseBearing,true,'TEST_IR_NATIVE_MANIFESTED_FIXTURE_ORACLE');
  const recorded=e.recordApplicationNativeProductResult(p,{stage,testId:test.id,productId:product.id,runtimeResult:result,inputArtifacts:[]}),collection=stage===22?'deterministicResults':'adversarialResults';
  assert.equal(e.recordValue(recorded,'TEST_SPEC_SHA256'),result.testSpecSha256,'TEST_IR_NATIVE_RECORDED_CANONICAL_IDENTITY_ORACLE '+stage+'/'+form);
  const evidence=e.records(p,'evidenceRecords').find(row=>recorded.evidenceRefs.includes(row.id)),payload=JSON.parse(e.recordValue(evidence,'APPLICATION_EVIDENCE_CONTENT'));
  assert.equal(payload.testSpecSha256,result.testSpecSha256,'TEST_IR_NATIVE_EVIDENCE_CANONICAL_IDENTITY_ORACLE');assert.deepEqual(r.copy(payload.nativeExecutionIdentity),r.copy(identity.identity),'TEST_IR_NATIVE_COMPLETE_IDENTITY_PRESERVATION_ORACLE');assert.equal(e.applicationNativeResultCurrent(p,collection,recorded,test),true,'TEST_IR_NATIVE_CURRENT_RESULT_ORACLE');assert.equal(e.effectiveDetermination(collection,recorded,test,p),'SATISFIED','TEST_IR_NATIVE_EFFECTIVE_DETERMINATION_ORACLE');
  const stored=await r.store.writeProject(p,{createOnly:true,expectedProjectRevision:0,incrementRevision:false}),reloaded=await r.store.readProject(stored.job.JOB_ID),savedTest=reloaded.projectData.tests.find(row=>row.id===test.id),savedResult=reloaded.projectData[collection].find(row=>row.id===recorded.id);assert.equal(e.applicationNativeResultCurrent(reloaded,collection,savedResult,savedTest),true);assert.equal(JSON.stringify(savedTest.fields.EXECUTABLE_SPEC),rawDefinitionBefore,'TEST_IR_NATIVE_RETAINED_DEFINITION_ORACLE');
  if(onStoredCase)await onStoredCase({runtime:r,project:reloaded,stage,form,resultId:recorded.id});
  if(stage===22&&form==='current-explicit')executionMetricControls=verifyRecordedTestExecutionMetricControls({r,project:reloaded,resultId:recorded.id});
  for(const mutation of ['wrong-receipt-hash','changed-definition']){const candidate=r.copy(reloaded),before=h.sha256Value(candidate);if(mutation==='wrong-receipt-hash')assert.throws(()=>e.recordApplicationNativeProductResult(candidate,{stage,testId:test.id,productId:product.id,runtimeResult:{...result,testSpecSha256:'0'.repeat(64)},inputArtifacts:[]}),error=>error.code==='INVALID_NATIVE_EXECUTION_IDENTITY');else{const changed=candidate.projectData.tests.find(row=>row.id===test.id);if(form==='prior-legacy')changed.fields.EXECUTABLE_SPEC.steps[1].value='CHANGED';else changed.fields.EXECUTABLE_SPEC.steps[1].inputs.expected.literal='CHANGED';assert.equal(e.applicationNativeResultCurrent(candidate,collection,candidate.projectData[collection].find(row=>row.id===recorded.id),changed),false);continue;}assert.equal(h.sha256Value(candidate),before,'TEST_IR_NATIVE_ATOMIC_REJECTION_ORACLE');}
  cases.push({stage,form,determination:'SATISFIED',actualIsolatedWorker:true,recordedCanonicalIdentity:true,evidenceCanonicalIdentity:true,currentBeforeAndAfterReload:true,rawDefinitionUnchanged:true,wrongReceiptRejectedAtomically:true,changedDefinitionNotCurrent:true,fullGateCompletionClaimed:false});
 }
 return {passed:true,checkId:'test-ir.native-canonical-identity',executionMetricControls,cases,inputRuntimeRecording:await verifyNativeInputRuntimeRecording({sourceOverrides}),identityGuards:await verifyNativeExecutionIdentityGuards({sourceOverrides}),sourceSha256:Object.fromEntries(Object.entries(sourceOverrides).map(([path,source])=>[path,createHash('sha256').update(source).digest('hex')])),synthetic:true,actualBrowser:false,boundary:'Synthetic accepted test/product setup; production isolated worker entry→native result/evidence/proof observation→currentness/effective determination→adapter store/reload. No preceding-stage or full-stage completion claim.'};
}

// Expected identities and adverse changes are specification-derived literals;
// fixture construction does not ask the currentness validator for its answer.
async function verifyNativeExecutionIdentityGuards({sourceOverrides}){
 const r=projectStoreRuntime({sourceOverrides,environment:testIrManifestedEnvironment(sourceOverrides)}),e=r.engine,h=r.runtime.closedLoopHash,rt=r.runtime.closedLoopTestRuntime;
 vm.runInContext(routingFixture.toString()+';globalThis.identityFixture=routingFixture;',r.runtime);const {p,test,product,canonical}=r.runtime.identityFixture();
 const result=r.copy(await rt.executeTest(test,{}, {JOB:canonical},{Worker:isolatedVerifierWorkerClass()}));assert.equal(result.determination,'SATISFIED');
 const fields=['schema','testId','runtimeVersion','runtimeBuildIdentity','testWorkerSha256','workerProtocolVersion','testSpecVersion','testSpecSha256','normalizedDagSha256','testIrLanguageVersion','operationRegistryVersion','operationRegistrySha256','jsonSelectorRegistryVersion','jsonSelectorRegistrySha256','xmlSelectorRegistryVersion','xmlSelectorRegistrySha256','regexRegistryVersion','regexRegistrySha256','parserRegistryIdentities','executedStepIds','selectedResultStepId','selectedResultPort','startedAtDeviceTime','endedAtDeviceTime'];
 assert.deepEqual([...rt.NATIVE_EXECUTION_IDENTITY_CONTRACT.fields],fields,'TEST_IR_NATIVE_CLOSED_IDENTITY_FIELDS_ORACLE');
 const carrier=r.runtime.closedLoopWorkflowSchema.CARRIER_FIELD_CONTRACTS.objects.nativeExecutionIdentity;assert.equal(carrier.owner,'test-runtime.js');assert.deepEqual(Object.keys(carrier.fieldDefinitions).sort(),fields.slice().sort(),'TEST_IR_NATIVE_CARRIER_FIELD_CLOSURE_ORACLE');for(const field of ['selectedResultStepId','selectedResultPort','testWorkerSha256'])assert.equal(carrier.fieldDefinitions[field].nullable,true,'TEST_IR_NATIVE_CARRIER_FAILURE_NULLABILITY_ORACLE '+field);
 const parserCarrier=r.runtime.closedLoopWorkflowSchema.CARRIER_FIELD_CONTRACTS.objects.nativeParserRegistryIdentity;assert.deepEqual(Object.keys(parserCarrier.fieldDefinitions).sort(),['operation','registrySha256','registryVersion']);
 const identity=rt.nativeExecutionIdentity(test,result).identity;
 assert.deepEqual([...identity.executedStepIds],['S001','S002']);assert.equal(identity.selectedResultStepId,'S002');assert.equal(identity.selectedResultPort,'assertion');assert.deepEqual([...identity.parserRegistryIdentities],[]);for(const field of ['jsonSelectorRegistryVersion','jsonSelectorRegistrySha256','xmlSelectorRegistryVersion','xmlSelectorRegistrySha256','regexRegistryVersion','regexRegistrySha256'])assert.equal(identity[field],null);
 const negatives=[
  ['missing-operation-registry',row=>delete row.operationRegistrySha256],['wrong-operation-registry',row=>row.operationRegistrySha256='0'.repeat(64)],
  ['missing-language',row=>delete row.testIrLanguageVersion],['missing-normalized-dag',row=>delete row.normalizedDagSha256],
  ['missing-worker-protocol',row=>delete row.workerProtocolVersion],['wrong-worker-protocol',row=>row.workerProtocolVersion='WRONG'],
  ['missing-build',row=>delete row.runtimeBuildIdentity],['wrong-worker-bytes',row=>row.testWorkerSha256='0'.repeat(64)],
  ['wrong-selected-port',row=>row.selectedResultPort='artifact'],['wrong-executed-prefix',row=>row.executedStepIds=['S002']],
  ['invented-parser-registry',row=>row.parserRegistryIdentities=[{operation:'PARSE_JSON',registryVersion:'closed-loop-test-ir-operations/1',registrySha256:result.operationRegistrySha256}]],
  ['invalid-device-time',row=>row.startedAtDeviceTime='not-a-time'],['success-with-failure-identity',row=>{row.executedStepIds=[];row.selectedResultStepId=null;row.selectedResultPort=null;}]
 ];
 const unrecorded=r.copy(p),recorded=e.recordApplicationNativeProductResult(p,{stage:22,testId:test.id,productId:product.id,runtimeResult:result,inputArtifacts:[]}),cases=[];
 // Documented pre-fix consumer equivalent: remove only the three newly added
 // outcome/identity/mirror guards, retaining test/input/payload-hash checks.
 // Reuse the exact actual-worker observation; no extra execution is needed.
 const guardPrefixes=[" if(payload.determination!==recordValue(record,'APPLICATION_DETERMINATION')", " try{if(hash.stableStringify(JSON.parse(recordValue(record,'INPUT_ARTIFACT_IDENTITIES')))", " const nativeIdentity=globalThis.closedLoopTestRuntime.nativeExecutionOutcomeCurrent(test,payload.nativeExecutionIdentity,payload);"];
 let previousEngine=sourceOverrides['workflow-engine.js'];for(const prefix of guardPrefixes){const matches=previousEngine.split('\n').filter(line=>line.startsWith(prefix));assert.equal(matches.length,1,'TEST_IR_NATIVE_PRE_FIX_CONSUMER_ANCHOR');previousEngine=previousEngine.replace(matches[0]+'\n','');}
 const previous=projectStoreRuntime({sourceOverrides:{...sourceOverrides,'workflow-engine.js':previousEngine},environment:testIrManifestedEnvironment(sourceOverrides)});
 const previousCurrent=project=>{const copy=previous.copy(project);return previous.engine.applicationNativeResultCurrent(copy,'deterministicResults',copy.projectData.deterministicResults[0],copy.projectData.tests[0]);};assert.equal(previousCurrent(p),true,'TEST_IR_NATIVE_PRE_FIX_CONTROL_ORACLE');

 for(const[name,mutate]of negatives){
  const candidate=r.copy(p),bad=r.copy(result),before=h.sha256Value(candidate);mutate(bad);
  assert.throws(()=>e.recordApplicationNativeProductResult(candidate,{stage:22,testId:test.id,productId:product.id,runtimeResult:bad,inputArtifacts:[]}),error=>error.code==='INVALID_NATIVE_EXECUTION_IDENTITY','TEST_IR_NATIVE_IDENTITY_ADMISSION_ORACLE '+name);assert.equal(h.sha256Value(candidate),before,'TEST_IR_NATIVE_IDENTITY_ATOMIC_ORACLE '+name);
  const altered=r.copy(p),row=altered.projectData.deterministicResults.find(item=>item.id===recorded.id),evidence=altered.projectData.evidenceRecords.find(item=>row.evidenceRefs.includes(item.id)),payload=JSON.parse(e.recordValue(evidence,'APPLICATION_EVIDENCE_CONTENT'));mutate(payload.nativeExecutionIdentity);const digest=h.sha256Value(r.copy(payload));evidence.fields.APPLICATION_EVIDENCE_CONTENT=evidence.APPLICATION_EVIDENCE_CONTENT=JSON.stringify(payload);evidence.fields.SHA256=evidence.SHA256=digest;row.nativeExecutionIdentitySha256=digest;e.refreshRecordHashes(evidence,'evidenceRecords');e.refreshRecordHashes(row,'deterministicResults');
  assert.equal(e.applicationNativeResultCurrent(altered,'deterministicResults',row,altered.projectData.tests[0]),false,'TEST_IR_NATIVE_IDENTITY_CURRENTNESS_ORACLE '+name);
  assert.equal(previousCurrent(altered),true,'TEST_IR_NATIVE_PRE_FIX_IDENTITY_REPRODUCTION '+name);cases.push({name,rejectedAtomically:true,coherentlyRehashedSavedIdentityNotCurrent:true,preFixEquivalentAdmitted:true});
 }
 const outcomeCases=[];
 for(const[name,mutate]of [['missing-observations',row=>row.observations=[]],['contradictory-determination',row=>row.determination='VIOLATED'],['changed-selected-value',row=>row.actual='CHANGED'],['wrong-observed-operation',row=>row.observations[0].op='COUNT']]){
  const bad=r.copy(result),candidate=r.copy(unrecorded),before=h.sha256Value(candidate);mutate(bad);assert.throws(()=>e.recordApplicationNativeProductResult(candidate,{stage:22,testId:test.id,productId:product.id,runtimeResult:bad,inputArtifacts:[]}),error=>error.code==='INVALID_NATIVE_EXECUTION_IDENTITY','TEST_IR_NATIVE_OUTCOME_ADMISSION_ORACLE '+name);assert.equal(h.sha256Value(candidate),before);
  const altered=r.copy(p),row=altered.projectData.deterministicResults[0],evidence=altered.projectData.evidenceRecords.find(item=>row.evidenceRefs.includes(item.id)),payload=JSON.parse(e.recordValue(evidence,'APPLICATION_EVIDENCE_CONTENT'));mutate(payload);const digest=h.sha256Value(r.copy(payload));evidence.fields.APPLICATION_EVIDENCE_CONTENT=evidence.APPLICATION_EVIDENCE_CONTENT=JSON.stringify(payload);evidence.fields.SHA256=evidence.SHA256=digest;row.nativeExecutionIdentitySha256=digest;e.refreshRecordHashes(evidence,'evidenceRecords');e.refreshRecordHashes(row,'deterministicResults');assert.equal(e.applicationNativeResultCurrent(altered,'deterministicResults',row,altered.projectData.tests[0]),false,'TEST_IR_NATIVE_OUTCOME_CURRENTNESS_ORACLE '+name);assert.equal(previousCurrent(altered),true,'TEST_IR_NATIVE_PRE_FIX_OUTCOME_REPRODUCTION '+name);outcomeCases.push({name,rejectedAtomically:true,coherentlyRehashedSavedOutcomeNotCurrent:true,preFixEquivalentAdmitted:true});
 }
 const canonicalMirrorCases=[];
 for(const[field,value]of [['TEST_ID','WRONG_TEST'],['RUNTIME_VERSION','WRONG_RUNTIME'],['PRODUCT_SHA256','0'.repeat(64)],['INPUT_ARTIFACT_IDENTITIES','[{"artifactId":"WRONG"}]'],['RUNTIME_OBSERVATIONS','[]']]){const altered=r.copy(p),row=altered.projectData.deterministicResults[0];row.fields[field]=row[field]=value;e.refreshRecordHashes(row,'deterministicResults');assert.equal(e.applicationNativeResultCurrent(altered,'deterministicResults',row,altered.projectData.tests[0]),false,'TEST_IR_NATIVE_CANONICAL_MIRROR_ORACLE '+field);assert.equal(previousCurrent(altered),true,'TEST_IR_NATIVE_PRE_FIX_MIRROR_REPRODUCTION '+field);canonicalMirrorCases.push({field,coherentlyRehashedResultNotCurrent:true,preFixEquivalentAdmitted:true});}
 const violatedProject=r.copy(unrecorded),violatedTest=violatedProject.projectData.tests[0],violatedSpec=rt.normalizeTestSpec(violatedTest);violatedSpec.steps[1].inputs.expected.literal='INDEPENDENT_EXPECTED_MISMATCH';violatedTest.fields.EXECUTABLE_SPEC=violatedTest.EXECUTABLE_SPEC=violatedSpec;violatedTest.fields.EXECUTABLE_SPEC_SHA256=violatedTest.EXECUTABLE_SPEC_SHA256=h.sha256Value(violatedSpec);e.refreshRecordHashes(violatedTest,'tests');const violated=r.copy(await rt.executeTest(violatedTest,{}, {JOB:canonical},{Worker:isolatedVerifierWorkerClass()}));assert.equal(violated.determination,'VIOLATED');const violatedRow=e.recordApplicationNativeProductResult(violatedProject,{stage:22,testId:test.id,productId:product.id,runtimeResult:violated,inputArtifacts:[]});assert.equal(e.applicationNativeResultCurrent(violatedProject,'deterministicResults',violatedRow,violatedTest),true);assert.equal(e.effectiveDetermination('deterministicResults',violatedRow,violatedTest,violatedProject),'VIOLATED');assertRecordedNativeMetric(violatedProject,e,{recordedValue:1,retainedResults:1,caseId:'actual-violated-execution'});violatedRow.fields.APPLICATION_DETERMINATION=violatedRow.APPLICATION_DETERMINATION='SATISFIED';e.refreshRecordHashes(violatedRow,'deterministicResults');assert.equal(e.applicationNativeResultCurrent(violatedProject,'deterministicResults',violatedRow,violatedTest),false,'TEST_IR_NATIVE_CONTRADICTORY_RESULT_FIELD_ORACLE');
 assert.equal(previousCurrent(violatedProject),true,'TEST_IR_NATIVE_PRE_FIX_FALSE_SATISFIED_REPRODUCTION');outcomeCases.push({name:'false-satisfied-from-actual-violation',preFixEquivalentAdmitted:true,actualWorkerViolation:true,currentViolatedControl:true,alteredResultNotCurrent:true});
 const failures=[];
 for(const kind of ['actual-worker-execution-failure','controlled-worker-timeout']){
  const candidate=r.copy(p);candidate.projectData.deterministicResults=[];candidate.projectData.evidenceRecords=[];candidate.projectData.observationRecords=[];
  // Invalid canonical input reaches the real isolated worker; no mock returns
  // the expected error. Timeout uses the existing timeout option and an inert
  // transport solely to inject an interrupted worker, never to fabricate PASS.
  let outcome;if(kind==='actual-worker-execution-failure')outcome=await rt.executeTest(test,{}, {JOB:{...canonical,value:'CHANGED_AFTER_BINDING'}},{Worker:isolatedVerifierWorkerClass()});else{class StoppedWorker{postMessage(){}terminate(){}}outcome=await rt.executeTest(test,{}, {JOB:canonical},{Worker:StoppedWorker,timeoutMs:1});}
  outcome=r.copy(outcome);assert.equal(outcome.determination,'UNDETERMINED');assert.equal(outcome.failure.code,kind==='actual-worker-execution-failure'?'CANONICAL_HASH_MISMATCH':'WORKER_TIMEOUT');const checked=rt.nativeExecutionIdentity(test,outcome);assert.equal(checked.valid,true,JSON.stringify(checked.issues));assert.equal(checked.failedExecution,true);assert.equal(checked.releaseBearing,false);
  const row=e.recordApplicationNativeProductResult(candidate,{stage:22,testId:test.id,productId:product.id,runtimeResult:outcome,inputArtifacts:[]}),evidence=candidate.projectData.evidenceRecords.find(item=>row.evidenceRefs.includes(item.id)),payload=JSON.parse(e.recordValue(evidence,'APPLICATION_EVIDENCE_CONTENT'));
  assert.equal(row.fields.APPLICATION_DETERMINATION,'UNDETERMINED');assert.equal(payload.status,outcome.status);assert.deepEqual(payload.failure,JSON.parse(JSON.stringify(outcome.failure)));assert.equal(e.applicationNativeResultCurrent(candidate,'deterministicResults',row,candidate.projectData.tests[0]),false);assert.equal(e.effectiveDetermination('deterministicResults',row,candidate.projectData.tests[0],candidate),'UNDETERMINED');assertRecordedNativeMetric(candidate,e,{recordedValue:0,retainedResults:1,caseId:kind});
  const isolated=projectStoreRuntime({sourceOverrides,environment:testIrManifestedEnvironment(sourceOverrides)}),saved=await isolated.store.writeProject(isolated.copy(candidate),{createOnly:true,expectedProjectRevision:0,incrementRevision:false}),reloaded=await isolated.store.readProject(saved.job.JOB_ID),savedResult=reloaded.projectData.deterministicResults[0];assert.equal(isolated.engine.applicationNativeResultCurrent(reloaded,'deterministicResults',savedResult,reloaded.projectData.tests[0]),false);
  failures.push({name:kind,failureCode:outcome.failure.code,recordedInconclusively:true,currentnessFalse:true,savedAndReloaded:true,realWorker:kind==='actual-worker-execution-failure'});
 }
 return {closedIdentityFields:fields,carrierContractMatches:true,negativeCases:cases,outcomeCases,canonicalMirrorCases,failureCases:failures,commandGuards:await verifyNativeProductCommandGuards({sourceOverrides,project:unrecorded,result}),actualIsolatedWorker:true,syntheticBuildIdentity:true};
}

async function verifyNativeProductCommandGuards({sourceOverrides,project,result}){
 const r=projectStoreRuntime({sourceOverrides,environment:testIrManifestedEnvironment(sourceOverrides)}),e=r.engine,h=r.runtime.closedLoopHash,p=r.copy(project),second=r.copy(p.projectData.tests[0]),secondId=e.allocateId(p,'tests');second.id=second.TEST_ID=second.fields.TEST_ID=secondId;e.refreshRecordHashes(second,'tests');p.projectData.tests.push(second);
 const canonical=e.canonicalTestBindingCatalog(p)['JOB.JOB_ID'],secondResult=r.copy(await r.runtime.closedLoopTestRuntime.executeTest(second,{}, {JOB:canonical},{Worker:isolatedVerifierWorkerClass()}));assert.equal(secondResult.determination,'SATISFIED');
 let saved=await r.store.writeProject(p,{createOnly:true,expectedProjectRevision:0,incrementRevision:false});
 const command=r.copy({jobId:saved.job.JOB_ID,stage:22,results:[{testId:result.testId,runtimeResult:result,inputArtifacts:[]}],expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256}),before=h.sha256Value(saved),commandBefore=h.sha256Value(command),negatives=[];
 const invalid=[['unregistered-stage',row=>row.stage=23,'INVALID_NATIVE_PRODUCT_COMMAND'],['duplicate-test',row=>row.results.push(r.copy(row.results[0])),'INVALID_NATIVE_PRODUCT_COMMAND'],['arbitrary-candidate',row=>row.project={job:{JOB_ID:row.jobId}},'INVALID_NATIVE_PRODUCT_COMMAND'],['confirmation-bypass-option',row=>row.mutationConfirmation={confirmed:true},'INVALID_NATIVE_PRODUCT_COMMAND'],['wrong-revision',row=>row.expectedProjectRevision++,'STALE_PROJECT_REVISION'],['wrong-state',row=>row.expectedStateSha256='0'.repeat(64),'STALE_PROJECT_REVISION'],['malformed-result',row=>delete row.results[0].runtimeResult.operationRegistrySha256,'INVALID_NATIVE_EXECUTION_IDENTITY'],['one-bad-result-in-batch',row=>{const bad=r.copy(secondResult);bad.workerProtocolVersion='WRONG';row.results.push({testId:secondId,runtimeResult:bad,inputArtifacts:[]});},'INVALID_NATIVE_EXECUTION_IDENTITY']];
 for(const[name,mutate,code]of invalid){const bad=r.copy(command);mutate(bad);await assert.rejects(()=>r.store.commitNativeProductResults(bad),error=>error.code===code,'TEST_IR_NATIVE_COMMAND_REJECTION_ORACLE '+name);assert.equal(h.sha256Value(await r.store.readProject(saved.job.JOB_ID)),before,'TEST_IR_NATIVE_COMMAND_ATOMIC_ORACLE '+name);negatives.push({name,code,storedStateUnchanged:true});}
 r.runtime.__closedLoopStorageFault='during-project-write';await assert.rejects(()=>r.store.commitNativeProductResults(command),error=>error.code==='INJECTED_STORAGE_FAILURE'&&error.existingProjectsUnchanged===true,'TEST_IR_NATIVE_COMMAND_TRANSACTION_FAILURE_ORACLE');delete r.runtime.__closedLoopStorageFault;assert.equal(h.sha256Value(await r.store.readProject(saved.job.JOB_ID)),before);assert.equal(h.sha256Value(command),commandBefore,'TEST_IR_NATIVE_COMMAND_RETAINED_OBSERVATIONS_ORACLE');
 saved=await r.store.commitNativeProductResults(command);assert.equal(saved.projectData.deterministicResults.length,1);assert.equal(e.applicationNativeResultCurrent(saved,'deterministicResults',saved.projectData.deterministicResults[0],saved.projectData.tests[0]),true);
 const humanMutation=r.copy(saved),target=humanMutation.projectData.deterministicResults[0];target.active=false;target.validity='INVALIDATED';target.invalidatedBy='SYNTHETIC_OPERATOR_CORRECTION';e.refreshRecordHashes(target,'deterministicResults');await assert.rejects(()=>r.store.replaceProject(humanMutation,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256}),error=>error.code==='MUTATION_CONFIRMATION_REQUIRED','TEST_IR_NATIVE_GENERIC_REPLACEMENT_REMAINS_GUARDED_ORACLE');
 const exact=r.copy({...command,expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256}),again=await r.store.commitNativeProductResults(exact);assert.equal(again.projectData.deterministicResults.length,1);assert.equal(again.projectData.evidenceRecords.length,saved.projectData.evidenceRecords.length);assert.equal(again.projectData.observationRecords.length,saved.projectData.observationRecords.length);assert.equal(h.sha256Value(command),commandBefore);assertRecordedNativeMetric(again,e,{recordedValue:1,retainedResults:1,caseId:'exact-command-retry-no-new-execution'});
 return {negativeCases:negatives,uncertainOutcomes:await verifyNativeCommandOutcomeUncertainty({sourceOverrides,project,result}),failedTransactionAtomic:true,retainedCommandUnchanged:true,retryCommitsWithoutAnotherExecution:true,genericReplacementRequiresReview:true,exactRetryNoDuplicate:true,storeBoundary:'PRODUCTION_COMMAND_AND_TRANSACTION_ADAPTER'};
}

async function verifyNativeCommandOutcomeUncertainty({sourceOverrides,project,result}){
 const anchor="async function readProject(jobId,{refreshProjection=false,[PHYSICAL_SOURCE_CAPTURE]:physicalCapture=null}={}){",notify="function notifyProjectChange(project,details={}){",fault="error.code='INJECTED_STORAGE_FAILURE';throw error;",store=sourceOverrides['project-store.js'];for(const text of [anchor,notify,fault])assert.equal(store.split(text).length,2,'TEST_IR_NATIVE_UNCERTAIN_OUTCOME_FAULT_ANCHOR');
 // Faults affect only transaction completion/observation. No native receipt,
 // expected identity or canonical candidate is supplied by this injection.
 const injected=store.replace(anchor,anchor+"if(globalThis.__nativeRecoveryReadHook){const hook=globalThis.__nativeRecoveryReadHook;delete globalThis.__nativeRecoveryReadHook;await hook();}").replace(notify,notify+"if(globalThis.__nativeAfterCommitFault){const error=Object.assign(new Error('Injected notification failure after commit'),{code:'CONTROLLED_AFTER_COMMIT_FAILURE'});globalThis.__nativeAfterCommitError=error;throw error;}").replace(fault,"error.code='INJECTED_STORAGE_FAILURE';if(globalThis.__nativeRecoveryHookOnFault)globalThis.__nativeRecoveryReadHook=globalThis.__nativeRecoveryHookOnFault;throw error;"),cases=[];
 for(const name of ['read-unavailable-after-failure','concurrent-change-after-failure','failure-after-commit']){
  const r=projectStoreRuntime({sourceOverrides:{...sourceOverrides,'project-store.js':injected},environment:testIrManifestedEnvironment(sourceOverrides)}),saved=await r.store.writeProject(r.copy(project),{createOnly:true,expectedProjectRevision:0,incrementRevision:false}),command=r.copy({jobId:saved.job.JOB_ID,stage:22,results:[{testId:result.testId,runtimeResult:result,inputArtifacts:[]}],expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
  if(name==='failure-after-commit')r.runtime.__nativeAfterCommitFault=true;
  else{r.runtime.__closedLoopStorageFault='during-project-write';r.runtime.__nativeRecoveryHookOnFault=name==='read-unavailable-after-failure'?async()=>{throw Error('Controlled unavailable outcome read');}:async()=>{delete r.runtime.__closedLoopStorageFault;delete r.runtime.__nativeRecoveryHookOnFault;const concurrent=r.copy(saved);concurrent.activeView='Records';await r.store.writeProject(concurrent,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});};}
  // A notification failure is after durable completion. The public store now
  // preserves that exact cause inside its explicit committed-recovery error.
  // Other uncertain outcomes retain their original injected-error contract.
  let outcomeError;
  const expectedOutcomeError=error=>error?.existingProjectsUnchanged===false&&(name==='failure-after-commit'
    ?error.code==='COMMITTED_PROJECT_UNAVAILABLE'&&error.committed===true&&error.cause===r.runtime.__nativeAfterCommitError&&error.cause?.code==='CONTROLLED_AFTER_COMMIT_FAILURE'&&error.cause.message==='Injected notification failure after commit'&&error.jobId===saved.job.JOB_ID&&error.revision===saved.revision+1&&/^[a-f0-9]{64}$/.test(error.projectSha256||'')
    :error.code==='INJECTED_STORAGE_FAILURE');
  await assert.rejects(()=>r.store.commitNativeProductResults(command),error=>{outcomeError=error;return expectedOutcomeError(error);},'TEST_IR_NATIVE_UNCERTAIN_OUTCOME_ORACLE '+name);
  if(name==='failure-after-commit'){
    assert.equal(expectedOutcomeError(r.runtime.__nativeAfterCommitError),false,'TEST_IR_NATIVE_COMMITTED_ERROR_SPECIFICITY_ORACLE raw-controlled-error');
    for(const [fault,patch]of [['wrong-wrapper',{code:'CONTROLLED_AFTER_COMMIT_FAILURE'}],['missing-wrapper',{code:undefined}],['not-committed',{committed:false}],['missing-committed',{committed:undefined}],['false-unchanged',{existingProjectsUnchanged:true}],['missing-unchanged',{existingProjectsUnchanged:undefined}],['missing-cause',{cause:undefined}],['substituted-cause',{cause:{code:'CONTROLLED_AFTER_COMMIT_FAILURE',message:'Injected notification failure after commit'}}],['wrong-job',{jobId:saved.job.JOB_ID+'-OTHER'}],['missing-job',{jobId:undefined}],['wrong-revision',{revision:saved.revision}],['missing-revision',{revision:undefined}],['malformed-digest',{projectSha256:'NOT_A_DIGEST'}],['missing-digest',{projectSha256:undefined}]])assert.equal(expectedOutcomeError({...outcomeError,...patch}),false,'TEST_IR_NATIVE_COMMITTED_ERROR_SPECIFICITY_ORACLE '+fault);
  }
  delete r.runtime.__nativeAfterCommitFault;delete r.runtime.__closedLoopStorageFault;delete r.runtime.__nativeRecoveryHookOnFault;const observed=await r.store.readProject(saved.job.JOB_ID);
  if(name==='failure-after-commit'){assert.equal(observed.projectData.deterministicResults.length,1);assert.equal(observed.revision,saved.revision+1);
    assert.equal(outcomeError.jobId,observed.job.JOB_ID,'TEST_IR_NATIVE_COMMITTED_JOB_ORACLE');assert.equal(outcomeError.revision,observed.revision,'TEST_IR_NATIVE_COMMITTED_REVISION_ORACLE');assert.equal(outcomeError.projectSha256,observed.projectSha256,'TEST_IR_NATIVE_COMMITTED_DIGEST_ORACLE');assert.equal(outcomeError.projectSha256,r.store.projectSha256(observed),'TEST_IR_NATIVE_COMMITTED_FRESH_DIGEST_ORACLE');delete r.runtime.__nativeAfterCommitError;
  }
  else{assert.equal(observed.projectData.deterministicResults.length,0);assert.equal(observed.revision,saved.revision+(name==='concurrent-change-after-failure'?1:0));if(name==='concurrent-change-after-failure')assert.equal(observed.activeView,'Records');}
  cases.push({name,unchangedNotClaimed:true,actualStoredOutcomeInspected:true,committedNativeResults:observed.projectData.deterministicResults.length});
 }
 return cases;
}

// Serialized into the existing browser-extra page. Accepted test/product rows
// are explicitly synthetic; execution, the native RPC and IndexedDB are real.
export async function verifyTestIrNativeBrowserCommand(makeFixture){
 const rt=globalThis.closedLoopTestRuntime,e=globalThis.closedLoopWorkflowEngine,store=globalThis.closedLoopProjectStore,h=globalThis.closedLoopHash;
 const require=(value,message)=>{if(!value)throw Error('NATIVE_BROWSER_COMMAND_ORACLE: '+message);},cases=[];
 const fields=['schema','testId','runtimeVersion','runtimeBuildIdentity','testWorkerSha256','workerProtocolVersion','testSpecVersion','testSpecSha256','normalizedDagSha256','testIrLanguageVersion','operationRegistryVersion','operationRegistrySha256','jsonSelectorRegistryVersion','jsonSelectorRegistrySha256','xmlSelectorRegistryVersion','xmlSelectorRegistrySha256','regexRegistryVersion','regexRegistrySha256','parserRegistryIdentities','executedStepIds','selectedResultStepId','selectedResultPort','startedAtDeviceTime','endedAtDeviceTime'];
 const scriptUrl=name=>new URL(Array.from(document.scripts).find(script=>new URL(script.src||location.href).pathname.endsWith('/'+name)).src),runtimeUrl=scriptUrl('test-runtime.js'),storeUrl=scriptUrl('project-store.js'),buildIdentity=runtimeUrl.searchParams.get('v'),workerSha256=runtimeUrl.searchParams.get('workerSha256');
 require(buildIdentity?.startsWith('build-sha256-')&&/^[a-f0-9]{64}$/.test(workerSha256||''),'requires the built manifested application');
 require(storeUrl.searchParams.get('v')===buildIdentity&&storeUrl.searchParams.get('workerSha256')===workerSha256,'store and runtime share the manifested worker identity');
 for(const stage of [22,24]){
  const {p,test,canonical}=makeFixture();p.activeStage=stage;
  for(const[key,value]of Object.entries({TEST_TYPE:stage===22?'DETERMINISTIC':'ADVERSARIAL',VERIFICATION_PHASE:stage===22?'FINAL_PRODUCT_DETERMINISTIC':'FINAL_PRODUCT_ADVERSARIAL',EARLIEST_EXECUTABLE_STAGE:stage,REQUIRED_BY_STAGE:stage})){test.fields[key]=test[key]=value;}e.refreshRecordHashes(test,'tests');
  let nativeRequests=0,storeCommands=0,replacementRequests=0;const original=Worker.prototype.postMessage;
  Worker.prototype.postMessage=function(message,...rest){if(message.type==='EXECUTE_TEST_IR')nativeRequests++;if(message.method==='COMMIT_NATIVE_PRODUCT_RESULTS')storeCommands++;if(message.method==='WRITE_PROJECT')replacementRequests++;return original.call(this,message,...rest);};
  try{
   const saved=await store.writeProject(p,{createOnly:true,expectedProjectRevision:0,incrementRevision:false,selectProject:false}),loadedTest=saved.projectData.tests.find(row=>row.id===test.id),rawDefinition=JSON.stringify(loadedTest.fields.EXECUTABLE_SPEC),result=await rt.executeTest(loadedTest,{}, {JOB:canonical});
   require(result.status==='COMPLETE'&&result.determination==='SATISFIED','actual test worker returns the literal expected project identity');
   require(result.runtimeBuildIdentity===buildIdentity&&result.testWorkerSha256===workerSha256&&result.workerProtocolVersion==='closed-loop-test-worker-protocol/1','actual worker identity matches the built artifact');
   const committed=await store.commitNativeProductResults({jobId:saved.job.JOB_ID,stage,results:[{testId:loadedTest.id,runtimeResult:result,inputArtifacts:[]}],expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256}),reloaded=await store.readProject(saved.job.JOB_ID),family=stage===22?'deterministicResults':'adversarialResults',row=reloaded.projectData[family][0],currentTest=reloaded.projectData.tests.find(item=>item.id===loadedTest.id);
   require(nativeRequests===1&&storeCommands===1,'one actual worker execution and one bounded store-worker command');require(reloaded.projectSha256===committed.projectSha256&&reloaded.revision===committed.revision&&reloaded.projectData[family].length===1,'atomic command survives IndexedDB reload');
   const evidence=reloaded.projectData.evidenceRecords.find(item=>row.evidenceRefs.includes(item.id)),payload=JSON.parse(e.recordValue(evidence,'APPLICATION_EVIDENCE_CONTENT')),identity=payload.nativeExecutionIdentity;
   require(JSON.stringify(Object.keys(identity).sort())===JSON.stringify(fields.slice().sort()),'complete closed 24-field native identity is retained');require(identity.runtimeBuildIdentity===buildIdentity&&identity.testWorkerSha256===workerSha256&&identity.testSpecSha256===loadedTest.fields.EXECUTABLE_SPEC_SHA256,'saved receipt binds exact executable and loaded runtime');
   require(e.applicationNativeResultCurrent(reloaded,family,row,currentTest)&&e.effectiveDetermination(family,row,currentTest,reloaded)==='SATISFIED','saved application proof is current');require(JSON.stringify(currentTest.fields.EXECUTABLE_SPEC)===rawDefinition,'raw accepted definition preserved');require(store.validateProjectIntegrity(reloaded).valid,'reloaded canonical integrity');
   let mutationConfirmation;
   if(stage===22){
    const replacement=structuredClone(reloaded),retired=replacement.projectData[family].find(item=>item.id===row.id);
    retired.active=false;retired.validity='INVALIDATED';retired.invalidatedBy='SYNTHETIC_OPERATOR_CORRECTION';e.refreshRecordHashes(retired,family);
    const expectedImpact=store.mutationImpact(reloaded,replacement),requestsBefore=replacementRequests;
    require(expectedImpact.requiresConfirmation&&expectedImpact.affected.some(item=>item.stage===22&&item.work.some(work=>work.kind===family&&work.id===row.id)),'retiring accepted native work requires the public current mutation impact');
    let rejection;try{await store.replaceProject(replacement,{expectedProjectRevision:reloaded.revision,expectedStateSha256:reloaded.projectSha256});}catch(error){rejection=error;}
    require(replacementRequests===requestsBefore+1,'generic replacement crosses the actual storage-worker RPC');
    require(rejection?.code==='MUTATION_CONFIRMATION_REQUIRED','generic replacement remains blocked pending operator confirmation');
    require(rejection.impact&&h.stableStringify(rejection.impact)===h.stableStringify(expectedImpact),'worker rejection preserves the exact current mutation impact');
    const unchanged=await store.readProject(reloaded.job.JOB_ID);
    require(unchanged.projectSha256===reloaded.projectSha256&&unchanged.revision===reloaded.revision,'unconfirmed replacement preserves the saved digest and revision');
    require(e.applicationNativeResultCurrent(unchanged,family,unchanged.projectData[family].find(item=>item.id===row.id),unchanged.projectData.tests.find(item=>item.id===loadedTest.id)),'unconfirmed replacement retains the committed native proof');
    mutationConfirmation={code:rejection.code,actualStorageWorker:true,exactCurrentImpact:true,savedDigestUnchanged:true,savedRevisionUnchanged:true,committedProofRetained:true};
   }
   cases.push({stage,nativeRequests,storeCommands,actualTestWorker:true,actualStorageWorker:true,actualIndexedDB:true,committedAndReloaded:true,completeIdentityRetained:true,current:true,rawDefinitionPreserved:true,canonicalIntegrity:true,projectSha256:reloaded.projectSha256,identitySha256:h.sha256Value(identity),fullStageCompletionClaimed:false,...(mutationConfirmation?{mutationConfirmation}:{})});
  }finally{Worker.prototype.postMessage=original;await store.removeProject(p.job.JOB_ID);}
 }
 return {checkId:'test-ir.native-browser-command',passed:true,synthetic:true,actualBrowser:true,buildIdentity,testWorkerSha256:workerSha256,cases,boundary:'Synthetic accepted test/product setup; real built TestIR worker → bounded native store-worker RPC → IndexedDB commit/reload → native currentness. No earlier-stage or full-stage completion claim.'};
}

// These independent expectations describe the recorded subset only. The total
// remains UNKNOWN even for a genuine event; no new stage or release proof.
export function verifyRecordedTestExecutionMetricControls({r,project,resultId}){
 const e=r.engine,copy=value=>r.copy(value),cases=[];
 const check=(caseId,p,nativeCount,externalCount=0)=>{
  const metrics=e.operationalMetrics(p);
  for(const [kind,expected]of [['native',nativeCount],['external',externalCount]]){
   const scalar=metrics[kind+'TestExecutions'],m=metrics[kind+'TestExecutionsMetric'];
   assert.equal(scalar,null,'RECORDED_EXECUTION_TOTAL_UNKNOWN_ORACLE:'+caseId+':'+kind);assert(m,'RECORDED_EXECUTION_CARRIER_ORACLE:'+caseId+':'+kind);
   assert.equal(m.disposition,'UNKNOWN');assert.equal(m.value,null);assert.equal(m.denominator,null);
   assert.equal(m.recordedValue,expected,'RECORDED_EXECUTION_SUBSET_ORACLE:'+caseId+':'+kind);assert.equal(m.numerator,expected);assert.equal(m.includedIds.length,expected);assert.equal(new Set(m.includedIds).size,expected);assert.equal(m.recordedEvents.length,expected);assert(/^[a-f0-9]{64}$/.test(m.scopeHash));
   assert.equal(m.includedIds.some(id=>m.unknownIds.some(row=>row.id===id)||m.excludedIds.some(row=>row.id===id)),false);
   assert(m.completenessReasons.includes('COMPLETE_ATTEMPT_HISTORY_NOT_ESTABLISHED'));assert(m.scopeLimit.includes('not a total attempt count'));
  }
  cases.push({caseId,nativeRecorded:nativeCount,externalRecorded:externalCount,totalValue:null,disposition:'UNKNOWN',passed:true});return metrics;
 };
 const observed=check('actual-native-recorded-subset',project,1);assert.deepEqual(Array.from(observed.nativeTestExecutionsMetric.includedIds),['deterministicResults:'+resultId]);assert.equal(observed.nativeTestExecutionsMetric.recordedEvents[0].epistemicBasis,'APPLICATION_RECORDED_EXECUTION_EVENT');
 const untouched=JSON.stringify(project);e.operationalMetrics(project);assert.equal(JSON.stringify(project),untouched,'RECORDED_EXECUTION_NONMUTATING_ORACLE');cases.push({caseId:'repeated-reading-does-not-create-event',passed:true});
 const edits=[
  ['missing-native-event',p=>p.projectData.history=p.projectData.history.filter(row=>row.type!=='APPLICATION_TEST_EXECUTED')],
  ['duplicate-native-event',p=>p.projectData.history.push(copy(p.projectData.history.find(row=>row.type==='APPLICATION_TEST_EXECUTED')))],
  ['wrong-event-test',p=>p.projectData.history.find(row=>row.type==='APPLICATION_TEST_EXECUTED').testId='WRONG'],
  ['wrong-event-result',p=>p.projectData.history.find(row=>row.type==='APPLICATION_TEST_EXECUTED').determination='VIOLATED'],
  ['missing-evidence',p=>p.projectData.evidenceRecords=[]],
  ['duplicate-result',p=>p.projectData.deterministicResults.push(copy(p.projectData.deterministicResults[0]))],
  ['duplicate-evidence',p=>p.projectData.evidenceRecords.push(copy(p.projectData.evidenceRecords[0]))],
  ['changed-record-bytes',p=>p.projectData.deterministicResults[0].fields.TEST_ID='WRONG'],
  ['wrong-project',p=>{const row=p.projectData.deterministicResults[0];row.jobId='OTHER';e.refreshRecordHashes(row,'deterministicResults');}],
  ['forged-owner-label',p=>{const row=p.projectData.deterministicResults[0];row.source='AGENT_RESPONSE';e.refreshRecordHashes(row,'deterministicResults');}],
  ['missing-evidence-link',p=>{const row=p.projectData.deterministicResults[0];row.evidenceRefs=[];e.refreshRecordHashes(row,'deterministicResults');}],
  ['wrong-native-identity-digest',p=>{const row=p.projectData.deterministicResults[0];row.nativeExecutionIdentitySha256='0'.repeat(64);e.refreshRecordHashes(row,'deterministicResults');}],
  ['missing-result-retains-unknown-event',p=>p.projectData.deterministicResults=[]]
 ];
 for(const[name,edit]of edits){const p=copy(project);edit(p);const m=check(name,p,0);assert.notEqual(m.nativeTestExecutionsMetric.scopeHash,observed.nativeTestExecutionsMetric.scopeHash,'RECORDED_EXECUTION_MATERIAL_SCOPE_ORACLE:'+name);}
 const historical=copy(project),test=historical.projectData.tests[0];test.fields.EXECUTABLE_SPEC.steps[1].value='CHANGED';e.refreshRecordHashes(test,'tests');check('changed-current-definition-does-not-erase-recorded-history',historical,1);
 const empty=r.core.createBlankState('RECORDED-METRICS-EMPTY');e.ensureShape(empty);check('empty-is-unknown',empty,0);
 const unexecuted=copy(project);unexecuted.projectData.deterministicResults=[];unexecuted.projectData.evidenceRecords=[];unexecuted.projectData.observationRecords=[];unexecuted.projectData.history=unexecuted.projectData.history.filter(row=>row.type!=='APPLICATION_TEST_EXECUTED');check('test-and-product-reservation-are-not-execution',unexecuted,0);
 const external=copy(unexecuted),row=copy(project.projectData.deterministicResults[0]);row.source='AGENT_RESPONSE';row.rawResponseId='CLAIMED-RAW';row.sourceProposalId='CLAIMED-PROPOSAL';e.refreshRecordHashes(row,'deterministicResults');external.projectData.deterministicResults.push(row);external.projectData.evidenceRecords=copy(project.projectData.evidenceRecords);check('external-result-label-is-not-execution',external,0);
 check('restored-valid-control',project,1);
 return {status:'PASS',cases,synthetic:true,actualNativeWorker:true,actualExternalActor:false,actualBrowser:false,fullClauseProof:false,boundary:'Actual ordinary native worker/result reused; isolated metric projection faults and explicit UNKNOWN total. No attempt-universe completeness or external event proof.'};
}
export function assertRecordedNativeMetric(project,engine,{recordedValue,retainedResults,caseId}){
 const metrics=engine.operationalMetrics(project),m=metrics.nativeTestExecutionsMetric;
 assert.equal(metrics.nativeTestExecutions,null,'RECORDED_NATIVE_TOTAL_UNKNOWN_ORACLE:'+caseId);assert.equal(m.value,null);assert.equal(m.disposition,'UNKNOWN');assert.equal(m.recordedValue,recordedValue,'RECORDED_NATIVE_OUTCOME_ORACLE:'+caseId);assert.equal(m.retainedResultEventIds.length,retainedResults,'RECORDED_NATIVE_RETAINED_RESULT_ORACLE:'+caseId);
 return {caseId,recordedValue,retainedResults,totalValue:null,disposition:'UNKNOWN',passed:true};
}

// §42 exact native-input identity, with §22.2–22.4's separated artifact bytes
// and canonical values. Accepted test/product rows are disclosed synthetic
// setup; this exercises the actual input loader, worker, command and adapter.
export async function verifyNativeInputRuntimeRecording({sourceOverrides={}}={}){
 const paths=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','test-worker.js'];
 sourceOverrides=Object.fromEntries(paths.map(path=>[path,sourceOverrides[path]??fs.readFileSync(new URL(path,import.meta.url),'utf8')]));
 const r=projectStoreRuntime({sourceOverrides,environment:testIrManifestedEnvironment(sourceOverrides),storageWorker:false}),e=r.engine,h=r.runtime.closedLoopHash,rt=r.runtime.closedLoopTestRuntime;
 vm.runInContext(routingFixture.toString()+';globalThis.identityFixture=routingFixture;',r.runtime);
 const {p,test,product}=r.runtime.identityFixture(),cases=[];
 const expectedRuntimeVersion='closed-loop-test-runtime/2';
 const files=[{binding:'TEXT',filename:'native-utf8.txt',mediaType:'text/plain',bytes:new TextEncoder().encode('Exact UTF-8: café 🧪\r\n')},{binding:'BINARY',filename:'native-binary.bin',mediaType:'application/octet-stream',bytes:Uint8Array.from([0,255,128,13,10,1,0])}];
 for(const file of files){
  file.sha256=createHash('sha256').update(file.bytes).digest('hex');file.artifactId=e.allocateId(p,'artifacts');file.byteSize=file.bytes.byteLength;
  await r.store.putArtifact({artifactId:file.artifactId,jobId:p.job.JOB_ID,blob:new Blob([file.bytes],{type:file.mediaType}),filename:file.filename,mediaType:file.mediaType,expectedSha256:file.sha256});
  e.registerArtifactBytes(p,r.copy({stage:21,artifactId:file.artifactId,filename:file.filename,mediaType:file.mediaType,byteSize:file.byteSize,sha256:file.sha256,lineage:{productId:product.id}}));
 }
 const canonicalSha256=createHash('sha256').update(JSON.stringify(p.job.JOB_ID),'utf8').digest('hex');
 const bindings={JOB:{kind:'CANONICAL_VALUE',canonicalKey:'JOB.JOB_ID',valueSha256:canonicalSha256}};
 for(const file of files)bindings[file.binding]={kind:'ARTIFACT',artifactId:file.artifactId,expectedSha256:file.sha256};
 const steps=[],add=(op,inputs)=>{const stepId='S'+String(steps.length+1).padStart(3,'0');steps.push({stepId,op,inputs});return stepId;};
 for(const file of files){const loaded=add('LOAD_ARTIFACT',{binding:{bindingRef:file.binding}}),read=add('READ_BYTES',{artifact:{stepRef:loaded,output:'artifact'}}),digest=add('HASH_SHA256',{bytes:{stepRef:read,output:'bytes'}});add('ASSERT_EQ',{actual:{stepRef:digest,output:'sha256'},expected:{literal:file.sha256}});}
 const job=add('LOAD_ARTIFACT',{binding:{bindingRef:'JOB'}}),last=add('ASSERT_EQ',{actual:{stepRef:job,output:'artifact'},expected:{literal:p.job.JOB_ID}});
 const spec={version:'closed-loop-test-spec/1',languageVersion:'closed-loop-test-ir-language/1',operationRegistryVersion:'closed-loop-test-ir-operations/1',operationRegistrySha256:'aea1efab8e1c342d550653238ef2740bd625c2ec5bbadb0dbaf76fcd1034492d',steps,result:{stepRef:last,output:'assertion'}};
 for(const [key,value]of Object.entries({EXECUTABLE_SPEC:spec,EXECUTABLE_SPEC_SHA256:h.sha256Value(r.copy(spec)),EXECUTABLE_INPUT_BINDINGS:bindings,ARTIFACT_REQUIREMENTS:'Exact registered UTF-8 and binary artifacts.'}))test.fields[key]=test[key]=r.copy(value);
 e.refreshRecordHashes(test,'tests');
 // Extract the existing normal input owner, without executing an app UI shell
 // or substituting a hand-built native input transport.
 const app=sourceOverrides['app-core.js'],start=app.indexOf('async function nativeTestInputs('),end=app.indexOf('async function runNativeStage22Tests(',start);
 assert(start>=0&&end>start,'NATIVE_INPUT_LOADER_SOURCE_ANCHOR');
 Object.assign(r.runtime,{engine:e,projectStore:r.store,clone:r.copy});vm.runInContext(app.slice(start,end),r.runtime,{filename:'app-core.js:nativeTestInputs'});
 let saved=await r.store.writeProject(p,{createOnly:true,expectedProjectRevision:0,incrementRevision:false});
 const loaded=await r.runtime.nativeTestInputs(saved.projectData.tests.find(row=>row.id===test.id),saved);
 const expectedArtifacts=files.map(({artifactId,filename,byteSize,sha256})=>({artifactId,filename,byteSize,sha256}));
 assert.deepEqual(r.copy(loaded.identities).sort((a,b)=>a.artifactId.localeCompare(b.artifactId)),r.copy(expectedArtifacts).sort((a,b)=>a.artifactId.localeCompare(b.artifactId)),'NATIVE_INPUT_LOADER_EXACT_IDENTITIES_ORACLE');
 for(const file of files)assert.deepEqual(Array.from(loaded.artifactPayload[file.binding].bytes),Array.from(file.bytes),'NATIVE_INPUT_LOADER_EXACT_BYTES_ORACLE '+file.binding);
 assert.deepEqual(r.copy(loaded.canonicalPayload),r.copy({JOB:{canonicalKey:'JOB.JOB_ID',value:p.job.JOB_ID,valueSha256:canonicalSha256}}),'NATIVE_INPUT_CANONICAL_SEPARATION_ORACLE');
 cases.push({name:'normal-loader-heterogeneous-bytes-and-canonical-value',status:'PASS'});
 // Corrupt only the private adapter's persisted bytes, retain declared metadata,
 // and require the normal loader to reject the exact same-size corruption.
 const storageRows=r.rows.get('meta'),bodies=[...storageRows].filter(([,row])=>row.value?.sha256===files[0].sha256&&row.value?.blob instanceof Blob);
 assert.equal(bodies.length,1,'NATIVE_INPUT_STORED_BODY_FAULT_ANCHOR');const [bodyKey,original]=bodies[0],changed=Uint8Array.from(files[0].bytes);changed[0]^=1;
 storageRows.set(bodyKey,{...original,value:{...original.value,blob:new Blob([changed],{type:files[0].mediaType})}});
 try{await assert.rejects(()=>r.runtime.nativeTestInputs(saved.projectData.tests[0],saved),error=>error.message.includes('no longer match canonical identity'),'NATIVE_INPUT_CHANGED_STORED_BYTES_ORACLE');}finally{storageRows.set(bodyKey,original);}
 cases.push({name:'same-size-changed-stored-bytes-rejected-before-execution',status:'PASS'});
 const outcome=r.copy(await rt.executeTest(saved.projectData.tests[0],loaded.artifactPayload,loaded.canonicalPayload,{Worker:isolatedVerifierWorkerClass()}));
 assert.equal(outcome.status,'COMPLETE');assert.equal(outcome.determination,'SATISFIED');
 assert.equal(outcome.inputArtifactIds.length,2,'NATIVE_INPUT_RUNTIME_IDS_ORACLE');assert.equal(outcome.inputArtifactSha256Values.length,2,'NATIVE_INPUT_RUNTIME_HASH_COUNT_ORACLE');
 assert.deepEqual(JSON.parse(JSON.stringify(outcome.inputArtifactIds.map((artifactId,index)=>({artifactId,sha256:outcome.inputArtifactSha256Values[index]})))).sort((a,b)=>a.artifactId.localeCompare(b.artifactId)),files.map(({artifactId,sha256})=>({artifactId,sha256})).sort((a,b)=>a.artifactId.localeCompare(b.artifactId)),'NATIVE_INPUT_RUNTIME_HASHES_ORACLE');
 assert.deepEqual(r.copy(outcome.inputCanonicalIdentities),r.copy([{bindingName:'JOB',canonicalKey:'JOB.JOB_ID',valueSha256:canonicalSha256}]),'NATIVE_INPUT_RUNTIME_CANONICAL_ORACLE');
 assert.equal(outcome.runtimeVersion,expectedRuntimeVersion,'NATIVE_INPUT_RUNTIME_VERSION_ORACLE');assert.equal(outcome.executorVersion,expectedRuntimeVersion);
 cases.push({name:'isolated-worker-exact-byte-digests-and-runtime-version',status:'PASS'});
 const command=r.copy({jobId:saved.job.JOB_ID,stage:22,results:[{testId:test.id,runtimeResult:outcome,inputArtifacts:expectedArtifacts}],expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
 const unchanged=h.sha256Value(saved);
 const negatives=[
  ['missing-artifact-digest',row=>row.runtimeResult.inputArtifactSha256Values.pop(),/^Native execution receipt does not match the exact current test, executable specification, and input bytes\.$/],
  ['changed-artifact-digest',row=>row.runtimeResult.inputArtifactSha256Values[0]='0'.repeat(64),/^Native execution receipt does not match the exact current test, executable specification, and input bytes\.$/],
  ['swapped-artifact-identities',row=>row.runtimeResult.inputArtifactIds.reverse(),/^Native execution receipt does not match the exact current test, executable specification, and input bytes\.$/],
  ['canonical-value-misrepresented-as-artifact',row=>{row.runtimeResult.inputArtifactIds.push('JOB.JOB_ID');row.runtimeResult.inputArtifactSha256Values.push(canonicalSha256);},/^Native execution receipt does not match the exact current test, executable specification, and input bytes\.$/],
  ['missing-canonical-identity',row=>row.runtimeResult.inputCanonicalIdentities=[],/exact current test and canonical input identities/i],
  ['wrong-input-byte-size',row=>row.inputArtifacts[0].byteSize++,/not application-verified current bytes/i],
  ['missing-runtime-version',row=>delete row.runtimeResult.runtimeVersion,null],
  ['wrong-runtime-version',row=>row.runtimeResult.runtimeVersion='closed-loop-test-runtime/UNREGISTERED',null]
 ];
 for(const[name,mutate,message]of negatives){const bad=r.copy(command);mutate(bad.results[0]);await assert.rejects(()=>r.store.commitNativeProductResults(bad),error=>message?message.test(error.message):error.code==='INVALID_NATIVE_EXECUTION_IDENTITY','NATIVE_INPUT_COMMAND_REJECTS_ORACLE '+name);assert.equal(h.sha256Value(await r.store.readProject(saved.job.JOB_ID)),unchanged,'NATIVE_INPUT_COMMAND_PRESERVES_STATE_ORACLE '+name);cases.push({name,status:'PASS'});}
 saved=await r.store.commitNativeProductResults(command);saved=await r.store.readProject(saved.job.JOB_ID);
 const result=saved.projectData.deterministicResults.find(row=>row.fields.TEST_ID===test.id),evidence=saved.projectData.evidenceRecords.find(row=>result.evidenceRefs.includes(row.id)),payload=JSON.parse(e.recordValue(evidence,'APPLICATION_EVIDENCE_CONTENT'));
 assertNativeInputRecording({record:result,payload,expectedArtifacts,canonicalSha256,expectedRuntimeVersion});
 assert.equal(e.applicationNativeResultCurrent(saved,'deterministicResults',result,saved.projectData.tests[0]),true);
 for(const file of files){const stored=await r.store.getArtifact(file.artifactId);assert.equal(createHash('sha256').update(new Uint8Array(await stored.blob.arrayBuffer())).digest('hex'),file.sha256,'NATIVE_INPUT_SAVED_BYTES_ORACLE');}
 cases.push({name:'dedicated-command-record-and-reload-exact-inputs-and-runtime',status:'PASS'});
 for(const[name,mutate]of [['changed-current-artifact-hash',project=>{const row=project.projectData.artifacts.find(item=>item.id===files[0].artifactId);row.fields.SHA256=row.SHA256='0'.repeat(64);e.refreshRecordHashes(row,'artifacts');}],['changed-current-canonical-value',project=>project.job.JOB_ID+='-CHANGED']]){const altered=r.copy(saved);mutate(altered);assert.equal(e.applicationNativeResultCurrent(altered,'deterministicResults',altered.projectData.deterministicResults.find(row=>row.id===result.id),altered.projectData.tests[0]),false,'NATIVE_INPUT_CURRENTNESS_ORACLE '+name);cases.push({name,status:'PASS'});}
 // Detect the intended missing/misattributed recorded fields independently of
 // runtime validation; these are oracle controls, not claims of shipped bugs.
 const reordered=JSON.parse(JSON.stringify({record:result,payload,expectedArtifacts,canonicalSha256,expectedRuntimeVersion}));reordered.payload.inputArtifacts.reverse();reordered.record.fields.INPUT_ARTIFACT_IDENTITIES=JSON.stringify(reordered.payload.inputArtifacts);assertNativeInputRecording(reordered);
 const oracleFaults=[];
 for(const[name,mutate]of [['missing-recorded-artifacts',row=>{row.payload.inputArtifacts=[];row.record.fields.INPUT_ARTIFACT_IDENTITIES='[]';}],['swapped-recorded-hashes',row=>{[row.payload.inputArtifacts[0].sha256,row.payload.inputArtifacts[1].sha256]=[row.payload.inputArtifacts[1].sha256,row.payload.inputArtifacts[0].sha256];row.record.fields.INPUT_ARTIFACT_IDENTITIES=JSON.stringify(row.payload.inputArtifacts);}],['wrong-recorded-runtime',row=>{row.payload.runtimeVersion='WRONG';row.record.fields.RUNTIME_VERSION='WRONG';}],['canonical-hash-substituted-for-bytes',row=>{row.payload.inputArtifacts[0].sha256=canonicalSha256;row.record.fields.INPUT_ARTIFACT_IDENTITIES=JSON.stringify(row.payload.inputArtifacts);}]] ){
  const altered=JSON.parse(JSON.stringify({record:result,payload,expectedArtifacts,canonicalSha256,expectedRuntimeVersion}));mutate(altered);const oracle=name==='wrong-recorded-runtime'?'NATIVE_INPUT_RECORDED_VERSION_ORACLE':'NATIVE_INPUT_RECORDED_IDENTITIES_ORACLE';assert.throws(()=>assertNativeInputRecording(altered),error=>error.code==='ERR_ASSERTION'&&error.message.split('\n')[0]===oracle,'NATIVE_INPUT_RECORDING_DETECTING_ORACLE '+name);oracleFaults.push({name,oracle,intendedAssertionDetected:true});
 }
 return {passed:true,checkId:'test-ir.native-input-runtime-recording',cases,oracleFaults,orderEquivalentIdentityListsAccepted:true,artifactKinds:['UTF8_MULTIBYTE_CRLF','BINARY_NUL_HIGH_BYTES'],artifactCount:2,canonicalValueCount:1,actualIsolatedWorker:true,actualInputLoader:true,actualDedicatedCommand:true,actualStorageAdapter:true,actualBrowser:false,actualStorageWorker:false,syntheticAcceptedTestAndProduct:true,fullStageCompletionClaimed:false,sourceSha256:Object.fromEntries(paths.map(path=>[path,createHash('sha256').update(sourceOverrides[path]).digest('hex')])),boundary:'Synthetic accepted test/product; actual nativeTestInputs stored-byte verification → isolated production worker → dedicated command → Map transaction adapter cold read; no native IndexedDB, reviewed Stage06 journey, or whole-clause release proof.'};
}
function assertNativeInputRecording({record,payload,expectedArtifacts,canonicalSha256,expectedRuntimeVersion}){
 const sorted=items=>JSON.parse(JSON.stringify(items)).sort((a,b)=>a.artifactId.localeCompare(b.artifactId));
 assert.deepEqual(sorted(JSON.parse(record.fields.INPUT_ARTIFACT_IDENTITIES)),sorted(expectedArtifacts),'NATIVE_INPUT_RECORDED_IDENTITIES_ORACLE');
 assert.deepEqual(sorted(payload.inputArtifacts),sorted(expectedArtifacts),'NATIVE_INPUT_EVIDENCE_IDENTITIES_ORACLE');
 assert.deepEqual(JSON.parse(JSON.stringify(payload.inputCanonicalIdentities)),[{bindingName:'JOB',canonicalKey:'JOB.JOB_ID',valueSha256:canonicalSha256}],'NATIVE_INPUT_RECORDED_CANONICAL_ORACLE');
 assert.equal(record.fields.RUNTIME_VERSION,expectedRuntimeVersion,'NATIVE_INPUT_RECORDED_VERSION_ORACLE');assert.equal(payload.runtimeVersion,expectedRuntimeVersion,'NATIVE_INPUT_EVIDENCE_VERSION_ORACLE');assert.equal(payload.nativeExecutionIdentity.runtimeVersion,expectedRuntimeVersion,'NATIVE_INPUT_IDENTITY_VERSION_ORACLE');
}

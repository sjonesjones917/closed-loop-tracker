import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {readStoreArchive} from './test-zip.mjs';
import {responseFixture} from './operator-journey-fixtures.mjs';
import {execFileSync} from 'node:child_process';
import {projectStoreRuntime,captureArtifactFixture,restoreArtifactFixture,hydrateRetainedPromptContexts,bindAcceptanceUi} from './test-project-store-runtime.mjs';
import {appMarkup} from './test-app-markup.mjs';
import {isolatedVerifierWorkerClass} from './verifier-runtime.mjs';
import {recordProposal,canonicalFixtureRecord,reviewProofFixture} from './test-fixtures.mjs';

// Small synthetic canonical fixtures isolate timing logic. The full-cycle gate
// separately creates the required reviewed work through production operations.
const results=[];
function runtime(overrides={}){return projectStoreRuntime({sourceOverrides:overrides});}
function scalarCases(r){
 const s=r.runtime.closedLoopWorkflowSchema,e=r.engine,p=r.core.createBlankState('JOB-TIMING-SCALARS');e.ensureShape(p);
 const fields=recordProposal(s,'tests').fields,cases=[];
 const check=(name,changes,expectedValid)=>{const declaration={...fields,...changes},actual=e.testDueState(p,{fields:declaration},s.STAGE_COUNT);cases.push({name,expectedValid,actualValid:actual.valid,dueNow:actual.dueNow,reasons:[...actual.reasons]});assert.equal(actual.valid,expectedValid,'TIMING_SCALAR_ORACLE: '+name);if(!expectedValid)assert.equal(actual.dueNow,false,'TIMING_SCALAR_ORACLE: malformed timing authorized execution.');};
 check('valid integer declaration',{},true);
 for(const field of ['EARLIEST_EXECUTABLE_STAGE','REQUIRED_BY_STAGE'])for(const [label,value] of [['numeric string','12'],['boolean',true],['array',[12]],['null',null],['missing',undefined],['fraction',12.5],['zero',0],['negative',-1],['beyond final stage',s.STAGE_COUNT+1]])check(field+': '+label,{[field]:value},false);
 for(const field of ['PER_RUN_REQUIRED','FINAL_PRODUCT_REQUIRED','DELIVERY_REQUIRED'])for(const [label,value] of [['string','true'],['number',1],['array',[]],['null',null],['missing',undefined]])check(field+': '+label,{[field]:value},false);
 check('deadline precedes earliest',{EARLIEST_EXECUTABLE_STAGE:13,REQUIRED_BY_STAGE:12},false);
 check('first stage non-run boundary',{EARLIEST_EXECUTABLE_STAGE:1,REQUIRED_BY_STAGE:1,PER_RUN_REQUIRED:false},true);
 check('per-run before run creation',{EARLIEST_EXECUTABLE_STAGE:1,REQUIRED_BY_STAGE:1},false);
 check('final stage boundary',{EARLIEST_EXECUTABLE_STAGE:s.STAGE_COUNT,REQUIRED_BY_STAGE:s.STAGE_COUNT},true);
 for(const phase of s.VERIFICATION_PHASE_VALUES){const perRun=phase==='PREPRODUCT_ITERATION',finalProduct=phase.startsWith('FINAL_');check('declared phase '+phase,{VERIFICATION_PHASE:phase,EARLIEST_EXECUTABLE_STAGE:s.STAGE_COUNT,REQUIRED_BY_STAGE:s.STAGE_COUNT,PER_RUN_REQUIRED:perRun,FINAL_PRODUCT_REQUIRED:finalProduct,DELIVERY_REQUIRED:!perRun&&!finalProduct},true);}
 results.push({case:'TIMING_SCALAR_CONTRACT',cases});
}
function conditions(r){
 const s=r.runtime.closedLoopWorkflowSchema,valid=[{type:'PHASE_TARGET'},{type:'CURRENT_RECORD',family:'requirements',recordId:'REQ-CANONICAL'},{type:'VERIFIED_ARTIFACT_BYTES',artifactId:'ART-CANONICAL'}];
 for(const type of ['ALL_OF','ANY_OF','AT_LEAST_K'])valid.push({type,...(type==='AT_LEAST_K'?{k:1}:{}),children:[{type:'PHASE_TARGET'}]});
 for(const condition of valid)assert.equal(s.validateTargetAvailabilityCondition(r.copy(condition)).valid,true,'CONDITION_GRAMMAR_ORACLE: declared form rejected.');
 const invalid=[{__UNREGISTERED_TARGET_CONDITION__:true},{phaseTarget:true},{currentCandidate:true},{type:'PHASE_TARGET',extra:true},{type:'phase_target'},{type:'CURRENT_RECORD',family:'unregistered',recordId:'X'},{type:'CURRENT_RECORD',family:'requirements',recordId:1},{type:'VERIFIED_ARTIFACT_BYTES',artifactId:{recordId:'X'}},{type:'ALL_OF',children:[]},{type:'ANY_OF',children:['PHASE_TARGET']},{type:'AT_LEAST_K',k:'1',children:[{type:'PHASE_TARGET'}]},{type:'AT_LEAST_K',k:2,children:[{type:'PHASE_TARGET'}]}];
 for(const condition of invalid)assert.equal(s.validateTargetAvailabilityCondition(r.copy(condition)).valid,false,'CONDITION_GRAMMAR_ORACLE: unregistered or coerced condition accepted: '+JSON.stringify(condition));
 const cycle={type:'ALL_OF',children:[]};cycle.children.push(cycle);assert.equal(s.validateTargetAvailabilityCondition(cycle).valid,false);
 results.push({case:'CLOSED_TARGET_CONDITION',accepted:valid,rejected:invalid,cycleRejected:true});
}
function canonical(r,p,family,fields,scope={}){return canonicalFixtureRecord({engine:r.engine,schema:r.runtime.closedLoopWorkflowSchema},p,family,fields,{scope});}
async function availability(r){
 const e=r.engine,s=r.runtime.closedLoopWorkflowSchema,h=r.runtime.closedLoopHash,p=r.core.createBlankState('JOB-TIMING-TARGETS');e.ensureShape(p);const timing={...recordProposal(s,'tests').fields,PER_RUN_REQUIRED:false};
 const req=canonical(r,p,'requirements',{STATUS:'ACTIVE'}),id=e.recordId(req,'requirements'),present={type:'CURRENT_RECORD',family:'requirements',recordId:id},absent={type:'CURRENT_RECORD',family:'requirements',recordId:'REQ-UNRESOLVED'};
 assert.equal(e.evaluateTargetAvailabilityCondition(p,r.copy(present),timing),'TRUE');assert.equal(e.evaluateTargetAvailabilityCondition(p,r.copy(absent),timing),'UNKNOWN');
 req.active=false;e.refreshRecordHashes(req,'requirements');assert.equal(e.evaluateTargetAvailabilityCondition(p,r.copy(present),timing),'FALSE');req.active=true;e.refreshRecordHashes(req,'requirements');
 const wrong=r.engine.clone(p),wrongReq=wrong.projectData.requirements[0];wrongReq.scope.inputVersion='FOREIGN';e.refreshRecordHashes(wrongReq,'requirements');assert.equal(e.evaluateTargetAvailabilityCondition(wrong,r.copy(present),timing),'FALSE');
 const falseRecord=canonical(r,p,'requirements',{STATUS:'RETIRED'}),no={type:'CURRENT_RECORD',family:'requirements',recordId:falseRecord.id};
 const truthCases=[['ALL_OF',[present,absent],'UNKNOWN'],['ALL_OF',[no,absent],'FALSE'],['ANY_OF',[present,absent],'TRUE'],['ANY_OF',[no,absent],'UNKNOWN'],['AT_LEAST_K',[present,no,absent],'UNKNOWN',2],['AT_LEAST_K',[present,no,no],'FALSE',2],['AT_LEAST_K',[present,present,absent],'TRUE',2]];
 for(const [type,children,expected,k] of truthCases)assert.equal(e.evaluateTargetAvailabilityCondition(p,r.copy({type,children,...(k?{k}:{})}),timing),expected,'THREE_VALUED_CONDITION_ORACLE');
 const raw=new Blob(['bounded exact bytes']),digest=await h.sha256Bytes(raw),artifactId=e.allocateId(p,'artifacts',r.copy({payload:{purpose:'TIMING_BYTES'}}));
 e.registerArtifactBytes(p,r.copy({stage:1,artifactId,filename:'timing.txt',mediaType:'text/plain',byteSize:raw.size,sha256:digest}));
 const byteCondition=r.copy({type:'VERIFIED_ARTIFACT_BYTES',artifactId});assert.equal(e.evaluateTargetAvailabilityCondition(p,byteCondition,timing),'UNKNOWN','CUSTODY_ORACLE: metadata alone proved bytes.');
 await r.store.putArtifact({artifactId,jobId:p.job.JOB_ID,blob:raw,filename:'timing.txt',mediaType:'text/plain'});
 assert.equal(e.evaluateTargetAvailabilityCondition(p,byteCondition,timing),'TRUE','CUSTODY_ORACLE: actual persisted verified bytes were unavailable.');
 const captured=await captureArtifactFixture(r.store,p.job.JOB_ID),isolated=runtime();
 assert.equal(isolated.engine.evaluateTargetAvailabilityCondition(isolated.copy(p),isolated.copy(byteCondition),timing),'UNKNOWN','FIXTURE_CUSTODY_ORACLE: metadata crossed a runtime boundary as byte proof.');
 await restoreArtifactFixture(isolated.store,captured);
 assert.equal(isolated.engine.evaluateTargetAvailabilityCondition(isolated.copy(p),isolated.copy(byteCondition),timing),'TRUE','FIXTURE_CUSTODY_ORACLE: exact captured bytes did not restore availability.');
 await assert.rejects(()=>restoreArtifactFixture(runtime().store,captured.map(row=>({...row,bytesBase64:Buffer.from('wrong bytes').toString('base64')}))),/captured byte identity/,'FIXTURE_CUSTODY_ORACLE: corrupted fixture bytes were accepted.');
 const stored=r.rows.get('artifacts').get(artifactId);stored.blob=new Blob(['corrupted']);await r.store.getArtifact(artifactId);assert.equal(e.evaluateTargetAvailabilityCondition(p,byteCondition,timing),'UNKNOWN','CUSTODY_ORACLE: corrupted bytes retained readiness.');
 stored.blob=raw;await r.store.getArtifact(artifactId);assert.equal(e.evaluateTargetAvailabilityCondition(p,byteCondition,timing),'TRUE');await r.store.deleteArtifact(artifactId,p.job.JOB_ID);assert.equal(e.evaluateTargetAvailabilityCondition(p,byteCondition,timing),'UNKNOWN');
 const pointers=r.engine.clone(p);Object.assign(pointers.job,{CURRENT_ITERATION:'GHOST-ITERATION',CURRENT_CANDIDATE_ID:'GHOST-CANDIDATE',CURRENT_PRODUCT_ID:'GHOST-PRODUCT',CURRENT_PRODUCT_VERSION:'GHOST-VERSION',CURRENT_DELIVERY_CANDIDATE_SET_ID:'GHOST-SET',CURRENT_RELEASE_ID:'GHOST-RELEASE',CURRENT_HASH_REVIEW_ID:'GHOST-REVIEW',CURRENT_EVIDENCE_CHAIN_VERSION:'GHOST-CHAIN'});
 for(const phase of s.VERIFICATION_PHASE_VALUES)assert.notEqual(e.verificationPhaseTargetAvailability(pointers,phase,{PER_RUN_REQUIRED:true}),'TRUE','PHASE_TARGET_ORACLE: bare pointers authorized '+phase);
 const declaration={...timing,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'}};
 assert.equal(e.testDueState(p,{fields:r.copy(declaration)},12,{subjectFamily:'requirements',subjectId:id}).dueNow,true,'NON_RUN_TIMING_ORACLE: an earlier canonical subject required a future run.');
 const blocked=e.testDueState(p,{fields:r.copy({...declaration,TARGET_AVAILABILITY_CONDITION:absent})},12,{subjectFamily:'requirements',subjectId:id});assert.equal(blocked.dueNow,false);assert.equal(blocked.blocking,true,'DUE_BLOCKER_ORACLE: unknown required condition was silently skipped.');
 results.push({case:'TARGET_AVAILABILITY_BEHAVIOR',threeValuedCases:truthCases,phasesRejectBarePointers:[...s.VERIFICATION_PHASE_VALUES],byteStates:['UNKNOWN','TRUE','UNKNOWN','TRUE','UNKNOWN'],deadlineBlocker:blocked});
}
async function completedPhaseTargets(r,path){
 const saved=JSON.parse(fs.readFileSync(path,'utf8')),p=r.copy(saved.project),e=r.engine,s=r.runtime.closedLoopWorkflowSchema;
 await restoreArtifactFixture(r.store,saved.artifacts);
 const phases=s.VERIFICATION_PHASE_VALUES.map(phase=>({phase,expected:'TRUE',actual:e.verificationPhaseTargetAvailability(p,phase,r.copy({PER_RUN_REQUIRED:phase==='PREPRODUCT_ITERATION'}))}));
 results.push({case:'COMPLETE_CANONICAL_PHASE_TARGETS',fixtureSourceHashes:saved.sourceHashes,phases});
 assert(phases.every(row=>row.actual===row.expected),'PHASE_TARGET_IDENTITY_ORACLE: '+JSON.stringify(phases));
}
function regressionIterationBoundary(r){
 const e=r.engine,s=r.runtime.closedLoopWorkflowSchema,p=r.core.createBlankState('JOB-RETAINED-REGRESSION-TARGET');e.ensureShape(p);
 const create=(family,fields,options={})=>canonicalFixtureRecord({engine:e,schema:s},p,family,fields,options);
 const first=s.RECORD_SCHEMAS.iterations.stage,definitionStage=s.RECORD_SCHEMAS.regressions.stage;
 const candidate=create('candidateFreezes',{STATUS:'FROZEN'}),iteration=create('iterations',{CANDIDATE_ID:candidate.id,STATUS:'FROZEN',PURPOSE:'INITIAL'},{scope:{candidateId:candidate.id}});
 Object.assign(p.job,{CURRENT_CANDIDATE_ID:candidate.id,CURRENT_ITERATION:iteration.id});
 create('runs',{ITERATION_ID:iteration.id,CANDIDATE_ID:candidate.id,EXECUTION_STATUS:'COMPLETED'},{stage:first+1,scope:{iterationId:iteration.id,candidateId:candidate.id}});
 const regression=create('regressions',{...recordProposal(s,'regressions').fields,ACTIVE_RETIRED_STATE:'ACTIVE'});
 const required=()=>e.regressionExecutionSelection(p,definitionStage,{executableOnly:true});
 assert.equal(required().blockers.length,0,'RETAINED_REGRESSION_SCOPE_ORACLE: original target unavailable.');
 assert(required().tests.some(row=>row.id===regression.id),'RETAINED_REGRESSION_SCOPE_ORACLE: required regression disappeared.');
 const before=JSON.stringify(iteration),boundaryCases=[];
 // Corrected and unchanged confirmation iterations are distinct registered
 // EXECUTE_RUN stages after the regression-definition owner.
 const laterStages=Object.values(s.STAGE_OPERATION_REGISTRY).filter(row=>row.operation==='EXECUTE_RUN'&&row.stage>definitionStage).map(row=>row.stage);
 assert(laterStages.length,'The workflow must expose later iteration boundaries.');
 for(const stage of laterStages){
  const later=create('iterations',{CANDIDATE_ID:candidate.id,STATUS:'FROZEN',PURPOSE:'UNCHANGED_CONFIRMATION',PREVIOUS_ITERATION_ID:iteration.id},{stage,scope:{iterationId:null,candidateId:candidate.id}});p.job.CURRENT_ITERATION=later.id;
  assert.equal(required().blockers.length,0,'RETAINED_REGRESSION_SCOPE_ORACLE: starting a later empty iteration invalidated earlier required proof.');
  assert(required().tests.some(row=>row.id===regression.id),'RETAINED_REGRESSION_SCOPE_ORACLE: later iteration hid the earlier requirement.');
  assert.equal(e.regressionExecutionSelection(p,stage,{iterationId:later.id,perRunOnly:true}).blockers.length,1,'NEW_ITERATION_PROOF_ORACLE: prior runs satisfied an empty new iteration.');
  boundaryCases.push({stage,earlierDefinitionStage:definitionStage,priorRequirementPreserved:true,newIterationStillRequiresProof:true});
 }
 assert.equal(JSON.stringify(iteration),before,'RETAINED_REGRESSION_SCOPE_ORACLE: selection mutated retained state.');
 iteration.active=false;e.refreshRecordHashes(iteration,'iterations');const invalidatedSelection=required();assert(!invalidatedSelection.tests.some(row=>row.id===regression.id),'RETAINED_REGRESSION_SCOPE_ORACLE: invalidated original target remained executable.');assert(!e.records(p,'iterations').some(row=>Number(row.stage)===first),'INITIAL_ANALYSIS_AUTHORITY_ORACLE: an inactive original iteration retained initial-analysis authority.');
 results.push({case:'RETAINED_REGRESSION_ITERATION_BOUNDARIES',boundaryCases,invalidatedTargetRejected:true,invalidatedTargetDisposition:invalidatedSelection.blockers.some(row=>row.id===regression.id)?'EXPLICIT_BLOCKER':'NO_ACTIVE_INITIAL_ANALYSIS_SUBJECT',stageCompletionNotClaimed:true});
}
function regressionTimingConsumers(r){
 const e=r.engine,s=r.runtime.closedLoopWorkflowSchema,p=r.core.createBlankState('JOB-DEFERRED-REGRESSION');e.ensureShape(p);p.activeStage=18;
 const reg=canonical(r,p,'regressions',{...recordProposal(s,'regressions').fields,VERIFICATION_PHASE:'FINAL_PRODUCT_ADVERSARIAL',EARLIEST_EXECUTABLE_STAGE:24,REQUIRED_BY_STAGE:24,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:true,DELIVERY_REQUIRED:false,ACTIVE_RETIRED_STATE:'ACTIVE'});
 const before=JSON.stringify(reg),metrics=e.coverageMetrics(p);
 assert.equal(metrics.regressionSuccess,1,'DEFERRED_REGRESSION_TIMING_ORACLE: future product regression blocked preproduct convergence.');
 assert.equal(JSON.stringify(p.projectData.regressions[0]),before,'DEFERRED_REGRESSION_TIMING_ORACLE: scheduling changed the retained future definition.');
 const cases=[];
 for(const phase of s.VERIFICATION_PHASE_VALUES){
  const q=r.core.createBlankState('JOB-FUTURE-'+phase);e.ensureShape(q);q.activeStage=18;
  const fields={...recordProposal(s,'regressions').fields,VERIFICATION_PHASE:phase,EARLIEST_EXECUTABLE_STAGE:s.STAGE_COUNT,REQUIRED_BY_STAGE:s.STAGE_COUNT,PER_RUN_REQUIRED:phase==='PREPRODUCT_ITERATION',FINAL_PRODUCT_REQUIRED:phase.startsWith('FINAL_'),DELIVERY_REQUIRED:phase!=='PREPRODUCT_ITERATION'&&!phase.startsWith('FINAL_'),ACTIVE_RETIRED_STATE:'ACTIVE'};
  const subject=canonical(r,q,'regressions',fields),digest=JSON.stringify(subject);
  for(const stage of [1,18,19]){q.activeStage=stage;assert.equal(e.coverageMetrics(q).regressionSuccess,1,'DEFERRED_REGRESSION_TIMING_ORACLE: '+phase+' blocked earlier stage '+stage);}
  assert.equal(JSON.stringify(q.projectData.regressions[0]),digest,'DEFERRED_REGRESSION_TIMING_ORACLE: scheduling erased or altered a future definition.');
  const due=e.regressionExecutionSelection(q,s.STAGE_COUNT);
  assert.equal(due.blockers.length,1,'REGRESSION_DEADLINE_ORACLE: unknown target was skipped at '+phase+' deadline.');
  assert.equal(due.tests.length,0,'REGRESSION_DEADLINE_ORACLE: unavailable target was executable.');
  cases.push({phase,earlierStages:[1,18,19],deadline:s.STAGE_COUNT,targetUnknownBlocks:true,registryPreserved:true});
 }
 const invalid=r.copy(p);invalid.projectData.regressions[0].fields.REQUIRED_BY_STAGE='24';
 assert.equal(e.coverageMetrics(invalid).regressionSuccess,0,'REGRESSION_DEADLINE_ORACLE: invalid schedule was silently excluded.');
 results.push({case:'REGRESSION_PHASE_BOUNDARIES',cases});
 results.push({case:'DEFERRED_REGRESSION_CONVERGENCE',stage:18,requiredBy:24,registryPreserved:true,regressionSuccess:metrics.regressionSuccess});
}
function deferredExecutionRouting(r){
 const e=r.engine,s=r.runtime.closedLoopWorkflowSchema,p=r.core.createBlankState('JOB-DEFERRED-EXECUTION');e.ensureShape(p);
 const stage=r.core.STAGES.find(row=>row.number>s.RECORD_SCHEMAS.failureTests.stage).number;
 Object.assign(p.job,{AVAILABLE_TOOLS:'fixture-required_capability',CURRENT_REQUIREMENTS_VERSION:'REQ-v1',CURRENT_TEST_SUITE_VERSION:'TEST-v1'});p.activeStage=stage;
 const req=canonical(r,p,'requirements',{...recordProposal(s,'requirements').fields,STATUS:'ACTIVE'}),reqId=e.recordId(req,'requirements');
 const timing={VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:stage,REQUIRED_BY_STAGE:stage,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'}};
 const test=canonical(r,p,'tests',{...recordProposal(s,'tests').fields,...timing,REQ_ID:reqId});
 const subject=canonical(r,p,'failureTests',{...recordProposal(s,'failureTests').fields,...timing,REQ_ID:reqId,EXECUTION_TEST_ID:e.recordId(test,'tests'),EXECUTION_OUTCOME:'NOT_RUN',FIXTURE:'A bounded deliberately invalid fixture',EXPECTED_REJECTION:'Reject the invalid fixture'});
 const before=JSON.stringify(subject),action=e.operationalNextAction(p,stage);
 assert.equal(action.operation,'EXECUTE_FAILURE_TEST','DEFERRED_EXECUTION_ROUTE_ORACLE: the due failure fixture has no current-stage execution or correction action.');
 assert.equal(JSON.stringify(p.projectData.failureTests[0]),before,'DEFERRED_EXECUTION_ROUTE_ORACLE: selecting execution altered the retained definition.');
 const contract=s.operationContract(stage,action.operation);assert(contract,'DEFERRED_EXECUTION_ROUTE_ORACLE: next action has no registered current-stage contract.');
 assert.deepEqual(Array.from(contract.agentWritableCollections),['regressionExecutions'],'DEFERRED_EXECUTION_ROUTE_ORACLE: a later execution can rewrite definitions or unrelated work.');
 results.push({case:'DEFERRED_EXECUTION_ROUTE',stage,operation:action.operation,definitionPreserved:true});
}
async function smallDeferredFixture(r,{native=false,family='failureTests',executionStage,testOverrides={},propositionText='The invalid fixture must be rejected.'}={}){
 const e=r.engine,s=r.runtime.closedLoopWorkflowSchema,h=r.runtime.closedLoopHash,p=r.core.createBlankState('JOB-DEFERRED-SMALL');e.ensureShape(p);
 for(const key of Object.keys(testOverrides))assert.equal(s.RECORD_SCHEMAS.tests.fieldDefinitions[key]?.producer,s.PRODUCER.AGENT,'Small deferred fixture overrides only declared authored test fields.');
 Object.assign(p.job,{AVAILABLE_TOOLS:'fixture-required_capability',CURRENT_INPUT_VERSION:'INPUT-1',CURRENT_SOURCE_SET_VERSION:'SOURCE-1',CURRENT_RESEARCH_VERSION:'RESEARCH-1',CURRENT_REQUIREMENTS_VERSION:'REQ-1',CURRENT_TEST_SUITE_VERSION:'TEST-1'});
 const stage=executionStage??r.core.STAGES.find(row=>row.number>s.RECORD_SCHEMAS[family].stage).number;
 canonical(r,p,'externalCapabilities',{CAPABILITY_CLAIM:'fixture-required_capability',FRESHNESS_STATUS:'CURRENT',STATUS:'CURRENT',AUTHORIZED:true,PERMISSIONS_READY:true,INPUTS_TRANSFERABLE:true,ROUTE_USABLE:true,EVIDENCE_OBTAINABLE:true});
 const req=canonical(r,p,'requirements',{MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}),prop=canonical(r,p,'propositions',{REQUIREMENT_ID:req.id,PROPOSITION_TEXT:propositionText,STATUS:'CURRENT'});
 const fixtureBlob=new Blob(['invalid fixture']),fixtureArtifactId=e.allocateId(p,'artifacts',r.copy({payload:{purpose:'DEFERRED_NEGATIVE_FIXTURE'}})),sha=await h.sha256Bytes(fixtureBlob);
 e.registerArtifactBytes(p,r.copy({stage:6,artifactId:fixtureArtifactId,filename:'negative-fixture.txt',mediaType:'text/plain',byteSize:fixtureBlob.size,sha256:sha}));await r.store.putArtifact({artifactId:fixtureArtifactId,jobId:p.job.JOB_ID,blob:fixtureBlob,filename:'negative-fixture.txt',mediaType:'text/plain'});
 const correctionTargetBlob=new Blob(['defective target']),correctionTargetId=e.allocateId(p,'artifacts',r.copy({payload:{purpose:'REGRESSION_CORRECTION_TARGET'}})),correctionTargetSha=await h.sha256Bytes(correctionTargetBlob);
 if(family==='regressions'){e.registerArtifactBytes(p,r.copy({stage:6,artifactId:correctionTargetId,filename:'target.txt',mediaType:'text/plain',byteSize:correctionTargetBlob.size,sha256:correctionTargetSha}));await r.store.putArtifact({artifactId:correctionTargetId,jobId:p.job.JOB_ID,blob:correctionTargetBlob,filename:'target.txt',mediaType:'text/plain'});}
 const test=canonical(r,p,'tests',{...recordProposal(s,'tests').fields,REQ_ID:req.id,TARGET_PROPOSITION_IDS:[prop.id],TEST_ROLE:'REQUIRED_PROOF',STATUS:'READY',VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:stage,REQUIRED_BY_STAGE:stage,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'},...(native?{EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_INPUT_BINDINGS:{FIXTURE:{kind:'ARTIFACT',source:'EXPLICIT_ARTIFACT',artifactId:fixtureArtifactId},...(family==='regressions'?{TARGET:{kind:'ARTIFACT',source:'CURRENT_SCOPE',filename:'target.txt'}}:{})},EXECUTABLE_SPEC:{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:family==='regressions'?'TARGET':'FIXTURE'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'ASSERT_EQ',value:family==='regressions'?'corrected target':'invalid fixture'}]}}:{}),...testOverrides});
 const leaf={type:'LEAF',testId:test.id,requiredDisposition:'SATISFIED',truthExtraction:'ACCEPTED_ENTAILMENT',evidenceClasses:['OBSERVATION_RECORD','ACCEPTED_ENTAILMENT'],scopeBinding:'CURRENT'};
 canonical(r,p,'proofExpressions',{TARGET_PROPOSITION_ID:prop.id,PROPOSED_EXPRESSION:leaf,NORMALIZED_EXPRESSION:leaf,SEMANTIC_RATIONALE:'The reviewed predicate rejects the preserved invalid fixture.'});
 for(let n=1;n<=5;n++){p.stages[n].status='COMPLETE';p.stages[n].gate={complete:true};}
 reviewProofFixture({engine:e,prompts:r.prompts,ingestion:r.ingestion,schema:s},p);
 for(let n=1;n<stage;n++){p.stages[n].status='COMPLETE';p.stages[n].gate={complete:true};}p.activeStage=stage;
 return {p,test,stage,fixtureArtifactId,fixtureBlob,sha,correctionTargetId,correctionTargetBlob,correctionTargetSha};
}
// Separate actual affirmative observation for isolated resolver controls. The
// canonical product subject is fixture setup, not finished-product acceptance.
async function smallNativePositiveControl(r,p,test,inputs){
 const e=r.engine,product=canonical(r,p,'products',{PRODUCT_VERSION:'SYNTHETIC-FRONTIER-CONTROL'});Object.assign(p.job,{CURRENT_PRODUCT_ID:product.id,CURRENT_PRODUCT_VERSION:e.recordValue(product,'PRODUCT_VERSION')});product.scope=e.clone(e.currentScope(p));e.refreshRecordHashes(product,'products');
 r.runtime.Worker=isolatedVerifierWorkerClass();const actual=await r.runtime.closedLoopTestRuntime.executeTest(e.clone(test),inputs,{}, {transferInputBuffers:true});assert.equal(actual.status,'COMPLETE');assert.equal(actual.determination,'SATISFIED');
 const metadata=Object.values(inputs).map(input=>{const artifact=e.records(p,'artifacts').find(row=>row.id===input.artifactId);assert(artifact);return {artifactId:artifact.id,filename:e.recordValue(artifact,'FILENAME'),byteSize:e.recordValue(artifact,'BYTE_SIZE'),sha256:input.sha256};});
 return e.recordApplicationDeterministicResult(p,r.copy({testId:test.id,productId:product.id,runtimeResult:actual,inputArtifacts:metadata}));
}
async function deferredReservationBoundaries(r){
 const e=r.engine,s=r.runtime.closedLoopWorkflowSchema,prompts=r.runtime.closedLoopPromptEngine;
 const bindingFields=['OPERATION_RESERVATION_ID','JOB_ID','STAGE','OPERATION','TARGET_SLOT','PACKAGE_ID','PROMPT_ID','SCOPE','EXPECTED_REVISION','RESERVATION_REVISION','CHALLENGE_NONCE','IDEMPOTENCY_KEY','PAYLOAD_HASH'];
 const binding=row=>JSON.stringify(Object.fromEntries(bindingFields.map(key=>[key,e.recordValue(row,key)])));
 const paths=[['EXPORTED','RESPONSE_STAGED','ACCEPTED'],['CANCELLED'],['SUPERSEDED'],['EXPIRED_BY_SCOPE'],['EXPORTED','ORPHANED','RESUMED','RESPONSE_STAGED','REJECTED']];
 const cases=[];
 for(const [family,operation]of [['failureTests','EXECUTE_FAILURE_TEST'],['regressions','EXECUTE_REGRESSION']]){
  const {p,test,stage}=await smallDeferredFixture(r,{family});
  const subject=canonical(r,p,family,{...recordProposal(s,family).fields,...Object.fromEntries(s.TIMING_FIELDS.map(key=>[key,e.recordValue(test,key)])),REQ_ID:e.recordValue(test,'REQ_ID'),EXECUTION_TEST_ID:test.id,...(family==='failureTests'?{FIXTURE:'A disposable invalid fixture.',EXPECTED_REJECTION:e.recordValue(test,'EXPECTED_RESULT'),ACTUAL_RESULT:'NOT_RUN',EXECUTION_OUTCOME:'NOT_RUN'}:{FAILURE_FIXTURE:'A preserved invalid fixture.',ACTIVE_RETIRED_STATE:'ACTIVE'})});
  subject.scope=e.clone(test.scope);e.refreshRecordHashes(subject,family);
  const definitionBefore=JSON.stringify(subject),prompt=prompts.reserveAndBuildPromptRecord(p,stage,{operation}).prompt;
  assert.equal(prompt.contextManifest.deferredExecutionBinding.subjectId,subject.id,'DEFERRED_RESERVATION_BINDING_ORACLE: the prompt reserved a different definition.');
  const reservation=e.records(p,'operationReservations').find(row=>row.id===prompt.operationReservationId);
  assert(reservation,'DEFERRED_RESERVATION_BINDING_ORACLE: a bound prompt has no reservation.');
  const originalBinding=binding(reservation),observations=[];
  for(const path of paths){
   const row=r.copy(reservation);
   for(const state of path){e.transitionOperationReservation(row,state);assert.equal(binding(row),originalBinding,'DEFERRED_RESERVATION_BINDING_ORACLE: a state transition changed the exact reserved work.');}
   const before=JSON.stringify(row);
   assert.throws(()=>e.transitionOperationReservation(row,'EXPORTED'),/Invalid operation-reservation transition/,'DEFERRED_RESERVATION_TERMINAL_ORACLE: terminal conditional work reopened.');
   assert.equal(JSON.stringify(row),before,'DEFERRED_RESERVATION_TERMINAL_ORACLE: rejected transition mutated terminal work.');
   observations.push({path,terminal:e.recordValue(row,'STATUS'),reopen:'REJECTED_WITHOUT_MUTATION'});
  }
  const row=r.copy(reservation),before=JSON.stringify(row);
  assert.throws(()=>e.transitionOperationReservation(row,'UNKNOWN_STATE'),/Invalid operation-reservation transition/,'DEFERRED_RESERVATION_TERMINAL_ORACLE: undeclared state accepted.');
  assert.equal(JSON.stringify(row),before);
  assert.equal(JSON.stringify(subject),definitionBefore,'DEFERRED_DEFINITION_IMMUTABILITY_ORACLE');
  cases.push({family,stage,operation,observations});
 }
 results.push({case:'DEFERRED_BOUND_RESERVATION_TRANSITIONS',synthetic:true,acceptedIsMetadataOnly:true,cases});
}
async function deferredReceiptJourney(r,path){
 const saved=path?JSON.parse(fs.readFileSync(path,'utf8')):null,small=saved?null:await smallDeferredFixture(r),p=saved?r.copy(saved.project):small.p,e=r.engine,s=r.runtime.closedLoopWorkflowSchema,h=r.runtime.closedLoopHash,prompts=r.runtime.closedLoopPromptEngine,ingestion=r.runtime.closedLoopResponseIngestion;
 if(saved)await restoreArtifactFixture(r.store,saved.artifacts);
 const test=small?.test||e.recordsForCurrentScope(p,'tests').find(row=>e.recordValue(row,'VERIFICATION_PHASE')==='FINAL_PRODUCT_ADVERSARIAL'),stage=Number(e.recordValue(test,'REQUIRED_BY_STAGE')),reqId=e.recordValue(test,'REQ_ID');
 p.activeStage=stage;
 const subject=canonical(r,p,'failureTests',{...recordProposal(s,'failureTests').fields,...Object.fromEntries(s.TIMING_FIELDS.map(key=>[key,e.recordValue(test,key)])),REQ_ID:reqId,EXECUTION_TEST_ID:e.recordId(test,'tests'),FIXTURE:'Required content deliberately removed from a disposable copy.',EXPECTED_REJECTION:e.recordValue(test,'EXPECTED_RESULT'),ACTUAL_RESULT:'NOT_RUN',EXECUTION_OUTCOME:'NOT_RUN'});
 subject.scope=e.clone(test.scope);e.refreshRecordHashes(subject,'failureTests');
 const subjectId=e.recordId(subject,'failureTests'),operation='EXECUTE_FAILURE_TEST',before=JSON.stringify(subject);
 const selected=e.currentDeferredExecution(p,stage,operation);assert.equal(selected.subjectId,subjectId,'DEFERRED_EXECUTION_SELECTION_ORACLE');
 assert(e.gate(stage,p).reasons.some(reason=>reason.includes(subjectId)&&reason.includes('requires FAILURE_VALIDATION')),'DEFERRED_RECEIPT_GATE_ORACLE: unexecuted fixture passed its due gate.');
 assert(e.releaseMetrics(p).finalSelectionReasons.some(reason=>reason.includes(subjectId)),'DEFERRED_RECEIPT_RELEASE_ORACLE: missing deferred proof allowed release.');
 assert(e.terminalPrerequisites(p).reasons.some(reason=>reason.includes(subjectId)),'DEFERRED_RECEIPT_TERMINAL_ORACLE: missing deferred proof allowed terminal delivery.');
 const pr=prompts.reserveAndBuildPromptRecord(p,stage,{operation}).prompt,binding=pr.contextManifest.deferredExecutionBinding;
 assert(pr.prompt.includes('DEFERRED EXECUTION RECEIPT')&&pr.prompt.includes(binding.fixtureSha256),'DEFERRED_HANDOFF_ORACLE');
 const disposable={content:'required verified content'},original=JSON.stringify(disposable);disposable.content='';const rejected=!disposable.content.includes('required verified content');assert(rejected);
 const raw=JSON.stringify({kind:'SYNTHETIC_DISPOSABLE_NEGATIVE_FIXTURE',fixtureSha256:binding.fixtureSha256,isolation:{kind:'TEST_PROJECT_CLONE',identity:'verifier-disposable-'+subjectId},before:original,after:disposable,observation:'Required content missing; test rejected the fixture',rejected});
 const artifactId=e.allocateId(p,'artifacts',r.copy({payload:{purpose:'DEFERRED_RAW_EVIDENCE'}})),blob=new Blob([raw]),sha=await h.sha256Bytes(blob);
 e.registerArtifactBytes(p,r.copy({stage,artifactId,filename:'isolated-execution.json',mediaType:'application/json',byteSize:blob.size,sha256:sha}));if(saved)assert(e.gate(21,p).complete,'DEFERRED_EVIDENCE_PRODUCT_ISOLATION_ORACLE: registering test evidence changed the accepted finished-product inventory. '+e.gate(21,p).reasons.join(' | '));await r.store.putArtifact({artifactId,jobId:p.job.JOB_ID,blob,filename:'isolated-execution.json',mediaType:'application/json'});
 const report={schema:s.DEFERRED_EXECUTION_EVIDENCE.schema,binding,phase:'FAILURE_VALIDATION',result:'SATISFIED',isolation:{kind:'TEST_PROJECT_CLONE',identity:'verifier-disposable-'+subjectId},observedResult:'Required content missing; test rejected the fixture',performer:'Synthetic verifier executed by Node.js',evidenceLocation:'isolated-execution.json',isolationEvidence:'Disposable object copy and its before/after values are retained in the attached raw observation.'};
 const envelope={schema:s.RESPONSE_SCHEMA,contractProfileId:s.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage,operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},packageId:pr.packageId,operationReservationId:pr.operationReservationId,challengeNonce:pr.challengeNonce,scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{regressionExecutions:[{tempKey:'receipt',fields:{PHASE:'FAILURE_VALIDATION',RESULT:'SATISFIED'},relationships:{MUTATION_ID:{recordId:subjectId}},evidenceRefs:['execution'],notes:'Synthetic external-route transport acceptance, not real-project acceptance.'}]},evidence:[{temporaryKey:'execution',kind:'EXTERNAL_EXECUTION',description:'Raw isolated fixture observation',authorityType:'EXTERNAL_SYSTEM',location:'isolated-execution.json',content:JSON.stringify(report),attachmentRef:{recordId:artifactId},notes:'Synthetic external executor fixture'}],unresolved:[],warnings:[],attachments:[]};
 const transport={authority:'AUTHORITATIVE_RESPONSE_FILE',packageId:pr.packageId,operationReservationId:pr.operationReservationId,challengeNonce:pr.challengeNonce};
 const prepare=value=>ingestion.prepare(p,{stage,text:JSON.stringify(value),promptRecord:pr,transport});
 const reject=value=>{try{return !prepare(value).validation.valid;}catch(error){if(!/execution|receipt|isolation|fixture|target/i.test(error.message))throw error;return true;}};
 const missing=r.copy(envelope);delete missing.evidence[0].attachmentRef;assert(reject(missing),'DEFERRED_ISOLATION_ORACLE: an unsupported statement established actual isolation.');
 for(const key of ['subjectSha256','fixtureSha256']){const bad=r.copy(envelope),changed=JSON.parse(bad.evidence[0].content);changed.binding[key]='0'.repeat(64);bad.evidence[0].content=JSON.stringify(changed);assert(reject(bad),'DEFERRED_BINDING_ORACLE: changed '+key+' accepted.');}
 const wrongIsolation=r.copy(envelope),changed=JSON.parse(wrongIsolation.evidence[0].content);changed.isolation.extra=true;wrongIsolation.evidence[0].content=JSON.stringify(changed);assert(reject(wrongIsolation),'DEFERRED_ISOLATION_ORACLE: open isolation object accepted.');
 const good=prepare(envelope);assert(good.validation.valid,'DEFERRED_VALID_PROGRESSION_ORACLE: '+JSON.stringify(good.validation.issues));
 assert.equal(JSON.stringify(p.projectData.failureTests.find(row=>row.id===subjectId)),before,'DEFERRED_DEFINITION_IMMUTABILITY_ORACLE');
 assert.equal(good.project.projectData.regressionExecutions.filter(row=>e.recordValue(row,'MUTATION_ID')===subjectId).length,0,'DEFERRED_CONFIRMATION_ORACLE');
 const committed=ingestion.commit(good.project,good.proposal.proposalId,{operator:'SYNTHETIC_VERIFIER',replacementConfirmation:ingestion.acceptanceImpact(good.project,good.proposal.proposalId)}).project;
 const receipt=e.records(committed,'regressionExecutions').find(row=>e.recordValue(row,'MUTATION_ID')===subjectId);assert(receipt,'DEFERRED_VALID_PROGRESSION_ORACLE: committed receipt missing.');
 const completed=e.deferredExecutionPlan(committed,stage,{operation}).items.find(row=>row.subjectId===subjectId);assert(completed.completed,'DEFERRED_VALID_PROGRESSION_ORACLE: '+JSON.stringify(completed));
 if(saved)assert(e.gate(stage,committed).complete,'DEFERRED_REVIEW_PROVENANCE_ORACLE: accepting a separate execution receipt displaced the provenance of accepted review results. '+e.gate(stage,committed).reasons.join(' | '));
 assert.equal(JSON.stringify(committed.projectData.failureTests.find(row=>row.id===subjectId)),before,'DEFERRED_DEFINITION_IMMUTABILITY_ORACLE');
 const integrity=r.store.validateProjectIntegrity(committed);assert(integrity.valid,'DEFERRED_DURABILITY_ORACLE: '+integrity.issues.join(' | '));
 const malformed=r.copy(committed),malformedReceipt=malformed.projectData.regressionExecutions.find(row=>row.id===receipt.id);malformedReceipt.fields.TARGET_IDENTITIES[0].unregistered=true;malformedReceipt.TARGET_IDENTITIES=malformedReceipt.fields.TARGET_IDENTITIES;e.refreshRecordHashes(malformedReceipt,'regressionExecutions');assert(!r.store.validateProjectIntegrity(malformed,{verifyDerived:false}).valid,'DEFERRED_PERSISTENCE_SHAPE_ORACLE: recovery accepted undeclared target identity fields.');
 const restored=r.copy(committed);e.recalculate(restored);assert(e.deferredExecutionPlan(restored,stage,{operation}).items.find(row=>row.subjectId===subjectId).completed,'DEFERRED_RESTORE_ORACLE');
 const changedDefinition=r.copy(committed),changedSubject=changedDefinition.projectData.failureTests.find(row=>row.id===subjectId);changedSubject.fields.FIXTURE+=' Changed';e.refreshRecordHashes(changedSubject,'failureTests');assert(!e.deferredExecutionPlan(changedDefinition,stage,{operation}).items.find(row=>row.subjectId===subjectId).completed,'DEFERRED_STALE_ORACLE');
 results.push({case:'DEFERRED_EXTERNAL_RECEIPT_JOURNEY',stage,source:'SYNTHETIC_CANONICAL_FIXTURE_FROM_EXECUTED_FULL_CYCLE',receiptId:receipt.id,definitionPreserved:true,unsupportedIsolationRejected:true,staleBindingRejected:true,unacceptedBeforeCommit:true,durable:true,restoration:true});
}
function deferredReviewProvenance(r){
 const e=r.engine,s=r.runtime.closedLoopWorkflowSchema;
 for(const [family,label,display]of [['preflightRecords','Preflight','PREFLIGHT_REVIEWER_ID'],['meaningResults','Meaning','EVALUATOR_ID'],['adversarialResults','Adversarial','REVIEWER_ID']]){
  const stage=s.RECORD_SCHEMAS[family].stage,p=r.core.createBlankState('JOB-REVIEW-PROVENANCE-'+family);e.ensureShape(p);
  const reviewer=e.registerFreshContext(p,{stage,externalContextIdentifier:'reviewer-'+family,operatorLabel:'SYNTHETIC_VERIFIER',purpose:'REVIEWER'}),reviewerId=e.recordId(reviewer,'freshContexts');
  canonical(r,p,'products',{...recordProposal(s,'products').fields,PRODUCT_VERSION:'PRODUCT-v001',PRODUCTION_CONTEXT_ID:'distinct-production-context'});
  const review=canonical(r,p,family,recordProposal(s,family).fields),change={changeId:'FIXTURE-ACCEPTED-'+family,stage,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'COMPLETE',canonicalRecordIds:[review.id],scope:{contextId:reviewerId},source:'CONTROLLED_PROVENANCE_FIXTURE'};
  p.projectData.acceptedChanges.push(change);
  const reasons=()=>e.gate(stage,p).reasons.filter(reason=>reason.startsWith(label+' reviewer independence'));
  assert.equal(reasons().length,0,'DEFERRED_REVIEW_PROVENANCE_ORACLE: controlling review fixture lacks its accepted context.');
  p.projectData.acceptedChanges.push({changeId:'FIXTURE-SEPARATE-RECEIPT-'+family,stage,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'EXECUTE_FAILURE_TEST',canonicalRecordIds:[],scope:{},source:'CONTROLLED_SEPARATE_RECEIPT_FIXTURE'});
  assert.equal(reasons().length,0,'DEFERRED_REVIEW_PROVENANCE_ORACLE: unrelated receipt displaced '+family+' authority.');
  assert.equal(e.deriveStageData(p,stage)[display],reviewerId,'DEFERRED_REVIEW_DISPLAY_ORACLE: displayed reviewer differs from accepted review authority.');
  change.scope.contextId='';assert(reasons().length,'DEFERRED_REVIEW_PROVENANCE_ORACLE: missing actual reviewer authority was accepted.');
  change.scope.contextId=reviewerId;assert.equal(reasons().length,0,'DEFERRED_REVIEW_PROVENANCE_ORACLE: restored controlling authority did not recover.');
  results.push({case:'DEFERRED_REVIEW_PROVENANCE_CLASS',family,stage,scope:'reviewer independence and derived identity only',unrelatedReceiptPreservedReview:true,missingActualAuthorityRejected:true});
 }
}
async function deferredArtifactOwnership(r){
 const e=r.engine,s=r.runtime.closedLoopWorkflowSchema,h=r.runtime.closedLoopHash,p=r.core.createBlankState('JOB-DEFERRED-EVIDENCE-OWNERSHIP');e.ensureShape(p);
 const product=canonical(r,p,'products',{...recordProposal(s,'products').fields,PRODUCT_VERSION:'PRODUCT-v001',GENERATED_ARTIFACT_INVENTORY:[]});p.job.CURRENT_PRODUCT_ID=product.id;p.job.CURRENT_PRODUCT_VERSION='PRODUCT-v001';
 const register=async(name,lineage)=>{const blob=new Blob([name]),artifactId=e.allocateId(p,'artifacts',r.copy({payload:{purpose:name}}));e.registerArtifactBytes(p,r.copy({stage:s.RECORD_SCHEMAS.products.stage,artifactId,filename:name,mediaType:'text/plain',byteSize:blob.size,sha256:await h.sha256Bytes(blob),lineage}));await r.store.putArtifact({artifactId,jobId:p.job.JOB_ID,blob,filename:name,mediaType:'text/plain'});return e.records(p,'artifacts').find(row=>row.id===artifactId);};
 const authored=await register('product.txt',{productId:product.id}),inventory=JSON.stringify(e.recordValue(product,'GENERATED_ARTIFACT_INVENTORY'));
 assert.equal(authored.scope.productId,product.id,'DEFERRED_EVIDENCE_PRODUCT_ISOLATION_ORACLE: explicit product lineage lost.');
 const evidence=await register('isolated-execution.txt',{});
 assert.equal(evidence.scope.productId,null,'DEFERRED_EVIDENCE_PRODUCT_ISOLATION_ORACLE: unrelated evidence acquired product ownership.');
 assert.equal(JSON.stringify(e.recordValue(product,'GENERATED_ARTIFACT_INVENTORY')),inventory,'DEFERRED_EVIDENCE_PRODUCT_ISOLATION_ORACLE: later evidence changed product inventory.');
 results.push({case:'DEFERRED_EVIDENCE_PRODUCT_OWNERSHIP',explicitLineagePreserved:true,unrelatedEvidenceExcluded:true});
}
async function deferredNativeJourney(r,{appSource,executionStage}={}){
 const {p,test,stage,fixtureArtifactId,fixtureBlob,sha}=await smallDeferredFixture(r,{native:true,executionStage}),e=r.engine,s=r.runtime.closedLoopWorkflowSchema,h=r.runtime.closedLoopHash;
 const subject=canonical(r,p,'failureTests',{...recordProposal(s,'failureTests').fields,...Object.fromEntries(s.TIMING_FIELDS.map(key=>[key,e.recordValue(test,key)])),REQ_ID:e.recordValue(test,'REQ_ID'),EXECUTION_TEST_ID:test.id,FIXTURE:'Execute the isolated fixture '+fixtureArtifactId,EXPECTED_REJECTION:e.recordValue(test,'EXPECTED_RESULT'),ACTUAL_RESULT:'NOT_RUN',EXECUTION_OUTCOME:'NOT_RUN'});
 subject.scope=e.clone(test.scope);e.refreshRecordHashes(subject,'failureTests');
 const operation='EXECUTE_FAILURE_TEST',item=e.currentDeferredExecution(p,stage,operation),before=JSON.stringify(subject),payload={FIXTURE:{artifactId:fixtureArtifactId,sha256:sha,bytes:new Uint8Array(await fixtureBlob.arrayBuffer())}};
 assert(item.native,'DEFERRED_NATIVE_ROUTE_ORACLE');
 if(stage<s.STAGE_COUNT){const later=r.copy(p),future=later.projectData.artifacts.find(row=>row.id===fixtureArtifactId);future.stage=s.STAGE_COUNT;e.refreshRecordHashes(future,'artifacts');assert.throws(()=>e.currentDeferredExecution(later,stage,operation),/selected stage|permitted|unavailable/i,'DEFERRED_NATIVE_STAGE_ISOLATION_ORACLE: earlier-stage execution included subsequent-stage material.');}
 const Worker=isolatedVerifierWorkerClass();let executions=0;r.runtime.Worker=class extends Worker{constructor(...args){super(...args);executions++;}};
 const execute=()=>e.executeDeferredNative(p,{stage,operation,subjectId:subject.id,bindingSha256:item.bindingSha256,artifactPayload:payload});
 const runtimeOwner=r.runtime.closedLoopTestRuntime,unchanged=h.sha256Value(r.copy(p));
 await assert.rejects(()=>e.executeDeferredNative(p,{stage,operation,subjectId:subject.id,bindingSha256:item.bindingSha256,artifactPayload:{FIXTURE:{...payload.FIXTURE,bytes:new Uint8Array([1,2,3])}}}),/bytes do not match/,'DEFERRED_NATIVE_INPUT_IDENTITY_ORACLE');
 r.runtime.closedLoopTestRuntime={...runtimeOwner,executeTest:async(...args)=>({...await runtimeOwner.executeTest(...args),inputArtifactSha256Values:['0'.repeat(64)]})};
 await assert.rejects(execute,/runtime observation does not bind/,'DEFERRED_NATIVE_OBSERVATION_IDENTITY_ORACLE');
 const activation=p.historyActivationId;r.runtime.closedLoopTestRuntime={...runtimeOwner,executeTest:async(...args)=>{const result=await runtimeOwner.executeTest(...args);p.historyActivationId='RESTORED-WHILE-WORKER-RAN';return result;}};
 await assert.rejects(execute,/changed while the isolated test was running/,'DEFERRED_NATIVE_ABANDONED_OPERATION_ORACLE');
 if(activation===undefined)delete p.historyActivationId;else p.historyActivationId=activation;
 r.runtime.closedLoopTestRuntime=runtimeOwner;
 assert.equal(h.sha256Value(r.copy(p)),unchanged,'DEFERRED_NATIVE_REJECTION_ATOMICITY_ORACLE: rejected or abandoned execution changed accepted data.');
 executions=0;
 const simultaneous=await Promise.allSettled([execute(),execute()]),receipt=simultaneous[0].value;
 assert(simultaneous.every(row=>row.status==='fulfilled'&&row.value.id===receipt?.id),'DEFERRED_NATIVE_CONCURRENT_RETRY_ORACLE: simultaneous activation did not retain one committed receipt.');
 assert.equal(executions,1,'DEFERRED_NATIVE_CONCURRENT_RETRY_ORACLE: simultaneous activation duplicated isolated execution.');
 assert.equal(e.recordValue(receipt,'RESULT'),'SATISFIED','DEFERRED_NATIVE_OBSERVATION_ORACLE');
 assert.equal(e.recordValue(receipt,'ISOLATION').kind,'ISOLATED_WORKER_INPUT','DEFERRED_NATIVE_ISOLATION_ORACLE');
 assert.equal(JSON.stringify(p.projectData.failureTests.find(row=>row.id===subject.id)),before,'DEFERRED_NATIVE_DEFINITION_ORACLE');
 assert.equal(new TextDecoder().decode(payload.FIXTURE.bytes),'invalid fixture','DEFERRED_NATIVE_INPUT_COPY_ORACLE: original bytes were transferred or changed.');
 const count=e.records(p,'regressionExecutions').length,retry=await e.executeDeferredNative(p,{stage,operation,subjectId:subject.id,bindingSha256:item.bindingSha256,artifactPayload:payload});
 assert.equal(retry.id,receipt.id,'DEFERRED_NATIVE_RETRY_ORACLE');assert.equal(e.records(p,'regressionExecutions').length,count,'DEFERRED_NATIVE_RETRY_ORACLE');
 const integrity=r.store.validateProjectIntegrity(p);assert(integrity.valid,'DEFERRED_NATIVE_DURABILITY_ORACLE: '+integrity.issues.join(' | '));
 const rendered=appMarkup(r.runtime,p,{operations:{[stage]:operation},instructionEvidence:true,...(appSource?{source:appSource}:{})});assert.equal(typeof rendered.selectedOperation,'string','DEFERRED_NEXT_ACTION_ORACLE: selected-operation observation missing.');assert.notEqual(rendered.selectedOperation,operation,'DEFERRED_NEXT_ACTION_ORACLE: a completed execution leaves its obsolete operation selected.');
 results.push({case:'DEFERRED_NATIVE_ISOLATED_EXECUTION',stage,receiptId:receipt.id,actualWorker:'NODE_WORKER_WITH_PRODUCTION_TEST_WORKER_AND_TEST_IR',originalBytesPreserved:true,exactRetryPreserved:true,durable:true});
}
async function deferredRegressionJourney(r){
 const f=await smallDeferredFixture(r,{native:true,family:'regressions'}),{p,test,stage}=f,e=r.engine,s=r.runtime.closedLoopWorkflowSchema,h=r.runtime.closedLoopHash,operation='EXECUTE_REGRESSION';
 const subject=canonical(r,p,'regressions',{...recordProposal(s,'regressions').fields,...Object.fromEntries(s.TIMING_FIELDS.map(key=>[key,e.recordValue(test,key)])),REQ_ID:e.recordValue(test,'REQ_ID'),EXECUTION_TEST_ID:test.id,FAILURE_FIXTURE:'Preserved negative fixture '+f.fixtureArtifactId,ACTIVE_RETIRED_STATE:'ACTIVE'});subject.scope=e.clone(test.scope);e.refreshRecordHashes(subject,'regressions');
 r.runtime.Worker=isolatedVerifierWorkerClass();
 const inputs={FIXTURE:{artifactId:f.fixtureArtifactId,sha256:f.sha,bytes:new Uint8Array(await f.fixtureBlob.arrayBuffer())},TARGET:{artifactId:f.correctionTargetId,sha256:f.correctionTargetSha,bytes:new Uint8Array(await f.correctionTargetBlob.arrayBuffer())}};
 const pre=e.currentDeferredExecution(p,stage,operation),receipt=await e.executeDeferredNative(p,{stage,operation,subjectId:subject.id,bindingSha256:pre.bindingSha256,artifactPayload:inputs});
 assert.equal(e.recordValue(receipt,'PHASE'),'PRE_CORRECTION','DEFERRED_REGRESSION_PHASE_ORACLE');assert.equal(e.recordValue(receipt,'RESULT'),'VIOLATED','DEFERRED_REGRESSION_PHASE_ORACLE');
 const preservedPre=JSON.stringify(receipt);
 const retry=await e.executeDeferredNative(p,{stage,operation,subjectId:subject.id,bindingSha256:pre.bindingSha256,artifactPayload:inputs});assert.equal(retry.id,receipt.id,'DEFERRED_REGRESSION_RETRY_ORACLE');
 assert.throws(()=>e.currentDeferredExecution(p,stage,operation),/input identities are unchanged/,'DEFERRED_REGRESSION_DISTINCT_INPUT_ORACLE');
 const originalFixture=await r.store.getArtifact(f.fixtureArtifactId),corrected=new Blob(['corrected target']),correctedSha=await h.sha256Bytes(corrected),target=e.records(p,'artifacts').find(row=>row.id===f.correctionTargetId);
 // Controlled fault/correction fixture: mutate only the disposable target's
 // bytes and canonical identity, retaining the definition and negative fixture.
 target.active=false;target.validity='SUPERSEDED';e.refreshRecordHashes(target,'artifacts');const correctedId=e.allocateId(p,'artifacts',r.copy({payload:{purpose:'CORRECTED_TARGET'}}));e.registerArtifactBytes(p,r.copy({stage:6,artifactId:correctedId,filename:'target.txt',mediaType:'text/plain',byteSize:corrected.size,sha256:correctedSha}));await r.store.putArtifact({artifactId:correctedId,jobId:p.job.JOB_ID,blob:corrected,filename:'target.txt',mediaType:'text/plain'});
 inputs.TARGET={artifactId:correctedId,sha256:correctedSha,bytes:new Uint8Array(await corrected.arrayBuffer())};
 const post=e.currentDeferredExecution(p,stage,operation);assert.equal(post.phase,'POST_CORRECTION','DEFERRED_REGRESSION_PHASE_ORACLE');
 const result=await e.executeDeferredNative(p,{stage,operation,subjectId:subject.id,bindingSha256:post.bindingSha256,artifactPayload:inputs});assert.equal(e.recordValue(result,'RESULT'),'SATISFIED','DEFERRED_REGRESSION_COMPLETION_ORACLE');
 assert.notEqual(result.id,receipt.id,'DEFERRED_REGRESSION_DISTINCT_EXECUTION_ORACLE');assert.notDeepEqual(e.recordValue(receipt,'TARGET_IDENTITIES'),e.recordValue(result,'TARGET_IDENTITIES'),'DEFERRED_REGRESSION_DISTINCT_INPUT_ORACLE');
 assert(e.deferredExecutionPlan(p,stage,{operation}).items.find(row=>row.subjectId===subject.id).completed,'DEFERRED_REGRESSION_COMPLETION_ORACLE');
 // A separate affirmative observation cannot replace either typed execution.
 const chainControl=e.clone(p),ordinary=await smallNativePositiveControl(r,chainControl,test,{FIXTURE:{...inputs.FIXTURE,bytes:inputs.FIXTURE.bytes.slice()},TARGET:{...inputs.TARGET,bytes:inputs.TARGET.bytes.slice()}}),req=e.recordsForCurrentScope(chainControl,'requirements').find(row=>row.id===e.recordValue(test,'REQ_ID'));
 const selected=e.deferredExecutionPlan(chainControl,30,{operation}).items.find(row=>row.subjectId===subject.id),typed=e.deferredEvidenceChainResults(chainControl,req.id,30);
 assert.deepEqual(Array.from(selected.priorReceipts),[receipt.id],'EVIDENCE_CHAIN_PRE_HISTORY_ORACLE');assert.deepEqual(Array.from(selected.receipts),[result.id],'EVIDENCE_CHAIN_POST_CURRENT_ORACLE');
 assert.equal(JSON.stringify(e.records(chainControl,'regressionExecutions').find(row=>row.id===receipt.id)),preservedPre,'EVIDENCE_CHAIN_PRE_PRESERVATION_ORACLE');
 for(const [id,phase]of[[receipt.id,'PRE_CORRECTION'],[result.id,'POST_CORRECTION']]){const entry=typed.results.find(item=>item.record.id===id);assert(entry&&entry.kind==='DEFERRED_OBLIGATION'&&entry.completed&&entry.phase===phase,'EVIDENCE_CHAIN_PRE_POST_TYPED_ORACLE: '+phase);}
 const both=e.evidenceChainResultState(chainControl,req,{stage:30,resultIds:[ordinary.id,receipt.id,result.id]});assert.equal(both.complete,true,'EVIDENCE_CHAIN_PRE_POST_VALID_CONTROL_ORACLE: '+JSON.stringify(both.missing));
 for(const omitted of[receipt.id,result.id]){const state=e.evidenceChainResultState(chainControl,req,{stage:30,resultIds:[ordinary.id,receipt.id,result.id].filter(id=>id!==omitted)});assert(state.missing.includes('DEFERRED_RESULT:'+omitted),'EVIDENCE_CHAIN_PRE_POST_MISSING_LINK_ORACLE: '+omitted);assert.equal(state.complete,false);}
 const chain=e.constructEvidenceChains(chainControl).find(row=>e.recordValue(row,'REQ_ID')===req.id);assert(e.recordValue(chain,'TEST_RESULT_ID').includes(receipt.id)&&e.recordValue(chain,'TEST_RESULT_ID').includes(result.id),'EVIDENCE_CHAIN_PRE_POST_BUILDER_LINK_ORACLE');
 const explanation=e.evidenceChainExplanation(chainControl,chain);for(const id of[receipt.id,result.id]){assert(explanation.support.some(text=>text.includes(id)&&text.includes('only the typed execution obligation')),'EVIDENCE_CHAIN_PRE_POST_EXPLANATION_ORACLE');assert(!explanation.support.some(text=>text.includes(id)&&text.includes('capable of proving the proposition')),'EVIDENCE_CHAIN_PRE_POST_AFFIRMATIVE_ORACLE');}

 assert.equal(await (await r.store.getArtifact(f.fixtureArtifactId)).blob.text(),await originalFixture.blob.text(),'DEFERRED_REGRESSION_FIXTURE_PRESERVATION_ORACLE');
 const integrity=r.store.validateProjectIntegrity(p);assert(integrity.valid,'DEFERRED_REGRESSION_DURABILITY_ORACLE: '+integrity.issues.join(' | '));
 results.push({case:'DEFERRED_REGRESSION_PRE_POST_CORRECTION',stage,preReceipt:receipt.id,postReceipt:result.id,actualWorker:true,unchangedInputRejected:true,fixturePreserved:true,durable:true,typedChainControl:{boundary:'Separate disposable canonical resolver clone with an actual affirmative native predicate; not full release prerequisites.',atStage:30,bothTypedReceiptsRetained:true,eitherMissingStoredLinkRejected:true,originalPreScopeAndTargetsUnchanged:true,typedPreAndPostNotAffirmativeRequirementProof:true,originalJourneyIntegrityAssertionPreserved:true}});
}
function evidenceChainNoopIdentity(r,project,requirementId,ordinaryResultId){
 const e=r.engine,h=r.runtime.closedLoopHash,originalDate=vm.runInContext('Date',r.runtime);let fixtureTime=Date.now()+1000;
 class ControlledFixtureDate extends Date {constructor(...args){super(...(args.length?args:[fixtureTime]));}static now(){return fixtureTime;}}
 r.runtime.Date=ControlledFixtureDate;
 try{
  const first=e.constructEvidenceChains(project).find(row=>e.recordValue(row,'REQ_ID')===requirementId),recordBefore=JSON.stringify(first),preimageBefore=h.stableStringify(h.registeredHashPreimage('EVIDENCE_CHAIN_CANONICAL_RECORD/1',first)),digestBefore=h.recordSha256(first);
  fixtureTime+=1000;
  const repeated=e.constructEvidenceChains(project).find(row=>e.recordValue(row,'REQ_ID')===requirementId);
  assert.equal(h.stableStringify(h.registeredHashPreimage('EVIDENCE_CHAIN_CANONICAL_RECORD/1',repeated)),preimageBefore,'EVIDENCE_CHAIN_NOOP_PREIMAGE_ORACLE: controlled unchanged input changed canonical preimage.');
  assert.equal(h.recordSha256(repeated),digestBefore,'EVIDENCE_CHAIN_NOOP_TARGET_IDENTITY_ORACLE: metadata-only recalculation changed the exact bound record identity.');
  assert.equal(JSON.stringify(repeated),recordBefore,'EVIDENCE_CHAIN_NOOP_FULL_RECORD_ORACLE');
  const withdrawn=e.clone(project);withdrawn.projectData.deterministicResults=withdrawn.projectData.deterministicResults.filter(row=>row.id!==ordinaryResultId);fixtureTime+=1000;
  const changed=e.constructEvidenceChains(withdrawn).find(row=>e.recordValue(row,'REQ_ID')===requirementId);
  assert.notEqual(h.stableStringify(h.registeredHashPreimage('EVIDENCE_CHAIN_CANONICAL_RECORD/1',changed)),preimageBefore,'EVIDENCE_CHAIN_MATERIAL_PREIMAGE_ORACLE: removing actual mandatory affirmative evidence retained its prior chain.');
  assert.notEqual(h.recordSha256(changed),digestBefore,'EVIDENCE_CHAIN_MATERIAL_TARGET_IDENTITY_ORACLE');
  assert(e.recordValue(changed,'MISSING_LINKS').includes('CANONICAL_EVIDENCE'),'EVIDENCE_CHAIN_MATERIAL_NEGATIVE_ORACLE');
  return {boundary:'Direct disposable canonical constructor, deterministic clock progression; not a full release-chain target execution.',identicalCanonicalPreimagePreservesFullRecordAndDigest:true,actualAffirmativeEvidenceWithdrawalChangesPreimageAndDigest:true,changedStateRemainsIncomplete:true};
 }finally{r.runtime.Date=originalDate;}
}
async function evidenceChainFrontierCases(r,{requiredBy=30}={}){
 assert([29,30].includes(requiredBy));
 const f=await smallDeferredFixture(r,{native:true,executionStage:8,propositionText:'The supplied fixture contents exactly equal invalid fixture.',testOverrides:{PROCEDURE:'Load the exact supplied fixture, decode UTF-8, and compare with invalid fixture.',EXPECTED_RESULT:'SATISFIED',FAILURE_CONDITION:'VIOLATED',EVIDENCE_TO_PRESERVE:'Preserve the actual isolated predicate observation.'}}),{p,test}=f,e=r.engine,s=r.runtime.closedLoopWorkflowSchema,h=r.runtime.closedLoopHash;
 const requirement=e.recordsForCurrentScope(p,'requirements').find(row=>row.id===e.recordValue(test,'REQ_ID'));
 const negative=canonical(r,p,'tests',{...recordProposal(s,'tests').fields,REQ_ID:requirement.id,TEST_ROLE:'NEGATIVE_ONLY',STATUS:'READY',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITY:'fixture-required_capability',ARTIFACT_REQUIREMENTS:'NONE',INPUTS:'A disposable copy of the declared input; content is the empty string.',PROCEDURE:'Reject exactly when the disposable content does not include required verified content.',EXPECTED_RESULT:'REJECT',FAILURE_CONDITION:'ACCEPT',EVIDENCE_TO_PRESERVE:'Preserve the disposable before/after values and actual predicate result.',VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:8,REQUIRED_BY_STAGE:requiredBy,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'}});
 reviewProofFixture({engine:e,prompts:r.prompts,ingestion:r.ingestion,schema:s},p);
 const subject=canonical(r,p,'failureTests',{...recordProposal(s,'failureTests').fields,...Object.fromEntries(s.TIMING_FIELDS.map(key=>[key,e.recordValue(negative,key)])),REQ_ID:requirement.id,EXECUTION_TEST_ID:negative.id,FIXTURE:'The disposable input has content equal to the empty string; required verified content was removed.',EXPECTED_REJECTION:'REJECT',ACTUAL_RESULT:'NOT_RUN',EXECUTION_OUTCOME:'NOT_RUN'});subject.scope=e.clone(negative.scope);e.refreshRecordHashes(subject,'failureTests');
 // This private canonical fixture isolates result resolution. Its prior flags
 // and product subject are setup, not evidence that Stages 1-28 completed.
 const receiptInput=e.clone(p);
 const positiveBytes=new Uint8Array(await f.fixtureBlob.arrayBuffer());
 const positivePredicate=project=>smallNativePositiveControl(r,project,test,{FIXTURE:{artifactId:f.fixtureArtifactId,sha256:f.sha,bytes:positiveBytes.slice()}});
 const ordinary=await positivePredicate(p);
 const beforeReceipt=e.clone(p),beforeChain=e.constructEvidenceChains(beforeReceipt).find(row=>e.recordValue(row,'REQ_ID')===requirement.id),beforeMissing=e.recordValue(beforeChain,'MISSING_LINKS');
 assert(e.recordValue(beforeChain,'TEST_ID').includes(negative.id),'EVIDENCE_CHAIN_FUTURE_INVENTORY_ORACLE: future test was removed from the registered chain.');
 assert.equal(beforeMissing.includes('TEST_RESULT:'+negative.id),requiredBy===29,'EVIDENCE_CHAIN_DUE_FRONTIER_ORACLE: result requirements disagree with the independently declared Stage29 due frontier.');
 const future=e.evidenceChainResultState(p,requirement,{stage:29}),futureTiming=future.states.find(row=>row.testId===negative.id);
 assert.equal(futureTiming.valid,true);assert.equal(futureTiming.targetAvailability,'TRUE');assert.equal(futureTiming.executableNow,true);assert.equal(futureTiming.dueNow,requiredBy===29);assert.equal(future.complete,requiredBy===30,'EVIDENCE_CHAIN_ORDINARY_CONTROL_ORACLE: '+JSON.stringify(future.missing));
 const due=e.evidenceChainResultState(p,requirement,{stage:30});assert.equal(due.complete,false);assert(due.missing.includes('TEST_RESULT:'+negative.id),'EVIDENCE_CHAIN_DUE_MISSING_ORACLE');
 const badTiming=e.clone(p),badTest=badTiming.projectData.tests.find(row=>row.id===negative.id);badTest.fields.REQUIRED_BY_STAGE='30';badTest.REQUIRED_BY_STAGE='30';e.refreshRecordHashes(badTest,'tests');
 assert(e.evidenceChainResultState(badTiming,requirement,{stage:29}).missing.includes('INVALID_TEST_TIMING:'+negative.id),'EVIDENCE_CHAIN_INVALID_TIMING_ORACLE');
 for(const phase of['REGISTRY_CLOSURE','TERMINAL_DELIVERY']){
  const late=e.clone(receiptInput),lateTest=late.projectData.tests.find(row=>row.id===negative.id);for(const[key,value]of Object.entries({VERIFICATION_PHASE:phase,EARLIEST_EXECUTABLE_STAGE:30,REQUIRED_BY_STAGE:30,DELIVERY_REQUIRED:true})){lateTest.fields[key]=value;lateTest[key]=value;}e.refreshRecordHashes(lateTest,'tests');
  const timing=e.testDueState(late,lateTest,30,{subjectFamily:'tests',subjectId:negative.id});assert.equal(timing.valid,true,'EVIDENCE_CHAIN_LATE_DECLARATION_ORACLE');assert.notEqual(timing.targetAvailability,'TRUE','EVIDENCE_CHAIN_LATE_TARGET_ORACLE: absent canonical release targets were fabricated.');assert.equal(timing.blocking,true);assert.equal(timing.executableNow,false);assert(e.evidenceChainResultState(late,requirement,{stage:30}).missing.includes('UNAVAILABLE_TEST_TARGET:'+negative.id),'EVIDENCE_CHAIN_LATE_MISSING_TARGET_ORACLE');
 }

 const noOrdinary=e.clone(p);noOrdinary.projectData.deterministicResults=noOrdinary.projectData.deterministicResults.filter(row=>row.id!==ordinary.id);
 assert(e.evidenceChainResultState(noOrdinary,requirement,{stage:29}).missing.includes('TEST_RESULT:'+test.id),'EVIDENCE_CHAIN_ORDINARY_MISSING_ORACLE');
 const wrongRole=e.clone(p),misbound=wrongRole.projectData.deterministicResults.find(row=>row.id===ordinary.id);misbound.fields.TEST_ID=negative.id;misbound.TEST_ID=negative.id;misbound.relationships.TEST_ID=negative.id;e.refreshRecordHashes(misbound,'deterministicResults');
 assert(e.evidenceChainResultState(wrongRole,requirement,{stage:30}).missing.includes('TEST_RESULT:'+negative.id),'EVIDENCE_CHAIN_NEGATIVE_ORDINARY_SUBSTITUTION_ORACLE');
 for(let n=1;n<8;n++){receiptInput.stages[n].status='COMPLETE';receiptInput.stages[n].gate={complete:true};}receiptInput.activeStage=8;
 const prompt=r.prompts.reserveAndBuildPromptRecord(receiptInput,8,{operation:'EXECUTE_FAILURE_TEST'}).prompt,binding=prompt.contextManifest.deferredExecutionBinding;
 assert.equal(binding.subjectId,subject.id);assert.equal(binding.testId,negative.id);assert.equal(binding.phase,'FAILURE_VALIDATION');
 const original={content:'required verified content'},disposable=structuredClone(original);disposable.content='';const rejection=!disposable.content.includes('required verified content');assert.equal(rejection,true);assert.equal(original.content,'required verified content');
 const isolation={kind:'TEST_PROJECT_CLONE',identity:'synthetic-chain-fixture-'+subject.id},raw=JSON.stringify({synthetic:true,fixture:binding.fixture,fixtureSha256:binding.fixtureSha256,isolation,original,disposable,predicate:'content includes required verified content',rejection});
 const blob=new Blob([raw],{type:'application/json'}),artifactId=e.allocateId(receiptInput,'artifacts',r.copy({payload:{purpose:'SYNTHETIC_CHAIN_NEGATIVE_OBSERVATION'}})),sha=await h.sha256Bytes(blob);
 e.registerArtifactBytes(receiptInput,r.copy({stage:8,artifactId,filename:'synthetic-chain-observation.json',mediaType:'application/json',byteSize:blob.size,sha256:sha}));await r.store.putArtifact({artifactId,jobId:p.job.JOB_ID,blob,filename:'synthetic-chain-observation.json',mediaType:'application/json',expectedSha256:sha});assert.equal(await (await r.store.getArtifact(artifactId,{jobId:p.job.JOB_ID})).blob.text(),raw);
 const report={schema:s.DEFERRED_EXECUTION_EVIDENCE.schema,binding,phase:'FAILURE_VALIDATION',result:'SATISFIED',isolation,observedResult:'The declared required-content predicate rejected the disposable empty content.',performer:'Synthetic Node verifier; no real external-system execution is asserted.',evidenceLocation:'synthetic-chain-observation.json',isolationEvidence:'Original and disposable values plus the actual rejection are retained in native stored/read-back bytes.'};
 const envelope={schema:s.RESPONSE_SCHEMA,contractProfileId:s.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:8,operation:'EXECUTE_FAILURE_TEST',promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce,scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{regressionExecutions:[{tempKey:'receipt',fields:{PHASE:'FAILURE_VALIDATION',RESULT:'SATISFIED'},relationships:{MUTATION_ID:{recordId:subject.id}},evidenceRefs:['execution'],notes:'Synthetic resolver fixture; no release acceptance claimed.'}]},evidence:[{temporaryKey:'execution',kind:'EXTERNAL_EXECUTION',description:'Actual synthetic disposable predicate observation',authorityType:'EXTERNAL_SYSTEM',location:'synthetic-chain-observation.json',content:JSON.stringify(report),attachmentRef:{recordId:artifactId},notes:'Synthetic external-route fixture, not a real external system.'}],unresolved:[],warnings:[],attachments:[]};
 const prepared=r.ingestion.prepare(receiptInput,{stage:8,text:JSON.stringify(envelope),promptRecord:prompt,transport:r.copy({authority:'AUTHORITATIVE_RESPONSE_FILE',packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce})});assert.equal(prepared.validation.valid,true,'EVIDENCE_CHAIN_TYPED_RECEIPT_ADMISSION_ORACLE: '+JSON.stringify(prepared.validation.issues));
 const accepted=r.ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC_CHAIN_VERIFIER',replacementConfirmation:r.ingestion.acceptanceImpact(prepared.project,prepared.proposal.proposalId)}).project,receipt=e.records(accepted,'regressionExecutions').find(row=>e.recordValue(row,'MUTATION_ID')===subject.id);
 assert(receipt);const acceptedOrdinary=await positivePredicate(accepted);assert.equal(e.deferredExecutionPlan(accepted,30).items.find(row=>row.subjectId===subject.id).completed,true);
 const completed=e.evidenceChainResultState(accepted,requirement,{stage:30}),typed=completed.results.find(item=>item.record.id===receipt.id);assert.equal(completed.complete,true,'EVIDENCE_CHAIN_TYPED_RESULT_ORACLE: '+JSON.stringify(completed.missing));assert.equal(typed.kind,'DEFERRED_OBLIGATION');assert.equal(typed.completed,true);
 const receiptBeforeGraph=JSON.stringify(receipt),acceptedChain=e.constructEvidenceChains(accepted).find(row=>e.recordValue(row,'REQ_ID')===requirement.id);assert.equal(e.recordValue(acceptedChain,'TEST_RESULT_ID').includes(receipt.id),requiredBy===29,'EVIDENCE_CHAIN_TYPED_DUE_LINK_ORACLE');assert.equal(JSON.stringify(e.records(accepted,'regressionExecutions').find(row=>row.id===receipt.id)),receiptBeforeGraph,'EVIDENCE_CHAIN_FUTURE_HISTORY_PRESERVATION_ORACLE');
 // Validate a retained stored view that already references the future receipt;
 // new Stage29 derivations omit its result until due, but retain test inventory.
 const linkedView=e.clone(acceptedChain);linkedView.fields.TEST_RESULT_ID=[...new Set([...e.recordValue(linkedView,'TEST_RESULT_ID'),receipt.id])];linkedView.TEST_RESULT_ID=linkedView.fields.TEST_RESULT_ID;
 const explanation=e.evidenceChainExplanation(accepted,linkedView);assert(explanation.support.some(text=>text.includes(receipt.id)&&text.includes('only the typed execution obligation')),'EVIDENCE_CHAIN_NEGATIVE_EXPLANATION_ORACLE: '+JSON.stringify(explanation));assert(!explanation.support.some(text=>text.includes(receipt.id)&&text.includes('capable of proving the proposition')),'EVIDENCE_CHAIN_NEGATIVE_AFFIRMATIVE_ORACLE');
 const missingOrdinary=e.clone(accepted);missingOrdinary.projectData.deterministicResults=missingOrdinary.projectData.deterministicResults.filter(row=>row.id!==acceptedOrdinary.id);const missingChain=e.constructEvidenceChains(missingOrdinary).find(row=>e.recordValue(row,'REQ_ID')===requirement.id);assert(e.recordValue(missingChain,'MISSING_LINKS').includes('CANONICAL_EVIDENCE'),'EVIDENCE_CHAIN_NEGATIVE_AFFIRMATIVE_ORACLE: negative receipt supplied affirmative requirement evidence.');
 const stableChainIdentity=evidenceChainNoopIdentity(r,accepted,requirement.id,acceptedOrdinary.id);
 const removed=e.clone(accepted),removedReceipt=removed.projectData.regressionExecutions.find(row=>row.id===receipt.id);removedReceipt.active=false;e.refreshRecordHashes(removedReceipt,'regressionExecutions');
 assert(e.evidenceChainResultState(removed,requirement,{stage:29,resultIds:e.recordValue(linkedView,'TEST_RESULT_ID')}).missing.includes('CURRENT_RESULT:'+receipt.id),'EVIDENCE_CHAIN_FUTURE_STALE_LINK_ORACLE');
 for(const [name,alter]of [['subject-hash',row=>{row.fields.SUBJECT_SHA256='0'.repeat(64);row.SUBJECT_SHA256=row.fields.SUBJECT_SHA256;}],['target-shape',row=>{row.fields.TARGET_IDENTITIES[0].unregistered=true;row.TARGET_IDENTITIES=row.fields.TARGET_IDENTITIES;}],['isolation-shape',row=>{row.fields.ISOLATION.extra=true;row.ISOLATION=row.fields.ISOLATION;}],['wrong-phase',row=>{row.fields.PHASE='POST_CORRECTION';row.PHASE='POST_CORRECTION';}]]){
  const changed=e.clone(accepted),row=changed.projectData.regressionExecutions.find(item=>item.id===receipt.id);alter(row);e.refreshRecordHashes(row,'regressionExecutions');const state=e.evidenceChainResultState(changed,requirement,{stage:30});assert.equal(state.complete,false,'EVIDENCE_CHAIN_TYPED_GUARD_ORACLE: '+name);assert(state.missing.includes('TEST_RESULT:'+negative.id),'EVIDENCE_CHAIN_TYPED_GUARD_ORACLE: wrong rejection for '+name);
 }
 await r.store.deleteArtifact(artifactId,accepted.job.JOB_ID);const missingBytes=e.evidenceChainResultState(accepted,requirement,{stage:30});assert.equal(missingBytes.complete,false);assert(missingBytes.missing.includes('TEST_RESULT:'+negative.id),'EVIDENCE_CHAIN_TYPED_BYTES_ORACLE');
 results.push({case:'EVIDENCE_CHAIN_DUE_FRONTIER_AND_TYPED_RECEIPT',boundary:'Direct private canonical timing/resolver fixture, actual Test IR positive predicate, synthetic external-route typed receipt admission/commit and native stored/read-back evidence bytes. Not a Stage29 release journey.',future:{earliest:8,requiredBy,at29:{targetAvailability:futureTiming.targetAvailability,executableNow:futureTiming.executableNow,dueNow:futureTiming.dueNow,inventoryRetained:true,executedReceiptIncludedInStage29Graph:requiredBy===29,executedHistoryRetained:true},at30MissingRejected:true},ordinaryNativePredicate:true,typedFailureValidationReceipt:true,negativeNotAffirmativeProof:true,staleStoredFutureLinkRejected:true,malformedTimingRejected:true,lateMissingTargetsRemainBlocked:true,wrongHashTargetIsolationAndPhaseRejected:true,missingBytesRejected:true,stableChainIdentity,synthetic:true,actualBrowser:false,completePrerequisiteStages:false});
}
async function evidenceChainFrontierFaults(){
 const file='workflow-engine.js',original=fs.readFileSync(file,'utf8'),faults=[];
 for(const[name,before,after,oracle,run]of[
  ['evidence-chain-future-treated-as-due',"if(!timing.dueNow)continue;\n    const negativeOnly=", "if(false&&!timing.dueNow)continue;\n    const negativeOnly=",'EVIDENCE_CHAIN_DUE_FRONTIER_ORACLE',evidenceChainFrontierCases],
  ['evidence-chain-stored-result-current-guard-omitted',"if(resultIds!==null){const currentIds=new Set(allResults.map(item=>recordId(item.record,item.collection)));", "if(false&&resultIds!==null){const currentIds=new Set(allResults.map(item=>recordId(item.record,item.collection)));",'EVIDENCE_CHAIN_FUTURE_STALE_LINK_ORACLE',evidenceChainFrontierCases],
  ['evidence-chain-historical-pre-receipt-omitted',"priorReceipts:previous.map(row=>rid(row,'regressionExecutions'))",'priorReceipts:[]','EVIDENCE_CHAIN_PRE_HISTORY_ORACLE',deferredRegressionJourney],
  ['evidence-chain-noop-record-reuse-omitted','const unchangedPrior=prior&&prior.recordSha256===hash.recordSha256(prior)', 'const unchangedPrior=false&&prior&&prior.recordSha256===hash.recordSha256(prior)','EVIDENCE_CHAIN_NOOP_TARGET_IDENTITY_ORACLE',evidenceChainFrontierCases],
  ['evidence-chain-negative-receipt-promoted-to-affirmative',"if(item.kind==='REQUIREMENT_PROOF'&&recordValue(item.test,'TEST_ROLE')!=='NEGATIVE_ONLY')affirmativeEvidenceIds.add(id);",'affirmativeEvidenceIds.add(id);','EVIDENCE_CHAIN_NEGATIVE_AFFIRMATIVE_ORACLE',r=>evidenceChainFrontierCases(r,{requiredBy:29})]
 ]){
  assert.equal(original.split(before).length-1,1,'EVIDENCE_CHAIN_FAULT_ANCHOR_ORACLE: '+name);let caught;
  try{await run(runtime({[file]:original.replace(before,after)}));}catch(error){caught=error;}
  assert(caught?.message.includes(oracle),'Fault was not caught by its intended evidence-chain invariant: '+name+' '+caught?.message);faults.push({name,oracle,detected:true,observedCode:caught.code,observedMessage:caught.message,boundary:'Direct isolated canonical chain result resolver; actual native predicate or typed synthetic receipt'});assert.equal(fs.readFileSync(file,'utf8'),original);
 }
 return faults;
}
if(process.argv.includes('--evidence-chain-frontier-only')){await evidenceChainFrontierCases(runtime());await evidenceChainFrontierCases(runtime(),{requiredBy:29});console.log(JSON.stringify({evidenceChainFrontier:'PASS',results}));process.exit(0);}
if(process.argv.includes('--evidence-chain-faults-only')){console.log(JSON.stringify({evidenceChainFaults:'PASS',faults:await evidenceChainFrontierFaults(),sourceRestored:true}));process.exit(0);}
if(process.argv.includes('--deferred-reservations')){await deferredReservationBoundaries(runtime());console.log(JSON.stringify({deferredReservations:'PASS',results}));process.exit(0);}
if(process.argv.includes('--deferred-regression')){await deferredRegressionJourney(runtime());console.log(JSON.stringify({deferredRegression:'PASS',results}));process.exit(0);}
if(process.argv.includes('--deferred-native')){await deferredNativeJourney(runtime());console.log(JSON.stringify({deferredNative:'PASS',results}));process.exit(0);}
const deferredFixture=process.argv.find(arg=>arg.startsWith('--deferred-fixture='))?.slice('--deferred-fixture='.length);
if(deferredFixture||process.argv.includes('--deferred-small')){await deferredReceiptJourney(runtime(),deferredFixture);console.log(JSON.stringify({deferredExecution:'PASS',results}));process.exit(0);}
if(process.argv.includes('--deferred-only')){
 const ref=process.argv.find(arg=>arg.startsWith('--source-ref='))?.slice('--source-ref='.length),overrides={};
 if(ref)for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])overrides[file]=execFileSync('git',['show',ref+':'+file],{encoding:'utf8',timeout:10000,maxBuffer:8*1024*1024});
 deferredExecutionRouting(runtime(overrides));console.log(JSON.stringify({deferredExecution:'PASS',source:ref||'WORKING_TREE',results}));process.exit(0);
}
if(process.argv.includes('--regression-only')){
 const ref=process.argv.find(arg=>arg.startsWith('--source-ref='))?.slice('--source-ref='.length),overrides={};
 if(ref)for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])overrides[file]=execFileSync('git',['show',ref+':'+file],{encoding:'utf8',timeout:10000,maxBuffer:8*1024*1024});
 regressionIterationBoundary(runtime(overrides));regressionTimingConsumers(runtime(overrides));console.log(JSON.stringify({regressionTiming:'PASS',source:ref||'WORKING_TREE',results}));process.exit(0);
}
async function legitimateDeferredReturnedJourney(retained,{sourceOverrides={},caseIds=['SATISFIED','UNDETERMINED','UNDETERMINED_AT9','INVALID_REPORT'],recoveryDir=null,expectedInternalFailure=false}={}){
 assert.equal(retained.schema,'closed-loop-counterpart-diagnostic-prefix/1');assert.equal(retained.earlierCompleteFlagsForced,false);
 const results=[],proofRecovery=recoveryDir||fs.mkdtempSync(path.join(os.tmpdir(),'clrt-deferred-returned-proof-'));fs.mkdirSync(proofRecovery,{recursive:true});
async function verifyProducerFailureRetry({r,input,prepared,prompt,manifest,files,text}) {
 const e=r.engine,i=r.ingestion;
 assert.equal(prepared.validation.valid,false,'DEFERRED_TYPED_PRODUCER_FAILURE_ORACLE');assert.equal(prepared.proposal,null);
 const expected=prepared.validation.issues.find(row=>row.code==='INVALID_DEFERRED_EXECUTION_RECEIPT');assert(expected,'DEFERRED_TYPED_PRODUCER_FAILURE_ORACLE: '+JSON.stringify(prepared.validation.issues));
 assert.equal(prepared.rawRecord.status,'VALIDATION_FAILED');assert(prepared.disposition.issueCodes.includes(expected.code),'DEFERRED_TYPED_FAILURE_DISPOSITION_ORACLE');
 assert.equal(e.records(prepared.project,'regressionExecutions').filter(row=>e.recordValue(row,'MUTATION_ID')===retained.definitionId).length,0);
 assert.equal(JSON.stringify(prepared.project.projectData.artifacts),JSON.stringify(input.projectData.artifacts),'DEFERRED_TYPED_FAILURE_NONCANONICAL_ORACLE');
 const priorIds=new Set(input.projectData.allocationReceipts.map(row=>row.resultingId)),added=prepared.project.projectData.allocationReceipts.filter(row=>!priorIds.has(row.resultingId));
 assert(added.length>0);assert(added.every(row=>['responseValidations','outputReceipts','responseDispositions','history'].includes(row.collection)),'DEFERRED_FAILED_PLAN_IDENTITY_ROLLBACK_ORACLE: '+JSON.stringify(added.map(row=>row.collection)));
 let saved=await r.store.writeProject(prepared.project,{operational:true,expectedProjectRevision:input.revision,expectedStateSha256:input.projectSha256});
 const reloaded=await r.store.readProject(saved.job.JOB_ID);assert.equal(i.findValidation(reloaded,prepared.validation.validationId).issues.find(row=>row.code===expected.code).message,expected.message);assert.equal(i.findRaw(reloaded,prepared.rawRecord.rawResponseId).completeRawResponse,text);
 const draft=r.copy(reloaded),continuation=i.prepareStageContinuation(draft,{stage:8,owningTabInstance:'SYNTHETIC_DEFERRED_RETRY'});assert(continuation?.created,'DEFERRED_TYPED_FAILURE_CONTINUATION_ORACLE: '+JSON.stringify(continuation));
 saved=await r.store.writeProject(draft,{expectedProjectRevision:reloaded.revision,expectedStateSha256:reloaded.projectSha256});
 const next=saved.projectData.generatedPrompts.find(row=>row.instructionId===continuation.prompt.instructionId);assert.notEqual(next.instructionId,prompt.instructionId);assert.notEqual(next.operationReservationId,prompt.operationReservationId);
 const pkg=await r.store.createExecutionPackage({jobId:saved.job.JOB_ID,stage:8,operation:'EXECUTE_FAILURE_TEST',instructionId:next.instructionId}),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer()));
 const bytes=Buffer.from(members.find(row=>row.canonicalPath==='instruction.txt').bytes);assert.equal(bytes.toString('utf8'),next.prompt);
 assert(bytes.toString('utf8').includes(expected.code)&&bytes.toString('utf8').includes(expected.message),'DEFERRED_TYPED_FAILURE_NEXT_EXPORTED_CARRIER_ORACLE');
 assert.equal(e.gate(8,saved).complete,false);assert.equal(e.currentDeferredExecution(saved,8,'EXECUTE_FAILURE_TEST').completed,false);
 fs.writeFileSync(proofRecovery+'/stage8-typed-producer-failure-and-retry.json',JSON.stringify({baseSourceSha:'88220df8cee15ffed5b7d6bc948cb5ca80e6abc4',sourceFingerprints:Object.fromEntries(['workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'].map(name=>[name,r.runtime.closedLoopHash.sha256Text(fs.readFileSync(name,'utf8'))])),project:saved,artifacts:await captureArtifactFixture(r.store,saved.job.JOB_ID),invalidResponseText:text,validation:prepared.validation,disposition:prepared.disposition,nextInstructionUtf8:bytes.toString('utf8'),nextExecutionPackageBase64:Buffer.from(await pkg.blob.arrayBuffer()).toString('base64'),synthetic:true,actualBrowser:false}));
 const freshCorrection=await verifyUnresolvedThenSatisfiedRetry(r,saved,8,{existingPrompt:next,requireReplacement:false});
 return {errorCode:expected.code,errorMessage:expected.message,rawPersisted:true,validationPersisted:true,canonicalArtifactsUnchanged:true,speculativeIdentityAllocationRolledBack:true,newReservation:true,exactNextExportCarriesFailure:true,stageComplete:false,selectedSubjectCompleteBeforeCorrection:false,freshCorrection};
}
async function acceptOrdinaryStage8(r,input) {
 const e=r.engine,i=r.ingestion;let saved=input;const draft=r.copy(saved),reserved=r.prompts.reserveAndBuildPromptRecord(draft,8,{operation:'COMPLETE'}).prompt;
 saved=await r.store.writeProject(draft,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});const prompt=saved.projectData.generatedPrompts.find(row=>row.instructionId===reserved.instructionId),pkg=await r.store.createExecutionPackage({jobId:saved.job.JOB_ID,stage:8,operation:'COMPLETE',instructionId:prompt.instructionId}),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),manifest=JSON.parse(Buffer.from(members.find(row=>row.canonicalPath==='manifest.json').bytes).toString('utf8'));
 const envelope=responseFixture({schema:r.runtime.closedLoopWorkflowSchema,engine:e,prompt,manifest,instructionBytes:Buffer.from(members.find(row=>row.canonicalPath==='instruction.txt').bytes)}),text=JSON.stringify(envelope),staged=await r.store.stageResponseFile({jobId:saved.job.JOB_ID,stage:8,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce}),file=await r.store.readStagedResponseFile({jobId:saved.job.JOB_ID,stagingId:staged.stagingId});
 const captured=i.captureRaw(saved,{stage:8,text:new TextDecoder('utf-8',{fatal:true}).decode(file.bytes),promptRecord:prompt,files:[],transport:r.copy({authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,rawFilename:'response.json',mediaType:'application/json',status:file.status,sha256:file.sha256,byteSize:file.byteSize,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce})});
 saved=await r.store.writeProject(captured.project,{operational:true,expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});const prepared=i.prepareCaptured(saved,{rawResponseId:captured.rawRecord.rawResponseId});assert.equal(prepared.validation.valid,true,'DEFERRED_CROSS_STAGE_ORDINARY8_ADMISSION_ORACLE: '+JSON.stringify(prepared.validation.issues));saved=await r.store.writeProject(prepared.project,{operational:true,expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
 const committed=i.commit(saved,prepared.proposal.proposalId,{operator:'SYNTHETIC_ORDINARY8_FOR_RETRY',replacementConfirmation:i.acceptanceImpact(saved,prepared.proposal.proposalId)}),impact=r.store.mutationImpact(saved,committed.project);saved=await r.store.writeProject(committed.project,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256,...(impact.requiresConfirmation?{mutationConfirmation:impact}:{})});saved=await r.store.readProject(saved.job.JOB_ID);assert.equal(e.gate(8,saved).complete,true,'DEFERRED_CROSS_STAGE_ORDINARY8_GATE_ORACLE: '+JSON.stringify(e.gate(8,saved)));return saved;
}
function verifyMaterialReceiptIdentity(r,project,prepared) {
 const e=r.engine,record=prepared.proposal.canonicalRecords.regressionExecutions[0],evidence=prepared.proposal.evidence,expected=e.scopedObservationIdentity('regressionExecutions',record,project,evidence);assert(expected,'DEFERRED_RECEIPT_TARGET_IDENTITY_ORACLE');
 const checks=[],alter=(name,change)=>{const row=r.copy(record),items=r.copy(evidence),item=items.find(item=>e.recordId(item,'evidenceRecords')===e.recordValue(row,'EVIDENCE_ID')),report=JSON.parse(e.recordValue(item,'CONTENT'));change(report,row);item.fields.CONTENT=item.CONTENT=JSON.stringify(report);const actual=e.scopedObservationIdentity('regressionExecutions',row,project,items);assert.notEqual(actual,expected,'DEFERRED_RECEIPT_MATERIAL_SCOPE_ORACLE: '+name);checks.push({name,distinct:true});};
 alter('subject definition digest',(report,row)=>{report.binding.subjectSha256='0'.repeat(64);row.fields.SUBJECT_SHA256=row.SUBJECT_SHA256=report.binding.subjectSha256;});
 alter('execution test digest',report=>{report.binding.testSha256='0'.repeat(64);});
 alter('fixture content and digest',report=>{report.binding.fixture='VERIFIED\n';report.binding.fixtureSha256=r.runtime.closedLoopHash.sha256Text(report.binding.fixture);});
 alter('canonical input values',report=>{report.binding.canonicalInputs={untrustedChangedInput:{canonicalKey:'CHANGED',valueSha256:'0'.repeat(64)}};});
 alter('ordered target digest',(report,row)=>{report.binding.targetIdentities[0].recordSha256='0'.repeat(64);row.fields.TARGET_IDENTITIES=row.TARGET_IDENTITIES=r.copy(report.binding.targetIdentities);});
 for(const name of ['inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion'])alter(name,report=>{report.binding.scope[name]='UNAUTHORIZED_CHANGED_TEST_VALUE';});
 const attempt=r.copy(record),attemptEvidence=r.copy(evidence),item=attemptEvidence.find(item=>e.recordId(item,'evidenceRecords')===e.recordValue(attempt,'EVIDENCE_ID')),report=JSON.parse(e.recordValue(item,'CONTENT'));report.binding.projectRevision+=1;report.binding.historyActivationId='UNAUTHORIZED_ATTEMPT_TEST_VALUE';report.isolation.identity+='-another-observation';attempt.fields.ISOLATION=attempt.ISOLATION=r.copy(report.isolation);item.fields.CONTENT=item.CONTENT=JSON.stringify(report);assert.equal(e.scopedObservationIdentity('regressionExecutions',attempt,project,attemptEvidence),expected,'DEFERRED_RECEIPT_ATTEMPT_IS_NOT_TARGET_ORACLE');
 return {basis:'Independently specified material binding separation at identity helper only; no altered object is admitted or asserted as execution evidence.',checks,attemptDimensionsExcluded:true};
}
async function verifyUnresolvedThenSatisfiedRetry(r,input,stage=8,{existingPrompt=null,requireReplacement=true}={}) {
 const e=r.engine,i=r.ingestion,s=r.runtime.closedLoopWorkflowSchema,h=r.runtime.closedLoopHash;
 assert.equal(e.currentDeferredExecution(input,stage,'EXECUTE_FAILURE_TEST').completed,false);
 let saved=input,prompt=existingPrompt;
 if(!prompt){const draft=r.copy(saved),reserved=r.prompts.reserveAndBuildPromptRecord(draft,stage,{operation:'EXECUTE_FAILURE_TEST'}).prompt;saved=await r.store.writeProject(draft,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});prompt=saved.projectData.generatedPrompts.find(row=>row.instructionId===reserved.instructionId);}
 const pkg=await r.store.createExecutionPackage({jobId:saved.job.JOB_ID,stage,operation:'EXECUTE_FAILURE_TEST',instructionId:prompt.instructionId}),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer()));
 const manifest=JSON.parse(Buffer.from(members.find(row=>row.canonicalPath==='manifest.json').bytes).toString('utf8')),binding=prompt.contextManifest.deferredExecutionBinding,slot=manifest.attachmentSlots.find(row=>row.role==='SUPPORTING_EVIDENCE');
 const expected=Buffer.from('VERIFIED\n'),invalid=Buffer.from(binding.fixture);assert.notDeepEqual(invalid,expected);assert.deepEqual(expected,Buffer.from('VERIFIED\n'));
 const isolation={kind:'TEST_PROJECT_CLONE',identity:'synthetic-node-unresolved-corrected'},raw=JSON.stringify({schema:'SYNTHETIC_DISPOSABLE_COMPARISON/1',synthetic:true,binding,isolation,actualInvalidRejected:!invalid.equals(expected),actualConformingAccepted:expected.equals(Buffer.from('VERIFIED\n')),externalActor:false,actualBrowser:false}),blob=new Blob([raw],{type:'application/json'}),sha=await h.sha256Bytes(blob);
 const report={schema:s.DEFERRED_EXECUTION_EVIDENCE.schema,binding,phase:binding.phase,result:'SATISFIED',isolation,observedResult:'Actual eight-byte invalid fixture rejected and nine-byte LF control accepted.',performer:'Synthetic Node executor in disposable comparison',evidenceLocation:'synthetic-retry-execution.json',isolationEvidence:'Exact isolated inputs and comparison retained as returned bytes; synthetic only.'};
 const envelope={schema:s.RESPONSE_SCHEMA,contractProfileId:s.CONTRACT_PROFILE_ID,jobId:manifest.jobId,stage:manifest.stage,operation:manifest.operation,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:manifest.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{regressionExecutions:[{tempKey:'receipt',fields:{PHASE:binding.phase,RESULT:'SATISFIED'},relationships:{MUTATION_ID:{recordId:binding.subjectId}},evidenceRefs:['execution'],notes:'Synthetic corrected retry.'}]},evidence:[{temporaryKey:'execution',kind:'EXTERNAL_EXECUTION',description:'Actual synthetic corrected comparison',authorityType:'EXTERNAL_SYSTEM',location:'synthetic-retry-execution.json',content:JSON.stringify(report),attachmentRef:{tempKey:'returned'},notes:'Synthetic fixture, not real external acceptance.'}],unresolved:[],warnings:[],attachments:[{temporaryKey:'returned',attachmentSlotId:slot.attachmentSlotId,role:slot.role,filename:'synthetic-retry-execution.json',mediaType:'application/json',byteSize:blob.size,sha256:sha,required:true}]};
 const received=r.copy(saved),artifactId=e.allocateId(received,'artifacts',r.copy({targetSlot:slot.attachmentSlotId,payload:{stage,filename:'synthetic-retry-execution.json',mediaType:'application/json',byteSize:blob.size,sha256:sha}})),stored=await r.store.putArtifact({artifactId,jobId:saved.job.JOB_ID,blob,filename:'synthetic-retry-execution.json',mediaType:'application/json',expectedSha256:sha}),text=JSON.stringify(envelope);
 const staged=await r.store.stageResponseFile({jobId:saved.job.JOB_ID,stage,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce}),file=await r.store.readStagedResponseFile({jobId:saved.job.JOB_ID,stagingId:staged.stagingId});
 const captured=i.captureRaw(received,{stage,text:new TextDecoder('utf-8',{fatal:true}).decode(file.bytes),promptRecord:prompt,files:[{artifactId,name:stored.filename,type:stored.mediaType,size:stored.byteSize,sha256:stored.sha256,attachmentSlotId:slot.attachmentSlotId}],transport:r.copy({authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,rawFilename:'response.json',mediaType:'application/json',status:file.status,sha256:file.sha256,byteSize:file.byteSize,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce})});
 saved=await r.store.writeProject(captured.project,{operational:true,expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});const prepared=i.prepareCaptured(saved,{rawResponseId:captured.rawRecord.rawResponseId});assert.equal(prepared.validation.valid,true,'DEFERRED_VALID_RETRY_ADMISSION_ORACLE: '+JSON.stringify(prepared.validation.issues));
 saved=await r.store.writeProject(prepared.project,{operational:true,expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});const confirmation=i.acceptanceImpact(saved,prepared.proposal.proposalId);assert.equal(confirmation.replaces.some(row=>row.kind==='regressionExecutions'),requireReplacement,'DEFERRED_VALID_RETRY_REPLACEMENT_CONFIRMATION_ORACLE');if(requireReplacement)assert.throws(()=>i.commit(saved,prepared.proposal.proposalId,{operator:'SYNTHETIC_MISSING_REPLACEMENT_CONFIRMATION'}),error=>error.code==='REPLACEMENT_CONFIRMATION_REQUIRED','DEFERRED_REPLACEMENT_REQUIRES_HUMAN_CONFIRMATION_ORACLE');const committed=i.commit(saved,prepared.proposal.proposalId,{operator:'SYNTHETIC_VALID_RETRY',replacementConfirmation:confirmation}),impact=r.store.mutationImpact(saved,committed.project);
 saved=await r.store.writeProject(committed.project,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256,...(impact.requiresConfirmation?{mutationConfirmation:impact}:{})});saved=await r.store.readProject(saved.job.JOB_ID);
 const state=e.currentDeferredExecution(saved,stage,'EXECUTE_FAILURE_TEST',{subjectId:binding.subjectId,allowCompleted:true}),receipts=e.records(saved,'regressionExecutions').filter(row=>e.recordValue(row,'MUTATION_ID')===binding.subjectId);
 fs.writeFileSync(proofRecovery+'/stage'+stage+'-unresolved-then-satisfied.json',JSON.stringify({baseSourceSha:'88220df8cee15ffed5b7d6bc948cb5ca80e6abc4',project:saved,artifacts:await captureArtifactFixture(r.store,saved.job.JOB_ID),state,receipts,manifest,instructionUtf8:Buffer.from(members.find(row=>row.canonicalPath==='instruction.txt').bytes).toString('utf8'),executionPackageBase64:Buffer.from(await pkg.blob.arrayBuffer()).toString('base64'),responseText:text,rawAttachmentText:raw,synthetic:true,actualBrowser:false}));
 assert.equal(state.completed,true,'DEFERRED_VALID_RETRY_PROGRESS_ORACLE: '+JSON.stringify({state,receipts:receipts.map(row=>({id:e.recordId(row,'regressionExecutions'),result:e.recordValue(row,'RESULT'),active:row.active,invalidatedBy:row.invalidatedBy}))}));return {admitted:true,committed:true,reloaded:true,completed:true,receiptCount:receipts.length};
}
for(const caseId of caseIds) {
 const result=caseId==='INVALID_REPORT'?'SATISFIED':caseId==='UNDETERMINED_AT9'?'UNDETERMINED':caseId;
 const r=projectStoreRuntime({sourceOverrides}),e=r.engine,i=r.ingestion,s=r.runtime.closedLoopWorkflowSchema,h=r.runtime.closedLoopHash;
 await restoreArtifactFixture(r.store,retained.artifacts);
 const p=r.copy(retained.project);p.activeStage=8;await hydrateRetainedPromptContexts(r,p,retained.contextFiles);
 assert.equal(e.gate(7,p).complete,true,'LEGITIMATE_CONDITIONAL_UPSTREAM_ORACLE');
 let saved=await r.store.writeProject(p,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
 const draft=r.copy(saved),reserved=r.prompts.reserveAndBuildPromptRecord(draft,8,{operation:'EXECUTE_FAILURE_TEST'}).prompt;
 saved=await r.store.writeProject(draft,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
 const prompt=saved.projectData.generatedPrompts.find(row=>row.instructionId===reserved.instructionId);
 const exported=await r.store.createExecutionPackage({jobId:saved.job.JOB_ID,stage:8,operation:'EXECUTE_FAILURE_TEST',instructionId:prompt.instructionId});
 const members=readStoreArchive(new Uint8Array(await exported.blob.arrayBuffer()));
 const member=path=>{const row=members.find(row=>row.canonicalPath===path);assert(row,'Missing exact exported member '+path);return Buffer.from(row.bytes);};
 const manifest=JSON.parse(member('manifest.json').toString('utf8')),instructionBytes=member('instruction.txt');
 assert.equal(instructionBytes.toString('utf8'),prompt.prompt);assert.equal(manifest.operation,'EXECUTE_FAILURE_TEST');assert.equal(manifest.stage,8);
 {
 assert(manifest.responseContract.deferredExecutionEvidenceContract,'DEFERRED_PUBLISHED_VOCABULARY_ORACLE');
 assert.deepEqual(JSON.parse(JSON.stringify(manifest.responseContract.deferredExecutionEvidenceContract.resultValues)),['SATISFIED','VIOLATED','UNDETERMINED']);
 assert.deepEqual(JSON.parse(JSON.stringify(manifest.responseContract.deferredExecutionEvidenceContract.isolationKinds)),['TEST_PROJECT_CLONE','TEST_STORAGE_NAMESPACE','IMMUTABLE_ARTIFACT_COPY','ISOLATED_WORKER_INPUT','AUTHORIZED_EXTERNAL_SANDBOX']);
 assert.deepEqual(JSON.parse(JSON.stringify(manifest.responseContract.deferredExecutionEvidenceContract.isolationFields)),['kind','identity']);
 assert(manifest.responseContract.deferredExecutionEvidenceContract.nonblankReportValueRule.includes('trimmed text'));
 assert(instructionBytes.toString('utf8').includes('TEST_PROJECT_CLONE')&&instructionBytes.toString('utf8').includes('UNDETERMINED'),'DEFERRED_PUBLISHED_VOCABULARY_ORACLE');
 }
 assert.equal(manifest.promptIdentity.instructionId,prompt.instructionId);assert.equal(manifest.operationReservationId,prompt.operationReservationId);
 for(const file of manifest.contextFiles){const bytes=member(file.path);assert.equal(bytes.length,file.byteSize);assert.equal(h.sha256Text(bytes.toString('utf8')),file.sha256);}
 const binding=prompt.contextManifest.deferredExecutionBinding;
 assert.equal(binding.subjectId,retained.definitionId);assert.equal(binding.testId,retained.testId);
 const selected=e.currentDeferredExecution(saved,8,'EXECUTE_FAILURE_TEST');assert.equal(selected.subjectId,retained.definitionId);assert.equal(selected.completed,false);
 const definition=e.records(saved,'failureTests').find(row=>e.recordId(row,'failureTests')===binding.subjectId),beforeDefinition=JSON.stringify(definition);
 const expected=Buffer.from('VERIFIED\n','utf8'),invalid=Buffer.from(e.recordValue(definition,'FIXTURE'),'utf8'),conforming=bytes=>Buffer.from(bytes).equals(expected);
 assert.equal(expected.length,9);assert.equal(invalid.length,8);assert.equal(conforming(expected),true);assert.equal(conforming(invalid),false);
 const isolation={kind:'TEST_PROJECT_CLONE',identity:'synthetic-node-disposable-'+result};
 const raw=JSON.stringify({schema:'SYNTHETIC_DISPOSABLE_COMPARISON/1',synthetic:true,sourceSha:'88220df8cee15ffed5b7d6bc948cb5ca80e6abc4',operation:manifest.operation,stage:manifest.stage,binding,isolation,conformingControl:{utf8Base64:expected.toString('base64'),accepted:conforming(expected)},negativeFixture:{utf8Base64:invalid.toString('base64'),accepted:conforming(invalid)},observation:result==='SATISFIED'?'Executed comparison rejects the eight-byte invalid fixture and accepts the nine-byte conforming control.':'Deliberate unresolved control; result remains UNDETERMINED.',externalActor:false,humanAction:false,actualBrowser:false});
 const blob=new Blob([raw],{type:'application/json'}),rawSha=await h.sha256Bytes(blob),slot=manifest.attachmentSlots.find(row=>row.role==='SUPPORTING_EVIDENCE');assert(slot);
 const report={schema:s.DEFERRED_EXECUTION_EVIDENCE.schema,binding,phase:'FAILURE_VALIDATION',result,isolation,observedResult:result==='SATISFIED'?'Eight-byte missing-LF fixture rejected; nine-byte conforming control accepted.':'Deliberate unresolved control; result remains UNDETERMINED.',performer:'Synthetic Node executor in isolated test adapter',evidenceLocation:'synthetic-isolated-execution.json',isolationEvidence:'Actual disposable comparison inputs and outputs retained in returned attachment; no real-project or human acceptance claimed.'};
 const envelope={schema:s.RESPONSE_SCHEMA,contractProfileId:s.CONTRACT_PROFILE_ID,jobId:manifest.jobId,stage:manifest.stage,operation:manifest.operation,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:manifest.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{regressionExecutions:[{tempKey:'receipt',fields:{PHASE:'FAILURE_VALIDATION',RESULT:result},relationships:{MUTATION_ID:{recordId:binding.subjectId}},evidenceRefs:['execution'],notes:'Synthetic regression proof only; no real-project execution asserted.'}]},evidence:[{temporaryKey:'execution',kind:'EXTERNAL_EXECUTION',description:'Actual synthetic isolated comparison observation',authorityType:'EXTERNAL_SYSTEM',location:'synthetic-isolated-execution.json',content:JSON.stringify(report),attachmentRef:{tempKey:'raw-execution'},notes:'Synthetic Node executor; not real external-system acceptance.'}],unresolved:[],warnings:[],attachments:[{temporaryKey:'raw-execution',attachmentSlotId:slot.attachmentSlotId,role:slot.role,filename:'synthetic-isolated-execution.json',mediaType:'application/json',byteSize:blob.size,sha256:rawSha,required:true}]};
 assert.equal(i.attachmentSlotPlan(saved,r.copy(envelope),prompt)[0].attachmentSlotId,slot.attachmentSlotId);
 const received=r.copy(saved),artifactId=e.allocateId(received,'artifacts',r.copy({targetSlot:slot.attachmentSlotId,payload:{stage:8,filename:'synthetic-isolated-execution.json',mediaType:'application/json',byteSize:blob.size,sha256:rawSha}}));
 const stored=await r.store.putArtifact({artifactId,jobId:saved.job.JOB_ID,blob,filename:'synthetic-isolated-execution.json',mediaType:'application/json',expectedSha256:rawSha});
 assert.equal(stored.sha256,rawSha);assert.equal(await (await r.store.getArtifact(artifactId,{jobId:saved.job.JOB_ID})).blob.text(),raw);
 if(caseId==='INVALID_REPORT')delete envelope.evidence[0].attachmentRef;
 const text=JSON.stringify(envelope),staged=await r.store.stageResponseFile({jobId:saved.job.JOB_ID,stage:8,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce});
 const file=await r.store.readStagedResponseFile({jobId:saved.job.JOB_ID,stagingId:staged.stagingId});assert.equal(new TextDecoder('utf-8',{fatal:true}).decode(file.bytes),text);
 const files=[{artifactId,name:stored.filename,type:stored.mediaType,size:stored.byteSize,sha256:stored.sha256,attachmentSlotId:slot.attachmentSlotId}];
 const transport={authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,rawFilename:'response.json',mediaType:'application/json',status:file.status,sha256:file.sha256,byteSize:file.byteSize,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce};
 const captured=i.captureRaw(received,{stage:8,text,promptRecord:prompt,files:r.copy(files),transport:r.copy(transport)});
 saved=await r.store.writeProject(captured.project,{operational:true,expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
 const admission=i.validateEnvelope(saved,r.copy(envelope),{stage:8,promptRecord:prompt,rawSha256:file.sha256,rawResponseId:captured.rawRecord.rawResponseId,files:r.copy(files)});
 assert.equal(admission.valid,true,'LEGITIMATE_CONDITIONAL_PUBLISHED_ADMISSION_ORACLE: '+JSON.stringify(admission.issues));
 fs.writeFileSync(proofRecovery+'/stage8-preplanning-'+caseId.toLowerCase()+'.json',JSON.stringify({baseSourceSha:'88220df8cee15ffed5b7d6bc948cb5ca80e6abc4',sourceFingerprints:Object.fromEntries(['workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'].map(name=>[name,h.sha256Text(sourceOverrides[name]||fs.readFileSync(name,'utf8'))])),executionPackageBase64:Buffer.from(await exported.blob.arrayBuffer()).toString('base64'),project:saved,artifacts:await captureArtifactFixture(r.store,saved.job.JOB_ID),manifest,exportedInstructionUtf8:instructionBytes.toString('utf8'),responseText:text,rawAttachmentText:raw,files,admission,synthetic:true,actualBrowser:false}));
 console.error(JSON.stringify({phase:'valid-response-and-actual-returned-file-before-plan',result,admissionValid:admission.valid,artifactCanonicalBeforePlan:e.records(saved,'artifacts').some(row=>e.recordId(row,'artifacts')===artifactId),byteCustody:r.store.artifactCustodyState({jobId:saved.job.JOB_ID,artifactId,filename:stored.filename,byteSize:stored.byteSize,sha256:stored.sha256}),artifactId}));
 const beforePrepare=JSON.stringify(saved);let prepared;try{prepared=i.prepareCaptured(saved,{rawResponseId:captured.rawRecord.rawResponseId});}catch(error){if(expectedInternalFailure){assert.equal(error.code,'INJECTED_INTERNAL_NORMALIZATION_FAULT','DEFERRED_UNEXPECTED_INTERNAL_ERROR_ORACLE');assert.equal(JSON.stringify(saved),beforePrepare,'DEFERRED_UNEXPECTED_INTERNAL_ERROR_MUTATION_ORACLE');const actualStored=await r.store.readProject(saved.job.JOB_ID);assert.equal(i.findRaw(actualStored,captured.rawRecord.rawResponseId).completeRawResponse,text,'DEFERRED_UNEXPECTED_INTERNAL_ERROR_RECOVERY_ORACLE');assert.equal(JSON.stringify(actualStored.projectData.artifacts),JSON.stringify(saved.projectData.artifacts));results.push({case:'UNEXPECTED_INTERNAL_ERROR_PROPAGATES',code:error.code,rawPersisted:true,inputUnchanged:true,canonicalArtifactsUnchanged:true});continue;}if(caseId==='INVALID_REPORT'&&error.code==='INVALID_DEFERRED_EXECUTION_RECEIPT')assert.fail('DEFERRED_TYPED_PRODUCER_FAILURE_ORACLE: a known producer error escaped without a retained validation/retry record.');throw error;}
 assert.equal(expectedInternalFailure,false,'DEFERRED_UNEXPECTED_INTERNAL_ERROR_ORACLE: injected internal failure was hidden.');
 if(caseId==='INVALID_REPORT'){const retryProof=await verifyProducerFailureRetry({r,input:saved,prepared,prompt,manifest,files,text});results.push({caseId,retryProof,synthetic:true,actualBrowser:false});continue;}
 assert.equal(prepared.validation.valid,true,'LEGITIMATE_CONDITIONAL_ADMISSION_ORACLE: '+JSON.stringify(prepared.validation.issues));assert.equal(prepared.proposal.status,'PENDING_OPERATOR_REVIEW');
 const materialIdentity=verifyMaterialReceiptIdentity(r,saved,prepared);
 const priorAllocated=new Set(saved.projectData.allocationReceipts.map(row=>row.resultingId));const planAllocations=prepared.project.projectData.allocationReceipts.filter(row=>!priorAllocated.has(row.resultingId));assert(planAllocations.some(row=>row.collection==='responseProposals')&&planAllocations.some(row=>row.collection==='evidenceRecords')&&planAllocations.some(row=>row.collection==='regressionExecutions'),'DEFERRED_SUCCESSFUL_PLAN_IDENTITY_CONTROL_ORACLE');
 assert.equal(JSON.stringify(prepared.project.projectData.artifacts),JSON.stringify(saved.projectData.artifacts),'DEFERRED_PROJECTION_MUST_NOT_PROMOTE_CANONICAL_ARTIFACTS');
 assert.equal(e.records(prepared.project,'regressionExecutions').filter(row=>e.recordValue(row,'MUTATION_ID')===binding.subjectId).length,0,'LEGITIMATE_CONDITIONAL_ACCEPTANCE_BOUNDARY_ORACLE');
 saved=await r.store.writeProject(prepared.project,{operational:true,expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
 const committed=i.commit(saved,prepared.proposal.proposalId,{operator:'SYNTHETIC_CONDITIONAL_OWNER_CONTROL',replacementConfirmation:i.acceptanceImpact(saved,prepared.proposal.proposalId)}),impact=r.store.mutationImpact(saved,committed.project);
 saved=await r.store.writeProject(committed.project,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256,...(impact.requiresConfirmation?{mutationConfirmation:impact}:{})});
 const reloaded=await r.store.readProject(saved.job.JOB_ID),receipt=e.records(reloaded,'regressionExecutions').find(row=>e.recordValue(row,'MUTATION_ID')===binding.subjectId);assert(receipt);assert.equal(e.recordValue(receipt,'RESULT'),result);
 const state=e.deferredExecutionPlan(reloaded,8,{operation:'EXECUTE_FAILURE_TEST'}).items.find(row=>row.subjectId===binding.subjectId);
 assert.equal(state.completed,result==='SATISFIED','LEGITIMATE_CONDITIONAL_RESULT_GATE_ORACLE: '+JSON.stringify(state));assert.equal(e.gate(8,reloaded).complete,false,'A conditional receipt cannot replace the ordinary Stage8 instruction');
 assert.equal(JSON.stringify(e.records(reloaded,'failureTests').find(row=>e.recordId(row,'failureTests')===binding.subjectId)),beforeDefinition,'LEGITIMATE_CONDITIONAL_APPEND_ONLY_DEFINITION_ORACLE');
 assert.equal(i.findRaw(reloaded,captured.rawRecord.rawResponseId).completeRawResponse,text);assert.equal(await (await r.store.getArtifact(artifactId,{jobId:reloaded.job.JOB_ID})).blob.text(),raw);assert.equal(r.store.validateProjectIntegrity(reloaded).valid,true);
 assert.equal(i.commit(reloaded,prepared.proposal.proposalId,{operator:'SYNTHETIC_CONDITIONAL_OWNER_CONTROL'}).idempotent,true);
 const conflicting=e.clone(reloaded),conflictBefore=JSON.stringify(conflicting);assert.throws(()=>e.registerArtifactBytes(conflicting,r.copy({stage:8,artifactId,filename:stored.filename,mediaType:stored.mediaType,byteSize:stored.byteSize,sha256:'0'.repeat(64),role:'RETURNED_ATTACHMENT',lineage:{rawResponseId:captured.rawRecord.rawResponseId,attachmentSlotId:slot.attachmentSlotId}})),error=>error.code==='ARTIFACT_IDENTITY_CONFLICT','DEFERRED_RETURNED_ARTIFACT_IDENTITY_CONFLICT_ORACLE');assert.equal(JSON.stringify(conflicting),conflictBefore);
 const rejected=(value,selectedFiles=files,input=received)=>{
   const before=JSON.stringify(input);
   try{const out=i.prepare(input,{stage:8,text:JSON.stringify(value),promptRecord:prompt,files:r.copy(selectedFiles),transport:r.copy({authority:'AUTHORITATIVE_RESPONSE_FILE',packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce})});assert.equal(JSON.stringify(input),before,'Rejected preparation changed the input');if(value===missing){fs.writeFileSync(proofRecovery+'/stage8-producer-error-recovery-'+result.toLowerCase()+'.json',JSON.stringify({sourceSha:'88220df8cee15ffed5b7d6bc948cb5ca80e6abc4',project:out.project,artifacts:[],rawResponseId:out.rawRecord.rawResponseId,synthetic:true}));}
 return {kind:'RECORDED_VALIDATION',valid:out.validation.valid,issues:out.validation.issues,receiptCompletionState:out.receipt.completionState,disposition:out.disposition?.type||out.disposition?.status||null};}
   catch(error){assert.equal(JSON.stringify(input),before,'Thrown planning failure changed the input');if(!/execution|receipt|isolation|fixture|target|attachment/i.test(error.message))throw error;return {kind:'THROWN_NORMALIZATION_REJECTION',valid:false,errorCode:error.code||null,errorMessage:error.message};}
 };
 const missing=r.copy(envelope);delete missing.evidence[0].attachmentRef;const missingPrepared=rejected(missing);assert.equal(missingPrepared.valid,false,'LEGITIMATE_CONDITIONAL_MISSING_EVIDENCE_ORACLE');assert.equal(missingPrepared.kind,'RECORDED_VALIDATION');assert(missingPrepared.issues.some(row=>row.code==='INVALID_DEFERRED_EXECUTION_RECEIPT'));assert.equal(missingPrepared.receiptCompletionState,'VALIDATION_FAILED_RESPONSE');assert(/attributable supporting evidence/.test(missingPrepared.errorMessage||JSON.stringify(missingPrepared.issues)),'Wrong rejection: '+JSON.stringify(missingPrepared));
 const retryProof=null;
 const wrong=r.copy(envelope),wrongReport=JSON.parse(wrong.evidence[0].content);wrongReport.binding.fixtureSha256='0'.repeat(64);wrong.evidence[0].content=JSON.stringify(wrongReport);const wrongPrepared=rejected(wrong);assert.equal(wrongPrepared.valid,false,'LEGITIMATE_CONDITIONAL_STALE_BINDING_ORACLE');assert.equal(wrongPrepared.kind,'RECORDED_VALIDATION');assert(wrongPrepared.issues.some(row=>row.code==='INVALID_DEFERRED_EXECUTION_RECEIPT')); assert(/exact current fixture/.test(wrongPrepared.errorMessage||JSON.stringify(wrongPrepared.issues)),'Wrong rejection: '+JSON.stringify(wrongPrepared));
 const wrongSlot=r.copy(envelope);wrongSlot.attachments[0].attachmentSlotId='not-an-issued-slot';const wrongSlotPrepared=rejected(wrongSlot);assert.equal(wrongSlotPrepared.valid,false);assert(wrongSlotPrepared.issues.some(row=>row.code==='UNKNOWN_ATTACHMENT_SLOT'),'Wrong slot rejected for wrong reason');
 const wrongHash=r.copy(envelope);wrongHash.attachments[0].sha256='0'.repeat(64);const wrongHashPrepared=rejected(wrongHash);assert.equal(wrongHashPrepared.valid,false);assert(wrongHashPrepared.issues.some(row=>row.code==='ATTACHMENT_SHA256_MISMATCH'),'Wrong claimed hash rejected for wrong reason');
 const absentFilesPrepared=rejected(envelope,[]);assert.equal(absentFilesPrepared.valid,false);assert(absentFilesPrepared.issues.some(row=>row.code==='MISSING_REQUIRED_ATTACHMENT'),'Missing actual file rejected for wrong reason');
 const wrongFamilyFiles=r.copy(files);wrongFamilyFiles[0].artifactId=binding.subjectId;const wrongFamilyPrepared=rejected(envelope,wrongFamilyFiles);assert.equal(wrongFamilyPrepared.valid,false);assert(wrongFamilyPrepared.issues.some(row=>row.code==='ARTIFACT_ALLOCATION_REQUIRED'),'Wrong family rejected for wrong reason');
 // Loss of byte custody after validation cannot commit an otherwise valid proposal.
 await r.store.deleteArtifact(artifactId,saved.job.JOB_ID);
 const missingBytesPrepared=rejected(envelope);assert.equal(missingBytesPrepared.valid,false);assert(missingBytesPrepared.issues.some(row=>row.code==='RETURNED_ARTIFACT_BYTES_UNVERIFIED'),'Missing custody rejected for wrong reason');
 const pendingBefore=JSON.stringify(prepared.project);assert.throws(()=>i.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC_INTERRUPTED_CUSTODY',replacementConfirmation:i.acceptanceImpact(prepared.project,prepared.proposal.proposalId)}),error=>error.code==='STALE_PROPOSAL'&&error.issues?.some(row=>row.code==='RETURNED_ARTIFACT_BYTES_UNVERIFIED'),'Lost byte custody must fail before acceptance');assert.equal(JSON.stringify(prepared.project),pendingBefore,'Failed commit changed recoverable proposal/raw state');
 await r.store.putArtifact({artifactId,jobId:saved.job.JOB_ID,blob,filename:stored.filename,mediaType:stored.mediaType,expectedSha256:rawSha});assert.equal(await (await r.store.getArtifact(artifactId,{jobId:saved.job.JOB_ID})).blob.text(),raw);
 const progressRetry=result==='UNDETERMINED'?await verifyUnresolvedThenSatisfiedRetry(r,caseId==='UNDETERMINED_AT9'?await acceptOrdinaryStage8(r,reloaded):reloaded,caseId==='UNDETERMINED_AT9'?9:8):null;
 results.push({operationId:'8:EXECUTE_FAILURE_TEST',result,progressRetry,materialIdentity,admitted:true,explicitOperatorCommit:true,storedAndReadBack:true,selectedSubjectCompleted:state.completed,ordinaryStage8Complete:false,rawResponseSha256:file.sha256,rawAttachmentSha256:rawSha,rawAttachmentBytes:blob.size,receiptId:e.recordId(receipt,'regressionExecutions'),definitionId:binding.subjectId,testId:binding.testId,missingAttachmentRejected:missingPrepared,staleFixtureBindingRejected:wrongPrepared,wrongSlotRejected:wrongSlotPrepared,wrongHashRejected:wrongHashPrepared,absentFileRejected:absentFilesPrepared,wrongFamilyRejected:wrongFamilyPrepared,missingByteCustodyRejected:missingBytesPrepared,staleCustodyCommitRejected:true,retryProof,synthetic:true,actualBrowser:false,externalActor:false});
 fs.writeFileSync(proofRecovery+'/retained-stage8-'+result.toLowerCase()+'.json',JSON.stringify({sourceSha:'88220df8cee15ffed5b7d6bc948cb5ca80e6abc4',project:reloaded,artifacts:await captureArtifactFixture(r.store,reloaded.job.JOB_ID),results:results.at(-1),synthetic:true,actualBrowser:false}));
}
 return {case:'LEGITIMATE_DEFERRED_RETURNED_BYTES_AND_RETRY',setupSourceFingerprints:retained.sourceFingerprints,proofBoundary:'Accepted production Stage1-7 -> exact issued ZIP instruction/manifest/context -> staged response + verified returned bytes -> noncanonical proposal -> explicit operator commit -> production transaction adapter/readback -> deferred gate and corrected retry',results,actualBrowser:false,synthetic:true};
}
function generateLegitimateDeferredPrefix(){
 const outputDir=fs.mkdtempSync(path.join(os.tmpdir(),'clrt-accepted-deferred-prefix-')),hash=runtime().runtime.closedLoopHash;
 const stdout=execFileSync(process.execPath,['verify-operator-counterpart.mjs'],{env:{...process.env,CLRT_COUNTERPART_FAULT:'',CLRT_COUNTERPART_STAGE_LIMIT:'7',CLRT_COUNTERPART_DIAGNOSTIC_PREFIX_DIR:outputDir,CLRT_COUNTERPART_DIAGNOSTIC_PREFIX_INPUT:''},encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
 const prefix=JSON.parse(fs.readFileSync(path.join(outputDir,'prefix-stage08.json'),'utf8'));assert.equal(prefix.entryStage,8);assert.equal(prefix.completedPriorStages,7);assert.equal(prefix.earlierCompleteFlagsForced,false);
 for(const [file,digest]of Object.entries(prefix.sourceFingerprints))assert.equal(hash.sha256Text(fs.readFileSync(file,'utf8')),digest,'DEFERRED_PREFIX_SOURCE_IDENTITY_ORACLE: '+file);
 return {prefix,setup:{case:'LEGITIMATE_STAGE7_DIAGNOSTIC_PREFIX',childCommand:process.execPath+' verify-operator-counterpart.mjs',hardTimeoutMilliseconds:120000,childExitStatus:0,childStdoutSha256:hash.sha256Text(stdout),sourceFingerprints:prefix.sourceFingerprints,earlierCompleteFlagsForced:false,synthetic:true,actualBrowser:false}};
}

async function verifyLegitimateDeferredCachedPackages(retained){
const promptSource=fs.readFileSync('prompt-engine.js','utf8'),appSource=fs.readFileSync('app-core.js','utf8');
const descriptor="...(op?.deferredSubjectFamily?{deferredExecutionEvidenceContract:schema.DEFERRED_EXECUTION_EVIDENCE}:{}),";
assert(promptSource.includes(descriptor));
const legacy=promptSource.replace(/const PROMPT_ENGINE_VERSION='[^']+';/,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/81';").replace(descriptor,'');
function uiOwner(name){const start=appSource.search(new RegExp('(?:async )?function '+name+'\\(')),a=appSource.indexOf('\nfunction ',start+1),b=appSource.indexOf('\nasync function ',start+1),end=Math.min(...[a,b].filter(value=>value>=0));assert(start>=0&&end>start);return appSource.slice(start,end);}
const owners=['promptMatches','currentPromptEngineVersion','promptVersionCurrent','currentPromptRecord','savePromptRecord'].map(uiOwner).join('\n');
const results=[];
for(const status of ['RESERVED','EXPORTED']){
 const r=projectStoreRuntime(),currentProducer=r.prompts,h=r.runtime.closedLoopHash,e=r.engine;await restoreArtifactFixture(r.store,retained.artifacts);const original=r.copy(retained.project);original.activeStage=8;await hydrateRetainedPromptContexts(r,original,retained.contextFiles);assert.equal(e.gate(7,original).complete,true);let p=await r.store.writeProject(original,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
 vm.runInContext(legacy,r.runtime,{filename:'prompt-engine.js:controlled-generation81-no-deferred-contract'});
 const oldProducer=r.runtime.closedLoopPromptEngine,draft=r.copy(p),old=oldProducer.reserveAndBuildPromptRecord(draft,8,{operation:'EXECUTE_FAILURE_TEST'}).prompt;
 if(status==='EXPORTED')e.transitionOperationReservation(draft.projectData.operationReservations.find(row=>e.recordId(row,'operationReservations')===old.operationReservationId),'EXPORTED');
 p=await r.store.writeProject(draft,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 const oldPkg=await r.store.createExecutionPackage({jobId:p.job.JOB_ID,stage:8,operation:'EXECUTE_FAILURE_TEST',instructionId:old.instructionId}),oldMembers=readStoreArchive(new Uint8Array(await oldPkg.blob.arrayBuffer())),oldManifest=JSON.parse(Buffer.from(oldMembers.find(row=>row.canonicalPath==='manifest.json').bytes).toString('utf8'));
 assert.equal(oldManifest.responseContract.deferredExecutionEvidenceContract,undefined);const oldInstruction=Buffer.from(oldMembers.find(row=>row.canonicalPath==='instruction.txt').bytes).toString('utf8');assert.equal(oldInstruction,old.prompt);
 r.runtime.closedLoopPromptEngine=currentProducer;bindAcceptanceUi(r,p,null);Object.assign(r.runtime,{promptOptions:()=>r.copy({operation:'EXECUTE_FAILURE_TEST'}),externalAgentOperation:()=>true,selectedOperation:()=> 'EXECUTE_FAILURE_TEST',operationExecutorClass:()=> 'EXTERNAL_AGENT'});vm.runInContext(owners+'\nglobalThis.deferredCacheUi={save:()=>savePromptRecord(8)};',r.runtime);
 const captured=r.ingestion.captureRaw(p,{stage:8,text:JSON.stringify({synthetic:'Original response preserved while awaiting validation.'}),promptRecord:old}),guarded=r.copy(captured.project),guardedRawHash=h.sha256Value(captured.rawRecord),guardedOwner=guarded.projectData.operationReservations.find(row=>e.recordId(row,'operationReservations')===old.operationReservationId);
 assert.throws(()=>currentProducer.reserveAndBuildPromptRecord(guarded,8,{operation:'EXECUTE_FAILURE_TEST'}),/An authoritative reservation already controls this target operation slot/,'DEFERRED_CACHE_CAPTURED_RESPONSE_GUARD_ORACLE');
 assert.equal(e.recordValue(guardedOwner,'STATUS'),status,'DEFERRED_CACHE_CAPTURED_RESPONSE_GUARD_ORACLE');assert.equal(h.sha256Value(guarded.projectData.rawResponses.find(row=>row.rawResponseId===captured.rawRecord.rawResponseId)),guardedRawHash);assert.equal(h.sha256Value(guarded.projectData.acceptedChanges),h.sha256Value(p.projectData.acceptedChanges));
 const before={accepted:h.sha256Value(p.projectData.acceptedChanges),definitions:h.sha256Value(p.projectData.failureTests),raw:h.sha256Value(p.projectData.rawResponses),proposals:h.sha256Value(p.projectData.responseProposals)};
 const fresh=await r.runtime.deferredCacheUi.save();assert(fresh);p=r.runtime.current;assert.notEqual(fresh.instructionId,old.instructionId);assert.equal(fresh.promptEngineVersion,'closed-loop-prompt-engine/82');assert.notEqual(fresh.packageId,old.packageId);assert.notEqual(fresh.operationReservationId,old.operationReservationId);assert.notEqual(fresh.challengeNonce,old.challengeNonce);
 const prior=p.projectData.generatedPrompts.find(row=>row.instructionId===old.instructionId);assert.equal(prior.prompt,oldInstruction);assert.equal(e.recordValue(p.projectData.operationReservations.find(row=>e.recordId(row,'operationReservations')===old.operationReservationId),'STATUS'),'SUPERSEDED');
 for(const[key,collection]of[['accepted','acceptedChanges'],['definitions','failureTests'],['raw','rawResponses'],['proposals','responseProposals']])assert.equal(h.sha256Value(p.projectData[collection]),before[key]);
 const comparable=({projectRevision,...binding})=>binding;assert.deepEqual(r.copy(comparable(fresh.contextManifest.deferredExecutionBinding)),r.copy(comparable(old.contextManifest.deferredExecutionBinding)));assert.equal(fresh.contextManifest.deferredExecutionBinding.projectRevision,old.contextManifest.deferredExecutionBinding.projectRevision+1);
 const pkg=await r.store.createExecutionPackage({jobId:p.job.JOB_ID,stage:8,operation:'EXECUTE_FAILURE_TEST',instructionId:fresh.instructionId}),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),manifest=JSON.parse(Buffer.from(members.find(row=>row.canonicalPath==='manifest.json').bytes).toString('utf8'));assert.equal(Buffer.from(members.find(row=>row.canonicalPath==='instruction.txt').bytes).toString('utf8'),fresh.prompt);assert.deepEqual(r.copy(manifest.responseContract.deferredExecutionEvidenceContract.resultValues),r.copy(['SATISFIED','VIOLATED','UNDETERMINED']));assert.equal(manifest.operationReservationId,fresh.operationReservationId);
 const revision=p.revision,promptCount=p.projectData.generatedPrompts.length,again=await r.runtime.deferredCacheUi.save();assert.equal(again.instructionId,fresh.instructionId);assert.equal(r.runtime.current.revision,revision);assert.equal(r.runtime.current.projectData.generatedPrompts.length,promptCount);
 results.push({status,oldGeneration:old.promptEngineVersion,currentGeneration:fresh.promptEngineVersion,oldPackageSha256:await h.sha256Bytes(oldPkg.blob),newPackageSha256:await h.sha256Bytes(pkg.blob),completeCurrentContractPublished:true,oldBytesRetained:true,acceptedWorkRawProposalsAndDefinitionUnchanged:true,exactSubjectBindingPreserved:true,newNativeTransportIdentities:true,unchangedSaveIdempotent:true,capturedResponsePreventsRefresh:true,synthetic:true,actualBrowser:false});
}
 return {case:'LEGITIMATE_DEFERRED_CACHED_PACKAGE_REFRESH',results,synthetic:true,actualBrowser:false};
}

if(process.argv.includes('--deferred-cache-only')){const generated=generateLegitimateDeferredPrefix();console.log(JSON.stringify({deferredCachedPackages:'PASS',setup:generated.setup,control:await verifyLegitimateDeferredCachedPackages(generated.prefix)}));process.exit(0);}

const source=fs.readFileSync('workflow-schema.js','utf8'),r=runtime();
deferredReviewProvenance(runtime());await deferredArtifactOwnership(runtime());await deferredReservationBoundaries(runtime());await deferredReceiptJourney(runtime());await deferredNativeJourney(runtime());await deferredNativeJourney(runtime(),{executionStage:r.core.STAGES.at(-1).number});await deferredRegressionJourney(runtime());await evidenceChainFrontierCases(runtime());await evidenceChainFrontierCases(runtime(),{requiredBy:29});scalarCases(r);conditions(r);await availability(r);
regressionIterationBoundary(r);regressionTimingConsumers(r);
const completedFixture=process.argv.find(arg=>arg.startsWith('--completed-fixture='))?.slice('--completed-fixture='.length);if(completedFixture)await completedPhaseTargets(r,completedFixture);
const generatedDeferredPrefix=generateLegitimateDeferredPrefix();results.push(generatedDeferredPrefix.setup);results.push(await verifyLegitimateDeferredCachedPackages(generatedDeferredPrefix.prefix));results.push(await legitimateDeferredReturnedJourney(generatedDeferredPrefix.prefix));
const faults=[];
for(const [name,before,after,oracle] of [
 ['stage-coercion',"!Number.isInteger(value[name])||!core.STAGES.some(stage=>stage.number===value[name])","!Number.isInteger(Number(value[name]))||!core.STAGES.some(stage=>stage.number===Number(value[name]))",'TIMING_SCALAR_ORACLE'],
 ['unknown-condition',"const visiting=new Set(),references=[];let count=0;", "if(value&&Object.hasOwn(value,'__UNREGISTERED_TARGET_CONDITION__'))return {valid:true,normalized:{type:'PHASE_TARGET'},references:[],reasons:[]};const visiting=new Set(),references=[];let count=0;",'CONDITION_GRAMMAR_ORACLE']
]){
 assert(source.includes(before),'Fault anchor missing: '+name);const mutation=source.replace(before,after),faulty=runtime({'workflow-schema.js':mutation});let caught;
 try{name==='stage-coercion'?scalarCases(faulty):conditions(faulty);}catch(error){caught=error;}
 assert(caught?.message.includes(oracle),'Fault was not caught by its intended invariant: '+name+' '+caught?.message);faults.push({name,oracle,detected:true});
}
for(const [name,file,before,after,oracle]of [
 ['byte-custody-bypass','project-store.js','function artifactCustodyState(identity){',"function artifactCustodyState(identity){return 'TRUE';",'CUSTODY_ORACLE'],
 ['phase-target-pointer-bypass','workflow-engine.js','function verificationPhaseTargetAvailability(project,phase,timing={},options={}){',"function verificationPhaseTargetAvailability(project,phase,timing={},options={}){return 'TRUE';",'PHASE_TARGET_ORACLE'],
 ['future-regression-required','workflow-engine.js','if(timing.phaseEligible&&(executableOnly?timing.executableNow:timing.dueNow))tests.push(record);','if(timing.valid)tests.push(record);','DEFERRED_REGRESSION_TIMING_ORACLE'],
 ['unknown-regression-target-skipped','workflow-engine.js','blockers.push({id,...timing});continue;','continue;','REGRESSION_DEADLINE_ORACLE']
]){
 const original=fs.readFileSync(file,'utf8');assert(original.includes(before),'Fault anchor missing: '+name);const faulty=runtime({[file]:original.replace(before,after)});let caught;
 try{if(name.includes('regression'))regressionTimingConsumers(faulty);else await availability(faulty);}catch(error){caught=error;}
 assert(caught?.message.includes(oracle),'Fault was not caught by its intended invariant: '+name+' '+caught?.message);faults.push({name,oracle,detected:true});assert.equal(fs.readFileSync(file,'utf8'),original);
}
for(const [name,before,after,oracle,run]of [
 ['deferred-isolation-evidence-bypass',"if(!String(report.evidenceLocation||'').trim()||!String(report.isolationEvidence||'').trim()||e0.timingArtifactAvailability(p,String(fv(match.evidence,'ATTACHMENT_ID')||''))!=='TRUE')","if(false)",'DEFERRED_ISOLATION_ORACLE',deferredReceiptJourney],
 ['deferred-binding-bypass',"if(h.stableStringify(report.binding)!==h.stableStringify(binding)||report.phase!==item.phase||report.result!==fv(record,'RESULT')||!schema.DEFERRED_EXECUTION_EVIDENCE.resultValues.includes(report.result))","if(false)",'DEFERRED_BINDING_ORACLE',deferredReceiptJourney],
 ['deferred-gate-bypass',"...deferred.map(item=>'Scheduled '","...[].map(item=>'Scheduled '",'DEFERRED_RECEIPT_GATE_ORACLE',deferredReceiptJourney],
 ['regression-unchanged-input-bypass',"if(phase==='POST_CORRECTION'&&previous.every", "if(false&&phase==='POST_CORRECTION'&&previous.every",'DEFERRED_REGRESSION_DISTINCT_INPUT_ORACLE',deferredRegressionJourney]
]){
 const original=fs.readFileSync('workflow-engine.js','utf8');assert(original.includes(before),'Fault anchor missing: '+name);let caught;
 try{await run(runtime({'workflow-engine.js':original.replace(before,after)}));}catch(error){caught=error;}
 assert(caught?.message.includes(oracle),'Fault was not caught by its intended invariant: '+name+' '+caught?.message);faults.push({name,oracle,detected:true});assert.equal(fs.readFileSync('workflow-engine.js','utf8'),original);
}
for(const [name,file,before,after,oracle,run]of [
 ['regression-follows-later-iteration','workflow-engine.js',"const targetIterationId=iterationId||recordId(selectedStageIteration(project,stage),'iterations');","const targetIterationId=iterationId||recordId(latestIteration(project),'iterations');",'RETAINED_REGRESSION_SCOPE_ORACLE',regressionIterationBoundary],
 ['review-provenance-latest-response','workflow-engine.js',"const reviewerContextId=matches.length===1?String(matches[0].scope?.contextId||''):'';","const reviewerContextId=String(acceptedChanges(project,Number(record.stage)).at(-1)?.scope?.contextId||'');",'DEFERRED_REVIEW_PROVENANCE_ORACLE',deferredReviewProvenance],
 ['evidence-inherits-product-owner','workflow-engine.js',"productId:productId||null,productVersion:product?String(recordValue(product,'PRODUCT_VERSION')):null","...(product?{productId,productVersion:String(recordValue(product,'PRODUCT_VERSION'))}:{})",'DEFERRED_EVIDENCE_PRODUCT_ISOLATION_ORACLE',deferredArtifactOwnership],
 ['deferred-receipt-shape-bypass','project-store.js','schemaApi.validateDeferredReceiptShape(receipt)','({reasons:[]})','DEFERRED_PERSISTENCE_SHAPE_ORACLE',deferredReceiptJourney],
 ['completed-deferred-operation-selected','app-core.js','deferred.pending.some','deferred.items.some','DEFERRED_NEXT_ACTION_ORACLE',deferredNativeJourney],
 ['deferred-native-duplicate-execution','workflow-engine.js','if(pending)return pending.key===key?pending.promise:','if(false&&pending)return pending.key===key?pending.promise:','DEFERRED_NATIVE_CONCURRENT_RETRY_ORACLE',deferredNativeJourney],
 ['deferred-native-unbound-observation','workflow-engine.js',"throw new Error('The runtime observation does not bind the selected test and exact fixture inputs.');",'void 0;','DEFERRED_NATIVE_OBSERVATION_IDENTITY_ORACLE',deferredNativeJourney],
 ['deferred-native-abandoned-commit','workflow-engine.js',"throw new Error('Project or targets changed while the isolated test was running; no result was committed.');",'void 0;','DEFERRED_NATIVE_ABANDONED_OPERATION_ORACLE',deferredNativeJourney],
 ['deferred-native-subsequent-stage-input','workflow-engine.js','function stageContext(project,stage){','function stageContext(project,stage){return project;','DEFERRED_NATIVE_STAGE_ISOLATION_ORACLE',deferredNativeJourney]
]){
 const original=fs.readFileSync(file,'utf8');assert(original.includes(before),'Fault anchor missing: '+name);let caught;
 try{const mutated=original.replace(before,after);await run(runtime(file==='app-core.js'?{}:{[file]:mutated}),file==='app-core.js'?{appSource:mutated}:undefined);}catch(error){caught=error;}
 assert(caught?.message.includes(oracle),'Fault was not caught by its intended invariant: '+name+' '+caught?.message);faults.push({name,oracle,detected:true});assert.equal(fs.readFileSync(file,'utf8'),original);
}
// Faults exercise the real returned-file admission/acceptance boundary, not
// the older small fixture's pre-registered canonical artifact shortcut.
for(const [name,file,before,after,oracle,caseIds]of [
 ['deferred-returned-byte-projection-omitted','response-ingestion.js','workflow.normalizeDeferredReceipt(projected,Number(envelope.stage)', 'workflow.normalizeDeferredReceipt(project,Number(envelope.stage)','LEGITIMATE_CONDITIONAL_ADMISSION_ORACLE',['SATISFIED']],
 ['deferred-closed-producer-contract-omitted','prompt-engine.js',"...(op?.deferredSubjectFamily?{deferredExecutionEvidenceContract:schema.DEFERRED_EXECUTION_EVIDENCE}:{}),",'', 'DEFERRED_PUBLISHED_VOCABULARY_ORACLE',['SATISFIED']],
 ['deferred-producer-rejection-feedback-escapes','response-ingestion.js',"if(!['INVALID_DEFERRED_EXECUTION_RECEIPT','STALE_DEFERRED_EXECUTION_BINDING'].includes(error?.code))throw error;",'throw error;', 'DEFERRED_TYPED_PRODUCER_FAILURE_ORACLE',['INVALID_REPORT']],
 ['deferred-failed-plan-retains-allocations','response-ingestion.js','next.projectData.idCounters=planningIdentities.idCounters;next.projectData.allocationReceipts=planningIdentities.allocationReceipts;','void planningIdentities;', 'DEFERRED_FAILED_PLAN_IDENTITY_ROLLBACK_ORACLE',['INVALID_REPORT']],
 ['deferred-current-observation-identity-omitted','workflow-engine.js',"if(collection==='regressionExecutions')return project?globalThis.closedLoopWorkflowEngine.deferredReceiptObservationIdentity(project,record,evidence):null;","if(collection==='regressionExecutions')return null;", 'DEFERRED_RECEIPT_TARGET_IDENTITY_ORACLE',['SATISFIED']]
]){
 const original=fs.readFileSync(file,'utf8');assert.equal(original.split(before).length-1,1,'DEFERRED_RETURNED_FAULT_ANCHOR_ORACLE: '+name);let caught;
 try{await legitimateDeferredReturnedJourney(generatedDeferredPrefix.prefix,{sourceOverrides:{[file]:original.replace(before,after)},caseIds});}catch(error){caught=error;}
 assert(caught?.message.includes(oracle),'Fault was not caught by its intended observable invariant: '+name+' '+caught?.message);faults.push({name,oracle,detected:true,boundary:'actual issued package/staged response/returned bytes/production admission or acceptance'});assert.equal(fs.readFileSync(file,'utf8'),original);
}
{
 const file='workflow-engine.js',original=fs.readFileSync(file,'utf8'),anchor='function normalizeDeferredReceipt(p,stage,operation,record,evidence,{binding:expected,receivedAt}={}){';assert.equal(original.split(anchor).length-1,1);
 const mutation=original.replace(anchor,anchor+"throw Object.assign(new Error('Injected internal normalization bug.'),{code:'INJECTED_INTERNAL_NORMALIZATION_FAULT'});");
 const control=await legitimateDeferredReturnedJourney(generatedDeferredPrefix.prefix,{sourceOverrides:{[file]:mutation},caseIds:['SATISFIED'],expectedInternalFailure:true});assert.equal(control.results.length,1);assert.equal(control.results[0].case,'UNEXPECTED_INTERNAL_ERROR_PROPAGATES');results.push(control);faults.push({name:'deferred-unexpected-internal-error-stays-an-error',oracle:'DEFERRED_UNEXPECTED_INTERNAL_ERROR_ORACLE',detected:true,rawRecoveryVerified:true});assert.equal(fs.readFileSync(file,'utf8'),original);
}

faults.push(...await evidenceChainFrontierFaults());
assert.equal(fs.readFileSync('workflow-schema.js','utf8'),source);scalarCases(r);conditions(r);
console.log(JSON.stringify({dueStageTiming:'PASS',results,faults,sourceRestored:true}));

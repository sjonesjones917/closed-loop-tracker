import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {projectStoreRuntime,captureArtifactFixture,restoreArtifactFixture} from './test-project-store-runtime.mjs';
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
 iteration.active=false;e.refreshRecordHashes(iteration,'iterations');assert(required().blockers.length,'RETAINED_REGRESSION_SCOPE_ORACLE: invalidated original target remained executable.');
 results.push({case:'RETAINED_REGRESSION_ITERATION_BOUNDARIES',boundaryCases,invalidatedTargetRejected:true});
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
async function smallDeferredFixture(r,{native=false,family='failureTests',executionStage}={}){
 const e=r.engine,s=r.runtime.closedLoopWorkflowSchema,h=r.runtime.closedLoopHash,p=r.core.createBlankState('JOB-DEFERRED-SMALL');e.ensureShape(p);
 Object.assign(p.job,{AVAILABLE_TOOLS:'fixture-required_capability',CURRENT_INPUT_VERSION:'INPUT-1',CURRENT_SOURCE_SET_VERSION:'SOURCE-1',CURRENT_RESEARCH_VERSION:'RESEARCH-1',CURRENT_REQUIREMENTS_VERSION:'REQ-1',CURRENT_TEST_SUITE_VERSION:'TEST-1'});
 const stage=executionStage??r.core.STAGES.find(row=>row.number>s.RECORD_SCHEMAS[family].stage).number;
 canonical(r,p,'externalCapabilities',{CAPABILITY_CLAIM:'fixture-required_capability',FRESHNESS_STATUS:'CURRENT',STATUS:'CURRENT',AUTHORIZED:true,PERMISSIONS_READY:true,INPUTS_TRANSFERABLE:true,ROUTE_USABLE:true,EVIDENCE_OBTAINABLE:true});
 const req=canonical(r,p,'requirements',{MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}),prop=canonical(r,p,'propositions',{REQUIREMENT_ID:req.id,PROPOSITION_TEXT:'The invalid fixture must be rejected.',STATUS:'CURRENT'});
 const fixtureBlob=new Blob(['invalid fixture']),fixtureArtifactId=e.allocateId(p,'artifacts',r.copy({payload:{purpose:'DEFERRED_NEGATIVE_FIXTURE'}})),sha=await h.sha256Bytes(fixtureBlob);
 e.registerArtifactBytes(p,r.copy({stage:6,artifactId:fixtureArtifactId,filename:'negative-fixture.txt',mediaType:'text/plain',byteSize:fixtureBlob.size,sha256:sha}));await r.store.putArtifact({artifactId:fixtureArtifactId,jobId:p.job.JOB_ID,blob:fixtureBlob,filename:'negative-fixture.txt',mediaType:'text/plain'});
 const correctionTargetBlob=new Blob(['defective target']),correctionTargetId=e.allocateId(p,'artifacts',r.copy({payload:{purpose:'REGRESSION_CORRECTION_TARGET'}})),correctionTargetSha=await h.sha256Bytes(correctionTargetBlob);
 if(family==='regressions'){e.registerArtifactBytes(p,r.copy({stage:6,artifactId:correctionTargetId,filename:'target.txt',mediaType:'text/plain',byteSize:correctionTargetBlob.size,sha256:correctionTargetSha}));await r.store.putArtifact({artifactId:correctionTargetId,jobId:p.job.JOB_ID,blob:correctionTargetBlob,filename:'target.txt',mediaType:'text/plain'});}
 const test=canonical(r,p,'tests',{...recordProposal(s,'tests').fields,REQ_ID:req.id,TARGET_PROPOSITION_IDS:[prop.id],TEST_ROLE:'REQUIRED_PROOF',STATUS:'READY',VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:stage,REQUIRED_BY_STAGE:stage,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'},...(native?{EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_INPUT_BINDINGS:{FIXTURE:{kind:'ARTIFACT',source:'EXPLICIT_ARTIFACT',artifactId:fixtureArtifactId},...(family==='regressions'?{TARGET:{kind:'ARTIFACT',source:'CURRENT_SCOPE',filename:'target.txt'}}:{})},EXECUTABLE_SPEC:{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:family==='regressions'?'TARGET':'FIXTURE'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'ASSERT_EQ',value:family==='regressions'?'corrected target':'invalid fixture'}]}}:{})});
 const leaf={type:'LEAF',testId:test.id,requiredDisposition:'SATISFIED',truthExtraction:'ACCEPTED_ENTAILMENT',evidenceClasses:['OBSERVATION_RECORD','ACCEPTED_ENTAILMENT'],scopeBinding:'CURRENT'};
 canonical(r,p,'proofExpressions',{TARGET_PROPOSITION_ID:prop.id,PROPOSED_EXPRESSION:leaf,NORMALIZED_EXPRESSION:leaf,SEMANTIC_RATIONALE:'The reviewed predicate rejects the preserved invalid fixture.'});
 for(let n=1;n<=5;n++){p.stages[n].status='COMPLETE';p.stages[n].gate={complete:true};}
 reviewProofFixture({engine:e,prompts:r.prompts,ingestion:r.ingestion,schema:s},p);
 for(let n=1;n<stage;n++){p.stages[n].status='COMPLETE';p.stages[n].gate={complete:true};}p.activeStage=stage;
 return {p,test,stage,fixtureArtifactId,fixtureBlob,sha,correctionTargetId,correctionTargetBlob,correctionTargetSha};
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
 assert.equal(await (await r.store.getArtifact(f.fixtureArtifactId)).blob.text(),await originalFixture.blob.text(),'DEFERRED_REGRESSION_FIXTURE_PRESERVATION_ORACLE');
 const integrity=r.store.validateProjectIntegrity(p);assert(integrity.valid,'DEFERRED_REGRESSION_DURABILITY_ORACLE: '+integrity.issues.join(' | '));
 results.push({case:'DEFERRED_REGRESSION_PRE_POST_CORRECTION',stage,preReceipt:receipt.id,postReceipt:result.id,actualWorker:true,unchangedInputRejected:true,fixturePreserved:true,durable:true});
}
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
const source=fs.readFileSync('workflow-schema.js','utf8'),r=runtime();
deferredReviewProvenance(runtime());await deferredArtifactOwnership(runtime());await deferredReservationBoundaries(runtime());await deferredReceiptJourney(runtime());await deferredNativeJourney(runtime());await deferredNativeJourney(runtime(),{executionStage:r.core.STAGES.at(-1).number});await deferredRegressionJourney(runtime());scalarCases(r);conditions(r);await availability(r);
regressionIterationBoundary(r);regressionTimingConsumers(r);
const completedFixture=process.argv.find(arg=>arg.startsWith('--completed-fixture='))?.slice('--completed-fixture='.length);if(completedFixture)await completedPhaseTargets(r,completedFixture);
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
 ['deferred-binding-bypass',"if(h.stableStringify(report.binding)!==h.stableStringify(binding)||report.phase!==item.phase||report.result!==fv(record,'RESULT')||!['SATISFIED','VIOLATED','UNDETERMINED'].includes(report.result))","if(false)",'DEFERRED_BINDING_ORACLE',deferredReceiptJourney],
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
assert.equal(fs.readFileSync('workflow-schema.js','utf8'),source);scalarCases(r);conditions(r);
console.log(JSON.stringify({dueStageTiming:'PASS',results,faults,sourceRestored:true}));

import fs from 'node:fs';
import vm from 'node:vm';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,hash=globalThis.closedLoopHash;
const assert=(value,message)=>{if(!value)throw new Error(message);};
const scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TEST-SUITE-v001',instructionVersion:'INSTRUCTION-v001',iterationId:'ITER-1',candidateId:'CAND-1'};
const p=core.createBlankState('JOB-ADJUDICATION-INVARIANT');Object.assign(p.job,{CURRENT_INPUT_VERSION:scope.inputVersion,CURRENT_SOURCE_SET_VERSION:scope.sourceSetVersion,CURRENT_REQUIREMENTS_VERSION:scope.requirementsVersion,CURRENT_TEST_SUITE_VERSION:scope.testSuiteVersion,CURRENT_INSTRUCTION_VERSION:scope.instructionVersion,CURRENT_ITERATION:scope.iterationId});engine.ensureShape(p);
p.projectData.requirements.push({id:'REQ-1',stage:4,active:true,scope,fields:{REQ_ID:'REQ-1',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}});
p.projectData.tests.push({id:'TEST-1',stage:6,active:true,scope,fields:{TEST_ID:'TEST-1',REQ_ID:'REQ-1',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'review',ARTIFACT_REQUIREMENTS:'NONE',PROCEDURE:'Compare exact controlled outcome.',EXPECTED_RESULT:'PASSED',FAILURE_CONDITION:'FAILED',EVIDENCE_TO_PRESERVE:'Canonical execution receipt',STATUS:'READY'},relationships:{REQ_ID:'REQ-1'}});
const test=p.projectData.tests[0];
function record(collection,fields={},extra={}){return {id:`${collection}-X`,stage:extra.stage??99,active:true,scope:{...scope,...(extra.scope||{})},fields:{...fields},relationships:extra.relationships||{},evidenceRefs:extra.evidenceRefs||[],rawResponseId:extra.rawResponseId,sourceProposalId:extra.sourceProposalId,completionState:extra.completionState};}
function notSatisfied(collection,row,controlling=test){const result=engine.evaluateResultConsistency(collection,row,controlling,p);assert(result.determination!=='SATISFIED',`${collection} contradictory/missing evidence state was accepted`);return result;}
const cases=[
 ['verification',record('verification',{REQ_ID:'REQ-1',RUN_ID:'RUN-X',TEST_ID:'TEST-1',OBSERVED_RESULT:'FAILED',EXPECTED_RESULT:'PASSED',VERIFIER_CONTEXT_ID:'CTX-X',DETERMINATION:'SATISFIED'})],
 ['deterministicResults',record('deterministicResults',{TEST_ID:'TEST-1',ACTUAL_RESULT:'FAILED',EXPECTED_RESULT:'PASSED',DETERMINATION:'SATISFIED'})],
 ['meaningResults',record('meaningResults',{TEST_ID:'TEST-1',OBSERVED_MEANING:'WRONG',REQUIRED_MEANING:'RIGHT',EVIDENCE_BASED_COMPARISON:'FAILED',DETERMINATION:'SATISFIED'})],
 ['adversarialResults',record('adversarialResults',{TEST_ID:'TEST-1',ACTUAL_RESULT:'FAILED',DETERMINATION:'SATISFIED',SEVERITY:'MAJOR'})],
 ['representationInspections',record('representationInspections',{ARTIFACT_ID:'ART-X',OBSERVATIONS:'defect present',RENDERING_OPENING_EVIDENCE:'opened',DETERMINATION:'SATISFIED'})],
 ['preflightRecords',record('preflightRecords',{MULTIPLE_INTERPRETATIONS:'material ambiguity',OBJECTIVELY_VERIFIABLE:'TRUE',RESPONSIBLE_OPERATION_ASSIGNED:'TRUE',ORDER_CLEAR:'TRUE',FAILURE_BEHAVIOR_DEFINED:'TRUE',TRACEABILITY:'TRUE',DETERMINATION:'SATISFIED'})],
 ['confirmationRecords',record('confirmationRecords',{SOURCE_ITERATION_ID:'ITER-0',CONFIRMATION_ITERATION_ID:'ITER-1',ZERO_MATERIAL_CHANGES:'FALSE',NEW_DEFECTS:'1',DETERMINATION:'SATISFIED'})],
 ['processAudits',record('processAudits',{PROCESS_DETERMINATION:'SATISFIED',UNAUTHORIZED_MODIFICATION:'YES',APPROVED_INPUTS_VS_ACTUAL:'MATCH',APPROVED_INSTRUCTION_VS_ACTUAL:'MATCH',APPROVED_TOOLS_VS_ACTUAL:'MATCH',REQUIRED_TESTS_VS_EXECUTED:'MATCH',CHAIN_OF_CUSTODY:'COMPLETE',PROCESS_DEFECTS:'NONE',BLOCKERS:'NONE'})],
 ['productAudits',record('productAudits',{PRODUCT_DETERMINATION:'SATISFIED',VALIDATOR_RESULTS:'FAILED',MEANING_VERIFICATION_RESULTS:'SATISFIED',PRODUCT_DEFECTS:'NONE',BLOCKERS:'NONE'})],
 ['products',record('products',{STATUS:'COMPLETED',FAILURES:'FAILED',DEVIATIONS:'NONE'},{completionState:'COMPLETED'})],
 ['regressionExecutions',record('regressionExecutions',{REG_ID:'REG-1',PHASE:'POST_CORRECTION',RESULT:'SATISFIED'})],
 ['failureTests',record('failureTests',{EXECUTION_OUTCOME:'REJECTED_INVALID',ACTUAL_RESULT:'REJECTED',EXPECTED_REJECTION:'REJECT'})]
];
for(const [collection,row] of cases)notSatisfied(collection,row,collection==='products'||collection==='processAudits'||collection==='productAudits'||collection==='confirmationRecords'||collection==='regressionExecutions'||collection==='failureTests'?null:test);

// Claimed success can expose a contradiction, but can never establish success without the application's evidence contract.
for(const [collection,row] of cases){if(collection==='products'||collection==='regressionExecutions'||collection==='failureTests')continue;const claim=collection==='processAudits'?row.fields.PROCESS_DETERMINATION:collection==='productAudits'?row.fields.PRODUCT_DETERMINATION:row.fields.DETERMINATION;if(String(claim||'').toUpperCase()==='SATISFIED'){const contradictions=engine.detectCurrentContradictions({...p,projectData:{...p.projectData,[collection]:[row]}});assert(Array.isArray(contradictions),`${collection} contradiction scan failed`);}}

// Trace integrity is fail-closed: missing evidence/identity/layer linkage cannot pass RCA or changeset validation.
const badRca=record('rootCauses',{DEFECT_ID:'DEFECT-X',LAYER_TRACE:'x',EARLIEST_DEFECTIVE_LAYER:'INSTRUCTION',ROOT_CAUSE:'claim',DOWNSTREAM_INVALIDATION:'17+'});assert(!engine.validateTraceIntegrity('RCA',badRca,p).valid,'Unresolved RCA trace passed');
const badChange=record('changes',{TRIGGERING_DEFECT_IDS:'DEFECT-X',RESPONSIBLE_LAYER:'INSTRUCTION',OLD_ARTIFACT_VERSION:'v1',EXACT_MODIFICATION:'x',NEW_ARTIFACT_VERSION:'v2',DOWNSTREAM_INVALIDATION:'17+',REQUIRED_RERUNS:'all'});assert(!engine.validateTraceIntegrity('CHANGESET',badChange,p).valid&&!engine.validateTraceIntegrity('CHANGE',badChange,p).valid,'Unresolved changeset trace passed');

// Release-grade independence requires application-established context or a canonical accepted external execution receipt; a naked verifier claim is insufficient.
assert(typeof engine.releaseVerificationTrust==='function','Release-grade verification trust evaluator is not exported');
const nakedVerification=record('verification',{REQ_ID:'REQ-1',RUN_ID:'RUN-X',TEST_ID:'TEST-1',VERIFIER_CONTEXT_ID:'EXTERNAL-CTX',OBSERVED_RESULT:'PASSED',EXPECTED_RESULT:'PASSED',DETERMINATION:'SATISFIED'},{stage:19});const trust=engine.releaseVerificationTrust(p,nakedVerification);assert(trust.determination!=='APPLICATION_ESTABLISHED','Self-asserted verifier identity became release-grade evidence');

// A release reduction over incomplete/contradictory canonical state can never ACCEPT.
const metrics=engine.releaseMetrics(p);assert(metrics.determination!=='ACCEPTED','Incomplete contradictory project released');

// Static lifetime guard: the release reducer must consume release-grade trust and the central adjudicator, not submitted favorable strings.
const source=fs.readFileSync('workflow-engine.js','utf8');assert(source.includes('releaseVerificationTrustFailures'),'releaseMetrics is not wired to release-grade verification trust');assert(source.includes('evaluateResultConsistency'),'Central result adjudication is missing');assert(source.includes('effectiveDetermination'),'Effective determination reducer is missing');assert(!source.includes("['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(latest,'RESULT')))"),'Legacy regression success shortcut remains');


// The complete 30-stage reduction must preserve the exact legacy per-stage semantics
// while constructing the application-owned effective-result projection only once.
function referenceRecalculate(project){
  engine.ensureShape(project);
  let previousComplete=true;
  for(let stage=1;stage<=30;stage++){
    const result=engine.gate(stage,project),state=project.stages[stage];
    state.gate=result;
    if(!previousComplete)state.status='NOT STARTED';
    else if(result.blocked)state.status='BLOCKED';
    else if(result.complete)state.status='COMPLETE';
    else if(engine.hasStageActivity(project,stage))state.status='IN PROGRESS';
    else state.status='READY';
    state.decision=state.status==='COMPLETE'?'READY TO PROCEED':state.status==='BLOCKED'?'BLOCKED':'';
    state.decisionEvidence=result.reasons.length?result.reasons.join('; '):'Derived canonical stage gate satisfied.';
    state.derivedData=engine.deriveStageData(project,stage);
    previousComplete=state.status==='COMPLETE';
  }
  const completed=Object.values(project.stages).filter(state=>state.status==='COMPLETE').length,currentStage=completed===30?30:Math.max(1,Object.values(project.stages).find(state=>state.status!=='COMPLETE')?.number||30),current=project.stages[currentStage];
  project.activeStage=Math.max(1,Math.min(30,Number(project.activeStage||currentStage)));
  project.job.CURRENT_STAGE=`STAGE ${String(currentStage).padStart(2,'0')}`;
  project.job.CURRENT_STATE=completed===30?'COMPLETE':current.status==='BLOCKED'?'BLOCKED':current.status==='IN PROGRESS'?'IN PROGRESS':'READY';
  const blockers=engine.openBlockers(project);
  project.job.CURRENT_BLOCKERS=blockers.length?blockers.map(record=>engine.recordId(record,'blockers')).join(', '):'NONE';
  project.job.NEXT_REQUIRED_ACTION=completed===30?'Preserve the completed workflow and exact release evidence.':engine.operationalNextAction(project,currentStage);
  project.job.LATEST_EVIDENCE_REFERENCE=(project.projectData.acceptedChanges||[]).at(-1)?.changeId||project.job.LATEST_EVIDENCE_REFERENCE||'NONE';
  project.job.JOB_RECORD_STATUS=project.stages[1].status==='COMPLETE'?'READY':'NOT READY';
  project.job.STATUS_EVIDENCE=project.stages[1].gate?.reasons?.join('; ')||'Stage 01 canonical evidence is complete.';
  return project;
}
function reductionSnapshot(project){
  return {
    stages:Object.fromEntries(Array.from({length:30},(_,index)=>{const number=index+1,state=project.stages[number],gate=state.gate||{};return [number,{status:state.status,decision:state.decision,decisionEvidence:state.decisionEvidence,gate:{complete:Boolean(gate.complete),blocked:Boolean(gate.blocked),reasons:[...(gate.reasons||[])]},derivedData:state.derivedData}];})),
    job:Object.fromEntries(['CURRENT_STAGE','CURRENT_STATE','CURRENT_BLOCKERS','NEXT_REQUIRED_ACTION','LATEST_EVIDENCE_REFERENCE','JOB_RECORD_STATUS','STATUS_EVIDENCE'].map(key=>[key,project.job[key]]))
  };
}
const reductionFixture=engine.clone(p),optimized=engine.clone(reductionFixture),reference=engine.clone(reductionFixture);
engine.recalculate(optimized);referenceRecalculate(reference);
assert(hash.stableStringify(reductionSnapshot(optimized))===hash.stableStringify(reductionSnapshot(reference)),'Single-projection recalculation changed a stage gate, stage status, derived value, or next action.');
const largeState=engine.clone(reductionFixture);largeState.projectData.userEntered={...(largeState.projectData.userEntered||{}),MOBILE_LARGE_STATE_SENTINEL:'x'.repeat(3_700_000)};
const recalculateStarted=performance.now();engine.recalculate(largeState);const largeStateRecalculateMs=performance.now()-recalculateStarted;
assert(largeStateRecalculateMs<5000,`Large current project recalculation exceeded the bounded non-browser regression limit: ${largeStateRecalculateMs.toFixed(1)} ms`);
assert(hash.stableStringify(reductionSnapshot(largeState))===hash.stableStringify(reductionSnapshot(optimized)),'Non-semantic large browser-local payload changed canonical stage reduction.');
assert(source.includes('const adjudicated=adjudicatedClone(project);')&&source.includes('gate(stage,project,adjudicated)'),'Recalculation no longer reuses one application-owned adjudication projection.');
assert(!source.includes('const metrics=coverageMetrics(project);const convergence=convergenceMetrics(project);const release=releaseMetrics(project);'),'Expensive coverage, convergence, and release reductions became unconditional again.');

console.log(JSON.stringify({semanticFalseAcceptanceInvariant:true,conclusionBearingCollections:cases.length,releaseGradeIndependence:true,traceIntegrity:true,centralAdjudication:true,singleProjectionEquivalent:true,largeStateRecalculateMs:Number(largeStateRecalculateMs.toFixed(1))}));

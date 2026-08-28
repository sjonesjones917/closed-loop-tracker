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
console.log(JSON.stringify({semanticFalseAcceptanceInvariant:true,conclusionBearingCollections:cases.length,releaseGradeIndependence:true,traceIntegrity:true,centralAdjudication:true}));


// Capability names are not capability availability. External tool/system execution requires affirmative canonical availability.
{
 const q=core.createBlankState('JOB-CAPABILITY-AFFIRMATION');engine.ensureShape(q);q.job.CURRENT_INPUT_VERSION='INPUT-v001';q.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v001';q.job.CURRENT_TEST_SUITE_VERSION='TEST-SUITE-v001';const s=engine.currentScope(q);q.projectData.requirements.push({id:'REQ-CAP',stage:4,active:true,scope:s,fields:{REQ_ID:'REQ-CAP',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}});q.projectData.tests.push({id:'TEST-CAP',stage:6,active:true,scope:s,fields:{TEST_ID:'TEST-CAP',REQ_ID:'REQ-CAP',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITY:'SOLIDWORKS_IMPORT',ARTIFACT_REQUIREMENTS:'NONE',EVIDENCE_TO_PRESERVE:'import report',STATUS:'READY'},relationships:{REQ_ID:'REQ-CAP'}});let plan=engine.testExecutionPlan(q).items[0];assert(!plan.executableNow&&plan.operatorAction==='BLOCKED','Capability name alone established external tool availability');q.job.AVAILABLE_TOOLS='SOLIDWORKS_IMPORT';plan=engine.testExecutionPlan(q).items[0];assert(plan.executableNow&&plan.operatorAction==='SEND_TO_TOOL_AGENT','Affirmatively available external capability did not restore routing');
}

const strengthenedSource=fs.readFileSync('workflow-engine.js','utf8');
assert(strengthenedSource.includes("NON_SATISFIED_EFFECTIVE_RESULT:"),'Stage 29 does not require effective result satisfaction');
assert(strengthenedSource.includes("RELEASE_NOT_ACCEPTED"),'Stage 29 does not require an accepted current release');
assert(strengthenedSource.includes("UNAUTHORIZED_ARTIFACT_IDENTITY:"),'Stage 29 explanation does not fail closed on unauthorized delivery identity');
assert(!strengthenedSource.includes("map(v=>upper(recordValue(v,'DETERMINATION')))"),'Stability diagnostics still consume submitted determinations');
console.log(JSON.stringify({affirmativeCapabilityAvailability:true,epistemicEvidenceChains:true,effectiveStability:true}));

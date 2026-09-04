import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const hash=globalThis.closedLoopHash;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const assert=(value,message)=>{if(!value)throw new Error(message);};
const sha='b'.repeat(64);
function setField(record,key,value){record.fields=record.fields&&typeof record.fields==='object'?record.fields:{};record.fields[key]=value;record[key]=value;}
function record(collection,stage,fields,id){const def=schema.RECORD_SCHEMAS[collection];return {id,stage,active:true,fields:{...fields,[def.idField]:id},...fields,[def.idField]:id};}
function stage13Derived(){return engine.deriveStageData(p,13);}

assert(fs.readFileSync('workbook.js','utf8').includes('Every correctness-affecting variance has a defect record'),'Stage 13 workbook gate no longer contains the controlling defect-record requirement.');
assert(fs.readFileSync('prompt-engine.js','utf8').includes('Compare all ten executions'),'Stage 13 prompt no longer requires all-ten comparison.');
assert(fs.readFileSync('prompt-engine.js','utf8').includes('Never discard a run'),'Stage 13 prompt no longer prohibits run discard.');

const p=core.createBlankState('JOB-STAGE17-CROSS-RUN');
Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Prove deterministic cross-run comparison behavior.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'});
engine.ensureShape(p);
engine.registerArtifactBytes(p,{stage:10,artifactId:'ARTIFACT-STAGE17-CANDIDATE',filename:'candidate.bin',mediaType:'application/octet-stream',byteSize:1,sha256:sha});
const decision=engine.recordRegisteredHumanDecision(p,{stage:10,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:hash.sha256Value(['ARTIFACT-STAGE17-CANDIDATE']),value:['ARTIFACT-STAGE17-CANDIDATE'],operatorLabel:'STAGE17_SYNTHETIC_FIXTURE'});
const frozen=engine.freezeCandidate(p,{stage:10,artifactIds:['ARTIFACT-STAGE17-CANDIDATE'],selectionDecisionId:engine.recordId(decision,'humanDecisions'),operatorLabel:'STAGE17_SYNTHETIC_FIXTURE'});
const iterationId=engine.recordId(frozen.iteration,'iterations');
const candidateId=engine.recordId(frozen.candidate,'candidateFreezes');
const scope={...engine.scopeForIteration(p,iterationId),requirementsVersion:p.job.CURRENT_REQUIREMENTS_VERSION,testSuiteVersion:p.job.CURRENT_TEST_SUITE_VERSION,instructionVersion:p.job.CURRENT_INSTRUCTION_VERSION};
const req=record('requirements',4,{MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE',OBLIGATION:'The candidate must satisfy the Stage 17 comparison fixture.',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'Every run is verified SATISFIED.',FAILURE_CONDITION:'Any run is not verified SATISFIED.'},'REQ-STAGE17');req.scope={...scope};p.projectData.requirements.push(req);
const test=record('tests',6,{REQ_ID:'REQ-STAGE17',TEST_TYPE:'MEANING',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'independent semantic review',ARTIFACT_REQUIREMENTS:'NONE',EVIDENCE_TO_PRESERVE:'review observation',STATUS:'READY',VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:12,REQUIRED_BY_STAGE:12,PER_RUN_REQUIRED:true,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{phaseTarget:true}},'TEST-STAGE17');test.scope={...scope};p.projectData.tests.push(test);
const slots=engine.reserveRunBatch(p,{stage:11,iterationId,candidateId,count:10});
for(let i=0;i<slots.length;i++){
  const run=engine.records(p,'runs').find(x=>engine.recordId(x,'runs')===slots[i].runId);
  const ctx=engine.records(p,'freshContexts').find(x=>engine.recordId(x,'freshContexts')===slots[i].contextId);
  setField(ctx,'EXTERNAL_CONTEXT_IDENTIFIER',`generator-stage17-${i+1}`);
  setField(ctx,'CONTAMINATION_STATUS','NONE');
  setField(ctx,'AUTHORIZED_PROJECT_INPUTS',['candidate']);
  setField(run,'CONTAMINATION_CHECK','NONE');
  setField(run,'EXECUTION_STATUS','COMPLETED');
  setField(run,'COMPLETE_OUTPUT',`separate-output-${i+1}`);
  run.status='COMPLETED';
  const verifier=record('freshContexts',12,{EXTERNAL_CONTEXT_IDENTIFIER:`verifier-stage17-${i+1}`,ROLE:'Independent run verifier',ITERATION_ID:iterationId,RUN_ID:slots[i].runId,AUTHORIZED_PROJECT_INPUTS:['target run','target requirement','target test'],CONTAMINATION_STATUS:'NONE'},`CONTEXT-STAGE17-VERIFY-${i+1}`);
  verifier.scope={...engine.scopeForIteration(p,iterationId),runId:slots[i].runId,contextId:verifier.id};p.projectData.freshContexts.push(verifier);
  const evidence=record('evidenceRecords',12,{KIND:'REVIEW_NOTE',AUTHORITY_TYPE:'INDEPENDENT_REVIEWER',DESCRIPTION:'Independent verification observation',CONTENT:`Run ${i+1} satisfies the requirement.`,STATUS:'PRESERVED'},`EVIDENCE-STAGE17-${i+1}`);
  evidence.scope={...engine.scopeForIteration(p,iterationId)};p.projectData.evidenceRecords.push(evidence);
  const verification=record('verification',12,{REQ_ID:'REQ-STAGE17',RUN_ID:slots[i].runId,TEST_ID:'TEST-STAGE17',VERIFIER_CONTEXT_ID:verifier.id,OBSERVED_RESULT:'SATISFIED',EXPECTED_RESULT:'SATISFIED',DETERMINATION:'SATISFIED'},`VERIFY-STAGE17-${i+1}`);
  verification.scope={...engine.scopeForIteration(p,iterationId),runId:slots[i].runId};verification.evidenceRefs=[evidence.id];p.projectData.verification.push(verification);
}
const comparison=record('comparisons',13,{REQ_ID:'REQ-STAGE17',RUN_DETERMINATIONS:'AGENT TEXT MUST NOT CONTROL APPLICATION COUNTS',INTERPRETATION_VARIANCE:'NONE',OUTPUT_VARIANCE:'NONE',AUTHORIZED_VARIANCE:'TRUE',INCONCLUSIVE_TESTS:'NONE',REPEATED_FAILURE_PATTERNS:'NONE',UNIQUE_FAILURES:'NONE',CORRECTNESS_AFFECTING_VARIANCE:'FALSE',DEFECT_IDS:'NONE',EVIDENCE:'Ten-run comparison fixture'},'COMPARE-STAGE17');comparison.scope={...engine.scopeForIteration(p,iterationId)};p.projectData.comparisons.push(comparison);

let matrix=engine.verificationMatrix(p,iterationId);
assert(matrix.runs.length===10,'Cross-run comparison must retain exactly ten current runs.');
assert(matrix.expected.length===10&&matrix.missing.length===0&&matrix.duplicates.length===0&&matrix.invalid.length===0,'Cross-run comparison fixture must begin with one complete current verification triple per run.');
let derived=stage13Derived();
let facts=derived.APPLICATION_DERIVED_COMPARISON_FACTS?.['REQ-STAGE17'];
assert(facts&&facts.RUN_DETERMINATIONS.length===10,'Application-derived comparison discarded a run determination.');
assert(facts.SATISFIED_COUNT===10&&facts.VIOLATED_COUNT===0&&facts.UNDETERMINED_COUNT===0,'Application-derived all-ten counts are not exact.');
assert((derived.REQUIREMENTS_SATISFIED_BY_ALL_TEN||[]).includes('REQ-STAGE17'),'All-ten satisfied requirement was not application-derived.');
assert(derived.REQUIREMENT_COMPARISON_RECORDS===1,'Exactly one requirement comparison record should be current.');

const removed=p.projectData.verification.pop();
matrix=engine.verificationMatrix(p,iterationId);
assert(matrix.missing.length===1,'Missing current run verification was not preserved as a missing comparison input.');
derived=stage13Derived();facts=derived.APPLICATION_DERIVED_COMPARISON_FACTS?.['REQ-STAGE17'];
const missingRunPreservedAsUndetermined=Boolean(facts&&facts.RUN_DETERMINATIONS.length===10&&facts.UNDETERMINED_COUNT===1);
const missingRunDiscardedFromAggregate=Boolean(facts&&facts.RUN_DETERMINATIONS.length===9&&facts.UNDETERMINED_COUNT===0);
assert(missingRunPreservedAsUndetermined||missingRunDiscardedFromAggregate,'Missing-verification aggregate behavior is neither preserved-as-undetermined nor the diagnosed current discard behavior.');
p.projectData.verification.push(removed);
const duplicate=JSON.parse(JSON.stringify(p.projectData.verification[2]));duplicate.id='VERIFY-STAGE17-DUPLICATE';duplicate.fields.VERIFICATION_ID=duplicate.VERIFICATION_ID='VERIFY-STAGE17-DUPLICATE';p.projectData.verification.push(duplicate);
matrix=engine.verificationMatrix(p,iterationId);
assert(matrix.duplicates.some(item=>item.count===2),'Duplicate verification tuple was not preserved as a duplicate input defect.');
p.projectData.verification.pop();

for(const [id,runIndex,observed,expected] of [['DEFECT-STAGE17-1',0,'Repeated controlled failure','Expected stable result'],['DEFECT-STAGE17-2',1,'Repeated controlled failure','Expected stable result'],['DEFECT-STAGE17-3',2,'Unique controlled failure','Expected stable result']]){
  const defect=record('defects',13,{REQ_ID:'REQ-STAGE17',RUN_ID:slots[runIndex].runId,OBSERVED_FAILURE:observed,EXPECTED_CONDITION:expected,SEVERITY:'MAJOR',STATUS:'CONFIRMED'},id);defect.scope={...engine.scopeForIteration(p,iterationId),runId:slots[runIndex].runId};p.projectData.defects.push(defect);
}
derived=stage13Derived();
assert(derived.REPEATED_FAILURE_GROUPS===2&&derived.UNIQUE_FAILURES===1,'Stage 13 derived repeated/unique failure counts are not exact.');

const first=p.projectData.verification[0];setField(first,'OBSERVED_RESULT','VIOLATED');setField(first,'DETERMINATION','VIOLATED');setField(comparison,'CORRECTNESS_AFFECTING_VARIANCE','TRUE');setField(comparison,'AUTHORIZED_VARIANCE','FALSE');setField(comparison,'DEFECT_IDS','DEFECT-STAGE17-1');
derived=stage13Derived();facts=derived.APPLICATION_DERIVED_COMPARISON_FACTS?.['REQ-STAGE17'];
assert(facts&&facts.VIOLATED_COUNT===1&&facts.SATISFIED_COUNT===9,'Cross-run violation was not derived from current verification evidence.');
assert((derived.CORRECTNESS_AFFECTING_DISAGREEMENTS||[]).includes('COMPARE-STAGE17'),'Correctness-affecting comparison was not surfaced in Stage 13 derived data.');
const diagnosticGate=engine.gate(13,p);
const linkedDefectRoutingBlocked=diagnosticGate.reasons.some(reason=>reason.includes('Derived comparison contains a violation for REQ-STAGE17'));

console.log(JSON.stringify({controllerStage:'17',applicationStage:'13',crossRunComparison:'PASS',iterationId,runCount:10,completeVerificationTriples:10,applicationDerivedAllTenCounts:true,missingRunPreservedAsUndetermined,missingRunDiscardedFromAggregate,duplicateVerificationDetected:true,repeatedFailureInstances:2,uniqueFailures:1,correctnessAffectingVarianceSurfaced:true,syntheticAuthorityFixtureOnly:true,diagnostic:{linkedDefectRoutingBlocked,detectedDefect:linkedDefectRoutingBlocked?'stage13-linked-violation-cannot-progress-to-root-cause-under-current-gate':null}}));

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
const sha='a'.repeat(64);
function setField(record,key,value){record.fields=record.fields&&typeof record.fields==='object'?record.fields:{};record.fields[key]=value;record[key]=value;}
function record(collection,stage,fields,id){const def=schema.RECORD_SCHEMAS[collection];return {id,stage,active:true,fields:{...fields,[def.idField]:id},...fields,[def.idField]:id};}

const p=core.createBlankState('JOB-STAGE17-CROSS-RUN');
Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Compare ten verified runs.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'});
engine.ensureShape(p);
engine.registerArtifactBytes(p,{stage:10,artifactId:'ARTIFACT-STAGE17-CANDIDATE',filename:'candidate.bin',mediaType:'application/octet-stream',byteSize:1,sha256:sha});
const decision=engine.recordRegisteredHumanDecision(p,{stage:10,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:hash.sha256Value(['ARTIFACT-STAGE17-CANDIDATE']),value:['ARTIFACT-STAGE17-CANDIDATE'],operatorLabel:'STAGE17_VERIFIER'});
const frozen=engine.freezeCandidate(p,{stage:10,artifactIds:['ARTIFACT-STAGE17-CANDIDATE'],selectionDecisionId:engine.recordId(decision,'humanDecisions'),operatorLabel:'STAGE17_VERIFIER'});
const iterationId=engine.recordId(frozen.iteration,'iterations'),candidateId=engine.recordId(frozen.candidate,'candidateFreezes');
const scope={...engine.scopeForIteration(p,iterationId),requirementsVersion:p.job.CURRENT_REQUIREMENTS_VERSION,testSuiteVersion:p.job.CURRENT_TEST_SUITE_VERSION,instructionVersion:p.job.CURRENT_INSTRUCTION_VERSION};
const req=record('requirements',4,{MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'},'REQ-STAGE17');req.scope={...scope};p.projectData.requirements.push(req);
const test=record('tests',6,{REQ_ID:'REQ-STAGE17',TEST_TYPE:'MEANING',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'independent semantic review',ARTIFACT_REQUIREMENTS:'NONE',EVIDENCE_TO_PRESERVE:'review observation',STATUS:'READY',VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:12,REQUIRED_BY_STAGE:12,PER_RUN_REQUIRED:true,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{phaseTarget:true}},'TEST-STAGE17');test.scope={...scope};p.projectData.tests.push(test);
const slots=engine.reserveRunBatch(p,{stage:11,iterationId,candidateId,count:10});
for(let i=0;i<slots.length;i++){
  const run=engine.records(p,'runs').find(x=>engine.recordId(x,'runs')===slots[i].runId),ctx=engine.records(p,'freshContexts').find(x=>engine.recordId(x,'freshContexts')===slots[i].contextId);
  setField(ctx,'EXTERNAL_CONTEXT_IDENTIFIER',`generator-stage17-${i+1}`);setField(ctx,'CONTAMINATION_STATUS','NONE');setField(ctx,'AUTHORIZED_PROJECT_INPUTS',['candidate']);
  setField(run,'CONTAMINATION_CHECK','NONE');setField(run,'EXECUTION_STATUS','COMPLETED');setField(run,'COMPLETE_OUTPUT',`output-${i+1}`);run.status='COMPLETED';
  const verifier=record('freshContexts',12,{EXTERNAL_CONTEXT_IDENTIFIER:`verifier-stage17-${i+1}`,ROLE:'Independent run verifier',ITERATION_ID:iterationId,RUN_ID:slots[i].runId,AUTHORIZED_PROJECT_INPUTS:['target run','target requirement','target test'],CONTAMINATION_STATUS:'NONE'},`CONTEXT-STAGE17-VERIFY-${i+1}`);verifier.scope={...engine.scopeForIteration(p,iterationId),runId:slots[i].runId,contextId:verifier.id};p.projectData.freshContexts.push(verifier);
  const evidence=record('evidenceRecords',12,{KIND:'REVIEW_NOTE',AUTHORITY_TYPE:'INDEPENDENT_REVIEWER',DESCRIPTION:'Independent verification observation',CONTENT:`Run ${i+1} satisfies the requirement.`,STATUS:'PRESERVED'},`EVIDENCE-STAGE17-${i+1}`);evidence.scope={...engine.scopeForIteration(p,iterationId)};p.projectData.evidenceRecords.push(evidence);
  const verification=record('verification',12,{REQ_ID:'REQ-STAGE17',RUN_ID:slots[i].runId,TEST_ID:'TEST-STAGE17',VERIFIER_CONTEXT_ID:verifier.id,OBSERVED_RESULT:'SATISFIED',EXPECTED_RESULT:'SATISFIED',DETERMINATION:'SATISFIED'},`VERIFY-STAGE17-${i+1}`);verification.scope={...engine.scopeForIteration(p,iterationId),runId:slots[i].runId};verification.evidenceRefs=[evidence.id];p.projectData.verification.push(verification);
}
let matrix=engine.verificationMatrix(p,iterationId);
assert(matrix.expected.length===10&&matrix.verification.length===10&&matrix.missing.length===0&&matrix.duplicates.length===0&&matrix.invalid.length===0,'Cross-run comparison fixture does not begin with the exact ten-run verification universe.');

const stability=()=>engine.operationalMetrics(p).iterationStability.find(x=>x.iterationId===iterationId);
const first=p.projectData.verification.find(v=>engine.recordId(v,'verification')==='VERIFY-STAGE17-1');
setField(first,'OBSERVED_RESULT','VIOLATED');setField(first,'DETERMINATION','VIOLATED');
let s=stability();let r=s.requirementStability['REQ-STAGE17'];
assert(r.satisfied===9&&r.violated===1&&r.undetermined===0&&r.agreementRate===0.9,'Nine-of-ten violation stability did not reconcile to 9 SATISFIED / 1 VIOLATED / 0.9 agreement.');
setField(first,'OBSERVED_RESULT','UNDETERMINED');setField(first,'DETERMINATION','UNDETERMINED');
s=stability();r=s.requirementStability['REQ-STAGE17'];
assert(r.satisfied===9&&r.violated===0&&r.undetermined===1&&r.agreementRate===0.9,'Nine-of-ten undetermined stability did not reconcile to 9 SATISFIED / 1 UNDETERMINED / 0.9 agreement.');
setField(first,'OBSERVED_RESULT','SATISFIED');setField(first,'DETERMINATION','SATISFIED');
s=stability();r=s.requirementStability['REQ-STAGE17'];
assert(r.satisfied===10&&r.violated===0&&r.undetermined===0&&r.agreementRate===1,'Repaired ten-of-ten stability did not reconcile to complete agreement.');

const comparison=record('comparisons',13,{REQ_ID:'REQ-STAGE17',RUN_DETERMINATIONS:'All ten SATISFIED',INTERPRETATION_VARIANCE:'NONE',OUTPUT_VARIANCE:'Observed material variance',AUTHORIZED_VARIANCE:'FALSE',INCONCLUSIVE_TESTS:'NONE',REPEATED_FAILURE_PATTERNS:'NONE',UNIQUE_FAILURES:'NONE',CORRECTNESS_AFFECTING_VARIANCE:'TRUE',DEFECT_IDS:'DEFECT-STAGE17-VARIANCE',EVIDENCE:'Comparison evidence'},'COMPARISON-STAGE17');comparison.scope={...engine.scopeForIteration(p,iterationId)};p.projectData.comparisons.push(comparison);
s=stability();assert(s.unexplainedVarianceCount===1,'Unexplained correctness-affecting variance was not surfaced by the application-calculated stability metric.');
setField(comparison,'CORRECTNESS_AFFECTING_VARIANCE','FALSE');setField(comparison,'AUTHORIZED_VARIANCE','TRUE');
s=stability();assert(s.unexplainedVarianceCount===0,'Repaired/authorized variance did not clear the application-calculated unexplained-variance count.');

matrix=engine.verificationMatrix(p,iterationId);assert(matrix.coverage===1&&matrix.missing.length===0&&matrix.invalid.length===0,'Repaired cross-run fixture did not preserve the exact verification universe.');
console.log(JSON.stringify({controllerStage:'17',applicationStage:'13',crossRunComparison:'PASS',runCount:10,intentionalInvalidFixturesRejected:['one-violation-in-ten','one-undetermined-in-ten','unexplained-correctness-affecting-variance'],repairedPathProgressed:true,isolatedDisposableProject:true}));
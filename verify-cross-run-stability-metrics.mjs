import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','workflow-stage13-closure.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const hash=globalThis.closedLoopHash;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const assert=(value,message)=>{if(!value)throw new Error(message);};
const sha='c'.repeat(64);
function setField(record,key,value){record.fields=record.fields&&typeof record.fields==='object'?record.fields:{};record.fields[key]=value;record[key]=value;}
function record(collection,stage,fields,id,scope){const def=schema.RECORD_SCHEMAS[collection],all={...fields,[def.idField]:id},value={id,stage,active:true,scope:{...scope},fields:all,...all};engine.refreshRecordHashes(value,collection);return value;}

const p=core.createBlankState('JOB-STAGE17-STABILITY-METRICS');
Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Prove cross-run stability arithmetic over exactly ten current runs.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'});
engine.ensureShape(p);
engine.registerArtifactBytes(p,{stage:10,artifactId:'ARTIFACT-STAGE17-STABILITY',filename:'candidate.bin',mediaType:'application/octet-stream',byteSize:1,sha256:sha});
const decision=engine.recordRegisteredHumanDecision(p,{stage:10,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:hash.sha256Value(['ARTIFACT-STAGE17-STABILITY']),value:['ARTIFACT-STAGE17-STABILITY'],operatorLabel:'STAGE17_STABILITY_VERIFIER'});
const frozen=engine.freezeCandidate(p,{stage:10,artifactIds:['ARTIFACT-STAGE17-STABILITY'],selectionDecisionId:engine.recordId(decision,'humanDecisions'),operatorLabel:'STAGE17_STABILITY_VERIFIER'});
const iterationId=engine.recordId(frozen.iteration,'iterations'),candidateId=engine.recordId(frozen.candidate,'candidateFreezes'),scope={...engine.scopeForIteration(p,iterationId),requirementsVersion:p.job.CURRENT_REQUIREMENTS_VERSION,testSuiteVersion:p.job.CURRENT_TEST_SUITE_VERSION,instructionVersion:p.job.CURRENT_INSTRUCTION_VERSION};
const requirement=record('requirements',4,{MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'},'REQ-STAGE17-STABILITY',scope);p.projectData.requirements.push(requirement);
const slots=engine.reserveRunBatch(p,{stage:11,iterationId,candidateId,count:10});
for(let i=0;i<slots.length;i++){
  const run=engine.records(p,'runs').find(x=>engine.recordId(x,'runs')===slots[i].runId),ctx=engine.records(p,'freshContexts').find(x=>engine.recordId(x,'freshContexts')===slots[i].contextId);
  setField(ctx,'EXTERNAL_CONTEXT_IDENTIFIER',`generator-stage17-stability-${i+1}`);setField(ctx,'CONTAMINATION_STATUS','NONE');setField(ctx,'AUTHORIZED_PROJECT_INPUTS',['candidate']);
  setField(run,'CONTAMINATION_CHECK','NONE');setField(run,'EXECUTION_STATUS','COMPLETED');run.status='COMPLETED';
  const verification=record('verification',12,{REQ_ID:'REQ-STAGE17-STABILITY',RUN_ID:slots[i].runId,TEST_ID:'TEST-STAGE17-STABILITY',VERIFIER_CONTEXT_ID:`VERIFY-CONTEXT-${i+1}`,OBSERVED_RESULT:'SATISFIED',EXPECTED_RESULT:'SATISFIED',DETERMINATION:'SATISFIED'},`VERIFY-STAGE17-STABILITY-${i+1}`,{...scope,runId:slots[i].runId});
  p.projectData.verification.push(verification);
}
const stability=()=>engine.operationalMetrics(p).iterationStability.find(x=>x.iterationId===iterationId);
let metric=stability(),req=metric.requirementStability['REQ-STAGE17-STABILITY'];
assert(metric.runCount===10,'Stability universe did not contain exactly ten current runs.');
assert(req.satisfied===10&&req.violated===0&&req.undetermined===0&&req.agreementRate===1,'Ten identical determinations did not produce agreementRate 1.0.');
const first=p.projectData.verification[0];
setField(first,'OBSERVED_RESULT','VIOLATED');setField(first,'DETERMINATION','VIOLATED');
metric=stability();req=metric.requirementStability['REQ-STAGE17-STABILITY'];
assert(req.satisfied===9&&req.violated===1&&req.undetermined===0&&req.agreementRate===0.9,'Nine-of-ten agreement with one violation did not produce exact 0.9 agreement.');
setField(first,'OBSERVED_RESULT','UNDETERMINED');setField(first,'DETERMINATION','UNDETERMINED');
metric=stability();req=metric.requirementStability['REQ-STAGE17-STABILITY'];
assert(req.satisfied===9&&req.violated===0&&req.undetermined===1&&req.agreementRate===0.9,'Nine-of-ten agreement with one undetermined result did not produce exact 0.9 agreement.');
setField(first,'OBSERVED_RESULT','SATISFIED');setField(first,'DETERMINATION','SATISFIED');
metric=stability();req=metric.requirementStability['REQ-STAGE17-STABILITY'];
assert(req.satisfied===10&&req.violated===0&&req.undetermined===0&&req.agreementRate===1,'Repaired ten-of-ten fixture did not restore agreementRate 1.0.');
console.log(JSON.stringify({controllerStage:'17',applicationStage:'13',crossRunStabilityMetrics:'PASS',runCount:10,intentionalInvalidFixturesRejected:['one-violation-in-ten','one-undetermined-in-ten'],repairedPathProgressed:true,isolatedDisposableProject:true}));

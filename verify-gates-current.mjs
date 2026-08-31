import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion,store=globalThis.closedLoopProjectStore;
const assert=(v,m)=>{if(!v)throw new Error(m);};
function project(id){const p=core.createBlankState(id);Object.assign(p.job,{JOB_ID:id,JOB_TITLE:'Current gate verification',EXACT_USER_OBJECTIVE_VERBATIM:'Verify current lifecycle gates.',CURRENT_INPUT_VERSION:'INPUT-v001'});engine.ensureShape(p);engine.recalculate(p);return p;}

assert(core.STAGES.length===30&&!core.STAGES[30],'Exactly 30 stages are required.');
assert(JSON.stringify(engine.STAGE_STATES)===JSON.stringify(['NOT STARTED','IN PROGRESS','BLOCKED','READY','COMPLETE']),'Stage states changed.');
assert(JSON.stringify(engine.applicationTestCapabilities())===JSON.stringify(['CLOSED_LOOP_TEST_IR']),'Native capability registry changed.');

// Stage 06 rejects intrinsically unavailable execution modes and fake native executors.
{
  const p=project('JOB-GATE-UNAVAILABLE');Object.assign(p.job,{CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001'});const scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001'};
  p.projectData.requirements.push({id:'REQ-1',stage:4,active:true,scope,fields:{REQ_ID:'REQ-1',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}});
  p.projectData.tests.push({id:'TEST-1',stage:6,active:true,scope:{...scope,testSuiteVersion:'TEST-SUITE-v001'},fields:{TEST_ID:'TEST-1',REQ_ID:'REQ-1',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'UNAVAILABLE',REQUIRED_CAPABILITY:'missing-capability',ARTIFACT_REQUIREMENTS:'NONE',INPUTS:'input',TOOLS:'tool',PROCEDURE:'verify',EXPECTED_RESULT:'pass',FAILURE_CONDITION:'fail',EVIDENCE_TO_PRESERVE:'evidence',STATUS:'READY'},relationships:{REQ_ID:'REQ-1'}});
  const plan=engine.testExecutionPlan(p),g=engine.gate(6,p);assert(plan.unavailableTestIds.includes('TEST-1'),'UNAVAILABLE test was not blocked by the execution plan.');assert(g.reasons.some(x=>x.includes('unavailable execution capability')),'Stage 06 accepted an intrinsically unavailable mandatory capability.');
}
{
  const p=project('JOB-GATE-NATIVE');Object.assign(p.job,{CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001'});const scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001'};
  p.projectData.requirements.push({id:'REQ-2',stage:4,active:true,scope,fields:{REQ_ID:'REQ-2',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}});
  p.projectData.tests.push({id:'TEST-2',stage:6,active:true,scope:{...scope,testSuiteVersion:'TEST-SUITE-v001'},fields:{TEST_ID:'TEST-2',REQ_ID:'REQ-2',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'NOT_REGISTERED',ARTIFACT_REQUIREMENTS:'NONE',INPUTS:'input',TOOLS:'application',PROCEDURE:'verify',EXPECTED_RESULT:'pass',FAILURE_CONDITION:'fail',EVIDENCE_TO_PRESERVE:'evidence',STATUS:'READY'},relationships:{REQ_ID:'REQ-2'}});
  const plan=engine.testExecutionPlan(p),g=engine.gate(6,p);assert(plan.unsupportedApplicationTestIds.includes('TEST-2'),'Unsupported native test was not blocked.');assert(g.reasons.some(x=>x.includes('without a registered application-native executor')),'Stage 06 accepted an unsupported native executor.');
}

// Exact current byte readiness is an execution-plan property. Metadata-only or lost bytes cannot satisfy readiness; restored verified bytes can.
{
  const p=project('JOB-GATE-BYTES');Object.assign(p.job,{CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001'});const scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001'};
  p.projectData.requirements.push({id:'REQ-3',stage:4,active:true,scope,fields:{REQ_ID:'REQ-3',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}});
  p.projectData.tests.push({id:'TEST-3',stage:6,active:true,scope:{...scope,testSuiteVersion:'TEST-SUITE-v001'},fields:{TEST_ID:'TEST-3',REQ_ID:'REQ-3',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITY:'exact tool',ARTIFACT_REQUIREMENTS:'fixture.bin',INPUTS:'controlled',TOOLS:'exact tool',PROCEDURE:'execute',EXPECTED_RESULT:'pass',FAILURE_CONDITION:'fail',EVIDENCE_TO_PRESERVE:'report',STATUS:'READY'},relationships:{REQ_ID:'REQ-3'},evidenceRefs:['EVIDENCE-3']});
  p.projectData.evidenceRecords.push({id:'EVIDENCE-3',stage:6,active:true,fields:{EVIDENCE_ID:'EVIDENCE-3',ATTACHMENT_ID:'ARTIFACT-3',STATUS:'PRESERVED'}});
  let plan=engine.testExecutionPlan(p);assert(plan.missingArtifactTestIds.includes('TEST-3'),'Missing artifact bytes were reported executable.');
  p.projectData.artifacts.push({id:'ARTIFACT-3',stage:6,active:true,fields:{ARTIFACT_ID:'ARTIFACT-3',FILENAME:'fixture.bin',AVAILABILITY:'METADATA_ONLY'}});plan=engine.testExecutionPlan(p);assert(plan.missingArtifactTestIds.includes('TEST-3'),'Metadata-only artifact satisfied byte readiness.');
  p.projectData.artifacts[0].fields.AVAILABILITY='BYTES_PERSISTED_AND_VERIFIED';plan=engine.testExecutionPlan(p);assert(!plan.missingArtifactTestIds.includes('TEST-3')&&plan.items[0].artifactIds.includes('ARTIFACT-3'),'Verified bytes did not restore execution readiness.');
  p.projectData.artifacts[0].fields.AVAILABILITY='UNAVAILABLE';plan=engine.testExecutionPlan(p);assert(plan.missingArtifactTestIds.includes('TEST-3'),'Later byte loss did not revoke execution readiness.');
}

// Human-only clarification blocks Stage 01 and saving the answer versions User Job Input.
{
  let p=project('JOB-GATE-HUMAN'),stage=1;const pr={...prompts.buildPromptRecord(stage,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);
  const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:{...pr.scope},responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'q1',question:'Which human-authority value controls this job?',whyRequired:'Only the human can decide it.',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});assert(prepared.validation.valid,'Valid human-input request was rejected.');p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;engine.recalculate(p);assert(engine.unresolvedHumanRequests(p,1).length===1&&engine.gate(1,p).blocked,'Blocking human question did not block Stage 01.');const request=p.projectData.humanInputRequests.at(-1),before=p.job.CURRENT_INPUT_VERSION;p=ingestion.answerHumanInput(p,{[request.requestId]:'human answer'},{operator:'VERIFY'}).project;assert(engine.unresolvedHumanRequests(p,1).length===0&&p.job.CURRENT_INPUT_VERSION!==before,'Human answer did not resolve and version User Job Input.');
}

// Human-authority changes reopen the responsible stage and invalidate downstream canonical evidence.
{
  const p=project('JOB-GATE-AUTHORITY');p.stages[1].status='COMPLETE';p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'old'};p.stages[1].acceptedData={EXACT_DELIVERABLE_REQUESTED:'old'};p.stages[1].acceptedDataChangeIds=['CHANGE-OLD'];p.projectData.acceptedChanges.push({changeId:'CHANGE-OLD',stage:1,status:'COMMITTED',responseType:'DATA_PROPOSAL',rawResponseId:'RAW-OLD'});const downstream={id:'SOURCE-OLD',stage:2,active:true,fields:{SOURCE_ID:'SOURCE-OLD'}};p.projectData.sources.push(downstream);engine.invalidateStageForAuthorityChange(p,{stage:1,reason:'User Job Input changed after Stage 01 completion.',operatorLabel:'VERIFY'});assert(p.stages[1].status!=='COMPLETE'&&!Object.keys(p.stages[1].agentData||{}).length,'Changed human authority left Stage 01 acceptance current.');assert(downstream.active===false&&downstream.invalidatedBy,'Changed human authority left downstream evidence current.');
}

// Durable storage failure is atomic: complete commit or no state change.
class MemoryStorage{constructor(seed={}){this.m=new Map(Object.entries(seed));}getItem(k){return this.m.has(k)?this.m.get(k):null;}setItem(k,v){this.m.set(k,String(v));}removeItem(k){this.m.delete(k);}clear(){this.m.clear();}}
{
  const storage=new MemoryStorage();store.writeAll([{job:{JOB_ID:'JOB-ROLLBACK'}}],storage);const before=storage.getItem(store.STORE_KEY);globalThis.__closedLoopStorageFault='after-final-write';let failed=false;try{store.writeAll([{job:{JOB_ID:'JOB-CHANGED'}}],storage);}catch{failed=true;}finally{delete globalThis.__closedLoopStorageFault;}assert(failed&&storage.getItem(store.STORE_KEY)===before,'Injected storage failure produced a partial state change.');
}

console.log(JSON.stringify({currentGateSemantics:true,unavailableCapabilityBlocked:true,unsupportedNativeBlocked:true,byteReadinessRevocation:true,humanInputGate:true,authorityInvalidation:true,acceptedStateStorageRollback:true},null,2));
console.log('verify-gates-current: PASS');

import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion,store=globalThis.closedLoopProjectStore;
if(!core||!schema||!engine||!prompts||!ingestion||!store)throw new Error('Responsible-layer modules failed to load.');
const assert=(value,message)=>{if(!value)throw new Error(message);};
const record=(collection,stage,fields={},id)=>{const def=schema.RECORD_SCHEMAS[collection],recordId=id||`${def.prefix}-TEST`;return {id:recordId,stage,active:true,fields:{...fields,[def.idField]:recordId},...fields,[def.idField]:recordId};};
function project(jobId='JOB-FINAL-VERIFY'){
  const p=core.createBlankState(jobId);p.job.JOB_ID=jobId;p.job.JOB_TITLE='Final verification fixture';p.job.EXACT_USER_OBJECTIVE_VERBATIM='Synthetic implementation-verification project only.';p.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(p);engine.recalculate(p);return p;
}
function prompt(p,stage){const r={...prompts.buildPromptRecord(stage,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(r);return r;}
function acceptStage1Fixture(p){
  const stage=1,pr=prompt(p,stage),manifest=pr.contextManifest.intakeCoverageManifest;
  const capture={schema:'closed-loop-stage01-capture/1',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,units:manifest.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'Accepted Stage 01 prerequisite fixture preserves current human authority.',extractedStatements:[{statementKey:'STAGE1-'+String(index+1),text:unit.rawValueText||unit.label||unit.unitId,statementClass:'CONTEXT'}]}))};
  const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{EXACT_DELIVERABLE_REQUESTED:'Verify accepted response refinement.',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)},records:{},evidence:[{temporaryKey:'stage1-evidence',kind:'INTAKE',description:'Accepted Stage 01 fixture evidence',authorityType:'AGENT_CLAIM',location:'verify-complete.mjs',content:'Every controlled Stage 01 input unit is accounted for.'}],unresolved:[],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(envelope),promptRecord:pr});
  assert(prepared.validation.valid,`Accepted Stage 01 fixture response rejected: ${JSON.stringify(prepared.validation.issues)}`);
  assert(prepared.proposal?.status==='PENDING_OPERATOR_REVIEW','Accepted Stage 01 fixture did not create a reviewable proposal.');
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY',reviewNote:'Establish the real Stage 01 prerequisite for Stage 02 refinement.'});
  const next=committed.project,acceptedChange=committed.acceptedChange;
  assert(acceptedChange?.changeId&&engine.acceptedChanges(next,1).length===1,'Accepted Stage 01 fixture did not create one canonical Stage 01 change.');
  next.projectData.stageConfirmations.push({confirmationId:'CONFIRM-STAGE1-REFINEMENT',stage:1,acceptedChangeId:acceptedChange.changeId,inputVersion:next.job.CURRENT_INPUT_VERSION,confirmed:true,operator:'VERIFY',deviceTimestamp:new Date().toISOString()});
  engine.recalculate(next);
  assert(next.stages[1].status==='COMPLETE'&&engine.evaluateIntakeAccounting(next).complete,'Accepted Stage 01 fixture did not remain complete after recalculation.');
  return next;
}

// Formal-state meanings remain exact and no Stage 31 exists.
assert(JSON.stringify(engine.STAGE_STATES)===JSON.stringify(['NOT STARTED','IN PROGRESS','BLOCKED','READY','COMPLETE']),'Stage tracker states changed.');
assert(JSON.stringify(engine.FORMAL_STATES)===JSON.stringify(['UNKNOWN','NONE','NOT APPLICABLE','TRUE','FALSE','SATISFIED','VIOLATED','UNDETERMINED','ACCEPTED','REJECTED','BLOCKED']),'Formal states changed.');
assert(core.STAGES.length===30&&!core.STAGES[30],'Stage 31 exists.');

// Verification definitions explicitly separate execution responsibility and unavailable capability fails closed.
{
  const def=schema.RECORD_SCHEMAS.tests;
  for(const field of ['EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS'])assert(def.required.includes(field)&&def.fieldDefinitions[field]?.producer===schema.PRODUCER.AGENT,`Missing required TEST execution field ${field}.`);
  const p=project('JOB-TEST-EXECUTION');
  Object.assign(p.job,{CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001'});
  const scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001'};
  p.projectData.requirements.push({id:'REQ-EXEC-1',stage:4,active:true,scope,fields:{REQ_ID:'REQ-EXEC-1',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}});
  p.projectData.tests.push({id:'TEST-EXEC-1',stage:6,active:true,scope:{...scope,testSuiteVersion:'TEST-SUITE-v001'},fields:{TEST_ID:'TEST-EXEC-1',REQ_ID:'REQ-EXEC-1',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'UNAVAILABLE',REQUIRED_CAPABILITY:'specialized-capability-not-present',ARTIFACT_REQUIREMENTS:'NONE',INPUTS:'controlled input',TOOLS:'specialized system',PROCEDURE:'execute controlled verification',EXPECTED_RESULT:'satisfied',FAILURE_CONDITION:'required result not established',EVIDENCE_TO_PRESERVE:'execution evidence',STATUS:'READY'},relationships:{REQ_ID:'REQ-EXEC-1'}});
  const plan=engine.testExecutionPlan(p);
  assert(plan.total===1&&plan.unavailableTestIds.includes('TEST-EXEC-1'),'Execution plan did not identify unavailable mandatory capability.');
  const g=engine.gate(6,p);
  assert(g.reasons.some(reason=>reason.includes('unavailable execution capability')),'Stage 06 did not fail closed on unavailable mandatory execution capability.');
}


// APPLICATION_DETERMINISTIC cannot satisfy Stage 06 unless an actual application-native executor is registered.
{
  assert(JSON.stringify(engine.applicationTestCapabilities())===JSON.stringify(['CLOSED_LOOP_TEST_IR']),'Application-native capability registry must contain only the exact Closed Loop Test IR capability.');
  const p=project('JOB-NATIVE-EXECUTOR-TRUTH');
  Object.assign(p.job,{CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001'});
  const scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001'};
  p.projectData.requirements.push({id:'REQ-NATIVE-1',stage:4,active:true,scope,fields:{REQ_ID:'REQ-NATIVE-1',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}});
  p.projectData.tests.push({id:'TEST-NATIVE-1',stage:6,active:true,scope:{...scope,testSuiteVersion:'TEST-SUITE-v001'},fields:{TEST_ID:'TEST-NATIVE-1',REQ_ID:'REQ-NATIVE-1',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'NONEXISTENT_NATIVE_EXECUTOR',ARTIFACT_REQUIREMENTS:'NONE',INPUTS:'canonical input',TOOLS:'application',PROCEDURE:'native check',EXPECTED_RESULT:'satisfied',FAILURE_CONDITION:'not satisfied',EVIDENCE_TO_PRESERVE:'derived evidence',STATUS:'READY'},relationships:{REQ_ID:'REQ-NATIVE-1'}});
  const plan=engine.testExecutionPlan(p);
  assert(plan.unsupportedApplicationTestIds.includes('TEST-NATIVE-1'),'Execution plan did not identify unsupported application-native test execution.');
  const g=engine.gate(6,p);
  assert(g.reasons.some(reason=>reason.includes('without a registered application-native executor')),'Stage 06 accepted an APPLICATION_DETERMINISTIC test with no actual executor.');
}

// Stage 06 continuously rechecks exact required artifact custody from canonical evidence and current verified bytes.
{
  const p=project('JOB-TEST-ARTIFACT-CURRENT');
  Object.assign(p.job,{CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001'});
  const scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001'};
  p.projectData.requirements.push({id:'REQ-ART-1',stage:4,active:true,scope,fields:{REQ_ID:'REQ-ART-1',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}});
  p.projectData.tests.push({id:'TEST-ART-1',stage:6,active:true,scope:{...scope,testSuiteVersion:'TEST-SUITE-v001'},fields:{TEST_ID:'TEST-ART-1',REQ_ID:'REQ-ART-1',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITY:'exact tool',ARTIFACT_REQUIREMENTS:'fixture.bin',INPUTS:'controlled',TOOLS:'exact tool',PROCEDURE:'execute',EXPECTED_RESULT:'pass',FAILURE_CONDITION:'fail',EVIDENCE_TO_PRESERVE:'report',STATUS:'READY'},relationships:{REQ_ID:'REQ-ART-1'},evidenceRefs:['EVIDENCE-ART-1']});
  p.projectData.evidenceRecords.push({id:'EVIDENCE-ART-1',stage:6,active:true,fields:{EVIDENCE_ID:'EVIDENCE-ART-1',ATTACHMENT_ID:'ARTIFACT-ART-1',STATUS:'PRESERVED'}});
  let plan=engine.testExecutionPlan(p);assert(plan.missingArtifactTestIds.includes('TEST-ART-1'),'A TEST with a missing canonical artifact was reported ready.');assert(engine.gate(6,p).reasons.some(reason=>reason.includes('missing or no longer application-verified')),'Stage 06 did not fail closed after required artifact bytes became unavailable.');
  p.projectData.artifacts.push({id:'ARTIFACT-ART-1',stage:6,active:true,fields:{ARTIFACT_ID:'ARTIFACT-ART-1',AVAILABILITY:'METADATA_ONLY'}});plan=engine.testExecutionPlan(p);assert(plan.missingArtifactTestIds.includes('TEST-ART-1'),'Metadata-only artifact incorrectly satisfied TEST custody.');
  p.projectData.artifacts[0].fields.AVAILABILITY='BYTES_PERSISTED_AND_VERIFIED';plan=engine.testExecutionPlan(p);assert(!plan.missingArtifactTestIds.includes('TEST-ART-1')&&plan.items[0].artifactIds.includes('ARTIFACT-ART-1'),'Verified current artifact bytes did not satisfy TEST custody.');
}

// Invalid canonical relationship is rejected before mutation.
{
  const p=project('JOB-BAD-REL'),stage=3;p.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='NO_APPLICABLE_EXTERNAL_SOURCE';p.stages[2].status='COMPLETE';p.stages[2].gate={complete:true,blocked:false,reasons:[]};const pr=prompt(p,stage);
  const e={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{research:[{tempKey:'research-1',fields:{PASS_NUMBER:1,EXACT_PORTION_EXAMINED:'Controlled source portion',FINDING_CLASSIFICATION:'FACT',SOURCE_EVIDENCE:'Controlled evidence'},relationships:{SOURCE_ID:{recordId:'SOURCE-DOES-NOT-EXIST'}},evidenceRefs:['evidence-1']}]},evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Relationship validation fixture',location:'synthetic test',content:'controlled'}],unresolved:[],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});
  assert(!prepared.validation.valid&&prepared.validation.issues.some(x=>x.code==='UNRESOLVED_RELATIONSHIP'),'Invalid relationship was not rejected.');
  assert(prepared.project.projectData.research.length===0&&prepared.project.projectData.acceptedChanges.length===0,'Invalid relationship partially mutated canonical state.');
}

// Structured blocking human question blocks the stage until answered and versions User Job Input.
{
  let p=project('JOB-HUMAN-GATE'),stage=1,pr=prompt(p,stage);
  const e={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'question-1',question:'Which jurisdiction controls this job?',whyRequired:'Jurisdiction is human-authority input.',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});assert(prepared.validation.valid,'Valid clarification envelope rejected.');
  p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;engine.recalculate(p);
  assert(engine.unresolvedHumanRequests(p,1).length===1,'Blocking human question was not discoverable by the gate.');const humanGate=engine.gate(1,p);assert(humanGate.blocked===true,`Stage 01 gate returned blocked=${humanGate.blocked} with an unresolved blocking question.`);engine.recalculate(p);assert(p.stages[1].status==='BLOCKED',`Blocking human question left Stage 01 in ${p.stages[1].status}, not BLOCKED.`);
  const request=p.projectData.humanInputRequests.at(-1),before=p.job.CURRENT_INPUT_VERSION;
  p=ingestion.answerHumanInput(p,{[request.requestId]:'United States'},{operator:'VERIFY'}).project;
  assert(engine.unresolvedHumanRequests(p,1).length===0&&p.job.CURRENT_INPUT_VERSION!==before,'Human answer did not resolve question and version User Job Input.');
}

// Human authority changes must invalidate the stage whose accepted result depended on that authority.
{
  const appSource=fs.readFileSync('app-core.js','utf8');
  assert(appSource.includes("invalidateStageForAuthorityChange(next,{stage:1,reason:'User Job Input changed after Stage 01 completion.'"),'User Job Input edits do not reopen Stage 01.');
  assert(appSource.includes("invalidateStageForAuthorityChange(next,{stage,reason:'Human-owned stage input changed after completion.'"),'Completed human-decision stages are not reopened when their authority changes.');
  assert(!appSource.includes("invalidateDownstream(next,1,id,'User Job Input changed after Stage 01 completion.'"),'User Job Input edits still preserve stale Stage 01 acceptance.');
  assert(!appSource.includes("invalidateDownstream(next,stage,id,'Human-owned stage input changed after completion.'"),'Human stage edits still preserve stale current-stage acceptance.');
  const p=project('JOB-HUMAN-AUTHORITY-CHANGE');
  p.stages[1].status='COMPLETE';p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'OLD DELIVERABLE'};p.stages[1].acceptedData={EXACT_DELIVERABLE_REQUESTED:'OLD DELIVERABLE'};p.stages[1].acceptedDataChangeIds=['CHANGE-STAGE1-OLD'];p.stages[1].acceptedResponseIds=['CHANGE-STAGE1-OLD'];p.projectData.acceptedChanges.push({changeId:'CHANGE-STAGE1-OLD',stage:1,status:'COMMITTED',responseType:'DATA_PROPOSAL',rawResponseId:'RAW-STAGE1-OLD'});p.projectData.stageConfirmations.push({confirmationId:'CONFIRM-STAGE1-OLD',stage:1,acceptedChangeId:'CHANGE-STAGE1-OLD',confirmed:true});
  p.stages[2].status='COMPLETE';const source=record('sources',2,{TITLE:'Old source',ISSUING_ORGANIZATION_OR_AUTHOR:'Authority',SOURCE_TYPE:'OFFICIAL_STANDARD',PUBLICATION_ORIGIN:'Authority',URL_REFERENCE:'https://example.invalid/old',AUTHORITY_LEVEL:'PRIMARY',AUTHORITY_ROLE:'GOVERNING',RELEVANCE:'old',APPLICABLE_PORTIONS:'old',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT SUPERSEDED',CONTROLLING_STATE:'CONTROLLING'},'SOURCE-OLD-INPUT');p.projectData.sources.push(source);engine.invalidateStageForAuthorityChange(p,{stage:1,reason:'User Job Input changed after Stage 01 completion.',operatorLabel:'VERIFY'});
  assert(p.stages[1].status!=='COMPLETE'&&!Object.keys(p.stages[1].agentData||{}).length&&!Object.keys(p.stages[1].acceptedData||{}).length,'Stage 01 remained complete with stale normalized input.');assert(p.projectData.acceptedChanges[0].invalidatedBy&&p.projectData.stageConfirmations[0].invalidatedBy,'Old Stage 01 acceptance or confirmation remained current.');assert(source.active===false&&source.invalidatedBy,'Stage 02 evidence remained current after Stage 01 authority changed.');
  const q=project('JOB-STAGE-HUMAN-AUTHORITY');q.stages[10].status='COMPLETE';q.stages[10].humanData={FREEZE_OWNER:'NEW OWNER'};q.stages[10].agentData={HASHES_RECORDED_WHERE_PRACTICAL:'TRUE'};q.stages[10].acceptedData={HASHES_RECORDED_WHERE_PRACTICAL:'TRUE'};q.stages[10].acceptedDataChangeIds=['CHANGE-STAGE10-OLD'];q.projectData.acceptedChanges.push({changeId:'CHANGE-STAGE10-OLD',stage:10,status:'COMMITTED',responseType:'DATA_PROPOSAL',rawResponseId:'RAW-STAGE10-OLD'});q.stages[11].status='COMPLETE';const run=record('runs',11,{ITERATION_ID:'ITERATION-X',CANDIDATE_ID:'CANDIDATE-X',CONTEXT_ID:'CONTEXT-X',CONTAMINATION_CHECK:'NONE',COMPLETE_OUTPUT:'old output'},'RUN-OLD-HUMAN-AUTHORITY');q.projectData.runs.push(run);engine.invalidateStageForAuthorityChange(q,{stage:10,reason:'Human-owned stage input changed after completion.',operatorLabel:'VERIFY'});
  assert(q.stages[10].status!=='COMPLETE'&&q.stages[10].humanData.FREEZE_OWNER==='NEW OWNER','Stage 10 human authority was lost or stale Stage 10 completion remained current.');assert(!Object.keys(q.stages[10].agentData||{}).length&&!Object.keys(q.stages[10].acceptedData||{}).length&&q.projectData.acceptedChanges[0].invalidatedBy,'Old Stage 10 agent acceptance remained current after human authority changed.');assert(run.active===false&&run.invalidatedBy,'Stage 11 dependent run remained current after Stage 10 authority changed.');
}

// Explicit workflow gates cannot be bypassed by manual assertions.
{
  const p=project('JOB-GATES');
  assert(!engine.gate(8,p).complete&&engine.gate(8,p).reasons.some(r=>/Stage 7|verification|accepted/i.test(r)),'Stage 08 can complete without prerequisite evidence.');
  for(let i=0;i<9;i++)p.projectData.runs.push(record('runs',11,{CONTEXT_ID:`CTX-${i}`,CONTAMINATION_CHECK:'NONE',CANDIDATE_ID:'CANDIDATE-X',COMPLETE_OUTPUT:'output'},`RUN-${i}`));
  assert(engine.gate(11,p).reasons.some(r=>/Exactly ten current runs|Exactly 10 independent runs/i.test(r)),'Stage 11 does not enforce exactly ten runs.');
  assert(!engine.gate(12,p).complete&&engine.gate(12,p).reasons.some(r=>/ten runs|coverage|REQ × RUN × TEST/i.test(r)),'Stage 12 verification matrix gate is bypassable.');
  assert(engine.convergenceMetrics(p).converged===false,'Run count/empty state incorrectly establishes convergence.');
  assert(!engine.gate(20,p).complete&&engine.gate(20,p).reasons.some(r=>/unchanged confirmation/i.test(r)),'Stage 20 does not require unchanged confirmation.');
}


// Stage 11 initial execution completion does not depend on Stage 12 verification triples.
{
  const p=project('JOB-STAGE11-BOUNDARY');
  p.job.CURRENT_ITERATION='ITERATION-STAGE11';p.stages[10].status='COMPLETE';
  p.projectData.iterations.push(record('iterations',10,{CANDIDATE_ID:'CANDIDATE-STAGE11',STATUS:'FROZEN'},'ITERATION-STAGE11'));
  p.projectData.candidateFreezes.push(record('candidateFreezes',10,{ITERATION_ID:'ITERATION-STAGE11',COMPONENT_HASHES:{'ARTIFACT-STAGE11':'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'},STATUS:'FROZEN'},'CANDIDATE-STAGE11'));
  for(let i=0;i<10;i++){
    const run=record('runs',11,{ITERATION_ID:'ITERATION-STAGE11',CANDIDATE_ID:'CANDIDATE-STAGE11',CONTEXT_ID:`CONTEXT-STAGE11-${i}`,CONTAMINATION_CHECK:'NONE',COMPLETE_OUTPUT:`output-${i}`},`RUN-STAGE11-${i}`);
    run.scope={iterationId:'ITERATION-STAGE11',candidateId:'CANDIDATE-STAGE11'};p.projectData.runs.push(run);
    const context=record('freshContexts',11,{EXTERNAL_CONTEXT_IDENTIFIER:`external-stage11-${i}`,ITERATION_ID:'ITERATION-STAGE11',RUN_ID:`RUN-STAGE11-${i}`},`CONTEXT-STAGE11-${i}`);context.scope={iterationId:'ITERATION-STAGE11',candidateId:'CANDIDATE-STAGE11'};p.projectData.freshContexts.push(context);
    p.projectData.acceptedChanges.push({changeId:`CHANGE-STAGE11-${i}`,stage:11,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'EXECUTE_RUN',rawResponseId:`RAW-STAGE11-${i}`,scope:{iterationId:'ITERATION-STAGE11',candidateId:'CANDIDATE-STAGE11',runId:`RUN-STAGE11-${i}`,contextId:`CONTEXT-STAGE11-${i}`}});
    p.projectData.rawResponses.push({rawResponseId:`RAW-STAGE11-${i}`,stage:11});p.projectData.outputReceipts.push({receiptId:`RECEIPT-STAGE11-${i}`,rawResponseId:`RAW-STAGE11-${i}`,stage:11,iteration:'ITERATION-STAGE11',runId:`RUN-STAGE11-${i}`,contextId:`CONTEXT-STAGE11-${i}`});
  }
  const stage11=engine.gate(11,p);assert(stage11.complete,`Stage 11 incorrectly depends on Stage 12 verification data: ${stage11.reasons.join('; ')}`);
  const stage12=engine.gate(12,p);assert(!stage12.complete&&stage12.reasons.some(r=>/REQ × RUN × TEST|coverage/i.test(r)),'Stage 12 completed without verification triples.');
}

// Current-scope selection excludes historical scoped records.
{
  const p=project('JOB-SCOPE');p.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v002';p.job.CURRENT_TEST_SUITE_VERSION='TEST-SUITE-v002';p.job.CURRENT_ITERATION='ITERATION-2';
  const current=record('requirements',4,{OBLIGATION:'current',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'yes',INTENDED_VERIFICATION_METHOD:'test',EXPECTED_EVIDENCE:'e',FAILURE_CONDITION:'f',SEVERITY:'MAJOR',STATUS:'ACTIVE'},'REQ-CURRENT');current.scope={inputVersion:'INPUT-v001',requirementsVersion:'REQUIREMENTS-v002'};
  const stale=record('requirements',4,{OBLIGATION:'stale',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'yes',INTENDED_VERIFICATION_METHOD:'test',EXPECTED_EVIDENCE:'e',FAILURE_CONDITION:'f',SEVERITY:'MAJOR',STATUS:'ACTIVE'},'REQ-STALE');stale.scope={inputVersion:'INPUT-v001',requirementsVersion:'REQUIREMENTS-v001'};p.projectData.requirements.push(current,stale);
  const ids=engine.recordsForCurrentScope(p,'requirements').map(x=>engine.recordId(x,'requirements'));assert(ids.includes('REQ-CURRENT')&&!ids.includes('REQ-STALE'),'Historical scope satisfied current selector.');
  const unscoped=record('requirements',4,{OBLIGATION:'unscoped historical',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'yes',INTENDED_VERIFICATION_METHOD:'test',EXPECTED_EVIDENCE:'e',FAILURE_CONDITION:'f',SEVERITY:'MAJOR',STATUS:'ACTIVE'},'REQ-UNSCOPED');delete unscoped.scope;p.projectData.requirements.push(unscoped);const partial=record('requirements',4,{OBLIGATION:'partial historical',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'yes',INTENDED_VERIFICATION_METHOD:'test',EXPECTED_EVIDENCE:'e',FAILURE_CONDITION:'f',SEVERITY:'MAJOR',STATUS:'ACTIVE'},'REQ-PARTIAL');partial.scope={requirementsVersion:'REQUIREMENTS-v002'};p.projectData.requirements.push(partial);const scopedIds=engine.recordsForCurrentScope(p,'requirements').map(x=>engine.recordId(x,'requirements'));assert(!scopedIds.includes('REQ-UNSCOPED'),'Unscoped historical record satisfied current selector.');assert(!scopedIds.includes('REQ-PARTIAL'),'Partially scoped historical record satisfied current selector.');
}
// Artifact identity is independent of file-selection order.
{
  const p=project('JOB-ORDER');p.projectData.releaseRecords.push(record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-ORDER'));
  const audited=[{artifactId:'A',name:'a.bin',size:1,sha256:'a'},{artifactId:'B',name:'b.bin',size:2,sha256:'b'}];const delivery=[{artifactId:'B',name:'b.bin',size:2,sha256:'b'},{artifactId:'A',name:'a.bin',size:1,sha256:'a'}];
  const r=engine.verifyArtifactIdentity(p,audited,delivery);assert(r.length===2&&p.release.authorization==='AUTHORIZED','Artifact identity depends on file-selection order.');
}
// Material upstream change invalidates downstream records and release authorization.
{
  const p=project('JOB-INVALIDATION');
  p.stages[2].status='COMPLETE';p.stages[2].acceptedResponseIds=['RAW-1'];
  p.stages[3].status='COMPLETE';p.stages[3].acceptedResponseIds=['RAW-2'];
  const src=record('sources',2,{TITLE:'Synthetic independent source',ISSUING_ORGANIZATION_OR_AUTHOR:'Authority',SOURCE_TYPE:'OFFICIAL_STANDARD',PUBLICATION_ORIGIN:'Authority',URL_REFERENCE:'https://example.invalid/source',AUTHORITY_LEVEL:'PRIMARY',AUTHORITY_ROLE:'GOVERNING',RELEVANCE:'fixture',APPLICABLE_PORTIONS:'fixture',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT SUPERSEDED',CONTROLLING_STATE:'CONTROLLING'},'SOURCE-TEST');
  const res=record('research',3,{PASS_NUMBER:1,EXACT_PORTION_EXAMINED:'portion',FINDING_CLASSIFICATION:'FACT',SOURCE_EVIDENCE:'evidence'},'RESEARCH-TEST');
  p.projectData.sources.push(src);p.projectData.research.push(res);p.release.authorization='AUTHORIZED';p.release.authorizedArtifactIds=['FILE-1'];
  engine.invalidateDownstream(p,1,'CHANGESET-VERIFY','Controlled upstream correction');
  assert(src.active===false&&src.invalidatedBy==='CHANGESET-VERIFY'&&res.active===false&&res.invalidatedBy==='CHANGESET-VERIFY','Dependent records were not invalidated.');
  assert(p.release.authorization==='NOT AUTHORIZED'&&p.release.authorizedArtifactIds.length===0,'Upstream invalidation did not revoke release authorization.');
}

// Release identity is prohibited before ACCEPTED and exact mismatches remain unauthorized.
{
  const p=project('JOB-IDENTITY');let threw=false;try{engine.verifyArtifactIdentity(p,[{artifactId:'A',name:'x.bin',size:3,sha256:'aaa'}],[{artifactId:'A',name:'x.bin',size:3,sha256:'aaa'}]);}catch{threw=true;}assert(threw,'Stage 28 ran before an ACCEPTED Stage 27 determination.');
  p.projectData.releaseRecords.push(record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-TEST'));
  const result=engine.verifyArtifactIdentity(p,[{artifactId:'A',name:'x.bin',size:3,sha256:'aaa'}],[{artifactId:'A',name:'x.bin',size:4,sha256:'bbb'}]);
  assert(result.length===1&&result[0].AUTHORIZATION==='NOT AUTHORIZED'&&p.release.authorization==='NOT AUTHORIZED','Mismatched release bytes were authorized.');
}

// Missing evidence-chain links remain missing; the application does not invent them.
{
  const p=project('JOB-CHAIN');const req=record('requirements',4,{OBLIGATION:'Synthetic mandatory requirement',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:'User Job Input',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'observable',INTENDED_VERIFICATION_METHOD:'deterministic',EXPECTED_EVIDENCE:'evidence',FAILURE_CONDITION:'missing',SEVERITY:'MAJOR',STATUS:'ACTIVE'},'REQ-TEST');req.scope=engine.currentScope(p);p.projectData.requirements.push(req);
  const chains=engine.constructEvidenceChains(p);assert(chains.length===1&&chains[0].STATUS==='INCOMPLETE'&&chains[0].MISSING_LINKS.length>0,'Missing evidence links were fabricated as complete.');
}

// Persistence failure after a fully prepared accepted project rolls back exact prior bytes.
{
  class MemoryStorage{constructor(){this.m=new Map();}getItem(k){return this.m.has(k)?this.m.get(k):null;}setItem(k,v){this.m.set(k,String(v));}removeItem(k){this.m.delete(k);}}
  const storage=new MemoryStorage(),priorProject=project('JOB-STORAGE'),prior=[priorProject];store.writeAll(prior,storage);const priorBytes=storage.getItem(store.STORE_KEY);
  const changed=JSON.parse(JSON.stringify(priorProject));changed.projectData.acceptedChanges.push({changeId:'ACCEPTED-TEST',stage:2,status:'COMMITTED'});
  globalThis.__closedLoopStorageFault='after-final-write';let failed=false;try{store.writeAll([changed],storage);}catch{failed=true;}finally{delete globalThis.__closedLoopStorageFault;}
  assert(failed&&storage.getItem(store.STORE_KEY)===priorBytes,'Storage failure during accepted-state persistence did not roll back exact prior state.');
}


// Accepted-response refinement removes all current same-stage canonical authority.
{
  const p=acceptStage1Fixture(project('JOB-REFINEMENT-CANONICAL')),stage=2,source=record('sources',2,{TITLE:'Accepted source'},'SOURCE-REFINE');
  p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true,blocked:false,reasons:[]};
  source.sourceProposalId='PROPOSAL-REFINE';source.rawResponseId='RAW-REFINE';source.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.sources.push(source);
  p.projectData.acceptedChanges.push({changeId:'CHANGE-REFINE',stage,status:'COMMITTED',responseType:'DATA_PROPOSAL',proposalId:'PROPOSAL-REFINE',rawResponseId:'RAW-REFINE',promptId:'INSTRUCTION-REFINE',operation:'COMPLETE',scope:{},canonicalRecordIds:['SOURCE-REFINE']});
  p.projectData.responseProposals.push({proposalId:'PROPOSAL-REFINE',stage,status:'COMMITTED',rawResponseId:'RAW-REFINE',promptId:'INSTRUCTION-REFINE',scope:{},envelope:{operation:'COMPLETE',scope:{}}});
  p.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'SOURCES_IDENTIFIED'};p.stages[2].acceptedData={...p.stages[2].agentData};p.stages[2].acceptedDataChangeIds=['CHANGE-REFINE'];p.stages[2].acceptedResponseIds=['RAW-REFINE'];p.stages[2].currentPromptId='INSTRUCTION-REFINE';
  const reason='The accepted source analysis omitted an applicable authority and must be replaced completely.';engine.invalidateAcceptedResponse(p,{stage:2,rawResponseId:'RAW-REFINE',reason,operatorLabel:'VERIFY'});
  assert(engine.records(p,'sources',{stage:2}).length===0,'Invalidated accepted response left same-stage canonical source active.');assert(engine.acceptedChanges(p,2).length===0,'Invalidated accepted change retained current stage authority.');assert(Object.keys(p.stages[2].agentData||{}).length===0&&p.stages[2].acceptedDataChangeIds.length===0&&p.stages[2].acceptedResponseIds.length===0,'Invalidated stage retained accepted agent state.');const replacement=prompts.buildPromptRecord(2,p);assert(replacement.prompt.includes(reason),'Replacement prompt omitted accepted-result refinement reason.');assert(replacement.contextManifest.acceptedResultRefinements?.some(x=>x.reason===reason),'Replacement prompt identity did not bind the refinement reason.');
}

console.log(JSON.stringify({finalRequirementRegression:true,formalStates:true,noStage31:true,invalidRelationshipRejected:true,humanQuestionGate:true,stage8PrerequisiteGate:true,tenRunGate:true,verificationMatrixGate:true,convergenceStrict:true,unchangedConfirmationGate:true,downstreamInvalidation:true,preReleaseIdentityBlocked:true,identityMismatchBlocked:true,evidenceChainNoFabrication:true,acceptedStateStorageRollback:true},null,2));

// Refining one accepted run restores only that reservation and preserves unrelated accepted lanes.
{
 let p=project('JOB-SCOPED-ACCEPTED-REFINEMENT'),stage=11;const bytes=new TextEncoder().encode('refinement-candidate');engine.registerArtifactBytes(p,{stage:10,artifactId:'ARTIFACT-REFINE',filename:'refine.bin',mediaType:'application/octet-stream',byteSize:bytes.byteLength,sha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'});const frozen=engine.freezeCandidate(p,{stage:10,artifactIds:['ARTIFACT-REFINE'],operatorLabel:'VERIFY'}),iterationId=engine.recordId(frozen.iteration,'iterations'),candidateId=engine.recordId(frozen.candidate,'candidateFreezes');
 const slots=engine.reserveRunBatch(p,{stage,iterationId,count:10});for(const slot of slots){const run=engine.records(p,'runs').find(r=>engine.recordId(r,'runs')===slot.runId);assert(engine.recordValue(run,'CANDIDATE_ID')===candidateId,'Scoped refinement fixture did not reserve the canonical iteration candidate.');}
 const acceptLane=(slot,label)=>{p.stages[10].status='COMPLETE';p.stages[10].gate={complete:true,blocked:false,reasons:[]};const pr={...prompts.buildPromptRecord(stage,p,{scope:{runId:slot.runId,contextId:slot.contextId}}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);const fields={FRESH_CONTEXT_RECORD:slot.contextId,CONTAMINATION_CHECK:'NONE',TOOL_CONFIGURATION:'CONTROLLED',EXECUTION_STATUS:'COMPLETED',COMPLETE_OUTPUT:`output-${label}`};const e={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{runs:[{targetId:slot.runId,fields,relationships:{},evidenceRefs:['lane-evidence']}]},evidence:[{temporaryKey:'lane-evidence',kind:'WORKFLOW_EVIDENCE',description:'lane evidence',location:'fixture',content:`lane-${label}`}],unresolved:[],warnings:[],attachments:[]};const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});assert(prepared.validation.valid,`Scoped lane ${label} rejected: ${JSON.stringify(prepared.validation.issues)}`);const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'});p=committed.project;return committed.acceptedChange;};
 const changeA=acceptLane(slots[0],'A'),changeB=acceptLane(slots[1],'B');const runBBefore=engine.records(p,'runs',{active:true}).find(r=>engine.recordId(r,'runs')===slots[1].runId);assert(runBBefore?.status==='COMPLETED','Run B was not completed before refinement.');
 engine.invalidateAcceptedResponse(p,{stage,rawResponseId:changeA.rawResponseId,reason:'Run A needs a more complete answer.',operatorLabel:'VERIFY'});engine.recalculate(p);
 const runA=engine.records(p,'runs',{active:true}).find(r=>engine.recordId(r,'runs')===slots[0].runId),runB=engine.records(p,'runs',{active:true}).find(r=>engine.recordId(r,'runs')===slots[1].runId);assert(engine.recordValue(runA,'EXECUTION_STATUS')==='RESERVED'&&runA?.status!=='COMPLETED','Refined Run A reservation was not restored.');assert(runB?.status==='COMPLETED','Unrelated Run B was invalidated by Run A refinement.');assert(!changeB.invalidatedBy&&engine.acceptedChanges(p,stage).some(c=>c.changeId===changeB.changeId),'Unrelated accepted Run B change was invalidated.');assert(p.projectData.generatedPrompts.some(x=>x.scope?.runId===slots[1].runId&&!x.invalidatedBy),'Unrelated Run B prompt was invalidated.');
}
assert(fs.readFileSync('app-core.js','utf8').includes('No accepted response matches the selected operation/run scope.'),'Refinement UI does not target the selected operation/run scope.');

// Operator recovery: exact run-batch reservation is idempotent and partial batches fail closed.
{
 const p=project('JOB-RUN-BATCH-IDEMPOTENT');engine.registerArtifactBytes(p,{stage:10,artifactId:'ARTIFACT-IDEMPOTENT',filename:'candidate.bin',mediaType:'application/octet-stream',byteSize:1,sha256:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'});const frozen=engine.freezeCandidate(p,{stage:10,artifactIds:['ARTIFACT-IDEMPOTENT'],operatorLabel:'VERIFY'}),iterationId=engine.recordId(frozen.iteration,'iterations'),candidateId=engine.recordId(frozen.candidate,'candidateFreezes');
 const first=engine.reserveRunBatch(p,{stage:11,iterationId,candidateId,count:10}),events=p.projectData.history.filter(x=>x.type==='RUN_BATCH_RESERVED').length;
 const second=engine.reserveRunBatch(p,{stage:11,iterationId,candidateId,count:10});
 assert(first.length===10&&second.length===10&&engine.records(p,'runs',{stage:11}).length===10&&engine.records(p,'freshContexts',{stage:11}).length===10,'Repeated run-batch reservation allocated duplicate slots.');assert(p.projectData.history.filter(x=>x.type==='RUN_BATCH_RESERVED').length===events,'Idempotent reservation created another reservation event.');
 engine.records(p,'runs',{stage:11})[0].active=false;let threw=false;try{engine.reserveRunBatch(p,{stage:11,iterationId,candidateId,count:10});}catch{threw=true;}assert(threw,'Partial active batch was silently topped up.');
}

// Human-created blockers have an authority-matched inverse and cannot close application blockers.
{
 const p=project('JOB-HUMAN-BLOCKER-RESOLUTION'),human=engine.createHumanBlocker(p,{stage:1,reason:'Missing human prerequisite.',operatorLabel:'VERIFY'});assert(engine.openBlockers(p).some(x=>engine.recordId(x,'blockers')===human.id),'Human blocker did not open.');const resolved=engine.resolveHumanBlocker(p,{blockerId:human.id,resolutionEvidence:'Prerequisite supplied and reviewed.',operatorLabel:'VERIFY'});assert(engine.recordValue(resolved,'STATUS')==='RESOLVED'&&!engine.openBlockers(p).some(x=>engine.recordId(x,'blockers')===human.id),'Human blocker did not resolve.');
 const agent=record('blockers',1,{STATUS:'OPEN',CLOSURE:'OPEN'},'BLOCKER-AGENT');agent.source='APPLICATION_DISPOSITION';p.projectData.blockers.push(agent);let rejected=false;try{engine.resolveHumanBlocker(p,{blockerId:'BLOCKER-AGENT',resolutionEvidence:'not authorized',operatorLabel:'VERIFY'});}catch{rejected=true;}assert(rejected,'Human control resolved a non-human blocker.');
}

console.log(JSON.stringify({scopedAcceptedResultRefinement:true},null,2));


// Exact unchanged-confirmed candidate artifact identity controls Stage 20 baseline bytes.
{
  const p=project('JOB-BASELINE-EXACT-CANDIDATE');
  const shaA='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',shaB='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const a=record('artifacts',17,{FILENAME:'confirmed.bin',TYPE:'application/octet-stream',BYTE_SIZE:10,SHA256:shaA,STORAGE_REFERENCE:'indexeddb:ARTIFACT-CONFIRMED',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'ARTIFACT-CONFIRMED');
  const b=record('artifacts',20,{FILENAME:'different.bin',TYPE:'application/octet-stream',BYTE_SIZE:10,SHA256:shaB,STORAGE_REFERENCE:'indexeddb:ARTIFACT-DIFFERENT',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'ARTIFACT-DIFFERENT');
  p.projectData.artifacts.push(a,b);
  const candidate=record('candidateFreezes',17,{ITERATION_ID:'ITERATION-CORRECTED',COMPONENT_MANIFEST:[{artifactId:'ARTIFACT-CONFIRMED',filename:'confirmed.bin',byteSize:10,sha256:shaA,storageReference:'indexeddb:ARTIFACT-CONFIRMED'}],COMPONENT_HASHES:{'ARTIFACT-CONFIRMED':shaA},STATUS:'FROZEN'},'CANDIDATE-CONFIRMED');
  p.projectData.candidateFreezes.push(candidate);
  const iteration=record('iterations',19,{CANDIDATE_ID:'CANDIDATE-CONFIRMED',PURPOSE:'UNCHANGED_CONFIRMATION',STATUS:'FROZEN'},'ITERATION-CONFIRM');
  p.projectData.iterations.push(iteration);p.job.CURRENT_ITERATION='ITERATION-CONFIRM';
  const scope={...engine.currentScope(p),iterationId:'ITERATION-CONFIRM',candidateId:'CANDIDATE-CONFIRMED'};candidate.scope={...scope,iterationId:'ITERATION-CORRECTED'};iteration.scope=scope;a.scope=scope;b.scope=scope;
  const confirmation=record('confirmationRecords',19,{ITERATION_ID:'ITERATION-CONFIRM',CANDIDATE_ID:'CANDIDATE-CONFIRMED',DETERMINATION:'SATISFIED'},'CONFIRM-EXACT-CANDIDATE');confirmation.scope=scope;p.projectData.confirmationRecords.push(confirmation);
  let rejected=false;try{engine.freezeBaseline(p,{artifactIds:['ARTIFACT-DIFFERENT'],operatorLabel:'VERIFY'});}catch(error){rejected=/exact artifact set/i.test(String(error.message));}
  assert(rejected,'Stage 20 accepted a baseline artifact set different from the unchanged-confirmed candidate.');
  const baseline=engine.freezeBaseline(p,{operatorLabel:'VERIFY'});assert(JSON.stringify(engine.recordValue(baseline,'IMMUTABLE_ARTIFACT_RECORDS'))===JSON.stringify(['ARTIFACT-CONFIRMED']),'Stage 20 did not derive baseline artifacts from the unchanged-confirmed candidate manifest.');assert(engine.recordValue(baseline,'APPROVED_VERSIONS').candidateId==='CANDIDATE-CONFIRMED'&&engine.recordValue(baseline,'APPROVED_VERSIONS').iterationId==='ITERATION-CONFIRM','Stage 20 baseline lost the exact unchanged-confirmation candidate/iteration identity.');
}


// Current-boundary regressions.
{
 const p=project('JOB-STAGE5-VERSION');p.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v001';p.projectData.requirementResolutions.push(record('requirementResolutions',5,{DEFECT_TYPE:'NONE',GOVERNING_EVIDENCE:'review',RESOLUTION:'No requirement change required.',CHANGED_REQUIREMENT_REFS:[],AFFECTED_DOWNSTREAM_WORK:'NONE',STATUS:'RESOLVED'},'RESOLUTION-STAGE5'));const result=engine.registerStageVersion(p,5,'CHANGE-STAGE5');assert(result===null&&p.job.CURRENT_REQUIREMENTS_VERSION==='REQUIREMENTS-v001','Stage 05 created a requirements version without a replacement requirement set.');
}
{
 const p=project('JOB-ITERATION-OP-SCOPE'),ops=['FREEZE','EXECUTE_RUN','VERIFY','COMPARE','ROOT_CAUSE','REGRESSION','CORRECT'];p.projectData.iterations.push(record('iterations',17,{CANDIDATE_ID:'CANDIDATE-OLD',STATUS:'FROZEN'},'ITERATION-OLD'));for(const op of ops)p.projectData.acceptedChanges.push({changeId:`CHANGE-OLD-${op}`,stage:17,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:op,scope:{iterationId:'ITERATION-OLD',candidateId:'CANDIDATE-OLD'}});const current=record('iterations',17,{CANDIDATE_ID:'CANDIDATE-NEW',STATUS:'FROZEN'},'ITERATION-NEW');current.scope={iterationId:'ITERATION-NEW',candidateId:'CANDIDATE-NEW'};p.projectData.iterations.push(current);const ev=engine.evaluateIteration(p,'ITERATION-NEW','CORRECTED');assert(ev.reasons.some(r=>/Required stage operations are missing/.test(r)),'A new Stage 17 iteration borrowed accepted operations from an older iteration.');
}
{
 const p=project('JOB-REGRESSION-SCOPE');p.job.CURRENT_ITERATION='ITERATION-NEW';const iteration=record('iterations',17,{CANDIDATE_ID:'CANDIDATE-NEW',STATUS:'FROZEN'},'ITERATION-NEW');iteration.scope={iterationId:'ITERATION-NEW',candidateId:'CANDIDATE-NEW'};p.projectData.iterations.push(iteration);const defect=record('defects',14,{SEVERITY:'CRITICAL',STATUS:'CONFIRMED'},'DEFECT-SCOPE');p.projectData.defects.push(defect);const reg=record('regressions',15,{DEFECT_ID:'DEFECT-SCOPE',ACTIVE_RETIRED_STATE:'ACTIVE'},'REG-SCOPE');p.projectData.regressions.push(reg);const old=record('regressionExecutions',17,{REG_ID:'REG-SCOPE',ITERATION_ID:'ITERATION-OLD',PHASE:'POST_CORRECTION',RESULT:'PASSED'},'REG-EXEC-OLD');old.scope={iterationId:'ITERATION-OLD',candidateId:'CANDIDATE-OLD'};p.projectData.regressionExecutions.push(old);assert(engine.unresolvedMaterialDefects(p).some(x=>engine.recordId(x,'defects')==='DEFECT-SCOPE'),'A stale regression success resolved a current material defect.');
}
{
 const p=project('JOB-IDENTITY-RECOVERY');p.projectData.releaseRecords.push(record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-IDENTITY-RECOVERY'));const audited=[{artifactId:'A',name:'a.bin',size:3,sha256:'aaa'}],bad=[{artifactId:'A',name:'a.bin',size:4,sha256:'bbb'}],good=[{artifactId:'A',name:'a.bin',size:3,sha256:'aaa'}];engine.verifyArtifactIdentity(p,audited,bad);const corrected=engine.verifyArtifactIdentity(p,audited,good);assert(engine.records(p,'artifactIdentities').length===1&&corrected.length===1&&p.release.authorization==='AUTHORIZED','A corrected Stage 28 comparison remained blocked by an older active mismatch.');const count=p.projectData.artifactIdentities.length,again=engine.verifyArtifactIdentity(p,audited,good);assert(p.projectData.artifactIdentities.length===count&&again[0].id===corrected[0].id,'Identical Stage 28 evidence created a duplicate comparison batch.');
}
console.log(JSON.stringify({stage5RequirementVersionIsolation:true,iterationOperationIsolation:true,currentRegressionClosure:true,stage28CurrentBatch:true},null,2));


// reliability-v2: derived execution routing, independence, evidence, contradictions, and stability.
{
 const p=project('JOB-RELIABILITY-V2');p.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v001';p.job.CURRENT_TEST_SUITE_VERSION='TEST-SUITE-v001';p.job.AVAILABLE_TOOLS='CAP-EXTERNAL_AGENT_TOOL; CAP-EXTERNAL_SYSTEM';const scope=engine.currentScope(p);for(const capability of ['CAP-EXTERNAL_AGENT_TOOL','CAP-EXTERNAL_SYSTEM']){const c=record('externalCapabilities',0,{CAPABILITY_ID:capability,CAPABILITY_CLAIM:capability,FRESHNESS_STATUS:'CURRENT',STATUS:'CURRENT',AUTHORIZED:true,PERMISSIONS_READY:true,INPUTS_TRANSFERABLE:true,ROUTE_USABLE:true,EVIDENCE_OBTAINABLE:true},capability);c.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.externalCapabilities.push(c);}
 const req=record('requirements',4,{MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'},'REQ-V2');req.scope={...scope};p.projectData.requirements.push(req);
 const modes=[['EXTERNAL_AGENT_TOOL','SEND_TO_TOOL_AGENT'],['INDEPENDENT_AGENT_REVIEW','SEND_TO_INDEPENDENT_REVIEWER'],['HUMAN_INSPECTION','HUMAN_INSPECTION'],['EXTERNAL_SYSTEM','USE_EXTERNAL_SYSTEM'],['UNAVAILABLE','BLOCKED']];for(const [mode,action] of modes){const t=record('tests',6,{REQ_ID:'REQ-V2',TEST_TYPE:'MEANING',EXECUTION_MODE:mode,REQUIRED_CAPABILITY:'CAP-'+mode,ARTIFACT_REQUIREMENTS:'NONE',EVIDENCE_TO_PRESERVE:'objective evidence',STATUS:'READY'},'TEST-'+mode);t.scope={...scope};p.projectData.tests.push(t);}
 const plan=engine.testExecutionPlan(p);for(const [mode,action] of modes){const item=plan.items.find(x=>x.executionMode===mode);assert(item.operatorAction===action||mode==='UNAVAILABLE'&&item.operatorAction==='BLOCKED','Execution routing failed for '+mode);assert(Boolean(item.executorClass),'Executor class missing for '+mode);}
 const unavailable=plan.items.find(x=>x.executionMode==='UNAVAILABLE');assert(!unavailable.executableNow&&unavailable.blockingReason,'UNAVAILABLE test did not fail closed.');const missing=record('tests',6,{REQ_ID:'REQ-V2',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITY:'CAP-NOT-PRESENT',ARTIFACT_REQUIREMENTS:'NONE',EVIDENCE_TO_PRESERVE:'objective evidence',STATUS:'READY'},'TEST-MISSING-CAPABILITY');missing.scope={...scope};p.projectData.tests.push(missing);const missingPlan=engine.testExecutionPlan(p).items.find(x=>x.testId==='TEST-MISSING-CAPABILITY');assert(!missingPlan.executableNow&&missingPlan.operatorAction==='BLOCKED'&&/not affirmatively available/i.test(missingPlan.blockingReason),'Unproven external capability did not fail closed.');
}
{
 const p=project('JOB-INDEPENDENCE-V2');const art=record('artifacts',10,{FILENAME:'candidate.bin',TYPE:'application/octet-stream',BYTE_SIZE:1,SHA256:'a'.repeat(64),STORAGE_REFERENCE:'indexeddb:ART-V2',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'ART-V2');p.projectData.artifacts.push(art);const frozen=engine.freezeCandidate(p,{stage:10,artifactIds:['ART-V2'],operatorLabel:'VERIFY'}),iid=engine.recordId(frozen.iteration,'iterations'),cid=engine.recordId(frozen.candidate,'candidateFreezes'),slots=engine.reserveRunBatch(p,{stage:11,iterationId:iid,candidateId:cid,count:10});for(let i=0;i<slots.length;i++){const ctx=engine.records(p,'freshContexts').find(x=>engine.recordId(x,'freshContexts')===slots[i].contextId);ctx.fields.EXTERNAL_CONTEXT_IDENTIFIER='external-'+i;ctx.EXTERNAL_CONTEXT_IDENTIFIER='external-'+i;ctx.fields.CONTAMINATION_STATUS='NONE';ctx.CONTAMINATION_STATUS='NONE';ctx.fields.AUTHORIZED_PROJECT_INPUTS=[];ctx.AUTHORIZED_PROJECT_INPUTS=[];const run=engine.records(p,'runs').find(x=>engine.recordId(x,'runs')===slots[i].runId);run.fields.CONTAMINATION_CHECK='NONE';run.CONTAMINATION_CHECK='NONE';}
 let ev=engine.evaluateContextIndependence(p,{role:'RUN_BATCH',iterationId:iid});assert(ev.determination==='APPLICATION_ESTABLISHED','Ten distinct contexts were not application-established.');const ctx2=engine.records(p,'freshContexts')[1];ctx2.fields.EXTERNAL_CONTEXT_IDENTIFIER='external-0';ctx2.EXTERNAL_CONTEXT_IDENTIFIER='external-0';ev=engine.evaluateContextIndependence(p,{role:'RUN_BATCH',iterationId:iid});assert(ev.determination==='VIOLATED','Duplicate external context was not detected.');
}
{
 const p=project('JOB-EVIDENCE-V2'),t=record('tests',6,{REQ_ID:'REQ-E',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITY:'sha256',ARTIFACT_REQUIREMENTS:'exact bytes',EVIDENCE_TO_PRESERVE:'byte hash',STATUS:'READY'},'TEST-E'),r=record('deterministicResults',22,{TEST_ID:'TEST-E',ACTUAL_RESULT:'same',DETERMINATION:'SATISFIED',EVIDENCE:'agent says same'},'RESULT-E');assert(!engine.evaluateEvidenceSufficiency(p,{test:t,result:r}).sufficient,'Prose satisfied a byte test.');const a=record('artifacts',22,{FILENAME:'x.bin',TYPE:'application/octet-stream',BYTE_SIZE:1,SHA256:'b'.repeat(64),AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'ART-E'),e=record('evidenceRecords',22,{KIND:'TOOL_OUTPUT',DESCRIPTION:'hash',LOCATION:'tool',CONTENT:'sha256 output',ATTACHMENT_ID:'ART-E',STATUS:'PRESERVED'},'EVIDENCE-E');p.projectData.artifacts.push(a);p.projectData.evidenceRecords.push(e);r.evidenceRefs=['EVIDENCE-E'];assert(engine.evaluateEvidenceSufficiency(p,{test:t,result:r}).sufficient,'Verified byte-backed evidence was not sufficient.');
}
{
 const p=project('JOB-CONTRADICTION-V2');p.job.CURRENT_REQUIREMENTS_VERSION='R1';p.job.CURRENT_TEST_SUITE_VERSION='T1';const scope=engine.currentScope(p);const t=record('tests',6,{REQ_ID:'REQ-C',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITY:'TEST_TOOL',ARTIFACT_REQUIREMENTS:'NONE',STATUS:'READY'},'TEST-C');t.scope={...scope};p.projectData.tests.push(t);const d=record('deterministicResults',22,{REQ_ID:'REQ-C',TEST_ID:'TEST-C',DETERMINATION:'SATISFIED'},'DET-C'),m=record('meaningResults',23,{REQ_ID:'REQ-C',TEST_ID:'TEST-C',DETERMINATION:'VIOLATED'},'MEAN-C');d.scope={...scope};m.scope={...scope};p.projectData.deterministicResults.push(d);p.projectData.meaningResults.push(m);assert(engine.detectCurrentContradictions(p).some(x=>x.type==='DETERMINISTIC_MEANING_CONFLICT'),'Cross-method contradiction was not detected.');
}
console.log(JSON.stringify({reliabilityV2Execution:true,reliabilityV2Independence:true,reliabilityV2Evidence:true,reliabilityV2Contradictions:true},null,2));


// reliability-v2-final: result-consuming gates reject epistemically insufficient evidence at the earliest responsible stage.
{
 const source=fs.readFileSync('workflow-engine.js','utf8');for(const token of ['Meaning review \'','Adversarial result \'','Representation inspection \'','Stage 26 audit \'','Current process/product evidence contains unresolved contradictions'])assert(source.includes(token),'Missing local evidence/contradiction gate: '+token);
}


// reliability-hardening-final: Stage 22 exact product handoff, epistemic evidence, and release contradictions.
{
 const p=project('JOB-STAGE22-PRODUCT-HANDOFF');p.job.CURRENT_PRODUCT_ID='PRODUCT-HANDOFF';const scope={...engine.currentScope(p),productId:'PRODUCT-HANDOFF'};
 const productRecord=record('products',21,{PRODUCT_ID:'PRODUCT-HANDOFF',PRODUCT_VERSION:'PRODUCT-v001',BASELINE_ID:'BASELINE-HANDOFF',EXECUTION_ID:'EXEC-HANDOFF',PRODUCTION_CONTEXT_ID:'CTX-HANDOFF',INSTRUCTION_VERSION:'INSTRUCTION-v001',GENERATED_ARTIFACT_INVENTORY:['ARTIFACT-HANDOFF'],STATUS:'COMPLETED'},'PRODUCT-HANDOFF');productRecord.scope=scope;p.projectData.products.push(productRecord);
 const artifactRecord=record('artifacts',21,{FILENAME:'finished-product.bin',TYPE:'application/octet-stream',VERSION:'v1',BYTE_SIZE:4,SHA256:'a'.repeat(64),ROLE:'FINISHED_PRODUCT',STORAGE_REFERENCE:'indexeddb:ARTIFACT-HANDOFF',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'ARTIFACT-HANDOFF');artifactRecord.scope=scope;p.projectData.artifacts.push(artifactRecord);
 const handoff=engine.executionHandoff(p,{stage:22,operation:'COMPLETE'});assert(handoff.send.some(x=>x.artifactId==='ARTIFACT-HANDOFF'&&x.filename==='finished-product.bin'),'Stage 22 handoff omitted exact current finished-product bytes.');
}
{
 const p=project('JOB-EPISTEMIC-EFFECTIVE'),scope=engine.currentScope(p),req=record('requirements',4,{OBLIGATION:'Meaning must be established.',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'},'REQ-EPISTEMIC'),test=record('tests',6,{REQ_ID:'REQ-EPISTEMIC',TEST_TYPE:'MEANING',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'semantic review',ARTIFACT_REQUIREMENTS:'NONE',INPUTS:'product',TOOLS:'independent reviewer',PROCEDURE:'compare meaning',EXPECTED_RESULT:'SATISFIED',FAILURE_CONDITION:'meaning differs',EVIDENCE_TO_PRESERVE:'meaning comparison',STATUS:'READY'},'TEST-EPISTEMIC'),evidence=record('evidenceRecords',23,{KIND:'REVIEW_NOTE',DESCRIPTION:'generic note',AUTHORITY_TYPE:'INDEPENDENT_REVIEWER',LOCATION:'review',CONTENT:'review performed',STATUS:'PRESERVED'},'EVIDENCE-EPISTEMIC'),result=record('meaningResults',23,{REQ_ID:'REQ-EPISTEMIC',TEST_ID:'TEST-EPISTEMIC',PRODUCT_LOCATION:'',EXTERNAL_SOURCE_EVIDENCE:'',REQUIRED_MEANING:'required meaning',OBSERVED_MEANING:'required meaning',EVIDENCE_BASED_COMPARISON:'SATISFIED',DETERMINATION:'SATISFIED'},'MEAN-EPISTEMIC');req.scope=scope;test.scope=scope;evidence.scope=scope;result.scope=scope;result.evidenceRefs=['EVIDENCE-EPISTEMIC'];p.projectData.requirements.push(req);p.projectData.tests.push(test);p.projectData.evidenceRecords.push(evidence);p.projectData.meaningResults.push(result);const effective=engine.evaluateResultConsistency('meaningResults',result,test,p);assert(effective.determination==='UNDETERMINED'&&effective.reasons.some(x=>x.includes('PRODUCT_LOCATION')),'A structurally present but epistemically insufficient meaning result remained effectively satisfied.');
}
{
 const p=project('JOB-RELEASE-CONTRADICTIONS'),scope=engine.currentScope(p),release=record('releaseRecords',27,{DETERMINATION:'ACCEPTED'},'RELEASE-CONFLICT');release.scope=scope;p.projectData.releaseRecords.push(release);const blocker=record('blockers',27,{MISSING_ITEM_TYPE:'EVIDENCE',MISSING_FACT_INPUT_AUTHORITY_EVIDENCE_CAPABILITY_DECISION_RULE:'missing proof',WHY_WORK_CANNOT_CONTINUE:'release proof missing',ATTEMPTED_RESOLUTIONS:'none',DOWNSTREAM_WORK_STOPPED:'STAGE 27',STATUS:'OPEN'},'BLOCKER-CONFLICT');blocker.scope=scope;p.projectData.blockers.push(blocker);assert(engine.detectCurrentContradictions(p).some(x=>x.type==='ACCEPTED_RELEASE_WITH_BLOCKER'),'Accepted release plus current blocker was not surfaced as a contradiction.');p.projectData.blockers.length=0;p.release.authorization='AUTHORIZED';p.release.authorizedArtifactIds=['ARTIFACT-STALE'];assert(engine.detectCurrentContradictions(p).some(x=>x.type==='STALE_DELIVERY_AUTHORIZATION'),'Stale delivery authorization was not surfaced as a contradiction.');
}

// Generic subject-neutral Test IR is a real registered application-native route, not a prose-only capability claim.
assert(schema.TEST_IR.version==='closed-loop-test-spec/1','Test IR version changed.');
assert(schema.TEST_IR.capability==='CLOSED_LOOP_TEST_IR','Test IR capability changed.');
assert(schema.TEST_IR.operations.includes('PARSE_JSON')&&schema.TEST_IR.operations.includes('BYTE_COMPARE'),'Required generic Test IR operations are missing.');
assert(!schema.TEST_IR.operations.some(op=>/JAVASCRIPT|PYTHON|SHELL/i.test(op)),'Unsafe arbitrary-code Test IR operation registered.');
assert(JSON.stringify(schema.STAGE_OPERATIONS[19])===JSON.stringify(['CONFIRM_FREEZE','EXECUTE_RUN','VERIFY','COMPARE','REGRESSION_VERIFY','CONFIRM']),'Stage 19 operation contract is incomplete.');
{
  const p=project('JOB-NATIVE-STAGE22-NO-AGENT');
  Object.assign(p.job,{CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_PRODUCT_ID:'PRODUCT-NATIVE',CURRENT_PRODUCT_VERSION:'PRODUCT-v001'});
  const scope=engine.currentScope(p),req=record('requirements',4,{OBLIGATION:'Native deterministic proposition',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'},'REQ-NATIVE-22');
  const native=record('tests',6,{REQ_ID:'REQ-NATIVE-22',TEST_TYPE:'DETERMINISTIC',VERIFICATION_PHASE:'FINAL_PRODUCT_DETERMINISTIC',EARLIEST_EXECUTABLE_STAGE:22,REQUIRED_BY_STAGE:22,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:true,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{product:true},EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',ARTIFACT_REQUIREMENTS:'NONE',EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_INPUT_BINDINGS:{PRODUCT:'ARTIFACT-NATIVE-22'},EXECUTABLE_SPEC:{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'HASH_SHA256'},{op:'ASSERT_EQ',value:'0'.repeat(64)}]},INPUTS:'current product',TOOLS:'Closed Loop Test IR',PROCEDURE:'hash exact bytes',EXPECTED_RESULT:'expected hash',FAILURE_CONDITION:'hash differs',EVIDENCE_TO_PRESERVE:'application-native execution evidence',STATUS:'READY'},'TEST-NATIVE-22');
  req.scope=scope;native.scope=scope;p.projectData.requirements.push(req);p.projectData.tests.push(native);
  const nativeGate=engine.gate(22,p);
  assert(!nativeGate.reasons.some(x=>/No validated agent response has been accepted/.test(x)),'Native-only Stage 22 still requires an external accepted response.');
  native.fields.EXECUTION_MODE='EXTERNAL_AGENT_TOOL';native.fields.REQUIRED_CAPABILITY='external deterministic tool';
  const externalGate=engine.gate(22,p);
  assert(externalGate.reasons.some(x=>/No validated agent response has been accepted/.test(x)),'Stage 22 stopped requiring an accepted response when an external deterministic executor is required.');
}
{
  const native={fields:{EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_INPUT_BINDINGS:{PRODUCT:'ARTIFACT-TEST'},EXECUTABLE_SPEC:{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'HASH_SHA256'},{op:'ASSERT_EQ',value:'0'.repeat(64)}]}}};
  assert(schema.validateTestIRTest(native).valid===true,'Valid native Test IR test was rejected.');
  assert(engine.applicationTestCapabilities().includes('CLOSED_LOOP_TEST_IR'),'Closed Loop Test IR is not registered as an application-native capability.');
}
console.log(JSON.stringify({stage22ProductHandoff:true,epistemicEffectiveEvidence:true,releaseContradictions:true},null,2));


// stage04-captured-input-regression-v3
{
  const p=project('JOB-STAGE04-CAPTURED-INPUT');
  p.job.SUPPLIED_MATERIALS_INVENTORY=JSON.stringify([{type:'FILE',exactNameOrReference:'design-input.pdf'}]);
  p.job.EXACT_USER_OBJECTIVE_VERBATIM='CAPTURED-HUMAN-INTENT-SENTINEL';
  p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'CAPTURED-STAGE01-DELIVERABLE-SENTINEL',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:'design-input.pdf accounted for during intake'};
  const handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});
  assert(handoff.send.length===0&&handoff.expectBack.length===0,'Stage 04 filename metadata incorrectly became a file-transfer contract.');
  assert(!Object.prototype.hasOwnProperty.call(handoff,'conversationMaterials'),'Stage 04 still exposes the obsolete filename-derived conversation-material handoff.');
  const next=engine.operationalNextAction(p,4);
  assert(!/design-input\.pdf|attach|provide the original|send the stage 04 instruction with/i.test(next),'Stage 04 next action still re-requests previously supplied material.');
  const appSource=fs.readFileSync('app-core.js','utf8');
  assert(!appSource.includes('Send the Stage 04 instruction with the required material.'),'Stage 04 UI still contains the repeated attachment instruction.');
}
console.log(JSON.stringify({stage04CapturedInputReuse:true}));
{
  const p=project('JOB-EXECUTION-ROUTING-HARDENING');
  Object.assign(p.job,{CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_PRODUCT_ID:'PRODUCT-ROUTE'});
  const req=record('requirements',4,{OBLIGATION:'Native deterministic route',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:'User input',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'true',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC',EXPECTED_EVIDENCE:'native',FAILURE_CONDITION:'false',SEVERITY:'MAJOR',STATUS:'ACTIVE'},'REQ-ROUTE');req.scope=engine.currentScope(p);p.projectData.requirements.push(req);
  const artifact=record('artifacts',22,{FILENAME:'product.json',TYPE:'application/json',VERSION:'1',BYTE_SIZE:2,SHA256:'0'.repeat(64),ROLE:'PRODUCT',STORAGE_REFERENCE:'idb',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED',NOTES:''},'ARTIFACT-ROUTE');artifact.scope={...engine.currentScope(p),productId:'PRODUCT-ROUTE'};p.projectData.artifacts.push(artifact);
  const test=record('tests',6,{REQ_ID:'REQ-ROUTE',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',ARTIFACT_REQUIREMENTS:'NONE',EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_INPUT_BINDINGS:{PRODUCT:{source:'CURRENT_PRODUCT',filename:'product.json'}},EXECUTABLE_SPEC:{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'ASSERT_EQ',value:2}]},INPUTS:'product',TOOLS:'runtime',PROCEDURE:'read bytes',EXPECTED_RESULT:'2',FAILURE_CONDITION:'not 2',EVIDENCE_TO_PRESERVE:'application evidence',STATUS:'READY'},'TEST-ROUTE');test.scope=engine.currentScope(p);p.projectData.tests.push(test);
  p.activeStage=22;const item=engine.testExecutionPlan(p).items.find(x=>x.testId==='TEST-ROUTE');assert(item&&item.executableNow&&item.userAction==='RUN_IN_APP','Native Test IR route was not executable in-app.');assert(item.returnRequirements.structuredResponse===false&&item.handoff.expectBack.length===0&&item.handoff.send.length===0,'Native Test IR incorrectly requires external response/file handoff.');
  artifact.AVAILABILITY=artifact.fields.AVAILABILITY='METADATA_ONLY';const blocked=engine.testExecutionPlan(p).items.find(x=>x.testId==='TEST-ROUTE');assert(blocked&&!blocked.executableNow&&blocked.operatorAction==='BLOCKED','Native Test IR did not fail closed after verified bytes became unavailable.');
}
{
  const p=project('JOB-CAPABILITY-NEGATION');p.job.AVAILABLE_TOOLS='SolidWorks import capability is UNAVAILABLE';Object.assign(p.job,{CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001'});const req=record('requirements',4,{OBLIGATION:'External import',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:'User input',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'imports',INTENDED_VERIFICATION_METHOD:'EXTERNAL',EXPECTED_EVIDENCE:'report',FAILURE_CONDITION:'fails',SEVERITY:'MAJOR',STATUS:'ACTIVE'},'REQ-CAP');req.scope=engine.currentScope(p);p.projectData.requirements.push(req);const test=record('tests',6,{REQ_ID:'REQ-CAP',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITY:'SOLIDWORKS',ARTIFACT_REQUIREMENTS:'NONE',INPUTS:'file',TOOLS:'SolidWorks',PROCEDURE:'import',EXPECTED_RESULT:'no errors',FAILURE_CONDITION:'error',EVIDENCE_TO_PRESERVE:'report',STATUS:'READY'},'TEST-CAP');test.scope=engine.currentScope(p);p.projectData.tests.push(test);const item=engine.testExecutionPlan(p).items[0];assert(item&&!item.executableNow&&item.blockingReason.includes('not affirmatively available'),'Negated capability text was incorrectly treated as available.');
}
{
  const p=project('JOB-STAGE7-FAIL-CLOSED');const req=record('requirements',4,{OBLIGATION:'Reject invalid input',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:'User input',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'reject',INTENDED_VERIFICATION_METHOD:'MUTATION',EXPECTED_EVIDENCE:'execution',FAILURE_CONDITION:'accept',SEVERITY:'MAJOR',STATUS:'ACTIVE'},'REQ-MUT');p.projectData.requirements.push(req);const mutation=record('failureTests',7,{REQ_ID:'REQ-MUT',VIOLATION_MODE:'INVALID',FIXTURE:'fixture',EXPECTED_REJECTION:'REJECT',ACTUAL_RESULT:'ACCEPTED',EVIDENCE:'validator accepted invalid fixture',VALIDATOR_DEFECT_ID:'DEFECT-VAL'},'MUTATION-1');p.projectData.failureTests.push(mutation);p.projectData.acceptedChanges.push({changeId:'CHANGE-7',stage:7});p.stages[6].status='COMPLETE';const g=engine.gate(7,p);assert(!g.complete&&g.reasons.some(x=>/remains blocked until the validator is corrected/i.test(x)),'Stage 07 completed while a known-invalid fixture was still accepted.');
}
console.log(JSON.stringify({nativeHandoffNoExternalReturn:true,capabilityNegation:true,stage7AcceptedInvalidBlocks:true},null,2));

// Stage 23/24 reviewer independence is application-established from canonical context identity when observable.
{
  const p=project('JOB-REVIEWER-INDEPENDENCE');
  const production=record('freshContexts',21,{EXTERNAL_CONTEXT_IDENTIFIER:'production-session',ROLE:'PRODUCTION',AUTHORIZED_PROJECT_INPUTS:['baseline'],TOOL_AVAILABILITY:'available',CONTAMINATION_STATUS:'NONE',EVIDENCE:'registered',USABILITY_DETERMINATION:'USABLE'},'CONTEXT-PRODUCTION');
  const reviewer=record('freshContexts',23,{EXTERNAL_CONTEXT_IDENTIFIER:'production-session',ROLE:'MEANING_REVIEWER',AUTHORIZED_PROJECT_INPUTS:['product','requirement'],TOOL_AVAILABILITY:'available',CONTAMINATION_STATUS:'NONE',EVIDENCE:'registered',USABILITY_DETERMINATION:'USABLE'},'CONTEXT-REVIEWER');
  p.projectData.freshContexts.push(production,reviewer);
  let result=engine.evaluateContextIndependence(p,{role:'MEANING_REVIEW',reviewerContextId:'CONTEXT-REVIEWER',productionContextId:'CONTEXT-PRODUCTION'});
  assert(result.determination==='VIOLATED','Reviewer reused the production external context but independence was not violated.');
  reviewer.fields.EXTERNAL_CONTEXT_IDENTIFIER=reviewer.EXTERNAL_CONTEXT_IDENTIFIER='meaning-review-session';
  result=engine.evaluateContextIndependence(p,{role:'MEANING_REVIEW',reviewerContextId:'CONTEXT-REVIEWER',productionContextId:'CONTEXT-PRODUCTION'});
  assert(result.determination==='APPLICATION_ESTABLISHED','Distinct canonical production/reviewer contexts were not application-established.');
  reviewer.fields.AUTHORIZED_PROJECT_INPUTS=reviewer.AUTHORIZED_PROJECT_INPUTS=['product','prior reviewer conclusion'];
  result=engine.evaluateContextIndependence(p,{role:'MEANING_REVIEW',reviewerContextId:'CONTEXT-REVIEWER',productionContextId:'CONTEXT-PRODUCTION'});
  assert(result.determination==='VIOLATED','Prohibited prior-review material did not invalidate reviewer independence.');
}

// Reliability measurement counts completed application-established independent operations, never reserved runs.
{
  const p=project('JOB-OPERATIONAL-METRICS');
  p.job.CURRENT_ITERATION='ITERATION-METRICS';
  p.job.CURRENT_CANDIDATE_ID='CANDIDATE-METRICS';
  const scope={...engine.currentScope(p),iterationId:'ITERATION-METRICS',candidateId:'CANDIDATE-METRICS'};
  for(let i=0;i<10;i++){
    const runId=`RUN-METRICS-${i+1}`,contextId=`CONTEXT-METRICS-${i+1}`;
    const run=record('runs',11,{ITERATION_ID:'ITERATION-METRICS',CANDIDATE_ID:'CANDIDATE-METRICS',CONTEXT_ID:contextId,FRESH_CONTEXT_RECORD:'reserved',CONTAMINATION_CHECK:'NONE',TOOL_CONFIGURATION:'same',EXECUTION_STATUS:'RESERVED',COMPLETE_OUTPUT:''},runId);run.scope=scope;
    const context=record('freshContexts',11,{ITERATION_ID:'ITERATION-METRICS',RUN_ID:runId,EXTERNAL_CONTEXT_IDENTIFIER:`external-metrics-${i+1}`,ROLE:'PRODUCTION_RUN',AUTHORIZED_PROJECT_INPUTS:['candidate'],TOOL_AVAILABILITY:'available',CONTAMINATION_STATUS:'NONE',EVIDENCE:'registered',USABILITY_DETERMINATION:'USABLE'},contextId);context.scope=scope;
    p.projectData.runs.push(run);p.projectData.freshContexts.push(context);
  }
  let metrics=engine.operationalMetrics(p);assert(metrics.materiallyIndependentAcceptedOperations===0,'Reserved runs were falsely counted as materially independent accepted operations.');
  for(const run of p.projectData.runs){run.fields.EXECUTION_STATUS=run.EXECUTION_STATUS='COMPLETED';run.fields.COMPLETE_OUTPUT=run.COMPLETE_OUTPUT='controlled output';}
  metrics=engine.operationalMetrics(p);assert(metrics.materiallyIndependentAcceptedOperations===10,'Ten completed application-established run contexts did not count as ten independent accepted operations.');
}
console.log(JSON.stringify({reviewerIndependenceAuthority:true,truthfulOperationalMetrics:true},null,2));

await import('./verify-spec-residual-closure.mjs');

await import('./verify-operation-scope-classification.mjs');


// Conditional applicability is fail-closed until a current activation proof obligation is satisfied.
{
  const p=project('JOB-ACTIVATION-PROOF'),scope=engine.currentScope(p);
  const req=record('requirements',4,{OBLIGATION:'Apply only when activation is proven.',MANDATORY_OPTIONAL_STATUS:'CONDITIONAL',STATUS:'ACTIVE'},'REQ-ACTIVATION');
  const proposition=record('propositions',4,{REQUIREMENT_ID:'REQ-ACTIVATION',PROPOSITION_TEXT:'Conditional behavior is required when activated.',STATUS:'UNDETERMINED'},'PROP-ACTIVATION');
  const applicability=record('applicabilityRecords',5,{SUBJECT_ID:'PROP-ACTIVATION',PROPOSED_APPLICABILITY:'APPLICABLE',ACTIVATION_PROOF_OBLIGATION_ID:'PROOF-ACTIVATION',REASONING:'The external author proposes activation.'},'APPLICABILITY-ACTIVATION');
  for(const item of [req,proposition,applicability])item.scope=scope;
  p.projectData.requirements.push(req);p.projectData.propositions.push(proposition);p.projectData.applicabilityRecords.push(applicability);
  engine.recalculate(p);
  assert(engine.evaluateApplicability(p,'PROP-ACTIVATION')==='UNKNOWN','An agent applicability proposal activated a conditional requirement without a satisfied activation proof obligation.');
  const proof=p.projectData.proofObligations.find(item=>String(engine.recordValue(item,'PROPOSITION_ID')||'')==='PROP-ACTIVATION');
  assert(proof,'The application did not derive a proof obligation for the conditional proposition.');
  const activationId=engine.recordId(proof,'proofObligations');applicability.fields.ACTIVATION_PROOF_OBLIGATION_ID=activationId;applicability.ACTIVATION_PROOF_OBLIGATION_ID=activationId;proof.fields.SATISFACTION_STATE='SATISFIED';proof.SATISFACTION_STATE='SATISFIED';
  assert(engine.evaluateApplicability(p,'PROP-ACTIVATION')==='APPLICABLE','A current satisfied activation proof obligation did not permit the conditional applicability determination to progress.');
}
console.log(JSON.stringify({activationProofFailClosed:true,activationProofProgression:true}));

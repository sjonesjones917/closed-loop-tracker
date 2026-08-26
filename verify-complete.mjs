import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion,store=globalThis.closedLoopProjectStore;
if(!core||!schema||!engine||!prompts||!ingestion||!store)throw new Error('Responsible-layer modules failed to load.');
const assert=(value,message)=>{if(!value)throw new Error(message);};
const record=(collection,stage,fields={},id)=>{const def=schema.RECORD_SCHEMAS[collection],recordId=id||`${def.prefix}-TEST`;return {id:recordId,stage,active:true,fields:{...fields,[def.idField]:recordId},...fields,[def.idField]:recordId};};
function project(jobId='JOB-FINAL-VERIFY'){
  const p=core.createBlankState(jobId);p.job.JOB_ID=jobId;p.job.JOB_TITLE='Final verification fixture';p.job.EXACT_USER_OBJECTIVE_VERBATIM='Synthetic implementation-verification project only.';p.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(p);engine.recalculate(p);return p;
}
function prompt(p,stage){const r={...prompts.buildPromptRecord(stage,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(r);return r;}

// Formal-state meanings remain exact and no Stage 31 exists.
assert(JSON.stringify(engine.STAGE_STATES)===JSON.stringify(['NOT STARTED','IN PROGRESS','BLOCKED','READY','COMPLETE']),'Stage tracker states changed.');
assert(JSON.stringify(engine.FORMAL_STATES)===JSON.stringify(['UNKNOWN','NONE','NOT APPLICABLE','TRUE','FALSE','SATISFIED','VIOLATED','UNDETERMINED','ACCEPTED','REJECTED','BLOCKED']),'Formal states changed.');
assert(core.STAGES.length===30&&!core.STAGES[30],'Stage 31 exists.');

// Invalid canonical relationship is rejected before mutation.
{
  const p=project('JOB-BAD-REL'),stage=3,pr=prompt(p,stage);
  const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{research:[{tempKey:'research-1',fields:{PASS_NUMBER:1,EXACT_PORTION_EXAMINED:'Controlled source portion',FINDING_CLASSIFICATION:'FACT',SOURCE_EVIDENCE:'Controlled evidence'},relationships:{SOURCE_ID:{recordId:'SOURCE-DOES-NOT-EXIST'}},evidenceRefs:['evidence-1']}]},evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Relationship validation fixture',location:'synthetic test',content:'controlled'}],unresolved:[],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});
  assert(!prepared.validation.valid&&prepared.validation.issues.some(x=>x.code==='UNRESOLVED_RELATIONSHIP'),'Invalid relationship was not rejected.');
  assert(prepared.project.projectData.research.length===0&&prepared.project.projectData.acceptedChanges.length===0,'Invalid relationship partially mutated canonical state.');
}

// Structured blocking human question blocks the stage until answered and versions User Job Input.
{
  let p=project('JOB-HUMAN-GATE'),stage=1,pr=prompt(p,stage);
  const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'question-1',question:'Which jurisdiction controls this job?',whyRequired:'Jurisdiction is human-authority input.',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
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

// Multi-operation review controls must remain bound to the operator-selected operation/run lane.
{
  const appSource=fs.readFileSync('app-core.js','utf8');
  assert(appSource.includes('function operatorLaneMatches(item,n)'),'Operator review has no shared lane matcher.');
  assert(appSource.includes("filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n))"),'Proposal rendering is still stage-wide.');
  assert(appSource.includes("filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,current.activeStage))"),'Accept/reject selection is still stage-wide.');
  assert(appSource.includes('operatorLaneMatches(validationLaneRecord(x),n)'),'Validation feedback is still stage-wide.');
  assert(appSource.includes('acceptedLaneChanges(n).length'),'Refinement control visibility is still stage-wide.');
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
    p.projectData.acceptedChanges.push({changeId:`CHANGE-STAGE11-${i}`,stage:11,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'COMPLETE',rawResponseId:`RAW-STAGE11-${i}`,scope:{iterationId:'ITERATION-STAGE11',candidateId:'CANDIDATE-STAGE11',runId:`RUN-STAGE11-${i}`,contextId:`CONTEXT-STAGE11-${i}`}});
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
  const p=project('JOB-REFINEMENT-CANONICAL'),stage=2,source=record('sources',2,{TITLE:'Accepted source'},'SOURCE-REFINE');
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
 const acceptLane=(slot,label)=>{const pr={...prompts.buildPromptRecord(stage,p,{scope:{runId:slot.runId,contextId:slot.contextId}}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);const fields={FRESH_CONTEXT_RECORD:slot.contextId,CONTAMINATION_CHECK:'NONE',TOOL_CONFIGURATION:'CONTROLLED',EXECUTION_STATUS:'COMPLETED',COMPLETE_OUTPUT:`output-${label}`};const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{runs:[{targetId:slot.runId,fields,relationships:{},evidenceRefs:['lane-evidence']}]},evidence:[{temporaryKey:'lane-evidence',kind:'WORKFLOW_EVIDENCE',description:'lane evidence',location:'fixture',content:`lane-${label}`}],unresolved:[],warnings:[],attachments:[]};const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});assert(prepared.validation.valid,`Scoped lane ${label} rejected: ${JSON.stringify(prepared.validation.issues)}`);const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'});p=committed.project;return committed.acceptedChange;};
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

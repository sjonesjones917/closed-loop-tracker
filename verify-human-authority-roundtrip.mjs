import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion;
const assert=(ok,message)=>{if(!ok)throw new Error(message);};

function fixture(jobId){
  const project=core.createBlankState(jobId);
  Object.assign(project.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Create a one-page checklist.',EXPLICIT_USER_REQUIREMENTS:'Use the audience selected by the human during Stage 01.',CURRENT_INPUT_VERSION:'INPUT-v001'});
  engine.ensureShape(project);engine.recalculate(project);
  const prompt={...prompts.buildPromptRecord(1,project,{operation:'COMPLETE'}),generatedAt:new Date().toISOString()};
  project.projectData.generatedPrompts.push(prompt);
  const manifest=prompt.contextManifest.intakeCoverageManifest;
  const capture={schema:'closed-loop-stage01-capture/2',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,pass1Completed:true,pass2OmissionChallenge:{completed:true,checkedCategories:['QUALIFIERS','EXCEPTIONS','DEPENDENCIES','NEGATIVE_REQUIREMENTS','DO_NOT_CHANGE','VISUAL_CONSTRAINTS','TEMPORAL_CONSTRAINTS','ACCEPTANCE_CONDITIONS','AUTHORITY_STATEMENTS','TOOL_RESTRICTIONS','FILE_REFERENCES','OUTPUT_FORMAT_REQUIREMENTS','CORRECTIONS','LATER_OVERRIDES'],omissionsFound:[],omissionsResolved:true},units:manifest.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'EXTRACTED_RELEVANT_INFORMATION',reason:'Captured once.',extractedStatements:[{statementKey:`s-${index}`,text:unit.rawValueText||unit.label,statementClass:'CONTEXT'}]}))};
  const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:project.job.JOB_ID,stage:1,operation:'COMPLETE',promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],humanAuthorityCandidates:[{temporaryKey:'human-answer-1',label:'Intended audience',value:'Field technicians',authorityClass:'HUMAN',claimedConversationBasis:'The human answered this question in the Stage 01 external conversation.',externalResponsePointer:'conversation-message-7',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[]}],stageData:{EXACT_DELIVERABLE_REQUESTED:'One-page checklist for field technicians',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)},records:{},evidence:[{temporaryKey:'evidence-1',kind:'INTAKE',description:'Stage 01 semantic intake',authorityType:'AGENT_CLAIM',location:'response.json',content:'Complete intake including the reported human audience answer.'}],unresolved:[],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(project,{stage:1,text:JSON.stringify(envelope),promptRecord:prompt});
  assert(prepared.validation.valid,`Fixture response rejected: ${JSON.stringify(prepared.validation.issues)}`);
  return {project:prepared.project,proposal:prepared.proposal,prompt,capture};
}

{
  const {project,proposal,prompt}=fixture('JOB-HUMAN-AUTHORITY-CONFIRM');
  let code='';try{ingestion.commit(project,proposal.proposalId,{operator:'TEST'});}catch(error){code=error?.code||'';}
  assert(code==='HUMAN_AUTHORITY_CONFIRMATION_REQUIRED','Human answer was accepted without direct confirmation.');
  const committed=ingestion.commit(project,proposal.proposalId,{operator:'TEST',humanAuthorityConfirmations:{'human-answer-1':'Field technicians'}});
  assert(committed.project.projectData.humanAuthorityConfirmations.length===1,'Exact human-answer confirmation was not preserved.');
  assert(committed.project.projectData.humanInputAnswers.some(answer=>answer.requestId==='EXTERNAL_CONVERSATION'&&answer.answer==='Field technicians'),'Confirmed external-conversation answer was not captured as human input.');
  assert(committed.acceptedChange?.humanAuthorityConfirmationIds?.length===1,'Accepted change is not bound to the human-answer confirmation.');
  const liveManifest=engine.intakeCoverageManifest(committed.project);
  assert(liveManifest.units.some(unit=>unit.kind==='HUMAN_ANSWER'),'Regression fixture did not reproduce the post-commit live-manifest delta from the atomically confirmed human answer.');
  assert(liveManifest.manifestSha256!==prompt.contextManifest.intakeCoverageManifest.manifestSha256,'Regression fixture did not reproduce the post-commit intake-manifest identity change.');
  const accounting=engine.evaluateIntakeAccounting(committed.project);
  assert(accounting.complete,`Exact atomic human-answer confirmation made its own accepted Stage 01 capture stale: ${accounting.reasons.join(' | ')}`);
  const action=engine.operationalNextAction(committed.project,1);
  assert(action.actionType==='CONFIRM_STAGE_ONE_INTENT','After exact atomic human-answer co-acceptance, Stage 01 must route directly to human intent confirmation rather than another agent round-trip.');
  engine.recordStageConfirmation(committed.project,1,true,'The represented objective and deliverable match.','TEST',{acceptedChangeId:committed.acceptedChange.changeId,inputVersion:committed.project.job.CURRENT_INPUT_VERSION,operatorLabel:'TEST'});
  assert(engine.gate(1,committed.project).complete&&committed.project.stages[1].status==='COMPLETE','Current human intent confirmation did not complete Stage 01 after atomic human-answer co-acceptance.');

  const unrelated=structuredClone(committed.project);
  unrelated.projectData.humanInputAnswers.push({answerId:'HUMAN-INPUT-ANSWER-UNRELATED',requestId:'SYNTHETIC_CORRUPTION',jobId:unrelated.job.JOB_ID,stage:1,answer:'Unrelated authority mutation',inputVersion:unrelated.job.CURRENT_INPUT_VERSION,authority:'User Job Input',answeredAt:new Date().toISOString()});
  const unrelatedAccounting=engine.evaluateIntakeAccounting(unrelated);
  assert(!unrelatedAccounting.complete,'Prompt-bound Stage 01 accounting hid an unrelated live human-input mutation that was not atomically co-accepted with the accepted change.');
}

{
  const {project,proposal}=fixture('JOB-HUMAN-AUTHORITY-RETURNED-ATTACHMENT');
  const committed=ingestion.commit(project,proposal.proposalId,{operator:'TEST',humanAuthorityConfirmations:{'human-answer-1':'Field technicians'}});
  engine.registerArtifactBytes(committed.project,{stage:1,artifactId:'ARTIFACT-RETURNED-STAGE01',filename:'agent-output.txt',mediaType:'text/plain',byteSize:12,sha256:'a'.repeat(64),role:'RETURNED_ATTACHMENT',lineage:{rawResponseId:proposal.rawResponseId,attachmentSlotId:'RETURNED-SLOT-1'}});
  const liveManifest=engine.intakeCoverageManifest(committed.project);
  assert(!liveManifest.units.some(unit=>unit.artifactId==='ARTIFACT-RETURNED-STAGE01'),'A Stage 01 agent-returned attachment was retroactively classified as user-supplied raw input.');
  const accounting=engine.evaluateIntakeAccounting(committed.project);
  assert(accounting.complete,`A Stage 01 returned attachment made the accepted semantic intake stale: ${accounting.reasons.join(' | ')}`);
}

{
  const {project,proposal}=fixture('JOB-HUMAN-AUTHORITY-CORRECT');
  let correctionCode='';try{ingestion.commit(project,proposal.proposalId,{operator:'TEST',humanAuthorityConfirmations:{'human-answer-1':'Supervisors'}});}catch(error){correctionCode=error?.code||'';}
  assert(correctionCode==='HUMAN_AUTHORITY_CORRECTION_REQUIRES_REPLACEMENT','A changed human answer did not invalidate the current response.');
  const corrected=ingestion.correctHumanAuthorityCandidates(project,proposal.proposalId,{'human-answer-1':'Supervisors'},{operator:'TEST'});
  assert(corrected.correctedCount===1,'Human correction was not recorded.');
  assert(corrected.project.projectData.responseProposals.find(item=>item.proposalId===proposal.proposalId)?.status==='STALE','Corrected response was not marked stale.');
  assert(corrected.project.projectData.humanInputAnswers.some(answer=>answer.requestId==='EXTERNAL_CONVERSATION_CORRECTION'&&answer.answer==='Supervisors'),'Corrected human answer was not preserved as a new human input version.');
  assert(corrected.project.job.CURRENT_INPUT_VERSION!==project.job.CURRENT_INPUT_VERSION,'Human correction did not advance the input version.');
}

console.log(JSON.stringify({humanAuthorityRoundTrip:'PASS',exactConfirmationRequired:true,confirmedAnswerCaptured:true,atomicCoAcceptanceStable:true,unrelatedMutationFailsClosed:true,returnedAttachmentNotRawInput:true,correctionInvalidatesResponse:true,replacementPromptRequired:true}));

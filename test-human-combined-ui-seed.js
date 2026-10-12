// Reuse the native fixture's reserved handoff and literal Stage01 envelope helpers.
// This seed creates a pending proposal only; every acceptance/correction is real UI.
globalThis.seedHumanCombinedUi=async function(mode){
 await store.ready;let p=await store.createProject({commandId:'PRIVATE-UI-HUMAN-'+mode});
 p.activeView='Workflow';p.activeStage=1;
 p.job.EXACT_USER_OBJECTIVE_VERBATIM='Produce the requested complete filing from the supplied description.';
 engine.recordHumanInputVersion(p,['EXACT_USER_OBJECTIVE_VERBATIM'],'SYNTHETIC_UI_SETUP');engine.recalculate(p);p=await store.writeProject(p,{expectedProjectRevision:p.revision,incrementRevision:true});
 const next=copy(p),issued=r.prompts.reserveAndBuildPromptRecord(next,1,{operation:'COMPLETE'}).prompt;p=await store.writeProject(next,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});let prompt=p.projectData.generatedPrompts.find(x=>x.instructionId===issued.instructionId);({project:p,prompt}=await authorizeSyntheticHandoff(r,{project:p,prompt}));
 if(mode==='REUSED'){
  const q=stageOneEnvelope(r,p,prompt);Object.assign(q,{responseType:'HUMAN_INPUT_REQUIRED',stageData:{},records:{},evidence:[],humanInputRequests:[{temporaryKey:'known-crew-question',question:'Which crew uses the checklist?',whyRequired:'The service crew is a human-supplied fact.',answerType:'TEXT',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],allowedValues:[],blocking:true}]});
  const question=await submitUiEnvelope(p,prompt,q),prepared=r.ingestion.prepareAcceptanceCandidate(question.p,question.id,{operator:'SYNTHETIC_UI_SETUP'});
  p=await store.writeProject(prepared.project,{expectedProjectRevision:question.p.revision,expectedStateSha256:question.p.projectSha256,mutationConfirmation:store.mutationImpact(question.p,prepared.project)});
  const request=p.projectData.humanInputRequests.find(x=>x.temporaryKey==='known-crew-question');assert.ok(request,'UI_REUSE_REAL_QUESTION_RECORD');
  const answered=r.ingestion.answerHumanInput(p,{[request.requestId]:'Field technicians'},{operator:'SYNTHETIC_UI_SETUP'});
  p=await store.writeProject(answered.project,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,mutationConfirmation:store.mutationImpact(p,answered.project)});
  prompt=p.projectData.generatedPrompts.find(x=>x.instructionId===answered.generatedPromptIds[0]);({project:p,prompt}=await authorizeSyntheticHandoff(r,{project:p,prompt}));
 }
 const e=stageOneEnvelope(r,p,prompt),candidate=(temporaryKey,label,value,authorityClass,extra={})=>({temporaryKey,label,value,authorityClass,claimedConversationBasis:'Explicit synthetic conversation; no actual human claim.',externalResponsePointer:'synthetic-'+temporaryKey,affectedStageFields:[],affectedRecords:[],...extra});
 e.humanAuthorityCandidates=[candidate('atomic-fact','Which crew uses the checklist?','Field technicians','HUMAN',{affectedStageFields:['EXACT_DELIVERABLE_REQUESTED']}),candidate('atomic-decision','Authorize the stated intake?','AUTHORIZED','HUMAN_DECISION',{decisionPurpose:'INTENT_CONFIRMATION',targetFamily:'job',targetId:p.job.JOB_ID})];e.stageData.EXACT_DELIVERABLE_REQUESTED='Create a checklist for Field technicians';
 const {p:saved,id,text,rawResponseId}=await submitUiEnvelope(p,prompt,e);p=saved;
 await store.metaPut('retainedProjectSuppressed',true);await store.metaPut('selectedProject',p.job.JOB_ID);
 return {mode,jobId:p.job.JOB_ID,proposalId:id,rawResponseId,promptId:prompt.instructionId,text,inputVersion:p.job.CURRENT_INPUT_VERSION,answerCount:p.projectData.humanInputAnswers.length,confirmationCount:p.projectData.humanAuthorityConfirmations.length,decisionCount:engine.records(p,'humanDecisions').length,acceptedChangeCount:engine.acceptedChanges(p,1).length,projectSha256:p.projectSha256,knownAnswers:plain(p.projectData.humanInputAnswers)};
};

async function submitUiEnvelope(p,prompt,e){
 const manifest=r.prompts.promptFileManifest(prompt),text=JSON.stringify(e),identity={promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce};
 const staged=await store.stageResponseFile({jobId:p.job.JOB_ID,stage:1,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',...identity}),file=await store.readStagedResponseFile({jobId:p.job.JOB_ID,stagingId:staged.stagingId});assert.equal(new TextDecoder().decode(file.bytes),text,'UI_SEED_RAW_BYTE_ORACLE');assert.equal(file.sha256,await bytes(new Blob([text])),'UI_SEED_RAW_SHA_ORACLE');
 const capture=r.ingestion.captureRaw(p,{stage:1,text,promptRecord:prompt,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,rawFilename:'response.json',mediaType:'application/json',status:file.status,sha256:file.sha256,byteSize:file.byteSize,...identity}}),result=r.ingestion.prepareCaptured(capture.project,{rawResponseId:capture.rawRecord.rawResponseId});assert.equal(result.validation.valid,true,'UI_VALID_PENDING_ADMISSION');p=await store.writeProject(result.project,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});const id=result.proposal.proposalId;assert.equal(r.ingestion.findProposal(p,id).status,'PENDING_OPERATOR_REVIEW');return {p,id,text,rawResponseId:capture.rawRecord.rawResponseId};
}

import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {readStoreArchive} from './test-zip.mjs';
const r=projectStoreRuntime(),{core,engine,prompts,ingestion,store,copy,runtime}=r;
let project=core.createBlankState('REJECTED-RESPONSE-RETRY');engine.ensureShape(project);project.job.EXACT_USER_OBJECTIVE_VERBATIM='Produce the requested output from the current project information.';engine.recalculate(project);
project=await store.writeProject(project,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
const draft=copy(project),prompt=prompts.reserveAndBuildPromptRecord(draft,1).prompt;
project=await store.writeProject(draft,{expectedProjectRevision:project.revision});
const schema=runtime.closedLoopWorkflowSchema,envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:'WRONG-PROJECT',stage:1,operation:prompt.operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce,scope:prompt.scope,responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'missing-output',kind:'MISSING_CAPABILITY',description:'Synthetic unavailable external output',whyBlocking:'The output has not been observed.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};
const rejected=ingestion.prepare(project,{stage:1,text:JSON.stringify(envelope),promptRecord:prompt,expectedCommittedRevision:project.revision});
assert.equal(rejected.validation.valid,false);project=await store.writeProject(rejected.project,{expectedProjectRevision:project.revision,expectedStateSha256:project.projectSha256,operational:true});
const source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');
const extract=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)+start.length));
runtime.selectedProject=project;
vm.runInContext(`let current=selectedProject,projects=[current],replacementReview=null,acceptanceSession=null;
const projectStore=closedLoopProjectStore,ingestion=closedLoopResponseIngestion,clone=structuredClone,TAB_INSTANCE_ID='SYNTHETIC-RETRY-UI';
const captureCurrentView=async()=>{},captureView=()=>({activeStage:current.activeStage,activeView:current.activeView}),withStorageActivity=async(label,work)=>work(),unloadInactiveProjects=()=>{},mobileSessionCurrent=()=>false,recordCommittedBoundary=async()=>{},render=()=>{};
${extract('async function persistReplacement(','async function save(')}
${extract('async function saveRequiredContinuation(','async function ')}
globalThis.retryUI={continue:saveRequiredContinuation,current:()=>current};`,runtime);
const revision=project.revision;
await assert.doesNotReject(()=>runtime.retryUI.continue(1),'RETRY_COMMIT_ORACLE: a rejection must save its replacement instruction against the pre-command revision');
const saved=runtime.retryUI.current(),replacement=saved.projectData.generatedPrompts.at(-1);
assert.equal(saved.revision,revision+1);assert.notEqual(replacement.instructionId,prompt.instructionId);
assert.equal(replacement.reservationRevision,saved.revision);assert.equal(saved.projectData.acceptedChanges.length,0);
assert.equal(engine.recordValue(saved.projectData.operationReservations.find(row=>engine.recordId(row,'operationReservations')===prompt.operationReservationId),'STATUS'),'REJECTED');
assert.equal(engine.recordValue(saved.projectData.operationReservations.find(row=>engine.recordId(row,'operationReservations')===replacement.operationReservationId),'STATUS'),'RESERVED');
const corrected={...envelope,jobId:saved.job.JOB_ID,promptIdentity:{instructionId:replacement.instructionId,bodySha256:replacement.bodySha256,contractSha256:replacement.contractSha256,contextSignature:replacement.contextSignature},packageId:replacement.packageId,operationReservationId:replacement.operationReservationId,challengeNonce:replacement.challengeNonce,scope:replacement.scope};
const prepared=ingestion.prepare(saved,{stage:1,text:JSON.stringify(corrected),promptRecord:replacement,expectedCommittedRevision:saved.revision,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',packageId:replacement.packageId,operationReservationId:replacement.operationReservationId,challengeNonce:replacement.challengeNonce}});
assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));
const validated=await store.writeProject(prepared.project,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256,operational:true});
assert.equal(validated.projectData.acceptedChanges.length,0);
const accepted=ingestion.commit(validated,prepared.proposal.proposalId);
const committed=await store.writeProject(accepted.project,{expectedProjectRevision:validated.revision});
assert.equal(committed.projectData.responseProposals.find(row=>row.proposalId===prepared.proposal.proposalId).status,'BLOCKER_ACCEPTED');
assert.equal(committed.projectData.rawResponses.find(row=>row.rawResponseId===rejected.rawRecord.rawResponseId).status,'VALIDATION_FAILED');
// Exercise the actual reserved/file-first/save/reload/archive boundary. The
// otherwise-valid work and human claim must survive a protocol-only rejection.
let priorTransportObservation;
{
  let p=await store.createProject({commandId:'PRIOR-SUBSTANCE-REGRESSION'}),draft=copy(p);
  draft.job.EXACT_USER_OBJECTIVE_VERBATIM='Produce a complete checklist from the human intent.';
  engine.recordHumanInputVersion(draft,['EXACT_USER_OBJECTIVE_VERBATIM'],'SYNTHETIC_HUMAN');engine.recalculate(draft);
  p=await store.writeProject(draft,{expectedProjectRevision:p.revision});draft=copy(p);
  const first=prompts.reserveAndBuildPromptRecord(draft,1,{operation:'COMPLETE'},{owningTabInstance:'PRIOR-WORK-REGRESSION'}).prompt;
  p=await store.writeProject(draft,{expectedProjectRevision:p.revision});
  const humanMarker='KNOWN_HUMAN_ANSWER: checklist recipient North Archive, language French.',workMarker='KNOWN_VALID_AGENT_WORK: first-attempt checklist.',largeWork=workMarker+' '+('retained work; '.repeat(6000)),m=first.contextManifest.intakeCoverageManifest;
  const capture={schema:'closed-loop-stage01-capture/2',inputVersion:m.inputVersion,manifestSha256:m.manifestSha256,pass1Completed:true,pass2OmissionChallenge:{completed:true,checkedCategories:['QUALIFIERS','EXCEPTIONS','DEPENDENCIES','NEGATIVE_REQUIREMENTS','DO_NOT_CHANGE','VISUAL_CONSTRAINTS','TEMPORAL_CONSTRAINTS','ACCEPTANCE_CONDITIONS','AUTHORITY_STATEMENTS','TOOL_RESTRICTIONS','FILE_REFERENCES','OUTPUT_FORMAT_REQUIREMENTS','CORRECTIONS','LATER_OVERRIDES'],omissionsFound:[],omissionsResolved:true},units:m.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'EXTRACTED_RELEVANT_INFORMATION',extractedStatements:[{statementKey:'statement-'+index,text:unit.rawValueText||unit.label||unit.unitId,statementClass:'CONTEXT',sourceLocation:unit.sourceLocation}]}))};
  const manifest=prompts.promptFileManifest(first),slot=manifest.attachmentSlots.find(row=>row.role!=='STRUCTURED_RESPONSE'),fileText='Exact prior rejected supporting notes.\n',blob=new Blob([fileText],{type:'text/plain'}),sha=runtime.closedLoopHash.sha256Text(fileText);
  draft=copy(p);const artifactId=engine.allocateId(draft,'artifacts',copy({commandId:'PRIOR-FILE',targetSlot:slot.attachmentSlotId,parentId:first.instructionId,idempotencyKey:'FILE_INTAKE',payload:{filename:'prior-notes.txt',mediaType:'text/plain',byteSize:blob.size,sha256:sha}}));
  const stored=await store.putArtifact({artifactId,jobId:p.job.JOB_ID,blob,filename:'prior-notes.txt',mediaType:'text/plain',expectedSha256:sha,lineage:{stage:1,attachmentSlotId:slot.attachmentSlotId}});
  const file={artifactId,attachmentSlotId:slot.attachmentSlotId,name:stored.filename,type:stored.mediaType,size:stored.byteSize,sha256:stored.sha256};
  const input={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:1,operation:first.operation,promptIdentity:manifest.promptIdentity,packageId:first.packageId,operationReservationId:first.operationReservationId,challengeNonce:first.challengeNonce,scope:first.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],humanAuthorityCandidates:[{temporaryKey:'known-human-answer',label:'Recipient and language',value:humanMarker,authorityClass:'HUMAN',claimedConversationBasis:'The human answered in the first conversation.',externalResponsePointer:'conversation-message-1',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[]}],stageData:{EXACT_DELIVERABLE_REQUESTED:largeWork,ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)},records:{},evidence:[{temporaryKey:'intake',kind:'INTAKE',description:'Complete two-pass semantic intake',authorityType:'AGENT_CLAIM',location:'response.json',content:'The complete prior work is retained.',sourceRef:null}],unresolved:[],warnings:[],attachments:[{temporaryKey:'prior-notes',attachmentSlotId:slot.attachmentSlotId,role:slot.role,filename:'prior-notes.txt',mediaType:'text/plain',byteSize:blob.size,sha256:sha}]};
  const conforming=copy(input);delete conforming.evidence[0].sourceRef;
  assert.equal(ingestion.validateEnvelope(draft,conforming,{stage:1,promptRecord:first,rawSha256:runtime.closedLoopHash.rawResponseSha256(JSON.stringify(conforming)),files:[file]}).valid,true,'PRIOR_RETRY_SETUP_ORACLE: fixture must conform apart from the targeted sourceRef:null');
  const text=JSON.stringify(input),responseBlob=new Blob([text],{type:'application/json'}),staged=await store.stageResponseFile({jobId:p.job.JOB_ID,stage:1,blob:responseBlob,rawFilename:'response.json',mediaType:'application/json',promptIdentity:manifest.promptIdentity,packageId:first.packageId,operationReservationId:first.operationReservationId,challengeNonce:first.challengeNonce}),read=await store.readStagedResponseFile({jobId:p.job.JOB_ID,stagingId:staged.stagingId});
  assert.equal(new TextDecoder('utf-8',{fatal:true}).decode(read.bytes),text);
  const captured=ingestion.captureRaw(draft,{stage:1,text,promptRecord:first,files:[file],transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,rawFilename:'response.json',mediaType:'application/json',byteSize:read.byteSize,sha256:read.sha256,packageId:first.packageId,operationReservationId:first.operationReservationId,challengeNonce:first.challengeNonce}});
  p=await store.writeProject(captured.project,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,operational:true});
  const failure=ingestion.prepareCaptured(p,{rawResponseId:captured.rawRecord.rawResponseId,promptRecord:first,expectedCommittedRevision:p.revision});
  assert.deepEqual(Array.from(failure.validation.issues,row=>row.code),['INVALID_EVIDENCE_SOURCE_REF']);
  p=await store.writeProject(failure.project,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,operational:true});draft=copy(p);
  const continuation=ingestion.prepareStageContinuation(draft,{stage:1,owningTabInstance:'PRIOR-WORK-REGRESSION'});assert.equal(continuation.created,true);
  p=await store.writeProject(draft,{expectedProjectRevision:p.revision});p=await store.readProject(p.job.JOB_ID);
  const retry=p.projectData.generatedPrompts.find(row=>row.instructionId===continuation.prompt.instructionId),result=await store.createExecutionPackage({jobId:p.job.JOB_ID,stage:1,operation:'COMPLETE',instructionId:retry.instructionId}),members=readStoreArchive(new Uint8Array(await result.blob.arrayBuffer())),decode=path=>new TextDecoder().decode(members.find(row=>row.canonicalPath===path).bytes),exported=JSON.parse(decode('manifest.json'));
  assert.ok(members.some(row=>row.canonicalPath==='context.json'),'PRIOR_RETRY_CONTEXT_ORACLE: complete large prior work must externalize rather than disappear');
  const context=JSON.parse(decode('context.json')),member=context.members.find(row=>row.sourceIdentity.endsWith('.retryContext'));
  assert.ok(member,'PRIOR_RETRY_CONTEXT_ORACLE: saved/reloaded/exported context must contain the prior rejected work');
  const relay=JSON.parse(member.value),prior=relay.attempts.find(row=>row.rawResponseId===failure.rawRecord.rawResponseId);
  assert.ok(prior,'PRIOR_RETRY_CONTEXT_ORACLE: no opaque rejection ID can replace substantive prior work');
  assert.equal(prior.completeRawResponse,text,'PRIOR_RETRY_CONTEXT_ORACLE: full prior response bytes must survive exactly');
  assert.equal(prior.rawSha256,runtime.closedLoopHash.sha256Text(text));assert.equal(prior.reportedHumanAuthorityStatus,'UNCONFIRMED_AGENT_REPORT');
  assert.ok(prior.completeRawResponse.includes(humanMarker));assert.ok(prior.completeRawResponse.includes(largeWork));
  assert.equal(p.projectData.acceptedChanges.length,0);assert.equal(p.stages[1].agentData?.EXACT_DELIVERABLE_REQUESTED,undefined);
  const expectedTypes=['TEXT','LONG_TEXT','BOOLEAN','NUMBER','CHOICE','MULTI_CHOICE','DATE','FILE_REFERENCE'],expectedKinds=['MISSING_HUMAN_INPUT','MISSING_APPLICATION_CONTEXT','INADEQUATE_PRIOR_OUTPUT','MISSING_AUTHORITY','MISSING_EVIDENCE','MISSING_CAPABILITY','WORK_TOO_LARGE_FOR_ENVIRONMENT','MISSING_ARTIFACT','UNRESOLVED_CONFLICT','EXECUTION_FAILURE','TOOL_FAILURE','UNKNOWN'];
  assert.deepEqual(exported.responseContract.envelope.humanInputAnswerTypeValues,expectedTypes,'EXPORTED_FALLBACK_ENUM_ORACLE: committed package must publish the authoritative8 control values');
  assert.deepEqual(exported.responseContract.envelope.unresolvedKindValues,expectedKinds,'EXPORTED_FALLBACK_ENUM_ORACLE: committed package must publish the controlled unresolved kinds');
  assert.equal(exported.promptIdentity.instructionId,retry.instructionId);assert.notEqual(retry.instructionId,first.instructionId);
  assert.equal(prior.originalPromptIdentity.instructionId,first.instructionId);assert.equal(exported.retryFiles.length,1);
  const priorFile=exported.retryFiles[0];assert.equal(priorFile.authority,'UNTRUSTED_NONCANONICAL_PRIOR_WORK');assert.equal(decode(priorFile.canonicalPath),fileText);
  assert.equal(priorFile.sha256,sha);assert.equal(priorFile.originalAttachmentSlotId,slot.attachmentSlotId);assert.ok(!exported.attachmentSlots.some(row=>row.attachmentSlotId===slot.attachmentSlotId));
  // A human correction marks a previously valid proposal stale before its
  // replacement is generated. It must retain work too, and the exact corrected
  // answer comes from current human authority rather than the old agent claim.
  const validInput=copy(input);delete validInput.evidence[0].sourceRef;validInput.attachments=[];
  Object.assign(validInput,{promptIdentity:exported.promptIdentity,packageId:retry.packageId,operationReservationId:retry.operationReservationId,challengeNonce:retry.challengeNonce,scope:retry.scope});
  const validAttempt=ingestion.prepare(p,{stage:1,text:JSON.stringify(validInput),promptRecord:retry,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',packageId:retry.packageId,operationReservationId:retry.operationReservationId,challengeNonce:retry.challengeNonce},expectedCommittedRevision:p.revision});
  assert.equal(validAttempt.validation.valid,true,JSON.stringify(validAttempt.validation.issues));
  p=await store.writeProject(validAttempt.project,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,operational:true});
  const correctedAnswer='CONFIRMED_HUMAN_CORRECTION: checklist recipient South Archive, language English.';
  const humanCorrection=ingestion.correctHumanAuthorityCandidates(p,validAttempt.proposal.proposalId,copy({'known-human-answer':correctedAnswer}));
  const correctionImpact=store.mutationImpact(p,humanCorrection.project);assert.equal(correctionImpact.requiresConfirmation,true);
  p=await store.writeProject(humanCorrection.project,{expectedProjectRevision:p.revision,mutationConfirmation:correctionImpact});
  const correctedPrompt=p.projectData.generatedPrompts.find(row=>row.instructionId===humanCorrection.replacementPromptId),correctedPackage=await store.createExecutionPackage({jobId:p.job.JOB_ID,stage:1,operation:'COMPLETE',instructionId:correctedPrompt.instructionId}),correctedMembers=readStoreArchive(new Uint8Array(await correctedPackage.blob.arrayBuffer())),correctedText=correctedMembers.map(row=>new TextDecoder().decode(row.bytes)).join('\n');
  assert.ok(correctedText.includes(correctedAnswer),'PRIOR_RETRY_HUMAN_CORRECTION_ORACLE: exact current known human answer must reach the next actor');
  const correctedRelay=prompts.retryContextFor(p,1,'COMPLETE',correctedPrompt.scope),staleAttempt=correctedRelay.attempts.find(row=>row.rawResponseId===validAttempt.rawRecord.rawResponseId);
  assert.ok(staleAttempt,'PRIOR_RETRY_HUMAN_CORRECTION_ORACLE: a valid proposal made stale by human correction must retain its complete prior work');
  assert.equal(staleAttempt.completeRawResponse,JSON.stringify(validInput));assert.equal(staleAttempt.reportedHumanAuthorityStatus,'UNCONFIRMED_AGENT_REPORT');assert.equal(p.projectData.acceptedChanges.length,0);
  priorTransportObservation={checkId:'BOUNDARY-RETRY-PRIOR-SUBSTANCE',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:730','specification/closed-loop-reliability-controlling-implementation-specification.txt:741','specification/closed-loop-reliability-controlling-implementation-specification.txt:746'],boundary:'Actual staged response bytes -> failed validation -> committed replacement -> reload -> exported ZIP/context and prior returned file',expected:{rawByteEquality:true,humanClaimStatus:'UNCONFIRMED_AGENT_REPORT',canonicalAcceptedChanges:0,priorFileByteEquality:true,contextExternalized:true,exportedFallbackEnumsPublished:true,correctedHumanValueDelivered:true},observed:{rawByteEquality:prior.completeRawResponse===text,humanClaimStatus:prior.reportedHumanAuthorityStatus,canonicalAcceptedChanges:p.projectData.acceptedChanges.length,priorFileByteEquality:decode(priorFile.canonicalPath)===fileText,contextExternalized:true,exportedFallbackEnumsPublished:true,correctedHumanValueDelivered:correctedText.includes(correctedAnswer),currentInstructionId:retry.instructionId,priorInstructionId:first.instructionId,rejectionCode:'INVALID_EVIDENCE_SOURCE_REF'},passed:true,violation:'sourceRef:null protocol defect',accepted:false};
}

console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Actual UI commit/continuation functions with production runtime and transactional test adapter',retryPriorSubstanceTransport:'PASS',retryHumanClaimNoncanonical:true,retryLargeContextTransport:'PASS',verificationObservations:[priorTransportObservation],cases:[{name:'Rejected response retains rejection and saves a fresh correctly bound instruction without accepting work',result:'PASS'}]},null,2));

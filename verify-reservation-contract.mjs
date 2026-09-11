import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);

for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(new URL('./'+file,import.meta.url),'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion,hash=globalThis.closedLoopHash;
const value=(record,name)=>engine.recordValue(record,name),id=record=>engine.recordId(record,'operationReservations');
assert.deepEqual(schema.CONTROLLING_COMPLETION_ENUMS.reservation,['RESERVED','EXPORTED','ORPHANED','RESUMED','RESPONSE_STAGED','ACCEPTED','REJECTED','CANCELLED','SUPERSEDED','EXPIRED_BY_SCOPE']);
assert.equal(schema.RECORD_SCHEMAS.operationReservations.fieldDefinitions.RESERVATION_REVISION.valueType,'INTEGER');
const p={revision:7,activeStage:1,job:{JOB_ID:'JOB-RESERVATION-TEST',CONTRACT_PROFILE_ID:'closed-loop-completion-profile/1'},projectData:{},stages:{}};engine.ensureShape(p);
const operationScope={projectRevision:7,inputVersion:'INPUT-v001'};
const target=engine.reservationTargetSlot(p,{stage:1,operation:'COMPLETE',scope:operationScope});
assert.match(target,/^[a-f0-9]{64}$/);
assert.throws(()=>engine.reserveOperation(p,{stage:1,operation:'COMPLETE',scope:operationScope,targetSlot:'caller-owned'}),/application-calculated/);
const r=engine.reserveOperation(p,{stage:1,operation:'COMPLETE',scope:operationScope,owningTabInstance:'TAB-A',payload:{kind:'test'}});
assert.equal(p.revision,8,'reservation creation must commit R+1');assert.equal(value(r,'STATUS'),'RESERVED');assert.equal(value(r,'EXPECTED_REVISION'),8);assert.equal(value(r,'RESERVATION_REVISION'),8);assert.equal(value(r,'SCOPE').projectRevision,8);assert.equal(value(r,'TARGET_SLOT'),target);assert.match(value(r,'CHALLENGE_NONCE'),/^[a-f0-9]{32}$/);
assert.equal(id(engine.reserveOperation(p,{stage:1,operation:'COMPLETE',scope:operationScope,owningTabInstance:'TAB-A',payload:{kind:'test'}})),id(r),'exact retry must return the existing reservation before stale-revision handling');assert.equal(p.revision,8,'exact retry must not reserve another revision');
assert.throws(()=>engine.reserveOperation(p,{stage:1,operation:'COMPLETE',scope:operationScope,owningTabInstance:'TAB-A',payload:{kind:'different'}}),/authoritative reservation/,'a different payload cannot replace the live authoritative reservation');
engine.transitionOperationReservation(r,'EXPORTED');engine.transitionOperationReservation(r,'RESPONSE_STAGED');engine.transitionOperationReservation(r,'ACCEPTED');assert.equal(value(r,'STATUS'),'ACCEPTED');assert.throws(()=>engine.transitionOperationReservation(r,'RESERVED'),/Invalid operation-reservation transition/);

// Production-transport regression: reservation identity must bind the saved prompt,
// response template and ingestion acceptance. This uses the real reservation and
// real response validator rather than source inspection.
const q=core.createBlankState('JOB-RESERVATION-TRANSPORT');q.revision=7;q.job.EXACT_USER_OBJECTIVE_VERBATIM='Exercise reservation-bound external response transport.';q.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(q);engine.recalculate(q);
const preview=structuredClone(q);preview.revision=8;const provisional=prompts.buildPromptRecord(1,preview,{operation:'COMPLETE'}),packageId='PACKAGE-'+hash.sha256Value({jobId:q.job.JOB_ID,stage:1,operation:'COMPLETE',instructionId:provisional.instructionId}).slice(0,32).toUpperCase();
const reservation=engine.reserveOperation(q,{stage:1,operation:'COMPLETE',scope:provisional.scope,promptId:provisional.instructionId,packageId,owningTabInstance:'TAB-TRANSPORT',payload:{instructionId:provisional.instructionId,packageId}});
const reservedPrompt=prompts.buildPromptRecord(1,q,{operation:'COMPLETE'});
assert.equal(reservedPrompt.instructionId,provisional.instructionId,'Reservation transaction changed the allocated instruction identity.');
assert.equal(reservedPrompt.packageId,packageId,'Saved prompt did not bind the application package identity.');
assert.equal(reservedPrompt.operationReservationId,id(reservation),'Saved prompt did not bind the operation reservation identity.');
assert.equal(reservedPrompt.challengeNonce,value(reservation,'CHALLENGE_NONCE'),'Saved prompt did not bind the reservation challenge nonce.');
assert.deepEqual(reservedPrompt.scope,value(reservation,'SCOPE'),'Saved prompt scope is not the committed reservation scope.');
q.projectData.generatedPrompts.push({...reservedPrompt,generatedAt:new Date().toISOString()});
const transport={packageId:reservedPrompt.packageId,operationReservationId:reservedPrompt.operationReservationId,challengeNonce:reservedPrompt.challengeNonce};
const envelope=JSON.parse(prompts.responseContract(1,'COMPLETE',reservedPrompt.instructionId,reservedPrompt.bodySha256,reservedPrompt.contractSha256,reservedPrompt.contextSignature,reservedPrompt.scope,q.job.JOB_ID,transport));
envelope.responseType='BLOCKED';envelope.stageData={};envelope.records={};envelope.evidence=[];envelope.unresolved=[{temporaryKey:'u-transport',kind:'MISSING_CAPABILITY',description:'Controlled transport fixture blocker.',whyBlocking:'No target execution is needed for this transport validation.',affectedStageFields:[],affectedRecords:[],blocking:true}];
const exact=ingestion.validateEnvelope(q,envelope,{stage:1,promptRecord:reservedPrompt,rawSha256:hash.sha256Text(JSON.stringify(envelope)),files:[]});
assert(exact.valid,`Exact reservation-bound response was rejected: ${JSON.stringify(exact.issues)}`);
for(const [key,replacement,expectedCode] of [['packageId','PACKAGE-WRONG','PACKAGE_ID_MISMATCH'],['operationReservationId','RESERVATION-WRONG','OPERATION_RESERVATION_MISMATCH'],['challengeNonce','0'.repeat(32),'CHALLENGE_NONCE_MISMATCH']]){const bad=structuredClone(envelope);bad[key]=replacement;const check=ingestion.validateEnvelope(q,bad,{stage:1,promptRecord:reservedPrompt,rawSha256:hash.sha256Text(JSON.stringify(bad)),files:[]});assert(!check.valid&&check.issues.some(x=>x.code===expectedCode),`${key} mismatch did not fail closed with ${expectedCode}: ${JSON.stringify(check.issues)}`);}
const missing=structuredClone(envelope);delete missing.operationReservationId;const missingCheck=ingestion.validateEnvelope(q,missing,{stage:1,promptRecord:reservedPrompt,rawSha256:hash.sha256Text(JSON.stringify(missing)),files:[]});assert(!missingCheck.valid&&missingCheck.issues.some(x=>x.code==='MISSING_OPERATION_RESERVATION_ID'),'Missing reservation identity did not fail closed.');

// Atomic reservation+prompt transaction and replacement-prompt lifecycle.
function transportProject(jobId){const p=core.createBlankState(jobId);p.revision=7;p.job.EXACT_USER_OBJECTIVE_VERBATIM='Exercise atomic reservation-bound prompt replacement.';p.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(p);engine.recalculate(p);return p;}
function reserveAndSave(p){const before=Number(p.revision||0),created=prompts.reserveAndBuildPromptRecord(p,1,{operation:'COMPLETE'},{owningTabInstance:'TAB-TRANSPORT-LIFECYCLE'}),pr=created.prompt,res=created.reservation;assert.equal(p.revision,before+1,'Reservation identity and saved prompt must commit at exactly R+1.');assert.equal(Number(pr.scope.projectRevision),p.revision);assert.equal(Number(value(res,'RESERVATION_REVISION')),p.revision);assert.equal(pr.operationReservationId,id(res));assert.equal(pr.packageId,value(res,'PACKAGE_ID'));assert.equal(pr.challengeNonce,value(res,'CHALLENGE_NONCE'));assert.equal(pr.transportBindingRequired,true);return {pr,res};}
function blockedEnvelope(p,pr){const e=JSON.parse(prompts.responseContract(1,'COMPLETE',pr.instructionId,pr.bodySha256,pr.contractSha256,pr.contextSignature,pr.scope,p.job.JOB_ID,{packageId:pr.packageId,operationReservationId:pr.operationReservationId,challengeNonce:pr.challengeNonce}));e.responseType='BLOCKED';e.stageData={};e.records={};e.evidence=[];e.unresolved=[{temporaryKey:'u-lifecycle',kind:'MISSING_CAPABILITY',description:'Controlled lifecycle blocker.',whyBlocking:'Transport lifecycle fixture.',affectedStageFields:[],affectedRecords:[],blocking:true}];return e;}
function humanQuestionEnvelope(p,pr){const e=blockedEnvelope(p,pr);e.responseType='HUMAN_INPUT_REQUIRED';e.humanInputRequests=[{temporaryKey:'q-lifecycle',question:'Supply one controlled value.',whyRequired:'Human authority is required for this fixture.',affectedStageFields:[],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}];e.unresolved=[];return e;}
function prepareAuthoritative(p,pr,envelope){const text=JSON.stringify(envelope),promptIdentity={instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},transport={authority:'AUTHORITATIVE_RESPONSE_FILE',materializedAsResponseFile:false,stagingId:'STAGING-LIFECYCLE',rawFilename:'response.json',mediaType:'application/json',byteSize:new TextEncoder().encode(text).byteLength,sha256:hash.sha256Text(text),status:'HASHED_AND_REVERIFIED',promptIdentity,packageId:pr.packageId,operationReservationId:pr.operationReservationId,challengeNonce:pr.challengeNonce};const captured=ingestion.captureRaw(p,{stage:1,text,promptRecord:pr,transport});return ingestion.prepareCaptured(captured.project,{rawResponseId:captured.rawRecord.rawResponseId,promptRecord:pr,expectedCommittedRevision:Number(captured.project.revision||0)});}
{
  let p=transportProject('JOB-RESERVATION-ATOMIC');const {pr:oldPrompt,res:oldReservation}=reserveAndSave(p),bad=blockedEnvelope(p,oldPrompt);bad.contractProfileId='closed-loop-completion-profile/WRONG';const failed=prepareAuthoritative(p,oldPrompt,bad);assert.equal(failed.validation.valid,false);assert.equal(value(failed.project.projectData.operationReservations.find(x=>id(x)===id(oldReservation)),'STATUS'),'REJECTED','A validation-failed response must terminate the exact response-staged reservation.');p=failed.project;const {pr:newPrompt,res:newReservation}=reserveAndSave(p);assert.notEqual(newPrompt.instructionId,oldPrompt.instructionId,'Replacement after validation failure must allocate a new prompt identity.');assert.notEqual(newPrompt.operationReservationId,oldPrompt.operationReservationId,'Replacement after validation failure must allocate a new reservation identity.');assert.notEqual(newPrompt.challengeNonce,oldPrompt.challengeNonce,'Replacement after validation failure must allocate a new challenge nonce.');assert(p.projectData.generatedPrompts.find(x=>x.instructionId===oldPrompt.instructionId)?.invalidatedBy,'Replacement registration must supersede the old prompt.');const stale=ingestion.validateEnvelope(p,blockedEnvelope(transportProject('JOB-DUMMY'),oldPrompt),{stage:1,promptRecord:newPrompt,rawSha256:'0'.repeat(64),files:[]});assert(!stale.valid&&stale.issues.some(x=>['STALE_PROMPT_IDENTITY','PACKAGE_ID_MISMATCH','OPERATION_RESERVATION_MISMATCH','CHALLENGE_NONCE_MISMATCH'].includes(x.code)),'An old response must not validate against the replacement reservation-bound prompt.');const current=ingestion.validateEnvelope(p,blockedEnvelope(p,newPrompt),{stage:1,promptRecord:newPrompt,rawSha256:hash.sha256Text(JSON.stringify(blockedEnvelope(p,newPrompt))),files:[]});assert(current.valid,`Replacement reservation-bound response was rejected: ${JSON.stringify(current.issues)}`);assert.equal(value(newReservation,'STATUS'),'RESERVED');
}
{
  let p=transportProject('JOB-RESERVATION-CORRECTION');const {pr}=reserveAndSave(p),prepared=prepareAuthoritative(p,pr,blockedEnvelope(p,pr));assert(prepared.validation.valid&&prepared.proposal);const rejected=ingestion.reject(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY',reason:'Controlled correction request.',requestCorrection:true}),replacement=rejected.project.projectData.generatedPrompts.find(x=>x.instructionId===rejected.replacementPromptId);assert(replacement?.transportBindingRequired,'Correction-request replacement prompt must be reservation-bound.');assert.notEqual(replacement.instructionId,pr.instructionId);assert.notEqual(replacement.operationReservationId,pr.operationReservationId);assert.equal(value(rejected.project.projectData.operationReservations.find(x=>id(x)===pr.operationReservationId),'STATUS'),'REJECTED');
}
{
  let p=transportProject('JOB-RESERVATION-ABANDON');const {pr}=reserveAndSave(p),prepared=prepareAuthoritative(p,pr,blockedEnvelope(p,pr));assert(prepared.validation.valid&&prepared.proposal);const abandoned=ingestion.abandon(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY',reason:'Controlled abandon fixture.'}),replacement=abandoned.project.projectData.generatedPrompts.find(x=>x.instructionId===abandoned.replacementPromptId);assert(replacement?.transportBindingRequired,'Abandoned-attempt replacement prompt must be reservation-bound.');assert.notEqual(replacement.operationReservationId,pr.operationReservationId);assert.equal(value(abandoned.project.projectData.operationReservations.find(x=>id(x)===pr.operationReservationId),'STATUS'),'CANCELLED');
}
{
  let p=transportProject('JOB-RESERVATION-HUMAN-ANSWER');const {pr}=reserveAndSave(p),prepared=prepareAuthoritative(p,pr,humanQuestionEnvelope(p,pr));assert(prepared.validation.valid&&prepared.proposal);p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;const request=p.projectData.humanInputRequests.at(-1),answered=ingestion.answerHumanInput(p,{[request.requestId]:'Controlled answer'},{operator:'VERIFY'}),replacement=answered.project.projectData.generatedPrompts.find(x=>x.instructionId===answered.generatedPromptIds[0]);assert(replacement?.transportBindingRequired,'SAVE_HUMAN_INPUT replacement prompt must be reservation-bound.');assert.notEqual(replacement.operationReservationId,pr.operationReservationId);assert(answered.project.projectData.generatedPrompts.find(x=>x.instructionId===pr.instructionId)?.invalidatedBy,'SAVE_HUMAN_INPUT must invalidate the prior prompt.');
}

console.log(JSON.stringify({reservationContract:'PASS',targetSlot:target,reservationRevision:value(r,'RESERVATION_REVISION'),finalState:value(r,'STATUS'),externalResponseTransportBound:true,atomicReservationPromptCommit:true,replacementTransportLifecycle:true}));

// A second response to an already rejected attempt is a normal validation failure,
// not a second terminal-state transition. Its findings must reach the correction prompt.
{
  const p=transportProject('JOB-REJECTED-ATTEMPT-RETRY'),{pr}=reserveAndSave(p),first=blockedEnvelope(p,pr);
  first.challengeNonce='1'.repeat(32);
  const rejected=ingestion.prepare(p,{stage:1,text:JSON.stringify(first),promptRecord:pr});
  assert(!rejected.validation.valid&&rejected.validation.issues.some(x=>x.code==='CHALLENGE_NONCE_MISMATCH'));
  const second=structuredClone(first);second.challengeNonce='2'.repeat(32);
  const retried=ingestion.prepare(rejected.project,{stage:1,text:JSON.stringify(second),promptRecord:pr});
  assert(!retried.validation.valid&&retried.validation.issues.some(x=>x.code==='STALE_OPERATION_RESERVATION')&&retried.validation.issues.some(x=>x.code==='CHALLENGE_NONCE_MISMATCH'));
  assert.equal(value(retried.project.projectData.operationReservations.find(r=>id(r)===pr.operationReservationId),'STATUS'),'REJECTED');
  assert.equal(retried.rawRecord.completeRawResponse,JSON.stringify(second));
  assert.equal(retried.project.projectData.acceptedChanges.length,0);
  const correction=reserveAndSave(retried.project).pr;
  assert.notEqual(correction.instructionId,pr.instructionId);
  assert(correction.prompt.includes('STALE_OPERATION_RESERVATION')&&correction.prompt.includes('CHALLENGE_NONCE_MISMATCH'),'Retry findings did not reach the regenerated correction instruction.');
  for(const terminal of ['ACCEPTED','CANCELLED','SUPERSEDED','EXPIRED_BY_SCOPE']){
    const t=transportProject('JOB-TERMINAL-RESPONSE-'+terminal),{pr:tp,res}=reserveAndSave(t);
    engine.transitionOperationReservation(res,'EXPORTED');engine.transitionOperationReservation(res,'RESPONSE_STAGED');engine.transitionOperationReservation(res,terminal);
    const result=ingestion.prepare(t,{stage:1,text:JSON.stringify(blockedEnvelope(t,tp)),promptRecord:tp});
    assert(!result.validation.valid&&result.validation.issues.some(x=>x.code==='STALE_OPERATION_RESERVATION'));
    assert.equal(value(result.project.projectData.operationReservations.find(r=>id(r)===tp.operationReservationId),'STATUS'),terminal);
    assert.equal(result.project.projectData.acceptedChanges.length,0);
  }
  console.log(JSON.stringify({terminalAttemptRetriesValidated:true,terminalStatePreserved:true,retryCorrectionRegenerated:true}));
}

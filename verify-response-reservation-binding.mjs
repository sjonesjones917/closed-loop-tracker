import fs from 'node:fs';
import vm from 'node:vm';

const assert=(value,message)=>{if(!value)throw new Error(message);};
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])
  vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,promptEngine=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion;

function fixture(jobId){
  const project=core.createBlankState(jobId);engine.ensureShape(project);project.revision=4;
  const preview=structuredClone(project);preview.revision=5;
  const unbound=promptEngine.buildPromptRecord(1,preview,{operation:'COMPLETE'});
  const reservation=engine.reserveOperation(project,{stage:1,operation:'COMPLETE',targetSlot:'STAGE-01:COMPLETE:DEFAULT',packageId:null,promptId:'',scope:unbound.scope,owningTabInstance:'VERIFY-TAB',payload:{purpose:'VERIFY_RESPONSE_BINDING'}}),reservationId=engine.recordId(reservation,'operationReservations');
  const boundState=structuredClone(project);boundState.revision=5;
  const prompt=promptEngine.buildPromptRecord(1,boundState,{operation:'COMPLETE',operationReservation:reservationId});
  engine.registerGeneratedPrompt(project,prompt);engine.bindOperationReservation(project,{reservationId,promptId:prompt.instructionId,packageId:null});project.revision=5;
  const envelope={schema:globalThis.closedLoopWorkflowSchema.RESPONSE_SCHEMA,jobId:project.job.JOB_ID,stage:1,operation:'COMPLETE',packageId:null,operationReservationId:reservationId,challengeNonce:String(engine.recordValue(reservation,'CHALLENGE_NONCE')),promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'blocked-1',kind:'MISSING_CAPABILITY',description:'Required capability is unavailable.',whyBlocking:'The current external operation cannot complete.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};
  return {project,prompt,reservation,envelope};
}

const valid=fixture('JOB-RESERVATION-RESPONSE-VALID'),prepared=ingestion.prepare(valid.project,{stage:1,text:JSON.stringify(valid.envelope),promptRecord:valid.prompt});
assert(prepared.validation.valid,`Valid bound response rejected: ${JSON.stringify(prepared.validation.issues)}`);
const accepted=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'});
const consumed=accepted.project.projectData.operationReservations.find(record=>engine.recordId(record,'operationReservations')===valid.envelope.operationReservationId);
assert(engine.recordValue(consumed,'STATUS')==='ACCEPTED','Accepted response did not consume its operation reservation.');
const retry=ingestion.prepare(accepted.project,{stage:1,text:JSON.stringify(valid.envelope),promptRecord:valid.prompt});
assert(retry.duplicate&&retry.receipt?.receiptId===accepted.receipt?.receiptId,'Exact accepted response retry did not return the existing receipt.');

for(const [name,mutate,code] of [
  ['reservation',envelope=>{envelope.operationReservationId='RESERVATION-WRONG';},'OPERATION_RESERVATION_MISMATCH'],
  ['nonce',envelope=>{envelope.challengeNonce='0'.repeat(32);},'CHALLENGE_NONCE_MISMATCH'],
  ['package',envelope=>{envelope.packageId='PACKAGE-NOT-PERMITTED';},'PACKAGE_ID_NOT_NULL']
]){
  const value=fixture(`JOB-RESERVATION-RESPONSE-${name.toUpperCase()}`),envelope=structuredClone(value.envelope);mutate(envelope);
  const result=ingestion.prepare(value.project,{stage:1,text:JSON.stringify(envelope),promptRecord:value.prompt});
  assert(!result.validation.valid&&result.validation.issues.some(item=>item.code===code),`${name} mismatch did not produce ${code}: ${JSON.stringify(result.validation.issues)}`);
}

const unboundProject=core.createBlankState('JOB-UNBOUND-RESPONSE'),unboundState=structuredClone(unboundProject);unboundState.revision=1;const unboundPrompt=promptEngine.buildPromptRecord(1,unboundState,{operation:'COMPLETE'});unboundProject.projectData.generatedPrompts.push(unboundPrompt);const unboundEnvelope={...fixture('JOB-TEMPLATE').envelope,jobId:unboundProject.job.JOB_ID,operationReservationId:'RESERVATION-FAKE',challengeNonce:'0'.repeat(32),promptIdentity:{instructionId:unboundPrompt.instructionId,bodySha256:unboundPrompt.bodySha256,contractSha256:unboundPrompt.contractSha256,contextSignature:unboundPrompt.contextSignature},scope:unboundPrompt.scope};const unboundResult=ingestion.prepare(unboundProject,{stage:1,text:JSON.stringify(unboundEnvelope),promptRecord:unboundPrompt});
assert(!unboundResult.validation.valid&&unboundResult.validation.issues.some(item=>item.code==='UNBOUND_OPERATION_RESERVATION'),'A response to an unbound preview was accepted.');

const correction=fixture('JOB-RESERVATION-CORRECTION'),correctionPrepared=ingestion.prepare(correction.project,{stage:1,text:JSON.stringify(correction.envelope),promptRecord:correction.prompt}),correctionResult=ingestion.reject(correctionPrepared.project,correctionPrepared.proposal.proposalId,{operator:'VERIFY',reason:'The external response must be corrected.',requestCorrection:true}),correctedReservation=correctionResult.project.projectData.operationReservations.find(record=>engine.recordId(record,'operationReservations')===correction.envelope.operationReservationId),activeCorrectionPrompts=correctionResult.project.projectData.generatedPrompts.filter(record=>Number(record.stage)===1&&!record.invalidatedBy);
assert(engine.recordValue(correctedReservation,'STATUS')==='SUPERSEDED','Correction rejection did not supersede its exact operation reservation.');
assert(/^[a-f0-9]{64}$/i.test(String(engine.recordValue(correctedReservation,'CLOSURE_RECEIPT_SHA256')||'')),'Correction rejection did not create a deterministic reservation-closure receipt.');
assert(activeCorrectionPrompts.length===0,'Correction rejection created or retained an active unbound replacement prompt.');
assert(correctionResult.newPromptRequired===true&&correctionResult.generatedPromptIds.length===0,'Correction rejection did not require the operator path to create a new bound prompt.');
const replacementReservation=engine.reserveOperation(correctionResult.project,{stage:1,operation:'COMPLETE',targetSlot:'STAGE-01:COMPLETE:DEFAULT',packageId:null,scope:engine.currentScope(correctionResult.project),owningTabInstance:'VERIFY-TAB',payload:{purpose:'VERIFY_CORRECTION_RETRY'}});
assert(engine.recordValue(replacementReservation,'STATUS')==='ACTIVE'&&engine.recordId(replacementReservation,'operationReservations')!==correction.envelope.operationReservationId,'Controlled supersession did not permit one new authoritative reservation.');

const abandoned=fixture('JOB-RESERVATION-ABANDON'),abandonedPrepared=ingestion.prepare(abandoned.project,{stage:1,text:JSON.stringify(abandoned.envelope),promptRecord:abandoned.prompt}),abandonedResult=ingestion.abandon(abandonedPrepared.project,abandonedPrepared.proposal.proposalId,{operator:'VERIFY'}),abandonedReservation=abandonedResult.project.projectData.operationReservations.find(record=>engine.recordId(record,'operationReservations')===abandoned.envelope.operationReservationId);
assert(engine.recordValue(abandonedReservation,'STATUS')==='CANCELLED','Abandonment did not cancel its exact operation reservation.');
assert(abandonedResult.project.projectData.generatedPrompts.every(record=>(record.instructionId||record.promptId)!==abandoned.prompt.instructionId||Boolean(record.invalidatedBy)),'Abandonment retained its controlling prompt as active.');

console.log(JSON.stringify({reservationBindingValidated:true,wrongReservationRejected:true,wrongNonceRejected:true,wrongPackageRejected:true,unboundPreviewRejected:true,reservationConsumed:true,exactRetryIdempotent:true,correctionSuperseded:true,unboundCorrectionPromptPrevented:true,abandonmentCancelled:true}));

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore,hash=globalThis.closedLoopHash,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine;
const project=core.createBlankState('JOB-IDENTITY-ACTION-IDEMPOTENCY');
Object.assign(project.job,{CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'NOT APPLICABLE',CURRENT_REQUIREMENTS_VERSION:'NOT APPLICABLE',CURRENT_TEST_SUITE_VERSION:'NOT APPLICABLE',CURRENT_INSTRUCTION_VERSION:'NOT APPLICABLE'});
engine.ensureShape(project);engine.recalculate(project);

function record(collection,stage,id,fields,scope=engine.currentScope(project)){
  const idField=schema.RECORD_SCHEMAS[collection].idField,all={...fields,[idField]:id},value={id,stage,active:true,scope:{...scope},fields:all,...all,source:'APPLICATION_TEST_FIXTURE'};
  value.contentSha256=hash.contentRecordSha256(value,idField);value.recordSha256=hash.recordSha256(value);value.sha256=value.recordSha256;return value;
}
function receipts(type){return project.projectData.commandReceipts.filter(receipt=>receipt.commandType===type);}
function exactRetry(action,type,identity){
  const first=action(),firstId=identity(first),firstReceipts=receipts(type);assert.equal(firstReceipts.length,1,`${type} did not create exactly one authoritative command receipt.`);const firstReceipt=structuredClone(firstReceipts[0]);project.revision=Number(project.revision||0)+1;const retry=action();assert.equal(identity(retry),firstId,`${type} exact sequential retry allocated a new canonical identity.`);assert.equal(receipts(type).length,1,`${type} exact sequential retry created another command receipt.`);assert.deepEqual(receipts(type)[0],firstReceipt,`${type} exact sequential retry did not preserve the original receipt.`);return{first,retry,receipt:firstReceipts[0]};
}
function conflict(action,type){assert.throws(action,error=>error?.code==='IDEMPOTENCY_CONFLICT',`${type} conflicting reuse did not fail with IDEMPOTENCY_CONFLICT.`);}

engine.registerArtifactBytes(project,{stage:17,artifactId:'ARTIFACT-IDEMPOTENCY-CANDIDATE',filename:'candidate.bin',mediaType:'application/octet-stream',byteSize:1,sha256:'a'.repeat(64)});
const candidateResult=exactRetry(()=>engine.freezeCandidate(project,{stage:17,artifactIds:['ARTIFACT-IDEMPOTENCY-CANDIDATE'],operatorLabel:'IDEMPOTENCY-OPERATOR',purpose:'CORRECTED'}),'FREEZE_CANDIDATE',result=>engine.recordId(result.candidate,'candidateFreezes'));
const candidateId=engine.recordId(candidateResult.first.candidate,'candidateFreezes');
assert.equal(engine.recordId(candidateResult.first.iteration,'iterations'),engine.recordId(candidateResult.retry.iteration,'iterations'),'Candidate retry reused the candidate but not its paired iteration.');
conflict(()=>engine.freezeCandidate(project,{stage:17,artifactIds:['ARTIFACT-IDEMPOTENCY-CANDIDATE'],operatorLabel:'CONFLICTING-OPERATOR',purpose:'CORRECTED'}),'FREEZE_CANDIDATE');

project.stages[18].status='COMPLETE';project.stages[18].gate={complete:true,blocked:false,reasons:[]};
const confirmationIterationResult=exactRetry(()=>engine.beginUnchangedConfirmationIteration(project,{candidateId,operatorLabel:'IDEMPOTENCY-OPERATOR'}),'BEGIN_UNCHANGED_CONFIRMATION',iteration=>engine.recordId(iteration,'iterations'));
const confirmationIterationId=engine.recordId(confirmationIterationResult.first,'iterations');
conflict(()=>engine.beginUnchangedConfirmationIteration(project,{candidateId,operatorLabel:'CONFLICTING-OPERATOR'}),'BEGIN_UNCHANGED_CONFIRMATION');

const confirmation=record('confirmationRecords',19,'CONFIRMATION-IDEMPOTENCY',{ITERATION_ID:confirmationIterationId,CANDIDATE_ID:candidateId,DETERMINATION:'SATISFIED'},{...engine.currentScope(project),iterationId:confirmationIterationId,candidateId});
project.projectData.confirmationRecords.push(confirmation);engine.recalculate(project);
const baselineResult=exactRetry(()=>engine.freezeBaseline(project,{artifactIds:['ARTIFACT-IDEMPOTENCY-CANDIDATE'],operatorLabel:'IDEMPOTENCY-OPERATOR'}),'FREEZE_BASELINE',baseline=>engine.recordId(baseline,'baselines'));
const baselineId=engine.recordId(baselineResult.first,'baselines');
conflict(()=>engine.freezeBaseline(project,{artifactIds:['ARTIFACT-IDEMPOTENCY-CANDIDATE'],operatorLabel:'CONFLICTING-OPERATOR'}),'FREEZE_BASELINE');

engine.registerFreshContext(project,{stage:21,externalContextIdentifier:'PRODUCTION-CONTEXT-IDEMPOTENCY',operatorLabel:'IDEMPOTENCY-OPERATOR'});
const productResult=exactRetry(()=>engine.reserveProductExecution(project,{operatorLabel:'IDEMPOTENCY-OPERATOR'}),'RESERVE_PRODUCT_EXECUTION',product=>engine.recordId(product,'products'));
const productId=engine.recordId(productResult.first,'products');
conflict(()=>engine.reserveProductExecution(project,{operatorLabel:'CONFLICTING-OPERATOR'}),'RESERVE_PRODUCT_EXECUTION');

const identityReceipts=['FREEZE_CANDIDATE','BEGIN_UNCHANGED_CONFIRMATION','FREEZE_BASELINE','RESERVE_PRODUCT_EXECUTION'].map(type=>receipts(type)[0]);
assert.equal(new Set(identityReceipts.map(receipt=>receipt.commandId)).size,4,'Identity actions did not use distinct authoritative command receipts.');
assert(identityReceipts.every(receipt=>receipt.expectedRevision+1===receipt.committedRevision&&/^[a-f0-9]{64}$/.test(receipt.idempotencyKey)&&/^[a-f0-9]{64}$/.test(receipt.payloadHash)),'An identity action bypassed the exact revision/payload-bound command receipt contract.');
assert.equal(project.projectData.candidateFreezes.filter(engine.isActiveRecord).length,1,'Candidate exact retry duplicated active candidate state.');
assert.equal(project.projectData.iterations.filter(engine.isActiveRecord).length,2,'Candidate or unchanged-confirmation retry duplicated active iteration state.');
assert.equal(project.projectData.baselines.filter(engine.isActiveRecord).length,1,'Baseline exact retry duplicated active baseline state.');
assert.equal(project.projectData.products.filter(engine.isActiveRecord).length,1,'Product exact retry duplicated active product state.');

console.log(JSON.stringify({
  identityActionIdempotency:true,
  candidateFreezeIdempotent:true,
  unchangedIterationIdempotent:true,
  baselineFreezeIdempotent:true,
  productReservationIdempotent:true,
  conflictingReuseRejected:true,
  singleCommandAuthority:true,
  candidateId,
  confirmationIterationId,
  baselineId,
  productId
}));

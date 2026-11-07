import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createVerifierRuntime} from './verifier-runtime.mjs';
class Event { constructor(type){ this.type=type; } }
const context={console,crypto:webcrypto,TextEncoder,TextDecoder,Blob,structuredClone,performance:{now:()=>0},setTimeout,clearTimeout,URL,Event,dispatchEvent:()=>true};
context.globalThis=context;
createVerifierRuntime(context);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInContext(fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8'),context,{filename:file});
const core=context.closedLoopCore,engine=context.closedLoopWorkflowEngine;
const project=core.createBlankState('JOB-TERMINAL-AUTHORITY-REGRESSION');
engine.ensureShape(project);
assert.equal(engine.humanDeliveryIntent(project),false);
project.stages[28].agentData.DELIVERY_AUTHORIZATION='AUTHORIZED';
project.stages[28].acceptedData.DELIVERY_AUTHORIZATION='AUTHORIZED';
project.stages[28].humanData.DELIVERY_AUTHORIZATION='AUTHORIZED';
project.stages[28].derivedData.DELIVERY_AUTHORIZATION='AUTHORIZED';
assert.equal(engine.humanDeliveryIntent(project),false,'Loose stage data cannot create delivery authority.');
project.projectData.humanDecisions.push({id:'HUMAN-DECISION-INCOMPLETE',active:true,scope:{},fields:{HUMAN_DECISION_ID:'HUMAN-DECISION-INCOMPLETE',PURPOSE:'DELIVERY_INTENT',VALUE:{authorized:true,recipientOrClass:'OPERATOR'},IDENTITY_ASSURANCE:'SELF_ASSERTED',STATUS:'CURRENT'}});
assert.equal(engine.humanDeliveryIntent(project),false,'Incomplete destination binding cannot authorize delivery.');
project.projectData.humanDecisions.length=0;
project.projectData.humanDecisions.push({id:'HUMAN-DECISION-CURRENT',active:true,scope:{},fields:{HUMAN_DECISION_ID:'HUMAN-DECISION-CURRENT',PURPOSE:'DELIVERY_INTENT',VALUE:{authorized:true,recipientOrClass:'OPERATOR',destination:'LOCAL_DOWNLOAD',transferPurpose:'DELIVER_FINAL_ARTIFACTS',transferChannel:'BROWSER_DOWNLOAD',disclosureClassification:'CONFIDENTIAL',permittedTransferCount:1},IDENTITY_ASSURANCE:'SELF_ASSERTED',STATUS:'CURRENT'}});
assert.equal(engine.humanDeliveryIntent(project),false,'Generic human-decision records cannot synthesize dedicated delivery intent.');
const source=fs.readFileSync(new URL('./workflow-engine.js',import.meta.url),'utf8');
assert.doesNotMatch(source,/HUMAN-DELIVERY-\$\{h\.sha256Value/);

// These controls exercise the application terminal command on a deliberately
// blocked project. They do not manufacture completed prerequisites or claim a
// storage, human-delivery or external-transfer boundary.
const hash=context.closedLoopHash,schema=context.closedLoopWorkflowSchema;
const realm=value=>vm.runInContext('(text)=>JSON.parse(text)',context)(JSON.stringify(value));
const terminalProject=core.createBlankState('JOB-TERMINAL-DERIVATION-REGRESSION');
engine.ensureShape(terminalProject);engine.recalculate(terminalProject);
const originalTerminalHash=engine.terminalEvidenceHash(terminalProject);
const terminalRecord=engine.calculateTerminal(terminalProject,{expectedRevision:terminalProject.revision});
const terminalRecordId=engine.recordId(terminalRecord,'deliveryRecords'),terminalRevision=terminalProject.revision;
assert.equal(terminalRecord.fields.DELIVERY_STATE,'BLOCKED','TERMINAL_DERIVATION_MISSING_PREREQUISITES');
assert.equal(terminalRecord.fields.TERMINAL_PROOF_OBLIGATION_SET_HASH,'','TERMINAL_DERIVATION_MISSING_SET_TYPED');
assert.match(terminalRecord.fields.CONTROLLING_REASON,/Stage 27 product release eligibility is not current ACCEPTED/);
assert.equal(terminalRecord.fields.TERMINAL_EVIDENCE_HASH,originalTerminalHash,'TERMINAL_DERIVATION_EXISTING_PREIMAGE_UNCHANGED');
assert.equal(terminalRecord.derivationKey,'stage30.terminal');
assert.equal(terminalRecord.derivationReceipt.derivationId,'closed-loop-derivation/stage30-terminal/1');
assert.equal(terminalRecord.derivationInput.commandObservation.expectedPreconditionRevision,terminalRevision-1);
assert.equal(terminalRecord.derivationInput.commandObservation.committedProjectRevision,terminalRevision);
assert.equal(terminalRecord.derivationInput.commandObservation.allocationReceipt.resultingId,terminalRecordId);
assert.equal(engine.terminalRecordMatches(terminalProject,terminalRecord,engine.terminalPrerequisites(terminalProject)),true,'TERMINAL_DERIVATION_OWN_COMMIT_CURRENT');
engine.recalculate(terminalProject);
assert.equal(engine.terminalRecordMatches(terminalProject,terminalRecord,engine.terminalPrerequisites(terminalProject)),true,'TERMINAL_DERIVATION_OWN_RECALC_CURRENT');
assert.equal(engine.recordId(engine.calculateTerminal(terminalProject,{expectedRevision:terminalRevision}), 'deliveryRecords'),terminalRecordId,'TERMINAL_DERIVATION_IDEMPOTENT');
assert.equal(terminalProject.revision,terminalRevision);
assert.equal(engine.gate(30,terminalProject).complete,false,'TERMINAL_DERIVATION_VALID_BLOCKED_IS_NOT_COMPLETE');
const receiptCases=[];
const resign=record=>{record.fields.DELIVERY_RECORD_HASH=hash.sha256Value(realm(Object.fromEntries(Object.entries(record.fields).filter(([key])=>key!=='DELIVERY_RECORD_HASH'))));record.DELIVERY_RECORD_HASH=record.fields.DELIVERY_RECORD_HASH;engine.refreshRecordHashes(record,'deliveryRecords');};
for(const [caseId,mutate]of [
 ['missing-receipt',(p,r)=>{delete r.derivationReceipt;}],
 ['wrong-receipt-output',(p,r)=>{r.derivationReceipt.outputSha256='0'.repeat(64);}],
 ['missing-retained-input',(p,r)=>{delete r.derivationInput;}],
 ['forged-semantic-reason',(p,r)=>{r.fields.CONTROLLING_REASON=r.CONTROLLING_REASON='All current terminal prerequisites are simultaneously satisfied.';resign(r);}],
 ['forged-authorization',(p,r)=>{r.fields.DELIVERY_STATE=r.DELIVERY_STATE='AUTHORIZED';resign(r);}],
 ['changed-command-event',(p,r)=>{r.fields.EVENT_SEQUENCE=r.EVENT_SEQUENCE=Number(p.projectData.eventSequence||0)+1;resign(r);}],
 ['missing-allocation',(p,r)=>{p.projectData.allocationReceipts=p.projectData.allocationReceipts.filter(row=>row.resultingId!==r.id);}],
 ['duplicate-allocation',(p,r)=>{p.projectData.allocationReceipts.push(engine.clone(p.projectData.allocationReceipts.find(row=>row.resultingId===r.id)));}]
]){
 const p=engine.clone(terminalProject),r=engine.records(p,'deliveryRecords').find(row=>row.id===terminalRecordId);mutate(p,r);
 assert.equal(engine.terminalRecordMatches(p,r,engine.terminalPrerequisites(p)),false,'TERMINAL_DERIVATION_REJECTS_'+caseId);
 assert.equal(engine.gate(30,p).complete,false,'TERMINAL_DERIVATION_GATE_REJECTS_'+caseId);
 receiptCases.push({caseId,current:false,gateComplete:false});
 if(caseId==='forged-semantic-reason'){
  const prior=Number(p.revision),corrected=engine.calculateTerminal(p,{expectedRevision:prior});
  assert.notEqual(corrected.id,r.id,'TERMINAL_DERIVATION_FORGED_REASON_NOT_REUSED');
  assert.equal(corrected.fields.DELIVERY_STATE,'BLOCKED');
  assert.match(corrected.fields.CONTROLLING_REASON,/Stage 27 product release eligibility is not current ACCEPTED/);
  assert.equal(p.revision,prior+1);assert.equal(r.active,false);assert.equal(r.recordSha256,hash.recordSha256(r),'TERMINAL_DERIVATION_SUPERSEDED_CANONICAL_HASH');
 }
 if(caseId==='forged-authorization'){
  p.release.authorization='AUTHORIZED';p.release.authorizedArtifactIds=['FORGED'];engine.recalculate(p);
  assert.equal(p.release.authorization,'NOT AUTHORIZED','TERMINAL_DERIVATION_STALE_PRESENTATION_WITHDRAWN');
  assert.deepEqual(Array.from(p.release.authorizedArtifactIds),[]);assert.equal(r.recordSha256,hash.recordSha256(r),'TERMINAL_DERIVATION_WITHDRAWN_CANONICAL_HASH');
  assert.notEqual(engine.operationalNextAction(p,30).actionType,'EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS');
 }
}
// Re-sign the general derivation receipt coherently, so these negatives detect
// the registered allocation owner's rejection, not an unrelated stale digest.
for(const [caseId,change]of [
 ['coherent-malformed-allocation-schema',receipt=>{receipt.schema='unregistered-allocation-receipt/1';}],
 ['coherent-allocation-tuple-disagreement',receipt=>{receipt.targetSlot='different-from-retained-input-tuple';}]
]){
 const p=engine.clone(terminalProject),r=p.projectData.deliveryRecords.find(row=>row.id===terminalRecordId),allocation=p.projectData.allocationReceipts.find(row=>row.resultingId===r.id);change(allocation);
 const observation=engine.clone(r.derivationInput.commandObservation);observation.allocationReceipt=engine.clone(allocation);observation.allocationReceiptSha256=hash.sha256Value(allocation);
 const calculation=engine.terminalCalculation(p,engine.terminalPrerequisites(p),observation);
 r.derivationInput=calculation.canonicalInput;r.derivationReceipt=calculation.derivationReceipt;engine.refreshRecordHashes(r,'deliveryRecords');
 assert.equal(schema.validateApplicationDerivationReceipt(r.derivationReceipt,realm({derivationKey:'stage30.terminal',canonicalInput:calculation.canonicalInput,sourceRecordHashes:calculation.canonicalInput.sourceBinding.records,output:calculation.fields})).valid,true,'TERMINAL_ALLOCATION_FAULT_HAS_COHERENT_DERIVATION_'+caseId);
 assert.equal(engine.terminalRecordMatches(p,r,engine.terminalPrerequisites(p)),false,'TERMINAL_ALLOCATION_REGISTERED_OWNER_REJECTS_'+caseId);
 receiptCases.push({caseId,current:false,gateComplete:engine.gate(30,p).complete,coherentDerivationReceipt:true});
}
const sourceProject=engine.clone(terminalProject),release=engine.recordReleaseDetermination(sourceProject);
assert.equal(release.fields.DETERMINATION,'BLOCKED');
const sourceRecord=engine.calculateTerminal(sourceProject,{expectedRevision:sourceProject.revision});
const boundSource=sourceRecord.derivationReceipt.sourceRecordHashes.find(row=>row.family==='releaseRecords'&&row.id===release.id);
assert(boundSource,'TERMINAL_DERIVATION_ACTUAL_RELEASE_SOURCE');
assert.equal(boundSource.sha256,hash.recordSha256(release),'TERMINAL_DERIVATION_ACTUAL_CANONICAL_SOURCE_HASH');
release.syntheticRetainedSourceNote='Isolated changed canonical source; no new release authority.';engine.refreshRecordHashes(release,'releaseRecords');
assert.equal(engine.terminalPrerequisites(sourceProject).complete,false);
assert.equal(engine.terminalRecordMatches(sourceProject,sourceRecord,engine.terminalPrerequisites(sourceProject)),false,'TERMINAL_DERIVATION_CHANGED_SOURCE_STALE');

const invalidatedTerminalProject=engine.clone(terminalProject);engine.invalidateDownstream(invalidatedTerminalProject,29,'Isolated terminal retirement integrity control.');
const invalidatedTerminalRecord=invalidatedTerminalProject.projectData.deliveryRecords.find(row=>row.id===terminalRecordId);
assert.equal(invalidatedTerminalRecord.active,false);assert.equal(invalidatedTerminalRecord.recordSha256,hash.recordSha256(invalidatedTerminalRecord),'TERMINAL_DERIVATION_INVALIDATED_CANONICAL_HASH');
console.log(JSON.stringify({terminalHumanAuthority:'PASS',agentStageDataRejected:true,incompleteDecisionRejected:true,genericDestinationBoundDecisionRejected:true,syntheticAuthorizationRemoved:true,terminalDerivation:{passed:true,boundary:'Production terminal calculation/currentness/gate/continuation helpers on explicitly blocked synthetic state; not storage or external delivery.',originalTerminalHash,registeredReceipt:true,ownCommitCurrent:true,ownRecalculateCurrent:true,idempotent:true,blockedDoesNotComplete:true,typedMissingProofSet:true,changedCanonicalSourceRejected:true,retiredCanonicalHashes:true,receiptCases}}));

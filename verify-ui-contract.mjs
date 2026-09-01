import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app-core.js','utf8');
const runtime=fs.readFileSync('test-runtime.js','utf8');
const store=fs.readFileSync('project-store.js','utf8');
const buildIdentity='runtime-20260901-controlling-amendment-63';

assert(html.includes('.expandable-prompt{height:280px;max-height:280px}'),'Collapsed prompt must preserve the approved 280px height and max-height.');
assert(html.includes('.expandable-prompt.expanded{height:auto;max-height:none}'),'Expanded prompt must restore automatic height.');

const runtimeUrls=[...html.matchAll(/<script defer src="[^"]+\?v=([^"]+)"/g)].map(match=>match[1]);
assert.equal(runtimeUrls.length,9,'Every runtime script must carry the shared build identity.');
assert.deepEqual([...new Set(runtimeUrls)],[buildIdentity],'Mixed runtime script build identities are prohibited.');
assert(app.includes(`const RUNTIME_BUILD_ID='${buildIdentity}'`),'The application runtime expectation does not match the shell build identity.');
assert(runtime.includes(`const RUNTIME_BUILD_ID='${buildIdentity}'`),'The Test IR runtime build identity does not match the shell build identity.');

for(const token of [
  'bindOperatorControlLabels',
  'verifyRuntimeBuildGraph',
  'attachment mismatch',
  'blocked capability',
  'independence violation',
  'Advanced proof, applicability, epistemic, and independence details',
  'Stage 27 — product release eligibility',
  'Delivery is not yet authorized',
  'Current AUTHORIZED DELIVERY_RECORD',
  "requireStructuredReleaseAction(27,'CALCULATE_RELEASE')",
  "requireStructuredReleaseAction(28,'ATTACH_REQUIRED_FILES')"
])assert(app.includes(token),`Missing operator UI contract: ${token}`);

assert(!app.includes('delivery identity authorized'),'Stage 28 must never be represented as final delivery authorization.');

for(const token of [
  'id="create-delivery-record"',
  'async function createCurrentDeliveryRecord()',
  "action.actionType!=='CREATE_DELIVERY_RECORD'",
  'projectStore.createDeliveryRecordPersistent({jobId:current.job.JOB_ID,expectedProjectRevision:expectedRevision})',
  "deliveryState!=='AUTHORIZED'",
  'terminal=engine.terminalDeliveryState(current)',
  'delivery=terminal.authorized?deliveryCandidate:null',
  'Current DELIVERY_RECORD (authorization not effective)',
  'id="current-delivery-record" tabindex="-1"',
  'commitResponseWithStagedAttachments',
  'stageProposalAttachments',
  'projectStore.stageArtifact',
  "migrationDisposition:'HISTORICAL_NON_OPERATIONAL'",
  "p.activeStage=1"
])assert(app.includes(token),`Missing atomic UI/storage integration: ${token}`);
assert(!/\bengine\.recordDelivery\s*\(/.test(app),'The UI must not bypass the project-store byte read-back authority when creating a DELIVERY_RECORD.');
for(const token of ['async function createDeliveryRecordPersistent(','DELIVERY_ARTIFACT_READBACK_MISMATCH','closed-loop-delivery-byte-readback/1','holdIndexedTransactionOpen','artifactReadBackProof'])assert(store.includes(token),`Missing Stage 30 delivery byte-readback storage contract: ${token}`);
for(const token of ['replay?.replayed===true&&replay.receipt&&unchanged','IDEMPOTENT_REPLAY_RECEIPT_MISMATCH','receiptMatches.length>1','DELIVERY_IDEMPOTENCY_CONTENT_CONFLICT','Number(replayReceipt.committedRevision)>currentRevision'])assert(store.includes(token),`Missing post-CAS exact-retry or conflicting-reuse storage contract: ${token}`);

const saveFlow=app.slice(app.indexOf('async function savePromptRecord('),app.indexOf('function downloadRawRecovery'));
const reservationIndex=saveFlow.indexOf('reserveOperationPersistent'),promptBuildIndex=saveFlow.indexOf('buildPromptRecord'),promptCommitIndex=saveFlow.indexOf('registerGeneratedPrompt');
assert(reservationIndex>=0&&promptBuildIndex>reservationIndex&&promptCommitIndex>promptBuildIndex,'Every external instruction must persist its exact operation reservation before prompt generation and registration.');
assert(saveFlow.includes('promptIdentity:{instructionId:reservedInstructionId}'),'The operation reservation must receive the deterministic future prompt identity.');
assert(saveFlow.includes('assertCurrentBoundPrompt(candidate,reservation)'),'The exact generated prompt must be checked against its persisted reservation before registration.');

const packageFlow=app.slice(app.indexOf('async function downloadExecutionPackage()'),app.indexOf('function projectManagementMarkup'));
const boundPromptIndex=packageFlow.indexOf('savePromptRecord(stage)'),packageIndex=packageFlow.indexOf('createExecutionPackage');
assert(boundPromptIndex>=0&&packageIndex>boundPromptIndex,'External package flow must save the reservation-bound prompt before building the package.');
assert(packageFlow.includes('operationReservationId:reservationId'),'Execution package must use the exact persisted operation reservation.');

for(const token of ['operationSelection','runSelection','id="operation-picker"','id="run-slot-picker"'])assert(!app.includes(token),`Manual technical operation/run selection is prohibited: ${token}`);
for(const token of ['engine.currentStageOperation','CONTROLLING INSTRUCTION NOT YET RESERVED','function currentOrphanedReservation(','id="resume-operation-reservation"','id="cancel-operation-reservation"','async function resolveCurrentOrphanedReservation(','resumeOperationReservationPersistent','cancelOperationReservationPersistent'])assert(app.includes(token),`Missing application-derived operation/reservation UI contract: ${token}`);
for(const token of ["stage===5&&op==='APPLICABILITY_REVIEW'","stage===6&&op==='SEMANTIC_REVIEW'","function authorContextOperation(n)","function contextBoundOperation(n)","function currentOperationContext(n)","record.source==='HUMAN_REVIEWER_CONTEXT'","Register author/compiler context","purpose=stage===2&&stage2ContextCount>0?'REVIEWER':reviewer?'REVIEWER':author?'AUTHOR':'GENERAL'","contextMissing=contextBoundOperation(n)&&!currentOperationContext(n)"])assert(app.includes(token),`Missing Stage 05/06 author/reviewer context UI routing contract: ${token}`);
const routeFlow=app.slice(app.indexOf('function currentOperationRoute('),app.indexOf('function selectedOperation('));
assert(routeFlow.indexOf('allowed.includes(actionOperation)')>=0&&routeFlow.indexOf('allowed.includes(actionOperation)')<routeFlow.indexOf('engine.currentStageOperation'),'The exact structured current action must control semantic and iterative suboperation selection before a generic stage fallback.');
for(const token of ['promptProjectRevision=commandRevision+2','stage:normalizedStage','operation:normalizedOperation','targetSlot:normalizedTarget','promptIdentity:normalizedPromptIdentity','scope:normalizedScope','packageManifestHash'])assert(store.includes(token),`Persistent orphan resume must rebind the same reservation to the exact future instruction/package lane: ${token}`);
const resumeFlow=app.slice(app.indexOf('async function resolveCurrentOrphanedReservation('),app.indexOf('async function createCurrentDeliveryRecord()'));
const preservedProposalIndex=resumeFlow.indexOf("proposal.resumedReservationId||''"),replacementPromptIndex=resumeFlow.indexOf('await savePromptRecord(lane.stage)');
assert(preservedProposalIndex>=0&&replacementPromptIndex>preservedProposalIndex,'Resume must restore a preserved valid pending proposal before considering any replacement prompt.');
assert(resumeFlow.includes("focusOperatorTarget('#proposal-heading')"),'A preserved pending proposal must render and receive operator focus after resume.');

const acceptanceFlow=app.slice(app.indexOf('async function acceptPendingProposal()'),app.indexOf('async function rejectPendingProposal'));
assert(acceptanceFlow.indexOf('stageProposalAttachments')<acceptanceFlow.indexOf('commitResponseWithStagedAttachments'),'Declared attachment bytes must be staged before atomic response acceptance.');
assert(!acceptanceFlow.includes('commitResponseWithStagedAttachments')||acceptanceFlow.includes('if(stagedArtifactIds.length)'),'Optional absent attachments must preserve the no-attachment canonical CAS path.');

assert(!app.includes('IMPORTED-STAGE-01-'),'Legacy Stage 01 must not be synthesized as accepted /3 canonical work.');
assert(!app.includes('engine.recordMigratedAcceptedChange(p'),'Legacy accepted responses must remain historical and non-operational.');
assert(app.includes("for(let n=1;n<=30;n++)Object.assign(p.stages[n],{status:'NOT STARTED'"),'All imported legacy stage records must restart as current /3 NOT STARTED stages.');

console.log(JSON.stringify({uiContractVerified:true,buildIdentity,promptHeight:280,runtimeScripts:runtimeUrls.length,deliveryCas:true,packageReservationBinding:true,operationAuthority:true,orphanReservationRecovery:true,attachmentAtomicity:true,legacyImportFailClosed:true}));

import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {reservedReleasePrerequisiteFixture,acceptReservedSemanticFixture,reviewReleaseAuditsFixture,assertReleaseSemanticPrerequisites} from './test-release-semantic-fixture.mjs';

if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
if(!globalThis.Event)globalThis.Event=class Event{constructor(type){this.type=type;}};
if(!globalThis.dispatchEvent)globalThis.dispatchEvent=()=>true;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const engine=globalThis.closedLoopWorkflowEngine;
const hash=globalThis.closedLoopHash;
const schema=globalThis.closedLoopWorkflowSchema,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion;
const runtime={core,engine,schema,prompts,ingestion};

function fixture(jobId,{semanticPrerequisites=true}={}){
  const p=semanticPrerequisites?reservedReleasePrerequisiteFixture(runtime,jobId):core.createBlankState(jobId);
  engine.ensureShape(p);p.activeStage=27;p.job.CURRENT_STAGE='27';
  if(!semanticPrerequisites)for(let stage=1;stage<=26;stage++){p.stages[stage].status='COMPLETE';p.stages[stage].gate={complete:true,blocked:false,reasons:[]};}
  // The scope reference is intentionally not a completed product execution.
  for(const product of engine.recordsForCurrentScope(p,'products'))product.completionState='PENDING';
  p.projectData.acceptedChanges.push({changeId:`CHANGE-${jobId}`,stage:27,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'ADVISORY_REVIEW',scope:engine.currentScope(p)});
  return p;
}
const assertSemanticPrerequisites=p=>assertReleaseSemanticPrerequisites(runtime,p);
const reviewAudits=p=>reviewReleaseAuditsFixture(runtime,p);

// The former fixture cannot manufacture completed prerequisite authority by
// assigning stage status. This control fails at the actual shared gate reason.
{
  const p=fixture('JOB-STAGE27-MISSING-SEMANTIC-PREREQUISITES',{semanticPrerequisites:false});
  engine.recordReleaseDetermination(p);p.stages[26].status='COMPLETE';p.stages[26].gate={complete:true,blocked:false,reasons:[]};
  const gate=engine.gate(27,p);assert.equal(gate.complete,false,'RELEASE_SEMANTIC_PREREQUISITE_ORACLE: bare completed flags passed');
  assert.deepEqual(gate.reasons,['Current semantic author provenance and reviewed targets are required.']);
}

function injectRelease(p,{determination='ACCEPTED',releaseEvidenceSha256='fabricated'}={}){
  const binding=engine.releaseBinding(p),id='RELEASE-INJECTED';
  const fields={RELEASE_ID:id,DETERMINATION:determination,PRODUCT_ID:binding.productId,BASELINE_ID:binding.baselineId,CONTROLLING_EVIDENCE:releaseEvidenceSha256};
  const record={id,stage:27,active:true,scope:engine.currentScope(p),source:'APPLICATION_DERIVATION',derivationKey:'stage27.release',releaseEvidenceSha256,fields:{...fields},...fields};
  engine.refreshRecordHashes(record,'releaseRecords');
  p.projectData.releaseRecords.push(record);
  return record;
}

// Invalid fixture 1: a favorable release record that contradicts the current application
// calculation must not satisfy Stage 27 merely because its enum is valid.
{
  const p=fixture('JOB-STAGE27-FABRICATED');
  assertSemanticPrerequisites(p);
  const binding=engine.releaseBinding(p);
  assert.equal(binding.metrics.productOk,false,'Missing product evidence must normalize to boolean false.');
  assert.equal(binding.determination,'BLOCKED','The intentionally incomplete fixture must calculate BLOCKED.');
  assert.equal(binding.evidenceDigest,hash.sha256Value({metrics:binding.metrics,inputReferences:binding.metrics.inputReferences}),'Release evidence digest is not the canonical current binding.');
  injectRelease(p,{determination:'ACCEPTED',releaseEvidenceSha256:binding.evidenceDigest});
  assert.equal(engine.gate(27,p).complete,false,'Stage 27 accepted a release record that contradicts the current application calculation.');
  assert.deepEqual(engine.gate(27,p).reasons,['The current release determination is not bound to the exact application-calculated release evidence, disposition, product, and baseline identities.']);
  assertSemanticPrerequisites(p);
  p.projectData.releaseRecords.length=0;
  const calculated=engine.recordReleaseDetermination(p);
  assert.equal(calculated.DETERMINATION,'BLOCKED','CALCULATE_RELEASE must fail closed as BLOCKED instead of throwing on incomplete evidence.');
  assert.equal(calculated.source,'APPLICATION_DERIVATION');
  assert.equal(calculated.derivationKey,'stage27.release');
  assert.equal(calculated.releaseEvidenceSha256,engine.releaseBinding(p).evidenceDigest,'Calculated release record is not bound to current evidence.');
}

// Invalid fixture 2: a previously application-calculated release becomes stale after any
// release-evidence dependency changes and must remain rejected until the same mechanism recalculates it.
{
  const p=fixture('JOB-STAGE27-STALE');
  assertSemanticPrerequisites(p);
  const auditInputScope=engine.clone(engine.recordsForCurrentScope(p,'processAudits').at(-1).scope);
  const first=engine.recordReleaseDetermination(p);
  p.stages[26].status='COMPLETE';p.stages[26].gate={complete:true,blocked:false,reasons:[]};
  assert.equal(engine.gate(27,p).complete,true,'Current application-derived release binding failed Stage 27.');
  assert.equal(engine.recordReleaseDetermination(p).RELEASE_ID,first.RELEASE_ID,'Exact release recalculation retry is not idempotent.');
  const beforeHash=first.releaseEvidenceSha256;
  // Reauthor/review the current audit through real custody. Reintroduce the
  // formerly calculated record as a controlled stale-input counterexample;
  // missing predecessor authority or automatic invalidation cannot mask it.
  p.stages[25].status='COMPLETE';p.stages[25].gate={complete:true,blocked:false,reasons:[]};
  for(const[key,field]of Object.entries({baselineId:'CURRENT_BASELINE_ID',productId:'CURRENT_PRODUCT_ID',productVersion:'CURRENT_PRODUCT_VERSION',deliveryCandidateSetId:'CURRENT_DELIVERY_CANDIDATE_SET_ID'}))p.job[field]=auditInputScope[key];
  for(const product of engine.recordsForCurrentScope(p,'products'))product.completionState='COMPLETED';
  acceptReservedSemanticFixture(runtime,p,26,'COMPLETE',null,Object.fromEntries(['baselineId','productId','productVersion','deliveryCandidateSetId'].map(key=>[key,auditInputScope[key]])));
  reviewAudits(p);assertSemanticPrerequisites(p);
  for(const product of engine.recordsForCurrentScope(p,'products'))product.completionState='PENDING';
  const mutated=engine.releaseBinding(p);
  assert.notEqual(mutated.evidenceDigest,beforeHash,'The dependency mutation did not change release evidence.');
  const stale=engine.clone(first);stale.active=true;stale.validity='CURRENT';delete stale.invalidatedBy;delete stale.supersededBy;
  stale.scope={...engine.currentScope(p),releaseId:first.RELEASE_ID,productId:mutated.productId,baselineId:mutated.baselineId};engine.refreshRecordHashes(stale,'releaseRecords');
  p.projectData.releaseRecords=p.projectData.releaseRecords.filter(record=>record.id!==stale.id);p.projectData.releaseRecords.push(stale);p.job.CURRENT_RELEASE_ID=stale.id;
  const staleGate=engine.gate(27,p);assert.equal(staleGate.complete,false,'Stale release evidence passed Stage 27 after dependency mutation.');
  assert.deepEqual(staleGate.reasons,['The current release determination is not bound to the exact application-calculated release evidence, disposition, product, and baseline identities.']);
  p.stages[26].status='COMPLETE';p.stages[26].gate={complete:true,blocked:false,reasons:[]};
  const repaired=engine.recordReleaseDetermination(p);
  p.stages[26].status='COMPLETE';p.stages[26].gate={complete:true,blocked:false,reasons:[]};
  assert.notEqual(repaired.RELEASE_ID,first.RELEASE_ID,'Changed release evidence reused the stale release identity.');
  assert.equal(repaired.releaseEvidenceSha256,engine.releaseBinding(p).evidenceDigest,'Recalculated release record is not current-bound.');
  assert.equal(engine.gate(27,p).complete,true,'The same Stage 27 mechanism did not progress after exact recalculation.');
}

// ADVISORY_REVIEW is optional and non-gating. Stage 27 must route to application-owned release
// calculation when no advisory response exists. Pass the exact stage to the real structured-action API.
{
  const p=fixture('JOB-STAGE27-NO-ADVISORY');
  p.projectData.acceptedChanges=p.projectData.acceptedChanges.filter(change=>Number(change.stage)!==27);
  assertSemanticPrerequisites(p);
  const next=engine.operationalNextAction(p,27);
  const explanation=String(next.explanation||'');
  assert.equal(next.actionType,'CALCULATE_RELEASE','Optional Stage 27 advisory review incorrectly gates application release calculation.');
  assert.doesNotMatch(explanation,/advisory[^.]*accepted/i,'Stage 27 operator text falsely claims the optional advisory review was accepted when none exists.');
  assert.match(explanation,/application-owned/i,'Stage 27 operator text must identify application ownership of release calculation.');
  assert.match(explanation,/optional[^.]*not required[^.]*non-gating/i,'Stage 27 operator text must explicitly preserve optional, not-required, non-gating advisory semantics.');
  const calculated=engine.recordReleaseDetermination(p);
  assert.equal(calculated.DETERMINATION,'BLOCKED');
  assert.equal(calculated.releaseEvidenceSha256,engine.releaseBinding(p).evidenceDigest);
}

// The structured next-action path is derived UI state. Passing a later stage through the shared
// wrapper must not mutate canonical proof obligations merely to construct a label.
{
  const p=fixture('JOB-STAGE27-NEXT-ACTION-PURITY');
  p.projectData.proofObligations.push({
    id:'PROOF-ACTION-PURITY',stage:6,active:true,validity:'CURRENT',scope:engine.currentScope(p),
    fields:{PROOF_OBLIGATION_ID:'PROOF-ACTION-PURITY'}
  });
  const before=hash.stableStringify(p.projectData.proofObligations);
  engine.operationalNextAction(p,30);
  assert.equal(hash.stableStringify(p.projectData.proofObligations),before,'Structured next-action derivation mutated canonical proof obligations.');
}

// Release precedence is exact: sufficient mandatory refutation controls over simultaneous blockers.
assert.equal(engine.selectReleaseDisposition({refutedMandatoryCount:1,blockingConditionCount:9}),'REJECTED');
assert.equal(engine.selectReleaseDisposition({refutedMandatoryCount:0,blockingConditionCount:1}),'BLOCKED');
assert.equal(engine.selectReleaseDisposition({refutedMandatoryCount:0,blockingConditionCount:0}),'ACCEPTED');

console.log(JSON.stringify({stage27ReleaseBinding:'PASS',invalidFixtures:2,repairedFixtures:2,releasePrecedence:'PASS',idempotency:'PASS',optionalAdvisoryNonGating:'PASS',truthfulOperatorText:'PASS',applicationOwnedActionText:'PASS',structuredActionPurity:'PASS',digest:hash.sha256Value('stage27-release-binding-v5')}));

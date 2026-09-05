import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
if(!globalThis.Event)globalThis.Event=class Event{constructor(type){this.type=type;}};
if(!globalThis.dispatchEvent)globalThis.dispatchEvent=()=>true;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const engine=globalThis.closedLoopWorkflowEngine;
const hash=globalThis.closedLoopHash;

function fixture(jobId){
  const p=core.createBlankState(jobId);
  engine.ensureShape(p);
  p.activeStage=27;
  p.job.CURRENT_STAGE='27';
  for(let stage=1;stage<=26;stage++){
    p.stages[stage].status='COMPLETE';
    p.stages[stage].gate={complete:true,blocked:false,reasons:[]};
  }
  p.projectData.acceptedChanges.push({
    changeId:`CHANGE-${jobId}`,
    stage:27,
    status:'COMMITTED',
    responseType:'DATA_PROPOSAL',
    operation:'ADVISORY_REVIEW',
    scope:engine.currentScope(p)
  });
  return p;
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
  const binding=engine.releaseBinding(p);
  assert.equal(binding.metrics.productOk,false,'Missing product evidence must normalize to boolean false.');
  assert.equal(binding.determination,'BLOCKED','The intentionally incomplete fixture must calculate BLOCKED.');
  assert.equal(binding.evidenceDigest,hash.sha256Value({metrics:binding.metrics,inputReferences:binding.metrics.inputReferences}),'Release evidence digest is not the canonical current binding.');
  injectRelease(p,{determination:'ACCEPTED',releaseEvidenceSha256:binding.evidenceDigest});
  assert.equal(engine.gate(27,p).complete,false,'Stage 27 accepted a release record that contradicts the current application calculation.');
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
  const first=engine.recordReleaseDetermination(p);
  p.stages[26].status='COMPLETE';p.stages[26].gate={complete:true,blocked:false,reasons:[]};
  assert.equal(engine.gate(27,p).complete,true,'Current application-derived release binding failed Stage 27.');
  assert.equal(engine.recordReleaseDetermination(p).RELEASE_ID,first.RELEASE_ID,'Exact release recalculation retry is not idempotent.');
  const beforeHash=first.releaseEvidenceSha256;
  const audit={id:'PROCESS-AUDIT-RELEASE-CHANGE',stage:26,active:true,scope:engine.currentScope(p),fields:{PROCESS_AUDIT_ID:'PROCESS-AUDIT-RELEASE-CHANGE',PROCESS_DETERMINATION:'SATISFIED'},PROCESS_AUDIT_ID:'PROCESS-AUDIT-RELEASE-CHANGE',PROCESS_DETERMINATION:'SATISFIED'};
  engine.refreshRecordHashes(audit,'processAudits');
  p.projectData.processAudits.push(audit);
  const mutated=engine.releaseBinding(p);
  assert.notEqual(mutated.evidenceDigest,beforeHash,'The dependency mutation did not change release evidence.');
  assert.equal(engine.gate(27,p).complete,false,'Stale release evidence passed Stage 27 after dependency mutation.');
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
  p.projectData.acceptedChanges.length=0;
  const next=engine.operationalNextAction(p,27);
  assert.equal(next.actionType,'CALCULATE_RELEASE','Optional Stage 27 advisory review incorrectly gates application release calculation.');
  const calculated=engine.recordReleaseDetermination(p);
  assert.equal(calculated.DETERMINATION,'BLOCKED');
  assert.equal(calculated.releaseEvidenceSha256,engine.releaseBinding(p).evidenceDigest);
}

// Release precedence is exact: sufficient mandatory refutation controls over simultaneous blockers.
assert.equal(engine.selectReleaseDisposition({refutedMandatoryCount:1,blockingConditionCount:9}),'REJECTED');
assert.equal(engine.selectReleaseDisposition({refutedMandatoryCount:0,blockingConditionCount:1}),'BLOCKED');
assert.equal(engine.selectReleaseDisposition({refutedMandatoryCount:0,blockingConditionCount:0}),'ACCEPTED');

console.log(JSON.stringify({stage27ReleaseBinding:'PASS',invalidFixtures:2,repairedFixtures:2,releasePrecedence:'PASS',idempotency:'PASS',optionalAdvisoryNonGating:'PASS',digest:hash.sha256Value('stage27-release-binding-v2')}));

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
  const id='RELEASE-INJECTED';
  const fields={RELEASE_ID:id,DETERMINATION:determination,PRODUCT_ID:'UNKNOWN',BASELINE_ID:'UNKNOWN',CONTROLLING_EVIDENCE:releaseEvidenceSha256};
  const record={id,stage:27,active:true,scope:engine.currentScope(p),source:'APPLICATION_DERIVATION',derivationKey:'stage27.release',releaseEvidenceSha256,fields:{...fields},...fields};
  engine.refreshRecordHashes(record,'releaseRecords');
  p.projectData.releaseRecords.push(record);
  return record;
}

// Invalid fixture 1: a favorable release record whose determination and evidence digest do not
// match the current application calculation must never satisfy the real Stage 27 gate.
{
  const p=fixture('JOB-STAGE27-FABRICATED');
  const metrics=engine.releaseMetrics(p);
  assert.equal(metrics.determination,'BLOCKED','The intentionally incomplete fixture must calculate BLOCKED.');
  injectRelease(p,{determination:'ACCEPTED',releaseEvidenceSha256:'0'.repeat(64)});
  const gate=engine.gate(27,p);
  assert.equal(gate.complete,false,'Stage 27 accepted a release record that contradicts the current application calculation.');
  p.projectData.releaseRecords.length=0;
  const calculated=engine.recordReleaseDetermination(p);
  assert.equal(calculated.DETERMINATION,'BLOCKED','CALCULATE_RELEASE must fail closed as BLOCKED instead of throwing on incomplete release evidence.');
  assert.equal(engine.currentReleaseBinding(p).current,true,'Application-calculated BLOCKED release is not current-bound.');
}

// Invalid fixture 2: even a previously application-calculated release becomes stale after a
// release-evidence dependency changes. It must not remain current merely because its enum is valid.
{
  const p=fixture('JOB-STAGE27-STALE');
  const first=engine.recordReleaseDetermination(p);
  const beforeHash=first.releaseEvidenceSha256;
  const audit={
    id:'PROCESS-AUDIT-RELEASE-CHANGE',stage:26,active:true,scope:engine.currentScope(p),
    fields:{PROCESS_AUDIT_ID:'PROCESS-AUDIT-RELEASE-CHANGE',PROCESS_DETERMINATION:'UNDETERMINED'},
    PROCESS_AUDIT_ID:'PROCESS-AUDIT-RELEASE-CHANGE',PROCESS_DETERMINATION:'UNDETERMINED'
  };
  engine.refreshRecordHashes(audit,'processAudits');
  p.projectData.processAudits.push(audit);
  const currentMetrics=engine.releaseMetrics(p);
  const currentHash=hash.sha256Value({metrics:currentMetrics,inputReferences:currentMetrics.inputReferences});
  assert.notEqual(currentHash,beforeHash,'The mutation fixture did not change release evidence.');
  const gate=engine.gate(27,p);
  assert.equal(gate.complete,false,'Stage 27 remained complete after its release-evidence dependency changed without recalculation.');
  const repaired=engine.recordReleaseDetermination(p);
  assert.notEqual(repaired.releaseEvidenceSha256,beforeHash,'Release recalculation did not supersede stale evidence.');
  assert.equal(repaired.DETERMINATION,currentMetrics.determination,'Repaired release record does not match the application calculation.');
  assert.equal(engine.currentReleaseBinding(p).current,true,'Release recalculation did not restore the current release binding.');
  p.stages[26].status='COMPLETE';p.stages[26].gate={complete:true,blocked:false,reasons:[]};
  assert.equal(engine.gate(27,p).complete,true,'The same Stage 27 gate did not progress after exact release recalculation with its isolated Stage 26 prerequisite restored.');
  assert.equal(engine.recordReleaseDetermination(p).id,repaired.id,'Exact release recalculation retry is not idempotent.');
}

// Precedence is fixed: sufficient mandatory refutation controls over simultaneous blockers.
assert.equal(engine.selectReleaseDisposition({refutedMandatoryCount:1,blockingConditionCount:4}),'REJECTED');
assert.equal(engine.selectReleaseDisposition({refutedMandatoryCount:0,blockingConditionCount:1}),'BLOCKED');
assert.equal(engine.selectReleaseDisposition({refutedMandatoryCount:0,blockingConditionCount:0}),'ACCEPTED');

console.log(JSON.stringify({stage27ReleaseBinding:'PASS',invalidFixtures:2,repairedFixtures:1,releasePrecedence:'PASS',idempotency:'PASS'}));

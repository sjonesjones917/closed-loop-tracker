import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js']){
  vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
}

const core=globalThis.closedLoopCore;
const engine=globalThis.closedLoopWorkflowEngine;
const hash=globalThis.closedLoopHash;
const scopeFor=project=>engine.currentScope(project);
const record=(project,fields)=>({id:fields.RELEASE_ID||'RELEASE-FIXTURE',stage:27,active:true,scope:scopeFor(project),fields,...fields,source:'APPLICATION_DERIVATION',derivationKey:'stage27.release'});
const acceptedChange={changeId:'CHANGE-27-FIXTURE',stage:27,status:'COMMITTED',responseType:'DATA_PROPOSAL'};

function fixture(){
  const project=core.createBlankState('STAGE27-BINDING');
  engine.ensureShape(project);
  project.projectData.acceptedChanges.push(acceptedChange);
  engine.recalculate(project);
  project.stages[26].status='COMPLETE';
  return project;
}

{
  const project=fixture();
  const binding=engine.releaseBinding(project);
  project.projectData.releaseRecords.push(record(project,{
    RELEASE_ID:'RELEASE-INVALID-FAVORABLE',
    PRODUCT_ID:binding.productId,
    BASELINE_ID:binding.baselineId,
    DETERMINATION:'ACCEPTED',
    CONTROLLING_EVIDENCE:binding.evidenceDigest
  }));
  project.projectData.releaseRecords[0].releaseEvidenceSha256=binding.evidenceDigest;
  assert.equal(binding.determination,'BLOCKED');
  assert.equal(engine.gate(27,project).complete,false,'contradictory favorable release record passed Stage 27');
}

{
  const project=fixture();
  const first=engine.recordReleaseDetermination(project);
  project.stages[26].status='COMPLETE';
  assert.equal(engine.releaseMetrics(project).determination,'BLOCKED');
  assert.equal(first.DETERMINATION,'BLOCKED');
  assert.equal(first.source,'APPLICATION_DERIVATION');
  assert.equal(first.derivationKey,'stage27.release');
  const initialGate=engine.gate(27,project);
  assert.equal(initialGate.complete,true,`current-bound blocked release failed Stage 27: ${initialGate.reasons.join(' | ')}`);
  assert.equal(engine.recordReleaseDetermination(project).RELEASE_ID,first.RELEASE_ID,'exact release retry was not idempotent');

  project.projectData.processAudits.push({
    id:'PROCESS-AUDIT-STALE',
    stage:26,
    active:true,
    scope:scopeFor(project),
    fields:{PROCESS_DETERMINATION:'SATISFIED'},
    PROCESS_DETERMINATION:'SATISFIED'
  });
  assert.equal(engine.gate(27,project).complete,false,'stale release evidence passed Stage 27');
  project.stages[26].status='COMPLETE';
  const recalculated=engine.recordReleaseDetermination(project);
  project.stages[26].status='COMPLETE';
  assert.notEqual(recalculated.RELEASE_ID,first.RELEASE_ID,'changed release evidence reused the stale release identity');
  const recalculatedGate=engine.gate(27,project);
  assert.equal(recalculatedGate.complete,true,`recalculated current-bound release failed Stage 27: ${recalculatedGate.reasons.join(' | ')}`);
}

assert.equal(engine.selectReleaseDisposition({refutedMandatoryCount:1,blockingConditionCount:9}),'REJECTED');
assert.equal(engine.selectReleaseDisposition({refutedMandatoryCount:0,blockingConditionCount:1}),'BLOCKED');
assert.equal(engine.selectReleaseDisposition({refutedMandatoryCount:0,blockingConditionCount:0}),'ACCEPTED');

console.log(JSON.stringify({stage27ReleaseBinding:'PASS',precedence:'PASS',digest:hash.sha256Value('stage27-release-binding')}));

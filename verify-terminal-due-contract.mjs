import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine;
const p=core.createBlankState('JOB-TERMINAL-DUE-CONTRACT');
p.job.CURRENT_INPUT_VERSION='INPUT-v001';
engine.ensureShape(p);engine.recalculate(p);

const perRunTest={fields:{VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:12,REQUIRED_BY_STAGE:12,PER_RUN_REQUIRED:true,TARGET_AVAILABILITY_CONDITION:{kind:'CURRENT_PREPRODUCT_RUN'}}};
assert.equal(engine.testDueState(p,perRunTest,11,{id:'RUN-1'}).dueNow,false,'A per-run proof became due before its earliest/required stage.');
assert.equal(engine.testDueState(p,perRunTest,12,{id:'RUN-1'}).dueNow,true,'A current per-run proof did not become due at Stage 12.');
const finalProductTest={fields:{VERIFICATION_PHASE:'FINAL_PRODUCT_DETERMINISTIC',EARLIEST_EXECUTABLE_STAGE:22,REQUIRED_BY_STAGE:22,PER_RUN_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{kind:'CURRENT_PRODUCT'}}};
assert.equal(engine.testDueState(p,finalProductTest,12,{id:'RUN-1'}).dueNow,false,'A final-product proof was required during preproduct Stage 12.');

p.stages[28].humanData={DELIVERY_AUTHORIZATION:'AUTHORIZED'};
assert.equal(engine.humanDeliveryIntent(p),false,'Loose Stage 28 text synthesized human delivery authority.');

const scope=engine.currentScope(p);
p.job.CURRENT_DELIVERY_CANDIDATE_SET_ID='DELIVERY-CANDIDATE-000001';
p.projectData.deliveryCandidateSets.push({id:'DELIVERY-CANDIDATE-000001',active:true,scope,fields:{DELIVERY_CANDIDATE_SET_ID:'DELIVERY-CANDIDATE-000001',ARTIFACT_IDS:['ARTIFACT-1'],AUTHORIZED_FILENAMES:['product.bin'],STATUS:'CURRENT'}});
p.projectData.humanDecisions.push({id:'HUMAN-DECISION-000001',active:true,scope,recordSha256:'a'.repeat(64),fields:{HUMAN_DECISION_ID:'HUMAN-DECISION-000001',PURPOSE:'CAPTURE_DELIVERY_INTENT',VALUE:{recipientOrClass:'operator',destination:'local device',purpose:'deliver requested product',channel:'browser export',disclosureClassification:'INTERNAL',authorizedArtifactIds:['ARTIFACT-1'],authorizedFilenames:['product.bin']},IDENTITY_ASSURANCE:'SELF_ASSERTED',STATUS:'CURRENT'}});
assert.equal(engine.humanDeliveryIntent(p),true,'A current destination-bound human decision was not recognized.');
assert.equal(engine.currentDeliveryIntent(p)?.id,'HUMAN-DECISION-000001');

p.projectData.backupCheckpoints.push({id:'CHECKPOINT-000001',active:true,scope,fields:{CHECKPOINT_ID:'CHECKPOINT-000001',CUSTODY_STATE:'BACKUP_PACKAGE_GENERATED',STATUS:'CURRENT'}});
assert.equal(engine.currentPreDeliveryCheckpoint(p),null,'An in-origin/generated checkpoint incorrectly satisfied the pre-delivery export prerequisite.');
p.projectData.backupCheckpoints[0].fields.CUSTODY_STATE='BACKUP_EXPORT_ACTION_COMPLETED';
p.projectData.backupCheckpoints[0].CUSTODY_STATE='BACKUP_EXPORT_ACTION_COMPLETED';
assert.equal(engine.currentPreDeliveryCheckpoint(p)?.id,'CHECKPOINT-000001','Exported checkpoint custody did not satisfy the minimum terminal prerequisite.');

assert.equal(engine.responsibleStageForMutation('deliveryCandidateSets'),25);
assert.equal(engine.responsibleStageForMutation('deliveryRecords'),30);
assert.equal(engine.responsibleStageForMutation('deliveryAttempts'),30);

console.log(JSON.stringify({dueStageContract:'PASS',prematureFinalProductProofRejected:true,destinationBoundHumanDecisionRequired:true,generatedBackupInsufficient:true,deliveryResponsibleStage:30}));

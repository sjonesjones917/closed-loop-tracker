import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js']){
  vm.runInThisContext(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{filename:file});
}

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const promptEngine=globalThis.closedLoopPromptEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
assert.ok(core&&schema&&engine&&promptEngine&&ingestion,'runtime modules must load');

const project=core.createBlankState('JOB-CONFORMANCE-TEST');
engine.ensureShape(project);
engine.recalculate(project);

assert.equal(project.contractProfileId,'closed-loop-completion-profile/1');
assert.equal(project.job.CONTRACT_PROFILE_ID,'closed-loop-completion-profile/1');
assert.ok(['BLOCKED','AWAITING_HUMAN_INPUT','PROPOSAL_PENDING_REVIEW','RESPONSE_STAGED','AWAITING_EXTERNAL_RESPONSE','READY_FOR_NEXT_OPERATION','WORKFLOW_COMPLETE'].includes(project.job.CURRENT_STATE),`illegal CURRENT_STATE ${project.job.CURRENT_STATE}`);
assert.ok(['INCOMPLETE','BLOCKED','COMPLETE'].includes(project.job.JOB_RECORD_STATUS),`illegal JOB_RECORD_STATUS ${project.job.JOB_RECORD_STATUS}`);
for(const key of ['CURRENT_ITERATION','CURRENT_SOURCE_SET_VERSION','CURRENT_RESEARCH_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION','CURRENT_INSTRUCTION_VERSION','CURRENT_CANDIDATE_ID','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_PRODUCT_VERSION','CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID','CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID','LATEST_EVIDENCE_REFERENCE']){
  assert.equal(project.job[key],null,`${key} must be null before its owner creates a current record`);
}

for(const action of ['EXPORT_PROMPT_FILE','EXPORT_EXECUTION_PACKAGE','SELECT_RESPONSE_JSON_FILE','SELECT_RETURNED_FILES','REVIEW_FILE_RESPONSE_PROPOSAL','EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','RECORD_DELIVERY_EVIDENCE']){
  assert.ok(engine.ACTION_TYPES.includes(action),`missing structured action ${action}`);
}
assert.ok(!engine.ACTION_TYPES.includes('PASTE_FINAL_JSON'),'PASTE_FINAL_JSON cannot be a canonical operator action');

const descriptor=promptEngine.responseContractDescriptor(1,'COMPLETE');
for(const key of ['schema','contractProfileId','jobId','stage','operation','promptIdentity','packageId','operationReservationId','challengeNonce','scope','responseType','humanInputRequests','humanAuthorityCandidates','stageData','records','evidence','unresolved','warnings','attachments']){
  assert.ok(descriptor.envelope.topLevelKeys.includes(key),`response envelope is missing ${key}`);
}
assert.deepEqual(descriptor.envelope.topLevelKeys,ingestion.TOP_LEVEL_KEYS,'prompt and ingestion must consume the same closed response envelope');

console.log('controlling contract regression: PASS');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const context={
  console,
  TextEncoder,
  TextDecoder,
  crypto:webcrypto,
  structuredClone,
  Event:class Event{constructor(type){this.type=type;}},
  dispatchEvent(){},
  addEventListener(){},
  removeEventListener(){},
  setTimeout,
  clearTimeout
};
context.globalThis=context;
vm.createContext(context);
for(const file of ['workbook.js','hash.js','workflow-schema.js']){
  vm.runInContext(fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8'),context,{filename:file});
}
const core=context.closedLoopCore;
const schema=context.closedLoopWorkflowSchema;
assert.ok(core&&schema,'Runtime schema graph must load.');

const expectedNames=[
  'JOB_TITLE','JOB_OWNER','EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY','REQUIRED_OUTPUT_FORMAT',
  'DEADLINE_OR_TEMPORAL_SCOPE','DESIRED_SOURCE_COUNT','KNOWN_AUTHORITATIVE_SOURCES','AVAILABLE_TOOLS','PROHIBITED_ACTIONS',
  'EXPLICIT_USER_REQUIREMENTS','JOB_ID','CONTRACT_PROFILE_ID','DATE_OPENED','CURRENT_ITERATION','CURRENT_STAGE','CURRENT_STATE',
  'CURRENT_INPUT_VERSION','CURRENT_SOURCE_SET_VERSION','CURRENT_RESEARCH_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION',
  'CURRENT_INSTRUCTION_VERSION','CURRENT_CANDIDATE_ID','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_PRODUCT_VERSION',
  'CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID',
  'CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID','CURRENT_BLOCKERS','NEXT_REQUIRED_ACTION',
  'LATEST_EVIDENCE_REFERENCE','INPUT_SET_HASH_OR_MANIFEST','JOB_RECORD_STATUS','STATUS_EVIDENCE','EXACT_DELIVERABLE_REQUESTED',
  'ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS'
].sort();
assert.deepEqual(Array.from(Object.keys(schema.JOB_FIELDS).sort()),expectedNames,'Section 15 job field registry must be exact and complete.');

const nullable=new Set([
  'JOB_TITLE','JOB_OWNER','SUPPLIED_MATERIALS_INVENTORY','REQUIRED_OUTPUT_FORMAT','DEADLINE_OR_TEMPORAL_SCOPE','DESIRED_SOURCE_COUNT',
  'KNOWN_AUTHORITATIVE_SOURCES','AVAILABLE_TOOLS','PROHIBITED_ACTIONS','EXPLICIT_USER_REQUIREMENTS','CURRENT_ITERATION',
  'CURRENT_SOURCE_SET_VERSION','CURRENT_RESEARCH_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION','CURRENT_INSTRUCTION_VERSION',
  'CURRENT_CANDIDATE_ID','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_PRODUCT_VERSION','CURRENT_DELIVERY_CANDIDATE_SET_ID',
  'CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID','CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION',
  'CURRENT_DELIVERY_ID','LATEST_EVIDENCE_REFERENCE'
]);
for(const name of expectedNames)assert.equal(schema.JOB_FIELDS[name].nullable,nullable.has(name),`${name} nullability must match Section 15.`);

assert.equal(schema.JOB_FIELDS.DESIRED_SOURCE_COUNT.valueType,'INTEGER');
assert.equal(schema.JOB_FIELDS.NEXT_REQUIRED_ACTION.valueType,'OBJECT');
assert.equal(schema.JOB_FIELDS.CURRENT_BLOCKERS.valueType,'OBJECT');
assert.equal(schema.JOB_FIELDS.INPUT_SET_CONTENTS.valueType,'STRING');
assert.deepEqual(Array.from(schema.JOB_FIELDS.CURRENT_STATE.enumValues),[
  'BLOCKED','AWAITING_HUMAN_INPUT','PROPOSAL_PENDING_REVIEW','RESPONSE_STAGED','AWAITING_EXTERNAL_RESPONSE','READY_FOR_NEXT_OPERATION','WORKFLOW_COMPLETE'
]);
assert.deepEqual(Array.from(schema.JOB_FIELDS.JOB_RECORD_STATUS.enumValues),['INCOMPLETE','BLOCKED','COMPLETE']);
assert.equal(schema.JOB_FIELDS.CONTRACT_PROFILE_ID.producer,'APPLICATION');
assert.equal(schema.JOB_FIELDS.CONTRACT_PROFILE_ID.nullable,false);

const blank=core.createBlankState('JOB-SECTION15-REGRESSION');
assert.equal(blank.job.CONTRACT_PROFILE_ID,'closed-loop-completion-profile/1');
assert.equal(blank.job.CURRENT_STATE,'AWAITING_HUMAN_INPUT');
assert.equal(blank.job.JOB_RECORD_STATUS,'INCOMPLETE');
assert.deepEqual(JSON.parse(JSON.stringify(blank.job.CURRENT_BLOCKERS)),{blockerIds:[]});
assert.equal(blank.job.CURRENT_ITERATION,null);
assert.equal(blank.job.CURRENT_SOURCE_SET_VERSION,null);
assert.equal(blank.job.CURRENT_RESEARCH_VERSION,null);
assert.equal(blank.job.CURRENT_REQUIREMENTS_VERSION,null);
assert.equal(blank.job.CURRENT_TEST_SUITE_VERSION,null);
assert.equal(blank.job.CURRENT_INSTRUCTION_VERSION,null);
assert.equal(blank.job.CURRENT_CANDIDATE_ID,null);
assert.equal(blank.job.CURRENT_BASELINE_ID,null);
assert.equal(blank.job.CURRENT_PRODUCT_ID,null);
assert.equal(blank.job.CURRENT_PRODUCT_VERSION,null);
assert.equal(blank.job.CURRENT_DELIVERY_CANDIDATE_SET_ID,null);
assert.equal(blank.job.CURRENT_REVIEW_VERSION,null);
assert.equal(blank.job.CURRENT_RECONCILED_REVIEW_VERSION,null);
assert.equal(blank.job.CURRENT_RELEASE_ID,null);
assert.equal(blank.job.CURRENT_HASH_REVIEW_ID,null);
assert.equal(blank.job.CURRENT_EVIDENCE_CHAIN_VERSION,null);
assert.equal(blank.job.CURRENT_DELIVERY_ID,null);
assert.equal(blank.job.LATEST_EVIDENCE_REFERENCE,null);
assert.equal(typeof blank.job.NEXT_REQUIRED_ACTION,'object');
assert.equal(blank.job.NEXT_REQUIRED_ACTION.actionType,'CONTINUE_AGENT_CONVERSATION');

const recalculated=core.createBlankState('JOB-SECTION15-DERIVATION');
vm.runInContext(fs.readFileSync(new URL('./workflow-engine.js',import.meta.url),'utf8'),context,{filename:'workflow-engine.js'});
context.closedLoopWorkflowEngine.ensureShape(recalculated);
context.closedLoopWorkflowEngine.recalculate(recalculated);
assert.ok(['BLOCKED','AWAITING_HUMAN_INPUT','PROPOSAL_PENDING_REVIEW','RESPONSE_STAGED','AWAITING_EXTERNAL_RESPONSE','READY_FOR_NEXT_OPERATION','WORKFLOW_COMPLETE'].includes(recalculated.job.CURRENT_STATE),'Recalculation must keep CURRENT_STATE inside its closed enum.');
assert.ok(['INCOMPLETE','BLOCKED','COMPLETE'].includes(recalculated.job.JOB_RECORD_STATUS),'Recalculation must keep JOB_RECORD_STATUS inside its closed enum.');
assert.equal(typeof recalculated.job.CURRENT_BLOCKERS,'object');
assert.deepEqual(Object.keys(recalculated.job.CURRENT_BLOCKERS),['blockerIds']);
assert.ok(Array.isArray(recalculated.job.CURRENT_BLOCKERS.blockerIds));

console.log(JSON.stringify({section15JobContract:'PASS',fields:expectedNames.length}));
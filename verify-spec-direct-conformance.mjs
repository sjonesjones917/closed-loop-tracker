import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema;

// Permanent regressions derived directly from the controlling specification supplied by the owner.
// These assertions deliberately do not trust existing acceptance tests or historical implementation behavior.
assert.equal(core.STAGES[29].title,'PRESERVE FAILURES PERMANENTLY AND CLOSE DELIVERY','Stage 30 visible name must include terminal delivery closure.');
assert.equal(core.STAGES[29].role,'Permanent defect-registry and terminal-delivery custodian','Stage 30 role must include terminal delivery custody.');
for(const field of ['DELIVERY_CANDIDATE_SET_ID'])assert(core.STAGES[24].fields.includes(field),`Stage 25 missing ${field}.`);
for(const field of ['DELIVERY_CANDIDATE_SET_ID'])assert(core.STAGES[27].fields.includes(field),`Stage 28 missing ${field}.`);
for(const field of ['PRE_DELIVERY_CHECKPOINT_ID','DELIVERY_ID','DELIVERY_STATE','DELIVERY_RECORD_HASH','DELIVERY_ATTEMPT_RECORDS'])assert(core.STAGES[29].fields.includes(field),`Stage 30 missing ${field}.`);

const expectedJobFields=['JOB_ID','CONTRACT_PROFILE_ID','DATE_OPENED','CURRENT_ITERATION','CURRENT_STAGE','CURRENT_STATE','CURRENT_INPUT_VERSION','CURRENT_SOURCE_SET_VERSION','CURRENT_RESEARCH_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION','CURRENT_INSTRUCTION_VERSION','CURRENT_CANDIDATE_ID','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_PRODUCT_VERSION','CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID','CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID','CURRENT_BLOCKERS','NEXT_REQUIRED_ACTION','LATEST_EVIDENCE_REFERENCE','INPUT_SET_HASH_OR_MANIFEST','JOB_RECORD_STATUS','STATUS_EVIDENCE'];
for(const name of expectedJobFields)assert(schema.JOB_FIELDS[name],`Canonical Job FIELD_REGISTRY entry missing: ${name}.`);
assert.equal(schema.JOB_FIELDS.CONTRACT_PROFILE_ID.producer,schema.PRODUCER.APPLICATION);

const fresh=core.createBlankState('JOB-DIRECT-SPEC');
assert.equal(fresh.job.CONTRACT_PROFILE_ID,'closed-loop-completion-profile/1');
assert.equal(fresh.job.CURRENT_SOURCE_SET_VERSION,null);
assert.equal(fresh.job.CURRENT_RESEARCH_VERSION,null);
assert.equal(fresh.job.CURRENT_REQUIREMENTS_VERSION,null);
assert.equal(fresh.job.CURRENT_TEST_SUITE_VERSION,null);
assert.equal(fresh.job.CURRENT_INSTRUCTION_VERSION,null);
assert.equal(fresh.job.CURRENT_CANDIDATE_ID,null);
assert.equal(fresh.job.CURRENT_BASELINE_ID,null);
assert.equal(fresh.job.CURRENT_PRODUCT_ID,null);
assert.equal(fresh.job.CURRENT_PRODUCT_VERSION,null);
assert.equal(fresh.job.CURRENT_DELIVERY_CANDIDATE_SET_ID,null);
assert.equal(fresh.job.CURRENT_REVIEW_VERSION,null);
assert.equal(fresh.job.CURRENT_RECONCILED_REVIEW_VERSION,null);
assert.equal(fresh.job.CURRENT_RELEASE_ID,null);
assert.equal(fresh.job.CURRENT_HASH_REVIEW_ID,null);
assert.equal(fresh.job.CURRENT_EVIDENCE_CHAIN_VERSION,null);
assert.equal(fresh.job.CURRENT_DELIVERY_ID,null);
assert(['BLOCKED','AWAITING_HUMAN_INPUT','PROPOSAL_PENDING_REVIEW','RESPONSE_STAGED','AWAITING_EXTERNAL_RESPONSE','READY_FOR_NEXT_OPERATION','WORKFLOW_COMPLETE'].includes(fresh.job.CURRENT_STATE),'CURRENT_STATE must use the closed specification enum.');
assert(['INCOMPLETE','BLOCKED','COMPLETE'].includes(fresh.job.JOB_RECORD_STATUS),'JOB_RECORD_STATUS must use the closed specification enum.');

const preProfile=structuredClone(fresh);delete preProfile.job.CONTRACT_PROFILE_ID;
const migrated=schema.migrateProjectToCurrent(preProfile);
assert.notEqual(migrated.job?.CONTRACT_PROFILE_ID,'closed-loop-completion-profile/1','A current /3 object missing the contract profile must not be silently promoted merely by setting the profile identity.');

console.log(JSON.stringify({directSpecConformance:'PASS',stage30DeliveryClosure:true,jobFieldRegistryClosure:true,currentPointerNullability:true,contractProfileBoundary:true},null,2));

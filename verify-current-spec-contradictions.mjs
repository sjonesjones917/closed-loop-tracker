import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const workbook=fs.readFileSync('workbook.js','utf8');
const schema=fs.readFileSync('workflow-schema.js','utf8');
const ingestion=fs.readFileSync('response-ingestion.js','utf8');

assert.match(workbook,/CONTRACT_PROFILE_ID='closed-loop-completion-profile\/1'/);
for(const token of ['CURRENT_ITERATION:null','CURRENT_SOURCE_SET_VERSION:null','CURRENT_RESEARCH_VERSION:null','CURRENT_CANDIDATE_ID:null','CURRENT_PRODUCT_VERSION:null','CURRENT_DELIVERY_CANDIDATE_SET_ID:null','CURRENT_REVIEW_VERSION:null','CURRENT_RECONCILED_REVIEW_VERSION:null','CURRENT_RELEASE_ID:null','CURRENT_HASH_REVIEW_ID:null','CURRENT_EVIDENCE_CHAIN_VERSION:null','CURRENT_DELIVERY_ID:null','LATEST_EVIDENCE_REFERENCE:null']) assert.ok(workbook.includes(token),token);
assert.ok(workbook.includes("CURRENT_STATE:'AWAITING_HUMAN_INPUT'"));
assert.ok(workbook.includes("JOB_RECORD_STATUS:'INCOMPLETE'"));
assert.doesNotMatch(workbook,/CURRENT_(?:ITERATION|SOURCE_SET_VERSION|REQUIREMENTS_VERSION|TEST_SUITE_VERSION|INSTRUCTION_VERSION):''/);
assert.doesNotMatch(workbook,/CURRENT_(?:BASELINE_ID|PRODUCT_ID):'NONE'/);
for(const name of ['CONTRACT_PROFILE_ID','CURRENT_RESEARCH_VERSION','CURRENT_CANDIDATE_ID','CURRENT_PRODUCT_VERSION','CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID','CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID']) assert.ok(schema.includes("'"+name+"'"),name);
assert.match(schema,/BLOCKED','AWAITING_HUMAN_INPUT','PROPOSAL_PENDING_REVIEW','RESPONSE_STAGED','AWAITING_EXTERNAL_RESPONSE','READY_FOR_NEXT_OPERATION','WORKFLOW_COMPLETE/);
assert.match(schema,/INCOMPLETE','BLOCKED','COMPLETE/);
assert.doesNotMatch(ingestion,/normalizeSmartJsonDelimiters/);
assert.doesNotMatch(ingestion,/SMART_JSON_DELIMITERS/);
assert.match(ingestion,/UNSAFE_SMART_QUOTES/);

console.log('Current-spec contradiction regressions: PASS');

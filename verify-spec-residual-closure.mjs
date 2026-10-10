import {createVerifierRuntime} from './verifier-runtime.mjs';
import {checkedVerifier,AGGREGATE_TIMEOUT_MS} from './verify-conformance-regressions.mjs';
import {currentDeferredMatrixReceipt} from './verify-deferred-proof-handoff.mjs';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});
const schema=globalThis.closedLoopWorkflowSchema;
const DEFERRED_MATRIX_TIMEOUT_MS=330*60*1000;
assert(schema,'workflow schema did not load');
const source=fs.readFileSync('workflow-schema.js','utf8');
assert.doesNotMatch(source,/HASHES_RECORDED_WHERE_PRACTICAL/,'Obsolete Stage 10 best-effort hashing contract must not exist.');
assert.doesNotMatch(source,/POST_CORRECTION_SUCCESSES_PROVEN/,'Stage 15 must not claim later post-correction success inside its own stage contract.');
const controllingOps=['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'];
assert.deepEqual([...schema.TEST_IR.operations],controllingOps,'Schema Test IR operation universe must equal the controlling v1 primitive set.');
assert(schema.STAGE_FIELDS[10].ALL_FROZEN_COMPONENT_BYTES_HASHED,'Stage 10 exact byte-hash field missing.');
assert(!schema.STAGE_FIELDS[10].HASHES_RECORDED_WHERE_PRACTICAL,'Obsolete Stage 10 field leaked into runtime registry.');
assert(!schema.STAGE_FIELDS[15].POST_CORRECTION_SUCCESSES_PROVEN,'Obsolete Stage 15 field leaked into runtime registry.');
console.log(JSON.stringify({specResidualClosure:'PASS',testIrOperations:controllingOps.length}));

// The complete deferred matrix owns its receipt. An in-process import records
// only the wrapper and makes the collector repeat this same composite proof.
// An exact current receipt from the separate bounded CI job owns this proof.
// Direct/local verification still executes the complete matrix when no receipt
// is present; a stale or corrupt receipt fails instead of falling back.
if(!currentDeferredMatrixReceipt())await checkedVerifier(process.execPath,[fileURLToPath(new URL('./verify-due-stage-timing.mjs',import.meta.url))],{stdio:'inherit',timeout:DEFERRED_MATRIX_TIMEOUT_MS});
await import('./verify-ten-independent-runs.mjs');
await checkedVerifier(process.execPath,[fileURLToPath(new URL('./verify-independent-run-verification.mjs',import.meta.url))],{stdio:'inherit',timeout:AGGREGATE_TIMEOUT_MS});
await checkedVerifier(process.execPath,[fileURLToPath(new URL('./verify-cross-run-comparison.mjs',import.meta.url))],{stdio:'inherit',timeout:AGGREGATE_TIMEOUT_MS});
await import('./verify-root-cause-regressions.mjs');
await import('./verify-root-cause-correction.mjs');
await import('./verify-corrected-iteration.mjs');
await import('./verify-delivery-candidate-representation.mjs');

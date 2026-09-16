import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {selectExecutionReport} from './execution-report.mjs';

// Use the real producer, including its later independent reports. The former
// last-object consumer loses this attachment proof despite successful tests.
const stdout = execFileSync(process.execPath, ['verify-ingestion.mjs'], {encoding:'utf8',maxBuffer:64*1024*1024});
const reports = stdout.trim().split(/\n(?=\{)/).map(text => JSON.parse(text));
const slots = selectExecutionReport(stdout, 'attachmentSlotMapping');
assert.equal(slots.attachmentSlotMapping, 'PASS');
assert.equal(slots.explicitSlotsRequired, true);
assert.equal(slots.atomicReturnedArtifactPromotion, true);
assert.equal(slots.pickerOrderIndependent, true);
assert.equal(slots.filenameOnlyRejected, true);
assert.equal(slots.slotMutationsDetected, 7);
assert.equal(slots.failedResponseRepairedWithoutReselect, true);
assert.equal(selectExecutionReport(stdout, 'acceptedPropositionPersistence').acceptedPropositionPersistence, true);
const encode = values => values.map(value => JSON.stringify(value, null, 2)).join('\n')+'\n';
assert.deepEqual(selectExecutionReport(encode([...reports].reverse()), 'attachmentSlotMapping'), slots);
assert.throws(() => selectExecutionReport(encode(reports.filter(row => !Object.hasOwn(row,'attachmentSlotMapping'))), 'attachmentSlotMapping'), /found 0/);
assert.throws(() => selectExecutionReport(encode([...reports, slots]), 'attachmentSlotMapping'), /found 2/);
assert.throws(() => selectExecutionReport(stdout+'\n{broken', 'attachmentSlotMapping'), SyntaxError);
assert.equal(selectExecutionReport(encode([{attachmentSlotMapping:'FAIL',explicitSlotsRequired:false}]), 'attachmentSlotMapping').explicitSlotsRequired, false);

// Replay the exact former consumer as a targeted implementation fault.
const oldConsumer = text => JSON.parse(text.trim().split(/\n(?=\{)/).at(-1));
assert.throws(() => assert.equal(oldConsumer(stdout).explicitSlotsRequired,true), assert.AssertionError);
console.log(JSON.stringify({executionReportSelection:'PASS',synthetic:true,realProducer:'verify-ingestion.mjs',reportCount:reports.length,attachmentProofPreserved:true,reportOrderIndependent:true,missingRejected:true,duplicateRejected:true,corruptRejected:true,failedObservationNotPromoted:true,lastObjectFaultDetected:true}));

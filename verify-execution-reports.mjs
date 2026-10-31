import {checkedVerifier} from './verify-conformance-regressions.mjs';
import {readExecutionReceipts} from './verification-evidence.mjs';
import assert from 'node:assert/strict';
import {selectExecutionReport} from './execution-report.mjs';

const encode = values => values.map(value => JSON.stringify(value, null, 2)).join('\n')+'\n';
async function ingestionReportSource({receiptDirectory=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS,readReceipts=readExecutionReceipts,run=checkedVerifier}={}){
  // The evidence owner validates the original producer stream, complete
  // assertions and exact current source/specification/catalog/runtime identity.
  // Invalid evidence propagates its error; only absent evidence executes again.
  const receipt=receiptDirectory?readReceipts(receiptDirectory).get('verify-ingestion.mjs'):null;
  if(receipt)return {stdout:encode(receipt.reports),inputSource:'VALIDATED_RECEIPT_REPORTS_REENCODED'};
  // Standalone use retains the shared runner's finite owning-suite deadline.
  return {stdout:await run(process.execPath,['verify-ingestion.mjs'],{encoding:'utf8',maxBuffer:64*1024*1024}),inputSource:'DIRECT_PRODUCER_STDOUT'};
}
async function verifyReceiptRouting(){
  // Controlled dependencies test routing only. These synthetic records are
  // never written as verification receipts or claimed as producer execution.
  const reports=[{syntheticRoutingControl:true},{laterReport:true}],directory='SYNTHETIC_RECEIPT_DIRECTORY';let calls=0;
  const reused=await ingestionReportSource({receiptDirectory:directory,readReceipts:value=>{assert.equal(value,directory);return new Map([['verify-ingestion.mjs',{reports}]]);},run:async()=>{calls++;throw new Error('EXECUTION_REPORT_REUSE_ORACLE: current evidence must not start a duplicate owner');}});
  assert.equal(calls,0);assert.equal(reused.inputSource,'VALIDATED_RECEIPT_REPORTS_REENCODED');assert.equal(reused.stdout,encode(reports));
  for(const receiptDirectory of [undefined,directory]){
    calls=0;const missing=await ingestionReportSource({receiptDirectory:receiptDirectory??null,readReceipts:()=>new Map(),run:async(command,args,options)=>{calls++;assert.equal(command,process.execPath);assert.deepEqual(args,['verify-ingestion.mjs']);assert.equal(Object.hasOwn(options,'timeout'),false,'EXECUTION_REPORT_SHARED_DEADLINE_ORACLE');return 'DIRECT_SYNTHETIC_CONTROL';}});
    assert.equal(calls,1,'EXECUTION_REPORT_MISSING_OWNER_ONCE_ORACLE');assert.equal(missing.stdout,'DIRECT_SYNTHETIC_CONTROL');assert.equal(missing.inputSource,'DIRECT_PRODUCER_STDOUT');
  }
  for(const reason of ['stale source/specification/catalog/runtime receipt','receipt content digest mismatch','failed/incomplete receipt']){
    calls=0;const rejected=new Error('EXECUTED_EVIDENCE_ORACLE: '+reason);
    await assert.rejects(()=>ingestionReportSource({receiptDirectory:directory,readReceipts:()=>{throw rejected;},run:async()=>{calls++;}}),error=>error===rejected,'EXECUTION_REPORT_INVALID_RECEIPT_PROPAGATION_ORACLE');assert.equal(calls,0,'EXECUTION_REPORT_INVALID_RECEIPT_NO_RETRY_ORACLE');
  }
  return {syntheticRoutingControls:true,receiptAuthenticationClaimed:false,currentReceiptAvoidsDuplicateOwner:true,absentReceiptExecutesOnce:true,sharedFiniteDeadlineRetained:true,invalidReceiptErrorsPropagate:true};
}
const receiptRouting=await verifyReceiptRouting();
if(process.argv.includes('--receipt-routing-controls'))console.log(JSON.stringify({executionReportReceiptRouting:'PASS',...receiptRouting}));
else{
// Use the real producer's complete reports, including later independent ones.
// The former last-object consumer loses the attachment proof despite success.
const {stdout,inputSource}=await ingestionReportSource();
let reports;
assert.doesNotThrow(() => { reports = stdout.trim().split(/\n(?=\{)/).map(text => JSON.parse(text)); }, 'EXECUTION_REPORT_STREAM_ORACLE: completed observations must remain readable JSON; progress messages belong on stderr.');
const slots = selectExecutionReport(stdout, 'attachmentSlotMapping');
assert.equal(slots.attachmentSlotMapping, 'PASS');
assert.equal(slots.explicitSlotsRequired, true);
assert.equal(slots.atomicReturnedArtifactPromotion, true);
assert.equal(slots.pickerOrderIndependent, true);
assert.equal(slots.filenameOnlyRejected, true);
assert.equal(slots.slotMutationsDetected, 7);
assert.equal(slots.failedResponseRepairedWithoutReselect, true);
assert.equal(selectExecutionReport(stdout, 'acceptedPropositionPersistence').acceptedPropositionPersistence, true);
assert.deepEqual(selectExecutionReport(encode([...reports].reverse()), 'attachmentSlotMapping'), slots);
assert.throws(() => selectExecutionReport(encode(reports.filter(row => !Object.hasOwn(row,'attachmentSlotMapping'))), 'attachmentSlotMapping'), /found 0/);
assert.throws(() => selectExecutionReport(encode([...reports, slots]), 'attachmentSlotMapping'), /found 2/);
assert.throws(() => selectExecutionReport(stdout+'\n{broken', 'attachmentSlotMapping'), SyntaxError);
for (const contaminated of ['progress\n'+stdout, encode(reports.slice(0,1))+'progress\n'+encode(reports.slice(1)), stdout+'progress\n']) {
  assert.throws(() => selectExecutionReport(contaminated, 'attachmentSlotMapping'), SyntaxError, 'EXECUTION_REPORT_CHANNEL_ORACLE: diagnostic output must not be accepted as evidence.');
}
assert.equal(selectExecutionReport(encode([{attachmentSlotMapping:'FAIL',explicitSlotsRequired:false}]), 'attachmentSlotMapping').explicitSlotsRequired, false);

// Replay the exact former consumer as a targeted implementation fault.
const oldConsumer = text => JSON.parse(text.trim().split(/\n(?=\{)/).at(-1));
assert.throws(() => assert.equal(oldConsumer(stdout).explicitSlotsRequired,true), assert.AssertionError);
console.log(JSON.stringify({executionReportSelection:'PASS',synthetic:true,realProducer:'verify-ingestion.mjs',inputSource,receiptRouting,reportCount:reports.length,attachmentProofPreserved:true,reportOrderIndependent:true,missingRejected:true,duplicateRejected:true,corruptRejected:true,diagnosticContaminationRejected:true,failedObservationNotPromoted:true,lastObjectFaultDetected:true}));
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verificationCatalog,browserVerificationCatalog} from './verification-evidence-catalog.mjs';
import {evidenceFingerprint,createExecutionReceipt,validateExecutionReceipt,readExecutionReceipt,sha} from './verification-evidence.mjs';

const suite='verify-cross-run-comparison.mjs';
const affectedIds=[
 'stage-semantic.comparison-materiality.current-package-prerequisite',
 'stage-semantic.comparison-materiality.package-preparation-routing',
 'stage-semantic.comparison-materiality.package-receipt-refusals'
];
const oracle='CATALOG_EXPECTATION_ROUNDTRIP_ORACLE';

// Metadata audit only: this neither executes a suite nor manufactures proof.
export function auditCatalogExpectationRoundTrips(catalogs=[verificationCatalog,browserVerificationCatalog]){
 let checks=0;
 for(const catalog of catalogs)for(const definition of Object.values(catalog))for(const check of definition.checks){
  const expected=check.expected??check.expectedDescription;
  assert.notEqual(expected,undefined,oracle+': missing expectation '+check.id);
  assert.deepEqual(JSON.parse(JSON.stringify(expected)),expected,oracle+': non-JSON expectation '+check.id);
  checks++;
 }
 return {checks};
}

// Run after the genuine complete default owner. All refusal mutations are on
// disposable consumer-test copies; the original saved receipt is never changed,
// promoted, retagged or replaced. No test fixture becomes eligible owner proof.
export function verifyComparisonReceiptRoundTrip(receiptFile){
 const audit=auditCatalogExpectationRoundTrips(),original=fs.readFileSync(receiptFile),receipt=JSON.parse(original),fingerprint=evidenceFingerprint();
 assert.equal(receipt.suite,suite);
 assert.equal(receipt.fingerprint.sourceCommit,fingerprint.sourceCommit);
 assert.equal(receipt.fingerprint.sourceTree,fingerprint.sourceTree);
 assert.equal(Object.hasOwn(receipt,'promotion'),false);
 validateExecutionReceipt(receipt,suite,fingerprint);
 assert.equal(receipt.observations.length,13,oracle+': complete comparison population');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'comparison-receipt-roundtrip-')),target=path.join(directory,suite+'.json'),cases=[];
 try{
  const roundTrip=JSON.parse(JSON.stringify(receipt));
  assert.deepEqual(roundTrip,receipt,oracle+': complete receipt round trip');
  fs.writeFileSync(target,JSON.stringify(roundTrip));
  assert.deepEqual(readExecutionReceipt(directory,suite,fingerprint),receipt,oracle+': strict disk readback');
  for(const id of affectedIds){
   const row=receipt.observations.find(row=>row.checkId===id);
   assert(row&&row.passed&&Object.hasOwn(row,'expected')&&typeof row.expected==='string'&&row.expected.length>0,oracle+': affected observation '+id);
   assert.deepEqual(JSON.parse(JSON.stringify(row)),row,oracle+': affected record round trip '+id);
   cases.push(id+':round-trip-and-strict-readback');
  }
  for(const id of affectedIds){
   const check=verificationCatalog[suite].checks.find(check=>check.id===id),missing={...check};
   delete missing.expectedDescription;
   assert.throws(()=>auditCatalogExpectationRoundTrips([{controlled:{checks:[missing]}}]),error=>error.message.includes(oracle+': missing expectation '+id),oracle+': missing description control');
   cases.push(id+':missing-description-refused');
   for(const variant of ['missing','empty','wrong-type','wrong-value']){
    const copy=structuredClone(receipt),row=copy.observations.find(row=>row.checkId===id);
    if(variant==='missing')delete row.expected;
    else row.expected=variant==='empty'?'':variant==='wrong-type'?false:'CONTROLLED_WRONG_EXPECTATION';
    delete copy.receiptSha256;copy.receiptSha256=sha(copy);
    fs.writeFileSync(target,JSON.stringify(copy));
    assert.throws(()=>readExecutionReceipt(directory,suite,fingerprint),/EXECUTED_EVIDENCE_ORACLE: receipt assertions differ from actual executed report/,oracle+': invalid observation expectation '+id+':'+variant);
    cases.push(id+':'+variant+'-expectation-refused');
   }
  }
  for(const [id,marker,field] of [
   [affectedIds[0],'comparisonMaterialityPackagePrerequisite','schema'],
   [affectedIds[1],'comparisonPackagePreparationControls','cases'],
   [affectedIds[2],'comparisonPackageReceiptControls','genuineReceiptUnchanged']
  ]){
   const reports=structuredClone(receipt.reports),report=reports.find(report=>Object.hasOwn(report,marker));
   if(marker==='comparisonMaterialityPackagePrerequisite')delete report[marker][field];else delete report[field];
   assert.throws(()=>createExecutionReceipt(suite,{command:receipt.command,exitCode:0,outcome:'PASS',stdout:reports.map(report=>JSON.stringify(report)).join('\n'),stderr:''},{fingerprint}),/EXECUTED_EVIDENCE_ORACLE: producer .* reported a failed or missing required assertion/,oracle+': missing report field '+id);
   cases.push(id+':missing-report-field-refused');
  }
  fs.writeFileSync(target,original);
  assert.deepEqual(readExecutionReceipt(directory,suite,fingerprint),receipt,oracle+': restored strict readback');
  return {comparisonReceiptRoundTrip:'PASS',audit,affectedChecks:affectedIds,observations:receipt.observations.length,cases,sourceCommit:fingerprint.sourceCommit,sourceTree:fingerprint.sourceTree,receiptSha256:receipt.receiptSha256,originalReceiptSha256:sha(original),consumerOnly:true,eligibleReceiptCreated:false};
 }finally{
  fs.rmSync(directory,{recursive:true,force:true});
  assert.deepEqual(fs.readFileSync(receiptFile),original,oracle+': original receipt changed');
 }
}

if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
 assert.equal(process.argv.length,3,'Supply the genuine current complete comparison receipt path');
 console.log(JSON.stringify(verifyComparisonReceiptRoundTrip(path.resolve(process.argv[2])),null,2));
}

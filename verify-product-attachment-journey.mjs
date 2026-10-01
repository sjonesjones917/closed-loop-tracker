import {runVerifier} from './verify-conformance-regressions.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Exercise the same production lifecycle, including the required-file rejection
// cases. Do not rewrite the lifecycle source or bypass response ingestion.
export function assertProductAttachmentJourney(report){
assert.equal(report?.result,'PASS','The lifecycle did not produce its product-attachment result.');
assert.equal(report.actualBrowserJourney,false);
for(const caseId of ['preissued-required-slot','missing-declaration','missing-bytes','wrong-slot','wrong-digest','verified-product-file-acceptance'])assert.ok(report.cases.some(row=>row.caseId===caseId&&row.result==='PASS'),caseId+' was not verified.');
return report;
}
if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
const result=await runVerifier(process.execPath,[fileURLToPath(new URL('./verify-full-cycle.mjs',import.meta.url))],{encoding:'utf8',timeout:600000,maxBuffer:64*1024*1024,env:process.env});
if(result.error)throw result.error;
assert.equal(result.status,0,result.stderr||result.stdout);
const report=assertProductAttachmentJourney(JSON.parse(result.stdout).productAttachmentJourney);
console.log(JSON.stringify(report));
}

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// Exercise the same production lifecycle, including the required-file rejection
// cases. Do not rewrite the lifecycle source or bypass response ingestion.
const result=spawnSync(process.execPath,['verify-full-cycle.mjs'],{encoding:'utf8',maxBuffer:64*1024*1024,env:process.env});
if(result.error)throw result.error;
assert.equal(result.status,0,result.stderr||result.stdout);
const report=JSON.parse(result.stdout).productAttachmentJourney;
assert.equal(report?.result,'PASS','The lifecycle did not produce its product-attachment result.');
assert.equal(report.actualBrowserJourney,false);
for(const caseId of ['preissued-required-slot','missing-declaration','missing-bytes','wrong-slot','wrong-digest','verified-product-file-acceptance'])assert.ok(report.cases.some(row=>row.caseId===caseId&&row.result==='PASS'),caseId+' was not verified.');
console.log(JSON.stringify(report));

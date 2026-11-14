import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {restoreArtifactFixture,hydrateRetainedPromptContexts} from './test-project-store-runtime.mjs';

// Synthetic admitted history; exact bytes and construction provenance are retained.
export async function verifierUiPrerequisite(r){
 const bytes=fs.readFileSync('verification/verifier-context-ui-prerequisite-20261018.json'),carrier=JSON.parse(bytes),sha=value=>createHash('sha256').update(value).digest('hex');
 assert.equal(sha(bytes),'cd5bafca20585f760a376c829288e798deaa75a52830f4904bcb2e5c6c17460c');assert.equal(carrier.encoding,'gzip-base64');assert.equal(carrier.synthetic,true);assert.equal(carrier.actualBrowser,false);
 assert.equal(carrier.schema,'closed-loop-verifier-ui-admitted-carrier/1');
 const gzip=Buffer.from(carrier.gzipBase64,'base64');assert.equal(gzip.length,carrier.gzipByteSize);assert.equal(sha(gzip),carrier.gzipSha256);
 const decoded=gunzipSync(gzip,{maxOutputLength:48*1024*1024});assert.equal(decoded.length,carrier.decodedByteSize);assert.equal(sha(decoded),carrier.decodedSha256);
 const retained=JSON.parse(decoded);assert.equal(retained.schema,'closed-loop-verifier-ui-admitted-prerequisite/1');assert.equal(retained.earlierCompleteFlagsForced,false);assert.equal(retained.productionAuthorizationUnchanged,true);
 const clock=retained.archivedFixtureClockUtc;assert(Number.isFinite(Date.parse(clock)));assert.equal(new Date(clock).toISOString(),clock);assert.equal(clock,'2026-10-07T10:54:33.800Z');assert.equal(retained.synthetic,true);assert.equal(retained.actualBrowser,false);r.runtime.Date=class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return Date.parse(clock);}};
 const p=r.copy(retained.project);await restoreArtifactFixture(r.store,retained.artifacts);await hydrateRetainedPromptContexts(r,p,retained.contextFiles);
 for(let stage=1;stage<=11;stage++)assert.equal(r.engine.gate(stage,p).complete,true,'VERIFIER_UI_ADMITTED_PREREQUISITE_'+stage);
 const matrix=r.engine.verificationMatrix(p,p.job.CURRENT_ITERATION);assert.equal(matrix.expected.length,10);assert.equal(matrix.verification.length,2);assert.equal(matrix.invalid.length,1);assert.equal(matrix.missing.length,8);assert.equal(matrix.duplicates.length,0);
 const [first,second]=retained.proof,e=r.engine,cell=row=>['REQ_ID','RUN_ID','TEST_ID'].map(key=>e.recordValue(row,key)).join('|');assert.equal(first.currentAccepted,true);assert.equal(second.currentRejected,true);assert(second.currentIssues.some(issue=>issue.code==='VERIFIER_RUN_MISMATCH'));
 assert.equal(e.recordValue(matrix.invalid[0],'RUN_ID'),second.runId);assert.equal(cell(matrix.invalid[0]),matrix.expected.find(key=>key.split('|')[1]===second.runId));assert.equal(matrix.verification.filter(row=>e.recordValue(row,'RUN_ID')===first.runId&&!matrix.invalid.includes(row)).length,1);
 const sentinel=e.records(p,'freshContexts').filter(row=>Number(row.stage)===12&&e.recordValue(row,'RUN_ID')==='NOT APPLICABLE').at(-1);assert.equal(sentinel?.id,first.contextId);assert.equal(e.contextRunBinding(sentinel,first.runId).matches,true);assert.equal(e.contextRunBinding(sentinel,second.runId).mismatched,true);
 return p;
}

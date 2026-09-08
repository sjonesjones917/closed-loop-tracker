import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveVisualBaselineSubmission as resolve} from './visual-baseline-submission.mjs';
// Isolated synthetic fixtures test transport only; they are not acceptance evidence.
const commit='a'.repeat(40);
const evidence={status:'PROVEN',sourceCommit:'b'.repeat(40),comparedCommit:commit,comparisonResult:'PASS',authority:'VISUAL_BASELINE_AUTHORIZATION',authorityRecordId:'DISPOSABLE-AUTHORIZATION',evidenceReferences:['DISPOSABLE-APPROVAL','DISPOSABLE-BEFORE-AFTER']};
const context={inputJson:JSON.stringify(evidence),ledgerVisualBaseline:{status:'OPEN'},eventName:'workflow_dispatch',ref:'refs/heads/main',submitter:'DISPOSABLE-ACTOR',commit};
const accepted=resolve(context);
assert.deepEqual(Object.fromEntries(Object.entries(accepted).filter(([key])=>key!=='submission')),evidence);
assert.deepEqual(accepted.submission,{method:'AUTHENTICATED_WORKFLOW_INPUT',submitter:context.submitter,commit,eventName:'workflow_dispatch',ref:'refs/heads/main'});
let rejected=0;
function reject(change){const input=structuredClone(context);change(input);assert.throws(()=>resolve(input));assert.equal(resolve(context).comparedCommit,commit);rejected++;}
for(const eventName of ['push','pull_request',''])reject(input=>input.eventName=eventName);
for(const ref of ['refs/heads/other','refs/tags/acceptance',''])reject(input=>input.ref=ref);
reject(input=>input.submitter='');reject(input=>input.commit='short');reject(input=>input.inputJson={});
for(const inputJson of ['{','null','[]','true','"approved"'])reject(input=>input.inputJson=inputJson);
for(const change of [e=>e.status='OPEN',e=>e.sourceCommit='short',e=>e.comparedCommit='c'.repeat(40),e=>delete e.comparedCommit,e=>e.comparisonResult='FAIL',e=>e.authority='SAFARI_FEEDBACK',e=>delete e.authorityRecordId,e=>e.evidenceReferences=[],e=>e.evidenceReferences=['']])reject(input=>{const e=structuredClone(evidence);change(e);input.inputJson=JSON.stringify(e);});
const spoof=resolve({...context,inputJson:JSON.stringify({...evidence,submission:{submitter:'SPOOFED'}})});
assert.equal(spoof.submission.submitter,context.submitter);
const ledger={status:'OPEN',basis:'Approval not yet established'};
const fallback=resolve({inputJson:'',ledgerVisualBaseline:ledger});
assert.deepEqual(fallback,ledger);assert.notEqual(fallback,ledger);assert.equal(resolve(),null);
const workflow=fs.readFileSync(new URL('./.github/workflows/pages.yml',import.meta.url),'utf8');
for(const token of ['visual_baseline_evidence_json:','VISUAL_BASELINE_EVIDENCE_JSON:','node verify-visual-baseline-submission.mjs','const visualBaseline=resolveVisualBaselineSubmission(','inputJson:process.env.VISUAL_BASELINE_EVIDENCE_JSON','submitter:process.env.GITHUB_ACTOR','ref:process.env.GITHUB_REF','commit:report.commit'])assert(workflow.includes(token),`Missing visual evidence wiring: ${token}`);
console.log(JSON.stringify({visualBaselineSubmission:'PASS',negativeCases:rejected,exactCommitRequired:true,authenticatedSubmitterBound:true,unapprovedLedgerPreserved:true,repairRestoresProgression:true,physicalDeviceEvidenceClaimed:false,visualApprovalClaimed:false}));

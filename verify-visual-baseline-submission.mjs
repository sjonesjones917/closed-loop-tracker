import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {resolveVisualBaselineSubmission as resolve} from './visual-baseline-submission.mjs';
// Isolated synthetic fixtures test transport only; they are not acceptance evidence.
const commit='a'.repeat(40);
const evidence={status:'PROVEN',sourceCommit:'b'.repeat(40),comparedCommit:commit,comparisonResult:'PASS',authority:'VISUAL_BASELINE_AUTHORIZATION',authorityRecordId:'DISPOSABLE-AUTHORIZATION',evidenceReferences:['DISPOSABLE-APPROVAL','DISPOSABLE-BEFORE-AFTER']};
const context={inputJson:JSON.stringify(evidence),ledgerVisualBaseline:{status:'OPEN'},eventName:'workflow_dispatch',ref:'refs/heads/main',submitter:'DISPOSABLE-ACTOR',commit};
function verifyTransport(implementation){
 const accepted=implementation(context),observations=[];
 assert.deepEqual(JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(accepted).filter(([key])=>key!=='submission')))),evidence);
 assert.deepEqual(JSON.parse(JSON.stringify(accepted.submission)),{method:'AUTHENTICATED_WORKFLOW_INPUT',submitter:context.submitter,commit,eventName:'workflow_dispatch',ref:'refs/heads/main'});
 function reject(id,change,name,message){
  const input=structuredClone(context);change(input);let observed=null;
  try{implementation(input);}catch(error){observed={name:error.name,message:error.message};}
  assert.deepEqual(observed,{name,message},'VISUAL_REJECTION_REASON_ORACLE: '+id);
  assert.equal(implementation(context).comparedCommit,commit,'VISUAL_REJECTION_CONTROL_ORACLE: '+id);
  observations.push({caseId:id,result:'PASS',expected:{name,message},actual:observed});
 }
 const authentication='Visual evidence requires authenticated workflow dispatch on exact main.';
 for(const eventName of ['push','pull_request',''])reject('event-'+(eventName||'missing'),input=>input.eventName=eventName,'Error',authentication);
 for(const ref of ['refs/heads/other','refs/tags/acceptance',''])reject('ref-'+(ref||'missing'),input=>input.ref=ref,'Error',authentication);
 reject('missing-submitter',input=>input.submitter='','Error',authentication);
 reject('invalid-commit',input=>input.commit='short','Error',authentication);
 reject('nontext-input',input=>input.inputJson={},'TypeError','Visual evidence input must be JSON text.');
 reject('malformed-json',input=>input.inputJson='{','Error','Visual evidence input is not valid JSON.');
 for(const inputJson of ['null','[]','true','"approved"'])reject('nonobject-'+inputJson,input=>input.inputJson=inputJson,'Error','Visual evidence must be an object.');
 const classes=[
  ['status',e=>e.status='OPEN','Visual evidence must bind a passing comparison to the exact submitted commit.'],
  ['source-commit',e=>e.sourceCommit='short','Visual evidence must bind a passing comparison to the exact submitted commit.'],
  ['foreign-compared-commit',e=>e.comparedCommit='c'.repeat(40),'Visual evidence must bind a passing comparison to the exact submitted commit.'],
  ['missing-compared-commit',e=>delete e.comparedCommit,'Visual evidence must bind a passing comparison to the exact submitted commit.'],
  ['comparison-result',e=>e.comparisonResult='FAIL','Visual evidence must bind a passing comparison to the exact submitted commit.'],
  ['authority-kind',e=>e.authority='SAFARI_FEEDBACK','Visual evidence requires the actual approved-predecessor or human-authorization record identity.'],
  ['authority-id',e=>delete e.authorityRecordId,'Visual evidence requires the actual approved-predecessor or human-authorization record identity.'],
  ['empty-references',e=>e.evidenceReferences=[],'Visual evidence must reference actual approval and before/after comparison artifacts.'],
  ['blank-reference',e=>e.evidenceReferences=[''],'Visual evidence must reference actual approval and before/after comparison artifacts.']
 ];
 for(const [id,change,message] of classes)reject(id,input=>{const value=structuredClone(evidence);change(value);input.inputJson=JSON.stringify(value);},'Error',message);
 const spoof=implementation({...context,inputJson:JSON.stringify({...evidence,submission:{submitter:'SPOOFED'}})});assert.equal(spoof.submission.submitter,context.submitter);
 const ledger={status:'OPEN',basis:'Approval not yet established'},fallback=implementation({inputJson:'',ledgerVisualBaseline:ledger});
 assert.deepEqual(JSON.parse(JSON.stringify(fallback)),ledger);assert.notEqual(fallback,ledger);assert.equal(implementation(),null);
 return observations;
}
const observations=verifyTransport(resolve),faults=[];
const source=fs.readFileSync('visual-baseline-submission.mjs','utf8');
for(const [id,before,after] of [
 ['unrelated-crash',"  if(typeof inputJson!=='string')","  if(eventName==='push')throw new ReferenceError('CONTROLLED_UNRELATED_VISUAL_CRASH');\n  if(typeof inputJson!=='string')"],
 ['wrong-rejection-reason',"throw new Error('Visual evidence requires authenticated workflow dispatch on exact main.')","throw new Error('Unrelated fixture error.')"]
]){
 assert.equal(source.split(before).length,2,'VISUAL_FAULT_ANCHOR_ORACLE: '+id);
 const runtime=createVerifierRuntime();createVerifierRuntime.loadScript(runtime,source.replace(before,after).replace('export function resolveVisualBaselineSubmission','function resolveVisualBaselineSubmission'),{filename:'visual-baseline-submission.mjs:disposable-fault'});
 assert.throws(()=>verifyTransport(runtime.resolveVisualBaselineSubmission),error=>error.code==='ERR_ASSERTION'&&error.message.startsWith('VISUAL_REJECTION_REASON_ORACLE'),'VISUAL_FAULT_DETECTION_ORACLE: '+id);
 verifyTransport(resolve);faults.push({id,result:'DETECTED',restored:'PASS'});
}
const workflow=fs.readFileSync(new URL('./.github/workflows/pages.yml',import.meta.url),'utf8');
for(const token of ['visual_baseline_evidence_json:','VISUAL_BASELINE_EVIDENCE_JSON:','node verify-visual-baseline-submission.mjs','const visualBaseline=resolveVisualBaselineSubmission(','inputJson:process.env.VISUAL_BASELINE_EVIDENCE_JSON','submitter:process.env.GITHUB_ACTOR','ref:process.env.GITHUB_REF','commit:report.commit'])assert(workflow.includes(token),`Missing visual evidence wiring: ${token}`);
console.log(JSON.stringify({visualBaselineSubmission:'PASS',negativeCases:observations.length,observations,faults,exactCommitRequired:true,authenticatedSubmitterBound:true,unapprovedLedgerPreserved:true,repairRestoresProgression:true,physicalDeviceEvidenceClaimed:false,visualApprovalClaimed:false}));

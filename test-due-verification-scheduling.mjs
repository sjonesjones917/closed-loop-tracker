import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {runVerifier,AGGREGATE_TIMEOUT_MS} from './verify-conformance-regressions.mjs';

// This is a two-producer scheduling fixture, not a substitute for the deferred
// matrix. It executes the real supervisor, preload, receipt owner and collector
// around tiny explicit assertions, so no extra native precursor is generated.
export async function verifyDueVerificationScheduling(directory){
 const owner=fs.readFileSync('verify-spec-residual-closure.mjs','utf8'),dispatch=owner.split('\n').filter(line=>line.startsWith('await checkedVerifier(')&&line.includes("'./verify-due-stage-timing.mjs'"));
 assert.equal(dispatch.length,1,'DUE_RECEIPT_SCHEDULING_OWNER_ORACLE: complete deferred matrix must use its own checked child.');
 assert.match(dispatch[0],/stdio:'inherit',timeout:AGGREGATE_TIMEOUT_MS/,'DUE_RECEIPT_SCHEDULING_BUDGET_ORACLE: retain output and the existing composite budget.');
 assert(!owner.includes("await import('./verify-due-stage-timing.mjs');"),'DUE_RECEIPT_SCHEDULING_OWNER_ORACLE: duplicate in-process execution remains.');
 const copied=['verify-conformance-regressions.mjs','operator-journey-fixtures.mjs','test-fixtures.mjs','test-zip.mjs','test-project-store-runtime.mjs','verifier-runtime.mjs','hash.js','verification-evidence-preload.mjs','verification-evidence.mjs','deployment-contract-identities.mjs','browser-execution-evidence.mjs','evaluate-mobile-acceptance-submission.mjs','verify-mobile-acceptance-evidence.mjs','collect-verification-evidence.mjs'],results=[];
 const suite='verify-due-stage-timing.mjs',wrapper='verify-complete.mjs',diagnostic='SYNTHETIC_SCHEDULING_CHILD_DIAGNOSTIC\n';
 for(const mode of ['former-import','current-child','failed-child','malformed-child']){
  const cwd=path.join(directory,mode+' source with spaces');fs.mkdirSync(cwd,{recursive:true});
  for(const file of copied)fs.copyFileSync(file,path.join(cwd,file));
  fs.mkdirSync(path.join(cwd,'specification'));
  const specification='Synthetic scheduling fixture only; no application conformance claim.\n',specificationSha256=createHash('sha256').update(specification).digest('hex');
  fs.writeFileSync(path.join(cwd,'specification/closed-loop-reliability-controlling-implementation-specification.txt'),specification);
  fs.writeFileSync(path.join(cwd,'specification/closed-loop-normative-requirements.json'),JSON.stringify({specificationSha256,manifestIdentity:'SYNTHETIC_SCHEDULING_ONLY',requirements:[]}));
  fs.writeFileSync(path.join(cwd,'specification/requirement-evidence-bindings.json'),JSON.stringify({approvedAmendments:[]}));
  fs.writeFileSync(path.join(cwd,'verification-assertion-bindings.json'),JSON.stringify({schema:'closed-loop-verification-assertion-bindings/1',specificationSha256,bindings:[]}));
  fs.writeFileSync(path.join(cwd,'verification-evidence-catalog.mjs'),`export const verificationCatalog={${JSON.stringify(wrapper)}:{boundary:'synthetic scheduling wrapper',checks:[{id:'synthetic.wrapper.completed',marker:'schedulingWrapper',path:'schedulingWrapper',expected:true,assertionReference:'wrapper reached after awaited child'}]},${JSON.stringify(suite)}:{boundary:'synthetic scheduling child',checks:[{id:'synthetic.child.completed',marker:'schedulingChild',path:'schedulingChild',expected:true,assertionReference:'bounded arithmetic control completed'}]}};export const browserVerificationCatalog={};export const metricCatalog={};export const zeroCatalog={};export const negativePopulationCatalog={};\n`);
  const child=`import fs from 'node:fs';import assert from 'node:assert/strict';fs.appendFileSync('invocations.log','child\\n');assert.equal(2+2,4);process.stderr.write(${JSON.stringify(diagnostic)});if(process.env.SCHEDULING_FIXTURE_MODE==='failed-child')throw new Error('SYNTHETIC_SCHEDULING_ASSERTION_FAILURE');if(process.env.SCHEDULING_FIXTURE_MODE==='malformed-child')console.log('SYNTHETIC_MALFORMED_REPORT');else console.log(JSON.stringify({schedulingChild:true,synthetic:true,actualDeferredMatrix:false}));\n`;
  fs.writeFileSync(path.join(cwd,suite),child);
  const selected=mode==='former-import'?"await import('./verify-due-stage-timing.mjs');":dispatch[0];
  fs.writeFileSync(path.join(cwd,wrapper),`import {checkedVerifier,AGGREGATE_TIMEOUT_MS} from './verify-conformance-regressions.mjs';\nimport {fileURLToPath} from 'node:url';\n${selected}\nconsole.log(JSON.stringify({schedulingWrapper:true,synthetic:true,actualDeferredMatrix:false}));\n`);
  execFileSync('git',['init','--quiet'],{cwd});execFileSync('git',['add','.'],{cwd});execFileSync('git',['-c','user.name=Synthetic scheduling fixture','-c','user.email=fixture@localhost','commit','--quiet','-m','Bounded scheduling fixture'],{cwd});
  const receipts=path.join(cwd,'receipts'),env={...process.env,NODE_OPTIONS:'--import '+JSON.stringify(path.join(cwd,'verification-evidence-preload.mjs')),CLOSED_LOOP_VERIFICATION_SOURCE_ROOT:cwd,CLOSED_LOOP_VERIFICATION_RECEIPTS:receipts,SCHEDULING_FIXTURE_MODE:mode,VERIFIER_CHILD_EVIDENCE_DIRECTORY:path.join(cwd,'nested-runner')};
  const parent=await runVerifier(process.execPath,[path.join(cwd,wrapper)],{cwd,env,evidenceDirectory:path.join(cwd,'outer-runner'),timeout:30000}),count=()=>fs.readFileSync(path.join(cwd,'invocations.log'),'utf8').trim().split('\n').length;
  assert.equal(count(),1,'DUE_RECEIPT_SCHEDULING_INVOCATION_ORACLE: parent did not execute exactly one producer.');
  const wrapperReceipt=JSON.parse(fs.readFileSync(path.join(receipts,wrapper+'.json'),'utf8')),ownPath=path.join(receipts,suite+'.json');
  if(['failed-child','malformed-child'].includes(mode)){
   assert.equal(parent.status,1,'DUE_RECEIPT_SCHEDULING_FAILURE_ORACLE: failed child authorized wrapper.');assert.equal(wrapperReceipt.complete,false);const failedReceipt=JSON.parse(fs.readFileSync(ownPath,'utf8'));assert.equal(failedReceipt.complete,false);assert.match(failedReceipt.reason,mode==='failed-child'?/producer exit\/output bound failed/:/Unexpected token/);assert.match(parent.stderr,/Verifier child did not pass/);
   assert(parent.stderr.includes(mode==='failed-child'?'SYNTHETIC_SCHEDULING_ASSERTION_FAILURE':'producer exit/output bound failed')||parent.stderr.includes('Unexpected token'),'DUE_RECEIPT_SCHEDULING_FAILURE_ORACLE: unrelated child failure.');
   const collection=await runVerifier(process.execPath,[path.join(cwd,'collect-verification-evidence.mjs'),'--run-missing','--out='+path.join(receipts,'evidence.json')],{cwd,env,evidenceDirectory:path.join(cwd,'outer-runner'),timeout:30000});
   assert.equal(collection.status,1);assert.match(collection.stderr,/failed\/incomplete receipt/);assert.equal(count(),1,'DUE_RECEIPT_SCHEDULING_FAILURE_ORACLE: collector retried incomplete evidence instead of rejecting it.');
   results.push({mode,invocations:1,parentExit:parent.status,collectorExit:collection.status,incompleteChildAndParentRejected:true,actualDeferredMatrix:false});continue;
  }
  assert.equal(parent.status,0,'DUE_RECEIPT_SCHEDULING_CONTROL_ORACLE: '+parent.stderr);assert.equal(wrapperReceipt.complete,true);
  assert.equal(parent.stderr,diagnostic,'DUE_RECEIPT_SCHEDULING_STDERR_ORACLE: conforming diagnostics changed or duplicated.');
  const reports=parent.stdout.trim().split('\n').map(line=>JSON.parse(line));assert.equal(reports.length,2);assert.equal(reports.filter(row=>row.schedulingChild===true).length,1);assert.equal(reports.filter(row=>row.schedulingWrapper===true).length,1);
  assert.equal(fs.existsSync(ownPath),mode==='current-child','DUE_RECEIPT_SCHEDULING_OWNERSHIP_ORACLE: imported parent cannot stand in for the canonical producer.');
  const priorOwn=fs.existsSync(ownPath)?fs.readFileSync(ownPath,'utf8'):null;
  const collection=await runVerifier(process.execPath,[path.join(cwd,'collect-verification-evidence.mjs'),'--run-missing','--out='+path.join(receipts,'evidence.json')],{cwd,env,evidenceDirectory:path.join(cwd,'outer-runner'),timeout:30000});
  assert.equal(collection.status,0,'DUE_RECEIPT_SCHEDULING_COLLECT_ORACLE: '+collection.stderr);assert.equal(count(),mode==='former-import'?2:1,'DUE_RECEIPT_SCHEDULING_COUNT_ORACLE: current wrapper plus collector repeated the producer.');
  const own=JSON.parse(fs.readFileSync(ownPath,'utf8'));assert.equal(own.complete,true);assert.equal(own.suite,suite);assert.equal(path.basename(own.command[1]),suite);assert.equal(own.fingerprint.sourceInputsSha256,wrapperReceipt.fingerprint.sourceInputsSha256);assert.equal(own.fingerprint.sourceCommit,wrapperReceipt.fingerprint.sourceCommit);assert.equal(own.fingerprint.runtime.node,wrapperReceipt.fingerprint.runtime.node);
  if(mode==='current-child'){
   assert.equal(fs.readFileSync(ownPath,'utf8'),priorOwn,'DUE_RECEIPT_SCHEDULING_REUSE_ORACLE: collector rewrote an already valid receipt.');
   const nested=fs.readdirSync(path.join(cwd,'nested-runner')).filter(file=>file.endsWith('.json')).map(file=>JSON.parse(fs.readFileSync(path.join(cwd,'nested-runner',file),'utf8')));assert.equal(nested.length,1);assert.equal(nested[0].timeoutMs,AGGREGATE_TIMEOUT_MS);assert.equal(nested[0].outcome,'PASS');
  }
  const aggregate=JSON.parse(fs.readFileSync(path.join(receipts,'evidence.json'),'utf8'));assert.equal(aggregate.receiptCount,2);assert.equal(aggregate.observationCount,2);
  results.push({mode,invocations:count(),parentExit:parent.status,collectorExit:collection.status,stdoutAndStderrForwardedOnce:true,canonicalReceiptOwnsActualCommand:true,sourceRevisionRuntimeIdentical:true,existingReceiptReused:mode==='current-child',actualDeferredMatrix:false});
 }
 return {caseId:'due-composite-producer-receipt-scheduling',result:'PASS',results,formerInvocations:2,currentInvocations:1,existingCompositeTimeoutMs:AGGREGATE_TIMEOUT_MS,productionDueAssertionsAltered:false,sourceDirectoryContainsSpaces:true,synthetic:true,actualDeferredMatrix:false,boundary:'Actual residual dispatch plus existing child supervisor, Node preload, receipt owner and collector; two explicitly synthetic producers only.'};
}

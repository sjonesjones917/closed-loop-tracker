import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {runVerifier,AGGREGATE_TIMEOUT_MS} from './verify-conformance-regressions.mjs';

// These small scheduling fixtures are not substitutes for the deferred matrix.
// They execute the real supervisor, preload, receipt owner and collector around
// tiny explicit assertions, so no extra native precursor is generated.
async function verifyCheckedProducerScheduling(directory,suite,caseId){
 const owner=fs.readFileSync('verify-spec-residual-closure.mjs','utf8'),due=suite==='verify-due-stage-timing.mjs',dispatch=owner.split('\n').filter(line=>line.includes('await checkedVerifier(')&&line.includes("'./"+suite+"'"));
 assert.equal(dispatch.length,1,'DUE_RECEIPT_SCHEDULING_OWNER_ORACLE: complete deferred matrix must use its own checked child.');
 const timeout=due?330*60*1000:AGGREGATE_TIMEOUT_MS;
 if(due){
  assert.match(owner,/const DEFERRED_MATRIX_TIMEOUT_MS=330\*60\*1000;/,'DUE_RECEIPT_SCHEDULING_BUDGET_ORACLE: the deferred producer must fit within the hosted job bound.');
  assert.match(dispatch[0],/^if\(!currentDeferredMatrixReceipt\(\)\)await checkedVerifier\(/,'DUE_RECEIPT_SCHEDULING_REUSE_ORACLE: only a current validated receipt may skip the producer.');
  assert.match(dispatch[0],/stdio:'inherit',timeout:DEFERRED_MATRIX_TIMEOUT_MS/,'DUE_RECEIPT_SCHEDULING_BUDGET_ORACLE: retain output and the dedicated deferred budget.');
 }else{
  assert.match(dispatch[0],/^await checkedVerifier\(/,'CROSS_RUN_SCHEDULING_OWNER_ORACLE: cross-run producer must remain checked.');
  assert.match(dispatch[0],/stdio:'inherit',timeout:AGGREGATE_TIMEOUT_MS/,'CROSS_RUN_SCHEDULING_BUDGET_ORACLE: retain output and the composite budget.');
 }
 assert(!owner.includes("await import('./"+suite+"');"),'DUE_RECEIPT_SCHEDULING_OWNER_ORACLE: duplicate in-process execution remains.');
 const copied=['verify-conformance-regressions.mjs','operator-journey-fixtures.mjs','test-fixtures.mjs','test-handoff-authorization.mjs','test-zip.mjs','test-project-store-runtime.mjs','verifier-runtime.mjs','hash.js','verification-evidence-preload.mjs','verification-evidence.mjs','deployment-contract-identities.mjs','browser-execution-evidence.mjs','evaluate-mobile-acceptance-submission.mjs','verify-mobile-acceptance-evidence.mjs','collect-verification-evidence.mjs'],results=[];
 const wrapper='verify-complete.mjs',diagnostic='SYNTHETIC_SCHEDULING_CHILD_DIAGNOSTIC\n';
 for(const mode of ['former-import','current-child','collector-empty','collector-child-first','collector-no-run','unrelated-missing','missing-own-receipt','late-invalidation','failed-child','malformed-child']){
  const cwd=path.join(directory,mode+' source with spaces');fs.mkdirSync(cwd,{recursive:true});
  for(const file of copied)fs.copyFileSync(file,path.join(cwd,file));
  fs.mkdirSync(path.join(cwd,'specification'));
  const specification='Synthetic scheduling fixture only; no application conformance claim.\n',specificationSha256=createHash('sha256').update(specification).digest('hex');
  fs.writeFileSync(path.join(cwd,'specification/closed-loop-reliability-controlling-implementation-specification.txt'),specification);
  fs.writeFileSync(path.join(cwd,'specification/closed-loop-normative-requirements.json'),JSON.stringify({specificationSha256,manifestIdentity:'SYNTHETIC_SCHEDULING_ONLY',requirements:[]}));
  fs.writeFileSync(path.join(cwd,'specification/requirement-evidence-bindings.json'),JSON.stringify({approvedAmendments:[]}));
  fs.writeFileSync(path.join(cwd,'verification-assertion-bindings.json'),JSON.stringify({schema:'closed-loop-verification-assertion-bindings/1',specificationSha256,bindings:[]}));
  const parentEntry=`${JSON.stringify(wrapper)}:{boundary:'synthetic scheduling wrapper',checks:[{id:'synthetic.wrapper.completed',marker:'schedulingWrapper',path:'schedulingWrapper',expected:true,assertionReference:'wrapper reached after awaited child'}]}`;
  const childEntry=`${JSON.stringify(suite)}:{boundary:'synthetic scheduling child',checks:[{id:'synthetic.child.completed',marker:'schedulingChild',path:'schedulingChild',expected:true,assertionReference:'bounded arithmetic control completed'}]}`;
  const lateEntry=`'verify-late-invalidation.mjs':{boundary:'synthetic late invalidation',checks:[{id:'synthetic.late.completed',marker:'lateInvalidation',path:'lateInvalidation',expected:true,assertionReference:'late producer completed after corrupting an earlier receipt'}]}`;
  const unrelatedEntry=`'verify-unrelated.mjs':{boundary:'synthetic unrelated producer',checks:[{id:'synthetic.unrelated.completed',marker:'unrelatedCompleted',path:'unrelatedCompleted',expected:true,assertionReference:'unrelated missing producer executed'}]}`;
  const entries=['collector-child-first','missing-own-receipt'].includes(mode)?[childEntry,parentEntry]:[parentEntry,childEntry,...(mode==='late-invalidation'?[lateEntry]:[]),...(mode==='unrelated-missing'?[unrelatedEntry]:[])];
  fs.writeFileSync(path.join(cwd,'verification-evidence-catalog.mjs'),`export const verificationCatalog={${entries.join(',')}};export const browserVerificationCatalog={};export const metricCatalog={};export const zeroCatalog={};export const negativePopulationCatalog={};\n`);
  const child=`import fs from 'node:fs';import assert from 'node:assert/strict';fs.appendFileSync('invocations.log','child\\n');assert.equal(2+2,4);process.stderr.write(${JSON.stringify(diagnostic)});if(process.env.SCHEDULING_FIXTURE_MODE==='failed-child')throw new Error('SYNTHETIC_SCHEDULING_ASSERTION_FAILURE');if(process.env.SCHEDULING_FIXTURE_MODE==='malformed-child')console.log('SYNTHETIC_MALFORMED_REPORT');else console.log(JSON.stringify({schedulingChild:true,synthetic:true,actualDeferredMatrix:false}));${mode==='collector-empty'?'console.log(JSON.stringify({secondarySyntheticReport:true}));':''}${mode==='missing-own-receipt'?`process.on('exit',()=>{const p='receipts/${suite}.json';if(fs.existsSync(p))fs.unlinkSync(p);});`:''}\n`;
  fs.writeFileSync(path.join(cwd,suite),child);
  if(mode==='late-invalidation')fs.writeFileSync(path.join(cwd,'verify-late-invalidation.mjs'),`import fs from 'node:fs';fs.writeFileSync('receipts/${wrapper}.json','{}');console.log(JSON.stringify({lateInvalidation:true,synthetic:true}));\n`);
  if(mode==='unrelated-missing')fs.writeFileSync(path.join(cwd,'verify-unrelated.mjs'),`import fs from 'node:fs';fs.appendFileSync('unrelated.log','unrelated\\n');console.log(JSON.stringify({unrelatedCompleted:true,synthetic:true}));\n`);
  const selected=mode==='former-import'?"await import('./"+suite+"');":dispatch[0].replace(/^if\(!currentDeferredMatrixReceipt\(\)\)/,'');
  fs.writeFileSync(path.join(cwd,wrapper),`import {checkedVerifier,AGGREGATE_TIMEOUT_MS} from './verify-conformance-regressions.mjs';\nimport {fileURLToPath} from 'node:url';\nconst DEFERRED_MATRIX_TIMEOUT_MS=330*60*1000;\n${selected}\nconsole.log(JSON.stringify({schedulingWrapper:true,synthetic:true,actualDeferredMatrix:false}));\n`);
  execFileSync('git',['init','--quiet'],{cwd});execFileSync('git',['add','.'],{cwd});execFileSync('git',['-c','user.name=Synthetic scheduling fixture','-c','user.email=fixture@localhost','commit','--quiet','-m','Bounded scheduling fixture'],{cwd});
  const receipts=path.join(cwd,'receipts'),env={...process.env,NODE_OPTIONS:'--import '+JSON.stringify(path.join(cwd,'verification-evidence-preload.mjs')),CLOSED_LOOP_VERIFICATION_SOURCE_ROOT:cwd,CLOSED_LOOP_VERIFICATION_RECEIPTS:receipts,SCHEDULING_FIXTURE_MODE:mode,VERIFIER_CHILD_EVIDENCE_DIRECTORY:path.join(cwd,'nested-runner')};
  const count=()=>fs.readFileSync(path.join(cwd,'invocations.log'),'utf8').trim().split('\n').length;
  if(mode==='collector-no-run'){
   const rejected=await runVerifier(process.execPath,[path.join(cwd,'collect-verification-evidence.mjs'),'--out='+path.join(receipts,'evidence.json')],{cwd,env,evidenceDirectory:path.join(cwd,'outer-runner'),timeout:30000});
   assert.equal(rejected.status,1);assert.match(rejected.stderr,/missing required current receipt/);assert.equal(fs.existsSync(path.join(cwd,'invocations.log')),false);
   results.push({mode,invocations:0,collectorExit:rejected.status,missingProofRejected:true,synthetic:true});continue;
  }
  if(['collector-child-first','unrelated-missing','missing-own-receipt','late-invalidation'].includes(mode)){
   const collection=await runVerifier(process.execPath,[path.join(cwd,'collect-verification-evidence.mjs'),'--run-missing','--out='+path.join(receipts,'evidence.json')],{cwd,env,evidenceDirectory:path.join(cwd,'outer-runner'),timeout:30000});
   if(mode==='collector-child-first'){
    assert.equal(collection.status,0,'CHILD_FIRST_COLLECTOR_ORACLE: '+collection.stderr);assert.equal(count(),2,'CHILD_FIRST_COLLECTOR_ORACLE: explicit parent child execution was suppressed.');
    const aggregate=JSON.parse(fs.readFileSync(path.join(receipts,'evidence.json'),'utf8'));assert.equal(aggregate.receiptCount,2);assert.equal(aggregate.observationCount,2);
   }else if(mode==='unrelated-missing'){
    assert.equal(collection.status,0,'UNRELATED_COLLECTOR_ORACLE: '+collection.stderr);assert.equal(count(),1);assert.equal(fs.readFileSync(path.join(cwd,'unrelated.log'),'utf8'),'unrelated\n');
    const aggregate=JSON.parse(fs.readFileSync(path.join(receipts,'evidence.json'),'utf8'));assert.equal(aggregate.receiptCount,3);assert.equal(aggregate.observationCount,3);
   }else if(mode==='missing-own-receipt'){
    assert.equal(collection.status,1,'OWN_RECEIPT_ORACLE: successful child without its own receipt passed.');assert.match(collection.stderr,/successful producer did not persist its own receipt/);assert.equal(count(),1);
   }else{
    assert.equal(collection.status,1,'LATE_INVALIDATION_ORACLE: earlier in-memory PASS concealed a replaced receipt.');assert.match(collection.stderr,/receipt schema\/producer mismatch|receipt content digest mismatch/);assert.equal(count(),1);
   }
   results.push({mode,invocations:count(),collectorExit:collection.status,synthetic:true,actualDeferredMatrix:false});continue;
  }
  if(mode==='collector-empty'){
   const collection=await runVerifier(process.execPath,[path.join(cwd,'collect-verification-evidence.mjs'),'--run-missing','--out='+path.join(receipts,'evidence.json')],{cwd,env,evidenceDirectory:path.join(cwd,'outer-runner'),timeout:30000});
   assert.equal(collection.status,0,'COLD_COLLECTOR_ORACLE: '+collection.stderr);
   assert.equal(count(),1,'COLD_COLLECTOR_ORACLE: parent must produce the later child once.');
   const aggregate=JSON.parse(fs.readFileSync(path.join(receipts,'evidence.json'),'utf8'));
   assert.equal(aggregate.receiptCount,2);assert.equal(aggregate.observationCount,2);
   assert.equal(aggregate.receiptReferences.length,2);
   const first=fs.readFileSync(path.join(receipts,wrapper+'.json'),'utf8'),second=fs.readFileSync(path.join(receipts,suite+'.json'),'utf8');
   const exportRun=await runVerifier(process.execPath,[path.join(cwd,'collect-verification-evidence.mjs'),'--export-owner='+suite,'--report-marker=schedulingChild'],{cwd,env,evidenceDirectory:path.join(cwd,'outer-runner'),timeout:30000});
   assert.equal(exportRun.status,0,'COLD_EXPORT_ORACLE: '+exportRun.stderr);assert.equal(JSON.parse(exportRun.stdout).schedulingChild,true);
   const allReports=await runVerifier(process.execPath,[path.join(cwd,'collect-verification-evidence.mjs'),'--export-owner='+suite],{cwd,env,evidenceDirectory:path.join(cwd,'outer-runner'),timeout:30000});
   assert.equal(allReports.status,0);assert.deepEqual(allReports.stdout.trim().split('\n').map(JSON.parse).map(row=>Object.keys(row)[0]),['schedulingChild','secondarySyntheticReport']);
   assert.equal(count(),1,'COLD_EXPORT_ORACLE: report export launched a producer.');
   assert.equal(fs.readFileSync(path.join(receipts,wrapper+'.json'),'utf8'),first);assert.equal(fs.readFileSync(path.join(receipts,suite+'.json'),'utf8'),second);
   const reportOwnerControl=`import assert from 'node:assert/strict';import {currentOwnerReport} from './verification-evidence.mjs';let calls=0;const reused=await currentOwnerReport(${JSON.stringify(suite)},'schedulingChild',{run:async()=>{calls++;throw new Error('VALID_REUSE_STARTED_CHILD');}});assert.equal(reused.schedulingChild,true);assert.equal(calls,0);const fallback=await currentOwnerReport(${JSON.stringify(suite)},'schedulingChild',{directory:'absent-receipts',run:async()=>{calls++;return JSON.stringify({schedulingChild:true});}});assert.equal(fallback.schedulingChild,true);assert.equal(calls,1);console.log(JSON.stringify({validReuseChildInvocations:0,missingFallbackChildInvocations:1}));`;
   const ownerControl=await runVerifier(process.execPath,['--input-type=module','-e',reportOwnerControl],{cwd,env,evidenceDirectory:path.join(cwd,'outer-runner'),timeout:30000});
   assert.equal(ownerControl.status,0,'OWNER_REPORT_REUSE_ORACLE: '+ownerControl.stderr);assert.equal(JSON.parse(ownerControl.stdout).validReuseChildInvocations,0);assert.equal(count(),1);
   for(const args of [['--export-owner='+suite,'--report-marker=missing'],['--report-marker=schedulingChild','--run-missing'],['--export-owner=unregistered.mjs'],['--export-owner='+suite,'--run-missing'],['--export-owner='+suite,'--browser-suite='+suite]]){
    const rejected=await runVerifier(process.execPath,[path.join(cwd,'collect-verification-evidence.mjs'),...args],{cwd,env,evidenceDirectory:path.join(cwd,'outer-runner'),timeout:30000});
    assert.equal(rejected.status,1,'COLD_EXPORT_ORACLE: invalid export arguments succeeded: '+args.join(' '));assert.equal(count(),1);
   }
   const ownPath=path.join(receipts,suite+'.json'),original=JSON.parse(second),resign=receipt=>{delete receipt.receiptSha256;receipt.receiptSha256=createHash('sha256').update(JSON.stringify(receipt)).digest('hex');return receipt;};
   for(const [name,mutate] of [
    ['corrupt-digest',receipt=>{receipt.receiptSha256='0'.repeat(64);return receipt;}],
    ['failed',receipt=>resign({...receipt,outcome:'FAIL'})],
    ['incomplete',receipt=>resign({...receipt,complete:false})],
    ['empty-report',receipt=>resign({...receipt,reports:[],observations:[]})],
    ['wrong-owner',receipt=>resign({...receipt,suite:wrapper})],
    ['stale-source',receipt=>resign({...receipt,fingerprint:{...receipt.fingerprint,sourceInputsSha256:'0'.repeat(64)}})],
    ['stale-specification',receipt=>resign({...receipt,fingerprint:{...receipt.fingerprint,specificationSha256:'0'.repeat(64)}})],
    ['stale-catalog',receipt=>resign({...receipt,fingerprint:{...receipt.fingerprint,catalogSha256:'0'.repeat(64)}})],
    ['stale-runtime',receipt=>resign({...receipt,fingerprint:{...receipt.fingerprint,runtime:{...receipt.fingerprint.runtime,node:'v0'}}})],
    ['foreign-commit',receipt=>resign({...receipt,fingerprint:{...receipt.fingerprint,sourceCommit:'0'.repeat(40)}})],
    ['wrong-promotion',receipt=>resign({...receipt,fingerprint:{...receipt.fingerprint,sourceCommit:'0'.repeat(40)},promotion:{sourceCommit:receipt.fingerprint.sourceCommit,sourceTree:'0'.repeat(40),verifiedSourceCommit:'0'.repeat(40)}})],
    ['focused-command',receipt=>resign({...receipt,command:[...receipt.command,'--deferred-only']})],
    ['duplicate-marker',receipt=>resign({...receipt,reports:[...receipt.reports,{schedulingChild:true}]})]
   ]){
    fs.writeFileSync(ownPath,JSON.stringify(mutate(structuredClone(original))));
    const rejected=await runVerifier(process.execPath,[path.join(cwd,'collect-verification-evidence.mjs'),'--export-owner='+suite],{cwd,env,evidenceDirectory:path.join(cwd,'outer-runner'),timeout:30000});
    assert.equal(rejected.status,1,'COLD_EXPORT_ORACLE: accepted '+name);assert.equal(count(),1);
    if(name==='corrupt-digest'){
     const invalidOwner=`import assert from 'node:assert/strict';import {currentOwnerReport} from './verification-evidence.mjs';let calls=0;await assert.rejects(currentOwnerReport(${JSON.stringify(suite)},'schedulingChild',{run:async()=>{calls++;return JSON.stringify({schedulingChild:true});}}),/receipt content digest mismatch/);assert.equal(calls,0);console.log(JSON.stringify({invalidReceiptFallbackInvocations:calls}));`;
     const invalidControl=await runVerifier(process.execPath,['--input-type=module','-e',invalidOwner],{cwd,env,evidenceDirectory:path.join(cwd,'outer-runner'),timeout:30000});assert.equal(invalidControl.status,0,'OWNER_REPORT_INVALID_ORACLE: '+invalidControl.stderr);
    }
   }
   const promoted=resign({...structuredClone(original),fingerprint:{...original.fingerprint,sourceCommit:'0'.repeat(40)},promotion:{sourceCommit:original.fingerprint.sourceCommit,sourceTree:original.fingerprint.sourceTree,verifiedSourceCommit:'0'.repeat(40)}});
   fs.writeFileSync(ownPath,JSON.stringify(promoted));
   const promotedExport=await runVerifier(process.execPath,[path.join(cwd,'collect-verification-evidence.mjs'),'--export-owner='+suite,'--report-marker=schedulingChild'],{cwd,env,evidenceDirectory:path.join(cwd,'outer-runner'),timeout:30000});
   assert.equal(promotedExport.status,0,'COLD_EXPORT_PROMOTION_ORACLE: '+promotedExport.stderr);assert.equal(count(),1);
   fs.writeFileSync(ownPath,second);
   results.push({mode,invocations:1,collectorExit:collection.status,receiptCount:2,observationCount:2,readOnlyReportExport:true,synthetic:true,actualDeferredMatrix:false});continue;
  }
  const parent=await runVerifier(process.execPath,[path.join(cwd,wrapper)],{cwd,env,evidenceDirectory:path.join(cwd,'outer-runner'),timeout:30000});
  assert(fs.existsSync(path.join(cwd,'invocations.log')),'DUE_RECEIPT_SCHEDULING_BOOTSTRAP_ORACLE: '+parent.stderr);
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
   const nested=fs.readdirSync(path.join(cwd,'nested-runner')).filter(file=>file.endsWith('.json')).map(file=>JSON.parse(fs.readFileSync(path.join(cwd,'nested-runner',file),'utf8')));assert.equal(nested.length,1);assert.equal(nested[0].timeoutMs,timeout);assert.equal(nested[0].outcome,'PASS');
  }
  const aggregate=JSON.parse(fs.readFileSync(path.join(receipts,'evidence.json'),'utf8'));assert.equal(aggregate.receiptCount,2);assert.equal(aggregate.observationCount,2);
  results.push({mode,invocations:count(),parentExit:parent.status,collectorExit:collection.status,stdoutAndStderrForwardedOnce:true,canonicalReceiptOwnsActualCommand:true,sourceRevisionRuntimeIdentical:true,existingReceiptReused:mode==='current-child',actualDeferredMatrix:false});
 }
 return {caseId,result:'PASS',results,formerInvocations:2,currentInvocations:1,existingCompositeTimeoutMs:AGGREGATE_TIMEOUT_MS,producerTimeoutMs:timeout,productionDueAssertionsAltered:false,productionCrossRunAssertionsAltered:false,sourceDirectoryContainsSpaces:true,synthetic:true,actualDeferredMatrix:false,actualCrossRunComparison:false,boundary:'Actual residual dispatch plus existing child supervisor, Node preload, receipt owner and collector; two explicitly synthetic producers only.'};
}
export const verifyDueVerificationScheduling=directory=>verifyCheckedProducerScheduling(directory,'verify-due-stage-timing.mjs','due-composite-producer-receipt-scheduling');
export async function verifyCrossRunVerificationScheduling(directory){
 const result=await verifyCheckedProducerScheduling(directory,'verify-cross-run-comparison.mjs','cross-run-producer-receipt-scheduling');
 const cwd=path.join(directory,'current-child source with spaces'),suite='verify-cross-run-comparison.mjs',receipts=path.join(cwd,'receipts'),receiptPath=path.join(receipts,suite+'.json'),prior=fs.readFileSync(receiptPath,'utf8');
 const env={...process.env,NODE_OPTIONS:'--import '+JSON.stringify(path.join(cwd,'verification-evidence-preload.mjs')),CLOSED_LOOP_VERIFICATION_SOURCE_ROOT:cwd,CLOSED_LOOP_VERIFICATION_RECEIPTS:receipts,SCHEDULING_FIXTURE_MODE:'current-child'},focusedChildren=[];
 for(const [argument,mode,status]of [['--comparison-fault=STABILITY-REPEATED-GROUP-MAPPING','failed-child',1],['--comparison-control','current-child',0],['--stability-aggregate-control','current-child',0],['--projection-recovery-only','current-child',0],['--scheduled-iteration-controls','current-child',0]]){
  const run=await runVerifier(process.execPath,[path.join(cwd,suite),argument],{cwd,env:{...env,SCHEDULING_FIXTURE_MODE:mode},evidenceDirectory:path.join(cwd,'focused-runner'),timeout:30000});
  assert.equal(run.status,status,'CROSS_RUN_FOCUSED_EXIT_ORACLE');
  assert.equal(fs.readFileSync(receiptPath,'utf8'),prior,'CROSS_RUN_FOCUSED_RECEIPT_ORACLE: a scoped child overwrote complete producer evidence.');
  focusedChildren.push({argument,exitCode:run.status,completeReceiptUnchanged:true});
 }
 // An unrelated flag does not gain the focused exclusion: its failed default
 // population must still invalidate the receipt, followed by an actual restore.
 const unrecognized=await runVerifier(process.execPath,[path.join(cwd,suite),'--unrecognized-control'],{cwd,env:{...env,SCHEDULING_FIXTURE_MODE:'failed-child'},evidenceDirectory:path.join(cwd,'focused-runner'),timeout:30000});
 assert.equal(unrecognized.status,1);assert.equal(JSON.parse(fs.readFileSync(receiptPath,'utf8')).complete,false,'CROSS_RUN_FOCUSED_SCOPE_ORACLE');
 const restored=await runVerifier(process.execPath,[path.join(cwd,suite)],{cwd,env,evidenceDirectory:path.join(cwd,'focused-runner'),timeout:30000});
 assert.equal(restored.status,0);assert.equal(JSON.parse(fs.readFileSync(receiptPath,'utf8')).complete,true,'CROSS_RUN_FOCUSED_RESTORE_ORACLE');
 const otherFocused=[];
 // Exact focused modes for the new owning producers preserve their canonical
 // receipts too. These tiny processes assert scheduling, not handoff behavior.
 for(const [extraSuite,arguments_]of [['verify-human-authority-roundtrip.mjs',['--human-stage-save-only']],['verify-handoff-disclosure.mjs',['--fault=authorization','--fault=scan']],['verify-quarantine-recovery.mjs',['--fault=quarantine-files','--fault=quarantine-body-delete']],['verify-due-stage-timing.mjs',['--stage17-receipt-parent-controls','--stage17-correction-parent-controls','--fixture-decoder-bounds','--stage-binding-regressions','--definition-compatibility-witness-only','--definition-compatibility','--evidence-chain-frontier-only','--evidence-chain-faults-only','--deferred-reservations','--conditional-handoff-material','--conditional-independent-retry','--conditional-producer-contracts','--conditional-byte-carriers','--deferred-regression','--deferred-native','--deferred-small','--deferred-only','--regression-only','--deferred-cache-only','--deferred-fixture=declared-disposable-fixture']]]){
  fs.copyFileSync(path.join(cwd,suite),path.join(cwd,extraSuite));
  fs.appendFileSync(path.join(cwd,'verification-evidence-catalog.mjs'),`verificationCatalog[${JSON.stringify(extraSuite)}]={boundary:'synthetic focused receipt fixture',checks:[{id:${JSON.stringify('synthetic.'+extraSuite+'.completed')},marker:'schedulingChild',path:'schedulingChild',expected:true,assertionReference:'tiny explicit arithmetic assertion'}]};\n`);
  const extraPath=path.join(receipts,extraSuite+'.json'),base=await runVerifier(process.execPath,[path.join(cwd,extraSuite)],{cwd,env,evidenceDirectory:path.join(cwd,'focused-runner'),timeout:30000});assert.equal(base.status,0);const complete=fs.readFileSync(extraPath,'utf8');assert.equal(JSON.parse(complete).complete,true);
  for(const argument of arguments_){const status=argument.startsWith('--fault=')?1:0,run=await runVerifier(process.execPath,[path.join(cwd,extraSuite),argument],{cwd,env:{...env,SCHEDULING_FIXTURE_MODE:status?'failed-child':'current-child'},evidenceDirectory:path.join(cwd,'focused-runner'),timeout:30000});assert.equal(run.status,status);assert.equal(fs.readFileSync(extraPath,'utf8'),complete,'FOCUSED_PRODUCER_RECEIPT_ORACLE: '+extraSuite+':'+argument);otherFocused.push({suite:extraSuite,argument,exitCode:status,completeReceiptUnchanged:true});}
  const failed=await runVerifier(process.execPath,[path.join(cwd,extraSuite),'--unrecognized-control'],{cwd,env:{...env,SCHEDULING_FIXTURE_MODE:'failed-child'},evidenceDirectory:path.join(cwd,'focused-runner'),timeout:30000});assert.equal(failed.status,1);assert.equal(JSON.parse(fs.readFileSync(extraPath,'utf8')).complete,false,'FOCUSED_PRODUCER_SCOPE_ORACLE');
  const restored=await runVerifier(process.execPath,[path.join(cwd,extraSuite)],{cwd,env,evidenceDirectory:path.join(cwd,'focused-runner'),timeout:30000});assert.equal(restored.status,0);assert.equal(JSON.parse(fs.readFileSync(extraPath,'utf8')).complete,true,'FOCUSED_PRODUCER_RESTORE_ORACLE');
 }
 return {...result,focusedChildren,otherFocused,unrecognizedFlagStillRecorded:true,restoredDefaultRecorded:true};
}

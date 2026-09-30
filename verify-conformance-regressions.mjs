import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Direct invariant checks precede composed matrices and full lifecycle fixtures.
// This changes failure discovery order; every existing suite still executes.
const suites=[
 "verify-job-confirmation-contract.mjs",
 "verify-reconciliation-confirmation.mjs",
 "verify-verifier-runtime.mjs",
 "verify-file-intake-allocation.mjs",
 "verify-returned-file-allocation.mjs",
 "verify-file-allocation-boundaries.mjs",
 "verify-copy-creation-authority.mjs",
 "verify-archive-creation-authority.mjs",
 "verify-copy-transaction.mjs",
 "verify-primary-information.mjs",
 "verify-primary-error-information.mjs",
 "verify-post-acceptance-lane-selection.mjs",
 "verify-storage-deadlines.mjs",
 "verify-byte-deadlines.mjs",
 "verify-action-finalization.mjs",
 "verify-startup-deadlines.mjs",
 "verify-canonical-boundaries.mjs",
 "verify-canonical-boundary-faults.mjs",
 "verify-workflow-focus.mjs",
 "verify-removal-feedback.mjs",
 "verify-proposal-plan-integrity.mjs",
 "verify-required-operation-scope.mjs",
 "verify-exact-progress.mjs",
 "verify-exact-progress-fault.mjs",
 "verify-recovery-control-fault.mjs",
 "verify-history-selection-capture.mjs",
 "verify-history-selection-fault.mjs",
 "verify-context-provenance.mjs",
 "verify-ui-acceptance-impact.mjs",
 "verify-acceptance-active-work.mjs",
 "verify-package-response-identity.mjs",
 "verify-clarification-continuation.mjs",
 "verify-mutation-impact-projections.mjs",
 "verify-response-selection-status.mjs",
 "verify-file-selection-drafts.mjs",
 "verify-file-correction-recovery.mjs",
 "verify-file-correction-faults.mjs",
 "verify-history-view-cost.mjs",
 "verify-history-project-references.mjs",
 "verify-quarantine-recovery.mjs",
 "verify-integrity-recovery-faults.mjs",
 "verify-ui-persistence-preconditions.mjs",
 "verify-filename-transports.mjs",
 "verify-unicode-filenames.mjs",
 "verify-unicode-faults.mjs",
 "verify-encrypted-backups.mjs",
 "verify-encrypted-backup-faults.mjs",
 "verify-canonical-allocation.mjs",
 "verify-canonical-allocation-faults.mjs",
 "verify-operational-persistence.mjs",
 "verify-operational-faults.mjs",
 "verify-recoverable-history.mjs",
 "verify-history-contracts.mjs",
 "verify-history-sequences.mjs",
 "verify-history-navigation.mjs",
 "verify-history-project-lifecycle.mjs",
 "verify-history-retention.mjs",
 "verify-operator-action-lifecycle.mjs",
 "verify-operator-feedback.mjs",
 "verify-shared-contract-faults.mjs",
 "verify-operation-sequences.mjs",
 "verify-mobile-operation-observations.mjs",
 "verify-mobile-receipt-boundary.mjs",
 "verify-execution-identity-allocation.mjs",
 "verify-project-identity-allocation.mjs",
 "verify-response-retry-persistence.mjs",
 "verify-response-retry-fault.mjs",
 "verify-operator-control-state-fault.mjs",
 "verify-reservation-scope-sequences.mjs",
 "verify-product-reservation-persistence.mjs",
 "verify-primary-guidance.mjs",
 "verify-creation-presentation-faults.mjs",
 "verify-io-boundary-faults.mjs",
 "verify-acceptance-boundary-faults.mjs",
 "verify-history-project-sharing.mjs",
 "verify-history-canonical-sharing.mjs",
 "verify-history-project-sharing-faults.mjs",
 "verify-recovery-faults.mjs",
 "verify-delivery-transfer-boundary.mjs",
 "verify-checkpoint-boundary.mjs",
 "verify-native-proof-journey.mjs",
 "verify-native-proof-fault.mjs",
 "verify-product-attachment-journey.mjs",
 "verify-operator-counterpart.mjs",
 "verify-counterpart-faults.mjs"];
function conformanceSources(){
 const verifierRuntimeConsumers=fs.readdirSync('.').filter(path=>/\.mjs$/.test(path)&&fs.readFileSync(path,'utf8').includes("from './verifier-runtime.mjs'"));
 return [...new Set(['.github/workflows/pages.yml','verify-conformance-regressions.mjs','operator-browser-driver.mjs','verify-browser.mjs','verify-browser-extra.mjs','verify-mobile-stage-action.mjs','verify-complete-operator-journey.mjs','verify-acceptance-viewport.mjs','verifier-runtime.mjs','workbook.js','hash.js','app-core.js','index.html','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','test-runtime.js','test-worker.js','test-project-store-runtime.mjs','test-app-markup.mjs','test-artifact-fixtures.mjs','stage19-fixture.mjs','verify-mobile-acceptance-evidence.mjs',...verifierRuntimeConsumers,...suites])];
}

const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const CHILD_TIMEOUT_MS=20*60*1000,AGGREGATE_TIMEOUT_MS=180*60*1000,KILL_GRACE_MS=5000;
const MAX_OUTPUT_BYTES=64*1024*1024;
export const CREATION_MATRIX_TIMEOUT_MS=40*60*1000;
let synchronousGateNumber=0;
// Synchronous fault matrices run inside the existing process-group supervisor.
// Preserve every child result before its caller classifies a deliberate failure.
export function runVerifierSync(command,args,options={}){
 const timeout=options.timeout??CHILD_TIMEOUT_MS;
 assert.ok(Number.isFinite(timeout)&&timeout>0,'VERIFIER_CHILD_DEADLINE_ORACLE');
 const directory=path.resolve(options.evidenceDirectory||process.env.VERIFIER_CHILD_EVIDENCE_DIRECTORY||'conformance-regression-evidence/child-processes');
 fs.mkdirSync(directory,{recursive:true});
 const prefix=path.join(directory,process.pid+'-'+String(++synchronousGateNumber).padStart(4,'0')+'-'+crypto.randomUUID());
 const startedAt=new Date().toISOString();
 const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:MAX_OUTPUT_BYTES,...options,timeout,killSignal:'SIGKILL'});
 const receipt={command:[command,...args],startedAt,finishedAt:new Date().toISOString(),timeoutMs:timeout,exitCode:result.status,signal:result.signal,outcome:result.error?.code==='ETIMEDOUT'?'TIMEOUT':result.status===0&&!result.error&&!result.signal?'PASS':'FAIL',error:result.error?{code:result.error.code,message:result.error.message}:null,stdout:result.stdout||'',stderr:result.stderr||''};
 receipt.stdoutSha256=sha(receipt.stdout);receipt.stderrSha256=sha(receipt.stderr);
 fs.writeFileSync(prefix+'.stdout.log',receipt.stdout);fs.writeFileSync(prefix+'.stderr.log',receipt.stderr);saveReport(prefix+'.json',receipt);
 return {...result,startedAt,finishedAt:receipt.finishedAt,timeoutMs:timeout,outcome:receipt.outcome,evidencePath:prefix+'.json'};
}
function failureDiagnostic(text){
 const errors=[...String(text||'').matchAll(/^([A-Za-z_$][\w$.]*Error|Error)(?: \[[^\]\n]+\])?: ([^\n]*)/gm)],terminal=errors.at(-1);
 if(terminal)return {hasError:true,aggregate:terminal[1]==='AggregateError',message:['Error','AssertionError'].includes(terminal[1])?terminal[2]:''};
 return {hasError:false,message:(String(text||'').trim().split('\n').at(-1)||'').match(/^[A-Z][A-Z0-9_]*_ORACLE(?::.*)?$/)?.[0]||''};
}
export function detectedFault(result,oracle,{caseId=null}={}){
 const exitCode=Object.hasOwn(result,'exitCode')?result.exitCode:result.status;
 // Node may print source lines containing an oracle before an unrelated
 // ReferenceError. Match the actual terminal diagnostic, never source excerpts,
 // success output, or earlier progress messages.
 const terminal=failureDiagnostic(result.stderr),diagnostics=caseId?[]:[terminal.message];
 if(terminal.hasError&&!terminal.message&&!terminal.aggregate)return false;
 if(caseId||terminal.aggregate||!terminal.hasError&&!terminal.message){
  try{
   const report=JSON.parse(String(result.stdout||''));
   for(const row of [...(Array.isArray(report.cases)?report.cases:[]),...(Array.isArray(report.results)?report.results:[])]){
    if((row.status||row.result)!=='FAIL')continue;
    const diagnostic=failureDiagnostic(row.actual?.error||row.error||row.failure);
    if(terminal.aggregate&&!diagnostic.message)return false;
    if(!caseId||row.caseId===caseId)diagnostics.push(diagnostic.message);
   }
  }catch{/* A missing or malformed report supplies no fault evidence. */}
 }
 const matches=diagnostic=>oracle instanceof RegExp?new RegExp(oracle.source,oracle.flags.replace(/[gy]/g,'')).test(diagnostic):typeof oracle==='string'&&oracle.length>0&&diagnostic.includes(oracle);
 if(caseId&&terminal.message&&!matches(terminal.message))return false;
 const matched=diagnostics.some(matches);
 return exitCode===1&&!result.signal&&!result.error&&!result.reason&&(!result.outcome||result.outcome==='FAIL')&&matched;
}
export function assertDetectedFault(result,oracle,label='injected fault',options={}){
 assert.ok(detectedFault(result,oracle,options),'FAULT_RESULT_CLASSIFICATION_ORACLE: '+label+' must finish with exit 1 and its specific oracle, without timeout, signal, or execution error. '+JSON.stringify({exitCode:result.exitCode??result.status,signal:result.signal,error:result.error?.code,reason:result.reason,outcome:result.outcome,oracle:String(oracle),evidencePath:result.evidencePath})+'\n'+String(result.stderr||''));
}
function saveReport(file,report){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const temporary=file+'.partial';fs.writeFileSync(temporary,JSON.stringify(report,null,2)+'\n');fs.renameSync(temporary,file);
}
export function executeGate(gate,{directory,signal,timeoutMs=CHILD_TIMEOUT_MS,killGraceMs=KILL_GRACE_MS,env={},requireJson=true}={}){
 return new Promise(resolve=>{
  fs.mkdirSync(directory,{recursive:true});
  const stdoutPath=path.join(directory,gate.name+'.stdout.log'),stderrPath=path.join(directory,gate.name+'.stderr.log');
  const out=fs.openSync(stdoutPath,'w'),err=fs.openSync(stderrPath,'w'),startedAt=new Date().toISOString();
  let reason=null,error=null,deadline,killDeadline,stdoutBytes=0,stderrBytes=0;
  const child=spawn(process.execPath,gate.args,{env:{...process.env,...env},detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
  const kill=kind=>{if(!child.pid)return;try{if(process.platform==='win32')child.kill(kind);else process.kill(-child.pid,kind);}catch(e){if(e.code!=='ESRCH')error={code:e.code,message:e.message};}};
  const stop=why=>{if(reason)return;reason=why;kill('SIGTERM');killDeadline=setTimeout(()=>kill('SIGKILL'),killGraceMs);};
  const abort=()=>stop(signal.reason||'INTERRUPTED');
  if(signal){signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();}
  deadline=setTimeout(()=>stop('TIMEOUT'),timeoutMs);
  child.stdout.on('data',bytes=>{fs.writeSync(out,bytes);stdoutBytes+=bytes.length;if(stdoutBytes>MAX_OUTPUT_BYTES)stop('OUTPUT_LIMIT');});
  child.stderr.on('data',bytes=>{fs.writeSync(err,bytes);stderrBytes+=bytes.length;if(stderrBytes>MAX_OUTPUT_BYTES)stop('OUTPUT_LIMIT');});
  child.on('error',e=>{error={code:e.code,message:e.message};});
  child.on('close',(exitCode,terminationSignal)=>{
   clearTimeout(deadline);clearTimeout(killDeadline);signal?.removeEventListener('abort',abort);fs.closeSync(out);fs.closeSync(err);
   // A child can exit on TERM while its descendant retains work. Close the
   // entire group before another gate can observe a fault-injected source.
   kill('SIGKILL');
   const stdout=fs.readFileSync(stdoutPath,'utf8'),stderr=fs.readFileSync(stderrPath,'utf8');
   let report=null,reportError=null;try{if(requireJson){report=JSON.parse(stdout);if(!report||typeof report!=='object'||Array.isArray(report))throw new Error('Expected one JSON object.');}}catch(e){reportError=e.message;}
   const outcome=reason==='TIMEOUT'||reason==='AGGREGATE_TIMEOUT'?'TIMEOUT':exitCode===0&&!error&&!reason&&!reportError?'PASS':'FAIL';
   resolve({suite:gate.name,command:[process.execPath,...gate.args],startedAt,finishedAt:new Date().toISOString(),timeoutMs,exitCode,signal:terminationSignal,outcome,reason,error,reportError,stdout,stderr,stdoutSha256:sha(stdout),stderrSha256:sha(stderr),stdoutPath,stderrPath,report});
  });
 });
}
async function runSequence(gates,{directory,reportFile,report={},timeoutMs=AGGREGATE_TIMEOUT_MS,childTimeoutMs=CHILD_TIMEOUT_MS,signal,killGraceMs=KILL_GRACE_MS}={}){
 const controller=new AbortController(),relay=()=>controller.abort(signal.reason||'INTERRUPTED');
 signal?.addEventListener('abort',relay,{once:true});if(signal?.aborted)relay();
 const deadline=setTimeout(()=>controller.abort('AGGREGATE_TIMEOUT'),timeoutMs);
 report.results=[];report.pending=gates.map(gate=>gate.name);report.running=null;report.complete=false;report.outcome='RUNNING';report.aggregateTimeoutMs=timeoutMs;
 const persist=()=>saveReport(reportFile,report);persist();
 try{
  for(const gate of gates){
   if(controller.signal.aborted)break;
   report.running={suite:gate.name,startedAt:new Date().toISOString()};persist();
   process.stderr.write(`Running ${gate.name}\n`);
   const result=await executeGate(gate,{directory,signal:controller.signal,timeoutMs:gate.timeoutMs??childTimeoutMs,killGraceMs});
   report.results.push(result);report.pending.shift();report.running=null;persist();
   process.stderr.write(`${result.outcome} ${gate.name} (${result.exitCode??result.signal??result.reason})\n`);
   if(result.outcome!=='PASS'){process.stderr.write(`${result.stdout}\n${result.stderr}\n${result.reportError||result.reason||''}\n`);break;}
  }
  report.complete=report.pending.length===0;
  report.outcome=controller.signal.reason==='AGGREGATE_TIMEOUT'||report.results.some(r=>r.outcome==='TIMEOUT')?'TIMEOUT':report.complete&&report.results.every(r=>r.outcome==='PASS')?'PASS':'FAIL';
  report.interruption=controller.signal.reason||null;persist();return report;
 }finally{clearTimeout(deadline);signal?.removeEventListener('abort',relay);}
}
function verifyLifecycleFaultDispatch(directory){
 const source=fs.readFileSync('verify-full-cycle.mjs','utf8');
 const start=source.indexOf('const timingFaultDefinitions='),end=source.indexOf('globalThis.Event=',start);
 assert.ok(start>=0&&end>start,'FAULT_EXECUTION_OWNER_FIXTURE_ORACLE');
 const prelude=source.slice(start,end),results=[];
 function execute(label,body,imported){
  const folder=path.join(directory,label);fs.mkdirSync(folder,{recursive:true});
  const owner=path.join(folder,'renamed-lifecycle.mjs'),launcher=path.join(folder,'importing-verifier.mjs'),trace=path.join(folder,'caller-entries.log');
  fs.writeFileSync(owner,`import fs from 'node:fs';\nimport {runVerifierSync,detectedFault} from ${JSON.stringify(import.meta.url)};\n`+body.replace("'conformance-regression-evidence/timing-faults'",JSON.stringify(path.join(folder,'faults')))+`\nif(timingFault)throw new Error(timingFault.oracle);console.log(JSON.stringify({faults:timingInjectedFaults}));\n`);
  fs.writeFileSync(launcher,`import fs from 'node:fs';fs.appendFileSync(${JSON.stringify(trace)},'entered\\n');await import(${JSON.stringify(new URL('file://'+owner).href)});\n`);
  const child=runVerifierSync(process.execPath,[imported?launcher:owner],{timeout:15000,evidenceDirectory:folder});
  assert.equal(child.status,0,'FAULT_EXECUTION_OWNER_CONTROL_ORACLE: '+child.stderr);
  const callerEntries=fs.existsSync(trace)?fs.readFileSync(trace,'utf8').trim().split('\n').length:0;
  return {label,imported,callerEntries,expectedCallerEntries:imported?1:0,child,report:JSON.parse(child.stdout)};
 }
 function check(observation){assert.equal(observation.callerEntries,observation.expectedCallerEntries,'FAULT_EXECUTION_OWNER_ORACLE: a shared verifier fault must execute its owner without rerunning the importing caller');}
 for(const imported of [false,true]){const result=execute(imported?'imported':'direct',prelude,imported);check(result);results.push(result);}
 const before="runVerifierSync(process.execPath,[import.meta.filename,'--timing-only'",after="runVerifierSync(process.execPath,[process.argv[1],'--timing-only'";
 assert.equal(prelude.split(before).length,2,'FAULT_EXECUTION_OWNER_MUTATION_ANCHOR_ORACLE');
 const mutant=execute('wrong-caller',prelude.replace(before,after),true);
 assert.throws(()=>check(mutant),error=>error.code==='ERR_ASSERTION'&&error.message.startsWith('FAULT_EXECUTION_OWNER_ORACLE'),'FAULT_EXECUTION_OWNER_MUTATION_DETECTED_ORACLE');
 const restored=execute('restored',prelude,true);check(restored);
 return {basis:'Actual lifecycle dispatch prelude; disposable child failures. Production timing invariants execute separately.',results,mutant,restored};
}
async function verifyRunnerContract(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'clrt-runner-contract-')),cases=[];
 const gate=(name,code)=>({name,args:['--input-type=module','-e',code]});
 try{
  const importProbe=runVerifierSync(process.execPath,['--input-type=module','-e',`import fs from 'node:fs';const original=fs.readFileSync,reads=[];fs.readFileSync=function(file,...args){if(typeof file==='string'&&file.endsWith('.mjs'))reads.push(file);return original.call(this,file,...args);};await import(${JSON.stringify(import.meta.url)});fs.readFileSync=original;console.log(JSON.stringify({reads}));`],{timeout:5000,evidenceDirectory:directory});
  assert.equal(importProbe.status,0,'HELPER_IMPORT_EXECUTION_ORACLE: '+importProbe.stderr);
  assert.deepEqual(JSON.parse(importProbe.stdout).reads,[],'HELPER_IMPORT_IO_ORACLE: importing child supervision must not scan unrelated verifier files');
  cases.push({case:'helper-import-does-not-enumerate-project-sources',importProbe});
  cases.push({case:'shared-lifecycle-faults-execute-their-owner',...verifyLifecycleFaultDispatch(directory)});
  const expected='CONTROLLED_ASSERTION_ORACLE';
  const rejection={status:1,signal:null,stderr:'AssertionError: '+expected,stdout:''};
  const faultOutcomes=[];
  for(const [name,changes,wanted] of [
   ['specific-rejection',{},true],['success',{status:0},false],['other-exit',{status:7},false],
   ['signal',{status:null,signal:'SIGKILL'},false],['timeout',{status:null,error:{code:'ETIMEDOUT'}},false],
   ['execution-error',{error:{code:'EIO'}},false],['interruption',{reason:'SIGTERM'},false],
   ['declared-timeout',{outcome:'TIMEOUT'},false],['different-oracle',{stderr:'AssertionError: OTHER_ORACLE'},false],
   ['oracle-only-in-source',{stderr:"assert.equal(undefinedValue,1,'"+expected+"');\nReferenceError: undefinedValue is not defined"},false],
   ['oracle-only-in-success-output',{stdout:expected,stderr:'Error: unrelated failure'},false],
   ['earlier-oracle-before-crash',{stderr:'Error: '+expected+'\nReferenceError: unrelated crash'},false],
   ['explicit-failure-marker',{stderr:expected+': controlled failed case'},true],
   ['structured-assertion',{stderr:'',stdout:JSON.stringify({cases:[{caseId:'case',status:'FAIL',actual:{error:'AssertionError: '+expected}}]})},true],
   ['structured-unrelated-crash',{stderr:'',stdout:JSON.stringify({cases:[{caseId:'case',status:'FAIL',actual:{error:"assert(value,'"+expected+"');\nReferenceError: value is not defined"}}]})},false],
   ['structured-passing-case',{stderr:'',stdout:JSON.stringify({cases:[{caseId:'case',status:'PASS',actual:{error:'AssertionError: '+expected}}]})},false]
  ]){const observed={...rejection,...changes};assert.equal(detectedFault(observed,expected),wanted,'FAULT_RESULT_CLASSIFICATION_ORACLE: '+name);faultOutcomes.push({name,wanted,observed});}
  cases.push({case:'fault-detection-requires-completed-specific-rejection',results:faultOutcomes});
  const distinctCases={status:1,stderr:'',stdout:JSON.stringify({cases:[{caseId:'intended',status:'FAIL',actual:{error:'ReferenceError: fixture crashed'}},{caseId:'other',status:'FAIL',actual:{error:'AssertionError: '+expected}}]})};
  assert.equal(detectedFault(distinctCases,expected,{caseId:'intended'}),false,'FAULT_NAMED_CASE_ORACLE: another failed case cannot supply the intended rejection');
  assert.equal(detectedFault(distinctCases,expected,{caseId:'other'}),true,'FAULT_NAMED_CASE_CONTROL_ORACLE');
  assert.equal(detectedFault({...distinctCases,stderr:'AssertionError: unrelated fixture finalization failure'},expected,{caseId:'other'}),false,'FAULT_TERMINAL_DIAGNOSTIC_ORACLE: a matching report cannot mask a different terminal assertion');
  cases.push({case:'fault-diagnostic-is-bound-to-the-requested-case',input:distinctCases});
  const aggregate={status:1,stderr:'AggregateError: reported cases failed',stdout:JSON.stringify({cases:[{caseId:'intended',status:'FAIL',error:'AssertionError: '+expected}]})};
  assert.equal(detectedFault(aggregate,expected,{caseId:'intended'}),true,'FAULT_AGGREGATE_ASSERTION_ORACLE');
  assert.equal(detectedFault({...aggregate,stdout:distinctCases.stdout},expected,{caseId:'other'}),false,'FAULT_AGGREGATE_CRASH_ORACLE: a mixed crash/assertion aggregate is not isolated fault detection');
  assert.equal(detectedFault({...aggregate,stdout:'{}'},expected),false,'FAULT_AGGREGATE_REPORT_ORACLE');
  cases.push({case:'aggregate-errors-require-actual-failed-case-diagnostics',input:aggregate});
  const stalledFault=runVerifierSync(process.execPath,['--input-type=module','-e',`console.error(${JSON.stringify(expected)});setInterval(()=>{},1000)`],{timeout:250,evidenceDirectory:directory});
  assert.equal(stalledFault.outcome,'TIMEOUT','FAULT_CHILD_TIMEOUT_ORACLE');
  assert.ok(stalledFault.stderr.includes(expected),'FAULT_CHILD_LAST_PHASE_ORACLE');
  assert.equal(detectedFault(stalledFault,expected),false,'FAULT_CHILD_TIMEOUT_NOT_DETECTION_ORACLE');
  const healthyChild=runVerifierSync(process.execPath,['--input-type=module','-e',"console.log('healthy control')"],{timeout:3000,evidenceDirectory:directory});
  assert.equal(healthyChild.status,0,'FAULT_CHILD_HEALTHY_CONTROL_ORACLE');
  for(const child of [stalledFault,healthyChild]){const saved=JSON.parse(fs.readFileSync(child.evidencePath,'utf8'));assert.equal(saved.stdout,child.stdout,'FAULT_CHILD_RAW_OUTPUT_ORACLE');assert.equal(saved.stderr,child.stderr,'FAULT_CHILD_RAW_OUTPUT_ORACLE');assert.equal(saved.exitCode,child.status,'FAULT_CHILD_EXIT_STATUS_ORACLE');}
  cases.push({case:'bounded-synchronous-child-evidence',stalledFault,healthyChild});
  const unrelatedCrash=runVerifierSync(process.execPath,['--input-type=module','-e',`import assert from 'node:assert/strict';assert.equal(undefinedValue,1,${JSON.stringify(expected)});`],{timeout:3000,evidenceDirectory:directory});
  assert.equal(unrelatedCrash.status,1);assert.ok(unrelatedCrash.stderr.includes(expected));
  assert.equal(detectedFault(unrelatedCrash,expected),false,'FAULT_DIAGNOSTIC_ORACLE: a source excerpt is not the failing assertion');
  cases.push({case:'unrelated-crash-with-oracle-in-source',result:unrelatedCrash});
  for(const [name,code,expected]of [
   ['valid',"console.log(JSON.stringify({case:'valid',result:'PASS'}))",'PASS'],
   ['nonzero',"console.log(JSON.stringify({declared:'PASS'}));process.exitCode=7",'FAIL'],
   ['malformed',"console.log('{broken')",'FAIL'],
   ['multiple-documents',"console.log('{}');console.log('{}')",'FAIL'],
   ['null-report',"console.log('null')",'FAIL'],
   ['stalled',"console.log('last-phase');process.on('SIGTERM',()=>{});setInterval(()=>{},1000)",'TIMEOUT']
  ]){
   const result=await executeGate(gate(name,code),{directory,timeoutMs:name==='stalled'?250:3000,killGraceMs:50});
   assert.equal(result.outcome,expected,'RUNNER_OUTCOME_ORACLE: '+name);
   assert.equal(fs.readFileSync(result.stdoutPath,'utf8'),result.stdout,'RUNNER_RAW_OUTPUT_ORACLE');
   assert.equal(sha(result.stdout),result.stdoutSha256,'RUNNER_RAW_HASH_ORACLE');
   cases.push(result);
  }
  const composite=await runSequence([{...gate('composite-budget',"setTimeout(()=>console.log('{}'),150)"),timeoutMs:800}],{directory,reportFile:path.join(directory,'composite.json'),timeoutMs:2000,childTimeoutMs:50,killGraceMs:50});
  assert.equal(composite.outcome,'PASS','RUNNER_COMPOSITE_BUDGET_ORACLE: a composed gate must use its declared finite budget within the aggregate deadline.');
  cases.push({case:'composite-retains-declared-bounded-budget',result:composite});
  const descendantMarker=path.join(directory,'descendant.txt');
  const descendant=await executeGate(gate('stalled-descendant',`import {spawn} from 'node:child_process';const child=spawn(process.execPath,['-e',${JSON.stringify("const fs=require('node:fs');process.on('SIGTERM',()=>{});setInterval(()=>fs.appendFileSync("+JSON.stringify(descendantMarker)+",'x'),10);")}],{stdio:'ignore'});console.log(JSON.stringify({child:child.pid}));setInterval(()=>{},1000);`),{directory,timeoutMs:500,killGraceMs:50});
  assert.equal(descendant.outcome,'TIMEOUT','RUNNER_DESCENDANT_TIMEOUT_ORACLE');
  assert.ok(fs.existsSync(descendantMarker),'RUNNER_DESCENDANT_STARTED_ORACLE');
  const stoppedBytes=fs.readFileSync(descendantMarker,'utf8');await new Promise(resolve=>setTimeout(resolve,80));
  assert.equal(fs.readFileSync(descendantMarker,'utf8'),stoppedBytes,'RUNNER_DESCENDANT_STOPPED_ORACLE');cases.push(descendant);
  const controller=new AbortController(),reportFile=path.join(directory,'interruption.json');
  const running=runSequence([gate('completed',"console.log('{\"done\":true}')"),gate('interrupted',"console.log('entered-wait');setInterval(()=>{},1000)"),gate('unexecuted',"console.log('{}')")],{directory,reportFile,signal:controller.signal,timeoutMs:5000,childTimeoutMs:4000,killGraceMs:50});
  const interruption=setTimeout(()=>controller.abort('CONTRACT_DEADLINE'),4000);
  try{
   const observedBy=Date.now()+3000;
   while(Date.now()<observedBy&&(!fs.existsSync(reportFile)||JSON.parse(fs.readFileSync(reportFile,'utf8')).results.length<1))await new Promise(resolve=>setTimeout(resolve,10));
   assert.ok(fs.existsSync(reportFile),'RUNNER_INCREMENTAL_EVIDENCE_ORACLE');
   const saved=JSON.parse(fs.readFileSync(reportFile,'utf8'));
   assert.equal(saved.results[0]?.outcome,'PASS','RUNNER_INCREMENTAL_EVIDENCE_ORACLE');
   controller.abort('CONTRACT_INTERRUPTION');
   const result=await running;
   assert.equal(result.outcome,'FAIL','RUNNER_INTERRUPTION_ORACLE');
   assert.equal(result.results[1].reason,'CONTRACT_INTERRUPTION','RUNNER_INTERRUPTION_ORACLE');
   assert.deepEqual(result.pending,['unexecuted'],'RUNNER_UNEXECUTED_ORACLE');
   assert.equal(JSON.parse(fs.readFileSync(reportFile,'utf8')).results[0].stdout,result.results[0].stdout,'RUNNER_RETAIN_COMPLETED_ORACLE');
   cases.push({case:'interruption-retains-completed-and-pending',result});
  }finally{clearTimeout(interruption);controller.abort('CONTRACT_CLEANUP');await running;}
  const stopped=await runSequence([gate('failed',"console.log('{}');process.exitCode=1"),gate('must-not-run',"throw new Error('Must remain pending')")],{directory,reportFile:path.join(directory,'failure.json'),timeoutMs:2000});
  assert.equal(stopped.outcome,'FAIL','RUNNER_FAILURE_ORACLE');assert.equal(stopped.results.length,1,'RUNNER_FAIL_FAST_ORACLE');assert.deepEqual(stopped.pending,['must-not-run'],'RUNNER_FAIL_FAST_ORACLE');
  cases.push({case:'failure-stops-without-claiming-pending-proof',result:stopped});
  return {runnerContract:'PASS',cases};
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
async function verifyCreationMatrixContract(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'clrt-creation-contract-')),results=[];
 const original=fs.readFileSync(process.env.CREATION_MATRIX_SOURCE||'verify-creation-presentation-faults.mjs','utf8').replace("from './verify-conformance-regressions.mjs'","from "+JSON.stringify(new URL('./verify-conformance-regressions.mjs',import.meta.url).href));
 const start=original.indexOf('const cases=['),end=original.indexOf('const directory=',start);
 assert.ok(start>=0&&end>start,'CREATION_MATRIX_FIXTURE_ORACLE: existing fault definitions must be replaceable by disposable controls.');
 const fixture=path.join(directory,'fixture.mjs'),sourceFile=path.join(directory,'source.js');
 fs.writeFileSync(sourceFile,'const retained = true;\n');
 try{
  for(const mode of ['specific-rejection','stalled-after-oracle','unrelated-rejection','source-excerpt-rejection','interrupted-after-completed-child']){
   fs.writeFileSync(fixture,`if(${JSON.stringify(mode)}==='interrupted-after-completed-child'&&String(process.env.MATRIX_FAULT_SOURCE).includes('interrupted-')){console.error('last-phase: interrupted-child');setInterval(()=>{},1000);setTimeout(()=>process.exit(99),6000);}else if(process.env.MATRIX_FAULT_SOURCE){console.error('last-phase: injected-child');if(${JSON.stringify(mode)}==='source-excerpt-rejection'){console.error("assert(missingValue,'CONTROLLED_MATRIX_REJECTION');");throw new ReferenceError('missingValue is not defined');}console.error(${JSON.stringify('Error: '+(mode==='unrelated-rejection'?'OTHER_REJECTION':'CONTROLLED_MATRIX_REJECTION'))});${mode==='stalled-after-oracle'?"setInterval(()=>{},1000);setTimeout(()=>process.exit(99),6000);":"process.exitCode=1;"}}else{if(${JSON.stringify(mode)}==='specific-rejection')await new Promise(resolve=>setTimeout(resolve,250));console.log(JSON.stringify({healthy:true}));}\n`);
   const cases=[{id:'controlled-'+mode,file:sourceFile,env:'MATRIX_FAULT_SOURCE',suite:fixture,oracle:'CONTROLLED_MATRIX_REJECTION',before:'true',after:'false'}];
   if(mode==='interrupted-after-completed-child'){cases[0].id='completed-child';cases.push({...cases[0],id:'interrupted-child'});}
   const matrix=path.join(directory,mode+'.mjs');
   fs.writeFileSync(matrix,"process.env.CREATION_FAULT_CHILD_TIMEOUT_MS="+JSON.stringify(mode==='interrupted-after-completed-child'?'5000':mode==='stalled-after-oracle'?'750':'3000')+";process.env.CREATION_FAULT_EVIDENCE_DIRECTORY="+JSON.stringify(path.join(directory,'evidence-'+mode))+";\n"+original.slice(0,start)+'const cases='+JSON.stringify(cases)+';\n'+original.slice(end));
   const observed=await executeGate({name:'creation-'+mode,args:[matrix]},{directory,timeoutMs:mode==='interrupted-after-completed-child'?800:5000,killGraceMs:50});
   results.push({mode,observed});
   if(mode==='specific-rejection'){
    assert.equal(observed.outcome,'PASS','CREATION_MATRIX_SPECIFIC_REJECTION_ORACLE');
    assert.equal(observed.report.results[0].detected,true,'CREATION_MATRIX_SPECIFIC_REJECTION_ORACLE');
    assert.equal(observed.report.results.at(-1).exitCode,0,'CREATION_MATRIX_RESTORED_CONTROL_ORACLE');
   }else if(mode==='stalled-after-oracle'){
    assert.equal(observed.outcome,'FAIL','CREATION_MATRIX_TIMEOUT_ORACLE: the matrix must report its child timeout before its own supervisor expires.');
    const child=observed.report?.results[0];
    assert.equal(child?.outcome,'TIMEOUT','CREATION_MATRIX_TIMEOUT_ORACLE');
    assert.equal(child.detected,false,'CREATION_MATRIX_TIMEOUT_NOT_DETECTION_ORACLE');
    assert.ok(child.stderr.includes('last-phase: injected-child'),'CREATION_MATRIX_RAW_OUTPUT_ORACLE');
    assert.ok(observed.stderr.includes('controlled-'+mode),'CREATION_MATRIX_LAST_PHASE_ORACLE');
   }else if(mode==='interrupted-after-completed-child'){
    assert.equal(observed.outcome,'TIMEOUT','CREATION_MATRIX_INTERRUPTION_ORACLE');
    const savedFile=path.join(directory,'evidence-'+mode,'report.json');
    assert.ok(fs.existsSync(savedFile),'CREATION_MATRIX_INCREMENTAL_EVIDENCE_ORACLE');
    const saved=JSON.parse(fs.readFileSync(savedFile,'utf8'));
    assert.equal(saved.results[0]?.detected,true,'CREATION_MATRIX_INCREMENTAL_EVIDENCE_ORACLE');
    assert.equal(saved.results.at(-1)?.id,'interrupted-child','CREATION_MATRIX_LAST_PHASE_ORACLE');
    assert.equal(saved.results.at(-1)?.reason,'SIGTERM','CREATION_MATRIX_INTERRUPTED_CHILD_ORACLE');
    assert.equal(saved.results.at(-1)?.detected,false,'CREATION_MATRIX_INTERRUPTION_NOT_DETECTION_ORACLE');
    assert.equal(saved.complete,false,'CREATION_MATRIX_UNFINISHED_ORACLE');
    assert.ok(fs.readFileSync(path.join(directory,'evidence-'+mode,'interrupted-child.stderr.log'),'utf8').includes('last-phase: interrupted-child'),'CREATION_MATRIX_RAW_OUTPUT_ORACLE');
    results.at(-1).retained=saved;
   }else{
    assert.equal(observed.outcome,'FAIL','CREATION_MATRIX_REJECTION_REASON_ORACLE');
    assert.equal(observed.report?.results[0]?.detected,false,'CREATION_MATRIX_REJECTION_REASON_ORACLE');
   }
  }
  return {caseId:'CREATION_MATRIX_BOUNDED_FAULT_EVIDENCE',result:'PASS',synthetic:true,actualBrowser:false,results};
 }finally{process.stderr.write(JSON.stringify({caseId:'CREATION_MATRIX_BOUNDED_FAULT_EVIDENCE',results})+'\n');fs.rmSync(directory,{recursive:true,force:true});}
}
async function verifyCreationMatrixFaults(){
 const original=fs.readFileSync('verify-creation-presentation-faults.mjs','utf8'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'clrt-creation-faults-')),results=[];
 try{
  for(const [name,before,after,oracle] of [
   ['missing-child-deadline','timeoutMs:childTimeoutMs,','', 'CREATION_MATRIX_TIMEOUT_ORACLE'],
   ['timeout-counted-as-rejection','detectedFault(observed,item.oracle)','observed.stderr.includes(item.oracle)', 'CREATION_MATRIX_TIMEOUT_ORACLE'],
   ['lost-incremental-evidence','const persist=()=>{','const persist=()=>{return;', 'CREATION_MATRIX_INCREMENTAL_EVIDENCE_ORACLE'],
   ['lost-parent-interruption','signal:controller.signal,','', 'CREATION_MATRIX_LAST_PHASE_ORACLE'],
   ['unrelated-rejection-accepted','detectedFault(observed,item.oracle)','observed.exitCode===1', 'CREATION_MATRIX_REJECTION_REASON_ORACLE']
  ]){
   assert.equal(original.split(before).length,2,'Unique matrix fault anchor required: '+name);
   const file=path.join(directory,name+'.mjs');fs.writeFileSync(file,original.replace(before,after));
   const observed=await executeGate({name,args:[fileURLToPath(import.meta.url),'--creation-matrix-contract-only']},{directory,env:{CREATION_MATRIX_SOURCE:file},timeoutMs:12000,killGraceMs:50});
   assert.equal(observed.outcome,'FAIL','CREATION_MATRIX_FAULT_DETECTION_ORACLE: '+name);
   assertDetectedFault(observed,oracle,'CREATION_MATRIX_FAULT_SPECIFICITY_ORACLE: '+name);
   results.push({name,oracle,result:'DETECTED',observed});
  }
  assert.equal(fs.readFileSync('verify-creation-presentation-faults.mjs','utf8'),original,'CREATION_MATRIX_SOURCE_RESTORED_ORACLE');
  return {results,sourceRestored:true};
 }finally{process.stderr.write(JSON.stringify({caseId:'CREATION_MATRIX_SUPERVISOR_FAULTS',results})+'\n');fs.rmSync(directory,{recursive:true,force:true});}
}
async function verifyRunnerFaults(){
 const original=fs.readFileSync(fileURLToPath(import.meta.url),'utf8'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'clrt-runner-fault-')),faults=[];
 const mutations=[
  ['accept-any-fault-exit','return exitCode===1&&!result.signal','return exitCode!==0&&!result.signal','FAULT_RESULT_CLASSIFICATION_ORACLE: other-exit'],
  ['accept-fault-execution-error','&&!result.error&&!result.reason','&&!result.reason','FAULT_RESULT_CLASSIFICATION_ORACLE: execution-error'],
  ['accept-fault-interruption','&&!result.reason&&(!result.outcome','&&(!result.outcome','FAULT_RESULT_CLASSIFICATION_ORACLE: interruption'],
  ['ignore-fault-oracle',"||result.outcome==='FAIL')&&matched;","||result.outcome==='FAIL');",'FAULT_RESULT_CLASSIFICATION_ORACLE: different-oracle'],
  ['accept-source-text-as-oracle','diagnostic.includes(oracle)','String(result.stdout+result.stderr).includes(oracle)','FAULT_RESULT_CLASSIFICATION_ORACLE: oracle-only-in-success-output'],
  ['ignore-terminal-diagnostic'," if(caseId&&terminal.message&&!matches(terminal.message))return false;",'', 'FAULT_TERMINAL_DIAGNOSTIC_ORACLE'],
  ['source-scan-on-helper-import','let synchronousGateNumber=0;','conformanceSources();\nlet synchronousGateNumber=0;', 'HELPER_IMPORT_IO_ORACLE'],
  ['ignore-composite-budget','timeoutMs:gate.timeoutMs??childTimeoutMs','timeoutMs:childTimeoutMs','RUNNER_COMPOSITE_BUDGET_ORACLE'],
  ['ignore-child-exit','exitCode===0&&!error','!error','RUNNER_OUTCOME_ORACLE: nonzero'],
  ['accept-malformed-report',"&&!reportError?'PASS'","?'PASS'",'RUNNER_OUTCOME_ORACLE: malformed'],
  ['misclassify-timeout',"reason==='TIMEOUT'||reason==='AGGREGATE_TIMEOUT'","false",'RUNNER_OUTCOME_ORACLE: stalled'],
  ['lose-incremental-evidence','const persist=()=>saveReport(reportFile,report);persist();','const persist=()=>{};persist();','RUNNER_INCREMENTAL_EVIDENCE_ORACLE'],
  ['continue-after-failure',"if(result.outcome!=='PASS'){","if(false){",'RUNNER_FAIL_FAST_ORACLE'],
  ['erase-pending-cases','report.pending.shift();','report.pending=[];','RUNNER_UNEXECUTED_ORACLE']
 ];
 // Limit replacement to the implementation before the fault definitions.
 const implementation=original.slice(0,original.indexOf('async function verifyRunnerFaults('));
 try{
  for(const [name,before,after,oracle]of mutations){
   assert.equal(implementation.split(before).length,2,'Unique runner fault anchor required: '+name);
   const mutant=path.join(directory,name+'.mjs');fs.writeFileSync(mutant,implementation.replace(before,after)+original.slice(implementation.length));
   const result=await executeGate({name,args:[mutant,'--runner-contract-only','--fault-probe']},{directory,timeoutMs:10000,killGraceMs:50});
   assert.equal(result.outcome,'FAIL','RUNNER_FAULT_DETECTION_ORACLE: '+name);
   assertDetectedFault(result,oracle,'RUNNER_FAULT_SPECIFICITY_ORACLE: '+name);
   faults.push({fault:name,oracle,result:'DETECTED',execution:result});
  }
  assert.equal(fs.readFileSync(fileURLToPath(import.meta.url),'utf8'),original,'RUNNER_SOURCE_RESTORED_ORACLE');
  return {faults,sourceRestored:true};
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
if(process.argv.includes('--creation-matrix-contract-only')){
 console.log(JSON.stringify(await verifyCreationMatrixContract(),null,2));
}else if(process.argv.includes('--runner-contract-only')){
 const contract=await verifyRunnerContract();
 if(!process.argv.includes('--fault-probe')){contract.creationMatrix=await verifyCreationMatrixContract();contract.creationMatrixFaults=await verifyCreationMatrixFaults();Object.assign(contract,await verifyRunnerFaults());contract.restored=await verifyRunnerContract();}
 console.log(JSON.stringify(contract,null,2));
}else{
 const directory=path.resolve('conformance-regression-evidence'),reportFile=path.join(directory,'report.json');
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const sources=conformanceSources();
 const sourceFiles=sources.map(path=>({path,sha256:sha(fs.readFileSync(path))})),workingTreeChanges=execFileSync('git',['status','--porcelain','--',...sources],{encoding:'utf8'}).trim();
 const controller=new AbortController(),onTerm=()=>controller.abort('SIGTERM'),onInt=()=>controller.abort('SIGINT');
 process.on('SIGTERM',onTerm);process.on('SIGINT',onInt);
 const report={schema:'closed-loop-conformance-regressions/1',sourceCommit,workingTreeChanges:workingTreeChanges||null,sourceFiles,controllingSpecification:{path:'specification/closed-loop-reliability-controlling-implementation-specification.txt',sha256:sha(fs.readFileSync('specification/closed-loop-reliability-controlling-implementation-specification.txt'))},synthetic:true,completeOperatorJourney:false,physicalDeviceAcceptance:false};
 try{
  // The creation matrix composes nineteen fault children and seven full healthy
  // controls; it has a forty-minute aggregate budget and ten-minute child bounds.
  // Other suites retain twenty minutes; the whole sequence retains three hours.
  // Run the runner's disposable contract inside the same bounded child path.
  await runSequence([{name:'runner-contract',args:[fileURLToPath(import.meta.url),'--runner-contract-only']},...suites.map(suite=>({name:suite,args:[suite],...(suite==='verify-creation-presentation-faults.mjs'?{timeoutMs:CREATION_MATRIX_TIMEOUT_MS}:{})}))],{directory,reportFile,report,signal:controller.signal});
 }finally{
  process.removeListener('SIGTERM',onTerm);process.removeListener('SIGINT',onInt);
  report.sourceFilesAtFinish=sources.map(path=>({path,sha256:sha(fs.readFileSync(path))}));
  report.sourceChangedDuringRun=JSON.stringify(sourceFiles)!==JSON.stringify(report.sourceFilesAtFinish);
  if(report.sourceChangedDuringRun){report.outcome='FAIL';process.stderr.write('Verification sources changed during this run.\n');}
  saveReport(reportFile,report);console.log(JSON.stringify(report,null,2));
  if(report.outcome!=='PASS')process.exitCode=report.outcome==='TIMEOUT'?124:1;
 }
}

}

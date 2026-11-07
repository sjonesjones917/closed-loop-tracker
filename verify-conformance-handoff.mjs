import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {conformanceGroups,conformanceSources,suiteTimeoutMs} from './verify-conformance-regressions.mjs';
import {verificationCatalog} from './verification-evidence-catalog.mjs';
import {evidenceFingerprint,readExecutionReceipt,sha} from './verification-evidence.mjs';

const groups=['core','creation','counterpart'];
// Source-bound runner report boundary: the synchronized cleanup fixture is
// explicitly controlled, while the original automatic deadline controls remain.
export function validateRunnerDescendantReport(report){
 const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 assert(plain(report)&&report.runnerContract==='PASS'&&Array.isArray(report.cases),'CONFORMANCE_RUNNER_DESCENDANT_REPORT_ORACLE');
 const once=(rows,key,name)=>{const found=rows.filter(row=>row?.[key]===name);assert.equal(found.length,1,'CONFORMANCE_RUNNER_DESCENDANT_POPULATION_ORACLE: '+name);return found[0];};
 const check=contract=>{
  assert(plain(contract)&&contract.runnerContract==='PASS'&&Array.isArray(contract.cases),'CONFORMANCE_RUNNER_DESCENDANT_REPORT_ORACLE');
  const automatic=once(contract.cases,'suite','stalled');
  assert.equal(automatic.outcome,'TIMEOUT','CONFORMANCE_RUNNER_AUTOMATIC_DEADLINE_ORACLE');assert.equal(automatic.reason,'TIMEOUT','CONFORMANCE_RUNNER_AUTOMATIC_DEADLINE_ORACLE');assert.equal(automatic.timeoutMs,250,'CONFORMANCE_RUNNER_AUTOMATIC_DEADLINE_ORACLE');assert.equal(automatic.stdout,'last-phase\n','CONFORMANCE_RUNNER_AUTOMATIC_EXECUTION_ORACLE');
  const row=once(contract.cases,'case','timed-out-child-descendants-stop-before-return'),keys=['case','syncDescendant','bytesBefore','bytesAfter','executionReadyAt','setupDeadlineMs','controlledExecutionTimeoutMs','enclosingHardTimeoutMs','timeoutTrigger'];
  assert(plain(row)&&Object.keys(row).length===keys.length&&keys.every(key=>Object.hasOwn(row,key)),'CONFORMANCE_RUNNER_CONTROLLED_BOUNDARY_SHAPE_ORACLE');
  assert.equal(row.timeoutTrigger,'CONTROLLED_SIGNAL_AFTER_ACTUAL_DESCENDANT_EXECUTION','CONFORMANCE_RUNNER_CONTROLLED_TRIGGER_ORACLE');
  assert.equal(row.setupDeadlineMs,3000,'CONFORMANCE_RUNNER_CONTROLLED_BUDGET_ORACLE');assert.equal(row.controlledExecutionTimeoutMs,350,'CONFORMANCE_RUNNER_CONTROLLED_BUDGET_ORACLE');assert.equal(row.enclosingHardTimeoutMs,5000,'CONFORMANCE_RUNNER_CONTROLLED_BUDGET_ORACLE');
  assert(Number.isSafeInteger(row.bytesBefore)&&row.bytesBefore>0&&row.bytesAfter===row.bytesBefore,'CONFORMANCE_RUNNER_CONTROLLED_WORK_CLEANUP_ORACLE');
  assert(plain(row.syncDescendant)&&row.syncDescendant.outcome==='TIMEOUT'&&row.syncDescendant.reason==='TIMEOUT'&&row.syncDescendant.timeoutMs===row.enclosingHardTimeoutMs&&row.syncDescendant.error?.code==='ETIMEDOUT','CONFORMANCE_RUNNER_CONTROLLED_TIMEOUT_ORACLE');
  const time=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)?Date.parse(value):NaN,ready=time(row.executionReadyAt),started=time(row.syncDescendant.startedAt),finished=time(row.syncDescendant.finishedAt);
  assert(Number.isFinite(ready)&&Number.isFinite(started)&&Number.isFinite(finished)&&started<=ready&&ready<=finished,'CONFORMANCE_RUNNER_CONTROLLED_READINESS_ORACLE');
  const nested=once(contract.cases,'case','nested-descendants-stop-before-return'),expected=['timeout','cancel','blocked-cancel','blocked-chain-cancel','early-exit'];
  assert(Array.isArray(nested.cases)&&nested.cases.length===expected.length&&new Set(nested.cases.map(x=>x?.case)).size===expected.length&&expected.every(name=>nested.cases.some(x=>x?.case===name)),'CONFORMANCE_RUNNER_NESTED_POPULATION_ORACLE');
  const timeout=once(nested.cases,'case','timeout');
  assert.equal(timeout.depth,1,'CONFORMANCE_RUNNER_NESTED_AUTOMATIC_SCOPE_ORACLE');assert.equal(timeout.blocked,false,'CONFORMANCE_RUNNER_NESTED_AUTOMATIC_SCOPE_ORACLE');
  assert(Number.isSafeInteger(timeout.bytesBefore)&&timeout.bytesBefore>0&&timeout.bytesAfter===timeout.bytesBefore,'CONFORMANCE_RUNNER_NESTED_AUTOMATIC_CLEANUP_ORACLE');
  assert(plain(timeout.observed)&&timeout.observed.outcome==='TIMEOUT'&&timeout.observed.reason==='TIMEOUT'&&timeout.observed.timeoutMs===1500&&timeout.observed.error?.code==='ETIMEDOUT','CONFORMANCE_RUNNER_NESTED_AUTOMATIC_TIMEOUT_ORACLE');
 };
 check(report);check(report.restored);
 return {controlledExecutionTimeoutMs:350,automaticStalledDeadlineMs:250,automaticNestedDeadlineMs:1500,restoredBoundaryChecked:true};
}
function runnerDescendantConsumerFixture(){
 // Literal diagnostic report shape only. This does not create an owning
 // producer receipt or claim any automatic/nested executions occurred here.
 const descendant={case:'timed-out-child-descendants-stop-before-return',syncDescendant:{outcome:'TIMEOUT',reason:'TIMEOUT',timeoutMs:5000,error:{code:'ETIMEDOUT'},startedAt:'2026-10-12T00:00:00.000Z',finishedAt:'2026-10-12T00:00:00.500Z'},bytesBefore:10,bytesAfter:10,executionReadyAt:'2026-10-12T00:00:00.100Z',setupDeadlineMs:3000,controlledExecutionTimeoutMs:350,enclosingHardTimeoutMs:5000,timeoutTrigger:'CONTROLLED_SIGNAL_AFTER_ACTUAL_DESCENDANT_EXECUTION'};
 const timeout={case:'timeout',depth:1,blocked:false,bytesBefore:10,bytesAfter:10,observed:{outcome:'TIMEOUT',reason:'TIMEOUT',timeoutMs:1500,error:{code:'ETIMEDOUT'}}};
 const contract={runnerContract:'PASS',cases:[{suite:'stalled',outcome:'TIMEOUT',reason:'TIMEOUT',timeoutMs:250,stdout:'last-phase\n'},descendant,{case:'nested-descendants-stop-before-return',cases:[timeout,...['cancel','blocked-cancel','blocked-chain-cancel','early-exit'].map(name=>({case:name}))]}]};
 return {...contract,restored:structuredClone(contract)};
}
export function verifyRunnerDescendantConsumerControls(){
 const report=runnerDescendantConsumerFixture(),cases=[];validateRunnerDescendantReport(report);cases.push('valid-controlled-and-retained-automatic-boundaries');
 const row=r=>r.cases.find(x=>x.case==='timed-out-child-descendants-stop-before-return'),automatic=r=>r.cases.find(x=>x.suite==='stalled'),nested=r=>r.cases.find(x=>x.case==='nested-descendants-stop-before-return'),timeout=r=>nested(r).cases.find(x=>x.case==='timeout');
 const mutations=[['missing-runner',r=>delete r.runnerContract],['unknown-runner',r=>r.runnerContract='UNKNOWN'],['missing-case',r=>r.cases=r.cases.filter(x=>x!==row(r))],['duplicate-case',r=>r.cases.push(structuredClone(row(r)))],['undisclosed-trigger',r=>delete row(r).timeoutTrigger],['automatic350-total-overclaim',r=>row(r).timeoutTrigger='AUTOMATIC_350_FROM_PROCESS_LAUNCH'],['extra-automatic-proof-claim',r=>row(r).automaticDeadlineProven=true],['wrong-active-budget',r=>row(r).controlledExecutionTimeoutMs=5000],['wrong-hard-budget',r=>row(r).syncDescendant.timeoutMs=350],['unknown-timeout',r=>row(r).syncDescendant.outcome='UNKNOWN'],['missing-timeout-cause',r=>row(r).syncDescendant.reason=null],['missing-readiness',r=>delete row(r).executionReadyAt],['wrong-readiness-type',r=>row(r).executionReadyAt=0],['readiness-after-stop',r=>row(r).executionReadyAt='2026-10-12T00:00:01.000Z'],['no-actual-work',r=>row(r).bytesBefore=row(r).bytesAfter=0],['continued-work',r=>row(r).bytesAfter++],['missing-automatic-stalled',r=>r.cases=r.cases.filter(x=>x!==automatic(r))],['wrong-automatic-stalled-budget',r=>automatic(r).timeoutMs=5000],['automatic-stalled-not-executed',r=>automatic(r).stdout=''],['automatic-stalled-not-timeout',r=>automatic(r).outcome='PASS'],['missing-nested-auto',r=>nested(r).cases=nested(r).cases.filter(x=>x.case!=='timeout')],['duplicate-nested-auto',r=>nested(r).cases[1]=structuredClone(timeout(r))],['nested-auto-not-timeout',r=>timeout(r).observed.outcome='FAIL'],['nested-auto-wrong-budget',r=>timeout(r).observed.timeoutMs=5000],['nested-auto-zero-work',r=>timeout(r).bytesBefore=timeout(r).bytesAfter=0],['nested-auto-continued-work',r=>timeout(r).bytesAfter++],['missing-restored-run',r=>delete r.restored],['restored-no-readiness',r=>delete row(r.restored).executionReadyAt],['restored-missing-automatic',r=>r.restored.cases=r.restored.cases.filter(x=>x!==automatic(r.restored))],['restored-nested-cleanup-failure',r=>timeout(r.restored).bytesAfter++]];
 for(const [name,mutate]of mutations){const bad=structuredClone(report);mutate(bad);assert.throws(()=>validateRunnerDescendantReport(bad),error=>error.code==='ERR_ASSERTION','CONFORMANCE_RUNNER_DESCENDANT_MUTATION_ORACLE: '+name);cases.push(name);}
 validateRunnerDescendantReport(report);cases.push('restored-valid');
 return {passed:true,cases,caseCount:cases.length,syntheticReportFixture:true,actualRunnerExecuted:false,actualAutomaticExecutionHere:false,currentReceiptCreated:false};
}


const CONFORMANCE_IMPORTED_HELPER_SOURCES=Object.freeze(['test-primary-guidance-current-run.mjs','test-history-static-read.mjs']);
export function validateConformanceImportedHelperSources(sourcePaths){
 assert(Array.isArray(sourcePaths)&&sourcePaths.every(name=>typeof name==='string'),'CONFORMANCE_IMPORTED_HELPER_SOURCE_SHAPE_ORACLE');
 assert.equal(new Set(sourcePaths).size,sourcePaths.length,'CONFORMANCE_IMPORTED_HELPER_SOURCE_UNIQUENESS_ORACLE');
 for(const name of CONFORMANCE_IMPORTED_HELPER_SOURCES)assert.equal(sourcePaths.filter(value=>value===name).length,1,'CONFORMANCE_IMPORTED_HELPER_SOURCE_MEMBERSHIP_ORACLE: '+name);
 return {required:[...CONFORMANCE_IMPORTED_HELPER_SOURCES],sourceCount:sourcePaths.length};
}
export function verifyConformanceImportedHelperSourceControls(){
 const sourcePaths=conformanceSources(),cases=[];
 validateConformanceImportedHelperSources(sourcePaths);cases.push('valid-current-source-population');
 for(const name of CONFORMANCE_IMPORTED_HELPER_SOURCES){
  const missing=sourcePaths.filter(value=>value!==name);assert.throws(()=>validateConformanceImportedHelperSources(missing),error=>error.code==='ERR_ASSERTION'&&String(error.message).includes(name),'CONFORMANCE_IMPORTED_HELPER_MISSING_MUTATION_ORACLE: '+name);cases.push('missing-rejected:'+name);
  const duplicate=[...sourcePaths,name];assert.throws(()=>validateConformanceImportedHelperSources(duplicate),error=>error.code==='ERR_ASSERTION'&&String(error.message).includes('UNIQUENESS'),'CONFORMANCE_IMPORTED_HELPER_DUPLICATE_MUTATION_ORACLE: '+name);cases.push('duplicate-rejected:'+name);
 }
 validateConformanceImportedHelperSources(sourcePaths);cases.push('restored-valid');
 return {passed:true,cases,caseCount:cases.length,required:[...CONFORMANCE_IMPORTED_HELPER_SOURCES],actualGroupExecuted:false,currentReceiptCreated:false};
}

export function validateConformanceReports(reports,{sourceCommit,sourceFiles}){
 assert.deepEqual(Object.keys(conformanceGroups),groups,'CONFORMANCE_GROUP_AUTHORITY_ORACLE');
 assert.deepEqual(Object.keys(reports).sort(),[...groups].sort(),'CONFORMANCE_GROUP_POPULATION_ORACLE');
 const population=Object.values(conformanceGroups).flat();
 assert.equal(new Set(population).size,population.length,'CONFORMANCE_SUITE_UNIQUENESS_ORACLE');
 for(const group of groups){
  const report=reports[group];
  assert.equal(report.schema,'closed-loop-conformance-regressions/1','CONFORMANCE_REPORT_SCHEMA_ORACLE');
  assert.equal(report.group,group,'CONFORMANCE_REPORT_GROUP_ORACLE');
  assert.equal(report.sourceCommit,sourceCommit,'CONFORMANCE_REPORT_COMMIT_ORACLE');
  assert.equal(report.workingTreeChanges,null,'CONFORMANCE_REPORT_CLEAN_SOURCE_ORACLE');
  assert.deepEqual(report.sourceFiles,sourceFiles,'CONFORMANCE_REPORT_SOURCE_ORACLE');
  assert.deepEqual(report.sourceFilesAtFinish,sourceFiles,'CONFORMANCE_REPORT_RESTORATION_ORACLE');
  assert.equal(report.sourceChangedDuringRun,false,'CONFORMANCE_REPORT_SOURCE_CHANGE_ORACLE');
  assert.equal(report.complete,true,'CONFORMANCE_REPORT_COMPLETE_ORACLE');
  assert.equal(report.outcome,'PASS','CONFORMANCE_REPORT_OUTCOME_ORACLE');
  assert.equal(report.interruption,null,'CONFORMANCE_REPORT_INTERRUPTION_ORACLE');
  assert.deepEqual(report.pending,[],'CONFORMANCE_REPORT_PENDING_ORACLE');
  assert.equal(report.running,null,'CONFORMANCE_REPORT_RUNNING_ORACLE');
  assert.deepEqual(report.results.map(row=>row.suite),['runner-contract',...conformanceGroups[group]],'CONFORMANCE_REPORT_SUITE_POPULATION_ORACLE');
  for(const result of report.results){
   assert.equal(result.outcome,'PASS','CONFORMANCE_CHILD_OUTCOME_ORACLE');
   assert.equal(result.exitCode,0,'CONFORMANCE_CHILD_EXIT_ORACLE');
   for(const field of ['signal','reason','error','reportError'])assert.equal(result[field],null,'CONFORMANCE_CHILD_FAILURE_ORACLE: '+field);
   assert.equal(result.timeoutMs,suiteTimeoutMs(result.suite),'CONFORMANCE_CHILD_BUDGET_ORACLE');
   assert.equal(result.stdoutSha256,sha(result.stdout),'CONFORMANCE_CHILD_STDOUT_ORACLE');
   assert.equal(result.stderrSha256,sha(result.stderr),'CONFORMANCE_CHILD_STDERR_ORACLE');
   if(result.suite==='runner-contract'){let runner;try{runner=JSON.parse(result.stdout);}catch{assert.fail('CONFORMANCE_RUNNER_REPORT_JSON_ORACLE');}validateRunnerDescendantReport(runner);}
  }
 }
 return {groups:groups.length,suites:population.length};
}
export function verifyConformanceHandoffControls(){
 const sourceCommit='a'.repeat(40),sourceFiles=[{path:'control-source.mjs',sha256:'b'.repeat(64)}];
 const reports=Object.fromEntries(groups.map(group=>[group,{schema:'closed-loop-conformance-regressions/1',group,sourceCommit,workingTreeChanges:null,sourceFiles,sourceFilesAtFinish:sourceFiles,sourceChangedDuringRun:false,complete:true,outcome:'PASS',interruption:null,pending:[],running:null,results:['runner-contract',...conformanceGroups[group]].map(suite=>({suite,outcome:'PASS',exitCode:0,signal:null,reason:null,error:null,reportError:null,timeoutMs:suiteTimeoutMs(suite),stdout:'control',stderr:'',stdoutSha256:sha('control'),stderrSha256:sha('')}))}]));
 const fixture=runnerDescendantConsumerFixture();for(const report of Object.values(reports)){const result=report.results[0];result.stdout=JSON.stringify(fixture);result.stdoutSha256=sha(result.stdout);}
 const expected={sourceCommit,sourceFiles};validateConformanceReports(reports,expected);
 const mutations=[
  ['missing-group',r=>delete r.creation],['extra-group',r=>{r.extra=r.core;}],
  ['wrong-group',r=>{r.creation.group='core';}],['stale-commit',r=>{r.core.sourceCommit='c'.repeat(40);} ],
  ['dirty-source',r=>{r.core.workingTreeChanges=' M app-core.js';}],['missing-source',r=>{r.core.sourceFiles=[];}],
  ['source-not-restored',r=>{r.core.sourceFilesAtFinish=[];}],['source-changed',r=>{r.core.sourceChangedDuringRun=true;}],
  ['incomplete',r=>{r.core.complete=false;}],['failed-group',r=>{r.core.outcome='FAIL';}],['interrupted',r=>{r.core.interruption='SIGTERM';}],
  ['pending',r=>{r.core.pending=['missing'];}],['still-running',r=>{r.core.running={suite:'missing'};}],
  ['missing-suite',r=>r.core.results.pop()],['duplicate-suite',r=>r.core.results.push(r.core.results[0])],
  ['timed-out-child',r=>{r.core.results[0].outcome='TIMEOUT';}],['failed-child',r=>{r.core.results[0].exitCode=1;}],
  ['signalled-child',r=>{r.core.results[0].signal='SIGTERM';}],['child-error',r=>{r.core.results[0].error={code:'EIO'};}],
  ['wrong-budget',r=>{r.core.results[0].timeoutMs=1;}],['changed-stdout',r=>{r.core.results[0].stdout+='changed';}],['changed-stderr',r=>{r.core.results[0].stderr+='changed';}]
 ];
 for(const [name,mutate] of mutations){const changed=structuredClone(reports);mutate(changed);assert.throws(()=>validateConformanceReports(changed,expected),error=>error.code==='ERR_ASSERTION','CONFORMANCE_HANDOFF_MUTATION_ORACLE: '+name);}
 validateConformanceReports(reports,expected);
 const runnerDescendantAggregateCases=[];
 const aggregateMutations=[['controlled-trigger-undisclosed',r=>delete r.cases.find(x=>x.case==='timed-out-child-descendants-stop-before-return').timeoutTrigger],['controlled-mode-overclaimed',r=>r.cases.find(x=>x.case==='timed-out-child-descendants-stop-before-return').timeoutTrigger='AUTOMATIC_350_FROM_PROCESS_LAUNCH'],['controlled-no-work',r=>{const row=r.cases.find(x=>x.case==='timed-out-child-descendants-stop-before-return');row.bytesBefore=row.bytesAfter=0;}],['controlled-continues-work',r=>r.cases.find(x=>x.case==='timed-out-child-descendants-stop-before-return').bytesAfter++],['automatic-stalled-omitted',r=>r.cases=r.cases.filter(x=>x.suite!=='stalled')],['automatic-nested-omitted',r=>r.cases.find(x=>x.case==='nested-descendants-stop-before-return').cases=r.cases.find(x=>x.case==='nested-descendants-stop-before-return').cases.filter(x=>x.case!=='timeout')],['automatic-nested-cleanup-fails',r=>r.cases.find(x=>x.case==='nested-descendants-stop-before-return').cases.find(x=>x.case==='timeout').bytesAfter++],['restored-readiness-omitted',r=>delete r.restored.cases.find(x=>x.case==='timed-out-child-descendants-stop-before-return').executionReadyAt]];
 for(const [name,mutate]of aggregateMutations){const bad=structuredClone(reports),result=bad.core.results[0],nested=JSON.parse(result.stdout);mutate(nested);result.stdout=JSON.stringify(nested);result.stdoutSha256=sha(result.stdout);assert.throws(()=>validateConformanceReports(bad,expected),error=>error.code==='ERR_ASSERTION','CONFORMANCE_RUNNER_AGGREGATE_MUTATION_ORACLE: '+name);runnerDescendantAggregateCases.push(name);}
 const runnerDescendantConsumers=verifyRunnerDescendantConsumerControls(),conformanceImportedHelperSourceControls=verifyConformanceImportedHelperSourceControls();
 return {conformanceHandoffControls:'PASS',negativeCases:mutations.map(([name])=>name),runnerDescendantConsumers,runnerDescendantAggregateCases,conformanceImportedHelperSourceControls,restored:true,synthetic:true,executionEstablished:false};
}
export function currentConformanceHandoff(directory='.ci-conformance-handoff'){
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const sourceFiles=conformanceSources().map(path=>({path,sha256:sha(fs.readFileSync(path))}));
 assert.deepEqual(fs.readdirSync(directory).filter(name=>name.endsWith('.json')).sort(),groups.map(group=>group+'.json').sort(),'CONFORMANCE_HANDOFF_FILES_ORACLE');
 const reports=Object.fromEntries(groups.map(group=>[group,JSON.parse(fs.readFileSync(path.join(directory,group+'.json'),'utf8'))]));
 const result=validateConformanceReports(reports,{sourceCommit,sourceFiles});
 const fingerprint=evidenceFingerprint(),receiptDirectory=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS||'.verification-receipts';
 for(const suite of Object.values(conformanceGroups).flat())if(verificationCatalog[suite])assert.ok(readExecutionReceipt(receiptDirectory,suite,fingerprint),'CONFORMANCE_HANDOFF_RECEIPT_ORACLE: '+suite);
 return {conformanceHandoff:'PASS',...result,sourceCommit};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 console.log(JSON.stringify(verifyConformanceHandoffControls()));
 if(!process.argv.includes('--controls-only'))console.log(JSON.stringify(currentConformanceHandoff()));
}

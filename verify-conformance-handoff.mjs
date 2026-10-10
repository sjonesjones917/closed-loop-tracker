import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {conformanceGroups,conformanceSources,suiteTimeoutMs} from './verify-conformance-regressions.mjs';
import {verificationCatalog} from './verification-evidence-catalog.mjs';
import {evidenceFingerprint,readExecutionReceipt,sha} from './verification-evidence.mjs';

const groups=['core','creation','counterpart'];
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
  }
 }
 return {groups:groups.length,suites:population.length};
}
export function verifyConformanceHandoffControls(){
 const sourceCommit='a'.repeat(40),sourceFiles=[{path:'control-source.mjs',sha256:'b'.repeat(64)}];
 const reports=Object.fromEntries(groups.map(group=>[group,{schema:'closed-loop-conformance-regressions/1',group,sourceCommit,workingTreeChanges:null,sourceFiles,sourceFilesAtFinish:sourceFiles,sourceChangedDuringRun:false,complete:true,outcome:'PASS',interruption:null,pending:[],running:null,results:['runner-contract',...conformanceGroups[group]].map(suite=>({suite,outcome:'PASS',exitCode:0,signal:null,reason:null,error:null,reportError:null,timeoutMs:suiteTimeoutMs(suite),stdout:'control',stderr:'',stdoutSha256:sha('control'),stderrSha256:sha('')}))}]));
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
 return {conformanceHandoffControls:'PASS',negativeCases:mutations.map(([name])=>name),restored:true,synthetic:true,executionEstablished:false};
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

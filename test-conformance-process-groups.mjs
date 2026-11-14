// Synthetic caller controls plus an independently held native Darwin zombie.
// These prove supervisor cleanup semantics; they do not claim browser execution.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {groupHasRunningProcesses} from './browser-extra-aggregate.mjs';
import {verifyBrowserExtraDarwinGroupControls} from './verify-browser-extra-aggregate.mjs';

export async function verifyConformanceProcessGroupControls(){
 const source=fs.readFileSync(new URL('./verify-conformance-regressions.mjs',import.meta.url),'utf8');
 const start='  const killGroup=',end='  const descendantOf=';
 assert.equal(source.split(start).length,2,'CONFORMANCE_GROUP_CONTROL_SOURCE_ORACLE');
 assert.equal(source.split(end).length,2,'CONFORMANCE_GROUP_CONTROL_SOURCE_ORACLE');
 assert.ok(source.includes("import {groupHasRunningProcesses} from './browser-extra-aggregate.mjs';"),'CONFORMANCE_GROUP_INSPECTOR_BINDING_ORACLE');
 const statement=source.slice(source.indexOf(start),source.indexOf(end));
 const former="const killGroup=(pid,kind)=>{try{process.kill(process.platform==='win32'?pid:-pid,kind);}catch(e){if(e.code!=='ESRCH')error={code:e.code,message:e.message};}};";
 const control=(kill,inspect,platform='darwin',implementation=statement)=>{
  const context=createVerifierRuntime({process:{platform,kill},groupHasRunningProcesses:inspect});
  createVerifierRuntime.loadScript(context,'let error=null;'+implementation+'globalThis.signalGroup=(pid,kind)=>{error=null;killGroup(pid,kind);return error;};');
  return context.signalGroup;
 };
 const group=80000001,cases=[],permission=()=>Object.assign(new Error('CONTROLLED_GROUP_EPERM'),{code:'EPERM'});
 let unexpectedInspections=0;
 const neverInspect=()=>{unexpectedInspections++;assert.fail('CONFORMANCE_GROUP_UNEXPECTED_INSPECTION_ORACLE');};
 const assertOriginal=(observed,error)=>{
  assert.equal(observed?.code,error.code,'CONFORMANCE_GROUP_ORIGINAL_ERROR_ORACLE');
  assert.equal(observed?.message,error.message,'CONFORMANCE_GROUP_ORIGINAL_ERROR_ORACLE');
 };
 for(const kind of ['SIGTERM','SIGKILL']){
  let calls=0;
  assert.equal(control((pid,signal)=>{assert.equal(pid,-group);assert.equal(signal,kind);calls++;},neverInspect)(group,kind),null);
  assert.equal(calls,1);cases.push('successful-'+kind+'-unchanged');
  const error=Object.assign(new Error('CONTROLLED_ABSENT_GROUP'),{code:'ESRCH'});
  assert.equal(control(()=>{throw error;},neverInspect)(group,kind),null);cases.push('absent-'+kind+'-unchanged');
 }
 for(const kind of ['SIGTERM','SIGKILL']){
  const error=permission();let calls=0;
  assert.equal(control(()=>{throw error;},pid=>{assert.equal(pid,group);calls++;return false;})(group,kind),null);
  assert.equal(calls,1);cases.push('darwin-'+kind+'-no-live-member-proven');
 }
 {
  const error=permission();let calls=0;
  const signal=control(()=>{throw error;},pid=>{assert.equal(pid,group);return calls++>0;});
  assert.equal(signal(group,'SIGKILL'),null);assertOriginal(signal(group,'SIGKILL'),error);assert.equal(calls,2);
  cases.push('fresh-inspection-every-permission-error');
 }
 {
  const error=permission();assertOriginal(control(()=>{throw error;},()=>true)(group,'SIGKILL'),error);
  cases.push('live-or-mixed-group-permission-refused');
 }
 for(const code of ['MALFORMED','TRUNCATED','EACCES','ETIMEDOUT','ENOBUFS']){
  const error=permission(),inspection=Object.assign(new Error('CONTROLLED_INSPECTION_'+code),{code});
  const observed=control(()=>{throw error;},()=>{throw inspection;})(group,'SIGKILL');
  assertOriginal(observed,error);assert.equal(error.cause,inspection);assert.equal(observed.cause.code,code);assert.equal(observed.cause.message,inspection.message);
  cases.push('inspection-'+code+'-refused-with-cause');
 }
 {
  const cause=Object.assign(new Error('ORIGINAL_CAUSE'),{code:'ORIGINAL'}),error=Object.assign(permission(),{cause});
  const observed=control(()=>{throw error;},()=>{throw new Error('NEW_INSPECTION_FAILURE');})(group,'SIGKILL');
  assertOriginal(observed,error);assert.equal(error.cause,cause);assert.equal(observed.cause.code,'ORIGINAL');assert.equal(observed.cause.message,cause.message);
  cases.push('existing-error-cause-preserved');
 }
 for(const platform of ['linux','win32']){
  const error=permission();
  const observed=control((pid,kind)=>{assert.equal(pid,platform==='win32'?group:-group);assert.equal(kind,'SIGKILL');throw error;},neverInspect,platform)(group,'SIGKILL');
  assertOriginal(observed,error);cases.push(platform+'-permission-refused-without-inspection');
 }
 {
  const error=Object.assign(new Error('CONTROLLED_OTHER_SIGNAL_ERROR'),{code:'EACCES'});
  assertOriginal(control(()=>{throw error;},neverInspect)(group,'SIGKILL'),error);cases.push('other-signal-error-refused');
 }
 assert.equal(unexpectedInspections,0,'CONFORMANCE_GROUP_UNEXPECTED_INSPECTION_ORACLE');
 let nativeCaller=null;
 const sharedInspection=await verifyBrowserExtraDarwinGroupControls({onNativeZombie:pid=>{
  // The shared fixture has independently observed the exact owned PID/PPID/
  // PGID, real Z state, stopped reaper and native signal EPERM before this call.
  const original=control(process.kill.bind(process),groupHasRunningProcesses,process.platform,former)(pid,'SIGKILL');
  assert.equal(original?.code,'EPERM','CONFORMANCE_FORMER_NATIVE_EPERM_ORACLE');
  const restored=control(process.kill.bind(process),groupHasRunningProcesses,process.platform)(pid,'SIGKILL');
  assert.equal(restored,null,'CONFORMANCE_NATIVE_ZOMBIE_CLEANUP_ORACLE');
  nativeCaller={observed:true,formerError:'EPERM',currentCleanupAccepted:true};
 }});
 if(process.platform==='darwin'){assert.equal(sharedInspection.nativeZombie?.observed,true);assert.equal(nativeCaller?.observed,true);}
 else assert.equal(nativeCaller,null);
 return {case:'conformance-process-group-permission',passed:true,platform:process.platform,syntheticCallerCases:cases,sharedInspection,nativeCaller,testOwnedCleanupComplete:sharedInspection.testOwnedCleanupComplete};
}

// Synthetic admission/process controls only. No browser or app assertions run,
// and no generated control receipt is retained as executed application proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {EventEmitter} from 'node:events';
import {isDeepStrictEqual} from 'node:util';
import {validateBrowserExecution} from './browser-execution-evidence.mjs';
import {fileURLToPath} from 'node:url';
import {spawn,execFileSync} from 'node:child_process';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {once} from 'node:events';
import {createHash,randomBytes} from 'node:crypto';
import {BROWSER_EXTRA_LANES,BROWSER_EXTRA_CHILD_SCHEMA,BROWSER_EXTRA_AGGREGATE_SCHEMA,browserExtraRequiredPopulations,browserExtraSourceFingerprint,browserExtraFingerprintFromInputs,parseBrowserExtraChildOutput,validateBrowserExtraAggregate,superviseBrowserExtra,groupHasRunningProcesses} from './browser-extra-aggregate.mjs';
import {createExecutionReceipt,validateExecutionReceipt} from './verification-evidence.mjs';

function darwinProcessState(pid){
 let output;
 try{output=execFileSync('/bin/ps',['-p',String(pid),'-o','pid=,stat='],{encoding:'utf8',timeout:1000,killSignal:'SIGKILL'});}catch(error){if(error.status===1&&error.stdout===''&&error.stderr==='')return null;throw error;}
 const match=/^\s*(\d+)\s+([HIRSTUZ?][+<>AELNSsVWX]*)\s*$/.exec(output);
 assert(match&&Number(match[1])===pid,'native process inspection did not identify its exact PID');
 return match[2][0];
}
function nativeProcessRunning(pid){
 if(process.platform==='darwin'){const state=darwinProcessState(pid);return state!==null&&state!=='Z';}
 if(process.platform==='linux'){
  try{return !/\) [ZX] /.test(fs.readFileSync('/proc/'+pid+'/stat','utf8'));}catch(error){if(['ENOENT','ESRCH'].includes(error.code))return false;throw error;}
 }
 try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}
}

export async function verifyBrowserExtraDarwinGroupControls({onNativeZombie}={}){
 assert(onNativeZombie===undefined||typeof onNativeZombie==='function','native zombie callback must be a function');
 const source=fs.readFileSync(new URL('./browser-extra-aggregate.mjs',import.meta.url),'utf8');
 const start='function killGroup(',end='const replayFailure=';
 assert.equal(source.split(start).length,2);assert.equal(source.split(end).length,2);
 const functions=source.slice(source.indexOf(start),source.indexOf(end));
 const inspect=(kill,read,platform='darwin')=>{
  const context=createVerifierRuntime({process:{platform,pid:process.pid,env:process.env,kill},fs,execFileSync:read,check:(condition,message)=>assert(condition,message)});
  createVerifierRuntime.loadScript(context,functions);return context;
 };
 const group=80000001,own=process.pid+' 80000000 S\n',permission=Object.assign(new Error('CONTROLLED_LIVE_GROUP_EPERM'),{code:'EPERM'}),cases=[];
 const reader=output=>(file,args,options)=>{
  assert.equal(file,'/bin/ps');assert.deepEqual(Array.from(args),['-axo','pid=,pgid=,stat=']);
  assert.equal(options.timeout,1000);assert.equal(options.killSignal,'SIGKILL');assert.equal(options.maxBuffer,4*1024*1024);assert.equal(options.env.LC_ALL,'C');return output;
 };
 for(const [name,output]of [['zombie-only',own+group+' '+group+' Z\n'],['absent-group',own],['different-exact-group',own+group+' '+(group+1)+' R\n']]){
  const control=inspect(()=>{throw permission;},reader(output));assert.equal(control.groupHasRunningProcesses(group),false);assert.doesNotThrow(()=>control.killGroup({pid:group}));cases.push(name);
 }
 for(const state of ['I','R','S','T','U']){
  const control=inspect(()=>{throw permission;},reader(own+group+' '+group+' Z\n'+(group+1)+' '+group+' '+state+'\n'));
  assert.equal(control.groupHasRunningProcesses(group),true);assert.throws(()=>control.killGroup({pid:group}),error=>error===permission);cases.push('live-'+state+'-permission-refused');
 }
 for(const [state,label]of [['H','H'],['?','question']]){
  for(const [mode,output,live]of [
   ['single',own+group+' '+group+' '+state+'\n',true],
   ['mixed',own+group+' '+group+' Z\n'+(group+1)+' '+group+' '+state+'E\n',true],
   ['unrelated',own+group+' '+group+' Z\n'+(group+1)+' '+(group+1)+' '+state+'+\n',false]
  ]){
   const control=inspect(()=>{throw permission;},reader(output));
   assert.equal(control.groupHasRunningProcesses(group),live);
   if(live)assert.throws(()=>control.killGroup({pid:group}),error=>error===permission);
   else assert.doesNotThrow(()=>control.killGroup({pid:group}));
   cases.push(mode==='unrelated'?'different-exact-group-'+label:mode+'-'+label+'-permission-refused');
  }
 }
 for(const [name,output]of [
  ['empty',''],['truncated',own+group+' '+group+' Z'],['missing-own-process',group+' '+group+' Z\n'],
  ['malformed-row',own+'not-a-process\n'],['unknown-state',own+group+' '+group+' INVALID\n'],
  ['unsafe-identity',own+'9007199254740992 '+group+' Z\n'],['duplicate-pid',own+own],['extra-column',own+group+' '+group+' Z extra\n']
 ]){
  const control=inspect(()=>{throw permission;},reader(output));assert.throws(()=>control.groupHasRunningProcesses(group),/Darwin process/);
  delete permission.cause;assert.throws(()=>control.killGroup({pid:group}),error=>error===permission&&/Darwin process/.test(error.cause?.message));cases.push('inspection-'+name+'-refused');
  if(name==='malformed-row'){
   const malformed='bad"\\\t\r'+'\u0001'.repeat(100)+' tail',bounded=inspect(()=>{throw permission;},reader(own+malformed+'\n'));
   const diagnostic=error=>{
    const prefix='malformed Darwin process inspection: ';assert(error.message.startsWith(prefix));
    const encoded=error.message.slice(prefix.length);assert(encoded.length<=160);assert(!/[\r\n\t]/.test(encoded));
    const decoded=JSON.parse(encoded);assert(decoded.length>0&&malformed.startsWith(decoded));return true;
   };
   assert.throws(()=>bounded.groupHasRunningProcesses(group),diagnostic);
   delete permission.cause;assert.throws(()=>bounded.killGroup({pid:group}),error=>error===permission&&diagnostic(error.cause));
  }
 }
 for(const code of ['EACCES','ETIMEDOUT','ENOBUFS']){
  const failure=Object.assign(new Error('CONTROLLED_PS_'+code),{code}),control=inspect(()=>{throw permission;},()=>{throw failure;});
  delete permission.cause;assert.throws(()=>control.killGroup({pid:group}),error=>error===permission&&error.cause===failure);cases.push('inspection-'+code+'-refused');
 }
 for(const [name,platform,error]of [['other-error','darwin',Object.assign(new Error('CONTROLLED_KILL_EACCES'),{code:'EACCES'})],['linux-permission','linux',permission]]){
  const control=inspect(()=>{throw error;},()=>{throw new Error('inspection must not run');},platform);
  assert.throws(()=>control.killGroup({pid:group}),observed=>observed===error);cases.push(name+'-refused');
 }
 let nativeZombie=null;
 if(process.platform==='darwin'){
  // Stop only the owned reaper, outside the child's detached session. Its
  // exited child remains a real zombie until the finally block resumes it.
  const reaper=spawn(process.execPath,['-e',"const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','process.exit(0)'],{detached:true,stdio:'ignore'});process.stdout.write(String(child.pid)+'\\n',()=>process.kill(process.pid,'SIGSTOP'));setInterval(()=>{},1000);"],{stdio:['ignore','pipe','pipe']});
  const closed=once(reaper,'close');let zombie;
  try{
   const reported=await new Promise((resolve,reject)=>{
    let buffer='';
    const finish=(error,line)=>{clearTimeout(deadline);reaper.stdout.removeListener('data',onData);reaper.stdout.removeListener('end',onEnd);reaper.stdout.removeListener('error',onError);error?reject(error):resolve(line);};
    const onData=bytes=>{buffer+=bytes.toString('utf8');if(buffer.length>32)return finish(new Error('native child PID message exceeded its bound'));if(buffer.includes('\n'))finish(null,buffer);};
    const onEnd=()=>finish(new Error('native child PID message ended before newline')),onError=error=>finish(error);
    const deadline=setTimeout(()=>finish(new Error('native child PID message timed out')),3000);
    reaper.stdout.on('data',onData);reaper.stdout.once('end',onEnd);reaper.stdout.once('error',onError);
   });
   assert(/^\d+\n$/.test(reported),'native child PID message malformed');
   const reportedPid=Number(reported.trim());assert(Number.isSafeInteger(reportedPid)&&reportedPid>1);
   const endAt=Date.now()+3000;let observed;
   for(;;){
    observed=execFileSync('/bin/ps',['-p',String(reportedPid),'-o','pid=,ppid=,pgid=,stat='],{encoding:'utf8',timeout:1000,killSignal:'SIGKILL'}).trim().split(/\s+/);
    assert.equal(Number(observed[0]),reportedPid);assert.equal(Number(observed[1]),reaper.pid);assert.equal(Number(observed[2]),reportedPid);
    zombie=reportedPid; // Cleanup may signal only this natively proven child.
    if(observed[3][0]==='Z')break;assert(Date.now()<endAt,'native child did not become a zombie');await new Promise(resolve=>setTimeout(resolve,10));
   }
   for(const signal of [0,'SIGKILL'])assert.throws(()=>process.kill(-zombie,signal),error=>error.code==='EPERM','native zombie-only group did not reproduce EPERM');
   const control=inspect(process.kill.bind(process),execFileSync);
   assert.equal(control.groupHasRunningProcesses(zombie),false);assert.doesNotThrow(()=>control.killGroup({pid:zombie}));
   assert.equal(darwinProcessState(reaper.pid),'T','native reaper must remain stopped');
   assert(nativeProcessRunning(reaper.pid),'stopped reaper must remain live');
   if(onNativeZombie){await onNativeZombie(zombie);assert.equal(darwinProcessState(reaper.pid),'T','native reaper must remain stopped through the caller control');}
   nativeZombie={observed:true,state:'Z',groupEqualsChildPid:true,parentStopped:true,nativeSignalZero:'EPERM',nativeSigkill:'EPERM',runningMember:false,cleanupAccepted:true};
  }finally{
   try{
    if(zombie){try{process.kill(zombie,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}}
    try{process.kill(reaper.pid,'SIGCONT');}catch(error){if(error.code!=='ESRCH')throw error;}
    if(zombie){const endAt=Date.now()+3000;while(darwinProcessState(zombie)!==null){assert(Date.now()<endAt,'native zombie fixture child was not reaped');await new Promise(resolve=>setTimeout(resolve,10));}}
   }finally{
    try{process.kill(reaper.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}
    await closed;
   }
   assert.equal(darwinProcessState(reaper.pid),null);if(zombie)assert.equal(darwinProcessState(zombie),null);
  }
 }
 return {caseName:'platform-process-group-liveness',platform:process.platform,cases,nativeZombie,testOwnedCleanupComplete:true};
}

// Explicitly obstruct only this control's own process groups, then prove that
// failed supervisor cleanup retains their roots rather than deleting live data.
export async function verifyBrowserExtraCleanupRetentionControl(){
 const directory=fs.mkdtempSync(path.join(process.cwd(),'.browser-extra-retention-control-'));
 const children=[],profiles=[],suppressedSignals=[],originalKill=process.kill;
 const live=nativeProcessRunning;
 let failure,proof;
 try{
  for(const name of ['verify-browser-extra.mjs','browser-extra-aggregate.mjs'])fs.writeFileSync(path.join(directory,name),'// synthetic retention-control source\n');
  process.kill=function(pid,signal){if(signal==='SIGKILL'&&children.some(row=>-row.process.pid===pid)){suppressedSignals.push(pid);return true;}return originalKill.call(process,pid,signal);};
  await assert.rejects(()=>superviseBrowserExtra({cwd:directory,deadlineMs:250,sourceChecks:()=>{},outputDirectory:directory,onFailureOutput:()=>{},spawnChild:(command,args,options)=>{
   profiles.push(options.env.CLOSED_LOOP_BROWSER_EXTRA_PROFILE_PATH);
   const child=spawn(command,['-e','setInterval(()=>{},50)'],options),row={process:child,closed:false};child.once('close',()=>{row.closed=true;});children.push(row);return child;
  }}),error=>{failure=error;return /absolute deadline expired/.test(error.message);});
  assert.equal(children.length,4);assert.equal(new Set(profiles).size,4);assert(suppressedSignals.length>=4);
  for(let index=0;index<children.length;index++){
   const pid=children[index].process.pid,profile=profiles[index];assert(live(pid),'control process exited before retention observation');assert(fs.existsSync(profile),'live group root was deleted');
   assert(failure.cleanupErrors.some(message=>message.includes('process group still running')&&message.includes('profilePath='+profile)&&message.includes('processGroup='+pid)),'retained root/group absent from exact cleanup diagnostics');
  }
  proof={caseName:'live-process-group-retains-owned-root',retainedRoots:4,liveGroupsAtRejection:4,suppressedKillSignals:suppressedSignals.length,completeRejected:true};
 }finally{
  process.kill=originalKill;
  for(const row of children){try{originalKill.call(process,-row.process.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}}
  const end=Date.now()+3000;
  while(children.some(row=>!row.closed||live(row.process.pid))){assert(Date.now()<end,'retention control could not reap its own process: '+children.map(row=>row.process.pid));await new Promise(resolve=>setTimeout(resolve,10));}
  for(const profile of profiles){fs.rmSync(profile,{recursive:true,force:true});assert(!fs.existsSync(profile));}
  fs.rmSync(directory,{recursive:true,force:true});
 }
 return {...proof,testOwnedCleanupComplete:true};
}


// The signal protocol below is explicitly injected. Native child membership,
// liveness, closure and root custody are measured separately, on every OS.
export async function verifyBrowserExtraPendingCleanupControls(terminalByLane){
 const source=fs.readFileSync(new URL('./browser-extra-aggregate.mjs',import.meta.url),'utf8');
 const productionSourceSha256=createHash('sha256').update(source).digest('hex');
 const unitCases=[],processCases=[],rows=[];
 const error=(code,message,cause)=>Object.assign(new Error(message),{code},cause===undefined?{}:{cause});
 const killBody=source.slice(source.indexOf('function killGroup('),source.indexOf('function groupHasRunningProcesses('));
 assert(killBody.startsWith('function killGroup('),'PENDING_KILL_BODY_ORACLE');
 const killControl=(kill,inspect)=>{const context=createVerifierRuntime({process:{platform:'darwin',kill},groupHasRunningProcesses:inspect});createVerifierRuntime.loadScript(context,"'use strict';"+killBody+'globalThis.call=killGroup;');return context.call;};
 assert.equal(killControl(()=>true,()=>{throw Error('unexpected inspection');})({pid:11}),true);unitCases.push('native-signal-acknowledgement-true');
 assert.equal(killControl(()=>{throw Error('unexpected signal');},()=>true)({}),false);unitCases.push('no-pid-not-acknowledgement');
 assert.equal(killControl(()=>{throw error('ESRCH','absent');},()=>true)({pid:11}),false);unitCases.push('absent-group-not-acknowledgement');
 assert.equal(killControl(()=>{throw error('EPERM','zombie');},()=>false)({pid:11}),false);unitCases.push('zombie-only-not-acknowledgement');
 const start=' const stopStates=new WeakMap();',end=' const ensureTime=';
 assert.equal(source.split(start).length,2);assert.equal(source.split(end).length,2);
 const stateBody=source.slice(source.indexOf(start),source.indexOf(end));
 const stateControl=(platform='darwin')=>{
  const outcomes=[],context=createVerifierRuntime({process:{platform},killGroup:()=>{const value=outcomes.shift();if(value instanceof Error)throw value;return value;}});
  createVerifierRuntime.loadScript(context,"'use strict';"+stateBody+'globalThis.step=stopRow;globalThis.state=row=>stopStates.get(row);');
  return {outcomes,step:context.step,state:context.state};
 };
 const row={process:{pid:11}},other={process:{pid:12}};
 let control=stateControl();control.outcomes.push(true);control.step(row);assert.equal(control.state(row).successfulKill,true);unitCases.push('true-acknowledgement-seeds-row');
 control=stateControl();control.outcomes.push(false,error('EPERM','FALSE_NOT_ACK'));control.step(row);assert.throws(()=>control.step(row),/FALSE_NOT_ACK/);unitCases.push('false-not-acknowledgement');
 control=stateControl();control.outcomes.push(true,error('EPERM','OTHER_ROW_NOT_ACK'));control.step(other);assert.throws(()=>control.step(row),/OTHER_ROW_NOT_ACK/);unitCases.push('foreign-row-not-acknowledgement');
 for(const [name,platform,failure]of [
  ['non-darwin-denial-refused','linux',error('EPERM','NON_DARWIN')],
  ['non-permission-error-refused','darwin',error('EACCES','OTHER_ERROR')],
  ['inspection-cause-refused','darwin',error('EPERM','INSPECTION_CAUSE',new Error('inspection'))],
  ['null-cause-refused','darwin',error('EPERM','NULL_CAUSE',null)]
 ]){
  control=stateControl(platform);control.outcomes.push(true,failure);control.step(row);assert.throws(()=>control.step(row),observed=>observed===failure);unitCases.push(name);
 }
 control=stateControl();const first=error('EPERM','FIRST_PENDING'),second=error('EPERM','SECOND_PENDING');
 control.outcomes.push(true,first,second);control.step(row);control.step(row);control.step(row);assert.equal(control.state(row).pendingError,first);unitCases.push('first-pending-error-preserved');
 control.outcomes.push(true);control.step(row);assert.equal(control.state(row).pendingError,first);unitCases.push('later-true-does-not-discharge');
 control.outcomes.push(false);control.step(row);assert.equal(control.state(row).pendingError,first);unitCases.push('later-false-does-not-discharge');
 const hard=error('EIO','HARD_AFTER_PENDING');control.outcomes.push(hard);assert.throws(()=>control.step(row),observed=>observed===hard);unitCases.push('hard-error-after-pending-refused');

 const definitions=[
  ['pending-repeat-live-settles','settles','PASS',true,false],
  ['pending-final-denial-settles','final-settles','PASS',true,false],
  ['pending-first-denial-refused','first','FAIL',true,false],
  ['pending-absent-result-not-ack','absent','FAIL',true,false],
  ['pending-zombie-result-not-ack','zombie','FAIL',true,false],
  ['pending-other-row-ack-refused','other-row','FAIL',true,false],
  ['pending-inspection-failure-refused','inspection','FAIL',true,false],
  ['pending-other-error-refused','other-error','FAIL',true,false],
  ['pending-non-darwin-refused','non-darwin','FAIL',true,false],
  ['pending-persistent-live-retains-root','persistent','FAIL',false,true],
  ['pending-no-close-retains-root','no-close','FAIL',true,true],
  ['pending-child-failure-retained','child','FAIL',true,false],
  ['pending-report-failure-retained','report','FAIL',true,false],
  ['pending-source-failure-retained','source','FAIL',true,false],
  ['pending-interruption-retained','interruption','FAIL',true,false],
  ['pending-cleanup-source-change-refused','cleanup-source','FAIL',true,false],
  ['pending-late-proof-retains-root','late-proof','FAIL',true,true],
  ['pending-routing-bypass-fault-detected','routing-fault','FAIL',true,false],
  ['pending-exit-routing-fault-detected','exit-routing-fault','FAIL',true,false],
  ['pending-precompletion-routing-fault-detected','precompletion-routing-fault','FAIL',true,false],
  ['pending-final-routing-fault-detected','final-routing-fault','FAIL',true,false],
  ['pending-abort-routing-fault-detected','abort-routing-fault','FAIL',true,false]
 ];
 const nativeRows=group=>{
  const output=execFileSync('/bin/ps',['-axo','pid=,pgid=,stat='],{encoding:'utf8',timeout:1000,killSignal:'SIGKILL',maxBuffer:4*1024*1024,env:{...process.env,LC_ALL:'C'}});
  assert(output.endsWith('\n'),'PENDING_NATIVE_SNAPSHOT_COMPLETE_ORACLE');
  return output.trim().split('\n').map(line=>{const match=/^\s*(\d+)\s+(\d+)\s+(\S+)\s*$/.exec(line);assert(match,'PENDING_NATIVE_SNAPSHOT_ROW_ORACLE');return {pid:Number(match[1]),pgid:Number(match[2]),state:match[3]};}).filter(row=>row.pgid===group);
 };
 const active=rows=>rows.some(row=>row.state[0]!=='Z'&&!(process.platform==='linux'&&row.state[0]==='X'));
 const failureText=failure=>[failure?.message,failure?.cause?.message,...(failure?.cleanupErrors||[])].filter(Boolean).join('\n');
 const childCode=[
  "const fs=require('node:fs'),cp=require('node:child_process');",
  "const lane=process.env.CLOSED_LOOP_BROWSER_EXTRA_LANE,mode=process.env.PENDING_MODE,folder=process.env.PENDING_FOLDER;",
  "const child=JSON.parse(process.env.PENDING_CHILDREN)[lane];child.invocationId=process.env.CLOSED_LOOP_BROWSER_EXTRA_INVOCATION_ID;child.sourceFingerprint=process.env.CLOSED_LOOP_BROWSER_EXTRA_SOURCE_FINGERPRINT;child.browserExecution=null;",
  "for(const key of ['outcome','exitCode','signal','timedOut','reportsSha256'])delete child[key];",
  "const complete=()=>{for(const report of child.reports)console.log(JSON.stringify(report));console.log(JSON.stringify({browserExtraChild:child}));};",
  "const orphan=lane==='lane1'||(lane==='lane2'&&mode==='other-row');",
  "if(orphan){const ready=folder+'/'+lane+'.descendant';cp.spawn(process.execPath,['-e',\"require('node:fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},50)\",ready],{stdio:'ignore'});}",
  "const by=Number(process.env.CLOSED_LOOP_BROWSER_EXTRA_DEADLINE_AT);",
  "const finish=()=>{if(Date.now()>by)throw Error('PENDING_CHILD_READY_DEADLINE');if(orphan&&!fs.existsSync(folder+'/'+lane+'.descendant'))return setTimeout(finish,5);if(lane==='lane1'&&mode==='other-row'&&!fs.existsSync(folder+'/other-ack'))return setTimeout(finish,5);if(lane==='lane2'&&['child','report'].includes(mode)&&!fs.existsSync(folder+'/target-ack'))return setTimeout(finish,5);if(lane==='lane2'&&mode==='child')process.exit(7);if(lane==='lane2'&&mode==='report')console.log(JSON.stringify({browserExtraChild:{}}));else complete();process.exit(0);};",
  "setTimeout(finish,20);"
 ].join('\n');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'clrt-pending-cleanup-'));
 try{
  for(const [name,mode,expected,nativeGoneExpected,rootRetainedExpected]of definitions){
   const folder=path.join(directory,mode);fs.mkdirSync(folder);
   const fixtureSuite=path.join(folder,'verify-browser-extra.mjs'),fixtureAggregate=path.join(folder,'browser-extra-aggregate.mjs');
   fs.writeFileSync(fixtureSuite,'// synthetic source identity only\n');fs.writeFileSync(fixtureAggregate,'// synthetic source identity only\n');
   const initialFixture=fs.readFileSync(fixtureSuite),owned=[],signals=[],nativeObservations=[],events=new EventEmitter();
   let target,callCount=0,syntheticInspection=false,released=false,delayed=false,deadlineAt,nativeReleaseTimer;
   const finalDenial=['final-settles','final-routing-fault'].includes(mode);
   const nativeRelease=()=>{try{process.kill(-target.pid,'SIGKILL');}catch(failure){if(!['ESRCH','EPERM'].includes(failure.code))throw failure;}released=true;};
   const observeLive=()=>{
    const group=target.pid,descendant=Number(fs.readFileSync(path.join(folder,'lane1.descendant'),'utf8')),members=nativeRows(group);
    assert(members.some(row=>row.pid===descendant&&row.pgid===group&&row.state[0]!=='Z'&&!(process.platform==='linux'&&row.state[0]==='X')),'PENDING_REAL_OWNED_DESCENDANT_LIVE_ORACLE');
    const fact={groupId:group,descendantId:descendant,members};nativeObservations.push(fact);return fact;
   };
   const kill=(pid,signal)=>{
    if(pid!==-target?.pid){
     const result=process.kill(pid,signal);
     if(mode==='other-row'&&owned.find(row=>row.pid===-pid)?.laneId==='lane2')fs.writeFileSync(path.join(folder,'other-ack'),'native acknowledgement');
     return result;
    }
    assert.equal(signal,'SIGKILL');callCount++;
    if(callCount===1){
     observeLive();
     if(mode==='first'||mode==='other-row'){signals.push('injected-first-denial');throw error('EPERM','CONTROLLED_FIRST_DENIAL');}
     if(mode==='absent'){signals.push('injected-absent');throw error('ESRCH','CONTROLLED_ABSENT');}
     if(mode==='zombie'){signals.push('injected-zombie-inspection');syntheticInspection=true;throw error('EPERM','CONTROLLED_ZOMBIE_RESULT');}
     signals.push('injected-acknowledgement-without-signal');fs.writeFileSync(path.join(folder,'target-ack'),'synthetic acknowledgement');return true;
    }
    if(finalDenial&&callCount===2){observeLive();signals.push('injected-second-acknowledgement-without-signal');return true;}
    if(finalDenial&&callCount===3){observeLive();signals.push('injected-final-denial');nativeReleaseTimer=setTimeout(nativeRelease,25);throw error('EPERM','CONTROLLED_FINAL_DENIAL');}
    if(callCount===2){
     observeLive();signals.push('injected-repeat-denial');
     if(mode==='other-error')throw error('EACCES','CONTROLLED_OTHER_SIGNAL_ERROR');
     throw error('EPERM','CONTROLLED_REPEAT_DENIAL');
    }
    if(mode==='persistent'){signals.push('injected-persistent-denial');throw error('EPERM','CONTROLLED_PERSISTENT_DENIAL');}
    signals.push('native-cleanup-signal');let result;
    try{result=process.kill(pid,signal);}catch(failure){if(failure.code!=='ESRCH')throw failure;result=true;}
    released=true;
    if(mode==='cleanup-source')fs.appendFileSync(fixtureSuite,'// changed during cleanup\n');
    return result;
   };
   const inspect=group=>{
    if(group===target?.pid){
     if(syntheticInspection){syntheticInspection=false;return false;}
     if(mode==='inspection'&&callCount===2)throw error('EIO','CONTROLLED_INSPECTION_FAILURE');
     const running=groupHasRunningProcesses(group);
     if(mode==='late-proof'&&released&&!running&&!delayed){delayed=true;while(Date.now()<=deadlineAt){}}
     return running;
    }
    return groupHasRunningProcesses(group);
   };
   const controlledProcess={platform:mode==='non-darwin'?'linux':'darwin',pid:process.pid,execPath:process.execPath,env:process.env,cwd:process.cwd.bind(process),stderr:process.stderr,kill,once:events.once.bind(events),removeListener:events.removeListener.bind(events)};
   const sourceMutation=mode.endsWith('routing-fault');
   let candidate=source;
   if(sourceMutation){
    assert.equal(source.split('stopRow(row)').length-1,4,'PENDING_ROUTING_FAULT_ANCHOR_ORACLE');
    const site={ 'abort-routing-fault':0,'exit-routing-fault':1,'precompletion-routing-fault':2,'final-routing-fault':3 }[mode];
    let index=0;candidate=source.replaceAll('stopRow(row)',match=>{const replace=mode==='routing-fault'||index===site;index++;return replace?'killGroup(row.process)':match;});
    assert.notEqual(candidate,source);
   }
   const executedSourceSha256=createHash('sha256').update(candidate).digest('hex');
   const body=candidate.replace(/^import .+;\r?\n/gm,'').replace(/^export \{groupHasRunningProcesses\};\r?\n?/gm,'').replace(/^export /gm,'');
   const supervisorStart=candidate.indexOf('export async function superviseBrowserExtra('),exportEnd=candidate.lastIndexOf('\nexport {groupHasRunningProcesses};');
   assert(supervisorStart>=0&&exportEnd>supervisorStart);assert(body.includes(candidate.slice(supervisorStart+'export '.length,exportEnd)),'PENDING_EXACT_SUPERVISOR_BODY_ORACLE');
   assert(body.includes(candidate.slice(candidate.indexOf('function killGroup('),candidate.indexOf('function groupHasRunningProcesses('))),'PENDING_EXACT_KILL_BODY_ORACLE');
   const context=createVerifierRuntime({assert,fs,path,os,createHash,randomBytes,spawn,execFileSync,isDeepStrictEqual,validateBrowserExecution,process:controlledProcess,Buffer,URL,setTimeout,clearTimeout,__nativeInspection:inspect});
   createVerifierRuntime.loadScript(context,"'use strict';"+body+'\ngroupHasRunningProcesses=__nativeInspection;globalThis.supervisor=superviseBrowserExtra;',{filename:'actual-browser-extra-aggregate-controlled-seams.mjs'});
   let failure,result,nativeGoneAtReturn,rootRetainedAtReturn;
   try{
    const startedAt=Date.now();deadlineAt=startedAt+2500;
    try{
     result=await context.supervisor({cwd:folder,startedAt,deadlineMs:2500,sourceChecks:phase=>{
      if(phase==='after'&&['source','abort-routing-fault'].includes(mode))throw Error('CONTROLLED_PRIMARY_SOURCE_FAILURE');
      if(phase==='after'&&mode==='interruption')events.emit('SIGTERM');
     },environment:process.env,outputDirectory:path.join(folder,'output'),onFailureOutput:()=>{},spawnChild:(_command,_args,options)=>{
      const child=spawn(process.execPath,['-e',childCode],{...options,env:{...options.env,PENDING_MODE:mode,PENDING_FOLDER:folder,PENDING_CHILDREN:JSON.stringify(terminalByLane)}});
      const record={pid:child.pid,laneId:options.env.CLOSED_LOOP_BROWSER_EXTRA_LANE,profile:options.env.CLOSED_LOOP_BROWSER_EXTRA_PROFILE_PATH,child,nativeCloseObserved:false};owned.push(record);
      if(record.laneId==='lane1')target=record;
      const emit=child.emit.bind(child);child.emit=(event,...args)=>{if(event==='close'){record.nativeCloseObserved=true;if(mode==='no-close'&&record===target)return false;}return emit(event,...args);};
      return child;
     }});
    }catch(observed){failure=observed;}
    assert(target&&nativeObservations.length>0,'PENDING_NATIVE_ENDPOINT_POPULATION_ORACLE');
    nativeGoneAtReturn=!active(nativeRows(target.pid));rootRetainedAtReturn=fs.existsSync(target.profile);
    assert.equal(failure?'FAIL':'PASS',expected,'PENDING_CONTROL_OUTCOME_ORACLE: '+name);
    assert.equal(nativeGoneAtReturn,nativeGoneExpected,'PENDING_NATIVE_RETURN_STATE_ORACLE: '+name);
    assert.equal(rootRetainedAtReturn,rootRetainedExpected,'PENDING_ROOT_CUSTODY_ORACLE: '+name);
    if(expected==='PASS'){assert.equal(result.browserExtraAggregate.complete,true);assert.equal(result.browserExtraAggregate.cleanupComplete,true);assert(result.browserExtraAggregate.elapsedMs<2500);assert(owned.every(row=>row.nativeCloseObserved));}
    else{
     const text=failureText(failure);
     const marker=mode==='child'?'failed exit 7':mode==='report'?'terminal reports differ from actual buffered stdout':['source','abort-routing-fault'].includes(mode)?'CONTROLLED_PRIMARY_SOURCE_FAILURE':mode==='interruption'?'parent received SIGTERM':mode==='cleanup-source'?'source changed during child cleanup':mode==='other-error'?'CONTROLLED_OTHER_SIGNAL_ERROR':mode==='inspection'?'CONTROLLED_INSPECTION_FAILURE':mode==='final-routing-fault'?'CONTROLLED_FINAL_DENIAL':['first','other-row'].includes(mode)?'CONTROLLED_FIRST_DENIAL':'CONTROLLED_REPEAT_DENIAL';
     assert(text.includes(marker),'PENDING_ORIGINAL_FAILURE_ORACLE: '+name+' '+text);
     if(mode==='source')assert(!(failure.cleanupErrors||[]).some(message=>message.includes('CONTROLLED_REPEAT_DENIAL')),'PENDING_ABORT_ROUTE_ORACLE');
     if(mode==='abort-routing-fault')assert((failure.cleanupErrors||[]).some(message=>message.includes('CONTROLLED_REPEAT_DENIAL')),'PENDING_ABORT_MUTATION_ORACLE');
     if(['persistent','no-close','late-proof'].includes(mode))assert(/deadline/.test(text),'PENDING_DEADLINE_CAUSE_ORACLE: '+name);
    }
   }finally{
    clearTimeout(nativeReleaseTimer);
    const by=Date.now()+2500;
    for(;;){
     const live=owned.filter(row=>active(nativeRows(row.pid)));
     if(!live.length)break;
     assert(Date.now()<by,'PENDING_TEST_OWNED_GROUP_CLEANUP_ORACLE');
     for(const row of live)try{process.kill(-row.pid,'SIGKILL');}catch(error){if(!['ESRCH','EPERM'].includes(error.code))throw error;}
     await new Promise(resolve=>setTimeout(resolve,10));
    }
    while(!owned.every(row=>row.nativeCloseObserved)){assert(Date.now()<by,'PENDING_NATIVE_CLOSE_CLEANUP_ORACLE');await new Promise(resolve=>setTimeout(resolve,10));}
    for(const row of owned){assert(!active(nativeRows(row.pid)));fs.rmSync(row.profile,{recursive:true,force:true});assert(!fs.existsSync(row.profile));}
    fs.writeFileSync(fixtureSuite,initialFixture);
   }
   assert.equal(fs.readFileSync(new URL('./browser-extra-aggregate.mjs',import.meta.url),'utf8'),source,'PENDING_PRODUCTION_SOURCE_RESTORED_ORACLE');
   rows.push({name,expected,observed:failure?'FAIL':'PASS',passed:true,signalInjectionsSynthetic:true,inspectionInjectionsSynthetic:['zombie','inspection'].includes(mode),injectedPlatform:controlledProcess.platform,nativePlatform:process.platform,nativeLive: nativeObservations[0],nativeGoneAtReturn,ownedRootRetainedAtReturn:rootRetainedAtReturn,allNativeGoneAfterControlCleanup:true,allOwnedRootsRemovedAfterControlCleanup:true,allNativeCloseObserved:true,productionSourceUnchanged:true,executedSourceSha256,sourceMutation,failurePreserved:expected==='FAIL',deadlineMs:2500});
   processCases.push(name);
  }
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
 return {schema:'closed-loop-browser-extra-pending-cleanup-controls/1',productionSourceSha256,unmutatedBodiesUnchanged:true,syntheticSignalProtocol:true,actualNativeEndpoints:true,actualBrowser:false,eligibleReceiptCreated:false,platform:process.platform,unitCases,cases:rows,testOwnedCleanupComplete:true,processCases};
}

export async function verifyBrowserExtraAggregateControls(){
const sha=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const suite='verify-browser-extra.mjs',sourceCommit='1'.repeat(40),hex='2'.repeat(64),invocationId='3'.repeat(64),buildIdentity='build-sha256-'+hex;
const names=['index.html','workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','test-worker.js','TEST_PROJECT.json','.nojekyll'];
const manifest={schema:'closed-loop-deployment-manifest/1',sourceCommit,canonicalOrigin:'https://example.invalid',canonicalBasePath:'/closed-loop/',buildIdentity,runtimeResources:names.map((path,index)=>({path,byteSize:index,digest:hex,hashAlgorithm:'SHA-256',buildIdentity}))};
manifest.manifestDigest={hashAlgorithm:'SHA-256',digest:globalThis.closedLoopHash.sha256Value(manifest)};
const populations=browserExtraRequiredPopulations();
const inputSha256=Object.fromEntries(fs.readdirSync('.').filter(name=>!name.startsWith('.')&&/^[^/\\]+\.(?:m?js|html|css)$/.test(name)).sort().map(name=>[name,sha(fs.readFileSync(name))]));
const sourceFingerprint=browserExtraFingerprintFromInputs(inputSha256);
assert.equal(browserExtraSourceFingerprint(),sourceFingerprint);
const fingerprint={sourceCommit,sourceTree:'4'.repeat(40),sourceInputsSha256:sha(inputSha256),inputSha256,specificationSha256:hex,catalogSha256:inputSha256['verification-evidence-catalog.mjs'],runtime:{node:process.version,platform:process.platform,architecture:process.arch}};
const nativeReport={nativeBrowserCommand:{checkId:'test-ir.native-browser-command',passed:true,synthetic:true,actualBrowser:true,buildIdentity,testWorkerSha256:hex,cases:[22,24].map(stage=>({stage,nativeRequests:1,storeCommands:1,actualTestWorker:true,actualStorageWorker:true,actualIndexedDB:true,committedAndReloaded:true,completeIdentityRetained:true,current:true,rawDefinitionPreserved:true,canonicalIntegrity:true,fullStageCompletionClaimed:false,projectSha256:hex,identitySha256:hex,...(stage===22?{mutationConfirmation:{code:'MUTATION_CONFIRMATION_REQUIRED',actualStorageWorker:true,exactCurrentImpact:true,savedDigestUnchanged:true,savedRevisionUnchanged:true,committedProofRetained:true}}:{})}))}};
function carrier(laneId,scope='LOCAL'){
 const base=scope==='LOCAL'?'http://127.0.0.1:'+String(12000+Number(laneId.slice(-1)))+'/':manifest.canonicalOrigin+manifest.canonicalBasePath;
 const scripts=manifest.runtimeResources.filter(row=>row.path.endsWith('.js')&&row.path!=='test-worker.js').map(row=>({path:row.path,byteSize:row.byteSize,sha256:row.digest,url:new URL(row.path,base).href,targetType:'PAGE',observation:'DEBUGGER_SCRIPT_SOURCE'}));
 const workers=BROWSER_EXTRA_LANES.find(lane=>lane.laneId===laneId).requiredWorkerPaths.map(name=>{const row=manifest.runtimeResources.find(row=>row.path===name);return {path:name,byteSize:row.byteSize,sha256:row.digest,url:new URL(name+(name==='project-store.js'?'?storeWorker=1&storeContext=synthetic-'+laneId:'?worker=1'),base).href,targetType:'WORKER',observation:'DEBUGGER_SCRIPT_SOURCE'};});
 return {schema:'closed-loop-browser-execution/1',suite,scope,sourceCommit,manifestDigest:manifest.manifestDigest.digest,buildIdentity,pageUrl:base,pageOrigin:new URL(base).origin,browserVersion:'SYNTHETIC_ADMISSION_CONTROL_ONLY',complete:true,applicationReady:true,resources:manifest.runtimeResources.map(row=>({path:row.path,byteSize:row.byteSize,sha256:row.digest,responseUrl:new URL(row.path,base).href,status:200,observation:'BROWSER_HTTP_BYTES'})),observedScriptSources:[...scripts,...workers],observedDocuments:[{url:base,status:200,byteSize:0,sha256:hex,observation:'BROWSER_DOCUMENT_RESPONSE'}],observedWorkers:workers.map(row=>row.url),unobservedRuntimeResources:manifest.runtimeResources.filter(row=>![...scripts,...workers].some(script=>script.path===row.path)).map(row=>row.path).sort()};
}
function fixture(scope='LOCAL'){
 const children=BROWSER_EXTRA_LANES.map(lane=>{
  const reports=lane.laneId==='lane2'?[{storageReliabilityStalePart:{staleCreatePreserved:true}}]:lane.laneId==='lane4'?[{storageReliabilityBrowserPart:{packageCustodyProof:{requiredMembers:true},importCommitProof:{commit:true},importSurvivedReload:true}},structuredClone(nativeReport)]:[{syntheticLane:lane.laneId}];
  return {schema:BROWSER_EXTRA_CHILD_SCHEMA,laneId:lane.laneId,invocationId,sourceFingerprint,complete:true,scenarios:lane.scenarios.map(id=>({id,population:structuredClone(populations[id]),passed:true})),reports,reportsSha256:sha(reports),browserExecution:scope?carrier(lane.laneId,scope):null,dialogs:[],runtimeErrors:0,outcome:'PASS',exitCode:0,signal:null,timedOut:false};
 });
 const aggregate={schema:BROWSER_EXTRA_AGGREGATE_SCHEMA,invocationId,sourceFingerprint,complete:true,elapsedMs:100,deadlineMs:600000,maxConcurrent:4,cleanupComplete:true,sourceChecks:{before:true,after:true},children};
 const browserExecution=children[0].browserExecution;
 const owner={browserExtraVerified:true,completeBrowserExtraAggregate:true,browserExtraAggregate:aggregate,browserExecution,exactPromptCopy:true,pendingProposalReload:true,successfulExport:true,successfulImport:true,canonicalDataRoundTrip:true,retainedNotDuplicated:true,retainedDeleteSuppression:true,projectLifecycleFunctional:true,blockerControl:true,freshContextControlContextual:true,blobPersistence:true,artifactIdempotence:true,twoTabConflict:true,storageFailureRollback:true,transactionMutatorLifetime:true,closedConnectionPromptSave:true,runtimeErrors:0};
 const reports=[...children.flatMap(child=>child.reports),{storageReliabilityBrowser:true,staleCreatePreserved:true,requiredMembers:true,commit:true,importSurvivedReload:true},owner];
 return {aggregate,browserExecution,reports,expected:scope?{scope,manifest,sourceCommit}:null,sourceFingerprint};
}
const cases=[];
for(const scope of ['LOCAL','DEPLOYED',null]){const row=fixture(scope);assert.equal(validateBrowserExtraAggregate(row.aggregate,row),true);cases.push('conforming-'+(scope||'explicit-unscoped'))}
assert.equal(BROWSER_EXTRA_LANES.length,4);assert.deepEqual(BROWSER_EXTRA_LANES.map(row=>row.scenarios.length),[18,4,4,8]);assert.equal(new Set(BROWSER_EXTRA_LANES.flatMap(row=>row.scenarios)).size,34);
const mutations=[
 ['missing-lane',row=>row.aggregate.children.pop()],['duplicate-lane',row=>row.aggregate.children[1]=structuredClone(row.aggregate.children[0])],['unknown-lane',row=>row.aggregate.children[2].laneId='lane5'],
 ['missing-scenario',row=>row.aggregate.children[0].scenarios.pop()],['duplicate-scenario',row=>row.aggregate.children[0].scenarios[1]=structuredClone(row.aggregate.children[0].scenarios[0])],['unknown-scenario',row=>row.aggregate.children[0].scenarios[0].id='invented'],
 ['failed-scenario',row=>row.aggregate.children[2].scenarios[0].passed=false],['nonzero-child',row=>row.aggregate.children[1].exitCode=1],['signal-child',row=>row.aggregate.children[1].signal='SIGTERM'],['timeout-child',row=>row.aggregate.children[1].timedOut=true],
 ['incomplete-terminal',row=>row.aggregate.children[1].complete=false],['child-nonce',row=>row.aggregate.children[1].invocationId='0'.repeat(64)],['child-source',row=>row.aggregate.children[1].sourceFingerprint='0'.repeat(64)],
 ['aggregate-source',row=>row.aggregate.sourceFingerprint='0'.repeat(64)],['dialogs',row=>row.aggregate.children[1].dialogs.push('unexpected')],['runtime-error',row=>row.aggregate.children[1].runtimeErrors=1],['hidden-error',row=>row.aggregate.children[1].error='failure'],
 ['reports-digest',row=>row.aggregate.children[1].reportsSha256='0'.repeat(64)],['focused-child-owner-masquerade',row=>row.aggregate.children[0].browserExtraVerified=true],['focused-child-reports-masquerade',row=>row.aggregate.children[0].reports.push({browserExtraVerified:true})],
 ['source-postcheck-failure',row=>row.aggregate.sourceChecks.after=false],['cleanup-incomplete',row=>row.aggregate.cleanupComplete=false],['late-success',row=>row.aggregate.elapsedMs=600000],['extended-deadline',row=>row.aggregate.deadlineMs=600001],
 ['missing-lane4-test-worker',row=>{const value=row.aggregate.children[3].browserExecution;value.observedScriptSources=value.observedScriptSources.filter(script=>script.path!=='test-worker.js');value.observedWorkers=value.observedWorkers.filter(url=>!url.includes('test-worker.js'));value.unobservedRuntimeResources.push('test-worker.js');value.unobservedRuntimeResources.sort();}],
 ['wrong-concurrency',row=>row.aggregate.maxConcurrent=3],['invented-union-carrier',row=>{row.browserExecution=structuredClone(row.browserExecution);row.browserExecution.browserVersion='INVENTED UNION';}],
 ['duplicate-final-marker',row=>row.reports.push(structuredClone(row.reports.at(-1)))],['missing-native-report',row=>row.reports.splice(row.reports.findIndex(row=>row.nativeBrowserCommand),1)],
 ['duplicated-parent-child-report',row=>row.reports.unshift(structuredClone(row.reports[0]))],['fabricated-storage-union',row=>row.reports.find(row=>row.storageReliabilityBrowser).commit=false]
];
for(let i=0;i<4;i++)for(const [name,change] of [
 ['scope',value=>value.scope='DEPLOYED'],['source',value=>value.sourceCommit='0'.repeat(40)],['build',value=>value.buildIdentity='build-sha256-'+'0'.repeat(64)],['manifest',value=>value.manifestDigest='0'.repeat(64)],
 ['missing-page-script',value=>value.observedScriptSources=value.observedScriptSources.filter(row=>row.path!=='app-core.js')],['wrong-script-bytes',value=>value.observedScriptSources[0].sha256='0'.repeat(64)],
 ['missing-document',value=>value.observedDocuments=[]],['wrong-document-bytes',value=>value.observedDocuments[0].sha256='0'.repeat(64)],
 ['missing-worker',value=>{value.observedScriptSources=value.observedScriptSources.filter(row=>row.targetType!=='WORKER');value.observedWorkers=[];}],['wrong-worker-bytes',value=>value.observedScriptSources.find(row=>row.targetType==='WORKER').sha256='0'.repeat(64)],
 ['wrong-http-bytes',value=>value.resources[0].sha256='0'.repeat(64)]
])mutations.push(['lane'+(i+1)+'-'+name,row=>change(row.aggregate.children[i].browserExecution)]);
for(let i=0;i<4;i++)for(const mode of ['archive-parser-only','missing-store-worker-role','wrong-store-worker-role'])mutations.push(['lane'+(i+1)+'-'+mode,row=>{
 const execution=row.aggregate.children[i].browserExecution;
 for(const source of execution.observedScriptSources.filter(source=>source.path==='project-store.js'&&source.targetType==='WORKER')){const before=source.url,url=new URL(before);if(mode==='archive-parser-only')url.searchParams.set('archiveParser','1');else if(mode==='missing-store-worker-role')url.searchParams.delete('storeWorker');else url.searchParams.set('storeWorker','0');source.url=url.href;execution.observedWorkers=execution.observedWorkers.map(value=>value===before?source.url:value);}
},/BROWSER_EXTRA_AGGREGATE_ORACLE: actual native storage worker was not observed/]);
for(const lane of BROWSER_EXTRA_LANES)for(const id of lane.scenarios)mutations.push(['wrong-population:'+id,row=>row.aggregate.children.find(child=>child.laneId===lane.laneId).scenarios.find(scenario=>scenario.id===id).population={executions:999}]);
for(const [name,change,pattern=/BROWSER_(?:EXTRA_AGGREGATE_ORACLE|EXECUTION_EVIDENCE)/]of mutations){const row=fixture();change(row);assert.throws(()=>validateBrowserExtraAggregate(row.aggregate,row),pattern,name);cases.push(name);}
const valid=fixture(),stdout=valid.reports.map(row=>JSON.stringify(row)).join('\n');
const receipt=createExecutionReceipt(suite,{command:[process.execPath,suite],exitCode:0,outcome:'PASS',stdout,stderr:''},{fingerprint,browser:{scope:'LOCAL',manifest}});
assert.equal(validateExecutionReceipt(JSON.parse(JSON.stringify(receipt)),suite,fingerprint).receiptSha256,receipt.receiptSha256);cases.push('complete-current-receipt-roundtrip');
for(const [name,mutate]of [
 ['historical-single-carrier-not-reinterpreted',value=>{delete value.reports.at(-1).browserExtraAggregate;delete value.reports.at(-1).completeBrowserExtraAggregate;}],
 ['focused-command',value=>value.command.push('--lane1')],['extra-top-level-carrier',value=>value.reports.push({browserExecution:structuredClone(value.reports.at(-1).browserExecution)})],
 ['receipt-child-source-substitution',value=>value.reports.at(-1).browserExtraAggregate.children[2].sourceFingerprint='0'.repeat(64)],
 ['receipt-lane4-script-substitution',value=>value.reports.at(-1).browserExtraAggregate.children[3].browserExecution.observedScriptSources[0].sha256='0'.repeat(64)]
]){const copy=structuredClone(receipt);mutate(copy);delete copy.receiptSha256;copy.receiptSha256=sha(copy);assert.throws(()=>validateExecutionReceipt(copy,suite,fingerprint),/EVIDENCE|AGGREGATE/,name);cases.push(name);}
const child=structuredClone(valid.aggregate.children[0]);for(const field of ['outcome','exitCode','signal','timedOut','reportsSha256'])delete child[field];
const childStdout='progress\n'+child.reports.map(row=>JSON.stringify(row)).join('\n')+'\n'+JSON.stringify({browserExtraChild:child})+'\n';
assert.deepEqual(parseBrowserExtraChildOutput(childStdout).child,child);
for(const [name,output]of [['duplicate-child-terminal',childStdout+JSON.stringify({browserExtraChild:child})+'\n'],['missing-child-terminal','progress\n'],['incomplete-child-terminal',childStdout.slice(0,-5)],['stdout-after-terminal',childStdout+'late progress\n'],['stdout-report-substitution',childStdout.replace('"syntheticLane":"lane1"','"syntheticLane":"WRONG"')]]){assert.throws(()=>parseBrowserExtraChildOutput(output),/AGGREGATE/,name);cases.push(name);}

// These controls launch real isolated Node process groups, never Chromium.
const processGroupProof=await verifyBrowserExtraDarwinGroupControls();
const directory=fs.mkdtempSync(path.join(process.cwd(),'.browser-extra-process-controls-'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const live=nativeProcessRunning;
const processCases=[processGroupProof.caseName],socketProofs=[];
try{
 fs.writeFileSync(path.join(directory,suite),'// synthetic process-control source\n');fs.writeFileSync(path.join(directory,'browser-extra-aggregate.mjs'),'// synthetic process-control source\n');
 const terminalByLane=Object.fromEntries(valid.aggregate.children.map(row=>[row.laneId,row]));
 const controlCode=`
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const lane=process.env.CLOSED_LOOP_BROWSER_EXTRA_LANE,mode=process.env.CONTROL_MODE,dir=process.env.CONTROL_DIRECTORY;
const profile=process.env.CLOSED_LOOP_BROWSER_EXTRA_PROFILE_PATH;
fs.writeFileSync(profile+'/synthetic-browser-profile-sentinel','owned');
const temporary=require('node:os').tmpdir()+'/synthetic-fixture-temp';fs.writeFileSync(temporary,'owned fixture tempfile');fs.writeFileSync(dir+'/'+lane+'.tempfile',temporary);
fs.appendFileSync(process.env.CLOSED_LOOP_BROWSER_EXTRA_CHROMIUM_STDERR_PATH,'synthetic Chromium stderr '+lane+'\\n');
const child=JSON.parse(process.env.CONTROL_CHILDREN)[lane];child.invocationId=process.env.CLOSED_LOOP_BROWSER_EXTRA_INVOCATION_ID;child.sourceFingerprint=process.env.CLOSED_LOOP_BROWSER_EXTRA_SOURCE_FINGERPRINT;child.browserExecution=null;
for(const key of ['outcome','exitCode','signal','timedOut','reportsSha256'])delete child[key];
const complete=()=>{for(const row of child.reports)console.log(JSON.stringify(row));console.log(JSON.stringify({browserExtraChild:child}));};
fs.writeFileSync(dir+'/'+lane+'.pid',String(process.pid));fs.writeFileSync(dir+'/'+lane+'.deadline',process.env.CLOSED_LOOP_BROWSER_EXTRA_DEADLINE_AT);
if(mode==='unix-socket'){
 const net=require('node:net'),socketDirectory=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'.org.chromium.Chromium.')),socketPath=path.join(socketDirectory,'SingletonSocket');
 const server=net.createServer(socket=>socket.once('data',data=>{assert.equal(data.toString(),'probe');socket.end('ack');}));
 server.on('error',error=>{console.error('UNIX_SOCKET_CONTROL_FAILURE',error);process.exitCode=1;});
 server.listen(socketPath,()=>{
  assert(fs.statSync(socketPath).isSocket(),'exact socket pathname missing or truncated');assert(Buffer.byteLength(socketPath)<100,'Chromium-shaped socket pathname is too long');
  const client=net.createConnection(socketPath,()=>client.write('probe'));let reply='';client.on('data',data=>reply+=data);client.on('end',()=>{assert.equal(reply,'ack');server.close(()=>{fs.writeFileSync(dir+'/'+lane+'.socket-proof',JSON.stringify({socketPath,bytes:Buffer.byteLength(socketPath),exchange:'probe/ack'}));complete();});});
 });
}else if(mode==='success'||mode==='postcheck'||mode==='sourcechange'){setTimeout(complete,40);}
else if(mode==='orphan'){const descendant=cp.spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},50)"],{stdio:'ignore'});fs.writeFileSync(dir+'/'+lane+'.descendant',String(descendant.pid));setTimeout(()=>{complete();process.exit(0);},80);}
else{const descendant=cp.spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},50)"],{stdio:'ignore'});fs.writeFileSync(dir+'/'+lane+'.descendant',String(descendant.pid));if(mode==='failure'&&lane==='lane2')setTimeout(()=>process.exit(7),120);else if(mode==='signal'&&lane==='lane3')setTimeout(()=>process.kill(process.pid,'SIGTERM'),120);else if(mode==='malformed'&&lane==='lane1')setTimeout(()=>{console.log('{\\"browserExtraChild\\":{}}');process.exit(0);},120);else {setTimeout(complete,2000);setInterval(()=>{},50);}}
`;
 function inspectOwnedProfile(options,runDir,ownedProfiles){
  const profile=options.env.CLOSED_LOOP_BROWSER_EXTRA_PROFILE_PATH;ownedProfiles.push(profile);
  assert.equal(path.dirname(profile),'/tmp');assert.match(path.basename(profile),/^be-/);assert(Buffer.byteLength(profile)<40);assert.equal(fs.statSync(profile).mode&0o777,0o700);
  for(const key of ['TMPDIR','TMP','TEMP'])assert.equal(options.env[key],profile);
  const diagnostic=options.env.CLOSED_LOOP_BROWSER_EXTRA_CHROMIUM_STDERR_PATH;assert.equal(diagnostic,path.resolve(runDir,options.env.CLOSED_LOOP_BROWSER_EXTRA_LANE+'.chromium.stderr.log'));assert.equal(fs.readFileSync(diagnostic,'utf8'),'');
 }
 async function run(mode,{deadlineMs=2500,longEvidence=false}={}){
  const caseName=longEvidence?'long-evidence-'+mode:mode,runDir=path.join(directory,caseName,...(longEvidence?['evidence-'.repeat(20)]:[]));fs.mkdirSync(runDir,{recursive:true});let launches=0;const phases=[],ownedProfiles=[];
  const inheritedTemp=path.join(runDir,'inherited-temporary-root');fs.mkdirSync(inheritedTemp);const unrelated=path.join(inheritedTemp,'do-not-remove');fs.writeFileSync(unrelated,'unrelated preserved');
  if(longEvidence)assert(Buffer.byteLength(runDir)>150);
  const call=()=>superviseBrowserExtra({cwd:directory,deadlineMs,onFailureOutput:()=>{},environment:{...process.env,TMPDIR:inheritedTemp,TMP:inheritedTemp,TEMP:inheritedTemp},sourceChecks:phase=>{phases.push(phase);if(mode==='postcheck'&&phase==='after')throw new Error('CONTROLLED_SOURCE_ONLY_POSTCHECK');if(mode==='sourcechange'&&phase==='after')fs.appendFileSync(path.join(directory,suite),'// mutation\n');},outputDirectory:runDir,spawnChild:(command,args,options)=>{launches++;inspectOwnedProfile(options,runDir,ownedProfiles);const child=spawn(command,['-e',controlCode],{...options,env:{...options.env,CONTROL_MODE:mode==='missing-close'?'success':mode,CONTROL_DIRECTORY:runDir,CONTROL_CHILDREN:JSON.stringify(terminalByLane)}});if(mode==='missing-close'){const emit=child.emit.bind(child);child.emit=(event,...args)=>event==='close'?true:emit(event,...args);}return child;}});
  let result;
  if(['success','orphan','unix-socket'].includes(mode))result=await call();else await assert.rejects(call,/AGGREGATE|CONTROLLED_SOURCE_ONLY_POSTCHECK/);
  assert.equal(launches,4,'exactly four processes launch');assert.equal(new Set(ownedProfiles).size,4,'each lane owns an isolated root');
  const deadlines=fs.readdirSync(runDir).filter(name=>name.endsWith('.deadline')).map(name=>fs.readFileSync(path.join(runDir,name),'utf8'));assert.equal(deadlines.length,4);assert.equal(new Set(deadlines).size,1,'all children inherit the same absolute deadline');
  for(const name of fs.readdirSync(runDir).filter(name=>/\.(?:pid|descendant)$/.test(name))){const pid=Number(fs.readFileSync(path.join(runDir,name)));assert.equal(live(pid),false,'surviving process '+name+': '+pid);}
  for(const profile of ownedProfiles)assert(!fs.existsSync(profile),'owned browser/temp root leaked: '+profile);
  assert.equal(fs.readFileSync(unrelated,'utf8'),'unrelated preserved','cleanup removed an unowned inherited temporary root');
  for(const name of fs.readdirSync(runDir).filter(name=>name.endsWith('.tempfile')))assert(!fs.existsSync(fs.readFileSync(path.join(runDir,name),'utf8')),'owned fixture tempfile leaked');
  for(const lane of BROWSER_EXTRA_LANES){assert(fs.existsSync(path.join(runDir,lane.laneId+'.stdout.log')));assert(fs.existsSync(path.join(runDir,lane.laneId+'.stderr.log')));assert.equal(fs.readFileSync(path.join(runDir,lane.laneId+'.chromium.stderr.log'),'utf8'),'synthetic Chromium stderr '+lane.laneId+'\n');}
  if(result){assert.deepEqual(phases,['before','after']);assert.equal(result.rawChildren.length,4);assert.equal(result.browserExecution,null);for(const row of result.rawChildren){assert(!row.stdoutWithoutTerminal.includes('browserExtraChild'));assert.equal(row.stdout,fs.readFileSync(row.stdoutPath,'utf8'));assert.equal(row.chromiumStderrPath,path.join(runDir,row.laneId+'.chromium.stderr.log'));}}
  if(mode==='unix-socket'){for(const lane of BROWSER_EXTRA_LANES){const proof=JSON.parse(fs.readFileSync(path.join(runDir,lane.laneId+'.socket-proof'),'utf8'));assert.equal(proof.exchange,'probe/ack');assert(proof.bytes<100);assert(!fs.existsSync(path.dirname(proof.socketPath)),'owned socket directory leaked');socketProofs.push({laneId:lane.laneId,...proof,evidenceDirectoryBytes:Buffer.byteLength(runDir)});}}
  if(mode==='timeout'){await wait(100);for(const lane of BROWSER_EXTRA_LANES)assert(!fs.readFileSync(path.join(runDir,lane.laneId+'.stdout.log'),'utf8').includes('browserExtraChild'),'late success leaked');}
  processCases.push(caseName);
 }
 await run('success');await run('orphan');await run('failure');await run('signal');await run('malformed');await run('timeout',{deadlineMs:500});await run('missing-close',{deadlineMs:500});await run('postcheck');await run('sourcechange');processCases.push((await verifyBrowserExtraCleanupRetentionControl()).caseName);await run('unix-socket',{longEvidence:true});await run('failure',{longEvidence:true});await run('timeout',{deadlineMs:500,longEvidence:true});
 let precheckLaunches=0;await assert.rejects(()=>superviseBrowserExtra({cwd:directory,sourceChecks:()=>{throw new Error('CONTROLLED_SOURCE_ONLY_PRECHECK');},onFailureOutput:()=>{},outputDirectory:path.join(directory,'precheck'),spawnChild:()=>{precheckLaunches++;throw new Error('should not spawn');}}),/CONTROLLED_SOURCE_ONLY_PRECHECK/);assert.equal(precheckLaunches,0);processCases.push('source-precheck-never-launches');
 const partialDir=path.join(directory,'partial-spawn');fs.mkdirSync(partialDir);const partialProfiles=[];let partialLaunches=0,firstChild;await assert.rejects(()=>superviseBrowserExtra({cwd:directory,sourceChecks:()=>{},onFailureOutput:()=>{},outputDirectory:partialDir,spawnChild:(command,args,options)=>{inspectOwnedProfile(options,partialDir,partialProfiles);if(++partialLaunches===2)throw new Error('CONTROLLED_SYNC_SPAWN_FAILURE');firstChild=spawn(command,['-e','setInterval(()=>{},50)'],options);return firstChild;}}),/CONTROLLED_SYNC_SPAWN_FAILURE/);assert.equal(live(firstChild.pid),false);assert.equal(partialProfiles.length,2);for(const profile of partialProfiles)assert(!fs.existsSync(profile),'partial spawn profile leaked');processCases.push('partial-spawn-failure-cleans-started-child');
 let spawned=false;await assert.rejects(()=>superviseBrowserExtra({cwd:directory,deadlineMs:50,startedAt:Date.now()-100,onFailureOutput:()=>{},sourceChecks:()=>{},outputDirectory:path.join(directory,'expired-setup'),spawnChild:()=>{spawned=true;throw Error('should not launch');}}),/deadline/);assert.equal(spawned,false);processCases.push('setup-already-exhausted-never-launches');
}finally{fs.rmSync(directory,{recursive:true,force:true});}
const pendingCleanupProof=await verifyBrowserExtraPendingCleanupControls(Object.fromEntries(valid.aggregate.children.map(row=>[row.laneId,row])));processCases.push(...pendingCleanupProof.processCases);
return {browserExtraAggregateControls:'PASS',synthetic:true,actualBrowser:false,applicationAssertionsExecuted:false,eligibleReceiptCreated:false,cases,processCases,socketProofs,processGroupProof,pendingCleanupProof};
}
if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url))console.log(JSON.stringify(await verifyBrowserExtraAggregateControls()));

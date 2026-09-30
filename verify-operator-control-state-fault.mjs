import {runVerifierSync,assertDetectedFault} from './verify-conformance-regressions.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const source=fs.readFileSync('app-core.js','utf8');
const anchor='if(operatorActionInFlight||historyRestoreController||restoringHistory){actionControls.set(control,disabled);control.disabled=true;}';
assert.equal(source.split(anchor).length,2,'The current control-state owner must be uniquely identified');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-control-state-fault-'));
const mutant=path.join(directory,'app-core.js');
try{
 fs.writeFileSync(mutant,source.replace(anchor,'if(operatorActionInFlight||historyRestoreController||restoringHistory){control.disabled=true;}'));
 const run=runVerifierSync(process.execPath,['verify-operator-action-lifecycle.mjs'],{encoding:'utf8',env:{...process.env,APP_SOURCE:mutant},maxBuffer:8*1024*1024});
 assertDetectedFault(run,'HISTORY_CONTROL_STATE_ORACLE: action completion restored obsolete Undo availability','Obsolete control-state restoration must fail the behavioral regression');
 assert.match(run.stderr,/HISTORY_CONTROL_STATE_ORACLE: action completion restored obsolete Undo availability/);

 const primaryFaults=[
  ['workflow-hides-current-control','nextActionMarkup(true,n)',"nextActionMarkup(displayedStageAction(n).actionType==='CONFIRM_STAGE_ONE_INTENT',n)"],
  ['duplicate-native-action',"&&!(primary.actionType==='RUN_APP_TESTS'&&primary.primaryButton)",'' ],
 ];
 const primaryResults=[];
 for(const [name,before,after]of primaryFaults){
  assert.equal(source.split(before).length,2,'Primary control fault anchor must be unique: '+name);
  fs.writeFileSync(mutant,source.replace(before,after));
  const failure=runVerifierSync(process.execPath,['verify-operator-action-lifecycle.mjs'],{encoding:'utf8',env:{...process.env,APP_SOURCE:mutant},maxBuffer:8*1024*1024});
  assertDetectedFault(failure,'PRIMARY_ACTION_ORACLE:','The production primary-action defect escaped its regression: '+name);
  assert.match(failure.stderr,/PRIMARY_ACTION_ORACLE:/,'Failure must come from the primary-action oracle, not unrelated setup');
  primaryResults.push({name,result:'PASS',mutantExitCode:failure.status});
 }
 const driver=fs.readFileSync('operator-browser-driver.mjs','utf8'),driverResults=[];
 const dispatchStart=driver.indexOf("  await cdp.send('Input.dispatchMouseEvent'"),dispatchEnd=driver.indexOf('  if(observed.closedCount===0)',dispatchStart);
 assert.ok(dispatchStart>=0&&dispatchEnd>dispatchStart,'Driver native-dispatch fault anchor is missing');
 const nativeDispatch=driver.slice(dispatchStart,dispatchEnd);
 for(const [name,before,after,oracle] of [
  ['bypassed-interactability','observed.visible&&observed.unobscured','true','DRIVER_INTERACTABILITY_ORACLE'],
  ['programmatic-click',nativeDispatch,'  await evaluate(`(()=>{${select}node.click();return true;})()`);\n','DRIVER_POINTER_AUTHORITY_ORACLE']
 ]){
  assert.equal(driver.split(before).length,2,'Driver fault anchor must be unique: '+name);
  const file=path.join(directory,'driver-'+name+'.mjs');fs.writeFileSync(file,driver.replace(before,after));
  const run=runVerifierSync(process.execPath,['verify-operator-action-lifecycle.mjs','--driver-activation-only'],{encoding:'utf8',timeout:10000,env:{...process.env,OPERATOR_DRIVER_SOURCE:file}});
  assertDetectedFault(run,oracle,'Browser driver fault must fail its intended activation invariant: '+name);
  driverResults.push({name,result:'DETECTED',oracle,evidencePath:run.evidencePath});
 }
 const restored=runVerifierSync(process.execPath,['verify-operator-action-lifecycle.mjs'],{encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(restored.status,0,restored.stderr);
 console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Node VM executes a temporary production UI implementation fault',restoredImplementation:'PASS',restoredEvidence:restored.evidencePath,cases:[{name:'Removing the current-state update restores obsolete Undo availability and is detected',result:'PASS',mutantExitCode:run.status},...primaryResults,...driverResults]},null,2));
}finally{fs.rmSync(directory,{recursive:true,force:true});}

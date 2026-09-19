import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const source=fs.readFileSync('app-core.js','utf8');
const anchor='if(operatorActionInFlight||restoringHistory){actionControls.set(control,disabled);control.disabled=true;}';
assert.equal(source.split(anchor).length,2,'The current control-state owner must be uniquely identified');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-control-state-fault-'));
const mutant=path.join(directory,'app-core.js');
try{
 fs.writeFileSync(mutant,source.replace(anchor,'if(operatorActionInFlight||restoringHistory){control.disabled=true;}'));
 const run=spawnSync(process.execPath,['verify-operator-action-lifecycle.mjs'],{encoding:'utf8',env:{...process.env,APP_SOURCE:mutant},maxBuffer:8*1024*1024});
 assert.notEqual(run.status,0,'Obsolete control-state restoration must fail the behavioral regression');
 assert.match(run.stderr,/HISTORY_CONTROL_STATE_ORACLE: action completion restored obsolete Undo availability/);

 const primaryFaults=[
  ['workflow-hides-current-control','nextActionMarkup(true,n)',"nextActionMarkup(displayedStageAction(n).actionType==='CONFIRM_STAGE_ONE_INTENT',n)"],
  ['duplicate-native-action',"&&!(primary.actionType==='RUN_APP_TESTS'&&primary.primaryButton)",'' ],
 ];
 const primaryResults=[];
 for(const [name,before,after]of primaryFaults){
  assert.equal(source.split(before).length,2,'Primary control fault anchor must be unique: '+name);
  fs.writeFileSync(mutant,source.replace(before,after));
  const failure=spawnSync(process.execPath,['verify-operator-action-lifecycle.mjs'],{encoding:'utf8',env:{...process.env,APP_SOURCE:mutant},maxBuffer:8*1024*1024});
  assert.notEqual(failure.status,0,'The production primary-action defect escaped its regression: '+name);
  assert.match(failure.stderr,/PRIMARY_ACTION_ORACLE:/,'Failure must come from the primary-action oracle, not unrelated setup');
  primaryResults.push({name,result:'PASS',mutantExitCode:failure.status});
 }
 console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Node VM executes a temporary production UI implementation fault',cases:[{name:'Removing the current-state update restores obsolete Undo availability and is detected',result:'PASS',mutantExitCode:run.status},...primaryResults]},null,2));
}finally{fs.rmSync(directory,{recursive:true,force:true});}

import os from 'node:os';import path from 'node:path';
import fs from 'node:fs';import assert from 'node:assert/strict';import {fileFirstComponentFailure,validateFileFirstComponents,isComponentInfrastructureFailure,isComponentProcessingFailure,settleFileFirstComponent,fileFirstComponentPlan,FILE_FIRST_COMPONENT_BOUNDARY} from './test-file-first-components.mjs';import {runVerifier,detectedFault} from './verify-conformance-regressions.mjs';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'file-first-component-results-'));
const oracle='CONTROLLED_COMPONENT_ORACLE';const base={outcome:'FAIL',status:1,error:null,signal:null,reason:null,stderr:'AssertionError [ERR_ASSERTION]: '+oracle};const cases=[];
for(const [name,changes,expected] of [['assertion',{},true],['error',{stderr:'Error: '+oracle},true],['type-error',{stderr:'TypeError: '+oracle},false],['reference-error',{stderr:'ReferenceError: '+oracle},false],['timeout',{outcome:'TIMEOUT',reason:'TIMEOUT'},false],['signal',{signal:'SIGTERM'},false],['execution-error',{error:{code:'EFAIL'}},false],['wrong-exit',{status:2},false]]){
 const r={...base,...changes},error=fileFirstComponentFailure(r);const observed=detectedFault({status:1,stderr:error.stack,outcome:'FAIL'},oracle);assert.equal(observed,expected,name);cases.push({name,expected,observed});
}
const actual=await runVerifier(process.execPath,['--input-type=module','-e',"console.error('AssertionError [ERR_ASSERTION]: CONTROLLED_COMPONENT_ORACLE');setInterval(()=>{},1000)"],{timeout:300,evidenceDirectory:path.join(directory,'children')});assert.equal(actual.outcome,'TIMEOUT');assert.equal(detectedFault({status:1,outcome:'FAIL',stderr:fileFirstComponentFailure(actual).stack},oracle),false);cases.push({name:'actual-timeout-after-oracle',outcome:actual.outcome,expected:false,observed:false,evidencePath:actual.evidencePath});

const pass={outcome:'PASS',status:0,stderr:''};
for(const bad of [{...base,outcome:'TIMEOUT',reason:'TIMEOUT'},{...base,stderr:'TypeError: '+oracle},{...base,reportError:'bad report'}]){
 let caught;try{validateFileFirstComponents([base,pass,pass,bad]);}catch(error){caught=error;}
 assert(caught);assert.equal(detectedFault({status:1,outcome:'FAIL',stderr:caught.stack},oracle),false);
}

// An intended assertion cannot hide infrastructure failure in any sibling
// position, including a failure reported after the intended assertion.
const infrastructureFailures=[{...base,outcome:'TIMEOUT',reason:'TIMEOUT'},{...base,signal:'SIGTERM'},{...base,error:{code:'EFAIL'}},{...base,status:2},{...base,stderr:'ReferenceError: '+oracle},{...base,reportError:'bad report'}];
for(let assertionIndex=0;assertionIndex<4;assertionIndex++)for(let infrastructureIndex=0;infrastructureIndex<4;infrastructureIndex++)if(assertionIndex!==infrastructureIndex)for(const bad of infrastructureFailures){
 const results=Array.from({length:4},()=>pass);results[assertionIndex]=base;results[infrastructureIndex]=bad;
 let caught;try{validateFileFirstComponents(results);}catch(error){caught=error;}
 assert.equal(caught?.name,'VerifierInfrastructureError','FILE_FIRST_SIBLING_INFRASTRUCTURE_PRECEDENCE_ORACLE');
 assert.equal(detectedFault({status:1,outcome:'FAIL',stderr:caught.stack},oracle),false);
}

const policyNames=['creation-fault-matrix','io-fault-matrix','acceptance-fault-matrix'],originalArgs=['--fault=selected-operation','--retained-argument=value'];
const originalCommands=[['verify-file-first-operator.mjs',...originalArgs,'--file-first-component=core'],['verify-file-first-operator.mjs',...originalArgs,'--file-first-component=recovery'],['verify-operator-action-lifecycle.mjs',...originalArgs,'--file-first-lifecycle-two-workers'],['verify-handoff-authorization-ui.mjs',...originalArgs]];
const defaultPlan=fileFirstComponentPlan(originalArgs),ingestionPlan=fileFirstComponentPlan(originalArgs,{ingestion:true});
assert.equal(defaultPlan.workers,4);assert.equal(defaultPlan.exclusiveLifecycle,false);
assert.deepEqual(defaultPlan.commands.map(row=>row.args),originalCommands,'FILE_FIRST_DEFAULT_COMMANDS_ORACLE');
assert.deepEqual(defaultPlan.commands.map(row=>row.timeoutMs),[30000,30000,30000,30000],'FILE_FIRST_DEFAULT_WATCHDOG_ORACLE');
assert.equal(ingestionPlan.workers,2);assert.equal(ingestionPlan.exclusiveLifecycle,true);
assert.deepEqual(ingestionPlan.commands.map(row=>row.args),originalCommands.map((args,index)=>index===2?args.slice(0,-1):args),'FILE_FIRST_INGESTION_COMMANDS_ORACLE');
assert.deepEqual(ingestionPlan.commands.map(row=>row.timeoutMs),[30000,30000,30000,30000],'FILE_FIRST_INGESTION_WATCHDOG_ORACLE');
for(const policy of policyNames){
 const selector='--file-first-policy='+policy,plan=fileFirstComponentPlan([...originalArgs,selector]);
 assert.equal(plan.policy,policy);assert.equal(plan.workers,1);assert.equal(plan.exclusiveLifecycle,false);
 assert.deepEqual(plan.commands.map(row=>row.args),originalCommands,'FILE_FIRST_MATRIX_COMMANDS_ORACLE');
 assert.deepEqual(plan.commands.map(row=>row.timeoutMs),[30000,120000,120000,30000],'FILE_FIRST_MATRIX_WATCHDOG_ORACLE');
 assert.ok(plan.commands.reduce((sum,row)=>sum+row.timeoutMs+5000,0)<(policy==='acceptance-fault-matrix'?20:10)*60*1000,'FILE_FIRST_MATRIX_OWNER_BUDGET_ORACLE');
 assert.throws(()=>fileFirstComponentPlan([selector],{ingestion:true}),/FILE_FIRST_COMPONENT_POLICY_SCOPE_ORACLE/);
 assert.throws(()=>fileFirstComponentPlan([selector,'--file-first-component=core']),/FILE_FIRST_COMPONENT_POLICY_SCOPE_ORACLE/);
 for(const other of policyNames)assert.throws(()=>fileFirstComponentPlan([selector,'--file-first-policy='+other]),/FILE_FIRST_COMPONENT_POLICY_CONFLICT_ORACLE/);
}
for(const selector of ['--file-first-policy','--file-first-policy=','--file-first-policy=default','--file-first-policy=ingestion','--file-first-policy=unknown','--file-first-policy-extra=creation-fault-matrix'])assert.throws(()=>fileFirstComponentPlan([selector]),/FILE_FIRST_COMPONENT_POLICY_ARGUMENT_ORACLE/);

// Execute the real scheduler with disposable supervisor stand-ins. No owning
// product tests are replaced: this isolates ordering, caps, and settlement.
const helperSource=fs.readFileSync(new URL('./test-file-first-components.mjs',import.meta.url),'utf8'),importAnchor="from './verify-conformance-regressions.mjs'";
assert.equal(helperSource.split(importAnchor).length-1,1,'FILE_FIRST_SCHEDULER_FIXTURE_ANCHOR_ORACLE');
fs.writeFileSync(path.join(directory,'scheduler-helper.mjs'),helperSource.replace(importAnchor,"from './scheduler-supervisor.mjs'"));
fs.writeFileSync(path.join(directory,'scheduler-supervisor.mjs'),`
export const trace={events:[],active:0,maxActive:0,settled:0};
export async function runVerifier(command,args,options){
 const index=args.includes('--file-first-component=core')?0:args.includes('--file-first-component=recovery')?1:args[0]==='verify-operator-action-lifecycle.mjs'?2:3;
 trace.events.push({phase:'START',index,args,timeoutMs:options.timeout});trace.maxActive=Math.max(trace.maxActive,++trace.active);
 try{
  await new Promise(resolve=>setTimeout(resolve,10));
  if(process.env.COMPONENT_SCENARIO==='rejected'&&index===2)throw new Error('controlled supervisor rejection');
  if(process.env.COMPONENT_SCENARIO!=='healthy'&&index===0)return ${JSON.stringify(base)};
  if(process.env.COMPONENT_SCENARIO==='timeout'&&index===2)return ${JSON.stringify({...base,outcome:'TIMEOUT',reason:'TIMEOUT'})};
  return {outcome:'PASS',status:0,stderr:'',stdout:index===0?'CORE-HEAD'+${JSON.stringify(FILE_FIRST_COMPONENT_BOUNDARY)}+'CORE-TAIL':['','RECOVERY','LIFECYCLE','HANDOFF'][index]};
 }finally{trace.active--;trace.settled++;trace.events.push({phase:'FINISH',index});}
}
`);
const schedulerScript=path.join(directory,'scheduler-check.mjs');
fs.writeFileSync(schedulerScript,`import {runFileFirstComponents,runIngestionFileFirstComponents} from './scheduler-helper.mjs';import {trace} from './scheduler-supervisor.mjs';let failure=null;try{await (process.env.COMPONENT_INGESTION==='1'?runIngestionFileFirstComponents:runFileFirstComponents)(JSON.parse(process.env.COMPONENT_ARGS));}catch(error){failure={name:error.name,message:error.message};}console.log('\\n__SCHEDULER_REPORT__'+JSON.stringify({trace,failure}));`);
const scheduling=[];
for(const policy of ['default','ingestion',...policyNames])for(const scenario of ['healthy','timeout','rejected']){
 const args=[...originalArgs,...(policyNames.includes(policy)?['--file-first-policy='+policy]:[])];
 const observed=await runVerifier(process.execPath,[schedulerScript],{timeout:5000,evidenceDirectory:path.join(directory,'scheduling'),env:{COMPONENT_ARGS:JSON.stringify(args),COMPONENT_SCENARIO:scenario,COMPONENT_INGESTION:policy==='ingestion'?'1':'0'}});
 assert.equal(observed.outcome,'PASS',observed.stderr);
 const [output,encoded]=observed.stdout.split('\n__SCHEDULER_REPORT__'),report=JSON.parse(encoded),plan=fileFirstComponentPlan(args,{ingestion:policy==='ingestion'});
 assert.equal(report.trace.maxActive,plan.workers,'FILE_FIRST_SCHEDULER_CONCURRENCY_ORACLE');assert.equal(report.trace.active,0);assert.equal(report.trace.settled,4,'FILE_FIRST_SCHEDULER_SETTLEMENT_ORACLE');
 const starts=report.trace.events.filter(row=>row.phase==='START');
 assert.deepEqual(starts.map(row=>row.index),policy==='ingestion'?[0,3,1,2]:[0,1,2,3],'FILE_FIRST_SCHEDULER_ORDER_ORACLE');
 for(const row of starts){assert.deepEqual(row.args,plan.commands[row.index].args);assert.equal(row.timeoutMs,plan.commands[row.index].timeoutMs,'FILE_FIRST_SCHEDULER_WATCHDOG_ORACLE');}
 if(scenario==='healthy'){assert.equal(report.failure,null);assert.equal(output,'CORE-HEADLIFECYCLEHANDOFFCORE-TAILRECOVERY','FILE_FIRST_SCHEDULER_OUTPUT_ORDER_ORACLE');}
 else{assert.equal(report.failure?.name,'VerifierInfrastructureError','FILE_FIRST_SCHEDULER_INFRASTRUCTURE_ORACLE');assert.equal(detectedFault({status:1,outcome:'FAIL',stderr:report.failure.name+': '+report.failure.message},oracle),false);}
 scheduling.push({policy,scenario,maxActive:report.trace.maxActive,settled:report.trace.settled,result:'PASS'});
}


assert.equal(isComponentInfrastructureFailure(pass),false);
assert.equal(isComponentInfrastructureFailure(base),false);
for(const bad of [{...base,outcome:'TIMEOUT',reason:'TIMEOUT'},{...base,stderr:'TypeError: '+oracle},{...base,reportError:'invalid JSON'}])assert.equal(isComponentInfrastructureFailure(bad),true);
const invalidDirectory=path.join(directory,'not-a-directory');fs.writeFileSync(invalidDirectory,'controlled evidence path failure');
let supervisionError;try{await runVerifier(process.execPath,['-e',"throw new Error('must not launch')"],{timeout:300,evidenceDirectory:invalidDirectory});}catch(error){supervisionError=error;}
assert(supervisionError);assert.equal(supervisionError.name,'Error');assert.equal(isComponentProcessingFailure(supervisionError,undefined),true);
assert.equal(isComponentProcessingFailure(new assert.AssertionError({message:oracle}),base),false);
const rejectedComponent=await settleFileFirstComponent(Promise.reject(supervisionError));
assert.equal(isComponentInfrastructureFailure(rejectedComponent),true);
assert.equal(detectedFault({status:1,outcome:'FAIL',stderr:fileFirstComponentFailure(rejectedComponent).stack},oracle),false);
const nested=fileFirstComponentFailure({...base,outcome:'TIMEOUT',reason:'TIMEOUT'});
let nestedCaught;try{validateFileFirstComponents([base,pass,pass,{outcome:'FAIL',status:1,stderr:nested.stack}]);}catch(error){nestedCaught=error;}
assert(nestedCaught);assert.equal(detectedFault({status:1,outcome:'FAIL',stderr:nestedCaught.stack},oracle),false);
fs.writeFileSync(path.join(directory,'proof.json'),JSON.stringify({outcome:'PASS',cases,scheduling,siblingInfrastructureDominates:true,nestedInfrastructureDominates:true,actualSupervisorRejectionClassified:true,nestedSupervisorRejectionSettled:true},null,2));

console.log(fs.readFileSync(path.join(directory,'proof.json'),'utf8'));

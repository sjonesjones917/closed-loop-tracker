import assert from 'node:assert/strict';
import {runVerifier} from './verify-conformance-regressions.mjs';
export class VerifierInfrastructureError extends Error{constructor(message){super(message);this.name='VerifierInfrastructureError';}}
export const FILE_FIRST_COMPONENT_BOUNDARY='\n__CLOSED_LOOP_FILE_FIRST_COMPONENT_BOUNDARY__\n';
// These are verifier-process watchdogs, not product I/O or UI deadlines. Keep
// the default and ingestion routes unchanged. Each fault matrix opts in by
// name; its serial component allocation is 300s, plus at most four existing
// 5s cleanup graces, inside its own independently bounded coordinator.
const matrixComponentTimeouts=Object.freeze([30000,120000,120000,30000]);
const componentPolicies=Object.freeze({
 default:Object.freeze({workers:4,exclusiveLifecycle:false,timeouts:Object.freeze([30000,30000,30000,30000])}),
 ingestion:Object.freeze({workers:2,exclusiveLifecycle:true,timeouts:Object.freeze([30000,30000,30000,30000])}),
 'creation-fault-matrix':Object.freeze({workers:1,exclusiveLifecycle:false,timeouts:matrixComponentTimeouts}),
 'io-fault-matrix':Object.freeze({workers:1,exclusiveLifecycle:false,timeouts:matrixComponentTimeouts}),
 'acceptance-fault-matrix':Object.freeze({workers:1,exclusiveLifecycle:false,timeouts:matrixComponentTimeouts})
});
export function fileFirstComponentPlan(args,{ingestion=false}={}){
 const selectors=args.filter(argument=>argument.startsWith('--file-first-policy'));
 assert.ok(selectors.length<=1,'FILE_FIRST_COMPONENT_POLICY_CONFLICT_ORACLE');
 const selector=selectors[0],name=selector?.slice('--file-first-policy='.length);
 assert.ok(!selector||selector==='--file-first-policy='+name&&['creation-fault-matrix','io-fault-matrix','acceptance-fault-matrix'].includes(name),'FILE_FIRST_COMPONENT_POLICY_ARGUMENT_ORACLE');
 assert.ok(!selector||!ingestion&&!args.some(argument=>argument.startsWith('--file-first-component=')),'FILE_FIRST_COMPONENT_POLICY_SCOPE_ORACLE');
 const policyName=ingestion?'ingestion':name||'default',policy=componentPolicies[policyName],forwarded=args.filter(argument=>argument!==selector);
 return {policy:policyName,workers:policy.workers,exclusiveLifecycle:policy.exclusiveLifecycle,commands:[
  ['verify-file-first-operator.mjs',...forwarded,'--file-first-component=core'],
  ['verify-file-first-operator.mjs',...forwarded,'--file-first-component=recovery'],
  ['verify-operator-action-lifecycle.mjs',...forwarded,...(policy.exclusiveLifecycle?[]:['--file-first-lifecycle-two-workers'])],
  ['verify-handoff-authorization-ui.mjs',...forwarded]
 ].map((args,index)=>({args,timeoutMs:policy.timeouts[index]}))};
}
export function runFileFirstComponents(args){return runComponents(fileFirstComponentPlan(args));}
export function runIngestionFileFirstComponents(args){return runComponents(fileFirstComponentPlan(args,{ingestion:true}));}
async function runComponents({commands,workers,exclusiveLifecycle}){
 const controller=new AbortController(),onTerm=()=>controller.abort('SIGTERM'),onInt=()=>controller.abort('SIGINT');
 process.on('SIGTERM',onTerm);process.on('SIGINT',onInt);
 let settled;
 try{
  const execute=command=>{if(controller.signal.aborted)throw new VerifierInfrastructureError('FILE_FIRST_COMPONENT_CANCELLED');return runVerifier(process.execPath,command.args,{timeout:command.timeoutMs,maxBuffer:16*1024*1024,signal:controller.signal});};
  const indices=exclusiveLifecycle?[0,3]:[0,1,2,3];
  settled=new Array(commands.length);let next=0;
  const settle=async index=>{
   try{settled[index]={status:'fulfilled',value:await execute(commands[index])};}
   catch(reason){settled[index]={status:'rejected',reason};}
  };
  await Promise.all(Array.from({length:workers},async()=>{
   for(;;){
    const position=next++;if(position>=indices.length)return;
    await settle(indices[position]);
   }
  }));
  if(exclusiveLifecycle){await settle(1);await settle(2);}
 }
 finally{process.removeListener('SIGTERM',onTerm);process.removeListener('SIGINT',onInt);}
 // Every component and its owned descendants must settle before any failure escapes.
 for(const item of settled)if(item.status==='rejected')throw new VerifierInfrastructureError('FILE_FIRST_COMPONENT_SUPERVISOR_REJECTED');
 const [core,recovery,lifecycle,handoff]=settled.map(item=>item.value);
 for(const result of [core,lifecycle,handoff,recovery]){
  if(result.stderr)process.stderr.write(result.stderr);

 }
 validateFileFirstComponents([core,lifecycle,handoff,recovery],{cancelled:controller.signal.aborted});
 const pieces=core.stdout.split(FILE_FIRST_COMPONENT_BOUNDARY);
 assert.equal(pieces.length,2,'FILE_FIRST_COMPONENT_OUTPUT_BOUNDARY_ORACLE');
 process.stdout.write(pieces[0]);process.stdout.write(lifecycle.stdout);process.stdout.write(handoff.stdout);process.stdout.write(pieces[1]);process.stdout.write(recovery.stdout);
}

export function eligibleAssertion(result){
 const terminal=[...(result.stderr||'').matchAll(/^([A-Za-z_$][\w$.]*Error|Error)(?: \[[^\]\n]+\])?: ([^\n]*)/gm)].at(-1);
 return result.outcome==='FAIL'&&result.status===1&&!result.error&&!result.signal&&!result.reason&&!result.reportError&&['Error','AssertionError'].includes(terminal?.[1]);
}

export function isComponentInfrastructureFailure(result){
 return !(result.outcome==='PASS'&&result.status===0&&!result.error&&!result.signal&&!result.reason&&!result.reportError)&&!eligibleAssertion(result);
}

export async function settleFileFirstComponent(promise){
 try{return await promise;}catch(error){return {outcome:'FAIL',status:null,error:{message:String(error)},stderr:String(error.stack||error)};}
}

export function isComponentProcessingFailure(error,result){
 return Boolean(error&&(!result||!['Error','AssertionError'].includes(error.name)));
}

export function validateFileFirstComponents(results,{cancelled=false}={}){
 if(cancelled)throw new VerifierInfrastructureError('FILE_FIRST_COMPONENT_CANCELLED');
 assert.equal(results.length,4,'FILE_FIRST_COMPONENT_COUNT');
 const failures=results.filter(result=>result.outcome!=='PASS'||result.status!==0||result.error||result.signal||result.reason||result.reportError);
 const failure=failures.find(result=>!eligibleAssertion(result))||failures[0];
 if(failure)throw fileFirstComponentFailure(failure);
}

export function fileFirstComponentFailure(result){
 const terminal=[...(result.stderr||'').matchAll(/^([A-Za-z_$][\w$.]*Error|Error)(?: \[[^\]\n]+\])?: ([^\n]*)/gm)].at(-1);
 const eligible=eligibleAssertion(result);
 // Raw streams remain in child evidence. Only a clean assertion failure may
 // carry an oracle into the outer terminal diagnostic; infrastructure may not.
 return new (eligible?Error:VerifierInfrastructureError)('FILE_FIRST_COMPONENT_FAILED: '+JSON.stringify({outcome:result.outcome,status:result.status,eligibleAssertion:eligible,...(eligible?{diagnostic:terminal[2]}:{diagnostic:'Component did not complete with an eligible assertion'})}));
}

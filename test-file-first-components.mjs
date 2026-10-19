import assert from 'node:assert/strict';
import {runVerifier} from './verify-conformance-regressions.mjs';
export class VerifierInfrastructureError extends Error{constructor(message){super(message);this.name='VerifierInfrastructureError';}}
export const FILE_FIRST_COMPONENT_BOUNDARY='\n__CLOSED_LOOP_FILE_FIRST_COMPONENT_BOUNDARY__\n';
// The standalone I/O owner retains four simultaneous components under its
// existing 30-second coordinator deadline. Ingestion has its own outer budget
// and uses two owners at a time, with lifecycle exclusive because it owns its
// own concurrent controls. Every launched child retains its 30-second cap.
export function runFileFirstComponents(args){return runComponents(args,4);}
export function runIngestionFileFirstComponents(args){return runComponents(args,2,{exclusiveLifecycle:true});}
async function runComponents(args,workers,{exclusiveLifecycle=false}={}){
 const controller=new AbortController(),onTerm=()=>controller.abort('SIGTERM'),onInt=()=>controller.abort('SIGINT');
 process.on('SIGTERM',onTerm);process.on('SIGINT',onInt);
 const commands=[
  ['verify-file-first-operator.mjs',...args,'--file-first-component=core'],
  ['verify-file-first-operator.mjs',...args,'--file-first-component=recovery'],
  ['verify-operator-action-lifecycle.mjs',...args,'--file-first-lifecycle-two-workers'],
  ['verify-handoff-authorization-ui.mjs',...args]
 ];
 let settled;
 try{
  const execute=command=>{if(controller.signal.aborted)throw new VerifierInfrastructureError('FILE_FIRST_COMPONENT_CANCELLED');return runVerifier(process.execPath,command,{timeout:30000,maxBuffer:16*1024*1024,signal:controller.signal});};
  const indices=exclusiveLifecycle?[0,1,3]:[0,1,2,3];
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
  if(exclusiveLifecycle)await settle(2);
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

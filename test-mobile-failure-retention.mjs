import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createVerifierRuntime} from './verifier-runtime.mjs';

export async function verifyMobileFailureRetention(){
// Synthetic failure-path controls execute the current evidence writer and
// catch/finally bodies unchanged. Browser calls are controlled inputs; real
// temporary files prove custody before a diagnostic promise can settle.
const mobileFailureSource=fs.readFileSync(new URL('./verify-mobile-capability-journey.mjs',import.meta.url),'utf8');
const mobileWriter=mobileFailureSource.match(/^const writeCapabilityEvidence=.*;$/m)?.[0];
const mobileCatch=mobileFailureSource.slice(mobileFailureSource.indexOf('}catch(error){'),mobileFailureSource.indexOf('\nconsole.log(JSON.stringify({mobileCapabilityJourney:'));
assert.ok(mobileWriter&&mobileCatch.startsWith('}catch(error){')&&mobileCatch.includes('await browser.close();'),'MOBILE_FAILURE_SOURCE_BODY_ORACLE');
const mobileFailureCases=[],mobileFailureRoot=fs.mkdtempSync(path.join(os.tmpdir(),'clrt-mobile-failure-'));
const originalMobileCatch="}catch(error){cases.push({name:'journey failure',result:'FAIL',message:error.stack,visibleState:await browser.evaluate(`document.querySelector('#mobile-acceptance-panel')?.innerText||document.body.innerText`)});try{await browser.inspect(30);}catch{}console.error(error);process.exitCode=1;}\nfinally{fs.writeFileSync(path.join(directory,'capability.json'),JSON.stringify({browserExecution,inboundArchiveJourney,intakeCapacityJourney,complete,basis:'ACTUAL_CHROMIUM_FILE_TRANSPORT',physicalIPhoneAcceptance:false,cases,events:browser.events},null,2)+'\\n');await browser.close();}";
async function mobileFailureControl(name,{body=mobileCatch,evaluateError=false,inspectError=false,pendingEvaluate=false,pendingInspect=false,writeError=false,closeError=false,former=false}={}){
 const directory=path.join(mobileFailureRoot,name);fs.mkdirSync(directory);
 const primary=Object.assign(new Error('original native action failed'),{name:'OriginalActionError',stack:'OriginalActionError: original native action failed\n    at actual-action-boundary'});
 const diagnostic=new Error('secondary diagnostic failed'),cleanup=new Error('controlled close failure'),writeFailure=new Error('controlled evidence write failure');
 const processState={},logged=[],rows=[],events=[{operation:'synthetic-prior-operation'}];let closed=false,releaseEvaluate,releaseInspect,inspectEntered;
 const evaluateGate=new Promise(resolve=>{releaseEvaluate=resolve;}),inspectGate=new Promise(resolve=>{releaseInspect=resolve;}),inspectStarted=new Promise(resolve=>{inspectEntered=resolve;});
 const evidenceFile=path.join(directory,'capability.json'),read=()=>JSON.parse(fs.readFileSync(evidenceFile,'utf8'));
 const seed={fs:writeError?{writeFileSync(){throw writeFailure;}}:fs,path,directory,process:processState,console:{error:value=>logged.push(value)},cases:rows,primary,
  browser:{events,evaluate:async()=>{if(pendingEvaluate)await evaluateGate;if(evaluateError)throw diagnostic;return 'retained visible state';},inspect:async()=>{inspectEntered();if(pendingInspect)await inspectGate;if(inspectError)throw diagnostic;},close:async()=>{closed=true;if(closeError)throw cleanup;}}};
 const context=createVerifierRuntime(seed);
 const code=`(async()=>{let browserExecution,inboundArchiveJourney,intakeCapacityJourney,complete=false;\n${mobileWriter}\ntry{throw primary;${body}\n})()`;
 const completion=createVerifierRuntime.loadScript(context,code,{filename:'controlled-current-mobile-failure-body'});
 // Attach a rejection observer immediately, including deliberately failing
 // write/close controls, so no host unhandled-rejection can mask this oracle.
 const settled=completion.then(()=>({ok:true}),error=>({ok:false,error}));
 try{
  if(pendingEvaluate){
   assert.equal(fs.existsSync(evidenceFile),!former,'MOBILE_FAILURE_DURABLE_BEFORE_DIAGNOSTIC_ORACLE');
   if(!former){const before=read();assert.equal(before.complete,false);assert.equal(before.cases.length,1);assert.equal(before.cases[0].primaryError.stack,primary.stack);assert.equal(processState.exitCode,1);assert.equal(logged[0],primary);assert.equal(closed,false);}
   releaseEvaluate();
  }
  if(pendingInspect){await inspectStarted;const before=read();assert.equal(before.complete,false);assert.equal(before.cases[0].primaryError.stack,primary.stack);assert.equal(before.cases[0].visibleState,'retained visible state');assert.equal(processState.exitCode,1);assert.equal(closed,false);releaseInspect();}
  const result=await settled;assert.equal(result.ok,!writeError&&!closeError,'MOBILE_FAILURE_CONTROL_COMPLETION_ORACLE');
  if(writeError)assert.equal(result.error,writeFailure);if(closeError)assert.equal(result.error,cleanup);
  assert.equal(closed,true,'MOBILE_FAILURE_OWNED_CLOSE_ORACLE');assert.equal(processState.exitCode,1);assert.equal(logged[0],primary);
  if(!writeError){const proof=read();assert.equal(proof.complete,false);assert.equal(proof.physicalIPhoneAcceptance,false);assert.deepEqual(proof.events,events);assert.equal(proof.cases.length,1);assert.equal(proof.cases[0].result,'FAIL');assert.equal(proof.cases[0].message,primary.stack);
   if(!former){assert.deepEqual(proof.cases[0].primaryError,{name:primary.name,message:primary.message,stack:primary.stack});assert.deepEqual(proof.cases[0].diagnosticErrors.map(row=>row.operation),[...(evaluateError?['visible-state']:[]),...(inspectError?['inspect']:[])]);for(const secondary of proof.cases[0].diagnosticErrors)assert.equal(secondary.message,diagnostic.message);if(!evaluateError)assert.equal(proof.cases[0].visibleState,'retained visible state');}
  }
  mobileFailureCases.push({name,result:former?'FORMER_DURABILITY_GAP_OBSERVED':'PASS'});
 }finally{releaseEvaluate();releaseInspect();await settled;}
}
try{
 await mobileFailureControl('original-failure-with-successful-diagnostics');
 await mobileFailureControl('secondary-visible-state-failure',{evaluateError:true});
 await mobileFailureControl('secondary-inspection-failure',{inspectError:true});
 await mobileFailureControl('both-secondary-failures-retain-primary',{evaluateError:true,inspectError:true});
 await mobileFailureControl('durable-before-pending-visible-state',{pendingEvaluate:true});
 await mobileFailureControl('durable-before-pending-inspection',{pendingInspect:true});
 await mobileFailureControl('failed-evidence-write-still-closes',{writeError:true});
 await mobileFailureControl('failed-close-keeps-durable-primary',{closeError:true});
 await mobileFailureControl('former-await-before-recording-loses-durability',{body:originalMobileCatch,pendingEvaluate:true,former:true});
 const withoutEarlyWrite=mobileCatch.replace('  writeCapabilityEvidence();\n  try{failure.visibleState=', '  try{failure.visibleState=');assert.notEqual(withoutEarlyWrite,mobileCatch);
 await assert.rejects(()=>mobileFailureControl('missing-early-write-mutant',{body:withoutEarlyWrite,pendingEvaluate:true}),/MOBILE_FAILURE_DURABLE_BEFORE_DIAGNOSTIC_ORACLE/);
 mobileFailureCases.push({name:'missing-early-write-mutant',result:'DETECTED'});
}finally{fs.rmSync(mobileFailureRoot,{recursive:true,force:true});}
return {mobileFailureRetention:'PASS',synthetic:true,actualBrowser:false,sourceBodyExecutedUnchanged:true,sourceMutationControlsExplicit:true,cases:mobileFailureCases};
}

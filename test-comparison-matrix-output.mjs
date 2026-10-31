import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {runVerifier} from './verify-conformance-regressions.mjs';

// Real piped stdout and the actual matrix-only termination branch. The matrix
// body is a large explicit fixture, not a production comparison or a receipt.
export async function verifyComparisonMatrixOutput({sourceOverride=null}={}){
 const source=sourceOverride??fs.readFileSync(new URL('./verify-cross-run-comparison.mjs',import.meta.url),'utf8');
 const branches=source.split('\n').filter(line=>line.startsWith(' if(comparisonMatrixOnly){'));
 assert.equal(branches.length,1,'COMPARISON_MATRIX_OUTPUT_BRANCH_ORACLE');
 const payload={fixture:'matrix-output-drain-only',payload:'X'.repeat(262144)},boundary={comparisonFaultMatrixOnly:true,fullComparisonProducer:false,packageJourneyExecuted:false,freshPrerequisiteVariants:8,scope:'All 36 injected faults and nine restored owners only; default package, recovery, and Stage19 producers remain separately required.'};
 const expected=JSON.stringify(payload)+'\n'+JSON.stringify(boundary)+'\n',directory=fs.mkdtempSync(path.join(os.tmpdir(),'comparison-output-drain-'));
 try{
  const script=path.join(directory,'actual-matrix-termination.mjs');
  fs.writeFileSync(script,"const comparisonMatrixOnly=true;\nawait new Promise((resolve,reject)=>process.send('ready',error=>error?reject(error):resolve()));\nconsole.log("+JSON.stringify(JSON.stringify(payload))+');\n'+branches[0]+"\nthrow new Error('COMPARISON_MATRIX_OUTPUT_FALLTHROUGH_ORACLE');\n");
  // Hold the actual stdout pipe until the child exits or the bounded reader
  // release fires. An eager reader can make immediate exit accidentally pass.
  const relay=path.join(directory,'slow-reader.mjs'),observation=path.join(directory,'reader-observation.json');
  fs.writeFileSync(relay,`import fs from 'node:fs';
import {spawn} from 'node:child_process';
const child=spawn(process.execPath,[process.argv[2]],{stdio:['ignore','pipe','pipe','ipc']}),out=[],err=[];
let timer=null,released=false,releaseReason=null,total=0,relayError=null;
const release=reason=>{if(released)return;if(timer)clearTimeout(timer);released=true;releaseReason=reason;child.stdout.resume();};
const collect=(chunks,chunk)=>{total+=chunk.length;if(total>1024*1024){relayError=new Error('COMPARISON_OUTPUT_RELAY_LIMIT');child.kill('SIGTERM');release('limit');return;}chunks.push(chunk);};
child.stdout.on('data',chunk=>collect(out,chunk));child.stdout.pause();child.stderr.on('data',chunk=>collect(err,chunk));
child.on('message',message=>{if(message==='ready'&&!released&&timer===null)timer=setTimeout(()=>release('timer'),250);});
child.on('exit',()=>release('exit'));
const outcome=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});
release('closed');
fs.writeFileSync(process.argv[3],JSON.stringify({releaseReason,stdoutBytes:out.reduce((sum,chunk)=>sum+chunk.length,0)}));
if(relayError)throw relayError;
const write=(stream,bytes)=>new Promise((resolve,reject)=>stream.write(bytes,error=>error?reject(error):resolve()));
await Promise.all([write(process.stdout,Buffer.concat(out)),write(process.stderr,Buffer.concat(err))]);
if(outcome.signal)throw new Error('COMPARISON_OUTPUT_CHILD_SIGNAL:'+outcome.signal);
process.exitCode=outcome.code??1;
`);
  const child=await runVerifier(process.execPath,[relay,script,observation],{timeout:30000,maxBuffer:1024*1024,evidenceDirectory:path.join(directory,'runner')});
  assert.equal(child.status,0,'COMPARISON_MATRIX_OUTPUT_EXIT_ORACLE');assert.equal(child.signal,null,'COMPARISON_MATRIX_OUTPUT_SIGNAL_ORACLE');assert(!child.error,'COMPARISON_MATRIX_OUTPUT_EXECUTION_ORACLE');
  assert.equal(child.stderr,'','COMPARISON_MATRIX_OUTPUT_FALLTHROUGH_ORACLE');
  assert.equal(child.stdout,expected,'COMPARISON_MATRIX_OUTPUT_COMPLETENESS_ORACLE');
  const observed=JSON.parse(fs.readFileSync(observation,'utf8'));assert.equal(observed.releaseReason,'timer','COMPARISON_MATRIX_OUTPUT_BACKPRESSURE_ORACLE');assert.equal(observed.stdoutBytes,Buffer.byteLength(expected),'COMPARISON_MATRIX_OUTPUT_CAPTURE_ORACLE');
  const reports=child.stdout.trimEnd().split('\n').map(JSON.parse);assert.equal(reports.length,2,'COMPARISON_MATRIX_OUTPUT_REPORT_COUNT_ORACLE');assert.deepEqual(reports[0],payload);assert.deepEqual(reports[1],boundary);
  return {matrixOutputDrain:true,result:'PASS',fixtureBytes:262144,stdoutBytes:Buffer.byteLength(child.stdout),stdoutSha256:createHash('sha256').update(child.stdout).digest('hex'),reportCount:2,bodyComplete:true,boundaryComplete:true,noFallthrough:true,childExitCode:0,synthetic:true,actualComparisonExecuted:false,ownerSha256:createHash('sha256').update(source).digest('hex')};
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}

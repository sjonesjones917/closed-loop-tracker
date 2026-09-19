import fs from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
const {createVerifierRuntime}=await import(process.env.VERIFIER_RUNTIME_SOURCE?pathToFileURL(path.resolve(process.env.VERIFIER_RUNTIME_SOURCE)).href:'./verifier-runtime.mjs');

const context=createVerifierRuntime();
const required={
  timers:['setTimeout','clearTimeout','setInterval','clearInterval','queueMicrotask'],
  animation:['requestAnimationFrame','cancelAnimationFrame'],
  cancellation:['AbortController','AbortSignal'],
  bytes:['Blob','File','TextEncoder','TextDecoder','URL','URLSearchParams'],
  platform:['crypto','structuredClone','performance'],
  hash:['closedLoopHash'],
  storage:['localStorage','sessionStorage']
};
for(const [group,names] of Object.entries(required))for(const name of names){
  const value=context[name];
  assert.notEqual(value,undefined,`VERIFIER_RUNTIME_${group.toUpperCase()}_${name.toUpperCase()}_ORACLE`);
}
assert.equal(typeof context.navigator?.storage?.persist,'function','VERIFIER_RUNTIME_STORAGE_PERSIST_ORACLE');
assert.equal(typeof context.navigator?.storage?.estimate,'function','VERIFIER_RUNTIME_STORAGE_ESTIMATE_ORACLE');

let frameRan=false;
const frame=context.requestAnimationFrame(()=>{frameRan=true;});
await new Promise(resolve=>setTimeout(resolve,5));
assert.equal(frameRan,true,'VERIFIER_RUNTIME_RAF_EXECUTION_ORACLE');
context.cancelAnimationFrame(frame);

context.localStorage.setItem('key','value');
assert.equal(context.localStorage.getItem('key'),'value','VERIFIER_RUNTIME_LOCAL_STORAGE_ORACLE');
context.sessionStorage.setItem('session','value');
assert.equal(context.sessionStorage.getItem('session'),'value','VERIFIER_RUNTIME_SESSION_STORAGE_ORACLE');

const hashSource=fs.readFileSync('hash.js','utf8');
createVerifierRuntime.loadScript(context,hashSource,{filename:'hash.js'});
assert.equal(typeof context.closedLoopHash?.sha256Value,'function','VERIFIER_RUNTIME_HASH_ORACLE');
assert.equal(context.closedLoopHash.sha256Value(createVerifierRuntime.loadScript(context,'({b:2,a:1})')),context.closedLoopHash.sha256Value(createVerifierRuntime.loadScript(context,'({a:1,b:2})')),'VERIFIER_RUNTIME_HASH_DETERMINISM_ORACLE');
assert.equal(createVerifierRuntime.loadScript(context,'Object.getPrototypeOf(structuredClone({scope:{projectRevision:1}}))===Object.prototype'),true,'VERIFIER_RUNTIME_STRUCTURED_CLONE_REALM_ORACLE');
assert.match(createVerifierRuntime.loadScript(context,"closedLoopHash.sha256Value(structuredClone({scope:{projectRevision:1}}))"),/^[0-9a-f]{64}$/,'VERIFIER_RUNTIME_STRUCTURED_CLONE_CANONICAL_HASH_ORACLE');

const host=createVerifierRuntime(globalThis);
assert.equal(host,globalThis,'VERIFIER_HOST_IDENTITY_ORACLE');
assert.equal(Object.getPrototypeOf(createVerifierRuntime.loadScript(host,'({value:1})')),Object.prototype,'VERIFIER_HOST_REALM_ORACLE');
createVerifierRuntime.loadScript(host,hashSource,{filename:'hash.js'});
assert.match(host.closedLoopHash.sha256Value(structuredClone({scope:{projectRevision:1}})),/^[0-9a-f]{64}$/,'VERIFIER_HOST_CANONICAL_HASH_ORACLE');
assert.equal(await new host.File(['retained bytes'],'response.json').text(),'retained bytes','VERIFIER_HOST_FILE_BYTES_ORACLE');
await new Promise(resolve=>host.requestAnimationFrame(resolve));
host.localStorage.setItem('host-proof','retained');assert.equal(host.localStorage.getItem('host-proof'),'retained','VERIFIER_HOST_STORAGE_ORACLE');host.localStorage.removeItem('host-proof');
const override=()=>123,seed={setTimeout:override};assert.equal(createVerifierRuntime(seed).setTimeout,override,'VERIFIER_EXPLICIT_OVERRIDE_ORACLE');

const consumers=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','*.mjs'],{encoding:'utf8'}).trim().split('\n'))].filter(name=>fs.existsSync(name)&&!['verifier-runtime.mjs','verify-verifier-runtime.mjs'].includes(name));
const independent=consumers.filter(name=>/vm\.(?:createContext|runInNewContext|runInThisContext)\(/.test(fs.readFileSync(name,'utf8')));
assert.deepEqual(independent,[],'VERIFIER_RUNTIME_SINGLE_FACTORY_ORACLE');
const faults=[];
if(!process.argv.includes('--fault-probe')){
 const original=fs.readFileSync('verifier-runtime.mjs','utf8'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'clrt-runtime-faults-'));
 const mutations=[
  {name:'missing-animation-frame',before:original.split('\n').find(line=>line.includes("context.requestAnimationFrame=callback=>")),after:'',oracle:'VERIFIER_RUNTIME_ANIMATION_REQUESTANIMATIONFRAME_ORACLE'},
  {name:'foreign-structured-clone',before:'  return created;',after:'  if(created!==globalThis)created.structuredClone=globalThis.structuredClone;\n  return created;',oracle:'VERIFIER_RUNTIME_STRUCTURED_CLONE_REALM_ORACLE'},
  {name:'foreign-host-evaluation',before:'context===globalThis?vm.runInThisContext(source,options)',after:'context===globalThis?vm.runInNewContext(source,{...context,TextEncoder:context.TextEncoder},options)',oracle:'VERIFIER_HOST_REALM_ORACLE'},
  {name:'missing-canonical-hash',before:original.split('\n').find(line=>line.includes("if(!('closedLoopHash' in created)")),after:'',oracle:'VERIFIER_RUNTIME_HASH_CLOSEDLOOPHASH_ORACLE'}
 ];
 try{
  fs.copyFileSync('hash.js',path.join(directory,'hash.js'));
  for(const mutation of mutations){
   assert.ok(mutation.before&&original.split(mutation.before).length===2,'Unique runtime fault anchor required.');
   const file=path.join(directory,mutation.name+'.mjs');fs.writeFileSync(file,original.replace(mutation.before,mutation.after));
   const run=spawnSync(process.execPath,['verify-verifier-runtime.mjs','--fault-probe'],{encoding:'utf8',env:{...process.env,VERIFIER_RUNTIME_SOURCE:file},maxBuffer:8*1024*1024});
   assert.notEqual(run.status,0,'Undetected verifier runtime fault: '+mutation.name);assert.ok(run.stderr.includes(mutation.oracle),run.stderr);
   faults.push({fault:mutation.name,oracle:mutation.oracle,result:'DETECTED',exitCode:run.status,stdout:run.stdout,stderr:run.stderr});
  }
  const restored=spawnSync(process.execPath,['verify-verifier-runtime.mjs','--fault-probe'],{encoding:'utf8',env:{...process.env,VERIFIER_RUNTIME_SOURCE:path.resolve('verifier-runtime.mjs')},maxBuffer:8*1024*1024});
  assert.equal(restored.status,0,restored.stderr);faults.push({restoredImplementation:'PASS',stdout:restored.stdout,stderr:restored.stderr});
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
console.log(JSON.stringify({verifierRuntime:'PASS',required,hostRealm:'PASS',explicitOverride:'PASS',consumerCount:consumers.length,independentContextAuthorities:independent.length,faults},null,2));

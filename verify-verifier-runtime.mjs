import {runVerifier,assertDetectedFault} from './verify-conformance-regressions.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
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

// Prototype-named JSON members are data. Neither verifier clone may invoke
// Object.prototype's setter and change a supported canonical value.
const cloneInput=JSON.parse('{"__proto__":{"retained":true},"scope":{"projectRevision":1}}');
const cloneExpected=JSON.stringify(globalThis.structuredClone(cloneInput));
const persistenceRuntime=projectStoreRuntime();
for(const [name,clone,runtime] of [
 ['runtime',value=>context.structuredClone(value),context],
 ['persistence',value=>persistenceRuntime.copy(value),persistenceRuntime.runtime]
]){
 const actual=clone(cloneInput);
 assert.equal(Object.hasOwn(actual,'__proto__'),true,'VERIFIER_COPY_OWN_PROPERTY_ORACLE: '+name);
 assert.equal(JSON.stringify(actual),cloneExpected,'VERIFIER_COPY_OWN_PROPERTY_ORACLE: '+name);
 runtime.cloneResult=actual;
 assert.equal(createVerifierRuntime.loadScript(runtime,'Object.getPrototypeOf(cloneResult)===Object.prototype'),true,'VERIFIER_COPY_OWN_PROPERTY_ORACLE: '+name);
 assert.doesNotThrow(()=>runtime.closedLoopHash.sha256Value(actual),'VERIFIER_COPY_CANONICAL_ORACLE: '+name);
 delete runtime.cloneResult;
}

// A VM consumer may explicitly pass Node's native builtin. Its results must
// still belong to the application's realm, exactly as browser-local clones do.
const nativeArgument=createVerifierRuntime({structuredClone:globalThis.structuredClone});
assert.equal(createVerifierRuntime.loadScript(nativeArgument,'Object.getPrototypeOf(structuredClone({scope:{projectRevision:1}}))===Object.prototype'),true,'VERIFIER_RUNTIME_NATIVE_CLONE_ARGUMENT_ORACLE');
assert.match(createVerifierRuntime.loadScript(nativeArgument,'closedLoopHash.sha256Value(structuredClone({scope:{projectRevision:1}}))'),/^[0-9a-f]{64}$/,'VERIFIER_RUNTIME_NATIVE_CLONE_ARGUMENT_HASH_ORACLE');
const cloneOverride=value=>({deliberateOverride:value});
assert.equal(createVerifierRuntime({structuredClone:cloneOverride}).structuredClone,cloneOverride,'VERIFIER_RUNTIME_CUSTOM_CLONE_OVERRIDE_ORACLE');
const nativeHostClone=globalThis.structuredClone;
const host=createVerifierRuntime(globalThis);
assert.equal(host,globalThis,'VERIFIER_HOST_IDENTITY_ORACLE');
assert.equal(host.structuredClone,nativeHostClone,'VERIFIER_HOST_NATIVE_CLONE_IDENTITY_ORACLE');
assert.equal(Object.getPrototypeOf(createVerifierRuntime.loadScript(host,'({value:1})')),Object.prototype,'VERIFIER_HOST_REALM_ORACLE');
createVerifierRuntime.loadScript(host,hashSource,{filename:'hash.js'});
assert.match(host.closedLoopHash.sha256Value(structuredClone({scope:{projectRevision:1}})),/^[0-9a-f]{64}$/,'VERIFIER_HOST_CANONICAL_HASH_ORACLE');
assert.equal(await new host.File(['retained bytes'],'response.json').text(),'retained bytes','VERIFIER_HOST_FILE_BYTES_ORACLE');
await new Promise(resolve=>host.requestAnimationFrame(resolve));
host.localStorage.setItem('host-proof','retained');assert.equal(host.localStorage.getItem('host-proof'),'retained','VERIFIER_HOST_STORAGE_ORACLE');host.localStorage.removeItem('host-proof');
const override=()=>123,seed={setTimeout:override};assert.equal(createVerifierRuntime(seed).setTimeout,override,'VERIFIER_EXPLICIT_OVERRIDE_ORACLE');

const consumers=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','*.mjs'],{timeout:30000,killSignal:'SIGKILL',encoding:'utf8'}).trim().split('\n'))].filter(name=>fs.existsSync(name)&&!['verifier-runtime.mjs','verify-verifier-runtime.mjs'].includes(name));
const independent=consumers.filter(name=>/vm\.(?:createContext|runInNewContext|runInThisContext)\(/.test(fs.readFileSync(name,'utf8')));
assert.deepEqual(independent,[],'VERIFIER_RUNTIME_SINGLE_FACTORY_ORACLE');
const faults=[];
if(!process.argv.includes('--fault-probe')){
 const original=fs.readFileSync('verifier-runtime.mjs','utf8'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'clrt-runtime-faults-'));
 const mutations=[
  {name:'honored-foreign-native-override',before:"&&(context===globalThis||context.structuredClone!==globalThis.structuredClone)",after:'',oracle:'VERIFIER_RUNTIME_NATIVE_CLONE_ARGUMENT_ORACLE'},
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
   const run=(await runVerifier(process.execPath,['verify-verifier-runtime.mjs','--fault-probe'],{encoding:'utf8',env:{...process.env,VERIFIER_RUNTIME_SOURCE:file},maxBuffer:8*1024*1024}));
   assertDetectedFault(run,mutation.oracle,'Undetected verifier runtime fault: '+mutation.name);assert.ok(run.stderr.includes(mutation.oracle),run.stderr);
   faults.push({fault:mutation.name,oracle:mutation.oracle,result:'DETECTED',exitCode:run.status,stdout:run.stdout,stderr:run.stderr});
  }
  const restored=(await runVerifier(process.execPath,['verify-verifier-runtime.mjs','--fault-probe'],{encoding:'utf8',env:{...process.env,VERIFIER_RUNTIME_SOURCE:path.resolve('verifier-runtime.mjs')},maxBuffer:8*1024*1024}));
  assert.equal(restored.status,0,restored.stderr);faults.push({restoredImplementation:'PASS',stdout:restored.stdout,stderr:restored.stderr});
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
console.log(JSON.stringify({verifierRuntime:'PASS',required,hostRealm:'PASS',explicitOverride:'PASS',consumerCount:consumers.length,independentContextAuthorities:independent.length,faults},null,2));

import {runVerifier,assertDetectedFault} from './verify-conformance-regressions.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
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

// Native VM globals retain their own intrinsics and reject foreign canonical
// objects. These controls run in the required verifier, including its restored
// child, rather than relying on a performance-only stand-in.
const nativeSeed={fixtureOverride:()=>123},nativeGlobal=createVerifierRuntime.withNativeGlobal(nativeSeed);
assert.equal(createVerifierRuntime.loadScript(nativeGlobal,'globalThis'),nativeGlobal,'VERIFIER_NATIVE_GLOBAL_IDENTITY_ORACLE');
assert.notEqual(nativeGlobal,globalThis,'VERIFIER_NATIVE_GLOBAL_ISOLATION_ORACLE');
assert.equal(nativeGlobal.fixtureOverride,nativeSeed.fixtureOverride,'VERIFIER_NATIVE_GLOBAL_OVERRIDE_ORACLE');
assert.equal(Object.hasOwn(nativeSeed,'closedLoopHash'),false,'VERIFIER_NATIVE_GLOBAL_SEED_ORACLE');
createVerifierRuntime.loadScript(nativeGlobal,'globalThis.isolatedFixtureMarker="native-only"');
assert.equal(context.isolatedFixtureMarker,undefined,'VERIFIER_NATIVE_GLOBAL_ISOLATION_ORACLE');
assert.equal(globalThis.isolatedFixtureMarker,undefined,'VERIFIER_NATIVE_GLOBAL_ISOLATION_ORACLE');
assert.throws(()=>createVerifierRuntime.withNativeGlobal(globalThis),/distinct from the host global/,'VERIFIER_NATIVE_GLOBAL_HOST_SEED_ORACLE');
const getter=()=>123,describedSeed=JSON.parse('{"__proto__":{"retained":true}}');Object.defineProperty(describedSeed,'deliberateAccessor',{get:getter,enumerable:false});
const described=createVerifierRuntime.withNativeGlobal(describedSeed);
assert.equal(Object.getOwnPropertyDescriptor(described,'deliberateAccessor').get,getter,'VERIFIER_NATIVE_SEED_DESCRIPTOR_ORACLE');
assert.equal(Object.getOwnPropertyDescriptor(described,'deliberateAccessor').enumerable,false,'VERIFIER_NATIVE_SEED_DESCRIPTOR_ORACLE');
assert.equal(Object.hasOwn(described,'__proto__'),true,'VERIFIER_NATIVE_SEED_DESCRIPTOR_ORACLE');
assert.equal(described.__proto__,describedSeed.__proto__,'VERIFIER_NATIVE_SEED_DESCRIPTOR_ORACLE');
const locked=createVerifierRuntime.withNativeGlobal({}, {codeGeneration:{strings:false,wasm:false}});
assert.throws(()=>createVerifierRuntime.loadScript(locked,'eval("1+1")'),error=>error.name==='EvalError','VERIFIER_NATIVE_CONTEXT_OPTIONS_ORACLE');
class FixtureDate extends Date {constructor(...args){super(...(args.length?args:['2026-10-01T00:00:00.000Z']));}static now(){return Date.parse('2026-10-01T00:00:00.000Z');}}
const clockOverride=createVerifierRuntime.withNativeGlobal({Date:FixtureDate});
assert.equal(createVerifierRuntime.loadScript(clockOverride,'new Date().toISOString()'),'2026-10-01T00:00:00.000Z','VERIFIER_NATIVE_DATE_OVERRIDE_ORACLE');
assert.equal(clockOverride.Date,FixtureDate,'VERIFIER_NATIVE_DATE_OVERRIDE_ORACLE');
const canonicalParity=[];
for(const [expression,expected] of [
 ['({b:[true,null,"é🙂"],a:1})','{"a":1,"b":[true,null,"é🙂"]}'],
 ['JSON.parse(\'{"__proto__":{"retained":true},"value":7}\')','{"__proto__":{"retained":true},"value":7}'],
 ['Object.assign(Object.create(null),{value:7})','{"value":7}']
]){
 const expectedDigest=createHash('sha256').update(expected).digest('hex');
 for(const runtime of [context,nativeGlobal,persistenceRuntime.runtime]){
  const value=createVerifierRuntime.loadScript(runtime,expression);
  assert.equal(runtime.closedLoopHash.stableStringify(value),expected,'VERIFIER_NATIVE_CANONICAL_PARITY_ORACLE');
  assert.equal(runtime.closedLoopHash.sha256Value(value),expectedDigest,'VERIFIER_NATIVE_CANONICAL_PARITY_ORACLE');
 }
 canonicalParity.push({expression,expectedDigest});
}
const rejectedCanonical=['({value:undefined})','[1,,3]','({value:-0})','({value:Infinity})','Object.assign({},{[Symbol("retained")]:7})','({get value(){throw new Error("Accessor executed");}})','Object.create({inherited:true})','(()=>{const value={};value.self=value;return value;})()'];
for(const expression of rejectedCanonical)for(const runtime of [context,nativeGlobal,persistenceRuntime.runtime]){
 const value=createVerifierRuntime.loadScript(runtime,expression);
 assert.throws(()=>runtime.closedLoopHash.sha256Value(value),error=>error.name==='TypeError'&&/Cannot (?:canonically )?hash/.test(error.message),'VERIFIER_NATIVE_CANONICAL_REJECTION_ORACLE');
}
for(const runtime of [context,nativeGlobal,persistenceRuntime.runtime])assert.throws(()=>runtime.closedLoopHash.sha256Value({foreign:true}),/non-plain object/,'VERIFIER_NATIVE_FOREIGN_REALM_ORACLE');
const shared={retained:undefined},copyInput={first:shared,second:shared};copyInput.self=copyInput;
const copied=persistenceRuntime.copy(copyInput);
assert.equal(copied.first,copied.second,'VERIFIER_PERSISTENCE_CLONE_GRAPH_ORACLE');
assert.equal(copied.self,copied,'VERIFIER_PERSISTENCE_CLONE_GRAPH_ORACLE');
assert.equal(Object.hasOwn(copied.first,'retained'),true,'VERIFIER_PERSISTENCE_CLONE_UNDEFINED_ORACLE');
assert.notEqual(copied.first,shared,'VERIFIER_PERSISTENCE_CLONE_ISOLATION_ORACLE');
const transaction=await persistenceRuntime.runtime.openStorageTransaction(['meta'],'readwrite'),transactionStore=transaction.objectStore('meta'),transactionInput={key:'native-global-parity',value:{retained:7}};
transactionStore.put(transactionInput);transactionInput.value.retained=99;transaction.commit();
const aborted=await persistenceRuntime.runtime.openStorageTransaction(['meta'],'readwrite'),read=aborted.objectStore('meta').get(transactionInput.key).result;
assert.equal(read.value.retained,7,'VERIFIER_PERSISTENCE_TRANSACTION_INPUT_ORACLE');read.value.retained=23;aborted.objectStore('meta').put(read);aborted.abort();
assert.throws(()=>aborted.commit(),/Transaction aborted/,'VERIFIER_PERSISTENCE_TRANSACTION_ABORT_ORACLE');
assert.equal(persistenceRuntime.rows.get('meta').get(transactionInput.key).value.retained,7,'VERIFIER_PERSISTENCE_TRANSACTION_ABORT_ORACLE');
const healthy=await persistenceRuntime.store.createProject({commandId:'NATIVE-GLOBAL-PERSISTENCE-PARITY'});
assert.equal((await persistenceRuntime.store.readProject(healthy.job.JOB_ID)).projectSha256,healthy.projectSha256,'VERIFIER_NATIVE_PRODUCTION_STORE_ORACLE');
const sourceOverride=fs.readFileSync('project-store.js','utf8')+'\nglobalThis.fixtureSourceOverrideExecuted=true;\n';
const injected=projectStoreRuntime({environment:{fixtureOverride:nativeSeed.fixtureOverride},sourceOverrides:{'project-store.js':sourceOverride},fault:{id:'native-global-hash-fault',file:'project-store.js',before:'const projectSha256=project=>hash.sha256Value(canonicalProject(project));',after:'const projectSha256=project=>{throw new Error("VERIFIER_NATIVE_SOURCE_FAULT_REACHED");};'}});
assert.equal(injected.runtime.fixtureOverride,nativeSeed.fixtureOverride,'VERIFIER_NATIVE_PERSISTENCE_OVERRIDE_ORACLE');
assert.equal(injected.runtime.fixtureSourceOverrideExecuted,true,'VERIFIER_NATIVE_SOURCE_OVERRIDE_ORACLE');
assert.equal(injected.rows.get('meta').has(transactionInput.key),false,'VERIFIER_NATIVE_STORE_ISOLATION_ORACLE');
await assert.rejects(()=>injected.store.createProject({commandId:'NATIVE-GLOBAL-INJECTED-FAULT'}),/VERIFIER_NATIVE_SOURCE_FAULT_REACHED/,'VERIFIER_NATIVE_SOURCE_FAULT_ORACLE');
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
  {name:'missing-canonical-hash',before:original.split('\n').find(line=>line.includes("if(!('closedLoopHash' in created)")),after:'',oracle:'VERIFIER_RUNTIME_HASH_CLOSEDLOOPHASH_ORACLE'},
  {name:'contextified-native-global',before:'vm.createContext(vm.constants.DONT_CONTEXTIFY,options)',after:'vm.createContext({},options)',oracle:'VERIFIER_NATIVE_GLOBAL_IDENTITY_ORACLE'}
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
console.log(JSON.stringify({verifierRuntime:'PASS',required,hostRealm:'PASS',explicitOverride:'PASS',nativeGlobal:{canonicalParity,rejectedCanonical,realmIsolation:true,cloneGraphPreserved:true,transactionAbortPreserved:true,productionStoreReadback:true,sourceFaultDetected:true},consumerCount:consumers.length,independentContextAuthorities:independent.length,faults},null,2));

import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createVerifierRuntime} from './verifier-runtime.mjs';

const context=createVerifierRuntime();
const required={
  timers:['setTimeout','clearTimeout','setInterval','clearInterval','queueMicrotask'],
  animation:['requestAnimationFrame','cancelAnimationFrame'],
  cancellation:['AbortController','AbortSignal'],
  bytes:['Blob','File','TextEncoder','TextDecoder','URL','URLSearchParams'],
  platform:['crypto','structuredClone','performance'],
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

const consumers=fs.readdirSync('.').filter(name=>/\.mjs$/.test(name)&&!['verifier-runtime.mjs','verify-verifier-runtime.mjs'].includes(name));
const independent=consumers.filter(name=>fs.readFileSync(name,'utf8').includes('vm.createContext('));
assert.deepEqual(independent,[],'VERIFIER_RUNTIME_SINGLE_FACTORY_ORACLE');
console.log(JSON.stringify({verifierRuntime:'PASS',required,consumerCount:consumers.length,independentContextAuthorities:independent.length},null,2));

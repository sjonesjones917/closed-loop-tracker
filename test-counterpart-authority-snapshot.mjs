import assert from 'node:assert/strict';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {types} from 'node:util';
// Copy only lossless canonical JSON data into this realm. Never invoke getters
// or toJSON, silently drop properties, coerce values, or change production hashing.
export function normalizeAuthorityJson(value,ancestors=new Set()){
 const fail=()=>{throw new TypeError('COUNTERPART_AUTHORITY_JSON_DOMAIN_ORACLE');};
 if(value===null||typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number'){if(!Number.isSafeInteger(value)||Object.is(value,-0))fail();return value;}
 if(typeof value!=='object'||types.isProxy(value)||ancestors.has(value))fail();
 const array=Array.isArray(value),proto=Object.getPrototypeOf(value);
 if(!array&&proto!==null){
  const constructor=Object.getOwnPropertyDescriptor(proto,'constructor');
  if(Object.getPrototypeOf(proto)!==null||!constructor||typeof constructor.value!=='function'||Function.prototype.toString.call(constructor.value)!==Function.prototype.toString.call(Object))fail();
 }
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
 if(keys.some(key=>typeof key!=='string'))fail();
 if(array&&(keys.length!==value.length+1||!keys.includes('length')))fail();
 ancestors.add(value);
 try{
  const entries=[];
  for(const key of keys){
   if(array&&key==='length')continue;
   const descriptor=descriptors[key];
   if(!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)fail();
   if(array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=value.length))fail();
   entries.push([key,normalizeAuthorityJson(descriptor.value,ancestors)]);
  }
  return array?entries.map(([,item])=>item):Object.fromEntries(entries);
 }finally{ancestors.delete(value);}
}
export function authoritySnapshot(hash,project){return hash.sha256Value(normalizeAuthorityJson(Object.fromEntries(['rawResponses','acceptedChanges','tests','deterministicResults','evidenceRecords','artifacts'].map(key=>[key,project.projectData[key]]))));}
export function verifyAuthoritySnapshotControls(hash){
 const data={rawResponses:[{id:'raw',bytes:3}],acceptedChanges:[{id:'accepted',nested:{ok:true}}],tests:[],deterministicResults:[],evidenceRecords:[],artifacts:[{sha256:'abc'}]};
 const host={projectData:data},foreign=createVerifierRuntime.loadScript(createVerifierRuntime({text:JSON.stringify(host)}),'JSON.parse(text)');
 const before=JSON.stringify(foreign),expected=authoritySnapshot(hash,host);
 assert.throws(()=>hash.sha256Value(foreign.projectData),/non-plain object/);
 assert.equal(authoritySnapshot(hash,foreign),expected);
 assert.equal(JSON.stringify(normalizeAuthorityJson(foreign)),before);
 for(const key of Object.keys(data)){
  const changed=createVerifierRuntime.loadScript(createVerifierRuntime({text:JSON.stringify(host)}),'JSON.parse(text)');changed.projectData[key].push({changed:true});
  assert.notEqual(authoritySnapshot(hash,changed),expected);
 }
 let invoked=0;const accessor={get secret(){invoked++;return 1;}},toJSON={toJSON(){invoked++;return {};}};
 const cyclic={};cyclic.self=cyclic;
 const hidden={};Object.defineProperty(hidden,'hidden',{value:1});
 const symbol={[Symbol('hidden')]:1},extra=[];extra.extra=1;
 const invalid=[undefined,()=>1,1n,NaN,Infinity,-0,0.5,Number.MAX_SAFE_INTEGER+1,new Date(),new Map(),Object.create({}),accessor,toJSON,cyclic,hidden,symbol,extra,Array(1),new Proxy({},{}),createVerifierRuntime.loadScript(createVerifierRuntime(),'new Date()'),createVerifierRuntime.loadScript(createVerifierRuntime(),'({get secret(){throw Error("getter executed")}})')];
 for(const value of invalid)assert.throws(()=>normalizeAuthorityJson(value),/COUNTERPART_AUTHORITY_JSON_DOMAIN_ORACLE/);
 assert.equal(invoked,0);assert.equal(JSON.stringify(foreign),before);
 const special=JSON.parse('{"__proto__":{"retained":true},"nil":null}');assert.equal(JSON.stringify(normalizeAuthorityJson(special)),JSON.stringify(special));
 return {sameSerializedAuthority:true,changedAuthorityControls:6,refusalControls:invalid.length};
}

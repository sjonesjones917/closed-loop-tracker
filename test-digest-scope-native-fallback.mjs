// Digest-scope native-fallback regression. When a guarded native is changed,
// a scoped digest must behave exactly like the unscoped cold digest: same
// result, no throw the cold path does not throw, and no extra calls into the
// changed native. Healthy reuse, guard-before-reuse and tamper controls are
// kept alongside, with a counted Array.prototype.sort control on a multi-key
// no-candidate value. Proxy trap counts under a failed guard are reported, not
// asserted (see REPORT.md).
// usage: node test-digest-scope-native-fallback.mjs [path/to/hash.js]
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createVerifierRuntime} from './verifier-runtime.mjs';
const assert=(ok,name)=>{if(!ok)throw new Error('DIGEST_SCOPE_NATIVE_FALLBACK_ORACLE '+name);};
const digest=text=>createHash('sha256').update(text,'utf8').digest('hex');
const ROOT_TEXT='{"a":[null,true,7,"é🙂"],"z":"x"}';
const PROBES=[
 // [name, expression, canonical text]; "candidate" probes match an indexed scope node
 ['object-candidate','JSON.parse(JSON.stringify(root))',ROOT_TEXT],
 ['array-candidate',"[null,true,7,'é🙂']",'[null,true,7,"é🙂"]'],
 ['object-no-candidate',"({q:1,r:['é🙂']})",'{"q":1,"r":["é🙂"]}'],
 ['array-no-candidate',"[1,2,3,4,5]",'[1,2,3,4,5]']
];
// Each tamper installs a changed guarded native that counts calls in __calls.
const TAMPERS=[
 ['json-stringify-throws-on-array',"var __o=JSON.stringify;JSON.stringify=function(v,...r){__calls++;if(__isArray(v))throw new Error('ARRAY_STRINGIFY_TAMPER');return __apply(__o,this,[v,...r]);};"],
 ['map-get-throws',"Map.prototype.get=function(){__calls++;throw new Error('MAP_GET_TAMPER');};"],
 ['object-keys-counted',"var __o=Object.keys;Object.keys=function(v){__calls++;return __apply(__o,Object,[v]);};"],
 ['array-isarray-counted',"Array.isArray=function(v){__calls++;return __isArray(v);};"]
];
function fresh(source){
 const context=createVerifierRuntime({TextEncoder,TextDecoder,Uint8Array,Uint32Array,ArrayBuffer,DataView,Blob});createVerifierRuntime.loadScript(context,source);
 const run=code=>createVerifierRuntime.loadScript(context,code);
 run(`var __calls=0,__isArray=Array.isArray,__apply=Reflect.apply,hash=closedLoopHash,root={a:[null,true,7,'é🙂'],z:'x'},scope=hash.createCanonicalDigestScope(root);`);
 const stats=()=>JSON.parse(run('JSON.stringify(hash.canonicalDigestScopeStats(scope))'));
 // outcome of one call: digest or error message, plus counted native calls
 const call=code=>{run('__calls=0;');try{return {digest:run(code),calls:run('__calls')};}catch(error){return {error:String(error?.message||error),calls:run('__calls')};}};
 return {run,stats,call};
}
export function verifyDigestScopeNativeFallback(source=fs.readFileSync('hash.js','utf8')){
 const cases=[],proxy=[],failures=[];
 // 1. Changed native: scoped equals cold, for candidate and no-candidate probes.
 // Every combination runs; all failures are reported together.
 for(const [tamper,install]of TAMPERS)for(const [probe,expression,text]of PROBES)try{
  const {run,stats,call}=fresh(source),name=tamper+'/'+probe;
  assert(run('hash.withCanonicalDigestScope(scope,()=>hash.sha256Value(root))')===digest(ROOT_TEXT),name+' healthy warm');
  run('var probe='+expression+';');run(install);
  const cold=call('hash.sha256Value(probe)'),before=stats(),scoped=call('hash.withCanonicalDigestScope(scope,()=>hash.sha256Value(probe))'),after=stats();
  assert(cold.digest===digest(text),name+' cold path exact under tamper');
  assert(!scoped.error,name+' scoped must not throw where cold does not: '+scoped.error);
  assert(scoped.digest===cold.digest,name+' scoped equals cold');
  assert(scoped.calls===cold.calls,name+' no extra changed-native calls (scoped '+scoped.calls+', cold '+cold.calls+')');
  assert(after.hits===before.hits&&after.misses===before.misses&&after.bypasses===before.bypasses+1,name+' counted as bypass, never reuse');
  cases.push(name);
 }catch(error){failures.push(error.message);}
 if(failures.length)throw new Error(failures.length+' native-fallback failure(s):\n'+failures.join('\n'));
 // 1b. Counted Array.prototype.sort on a multi-key value with no candidate:
 // the signature sort must use the captured native, so scoped and cold make
 // the same number of calls into the changed sort (a live keys.sort() makes one more).
 {
  const {run,stats,call}=fresh(source),name='array-sort-counted/multikey-object-no-candidate';
  run("var probe={t:1,q:[2],s:'é🙂',r:null,p:4};var __o=Array.prototype.sort;Array.prototype.sort=function(...a){__calls++;return __apply(__o,this,a);};");
  const text='{"p":4,"q":[2],"r":null,"s":"é🙂","t":1}',cold=call('hash.sha256Value(probe)'),before=stats(),scoped=call('hash.withCanonicalDigestScope(scope,()=>hash.sha256Value(probe))'),after=stats();
  assert(cold.digest===digest(text),name+' cold path exact under tamper');
  assert(!scoped.error,name+' scoped must not throw where cold does not: '+scoped.error);
  assert(scoped.digest===cold.digest,name+' scoped equals cold');
  assert(scoped.calls===cold.calls,name+' no extra changed-native sort calls (scoped '+scoped.calls+', cold '+cold.calls+')');
  assert(after.hits===before.hits&&after.misses===before.misses&&after.bypasses===before.bypasses+1,name+' counted as bypass, never reuse');
  cases.push(name);
 }
 // 2. Healthy reuse, guard before reuse, tamper never borrows, disposed cold.
 {
  const {run,stats}=fresh(source),expected=digest(ROOT_TEXT),scoped=code=>run('hash.withCanonicalDigestScope(scope,()=>hash.sha256Value('+code+'))');
  assert(scoped('root')===expected,'healthy cold');let before=stats();
  assert(scoped('JSON.parse(JSON.stringify(root))')===expected&&stats().hits===before.hits+1,'healthy reuse');cases.push('healthy-reuse');
  before=stats();assert(scoped("({z:'x',a:[null,true,7,'é🙂']})")===expected&&stats().hits===before.hits+1,'reuse independent of key insertion order');cases.push('key-order-reuse');
  before=stats();assert(scoped("({q:1})")===digest('{"q":1}')&&stats().bypasses===before.bypasses+1&&stats().hits===before.hits,'no-candidate cold');cases.push('no-candidate-cold');
  run('Math.__guardProbe=1;');before=stats();
  assert(scoped('JSON.parse(JSON.stringify(root))')===expected&&stats().hits===before.hits&&stats().bypasses===before.bypasses+1,'guard enforced before candidate reuse');
  run('delete Math.__guardProbe;');cases.push('guard-before-reuse');
  before=stats();assert(scoped('JSON.parse(JSON.stringify(root))')===expected&&stats().hits===before.hits+1,'reuse after restore');
  run("root.a[3]='e🙂';");before=stats();
  assert(scoped('root')===digest('{"a":[null,true,7,"e🙂"],"z":"x"}')&&stats().hits===before.hits,'tamper never borrows');
  run("root.a[3]='é🙂';");cases.push('restore-and-tamper');
  run('hash.disposeCanonicalDigestScope(scope);');assert(scoped('root')===expected,'disposed cold');cases.push('disposed-cold');
 }
 // 3. Key-signature control: names containing the separator and digits stay
 // exact; distinct key sets never borrow each other's digest.
 {
  const {run,stats}=fresh(source);
  run(`var odd={'1:a':1,b:[2],'':0,'é🙂':{'a1:b':3}},oddScope=hash.createCanonicalDigestScope(odd);`);
  const oddText='{"":0,"1:a":1,"b":[2],"é🙂":{"a1:b":3}}',s=code=>run('hash.withCanonicalDigestScope(oddScope,()=>hash.sha256Value('+code+'))'),h=()=>JSON.parse(run('JSON.stringify(hash.canonicalDigestScopeStats(oddScope))'));
  assert(s('odd')===digest(oddText),'odd cold');let before=h();
  assert(s('JSON.parse(JSON.stringify(odd))')===digest(oddText)&&h().hits===before.hits+1,'odd reuse');before=h();
  assert(s("({'1':0,'a1:b':3})")===digest('{"1":0,"a1:b":3}')&&h().hits===before.hits,'separator-shaped names never borrow');
  assert(s("({'a1:b':4})")===digest('{"a1:b":4}')&&h().hits===before.hits,'changed value never borrows');
  void stats;cases.push('signature-separator-control');
 }
 // 4. Proxy probe under a failed guard: digest exact; trap counts reported.
 for(const [probe,target,text]of [['proxy-object','({q:1})','{"q":1}'],['proxy-array','[1,2]','[1,2]']]){
  const {run,call}=fresh(source);
  run(`var __traps=0,__h={};for(const k of Reflect.ownKeys(Reflect))__h[k]=function(...a){__traps++;return Reflect[k](...a);};var probe=new Proxy(${target},__h);Math.__guardProbe=1;`);
  const count=code=>{run('__traps=0;');const r=call(code);return {...r,traps:run('__traps')};};
  const cold=count('hash.sha256Value(probe)'),scoped=count('hash.withCanonicalDigestScope(scope,()=>hash.sha256Value(probe))');
  assert(cold.digest===digest(text)&&scoped.digest===cold.digest,probe+' digest exact');
  proxy.push({probe,coldTraps:cold.traps,scopedTraps:scoped.traps});
 }
 return {passed:true,cases,proxyGuardFailure:proxy};
}
if(import.meta.url===`file://${process.argv[1]}`)console.log(JSON.stringify(verifyDigestScopeNativeFallback(fs.readFileSync(process.argv[2]||'hash.js','utf8'))));

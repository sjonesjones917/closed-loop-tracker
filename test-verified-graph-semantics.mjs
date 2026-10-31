// Regression for the private ordinary-data graph validator, copy, and equality owners.
// The reference below is the exact pre-optimization implementation from store
// aec7fc8dc313cf5fe9dec966879426017e5fd272210219821f9b6a6e113cf14b.
// It is a differential test fixture, not a production fallback or receipt source.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const original=`function verifiedGraphNodes(value){
  const nodes=new Map(),active=new WeakSet(),pending=[[value,false]];
  while(pending.length){
    const [item,finish]=pending.pop();if(!item||typeof item!=='object'){if(typeof item==='function'||typeof item==='symbol')return null;continue;}
    if(finish){active.delete(item);continue;}
    if(active.has(item))return null;if(nodes.has(item))continue;
    if(!Array.isArray(item)&&Object.getPrototypeOf(item)!==Object.prototype&&Object.getPrototypeOf(item)!==null)return null;
    if(Object.getOwnPropertySymbols(item).length)return null;
    const entries=[];
    for(const key of Object.getOwnPropertyNames(item)){
      if(Array.isArray(item)&&key==='length')continue;
      const descriptor=Object.getOwnPropertyDescriptor(item,key);
      if(!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))return null;
      entries.push([key,descriptor.value]);
    }
    nodes.set(item,entries);active.add(item);pending.push([item,true]);
    for(const [,child]of entries)pending.push([child,false]);
  }
  return nodes;
}
function copyVerifiedTree(value){
  const nodes=verifiedGraphNodes(value);if(!nodes)return clone(value);
  if(!value||typeof value!=='object')return value;
  const copies=new Map([...nodes.keys()].map(item=>[item,Array.isArray(item)?new Array(item.length):{}]));
  for(const [source,entries]of nodes){const target=copies.get(source);for(const [key,item]of entries)Object.defineProperty(target,key,{value:item&&typeof item==='object'?copies.get(item):item,enumerable:true,writable:true,configurable:true});}
  return copies.get(value);
}
function verifiedValuesEqual(before,after){
  const leftNodes=verifiedGraphNodes(before),rightNodes=verifiedGraphNodes(after);if(!leftNodes||!rightNodes)return false;
  const pending=[[before,after]],compared=new WeakMap();
  while(pending.length){
    const [left,right]=pending.pop();if(Object.is(left,right))continue;
    if(!left||!right||typeof left!=='object'||typeof right!=='object'||Array.isArray(left)!==Array.isArray(right))return false;
    if(Array.isArray(left)&&left.length!==right.length)return false;
    let partners=compared.get(left);if(partners?.has(right))continue;if(!partners){partners=new WeakSet();compared.set(left,partners);}partners.add(right);
    const entries=leftNodes.get(left),other=new Map(rightNodes.get(right));if(entries.length!==other.size)return false;
    for(const [key,item]of entries){if(!other.has(key))return false;pending.push([item,other.get(key)]);}
  }
  return true;
}
const VERIFIED_PROJECT_INTEGRITY=undefined;`;
export function verifyVerifiedGraphSemantics({source=fs.readFileSync(new URL('./project-store.js',import.meta.url),'utf8')}={}){
 assert.equal(source.split('function verifiedGraphNodes(').length,2,'VERIFIED_GRAPH_OWNER_UNIQUE');
 assert.equal(source.split('const VERIFIED_PROJECT_INTEGRITY=').length,2,'VERIFIED_GRAPH_END_UNIQUE');
function load(source,events){const section=source.slice(source.indexOf('function verifiedGraphNodes('),source.indexOf('const VERIFIED_PROJECT_INTEGRITY='));return new Function('clone',section+';return {graph:verifiedGraphNodes,copy:copyVerifiedTree,equal:verifiedValuesEqual};')(value=>{events.push('clone-fallback');return structuredClone(value)});}
function scalar(v){if(typeof v==='number')return Number.isNaN(v)?'number:NaN':Object.is(v,-0)?'number:-0':'number:'+v;if(typeof v==='symbol')return 'symbol:'+String(v.description);if(typeof v==='function')return 'function:'+v.name;if(typeof v==='bigint')return 'bigint:'+v;return typeof v+':'+String(v);}
function describe(value){const ids=new Map(),nodes=[];function ref(v){if(v===null||typeof v!=='object')return scalar(v);if(ids.has(v))return ['ref',ids.get(v)];const id=nodes.length;ids.set(v,id);const node={id,array:Array.isArray(v),proto:Object.getPrototypeOf(v)===null?'null':Object.getPrototypeOf(v)?.constructor?.name,entries:[]};nodes.push(node);if(v instanceof Map)node.map=[...v].map(([k,w])=>[ref(k),ref(w)]);if(v instanceof Set)node.set=[...v].map(ref);if(v instanceof Date)node.date=v.getTime();for(const key of Reflect.ownKeys(v)){const d=Object.getOwnPropertyDescriptor(v,key);node.entries.push([typeof key==='symbol'?'symbol:'+key.description:key,{enumerable:d.enumerable,configurable:d.configurable,writable:d.writable,...(Object.hasOwn(d,'value')?{value:ref(d.value)}:{get:Boolean(d.get),set:Boolean(d.set)})}]);}return ['ref',id]}return {root:ref(value),nodes};}
function graphDescription(nodes){if(!nodes)return null;const ids=new Map([...nodes.keys()].map((v,i)=>[v,i]));return [...nodes].map(([value,entries])=>{const pairs=typeof entries[0]==='string'?Array.from({length:entries.length/2},(_,i)=>[entries[2*i],entries[2*i+1]]):entries;return {id:ids.get(value),entries:pairs.map(([k,v])=>[k,v&&typeof v==='object'?['ref',ids.get(v)]:scalar(v)])}})}
const factories=[];const add=(name,fn)=>factories.push([name,fn]);
function state(){const trace=[];let calls=0;const observe=(name,target,hooks={})=>new Proxy(target,{getPrototypeOf(t){trace.push(name+':prototype');return hooks.proto?hooks.proto(t):Reflect.getPrototypeOf(t)},ownKeys(t){trace.push(name+':keys');return hooks.keys?hooks.keys(t):Reflect.ownKeys(t)},getOwnPropertyDescriptor(t,k){trace.push(name+':descriptor:'+String(k));return hooks.descriptor?hooks.descriptor(t,k):Reflect.getOwnPropertyDescriptor(t,k)},get(t,k,r){trace.push(name+':get:'+String(k));return Reflect.get(t,k,r)}});return {trace,observe,getCalls:()=>calls,getter(){calls++;throw Error('GETTER_CALLED')}};}
add('two-throwing-proxy-order',()=>{const s=state();return {...s,left:{nested:s.observe('L',{}, {proto(){throw new TypeError('LEFT_TRAP')}})},right:s.observe('R',{}, {proto(){throw new RangeError('RIGHT_TRAP')}})}});
add('paired-v2-false-to-true-counterexample',()=>{const s=state(),right={a:1,b:2};return {...s,right,left:s.observe('L',{a:1,b:2},{descriptor(t,k){if(k==='b')right.a=999;return Reflect.getOwnPropertyDescriptor(t,k)}})}});
for(const side of ['left','right'])for(const kind of ['throw-descriptor','throw-prototype','throw-symbols','add-symbol','add-hidden','add-accessor','change-prototype','change-late-value','delete-late','deep-cycle'])add(side+':'+kind,()=>{const s=state(),left={first:1,late:{a:1,b:2}},right={first:1,late:{a:1,b:2}},target=side==='left'?left:right,other=side==='left'?right:left;let fired=false;const hooks={descriptor(t,k){if(!fired&&k==='first'){fired=true;if(kind==='throw-descriptor')throw new TypeError(side+' DESCRIPTOR');if(kind==='add-symbol')other[Symbol('new')]=1;if(kind==='add-hidden')Object.defineProperty(other,'hidden',{value:1});if(kind==='add-accessor')Object.defineProperty(other,'access',{enumerable:true,get:s.getter});if(kind==='change-prototype')Object.setPrototypeOf(other,{inherited:true});if(kind==='change-late-value')other.late.a=999;if(kind==='delete-late')delete other.late;if(kind==='deep-cycle')other.late.back=other;}return Reflect.getOwnPropertyDescriptor(t,k)}};if(kind==='throw-prototype')hooks.proto=()=>{throw new RangeError(side+' PROTOTYPE')};if(kind==='throw-symbols')hooks.keys=()=>{throw new SyntaxError(side+' SYMBOLS')};return {...s,left:side==='left'?s.observe('L',left,hooks):left,right:side==='right'?s.observe('R',right,hooks):right};});
for(const kind of ['reordered-keys','shared-versus-duplicated','wide-shared','sparse','sparse-versus-undefined','array-prototype-null','array-extra-key','nonenumerable','accessor','symbol-key','symbol-value','function','asymmetric-cycle','same-reference-cycle','null-prototype','negative-zero','NaN','infinities','bigint','date-fallback','map-fallback','deep-dag'])add(kind,()=>{const s=state();let left={a:1,b:2},right={a:1,b:2};switch(kind){case'reordered-keys':right={b:2,a:1};break;case'shared-versus-duplicated':{const a={x:2};left={a,b:a};right={a:{x:2},b:{x:2}};break;}case'wide-shared':{const a={x:{v:3}};left={rows:Array(80).fill(a)};right={rows:Array.from({length:80},()=>({x:{v:3}}))};break;}case'sparse':left=Array(5);left[3]=2;right=Array(5);right[3]=2;break;case'sparse-versus-undefined':left=Array(2);right=[undefined,undefined];break;case'array-prototype-null':left=[1];right=[1];Object.setPrototypeOf(left,null);break;case'array-extra-key':left=[1];right=[1];left.extra=2;right.extra=2;break;case'nonenumerable':Object.defineProperty(left,'hidden',{value:2});break;case'accessor':Object.defineProperty(left,'x',{enumerable:true,get:s.getter});break;case'symbol-key':left[Symbol('x')]=2;break;case'symbol-value':left.a=Symbol('x');break;case'function':left.a=()=>2;break;case'asymmetric-cycle':right.b={child:{}};right.b.child.back=right.b;break;case'same-reference-cycle':left.self=left;right=left;break;case'null-prototype':left=Object.assign(Object.create(null),{a:1,b:2});break;case'negative-zero':left.a=-0;right.a=0;break;case'NaN':left.a=NaN;right.a=NaN;break;case'infinities':left={pos:Infinity,neg:-Infinity};right={pos:Infinity,neg:-Infinity};break;case'bigint':left.a=2n;right.a=2n;break;case'date-fallback':left=new Date(10);right=new Date(10);break;case'map-fallback':left=new Map([['x',{v:2}]]);right=new Map([['x',{v:2}]]);break;case'deep-dag':{const shared={z:3};left={x:shared,y:{x:shared},z:{y:{x:shared}}};right={x:{z:3},y:{x:{z:3}},z:{y:{x:{z:3}}}};break;}
}
return {...s,left,right};});
const results=[];
for(const [name,make]of factories)for(const operation of ['graph','copy','equal']){
 const observations=[];
 for(const [label,testSource]of [['original',original],['candidate',source]]){const s=make(),events=[],api=load(testSource,events);let result,error;try{const raw=operation==='equal'?api.equal(s.left,s.right):api[operation](s.left);result=operation==='equal'?raw:operation==='graph'?graphDescription(raw):describe(raw);}catch(e){error={name:e.name,message:e.message}}observations.push({result,error,events,trace:s.trace,getterCalls:s.getCalls()});}
 assert.deepEqual(observations[1],observations[0],name+':'+operation);if(operation==='equal'){assert.equal(observations[1].getterCalls,0);if(name==='paired-v2-false-to-true-counterexample')assert.equal(observations[1].result,false);if(name==='two-throwing-proxy-order')assert.deepEqual(observations[1].error,{name:'TypeError',message:'LEFT_TRAP'});}results.push({caseId:name+':'+operation,equivalent:true,result:observations[1].result??null,error:observations[1].error??null,traceCount:observations[1].trace.length,cloneFallback:observations[1].events.length});
}
return {passed:true,sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),referenceStoreSha256:'aec7fc8dc313cf5fe9dec966879426017e5fd272210219821f9b6a6e113cf14b',freshFixturesPerImplementation:true,caseCount:results.length,cases:results,boundary:'Extracted actual private graph validator/copy/equality functions with fresh synthetic graphs and proxy inspection traps. Original reflection order, captured values, alias topology, fallback and fixed false/throw counterexamples; no browser or storage-admission proof.'};
}

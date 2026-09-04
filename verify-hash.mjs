import fs from 'node:fs';
import vm from 'node:vm';
vm.runInThisContext(fs.readFileSync('hash.js','utf8'),{filename:'hash.js'});
const h=globalThis.closedLoopHash;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const reject=(name,make)=>{let ok=false;try{h.stableStringify(make());}catch(e){ok=e instanceof TypeError;}assert(ok,`${name} must be rejected.`);};
assert(h.sha256Text('')==='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855','empty SHA-256 vector failed');
assert(h.sha256Text('abc')==='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad','abc SHA-256 vector failed');
assert(h.canonicalizationVersion==='closed-loop-canonical-json/1','canonicalization version is not controlling /1');
assert(h.stableStringify({b:1,a:2})===h.stableStringify({a:2,b:1}),'object key ordering is not canonical');
const bmp='\uE000',astral='\u{10000}';
assert(h.stableStringify({[bmp]:1,[astral]:2})===`{"${bmp}":1,"${astral}":2}`,'object keys are not sorted by unsigned Unicode scalar value');
assert(h.stableStringify({x:Number.MAX_SAFE_INTEGER})===`{"x":${Number.MAX_SAFE_INTEGER}}`,'maximum safe integer was not preserved exactly');
assert(h.stableStringify({x:Number.MIN_SAFE_INTEGER})===`{"x":${Number.MIN_SAFE_INTEGER}}`,'minimum safe integer was not preserved exactly');
for(const [name,make] of [
 ['Infinity',()=>({x:Infinity})],['NaN',()=>({x:NaN})],['negative Infinity',()=>({x:-Infinity})],['negative zero',()=>({x:-0})],['fraction',()=>({x:1.25})],['unsafe positive integer',()=>({x:Number.MAX_SAFE_INTEGER+1})],['unsafe negative integer',()=>({x:Number.MIN_SAFE_INTEGER-1})],['unpaired high surrogate',()=>({x:'\uD800'})],['unpaired low surrogate',()=>({x:'\uDC00'})],['unpaired surrogate key',()=>({['\uD800']:1})],['undefined member',()=>({x:undefined})],['undefined array member',()=>[undefined]],['undefined root',()=>undefined],['bigint',()=>({x:1n})],['function',()=>({x(){}})],['symbol value',()=>({x:Symbol('x')})],['symbol key',()=>{const x={};x[Symbol('x')]=1;return x;}],['Date',()=>new Date(0)],['Map',()=>new Map([['x',1]])],['Set',()=>new Set([1])],['sparse array',()=>{const x=[];x.length=1;return x;}],['array property',()=>{const x=[1];x.extra=2;return x;}],['accessor',()=>{const x={};Object.defineProperty(x,'a',{enumerable:true,get(){return 1;}});return x;}],['cycle',()=>{const x={};x.self=x;return x;}]
])reject(name,make);

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','test-worker.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'].filter(file=>file!=='test-worker.js');
const html=fs.readFileSync('index.html','utf8');
const scriptSources=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
assert(scriptSources.length===runtimeFiles.length,`Expected ${runtimeFiles.length} direct deferred runtime scripts; found ${scriptSources.length}.`);
let sharedBuildIdentity=null;
scriptSources.forEach((source,index)=>{
 const [file,query='']=source.split('?');
 assert(file===runtimeFiles[index],`Runtime script order mismatch at ${runtimeFiles[index]}.`);
 const token=new URLSearchParams(query).get('v');
 assert(typeof token==='string'&&token.trim(),`${file} is missing the shared runtime build identity.`);
 if(sharedBuildIdentity===null)sharedBuildIdentity=token;
 assert(token===sharedBuildIdentity,`${file} cache token ${token} differs from shared runtime identity ${sharedBuildIdentity}.`);
});
const testRuntime=fs.readFileSync('test-runtime.js','utf8');
assert(testRuntime.includes("url.searchParams.set('v',runtimeBuildIdentity())"),'Test IR worker URL must use the exact injected test-runtime.js build identity.');
assert(testRuntime.includes("new URL('test-worker.js',base)"),'Test IR worker must remain the same-origin registered worker entry.');
const appCore=fs.readFileSync('app-core.js','utf8');
assert(/function\s+artifactControlMarkup\s*\(\s*n\s*,\s*locked\s*\)\s*\{\s*if\s*\(\s*n\s*===\s*19\s*\)/.test(appCore),'Artifact controls must retain the established Stage 19 unchanged-candidate boundary; whitespace or formatting changes must not alter the invariant.');
assert(!/function\s+artifactControlMarkup\s*\(\s*n\s*,\s*locked\s*\)\s*\{[\s\S]{0,500}?if\s*\(\s*n\s*===\s*4\s*\)\s*return\s*['"]{2}\s*;/.test(appCore),'Stage 04 visual controls must not be hidden as a substitute for canonical intent reuse.');

console.log(JSON.stringify({sha256Vectors:true,canonicalOrdering:true,unicodeScalarOrdering:true,safeIntegerBoundaries:true,ambiguousValuesRejected:24,sharedBuildIdentity,runtimeScriptCount:runtimeFiles.length,workerSharesBuildIdentity:true,stage04RepeatAttachmentControlAbsent:true}));

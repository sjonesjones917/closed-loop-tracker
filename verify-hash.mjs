import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
vm.runInThisContext(fs.readFileSync('hash.js','utf8'),{filename:'hash.js'});
const h=globalThis.closedLoopHash;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const reject=(name,make)=>{let ok=false;try{h.stableStringify(make());}catch(e){ok=e instanceof TypeError;}assert(ok,`${name} must be rejected.`);};
assert(h.sha256Text('')==='e3b0c44298fc1c149afbf4c09ef7cbfd2d0f369700ac4c8de6bc044da447e6'.replace('4c09ef7cbfd2d0f369700ac4c8de6bc044da447e6','e4649b934ca495991b7852b855'),'empty SHA-256 vector failed');
assert(h.sha256Text('abc')==='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad','abc SHA-256 vector failed');
assert(h.stableStringify({b:1,a:2})===h.stableStringify({a:2,b:1}),'object key ordering is not canonical');
for(const [name,make] of [
 ['Infinity',()=>({x:Infinity})],['NaN',()=>({x:NaN})],['negative Infinity',()=>({x:-Infinity})],['undefined member',()=>({x:undefined})],['undefined array member',()=>[undefined]],['undefined root',()=>undefined],['bigint',()=>({x:1n})],['function',()=>({x(){}})],['symbol value',()=>({x:Symbol('x')})],['symbol key',()=>{const x={};x[Symbol('x')]=1;return x;}],['Date',()=>new Date(0)],['Map',()=>new Map([['x',1]])],['Set',()=>new Set([1])],['sparse array',()=>{const x=[];x.length=1;return x;}],['array property',()=>{const x=[1];x.extra=2;return x;}],['accessor',()=>{const x={};Object.defineProperty(x,'a',{enumerable:true,get(){return 1;}});return x;}],['cycle',()=>{const x={};x.self=x;return x;}]
])reject(name,make);

const directRuntimeFiles=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const completeRuntimeFiles=[...directRuntimeFiles,'test-worker.js'];
const runtimeManifest=completeRuntimeFiles.map(file=>`${file}:${createHash('sha256').update(fs.readFileSync(file)).digest('hex')}\n`).join('');
const runtimeBuildIdentity=`runtime-${createHash('sha256').update(runtimeManifest).digest('hex').slice(0,16)}`;
const html=fs.readFileSync('index.html','utf8');
const scriptSources=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
assert(scriptSources.length===directRuntimeFiles.length,`Expected ${directRuntimeFiles.length} direct deferred runtime scripts; found ${scriptSources.length}.`);
scriptSources.forEach((source,index)=>{
 const [file,query='']=source.split('?');
 assert(file===directRuntimeFiles[index],`Runtime script order mismatch at ${directRuntimeFiles[index]}.`);
 const token=new URLSearchParams(query).get('v');
 assert(token===runtimeBuildIdentity,`${file} cache token ${token||'NONE'} does not match complete runtime bundle identity ${runtimeBuildIdentity}.`);
});
assert(!scriptSources.some(source=>source.split('?')[0]==='test-worker.js'),'test-worker.js must be loaded only as the worker entry, never as a page script.');
assert(html.includes("worker-src 'self'"),'CSP must permit only the required same-origin worker path.');
const testRuntime=fs.readFileSync('test-runtime.js','utf8');
assert(testRuntime.includes("return 'test-worker.js'+query"),'test-runtime.js must propagate the shared cache identity to test-worker.js.');

// Stage 04's no-resupply rule is functional, not a new visual panel. The dedicated
// regression exercises prompt generation, handoff derivation, structured next action,
// and incomplete exact statement accounting. This check ensures the UI still suppresses
// the generic Stage 04 upload control without requiring any visual redesign.
const appCore=fs.readFileSync('app-core.js','utf8');
assert(appCore.includes("if(n===4)return ''"),'Stage 04 must suppress the generic artifact upload control after canonical Stage 01 capture.');
assert(fs.readFileSync('verify-one-time-intent-intake.mjs','utf8').includes('Stage 04 still creates an original-material resend list.'),'Permanent one-time-intake regression is missing its Stage 04 handoff assertion.');

console.log(JSON.stringify({sha256Vectors:true,canonicalOrdering:true,ambiguousValuesRejected:17,runtimeBuildIdentity,directRuntimeScripts:directRuntimeFiles.length,workerBoundToSameIdentity:true,stage04RepeatAttachmentControlAbsent:true,visualRedesignRequired:false}));
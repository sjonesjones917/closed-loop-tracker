import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
vm.runInThisContext(fs.readFileSync('hash.js','utf8'),{filename:'hash.js'});
const h=globalThis.closedLoopHash;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const reject=(name,make)=>{let ok=false;try{h.stableStringify(make());}catch(e){ok=e instanceof TypeError;}assert(ok,`${name} must be rejected.`);};
assert(h.sha256Text('')==='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855','empty SHA-256 vector failed');
assert(h.sha256Text('abc')==='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad','abc SHA-256 vector failed');
assert(h.stableStringify({b:1,a:2})===h.stableStringify({a:2,b:1}),'object key ordering is not canonical');
for(const [name,make] of [
 ['Infinity',()=>({x:Infinity})],['NaN',()=>({x:NaN})],['negative Infinity',()=>({x:-Infinity})],['undefined member',()=>({x:undefined})],['undefined array member',()=>[undefined]],['undefined root',()=>undefined],['bigint',()=>({x:1n})],['function',()=>({x(){}})],['symbol value',()=>({x:Symbol('x')})],['symbol key',()=>{const x={};x[Symbol('x')]=1;return x;}],['Date',()=>new Date(0)],['Map',()=>new Map([['x',1]])],['Set',()=>new Set([1])],['sparse array',()=>{const x=[];x.length=1;return x;}],['array property',()=>{const x=[1];x.extra=2;return x;}],['accessor',()=>{const x={};Object.defineProperty(x,'a',{enumerable:true,get(){return 1;}});return x;}],['cycle',()=>{const x={};x.self=x;return x;}]
])reject(name,make);

const directRuntimeFiles=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const runtimeGraphFiles=[...directRuntimeFiles,'test-worker.js'];
const gitBlobSha=file=>{
 const bytes=fs.readFileSync(file);
 return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};
const runtimeManifest=runtimeGraphFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const runtimeBuildIdentity=`runtime-${createHash('sha256').update(runtimeManifest).digest('hex').slice(0,16)}`;
const html=fs.readFileSync('index.html','utf8');
const scriptSources=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
assert(scriptSources.length===directRuntimeFiles.length,`Expected ${directRuntimeFiles.length} direct deferred runtime scripts; found ${scriptSources.length}.`);
scriptSources.forEach((source,index)=>{
 const [file,query='']=source.split('?');
 assert(file===directRuntimeFiles[index],`Runtime script order mismatch at ${directRuntimeFiles[index]}.`);
 const token=new URLSearchParams(query).get('v');
 assert(token===runtimeBuildIdentity,`${file} cache token ${token||'NONE'} does not match runtime graph identity ${runtimeBuildIdentity}.`);
});
const runtimeSource=fs.readFileSync('test-runtime.js','utf8');
const workerSource=fs.readFileSync('test-worker.js','utf8');
assert(runtimeSource.includes('new Worker(`test-worker.js${BUILD_QUERY}`)'),'Worker URL must inherit the exact runtime build query.');
assert(workerSource.includes("const runtimeQuery=self.location?.search||'';")&&workerSource.includes('importScripts(`test-runtime.js${runtimeQuery}`)'),'Worker runtime import must inherit the exact worker build query.');
const appCore=fs.readFileSync('app-core.js','utf8');
assert(appCore.includes("function artifactControlMarkup(n,locked){if(n===4)return '';if(n===19)"),'Stage 04 must not render the generic artifact upload control after canonical intent capture.');
assert(appCore.includes("if([2,3,4].includes(stage))throw new Error('The original Stage 01 intent file cannot be registered or reused in Stages 02 through 04; use the canonical intentStatements ledger.')"),'Stages 02 through 04 must reject reuse of the original Stage 01 intent file.');

console.log(JSON.stringify({sha256Vectors:true,canonicalOrdering:true,ambiguousValuesRejected:17,runtimeBuildIdentity,runtimeGraphFiles,stage04RepeatAttachmentControlAbsent:true}));
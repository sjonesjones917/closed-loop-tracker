import fs from 'node:fs';
import vm from 'node:vm';
import {createVerifierRuntime} from './verifier-runtime.mjs';

// The existing lifecycle suite's transaction adapter, extracted for recovery
// regressions. This is explicitly not a browser or an IndexedDB implementation.
export function projectStoreRuntime({fault=null,sourceOverrides={}}={}){
 const rows=new Map();
 const runtime=createVerifierRuntime({Blob,Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,ReadableStream,CompressionStream,DecompressionStream,Response,crypto:globalThis.crypto,btoa,atob,setTimeout,clearTimeout,queueMicrotask,console,Event:class Event{},dispatchEvent(){}});
 const parse=vm.runInContext('(text)=>JSON.parse(text)',runtime);
 // Preserve undefined properties and shared references just as structured clone
 // does. JSON cloning would hide invalid durable-view fields in these tests.
 const copy=value=>{const seen=new Map();const visit=item=>{if(item===null||typeof item!=='object'||item instanceof Blob)return item;if(seen.has(item))return seen.get(item);const result=parse(Array.isArray(item)?'[]':'{}');seen.set(item,result);for(const key of Object.keys(item))result[key]=visit(item[key]);return result;};return visit(value);};
 runtime.structuredClone=copy;
 runtime.openStorageTransaction=async(names,mode)=>{
  const selected=Array.isArray(names)?names:[names],pending=new Map(selected.map(name=>[name,new Map([...(rows.get(name)||[])].map(([key,value])=>[key,copy(value)]))]));let aborted=false;
  return {objectStore:name=>({get:key=>({result:copy(pending.get(name).get(key))}),getAll:()=>({result:[...pending.get(name).values()].map(copy)}),index:index=>({getAll:key=>({result:[...pending.get(name).values()].filter(row=>String(row[index])===String(key)).map(copy)}),openKeyCursor:()=>{const keys=[...pending.get(name).values()].map(row=>row[index]).filter(Boolean),request={};let i=0;const advance=()=>{request.result=i<keys.length?{key:keys[i++],continue:()=>queueMicrotask(advance)}:null;request.onsuccess?.();};queueMicrotask(advance);return request;}}),count:()=>({result:pending.get(name).size}),put:row=>pending.get(name).set(name==='projects'?row.jobId:name==='artifacts'?row.artifactId:row.key,copy(row)),delete:key=>pending.get(name).delete(key)}),commit(){if(aborted)throw new Error('Transaction aborted.');if(mode==='readwrite')for(const [name,data] of pending)rows.set(name,data);},abort(){aborted=true;}};
 };
 for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js']){
  let source=sourceOverrides[file]??fs.readFileSync(file,'utf8');
  if(typeof source!=='string')throw new TypeError('A runtime source override must contain exact source text: '+file);
  if(file==='project-store.js')source=source.replace(/const request=req=>[^\n]+/,'const request=req=>Promise.resolve(req.result);').replace(/const complete=tx=>[^\n]+/,'const complete=async tx=>tx.commit();').replace(/async function openTransaction\([\s\S]*?\n}\n/,'async function openTransaction(stores,mode="readonly"){return openStorageTransaction(stores,mode);}\n');
  if(fault?.file===file){if(!source.includes(fault.before))throw new Error('Fault anchor missing: '+fault.id);source=source.replace(fault.before,fault.after);}
  vm.runInContext(source,runtime,{filename:file});
 }
 return {runtime,rows,copy,store:runtime.closedLoopProjectStore,engine:runtime.closedLoopWorkflowEngine,core:runtime.closedLoopCore,ingestion:runtime.closedLoopResponseIngestion,prompts:runtime.closedLoopPromptEngine};
}

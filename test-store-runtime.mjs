import fs from 'node:fs';
import vm from 'node:vm';

// Transaction I/O double for deterministic fault exploration. Production
// serialization, integrity checks, history and mutation owners remain intact.
// Browser tests separately exercise actual IndexedDB scheduling and durability.
export function storeRuntime({sourceFault=null}={}){
  const rows=new Map(),runtime=vm.createContext({Blob,Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,ReadableStream,CompressionStream,DecompressionStream,Response,crypto:globalThis.crypto,btoa,atob,setTimeout,Event:class{},dispatchEvent:()=>true});
  const parse=vm.runInContext('text=>JSON.parse(text)',runtime);
  const copy=value=>{
    if(value===undefined)return value;const blobs=[];
    const result=parse(JSON.stringify(value,(_key,item)=>item instanceof Blob?{__blob:blobs.push(item)-1}:item));
    const restore=item=>{if(item&&typeof item==='object'){if(Object.keys(item).length===1&&Number.isInteger(item.__blob))return blobs[item.__blob];for(const key of Object.keys(item))item[key]=restore(item[key]);}return item;};return restore(result);
  };
  let tail=Promise.resolve();
  runtime.openStorageTransaction=async(names,mode)=>{
    const prior=tail;let release;tail=new Promise(resolve=>release=resolve);await prior;
    const selected=Array.isArray(names)?names:[names],pending=new Map(selected.map(name=>[name,new Map(rows.get(name)||[])]));let closed=false;
    const finish=commit=>{if(closed)return;closed=true;if(commit&&mode==='readwrite')for(const [name,data] of pending)rows.set(name,data);release();};
    return {objectStore:name=>{
      const data=pending.get(name);if(!data)throw new Error('Store outside transaction: '+name);
      return {get:key=>({result:copy(data.get(key))}),getAll:()=>({result:[...data.values()].map(copy)}),getAllKeys:()=>({result:[...data.keys()]}),count:()=>({result:data.size}),
        put:row=>data.set(name==='projects'?row.jobId:name==='artifacts'?row.artifactId:row.key,copy(row)),delete:key=>data.delete(key),
        index:key=>({getAll:value=>({result:[...data.values()].filter(row=>String(row[key])===String(value)).map(copy)})})};
    },commit:()=>finish(true),abort:()=>finish(false)};
  };
  for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js']){
    let source=fs.readFileSync(new URL(file,import.meta.url),'utf8');
    if(sourceFault?.file===file){if(!source.includes(sourceFault.before))throw new Error('Fault target missing');source=source.replace(sourceFault.before,sourceFault.after);}
    if(file==='project-store.js')source=source.replace(/const request=req=>[^\n]+/,'const request=req=>Promise.resolve(req.result);').replace(/const complete=tx=>[^\n]+/,'const complete=async tx=>tx.commit();').replace(/async function openTransaction\([\s\S]*?\n}\n/,'async function openTransaction(stores,mode="readonly"){return openStorageTransaction(stores,mode);}\n');
    vm.runInContext(source,runtime,{filename:file});
  }
  return {runtime,rows,copy,core:runtime.closedLoopCore,engine:runtime.closedLoopWorkflowEngine,schema:runtime.closedLoopWorkflowSchema,prompts:runtime.closedLoopPromptEngine,ingestion:runtime.closedLoopResponseIngestion,hash:runtime.closedLoopHash,store:runtime.closedLoopProjectStore};
}

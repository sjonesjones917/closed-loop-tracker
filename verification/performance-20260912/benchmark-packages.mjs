import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import v8 from 'node:v8';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';

const repo=path.resolve(process.argv[2]||'.'),output=path.resolve(process.argv[3]||'verification/performance-20260912/packages-after.json');
globalThis.dispatchEvent=()=>true;
for(const name of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(path.join(repo,name),'utf8'),{filename:name});
// Substitute only export storage reads/writes. Import is the complete production
// pre-transaction path and stops at its existing fault-injection boundary.
const source=fs.readFileSync(path.join(repo,'project-store.js'),'utf8');
vm.runInThisContext(source.replace('globalThis.closedLoopProjectStore=',"readProject=async()=>globalThis.diagnosticProject;listArtifacts=async()=>globalThis.diagnosticArtifacts;metaPut=async()=>{};globalThis.closedLoopProjectStore="),{filename:'project-store.js'});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,store=globalThis.closedLoopProjectStore;
const results={date:new Date().toISOString(),node:process.version,note:'Production package CPU/stream code with export storage I/O substituted. Import stops before the real IndexedDB transaction. Synthetic data only. V8 heap snapshots and timer gaps are not physical-iPhone peak memory or frame measurements.',cases:[]};
const nativeParse=JSON.parse,nativeText=Response.prototype.text;
let probes=[];
async function timed(fn){
  globalThis.gc?.();probes=[];
  let last=performance.now(),maxTimerGapMs=0;const gaps=[];
  const timer=setInterval(()=>{const t=performance.now(),gap=t-last;maxTimerGapMs=Math.max(maxTimerGapMs,gap);gaps.push(gap);last=t;},1);
  await new Promise(resolve=>setTimeout(resolve,1));
  const heapBefore=v8.getHeapStatistics().used_heap_size,start=performance.now();
  const value=await fn(),elapsedMs=performance.now()-start,heapAtReturn=v8.getHeapStatistics().used_heap_size;
  await new Promise(resolve=>setTimeout(resolve,5));clearInterval(timer);
  return {value,evidence:{elapsedMs,maxTimerGapMs,heapBefore,heapAtReturn,probes:[...probes]}};
}
JSON.parse=function(text,...args){const start=performance.now(),result=nativeParse(text,...args);if(typeof text==='string'&&text.length>=1000000)probes.push({operation:'JSON.parse',characters:text.length,elapsedMs:performance.now()-start,heapAfter:v8.getHeapStatistics().used_heap_size});return result;};
Response.prototype.text=async function(){const t=performance.now(),result=await nativeText.call(this);if(result.length>=1000000)probes.push({operation:'Response.text',characters:result.length,elapsedMs:performance.now()-t,heapAfter:v8.getHeapStatistics().used_heap_size});return result;};
try{
  for(const [count,artifactBytes] of [[25,0],[600,0],[25,8*1024*1024]]){
    const p=core.createBlankState('DIAGNOSTIC-PACKAGE');
    p.projectData.rawResponses=Array.from({length:count},(_,i)=>({rawResponseId:'RAW-PRESSURE-'+i,stage:i%30+1,status:'PRESERVED',rawText:'H'.repeat(80000)+'é🙂TAIL-'+i}));
    engine.ensureShape(p);engine.recalculate(p);
    if(!store.validateProjectIntegrity(p).valid)throw new Error('Synthetic project failed production integrity');
    globalThis.diagnosticProject=p;globalThis.diagnosticArtifacts=[];
    if(artifactBytes){
      const bytes=new Uint8Array(artifactBytes);let seed=123456789;for(let i=0;i<bytes.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;bytes[i]=seed&255;}
      globalThis.diagnosticArtifacts=[{artifactId:'DIAGNOSTIC-FILE',jobId:p.job.JOB_ID,filename:'diagnostic.bin',mediaType:'application/octet-stream',byteSize:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),lineage:{},createdAt:'2026-09-12T00:00:00.000Z',blob:new Blob([bytes])}];
    }
    const row={historyRecords:count,projectJsonUtf8Bytes:Buffer.byteLength(JSON.stringify(p)),artifactBytes,exports:[],importsBeforeTransaction:[]};
    for(let run=0;run<3;run++){
      globalThis.__closedLoopStorageFault=null;
      const exported=await timed(()=>store.exportPackage(p.job.JOB_ID));row.compressedPackageBytes=exported.value.size;row.exports.push(exported.evidence);
      globalThis.__closedLoopStorageFault='before-import-transaction';
      const imported=await timed(async()=>{try{await store.importPackage(exported.value);throw new Error('Expected pre-transaction stop');}catch(e){if(e.code!=='INJECTED_STORAGE_FAILURE')throw e;return 'All production pre-transaction verification completed';}});
      row.importsBeforeTransaction.push(imported.evidence);globalThis.__closedLoopStorageFault=null;
    }
    results.cases.push(row);fs.writeFileSync(output,JSON.stringify(results,null,2));
    console.log(JSON.stringify({historyRecords:count,artifactBytes,compressedPackageBytes:row.compressedPackageBytes,exportMs:row.exports.map(x=>x.elapsedMs),importPreTransactionMs:row.importsBeforeTransaction.map(x=>x.elapsedMs),importMaxTimerGaps:row.importsBeforeTransaction.map(x=>x.maxTimerGapMs)}));
  }
}finally{JSON.parse=nativeParse;Response.prototype.text=nativeText;globalThis.__closedLoopStorageFault=null;}
results.maxRssKiB=process.resourceUsage().maxRSS;fs.writeFileSync(output,JSON.stringify(results,null,2));

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createVerifierRuntime} from './verifier-runtime.mjs';

export async function verifyHistorySmallPartAllocation({source=fs.readFileSync(new URL('./project-store.js',import.meta.url),'utf8')}={}){
 const begin='async function encodeHistoryProject(',end='// Receipt keys are actual immutable Blob objects';
 assert.equal(source.split(begin).length,2);assert.equal(source.split(end).length,2);
 const actual=source.slice(source.indexOf(begin),source.indexOf(end));
 const guard=`      const chunks=[...hash.canonicalChunks(value)];
      // UTF-8 uses at most three bytes per UTF-16 code unit. Avoid allocating
      // a Blob for a canonical value that cannot reach the existing threshold.
      // Ambiguous/non-string chunks still take the exact Blob-size path.
      let upperBytes=0;for(const chunk of chunks){if(typeof chunk!=='string'){upperBytes=Infinity;break;}upperBytes+=chunk.length*3;}
      if(upperBytes<4096)return false;
      const blob=new Blob(chunks,{type:'application/json'});if(blob.size<4096)return false;`;
 assert.equal(actual.split(guard).length,2,'SMALL_PART_GUARD_UNIQUE');
 const original=actual.replace(guard,"      const blob=new Blob([...hash.canonicalChunks(value)],{type:'application/json'});if(blob.size<4096)return false;");
 const runtime=createVerifierRuntime({Object,Array,TextEncoder,TextDecoder,Blob,Uint8Array,ArrayBuffer,console});vm.runInContext(fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8'),runtime);
 const hash=runtime.closedLoopHash,sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 async function observe(text,value,authority=hash){
  let allocations=0,smallAllocations=0;const retained=[];
  class CountedBlob extends Blob{constructor(parts,options){super(parts,options);allocations++;if(this.size<4096)smallAllocations++;}}
  const encode=new Function('hash','Blob','HISTORY_PROJECT_PARTS',text+';return encodeHistoryProject;')(authority,CountedBlob,'closed-loop-history-project-parts/1');
  try{const result=await encode(value,async(digest,blob)=>{const bytes=Buffer.from(await blob.arrayBuffer());assert.equal(sha(bytes),digest,'SMALL_PART_RETAINED_DIGEST');retained.push({digest,size:blob.size,bytes:bytes.toString('base64')});});return {result,retained,allocations,smallAllocations};}
  catch(error){return {error:{name:error.name,message:error.message},allocations,smallAllocations};}
 }
 const cases=[],fixtures=[['small-records',()=>({projectData:{records:Array.from({length:200},(_,i)=>({id:i,value:'ordinary value'}))}})]],threshold=4096;
 for(const n of [threshold-1,threshold,threshold+1])fixtures.push(['ascii-bytes-'+n,()=>({records:[{text:'x'.repeat(n-11)}]})]);
 for(const value of ['\u0800'.repeat(1361),'\u0800'.repeat(1362),'\u0800'.repeat(1365),'\u0800'.repeat(1366),'😀'.repeat(1024),'"\\\n'.repeat(1000),'x'.repeat(20000)])fixtures.push(['unicode-or-escaped-'+fixtures.length,()=>({records:[{text:value},{text:value}]})]);
 fixtures.push(['shared-large-string',()=>({records:[{text:'x'.repeat(8192)},{text:'x'.repeat(8192)}]})],['null-prototype',()=>({records:[Object.assign(Object.create(null),{x:1})]})],['lone-surrogate',()=>({records:[{text:'\ud800'.repeat(4096)}]})]);
 let avoided=0;
 for(const [name,make] of fixtures){const before=await observe(original,make()),after=await observe(actual,make());if(name==='lone-surrogate')assert.equal(before.error?.name,'TypeError');else assert.equal(before.error,undefined,'SMALL_PART_HEALTHY:'+name);assert.deepEqual(after.error,before.error,'SMALL_PART_ERROR_SEMANTICS:'+name);assert.deepEqual(after.result,before.result,'SMALL_PART_STRUCTURE:'+name);assert.deepEqual(after.retained,before.retained,'SMALL_PART_EXACT_BYTES:'+name);assert.ok(after.allocations<=before.allocations,'SMALL_PART_ALLOCATION_REGRESSION:'+name);avoided+=before.allocations-after.allocations;cases.push({name,unchanged:true,avoided:before.allocations-after.allocations});}
 assert.ok(avoided>=200,'SMALL_PART_ALLOCATION_ORACLE');
 // Removing the fast path must fail the allocation oracle, while the
 // differential controls above keep every original threshold/byte decision.
 const cold=await observe(original,fixtures[0][1]());assert.ok(cold.smallAllocations>=200);
 for(const [bytes,count] of [[4095,0],[4096,1],[4097,1]]){const observed=await observe(actual,{records:[{text:'x'.repeat(bytes-11)}]});assert.equal(observed.retained.length,count,'SMALL_PART_BYTE_THRESHOLD');if(count)assert.equal(observed.retained[0].size,bytes);}
 const multibyte={records:[{text:'\u0800'.repeat(1362)}]},valid=await observe(actual,multibyte),unsafe=await observe(actual.replace('chunk.length*3','chunk.length*2'),multibyte);assert.equal(valid.retained.length,1);assert.equal(unsafe.retained.length,0,'SMALL_PART_UNSAFE_BOUND_FAULT');
 const byteChunks={...hash,*canonicalChunks(value){for(const chunk of hash.canonicalChunks(value))yield new TextEncoder().encode(chunk);}};
 const byteBefore=await observe(original,multibyte,byteChunks),byteAfter=await observe(actual,multibyte,byteChunks);assert.equal(byteBefore.error,undefined);assert.deepEqual(byteAfter,byteBefore,'SMALL_PART_NONSTRING_FALLBACK');
 return {historySmallPartAllocation:'PASS',synthetic:true,actualBrowser:false,caseCount:cases.length,avoidedAllocations:avoided,baselineSmallAllocations:cold.smallAllocations,exactByteThresholds:true,nonStringFallback:true,unsafeBoundDetected:true,cases};
}

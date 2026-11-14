import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

// Segmented History roots (closed-loop-recovery-project-parts/2), tested
// against the production store over the explicit transaction adapter and
// against independent implementations in this file. Synthetic data; no
// browser or device claim.
const sha=value=>createHash('sha256').update(value).digest('hex');
// Independent canonical JSON for these ASCII-keyed fixtures.
const canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
const bytesOf=text=>Buffer.byteLength(text,'utf8');
const V1='closed-loop-recovery-project-parts/1',V2='closed-loop-recovery-project-parts/2',S=16384;
export const SEGMENTED_V1_ENCODER_SHA256='3f65c3d5b1cef0167864d4737e85f25c77b561efccc04bc125ef70db21b05313';
export const SEGMENTED_V1_PARTS_CHECK_SHA256='a322ab69607f6f7c7afdfa6857227a48a9e254d0a972db8786b6f5ae72022081';
// encodeHistoryProject and assertHistoryProjectParts exactly as they were
// before /2 (commit c7465aed): the /1 byte-identity reference, and a build
// that knows only /1.
const V1_ENCODER=`async function encodeHistoryProject(project,retainValue){
  const entries=[],retainedStrings=new Map();
  // The cold canonical value digest's 16 KiB text batches over the same
  // chunks give the same SHA-256 input bytes. Null for any non-text chunk.
  function retainedChunksSha256(chunks){
    const digest=hash.createSha256();let text='';
    for(const chunk of chunks){if(typeof chunk!=='string')return null;if(text.length+chunk.length>16384){digest.updateText(text);text='';}text+=chunk;}
    if(text)digest.updateText(text);return digest.digest();
  }
  async function visit(value,path=[],arrayItem=false){
    // Stable records and large text are shared across complete versions. The
    // references are disjoint values, never patches against another version.
    // Use the existing recovery byte store and canonical JSON codec only.
    async function retain(){
      // Strings are immutable values. Within this one encoding pass an exact
      // repeated value shares its already encoded and retained byte identity.
      const prior=typeof value==='string'?retainedStrings.get(value):null;
      if(prior){entries.push({path,...prior});return true;}
      const chunks=[...hash.canonicalChunks(value)];
      // UTF-8 uses at most three bytes per UTF-16 code unit. Avoid allocating
      // a Blob for a canonical value that cannot reach the existing threshold.
      // Ambiguous/non-string chunks still take the exact Blob-size path.
      let upperBytes=0;for(const chunk of chunks){if(typeof chunk!=='string'){upperBytes=Infinity;break;}upperBytes+=chunk.length*3;}
      if(upperBytes<4096)return false;
      const blob=new Blob(chunks,{type:'application/json'});if(blob.size<4096)return false;
      // Hash the exact canonical chunks placed in the Blob instead of
      // canonicalizing the value a second time; a non-text chunk keeps the
      // value digest.
      const sha256=retainedChunksSha256(chunks)??hash.sha256Value(value);await retainValue(sha256,blob);const identity={sha256,byteSize:blob.size};entries.push({path,...identity});
      if(typeof value==='string')retainedStrings.set(value,identity);return true;
    }
    if(typeof value==='string'&&value.length>=4096&&await retain())return null;
    if(!value||typeof value!=='object')return value;
    const start=entries.length;
    const result=Array.isArray(value)?[]:{};
    for(const key of Object.keys(value)){const segment=Array.isArray(value)?Number(key):key;Object.defineProperty(result,key,{value:await visit(value[key],[...path,segment],Array.isArray(value)),enumerable:true,writable:true,configurable:true});}
    // Preserve sharing inside changing records first. Never place references
    // inside another stored part or copy their large contents into its parent.
    if(entries.length===start&&!Array.isArray(value)&&(arrayItem||path.length===2)&&await retain())return null;
    return result;
  }
  const packed=await visit(project);
  return {project:packed,...(entries.length?{projectParts:{schema:HISTORY_PROJECT_PARTS,entries}}:{})};
}
`;
const V1_ASSERT_PARTS=`function assertHistoryProjectParts(parts){
  const seen=new Set();
  if(parts?.schema!==HISTORY_PROJECT_PARTS||Object.keys(parts).some(key=>!['schema','entries'].includes(key))||!Array.isArray(parts.entries)||!parts.entries.length)throw storageError('Saved project content references are unsupported.','HISTORY_VERSION_MISMATCH');
  for(const part of parts.entries){
    if(!part||Object.keys(part).some(key=>!['path','sha256','byteSize'].includes(key))||!Array.isArray(part.path)||!part.path.length||part.path.some(key=>typeof key!=='string'&&(!Number.isSafeInteger(key)||key<0))||!/^[a-f0-9]{64}$/.test(part.sha256||'')||!Number.isSafeInteger(part.byteSize)||part.byteSize<=0)throw storageError('Saved project content identity is invalid.','HISTORY_VERSION_MISMATCH');
    const path=JSON.stringify(part.path);if(seen.has(path))throw storageError('Saved project content has duplicate destinations.','HISTORY_VERSION_MISMATCH');seen.add(path);
  }
}
`;

const ENCODER_BEGIN='async function encodeHistoryProject(',ENCODER_END='// Receipt keys are actual immutable Blob objects';
function encoderSlice(source){assert.equal(source.split(ENCODER_BEGIN).length,2);assert.equal(source.split(ENCODER_END).length,2);return source.slice(source.indexOf(ENCODER_BEGIN),source.indexOf(ENCODER_END));}
function hashRuntime(){const runtime=createVerifierRuntime({Object,Array,TextEncoder,TextDecoder,Blob,Uint8Array,ArrayBuffer,console});vm.runInContext(fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8'),runtime);return runtime;}
function hashRealm(){return hashRuntime().closedLoopHash;}
function encoderOf(text,hash,max=65536){return new Function('hash','Blob','HISTORY_PROJECT_PARTS','HISTORY_PROJECT_PARTS_SEGMENTED','HISTORY_SEGMENTS_MAX',text+';return encodeHistoryProject;')(hash,Blob,V1,V2,max);}
async function encode(encoder,value){
 const retained=[];
 const result=await encoder(structuredClone(value),async(digest,blob)=>{const bytes=Buffer.from(await blob.arrayBuffer());assert.equal(sha(bytes),digest,'SEGMENTED_RETAINED_DIGEST_ORACLE');retained.push({digest,size:blob.size,text:bytes.toString('utf8')});});
 return {result:JSON.parse(JSON.stringify(result)),retained};
}
// The reference segmentation rule, written from its specification.
function fnv1a(bytes){let h=0x811c9dc5;for(const byte of bytes){h=(h^byte)>>>0;h=Math.imul(h,0x01000193)>>>0;}return h;}
// A hash boundary needs S/4 bytes in the segment; at most max segments, the
// last holding every remaining item.
function referenceSegments(texts,max=65536){
 const segments=[];let open=[],size=0;
 const close=()=>{if(!open.length)return;const text='['+open.join(',')+']';segments.push({sha256:sha(text),byteSize:bytesOf(text),count:open.length,text});open=[];size=0;};
 const closable=()=>segments.length<max-1;
 for(const text of texts){
  const n=bytesOf(text);
  if(n>=S&&closable()){close();if(closable()){open.push(text);close();continue;}}
  size+=n+(open.length?1:0);open.push(text);
  if(closable()&&(size+2>=S/4&&fnv1a(Buffer.from(text,'utf8'))/2**32<n/S||size+2>=4*S))close();
 }
 close();return segments;
}
// Expected /2 entries of one segmented array: long strings become nulls and
// value entries with absolute paths after the segments entry.
function referenceArrayEntries(array,path,strings=new Map(),max=65536){
 const local=[];
 const pack=(value,at)=>{if(typeof value==='string'&&value.length>=4096){const text=JSON.stringify(value);local.push({path:at,sha256:sha(text),byteSize:bytesOf(text)});strings.set(value,true);return null;}if(!value||typeof value!=='object')return value;if(Array.isArray(value))return value.map((item,index)=>pack(item,[...at,index]));return Object.fromEntries(Object.keys(value).map(key=>[key,pack(value[key],[...at,key])]));};
 const texts=array.map((item,index)=>canonical(pack(item,[...path,index]))),whole='['+texts.join(',')+']',segments=referenceSegments(texts,max);
 return {entry:{path,sha256:sha(whole),byteSize:bytesOf(whole),segments:segments.map(({sha256,byteSize,count})=>({sha256,byteSize,count}))},local,segments};
}
const record=(i,extra='')=>({id:'REC-'+String(i).padStart(5,'0'),kind:i%7?'ordinary':'receipt',text:'Synthetic record '+i+' '+'.'.repeat((i*37)%113)+extra});
// Items of exact canonical sizes: one whose FNV-1a32 never closes a segment
// (quiet) and one whose FNV-1a32 always does (closer). {"t":"..."} is 8 bytes
// plus its ASCII text.
const closesByHash=text=>fnv1a(Buffer.from(text,'utf8'))/2**32<bytesOf(text)/S;
function sizedItem(size,seed,closer){for(let i=0;;i++){const head=seed+'-'+i+'-',item={t:head+'x'.repeat(size-8-head.length)};if(bytesOf(canonical(item))!==size)throw new Error('sized item');if(closesByHash(canonical(item))===closer)return item;}}
// An array whose first open segment reaches exactly `bytes` canonical bytes
// (brackets included) at its last item, then two quiet items.
function sizedPrefix(bytes,last,seed){
 const items=[];let size=-1;while(size+1+100+1+2+last.size+2<=bytes-120){items.push(sizedItem(100,seed+items.length,false));size+=101;}
 const fill=bytes-2-(size+1)-1-last.size;items.push(sizedItem(fill,seed+'fill',false));size+=fill+1;items.push(sizedItem(last.size,seed+'last',last.closer));size+=last.size+1;
 assert.equal(size+2,bytes,'SEGMENTED_SIZED_FIXTURE');return [...items,sizedItem(100,seed+'tail0',false),sizedItem(100,seed+'tail1',false)];
}
// Small canonical items whose FNV-1a32 closes a segment on its own.
const closerOf=make=>{for(let i=0;;i++){const value=make(i);if(closesByHash(canonical(value)))return value;}};

async function encoderCases(source,blank){
 const hash=hashRealm(),cases=[],actual=encoderOf(encoderSlice(source),hash),frozen=encoderOf(V1_ENCODER,hash);
 assert.equal(sha(V1_ENCODER),SEGMENTED_V1_ENCODER_SHA256,'SEGMENTED_V1_REFERENCE_ORACLE: the frozen /1 encoder is the pre-/2 text');
 // 1. Byte identity of /1: no array of 4096 or more bytes in the skeleton.
 const noArray=[
  ['keyed-records',{projectData:Object.fromEntries(Array.from({length:120},(_,i)=>['r'+i,record(i)]))}],
  ['small-arrays',{projectData:{small:[1,2,3],list:Array.from({length:60},(_,i)=>'v'+i),nested:{items:Array.from({length:40},(_,i)=>({i}))}}}],
  ['array-4095-bytes',{projectData:{list:['x'.repeat(4095-4)]}}],
  ['arrays-inside-object-part',{projectData:{rec:{list:Array.from({length:300},(_,i)=>'item '+i)}}}],
  ['object-over-64k-small-arrays',{projectData:{huge:Object.fromEntries(Array.from({length:30},(_,i)=>['a'+i,Array.from({length:200},(_,j)=>'value '+i+'-'+j)]))}}],
  ['long-strings',{job:{text:'x'.repeat(9000),again:'x'.repeat(9000)},projectData:{note:{text:'ࠀ'.repeat(1400)},list:['short',{deep:'y'.repeat(3000)}]}}]
 ];
 noArray.push(['blank-project',blank]);
 for(const [name,value] of noArray){
  const a=await encode(actual,value),b=await encode(frozen,value);
  assert.notEqual(a.result.projectParts?.schema,V2,'SEGMENTED_V1_SELECTION_ORACLE '+name);
  assert.deepEqual(a,b,'SEGMENTED_V1_BYTE_IDENTITY_ORACLE: '+name+' encodes exactly as before /2');
  cases.push({name:'v1-identity:'+name,parts:b.result.projectParts?.entries.length||0,retained:b.retained.length});
 }
 // The differential detects a change: a qualifying array is /2 and differs.
 {const value={projectData:{list:Array.from({length:300},(_,i)=>record(i))}},a=await encode(actual,value),b=await encode(frozen,value);
  assert.equal(a.result.projectParts.schema,V2);assert.notDeepEqual(a,b,'SEGMENTED_V1_DIFFERENTIAL_CONTROL');cases.push({name:'v1-differential-control'});}
 // 2. The segmentation rule against the reference, with its boundaries.
 let heavy=null;for(let i=0;!heavy;i++){const text=canonical({n:'k'+i});if(fnv1a(Buffer.from(text))/2**32>0.5)heavy={n:'k'+i};}
 const ruled=[
  ['hash-boundaries',Array.from({length:900},(_,i)=>record(i))],
  ['threshold-4096',['x'.repeat(4096-4)]],
  // Exactly S canonical bytes (alone) and S-1 bytes, without a long string.
  ['item-at-target',[record(1),{k0:'z'.repeat(4088),k1:'z'.repeat(4088),k2:'z'.repeat(4088),k3:'z'.repeat(4087)},record(2),{k0:'z'.repeat(4088),k1:'z'.repeat(4088),k2:'z'.repeat(4088),k3:'z'.repeat(4086)},record(3)]],
  ['cap-4S',Array.from({length:7000},()=>heavy)],
  ['in-item-long-strings',Array.from({length:120},(_,i)=>i%10?record(i):{...record(i),body:(i%20?'p':'q').repeat(5000)})],
  // The cap: quiet items whose open segment reaches exactly 4S bytes.
  ['cap-exact',sizedPrefix(4*S,{size:100,closer:false},'cap')],
  // The minimum: a closer reaching exactly S/4 bytes closes; one reaching
  // S/4-1 bytes does not.
  ['minimum-exact',sizedPrefix(S/4,{size:40,closer:true},'min')],
  ['minimum-below',sizedPrefix(S/4-1,{size:40,closer:true},'below')],
  // Repeated small items that close a segment on their own: segments still
  // hold S/4 bytes each, so their count follows the array's bytes.
  ['closer-integers',Array(65537).fill(closerOf(i=>5000+i))],
  ['closer-objects',Array(20000).fill(closerOf(i=>({n:i})))],
  ['closer-strings',Array(20000).fill(closerOf(i=>'id-'+i))]
 ];
 for(const [name,array] of ruled){
  const {result,retained}=await encode(actual,{projectData:{list:array}}),expected=referenceArrayEntries(array,['projectData','list']);
  assert.equal(result.projectParts.schema,V2,'SEGMENTED_RULE_ORACLE '+name);
  assert.equal(result.project.projectData.list,null,'SEGMENTED_DESTINATION_ORACLE '+name);
  const entries=result.projectParts.entries,at=entries.findIndex(entry=>entry.segments);
  assert.deepEqual(entries[at],expected.entry,'SEGMENTED_RULE_ORACLE '+name+': boundaries, counts, sizes and whole-array identity');
  assert.deepEqual(entries.slice(at+1,at+1+expected.local.length),expected.local,'SEGMENTED_NESTED_STRING_ORACLE '+name);
  for(const segment of expected.segments)assert.ok(retained.some(row=>row.digest===segment.sha256&&row.text===segment.text),'SEGMENTED_SEGMENT_BYTES_ORACLE '+name);
  if(name==='threshold-4096'){assert.equal(expected.segments.length,1);assert.equal(expected.entry.byteSize,4096);}
  if(name==='item-at-target')assert.ok(expected.segments.some(segment=>segment.count===1&&segment.byteSize===S+2),'SEGMENTED_TARGET_ALONE_ORACLE');
  if(name==='cap-4S')assert.ok(expected.segments.slice(0,-1).every(segment=>segment.byteSize>=4*S&&segment.byteSize<4*S+64),'SEGMENTED_CAP_ORACLE');
  if(name==='cap-exact')assert.equal(expected.segments[0].byteSize,4*S,'SEGMENTED_CAP_EXACT_ORACLE: a segment closes at exactly 4S bytes');
  if(name==='minimum-exact')assert.equal(expected.segments[0].byteSize,S/4,'SEGMENTED_MINIMUM_ORACLE: a closer at exactly S/4 bytes closes');
  if(name==='minimum-below')assert.ok(expected.segments.length===1&&expected.segments[0].byteSize>S/4,'SEGMENTED_MINIMUM_ORACLE: a closer below S/4 bytes does not close');
  // Every segment but the last holds S/4 bytes or more here (no item of S
  // bytes): at most B/(S/4-1)+1 segments for an array of B bytes.
  if(name.startsWith('closer-')){assert.ok(expected.segments.slice(0,-1).every(segment=>segment.byteSize>=S/4),'SEGMENTED_MINIMUM_ORACLE '+name);assert.ok(expected.segments.length<=expected.entry.byteSize/(S/4-1)+1,'SEGMENTED_SEGMENT_COUNT_BOUND_ORACLE '+name);}
  // The whole-array identity is that of the packed array: an extracted string
  // is null there and bound by its own value entry.
  if(name==='in-item-long-strings'){const value=sha(canonical(array));assert.notEqual(expected.entry.sha256,value,'SEGMENTED_PACKED_IDENTITY_ORACLE');assert.equal(entries[at].sha256,expected.entry.sha256,'SEGMENTED_PACKED_IDENTITY_ORACLE');}
  cases.push({name:'rule:'+name,segments:expected.segments.length,nested:expected.local.length});
 }
 {const below=await encode(actual,{projectData:{list:['x'.repeat(4095-4)]}});assert.equal(below.result.projectParts,undefined,'SEGMENTED_THRESHOLD_ORACLE: 4095 bytes stay inline');}
 // At most HISTORY_SEGMENTS_MAX segments: the last one holds every remaining
 // item, here with the cap at 4 and 3 (records, and items of S bytes or more
 // reaching the cap before and after an open segment).
 {const big=k=>({k0:'z'.repeat(4088),k1:'z'.repeat(4088),k2:'z'.repeat(4088),k3:'z'.repeat(4088),k:k});
  for(const [name,array,max] of [['records',Array.from({length:900},(_,i)=>record(i)),4],['large-items',Array.from({length:6},(_,i)=>big(i)),4],['open-before-large',[record(1),big(1),record(2),big(2),big(3)],3]]){
   const capped=encoderOf(encoderSlice(source),hash,max),{result}=await encode(capped,{projectData:{list:array}}),expected=referenceArrayEntries(array,['projectData','list'],new Map(),max),unlimited=referenceSegments(array.map(item=>canonical(item)));
   assert.ok(unlimited.length>max,'SEGMENTED_SEGMENT_CAP_FIXTURE '+name);
   assert.deepEqual(result.projectParts.entries.find(entry=>entry.segments),expected.entry,'SEGMENTED_SEGMENT_CAP_ORACLE '+name+': the last of the capped segments holds every remaining item');
   assert.equal(expected.entry.segments.length,max,'SEGMENTED_SEGMENT_CAP_ORACLE '+name);
   cases.push({name:'segment-cap:'+name,segments:max,unlimited:unlimited.length});
  }}
 // A string of 4096 or more code units is canonicalized once, for its own
 // retained part, whether the project is encoded as /1 (arrays below the
 // threshold) or /2: no discarded pass reads it.
 {const runtime=hashRuntime(),realmJson=vm.runInContext('JSON',runtime),counted=encoderOf(encoderSlice(source),runtime.closedLoopHash),long='L'.repeat(6000),original=realmJson.stringify;let calls=0;
  realmJson.stringify=function(value,...rest){if(value===long)calls++;return original.call(this,value,...rest);};
  try{for(const [name,value,schema] of [['v1-small-arrays',{job:{text:long},projectData:{list:[1,2,3],again:{text:long}}},V1],['v2-segments',{projectData:{list:Array.from({length:50},(_,i)=>({i,text:long})),again:{text:long}}},V2]]){calls=0;const {result}=await encode(counted,value);assert.equal(result.projectParts.schema,schema);assert.equal(calls,1,'SEGMENTED_LONG_STRING_SINGLE_PASS_ORACLE: '+name);cases.push({name:'long-string-single-pass:'+name});}}
  finally{realmJson.stringify=original;}}
 // 3. Determinism: appending keeps every closed segment; an edit changes one.
 const base=Array.from({length:700},(_,i)=>record(i)),first=(await encode(actual,{projectData:{list:base}})).result.projectParts.entries[0].segments;
 const appended=(await encode(actual,{projectData:{list:[...base,...Array.from({length:90},(_,i)=>record(5000+i))]}})).result.projectParts.entries[0].segments;
 assert.ok(first.length>=4,'SEGMENTED_DETERMINISM_FIXTURE');
 assert.deepEqual(appended.slice(0,first.length-1),first.slice(0,-1),'SEGMENTED_APPEND_ORACLE: appending items keeps every closed segment');
 const texts=base.map(item=>canonical(item)),reference=referenceSegments(texts);let edit=null;
 for(let k=1,start=reference[0].count;k<reference.length-1&&!edit;start+=reference[k].count,k++)for(let j=start;j<start+reference[k].count-1&&!edit;j++)for(let pad=1;pad<40&&!edit;pad++){
  const changed=base.slice();changed[j]=record(j,'!'.repeat(pad));const after=referenceSegments(changed.map(item=>canonical(item)));
  if(after.length===reference.length&&after.every((segment,index)=>segment.count===reference[index].count))edit={k,j,changed};
 }
 assert.ok(edit,'SEGMENTED_EDIT_FIXTURE');
 const edited=(await encode(actual,{projectData:{list:edit.changed}})).result.projectParts.entries[0].segments;
 assert.equal(edited.length,first.length);
 assert.deepEqual(edited.map((segment,index)=>segment.sha256!==first[index].sha256?index:null).filter(index=>index!==null),[edit.k],'SEGMENTED_EDIT_ORACLE: an edited item rewrites only its own segment');
 cases.push({name:'determinism',segments:first.length,appended:appended.length,editedSegment:edit.k});
 return cases;
}

// Store-level: a /2 root through the production owners.
const jobKey=jobId=>'recovery:'+jobId,snapshotKey=(jobId,id)=>jobKey(jobId)+':snapshot:'+id,fileKey=(jobId,sha256)=>jobKey(jobId)+':bytes:'+sha256;
function cloneRuntime(base,sourceOverrides){const r=projectStoreRuntime({storageWorker:false,sourceOverrides});for(const [name,rows] of base.rows)r.rows.set(name,new Map([...rows].map(([key,value])=>[key,r.copy(value)])));return r;}
async function decodeBody(blob){return JSON.parse(gunzipSync(Buffer.from(await blob.arrayBuffer())).toString('utf8'));}
// Re-sign one root's snapshot after changing its part list; the record,
// History entry (state form) and accounting follow.
async function resignRoot(r,jobId,id,change){
 const meta=r.rows.get('meta'),state=meta.get(jobKey(jobId)).value,entry=state.entries.find(row=>row.id===id),record=meta.get(snapshotKey(jobId,id)).value,body=await decodeBody(record.blob);
 change(body.projectParts);delete body.packageSha256;body.packageSha256=sha(canonical(body));
 const bytes=gzipSync(Buffer.from(canonical(body)));state.compressedProjectBytes+=bytes.length-entry.byteSize;
 for(const row of [entry,record]){row.sha256=sha(bytes);row.byteSize=bytes.length;}
 record.projectParts=structuredClone(body.projectParts);record.blob=new Blob([bytes]);
 if(Object.hasOwn(entry,'projectPartsSha256'))entry.projectPartsSha256=sha(canonical(body.projectParts));else entry.projectParts=structuredClone(body.projectParts);
}
// Re-sign one root's snapshot after changing its body; the record and History
// entry take the new snapshot identity and changeRows(row) for each of them.
async function resignBody(r,jobId,id,changeBody,changeRows=()=>{}){
 const meta=r.rows.get('meta'),state=meta.get(jobKey(jobId)).value,entry=state.entries.find(row=>row.id===id),record=meta.get(snapshotKey(jobId,id)).value,body=await decodeBody(record.blob);
 changeBody(body);delete body.packageSha256;body.packageSha256=sha(canonical(body));
 const bytes=gzipSync(Buffer.from(canonical(body)));state.compressedProjectBytes+=bytes.length-entry.byteSize;
 for(const row of [entry,record]){row.sha256=sha(bytes);row.byteSize=bytes.length;changeRows(row);}
 record.blob=new Blob([bytes]);
}
const refusal=async(work,code,message,label)=>{await assert.rejects(work,error=>{assert.equal(error.code,code,label+': code');assert.equal(error.message,message,label+': message');return true;});};
const MISSING='Saved project contents are missing or corrupt. The current version is preserved.',SIZES='Saved project content sizes conflict.',INVALID='Saved project content identity is invalid.',UNRETAINED='Recovery project contents are not retained in this complete history.',UNSUPPORTED='Saved project content references are unsupported.',ACCOUNTING='Recovery storage accounting does not match its retained contents.';

async function storeCases(source){
 const cases=[],overrides={'project-store.js':source},base=projectStoreRuntime({storageWorker:false,sourceOverrides:overrides}),{store,core,engine,copy}=base;
 let p=core.createBlankState('HISTORY-SEGMENTED-PARTS');
 p.vendorExtension=copy({records:Array.from({length:600},(_,i)=>record(i)),notes:[{text:'n'.repeat(6000)},{text:'short'}]});
 engine.ensureShape(p);engine.recalculate(p);p=await store.writeProject(p,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
 const jobId=p.job.JOB_ID,original=copy(p.vendorExtension);
 const rootId=(await store.historyList(jobId)).activeId,firstRecord=base.rows.get('meta').get(snapshotKey(jobId,rootId)).value,parts=firstRecord.projectParts;
 const segmentsEntry=parts.entries.find(entry=>entry.segments&&entry.path.join('.')==='vendorExtension.records'),nested=parts.entries.find(entry=>entry.path.join('.')==='vendorExtension.notes.0.text');
 assert.equal(parts.schema,V2,'SEGMENTED_STORE_FIXTURE_ORACLE: the root is /2');assert.ok(segmentsEntry&&segmentsEntry.segments.length>=3&&nested,'SEGMENTED_STORE_FIXTURE_ORACLE: records in several segments and a nested long string');
 assert.equal(base.rows.get('meta').get(fileKey(jobId,segmentsEntry.sha256)),undefined,'SEGMENTED_WHOLE_IDENTITY_NOT_A_FILE_ORACLE');
 // An appended record shares every closed segment of the earlier root.
 const next=copy(p);next.vendorExtension.records.push(record(9999));engine.recalculate(next);p=await store.writeProject(next,{expectedProjectRevision:p.revision});
 const secondId=(await store.historyList(jobId)).activeId,second=base.rows.get('meta').get(snapshotKey(jobId,secondId)).value.projectParts.entries.find(entry=>entry.segments&&entry.path.join('.')==='vendorExtension.records');
 assert.deepEqual(second.segments.slice(0,segmentsEntry.segments.length-1),segmentsEntry.segments.slice(0,-1),'SEGMENTED_STORE_APPEND_ORACLE');
 const pristine=cloneRuntime(base,overrides);
 const restored=await store.restoreCheckpoint(jobId,rootId,{expectedProjectRevision:p.revision});
 assert.deepEqual(copy(restored.project.vendorExtension),original,'SEGMENTED_STORE_EXACT_RESTORE_ORACLE');p=restored.project;
 // Equal items in separate segments share one segment file; each restored
 // item is its own object, and each nested string reaches only its own item.
 {const r=projectStoreRuntime({storageWorker:false,sourceOverrides:overrides});let q=r.core.createBlankState('HISTORY-SEGMENTED-EQUAL');
  q.vendorExtension=r.copy({records:Array.from({length:6},()=>({kind:'equal',k0:'z'.repeat(4088),k1:'z'.repeat(4088),k2:'z'.repeat(4088),k3:'z'.repeat(4088),body:'e'.repeat(20000)}))});r.engine.ensureShape(q);r.engine.recalculate(q);q=await r.store.writeProject(q,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
  const equalRoot=(await r.store.historyList(q.job.JOB_ID)).activeId,equalParts=r.rows.get('meta').get(snapshotKey(q.job.JOB_ID,equalRoot)).value.projectParts,equalEntry=equalParts.entries.find(entry=>entry.segments);
  assert.ok(equalEntry&&new Set(equalEntry.segments.map(segment=>segment.sha256)).size<equalEntry.segments.length,'SEGMENTED_EQUAL_SEGMENTS_FIXTURE');
  const after=r.copy(q);after.job.JOB_TITLE='After equal records';r.engine.recalculate(after);q=await r.store.writeProject(after,{expectedProjectRevision:q.revision});
  const back=(await r.store.restoreCheckpoint(q.job.JOB_ID,equalRoot,{expectedProjectRevision:q.revision})).project.vendorExtension.records;
  assert.equal(new Set(back).size,back.length,'SEGMENTED_NO_ALIAS_ORACLE: restored items are distinct objects');
  assert.ok(back.every(item=>item.kind==='equal'&&item.k3==='z'.repeat(4088)&&item.body==='e'.repeat(20000)),'SEGMENTED_NO_ALIAS_ORACLE: every item restored exactly');
  cases.push({name:'equal-segments-no-alias',segments:equalEntry.segments.length});}
 const backup=await store.exportPackage(jobId),fresh=projectStoreRuntime({storageWorker:false,sourceOverrides:overrides}),imported=await fresh.store.importPackage(backup);
 const freshRoot=await fresh.store.restoreCheckpoint(jobId,secondId,{expectedProjectRevision:imported.revision});
 assert.equal(freshRoot.project.vendorExtension.records.length,601,'SEGMENTED_STORE_IMPORT_ORACLE');
 cases.push({name:'store-round-trip',segments:segmentsEntry.segments.length,sharedSegments:segmentsEntry.segments.length-1});
 // Arrays of small items that each close a segment by hash (65,537 integers
 // and repeated objects): every reader accepts what the write committed.
 {const r=projectStoreRuntime({storageWorker:false,sourceOverrides:overrides});let q=r.core.createBlankState('HISTORY-SEGMENTED-CLOSERS');
  const closers={counts:Array(65537).fill(closerOf(i=>5000+i)),objects:Array(3000).fill(closerOf(i=>({n:i})))};
  q.vendorExtension=r.copy(closers);r.engine.ensureShape(q);r.engine.recalculate(q);q=await r.store.writeProject(q,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
  const closerJob=q.job.JOB_ID,closerRoot=(await r.store.historyList(closerJob)).activeId,list=r.rows.get('meta').get(snapshotKey(closerJob,closerRoot)).value.projectParts;
  for(const entry of list.entries.filter(row=>row.segments))assert.ok(entry.segments.length<=entry.byteSize/(S/4-1)+1,'SEGMENTED_SEGMENT_COUNT_BOUND_ORACLE: '+entry.path.join('.'));
  const checkpoint=await r.store.saveCheckpoint(closerJob,{expectedProjectRevision:q.revision,expectedStateSha256:q.projectSha256,view:r.copy({activeStage:1,activeView:'Workflow',drafts:{},scrollX:0,scrollY:5}),label:'Saved view'});
  assert.ok(checkpoint,'SEGMENTED_CLOSER_ITEMS_ORACLE: view checkpoint');
  const later=r.copy(q);later.job.JOB_TITLE='After closer items';r.engine.recalculate(later);q=await r.store.writeProject(later,{expectedProjectRevision:q.revision});
  const back=await r.store.restoreCheckpoint(closerJob,closerRoot,{expectedProjectRevision:q.revision});assert.deepEqual(r.copy(back.project.vendorExtension),r.copy(closers),'SEGMENTED_CLOSER_ITEMS_ORACLE: restore');
  // The backup export verifies every retained version cold.
  assert.equal((await r.store.exportPackage(closerJob)).type,'application/gzip','SEGMENTED_CLOSER_ITEMS_ORACLE: export');
  cases.push({name:'closer-items-round-trip',segments:list.entries.reduce((n,row)=>n+(row.segments?.length||0),0),items:65537+3000});}
 // The segment cap through the store: the shared constant at 4, the last
 // segment holding every remaining item, read, exported and imported; an
 // encoder that ignored it is refused at the write, which changes nothing.
 {const capAnchor='const HISTORY_SEGMENTS_MAX=65536;',closeAnchor='const closable=()=>segments.length<HISTORY_SEGMENTS_MAX-1;';
  assert.equal(source.split(capAnchor).length,2,'SEGMENTED_SEGMENT_CAP_ANCHOR');assert.equal(source.split(closeAnchor).length,2,'SEGMENTED_SEGMENT_CAP_ANCHOR');
  const capped={'project-store.js':source.replace(capAnchor,'const HISTORY_SEGMENTS_MAX=4;')},uncapped={'project-store.js':capped['project-store.js'].replace(closeAnchor,'const closable=()=>true;')};
  const records=Array.from({length:900},(_,i)=>record(i)),start=async r=>{let q=r.core.createBlankState('HISTORY-SEGMENTED-CAP');r.engine.ensureShape(q);r.engine.recalculate(q);return r.store.writeProject(q,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});};
  const r=projectStoreRuntime({storageWorker:false,sourceOverrides:capped});let q=await start(r);const next=r.copy(q);next.vendorExtension=r.copy({records});r.engine.recalculate(next);q=await r.store.writeProject(next,{expectedProjectRevision:q.revision});
  const capJob=q.job.JOB_ID,capRoot=(await r.store.historyList(capJob)).activeId,entry=r.rows.get('meta').get(snapshotKey(capJob,capRoot)).value.projectParts.entries.find(row=>row.segments);
  assert.equal(entry.segments.length,4,'SEGMENTED_SEGMENT_CAP_STORE_ORACLE');await r.store.readHistoryView(capJob,capRoot);
  const capBackup=await r.store.exportPackage(capJob),target=projectStoreRuntime({storageWorker:false,sourceOverrides:capped}),imported=await target.store.importPackage(capBackup);
  const later=target.copy(imported);later.job.JOB_TITLE='After the capped root';target.engine.recalculate(later);const after=await target.store.writeProject(later,{expectedProjectRevision:imported.revision});
  assert.deepEqual(target.copy((await target.store.restoreCheckpoint(capJob,capRoot,{expectedProjectRevision:after.revision})).project.vendorExtension.records),target.copy(records),'SEGMENTED_SEGMENT_CAP_STORE_ORACLE: restored after import');
  const u=projectStoreRuntime({storageWorker:false,sourceOverrides:uncapped});let w=await start(u);const before={project:u.copy(await u.store.readProject(w.job.JOB_ID)),history:u.copy(await u.store.historyList(w.job.JOB_ID))},grown=u.copy(w);grown.vendorExtension=u.copy({records});u.engine.recalculate(grown);
  await refusal(()=>u.store.writeProject(grown,{expectedProjectRevision:w.revision}),'HISTORY_VERSION_MISMATCH',INVALID,'SEGMENTED_COMMIT_LIST_CHECK_ORACLE: a write whose part list its readers refuse');
  assert.deepEqual(u.copy(await u.store.readProject(w.job.JOB_ID)),before.project,'SEGMENTED_COMMIT_LIST_CHECK_ORACLE: the project is unchanged');assert.deepEqual(u.copy(await u.store.historyList(w.job.JOB_ID)),before.history,'SEGMENTED_COMMIT_LIST_CHECK_ORACLE: History is unchanged');
  cases.push({name:'segment-cap-store',segments:4,uncappedWrite:'HISTORY_VERSION_MISMATCH'});}
 // Refusals, each on its own copy of the stored rows.
 const segment=segmentsEntry.segments[1],read=r=>r.store.readHistoryView(jobId,rootId),exported=r=>r.store.exportPackage(jobId);
 const matrix=[
  ['missing-segment',r=>r.rows.get('meta').delete(fileKey(jobId,segment.sha256)),'HISTORY_FILE_INTEGRITY_FAILED',MISSING],
  ['corrupt-segment',async r=>{const row=r.rows.get('meta').get(fileKey(jobId,segment.sha256)).value,bytes=new Uint8Array(await row.blob.arrayBuffer());bytes[1]^=1;row.blob=new Blob([bytes]);},'HISTORY_FILE_INTEGRITY_FAILED',MISSING],
  ['segment-count',r=>resignRoot(r,jobId,rootId,list=>{list.entries.find(entry=>entry.segments).segments[1].count++;}),'HISTORY_VERSION_MISMATCH',SIZES],
  ['whole-array-size',r=>resignRoot(r,jobId,rootId,list=>{list.entries.find(entry=>entry.segments).byteSize++;}),'HISTORY_VERSION_MISMATCH',SIZES],
  ['whole-array-digest',r=>resignRoot(r,jobId,rootId,list=>{const entry=list.entries.find(entry=>entry.segments);entry.sha256=entry.segments[0].sha256;}),'HISTORY_VERSION_MISMATCH',SIZES],
  ['swapped-segments',r=>resignRoot(r,jobId,rootId,list=>{const entry=list.entries.find(entry=>entry.segments);[entry.segments[0],entry.segments[1]]=[entry.segments[1],entry.segments[0]];}),'HISTORY_VERSION_MISMATCH',SIZES],
  ['segment-extra-key',r=>resignRoot(r,jobId,rootId,list=>{list.entries.find(entry=>entry.segments).segments[0].path=['x'];}),'HISTORY_VERSION_MISMATCH',INVALID],
  ['segment-zero-count',r=>resignRoot(r,jobId,rootId,list=>{list.entries.find(entry=>entry.segments).segments[0].count=0;}),'HISTORY_VERSION_MISMATCH',INVALID],
  ['empty-segments',r=>resignRoot(r,jobId,rootId,list=>{list.entries.find(entry=>entry.segments).segments=[];}),'HISTORY_VERSION_MISMATCH',INVALID],
  ['entry-extra-key',r=>resignRoot(r,jobId,rootId,list=>{list.entries.find(entry=>entry.segments).count=1;}),'HISTORY_VERSION_MISMATCH',INVALID],
  ['nested-before-segments',r=>resignRoot(r,jobId,rootId,list=>{const at=list.entries.findIndex(entry=>entry.path.join('.')==='vendorExtension.notes.0.text'),[moved]=list.entries.splice(at,1);list.entries.unshift(moved);}),'HISTORY_VERSION_MISMATCH',INVALID],
  ['segments-under-entry',r=>resignRoot(r,jobId,rootId,list=>{const entry=list.entries.find(row=>row.segments&&row.path.join('.')==='vendorExtension.notes');entry.path=['vendorExtension','notes',0,'text','x'];}),'HISTORY_VERSION_MISMATCH',INVALID],
  ['no-segments-entry',r=>resignRoot(r,jobId,rootId,list=>{list.entries=list.entries.filter(entry=>!entry.segments);}),'HISTORY_VERSION_MISMATCH',INVALID],
  ['unretained-segment',r=>{const state=r.rows.get('meta').get(jobKey(jobId)).value;state.retainedFileBytes-=state.files[segment.sha256].byteSize;delete state.files[segment.sha256];},'HISTORY_VERSION_MISMATCH',UNRETAINED]
 ];
 for(const [name,mutate,code,message] of matrix){
  const r=cloneRuntime(pristine,overrides);await mutate(r);
  await refusal(()=>read(r),code,message,'SEGMENTED_REFUSAL_ORACLE read '+name);
  await refusal(()=>exported(r),code,message,'SEGMENTED_REFUSAL_ORACLE export '+name);
  cases.push({name:'refusal:'+name,code,message});
 }
 // Decode work: a complete version declares its canonical project's UTF-8
 // length (projectBytes) in its body and descriptor; a cold decode measures
 // it, and the declared total is a History limit enforced at commit.
 {const meta=pristine.rows.get('meta'),state=meta.get(jobKey(jobId)).value,roots=state.entries.filter(entry=>!entry.projectReference);
  assert.ok(roots.every(entry=>Number.isSafeInteger(entry.projectBytes)&&entry.projectBytes>0),'SEGMENTED_PROJECT_BYTES_DECLARED_ORACLE');
  assert.ok(roots.length>=2);
  const rootBody=await decodeBody(meta.get(snapshotKey(jobId,rootId)).value.blob);assert.equal(rootBody.projectBytes,roots.find(entry=>entry.id===rootId).projectBytes,'SEGMENTED_PROJECT_BYTES_BODY_ORACLE');
  const bytesCases=[
   ['project-bytes-descriptor',r=>{const m=r.rows.get('meta');for(const row of [m.get(jobKey(jobId)).value.entries.find(entry=>entry.id===rootId),m.get(snapshotKey(jobId,rootId)).value])row.projectBytes++;},'HISTORY_VERSION_MISMATCH','Saved project identity or contents do not match the checkpoint.'],
   ['project-bytes-body',async r=>{const m=r.rows.get('meta'),entry=m.get(jobKey(jobId)).value.entries.find(row=>row.id===rootId),record=m.get(snapshotKey(jobId,rootId)).value,body=await decodeBody(record.blob);body.projectBytes++;delete body.packageSha256;body.packageSha256=sha(canonical(body));const bytes=gzipSync(Buffer.from(canonical(body)));m.get(jobKey(jobId)).value.compressedProjectBytes+=bytes.length-entry.byteSize;for(const row of [entry,record]){row.sha256=sha(bytes);row.byteSize=bytes.length;row.projectBytes=body.projectBytes;}record.blob=new Blob([bytes]);},'HISTORY_VERSION_MISMATCH','Saved canonical project bytes do not match their checkpoint identity.'],
   ['project-bytes-type',r=>{const m=r.rows.get('meta');for(const row of [m.get(jobKey(jobId)).value.entries.find(entry=>entry.id===rootId),m.get(snapshotKey(jobId,rootId)).value])row.projectBytes=String(row.projectBytes);},'HISTORY_VERSION_MISMATCH','Recovery storage accounting does not match its retained contents.']
  ];
  for(const [name,mutate,code,message] of bytesCases){const r=cloneRuntime(pristine,overrides);await mutate(r);await refusal(()=>read(r),code,message,'SEGMENTED_PROJECT_BYTES_ORACLE read '+name);await refusal(()=>exported(r),code,message,'SEGMENTED_PROJECT_BYTES_ORACLE export '+name);cases.push({name:'refusal:'+name,code,message});}
  // A /2 version always declares projectBytes: one without it (body, record
  // and entry, re-signed) is refused, so its decode work cannot escape the
  // limit. The declared value bounds the restore before any segment is read.
  {const IDENTITY='Saved project identity or contents do not match the checkpoint.',MEASURED='Saved canonical project bytes do not match their checkpoint identity.';
   const stripped=cloneRuntime(pristine,overrides);await resignBody(stripped,jobId,rootId,body=>{delete body.projectBytes;},row=>{delete row.projectBytes;});
   await refusal(()=>read(stripped),'HISTORY_VERSION_MISMATCH',ACCOUNTING,'SEGMENTED_PROJECT_BYTES_REQUIRED_ORACLE read');await refusal(()=>exported(stripped),'HISTORY_VERSION_MISMATCH',IDENTITY,'SEGMENTED_PROJECT_BYTES_REQUIRED_ORACLE export');
   const early=cloneRuntime(pristine,overrides);await resignBody(early,jobId,rootId,body=>{body.projectBytes++;},row=>{row.projectBytes++;});early.rows.get('meta').delete(fileKey(jobId,segment.sha256));
   await refusal(()=>read(early),'HISTORY_VERSION_MISMATCH',MEASURED,'SEGMENTED_PROJECT_BYTES_BEFORE_RESTORE_ORACLE read');await refusal(()=>exported(early),'HISTORY_VERSION_MISMATCH',MEASURED,'SEGMENTED_PROJECT_BYTES_BEFORE_RESTORE_ORACLE export');
   cases.push({name:'refusal:project-bytes-stripped',read:ACCOUNTING,export:IDENTITY});cases.push({name:'refusal:project-bytes-before-restore',code:'HISTORY_VERSION_MISMATCH',message:MEASURED});
}
  const total=roots.reduce((n,entry)=>n+entry.projectBytes,0),limitAnchor='maxRestoredProjectBytes:32*1024*1024*1024';
  assert.equal(source.split(limitAnchor).length,2,'SEGMENTED_LIMIT_ANCHOR');
  const limited={'project-store.js':source.replace(limitAnchor,'maxRestoredProjectBytes:'+(total+1024))},r=cloneRuntime(pristine,limited),before={project:r.copy(await r.store.readProject(jobId)),history:r.copy(await r.store.historyList(jobId))};
  const grown=r.copy(before.project);grown.vendorExtension.records.push(r.copy(record(7777)));r.engine.recalculate(grown);
  await refusal(()=>r.store.writeProject(grown,{expectedProjectRevision:before.project.revision}),'HISTORY_LIMIT_REACHED','History storage limit reached. The current project and every retained version are preserved. Export a complete backup before continuing in a new project.','SEGMENTED_DECODE_WORK_LIMIT_ORACLE write');
  assert.deepEqual(r.copy(await r.store.readProject(jobId)),before.project,'SEGMENTED_DECODE_WORK_LIMIT_ORACLE: the project is unchanged');assert.deepEqual(r.copy(await r.store.historyList(jobId)),before.history,'SEGMENTED_DECODE_WORK_LIMIT_ORACLE: History is unchanged');
  const small=projectStoreRuntime({storageWorker:false,sourceOverrides:{'project-store.js':source.replace(limitAnchor,'maxRestoredProjectBytes:'+(total-1))}}),pristineBackup=await pristine.store.exportPackage(jobId);
  await refusal(()=>small.store.importPackage(pristineBackup),'HISTORY_LIMIT_REACHED','History storage limit reached. The current project and every retained version are preserved. Export a complete backup before continuing in a new project.','SEGMENTED_DECODE_WORK_LIMIT_ORACLE import');
  assert.equal(small.rows.get('meta').get(jobKey(jobId)),undefined,'SEGMENTED_DECODE_WORK_LIMIT_ORACLE: a refused import leaves no History');
  // A backup whose /2 versions omit projectBytes is refused, in this build
  // and in one whose limit refuses the honest backup.
  {const archive=JSON.parse(gunzipSync(Buffer.from(await pristineBackup.arrayBuffer())).toString('utf8'));let removed=0;
   for(const entry of archive.recovery.entries)if(entry.projectParts?.schema===V2&&Object.hasOwn(entry,'projectBytes')){delete entry.projectBytes;removed++;}
   assert.ok(removed>=2,'SEGMENTED_PROJECT_BYTES_REQUIRED_FIXTURE');delete archive.packageSha256;archive.packageSha256=pristine.runtime.closedLoopHash.sha256Value(pristine.copy(archive));
   const crafted=new Blob([gzipSync(Buffer.from(JSON.stringify(archive)))],{type:'application/gzip'});
   for(const [label,target] of [['this-build',projectStoreRuntime({storageWorker:false,sourceOverrides:overrides})],['limited-build',projectStoreRuntime({storageWorker:false,sourceOverrides:{'project-store.js':source.replace(limitAnchor,'maxRestoredProjectBytes:'+(total-1))}})]]){
    await refusal(()=>target.store.importPackage(crafted),'HISTORY_VERSION_MISMATCH',ACCOUNTING,'SEGMENTED_PROJECT_BYTES_REQUIRED_ORACLE import '+label);
    assert.equal(target.rows.get('meta').get(jobKey(jobId)),undefined,'SEGMENTED_PROJECT_BYTES_REQUIRED_ORACLE: a refused import leaves no History');
   }
   cases.push({name:'refusal:import-without-project-bytes',code:'HISTORY_VERSION_MISMATCH',message:ACCOUNTING});}
  cases.push({name:'decode-work-limit',declaredBytes:total,limitAtCommit:'HISTORY_LIMIT_REACHED',limitAtImport:'HISTORY_LIMIT_REACHED'});
 }
 // A build without /2 refuses every /2 list with its existing message.
 const storageError=(message,code)=>Object.assign(new Error(message),{code});
 assert.equal(sha(V1_ASSERT_PARTS),SEGMENTED_V1_PARTS_CHECK_SHA256,'SEGMENTED_V1_REFERENCE_ORACLE');
 const older=new Function('storageError','HISTORY_PROJECT_PARTS',V1_ASSERT_PARTS+';return assertHistoryProjectParts;')(storageError,V1);
 assert.throws(()=>older(structuredClone(parts)),error=>error.code==='HISTORY_VERSION_MISMATCH'&&error.message===UNSUPPORTED,'SEGMENTED_VERSION_SKEW_ORACLE');
 cases.push({name:'older-build-refuses',code:'HISTORY_VERSION_MISMATCH',message:UNSUPPORTED});
 // A backup missing one segment member refuses before any durable change.
 {const archive=JSON.parse(gunzipSync(Buffer.from(await backup.arrayBuffer())).toString('utf8'));
  archive.artifacts=archive.artifacts.filter(row=>!(row.archiveKind==='RECOVERY_BYTES'&&row.sha256===segment.sha256));archive.packageManifest.artifacts=archive.packageManifest.artifacts.filter(row=>row.sha256!==segment.sha256||!row.artifactId.startsWith('RECOVERY-BYTES-'));archive.packageManifest.artifactCount=archive.packageManifest.artifacts.length;
  delete archive.packageSha256;archive.packageSha256=fresh.runtime.closedLoopHash.sha256Value(fresh.copy(archive));
  const target=projectStoreRuntime({storageWorker:false,sourceOverrides:overrides}),before=JSON.stringify([...target.rows].map(([name,rows])=>[name,[...rows.keys()]]));
  await assert.rejects(()=>target.store.importPackage(new Blob([gzipSync(Buffer.from(JSON.stringify(archive)))],{type:'application/gzip'})),error=>error.code==='HISTORY_FILE_INTEGRITY_FAILED','SEGMENTED_IMPORT_MISSING_MEMBER_ORACLE');
  assert.equal(JSON.stringify([...target.rows].map(([name,rows])=>[name,[...rows.keys()]])),before,'SEGMENTED_IMPORT_ATOMIC_ORACLE');
  cases.push({name:'import-missing-segment-member',code:'HISTORY_FILE_INTEGRITY_FAILED'});}
 // Fail-closed shape: a custody site that still read each entry's
 // sha256/byteSize would find no file for a segments entry and refuse.
 for(const [name,before,after,work] of [
  ['manifest-validation','entry.projectReference||historyPartFiles(entry.projectParts).some(','entry.projectReference||entry.projectParts.entries.some(',r=>r.store.importPackage(backup)],
  ['retained-parts','if(historyPartFiles(parts).some(part=>state.files[part.sha256]?.byteSize!==part.byteSize))','if(parts.entries.some(part=>state.files[part.sha256]?.byteSize!==part.byteSize))',r=>read(r)]
 ]){
  assert.equal(source.split(before).length,2,'SEGMENTED_UNCONVERTED_SITE_ANCHOR '+name);
  const mutant={'project-store.js':source.replace(before,after)},r=name==='retained-parts'?cloneRuntime(base,mutant):projectStoreRuntime({storageWorker:false,sourceOverrides:mutant});
  await refusal(()=>work(r),'HISTORY_VERSION_MISMATCH',UNRETAINED,'SEGMENTED_FAIL_CLOSED_ORACLE '+name);
  cases.push({name:'unconverted-site-refuses:'+name});
  // The one exception: a one-segment array without extracted strings has its
  // segment as exactly the whole-array identity, so the same unconverted site
  // finds that file and passes with the very bytes historyPartFiles names
  // (reads, export and import stay exact). For such an array the custody-site
  // scan (HISTORY_PART_CUSTODY_SITE_ORACLE) is the guard.
  {const one=projectStoreRuntime({storageWorker:false,sourceOverrides:mutant});let q=one.core.createBlankState('HISTORY-SEGMENTED-ONE-'+name);
   const records=Array.from({length:60},(_,i)=>record(i));q.vendorExtension=one.copy({records});one.engine.ensureShape(q);one.engine.recalculate(q);q=await one.store.writeProject(q,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
   const oneJob=q.job.JOB_ID,oneRoot=(await one.store.historyList(oneJob)).activeId,entry=one.rows.get('meta').get(snapshotKey(oneJob,oneRoot)).value.projectParts.entries.find(row=>row.segments);
   assert.ok(entry&&entry.segments.length===1&&entry.segments[0].sha256===entry.sha256&&entry.segments[0].byteSize===entry.byteSize&&one.rows.get('meta').get(fileKey(oneJob,entry.sha256)),'SEGMENTED_ONE_SEGMENT_IDENTITY_ORACLE: the one segment is the whole-array identity');
   const later=one.copy(q);later.job.JOB_TITLE='After one segment';one.engine.recalculate(later);q=await one.store.writeProject(later,{expectedProjectRevision:q.revision});
   await one.store.readHistoryView(oneJob,oneRoot);const oneBackup=await one.store.exportPackage(oneJob),target=projectStoreRuntime({storageWorker:false,sourceOverrides:mutant}),imported=await target.store.importPackage(oneBackup);
   assert.deepEqual(target.copy((await target.store.restoreCheckpoint(oneJob,oneRoot,{expectedProjectRevision:imported.revision})).project.vendorExtension.records),target.copy(records),'SEGMENTED_ONE_SEGMENT_IDENTITY_ORACLE: exact under the unconverted site');
   cases.push({name:'one-segment-identity-is-its-file:'+name});}
 }
 return cases;
}

// A cold read's check of a version's declared projectBytes takes the
// skeleton's canonical length from that read's own preimage digest walk
// (measuredCanonicalChunks, hashedSkeletonBytes) rather than walking the
// skeleton again. Each guard of that reuse has its own oracle here and its own
// intended fault (verify-history-canonical-sharing.mjs): the natives confirmed
// immediately before the walk's first step and after its last step, each in
// that step's own turn of the digest's stream, and at the check; the read's
// own skeleton object; nothing carried from one read to the next; and no
// measurement on a read with a write continuation or a measured pair. The
// store's internals and two observation points are reached only in this
// disposable realm; neither changes a value or an outcome.
const MEASURE_EXPOSE='globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS',MEASURE_READ='return bindCheckpointBody(body,false,credential,hashedSkeleton);',MEASURE_USE='function hashedSkeletonBytes(measure,body){';
function measuredSkeletonSource(source){
 for(const anchor of [MEASURE_EXPOSE,MEASURE_READ,MEASURE_USE])assert.equal(source.split(anchor).length,2,'HISTORY_MEASURED_SKELETON_ANCHOR '+anchor);
 return source.replace(MEASURE_EXPOSE,'globalThis.__historyMeasure={packageJsonChunks,measuredCanonicalChunks,hashedSkeletonBytes,readPackageJson};'+MEASURE_EXPOSE)
  .replace(MEASURE_READ,'globalThis.__historyMeasuredRead?.({continuation:Boolean(rootContinuation),pair:Boolean(measuredPair),measured:Boolean(hashedSkeleton)});'+MEASURE_READ)
  .replace(MEASURE_USE,MEASURE_USE+'const value=unobservedHashedSkeletonBytes(measure,body);globalThis.__historyMeasuredUse?.(value);return value;}\nfunction unobservedHashedSkeletonBytes(measure,body){');
}
export async function verifyHistoryMeasuredSkeleton({source=fs.readFileSync(new URL('./project-store.js',import.meta.url),'utf8')}={}){
 const cases=[],overrides={'project-store.js':measuredSkeletonSource(source)},hooks={},reads=[];
 const observe=r=>{r.runtime.__historyMeasuredRead=info=>{reads.push({...info});hooks.read?.(info);};r.runtime.__historyMeasuredUse=value=>hooks.use?.(value);return r;};
 const r=observe(projectStoreRuntime({storageWorker:false,sourceOverrides:overrides})),{store,core,engine,copy,runtime}=r,api=runtime.__historyMeasure;
 let p=core.createBlankState('HISTORY-MEASURED-SKELETON');
 p.vendorExtension=copy({records:Array.from({length:600},(_,i)=>record(i)),notes:[{text:'n'.repeat(40000)},{text:'short ünïcødé ☃ 𝄞'}]});
 engine.ensureShape(p);engine.recalculate(p);p=await store.writeProject(p,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
 const jobId=p.job.JOB_ID,view=scrollY=>copy({activeStage:1,activeView:'Project',drafts:{},scrollX:0,scrollY});
 await store.saveCheckpoint(jobId,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:view(3)});
 const next=copy(p);next.vendorExtension.records.push(record(9999));engine.recalculate(next);p=await store.writeProject(next,{expectedProjectRevision:p.revision});
 await store.saveCheckpoint(jobId,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:view(4)});
 // A read with a write continuation (this runtime's own checkpoints) can
 // hand its decoded body to the certificate's byte comparison before the
 // check: it measures nothing.
 {const continued=reads.filter(read=>read.continuation);assert.ok(continued.length>=2,'HISTORY_MEASURED_SKELETON_FIXTURE: continuation reads');
  assert.ok(continued.every(read=>!read.measured),'HISTORY_MEASURED_SKELETON_CONTINUATION_ORACLE: a read with a write continuation measured its skeleton');
  cases.push({name:'measured-skeleton:continuation-read-walks',reads:continued.length});}
 // A read with a measured pair (a checkpoint over an operational journal,
 // in a store holding no root certificate) may skip the restored project's
 // digest pass, so its pre-restore check is its only projectBytes check: it
 // measures nothing either.
 {const operational=copy(p);operational.activeView='Records';p=await store.writeProject(operational,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
  const fresh=observe(cloneRuntime(r,overrides)),current=await fresh.store.readProject(jobId);reads.length=0;
  assert.ok(await fresh.store.saveCheckpoint(jobId,{expectedProjectRevision:current.revision,expectedStateSha256:current.projectSha256,view:fresh.copy({activeStage:1,activeView:'Workflow',drafts:{},scrollX:0,scrollY:5})}),'HISTORY_MEASURED_SKELETON_FIXTURE: pair checkpoint');
  const paired=reads.filter(read=>read.pair&&!read.continuation);assert.ok(paired.length>=1,'HISTORY_MEASURED_SKELETON_FIXTURE: measured-pair read');
  assert.ok(paired.every(read=>!read.measured),'HISTORY_MEASURED_SKELETON_PAIR_ORACLE: a read with a measured pair measured its skeleton');
  cases.push({name:'measured-skeleton:pair-read-walks',reads:paired.length});}
 const snapshots=[...r.rows.get('meta').entries()].filter(([key])=>key.startsWith(jobKey(jobId)+':snapshot:')).map(([,row])=>row.value);
 const decode=async row=>{const {payload,fileContents}=await api.readPackageJson(row.blob,{spoolArtifacts:false}),{packageSha256,...body}=payload;return {body,fileContents,packageSha256};};
 const collect=async chunks=>{const out=[];for await(const chunk of chunks)out.push(chunk);return out;};
 const root=snapshots.find(row=>row.projectParts?.schema===V2&&!row.projectReference);assert.ok(root,'HISTORY_MEASURED_SKELETON_FIXTURE: a /2 root');
 // The measured stream is the digest's stream; its count is the UTF-8 length
 // of the project member that stream hashes, counted here independently of
 // the store (this file's serializer reproduces the hashed bytes exactly),
 // and with the entries' bytes it is the declared projectBytes.
 let measured=0;
 for(const row of snapshots){
  const {body,fileContents,packageSha256}=await decode(row),measure={},plain=await collect(api.packageJsonChunks(body,fileContents)),stream=await collect(api.packageJsonChunks(body,fileContents,measure));
  assert.deepEqual(stream,plain,'HISTORY_MEASURED_SKELETON_STREAM_ORACLE: measuring changed the preimage chunks');
  assert.equal(sha(stream.join('')),packageSha256,'HISTORY_MEASURED_SKELETON_STREAM_ORACLE: the measured stream is the hashed preimage');
  if(!body.projectParts||!Object.hasOwn(body,'projectBytes'))continue;
  assert.equal(sha(canonical(body)),packageSha256,'HISTORY_MEASURED_SKELETON_FIXTURE: independent serializer');
  assert.equal(measure.bytes,bytesOf(canonical(body.project)),'HISTORY_MEASURED_SKELETON_LENGTH_ORACLE: the count is the hashed skeleton bytes');
  assert.equal(measure.bytes+body.projectParts.entries.reduce((n,part)=>n+part.byteSize-4,0),body.projectBytes,'HISTORY_MEASURED_SKELETON_LENGTH_ORACLE: the count with the entries is the declared projectBytes');
  assert.equal(api.hashedSkeletonBytes(measure,body),measure.bytes,'HISTORY_MEASURED_SKELETON_USE_ORACLE: an unchanged measurement is used');measured++;
 }
 assert.ok(measured>=2,'HISTORY_MEASURED_SKELETON_FIXTURE: measured roots');
 cases.push({name:'measured-skeleton:stream-and-length',snapshots:snapshots.length,measured});
 // A later read of the same bytes that measured nothing reuses no earlier
 // read's count, and a count is used for its own decoded skeleton only.
 {const {body,fileContents}=await decode(root),measure={};await collect(api.packageJsonChunks(body,fileContents,measure));assert.equal(api.hashedSkeletonBytes(measure,body),measure.bytes);
  const later=(await decode(root)).body;
  assert.equal(api.hashedSkeletonBytes({},later),undefined,'HISTORY_MEASURED_SKELETON_CROSS_READ_ORACLE: a read that measured nothing used an earlier read\'s count');
  assert.equal(api.hashedSkeletonBytes(null,later),undefined,'HISTORY_MEASURED_SKELETON_CROSS_READ_ORACLE: a read without a measurement used an earlier read\'s count');
  cases.push({name:'measured-skeleton:no-cross-read-reuse'});
  assert.equal(api.hashedSkeletonBytes(measure,later),undefined,'HISTORY_MEASURED_SKELETON_IDENTITY_ORACLE: a count was used for another decode of the skeleton');
  assert.equal(api.hashedSkeletonBytes(measure,{...body,project:copy(body.project)}),undefined,'HISTORY_MEASURED_SKELETON_IDENTITY_ORACLE: a count was used for another skeleton object');
  cases.push({name:'measured-skeleton:own-skeleton-only'});}
 // Each replaceable native the walk and the count dispatch through, changed
 // and later restored at each guard's boundary.
 const generator=Object.getPrototypeOf(Object.getPrototypeOf(runtime.closedLoopHash.canonicalChunks(null)));
 const replace=(target,key)=>{const before=Object.getOwnPropertyDescriptor(target,key),original=before.value;Object.defineProperty(target,key,{...before,value:function(...args){return original.apply(this,args);}});return ()=>Object.defineProperty(target,key,before);};
 const changes={'encoder-encode':()=>replace(runtime.TextEncoder.prototype,'encode'),'generator-next':()=>replace(generator,'next'),'object-keys':()=>replace(runtime.Object,'keys')};
 // Steps the measured walk by hand; at(event) runs before its first step,
 // after its first step and after its last (done) step.
 const walk=(value,measure,at)=>{const chunks=api.measuredCanonicalChunks(value,measure);let count=0;at('before');for(let step=chunks.next();!step.done;step=chunks.next())if(++count===1)at('first');at('end');return count;};
 // Steps the digest's own stream by hand (packageJsonChunks with a measure,
 // as the read's preimage digest consumes it), whose steps are separate
 // turns; at(index) runs once the chunk at index has been received. In the
 // root's stream, the project member's ':' is the chunk at beforeWalk, the
 // step after it runs the walk's first step, the walk's last chunk is at
 // lastChunk and the step after it ends the walk.
 const digestSteps=async(body,fileContents,measure,at)=>{const chunks=api.packageJsonChunks(body,fileContents,measure);let index=0;for(let step=await chunks.next();!step.done;step=await chunks.next())at(index++);return index;};
 let beforeWalk=-1,lastChunk=-1;
 {const {body,fileContents}=await decode(root),plain=await collect(api.packageJsonChunks(body,fileContents)),skeleton=[...runtime.closedLoopHash.canonicalChunks(body.project)];
  const member=plain.flatMap((chunk,index)=>chunk==='"project"'&&plain[index+1]===':'&&skeleton.every((value,offset)=>plain[index+2+offset]===value)?[index+1]:[]);
  assert.equal(member.length,1,'HISTORY_MEASURED_SKELETON_FIXTURE: the project member in the digest stream');
  beforeWalk=member[0];lastChunk=beforeWalk+skeleton.length;
  assert.ok(skeleton.length>=2&&lastChunk+1<plain.length,'HISTORY_MEASURED_SKELETON_FIXTURE: the step that ends the walk');
  // The same stepping with no change measures, and the count is used.
  const measure={};assert.equal(await digestSteps(body,fileContents,measure,()=>{}),plain.length,'HISTORY_MEASURED_SKELETON_FIXTURE: stepped digest stream');
  assert.equal(measure.skeleton,body.project,'HISTORY_MEASURED_SKELETON_FIXTURE: a stepped digest measured');
  assert.equal(api.hashedSkeletonBytes(measure,body),bytesOf(canonical(body.project)),'HISTORY_MEASURED_SKELETON_FIXTURE: a stepped digest\'s count is used');
  cases.push({name:'measured-skeleton:digest-stream-control',chunks:plain.length,beforeWalk,lastChunk});}
 for(const [name,change] of Object.entries(changes)){
  // Changed before the walk and kept through the check.
  {const {body,fileContents}=await decode(root),measure={},restore=change();try{await collect(api.packageJsonChunks(body,fileContents,measure));assert.equal(measure.skeleton,undefined,'HISTORY_MEASURED_SKELETON_BEFORE_WALK_ORACLE '+name+': a walk under changed natives was measured');assert.equal(api.hashedSkeletonBytes(measure,body),undefined,'HISTORY_MEASURED_SKELETON_BEFORE_WALK_ORACLE '+name);}finally{restore();}}
  // Changed before the first step and restored right after it: only the
  // check before that step sees it.
  {const {body}=await decode(root),measure={};let restore=null;const steps=walk(body.project,measure,event=>{if(event==='before')restore=change();else if(event==='first'&&restore){restore();restore=null;}});if(restore)restore();
   assert.ok(steps>=2,'HISTORY_MEASURED_SKELETON_FIXTURE: skeleton steps');assert.equal(measure.skeleton,undefined,'HISTORY_MEASURED_SKELETON_START_GUARD_ORACLE '+name+': a change spanning the first step was not seen');}
  // Changed after the first step and restored after the last: only the
  // check after that step sees it.
  {const {body}=await decode(root),measure={};let restore=null;walk(body.project,measure,event=>{if(event==='first')restore=change();else if(event==='end'&&restore){restore();restore=null;}});if(restore)restore();
   assert.equal(measure.skeleton,undefined,'HISTORY_MEASURED_SKELETON_END_GUARD_ORACLE '+name+': a change spanning the last step was not seen');}
  // The same two windows on the digest's stream: changed after the step
  // before the walk's first step and restored after that step, or changed
  // after the walk's last chunk and restored after the step that ends the
  // walk. Each is seen, so neither confirmation can move to another step of
  // the digest, across its awaits (to its first or its last step, say).
  {const {body,fileContents}=await decode(root),measure={};let restore=null;
   try{await digestSteps(body,fileContents,measure,index=>{if(index===beforeWalk)restore=change();else if(index===beforeWalk+1&&restore){restore();restore=null;}});}finally{if(restore)restore();}
   assert.equal(measure.skeleton,undefined,'HISTORY_MEASURED_SKELETON_START_GUARD_ORACLE digest-stream '+name+': a change spanning the digest step that runs the walk\'s first step was not seen');
   assert.equal(api.hashedSkeletonBytes(measure,body),undefined,'HISTORY_MEASURED_SKELETON_START_GUARD_ORACLE digest-stream '+name);}
  {const {body,fileContents}=await decode(root),measure={};let restore=null;
   try{await digestSteps(body,fileContents,measure,index=>{if(index===lastChunk)restore=change();else if(index===lastChunk+1&&restore){restore();restore=null;}});}finally{if(restore)restore();}
   assert.equal(measure.skeleton,undefined,'HISTORY_MEASURED_SKELETON_END_GUARD_ORACLE digest-stream '+name+': a change spanning the digest step that ends the walk was not seen');
   assert.equal(api.hashedSkeletonBytes(measure,body),undefined,'HISTORY_MEASURED_SKELETON_END_GUARD_ORACLE digest-stream '+name);}
  // Changed after a measured walk, before the check uses its count.
  {const {body,fileContents}=await decode(root),measure={};await collect(api.packageJsonChunks(body,fileContents,measure));assert.equal(measure.skeleton,body.project,'HISTORY_MEASURED_SKELETON_FIXTURE: measured');
   const restore=change();try{assert.equal(api.hashedSkeletonBytes(measure,body),undefined,'HISTORY_MEASURED_SKELETON_USE_GUARD_ORACLE '+name+': a count was used under changed natives');}finally{restore();}
   assert.equal(api.hashedSkeletonBytes(measure,body),measure.bytes,'HISTORY_MEASURED_SKELETON_USE_ORACLE '+name+': restored natives');}
  cases.push({name:'measured-skeleton:guards:'+name});
 }
 // The real cold read path: an export's cold reads use their counts.
 {const used=[];hooks.use=value=>used.push(value);try{assert.equal((await store.exportPackage(jobId)).type,'application/gzip');}finally{delete hooks.use;}
  assert.ok(used.length>=2&&used.every(value=>typeof value==='number'),'HISTORY_MEASURED_SKELETON_USED_ORACLE: a cold export read walked its skeleton again '+JSON.stringify(used));
  cases.push({name:'measured-skeleton:export-uses-count',reads:used.length});}
 // A native changed after a real read's digest and restored once its check
 // has run: that read walks, and the export completes.
 for(const [name,change] of Object.entries(changes)){
  let state=null;hooks.read=info=>{if(!state&&info.measured)state={restore:change()};};hooks.use=value=>{if(state&&!state.done){state.restore();state.done=true;state.value=value;}};
  try{assert.equal((await store.exportPackage(jobId)).type,'application/gzip');}finally{delete hooks.read;delete hooks.use;if(state&&!state.done)state.restore();}
  assert.ok(state?.done,'HISTORY_MEASURED_SKELETON_FIXTURE: a measured read reached its check');
  assert.equal(state.value,undefined,'HISTORY_MEASURED_SKELETON_READ_USE_GUARD_ORACLE '+name+': a read used its count under natives changed after its digest');
  cases.push({name:'measured-skeleton:read-use-guard:'+name});
 }
 return cases;
}

// Every part-custody loop goes through historyPartFiles. Any other loop over a
// part list's entries outside the owners allowed to read entries fails here.
// For a one-segment array without extracted strings this scan is the guard:
// that segment is exactly the entry's whole-array identity, so an unconverted
// site would find it and pass (SEGMENTED_ONE_SEGMENT_IDENTITY_ORACLE).
export const PART_ENTRY_READERS=Object.freeze(['assertHistoryProjectParts','assertSegmentedHistoryProjectParts','historyPartFiles','restoreHistoryProject','historyEncodedProjectBytes']);
export const PART_CUSTODY_SITES=Object.freeze(['validateRecoveryManifest','historyProofPartsRetained','commitRootCheckpoint','assertHistoryPartsRetained','prepareHistoryCommit','readRetainedCheckpoint','exportPackage']);
export function historyPartCustodySites(source){
 const functionAt=index=>{const before=source.slice(0,index),match=[...before.matchAll(/\n(?:async )?function ([A-Za-z0-9_$]+)\(/g)].at(-1);return match?.[1]||null;};
 const loops=[...source.matchAll(/\b[A-Za-z0-9_$]*[Pp]arts\??\.entries\b/g)].map(match=>({text:match[0],function:functionAt(match.index)}));
 const outside=loops.filter(loop=>!PART_ENTRY_READERS.includes(loop.function));
 const body=name=>{const start=source.search(new RegExp('\\n(?:async )?function '+name+'\\('));assert.ok(start>=0,'HISTORY_PART_CUSTODY_SITE_ORACLE: '+name+' exists');const end=source.slice(start+1).search(/\n(?:async )?function /);return source.slice(start,end<0?undefined:start+1+end);};
 const unconverted=PART_CUSTODY_SITES.filter(name=>!body(name).includes('historyPartFiles('));
 return {loops,outside,unconverted};
}
export function verifyHistoryPartCustodySites(source){
 const found=historyPartCustodySites(source);
 assert.deepEqual(found.outside,[],'HISTORY_PART_CUSTODY_SITE_ORACLE: a part-custody loop reads part entries outside historyPartFiles');
 assert.deepEqual(found.unconverted,[],'HISTORY_PART_CUSTODY_SITE_ORACLE: a custody site does not read historyPartFiles');
 // The scan detects a reverted site.
 const reverted=source.replace('for(const part of historyPartFiles(root.descriptor.projectParts)){','for(const part of root.descriptor.projectParts.entries){');
 assert.notEqual(reverted,source);const control=historyPartCustodySites(reverted);
 assert.deepEqual(control.outside.map(loop=>loop.function),['commitRootCheckpoint'],'HISTORY_PART_CUSTODY_SCAN_CONTROL');
 return {loops:found.loops.length,readers:[...new Set(found.loops.map(loop=>loop.function))].sort(),custodySites:PART_CUSTODY_SITES.length};
}

export async function verifyHistorySegmentedParts({source=fs.readFileSync(new URL('./project-store.js',import.meta.url),'utf8')}={}){
 const blankRuntime=projectStoreRuntime({storageWorker:false}),blank=blankRuntime.core.createBlankState('HISTORY-SEGMENTED-BLANK');blankRuntime.engine.ensureShape(blank);blankRuntime.engine.recalculate(blank);
 const custody=verifyHistoryPartCustodySites(source),encoder=await encoderCases(source,JSON.parse(JSON.stringify(blank))),stored=await storeCases(source),measured=await verifyHistoryMeasuredSkeleton({source});
 return {historySegmentedParts:'PASS',synthetic:true,actualBrowser:false,custody,cases:[...encoder,...stored,...measured]};
}

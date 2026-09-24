import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gzipSync,gunzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const source=fs.readFileSync('project-store.js','utf8');
const start=source.indexOf('async function readPackageJson('),end=source.indexOf('\nasync function base64BlobToBlob(',start);
assert.ok(start>=0&&end>start);
const parser=source.slice(start,end);
function runtime(fault=null){
 let implementation=parser;
 if(fault){assert.ok(implementation.includes(fault.before),'Implementation fault anchor must exist');implementation=implementation.replace(fault.before,fault.after);}
 implementation=implementation.replace('for(let i=0;i<text.length;i++){','for(let i=0;i<text.length;i++){globalThis.parserSteps++;');
 const context=createVerifierRuntime({Blob,TextEncoder,TextDecoder,DecompressionStream,setTimeout,clearTimeout,parserSteps:0});
 // Preserve the parser's production read deadline rather than replacing it
 // with a pass-through in this extracted-function fixture.
 vm.runInContext(fs.readFileSync('hash.js','utf8')+'\nglobalThis.hash=closedLoopHash;',context,{filename:'hash.js'});
 vm.runInContext(implementation+'\nglobalThis.decode=readPackageJson;',context);
 return context;
}
const compressed=text=>new Blob([gzipSync(Buffer.from(text,'utf8'))]);
const r=runtime(),cases=[];
const note=name=>{cases.push({name,result:'PASS'});console.error(JSON.stringify({phase:name,result:'PASS'}));};
const bytes=process.argv.includes('--large')?48000000:4194304;
const text='H'.repeat(bytes)+'é🙂TAIL';
const fixture=JSON.parse('{"__proto__":{"preserved":true},"project":{"text":'+JSON.stringify(text)+'},"artifacts":[{"artifactId":"bytes","base64":"AAH+/w=="}],"nested":[null,true,false,-1.25e3,{"escaped":"\\\"\\\\\\t\\n\\r\\b\\f\\u0000"}]}');
const encoded=JSON.stringify(fixture),began=performance.now(),decoded=await r.decode(compressed(encoded)),elapsedMs=performance.now()-began;
assert.equal(decoded.payload.project.text,text);
assert.equal(Object.hasOwn(decoded.payload,'__proto__'),true);
assert.deepEqual(JSON.parse(JSON.stringify(decoded.payload.nested)),fixture.nested);
assert.equal(decoded.payload.artifacts[0].base64,'');
assert.equal(await decoded.fileContents.get(decoded.payload.artifacts[0]).blob.text(),'AAH+/w==');
note('Long project text, prototype-named properties, numeric values, escape sequences and spooled artifact spelling match independent JSON decoding');
const uncompressed=await r.decode(new Blob([encoded]),{compressed:false,spoolArtifacts:false});
assert.deepEqual(JSON.parse(JSON.stringify(uncompressed.payload)),fixture);
assert.equal(uncompressed.fileContents.get(uncompressed.payload.artifacts[0]),undefined);
note('Canonical recovery values use the same bounded decoder without interpreting a value named artifacts as backup transport');

// Retained checkpoints contain many short metadata fields, not only long
// strings. The real Stage-30 export traverses the saved checkpoint collection;
// text-only fixtures must not hide per-character script work in that path.
// This bound is a codec cost regression, not a browser timing substitute.
const metadata={schema:'synthetic-checkpoint-metadata/1',entries:Array.from({length:2048},(_,i)=>({id:'saved-'+i,revision:i,scope:{stage:i%30+1,kind:'VIEW',valid:true},digest:'abcdef0123456789'.repeat(4),view:{activeView:'Workflow',scrollY:i,notes:'Unicode é🙂 and \\"'}}))};
const metadataText=JSON.stringify(metadata),metadataRuntime=runtime(),metadataStart=performance.now();
const metadataDecoded=await metadataRuntime.decode(compressed(metadataText),{spoolArtifacts:false});
assert.deepEqual(JSON.parse(JSON.stringify(metadataDecoded.payload)),metadata,'CHECKPOINT_METADATA_BYTES_ORACLE: structural metadata changed');
const metadataStepBound=Math.ceil(Buffer.byteLength(metadataText)/256)+4096;
assert.ok(metadataRuntime.parserSteps<metadataStepBound,'CHECKPOINT_METADATA_DECODE_COST_ORACLE: '+metadataRuntime.parserSteps+' script-character steps exceed '+metadataStepBound+' for '+Buffer.byteLength(metadataText)+' bounded metadata bytes');
note('Bounded saved-checkpoint metadata preserves every field without repeated script-character scanning');

// Put escaped Unicode, quotes and backslashes on both sides of the production
// 16 KiB string-piece and 64 KiB decoder boundaries. No stage state is injected.
for(const boundary of [16384,65536])for(const delta of [-7,-1,0,1,7]){
 const prefix='x'.repeat(boundary+delta),raw='{"value":"'+prefix+'\\uD83D\\uDE42\\\\\\\"\\nend","next":true}';
 const actual=await r.decode(compressed(raw));assert.deepEqual(JSON.parse(JSON.stringify(actual.payload)),JSON.parse(raw));
}
note('Escaped characters and Unicode remain exact across both chunk boundaries');
const invalid=['{"value":"unterminated}','{"value":"bad\\q"}','{"value":"bad\\u12z4"}','{"value":"bad\ncontrol"}','[}', '{]', '[1,]', '{"a":1,}', '{"a" 1}', '{"a":"one" "b":"two"}', 'true false', '{"artifacts":[{"base64":"é"}]}'];
for(const raw of invalid)await assert.rejects(()=>r.decode(compressed(raw)),undefined,'Malformed JSON must be rejected: '+JSON.stringify(raw));
note('Malformed escapes, raw controls, missing separators, mismatched containers, trailing values and non-ASCII artifact encodings are rejected');

const stepBound=Math.ceil(Buffer.byteLength(encoded)/256)+4096;
assert.ok(r.parserSteps<stepBound,'BACKUP_SCAN_COST_ORACLE: plain retained text required '+r.parserSteps+' JavaScript character steps; bound '+stepBound);
note('Plain retained strings are scanned in bounded spans rather than one JavaScript iteration per character');

// Native metadata decoding has a fixed byte budget. Above it, resume the
// same stream parser without dropping the buffered prefix, escapes or UTF-8.
// Full backup artifact strings must remain spooled regardless of package size.
function observeNativeReads(context){
 vm.runInContext(`globalThis.nativeParseBytes=[];const originalParse=JSON.parse;JSON.parse=function(text,...args){nativeParseBytes.push(new TextEncoder().encode(String(text)).byteLength);return originalParse.call(this,text,...args);};`,context);
 return context;
}
const metadataByteLimit=8*1024*1024;
const bounded=observeNativeReads(runtime());
const oversize={prefix:metadata,tail:'é'.repeat(metadataByteLimit/2)+'🙂\\"TAIL'};
const oversizeText=JSON.stringify(oversize),oversizeBytes=Buffer.byteLength(oversizeText);
assert.ok(oversizeBytes>metadataByteLimit);
const oversizedDecoded=await bounded.decode(compressed(oversizeText),{spoolArtifacts:false});
assert.deepEqual(JSON.parse(JSON.stringify(oversizedDecoded.payload)),oversize,'CHECKPOINT_METADATA_FALLBACK_BYTES_ORACLE: overflow lost prefix or tail');
assert.ok(Math.max(...bounded.nativeParseBytes)<=metadataByteLimit,'CHECKPOINT_METADATA_BUFFER_BOUND_ORACLE: decoded metadata exceeded its temporary byte budget');
for(const raw of invalid.filter(raw=>!raw.includes('base64')))await assert.rejects(()=>bounded.decode(compressed(raw),{spoolArtifacts:false}),undefined,'Malformed metadata must not pass native decoding');
const invalidUtf8=new Blob([gzipSync(Buffer.from([0x7b,0x22,0x78,0x22,0x3a,0x22,0xc3,0x28,0x22,0x7d]))]);
await assert.rejects(()=>bounded.decode(invalidUtf8,{spoolArtifacts:false}),undefined,'Native metadata must reject invalid UTF-8 before JSON decoding');
await assert.rejects(()=>bounded.decode(compressed(oversizeText.slice(0,-1)),{spoolArtifacts:false}),undefined,'Oversize malformed metadata must remain rejected');
note('Fixed metadata byte budget, exact overflow continuation and malformed/invalid-UTF8 rejection hold');
const unboundedMetadata=observeNativeReads(runtime({before:'if(metadataText&&expandedBytes>METADATA_PARSE_BYTE_LIMIT)',after:'if(false)'}));
await unboundedMetadata.decode(compressed(oversizeText),{spoolArtifacts:false});
assert.ok(Math.max(...unboundedMetadata.nativeParseBytes)>metadataByteLimit,'Removed metadata byte bound must be detected by the same buffer oracle');
const repeatedMetadata=runtime({before:'let metadataText=spoolArtifacts?null:[];',after:'let metadataText=null;'});
await repeatedMetadata.decode(compressed(metadataText),{spoolArtifacts:false});
assert.ok(repeatedMetadata.parserSteps>=metadataStepBound,'Repeated metadata scanning fault must violate the same cost oracle');
note('Targeted repeated-metadata-work and removed-buffer-bound faults are detected without weakening byte or format checks');

// The large option exercises the real codec at 48 million characters. Its
// intentionally character-scanning negative control needs only
// the same bounded 4 MiB class witness used by ordinary CI, not 48 million
// deliberately slow interpreter iterations. The positive size proof is retained.
const slowFaultEncoded=bytes>4194304?JSON.stringify({...fixture,project:{text:'H'.repeat(4194304)+'é🙂TAIL'}}):encoded;
const slowFaultStepBound=Math.ceil(Buffer.byteLength(slowFaultEncoded)/256)+4096;
console.error(JSON.stringify({phase:'slow-scanning-implementation-fault',status:'START',expandedBytes:Buffer.byteLength(slowFaultEncoded)}));
const slow=runtime({before:'if(!unicode&&!escape){',after:'if(false){'});
await slow.decode(compressed(slowFaultEncoded));
assert.ok(slow.parserSteps>=slowFaultStepBound,'The removed span-scanning implementation fault must violate the cost oracle');
const permissive=runtime({before:"if(!parent||parent.type!==(char==='}'?'object':'array')||!['keyOrEnd','valueOrEnd','commaOrEnd'].includes(parent.state))fail();",after:'/* deliberate wrong-container validation bypass */'});
const wronglyAccepted=await permissive.decode(compressed('[}'));
assert.deepEqual(JSON.parse(JSON.stringify(wronglyAccepted.payload)),[]);
note('Targeted slow-scanning and mismatched-container validation faults are detected by the same cost and rejection oracles');
// Exercise the production callers, not only the extracted decoder. A correct
// fast decoder that is never selected during export/recovery does not close
// the observed saved-history cost. Prerequisite state uses the real builders
// and store commands; the shared adapter substitutes only IndexedDB.
async function consumerCost(fault=null){
 let implementation=source;
 if(fault){assert.ok(implementation.includes(fault.before),'Consumer fault anchor must exist');implementation=implementation.replace(fault.before,fault.after);}
 implementation=implementation.replace('for(let i=0;i<text.length;i++){','for(let i=0;i<text.length;i++){globalThis.metadataScriptSteps=(globalThis.metadataScriptSteps||0)+1;');
 const anchor='globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS';
 assert.equal(implementation.split(anchor).length,2);
 implementation=implementation.replace(anchor,`const originalDecode=readPackageJson;readPackageJson=async(...args)=>{const value=await originalDecode(...args);(globalThis.metadataDecodes??=[]).push(value.expandedBytes);return value;};`+anchor);
 const actual=projectStoreRuntime({sourceOverrides:{'project-store.js':implementation}}),{core,engine,store,copy}=actual;
 let project=core.createBlankState('SYNTHETIC-METADATA-CONSUMERS');engine.ensureShape(project);engine.recalculate(project);
 project=await store.writeProject(project,{expectedProjectRevision:0,createOnly:true});
 await store.beginHistorySession('METADATA-SESSION');
 const initialTitle=project.job.JOB_TITLE;
 for(let i=0;i<3;i++){const next=copy(project);next.job.JOB_TITLE='Continuation '+i;project=await store.writeProject(next,{expectedProjectRevision:project.revision});}
 const history=await store.historyList(project.job.JOB_ID),observations=[];
 for(const kind of ['export','restore']){
  actual.runtime.metadataScriptSteps=0;actual.runtime.metadataDecodes=[];
  if(kind==='export'){
   const backup=await store.exportPackage(project.job.JOB_ID),decoded=JSON.parse(gunzipSync(Buffer.from(await backup.arrayBuffer())));
   assert.equal(decoded.project.job.JOB_TITLE,project.job.JOB_TITLE);
   assert.equal(decoded.artifacts.filter(a=>a.archiveKind==='RECOVERY_SNAPSHOT').length,history.entries.length,'Consumer cost correction must not discard saved versions');
  }else{
   const restored=await store.restoreCheckpoint(project.job.JOB_ID,history.entries[0].id,{expectedProjectRevision:project.revision});
   assert.equal(restored.project.job.JOB_TITLE,initialTitle);
   assert.ok((await store.historyList(project.job.JOB_ID)).entries.some(entry=>entry.id===history.activeId),'Restoring saved metadata must preserve its previous continuation');
  }
  const expandedBytes=Array.from(actual.runtime.metadataDecodes).reduce((sum,n)=>sum+n,0);
  observations.push({kind,expandedBytes,scriptCharacterSteps:actual.runtime.metadataScriptSteps,stepBound:Math.ceil(expandedBytes/256)+4096});
 }
 return observations;
}
const consumers=await consumerCost();
for(const observation of consumers)assert.ok(observation.scriptCharacterSteps<observation.stepBound,'CHECKPOINT_CONSUMER_COST_ORACLE: '+JSON.stringify(observation));
const consumerFaults=[];
for(const [kind,before,after] of [
 ['export','readPackageJson(saved.blob,{spoolArtifacts:false})','readPackageJson(saved.blob)'],
 ['restore','readPackageJson(entry.blob,{spoolArtifacts:false})','readPackageJson(entry.blob)']
]){
 const observations=await consumerCost({before,after}),violating=observations.find(row=>row.kind===kind);
 assert.ok(violating.scriptCharacterSteps>=violating.stepBound,'The '+kind+' caller regression must be detected by the same bounded metadata-work oracle');
 consumerFaults.push(violating);
}
note('Actual export and restoration preserve saved versions and meet metadata-work bounds; separate caller faults are detected');
console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Node executes the production streaming backup parser; node:zlib and JSON.parse provide independent byte/structure fixtures',workload:{plainTextCharacters:bytes,expandedBytes:Buffer.byteLength(encoded)},observation:{consumers,consumerFaults,elapsedMs,parserSteps:r.parserSteps,stepBound,deliberateSlowFaultSteps:slow.parserSteps,slowFaultExpandedBytes:Buffer.byteLength(slowFaultEncoded),slowFaultStepBound,metadataBytes:Buffer.byteLength(metadataText),metadataParserSteps:metadataRuntime.parserSteps,metadataStepBound,metadataByteLimit,oversizeBytes,maximumNativeMetadataRead:Math.max(...bounded.nativeParseBytes),deliberateUnboundedMetadataRead:Math.max(...unboundedMetadata.nativeParseBytes)},cases},null,2));

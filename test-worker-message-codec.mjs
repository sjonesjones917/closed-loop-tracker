import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

// Exact production codec functions plus native structuredClone. This is a
// transport helper boundary, not a browser, IndexedDB or full operator journey.
export async function verifyWorkerMessageCodec({sourceOverrides={},fault=null}={}){
 const source=sourceOverrides['project-store.js']??fs.readFileSync('project-store.js','utf8');
 const start=source.indexOf('const STORAGE_STRING_TABLE_SCHEMA='),end=source.indexOf('async function requestStoreWorker(',start);
 assert.ok(start>=0&&end>start,'WORKER_CODEC_SOURCE_ANCHOR_ORACLE');
 let codecSource=source.slice(start,end);
 if(fault==='sparse-path'){const dense="Array.from(slot[0]).every(key=>typeof key==='string')";assert.equal(codecSource.split(dense).length,2,'WORKER_CODEC_SPARSE_PATH_FAULT_ANCHOR_ORACLE');codecSource=codecSource.replace(dense,"slot[0].every(key=>typeof key==='string')");}
 const codec=Function('storageError',codecSource+'\nreturn {pack:packStorageWorkerValue,unpack:unpackStorageWorkerValue};')((message,code)=>Object.assign(new Error(message),{code}));
 const pack=fault==='expanded-message'?value=>({value}):codec.pack,unpack=codec.unpack,cases=[],note=name=>cases.push({name,result:'PASS'});
 const text='a'.repeat(65536),other='\ud800é🙂\udfff'.repeat(14000),roundtrip=value=>{const packed=pack(value),wire=structuredClone(packed);return {packed,wire,result:unpack(wire.value,wire.stringTable)};};
 const count=(value)=>{let total=0;const seen=new Set();function visit(v){if(typeof v==='string'){if(v.length>=65536)total+=v.length;return;}if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);for(const key of Object.keys(v))visit(v[key]);}visit(value);return total;};
 const original={source:Array.from({length:7},()=>({INPUT_SET_CONTENTS:text})),raw:[other,other],unique:'z'.repeat(65537),short:'x'.repeat(65535)},originalBefore=structuredClone(original),transport=roundtrip(original);
 assert.deepEqual(transport.result,originalBefore,'WORKER_CODEC_EXACT_ROUNDTRIP_ORACLE');
 assert.ok(transport.packed.stringTable,'WORKER_CODEC_REPEATED_FRAME_ORACLE');
 assert.equal(count(transport.packed),text.length+other.length+original.unique.length,'WORKER_CODEC_SINGLE_STRING_OCCURRENCE_ORACLE');
 assert.equal(count(original),7*text.length+2*other.length+original.unique.length,'WORKER_CODEC_ORIGINAL_EXPANSION_CONTROL');
 assert.deepEqual(original,originalBefore,'WORKER_CODEC_INPUT_ISOLATION_ORACLE');
 assert.deepEqual(new Set(transport.packed.stringTable.values),new Set([text,other]),'WORKER_CODEC_DISTINCT_EXACT_VALUES_ORACLE');
 assert.equal(transport.packed.stringTable.slots.length,9,'WORKER_CODEC_DISTINCT_PATHS_ORACLE');
 note('Repeated strings cross the native clone boundary once per exact value; original expanded control and full roundtrip remain exact');
 const shape={nil:null,empty:'',undefinedValue:undefined,array:new Array(5),extension:{schema:'closed-loop-storage-string-table/1',values:[text,text],slots:[[[],0]],value:null,stringTable:'ordinary data'}};
 shape.array[1]=undefined;shape.array[2]=null;shape.array[3]='';shape.array[4]=shape.extension;
 Object.defineProperty(shape,'__proto__',{value:{text,textAgain:text},enumerable:true,writable:true,configurable:true});
 shape.constructor={prototype:{text,textAgain:text}};
 const shaped=roundtrip(shape).result;assert.deepEqual(shaped,structuredClone(shape),'WORKER_CODEC_REFERENCE_KEYS_ORACLE');assert.equal(Object.hasOwn(shaped,'omitted'),false);assert.equal(Object.hasOwn(shaped,'undefinedValue'),true);assert.equal(Object.hasOwn(shaped.array,'0'),false);assert.equal(Object.hasOwn(shaped.array,'1'),true);assert.equal(Object.getPrototypeOf(shaped),Object.prototype);note('Reference-looking and prototype-looking own keys, null, undefined, omission, empty values and array holes remain distinct');
 const node={text,textAgain:text},graph={left:node,right:node};graph.self=graph;node.parent=graph;const cycled=roundtrip(graph).result;assert.deepEqual(cycled,structuredClone(graph),'WORKER_CODEC_CYCLE_ROUNDTRIP_ORACLE');assert.equal(cycled.left,cycled.right);assert.equal(cycled.self,cycled);assert.equal(cycled.left.parent,cycled);note('Plain graph aliases and cycles preserve identity without duplicate target slots');
 const buffer=new Uint8Array([0,1,127,128,255,0,17,33]).buffer,blob=new Blob([buffer],{type:'application/x-closed-loop-test'}),binary={blob,again:blob,buffer,bytes:new Uint8Array(buffer,1,4),view:new DataView(buffer,2,4),date:new Date('2026-10-10T12:34:56Z'),text,textAgain:text};
 const binaryWire=roundtrip(binary);assert.ok(binaryWire.packed.stringTable,'WORKER_CODEC_BINARY_STILL_FRAMED_ORACLE');const decoded=binaryWire.result;assert.deepEqual(decoded,structuredClone(binary),'WORKER_CODEC_NATIVE_VALUE_ROUNDTRIP_ORACLE');assert.equal(decoded.blob.type,blob.type);assert.deepEqual(new Uint8Array(await decoded.blob.arrayBuffer()),new Uint8Array(buffer));assert.equal(decoded.bytes.buffer,decoded.buffer);assert.equal(decoded.view.buffer,decoded.buffer);assert.equal(decoded.again,decoded.blob);note('Blob, typed bytes, shared buffers and Date retain native structured clone values with framing');
 const nativeShared={text,textAgain:text},nativeContainers={shared:nativeShared,map:new Map([['shared',nativeShared]]),set:new Set([nativeShared]),error:new Error('retained error'),text,textAgain:text};const fallback=roundtrip(nativeContainers);assert.equal(fallback.packed.stringTable,undefined,'WORKER_CODEC_OPAQUE_FALLBACK_ORACLE');assert.equal(fallback.packed.value,nativeContainers);assert.deepEqual(fallback.result,structuredClone(nativeContainers));assert.equal(fallback.result.map.get('shared'),fallback.result.shared);assert.equal([...fallback.result.set][0],fallback.result.shared);note('Opaque containers use native fallback preserving cross-container aliases');
 let getterCalls=0;const accessor={a:text,b:text,get observed(){getterCalls++;return 'native getter value';}};const accessorPacked=pack(accessor);assert.equal(getterCalls,0,'WORKER_CODEC_NO_EAGER_GETTER_ORACLE');assert.equal(accessorPacked.stringTable,undefined);const accessorWire=structuredClone(accessorPacked);assert.equal(getterCalls,1);assert.equal(unpack(accessorWire.value,accessorWire.stringTable).observed,'native getter value');note('Accessor graphs preserve the native clone timing without eager getter execution');
 const unicode=roundtrip({first:other,second:other}).result;assert.equal(unicode.first,other);assert.equal(unicode.second,other);assert.equal(unicode.first.charCodeAt(0),0xd800);assert.equal(unicode.first.charCodeAt(4),0xdfff);note('Multibyte text and lone surrogate UTF-16 code units are preserved exactly');
 const plain={small:'s'.repeat(65535),smallAgain:'s'.repeat(65535),single:text};const noTable=roundtrip(plain);assert.equal(noTable.packed.stringTable,undefined,'WORKER_CODEC_THRESHOLD_ORACLE');assert.deepEqual(noTable.result,plain);note('Below-threshold repetitions and unique large strings stay ordinary values');
 const second=roundtrip(transport.result).result;assert.deepEqual(second,originalBefore,'WORKER_CODEC_SECOND_ROUNDTRIP_ORACLE');note('A second encode/native-clone/decode cycle remains lossless');
 const badCases=[
  ['wrong-schema',f=>f.stringTable.schema='other'],
  ['array-table',f=>f.stringTable=Object.assign([],f.stringTable)],
  ['missing-values',f=>delete f.stringTable.values],
  ['values-not-array',f=>f.stringTable.values={}],
  ['missing-slots',f=>delete f.stringTable.slots],
  ['slots-not-array',f=>f.stringTable.slots={}],
  ['short-table-value',f=>f.stringTable.values[0]='short'],
  ['wrong-table-value-type',f=>f.stringTable.values[0]=null],
  ['duplicate-table-value',f=>f.stringTable.values.push(f.stringTable.values[0])],
  ['unused-table-value',f=>f.stringTable.values.push('u'.repeat(65536))],
  ['single-reference-value',f=>f.stringTable.slots.splice(1)],
  ['negative-index',f=>f.stringTable.slots[0][1]=-1],
  ['out-of-range-index',f=>f.stringTable.slots[0][1]=10],
  ['fractional-index',f=>f.stringTable.slots[0][1]=0.5],
  ['string-index',f=>f.stringTable.slots[0][1]='0'],
  ['path-not-array',f=>f.stringTable.slots[0][0]='a'],
  ['empty-path',f=>f.stringTable.slots[0][0]=[]],
  ['non-string-path-key',f=>f.stringTable.slots[0][0]=[0]],
  ['sparse-path-key',f=>{f.value.undefined=null;f.stringTable.slots[0][0]=new Array(1);}],
  ['missing-parent',f=>f.stringTable.slots[0][0]=['missing','value']],
  ['missing-target',f=>f.stringTable.slots[0][0]=['missing']],
  ['inherited-parent',f=>f.stringTable.slots[0][0]=['constructor','prototype','a']],
  ['non-null-slot',f=>f.value.a='kept'],
  ['duplicate-slot',f=>f.stringTable.slots[1]=structuredClone(f.stringTable.slots[0])],
  ['slot-not-pair',f=>f.stringTable.slots[0].push('unexpected')]
 ];
 for(const [name,change]of badCases){const malformed=structuredClone(pack({a:text,b:text}));change(malformed);const before=structuredClone(malformed);assert.throws(()=>unpack(malformed.value,malformed.stringTable),error=>error.code==='INVALID_STORAGE_WORKER_FRAME','WORKER_CODEC_MALFORMED_ORACLE '+name);assert.deepEqual(malformed,before,'WORKER_CODEC_REJECTION_ATOMICITY_ORACLE '+name);note('Malformed frame rejects atomically: '+name);}
 const aliasTarget={x:null},aliasMalformed={value:{left:aliasTarget,right:aliasTarget},stringTable:{schema:'closed-loop-storage-string-table/1',values:[text],slots:[[['left','x'],0],[['right','x'],0]]}};
 assert.throws(()=>unpack(aliasMalformed.value,aliasMalformed.stringTable),error=>error.code==='INVALID_STORAGE_WORKER_FRAME','WORKER_CODEC_ALIAS_DUPLICATE_SLOT_ORACLE');assert.equal(aliasTarget.x,null);note('Aliased paths to the same target cannot fabricate distinct repeated slots');
 return {status:'PASS',synthetic:true,actualBrowser:false,boundary:'Exact production codec functions and Node native structuredClone; no storage or browser result implied',sourceSha256:createHash('sha256').update(source).digest('hex'),codecSourceSha256:createHash('sha256').update(codecSource).digest('hex'),expandedControlUnits:count(original),encodedUnits:count(transport.packed),cases};
}

// Actual ready/request owners with deferred recovery and an explicit Worker
// double. Timing here means ordering, not a browser latency measurement.
export async function verifyStorageWorkerStartup({sourceOverrides={},fault=null}={}){
 const source=sourceOverrides['project-store.js']??fs.readFileSync('project-store.js','utf8'),slice=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start,'WORKER_STARTUP_SOURCE_ANCHOR_ORACLE '+a);return source.slice(start,end);};
 let command=slice('async function requestStoreWorker(','const useStoreWorker='),startup=slice('const ready=(async()=>','if(STORE_WORKER){let queue=');
 if(fault==='missing-parent-barrier'){assert.equal(command.split('await ready;').length,2);command=command.replace('await ready;','');}
 if(fault==='duplicate-worker-recovery'){assert.equal(startup.split('globalThis.indexedDB&&!STORE_WORKER').length,2);startup=startup.replace('globalThis.indexedDB&&!STORE_WORKER','globalThis.indexedDB&&!ARCHIVE_PARSER_WORKER');}
 const cases=[],deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};},flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 for(const mode of ['main','main-recovery-failure','storage-worker','archive-worker']){
  const migration=deferred(),recovery=deferred(),events=[],workerMode=mode.endsWith('worker'),context={URL,crypto:globalThis.crypto,queueMicrotask,setTimeout,clearTimeout,indexedDB:{},STORE_WORKER:workerMode,ARCHIVE_PARSER_WORKER:mode==='archive-worker',STORE_SCRIPT_URL:'https://example.invalid/project-store.js?v=SYNTHETIC',STORE_CONTEXT_ID:'SYNTHETIC',STORE_BUILD_ID:'SYNTHETIC',STORAGE_WORKER_TIMEOUT_MS:30000,hash:{assertPinnedUnicodeHost(){events.push('unicode');}},console:{error(){events.push('diagnostic');}},async migrateLegacy(){events.push('migration:start');await migration.promise;events.push('migration:end');},async recoverResponseStaging(){events.push('recovery:start');await recovery.promise;events.push('recovery:end');},storageError:(message,code)=>Object.assign(new Error(message),{code}),packStorageWorkerValue:value=>({value}),unpackStorageWorkerValue:value=>value,projectIdentity:p=>p.job.JOB_ID,async clearWorkerCommit(){events.push('receipt:clear');},async observeProjectArtifactCustody(){events.push('custody');},recoverWorkerOperation:(pending,error)=>pending.reject(error)};
  context.Worker=class {constructor(){events.push('worker:construct');}postMessage(message){events.push('worker:post');queueMicrotask(()=>this.onmessage({data:{operationId:message.operationId,buildIdentity:message.buildIdentity,ok:true,checkpointId:'CHECKPOINT-SYNTHETIC'}}));}terminate(){events.push('worker:terminate');}};
  vm.runInNewContext('let operationWorker=null;const workerRequests=new Map();\n'+command+startup+'\nglobalThis.owner={ready,request:requestStoreWorker,recover:recoverResponseStaging};',context);
  if(workerMode){assert.equal(events.includes('migration:start'),false,'WORKER_STARTUP_NO_DUPLICATE_MIGRATION_ORACLE '+mode);assert.equal(events.includes('recovery:start'),false,'WORKER_STARTUP_NO_DUPLICATE_RECOVERY_ORACLE '+mode);await context.owner.ready;cases.push({caseId:mode,result:'PASS',startupRecoveryCalls:0});continue;}
  const first=context.owner.request('SAVE_CHECKPOINT',['JOB',{}]),second=context.owner.request('SAVE_CHECKPOINT',['JOB',{}]);await flush();
  assert.equal(events.includes('worker:construct'),false,'WORKER_STARTUP_PARENT_BARRIER_ORACLE');assert.equal(events.filter(e=>e==='migration:start').length,1);assert.equal(events.includes('recovery:start'),false);
  migration.resolve();await flush();assert.equal(events.filter(e=>e==='recovery:start').length,1,'WORKER_STARTUP_MAIN_RECOVERY_ONCE_ORACLE');assert.equal(events.includes('worker:construct'),false,'WORKER_STARTUP_RECOVERY_BARRIER_ORACLE');
  if(mode==='main-recovery-failure')recovery.reject(new Error('Synthetic recoverable staging diagnosis failure'));else recovery.resolve();
  assert.deepEqual(await Promise.all([first,second]),['CHECKPOINT-SYNTHETIC','CHECKPOINT-SYNTHETIC'],'WORKER_STARTUP_NO_DEADLOCK_ORACLE');await context.owner.ready;
  assert.equal(events.filter(e=>e==='worker:construct').length,1);assert.equal(events.filter(e=>e==='worker:post').length,2);assert.equal(events.filter(e=>e==='recovery:start').length,1);assert.equal(events.filter(e=>e==='migration:start').length,1);
  if(mode==='main-recovery-failure')assert.equal(context.closedLoopStagingRecoveryError,'Synthetic recoverable staging diagnosis failure','WORKER_STARTUP_FAILURE_DIAGNOSTIC_ORACLE');else assert.ok(events.indexOf('recovery:end')<events.indexOf('worker:construct'),'WORKER_STARTUP_SETTLED_BEFORE_DISPATCH_ORACLE');
  cases.push({caseId:mode,result:'PASS',startupRecoveryCalls:1,commandsCompleted:2,diagnosticPreserved:mode==='main-recovery-failure'});
 }
 // Execute the still-exported real recovery command in a storage-worker realm
 // over the existing empty transaction adapter. Nonempty recovery and CAS are
 // already exercised by this owner's response-staging recovery population.
 let workerImports=0;const r=projectStoreRuntime({sourceOverrides,storageWorker:false,environment:{importScripts(){workerImports++;},location:{search:'?storeWorker=1'},URLSearchParams,indexedDB:{},addEventListener(){}}});await r.store.ready;assert.equal(workerImports,1,'WORKER_STARTUP_ACTUAL_WORKER_REALM_ORACLE');assert.deepEqual(Array.from(await r.store.recoverResponseStaging()),[],'WORKER_STARTUP_EXPLICIT_RECOVERY_ORACLE');assert.equal([...r.rows.values()].every(rows=>rows.size===0),true,'WORKER_STARTUP_EXPLICIT_EMPTY_RECOVERY_NO_MUTATION_ORACLE');cases.push({caseId:'explicit-worker-recovery',result:'PASS',emptyStoreOnly:true});
 return {status:'PASS',actualBrowser:false,synthetic:true,boundary:'Actual startup/request functions with scheduling doubles; explicit exported recovery through production transaction adapter in worker realm',sourceSha256:createHash('sha256').update(source).digest('hex'),startupSourceSha256:createHash('sha256').update(command+startup).digest('hex'),cases};
}

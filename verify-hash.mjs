import fs from 'node:fs';
import vm from 'node:vm';
vm.runInThisContext(fs.readFileSync('hash.js','utf8'),{filename:'hash.js'});
const h=globalThis.closedLoopHash;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const reject=(name,make)=>{let ok=false;try{h.stableStringify(make());}catch(e){ok=e instanceof TypeError;}assert(ok,`${name} must be rejected.`);};
assert(h.sha256Text('')==='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855','empty SHA-256 vector failed');
assert(h.sha256Text('abc')==='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad','abc SHA-256 vector failed');
assert(h.canonicalizationVersion==='closed-loop-canonical-json/1','canonicalization version is not controlling /1');
assert(h.idVersion==='closed-loop-id/1','canonical ID version is not controlling /1');
assert(h.stableStringify({b:1,a:2})===h.stableStringify({a:2,b:1}),'object key ordering is not canonical');
assert(h.stableStringify({'2':'two','10':'ten',a:'aye'})==='{"10":"ten","2":"two","a":"aye"}','Integer-like object keys are not serialized in unsigned Unicode scalar order.');
const bmp='\uE000',astral='\u{10000}';
assert(h.stableStringify({[bmp]:1,[astral]:2})===`{"${bmp}":1,"${astral}":2}`,'object keys are not sorted by unsigned Unicode scalar value');
assert(h.stableStringify({x:Number.MAX_SAFE_INTEGER})===`{"x":${Number.MAX_SAFE_INTEGER}}`,'maximum safe integer was not preserved exactly');
assert(h.stableStringify({x:Number.MIN_SAFE_INTEGER})===`{"x":${Number.MIN_SAFE_INTEGER}}`,'minimum safe integer was not preserved exactly');
for(const [name,make] of [
 ['Infinity',()=>({x:Infinity})],['NaN',()=>({x:NaN})],['negative Infinity',()=>({x:-Infinity})],['negative zero',()=>({x:-0})],['fraction',()=>({x:1.25})],['unsafe positive integer',()=>({x:Number.MAX_SAFE_INTEGER+1})],['unsafe negative integer',()=>({x:Number.MIN_SAFE_INTEGER-1})],['unpaired high surrogate',()=>({x:'\uD800'})],['unpaired low surrogate',()=>({x:'\uDC00'})],['unpaired surrogate key',()=>({['\uD800']:1})],['undefined member',()=>({x:undefined})],['undefined array member',()=>[undefined]],['undefined root',()=>undefined],['bigint',()=>({x:1n})],['function',()=>({x(){}})],['symbol value',()=>({x:Symbol('x')})],['symbol key',()=>{const x={};x[Symbol('x')]=1;return x;}],['Date',()=>new Date(0)],['Map',()=>new Map([['x',1]])],['Set',()=>new Set([1])],['sparse array',()=>{const x=[];x.length=1;return x;}],['array property',()=>{const x=[1];x.extra=2;return x;}],['accessor',()=>{const x={};Object.defineProperty(x,'a',{enumerable:true,get(){return 1;}});return x;}],['cycle',()=>{const x={};x.self=x;return x;}]
])reject(name,make);

let undefinedPreimageRejected=false;
try{h.hashRegistered('UNREGISTERED_KIND',{x:1});}catch(error){undefinedPreimageRejected=/UNDEFINED_HASH_PREIMAGE/.test(String(error));}
assert(undefinedPreimageRejected,'Unregistered release-bearing hash preimage must fail closed.');
h.registerHashPreimage('TEST_HASH',{includePointers:['/a','/members'],omitPointers:['/digest'],reasonByOmittedPointer:{'/digest':'Digest field is self-dependent.'}});
h.registerSetSemantics('/members',{elementIdentityKey:'id'});
const registeredA=h.hashRegistered('TEST_HASH',{a:1,members:[{id:'B',value:2},{id:'A',value:1}],digest:'ignored'});
const registeredB=h.hashRegistered('TEST_HASH',{a:1,members:[{id:'A',value:1},{id:'B',value:2}],digest:'different'});
assert(registeredA===registeredB,'Registered set semantics or omission rules are not deterministic.');
let duplicateSetRejected=false;
try{h.hashRegistered('TEST_HASH',{a:1,members:[{id:'A'},{id:'A'}],digest:''});}catch(error){duplicateSetRejected=/Duplicate set element identity/.test(String(error));}
assert(duplicateSetRejected,'Duplicate registered set identities must fail closed.');

assert(h.hashPreimageRegistry.has('CONTENT_RECORD:REQ_ID'),'Requirement content hash preimage is not explicitly registered.');
assert(h.hashPreimageRegistry.has('CANONICAL_RECORD'),'Canonical record hash preimage is not explicitly registered.');
const contentRecord={fields:{REQ_ID:'REQ-1',OBLIGATION:'must hold',STATUS:'CURRENT',VERSION:'V1',CREATED_AT:'device-a',UPDATED_AT:'device-b'},relationships:{SOURCE_ID:'SOURCE-1'},evidenceRefs:['EVIDENCE-1']};
const contentPreimage=h.contentRecordValue(contentRecord,'REQ_ID');
assert(!Object.prototype.hasOwnProperty.call(contentPreimage.fields,'REQ_ID'),'Content hash preimage did not apply the registered identity omission.');
assert(!Object.prototype.hasOwnProperty.call(contentPreimage.fields,'STATUS'),'Content hash preimage did not apply the registered lifecycle omission.');
assert(contentPreimage.fields.OBLIGATION==='must hold','Content hash preimage lost substantive canonical content.');
const contentHash=h.contentRecordSha256(contentRecord,'REQ_ID');
assert(contentHash===h.contentRecordSha256({fields:{...contentRecord.fields,REQ_ID:'REQ-2',STATUS:'SUPERSEDED',VERSION:'V2',CREATED_AT:'other',UPDATED_AT:'other'},relationships:contentRecord.relationships,evidenceRefs:contentRecord.evidenceRefs},'REQ_ID'),'Registered noncontent omissions changed content identity.');
assert(contentHash!==h.contentRecordSha256({fields:{...contentRecord.fields,OBLIGATION:'different'},relationships:contentRecord.relationships,evidenceRefs:contentRecord.evidenceRefs},'REQ_ID'),'Substantive content change did not change content identity.');
let unknownContentKindRejected=false;
try{h.contentRecordSha256({fields:{UNKNOWN_ID:'X'},relationships:{},evidenceRefs:[]},'UNKNOWN_ID');}catch(error){unknownContentKindRejected=/UNDEFINED_HASH_PREIMAGE/.test(String(error));}
assert(unknownContentKindRejected,'Unknown content-record hash kind must fail closed instead of inventing a preimage.');
const canonicalRecord={fields:{REQ_ID:'REQ-1',OBLIGATION:'must hold'},relationships:{},evidenceRefs:[],recordSha256:'old',sha256:'legacy'};
const canonicalRecordHash=h.recordSha256(canonicalRecord);
assert(canonicalRecordHash===h.recordSha256({...canonicalRecord,recordSha256:'changed',sha256:'changed'}),'Canonical record digest fields must be omitted only through the registered preimage.');
assert(canonicalRecordHash!==h.recordSha256({...canonicalRecord,fields:{...canonicalRecord.fields,OBLIGATION:'changed'}}),'Canonical record substantive change did not change record identity.');

const idInput={familyPrefix:'REQ',familyNamespace:'requirements',jobNamespace:'JOB-123',commandId:'CMD-1',targetSlot:'slot',parentId:'',allocationSequence:7,collisionCounter:0};
const idA=h.allocateCanonicalId(idInput),idB=h.allocateCanonicalId(idInput);
assert(idA.id===idB.id,'Canonical ID allocation is not stable for an identical allocation tuple.');
assert(/^REQ-[0-9a-v]{32}$/.test(idA.id),'Canonical ID must use uppercase family prefix plus 160-bit lowercase base32hex payload.');
const idChanged=h.allocateCanonicalId({...idInput,allocationSequence:8});
assert(idChanged.id!==idA.id,'Allocation sequence must participate in canonical ID identity.');
const retry=h.allocateCanonicalIdWithCollisionCheck(idInput,{exists:id=>id===idA.id?idA.payload:false});
assert(retry.id===idA.id&&retry.exactRetry===true,'Exact canonical ID retry must return the original identity.');
const collision=h.allocateCanonicalIdWithCollisionCheck(idInput,{exists:id=>id===idA.id?{different:true}:false});
assert(collision.id!==idA.id&&collision.collisionCounter===1,'Collision handling must increment collisionCounter inside the allocation contract.');

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
assert(testRuntime.includes("if(source)url.search=new URL(source).search"),'Test IR worker URL must inherit the exact test-runtime.js build/cache query identity.');
assert(testRuntime.includes("new URL('test-worker.js',base)"),'Test IR worker must remain the same-origin registered worker entry.');
const appCore=fs.readFileSync('app-core.js','utf8');
assert(/function\s+artifactControlMarkup\s*\(\s*n\s*,\s*locked\s*\)\s*\{\s*if\s*\(\s*n\s*===\s*19\s*\)/.test(appCore),'Artifact controls must retain the established Stage 19 unchanged-candidate boundary; whitespace or formatting changes must not alter the invariant.');
assert(!/function\s+artifactControlMarkup\s*\(\s*n\s*,\s*locked\s*\)\s*\{[\s\S]{0,500}?if\s*\(\s*n\s*===\s*4\s*\)\s*return\s*['"]{2}\s*;/.test(appCore),'Stage 04 visual controls must not be hidden as a substitute for canonical intent reuse.');

console.log(JSON.stringify({sha256Vectors:true,canonicalOrdering:true,integerLikeKeyOrdering:true,unicodeScalarOrdering:true,safeIntegerBoundaries:true,ambiguousValuesRejected:24,registeredHashPreimageFailureClosed:true,registeredSetSemantics:true,contentRecordPreimagesRegistered:true,unknownContentHashKindRejected:true,canonicalRecordPreimageRegistered:true,closedLoopIdStable:true,closedLoopIdCollisionChecked:true,sharedBuildIdentity,runtimeScriptCount:runtimeFiles.length,workerSharesBuildIdentity:true,stage04RepeatAttachmentControlAbsent:true}));

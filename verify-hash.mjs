import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const context={console,TextEncoder,TextDecoder,URL,URLSearchParams,crypto:webcrypto,dispatchEvent(){},Event:function Event(type){this.type=type}};context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync('hash.js','utf8'),context,{filename:'hash.js'});const h=context.closedLoopHash;
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const reject=(label,make)=>{let ok=false;try{h.stableStringify(make());}catch{ok=true;}assert(ok,`${label} must be rejected by canonical JSON.`);};
assert(h.knownVectors.empty==='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855','SHA-256 empty vector mismatch.');
assert(h.knownVectors.abc==='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad','SHA-256 abc vector mismatch.');
assert(h.stableStringify({b:1,a:2})==='{"a":2,"b":1}','Canonical object ordering failed.');
assert(h.stableStringify({'10':1,'2':2})==='{"10":1,"2":2}','Canonical ordering must not use JavaScript integer-key enumeration order.');
assert(h.stableStringify({é:1,e:2})==='{"e":2,"é":1}','Unicode scalar object-key ordering failed.');
assert(h.stableStringify({x:Number.MAX_SAFE_INTEGER})===`{"x":${Number.MAX_SAFE_INTEGER}}`,'Positive safe integer boundary failed.');
assert(h.stableStringify({x:Number.MIN_SAFE_INTEGER})===`{"x":${Number.MIN_SAFE_INTEGER}}`,'Negative safe integer boundary failed.');
for(const [name,make] of [
 ['Infinity',()=>({x:Infinity})],['NaN',()=>({x:NaN})],['negative Infinity',()=>({x:-Infinity})],['negative zero',()=>({x:-0})],['fraction',()=>({x:1.25})],['unsafe positive integer',()=>({x:Number.MAX_SAFE_INTEGER+1})],['unsafe negative integer',()=>({x:Number.MIN_SAFE_INTEGER-1})],['unpaired high surrogate',()=>({x:'\uD800'})],['unpaired low surrogate',()=>({x:'\uDC00'})],['unpaired surrogate key',()=>({['\uD800']:1})],['undefined member',()=>({x:undefined})],['undefined array member',()=>[undefined]],['undefined root',()=>undefined],['bigint',()=>({x:1n})],['function',()=>({x(){}})],['symbol value',()=>({x:Symbol('x')})],['symbol key',()=>{const x={};x[Symbol('x')]=1;return x;}],['Date',()=>new Date(0)],['Map',()=>new Map([['x',1]])],['Set',()=>new Set([1])],['sparse array',()=>{const x=[];x.length=1;return x;}],['array property',()=>{const x=[1];x.extra=2;return x;}],['accessor',()=>{const x={};Object.defineProperty(x,'a',{enumerable:true,get(){return 1;}});return x;}],['cycle',()=>{const x={};x.self=x;return x;}]
])reject(name,make);

let undefinedPreimageRejected=false;
try{h.hashRegistered('UNREGISTERED_KIND',{x:1});}catch(error){undefinedPreimageRejected=/UNDEFINED_HASH_PREIMAGE/.test(String(error));}
assert(undefinedPreimageRejected,'Unregistered release-bearing hash preimage must fail closed.');
h.registerHashPreimage('TEST_HASH',{includePointers:['/a','/testMembers'],omitPointers:['/digest'],reasonByOmittedPointer:{'/digest':'Digest field is self-dependent.'}});
h.registerSetSemantics('/testMembers',{elementIdentityKey:'id'});
const registeredA=h.hashRegistered('TEST_HASH',{a:1,testMembers:[{id:'B',value:2},{id:'A',value:1}],digest:'ignored'});
const registeredB=h.hashRegistered('TEST_HASH',{a:1,testMembers:[{id:'A',value:1},{id:'B',value:2}],digest:'different'});
assert(registeredA===registeredB,'Registered set semantics or omission rules are not deterministic.');
let duplicateSetRejected=false;
try{h.hashRegistered('TEST_HASH',{a:1,testMembers:[{id:'A'},{id:'A'}],digest:''});}catch(error){duplicateSetRejected=/Duplicate set element identity/.test(String(error));}
assert(duplicateSetRejected,'Duplicate registered set identities must fail closed.');

assert(h.hashPreimageRegistry.has('CONTENT_RECORD:REQ_ID'),'Requirement content hash preimage is not explicitly registered.');
assert(h.hashPreimageRegistry.has('CANONICAL_RECORD'),'Canonical record hash preimage is not explicitly registered.');
const reqA={fields:{REQ_ID:'REQ-1',REQUIREMENT_TEXT:'Alpha',STATUS:'CURRENT'},relationships:{SOURCE_ID:{recordId:'SOURCE-1'}},evidenceRefs:['EV-1']};
const reqB={fields:{...reqA.fields,REQ_ID:'REQ-2',STATUS:'SUPERSEDED'},relationships:reqA.relationships,evidenceRefs:reqA.evidenceRefs};
assert(h.contentRecordSha256(reqA,'REQ_ID')===h.contentRecordSha256(reqB,'REQ_ID'),'Content identity must exclude canonical record identity and lifecycle status.');
let unknownContentRejected=false;try{h.contentRecordSha256({fields:{UNKNOWN_ID:'X'},relationships:{},evidenceRefs:[]},'UNKNOWN_ID');}catch(error){unknownContentRejected=/UNDEFINED_HASH_PREIMAGE/.test(String(error));}assert(unknownContentRejected,'Unknown canonical record ID fields must not acquire ad hoc content hashing semantics.');
const recordA={recordId:'R-1',fields:{REQ_ID:'REQ-1',REQUIREMENT_TEXT:'Alpha'},relationships:{},evidenceRefs:[],recordSha256:'old',sha256:'legacy'};
const recordB={...recordA,recordSha256:'different',sha256:'different'};
assert(h.recordSha256(recordA)===h.recordSha256(recordB),'Canonical record digest must omit its own digest aliases.');
const allocation=h.allocateCanonicalIdWithCollisionCheck({familyPrefix:'REQ',familyNamespace:'requirements',jobNamespace:'JOB-1',commandId:'CMD-1',targetSlot:'SLOT-1',parentId:'',allocationSequence:1},{exists:()=>false});
assert(/^REQ-[0-9a-v]{32}$/.test(allocation.id),'closed-loop-id/1 output format is invalid.');
const retry=h.allocateCanonicalIdWithCollisionCheck({familyPrefix:'REQ',familyNamespace:'requirements',jobNamespace:'JOB-1',commandId:'CMD-1',targetSlot:'SLOT-1',parentId:'',allocationSequence:1},{exists:id=>id===allocation.id?allocation.payload:false});
assert(retry.id===allocation.id&&retry.exactRetry===true,'Exact canonical-ID retry must return the original allocation identity.');

assert(h.filenameVersion==='closed-loop-filename/1','Filename contract identity is not pinned.');
assert(h.unicodeVersion==='Unicode 15.1.0','Unicode behavior identity is not pinned.');
assert(h.trustedTimeVersion==='closed-loop-trusted-time/1','Trusted-time contract identity is not pinned.');
assert(h.normalizeFilename('report.txt').canonicalPath==='report.txt','Filename normalization failed.');
for(const invalidFilename of ['../x','/abs.txt','C:\\abs.txt','bad\0name','é.txt']){let rejected=false;try{h.normalizeFilename(invalidFilename);}catch{rejected=true;}assert(rejected,`Unsafe filename ${JSON.stringify(invalidFilename)} was accepted.`);}
let caseCollisionRejected=false;try{h.assertFilenameSetSafe(['A.txt','a.txt']);}catch{caseCollisionRejected=true;}assert(caseCollisionRejected,'Case-fold collision was accepted.');
let confusableCollisionRejected=false;try{h.assertFilenameSetSafe(['m.txt','rn.txt']);}catch{confusableCollisionRejected=true;}assert(confusableCollisionRejected,'Supported confusable collision was accepted.');
assert(h.normalizeMachineTime('2026-09-03T07:34:56-05:00').normalizedValue==='2026-09-03T12:34:56.000Z','Offset-bearing RFC 3339 normalization failed.');
for(const invalidTime of ['2026-09-03T12:34:56','2026-09-03T12:34:60Z','2026-02-30']){let rejected=false;try{h.normalizeMachineTime(invalidTime);}catch{rejected=true;}assert(rejected,`Unsupported time ${invalidTime} was accepted.`);}
let unverifiedTrustedTimeRejected=false;try{h.validateTrustedTimeEvidence({basis:'VERIFIED_EXTERNAL',time:'2026-09-03T12:34:56Z'});}catch{unverifiedTrustedTimeRejected=true;}assert(unverifiedTrustedTimeRejected,'VERIFIED_EXTERNAL time without a verification contract was accepted.');

const index=fs.readFileSync('index.html','utf8');
const scripts=[...index.matchAll(/<script\s+src="\.\/([^"?]+)\?b=([^"]+)"/g)].map(match=>({file:match[1],build:match[2]}));
assert(scripts.length===9,'Runtime must contain exactly the nine controlling script entries.');
assert(new Set(scripts.map(x=>x.build)).size===1,'All runtime scripts must share one build identity.');
const worker=fs.readFileSync('test-runtime.js','utf8');
assert(/test-worker\.js\?b=/.test(worker),'Worker URL must carry the shared build/cache identity.');
assert(fs.readFileSync('verify-complete.mjs','utf8').includes('Stage 04 input MUST NOT ask the user to attach, resend, or resupply'),'Stage 04 no-repeat attachment regression control is missing.');

console.log(JSON.stringify({sha256Vectors:true,canonicalOrdering:true,integerLikeKeyOrdering:true,unicodeScalarOrdering:true,safeIntegerBoundaries:true,ambiguousValuesRejected:24,registeredHashPreimageFailureClosed:true,registeredSetSemantics:true,contentRecordPreimagesRegistered:true,unknownContentHashKindRejected:true,canonicalRecordPreimageRegistered:true,closedLoopIdStable:true,closedLoopIdCollisionChecked:true,filenameContract:true,unicodeIdentity:h.unicodeVersion,trustedTimeContract:true,sharedBuildIdentity:scripts[0].build,runtimeScriptCount:scripts.length,workerSharesBuildIdentity:true,stage04RepeatAttachmentControlAbsent:true}));

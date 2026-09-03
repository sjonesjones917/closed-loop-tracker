(()=>{
'use strict';

const MAX_SAFE_INTEGER=Number.MAX_SAFE_INTEGER;
const MIN_SAFE_INTEGER=Number.MIN_SAFE_INTEGER;
const CANONICALIZATION_VERSION='closed-loop-canonical-json/1';
const ID_VERSION='closed-loop-id/1';
const FILENAME_VERSION='closed-loop-filename/1';
const TRUSTED_TIME_VERSION='closed-loop-trusted-time/1';
const UNICODE_VERSION='15.1.0';
const UNICODE_SOURCE_IDENTITY='unicode-15.1.0/final-15.1-20230908';
const UNICODE_SOURCE_COMMIT='9595f090650e99e3e752b37a7a3866ac8a91999b';
const CASE_FOLDING_BLOB_SHA1='69c5c64b4c6a124f4608722db723a9e32667f190';
const BASE32HEX_ALPHABET='0123456789abcdefghijklmnopqrstuv';

function assertUnicodeScalars(value,path){
  for(let i=0;i<value.length;i++){
    const unit=value.charCodeAt(i);
    if(unit>=0xD800&&unit<=0xDBFF){
      const next=value.charCodeAt(i+1);
      if(!(next>=0xDC00&&next<=0xDFFF))throw new TypeError(`Cannot canonically hash unpaired UTF-16 high surrogate at ${path}.`);
      i++;
    }else if(unit>=0xDC00&&unit<=0xDFFF)throw new TypeError(`Cannot canonically hash unpaired UTF-16 low surrogate at ${path}.`);
  }
  return value;
}
function compareUnicodeScalarSequence(a,b){
  const left=Array.from(assertUnicodeScalars(String(a),'object key'),ch=>ch.codePointAt(0));
  const right=Array.from(assertUnicodeScalars(String(b),'object key'),ch=>ch.codePointAt(0));
  const length=Math.min(left.length,right.length);
  for(let i=0;i<length;i++)if(left[i]!==right[i])return left[i]-right[i];
  return left.length-right.length;
}
function stableStringify(value){
  const seen=new WeakSet();
  const encodeString=(input,path)=>JSON.stringify(assertUnicodeScalars(String(input),path));
  const serialize=(input,path='$')=>{
    if(input===null)return 'null';
    const type=typeof input;
    if(type==='string')return encodeString(input,path);
    if(type==='boolean')return input?'true':'false';
    if(type==='number'){
      if(!Number.isFinite(input))throw new TypeError(`Cannot canonically hash non-finite number at ${path}.`);
      if(Object.is(input,-0))throw new TypeError(`Cannot canonically hash negative zero at ${path}.`);
      if(!Number.isSafeInteger(input)||input<MIN_SAFE_INTEGER||input>MAX_SAFE_INTEGER)throw new TypeError(`Cannot canonically hash non-safe-integer JSON number at ${path}; use the owning schema's typed decimal-string representation.`);
      return String(input);
    }
    if(type!=='object')throw new TypeError(`Cannot canonically hash ${type} at ${path}.`);
    if(seen.has(input))throw new TypeError(`Cannot hash a cyclic value at ${path}.`);
    seen.add(input);
    try{
      if(Array.isArray(input)){
        const keys=Object.keys(input);
        for(let index=0;index<input.length;index++)if(!Object.prototype.hasOwnProperty.call(input,index))throw new TypeError(`Cannot canonically hash sparse array at ${path}.`);
        if(keys.some(key=>!/^\d+$/.test(key)||Number(key)>=input.length))throw new TypeError(`Cannot canonically hash array with extra properties at ${path}.`);
        return `[${input.map((item,index)=>serialize(item,`${path}[${index}]`)).join(',')}]`;
      }
      const prototype=Object.getPrototypeOf(input);
      if(prototype!==Object.prototype&&prototype!==null)throw new TypeError(`Cannot canonically hash non-plain object at ${path}.`);
      if(Object.getOwnPropertySymbols(input).length)throw new TypeError(`Cannot canonically hash symbol-keyed properties at ${path}.`);
      const keys=Object.keys(input);
      for(const key of keys)assertUnicodeScalars(key,`${path} object key`);
      keys.sort(compareUnicodeScalarSequence);
      const members=[];
      for(const key of keys){
        const descriptor=Object.getOwnPropertyDescriptor(input,key);
        if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))throw new TypeError(`Cannot canonically hash accessor property at ${path}.${key}.`);
        members.push(`${encodeString(key,`${path} object key`)}:${serialize(descriptor.value,`${path}.${key}`)}`);
      }
      return `{${members.join(',')}}`;
    }finally{seen.delete(input);}
  };
  return serialize(value);
}

function rightRotate(value,amount){return (value>>>amount)|(value<<(32-amount));}
function sha256Text(text){
  const utf8=new TextEncoder().encode(String(text));
  const bitLength=utf8.length*8;
  const withMarker=utf8.length+1;
  const paddedLength=((withMarker+8+63)>>6)<<6;
  const bytes=new Uint8Array(paddedLength);
  bytes.set(utf8);
  bytes[utf8.length]=0x80;
  const view=new DataView(bytes.buffer);
  const high=Math.floor(bitLength/0x100000000);
  const low=bitLength>>>0;
  view.setUint32(paddedLength-8,high,false);
  view.setUint32(paddedLength-4,low,false);
  const k=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  const h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const w=new Uint32Array(64);
  for(let offset=0;offset<bytes.length;offset+=64){
    for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4,false);
    for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];const s0=(rightRotate(x,7)^rightRotate(x,18)^(x>>>3))>>>0;const s1=(rightRotate(y,17)^rightRotate(y,19)^(y>>>10))>>>0;w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}
    let [a,b,c,d,e,f,g,hh]=h;
    for(let i=0;i<64;i++){const s1=(rightRotate(e,6)^rightRotate(e,11)^rightRotate(e,25))>>>0;const ch=((e&f)^((~e)&g))>>>0;const t1=(hh+s1+ch+k[i]+w[i])>>>0;const s0=(rightRotate(a,2)^rightRotate(a,13)^rightRotate(a,22))>>>0;const maj=((a&b)^(a&c)^(b&c))>>>0;const t2=(s0+maj)>>>0;hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    h[0]=(h[0]+a)>>>0;h[1]=(h[1]+b)>>>0;h[2]=(h[2]+c)>>>0;h[3]=(h[3]+d)>>>0;h[4]=(h[4]+e)>>>0;h[5]=(h[5]+f)>>>0;h[6]=(h[6]+g)>>>0;h[7]=(h[7]+hh)>>>0;
  }
  return Array.from(h,value=>value.toString(16).padStart(8,'0')).join('');
}
function sha256Value(value){return sha256Text(stableStringify(value));}
function bytesToHex(bytes){return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');}
function hexToBytes(hex){const text=String(hex||'').toLowerCase();if(!/^[0-9a-f]+$/.test(text)||text.length%2)throw new TypeError('hexToBytes requires an even-length hexadecimal string.');const out=new Uint8Array(text.length/2);for(let i=0;i<out.length;i++)out[i]=parseInt(text.slice(i*2,i*2+2),16);return out;}
async function sha256Bytes(bytes){let view;if(bytes instanceof ArrayBuffer)view=new Uint8Array(bytes);else if(ArrayBuffer.isView(bytes))view=new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength);else if(bytes instanceof Blob)view=new Uint8Array(await bytes.arrayBuffer());else throw new TypeError('sha256Bytes requires an ArrayBuffer, ArrayBuffer view, or Blob.');return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',view)));}
function rawResponseSha256(raw){return sha256Text(String(raw??''));}
function canonicalEnvelopeSha256(envelope){return sha256Value(envelope);}

const HASH_PREIMAGE_REGISTRY=new Map();
const SET_SEMANTICS_REGISTRY=new Map();
function freezePointers(values){return Object.freeze([...new Set((values||[]).map(value=>String(value)))]);}
function registerHashPreimage(kind,{includePointers=[],omitPointers=[],reasonByOmittedPointer={}}={}){const id=String(kind||'').trim();if(!id)throw new TypeError('Hash kind is required.');if(HASH_PREIMAGE_REGISTRY.has(id))throw new TypeError(`Hash kind ${id} is already registered.`);const include=freezePointers(includePointers),omit=freezePointers(omitPointers);if(!include.length)throw new TypeError(`Hash kind ${id} requires an explicit nonempty inclusion set.`);for(const pointer of omit)if(!String(reasonByOmittedPointer[pointer]||'').trim())throw new TypeError(`Hash kind ${id} omission ${pointer} requires a registered reason.`);const entry=Object.freeze({kind:id,includePointers:include,omitPointers:omit,reasonByOmittedPointer:Object.freeze({...reasonByOmittedPointer})});HASH_PREIMAGE_REGISTRY.set(id,entry);return entry;}
function registerSetSemantics(pointer,{elementIdentityKey,duplicateRule='REJECT',sortRule='CANONICAL_BYTE_ORDER_OVER_ELEMENT_IDENTITY'}={}){const id=String(pointer||'').trim();if(!id.startsWith('/'))throw new TypeError('Set pointer must be an absolute JSON pointer.');if(SET_SEMANTICS_REGISTRY.has(id))throw new TypeError(`Set semantics for ${id} are already registered.`);if(!String(elementIdentityKey||'').trim())throw new TypeError(`Set semantics for ${id} require an element identity key.`);if(duplicateRule!=='REJECT'||sortRule!=='CANONICAL_BYTE_ORDER_OVER_ELEMENT_IDENTITY')throw new TypeError(`Set semantics for ${id} must use the controlling duplicate and sort rules.`);const entry=Object.freeze({pointer:id,elementIdentityKey:String(elementIdentityKey),duplicateRule,sortRule});SET_SEMANTICS_REGISTRY.set(id,entry);return entry;}
function decodePointerSegment(segment){return segment.replace(/~1/g,'/').replace(/~0/g,'~');}
function encodePointerSegment(segment){return String(segment).replace(/~/g,'~0').replace(/\//g,'~1');}
function getPointer(root,pointer){if(pointer==='')return root;if(!pointer.startsWith('/'))throw new TypeError(`Invalid JSON pointer ${pointer}.`);let value=root;for(const raw of pointer.slice(1).split('/')){const key=decodePointerSegment(raw);if(value===null||typeof value!=='object'||!Object.prototype.hasOwnProperty.call(value,key))throw new TypeError(`Registered hash preimage pointer ${pointer} is missing.`);value=value[key];}return value;}
function setPointer(root,pointer,value){if(pointer==='')return value;const parts=pointer.slice(1).split('/').map(decodePointerSegment);let current=root;for(let i=0;i<parts.length-1;i++){const key=parts[i];current[key]??={};current=current[key];}current[parts.at(-1)]=value;return root;}
function deletePointer(root,pointer){if(pointer==='')throw new TypeError('A registered hash preimage cannot omit the selected root.');if(!pointer.startsWith('/'))throw new TypeError(`Invalid JSON pointer ${pointer}.`);const parts=pointer.slice(1).split('/').map(decodePointerSegment);let current=root;for(let i=0;i<parts.length-1;i++){const key=parts[i];if(current===null||typeof current!=='object'||!Object.prototype.hasOwnProperty.call(current,key))return false;current=current[key];}if(current===null||typeof current!=='object')return false;return delete current[parts.at(-1)];}
function cloneCanonicalValue(value){return JSON.parse(stableStringify(value));}
function normalizedRegisteredValue(pointer,value){const semantics=SET_SEMANTICS_REGISTRY.get(pointer);if(!semantics)return value;if(!Array.isArray(value))throw new TypeError(`Registered set pointer ${pointer} must resolve to an array.`);const seen=new Set();const copy=value.map(item=>{if(item===null||typeof item!=='object'||Array.isArray(item)||!Object.prototype.hasOwnProperty.call(item,semantics.elementIdentityKey))throw new TypeError(`Set element at ${pointer} lacks identity key ${semantics.elementIdentityKey}.`);const identity=stableStringify(item[semantics.elementIdentityKey]);if(seen.has(identity))throw new TypeError(`Duplicate set element identity at ${pointer}.`);seen.add(identity);return item;});copy.sort((a,b)=>compareUnicodeScalarSequence(stableStringify(a[semantics.elementIdentityKey]),stableStringify(b[semantics.elementIdentityKey])));return copy;}
function registeredHashPreimage(kind,subject){const entry=HASH_PREIMAGE_REGISTRY.get(String(kind));if(!entry)throw new TypeError(`UNDEFINED_HASH_PREIMAGE: ${kind}.`);let out={};for(const pointer of entry.includePointers){const selected=cloneCanonicalValue(normalizedRegisteredValue(pointer,getPointer(subject,pointer)));out=setPointer(out,pointer,selected);}for(const pointer of entry.omitPointers)deletePointer(out,pointer);return out;}
function hashRegistered(kind,subject){return sha256Value(registeredHashPreimage(kind,subject));}

const CONTENT_RECORD_ID_FIELDS=Object.freeze([
  'SOURCE_ID','CONFLICT_ID','RESEARCH_ID','CANDIDATE_REQ_ID','REQ_ID','RESOLUTION_ID','TEST_ID','MUTATION_ID','INSTRUCTION_ID','REVIEW_ID','ITERATION_ID','CANDIDATE_ID','RUN_ID','VERIFICATION_ID','COMPARISON_ID','DEFECT_ID','RCA_ID','REG_ID','CHANGESET_ID','CONVERGENCE_ID','CONFIRMATION_ID','BASELINE_ID','PRODUCT_ID','RESULT_ID','MEANING_REVIEW_ID','ATTACK_ID','INSPECTION_ID','PROCESS_AUDIT_ID','PRODUCT_AUDIT_ID','GATE_REVIEW_ID','RELEASE_ID','IDENTITY_ID','INVESTIGATION_ID','CHAIN_ID','TRACE_ID','REG_EXEC_ID','BLOCKER_ID','CONTEXT_ID','EVIDENCE_ID','ARTIFACT_ID','PROPOSITION_ID','PROP_EQ_REVIEW_ID','APPLICABILITY_ID','PROOF_EXPRESSION_ID','PROOF_OBLIGATION_ID','OBSERVATION_ID','ENTAILMENT_ID','DEPENDENCY_ID','OPERATION_RESERVATION_ID','DELIVERY_ID','DEPLOYMENT_MANIFEST_ID','HUMAN_DECISION_ID','SOURCE_SEARCH_CONTRACT_ID','SEMANTIC_CHALLENGE_ID','SEMANTIC_REVIEW_ID','VARIANCE_CONTRACT_ID','ENVIRONMENT_MANIFEST_ID','CAPABILITY_ID','MATERIALITY_REVIEW_ID','COMMAND_RECEIPT_ID','BACKUP_POLICY_ID','CHECKPOINT_ID','DELIVERY_CANDIDATE_SET_ID','DELIVERY_ATTEMPT_ID','MOBILE_ACCEPTANCE_RECORD_ID'
]);
const CONTENT_RECORD_NONCONTENT_FIELDS=Object.freeze(['CREATED_AT','UPDATED_AT','VERSION','STATUS']);
for(const idField of CONTENT_RECORD_ID_FIELDS){
  const omitted=[idField,...CONTENT_RECORD_NONCONTENT_FIELDS].map(name=>`/fields/${encodePointerSegment(name)}`);
  const reasons=Object.fromEntries(omitted.map(pointer=>[pointer,pointer===`/fields/${encodePointerSegment(idField)}`?'Canonical record identity is excluded from content identity.':'Lifecycle or audit metadata is excluded from content identity.']));
  registerHashPreimage(`CONTENT_RECORD:${idField}`,{includePointers:['/fields','/relationships','/evidenceRefs'],omitPointers:omitted,reasonByOmittedPointer:reasons});
}
registerHashPreimage('CANONICAL_RECORD',{includePointers:[''],omitPointers:['/recordSha256','/sha256'],reasonByOmittedPointer:{'/recordSha256':'The record digest cannot include itself.','/sha256':'A legacy digest alias cannot participate in the canonical record digest.'}});

function contentRecordValue(record,idField){return registeredHashPreimage(`CONTENT_RECORD:${String(idField||'')}`,{fields:record?.fields||{},relationships:record?.relationships||{},evidenceRefs:record?.evidenceRefs||[]});}
function contentRecordSha256(record,idField){return hashRegistered(`CONTENT_RECORD:${String(idField||'')}`,{fields:record?.fields||{},relationships:record?.relationships||{},evidenceRefs:record?.evidenceRefs||[]});}
function recordSha256(record){return hashRegistered('CANONICAL_RECORD',record||{});}

function base32hex(bytes){const input=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);let buffer=0,bits=0,out='';for(const byte of input){buffer=(buffer<<8)|byte;bits+=8;while(bits>=5){bits-=5;out+=BASE32HEX_ALPHABET[(buffer>>>bits)&31];buffer&=(1<<bits)-1;}}if(bits)out+=BASE32HEX_ALPHABET[(buffer<<(5-bits))&31];return out;}
function canonicalIdPayload({familyNamespace,jobNamespace,commandId,targetSlot='',parentId='',allocationSequence,collisionCounter=0}){if(!String(familyNamespace||'').trim())throw new TypeError('familyNamespace is required.');if(!String(jobNamespace||'').trim())throw new TypeError('jobNamespace is required.');if(!String(commandId||'').trim())throw new TypeError('commandId is required.');for(const [name,value] of [['allocationSequence',allocationSequence],['collisionCounter',collisionCounter]])if(!Number.isSafeInteger(value)||value<0)throw new TypeError(`${name} must be a nonnegative safe integer.`);return {idVersion:ID_VERSION,familyNamespace:String(familyNamespace),jobNamespace:String(jobNamespace),commandId:String(commandId),targetSlot:String(targetSlot||''),parentId:String(parentId||''),allocationSequence,collisionCounter};}
function allocateCanonicalId({familyPrefix,...tuple}){const prefix=String(familyPrefix||'');if(!/^[A-Z][A-Z0-9_]*$/.test(prefix))throw new TypeError('familyPrefix must be a registered uppercase ASCII prefix.');const payload=canonicalIdPayload(tuple);const digestBytes=hexToBytes(sha256Value(payload)).slice(0,20);return {id:`${prefix}-${base32hex(digestBytes)}`,payload,digestHex:bytesToHex(digestBytes),idVersion:ID_VERSION};}
function allocateCanonicalIdWithCollisionCheck(options,{exists,maxCollisionCounter=1024}={}){if(typeof exists!=='function')throw new TypeError('A collision-check function is required.');for(let collisionCounter=0;collisionCounter<=maxCollisionCounter;collisionCounter++){const allocation=allocateCanonicalId({...options,collisionCounter});const existing=exists(allocation.id);if(existing===false||existing===null||existing===undefined)return {...allocation,collisionCounter};if(existing&&stableStringify(existing)===stableStringify(allocation.payload))return {...allocation,collisionCounter,exactRetry:true};}throw new Error('Canonical ID collision counter exhausted.');}

const UNICODE_CONTRACT=Object.freeze({version:UNICODE_VERSION,sourceIdentity:UNICODE_SOURCE_IDENTITY,sourceCommit:UNICODE_SOURCE_COMMIT,caseFoldingBlobSha1:CASE_FOLDING_BLOB_SHA1,nfcContract:'Unicode 15.1.0 NFC',defaultCaseFoldContract:'Unicode 15.1.0 default case folding (C+F, T excluded)',confusableContract:'Unicode 15.1.0 UTS #39 confusables',filenameAcceptedRepertoire:'ASCII U+0020..U+007E excluding path/control hazards; non-ASCII fails closed until pinned full tables are bundled'});
function assertPinnedUnicodeHost(){
  if(typeof ''.normalize!=='function')throw new Error('UNICODE_TABLE_UNAVAILABLE: String normalization is unavailable.');
  const nfcFixtures=[['e\u0301','é'],['A\u030A','Å'],['\u212B','Å']];
  for(const [input,expected] of nfcFixtures)if(input.normalize('NFC')!==expected)throw new Error('UNICODE_TABLE_MISMATCH: host NFC behavior failed pinned Unicode 15.1 fixture.');
  return UNICODE_CONTRACT;
}
function asciiCaseFold(value){const text=String(value);if(/[^\x20-\x7E]/.test(text))throw new TypeError('UNSUPPORTED_UNICODE_FILENAME: non-ASCII filename requires pinned full Unicode 15.1 case-fold/confusable tables.');return text.replace(/[A-Z]/g,ch=>ch.toLowerCase());}
function filenameRiskSkeleton(value){const folded=asciiCaseFold(value);return folded.replace(/0/g,'o').replace(/[1lI]/g,'i').replace(/5/g,'s');}
function normalizeFilename(rawFilename,{allowPath=false}={}){
  assertPinnedUnicodeHost();
  const raw=assertUnicodeScalars(String(rawFilename??''),'filename');
  if(!raw)throw new TypeError('UNSAFE_FILENAME: filename is empty.');
  if(/[\x00-\x1F\x7F]/.test(raw))throw new TypeError('UNSAFE_FILENAME: control characters are prohibited.');
  if(/^[A-Za-z]:/.test(raw)||raw.startsWith('/')||raw.startsWith('\\'))throw new TypeError('UNSAFE_FILENAME: absolute paths and drive prefixes are prohibited.');
  if(!allowPath&&/[\\/]/.test(raw))throw new TypeError('UNSAFE_FILENAME: path separators are prohibited in a filename.');
  const segments=allowPath?raw.split(/[\\/]/):[raw];
  if(segments.some(segment=>!segment||segment==='.'||segment==='..'))throw new TypeError('UNSAFE_FILENAME: empty, dot, and parent segments are prohibited.');
  for(const segment of segments){if(/[. ]$/.test(segment))throw new TypeError('UNSAFE_FILENAME: trailing dot or space is prohibited.');if(/[^\x20-\x7E]/.test(segment))throw new TypeError('UNSUPPORTED_UNICODE_FILENAME: non-ASCII filename fails closed until pinned full Unicode 15.1 tables are bundled.');}
  const canonicalPath=segments.map(segment=>segment.normalize('NFC')).join('/');
  const displayFilename=segments.at(-1);
  return Object.freeze({filenameVersion:FILENAME_VERSION,unicodeVersion:UNICODE_VERSION,rawFilename:raw,displayFilename,canonicalPath,caseFoldCollisionKey:asciiCaseFold(canonicalPath),platformRiskCollisionKey:filenameRiskSkeleton(canonicalPath)});
}
function filenameCollisionKeys(filename){const normalized=normalizeFilename(filename,{allowPath:true});return Object.freeze([normalized.canonicalPath,normalized.caseFoldCollisionKey,normalized.platformRiskCollisionKey]);}

const RFC3339_INSTANT=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;
const DATE_ONLY=/^(\d{4})-(\d{2})-(\d{2})$/;
function validCalendarDate(year,month,day){const date=new Date(Date.UTC(year,month-1,day));return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;}
function normalizeDateTime(value){
  const input=String(value??'');
  let match=input.match(DATE_ONLY);
  if(match){const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);if(!validCalendarDate(year,month,day))throw new TypeError('INVALID_DATE_TIME: invalid date-only value.');return Object.freeze({version:TRUSTED_TIME_VERSION,kind:'DATE_ONLY',original:input,normalized:input,timeBasis:'NOT_APPLICABLE'});}
  match=input.match(RFC3339_INSTANT);
  if(!match)throw new TypeError('INVALID_DATE_TIME: value must be RFC 3339 date-only or instant.');
  const [,ys,mos,ds,hs,mis,ss,fraction='',zone]=match;
  const year=Number(ys),month=Number(mos),day=Number(ds),hour=Number(hs),minute=Number(mis),second=Number(ss);
  if(second===60)throw new TypeError('INVALID_DATE_TIME: leap seconds are rejected.');
  if(!validCalendarDate(year,month,day)||hour>23||minute>59||second>59)throw new TypeError('INVALID_DATE_TIME: invalid calendar or clock component.');
  let offsetMinutes=0;
  if(zone!=='Z'){const sign=zone[0]==='-'?-1:1,oh=Number(zone.slice(1,3)),om=Number(zone.slice(4,6));if(oh>23||om>59)throw new TypeError('INVALID_DATE_TIME: invalid UTC offset.');offsetMinutes=sign*(oh*60+om);}
  const millis=Number((fraction+'000').slice(0,3));
  const epoch=Date.UTC(year,month-1,day,hour,minute,second,millis)-offsetMinutes*60000;
  const normalized=new Date(epoch).toISOString();
  return Object.freeze({version:TRUSTED_TIME_VERSION,kind:'INSTANT',original:input,normalized,timeBasis:'DEVICE_REPORTED'});
}
function evaluateTrustedTimeEvidence({basis='NONE',attestationContractId=null,attributableExternalSystem=false}={}){
  const normalizedBasis=String(basis||'NONE');
  if(normalizedBasis==='VERIFIED_EXTERNAL'){
    if(!String(attestationContractId||'').trim()&&!attributableExternalSystem)throw new TypeError('TRUSTED_TIME_UNVERIFIED: VERIFIED_EXTERNAL requires a registered attestation contract or accepted attributable external-system time authority.');
    return Object.freeze({version:TRUSTED_TIME_VERSION,basis:'VERIFIED_EXTERNAL',trusted:true,attestationContractId:attestationContractId||null,attributableExternalSystem:Boolean(attributableExternalSystem)});
  }
  if(!['DEVICE_REPORTED','SOURCE_ASSERTED','EXTERNALLY_SUPPORTED','SELF_ASSERTED','NONE'].includes(normalizedBasis))throw new TypeError('TRUSTED_TIME_BASIS_UNKNOWN');
  return Object.freeze({version:TRUSTED_TIME_VERSION,basis:normalizedBasis,trusted:false,attestationContractId:null,attributableExternalSystem:false});
}

const api={version:'closed-loop-hash/6',canonicalizationVersion:CANONICALIZATION_VERSION,idVersion:ID_VERSION,filenameVersion:FILENAME_VERSION,trustedTimeVersion:TRUSTED_TIME_VERSION,unicodeContract:UNICODE_CONTRACT,stableStringify,compareUnicodeScalarSequence,sha256Text,sha256Value,sha256Bytes,rawResponseSha256,canonicalEnvelopeSha256,contentRecordValue,contentRecordSha256,recordSha256,registerHashPreimage,registerSetSemantics,registeredHashPreimage,hashRegistered,allocateCanonicalId,allocateCanonicalIdWithCollisionCheck,base32hex,assertPinnedUnicodeHost,normalizeFilename,filenameCollisionKeys,normalizeDateTime,evaluateTrustedTimeEvidence,hashPreimageRegistry:HASH_PREIMAGE_REGISTRY,setSemanticsRegistry:SET_SEMANTICS_REGISTRY,contentRecordIdFields:CONTENT_RECORD_ID_FIELDS,knownVectors:Object.freeze({empty:sha256Text(''),abc:sha256Text('abc')})};
globalThis.closedLoopHash=Object.freeze(api);

})();

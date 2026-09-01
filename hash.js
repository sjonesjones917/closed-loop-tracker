(()=>{
'use strict';

const MAX_SAFE_INTEGER=Number.MAX_SAFE_INTEGER;
const MIN_SAFE_INTEGER=Number.MIN_SAFE_INTEGER;
const HASH_ALGORITHM='SHA-256';
const CANONICALIZATION_VERSION='closed-loop-canonical-json/1';
const HASH_PROFILES=Object.freeze({
  contentRecord:Object.freeze({
    version:'closed-loop-content-record-hash/1',
    includedPointers:Object.freeze(['/fields/*','/relationships','/evidenceRefs']),
    excludedFieldNames:Object.freeze(['CREATED_AT','UPDATED_AT','VERSION','STATUS']),
    excludesSchemaIdField:true
  }),
  completeRecord:Object.freeze({
    version:'closed-loop-complete-record-hash/1',
    includedPointers:Object.freeze(['/**']),
    excludedRootMembers:Object.freeze(['recordSha256','sha256'])
  }),
  selfDigest:Object.freeze({
    version:'closed-loop-self-digest/1',
    rule:'Omit the owning digest field and every directly dependent self-digest field before canonicalization.'
  })
});

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
  const normalize=(input,path='$')=>{
    if(input===null)return null;
    const type=typeof input;
    if(type==='string')return assertUnicodeScalars(input,path);
    if(type==='boolean')return input;
    if(type==='number'){
      if(!Number.isFinite(input))throw new TypeError(`Cannot canonically hash non-finite number at ${path}.`);
      if(Object.is(input,-0))throw new TypeError(`Cannot canonically hash negative zero at ${path}.`);
      if(!Number.isSafeInteger(input)||input<MIN_SAFE_INTEGER||input>MAX_SAFE_INTEGER)throw new TypeError(`Cannot canonically hash non-safe-integer JSON number at ${path}; use the owning schema's typed decimal-string representation.`);
      return input;
    }
    if(type!=='object')throw new TypeError(`Cannot canonically hash ${type} at ${path}.`);
    if(seen.has(input))throw new TypeError(`Cannot hash a cyclic value at ${path}.`);
    seen.add(input);
    let output;
    if(Array.isArray(input)){
      const keys=Object.keys(input);
      for(let index=0;index<input.length;index++)if(!Object.prototype.hasOwnProperty.call(input,index))throw new TypeError(`Cannot canonically hash sparse array at ${path}.`);
      if(keys.some(key=>!/^\d+$/.test(key)||Number(key)>=input.length))throw new TypeError(`Cannot canonically hash array with extra properties at ${path}.`);
      output=input.map((item,index)=>normalize(item,`${path}[${index}]`));
    }else{
      const prototype=Object.getPrototypeOf(input);
      if(prototype!==Object.prototype&&prototype!==null)throw new TypeError(`Cannot canonically hash non-plain object at ${path}.`);
      if(Object.getOwnPropertySymbols(input).length)throw new TypeError(`Cannot canonically hash symbol-keyed properties at ${path}.`);
      output={};
      const keys=Object.keys(input);
      for(const key of keys)assertUnicodeScalars(key,`${path} object key`);
      keys.sort(compareUnicodeScalarSequence);
      for(const key of keys){
        const descriptor=Object.getOwnPropertyDescriptor(input,key);
        if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))throw new TypeError(`Cannot canonically hash accessor property at ${path}.${key}.`);
        output[key]=normalize(descriptor.value,`${path}.${key}`);
      }
    }
    seen.delete(input);
    return output;
  };
  return JSON.stringify(normalize(value));
}

function rightRotate(value,amount){return (value>>>amount)|(value<<(32-amount));}
const SHA256_TEXT_CACHE_MAX_ENTRIES=512;
const SHA256_TEXT_CACHE_MAX_INPUT_CODE_UNITS=65536;
const SHA256_TEXT_CACHE_MAX_TOTAL_CODE_UNITS=4*1024*1024;
const sha256TextCache=new Map();
let sha256TextCacheCodeUnits=0;
function cachedTextDigest(text){
  if(text.length>SHA256_TEXT_CACHE_MAX_INPUT_CODE_UNITS)return null;
  const digest=sha256TextCache.get(text);
  if(digest===undefined)return null;
  sha256TextCache.delete(text);
  sha256TextCache.set(text,digest);
  return digest;
}
function rememberTextDigest(text,digest){
  if(text.length>SHA256_TEXT_CACHE_MAX_INPUT_CODE_UNITS)return digest;
  const prior=sha256TextCache.get(text);
  if(prior!==undefined){sha256TextCache.delete(text);sha256TextCacheCodeUnits-=text.length;}
  sha256TextCache.set(text,digest);sha256TextCacheCodeUnits+=text.length;
  while(sha256TextCache.size>SHA256_TEXT_CACHE_MAX_ENTRIES||sha256TextCacheCodeUnits>SHA256_TEXT_CACHE_MAX_TOTAL_CODE_UNITS){const oldest=sha256TextCache.keys().next().value;sha256TextCache.delete(oldest);sha256TextCacheCodeUnits-=oldest.length;}
  return digest;
}
function sha256Text(text){
  const exact=assertUnicodeScalars(String(text),'text to hash');
  const cached=cachedTextDigest(exact);if(cached!==null)return cached;
  const utf8=new TextEncoder().encode(exact);
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
  return rememberTextDigest(exact,Array.from(h,value=>value.toString(16).padStart(8,'0')).join(''));
}
function sha256Value(value){return sha256Text(stableStringify(value));}
function bytesToHex(bytes){return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');}
async function sha256Bytes(bytes){let view;if(bytes instanceof ArrayBuffer)view=new Uint8Array(bytes);else if(ArrayBuffer.isView(bytes))view=new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength);else if(bytes instanceof Blob)view=new Uint8Array(await bytes.arrayBuffer());else throw new TypeError('sha256Bytes requires an ArrayBuffer, ArrayBuffer view, or Blob.');return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',view)));}
function rawResponseSha256(raw){return sha256Text(String(raw??''));}
function canonicalEnvelopeSha256(envelope){return sha256Value(envelope);}
function contentRecordValue(record,idField){const fields={...(record?.fields||{})};for(const key of [idField,...HASH_PROFILES.contentRecord.excludedFieldNames])delete fields[key];return {fields,relationships:record?.relationships||{},evidenceRefs:record?.evidenceRefs||[]};}
function contentRecordSha256(record,idField){return sha256Value(contentRecordValue(record,idField));}
function omitRootMembers(value,members,path='digest value'){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError(`${path} must be a plain object.`);
  const prototype=Object.getPrototypeOf(value);
  if(prototype!==Object.prototype&&prototype!==null)throw new TypeError(`${path} must be a plain object.`);
  const omitted=new Set(members||[]),copy={};
  for(const [key,item]of Object.entries(value))if(!omitted.has(key))copy[key]=item;
  return copy;
}
function recordSha256(record){return sha256Value(omitRootMembers(record,HASH_PROFILES.completeRecord.excludedRootMembers,'record'));}
function selfDigestValue(value,{digestField='digest',dependentDigestFields=[]}={}){
  const omitted=[digestField,...dependentDigestFields];
  if(new Set(omitted).size!==omitted.length)throw new TypeError('Self-digest omitted fields must be unique.');
  return sha256Value(omitRootMembers(value,omitted,'self-digest value'));
}
function digestIdentityForText(text){const exact=assertUnicodeScalars(String(text),'text digest identity'),bytes=new TextEncoder().encode(exact);return Object.freeze({hashAlgorithm:HASH_ALGORITHM,digest:sha256Text(exact),byteLength:bytes.byteLength});}
function digestIdentityForValue(value){const canonical=stableStringify(value),bytes=new TextEncoder().encode(canonical);return Object.freeze({hashAlgorithm:HASH_ALGORITHM,digest:sha256Text(canonical),canonicalByteLength:bytes.byteLength,canonicalizationVersion:CANONICALIZATION_VERSION});}
async function digestIdentityForBytes(bytes){let view;if(bytes instanceof ArrayBuffer)view=new Uint8Array(bytes);else if(ArrayBuffer.isView(bytes))view=new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength);else if(bytes instanceof Blob)view=new Uint8Array(await bytes.arrayBuffer());else throw new TypeError('digestIdentityForBytes requires an ArrayBuffer, ArrayBuffer view, or Blob.');return Object.freeze({hashAlgorithm:HASH_ALGORITHM,digest:await sha256Bytes(view),byteLength:view.byteLength});}
globalThis.closedLoopHash=Object.freeze({version:'closed-loop-hash/3',HASH_ALGORITHM,CANONICALIZATION_VERSION,hashAlgorithm:HASH_ALGORITHM,canonicalizationVersion:CANONICALIZATION_VERSION,hashProfiles:HASH_PROFILES,stableStringify,compareUnicodeScalarSequence,sha256Text,sha256Value,sha256Bytes,rawResponseSha256,canonicalEnvelopeSha256,contentRecordValue,contentRecordSha256,recordSha256,selfDigestValue,digestIdentityForText,digestIdentityForValue,digestIdentityForBytes,knownVectors:Object.freeze({empty:sha256Text(''),abc:sha256Text('abc')})});

})();

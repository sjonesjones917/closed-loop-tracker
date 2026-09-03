(()=>{
'use strict';

const MAX_SAFE_INTEGER=Number.MAX_SAFE_INTEGER;
const MIN_SAFE_INTEGER=Number.MIN_SAFE_INTEGER;
const CANONICALIZATION_VERSION='closed-loop-canonical-json/1';
const ID_VERSION='closed-loop-id/1';
const HASH_PREIMAGE_REGISTRY_VERSION='closed-loop-hash-preimages/1';
const SET_SEMANTICS_REGISTRY_VERSION='closed-loop-set-semantics/1';
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
async function sha256Bytes(bytes){let view;if(bytes instanceof ArrayBuffer)view=new Uint8Array(bytes);else if(ArrayBuffer.isView(bytes))view=new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength);else if(bytes instanceof Blob)view=new Uint8Array(await bytes.arrayBuffer());else throw new TypeError('sha256Bytes requires an ArrayBuffer, ArrayBuffer view, or Blob.');return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',view)));}
function rawResponseSha256(raw){return sha256Text(String(raw??''));}
function canonicalEnvelopeSha256(envelope){return sha256Value(envelope);}

const HASH_PREIMAGE_REGISTRY=Object.freeze({
  CANONICAL_ENVELOPE:Object.freeze({id:'CANONICAL_ENVELOPE',version:HASH_PREIMAGE_REGISTRY_VERSION,mode:'WHOLE_VALUE',omitPointers:Object.freeze([])}),
  RECORD:Object.freeze({id:'RECORD',version:HASH_PREIMAGE_REGISTRY_VERSION,mode:'WHOLE_RECORD_EXCEPT',omitPointers:Object.freeze(['/recordSha256','/sha256'])}),
  CONTENT_RECORD:Object.freeze({id:'CONTENT_RECORD',version:HASH_PREIMAGE_REGISTRY_VERSION,mode:'REGISTERED_CONTENT_FIELDS',omitPointers:Object.freeze(['/fields/CREATED_AT','/fields/UPDATED_AT','/fields/VERSION','/fields/STATUS'])}),
  CLOSED_LOOP_ID:Object.freeze({id:'CLOSED_LOOP_ID',version:HASH_PREIMAGE_REGISTRY_VERSION,mode:'EXACT_OBJECT',includePointers:Object.freeze(['/idVersion','/familyNamespace','/jobNamespace','/commandId','/targetSlot','/parentId','/allocationSequence','/collisionCounter'])})
});
const SET_SEMANTICS_REGISTRY=Object.freeze({});
function clonePlain(value){return value===undefined?undefined:JSON.parse(stableStringify(value));}
function omitTopLevel(value,keys){const out={};for(const key of Object.keys(value||{}))if(!keys.has(key))out[key]=value[key];return out;}
function recordSha256(record){return sha256Value(omitTopLevel(record,new Set(['recordSha256','sha256'])));}
function contentRecordValue(record,idField){
  if(typeof idField!=='string'||!idField)throw new TypeError('contentRecordValue requires the registered canonical ID field name.');
  const fields={...(record?.fields||{})};
  for(const key of [idField,'CREATED_AT','UPDATED_AT','VERSION','STATUS'])delete fields[key];
  return {fields,relationships:clonePlain(record?.relationships||{}),evidenceRefs:clonePlain(record?.evidenceRefs||[])};
}
function contentRecordSha256(record,idField){return sha256Value(contentRecordValue(record,idField));}
function registeredHash(kind,value,{idField}={}){
  if(!Object.prototype.hasOwnProperty.call(HASH_PREIMAGE_REGISTRY,kind))throw new TypeError(`UNDEFINED_HASH_PREIMAGE: ${kind}`);
  if(kind==='CANONICAL_ENVELOPE')return sha256Value(value);
  if(kind==='RECORD')return recordSha256(value);
  if(kind==='CONTENT_RECORD')return contentRecordSha256(value,idField);
  if(kind==='CLOSED_LOOP_ID')return sha256Value(value);
  throw new TypeError(`UNDEFINED_HASH_PREIMAGE: ${kind}`);
}

function hexToBytes(hex){if(!/^[0-9a-f]+$/i.test(hex)||hex.length%2)throw new TypeError('hexToBytes requires an even-length hexadecimal string.');const out=new Uint8Array(hex.length/2);for(let i=0;i<out.length;i++)out[i]=parseInt(hex.slice(i*2,i*2+2),16);return out;}
function base32hex(bytes){
  let bits=0,value=0,out='';
  for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=BASE32HEX_ALPHABET[(value>>>(bits-5))&31];bits-=5;}}
  if(bits)out+=BASE32HEX_ALPHABET[(value<<(5-bits))&31];
  return out;
}
function assertIdToken(value,name,{allowEmpty=false}={}){const text=String(value??'');if(!allowEmpty&&!text)throw new TypeError(`${name} is required for ${ID_VERSION}.`);if(/[\u0000-\u001f\u007f]/.test(text))throw new TypeError(`${name} contains a control character.`);assertUnicodeScalars(text,name);return text;}
function canonicalIdPreimage({familyNamespace,jobNamespace,commandId,targetSlot='',parentId='',allocationSequence,collisionCounter=0}){
  if(!Number.isSafeInteger(allocationSequence)||allocationSequence<0)throw new TypeError('allocationSequence must be a nonnegative safe integer.');
  if(!Number.isSafeInteger(collisionCounter)||collisionCounter<0)throw new TypeError('collisionCounter must be a nonnegative safe integer.');
  return {
    idVersion:ID_VERSION,
    familyNamespace:assertIdToken(familyNamespace,'familyNamespace'),
    jobNamespace:assertIdToken(jobNamespace,'jobNamespace'),
    commandId:assertIdToken(commandId,'commandId'),
    targetSlot:assertIdToken(targetSlot,'targetSlot',{allowEmpty:true}),
    parentId:assertIdToken(parentId,'parentId',{allowEmpty:true}),
    allocationSequence,
    collisionCounter
  };
}
function canonicalIdPayload(input){const digest=sha256Value(canonicalIdPreimage(input));return base32hex(hexToBytes(digest).slice(0,20));}
function canonicalId({familyPrefix,...input}){
  const prefix=String(familyPrefix??'');
  if(!/^[A-Z][A-Z0-9_]*$/.test(prefix))throw new TypeError('familyPrefix must be the registered uppercase ASCII family prefix.');
  return `${prefix}-${canonicalIdPayload(input)}`;
}
function allocateCanonicalId(input,{exists=()=>false,maxCollisions=100000}={}){
  if(typeof exists!=='function')throw new TypeError('exists must be a collision-check function.');
  for(let collisionCounter=input.collisionCounter??0;collisionCounter<=maxCollisions;collisionCounter++){
    const tuple={...input,collisionCounter};const id=canonicalId(tuple);
    const existing=exists(id,canonicalIdPreimage(tuple));
    if(!existing)return Object.freeze({id,collisionCounter,preimage:canonicalIdPreimage(tuple),algorithmVersion:ID_VERSION,hashPreimageRegistryVersion:HASH_PREIMAGE_REGISTRY_VERSION});
    if(existing===true)continue;
    if(existing&&stableStringify(existing)===stableStringify(canonicalIdPreimage(tuple)))return Object.freeze({id,collisionCounter,preimage:canonicalIdPreimage(tuple),algorithmVersion:ID_VERSION,hashPreimageRegistryVersion:HASH_PREIMAGE_REGISTRY_VERSION,idempotent:true});
  }
  throw new Error('Canonical ID collision limit exceeded.');
}

const REGISTRY_IDENTITIES=Object.freeze({canonicalJson:CANONICALIZATION_VERSION,canonicalId:ID_VERSION,hashPreimages:HASH_PREIMAGE_REGISTRY_VERSION,setSemantics:SET_SEMANTICS_REGISTRY_VERSION});

globalThis.closedLoopHash=Object.freeze({
  version:'closed-loop-hash/4',canonicalizationVersion:CANONICALIZATION_VERSION,idVersion:ID_VERSION,
  hashPreimageRegistryVersion:HASH_PREIMAGE_REGISTRY_VERSION,setSemanticsRegistryVersion:SET_SEMANTICS_REGISTRY_VERSION,
  HASH_PREIMAGE_REGISTRY,SET_SEMANTICS_REGISTRY,REGISTRY_IDENTITIES,
  stableStringify,compareUnicodeScalarSequence,sha256Text,sha256Value,sha256Bytes,rawResponseSha256,canonicalEnvelopeSha256,
  contentRecordValue,contentRecordSha256,recordSha256,registeredHash,
  base32hex,canonicalIdPreimage,canonicalIdPayload,canonicalId,allocateCanonicalId,
  knownVectors:Object.freeze({empty:sha256Text(''),abc:sha256Text('abc')})
});

})();

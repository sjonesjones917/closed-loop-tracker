(()=>{
'use strict';

const MAX_SAFE_INTEGER=Number.MAX_SAFE_INTEGER;
const MIN_SAFE_INTEGER=Number.MIN_SAFE_INTEGER;
const CANONICALIZATION_VERSION='closed-loop-canonical-json/1';
const ID_VERSION='closed-loop-id/1';
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
function getPointer(root,pointer){if(pointer==='')return root;if(!pointer.startsWith('/'))throw new TypeError(`Invalid JSON pointer ${pointer}.`);let value=root;for(const raw of pointer.slice(1).split('/')){const key=decodePointerSegment(raw);if(value===null||typeof value!=='object'||!Object.prototype.hasOwnProperty.call(value,key))throw new TypeError(`Registered hash preimage pointer ${pointer} is missing.`);value=value[key];}return value;}
function setPointer(root,pointer,value){const parts=pointer.slice(1).split('/').map(decodePointerSegment);let current=root;for(let i=0;i<parts.length-1;i++){const key=parts[i];current[key]??={};current=current[key];}current[parts.at(-1)]=value;}
function normalizedRegisteredValue(pointer,value){const semantics=SET_SEMANTICS_REGISTRY.get(pointer);if(!semantics)return value;if(!Array.isArray(value))throw new TypeError(`Registered set pointer ${pointer} must resolve to an array.`);const seen=new Set();const copy=value.map(item=>{if(item===null||typeof item!=='object'||Array.isArray(item)||!Object.prototype.hasOwnProperty.call(item,semantics.elementIdentityKey))throw new TypeError(`Set element at ${pointer} lacks identity key ${semantics.elementIdentityKey}.`);const identity=stableStringify(item[semantics.elementIdentityKey]);if(seen.has(identity))throw new TypeError(`Duplicate set element identity at ${pointer}.`);seen.add(identity);return item;});copy.sort((a,b)=>compareUnicodeScalarSequence(stableStringify(a[semantics.elementIdentityKey]),stableStringify(b[semantics.elementIdentityKey])));return copy;}
function registeredHashPreimage(kind,subject){const entry=HASH_PREIMAGE_REGISTRY.get(String(kind));if(!entry)throw new TypeError(`UNDEFINED_HASH_PREIMAGE: ${kind}.`);const out={};for(const pointer of entry.includePointers)setPointer(out,pointer,normalizedRegisteredValue(pointer,getPointer(subject,pointer)));return out;}
function hashRegistered(kind,subject){return sha256Value(registeredHashPreimage(kind,subject));}

function contentRecordValue(record,idField){const fields={...(record?.fields||{})};for(const key of [idField,'CREATED_AT','UPDATED_AT','VERSION','STATUS'])delete fields[key];return {fields,relationships:record?.relationships||{},evidenceRefs:record?.evidenceRefs||[]};}
function contentRecordSha256(record,idField){return sha256Value(contentRecordValue(record,idField));}
function recordSha256(record){const value={...(record||{})};delete value.recordSha256;delete value.sha256;return sha256Value(value);}

function base32hex(bytes){const input=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);let buffer=0,bits=0,out='';for(const byte of input){buffer=(buffer<<8)|byte;bits+=8;while(bits>=5){bits-=5;out+=BASE32HEX_ALPHABET[(buffer>>>bits)&31];buffer&=(1<<bits)-1;}}if(bits)out+=BASE32HEX_ALPHABET[(buffer<<(5-bits))&31];return out;}
function canonicalIdPayload({familyNamespace,jobNamespace,commandId,targetSlot='',parentId='',allocationSequence,collisionCounter=0}){if(!String(familyNamespace||'').trim())throw new TypeError('familyNamespace is required.');if(!String(jobNamespace||'').trim())throw new TypeError('jobNamespace is required.');if(!String(commandId||'').trim())throw new TypeError('commandId is required.');for(const [name,value] of [['allocationSequence',allocationSequence],['collisionCounter',collisionCounter]])if(!Number.isSafeInteger(value)||value<0)throw new TypeError(`${name} must be a nonnegative safe integer.`);return {idVersion:ID_VERSION,familyNamespace:String(familyNamespace),jobNamespace:String(jobNamespace),commandId:String(commandId),targetSlot:String(targetSlot||''),parentId:String(parentId||''),allocationSequence,collisionCounter};}
function allocateCanonicalId({familyPrefix,...tuple}){const prefix=String(familyPrefix||'');if(!/^[A-Z][A-Z0-9_]*$/.test(prefix))throw new TypeError('familyPrefix must be a registered uppercase ASCII prefix.');const payload=canonicalIdPayload(tuple);const digestBytes=hexToBytes(sha256Value(payload)).slice(0,20);return {id:`${prefix}-${base32hex(digestBytes)}`,payload,digestHex:bytesToHex(digestBytes),idVersion:ID_VERSION};}
function allocateCanonicalIdWithCollisionCheck(options,{exists,maxCollisionCounter=1024}={}){if(typeof exists!=='function')throw new TypeError('A collision-check function is required.');for(let collisionCounter=0;collisionCounter<=maxCollisionCounter;collisionCounter++){const allocation=allocateCanonicalId({...options,collisionCounter});const existing=exists(allocation.id);if(existing===false||existing===null||existing===undefined)return {...allocation,collisionCounter};if(existing&&stableStringify(existing)===stableStringify(allocation.payload))return {...allocation,collisionCounter,exactRetry:true};}throw new Error('Canonical ID collision counter exhausted.');}

const api={version:'closed-loop-hash/4',canonicalizationVersion:CANONICALIZATION_VERSION,idVersion:ID_VERSION,stableStringify,compareUnicodeScalarSequence,sha256Text,sha256Value,sha256Bytes,rawResponseSha256,canonicalEnvelopeSha256,contentRecordValue,contentRecordSha256,recordSha256,registerHashPreimage,registerSetSemantics,registeredHashPreimage,hashRegistered,allocateCanonicalId,allocateCanonicalIdWithCollisionCheck,base32hex,hashPreimageRegistry:HASH_PREIMAGE_REGISTRY,setSemanticsRegistry:SET_SEMANTICS_REGISTRY,knownVectors:Object.freeze({empty:sha256Text(''),abc:sha256Text('abc')})};
globalThis.closedLoopHash=Object.freeze(api);

})();

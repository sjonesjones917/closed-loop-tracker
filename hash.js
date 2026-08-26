(()=>{
'use strict';

function stableStringify(value){
  const seen=new WeakSet();
  const normalize=(input,path='$')=>{
    if(input===null)return null;
    const type=typeof input;
    if(type==='string'||type==='boolean')return input;
    if(type==='number'){
      if(!Number.isFinite(input))throw new TypeError(`Cannot canonically hash non-finite number at ${path}.`);
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
      for(const key of Object.keys(input).sort()){
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

  const k=new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ]);
  const h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const w=new Uint32Array(64);
  for(let offset=0;offset<bytes.length;offset+=64){
    for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4,false);
    for(let i=16;i<64;i++){
      const x=w[i-15],y=w[i-2];
      const s0=(rightRotate(x,7)^rightRotate(x,18)^(x>>>3))>>>0;
      const s1=(rightRotate(y,17)^rightRotate(y,19)^(y>>>10))>>>0;
      w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;
    }
    let [a,b,c,d,e,f,g,hh]=h;
    for(let i=0;i<64;i++){
      const s1=(rightRotate(e,6)^rightRotate(e,11)^rightRotate(e,25))>>>0;
      const ch=((e&f)^((~e)&g))>>>0;
      const t1=(hh+s1+ch+k[i]+w[i])>>>0;
      const s0=(rightRotate(a,2)^rightRotate(a,13)^rightRotate(a,22))>>>0;
      const maj=((a&b)^(a&c)^(b&d))>>>0;
      const t2=(s0+maj)>>>0;
      hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    h[0]=(h[0]+a)>>>0;h[1]=(h[1]+b)>>>0;h[2]=(h[2]+c)>>>0;h[3]=(h[3]+d)>>>0;
    h[4]=(h[4]+e)>>>0;h[5]=(h[5]+f)>>>0;h[6]=(h[6]+g)>>>0;h[7]=(h[7]+hh)>>>0;
  }
  return Array.from(h,value=>value.toString(16).padStart(8,'0')).join('');
}
function sha256Value(value){return sha256Text(stableStringify(value));}
function bytesToHex(bytes){return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');}
async function sha256Bytes(bytes){
  let view;if(bytes instanceof ArrayBuffer)view=new Uint8Array(bytes);else if(ArrayBuffer.isView(bytes))view=new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength);else if(bytes instanceof Blob)view=new Uint8Array(await bytes.arrayBuffer());else throw new TypeError('sha256Bytes requires an ArrayBuffer, ArrayBuffer view, or Blob.');
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',view)));
}
function rawResponseSha256(raw){return sha256Text(String(raw??''));}
function canonicalEnvelopeSha256(envelope){return sha256Value(envelope);}
function contentRecordValue(record,idField){const fields={...(record?.fields||{})};for(const key of [idField,'CREATED_AT','UPDATED_AT','VERSION','STATUS'])delete fields[key];return {fields,relationships:record?.relationships||{},evidenceRefs:record?.evidenceRefs||[]};}
function contentRecordSha256(record,idField){return sha256Value(contentRecordValue(record,idField));}
function recordSha256(record){return sha256Value(record);}

globalThis.closedLoopHash=Object.freeze({version:'closed-loop-hash/2',stableStringify,sha256Text,sha256Value,sha256Bytes,rawResponseSha256,canonicalEnvelopeSha256,contentRecordValue,contentRecordSha256,recordSha256,knownVectors:Object.freeze({empty:sha256Text(''),abc:sha256Text('abc')})});
})();

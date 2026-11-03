import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';

export async function verifyBoundedBlobNativeHash({source=fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8')}={}){
 const reads=[],nativeReads=[];
 class ObservedBlob extends Blob{
  slice(...args){const result=super.slice(...args);return new ObservedBlob([result]);}
  arrayBuffer(){reads.push(this.size);return super.arrayBuffer();}
 }
 const context=vm.createContext({Blob:ObservedBlob,Uint8Array,Uint32Array,ArrayBuffer,DataView,TextEncoder,TextDecoder,setTimeout,clearTimeout,crypto:{subtle:{async digest(algorithm,bytes){nativeReads.push(bytes.byteLength);return webcrypto.subtle.digest(algorithm,bytes);}}}});
 vm.runInContext(source,context);const hash=context.closedLoopHash,cases=[];
 for(const size of [0,1,55,56,63,64,65,4095,4096,65535,65536,65537,131073]){
  const bytes=Uint8Array.from({length:size},(_,index)=>(index*137+19)%256),expected=createHash('sha256').update(bytes).digest('hex'),before=nativeReads.length;
  assert.equal(await hash.sha256Bytes(new ObservedBlob([bytes])),expected,'BLOB_EXACT_BYTES:'+size);
  assert.equal(nativeReads.length-before,size>0&&size<=65536?1:0,'BLOB_NATIVE_BOUNDARY:'+size);
  cases.push({size,exactBytes:true,nativeCalls:nativeReads.length-before});
 }
 assert.ok(reads.every(size=>size<=65536),'BLOB_READ_BOUND_EXCEEDED');
 const bytes=new Uint8Array([9,239,187,191,0,255,13,10,8]),view=new DataView(bytes.buffer,1,7);
 assert.equal(await hash.sha256Bytes(view),createHash('sha256').update(bytes.subarray(1,8)).digest('hex'),'BUFFER_OFFSET_CHANGED');
 class BrokenRead extends ObservedBlob{slice(){return {arrayBuffer:()=>Promise.reject(new Error('EXPECTED_READ_FAILURE'))};}}
 await assert.rejects(hash.sha256Bytes(new BrokenRead(['x'])),/EXPECTED_READ_FAILURE/);
 context.crypto.subtle.digest=async()=>{throw new Error('EXPECTED_NATIVE_FAILURE');};
 await assert.rejects(hash.sha256Bytes(new ObservedBlob(['x'])),/EXPECTED_NATIVE_FAILURE/);
 assert.equal(await hash.sha256Bytes(new ObservedBlob([new Uint8Array(65537)])),createHash('sha256').update(new Uint8Array(65537)).digest('hex'),'LARGE_STREAMING_OWNER_CHANGED');
 return {passed:true,cases,largestRead:Math.max(...reads),offsetPreserved:true,readFailurePropagated:true,nativeFailurePropagated:true,largeFileStreamingPreserved:true};
}

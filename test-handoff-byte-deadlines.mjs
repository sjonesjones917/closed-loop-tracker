import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

// Real extracted UI and hash owners, with a synthetic native read and clock.
// The ordinary transaction and physical-browser verifiers remain separate.
export async function verifyHandoffByteDeadlines({setup}){
 const results=[],hashSource=fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8');
 const flush=async()=>{for(let i=0;i<64;i++)await Promise.resolve();};
 for(const scenario of ['ordinary','stalled-late-success','stalled-late-error','read-error','selection-changed','clipboard-error']){
  const r=setup({allowed:true}),timers=new Map();let now=0,nextId=0,release,rejectRead,readStarted=false,transfers=0;
  r.runtime.setTimeout=(fn,delay=0)=>{timers.set(++nextId,{fn,at:now+delay});return nextId;};
  r.runtime.clearTimeout=id=>timers.delete(id);
  Object.assign(r.runtime,{TextEncoder,TextDecoder,Uint8Array,Uint32Array,ArrayBuffer,DataView,crypto:crypto.webcrypto});
  vm.runInContext(hashSource,r.runtime,{filename:'hash.js'});
  vm.runInContext('recordInstructionExport=async()=>globalThis.observeRecordedTransfer();',r.runtime);
  r.runtime.observeRecordedTransfer=()=>{transfers++;};
  r.runtime.reportActionFailure=error=>r.events.push({kind:'failure',message:error.message,code:error.code});
  const waiting=new Promise((resolve,reject)=>{release=resolve;rejectRead=reject;});
  class HeldBlob extends Blob{text(){readStarted=true;return waiting;}}
  const exact='Authorized instruction: \u{1F9EA}\n';
  r.runtime.projectStore.readAuthorizedHandoffMember=async()=>({blob:new HeldBlob([exact]),filename:'instruction.txt'});
  if(scenario==='clipboard-error')r.runtime.navigator.clipboard.writeText=async()=>{throw new Error('SYNTHETIC_CLIPBOARD_FAILURE');};
  let outcome='PENDING';r.runtime.owners.copyAuthorizedPrompt().then(()=>outcome='RESOLVED',()=>outcome='REJECTED');
  async function advance(amount){
   const target=now+amount;await flush();
   while(true){const next=[...timers].filter(([,value])=>value.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();await flush();}
   now=target;await flush();
  }
  await advance(0);assert.equal(readStarted,true,'AUTHORIZED_COPY_READ_REACHED');
  if(scenario.startsWith('stalled-')){
   await advance(29999);assert.equal(outcome,'PENDING','AUTHORIZED_COPY_DEADLINE_NOT_EARLY');
   await advance(1);assert.equal(outcome,'RESOLVED','AUTHORIZED_COPY_DEADLINE_REPORTS_FAILURE');
   assert.equal(r.events.filter(event=>event.kind==='failure').length,1);
   assert.equal(r.events.find(event=>event.kind==='failure').code,'IO_READ_TIMEOUT');
   assert.match(r.events.find(event=>event.kind==='failure').message,/^Reading authorized instruction /);
   assert.equal(transfers,0);assert.equal(r.events.filter(event=>event.kind==='copy').length,0);
   if(scenario==='stalled-late-success')release(exact);else rejectRead(new Error('SYNTHETIC_LATE_READ_FAILURE'));
  }else if(scenario==='read-error')rejectRead(new Error('SYNTHETIC_READ_FAILURE'));
  else{if(scenario==='selection-changed')r.runtime.handoffNavigationSequence++;release(exact);}
  await flush();await advance(30000);
  const copies=r.events.filter(event=>event.kind==='copy'),failures=r.events.filter(event=>event.kind==='failure');
  assert.equal(outcome,'RESOLVED','AUTHORIZED_COPY_OWNER_FINISHES');
  assert.equal(timers.size,0,'AUTHORIZED_COPY_TIMER_CLEANUP');
  assert.equal(copies.length,scenario==='ordinary'?1:0,'AUTHORIZED_COPY_NO_LATE_OR_FAILED_TRANSFER');
  assert.equal(transfers,scenario==='ordinary'?1:0,'AUTHORIZED_COPY_TRANSFER_RECEIPT');
  assert.equal(failures.length,scenario==='ordinary'?0:1,'AUTHORIZED_COPY_VISIBLE_FAILURE');
  if(scenario==='ordinary')assert.equal(copies[0].text,exact);
  results.push({caseId:'authorized-copy-'+scenario,result:'PASS',copies:copies.length,transfers,failures:failures.length});
 }
 return {syntheticNativeBoundaries:true,physicalBrowser:false,hashSourceSha256:crypto.createHash('sha256').update(hashSource).digest('hex'),cases:results};
}

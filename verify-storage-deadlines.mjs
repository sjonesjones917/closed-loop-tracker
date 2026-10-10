import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime,storageBroadcastNetwork} from './test-project-store-runtime.mjs';
const source = fs.readFileSync(process.env.STORE_SOURCE || 'project-store.js','utf8');
const cases=[];
const prefixes=process.argv.filter(x=>x.startsWith('--case-prefix=')).map(x=>x.slice(14));
const selected=id=>!prefixes.length||prefixes.some(prefix=>id.startsWith(prefix));
const flush=async()=>{for(let n=0;n<24;n++)await Promise.resolve();};
function environment({worker=false,broadcast=null}={}){
 let clock=0,next=1;const timers=new Map(),opens=[],transactions=[],workers=[];
 const events={opens:0,abortCalls:0,closed:0,writes:0,workerTerminated:0},errors=[];
 const setTimeout=(fn,delay=0)=>{const id=next++;timers.set(id,{fn,at:clock+Number(delay)});return id;};
 const clearTimeout=id=>timers.delete(id);
 const advance=async ms=>{const end=clock+ms;while(true){const due=[...timers].filter(([,x])=>x.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;clock=due[1].at;timers.delete(due[0]);due[1].fn();await flush();}clock=end;await flush();};
 const context=createVerifierRuntime({Blob,TextEncoder,TextDecoder,ReadableStream,CompressionStream,DecompressionStream,Response,AbortController,URL,URLSearchParams,Uint8Array,ArrayBuffer,structuredClone,crypto:crypto.webcrypto,btoa,atob,setTimeout,clearTimeout,queueMicrotask,console:{log(){},error(...x){errors.push(x.map(String).join(' '));}},navigator:{storage:{persist:async()=>true,estimate:async()=>({usage:0,quota:1024})}},Event:class Event{},dispatchEvent(){}});
 if(broadcast)context.BroadcastChannel=broadcast.Channel;
 if(worker){context.document={currentScript:{src:'https://fixture.invalid/project-store.js?v=FIXTURE-BUILD'}};context.Worker=class{constructor(url){this.url=url;this.messages=[];workers.push(this);}postMessage(message){this.messages.push(message);}terminate(){events.workerTerminated++;}};}
 vm.runInContext(fs.readFileSync('workbook.js','utf8'),context,{filename:'workbook.js'});
 vm.runInContext(fs.readFileSync(process.env.HASH_SOURCE||'hash.js','utf8'),context,{filename:'hash.js'});
 vm.runInContext(fs.readFileSync('workflow-schema.js','utf8'),context,{filename:'workflow-schema.js'});
 if(worker)for(const file of ['test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 vm.runInContext(source,context,{filename:'project-store.js'});
 context.indexedDB={open(){events.opens++;const req={};opens.push(req);return req;}};
 const makeTx=()=>{const tx={requests:[],committed:false,aborted:false,abort(){events.abortCalls++;if(tx.committed)throw Object.assign(new Error('Already committed'),{name:'InvalidStateError'});tx.aborted=true;queueMicrotask(()=>tx.onabort?.());},objectStore(name){return {get(key){const req={transaction:tx,key,storeName:name,result:undefined};tx.requests.push(req);return req;},put(row){events.writes++;tx.row=row;return {transaction:tx};},delete(key){tx.deleted=key;},index(){return {openKeyCursor(){const req={transaction:tx,result:null,cursor:true};tx.requests.push(req);return req;}};}};}};transactions.push(tx);return tx;};
 const db={close(){events.closed++;},transaction(){return makeTx();}};
 const open=async()=>{const req=opens.at(-1);assert(req,'The production store did not request IndexedDB');req.result=db;req.onsuccess?.();await flush();};
 const settle=p=>{const result={state:'PENDING'};Promise.resolve(p).then(value=>{result.state='RESOLVED';result.value=value;},error=>{result.state='REJECTED';result.code=error.code;result.message=error.message;result.existingProjectsUnchanged=error.existingProjectsUnchanged;});return result;};
 return {context,store:context.closedLoopProjectStore,events,errors,opens,transactions,workers,timers,advance,open,settle,db};
}
async function check(caseId,expected,fn){if(!selected(caseId))return;const row={caseId,expected,status:'UNVERIFIED'};cases.push(row);try{row.actual=await fn();row.status='PASS';}catch(error){row.status='FAIL';row.actual={error:String(error.stack||error),observed:error.actual??null};}}
await check('IO-OPEN-CONTROL','A successful native open resolves once; its deadline is cleared.',async()=>{const e=environment(),r=e.settle(e.store.openDatabase());await e.open();assert.equal(r.state,'RESOLVED');await e.advance(60001);assert.equal(e.events.closed,0);assert.equal(e.timers.size,0);return {state:r.state,events:e.events};});
await check('IO-OPEN-DEADLINE','A silent native open rejects visibly by the declared 30000ms I/O deadline, without queuing duplicate opens.',async()=>{const e=environment(),p=e.store.openDatabase(),r=e.settle(p);assert.equal(e.store.openDatabase(),p);await e.advance(30000);assert.equal(r.state,'REJECTED','IO_OPEN_DEADLINE_ORACLE');assert.equal(r.code,'STORAGE_OPEN_TIMEOUT');assert.equal(e.events.opens,1);return {result:r,events:e.events};});
await check('IO-OPEN-LATE','A successful native open arriving after expiry is closed and cannot reactivate the rejected operation.',async()=>{const e=environment(),r=e.settle(e.store.openDatabase());await e.advance(30000);await e.open();assert.equal(r.state,'REJECTED','IO_OPEN_LATE_ORACLE');assert.equal(e.events.closed,1,'IO_OPEN_LATE_CLOSE_ORACLE');const retry=e.settle(e.store.openDatabase());assert.equal(e.events.opens,2);await e.open();assert.equal(retry.state,'RESOLVED');return {result:r,retry:retry.state,events:e.events};});
await check('IO-OPEN-UPGRADE-LATE','An expired open cannot mutate schema on a delayed upgrade event.',async()=>{const e=environment(),r=e.settle(e.store.openDatabase());await e.advance(30000);let upgrades=0,aborts=0;const req=e.opens[0];req.result={objectStoreNames:{contains:()=>false},createObjectStore(){upgrades++;}};req.transaction={abort(){aborts++;},objectStore(){throw new Error('Late upgrade reached schema mutation');}};try{req.onupgradeneeded();}catch{}assert.equal(r.state,'REJECTED');assert.equal(upgrades,0,'IO_OPEN_LATE_SCHEMA_ORACLE');assert.equal(aborts,1);return {result:r,upgrades,aborts};});
await check('IO-REQUEST-CONTROL','A successful request and matching transaction completion return the exact stored value.',async()=>{const e=environment(),r=e.settle(e.store.metaGet('value'));await e.open();const tx=e.transactions.at(-1),req=tx.requests[0];req.result={value:'kept'};req.onsuccess();await flush();tx.oncomplete();await flush();assert.equal(r.state,'RESOLVED');assert.equal(r.value,'kept');assert.equal(e.timers.size,0);return r;});
await check('IO-REQUEST-DEADLINE','A silent read rejects, aborts the transaction, and does not claim application-wide rollback.',async()=>{const e=environment(),r=e.settle(e.store.metaGet('value'));await e.open();await e.advance(30000);assert.equal(r.state,'REJECTED','IO_REQUEST_DEADLINE_ORACLE');assert.equal(r.code,'STORAGE_REQUEST_TIMEOUT');assert.equal(r.existingProjectsUnchanged,false);assert.equal(e.events.abortCalls,1);const req=e.transactions.at(-1).requests[0];req.result={value:'late'};req.onsuccess();await flush();assert.equal(r.state,'REJECTED');return {result:r,events:e.events};});
await check('IO-TRANSACTION-CONTROL','A positively acknowledged metadata transaction returns the exact supplied value.',async()=>{const e=environment(),r=e.settle(e.store.metaPut('value','kept'));await e.open();const tx=e.transactions.at(-1);tx.committed=true;tx.oncomplete();await flush();await e.advance(30000);assert.equal(r.state,'RESOLVED');assert.equal(r.value,'kept');assert.equal(e.events.abortCalls,0);return {result:r,events:e.events};});
await check('IO-TRANSACTION-DEADLINE','A missing transaction outcome rejects within the deadline and aborts rather than leaving a permanent pending operation.',async()=>{const e=environment(),r=e.settle(e.store.metaPut('value','candidate'));await e.open();await e.advance(30000);assert.equal(r.state,'REJECTED','IO_TRANSACTION_DEADLINE_ORACLE');assert.equal(r.code,'STORAGE_TRANSACTION_TIMEOUT');assert.equal(r.existingProjectsUnchanged,false);assert.equal(e.events.abortCalls,1);return {result:r,events:e.events};});
await check('IO-TRANSACTION-UNKNOWN','A missing commit acknowledgement must never become a claim that existing projects are unchanged.',async()=>{const e=environment(),r=e.settle(e.store.metaPut('value','committed'));await e.open();e.transactions.at(-1).committed=true;await e.advance(30000);assert.equal(r.state,'REJECTED','IO_TRANSACTION_UNKNOWN_ORACLE');assert.equal(r.existingProjectsUnchanged,false);assert.equal(e.transactions.at(-1).row.value,'committed');return {result:r,events:e.events};});
await check('IO-CURSOR-CONTROL','An empty completed cursor returns an empty collection, not an error or an unresolved transaction.',async()=>{const e=environment(),r=e.settle(e.store.listProjectSummaries());await e.open();const tx=e.transactions.at(-1);tx.requests[0].onsuccess();await flush();tx.oncomplete();await flush();assert.equal(r.state,'RESOLVED');assert.equal(JSON.stringify(r.value),'[]');return r;});
await check('IO-CURSOR-DEADLINE','A silent cursor terminates without a detached rejected completion promise or permanent pending picker.',async()=>{const e=environment(),r=e.settle(e.store.listProjectSummaries());await e.open();await e.advance(30000);assert.equal(r.state,'REJECTED','IO_CURSOR_DEADLINE_ORACLE');assert.match(r.code,/STORAGE_(CURSOR|TRANSACTION)_TIMEOUT/);assert.equal(r.existingProjectsUnchanged,false);return {result:r,events:e.events};});
// These worker messages/native events are deliberately synthetic. Production
// request, cancellation, receipt recovery, integrity and settlement code runs
// unchanged; this does not replace the real IndexedDB/Worker browser journey.
async function deliverStorage(e,result,rows=new Map()){
 for(let step=0;step<2000&&result.state==='PENDING';step++){
  for(const req of e.opens)if(!req.delivered){req.delivered=true;req.result=e.db;req.onsuccess?.();}
  await flush();
  for(const tx of e.transactions){for(const req of tx.requests)if(!req.delivered){req.delivered=true;req.result=rows.get(req.storeName+':'+req.key);req.onsuccess?.();}await flush();if(tx.oncomplete&&!tx.delivered&&tx.requests.every(r=>r.delivered)){tx.delivered=true;tx.committed=true;tx.oncomplete();}}
  await e.advance(0);
 }
 await flush();
}
await check('IO-WORKER-CONTROL','An acknowledged worker result settles once and clears its worker deadline.',async()=>{const e=environment({worker:true}),project={job:{JOB_ID:'ACK'},revision:1},r=e.settle(e.store.writeProject(project)),w=e.workers[0],m=w.messages[0];w.onmessage({data:{operationId:m.operationId,buildIdentity:'FIXTURE-BUILD',ok:true,project}});await flush();assert.equal(r.state,'RESOLVED');assert.equal(r.value.job.JOB_ID,'ACK');await e.advance(600000);assert.equal(e.events.workerTerminated,0);assert.equal(w.messages.length,1);return {state:r.state,events:e.events};});
for(const reply of ['acknowledged','absent','invalid-build'])await check('IO-WORKER-VIEW-'+reply,'View saves dispatch without reading a project on the UI thread; only a matching reply can resolve, and lost workers are reconciled without replay.',async()=>{
 const e=environment({worker:true}),view={activeView:'Workflow',activeStage:1,scrollY:537,drafts:{note:{value:'Keep this draft'}}},r=e.settle(e.store.saveCheckpoint('VIEW',{expectedProjectRevision:4,view})),w=e.workers[0],m=w.messages[0];
 assert.equal(m.method,'SAVE_CHECKPOINT');assert.equal(e.events.opens,0,'A view save loaded the complete project on the UI thread before dispatch.');assert.equal(m.args[0],'VIEW');assert.deepEqual(m.args[1].view,view);
 if(reply==='absent')await e.advance(600000);
 else w.onmessage({data:{operationId:m.operationId,buildIdentity:reply==='invalid-build'?'OTHER-BUILD':'FIXTURE-BUILD',ok:true,checkpointId:'CHECKPOINT-VIEW'}});
 await flush();
 if(reply==='acknowledged'){assert.equal(r.state,'RESOLVED');assert.equal(r.value,'CHECKPOINT-VIEW');await e.advance(600000);assert.equal(e.events.workerTerminated,0);}
 else{await deliverStorage(e,r);assert.equal(r.state,'REJECTED');assert.equal(r.existingProjectsUnchanged,true);assert.equal(e.events.workerTerminated,1);}
 assert.equal(w.messages.length,1);return {reply,state:r.state,workerRequests:w.messages.length};
});
await check('IO-WORKER-ABSENT','A silent worker is terminated, then a confirmed absent commit receipt rejects without automatically repeating execution.',async()=>{const e=environment({worker:true}),r=e.settle(e.store.writeProject({job:{JOB_ID:'PENDING'}})),w=e.workers[0];await e.advance(600000);assert.equal(e.events.workerTerminated,1,'IO_WORKER_DEADLINE_ORACLE');assert.equal(r.state,'PENDING','Outcome must wait for durable receipt reconciliation');await deliverStorage(e,r);assert.equal(r.state,'REJECTED');assert.equal(r.existingProjectsUnchanged,true);assert.equal(w.messages.length,1);w.onmessage({data:{operationId:w.messages[0].operationId,buildIdentity:'FIXTURE-BUILD',ok:true,project:{revision:999}}});await flush();assert.equal(r.state,'REJECTED');return {result:r,events:e.events};});
await check('IO-WORKER-UNCONFIRMED','When durable outcome read-back is itself unavailable, report an unconfirmed outcome rather than rollback or success.',async()=>{const e=environment({worker:true}),r=e.settle(e.store.writeProject({job:{JOB_ID:'UNKNOWN'}}));await e.advance(630000);assert.equal(r.state,'REJECTED','IO_WORKER_UNCONFIRMED_ORACLE');assert.equal(r.code,'STORAGE_OUTCOME_UNCONFIRMED');assert.equal(r.existingProjectsUnchanged,false);assert.equal(e.events.workerTerminated,1);return {result:r,events:e.events};});
await check('IO-WORKER-COMMITTED','A timed-out worker with a matching durable receipt resolves the verified committed project without resubmitting the command.',async()=>{const e=environment({worker:true}),p=e.context.closedLoopCore.createBlankState('WORKER-RECEIPT');e.context.closedLoopWorkflowEngine.ensureShape(p);e.context.closedLoopWorkflowEngine.recalculate(p);p.revision=7;const digest=e.store.projectSha256(p),r=e.settle(e.store.writeProject(p)),w=e.workers[0],m=w.messages[0],rows=new Map([['meta:storageOperation:'+m.operationId,{value:{operationId:m.operationId,jobId:p.job.JOB_ID,revision:7,projectSha256:digest}}],['projects:'+p.job.JOB_ID,{project:p,revision:7,projectSha256:digest}]]);await e.advance(600000);assert.equal(e.events.workerTerminated,1,'IO_WORKER_COMMIT_RECOVERY_ORACLE');await deliverStorage(e,r,rows);assert.equal(r.state,'RESOLVED');assert.equal(r.value.projectSha256,digest);assert.equal(r.value.revision,7);assert.equal(w.messages.length,1);return {state:r.state,revision:r.value.revision,projectSha256:digest,events:e.events};});
// A durable receipt is evidence of one particular commit. Corrupt identities
// must stay unconfirmed; a valid newer state must not be overwritten by retry.
for(const method of ['WRITE_PROJECT','IMPORT_PACKAGE'])for(const variant of ['matching','newer-state','worker-error-after-commit','wrong-operation-id','missing-operation-id','array-operation-id','missing-job-id','empty-job-id','array-job-id','missing-revision','string-revision','null-revision','array-revision','negative-revision','fractional-revision','unsafe-revision','future-revision','missing-digest','array-digest','malformed-digest','same-revision-wrong-digest','null-receipt','false-receipt','array-receipt',...(method==='WRITE_PROJECT'?['different-existing-project']:[])])await check('IO-WORKER-RECEIPT-'+method+'-'+variant,'Only a well-typed matching durable receipt may recover a commit; incompatible or corrupt receipts preserve uncertainty and never replay.',async()=>{
 const e=environment({worker:true}),p=e.context.closedLoopCore.createBlankState('RECEIPT-'+method+'-'+variant);e.context.closedLoopWorkflowEngine.ensureShape(p);e.context.closedLoopWorkflowEngine.recalculate(p);p.revision=7;
 const committedDigest=e.store.projectSha256(p),selected={jobId:'SELECTION-OWNER',stagingId:'SELECTED-BACKUP'},r=e.settle(method==='WRITE_PROJECT'?e.store.writeProject(p):e.store.importPackage(new Blob(['synthetic selected transport']),{pendingBackupImport:selected})),w=e.workers[0],message=w.messages[0];
 assert.equal(message.method,method);if(method==='IMPORT_PACKAGE')assert.deepEqual(message.args[1].pendingBackupImport,selected,'IO_WORKER_IMPORT_SELECTION_IDENTITY_ORACLE');
 let receipt={operationId:message.operationId,jobId:p.job.JOB_ID,revision:7,projectSha256:committedDigest},stored=vm.runInContext("value=>JSON.parse(JSON.stringify(value))",e.context)(p);
 if(variant==='newer-state')stored.revision=8;
 if(variant==='wrong-operation-id')receipt.operationId='ANOTHER-OPERATION';
 if(variant==='missing-operation-id')delete receipt.operationId;
 if(variant==='array-operation-id')receipt.operationId=[receipt.operationId];
 if(variant==='missing-job-id')delete receipt.jobId;
 if(variant==='empty-job-id')receipt.jobId='';
 if(variant==='array-job-id')receipt.jobId=[receipt.jobId];
 if(variant==='missing-revision')delete receipt.revision;
 if(variant==='string-revision')receipt.revision='7';
 if(variant==='null-revision')receipt.revision=null;
 if(variant==='array-revision')receipt.revision=[7];
 if(variant==='negative-revision')receipt.revision=-1;
 if(variant==='fractional-revision')receipt.revision=6.5;
 if(variant==='unsafe-revision')receipt.revision=Number.MAX_SAFE_INTEGER+1;
 if(variant==='future-revision')receipt.revision=8;
 if(variant==='missing-digest')delete receipt.projectSha256;
 if(variant==='array-digest')receipt.projectSha256=[receipt.projectSha256];
 if(variant==='malformed-digest')receipt.projectSha256='NOT-A-DIGEST';
 if(variant==='same-revision-wrong-digest')receipt.projectSha256='f'.repeat(64);
 if(variant==='different-existing-project'){stored.job.JOB_ID='ANOTHER-EXISTING-PROJECT';receipt.jobId=stored.job.JOB_ID;receipt.projectSha256=e.store.projectSha256(stored);}
 if(variant==='null-receipt')receipt=null;
 if(variant==='false-receipt')receipt=false;
 if(variant==='array-receipt')receipt=[receipt];
 const storedDigest=e.store.projectSha256(stored),key='storageOperation:'+message.operationId,rows=new Map([['meta:'+key,{value:receipt}],['projects:'+stored.job.JOB_ID,{project:stored,revision:stored.revision,projectSha256:storedDigest}]]);
 if(variant==='worker-error-after-commit')w.onmessage({data:{operationId:message.operationId,buildIdentity:'FIXTURE-BUILD',ok:false,error:{code:'POST_COMMIT_READ_FAILED',message:'Synthetic failure after durable commit.'}}});else await e.advance(600000);
 await deliverStorage(e,r,rows);
 const accepted=['matching','newer-state','worker-error-after-commit'].includes(variant);
 if(accepted){assert.equal(r.state,'RESOLVED','IO_WORKER_RECEIPT_VALID_CONTROL_ORACLE: '+method+'/'+variant);assert.equal(r.value.revision,stored.revision);assert.equal(r.value.projectSha256,storedDigest);assert(e.transactions.some(tx=>tx.deleted===key),'IO_WORKER_RECEIPT_ACKNOWLEDGED_CLEANUP_ORACLE');}
 else{assert.equal(r.state,'REJECTED','IO_WORKER_RECEIPT_IDENTITY_ORACLE: '+method+'/'+variant);assert.equal(r.code,'STORAGE_OUTCOME_UNCONFIRMED','IO_WORKER_RECEIPT_UNCERTAIN_ORACLE');assert.equal(r.existingProjectsUnchanged,false,'IO_WORKER_RECEIPT_NO_FALSE_ROLLBACK_ORACLE');assert(!e.transactions.some(tx=>tx.deleted===key),'IO_WORKER_RECEIPT_FAILED_RECOVERY_PRESERVED_ORACLE');}
 assert.equal(w.messages.length,1,'IO_WORKER_RECEIPT_NO_REPLAY_ORACLE');
 return {method,variant,state:r.state,revision:r.value?.revision??null,code:r.code??null,existingProjectsUnchanged:r.existingProjectsUnchanged??null,workerRequests:w.messages.length};
});
for(const bytes of ['valid','missing','corrupt'])await check('IO-WORKER-CUSTODY-'+bytes,'A successful worker reply establishes byte custody only by reading and verifying the receiving context’s stored files.',async()=>{
 const broadcast=storageBroadcastNetwork(),e=environment({worker:true,broadcast}),engine=e.context.closedLoopWorkflowEngine,p=e.context.closedLoopCore.createBlankState('WORKER-BYTES-'+bytes);engine.ensureShape(p);
 const artifactId=engine.allocateId(p,'artifacts',{commandId:'WORKER-FILE',idempotencyKey:'file'}),blob=new Blob(['verified bytes']),sha256=await e.context.closedLoopHash.sha256Bytes(blob);
 engine.registerArtifactBytes(p,{stage:1,artifactId,filename:'file.txt',byteSize:blob.size,sha256,mediaType:'text/plain'});engine.recalculate(p);
 const identity={jobId:p.job.JOB_ID,artifactId,filename:'file.txt',byteSize:blob.size,sha256},r=e.settle(e.store.writeProject(p)),w=e.workers[0],m=w.messages[0];
 w.onmessage({data:{operationId:m.operationId,buildIdentity:'FIXTURE-BUILD',ok:true,project:p}});
 const rows=new Map();if(bytes!=='missing')rows.set('artifacts:'+artifactId,{...identity,blob:bytes==='valid'?blob:new Blob(['wrong bytes'])});
 await deliverStorage(e,r,rows);
 assert.equal(r.state,'RESOLVED','IO_WORKER_CUSTODY_SETTLEMENT_ORACLE');
 assert.equal(e.store.artifactCustodyState(identity),bytes==='valid'?'TRUE':'UNKNOWN','IO_WORKER_CUSTODY_ORACLE: metadata-only worker success cannot establish custody; matching actual bytes must establish it.');
 const sender=new broadcast.Channel('closed-loop-reliability');sender.postMessage({type:'PROJECT_CHANGED',jobId:p.job.JOB_ID,contextId:new URL(w.url).searchParams.get('storeContext')});broadcast.flush();sender.close();
 assert.equal(e.store.artifactCustodyState(identity),bytes==='valid'?'TRUE':'UNKNOWN','IO_WORKER_OWN_NOTIFICATION_ORACLE: a delayed worker notification must preserve its window’s verified result.');
 assert.equal(w.messages.length,1,'IO_WORKER_CUSTODY_ORACLE: verification must not repeat the write.');
 return {input:bytes,state:r.state,custody:e.store.artifactCustodyState(identity),workerRequests:w.messages.length};
});
await check('IO-CUSTODY-NOTIFICATIONS','Own completed writes preserve verified bytes; another storage context invalidates them; deletion publishes the changed file.',async()=>{
 const network=storageBroadcastNetwork(),r=projectStoreRuntime({sourceOverrides:{'project-store.js':source},environment:{BroadcastChannel:network.Channel}}),p=r.core.createBlankState('NOTIFICATION-BYTES');r.engine.ensureShape(p);
 const artifactId=r.engine.allocateId(p,'artifacts',{commandId:'LOCAL-FILE',idempotencyKey:'file'}),row=await r.store.putArtifact({artifactId,jobId:p.job.JOB_ID,filename:'file.txt',blob:new Blob(['verified bytes'])});
 r.engine.registerArtifactBytes(p,{stage:1,artifactId,filename:row.filename,byteSize:row.byteSize,sha256:row.sha256,mediaType:row.mediaType,lineage:row.lineage});
 const identity={jobId:p.job.JOB_ID,artifactId,filename:row.filename,byteSize:row.byteSize,sha256:row.sha256};
 network.hold=true;await r.store.writeProject(p,{expectedProjectRevision:0});network.flush();
 assert.equal(r.store.artifactCustodyState(identity),'TRUE','IO_OWN_NOTIFICATION_CUSTODY_ORACLE');
 const other=new network.Channel('closed-loop-reliability'),messages=[];other.addEventListener('message',event=>messages.push(event.data));
 other.postMessage({type:'PROJECT_CHANGED',jobId:p.job.JOB_ID});network.flush();
 assert.equal(r.store.artifactCustodyState(identity),'UNKNOWN','IO_FOREIGN_NOTIFICATION_CUSTODY_ORACLE');
 await r.store.getArtifact(artifactId);assert.equal(r.store.artifactCustodyState(identity),'TRUE');
 await r.store.deleteArtifact(artifactId,p.job.JOB_ID);network.flush();
 assert.equal(r.store.artifactCustodyState(identity),'UNKNOWN');
 assert(messages.some(message=>message.jobId===p.job.JOB_ID&&message.artifactId===artifactId),'IO_FILE_DELETION_NOTIFICATION_ORACLE');
 other.close();return {ownWrite:'verified',foreignChange:'invalidated',deletionNotification:true};
});
await check('IO-CUSTODY-IMPORT','Import returns with its restored actual files verified in the context that will calculate subsequent workflow actions.',async()=>{
 const network=storageBroadcastNetwork(),r=projectStoreRuntime({sourceOverrides:{'project-store.js':source},environment:{BroadcastChannel:network.Channel}}),p=r.core.createBlankState('IMPORTED-BYTES');r.engine.ensureShape(p);
 const artifactId=r.engine.allocateId(p,'artifacts',{commandId:'IMPORT-FILE',idempotencyKey:'file'}),row=await r.store.putArtifact({artifactId,jobId:p.job.JOB_ID,filename:'file.txt',blob:new Blob(['retained bytes'])});
 r.engine.registerArtifactBytes(p,{stage:1,artifactId,filename:row.filename,byteSize:row.byteSize,sha256:row.sha256,mediaType:row.mediaType,lineage:row.lineage});
 await r.store.writeProject(p,{expectedProjectRevision:0});const backup=await r.store.exportPackage(p.job.JOB_ID);await r.store.deleteArtifact(artifactId,p.job.JOB_ID);
 const restored=await r.store.importPackage(backup);network.flush();
 const identity={jobId:p.job.JOB_ID,artifactId,filename:row.filename,byteSize:row.byteSize,sha256:row.sha256};
 assert.equal(restored.job.JOB_ID,p.job.JOB_ID);assert.equal(r.store.artifactCustodyState(identity),'TRUE','IO_IMPORT_CUSTODY_ORACLE');return {imported:true,verified:true};
});
await check('IO-CUSTODY-DELETION-NOTIFICATION','Removing actual stored bytes informs other contexts before their old custody can authorize further work.',async()=>{
 const network=storageBroadcastNetwork(),r=projectStoreRuntime({sourceOverrides:{'project-store.js':source},environment:{BroadcastChannel:network.Channel}}),other=new network.Channel('closed-loop-reliability'),messages=[];
 other.addEventListener('message',event=>messages.push(event.data));
 await r.store.putArtifact({artifactId:'REMOVED',jobId:'REMOVAL',filename:'file.txt',blob:new Blob(['bytes'])});network.flush();messages.length=0;
 await r.store.deleteArtifact('REMOVED','REMOVAL');network.flush();
 assert(messages.some(message=>message.jobId==='REMOVAL'&&message.artifactId==='REMOVED'),'IO_FILE_DELETION_NOTIFICATION_ORACLE');other.close();return {deletionNotification:true};
});
await check('IO-CUSTODY-INTERRUPTED-READ','A file read invalidated by another context cannot restore stale verified custody when its hash finishes later.',async()=>{
 const network=storageBroadcastNetwork(),r=projectStoreRuntime({sourceOverrides:{'project-store.js':source},environment:{BroadcastChannel:network.Channel}});
 let held=false,release,started;const entered=new Promise(resolve=>started=resolve),wait=new Promise(resolve=>release=resolve);
 class DelayedBlob extends Blob{slice(...args){const part=super.slice(...args),read=part.arrayBuffer.bind(part);part.arrayBuffer=async()=>{if(held){started();await wait;}return read();};return part;}}
 const row=await r.store.putArtifact({artifactId:'IN-FLIGHT',jobId:'CHANGED',filename:'file.txt',blob:new DelayedBlob(['bytes'])}),identity={jobId:row.jobId,artifactId:row.artifactId,filename:row.filename,byteSize:row.byteSize,sha256:row.sha256};
 held=true;const reading=r.store.getArtifact(row.artifactId);await entered;
 // One deliberate external storage transition, after the read began.
 r.rows.get('artifacts').delete(row.artifactId);const other=new network.Channel('closed-loop-reliability');other.postMessage({type:'PROJECT_CHANGED',jobId:row.jobId});network.flush();release();await reading;
 assert.equal(r.store.artifactCustodyState(identity),'UNKNOWN','IO_INTERRUPTED_CUSTODY_ORACLE: an invalidated read cannot reinstate deleted file custody.');other.close();return {staleRead:'rejected',custody:'UNKNOWN'};
});
if(!cases.length)throw new Error('No selected deadline cases');
console.log(JSON.stringify({schema:'closed-loop-storage-deadline-regression/1',syntheticNativeEvents:true,physicalBrowser:false,sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),declaredIoDeadlineMs:30000,cases},null,2));
if(cases.some(x=>x.status!=='PASS'))process.exitCode=1;

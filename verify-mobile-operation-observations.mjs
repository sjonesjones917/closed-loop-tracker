import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createVerifierRuntime} from './verifier-runtime.mjs';

// Synthetic DOM, storage and network boundaries. This executes the application
// observation code; it does not assert physical-device or external-transfer proof.
const source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');
const cases=[];
const target={challenge:'c'.repeat(64),mobileAcceptanceTargetId:'DISPOSABLE-MOBILE-TARGET',testProjectId:'DISPOSABLE-MOBILE-PROJECT',sourceCommit:'a'.repeat(40),deploymentManifestDigest:'b'.repeat(64),origin:'https://sjonesjones917.github.io',basePath:'/closed-loop-tracker/',procedureVersion:'actual-iphone-safari/1',viewport:{width:393,height:852,devicePixelRatio:3},safariUserAgent:'Mozilla/5.0 (iPhone) Safari/604.1'};
function harness(program=source){
 const metadata=new Map(),downloads=[],errors=[],nodes=new Map(),listeners=new Map();
 const get=id=>{if(!nodes.has(id))nodes.set(id,{id:id.slice(1),value:'',textContent:'',disabled:false,isConnected:true,hidden:false,attrs:{},getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=v;},focus(){document.activeElement=this;},getClientRects(){return [{}];},getBoundingClientRect(){return {width:100,height:44};},classList:{add(){},remove(){},contains(){return false;}},querySelector(){return null;}});return nodes.get(id);};
 const document={currentScript:null,activeElement:null,body:{},documentElement:{scrollWidth:393,clientWidth:393},querySelector:get,querySelectorAll:()=>[],createElement:()=>({click(){downloads.push({filename:this.download,url:this.href});}})};
 const c=createVerifierRuntime({Blob,File,TextEncoder,TextDecoder,structuredClone,URL,crypto:globalThis.crypto,console,setTimeout,clearTimeout,queueMicrotask,requestAnimationFrame:fn=>fn(),document,navigator:{userAgent:target.safariUserAgent,storage:{persist:async()=>false}},location:{origin:target.origin,href:target.origin+target.basePath},innerWidth:393,innerHeight:852,devicePixelRatio:3,addEventListener:(type,fn)=>listeners.set(type,fn),getComputedStyle:()=>({fontSize:'16px',visibility:'visible'})});
 vm.runInContext(fs.readFileSync('hash.js','utf8'),c);
 vm.runInContext(program.slice(0,program.indexOf('globalThis.closedLoopAppReady=false;'))+`
  globalThis.test={install:(p,s,store)=>{current=JSON.parse(JSON.stringify(p));acceptanceSession=JSON.parse(JSON.stringify(s));projectStore=store;render=()=>{};reportActionFailure=e=>testErrors.push(String(e.message||e));engine={recordValue:(r,k)=>r.fields?.[k]};},session:()=>acceptanceSession,record:typeof recordMobileOperation==='function'?recordMobileOperation:undefined,capture:recordMobileAcceptanceReceipt,exportFile:typeof recordMobileExport==='function'?recordMobileExport:undefined,selectFile:typeof verifyMobileExportedFile==='function'?verifyMobileExportedFile:undefined,selectBackup:typeof mobileBackupSelection==='function'?mobileBackupSelection:undefined,restore:typeof recordMobileBackupRestore==='function'?recordMobileBackupRestore:undefined,save:saveAcceptanceSession,reload:()=>loadAcceptanceSession({fromReload:true}),measure:measureMobileAcceptance,probe:runMobileCapabilityProbe,exportProbe:typeof exportMobileProbeMember==='function'?exportMobileProbeMember:undefined,selectProbe:typeof selectMobileProbeMember==='function'?selectMobileProbeMember:undefined,verifyBuild:typeof verifyMobileBuild==='function'?verifyMobileBuild:undefined,project:()=>current};
})();`,c);
 c.testErrors=errors;
 const state={job:{JOB_ID:target.testProjectId},revision:7,projectSha256:'d'.repeat(64),projectData:{artifacts:[{fields:{AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'}}],promptRecords:[{}],responseRecords:[{}],responseValidations:[{status:'ACCEPTED'}],proposals:[{status:'ACCEPTED'}],executionPackages:[{}],backupCheckpoints:[{fields:{CUSTODY_STATE:'RESTORED'}}]},stages:{28:{derivedData:{DELIVERY_ARTIFACT_IDENTITY_VERIFIED:true}}}};
 const session={jobId:target.testProjectId,target:structuredClone(target),buildIdentity:'UNMANIFESTED_LOCAL_RUNTIME',observations:[],exports:[],receipts:[],probe:{...target,targetId:target.mobileAcceptanceTargetId,probeId:'PROBE',result:'PASS'}};
 get('#mobile-acceptance-target-json').value=JSON.stringify(target);
 const store={ready:Promise.resolve(),metaPut:async(k,v)=>metadata.set(k,structuredClone(v)),metaGet:async k=>metadata.has(k)?vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify(metadata.get(k)))+')',c):undefined};
 c.test.install(state,session,store);
 return {c,metadata,errors,nodes,downloads,listeners,store};
}
const h=harness();
await h.c.test.capture();assert.equal(h.c.test.session().receipts.length,0,'Record arrays, a ready store, and a DOM body must not fabricate executed-operation receipts.');
cases.push({caseId:'MOBILE-RECEIPTS-NO-EXECUTED-OPERATIONS',result:'PASS'});
await h.c.test.record('PROJECT_CREATED',{createdProjectId:target.testProjectId,revision:7});await h.c.test.capture();
assert.deepEqual(Array.from(h.c.test.session().receipts,r=>r.kind),['PROJECT_CREATED'],h.errors.join('; '));
h.c.test.session().observations[0].challenge='wrong';await h.c.test.capture();assert.equal(h.c.test.session().receipts.length,0,'A receipt from another target challenge was accepted.');
cases.push({caseId:'MOBILE-RECEIPT-TARGET-ISOLATION',result:'PASS'});
const bytes=new Blob(['exact exported bytes\n']);await h.c.test.exportFile('PROMPT_FILE_EXPORTED_OR_SHARED',bytes,'instruction.txt');
assert.equal(h.c.test.session().receipts.length,0,'Creating a download must not prove file transfer.');
await assert.rejects(h.c.test.selectFile([new File(['wrong'],'instruction.txt')]),/do not match/);
await h.c.test.selectFile([new File([bytes],'instruction.txt')]);await h.c.test.capture();
assert.equal(h.c.test.session().receipts.length,1);assert.equal(h.c.test.session().receipts[0].observation.sha256,await h.c.closedLoopHash.sha256Bytes(bytes));
cases.push({caseId:'MOBILE-EXPORT-BYTE-READBACK-AND-REJECTION',result:'PASS'});
await h.c.test.exportFile('BACKUP_EXPORTED',bytes,'backup.gz');const selected=await h.c.test.selectBackup(new File([bytes],'renamed-backup.gz'));
h.metadata.set('lastVerifiedImport',{jobId:target.testProjectId,packageSha256:'e'.repeat(64),artifactCount:0});await h.c.test.restore(selected);await h.c.test.capture();
assert(h.c.test.session().receipts.some(r=>r.kind==='BACKUP_RESTORED_FROM_EXPORTED_COPY'));
assert.equal(await h.c.test.selectBackup(new File(['corrupt'],'backup.gz')),null);
cases.push({caseId:'MOBILE-BACKUP-SELECTED-EXPORTED-BYTES',result:'PASS'});
await h.c.test.save();
const reloaded=harness();for(const [k,v] of h.metadata)reloaded.metadata.set(k,v);await reloaded.c.test.reload();await reloaded.c.test.capture();assert(reloaded.c.test.session().receipts.some(r=>r.kind==='PERSISTENCE_RELOAD_VERIFIED'));
const changed=harness();for(const [k,v] of h.metadata)changed.metadata.set(k,v);changed.c.test.project().projectSha256='0'.repeat(64);await changed.c.test.reload();assert(!changed.c.test.session().observations.some(r=>r.kind==='PERSISTENCE_RELOAD_VERIFIED'));
cases.push({caseId:'MOBILE-RELOAD-EXACT-PERSISTED-PROJECT',result:'PASS'});
h.listeners.get('error')();h.listeners.get('unhandledrejection')();await h.c.test.save();
const afterError=harness();for(const [k,v] of h.metadata)afterError.metadata.set(k,v);await afterError.c.test.reload();const measures=afterError.c.test.measure();assert.equal(measures.runtimeExceptions,1);assert.equal(measures.unhandledRejections,1);
cases.push({caseId:'MOBILE-RUNTIME-FAILURES-SURVIVE-RELOAD',result:'PASS'});
// Before actual selections the capability probe is incomplete even when every
// browser API exists. Build verification is tested independently below.
const probe=harness();probe.c.test.session().probe=null;
// Invoke the actual probe with a byte-valid mock deployment graph.
const resourceBytes=new Blob(['manifested resource']);const digest=await probe.c.closedLoopHash.sha256Bytes(resourceBytes);
const manifest={sourceCommit:target.sourceCommit,buildIdentity:'UNMANIFESTED_LOCAL_RUNTIME',runtimeResources:['app-core.js','test-runtime.js','test-worker.js','project-store.js'].map(path=>({path,byteSize:resourceBytes.size,digest}))};manifest.manifestDigest={digest:probe.c.closedLoopHash.sha256Value(vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify(manifest))+')',probe.c))};
probe.c.test.session().target.deploymentManifestDigest=manifest.manifestDigest.digest;probe.nodes.get('#mobile-acceptance-target-json').value=JSON.stringify(probe.c.test.session().target);
probe.c.document.querySelector('meta[name="closed-loop-build-identity"]').content='UNMANIFESTED_LOCAL_RUNTIME';
probe.c.fetch=async url=>String(url).includes('closed-loop-deployment-manifest.json')?{ok:true,json:async()=>vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify(manifest))+')',probe.c)}:{ok:true,blob:async()=>resourceBytes};
await probe.c.test.probe();assert.equal(probe.c.test.session().probe.result,'BLOCKED');assert(probe.c.test.session().probe.missingCapabilities.includes('BACKUP_EXPORT_AND_RESTORE'));
for(const role of ['RESPONSE','RETURNED','MANIFEST']){
 await probe.c.test.exportProbe(role);const item=probe.c.test.session().exports.at(-1);
 const emitted=probe.downloads.at(-1),blob=await (await fetch(emitted.url)).blob();
 assert.equal(await probe.c.closedLoopHash.sha256Bytes(blob),item.sha256);
 await probe.c.test.selectProbe(role,[new File([blob],emitted.filename)]);
}
await probe.c.test.exportFile('BACKUP_EXPORTED',bytes,'probe-backup.gz');
const probeBackup=await probe.c.test.selectBackup(new File([bytes],'probe-backup.gz'));
probe.metadata.set('lastVerifiedImport',{jobId:target.testProjectId,packageSha256:'e'.repeat(64),artifactCount:0});await probe.c.test.restore(probeBackup);
await probe.c.test.probe();assert.equal(probe.c.test.session().probe.result,'PASS',probe.errors.join('; '));
assert.equal(probe.c.test.session().probe.persistent,false,'A denied persistence request must remain visibly denied.');
cases.push({caseId:'MOBILE-CAPABILITIES-REQUIRE-EXECUTED-FILE-OPERATIONS',result:'PASS'});
probe.c.fetch=async url=>String(url).includes('closed-loop-deployment-manifest.json')?{ok:true,json:async()=>vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify(manifest))+')',probe.c)}:{ok:true,blob:async()=>new Blob(['corrupt'])};
await assert.rejects(probe.c.test.verifyBuild(probe.c.test.session().target),/bytes differ/);
cases.push({caseId:'MOBILE-RUNTIME-RESOURCE-BYTE-MISMATCH',result:'PASS'});
console.log(JSON.stringify({schema:'closed-loop-executed-cases/1',synthetic:true,environment:'Node VM; synthetic DOM, selected Files, metadata store and resource responses',physicalDeviceAcceptance:false,cases},null,2));

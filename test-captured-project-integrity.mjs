// Captured private receipts: an audited receipt or source copy keeps the graph
// description captured while its snapshot was copied, so each comparison walks
// only the current value. This mirrors test-checkpoint-state-snapshot.mjs for
// the receipt owners, checks that only the audited sites capture, that no
// captured node ever reaches replaceable code or an excluded site, that no
// captured snapshot is walked again while its capture is still compared (a
// receipt whose snapshot is copied again stays uncaptured), and that store
// outcomes equal those of the same store with every capture disabled.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const read=name=>fs.readFileSync(new URL('./'+name,import.meta.url),'utf8');
const SECTION_START='function verifiedGraphNodes(',SECTION_END='// Private physical storage only.';
const replaceOnce=(source,before,after)=>{assert.equal(source.split(before).length,2,'CAPTURED_RECEIPT_ANCHOR_ORACLE: '+before.slice(0,80));return source.replace(before,after);};
// The audited opt-in sites, by the exact text that requests a capture.
export const CAPTURED_RECEIPT_SITES=Object.freeze([
 ' const integrity=verifiedProjectIntegrity(project,project.projectSha256,CAPTURED_PROJECT_INTEGRITY);',
 'committedIntegrity=verifiedProjectIntegrity(privateCommitted,digest,CAPTURED_PROJECT_INTEGRITY);',
 'committedIntegrity=verifiedProjectIntegrity(privateCommitted,next.projectSha256,CAPTURED_PROJECT_INTEGRITY);',
 'row:capturedPrivateCopy(base),journal:capturedPrivateCopy(journalSnapshot),'
]);
// The operational write receipt's snapshot is walked again to copy the context
// carrier and the returned project, so it must stay an ordinary receipt.
export const UNCAPTURED_COPIED_RECEIPT_SITE='integrity=verifiedProjectIntegrity(next,digest);\n  const retentionState=globalThis.closedLoopPromptEngine.promptContextRetentionState';
export function verifyCapturedReceiptSites(source=read('project-store.js')){
 for(const site of CAPTURED_RECEIPT_SITES)assert.equal(source.split(site).length,2,'CAPTURED_RECEIPT_SITE_ORACLE: '+site);
 assert.equal(source.split(UNCAPTURED_COPIED_RECEIPT_SITE).length,2,'CAPTURED_RECEIPT_COPIED_SNAPSHOT_SITE_ORACLE');
 // Exactly the audited sites request a capture: the definition, the opt-in
 // check and the three receipt sites name the token; two copies name the helper.
 assert.equal(source.split('CAPTURED_PROJECT_INTEGRITY').length-1,5,'CAPTURED_RECEIPT_SITE_POPULATION_ORACLE');
 assert.equal(source.split('capturedPrivateCopy(').length-1,3,'CAPTURED_COPY_SITE_POPULATION_ORACLE');
 return {sites:CAPTURED_RECEIPT_SITES.length};
}

export function verifyCapturedReceiptOwners({source=read('project-store.js')}={}){
 assert.equal(source.split(SECTION_START).length,2);assert.equal(source.split(SECTION_END).length,2);
 const section=source.slice(source.indexOf(SECTION_START),source.indexOf(SECTION_END));
 const context=createVerifierRuntime({Blob,TextEncoder,TextDecoder,Uint8Array,Uint32Array,ArrayBuffer,DataView,structuredClone});vm.runInContext(read('hash.js'),context);
 vm.runInContext(`const hash=closedLoopHash,clone=structuredClone;let walks=0;${section.replace('function verifiedGraphNodes(value){','function verifiedGraphNodes(value){walks++;')}
  const fixture=()=>{const shared={sha:'x',byteSize:4};return {job:{JOB_ID:'J-1',JOB_TITLE:'Captured'},projectData:{a:shared,b:shared,history:[{eventId:'E',detail:{k:[1,2,3]}}]},revision:3};};
  const project=fixture(),receipt=verifiedProjectIntegrity(project,'d',CAPTURED_PROJECT_INTEGRITY),plain=verifiedProjectIntegrity(project,'d');
  const describe=value=>{const ids=new Map(),out=[];const visit=item=>{if(!item||typeof item!=='object')return typeof item+':'+String(item);if(ids.has(item))return ['ref',ids.get(item)];const id=ids.size;ids.set(item,id);const node={id,array:Array.isArray(item),proto:Object.getPrototypeOf(item)===Object.prototype||Object.getPrototypeOf(item)===Array.prototype,entries:[]};out.push(node);for(const key of Object.getOwnPropertyNames(item)){const d=Object.getOwnPropertyDescriptor(item,key);node.entries.push([key,d.enumerable,d.writable,d.configurable,Object.hasOwn(d,'value')?visit(d.value):'accessor']);}return ['ref',id];};visit(value);return JSON.stringify(out);};
  const delta=expression=>{const before=walks;const result=expression();return {result,walks:walks-before};};`,context);
 const run=expression=>vm.runInContext(expression,context),cases=[];
 const note=name=>cases.push(name);
 assert.equal(run('capturedIntegrityProofs.has(receipt)&&!capturedIntegrityProofs.has(plain)'),true,'CAPTURED_RECEIPT_NATIVE_PROOF');note('opt-in-captures');
 // The captured snapshot is exactly the ordinary private copy: distinct
 // objects, the source's alias topology and the same data descriptors.
 assert.equal(run('receipt.snapshot!==project&&receipt.snapshot.projectData.a!==project.projectData.a&&receipt.snapshot.projectData.a===receipt.snapshot.projectData.b&&describe(receipt.snapshot)===describe(plain.snapshot)'),true,'CAPTURED_RECEIPT_SNAPSHOT_IS_PRIVATE_COPY');note('snapshot-is-private-copy');
 assert.deepEqual(JSON.parse(run('JSON.stringify([0,1,2].map(()=>delta(()=>unchangedVerifiedProject(receipt,project,"d"))))')),Array(3).fill({result:true,walks:1}),'CAPTURED_RECEIPT_CURRENT_ALWAYS_WALKED');
 assert.deepEqual(JSON.parse(run('JSON.stringify(delta(()=>unchangedVerifiedProject(plain,project,"d")))')),{result:true,walks:2},'CAPTURED_RECEIPT_UNCAPTURED_WALKS_BOTH');note('current-always-walked');
 for(const [label,expression]of [['other-project','unchangedVerifiedProject(receipt,fixture(),"d")'],['other-digest','unchangedVerifiedProject(receipt,project,"e")'],['other-kind','unchangedVerifiedProject({...receipt,kind:null},project,"d")'],['missing','unchangedVerifiedProject(undefined,project,"d")']])assert.deepEqual(JSON.parse(run(`JSON.stringify(delta(()=>${expression}))`)),{result:false,walks:0},'CAPTURED_RECEIPT_IDENTITY_ORACLE:'+label);
 note('identity-before-walk');
 run('project.projectData.history[0].detail.k[1]=9;');assert.equal(run('unchangedVerifiedProject(receipt,project,"d")'),false,'CAPTURED_RECEIPT_MUTATION_REJECTED');run('project.projectData.history[0].detail.k[1]=2;');assert.equal(run('unchangedVerifiedProject(receipt,project,"d")'),true);note('current-mutation-rejected');
 // Alias topology is not part of value equality, captured or not.
 run('project.projectData.b={sha:"x",byteSize:4};');assert.equal(run('unchangedVerifiedProject(receipt,project,"d")===unchangedVerifiedProject(plain,project,"d")&&unchangedVerifiedProject(receipt,project,"d")'),true,'CAPTURED_RECEIPT_ALIAS_INDEPENDENT');run('project.projectData.b=project.projectData.a;');note('alias-independent');
 // A carrier keeps the capture only for the receipt's own snapshot; a hand-built
 // receipt over the same snapshot, or a carrier whose snapshot changes, is cold.
 run('const carried=carryCapturedIntegrity({...receipt,extra:1},receipt),swapped=carryCapturedIntegrity({...receipt,snapshot:plain.snapshot},receipt),hand={kind:VERIFIED_PROJECT_INTEGRITY,project,digest:"d",snapshot:receipt.snapshot};');
 assert.deepEqual(JSON.parse(run('JSON.stringify([delta(()=>unchangedVerifiedProject(carried,project,"d")),capturedIntegrityProofs.has(swapped),delta(()=>unchangedVerifiedProject(swapped,project,"d")),capturedIntegrityProofs.has(hand),delta(()=>unchangedVerifiedProject(hand,project,"d"))])')),[{result:true,walks:1},false,{result:true,walks:2},false,{result:true,walks:2}],'CAPTURED_RECEIPT_CARRIER_ORACLE');
 run('const moved=carryCapturedIntegrity({...receipt},receipt);moved.snapshot=plain.snapshot;');assert.deepEqual(JSON.parse(run('JSON.stringify(delta(()=>unchangedVerifiedProject(moved,project,"d")))')),{result:true,walks:2},'CAPTURED_RECEIPT_MOVED_SNAPSHOT_COLD');note('carrier-own-snapshot-only');
 // Private source copies: same capture, same rules; non-objects stay plain.
 run('const row={jobId:"J-1",project:fixture()},rowCopy=capturedPrivateCopy(row),plainCopy=copyVerifiedTree(row);');
 assert.equal(run('capturedValueProofs.has(rowCopy)&&rowCopy!==row&&describe(rowCopy)===describe(plainCopy)'),true,'CAPTURED_COPY_NATIVE_PROOF');
 assert.deepEqual(JSON.parse(run('JSON.stringify([delta(()=>privateCopyMatches(rowCopy,row)),delta(()=>privateCopyMatches(plainCopy,row))])')),[{result:true,walks:1},{result:true,walks:2}],'CAPTURED_COPY_CURRENT_ALWAYS_WALKED');
 run('row.project.job.JOB_TITLE="Changed";');assert.equal(run('privateCopyMatches(rowCopy,row)'),false,'CAPTURED_COPY_MUTATION_REJECTED');run('row.project.job.JOB_TITLE="Captured";');
 assert.equal(run('capturedPrivateCopy(undefined)===undefined&&capturedPrivateCopy(null)===null&&privateCopyMatches(undefined,undefined)&&!privateCopyMatches(undefined,null)'),true,'CAPTURED_COPY_EMPTY_SOURCE_ORACLE');note('private-source-copies');
 // Current values are never trusted by identity: Proxy descriptor traps,
 // accessors, cycles and unsupported shapes keep the uncaptured result.
 const unusual=[['symbol','({...project,[Symbol("x")]:1})'],['getter','Object.defineProperty({...project},"revision",{enumerable:true,get(){return 3;}})'],['cycle','(()=>{const c={...project};c.self=c;return c;})()'],['proxy-change','new Proxy(project,{getOwnPropertyDescriptor(target,key){const d=Reflect.getOwnPropertyDescriptor(target,key);return key==="revision"?{...d,value:4}:d;}})']];
 for(const [label,expression]of unusual){assert.equal(run(`(()=>{const current=${expression};const captured=verifiedProjectIntegrity(project,"d",CAPTURED_PROJECT_INTEGRITY);captured.project=current;const uncaptured={...plain,project:current};return unchangedVerifiedProject(captured,current,"d")===false&&unchangedVerifiedProject(uncaptured,current,"d")===false;})()`),true,'CAPTURED_RECEIPT_UNUSUAL_INPUT:'+label);}
 assert.throws(()=>run('(()=>{const current=new Proxy(project,{getOwnPropertyDescriptor(){throw new Error("PROXY_TRAP");}}),captured=verifiedProjectIntegrity(project,"d",CAPTURED_PROJECT_INTEGRITY);captured.project=current;return unchangedVerifiedProject(captured,current,"d");})()'),/PROXY_TRAP/);note('unusual-inputs:5');
 // A replaced reflection primitive releases the capture before the private
 // snapshot could reach it; restoring the primitive cannot revive the nodes.
 run('const second=verifiedProjectIntegrity(project,"d",CAPTURED_PROJECT_INTEGRITY),secondCopy=capturedPrivateCopy(row),originalNames=Object.getOwnPropertyNames;Object.getOwnPropertyNames=function(value){return originalNames(value);};');
 assert.equal(run('unchangedVerifiedProject(second,project,"d")&&privateCopyMatches(secondCopy,row)'),true);
 assert.equal(run('capturedIntegrityProofs.get(second).nodes===null&&capturedIntegrityProofs.get(second).scope===null&&capturedValueProofs.get(secondCopy).nodes===null'),true,'CAPTURED_RECEIPT_NATIVE_CHANGE_RELEASES');
 assert.equal(run('(()=>{const late=verifiedProjectIntegrity(project,"d",CAPTURED_PROJECT_INTEGRITY);return !capturedIntegrityProofs.has(late)&&describe(late.snapshot)===describe(plain.snapshot)&&unchangedVerifiedProject(late,project,"d");})()'),true,'CAPTURED_RECEIPT_NOT_CAPTURED_UNDER_CHANGED_NATIVE');
 run('Object.getOwnPropertyNames=originalNames;');
 assert.deepEqual(JSON.parse(run('JSON.stringify([delta(()=>unchangedVerifiedProject(second,project,"d")),delta(()=>privateCopyMatches(secondCopy,row))])')),[{result:true,walks:2},{result:true,walks:2}],'CAPTURED_RECEIPT_INVALIDATED_PROOF_CANNOT_REVIVE');note('native-change-releases');note('restored-native-cannot-revive');
 return {passed:true,currentWalksPerComparison:1,uncapturedWalksPerComparison:2,unusualInputCases:5,cases};
}

// Store-level audit. Every graph captured by copyCheckpointValueSnapshot is
// recorded; replaceable globals and the excluded store sites are watched for
// any argument that reaches a captured node.
function instrumentCaptureAudit(source){
 source=replaceOnce(source,"proof.snapshot=copyVerifiedGraph(value,sourceNodes,nodes,arrayLengths);proof.nodes=nodes;","proof.snapshot=copyVerifiedGraph(value,sourceNodes,nodes,arrayLengths);proof.nodes=nodes;globalThis.__recordCapturedNodes?.(nodes,proof);");
 // A captured snapshot walked again (by a copy or a cold comparison) is exposed
 // to the reflection primitives current at that walk; its capture must never
 // be compared after that.
 source=replaceOnce(source,'    if(finish){ops.setDelete(active,item);continue;}','    if(finish){ops.setDelete(active,item);continue;}globalThis.__walkedNode?.(item);');
 source=replaceOnce(source,'function unchangedCheckpointValueSnapshot(proof,current){','function unchangedCheckpointValueSnapshot(proof,current){globalThis.__capturedCompare?.(proof);');
 // The value each History owner encodes or exposes to its hooks.
 for(const [anchor,name,value]of [['async function encodeCheckpoint(project,artifactRows,{','encodeCheckpoint','project'],['async function prepareHistoryCommit(next,prior,{','historyCandidate','next']]){
  const at=source.indexOf(anchor),end='}={}){\n';assert.ok(at>=0&&source.indexOf(anchor,at+1)<0,'CAPTURED_RECEIPT_AUDIT_ANCHOR_ORACLE: '+name);
  const open=source.indexOf(end,at)+end.length;source=source.slice(0,open)+`  globalThis.__privateSite?.('${name}',${value});\n`+source.slice(open);
 }
 source=replaceOnce(source,'if(pair)checkpointDigestPairs.add(pair);\n  // With a bound pair','if(pair){checkpointDigestPairs.add(pair);globalThis.__privateSite?.(\'checkpointPair\',pair.snapshot);}\n  // With a bound pair');
 source=replaceOnce(source,'rootCertificates.add(root);unverifiedWriteRoots.add(root);return root;','globalThis.__privateSite?.(\'rootCertificate\',root.snapshot);globalThis.__privateSite?.(\'rootCertificateProject\',root.project);rootCertificates.add(root);unverifiedWriteRoots.add(root);return root;');
 source=replaceOnce(source,'const candidateDigest=projectSha256(candidate),candidateProof=verifiedProjectIntegrity(candidate,candidateDigest);','const candidateDigest=projectSha256(candidate),candidateProof=verifiedProjectIntegrity(candidate,candidateDigest);globalThis.__privateSite?.(\'mutationCandidate\',candidateProof.snapshot);');
 source=replaceOnce(source,'const digest=pair?pair.projectSha256:projectSha256(next),integrity=verifiedProjectIntegrity(next,digest);\n  await persistProjectPromptFiles(','const digest=pair?pair.projectSha256:projectSha256(next),integrity=verifiedProjectIntegrity(next,digest);globalThis.__privateSite?.(\'canonicalEncodeSource\',integrity.snapshot);\n  await persistProjectPromptFiles(');
 source=replaceOnce(source,'globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS','globalThis.__captureState=()=>({commit:Boolean(recentOperationalCommitRead),receipt:Boolean(recentOperationalCommitRead)&&capturedIntegrityProofs.has(recentOperationalCommitRead),row:Boolean(recentOperationalCommitRead?.row)&&capturedValueProofs.has(recentOperationalCommitRead.row),journal:recentOperationalCommitRead?.journal?capturedValueProofs.has(recentOperationalCommitRead.journal):null});globalThis.__privateRead=readProjectForTransaction;globalThis.__readCaptured=value=>capturedIntegrityProofs.has(value);globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS');
 return source;
}
function auditRuntime(source){
 const captured=new WeakSet(),owners=new WeakMap(),exposed=new WeakSet(),violations=[],observed=new Map(),calls=new Map();
 const reaches=value=>{const seen=new Set(),pending=[value];while(pending.length){const item=pending.pop();if(!item||typeof item!=='object'||seen.has(item)||item instanceof Blob)continue;seen.add(item);if(captured.has(item))return true;if(seen.size>200000)return false;for(const key of Reflect.ownKeys(item)){const d=Reflect.getOwnPropertyDescriptor(item,key);if(d&&Object.hasOwn(d,'value'))pending.push(d.value);}}return false;};
 const r=projectStoreRuntime({storageWorker:false,sourceOverrides:{'project-store.js':source},environment:{
  __recordCapturedNodes:(nodes,proof)=>{for(const node of nodes.keys()){captured.add(node);owners.set(node,proof);}},
  __walkedNode:item=>{const proof=owners.get(item);if(proof?.nodes)exposed.add(proof);},
  __capturedCompare:proof=>{if(proof.nodes&&exposed.has(proof))violations.push('compare-after-exposure');},
  __privateSite:(name,value)=>{observed.set(name,(observed.get(name)||0)+1);if(reaches(value))violations.push('site:'+name);}
 }});
 // Replaceable owners receive no captured node, directly or nested.
 const wrapOwner=(name,owner)=>{const wrapped={};for(const key of Reflect.ownKeys(owner)){const value=owner[key];wrapped[key]=typeof value==='function'?function(...args){calls.set(name,(calls.get(name)||0)+1);if(args.some(reaches))violations.push(name+'.'+String(key));return Reflect.apply(value,this,args);}:value;}return Object.freeze(wrapped);};
 for(const name of ['closedLoopWorkflowEngine','closedLoopPromptEngine','closedLoopResponseIngestion'])r.runtime[name]=wrapOwner(name,r.runtime[name]);
 const structured=r.runtime.structuredClone;r.runtime.structuredClone=value=>{if(reaches(value))violations.push('structuredClone');return structured(value);};
 r.engine=r.runtime.closedLoopWorkflowEngine;
 return {r,violations,observed,calls};
}
const captureState=r=>JSON.parse(JSON.stringify(r.runtime.__captureState()));
export async function verifyCapturedReceiptStoreAudit({source=read('project-store.js'),fault=null}={}){
 const prepare=input=>{const instrumented=instrumentCaptureAudit(input);return fault?replaceOnce(instrumented,fault[0],fault[1]):instrumented;};
 const {r,violations,observed,calls}=auditRuntime(prepare(source)),cases=[];
 let p=await r.store.createProject({commandId:'CAPTURED-RECEIPT-AUDIT'});p.job.JOB_TITLE='Captured audit '+'retained content '.repeat(200);r.engine.recalculate(p);
 p=await r.store.writeProject(p,{expectedProjectRevision:p.revision});
 assert.deepEqual(captureState(r),{commit:true,receipt:true,row:false,journal:null},'CAPTURED_RECEIPT_CANONICAL_COMMIT_ORACLE');cases.push('canonical-commit-captured');
 const canonical=r.copy(p);canonical.job.JOB_TITLE='Captured audit second '+'retained content '.repeat(200);r.engine.recalculate(canonical);p=await r.store.writeProject(canonical,{expectedProjectRevision:p.revision});
 for(const view of ['Records','Workflow']){const next=r.copy(p);next.activeView=view;p=await r.store.writeProject(next,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
  assert.deepEqual(captureState(r),{commit:true,receipt:true,row:true,journal:true},'CAPTURED_RECEIPT_OPERATIONAL_COMMIT_ORACLE '+view);}
 cases.push('operational-commit-captured');
 for(const name of ['Project','Workflow'])await r.store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:r.copy({activeStage:1,activeView:name,drafts:{},scrollX:0,scrollY:3})});
 const publicRead=await r.store.readProject(p.job.JOB_ID);assert.equal(publicRead.projectSha256,p.projectSha256);
 const privateRead=await r.runtime.__privateRead(p.job.JOB_ID);assert.equal(r.runtime.__readCaptured(privateRead),true,'CAPTURED_RECEIPT_PRIVATE_READ_ORACLE');cases.push('private-read-captured');
 const last=r.copy(p);last.activeView='Records';p=await r.store.writeProject(last,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 for(const site of ['encodeCheckpoint','historyCandidate','checkpointPair','rootCertificate','rootCertificateProject','mutationCandidate','canonicalEncodeSource'])assert.ok(observed.get(site)>0,'CAPTURED_RECEIPT_AUDIT_SITE_REACHED_ORACLE: '+site);
 for(const owner of ['closedLoopWorkflowEngine','closedLoopPromptEngine'])assert.ok(calls.get(owner)>0,'CAPTURED_RECEIPT_AUDIT_OWNER_REACHED_ORACLE: '+owner);
 assert.deepEqual(violations,[],'CAPTURED_RECEIPT_NO_EXPOSURE_ORACLE');cases.push('no-captured-node-exposed');
 // Without a bound pair the History candidate is the receipt's own snapshot:
 // it is encoded, so that receipt must not capture.
 const unbound=auditRuntime(prepare(replaceOnce(source,'const pair=measured&&rootDigestPrimitivesUnchanged(primitive)&&verifiedValuesEqual(snapshot,canonicalProject(next))?Object.freeze({primitive,snapshot,...measured}):null;','const pair=null;')));
 let q=await unbound.r.store.createProject({commandId:'CAPTURED-RECEIPT-UNBOUND'});q.job.JOB_TITLE='Unbound audit';unbound.r.engine.recalculate(q);q=await unbound.r.store.writeProject(q,{expectedProjectRevision:q.revision});
 for(const view of ['Records','Workflow']){const next=unbound.r.copy(q);next.activeView=view;q=await unbound.r.store.writeProject(next,{operational:true,expectedProjectRevision:q.revision,expectedStateSha256:q.projectSha256});}
 assert.ok(unbound.observed.get('historyCandidate')>0&&!unbound.observed.get('checkpointPair'),'CAPTURED_RECEIPT_UNBOUND_FIXTURE_ORACLE');
 assert.deepEqual(unbound.violations,[],'CAPTURED_RECEIPT_UNBOUND_NO_EXPOSURE_ORACLE');cases.push('unbound-candidate-not-captured');
 return {passed:true,cases,sitesObserved:Object.fromEntries(observed)};
}

// Intended faults: each captures at an excluded site and must be reported as
// an exposure by the audit above.
export const CAPTURED_RECEIPT_AUDIT_FAULTS=Object.freeze({
 'capture-unbound-history-candidate':['integrity=verifiedProjectIntegrity(next,digest);\n  const retentionState=','integrity=verifiedProjectIntegrity(next,digest,pair?null:CAPTURED_PROJECT_INTEGRITY);\n  const retentionState=','CAPTURED_RECEIPT_UNBOUND_NO_EXPOSURE_ORACLE'],
 // The bound operational receipt: its snapshot is copied again after capture.
 'capture-copied-operational-receipt':['integrity=verifiedProjectIntegrity(next,digest);\n  const retentionState=','integrity=verifiedProjectIntegrity(next,digest,pair?CAPTURED_PROJECT_INTEGRITY:null);\n  const retentionState=','CAPTURED_RECEIPT_NO_EXPOSURE_ORACLE'],
 // Faults apply to the instrumented source.
 'capture-canonical-encode-source':["integrity=verifiedProjectIntegrity(next,digest);globalThis.__privateSite?.('canonicalEncodeSource',","integrity=verifiedProjectIntegrity(next,digest,CAPTURED_PROJECT_INTEGRITY);globalThis.__privateSite?.('canonicalEncodeSource',",'CAPTURED_RECEIPT_NO_EXPOSURE_ORACLE'],
 'capture-mutation-candidate':['candidateProof=verifiedProjectIntegrity(candidate,candidateDigest);','candidateProof=verifiedProjectIntegrity(candidate,candidateDigest,CAPTURED_PROJECT_INTEGRITY);','CAPTURED_RECEIPT_NO_EXPOSURE_ORACLE'],
 'capture-checkpoint-pair':[',snapshot=primitive&&verifiedGraphNodes(next)?copyVerifiedTree(canonicalProject(next)):null,measured=',',snapshot=primitive?capturedPrivateCopy(canonicalProject(next)):null,measured=','CAPTURED_RECEIPT_NO_EXPOSURE_ORACLE']
});
export async function verifyCapturedReceiptAuditFaults({source=read('project-store.js')}={}){
 const faults=[];
 for(const [fault,[before,after,oracle]]of Object.entries(CAPTURED_RECEIPT_AUDIT_FAULTS)){
  await assert.rejects(()=>verifyCapturedReceiptStoreAudit({source,fault:[before,after]}),error=>error.code==='ERR_ASSERTION'&&error.message.includes(oracle),'CAPTURED_RECEIPT_INTENDED_FAULT_ORACLE '+fault);
  faults.push({fault,oracle,detected:true});
 }
 return {passed:true,faults};
}

// The same command sequence, including other-tab tampering and a replaced
// reflection primitive, with captures enabled and with every capture disabled:
// each step resolves or refuses identically and commits the same digest.
export function disableCapturedReceipts(source){
 source=replaceOnce(source,'if(capture!==CAPTURED_PROJECT_INTEGRITY)return {kind:VERIFIED_PROJECT_INTEGRITY,project,digest,snapshot:copyVerifiedTree(project)};','return {kind:VERIFIED_PROJECT_INTEGRITY,project,digest,snapshot:copyVerifiedTree(project)};');
 return replaceOnce(source,'function capturedPrivateCopy(value){','function capturedPrivateCopy(value){return copyVerifiedTree(value);');
}
async function captureSequence(source){
 const r=projectStoreRuntime({storageWorker:false,sourceOverrides:{'project-store.js':source}}),steps=[];
 // Digests carry fresh event identities, so steps record outcomes and revisions.
 const step=async(name,command)=>{try{const value=await command();steps.push({name,resolved:Boolean(value?.projectSha256),revision:value?.revision??null});return value;}catch(error){steps.push({name,error:error.code||error.name,message:error.message});return null;}};
 let p=await r.store.createProject({commandId:'CAPTURED-RECEIPT-SEQUENCE'});p.job.JOB_TITLE='Captured sequence';r.engine.recalculate(p);
 p=await step('canonical',()=>r.store.writeProject(p,{expectedProjectRevision:p.revision}));
 const operational=async name=>{const next=r.copy(p);r.engine.addHistory(next,'SYNTHETIC_CAPTURE_SEQUENCE',{scope:name});const saved=await step(name,()=>r.store.writeProject(next,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256}));if(saved)p=saved;return saved;};
 await operational('operational');
 // A caller mutation of the returned project does not reach the private proof.
 const returned=p;p=r.copy(returned);returned.job.JOB_TITLE='Caller mutation of the returned project';returned.projectData.history.at(-1).detail={changed:true};await operational('after-returned-mutation');
 // A replaced reflection primitive releases every capture; restored, it stays cold.
 const names=r.runtime.Object.getOwnPropertyNames;r.runtime.Object.getOwnPropertyNames=function(value){return Reflect.apply(names,this,[value]);};
 await operational('under-replaced-native');r.runtime.Object.getOwnPropertyNames=names;await operational('after-restored-native');
 // Another tab's same-label payload and journal changes are refused.
 await operational('before-row-tamper');r.rows.get('projects').get(p.job.JOB_ID).project.job.JOB_TITLE='Other tab payload';await operational('after-row-tamper');
 const fresh=projectStoreRuntime({storageWorker:false,sourceOverrides:{'project-store.js':source}});for(const [name,map]of r.rows)fresh.rows.set(name,new Map([...map].map(([key,value])=>[key,fresh.copy(value)])));
 steps.push({name:'quarantined',value:(await fresh.store.listQuarantinedProjects()).length});
 return steps;
}
export async function verifyCapturedReceiptEquivalence({source=read('project-store.js')}={}){
 const captured=await captureSequence(source),uncaptured=await captureSequence(disableCapturedReceipts(source));
 assert.deepEqual(captured,uncaptured,'CAPTURED_RECEIPT_STORE_EQUIVALENCE_ORACLE');
 assert.ok(captured.some(row=>row.error),'CAPTURED_RECEIPT_EQUIVALENCE_REFUSAL_FIXTURE_ORACLE');
 return {passed:true,steps:captured};
}
// A replaceable owner swaps a reflection primitive after the operational write
// receipt is made, keeps the private snapshot nodes it is shown while the
// context carrier is copied, restores the native and changes a kept node. The
// candidate check walks the snapshot again and refuses before any durable
// write, as the uncaptured receipt always has; a captured receipt would compare
// its old description and return (and later persist) the changed value.
async function copiedReceiptHarvest(source){
 const r=projectStoreRuntime({storageWorker:false,sourceOverrides:{'project-store.js':source}}),{store,copy,engine,prompts}=r;
 let p=await store.createProject({commandId:'CAPTURED-RECEIPT-HARVEST'});p.job.JOB_TITLE='Harvest original title';engine.recalculate(p);
 p=await store.writeProject(p,{expectedProjectRevision:p.revision});
 const reserved=copy(p);prompts.reserveAndBuildPromptRecord(reserved,1,{},{});p=await store.writeProject(reserved,{expectedProjectRevision:p.revision});
 const O=r.runtime.Object,native=O.getOwnPropertyDescriptor,prompt=r.runtime.closedLoopPromptEngine,kept=new Set(),shown=new Set();let stage='idle';
 const wrapped=Object.fromEntries(Reflect.ownKeys(prompt).map(key=>[key,prompt[key]]));
 wrapped.promptContextRetentionState=function(record){if(stage==='armed'){stage='swapped';O.getOwnPropertyDescriptor=function(target,key){if(key==='JOB_TITLE'&&target&&typeof target==='object')kept.add(target);return native(target,key);};}return prompt.promptContextRetentionState(record);};
 wrapped.copyRetainedPromptContextFiles=function(from,to,...rest){if(stage==='swapped'){stage='restored';O.getOwnPropertyDescriptor=native;shown.add(from?.job);shown.add(to?.job);for(const job of kept)if(!shown.has(job))job.JOB_TITLE='Harvested private snapshot change';}return prompt.copyRetainedPromptContextFiles(from,to,...rest);};
 r.runtime.closedLoopPromptEngine=Object.freeze(wrapped);
 const rows=()=>r.copy([...r.rows].map(([name,map])=>[name,[...map]])),before=rows(),next=copy(p);next.activeView='Records';stage='armed';
 let outcome;try{const saved=await store.writeProject(next,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});outcome={committed:true,title:saved.job.JOB_TITLE};}catch(error){outcome={committed:false,code:error.code,message:error.message};}
 O.getOwnPropertyDescriptor=native;r.runtime.closedLoopPromptEngine=prompt;
 return {...outcome,stage,harvested:[...kept].filter(job=>!shown.has(job)).length,rowsUnchanged:(()=>{try{assert.deepEqual(rows(),before);return true;}catch{return false;}})()};
}
export async function verifyCopiedReceiptHarvest({source=read('project-store.js')}={}){
 const refused=await copiedReceiptHarvest(source);
 assert.deepEqual(refused,{committed:false,code:'STALE_PROJECT_REVISION',message:'The prepared response candidate changed before commit. Prepare the current candidate again.',stage:'restored',harvested:1,rowsUnchanged:true},'CAPTURED_RECEIPT_COPIED_SNAPSHOT_HARVEST_ORACLE');
 // Fixture sensitivity: the same owner against a captured operational receipt
 // whose carrier comparisons also use the capture.
 const [before,after]=CAPTURED_RECEIPT_AUDIT_FAULTS['capture-copied-operational-receipt'];let faulted=replaceOnce(source,before,after);
 for(const compare of ['||!verifiedValuesEqual(integrity.snapshot,contextCarrier)||pair&&','if(!verifiedValuesEqual(integrity.snapshot,contextCarrier))throw storageError(\'Captured prompt context'])faulted=replaceOnce(faulted,compare,compare.replace('verifiedValuesEqual(integrity.snapshot,contextCarrier)','capturedSnapshotMatches(integrity,contextCarrier)'));
 const accepted=await copiedReceiptHarvest(faulted);
 assert.deepEqual({committed:accepted.committed,title:accepted.title,stage:accepted.stage,harvested:accepted.harvested},{committed:true,title:'Harvested private snapshot change',stage:'restored',harvested:1},'CAPTURED_RECEIPT_COPIED_SNAPSHOT_FAULT_ORACLE');
 return {passed:true,refused,capturedFaultAccepted:true};
}
// A context hook receives the writer's candidate. The shared history value
// requires byte comparison even when a transient encoder swap could disappear
// before a later native check.
export async function verifyOperationalSharedBytes(source=read('project-store.js')){
 class LocalEncoder extends TextEncoder{}
 Object.defineProperty(LocalEncoder.prototype,'encode',Object.getOwnPropertyDescriptor(TextEncoder.prototype,'encode'));
 const r=projectStoreRuntime({storageWorker:false,sourceOverrides:{'project-store.js':source},environment:{TextEncoder:LocalEncoder}});
 const p=await r.store.createProject({commandId:'OPERATIONAL-SHARED-OWNER'});
 const event=r.engine.addHistory(p,'SHARED_GUARD_PROBE',{payload:{a:'m'.repeat(70000),z:1}});event.mirror=event.payload;
 r.engine.recalculate(p);
 const saved=await r.store.writeProject(p,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 const retained=saved.projectData.history.find(row=>row.type==='SHARED_GUARD_PROBE');assert.equal(retained.payload,retained.mirror,'OPERATIONAL_SHARED_BYTES_FIXTURE');
 const next=r.copy(saved);next.activeView='Records';r.runtime.incoming=next;
 const durable=()=>r.copy([...r.rows].map(([name,rows])=>[name,[...rows]])),before=durable();
 vm.runInContext(`
  const oldEncode=TextEncoder.prototype.encode,engine=closedLoopPromptEngine;Error.stackTraceLimit=35;
  globalThis.probe={swaps:0,encodes:0,hooks:0};
  globalThis.closedLoopPromptEngine=Object.freeze({...engine,copyRetainedPromptContextFiles(input,copy){
   engine.copyRetainedPromptContextFiles(input,copy);
   if(input!==incoming||!copy?.projectData)return;
   const event=copy.projectData.history.find(row=>row.type==='SHARED_GUARD_PROBE');if(!event)return;
   probe.hooks++;
   const payload=new Proxy(event.payload,{getOwnPropertyDescriptor(target,key){
    const comparing=new Error().stack.includes('operationalValuesEqual');
    if(comparing&&key==='a'){probe.swaps++;TextEncoder.prototype.encode=()=>{probe.encodes++;throw Error('SHARED_BYTES_ENCODER_CHANGED');};}
    if(comparing&&key==='z')TextEncoder.prototype.encode=oldEncode;
    return Reflect.getOwnPropertyDescriptor(target,key);
   }});
   event.payload=event.mirror=payload;
  }});`,r.runtime);
 try{
  await assert.rejects(()=>r.store.writeProject(next,{operational:true,expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256}),
   error=>error.message==='SHARED_BYTES_ENCODER_CHANGED','OPERATIONAL_SHARED_BYTES_REFUSAL');
  assert.ok(r.runtime.probe.hooks>0&&r.runtime.probe.swaps>0&&r.runtime.probe.encodes>0,'OPERATIONAL_SHARED_BYTES_REACHED_ENCODER');
  assert.deepEqual(durable(),before,'OPERATIONAL_SHARED_BYTES_ATOMIC');
 }finally{vm.runInContext('TextEncoder.prototype.encode=oldEncode;',r.runtime);}
}
export async function verifyCapturedProjectIntegrity(options={}){
 await verifyOperationalSharedBytes(options.source);
 return {sites:verifyCapturedReceiptSites(options.source),owners:verifyCapturedReceiptOwners(options),storeAudit:await verifyCapturedReceiptStoreAudit(options),copiedReceiptHarvest:await verifyCopiedReceiptHarvest(options),equivalence:await verifyCapturedReceiptEquivalence(options)};
}
if(import.meta.url===`file://${process.argv[1]}`){
 const report={capturedProjectIntegrity:await verifyCapturedProjectIntegrity()};
 if(process.argv.includes('--faults'))report.capturedReceiptAuditFaults=await verifyCapturedReceiptAuditFaults();
 console.log(JSON.stringify(report));
}

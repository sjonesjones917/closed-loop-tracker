import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'];
const sourceFiles=[...runtimeFiles,'app-core.js']; // app-core is tuple metadata, not executed by this owning store fixture.
const requiredCases=['three-view-saves-and-public-cold','same-label-root','same-label-part','changed-project-row','changed-journal','changed-history-generation','candidate-after-await','primitive-after-await','encoder-after-await','definition-after-await','prepared-state-after-validator','new-file-after-await','artifact-same-label','artifact-metadata','artifact-reference','hash-reject','timeout','late-hash-after-timeout','abort','write-failure','root-mutation-during-preparation','source-mutation-during-preparation','primitive-mutation-during-preparation'];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

// Every observer is an exact source anchor; unsupported source fails before opening a target.
export function instrumentRetainedRootNativeSources(input){
 const originals=new Map([...input].map(([name,bytes])=>[name,Buffer.from(bytes)]));
const anchors={restore:'async function restoreHistoryProject(body,readFile,verifiedParts=new Map(),verifiedByteDigests=null){',digest:'function historyProjectDigests(project){',static:'function assertProjectIntegrity(project,options){',derived:'function derivedProjectIntegrityIssues(project,{verifyCachedProjection=true,projectionObservedAt=null,verifyProjection=true}={}){',bytes:'async function historyBlobSha256(blob,verifiedByteDigests=null){',owner:'async function commitRootCheckpoint(jobId,project,verifiedRead,prepared,operationId,checkpointId){'};
const observerAnchors=[];const observeOnce=(input,before,after)=>{const count=input.split(before).length-1;if(count!==1)throw Error('Required observer anchor count '+count+': '+before);observerAnchors.push(before);return input.replace(before,after);};
let source=originals.get('project-store.js').toString('utf8');
for(const [name,anchor] of Object.entries(anchors)){if(source.split(anchor).length!==2)throw Error('Independent exact observer anchor '+name);source=observeOnce(source,anchor,anchor+`globalThis.__rootObservation.${name}++;`);}
source=observeOnce(source,'return commitRootCheckpoint(jobId,project,verifiedRead,prepared,operationId,checkpointId);','{await globalThis.__beforeRootTransaction?.(prepared);await globalThis.__atRootTransaction?.();return commitRootCheckpoint(jobId,project,verifiedRead,prepared,operationId,checkpointId);}');
source=observeOnce(source,'rootCertificates.add(root);recentOperationalCommitRead=', 'globalThis.__rootObservation.publish++;rootCertificates.add(root);recentOperationalCommitRead=');
source=observeOnce(source,'    const bytes=new Map();','    globalThis.__afterRootHash?.(root,tx,prepared);\n    const bytes=new Map();');
source=observeOnce(source,'if(!gateUnchanged())throw storageError(\'Checkpoint validation changed its source or write inputs.\'', 'globalThis.__afterRootValidation?.();if(!gateUnchanged())throw storageError(\'Checkpoint validation changed its source or write inputs.\'');
source=observeOnce(source,",STORAGE_IO_TIMEOUT_MS);\n  pump();",",globalThis.__rootTransactionTimeout||STORAGE_IO_TIMEOUT_MS);\n  pump();");
source=observeOnce(source,'stopGates(error);if(active())reject(error);','stopGates(error);globalThis.__rootOwnerCleanup={gates:gates.size,ready:ready.length,terminal,running};if(active())reject(error);');
source=observeOnce(source,'if(active())resolve();};\n    tx.onerror=()=>{};', 'globalThis.__rootOwnerCleanup={gates:gates.size,ready:ready.length,terminal,running};if(active())resolve();};\n    tx.onerror=()=>{};');
source=observeOnce(source,'      const rootQualified=', '      globalThis.__mutateRootPreparation?.(decoded.project,project);\n      const rootQualified=');
const observedHash=observeOnce(originals.get('hash.js').toString('utf8'),'async function sha256Bytes(bytes){','async function sha256Bytes(bytes){globalThis.__rootObservation.actualHashes++;if(globalThis.__holdRootHash)await new Promise(()=>{});if(globalThis.__delayRootHash)await new Promise(resolve=>setTimeout(resolve,globalThis.__delayRootHash));');
 const served=new Map(originals);served.set('project-store.js',Buffer.from(source));served.set('hash.js',Buffer.from(observedHash));
 assert.equal(observerAnchors.length,15,'RETAINED_ROOT_NATIVE_OBSERVER_COUNT_ORACLE');
 return {originals,served,observerAnchors};
}

export function assertRetainedRootNativeReport(report){
 assert.equal(report?.status,'PASS','RETAINED_ROOT_NATIVE_STATUS_ORACLE');
 assert.deepEqual(report.checks?.map(row=>row.mode).sort(),[...requiredCases].sort(),'RETAINED_ROOT_NATIVE_REQUIRED_CASE_ORACLE');
 for(const row of report.checks.slice(1)){
  assert.equal(row.noCheckpointReturned,true,'RETAINED_ROOT_NATIVE_REFUSAL_ORACLE '+row.mode);
  assert.equal(row.noProofPublished,true,'RETAINED_ROOT_NATIVE_PUBLICATION_ORACLE '+row.mode);
  assert.equal(row.exactStatePreserved,true,'RETAINED_ROOT_NATIVE_LAST_VALID_STATE_ORACLE '+row.mode);
 }
 return report;
}

// Uses the caller's existing Chromium process, CDP transport and evaluator.
// A new origin/target owns its native IndexedDB and closes before main operator checks.
export async function verifyRetainedRootNative({createTarget,sourceDirectory=new URL('.',import.meta.url),reportPath=null}={}){
 assert.equal(typeof createTarget,'function','RETAINED_ROOT_NATIVE_EXISTING_BROWSER_ORACLE');
 const start=performance.now(),directory=new URL(sourceDirectory),inputs=new Map(sourceFiles.map(name=>[name,fs.readFileSync(new URL(name,directory))]));
 const fixture=fs.readFileSync(new URL('test-retained-root-native.html',import.meta.url));
 const {originals,served,observerAnchors}=instrumentRetainedRootNativeSources(inputs);
 const server=http.createServer((req,res)=>{
  const name=(req.url||'/').split('?')[0].slice(1),body=name==='test-retained-root-native.html'?fixture:runtimeFiles.includes(name)?served.get(name):null;
  if(!body){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(body);
 });
 let target;
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  target=await createTarget();
  await target.navigate('http://127.0.0.1:'+server.address().port+'/test-retained-root-native.html');
  const observed=await target.evaluate(`new Promise((resolve,reject)=>{let interval,deadline;const check=()=>{const node=document.querySelector('#result');if(!node||node.textContent==='PENDING')return;clearInterval(interval);clearTimeout(deadline);try{resolve(JSON.parse(node.textContent));}catch(error){reject(error);}};interval=setInterval(check,25);deadline=setTimeout(()=>{clearInterval(interval);reject(Error('RETAINED_ROOT_NATIVE_FIXTURE_DEADLINE'));},20000);check();})`);
  assertRetainedRootNativeReport(observed);
  const report={...observed,elapsedMs:performance.now()-start,sourceFiles:Object.fromEntries([...originals].map(([name,bytes])=>[name,{bytes:bytes.length,sha256:digest(bytes),observedRuntimeSha256:digest(served.get(name)),executed:runtimeFiles.includes(name)}])),fixture:{name:'test-retained-root-native.html',bytes:fixture.length,sha256:digest(fixture)},observerAnchors,requiredObserverAnchorsAllMatchedOnce:true,existingBrowserReused:true,isolatedTargetAndOrigin:true};
  if(reportPath)fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  return report;
 }finally{
  try{await target?.close();}finally{server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));}
 }
}

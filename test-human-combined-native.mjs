import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {instrumentNativeHumanCombinedSource} from './instrument-native-human-combined.mjs';
import {HUMAN_COMBINED_TEST_SOURCES,completeHumanCombinedNative} from './native-human-combined-evidence-contract.mjs';
const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'];
const fixtureFiles=['test-human-combined-native.html','test-human-combined-cold.html','human-fixture.js','human-cases.js'];
const requiredCases=['OMITTED_DECISION','CHANGED_FACT','ABORT_BEFORE_PROJECT_PUT','ABORT_AFTER_PROJECT_PUT','NATIVE_TRANSACTION_EXPIRED','VALID_COLD_COMMIT','LOST_COMPLETION_TIMEOUT_READBACK'];
const digest=value=>createHash('sha256').update(value).digest('hex');
export function assertHumanCombinedNativeReport(report){
 assert.equal(completeHumanCombinedNative(report),true,'NATIVE_HUMAN_COMPLETE_OWNED_REPORT');
 assert.equal(report?.status,'PASS','NATIVE_HUMAN_REPORT_STATUS');assert.equal(report.caseCount,7);assert.deepEqual(report.checks.map(x=>x.mode).sort(),[...requiredCases].sort());
 for(const c of report.checks)assert.equal(c.result,'PASS','NATIVE_HUMAN_REQUIRED_CASE '+c.mode);
 const by=Object.fromEntries(report.checks.map(c=>[c.mode,c]));
 for(const mode of ['OMITTED_DECISION','CHANGED_FACT'])assert.equal(by[mode].exactStatePreserved,true);
 for(const mode of ['ABORT_BEFORE_PROJECT_PUT','ABORT_AFTER_PROJECT_PUT','NATIVE_TRANSACTION_EXPIRED']){const c=by[mode];assert.equal(c.exactTransactionStatePreserved,true);assert.equal(c.transactionPreimageSha256,c.postimageSha256);assert.equal(c.cold.status,'PENDING_OPERATOR_REVIEW');}
 for(const mode of ['VALID_COLD_COMMIT','LOST_COMPLETION_TIMEOUT_READBACK']){const c=by[mode];assert.equal(c.actualNativeCompletionCount,1);assert.equal(c.cold.answerCount,1);assert.equal(c.cold.confirmationCount,2);assert.equal(c.cold.status,'ACCEPTED');}
 assert.equal(by.OMITTED_DECISION.error.code,'HUMAN_AUTHORITY_CONFIRMATION_REQUIRED');assert.equal(by.OMITTED_DECISION.error.candidateKey,'atomic-decision');assert.equal(by.CHANGED_FACT.error.code,'HUMAN_AUTHORITY_CORRECTION_REQUIRES_REPLACEMENT');for(const mode of ['ABORT_BEFORE_PROJECT_PUT','ABORT_AFTER_PROJECT_PUT']){assert.equal(by[mode].error.code,'INJECTED_STORAGE_FAILURE');assert.equal(by[mode].actualNativeAbortCount,1);}assert.equal(by.NATIVE_TRANSACTION_EXPIRED.expiredNativeRequestError.name,'TransactionInactiveError');assert.equal(by.NATIVE_TRANSACTION_EXPIRED.error.name,'InvalidStateError');assert.equal(by.LOST_COMPLETION_TIMEOUT_READBACK.error.code,'STORAGE_TRANSACTION_TIMEOUT');assert.equal(by.LOST_COMPLETION_TIMEOUT_READBACK.error.existingProjectsUnchanged,false);assert.equal(by.LOST_COMPLETION_TIMEOUT_READBACK.alreadyCommittedCompletePair,true);assert.equal(report.nativeIndexedDB,true);assert.equal(report.wholeClausePASS,false);return report;
}
// Lossless small extension of retained-root-native's existing-server/target architecture.
// Caller supplies one already-running Chromium process; this module never launches one.
export async function verifyHumanCombinedNative({createTarget,sourceDirectory=new URL('.',import.meta.url),reportPath=null}={}){
 assert.equal(typeof createTarget,'function','NATIVE_HUMAN_EXISTING_BROWSER_REQUIRED');
 const start=performance.now(),directory=new URL(sourceDirectory),originals=new Map([...runtimeFiles,'app-core.js'].map(name=>[name,fs.readFileSync(new URL(name,directory))]));
 const served=new Map(originals),observed=instrumentNativeHumanCombinedSource(originals.get('project-store.js').toString());served.set('project-store.js',Buffer.from(observed.source));const fixtures=new Map(fixtureFiles.map(name=>[name,fs.readFileSync(new URL(name,import.meta.url))]));
 const server=http.createServer((req,res)=>{const name=(req.url||'/').split('?')[0].slice(1),body=name==='original/project-store.js'?originals.get('project-store.js'):fixtures.get(name)||(runtimeFiles.includes(name)?served.get(name):null);if(!body){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(body);});
 let target;
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});target=await createTarget();await target.navigate('http://127.0.0.1:'+server.address().port+'/test-human-combined-native.html');
 const result=await target.evaluate(`new Promise((resolve,reject)=>{let interval,deadline;const check=()=>{const node=document.querySelector('#result');if(!node||node.textContent==='PENDING')return;clearInterval(interval);clearTimeout(deadline);try{resolve(JSON.parse(node.textContent));}catch(error){reject(error);}};interval=setInterval(check,25);deadline=setTimeout(()=>{clearInterval(interval);reject(Error('NATIVE_HUMAN_FIXTURE_DEADLINE_20000MS'));},20000);check();})`);
 const report={...result,launcherElapsedMs:performance.now()-start,originalVsServedSources:Object.fromEntries([...originals].map(([name,body])=>[name,{bytes:body.length,originalSha256:digest(body),servedSha256:digest(served.get(name)),executed:runtimeFiles.includes(name),coldUsesUninstrumented:name==='project-store.js'}])),owningTestSources:Object.fromEntries(HUMAN_COMBINED_TEST_SOURCES.map(name=>{const body=fs.readFileSync(new URL(name,import.meta.url));return [name,{bytes:body.length,sha256:digest(body)}];})),fixtures:Object.fromEntries([...fixtures].map(([name,body])=>[name,{bytes:body.length,sha256:digest(body)}])),observerAnchors:observed.anchors,requiredObserverAnchorsAllMatchedOnce:true,existingBrowserReused:true,isolatedTargetAndOrigin:true,workerDisabled:true};
 if(reportPath)fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');assertHumanCombinedNativeReport(report);return report;
 }finally{try{await target?.close();}finally{server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));}}
}

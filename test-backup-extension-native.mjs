import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'];
const requiredCases=['before-import-commit-rollback-retains-staging','fresh-document-stage-resume-commits-exact-extension-sources','second-fresh-document-cold-read-and-recovery-export'];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

export function assertBackupExtensionNativeReport(report){
 assert.equal(report?.status,'PASS','BACKUP_EXTENSION_NATIVE_STATUS_ORACLE');
 assert.equal(report.actualBrowser,true,'BACKUP_EXTENSION_NATIVE_BROWSER_ORACLE');
 assert.equal(report.nativeIndexedDB,true,'BACKUP_EXTENSION_NATIVE_IDB_ORACLE');
 assert.equal(report.workerDisabled,true,'BACKUP_EXTENSION_NATIVE_PAGE_OWNER_ORACLE');
 assert.equal(report.synthetic,true);assert.equal(report.wholeClausePASS,false);
 assert.equal(report.storeReadyEveryDocument,true,'BACKUP_EXTENSION_NATIVE_READY_ORACLE');
 assert.equal(report.coldReloadCount,2,'BACKUP_EXTENSION_NATIVE_COLD_COUNT_ORACLE');
 assert.deepEqual(report.checks?.map(row=>row.caseId).sort(),[...requiredCases].sort(),'BACKUP_EXTENSION_NATIVE_CASE_POPULATION_ORACLE');
 for(const row of report.checks)assert.equal(row.passed,true,'BACKUP_EXTENSION_NATIVE_CASE_RESULT_ORACLE '+row.caseId);
 const rollback=report.checks.find(row=>row.caseId===requiredCases[0]);
 assert.equal(rollback.error?.code,'INJECTED_STORAGE_FAILURE');assert.equal(rollback.error.existingProjectsUnchanged,true);assert.equal(rollback.exactPhysicalStatePreserved,true);assert.equal(rollback.pendingExactBytesPreserved,true);
 for(const id of requiredCases.slice(1)){const row=report.checks.find(item=>item.caseId===id);assert.equal(row.rootExact,true);assert.equal(row.manifestExactNested,true);assert.equal(row.memberExactNested,true);assert.equal(row.nonOperationalIsolation,true);}
 const cold=report.checks.find(row=>row.caseId===requiredCases[2]);assert.equal(cold.recoveryExportContainsExactFragments,true);assert.equal(cold.pendingConsumed,true);
 return report;
}

// Uses the caller's already-running Chromium process. Three documents share one
// isolated ephemeral origin and its native IndexedDB; no full application is loaded.
export async function verifyBackupExtensionNative({createTarget,sourceDirectory=new URL('.',import.meta.url),reportPath=null}={}){
 assert.equal(typeof createTarget,'function','BACKUP_EXTENSION_NATIVE_EXISTING_BROWSER_REQUIRED');
 const started=performance.now(),sourceRoot=sourceDirectory instanceof URL?sourceDirectory:pathToFileURL(path.resolve(String(sourceDirectory))+path.sep),sources=new Map(runtimeFiles.map(name=>[name,fs.readFileSync(new URL(name,sourceRoot))]));
 const fixture=fs.readFileSync(new URL('test-backup-extension-native.html',import.meta.url)),served=[];let phase='STAGE_AND_ABORT',target;
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),name=url.pathname.slice(1),body=name==='test-backup-extension-native.html'?fixture:sources.get(name);if(!body){res.writeHead(404);res.end();return;}if(sources.has(name))served.push({phase,name,sha256:digest(body)});res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(body);});
 const read=async(origin,requestedPhase)=>{
  phase=requestedPhase;const url=origin+'/test-backup-extension-native.html?phase='+encodeURIComponent(requestedPhase);await target.navigate(url);
  const result=await target.evaluate(`new Promise((resolve,reject)=>{let interval,deadline;const check=()=>{const node=document.querySelector('#result'),text=node?.textContent;if(location.href!==${JSON.stringify(url)}||!text||text==='PENDING')return;clearInterval(interval);clearTimeout(deadline);try{resolve(JSON.parse(text));}catch(error){reject(error);}};interval=setInterval(check,25);deadline=setTimeout(()=>{clearInterval(interval);reject(Error('BACKUP_EXTENSION_NATIVE_PHASE_DEADLINE:'+${JSON.stringify(requestedPhase)}));},15000);check();})`);
  assert.notEqual(result?.status,'FAIL','BACKUP_EXTENSION_NATIVE_PHASE_FAILURE '+requestedPhase+' '+JSON.stringify(result));return result;
 };
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});target=await createTarget();const origin='http://127.0.0.1:'+server.address().port;
  const staged=await read(origin,'STAGE_AND_ABORT');assert.equal(staged.status,'NEEDS_RESUME_RELOAD','BACKUP_EXTENSION_NATIVE_STAGE_STATUS_ORACLE');
  const resumed=await read(origin,'RESUME');assert.equal(resumed.status,'NEEDS_COLD_RELOAD','BACKUP_EXTENSION_NATIVE_RESUME_STATUS_ORACLE');
  const cold=await read(origin,'COLD');assertBackupExtensionNativeReport(cold);
  for(const expectedPhase of ['STAGE_AND_ABORT','RESUME','COLD'])for(const name of runtimeFiles){const matches=served.filter(row=>row.phase===expectedPhase&&row.name===name);assert.equal(matches.length,1,'BACKUP_EXTENSION_NATIVE_SERVED_SOURCE_ORACLE '+expectedPhase+':'+name);assert.equal(matches[0].sha256,digest(sources.get(name)));}
  const report={...cold,elapsedMs:performance.now()-started,sourceFiles:Object.fromEntries([...sources].map(([name,body])=>[name,{bytes:body.length,sha256:digest(body)}])),testSources:Object.fromEntries(['test-backup-extension-native.html','test-backup-extension-native.mjs'].map(name=>{const body=fs.readFileSync(new URL(name,import.meta.url));return [name,{bytes:body.length,sha256:digest(body)}];})),served,existingBrowserReused:true,isolatedTargetAndOrigin:true,boundary:'Actual Chromium native IndexedDB through unmodified production stageBackupImport/importPackage/History/export owners; exact selected gzip and retained UTF-8 fragments across two fresh documents, injected final-transaction abort and recovery export. Synthetic package/project; no operator UI, physical device, protected export, other extension surfaces or whole Section 35.10 claim.'};
  if(reportPath)fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');return assertBackupExtensionNativeReport(report);
 }finally{try{await target?.close();}finally{server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));}}
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'playwright-core';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const source=process.env.RETENTION_PROJECT,root=process.cwd();
assert(source,'Run verify-full-cycle.mjs with FULL_CYCLE_SNAPSHOT and pass that exact output as RETENTION_PROJECT.');
// Use native IndexedDB: fake-indexeddb 6.2.5 retains finished transaction rollback
// closures, so its accumulated process heap is not a browser retention measure.
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.BROWSER||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']}),page=await browser.newPage({viewport:{width:393,height:852}});page.on('console',message=>{if(message.text().startsWith('RETENTION '))console.log(message.text().slice(10));});
try{
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>closedLoopAppReady===true);
 const result=await page.evaluate(async({project,files,count})=>{
  const store=closedLoopProjectStore,hash=closedLoopHash,check=(condition,message)=>{if(!condition)throw new Error(message);};await store.ready;let p=project;const jobId=p.job.JOB_ID;
  for(const [id,name,text] of [['ARTIFACT-CANDIDATE','candidate.bin','candidate-bytes'],['ARTIFACT-PRODUCT','product.bin','released-product-bytes']])await store.putArtifact({artifactId:id,jobId,blob:new Blob([text]),filename:name,mediaType:'application/octet-stream'});
  for(const file of files)await store.putArtifact({artifactId:'PROMPT-CONTEXT-'+hash.sha256Value({jobId,sha256:file.sha256}),jobId,blob:new Blob([file.text]),filename:file.filename,mediaType:file.mediaType});
  p=await store.writeProject(p,{createOnly:true});const original=await store.beginRecoverySession(jobId,'retention-session'),first=original.activeId,firstCheckpoint=await store.readCheckpoint(first,jobId),firstDigest=hash.sha256Value(firstCheckpoint),projectBytes=new TextEncoder().encode(JSON.stringify(p)).length;let logicalBytes=0;
  for(let index=0;index<count;index++){p.stages[30].responseDraft='Retention continuation '+index;p=await store.writeProject(p,{expectedProjectRevision:p.revision});logicalBytes+=new TextEncoder().encode(JSON.stringify(p)).length;if(index%10===0)console.log('RETENTION '+JSON.stringify({saved:index+1,storedCheckpointBytes:(await store.readRecoveryHistory(jobId)).checkpointBytes}));}
  let history=await store.readRecoveryHistory(jobId);check(logicalBytes>store.RECOVERY_CONTRACT.maxCheckpointBytes,'The regression must exceed the former full-copy allowance.');check(history.checkpointBytes<store.RECOVERY_CONTRACT.maxCheckpointBytes,'Compact history exceeded its declared limit.');check(hash.sha256Value(await store.readCheckpoint(first,jobId))===firstDigest,'Session-start checkpoint changed.');
  const last=history.activeId,backup=await store.exportPackage(jobId);({project:p}=await store.restoreVersion({jobId,versionId:first,expectedProjectRevision:p.revision}));check(hash.sha256Value(p.stages)===hash.sha256Value(firstCheckpoint.project.stages),'Restored stage state differs from its checkpoint.');({project:p}=await store.restoreVersion({jobId,versionId:last,expectedProjectRevision:p.revision}));check(p.stages[30].responseDraft==='Retention continuation '+(count-1),'Forward restoration lost the retained draft.');p=await store.importPackage(backup,{expectedProjectRevision:p.revision});history=await store.readRecoveryHistory(jobId);check(history.entries.some(entry=>entry.versionId===first)&&history.entries.some(entry=>entry.versionId===last),'Backup restoration lost a retained alternative.');check(hash.sha256Value(await store.readCheckpoint(first,jobId))===firstDigest,'Backup restoration changed the starting checkpoint.');
  return {retention:'PASS',projectBytes,meaningfulChanges:count,retainedCheckpoints:history.entries.length,logicalFullCopyBytes:logicalBytes,actualCheckpointBytes:history.checkpointBytes,backupBytes:backup.size,fullCycleStageCount:30,exactVersionRoundTrip:true,declaredLimits:store.RECOVERY_CONTRACT};
 },{project:JSON.parse(fs.readFileSync(source,'utf8')),files:JSON.parse(fs.readFileSync(source+'.files.json','utf8')),count:Number(process.env.RETENTION_CHECKPOINTS||40)});
 console.log(JSON.stringify({...result,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDigest:createHash('sha256').update(fs.readFileSync('project-store.js')).digest('hex'),environment:{browser:await browser.version(),storage:'Native IndexedDB',fixture:'Synthetic completed 30-stage project',operatorActions:'Adapter workload; not an operator journey',physicalDevice:false}}));
}finally{await browser.close();server.close();}

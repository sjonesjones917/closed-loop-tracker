import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createOperatorBrowser} from './operator-browser-driver.mjs';

const directory=path.resolve('stale-view-browser-evidence');fs.mkdirSync(directory,{recursive:true});
const report={basis:'Controlled concurrent revision using production UI controls, IndexedDB and the storage worker in Chromium',complete:false,cases:[]};
const persist=()=>fs.writeFileSync(path.join(directory,'stale-view.json'),JSON.stringify(report,null,2)+'\n');
for(const [width,height] of [[320,568],[1280,800]]){
 let browser;
 try{
  browser=await createOperatorBrowser({directory:path.join(directory,String(width)),width,height});
  const original=await browser.evaluate(`(async()=>{const p=await closedLoopProjectStore.createProject();const url=new URL(location.href);url.searchParams.delete('version');url.searchParams.set('project',p.job.JOB_ID);url.searchParams.set('view','Project');return {id:p.job.JOB_ID,revision:p.revision,sha256:p.projectSha256,url:url.href};})()`);
  await browser.openUrl(original.url);
  await browser.click('[data-view="Project"]');
  const winner=await browser.evaluate(`(async()=>{const store=closedLoopProjectStore,p=await store.readProject(${JSON.stringify(original.id)});p.newerSavedWork='PRESERVE';const saved=await store.writeProject(p,{expectedProjectRevision:p.revision});return {sha256:saved.projectSha256,revision:saved.revision,activeId:(await store.historyList(p.job.JOB_ID)).activeId};})()`);
  const draft='Unsaved draft retained from the older tab';
  await browser.fill('#job-EXACT_USER_OBJECTIVE_VERBATIM',draft);
  await browser.click('#new-project');
  const observed=await browser.evaluate(`(async()=>{
   const store=closedLoopProjectStore,id=${JSON.stringify(original.id)},p=await store.readProject(id),history=await store.historyList(id),drafts=[];
   for(const entry of history.entries){const view=await store.readHistoryView(id,entry.id);if(view?.drafts?.['#job-EXACT_USER_OBJECTIVE_VERBATIM']?.value===${JSON.stringify(draft)})drafts.push({projectSha256:entry.projectSha256,checkpointId:entry.id});}
   const selected=document.querySelector('#current-project-summary')?.dataset?.projectId;
   return {selected,selectedStored:Boolean(await store.readProject(selected)),newerSavedWork:p.newerSavedWork,sha256:p.projectSha256,revision:p.revision,activeId:history.activeId,drafts,error:document.querySelector('#operation-error')?.hidden===false?document.querySelector('#operation-error').textContent:null};
  })()`);
  assert.notEqual(observed.selected,original.id,'New project must complete after another writer advances the source.');assert.equal(observed.selectedStored,true);
  assert.equal(observed.newerSavedWork,'PRESERVE');assert.equal(observed.sha256,winner.sha256);assert.equal(observed.revision,winner.revision);assert.equal(observed.activeId,winner.activeId);
  assert.ok(observed.drafts.length>0,'The unsaved draft must remain in History.');assert.ok(observed.drafts.every(row=>row.projectSha256===original.sha256),'The draft must remain bound to its original project bytes.');assert.equal(observed.error,null);
  await browser.reload();assert.equal(await browser.evaluate(`document.querySelector('#current-project-summary')?.dataset?.projectId`),observed.selected);
  const layout=await browser.inspect(1);assert.equal(browser.exceptions().length,0);
  report.cases.push({width,height,result:'PASS',observed,layout,events:browser.events});persist();
 }catch(error){report.cases.push({width,height,result:'FAIL',error:String(error.stack||error)});persist();throw error;}
 finally{await browser?.close();}
}
report.complete=true;persist();console.log(JSON.stringify({staleViewBrowser:'PASS',cases:report.cases.length,basis:report.basis}));

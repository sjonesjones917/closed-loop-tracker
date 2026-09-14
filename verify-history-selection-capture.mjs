import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const {store,copy,runtime}=projectStoreRuntime();
let p=await store.createProject({commandId:'HISTORY-SELECTION-REPRODUCTION'});
const targets=[];
for(const title of ['Initial work','Accepted continuation','Retained alternative']){const next=copy(p);next.job.JOB_TITLE=title;p=await store.writeProject(next,{expectedProjectRevision:p.revision});targets.push({title,id:(await store.historyList(p.job.JOB_ID)).activeId});}
const nodes=new Map(),button=()=>({disabled:false,textContent:'Restore',isConnected:true}),host={insertAdjacentHTML(){},set innerHTML(value){nodes.set('#history-version',{value:runtime.historyState.activeId});for(const id of ['#history-restore','#history-undo','#history-redo','#history-session-start'])nodes.set(id,button());}};
nodes.set('#project-history',host);
Object.assign(runtime,{current:p,projectStore:store,historyState:await store.historyList(p.job.JOB_ID),historyBrowseState:null,recoveryProjects:[],quarantinedProjects:[],operatorActionInFlight:null,restoringHistory:false,actionFocusTarget:null,$:selector=>nodes.get(selector),esc:String,document:{querySelectorAll:()=>[]},paintOperatorAction:()=>{},announce:()=>{},requestAnimationFrame:fn=>fn(),history:{state:{closedLoopHistory:1}},failures:[],reportActionFailure:error=>runtime.failures.push(error),captureCurrentView:async()=>{await store.saveCheckpoint(runtime.current.job.JOB_ID,{expectedProjectRevision:runtime.current.revision,view:copy({activeStage:runtime.current.activeStage,activeView:'Workflow'}),label:'Leaving view'});runtime.historyState=await store.historyList(runtime.current.job.JOB_ID);runtime.paintHistory();},restoreHistoryVersion:async(id,options)=>{const result=await store.restoreCheckpoint(options.jobId||runtime.current.job.JOB_ID,id,{expectedProjectRevision:runtime.current.revision,mode:options.mode||'HISTORY'});runtime.current=result.project;},quarantineMarkup:()=>''});
let source=fs.readFileSync('app-core.js','utf8');
if(process.argv.includes('--fault=late-history-selection'))source=source.replace("bindAction('#history-restore',selection=>restoreHistoryVersion(selection.checkpointId,{jobId:selection.jobId}),'Restoring saved version',{capture:()=>({checkpointId:$('#history-version').value,jobId:targetJobId})});","bindAction('#history-restore',()=>restoreHistoryVersion($('#history-version').value,{jobId:targetJobId}),'Restoring saved version');");
const extract=(start,end)=>{const i=source.indexOf(start),j=source.indexOf(end,i+start.length);assert.ok(i>=0&&j>i);return source.slice(i,j);};
vm.runInContext(extract('function runOperatorAction(','function focusAfterAction(')+extract('function bindAction(','function bindFileAction(')+extract('function paintHistory(','async function captureCurrentView('),runtime);
const cases=[];
for(const target of targets.slice(0,-1).reverse()){
 runtime.historyState=await store.historyList(p.job.JOB_ID);runtime.paintHistory();nodes.get('#history-version').value=target.id;
 await nodes.get('#history-restore').onclick();assert.equal(runtime.failures.length,0,runtime.failures.map(e=>e.stack).join('\n'));
 assert.equal(runtime.current.job.JOB_TITLE,target.title,'HISTORY_SELECTION_ORACLE: saving the departing view must not replace the destination selected by the operator');
 cases.push({name:'Captured selection restores its complete retained project despite intervening History repaint',target:target.title,result:'PASS'});
}
console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Actual History binding and action pipeline with production persistence and transactional test adapter',cases},null,2));

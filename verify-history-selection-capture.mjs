import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const {store,copy,runtime}=projectStoreRuntime();
let p=await store.createProject({commandId:'HISTORY-SELECTION-REPRODUCTION'});
const targets=[];
for(const title of ['Initial work','Accepted continuation','Retained alternative']){const next=copy(p);next.job.JOB_TITLE=title;p=await store.writeProject(next,{expectedProjectRevision:p.revision});targets.push({title,id:(await store.historyList(p.job.JOB_ID)).activeId});}
// This adapter models replacement of actual History markup and native details
// open state. Assertions below use displayed summaries, rather than source text.
let disclosures=[];
function readDisclosures(markup){
 const result=[],stack=[];
 for(const token of String(markup).matchAll(/<\/details>|<details\b([^>]*)>|<summary>([^<]*)<\/summary>/g)){
  if(token[0]==='</details>'){stack.pop();continue;}
  if(token[1]!==undefined){
   const dataset=Object.fromEntries([...token[1].matchAll(/data-([a-z-]+)="([^"]*)"/g)].map(([,key,value])=>[key.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase()),value]));
   const node={dataset,open:/\bopen(?:\s|$)/.test(token[1]),summary:'',parent:stack.at(-1)||null};result.push(node);stack.push(node);
  }else if(stack.length)stack.at(-1).summary=token[2];
 }
 return result;
}
const nodes=new Map(),button=()=>({disabled:false,textContent:'Restore',isConnected:true}),host={
 insertAdjacentHTML(_position,markup){disclosures.unshift(...readDisclosures(markup));},
 set innerHTML(value){
  disclosures=readDisclosures(value);
  const selected=String(value).match(/<option value="([^"]+)" selected>/)?.[1];nodes.set('#history-version',{value:selected||runtime.historyState.activeId});
  for(const id of ['#history-restore','#history-undo','#history-redo','#history-session-start'])nodes.set(id,button());
 }
};
const historyDocument={querySelectorAll(selector){
 if(selector==='#project-history details[data-recovery-disclosure][open]')return disclosures.filter(node=>node.dataset.recoveryDisclosure&&node.open);
 if(selector==='#project-history details[data-recovery-disclosure]')return disclosures.filter(node=>node.dataset.recoveryDisclosure);
 return [];
}};
nodes.set('#project-history',host);
Object.assign(runtime,{current:p,projectStore:store,historyState:await store.historyList(p.job.JOB_ID),historyBrowseState:null,historyDestination:null,recoveryProjects:[],quarantinedProjects:[],operatorActionInFlight:null,historyRestoreController:null,restoringHistory:false,actionControls:new Map(),actionFocusTarget:null,$:selector=>nodes.get(selector),esc:String,document:historyDocument,paintOperatorAction:()=>{},announce:()=>{},requestAnimationFrame:fn=>fn(),history:{state:{closedLoopHistory:1}},failures:[],reportActionFailure:error=>runtime.failures.push(error),captureCurrentView:async()=>{await store.saveCheckpoint(runtime.current.job.JOB_ID,{expectedProjectRevision:runtime.current.revision,view:copy({activeStage:runtime.current.activeStage,activeView:'Workflow'}),label:'Leaving view'});runtime.historyState=await store.historyList(runtime.current.job.JOB_ID);runtime.paintHistory();if(runtime.resetDestinationDuringAction)nodes.get('#history-version').value=runtime.historyState.activeId;},restoreHistoryVersion:async(id,options)=>{const result=await store.restoreCheckpoint(options.jobId||runtime.current.job.JOB_ID,id,{expectedProjectRevision:runtime.current.revision,mode:options.mode||'HISTORY'});runtime.current=result.project;}});
let source=fs.readFileSync('app-core.js','utf8');
if(process.argv.includes('--fault=late-history-selection'))source=source.replace("bindAction('#history-restore',selection=>restoreHistoryVersion(selection.checkpointId,{jobId:selection.jobId}),'Restoring saved version',{capture:()=>({checkpointId:$('#history-version').value,jobId:targetJobId})});","bindAction('#history-restore',()=>restoreHistoryVersion($('#history-version').value,{jobId:targetJobId}),'Restoring saved version');");
if(process.argv.includes('--fault=reset-selected-destination'))source=source.replace('historyDestination?.jobId===targetJobId','false');
if(process.argv.includes('--fault=close-recovery-disclosures')){
 const before='node.open=openRecoveryDisclosures.has(node.dataset.recoveryDisclosure);';
 assert.equal(source.split(before).length-1,1,'The controlled disclosure-close fault must target exactly one restoration boundary');
 source=source.replace(before,'node.open=false;');
}
const extract=(start,end)=>{const i=source.indexOf(start),j=source.indexOf(end,i+start.length);assert.ok(i>=0&&j>i);return source.slice(i,j);};
vm.runInContext(extract('const OPERATION_LOADING_THRESHOLD_MS=','let core,schema,engine,')+extract('function setControlDisabled(','function paintOperatorAction(')+extract('function runOperatorAction(','function focusAfterAction(')+extract('function bindAction(','function bindFileAction(')+extract('function quarantineMarkup(','async function exportQuarantineEvidence(')+extract('function paintHistory(','async function captureCurrentView('),runtime);
const cases=[];
for(const target of targets.slice(0,-1).reverse()){
 runtime.historyState=await store.historyList(p.job.JOB_ID);runtime.paintHistory();nodes.get('#history-version').value=target.id;
 nodes.get('#history-version').onchange?.();
 // A scroll or a completed view save can repaint History between selection and activation.
 await runtime.captureCurrentView();
 assert.equal(nodes.get('#history-version').value,target.id,'HISTORY_DESTINATION_RETENTION_ORACLE: an independent History repaint must preserve the operator-selected destination');
 runtime.resetDestinationDuringAction=true;await nodes.get('#history-restore').onclick();runtime.resetDestinationDuringAction=false;assert.equal(runtime.failures.length,0,runtime.failures.map(e=>e.stack).join('\n'));
 assert.equal(runtime.current.job.JOB_TITLE,target.title,'HISTORY_SELECTION_ORACLE: saving the departing view must not replace the destination selected by the operator');
 cases.push({name:'Selected History destination survives independent repaint, then its activation captures the exact intended version',target:target.title,result:'PASS'});
}
// A view-save repaint must preserve recovery controls the operator is using.
// A closed or removed copy must not acquire another copy's opened controls.
runtime.quarantinedProjects=[
 {key:'RECOVERY-COPY-A',jobId:p.job.JOB_ID,title:'Damaged current project',completeSnapshot:true,reason:'Recorded integrity mismatch'},
 {key:'RECOVERY-COPY-B',jobId:p.job.JOB_ID,title:'Other damaged copy',completeSnapshot:true,reason:'Another recorded integrity mismatch'}
];
const disclosure=(summary,parent=null)=>disclosures.find(node=>node.summary===summary&&node.parent===parent);
const assertRecoveryOpen=(summary,expected,parent=null)=>{
 const node=disclosure(summary,parent);assert.ok(node,'HISTORY_RECOVERY_DISCLOSURE_ORACLE: recovery disclosure must remain available: '+summary);
 assert.equal(node.open,expected,'HISTORY_RECOVERY_DISCLOSURE_ORACLE: History refresh must preserve the operator-selected open state: '+summary);return node;
};
runtime.paintHistory();
let activeRecovery=assertRecoveryOpen('Damaged current project',false);activeRecovery.open=true;
for(const summary of ['Integrity details','Remove damaged copy'])disclosure(summary,activeRecovery).open=true;
await runtime.captureCurrentView();
activeRecovery=assertRecoveryOpen('Damaged current project',true);
for(const summary of ['Integrity details','Remove damaged copy'])assertRecoveryOpen(summary,true,activeRecovery);
assertRecoveryOpen('Other damaged copy',false);
runtime.quarantinedProjects.reverse();runtime.paintHistory();
activeRecovery=assertRecoveryOpen('Damaged current project',true);
for(const summary of ['Integrity details','Remove damaged copy'])assertRecoveryOpen(summary,true,activeRecovery);
assertRecoveryOpen('Other damaged copy',false);
runtime.quarantinedProjects=runtime.quarantinedProjects.filter(entry=>entry.key!=='RECOVERY-COPY-A');runtime.paintHistory();
assert.equal(disclosure('Damaged current project'),undefined,'HISTORY_RECOVERY_DISCLOSURE_ORACLE: removed recovery evidence must disappear');
assertRecoveryOpen('Other damaged copy',false);
runtime.quarantinedProjects.push({key:'RECOVERY-COPY-C',jobId:p.job.JOB_ID,title:'Damaged current project',completeSnapshot:true,reason:'A distinct damaged copy'});runtime.paintHistory();
activeRecovery=assertRecoveryOpen('Damaged current project',false);
for(const summary of ['Integrity details','Remove damaged copy'])assertRecoveryOpen(summary,false,activeRecovery);
cases.push({name:'Opened recovery controls survive view-save repaint and reordering; closed, removed, and replacement copies retain their own state',result:'PASS'});
console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Actual History binding and action pipeline with production persistence and transactional test adapter',cases},null,2));

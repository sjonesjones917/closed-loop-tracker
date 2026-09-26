import fs from 'node:fs';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';

const {runtime,store,copy}=projectStoreRuntime(),schema=runtime.closedLoopWorkflowSchema;
const project=await store.createProject({commandId:'FILE-SELECTION-DRAFT-RETENTION'});
let source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');
if(process.argv.includes('--fault=drop-selection-drafts'))source=source.replace('render();applySavedView(view,{position:false});focusAfterAction', 'render();focusAfterAction');
const extract=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return source.slice(a,b);};
let nodes;
const resetNodes=()=>{nodes=new Map([
 ['#correction-reason',{id:'correction-reason',type:'textarea',value:''}],
 ['#operator-label',{id:'operator-label',type:'text',value:''}],
 ['#draft-check',{id:'draft-check',type:'checkbox',value:'yes',checked:false}],
 ['#draft-multiple',{id:'draft-multiple',type:'select-multiple',multiple:true,options:[{value:'a',selected:false},{value:'b',selected:false}],get selectedOptions(){return this.options.filter(x=>x.selected);}}],
 ['#response-file-status',{textContent:''}],['#process-response-file',{}]
 ]);};
resetNodes();
Object.assign(runtime,{current:project,projectStore:store,clone:copy,history:{state:{entryId:'draft-entry'}},restoringHistory:false,fileSelectionDrafts:{},operationSelection:{},runSelection:{},replacementReview:null,APPLICATION_SESSION_ID:'FILE-SELECTION-DRAFT-SESSION',CSS:{escape:String},window:{scrollX:0,scrollY:0,scrollTo(){throw new Error('File selection must not restore an old scroll position.');}},document:{querySelectorAll:()=>[...nodes.values()].filter(n=>n.id),querySelector:s=>nodes.get(s)},$:s=>nodes.get(s),captureCurrentView:async()=>{},responseAttemptPrompt:()=>null,selectedOperation:()=> 'COMPLETE',artifactIdFor:jobId=>jobId+'-FILE-'+runtime.crypto.randomUUID(),logicalFilePath:file=>file.name,writeBrowserEntry(){},refreshHistory:async()=>{},announce(){},focusAfterAction(){},render:resetNodes});
createVerifierRuntime.loadScript(runtime,extract('const VIEW_NAVIGATION_CONTROL_IDS=','function selectSavedView(').replace(/function replacementReviewFromSavedView\([\s\S]*$/,'' )+extract('function applySavedView(','function entryUrl(')+extract('function fileSelectionKey(','async function readFileSelection('));
const cases=[];
for(let stage=1;stage<=schema.STAGE_COUNT;stage++)for(const kind of ['response','audited','delivery']){
 runtime.current.activeStage=stage;
 for(const attempt of ['initial','replacement']){
  const text=`Unsaved correction at stage ${stage}, ${kind}, ${attempt}.`;
  nodes.get('#correction-reason').value=text;nodes.get('#operator-label').value='Synthetic operator';nodes.get('#draft-check').checked=true;nodes.get('#draft-multiple').options[1].selected=true;
  const expected=copy(runtime.captureView().drafts),file=new runtime.File([text],'response.json',{type:'application/json'});
  await runtime.saveFileSelection(kind,[file],stage);
  assert.deepEqual(copy(runtime.captureView().drafts),expected,'FILE_SELECTION_DRAFT_RETENTION_ORACLE: selecting files must preserve every current operator draft after rendering');
  const saved=await store.readHistoryView(project.job.JOB_ID);
  assert.deepEqual(saved.drafts,expected,'FILE_SELECTION_DURABLE_DRAFT_ORACLE');
  const selection=runtime.currentFileSelection(kind,stage),retained=await store.getArtifact(selection.files[0].artifactId);
  assert.equal(await retained.blob.text(),text,'FILE_SELECTION_BYTE_RETENTION_ORACLE');
  assert.equal((await store.readProject(project.job.JOB_ID)).revision,project.revision,'File selection must not accept or revise canonical work.');
  cases.push({stage,kind,attempt,name:'File selection preserves current and durable operator drafts and exact selected bytes without accepting work',result:'PASS'});
 }
}
console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Actual file-selection, draft-capture and draft-application functions; production persistence with transactional adapter; DOM controls recreated on render',cases},null,2));

import fs from 'node:fs';
import vm from 'node:vm';
import {createVerifierRuntime} from './verifier-runtime.mjs';

// The existing lifecycle suite's transaction adapter, extracted for recovery
// regressions. This is explicitly not a browser or an IndexedDB implementation.
export function projectStoreRuntime({fault=null,sourceOverrides={}}={}){
 const rows=new Map();
 const runtime=createVerifierRuntime({Blob,Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,ReadableStream,CompressionStream,DecompressionStream,Response,crypto:globalThis.crypto,btoa,atob,setTimeout,clearTimeout,queueMicrotask,console,Event:class Event{},dispatchEvent(){}});
 const parse=vm.runInContext('(text)=>JSON.parse(text)',runtime);
 // Preserve undefined properties and shared references just as structured clone
 // does. JSON cloning would hide invalid durable-view fields in these tests.
 const copy=value=>{const seen=new Map();const visit=item=>{if(item===null||typeof item!=='object'||item instanceof Blob)return item;if(seen.has(item))return seen.get(item);const result=parse(Array.isArray(item)?'[]':'{}');seen.set(item,result);for(const key of Object.keys(item))result[key]=visit(item[key]);return result;};return visit(value);};
 runtime.structuredClone=copy;
 runtime.openStorageTransaction=async(names,mode)=>{
  const selected=Array.isArray(names)?names:[names],pending=new Map(selected.map(name=>[name,new Map([...(rows.get(name)||[])].map(([key,value])=>[key,copy(value)]))]));let aborted=false;
  return {objectStore:name=>({get:key=>({result:copy(pending.get(name).get(key))}),getAll:()=>({result:[...pending.get(name).values()].map(copy)}),index:index=>({getAll:key=>({result:[...pending.get(name).values()].filter(row=>String(row[index])===String(key)).map(copy)}),openKeyCursor:()=>{const keys=[...pending.get(name).values()].map(row=>row[index]).filter(Boolean),request={};let i=0;const advance=()=>{request.result=i<keys.length?{key:keys[i++],continue:()=>queueMicrotask(advance)}:null;request.onsuccess?.();};queueMicrotask(advance);return request;}}),count:()=>({result:pending.get(name).size}),put:row=>pending.get(name).set(name==='projects'?row.jobId:name==='artifacts'?row.artifactId:row.key,copy(row)),delete:key=>pending.get(name).delete(key)}),commit(){if(aborted)throw new Error('Transaction aborted.');if(mode==='readwrite')for(const [name,data] of pending)rows.set(name,data);},abort(){aborted=true;}};
 };
 for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js']){
  let source=sourceOverrides[file]??fs.readFileSync(file,'utf8');
  if(typeof source!=='string')throw new TypeError('A runtime source override must contain exact source text: '+file);
  if(file==='project-store.js')source=source.replace(/const request=req=>[^\n]+/,'const request=req=>Promise.resolve(req.result);').replace(/const complete=tx=>[^\n]+/,'const complete=async tx=>tx.commit();').replace(/async function openTransaction\([\s\S]*?\n}\n/,'async function openTransaction(stores,mode="readonly"){return openStorageTransaction(stores,mode);}\n');
  if(fault?.file===file){if(!source.includes(fault.before))throw new Error('Fault anchor missing: '+fault.id);source=source.replace(fault.before,fault.after);}
  vm.runInContext(source,runtime,{filename:file});
 }
 // The persistence UI's continuation dependencies belong to this shared
 // runtime. Extract the actual owners together so every acceptance, correction
 // and retry verifier sees the same complete dependency set.
 const uiSource=sourceOverrides['app-core.js']??fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');
 const continuationStart=uiSource.indexOf('function acceptedContinuation('),continuationEnd=uiSource.indexOf('const stageContinuationErrors=',continuationStart);
 if(continuationStart<0||continuationEnd<continuationStart)throw new Error('The actual persistence UI continuation owners are unavailable.');
 Object.assign(runtime,{safe:runtime.closedLoopWorkflowEngine.safe,operationSelection:{},runSelection:{}});
 vm.runInContext(uiSource.slice(continuationStart,continuationEnd),runtime,{filename:'app-core.js:continuation-owners'});
 return {runtime,rows,copy,store:runtime.closedLoopProjectStore,engine:runtime.closedLoopWorkflowEngine,core:runtime.closedLoopCore,ingestion:runtime.closedLoopResponseIngestion,prompts:runtime.closedLoopPromptEngine};
}

// Actual acceptance/confirmation owners under the shared lifecycle adapter.
export function bindAcceptanceUi(r,p,proposalId,{skipConfirmation=false}={}){
 const {runtime,core,engine,ingestion,store,copy}=r,failures=[],assert=(ok,message)=>{if(!ok)throw new Error(message||'UI fixture source anchor is missing');};
Object.assign(runtime,{current:p,projects:copy([p]),replacementReview:null,responseActionFailure:null,projectStore:store,core,engine,ingestion,clone:copy,safe:engine.safe,withStorageActivity:async(_label,fn)=>fn(),unloadInactiveProjects:()=>{},mobileSessionCurrent:()=>false,recordMobileOperation:async()=>{},recordCommittedBoundary:async()=>{},render:()=>{},announce:()=>{},reportActionFailure:error=>failures.push(error),reportResponseFailure:(_message,error)=>failures.push(error),focusAfterAction:()=>{},reverifyReturnedFiles:async()=>{},TAB_INSTANCE_ID:'SYNTHETIC-UI',canonicalCurrentStage:()=>Number(runtime.current.job.CURRENT_STAGE.replace(/[^0-9]/g,'')),selectStageContinuation:()=>{},$ :()=>({value:'SYNTHETIC',scrollIntoView(){},focus(){}}),document:{querySelectorAll:()=>[]}});
runtime.pendingProposal=()=>{const proposal=ingestion.findProposal(runtime.current,proposalId);return proposal?.status==='PENDING_OPERATOR_REVIEW'?proposal:null;};
runtime.captureView=()=>copy({activeStage:runtime.current.activeStage,activeView:runtime.current.activeView,pendingMutation:runtime.replacementReview?.next?{baseProjectSha256:runtime.current.projectSha256,next:runtime.replacementReview.next,impact:runtime.replacementReview.impact,expectedProjectRevision:runtime.replacementReview.expectedProjectRevision,acceptance:runtime.replacementReview.acceptance}:null});
runtime.captureCurrentView=async()=>store.saveCheckpoint(runtime.current.job.JOB_ID,{expectedProjectRevision:runtime.current.revision,view:runtime.captureView()});
let source=fs.readFileSync('app-core.js','utf8');if(skipConfirmation){for(const before of ['if(impact?.requiresConfirmation&&mutationConfirmation?.confirmationKey!==impact.confirmationKey)','if(semanticImpact?.requiresConfirmation){']){assert(source.includes(before));source=source.replace(before,before.endsWith('{')?'if(false){':'if(false)');}}const extract=(start,end)=>{const a=source.indexOf(start);assert(a>=0);return source.slice(a,source.indexOf(end,a+start.length));};
vm.runInContext(extract('async function persistReplacement(','async function save(')+extract('function humanAuthorityConfirmationValues(','async function rejectPendingProposal(')+'\nglobalThis.accept=acceptPendingProposal;globalThis.confirm=confirmReplacement;',runtime);
 return failures;
}

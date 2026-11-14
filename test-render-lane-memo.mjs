// One synchronous screen build reads one operator lane per stage. The lane
// predicates (latestResponseAttempt, acceptedLaneChanges, pendingProposal)
// share the selected operation, the selected scope and their own results
// through the presentation scope; outside a scope every call evaluates afresh.
// This suite pins that the rendered workflow markup is byte-identical to the
// former per-item evaluation, and that one render reads selectedOperation and
// promptOptions for the lane at most once per stage. The display premise is
// unchanged: current and the selections do not change within one build.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime,restoreArtifactFixture,hydrateRetainedPromptContexts} from './test-project-store-runtime.mjs';
import {accumulatedStage04Fixture,stage04AcceptanceEnvelope} from './test-fixtures.mjs';

// The former definitions: every item re-read selectedOperation(n) and
// promptOptions(n), and every call re-ran its whole filter.
export const PER_ITEM_LANE_PREDICATES=Object.freeze({
 operatorLaneMatches:"function operatorLaneMatches(item,n,{accepted=false}={}){\n  if(Number(item?.stage)!==Number(n)||item?.invalidatedBy)return false;\n  const operation=String(item?.envelope?.operation||item?.operation||'COMPLETE');if(operation!==selectedOperation(n))return false;\n  const actual=item?.envelope?.scope||item?.scope||{},selected=promptOptions(n).scope||{};\n  if(selected.runId&&String(actual.runId||'')!==String(selected.runId))return false;\n  try{engine.assertOperationScope(current,n,operation,actual,{requireReserved:!accepted});return true;}catch{return false;}\n}",
 acceptedLaneChanges:"function acceptedLaneChanges(n){return engine.acceptedChanges(current,n).filter(x=>operatorLaneMatches(x,n,{accepted:true}));}",
 latestResponseAttempt:"function latestResponseAttempt(stage=current.activeStage){const prompts=new Map(safe(current.projectData.generatedPrompts).map(p=>[p.instructionId||p.promptId,p]));return safe(current.projectData.rawResponses).filter(raw=>{if(Number(raw.stage)!==Number(stage))return false;const prompt=prompts.get(raw.promptInstructionId);return prompt&&operatorLaneMatches({stage:raw.stage,operation:prompt.operation,scope:prompt.scope},stage);}).at(-1)||null;}",
 pendingProposal:"function pendingProposal(){return safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,current.activeStage)).at(-1);}"
});
const SCOPE_GUARD="typeof presentationActions!=='undefined'&&presentationActions";
const definitionSpan=(source,name)=>{
 const start=source.indexOf('function '+name+'(');assert.ok(start>=0,'RENDER_LANE_MEMO_ANCHOR_ORACLE: '+name);
 assert.equal(source.indexOf('function '+name+'(',start+1),-1,'RENDER_LANE_MEMO_ANCHOR_ORACLE: duplicate '+name);
 const end=name==='operatorLaneMatches'?source.indexOf('\n}\n',start)+2:source.indexOf('\n',start);assert.ok(end>start,'RENDER_LANE_MEMO_ANCHOR_ORACLE: '+name);
 return [start,end];
};
export function perItemLaneSource(source){
 for(const [name,reference] of Object.entries(PER_ITEM_LANE_PREDICATES)){const [start,end]=definitionSpan(source,name);source=source.slice(0,start)+reference+source.slice(end);}
 return source;
}
// Observe each entry of the lane inputs with its direct caller. Instrumentation
// is identical for both variants and changes no returned value.
function observedSource(source){
 const insert=(text,pattern,name)=>{const match=text.match(pattern);assert.ok(match,'RENDER_LANE_MEMO_OBSERVER_ANCHOR_ORACLE: '+name);return text.replace(pattern,match[0]+`globalThis.__laneObserve?.('${name}',n);`);};
 source=insert(source,/\nfunction promptOptions\(n\)\{/,'promptOptions');
 source=insert(source,/\nfunction selectedOperation\(n\)\{/,'selectedOperation');
 return insert(source,/\nfunction operatorLaneMatches\(item,n,[^)]*\)\{/,'operatorLaneMatches');
}
const callerOf=stack=>(String(stack).split('\n')[3]||'').trim().match(/^at (?:async )?([^\s(]+)/)?.[1]||'';

// Load a fresh instance of the actual application owners and expose only
// what this suite inspects. Each render gets its own copy of the project.
function loadApplication(r,project,source,{operations={}}={}){
 const end=source.indexOf("$('#project-picker').onchange");assert.ok(end>0,'RENDER_LANE_MEMO_BOOTSTRAP_ORACLE');
 const runtime=r.runtime;
 Object.assign(runtime,{__laneProject:project,__laneOperations:operations,document:{currentScript:null,querySelector:()=>null,querySelectorAll:()=>[]},addEventListener:()=>{}});runtime.window=runtime;
 const body=source.slice(0,end)+`core=globalThis.closedLoopCore;schema=globalThis.closedLoopWorkflowSchema;engine=globalThis.closedLoopWorkflowEngine;ingestion=globalThis.closedLoopResponseIngestion;projectStore=globalThis.closedLoopProjectStore;current=__laneProject;projects=[current];Object.assign(operationSelection,__laneOperations);return {workflow,latestResponseAttempt,acceptedLaneChanges,pendingProposal,current:()=>current,scope:()=>presentationActions,openScope:()=>{presentationActions=new Map();},closeScope:()=>{presentationActions=null;}};})();`;
 return createVerifierRuntime.loadScript(runtime,body,{filename:'app-core.js:render-lane-memo'});
}
function renderObserved(r,project,source,operations){
 const calls=[];r.runtime.__laneObserve=(name,n)=>calls.push({name,stage:String(n),caller:callerOf(new Error().stack)});
 try{const app=loadApplication(r,r.copy(project),source,{operations});const html=app.workflow();assert.equal(app.scope(),null,'RENDER_LANE_MEMO_SCOPE_RESTORED_ORACLE');return {html,calls};}
 finally{delete r.runtime.__laneObserve;}
}
const laneReads=(calls,name)=>{const byStage={};for(const row of calls)if(row.name===name&&row.caller==='operatorLaneMatches')byStage[row.stage]=(byStage[row.stage]||0)+1;return byStage;};
const total=values=>Object.values(values).reduce((sum,value)=>sum+value,0);

// Every lane candidate of a stage: raw attempts with an issued prompt,
// accepted changes and pending proposals. With the memo each predicate's
// filter runs once per render, so each candidate is evaluated at most once.
function laneCandidates(engine,project,stage){
 const prompts=new Set(engine.safe(project.projectData.generatedPrompts).map(p=>p.instructionId||p.promptId));
 return engine.safe(project.projectData.rawResponses).filter(raw=>Number(raw.stage)===stage&&prompts.has(raw.promptInstructionId)).length+engine.acceptedChanges(project,stage).length+engine.safe(project.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW').length;
}
function compareRender(r,project,{stage,operation=null,label},{actual,reference}){
 const p=r.copy(project);p.activeStage=stage;p.activeView='Workflow';const operations=operation?{[stage]:operation}:{};
 const memo=renderObserved(r,p,actual,operations),perItem=renderObserved(r,p,reference,operations);
 assert.equal(memo.html,perItem.html,'RENDER_LANE_MEMO_MARKUP_IDENTITY_ORACLE: '+label);
 const memoOptions=laneReads(memo.calls,'promptOptions'),memoOperations=laneReads(memo.calls,'selectedOperation'),perItemOptions=laneReads(perItem.calls,'promptOptions'),perItemOperations=laneReads(perItem.calls,'selectedOperation');
 for(const [name,counts,former] of [['promptOptions',memoOptions,perItemOptions],['selectedOperation',memoOperations,perItemOperations]])for(const n of new Set([...Object.keys(counts),...Object.keys(former)])){
  assert.ok((counts[n]||0)<=1,`RENDER_LANE_MEMO_SINGLE_READ_ORACLE: ${label} read ${name}(${n}) ${counts[n]} times for its lane`);
  // Lazy: the lane reads an input only when some item reached that check.
  assert.equal(counts[n]||0,former[n]?1:0,`RENDER_LANE_MEMO_LAZY_READ_ORACLE: ${label} ${name}(${n})`);
 }
 const memoItems=memo.calls.filter(row=>row.name==='operatorLaneMatches').length,perItemItems=perItem.calls.filter(row=>row.name==='operatorLaneMatches').length,candidates=laneCandidates(r.engine,p,stage);
 assert.ok(memoItems<=candidates,`RENDER_LANE_MEMO_SINGLE_EVALUATION_ORACLE: ${label} evaluated ${memoItems} lane items for ${candidates} candidates`);
 return {label,stage,operation:operation||'DEFAULT',markupBytes:Buffer.byteLength(memo.html),markupIdentical:true,laneCandidates:candidates,memo:{laneItemEvaluations:memoItems,lanePromptOptions:total(memoOptions),laneSelectedOperation:total(memoOperations)},perItem:{laneItemEvaluations:perItemItems,lanePromptOptions:total(perItemOptions),laneSelectedOperation:total(perItemOperations)}};
}

// Scope semantics with the actual owners: results are shared only inside an
// open scope, the shared raw record is the stored object itself, every array
// result is a fresh copy, an undefined result is retained as undefined, and
// nothing is retained once the scope closes.
function verifyScopeSemantics(r,project,withoutPending,source){
 const p=r.copy(project);p.activeStage=4;p.activeView='Workflow';
 const app=loadApplication(r,p,source),current=app.current(),raws=current.projectData.rawResponses,stage4=raws.filter(raw=>Number(raw.stage)===4);
 assert.ok(stage4.length>=2,'RENDER_LANE_MEMO_FIXTURE_ORACLE: two stage-4 attempts are required');
 assert.equal(app.scope(),null);
 const latest=app.latestResponseAttempt(4);assert.equal(latest,stage4.at(-1),'RENDER_LANE_MEMO_RAW_IDENTITY_ORACLE');
 app.openScope();
 assert.equal(app.latestResponseAttempt(4),latest,'RENDER_LANE_MEMO_RAW_IDENTITY_ORACLE: scoped');
 const removed=raws.splice(raws.indexOf(latest),1)[0];
 assert.equal(app.latestResponseAttempt(4),latest,'RENDER_LANE_MEMO_SCOPED_SHARING_ORACLE');
 const first=app.acceptedLaneChanges(2),second=app.acceptedLaneChanges(2);
 assert.ok(first.length>0,'RENDER_LANE_MEMO_FIXTURE_ORACLE: stage-2 accepted changes are required');
 assert.notEqual(first,second,'RENDER_LANE_MEMO_ARRAY_COPY_ORACLE');assert.deepEqual(first.map((row,i)=>row===second[i]),first.map(()=>true),'RENDER_LANE_MEMO_ARRAY_ELEMENT_IDENTITY_ORACLE');
 first.length=0;assert.ok(app.acceptedLaneChanges(2).length>0,'RENDER_LANE_MEMO_ARRAY_COPY_ORACLE: a caller mutated the shared result');
 const pending=app.pendingProposal();
 app.closeScope();
 assert.equal(app.latestResponseAttempt(4),stage4.at(-2),'RENDER_LANE_MEMO_NO_RETENTION_ORACLE: a closed scope retained a lane result');
 raws.push(removed);assert.equal(app.latestResponseAttempt(4),latest,'RENDER_LANE_MEMO_NO_RETENTION_ORACLE');
 assert.equal(app.pendingProposal(),pending,'RENDER_LANE_MEMO_PENDING_IDENTITY_ORACLE');
 // One scope holds a separate lane per stage (and per stage value type).
 const mixed=loadApplication(r,r.copy(p),source,{operations:{2:'SEARCH_ADEQUACY_REVIEW'}}),order=[4,2,3,'4',1,2,4,3],fresh=new Map(order.map(n=>[n,{latest:mixed.latestResponseAttempt(n),accepted:mixed.acceptedLaneChanges(n)}]));
 mixed.openScope();
 for(const n of order){const expected=fresh.get(n),accepted=mixed.acceptedLaneChanges(n);assert.equal(mixed.latestResponseAttempt(n),expected.latest,'RENDER_LANE_MEMO_STAGE_ISOLATION_ORACLE: '+n);assert.deepEqual(accepted.map(row=>expected.accepted.includes(row)),expected.accepted.map(()=>true),'RENDER_LANE_MEMO_STAGE_ISOLATION_ORACLE: accepted '+n);assert.equal(accepted.length,expected.accepted.length,'RENDER_LANE_MEMO_STAGE_ISOLATION_ORACLE: accepted '+n);}
 mixed.closeScope();
 const none=loadApplication(r,r.copy(withoutPending),source);none.openScope();
 assert.strictEqual(none.pendingProposal(),undefined,'RENDER_LANE_MEMO_UNDEFINED_RESULT_ORACLE');assert.strictEqual(none.pendingProposal(),undefined,'RENDER_LANE_MEMO_UNDEFINED_RESULT_ORACLE: scoped');
 none.closeScope();
 return {rawIdentity:true,scopedSharing:true,arrayCopies:true,noRetentionAfterScope:true,stageIsolation:order.length,pendingResult:pending===undefined?'undefined':'proposal',undefinedResultRetained:true};
}

// Static boundaries: callers guard the scope for extracted VM owners, the
// extracted selection region gains no lane identifier, and both new scopes
// restore the previous scope before any event or asynchronous continuation.
function verifySourceBoundaries(source){
 for(const name of ['acceptedLaneChanges','latestResponseAttempt','pendingProposal']){const [start,end]=definitionSpan(source,name);assert.equal(source.slice(start,end).split(SCOPE_GUARD).length-1,1,'RENDER_LANE_MEMO_SCOPE_GUARD_ORACLE: '+name);}
 const regionStart=source.indexOf('function stageOperations('),regionEnd=source.indexOf('function operatorLaneMatches(',regionStart),region=source.slice(regionStart,regionEnd).split('\n').filter(line=>!line.trimStart().startsWith('//')).join('\n');
 assert.ok(regionStart>=0&&regionEnd>regionStart,'RENDER_LANE_MEMO_REGION_ORACLE');
 assert.ok(!/\blane\b|operatorLane:/.test(region),'RENDER_LANE_MEMO_REGION_ORACLE: the extracted selection region references the lane memo');
 const open='const previousPresentationActions=presentationActions;presentationActions=new Map();try{',close='}finally{presentationActions=previousPresentationActions;}';
 assert.equal(source.split(open).length-1,2,'RENDER_LANE_MEMO_SCOPE_OPEN_ORACLE');assert.equal(source.split(close).length-1,2,'RENDER_LANE_MEMO_SCOPE_CLOSE_ORACLE');
 const render=source.slice(source.indexOf('function render(){'),source.indexOf('\n',source.indexOf('function render(){')));
 assert.ok(render.indexOf(close)>render.indexOf(open)&&render.indexOf(close)<render.indexOf("document.dispatchEvent(new Event('closed-loop-rendered'))"),'RENDER_LANE_MEMO_RENDER_SCOPE_ORACLE: the render scope must close before the rendered event');
 const preserve=source.slice(source.indexOf('const preserveView=()=>'),source.indexOf('\n',source.indexOf('const preserveView=()=>')));
 assert.ok(preserve.indexOf(open)>preserve.indexOf('if(!canPreserveView())return;')&&preserve.indexOf(close)>preserve.indexOf('void captureCurrentView().catch(reportActionFailure);'),'RENDER_LANE_MEMO_PRESERVE_SCOPE_ORACLE');
 return {scopeGuards:3,regionUnchanged:true,renderScopeClosesBeforeEvent:true,preserveViewScope:true};
}

async function syntheticLaneFixture(r){
 const fixtureRuntime={core:r.core,schema:r.runtime.closedLoopWorkflowSchema,engine:r.engine,prompts:r.prompts,ingestion:r.ingestion,store:r.store};
 const failing=r.copy(await accumulatedStage04Fixture(fixtureRuntime,{jobId:'RENDER-LANE-MEMO',attempts:4,responseCharacters:64}));
 const pending=r.copy(failing),prompt=pending.projectData.generatedPrompts.filter(row=>Number(row.stage)===4&&!row.invalidatedBy).at(-1);
 const prepared=r.ingestion.prepare(pending,{stage:4,text:JSON.stringify(stage04AcceptanceEnvelope(fixtureRuntime,pending,prompt)),promptRecord:prompt,transport:{authority:'NONAUTHORITATIVE_TEXT_FALLBACK',packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce}});
 assert.ok(prepared.validation.valid&&prepared.proposal?.status==='PENDING_OPERATOR_REVIEW','RENDER_LANE_MEMO_FIXTURE_ORACLE: a pending stage-4 proposal is required');
 return {failing,pending:r.copy(prepared.project)};
}

// A diagnostic counterpart prefix (for example the Stage-17 capture) can be
// supplied by path; its lane cases are then compared the same way.
async function prefixFixture(r,file){
 const prefix=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(prefix.schema,'closed-loop-counterpart-diagnostic-prefix/1','RENDER_LANE_MEMO_PREFIX_ORACLE');
 const clock=prefix.archivedFixtureClockUtc;if(clock)r.runtime.Date=class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return Date.parse(clock);}};
 await restoreArtifactFixture(r.store,prefix.artifacts);const project=r.copy(prefix.project);await hydrateRetainedPromptContexts(r,project,prefix.contextFiles||[]);return project;
}

export async function verifyRenderLaneMemo({source=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8'),prefixPath=process.env.RENDER_LANE_MEMO_PREFIX||null,prefixOperations=(process.env.RENDER_LANE_MEMO_OPERATIONS||',VERIFY,EXECUTE_RUN').split(',')}={}){
 const boundaries=verifySourceBoundaries(source),actual=observedSource(source),reference=observedSource(perItemLaneSource(source));
 assert.notEqual(perItemLaneSource(source),source,'RENDER_LANE_MEMO_REFERENCE_ORACLE: the per-item reference must differ from the memoized owners');
 const r=projectStoreRuntime({storageWorker:false}),{failing,pending}=await syntheticLaneFixture(r),variants={actual,reference};
 const cases=[
  compareRender(r,failing,{stage:4,label:'stage-4-failed-attempts'},variants),
  compareRender(r,pending,{stage:4,label:'stage-4-pending-proposal'},variants),
  compareRender(r,pending,{stage:4,operation:'DISPOSITION_CHALLENGE',label:'stage-4-unmatched-operation'},variants),
  compareRender(r,pending,{stage:1,label:'stage-1-accepted'},variants),
  compareRender(r,pending,{stage:2,label:'stage-2-complete'},variants),
  compareRender(r,pending,{stage:2,operation:'SEARCH_ADEQUACY_REVIEW',label:'stage-2-search-review'},variants),
  compareRender(r,pending,{stage:3,label:'stage-3-accepted'},variants),
  compareRender(r,pending,{stage:5,label:'stage-5-locked'},variants)
 ];
 const exercised=cases.find(row=>row.label==='stage-4-pending-proposal');
 assert.ok(exercised.perItem.lanePromptOptions>1&&exercised.memo.lanePromptOptions===1&&exercised.perItem.laneItemEvaluations>exercised.memo.laneItemEvaluations,'RENDER_LANE_MEMO_NONVACUOUS_ORACLE: the fixture must exercise repeated lane reads');
 const prefixCases=[];
 if(prefixPath){
  const pr=projectStoreRuntime({storageWorker:false}),project=await prefixFixture(pr,prefixPath),stage=Number(project.activeStage);
  for(const operation of prefixOperations)prefixCases.push(compareRender(pr,project,{stage,operation:operation||null,label:`prefix-stage-${stage}-${operation||'DEFAULT'}`},variants));
 }
 return {passed:true,synthetic:true,actualBrowser:false,boundaries,scopeSemantics:verifyScopeSemantics(r,pending,failing,source),cases,prefixCases};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await verifyRenderLaneMemo({prefixPath:process.argv[2]||process.env.RENDER_LANE_MEMO_PREFIX||null})));

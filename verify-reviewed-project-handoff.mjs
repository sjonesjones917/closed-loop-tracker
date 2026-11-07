import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm, access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {collectReviewedProjectHandoffEvidence, assertReviewedProjectHandoffEvidence, observeReviewedProjectHandoff, reviewedProjectHandoffBrowserExpression, handoffSemanticView} from './reviewed-project-handoff.mjs';

const clone = structuredClone;
const defaultSource = path.dirname(fileURLToPath(import.meta.url));
const hashAuthorities = new Map();
const bytesSha = bytes => createHash('sha256').update(bytes).digest('hex');
function freeze(value) { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
function deferred() { let resolve; const promise = new Promise(r => {resolve = r;}); return {promise, resolve}; }

export function createSyntheticReviewedFixture(hash, revision = 17) {
  const canonical = {job: {JOB_ID: 'JOB-REVIEWED-SEAM', NAME: 'Synthetic reviewed Stage06'}, revision, activeStage: 6, activeView: 'Workflow', projectData: {stage06: {status: 'accepted', proof: 'synthetic-proof'}}};
  const project = {...canonical, projectSha256: hash.sha256Value(canonical)};
  const expected = {jobId: project.job.JOB_ID, revision, projectSha256: project.projectSha256};
  const view = {handoffReview: {status: 'reviewed', digest: 'synthetic-handoff'}, fileSelections: {'6': ['reviewed.txt']}, pendingMutation: null, activeView: 'Workflow', activeStage: 6, scrollX: '0', scrollY: '137', drafts: {answer: 'reviewed draft'}, operationSelection: {'6': 'proof-review'}, runSelection: {'6': 'reviewed-run'}};
  const checkpointId = 'CHECKPOINT-REVIEWED-17';
  const storedHistory = {schema: 'closed-loop-recovery/1', jobId: expected.jobId, activeId: checkpointId, activeRevision: revision, activeProjectSha256: expected.projectSha256, generation: 3, removed: false, activeViewOverride: null, entries: [{id: checkpointId, projectSha256: expected.projectSha256, viewSha256: hash.sha256Value(view), action: 'accept-review'}]};
  const entry = {closedLoopHistory: 1, entryId: 'ENTRY-AFTER-REAL-RELOAD', sessionId: 'SESSION-AFTER-REAL-RELOAD', jobId: expected.jobId, checkpointId, view: clone(view)};
  const url = new URL('http://127.0.0.1:12345/'); for (const [key,value] of Object.entries({project: expected.jobId, version: checkpointId, stage: '6', view: 'Workflow'})) url.searchParams.set(key,value);
  return {expected, project, view, storedHistory, entry, url: url.href, selectedProject: expected.jobId, domProjectId: expected.jobId, ready: true};
}

export function createSyntheticReadOnlyRuntime(fixture, hash, hooks = {}) {
  const state = clone(fixture), calls = [], logs = [], forbidden = [];
  const deny = name => (...args) => {forbidden.push({name,args}); throw new Error('FORBIDDEN_SYNTHETIC_SIDE_EFFECT: ' + name);};
  const record = (method, args) => calls.push({method,args: clone(args)});
  let historyReads = 0, projectReads = 0, metadataReads = 0;
  const methods = {
    async metaGet(...args) {record('metaGet',args); assert.deepEqual(args,['selectedProject']); hooks.onMetaGet?.(++metadataReads,state); return clone(state.selectedProject);},
    async readProject(...args) {record('readProject',args); assert.deepEqual(args,[fixture.expected.jobId]); hooks.onReadProject?.(++projectReads,state); if(hooks.readProjectError) throw hooks.readProjectError; return clone(state.project);},
    async historyList(...args) {record('historyList',args); assert.deepEqual(args,[fixture.expected.jobId]); hooks.onHistoryList?.(++historyReads,state); return clone(state.storedHistory);},
    async readHistoryView(...args) {record('readHistoryView',args); assert.deepEqual(args,[fixture.expected.jobId]); hooks.onRetainedReadStart?.(state); if (hooks.retainedGate) await hooks.retainedGate; if(hooks.retainedError) throw hooks.retainedError; hooks.onRetainedReadComplete?.(state); return clone(state.storedHistory.activeViewOverride || state.view);},
  };
  const runtime = {
    closedLoopHash: hash,
    closedLoopProjectStore: new Proxy(methods,{get(target,key) {return key in target ? target[key] : deny('store.'+String(key));}}),
    get closedLoopAppReady(){return state.ready;},
    document: {querySelector(selector) {record('querySelector',[selector]); assert.equal(selector,'#current-project-summary'); return state.domProjectId === null ? null : {dataset: {projectId:state.domProjectId}};}},
    history: {get state(){return state.entry;}, pushState:deny('history.pushState'), replaceState:deny('history.replaceState'), back:deny('history.back'), forward:deny('history.forward')},
    location: {get href(){return state.url;}, assign:deny('location.assign'), replace:deny('location.replace'), reload:deny('location.reload')},
    Worker: deny('Worker'), SharedWorker:deny('SharedWorker'), setTimeout:deny('setTimeout'), setInterval:deny('setInterval'), requestAnimationFrame:deny('requestAnimationFrame'),
    console: {log(...args){logs.push({level:'log',args});}, error(...args){logs.push({level:'error',args});}},
  };
  return {runtime,state,calls,logs,forbidden};
}

export async function runReviewedProjectHandoffControls({sourceRoot = defaultSource} = {}) {
  const originalHashDescriptor = Object.getOwnPropertyDescriptor(globalThis,'closedLoopHash');
  const rows = [];
  const row = async (name, basis, action) => {try {const details = await action(); rows.push({name,basis,pass:true,...details});} catch(error){rows.push({name,basis,pass:false,error: String(error.stack || error)});}};
  try {
    const hashSourceSha256=bytesSha(await readFile(path.join(sourceRoot,'hash.js'))), authorityKey=sourceRoot+'#'+hashSourceSha256;
    if(!hashAuthorities.has(authorityKey)){await import(pathToFileURL(path.join(sourceRoot,'hash.js')).href+'?reviewed-handoff='+hashSourceSha256);hashAuthorities.set(authorityKey,globalThis.closedLoopHash);}
    const hash = hashAuthorities.get(authorityKey);
    assert.equal(hash.canonicalizationVersion,'closed-loop-canonical-json/1');
    const seed = createSyntheticReviewedFixture(hash), initial = createSyntheticReadOnlyRuntime(seed,hash);
    const evidence = await collectReviewedProjectHandoffEvidence(seed.expected,initial.runtime);
    const pure = async (name, mutate, expectedCheck = null, inspect = null) => row(name,'PURE_FROZEN_EVIDENCE_MUTATION',async()=>{
      const candidate=clone(evidence); mutate?.(candidate); freeze(candidate); const before=JSON.stringify(candidate);
      let result,error; try{result=assertReviewedProjectHandoffEvidence(candidate,hash.sha256Value);}catch(cause){error=cause;}
      assert.equal(JSON.stringify(candidate),before,'pure predicate changed evidence');
      if(expectedCheck){assert.ok(error,'mutation was accepted'); assert.equal(error.code,'REVIEWED_PROJECT_HANDOFF_MISMATCH'); assert.equal(error.check,expectedCheck);}
      else {if(error)throw error; inspect?.(result,candidate);}
      return {expectedOutcome:expectedCheck?'REJECT':'ACCEPT',observedCheck:error?.check??null,...(result?{result}: {})};
    });
    await pure('correct-nonzero-revision-17-and-checkpoint-without-revision',null,null,(r,e)=>{assert.equal(r.revision,17); assert.equal('revision' in e.historyAfter.entries[0],false);});
    for(const [name,mutate,check] of [
      ['expected-missing',e=>e.expected=null,'expected-identity-missing'],
      ['expected-job-empty',e=>e.expected.jobId='','expected-job-missing'],
      ['expected-revision-negative',e=>e.expected.revision=-1,'expected-revision-invalid'],
      ['expected-revision-string',e=>e.expected.revision='17','expected-revision-invalid'],
      ['expected-revision-fractional',e=>e.expected.revision=17.5,'expected-revision-invalid'],
      ['expected-digest-malformed',e=>e.expected.projectSha256='not-a-digest','expected-project-digest-invalid'],
      ['observation-schema-missing',e=>delete e.schema,'observation-schema'],
    ]) await pure(name,mutate,check);
    for(const [field,label] of [['canonicalProject','before'],['canonicalProjectAfter','after']]) {
      for(const [name,mutate,check] of [
        ['missing',e=>e[field]=null,'canonical-project-owner'],
        ['different-job',e=>e[field].job.JOB_ID='JOB-OTHER','canonical-project-owner'],
        ['old-revision',e=>e[field].revision=16,'canonical-project-revision'],
        ['different-digest',e=>e[field].projectSha256='f'.repeat(64),'canonical-project-digest'],
        ['changed-bytes-declared-digest-unchanged',e=>e[field].projectData.stage06.proof='corrupt','canonical-project-bytes'],
      ]) await pure('canonical-'+label+'-'+name,mutate,label+':'+check);
    }
    for(const field of ['selectedProjectBefore','selectedProjectAfter']) for(const [name,value] of [['missing',null],['different','JOB-OTHER'],['old','JOB-PREVIOUS']]) await pure(field+'-'+name,e=>e[field]=value,'selected-project-metadata');
    for(const [field,label] of [['historyBefore','before'],['historyAfter','after']]) {
      for(const [name,mutate,check] of [
        ['missing',h=>null,'history-missing'],['wrong-schema',h=>({...h,schema:'old/0'}),'history-schema'],
        ['wrong-owner',h=>({...h,jobId:'JOB-OTHER'}),'history-owner'], ['missing-active-id',h=>({...h,activeId:''}),'active-checkpoint-missing'],
        ['old-revision',h=>({...h,activeRevision:16}),'active-revision'],['different-digest',h=>({...h,activeProjectSha256:'f'.repeat(64)}),'active-project-digest'],
        ['removed-project',h=>({...h,removed:true}),'history-project-removed'],['missing-entries',h=>({...h,entries:null}),'checkpoint-list-missing'],
        ['missing-checkpoint',h=>({...h,entries:[]}),'active-checkpoint-not-unique'],['duplicate-checkpoint',h=>({...h,entries:[h.entries[0],clone(h.entries[0])]}),'active-checkpoint-not-unique'],
        ['wrong-checkpoint-digest',h=>({...h,entries:[{...h.entries[0],projectSha256:'f'.repeat(64)}]}),'checkpoint-project-digest'],
      ]) await pure('history-'+label+'-'+name,e=>e[field]=mutate(e[field]),label+':'+check);
    }
    await pure('history-generation-changed-during-read',e=>e.historyAfter.generation++,'history-changed-during-read');
    await pure('history-checkpoint-descriptor-changed-during-read',e=>e.historyAfter.entries[0].viewSha256='f'.repeat(64),'history-changed-during-read');
    await pure('history-active-override-changed-during-read',e=>e.historyAfter.activeViewOverride={...e.retainedView,scrollY:'999'},'history-changed-during-read');
    for(const [field,label] of [['browserBefore','before'],['browserAfter','after']]) {
      for(const [name,mutate,check] of [
        ['missing',b=>null,'browser-observation-missing'],['app-not-ready',b=>({...b,applicationReady:false}),'application-not-ready'],
        ['dom-missing',b=>({...b,domProjectId:null}),'dom-project'],['dom-other-project',b=>({...b,domProjectId:'JOB-OTHER'}),'dom-project'],
        ['entry-missing',b=>({...b,entry:null}),'history-entry-marker'],
        ['entry-marker-missing',b=>({...b,entry:{...b.entry,closedLoopHistory:0}}),'history-entry-marker'],
        ['entry-id-empty',b=>({...b,entry:{...b.entry,entryId:''}}),'entry-id-missing'],
        ['session-id-empty',b=>({...b,entry:{...b.entry,sessionId:''}}),'session-id-missing'],
        ['entry-job-wrong',b=>({...b,entry:{...b.entry,jobId:'JOB-OTHER'}}),'entry-owner'],
        ['entry-checkpoint-old',b=>({...b,entry:{...b.entry,checkpointId:'CHECKPOINT-OLD'}}),'entry-checkpoint'],
        ['entry-view-missing',b=>({...b,entry:{...b.entry,view:null}}),'entry-view-missing'],
        ['entry-stage-string',b=>({...b,entry:{...b.entry,view:{...b.entry.view,activeStage:'6'}}}),'entry-stage-invalid'],
        ['entry-active-view-empty',b=>({...b,entry:{...b.entry,view:{...b.entry.view,activeView:''}}}),'entry-active-view-missing'],
        ['url-not-absolute',b=>({...b,url:'/relative'}),'url-invalid'],['url-credentials',b=>({...b,url:b.url.replace('http://','http://user:password@')}),'url-origin-invalid'],
      ]) await pure('browser-'+label+'-'+name,e=>e[field]=mutate(e[field]),label+':'+check);
    }
    for(const key of ['project','version','stage','view']) for(const mode of ['missing','old','duplicate']) await pure('url-'+key+'-'+mode,e=>{const u=new URL(e.browserAfter.url); if(mode==='missing')u.searchParams.delete(key);else if(mode==='old')u.searchParams.set(key,'OLD');else u.searchParams.append(key,u.searchParams.get(key));e.browserAfter.url=u.href;},'after:url-'+key);
    for(const [name,mutate,check] of [
      ['browser-entry-id-race',e=>e.browserAfter.entry.entryId='NEW-ENTRY','browser-entry-changed-during-read'],
      ['browser-session-id-race',e=>e.browserAfter.entry.sessionId='NEW-SESSION','browser-entry-changed-during-read'],
      ['browser-url-race',e=>e.browserAfter.url+='&other=changed','browser-entry-changed-during-read'],
      ['browser-draft-race',e=>e.browserAfter.entry.view.drafts.answer='changed','browser-view-changed-during-read'],
      ['retained-verification-missing',e=>e.retainedBytesVerified=false,'retained-byte-verification-not-established'],
      ['retained-read-two-arguments',e=>e.retainedReadArguments.push(e.historyAfter.activeId),'retained-byte-verification-not-established'],
      ['retained-read-wrong-job',e=>e.retainedReadArguments=['JOB-OTHER'],'retained-byte-verification-not-established'],
      ['retained-view-missing',e=>e.retainedView=null,'retained-view-missing'],
      ['retained-stage-different',e=>e.retainedView.activeStage=5,'retained-stage-or-view'],
      ['retained-active-view-different',e=>e.retainedView.activeView='Data','retained-stage-or-view'],
    ]) await pure(name,mutate,check);
    for(const key of ['drafts','fileSelections','pendingMutation','handoffReview','operationSelection','runSelection','focus','unknownFutureViewField']) await pure('semantic-view-'+key+'-mismatch',e=>e.retainedView[key]={changed:true},'retained-browser-semantic-view');
    await pure('semantic-draft-string-not-normalized',e=>e.retainedView.drafts.answer=' reviewed draft ','retained-browser-semantic-view');
    await pure('semantic-unicode-string-not-normalized',e=>{e.retainedView.drafts.answer='e\u0301';for(const field of ['browserBefore','browserAfter'])e[field].entry.view.drafts.answer='\u00e9';},'retained-browser-semantic-view');
    await pure('scroll-only-mismatch-accepted-full-hashes-retained',e=>{e.retainedView.scrollX='19';e.retainedView.scrollY='901';},null,r=>{assert.notEqual(r.retainedViewSha256,r.browserViewSha256);assert.equal(r.retainedSemanticViewSha256,r.browserSemanticViewSha256);});
    await pure('browser-scroll-during-read-accepted-unmodified',e=>{e.browserAfter.entry.view.scrollX='19';e.browserAfter.entry.view.scrollY='901';},null,r=>assert.notEqual(r.retainedViewSha256,r.browserViewSha256));
    await pure('unknown-field-identical-retained',e=>{for(const view of [e.retainedView,e.browserBefore.entry.view,e.browserAfter.entry.view])view.focus='synthetic-kept-exact';},null,r=>assert.equal(r.retainedViewSha256,r.browserViewSha256));

    const adapter = async (name, fixtureMutate, hooks={}, check=null, inspect=null) => row(name,'INJECTED_READ_ONLY_RUNTIME_ACTUAL_HELPER',async()=>{
      const fixture=createSyntheticReviewedFixture(hash);fixtureMutate?.(fixture);const target=createSyntheticReadOnlyRuntime(fixture,hash,hooks); const original=clone(target.state); let result,error;
      try {result=await observeReviewedProjectHandoff(fixture.expected,target.runtime);}catch(cause){error=cause;}
      assert.deepEqual(target.forbidden,[]); assert.equal(target.logs.length,1); const log=JSON.parse(target.logs[0].args[0].slice('BROWSER_REVIEWED_PROJECT_HANDOFF '.length));
      if(check){assert.ok(error);assert.equal(error.check||error.phase,check);assert.equal(log.status,'FAIL');}else{if(error)throw error;assert.equal(log.status,'PASS');}
      inspect?.({target,original,result,error,log});return{expectedOutcome:check?'REJECT':'ACCEPT',observedCheck:error?.check||error?.phase||null,readCalls:target.calls,log};
    });
    await adapter('adapter-correct-nonzero-17-zero-side-effects',null,{},null,({target,original,result})=>{assert.deepEqual(target.state,original);assert.deepEqual(result.readCalls,{readProject:2,historyList:2,readHistoryView:1,selectedProjectMetaGet:2});assert.equal(target.calls.filter(c=>c.method==='readHistoryView').length,1);});
    await row('adapter-correct-nonzero-53','INJECTED_READ_ONLY_RUNTIME_ACTUAL_HELPER',async()=>{const fixture=createSyntheticReviewedFixture(hash,53),target=createSyntheticReadOnlyRuntime(fixture,hash);const result=await observeReviewedProjectHandoff(fixture.expected,target.runtime);assert.equal(result.revision,53);assert.deepEqual(target.forbidden,[]);return{expectedOutcome:'ACCEPT',result};});
    await adapter('adapter-effective-active-view-override-not-checkpoint-view',f=>{f.storedHistory.activeViewOverride={...f.view,drafts:{answer:'effective override draft'}};f.entry.view=clone(f.storedHistory.activeViewOverride);}, {},null,({target,result})=>{assert.notEqual(target.state.storedHistory.entries[0].viewSha256,result.retainedViewSha256);assert.deepEqual(target.calls.find(c=>c.method==='readHistoryView').args,[target.state.expected.jobId]);});
    await adapter('adapter-missing-selected-metadata',f=>f.selectedProject=null,{},'selected-project-metadata');
    await adapter('adapter-old-selected-metadata',f=>f.selectedProject='JOB-OLD',{},'selected-project-metadata');
    await adapter('adapter-different-dom-project',f=>f.domProjectId='JOB-OTHER',{},'before:dom-project');
    await adapter('adapter-old-history-revision',f=>f.storedHistory.activeRevision=16,{},'before:active-revision');
    await adapter('adapter-old-url-checkpoint',f=>{const u=new URL(f.url);u.searchParams.set('version','OLD');f.url=u.href;},{},'before:url-version');
    await adapter('adapter-checkpoint-digest-mismatch',f=>f.storedHistory.entries[0].projectSha256='f'.repeat(64),{},'before:checkpoint-project-digest');
    const byteError=Object.assign(new Error('Synthetic retained byte hash mismatch'),{code:'SYNTHETIC_RETAINED_BYTES_INVALID'});
    await adapter('adapter-retained-byte-verification-throws',null,{retainedError:byteError},'retained-byte-verification',({error,log})=>{assert.equal(error.cause,byteError);assert.equal(log.causeCode,byteError.code);assert.equal(log.retainedViewSha256,null);assert.equal(typeof log.browserViewSha256,'string');});
    await adapter('adapter-read-project-throws',null,{readProjectError:byteError},'canonical-project',({error})=>assert.equal(error.cause,byteError));
    for(const [name,mutate,check] of [
      ['canonical-revision',s=>s.project.revision++,'after:canonical-project-revision'],
      ['canonical-bytes',s=>s.project.projectData.stage06.proof='new work','after:canonical-project-bytes'],
      ['selected-metadata',s=>s.selectedProject='JOB-OTHER','selected-project-metadata'],
      ['history-owner',s=>s.storedHistory.jobId='JOB-OTHER','after:history-owner'],
      ['history-checkpoint',s=>{s.storedHistory.activeId='NEW';s.storedHistory.entries[0].id='NEW';},'history-changed-during-read'],
      ['browser-entry',s=>s.entry.entryId='NEW-ENTRY','browser-entry-changed-during-read'],
      ['browser-view',s=>s.entry.view.drafts.answer='changed','browser-view-changed-during-read'],
      ['dom-project',s=>s.domProjectId='JOB-OTHER','after:dom-project'],
      ['app-ready',s=>s.ready=false,'after:application-not-ready'],
    ]) await adapter('adapter-change-during-retained-await-'+name,null,{onRetainedReadComplete:mutate},check);
    await row('adapter-awaits-retained-verification-before-success','DEFERRED_SYNTHETIC_PROMISE_NO_TIMER',async()=>{
      const gate=deferred(),entered=deferred(),fixture=createSyntheticReviewedFixture(hash),target=createSyntheticReadOnlyRuntime(fixture,hash,{retainedGate:gate.promise,onRetainedReadStart:()=>entered.resolve()});
      let settled=false;const pending=observeReviewedProjectHandoff(fixture.expected,target.runtime).then(result=>{settled=true;return result;});await entered.promise;assert.equal(settled,false);assert.equal(target.logs.length,0);assert.equal(target.calls.filter(c=>c.method==='readProject').length,1);gate.resolve();const result=await pending;assert.equal(settled,true);assert.deepEqual(target.forbidden,[]);return{expectedOutcome:'ACCEPT_AFTER_VERIFIED_READ',result};
    });
    await row('adapter-canonical-mutation-while-retained-read-is-suspended','DEFERRED_SYNTHETIC_PROMISE_NO_TIMER',async()=>{
      const gate=deferred(),entered=deferred(),fixture=createSyntheticReviewedFixture(hash),target=createSyntheticReadOnlyRuntime(fixture,hash,{retainedGate:gate.promise,onRetainedReadStart:()=>entered.resolve()});const pending=observeReviewedProjectHandoff(fixture.expected,target.runtime);await entered.promise;target.state.project.revision++;gate.resolve();await assert.rejects(pending,e=>e.check==='after:canonical-project-revision');assert.deepEqual(target.forbidden,[]);return{expectedOutcome:'REJECT',observedCheck:'after:canonical-project-revision'};
    });
    await row('serialized-expression-executes-against-injected-runtime','NODE_VM_SYNTHETIC_ADAPTER_NO_BROWSER',async()=>{
      const fixture=createSyntheticReviewedFixture(hash),target=createSyntheticReadOnlyRuntime(fixture,hash);const sandbox=createVerifierRuntime({...target.runtime,URL,TextEncoder,TextDecoder});createVerifierRuntime.loadScript(sandbox,await readFile(path.join(sourceRoot,'hash.js'),'utf8'));const result=await createVerifierRuntime.loadScript(sandbox,reviewedProjectHandoffBrowserExpression(fixture.expected));assert.equal(result.revision,17);assert.deepEqual(target.forbidden,[]);assert.equal(target.logs.length,1);return{expectedOutcome:'ACCEPT',result};
    });
    await row('serialized-expression-retains-reviewed-identity-during-await','NODE_VM_SYNTHETIC_ADAPTER_NO_BROWSER',async()=>{
      const gate=deferred(),entered=deferred(),fixture=createSyntheticReviewedFixture(hash),input=clone(fixture.expected),target=createSyntheticReadOnlyRuntime(fixture,hash,{retainedGate:gate.promise,onRetainedReadStart:()=>entered.resolve()});const sandbox=createVerifierRuntime({...target.runtime,URL,TextEncoder,TextDecoder});createVerifierRuntime.loadScript(sandbox,await readFile(path.join(sourceRoot,'hash.js'),'utf8'));const expression=reviewedProjectHandoffBrowserExpression(input);const pending=createVerifierRuntime.loadScript(sandbox,expression);await entered.promise;input.revision=999;input.jobId='CHANGED-INPUT';gate.resolve();const result=await pending;assert.equal(result.revision,17);assert.equal(result.jobId,fixture.expected.jobId);assert.deepEqual(target.forbidden,[]);return{expectedOutcome:'ACCEPT_ORIGINAL_IMMUTABLE_REVIEWED_ARGUMENT',result};
    });
    await row('serialized-expression-canonical-mutation-during-await-rejects','NODE_VM_SYNTHETIC_ADAPTER_NO_BROWSER',async()=>{
      const gate=deferred(),entered=deferred(),fixture=createSyntheticReviewedFixture(hash),target=createSyntheticReadOnlyRuntime(fixture,hash,{retainedGate:gate.promise,onRetainedReadStart:()=>entered.resolve()});const sandbox=createVerifierRuntime({...target.runtime,URL,TextEncoder,TextDecoder});createVerifierRuntime.loadScript(sandbox,await readFile(path.join(sourceRoot,'hash.js'),'utf8'));const pending=createVerifierRuntime.loadScript(sandbox,reviewedProjectHandoffBrowserExpression(fixture.expected));await entered.promise;target.state.project.revision++;gate.resolve();await assert.rejects(pending,error=>error.check==='after:canonical-project-revision');assert.deepEqual(target.forbidden,[]);return{expectedOutcome:'REJECT',observedCheck:'after:canonical-project-revision'};
    });
    await row('semantic-filter-excludes-exactly-two-keys','PURE_FROZEN_EVIDENCE_MUTATION',async()=>{
      const view=freeze({scrollX:'1',scrollY:'2',focus:'keep',drafts:{x:'keep'},extra:'keep'});const semantic=handoffSemanticView(view);assert.deepEqual(Object.keys(semantic).sort(),['drafts','extra','focus']);assert.equal(view.scrollX,'1');return{expectedOutcome:'ONLY_SCROLL_X_AND_SCROLL_Y_EXCLUDED'};
    });
    const report={schema:'reviewed-project-handoff-synthetic-controls/1',basis:'Private read-only helper and synthetic injected adapter controls; no application/browser execution, no socket, no receipt, no source edits.',contract:{viewEquality:'EXACT_EXCEPT_SCROLL_X_AND_SCROLL_Y',retainedRead:'readHistoryView(jobId), exactly one argument; effective active override',fullViewHashes:'Both complete retained and browser hashes logged even when scroll differs',canonicalReads:'Before and after awaited retained verification',integration:'Helper-only controls for the reviewed lane2 between-scenario handoff seam; no browser execution evidence'},sourceRoot,hashAuthoritySha256:bytesSha(await readFile(path.join(sourceRoot,'hash.js'))),helperSha256:bytesSha(await readFile(new URL('./reviewed-project-handoff.mjs',import.meta.url))),controlsSha256:bytesSha(await readFile(fileURLToPath(import.meta.url))),totals:{cases:rows.length,passing:rows.filter(r=>r.pass).length,failing:rows.filter(r=>!r.pass).length},populations:Object.fromEntries([...new Set(rows.map(row=>row.basis))].map(basis=>[basis,rows.filter(row=>row.basis===basis).map(row=>row.name)])),cases:rows};
    return report;
  } finally {
    if(originalHashDescriptor)Object.defineProperty(globalThis,'closedLoopHash',originalHashDescriptor);else delete globalThis.closedLoopHash;
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'closedLoopHash'),originalHashDescriptor,'hash module global not restored');
  }
}

export async function verifyReviewedProjectHandoffSetupCleanup({controlsPath = fileURLToPath(import.meta.url)} = {}) {
  const program = `
    import assert from 'node:assert/strict';
    const [controlsURL,sourceRoot,mode] = process.argv.slice(1);
    if(mode==='existing') {
      const original = {marker:'original-exact-object'};
      const getter = () => original, setter = () => {throw new Error('Original setter must not run');};
      Object.defineProperty(globalThis,'closedLoopHash',{get:getter,set:setter,enumerable:false,configurable:true});
    } else delete globalThis.closedLoopHash;
    const before = Object.getOwnPropertyDescriptor(globalThis,'closedLoopHash');
    const {runReviewedProjectHandoffControls} = await import(controlsURL);
    let thrown;
    try {await runReviewedProjectHandoffControls({sourceRoot});} catch(error) {thrown=error;}
    assert.equal(thrown?.code,'SYNTHETIC_HASH_SETUP_THROW','original setup error must escape unchanged');
    assert.equal(thrown.hashInstalledBeforeThrow,true,'fixture must install the global before it throws');
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'closedLoopHash'),before,'exact original descriptor must be restored');
    console.log(JSON.stringify({originalErrorPreserved:true,globalInstalledBeforeThrow:true,originalDescriptorRestored:true,mode}));
  `;
  const cases=[], root=await mkdtemp(path.join(tmpdir(),'reviewed-handoff-setup-'));
  const fixtureSource="const installed = {syntheticSetupThrowMarker: 'installed-before-throw'};\nObject.defineProperty(globalThis, 'closedLoopHash', {value: installed, writable: true, enumerable: true, configurable: true});\nconst error = new Error('SYNTHETIC_HASH_SETUP_THROW_AFTER_GLOBAL_INSTALL');\nerror.code = 'SYNTHETIC_HASH_SETUP_THROW';\nerror.hashInstalledBeforeThrow = globalThis.closedLoopHash === installed;\nthrow error;\n";
  let temporaryFixtureRootCleaned=false;
  try {
  await writeFile(path.join(root,'hash.js'),fixtureSource);

  for(const mode of ['absent','existing']) {
    const child=spawnSync(process.execPath,['--input-type=module','-e',program,pathToFileURL(controlsPath).href,root,mode],{encoding:'utf8',timeout:5000,killSignal:'SIGKILL',maxBuffer:1048576});
    let detail;try{detail=JSON.parse(child.stdout.trim());}catch{}
    cases.push({name:'wrapper-setup-throw-restores-'+mode+'-hash-global',basis:'ACTUAL_THROWING_HASH_MODULE_IMPORT_IN_FRESH_NODE_PROCESS',expectedOutcome:'REJECT_ORIGINAL_SETUP_ERROR_AND_RESTORE_EXACT_GLOBAL_DESCRIPTOR',pass:!child.error && !child.signal && child.status===0 && detail?.originalDescriptorRestored===true,child:{exitCode:child.status,signal:child.signal??null,error:child.error?{name:child.error.name,code:child.error.code??null,message:child.error.message}:null,timeoutMs:5000,killSignal:'SIGKILL',maxBuffer:1048576},...(detail?{detail}:{}),...((child.error||child.signal||child.status!==0)?{stderr:child.stderr}: {})});
  }
  } finally {
    await rm(root,{recursive:true,force:true});
    await assert.rejects(access(root),error=>error.code==='ENOENT');
    temporaryFixtureRootCleaned=true;
  }
  const report={schema:'reviewed-project-handoff-wrapper-cleanup-controls/1',synthetic:true,actualBrowser:false,basis:'Two explicit wrapper-only controls; original 140 helper population unchanged. Each child imports an actual synthetic hash.js that installs closedLoopHash then throws; no browser, sockets, source changes or receipt.',controlsPath,controlsSha256:bytesSha(await readFile(controlsPath)),setupThrowFixtureSha256:bytesSha(fixtureSource),temporaryFixtureRootCleaned,populations:{WRAPPER_HASH_SETUP_FAILURE_RESTORATION:cases.map(row=>row.name)},totals:{cases:cases.length,passing:cases.filter(row=>row.pass).length,failing:cases.filter(row=>!row.pass).length},cases};
  if(report.totals.failing){const error=new Error('REVIEWED_PROJECT_HANDOFF_WRAPPER_CLEANUP_FAILED');error.report=report;throw error;}
  return report;
}
export async function verifyReviewedProjectHandoffControls(options = {}) {
  const report = await runReviewedProjectHandoffControls(options);
  if(report.totals.failing !== 0 || report.totals.cases !== 140 || new Set(report.cases.map(row=>row.name)).size !== 140) {
    const error = new Error('REVIEWED_PROJECT_HANDOFF_CONTROLS_FAILED: ' + report.cases.filter(row=>!row.pass).map(row=>row.name).join(', '));
    error.report = report; throw error;
  }
  const wrapperControls=await verifyReviewedProjectHandoffSetupCleanup();
  return {schema:'reviewed-project-handoff-control-summary/2',wrapperControls,synthetic:true,actualBrowser:false,basis:report.basis,contract:report.contract,helperSha256:report.helperSha256,controlsSha256:report.controlsSha256,hashAuthoritySha256:report.hashAuthoritySha256,totals:report.totals,populations:report.populations,cases:report.cases.map(({name,basis,expectedOutcome,pass})=>({name,basis,expectedOutcome,pass}))};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const get=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
  const report=await runReviewedProjectHandoffControls({sourceRoot:get('--source-root')||defaultSource});
  if(get('--report'))await writeFile(get('--report'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report.totals));
  for(const row of report.cases.filter(r=>!r.pass))console.error(row.name+'\n'+row.error);
  process.exitCode=report.totals.failing?1:0;
}

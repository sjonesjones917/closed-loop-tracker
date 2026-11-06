// Pins the whole-project graph passes of the store's write path: every
// verifiedGraphNodes walk of a project-sized graph and every private copy of
// a project, per canonical write, per operational write and per
// root-continuation checkpoint, plus the digest scopes those writes create.
// A pass removed on purpose lowers its pin here; a pass added back fails the
// pin. Sources are instrumented in memory only; production files are unchanged.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

// Totals per command (walks include the walk inside each copy; a copy is a
// private whole-project copy). Captured
// private receipts and source copies compare by walking the current side only;
// the operational write receipt, whose snapshot is copied again, walks both.
export const WRITE_WALK_PINS=Object.freeze({
 canonicalWrite:Object.freeze({walks:26,copies:8,digestScopes:0}),
 firstOperationalWrite:Object.freeze({walks:58,copies:12,digestScopes:0}),
 operationalWrite:Object.freeze({walks:56,copies:12,digestScopes:0})
});
// Walks at the sites whose double walks were removed. The operational History
// candidate is its own bound pair snapshot: each of the four pair checks walks
// it once. A write-certified root's snapshot is walked once per use for both
// of its comparisons. Only an unbound History candidate gets its own receipt.
export const WRITE_SITE_PINS=Object.freeze({
 digestPairWalksPerOperationalWrite:4,
 operationalReceiptCopies:3,
 rootContinuationWalksPerCall:3,
 rootBytesWalksPerCall:3
});
const replaceOnce=(source,before,after)=>{assert.equal(source.split(before).length,2,'WRITE_WALK_COUNT_ANCHOR_ORACLE: '+before.slice(0,80));return source.replace(before,after);};
// Function names of the nearest frames above the instrumented call.
const FRAMES="String(new Error().stack).split('\\n').slice(2,8).map(line=>{const match=/at (?:async )?(?:Object\\.)?([A-Za-z0-9_$]+)/.exec(line.trim());return match?match[1]:'';})";
export function instrumentWriteWalks(source,hashSource){
 source=replaceOnce(source,'function verifiedGraphNodes(value){',`function verifiedGraphNodes(value){const counted=verifiedGraphNodesUncounted(value);if(counted&&counted.size>=globalThis.__walkThreshold)globalThis.__recordPass('walk',${FRAMES});return counted;}\nfunction verifiedGraphNodesUncounted(value){`);
 // Count each ordinary whole-project copy where the target is populated.
 // This includes direct copies from a previously inspected graph.
 const copier='function copyVerifiedGraph(value,sourceNodes,capturedNodes=null,arrayLengths=null){';
 source=replaceOnce(source,copier,`${copier}if(value&&typeof value==='object'&&Object.hasOwn(value,'projectData'))globalThis.__recordPass('copy',${FRAMES});`);
 source=replaceOnce(source,'function usableRootContinuation(proof,read,descriptor){','function usableRootContinuation(proof,read,descriptor){globalThis.__recordPass(\'call:usableRootContinuation\',[]);');
 source=replaceOnce(source,'async function writeRootBytesVerified(proof,body,readFile,verifiedParts,verifiedByteDigests){','async function writeRootBytesVerified(proof,body,readFile,verifiedParts,verifiedByteDigests){if(unverifiedWriteRoots.has(proof)&&rootCertificates.has(proof))globalThis.__recordPass(\'call:writeRootBytesVerified\',[]);');
 source=replaceOnce(source,'globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS','globalThis.__projectNodes=value=>verifiedGraphNodesUncounted(value)?.size||0;globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS');
 hashSource=replaceOnce(hashSource,'function createCanonicalDigestScope(root){',`function createCanonicalDigestScope(root){if(root!==null)globalThis.__recordPass?.('scope',${FRAMES});`);
 return {source,hashSource};
}
const near=(row,name,depth=3)=>row.frames.slice(0,depth).includes(name);
function summarize(passes){
 const walks=passes.filter(row=>row.kind==='walk'),copies=passes.filter(row=>row.kind==='copy');
 return {walks:walks.length,copies:copies.length,digestScopes:passes.filter(row=>row.kind==='scope').length,
  digestPairWalks:walks.filter(row=>near(row,'assertDigestPair',4)).length,
  operationalReceiptCopies:copies.filter(row=>{const at=row.frames.indexOf('verifiedProjectIntegrity');return at>=0&&at<3&&row.frames[at+1]==='writeOperationalProject';}).length,
  rootContinuationWalks:walks.filter(row=>near(row,'usableRootContinuation')&&!row.frames.includes('copyVerifiedTree')).length,
  rootContinuationCalls:passes.filter(row=>row.kind==='call:usableRootContinuation').length,
  rootBytesWalks:walks.filter(row=>near(row,'writeRootBytesVerified')&&!near(row,'copyVerifiedTree')&&!row.frames.includes('restoreHistoryProject')).length,
  rootBytesCalls:passes.filter(row=>row.kind==='call:writeRootBytesVerified').length};
}
// Runs the commands and returns the observed passes per command.
export async function measureWriteWalks({source=fs.readFileSync(new URL('./project-store.js',import.meta.url),'utf8'),hashSource=fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8')}={}){
 const instrumented=instrumentWriteWalks(source,hashSource);let passes=[];
 const r=projectStoreRuntime({storageWorker:false,sourceOverrides:{'project-store.js':instrumented.source,'hash.js':instrumented.hashSource},environment:{__walkThreshold:Infinity,__recordPass:(kind,frames)=>passes.push({kind,frames:[...frames]})}});
 r.runtime.Error.stackTraceLimit=Math.max(Number(r.runtime.Error.stackTraceLimit)||0,16);
 const measure=async command=>{passes=[];const result=await command();return {result,observed:summarize(passes)};};
 let p=await r.store.createProject({commandId:'WRITE-WALK-COUNTS'});p.job.JOB_TITLE='Exact walk count title '+'independent retained content '.repeat(300);r.engine.recalculate(p);
 p=await r.store.writeProject(p,{expectedProjectRevision:p.revision});p=await r.store.readProject(p.job.JOB_ID);
 const projectNodes=r.runtime.__projectNodes(p);assert.ok(projectNodes>200,'WRITE_WALK_COUNT_FIXTURE_ORACLE: project graph too small to separate whole-project passes');
 // Graphs of at least 80% of the project's nodes are whole-project passes; the
 // views, journals and History states compared on this path are far smaller.
 r.runtime.__walkThreshold=Math.floor(projectNodes*0.8);
 const cases=[];
 const canonical=await measure(()=>{const next=r.copy(p);next.job.JOB_TITLE='Exact second walk count title '+'independent retained content '.repeat(300);r.engine.recalculate(next);return r.store.writeProject(next,{expectedProjectRevision:p.revision});});
 p=canonical.result;cases.push({command:'canonicalWrite',...canonical.observed});
 const views=['Records','Workflow'];
 for(const command of ['firstOperationalWrite','operationalWrite']){
  const operational=await measure(()=>{const next=r.copy(p);next.activeView=views[cases.length%2];return r.store.writeProject(next,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});});
  p=operational.result;cases.push({command,...operational.observed});
 }
 // Consecutive changed views: each uses the certified root of the save before.
 const view=name=>r.copy({activeStage:1,activeView:name,drafts:{'#exact':{value:name+' exact draft'}},scrollX:0,scrollY:17});
 for(const name of ['Project','Workflow']){const saved=await measure(()=>r.store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:view(name)}));cases.push({command:'viewCheckpoint:'+name,...saved.observed});}
 return {projectNodes,walkThreshold:r.runtime.__walkThreshold,cases};
}
export async function verifyWriteWalkCounts(options={}){
 const {projectNodes,walkThreshold,cases}=await measureWriteWalks(options);
 for(const row of cases.filter(row=>Object.hasOwn(WRITE_WALK_PINS,row.command))){
  const pin=WRITE_WALK_PINS[row.command];
  assert.deepEqual({walks:row.walks,copies:row.copies,digestScopes:row.digestScopes},{...pin},'WRITE_WALK_COUNT_PIN_ORACLE: '+row.command);
 }
 for(const row of cases.filter(row=>row.command.endsWith('perationalWrite'))){
  assert.equal(row.digestPairWalks,WRITE_SITE_PINS.digestPairWalksPerOperationalWrite,'WRITE_WALK_DIGEST_PAIR_ORACLE: '+row.command);
  assert.equal(row.operationalReceiptCopies,WRITE_SITE_PINS.operationalReceiptCopies,'WRITE_WALK_OPERATIONAL_RECEIPT_ORACLE: '+row.command);
 }
 const checkpoints=cases.filter(row=>row.command.startsWith('viewCheckpoint:')),continuationCalls=checkpoints.reduce((sum,row)=>sum+row.rootContinuationCalls,0),bytesCalls=checkpoints.reduce((sum,row)=>sum+row.rootBytesCalls,0);
 assert.ok(continuationCalls>0&&bytesCalls>0,'WRITE_WALK_ROOT_FIXTURE_ORACLE: the view checkpoints must use a write-certified root');
 for(const row of checkpoints){
  assert.equal(row.rootContinuationWalks,row.rootContinuationCalls*WRITE_SITE_PINS.rootContinuationWalksPerCall,'WRITE_WALK_ROOT_CONTINUATION_ORACLE: '+row.command);
  assert.equal(row.rootBytesWalks,row.rootBytesCalls*WRITE_SITE_PINS.rootBytesWalksPerCall,'WRITE_WALK_ROOT_BYTES_ORACLE: '+row.command);
 }
 return {passed:true,projectNodes,walkThreshold,pins:WRITE_WALK_PINS,sitePins:WRITE_SITE_PINS,cases,boundary:'In-memory instrumented production store and hash sources over the transaction adapter; counts whole-project graph walks and copies per command, not time.'};
}
// Intended faults: each restores one removed pass and must fail its pin.
export const WRITE_WALK_FAULTS=Object.freeze({
 'write-digest-scope':['  globalThis.closedLoopWorkflowEngine.recalculate(next);const operationalChangePatches=','  hash.disposeCanonicalDigestScope(hash.createCanonicalDigestScope({rawResponses:next.projectData.rawResponses}));globalThis.closedLoopWorkflowEngine.recalculate(next);const operationalChangePatches=','WRITE_WALK_COUNT_PIN_ORACLE'],
 'digest-pair-self-compare':['project===pair.snapshot?checkpointPairSnapshotMatches(pair):checkpointPairMatches(pair,project)','checkpointPairMatches(pair,project)','WRITE_WALK_COUNT_PIN_ORACLE'],
 'bound-history-receipt':['historyIntegrity=pair?null:verifiedProjectIntegrity(historyCandidate,digest);','historyIntegrity=verifiedProjectIntegrity(historyCandidate,digest);','WRITE_WALK_COUNT_PIN_ORACLE'],
 'root-continuation-double-walk':['verifiedValueMatchesNodes(proof.snapshot,snapshotNodes,canonicalProject(read.project))','verifiedValuesEqual(proof.snapshot,canonicalProject(read.project))','WRITE_WALK_ROOT_CONTINUATION_ORACLE'],
 'uncaptured-private-receipts':['if(capture!==CAPTURED_PROJECT_INTEGRITY)return {kind:VERIFIED_PROJECT_INTEGRITY,','if(true)return {kind:VERIFIED_PROJECT_INTEGRITY,','WRITE_WALK_COUNT_PIN_ORACLE'],
 'uncaptured-source-copies':['function capturedPrivateCopy(value){','function capturedPrivateCopy(value){return copyVerifiedTree(value);','WRITE_WALK_COUNT_PIN_ORACLE'],
 'root-bytes-double-walk':['verifiedValueMatchesNodes(proof.snapshot,snapshotNodes,proof.project)){unverifiedWriteRoots.delete(proof);','verifiedValuesEqual(proof.snapshot,proof.project)){unverifiedWriteRoots.delete(proof);','WRITE_WALK_ROOT_BYTES_ORACLE']
});
export async function verifyWriteWalkCountFaults({source=fs.readFileSync(new URL('./project-store.js',import.meta.url),'utf8')}={}){
 const faults=[];
 for(const [fault,[before,after,oracle]]of Object.entries(WRITE_WALK_FAULTS)){
  await assert.rejects(()=>verifyWriteWalkCounts({source:replaceOnce(source,before,after)}),error=>error.code==='ERR_ASSERTION'&&error.message.includes(oracle),'WRITE_WALK_INTENDED_FAULT_ORACLE '+fault);
  faults.push({fault,oracle,detected:true});
 }
 return {passed:true,faults};
}
// The one-walk pair check against the original two-walk expression,
// checkpointPairMatches(proof,proof.snapshot), on fresh fixtures per
// implementation: same result or same thrown error, and the same root getter
// calls. Proxies here answer every inspection consistently.
const functionText=(source,start)=>{const first=source.indexOf(start);assert.ok(first>=0&&source.indexOf(start,first+1)<0,'WRITE_WALK_PAIR_OWNER_ORACLE: '+start);const last=source.indexOf('\n}\n',first);return source.slice(first,last+3);};
export function verifyDigestPairSelfMatch({source=fs.readFileSync(new URL('./project-store.js',import.meta.url),'utf8')}={}){
 const section=source.slice(source.indexOf('function verifiedGraphNodes('),source.indexOf('const VERIFIED_PROJECT_INTEGRITY='));
 const owners=[functionText(source,'function checkpointPairMatches(proof,project){'),functionText(source,'function checkpointPairSnapshotMatches(proof){')].join('');
 const load=()=>new Function('clone',`const canonicalProject=project=>{const copy={...project};delete copy.projectSha256;return copy;};const checkpointDigestPairs=new WeakSet(),primitiveState={current:true};const rootDigestPrimitivesUnchanged=primitive=>primitive===primitiveState&&primitiveState.current;${section}${owners};return {checkpointDigestPairs,primitiveState,original:proof=>checkpointPairMatches(proof,proof.snapshot),candidate:checkpointPairSnapshotMatches};`)(value=>structuredClone(value));
 const fixtures={
  'shared-aliases':()=>{const shared=[1,{deep:'x'}];return {snapshot:{job:{JOB_ID:'J'},projectData:{a:shared,b:shared},n:Number.NaN,z:-0}};},
  'own-project-digest':()=>({snapshot:{job:{},projectSha256:'0'.repeat(64)}}),
  'unregistered-pair':()=>({snapshot:{job:{}},register:false}),
  'changed-primitives':()=>({snapshot:{job:{}},primitives:false}),
  'root-accessor':state=>({snapshot:Object.defineProperty({job:{}},'stages',{get(){state.getters++;return {};},enumerable:true,configurable:true})}),
  'root-throwing-accessor':state=>({snapshot:Object.defineProperty({job:{}},'stages',{get(){state.getters++;throw new RangeError('ROOT_GETTER');},enumerable:true,configurable:true})}),
  'root-self-replacing-accessor':state=>{const snapshot={job:{}};Object.defineProperty(snapshot,'stages',{get(){state.getters++;Object.defineProperty(snapshot,'stages',{value:{replaced:true},enumerable:true,writable:true,configurable:true});return {replaced:false};},enumerable:true,configurable:true});return {snapshot};},
  'root-self-replacing-equal-accessor':state=>{const snapshot={job:{}};Object.defineProperty(snapshot,'stages',{get(){state.getters++;Object.defineProperty(snapshot,'stages',{value:{same:[1]},enumerable:true,writable:true,configurable:true});return {same:[1]};},enumerable:true,configurable:true});return {snapshot};},
  'root-hidden':()=>({snapshot:Object.defineProperty({job:{}},'hidden',{value:1,enumerable:false})}),
  'root-symbol':()=>({snapshot:{job:{},[Symbol('extra')]:1}}),
  'root-null-prototype':()=>({snapshot:Object.assign(Object.create(null),{job:{a:1}})}),
  'nested-accessor':state=>({snapshot:{job:Object.defineProperty({},'x',{get(){state.getters++;return 1;},enumerable:true})}}),
  'nested-symbol':()=>({snapshot:{job:{[Symbol('extra')]:1}}}),
  'nested-cycle':()=>{const job={};job.self=job;return {snapshot:{job}};},
  'nested-root-cycle':()=>{const snapshot={job:{}};snapshot.job.root=snapshot;return {snapshot};},
  'nested-function':()=>({snapshot:{job:{run(){}}}}),
  'nested-array-extra-key':()=>({snapshot:{job:Object.assign([1,2],{extra:true})}}),
  'nested-consistent-proxy':()=>({snapshot:{job:new Proxy({a:1},{})}}),
  'nested-throwing-proxy':()=>({snapshot:{job:new Proxy({a:1},{ownKeys(){throw new TypeError('NESTED_TRAP');}})}})
 };
 const cases=[];
 for(const [name,make]of Object.entries(fixtures)){
  const observations=[];
  for(const implementation of ['original','candidate']){
   const api=load(),state={getters:0},fixture=make(state),proof={primitive:fixture.primitives===false?{}:api.primitiveState,snapshot:fixture.snapshot};if(fixture.register!==false)api.checkpointDigestPairs.add(proof);
   let result,error;try{result=api[implementation](proof);}catch(caught){error={name:caught.name,message:caught.message};}
   observations.push({result,error,getters:state.getters});
  }
  assert.deepEqual(observations[1],observations[0],'WRITE_WALK_PAIR_SELF_MATCH_ORACLE: '+name);
  cases.push({name,...observations[1]});
 }
 for(const name of ['shared-aliases','root-self-replacing-equal-accessor'])assert.equal(cases.find(row=>row.name===name).result,true,'WRITE_WALK_PAIR_SELF_MATCH_FIXTURE_ORACLE: '+name);
 return {passed:true,caseCount:cases.length,cases};
}
if(import.meta.url===`file://${process.argv[1]}`){
 const report={writeWalkCounts:await verifyWriteWalkCounts(),digestPairSelfMatch:verifyDigestPairSelfMatch()};
 if(process.argv.includes('--faults'))report.writeWalkCountFaults=await verifyWriteWalkCountFaults();
 console.log(JSON.stringify(report));
}

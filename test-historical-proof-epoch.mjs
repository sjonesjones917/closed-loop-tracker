import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {recordProposal,evidence,boundedSearchProposal,registerFixtureSourceSearchCapability} from './test-fixtures.mjs';
import {artifactFixtureId} from './test-artifact-fixtures.mjs';

const canonicalIssue='Application-derived canonical proof fields do not match deterministic recalculation.';
const observationIssue='Application projection observations require a current refresh.';
const sha=value=>createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const marker='HISTORICAL_PROOF_EPOCH_ORACLE';

// This is a current, accepted synthetic fixture, not a retained legacy project.
// Its non-per-run test becomes executable at Stage 7. Expiry returns the job to
// Stage 2, so the application recalculates different canonical proof reasons.
function currentFixture(runtime){
  const source=fs.readFileSync('stage19-fixture.mjs','utf8');
  const start=source.indexOf('export function buildUnchangedConfirmationFixture(');
  const end=source.indexOf('complete(6);',start)+'complete(6);'.length;
  assert(start>=0&&source.split('complete(6);').length===2,marker+': fixture prefix');
  const original=source.slice(start,end);
  const before='EARLIEST_EXECUTABLE_STAGE:12,REQUIRED_BY_STAGE:12,PER_RUN_REQUIRED:true';
  const after='EARLIEST_EXECUTABLE_STAGE:7,REQUIRED_BY_STAGE:12,PER_RUN_REQUIRED:false';
  assert.equal(original.split(before).length,2,marker+': fixture timing');
  const code=original.replace('export function','function').replace(before,after)+
    'return p;}\nbuildUnchangedConfirmationFixture("JOB-HISTORICAL-PROOF-EPOCH")';
  Object.assign(runtime,{recordProposal,evidence,boundedSearchProposal,registerFixtureSourceSearchCapability,artifactFixtureId});
  return {project:createVerifierRuntime.loadScript(runtime,code,{filename:'stage19-fixture.mjs:current-stage6-epoch-fixture'}),
    sourceSha256:sha(source),prefixSha256:sha(original),executedSha256:sha(code)};
}

function sourceFunctions(source){
  const start=source.indexOf('function recordedProjectionObservation(');
  const end=source.indexOf('function assertRecoveryCompatibility(',start);
  assert(start>=0&&end>start,marker+': compatibility source');
  return source.slice(start,end);
}

function compatibilityHarness(source,Clock,{validate,receipt}){
  const calls=[];
  const runtime=createVerifierRuntime({Date:Clock,
    validateProjectIntegrity(project,options){calls.push({kind:'full',observedAt:options?.projectionObservedAt});return validate(project,options);},
    closedLoopWorkflowEngine:{validateApplicationProjection(...args){calls.push({kind:'receipt'});return receipt(...args);}}});
  createVerifierRuntime.loadScript(runtime,'const recoveryProjectionBounds=new WeakMap();\n'+sourceFunctions(source)+
    '\nglobalThis.epochCheck={check:historicalProjectionConsistent,bind:(project,bound)=>recoveryProjectionBounds.set(project,bound)};',
    {filename:'project-store.js:exact-recorded-epoch-compatibility'});
  return {api:runtime.epochCheck,calls};
}

export async function verifyHistoricalProofEpoch(){
  const source=fs.readFileSync('project-store.js','utf8'),publicCases=[],boundCases=[],mutants=[];
  let clock=Date.now();
  class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
  const r=projectStoreRuntime({environment:{Date:Clock}}),{store,engine,copy}=r;
  const fixture=currentFixture(r.runtime);
  let current=fixture.project;
  clock=Date.now()+1000;
  engine.recalculate(current);
  assert.equal(store.validateProjectIntegrity(current).valid,true,marker+': current fixture integrity');
  const report=current.projectData.environmentManifests.find(row=>row.source==='EXTERNAL_CAPABILITY_REGISTRATION').fields.EXTERNAL_CLAIMS;
  current=await store.writeProject(current,{expectedProjectRevision:0,createOnly:true,incrementRevision:false});
  const jobId=current.job.JOB_ID,root=(await store.historyList(jobId)).activeId;
  const originalView=copy(await store.readHistoryView(jobId,root));
  const referenceView=copy({activeView:'Workflow',activeStage:7,scrollY:23,drafts:{'#response-draft':{value:'Exact historical é🙂 draft'}}});
  const reference=await store.saveCheckpoint(jobId,{expectedProjectRevision:current.revision,expectedStateSha256:current.projectSha256,view:referenceView});
  const rootKey='recovery:'+jobId+':snapshot:'+root;
  const referenceKey='recovery:'+jobId+':snapshot:'+reference;
  const originalRoot=Buffer.from(await r.rows.get('meta').get(rootKey).value.blob.arrayBuffer());
  const originalReference=Buffer.from(await r.rows.get('meta').get(referenceKey).value.blob.arrayBuffer());
  const backup=await store.exportPackage(jobId),originalBytes=Buffer.from(await (backup.blob||backup).arrayBuffer());
  const originalRaw=plain(current.projectData.rawResponses);
  const retainedFamilies=['requirements','sourceSearchContracts','semanticReviews','expectedVarianceContracts','environmentManifests','acceptedChanges'];
  const retained=Object.fromEntries(retainedFamilies.map(family=>[family,plain(current.projectData[family])]));
  const observedAt=current.stages[2].gate.checkedAt,createdAt=r.rows.get('meta').get(rootKey).value.createdAt;
  const originalRows=[...r.rows].map(([name,rows])=>[name,[...rows].map(([key,value])=>[key,copy(value)])]);
  clock=Date.parse(report.validUntil)+1000;
  const nowChecked=store.validateProjectIntegrity(current);
  assert(nowChecked.issues.includes(canonicalIssue),marker+': actual current canonical proof mismatch');
  assert.equal(store.validateProjectIntegrity(current,{projectionObservedAt:observedAt}).valid,true,marker+': full saved epoch');
  assert.equal(engine.validateApplicationProjection(current,current,{useRetainedObservations:true}).valid,true,marker+': retained receipt');
  assert.equal(engine.gate(current,2).complete,false,marker+': expired authority blocked');
  assert.deepEqual(await store.readHistoryView(jobId,root),originalView,marker+': public root');
  assert.deepEqual(await store.readHistoryView(jobId,reference),referenceView,marker+': public reference');
  publicCases.push({name:'current-proof-expiry-root-and-reference',result:'PASS',canonicalProofMismatch:true,retainedReceiptValid:true,fullSavedEpochValid:true,currentStage2Blocked:true,exactViewsPreserved:true});

  const beforeRefresh=await store.readProject(jobId);
  const refreshed=await store.refreshProjectProjection(jobId,{expectedProjectRevision:beforeRefresh.revision,expectedStateSha256:beforeRefresh.projectSha256});
  assert.equal(refreshed.revision,beforeRefresh.revision+1,marker+': ordinary refresh revision');
  assert.equal(refreshed.stages[2].gate.complete,false,marker+': refreshed authority');
  assert.equal(store.validateProjectIntegrity(refreshed).valid,true,marker+': refreshed integrity');
  assert.deepEqual(plain(refreshed.projectData.rawResponses),originalRaw,marker+': refreshed response bytes');
  for(const family of retainedFamilies)assert.deepEqual(plain(refreshed.projectData[family]),retained[family],marker+': refreshed '+family);
  await assert.rejects(store.refreshProjectProjection(jobId,{expectedProjectRevision:beforeRefresh.revision,expectedStateSha256:beforeRefresh.projectSha256}),error=>error.code==='STALE_PROJECT_REVISION');
  publicCases.push({name:'current-refresh-and-stale-cas',result:'PASS',newRevision:true,currentStage2Blocked:true,currentIntegrityValid:true,rawResponsesPreserved:true,acceptedFamiliesPreserved:true,staleCasRejected:true});

  const restored=(await store.restoreCheckpoint(jobId,root,{expectedProjectRevision:refreshed.revision})).project;
  const destination=projectStoreRuntime({environment:{Date:Clock}});
  const imported=await destination.store.importPackage(backup.blob||backup);
  for(const [owner,project] of [[store,restored],[destination.store,imported]]){
    assert.equal(project.stages[2].gate.complete,false,marker+': restored current authority');
    assert.equal(owner.validateProjectIntegrity(project).valid,true,marker+': restored current integrity');
    assert.deepEqual(plain(project.projectData.rawResponses),originalRaw,marker+': original response bytes');
    for(const family of retainedFamilies)assert.deepEqual(plain(project.projectData[family]),retained[family],marker+': retained '+family);
  }
  assert.deepEqual(Buffer.from(await r.rows.get('meta').get(rootKey).value.blob.arrayBuffer()),originalRoot,marker+': immutable root bytes');
  assert.deepEqual(Buffer.from(await r.rows.get('meta').get(referenceKey).value.blob.arrayBuffer()),originalReference,marker+': immutable reference bytes');
  assert.deepEqual(Buffer.from(await (backup.blob||backup).arrayBuffer()),originalBytes,marker+': immutable backup bytes');
  publicCases.push({name:'restore-and-import-recalculate-current-authority',result:'PASS',restoreValid:true,importValid:true,currentStage2Blocked:true,rawResponsesPreserved:true,acceptedFamiliesPreserved:true,rootBytesPreserved:true,referenceBytesPreserved:true,backupBytesPreserved:true});

  // The exact old whitelist must fail the real public retained-root read.
  const newBlock=" const canonicalProofIssue='"+canonicalIssue+"';\n";
  const start=source.indexOf(newBlock),end=source.indexOf(' if(error.issues.includes(observationIssue)',start);
  assert(start>=0&&end>start,marker+': original whitelist mutant anchor');
  const oldGuard=" if(error?.code!=='PROJECT_INTEGRITY_FAILED'||!error.issues?.length||error.issues.some(issue=>issue!==observationIssue&&!/^Application-derived job field .* does not match deterministic recalculation\\.$|^Stage \\d+ (?:status|derivedData|decision|decisionEvidence|gate) does not match deterministic recalculation\\.$/.test(issue)))return false;\n";
  const reverted=source.slice(0,start)+oldGuard+source.slice(end);
  const prior=projectStoreRuntime({environment:{Date:Clock},sourceOverrides:{'project-store.js':reverted}});
  for(const [name,rows] of originalRows)prior.rows.set(name,new Map(rows.map(([key,value])=>[key,prior.copy(value)])));
  await assert.rejects(prior.store.readHistoryView(jobId,root),error=>error.code==='HISTORY_VERSION_INCOMPATIBLE'&&error.issues?.includes(canonicalIssue),marker+': previous public regression');
  mutants.push({name:'previous-whitelist-rejects-authentic-root',detected:true,oracle:'HISTORY_VERSION_INCOMPATIBLE_CANONICAL_PROOF',actualPublicApi:true});

  const real=compatibilityHarness(source,Clock,{validate:(project,options)=>store.validateProjectIntegrity(project,options),receipt:(...args)=>engine.validateApplicationProjection(...args)});
  const error={code:'PROJECT_INTEGRITY_FAILED',issues:[canonicalIssue,observationIssue]};
  real.api.bind(current,createdAt);
  assert.equal(real.api.check(current,error),true,marker+': exact helper real full proof');
  assert.deepEqual(real.calls,[{kind:'full',observedAt}],marker+': no early receipt shortcut');
  boundCases.push({name:'real-current-project-requires-full-epoch',result:'PASS',accepted:true,fullCalls:1,receiptCalls:0});

  const cases=[
    ['missing-root-bound',undefined,observedAt,false,0],
    ['invalid-root-bound','not-an-instant',observedAt,false,0],
    ['future-root-bound',new Clock(clock+1).toISOString(),observedAt,false,0],
    ['root-before-observation',new Clock(Date.parse(observedAt)-1).toISOString(),observedAt,false,0],
    ['missing-observation',createdAt,undefined,false,0],
    ['invalid-observation',createdAt,'not-an-instant',false,0],
    ['numeric-observation',createdAt,Date.parse(observedAt),false,0],
    ['observation-after-root',createdAt,new Clock(Date.parse(createdAt)+1).toISOString(),false,0],
    ['valid-bounds-invalid-full-epoch',createdAt,observedAt,false,1],
    ['valid-bounds-valid-full-epoch',createdAt,observedAt,true,1]
  ];
  for(const [name,bound,observation,accepted,fullCalls] of cases){
    const h=compatibilityHarness(source,Clock,{validate:()=>({valid:accepted,issues:accepted?[]:['CONTROLLED_FULL_EPOCH_REJECTION']}),receipt:()=>({valid:true,issues:[]})});
    const project={stages:{2:{gate:{checkedAt:observation}}},projectData:{applicationProjection:{}}};
    if(bound!==undefined)h.api.bind(project,bound);
    assert.equal(h.api.check(project,error),accepted,marker+': '+name);
    assert.equal(h.calls.filter(row=>row.kind==='full').length,fullCalls,marker+': '+name+' full dispatch');
    assert.equal(h.calls.filter(row=>row.kind==='receipt').length,0,marker+': '+name+' receipt dispatch');
    boundCases.push({name,result:'PASS',accepted,fullCalls,receiptCalls:0});
  }
  for(const [name,changedError] of [
    ['unknown-extra-issue',{code:'PROJECT_INTEGRITY_FAILED',issues:[canonicalIssue,'CONTROLLED_STATIC_CORRUPTION']}],
    ['wrong-error-code',{code:'OTHER_FAILURE',issues:[canonicalIssue]}],
    ['empty-issue-population',{code:'PROJECT_INTEGRITY_FAILED',issues:[]}]
  ]){
    const h=compatibilityHarness(source,Clock,{validate:()=>({valid:true}),receipt:()=>({valid:true})});
    h.api.bind(current,createdAt);assert.equal(h.api.check(current,changedError),false,marker+': '+name);assert.equal(h.calls.length,0);
    boundCases.push({name,result:'PASS',accepted:false,fullCalls:0,receiptCalls:0});
  }
  for(const [name,change] of [
    ['canonical-input-corruption',project=>{project.projectData.rawResponses[0].sha256='0'.repeat(64);}],
    ['projection-receipt-corruption',project=>{project.projectData.applicationProjection.receipt.outputSha256='0'.repeat(64);}],
    ['projection-definition-mismatch',project=>{project.projectData.applicationProjection.receipt.derivationId='NOT-THE-CURRENT-DEFINITION';}]
  ]){
    const project=copy(current);change(project);const checked=store.validateProjectIntegrity(project,{projectionObservedAt:observedAt});
    assert.equal(checked.valid,false,marker+': actual '+name);
    real.calls.length=0;real.api.bind(project,createdAt);assert.equal(real.api.check(project,error),false,marker+': '+name);
    assert.deepEqual(real.calls,[{kind:'full',observedAt}],marker+': full invalid '+name);
    boundCases.push({name,result:'PASS',accepted:false,fullCalls:1,receiptCalls:0});
  }
  const branch='return observedAt!==null&&validateProjectIntegrity(project,{projectionObservedAt:observedAt}).valid;';
  assert.equal(source.split(branch).length,2,marker+': mandatory full proof anchor');
  for(const [name,replacement,bound] of [
    ['receipt-shortcut-bypass','return globalThis.closedLoopWorkflowEngine.validateApplicationProjection(project,project,{useRetainedObservations:true}).valid;',createdAt],
    ['missing-bound-bypass','return validateProjectIntegrity(project,{projectionObservedAt:project.stages[2].gate.checkedAt}).valid;',undefined]
  ]){
    const h=compatibilityHarness(source.replace(branch,replacement),Clock,{validate:()=>({valid:name==='missing-bound-bypass'}),receipt:()=>({valid:true})});
    if(bound!==undefined)h.api.bind(current,bound);
    assert.equal(h.api.check(current,error),true,marker+': mutant exposed '+name);
    mutants.push({name,detected:true,oracle:name==='receipt-shortcut-bypass'?'INVALID_FULL_EPOCH_MUST_REJECT':'MISSING_BOUND_MUST_REJECT',actualPublicApi:false});
  }
  return {schema:'historical-proof-epoch/1',result:'PASS',synthetic:true,actualBrowser:false,actualApplication:false,realIndexedDB:false,trustedTime:false,
    productionSourceSha256:sha(source),helperSourceSha256:sha(fs.readFileSync(new URL(import.meta.url))),
    fixture:{basis:'CURRENT_STAGE1_THROUGH_STAGE6_ACCEPTANCE_AND_INDEPENDENT_REVIEW',...Object.fromEntries(Object.entries(fixture).filter(([key])=>key!=='project')),
      timingSubstitution:{earliestExecutableStage:{before:12,after:7},perRunRequired:{before:true,after:false},requiredByStage:12},projectBytes:Buffer.byteLength(JSON.stringify(current))},
    publicCases,boundCases,mutants,totals:{publicCases:publicCases.length,boundCases:boundCases.length,mutants:mutants.length}};
}

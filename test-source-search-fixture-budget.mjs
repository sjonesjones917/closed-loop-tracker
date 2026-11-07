import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {stage02AcceptanceFixture} from './test-fixtures.mjs';
import {browserVerificationCatalog} from './verification-evidence-catalog.mjs';

// Exercise the real positive synthetic source-search fixture and production
// freshness boundary. This cannot issue a browser or external-actor receipt.
export function verifySourceSearchFixtureBudget(){
 const oracle='SOURCE_SEARCH_FIXTURE_BUDGET_ORACLE',budgetMs=330*60*1000;
 assert.equal(browserVerificationCatalog['verify-complete-operator-journey.mjs'].timeoutMs,budgetMs,oracle+': approved producer deadline');
 let clock=null;
 class FixtureClock extends Date{
  constructor(...args){super(...(args.length?args:[FixtureClock.now()]));}
  static now(){return clock??Date.now();}
 }
 const runtime=projectStoreRuntime({storageWorker:false,environment:{Date:FixtureClock}}),engine=runtime.engine;
 const fixtureRuntime={engine,core:runtime.core,schema:runtime.runtime.closedLoopWorkflowSchema,prompts:runtime.runtime.closedLoopPromptEngine,ingestion:runtime.runtime.closedLoopResponseIngestion};
 const project=stage02AcceptanceFixture(fixtureRuntime,'JOB-SOURCE-SEARCH-BUDGET');
 const contract=engine.recordsForCurrentScope(project,'sourceSearchContracts').at(-1);
 const environment=engine.recordsForCurrentScope(project,'environmentManifests').find(row=>row.source==='EXTERNAL_CAPABILITY_REGISTRATION');
 const report=engine.recordValue(environment,'EXTERNAL_CLAIMS'),until=Date.parse(report.validUntil),issued=Date.parse(report.observedAt)+1000;
 const assertHorizon=value=>assert.equal(Date.parse(value.validUntil)-issued,budgetMs,oracle+': positive fixture covers the approved finite journey');
 assertHorizon(report);
 assert.equal(engine.sourceSearchCapabilityState(project,contract).complete,true,oracle+': registered control');
 const retained=runtime.runtime.closedLoopHash.stableStringify(project.projectData);
 const cases=[];
 for(const [name,instant,ready]of [['last-valid-millisecond',until-1,true],['at-expiry',until,false],['after-expiry',until+1,false]]){
  clock=instant;
  assert.equal(engine.sourceSearchCapabilityState(project,contract).complete,ready,oracle+': '+name);
  if(ready)assert.equal(engine.validateExternalCapabilityEvidence(project,report).ready,true,oracle+': still current');
  else assert.throws(()=>engine.validateExternalCapabilityEvidence(project,report),/future expiry time/,oracle+': expired report must fail');
  cases.push({case:name,result:'PASS',capabilityReady:ready});
 }
 assert.equal(runtime.runtime.closedLoopHash.stableStringify(project.projectData),retained,oracle+': freshness checks retain exact authority');
 const former={...report,validUntil:new Date(issued+240*60*1000).toISOString()};
 assert.throws(()=>assertHorizon(former),error=>error.code==='ERR_ASSERTION'&&error.message.includes(oracle));
 return {sourceSearchFixtureBudget:'PASS',synthetic:true,actualBrowser:false,externalActorExecuted:false,eligibleReceiptCreated:false,productionFreshnessExecuted:true,budgetMs,cases,former240mDetected:true,exactAuthorityPreserved:true};
}

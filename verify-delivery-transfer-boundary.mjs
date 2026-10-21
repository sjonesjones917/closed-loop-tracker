import {checkedVerifier,runVerifier,suiteTimeoutMs} from './verify-conformance-regressions.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {projectStoreRuntime,hydrateRetainedPromptContexts} from './test-project-store-runtime.mjs';
import {DELIVERY_CASE_GROUPS,assertRetainedPromptContextCustody,deliverySourceHashes,validateDeliveryWorkerResult,aggregateDeliveryWorkers} from './test-delivery-receipt-cases.mjs';

const ownerStartedAt=Math.floor(performance.timeOrigin),ownerTimeoutMs=suiteTimeoutMs('verify-delivery-transfer-boundary.mjs'),deadlineAt=ownerStartedAt+ownerTimeoutMs;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),sourceInputs=deliverySourceHashes();

// Validate the fault target before building the lifecycle fixture. A stale
// target is a verifier setup failure, not a delivery behavior failure.
const appSource=fs.readFileSync('app-core.js','utf8');
const retainedActionFaultTarget='return presentationAction(canonicalCurrentStage());';
assert.equal(appSource.split(retainedActionFaultTarget).length-1,1,'The retained-action fault must alter exactly one display owner.');

async function retainedPromptContextOracle(){
  const r=projectStoreRuntime(),{engine,prompts,core,store,copy}=r,hash=r.runtime.closedLoopHash;
  const p=core.createBlankState('JOB-DELIVERY-CONTEXT-CUSTODY');
  p.job.EXACT_USER_OBJECTIVE_VERBATIM='Preserve this exact historical objective. '.repeat(2100);
  engine.recordHumanInputVersion(p,['EXACT_USER_OBJECTIVE_VERBATIM'],'SYNTHETIC-CONTROL');engine.recalculate(p);
  const first=prompts.reserveAndBuildPromptRecord(p,1,{operation:'COMPLETE'}).prompt,firstFiles=prompts.materializePromptContextFiles(first,p),firstProject=copy(p);
  assert.equal(firstFiles.length,1,'The bounded fixture must create one original manifest-bound context file.');
  p.job.EXACT_USER_OBJECTIVE_VERBATIM='Use this changed current objective instead. '.repeat(2100);
  engine.recordHumanInputVersion(p,['EXACT_USER_OBJECTIVE_VERBATIM'],'SYNTHETIC-CONTROL');engine.recalculate(p);
  const second=prompts.reserveAndBuildPromptRecord(p,1,{operation:'COMPLETE'}).prompt,secondFiles=prompts.materializePromptContextFiles(second,p);
  assert.equal(secondFiles.length,1);
  assert.ok(p.projectData.generatedPrompts.find(record=>record.instructionId===first.instructionId).invalidatedBy,'The actual input change must supersede the original instruction.');
  assert.notEqual(firstFiles[0].sha256,secondFiles[0].sha256);
  const contextFiles=[...firstFiles,...secondFiles],originalArtifactId='PROMPT-CONTEXT-'+hash.sha256Value(copy({jobId:p.job.JOB_ID,sha256:firstFiles[0].sha256}));
  // One controlled hydration fault: retain only current instructions. The
  // ordinary storage validator must reject the missing original dependency.
  await hydrateRetainedPromptContexts(r,p,contextFiles,{omitInvalidated:true});
  await assert.rejects(store.writeProject(copy(p),{expectedProjectRevision:0,createOnly:true}),error=>error.code==='PACKAGE_ARTIFACT_CUSTODY_MISMATCH'&&error.message.includes(originalArtifactId),'RETAINED_PROMPT_CONTEXT_CUSTODY_ORACLE: omitting superseded context must reject checkpoint creation for that exact missing file.');
  assert.equal(await store.readProject(p.job.JOB_ID),null,'Rejected incomplete custody must not commit the project.');
  assert.equal(await store.getArtifact(originalArtifactId),null);
  await hydrateRetainedPromptContexts(r,p,contextFiles);
  assert.equal(await assertRetainedPromptContextCustody(r,p),2);
  const saved=await store.writeProject(copy(p),{expectedProjectRevision:0,createOnly:true});
  assert.ok((await store.historyList(p.job.JOB_ID)).activeId);
  // The normal application saves the first instruction before a later input
  // change. Verify that path without substituting its context materializer.
  const normal=projectStoreRuntime(),initial=await normal.store.writeProject(normal.copy(firstProject),{expectedProjectRevision:0,createOnly:true}),replacement=normal.copy(p);
  const current=await normal.store.writeProject(replacement,{expectedProjectRevision:initial.revision,mutationConfirmation:normal.store.mutationImpact(initial,replacement)});
  assert.equal(await assertRetainedPromptContextCustody(normal,current),2);
  return {name:'preserve original and current instruction context bytes before checkpointing',result:'PASS',savedRevision:saved.revision,normalSequentialRevisions:[initial.revision,current.revision],contextFiles:2,fault:{faultId:'DELIVERY-OMIT-SUPERSEDED-PROMPT-CONTEXT',kind:'CONTROLLED_VERIFIER_HYDRATION_FAULT',caughtBy:'PACKAGE_ARTIFACT_CUSTODY_MISMATCH',result:'DETECTED',productionSourceUnchanged:true},environment:'Production prompt/invalidation builders and persistence with shared transaction adapter; fixed synthetic inputs, no external execution or physical delivery asserted'};
}
const retainedContextCase=await retainedPromptContextOracle();
if(process.argv.includes('--context-custody-only')){
  console.log(JSON.stringify({deliveryTransferBoundary:'PASS',basis:'BOUNDED_SYNTHETIC_CONTEXT_PERSISTENCE',cases:[retainedContextCase]},null,2));
  process.exit(0);
}

// Admit all three worker lanes together or fail before the expensive prefix.
// Three visible CPUs are a scheduling floor, not a promise of runtime fit.
// Available memory is observed, not an unmeasured acceptance requirement; the
// unchanged outer owner deadline remains authoritative under contention.
const capacity={parallelism:os.availableParallelism(),availableMemory:process.availableMemory()};
assert.ok(capacity.parallelism>=3,'DELIVERY_THREE_LANE_CAPACITY_ORACLE: three visible CPUs are required: '+JSON.stringify(capacity));
process.stderr.write('delivery: parallel worker capacity observation '+JSON.stringify(capacity)+'\n');
const controller=new AbortController(),onTerm=()=>controller.abort('SIGTERM'),onInt=()=>controller.abort('SIGINT');
process.on('SIGTERM',onTerm);process.on('SIGINT',onInt);
const remaining=()=>{const ms=deadlineAt-Date.now()-5000;assert.ok(ms>0&&!controller.signal.aborted,'DELIVERY_OWNER_DEADLINE_ORACLE');return ms;};
const deadline=setTimeout(()=>controller.abort('DELIVERY_OWNER_TIMEOUT'),Math.max(1,deadlineAt-Date.now()));
const fixtureDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'delivery-transfer-'));
let workerPromises=[];
try{
const source=fs.readFileSync('verify-full-cycle.mjs','utf8'),anchor=source.indexOf('engine.recordDeliveryAttempt(p');
assert.ok(anchor>0);
const capture=path.join(fixtureDirectory,'fixture.json'),script=path.resolve(`.delivery-transfer-${process.pid}.mjs`);
// Capture historical context bytes when their authoritative producer creates
// each instruction. They cannot be regenerated from a later project version.
const captureContext=`
const retainedContextFiles=new Map(),fixturePromptOwner=globalThis.closedLoopPromptEngine;
function retainContext(record,project){for(const file of fixturePromptOwner.materializePromptContextFiles(record,project))retainedContextFiles.set(file.sha256,file);}
globalThis.closedLoopPromptEngine=Object.freeze({...fixturePromptOwner,
  buildPromptRecord(...args){const record=fixturePromptOwner.buildPromptRecord(...args);retainContext(record,args[1]);return record;},
  reserveAndBuildPromptRecord(...args){const result=fixturePromptOwner.reserveAndBuildPromptRecord(...args);retainContext(result.prompt,args[0]);return result;}
});
`;
const fixturePrefix=source.slice(0,anchor).replace('const core=globalThis.closedLoopCore',captureContext+'const core=globalThis.closedLoopCore');
assert.ok(fixturePrefix.includes(captureContext),'The lifecycle fixture must capture context at generation time.');
// Retain the unexecuted suffix so its hoisted helpers remain available to the prefix.
fs.writeFileSync(script,fixturePrefix+`fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify({project:p,artifacts:await captureArtifactFixture(byteStore,p.job.JOB_ID),contextFiles:[...retainedContextFiles.values()]}));process.exit(0);`+source.slice(anchor));
  // The genuine lifecycle runs once, with its original 60-minute cap. Its
  // generated source is removed as soon as that supervised child settles.
  try{await checkedVerifier(process.execPath,[script],{stdio:'pipe',timeout:Math.min(3600000,remaining()),maxBuffer:64*1024*1024,signal:controller.signal});}
  finally{fs.rmSync(script,{force:true});}
  const fixtureBytes=fs.readFileSync(capture);
  fs.chmodSync(capture,0o400);
  const binding={deadlineAt,fixture:{path:capture,sha256:sha(fixtureBytes),byteLength:fixtureBytes.length},sourceInputs};
  assert.deepEqual(deliverySourceHashes(),sourceInputs,'DELIVERY_PREFIX_SOURCE_RESTORATION_ORACLE');
  // Only these three source-bound groups run. The coordinator stays idle so
  // process-owner timers and stdout/stderr drains cannot be starved by cases.
  workerPromises=Object.keys(DELIVERY_CASE_GROUPS).map(async group=>{
    let result;
    try{result=await runVerifier(process.execPath,['test-delivery-receipt-cases.mjs','--group='+group],{stdio:'pipe',timeout:remaining(),maxBuffer:64*1024*1024,signal:controller.signal,input:JSON.stringify(binding)});
    // A complete ordinary case FAIL remains a result; siblings still finish.
    // Only malformed, unbound, or interrupted work aborts the other groups.
    validateDeliveryWorkerResult(result,group,binding);return result;}
    catch(error){controller.abort('DELIVERY_WORKER_FAILED');throw Object.assign(error,{workerGroup:group,workerResult:result});}
  });
  const outcomes=await Promise.allSettled(workerPromises),failures=outcomes.filter(row=>row.status==='rejected');
  if(failures.length)throw new AggregateError(failures.map(row=>row.reason),'DELIVERY_WORKER_JOIN_ORACLE: '+failures.map(row=>row.reason.message).join(' | '));
  const {cases,faults}=aggregateDeliveryWorkers(retainedContextCase,outcomes.map(row=>row.value),binding);
  assert.ok(!controller.signal.aborted&&Date.now()<deadlineAt,'DELIVERY_OWNER_DEADLINE_ORACLE');
  assert.deepEqual(deliverySourceHashes(),sourceInputs,'DELIVERY_OWNER_SOURCE_RESTORATION_ORACLE');
  assert.equal(sha(fs.readFileSync(capture)),binding.fixture.sha256,'DELIVERY_OWNER_FIXTURE_RESTORATION_ORACLE');
console.log(JSON.stringify({deliveryTransferBoundary:cases.every(c=>c.result==='PASS')?'PASS':'FAIL',basis:'SYNTHETIC_PRODUCTION_LIFECYCLE',specificationSections:['36.11','36.12','38','50.1'],sourceIdentity:{engineSha256:sha(fs.readFileSync('workflow-engine.js','utf8')),verifierSha256:sha(fs.readFileSync('verify-delivery-transfer-boundary.mjs','utf8'))},faults,cases},null,2));
if(cases.some(c=>c.result!=='PASS'))process.exitCode=1;
}finally{
  // Join every launched process before deleting its immutable input. The
  // existing supervisor owns termination, grace, process trees, and pipe files.
  controller.abort('DELIVERY_OWNER_CLEANUP');
  await Promise.allSettled(workerPromises);
  clearTimeout(deadline);process.removeListener('SIGTERM',onTerm);process.removeListener('SIGINT',onInt);
  fs.rmSync(fixtureDirectory,{recursive:true,force:true});
}

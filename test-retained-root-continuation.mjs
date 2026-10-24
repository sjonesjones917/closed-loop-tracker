import fs from 'node:fs';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';

// Exact observers expose private proof mutation only in this isolated fixture.
// The production API has no proof/certificate option.
export async function verifyRetainedRootContinuation({fault=null,caseFilter=null}={}){
 const original=fs.readFileSync('project-store.js','utf8');let source=original;
 if(fault==='repeat-root-computations'){const before='const reuse=rootPreparation&&usableRootContinuation';assert.equal(source.split(before).length,2);source=source.replace(before,'const reuse=false&&rootPreparation&&usableRootContinuation');}
 if(fault==='skip-preparation-requalification'){const before='if(reuse&&decoded.project===reuse.project&&!rootQualified)throw storageError';assert.equal(source.split(before).length,2);source=source.replace(before,'if(false)throw storageError');}
 const anchors={restore:'async function restoreHistoryProject(body,readFile,verifiedParts=new Map(),verifiedByteDigests=null){',digest:'function historyProjectDigests(project){',static:'function assertProjectIntegrity(project,options){',derived:'function derivedProjectIntegrityIssues(project,{verifyCachedProjection=true,projectionObservedAt=null,verifyProjection=true}={}){'};
 for(const [name,anchor] of Object.entries(anchors)){assert.equal(source.split(anchor).length,2);source=source.replace(anchor,anchor+`globalThis.__rootCounts.${name}++;`);}
 const exportAnchor='globalThis.closedLoopProjectStore=Object.freeze({STORAGE_IO_TIMEOUT_MS';assert.equal(source.split(exportAnchor).length,2);
 source=source.replace(exportAnchor,'globalThis.__rootProof=()=>recentOperationalCommitRead?.retainedRoot;globalThis.__rootPrivateRead=readProjectForTransaction;'+exportAnchor);
 const qualify='      const rootQualified=';assert.equal(source.split(qualify).length,2);source=source.replace(qualify,'      globalThis.__mutateRootPreparation?.(decoded.project,project);\n'+qualify);
 const cases=[];
 for(const mode of ['valid-two-warm-views','wrong-work-proof','wrong-project-proof','wrong-root-descriptor','mutated-root-value','mutated-root-snapshot','changed-generator-dispatch','changed-encoder-dispatch','public-read-cold','one-use-private-read','unchanged-view-drops-certificate','failed-save-cold-fallback','root-mutation-during-preparation','source-mutation-during-preparation','primitive-mutation-during-preparation']){
  if(caseFilter&&!caseFilter.includes(mode))continue;
  const r=projectStoreRuntime({sourceOverrides:{'project-store.js':source},environment:{__rootCounts:{restore:0,digest:0,static:0,derived:0}},storageWorker:false});
  let p=await r.store.createProject({commandId:'PRIVATE-ROOT-'+mode});p.job.JOB_TITLE='Exact retained title '+'independent retained content '.repeat(300);r.engine.recalculate(p);p=await r.store.writeProject(p,{expectedProjectRevision:p.revision});await r.store.readProject(p.job.JOB_ID);
  const view=name=>r.copy({activeStage:1,activeView:name,drafts:{'#exact':{value:name+' exact draft'}},scrollX:0,scrollY:17});
  const save=name=>r.store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,view:view(name)});
  await save('Project');const proof=r.runtime.__rootProof();assert.ok(proof,'Cold successful commit mints private exact root computations');const before={...r.runtime.__rootCounts};
  if(mode==='wrong-work-proof')proof.workSha256='0'.repeat(64);
  if(mode==='wrong-project-proof')proof.projectSha256='0'.repeat(64);
  if(mode==='wrong-root-descriptor')proof.descriptor.label='Unrelated immutable root';
  if(mode==='mutated-root-value')proof.project.job.JOB_TITLE='Caller mutation of private retained value';
  if(mode==='mutated-root-snapshot')proof.snapshot.job.JOB_TITLE='Changed private proof snapshot';
  let dispatch,encoderDispatch;
  if(mode==='changed-generator-dispatch'){const proto=Object.getPrototypeOf(r.runtime.closedLoopHash.canonicalChunks(null));dispatch=Object.getOwnPropertyDescriptor(proto,'next');Object.defineProperty(proto,'next',{value:function(){return Object.getPrototypeOf(Object.getPrototypeOf(this)).next.call(this);},configurable:true});}
  if(mode==='changed-encoder-dispatch'){encoderDispatch=Object.getOwnPropertyDescriptor(r.runtime.TextEncoder.prototype,'encode');Object.defineProperty(r.runtime.TextEncoder.prototype,'encode',{...encoderDispatch,value:function(text){return encoderDispatch.value.call(this,text);}});}
  if(mode==='public-read-cold')await r.store.readProject(p.job.JOB_ID);
  if(mode==='one-use-private-read')await r.runtime.__rootPrivateRead(p.job.JOB_ID);
  if(mode==='unchanged-view-drops-certificate'){await save('Project');assert.equal(r.runtime.__rootProof(),undefined,'Ordinary no-append owner cannot republish root proof without final dependency gate');}
  if(mode==='failed-save-cold-fallback'){const snapshot=r.copy([...r.rows].map(([name,rows])=>[name,[...rows]]));r.runtime.__closedLoopStorageFault='during-history-write';await assert.rejects(()=>save('Workflow'),e=>e.code==='INJECTED_STORAGE_FAILURE');delete r.runtime.__closedLoopStorageFault;assert.deepEqual(r.copy([...r.rows].map(([name,rows])=>[name,[...rows]])),snapshot);assert.equal(r.runtime.__rootProof(),undefined,'Failed save publishes no continuation');}
  if(mode.endsWith('during-preparation')){
   const snapshot=r.copy([...r.rows].map(([name,rows])=>[name,[...rows]]));let reached=false;
   r.runtime.__mutateRootPreparation=(root,sourceProject)=>{reached=true;delete r.runtime.__mutateRootPreparation;if(mode==='root-mutation-during-preparation')root.job.JOB_TITLE='Changed deferred root';if(mode==='source-mutation-during-preparation')sourceProject.job.JOB_TITLE='Changed current source';if(mode==='primitive-mutation-during-preparation')r.runtime.closedLoopHash.canonicalChunks.extra='changed during preparation';};
   await assert.rejects(()=>save('Workflow'),e=>e.code==='HISTORY_VERSION_MISMATCH','Deferred warm validation cannot escape into ordinary commit');delete r.runtime.closedLoopHash.canonicalChunks.extra;assert.equal(reached,true);assert.deepEqual(r.copy([...r.rows].map(([name,rows])=>[name,[...rows]])),snapshot);assert.equal(r.runtime.__rootProof(),undefined);cases.push({mode,result:'PASS',noCheckpointReturned:true,noProofPublished:true,exactStatePreserved:true});continue;
  }
  const id=await save('Workflow'),after={...r.runtime.__rootCounts},difference=Object.fromEntries(Object.entries(after).map(([key,value])=>[key,value-before[key]]));
  if(mode==='valid-two-warm-views'){assert.equal(difference.restore,0,'RETAINED_ROOT_WARM_RESTORE_ORACLE');assert.equal(difference.digest,0,'RETAINED_ROOT_WARM_DIGEST_ORACLE');assert.equal(difference.static,1);assert.equal(difference.derived,1);const start={...after};await save('Records');assert.equal(r.runtime.__rootCounts.restore,start.restore,'RETAINED_ROOT_WARM_RESTORE_ORACLE');assert.equal(r.runtime.__rootCounts.digest,start.digest,'RETAINED_ROOT_WARM_DIGEST_ORACLE');assert.equal(r.runtime.__rootCounts.static,start.static+1);assert.equal(r.runtime.__rootCounts.derived,start.derived+1);}
  else {assert.ok(difference.restore>=1,'Invalid/consumed certificate uses independent cold reconstruction: '+mode);assert.ok(difference.digest>=1,'Invalid/consumed certificate measures both digests independently: '+mode);}
  if(mode==='changed-generator-dispatch'){const proto=Object.getPrototypeOf(r.runtime.closedLoopHash.canonicalChunks(null));if(dispatch)Object.defineProperty(proto,'next',dispatch);else delete proto.next;}
  if(mode==='changed-encoder-dispatch')Object.defineProperty(r.runtime.TextEncoder.prototype,'encode',encoderDispatch);
  assert.equal((await r.store.readHistoryView(p.job.JOB_ID,id)).drafts['#exact'].value,'Workflow exact draft');assert.equal((await r.store.readProject(p.job.JOB_ID)).job.JOB_TITLE,p.job.JOB_TITLE);
  cases.push({mode,result:'PASS',counts:difference,exactDraftAndProjectPreserved:true});
 }
 return {status:'PASS',fault,cases,sourceSha256:createHash('sha256').update(original).digest('hex'),boundary:'Small actual production store through explicit transaction adapter; native transaction lifetime is verified separately'};
}
if(process.argv[1]?.endsWith('test-retained-root-continuation.mjs')){const start=performance.now();const result=await verifyRetainedRootContinuation();result.elapsedMs=performance.now()-start;const output=JSON.stringify(result,null,2)+'\n';if(process.env.RETAINED_ROOT_REPORT_PATH)fs.writeFileSync(process.env.RETAINED_ROOT_REPORT_PATH,output);console.log(output);}

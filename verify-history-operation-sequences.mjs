import assert from 'node:assert/strict';
import {storeRuntime} from './test-store-runtime.mjs';

const cases=[],seeds=[1,7,19,37,73,109,151,211],depth=24;
const alphabet=['SAVE','RESTORE','NAVIGATE','RELOAD','CONCURRENT_SAVE','FAILED_SAVE','ABANDONED_RESTORE','FAILED_RESTORE'];
for(const seed of seeds){
  const r=storeRuntime(),{store,engine,core,copy,hash,runtime}=r,jobId='GENERATED-HISTORY-'+seed;
  let p=core.createBlankState(jobId);engine.ensureShape(p);engine.recalculate(p);p=await store.writeProject(p,{expectedProjectRevision:0});
  const start=await store.ensureHistoryCheckpoint(jobId,{sessionId:'SESSION',expectedProjectRevision:p.revision}),known=new Map([[start.versionId,p.job.JOB_TITLE]]),sequence=[];
  let random=seed;const nextRandom=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random;};
  for(let step=0;step<depth;step++){
    const operation=alphabet[nextRandom()%alphabet.length],before=p.projectSha256,directory=await store.listSavedVersions(jobId),destination=directory.versionIds[nextRandom()%directory.versionIds.length],stage=nextRandom()%r.schema.STAGE_COUNT+1;
    const input={operation,stage,destination,revision:p.revision};sequence.push(input);
    try{
      if(operation==='SAVE'){
        const next=copy(p);next.job.JOB_TITLE=`Continuation ${seed}/${step}`;p=await store.replaceProject(next,{expectedProjectRevision:p.revision});known.set('SAVED-'+p.projectSha256,p.job.JOB_TITLE);
      }else if(operation==='RESTORE'){
        const expected=await store.readSavedVersion(jobId,destination);
        p=await store.activateSavedVersion(jobId,destination,{expectedProjectRevision:p.revision});assert.equal(p.job.JOB_TITLE,expected.project.job.JOB_TITLE);
      }else if(operation==='NAVIGATE'){
        const view=copy({versionId:directory.activeVersionId,view:'Workflow',stage,scrollY:step*17,drafts:{'#operator-label':{value:'Draft '+step,checked:false,selectionStart:null,selectionEnd:null}},openDetails:[]});
        await store.saveHistoryView(jobId,'ENTRY-'+step,view);assert.equal((await store.readProject(jobId)).projectSha256,before,'Stage selection changed the working version');assert.equal((await store.readHistoryView(jobId,'ENTRY-'+step)).stage,stage);
      }else if(operation==='RELOAD'){
        p=await store.readProject(jobId);assert.equal(p.projectSha256,before);
      }else if(operation==='CONCURRENT_SAVE'){
        const copies=['first','second'].map(label=>{const next=copy(p);next.job.JOB_TITLE=`Concurrent ${seed}/${step}/${label}`;return next;});
        const results=await Promise.allSettled(copies.map(next=>store.replaceProject(next,{expectedProjectRevision:p.revision})));
        assert.equal(results.filter(row=>row.status==='fulfilled').length,1,'CAS_ORACLE: concurrent edits did not have exactly one winner');
        assert.equal(results.find(row=>row.status==='rejected').reason.code,'STALE_PROJECT_REVISION');p=await store.readProject(jobId);known.set('SAVED-'+p.projectSha256,p.job.JOB_TITLE);
      }else if(operation==='FAILED_SAVE'){
        const next=copy(p);next.job.JOB_TITLE='Uncommitted '+step;runtime.__closedLoopStorageFault='during-project-write';
        await assert.rejects(store.replaceProject(next,{expectedProjectRevision:p.revision}),error=>error.code==='INJECTED_STORAGE_FAILURE');runtime.__closedLoopStorageFault=null;
      }else if(operation==='ABANDONED_RESTORE'){
        const controller=new AbortController();controller.abort();await assert.rejects(store.activateSavedVersion(jobId,destination,{expectedProjectRevision:p.revision,signal:controller.signal}),error=>error.code==='HISTORY_RESTORE_SUPERSEDED');
      }else if(operation==='FAILED_RESTORE'){
        runtime.__closedLoopStorageFault='before-history-restore-commit';await assert.rejects(store.activateSavedVersion(jobId,destination,{expectedProjectRevision:p.revision}),error=>error.code==='INJECTED_STORAGE_FAILURE');runtime.__closedLoopStorageFault=null;
      }
      if(['FAILED_SAVE','ABANDONED_RESTORE','FAILED_RESTORE'].includes(operation))assert.equal((await store.readProject(jobId)).projectSha256,before,'A failed operation changed working data');
      assert.equal((await store.readProject(jobId)).projectSha256,p.projectSha256,'Active working data and persisted data differ');
      const after=await store.listSavedVersions(jobId);assert(after.versionIds.includes(start.versionId),'Session start was lost');
      for(const versionId of known.keys())assert(after.versionIds.includes(versionId),'An alternative continuation was discarded');
      cases.push({caseId:`history-seed-${seed}-step-${step}`,input,activeVersionId:after.activeVersionId,result:'PASS'});
    }catch(error){error.message=`Generated history sequence failed: ${JSON.stringify(sequence)}\n${error.message}`;throw error;}
  }
  const backup=await store.exportPackage(jobId),fresh=storeRuntime();await fresh.store.importPackage(backup);
  for(const [versionId,title] of known)assert.equal((await fresh.store.readSavedVersion(jobId,versionId)).project.job.JOB_TITLE,title);
  cases.push({caseId:`history-seed-${seed}-backup-retained-alternatives`,versionsCompared:known.size,backupSha256:await hash.sha256Bytes(backup),result:'PASS'});
}
console.log(JSON.stringify({generatedHistorySequences:'PASS',synthetic:true,environment:'Node; production persistence with serialized transaction I/O double',bounds:{seeds,depth,alphabet,caseCount:cases.length,assumptions:['One project per sequence; two concurrent writers for CAS operations.','External acceptance and actual browser navigation are separate suites.','The random generator is deterministic; all executed inputs are recorded.']},cases}));

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {storeRuntime} from './test-store-runtime.mjs';

const cases=[],faults=[];
function contextOracle(runtime){
  const {core,engine,prompts,schema,hash,copy}=runtime;
  for(let target=1;target<=schema.STAGE_COUNT;target++){
    const project=core.createBlankState('CONTEXT-'+target);engine.ensureShape(project);
    const allowed=[];
    for(let origin=1;origin<=schema.STAGE_COUNT;origin++){
      const id='EVIDENCE-ORIGIN-'+origin;
      project.projectData.evidenceRecords.push(copy({id,stage:origin,active:true,fields:{EVIDENCE_ID:id,APPLICATION_EVIDENCE_CONTENT:'Origin '+origin},scope:{}}));
      if(origin<=target)allowed.push(id);
    }
    if(target<schema.STAGE_COUNT){
      const futureId='EVIDENCE-ORIGIN-'+(target+1);
      // Direct fields, metadata, and multi-hop copied summaries are distinct
      // paths. These sentinels establish projection behavior, not valid gates.
      project.projectData.evidenceRecords.push(copy({id:'EVIDENCE-COPIED',stage:target,fields:{EVIDENCE_ID:'EVIDENCE-COPIED',APPLICATION_EVIDENCE_CONTENT:futureId}}));
      project.projectData.evidenceRecords.push(copy({id:'EVIDENCE-INDIRECT',stage:target,fields:{EVIDENCE_ID:'EVIDENCE-INDIRECT',APPLICATION_EVIDENCE_CONTENT:'EVIDENCE-COPIED'}}));
      project.projectData.evidenceRecords.push(copy({id:'EVIDENCE-METADATA',stage:target,sourceRef:futureId,fields:{EVIDENCE_ID:'EVIDENCE-METADATA'}}));
      project.stages[target].agentData=copy({COPIED_RESULT:futureId});
      project.savedHistory=copy({retainedLaterResult:futureId});
    }
    const before=hash.sha256Value(project),bounded=prompts.stageContextProjection(project,target),ids=bounded.projectData.evidenceRecords.map(row=>row.id);
    assert.deepEqual(Array.from(ids),allowed,'CONTEXT_ORACLE: later information survived the stage projection');
    assert(!bounded.savedHistory,'CONTEXT_ORACLE: restoration history reached an agent context');
    if(target<schema.STAGE_COUNT)assert(!JSON.stringify(bounded.stages).includes('EVIDENCE-ORIGIN-'+(target+1)),'CONTEXT_ORACLE: copied stage material crossed the boundary');
    assert.equal(hash.sha256Value(project),before,'CONTEXT_ORACLE: selecting a stage mutated working data');
  }
}
const app=fs.readFileSync('app-core.js','utf8'),formatSource=app.slice(app.indexOf('function affectedStageList('),app.indexOf('let responseActionFailure='));
const ui=vm.createContext({replacementRequest:null,esc:value=>String(value)});vm.runInContext(formatSource,ui);
function expandStages(text){return text?text.split(', ').flatMap(part=>{const [a,b=a]=part.split('–').map(Number);return Array.from({length:b-a+1},(_,index)=>a+index);}):[];}
for(let first=1;first<=30;first++)for(let last=first;last<=30;last++){
  const selected=first===last?[first]:[first,last];
  assert.deepEqual(expandStages(ui.affectedStageList(selected)),selected,'CONFIRMATION_TEXT_ORACLE: unaffected stages appeared in replacement impact');
  cases.push({caseId:`impact-wording-${first}-${last}`,stages:selected,result:'PASS'});
}
contextOracle(storeRuntime());cases.push({caseId:'stage-context-all-stages-direct-metadata-and-transitive-copies',stages:30,result:'PASS'});
const contextFault={file:'prompt-engine.js',before:'const projected=cloneContext(state),futureIds=new Set();',after:'return state; const projected=cloneContext(state),futureIds=new Set();'};
assert.throws(()=>contextOracle(storeRuntime({sourceFault:contextFault})),/CONTEXT_ORACLE/,'Context bypass escaped its behavioral oracle');
contextOracle(storeRuntime());faults.push({faultId:'BYPASS-STAGE-CONTEXT',result:'DETECTED',restoredImplementation:'PASS'});

async function restoredDataOracle(sourceFault=null){
  const r=storeRuntime({sourceFault}),{core,engine,store,hash,copy}=r,jobId='RECOVERY-RESTORE-ORACLE';
  let p=core.createBlankState(jobId);engine.ensureShape(p);engine.recalculate(p);p=await store.writeProject(p,{expectedProjectRevision:0});
  const initial=await store.ensureHistoryCheckpoint(jobId,{sessionId:'SESSION',expectedProjectRevision:p.revision}),checkpoints=[];
  const semanticStages=stages=>Object.fromEntries(Object.entries(stages).map(([key,value])=>{const result=copy(value);if(result.gate)delete result.gate.checkedAt;return [key,result];}));
  for(let stage=1;stage<=r.schema.STAGE_COUNT;stage++){
    const next=copy(p);next.stages[stage].responseDraft='Draft with exact bytes for stage '+stage+'\n';
    p=await store.replaceProject(next,{expectedProjectRevision:p.revision});
    checkpoints.push({stage,versionId:'SAVED-'+p.projectSha256,stages:hash.stableStringify(copy(semanticStages(p.stages))),retainedStages:hash.stableStringify(p.stages),title:p.job.JOB_TITLE});
  }
  // Every destination is visited in a permutation, including nonadjacent
  // jumps. Assertions use the recorded checkpoint, not an inferred direction.
  const destinations=checkpoints.filter((_,index)=>index%2).reverse().concat(checkpoints.filter((_,index)=>!(index%2)));
  for(const destination of destinations){
    p=await store.activateSavedVersion(jobId,destination.versionId,{expectedProjectRevision:p.revision});
    assert.equal(hash.stableStringify(copy(semanticStages(p.stages))),destination.stages,'RESTORE_ORACLE: active stages differ from the destination checkpoint');
    const retained=await store.readSavedVersion(jobId,destination.versionId);
    assert.equal(hash.stableStringify(retained.project.stages),destination.retainedStages,'RESTORE_ORACLE: retained history was mutated');
  }
  assert((await store.listSavedVersions(jobId)).versionIds.includes(initial.versionId),'RESTORE_ORACLE: session start was lost');
  return {destinations:destinations.map(row=>({stage:row.stage,versionId:row.versionId})),environment:'production store with transaction I/O double'};
}
const restoration=await restoredDataOracle();cases.push({caseId:'all-stage-drafts-and-arbitrary-destination-restoration',...restoration,result:'PASS'});
const mixedVersionFault={file:'project-store.js',before:'const next=clone(saved.project);next.revision=expectedProjectRevision+1;',after:'const next=clone(saved.project);next.stages=clone(row.project.stages);next.revision=expectedProjectRevision+1;'};
await assert.rejects(restoredDataOracle(mixedVersionFault),/RESTORE_ORACLE/,'Mixed-version restoration escaped detection');
await restoredDataOracle();faults.push({faultId:'RESTORE-INCOMPATIBLE-STAGE-VERSIONS',result:'DETECTED',restoredImplementation:'PASS'});
function immutableSnapshotOracle(sourceFault=null){
  const {store,core,engine}=storeRuntime({sourceFault}),p=core.createBlankState('IMMUTABLE-CHECKPOINT');engine.ensureShape(p);engine.recalculate(p);
  for(let stage=1;stage<=30;stage++)p.stages[stage].responseDraft='Saved draft '+stage;
  const encoded=store.encodeSavedVersion(p),restored=store.decodeSavedVersion(encoded.version,encoded.chunks);
  for(let stage=1;stage<=30;stage++)restored.stages[stage].responseDraft='Different continuation '+stage;
  let retained;try{retained=store.decodeSavedVersion(encoded.version,encoded.chunks);}catch(error){assert.fail('RETAINED_HISTORY_ORACLE: editing the active version corrupted its checkpoint: '+error.message);}
  for(let stage=1;stage<=30;stage++)assert.equal(retained.stages[stage].responseDraft,'Saved draft '+stage,'RETAINED_HISTORY_ORACLE: editing the active version changed retained history');
}
immutableSnapshotOracle();
assert.throws(()=>immutableSnapshotOracle({file:'project-store.js',before:'return clone(chunk.value);',after:'return chunk.value;'}),/RETAINED_HISTORY_ORACLE/);
immutableSnapshotOracle();cases.push({caseId:'editing-restored-data-preserves-every-retained-stage',stages:30,result:'PASS'});
faults.push({faultId:'MUTATE-RETAINED-HISTORY',result:'DETECTED',restoredImplementation:'PASS'});
console.log(JSON.stringify({generalRecoveryBoundaries:'PASS',cases,implementationFaults:faults,synthetic:true,browserHistory:false,physicalDevice:false,limitations:['Projection sentinels are not accepted workflow projects.','Saved draft comparisons exercise all stage destinations; accepted decisions and browser routing require operator journeys.']}));

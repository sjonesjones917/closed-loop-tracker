import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

// Execute the existing Save human inputs handler with its normal engine and
// transactional store. The DOM supplies declared input controls only; this is
// not a browser accessibility check or proof of a genuine person's identity.
export async function verifyHumanStageSave({sourceOverrides={}}={}){
 const r=projectStoreRuntime({sourceOverrides}),h=r.runtime.closedLoopHash,app=fs.readFileSync('app-core.js','utf8'),start=app.indexOf('async function saveHumanStageFields('),end=app.indexOf('\n',start);
 assert(start>=0&&end>start,'HUMAN_STAGE_SAVE_HANDLER_OWNER_ORACLE');
 let current=await r.store.createProject({commandId:'SYNTHETIC-HUMAN-STAGE-SAVE'}),controls=[],renders=0;
 Object.assign(r.runtime,{engine:r.engine,clone:r.copy,current,document:{querySelectorAll:()=>controls},$:()=>({value:'Synthetic operator'}),render:()=>{renders++;},persistReplacement:async next=>{current=await r.store.writeProject(next,{expectedProjectRevision:current.revision});r.runtime.current=current;}});
 vm.runInContext(app.slice(start,end)+'\nglobalThis.saveHumanStageFixture=saveHumanStageFields;',r.runtime,{filename:'app-core.js:actual-save-human-stage-inputs'});
 const savedFields=[];
 for(const [stage,field,value]of [[1,'JOB_TITLE','  Exact title\n<value>  '],[10,'FREEZE_OWNER','  Synthetic freeze owner  ']]){
  current.activeStage=stage;r.runtime.current=current;controls=[{dataset:{humanStageField:field},value}];
  const revision=current.revision,oldInput=current.job.CURRENT_INPUT_VERSION,decisions=h.sha256Value(current.projectData.humanDecisions);
  try{await r.runtime.saveHumanStageFixture();}catch(error){assert.fail('HUMAN_STAGE_SAVE_COMMIT_ORACLE: conforming human stage input must commit: '+error.message);}
  const reloaded=await r.store.readProject(current.job.JOB_ID);
  assert.equal(reloaded.revision,revision+1,'HUMAN_STAGE_SAVE_REVISION_ORACLE');assert.equal(reloaded.stages[stage].humanData[field],value,'HUMAN_STAGE_SAVE_VERBATIM_ORACLE');
  assert.notEqual(reloaded.job.CURRENT_INPUT_VERSION,oldInput,'HUMAN_STAGE_SAVE_INPUT_VERSION_ORACLE');
  assert.equal(h.sha256Value(reloaded.projectData.humanDecisions),decisions,'HUMAN_STAGE_SAVE_NO_INVENTED_AUTHORITY_ORACLE');
  const event=reloaded.projectData.history.findLast(row=>row.type==='HUMAN_STAGE_INPUT_RECORDED'&&row.stage===stage&&row.field===field);
  assert(event&&event.value===value&&event.identityAssurance==='SELF_ASSERTED','HUMAN_STAGE_SAVE_HISTORY_ORACLE');
  const input=reloaded.projectData.inputVersions.at(-1);assert.equal(input.payload.stageInputs[String(stage)][field],value,'HUMAN_STAGE_SAVE_VERSIONED_VALUE_ORACLE');
  assert.equal(r.store.validateProjectIntegrity(reloaded).valid,true,'HUMAN_STAGE_SAVE_INTEGRITY_ORACLE');
  current=reloaded;r.runtime.current=current;savedFields.push({stage,field,verbatim:true,committedAndReloaded:true,versioned:true,historyRetained:true});
 }
 const negatives=[];
 for(const value of [null,17,true,['wrong array'],{wrong:'object'}]){
  const candidate=r.copy(current),before=h.sha256Value(candidate);
  assert.throws(()=>r.engine.recordHumanDecision(candidate,{stage:10,field:'FREEZE_OWNER',value:r.copy(value)}),error=>error.code==='INVALID_HUMAN_STAGE_INPUT'&&error.issues.some(row=>row.path==='/stages/10/humanData/FREEZE_OWNER'),'HUMAN_STAGE_SAVE_TYPE_ORACLE');
  assert.equal(h.sha256Value(candidate),before,'HUMAN_STAGE_SAVE_REJECTION_ATOMIC_ORACLE');negatives.push(value===null?'null':Array.isArray(value)?'array':typeof value);
 }
 const before=h.sha256Value(current);assert.throws(()=>r.engine.recordHumanDecision(current,{stage:10,field:'CANDIDATE_ID',value:'invented'}),/Application-owned fields may change only/,'HUMAN_STAGE_SAVE_OWNER_ORACLE');assert.equal(h.sha256Value(current),before);
 const checkpoint=await r.store.historyList(current.job.JOB_ID);assert(checkpoint.entries.length>=3,'HUMAN_STAGE_SAVE_CHECKPOINT_ORACLE');
 return {humanStageSave:'PASS',savedFields,malformedTypesRejected:negatives,applicationFieldRejected:true,noUnregisteredDecisionCreated:true,rejectionPreservesState:true,renderCount:renders,actualHandler:true,actualStoreAndReload:true,synthetic:true,actualBrowser:false,sourceHashes:{appCore:createHash('sha256').update(app).digest('hex'),engine:createHash('sha256').update(sourceOverrides['workflow-engine.js']||fs.readFileSync('workflow-engine.js','utf8')).digest('hex')},scopeLimit:'Existing schema-authorized human stage input save; no new purpose, genuine human attestation, stage completion, or broader stage-field ownership conformance claimed.'};
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1])console.log(JSON.stringify(await verifyHumanStageSave({sourceOverrides:process.env.HUMAN_STAGE_ENGINE_SOURCE?{'workflow-engine.js':fs.readFileSync(process.env.HUMAN_STAGE_ENGINE_SOURCE,'utf8')}:{}})));

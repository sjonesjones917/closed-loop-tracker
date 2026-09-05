import fs from 'node:fs';import vm from 'node:vm';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,hash=globalThis.closedLoopHash;
const assert=(value,message)=>{if(!value)throw new Error(message);};
function record(collection,stage,fields,id,scope={}){
  const def=schema.RECORD_SCHEMAS[collection],full={...fields,[def.idField]:id},record={id,stage,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',active:true,scope,fields:full,...full,source:'VERIFY_PRODUCTION_BASELINE'};
  engine.refreshRecordHashes(record,collection);return record;
}
function project(label='JOB-PRODUCTION-BASELINE'){
  const p=core.createBlankState(label);Object.assign(p.job,{CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCES-v001',CURRENT_REQUIREMENTS_VERSION:'REQ-v001',CURRENT_TEST_SUITE_VERSION:'TEST-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001',CURRENT_BASELINE_ID:'NONE',CURRENT_PRODUCT_ID:'NONE'});engine.ensureShape(p);
  const sha=hash.sha256Text('confirmed candidate bytes'),artifact=record('artifacts',17,{FILENAME:'candidate.bin',TYPE:'application/octet-stream',VERSION:'APPLICATION-CONTROLLED',BYTE_SIZE:25,SHA256:sha,ROLE:'STAGE_ARTIFACT',STORAGE_REFERENCE:'indexeddb:ARTIFACT-CONFIRMED',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED',NOTES:'fixture'},'ARTIFACT-CONFIRMED');
  const candidate=record('candidateFreezes',17,{ITERATION_ID:'ITERATION-CORRECTED',COMPONENT_SELECTION_DECISION_ID:'HUMAN-DECISION-SELECTION',COMPONENT_MANIFEST:[{artifactId:'ARTIFACT-CONFIRMED',filename:'candidate.bin',byteSize:25,sha256:sha,storageReference:'indexeddb:ARTIFACT-CONFIRMED'}],COMPONENT_VERSIONS:{'ARTIFACT-CONFIRMED':'APPLICATION-CONTROLLED'},COMPONENT_HASHES:{'ARTIFACT-CONFIRMED':sha},ROLE_DISTRIBUTION:'WORKFLOW ROLE MAP',IMMUTABLE_LOCATIONS:['indexeddb:ARTIFACT-CONFIRMED'],TOOL_CONFIGURATION:'CURRENT AUTHORIZED CONFIGURATION',SETTINGS:'CURRENT AUTHORIZED SETTINGS',PERMISSIONS:'CURRENT AUTHORIZED PERMISSIONS',LIMITATIONS:'RECORDED LIMITATIONS',BATCH_CHANGE_RULE:'ANY MATERIAL CHANGE REQUIRES A NEW CANDIDATE',STATUS:'FROZEN',EVIDENCE:'fixture'},'CANDIDATE-CONFIRMED');
  const iteration=record('iterations',19,{CANDIDATE_ID:'CANDIDATE-CONFIRMED',PREVIOUS_ITERATION_ID:'ITERATION-CORRECTED',CHANGESET_ID:'',PURPOSE:'UNCHANGED_CONFIRMATION',STATUS:'FROZEN',LINEAGE:'fixture',EVIDENCE:'fixture'},'ITERATION-CONFIRM');
  p.projectData.artifacts.push(artifact);p.projectData.candidateFreezes.push(candidate);p.projectData.iterations.push(iteration);p.job.CURRENT_ITERATION='ITERATION-CONFIRM';
  const scope={...engine.currentScope(p),iterationId:'ITERATION-CONFIRM',candidateId:'CANDIDATE-CONFIRMED',baselineId:null,productId:null};for(const item of [artifact,candidate,iteration]){item.scope={...scope};engine.refreshRecordHashes(item,item===artifact?'artifacts':item===candidate?'candidateFreezes':'iterations');}
  const confirmation=record('confirmationRecords',19,{SOURCE_ITERATION_ID:'ITERATION-CORRECTED',CONFIRMATION_ITERATION_ID:'ITERATION-CONFIRM',ZERO_MATERIAL_CHANGES:'TRUE',VERSION_HASH_COMPARISON:'MATCH',TEN_NEW_CONTEXTS:'TRUE',COMPLETE_TEST_RESULTS:'SATISFIED',REGRESSION_RESULTS:'SATISFIED',COMPARISON_RESULTS:'SATISFIED',NEW_DEFECTS:'NONE',NEW_REQUIREMENTS:'NONE',NEW_FAILURE_CASES:'NONE',NEW_VARIANCE:'NONE',DETERMINATION:'SATISFIED',EVIDENCE:'fixture'},'CONFIRMATION-CURRENT',scope);p.projectData.confirmationRecords.push(confirmation);engine.recalculate(p);return p;
}
function baselineCount(p){return engine.records(p,'baselines',{active:false}).length;}
function expectRejectsWithoutBaselineMutation(p,call,pattern,message){
  const before=baselineCount(p),prior=p.job.CURRENT_BASELINE_ID;let rejected=false;try{call();}catch(error){rejected=pattern.test(String(error.message||error));}
  assert(rejected,message);assert(baselineCount(p)===before,'Rejected baseline freeze mutated baselines.');assert(p.job.CURRENT_BASELINE_ID===prior,'Rejected baseline freeze mutated CURRENT_BASELINE_ID.');
}
{
  const p=project('JOB-BASELINE-MISSING-AUTHORIZATION');
  expectRejectsWithoutBaselineMutation(p,()=>engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CONFIRMED'],operatorLabel:'VERIFY'}),/BASELINE_AUTHORIZATION human decision/i,'Missing baseline authorization decision was accepted.');
}
{
  const p=project('JOB-BASELINE-WRONG-CANDIDATE');
  const wrong=engine.recordRegisteredHumanDecision(p,{stage:20,purpose:'BASELINE_AUTHORIZATION',targetFamily:'candidateFreezes',targetId:'CANDIDATE-WRONG',value:'AUTHORIZED',operatorLabel:'VERIFY'});
  expectRejectsWithoutBaselineMutation(p,()=>engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CONFIRMED'],baselineAuthorizationDecisionId:engine.recordId(wrong,'humanDecisions'),operatorLabel:'VERIFY'}),/exact unchanged-confirmed candidate/i,'Wrong-candidate baseline authorization decision was accepted.');
}
{
  const p=project('JOB-BASELINE-VALID-AUTHORIZATION');
  const decision=engine.recordRegisteredHumanDecision(p,{stage:20,purpose:'BASELINE_AUTHORIZATION',targetFamily:'candidateFreezes',targetId:'CANDIDATE-CONFIRMED',value:'AUTHORIZED',operatorLabel:'VERIFY'});
  const baseline=engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CONFIRMED'],baselineAuthorizationDecisionId:engine.recordId(decision,'humanDecisions'),operatorLabel:'VERIFY'});
  assert(engine.recordValue(baseline,'BASELINE_AUTHORIZATION_DECISION_ID')===engine.recordId(decision,'humanDecisions'),'Valid baseline did not preserve the authorization decision ID.');
  assert(engine.recordValue(baseline,'HUMAN_AUTHORIZATION')==='AUTHORIZED','Baseline authorization summary was not derived from the registered decision value.');
  assert(JSON.stringify(engine.recordValue(baseline,'IMMUTABLE_ARTIFACT_RECORDS'))===JSON.stringify(['ARTIFACT-CONFIRMED']),'Baseline did not preserve the exact candidate artifact set.');
}
{
  const p=project('JOB-BASELINE-INACTIVE-AUTHORIZATION');
  const decision=engine.recordRegisteredHumanDecision(p,{stage:20,purpose:'BASELINE_AUTHORIZATION',targetFamily:'candidateFreezes',targetId:'CANDIDATE-CONFIRMED',value:'AUTHORIZED',operatorLabel:'VERIFY'});decision.active=false;decision.fields.STATUS=decision.STATUS='SUPERSEDED';engine.refreshRecordHashes(decision,'humanDecisions');
  expectRejectsWithoutBaselineMutation(p,()=>engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CONFIRMED'],baselineAuthorizationDecisionId:engine.recordId(decision,'humanDecisions'),operatorLabel:'VERIFY'}),/current active Stage 20 human decision|not current/i,'Inactive baseline authorization decision was accepted.');
}
{
  const p=project('JOB-BASELINE-VISIBLE-OPERATOR');
  const currentIteration=engine.records(p,'iterations').find(r=>engine.recordId(r,'iterations')===String(p.job.CURRENT_ITERATION)&&Number(r.stage)===19&&engine.isActiveRecord(r)),candidateId=String(engine.recordValue(currentIteration,'CANDIDATE_ID')||currentIteration?.scope?.candidateId||'').trim();
  const authorizationDecision=engine.recordRegisteredHumanDecision(p,{stage:20,purpose:'BASELINE_AUTHORIZATION',targetFamily:'candidateFreezes',targetId:candidateId,value:'AUTHORIZED',operatorLabel:'VISIBLE_OPERATOR'});
  const baseline=engine.freezeBaseline(p,{artifactIds:['ARTIFACT-CONFIRMED'],baselineAuthorizationDecisionId:engine.recordId(authorizationDecision,'humanDecisions'),operatorLabel:'VISIBLE_OPERATOR'});
  assert(engine.recordValue(baseline,'BASELINE_AUTHORIZATION_DECISION_ID')===engine.recordId(authorizationDecision,'humanDecisions'),'Visible operator sequence did not consume its registered BASELINE_AUTHORIZATION decision.');
  const app=fs.readFileSync('app-core.js','utf8'),handler=app.slice(app.indexOf("if($('#freeze-baseline'))"),app.indexOf("if($('#reserve-product-execution'))"));
  assert(handler.includes("recordRegisteredHumanDecision(next,{stage:20,purpose:'BASELINE_AUTHORIZATION',targetFamily:'candidateFreezes'"),'Visible #freeze-baseline action does not record BASELINE_AUTHORIZATION through the universal human-decision command.');
  assert(handler.includes("baselineAuthorizationDecisionId:engine.recordId(authorizationDecision,'humanDecisions')"),'Visible #freeze-baseline action does not pass the exact decision ID into freezeBaseline.');
}
console.log(JSON.stringify({productionBaselineAuthorization:'PASS'},null,2));

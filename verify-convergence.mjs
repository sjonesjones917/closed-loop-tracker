import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine;
assert(core&&schema&&engine,'Stage 21 convergence verifier could not load runtime authorities.');

function row(collection,id,stage,fields={},scope={},relationships={}){
  const d=schema.RECORD_SCHEMAS[collection];
  assert(d,`Unknown collection ${collection}`);
  const all={...fields,[d.idField]:id};
  const r={id,stage,active:true,scope:{...scope},fields:all,...all,relationships:{...relationships}};
  if(engine.refreshRecordHashes)engine.refreshRecordHashes(r,collection);
  return r;
}
function blank(){
  const p=core.createBlankState('JOB-STAGE21-CONVERGENCE');
  Object.assign(p.job,{JOB_ID:'JOB-STAGE21-CONVERGENCE',EXACT_USER_OBJECTIVE_VERBATIM:'Verify due-stage convergence.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001',CURRENT_ITERATION:'ITERATION-17'});
  engine.ensureShape(p);
  for(let s=1;s<=17;s++){p.stages[s].status='COMPLETE';p.stages[s].gate={complete:true,blocked:false,reasons:[]};}
  p.projectData.iterations.push(row('iterations','ITERATION-17',17,{ITERATION_ID:'ITERATION-17',CANDIDATE_ID:'CANDIDATE-17',PREVIOUS_ITERATION_ID:'ITERATION-10',CHANGESET_ID:'CHANGE-16',PURPOSE:'TEST_CANDIDATE',STATUS:'FROZEN',LINEAGE:'CURRENT'},{iterationId:'ITERATION-17',candidateId:'CANDIDATE-17'}));
  return p;
}
function addApplicableMandatoryProposition(p,{phase='FINAL_PRODUCT_DETERMINISTIC',earliest=22,requiredBy=22,perRun=false,finalProduct=true,delivery=false,status='UNKNOWN'}={}){
  const req=row('requirements','REQ-STAGE21',4,{REQ_ID:'REQ-STAGE21',OBLIGATION:'The future product must satisfy a final-product proposition.',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:'User Job Input',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'Final product condition is satisfied.',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC',EXPECTED_EVIDENCE:'Current direct evidence',FAILURE_CONDITION:'Final product condition is not satisfied.',SEVERITY:'MAJOR',STATUS:'ACTIVE'});
  const prop=row('propositions','PROPOSITION-STAGE21',4,{PROPOSITION_ID:'PROPOSITION-STAGE21',REQUIREMENT_ID:'REQ-STAGE21',PROPOSITION_TEXT:'The future final product satisfies its deterministic condition.',SUBJECT_AND_SCOPE_DESCRIPTION:'Future final product',SATISFACTION_MEANING:'Condition satisfied',FAILURE_MEANING:'Condition not satisfied',VERIFICATION_PHASE:phase,EARLIEST_EXECUTABLE_STAGE:earliest,REQUIRED_BY_STAGE:requiredBy,PER_RUN_REQUIRED:perRun,FINAL_PRODUCT_REQUIRED:finalProduct,DELIVERY_REQUIRED:delivery,TARGET_AVAILABILITY_CONDITION:{phaseTarget:true},STATUS:status},{},{REQUIREMENT_ID:'REQ-STAGE21'});
  const app=row('applicabilityRecords','APPLICABILITY-STAGE21',5,{APPLICABILITY_ID:'APPLICABILITY-STAGE21',SUBJECT_ID:'PROPOSITION-STAGE21',PROPOSED_APPLICABILITY:'APPLICABLE',SELECTED_APPLICABILITY:'APPLICABLE',TRUTH_VALUE:'TRUE',EPISTEMIC_BASIS:'EXTERNALLY_SUPPORTED',CURRENT_SCOPE_STATUS:'CURRENT',FRESHNESS_STATUS:'CURRENT',CONTRADICTION_STATUS:'CLEAR',REASONING:'The mandatory proposition applies.'});
  const review=row('semanticReviews','SEMANTIC-REVIEW-STAGE21',5,{SEMANTIC_REVIEW_ID:'SEMANTIC-REVIEW-STAGE21',REVIEWED_RECORD_IDS:['APPLICABILITY-STAGE21'],AUTHOR_CONTEXT_ID:'CONTEXT-AUTHOR',REVIEWER_CONTEXT_ID:'CONTEXT-REVIEWER',INDEPENDENCE_DETERMINATION:'APPLICATION_ESTABLISHED',RESULT:'ACCEPTED',ACCEPTED_DISPOSITION:'ACCEPTED',RECONCILIATION_STATUS:'NOT_REQUIRED'});
  p.projectData.requirements.push(req);p.projectData.propositions.push(prop);p.projectData.applicabilityRecords.push(app);p.projectData.semanticReviews.push(review);
}
function addRegression(p,id,{phase,earliest,requiredBy,perRun,finalProduct,delivery}){
  p.projectData.regressions.push(row('regressions',id,15,{REG_ID:id,DEFECT_ID:'DEFECT-'+id,ACTIVE_RETIRED_STATE:'ACTIVE',APPLICABILITY:'APPLICABLE',VERIFICATION_PHASE:phase,EARLIEST_EXECUTABLE_STAGE:earliest,REQUIRED_BY_STAGE:requiredBy,PER_RUN_REQUIRED:perRun,FINAL_PRODUCT_REQUIRED:finalProduct,DELIVERY_REQUIRED:delivery,TARGET_AVAILABILITY_CONDITION:{phaseTarget:true}},{iterationId:'ITERATION-17'},{DEFECT_ID:'DEFECT-'+id}));
}
function addSuccessfulRegressionExecution(p,regId){
  p.projectData.evidenceRecords.push(row('evidenceRecords','EVIDENCE-'+regId,17,{EVIDENCE_ID:'EVIDENCE-'+regId,KIND:'REGRESSION_EXECUTION',AUTHORITY_TYPE:'AGENT_CLAIM',CONTENT:'The post-correction regression executed and satisfied the preserved failure condition.'},{iterationId:'ITERATION-17'}));
  const e=row('regressionExecutions','REG-EXEC-'+regId,17,{REG_EXEC_ID:'REG-EXEC-'+regId,REG_ID:regId,ITERATION_ID:'ITERATION-17',PHASE:'POST_CORRECTION',RESULT:'SATISFIED'},{iterationId:'ITERATION-17'},{REG_ID:regId});
  e.evidenceRefs=['EVIDENCE-'+regId];
  p.projectData.regressionExecutions.push(e);
}

// Invalid-state reproduction: a future final-product proposition must not block Stage 18/19 before target availability.
{
  const p=blank();addApplicableMandatoryProposition(p);
  const r18=engine.gate(18,p).reasons.join('\n');
  const r19=engine.gate(19,p).reasons.join('\n');
  assert(!r18.includes('Mandatory proposition PROPOSITION-STAGE21 is not SATISFIED.'),'Stage 18 prematurely required a final-product proposition before its target exists.');
  assert(!r19.includes('Mandatory proposition PROPOSITION-STAGE21 is not SATISFIED.'),'Stage 19 prematurely required a final-product proposition before its target exists.');
  p.job.CURRENT_PRODUCT_ID='PRODUCT-STAGE21';p.job.CURRENT_PRODUCT_VERSION='PRODUCT-v001';
  const r22=engine.gate(22,p).reasons.join('\n');
  assert(r22.includes('Mandatory proposition PROPOSITION-STAGE21 is not SATISFIED.'),'The final-product proposition did not become due at its required product stage.');
}

// A future-stage blocker cannot contaminate Stage 18 convergence; a Stage 18 blocker can.
{
  const p=blank();
  p.projectData.blockers.push(row('blockers','BLOCKER-FUTURE',23,{BLOCKER_ID:'BLOCKER-FUTURE',STATUS:'OPEN',STAGE_DISCOVERED:23,WHY_WORK_CANNOT_CONTINUE:'Future meaning-review evidence is not yet available.'}));
  assert.equal(engine.convergenceMetrics(p).mandatoryUnresolvedUnknowns,0,'A future Stage 23 blocker contaminated Stage 18 convergence.');
  p.projectData.blockers.push(row('blockers','BLOCKER-DUE',18,{BLOCKER_ID:'BLOCKER-DUE',STATUS:'OPEN',STAGE_DISCOVERED:18,WHY_WORK_CANNOT_CONTINUE:'A due convergence prerequisite is unknown.'}));
  assert.equal(engine.convergenceMetrics(p).mandatoryUnresolvedUnknowns,1,'A current Stage 18 blocker did not block convergence.');
}

// A future regression remains scheduled but is excluded from Stage 18 regression coverage.
{
  const p=blank();
  addRegression(p,'REG-FUTURE',{phase:'FINAL_PRODUCT_ADVERSARIAL',earliest:24,requiredBy:24,perRun:false,finalProduct:true,delivery:false});
  let m=engine.convergenceMetrics(p);
  assert.equal(m.dueRegressionCount,0,'A future final-product regression was counted as due at Stage 18.');
  assert.equal(m.regressionSuccess,1,'A future final-product regression falsely failed Stage 18 regression success.');
  addRegression(p,'REG-DUE',{phase:'PREPRODUCT_ITERATION',earliest:17,requiredBy:18,perRun:true,finalProduct:false,delivery:false});
  m=engine.convergenceMetrics(p);
  assert.equal(m.dueRegressionCount,1,'A due PREPRODUCT regression was not in the Stage 18 closed universe.');
  assert.equal(m.regressionSuccess,0,'An unexecuted due PREPRODUCT regression did not block Stage 18 regression success.');
  addSuccessfulRegressionExecution(p,'REG-DUE');
  m=engine.convergenceMetrics(p);
  assert.equal(m.successfulDueRegressionCount,1,'The repaired due regression execution was not counted.');
  assert.equal(m.regressionSuccess,1,'A distinct successful post-correction execution did not repair Stage 18 regression success.');
  const d=engine.deriveStageData(p,18);
  assert.equal(d.TOTAL_STILL_APPLICABLE_REGRESSION_TESTS,1,'Stage 18 derived data did not publish the due regression universe.');
  assert.equal(d.SUCCESSFUL_REGRESSION_TESTS,1,'Stage 18 derived data did not publish the successful due regression numerator.');
}

console.log(JSON.stringify({controllerStage:'21',applicationStage:18,convergenceDueStageClosure:'PASS',futurePropositionExcluded:true,futureBlockerExcluded:true,futureRegressionExcluded:true,dueRegressionFailureDetected:true,repairedRegressionProgressed:true,isolatedDisposableProject:true}));

if(process.env.STAGE21_MUTATION_CHILD!=='1'){
  const {spawnSync}=await import('node:child_process');
  const {mkdtempSync,cpSync,writeFileSync,rmSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const source=fs.readFileSync('workflow-engine.js','utf8');
  const mutations=[
    ['future-blocker-leak',source.replace('openBlockers(project,18).length','openBlockers(project).length')],
    ['future-proposition-premature-due',source.replace("const timing=e0.testDueState(p,pr,n,{perRunOnly:[18,19].includes(Number(n))});","const timing={valid:true,blocking:false,dueNow:true,reasons:[]};")],
    ['future-regression-premature-due',source.replace("timing:testDueState(project,regression,18,{perRunOnly:true})","timing:{valid:true,blocking:false,dueNow:true}")]
  ];
  for(const [name,mutated] of mutations){
    assert.notEqual(mutated,source,`Mutation ${name} did not alter the production mechanism.`);
    const dir=mkdtempSync(join(tmpdir(),'stage21-mutation-'));
    try{
      for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js'])cpSync(file,join(dir,file));
      cpSync(new URL(import.meta.url),join(dir,'verify-convergence.mjs'));
      writeFileSync(join(dir,'workflow-engine.js'),mutated);
      const result=spawnSync(process.execPath,['verify-convergence.mjs'],{cwd:dir,env:{...process.env,STAGE21_MUTATION_CHILD:'1'},encoding:'utf8'});
      assert.notEqual(result.status,0,`Mutation ${name} escaped the Stage 21 verifier.`);
    }finally{rmSync(dir,{recursive:true,force:true});}
  }
  console.log(JSON.stringify({stage21TestOfTestMutationsRejected:mutations.map(([name])=>name)}));
}

import {reviewProofFixture} from './test-fixtures.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({TextEncoder,TextDecoder,Event:class Event{},dispatchEvent(){}});
for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
const e=c.closedLoopWorkflowEngine,p=c.closedLoopCore.createBlankState('JOB-FINAL-TIMING');
e.ensureShape(p);
Object.assign(p.job,{CURRENT_INPUT_VERSION:'INPUT-1',CURRENT_SOURCE_SET_VERSION:'SOURCE-1',CURRENT_REQUIREMENTS_VERSION:'REQSET-1',CURRENT_TEST_SUITE_VERSION:'TESTSET-1',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-1',CURRENT_PRODUCT_ID:'PRODUCT-1',CURRENT_PRODUCT_VERSION:'PRODUCT-v001'});
const scope=e.currentScope(p),record=(id,stage,fields)=>({id,stage,active:true,scope:{...scope},fields:{...fields},...fields});
p.projectData.requirements.push(e.clone(record('REQ-1',4,{REQ_ID:'REQ-1',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'})));
let checks=0;
for(const [stage,type,phase] of [[22,'DETERMINISTIC','FINAL_PRODUCT_DETERMINISTIC'],[23,'MEANING','FINAL_PRODUCT_MEANING'],[24,'ADVERSARIAL','FINAL_PRODUCT_ADVERSARIAL']]){
 let final=record('FINAL-'+stage,6,{TEST_ID:'FINAL-'+stage,TARGET_PROPOSITION_IDS:['PROP-1'],SEMANTIC_COVERAGE_DISPOSITION:'EQUIVALENT',SEMANTIC_REVIEW_IDS:['DISPOSABLE-REVIEW'],TEST_ROLE:'REQUIRED_PROOF',REQ_ID:'REQ-1',TEST_TYPE:type,STATUS:'READY',VERIFICATION_PHASE:phase,EARLIEST_EXECUTABLE_STAGE:stage,REQUIRED_BY_STAGE:stage,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:true,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{phaseTarget:true}});
 const prior=record('PRIOR-'+stage,6,{...final.fields,TEST_ID:'PRIOR-'+stage,VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:12,REQUIRED_BY_STAGE:12,PER_RUN_REQUIRED:true,FINAL_PRODUCT_REQUIRED:false});
 p.projectData.tests=e.clone([prior,final]);for(let n=1;n<=5;n++){p.stages[n].status='COMPLETE';p.stages[n].gate={complete:true};}reviewProofFixture({engine:e,prompts:c.closedLoopPromptEngine,ingestion:c.closedLoopResponseIngestion,schema:c.closedLoopWorkflowSchema},p);final=p.projectData.tests.find(t=>t.id==='FINAL-'+stage);
 assert.equal(e.evaluateStageProofTruth(p,'PROP-1',{type:'LEAF',testId:final.id,requiredDisposition:'SATISFIED',truthExtraction:'ACCEPTED_ENTAILMENT',evidenceClasses:['OBSERVATION_RECORD','ACCEPTED_ENTAILMENT'],scopeBinding:'CURRENT'},18),'DEFERRED','Final proof must not block before its declared due stage.');
 assert.equal(e.evaluateStageProofTruth(p,'PROP-1',{type:'LEAF',testId:final.id,requiredDisposition:'SATISFIED',truthExtraction:'ACCEPTED_ENTAILMENT',evidenceClasses:['OBSERVATION_RECORD','ACCEPTED_ENTAILMENT'],scopeBinding:'CURRENT'},stage),'UNKNOWN','A deferred test must not become satisfied without execution.');
 let selected=e.finalProductTestSelection(p,stage);
 assert.equal(selected.tests.length,1);assert.equal(e.recordId(selected.tests[0],'tests'),final.id);assert.equal(selected.reasons.length,0);
 final.fields.REQUIRED_BY_STAGE=stage+1;final.REQUIRED_BY_STAGE=stage+1;
 assert.equal(e.finalProductTestSelection(p,stage).tests.length,0,'A future obligation must not be demanded prematurely.');
 final.fields.REQUIRED_BY_STAGE=stage;final.REQUIRED_BY_STAGE=stage;
 delete final.fields.TARGET_AVAILABILITY_CONDITION;delete final.TARGET_AVAILABILITY_CONDITION;
 assert.ok(e.finalProductTestSelection(p,stage).reasons.length,'Missing timing contract must fail closed.');
 final.fields.TARGET_AVAILABILITY_CONDITION={phaseTarget:true};final.TARGET_AVAILABILITY_CONDITION={phaseTarget:true};
 const old=p.job.CURRENT_PRODUCT_VERSION;p.job.CURRENT_PRODUCT_VERSION=null;
 assert.ok(e.finalProductTestSelection(p,stage).reasons.length,'A missing product version cannot make a final test vacuously complete.');
 p.job.CURRENT_PRODUCT_VERSION=old;
 assert.equal(e.finalProductTestSelection(p,stage).tests.length,1);checks+=7;
}


// Stage 06 cannot design numeric timing from phase names alone. Publish the
// application stage purposes in the controlling prompt, before untrusted data.

const scheduleProject=c.closedLoopCore.createBlankState('JOB-SCHEDULE-CONTEXT');e.ensureShape(scheduleProject);scheduleProject.stages[5].status='COMPLETE';scheduleProject.stages[5].gate={complete:true};
const instruction=c.closedLoopPromptEngine.buildPromptRecord(6,scheduleProject,{operation:'COMPLETE'}).prompt;
assert.match(instruction,/APPLICATION VERIFICATION SCHEDULE/,'Stage 06 omits the application scheduling context required by its test fields.');
for(const stage of [12,17,19,22,23,24,26,28,29,30])assert(instruction.includes(`Stage ${String(stage).padStart(2,'0')}: ${c.closedLoopCore.STAGES[stage-1].title}`),`Stage ${stage} is absent from the controlling schedule.`);
assert.match(instruction,/Do not ask the human to supply stage numbers/);
console.log(JSON.stringify({finalProductTiming:'PASS',stagesChecked:[22,23,24],perRunTestsExcluded:true,futureTestsNotPremature:true,propositionDeferralWithoutFalseSatisfaction:true,missingTimingBlocks:true,missingTargetBlocks:true,repairedPathProgressed:true,checks,stage06SchedulingContextPublished:true}));

import {reviewProofFixture,recordProposal,canonicalFixtureRecord} from './test-fixtures.mjs';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
const r=projectStoreRuntime(),c=r.runtime,e=r.engine,schema=c.closedLoopWorkflowSchema;
const runtime={engine:e,prompts:r.prompts,ingestion:r.ingestion,schema};
let checks=0;
for(const [stage,type,phase] of [[22,'DETERMINISTIC','FINAL_PRODUCT_DETERMINISTIC'],[23,'MEANING','FINAL_PRODUCT_MEANING'],[24,'ADVERSARIAL','FINAL_PRODUCT_ADVERSARIAL']]){
 const p=r.core.createBlankState('JOB-FINAL-TIMING-'+stage);e.ensureShape(p);
 Object.assign(p.job,{CURRENT_INPUT_VERSION:'INPUT-1',CURRENT_SOURCE_SET_VERSION:'SOURCE-1',CURRENT_RESEARCH_VERSION:'RESEARCH-1',CURRENT_REQUIREMENTS_VERSION:'REQSET-1',CURRENT_TEST_SUITE_VERSION:'TESTSET-1',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-1'});
 const earlyScope=e.currentScope(e.stageContext(p,6)),record=(family,fields,options={})=>canonicalFixtureRecord(runtime,p,family,fields,{scope:earlyScope,...options});
 const req=record('requirements',{MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}),prop=record('propositions',{REQUIREMENT_ID:req.id,PROPOSITION_TEXT:'The delivered bytes meet the requirement.',STATUS:'CURRENT'},{relationships:{REQUIREMENT_ID:req.id}});
 const final=record('tests',{...recordProposal(schema,'tests').fields,REQ_ID:req.id,TARGET_PROPOSITION_IDS:[prop.id],TEST_ROLE:'REQUIRED_PROOF',TEST_TYPE:type,STATUS:'READY',VERIFICATION_PHASE:phase,EARLIEST_EXECUTABLE_STAGE:stage,REQUIRED_BY_STAGE:stage,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:true,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'}},{relationships:{REQ_ID:req.id}});
 record('tests',{...final.fields,VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:12,REQUIRED_BY_STAGE:12,PER_RUN_REQUIRED:true,FINAL_PRODUCT_REQUIRED:false},{relationships:{REQ_ID:req.id}});
 const leaf={type:'LEAF',testId:final.id,requiredDisposition:'SATISFIED',truthExtraction:'ACCEPTED_ENTAILMENT',evidenceClasses:['OBSERVATION_RECORD','ACCEPTED_ENTAILMENT'],scopeBinding:'CURRENT'};
 record('proofExpressions',{TARGET_PROPOSITION_ID:prop.id,PROPOSED_EXPRESSION:leaf,NORMALIZED_EXPRESSION:leaf,SEMANTIC_RATIONALE:'The current final-product result must establish this condition.'},{relationships:{TARGET_PROPOSITION_ID:prop.id}});
 for(let n=1;n<=5;n++){p.stages[n].status='COMPLETE';p.stages[n].gate={complete:true};}reviewProofFixture(runtime,p);
 assert.equal(e.deriveLeafTimingSchedule(p,prop.id).resolved,true,'The final-product fixture must have an independently reviewed schedule.');
 assert.equal(e.evaluateStageProofTruth(p,prop.id,leaf,18),'DEFERRED','Final proof must not block before its declared due stage.');
 assert.equal(e.evaluateStageProofTruth(p,prop.id,leaf,stage),'UNKNOWN','A deferred test must not become satisfied without execution.');
 assert(e.finalProductTestSelection(p,stage).reasons.length,'Bare product pointers or missing bytes must not satisfy final-product availability.');
 const product=canonicalFixtureRecord(runtime,p,'products',{STATUS:'COMPLETED',PRODUCT_VERSION:'PRODUCT-v001',GENERATED_ARTIFACT_INVENTORY:[]});
 Object.assign(p.job,{CURRENT_PRODUCT_ID:product.id,CURRENT_PRODUCT_VERSION:'PRODUCT-v001'});
 const blob=new Blob(['fixed final-product timing bytes']),artifactId=e.allocateId(p,'artifacts',{payload:r.copy({purpose:'FINAL_TIMING'})}),digest=await c.closedLoopHash.sha256Bytes(blob);
 e.registerArtifactBytes(p,r.copy({stage:21,artifactId,filename:'final-timing.txt',mediaType:'text/plain',byteSize:blob.size,sha256:digest,lineage:{productId:product.id}}));
 product.fields.GENERATED_ARTIFACT_INVENTORY=product.GENERATED_ARTIFACT_INVENTORY=[artifactId];e.refreshRecordHashes(product,'products');
 assert(e.finalProductTestSelection(p,stage).reasons.length,'Artifact metadata alone must not authorize execution.');
 await r.store.putArtifact({artifactId,jobId:p.job.JOB_ID,blob,filename:'final-timing.txt',mediaType:'text/plain'});
 let selected=e.finalProductTestSelection(p,stage);assert.equal(selected.tests.length,1);assert.equal(e.recordId(selected.tests[0],'tests'),final.id);assert.equal(selected.reasons.length,0);
 const current=p.projectData.tests.find(t=>t.id===final.id);
 current.fields.REQUIRED_BY_STAGE=current.REQUIRED_BY_STAGE=stage+1;
 assert.equal(e.finalProductTestSelection(p,stage).tests.length,0,'A future obligation must not be demanded prematurely.');
 current.fields.REQUIRED_BY_STAGE=current.REQUIRED_BY_STAGE=stage;
 delete current.fields.TARGET_AVAILABILITY_CONDITION;delete current.TARGET_AVAILABILITY_CONDITION;
 assert.ok(e.finalProductTestSelection(p,stage).reasons.length,'Missing timing contract must fail closed.');
 current.fields.TARGET_AVAILABILITY_CONDITION=current.TARGET_AVAILABILITY_CONDITION=r.copy({type:'PHASE_TARGET'});
 const old=p.job.CURRENT_PRODUCT_VERSION;p.job.CURRENT_PRODUCT_VERSION=null;
 assert.ok(e.finalProductTestSelection(p,stage).reasons.length,'A missing product version cannot make a final test vacuously complete.');p.job.CURRENT_PRODUCT_VERSION=old;
 assert.equal(e.finalProductTestSelection(p,stage).tests.length,1);checks+=10;
}

// Stage 06 cannot design numeric timing from phase names alone. Publish the
// application stage purposes in the controlling prompt, before untrusted data.

const scheduleProject=c.closedLoopCore.createBlankState('JOB-SCHEDULE-CONTEXT');e.ensureShape(scheduleProject);Object.assign(scheduleProject.job,{CURRENT_SOURCE_SET_VERSION:'SCHEDULE-SOURCES',CURRENT_RESEARCH_VERSION:'SCHEDULE-RESEARCH',CURRENT_REQUIREMENTS_VERSION:'SCHEDULE-REQUIREMENTS'});scheduleProject.stages[5].status='COMPLETE';scheduleProject.stages[5].gate={complete:true};
const instruction=c.closedLoopPromptEngine.buildPromptRecord(6,scheduleProject,{operation:'COMPLETE'}).prompt;
assert.match(instruction,/APPLICATION VERIFICATION SCHEDULE/,'Stage 06 omits the application scheduling context required by its test fields.');
for(const stage of [12,17,19,22,23,24,26,28,29,30])assert(instruction.includes(`Stage ${String(stage).padStart(2,'0')}: ${c.closedLoopCore.STAGES[stage-1].title}`),`Stage ${stage} is absent from the controlling schedule.`);
assert.match(instruction,/Do not ask the human to supply stage numbers/);
console.log(JSON.stringify({finalProductTiming:'PASS',stagesChecked:[22,23,24],perRunTestsExcluded:true,futureTestsNotPremature:true,propositionDeferralWithoutFalseSatisfaction:true,missingTimingBlocks:true,missingTargetBlocks:true,repairedPathProgressed:true,checks,stage06SchedulingContextPublished:true}));

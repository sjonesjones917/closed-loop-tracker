import fs from 'node:fs';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {reservationScopeFixture} from './test-reservation-scope-fixture.mjs';
import {responseFixture} from './operator-journey-fixtures.mjs';
const r=projectStoreRuntime(),{engine,core,prompts,ingestion}=r,schema=r.runtime.closedLoopWorkflowSchema;
// Isolated scope/proposal boundary: prior-stage bodies are deliberately absent.
// This fixture proves independent review authority, not a complete journey.
const fixture=reservationScopeFixture({core,schema,engine:{...engine,refreshRecordHashes:(row,family)=>Object.assign(row,engine.refreshRecordHashes(r.copy(row),family))}},schema.STAGE_OPERATION_REGISTRY['26:COMPLETE']);
let p=r.copy(fixture.project);p.job.EXACT_USER_OBJECTIVE_VERBATIM='Review the two current audit bodies.';
for(const[key,field]of Object.entries({baselineId:'CURRENT_BASELINE_ID',productId:'CURRENT_PRODUCT_ID',productVersion:'CURRENT_PRODUCT_VERSION',deliveryCandidateSetId:'CURRENT_DELIVERY_CANDIDATE_SET_ID'}))if(fixture.scope[key])p.job[field]=fixture.scope[key];
function accept(operation){
 p.stages[25].status='COMPLETE';p.stages[25].gate=r.copy({complete:true,blocked:false,reasons:[]});
 const {prompt}=prompts.reserveAndBuildPromptRecord(p,26,{operation,scope:operation==='COMPLETE'?fixture.scope:{}}),envelope=responseFixture({schema,engine,prompt,manifest:prompts.promptFileManifest(prompt),instructionBytes:Buffer.from(prompt.prompt)});
 const prepared=ingestion.prepare(p,{stage:26,text:JSON.stringify(envelope),promptRecord:prompt,transport:{packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce}});
 assert.equal(prepared.validation.valid,true,'AUDIT_REVIEW_FIXTURE_ORACLE: '+JSON.stringify(prepared.validation.issues));
 const impact=ingestion.acceptanceImpact(prepared.project,prepared.proposal.proposalId);p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{replacementConfirmation:impact}).project;return prompt;
}
const author=accept('COMPLETE'),authored=engine.clone(p);
assert.equal(engine.semanticReviewCompletion(p,26).complete,false,'AUDIT_REVIEW_ORACLE: authored audits bypass independent review');
assert.equal(engine.semanticReviewCompletion(p,26).reasons.some(reason=>reason.includes('independently bound')),true);
assert.equal(engine.operationalNextAction(p,26).operation,'SEMANTIC_REVIEW','Authored audits have no independent reviewer action');
const authorVersion=p.job.CURRENT_REVIEW_VERSION,reviewPrompt=accept('SEMANTIC_REVIEW'),state=engine.semanticReviewCompletion(p,26);
assert.equal(state.complete,true,'AUDIT_CURRENT_REVIEW_ORACLE: independent current review did not complete');
assert.equal(p.job.CURRENT_REVIEW_VERSION,authorVersion,'Reviewer response changed authored audit version');
assert.deepEqual([...state.basis.targets.map(row=>row.collection)].sort(),['processAudits','productAudits']);
const review=state.reviews[0];assert.notEqual(review.AUTHOR_CONTEXT_ID,review.REVIEWER_CONTEXT_ID);assert.notEqual(review.AUTHOR_RESERVATION_ID,review.REVIEWER_RESERVATION_ID);assert.equal(review.AUTHOR_RESERVATION_ID,author.operationReservationId);assert.equal(review.REVIEWER_RESERVATION_ID,reviewPrompt.operationReservationId);
const verificationObservations=[{checkId:'S26-AUTHOR-REQUIRES-INDEPENDENT-REVIEW',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:2424'],boundary:'accepted authored process/product audits -> next reviewer action',expected:{accepted:false,nextOperation:'SEMANTIC_REVIEW'},observed:{accepted:engine.semanticReviewCompletion(authored,26).complete,nextOperation:engine.operationalNextAction(authored,26).operation},violation:'AUTHOR_SELF_APPROVAL',accepted:false,passed:true},{checkId:'S26-CURRENT-BOUND-INDEPENDENT-REVIEW',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:2424'],boundary:'reserved independent reviewer -> canonical review authority',expected:{accepted:true,targetCollections:['processAudits','productAudits'],authoredVersionPreserved:true},observed:{accepted:state.complete,targetCollections:state.basis.targets.map(row=>row.collection).sort(),authoredVersionPreserved:p.job.CURRENT_REVIEW_VERSION===authorVersion,reviewId:review.id,authorReservationId:review.AUTHOR_RESERVATION_ID,reviewerReservationId:review.REVIEWER_RESERVATION_ID},passed:true}];
for(const violation of['MISSING_REVIEW','STALE_AUDIT','STALE_AUDIT_EVIDENCE','MISSING_REVIEW_EVIDENCE','REUSED_AUTHOR_CONTEXT','REUSED_AUTHOR_RESERVATION','UNRESOLVED_REVIEW_FINDING']){
 const q=engine.clone(p),row=q.projectData.semanticReviews.find(row=>row.id===review.id);
 if(violation==='MISSING_REVIEW')row.active=false;
 if(violation==='STALE_AUDIT'){const audit=q.projectData.processAudits.at(-1);audit.fields.PROCESS_EVIDENCE+=' Changed substantive evidence.';audit.PROCESS_EVIDENCE=audit.fields.PROCESS_EVIDENCE;engine.refreshRecordHashes(audit,'processAudits');}
 if(violation==='STALE_AUDIT_EVIDENCE'){const audit=q.projectData.processAudits.at(-1);audit.evidenceRefs=[];engine.refreshRecordHashes(audit,'processAudits');}
 if(violation==='MISSING_REVIEW_EVIDENCE')for(const evidence of q.projectData.evidenceRecords.filter(evidence=>row.evidenceRefs.includes(evidence.id)))evidence.active=false;
 if(violation==='REUSED_AUTHOR_CONTEXT')row.fields.REVIEWER_CONTEXT_ID=row.REVIEWER_CONTEXT_ID=row.AUTHOR_CONTEXT_ID;
 if(violation==='REUSED_AUTHOR_RESERVATION')row.fields.REVIEWER_RESERVATION_ID=row.REVIEWER_RESERVATION_ID=row.AUTHOR_RESERVATION_ID;
 if(violation==='UNRESOLVED_REVIEW_FINDING')row.fields.RESULT=row.RESULT='UNKNOWN';
 if(violation==='UNRESOLVED_REVIEW_FINDING')assert.equal(engine.operationalNextAction(q,26).operation,'RECONCILE','An unresolved audit review has no distinct reconciliation route');
 const observed=engine.semanticReviewCompletion(q,26);assert.equal(observed.complete,false,'AUDIT_REVIEW_ORACLE: accepted '+violation);
 verificationObservations.push({checkId:'S26-'+violation,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:2424'],boundary:'current independent review -> audit progression authority',expected:{accepted:false},observed:{accepted:observed.complete,reasons:observed.reasons},violation,accepted:false,passed:true});
}
const anchor='function semanticReviewCompletion(p,stage){',source=fs.readFileSync('workflow-engine.js','utf8');assert.equal(source.split(anchor).length-1,1);
const defective=projectStoreRuntime({sourceOverrides:{'workflow-engine.js':source.replace(anchor,anchor+"if(stage===26)return {complete:true,reasons:[],reviews:[],basis:null};")}}),counterexample=defective.copy(authored);
assert.throws(()=>assert.equal(defective.engine.semanticReviewCompletion(counterexample,26).complete,false,'AUDIT_REVIEW_ORACLE: controlled author bypass'),/AUDIT_REVIEW_ORACLE/);
verificationObservations.push({checkId:'S26-CONTROLLED-AUTHOR-BYPASS-DETECTED',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:2424'],boundary:'controlled former author-only approval -> independent boundary oracle',expected:{violationDetected:true},observed:{violationDetected:true,defectiveAccepted:true},passed:true});
console.log(JSON.stringify({stage26IndependentReview:'PASS',isolatedScopeFixture:true,completeJourneyProven:false,verificationObservations},null,2));

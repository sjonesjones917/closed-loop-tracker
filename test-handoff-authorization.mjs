import assert from 'node:assert/strict';

// Synthetic verifier setup only. The actual human-decision command, ordinary
// save, fresh reservation and byte review remain production boundaries. This
// never represents a real operator decision or an external actor execution.
export async function authorizeSyntheticHandoff(r,{project,prompt,options={},action=null,scanInspection=null}={}){
 const stage=Number(prompt.stage),operation=prompt.operation;
 const request=(state,instruction)=>({project:state,stage,operation,instructionId:instruction.instructionId,...(instruction.scope?.runId?{runId:instruction.scope.runId}:{}),...(options.testIds?{testIds:options.testIds}:{})});
 let review=await r.store.prepareExecutionPackageReview(request(project,prompt));
 const decisionIds=[];
 // Risk changes substantive manifest content. Persist/review it before the
 // separate disclosure decision; there is no unbounded approval retry loop.
 for(const purpose of ['EXTERNAL_ACTION_RISK_AUTHORIZATION','DISCLOSURE_AUTHORIZATION']){
  assert.equal(review.authorization.blocked,false,'SYNTHETIC_HANDOFF_SETUP: the current byte contract cannot be authorized: '+review.authorization.reasons.join(' '));
  if(!review.authorization.requiredPurposes.includes(purpose))continue;
  if(purpose==='EXTERNAL_ACTION_RISK_AUTHORIZATION')assert.ok(action,'SYNTHETIC_HANDOFF_SETUP: supply this fixture’s exact disposable external-action contract.');
  if(purpose==='DISCLOSURE_AUTHORIZATION'&&review.authorization.inspectionRequired)assert.ok(scanInspection,'SYNTHETIC_HANDOFF_SETUP: inspect this fixture’s actual marker bytes explicitly.');
  const beforeSubject=review.authorization.subjectSha256,next=r.copy(project);
  const decision=r.engine.recordHandoffAuthorization(next,{promptRecord:prompt,members:r.copy(review.members),scan:r.copy(review.scan),purpose,recipient:'Synthetic isolated verifier actor',provider:'Synthetic local verifier context',suitabilityBasis:'Only the declared disposable test fixture is supplied to this isolated verifier; no actual private user data or external transfer is involved.',operatorLabel:'SYNTHETIC_TEST_OPERATOR',confirmed:true,...(action?{action:r.copy(action)}:{}),...(scanInspection?{scanInspection:r.copy(scanInspection)}:{})});
  decisionIds.push(r.engine.recordId(decision,'humanDecisions'));
  let saved=await r.store.writeProject(next,{expectedProjectRevision:project.revision,expectedStateSha256:project.projectSha256});
  const reserved=r.copy(saved),prepared={...options,operation,scope:{...prompt.scope,...(options.scope||{})},...((prompt.contextManifest?.operationActorContextId||prompt.contextManifest?.semanticReviewBinding?.authorContextId)?{authorContextId:prompt.contextManifest.operationActorContextId||prompt.contextManifest.semanticReviewBinding.authorContextId}:{}),...(prompt.contextManifest?.semanticReviewBinding?.reviewerContextId?{reviewerContextId:prompt.contextManifest.semanticReviewBinding.reviewerContextId}:{}),...(prompt.contextManifest?.deferredDefinitionCorrectionTarget?{deferredDefinitionCorrectionTarget:prompt.contextManifest.deferredDefinitionCorrectionTarget}:{})};
  const issued=r.prompts.reserveAndBuildPromptRecord(reserved,stage,r.copy(prepared),{owningTabInstance:'SYNTHETIC_HANDOFF_VERIFIER'}).prompt;
  project=await r.store.writeProject(reserved,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
  prompt=project.projectData.generatedPrompts.find(item=>item.instructionId===issued.instructionId);review=await r.store.prepareExecutionPackageReview(request(project,prompt));
  if(purpose==='DISCLOSURE_AUTHORIZATION')assert.equal(review.authorization.subjectSha256,beforeSubject,'SYNTHETIC_HANDOFF_SETUP: authorization bookkeeping changed the material handoff subject.');
 }
 assert.equal(review.authorization.allowed,true,'SYNTHETIC_HANDOFF_SETUP: actual saved authorization did not permit its unchanged material handoff: '+review.authorization.reasons.join(' '));
 return {project,prompt,review,request:request(project,prompt),decisionIds};
}

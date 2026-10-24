import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {projectStoreRuntime,bindAcceptanceUi} from './test-project-store-runtime.mjs';
import {stage04AcceptanceFixture,stage04AcceptanceEnvelope,recordProposal,evidence} from './test-fixtures.mjs';
const r=projectStoreRuntime(),{core,engine,prompts,ingestion,store,copy,runtime}=r,schema=runtime.closedLoopWorkflowSchema,fixture={core,schema,engine,prompts,ingestion};
let p=await store.writeProject(copy(stage04AcceptanceFixture(fixture)),{expectedProjectRevision:0});
async function prepare(stage,operation,content){const draft=copy(p),prompt=prompts.reserveAndBuildPromptRecord(draft,stage,{operation}).prompt;p=await store.writeProject(draft,{expectedProjectRevision:p.revision});const response=stage===4?stage04AcceptanceEnvelope(fixture,p,prompt):{schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage,operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce,scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{},evidence:[evidence('reconciliation-confirmation')],unresolved:[],warnings:[],attachments:[],...content};const candidate=ingestion.prepare(p,{stage,text:JSON.stringify(response),promptRecord:prompt,expectedCommittedRevision:p.revision,transport:{packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce}});assert.equal(candidate.validation.valid,true,JSON.stringify(candidate.validation.issues));p=await store.writeProject(candidate.project,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,operational:true});return {candidate,response};}
async function accept(candidate){const prepared=ingestion.prepareAcceptanceCandidate(p,candidate.proposal.proposalId,{operator:'SYNTHETIC'});p=await store.writeProject(prepared.project,{expectedProjectRevision:p.revision,mutationConfirmation:prepared.acceptance?.impact});}
await accept((await prepare(4,'COMPLETE')).candidate);
const propId=engine.recordId(engine.recordsForCurrentScope(p,'propositions')[0],'propositions');
const stageData={DUPLICATES_REMAINING:'NONE',IMPOSSIBLE_COMBINATIONS:'NONE',UNDEFINED_TERMS:'NONE',CIRCULAR_DEPENDENCIES:'NONE',UNSUPPORTED_REQUIREMENTS:'NONE',APPLICABILITY_UNDETERMINED:'NONE',REQUIREMENTS_WITHOUT_VERIFICATION_PATH:'NONE'};
const applicability=key=>recordProposal(schema,'applicabilityRecords',{tempKey:key,relationships:{SUBJECT_ID:{recordId:propId}},overrides:{PROPOSED_APPLICABILITY:'APPLICABLE',REASONING:'The mandatory checklist requirement applies.'}});
const review=(key,result)=>recordProposal(schema,'semanticReviews',{tempKey:key,overrides:{REVIEW_QUESTION:'Is the current proposal sufficient?',FINDING:'Current decision reviewed against the governing evidence.',REASONING:'The current target and its supporting evidence were inspected.',RESULT:result}});
await accept((await prepare(5,'COMPLETE',{stageData,records:{applicabilityRecords:[applicability('applicability')]}})).candidate);
await accept((await prepare(5,'SEMANTIC_REVIEW',{records:{semanticReviews:[review('accepted','ACCEPTED'),review('rejected','REJECTED')]}})).candidate);
assert.equal(p.stages[5].status,'BLOCKED');
const {candidate,response}=await prepare(5,'RECONCILE_REQUIREMENT_SET',{stageData,records:{applicabilityRecords:[applicability('corrected-applicability')],semanticReviews:[review('reconciliation-finding','ACCEPTED')]}});

// Independent reviewer assertions. The fixture preparation above uses production
// reservation/ingestion/lifecycle paths with the existing transaction adapter.
const hash=runtime.closedLoopHash;
const canonical=x=>hash.sha256Value(x);
const original=copy(p),before=canonical(original),proposalId=candidate.proposal.proposalId;
const semantic=ingestion.prepareAcceptanceCandidate(p,proposalId,{operator:'INDEPENDENT-REVIEW'});
assert.equal(canonical(p),before,'INDEPENDENT_CANDIDATE_PREPARATION_MUTATED_SOURCE');
const storageImpact=store.mutationImpact(p,semantic.project);
assert.equal(storageImpact.requiresConfirmation,true,'INDEPENDENT_STORAGE_IMPACT_MUST_REQUIRE_CONFIRMATION');
const normalize=async value=>{if(value instanceof Blob)return {blobBase64:Buffer.from(await value.arrayBuffer()).toString('base64'),mediaType:value.type};if(value instanceof Map)return await Promise.all([...value].map(async ([k,v])=>[k,await normalize(v)]));if(value&&typeof value==='object'){const out=Array.isArray(value)?[]:{};for(const key of Object.keys(value))out[key]=await normalize(value[key]);return out;}return value;};
const storageSnapshot=async()=>JSON.stringify(await normalize(r.rows));
const beforeRows=await storageSnapshot();
for(const confirmation of [undefined,{confirmationKey:'INDEPENDENT-STALE-KEY'}]){
 await assert.rejects(store.writeProject(semantic.project,{expectedProjectRevision:p.revision,...(confirmation?{mutationConfirmation:confirmation}:{})}),e=>e.code==='MUTATION_CONFIRMATION_REQUIRED','INDEPENDENT_UNCONFIRMED_STORE_WRITE_MUST_REFUSE');
 assert.equal(canonical(p),before,'INDEPENDENT_REFUSAL_MUTATED_SOURCE');
 assert.equal(canonical(await store.readProject(p.job.JOB_ID)),before,'INDEPENDENT_REFUSAL_MUTATED_SAVED_PROJECT');
 assert.equal(await storageSnapshot(),beforeRows,'INDEPENDENT_REFUSAL_MUTATED_ANY_STORE_BYTES_OR_METADATA');
}
const failures=bindAcceptanceUi(r,p,proposalId);
await runtime.accept();
assert.equal(failures.length,0,failures.map(e=>e.stack).join('\n'));
assert.ok(runtime.replacementReview?.next,'INDEPENDENT_REAL_STORE_UI_MUST_SHOW_CONFIRMATION');
assert.equal(canonical(runtime.current),before,'INDEPENDENT_UI_PREVIEW_MUTATED_CURRENT');
assert.equal(canonical(await store.readProject(p.job.JOB_ID)),before,'INDEPENDENT_UI_PREVIEW_MUTATED_SAVED');
assert.equal(runtime.pendingProposal().status,'PENDING_OPERATOR_REVIEW');
vm.runInContext('globalThis.keep=keepCurrentProgress;',runtime);
await runtime.keep();
assert.equal(runtime.replacementReview,null);
assert.equal(canonical(runtime.current),before,'INDEPENDENT_KEEP_PROGRESS_MUTATED_CURRENT');
assert.equal(canonical(await store.readProject(p.job.JOB_ID)),before,'INDEPENDENT_KEEP_PROGRESS_MUTATED_SAVED');
await runtime.accept();assert.ok(runtime.replacementReview?.next);
await runtime.confirm();
assert.equal(failures.length,0,failures.map(e=>e.stack).join('\n'));
p=await store.readProject(p.job.JOB_ID);
assert.equal(p.revision,original.revision+1,'INDEPENDENT_CONFIRMATION_MUST_COMMIT_ONCE');
assert.equal(p.projectData.acceptedChanges.length,original.projectData.acceptedChanges.length+1);
assert.equal(p.stages[5].gate.complete,false,'INDEPENDENT_RECONCILIATION_MAY_NOT_SELF_APPROVE');
assert.equal(engine.operationalNextAction(p,5).operation,'SEMANTIC_REVIEW');
assert.deepEqual(p.projectData.rawResponses.map(row=>row.completeRawResponse),original.projectData.rawResponses.map(row=>row.completeRawResponse),'INDEPENDENT_CONFIRMATION_MUST_RETAIN_RAW_HISTORY');
for(const row of original.projectData.semanticReviews.filter(row=>Number(row.stage)===5))assert.ok(p.projectData.semanticReviews.some(saved=>saved.id===row.id&&saved.RESULT===row.RESULT),'INDEPENDENT_PRIOR_FINDING_MUST_REMAIN_HISTORY');
const confirmed=canonical(p),confirmedRevision=p.revision;
await runtime.confirm();
assert.equal(canonical(await store.readProject(p.job.JOB_ID)),confirmed,'INDEPENDENT_SECOND_CONFIRMATION_MUST_BE_NOOP');
assert.equal(p.revision,confirmedRevision);
const uiResult=copy(runtime.current);uiResult.job.JOB_TITLE='TEST MUTATION ONLY';
assert.equal(canonical(await store.readProject(p.job.JOB_ID)),confirmed,'INDEPENDENT_RETURNED_OBJECT_MUST_NOT_ALIAS_STORE');
await accept((await prepare(5,'SEMANTIC_REVIEW',{records:{semanticReviews:[review('independent-post-correction','ACCEPTED')]}})).candidate);
assert.equal(p.stages[5].gate.complete,true,'INDEPENDENT_POST_CORRECTION_REVIEW_MUST_PROGRESS');
console.log(JSON.stringify({independentConfirmationReview:'PASS',sourceBase:'7df5f46e9a7e54da09622387a978badb39916c09',candidateVerifierSha256:'79e0adab828c37010cb0a5e40d78bc564a1ecb364cfa0c308d53e5c5e81f3e57',checks:['production-store-no-confirmation-refused','production-store-stale-confirmation-refused','all-store-rows-and-blob-bytes-unchanged-on-refusal','full-current-and-persisted-project-unchanged-before-confirmation','actual-keep-current-progress-handler-preserves-canonical-state','one-complete-commit-after-confirmation','repeated-confirmation-noop','source-and-returned-object-isolation','raw-and-semantic-review-history-retained','reconciliation-requires-independent-review','independent-rereview-completes'],semanticImpactRequiresConfirmation:semantic.acceptance.impact.requiresConfirmation,storageImpactRequiresConfirmation:storageImpact.requiresConfirmation,basis:'Production ingestion, application confirmation handlers and actual project-store preparation/commit owners in disposable Map transaction adapter. Synthetic external responses; no native browser/IndexedDB or physical-device assertion.'},null,2));

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stage04AcceptanceFixture,stage04AcceptanceEnvelope,recordProposal,evidence} from './test-fixtures.mjs';

globalThis.dispatchEvent=()=>true;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=closedLoopCore,schema=closedLoopWorkflowSchema,engine=closedLoopWorkflowEngine,prompts=closedLoopPromptEngine,ingestion=closedLoopResponseIngestion,hash=closedLoopHash;
const runtime={core,schema,engine,prompts,ingestion};
let author=stage04AcceptanceFixture(runtime,'JOB-SEMANTIC-REVIEW-ACCEPTANCE');
function prepare(project,stage,operation,content){
  const prompt=prompts.reserveAndBuildPromptRecord(project,stage,{operation}).prompt;
  const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:project.job.JOB_ID,stage,operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce,scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],humanAuthorityCandidates:[],stageData:{},records:{},evidence:[evidence('review-evidence')],unresolved:[],warnings:[],attachments:[],...content(prompt)};
  const text=JSON.stringify(envelope),transport={authority:'NONAUTHORITATIVE_TEXT_FALLBACK',materializedAsResponseFile:true,packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce,promptIdentity:envelope.promptIdentity};
  return {...ingestion.prepare(project,{stage,promptRecord:prompt,text,transport}),text};
}
function accept(prepared){assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));return ingestion.commit(prepared.project,prepared.proposal.proposalId).project;}
author=accept(prepare(author,4,'COMPLETE',prompt=>stage04AcceptanceEnvelope(runtime,author,prompt)));
const propositionId=engine.recordId(engine.recordsForCurrentScope(author,'propositions')[0],'propositions');
const authorPrepared=prepare(author,5,'COMPLETE',()=>({stageData:{DUPLICATES_REMAINING:'NONE',IMPOSSIBLE_COMBINATIONS:'NONE',UNDEFINED_TERMS:'NONE',CIRCULAR_DEPENDENCIES:'NONE',UNSUPPORTED_REQUIREMENTS:'NONE',APPLICABILITY_UNDETERMINED:'NONE',REQUIREMENTS_WITHOUT_VERIFICATION_PATH:'NONE'},records:{applicabilityRecords:[recordProposal(schema,'applicabilityRecords',{tempKey:'applicability',relationships:{SUBJECT_ID:{recordId:propositionId}},overrides:{PROPOSED_APPLICABILITY:'APPLICABLE',REASONING:'The checklist requirement applies.'}})]}}));
author=accept(authorPrepared);
function review(results){return prepare(structuredClone(author),5,'SEMANTIC_REVIEW',()=>({records:{semanticReviews:results.map((result,index)=>recordProposal(schema,'semanticReviews',{tempKey:`review-${index}`,overrides:{REVIEW_QUESTION:`Independent question ${index}`,FINDING:`Independent finding ${index}`,REASONING:`Evidence for finding ${index}.`,RESULT:result}}))}}));}

// Execute the real UI acceptance handler with the production engine/ingestor.
// IndexedDB behavior remains covered by the existing local/deployed browser suite.
function application(project,operation='COMPLETE',{storageFailure=false}={}){
  let saved=structuredClone(project);saved.activeStage=5;
  const notices=[],runtime=vm.createContext({crypto:globalThis.crypto,URL,structuredClone,console,TextEncoder,TextDecoder,Blob,setTimeout,queueMicrotask,
    document:{currentScript:null,querySelector:()=>({value:''}),querySelectorAll:()=>[]},
    closedLoopCore:core,closedLoopWorkflowSchema:schema,closedLoopWorkflowEngine:engine,closedLoopPromptEngine:prompts,closedLoopResponseIngestion:ingestion,
    closedLoopHash:hash,closedLoopProjectStore:{...closedLoopProjectStore,replaceProject:async(next,{expectedProjectRevision})=>{
      assert.equal(expectedProjectRevision,saved.revision,'Continuation lost the compare-and-swap revision.');
      if(storageFailure)throw new Error('CONTROLLED_CONTINUATION_STORAGE_FAILURE');
      const candidate=structuredClone(next);candidate.revision=saved.revision+1;
      const integrity=closedLoopProjectStore.validateProjectIntegrity(candidate,{verifyDerived:false});assert.equal(integrity.valid,true,JSON.stringify(integrity.issues));
      saved=candidate;return candidate;
    }},selected:saved,operation,notices});
  const source=fs.readFileSync('app-core.js','utf8');
  vm.runInContext(source.slice(0,source.indexOf('globalThis.closedLoopAppReady=false;'))+`
    core=closedLoopCore;schema=closedLoopWorkflowSchema;engine=closedLoopWorkflowEngine;ingestion=closedLoopResponseIngestion;projectStore=closedLoopProjectStore;
    current=selected;projects=[current];operationSelection[5]=operation;
    withStorageActivity=async(label,work)=>work();render=()=>{};announce=message=>notices.push(message);reportResponseFailure=(message,error)=>{throw error||new Error(message);};reportActionFailure=error=>{throw error;};
    globalThis.ui={accept:acceptPendingProposal,restore:async()=>{current=await materializeProject(current);return current;},current:()=>current,prompt:()=>currentPromptRecord(5),selectedOperation:()=>selectedOperation(5),proposal:()=>proposalMarkup(5)};
  })();`,runtime);
  return {ui:runtime.ui,notices,saved:()=>saved};
}
{
  const blocked=accept(review(['REJECTED'])),first=ingestion.prepareStageContinuation(blocked,{stage:5});
  first.prompt.contextManifest.semanticReviewBinding=null; // An instruction saved by the old reconciliation path.
  const before=hash.sha256Value(blocked),plan=ingestion.prepareStageContinuation(blocked,{stage:5,preview:true});
  assert.equal(plan.needed,true,'An unbound old reconciliation instruction was reused.');
  assert.equal(hash.sha256Value(blocked),before,'Continuation preview mutated the project.');
  const replacement=ingestion.prepareStageContinuation(blocked,{stage:5});
  assert.notEqual(replacement.prompt.instructionId,first.prompt.instructionId);
  assert.equal(replacement.prompt.contextManifest.semanticReviewBinding.bindingStatus,'BOUND');
  assert(first.prompt.invalidatedBy,'The unusable instruction remained controlling.');
}
{
  const {ui,notices,saved}=application(authorPrepared.project,'COMPLETE',{storageFailure:true}),before=hash.sha256Value(saved());
  await assert.rejects(ui.accept(),/CONTROLLED_CONTINUATION_STORAGE_FAILURE/);
  assert.equal(hash.sha256Value(saved()),before,'A failed continuation save partly committed the response.');
  assert.equal(ui.current().projectData.responseProposals.at(-1).status,'PENDING_OPERATOR_REVIEW');
  assert.equal(notices.length,0,'A failed save announced success.');
}
{
  const {ui}=application(authorPrepared.project);await ui.accept();
  assert.equal(ui.current().stages[5].gate.complete,false,'Author response bypassed independent review.');
  assert.equal(ui.selectedOperation(),'SEMANTIC_REVIEW','Acceptance left the old author operation selected.');
  assert.equal(ui.prompt()?.operation,'SEMANTIC_REVIEW','Accepted Stage 5 work did not regenerate and save the next instruction.');
  assert.equal(ui.prompt().contextManifest.semanticReviewBinding.bindingStatus,'BOUND');
}

// A favorable row cannot hide a failed or unfinished row in the same review.
for(const result of ['REJECTED','PARTIAL','UNKNOWN','DISAGREED']){
  const prepared=review(['ACCEPTED',result]),saved=accept(prepared);
  const {ui}=application(prepared.project,'SEMANTIC_REVIEW');
  assert.match(ui.proposal(),/Record findings and prepare correction/,'A failed review is presented as an acceptance action.');
  await ui.accept();
  assert.equal(ui.selectedOperation(),'RECONCILE_REQUIREMENT_SET');
  assert.equal(ui.prompt()?.operation,'RECONCILE_REQUIREMENT_SET','Recording negative findings did not save the correction instruction.');
  assert.equal(ui.current().stages[5].gate.complete,false);
  assert.equal(saved.stages[5].gate.complete,false,`${result} was hidden by another ACCEPTED finding.`);
  assert.equal(saved.stages[6].status,'NOT STARTED',`${result} unlocked Stage 6.`);
  assert(saved.stages[5].gate.reasons.some(reason=>reason.includes(result)),`${result} is missing from the completion-gate explanation.`);
  assert.equal(saved.job.NEXT_REQUIRED_ACTION.operation,'RECONCILE_REQUIREMENT_SET',`${result} did not route to correction.`);
  assert.deepEqual(saved.projectData.semanticReviews.map(r=>r.fields.RESULT),['ACCEPTED',result],'Review findings were rewritten.');
}

// Follow the advertised correction operation all the way back to a complete
// independent review. A correction instruction that cannot close is a defect.
{
  const blocked=accept(review(['ACCEPTED','REJECTED']));
  const corrected=prepare(blocked,5,'RECONCILE_REQUIREMENT_SET',()=>({
    stageData:structuredClone(authorPrepared.proposal.envelope.stageData),
    records:{applicabilityRecords:[recordProposal(schema,'applicabilityRecords',{tempKey:'corrected-applicability',relationships:{SUBJECT_ID:{recordId:propositionId}},overrides:{PROPOSED_APPLICABILITY:'APPLICABLE',REASONING:'The independent reconciliation resolves the challenged condition against the governing evidence.'}})],semanticReviews:[recordProposal(schema,'semanticReviews',{tempKey:'reconciliation-finding',overrides:{REVIEW_QUESTION:'Was the challenged condition resolved?',FINDING:'The corrected decision resolves the challenge.',REASONING:'The changed decision preserves the governing condition.',RESULT:'ACCEPTED'}})]}
  }));
  const reconciliationPrompt=corrected.project.projectData.generatedPrompts.at(-1),priorReview=blocked.projectData.semanticReviews.at(-1);
  assert.equal(reconciliationPrompt.contextManifest.semanticReviewBinding?.bindingStatus,'BOUND','Stage 5 reconciliation has no application-bound context.');
  assert.notEqual(reconciliationPrompt.contextManifest.semanticReviewBinding.authorContextId,priorReview.AUTHOR_CONTEXT_ID,'Reconciliation reused the author context.');
  assert.notEqual(reconciliationPrompt.contextManifest.semanticReviewBinding.authorContextId,priorReview.REVIEWER_CONTEXT_ID,'Reconciliation reused the reviewer context.');
  const revised=accept(corrected);
  assert.equal(revised.stages[5].gate.complete,false,'Reconciliation approved its own corrected decisions.');
  assert.equal(revised.job.NEXT_REQUIRED_ACTION.operation,'SEMANTIC_REVIEW','Reconciliation loops without an independent review of the corrected decisions.');
  const rereview=prepare(revised,5,'SEMANTIC_REVIEW',()=>({records:{semanticReviews:[recordProposal(schema,'semanticReviews',{tempKey:'corrected-independent-review',overrides:{REVIEW_QUESTION:'Do the corrected decisions meet the governing condition?',FINDING:'Every corrected decision meets the condition.',REASONING:'Independent comparison of the exact corrected target set and evidence.',RESULT:'ACCEPTED'}})]}}));
  const complete=accept(rereview);
  assert.equal(complete.stages[5].gate.complete,true,'A resolved, independently re-reviewed correction remains permanently blocked by old findings.');
  assert.equal(complete.projectData.semanticReviews.filter(r=>r.fields.RESULT==='REJECTED').length,1,'Reconciliation erased the original rejected finding.');
  assert.equal(closedLoopProjectStore.validateProjectIntegrity(complete,{verifyDerived:false}).valid,true);
}

const allowed=['ACCEPTED','REJECTED','PARTIAL','UNKNOWN','DISAGREED'];
assert.deepEqual(schema.recordResponseFieldDefinition('semanticReviews','RESULT').enumValues,allowed);
assert.deepEqual(prompts.responseContractDescriptor(5,'SEMANTIC_REVIEW').records.semanticReviews.agentFields.RESULT.enumValues,allowed,'The generated response contract differs from ingestion.');
for(const value of ['PASS','FAIL','accepted','',null]){
  const prepared=review([value]);
  assert.equal(prepared.validation.valid,false,`${String(value)} reached proposal acceptance.`);
  assert.equal(prepared.proposal,null,'An invalid result produced an actionable proposal.');
  assert(prepared.validation.issues.some(issue=>issue.path.endsWith('/RESULT')),'Missing exact invalid-result pointer.');
  assert.equal(prepared.project.projectData.rawResponses.at(-1).completeRawResponse,prepared.text,'Rejected review bytes were lost.');
  assert.equal(prepared.project.projectData.semanticReviews.length,0,'Rejected review mutated canonical findings.');
}
for(const name of ['REVIEW_QUESTION','FINDING','REASONING','RESULT']){
  const prepared=review(['ACCEPTED']);delete prepared.proposal.envelope.records.semanticReviews[0].fields[name];
  assert.throws(()=>ingestion.commit(prepared.project,prepared.proposal.proposalId),error=>error.issues?.some(issue=>issue.code==='MISSING_REQUIRED_FIELD'&&issue.path.endsWith('/'+name)),`Missing ${name} was accepted.`);
}

// Revalidation must also catch a proposal created by the previous permissive contract.
const pending=review(['ACCEPTED']);
pending.proposal.envelope.records.semanticReviews[0].fields.RESULT='PASS';
const pendingHash=hash.sha256Value(pending.project);
assert.throws(()=>ingestion.commit(pending.project,pending.proposal.proposalId),error=>error.issues?.some(issue=>issue.code==='INVALID_ENUM_VALUE'));
assert.equal(hash.sha256Value(pending.project),pendingHash,'Rejection changed the pending project.');

const passed=accept(review(['ACCEPTED','ACCEPTED']));
assert.equal(passed.stages[5].gate.complete,true,'A complete valid independent review no longer passes.');
assert.equal(prompts.buildPromptRecord(6,passed,{operation:'COMPLETE'}).stage,6);
assert.equal(closedLoopProjectStore.validateProjectIntegrity(passed,{verifyDerived:false}).valid,true);

// Existing invalid history remains preserved and cannot gain authority on reload.
const legacy=structuredClone(passed),legacyReview=legacy.projectData.semanticReviews.at(-1);
legacyReview.fields.RESULT=legacyReview.RESULT='FAIL';
legacyReview.fields.ACCEPTED_DISPOSITION=legacyReview.ACCEPTED_DISPOSITION='UNKNOWN';
legacyReview.fields.GATE_EFFECT=legacyReview.GATE_EFFECT='BLOCK';
engine.refreshRecordHashes(legacyReview,'semanticReviews');engine.recalculate(legacy);
assert.equal(legacy.stages[5].gate.complete,false,'A stored unrecognized result allowed completion.');
assert.equal(legacy.job.NEXT_REQUIRED_ACTION.operation,'SEMANTIC_REVIEW');
assert.match(legacy.job.NEXT_REQUIRED_ACTION.explanation,/unrecognized result/i);
assert.equal(legacyReview.fields.RESULT,'FAIL','Legacy evidence was silently normalized.');
const legacyHash=hash.sha256Value(legacy),legacyRaw=legacy.projectData.rawResponses.map(r=>r.completeRawResponse);
const legacyUi=application(legacy,'SEMANTIC_REVIEW');await legacyUi.ui.restore();
assert.equal(engine.recordsForCurrentScope(legacyUi.ui.current(),'semanticReviews').length,0,'Opening the saved project did not recover its invalid accepted review.');
assert.equal(legacyUi.ui.prompt()?.operation,'SEMANTIC_REVIEW','Opening the saved project did not save the correction instruction.');
const reloadRevision=legacyUi.ui.current().revision,reloadPrompt=legacyUi.ui.prompt().instructionId;await legacyUi.ui.restore();
assert.equal(legacyUi.ui.current().revision,reloadRevision,'Opening the recovered project wrote another revision.');
assert.equal(legacyUi.ui.prompt().instructionId,reloadPrompt,'Opening the recovered project replaced the saved instruction again.');
const recovered=ingestion.recoverInvalidSemanticReviews(legacy);
assert.equal(recovered.changed,true,'The legacy accepted review has no automatic recovery.');
assert.equal(hash.sha256Value(legacy),legacyHash,'Preparing recovery changed the original project.');
assert.deepEqual(recovered.project.projectData.rawResponses.map(r=>r.completeRawResponse),legacyRaw,'Automatic recovery rewrote the original responses.');
assert.equal(engine.recordsForCurrentScope(recovered.project,'semanticReviews').length,0);
assert.equal(recovered.continuation?.prompt.operation,'SEMANTIC_REVIEW','Automatic recovery did not save its replacement instruction.');
assert.match(recovered.continuation.prompt.prompt,/unsupported RESULT values/);
assert.equal(recovered.project.stages[5].gate.complete,false);
assert.equal(recovered.project.stages[6].status,'NOT STARTED');
assert.equal(ingestion.recoverInvalidSemanticReviews(recovered.project).changed,false,'Reload repeated the repair.');
assert.equal(ingestion.prepareStageContinuation(recovered.project,{stage:5}).created,false,'Reload regenerated a controlling instruction again.');
assert.equal(closedLoopProjectStore.validateProjectIntegrity(recovered.project,{verifyDerived:false}).valid,true);
engine.invalidateAcceptedResponse(legacy,{stage:5,rawResponseId:legacyReview.rawResponseId,reason:'The saved review uses an unrecognized result.'});
assert.equal(engine.recordsForCurrentScope(legacy,'semanticReviews').length,0,'Correction left invalid findings current.');
const replacement=prompts.reserveAndBuildPromptRecord(legacy,5,{operation:'SEMANTIC_REVIEW'}).prompt;
assert.equal(replacement.contextManifest.semanticReviewBinding.bindingStatus,'BOUND','The existing correction action cannot produce a replacement review.');
console.log(JSON.stringify({semanticReviewAcceptance:'PASS',automaticNextInstruction:true,automaticLegacyRecovery:true,reconciliationThenIndependentReview:true,invalidResultsRejected:true,mixedFindingsCannotPass:true,negativeFindingsRouteToCorrection:true,legacyEvidencePreserved:true,validReviewUnlocksStage6:true}));

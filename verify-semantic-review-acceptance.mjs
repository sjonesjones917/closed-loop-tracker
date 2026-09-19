import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stage04AcceptanceFixture,stage04AcceptanceEnvelope,recordProposal,evidence} from './test-fixtures.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';

globalThis.dispatchEvent=()=>true;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js']){
 let source=fs.readFileSync(file,'utf8');
 if(file==='workflow-engine.js'&&process.argv.includes('--fault=review-request-invalidates')){const anchor='  if(author?.operation===policy.reconcileOperation';assert.ok(source.includes(anchor));source=source.replace(anchor,"  for(const prompt of safe(p.projectData.generatedPrompts).filter(row=>Number(row.stage)===n&&!row.invalidatedBy&&policy.reviewOperations.includes(row.operation)))requested.add(prompt.operation);\n"+anchor);}
 createVerifierRuntime.loadScript(globalThis,source,{filename:file});
}
const core=closedLoopCore,schema=closedLoopWorkflowSchema,engine=closedLoopWorkflowEngine,prompts=closedLoopPromptEngine,ingestion=closedLoopResponseIngestion,hash=closedLoopHash;
const runtime={core,schema,engine,prompts,ingestion};
let author=stage04AcceptanceFixture(runtime,'JOB-SEMANTIC-REVIEW-ACCEPTANCE');
function prepare(project,stage,operation,content){
  const prompt=prompts.reserveAndBuildPromptRecord(project,stage,{operation}).prompt;
  const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:project.job.JOB_ID,stage,operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce,scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],humanAuthorityCandidates:[],stageData:{},records:{},evidence:[evidence('review-evidence')],unresolved:[],warnings:[],attachments:[],...content(prompt)};
  const text=JSON.stringify(envelope),transport={authority:'NONAUTHORITATIVE_TEXT_FALLBACK',materializedAsResponseFile:true,packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce,promptIdentity:envelope.promptIdentity};
  const prepared=ingestion.prepare(project,{stage,promptRecord:prompt,text,transport});if(prepared.validation.valid)assert.equal(engine.operationalNextAction(prepared.project,stage).actionType,'REVIEW_PROPOSAL',`Stage ${stage} replaced a pending proposal with another instruction.`);return {...prepared,text};
}
function accept(prepared){assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));const impact=ingestion.acceptanceImpact(prepared.project,prepared.proposal.proposalId);if(impact.requiresConfirmation)assert.throws(()=>ingestion.commit(prepared.project,prepared.proposal.proposalId),error=>error.code==='REPLACEMENT_CONFIRMATION_REQUIRED');return ingestion.commit(prepared.project,prepared.proposal.proposalId,{replacementConfirmation:impact}).project;}
// An orphaned historical audit row is not a live saved-instruction attempt.
// Opening a backup may recalculate its old display without rewriting its audit projection.
{
  const p=core.createBlankState('JOB-ORPHAN-RESPONSE-AUDIT');engine.ensureShape(p);engine.recalculate(p);
  p.projectData.rawResponses.push({rawResponseId:'RAW-OLD-PROJECTION',stage:1,completeRawResponse:'Exact original AUDIT-TAIL'});
  engine.recalculate(p);const before=hash.sha256Value(p);
  assert.equal(ingestion.prepareStageContinuation(p,{stage:1,preview:true}),null,'An orphaned audit record requested a new live instruction.');
  assert.equal(ingestion.prepareStageContinuation(p,{stage:1}),null,'An orphaned audit record changed the saved backup projection.');
  assert.equal(hash.sha256Value(p),before,'Inspecting historical audit data mutated the project.');
}
// Requesting another review preserves accepted progress until its response is
// validated and accepted; the pending operation remains separately actionable.
for(const [stage,operation] of [[1,'SEMANTIC_CHALLENGE'],[2,'SEARCH_ADEQUACY_REVIEW'],[3,'SEMANTIC_CHALLENGE'],[4,'DISPOSITION_CHALLENGE'],[4,'ATOMICITY_CHALLENGE']]){
  let p=stage04AcceptanceFixture(runtime,'JOB-REQUESTED-REVIEW-'+stage+'-'+operation);
  if(stage===4)p=accept(prepare(p,4,'COMPLETE',prompt=>stage04AcceptanceEnvelope(runtime,p,prompt)));
  assert.equal(p.stages[stage].gate.complete,true);
  const completedBefore=Object.values(p.stages).map(row=>row.status),before=hash.sha256Value(p),preview=engine.preparePromptContext(p,stage,{operation},{preview:true});
  prompts.buildPromptRecord(stage,preview.project,preview.options);
  assert.equal(hash.sha256Value(p),before,'Review preview mutated accepted work.');
  const saved=prompts.reserveAndBuildPromptRecord(p,stage,{operation}).prompt;
  assert.equal(p.stages[stage].gate.complete,true,`REVIEW_REQUEST_PROGRESS_ORACLE: requesting a Stage ${stage} review changed accepted completion.`);
  assert.deepEqual(Object.values(p.stages).map(row=>row.status),completedBefore,'Requesting a review changed existing downstream progress.');
  assert.equal(engine.operationalNextAction(p,stage).operation,operation);
  assert.equal(ingestion.prepareStageContinuation(p,{stage})?.prompt.instructionId,saved.instructionId,'Recovery replaced the requested review with another instruction.');
}
// The same failed-review rule applies to every operation using this canonical
// family, including source-search reviews before requirement compilation.
for(const result of ['REJECTED','PARTIAL','UNKNOWN','DISAGREED']){
  const sourceReview=accept(prepare(stage04AcceptanceFixture(runtime,'JOB-SOURCE-REVIEW-'+result),2,'SEARCH_ADEQUACY_REVIEW',()=>({records:{semanticReviews:[recordProposal(schema,'semanticReviews',{tempKey:'source-review',overrides:{REVIEW_QUESTION:'Was the bounded search sufficient?',FINDING:'A required source category is unresolved.',REASONING:'The governing source category has not been exhausted.',RESULT:result}})]}})));
  assert.equal(sourceReview.stages[2].gate.complete,false,`Stage 02 ${result} review was ignored by its completion gate.`);
  assert.equal(sourceReview.stages[3].status,'NOT STARTED',`Stage 02 ${result} unlocked downstream research.`);
  assert.equal(sourceReview.job.NEXT_REQUIRED_ACTION.operation,'RECONCILE_SOURCE_SEARCH','The blocked source review has no correction route.');
  assert.equal(ingestion.prepareStageContinuation(sourceReview,{stage:2})?.prompt.operation,'RECONCILE_SOURCE_SEARCH','Stage 02 does not save its correction instruction.');
}
for(const [stage,operation] of [[1,'SEMANTIC_CHALLENGE'],[3,'SEMANTIC_CHALLENGE'],[4,'DISPOSITION_CHALLENGE'],[4,'ATOMICITY_CHALLENGE']]){
  let p=stage04AcceptanceFixture(runtime,'JOB-CHALLENGE-'+stage+'-'+operation);
  if(stage===4)p=accept(prepare(p,4,'COMPLETE',prompt=>stage04AcceptanceEnvelope(runtime,p,prompt)));
  p=accept(prepare(p,stage,operation,()=>({records:{semanticChallenges:[recordProposal(schema,'semanticChallenges',{tempKey:'rejected-challenge',overrides:{FINDINGS:'A controlling obligation is unresolved.',DISPOSITION:'REJECTED',REASONING:'The proposed work omits the governing condition.'}})]}})));
  if(stage===1){const change=engine.acceptedChanges(p,1).at(-1);engine.recordStageConfirmation(p,1,true,'The objective is correctly represented; this does not resolve the challenge.','FIXTURE',{acceptedChangeId:change.changeId,inputVersion:p.job.CURRENT_INPUT_VERSION});}
  assert.equal(p.stages[stage].gate.complete,false,`Stage ${stage} ${operation} ignored its rejected challenge.`);
  assert.equal(p.job.NEXT_REQUIRED_ACTION.operation,schema.SEMANTIC_STAGE_OPERATIONS[stage].reconcileOperation,`Stage ${stage} has no challenge correction route.`);
  const policy=schema.SEMANTIC_STAGE_OPERATIONS[stage],finding={records:{semanticReviews:[recordProposal(schema,'semanticReviews',{tempKey:'resolved-challenge',overrides:{REVIEW_QUESTION:'Was the challenged condition resolved?',FINDING:'The corrected work resolves the condition.',REASONING:'The governing evidence resolves the challenged decision.',RESULT:'ACCEPTED'}})]}};
  p=accept(prepare(p,stage,policy.reconcileOperation,prompt=>stage===4?stage04AcceptanceEnvelope(runtime,p,prompt):{...finding,...(stage===1?{stageData:structuredClone(p.stages[1].agentData)}:{})}));
  assert.equal(p.stages[stage].gate.complete,false,`Stage ${stage} reconciler approved its own correction.`);
  for(const op of policy.reviewOperations){
    assert.equal(p.job.NEXT_REQUIRED_ACTION.operation,op,`Stage ${stage} did not select the next independent challenge.`);
    p=accept(prepare(p,stage,op,()=>({records:{semanticChallenges:[recordProposal(schema,'semanticChallenges',{tempKey:'independent-corrected-challenge',overrides:{FINDINGS:'The corrected decisions retain the governing condition.',DISPOSITION:'ACCEPTED',REASONING:'Independent comparison of the revised decisions with their governing source.'}})]}})));
  }
  if(stage===1){const change=engine.acceptedChanges(p,1).at(-1);engine.recordStageConfirmation(p,1,true,'The reviewed objective and deliverable match the represented intent.','FIXTURE',{acceptedChangeId:change.changeId,inputVersion:p.job.CURRENT_INPUT_VERSION});}
  assert.equal(p.stages[stage].gate.complete,true,`Stage ${stage} correction cannot finish after independent review.`);
  assert(p.projectData.semanticChallenges.some(r=>r.DISPOSITION==='REJECTED'&&r.active===false),'Correction erased the original challenge.');
  if(stage===1){p=accept(prepare(p,1,'COMPLETE',()=>({stageData:{...p.stages[1].agentData,EXACT_DELIVERABLE_REQUESTED:'Revised one-page checklist.'}})));const change=engine.acceptedChanges(p,1).at(-1);engine.recordStageConfirmation(p,1,true,'The revised deliverable matches the requested intent.','FIXTURE',{acceptedChangeId:change.changeId,inputVersion:p.job.CURRENT_INPUT_VERSION});assert.equal(p.stages[1].gate.complete,false,'An earlier challenge approved a new authored intake merely because its author context was reused.');assert.equal(p.job.NEXT_REQUIRED_ACTION.operation,'SEMANTIC_CHALLENGE');}
}
// A bounded search record requires current review authority. Historical author
// prompts without context binding return through authoring; they do not invent
// an independent identity or approve the search during project recovery.
{
  let p=stage04AcceptanceFixture(runtime,'JOB-LEGACY-SOURCE-AUTHOR');
  p=accept(prepare(p,2,'COMPLETE',()=>({stageData:structuredClone(p.stages[2].agentData),records:{sourceSearchContracts:[recordProposal(schema,'sourceSearchContracts',{tempKey:'bounded-search'})]}})));
  assert.equal(p.stages[2].gate.complete,false);assert.equal(p.job.NEXT_REQUIRED_ACTION.operation,'SEARCH_ADEQUACY_REVIEW');
  p.projectData.generatedPrompts.at(-1).contextManifest.semanticReviewBinding=null;engine.recalculate(p);
  const raw=p.projectData.rawResponses.map(r=>r.completeRawResponse),next=ingestion.prepareStageContinuation(p,{stage:2});
  assert.equal(next.prompt.operation,'COMPLETE');assert.equal(next.prompt.contextManifest.semanticReviewBinding.bindingStatus,'BOUND');
  assert.deepEqual(p.projectData.rawResponses.map(r=>r.completeRawResponse),raw);assert.equal(p.stages[2].gate.complete,false);
}

// A corrected source review must close through another independent review,
// preserving the original failed result and using a distinct reconciler.
{
  let p=stage04AcceptanceFixture(runtime,'JOB-SOURCE-REVIEW-CORRECTION');
  const rows=result=>({records:{semanticReviews:[recordProposal(schema,'semanticReviews',{tempKey:'source-finding',overrides:{REVIEW_QUESTION:'Is the bounded source search adequate?',FINDING:result==='ACCEPTED'?'The corrected search resolves the identified gap.':'A required search category is missing.',REASONING:'The complete governed scope was compared with the source evidence.',RESULT:result}})]}});
  p=accept(prepare(p,2,'SEARCH_ADEQUACY_REVIEW',()=>rows('REJECTED')));
  const priorReview=p.projectData.semanticReviews.at(-1);
  p=accept(prepare(p,2,'RECONCILE_SOURCE_SEARCH',()=>rows('ACCEPTED')));
  assert.equal(p.stages[2].gate.complete,false,'Source reconciliation approved itself.');
  assert.equal(p.job.NEXT_REQUIRED_ACTION.operation,'SEARCH_ADEQUACY_REVIEW');
  const reconciler=p.projectData.generatedPrompts.at(-1).contextManifest.semanticReviewBinding.authorContextId;
  assert.notEqual(reconciler,priorReview.AUTHOR_CONTEXT_ID);assert.notEqual(reconciler,priorReview.REVIEWER_CONTEXT_ID);
  p=accept(prepare(p,2,'SEARCH_ADEQUACY_REVIEW',()=>rows('ACCEPTED')));
  assert.equal(p.stages[2].gate.complete,true,'Corrected source search remains permanently blocked.');
  assert(p.projectData.semanticReviews.some(r=>r.RESULT==='REJECTED'&&r.active===false));
  assert.equal(closedLoopProjectStore.validateProjectIntegrity(p,{verifyDerived:false}).valid,true);
  prompts.reserveAndBuildPromptRecord(p,2,{operation:'SEARCH_ADEQUACY_REVIEW'});
  assert.equal(p.stages[2].gate.complete,true,'REVIEW_REQUEST_PROGRESS_ORACLE: a pending repeated review replaced the accepted approval.');
  assert.equal(engine.operationalNextAction(p,2).operation,'SEARCH_ADEQUACY_REVIEW');
}
author=accept(prepare(author,4,'COMPLETE',prompt=>stage04AcceptanceEnvelope(runtime,author,prompt)));
const propositionId=engine.recordId(engine.recordsForCurrentScope(author,'propositions')[0],'propositions');
const authorPrepared=prepare(author,5,'COMPLETE',()=>({stageData:{DUPLICATES_REMAINING:'NONE',IMPOSSIBLE_COMBINATIONS:'NONE',UNDEFINED_TERMS:'NONE',CIRCULAR_DEPENDENCIES:'NONE',UNSUPPORTED_REQUIREMENTS:'NONE',APPLICABILITY_UNDETERMINED:'NONE',REQUIREMENTS_WITHOUT_VERIFICATION_PATH:'NONE'},records:{applicabilityRecords:[recordProposal(schema,'applicabilityRecords',{tempKey:'applicability',relationships:{SUBJECT_ID:{recordId:propositionId}},overrides:{PROPOSED_APPLICABILITY:'APPLICABLE',REASONING:'The checklist requirement applies.'}})]}}));
author=accept(authorPrepared);
function review(results){return prepare(structuredClone(author),5,'SEMANTIC_REVIEW',()=>({records:{semanticReviews:results.map((result,index)=>recordProposal(schema,'semanticReviews',{tempKey:`review-${index}`,overrides:{REVIEW_QUESTION:`Independent question ${index}`,FINDING:`Independent finding ${index}`,REASONING:`Evidence for finding ${index}.`,RESULT:result}}))}}));}

// Execute the real UI acceptance handler with the production engine/ingestor.
// IndexedDB behavior remains covered by the existing local/deployed browser suite.
function application(project,operation='COMPLETE',{storageFailure=false,stage=5}={}){
  let saved=structuredClone(project);saved.activeStage=stage;
  const refineButton={textContent:'Refine accepted result',disabled:false,isConnected:true},notices=[],runtime=createVerifierRuntime({crypto:globalThis.crypto,URL,structuredClone,console,TextEncoder,TextDecoder,Blob,setTimeout,clearTimeout,queueMicrotask,requestAnimationFrame:callback=>queueMicrotask(callback),
    document:{currentScript:null,querySelector:selector=>selector==='#refine-accepted-response'?refineButton:selector==='#accepted-refinement-reason'?{value:'Correct the governing condition.'}:selector==='#operator-label'?{value:'FIXTURE'}:{value:'',textContent:'',focus(){},scrollIntoView(options){assert.equal(options.block,'start','Replacement confirmation heading must be scrolled into view.');},setAttribute(){},removeAttribute(){}},querySelectorAll:()=>[]},
    closedLoopCore:core,closedLoopWorkflowSchema:schema,closedLoopWorkflowEngine:engine,closedLoopPromptEngine:prompts,closedLoopResponseIngestion:ingestion,
    closedLoopHash:{...hash,sha256Value:value=>hash.sha256Value(structuredClone(value))},closedLoopProjectStore:{...closedLoopProjectStore,replaceProject:async(next,{expectedProjectRevision})=>{
      assert.equal(expectedProjectRevision,saved.revision,'Continuation lost the compare-and-swap revision.');
      if(storageFailure)throw new Error('CONTROLLED_CONTINUATION_STORAGE_FAILURE');
      const candidate=structuredClone(next);candidate.revision=saved.revision+1;
      const integrity=closedLoopProjectStore.validateProjectIntegrity(candidate,{verifyDerived:false});assert.equal(integrity.valid,true,JSON.stringify(integrity.issues));
      saved=candidate;return candidate;
    }},selected:saved,operation,stage,notices});
  const source=fs.readFileSync('app-core.js','utf8');
  vm.runInContext(source.slice(0,source.indexOf('globalThis.closedLoopAppReady=false;'))+`
    core=closedLoopCore;schema=closedLoopWorkflowSchema;engine=closedLoopWorkflowEngine;ingestion=closedLoopResponseIngestion;projectStore=closedLoopProjectStore;
    current=selected;projects=[current];operationSelection[stage]=operation;
    captureCurrentView=async()=>{};captureView=()=>null;recordCommittedBoundary=async()=>{};withStorageActivity=async(label,work)=>work();render=()=>{};announce=message=>notices.push(message);reportResponseFailure=(message,error)=>{throw error||new Error(message);};reportActionFailure=error=>{throw error;};
    globalThis.ui={accept:async()=>{await acceptPendingProposal();if(replacementReview)await confirmReplacement();},refine:()=>{const select=document.querySelector;document.querySelector=selector=>['#refine-accepted-response','#accepted-refinement-reason','#operator-label'].includes(selector)?select(selector):null;wire();document.querySelector=select;return document.querySelector('#refine-accepted-response').onclick();},restore:async()=>{current=await materializeProject(current);return current;},current:()=>current,prompt:()=>currentPromptRecord(stage),selectedOperation:()=>selectedOperation(stage),proposal:()=>proposalMarkup(stage)};
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

// The shared handler and saved-project recovery must also work outside Stage 05.
{
  const source=stage04AcceptanceFixture(runtime,'JOB-SOURCE-UI-RECOVERY'),prepared=prepare(source,2,'SEARCH_ADEQUACY_REVIEW',()=>({records:{semanticReviews:[recordProposal(schema,'semanticReviews',{tempKey:'source-ui-finding',overrides:{REVIEW_QUESTION:'Is the search adequate?',FINDING:'The scope remains unresolved.',REASONING:'A required category is missing.',RESULT:'REJECTED'}})]}})),{ui}=application(prepared.project,'SEARCH_ADEQUACY_REVIEW',{stage:2});
  assert.match(ui.proposal(),/Record findings and prepare correction/);await ui.accept();
  assert.equal(ui.prompt()?.operation,'RECONCILE_SOURCE_SEARCH');assert.equal(ui.current().stages[2].gate.complete,false);
  const reopened=application(ui.current(),'SEARCH_ADEQUACY_REVIEW',{stage:2});await reopened.ui.restore();assert.equal(reopened.ui.selectedOperation(),'SEARCH_ADEQUACY_REVIEW','Restoration changed the recorded operation selection.');assert.ok(reopened.ui.current().projectData.generatedPrompts.some(prompt=>prompt.operation==='RECONCILE_SOURCE_SEARCH'&&!prompt.invalidatedBy),'The saved continuation was lost.');
  const legacy=accept(prepared),finding=legacy.projectData.semanticReviews.at(-1);finding.fields.RESULT=finding.RESULT='FAIL';engine.refreshRecordHashes(finding,'semanticReviews');engine.recalculate(legacy);
  const raw=legacy.projectData.rawResponses.map(r=>r.completeRawResponse),recovered=application(legacy,'SEARCH_ADEQUACY_REVIEW',{stage:2});await recovered.ui.restore();
  assert.ok(engine.recordsForCurrentScope(recovered.ui.current(),'semanticReviews').length>0,'Ordinary restoration silently rewrote a retained legacy result.');assert.notEqual(recovered.ui.current().stages[2].status,'COMPLETE','Unsupported review value conferred stage completion.');
  assert.equal(recovered.ui.prompt(),null,'Restoration must not expose an accepted terminal reservation as a current handoff.');assert.equal(recovered.ui.selectedOperation(),'SEARCH_ADEQUACY_REVIEW');assert.deepEqual(recovered.ui.current().projectData.rawResponses.map(r=>r.completeRawResponse),raw);
}

// Controlled refinement must save its replacement immediately, in the same
// persistence transaction, instead of leaving only an unsaved text preview.
{
  const source=stage04AcceptanceFixture(runtime,'JOB-SOURCE-REFINEMENT-INSTRUCTION'),{ui}=application(source,'COMPLETE',{stage:2});
  await ui.refine();assert(ui.prompt()&&!ui.prompt().invalidatedBy,'Controlled accepted-result refinement did not save a replacement instruction.');
  assert(ui.prompt().prompt.includes('Correct the governing condition.'),'Refinement instruction lost the operator correction reason.');
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

// Proof-review correction uses the same continuation and independence rule.
const requirementId=engine.recordId(engine.recordsForCurrentScope(passed,'requirements')[0],'requirements');
const suite=()=>({records:{tests:[recordProposal(schema,'tests',{tempKey:'proof-test',relationships:{REQ_ID:{recordId:requirementId}},overrides:{TEST_TYPE:'DETERMINISTIC',TEST_ROLE:'REQUIRED_PROOF',TEST_PROPOSITION_TEXT:'Required checklist content is present.',TESTED_SCOPE:'Current checklist',POSITIVE_RESULT_MEANING:'Required content is present.',NEGATIVE_RESULT_MEANING:'Required content is missing.'}})],proofExpressions:[recordProposal(schema,'proofExpressions',{tempKey:'proof-expression',relationships:{TARGET_PROPOSITION_ID:{recordId:propositionId}},overrides:{PROPOSED_EXPRESSION:{type:'LEAF',testId:{tempKey:'proof-test'},requiredDisposition:'SATISFIED',truthExtraction:'ACCEPTED_ENTAILMENT',evidenceClasses:['OBSERVATION_RECORD','ACCEPTED_ENTAILMENT'],scopeBinding:'CURRENT'},SEMANTIC_RATIONALE:'This test directly establishes the checklist condition.'}})]}});
const proofFinding=result=>({records:{semanticReviews:[recordProposal(schema,'semanticReviews',{tempKey:'proof-review',overrides:{REVIEW_QUESTION:'Does the suite prove the governing proposition?',FINDING:result==='ACCEPTED'?'The corrected suite preserves the proposition.':'The required proof is unresolved.',REASONING:'Independent comparison of the exact current tests and proof expressions.',RESULT:result}})]}});
const suitePrepared=prepare(structuredClone(passed),6,'COMPLETE',suite),suiteUi=application(suitePrepared.project,'COMPLETE',{stage:6});await suiteUi.ui.accept();
assert.equal(suiteUi.ui.prompt()?.operation,'PROOF_REVIEW');
for(const result of ['REJECTED','PARTIAL','UNKNOWN','DISAGREED']){
  let p=accept(prepare(accept(suitePrepared),6,'PROOF_REVIEW',()=>proofFinding(result)));
  assert.equal(p.stages[6].gate.complete,false,`Stage 06 ${result} passed.`);
  assert.equal(p.job.NEXT_REQUIRED_ACTION.operation,'RECONCILE_VERIFICATION_SUITE',`Stage 06 ${result} did not route to correction.`);
  p=accept(prepare(p,6,'RECONCILE_VERIFICATION_SUITE',suite));
  assert.equal(p.stages[6].gate.complete,false,'The proof reconciler approved its own suite.');
  assert.equal(p.job.NEXT_REQUIRED_ACTION.operation,'PROOF_REVIEW');
  p=accept(prepare(p,6,'PROOF_REVIEW',()=>proofFinding('ACCEPTED')));
  assert.equal(p.stages[6].gate.complete,true,'The corrected proof suite cannot complete.');
  assert(p.projectData.semanticReviews.some(r=>r.RESULT===result&&r.active===false),'The prior failed proof review was erased.');
}

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
assert.ok(engine.recordsForCurrentScope(legacyUi.ui.current(),'semanticReviews').length>0,'Restoration silently discarded the saved review.');assert.deepEqual(legacyUi.ui.current().projectData,legacy.projectData,'Restoration changed working project data.');
assert.equal(legacyUi.ui.prompt(),null,'A terminal accepted instruction must remain history rather than a current handoff.');
const reloadRevision=legacyUi.ui.current().revision,reloadPrompts=structuredClone(legacyUi.ui.current().projectData.generatedPrompts);await legacyUi.ui.restore();
assert.equal(legacyUi.ui.current().revision,reloadRevision,'Opening the recovered project wrote another revision.');
assert.deepEqual(legacyUi.ui.current().projectData.generatedPrompts,reloadPrompts,'Opening the recovered project replaced its retained instructions.');
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
console.log(JSON.stringify({semanticReviewAcceptance:'PASS',orphanAuditIsNotLiveAttempt:true,requestedReviewPreservesAcceptedProgress:true,pendingReviewIsSeparatelyActionable:true,semanticReviewStages:[1,2,3,4,5,6],pendingProposalsPreserved:true,recordedOperationSelectionPreserved:true,commandGatesUseCurrentOwner:true,automaticNextInstruction:true,explicitLegacyRecovery:true,restorationDoesNotExecuteCorrection:true,reconciliationThenIndependentReview:true,invalidResultsRejected:true,mixedFindingsCannotPass:true,negativeFindingsRouteToCorrection:true,legacyEvidencePreserved:true,validReviewUnlocksStage6:true}));

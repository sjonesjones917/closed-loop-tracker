import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import vm from 'node:vm';
import {stage01AcceptanceFixture,stage04AcceptanceFixture,stage04AcceptanceEnvelope,boundedSearchProposal,registerFixtureSourceSearchCapability,recordProposal,evidence} from './test-fixtures.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';

globalThis.dispatchEvent=()=>true;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js']){
 let source=fs.readFileSync(file,'utf8');
 if(file==='workflow-schema.js'&&process.argv.includes('--fault=source-search-completeness')){const anchor='function sourceSearchContractIssues(fields){';assert.ok(source.includes(anchor));source=source.replace(anchor,anchor+'return [];');}
 if(file==='workflow-schema.js'&&process.argv.includes('--fault=stage04-review-subjects')){const before="DISPOSITION_CHALLENGE:Object.freeze({readCollections:['research','candidateRequirements','sources','evidenceRecords','sourceConflicts','requirements']";assert.ok(source.includes(before),'Stage04 disposition withholding fault must reach the repaired read owner.');source=source.replace(before,before.replace(",'requirements'",''));}
 if(file==='workflow-schema.js'&&process.argv.includes('--fault=stage04-atomicity-subjects')){const before="ATOMICITY_CHALLENGE:Object.freeze({readCollections:['research','candidateRequirements','sources','evidenceRecords','sourceConflicts','requirements','propositions']";assert.ok(source.includes(before),'Stage04 atomicity withholding fault must reach the repaired read owner.');source=source.replace(before,before.replace(",'propositions'",''));}
 if(file==='workflow-engine.js'&&process.argv.includes('--fault=source-search-bindings')){const guard="const capability=sourceSearchCapabilityState(project,contract);reasons.push(...capability.reasons);";assert.ok(source.includes(guard));source=source.replace(guard,'');}
 if(file==='workflow-engine.js'&&process.argv.includes('--fault=review-request-invalidates')){const anchor='  if(author?.operation===policy.reconcileOperation';assert.ok(source.includes(anchor));source=source.replace(anchor,"  for(const prompt of safe(p.projectData.generatedPrompts).filter(row=>Number(row.stage)===n&&!row.invalidatedBy&&policy.reviewOperations.includes(row.operation)))requested.add(prompt.operation);\n"+anchor);}
 createVerifierRuntime.loadScript(globalThis,source,{filename:file});
}
const core=closedLoopCore,schema=closedLoopWorkflowSchema,engine=closedLoopWorkflowEngine,prompts=closedLoopPromptEngine,ingestion=closedLoopResponseIngestion,hash=closedLoopHash;
const runtime={core,schema,engine,prompts,ingestion};
let author=stage04AcceptanceFixture(runtime,'JOB-SEMANTIC-REVIEW-ACCEPTANCE');
// Specification9.6/37Stage04: the independent reviewer must receive the
// authored decision or truth conditions it is reviewing, not only their IDs.
// Expected member families and semantic keys come from that reviewed subject.
// Values come from the actual accepted author result, independently of prompt
// selection. Parse the final transported envelopes, including context files.
const stage04ReviewSubjectObservations=[];
function stage04ReviewSubjectOracle(project,prompt){
 const operation=prompt.operation,required=operation==='DISPOSITION_CHALLENGE'?['requirements']:['ATOMICITY_CHALLENGE','RECONCILE_REQUIREMENTS'].includes(operation)?['requirements','propositions']:[];
 if(!required.length)return;
 const fields={requirements:['OBLIGATION','MANDATORY_OPTIONAL_STATUS','APPLICABILITY','USER_INPUT_RELATIONSHIP','OBSERVABLE_SATISFACTION_CONDITION','INTENDED_VERIFICATION_METHOD','EXPECTED_EVIDENCE','FAILURE_CONDITION'],propositions:['PROPOSITION_TEXT','REQUIREMENT_ID','SUBJECT_AND_SCOPE_DESCRIPTION','SATISFACTION_MEANING','FAILURE_MEANING']},members=[];
 for(const match of prompt.prompt.matchAll(/BEGIN_UNTRUSTED_DATA_BLOCK\n([^\n]+)\nEND_UNTRUSTED_DATA_BLOCK/g))members.push(JSON.parse(match[1]));
 const files=prompts.materializePromptContextFiles(prompt,project);
 for(const file of files){assert.equal(createHash('sha256').update(file.text,'utf8').digest('hex'),file.sha256,'STAGE04_REVIEW_SUBJECT_ORACLE: materialized context differs from its manifest digest.');members.push(...JSON.parse(file.text).members);}
 const observed={operation,contextFiles:files.length,subjects:{}};
 for(const family of required){
  const expected=project.projectData[family].filter(row=>Number(row.stage)===4&&row.active!==false&&!row.invalidatedBy&&row.scope?.inputVersion===project.job.CURRENT_INPUT_VERSION&&row.scope?.requirementsVersion===project.job.CURRENT_REQUIREMENTS_VERSION);
  assert(expected.length>0,'STAGE04_REVIEW_SUBJECT_ORACLE: otherwise valid authored '+family+' targets must exist.');
  const found=members.filter(member=>member.sourceIdentity==='collection.'+family);
  assert.equal(found.length,1,'STAGE04_REVIEW_SUBJECT_ORACLE: '+operation+' must publish current authored '+family+' semantic content.');
  const rows=JSON.parse(found[0].value).records;
  const expectedIds=Array.from(expected,row=>row.id).sort(),actualIds=rows.map(row=>row.id).sort();
  assert.deepEqual(actualIds,expectedIds,'STAGE04_REVIEW_SUBJECT_ORACLE: current authored '+family+' target selection differs.');
  for(const row of expected){const actual=rows.find(item=>item.id===row.id);for(const key of fields[family])assert.deepEqual(actual.fields[key],row.fields[key],'STAGE04_REVIEW_SUBJECT_ORACLE: '+operation+' omitted or changed authored '+family+'.'+key);}
  observed.subjects[family]=actualIds;
 }
 if(['DISPOSITION_CHALLENGE','ATOMICITY_CHALLENGE'].includes(operation)){
  assert.equal(prompt.contextManifest.semanticReviewBinding.bindingStatus,'BOUND','STAGE04_REVIEW_SUBJECT_ORACLE: current review must bind the distinct author and reviewer.');
  assert.notEqual(prompt.contextManifest.semanticReviewBinding.authorContextId,prompt.contextManifest.semanticReviewBinding.reviewerContextId,'STAGE04_REVIEW_SUBJECT_ORACLE: author cannot approve its own work.');
 }
 stage04ReviewSubjectObservations.push(observed);
}

function prepare(project,stage,operation,content){
  const prompt=prompts.reserveAndBuildPromptRecord(project,stage,{operation}).prompt;
  if(stage===4)stage04ReviewSubjectOracle(project,prompt);
  const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:project.job.JOB_ID,stage,operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce,scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],humanAuthorityCandidates:[],stageData:{},records:{},evidence:[evidence('review-evidence')],unresolved:[],warnings:[],attachments:[],...content(prompt)};
  const text=JSON.stringify(envelope),transport={authority:'NONAUTHORITATIVE_TEXT_FALLBACK',materializedAsResponseFile:true,packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce,promptIdentity:envelope.promptIdentity};
  const prepared=ingestion.prepare(project,{stage,promptRecord:prompt,text,transport});if(prepared.validation.valid)assert.equal(engine.operationalNextAction(prepared.project,stage).actionType,'REVIEW_PROPOSAL',`Stage ${stage} replaced a pending proposal with another instruction.`);return {...prepared,text};
}
function accept(prepared){assert.equal(prepared.validation.valid,true,JSON.stringify(prepared.validation.issues));const impact=ingestion.acceptanceImpact(prepared.project,prepared.proposal.proposalId);if(impact.requiresConfirmation)assert.throws(()=>ingestion.commit(prepared.project,prepared.proposal.proposalId),error=>error.code==='REPLACEMENT_CONFIRMATION_REQUIRED');return ingestion.commit(prepared.project,prepared.proposal.proposalId,{replacementConfirmation:impact}).project;}
// Specification9.6: an explicit INAPPLICABLE disposition always requires
// a separate challenge; the author cannot approve that reduction itself.
for(const dispositionSource of ['evidence','requirement']){
const dispositionProject=stage04AcceptanceFixture(runtime,'JOB-INAPPLICABLE-CHALLENGE-'+dispositionSource);
const inapplicablePrepared=prepare(dispositionProject,4,'COMPLETE',prompt=>{
 const envelope=stage04AcceptanceEnvelope(runtime,dispositionProject,prompt),item=envelope.evidence.find(row=>row.kind==='OBLIGATION_DISPOSITION');
 assert.ok(item,'INAPPLICABLE_SETUP_ORACLE: an independently identifiable disposition is required.');
 if(dispositionSource==='requirement')envelope.records.requirements[0].fields.APPLICABILITY='INAPPLICABLE';
 else{const content=JSON.parse(item.content);content.disposition='inapplicable';content.reason='The compiler proposes that this supplied context is outside the current requirement scope.';item.content=JSON.stringify(content);}
 return envelope;
});
const inapplicableAccepted=accept(inapplicablePrepared);
assert.equal(engine.gate(4,inapplicableAccepted).complete,false,'INAPPLICABLE_CHALLENGE_ORACLE: the compiler approved its own inapplicable disposition.');
assert.equal(engine.operationalNextAction(inapplicableAccepted,4).operation,'DISPOSITION_CHALLENGE','INAPPLICABLE_CONTINUATION_ORACLE');
const dispositionReviewed=accept(prepare(inapplicableAccepted,4,'DISPOSITION_CHALLENGE',()=>({records:{semanticChallenges:[recordProposal(schema,'semanticChallenges',{tempKey:'independent-disposition-review',overrides:{FINDINGS:'The explicitly identified disposition is consistent with the supplied context.',DISPOSITION:'ACCEPTED',REASONING:'The independent reviewer compared the exact authored disposition and governing context.'}})]}})));
assert.equal(engine.gate(4,dispositionReviewed).complete,true,'INAPPLICABLE_REVIEW_COMPLETION_ORACLE');
}

// Combining two distinct application obligation IDs is a mechanical merge
// trigger. Semantic equivalence must be assessed by the independent challenger.
const mergeProject=stage04AcceptanceFixture(runtime,'JOB-MERGED-OBLIGATIONS');
const mergedPrepared=prepare(mergeProject,4,'COMPLETE',prompt=>{
 const envelope=stage04AcceptanceEnvelope(runtime,mergeProject,prompt),index=envelope.evidence.findIndex(row=>row.kind==='OBLIGATION_DISPOSITION');
 assert.ok(index>=0,'MERGE_SETUP_ORACLE');
 const second=JSON.parse(envelope.evidence[index].content).obligationId;
 envelope.records.requirements[0].fields.USER_INPUT_RELATIONSHIP+=' '+second;envelope.evidence.splice(index,1);return envelope;
});
const mergedAccepted=accept(mergedPrepared);
assert.equal(engine.gate(4,mergedAccepted).complete,false,'MERGED_OBLIGATION_CHALLENGE_ORACLE: a compiler approved its own merge.');
assert.equal(engine.operationalNextAction(mergedAccepted,4).operation,'ATOMICITY_CHALLENGE','MERGED_OBLIGATION_CONTINUATION_ORACLE');
const mergeReviewed=accept(prepare(mergedAccepted,4,'ATOMICITY_CHALLENGE',()=>({records:{semanticChallenges:[recordProposal(schema,'semanticChallenges',{tempKey:'independent-merge-review',overrides:{FINDINGS:'The independent reviewer assessed the merged obligation identities and exact source context.',DISPOSITION:'ACCEPTED',REASONING:'The semantic equivalence decision is recorded in the independent review context.'}})]}})));
assert.equal(engine.gate(4,mergeReviewed).complete,true,'MERGED_OBLIGATION_REVIEW_COMPLETION_ORACLE');

// Reuse the same accepted merge after serialization, and exercise an actual
// accepted authored response large enough to require manifest-bound context.
const restoredMerge=JSON.parse(JSON.stringify(mergedAccepted));
assert.equal(engine.operationalNextAction(restoredMerge,4).operation,'ATOMICITY_CHALLENGE','STAGE04_REVIEW_SUBJECT_ORACLE: restored merge lost its required review.');
const restoredChallenge=restoredMerge.projectData.generatedPrompts.filter(row=>row.stage===4&&row.operation==='ATOMICITY_CHALLENGE'&&!row.invalidatedBy).at(-1);
assert(restoredChallenge,'STAGE04_REVIEW_SUBJECT_ORACLE: the restored version must retain its exact reserved instruction without re-execution.');
stage04ReviewSubjectOracle(restoredMerge,restoredChallenge);
const pressureProject=stage04AcceptanceFixture(runtime,'JOB-MERGED-OBLIGATIONS-CONTEXT-FILE');
const pressurePrepared=prepare(pressureProject,4,'COMPLETE',prompt=>{
 const envelope=stage04AcceptanceEnvelope(runtime,pressureProject,prompt),index=envelope.evidence.findIndex(row=>row.kind==='OBLIGATION_DISPOSITION'),second=JSON.parse(envelope.evidence[index].content).obligationId;
 envelope.records.requirements[0].fields.USER_INPUT_RELATIONSHIP+=' '+second;envelope.evidence.splice(index,1);
 envelope.records.requirements[0].fields.OBSERVABLE_SATISFACTION_CONDITION='Required content is present. '+'é'.repeat(45000)+' REQUIREMENT-CONDITION-TAIL';
 envelope.records.propositions[0].fields.SATISFACTION_MEANING='The required verified content is present. '+'é'.repeat(45000)+' PROPOSITION-CONDITION-TAIL';
 return envelope;
});
const pressureAccepted=accept(pressurePrepared);
assert.equal(engine.operationalNextAction(pressureAccepted,4).operation,'ATOMICITY_CHALLENGE','STAGE04_REVIEW_SUBJECT_ORACLE: bounded authored pressure must trigger the current required challenge.');
const pressureChallenge=prompts.reserveAndBuildPromptRecord(pressureAccepted,4,{operation:'ATOMICITY_CHALLENGE'}).prompt;
stage04ReviewSubjectOracle(pressureAccepted,pressureChallenge);
assert(stage04ReviewSubjectObservations.at(-1).contextFiles>0,'STAGE04_REVIEW_SUBJECT_ORACLE: pressure did not exercise materialized context.');
{
// Published /80 handoffs omit reviewed Stage04 subjects. The shared /81
// revision already invalidates those instructions; no preparation-only version
// bump is needed. Exercise the actual saved-continuation freshness owner.
const previousSchemaSource=fs.readFileSync('workflow-schema.js','utf8').replace("DISPOSITION_CHALLENGE:Object.freeze({readCollections:['research','candidateRequirements','sources','evidenceRecords','sourceConflicts','requirements']","DISPOSITION_CHALLENGE:Object.freeze({readCollections:['research','candidateRequirements','sources','evidenceRecords','sourceConflicts']").replace("ATOMICITY_CHALLENGE:Object.freeze({readCollections:['research','candidateRequirements','sources','evidenceRecords','sourceConflicts','requirements','propositions']","ATOMICITY_CHALLENGE:Object.freeze({readCollections:['research','candidateRequirements','sources','evidenceRecords','sourceConflicts']");
const previousPromptSource=fs.readFileSync('prompt-engine.js','utf8').replace(/const PROMPT_ENGINE_VERSION='[^']+';/,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/80';"),previous=projectStoreRuntime({sourceOverrides:{'workflow-schema.js':previousSchemaSource,'prompt-engine.js':previousPromptSource}}),previousRuntime={core:previous.core,schema:previous.runtime.closedLoopWorkflowSchema,engine:previous.engine,prompts:previous.prompts,ingestion:previous.ingestion};
let previousProject=stage04AcceptanceFixture(previousRuntime,'JOB-STAGE04-SAVED-DEFICIENT-INSTRUCTION');
const previousAuthor=previous.prompts.reserveAndBuildPromptRecord(previousProject,4,{operation:'COMPLETE'}).prompt,previousRequest=stage04AcceptanceEnvelope(previousRuntime,previousProject,previousAuthor),previousIndex=previousRequest.evidence.findIndex(row=>row.kind==='OBLIGATION_DISPOSITION');
previousRequest.records.requirements[0].fields.USER_INPUT_RELATIONSHIP+=' '+JSON.parse(previousRequest.evidence[previousIndex].content).obligationId;previousRequest.evidence.splice(previousIndex,1);
const previousPrepared=previous.ingestion.prepare(previousProject,{stage:4,text:JSON.stringify(previousRequest),promptRecord:previousAuthor,transport:{packageId:previousAuthor.packageId,operationReservationId:previousAuthor.operationReservationId,challengeNonce:previousAuthor.challengeNonce}});
assert.equal(previousPrepared.validation.valid,true,'STAGE04_SUBJECT_FRESHNESS_ORACLE: otherwise valid old authored merge must reach review.');
previousProject=previous.ingestion.commit(previousPrepared.project,previousPrepared.proposal.proposalId,{operator:'SYNTHETIC',replacementConfirmation:previous.ingestion.acceptanceImpact(previousPrepared.project,previousPrepared.proposal.proposalId)}).project;
const previousChallenge=previous.prompts.reserveAndBuildPromptRecord(previousProject,4,{operation:'ATOMICITY_CHALLENGE'}).prompt;
assert.equal(previousChallenge.promptEngineVersion,'closed-loop-prompt-engine/80','STAGE04_SUBJECT_FRESHNESS_ORACLE: wrong deficient-generation setup.');
assert.equal(previousChallenge.contextManifest.readCollections.requirements,undefined,'STAGE04_SUBJECT_FRESHNESS_ORACLE: old controlled read defect was not present.');
const previousCapture=previous.ingestion.captureRaw(previousProject,{stage:4,text:'{',promptRecord:previousChallenge});
const currentGeneration=projectStoreRuntime(),currentRecovered=currentGeneration.copy(previousCapture.project),replacement=currentGeneration.ingestion.prepareStageContinuation(currentRecovered,{stage:4,owningTabInstance:'STAGE04-SUBJECT-FRESHNESS'});
assert.equal(replacement?.created,true,'STAGE04_SUBJECT_FRESHNESS_ORACLE: a saved deficient review was silently reused.');
assert.equal(replacement.prompt.promptEngineVersion,prompts.version,'STAGE04_SUBJECT_FRESHNESS_ORACLE: replacement uses an obsolete instruction engine.');
assert(currentRecovered.projectData.generatedPrompts.find(row=>row.instructionId===previousChallenge.instructionId)?.invalidatedBy,'STAGE04_SUBJECT_FRESHNESS_ORACLE: old deficient review remains active.');
assert.equal(currentRecovered.projectData.rawResponses.find(row=>row.rawResponseId===previousCapture.rawRecord.rawResponseId).completeRawResponse,'{','STAGE04_SUBJECT_FRESHNESS_ORACLE: original raw work changed during freshness recovery.');
stage04ReviewSubjectOracle(currentRecovered,replacement.prompt);

}
if(process.argv.includes('--stage04-review-subjects-only')){console.log(JSON.stringify({stage04ReviewSubjects:'PASS',savedDeficientInstructionReplaced:true,observations:stage04ReviewSubjectObservations,basis:'REAL_PRIOR_ACCEPTANCE_AND_CURRENT_REQUIRED_REVIEW_WITH_EXACT_EMITTED_CONTEXT',syntheticExternalOutputs:true}));process.exit(0);}

const browserAcceptanceCases=[];
async function replayBrowserAcceptance(prepared,{helperSource=fs.readFileSync('verify-browser-extra.mjs','utf8'),fault=false}={}){
 const response=JSON.parse(prepared.text),app=application(prepared.project,response.operation,{stage:response.stage}),clicks=[];let confirmationShown=false;
 // The production ingestion fixture has already staged and validated these
 // exact bytes. Only the browser boundary is simulated for this helper test.
 const context=createVerifierRuntime({document:{visibilityState:'visible',querySelector:selector=>selector==='#accept-replacement'?(app.ui.pendingConfirmation()?{}:null):selector==='#accept-proposal'?(app.ui.proposal().includes('id="accept-proposal"')?{}:null):null},closedLoopProjectStore:{readProject:async()=>app.saved()}});
 const evaluate=async(_cdp,expression)=>createVerifierRuntime.loadScript(context,expression,{filename:'browser-extra:observed-acceptance-state'});
 const helperRuntime=createVerifierRuntime({cdp:{},console:{log(){}},assert,evalValue:evaluate,selectResponseFile:async(_cdp,text)=>assert.deepEqual(JSON.parse(text),response),click:async(_cdp,selector)=>{clicks.push(selector);if(selector==='#accept-proposal'){await app.ui.beginAcceptance();confirmationShown=Boolean(app.ui.pendingConfirmation());}else if(selector==='#accept-replacement')await app.ui.confirmReplacement();else assert.equal(selector,'#process-response-file');},waitExpr:async(_cdp,expression)=>{const value=await evaluate(_cdp,expression);if(!value)throw new Error('BROWSER_ACCEPTANCE_CONFIRMATION_ORACLE: the verifier waited for a commit while the required confirmation remained unanswered.');return value;}});
 const start=helperSource.indexOf('  const acceptProofResponse=async(response)=>'),end=helperSource.indexOf('  const reviewRecords=',start);assert.ok(start>=0&&end>start);
 createVerifierRuntime.loadScript(helperRuntime,helperSource.slice(start,end)+'\nglobalThis.acceptProof=acceptProofResponse;',{filename:'verify-browser-extra.mjs:actual-acceptance-helper'});
 const before=app.saved(),beforeCount=before.projectData.acceptedChanges.length,impact=ingestion.acceptanceImpact(prepared.project,prepared.proposal.proposalId);
 try{await helperRuntime.acceptProof(response);}catch(error){
  if(app.ui.pendingConfirmation()){
   assert.equal(app.saved().projectData.acceptedChanges.length,beforeCount,'The unanswered replacement changed accepted progress.');
   if(!fault)console.error(JSON.stringify({caseId:'BROWSER_ACCEPTANCE_CONFIRMATION_ORACLE',stage:response.stage,operation:response.operation,requiresConfirmation:confirmationShown,semanticImpactRequiresConfirmation:impact.requiresConfirmation,confirmationImpact:app.ui.pendingConfirmation()?.impact,clicks,acceptedProgressPreserved:true,actual:'The verifier stopped with the production in-page confirmation unanswered.'}));
  }
  throw error;
 }
 assert.equal(app.saved().projectData.acceptedChanges.length,beforeCount+1,'BROWSER_ACCEPTANCE_CONFIRMATION_ORACLE: acceptance must commit once.');
 assert.equal(clicks.filter(selector=>selector==='#accept-replacement').length,Number(confirmationShown),'BROWSER_ACCEPTANCE_CONFIRMATION_ORACLE: operate exactly the required confirmation.');
 if(!fault)browserAcceptanceCases.push({caseId:'browser-helper-'+response.stage+'-'+response.operation,result:'PASS',requiresConfirmation:confirmationShown,clicks});
}

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
const sourceSearchCompletionObservations=[];
// Specification 8.3: an accepted bounded search defines all nine unconditional
// semantic components. Jurisdiction is conditional; arrays have no invented
// minimum cardinality. This literal oracle comes from the controlling text.
{
  const required=['PROJECT_SCOPE','SOURCE_CLASSES_CONSIDERED','LOCATIONS_AND_REPOSITORIES','QUERIES_OR_STRATEGIES','DATE_OR_VERSION_CUTOFF','EXCLUSIONS','ACCESS_LIMITATIONS','ADEQUACY_RATIONALE','UNRESOLVED_DISCOVERY_RISK'];
  const base=stage01AcceptanceFixture(runtime,'JOB-SEARCH-CONTRACT-COMPONENTS'),stageData={AUTHORITY_HIERARCHY:'No external authority applies to the controlled fixture.',SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE',KNOWN_CONTROLLING_SOURCES_EXAMINED:'The closed fixture input universe and supplied references were inspected.'};
  const omitted=[];
  for(const name of required){
    const proposal=boundedSearchProposal(schema);delete proposal.fields[name];
    const prepared=prepare(structuredClone(base),2,'COMPLETE',()=>({stageData,records:{sourceSearchContracts:[proposal]}}));
    assert.equal(prepared.validation.valid,false,'SOURCE_SEARCH_MISSING_COMPONENT_ORACLE: omitted '+name+' was accepted.');
    assert(prepared.validation.issues.some(problem=>problem.code==='MISSING_REQUIRED_FIELD'&&problem.path==='/records/sourceSearchContracts/0/fields/'+name),'SOURCE_SEARCH_MISSING_COMPONENT_REASON_ORACLE: '+name+' '+JSON.stringify(prepared.validation.issues));
    assert.equal(engine.recordsForCurrentScope(prepared.project,'sourceSearchContracts').length,0,'Invalid search changed accepted state.');
    assert.equal(prepared.project.projectData.rawResponses.at(-1).completeRawResponse,prepared.text,'Rejected partial search draft bytes were lost.');
    omitted.push(name);
  }
  sourceSearchCompletionObservations.push({checkId:'stage02.search-contract.required-components',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:606'],boundary:'Actual reserved Stage02 response validation before canonical acceptance; raw draft retention',expected:{rejectedMissingComponents:required,acceptedRecords:0},observed:{rejectedMissingComponents:omitted,acceptedRecords:0},passed:true,violation:'INCOMPLETE_ACCEPTED_SOURCE_SEARCH_CONTRACT',accepted:false});
  for(const name of ['SOURCE_CLASSES_CONSIDERED','LOCATIONS_AND_REPOSITORIES','QUERIES_OR_STRATEGIES','EXCLUSIONS','ACCESS_LIMITATIONS']){
    const proposal=boundedSearchProposal(schema);proposal.fields[name]=[];
    const prepared=prepare(structuredClone(base),2,'COMPLETE',()=>({stageData,records:{sourceSearchContracts:[proposal]}}));
    assert.equal(prepared.validation.valid,true,'SOURCE_SEARCH_ARRAY_CARDINALITY_ORACLE: declared typed empty '+name+' was rejected: '+JSON.stringify(prepared.validation.issues));
  }
  for(const value of [null,'',{},[]]){
    const proposal=boundedSearchProposal(schema);proposal.fields.JURISDICTION_OR_SYSTEM_SCOPE=value;
    const prepared=prepare(structuredClone(base),2,'COMPLETE',()=>({stageData,records:{sourceSearchContracts:[proposal]}}));
    assert.equal(prepared.validation.valid,false,'SOURCE_SEARCH_CONDITIONAL_TYPE_ORACLE: malformed supplied jurisdiction was accepted.');
    assert(prepared.validation.issues.some(problem=>problem.path==='/records/sourceSearchContracts/0/fields/JURISDICTION_OR_SYSTEM_SCOPE'),'Malformed supplied jurisdiction was rejected for an unrelated reason.');
  }
  const complete=boundedSearchProposal(schema);complete.fields.EXCLUSIONS=[];complete.fields.ACCESS_LIMITATIONS=[];delete complete.fields.JURISDICTION_OR_SYSTEM_SCOPE;
  complete.fields.ADEQUACY_RATIONALE='All seven source classes and supplied references were considered within this explicitly closed hermetic fixture. No legal jurisdiction or external system applies to this fixture scope. Every registered location and candidate disposition is accounted for; there are no exclusions, inaccessible locations, or material residual risk. Independent review must assess these fixture claims.';
  const emitted=prompts.reserveAndBuildPromptRecord(structuredClone(base),2,{operation:'COMPLETE'}).prompt;
  const descriptorText=emitted.prompt.split('RESPONSE CONTRACT DEFINITIONS\n')[1].split('\n\nEND HASHED INSTRUCTION BODY')[0],descriptor=JSON.parse(descriptorText);
  assert.deepEqual(descriptor.records.sourceSearchContracts.requiredAgentFields,required,'SOURCE_SEARCH_FINAL_DESCRIPTOR_ORACLE: emitted requiredness differs from controlling components.');
  assert.equal(emitted.contractSha256,hash.sha256Value(descriptor),'The final required contract is not bound to the existing instruction identity.');
  assert(emitted.prompt.includes('Include JURISDICTION_OR_SYSTEM_SCOPE where applicable; when supplied it must be a nonempty string.'),'Conditional jurisdiction instructions were not delivered.');
  assert(emitted.prompt.includes('no exclusions or access limitations are represented by [], not by omitting the component.'),'Empty-array contract instructions were not delivered.');
  let p=accept(prepare(structuredClone(base),2,'COMPLETE',()=>({stageData,records:{sourceSearchContracts:[complete]}})));
  registerFixtureSourceSearchCapability(runtime,p);
  const review=()=>({records:{semanticReviews:[recordProposal(schema,'semanticReviews',{tempKey:'complete-contract-review',overrides:{REVIEW_QUESTION:'Does the exact closed fixture contract define and evidence an adequate executed search?',FINDING:'The complete hermetic fixture contract is adequate; no jurisdiction or external system applies.',REASONING:'Independently checked actual scope, all declared classes and locations, query/cutoff observations, candidate dispositions, the explicit no-jurisdiction basis, empty exclusions/access limitations and residual risk against the exact current contract and registered performer report. This is synthetic external-claim evidence, not live external-source execution.',RESULT:'ACCEPTED'}})]}});
  p=accept(prepare(p,2,'SEARCH_ADEQUACY_REVIEW',review));
  assert.equal(engine.gate(2,p).complete,true,'SOURCE_SEARCH_COMPLETE_CONTROL_ORACLE: complete conditionally scoped contract did not progress.');
  sourceSearchCompletionObservations.push({checkId:'stage02.search-contract.conditional-empty-control',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:606'],boundary:'Actual accepted contract, exact performer registration, independent review and completion; emitted bound descriptor',expected:{complete:true,optionalJurisdictionOmitted:true,emptyArraysAllowed:true,requiredAgentFields:required},observed:{complete:engine.gate(2,p).complete,optionalJurisdictionOmitted:true,emptyArraysAllowed:true,requiredAgentFields:descriptor.records.sourceSearchContracts.requiredAgentFields},passed:true});
  // Model a retained legacy canonical record, then independently re-bind its
  // actual current evidence/capability and review. Staleness must not be the
  // reason the deterministic component obligation blocks completion.
  const legacy=structuredClone(p),contract=engine.recordsForCurrentScope(legacy,'sourceSearchContracts').at(-1);
  delete contract.fields.SOURCE_CLASSES_CONSIDERED;delete contract.SOURCE_CLASSES_CONSIDERED;engine.refreshRecordHashes(contract,'sourceSearchContracts');
  registerFixtureSourceSearchCapability(runtime,legacy);
  const reviewed=accept(prepare(legacy,2,'SEARCH_ADEQUACY_REVIEW',review)),actual=engine.gate(2,reviewed),capability=engine.sourceSearchCapabilityState(reviewed,engine.recordsForCurrentScope(reviewed,'sourceSearchContracts').at(-1));
  assert.equal(actual.complete,false,'SOURCE_SEARCH_RETAINED_COMPONENT_ORACLE: current reviewed legacy contract completed without a required component.');
  assert(actual.reasons.some(reason=>reason.includes('SOURCE_CLASSES_CONSIDERED')&&reason.includes('required')),'SOURCE_SEARCH_RETAINED_COMPONENT_REASON_ORACLE: '+JSON.stringify(actual.reasons));
  assert.deepEqual(capability.reasons,['SOURCE_CLASSES_CONSIDERED is required in the accepted source search contract.'],'SOURCE_SEARCH_RETAINED_CURRENT_BINDING_ORACLE: stale capability/report authority masked the component violation.');
  sourceSearchCompletionObservations.push({checkId:'stage02.search-contract.retained-component',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:606'],boundary:'Retained canonical source search plus freshly bound actual capability and independent review',expected:{complete:false,reasons:['SOURCE_CLASSES_CONSIDERED is required in the accepted source search contract.']},observed:{complete:actual.complete,reasons:capability.reasons},passed:true,violation:'INCOMPLETE_RETAINED_SOURCE_SEARCH_CONTRACT',accepted:false});
}

{
  let p=stage01AcceptanceFixture(runtime,'JOB-MISSING-BOUNDED-SEARCH');
  p=accept(prepare(p,2,'COMPLETE',()=>({stageData:{AUTHORITY_HIERARCHY:'No external authority applies.',SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE',KNOWN_CONTROLLING_SOURCES_EXAMINED:'The actor claims no external source applies.'}})));
  const missing=engine.gate(2,p);
  assert.equal(missing.complete,false,'SOURCE_SEARCH_CONTRACT_COMPLETION_ORACLE: no-source assertion completed without a bounded search contract.');
  assert(missing.reasons.some(reason=>reason.includes('source search contract')),'SOURCE_SEARCH_CONTRACT_REASON_ORACLE');
  assert.equal(engine.operationalNextAction(p,2).operation,'COMPLETE','Missing contract must return to authoring before independent review.');
  sourceSearchCompletionObservations.push({checkId:'stage02.search-contract.missing',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:606'],boundary:'Current reserved Stage02 response acceptance and completion gate',expected:{complete:false},observed:{complete:missing.complete},passed:true,violation:'STAGE02_COMPLETION_WITHOUT_BOUNDED_SEARCH',accepted:false});
  p=accept(prepare(p,2,'COMPLETE',()=>({stageData:structuredClone(p.stages[2].agentData),records:{sourceSearchContracts:[boundedSearchProposal(schema)]}})));
  const unsupported=engine.gate(2,p);assert.equal(unsupported.complete,false,'SOURCE_SEARCH_PERFORMER_ORACLE: a search without registered performer/capability completed.');assert.equal(engine.operationalNextAction(p,2).actionType,'REGISTER_SOURCE_SEARCH_CAPABILITY');
  const contract=engine.recordsForCurrentScope(p,'sourceSearchContracts').at(-1);assert.deepEqual(engine.recordValue(contract,'EXECUTION_EVIDENCE_IDS'),contract.evidenceRefs,'SOURCE_SEARCH_EXECUTION_EVIDENCE_ORACLE: application must resolve exact canonical evidence IDs.');assert.equal(engine.recordValue(contract,'SEARCH_PERFORMER_CAPABILITY_ID'),'UNKNOWN');
  const unsupportedReview=accept(prepare(structuredClone(p),2,'SEARCH_ADEQUACY_REVIEW',()=>({records:{semanticReviews:[recordProposal(schema,'semanticReviews',{tempKey:'unsupported-review',overrides:{REVIEW_QUESTION:'Is this claimed search adequate?',FINDING:'The agent claims the search is complete.',REASONING:'This deliberately accepted semantic fixture must not waive missing registered capability.',RESULT:'ACCEPTED'}})]}})));
  assert.equal(engine.gate(2,unsupportedReview).complete,false,'SOURCE_SEARCH_BOUND_CAPABILITY_ORACLE: accepted independent review waived missing registered performer/capability.');
  sourceSearchCompletionObservations.push({checkId:'stage02.search-capability.missing-after-review',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:606'],boundary:'Accepted current independently bound review and actual Stage02 completion consumer',expected:{complete:false,capabilityId:'UNKNOWN'},observed:{complete:engine.gate(2,unsupportedReview).complete,capabilityId:engine.recordValue(engine.recordsForCurrentScope(unsupportedReview,'sourceSearchContracts').at(-1),'SEARCH_PERFORMER_CAPABILITY_ID')},passed:true,violation:'SOURCE_SEARCH_COMPLETION_WITHOUT_REGISTERED_PERFORMER',accepted:false});
  registerFixtureSourceSearchCapability(runtime,p,{checks:{route:'UNKNOWN'}});assert.equal(engine.sourceSearchCapabilityState(p,engine.recordsForCurrentScope(p,'sourceSearchContracts').at(-1)).complete,false,'SOURCE_SEARCH_UNKNOWN_ROUTE_ORACLE');
  sourceSearchCompletionObservations.push({checkId:'stage02.search-capability.unknown-route',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:606'],boundary:'Registered current source-search capability conjunction',expected:{ready:false},observed:{ready:engine.sourceSearchCapabilityState(p,engine.recordsForCurrentScope(p,'sourceSearchContracts').at(-1)).complete},passed:true,violation:'UNKNOWN_SOURCE_SEARCH_ROUTE',accepted:false});
  registerFixtureSourceSearchCapability(runtime,p);
  const unreviewed=engine.gate(2,p);assert.equal(unreviewed.complete,false,'Unreviewed source search completed.');assert.equal(engine.operationalNextAction(p,2).operation,'SEARCH_ADEQUACY_REVIEW');
  sourceSearchCompletionObservations.push({checkId:'stage02.search-contract.unreviewed',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:608'],boundary:'Current authored search contract completion gate',expected:{complete:false},observed:{complete:unreviewed.complete},passed:true,violation:'STAGE02_COMPLETION_WITHOUT_CURRENT_ADEQUACY_REVIEW',accepted:false});
  p=accept(prepare(p,2,'SEARCH_ADEQUACY_REVIEW',()=>({records:{semanticReviews:[recordProposal(schema,'semanticReviews',{tempKey:'search-adequacy',overrides:{REVIEW_QUESTION:'Is the executed closed fixture search adequate?',FINDING:'No applicable external source remains.',REASONING:'Every declared location, stopping criterion and candidate disposition is accounted for without residual risk.',RESULT:'ACCEPTED'}})]}})));
  const reviewed=engine.gate(2,p);assert.equal(reviewed.complete,true,'Current independently reviewed bounded no-source search did not complete.');
  const bound=engine.recordsForCurrentScope(p,'sourceSearchContracts').at(-1),capability=engine.recordsForCurrentScope(p,'externalCapabilities').find(row=>engine.recordId(row,'externalCapabilities')===engine.recordValue(bound,'SEARCH_PERFORMER_CAPABILITY_ID')),basis=JSON.parse(engine.recordValue(capability,'VERIFICATION_BASIS'));
  assert.equal(basis.retention,'CANONICAL_UTF8_REPORT');assert.notEqual(engine.recordValue(bound,'SEARCH_PERFORMER_CAPABILITY_ID'),p.projectData.generatedPrompts.at(-1).contextManifest.semanticReviewBinding.authorContextId);
  const manifest=engine.recordsForCurrentScope(p,'environmentManifests').find(row=>engine.recordId(row,'environmentManifests')===engine.recordValue(capability,'ENVIRONMENT_MANIFEST_ID'));assert.equal(engine.recordValue(manifest,'EVIDENCE_BASES').epistemicBasis,'OPERATOR_CONFIRMED_EXTERNAL_CLAIM');
  sourceSearchCompletionObservations.push({checkId:'stage02.search-capability.bound-evidence',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:606'],boundary:'Actual canonical execution evidence and registered operator-confirmed performer/capability writer',expected:{evidenceIdsMatch:true,capabilityRegistered:true,retention:'CANONICAL_UTF8_REPORT',basis:'OPERATOR_CONFIRMED_EXTERNAL_CLAIM'},observed:{evidenceIdsMatch:hash.stableStringify(engine.recordValue(bound,'EXECUTION_EVIDENCE_IDS'))===hash.stableStringify(bound.evidenceRefs),capabilityRegistered:capability.source==='EXTERNAL_CAPABILITY_REGISTRATION',retention:basis.retention,basis:engine.recordValue(manifest,'EVIDENCE_BASES').epistemicBasis},passed:true});
  const renewed=structuredClone(p);registerFixtureSourceSearchCapability(runtime,renewed);assert.equal(engine.gate(2,renewed).complete,false,'SOURCE_SEARCH_REVIEW_FRESHNESS_ORACLE: registered new capability reused an old adequacy review.');assert.equal(engine.operationalNextAction(renewed,2).operation,'SEARCH_ADEQUACY_REVIEW');
  sourceSearchCompletionObservations.push({checkId:'stage02.search-capability.changed-binding',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:608'],boundary:'Changed actual capability identity versus prior independently reviewed exact contract hash',expected:{complete:false,operation:'SEARCH_ADEQUACY_REVIEW'},observed:{complete:engine.gate(2,renewed).complete,operation:engine.operationalNextAction(renewed,2).operation},passed:true,violation:'REUSED_STALE_SOURCE_SEARCH_APPROVAL',accepted:false});
  for(const corruption of ['canonical-report','operator-authorization']){const broken=structuredClone(p);if(corruption==='canonical-report'){const evidence=broken.projectData.evidenceRecords.find(row=>engine.recordId(row,'evidenceRecords')===basis.evidenceId);evidence.fields.APPLICATION_EVIDENCE_CONTENT+=' ';}else{const decision=broken.projectData.humanDecisions.find(row=>engine.recordId(row,'humanDecisions')===basis.decisionId);decision.fields.VALUE.authorized=false;}
    const actual=engine.gate(2,broken);assert.equal(actual.complete,false,'SOURCE_SEARCH_CURRENT_AUTHORITY_ORACLE: '+corruption);assert.equal(engine.sourceSearchCapabilityState(broken,engine.recordsForCurrentScope(broken,'sourceSearchContracts').at(-1)).complete,false);
    sourceSearchCompletionObservations.push({checkId:'stage02.search-capability.corrupt-'+corruption,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:606'],boundary:'Current exact retained report and actual operator authority revalidation',expected:{complete:false,ready:false},observed:{complete:actual.complete,ready:engine.sourceSearchCapabilityState(broken,engine.recordsForCurrentScope(broken,'sourceSearchContracts').at(-1)).complete},passed:true,violation:'INVALID_CURRENT_SOURCE_SEARCH_'+corruption.toUpperCase().replaceAll('-','_'),accepted:false});
  }
  sourceSearchCompletionObservations.push({checkId:'stage02.search-contract.reviewed',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:608'],boundary:'Current independently bound accepted search review completion gate',expected:{complete:true},observed:{complete:reviewed.complete},passed:true});
}

// A bounded search record requires current review authority. Historical author
// prompts without context binding return through authoring; they do not invent
// an independent identity or approve the search during project recovery.
{
  let p=stage04AcceptanceFixture(runtime,'JOB-LEGACY-SOURCE-AUTHOR');
  p=accept(prepare(p,2,'COMPLETE',()=>({stageData:structuredClone(p.stages[2].agentData),records:{sourceSearchContracts:[boundedSearchProposal(schema)]}})));
  registerFixtureSourceSearchCapability(runtime,p);assert.equal(p.stages[2].gate.complete,false);assert.equal(p.job.NEXT_REQUIRED_ACTION.operation,'SEARCH_ADEQUACY_REVIEW');
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
  // A review-only reconciliation supplies no execution evidence for the new
  // source version. Retaining the search declaration must not confer readiness
  // or permit the author to approve that stale evidence through a review flag.
  const preservedRaw=p.projectData.rawResponses.map(raw=>({id:raw.rawResponseId,text:raw.completeRawResponse}));
  const incomplete=accept(prepare(structuredClone(p),2,'RECONCILE_SOURCE_SEARCH',()=>rows('ACCEPTED')));
  assert.equal(engine.gate(2,incomplete).complete,false,'SOURCE_RECONCILIATION_STALE_EVIDENCE_ORACLE: a source search without current execution evidence completed.');
  assert.equal(engine.operationalNextAction(incomplete,2).operation,'COMPLETE','SOURCE_RECONCILIATION_CORRECTION_ROUTE_ORACLE: current execution evidence must be corrected before independent review.');
  assert(incomplete.projectData.semanticReviews.some(review=>review.rawResponseId===priorReview.rawResponseId&&review.RESULT==='REJECTED'),'SOURCE_RECONCILIATION_HISTORY_ORACLE: the rejected search review was lost.');
  assert.deepEqual(preservedRaw.map(raw=>({id:raw.id,text:incomplete.projectData.rawResponses.find(saved=>saved.rawResponseId===raw.id)?.completeRawResponse})),preservedRaw,'SOURCE_RECONCILIATION_HISTORY_ORACLE: the original review and response bytes changed.');
  p=accept(prepare(p,2,'RECONCILE_SOURCE_SEARCH',()=>{const corrected=rows('ACCEPTED');corrected.records.sourceSearchContracts=[boundedSearchProposal(schema)];return corrected;}));
  assert.equal(p.stages[2].gate.complete,false,'Source reconciliation approved itself.');
  const currentSearch=engine.recordsForCurrentScope(p,'sourceSearchContracts');
  assert.equal(currentSearch.length,1,'Reconciliation dropped the bounded search from the current source set.');
  assert.equal(currentSearch[0].scope.sourceSetVersion,p.job.CURRENT_SOURCE_SET_VERSION,'Reconciliation retained stale source-search membership.');
  assert.equal(p.job.NEXT_REQUIRED_ACTION.actionType,'REGISTER_SOURCE_SEARCH_CAPABILITY','SOURCE_RECONCILIATION_READINESS_ORACLE: a changed current source scope must refresh the capability report.');registerFixtureSourceSearchCapability(runtime,p);assert.equal(p.job.NEXT_REQUIRED_ACTION.operation,'SEARCH_ADEQUACY_REVIEW','SOURCE_RECONCILIATION_REVIEW_PICKER_ORACLE: current registered search must route to independent review.');
  sourceSearchCompletionObservations.push({checkId:'stage02.search-contract.reconciliation-current',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:608'],boundary:'Reconciled source-set membership and independent-review continuation',expected:{currentContracts:1,operation:'SEARCH_ADEQUACY_REVIEW'},observed:{currentContracts:currentSearch.length,operation:p.job.NEXT_REQUIRED_ACTION.operation},passed:true});
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
  // This UI adapter intentionally shares the host engine, ingestor and store.
  // Clone into their realm rather than the isolated VM's default realm.
  const refineButton={textContent:'Refine accepted result',disabled:false,isConnected:true},notices=[],runtime=createVerifierRuntime({crypto:globalThis.crypto,URL,structuredClone:value=>structuredClone(value),console,TextEncoder,TextDecoder,Blob,setTimeout,clearTimeout,queueMicrotask,requestAnimationFrame:callback=>queueMicrotask(callback),
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
    globalThis.ui={beginAcceptance:()=>acceptPendingProposal(),confirmReplacement:()=>confirmReplacement(),pendingConfirmation:()=>replacementReview,accept:async()=>{await acceptPendingProposal();if(replacementReview)await confirmReplacement();},refine:()=>{const select=document.querySelector;document.querySelector=selector=>['#refine-accepted-response','#accepted-refinement-reason','#operator-label'].includes(selector)?select(selector):null;wire();document.querySelector=select;return document.querySelector('#refine-accepted-response').onclick();},restore:async()=>{current=await materializeProject(current);return current;},current:()=>current,prompt:()=>currentPromptRecord(stage),selectedOperation:()=>selectedOperation(stage),proposal:()=>proposalMarkup(stage)};
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
  assert.deepEqual(saved.projectData.semanticReviews.filter(r=>Number(r.stage)===5).map(r=>r.fields.RESULT),['ACCEPTED',result],'Stage05 review findings were rewritten.');
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
  await replayBrowserAcceptance(authorPrepared);
  await replayBrowserAcceptance(corrected);
  const verifier=fs.readFileSync('verify-browser-extra.mjs','utf8'),confirmation="if(await evalValue(cdp,`Boolean(document.querySelector('#accept-replacement'))`))await click(cdp,'#accept-replacement');";
  assert.ok(verifier.includes(confirmation),'The confirmation fault must target the actual browser helper.');
  await assert.rejects(()=>replayBrowserAcceptance(corrected,{helperSource:verifier.replace(confirmation,''),fault:true}),/BROWSER_ACCEPTANCE_CONFIRMATION_ORACLE/);
  await replayBrowserAcceptance(corrected);
  browserAcceptanceCases.push({caseId:'browser-helper-skipped-confirmation-fault',result:'DETECTED',restored:'PASS'});
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
  assert.deepEqual(prepared.project.projectData.semanticReviews,author.projectData.semanticReviews,'Rejected review mutated canonical findings.');
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
const malformedReviewCases=[];
for(const field of ['REVIEWED_RECORD_IDS','REVIEWED_HASHES'])for(const [label,value]of [['missing',undefined],['null',null],['string','untrusted'],['object',{}],['non-string-member',[1]]]){
 const q=structuredClone(passed);for(const row of q.projectData.semanticReviews.filter(row=>row.stage===5)){if(value===undefined){delete row.fields[field];delete row[field];}else row.fields[field]=row[field]=structuredClone(value);}
 let actual;assert.doesNotThrow(()=>{actual=engine.evaluateApplicability(q,propositionId);},'MALFORMED_REVIEW_ORACLE: malformed review crashed evaluation.');
 assert.equal(actual,'UNKNOWN','MALFORMED_REVIEW_ORACLE: malformed review authorized applicability.');malformedReviewCases.push({field,case:label,actual});
}

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
assert.equal(engine.recordsForCurrentScope(recovered.project,'semanticReviews').filter(r=>Number(r.stage)===5).length,0);
assert.equal(recovered.continuation?.prompt.operation,'SEMANTIC_REVIEW','Automatic recovery did not save its replacement instruction.');
assert.match(recovered.continuation.prompt.prompt,/unsupported RESULT values/);
assert.equal(recovered.project.stages[5].gate.complete,false);
assert.equal(recovered.project.stages[6].status,'NOT STARTED');
assert.equal(ingestion.recoverInvalidSemanticReviews(recovered.project).changed,false,'Reload repeated the repair.');
assert.equal(ingestion.prepareStageContinuation(recovered.project,{stage:5}).created,false,'Reload regenerated a controlling instruction again.');
assert.equal(closedLoopProjectStore.validateProjectIntegrity(recovered.project,{verifyDerived:false}).valid,true);
engine.invalidateAcceptedResponse(legacy,{stage:5,rawResponseId:legacyReview.rawResponseId,reason:'The saved review uses an unrecognized result.'});
assert.equal(engine.recordsForCurrentScope(legacy,'semanticReviews').filter(r=>Number(r.stage)===5).length,0,'Correction left invalid Stage05 findings current.');
const replacement=prompts.reserveAndBuildPromptRecord(legacy,5,{operation:'SEMANTIC_REVIEW'}).prompt;
assert.equal(replacement.contextManifest.semanticReviewBinding.bindingStatus,'BOUND','The existing correction action cannot produce a replacement review.');
console.log(JSON.stringify({semanticReviewAcceptance:'PASS',stage04ReviewSubjectObservations,verificationObservations:sourceSearchCompletionObservations,inapplicableDispositionRequiresIndependentReview:true,mergedObligationsRequireIndependentReview:true,malformedReviewCases,browserAcceptanceCases,orphanAuditIsNotLiveAttempt:true,requestedReviewPreservesAcceptedProgress:true,pendingReviewIsSeparatelyActionable:true,semanticReviewStages:[1,2,3,4,5,6],pendingProposalsPreserved:true,recordedOperationSelectionPreserved:true,commandGatesUseCurrentOwner:true,automaticNextInstruction:true,explicitLegacyRecovery:true,restorationDoesNotExecuteCorrection:true,reconciliationThenIndependentReview:true,invalidResultsRejected:true,mixedFindingsCannotPass:true,negativeFindingsRouteToCorrection:true,legacyEvidencePreserved:true,validReviewUnlocksStage6:true}));

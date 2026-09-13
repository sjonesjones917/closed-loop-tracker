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
author=accept(prepare(author,5,'COMPLETE',()=>({stageData:{DUPLICATES_REMAINING:'NONE',IMPOSSIBLE_COMBINATIONS:'NONE',UNDEFINED_TERMS:'NONE',CIRCULAR_DEPENDENCIES:'NONE',UNSUPPORTED_REQUIREMENTS:'NONE',APPLICABILITY_UNDETERMINED:'NONE',REQUIREMENTS_WITHOUT_VERIFICATION_PATH:'NONE'},records:{applicabilityRecords:[recordProposal(schema,'applicabilityRecords',{tempKey:'applicability',relationships:{SUBJECT_ID:{recordId:propositionId}},overrides:{PROPOSED_APPLICABILITY:'APPLICABLE',REASONING:'The checklist requirement applies.'}})]}})));
function review(results){return prepare(structuredClone(author),5,'SEMANTIC_REVIEW',()=>({records:{semanticReviews:results.map((result,index)=>recordProposal(schema,'semanticReviews',{tempKey:`review-${index}`,overrides:{REVIEW_QUESTION:`Independent question ${index}`,FINDING:`Independent finding ${index}`,REASONING:`Evidence for finding ${index}.`,RESULT:result}}))}}));}

// A favorable row cannot hide a failed or unfinished row in the same review.
for(const result of ['REJECTED','PARTIAL','UNKNOWN','DISAGREED']){
  const prepared=review(['ACCEPTED',result]),saved=accept(prepared);
  assert.equal(saved.stages[5].gate.complete,false,`${result} was hidden by another ACCEPTED finding.`);
  assert.equal(saved.stages[6].status,'NOT STARTED',`${result} unlocked Stage 6.`);
  assert(saved.stages[5].gate.reasons.some(reason=>reason.includes(result)),`${result} is missing from the completion-gate explanation.`);
  assert.equal(saved.job.NEXT_REQUIRED_ACTION.operation,'RECONCILE_REQUIREMENT_SET',`${result} did not route to correction.`);
  assert.deepEqual(saved.projectData.semanticReviews.map(r=>r.fields.RESULT),['ACCEPTED',result],'Review findings were rewritten.');
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
engine.invalidateAcceptedResponse(legacy,{stage:5,rawResponseId:legacyReview.rawResponseId,reason:'The saved review uses an unrecognized result.'});
assert.equal(engine.recordsForCurrentScope(legacy,'semanticReviews').length,0,'Correction left invalid findings current.');
const replacement=prompts.reserveAndBuildPromptRecord(legacy,5,{operation:'SEMANTIC_REVIEW'}).prompt;
assert.equal(replacement.contextManifest.semanticReviewBinding.bindingStatus,'BOUND','The existing correction action cannot produce a replacement review.');
console.log(JSON.stringify({semanticReviewAcceptance:'PASS',invalidResultsRejected:true,mixedFindingsCannotPass:true,negativeFindingsRouteToCorrection:true,legacyEvidencePreserved:true,validReviewUnlocksStage6:true}));

import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const hash=globalThis.closedLoopHash;

let assertions=0;
const check=(condition,message)=>{assertions++;if(!condition)throw new Error(message);};
const equal=(actual,expected,message)=>check(Object.is(actual,expected),`${message} Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
const matches=(values,pattern,message)=>check(values.some(value=>pattern.test(String(value))),`${message} Received: ${JSON.stringify(values)}.`);

function setFields(record,values){
  record.fields={...(record.fields||{}),...values};
  Object.assign(record,values);
  return record;
}

function add(project,collection,id,stage,fields={},relationships={},scope=engine.currentScope(project),sourceProposalId=null,evidenceRefs=[]){
  const idField=schema.RECORD_SCHEMAS[collection].idField;
  const record={id,stage,active:true,createdAt:'2026-01-01T00:00:00.000Z',scope:{...scope},fields:{[idField]:id,...fields},relationships:{...relationships},sourceProposalId,evidenceRefs:[...evidenceRefs]};
  Object.assign(record,record.fields);
  engine.refreshRecordHashes(record,collection);
  project.projectData[collection].push(record);
  return record;
}

function makeProject(jobId){
  const project=core.createBlankState(jobId);
  engine.ensureShape(project);
  Object.assign(project.job,{
    CURRENT_INPUT_VERSION:'INPUT-v001',
    CURRENT_SOURCE_SET_VERSION:'SOURCE-v001',
    CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',
    CURRENT_TEST_SUITE_VERSION:'TEST-v001',
    CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001',
    CURRENT_ITERATION:'ITERATION-1'
  });
  return project;
}

function testSemanticPayload(test){
  return {
    targetPropositionIds:['PROP-1'],
    testPropositionText:engine.recordValue(test,'TEST_PROPOSITION_TEXT'),
    testedScope:engine.recordValue(test,'TESTED_SCOPE'),
    positiveResultMeaning:engine.recordValue(test,'POSITIVE_RESULT_MEANING'),
    negativeResultMeaning:engine.recordValue(test,'NEGATIVE_RESULT_MEANING'),
    semanticCoverageDisposition:engine.recordValue(test,'SEMANTIC_COVERAGE_DISPOSITION')
  };
}

function proofExpressionSemanticPayload(expression){
  return {
    targetPropositionIds:['PROP-1'],
    expression:engine.recordValue(expression,'NORMALIZED_EXPRESSION'),
    semanticRationale:engine.recordValue(expression,'SEMANTIC_RATIONALE')
  };
}

function addReviewContexts(project,stage,authorId,reviewerId){
  const scope=engine.currentScope(project);
  const author=add(project,'freshContexts',authorId,stage,{EXTERNAL_CONTEXT_IDENTIFIER:`external-${authorId}`,ROLE:'AUTHOR'},{},scope);
  const reviewer=add(project,'freshContexts',reviewerId,stage,{EXTERNAL_CONTEXT_IDENTIFIER:`external-${reviewerId}`,ROLE:'INDEPENDENT REVIEWER'},{},scope);
  author.source='HUMAN_INPUT';
  reviewer.source='HUMAN_REVIEWER_CONTEXT';
  return {author,reviewer,scope};
}

function addAcceptedChange(project,{stage,operation,changeId,proposalId,promptId,contextId,canonicalRecordIds=[]}){
  const change={changeId,stage,operation,proposalId,promptId,status:'COMMITTED',responseType:'DATA_PROPOSAL',scope:{...engine.currentScope(project),contextId},canonicalRecordIds:[...canonicalRecordIds]};
  project.projectData.acceptedChanges.push(change);
  return change;
}

function proofFixture({exactSemanticReviews=true}={}){
  const project=makeProject('JOB-FINAL-SEMANTIC-GATES');
  const scope=engine.currentScope(project);
  const requirement=add(project,'requirements','REQ-1',4,{
    MANDATORY_OPTIONAL_STATUS:'MANDATORY',NORMATIVE_CLASSIFICATION:'MANDATORY',APPLICABILITY:'APPLICABLE',CURRENT_APPLICABILITY:'APPLICABLE',STATUS:'ACTIVE'
  },{PRIMARY_PROPOSITION_ID:'PROP-1'},scope);
  const proposition=add(project,'propositions','PROP-1',4,{
    PROPOSITION_ROLE:'PRIMARY_REQUIREMENT',PROPOSITION_TEXT:'The current product contains the required content.',SUBJECT_AND_SCOPE_DESCRIPTION:'The current product.',SATISFACTION_MEANING:'The required content is present.',FAILURE_MEANING:'The required content is absent.',STATUS:'CURRENT'
  },{REQUIREMENT_ID:'REQ-1'},scope);
  add(project,'applicabilityRecords','APPLICABILITY-1',5,{
    SUBJECT_TYPE:'PROPOSITION',SUBJECT_ID:'PROP-1',APPLICABILITY_PROPOSAL:'APPLICABLE',REASONING:'The accepted project scope activates this proposition.',NORMATIVE_CLASSIFICATION_PROPOSAL:'MANDATORY',NORMATIVE_CLASSIFICATION:'MANDATORY',CLASSIFICATION_REVIEW_REQUIRED:false,EVIDENCE_IDS:[],INDEPENDENT_REVIEW_ID:null,APPLICABILITY:'APPLICABLE',TRUTH_VALUE:'TRUE',EPISTEMIC_BASIS:'SELF_ASSERTED',FRESHNESS_STATUS:'CURRENT',CONTRADICTION_STATUS:'CLEAR',CURRENT_SELECTION:true,CURRENT_SCOPE:scope,STATUS:'CURRENT'
  },{SUBJECT_ID:'PROP-1',EVIDENCE_IDS:[]},scope);
  const test=add(project,'tests','TEST-1',6,{
    TEST_TYPE:'MEANING',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'INDEPENDENT_SEMANTIC_REVIEW',ARTIFACT_REQUIREMENTS:'CURRENT PRODUCT',INPUTS:'Current product.',TOOLS:'Independent reviewer.',PROCEDURE:'Inspect the exact current product.',EXPECTED_RESULT:'SATISFIED',FAILURE_CONDITION:'Required content is absent.',EVIDENCE_TO_PRESERVE:'Exact observation and location.',STATUS:'READY',
    TEST_PROPOSITION_TEXT:'The current product contains the required content.',TESTED_SCOPE:{product:'CURRENT'},POSITIVE_RESULT_MEANING:'The required content is present.',NEGATIVE_RESULT_MEANING:'The required content is absent.',SEMANTIC_COVERAGE_DISPOSITION:'EQUIVALENT',ACCEPTED_SEMANTIC_COVERAGE:'EQUIVALENT',SEMANTIC_REVIEW_IDS:exactSemanticReviews?['TEST-SEMANTIC-1']:['PROP-EQUIVALENCE-SELF'],TEST_ROLE:'REQUIRED_PROOF',RELEASE_BEARING:true,EXPECTED_VARIANCE_CONTRACT:{classification:'INVARIANT'},REQUIRED_EVIDENCE_CLASSES:['OBSERVATION_AND_ENTAILMENT'],REQUIRED_EPISTEMIC_BASES:['SELF_ASSERTED'],FRESHNESS_REQUIREMENTS:{status:'CURRENT'},INDEPENDENCE_REQUIREMENTS:{dimensions:['APPLICATION_INPUT_ISOLATION']},REQUIRED_RUN_DIMENSIONS:['PRODUCT_ID']
  },{REQ_ID:'REQ-1',TARGET_PROPOSITION_IDS:['PROP-1'],SEMANTIC_REVIEW_IDS:exactSemanticReviews?['TEST-SEMANTIC-1']:['PROP-EQUIVALENCE-SELF']},scope);
  const normalizedExpression={op:'LEAF',leafType:'TEST_RESULT_SET',referenceId:'TEST-1'};
  const expression=add(project,'proofExpressions','PROOF-EXPRESSION-1',6,{
    PROPOSED_EXPRESSION:normalizedExpression,SEMANTIC_RATIONALE:'This exact result set establishes the proposition.',NORMALIZED_EXPRESSION:normalizedExpression,SEMANTIC_EQUIVALENCE_DISPOSITION:'EQUIVALENT',SEMANTIC_REVIEW_IDS:exactSemanticReviews?['EXPRESSION-SEMANTIC-1']:['PROP-EQUIVALENCE-SELF'],CURRENT_SCOPE_HASH:hash.sha256Value(scope),EXPRESSION_SHA256:hash.sha256Value(normalizedExpression),TRUTH_VALUE:'UNKNOWN',STATUS:'CURRENT'
  },{TARGET_PROPOSITION_ID:'PROP-1',SEMANTIC_REVIEW_IDS:exactSemanticReviews?['EXPRESSION-SEMANTIC-1']:['PROP-EQUIVALENCE-SELF']},scope);
  add(project,'propositionEquivalenceReviews','PROP-EQUIVALENCE-SELF',5,{
    EQUIVALENCE_FINDING:'EQUIVALENT',REASONING:'The proposition is semantically identical to itself.',REVIEWER_ID:'SELF-REVIEWER',ACCEPTED_STATUS:'ACCEPTED',EQUIVALENCE_CLASS_ID:'PROP-CLASS-1'
  },{PROPOSITION_A_ID:'PROP-1',PROPOSITION_B_ID:'PROP-1'},scope);
  const contexts=addReviewContexts(project,6,'CONTEXT-6-AUTHOR','CONTEXT-6-REVIEWER');
  addAcceptedChange(project,{stage:6,operation:'COMPLETE',changeId:'CHANGE-6-AUTHOR',proposalId:'PROPOSAL-6-AUTHOR',promptId:'PROMPT-6-AUTHOR',contextId:'CONTEXT-6-AUTHOR',canonicalRecordIds:['TEST-1','PROOF-EXPRESSION-1']});
  addAcceptedChange(project,{stage:6,operation:'SEMANTIC_REVIEW',changeId:'CHANGE-6-REVIEWER',proposalId:'PROPOSAL-6-REVIEWER',promptId:'PROMPT-6-REVIEWER',contextId:'CONTEXT-6-REVIEWER',canonicalRecordIds:['TEST-SEMANTIC-1','EXPRESSION-SEMANTIC-1']});
  if(exactSemanticReviews){
    const common={EQUIVALENCE_FINDING:'EQUIVALENT',REASONING:'Independent exact semantic comparison establishes equivalence.',REVIEWER_ID:'INDEPENDENT-SEMANTIC-REVIEWER',AUTHOR_ACCEPTED_CHANGE_ID:'CHANGE-6-AUTHOR',REVIEW_ACCEPTED_CHANGE_ID:'CHANGE-6-REVIEWER',AUTHOR_PROMPT_IDENTITY:'PROMPT-6-AUTHOR',REVIEW_PROMPT_IDENTITY:'PROMPT-6-REVIEWER',INDEPENDENCE_STATUS:'APPLICATION_ESTABLISHED',ACCEPTED_STATUS:'ACCEPTED'};
    add(project,'testSemanticReviews','TEST-SEMANTIC-1',6,{...common,SUBJECT_KIND:'TEST',SUBJECT_SEMANTIC_SHA256:hash.sha256Value(testSemanticPayload(test))},{TEST_ID:'TEST-1',TARGET_PROPOSITION_IDS:['PROP-1']},scope);
    add(project,'testSemanticReviews','EXPRESSION-SEMANTIC-1',6,{...common,SUBJECT_KIND:'PROOF_EXPRESSION',SUBJECT_SEMANTIC_SHA256:hash.sha256Value(proofExpressionSemanticPayload(expression))},{PROOF_EXPRESSION_ID:'PROOF-EXPRESSION-1',TARGET_PROPOSITION_IDS:['PROP-1']},scope);
  }
  return {project,scope,requirement,proposition,test,expression,contexts};
}

function addCurrentEvidence(project,id,{stage=5,sourceProposalId=null,freshness='CURRENT',source='AGENT_RESPONSE',attachmentId='UNKNOWN'}={}){
  const evidence=add(project,'evidenceRecords',id,stage,{
    KIND:'SEMANTIC_EVIDENCE',DESCRIPTION:'Current evidence bound to the exact proposition.',AUTHORITY_TYPE:'EXTERNAL_AGENT_RESPONSE',SOURCE_ID:'UNKNOWN',LOCATION:'Canonical fixture',CONTENT:'Exact current evidence.',ATTACHMENT_ID:attachmentId,SHA256:hash.sha256Text('Exact current evidence.'),FRESHNESS_STATUS:freshness,STATUS:'PRESERVED'
  },attachmentId==='UNKNOWN'?{}:{ATTACHMENT_ID:attachmentId},engine.currentScope(project),sourceProposalId);
  evidence.source=source;
  return evidence;
}

function applicabilityPayload(project,record){
  const proposition=project.projectData.propositions.find(item=>engine.recordId(item,'propositions')==='PROP-1');
  return {
    subjectId:'PROP-1',
    subjectSemanticSha256:String(engine.recordValue(proposition,'CONTENT_SHA256')||proposition?.contentSha256||proposition?.recordSha256||''),
    requirementId:'REQ-1',
    activationPropositionId:null,
    activationSemanticSha256:'',
    proposal:engine.recordValue(record,'APPLICABILITY_PROPOSAL'),
    normativeClassificationProposal:engine.recordValue(record,'NORMATIVE_CLASSIFICATION_PROPOSAL'),
    reasoning:engine.recordValue(record,'REASONING'),
    evidenceIds:['EVIDENCE-APPLICABILITY']
  };
}

function notApplicableFixture(){
  const {project,requirement,proposition}=proofFixture();
  const applicability=project.projectData.applicabilityRecords[0];
  addCurrentEvidence(project,'EVIDENCE-APPLICABILITY',{stage:5});
  setFields(applicability,{
    APPLICABILITY_PROPOSAL:'NOT_APPLICABLE',REASONING:'Affirmative current evidence proves this proposition is outside the accepted scope.',EVIDENCE_IDS:['EVIDENCE-APPLICABILITY'],INDEPENDENT_REVIEW_ID:'APPLICABILITY-REVIEW-1',APPLICABILITY:'NOT_APPLICABLE',TRUTH_VALUE:'FALSE',EPISTEMIC_BASIS:'EXTERNALLY_SUPPORTED',FRESHNESS_STATUS:'CURRENT',STATUS:'CURRENT'
  });
  applicability.relationships={...applicability.relationships,EVIDENCE_IDS:['EVIDENCE-APPLICABILITY'],INDEPENDENT_REVIEW_ID:'APPLICABILITY-REVIEW-1'};
  applicability.evidenceRefs=['EVIDENCE-APPLICABILITY'];
  engine.refreshRecordHashes(applicability,'applicabilityRecords');
  addReviewContexts(project,5,'CONTEXT-5-AUTHOR','CONTEXT-5-REVIEWER');
  addAcceptedChange(project,{stage:5,operation:'COMPLETE',changeId:'CHANGE-5-AUTHOR',proposalId:'PROPOSAL-5-AUTHOR',promptId:'PROMPT-5-AUTHOR',contextId:'CONTEXT-5-AUTHOR',canonicalRecordIds:['APPLICABILITY-1']});
  addAcceptedChange(project,{stage:5,operation:'APPLICABILITY_REVIEW',changeId:'CHANGE-5-REVIEWER',proposalId:'PROPOSAL-5-REVIEWER',promptId:'PROMPT-5-REVIEWER',contextId:'CONTEXT-5-REVIEWER',canonicalRecordIds:['APPLICABILITY-REVIEW-1']});
  add(project,'applicabilityReviews','APPLICABILITY-REVIEW-1',5,{
    REVIEW_FINDING:'ACCEPTED',REASONING:'Independent review confirms the exact exclusion and evidence.',REVIEWER_ID:'INDEPENDENT-APPLICABILITY-REVIEWER',REVIEWED_NORMATIVE_CLASSIFICATION:'MANDATORY',SUBJECT_SEMANTIC_SHA256:hash.sha256Value(applicabilityPayload(project,applicability)),AUTHOR_ACCEPTED_CHANGE_ID:'CHANGE-5-AUTHOR',REVIEW_ACCEPTED_CHANGE_ID:'CHANGE-5-REVIEWER',AUTHOR_PROMPT_IDENTITY:'PROMPT-5-AUTHOR',REVIEW_PROMPT_IDENTITY:'PROMPT-5-REVIEWER',INDEPENDENCE_STATUS:'APPLICATION_ESTABLISHED',CURRENT_SCOPE:engine.currentScope(project),ACCEPTED_STATUS:'ACCEPTED'
  },{APPLICABILITY_ID:'APPLICABILITY-1',SUBJECT_PROPOSITION_ID:'PROP-1',EVIDENCE_IDS:['EVIDENCE-APPLICABILITY']},engine.currentScope(project));
  return {project,requirement,proposition,applicability};
}

function conditionalFixture(){
  const project=makeProject('JOB-CONDITIONAL-ACTIVATION');
  const scope=engine.currentScope(project);
  const requirement=add(project,'requirements','REQ-CONDITIONAL',4,{
    MANDATORY_OPTIONAL_STATUS:'CONDITIONAL',NORMATIVE_CLASSIFICATION:'CONDITIONAL',CURRENT_APPLICABILITY:'UNKNOWN',STATUS:'ACTIVE'
  },{PRIMARY_PROPOSITION_ID:'PROP-CONDITIONED'},scope);
  const primary=add(project,'propositions','PROP-CONDITIONED',4,{PROPOSITION_ROLE:'PRIMARY_REQUIREMENT',PROPOSITION_TEXT:'The product includes the conditional feature.',SUBJECT_AND_SCOPE_DESCRIPTION:'Current product.',SATISFACTION_MEANING:'Feature included.',FAILURE_MEANING:'Feature omitted.',STATUS:'CURRENT'},{REQUIREMENT_ID:'REQ-CONDITIONAL'},scope);
  const activation=add(project,'propositions','PROP-ACTIVATION',4,{PROPOSITION_ROLE:'CONDITIONAL_ACTIVATION',PROPOSITION_TEXT:'The accepted activation condition is true.',SUBJECT_AND_SCOPE_DESCRIPTION:'Current project scope.',SATISFACTION_MEANING:'Condition active.',FAILURE_MEANING:'Condition inactive.',STATUS:'CURRENT'},{REQUIREMENT_ID:'REQ-CONDITIONAL'},scope);
  add(project,'applicabilityRecords','APPLICABILITY-CONDITIONAL',5,{
    SUBJECT_TYPE:'PROPOSITION',SUBJECT_ID:'PROP-CONDITIONED',ACTIVATION_PROPOSITION_ID:'PROP-ACTIVATION',APPLICABILITY_PROPOSAL:'APPLICABLE',REASONING:'Applicability follows the separately evaluated activation proposition.',NORMATIVE_CLASSIFICATION_PROPOSAL:'CONDITIONAL',NORMATIVE_CLASSIFICATION:'CONDITIONAL',CLASSIFICATION_REVIEW_REQUIRED:true,EVIDENCE_IDS:[],INDEPENDENT_REVIEW_ID:null,APPLICABILITY:'APPLICABLE',TRUTH_VALUE:'TRUE',EPISTEMIC_BASIS:'SELF_ASSERTED',FRESHNESS_STATUS:'CURRENT',CONTRADICTION_STATUS:'CLEAR',CURRENT_SELECTION:true,CURRENT_SCOPE:scope,STATUS:'CURRENT'
  },{SUBJECT_ID:'PROP-CONDITIONED',ACTIVATION_PROPOSITION_ID:'PROP-ACTIVATION',EVIDENCE_IDS:[]},scope);
  const obligation=add(project,'proofObligations','PROOF-ACTIVATION',6,{
    OBLIGATION_ROLE:'CONDITIONAL_ACTIVATION',PROPOSITION_ID:'PROP-ACTIVATION',REQUIREMENT_ID:'REQ-CONDITIONAL',NORMATIVE_CLASS:'CONDITIONAL',APPLICABILITY:'APPLICABLE',ACTIVATION_PROPOSITION_ID:null,PROOF_EXPRESSION_ID:'PROOF-EXPRESSION-ACTIVATION',REQUIRED_TEST_IDS:[],REQUIRED_OBSERVATION_LEAF_IDS:['OBS-ACTIVATION'],REQUIRED_EVIDENCE_CLASSES:['OBSERVATION_AND_ENTAILMENT'],REQUIRED_EPISTEMIC_BASES:['APPLICATION_OBSERVED'],REQUIRED_SOURCE_IDS:[],SOURCE_STATE_REQUIREMENTS:[],SOURCE_STATE_SHA256:hash.sha256Value([]),REQUIRED_ARTIFACT_IDS:[],REQUIRED_DEPENDENCY_IDS:[],FRESHNESS_REQUIREMENTS:{status:'CURRENT'},INDEPENDENCE_REQUIREMENTS:{dimensions:['APPLICATION_INPUT_ISOLATION']},REQUIRED_RUN_DIMENSIONS:['PRODUCT_ID'],SATISFACTION_STATE:'UNKNOWN',BLOCKING_REASONS:[],CURRENT_SCOPE_HASH:hash.sha256Value(scope),STATUS:'CURRENT'
  },{PROPOSITION_ID:'PROP-ACTIVATION',REQUIREMENT_ID:'REQ-CONDITIONAL',REQUIRED_TEST_IDS:[]},scope);
  addCurrentEvidence(project,'EVIDENCE-ACTIVATION',{stage:5});
  const observation=add(project,'observationRecords','OBS-ACTIVATION',5,{
    ORIGIN_CLASS:'NATIVE_APPLICATION_OBSERVATION',SUBMITTING_ACTOR:'APPLICATION',SUBJECT_DESCRIPTION:'Activation observation.',NATIVE_OBSERVED_VALUE:{active:true},NATIVE_OBSERVED_LOCATION:'CANONICAL_ACTIVATION_FIXTURE',NATIVE_METHOD_OR_TOOL:'APPLICATION_FIXTURE',EPISTEMIC_BASIS:'APPLICATION_OBSERVED',FRESHNESS_STATUS:'CURRENT',SOURCE_EVIDENCE_IDS:['EVIDENCE-ACTIVATION'],CURRENT_SCOPE:scope,STATUS:'CURRENT'
  },{PROPOSITION_ID:'PROP-ACTIVATION',SOURCE_EVIDENCE_IDS:['EVIDENCE-ACTIVATION']},scope,null,['EVIDENCE-ACTIVATION']);
  const entailment=add(project,'entailmentReviews','ENTAILMENT-ACTIVATION',5,{
    ENTAILMENT_FINDING:'ESTABLISHES',REASONING:'The exact activation observation establishes the activation proposition.',REVIEWER_ID:'APPLICATION_FIXTURE',ACCEPTED_RELATION:'ESTABLISHES',CURRENT_SCOPE:scope,STATUS:'CURRENT'
  },{OBSERVATION_ID:'OBS-ACTIVATION',PROPOSITION_ID:'PROP-ACTIVATION',PROOF_OBLIGATION_ID:'PROOF-ACTIVATION',EVIDENCE_IDS:['EVIDENCE-ACTIVATION']},scope,null,['EVIDENCE-ACTIVATION']);
  return {project,requirement,primary,activation,obligation,observation,entailment};
}

function addProduct(project){
  project.job.CURRENT_PRODUCT_ID='PRODUCT-1';
  const productScope={...engine.currentScope(project),productId:'PRODUCT-1'};
  const product=add(project,'products','PRODUCT-1',21,{PRODUCT_VERSION:'v1',PRODUCTION_CONTEXT_ID:'CONTEXT-PRODUCER',GENERATED_ARTIFACT_INVENTORY:['ARTIFACT-1'],STATUS:'COMPLETED'},{PRODUCTION_CONTEXT_ID:'CONTEXT-PRODUCER'},productScope);
  product.completionState='COMPLETED';
  const artifact=add(project,'artifacts','ARTIFACT-1',21,{FILENAME:'product.txt',TYPE:'text/plain',VERSION:'v1',BYTE_SIZE:7,SHA256:'a'.repeat(64),HASH_ALGORITHM:'SHA-256',ROLE:'PRODUCT',STORAGE_REFERENCE:'indexeddb:ARTIFACT-1',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED',DISCLOSURE_CLASSIFICATION:'PUBLIC',NOTES:'fixture'}, {},productScope);
  const producer=add(project,'freshContexts','CONTEXT-PRODUCER',21,{EXTERNAL_CONTEXT_IDENTIFIER:'external-producer',ROLE:'PRODUCTION'},{},productScope);
  producer.source='HUMAN_INPUT';
  return {product,artifact,productScope};
}

function resultFixture(){
  const fixture=proofFixture();
  const registry=engine.deriveProofObligationRegistry(fixture.project,{commit:true});
  if(!registry.complete)throw new Error('Result fixture proof registry is not complete: '+registry.reasons.join(' | '));
  const obligation=fixture.project.projectData.proofObligations[0];
  addProduct(fixture.project);
  return {...fixture,obligation,obligationId:engine.recordId(obligation,'proofObligations')};
}

function reserveExternalResultOperation(project,{stage,proposalId,scope,testIds=['TEST-1']}={}){
  const promptId=`PROMPT-${proposalId}`,operation='COMPLETE',targetSlot=`EXTERNAL-RESULT:${proposalId}`,projectRevision=Number(project.revision||0),boundScope={...scope,projectRevision};
  const artifact=project.projectData.artifacts.find(record=>engine.recordId(record,'artifacts')==='ARTIFACT-1');
  if(!artifact)throw new Error('External result fixture requires ARTIFACT-1.');
  const descriptor={
    schema:'closed-loop-execution-package-descriptor/1',jobId:project.job.JOB_ID,stage,operation,targetSlot,scopeSha256:hash.sha256Value(boundScope),testIds:[...testIds],
    artifacts:[{artifactId:'ARTIFACT-1',filename:engine.recordValue(artifact,'FILENAME'),byteSize:engine.recordValue(artifact,'BYTE_SIZE'),sha256:engine.recordValue(artifact,'SHA256'),role:engine.recordValue(artifact,'ROLE'),availability:engine.recordValue(artifact,'AVAILABILITY'),disclosureClassification:engine.recordValue(artifact,'DISCLOSURE_CLASSIFICATION')}],
    filesToWithhold:[],expectedReturnFiles:[],disclosureAuthorization:'PUBLIC_FIXTURE',productId:'PRODUCT-1'
  };
  const packageManifestHash=hash.sha256Value(descriptor),packageId=`PACKAGE-${packageManifestHash.slice(0,24).toUpperCase()}`;
  const reservation=engine.reserveOperation(project,{stage,operation,targetSlot,packageId,promptIdentity:promptId,contextSignature:`CONTEXT-SIGNATURE-${proposalId}`,packageManifestHash,packageDescriptor:descriptor,expectedRevision:projectRevision,promptProjectRevision:projectRevision,owningBrowserTabInstance:'SEMANTIC-GATE-FIXTURE',scope,disclosureClassification:'PUBLIC',authorizationBasis:'APPLICATION_FIXTURE'});
  const reservationId=engine.recordId(reservation,'operationReservations'),operationBinding={packageId,operationReservationId:reservationId,challengeNonce:engine.recordValue(reservation,'CHALLENGE_NONCE'),projectRevision,scopeSha256:engine.recordValue(reservation,'SCOPE_HASH'),targetSlot};
  project.projectData.responseProposals.push({proposalId,stage,operation,promptId,status:'PENDING_OPERATOR_REVIEW',envelope:{operation,scope:boundScope,operationBinding}});
  return {promptId,reservationId,operationBinding,scope:boundScope};
}

function normalizeAndAcceptExternalResult(fixture,external,{stage}={}){
  engine.normalizeAcceptedAgentConsequences(fixture.project,{stage,operation:'COMPLETE',proposalId:external.proposalId,rawResponseId:`RAW-${external.proposalId}`,promptId:external.promptId,changeId:`CHANGE-${external.proposalId}`});
  engine.acceptOperationReservation(fixture.project,external.reservationId,{expectedRevision:Number(fixture.project.revision||0),reason:`Accepted fixture response ${external.proposalId}.`});
}

function addExternalResult(fixture,{stage,collection,proposalId,relation='ESTABLISHES',claimedDetermination='SATISFIED',defectId=null,extraAttestation=false}={}){
  const {project,obligationId}=fixture;
  const contextId=`CONTEXT-${stage}-${proposalId}`;
  const baseScope={...engine.currentScope(project),productId:'PRODUCT-1',contextId},binding=reserveExternalResultOperation(project,{stage,proposalId,scope:baseScope}),scope=binding.scope;
  const context=add(project,'freshContexts',contextId,stage,{EXTERNAL_CONTEXT_IDENTIFIER:`external-${proposalId}`,ROLE:'INDEPENDENT REVIEWER'},{},scope);
  context.source='HUMAN_REVIEWER_CONTEXT';
  const resultId=`RESULT-${proposalId}`,observationId=`OBS-${proposalId}`,entailmentId=`ENT-${proposalId}`,evidenceId=`EVIDENCE-${proposalId}`;
  addAcceptedChange(project,{stage,operation:'COMPLETE',changeId:`CHANGE-${proposalId}`,proposalId,promptId:binding.promptId,contextId,canonicalRecordIds:[resultId]});
  addCurrentEvidence(project,evidenceId,{stage,sourceProposalId:proposalId,attachmentId:'ARTIFACT-1'});
  const evidenceIds=[evidenceId];
  if(extraAttestation){
    const attestation=add(project,'evidenceRecords',`ATTESTATION-${proposalId}`,stage,{
      KIND:'TOOL_ATTESTATION',DESCRIPTION:'A valid attestation for a different operation.',AUTHORITY_TYPE:'EXTERNAL_SYSTEM_ATTESTATION',SOURCE_ID:'UNKNOWN',LOCATION:'Unrelated operation',CONTENT:'This attestation does not bind the current result.',ATTACHMENT_ID:'ARTIFACT-1',SHA256:hash.sha256Text('unrelated attestation'),FRESHNESS_STATUS:'CURRENT',STATUS:'PRESERVED',ATTESTATION_ID:'ATTESTATION-UNRELATED',ATTESTATION_VERIFICATION_STATUS:'VERIFIED',ATTESTATION_VERIFIER_ID:'APPLICATION-ATTESTATION-VERIFIER',ATTESTATION_BINDING:{resultId:'RESULT-OTHER',observationId:'OBS-OTHER',testId:'TEST-OTHER',propositionId:'PROP-OTHER',inputIdentitySha256:'f'.repeat(64)}
    },{ATTACHMENT_ID:'ARTIFACT-1'},scope,proposalId);
    attestation.source='APPLICATION_ATTESTATION_VERIFICATION';
    evidenceIds.push(`ATTESTATION-${proposalId}`);
  }
  const observation=add(project,'observationRecords',observationId,stage,{
    EXTERNAL_OBSERVED_VALUE:{determination:claimedDetermination,finding:'External observation.'},EXTERNAL_OBSERVED_LOCATION:'product.txt',EXTERNAL_METHOD_OR_TOOL:'Independent reviewer',EXTERNAL_LIMITATIONS:'External attribution is not independently verified.'
  },{},scope,proposalId,evidenceIds);
  const entailment=add(project,'entailmentReviews',entailmentId,stage,{ENTAILMENT_FINDING:relation,REASONING:'The observation has the declared semantic relation.',REVIEWER_ID:'INDEPENDENT-REVIEWER'},{OBSERVATION_ID:observationId,PROPOSITION_ID:'PROP-1',PROOF_OBLIGATION_ID:obligationId},scope,proposalId,evidenceIds);
  let fields;
  if(collection==='meaningResults')fields={PRODUCT_LOCATION:'product.txt',EXTERNAL_SOURCE_EVIDENCE:'Canonical evidence.',REQUIRED_MEANING:'Required content.',OBSERVED_MEANING:'Required content.',EVIDENCE_BASED_COMPARISON:'MATCH',DETERMINATION:claimedDetermination};
  else if(collection==='adversarialResults')fields={ATTACK:'Search for a counterexample.',METHOD:'Independent adversarial review.',EXPECTED_BEHAVIOR:'No mandatory defect.',ACTUAL_RESULT:'NO MATERIAL ADVERSARIAL DEFECT FOUND',DETERMINATION:claimedDetermination,DEFECT_ID:defectId,SEVERITY:defectId?'MAJOR':'NONE',EVIDENCE:evidenceId};
  else fields={TOOL_AND_VERSION:'External verifier 1',PROCEDURE:'Inspect exact product bytes.',ACTUAL_RESULT:claimedDetermination,DETERMINATION:claimedDetermination};
  const result=add(project,collection,resultId,stage,fields,{REQ_ID:'REQ-1',TEST_ID:'TEST-1',PRODUCT_ID:'PRODUCT-1',PROPOSITION_ID:'PROP-1',PROOF_OBLIGATION_ID:obligationId,OBSERVATION_ID:observationId,ENTAILMENT_ID:entailmentId,...(defectId?{DEFECT_ID:defectId}:{})},scope,proposalId,evidenceIds);
  return {proposalId,resultId,observationId,entailmentId,evidenceIds,observation,entailment,result,...binding};
}

// A proposition self-equivalence record cannot certify a test or proof expression.
{
  const {project}=proofFixture({exactSemanticReviews:false});
  const registry=engine.deriveProofObligationRegistry(project);
  equal(registry.complete,false,'Proposition self-review incorrectly closed the proof-obligation registry.');
  matches(registry.reasons,/TEST-1:.*exactly one accepted independent semantic review.*test payload/i,'The registry did not expose the missing exact independent test review.');
  matches(registry.reasons,/PROP-1:.*exactly one accepted independent semantic review.*proof expression payload/i,'The registry did not expose the missing exact independent proof-expression review.');
  equal(project.projectData.testSemanticReviews.length,0,'The self-equivalence fixture unexpectedly contained a controlling test/proof semantic review.');
}

// Every release-bearing proof contract partition is closed and nonempty.
{
  const {project}=proofFixture();
  const baseline=engine.deriveProofObligationRegistry(project);
  equal(baseline.complete,true,'The complete exact semantic-review fixture did not close before contract mutations.');
  const mutations=[
    ['REQUIRED_EVIDENCE_CLASSES',[],/REQUIRED_EVIDENCE_CLASSES is empty/i],
    ['REQUIRED_EPISTEMIC_BASES',[],/REQUIRED_EPISTEMIC_BASES is empty/i],
    ['FRESHNESS_REQUIREMENTS',{},/closed \{status\} contract/i],
    ['INDEPENDENCE_REQUIREMENTS',{},/nonempty closed dimensions list/i],
    ['REQUIRED_RUN_DIMENSIONS',[],/REQUIRED_RUN_DIMENSIONS is empty/i]
  ];
  for(const [field,value,pattern] of mutations){
    const changed=structuredClone(project),test=changed.projectData.tests.find(record=>engine.recordId(record,'tests')==='TEST-1');
    setFields(test,{[field]:value});
    engine.refreshRecordHashes(test,'tests');
    const registry=engine.deriveProofObligationRegistry(changed);
    equal(registry.complete,false,`${field} empty mutation incorrectly preserved proof closure.`);
    matches(registry.reasons,pattern,`${field} empty mutation did not expose its closed-contract failure.`);
  }
}

// Independent semantic reviews intentionally use a different operation context,
// while every controlling project/proof scope dimension must still match.
{
  const {project,scope,test,expression}=proofFixture();
  test.scope={...scope,contextId:'CONTEXT-6-AUTHOR'};
  expression.scope={...scope,contextId:'CONTEXT-6-AUTHOR'};
  for(const review of project.projectData.testSemanticReviews)review.scope={...scope,contextId:'CONTEXT-6-REVIEWER'};
  engine.refreshRecordHashes(test,'tests');
  engine.refreshRecordHashes(expression,'proofExpressions');
  for(const review of project.projectData.testSemanticReviews)engine.refreshRecordHashes(review,'testSemanticReviews');
  equal(engine.deriveProofObligationRegistry(project).complete,true,'A valid independent semantic review was discarded solely because its reviewer context differs from the author context.');
  equal(engine.currentStageOperation(project,6).operation,'SEMANTIC_REVIEW','Stage 06 semantic-review closure could not derive its current operation after all exact reviews were accepted.');
  const stale=structuredClone(project);
  for(const review of stale.projectData.testSemanticReviews){review.scope.testSuiteVersion='TEST-v000';engine.refreshRecordHashes(review,'testSemanticReviews');}
  equal(engine.deriveProofObligationRegistry(stale).complete,false,'A semantic review from a stale controlling test-suite scope was accepted.');
}

// NOT_APPLICABLE needs exact independent review and current affirmative evidence.
{
  const fixture=notApplicableFixture();
  const accepted=engine.evaluateApplicability(fixture.project,{requirement:fixture.requirement,proposition:fixture.proposition});
  equal(accepted.applicability,'NOT_APPLICABLE','The exact independently reviewed, currently evidenced exclusion was not accepted.');
  equal(accepted.reasons.length,0,'The valid NOT_APPLICABLE fixture retained blocking reasons.');
  equal(engine.currentStageOperation(fixture.project,5).operation,'COMPLETE','Stage 05 semantic-review closure could not derive its current operation after all required reviews were accepted.');
  const noReview=structuredClone(fixture.project);
  noReview.projectData.applicabilityReviews[0].active=false;
  const noReviewState=engine.evaluateApplicability(noReview,{requirement:noReview.projectData.requirements[0],proposition:noReview.projectData.propositions[0]});
  equal(noReviewState.applicability,'UNKNOWN','NOT_APPLICABLE without its exact accepted independent review did not fail closed.');
  matches(noReviewState.reasons,/accepted independent applicability review/i,'Missing NOT_APPLICABLE review was not explained.');
  const expired=structuredClone(fixture.project),evidence=expired.projectData.evidenceRecords.find(record=>engine.recordId(record,'evidenceRecords')==='EVIDENCE-APPLICABILITY');
  setFields(evidence,{FRESHNESS_STATUS:'EXPIRED'});
  engine.refreshRecordHashes(evidence,'evidenceRecords');
  const expiredState=engine.evaluateApplicability(expired,{requirement:expired.projectData.requirements[0],proposition:expired.projectData.propositions[0]});
  equal(expiredState.applicability,'UNKNOWN','Expired exclusion evidence still removed the proposition from release scope.');
  matches(expiredState.reasons,/expired|unknown freshness/i,'Expired NOT_APPLICABLE evidence was not explained.');
}

// Conditional activation is one proposition relationship with three-valued, cycle-safe evaluation.
{
  const fixture=conditionalFixture();
  const active=engine.evaluateApplicability(fixture.project,{requirement:fixture.requirement,proposition:fixture.primary});
  equal(active.applicability,'APPLICABLE','TRUE conditional activation did not activate the requirement.');
  equal(active.truthValue,'TRUE','TRUE conditional activation did not expose an affirmative applicability truth value.');
  const inactiveProject=structuredClone(fixture.project),inactiveEntailment=inactiveProject.projectData.entailmentReviews[0];
  setFields(inactiveEntailment,{ENTAILMENT_FINDING:'REFUTES',ACCEPTED_RELATION:'REFUTES'});
  engine.refreshRecordHashes(inactiveEntailment,'entailmentReviews');
  const inactive=engine.evaluateApplicability(inactiveProject,{requirement:inactiveProject.projectData.requirements[0],proposition:inactiveProject.projectData.propositions.find(record=>engine.recordId(record,'propositions')==='PROP-CONDITIONED')});
  equal(inactive.applicability,'NOT_APPLICABLE','FALSE conditional activation did not deactivate the requirement.');
  equal(inactive.truthValue,'FALSE','FALSE conditional activation did not expose a negative applicability truth value.');
  const unknownProject=structuredClone(fixture.project),unknownEntailment=unknownProject.projectData.entailmentReviews[0];
  setFields(unknownEntailment,{ENTAILMENT_FINDING:'UNKNOWN',ACCEPTED_RELATION:'UNKNOWN'});
  engine.refreshRecordHashes(unknownEntailment,'entailmentReviews');
  const unknown=engine.evaluateApplicability(unknownProject,{requirement:unknownProject.projectData.requirements[0],proposition:unknownProject.projectData.propositions.find(record=>engine.recordId(record,'propositions')==='PROP-CONDITIONED')});
  equal(unknown.applicability,'UNKNOWN','UNKNOWN conditional activation did not fail closed.');
  const cycle=engine.evaluateApplicability(fixture.project,{requirement:fixture.requirement,proposition:fixture.primary,seen:new Set(['PROP-ACTIVATION'])});
  equal(cycle.applicability,'UNKNOWN','Conditional activation cycle did not fail closed.');
  equal(cycle.contradictionStatus,'CONTRADICTED','Conditional activation cycle did not become a contradiction.');
  matches(cycle.reasons,/cycle/i,'Conditional activation cycle was not explained.');
}

// Stages 23-25 consume application-normalized observation/entailment outcomes, never agent success claims.
{
  const meaning=resultFixture(),meaningResult=addExternalResult(meaning,{stage:23,collection:'meaningResults',proposalId:'STAGE23-REFUTES',relation:'REFUTES',claimedDetermination:'SATISFIED'});
  normalizeAndAcceptExternalResult(meaning,meaningResult,{stage:23});
  equal(engine.recordValue(meaningResult.result,'APPLICATION_DETERMINATION'),'VIOLATED','Stage 23 REFUTES was not application-normalized to VIOLATED.');
  equal(engine.effectiveDetermination('meaningResults',meaningResult.result,meaning.test,meaning.project),'VIOLATED','Stage 23 effective result trusted an agent SATISFIED claim over REFUTES.');
  equal(engine.recordValue(meaningResult.result,'DETERMINATION'),'SATISFIED','The fixture no longer proves that the unfavorable effective result overrides the preserved agent claim.');

  const adversarial=resultFixture(),adversarialResult=addExternalResult(adversarial,{stage:24,collection:'adversarialResults',proposalId:'STAGE24-REFUTES',relation:'REFUTES',claimedDetermination:'SATISFIED'});
  normalizeAndAcceptExternalResult(adversarial,adversarialResult,{stage:24});
  equal(engine.recordValue(adversarialResult.result,'APPLICATION_DETERMINATION'),'VIOLATED','Stage 24 REFUTES was not application-normalized to VIOLATED.');
  equal(engine.effectiveDetermination('adversarialResults',adversarialResult.result,adversarial.test,adversarial.project),'VIOLATED','Stage 24 effective result trusted an agent SATISFIED claim over REFUTES.');

  const defect=resultFixture(),defectResult=addExternalResult(defect,{stage:24,collection:'adversarialResults',proposalId:'STAGE24-DEFECT',relation:'ESTABLISHES',claimedDetermination:'SATISFIED',defectId:'DEFECT-FOUND'});
  normalizeAndAcceptExternalResult(defect,defectResult,{stage:24});
  equal(engine.effectiveDetermination('adversarialResults',defectResult.result,defect.test,defect.project),'VIOLATED','A Stage 24 defect was hidden by an agent SATISFIED claim.');

  const inspectionProject=makeProject('JOB-STAGE25-BARE-SUCCESS');
  addProduct(inspectionProject);
  const inspectionBinding=reserveExternalResultOperation(inspectionProject,{stage:25,proposalId:'PROPOSAL-STAGE25',scope:{...engine.currentScope(inspectionProject),productId:'PRODUCT-1',contextId:'CONTEXT-STAGE25'},testIds:[]}),inspectionScope=inspectionBinding.scope,inspectionEvidence=addCurrentEvidence(inspectionProject,'EVIDENCE-STAGE25',{stage:25,sourceProposalId:'PROPOSAL-STAGE25',attachmentId:'ARTIFACT-1'}),coverage={requiredPageOrViewIds:['VIEW-1'],inspectedPageOrViewIds:['VIEW-1'],requiredPackagedFileIds:[],openedOrTestedPackagedFileIds:[],requiredTransformationIds:[],inspectedTransformationIds:[],observation:'The artifact rendered.'};
  const inspection=add(inspectionProject,'representationInspections','INSPECTION-1',25,{ARTIFACT_ID:'ARTIFACT-1',FILENAME:'product.txt',VERSION:'v1',BYTE_SIZE:7,SHA256:'a'.repeat(64),REQUIRED_BY_TRACE:'TRACE-1',TRANSFORMATION_CHAIN:'NONE',TRANSFORMATION_TOOLS_VERSIONS:'NOT APPLICABLE',BEFORE_AFTER_HASHES:'UNCHANGED',RENDERING_OPENING_EVIDENCE:'Opened the exact artifact.',OBSERVATIONS:JSON.stringify(coverage),DEFECT_ID:null,DETERMINATION:'SATISFIED',EVIDENCE:'EVIDENCE-STAGE25'},{ARTIFACT_ID:'ARTIFACT-1'},inspectionScope,'PROPOSAL-STAGE25',['EVIDENCE-STAGE25']);
  addAcceptedChange(inspectionProject,{stage:25,operation:'COMPLETE',changeId:'CHANGE-STAGE25',proposalId:'PROPOSAL-STAGE25',promptId:'PROMPT-STAGE25',contextId:'CONTEXT-STAGE25',canonicalRecordIds:['INSPECTION-1']});
  let normalizationRejected=false;
  try{engine.normalizeAcceptedAgentConsequences(inspectionProject,{stage:25,operation:'COMPLETE',proposalId:'PROPOSAL-STAGE25',rawResponseId:'RAW-STAGE25',promptId:'PROMPT-STAGE25',changeId:'CHANGE-STAGE25'});}catch(error){normalizationRejected=/observation|entailment|proposition|proof obligation/i.test(String(error?.message||error));}
  const inspectionSufficiency=engine.evaluateEvidenceSufficiency(inspectionProject,{result:inspection}),inspectionGate=engine.gate(25,inspectionProject),bareSuccessBlocked=normalizationRejected||engine.recordValue(inspection,'APPLICATION_DETERMINATION')!=='SATISFIED'||!inspectionSufficiency.sufficient;
  check(bareSuccessBlocked,'Stage 25 accepted a bare agent SATISFIED claim without an application-normalized observation and entailment.');
  equal(inspectionGate.complete,false,'Stage 25 completed on a bare agent SATISFIED claim.');
  matches(inspectionGate.reasons,/observation|entailment|application-normalized|insufficient evidence/i,'Stage 25 did not explain the missing normalized observation/entailment path.');
  void inspectionEvidence;
}

// A verified attestation for another result cannot elevate this external observation or input binding.
{
  const fixture=resultFixture(),external=addExternalResult(fixture,{stage:22,collection:'deterministicResults',proposalId:'STAGE22-UNRELATED-ATTESTATION',relation:'ESTABLISHES',claimedDetermination:'SATISFIED',extraAttestation:true});
  normalizeAndAcceptExternalResult(fixture,external,{stage:22});
  equal(engine.recordValue(external.observation,'EPISTEMIC_BASIS'),'SELF_ASSERTED','An unrelated attestation elevated the observation epistemic basis.');
  equal(engine.recordValue(external.observation,'ORIGIN_CLASS'),'EXTERNAL_CLAIM','An unrelated attestation fabricated verified-external observation origin.');
  equal(engine.recordValue(external.result,'EPISTEMIC_BASIS'),'SELF_ASSERTED','An unrelated attestation elevated the deterministic result epistemic basis.');
  equal(engine.recordValue(external.result,'INPUT_BINDING_BASIS'),'SELF_ASSERTED','An unrelated attestation elevated external input binding.');
  const unrelated=fixture.project.projectData.evidenceRecords.find(record=>engine.recordId(record,'evidenceRecords')==='ATTESTATION-STAGE22-UNRELATED-ATTESTATION');
  check(engine.recordValue(unrelated,'OBSERVATION_ID')!==external.observationId||engine.recordValue(unrelated,'EPISTEMIC_BASIS')!=='VERIFIED_EXTERNAL','An unrelated attestation was rebound as verified evidence for the current observation.');
}

const EXPECTED_ASSERTIONS=47;
if(assertions!==EXPECTED_ASSERTIONS)throw new Error(`Verifier assertion count drifted: expected ${EXPECTED_ASSERTIONS}, executed ${assertions}.`);
console.log(JSON.stringify({status:'PASS',assertions,coverage:['independent-exact-test-review','independent-exact-proof-expression-review','independent-review-context-isolation-with-controlling-scope','closed-nonempty-proof-contracts','not-applicable-review-and-evidence','conditional-activation-three-valued','conditional-activation-cycle','stage23-refutation','stage24-refutation-and-defect','stage25-normalized-observation-entailment','unrelated-attestation-non-elevation']},null,2));

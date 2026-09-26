import {artifactFixtureId} from './test-artifact-fixtures.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {reviewProofFixture,recordProposal,evidence} from './test-fixtures.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Inject one fault into an in-memory module copy, never into retained source.
// Children execute this same existing gate with hard bounds and named oracles.
const comparisonFaults=[
 {id:'COMPARISON-ATOMIC-DEFECT-BINDING',file:'workflow-engine.js',from:'const defectIds=sorted([...explicitDefectIds,...coacceptedDefectIds]);',to:'const defectIds=sorted(explicitDefectIds);',oracle:'COMPARISON_ATOMIC_DEFECT_HANDOFF_ORACLE'},
 {id:'COMPARISON-ATOMIC-DEFECT-MEMBERSHIP',file:'workflow-engine.js',from:"safe(change.canonicalRecordIds).includes(recordId(defect,'defects'))",to:'true',oracle:'COMPARISON_ATOMIC_HANDOFF_BINDING_ORACLE'},
 {id:'COMPARISON-ATOMIC-DEFECT-PROVENANCE',file:'workflow-engine.js',from:'change.proposalId===defect.sourceProposalId',to:'true',oracle:'COMPARISON_ATOMIC_HANDOFF_BINDING_ORACLE'},
 {id:'COMPARISON-CORRECTED-DEFECT-AUTHORING',file:'workflow-schema.js',from:"agentWritableCollections:['comparisons','defects'],allowedStageData:[]",to:"agentWritableCollections:['comparisons'],allowedStageData:[]",expectedMatches:2,oracle:'COMPARISON_ATOMIC_DEFECT_CONTRACT_ORACLE'},
 {id:'COMPARISON-PRODUCTION-BINDING',file:'workflow-engine.js',from:'evaluateCrossRunComparison,__stage13CrossRunClosureVersion:',to:'__stage13CrossRunClosureVersion:',oracle:'PRODUCTION_COMPARISON_BINDING_ORACLE'},
 {id:'COMPARISON-MISSING-TUPLE',file:'workflow-engine.js',from:"if(count!==1)reasons.push('Exactly one current verification record is required for '",to:"if(false)reasons.push('Exactly one current verification record is required for '",oracle:'Missing required run verification was not rejected.'},
 {id:'COMPARISON-MISSING-CONTRACT',file:'workflow-engine.js',from:"if(!contracts[testId])reasons.push('Test '",to:"if(false)reasons.push('Test '",oracle:'Missing frozen expected-variance contract was not rejected.'},
 {id:'COMPARISON-UNKNOWN-AUTHORIZATION',file:'workflow-engine.js',from:"if(authorizedVariance==='UNKNOWN')reasons.push('Comparison '",to:"if(false)reasons.push('Comparison '",oracle:'UNKNOWN variance authorization did not block Stage 13.'},
 {id:'COMPARISON-NONRESOLVING-DEFECT',file:'workflow-engine.js',from:"if(!supportedDefect(id,reqId))reasons.push('Comparison '",to:"if(false)reasons.push('Comparison '",oracle:'A nonexistent defect marker authorized prohibited variance.'},
 {id:'COMPARISON-MUTATING-READ',file:'workflow-engine.js',from:"const version='closed-loop-cross-run-comparison/2',reasons=[]",to:"const mutated=project.projectData.comparisons[0];if(mutated)mutated.fields.__injectedReadCount=(mutated.fields.__injectedReadCount||0)+1;const version='closed-loop-cross-run-comparison/2',reasons=[]",oracle:'Comparison evaluation rewrote an accepted record.'},
 {id:'COMPARISON-SUPERSESSION',file:'response-ingestion.js',from:"if(!schema.RECORD_SCHEMAS[item.kind])continue;",to:"if(item.kind==='comparisons'||!schema.RECORD_SCHEMAS[item.kind])continue;",oracle:'COMPARISON_REPLACEMENT_CURRENT_ORACLE'},
 {id:'VERIFICATION-INDEPENDENT-BATCH',file:'response-ingestion.js',from:"if(fieldsReplaced&&(recordsReplaced||!entries.length&&sameLane))",to:"if(operation==='VERIFY'&&sameLane||fieldsReplaced&&(recordsReplaced||!entries.length&&sameLane))",oracle:'VERIFICATION_PARTIAL_BATCH_IMPACT_ORACLE'},
 {id:'VERIFICATION-SCOPED-REFINEMENT',file:'workflow-engine.js',from:'const affected=scoped?[selected]:current.filter(sameLane),dependentWork=',to:'const affected=current.filter(sameLane),dependentWork=',oracle:'VERIFICATION_SCOPED_REFINEMENT_ORACLE'},
 {id:'VERIFICATION-INDEPENDENT-PROMPT',file:'workflow-engine.js',from:'&&(!scoped||!retainedPromptIds.has(item.instructionId||item.promptId))',to:'',oracle:'VERIFICATION_INDEPENDENT_PROVENANCE_ORACLE'},
 {id:'VERIFICATION-INDEPENDENT-PROPOSAL',file:'workflow-engine.js',from:"||!scoped&&pending.status==='ACCEPTED'",to:"||pending.status==='ACCEPTED'",oracle:'VERIFICATION_INDEPENDENT_PROVENANCE_ORACLE'},
 {id:'VERIFICATION-INTRA-STAGE-DEPENDENCY',file:'workflow-engine.js',from:'if(!changed.size||start<0)return [];',to:'if(true)return [];',oracle:'VERIFICATION_SAME_STAGE_DEPENDENCY_ORACLE'},
 {id:'COMPARISON-UNCONFIRMED-ACCEPTANCE',file:'response-ingestion.js',from:'if(impact.requiresConfirmation&&confirmation?.confirmationKey!==impact.confirmationKey)',to:'if(false)',oracle:'COMPARISON_UNCONFIRMED_ORACLE'},
 {id:'UI-ADDITIONAL-BATCH-MISLABEL',file:'app-core.js',from:"impact.replaces.length?'This will replace selected accepted work.':'This will add the proposed records.'",to:"'This will replace selected accepted work.'",oracle:'ADDITIONAL_BATCH_CONFIRMATION_ORACLE'},
 {id:'UI-SAME-STAGE-DEPENDENCY',file:'app-core.js',from:'names=impact.affected.map',to:'names=impact.affected.filter(item=>item.stage!==acceptanceStage).map',oracle:'SAME_STAGE_CONFIRMATION_ORACLE'},
 {id:'SCOPED-BATCH-DUPLICATE',file:'response-ingestion.js',from:'if(target&&seen.has(target))issues.push',to:'if(false)issues.push',oracle:'SCOPED_BATCH_DUPLICATE_ORACLE'},
];
const selectedComparisonFault=process.argv.find(arg=>arg.startsWith('--comparison-fault='))?.split('=')[1];
const injectedComparisonFault=selectedComparisonFault&&comparisonFaults.find(fault=>fault.id===selectedComparisonFault);
if(selectedComparisonFault&&!injectedComparisonFault)throw new Error('Unknown comparison fault.');
const comparisonSourceHashes={},comparisonDigest=source=>createHash('sha256').update(source).digest('hex');
function comparisonModuleSource(file){
 let source=fs.readFileSync(file,'utf8');comparisonSourceHashes[file]=comparisonDigest(source);
 if(injectedComparisonFault?.file===file){
  if(source.split(injectedComparisonFault.from).length-1!==(injectedComparisonFault.expectedMatches||1))throw new Error('FAULT_ANCHOR_ORACLE: exact single fault location required.');
  source=source.replace(injectedComparisonFault.from,injectedComparisonFault.to);
 }
 return source;
}

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])createVerifierRuntime.loadScript(globalThis,comparisonModuleSource(file),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const hash=globalThis.closedLoopHash;
const engine=globalThis.closedLoopWorkflowEngine;
const assert=(value,message)=>{if(!value)throw new Error(message);};
assert(typeof engine.evaluateCrossRunComparison==='function','PRODUCTION_COMPARISON_BINDING_ORACLE: actual production modules do not expose the comparison authority.');
const sha='b'.repeat(64);
function record(collection,stage,fields,id,scope){const definition=schema.RECORD_SCHEMAS[collection],all={...fields,[definition.idField]:id},value={id,stage,active:true,scope:{...scope},fields:all,...all};engine.refreshRecordHashes(value,collection);return value;}
function fixture({iterationStage=10,additionalTest=false,varianceContract={dimensions:['semantic-result','output-result'],allowedVariance:'No correctness-affecting or outcome-changing variance; representational differences are allowed only when requirement truth is unchanged.'}}={}){
 const freezeStage=iterationStage===19?17:iterationStage,runStage=iterationStage===10?11:iterationStage,verificationStage=iterationStage===10?12:iterationStage,comparisonStage=iterationStage===10?13:iterationStage;
 const p=core.createBlankState('JOB-STAGE17-CROSS-RUN');Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Prove cross-run comparison over all ten verified runs.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'});engine.ensureShape(p);
 const req=record('requirements',4,{MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE',OBLIGATION:'The current candidate must satisfy the controlled proposition.'},'REQ-STAGE17',engine.currentScope(engine.stageContext(p,4)));p.projectData.requirements.push(req);
 const prop=record('propositions',4,{REQUIREMENT_ID:'REQ-STAGE17',PROPOSITION_TEXT:'The current candidate satisfies the controlled proposition.',STATUS:'SATISFIED',TRUTH_VALUE:'TRUE',CURRENT_SCOPE_STATUS:'CURRENT'},'PROPOSITION-STAGE17',engine.currentScope(engine.stageContext(p,4)));p.projectData.propositions.push(prop);
 const applicability=record('applicabilityRecords',5,{SUBJECT_ID:'PROPOSITION-STAGE17',PROPOSED_APPLICABILITY:'APPLICABLE',SELECTED_APPLICABILITY:'APPLICABLE',TRUTH_VALUE:'TRUE',EPISTEMIC_BASIS:'EXTERNALLY_SUPPORTED',CURRENT_SCOPE_STATUS:'CURRENT',FRESHNESS_STATUS:'CURRENT',CONTRADICTION_STATUS:'CLEAR',REASONING:'The mandatory proposition applies to every current run.'},'APPLICABILITY-STAGE17',engine.currentScope(engine.stageContext(p,5)));p.projectData.applicabilityRecords.push(applicability);
 const semanticReview=record('semanticReviews',5,{REVIEWED_RECORD_IDS:['APPLICABILITY-STAGE17'],REVIEWED_HASHES:[applicability.recordSha256||applicability.sha256],AUTHOR_CONTEXT_ID:'CONTEXT-STAGE17-APPLICABILITY-AUTHOR',REVIEWER_CONTEXT_ID:'CONTEXT-STAGE17-APPLICABILITY-REVIEWER',AUTHOR_RESERVATION_ID:'RESERVATION-STAGE17-APPLICABILITY-AUTHOR',REVIEWER_RESERVATION_ID:'RESERVATION-STAGE17-APPLICABILITY-REVIEWER',INDEPENDENCE_DETERMINATION:'APPLICATION_ESTABLISHED',REVIEW_QUESTION:'Does the proposed applicability preserve the governing mandatory proposition?',FINDING:'The mandatory proposition is applicable to every current Stage 17 run.',REASONING:'Independent current-scope semantic review of the applicability record.',RESULT:'ACCEPTED',ACCEPTED_DISPOSITION:'ACCEPTED',RECONCILIATION_STATUS:'NOT_REQUIRED',GATE_EFFECT:'ALLOW_IF_OTHER_GATES_PASS'},'SEMANTIC-REVIEW-STAGE17',engine.currentScope(engine.stageContext(p,5)));p.projectData.semanticReviews.push(semanticReview);
 const proofExpression=record('proofExpressions',6,{TARGET_PROPOSITION_ID:'PROPOSITION-STAGE17',PROPOSED_EXPRESSION:{type:'LEAF',propositionId:'PROPOSITION-STAGE17',truthExtraction:'ACCEPTED_ENTAILMENT',evidenceClasses:['OBSERVATION_RECORD','ACCEPTED_ENTAILMENT'],scopeBinding:'CURRENT'},NORMALIZED_EXPRESSION:{type:'LEAF',propositionId:'PROPOSITION-STAGE17',truthExtraction:'ACCEPTED_ENTAILMENT',evidenceClasses:['OBSERVATION_RECORD','ACCEPTED_ENTAILMENT'],scopeBinding:'CURRENT'},SEMANTIC_EQUIVALENCE_DISPOSITION:'EQUIVALENT',ACCEPTED_SEMANTIC_REVIEW_IDS:['SEMANTIC-REVIEW-STAGE17']},'PROOF-EXPRESSION-STAGE17',engine.currentScope(engine.stageContext(p,6)));p.projectData.proofExpressions.push(proofExpression);
 const expectedVarianceContract=varianceContract;
 const test=record('tests',6,{REQ_ID:'REQ-STAGE17',TARGET_PROPOSITION_IDS:['PROPOSITION-STAGE17'],SEMANTIC_COVERAGE_DISPOSITION:'EQUIVALENT',SEMANTIC_REVIEW_IDS:['SEMANTIC-REVIEW-STAGE17'],TEST_ROLE:'REQUIRED_PROOF',TEST_TYPE:'MEANING',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'independent semantic review',ARTIFACT_REQUIREMENTS:'NONE',EVIDENCE_TO_PRESERVE:'Independent per-run review evidence',STATUS:'READY',VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:12,REQUIRED_BY_STAGE:12,PER_RUN_REQUIRED:true,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{phaseTarget:true},EXPECTED_VARIANCE_CONTRACT:expectedVarianceContract},'TEST-STAGE17',engine.currentScope(engine.stageContext(p,6)));p.projectData.tests.push(test);
 if(additionalTest){const another=engine.clone(test);another.id='TEST-STAGE17-SECOND';another.fields.TEST_ID=another.TEST_ID=another.id;engine.refreshRecordHashes(another,'tests');p.projectData.tests.push(another);}
 for(let stage=1;stage<6;stage++){p.stages[stage].status='COMPLETE';p.stages[stage].gate={complete:true,blocked:false,reasons:[]};}
 reviewProofFixture({engine,prompts:globalThis.closedLoopPromptEngine,ingestion:globalThis.closedLoopResponseIngestion,schema},p);
 engine.registerArtifactBytes(p,{stage:10,artifactId:artifactFixtureId(engine,p,'ARTIFACT-STAGE17-CANDIDATE'),filename:'candidate.bin',mediaType:'application/octet-stream',byteSize:1,sha256:sha});const decision=engine.recordRegisteredHumanDecision(p,{stage:freezeStage,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:hash.sha256Value([artifactFixtureId(engine,p,'ARTIFACT-STAGE17-CANDIDATE')]),value:[artifactFixtureId(engine,p,'ARTIFACT-STAGE17-CANDIDATE')],operatorLabel:'STAGE17_VERIFIER'});const frozen=engine.freezeCandidate(p,{stage:freezeStage,artifactIds:[artifactFixtureId(engine,p,'ARTIFACT-STAGE17-CANDIDATE')],selectionDecisionId:engine.recordId(decision,'humanDecisions'),operatorLabel:'STAGE17_VERIFIER'});let selectedIteration=frozen.iteration;const candidateId=engine.recordId(frozen.candidate,'candidateFreezes');if(iterationStage===19){p.stages[18].status='COMPLETE';selectedIteration=engine.beginUnchangedConfirmationIteration(p,{candidateId,operatorLabel:'CONTROLLED_COMPARISON_FIXTURE'});}const iterationId=engine.recordId(selectedIteration,'iterations'),scope={...engine.scopeForIteration(p,iterationId),requirementsVersion:p.job.CURRENT_REQUIREMENTS_VERSION,testSuiteVersion:p.job.CURRENT_TEST_SUITE_VERSION,instructionVersion:p.job.CURRENT_INSTRUCTION_VERSION};
 const slots=engine.reserveRunBatch(p,{stage:runStage,iterationId,candidateId,count:10});
 for(let i=0;i<slots.length;i++){
   const run=engine.records(p,'runs').find(item=>engine.recordId(item,'runs')===slots[i].runId),generator=engine.records(p,'freshContexts').find(item=>engine.recordId(item,'freshContexts')===slots[i].contextId);generator.fields.EXTERNAL_CONTEXT_IDENTIFIER=generator.EXTERNAL_CONTEXT_IDENTIFIER=`generator-stage17-${i+1}`;generator.fields.CONTAMINATION_STATUS=generator.CONTAMINATION_STATUS='NONE';generator.fields.AUTHORIZED_PROJECT_INPUTS=generator.AUTHORIZED_PROJECT_INPUTS=['candidate'];run.fields.CONTAMINATION_CHECK=run.CONTAMINATION_CHECK='NONE';run.fields.EXECUTION_STATUS=run.EXECUTION_STATUS='COMPLETED';run.status='COMPLETED';
   const verifier=record('freshContexts',verificationStage,{EXTERNAL_CONTEXT_IDENTIFIER:`verifier-stage17-${i+1}`,ROLE:'Independent run verifier',ITERATION_ID:iterationId,RUN_ID:slots[i].runId,AUTHORIZED_PROJECT_INPUTS:['target run','target requirement','target test'],CONTAMINATION_STATUS:'NONE'},`CONTEXT-STAGE17-VERIFY-${i+1}`,{...scope,runId:slots[i].runId,contextId:`CONTEXT-STAGE17-VERIFY-${i+1}`});p.projectData.freshContexts.push(verifier);
   const evidence=record('evidenceRecords',verificationStage,{KIND:'REVIEW_NOTE',AUTHORITY_TYPE:'INDEPENDENT_REVIEWER',DESCRIPTION:'Independent verification observation',CONTENT:`Run ${i+1} satisfies the proposition.`,STATUS:'PRESERVED'},`EVIDENCE-STAGE17-${i+1}`,scope);p.projectData.evidenceRecords.push(evidence);
   const verification=record('verification',verificationStage,{REQ_ID:'REQ-STAGE17',RUN_ID:slots[i].runId,TEST_ID:'TEST-STAGE17',VERIFIER_CONTEXT_ID:verifier.id,OBSERVED_RESULT:'SATISFIED',EXPECTED_RESULT:'SATISFIED',DETERMINATION:'SATISFIED'},`VERIFY-STAGE17-${i+1}`,{...scope,runId:slots[i].runId});verification.evidenceRefs=[evidence.id];p.projectData.verification.push(verification);
 }
 const comparison=record('comparisons',comparisonStage,{REQ_ID:'REQ-STAGE17',RUN_DETERMINATIONS:'All ten current runs SATISFIED under the frozen expected-variance contract.',INTERPRETATION_VARIANCE:'NONE',OUTPUT_VARIANCE:'NONE',AUTHORIZED_VARIANCE:'TRUE',INCONCLUSIVE_TESTS:'NONE',REPEATED_FAILURE_PATTERNS:'NONE',UNIQUE_FAILURES:'NONE',CORRECTNESS_AFFECTING_VARIANCE:'FALSE',DEFECT_IDS:'NONE',EVIDENCE:'All ten current verification records and their preserved evidence were compared; no run or evidence was discarded.'},'COMPARISON-STAGE17',{...scope});p.projectData.comparisons.push(comparison);p.projectData.acceptedChanges.push({changeId:'CHANGE-STAGE17-COMPARE',stage:comparisonStage,status:'COMMITTED',responseType:'DATA_PROPOSAL',scope:{...scope}});
 for(let stage=1;stage<=12;stage++){p.stages[stage].status='COMPLETE';p.stages[stage].gate={complete:true,blocked:false,reasons:[]};}
 return {p,iterationId,comparisonStage,comparison:p.projectData.comparisons.find(r=>r.id===comparison.id),test:p.projectData.tests.find(r=>r.id===test.id)};
}

const base=fixture();let model=engine.evaluateCrossRunComparison(base.p);assert(model.reasons.length===0,`Positive Stage 13 model failed: ${model.reasons.join(' | ')}`);assert(model.runIds.length===10&&model.requiredTupleCount===10,'Stage 13 did not derive exactly ten required run tuples.');assert(model.facts['REQ-STAGE17'].ALL_TEN_SATISFIED===true&&model.facts['REQ-STAGE17'].SATISFIED_COUNT===10,'Application did not derive all-ten satisfaction.');assert(model.facts['REQ-STAGE17'].EXPECTED_VARIANCE_CONTRACT_SHA256.length===1,'Frozen expected-variance contract hash was not bound to the comparison model.');let gate=engine.gate(13,base.p);assert(gate.complete,`Positive Stage 13 gate failed: ${gate.reasons.join(' | ')}`);const storedBefore=hash.sha256Value(base.comparison);engine.evaluateCrossRunComparison(base.p);assert(hash.sha256Value(base.comparison)===storedBefore,'Comparison evaluation rewrote an accepted record.');let derived=engine.deriveStageData(base.p,13);assert(derived.REQUIREMENTS_SATISFIED_BY_ALL_TEN.length===1&&derived.PROHIBITED_OUTPUT_VARIANCES.length===0&&derived.REQUIRED_VERIFICATION_TUPLE_COUNT===10,'Stage 13 derived data does not represent the proven ten-run comparison.');const baseStability=engine.executionStability(base.p,base.iterationId),baseReqStability=baseStability.requirementStability['REQ-STAGE17'],baseTestStability=baseStability.testStability['TEST-STAGE17'];assert(baseStability.runCount===10,'Shared stability evaluator did not use exactly ten current runs.');assert(baseReqStability.satisfied===10&&baseReqStability.violated===0&&baseReqStability.undetermined===0&&baseReqStability.agreementRate===1,'Ten identical requirement determinations did not produce exact 1.0 agreement.');assert(baseTestStability.satisfied===10&&baseTestStability.violated===0&&baseTestStability.undetermined===0&&baseTestStability.agreementRate===1,'Ten identical test determinations did not produce exact 1.0 agreement.');assert(baseStability.requirementsWithCompleteAgreement===1&&baseStability.requirementsWithDisagreement===0&&baseStability.completeAgreementRequirementIds.includes('REQ-STAGE17'),'Closed stability universe did not identify the one complete-agreement requirement.');

{const {p}=fixture();p.projectData.verification.pop();const m=engine.evaluateCrossRunComparison(p);assert(m.reasons.some(reason=>reason.includes('found 0')),'Missing required run verification was not rejected.');}
{const {p}=fixture();const duplicate=JSON.parse(JSON.stringify(p.projectData.verification[0]));duplicate.id='VERIFY-STAGE17-DUPLICATE';duplicate.fields.VERIFICATION_ID=duplicate.VERIFICATION_ID='VERIFY-STAGE17-DUPLICATE';p.projectData.verification.push(duplicate);const m=engine.evaluateCrossRunComparison(p);assert(m.reasons.some(reason=>reason.includes('found 2')),'Duplicate required run verification was not rejected.');}
{const {p,test}=fixture();test.fields.EXPECTED_VARIANCE_CONTRACT=test.EXPECTED_VARIANCE_CONTRACT={};engine.refreshRecordHashes(test,'tests');const m=engine.evaluateCrossRunComparison(p);assert(m.reasons.some(reason=>reason.includes('EXPECTED_VARIANCE_CONTRACT')),'Missing frozen expected-variance contract was not rejected.');}
{const {p,comparison}=fixture();comparison.fields.AUTHORIZED_VARIANCE=comparison.AUTHORIZED_VARIANCE='UNKNOWN';engine.refreshRecordHashes(comparison,'comparisons');const g=engine.gate(13,p);assert(!g.complete&&g.blocked&&g.reasons.some(reason=>reason.includes('UNKNOWN variance authorization')),'UNKNOWN variance authorization did not block Stage 13.');}
{const {p,comparison}=fixture();comparison.fields.OUTPUT_VARIANCE=comparison.OUTPUT_VARIANCE='Correctness-affecting output divergence';comparison.fields.AUTHORIZED_VARIANCE=comparison.AUTHORIZED_VARIANCE='FALSE';comparison.fields.CORRECTNESS_AFFECTING_VARIANCE=comparison.CORRECTNESS_AFFECTING_VARIANCE='TRUE';comparison.fields.DEFECT_IDS=comparison.DEFECT_IDS='NONE';engine.refreshRecordHashes(comparison,'comparisons');let g=engine.gate(13,p);assert(!g.complete&&g.reasons.some(reason=>reason.includes('DEFECT_IDS handoff')),'Prohibited correctness-affecting variance without defect handoff was not rejected.');comparison.fields.DEFECT_IDS=comparison.DEFECT_IDS='STAGE14-DEFECT-HANDOFF-1';engine.refreshRecordHashes(comparison,'comparisons');g=engine.gate(13,p);assert(!g.complete&&g.reasons.some(reason=>reason.includes('does not resolve')),'A nonexistent defect marker authorized prohibited variance.');const defect=record('defects',13,{REQ_ID:'REQ-STAGE17',OBSERVED_FAILURE:'Correctness-affecting output divergence',EXPECTED_CONDITION:'No prohibited variance',EVIDENCE:'Current preserved comparison evidence',SEVERITY:'MAJOR',STATUS:'OPEN'},'STAGE14-DEFECT-HANDOFF-1',engine.scopeForIteration(p,engine.evaluateCrossRunComparison(p).iterationId));defect.evidenceRefs=[p.projectData.evidenceRecords.find(row=>row.id==='EVIDENCE-STAGE17-1').id];engine.refreshRecordHashes(defect,'defects');p.projectData.defects.push(defect);g=engine.gate(13,p);assert(g.complete,`Current evidence-linked defect did not close comparison handoff: ${g.reasons.join(' | ')}`);const d=engine.deriveStageData(p,13);assert(d.PROHIBITED_OUTPUT_VARIANCES.includes('COMPARISON-STAGE17')&&d.CORRECTNESS_AFFECTING_DISAGREEMENTS.includes('COMPARISON-STAGE17'),'Prohibited/correctness-affecting variance was not application-derived into Stage 13 data.');}
{const {p,iterationId}=fixture();const row=p.projectData.verification[0];row.fields.OBSERVED_RESULT=row.OBSERVED_RESULT='VIOLATED';row.fields.DETERMINATION=row.DETERMINATION='VIOLATED';engine.refreshRecordHashes(row,'verification');const g=engine.gate(13,p),m=engine.evaluateCrossRunComparison(p),stability=engine.executionStability(p,iterationId),req=stability.requirementStability['REQ-STAGE17'],test=stability.testStability['TEST-STAGE17'];assert(m.facts['REQ-STAGE17'].ANY_VIOLATION===true,'Application did not derive a violated run.');assert(!g.reasons.some(reason=>reason.includes('Derived comparison contains a violation')),'Legacy Stage 13 logic still blocks any violated run instead of routing it forward.');assert(req.satisfied===9&&req.violated===1&&req.undetermined===0&&req.agreementRate===0.9,'Nine-of-ten requirement agreement with one violation did not produce exact 0.9 agreement.');assert(test.satisfied===9&&test.violated===1&&test.undetermined===0&&test.agreementRate===0.9,'Nine-of-ten test agreement with one violation did not produce exact 0.9 agreement.');assert(stability.requirementsWithCompleteAgreement===0&&stability.requirementsWithDisagreement===1&&stability.disagreementRequirementIds.includes('REQ-STAGE17'),'Closed stability universe did not classify the one disagreement requirement.');}
{const {p,iterationId}=fixture();const row=p.projectData.verification[0];row.fields.OBSERVED_RESULT=row.OBSERVED_RESULT='UNDETERMINED';row.fields.DETERMINATION=row.DETERMINATION='UNDETERMINED';engine.refreshRecordHashes(row,'verification');const g=engine.gate(13,p),stability=engine.executionStability(p,iterationId),req=stability.requirementStability['REQ-STAGE17'],test=stability.testStability['TEST-STAGE17'];assert(!g.complete&&g.blocked&&g.reasons.some(reason=>reason.includes('application-derived UNDETERMINED')),'UNDETERMINED run truth did not fail closed at Stage 13.');assert(req.satisfied===9&&req.violated===0&&req.undetermined===1&&req.agreementRate===0.9,'Nine-of-ten requirement agreement with one undetermined result did not produce exact 0.9 agreement.');assert(test.satisfied===9&&test.violated===0&&test.undetermined===1&&test.agreementRate===0.9,'Nine-of-ten test agreement with one undetermined result did not produce exact 0.9 agreement.');assert(stability.requirementsWithCompleteAgreement===0&&stability.requirementsWithDisagreement===1,'Undetermined run did not enter the closed disagreement universe.');}

console.log(JSON.stringify({controllerStage:'17',applicationStage:'13',crossRunComparison:'PASS',requiredRunCount:10,requiredTupleCount:10,expectedVarianceContractBound:true,applicationOwnedAggregateFacts:true,stabilityArithmetic:{tenOfTen:1,nineOfTen:0.9,violationCountExact:true,undeterminedCountExact:true,closedAgreementUniverse:true},prohibitedVarianceDefectHandoffEnforced:true,unknownVarianceBlocked:true,undeterminedTruthBlocked:true,violatedTruthRoutedForward:true,noRunOrEvidenceDiscarded:true,isolatedDisposableProject:true,closureVersion:engine.__stage13CrossRunClosureVersion}));


// These fixtures use the production freeze/reservation builders for each
// iteration class. They prove comparison policy, not a seeded complete journey.
const iterationPolicyCases=[];
for(const iterationStage of [10,17,19]){
 const f=fixture({iterationStage}),before=hash.sha256Value(f.p);
 const valid=engine.evaluateCrossRunComparison(f.p,f.iterationId);
 assert(valid.complete&&valid.clean,'ITERATION_COMPARISON_VALID_ORACLE: '+iterationStage+' '+valid.reasons.join(' | '));
 assert(hash.sha256Value(f.p)===before,'COMPARISON_PURE_READ_ORACLE: comparison changed accepted source records.');
 const row=engine.recordsForIteration(f.p,'comparisons',f.iterationId)[0];
 row.fields.ALL_TEN_SATISFIED=row.ALL_TEN_SATISFIED=false;
 assert(engine.evaluateCrossRunComparison(f.p,f.iterationId).facts['REQ-STAGE17'].ALL_TEN_SATISFIED,'COMPARISON_NATIVE_FACT_ORACLE: caller-declared aggregate replaced actual verification.');
 row.fields.AUTHORIZED_VARIANCE=row.AUTHORIZED_VARIANCE='UNKNOWN';
 const changed=engine.evaluateCrossRunComparison(f.p,f.iterationId);
 assert(!changed.complete&&changed.reasons.some(reason=>reason.includes('UNKNOWN variance authorization')),'ITERATION_COMPARISON_UNKNOWN_ORACLE: '+iterationStage);
 row.fields.AUTHORIZED_VARIANCE=row.AUTHORIZED_VARIANCE='TRUE';
 assert(engine.evaluateCrossRunComparison(f.p,f.iterationId).clean,'COMPARISON_RETRY_ORACLE: corrected content did not receive fresh evaluation.');
 const missing=fixture({iterationStage,varianceContract:{}}),badContract=engine.evaluateCrossRunComparison(missing.p,missing.iterationId);
 assert(!badContract.complete&&badContract.reasons.some(reason=>reason.includes('EXPECTED_VARIANCE_CONTRACT')),'COMPARISON_FROZEN_CONTRACT_ORACLE: omitted contract before review and freeze passed at '+iterationStage);
 const independent=engine.clone(f.p),oldIteration=engine.records(independent,'iterations').find(item=>engine.recordId(item,'iterations')===f.iterationId);
 // A foreign initial-iteration record must not replace the explicitly selected
 // corrected/confirmation universe, even when it is the latest Stage 10 entry.
 if(iterationStage!==10){const decoy=engine.clone(oldIteration);decoy.id='FOREIGN-INITIAL-ITERATION';decoy.fields.ITERATION_ID=decoy.ITERATION_ID=decoy.id;decoy.stage=10;decoy.scope={...decoy.scope,iterationId:decoy.id};independent.projectData.iterations.push(decoy);const selected=engine.evaluateCrossRunComparison(independent,f.iterationId);assert(selected.iterationId===f.iterationId&&selected.complete,'COMPARISON_SELECTED_ITERATION_ORACLE: another frozen iteration supplied or replaced selected evidence.');}
 iterationPolicyCases.push({iterationStage,comparisonStage:f.comparisonStage,currentValid:true,unknownBlocked:true,missingContractBeforeFreezeBlocked:true,retryFresh:true,acceptedRecordsUnchanged:true});
}
console.log(JSON.stringify({caseId:'COMPARISON-ITERATION-POLICY',result:'PASS',synthetic:true,actualBrowser:false,cases:iterationPolicyCases}));

// Scope-level acceptance must replace only the same logical observation while
// retaining accepted independent cells. Exercise real response preparation and
// commit, not an assignment that bypasses the transaction boundary.
const ingestion=globalThis.closedLoopResponseIngestion,prompts=globalThis.closedLoopPromptEngine;
function prepareObservation(project,{stage,operation,collection,rows,label,scope={},expectValid=true,additionalRecords={}}){
 const context=engine.preparePromptContext(project,stage,{operation,scope}),prompt=prompts.buildPromptRecord(stage,project,context.options);project.projectData.generatedPrompts.push(prompt);
 const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:project.job.JOB_ID,stage,operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{[collection]:rows,...additionalRecords},evidence:[evidence(label)],unresolved:[],warnings:[],attachments:[]};
 const prepared=ingestion.prepare(project,{stage,text:JSON.stringify(envelope),promptRecord:prompt});
 if(expectValid)assert(prepared.validation.valid,'ACCEPTANCE_FIXTURE_VALID_ORACLE: '+JSON.stringify(prepared.validation.issues));return prepared;
}
function comparisonProposal(label,authorized='TRUE'){
 return recordProposal(schema,'comparisons',{tempKey:label,relationships:{REQ_ID:{recordId:'REQ-STAGE17'}},overrides:{RUN_DETERMINATIONS:'All ten current runs SATISFIED.',INTERPRETATION_VARIANCE:'NONE',OUTPUT_VARIANCE:'NONE',AUTHORIZED_VARIANCE:authorized,INCONCLUSIVE_TESTS:'NONE',REPEATED_FAILURE_PATTERNS:'NONE',UNIQUE_FAILURES:'NONE',CORRECTNESS_AFFECTING_VARIANCE:'FALSE',EVIDENCE:'All ten preserved current verification observations: '+label}});
}
for(const iterationStage of [10,17,19]){
 const f=fixture({additionalTest:true,iterationStage}),stage=iterationStage===10?12:iterationStage;let p=f.p;
 for(let number=1;number<stage;number++){p.stages[number].status='COMPLETE';p.stages[number].gate={complete:true,blocked:false,reasons:[]};}
 const upstreamStages=Object.fromEntries(Object.entries(engine.clone(p.stages)).filter(([number])=>Number(number)<stage));
 const runId=engine.recordValue(p.projectData.verification[0],'RUN_ID');
 p.projectData.verification=p.projectData.verification.filter(row=>engine.recordValue(row,'RUN_ID')!==runId);p.projectData.comparisons=[];
 p.projectData.acceptedChanges=p.projectData.acceptedChanges.filter(change=>change.changeId!=='CHANGE-STAGE17-COMPARE');
 const makeRow=(testId,label,targetRunId=runId)=>recordProposal(schema,'verification',{tempKey:label,relationships:{REQ_ID:{recordId:'REQ-STAGE17'},RUN_ID:{recordId:targetRunId},TEST_ID:{recordId:testId}},overrides:{OBSERVED_RESULT:'SATISFIED',EXPECTED_RESULT:'SATISFIED',DETERMINATION:'SATISFIED',EXACT_EVIDENCE:'Preserved independently reviewed observation '+label}});
 const sharedVerifierContextId=engine.preparePromptContext(p,stage,{operation:'VERIFY',scope:{runId}}).options.scope.contextId;
 const first=prepareObservation(p,{stage,operation:'VERIFY',collection:'verification',rows:[makeRow('TEST-STAGE17','independent-first')],label:'independent-first',scope:{runId,contextId:sharedVerifierContextId}});
 let result=ingestion.commit(first.project,first.proposal.proposalId,{operator:'CONTROLLED_COMPARISON_FIXTURE',replacementConfirmation:ingestion.acceptanceImpact(first.project,first.proposal.proposalId)});p=result.project;
 const originalChange=result.acceptedChange.changeId,originalRaw=result.acceptedChange.rawResponseId;Object.assign(p.stages,engine.clone(upstreamStages));
 const second=prepareObservation(p,{stage,operation:'VERIFY',collection:'verification',rows:[makeRow('TEST-STAGE17-SECOND','independent-second')],label:'independent-second',scope:{runId,contextId:sharedVerifierContextId}}),impact=ingestion.acceptanceImpact(second.project,second.proposal.proposalId);
 assert(!impact.replaces.some(item=>item.id===originalChange),'VERIFICATION_PARTIAL_BATCH_IMPACT_ORACLE: a disjoint same-run test batch must not replace the earlier accepted batch.');
 result=ingestion.commit(second.project,second.proposal.proposalId,{operator:'CONTROLLED_COMPARISON_FIXTURE',replacementConfirmation:impact});p=result.project;
 assert(engine.acceptedChanges(p,stage).some(change=>change.changeId===originalChange),'VERIFICATION_PARTIAL_BATCH_HISTORY_ORACLE: disjoint batch invalidated an earlier accepted response.');
 const rows=engine.recordsForIteration(p,'verification',f.iterationId).filter(row=>engine.recordValue(row,'RUN_ID')===runId);
 assert(rows.length===2&&new Set(rows.map(row=>engine.recordValue(row,'TEST_ID'))).size===2,'VERIFICATION_PARTIAL_BATCH_RECORDS_ORACLE: independent cells were not both current.');
 const independentChange=result.acceptedChange.changeId,independentRecord=rows.find(row=>engine.recordValue(row,'TEST_ID')==='TEST-STAGE17-SECOND');
 // A composite stage can already contain comparison work. Correcting a
 // verification must invalidate that dependent operation inside the same stage.
 if(stage===f.comparisonStage){Object.assign(p.stages,engine.clone(upstreamStages));const compared=prepareObservation(p,{stage,operation:'COMPARE',collection:'comparisons',rows:[comparisonProposal('partial-batch-comparison')],label:'partial-batch-comparison'});p=ingestion.commit(compared.project,compared.proposal.proposalId,{operator:'CONTROLLED_COMPARISON_FIXTURE',replacementConfirmation:ingestion.acceptanceImpact(compared.project,compared.proposal.proposalId)}).project;}
 const independentAcceptance=engine.acceptedChanges(p,stage).find(change=>change.changeId===independentChange);
 const independentTrace=project=>({change:project.projectData.acceptedChanges.find(row=>row.changeId===independentChange),proposal:project.projectData.responseProposals.find(row=>row.proposalId===independentAcceptance.proposalId),prompt:project.projectData.generatedPrompts.find(row=>(row.instructionId||row.promptId)===independentAcceptance.promptId)}),preservedTrace=independentTrace(p);
 assert(preservedTrace.change&&preservedTrace.proposal&&preservedTrace.prompt,'VERIFICATION_PROVENANCE_FIXTURE_ORACLE: independent acceptance provenance must actually exist.');const traceBefore=hash.sha256Value(preservedTrace);
 const refined=engine.clone(p);engine.invalidateAcceptedResponse(refined,{stage,rawResponseId:originalRaw,reason:'Correct only the first independent observation.',operatorLabel:'CONTROLLED_COMPARISON_FIXTURE'});
 assert(engine.acceptedChanges(refined,stage).some(change=>change.changeId===independentChange)&&engine.recordsForIteration(refined,'verification',f.iterationId).some(row=>row.id===independentRecord.id),'VERIFICATION_SCOPED_REFINEMENT_ORACLE: correcting the selected response invalidated an independent accepted batch.');
 assert(hash.sha256Value(independentTrace(refined))===traceBefore,'VERIFICATION_INDEPENDENT_PROVENANCE_ORACLE: correcting one batch invalidated the independent accepted change, proposal, or prompt.');
 if(stage===f.comparisonStage)assert(engine.recordsForIteration(refined,'comparisons',f.iterationId).length===0&&!engine.acceptedChanges(refined,stage).some(change=>change.operation==='COMPARE'&&change.scope?.iterationId===f.iterationId),'VERIFICATION_SAME_STAGE_DEPENDENCY_ORACLE: correction left a comparison current after its verification input was withdrawn.');
 if(stage===f.comparisonStage){
  // An independent missing tuple adds records but invalidates its already
  // authored dependent comparison. The actual UI must describe that impact.
  Object.assign(p.stages,engine.clone(upstreamStages));
  const anotherRunId=engine.records(p,'runs').map(row=>engine.recordId(row,'runs')).find(id=>id!==runId);
  const additional=prepareObservation(p,{stage,operation:'VERIFY',collection:'verification',rows:[makeRow('TEST-STAGE17-SECOND','independent-additional',anotherRunId)],label:'independent-additional',scope:{runId:anotherRunId}}),additionalImpact=ingestion.acceptanceImpact(additional.project,additional.proposal.proposalId);
  assert(additionalImpact.replaces.length===0&&additionalImpact.requiresConfirmation&&additionalImpact.affected.some(item=>item.stage===stage),'ADDITIONAL_BATCH_IMPACT_ORACLE: independent addition must preserve accepted records and identify dependent comparison work.');
  const candidate=ingestion.commit(additional.project,additional.proposal.proposalId,{operator:'CONTROLLED_COMPARISON_FIXTURE',replacementConfirmation:additionalImpact}),source=comparisonModuleSource('app-core.js'),start=source.indexOf('function replacementConfirmationMarkup('),end=source.indexOf('\nfunction proposalMarkup(',start);
  assert(start>=0&&end>start,'ACTUAL_CONFIRMATION_OWNER_ORACLE: production markup owner was not found.');
  const ui=createVerifierRuntime({current:additional.project,replacementReview:{impact:additionalImpact,next:candidate.project,acceptance:{stage}},core,engine,esc:value=>String(value),stageDisplayTitle:value=>value.title||''});
  createVerifierRuntime.loadScript(ui,source.slice(start,end),{filename:'app-core.js:replacementConfirmationMarkup'});const markup=ui.replacementConfirmationMarkup(stage),introduction=markup.match(/<h3>[^<]*<\/h3><p>([^<]*)<\/p>/)?.[1]||'';
  assert(introduction&&!/will replace|replaces the accepted/i.test(introduction),'ADDITIONAL_BATCH_CONFIRMATION_ORACLE: the UI falsely describes an independent addition as replacing accepted work.');
  assert(markup.includes('Stage '+String(stage).padStart(2,'0')+':'),'SAME_STAGE_CONFIRMATION_ORACLE: the UI hides dependent work in the current composite stage.');
  console.log(JSON.stringify({caseId:'ADDITIONAL-BATCH-CONFIRMATION',iterationStage,stage,result:'PASS',synthetic:true,actualBrowser:false,introduction}));
 }
 console.log(JSON.stringify({caseId:'VERIFICATION-INDEPENDENT-PARTIAL-BATCHES',iterationStage,stage,result:'PASS',synthetic:true,actualBrowser:false}));
}
for(const iterationStage of [10,17,19]){
 const f=fixture({iterationStage}),stage=f.comparisonStage;let p=f.p;
 for(let number=1;number<stage;number++){p.stages[number].status='COMPLETE';p.stages[number].gate={complete:true,blocked:false,reasons:[]};}
 const upstreamStages=Object.fromEntries(Object.entries(engine.clone(p.stages)).filter(([number])=>Number(number)<stage));
 p.projectData.comparisons=[];p.projectData.acceptedChanges=p.projectData.acceptedChanges.filter(change=>change.changeId!=='CHANGE-STAGE17-COMPARE');
 const first=prepareObservation(p,{stage,operation:'COMPARE',collection:'comparisons',rows:[comparisonProposal('original-unknown','UNKNOWN')],label:'original-unknown'});
 let result=ingestion.commit(first.project,first.proposal.proposalId,{operator:'CONTROLLED_COMPARISON_FIXTURE',replacementConfirmation:ingestion.acceptanceImpact(first.project,first.proposal.proposalId)});p=result.project;
 const originalId=result.acceptedChange.canonicalRecordIds.find(id=>engine.records(p,'comparisons').some(row=>row.id===id));
 assert(!engine.evaluateCrossRunComparison(p,f.iterationId).complete,'COMPARISON_ACCEPTED_UNKNOWN_ORACLE: accepted UNKNOWN comparison unexpectedly passed.');
 // Restore only this focused fixture's declared upstream prerequisites after
 // recalculation; accepted observations and the stage under test are untouched.
 Object.assign(p.stages,engine.clone(upstreamStages));
 const second=prepareObservation(p,{stage,operation:'COMPARE',collection:'comparisons',rows:[comparisonProposal('corrected-known')],label:'corrected-known'}),impact=ingestion.acceptanceImpact(second.project,second.proposal.proposalId),before=hash.sha256Value(second.project);
 assert(impact.requiresConfirmation,'COMPARISON_REPLACEMENT_CONFIRMATION_ORACLE: replacement was not confirmed.');
 let blocked=false;try{ingestion.commit(second.project,second.proposal.proposalId,{operator:'CONTROLLED_COMPARISON_FIXTURE'});}catch(error){blocked=/CONFIRMATION/.test(error.code||'');}
 assert(blocked&&hash.sha256Value(second.project)===before,'COMPARISON_UNCONFIRMED_ORACLE: unanswered replacement changed accepted work.');
 result=ingestion.commit(second.project,second.proposal.proposalId,{operator:'CONTROLLED_COMPARISON_FIXTURE',replacementConfirmation:impact});p=result.project;
 const current=engine.recordsForIteration(p,'comparisons',f.iterationId),facts=engine.evaluateCrossRunComparison(p,f.iterationId);
 assert(current.length===1&&current[0].id!==originalId&&facts.complete&&facts.clean,'COMPARISON_REPLACEMENT_CURRENT_ORACLE: confirmed correction must leave one usable current comparison; '+JSON.stringify({count:current.length,reasons:facts.reasons}));
 assert(p.projectData.comparisons.some(row=>row.id===originalId&&!engine.isActiveRecord(row)),'COMPARISON_REPLACEMENT_HISTORY_ORACLE: previous comparison was not retained as superseded history.');
 console.log(JSON.stringify({caseId:'COMPARISON-REPLACEMENT-ACCEPTANCE',iterationStage,stage,result:'PASS',synthetic:true,actualBrowser:false}));
}

{
 const f=fixture();f.p.projectData.comparisons=[];f.p.projectData.acceptedChanges=f.p.projectData.acceptedChanges.filter(change=>change.changeId!=='CHANGE-STAGE17-COMPARE');
 const duplicate=prepareObservation(f.p,{stage:f.comparisonStage,operation:'COMPARE',collection:'comparisons',rows:[comparisonProposal('duplicate-one'),comparisonProposal('duplicate-two')],label:'duplicate-targets',expectValid:false});
 assert(!duplicate.validation.valid&&duplicate.validation.issues.some(issue=>issue.code==='DUPLICATE_SCOPED_OBSERVATION'),'SCOPED_BATCH_DUPLICATE_ORACLE: two proposed current observations for the same target must be rejected before acceptance.');
 const valid=prepareObservation(f.p,{stage:f.comparisonStage,operation:'COMPARE',collection:'comparisons',rows:[comparisonProposal('single-target')],label:'single-target'});
 assert(valid.validation.valid,'SCOPED_BATCH_SINGLE_CONTROL_ORACLE: removing the duplicate must restore valid intake.');
 console.log(JSON.stringify({caseId:'SCOPED-BATCH-DUPLICATE',result:'PASS',synthetic:true,actualBrowser:false}));
}

// A newly reported defect has no canonical ID before response allocation.
// Its exact atomic acceptance is the relationship authority, not a guessed ID.
for(const iterationStage of [10,17,19]){
 const f=fixture({iterationStage}),stage=f.comparisonStage;let p=f.p;
 for(let number=1;number<stage;number++){p.stages[number].status='COMPLETE';p.stages[number].gate={complete:true,blocked:false,reasons:[]};}
 p.projectData.comparisons=[];p.projectData.acceptedChanges=p.projectData.acceptedChanges.filter(change=>change.changeId!=='CHANGE-STAGE17-COMPARE');
 const compare=comparisonProposal('atomic-failure-handoff');Object.assign(compare.fields,{OUTPUT_VARIANCE:'A recorded output omitted a required byte.',AUTHORIZED_VARIANCE:'FALSE',CORRECTNESS_AFFECTING_VARIANCE:'TRUE',DEFECT_IDS:'NONE'});
 const defect=recordProposal(schema,'defects',{tempKey:'new-output-defect',overrides:{OBSERVED_FAILURE:'A recorded output omitted a required byte.',EXPECTED_CONDITION:'The exact required bytes are preserved.',EVIDENCE:'Preserved current run and its verification.',SEVERITY:'MAJOR'},relationships:{REQ_ID:{recordId:'REQ-STAGE17'},RUN_ID:{recordId:engine.recordId(engine.recordsForIteration(p,'runs',f.iterationId)[0],'runs')}}});
 const prepared=prepareObservation(p,{stage,operation:'COMPARE',collection:'comparisons',rows:[compare],additionalRecords:{defects:[defect]},label:'atomic-defect-handoff',expectValid:false});
 assert(prepared.validation.valid,'COMPARISON_ATOMIC_DEFECT_CONTRACT_ORACLE: '+stage+' '+JSON.stringify(prepared.validation.issues));
 const accepted=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'CONTROLLED_COMPARISON_FIXTURE',replacementConfirmation:ingestion.acceptanceImpact(prepared.project,prepared.proposal.proposalId)});p=accepted.project;
 const current=engine.recordsForIteration(p,'comparisons',f.iterationId)[0],created=engine.recordsForIteration(p,'defects',f.iterationId)[0],before=hash.sha256Value(p),evaluated=engine.evaluateCrossRunComparison(p,f.iterationId);
 assert(evaluated.complete&&!evaluated.clean,'COMPARISON_ATOMIC_DEFECT_HANDOFF_ORACLE: a comparison and evidence-backed same-requirement defect committed together must close analysis, not establish correctness; '+JSON.stringify(evaluated.reasons));
 assert(hash.sha256Value(p)===before&&engine.recordValue(current,'DEFECT_IDS')==='NONE','COMPARISON_ATOMIC_HANDOFF_READ_ORACLE: evaluation must preserve accepted authored fields.');
 const acceptanceId=accepted.acceptedChange.changeId,canonicalId=engine.recordId(created,'defects');
 for(const invalidation of ['acceptance-membership','wrong-requirement','missing-evidence','foreign-provenance']){
  const invalid=engine.clone(p),bad=invalid.projectData.defects.find(row=>engine.recordId(row,'defects')===canonicalId),receipt=invalid.projectData.acceptedChanges.find(row=>row.changeId===acceptanceId);
  if(invalidation==='acceptance-membership')receipt.canonicalRecordIds=receipt.canonicalRecordIds.filter(id=>id!==canonicalId);
  if(invalidation==='wrong-requirement')bad.fields.REQ_ID=bad.REQ_ID=bad.relationships.REQ_ID='UNRELATED-REQUIREMENT';
  if(invalidation==='missing-evidence')bad.evidenceRefs=[];
  if(invalidation==='foreign-provenance')bad.sourceProposalId='OTHER-ACCEPTANCE';
  engine.refreshRecordHashes(bad,'defects');
  const rejected=engine.evaluateCrossRunComparison(invalid,f.iterationId);
  assert(!rejected.complete,'COMPARISON_ATOMIC_HANDOFF_BINDING_ORACLE: '+invalidation+' supplied a false defect handoff at '+stage);
 }
 console.log(JSON.stringify({caseId:'COMPARISON-ATOMIC-DEFECT-HANDOFF',iterationStage,stage,result:'PASS',synthetic:true,actualBrowser:false,acceptedDefectId:canonicalId,notClean:true,authoredFieldsPreserved:true}));
}

if(!selectedComparisonFault&&!process.argv.includes('--comparison-control')){
 const rawRuns=[],faultResults=[],started=Date.now(),suiteBoundMs=180000;
 const execute=args=>{
  const remaining=suiteBoundMs-(Date.now()-started);
  assert(remaining>0,'COMPARISON_FAULT_SUITE_DEADLINE_ORACLE: fault matrix exceeded its hard bound.');
  const child=spawnSync(process.execPath,['verify-cross-run-comparison.mjs',...args],{encoding:'utf8',timeout:Math.min(15000,remaining),maxBuffer:16*1024*1024,killSignal:'SIGKILL'});
  const run={command:[process.execPath,'verify-cross-run-comparison.mjs',...args],exitCode:child.status,signal:child.signal,error:child.error?String(child.error):null,stdout:child.stdout||'',stderr:child.stderr||''};rawRuns.push(run);
  assert(!run.error&&!run.signal,'COMPARISON_FAULT_EXECUTION_ORACLE: a timeout or execution failure is not fault detection.');return run;
 };
 try{
  for(const fault of comparisonFaults){
   const run=execute(['--comparison-fault='+fault.id]);
   assert(run.exitCode===1&&run.stderr.includes(fault.oracle),'COMPARISON_FAULT_DETECTION_ORACLE: '+fault.id+' did not fail at its intended invariant.');
   faultResults.push({faultId:fault.id,owner:'production',file:fault.file,originalSha256:comparisonSourceHashes[fault.file],injectedSha256:comparisonDigest(fs.readFileSync(fault.file,'utf8').replace(fault.from,fault.to)),caughtBy:fault.oracle,result:'PASS'});
  }
  const restored=execute(['--comparison-control']);assert(restored.exitCode===0,'COMPARISON_RESTORED_CONTROL_ORACLE: unchanged implementation did not return to green.');
  for(const [file,digest] of Object.entries(comparisonSourceHashes))assert(comparisonDigest(fs.readFileSync(file,'utf8'))===digest,'COMPARISON_SOURCE_RESTORED_ORACLE: retained source changed during fault injection.');
  console.log(JSON.stringify({caseId:'COMPARISON-IMPLEMENTATION-FAULTS',result:'PASS',synthetic:true,actualBrowser:false,childBoundSeconds:15,suiteBoundSeconds:180,faults:faultResults,rawRuns,sourceRestored:true}));
 }catch(error){console.log(JSON.stringify({caseId:'COMPARISON-IMPLEMENTATION-FAULTS',result:'FAIL',faults:faultResults,rawRuns,failure:String(error.stack||error)}));throw error;}
}

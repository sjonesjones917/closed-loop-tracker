import {
  assert,clone,hash,schema,engine,ingestion,
  LifecycleHarness,evidence,sourceRecord,researchRecord,requirementRecord,testRecord,failureTestRecord,
  instructionRecord,instructionTraceRecord,preflightRecord,runCompletion,verificationRecord,comparisonRecord,
  defectRecord,rootCauseRecord,regressionRecord,regressionExecutionRecord,changeRecord,
  deterministicResultRecord,meaningResultRecord,adversarialResultRecord,representationRecord,
  processAuditRecord,productAuditRecord,releaseGateReviewRecord,confirmationRecord
} from './test-fixtures.mjs';

const h=new LifecycleHarness();
const stageReport=[];
const mark=stage=>{h.reload();h.stageComplete(stage);stageReport.push({stage,status:h.project.stages[stage].status,accepted:h.project.stages[stage].acceptedDataChangeIds.length,controlEvents:h.project.stages[stage].acceptedControlEventIds.length,gateReasons:h.project.stages[stage].gate.reasons});};
const recordId=collection=>h.recordId(collection);
const active=collection=>engine.records(h.project,collection);

const stage1QuestionPrompt=h.savePrompt(1);
const question=h.acceptControl(1,{
  responseType:'HUMAN_INPUT_REQUIRED',
  stageData:{},records:{},
  humanInputRequests:[{
    temporaryKey:'question-1',question:'What exact filename must be used for the final delivery artifact?',
    whyRequired:'The delivery identity cannot be frozen without the human-selected filename.',
    affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true
  }],
  evidenceRecords:[evidence('question-evidence','Human-only delivery naming decision','The filename is not derivable from external authority.')]
},{prompt:stage1QuestionPrompt});
assert(question.disposition?.type==='ACCEPTED_HUMAN_QUESTION_SET','Stage 01 clarification was not accepted as a question set.');
assert(h.project.stages[1].status==='BLOCKED','Stage 01 did not block on the open human question.');
const request=h.project.projectData.humanInputRequests.at(-1);
const answered=ingestion.answerHumanInput(h.project,{[request.requestId]:'verified-delivery.txt'},{operator:h.operator});
h.project=answered.project;
assert(h.project.job.CURRENT_INPUT_VERSION==='INPUT-v003','Clarification did not create the next User Job Input version.');
const regeneratedPrompt=h.project.projectData.generatedPrompts.filter(item=>Number(item.stage)===1&&!item.invalidatedBy).at(-1);
assert(regeneratedPrompt?.prompt.includes('verified-delivery.txt'),'The exact answered clarification is absent from the regenerated Stage 01 prompt.');
const staleEnvelope=h.envelope(1,stage1QuestionPrompt,{stageData:{EXACT_DELIVERABLE_REQUESTED:'verified-delivery.txt'},records:{},evidenceRecords:[evidence('stale-evidence')]});
const stalePrepared=ingestion.prepare(h.project,{stage:1,text:JSON.stringify(staleEnvelope),promptRecord:stage1QuestionPrompt});
h.project=stalePrepared.project;
assert(stalePrepared.validation.valid===false&&stalePrepared.validation.issues.some(item=>['STALE_PROMPT_IDENTITY','STALE_SCOPE'].includes(item.code)),'The pre-clarification Stage 01 response was not rejected as stale.');
const stage1=h.accept(1,{stageData:{EXACT_DELIVERABLE_REQUESTED:'verified-delivery.txt',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:'Current versioned User Job Input and supplied material inventory.'},records:{},evidenceRecords:[evidence('stage1-evidence','Normalized objective evidence','The final filename and deliverable are bound to the human answer.')]},{prompt:regeneratedPrompt});
engine.recordStageConfirmation(h.project,1,true,'The represented objective and delivery artifact match the human intent.',h.operator,{acceptedChangeId:stage1.acceptedChange.changeId,inputVersion:h.project.job.CURRENT_INPUT_VERSION,instructionId:regeneratedPrompt.instructionId,contextSignature:regeneratedPrompt.contextSignature,operatorLabel:h.operator});
mark(1);

const stage2Prompt=h.savePrompt(2);
const rejected=h.reject(2,{stageData:{AUTHORITY_HIERARCHY:'W3C recommendation controls the synthetic accessibility obligation.',KNOWN_CONTROLLING_SOURCES_EXAMINED:'WCAG 2.2'},records:{sources:[sourceRecord()]},evidenceRecords:[evidence('evidence-1','Draft source evidence','Controlled draft source proposal.')]},{prompt:stage2Prompt,reason:'The operator rejected the first valid proposal to prove correction handling.',requestCorrection:true});
assert(rejected.rejected.status==='CORRECTION_REQUESTED','Valid rejected proposal did not create a correction-request disposition.');
assert(active('sources').length===0,'Rejected Stage 02 proposal mutated canonical sources.');
h.accept(2,{stageData:{AUTHORITY_HIERARCHY:'W3C recommendation controls the synthetic accessibility obligation.',KNOWN_CONTROLLING_SOURCES_EXAMINED:'WCAG 2.2'},records:{sources:[sourceRecord()]},evidenceRecords:[evidence('evidence-1','Corrected source evidence','The W3C recommendation was independently inspected.')]},{prompt:stage2Prompt});
mark(2);
const sourceId=recordId('sources');

h.accept(3,{stageData:{EXCEPTIONS_AND_EDGE_CONDITIONS:'Large-text exceptions were examined and are not used.',CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE',RESEARCH_GAPS_AND_BLOCKERS:'NONE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',LATEST_PASS_NUMBER:'2',NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE'},records:{research:[researchRecord(sourceId)]},evidenceRecords:[evidence()]});
mark(3);
h.accept(4,{stageData:{DEFINED_TERM_GAPS:'NONE',CONDITIONAL_REQUIREMENTS:'NONE',OPTIONAL_REQUIREMENTS:'NONE',BLOCKED_REQUIREMENTS:'NONE'},records:{requirements:[requirementRecord(sourceId)]},evidenceRecords:[evidence()]});
mark(4);
const requirementId=recordId('requirements');
assert(engine.recordValue(active('requirements')[0],'STATUS')==='ACTIVE','Application lifecycle default STATUS=ACTIVE was not assigned to the accepted requirement.');
h.accept(5,{stageData:{DUPLICATES_REMAINING:'NONE',IMPOSSIBLE_COMBINATIONS:'NONE',UNDEFINED_TERMS:'NONE',CIRCULAR_DEPENDENCIES:'NONE',UNSUPPORTED_REQUIREMENTS:'NONE',APPLICABILITY_UNDETERMINED:'NONE',REQUIREMENTS_WITHOUT_VERIFICATION_PATH:'NONE'},records:{},evidenceRecords:[evidence()]});
mark(5);
h.accept(6,{stageData:{BLOCKED_MANDATORY_REQUIREMENTS:'NONE'},records:{tests:[testRecord(requirementId)]},evidenceRecords:[evidence()]});
mark(6);
const testId=recordId('tests');
assert(engine.recordValue(active('tests')[0],'STATUS')==='READY','Application lifecycle default STATUS=READY was not assigned to the accepted test.');
h.accept(7,{stageData:{},records:{failureTests:[failureTestRecord(requirementId)]},evidenceRecords:[evidence()]});
mark(7);
h.accept(8,{stageData:{OBJECTIVE:'Create the controlled artifact and establish the mandatory requirement.',AUTHORIZED_INPUTS:'Current canonical input, source, requirement, test, and artifact identities.',INPUT_FAILURE_RULES:'Fail closed on unavailable input.',SOURCE_AUTHORITY:'Current accepted W3C source.',SCOPE:'One plain-text artifact.',DEFINED_TERMS:'Use current canonical definitions.',REQUIRED_PROCEDURE_IN_ORDER:'Create, test, preserve evidence, report.',DECISION_RULES:'Any mandatory unknown or violation blocks.',TOOL_RULES:'Use authorized versioned tools.',OUTPUT_CONTRACT:'Exact artifact bytes plus structured evidence.',VERIFICATION_AND_FAILURE_HANDLING:'Preserve evidence and reject failures.',COMPLETION_CRITERIA:'Every mandatory requirement is satisfied.'},records:{instructions:[instructionRecord()],instructionTraces:[instructionTraceRecord(requirementId)]},evidenceRecords:[evidence()]});
mark(8);
const instructionId=recordId('instructions');
h.accept(9,{stageData:{REVIEW_CONTEXT_INDEPENDENT_FROM_AUTHOR:'TRUE',EVERY_SENTENCE_REVIEWED:'TRUE',KNOWN_MATERIAL_AMBIGUITIES:'NONE',KNOWN_MATERIAL_CONFLICTS:'NONE',UNAVAILABLE_REQUIRED_CAPABILITIES:'NONE',UNVERIFIABLE_INSTRUCTIONS:'NONE'},records:{preflightRecords:[preflightRecord(instructionId)]},evidenceRecords:[evidence()]});
mark(9);

const candidateBytes=new TextEncoder().encode('verified delivery\nforeground=#000000\nbackground=#FFFFFF\n');
const candidateSha=await hash.sha256Bytes(candidateBytes);
engine.registerArtifactBytes(h.project,{stage:10,artifactId:'ARTIFACT-CANDIDATE-000001',filename:'verified-delivery.txt',mediaType:'text/plain',byteSize:candidateBytes.byteLength,sha256:candidateSha,lineage:{fixture:'verify-full-cycle'},role:'CANDIDATE_COMPONENT'});
const frozen10=engine.freezeCandidate(h.project,{stage:10,artifactIds:['ARTIFACT-CANDIDATE-000001'],operatorLabel:h.operator});
h.accept(10,{stageData:{HASHES_RECORDED_WHERE_PRACTICAL:'TRUE',CHANGES_ALLOWED_DURING_BATCH:'FALSE'},records:{},evidenceRecords:[evidence()]});
mark(10);
const iteration10=engine.recordId(frozen10.iteration,'iterations');
const candidate10=engine.recordId(frozen10.candidate,'candidateFreezes');
const slots11=engine.reserveRunBatch(h.project,{stage:11,iterationId:iteration10,candidateId:candidate10,count:10});
for(const [index,slot] of slots11.entries()){
  engine.registerFreshContext(h.project,{stage:11,externalContextIdentifier:`STAGE11-EXTERNAL-${String(index+1).padStart(2,'0')}`,operatorLabel:h.operator,contextId:slot.contextId,runId:slot.runId,iterationId:iteration10,candidateId:candidate10});
  h.accept(11,{stageData:{FROZEN_EXECUTION_PACKAGE:'The exact candidate and component hashes were used.'},records:{runs:[runCompletion(slot.runId,{contextId:slot.contextId,iterationId:iteration10,candidateId:candidate10,output:`run ${index+1}: foreground #000000; background #FFFFFF; ratio 21:1`})]},evidenceRecords:[evidence('evidence-1',`Run ${index+1} raw evidence`,`Exact run ${index+1} output preserved.`)]},{scope:{runId:slot.runId,contextId:slot.contextId}});
}
mark(11);
for(const [index,slot] of slots11.entries())h.accept(12,{stageData:{RUNS:'10'},records:{verification:[verificationRecord({requirementId,runId:slot.runId,testId,index:index+1})]},evidenceRecords:[evidence('evidence-1',`Verification ${index+1} evidence`,`Independent verification ${index+1} established 21:1.`)]},{scope:{runId:slot.runId,contextId:slot.contextId}});
mark(12);
const matrix11=engine.verificationMatrix(h.project,iteration10);
assert(matrix11.expected.length===10&&matrix11.missing.length===0&&matrix11.duplicates.length===0&&matrix11.coverage===1,'Initial REQ × RUN × TEST matrix is not exact and complete.');
h.accept(13,{stageData:{REQUIREMENTS_SATISFIED_BY_ALL_TEN:'TRUE',CORRECTNESS_AFFECTING_DISAGREEMENTS:'NONE',PROHIBITED_OUTPUT_VARIANCES:'NONE',INCONCLUSIVE_TESTS:'NONE',REPEATED_FAILURE_GROUPS:'NONE',UNIQUE_FAILURES:'NONE'},records:{comparisons:[comparisonRecord(requirementId)]},evidenceRecords:[evidence()]});
mark(13);
h.accept(14,{stageData:{CONFIRMED_ROOT_CAUSES:'1',UNDETERMINED_ROOT_CAUSES:'0',BLOCKED_ANALYSES:'0'},records:{defects:[defectRecord(requirementId,slots11[0].runId)],rootCauses:[rootCauseRecord()]},evidenceRecords:[evidence()]});
mark(14);
const defectId=recordId('defects');
assert(engine.recordValue(active('defects')[0],'STATUS')==='CONFIRMED','Application lifecycle default STATUS=CONFIRMED was not assigned to the defect.');
h.accept(15,{stageData:{UNCONVERTED_CONFIRMED_DEFECTS:'NONE'},records:{regressions:[regressionRecord({defectId,requirementId})],regressionExecutions:[regressionExecutionRecord({iterationId:iteration10,candidateId:candidate10})]},evidenceRecords:[evidence()]});
mark(15);
const regressionId=recordId('regressions');
assert(engine.recordValue(active('regressions')[0],'ACTIVE_RETIRED_STATE')==='ACTIVE','Application lifecycle default ACTIVE_RETIRED_STATE=ACTIVE was not assigned.');
h.accept(16,{stageData:{DATE:'2026-08-25',INSTRUCTION_CHANGED:'TRUE',IF_EXECUTION_ONLY_DEFECT_WAS_INSTRUCTION_PRESERVED:'NOT APPLICABLE',PREFLIGHT_REPEATED_IF_CHANGED:'TRUE',ARTIFACTS_CHANGED:'Production instruction.',NEW_VERSIONS_CREATED:'INSTRUCTION-v002',IN_PLACE_MODIFICATIONS:'NONE',DOWNSTREAM_VERIFICATIONS_INVALIDATED:'TRUE'},records:{changes:[changeRecord(defectId)]},evidenceRecords:[evidence()]});
mark(16);
const changeId=recordId('changes');

const correctedBytes=new TextEncoder().encode('verified delivery\nforeground=#000000\nbackground=#FFFFFF\ntool=contrast-calculator/1.0.0\n');
const correctedSha=await hash.sha256Bytes(correctedBytes);
engine.registerArtifactBytes(h.project,{stage:17,artifactId:'ARTIFACT-CANDIDATE-000002',filename:'verified-delivery.txt',mediaType:'text/plain',byteSize:correctedBytes.byteLength,sha256:correctedSha,lineage:{changeId,priorArtifactId:'ARTIFACT-CANDIDATE-000001'},role:'CORRECTED_CANDIDATE_COMPONENT'});
const frozen17=engine.freezeCandidate(h.project,{stage:17,artifactIds:['ARTIFACT-CANDIDATE-000002'],operatorLabel:h.operator,purpose:'CORRECTED'});
const iteration17=engine.recordId(frozen17.iteration,'iterations');
const candidate17=engine.recordId(frozen17.candidate,'candidateFreezes');
h.accept(17,{stageData:{NEW_FROZEN_VERSIONS:'Corrected candidate bytes and current canonical versions are frozen.',OLD_CONVERSATIONS_CONTINUED:'FALSE',RUN_NAMESPACE:'Application-reserved Stage 17 namespace.',IDENTICAL_PACKAGE_CONFIRMED_FOR_ALL_RUNS:'TRUE'},records:{},evidenceRecords:[evidence()]},{operation:'FREEZE'});
const slots17=engine.reserveRunBatch(h.project,{stage:17,iterationId:iteration17,candidateId:candidate17,count:10});
for(const [index,slot] of slots17.entries()){
  engine.registerFreshContext(h.project,{stage:17,externalContextIdentifier:`STAGE17-EXTERNAL-${String(index+1).padStart(2,'0')}`,operatorLabel:h.operator,contextId:slot.contextId,runId:slot.runId,iterationId:iteration17,candidateId:candidate17});
  h.accept(17,{stageData:{EXECUTE_COMPLETED:'TRUE'},records:{runs:[runCompletion(slot.runId,{contextId:slot.contextId,iterationId:iteration17,candidateId:candidate17,output:`corrected run ${index+1}: ratio 21:1; tool contrast-calculator/1.0.0`})]},evidenceRecords:[evidence('evidence-1',`Corrected run ${index+1}`,`Corrected run ${index+1} preserved exact output and tool version.`)]},{operation:'EXECUTE_RUN',scope:{runId:slot.runId,contextId:slot.contextId}});
}
for(const [index,slot] of slots17.entries())h.accept(17,{stageData:{VERIFY_COMPLETED:'TRUE'},records:{verification:[verificationRecord({requirementId,runId:slot.runId,testId,index:101+index,tempKey:`corrected-verification-${index+1}`})]},evidenceRecords:[evidence('evidence-1',`Corrected verification ${index+1}`,`Independent corrected verification ${index+1} established 21:1 and the tool version.`)]},{operation:'VERIFY',scope:{runId:slot.runId,contextId:slot.contextId}});
h.accept(17,{stageData:{COMPARE_COMPLETED:'TRUE'},records:{comparisons:[comparisonRecord(requirementId,'corrected-comparison-1')]},evidenceRecords:[evidence()]},{operation:'COMPARE'});
h.accept(17,{stageData:{ROOT_CAUSE_COMPLETED:'TRUE'},records:{},evidenceRecords:[evidence()]},{operation:'ROOT_CAUSE'});
h.accept(17,{stageData:{REGRESSION_TESTS_ADDED:'TRUE'},records:{regressionExecutions:[regressionExecutionRecord({regressionRef:regressionId,iterationId:iteration17,candidateId:candidate17,phase:'POST_CORRECTION',result:'SATISFIED',tempKey:'corrected-reg-exec-1'})]},evidenceRecords:[evidence()]},{operation:'REGRESSION'});
h.accept(17,{stageData:{CORRECTIONS_COMPLETED:'TRUE'},records:{},evidenceRecords:[evidence()]},{operation:'CORRECT'});
mark(17);
const matrix17=engine.verificationMatrix(h.project,iteration17);
assert(matrix17.expected.length===10&&matrix17.coverage===1&&matrix17.missing.length===0&&matrix17.duplicates.length===0,'Corrected iteration verification matrix is incomplete.');
assert(engine.coverageMetrics(h.project).activeRegressionCount===1&&engine.coverageMetrics(h.project).regressionSuccess===1,'The permanent regression definition or corrected execution is not current.');
h.accept(18,{stageData:{REGRESSION_TEST_SUCCESS:'TRUE',RETURN_STAGE_FOR_EACH_FAILURE:'NONE'},records:{},evidenceRecords:[evidence()]});
mark(18);
assert(engine.convergenceMetrics(h.project).converged===true,'Stage 18 convergence was not derived from the latest corrected iteration.');

const frozen19=engine.freezeCandidate(h.project,{stage:19,artifactIds:['ARTIFACT-CANDIDATE-000002'],operatorLabel:h.operator,purpose:'UNCHANGED_CONFIRMATION'});
const iteration19=engine.recordId(frozen19.iteration,'iterations');
const candidate19=engine.recordId(frozen19.candidate,'candidateFreezes');
assert(hash.sha256Value(frozen19.candidate.fields.COMPONENT_HASHES)===hash.sha256Value(frozen17.candidate.fields.COMPONENT_HASHES),'Stage 19 changed the frozen candidate hashes.');
const prompt19Freeze=h.savePrompt(19,{operation:'CONFIRM_FREEZE'});
assert(prompt19Freeze.operation==='CONFIRM_FREEZE'&&schema.operationContract(19,'CONFIRM_FREEZE').agentWritableCollections.length===0&&schema.operationContract(19,'CONFIRM_FREEZE').agentStageFields.length===0,'Stage 19 CONFIRM_FREEZE is not an application-only exact subcontract.');
const slots19=engine.reserveRunBatch(h.project,{stage:19,iterationId:iteration19,candidateId:candidate19,count:10});
for(const [index,slot] of slots19.entries()){
  engine.registerFreshContext(h.project,{stage:19,externalContextIdentifier:`STAGE19-EXTERNAL-${String(index+1).padStart(2,'0')}`,operatorLabel:h.operator,contextId:slot.contextId,runId:slot.runId,iterationId:iteration19,candidateId:candidate19});
  h.accept(19,{stageData:{},records:{runs:[runCompletion(slot.runId,{contextId:slot.contextId,iterationId:iteration19,candidateId:candidate19,output:`unchanged confirmation run ${index+1}: ratio 21:1; exact candidate hash ${correctedSha}`})]},evidenceRecords:[evidence('evidence-1',`Confirmation run ${index+1}`,`New context ${index+1} preserved the unchanged candidate output.`)]},{operation:'EXECUTE_RUN',scope:{runId:slot.runId,contextId:slot.contextId}});
}
for(const [index,slot] of slots19.entries())h.accept(19,{stageData:{COMPLETE_TEST_SUITE_RUN:'TRUE'},records:{verification:[verificationRecord({requirementId,runId:slot.runId,testId,index:201+index,tempKey:`confirmation-verification-${index+1}`})]},evidenceRecords:[evidence('evidence-1',`Confirmation verification ${index+1}`,`Independent confirmation verification ${index+1} established 21:1.`)]},{operation:'VERIFY',scope:{runId:slot.runId,contextId:slot.contextId}});
h.accept(19,{stageData:{CROSS_RUN_COMPARISON_COMPLETED:'TRUE',NEW_CORRECTNESS_AFFECTING_VARIANCE:'NONE'},records:{comparisons:[comparisonRecord(requirementId,'confirmation-comparison-1')]},evidenceRecords:[evidence()]},{operation:'COMPARE'});
h.accept(19,{stageData:{INJECTED_DEFECTS_NOT_DETECTED:'NONE'},records:{regressionExecutions:[regressionExecutionRecord({regressionRef:regressionId,iterationId:iteration19,candidateId:candidate19,phase:'UNCHANGED_CONFIRMATION',result:'SATISFIED',tempKey:'confirmation-reg-exec-1'})]},evidenceRecords:[evidence()]},{operation:'REGRESSION_VERIFY'});
h.accept(19,{stageData:{COMPLETE_TEST_SUITE_RUN:'TRUE',CROSS_RUN_COMPARISON_COMPLETED:'TRUE',NEW_CRITICAL_DEFECTS:'NONE',NEW_MAJOR_DEFECTS:'NONE',NEW_REQUIREMENTS_DISCOVERED:'NONE',INJECTED_DEFECTS_NOT_DETECTED:'NONE',NEW_CORRECTNESS_AFFECTING_VARIANCE:'NONE',CONFIRMATION_ACCEPTANCE_CRITERIA_SATISFIED:'TRUE',REQUIRED_RETURN_STAGE:'NONE'},records:{confirmationRecords:[confirmationRecord({sourceIterationId:iteration17,confirmationIterationId:iteration19})]},evidenceRecords:[evidence()]},{operation:'CONFIRM'});
mark(19);
const matrix19=engine.verificationMatrix(h.project,iteration19);
assert(matrix19.expected.length===10&&matrix19.coverage===1&&matrix19.missing.length===0&&matrix19.duplicates.length===0,'Unchanged-confirmation matrix is incomplete.');

const baseline=engine.freezeBaseline(h.project,{artifactIds:['ARTIFACT-CANDIDATE-000002'],operatorLabel:h.operator,authorization:'AUTHORIZED'});
const baselineId=engine.recordId(baseline,'baselines');
h.accept(20,{stageData:{SUPPORTING_CONFIRMATION_ITERATION:iteration19,APPROVED_VERSIONS:'Current input/source/requirements/test/instruction versions and corrected candidate hashes.',BASELINE_PACKAGE_SEPARATED_FROM_WORKING_FILES:'TRUE'},records:{},evidenceRecords:[evidence()]});
mark(20);
engine.registerFreshContext(h.project,{stage:21,externalContextIdentifier:'PRODUCTION-CONTEXT-000001',operatorLabel:h.operator});
const product=engine.reserveProductExecution(h.project,{operatorLabel:h.operator});
const productId=engine.recordId(product,'products');
const productBytes=new TextEncoder().encode('verified delivery\nforeground=#000000\nbackground=#FFFFFF\nratio=21:1\ntool=contrast-calculator/1.0.0\n');
const productSha=await hash.sha256Bytes(productBytes);
engine.registerArtifactBytes(h.project,{stage:21,artifactId:'ARTIFACT-PRODUCT-000001',filename:'verified-delivery.txt',mediaType:'text/plain',byteSize:productBytes.byteLength,sha256:productSha,lineage:{baselineId,productId,candidateArtifactId:'ARTIFACT-CANDIDATE-000002'},role:'FINISHED_PRODUCT'});
h.accept(21,{stageData:{PRODUCTION_CONTEXT_REFERENCE:'PRODUCTION-CONTEXT-000001',FRESH_CONTEXT:'TRUE',BASELINE_MATERIALS_SUPPLIED:'TRUE',EXECUTION_RECORD:'COMPLETE',EDITED_OUTSIDE_CONTROLLED_WORKFLOW:'FALSE',EDIT_REQUIRED:'FALSE',IF_YES_NEW_PRODUCT_VERSION_CREATED:'NOT APPLICABLE',AFFECTED_VALIDATION_IDENTIFIED:'NONE'},records:{products:[{tempKey:null,targetId:productId,fields:{BASELINE_MATERIALS:'ARTIFACT-CANDIDATE-000002',EXECUTION_TIMESTAMPS:'2026-08-25T13:00:00.000Z/2026-08-25T13:01:00.000Z',TOOL_CONFIGURATION:'contrast-calculator/1.0.0',DEVIATIONS:'NONE',FAILURES:'NONE',GENERATED_ARTIFACT_INVENTORY:'ARTIFACT-PRODUCT-000001'},relationships:{},evidenceRefs:['evidence-1']}]},evidenceRecords:[evidence()]});
mark(21);
assert(engine.recordValue(active('products').at(-1),'STATUS')==='COMPLETED','Reserved product was not application-transitioned to COMPLETED.');
h.accept(22,{stageData:{APPLICABLE_MANDATORY_DETERMINISTIC_TESTS:'1',PRODUCT_REJECTED_BY_MANDATORY_FAILURE:'FALSE'},records:{deterministicResults:[deterministicResultRecord({productId,testId,requirementId})]},evidenceRecords:[evidence()]});
mark(22);
h.accept(23,{stageData:{EVALUATOR_INDEPENDENT_FROM_GENERATOR:'TRUE',UNSUPPORTED_BARE_CONCLUSIONS:'NONE'},records:{meaningResults:[meaningResultRecord({productId,requirementId})]},evidenceRecords:[evidence()]});
mark(23);
h.accept(24,{stageData:{REVIEWER_INDEPENDENT:'TRUE',ATTACKS_EXECUTED:'LOW_CONTRAST_MUTATION',UNDETERMINED_ATTACKS:'NONE',REGRESSIONS_FOUND:'NONE',RETURN_TO_ROOT_CAUSE_REQUIRED:'FALSE'},records:{adversarialResults:[adversarialResultRecord(productId)]},evidenceRecords:[evidence()]});
mark(24);
h.accept(25,{stageData:{CONTROLLING_EVIDENCE:'Exact stored bytes, hash, filename, and rendered representation.'},records:{representationInspections:[representationRecord('ARTIFACT-PRODUCT-000001')]},evidenceRecords:[evidence()]});
mark(25);
h.accept(26,{stageData:{PROCESS_REVIEW:'COMPLETE',PROCESS_CORRECTNESS_DETERMINATION:'SATISFIED',PROCESS_EVIDENCE:'Canonical history and manifests.',PRODUCT_REVIEW:'COMPLETE',PRODUCT_CORRECTNESS_DETERMINATION:'SATISFIED',PRODUCT_EVIDENCE:'Current product evidence.',PROCESS_PRODUCT_DISCREPANCIES:'NONE',RECONCILED_DETERMINATION:'SATISFIED',CONTROLLING_REASON:'All current evidence reconciles.',CONTROLLING_EVIDENCE:'Process and product audits.'},records:{processAudits:[processAuditRecord()],productAudits:[productAuditRecord()]},evidenceRecords:[evidence()]});
mark(26);
h.accept(27,{stageData:{CONTROLLING_DECISION_RULE:'Release only when every mandatory current result and audit is satisfied.',CONTROLLING_REASON:'No current blocker, violation, major/critical defect, unknown, or missing applicable regression remains.',AFFIRMATIVE_EVIDENCE:'Current canonical release evidence set.'},records:{releaseGateReviews:[releaseGateReviewRecord({productId,baselineId})]},evidenceRecords:[evidence()]});
const release=engine.recordReleaseDetermination(h.project);
const releaseId=engine.recordId(release,'releaseRecords');
assert(engine.recordValue(release,'DETERMINATION')==='ACCEPTED',`Application release determination is ${engine.recordValue(release,'DETERMINATION')}, not ACCEPTED: ${JSON.stringify(engine.releaseMetrics(h.project))}`);
const repeatedRelease=engine.recordReleaseDetermination(h.project);
assert(engine.recordId(repeatedRelease,'releaseRecords')===releaseId&&active('releaseRecords').length===1,'Release determination is not idempotent for unchanged evidence.');
mark(27);
const audited=[{artifactId:'ARTIFACT-PRODUCT-000001',name:'verified-delivery.txt',version:'PRODUCT-v001',storageReference:'indexeddb:ARTIFACT-PRODUCT-000001',size:productBytes.byteLength,sha256:productSha}];
const delivery=[...audited].reverse();
engine.verifyArtifactIdentity(h.project,audited,delivery);
mark(28);
engine.constructEvidenceChains(h.project);
mark(29);
assert(active('evidenceChains').every(chain=>engine.recordValue(chain,'STATUS')==='COMPLETE'),'At least one mandatory evidence graph is incomplete.');
h.accept(30,{stageData:{REGISTRY_STORAGE_LOCATION:'Canonical append-only project history.',REGISTRY_RETENTION_RULE:'Never rewrite; supersede with linked records.',DEFECT_RECORDS_MISSING_REQUIRED_FIELDS:'NONE',REGISTRY_HASH_OR_INTEGRITY_EVIDENCE:'Canonical record hashes and project integrity hash.',CONTROLLING_EVIDENCE:'Defect, RCA, regression definition, pre-correction failure, corrected execution, and unchanged confirmation.'},records:{},evidenceRecords:[evidence()]});
mark(30);
assert(stageReport.length===30&&stageReport.every(item=>item.status==='COMPLETE'),'Not all 30 stages completed in one continuous project.');
console.log(JSON.stringify({continuousLifecycle:true,completedThrough:30,stageReport,identities:{sourceId,requirementId,testId,instructionId,iteration10,candidate10,defectId,regressionId,changeId,iteration17,candidate17,iteration19,candidate19,baselineId,productId,releaseId},rawResponses:h.project.projectData.rawResponses.length,rejectedResponses:h.project.projectData.rejectedResponses.length,clarificationAnswers:h.project.projectData.humanInputAnswers.length,extractionManifests:h.project.projectData.extractionManifests.length,verificationTriples:{initial:matrix11.expected.length,corrected:matrix17.expected.length,confirmation:matrix19.expected.length},releaseDetermination:engine.recordValue(release,'DETERMINATION'),artifactIdentityRecords:active('artifactIdentities').length,evidenceChains:active('evidenceChains').length},null,2));

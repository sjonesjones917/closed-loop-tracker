(()=>{
'use strict';
const WORKFLOW_ID='mobile-closed-loop/30';
const PROJECT_SCHEMA='closed-loop-project/3';
const STAGE_COUNT=30;
const SCHEMA=PROJECT_SCHEMA;
const STAGE_DECISIONS=Object.freeze(['READY TO PROCEED','BLOCKED','NOT READY - CORRECTION REQUIRED']);
const titles=[
'INITIALIZE THE JOB','BUILD THE SOURCE INVENTORY','RESEARCH THE REQUIREMENTS','COMPILE THE REQUIREMENT SPECIFICATION','RESOLVE THE REQUIREMENT SET','BUILD THE VERIFICATION SUITE BEFORE WRITING THE PRODUCTION INSTRUCTION','BUILD FAILURE TESTS','AUTHOR THE PRODUCTION INSTRUCTION','PREFLIGHT THE PRODUCTION INSTRUCTION','FREEZE THE TEST CANDIDATE','RUN TEN INDEPENDENT EXECUTIONS','VERIFY EACH EXECUTION INDEPENDENTLY','COMPARE THE TEN EXECUTIONS','ROOT-CAUSE EVERY DEFECT','CONVERT EVERY CONFIRMED FAILURE INTO A REGRESSION TEST','CORRECT THE ROOT CAUSE','RE-RUN THE COMPLETE TEN-EXECUTION ITERATION','CONTINUE UNTIL CONVERGENCE','RUN AN UNCHANGED CONFIRMATION ITERATION','FREEZE THE PRODUCTION BASELINE','GENERATE THE FINISHED PRODUCT','RUN DETERMINISTIC VERIFICATION ON THE FINISHED PRODUCT','RUN INDEPENDENT MEANING-BASED VERIFICATION','RUN ADVERSARIAL VERIFICATION','INSPECT THE FINAL REPRESENTATION','RECONCILE PROCESS AND PRODUCT EVIDENCE','APPLY THE RELEASE GATE','VERIFY ARTIFACT IDENTITY BEFORE RELEASE','PRESERVE THE COMPLETE EVIDENCE CHAIN','PRESERVE FAILURES PERMANENTLY'];
const results=[
'Create the controlling job record before substantive production work begins.','Identify every source that may control, inform, or prove correctness and establish the authority hierarchy.','Extract every material fact, requirement, restriction, exception, condition, dependency, recommendation, and evidentiary constraint from the accepted external source set while preserving each source role.','Convert researched obligations into atomic, independently testable requirement records.','Detect and resolve defects inside the requirement set before any production instruction is written.','Define at least one verification procedure, execution responsibility, required capability, artifact requirement, and evidence requirement for every mandatory requirement before production instructions are authored.','Prove that validators reject known-invalid cases.','Write the production instruction from the verified requirement registry with explicit operations, decisions, outputs, and failure handling.','Inspect the production instruction sentence-by-sentence without executing the target work and remove every known material instruction defect.','Freeze the exact candidate components that every execution and reviewer will use during the iteration batch.','Execute the same frozen production candidate ten times in independent fresh contexts and preserve every output separately.','Apply every applicable current test independently to every mandatory requirement in every run, producing the complete REQ_ID × RUN_ID × TEST_ID matrix.','Compare all ten verified executions requirement-by-requirement and treat correctness-affecting variance as a defect.','Identify the earliest layer at which every material defect became incorrect.','Convert every confirmed defect into a permanent regression test that demonstrably fails before correction; later corrected iterations must execute it successfully.','Correct the earliest defective layer, propagate the change through all dependent artifacts, and create new versions.','Freeze the corrected candidate and perform a new complete batch of ten independent executions.','Calculate convergence metrics after each iteration and prevent baseline freeze until every acceptance threshold is simultaneously satisfied.','Confirm stability by rerunning ten independent executions with absolutely no change after the first converged iteration.','Create the immutable approved production baseline only after unchanged confirmation succeeds.','Generate the actual requested deliverable in a fresh context using only the approved baseline materials.','Run every applicable deterministic test against the actual generated artifact and reject any mandatory failure.','Have an independent evaluator compare the actual product meaning against every applicable requirement and its source evidence.','Deliberately attempt to disprove product correctness and return every discovered defect to root-cause analysis.','Inspect the exact files and rendered representations that will be delivered, including every material transformation and every packaged artifact.','Establish process correctness and product correctness independently, then reconcile both bodies of evidence.','Assign exactly one release state using the verified requirement, test, defect, blocker, and evidence records.','Prove that every file being delivered is byte-for-byte identical to the exact file that completed final verification.','Prove and preserve every mandatory traceability link from governing source through release decision for each mandatory requirement.','Maintain a permanent defect and regression registry so every confirmed failure remains reproducible, detectable, and release-blocking if it reappears.'];
const roles=['Job-control analyst','Source-authority analyst','Requirements-research analyst','Requirement-specification engineer','Requirement-resolution reviewer','Verification architect','Adversarial test designer','Production-instruction engineer','Independent preflight reviewer','Configuration-control reviewer','Independent production execution agent','Independent run verifier','Cross-run comparison analyst','Root-cause analyst','Regression-test engineer','Change-control engineer','New-iteration controller','Convergence reviewer','Unchanged-confirmation reviewer','Baseline configuration controller','Final production execution agent','Deterministic product verifier','Independent meaning evaluator','Independent adversarial reviewer','Final-representation inspector','Release-evidence reconciler','Release-gate reviewer','Artifact-identity reviewer','Traceability evidence custodian','Permanent defect-registry custodian'];
const gate={
1:['Exact user objective preserved verbatim','Every supplied item and material unknown recorded','Explicit requirements and assumptions separated','Complete input set has a controlled identity'],2:['Every accepted independent external source has a complete record','Every relied-upon supplied file was inspected','Authority and evidentiary roles are recorded','Every controlling conflict is resolved or blocked'],3:['Every current accepted Stage 02 source has a research record','User, format, medium, delivery, and dependency requirements were considered','Conflict, restriction, and exception pass complete','Latest complete pass found no new material requirement category'],4:['Every mandatory obligation maps to an atomic requirement','Every requirement has observable satisfaction and failure conditions','Every external requirement traces to exact evidence','Requirement registry has a controlled identity'],5:['Every requirement-set defect category checked','Every detected defect resolved or blocked','Every requirement has determinable applicability and a verification path','Changed requirements received a new controlled identity'],6:['Every mandatory requirement has a ready test definition','Every test declares execution responsibility, required capability, artifact requirements, and evidence','Unavailable mandatory execution capability blocks completion','Mandatory test coverage equals 1.00 or stage is blocked','Test suite has a controlled identity'],7:['Every active requirement has a failure analysis','Every applicable validator executed against invalid fixtures','No accepted invalid fixture remains without a validator defect','Failure fixtures are preserved'],8:['Every mandatory requirement is implemented by the instruction','Every operation has ordered inputs, tools, outputs, dependencies, and failure handling','Output contract and completion criteria are exact','Every material instruction traces to a requirement or control'],9:['Reviewer independent from instruction author','Every sentence and material clause evaluated','Every correction caused a full repeated review','No known material instruction defect remains'],10:['Every required component has an exact version','Tool configuration and immutable identities recorded','All ten runs receive identical frozen materials','Candidate and iteration identifiers are assigned'],11:['Exactly ten fresh contexts used','Every run received the identical frozen package','No run saw another run output or reviewer feedback','Ten outputs and run records are preserved separately'],12:['Every applicable current REQ_ID × RUN_ID × TEST_ID triple has exactly one verification record','No generator validated its own output','Every result has evidence','Verification matrix count reconciles exactly'],13:['Every requirement compared across all ten runs','Every correctness-affecting variance has a defect record','Repeated and unique failures are separated','No run or evidence discarded'],14:['Every material defect has a backward trace','Each root cause identifies the earliest defective layer with evidence','Every correction and downstream invalidation identified','Unknown root cause remains blocked'],15:['Every confirmed defect has a permanent regression record','Every regression has an actual pre-correction execution that demonstrates failure','No applicable regression is deleted','Post-correction success is established only by a later corrected execution'],16:['Every confirmed root cause has a correction or blocker','No version modified in place','Every invalidated artifact and required rerun identified','Execution-only defects do not cause unsupported instruction changes'],17:['New candidate and iteration created','Ten new contexts used and no old conversation continued','Identical corrected package used for all ten runs','Complete execution and correction loop repeated'],18:['Every metric calculated from identified records','All nine convergence conditions evaluated','Numerators and denominators reconcile','Converged only when all conditions are true'],19:['Every component version and available hash unchanged','Ten new independent contexts used','Complete test and regression suites ran','No new material defect, requirement, missed failure, or unexplained variance remains'],20:['Unchanged confirmation succeeded','Every approved component has exact version and immutable identity','Baseline package separated from working files','Any changed component automatically loses baseline status'],21:['Fresh production context used only approved baseline materials','Every requested output exists with controlled identity','Every output hash is recorded','No uncontrolled edit occurred'],22:['Every applicable mandatory deterministic test ran against actual product bytes','Every result has objective evidence and exact input identity','Any mandatory failure rejected the product','Test counts reconcile'],23:['Evaluator independent from product generation','Every applicable meaning requirement has product-location and source evidence','Every determination is evidence-supported','Every violation or mandatory unknown has a defect or blocker'],24:['Independent adversarial review covered every applicable attack category','Historical regression patterns tested','Counterexamples and findings have evidence','Every mandatory finding routes to root-cause analysis'],25:['Every delivery artifact and transformation identified','Every required page, view, and packaged file inspected','Every packaged file was opened or tested','No unresolved critical, major, or mandatory representation unknown remains'],26:['Process and product determinations are separate','Every required process and product fact is established','Every discrepancy, missing link, defect, and blocker recorded','No mandatory process or product fact remains unknown'],27:['Every mandatory requirement and validator accounted for','Exactly one release state selected using an explicit rule','Acceptance has affirmative evidence for every mandatory requirement','Delivery is not authorized before Stage 28'],28:['Release gate accepted','Every release artifact rehashed immediately before delivery','Every release hash and byte size exactly matches audited values','Authorization names only exact matching artifacts'],29:['One evidence-chain record exists for every mandatory requirement','Every required link uses exact identifiers and preserved evidence','Mandatory evidence-chain coverage equals 100 percent','Accepted release files link to audited and release hashes'],30:['Every defect has a stable permanent identifier','Every confirmed defect has a reproducible permanent regression','Every applicable regression ran successfully before baseline approval','Historical records are append-only']};
const fields={
1:['JOB_ID','JOB_TITLE','DATE_OPENED','JOB_OWNER','EXACT_USER_OBJECTIVE_VERBATIM','EXACT_DELIVERABLE_REQUESTED','SUPPLIED_MATERIALS_INVENTORY','REQUIRED_OUTPUT_FORMAT','DEADLINE_OR_TEMPORAL_SCOPE','DESIRED_SOURCE_COUNT','KNOWN_AUTHORITATIVE_SOURCES','AVAILABLE_TOOLS','PROHIBITED_ACTIONS','EXPLICIT_USER_REQUIREMENTS','ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_VERSION','INPUT_SET_CONTENTS','INPUT_SET_HASH_OR_MANIFEST','JOB_RECORD_STATUS','STATUS_EVIDENCE'],2:['SOURCE_SET_VERSION','AUTHORITY_HIERARCHY','SOURCE_APPLICABILITY_DETERMINATION','SOURCE_RECORDS','SOURCE_CONFLICT_RECORDS','KNOWN_CONTROLLING_SOURCES_EXAMINED','UNRESOLVED_CONTROLLING_CONFLICTS','STAGE_DECISION','DECISION_EVIDENCE'],3:['RESEARCH_VERSION','SOURCE_RESEARCH_RECORDS','CANDIDATE_REQUIREMENT_RECORDS','EXCEPTIONS_AND_EDGE_CONDITIONS','CONFLICTING_OR_INVALIDATING_MATERIAL','RESEARCH_GAPS_AND_BLOCKERS','ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED','SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED','LATEST_PASS_NUMBER','NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS','STAGE_DECISION','DECISION_EVIDENCE'],4:['REQUIREMENTS_VERSION','REQUIREMENT_RECORDS','ATOMICITY_REVIEW_RESULTS','DEFINED_TERM_GAPS','TOTAL_REQUIREMENTS','MANDATORY_REQUIREMENTS','CONDITIONAL_REQUIREMENTS','OPTIONAL_REQUIREMENTS','BLOCKED_REQUIREMENTS','STAGE_DECISION','DECISION_EVIDENCE'],5:['INPUT_REQUIREMENTS_VERSION','OUTPUT_REQUIREMENTS_VERSION','REQUIREMENT_DEFECT_RECORDS','DUPLICATES_REMAINING','UNRESOLVED_CONFLICTS','IMPOSSIBLE_COMBINATIONS','UNDEFINED_TERMS','CIRCULAR_DEPENDENCIES','MISSING_PREREQUISITES','UNSUPPORTED_REQUIREMENTS','APPLICABILITY_UNDETERMINED','REQUIREMENTS_WITHOUT_VERIFICATION_PATH','MANDATORY_BLOCKERS','STAGE_DECISION','DECISION_EVIDENCE'],6:['TEST_SUITE_VERSION','TEST_RECORDS','COVERAGE_RECORDS','TOTAL_ACTIVE_MANDATORY_REQUIREMENTS','ACTIVE_MANDATORY_REQUIREMENTS_WITH_AT_LEAST_ONE_READY_TEST','MANDATORY_TEST_COVERAGE','BLOCKED_MANDATORY_REQUIREMENTS','STAGE_DECISION','DECISION_EVIDENCE'],7:['MUTATION_SUITE_VERSION','FAILURE_TEST_RECORDS','ACTIVE_REQUIREMENTS','REQUIREMENTS_WITH_AT_LEAST_ONE_FAILURE_TEST','FAILURE_TEST_COVERAGE','INVALID_FIXTURES_ACCEPTED','DEFECTIVE_VALIDATORS','STAGE_DECISION','DECISION_EVIDENCE'],8:['DRAFT_INSTRUCTION_VERSION','OBJECTIVE','AUTHORIZED_INPUTS','INPUT_FAILURE_RULES','SOURCE_AUTHORITY','SCOPE','DEFINED_TERMS','REQUIRED_PROCEDURE_IN_ORDER','DECISION_RULES','TOOL_RULES','OUTPUT_CONTRACT','VERIFICATION_AND_FAILURE_HANDLING','COMPLETION_CRITERIA','INSTRUCTION_TRACE_RECORDS','STAGE_DECISION','DECISION_EVIDENCE'],9:['INPUT_INSTRUCTION_VERSION','OUTPUT_INSTRUCTION_VERSION','PREFLIGHT_REVIEWER_ID','REVIEW_CONTEXT_INDEPENDENT_FROM_AUTHOR','SENTENCE_REVIEW_RECORDS','PREFLIGHT_ITERATION_RECORDS','EVERY_SENTENCE_REVIEWED','KNOWN_MATERIAL_AMBIGUITIES','KNOWN_MATERIAL_CONFLICTS','UNAVAILABLE_REQUIRED_CAPABILITIES','UNVERIFIABLE_INSTRUCTIONS','STAGE_DECISION','DECISION_EVIDENCE'],10:['CANDIDATE_ID','ITERATION_ID','FREEZE_DATE','FREEZE_OWNER','FROZEN_COMPONENT_RECORDS','TOOL_CONFIGURATION_RECORDS','ALL_REQUIRED_COMPONENTS_PRESENT','HASHES_RECORDED_WHERE_PRACTICAL','ALL_RUNS_WILL_RECEIVE_IDENTICAL_FROZEN_MATERIALS','CHANGES_ALLOWED_DURING_BATCH','STAGE_DECISION','DECISION_EVIDENCE'],11:['ITERATION_ID','CANDIDATE_ID','FROZEN_EXECUTION_PACKAGE','RUN_RECORDS','FRESH_CONTEXTS_CREATED','RUNS_RECEIVING_EXACT_PACKAGE','CONTAMINATED_RUNS','OUTPUTS_SAVED_SEPARATELY','STAGE_DECISION','DECISION_EVIDENCE'],12:['ITERATION_ID','REQUIREMENTS_VERSION','TEST_SUITE_VERSION','VERIFICATION_RECORDS','ACTIVE_MANDATORY_REQUIREMENTS','RUNS','EXPECTED_MANDATORY_RECORDS','ACTUAL_MANDATORY_RECORDS','MISSING_RECORDS','SATISFIED_RECORDS','VIOLATED_RECORDS','UNDETERMINED_RECORDS','SELF_VALIDATED_RECORDS','STAGE_DECISION','DECISION_EVIDENCE'],13:['ITERATION_ID','COMPARISON_VERSION','REQUIREMENT_COMPARISON_RECORDS','REQUIREMENTS_SATISFIED_BY_ALL_TEN','REQUIREMENTS_WITH_AT_LEAST_ONE_VIOLATION','REQUIREMENTS_WITH_AT_LEAST_ONE_UNDETERMINED','CORRECTNESS_AFFECTING_DISAGREEMENTS','PROHIBITED_OUTPUT_VARIANCES','INCONCLUSIVE_TESTS','REPEATED_FAILURE_GROUPS','UNIQUE_FAILURES','STAGE_DECISION','DECISION_EVIDENCE'],14:['ROOT_CAUSE_ANALYSIS_VERSION','DEFECT_ROOT_CAUSE_RECORDS','TOTAL_MATERIAL_DEFECTS','CONFIRMED_ROOT_CAUSES','UNDETERMINED_ROOT_CAUSES','BLOCKED_ANALYSES','STAGE_DECISION','DECISION_EVIDENCE'],15:['INPUT_TEST_SUITE_VERSION','OUTPUT_TEST_SUITE_VERSION','REGRESSION_FIXTURE_VERSION','REGRESSION_RECORDS','CONFIRMED_DEFECTS','CONFIRMED_DEFECTS_WITH_REGRESSION_TEST','PRE_CORRECTION_FAILURES_PROVEN','UNCONVERTED_CONFIRMED_DEFECTS','STAGE_DECISION','DECISION_EVIDENCE'],16:['CHANGE_SET_ID','TRIGGERING_DEFECT_IDS','RCA_VERSION','DATE','ARTIFACT_CHANGE_RECORDS','INSTRUCTION_CHANGED','IF_EXECUTION_ONLY_DEFECT_WAS_INSTRUCTION_PRESERVED','PREFLIGHT_REPEATED_IF_CHANGED','ARTIFACTS_CHANGED','NEW_VERSIONS_CREATED','IN_PLACE_MODIFICATIONS','DOWNSTREAM_VERIFICATIONS_INVALIDATED','STAGE_DECISION','DECISION_EVIDENCE'],17:['PREVIOUS_ITERATION_ID','NEW_ITERATION_ID','PREVIOUS_CANDIDATE_ID','NEW_CANDIDATE_ID','CHANGESET_ID','NEW_FROZEN_VERSIONS','OLD_CONVERSATIONS_CONTINUED','TEN_NEW_CONTEXTS_CREATED','RUN_NAMESPACE','IDENTICAL_PACKAGE_CONFIRMED_FOR_ALL_RUNS','PRIOR_OUTPUTS_WITHHELD','EXECUTE_COMPLETED','VERIFY_COMPLETED','COMPARE_COMPLETED','ROOT_CAUSE_COMPLETED','REGRESSION_TESTS_ADDED','CORRECTIONS_COMPLETED','STAGE_DECISION','DECISION_EVIDENCE'],18:['ITERATION_ID','METRICS_VERSION','TOTAL_MANDATORY_REQUIREMENTS','MANDATORY_REQUIREMENTS_WITH_COMPLETE_SPECIFICATION_AND_APPLICABILITY','MANDATORY_REQUIREMENT_COVERAGE','MANDATORY_REQUIREMENTS_WITH_AFFIRMATIVE_APPLICABLE_VERIFICATION','MANDATORY_VERIFICATION_COVERAGE','TOTAL_STILL_APPLICABLE_REGRESSION_TESTS','SUCCESSFUL_REGRESSION_TESTS','REGRESSION_TEST_SUCCESS','CRITICAL_DEFECTS','MAJOR_DEFECTS','MANDATORY_UNRESOLVED_UNKNOWNS','KNOWN_CORRECTNESS_AFFECTING_CONTRADICTIONS','KNOWN_CORRECTNESS_AFFECTING_AMBIGUITIES','UNEXPLAINED_CORRECTNESS_AFFECTING_EXECUTION_VARIANCE','ALL_CONDITIONS_SIMULTANEOUSLY_TRUE','FAILED_CONDITIONS','RETURN_STAGE_FOR_EACH_FAILURE','STAGE_DECISION','DECISION_EVIDENCE'],19:['SOURCE_CONVERGED_ITERATION','CONFIRMATION_ITERATION_ID','ZERO_CHANGE_AUDIT','TEN_NEW_CONTEXTS_CREATED','SAME_FROZEN_PACKAGE_USED','RUNS_COMPLETED','COMPLETE_TEST_SUITE_RUN','ALL_REGRESSION_TESTS_RUN','CROSS_RUN_COMPARISON_COMPLETED','NEW_CRITICAL_DEFECTS','NEW_MAJOR_DEFECTS','NEW_REQUIREMENTS_DISCOVERED','INJECTED_DEFECTS_NOT_DETECTED','NEW_CORRECTNESS_AFFECTING_VARIANCE','CONFIRMATION_ACCEPTANCE_CRITERIA_SATISFIED','REQUIRED_RETURN_STAGE','STAGE_DECISION','DECISION_EVIDENCE'],20:['BASELINE_ID','BASELINE_APPROVAL_DATE','SUPPORTING_CONFIRMATION_ITERATION','BASELINE_OWNER','APPROVED_VERSIONS','BASELINE_FILE_RECORDS','UNCHANGED_CONFIRMATION_SUCCEEDED','ALL_APPROVED_COMPONENTS_PRESENT','ALL_IMMUTABLE_FILES_HASHED','BASELINE_PACKAGE_SEPARATED_FROM_WORKING_FILES','ANY_CHANGED_COMPONENT_RETAINS_BASELINE_STATUS','STAGE_DECISION','DECISION_EVIDENCE'],21:['PRODUCT_ID','PRODUCT_VERSION','BASELINE_ID','EXECUTION_ID','PRODUCTION_CONTEXT_REFERENCE','FRESH_CONTEXT','BASELINE_MATERIALS_SUPPLIED','EXECUTION_RECORD','OUTPUT_FILE_RECORDS','EDITED_OUTSIDE_CONTROLLED_WORKFLOW','EDIT_REQUIRED','IF_YES_NEW_PRODUCT_VERSION_CREATED','AFFECTED_VALIDATION_IDENTIFIED','STAGE_DECISION','DECISION_EVIDENCE'],22:['PRODUCT_ID','PRODUCT_VERSION','PRODUCT_HASHES_BEFORE_TEST','TEST_SUITE_VERSION','VALIDATOR_VERSION','DETERMINISTIC_TEST_RESULTS','APPLICABLE_MANDATORY_DETERMINISTIC_TESTS','EXECUTED','SATISFIED','VIOLATED','UNDETERMINED','MISSING_TEST_RESULTS','PRODUCT_REJECTED_BY_MANDATORY_FAILURE','STAGE_DECISION','DECISION_EVIDENCE'],23:['PRODUCT_ID','PRODUCT_VERSION','REQUIREMENTS_VERSION','MEANING_RUBRIC_VERSION','EVALUATOR_ID','EVALUATOR_INDEPENDENT_FROM_GENERATOR','MEANING_REQUIREMENT_RECORDS','ACTIVE_MEANING_REQUIREMENTS','MEANING_RECORDS_COMPLETED','SATISFIED','VIOLATED','UNDETERMINED','UNSUPPORTED_BARE_CONCLUSIONS','STAGE_DECISION','DECISION_EVIDENCE'],24:['PRODUCT_ID','PRODUCT_VERSION','ADVERSARIAL_REVIEW_VERSION','REVIEWER_ID','REVIEWER_INDEPENDENT','ADVERSARIAL_CHECK_RECORDS','ATTACKS_EXECUTED','MANDATORY_DEFECTS_FOUND','CRITICAL_DEFECTS_FOUND','MAJOR_DEFECTS_FOUND','UNDETERMINED_ATTACKS','REGRESSIONS_FOUND','RETURN_TO_ROOT_CAUSE_REQUIRED','STAGE_DECISION','DECISION_EVIDENCE'],25:['PRODUCT_ID','PRODUCT_VERSION','REPRESENTATION_REVIEW_VERSION','APPROVED_BASELINE_ID','DELIVERY_ARTIFACT_INVENTORY','TRANSFORMATION_CHAIN_RECORDS','PAGE_OR_VIEW_INSPECTION_RECORDS','PACKAGE_INSPECTION_RECORDS','TOTAL_DELIVERY_ARTIFACTS','TOTAL_PAGES_OR_VIEWS_REQUIRED','TOTAL_PAGES_OR_VIEWS_INSPECTED','TOTAL_PACKAGED_FILES_REQUIRED','TOTAL_PACKAGED_FILES_OPENED_OR_TESTED','UNRESOLVED_CRITICAL_DEFECTS','UNRESOLVED_MAJOR_DEFECTS','UNRESOLVED_REPRESENTATION_UNKNOWNS','FINAL_REPRESENTATION_DETERMINATION','CONTROLLING_EVIDENCE'],26:['PRODUCT_ID','PRODUCT_VERSION','BASELINE_ID','REVIEW_VERSION','PROCESS_REVIEW','PROCESS_CORRECTNESS_DETERMINATION','PROCESS_EVIDENCE','PRODUCT_REVIEW','PRODUCT_CORRECTNESS_DETERMINATION','PRODUCT_EVIDENCE','PROCESS_PRODUCT_DISCREPANCIES','MISSING_EVIDENCE_LINKS','RECONCILIATION_DEFECT_IDS','RECONCILIATION_BLOCKER_IDS','RECONCILED_DETERMINATION','CONTROLLING_REASON','CONTROLLING_EVIDENCE'],27:['RELEASE_GATE_ID','DATE_AND_TIME','PRODUCT_ID','PRODUCT_VERSION','BASELINE_ID','RECONCILED_REVIEW_VERSION','TOTAL_MANDATORY_REQUIREMENTS','MANDATORY_REQUIREMENTS_WITH_AFFIRMATIVE_SUPPORTING_EVIDENCE','MANDATORY_REQUIREMENTS_DEMONSTRABLY_VIOLATED','MANDATORY_REQUIREMENTS_NOT_ESTABLISHED','TOTAL_MANDATORY_VALIDATORS','MANDATORY_VALIDATORS_SUCCEEDED','MANDATORY_VALIDATORS_FAILED','MANDATORY_VALIDATORS_UNDETERMINED_OR_NOT_RUN','UNRESOLVED_CRITICAL_DEFECTS','UNRESOLVED_MAJOR_DEFECTS','BLOCKING_REQUIREMENT_IDS','VIOLATED_REQUIREMENT_IDS','FAILED_TEST_IDS','UNDETERMINED_OR_MISSING_TEST_IDS','UNRESOLVED_DEFECT_IDS','BLOCKER_IDS','SELECTED_RELEASE_STATE','CONTROLLING_DECISION_RULE','CONTROLLING_REASON','AFFIRMATIVE_EVIDENCE'],28:['HASH_REVIEW_ID','RELEASE_GATE_ID','RELEASE_GATE_STATE','HASH_ALGORITHM','HASH_TOOL_AND_VERSION','HASH_OPERATOR','ARTIFACT_HASH_RECORDS','TOTAL_ARTIFACTS_REQUIRED_FOR_RELEASE','TOTAL_ARTIFACTS_WITH_AUDITED_HASH','TOTAL_ARTIFACTS_REHASHED_IMMEDIATELY_BEFORE_DELIVERY','TOTAL_EXACT_HASH_MATCHES','TOTAL_HASH_MISMATCHES','TOTAL_UNKNOWN_HASH_COMPARISONS','ALL_RELEASE_HASHES_EQUAL_AUDITED_HASHES','ANY_POST_REVIEW_MODIFICATION','DELIVERY_AUTHORIZATION','EXACT_AUTHORIZED_ARTIFACT_IDS','EXACT_AUTHORIZED_FILENAMES','AUTHORIZATION_EVIDENCE','AUTHORIZED_BY','AUTHORIZATION_DATE_AND_TIME'],29:['EVIDENCE_CHAIN_VERSION','JOB_ID','PRODUCT_ID','PRODUCT_VERSION','BASELINE_ID','RELEASE_GATE_ID','HASH_REVIEW_ID','MANDATORY_REQUIREMENT_EVIDENCE_CHAIN_RECORDS','TOTAL_MANDATORY_REQUIREMENTS','TOTAL_MANDATORY_REQUIREMENTS_WITH_COMPLETE_CHAINS','TOTAL_MANDATORY_REQUIREMENTS_WITH_INCOMPLETE_CHAINS','TOTAL_MANDATORY_REQUIREMENTS_WITH_UNKNOWN_CHAIN_LINKS','MANDATORY_EVIDENCE_CHAIN_COVERAGE','ALL_MANDATORY_EVIDENCE_CHAINS_COMPLETE','INCOMPLETE_CHAIN_REQ_IDS','UNKNOWN_CHAIN_REQ_IDS','EVIDENCE_REPOSITORY_LOCATION','REPRODUCTION_INSTRUCTIONS','FINAL_EVIDENCE_CHAIN_DETERMINATION','CONTROLLING_EVIDENCE'],30:['DEFECT_REGISTRY_VERSION','REGRESSION_REGISTRY_VERSION','REGISTRY_STORAGE_LOCATION','REGISTRY_RETENTION_RULE','REGISTRY_IS_APPEND_ONLY','DEFECT_RECORDS','REGRESSION_RECORDS','FUTURE_BASELINE_REGRESSION_EXECUTION_RECORDS','TOTAL_DEFECT_RECORDS','TOTAL_CONFIRMED_DEFECTS_WITH_REGRESSION_TESTS','TOTAL_ACTIVE_REGRESSION_TESTS','TOTAL_RETIRED_REGRESSION_TESTS','DEFECT_RECORDS_MISSING_REQUIRED_FIELDS','CONFIRMED_DEFECTS_MISSING_REGRESSION_TESTS','REGISTRY_HASH_OR_INTEGRITY_EVIDENCE','FINAL_REGISTRY_DETERMINATION','CONTROLLING_EVIDENCE']};
const BASE_STAGE_OWNERSHIP=Object.freeze({
  "1": {
    "human": [
      "EXACT_USER_OBJECTIVE_VERBATIM",
      "SUPPLIED_MATERIALS_INVENTORY",
      "REQUIRED_OUTPUT_FORMAT",
      "DEADLINE_OR_TEMPORAL_SCOPE",
      "DESIRED_SOURCE_COUNT",
      "KNOWN_AUTHORITATIVE_SOURCES",
      "AVAILABLE_TOOLS",
      "PROHIBITED_ACTIONS",
      "EXPLICIT_USER_REQUIREMENTS"
    ],
    "humanDecision": [
      "JOB_TITLE",
      "JOB_OWNER"
    ],
    "agent": [
      "EXACT_DELIVERABLE_REQUESTED",
      "ASSUMPTIONS",
      "UNKNOWN_INFORMATION",
      "INPUT_SET_CONTENTS"
    ],
    "application": [
      "JOB_ID",
      "DATE_OPENED",
      "INPUT_SET_VERSION",
      "INPUT_SET_HASH_OR_MANIFEST",
      "JOB_RECORD_STATUS",
      "STATUS_EVIDENCE"
    ]
  },
  "2": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "AUTHORITY_HIERARCHY",
      "SOURCE_APPLICABILITY_DETERMINATION",
      "KNOWN_CONTROLLING_SOURCES_EXAMINED"
    ],
    "application": [
      "SOURCE_SET_VERSION",
      "SOURCE_RECORDS",
      "SOURCE_CONFLICT_RECORDS",
      "UNRESOLVED_CONTROLLING_CONFLICTS",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "3": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "EXCEPTIONS_AND_EDGE_CONDITIONS",
      "CONFLICTING_OR_INVALIDATING_MATERIAL",
      "RESEARCH_GAPS_AND_BLOCKERS",
      "SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED",
      "LATEST_PASS_NUMBER",
      "NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS"
    ],
    "application": [
      "RESEARCH_VERSION",
      "SOURCE_RESEARCH_RECORDS",
      "CANDIDATE_REQUIREMENT_RECORDS",
      "ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "4": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "DEFINED_TERM_GAPS",
      "CONDITIONAL_REQUIREMENTS",
      "OPTIONAL_REQUIREMENTS",
      "BLOCKED_REQUIREMENTS"
    ],
    "application": [
      "REQUIREMENTS_VERSION",
      "REQUIREMENT_RECORDS",
      "ATOMICITY_REVIEW_RESULTS",
      "TOTAL_REQUIREMENTS",
      "MANDATORY_REQUIREMENTS",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "5": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "DUPLICATES_REMAINING",
      "IMPOSSIBLE_COMBINATIONS",
      "UNDEFINED_TERMS",
      "CIRCULAR_DEPENDENCIES",
      "UNSUPPORTED_REQUIREMENTS",
      "APPLICABILITY_UNDETERMINED",
      "REQUIREMENTS_WITHOUT_VERIFICATION_PATH"
    ],
    "application": [
      "INPUT_REQUIREMENTS_VERSION",
      "OUTPUT_REQUIREMENTS_VERSION",
      "REQUIREMENT_DEFECT_RECORDS",
      "UNRESOLVED_CONFLICTS",
      "MISSING_PREREQUISITES",
      "MANDATORY_BLOCKERS",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "6": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "TEST_SUITE_VERSION",
      "TEST_RECORDS",
      "COVERAGE_RECORDS",
      "TOTAL_ACTIVE_MANDATORY_REQUIREMENTS",
      "ACTIVE_MANDATORY_REQUIREMENTS_WITH_AT_LEAST_ONE_READY_TEST",
      "MANDATORY_TEST_COVERAGE",
      "BLOCKED_MANDATORY_REQUIREMENTS",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "7": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "MUTATION_SUITE_VERSION",
      "FAILURE_TEST_RECORDS",
      "ACTIVE_REQUIREMENTS",
      "REQUIREMENTS_WITH_AT_LEAST_ONE_FAILURE_TEST",
      "FAILURE_TEST_COVERAGE",
      "INVALID_FIXTURES_ACCEPTED",
      "DEFECTIVE_VALIDATORS",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "8": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "OBJECTIVE",
      "AUTHORIZED_INPUTS",
      "INPUT_FAILURE_RULES",
      "SOURCE_AUTHORITY",
      "SCOPE",
      "DEFINED_TERMS",
      "REQUIRED_PROCEDURE_IN_ORDER",
      "DECISION_RULES",
      "TOOL_RULES",
      "OUTPUT_CONTRACT",
      "VERIFICATION_AND_FAILURE_HANDLING",
      "COMPLETION_CRITERIA"
    ],
    "application": [
      "DRAFT_INSTRUCTION_VERSION",
      "INSTRUCTION_TRACE_RECORDS",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "9": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "EVERY_SENTENCE_REVIEWED",
      "KNOWN_MATERIAL_AMBIGUITIES",
      "KNOWN_MATERIAL_CONFLICTS",
      "UNAVAILABLE_REQUIRED_CAPABILITIES",
      "UNVERIFIABLE_INSTRUCTIONS"
    ],
    "application": [
      "INPUT_INSTRUCTION_VERSION",
      "OUTPUT_INSTRUCTION_VERSION",
      "PREFLIGHT_REVIEWER_ID",
      "REVIEW_CONTEXT_INDEPENDENT_FROM_AUTHOR",
      "SENTENCE_REVIEW_RECORDS",
      "PREFLIGHT_ITERATION_RECORDS",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "10": {
    "human": [],
    "humanDecision": [
      "FREEZE_OWNER"
    ],
    "agent": [],
    "application": [
      "CANDIDATE_ID",
      "ITERATION_ID",
      "FREEZE_DATE",
      "FROZEN_COMPONENT_RECORDS",
      "TOOL_CONFIGURATION_RECORDS",
      "ALL_REQUIRED_COMPONENTS_PRESENT",
      "ALL_RUNS_WILL_RECEIVE_IDENTICAL_FROZEN_MATERIALS",
      "HASHES_RECORDED_WHERE_PRACTICAL",
      "CHANGES_ALLOWED_DURING_BATCH",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "11": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "FROZEN_EXECUTION_PACKAGE"
    ],
    "application": [
      "ITERATION_ID",
      "CANDIDATE_ID",
      "RUN_RECORDS",
      "FRESH_CONTEXTS_CREATED",
      "RUNS_RECEIVING_EXACT_PACKAGE",
      "CONTAMINATED_RUNS",
      "OUTPUTS_SAVED_SEPARATELY",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "12": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "ITERATION_ID",
      "RUNS",
      "REQUIREMENTS_VERSION",
      "TEST_SUITE_VERSION",
      "VERIFICATION_RECORDS",
      "ACTIVE_MANDATORY_REQUIREMENTS",
      "EXPECTED_MANDATORY_RECORDS",
      "ACTUAL_MANDATORY_RECORDS",
      "MISSING_RECORDS",
      "SATISFIED_RECORDS",
      "VIOLATED_RECORDS",
      "UNDETERMINED_RECORDS",
      "SELF_VALIDATED_RECORDS",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "13": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "ITERATION_ID",
      "COMPARISON_VERSION",
      "REQUIREMENT_COMPARISON_RECORDS",
      "REQUIREMENTS_SATISFIED_BY_ALL_TEN",
      "REQUIREMENTS_WITH_AT_LEAST_ONE_VIOLATION",
      "REQUIREMENTS_WITH_AT_LEAST_ONE_UNDETERMINED",
      "CORRECTNESS_AFFECTING_DISAGREEMENTS",
      "PROHIBITED_OUTPUT_VARIANCES",
      "INCONCLUSIVE_TESTS",
      "REPEATED_FAILURE_GROUPS",
      "UNIQUE_FAILURES",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "14": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "ROOT_CAUSE_ANALYSIS_VERSION",
      "DEFECT_ROOT_CAUSE_RECORDS",
      "TOTAL_MATERIAL_DEFECTS",
      "CONFIRMED_ROOT_CAUSES",
      "UNDETERMINED_ROOT_CAUSES",
      "BLOCKED_ANALYSES",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "15": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "INPUT_TEST_SUITE_VERSION",
      "OUTPUT_TEST_SUITE_VERSION",
      "REGRESSION_FIXTURE_VERSION",
      "REGRESSION_RECORDS",
      "CONFIRMED_DEFECTS",
      "CONFIRMED_DEFECTS_WITH_REGRESSION_TEST",
      "PRE_CORRECTION_FAILURES_PROVEN",
      "UNCONVERTED_CONFIRMED_DEFECTS",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "16": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "CHANGE_SET_ID",
      "TRIGGERING_DEFECT_IDS",
      "RCA_VERSION",
      "DATE",
      "ARTIFACT_CHANGE_RECORDS",
      "INSTRUCTION_CHANGED",
      "IF_EXECUTION_ONLY_DEFECT_WAS_INSTRUCTION_PRESERVED",
      "PREFLIGHT_REPEATED_IF_CHANGED",
      "ARTIFACTS_CHANGED",
      "NEW_VERSIONS_CREATED",
      "IN_PLACE_MODIFICATIONS",
      "DOWNSTREAM_VERIFICATIONS_INVALIDATED",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "17": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "PREVIOUS_ITERATION_ID",
      "NEW_ITERATION_ID",
      "PREVIOUS_CANDIDATE_ID",
      "NEW_CANDIDATE_ID",
      "CHANGESET_ID",
      "NEW_FROZEN_VERSIONS",
      "OLD_CONVERSATIONS_CONTINUED",
      "TEN_NEW_CONTEXTS_CREATED",
      "RUN_NAMESPACE",
      "IDENTICAL_PACKAGE_CONFIRMED_FOR_ALL_RUNS",
      "PRIOR_OUTPUTS_WITHHELD",
      "EXECUTE_COMPLETED",
      "VERIFY_COMPLETED",
      "COMPARE_COMPLETED",
      "ROOT_CAUSE_COMPLETED",
      "REGRESSION_TESTS_ADDED",
      "CORRECTIONS_COMPLETED",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "18": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "RETURN_STAGE_FOR_EACH_FAILURE"
    ],
    "application": [
      "ITERATION_ID",
      "REGRESSION_TEST_SUCCESS",
      "METRICS_VERSION",
      "TOTAL_MANDATORY_REQUIREMENTS",
      "MANDATORY_REQUIREMENTS_WITH_COMPLETE_SPECIFICATION_AND_APPLICABILITY",
      "MANDATORY_REQUIREMENT_COVERAGE",
      "MANDATORY_REQUIREMENTS_WITH_AFFIRMATIVE_APPLICABLE_VERIFICATION",
      "MANDATORY_VERIFICATION_COVERAGE",
      "TOTAL_STILL_APPLICABLE_REGRESSION_TESTS",
      "SUCCESSFUL_REGRESSION_TESTS",
      "CRITICAL_DEFECTS",
      "MAJOR_DEFECTS",
      "MANDATORY_UNRESOLVED_UNKNOWNS",
      "KNOWN_CORRECTNESS_AFFECTING_CONTRADICTIONS",
      "KNOWN_CORRECTNESS_AFFECTING_AMBIGUITIES",
      "UNEXPLAINED_CORRECTNESS_AFFECTING_EXECUTION_VARIANCE",
      "ALL_CONDITIONS_SIMULTANEOUSLY_TRUE",
      "FAILED_CONDITIONS",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "19": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "SOURCE_CONVERGED_ITERATION",
      "CONFIRMATION_ITERATION_ID",
      "ZERO_CHANGE_AUDIT",
      "TEN_NEW_CONTEXTS_CREATED",
      "SAME_FROZEN_PACKAGE_USED",
      "RUNS_COMPLETED",
      "ALL_REGRESSION_TESTS_RUN",
      "COMPLETE_TEST_SUITE_RUN",
      "CROSS_RUN_COMPARISON_COMPLETED",
      "NEW_CRITICAL_DEFECTS",
      "NEW_MAJOR_DEFECTS",
      "NEW_REQUIREMENTS_DISCOVERED",
      "INJECTED_DEFECTS_NOT_DETECTED",
      "NEW_CORRECTNESS_AFFECTING_VARIANCE",
      "CONFIRMATION_ACCEPTANCE_CRITERIA_SATISFIED",
      "REQUIRED_RETURN_STAGE",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "20": {
    "human": [],
    "humanDecision": [
      "BASELINE_OWNER"
    ],
    "agent": [
      "BASELINE_PACKAGE_SEPARATED_FROM_WORKING_FILES"
    ],
    "application": [
      "BASELINE_ID",
      "SUPPORTING_CONFIRMATION_ITERATION",
      "APPROVED_VERSIONS",
      "BASELINE_APPROVAL_DATE",
      "BASELINE_FILE_RECORDS",
      "UNCHANGED_CONFIRMATION_SUCCEEDED",
      "ALL_APPROVED_COMPONENTS_PRESENT",
      "ALL_IMMUTABLE_FILES_HASHED",
      "ANY_CHANGED_COMPONENT_RETAINS_BASELINE_STATUS",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "21": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "PRODUCTION_CONTEXT_REFERENCE",
      "FRESH_CONTEXT",
      "BASELINE_MATERIALS_SUPPLIED",
      "EXECUTION_RECORD",
      "EDITED_OUTSIDE_CONTROLLED_WORKFLOW",
      "EDIT_REQUIRED",
      "IF_YES_NEW_PRODUCT_VERSION_CREATED",
      "AFFECTED_VALIDATION_IDENTIFIED"
    ],
    "application": [
      "PRODUCT_ID",
      "PRODUCT_VERSION",
      "BASELINE_ID",
      "EXECUTION_ID",
      "OUTPUT_FILE_RECORDS",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "22": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "PRODUCT_ID",
      "PRODUCT_VERSION",
      "PRODUCT_HASHES_BEFORE_TEST",
      "TEST_SUITE_VERSION",
      "VALIDATOR_VERSION",
      "DETERMINISTIC_TEST_RESULTS",
      "EXECUTED",
      "SATISFIED",
      "VIOLATED",
      "UNDETERMINED",
      "MISSING_TEST_RESULTS",
      "APPLICABLE_MANDATORY_DETERMINISTIC_TESTS",
      "PRODUCT_REJECTED_BY_MANDATORY_FAILURE",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "23": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "PRODUCT_ID",
      "PRODUCT_VERSION",
      "REQUIREMENTS_VERSION",
      "MEANING_RUBRIC_VERSION",
      "EVALUATOR_ID",
      "MEANING_REQUIREMENT_RECORDS",
      "ACTIVE_MEANING_REQUIREMENTS",
      "MEANING_RECORDS_COMPLETED",
      "SATISFIED",
      "VIOLATED",
      "UNDETERMINED",
      "EVALUATOR_INDEPENDENT_FROM_GENERATOR",
      "UNSUPPORTED_BARE_CONCLUSIONS",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "24": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "PRODUCT_ID",
      "PRODUCT_VERSION",
      "ADVERSARIAL_REVIEW_VERSION",
      "REVIEWER_ID",
      "ADVERSARIAL_CHECK_RECORDS",
      "MANDATORY_DEFECTS_FOUND",
      "CRITICAL_DEFECTS_FOUND",
      "MAJOR_DEFECTS_FOUND",
      "REVIEWER_INDEPENDENT",
      "ATTACKS_EXECUTED",
      "UNDETERMINED_ATTACKS",
      "REGRESSIONS_FOUND",
      "RETURN_TO_ROOT_CAUSE_REQUIRED",
      "STAGE_DECISION",
      "DECISION_EVIDENCE"
    ]
  },
  "25": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "CONTROLLING_EVIDENCE"
    ],
    "application": [
      "PRODUCT_ID",
      "PRODUCT_VERSION",
      "REPRESENTATION_REVIEW_VERSION",
      "APPROVED_BASELINE_ID",
      "DELIVERY_ARTIFACT_INVENTORY",
      "TRANSFORMATION_CHAIN_RECORDS",
      "PAGE_OR_VIEW_INSPECTION_RECORDS",
      "PACKAGE_INSPECTION_RECORDS",
      "TOTAL_DELIVERY_ARTIFACTS",
      "TOTAL_PAGES_OR_VIEWS_REQUIRED",
      "TOTAL_PAGES_OR_VIEWS_INSPECTED",
      "TOTAL_PACKAGED_FILES_REQUIRED",
      "TOTAL_PACKAGED_FILES_OPENED_OR_TESTED",
      "UNRESOLVED_CRITICAL_DEFECTS",
      "UNRESOLVED_MAJOR_DEFECTS",
      "UNRESOLVED_REPRESENTATION_UNKNOWNS",
      "FINAL_REPRESENTATION_DETERMINATION"
    ]
  },
  "26": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "PROCESS_REVIEW",
      "PROCESS_CORRECTNESS_DETERMINATION",
      "PROCESS_EVIDENCE",
      "PRODUCT_REVIEW",
      "PRODUCT_CORRECTNESS_DETERMINATION",
      "PRODUCT_EVIDENCE",
      "PROCESS_PRODUCT_DISCREPANCIES",
      "RECONCILED_DETERMINATION",
      "CONTROLLING_REASON",
      "CONTROLLING_EVIDENCE"
    ],
    "application": [
      "PRODUCT_ID",
      "PRODUCT_VERSION",
      "BASELINE_ID",
      "REVIEW_VERSION",
      "MISSING_EVIDENCE_LINKS",
      "RECONCILIATION_DEFECT_IDS",
      "RECONCILIATION_BLOCKER_IDS"
    ]
  },
  "27": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "RELEASE_GATE_ID",
      "DATE_AND_TIME",
      "PRODUCT_ID",
      "PRODUCT_VERSION",
      "BASELINE_ID",
      "RECONCILED_REVIEW_VERSION",
      "TOTAL_MANDATORY_REQUIREMENTS",
      "MANDATORY_REQUIREMENTS_WITH_AFFIRMATIVE_SUPPORTING_EVIDENCE",
      "MANDATORY_REQUIREMENTS_DEMONSTRABLY_VIOLATED",
      "MANDATORY_REQUIREMENTS_NOT_ESTABLISHED",
      "TOTAL_MANDATORY_VALIDATORS",
      "MANDATORY_VALIDATORS_SUCCEEDED",
      "MANDATORY_VALIDATORS_FAILED",
      "MANDATORY_VALIDATORS_UNDETERMINED_OR_NOT_RUN",
      "UNRESOLVED_CRITICAL_DEFECTS",
      "UNRESOLVED_MAJOR_DEFECTS",
      "BLOCKING_REQUIREMENT_IDS",
      "VIOLATED_REQUIREMENT_IDS",
      "FAILED_TEST_IDS",
      "UNDETERMINED_OR_MISSING_TEST_IDS",
      "UNRESOLVED_DEFECT_IDS",
      "BLOCKER_IDS",
      "SELECTED_RELEASE_STATE",
      "CONTROLLING_DECISION_RULE",
      "CONTROLLING_REASON",
      "AFFIRMATIVE_EVIDENCE"
    ]
  },
  "28": {
    "human": [],
    "humanDecision": [
      "HASH_OPERATOR",
      "EXACT_AUTHORIZED_ARTIFACT_IDS",
      "EXACT_AUTHORIZED_FILENAMES",
      "AUTHORIZED_BY"
    ],
    "agent": [],
    "application": [
      "HASH_REVIEW_ID",
      "RELEASE_GATE_STATE",
      "RELEASE_GATE_ID",
      "HASH_ALGORITHM",
      "HASH_TOOL_AND_VERSION",
      "ARTIFACT_HASH_RECORDS",
      "TOTAL_ARTIFACTS_REQUIRED_FOR_RELEASE",
      "TOTAL_ARTIFACTS_WITH_AUDITED_HASH",
      "TOTAL_ARTIFACTS_REHASHED_IMMEDIATELY_BEFORE_DELIVERY",
      "TOTAL_EXACT_HASH_MATCHES",
      "TOTAL_HASH_MISMATCHES",
      "TOTAL_UNKNOWN_HASH_COMPARISONS",
      "ALL_RELEASE_HASHES_EQUAL_AUDITED_HASHES",
      "ANY_POST_REVIEW_MODIFICATION",
      "DELIVERY_AUTHORIZATION",
      "AUTHORIZATION_EVIDENCE",
      "AUTHORIZATION_DATE_AND_TIME"
    ]
  },
  "29": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "EVIDENCE_REPOSITORY_LOCATION",
      "REPRODUCTION_INSTRUCTIONS",
      "CONTROLLING_EVIDENCE"
    ],
    "application": [
      "EVIDENCE_CHAIN_VERSION",
      "JOB_ID",
      "PRODUCT_ID",
      "PRODUCT_VERSION",
      "BASELINE_ID",
      "RELEASE_GATE_ID",
      "HASH_REVIEW_ID",
      "MANDATORY_REQUIREMENT_EVIDENCE_CHAIN_RECORDS",
      "TOTAL_MANDATORY_REQUIREMENTS",
      "TOTAL_MANDATORY_REQUIREMENTS_WITH_COMPLETE_CHAINS",
      "TOTAL_MANDATORY_REQUIREMENTS_WITH_INCOMPLETE_CHAINS",
      "TOTAL_MANDATORY_REQUIREMENTS_WITH_UNKNOWN_CHAIN_LINKS",
      "MANDATORY_EVIDENCE_CHAIN_COVERAGE",
      "ALL_MANDATORY_EVIDENCE_CHAINS_COMPLETE",
      "INCOMPLETE_CHAIN_REQ_IDS",
      "UNKNOWN_CHAIN_REQ_IDS",
      "FINAL_EVIDENCE_CHAIN_DETERMINATION"
    ]
  },
  "30": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "REGISTRY_STORAGE_LOCATION",
      "REGISTRY_RETENTION_RULE",
      "REGISTRY_HASH_OR_INTEGRITY_EVIDENCE",
      "CONTROLLING_EVIDENCE"
    ],
    "application": [
      "DEFECT_REGISTRY_VERSION",
      "REGRESSION_REGISTRY_VERSION",
      "REGISTRY_IS_APPEND_ONLY",
      "DEFECT_RECORDS",
      "REGRESSION_RECORDS",
      "FUTURE_BASELINE_REGRESSION_EXECUTION_RECORDS",
      "TOTAL_DEFECT_RECORDS",
      "TOTAL_CONFIRMED_DEFECTS_WITH_REGRESSION_TESTS",
      "TOTAL_ACTIVE_REGRESSION_TESTS",
      "TOTAL_RETIRED_REGRESSION_TESTS",
      "DEFECT_RECORDS_MISSING_REQUIRED_FIELDS",
      "CONFIRMED_DEFECTS_MISSING_REGRESSION_TESTS",
      "FINAL_REGISTRY_DETERMINATION"
    ]
  }
});
const completionField=(owner,valueType='STRING',enumValues=[])=>Object.freeze({owner,valueType,enumValues:Object.freeze([...enumValues]),nullable:false,normalizerKey:null,closedProperties:null});
const app=(valueType='STRING',enumValues=[])=>completionField('application',valueType,enumValues);
const agent=(valueType='STRING',enumValues=[])=>completionField('agent',valueType,enumValues);
const decision=(valueType='STRING',enumValues=[])=>completionField('humanDecision',valueType,enumValues);
const CONTROLLING_COMPLETION_STAGE_FIELD_DEFINITIONS=Object.freeze({
  1:Object.freeze({SEMANTIC_CHALLENGE_REQUIRED:app('BOOLEAN'),SEMANTIC_CHALLENGE_STATUS:app(),CHALLENGE_CONTEXT_IDS:app('REFERENCE_ARRAY'),CHALLENGE_FINDING_RECORDS:app('OBJECT_ARRAY'),UNRESOLVED_OMISSION_CHALLENGES:app('INTEGER'),DISCLOSURE_CLASSIFICATION_SUMMARY:app('OBJECT'),PROMPT_INJECTION_BOUNDARY_APPLIED:app('BOOLEAN')}),
  2:Object.freeze({SOURCE_SEARCH_CONTRACT_ID:app(),SEARCH_UNIVERSE:agent('OBJECT'),SEARCH_PROCEDURE:agent(),SEARCH_LOCATIONS:agent('STRING_ARRAY'),SEARCH_QUERIES_OR_STRATEGIES:agent('STRING_ARRAY'),SEARCH_CUTOFF:agent(),SEARCH_LIMITATIONS:agent(),SEARCH_EXECUTION_EVIDENCE:agent('REFERENCE_ARRAY'),DISCOVERY_RISK:agent(),SEARCH_ADEQUACY_REVIEW_ID:app('REFERENCE'),SOURCE_AUTHENTICITY_SUMMARY:app('OBJECT'),SOURCE_FRESHNESS_SUMMARY:app('OBJECT')}),
  3:Object.freeze({SOURCE_AUTHENTICITY_REFERENCES:agent('REFERENCE_ARRAY'),SOURCE_FRESHNESS_REFERENCES:agent('REFERENCE_ARRAY'),TIME_SENSITIVE_FINDINGS:agent('OBJECT_ARRAY'),SUPERSEDED_MATERIAL:agent('OBJECT_ARRAY'),RESEARCH_EPISTEMIC_LIMITATIONS:agent()}),
  4:Object.freeze({PROPOSITION_RECORDS:app('REFERENCE_ARRAY'),PROPOSITION_MAPPING_RECORDS:app('OBJECT_ARRAY'),PROPOSED_NORMATIVE_CLASSIFICATIONS:agent('OBJECT_ARRAY'),CONDITIONAL_ACTIVATION_PROPOSITIONS:agent('OBJECT_ARRAY'),PROPOSED_APPLICABILITY_RECORDS:agent('OBJECT_ARRAY'),OBLIGATION_DISPOSITION_CHALLENGE_RECORDS:app('REFERENCE_ARRAY'),ATOMICITY_CHALLENGE_RECORDS:app('REFERENCE_ARRAY'),UNRESOLVED_SEMANTIC_CHALLENGES:app('INTEGER')}),
  5:Object.freeze({PROPOSITION_EQUIVALENCE_REVIEWS:app('REFERENCE_ARRAY'),NORMATIVE_CLASSIFICATION_REVIEWS:app('REFERENCE_ARRAY'),APPLICABILITY_DETERMINATIONS:app('REFERENCE_ARRAY'),CONDITIONAL_ACTIVATION_REVIEWS:app('REFERENCE_ARRAY'),ATOMICITY_RESOLUTION_RECORDS:app('REFERENCE_ARRAY'),PROOF_STRUCTURE_GAPS:agent('OBJECT_ARRAY'),RELEASE_OBLIGATION_REDUCTION_REVIEWS:app('REFERENCE_ARRAY')}),
  6:Object.freeze({PROOF_OBLIGATION_SET_ID:app(),PROOF_OBLIGATION_RECORDS:app('REFERENCE_ARRAY'),PROOF_EXPRESSION_RECORDS:app('REFERENCE_ARRAY'),TEST_PROPOSITION_RECORDS:app('REFERENCE_ARRAY'),TEST_SEMANTIC_COVERAGE_RECORDS:app('OBJECT_ARRAY'),TEST_ROLE_RECORDS:app('OBJECT_ARRAY'),RELEASE_BEARING_TESTS:app('REFERENCE_ARRAY'),EXPECTED_VARIANCE_CONTRACTS:app('OBJECT_ARRAY'),REQUIRED_EPISTEMIC_BASES:app('OBJECT_ARRAY'),REQUIRED_ENVIRONMENT_DEPENDENCIES:app('REFERENCE_ARRAY'),SEMANTIC_EQUIVALENCE_BLOCKERS:app('REFERENCE_ARRAY')}),
  7:Object.freeze({FAILURE_TEST_AVAILABILITY_CLASS:app('OBJECT_ARRAY'),DEFERRED_EXECUTION_TRIGGER_STAGE:app('OBJECT_ARRAY'),DEFERRED_EXECUTION_PLAN:app('OBJECT_ARRAY'),DEFERRED_FAILURE_TEST_IDS:app('REFERENCE_ARRAY'),EXECUTABLE_NOW_FAILURE_TEST_IDS:app('REFERENCE_ARRAY'),FAILURE_OBSERVATION_IDS:app('REFERENCE_ARRAY'),FAILURE_ENTAILMENT_RECORDS:app('REFERENCE_ARRAY')}),
  8:Object.freeze({ENVIRONMENT_DEPENDENCY_INSTRUCTIONS:agent(),DISCLOSURE_AND_SECRET_HANDLING_RULES:agent(),DEFERRED_NEGATIVE_TEST_TRACE_RECORDS:agent('OBJECT_ARRAY')}),
  9:Object.freeze({INDEPENDENCE_DIMENSION_RECORDS:app('OBJECT_ARRAY'),PROVIDER_CONTEXT_INDEPENDENCE_STATUS:app(),APPLICATION_INPUT_ISOLATION_STATUS:app(),ENVIRONMENT_ASSUMPTION_FINDINGS:agent('OBJECT_ARRAY'),PROOF_OBLIGATION_TRACE_FINDINGS:agent('OBJECT_ARRAY'),DISCLOSURE_FINDINGS:agent('OBJECT_ARRAY')}),
  10:Object.freeze({PROOF_OBLIGATION_SET_ID:app(),ENVIRONMENT_MANIFEST_ID:app('REFERENCE'),EXTERNAL_DEPENDENCY_SET_ID:app(),DISCLOSURE_POLICY_ID:app(),FREEZE_INTEGRITY_BASIS:app(),EXTERNAL_CHECKPOINT_ID:app('REFERENCE')}),
  11:Object.freeze({APPLICATION_SESSION_DISTINCTNESS:app(),APPLICATION_INPUT_ISOLATION:app(),USER_TRANSFER_CONFORMITY:app(),PROVIDER_CONTEXT_INDEPENDENCE:app(),INDEPENDENCE_LIMITATIONS:app('STRING_ARRAY'),ENVIRONMENT_MANIFESTS:app('REFERENCE_ARRAY'),EXPECTED_VARIANCE_CONTRACT_ID:app('REFERENCE'),OPERATION_RESERVATION_IDS:app('REFERENCE_ARRAY'),PACKAGE_IDS:app('REFERENCE_ARRAY'),CHALLENGE_NONCES:app('STRING_ARRAY'),INPUT_BINDING_BASES:app('STRING_ARRAY')}),
  12:Object.freeze({REQUIRED_VERIFICATION_RELATION_SET_ID:app(),REQUIRED_RELATION_TUPLES:app('OBJECT_ARRAY'),PROPOSITION_IDS:app('REFERENCE_ARRAY'),OBSERVATION_IDS:app('REFERENCE_ARRAY'),ENTAILMENT_RELATION_IDS:app('REFERENCE_ARRAY'),EPISTEMIC_BASES:app('STRING_ARRAY'),FRESHNESS_STATUSES:app('STRING_ARRAY'),INDEPENDENCE_DIMENSION_RECORDS:app('OBJECT_ARRAY'),INPUT_BINDING_BASES:app('STRING_ARRAY')}),
  13:Object.freeze({EXPECTED_VARIANCE_CONTRACT_IDS:app('REFERENCE_ARRAY'),ALLOWED_VARIANCES:app('OBJECT_ARRAY'),PROHIBITED_VARIANCES:app('OBJECT_ARRAY'),UNKNOWN_VARIANCES:app('OBJECT_ARRAY'),ENVIRONMENT_DIFFERENCE_RECORDS:app('OBJECT_ARRAY'),PROPOSITION_STABILITY:app('OBJECT')}),
  14:Object.freeze({AFFECTED_PROPOSITION_IDS:app('REFERENCE_ARRAY'),AFFECTED_PROOF_OBLIGATION_IDS:app('REFERENCE_ARRAY'),PROPOSED_SEVERITY:agent('STRING',['CRITICAL','MAJOR','MINOR','UNKNOWN']),SEVERITY_REVIEW_ID:app('REFERENCE'),ACCEPTED_SEVERITY:app('STRING',['CRITICAL','MAJOR','MINOR','UNKNOWN']),SEVERITY_DISPUTE_STATUS:app()}),
  15:Object.freeze({PROPOSITION_IDS:app('REFERENCE_ARRAY'),PROOF_OBLIGATION_IDS:app('REFERENCE_ARRAY'),PRE_CORRECTION_OBSERVATION_IDS:app('REFERENCE_ARRAY'),PRE_CORRECTION_ENTAILMENT_IDS:app('REFERENCE_ARRAY'),POST_CORRECTION_OBSERVATION_IDS:app('REFERENCE_ARRAY'),POST_CORRECTION_ENTAILMENT_IDS:app('REFERENCE_ARRAY'),RETIREMENT_STATUS:app(),RETIREMENT_AUTHORITY_AND_EVIDENCE:app('OBJECT')}),
  16:Object.freeze({CORRECTION_SET_ID:app(),AFFECTED_RECORD_FAMILIES:app('STRING_ARRAY'),EARLIEST_RESPONSIBLE_STAGE:app('INTEGER'),RESPONSIBLE_STAGE_MAP_VERSION:app(),ATOMIC_CHANGE_MEMBERS:app('REFERENCE_ARRAY'),PROOF_OBLIGATIONS_INVALIDATED:app('REFERENCE_ARRAY'),DELIVERY_RECORDS_SUPERSEDED_OR_WITHDRAWN:app('REFERENCE_ARRAY')}),
  17:Object.freeze({PROOF_OBLIGATION_SET_ID:app(),REQUIRED_VERIFICATION_RELATION_SET_ID:app(),ENVIRONMENT_MANIFEST_SET_ID:app(),INDEPENDENCE_DIMENSION_SUMMARY:app('OBJECT'),EXPECTED_VARIANCE_SUMMARY:app('OBJECT'),DEFERRED_FAILURE_TEST_EXECUTIONS:app('REFERENCE_ARRAY')}),
  18:Object.freeze({TOTAL_MANDATORY_PROPOSITIONS:app('INTEGER'),SATISFIED_MANDATORY_PROPOSITIONS:app('INTEGER'),PROOF_OBLIGATION_COVERAGE:app('NUMBER'),UNKNOWN_APPLICABILITY_COUNT:app('INTEGER'),UNKNOWN_EQUIVALENCE_COUNT:app('INTEGER'),UNKNOWN_ENTAILMENT_COUNT:app('INTEGER'),EXPIRED_OR_UNKNOWN_FRESHNESS_COUNT:app('INTEGER'),DUE_DEFERRED_TESTS_INCOMPLETE:app('INTEGER'),EVIDENCE_CYCLE_COUNT:app('INTEGER'),UNRESOLVED_SEMANTIC_CHALLENGES:app('INTEGER')}),
  19:Object.freeze({CONFIRMATION_REQUIREMENT_CHALLENGE_COMPLETED:app('BOOLEAN'),NEW_REQUIREMENT_CANDIDATES_FOUND:app('INTEGER'),NEW_REQUIREMENT_CANDIDATE_IDS:app('REFERENCE_ARRAY'),CHALLENGE_SCOPE:app('OBJECT'),CHALLENGE_EPISTEMIC_BASIS:app(),PROVIDER_CONTEXT_INDEPENDENCE_SUMMARY:app('OBJECT'),ENVIRONMENT_COMPARABILITY_SUMMARY:app('OBJECT')}),
  20:Object.freeze({PROOF_OBLIGATION_SET_ID:app(),ENVIRONMENT_DEPENDENCY_SET_ID:app(),BACKUP_CHECKPOINT_ID:app('REFERENCE'),BASELINE_INTEGRITY_BASIS:app(),BASELINE_EXTERNAL_AUTHENTICATION_STATUS:app()}),
  21:Object.freeze({PRODUCT_ENVIRONMENT_MANIFEST_ID:app('REFERENCE'),PRODUCT_EXTERNAL_DEPENDENCY_SET_ID:app(),PRODUCT_DISCLOSURE_CLASSIFICATION:app(),PACKAGE_ID:app('REFERENCE'),OPERATION_RESERVATION_ID:app('REFERENCE'),CHALLENGE_NONCE:app(),INPUT_BINDING_BASIS:app()}),
  22:Object.freeze({PROPOSITION_IDS:app('REFERENCE_ARRAY'),PROOF_OBLIGATION_IDS:app('REFERENCE_ARRAY'),OBSERVATION_ORIGINS:app('STRING_ARRAY'),OBSERVATION_IDS:app('REFERENCE_ARRAY'),ENTAILMENT_RELATION_IDS:app('REFERENCE_ARRAY'),EPISTEMIC_BASES:app('STRING_ARRAY'),INPUT_BINDING_BASES:app('STRING_ARRAY'),RUNTIME_BUILD_IDENTITY:app(),TEST_WORKER_SHA256:app(),PARSER_OR_ADAPTER_IDENTITIES:app('STRING_ARRAY'),ENVIRONMENT_MANIFEST_IDS:app('REFERENCE_ARRAY'),FRESHNESS_STATUSES:app('STRING_ARRAY')}),
  23:Object.freeze({PROPOSITION_IDS:app('REFERENCE_ARRAY'),OBSERVATION_IDS:app('REFERENCE_ARRAY'),ENTAILMENT_RELATION_IDS:app('REFERENCE_ARRAY'),EPISTEMIC_BASES:app('STRING_ARRAY'),FRESHNESS_STATUSES:app('STRING_ARRAY'),INDEPENDENCE_DIMENSION_RECORDS:app('OBJECT_ARRAY'),BLINDNESS_DIMENSION_RECORDS:app('OBJECT_ARRAY'),RESIDUAL_CONTEXT_RISK:app()}),
  24:Object.freeze({TARGET_PROPOSITION_IDS:app('REFERENCE_ARRAY'),TARGET_PROOF_OBLIGATION_IDS:app('REFERENCE_ARRAY'),TARGET_REGRESSION_IDS:app('REFERENCE_ARRAY'),OBSERVATION_IDS:app('REFERENCE_ARRAY'),ENTAILMENT_RELATION_IDS:app('REFERENCE_ARRAY'),EPISTEMIC_BASES:app('STRING_ARRAY'),BLINDNESS_DIMENSION_RECORDS:app('OBJECT_ARRAY'),INDEPENDENCE_DIMENSION_RECORDS:app('OBJECT_ARRAY')}),
  25:Object.freeze({INSPECTION_RESERVATION_ID:app('REFERENCE'),INSPECTED_ARTIFACT_IDS:app('REFERENCE_ARRAY'),INSPECTED_ARTIFACT_SHA256_VALUES:app('STRING_ARRAY'),VIEWER_IDENTITY_AND_VERSION:app(),OBSERVATION_IDS:app('REFERENCE_ARRAY'),ENTAILMENT_RELATION_IDS:app('REFERENCE_ARRAY'),INPUT_BINDING_BASIS:app(),HUMAN_IDENTITY_ASSURANCE:app()}),
  26:Object.freeze({PROOF_OBLIGATION_SET_ID:app(),PROPOSITION_RECONCILIATION:app('OBJECT'),APPLICABILITY_RECONCILIATION:app('OBJECT'),EQUIVALENCE_RECONCILIATION:app('OBJECT'),ENTAILMENT_RECONCILIATION:app('OBJECT'),FRESHNESS_RECONCILIATION:app('OBJECT'),ENVIRONMENT_DEPENDENCY_RECONCILIATION:app('OBJECT'),EVIDENCE_CYCLE_FINDINGS:app('OBJECT_ARRAY')}),
  27:Object.freeze({PRODUCT_RELEASE_ELIGIBILITY:app('BOOLEAN'),PROOF_OBLIGATION_SET_ID:app(),TOTAL_MANDATORY_PROPOSITIONS:app('INTEGER'),SATISFIED_MANDATORY_PROPOSITIONS:app('INTEGER'),VIOLATED_MANDATORY_PROPOSITIONS:app('INTEGER'),UNDETERMINED_MANDATORY_PROPOSITIONS:app('INTEGER'),UNKNOWN_APPLICABILITY_IDS:app('REFERENCE_ARRAY'),INSUFFICIENT_EPISTEMIC_BASIS_IDS:app('REFERENCE_ARRAY'),EXPIRED_EVIDENCE_IDS:app('REFERENCE_ARRAY'),DUE_DEFERRED_TEST_IDS:app('REFERENCE_ARRAY'),DEPENDENCY_BLOCKER_IDS:app('REFERENCE_ARRAY'),RELEASE_EVIDENCE_GRAPH_ACYCLIC:app('BOOLEAN')}),
  28:Object.freeze({DELIVERY_ARTIFACT_IDENTITY_VERIFIED:app('BOOLEAN'),HUMAN_DELIVERY_INTENT:decision('BOOLEAN'),HUMAN_DELIVERY_AUTHORIZATION_ID:app(),DELIVERY_AUTHORIZATION_EFFECTIVE:app('BOOLEAN'),FILENAME_NORMALIZATION_VERSION:app(),FORMAT_INTERPRETATION_RECORDS:app('OBJECT_ARRAY'),CURRENT_BYTE_REVERIFICATION_RECEIPT:app('REFERENCE')}),
  29:Object.freeze({PROOF_OBLIGATION_SET_ID:app(),PROPOSITION_CHAIN_RECORDS:app('OBJECT_ARRAY'),OBSERVATION_AND_ENTAILMENT_LINKS:app('OBJECT_ARRAY'),EPISTEMIC_BASIS_COVERAGE:app('NUMBER'),FRESHNESS_COVERAGE:app('NUMBER'),ENVIRONMENT_DEPENDENCY_COVERAGE:app('NUMBER'),EVIDENCE_CHAIN_SET_SHA256:app(),JUSTIFICATION_CYCLE_COUNT:app('INTEGER'),DELIVERY_AUTHORIZATION_EFFECTIVE:app('BOOLEAN')}),
  30:Object.freeze({REGRESSION_RETIREMENT_RECORDS:app('REFERENCE_ARRAY'),REGISTRY_INTEGRITY_STATUS:app(),REGISTRY_INTEGRITY_HASH:app(),TERMINAL_PROOF_OBLIGATION_SET_HASH:app(),DELIVERY_ID:app('REFERENCE'),DELIVERY_STATE:app('STRING',['AUTHORIZED','BLOCKED','WITHDRAWN_FOR_FUTURE_USE','SUPERSEDED']),DELIVERY_RECORD_HASH:app(),DELIVERY_AUTHORIZATION_EFFECTIVE:app('BOOLEAN'),SUPERSEDED_OR_WITHDRAWN_DELIVERY_IDS:app('REFERENCE_ARRAY'),POST_RELEASE_REENTRY_STATE:app('OBJECT')})
});
const CONTROLLING_COMPLETION_GATE_ADDITIONS=Object.freeze({
  1:['Every required semantic challenge is complete and every material omission disagreement is resolved','Disclosure classification and the prompt-injection boundary are recorded'],
  2:['Source completeness is bounded to the current source-search contract','A no-applicable-source determination meets the bounded-search and independent-adequacy contract'],
  3:['Every research finding records applicable source-authenticity, freshness, supersession, and epistemic limitations'],
  4:['Every normative requirement has one primary proposition','Every required disposition and atomicity challenge is resolved or blocked'],
  5:['Normative classification, applicability, activation, atomicity, equivalence, and proof-structure disputes are resolved or blocked'],
  6:['Every current applicable mandatory proposition has exactly one proof obligation and an accepted proof expression','Structural Test IR validity is never substituted for semantic equivalence'],
  7:['Every executable-now failure test ran and every deferred target-dependent test has a complete future execution contract'],
  8:['The production instruction covers every current environment dependency, disclosure restriction, and deferred negative-test obligation'],
  9:['Every required independence dimension is recorded at its actual basis and proof, environment, and disclosure assumptions were reviewed'],
  10:['The candidate freeze binds the current proof-obligation set, environment/dependency manifest, disclosure policy, and integrity basis'],
  11:['Application isolation dimensions are established and provider-context independence is recorded only at its actual epistemic basis'],
  12:['Every tuple in the application-derived required verification relation set has exactly one current valid verification'],
  13:['Every comparison applies the pre-frozen expected-variance contract; allowed, prohibited, and unknown variance remain distinct'],
  14:['Every defect links affected propositions and proof obligations, with reviewed severity that cannot override mandatory proposition truth'],
  15:['Every regression has distinct pre- and post-correction observations and entailment, with controlled active/superseded/retired status'],
  16:['One minimal complete correction set uses the shared responsible-stage map and invalidates every affected proof obligation and delivery state'],
  17:['Every rerun suboperation uses the same proof, independence, variance, environment, evidence, reservation, and idempotency rules as its native stage'],
  18:['Every applicable mandatory proposition and proof obligation is satisfied with no required unknown or evidence cycle'],
  19:['The bounded independent requirement-discovery challenge is complete'],
  20:['The baseline is an application-immutable content-addressed snapshot with explicit integrity and backup basis'],
  21:['The product binds exact baseline inputs, environment/dependencies, disclosure classification, operation reservation, and actual input-binding basis'],
  22:['Every deterministic result binds a current proposition/proof leaf, observation, entailment, runtime/worker bytes, inputs, environment, freshness, and actual origin basis'],
  23:['Every meaning result has an attributable semantic observation and accepted entailment, with dimensioned independence, blindness, and residual context risk'],
  24:['Every adversarial finding targets a current proposition, proof obligation, or regression and preserves its evidence, independence, and blindness basis'],
  25:['Every inspection is reserved against exact artifact bytes and records the actual viewer and input-binding basis'],
  26:['Reconciliation covers proposition truth, applicability, equivalence, entailment, freshness, dependencies, and evidence cycles rather than counts alone'],
  27:['ACCEPTED means product release eligibility only; it is not final delivery authorization'],
  28:['Artifact identity and human delivery intent are recorded, while effective delivery authorization remains false'],
  29:['Every current proof-obligation chain is acyclic, current, fresh, and sufficient; delivery remains unauthorized'],
  30:['Registry integrity is complete and the application creates a terminal delivery record only when every prerequisite is simultaneously current and satisfied']
});
const RESULT_OVERRIDES=Object.freeze({
  2:'Identify and disposition every source within a bounded, evidenced source-search contract without claiming universal source completeness.',
  11:'Execute the same frozen candidate in exactly ten application-reserved contexts and record each independence dimension at its actual epistemic basis.',
  12:'Verify every tuple in the current application-derived proposition, requirement, run, and test relation set with sufficient observation and entailment evidence.',
  20:'Create the application-immutable, content-addressed approved production baseline only after unchanged confirmation succeeds.',
  27:'Calculate whether the product is eligible for final delivery checks; this is not final delivery authorization.',
  28:'Verify exact delivery-artifact identity and record human delivery intent without making delivery authorization effective.',
  29:'Prove current mandatory evidence-chain closure; this does not authorize delivery.',
  30:'Preserve permanent defect and regression history, verify registry integrity, and derive the final delivery record only when every terminal prerequisite is satisfied.'
});
const HUMAN_OPERATOR_CHECKLISTS=Object.freeze({
  10:Object.freeze(['Select the exact files that make up the candidate when the application presents the candidate-freeze action.']),
  20:Object.freeze(['Authorize the exact production baseline only after the application presents the current unchanged-confirmation evidence.']),
  28:Object.freeze(['Select the exact delivery artifacts and record delivery intent; the application keeps final delivery authorization ineffective until Stage 30.'])
});
const STAGE_OWNERSHIP=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,index)=>{const stage=index+1,base=BASE_STAGE_OWNERSHIP[stage],additions=CONTROLLING_COMPLETION_STAGE_FIELD_DEFINITIONS[stage]||{},parts={human:[...base.human],humanDecision:[...base.humanDecision],agent:[...base.agent],application:[...base.application]};for(const[name,definition]of Object.entries(additions)){if(!parts[definition.owner].includes(name))parts[definition.owner].push(name);}return[stage,Object.freeze(Object.fromEntries(Object.entries(parts).map(([owner,names])=>[owner,Object.freeze(names)])))];})));
const STAGES=Object.freeze(titles.map((title,i)=>{const number=i+1,added=Object.keys(CONTROLLING_COMPLETION_STAGE_FIELD_DEFINITIONS[number]||{}),stageFields=Object.freeze([...new Set([...(fields[number]||[]),...added])]),completionGate=Object.freeze([...new Set([...(gate[number]||[]),...(CONTROLLING_COMPLETION_GATE_ADDITIONS[number]||[])])]);return Object.freeze({number,title,result:RESULT_OVERRIDES[number]||results[i],role:roles[i],humanChecklist:HUMAN_OPERATOR_CHECKLISTS[number]||Object.freeze([]),completionGate,evidenceToPreserve:Object.freeze([`Complete Stage ${String(number).padStart(2,'0')} record`,`Exact files, results, decisions, defects, blockers, and identity evidence used at Stage ${String(number).padStart(2,'0')}`]),fields:stageFields,ownership:STAGE_OWNERSHIP[number]});}));
const APPENDICES=Object.freeze({A:{title:'Fresh context record',idField:'CONTEXT_ID',fields:['JOB_ID','STAGE','ROLE','ITERATION_ID','RUN_ID','CONTEXT_ID','CONTEXT_NAME','CONTEXT_START_DATE_AND_TIME','STAGE_COPY_BLOCK_VERSION_OR_HASH','AUTHORIZED_FILES_AND_VERSIONS_ATTACHED','FROZEN_INPUT_VERSION','FROZEN_SOURCE_SET_VERSION','FROZEN_REQUIREMENTS_VERSION','FROZEN_INSTRUCTION_VERSION','FROZEN_TEST_SUITE_VERSION','FROZEN_TOOL_CONFIGURATION_VERSION','OTHER_RUN_OUTPUT_VISIBLE','REVIEWER_COMMENT_VISIBLE','PRIOR_FAILURE_EXPLANATION_VISIBLE','PROPOSED_CORRECTION_VISIBLE','REQUIRED_TOOLS_AVAILABLE','EXECUTION_DEVIATIONS','OUTPUT_ID','OUTPUT_FILENAME','OUTPUT_VERSION','OUTPUT_SHA256','CONTEXT_CONTAMINATED','DEFECT_ID','RUN_USABLE','CONTROLLING_EVIDENCE']},B:{title:'Blocker record',idField:'BLOCKER_ID',fields:['BLOCKER_ID','JOB_ID','DATE_OPENED','CURRENT_STATUS','STAGE_DISCOVERED','AFFECTED_REQ_IDS','AFFECTED_TEST_IDS','AFFECTED_ARTIFACTS_AND_VERSIONS','MISSING_ITEM_TYPE','MISSING_EVIDENCE_AUTHORITY_INPUT_OR_CAPABILITY','WHY_MANDATORY_SATISFACTION_CANNOT_BE_ESTABLISHED','KNOWN_SOURCE_OR_OWNER_OF_MISSING_ITEM','ATTEMPTS_TO_RESOLVE','AVAILABLE_RESOLUTION_PATH','DOWNSTREAM_WORK_STOPPED','BLOCKER_OWNER','TARGET_RESOLUTION_DATE','RESOLUTION','RESOLUTION_EVIDENCE','DATE_RESOLVED','REQUIREMENTS_AND_TESTS_REEVALUATED','DOWNSTREAM_VALIDATION_RERUN','CLOSURE_AUTHORIZED_BY']},C:{title:'Change and invalidation record',idField:'CHANGE_ID',fields:['CHANGE_ID','DATE_AND_TIME','JOB_ID','ITERATION_ID','TRIGGER','EARLIEST_RESPONSIBLE_LAYER','AFFECTED_ARTIFACT_ID','OLD_VERSION','OLD_SHA256','NEW_VERSION','NEW_SHA256','EXACT_CHANGE','REASON','ROOT_CAUSE_ID_OR_AUTHORITY','MATERIAL_CHANGE','DOWNSTREAM_ARTIFACTS_INVALIDATED','DOWNSTREAM_DETERMINATIONS_INVALIDATED','TESTS_TO_RERUN','ITERATIONS_TO_RERUN','REVIEWS_TO_RERUN','RELEASE_GATE_MUST_BE_RERUN','HASH_IDENTITY_MUST_BE_RERUN','AUTHORIZED_BY','CHANGE_IMPLEMENTED_BY','IMPLEMENTATION_EVIDENCE','REVALIDATION_COMPLETE','REVALIDATION_EVIDENCE','CHANGE_STATUS']},D:{title:'Final release record',idField:'RELEASE_ID',fields:['RELEASE_ID','JOB_ID','PRODUCT_ID','PRODUCT_VERSION','BASELINE_ID','RELEASE_GATE_ID','RELEASE_GATE_STATE','PROCESS_REVIEW_VERSION_AND_DETERMINATION','PRODUCT_REVIEW_VERSION_AND_DETERMINATION','REPRESENTATION_REVIEW_VERSION_AND_DETERMINATION','EVIDENCE_CHAIN_VERSION_AND_DETERMINATION','HASH_REVIEW_ID_AND_DETERMINATION','MANDATORY_REQUIREMENT_COVERAGE','MANDATORY_VERIFICATION_COVERAGE','REGRESSION_TEST_SUCCESS','CRITICAL_DEFECTS','MAJOR_DEFECTS','MANDATORY_UNRESOLVED_UNKNOWNS','CORRECTNESS_AFFECTING_CONTRADICTIONS','CORRECTNESS_AFFECTING_AMBIGUITIES','UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE','EXACT_AUTHORIZED_ARTIFACTS','RELEASE_EVIDENCE_REPOSITORY','RELEASE_AUTHORIZED_BY','AUTHORIZATION_DATE_AND_TIME','FINAL_RELEASE_STATUS','CONTROLLING_EVIDENCE']},E:{title:'New-job reset record',idField:'NEW_JOB_ID',fields:['NEW_JOB_ID','NEW_JOB_TITLE','JOB_OWNER','DATE_OPENED','MASTER_TEMPLATE_VERSION','MASTER_TEMPLATE_SHA256','NEW_WORKBOOK_FILENAME','NEW_WORKBOOK_VERSION','NEW_FOLDER_ROOT','SUPPLIED_INPUT_FILES','SUPPLIED_INPUT_HASHES','EXACT_USER_REQUEST_CAPTURED_IN_STAGE_01','OLD_JOB_MATERIAL_REUSED','AUTHORIZED_REUSED_ARTIFACTS','OLD_BASELINE_STATUS_CARRIED_FORWARD','OLD_RELEASE_DECISION_CARRIED_FORWARD','OLD_REQUIREMENT_OR_TEST_CARRIED_FORWARD_WITHOUT_REVALIDATION','NEW_JOB_START_STAGE','RESET_COMPLETED_BY','RESET_DATE_AND_TIME','RESET_EVIDENCE']},F:{title:'Agent-output receipt',idField:'RECEIPT_ID',fields:['RECEIPT_ID','JOB_ID','STAGE','AGENT_ROLE','AGENT_OR_SYSTEM_IDENTIFIER','CONTEXT_ID','ITERATION_ID','RUN_ID','REQUEST_DATE_AND_TIME','RESPONSE_DATE_AND_TIME','COPY_BLOCK_VERSION_OR_HASH','INPUT_VERSIONS','SOURCE_SET_VERSION','REQUIREMENTS_VERSION','INSTRUCTION_VERSION','TEST_SUITE_VERSION','TOOL_CONFIGURATION_VERSION','OUTPUT_ARTIFACT_ID','OUTPUT_VERSION','OUTPUT_FILES','OUTPUT_HASHES','COMPLETE_RESPONSE_SAVED','AGENT_CLAIMED_COMPLETION','INDEPENDENT_COMPLETION_ESTABLISHED','TRUNCATION_DETECTED','REFUSAL_OR_PARTIAL_REFUSAL','TOOL_FAILURES','MISSING_OR_UNREADABLE_ATTACHMENTS','MALFORMED_OUTPUT_FILES','OTHER_DEVIATIONS','DEFECT_IDS','BLOCKER_IDS','NEXT_REQUIRED_VERIFICATION_STAGE','RECEIPT_COMPLETED_BY','RECEIPT_EVIDENCE']}});
function hashAuthority(){const authority=globalThis.closedLoopHash;if(!authority)throw new Error('hash.js must be loaded before hashing workbook state.');return authority;}
const sha256Bytes=async value=>hashAuthority().sha256Bytes(value);
const sha256Text=async value=>hashAuthority().sha256Text(String(value));
function stageTemplate(s){return [`STAGE ${String(s.number).padStart(2,'0')} — ${s.title}`,...s.fields.map(f=>`${f}: <<ENTER>>`)].join('\n');}
function blankStage(s){return {number:s.number,status:'NOT STARTED',decision:'',decisionEvidence:'',nextStage:'',decidedBy:'',dateTime:'',draftRecord:stageTemplate(s),responseDraft:'',authorizedFiles:[],humanChecks:{},gateChecks:{},evidenceChecks:{},revisions:[]};}
const CONTROLLING_COMPLETION_PROJECT_COLLECTIONS=Object.freeze(['propositions','propositionEquivalenceReviews','applicabilityRecords','proofExpressions','proofObligations','semanticCoverageReviews','sourceSearchAdequacyReviews','requirementCompilationChallengeReviews','observationRecords','entailmentReviews','environmentDependencies','operationReservations','backupRecords','deliveryRecords','deploymentManifests','disclosureAuthorizations','intakeCoverageManifests','obligationManifests','promptContextManifests','blindAliasMaps','nativeExecutionEvents']);
function ensureCompletionProjectCollections(projectData){const data=projectData&&typeof projectData==='object'&&!Array.isArray(projectData)?projectData:{};for(const name of CONTROLLING_COMPLETION_PROJECT_COLLECTIONS)if(!Array.isArray(data[name]))data[name]=[];return data;}
function createBlankState(jobId){const id=jobId||`JOB-${new Date().toISOString().replace(/\D/g,'').slice(0,14)}`;const state={schema:PROJECT_SCHEMA,workflow:WORKFLOW_ID,stageCount:STAGE_COUNT,revision:0,job:{JOB_ID:id,JOB_TITLE:'New project',JOB_OWNER:'',DATE_OPENED:new Date().toISOString(),EXACT_USER_OBJECTIVE_VERBATIM:'',EXACT_DELIVERABLE_REQUESTED:'',SUPPLIED_MATERIALS_INVENTORY:'',REQUIRED_OUTPUT_FORMAT:'',DEADLINE_OR_TEMPORAL_SCOPE:'',DESIRED_SOURCE_COUNT:null,KNOWN_AUTHORITATIVE_SOURCES:'',AVAILABLE_TOOLS:'',PROHIBITED_ACTIONS:'',EXPLICIT_USER_REQUIREMENTS:'',ASSUMPTIONS:'',UNKNOWN_INFORMATION:'',CURRENT_ITERATION:'',CURRENT_STAGE:'STAGE 01',CURRENT_STATE:'NOT STARTED',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'',CURRENT_REQUIREMENTS_VERSION:'',CURRENT_TEST_SUITE_VERSION:'',CURRENT_INSTRUCTION_VERSION:'',CURRENT_BASELINE_ID:'NONE',CURRENT_PRODUCT_ID:'NONE',CURRENT_BLOCKERS:'NONE',NEXT_REQUIRED_ACTION:'Complete Stage 01.',LATEST_EVIDENCE_REFERENCE:'',INPUT_SET_CONTENTS:'',INPUT_SET_HASH_OR_MANIFEST:'',JOB_RECORD_STATUS:'NOT READY',STATUS_EVIDENCE:''},stages:Object.fromEntries(STAGES.map(s=>[s.number,blankStage(s)])),appendices:Object.fromEntries(Object.keys(APPENDICES).map(k=>[k,{draft:'',records:[]}])),release:{gateState:'',auditedDraft:[],releaseDraft:[],comparisons:[],authorization:'NOT AUTHORIZED',authorizedArtifactIds:[]},projectData:{userEntered:{},sources:[],research:[],requirements:[],tests:[],failureTests:[],instructions:[],generatedPrompts:[],generatedOutputs:[],outputReceipts:[],freshContexts:[],runs:[],verification:[],comparisons:[],defects:[],regressions:[],changes:[],blockers:[],artifacts:[],reviews:[],releaseRecords:[],evidenceChains:[],history:[],permanentRegistry:{},stageRecords:{},fullProject:{}},activeStage:1,activeView:'Project',jobRevisions:[],snapshots:[]};state.projectData=ensureCompletionProjectCollections(state.projectData);return state;}
function parseRecordFields(text){const out={};let key='';for(const line of String(text||'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9][A-Z0-9_ -]*):\s*(.*)$/);if(m){key=m[1].trim().replace(/\s+/g,'_');out[key]=m[2].trim();}else if(key&&line.trim())out[key]+=`\n${line}`;}return out;}
const n=v=>Number(String(v??'').replace(/[^0-9.-]/g,''));const truth=v=>['TRUE','YES','SATISFIED','ACCEPTED','AUTHORIZED','CONFIRMED','CONVERGED'].includes(String(v||'').trim().toUpperCase());
function validateCriticalFields(stage,record){
  const f=parseRecordFields(record),issues=[];
  const value=k=>String(f[k]??'').trim().toUpperCase();
  const isYes=k=>['YES','TRUE','SATISFIED','CONFIRMED','CONVERGED'].includes(value(k));
  const isNo=k=>['NO','FALSE','NONE','0'].includes(value(k));
  const isEmptySet=k=>{const raw=String(f[k]??'').trim();if(['','NONE','[]','0','NOT APPLICABLE'].includes(raw.toUpperCase()))return true;try{const parsed=JSON.parse(raw);return Array.isArray(parsed)&&parsed.length===0;}catch{return false;}};
  switch(stage.number){
    case 6:if(![1,100].includes(n(f.MANDATORY_TEST_COVERAGE)))issues.push('Stage 06 requires complete mandatory test coverage.');break;
    case 7:if(n(f.INVALID_FIXTURES_ACCEPTED)!==0)issues.push('Stage 07 requires zero accepted invalid fixtures.');if(n(f.DEFECTIVE_VALIDATORS)!==0)issues.push('Stage 07 requires zero unresolved defective validators.');break;
    case 9:if(!isYes('REVIEW_CONTEXT_INDEPENDENT_FROM_AUTHOR'))issues.push('Stage 09 requires an independent review context.');if(!isYes('EVERY_SENTENCE_REVIEWED'))issues.push('Stage 09 requires the complete instruction review.');break;
    case 10:if(!isYes('ALL_REQUIRED_COMPONENTS_PRESENT'))issues.push('Stage 10 requires every frozen component.');if(!isYes('ALL_RUNS_WILL_RECEIVE_IDENTICAL_FROZEN_MATERIALS'))issues.push('Stage 10 requires identical frozen materials for all runs.');break;
    case 11:if(n(f.FRESH_CONTEXTS_CREATED)!==10)issues.push('Stage 11 requires exactly 10 fresh contexts.');if(n(f.RUNS_RECEIVING_EXACT_PACKAGE)!==10)issues.push('Stage 11 requires all 10 runs to receive the exact package.');if(n(f.CONTAMINATED_RUNS)!==0)issues.push('Stage 11 requires zero contaminated runs.');if(n(f.OUTPUTS_SAVED_SEPARATELY)!==10)issues.push('Stage 11 requires 10 separately preserved outputs.');break;
    case 12:if(n(f.MISSING_RECORDS)!==0)issues.push('Stage 12 requires zero missing verification records.');if(n(f.SELF_VALIDATED_RECORDS)!==0)issues.push('Stage 12 requires zero self-validated records.');if(n(f.EXPECTED_MANDATORY_RECORDS)!==n(f.ACTUAL_MANDATORY_RECORDS))issues.push('Stage 12 verification record counts must reconcile exactly.');break;
    case 15:if(n(f.UNCONVERTED_CONFIRMED_DEFECTS)!==0)issues.push('Stage 15 requires every confirmed defect to have a regression test.');break;
    case 16:if(n(f.IN_PLACE_MODIFICATIONS)!==0)issues.push('Stage 16 forbids in-place version modification.');break;
    case 17:if(!isNo('OLD_CONVERSATIONS_CONTINUED'))issues.push('Stage 17 cannot continue old execution conversations.');if(!isYes('TEN_NEW_CONTEXTS_CREATED'))issues.push('Stage 17 requires ten new contexts.');if(!isYes('IDENTICAL_PACKAGE_CONFIRMED_FOR_ALL_RUNS'))issues.push('Stage 17 requires the identical corrected package.');break;
    case 18:if(!truth(f.ALL_CONDITIONS_SIMULTANEOUSLY_TRUE))issues.push('Stage 18 requires every convergence condition to be true simultaneously.');break;
    case 19:if(!isYes('TEN_NEW_CONTEXTS_CREATED'))issues.push('Stage 19 requires new independent contexts.');if(n(f.RUNS_COMPLETED)!==10)issues.push('Stage 19 requires ten confirmation runs.');if(!truth(f.CONFIRMATION_ACCEPTANCE_CRITERIA_SATISFIED))issues.push('Stage 19 confirmation criteria are not established.');break;
    case 20:if(!truth(f.UNCHANGED_CONFIRMATION_SUCCEEDED))issues.push('Stage 20 requires successful unchanged confirmation.');break;
    case 21:if(!isYes('FRESH_CONTEXT'))issues.push('Stage 21 requires a fresh production context.');if(!isNo('EDITED_OUTSIDE_CONTROLLED_WORKFLOW'))issues.push('Stage 21 cannot complete after uncontrolled editing.');break;
    case 22:if(n(f.MISSING_TEST_RESULTS)!==0)issues.push('Stage 22 requires zero missing deterministic test results.');if(n(f.VIOLATED)>0)issues.push('Stage 22 contains a mandatory deterministic violation.');break;
    case 23:if(value('EVALUATOR_INDEPENDENT_FROM_GENERATOR')!=='YES')issues.push('Stage 23 requires an evaluator independent from the generator.');if(n(f.UNSUPPORTED_BARE_CONCLUSIONS)!==0)issues.push('Stage 23 requires zero unsupported bare conclusions.');break;
    case 24:if(value('REVIEWER_INDEPENDENT')!=='YES')issues.push('Stage 24 requires an independent adversarial reviewer.');if(n(f.MANDATORY_DEFECTS_FOUND)>0)issues.push('Stage 24 found unresolved mandatory defects.');break;
    case 25:if(n(f.UNRESOLVED_CRITICAL_DEFECTS)>0||n(f.UNRESOLVED_MAJOR_DEFECTS)>0||n(f.UNRESOLVED_REPRESENTATION_UNKNOWNS)>0)issues.push('Stage 25 cannot complete with unresolved material representation findings.');break;
    case 26:if(value('RECONCILED_DETERMINATION')!=='SATISFIED')issues.push('Stage 26 requires affirmative process and product reconciliation.');break;
    case 27:if(!['ACCEPTED','REJECTED','BLOCKED'].includes(value('SELECTED_RELEASE_STATE')))issues.push('Stage 27 must select exactly one eligibility state.');if(value('SELECTED_RELEASE_STATE')==='ACCEPTED'&&!truth(f.PRODUCT_RELEASE_ELIGIBILITY))issues.push('Stage 27 ACCEPTED means product release eligibility and requires PRODUCT_RELEASE_ELIGIBILITY = TRUE.');if(value('SELECTED_RELEASE_STATE')==='ACCEPTED'&&(n(f.VIOLATED_MANDATORY_PROPOSITIONS)!==0||n(f.UNDETERMINED_MANDATORY_PROPOSITIONS)!==0||!isEmptySet('UNKNOWN_APPLICABILITY_IDS')||!isEmptySet('INSUFFICIENT_EPISTEMIC_BASIS_IDS')||!isEmptySet('EXPIRED_EVIDENCE_IDS')||!isEmptySet('DUE_DEFERRED_TEST_IDS')||!isEmptySet('DEPENDENCY_BLOCKER_IDS')||!truth(f.RELEASE_EVIDENCE_GRAPH_ACYCLIC)))issues.push('Stage 27 eligibility cannot be accepted with a violation, unknown, stale dependency, deferred test, insufficient evidence basis, or evidence cycle.');break;
    case 28:if(value('RELEASE_GATE_STATE')!=='ACCEPTED')issues.push('Stage 28 requires an ACCEPTED product-eligibility gate.');if(!truth(f.ALL_RELEASE_HASHES_EQUAL_AUDITED_HASHES))issues.push('Stage 28 requires every release hash to match its audited hash.');if(n(f.TOTAL_HASH_MISMATCHES)!==0||n(f.TOTAL_UNKNOWN_HASH_COMPARISONS)!==0)issues.push('Stage 28 requires zero hash mismatches and zero unknown comparisons.');if(!truth(f.DELIVERY_ARTIFACT_IDENTITY_VERIFIED))issues.push('Stage 28 requires delivery-artifact identity verification.');if(!isNo('DELIVERY_AUTHORIZATION_EFFECTIVE'))issues.push('Stage 28 cannot make delivery authorization effective.');break;
    case 29:if(n(f.MANDATORY_EVIDENCE_CHAIN_COVERAGE)!==100&&n(f.MANDATORY_EVIDENCE_CHAIN_COVERAGE)!==1)issues.push('Stage 29 requires 100% mandatory evidence-chain coverage.');if(!truth(f.ALL_MANDATORY_EVIDENCE_CHAINS_COMPLETE))issues.push('Stage 29 requires all mandatory evidence chains complete.');if(n(f.JUSTIFICATION_CYCLE_COUNT)!==0)issues.push('Stage 29 requires an acyclic current justification graph.');if(!isNo('DELIVERY_AUTHORIZATION_EFFECTIVE'))issues.push('Stage 29 cannot make delivery authorization effective.');break;
    case 30:if(!truth(f.REGISTRY_IS_APPEND_ONLY))issues.push('Stage 30 requires an append-only registry.');if(value('DEFECT_RECORDS_MISSING_REQUIRED_FIELDS')!=='NONE')issues.push('Stage 30 has defect records missing required fields.');if(value('CONFIRMED_DEFECTS_MISSING_REGRESSION_TESTS')!=='NONE')issues.push('Stage 30 has confirmed defects without permanent regression tests.');if(!['COMPLETE','SATISFIED','CLEAR','VALID'].includes(value('REGISTRY_INTEGRITY_STATUS')))issues.push('Stage 30 requires complete registry integrity.');if(value('DELIVERY_STATE')==='AUTHORIZED'&&(!truth(f.DELIVERY_AUTHORIZATION_EFFECTIVE)||!String(f.DELIVERY_ID||'').trim()||!String(f.DELIVERY_RECORD_HASH||'').trim()))issues.push('An authorized delivery requires an effective, identified, hash-bound delivery record.');if(truth(f.DELIVERY_AUTHORIZATION_EFFECTIVE)&&value('DELIVERY_STATE')!=='AUTHORIZED')issues.push('Effective delivery authorization requires DELIVERY_STATE = AUTHORIZED.');break;
  }
  return issues;
}
function validateStageDraft(stage,s,state){const issues=[];if(!String(s.draftRecord||'').trim())issues.push('Stage record is empty.');if(/<<[^>]+>>/.test(String(s.draftRecord||'')))issues.push('Stage record still contains placeholders.');if(!s.decision)issues.push('Select a stage decision.');if(!String(s.decisionEvidence||'').trim())issues.push('Decision evidence is required.');if((stage.humanChecklist||[]).some((_,i)=>!s.humanChecks?.[i]))issues.push('Required human decision or action is incomplete.');if(stage.number>1&&state?.stages?.[stage.number-1]?.status!=='COMPLETE')issues.push(`Stage ${String(stage.number-1).padStart(2,'0')} is not complete.`);if(s.decision==='READY TO PROCEED')issues.push(...validateCriticalFields(stage,s.draftRecord));return {valid:issues.length===0,issues};}
async function immutableRevision(revisions,payload,meta={}){const digestIdentity=hashAuthority().digestIdentityForValue(payload),latest=(revisions||[]).at(-1);if(latest?.sha256===digestIdentity.digest)return {changed:false,record:latest};const cloned=typeof structuredClone==='function'?structuredClone(payload):JSON.parse(JSON.stringify(payload));return {changed:true,record:{...meta,version:`v${String((revisions||[]).length+1).padStart(3,'0')}`,sha256:digestIdentity.digest,hashAlgorithm:digestIdentity.hashAlgorithm,canonicalizationVersion:digestIdentity.canonicalizationVersion,canonicalByteLength:digestIdentity.canonicalByteLength,createdAt:new Date().toISOString(),payload:cloned}};}
function invalidateDownstream(state,n,changeId){const out=[];for(let i=n+1;i<=30;i++){const s=state?.stages?.[i];if(!s)continue;if(s.status!=='NOT STARTED'||s.decision||s.decisionEvidence)out.push(`STAGE-${String(i).padStart(2,'0')}`);Object.assign(s,{status:'NOT STARTED',decision:'',decisionEvidence:'',nextStage:'',decidedBy:'',dateTime:'',invalidatedBy:changeId});}if(state?.release)Object.assign(state.release,{gateState:'',authorization:'NOT AUTHORIZED',authorizedArtifactIds:[]});return out;}
function compareArtifactSets(audited=[],delivery=[],gateState=''){
  const key=item=>`${String(item?.artifactId||'')}\u0000${String(item?.authorizedFilename||item?.name||'')}`;
  const index=(items,label)=>{const map=new Map(),duplicates=[];for(const item of items){const identity=key(item);if(!String(item?.artifactId||'').trim()||!String(item?.authorizedFilename||item?.name||'').trim()){duplicates.push(`${label}:MISSING_CANONICAL_IDENTITY`);continue;}if(map.has(identity))duplicates.push(identity);else map.set(identity,item);}return{map,duplicates};};
  const left=index(audited,'AUDITED'),right=index(delivery,'DELIVERY'),identities=[...new Set([...left.map.keys(),...right.map.keys()])].sort((x,y)=>hashAuthority().compareUnicodeScalarSequence(x,y)),comparisons=identities.map(identity=>{const x=left.map.get(identity),y=right.map.get(identity);return{artifactId:x?.artifactId||y?.artifactId||'MISSING',authorizedFilename:x?.authorizedFilename||x?.name||y?.authorizedFilename||y?.name||'MISSING',auditedFile:x?.name||'MISSING',releaseFile:y?.name||'MISSING',auditedSha256:x?.sha256||'UNKNOWN',releaseSha256:y?.sha256||'UNKNOWN',hashesIdentical:Boolean(x&&y&&String(x.sha256).toLowerCase()===String(y.sha256).toLowerCase()),byteSizesIdentical:Boolean(x&&y&&Number.isSafeInteger(Number(x.size))&&Number(x.size)===Number(y.size)),missingAudited:!x,missingDelivery:!y};}),identityVerified=gateState==='ACCEPTED'&&audited.length>0&&audited.length===delivery.length&&!left.duplicates.length&&!right.duplicates.length&&comparisons.every(item=>!item.missingAudited&&!item.missingDelivery&&item.hashesIdentical&&item.byteSizesIdentical);
  return{gateState,comparisons,duplicateIdentities:Object.freeze([...left.duplicates,...right.duplicates]),identityVerified,humanDeliveryIntent:identityVerified?'ELIGIBLE_FOR_HUMAN_DECISION':'BLOCKED',authorization:'NOT AUTHORIZED',deliveryAuthorizationEffective:false};
}
function restoreLegacyStage01AcceptedCapture(migrated,original){
  const stage01=migrated?.stages?.['1']||migrated?.stages?.[1];
  if(!stage01||String(stage01.status||'').toUpperCase()!=='COMPLETE')return migrated;
  stage01.agentData=stage01.agentData&&typeof stage01.agentData==='object'&&!Array.isArray(stage01.agentData)?stage01.agentData:{};
  const accepted=stage01.acceptedData&&typeof stage01.acceptedData==='object'&&!Array.isArray(stage01.acceptedData)?stage01.acceptedData:{};
  if(String(stage01.agentData.INPUT_SET_CONTENTS||'').trim())return migrated;
  if(String(accepted.INPUT_SET_CONTENTS||'').trim()){stage01.agentData.INPUT_SET_CONTENTS=String(accepted.INPUT_SET_CONTENTS);return migrated;}
  const supplied=original?.userJobInput&&typeof original.userJobInput==='object'&&!Array.isArray(original.userJobInput)?original.userJobInput:null;
  const captured=supplied&&Object.keys(supplied).length?JSON.stringify(supplied):String(stage01.draftRecord||'').trim();
  if(captured)stage01.agentData.INPUT_SET_CONTENTS=captured;
  return migrated;
}
function migrateState(p){
  if(!p||typeof p!=='object')return createBlankState();
  if(p.schema===PROJECT_SCHEMA&&p.workflow===WORKFLOW_ID&&Number(p.stageCount)===STAGE_COUNT){
    const migrated=JSON.parse(JSON.stringify(p));
    migrated.projectData=ensureCompletionProjectCollections(migrated.projectData);
    migrated.projectData.migrationArchives=Array.isArray(migrated.projectData.migrationArchives)?migrated.projectData.migrationArchives:[];
    migrated.projectData.historicalImportRecords=Array.isArray(migrated.projectData.historicalImportRecords)?migrated.projectData.historicalImportRecords:[];
    if(migrated.projectData.stageRecords&&Object.keys(migrated.projectData.stageRecords).length){migrated.projectData.historicalImportRecords.push({kind:'LEGACY_STAGE_RECORDS',schema:PROJECT_SCHEMA,records:JSON.parse(JSON.stringify(migrated.projectData.stageRecords))});migrated.projectData.stageRecords={};}
    if(migrated.projectData.fullProject&&Object.keys(migrated.projectData.fullProject).length){migrated.projectData.migrationArchives.push({kind:'LEGACY_NESTED_PROJECT',schema:PROJECT_SCHEMA,preservedAt:new Date().toISOString(),payload:JSON.parse(JSON.stringify(migrated.projectData.fullProject))});delete migrated.projectData.fullProject;}
    return migrated;
  }
  if(p.schema!=='human-project/30')throw new Error(`Unsupported project schema: ${p.schema||'MISSING'}`);
  const migrated=JSON.parse(JSON.stringify(p));
  const original=JSON.parse(JSON.stringify(p));
  migrated.schema=PROJECT_SCHEMA;migrated.workflow=WORKFLOW_ID;migrated.stageCount=STAGE_COUNT;migrated.revision=Number.isInteger(migrated.revision)?migrated.revision:0;
  migrated.projectData=ensureCompletionProjectCollections(migrated.projectData);
  migrated.projectData.migrationArchives=Array.isArray(migrated.projectData.migrationArchives)?migrated.projectData.migrationArchives:[];
  migrated.projectData.historicalImportRecords=Array.isArray(migrated.projectData.historicalImportRecords)?migrated.projectData.historicalImportRecords:[];
  if(migrated.projectData.stageRecords&&Object.keys(migrated.projectData.stageRecords).length){migrated.projectData.historicalImportRecords.push({kind:'LEGACY_STAGE_RECORDS',schema:'human-project/30',records:JSON.parse(JSON.stringify(migrated.projectData.stageRecords))});delete migrated.projectData.stageRecords;}
  if(migrated.projectData.fullProject&&Object.keys(migrated.projectData.fullProject).length)delete migrated.projectData.fullProject;
  migrated.projectData.migrationArchives.push({kind:'MIGRATION_SOURCE',schema:'human-project/30',preservedAt:new Date().toISOString(),payload:original});
  restoreLegacyStage01AcceptedCapture(migrated,original);
  if(!migrated.stages||Object.keys(migrated.stages).length!==STAGE_COUNT)throw new Error('Legacy project migration requires exactly 30 stages.');
  return migrated;
}
globalThis.closedLoopCore={SCHEMA,WORKFLOW_ID,PROJECT_SCHEMA,STAGE_COUNT,STAGE_OWNERSHIP,STAGES,APPENDICES,STAGE_DECISIONS,CONTROLLING_COMPLETION_STAGE_FIELD_DEFINITIONS,createBlankState,migrateState,stageTemplate,stageHumanItems:s=>s.humanChecklist||[],stageGateItems:s=>s.completionGate||[],stageEvidenceItems:s=>s.evidenceToPreserve||[],validateStageDraft,parseRecordFields,sha256Bytes,sha256Text,immutableRevision,invalidateDownstream,compareArtifactSets};dispatchEvent(new Event('closed-loop-core-ready'));
})();

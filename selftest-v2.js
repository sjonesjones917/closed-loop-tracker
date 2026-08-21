const fs=require("fs"),crypto=require("crypto");require("./v2-spec.js");require("./v2-model.js");require("./v2-contract.js");require("./v2-validate.js");require("./v2-fixes.js");const C=require("./v2-batch.js");
function assert(x,msg){if(!x)throw new Error(msg)}
const j=C.newJob({title:"E2E Self Test",objective:"Create a one-line text artifact containing exactly HELLO CLOSED LOOP",deliverable:"Plain text file",supplied:"Required exact text: HELLO CLOSED LOOP",format:"TEXT",tools:"File creation and hashing",explicitRequirements:"Artifact content must be exactly HELLO CLOSED LOOP followed by a newline."});
let r=C.saveStandardStage(j,1,`JOB_ID: ${j.id}
EXACT_USER_OBJECTIVE:
Create a one-line text artifact containing exactly HELLO CLOSED LOOP
EXACT_DELIVERABLE_REQUESTED:
Plain text file
SUPPLIED_FILES:
NONE
SUPPLIED_MESSAGES:
NONE
SUPPLIED_LINKS:
NONE
SUPPLIED_DATA:
Required exact text: HELLO CLOSED LOOP
EXPLICIT_CONSTRAINTS:
Artifact content must be exactly HELLO CLOSED LOOP followed by a newline.
REQUIRED_OUTPUT_FORMAT:
TEXT
DEADLINE_OR_TEMPORAL_SCOPE:
NONE
KNOWN_AUTHORITATIVE_SOURCES:
User input
AVAILABLE_TOOLS:
File creation and hashing
PROHIBITED_ACTIONS:
NONE
UNKNOWN_INFORMATION_THAT_MAY_AFFECT_CORRECTNESS:
NONE
EXPLICIT_USER_REQUIREMENTS:
Artifact content must be exactly HELLO CLOSED LOOP followed by a newline.
ASSUMPTIONS:
NONE
INPUT_SET_VERSION: INPUT-v001`);assert(r.validation.ok,"stage1");
const p1=C.buildPrompt(j,1);assert(p1.includes("RAW JOB INPUT"),"stage1 raw input");assert(p1.includes("Create a job record before doing any substantive work"),"stage1 work");assert(!p1.includes("AUTHORITATIVE JOB RECORD FROM STAGE 1"),"stage1 cannot pretend it already exists");
r=C.saveStandardStage(j,2,`SOURCE RECORD
SOURCE_ID:
TITLE_OR_DESCRIPTION: User supplied exact text requirement
SOURCE_TYPE: USER_INPUT
ORIGIN: JOB RECORD
VERSION: INPUT-v001
PUBLICATION_OR_EFFECTIVE_DATE: N_A
AUTHORITY_LEVEL: USER
ROLE: MANDATORY
RELEVANT_PORTIONS: exact artifact text
CONFLICTS_WITH: NONE
CONFLICT_STATUS: NONE
CONTROLLING_SOURCE_IF_RESOLVED: N_A
EVIDENCE_FOR_AUTHORITY_DECISION: direct user input
SOURCE_INVENTORY_COMPLETENESS: complete
UNRESOLVED_AUTHORITY_CONFLICTS: NONE
BLOCKED: FALSE`);assert(r.validation.ok,"stage2");
r=C.saveStandardStage(j,3,`RESEARCH FINDING
SOURCE_REFERENCE: SRC-0001
SOURCE_LOCATION: job record
EXACT_EFFECT_ON_FINAL_PRODUCT: output must equal HELLO CLOSED LOOP plus newline
CLASSIFICATION: MANDATORY_REQUIREMENT
SOURCE_EVIDENCE: direct user requirement
APPLIES: TRUE
DEPENDENCIES_OR_PRECONDITIONS: none
CONFLICTS_OR_RESTRICTIONS: none
FINAL_SATURATION_PASS_PERFORMED: TRUE
NEW_MATERIAL_REQUIREMENT_CATEGORY_FOUND_ON_FINAL_PASS: FALSE
CONTROLLING_SOURCES_ALL_EXAMINED: TRUE
BLOCKED: FALSE`);assert(r.validation.ok,"stage3");
r=C.saveStandardStage(j,4,`REQUIREMENT RECORD
REQ_ID:
REQUIREMENT: File content equals HELLO CLOSED LOOP followed by one newline.
TYPE: USER
SOURCE: SRC-0001
SOURCE_LOCATION: job record
AUTHORITY: USER
APPLICABILITY: always
DEPENDENCIES: none
PROHIBITIONS: extra content
VERIFICATION_METHOD: EXACT_SOURCE_COMPARISON
EXPECTED_EVIDENCE: byte comparison
FAILURE_CONDITION: any byte differs
STATUS: RESOLVED`);assert(r.validation.ok,"stage4");
r=C.saveStandardStage(j,5,`DUPLICATES_FOUND: NONE
CONFLICTS_FOUND: NONE
MUTUALLY_UNSATISFIABLE_REQUIREMENTS: NONE
UNDEFINED_TERMS: NONE
CIRCULAR_DEPENDENCIES: NONE
MISSING_PREREQUISITES: NONE
UNSUPPORTED_REQUIREMENTS: NONE
INDETERMINATE_APPLICABILITY: NONE
REQUIREMENTS_WITHOUT_VERIFICATION_METHOD: NONE
RESOLUTIONS_APPLIED: NONE
MANDATORY_BLOCKERS: NONE
REQUIREMENT_SET_RESOLVED: TRUE`);assert(r.validation.ok,"stage5");
r=C.saveStandardStage(j,6,`VERIFICATION TEST
TEST_ID:
REQ_ID: REQ-0001
TEST_TYPE: EXACT_SOURCE_COMPARISON
INPUTS_REQUIRED: output file
PROCEDURE: compare bytes to expected bytes
EXPECTED_RESULT: exact equality
FAILURE_CONDITION: any byte differs
EVIDENCE_PRODUCED: comparison result
TOTAL_MANDATORY_REQUIREMENTS: 1
MANDATORY_REQUIREMENTS_WITH_TESTS: 1
MANDATORY_TEST_COVERAGE: 100%
BLOCKED: FALSE`);assert(r.validation.ok,"stage6");
r=C.saveStandardStage(j,7,`FAILURE TEST
REQ_ID: REQ-0001
INVALID_OR_ADVERSARIAL_FIXTURE: HELLO CLOSED LOOP!
VIOLATION_INTRODUCED: extra exclamation mark
EXPECTED_SYSTEM_RESPONSE: REJECT
VALIDATOR_USED: byte comparison
ACTUAL_VALIDATOR_RESPONSE: rejected
INVALID_CASE_ACCEPTED: FALSE
VALIDATOR_DEFECT_ID:
CORRECTION_IF_DEFECTIVE: N_A
RETEST_RESULT: SATISFIED
ALL_APPLICABLE_REQUIREMENTS_HAVE_FAILURE_TEST: TRUE
ALL_INVALID_CASES_DETECTED_OR_REJECTED_OR_BLOCKED: TRUE`);assert(r.validation.ok,"stage7");
r=C.saveStandardStage(j,8,`OBJECTIVE
Create the exact text file.

INPUTS
Expected text.

SOURCE AUTHORITY
User input controls.

SCOPE
Create one file only.

DEFINED TERMS
Artifact means output text file.

REQUIRED PROCEDURE
Write exactly HELLO CLOSED LOOP followed by newline.

DECISION RULES
Reject any differing byte.

TOOL RULES
Use file-write and SHA-256 tools.

OUTPUT CONTRACT
One UTF-8 text file.

FAILURE HANDLING
UNKNOWN blocks.

COMPLETION CRITERIA
Exact bytes and hash recorded.`);assert(r.validation.ok,"stage8");
r=C.saveStandardStage(j,9,`KNOWN_MATERIAL_INSTRUCTION_DEFECTS_REMAINING: 0
CORRECTED_INSTRUCTION_VERSION: INSTRUCTION-v001
CORRECTED_FULL_INSTRUCTION:
OBJECTIVE
Create exact artifact.
INPUTS
Expected text.
SOURCE AUTHORITY
User.
SCOPE
One file.
DEFINED TERMS
Artifact=file.
REQUIRED PROCEDURE
Write exact text.
DECISION RULES
Reject mismatch.
TOOL RULES
Write/hash.
OUTPUT CONTRACT
UTF-8 file.
FAILURE HANDLING
Block unknown.
COMPLETION CRITERIA
Exact bytes.`);assert(r.validation.ok,"stage9");
r=C.saveStandardStage(j,10,`FREEZE_ID:
INPUT_VERSION: INPUT-v001
SOURCE_SET_VERSION: SOURCE-SET-v001
REQUIREMENTS_VERSION: REQUIREMENTS-v001
TEST_SUITE_VERSION: TEST-SUITE-v001
INSTRUCTION_VERSION: INSTRUCTION-v001
TOOL_CONFIGURATION_VERSION: TOOL-CONFIGURATION-v001
IMMUTABLE_FILE_HASHES: synthetic
FREEZE_COMPLETE: TRUE`);assert(r.validation.ok,"stage10");
let b=C.createRunBatch(j,"candidate",11);assert(b.length===10,"run batch");assert(b[0].prompt.includes("PRODUCTION INSTRUCTION TO EXECUTE"),"candidate run executable");assert(!b[0].prompt.includes("Create ten fresh execution contexts"),"individual run cannot be stage11 instruction");for(let i=0;i<10;i++)C.saveRunOutput(j,"candidate",i,"HELLO CLOSED LOOP\n");assert(C.markBatchStage(j,11,"candidate").ok,"stage11");
let vp=C.createVerificationPrompts(j,"candidate");assert(vp.length===10,"verify prompts");for(let i=0;i<10;i++)C.saveVerification(j,"candidate",i,`REQ_ID: REQ-0001\nRUN_ID: RUN-${String(i+1).padStart(3,"0")}\nRESULT: SATISFIED\nTEST_ID: TEST-0001\nEVIDENCE: exact bytes`);assert(C.markVerificationStage(j,12,"candidate").ok,"stage12");
r=C.saveStandardStage(j,13,`REQ_ID: REQ-0001
SATISFIED_BY_ALL_TEN: TRUE
VIOLATED_RUNS: NONE
INCONSISTENT_INTERPRETATION: FALSE
PROHIBITED_VARIANCE: FALSE
INCONCLUSIVE_EVALUATION: FALSE
REPEATED_FAILURE: NONE
UNIQUE_FAILURE: NONE
DEFECT_REQUIRED: FALSE`);assert(r.validation.ok,"stage13");
r=C.saveStandardStage(j,14,`NO_CONFIRMED_DEFECTS: TRUE`);assert(r.validation.ok,"stage14");r=C.saveStandardStage(j,15,`NO_CONFIRMED_DEFECTS_REQUIRING_REGRESSION_TEST: TRUE`);assert(r.validation.ok,"stage15");r=C.saveStandardStage(j,16,`NO_RESPONSIBLE_LAYER_REVISION_REQUIRED: TRUE`);assert(r.validation.ok,"stage16");
j.iterationWorkspace.freeze=`FREEZE_ID: FREEZE-0002\nINPUT_VERSION: INPUT-v001\nSOURCE_SET_VERSION: SOURCE-SET-v001\nREQUIREMENTS_VERSION: REQUIREMENTS-v001\nTEST_SUITE_VERSION: TEST-SUITE-v001\nINSTRUCTION_VERSION: INSTRUCTION-v001\nTOOL_CONFIGURATION_VERSION: TOOL-CONFIGURATION-v001\nFREEZE_COMPLETE: TRUE`;
b=C.createRunBatch(j,"rerun",17);for(let i=0;i<10;i++)C.saveRunOutput(j,"rerun",i,"HELLO CLOSED LOOP\n");assert(C.validateRunBatch(j,"rerun").ok,"stage17 runs");let rvp=C.createVerificationPrompts(j,"rerun");for(let i=0;i<10;i++)C.saveVerification(j,"rerun",i,`REQ_ID: REQ-0001\nRUN_ID: RUN-${String(i+1).padStart(3,"0")}\nRESULT: SATISFIED\nTEST_ID: TEST-0001\nEVIDENCE: exact bytes`);assert(C.validateVerificationBatch(j,"rerun").ok,"stage17 verify");assert(C.completeRerunIteration(j,`REQ_ID: REQ-0001\nSATISFIED_BY_ALL_TEN: TRUE\nDEFECT_REQUIRED: FALSE`,"NO_CONFIRMED_DEFECTS","NO_NEW_REGRESSION_TESTS_REQUIRED","NO_RESPONSIBLE_LAYER_CORRECTION_REQUIRED").ok,"stage17");
r=C.saveStandardStage(j,18,`MANDATORY_REQUIREMENT_COVERAGE: 100%
MANDATORY_VERIFICATION_COVERAGE: 100%
REGRESSION_TEST_SUCCESS: 100%
CRITICAL_DEFECTS: 0
MAJOR_DEFECTS: 0
MANDATORY_UNRESOLVED_UNKNOWS: 0
CORRECTNESS_AFFECTING_CONTRADICTIONS: 0
CORRECTNESS_AFFECTING_AMBIGUITIES: 0
UNEXPLAINED_CORRECTNESS_AFFECTING_EXECUTION_VARIANCE: 0
CONVERGED: TRUE`);assert(r.validation.ok,"stage18");
b=C.createRunBatch(j,"confirmation",19);for(let i=0;i<10;i++)C.saveRunOutput(j,"confirmation",i,"HELLO CLOSED LOOP\n");assert(C.validateRunBatch(j,"confirmation").ok,"stage19 runs");let cvp=C.createVerificationPrompts(j,"confirmation");for(let i=0;i<10;i++)C.saveVerification(j,"confirmation",i,`REQ_ID: REQ-0001\nRUN_ID: RUN-${String(i+1).padStart(3,"0")}\nRESULT: SATISFIED\nTEST_ID: TEST-0001\nEVIDENCE: exact bytes`);assert(C.validateVerificationBatch(j,"confirmation").ok,"stage19 verify");assert(C.completeConfirmationIteration(j,`NEW_CRITICAL_OR_MAJOR_DEFECT: FALSE\nNEW_REQUIREMENT_DISCOVERED: FALSE\nMUTATION_DETECTION_FAILURE: FALSE\nCONFIRMATION_ACCEPTANCE_CRITERIA_SATISFIED: TRUE`).ok,"stage19");
r=C.saveStandardStage(j,20,`BASELINE_ID:
INPUT_CONTRACT_VERSION: INPUT-v001
SOURCE_SET_VERSION: SOURCE-SET-v001
REQUIREMENTS_VERSION: REQUIREMENTS-v001
INSTRUCTION_VERSION: INSTRUCTION-v001
TEST_SUITE_VERSION: TEST-SUITE-v001
VALIDATOR_VERSION: VALIDATOR-v001
TOOL_CONFIGURATION_VERSION: TOOL-CONFIGURATION-v001
IMMUTABLE_FILE_HASHES: synthetic
BASELINE_FROZEN: TRUE`);assert(r.validation.ok,"stage20");
const artifact=Buffer.from("HELLO CLOSED LOOP\n","utf8"),artifactPath="selftest-artifact-v2.txt";fs.writeFileSync(artifactPath,artifact);const sha=crypto.createHash("sha256").update(artifact).digest("hex");
r=C.saveStandardStage(j,21,`HELLO CLOSED LOOP

PRODUCT_ID:
BASELINE_ID: BASELINE-0001
EXECUTION_ID:
OUTPUT_FILES: ${artifactPath}
OUTPUT_HASHES: ${sha}
PRODUCT_VERSION:`);assert(r.validation.ok,"stage21");
r=C.saveStandardStage(j,22,`TEST_ID: TEST-0001
PRODUCT_ID: PRODUCT-0001
CHECK: exact bytes
EXPECTED_RESULT: HELLO CLOSED LOOP plus newline
ACTUAL_RESULT: exact match
DETERMINATION: SATISFIED
EVIDENCE: SHA-256 ${sha}
DEFECT_ID:
ALL_MANDATORY_DETERMINISTIC_TESTS_SUCCEEDED: TRUE`);assert(r.validation.ok,"stage22");
r=C.saveStandardStage(j,23,`REQ_ID: REQ-0001
PRODUCT_LOCATION: entire file
SOURCE_EVIDENCE: user requirement
OBSERVED_MEANING: HELLO CLOSED LOOP
REQUIRED_MEANING: HELLO CLOSED LOOP
DETERMINATION: SATISFIED`);assert(r.validation.ok,"stage23");
r=C.saveStandardStage(j,24,`TARGET: whole artifact
CHECK_OR_ATTACK: look for missing, extra, malformed or hidden content
EVIDENCE: exact byte comparison
DEFECT_FOUND: FALSE
DEFECT_ID:
REQUIRED_RETURN_STAGE: N_A
ADVERSARIAL_SEARCH_COMPLETE: TRUE`);assert(r.validation.ok,"stage24");
r=C.saveStandardStage(j,25,`TRANSFORMATION_CHAIN: direct UTF-8 text
RENDERED_PAGES_VERIFIED: TRUE
CLIPPING_FOUND: FALSE
MISSING_CONTENT_FOUND: FALSE
BLANK_PAGES_FOUND: FALSE
BROKEN_TABLES_FOUND: FALSE
MISPLACED_GRAPHICS_FOUND: FALSE
MATERIAL_FONT_SUBSTITUTION_FOUND: FALSE
CORRUPT_FILES_FOUND: FALSE
MISSING_PACKAGED_FILES_FOUND: FALSE
UNEXPECTED_FILES_FOUND: FALSE
WRONG_FILENAMES_FOUND: FALSE
INCONSISTENT_VERSIONS_FOUND: FALSE
DEFECT_IDS: NONE`);assert(r.validation.ok,"stage25");
r=C.saveStandardStage(j,26,`APPROVED_INPUTS_USED: TRUE
APPROVED_INSTRUCTION_USED: TRUE
REQUIRED_TOOLS_RAN: TRUE
REQUIRED_TESTS_RAN: TRUE
UNAUTHORIZED_MODIFICATION_OCCURRED: FALSE
EVERY_MANDATORY_PRODUCT_REQUIREMENT_SATISFIED: TRUE
EVERY_MANDATORY_TEST_SUCCEEDED: TRUE
EVERY_SEMANTIC_REQUIREMENT_HAS_SUPPORTING_EVIDENCE: TRUE
UNRESOLVED_CRITICAL_OR_MAJOR_DEFECT_EXISTS: FALSE
PROCESS_CORRECTNESS: TRUE
PRODUCT_CORRECTNESS: TRUE`);assert(r.validation.ok,"stage26");
r=C.saveStandardStage(j,27,`MANDATORY_REQUIREMENTS_WITH_AFFIRMATIVE_EVIDENCE: 1
TOTAL_MANDATORY_REQUIREMENTS: 1
MANDATORY_VALIDATORS_SUCCEEDED: 3
TOTAL_MANDATORY_VALIDATORS: 3
MANDATORY_REQUIREMENTS_VIOLATED: 0
MANDATORY_REQUIREMENTS_UNESTABLISHED: 0
EVIDENCE: stages 22-26`);assert(r.validation.ok,"stage27");assert(j.releaseState==="ACCEPTED","release");
r=C.saveStandardStage(j,28,`ARTIFACT: ${artifactPath}
AUDITED_HASH: ${sha}
RELEASE_HASH: ${sha}
HASH_MATCH: TRUE
MODIFICATION_IDENTIFIED: NONE
NEW_PRODUCT_VERSION_IF_CHANGED: N_A
AFFECTED_VALIDATION_RERUN: N_A
RELEASE_GATE_RERUN: N_A`);assert(r.validation.ok,"stage28");
r=C.saveStandardStage(j,29,`REQ_ID: REQ-0001
SOURCE: SRC-0001
REQUIREMENT: REQ-0001
INSTRUCTION: INSTRUCTION-v001
EXECUTION: EXEC-0001
PRODUCT_ELEMENT: entire file
TEST: TEST-0001
TEST_RESULT: SATISFIED
EVIDENCE: exact bytes and hash
RELEASE_DECISION: ACCEPTED
CHAIN_COMPLETE: TRUE`);assert(r.validation.ok,"stage29");
r=C.saveStandardStage(j,30,`DEFECT_REGISTRY_EMPTY: TRUE
ALL_STILL_APPLICABLE_REGRESSION_TESTS_EXECUTED: TRUE`);assert(r.validation.ok,"stage30");
assert(!JSON.stringify(j).includes("$1"),"replacement token leaked into IDs");assert(/SOURCE_ID:\s*SRC-0001/.test(j.stages[1].result),"source ID");assert(/REQ_ID:\s*REQ-0001/.test(j.stages[3].result),"requirement ID");assert(/TEST_ID:\s*TEST-0001/.test(j.stages[5].result),"test ID");assert(/PRODUCT_ID:\s*PRODUCT-0001/.test(j.stages[20].result),"product ID");assert(/EXECUTION_ID:\s*EXEC-0001/.test(j.stages[20].result),"execution ID");assert(j.stages.every(s=>s.status==="COMPLETE"),"30 stages");assert(fs.readFileSync(artifactPath,"utf8")==="HELLO CLOSED LOOP\n","artifact");fs.writeFileSync("selftest-state-v2.json",JSON.stringify(j,null,2));console.log(JSON.stringify({status:"PASS",stagesComplete:30,candidateRuns:10,candidateVerifications:10,rerunRuns:10,rerunVerifications:10,confirmationRuns:10,confirmationVerifications:10,releaseState:j.releaseState,artifact:artifactPath,sha256:sha},null,2));

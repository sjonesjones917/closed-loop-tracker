(()=>{
'use strict';

const core=globalThis.closedLoopCore;
if(!core)throw new Error('workbook.js must load before workflow-schema.js.');

const PRODUCER=Object.freeze({
  HUMAN:'HUMAN',
  APPLICATION:'APPLICATION',
  AGENT:'AGENT',
  HUMAN_DECISION:'HUMAN_DECISION'
});
const PROJECT_SCHEMA=core.PROJECT_SCHEMA;
const WORKFLOW_ID=core.WORKFLOW_ID;
const STAGE_COUNT=core.STAGE_COUNT;
const RESPONSE_SCHEMA='closed-loop-stage-response/3';
const BUILD_IDENTITY='runtime-20260901-controlling-amendment-63';
const WORKER_PROTOCOL_VERSION='closed-loop-test-worker-protocol/1';
const VALUE_TYPES=Object.freeze(['STRING','INTEGER','NUMBER','BOOLEAN','STRING_ARRAY','REFERENCE','REFERENCE_ARRAY','OBJECT','OBJECT_ARRAY']);
const COLLECTION_POLICIES=Object.freeze({REPLACE_CURRENT_STAGE_SET:'REPLACE_CURRENT_STAGE_SET',APPEND_SCOPED:'APPEND_SCOPED',UPDATE_RESERVED:'UPDATE_RESERVED',APPEND_ONLY:'APPEND_ONLY',APPLICATION_DERIVED:'APPLICATION_DERIVED'});
const DEFAULT_RESOURCE_LIMITS=Object.freeze({maxRawResponseBytes:1048576,maxJsonDepth:32,maxRecordsPerCollection:250,maxEvidenceRecords:500,maxAttachments:25,maxTextFieldLength:200000});
const RESPONSE_TYPES=Object.freeze(['DATA_PROPOSAL','HUMAN_INPUT_REQUIRED','BLOCKED','EXECUTION_FAILED']);
const CONFLICT_POLICIES=Object.freeze(['reject','request clarification','controlled override']);
const TRUTH_VALUES=Object.freeze(['TRUE','FALSE','UNKNOWN']);
const EPISTEMIC_BASES=Object.freeze(['APPLICATION_OBSERVED','VERIFIED_EXTERNAL','EXTERNALLY_SUPPORTED','SELF_ASSERTED','NONE']);
const CURRENT_SCOPE_STATUSES=Object.freeze(['CURRENT','STALE']);
const FRESHNESS_STATUSES=Object.freeze(['CURRENT','EXPIRED','UNKNOWN','NOT_APPLICABLE']);
const CONTRADICTION_STATUSES=Object.freeze(['CLEAR','CONTRADICTED']);
const MATERIALITY_VALUES=Object.freeze(['MATERIAL','NONMATERIAL','UNKNOWN']);
const SEMANTIC_COVERAGE_VALUES=Object.freeze(['EQUIVALENT','PARTIAL','UNKNOWN','NOT_EQUIVALENT']);
const NORMATIVE_CLASSES=Object.freeze(['MANDATORY','CONDITIONAL','OPTIONAL','UNKNOWN']);
const APPLICABILITY_VALUES=Object.freeze(['APPLICABLE','NOT_APPLICABLE','UNKNOWN']);
const ENTAILMENT_VALUES=Object.freeze(['ESTABLISHES','REFUTES','SUPPORTS_ONLY','CONTEXT_ONLY','DOES_NOT_ADDRESS','UNKNOWN']);
const OBSERVATION_ORIGINS=Object.freeze(['NATIVE_APPLICATION_OBSERVATION','VERIFIED_EXTERNAL_OBSERVATION','EXTERNAL_CLAIM','HUMAN_OBSERVATION','AGENT_SEMANTIC_OBSERVATION']);
const TEST_ROLES=Object.freeze(['REQUIRED_PROOF','SUPPORTING_PROOF','ADVISORY','NEGATIVE_ONLY','REGRESSION']);
const PROOF_OPERATORS=Object.freeze(['LEAF','ALL_OF','ANY_OF','AT_LEAST_K']);
const PROOF_LEAF_TYPES=Object.freeze(['TEST_RESULT','TEST_RESULT_SET','OBSERVATION','OBSERVATION_OBLIGATION','ARTIFACT_IDENTITY','ARTIFACT_IDENTITY_OBLIGATION','ENVIRONMENT','ENVIRONMENT_DEPENDENCY','PROOF_EXPRESSION']);
const DEFECT_SEVERITIES=Object.freeze(['CRITICAL','MAJOR','MINOR','UNKNOWN']);
const DISCLOSURE_CLASSIFICATIONS=Object.freeze(['PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED','CREDENTIAL_SECRET','UNKNOWN']);
const DELIVERY_STATES=Object.freeze(['AUTHORIZED','BLOCKED','WITHDRAWN_FOR_FUTURE_USE','SUPERSEDED']);
const RESERVATION_STATUSES=Object.freeze(['RESERVED','ACTIVE','ORPHANED','CANCELLED','ACCEPTED','SUPERSEDED']);
const REGRESSION_LIFECYCLE=Object.freeze(['ACTIVE','SUPERSEDED','RETIRED']);
const STAGE_OPERATIONS=Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>[i+1,Object.freeze(['COMPLETE'])]));
STAGE_OPERATIONS[1]=Object.freeze(['COMPLETE','SEMANTIC_CHALLENGE','RECONCILE_INTAKE']);
STAGE_OPERATIONS[2]=Object.freeze(['SEARCH_EXECUTION','ADEQUACY_REVIEW']);
STAGE_OPERATIONS[4]=Object.freeze(['COMPLETE','DISPOSITION_CHALLENGE','ATOMICITY_CHALLENGE','RECONCILE_REQUIREMENTS']);
STAGE_OPERATIONS[17]=Object.freeze(['FREEZE','EXECUTE_RUN','VERIFY','COMPARE','ROOT_CAUSE','REGRESSION','CORRECT']);
STAGE_OPERATIONS[19]=Object.freeze(['CONFIRM_FREEZE','EXECUTE_RUN','VERIFY','COMPARE','REGRESSION_VERIFY','CONFIRM']);
Object.freeze(STAGE_OPERATIONS);

const titleCase=value=>String(value||'').toLowerCase().replace(/(^|[_\s-])([a-z0-9])/g,(_,a,b)=>`${a?' ':''}${b.toUpperCase()}`).trim();
const field=(name,producer,options={})=>Object.freeze({
  name,label:options.label||titleCase(name),producer,
  editable:options.editable??(producer===PRODUCER.HUMAN||producer===PRODUCER.HUMAN_DECISION),
  valueType:options.valueType||'STRING',enumValues:Object.freeze([...(options.enumValues||[])]),nullable:options.nullable===true,
  requiredAtStage:options.requiredAtStage??null,
  responsePath:options.responsePath??(producer===PRODUCER.AGENT?`/stageData/${name}`:null),
  authority:options.authority||({[PRODUCER.HUMAN]:'User Job Input',[PRODUCER.APPLICATION]:'Deterministic application logic',[PRODUCER.AGENT]:'Validated accepted external-agent response',[PRODUCER.HUMAN_DECISION]:'Explicit human-authority decision'}[producer]),
  conflictPolicy:options.conflictPolicy||(producer===PRODUCER.APPLICATION?'reject':producer===PRODUCER.HUMAN?'request clarification':producer===PRODUCER.HUMAN_DECISION?'controlled override':'reject'),
  provenanceRequired:options.provenanceRequired??(producer===PRODUCER.AGENT),
  derivation:options.derivation??options.derivationKey??null,derivationKey:options.derivationKey??options.derivation??null,normalizerKey:options.normalizerKey??null,normalizer:options.normalizer??null,
  closedProperties:options.closedProperties?Object.freeze([...options.closedProperties]):null,help:options.help||''
});

const HUMAN_JOB_FIELDS=Object.freeze([
  'EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',
  'REQUIRED_OUTPUT_FORMAT','DEADLINE_OR_TEMPORAL_SCOPE','DESIRED_SOURCE_COUNT','KNOWN_AUTHORITATIVE_SOURCES',
  'AVAILABLE_TOOLS','PROHIBITED_ACTIONS','EXPLICIT_USER_REQUIREMENTS'
]);
const HUMAN_DECISION_JOB_FIELDS=Object.freeze(['JOB_TITLE','JOB_OWNER']);
const APPLICATION_JOB_FIELDS=Object.freeze([
  'JOB_ID','DATE_OPENED','CURRENT_ITERATION','CURRENT_STAGE','CURRENT_STATE','CURRENT_INPUT_VERSION',
  'CURRENT_SOURCE_SET_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION',
  'CURRENT_INSTRUCTION_VERSION','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_BLOCKERS',
  'NEXT_REQUIRED_ACTION','LATEST_EVIDENCE_REFERENCE','INPUT_SET_HASH_OR_MANIFEST','JOB_RECORD_STATUS',
  'STATUS_EVIDENCE'
]);
const AGENT_JOB_FIELDS=Object.freeze([
  'EXACT_DELIVERABLE_REQUESTED','ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS'
]);

function jobFieldDefinition(name){
  if(HUMAN_DECISION_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN_DECISION,{nullable:true,provenanceRequired:false});
  if(APPLICATION_JOB_FIELDS.includes(name))return field(name,PRODUCER.APPLICATION,{derivation:`Application derives ${name} from canonical project state.`});
  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});
  if(AGENT_JOB_FIELDS.includes(name))return field(name,PRODUCER.AGENT,{requiredAtStage:1,valueType:name==='INPUT_SET_CONTENTS'?'OBJECT':'STRING'});
  return field(name,PRODUCER.APPLICATION,{derivation:`Application owns unclassified job-control field ${name}.`});
}
const JOB_FIELDS=Object.freeze(Object.fromEntries([...new Set([...HUMAN_DECISION_JOB_FIELDS,...HUMAN_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])].map(name=>[name,jobFieldDefinition(name)])));


const RECORD_OWNERSHIP=Object.freeze({
  "sources": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "TITLE",
      "ISSUING_ORGANIZATION_OR_AUTHOR",
      "SOURCE_TYPE",
      "PUBLICATION_ORIGIN",
      "URL_REFERENCE",
      "PUBLICATION_UPDATE_DATE",
      "RETRIEVAL_DATE",
      "AUTHORITY_LEVEL",
      "AUTHORITY_ROLE",
      "RELEVANCE",
      "APPLICABLE_PORTIONS",
      "INSPECTION_STATUS",
      "CURRENCY_STATUS",
      "SUPERSESSION_STATUS",
      "CONTROLLING_STATE",
      "NOTES"
    ],
    "application": [
      "SOURCE_ID",
      "VERSION",
      "LOCAL_COPY_SHA256"
    ]
  },
  "sourceConflicts": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "CONFLICTING_PROPOSITION",
      "SOURCE_A_AUTHORITY",
      "SOURCE_B_AUTHORITY",
      "AUTHORITY_RESOLUTION_RULE",
      "CONTROLLING_SOURCE_OBJECTIVELY_ESTABLISHED",
      "RESOLUTION",
      "RESOLUTION_STATUS",
      "AFFECTED_WORK",
      "EVIDENCE"
    ],
    "application": [
      "CONFLICT_ID",
      "SOURCE_A",
      "SOURCE_B",
      "BLOCKER_ID"
    ]
  },
  "research": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "PASS_NUMBER",
      "EXACT_PORTION_EXAMINED",
      "MANDATORY_STATEMENTS",
      "RECOMMENDATIONS",
      "OPTIONAL_PRACTICES",
      "EXAMPLES",
      "EXPLANATORY_MATERIAL",
      "PROHIBITIONS",
      "EXCEPTIONS",
      "DEPENDENCIES",
      "APPLICABILITY_FACTS",
      "RESTRICTIONS",
      "INVALIDATING_MATERIAL",
      "FINDING_CLASSIFICATION",
      "SOURCE_EVIDENCE",
      "CANDIDATE_REQUIREMENT_REFS",
      "SATURATION_STATUS"
    ],
    "application": [
      "RESEARCH_ID",
      "SOURCE_ID"
    ]
  },
  "candidateRequirements": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "SOURCE_LOCATION",
      "CANDIDATE_OBLIGATION",
      "CLASSIFICATION",
      "APPLICABILITY",
      "DEPENDENCIES",
      "EVIDENCE"
    ],
    "application": [
      "CANDIDATE_REQ_ID",
      "SOURCE_ID",
      "STATUS"
    ]
  },
  "requirements": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "OBLIGATION",
      "REQUIREMENT_TYPE",
      "MANDATORY_OPTIONAL_STATUS",
      "SOURCE_LOCATION",
      "SOURCE_AUTHORITY",
      "USER_INPUT_RELATIONSHIP",
      "APPLICABILITY",
      "DEPENDENCIES",
      "PROHIBITIONS",
      "DEFINED_TERMS",
      "OBSERVABLE_SATISFACTION_CONDITION",
      "INTENDED_VERIFICATION_METHOD",
      "EXPECTED_EVIDENCE",
      "FAILURE_CONDITION",
      "SEVERITY",
      "NOTES"
    ],
    "application": [
      "REQ_ID",
      "SOURCE_ID",
      "STATUS"
    ]
  },
  "requirementResolutions": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "DEFECT_TYPE",
      "AFFECTED_REQ_IDS",
      "GOVERNING_EVIDENCE",
      "RESOLUTION",
      "CHANGED_REQUIREMENT_REFS",
      "AFFECTED_DOWNSTREAM_WORK"
    ],
    "application": [
      "RESOLUTION_ID",
      "RESULTING_REQUIREMENTS_VERSION",
      "STATUS"
    ]
  },
  "tests": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "TEST_TYPE",
      "EXECUTION_MODE",
      "REQUIRED_CAPABILITY",
      "ARTIFACT_REQUIREMENTS",
      "INPUTS",
      "TOOLS",
      "PROCEDURE",
      "EXPECTED_RESULT",
      "FAILURE_CONDITION",
      "EVIDENCE_TO_PRESERVE",
      "EXECUTABLE_KIND",
      "EXECUTABLE_SPEC",
      "EXECUTABLE_INPUT_BINDINGS"
    ],
    "application": [
      "TEST_ID",
      "REQ_ID",
      "STATUS",
      "EXECUTABLE_SPEC_VERSION",
      "EXECUTABLE_SPEC_SHA256"
    ]
  },
  "failureTests": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "VIOLATION_MODE",
      "FIXTURE",
      "EXPECTED_REJECTION",
      "ACTUAL_RESULT",
      "EXECUTION_OUTCOME",
      "EVIDENCE"
    ],
    "application": [
      "MUTATION_ID",
      "REQ_ID",
      "VALIDATOR_DEFECT_ID"
    ]
  },
  "instructions": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "OBJECTIVE",
      "AUTHORIZED_INPUTS",
      "FAILURE_HANDLING",
      "AUTHORITY_RULES",
      "SCOPE",
      "PROHIBITIONS",
      "DEFINED_TERMS",
      "ORDERED_PROCEDURE",
      "BRANCHES",
      "TOOL_REQUIREMENTS",
      "OUTPUT_CONTRACT",
      "FACTUAL_STATE_HANDLING",
      "REJECTION_BLOCKING_RULES",
      "COMPLETION_CONDITIONS",
      "REQUIREMENT_TRACEABILITY",
      "INSTRUCTION_TEXT"
    ],
    "application": [
      "INSTRUCTION_ID"
    ]
  },
  "preflightRecords": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "CLAUSE",
      "MULTIPLE_INTERPRETATIONS",
      "UNDEFINED_OBJECTS",
      "UNSUPPLIED_DEPENDENCIES",
      "INTERNAL_CONFLICTS",
      "UNAVAILABLE_CAPABILITIES",
      "OBJECTIVELY_VERIFIABLE",
      "RESPONSIBLE_OPERATION_ASSIGNED",
      "ORDER_CLEAR",
      "FAILURE_BEHAVIOR_DEFINED",
      "TRACEABILITY",
      "DETERMINATION",
      "FINDINGS",
      "CORRECTIONS",
      "EVIDENCE"
    ],
    "application": [
      "REVIEW_ID",
      "INSTRUCTION_ID"
    ]
  },
  "iterations": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "ITERATION_ID",
      "CANDIDATE_ID",
      "PREVIOUS_ITERATION_ID",
      "CHANGESET_ID",
      "PURPOSE",
      "STATUS",
      "LINEAGE",
      "EVIDENCE"
    ]
  },
  "candidateFreezes": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "CANDIDATE_ID",
      "ITERATION_ID",
      "COMPONENT_MANIFEST",
      "COMPONENT_VERSIONS",
      "COMPONENT_HASHES",
      "ROLE_DISTRIBUTION",
      "IMMUTABLE_LOCATIONS",
      "TOOL_CONFIGURATION",
      "SETTINGS",
      "PERMISSIONS",
      "LIMITATIONS",
      "BATCH_CHANGE_RULE",
      "STATUS",
      "EVIDENCE"
    ]
  },
  "runs": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "FRESH_CONTEXT_RECORD",
      "STARTED_AT",
      "ENDED_AT",
      "CONTAMINATION_CHECK",
      "TOOL_CONFIGURATION",
      "EXECUTION_STATUS",
      "COMPLETE_OUTPUT",
      "OUTPUT_ARTIFACT_IDENTITIES",
      "TOOL_FAILURES",
      "NOTES"
    ],
    "application": [
      "RUN_ID",
      "ITERATION_ID",
      "CANDIDATE_ID",
      "CONTEXT_ID",
      "OUTPUT_HASHES"
    ]
  },
  "verification": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "VERIFIER",
      "VERIFIER_CONTEXT_ID",
      "INPUTS",
      "PROCEDURE",
      "EXPECTED_RESULT",
      "OBSERVED_RESULT",
      "EXACT_EVIDENCE",
      "DETERMINATION",
      "UNDETERMINED_REASON"
    ],
    "application": [
      "VERIFICATION_ID",
      "REQ_ID",
      "RUN_ID",
      "TEST_ID",
      "DEFECT_ID"
    ,
      "INDEPENDENCE_STATUS"]
  },
  "comparisons": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "RUN_DETERMINATIONS",
      "INTERPRETATION_VARIANCE",
      "OUTPUT_VARIANCE",
      "AUTHORIZED_VARIANCE",
      "INCONCLUSIVE_TESTS",
      "REPEATED_FAILURE_PATTERNS",
      "UNIQUE_FAILURES",
      "CORRECTNESS_AFFECTING_VARIANCE",
      "DEFECT_IDS",
      "EVIDENCE"
    ],
    "application": [
      "COMPARISON_ID",
      "REQ_ID",
      "ALL_TEN_SATISFIED",
      "ANY_VIOLATION",
      "ANY_UNDETERMINED"
    ]
  },
  "defects": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "OBSERVED_FAILURE",
      "EXPECTED_CONDITION",
      "EVIDENCE",
      "SEVERITY",
      "ROOT_CAUSE_CATEGORY",
      "ROOT_CAUSE",
      "CORRECTION",
      "CHANGED_ARTIFACTS",
      "VERIFICATION_RESULT",
      "RELATIONSHIPS"
    ],
    "application": [
      "DEFECT_ID",
      "REQ_ID",
      "RUN_ID",
      "PRODUCT_ID",
      "REG_ID",
      "STATUS"
    ]
  },
  "rootCauses": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "CATEGORY",
      "LAYER_TRACE",
      "EARLIEST_DEFECTIVE_LAYER",
      "ROOT_CAUSE",
      "EVIDENCE",
      "DOWNSTREAM_INVALIDATION"
    ],
    "application": [
      "RCA_ID",
      "DEFECT_ID"
    ]
  },
  "regressions": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "FAILURE_FIXTURE",
      "REPRODUCTION_PROCEDURE",
      "DETECTION_METHOD",
      "CORRECTION",
      "PERMANENT_TEST_LOCATION",
      "APPLICABILITY",
      "RETIREMENT_AUTHORITY"
    ],
    "application": [
      "REG_ID",
      "DEFECT_ID",
      "REQ_ID",
      "FIXTURE_IDENTITY_HASH",
      "PRE_CORRECTION_RESULT",
      "PRE_CORRECTION_EVIDENCE",
      "POST_CORRECTION_RESULT",
      "POST_CORRECTION_EVIDENCE",
      "ACTIVE_RETIRED_STATE"
    ]
  },
  "changes": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "TRIGGERING_DEFECT_IDS",
      "ROOT_CAUSE_ANALYSIS",
      "RESPONSIBLE_LAYER",
      "OLD_ARTIFACT_VERSION",
      "EXACT_MODIFICATION",
      "NEW_ARTIFACT_VERSION",
      "DOWNSTREAM_INVALIDATION",
      "REQUIRED_RERUNS",
      "INSTRUCTION_CHANGE_DETERMINATION",
      "REQUIRED_REPEATED_PREFLIGHT",
      "JUSTIFIED_UNCHANGED_ARTIFACTS",
      "EVIDENCE"
    ],
    "application": [
      "CHANGESET_ID",
      "AUTHORIZATION"
    ]
  },
  "convergenceRecords": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "FAILED_CONDITIONS",
      "RETURN_STAGES",
      "EVIDENCE"
    ],
    "application": [
      "CONVERGENCE_ID",
      "ITERATION_ID",
      "REQUIREMENT_COVERAGE",
      "VERIFICATION_COVERAGE",
      "REGRESSION_SUCCESS",
      "CRITICAL_DEFECT_COUNT",
      "MAJOR_DEFECT_COUNT",
      "MANDATORY_UNRESOLVED_UNKNOWN_COUNT",
      "CORRECTNESS_AFFECTING_CONTRADICTION_COUNT",
      "CORRECTNESS_AFFECTING_AMBIGUITY_COUNT",
      "UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE_COUNT",
      "CONVERGED"
    ]
  },
  "confirmationRecords": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "ZERO_MATERIAL_CHANGES",
      "VERSION_HASH_COMPARISON",
      "TEN_NEW_CONTEXTS",
      "COMPLETE_TEST_RESULTS",
      "REGRESSION_RESULTS",
      "COMPARISON_RESULTS",
      "NEW_DEFECTS",
      "NEW_REQUIREMENTS",
      "NEW_FAILURE_CASES",
      "NEW_VARIANCE",
      "DETERMINATION",
      "EVIDENCE"
    ],
    "application": [
      "CONFIRMATION_ID",
      "SOURCE_ITERATION_ID",
      "CONFIRMATION_ITERATION_ID"
    ]
  },
  "baselines": {
    "human": [],
    "humanDecision": [
      "HUMAN_AUTHORIZATION"
    ],
    "agent": [],
    "application": [
      "BASELINE_ID",
      "SUPPORTING_CONFIRMATION_ID",
      "APPROVED_VERSIONS",
      "HASHES",
      "IMMUTABLE_ARTIFACT_RECORDS",
      "AUTHORIZED_RECIPIENT_ROLES",
      "CONTROLLED_STORAGE",
      "STATUS",
      "EVIDENCE"
    ]
  },
  "products": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "BASELINE_MATERIALS",
      "EXECUTION_TIMESTAMPS",
      "TOOL_CONFIGURATION",
      "DEVIATIONS",
      "FAILURES"
    ],
    "application": [
      "PRODUCT_ID",
      "PRODUCT_VERSION",
      "BASELINE_ID",
      "EXECUTION_ID",
      "PRODUCTION_CONTEXT_ID",
      "INSTRUCTION_VERSION",
      "GENERATED_ARTIFACT_INVENTORY",
      "STATUS"
    ]
  },
  "deterministicResults": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "TOOL_AND_VERSION",
      "PROCEDURE",
      "EXPECTED_RESULT",
      "ACTUAL_RESULT",
      "DETERMINATION",
      "EVIDENCE"
    ],
    "application": [
      "RESULT_ID",
      "PRODUCT_ID",
      "PRODUCT_SHA256",
      "TEST_ID",
      "DEFECT_ID",
      "APPLICATION_DETERMINATION",
      "RUNTIME_VERSION",
      "TEST_SPEC_SHA256",
      "INPUT_ARTIFACT_IDENTITIES",
      "RUNTIME_OBSERVATIONS"
    ]
  },
  "meaningResults": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "PRODUCT_LOCATION",
      "EXTERNAL_SOURCE_EVIDENCE",
      "REQUIRED_MEANING",
      "OBSERVED_MEANING",
      "EVIDENCE_BASED_COMPARISON",
      "DETERMINATION",
      "UNDETERMINED_REASON"
    ],
    "application": [
      "MEANING_REVIEW_ID",
      "REQ_ID",
      "TEST_ID",
      "PRODUCT_ID",
      "DEFECT_ID"
    ]
  },
  "adversarialResults": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "ATTACK",
      "METHOD",
      "EXPECTED_BEHAVIOR",
      "ACTUAL_RESULT",
      "DETERMINATION",
      "SEVERITY",
      "EVIDENCE"
    ],
    "application": [
      "ATTACK_ID",
      "PRODUCT_ID",
      "TEST_ID",
      "REG_ID",
      "DEFECT_ID"
    ]
  },
  "representationInspections": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "REQUIRED_BY_TRACE",
      "TRANSFORMATION_CHAIN",
      "TRANSFORMATION_TOOLS_VERSIONS",
      "RENDERING_OPENING_EVIDENCE",
      "OBSERVATIONS",
      "DETERMINATION",
      "EVIDENCE"
    ],
    "application": [
      "INSPECTION_ID",
      "ARTIFACT_ID",
      "FILENAME",
      "VERSION",
      "BYTE_SIZE",
      "SHA256",
      "BEFORE_AFTER_HASHES",
      "DEFECT_ID"
    ]
  },
  "processAudits": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "APPROVED_INPUTS_VS_ACTUAL",
      "APPROVED_INSTRUCTION_VS_ACTUAL",
      "APPROVED_TOOLS_VS_ACTUAL",
      "REQUIRED_TESTS_VS_EXECUTED",
      "UNAUTHORIZED_MODIFICATION",
      "AUTHORIZED_CHANGES",
      "CHAIN_OF_CUSTODY",
      "PROCESS_DEFECTS",
      "BLOCKERS",
      "PROCESS_DETERMINATION",
      "PROCESS_EVIDENCE"
    ],
    "application": [
      "PROCESS_AUDIT_ID"
    ]
  },
  "productAudits": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "VALIDATOR_RESULTS",
      "MEANING_VERIFICATION_RESULTS",
      "PRODUCT_DEFECTS",
      "BLOCKERS",
      "PRODUCT_DETERMINATION",
      "PRODUCT_EVIDENCE"
    ],
    "application": [
      "PRODUCT_AUDIT_ID",
      "MANDATORY_REQUIREMENT_COUNT",
      "AFFIRMATIVE_SATISFACTION_COUNT",
      "MANDATORY_TEST_COUNT",
      "CRITICAL_DEFECTS",
      "MAJOR_DEFECTS",
      "MANDATORY_UNKNOWNS"
    ]
  },
  "releaseGateReviews": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "OBSERVED_BLOCKERS",
      "OBSERVED_VIOLATIONS",
      "OBSERVED_MISSING_EVIDENCE",
      "CONTROLLING_RULE_ANALYSIS",
      "EVIDENCE"
    ],
    "application": [
      "GATE_REVIEW_ID",
      "PRODUCT_ID",
      "BASELINE_ID"
    ]
  },
  "releaseRecords": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "RELEASE_ID",
      "PRODUCT_ID",
      "BASELINE_ID",
      "DETERMINATION",
      "MANDATORY_REQUIREMENT_COUNTS",
      "AFFIRMATIVE_EVIDENCE_COUNTS",
      "VIOLATED_COUNTS",
      "UNDETERMINED_COUNTS",
      "VALIDATOR_COUNTS",
      "FAILED_VALIDATORS",
      "NOT_RUN_VALIDATORS",
      "UNKNOWN_VALIDATORS",
      "CRITICAL_DEFECTS",
      "MAJOR_DEFECTS",
      "BLOCKING_REQUIREMENTS",
      "VIOLATIONS",
      "FAILED_TESTS",
      "UNRESOLVED_DEFECTS",
      "BLOCKERS",
      "CONTROLLING_DECISION_RULE",
      "CONTROLLING_EVIDENCE"
    ]
  },
  "artifactIdentities": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "IDENTITY_ID",
      "ARTIFACT_ID",
      "AUDITED_FILENAME",
      "AUDITED_VERSION",
      "AUDITED_STORAGE_REFERENCE",
      "AUDITED_BYTE_SIZE",
      "AUDITED_SHA256",
      "RELEASE_FILENAME",
      "RELEASE_VERSION",
      "RELEASE_STORAGE_REFERENCE",
      "RELEASE_BYTE_SIZE",
      "PRE_DELIVERY_SHA256",
      "EXACT_HASH_MATCH",
      "EXACT_SIZE_MATCH",
      "POST_AUDIT_MODIFICATION_EVIDENCE",
      "AUTHORIZATION"
    ]
  },
  "evidenceInvestigations": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "MISSING_LINK",
      "INVESTIGATION",
      "FOUND_EVIDENCE",
      "UNRESOLVED_REASON",
      "RECOMMENDED_ACTION",
      "EVIDENCE"
    ],
    "application": [
      "INVESTIGATION_ID",
      "REQ_ID"
    ]
  },
  "evidenceChains": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "CHAIN_ID",
      "REQ_ID",
      "AUTHORITY_ID",
      "INSTRUCTION_ID",
      "EXECUTION_ID",
      "PRODUCT_ELEMENT",
      "TEST_ID",
      "TEST_RESULT_ID",
      "EVIDENCE_ID",
      "RELEASE_DECISION_ID",
      "ARTIFACT_HASH_IDENTITY",
      "STATUS",
      "MISSING_LINKS"
    ]
  },
  "blockers": {
    "human": [],
    "humanDecision": [
      "MISSING_ITEM_TYPE",
      "MISSING_FACT_INPUT_AUTHORITY_EVIDENCE_CAPABILITY_DECISION_RULE",
      "AFFECTED_REQUIREMENTS",
      "AFFECTED_TESTS",
      "AFFECTED_ARTIFACTS",
      "WHY_WORK_CANNOT_CONTINUE",
      "ATTEMPTED_RESOLUTIONS",
      "DOWNSTREAM_WORK_STOPPED",
      "OWNER",
      "RESOLUTION_EVIDENCE",
      "CLOSURE",
      "REEVALUATION",
      "REQUIRED_REVALIDATION"
    ],
    "agent": [],
    "application": [
      "BLOCKER_ID",
      "STATUS"
    ]
  },
  "freshContexts": {
    "human": [],
    "humanDecision": [
      "EXTERNAL_CONTEXT_IDENTIFIER",
      "ROLE",
      "AUTHORIZED_PROJECT_INPUTS",
      "AUTHORIZED_EXTERNAL_SOURCE_MATERIAL",
      "FROZEN_ARTIFACT_VERSIONS",
      "TOOL_AVAILABILITY",
      "CONTAMINATION_STATUS",
      "OUTPUT_IDENTITY",
      "DEVIATIONS",
      "EVIDENCE",
      "USABILITY_DETERMINATION"
    ],
    "agent": [],
    "application": [
      "CONTEXT_ID",
      "ITERATION_ID",
      "RUN_ID"
    ]
  },
  "evidenceRecords": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "KIND",
      "DESCRIPTION",
      "AUTHORITY_TYPE",
      "LOCATION",
      "CONTENT"
    ],
    "application": [
      "EVIDENCE_ID",
      "SOURCE_ID",
      "ATTACHMENT_ID",
      "SHA256",
      "STATUS",
      "APPLICATION_EVIDENCE_KIND",
      "APPLICATION_EVIDENCE_DESCRIPTION",
      "APPLICATION_EVIDENCE_CONTENT"
    ]
  },
  "artifacts": {
    "human": [],
    "humanDecision": [],
    "agent": [],
    "application": [
      "ARTIFACT_ID",
      "FILENAME",
      "TYPE",
      "VERSION",
      "BYTE_SIZE",
      "SHA256",
      "ROLE",
      "STORAGE_REFERENCE",
      "AVAILABILITY",
      "NOTES"
    ]
  }
});
const EXPLICIT_STAGE_FIELD_TYPES=Object.freeze({"1":{"ASSUMPTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AVAILABLE_TOOLS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DATE_OPENED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEADLINE_OR_TEMPORAL_SCOPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_DELIVERABLE_REQUESTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_USER_OBJECTIVE_VERBATIM":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPLICIT_USER_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_SET_CONTENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_SET_HASH_OR_MANIFEST":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_SET_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"JOB_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"JOB_OWNER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"JOB_RECORD_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"JOB_TITLE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_AUTHORITATIVE_SOURCES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROHIBITED_ACTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_OUTPUT_FORMAT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SUPPLIED_MATERIALS_INVENTORY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNKNOWN_INFORMATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"10":{"ALL_REQUIRED_COMPONENTS_PRESENT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ALL_RUNS_WILL_RECEIVE_IDENTICAL_FROZEN_MATERIALS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CHANGES_ALLOWED_DURING_BATCH":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FREEZE_DATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FREEZE_OWNER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FROZEN_COMPONENT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"HASHES_RECORDED_WHERE_PRACTICAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOL_CONFIGURATION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"11":{"CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTAMINATED_RUNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FRESH_CONTEXTS_CREATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FROZEN_EXECUTION_PACKAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUTS_SAVED_SEPARATELY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUNS_RECEIVING_EXACT_PACKAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUN_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"12":{"ACTIVE_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ACTUAL_MANDATORY_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPECTED_MANDATORY_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MISSING_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"REQUIREMENTS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SATISFIED_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"SELF_VALIDATED_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEST_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDETERMINED_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"VERIFICATION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"VIOLATED_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"13":{"COMPARISON_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CORRECTNESS_AFFECTING_DISAGREEMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INCONCLUSIVE_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROHIBITED_OUTPUT_VARIANCES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REPEATED_FAILURE_GROUPS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_SATISFIED_BY_ALL_TEN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_WITH_AT_LEAST_ONE_UNDETERMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_WITH_AT_LEAST_ONE_VIOLATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENT_COMPARISON_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNIQUE_FAILURES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"14":{"BLOCKED_ANALYSES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONFIRMED_ROOT_CAUSES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_ROOT_CAUSE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"ROOT_CAUSE_ANALYSIS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_MATERIAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNDETERMINED_ROOT_CAUSES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"15":{"CONFIRMED_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"CONFIRMED_DEFECTS_WITH_REGRESSION_TEST":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_TEST_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_TEST_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"POST_CORRECTION_SUCCESSES_PROVEN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRE_CORRECTION_FAILURES_PROVEN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSION_FIXTURE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNCONVERTED_CONFIRMED_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"16":{"ARTIFACTS_CHANGED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ARTIFACT_CHANGE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"CHANGE_SET_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DOWNSTREAM_VERIFICATIONS_INVALIDATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IF_EXECUTION_ONLY_DEFECT_WAS_INSTRUCTION_PRESERVED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_CHANGED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IN_PLACE_MODIFICATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_VERSIONS_CREATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PREFLIGHT_REPEATED_IF_CHANGED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RCA_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TRIGGERING_DEFECT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"17":{"CHANGESET_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COMPARE_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CORRECTIONS_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTE_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IDENTICAL_PACKAGE_CONFIRMED_FOR_ALL_RUNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_FROZEN_VERSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OLD_CONVERSATIONS_CONTINUED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PREVIOUS_CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PREVIOUS_ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRIOR_OUTPUTS_WITHHELD":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSION_TESTS_ADDED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ROOT_CAUSE_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUN_NAMESPACE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEN_NEW_CONTEXTS_CREATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERIFY_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"18":{"ALL_CONDITIONS_SIMULTANEOUSLY_TRUE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"CRITICAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILED_CONDITIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_CORRECTNESS_AFFECTING_AMBIGUITIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_CORRECTNESS_AFFECTING_CONTRADICTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MAJOR_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MANDATORY_REQUIREMENTS_WITH_AFFIRMATIVE_APPLICABLE_VERIFICATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENTS_WITH_COMPLETE_SPECIFICATION_AND_APPLICABILITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENT_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"MANDATORY_UNRESOLVED_UNKNOWNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MANDATORY_VERIFICATION_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"METRICS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSION_TEST_SUCCESS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RETURN_STAGE_FOR_EACH_FAILURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SUCCESSFUL_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_STILL_APPLICABLE_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNEXPLAINED_CORRECTNESS_AFFECTING_EXECUTION_VARIANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"19":{"ALL_REGRESSION_TESTS_RUN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"COMPLETE_TEST_SUITE_RUN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONFIRMATION_ACCEPTANCE_CRITERIA_SATISFIED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONFIRMATION_ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CROSS_RUN_COMPARISON_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INJECTED_DEFECTS_NOT_DETECTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_CORRECTNESS_AFFECTING_VARIANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_CRITICAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_MAJOR_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_REQUIREMENTS_DISCOVERED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_RETURN_STAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUNS_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SAME_FROZEN_PACKAGE_USED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_CONVERGED_ITERATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEN_NEW_CONTEXTS_CREATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ZERO_CHANGE_AUDIT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"2":{"AUTHORITY_HIERARCHY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_CONTROLLING_SOURCES_EXAMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_CONFLICT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"SOURCE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"SOURCE_SET_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNRESOLVED_CONTROLLING_CONFLICTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"20":{"ALL_APPROVED_COMPONENTS_PRESENT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ALL_IMMUTABLE_FILES_HASHED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ANY_CHANGED_COMPONENT_RETAINS_BASELINE_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"APPROVED_VERSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_APPROVAL_DATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_FILE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_OWNER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_PACKAGE_SEPARATED_FROM_WORKING_FILES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SUPPORTING_CONFIRMATION_ITERATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNCHANGED_CONFIRMATION_SUCCEEDED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"}},"21":{"AFFECTED_VALIDATION_IDENTIFIED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_MATERIALS_SUPPLIED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EDITED_OUTSIDE_CONTROLLED_WORKFLOW":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EDIT_REQUIRED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTION_RECORD":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FRESH_CONTEXT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IF_YES_NEW_PRODUCT_VERSION_CREATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_FILE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"PRODUCTION_CONTEXT_REFERENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"22":{"APPLICABLE_MANDATORY_DETERMINISTIC_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DETERMINISTIC_TEST_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MISSING_TEST_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_HASHES_BEFORE_TEST":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_REJECTED_BY_MANDATORY_FAILURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SATISFIED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEST_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDETERMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"VALIDATOR_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VIOLATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"23":{"ACTIVE_MEANING_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVALUATOR_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVALUATOR_INDEPENDENT_FROM_GENERATOR":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MEANING_RECORDS_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MEANING_REQUIREMENT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MEANING_RUBRIC_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SATISFIED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDETERMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNSUPPORTED_BARE_CONCLUSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VIOLATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"24":{"ADVERSARIAL_CHECK_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"ADVERSARIAL_REVIEW_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ATTACKS_EXECUTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CRITICAL_DEFECTS_FOUND":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MAJOR_DEFECTS_FOUND":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_DEFECTS_FOUND":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSIONS_FOUND":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RETURN_TO_ROOT_CAUSE_REQUIRED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REVIEWER_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REVIEWER_INDEPENDENT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDETERMINED_ATTACKS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"25":{"APPROVED_BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DELIVERY_ARTIFACT_INVENTORY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FINAL_REPRESENTATION_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PACKAGE_INSPECTION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"PAGE_OR_VIEW_INSPECTION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REPRESENTATION_REVIEW_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_DELIVERY_ARTIFACTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_PACKAGED_FILES_OPENED_OR_TESTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_PACKAGED_FILES_REQUIRED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_PAGES_OR_VIEWS_INSPECTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_PAGES_OR_VIEWS_REQUIRED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TRANSFORMATION_CHAIN_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNRESOLVED_CRITICAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNRESOLVED_MAJOR_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNRESOLVED_REPRESENTATION_UNKNOWNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"26":{"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_REASON":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MISSING_EVIDENCE_LINKS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_CORRECTNESS_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_PRODUCT_DISCREPANCIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_REVIEW":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_CORRECTNESS_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_REVIEW":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RECONCILED_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RECONCILIATION_BLOCKER_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RECONCILIATION_DEFECT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REVIEW_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"27":{"AFFIRMATIVE_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKER_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKING_REQUIREMENT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_DECISION_RULE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_REASON":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DATE_AND_TIME":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILED_TEST_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENTS_DEMONSTRABLY_VIOLATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENTS_NOT_ESTABLISHED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENTS_WITH_AFFIRMATIVE_SUPPORTING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_VALIDATORS_FAILED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_VALIDATORS_SUCCEEDED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"MANDATORY_VALIDATORS_UNDETERMINED_OR_NOT_RUN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RECONCILED_REVIEW_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_GATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SELECTED_RELEASE_STATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_MANDATORY_VALIDATORS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNDETERMINED_OR_MISSING_TEST_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNRESOLVED_CRITICAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNRESOLVED_DEFECT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNRESOLVED_MAJOR_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"VIOLATED_REQUIREMENT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"28":{"ALL_RELEASE_HASHES_EQUAL_AUDITED_HASHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ANY_POST_REVIEW_MODIFICATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ARTIFACT_HASH_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"AUTHORIZATION_DATE_AND_TIME":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORIZATION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORIZED_BY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DELIVERY_AUTHORIZATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_AUTHORIZED_ARTIFACT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_AUTHORIZED_FILENAMES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HASH_ALGORITHM":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HASH_OPERATOR":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HASH_REVIEW_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HASH_TOOL_AND_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_GATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_GATE_STATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_ARTIFACTS_REHASHED_IMMEDIATELY_BEFORE_DELIVERY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_ARTIFACTS_REQUIRED_FOR_RELEASE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_ARTIFACTS_WITH_AUDITED_HASH":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_EXACT_HASH_MATCHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_HASH_MISMATCHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_UNKNOWN_HASH_COMPARISONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"29":{"ALL_MANDATORY_EVIDENCE_CHAINS_COMPLETE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE_CHAIN_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE_REPOSITORY_LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FINAL_EVIDENCE_CHAIN_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HASH_REVIEW_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INCOMPLETE_CHAIN_REQ_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"JOB_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_EVIDENCE_CHAIN_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"MANDATORY_REQUIREMENT_EVIDENCE_CHAIN_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_GATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REPRODUCTION_INSTRUCTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_MANDATORY_REQUIREMENTS_WITH_COMPLETE_CHAINS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_MANDATORY_REQUIREMENTS_WITH_INCOMPLETE_CHAINS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_MANDATORY_REQUIREMENTS_WITH_UNKNOWN_CHAIN_LINKS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNKNOWN_CHAIN_REQ_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"3":{"ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"CANDIDATE_REQUIREMENT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"CONFLICTING_OR_INVALIDATING_MATERIAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXCEPTIONS_AND_EDGE_CONDITIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"LATEST_PASS_NUMBER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESEARCH_GAPS_AND_BLOCKERS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESEARCH_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_RESEARCH_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"30":{"CONFIRMED_DEFECTS_MISSING_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"DEFECT_RECORDS_MISSING_REQUIRED_FIELDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_REGISTRY_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FINAL_REGISTRY_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FUTURE_BASELINE_REGRESSION_EXECUTION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"REGISTRY_HASH_OR_INTEGRITY_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGISTRY_IS_APPEND_ONLY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"REGISTRY_RETENTION_RULE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGISTRY_STORAGE_LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"REGRESSION_REGISTRY_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_ACTIVE_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_CONFIRMED_DEFECTS_WITH_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_DEFECT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_RETIRED_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"4":{"ATOMICITY_REVIEW_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKED_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONDITIONAL_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFINED_TERM_GAPS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OPTIONAL_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"5":{"APPLICABILITY_UNDETERMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CIRCULAR_DEPENDENCIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DUPLICATES_REMAINING":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IMPOSSIBLE_COMBINATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_REQUIREMENTS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_BLOCKERS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MISSING_PREREQUISITES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_REQUIREMENTS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_WITHOUT_VERIFICATION_PATH":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENT_DEFECT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDEFINED_TERMS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNRESOLVED_CONFLICTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNSUPPORTED_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"6":{"ACTIVE_MANDATORY_REQUIREMENTS_WITH_AT_LEAST_ONE_READY_TEST":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKED_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COVERAGE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_TEST_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEST_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TEST_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_ACTIVE_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"7":{"ACTIVE_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECTIVE_VALIDATORS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILURE_TEST_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"FAILURE_TEST_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"INVALID_FIXTURES_ACCEPTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MUTATION_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_WITH_AT_LEAST_ONE_FAILURE_TEST":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"8":{"AUTHORIZED_INPUTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COMPLETION_CRITERIA":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_RULES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFINED_TERMS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DRAFT_INSTRUCTION_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_FAILURE_RULES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_TRACE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"OBJECTIVE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_CONTRACT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_PROCEDURE_IN_ORDER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SCOPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_AUTHORITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOL_RULES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERIFICATION_AND_FAILURE_HANDLING":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"9":{"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVERY_SENTENCE_REVIEWED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_INSTRUCTION_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_MATERIAL_AMBIGUITIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_MATERIAL_CONFLICTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_INSTRUCTION_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PREFLIGHT_ITERATION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"PREFLIGHT_REVIEWER_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REVIEW_CONTEXT_INDEPENDENT_FROM_AUTHOR":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SENTENCE_REVIEW_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNAVAILABLE_REQUIRED_CAPABILITIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNVERIFIABLE_INSTRUCTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}}});
const EXPLICIT_RECORD_FIELD_TYPES=Object.freeze({"ARTIFACT":{"ARTIFACT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AVAILABILITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BYTE_SIZE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FILENAME":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NOTES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ROLE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SHA256":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STORAGE_REFERENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TYPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"ARTIFACT-IDENTITY":{"ARTIFACT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"AUDITED_BYTE_SIZE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUDITED_FILENAME":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUDITED_SHA256":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUDITED_STORAGE_REFERENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUDITED_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORIZATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_HASH_MATCH":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_SIZE_MATCH":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IDENTITY_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"POST_AUDIT_MODIFICATION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRE_DELIVERY_SHA256":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_BYTE_SIZE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_FILENAME":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_STORAGE_REFERENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"ATTACK":{"ACTUAL_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ATTACK":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ATTACK_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPECTED_BEHAVIOR":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"METHOD":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"SEVERITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"BASELINE":{"APPROVED_VERSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"OBJECT"},"AUTHORIZED_RECIPIENT_ROLES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLED_STORAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HASHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HUMAN_AUTHORIZATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IMMUTABLE_ARTIFACT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING_ARRAY"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SUPPORTING_CONFIRMATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"}},"BLOCKER":{"AFFECTED_ARTIFACTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AFFECTED_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AFFECTED_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ATTEMPTED_RESOLUTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKER_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CLOSURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DOWNSTREAM_WORK_STOPPED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MISSING_FACT_INPUT_AUTHORITY_EVIDENCE_CAPABILITY_DECISION_RULE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MISSING_ITEM_TYPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OWNER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REEVALUATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_REVALIDATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESOLUTION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"WHY_WORK_CANNOT_CONTINUE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"CANDIDATE":{"BATCH_CHANGE_RULE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COMPONENT_HASHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COMPONENT_MANIFEST":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"OBJECT_ARRAY"},"COMPONENT_VERSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"OBJECT"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IMMUTABLE_LOCATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING_ARRAY"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"LIMITATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PERMISSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ROLE_DISTRIBUTION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SETTINGS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOL_CONFIGURATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"CANDIDATE-REQ":{"APPLICABILITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CANDIDATE_OBLIGATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CANDIDATE_REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CLASSIFICATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEPENDENCIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"SOURCE_LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"CHAIN":{"ARTIFACT_HASH_IDENTITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"AUTHORITY_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CHAIN_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"MISSING_LINKS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ELEMENT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_DECISION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEST_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"TEST_RESULT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"CHAIN-INVESTIGATION":{"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FOUND_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INVESTIGATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INVESTIGATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MISSING_LINK":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RECOMMENDED_ACTION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"UNRESOLVED_REASON":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"CHANGESET":{"AUTHORIZATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CHANGESET_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DOWNSTREAM_INVALIDATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_MODIFICATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_CHANGE_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"JUSTIFIED_UNCHANGED_ARTIFACTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_ARTIFACT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OLD_ARTIFACT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_REPEATED_PREFLIGHT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_RERUNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESPONSIBLE_LAYER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ROOT_CAUSE_ANALYSIS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TRIGGERING_DEFECT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"COMPARISON":{"ALL_TEN_SATISFIED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ANY_UNDETERMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ANY_VIOLATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"AUTHORIZED_VARIANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COMPARISON_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CORRECTNESS_AFFECTING_VARIANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INCONCLUSIVE_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INTERPRETATION_VARIANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_VARIANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REPEATED_FAILURE_PATTERNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"RUN_DETERMINATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNIQUE_FAILURES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"CONFIRMATION":{"COMPARISON_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COMPLETE_TEST_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONFIRMATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONFIRMATION_ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_FAILURE_CASES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_VARIANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSION_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"TEN_NEW_CONTEXTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERSION_HASH_COMPARISON":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ZERO_MATERIAL_CHANGES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"CONTEXT":{"AUTHORIZED_EXTERNAL_SOURCE_MATERIAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORIZED_PROJECT_INPUTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTAMINATION_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTEXT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEVIATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXTERNAL_CONTEXT_IDENTIFIER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FROZEN_ARTIFACT_VERSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"OUTPUT_IDENTITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ROLE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUN_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"TOOL_AVAILABILITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"USABILITY_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"CONVERGENCE":{"CONVERGED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONVERGENCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CORRECTNESS_AFFECTING_AMBIGUITY_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"CORRECTNESS_AFFECTING_CONTRADICTION_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"CRITICAL_DEFECT_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILED_CONDITIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"MAJOR_DEFECT_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MANDATORY_UNRESOLVED_UNKNOWN_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"REGRESSION_SUCCESS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"REQUIREMENT_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"RETURN_STAGES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"VERIFICATION_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"}},"DEFECT":{"CHANGED_ARTIFACTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CORRECTION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPECTED_CONDITION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBSERVED_FAILURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"REG_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"RELATIONSHIPS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"ROOT_CAUSE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ROOT_CAUSE_CATEGORY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUN_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"SEVERITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERIFICATION_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"DETERMINISTIC-RESULT":{"ACTUAL_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPECTED_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCEDURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"PRODUCT_SHA256":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESULT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEST_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"TOOL_AND_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"EVIDENCE":{"ATTACHMENT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"AUTHORITY_TYPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTENT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DESCRIPTION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KIND":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SHA256":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"GATE-REVIEW":{"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"CONTROLLING_RULE_ANALYSIS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"GATE_REVIEW_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBSERVED_BLOCKERS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBSERVED_MISSING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBSERVED_VIOLATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"}},"INSPECTION":{"ARTIFACT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"BEFORE_AFTER_HASHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BYTE_SIZE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FILENAME":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSPECTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBSERVATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RENDERING_OPENING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_BY_TRACE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SHA256":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TRANSFORMATION_CHAIN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TRANSFORMATION_TOOLS_VERSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"ITERATION":{"CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"CHANGESET_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"LINEAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PREVIOUS_ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"PURPOSE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"MEANING-REVIEW":{"DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE_BASED_COMPARISON":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXTERNAL_SOURCE_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MEANING_REVIEW_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBSERVED_MEANING":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"PRODUCT_LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_MEANING":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"UNDETERMINED_REASON":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"MUTATION":{"ACTUAL_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPECTED_REJECTION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FIXTURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MUTATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"VALIDATOR_DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"VIOLATION_MODE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"PREFLIGHT-REVIEW":{"CLAUSE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CORRECTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILURE_BEHAVIOR_DEFINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FINDINGS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"INTERNAL_CONFLICTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MULTIPLE_INTERPRETATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBJECTIVELY_VERIFIABLE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ORDER_CLEAR":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESPONSIBLE_OPERATION_ASSIGNED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REVIEW_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TRACEABILITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNAVAILABLE_CAPABILITIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDEFINED_OBJECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNSUPPLIED_DEPENDENCIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"PROCESS-AUDIT":{"APPROVED_INPUTS_VS_ACTUAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"APPROVED_INSTRUCTION_VS_ACTUAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"APPROVED_TOOLS_VS_ACTUAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORIZED_CHANGES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKERS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CHAIN_OF_CUSTODY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_AUDIT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_TESTS_VS_EXECUTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNAUTHORIZED_MODIFICATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"PRODUCT":{"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"BASELINE_MATERIALS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEVIATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTION_TIMESTAMPS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILURES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"GENERATED_ARTIFACT_INVENTORY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING_ARRAY"},"INSTRUCTION_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCTION_CONTEXT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOL_CONFIGURATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"PRODUCT-AUDIT":{"AFFIRMATIVE_SATISFACTION_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"BLOCKERS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CRITICAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MAJOR_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MANDATORY_REQUIREMENT_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MANDATORY_TEST_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MANDATORY_UNKNOWNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MEANING_VERIFICATION_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_AUDIT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VALIDATOR_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"PRODUCTION-INSTRUCTION":{"AUTHORITY_RULES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORIZED_INPUTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BRANCHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COMPLETION_CONDITIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFINED_TERMS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FACTUAL_STATE_HANDLING":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILURE_HANDLING":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_TEXT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBJECTIVE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ORDERED_PROCEDURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_CONTRACT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROHIBITIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REJECTION_BLOCKING_RULES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENT_TRACEABILITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SCOPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOL_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"RCA":{"CATEGORY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"DOWNSTREAM_INVALIDATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EARLIEST_DEFECTIVE_LAYER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"LAYER_TRACE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RCA_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ROOT_CAUSE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"REG":{"ACTIVE_RETIRED_STATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"APPLICABILITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CORRECTION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"DETECTION_METHOD":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILURE_FIXTURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FIXTURE_IDENTITY_HASH":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PERMANENT_TEST_LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"POST_CORRECTION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"POST_CORRECTION_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRE_CORRECTION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRE_CORRECTION_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REG_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REPRODUCTION_PROCEDURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"RETIREMENT_AUTHORITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"REG-EXEC":{"CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"EVIDENCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"EXECUTED_AT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"PHASE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"REG_EXEC_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REG_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"RELEASE":{"AFFIRMATIVE_EVIDENCE_COUNTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"BLOCKERS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKING_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_DECISION_RULE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CRITICAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILED_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILED_VALIDATORS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MAJOR_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MANDATORY_REQUIREMENT_COUNTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NOT_RUN_VALIDATORS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"RELEASE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDETERMINED_COUNTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNKNOWN_VALIDATORS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNRESOLVED_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"VALIDATOR_COUNTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VIOLATED_COUNTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VIOLATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"REQ":{"APPLICABILITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFINED_TERMS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEPENDENCIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPECTED_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILURE_CONDITION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INTENDED_VERIFICATION_METHOD":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_OPTIONAL_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NOTES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBLIGATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBSERVABLE_SATISFACTION_CONDITION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROHIBITIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENT_TYPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SEVERITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_AUTHORITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"SOURCE_LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"USER_INPUT_RELATIONSHIP":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"REQ-RESOLUTION":{"AFFECTED_DOWNSTREAM_WORK":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AFFECTED_REQ_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CHANGED_REQUIREMENT_REFS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_TYPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"GOVERNING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESOLUTION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESOLUTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESULTING_REQUIREMENTS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"RESEARCH":{"APPLICABILITY_FACTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CANDIDATE_REQUIREMENT_REFS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEPENDENCIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_PORTION_EXAMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXAMPLES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXCEPTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPLANATORY_MATERIAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FINDING_CLASSIFICATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INVALIDATING_MATERIAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_STATEMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OPTIONAL_PRACTICES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PASS_NUMBER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROHIBITIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RECOMMENDATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESEARCH_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESTRICTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SATURATION_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"}},"RUN":{"CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"COMPLETE_OUTPUT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTAMINATION_CHECK":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTEXT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"ENDED_AT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTION_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FRESH_CONTEXT_RECORD":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"NOTES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_ARTIFACT_IDENTITIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_HASHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUN_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STARTED_AT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOL_CONFIGURATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOL_FAILURES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"SOURCE":{"APPLICABLE_PORTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORITY_LEVEL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORITY_ROLE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_STATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CURRENCY_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSPECTION_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ISSUING_ORGANIZATION_OR_AUTHOR":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"LOCAL_COPY_SHA256":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NOTES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PUBLICATION_ORIGIN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PUBLICATION_UPDATE_DATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEVANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RETRIEVAL_DATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_TYPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SUPERSESSION_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TITLE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"URL_REFERENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"SOURCE-CONFLICT":{"AFFECTED_WORK":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORITY_RESOLUTION_RULE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKER_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"CONFLICTING_PROPOSITION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONFLICT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_SOURCE_OBJECTIVELY_ESTABLISHED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESOLUTION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESOLUTION_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_A":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"SOURCE_A_AUTHORITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_B":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"SOURCE_B_AUTHORITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"TEST":{"EVIDENCE_TO_PRESERVE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPECTED_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILURE_CONDITION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCEDURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEST_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEST_TYPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOLS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"TRACE":{"EVIDENCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"IMPLEMENTED_BEHAVIOR":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"INSTRUCTION_LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TRACE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"VERIFICATION":{"DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPECTED_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INDEPENDENCE_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBSERVED_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCEDURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"RUN_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"TEST_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"UNDETERMINED_REASON":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERIFICATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERIFIER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERIFIER_CONTEXT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}}});
const RECORD_FIELD_TYPE_OVERRIDES=Object.freeze({
  'TEST':Object.freeze({
    TEST_TYPE:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['DETERMINISTIC','MEANING','ADVERSARIAL']),nullable:false,normalizerKey:null,closedProperties:null}),
    EXECUTION_MODE:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['APPLICATION_DETERMINISTIC','EXTERNAL_AGENT_TOOL','INDEPENDENT_AGENT_REVIEW','HUMAN_INSPECTION','EXTERNAL_SYSTEM','UNAVAILABLE']),nullable:false,normalizerKey:null,closedProperties:null}),
    REQUIRED_CAPABILITY:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),
    ARTIFACT_REQUIREMENTS:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})
  }),
  'MUTATION':Object.freeze({EXECUTION_OUTCOME:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['REJECTED_INVALID','ACCEPTED_INVALID','UNDETERMINED','NOT_RUN']),nullable:false,normalizerKey:null,closedProperties:null})}),
  'MEANING-REVIEW':Object.freeze({TEST_ID:Object.freeze({valueType:'REFERENCE',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),
  'ATTACK':Object.freeze({TEST_ID:Object.freeze({valueType:'REFERENCE',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),REG_ID:Object.freeze({valueType:'REFERENCE',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),
  'ARTIFACT':Object.freeze({BYTE_SIZE:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),
  'ARTIFACT-IDENTITY':Object.freeze({AUDITED_BYTE_SIZE:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),RELEASE_BYTE_SIZE:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),EXACT_HASH_MATCH:Object.freeze({valueType:'BOOLEAN',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),EXACT_SIZE_MATCH:Object.freeze({valueType:'BOOLEAN',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),
  'BASELINE':Object.freeze({HASHES:Object.freeze({valueType:'OBJECT',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),
  'CANDIDATE':Object.freeze({COMPONENT_HASHES:Object.freeze({valueType:'OBJECT',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),
  'CHAIN':Object.freeze({TEST_ID:Object.freeze({valueType:'REFERENCE_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),TEST_RESULT_ID:Object.freeze({valueType:'STRING_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),EVIDENCE_ID:Object.freeze({valueType:'REFERENCE_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),ARTIFACT_HASH_IDENTITY:Object.freeze({valueType:'REFERENCE_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),MISSING_LINKS:Object.freeze({valueType:'STRING_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),
  'RELEASE':Object.freeze({MANDATORY_REQUIREMENT_COUNTS:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),AFFIRMATIVE_EVIDENCE_COUNTS:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),VIOLATED_COUNTS:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),UNDETERMINED_COUNTS:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),VALIDATOR_COUNTS:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),FAILED_VALIDATORS:Object.freeze({valueType:'STRING_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),UNKNOWN_VALIDATORS:Object.freeze({valueType:'STRING_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),BLOCKING_REQUIREMENTS:Object.freeze({valueType:'STRING_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),VIOLATIONS:Object.freeze({valueType:'STRING_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),BLOCKERS:Object.freeze({valueType:'STRING_ARRAY',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})})
});
const STAGE_FIELD_TYPE_OVERRIDES=Object.freeze({
  '1':Object.freeze({DESIRED_SOURCE_COUNT:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:true,normalizerKey:null,closedProperties:null})}),
  '2':Object.freeze({SOURCE_APPLICABILITY_DETERMINATION:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['APPLICABLE_SOURCES_ESTABLISHED','NO_APPLICABLE_EXTERNAL_SOURCE','UNDETERMINED']),nullable:false,normalizerKey:null,closedProperties:null})})
});
const AMENDMENT_STAGE_FIELD_NAMES=Object.freeze({
1:Object.freeze(['SEMANTIC_CHALLENGE_REQUIRED','SEMANTIC_CHALLENGE_STATUS','CHALLENGE_CONTEXT_IDS','CHALLENGE_FINDING_RECORDS','UNRESOLVED_OMISSION_CHALLENGES','DISCLOSURE_CLASSIFICATION_SUMMARY','PROMPT_INJECTION_BOUNDARY_APPLIED']),
2:Object.freeze(['SOURCE_SEARCH_CONTRACT_ID','SEARCH_UNIVERSE','SEARCH_PROCEDURE','SEARCH_LOCATIONS','SEARCH_QUERIES_OR_STRATEGIES','SEARCH_CUTOFF','SEARCH_LIMITATIONS','SEARCH_EXECUTION_EVIDENCE','DISCOVERY_RISK','SEARCH_ADEQUACY_REVIEW_ID','SOURCE_AUTHENTICITY_SUMMARY','SOURCE_FRESHNESS_SUMMARY']),
3:Object.freeze(['SOURCE_AUTHENTICITY_REFERENCES','SOURCE_FRESHNESS_REFERENCES','TIME_SENSITIVE_FINDINGS','SUPERSEDED_MATERIAL','RESEARCH_EPISTEMIC_LIMITATIONS']),
4:Object.freeze(['PROPOSITION_RECORDS','PROPOSITION_MAPPING_RECORDS','PROPOSED_NORMATIVE_CLASSIFICATIONS','CONDITIONAL_ACTIVATION_PROPOSITIONS','PROPOSED_APPLICABILITY_RECORDS','OBLIGATION_DISPOSITION_CHALLENGE_RECORDS','ATOMICITY_CHALLENGE_RECORDS','UNRESOLVED_SEMANTIC_CHALLENGES']),
5:Object.freeze(['PROPOSITION_EQUIVALENCE_REVIEWS','NORMATIVE_CLASSIFICATION_REVIEWS','APPLICABILITY_DETERMINATIONS','CONDITIONAL_ACTIVATION_REVIEWS','ATOMICITY_RESOLUTION_RECORDS','PROOF_STRUCTURE_GAPS','RELEASE_OBLIGATION_REDUCTION_REVIEWS']),
6:Object.freeze(['PROOF_OBLIGATION_SET_ID','PROOF_OBLIGATION_RECORDS','PROOF_EXPRESSION_RECORDS','TEST_PROPOSITION_RECORDS','TEST_SEMANTIC_COVERAGE_RECORDS','TEST_ROLE_RECORDS','RELEASE_BEARING_TESTS','EXPECTED_VARIANCE_CONTRACTS','REQUIRED_EPISTEMIC_BASES','REQUIRED_ENVIRONMENT_DEPENDENCIES','SEMANTIC_EQUIVALENCE_BLOCKERS']),
7:Object.freeze(['FAILURE_TEST_AVAILABILITY_CLASS','DEFERRED_EXECUTION_TRIGGER_STAGE','DEFERRED_EXECUTION_PLAN','DEFERRED_FAILURE_TEST_IDS','EXECUTABLE_NOW_FAILURE_TEST_IDS','FAILURE_OBSERVATION_IDS','FAILURE_ENTAILMENT_RECORDS']),
8:Object.freeze(['ENVIRONMENT_DEPENDENCY_INSTRUCTIONS','DISCLOSURE_AND_SECRET_HANDLING_RULES','DEFERRED_NEGATIVE_TEST_TRACE_RECORDS']),
9:Object.freeze(['INDEPENDENCE_DIMENSION_RECORDS','PROVIDER_CONTEXT_INDEPENDENCE_STATUS','APPLICATION_INPUT_ISOLATION_STATUS','ENVIRONMENT_ASSUMPTION_FINDINGS','PROOF_OBLIGATION_TRACE_FINDINGS','DISCLOSURE_FINDINGS']),
10:Object.freeze(['PROOF_OBLIGATION_SET_ID','ENVIRONMENT_MANIFEST_ID','EXTERNAL_DEPENDENCY_SET_ID','DISCLOSURE_POLICY_ID','FREEZE_INTEGRITY_BASIS','EXTERNAL_CHECKPOINT_ID']),
11:Object.freeze(['APPLICATION_SESSION_DISTINCTNESS','APPLICATION_INPUT_ISOLATION','USER_TRANSFER_CONFORMITY','PROVIDER_CONTEXT_INDEPENDENCE','INDEPENDENCE_LIMITATIONS','ENVIRONMENT_MANIFESTS','EXPECTED_VARIANCE_CONTRACT_ID','OPERATION_RESERVATION_IDS','PACKAGE_IDS','CHALLENGE_NONCES','INPUT_BINDING_BASES']),
12:Object.freeze(['REQUIRED_VERIFICATION_RELATION_SET_ID','REQUIRED_RELATION_TUPLES','PROPOSITION_IDS','OBSERVATION_IDS','ENTAILMENT_RELATION_IDS','EPISTEMIC_BASES','FRESHNESS_STATUSES','INDEPENDENCE_DIMENSION_RECORDS','INPUT_BINDING_BASES']),
13:Object.freeze(['EXPECTED_VARIANCE_CONTRACT_IDS','ALLOWED_VARIANCES','PROHIBITED_VARIANCES','UNKNOWN_VARIANCES','ENVIRONMENT_DIFFERENCE_RECORDS','PROPOSITION_STABILITY']),
14:Object.freeze(['AFFECTED_PROPOSITION_IDS','AFFECTED_PROOF_OBLIGATION_IDS','PROPOSED_SEVERITY','SEVERITY_REVIEW_ID','ACCEPTED_SEVERITY','SEVERITY_DISPUTE_STATUS']),
15:Object.freeze(['PROPOSITION_IDS','PROOF_OBLIGATION_IDS','PRE_CORRECTION_OBSERVATION_IDS','PRE_CORRECTION_ENTAILMENT_IDS','POST_CORRECTION_OBSERVATION_IDS','POST_CORRECTION_ENTAILMENT_IDS','RETIREMENT_STATUS','RETIREMENT_AUTHORITY_AND_EVIDENCE']),
16:Object.freeze(['CORRECTION_SET_ID','AFFECTED_RECORD_FAMILIES','EARLIEST_RESPONSIBLE_STAGE','RESPONSIBLE_STAGE_MAP_VERSION','ATOMIC_CHANGE_MEMBERS','PROOF_OBLIGATIONS_INVALIDATED','DELIVERY_RECORDS_SUPERSEDED_OR_WITHDRAWN']),
17:Object.freeze(['PROOF_OBLIGATION_SET_ID','REQUIRED_VERIFICATION_RELATION_SET_ID','ENVIRONMENT_MANIFEST_SET_ID','INDEPENDENCE_DIMENSION_SUMMARY','EXPECTED_VARIANCE_SUMMARY','DEFERRED_FAILURE_TEST_EXECUTIONS']),
18:Object.freeze(['TOTAL_MANDATORY_PROPOSITIONS','SATISFIED_MANDATORY_PROPOSITIONS','PROOF_OBLIGATION_COVERAGE','UNKNOWN_APPLICABILITY_COUNT','UNKNOWN_EQUIVALENCE_COUNT','UNKNOWN_ENTAILMENT_COUNT','EXPIRED_OR_UNKNOWN_FRESHNESS_COUNT','DUE_DEFERRED_TESTS_INCOMPLETE','EVIDENCE_CYCLE_COUNT','UNRESOLVED_SEMANTIC_CHALLENGES']),
19:Object.freeze(['CONFIRMATION_REQUIREMENT_CHALLENGE_COMPLETED','NEW_REQUIREMENT_CANDIDATES_FOUND','NEW_REQUIREMENT_CANDIDATE_IDS','CHALLENGE_SCOPE','CHALLENGE_EPISTEMIC_BASIS','PROVIDER_CONTEXT_INDEPENDENCE_SUMMARY','ENVIRONMENT_COMPARABILITY_SUMMARY']),
20:Object.freeze(['PROOF_OBLIGATION_SET_ID','ENVIRONMENT_DEPENDENCY_SET_ID','BACKUP_CHECKPOINT_ID','BASELINE_INTEGRITY_BASIS','BASELINE_EXTERNAL_AUTHENTICATION_STATUS']),
21:Object.freeze(['PRODUCT_ENVIRONMENT_MANIFEST_ID','PRODUCT_EXTERNAL_DEPENDENCY_SET_ID','PRODUCT_DISCLOSURE_CLASSIFICATION','PACKAGE_ID','OPERATION_RESERVATION_ID','CHALLENGE_NONCE','INPUT_BINDING_BASIS']),
22:Object.freeze(['PROPOSITION_IDS','PROOF_OBLIGATION_IDS','OBSERVATION_ORIGINS','OBSERVATION_IDS','ENTAILMENT_RELATION_IDS','EPISTEMIC_BASES','INPUT_BINDING_BASES','RUNTIME_BUILD_IDENTITY','TEST_WORKER_SHA256','PARSER_OR_ADAPTER_IDENTITIES','ENVIRONMENT_MANIFEST_IDS','FRESHNESS_STATUSES']),
23:Object.freeze(['PROPOSITION_IDS','OBSERVATION_IDS','ENTAILMENT_RELATION_IDS','EPISTEMIC_BASES','FRESHNESS_STATUSES','INDEPENDENCE_DIMENSION_RECORDS','BLINDNESS_DIMENSION_RECORDS','RESIDUAL_CONTEXT_RISK']),
24:Object.freeze(['TARGET_PROPOSITION_IDS','TARGET_PROOF_OBLIGATION_IDS','TARGET_REGRESSION_IDS','OBSERVATION_IDS','ENTAILMENT_RELATION_IDS','EPISTEMIC_BASES','BLINDNESS_DIMENSION_RECORDS','INDEPENDENCE_DIMENSION_RECORDS']),
25:Object.freeze(['INSPECTION_RESERVATION_ID','INSPECTED_ARTIFACT_IDS','INSPECTED_ARTIFACT_SHA256_VALUES','VIEWER_IDENTITY_AND_VERSION','OBSERVATION_IDS','ENTAILMENT_RELATION_IDS','INPUT_BINDING_BASIS','HUMAN_IDENTITY_ASSURANCE']),
26:Object.freeze(['PROOF_OBLIGATION_SET_ID','PROPOSITION_RECONCILIATION','APPLICABILITY_RECONCILIATION','EQUIVALENCE_RECONCILIATION','ENTAILMENT_RECONCILIATION','FRESHNESS_RECONCILIATION','ENVIRONMENT_DEPENDENCY_RECONCILIATION','EVIDENCE_CYCLE_FINDINGS']),
27:Object.freeze(['PRODUCT_RELEASE_ELIGIBILITY','PROOF_OBLIGATION_SET_ID','TOTAL_MANDATORY_PROPOSITIONS','SATISFIED_MANDATORY_PROPOSITIONS','VIOLATED_MANDATORY_PROPOSITIONS','UNDETERMINED_MANDATORY_PROPOSITIONS','UNKNOWN_APPLICABILITY_IDS','INSUFFICIENT_EPISTEMIC_BASIS_IDS','EXPIRED_EVIDENCE_IDS','DUE_DEFERRED_TEST_IDS','DEPENDENCY_BLOCKER_IDS','RELEASE_EVIDENCE_GRAPH_ACYCLIC']),
28:Object.freeze(['DELIVERY_ARTIFACT_IDENTITY_VERIFIED','HUMAN_DELIVERY_INTENT','HUMAN_DELIVERY_AUTHORIZATION_ID','DELIVERY_AUTHORIZATION_EFFECTIVE','FILENAME_NORMALIZATION_VERSION','FORMAT_INTERPRETATION_RECORDS','CURRENT_BYTE_REVERIFICATION_RECEIPT']),
29:Object.freeze(['PROOF_OBLIGATION_SET_ID','PROPOSITION_CHAIN_RECORDS','OBSERVATION_AND_ENTAILMENT_LINKS','EPISTEMIC_BASIS_COVERAGE','FRESHNESS_COVERAGE','ENVIRONMENT_DEPENDENCY_COVERAGE','EVIDENCE_CHAIN_SET_SHA256','JUSTIFICATION_CYCLE_COUNT','DELIVERY_AUTHORIZATION_EFFECTIVE']),
30:Object.freeze(['REGRESSION_RETIREMENT_RECORDS','REGISTRY_INTEGRITY_STATUS','REGISTRY_INTEGRITY_HASH','TERMINAL_PROOF_OBLIGATION_SET_HASH','DELIVERY_ID','DELIVERY_STATE','DELIVERY_RECORD_HASH','DELIVERY_AUTHORIZATION_EFFECTIVE','SUPERSEDED_OR_WITHDRAWN_DELIVERY_IDS','POST_RELEASE_REENTRY_STATE'])
});
const AMENDMENT_BOOLEAN_FIELDS=new Set(['SEMANTIC_CHALLENGE_REQUIRED','PROMPT_INJECTION_BOUNDARY_APPLIED','CONFIRMATION_REQUIREMENT_CHALLENGE_COMPLETED','PRODUCT_RELEASE_ELIGIBILITY','RELEASE_EVIDENCE_GRAPH_ACYCLIC','DELIVERY_ARTIFACT_IDENTITY_VERIFIED','HUMAN_DELIVERY_INTENT','DELIVERY_AUTHORIZATION_EFFECTIVE']);
const AMENDMENT_INTEGER_FIELDS=new Set(['TOTAL_MANDATORY_PROPOSITIONS','SATISFIED_MANDATORY_PROPOSITIONS','UNKNOWN_APPLICABILITY_COUNT','UNKNOWN_EQUIVALENCE_COUNT','UNKNOWN_ENTAILMENT_COUNT','EXPIRED_OR_UNKNOWN_FRESHNESS_COUNT','DUE_DEFERRED_TESTS_INCOMPLETE','EVIDENCE_CYCLE_COUNT','NEW_REQUIREMENT_CANDIDATES_FOUND','VIOLATED_MANDATORY_PROPOSITIONS','UNDETERMINED_MANDATORY_PROPOSITIONS','JUSTIFICATION_CYCLE_COUNT','EARLIEST_RESPONSIBLE_STAGE','DEFERRED_EXECUTION_TRIGGER_STAGE']);
const AMENDMENT_NUMBER_FIELDS=new Set(['PROOF_OBLIGATION_COVERAGE','EPISTEMIC_BASIS_COVERAGE','FRESHNESS_COVERAGE','ENVIRONMENT_DEPENDENCY_COVERAGE']);
const AMENDMENT_STRING_ARRAY_FIELDS=new Set(['CHALLENGE_CONTEXT_IDS','DEFERRED_FAILURE_TEST_IDS','EXECUTABLE_NOW_FAILURE_TEST_IDS','FAILURE_OBSERVATION_IDS','RELEASE_BEARING_TESTS','REQUIRED_EPISTEMIC_BASES','REQUIRED_ENVIRONMENT_DEPENDENCIES','OPERATION_RESERVATION_IDS','PACKAGE_IDS','CHALLENGE_NONCES','PROPOSITION_IDS','OBSERVATION_IDS','ENTAILMENT_RELATION_IDS','EPISTEMIC_BASES','FRESHNESS_STATUSES','EXPECTED_VARIANCE_CONTRACT_IDS','AFFECTED_PROPOSITION_IDS','AFFECTED_PROOF_OBLIGATION_IDS','PROOF_OBLIGATION_IDS','PRE_CORRECTION_OBSERVATION_IDS','PRE_CORRECTION_ENTAILMENT_IDS','POST_CORRECTION_OBSERVATION_IDS','POST_CORRECTION_ENTAILMENT_IDS','AFFECTED_RECORD_FAMILIES','PROOF_OBLIGATIONS_INVALIDATED','DELIVERY_RECORDS_SUPERSEDED_OR_WITHDRAWN','NEW_REQUIREMENT_CANDIDATE_IDS','OBSERVATION_ORIGINS','PARSER_OR_ADAPTER_IDENTITIES','ENVIRONMENT_MANIFEST_IDS','TARGET_PROPOSITION_IDS','TARGET_PROOF_OBLIGATION_IDS','TARGET_REGRESSION_IDS','INSPECTED_ARTIFACT_IDS','INSPECTED_ARTIFACT_SHA256_VALUES','UNKNOWN_APPLICABILITY_IDS','INSUFFICIENT_EPISTEMIC_BASIS_IDS','EXPIRED_EVIDENCE_IDS','DUE_DEFERRED_TEST_IDS','DEPENDENCY_BLOCKER_IDS','SUPERSEDED_OR_WITHDRAWN_DELIVERY_IDS']);
const AMENDMENT_OBJECT_ARRAY_FIELDS=new Set(['CHALLENGE_FINDING_RECORDS','PROPOSITION_RECORDS','PROPOSITION_MAPPING_RECORDS','PROPOSED_NORMATIVE_CLASSIFICATIONS','CONDITIONAL_ACTIVATION_PROPOSITIONS','PROPOSED_APPLICABILITY_RECORDS','OBLIGATION_DISPOSITION_CHALLENGE_RECORDS','ATOMICITY_CHALLENGE_RECORDS','PROPOSITION_EQUIVALENCE_REVIEWS','NORMATIVE_CLASSIFICATION_REVIEWS','APPLICABILITY_DETERMINATIONS','CONDITIONAL_ACTIVATION_REVIEWS','ATOMICITY_RESOLUTION_RECORDS','RELEASE_OBLIGATION_REDUCTION_REVIEWS','PROOF_OBLIGATION_RECORDS','PROOF_EXPRESSION_RECORDS','TEST_PROPOSITION_RECORDS','TEST_SEMANTIC_COVERAGE_RECORDS','TEST_ROLE_RECORDS','EXPECTED_VARIANCE_CONTRACTS','FAILURE_ENTAILMENT_RECORDS','INDEPENDENCE_DIMENSION_RECORDS','ENVIRONMENT_MANIFESTS','REQUIRED_RELATION_TUPLES','INPUT_BINDING_BASES','ALLOWED_VARIANCES','PROHIBITED_VARIANCES','UNKNOWN_VARIANCES','ENVIRONMENT_DIFFERENCE_RECORDS','ATOMIC_CHANGE_MEMBERS','DEFERRED_FAILURE_TEST_EXECUTIONS','FORMAT_INTERPRETATION_RECORDS','PROPOSITION_CHAIN_RECORDS','OBSERVATION_AND_ENTAILMENT_LINKS','REGRESSION_RETIREMENT_RECORDS']);
const AMENDMENT_OBJECT_FIELDS=new Set(['DEFERRED_EXECUTION_PLAN','DISCLOSURE_CLASSIFICATION_SUMMARY','SOURCE_AUTHENTICITY_SUMMARY','SOURCE_FRESHNESS_SUMMARY','INDEPENDENCE_DIMENSION_SUMMARY','EXPECTED_VARIANCE_SUMMARY','PROPOSITION_STABILITY','PROPOSITION_RECONCILIATION','APPLICABILITY_RECONCILIATION','EQUIVALENCE_RECONCILIATION','ENTAILMENT_RECONCILIATION','FRESHNESS_RECONCILIATION','ENVIRONMENT_DEPENDENCY_RECONCILIATION','EVIDENCE_CYCLE_FINDINGS','POST_RELEASE_REENTRY_STATE']);
const AMENDMENT_ENUM_FIELDS=Object.freeze({
  PROPOSED_SEVERITY:DEFECT_SEVERITIES,ACCEPTED_SEVERITY:DEFECT_SEVERITIES,
  RETIREMENT_STATUS:REGRESSION_LIFECYCLE,DELIVERY_STATE:DELIVERY_STATES,
  PRODUCT_DISCLOSURE_CLASSIFICATION:DISCLOSURE_CLASSIFICATIONS,
  FAILURE_TEST_AVAILABILITY_CLASS:Object.freeze(['EXECUTABLE_NOW','DEFERRED_TARGET_DEPENDENT','NOT_APPLICABLE','BLOCKED'])
});
const amendmentFieldType=name=>Object.freeze({valueType:AMENDMENT_BOOLEAN_FIELDS.has(name)?'BOOLEAN':AMENDMENT_INTEGER_FIELDS.has(name)?'INTEGER':AMENDMENT_NUMBER_FIELDS.has(name)?'NUMBER':AMENDMENT_STRING_ARRAY_FIELDS.has(name)?'STRING_ARRAY':AMENDMENT_OBJECT_ARRAY_FIELDS.has(name)?'OBJECT_ARRAY':AMENDMENT_OBJECT_FIELDS.has(name)?'OBJECT':'STRING',enumValues:Object.freeze([...(AMENDMENT_ENUM_FIELDS[name]||[])]),nullable:false,normalizerKey:null,closedProperties:null});
const AMENDMENT_STAGE_FIELD_TYPES=Object.freeze(Object.fromEntries(Object.entries(AMENDMENT_STAGE_FIELD_NAMES).map(([stage,names])=>[stage,Object.freeze(Object.fromEntries(names.map(name=>[name,amendmentFieldType(name)])))])));
function ownerFromPartition(partition,name,label){const hits=[['human',PRODUCER.HUMAN],['humanDecision',PRODUCER.HUMAN_DECISION],['agent',PRODUCER.AGENT],['application',PRODUCER.APPLICATION]].filter(([key])=>partition?.[key]?.includes(name));if(hits.length!==1)throw new Error(`${label} field ${name} must occur in exactly one ownership partition.`);return hits[0][1];}

function stageFieldProducer(stage,name){return ownerFromPartition(core.STAGES[Number(stage)-1]?.ownership,name,`Stage ${stage}`);}
const TEST_IR=Object.freeze({
  version:'closed-loop-test-spec/1',
  capability:'CLOSED_LOOP_TEST_IR',
  executableKinds:Object.freeze(['NONE','TEST_IR']),
  operations:Object.freeze(['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE']),
  limits:Object.freeze({maxTotalInputBytes:33554432,maxTextBytes:16777216,maxDecompressedBytes:67108864,maxSteps:128,maxSelectorDepth:32,maxParsedDepth:64,maxParsedNodes:250000,maxCollectionItems:100000,maxRegexPatternBytes:2048,maxRegexLength:2000,maxRegexInputBytes:2097152,maxCsvCells:250000,maxXmlNodes:100000,workerTimeoutMs:5000,maxArchiveExpansionBytes:67108864})
});
const TEST_IR_FORBIDDEN_STEP_KEYS=Object.freeze(['code','javascript','python','shell','command','eval','function','script']);
function validateTestIRSpec(spec){
  const runtime=globalThis.closedLoopTestRuntime;if(runtime?.validateSpec)return runtime.validateSpec(spec);
  const issues=[];
  if(!spec||typeof spec!=='object'||Array.isArray(spec))issues.push('EXECUTABLE_SPEC must be an object.');
  if(spec?.version!==TEST_IR.version)issues.push(`EXECUTABLE_SPEC.version must be ${TEST_IR.version}.`);
  if(!Array.isArray(spec?.steps)||!spec.steps.length)issues.push('EXECUTABLE_SPEC.steps must be a non-empty array.');
  if((spec?.steps?.length||0)>TEST_IR.limits.maxSteps)issues.push(`EXECUTABLE_SPEC exceeds ${TEST_IR.limits.maxSteps} steps.`);
  for(const [index,step] of (spec?.steps||[]).entries()){
    if(!step||typeof step!=='object'||Array.isArray(step)){issues.push(`Step ${index} must be an object.`);continue;}
    if(!TEST_IR.operations.includes(step.op))issues.push(`Step ${index} uses unsupported operation ${String(step.op||'UNKNOWN')}.`);
    for(const key of TEST_IR_FORBIDDEN_STEP_KEYS)if(Object.prototype.hasOwnProperty.call(step,key))issues.push(`Step ${index} contains forbidden executable field ${key}.`);
    if((step.op==='REGEX'||step.op==='ASSERT_MATCH')&&String(step.pattern??step.value??'').length>TEST_IR.limits.maxRegexLength)issues.push(`Step ${index} regex exceeds the deterministic runtime limit.`);
  }
  return {valid:issues.length===0,issues};
}
function validateTestIRBindings(bindings){
  const runtime=globalThis.closedLoopTestRuntime;if(runtime?.validateBindings)return runtime.validateBindings(bindings);
  const issues=[];
  if(!bindings||typeof bindings!=='object'||Array.isArray(bindings))return {valid:false,issues:['EXECUTABLE_INPUT_BINDINGS must be an object.']};
  for(const [name,binding] of Object.entries(bindings)){
    if(!/^[A-Z][A-Z0-9_]{0,63}$/.test(name))issues.push(`Invalid Test IR binding name ${name}.`);
    if(typeof binding==='string'){if(!binding.trim())issues.push(`Binding ${name} is empty.`);continue;}
    if(!binding||typeof binding!=='object'||Array.isArray(binding)){issues.push(`Binding ${name} must be an artifact ID string or a binding object.`);continue;}
    const allowed=new Set(['artifactId','source','artifactRole','filename']);
    for(const key of Object.keys(binding))if(!allowed.has(key))issues.push(`Binding ${name} contains unsupported key ${key}.`);
    if(binding.source&&!['CURRENT_PRODUCT','CURRENT_SCOPE'].includes(binding.source))issues.push(`Binding ${name} has unsupported source ${binding.source}.`);
    if(!String(binding.artifactId||binding.artifactRole||binding.filename||'').trim())issues.push(`Binding ${name} does not identify an artifact.`);
  }
  return {valid:issues.length===0,issues};
}
function validateTestIRTest(test){
  const get=key=>test?.fields?.[key]??test?.[key];
  const issues=[];
  if(String(get('EXECUTION_MODE')||'').toUpperCase()!=='APPLICATION_DETERMINISTIC')issues.push('Test is not routed to APPLICATION_DETERMINISTIC.');
  if(String(get('REQUIRED_CAPABILITY')||'').trim()!==TEST_IR.capability)issues.push(`REQUIRED_CAPABILITY must be ${TEST_IR.capability}.`);
  if(String(get('EXECUTABLE_KIND')||'').toUpperCase()!=='TEST_IR')issues.push('EXECUTABLE_KIND must be TEST_IR.');
  if(get('EXECUTABLE_SPEC_VERSION')!==TEST_IR.version)issues.push(`EXECUTABLE_SPEC_VERSION must be ${TEST_IR.version}.`);
  issues.push(...validateTestIRSpec(get('EXECUTABLE_SPEC')).issues,...validateTestIRBindings(get('EXECUTABLE_INPUT_BINDINGS')).issues);
  return {valid:issues.length===0,issues};
}
const ADDITIONAL_RECORD_FIELD_TYPES=Object.freeze({
  TEST:Object.freeze({
    EXECUTABLE_KIND:Object.freeze({valueType:'STRING',enumValues:TEST_IR.executableKinds,nullable:true,normalizerKey:null,closedProperties:null}),
    EXECUTABLE_SPEC_VERSION:Object.freeze({valueType:'STRING',enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),
    EXECUTABLE_SPEC:Object.freeze({valueType:'OBJECT',enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),
    EXECUTABLE_INPUT_BINDINGS:Object.freeze({valueType:'OBJECT',enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),
    EXECUTABLE_SPEC_SHA256:Object.freeze({valueType:'STRING',enumValues:[],nullable:true,normalizerKey:null,closedProperties:null})
  }),
  'DETERMINISTIC-RESULT':Object.freeze({
    APPLICATION_DETERMINATION:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['SATISFIED','VIOLATED','UNDETERMINED']),nullable:true,normalizerKey:null,closedProperties:null}),
    RUNTIME_VERSION:Object.freeze({valueType:'STRING',enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),
    TEST_SPEC_SHA256:Object.freeze({valueType:'STRING',enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),
    INPUT_ARTIFACT_IDENTITIES:Object.freeze({valueType:'STRING',enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),
    RUNTIME_OBSERVATIONS:Object.freeze({valueType:'STRING',enumValues:[],nullable:true,normalizerKey:null,closedProperties:null})
  }),
  EVIDENCE:Object.freeze({
    APPLICATION_EVIDENCE_KIND:Object.freeze({valueType:'STRING',enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),
    APPLICATION_EVIDENCE_DESCRIPTION:Object.freeze({valueType:'STRING',enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),
    APPLICATION_EVIDENCE_CONTENT:Object.freeze({valueType:'STRING',enumValues:[],nullable:true,normalizerKey:null,closedProperties:null})
  })
});

function stageFieldDefinition(stage,name){
  const producer=stageFieldProducer(stage,name),type=STAGE_FIELD_TYPE_OVERRIDES[String(stage)]?.[name]||AMENDMENT_STAGE_FIELD_TYPES[String(stage)]?.[name]||EXPLICIT_STAGE_FIELD_TYPES[String(stage)]?.[name];if(!type)throw new Error(`Stage ${stage} field ${name} has no explicit type metadata.`);
  return field(name,producer,{requiredAtStage:stage,valueType:type.valueType,enumValues:type.enumValues,nullable:type.nullable,normalizerKey:type.normalizerKey,closedProperties:type.closedProperties,derivationKey:producer===PRODUCER.APPLICATION?`stage${String(stage).padStart(2,'0')}.${name}`:null,responsePath:producer===PRODUCER.AGENT?`/stageData/${name}`:null,help:producer===PRODUCER.APPLICATION?'Read-only; recalculated by the application.':''});
}
const STAGE_FIELDS=Object.freeze(Object.fromEntries(core.STAGES.map(stage=>[
  stage.number,
  Object.freeze(Object.fromEntries(stage.fields.map(name=>[name,stageFieldDefinition(stage.number,name)])))
])));

function recordSchema({title,idField,prefix,stage,fields,required=[],relationships={},provenanceRequired=true,appendOnly=true,ownership,commitPolicy=COLLECTION_POLICIES.APPEND_SCOPED}){
  const relSet=new Set(Object.keys(relationships)),definitions={};
  for(const name of fields){
    const producer=ownerFromPartition(ownership,name,title),type=ADDITIONAL_RECORD_FIELD_TYPES[prefix]?.[name]||RECORD_FIELD_TYPE_OVERRIDES[prefix]?.[name]||EXPLICIT_RECORD_FIELD_TYPES[prefix]?.[name];if(!type)throw new Error(`${title} field ${name} has no explicit type metadata.`);
    definitions[name]=field(name,producer,{requiredAtStage:stage,responsePath:producer===PRODUCER.AGENT?`/records/{collection}/*/fields/${name}`:null,valueType:type.valueType,enumValues:type.enumValues,nullable:type.nullable,normalizerKey:type.normalizerKey,closedProperties:type.closedProperties,derivationKey:producer===PRODUCER.APPLICATION?`record.${prefix}.${name}`:null,provenanceRequired:producer===PRODUCER.AGENT?provenanceRequired:false});
  }
  const union=[...ownership.human,...ownership.humanDecision,...ownership.agent,...ownership.application];
  if(union.length!==fields.length||new Set(union).size!==fields.length||fields.some(name=>!union.includes(name)))throw new Error(`Ownership partition for ${title} is incomplete or overlapping.`);
  return Object.freeze({title,idField,prefix,stage,fields:Object.freeze(fields),required:Object.freeze(required),relationships:Object.freeze(relationships),fieldDefinitions:Object.freeze(definitions),ownership:Object.freeze(ownership),appendOnly,commitPolicy});
}

const RECORD_SCHEMAS=Object.freeze({
  sources:recordSchema({ownership:RECORD_OWNERSHIP.sources,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'External governing sources',idField:'SOURCE_ID',prefix:'SOURCE',stage:2,fields:[
    'SOURCE_ID','TITLE','ISSUING_ORGANIZATION_OR_AUTHOR','SOURCE_TYPE','PUBLICATION_ORIGIN','URL_REFERENCE','VERSION',
    'PUBLICATION_UPDATE_DATE','RETRIEVAL_DATE','AUTHORITY_LEVEL','AUTHORITY_ROLE','RELEVANCE','APPLICABLE_PORTIONS',
    'INSPECTION_STATUS','CURRENCY_STATUS','SUPERSESSION_STATUS','CONTROLLING_STATE','LOCAL_COPY_SHA256','NOTES'
  ],required:['TITLE','ISSUING_ORGANIZATION_OR_AUTHOR','SOURCE_TYPE','PUBLICATION_ORIGIN','URL_REFERENCE','AUTHORITY_LEVEL','AUTHORITY_ROLE','RELEVANCE','APPLICABLE_PORTIONS','INSPECTION_STATUS','CURRENCY_STATUS','SUPERSESSION_STATUS','CONTROLLING_STATE']}),
  sourceConflicts:recordSchema({ownership:RECORD_OWNERSHIP.sourceConflicts,title:'External-source conflicts',idField:'CONFLICT_ID',prefix:'SOURCE-CONFLICT',stage:2,fields:[
    'CONFLICT_ID','SOURCE_A','SOURCE_B','CONFLICTING_PROPOSITION','SOURCE_A_AUTHORITY','SOURCE_B_AUTHORITY','AUTHORITY_RESOLUTION_RULE',
    'CONTROLLING_SOURCE_OBJECTIVELY_ESTABLISHED','RESOLUTION','RESOLUTION_STATUS','AFFECTED_WORK','BLOCKER_ID','EVIDENCE'
  ],required:['CONFLICTING_PROPOSITION','SOURCE_A_AUTHORITY','SOURCE_B_AUTHORITY','AUTHORITY_RESOLUTION_RULE','RESOLUTION_STATUS','AFFECTED_WORK','EVIDENCE'],relationships:{SOURCE_A:'sources',SOURCE_B:'sources',BLOCKER_ID:'blockers'}}),
  research:recordSchema({ownership:RECORD_OWNERSHIP.research,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Source research',idField:'RESEARCH_ID',prefix:'RESEARCH',stage:3,fields:[
    'RESEARCH_ID','SOURCE_ID','PASS_NUMBER','EXACT_PORTION_EXAMINED','MANDATORY_STATEMENTS','RECOMMENDATIONS','OPTIONAL_PRACTICES','EXAMPLES',
    'EXPLANATORY_MATERIAL','PROHIBITIONS','EXCEPTIONS','DEPENDENCIES','APPLICABILITY_FACTS','RESTRICTIONS','INVALIDATING_MATERIAL',
    'FINDING_CLASSIFICATION','SOURCE_EVIDENCE','CANDIDATE_REQUIREMENT_REFS','SATURATION_STATUS'
  ],required:['PASS_NUMBER','EXACT_PORTION_EXAMINED','FINDING_CLASSIFICATION','SOURCE_EVIDENCE'],relationships:{SOURCE_ID:'sources'}}),
  candidateRequirements:recordSchema({ownership:RECORD_OWNERSHIP.candidateRequirements,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Candidate requirements',idField:'CANDIDATE_REQ_ID',prefix:'CANDIDATE-REQ',stage:3,fields:[
    'CANDIDATE_REQ_ID','SOURCE_ID','SOURCE_LOCATION','CANDIDATE_OBLIGATION','CLASSIFICATION','APPLICABILITY','DEPENDENCIES','EVIDENCE','STATUS'
  ],required:['SOURCE_LOCATION','CANDIDATE_OBLIGATION','CLASSIFICATION','APPLICABILITY','EVIDENCE'],relationships:{SOURCE_ID:'sources'}}),
  requirements:recordSchema({ownership:RECORD_OWNERSHIP.requirements,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Atomic requirements',idField:'REQ_ID',prefix:'REQ',stage:4,fields:[
    'REQ_ID','OBLIGATION','REQUIREMENT_TYPE','MANDATORY_OPTIONAL_STATUS','SOURCE_ID','SOURCE_LOCATION','SOURCE_AUTHORITY','USER_INPUT_RELATIONSHIP',
    'APPLICABILITY','DEPENDENCIES','PROHIBITIONS','DEFINED_TERMS','OBSERVABLE_SATISFACTION_CONDITION','INTENDED_VERIFICATION_METHOD',
    'EXPECTED_EVIDENCE','FAILURE_CONDITION','SEVERITY','STATUS','NOTES'
  ],required:['OBLIGATION','REQUIREMENT_TYPE','MANDATORY_OPTIONAL_STATUS','APPLICABILITY','OBSERVABLE_SATISFACTION_CONDITION','INTENDED_VERIFICATION_METHOD','EXPECTED_EVIDENCE','FAILURE_CONDITION','SEVERITY','STATUS'],relationships:{SOURCE_ID:'sources'}}),
  requirementResolutions:recordSchema({ownership:RECORD_OWNERSHIP.requirementResolutions,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Requirement-set resolutions',idField:'RESOLUTION_ID',prefix:'REQ-RESOLUTION',stage:5,fields:[
    'RESOLUTION_ID','DEFECT_TYPE','AFFECTED_REQ_IDS','GOVERNING_EVIDENCE','RESOLUTION','CHANGED_REQUIREMENT_REFS','RESULTING_REQUIREMENTS_VERSION','AFFECTED_DOWNSTREAM_WORK','STATUS'
  ],required:['DEFECT_TYPE','AFFECTED_REQ_IDS','GOVERNING_EVIDENCE','RESOLUTION','AFFECTED_DOWNSTREAM_WORK','STATUS']}),
  tests:recordSchema({ownership:RECORD_OWNERSHIP.tests,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Verification tests',idField:'TEST_ID',prefix:'TEST',stage:6,fields:[
    'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS','EXECUTABLE_SPEC_SHA256','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'
  ],required:['TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'],relationships:{REQ_ID:'requirements'}}),
  failureTests:recordSchema({ownership:RECORD_OWNERSHIP.failureTests,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Failure and mutation tests',idField:'MUTATION_ID',prefix:'MUTATION',stage:7,fields:[
    'MUTATION_ID','REQ_ID','VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','ACTUAL_RESULT','EXECUTION_OUTCOME','VALIDATOR_DEFECT_ID','EVIDENCE'
  ],required:['VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','EVIDENCE'],relationships:{REQ_ID:'requirements',VALIDATOR_DEFECT_ID:'defects'}}),
  instructions:recordSchema({ownership:RECORD_OWNERSHIP.instructions,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Production instructions',idField:'INSTRUCTION_ID',prefix:'PRODUCTION-INSTRUCTION',stage:8,fields:[
    'INSTRUCTION_ID','OBJECTIVE','AUTHORIZED_INPUTS','FAILURE_HANDLING','AUTHORITY_RULES','SCOPE','PROHIBITIONS','DEFINED_TERMS','ORDERED_PROCEDURE',
    'BRANCHES','TOOL_REQUIREMENTS','OUTPUT_CONTRACT','FACTUAL_STATE_HANDLING','REJECTION_BLOCKING_RULES','COMPLETION_CONDITIONS','REQUIREMENT_TRACEABILITY','INSTRUCTION_TEXT'
  ],required:['OBJECTIVE','AUTHORIZED_INPUTS','FAILURE_HANDLING','AUTHORITY_RULES','SCOPE','PROHIBITIONS','DEFINED_TERMS','ORDERED_PROCEDURE','TOOL_REQUIREMENTS','OUTPUT_CONTRACT','FACTUAL_STATE_HANDLING','REJECTION_BLOCKING_RULES','COMPLETION_CONDITIONS','REQUIREMENT_TRACEABILITY','INSTRUCTION_TEXT']}),
  preflightRecords:recordSchema({ownership:RECORD_OWNERSHIP.preflightRecords,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Independent instruction preflight',idField:'REVIEW_ID',prefix:'PREFLIGHT-REVIEW',stage:9,fields:[
    'REVIEW_ID','INSTRUCTION_ID','CLAUSE','MULTIPLE_INTERPRETATIONS','UNDEFINED_OBJECTS','UNSUPPLIED_DEPENDENCIES','INTERNAL_CONFLICTS','UNAVAILABLE_CAPABILITIES',
    'OBJECTIVELY_VERIFIABLE','RESPONSIBLE_OPERATION_ASSIGNED','ORDER_CLEAR','FAILURE_BEHAVIOR_DEFINED','TRACEABILITY','DETERMINATION','FINDINGS','CORRECTIONS','EVIDENCE'
  ],required:['CLAUSE','DETERMINATION','FINDINGS','EVIDENCE'],relationships:{INSTRUCTION_ID:'instructions'}}),
  iterations:recordSchema({ownership:RECORD_OWNERSHIP.iterations,commitPolicy:COLLECTION_POLICIES.APPLICATION_DERIVED,title:'Iteration controls',idField:'ITERATION_ID',prefix:'ITERATION',stage:10,fields:[
    'ITERATION_ID','CANDIDATE_ID','PREVIOUS_ITERATION_ID','CHANGESET_ID','PURPOSE','STATUS','LINEAGE','EVIDENCE'
  ],required:['PURPOSE','STATUS','LINEAGE','EVIDENCE'],relationships:{CANDIDATE_ID:'candidateFreezes',PREVIOUS_ITERATION_ID:'iterations',CHANGESET_ID:'changes'}}),
  candidateFreezes:recordSchema({ownership:RECORD_OWNERSHIP.candidateFreezes,commitPolicy:COLLECTION_POLICIES.APPLICATION_DERIVED,title:'Frozen candidates',idField:'CANDIDATE_ID',prefix:'CANDIDATE',stage:10,fields:[
    'CANDIDATE_ID','ITERATION_ID','COMPONENT_MANIFEST','COMPONENT_VERSIONS','COMPONENT_HASHES','ROLE_DISTRIBUTION','IMMUTABLE_LOCATIONS',
    'TOOL_CONFIGURATION','SETTINGS','PERMISSIONS','LIMITATIONS','BATCH_CHANGE_RULE','STATUS','EVIDENCE'
  ],required:['COMPONENT_MANIFEST','COMPONENT_VERSIONS','ROLE_DISTRIBUTION','IMMUTABLE_LOCATIONS','TOOL_CONFIGURATION','SETTINGS','PERMISSIONS','LIMITATIONS','BATCH_CHANGE_RULE','STATUS','EVIDENCE'],relationships:{ITERATION_ID:'iterations'}}),
  runs:recordSchema({ownership:RECORD_OWNERSHIP.runs,commitPolicy:COLLECTION_POLICIES.UPDATE_RESERVED,title:'Independent execution runs',idField:'RUN_ID',prefix:'RUN',stage:11,fields:[
    'RUN_ID','ITERATION_ID','CANDIDATE_ID','CONTEXT_ID','FRESH_CONTEXT_RECORD','STARTED_AT','ENDED_AT','CONTAMINATION_CHECK','TOOL_CONFIGURATION',
    'EXECUTION_STATUS','COMPLETE_OUTPUT','OUTPUT_ARTIFACT_IDENTITIES','OUTPUT_HASHES','TOOL_FAILURES','NOTES'
  ],required:['CONTEXT_ID','FRESH_CONTEXT_RECORD','CONTAMINATION_CHECK','TOOL_CONFIGURATION','EXECUTION_STATUS','COMPLETE_OUTPUT'],relationships:{ITERATION_ID:'iterations',CANDIDATE_ID:'candidateFreezes',CONTEXT_ID:'freshContexts'}}),
  verification:recordSchema({ownership:RECORD_OWNERSHIP.verification,commitPolicy:COLLECTION_POLICIES.APPEND_SCOPED,title:'Requirement-by-run verification',idField:'VERIFICATION_ID',prefix:'VERIFICATION',stage:12,fields:[
    'VERIFICATION_ID','REQ_ID','RUN_ID','TEST_ID','VERIFIER','VERIFIER_CONTEXT_ID','INDEPENDENCE_STATUS','INPUTS','PROCEDURE','EXPECTED_RESULT',
    'OBSERVED_RESULT','EXACT_EVIDENCE','DETERMINATION','DEFECT_ID','UNDETERMINED_REASON'
  ],required:['VERIFIER','VERIFIER_CONTEXT_ID','INPUTS','PROCEDURE','EXPECTED_RESULT','OBSERVED_RESULT','EXACT_EVIDENCE','DETERMINATION'],relationships:{REQ_ID:'requirements',RUN_ID:'runs',TEST_ID:'tests',DEFECT_ID:'defects'}}),
  comparisons:recordSchema({ownership:RECORD_OWNERSHIP.comparisons,commitPolicy:COLLECTION_POLICIES.APPEND_SCOPED,title:'Ten-run comparisons',idField:'COMPARISON_ID',prefix:'COMPARISON',stage:13,fields:[
    'COMPARISON_ID','REQ_ID','RUN_DETERMINATIONS','ALL_TEN_SATISFIED','ANY_VIOLATION','ANY_UNDETERMINED','INTERPRETATION_VARIANCE','OUTPUT_VARIANCE',
    'AUTHORIZED_VARIANCE','INCONCLUSIVE_TESTS','REPEATED_FAILURE_PATTERNS','UNIQUE_FAILURES','CORRECTNESS_AFFECTING_VARIANCE','DEFECT_IDS','EVIDENCE'
  ],required:['RUN_DETERMINATIONS','INTERPRETATION_VARIANCE','OUTPUT_VARIANCE','AUTHORIZED_VARIANCE','INCONCLUSIVE_TESTS','REPEATED_FAILURE_PATTERNS','UNIQUE_FAILURES','CORRECTNESS_AFFECTING_VARIANCE','EVIDENCE'],relationships:{REQ_ID:'requirements'}}),
  defects:recordSchema({ownership:RECORD_OWNERSHIP.defects,commitPolicy:COLLECTION_POLICIES.APPEND_ONLY,title:'Defects',idField:'DEFECT_ID',prefix:'DEFECT',stage:14,fields:[
    'DEFECT_ID','REQ_ID','RUN_ID','PRODUCT_ID','OBSERVED_FAILURE','EXPECTED_CONDITION','EVIDENCE','SEVERITY','ROOT_CAUSE_CATEGORY','ROOT_CAUSE','CORRECTION','CHANGED_ARTIFACTS','REG_ID','VERIFICATION_RESULT','STATUS','RELATIONSHIPS'
  ],required:['OBSERVED_FAILURE','EXPECTED_CONDITION','EVIDENCE','SEVERITY','STATUS'],relationships:{REQ_ID:'requirements',RUN_ID:'runs',PRODUCT_ID:'products',REG_ID:'regressions'}}),
  rootCauses:recordSchema({ownership:RECORD_OWNERSHIP.rootCauses,commitPolicy:COLLECTION_POLICIES.APPEND_SCOPED,title:'Root-cause analyses',idField:'RCA_ID',prefix:'RCA',stage:14,fields:[
    'RCA_ID','DEFECT_ID','CATEGORY','LAYER_TRACE','EARLIEST_DEFECTIVE_LAYER','ROOT_CAUSE','EVIDENCE','DOWNSTREAM_INVALIDATION'
  ],required:['CATEGORY','LAYER_TRACE','EARLIEST_DEFECTIVE_LAYER','ROOT_CAUSE','EVIDENCE','DOWNSTREAM_INVALIDATION'],relationships:{DEFECT_ID:'defects'}}),
  regressions:recordSchema({ownership:RECORD_OWNERSHIP.regressions,commitPolicy:COLLECTION_POLICIES.APPEND_ONLY,title:'Permanent regression tests',idField:'REG_ID',prefix:'REG',stage:15,fields:[
    'REG_ID','DEFECT_ID','REQ_ID','FAILURE_FIXTURE','FIXTURE_IDENTITY_HASH','REPRODUCTION_PROCEDURE','DETECTION_METHOD','PRE_CORRECTION_RESULT',
    'PRE_CORRECTION_EVIDENCE','CORRECTION','POST_CORRECTION_RESULT','POST_CORRECTION_EVIDENCE','PERMANENT_TEST_LOCATION','APPLICABILITY','ACTIVE_RETIRED_STATE','RETIREMENT_AUTHORITY'
  ],required:['FAILURE_FIXTURE','REPRODUCTION_PROCEDURE','DETECTION_METHOD','CORRECTION','PERMANENT_TEST_LOCATION','APPLICABILITY','ACTIVE_RETIRED_STATE'],relationships:{DEFECT_ID:'defects',REQ_ID:'requirements'}}),
  changes:recordSchema({ownership:RECORD_OWNERSHIP.changes,title:'Controlled changes and invalidations',idField:'CHANGESET_ID',prefix:'CHANGESET',stage:16,fields:[
    'CHANGESET_ID','TRIGGERING_DEFECT_IDS','ROOT_CAUSE_ANALYSIS','RESPONSIBLE_LAYER','OLD_ARTIFACT_VERSION','EXACT_MODIFICATION','NEW_ARTIFACT_VERSION',
    'DOWNSTREAM_INVALIDATION','REQUIRED_RERUNS','INSTRUCTION_CHANGE_DETERMINATION','REQUIRED_REPEATED_PREFLIGHT','JUSTIFIED_UNCHANGED_ARTIFACTS','AUTHORIZATION','EVIDENCE'
  ],required:['TRIGGERING_DEFECT_IDS','ROOT_CAUSE_ANALYSIS','RESPONSIBLE_LAYER','OLD_ARTIFACT_VERSION','EXACT_MODIFICATION','NEW_ARTIFACT_VERSION','DOWNSTREAM_INVALIDATION','REQUIRED_RERUNS','INSTRUCTION_CHANGE_DETERMINATION','JUSTIFIED_UNCHANGED_ARTIFACTS','EVIDENCE']}),
  convergenceRecords:recordSchema({ownership:RECORD_OWNERSHIP.convergenceRecords,commitPolicy:COLLECTION_POLICIES.APPLICATION_DERIVED,title:'Convergence calculations',idField:'CONVERGENCE_ID',prefix:'CONVERGENCE',stage:18,fields:[
    'CONVERGENCE_ID','ITERATION_ID','REQUIREMENT_COVERAGE','VERIFICATION_COVERAGE','REGRESSION_SUCCESS','CRITICAL_DEFECT_COUNT','MAJOR_DEFECT_COUNT',
    'MANDATORY_UNRESOLVED_UNKNOWN_COUNT','CORRECTNESS_AFFECTING_CONTRADICTION_COUNT','CORRECTNESS_AFFECTING_AMBIGUITY_COUNT',
    'UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE_COUNT','CONVERGED','FAILED_CONDITIONS','RETURN_STAGES','EVIDENCE'
  ],required:['ITERATION_ID','FAILED_CONDITIONS','RETURN_STAGES','EVIDENCE'],relationships:{ITERATION_ID:'iterations'}}),
  confirmationRecords:recordSchema({ownership:RECORD_OWNERSHIP.confirmationRecords,title:'Unchanged confirmation',idField:'CONFIRMATION_ID',prefix:'CONFIRMATION',stage:19,fields:[
    'CONFIRMATION_ID','SOURCE_ITERATION_ID','CONFIRMATION_ITERATION_ID','ZERO_MATERIAL_CHANGES','VERSION_HASH_COMPARISON','TEN_NEW_CONTEXTS','COMPLETE_TEST_RESULTS','REGRESSION_RESULTS','COMPARISON_RESULTS','NEW_DEFECTS','NEW_REQUIREMENTS','NEW_FAILURE_CASES','NEW_VARIANCE','DETERMINATION','EVIDENCE'
  ],required:['ZERO_MATERIAL_CHANGES','VERSION_HASH_COMPARISON','TEN_NEW_CONTEXTS','COMPLETE_TEST_RESULTS','REGRESSION_RESULTS','COMPARISON_RESULTS','NEW_DEFECTS','NEW_REQUIREMENTS','NEW_FAILURE_CASES','NEW_VARIANCE','DETERMINATION','EVIDENCE'],relationships:{SOURCE_ITERATION_ID:'iterations',CONFIRMATION_ITERATION_ID:'iterations'}}),
  baselines:recordSchema({ownership:RECORD_OWNERSHIP.baselines,commitPolicy:COLLECTION_POLICIES.APPLICATION_DERIVED,title:'Production baselines',idField:'BASELINE_ID',prefix:'BASELINE',stage:20,fields:[
    'BASELINE_ID','SUPPORTING_CONFIRMATION_ID','APPROVED_VERSIONS','HASHES','IMMUTABLE_ARTIFACT_RECORDS','AUTHORIZED_RECIPIENT_ROLES','CONTROLLED_STORAGE','HUMAN_AUTHORIZATION','STATUS','EVIDENCE'
  ],required:['APPROVED_VERSIONS','IMMUTABLE_ARTIFACT_RECORDS','AUTHORIZED_RECIPIENT_ROLES','CONTROLLED_STORAGE','HUMAN_AUTHORIZATION','STATUS','EVIDENCE'],relationships:{SUPPORTING_CONFIRMATION_ID:'confirmationRecords'}}),
  products:recordSchema({ownership:RECORD_OWNERSHIP.products,commitPolicy:COLLECTION_POLICIES.UPDATE_RESERVED,title:'Finished products',idField:'PRODUCT_ID',prefix:'PRODUCT',stage:21,fields:[
    'PRODUCT_ID','PRODUCT_VERSION','BASELINE_ID','EXECUTION_ID','PRODUCTION_CONTEXT_ID','BASELINE_MATERIALS','EXECUTION_TIMESTAMPS','INSTRUCTION_VERSION','TOOL_CONFIGURATION','DEVIATIONS','FAILURES','GENERATED_ARTIFACT_INVENTORY','STATUS'
  ],required:['PRODUCTION_CONTEXT_ID','BASELINE_MATERIALS','EXECUTION_TIMESTAMPS','TOOL_CONFIGURATION','DEVIATIONS','FAILURES','GENERATED_ARTIFACT_INVENTORY','STATUS'],relationships:{BASELINE_ID:'baselines',PRODUCTION_CONTEXT_ID:'freshContexts'}}),
  deterministicResults:recordSchema({ownership:RECORD_OWNERSHIP.deterministicResults,title:'Deterministic product verification',idField:'RESULT_ID',prefix:'DETERMINISTIC-RESULT',stage:22,fields:[
    'RESULT_ID','PRODUCT_ID','PRODUCT_SHA256','TEST_ID','APPLICATION_DETERMINATION','RUNTIME_VERSION','TEST_SPEC_SHA256','INPUT_ARTIFACT_IDENTITIES','RUNTIME_OBSERVATIONS','TOOL_AND_VERSION','PROCEDURE','EXPECTED_RESULT','ACTUAL_RESULT','DETERMINATION','EVIDENCE','DEFECT_ID'
  ],required:['TOOL_AND_VERSION','PROCEDURE','EXPECTED_RESULT','ACTUAL_RESULT','DETERMINATION','EVIDENCE'],relationships:{PRODUCT_ID:'products',TEST_ID:'tests',DEFECT_ID:'defects'}}),
  meaningResults:recordSchema({ownership:RECORD_OWNERSHIP.meaningResults,title:'Independent meaning verification',idField:'MEANING_REVIEW_ID',prefix:'MEANING-REVIEW',stage:23,fields:[
    'MEANING_REVIEW_ID','REQ_ID','TEST_ID','PRODUCT_ID','PRODUCT_LOCATION','EXTERNAL_SOURCE_EVIDENCE','REQUIRED_MEANING','OBSERVED_MEANING','EVIDENCE_BASED_COMPARISON','DETERMINATION','DEFECT_ID','UNDETERMINED_REASON'
  ],required:['TEST_ID','PRODUCT_LOCATION','EXTERNAL_SOURCE_EVIDENCE','REQUIRED_MEANING','OBSERVED_MEANING','EVIDENCE_BASED_COMPARISON','DETERMINATION'],relationships:{REQ_ID:'requirements',TEST_ID:'tests',PRODUCT_ID:'products',DEFECT_ID:'defects'}}),
  adversarialResults:recordSchema({ownership:RECORD_OWNERSHIP.adversarialResults,title:'Adversarial product verification',idField:'ATTACK_ID',prefix:'ATTACK',stage:24,fields:[
    'ATTACK_ID','PRODUCT_ID','TEST_ID','REG_ID','ATTACK','METHOD','EXPECTED_BEHAVIOR','ACTUAL_RESULT','DETERMINATION','DEFECT_ID','SEVERITY','EVIDENCE'
  ],required:['ATTACK','METHOD','EXPECTED_BEHAVIOR','ACTUAL_RESULT','DETERMINATION','SEVERITY','EVIDENCE'],relationships:{PRODUCT_ID:'products',TEST_ID:'tests',REG_ID:'regressions',DEFECT_ID:'defects'}}),
  representationInspections:recordSchema({ownership:RECORD_OWNERSHIP.representationInspections,title:'Final representation inspections',idField:'INSPECTION_ID',prefix:'INSPECTION',stage:25,fields:[
    'INSPECTION_ID','ARTIFACT_ID','FILENAME','VERSION','BYTE_SIZE','SHA256','REQUIRED_BY_TRACE','TRANSFORMATION_CHAIN','TRANSFORMATION_TOOLS_VERSIONS','BEFORE_AFTER_HASHES','RENDERING_OPENING_EVIDENCE','OBSERVATIONS','DEFECT_ID','DETERMINATION','EVIDENCE'
  ],required:['ARTIFACT_ID','REQUIRED_BY_TRACE','TRANSFORMATION_CHAIN','TRANSFORMATION_TOOLS_VERSIONS','RENDERING_OPENING_EVIDENCE','OBSERVATIONS','DETERMINATION','EVIDENCE'],relationships:{ARTIFACT_ID:'artifacts',DEFECT_ID:'defects'}}),
  processAudits:recordSchema({ownership:RECORD_OWNERSHIP.processAudits,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Process audits',idField:'PROCESS_AUDIT_ID',prefix:'PROCESS-AUDIT',stage:26,fields:[
    'PROCESS_AUDIT_ID','APPROVED_INPUTS_VS_ACTUAL','APPROVED_INSTRUCTION_VS_ACTUAL','APPROVED_TOOLS_VS_ACTUAL','REQUIRED_TESTS_VS_EXECUTED','UNAUTHORIZED_MODIFICATION','AUTHORIZED_CHANGES','CHAIN_OF_CUSTODY','PROCESS_DEFECTS','BLOCKERS','PROCESS_DETERMINATION','PROCESS_EVIDENCE'
  ],required:['APPROVED_INPUTS_VS_ACTUAL','APPROVED_INSTRUCTION_VS_ACTUAL','APPROVED_TOOLS_VS_ACTUAL','REQUIRED_TESTS_VS_EXECUTED','UNAUTHORIZED_MODIFICATION','AUTHORIZED_CHANGES','CHAIN_OF_CUSTODY','PROCESS_DEFECTS','BLOCKERS','PROCESS_DETERMINATION','PROCESS_EVIDENCE']}),
  productAudits:recordSchema({ownership:RECORD_OWNERSHIP.productAudits,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Product audits',idField:'PRODUCT_AUDIT_ID',prefix:'PRODUCT-AUDIT',stage:26,fields:[
    'PRODUCT_AUDIT_ID','MANDATORY_REQUIREMENT_COUNT','AFFIRMATIVE_SATISFACTION_COUNT','MANDATORY_TEST_COUNT','VALIDATOR_RESULTS','MEANING_VERIFICATION_RESULTS','CRITICAL_DEFECTS','MAJOR_DEFECTS','MANDATORY_UNKNOWNS','PRODUCT_DEFECTS','BLOCKERS','PRODUCT_DETERMINATION','PRODUCT_EVIDENCE'
  ],required:['VALIDATOR_RESULTS','MEANING_VERIFICATION_RESULTS','PRODUCT_DEFECTS','BLOCKERS','PRODUCT_DETERMINATION','PRODUCT_EVIDENCE']}),
  releaseGateReviews:recordSchema({ownership:RECORD_OWNERSHIP.releaseGateReviews,title:'Release-gate reviews',idField:'GATE_REVIEW_ID',prefix:'GATE-REVIEW',stage:27,fields:[
    'GATE_REVIEW_ID','PRODUCT_ID','BASELINE_ID','OBSERVED_BLOCKERS','OBSERVED_VIOLATIONS','OBSERVED_MISSING_EVIDENCE','CONTROLLING_RULE_ANALYSIS','EVIDENCE'
  ],required:['OBSERVED_BLOCKERS','OBSERVED_VIOLATIONS','OBSERVED_MISSING_EVIDENCE','CONTROLLING_RULE_ANALYSIS','EVIDENCE'],relationships:{PRODUCT_ID:'products',BASELINE_ID:'baselines'}}),
  releaseRecords:recordSchema({ownership:RECORD_OWNERSHIP.releaseRecords,commitPolicy:COLLECTION_POLICIES.APPLICATION_DERIVED,title:'Release determinations',idField:'RELEASE_ID',prefix:'RELEASE',stage:27,fields:[
    'RELEASE_ID','PRODUCT_ID','BASELINE_ID','DETERMINATION','MANDATORY_REQUIREMENT_COUNTS','AFFIRMATIVE_EVIDENCE_COUNTS','VIOLATED_COUNTS','UNDETERMINED_COUNTS','VALIDATOR_COUNTS','FAILED_VALIDATORS','NOT_RUN_VALIDATORS','UNKNOWN_VALIDATORS','CRITICAL_DEFECTS','MAJOR_DEFECTS','BLOCKING_REQUIREMENTS','VIOLATIONS','FAILED_TESTS','UNRESOLVED_DEFECTS','BLOCKERS','CONTROLLING_DECISION_RULE','CONTROLLING_EVIDENCE'
  ],required:[],relationships:{PRODUCT_ID:'products',BASELINE_ID:'baselines'}}),
  artifactIdentities:recordSchema({ownership:RECORD_OWNERSHIP.artifactIdentities,commitPolicy:COLLECTION_POLICIES.APPLICATION_DERIVED,title:'Pre-release artifact identity',idField:'IDENTITY_ID',prefix:'ARTIFACT-IDENTITY',stage:28,fields:[
    'IDENTITY_ID','ARTIFACT_ID','AUDITED_FILENAME','AUDITED_VERSION','AUDITED_STORAGE_REFERENCE','AUDITED_BYTE_SIZE','AUDITED_SHA256','RELEASE_FILENAME','RELEASE_VERSION','RELEASE_STORAGE_REFERENCE','RELEASE_BYTE_SIZE','PRE_DELIVERY_SHA256','EXACT_HASH_MATCH','EXACT_SIZE_MATCH','POST_AUDIT_MODIFICATION_EVIDENCE','AUTHORIZATION'
  ],required:[],relationships:{ARTIFACT_ID:'artifacts'}}),
  evidenceInvestigations:recordSchema({ownership:RECORD_OWNERSHIP.evidenceInvestigations,title:'Evidence-chain investigations',idField:'INVESTIGATION_ID',prefix:'CHAIN-INVESTIGATION',stage:29,fields:[
    'INVESTIGATION_ID','REQ_ID','MISSING_LINK','INVESTIGATION','FOUND_EVIDENCE','UNRESOLVED_REASON','RECOMMENDED_ACTION','EVIDENCE'
  ],required:['MISSING_LINK','INVESTIGATION','FOUND_EVIDENCE','UNRESOLVED_REASON','RECOMMENDED_ACTION','EVIDENCE'],relationships:{REQ_ID:'requirements'}}),
  evidenceChains:recordSchema({ownership:RECORD_OWNERSHIP.evidenceChains,commitPolicy:COLLECTION_POLICIES.APPLICATION_DERIVED,title:'Mandatory evidence chains',idField:'CHAIN_ID',prefix:'CHAIN',stage:29,fields:[
    'CHAIN_ID','REQ_ID','AUTHORITY_ID','INSTRUCTION_ID','EXECUTION_ID','PRODUCT_ELEMENT','TEST_ID','TEST_RESULT_ID','EVIDENCE_ID','RELEASE_DECISION_ID','ARTIFACT_HASH_IDENTITY','STATUS','MISSING_LINKS'
  ],required:[],relationships:{REQ_ID:'requirements',INSTRUCTION_ID:'instructions',TEST_ID:'tests',EVIDENCE_ID:'evidenceRecords',RELEASE_DECISION_ID:'releaseRecords',ARTIFACT_HASH_IDENTITY:'artifactIdentities'}}),
  instructionTraces:recordSchema({ownership:{human:[],humanDecision:[],agent:['INSTRUCTION_LOCATION','IMPLEMENTED_BEHAVIOR'],application:['TRACE_ID','REQ_ID','INSTRUCTION_ID','EVIDENCE_ID','STATUS']},title:'Instruction traces',idField:'TRACE_ID',prefix:'TRACE',stage:8,fields:['TRACE_ID','REQ_ID','INSTRUCTION_ID','INSTRUCTION_LOCATION','IMPLEMENTED_BEHAVIOR','EVIDENCE_ID','STATUS'],required:['INSTRUCTION_LOCATION','IMPLEMENTED_BEHAVIOR'],relationships:{REQ_ID:'requirements',INSTRUCTION_ID:'instructions',EVIDENCE_ID:'evidenceRecords'},commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET}),
  regressionExecutions:recordSchema({ownership:{human:[],humanDecision:[],agent:['PHASE','RESULT'],application:['REG_EXEC_ID','REG_ID','ITERATION_ID','CANDIDATE_ID','PRODUCT_ID','EVIDENCE_ID','EXECUTED_AT']},title:'Regression executions',idField:'REG_EXEC_ID',prefix:'REG-EXEC',stage:15,fields:['REG_EXEC_ID','REG_ID','ITERATION_ID','CANDIDATE_ID','PRODUCT_ID','PHASE','RESULT','EVIDENCE_ID','EXECUTED_AT'],required:['PHASE','RESULT'],relationships:{REG_ID:'regressions',ITERATION_ID:'iterations',CANDIDATE_ID:'candidateFreezes',PRODUCT_ID:'products',EVIDENCE_ID:'evidenceRecords'},commitPolicy:COLLECTION_POLICIES.APPEND_SCOPED}),
  blockers:recordSchema({ownership:RECORD_OWNERSHIP.blockers,title:'Blockers',idField:'BLOCKER_ID',prefix:'BLOCKER',stage:null,fields:[
    'BLOCKER_ID','MISSING_ITEM_TYPE','MISSING_FACT_INPUT_AUTHORITY_EVIDENCE_CAPABILITY_DECISION_RULE','AFFECTED_REQUIREMENTS','AFFECTED_TESTS','AFFECTED_ARTIFACTS','WHY_WORK_CANNOT_CONTINUE','ATTEMPTED_RESOLUTIONS','DOWNSTREAM_WORK_STOPPED','OWNER','STATUS','RESOLUTION_EVIDENCE','CLOSURE','REEVALUATION','REQUIRED_REVALIDATION'
  ],required:['MISSING_ITEM_TYPE','MISSING_FACT_INPUT_AUTHORITY_EVIDENCE_CAPABILITY_DECISION_RULE','WHY_WORK_CANNOT_CONTINUE','ATTEMPTED_RESOLUTIONS','DOWNSTREAM_WORK_STOPPED','STATUS']}),
  freshContexts:recordSchema({ownership:RECORD_OWNERSHIP.freshContexts,commitPolicy:COLLECTION_POLICIES.UPDATE_RESERVED,title:'Fresh agent contexts',idField:'CONTEXT_ID',prefix:'CONTEXT',stage:null,fields:[
    'CONTEXT_ID','EXTERNAL_CONTEXT_IDENTIFIER','ROLE','ITERATION_ID','RUN_ID','AUTHORIZED_PROJECT_INPUTS','AUTHORIZED_EXTERNAL_SOURCE_MATERIAL','FROZEN_ARTIFACT_VERSIONS','TOOL_AVAILABILITY','CONTAMINATION_STATUS','OUTPUT_IDENTITY','DEVIATIONS','EVIDENCE','USABILITY_DETERMINATION'
  ],required:['EXTERNAL_CONTEXT_IDENTIFIER','ROLE','AUTHORIZED_PROJECT_INPUTS','TOOL_AVAILABILITY','CONTAMINATION_STATUS','EVIDENCE','USABILITY_DETERMINATION'],relationships:{ITERATION_ID:'iterations',RUN_ID:'runs'}}),
  evidenceRecords:recordSchema({ownership:RECORD_OWNERSHIP.evidenceRecords,commitPolicy:COLLECTION_POLICIES.APPEND_SCOPED,title:'Evidence records',idField:'EVIDENCE_ID',prefix:'EVIDENCE',stage:null,fields:[
    'EVIDENCE_ID','APPLICATION_EVIDENCE_KIND','APPLICATION_EVIDENCE_DESCRIPTION','APPLICATION_EVIDENCE_CONTENT','KIND','DESCRIPTION','AUTHORITY_TYPE','SOURCE_ID','LOCATION','CONTENT','ATTACHMENT_ID','SHA256','STATUS'
  ],required:['KIND','DESCRIPTION','LOCATION','CONTENT','STATUS'],relationships:{SOURCE_ID:'sources',ATTACHMENT_ID:'artifacts'}}),
  artifacts:recordSchema({ownership:RECORD_OWNERSHIP.artifacts,commitPolicy:COLLECTION_POLICIES.APPLICATION_DERIVED,title:'Files and artifacts',idField:'ARTIFACT_ID',prefix:'ARTIFACT',stage:null,fields:[
    'ARTIFACT_ID','FILENAME','TYPE','VERSION','BYTE_SIZE','SHA256','ROLE','STORAGE_REFERENCE','AVAILABILITY','NOTES'
  ],required:['FILENAME','TYPE','AVAILABILITY']})
});

const STAGE_COLLECTIONS=Object.freeze({
  1:[],
  2:['sources','sourceConflicts'],
  3:['research','candidateRequirements'],
  4:['requirements'],
  5:['requirementResolutions'],
  6:['tests'],
  7:['failureTests'],
  8:['instructions','instructionTraces'],
  9:['preflightRecords'],
  10:[],
  11:['runs'],
  12:['verification'],
  13:['comparisons'],
  14:['defects','rootCauses'],
  15:['regressions','regressionExecutions'],
  16:['changes'],
  17:['iterations','candidateFreezes','runs'],
  18:['convergenceRecords'],
  19:['iterations','runs','confirmationRecords'],
  20:[],
  21:['products'],
  22:['deterministicResults'],
  23:['meaningResults'],
  24:['adversarialResults'],
  25:['representationInspections'],
  26:['processAudits','productAudits'],
  27:['releaseGateReviews'],
  28:[],
  29:['evidenceInvestigations'],
  30:['defects','regressions']
});

const SUPPORT_COLLECTIONS=Object.freeze({
  1:['blockers'],2:['blockers','freshContexts'],3:['blockers'],4:['blockers'],5:['blockers'],6:['blockers'],7:['blockers'],8:['blockers'],
  9:['blockers','freshContexts'],10:['blockers'],11:['blockers','freshContexts'],12:['blockers','freshContexts'],13:['blockers'],14:['blockers'],
  15:['blockers'],16:['blockers'],17:['blockers','freshContexts'],18:['blockers'],19:['blockers','freshContexts'],20:['blockers'],21:['blockers','freshContexts'],
  22:['blockers'],23:['blockers','freshContexts'],24:['blockers','freshContexts'],25:['blockers','freshContexts'],26:['blockers'],27:['blockers'],28:['blockers'],29:['blockers'],30:['blockers']
});


const READ_COLLECTIONS=Object.freeze({1:[],2:[],3:['sources','sourceConflicts'],4:['research','candidateRequirements','sources','evidenceRecords','sourceConflicts'],5:['requirements','research','sources','sourceConflicts','evidenceRecords','candidateRequirements'],6:['requirements','requirementResolutions','artifacts','sources','research'],7:['requirements','tests','artifacts','evidenceRecords'],8:['requirements','tests','failureTests','requirementResolutions','sources','sourceConflicts'],9:['instructions','instructionTraces','requirements','tests','failureTests','requirementResolutions','sources','sourceConflicts'],10:['instructions','preflightRecords','tests','failureTests','artifacts'],11:['candidateFreezes','iterations','runs','freshContexts'],12:['runs','requirements','tests','freshContexts','sources','evidenceRecords'],13:['verification','runs','requirements','tests'],14:['defects','comparisons','verification','requirements','tests','instructions','instructionTraces','runs','candidateFreezes','failureTests','requirementResolutions','candidateRequirements','research','sources','sourceConflicts','artifacts','evidenceRecords'],15:['defects','rootCauses','comparisons','verification','runs','requirements','tests','failureTests','instructions','candidateFreezes','artifacts','evidenceRecords'],16:['defects','rootCauses','regressions','regressionExecutions','comparisons','verification','runs','requirements','requirementResolutions','candidateRequirements','research','sources','instructions','instructionTraces','tests','failureTests','candidateFreezes','artifacts','evidenceRecords','changes'],17:['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions'],18:['iterations','runs','verification','comparisons','defects','regressions','regressionExecutions','blockers','requirements','tests','rootCauses','changes'],19:['convergenceRecords','candidateFreezes','tests','regressions','regressionExecutions'],20:['confirmationRecords','candidateFreezes','iterations','artifacts'],21:['baselines','instructions','artifacts','freshContexts'],22:['products','tests','artifacts'],23:['products','requirements','tests','sources','evidenceRecords','research'],24:['products','requirements','tests','failureTests','regressions','regressionExecutions','defects','sources','evidenceRecords','research','artifacts'],25:['products','baselines','artifacts','requirements','tests','evidenceRecords'],26:['products','baselines','requirements','instructions','tests','runs','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','regressions','regressionExecutions','defects','blockers','evidenceRecords','confirmationRecords'],27:['requirements','tests','products','baselines','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','defects','blockers','regressionExecutions','evidenceRecords','confirmationRecords','regressions'],28:['releaseRecords','artifactIdentities','artifacts'],29:['sources','requirements','instructions','instructionTraces','runs','products','baselines','tests','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','regressions','regressionExecutions','releaseRecords','artifactIdentities','evidenceRecords','evidenceChains'],30:['defects','rootCauses','regressions','regressionExecutions','changes','baselines','evidenceRecords','requirements']});
const APPLICATION_COLLECTIONS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>[i+1,Object.freeze(['blockers','freshContexts','artifacts','releaseRecords','artifactIdentities','evidenceChains'])])));
const HUMAN_ACTIONS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>[i+1,Object.freeze(['ANSWER_HUMAN_INPUT','REJECT_RESPONSE','REQUEST_CORRECTION'])])));
const SCOPE_REQUIREMENTS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>{const s=i+1,keys=['projectRevision','inputVersion'];if(s>=3)keys.push('sourceSetVersion');if(s>=5)keys.push('requirementsVersion');if(s>=7)keys.push('testSuiteVersion');if(s>=9)keys.push('instructionVersion');if(s>=10&&s<=20)keys.push('iterationId','candidateId');if(s===9)keys.push('contextId');if(s===11)keys.push('runId','contextId');if(s>=20)keys.push('baselineId');if(s>=21)keys.push('productId');return [s,Object.freeze([...new Set(keys)])];})));
const OPERATION_CONTRACT_OVERRIDES=Object.freeze({2:Object.freeze({SEARCH_EXECUTION:Object.freeze({readCollections:['freshContexts'],agentWritableCollections:['sources','sourceConflicts'],scopeRequirements:['projectRevision','inputVersion','contextId']}),ADEQUACY_REVIEW:Object.freeze({readCollections:['sources','sourceConflicts','freshContexts','evidenceRecords'],agentWritableCollections:[],allowedStageData:[],scopeRequirements:['projectRevision','inputVersion','contextId']})}),17:Object.freeze({FREEZE:Object.freeze({readCollections:['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions','instructions','requirements','artifacts'],agentWritableCollections:[],allowedStageData:[]}),EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts'],agentWritableCollections:['runs'],allowedStageData:[]}),VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts','sources','evidenceRecords'],agentWritableCollections:['verification'],allowedStageData:[]}),COMPARE:Object.freeze({readCollections:['verification','runs','requirements','tests'],agentWritableCollections:['comparisons'],allowedStageData:[]}),ROOT_CAUSE:Object.freeze({readCollections:['defects','comparisons','verification','requirements','tests','instructions','instructionTraces','runs','candidateFreezes','failureTests','requirementResolutions','candidateRequirements','research','sources','sourceConflicts','artifacts','evidenceRecords'],agentWritableCollections:['defects','rootCauses'],allowedStageData:[]}),REGRESSION:Object.freeze({readCollections:['defects','rootCauses','comparisons','verification','runs','requirements','tests','failureTests','instructions','candidateFreezes','artifacts','evidenceRecords','regressions','regressionExecutions'],agentWritableCollections:['regressions','regressionExecutions'],allowedStageData:[]}),CORRECT:Object.freeze({readCollections:['defects','rootCauses','regressions','regressionExecutions','comparisons','verification','runs','requirements','requirementResolutions','candidateRequirements','research','sources','instructions','instructionTraces','tests','failureTests','candidateFreezes','artifacts','evidenceRecords','changes'],agentWritableCollections:['changes'],allowedStageData:[]})}),19:Object.freeze({CONFIRM_FREEZE:Object.freeze({readCollections:['convergenceRecords','candidateFreezes','iterations','requirements','tests','artifacts'],agentWritableCollections:[],allowedStageData:[]}),EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts'],agentWritableCollections:['runs'],allowedStageData:[]}),VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts','sources','evidenceRecords'],agentWritableCollections:['verification'],allowedStageData:[]}),COMPARE:Object.freeze({readCollections:['verification','runs','requirements','tests'],agentWritableCollections:['comparisons'],allowedStageData:[]}),REGRESSION_VERIFY:Object.freeze({readCollections:['regressions','regressionExecutions','runs','tests','requirements','artifacts'],agentWritableCollections:['regressionExecutions'],allowedStageData:[]}),CONFIRM:Object.freeze({readCollections:['runs','verification','comparisons','tests','regressions','regressionExecutions','candidateFreezes','defects','blockers','evidenceRecords','requirements'],agentWritableCollections:['confirmationRecords'],allowedStageData:[]})})});
function operationContract(stage,operation){const operations=STAGE_OPERATIONS[stage]||['COMPLETE'];if(!operations.includes(operation))return null;const override=OPERATION_CONTRACT_OVERRIDES[stage]?.[operation]||{};let scopeRequirements=override.scopeRequirements||SCOPE_REQUIREMENTS[stage]||[];if((stage===17||stage===19)&&!['EXECUTE_RUN','VERIFY'].includes(operation))scopeRequirements=scopeRequirements.filter(key=>key!=='runId'&&key!=='contextId');const independentReview=(stage===2&&operation==='ADEQUACY_REVIEW')||stage===9||stage===12||stage===23||stage===24||((stage===17||stage===19)&&operation==='VERIFY');if(independentReview&&!scopeRequirements.includes('contextId'))scopeRequirements=[...scopeRequirements,'contextId'];return Object.freeze({operation,readCollections:Object.freeze(override.readCollections||READ_COLLECTIONS[stage]||[]),agentWritableCollections:Object.freeze(override.agentWritableCollections||STAGE_COLLECTIONS[stage]||[]),allowedStageData:Object.freeze(override.allowedStageData||STAGE_CONTRACTS[stage]?.allowedStageData||[]),applicationCollections:Object.freeze(APPLICATION_COLLECTIONS[stage]||[]),humanActions:Object.freeze(HUMAN_ACTIONS[stage]||[]),scopeRequirements:Object.freeze(scopeRequirements)});}

const HUMAN_INTAKE_FIELDS=Object.freeze([
  'JOB_TITLE','JOB_OWNER','EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY','REQUIRED_OUTPUT_FORMAT',
  'DEADLINE_OR_TEMPORAL_SCOPE','DESIRED_SOURCE_COUNT','KNOWN_AUTHORITATIVE_SOURCES','AVAILABLE_TOOLS','PROHIBITED_ACTIONS','EXPLICIT_USER_REQUIREMENTS'
]);

function allowedCollections(stage){return Object.freeze([...(STAGE_COLLECTIONS[stage]||[])]);}
function allowedAgentStageFields(stage){return Object.freeze(Object.values(STAGE_FIELDS[stage]||{}).filter(def=>def.producer===PRODUCER.AGENT).map(def=>def.name));}
function humanStageFields(stage){return Object.freeze(Object.values(STAGE_FIELDS[stage]||{}).filter(def=>def.producer===PRODUCER.HUMAN||def.producer===PRODUCER.HUMAN_DECISION).map(def=>def.name));}
function recordAgentFields(collection){return Object.freeze(Object.values(RECORD_SCHEMAS[collection]?.fieldDefinitions||{}).filter(def=>def.producer===PRODUCER.AGENT).map(def=>def.name));}
function recordHumanFields(collection){return Object.freeze(Object.values(RECORD_SCHEMAS[collection]?.fieldDefinitions||{}).filter(def=>def.producer===PRODUCER.HUMAN||def.producer===PRODUCER.HUMAN_DECISION).map(def=>def.name));}

const STAGE_CONTRACTS=Object.freeze(Object.fromEntries(core.STAGES.map(stage=>[stage.number,Object.freeze({
  stage:stage.number,title:stage.title,role:stage.role,allowedStageData:allowedAgentStageFields(stage.number),humanFields:humanStageFields(stage.number),
  readCollections:Object.freeze(READ_COLLECTIONS[stage.number]||[]),agentWritableCollections:Object.freeze(STAGE_COLLECTIONS[stage.number]||[]),applicationCollections:Object.freeze(APPLICATION_COLLECTIONS[stage.number]||[]),humanActions:Object.freeze(HUMAN_ACTIONS[stage.number]||[]),
  allowedCollections:Object.freeze(STAGE_COLLECTIONS[stage.number]||[]),primaryCollections:Object.freeze(STAGE_COLLECTIONS[stage.number]||[]),supportCollections:Object.freeze(SUPPORT_COLLECTIONS[stage.number]||[]),
  operations:Object.freeze(STAGE_OPERATIONS[stage.number]||['COMPLETE']),scopeRequirements:Object.freeze(SCOPE_REQUIREMENTS[stage.number]||[]),resourceLimits:DEFAULT_RESOURCE_LIMITS,completionConditions:stage.completionGate,responseSchema:RESPONSE_SCHEMA,responseTypes:RESPONSE_TYPES
})])));


function authorizeMutation({fieldDefinition,actor,mutationType}){
  if(!fieldDefinition)throw new Error('Mutation authorization requires a field definition.');
  const producer=fieldDefinition.producer;const expected={HUMAN:'HUMAN',HUMAN_DECISION:'HUMAN_DECISION',AGENT:'AGENT',APPLICATION:'APPLICATION'}[String(actor||'').toUpperCase()];
  if(!expected||producer!==expected)return {authorized:false,reason:`${actor||'UNKNOWN'} cannot perform ${mutationType||'mutation'} on a ${producer}-owned field.`};
  if(producer===PRODUCER.APPLICATION&&mutationType!=='DERIVATION'&&mutationType!=='MIGRATION'&&mutationType!=='ID_ALLOCATION')return {authorized:false,reason:'Application-owned fields may change only through deterministic derivation, migration, or identity allocation.'};
  return {authorized:true,reason:'AUTHORIZED'};
}

const TARGET_PRODUCT_REFERENCE_PATTERN=/(?:closed-loop-tracker|(?:current|existing)\s+(?:operating\s+)?application\s+(?:repository|source\s+code|ui|stored\s+state|implementation|artifact|screenshot)|target\s+product|current\s+ui|target\s+screenshot|app-core\.js|workbook\.js|prompt-engine\.js|TEST_PROJECT\.json|github\.com\/sjonesjones917\/closed-loop-tracker)/i;
function sourceClassificationIssues(fields={}){
  const issues=[];
  const combined=Object.values(fields).join(' ');
  if(TARGET_PRODUCT_REFERENCE_PATTERN.test(combined))issues.push('Target-product, operating-application, or repository artifacts cannot be classified as external governing sources.');
  if(!String(fields.TITLE||'').trim())issues.push('Source title is required.');
  if(!String(fields.ISSUING_ORGANIZATION_OR_AUTHOR||'').trim())issues.push('Issuing organization or author is required.');
  if(!String(fields.URL_REFERENCE||'').trim())issues.push('An external URL or formal reference is required.');
  return issues;
}

globalThis.closedLoopWorkflowSchema=Object.freeze({
  version:'closed-loop-workflow-schema/2',
  PROJECT_SCHEMA,WORKFLOW_ID,STAGE_COUNT,VALUE_TYPES,COLLECTION_POLICIES,DEFAULT_RESOURCE_LIMITS,STAGE_OPERATIONS,READ_COLLECTIONS,APPLICATION_COLLECTIONS,HUMAN_ACTIONS,SCOPE_REQUIREMENTS,RECORD_OWNERSHIP,
  PRODUCER,RESPONSE_SCHEMA,RESPONSE_TYPES,CONFLICT_POLICIES,BUILD_IDENTITY,WORKER_PROTOCOL_VERSION,
  TRUTH_VALUES,EPISTEMIC_BASES,CURRENT_SCOPE_STATUSES,FRESHNESS_STATUSES,CONTRADICTION_STATUSES,MATERIALITY_VALUES,
  SEMANTIC_COVERAGE_VALUES,NORMATIVE_CLASSES,APPLICABILITY_VALUES,ENTAILMENT_VALUES,OBSERVATION_ORIGINS,TEST_ROLES,
  PROOF_OPERATORS,PROOF_LEAF_TYPES,DEFECT_SEVERITIES,DISCLOSURE_CLASSIFICATIONS,DELIVERY_STATES,RESERVATION_STATUSES,REGRESSION_LIFECYCLE,
  TEST_IR,validateTestIRSpec,validateTestIRBindings,validateTestIRTest,
  JOB_FIELDS,HUMAN_JOB_FIELDS,APPLICATION_JOB_FIELDS,AGENT_JOB_FIELDS,HUMAN_INTAKE_FIELDS,AMENDMENT_STAGE_FIELD_NAMES,AMENDMENT_STAGE_FIELD_TYPES,
  STAGE_FIELDS,STAGE_CONTRACTS,STAGE_COLLECTIONS,SUPPORT_COLLECTIONS,RECORD_SCHEMAS,
  field,stageFieldDefinition,allowedCollections,allowedAgentStageFields,humanStageFields,recordAgentFields,recordHumanFields,operationContract,authorizeMutation,
  sourceClassificationIssues,TARGET_PRODUCT_REFERENCE_PATTERN
});
})();

;(()=>{
'use strict';
const CLOSED_LOOP_V3_MIGRATION_LAYER=true;
const base=globalThis.closedLoopWorkflowSchema;
if(!base)throw new Error('closedLoopWorkflowSchema must exist before the v3 migration layer.');
const CURRENT_PROJECT_SCHEMA='closed-loop-project/3';
const PREVIOUS_PROJECT_SCHEMA='closed-loop-project/2';
const CURRENT_RESPONSE_SCHEMA='closed-loop-stage-response/3';
const PREVIOUS_RESPONSE_SCHEMA='closed-loop-stage-response/2';
const TEST_IR_SCHEMA='closed-loop-test-spec/1';
const PACKAGE_SCHEMA='closed-loop-verification-package/1';
const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
function normalizeOneCanonicalTestRecord(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return;
  const fields=value.fields&&typeof value.fields==='object'&&!Array.isArray(value.fields)?value.fields:value;
  const legacyKind=String(fields.EXECUTABLE_KIND||'').toUpperCase();
  if(legacyKind==='CUSTOM_PIPELINE'){
    const candidate=fields.EXECUTABLE_SPEC;
    const structurallyDeclarative=candidate?.version===TEST_IR_SCHEMA&&Array.isArray(candidate.steps)&&candidate.steps.length>0&&candidate.steps.every(step=>step&&typeof step==='object'&&!Array.isArray(step)&&base.TEST_IR.operations.includes(step.op)&&!['code','javascript','python','shell','command','eval','function','script'].some(key=>Object.prototype.hasOwnProperty.call(step,key)));
    fields.EXECUTABLE_KIND=structurallyDeclarative?'TEST_IR':'NONE';
    if(!structurallyDeclarative)fields.EXECUTABLE_SPEC=null;
  }else if(!legacyKind)fields.EXECUTABLE_KIND='NONE';
  fields.EXECUTABLE_SPEC_VERSION=TEST_IR_SCHEMA;
  if(!Object.prototype.hasOwnProperty.call(fields,'EXECUTABLE_SPEC'))fields.EXECUTABLE_SPEC=null;
  if(!fields.EXECUTABLE_INPUT_BINDINGS||typeof fields.EXECUTABLE_INPUT_BINDINGS!=='object'||Array.isArray(fields.EXECUTABLE_INPUT_BINDINGS))fields.EXECUTABLE_INPUT_BINDINGS={};
  if(!Object.prototype.hasOwnProperty.call(fields,'EXECUTABLE_SPEC_SHA256'))fields.EXECUTABLE_SPEC_SHA256='';
}
function normalizeCanonicalTestRecords(project){
  const collections=[project?.projectData?.tests,project?.projectData?.collections?.tests];
  for(const records of collections)if(Array.isArray(records))for(const record of records)normalizeOneCanonicalTestRecord(record);
}
const MIGRATED_CANONICAL_COLLECTIONS=Object.freeze([...Object.keys(base.RECORD_SCHEMAS||{}),'propositions','propositionEquivalenceReviews','applicabilityRecords','applicabilityReviews','proofExpressions','testSemanticReviews','proofObligations','observationRecords','entailmentReviews','environmentDependencies','operationReservations','deliveryRecords','deploymentManifests']);
function quarantineMigratedCanonicalState(project){
  const locations=[project?.projectData,project?.projectData?.collections];
  for(const location of locations)for(const collection of MIGRATED_CANONICAL_COLLECTIONS){
    const records=location?.[collection];if(!Array.isArray(records))continue;
    for(const record of records)if(record&&typeof record==='object'&&!Array.isArray(record)){
      record.active=false;record.operational=false;record.currentScopeStatus='STALE';record.invalidatedBy=record.invalidatedBy||'SCHEMA_MIGRATION_TO_V3';
    }
  }
}
function ensureV3Defaults(project,{migrating=false}={}){
  project.schema=CURRENT_PROJECT_SCHEMA;
  project.workflow=project.workflow||project.workflowId||'mobile-closed-loop/30';
  project.projectData=project.projectData&&typeof project.projectData==='object'?project.projectData:{};
  for(const key of ['intakeCoverageManifests','obligationManifests','promptContextManifests','blindAliasMaps','nativeExecutionEvents','propositions','propositionEquivalenceReviews','applicabilityRecords','applicabilityReviews','proofExpressions','testSemanticReviews','proofObligations','observationRecords','entailmentReviews','environmentDependencies','operationReservations','deliveryRecords','deploymentManifests'])if(!Array.isArray(project.projectData[key]))project.projectData[key]=[];
  if(!Array.isArray(project.projectData.nonOperationalImportedPayloads))project.projectData.nonOperationalImportedPayloads=[];
  project.projectData.schemaIdentities={...(project.projectData.schemaIdentities||{}),project:CURRENT_PROJECT_SCHEMA,response:CURRENT_RESPONSE_SCHEMA,testIr:TEST_IR_SCHEMA,verificationPackage:PACKAGE_SCHEMA,canonicalJson:'closed-loop-canonical-json/1',proofExpression:'closed-loop-proof-expression/1',filename:'closed-loop-filename/1',deploymentManifest:'closed-loop-deployment-manifest/1',workerProtocol:'closed-loop-test-worker-protocol/1'};
  if(migrating)normalizeCanonicalTestRecords(project);
  return project;
}
const priorMigrationName=['migrateProjectToCurrent','migrateProject','migrateLegacyProject','migrate'].find(name=>typeof base[name]==='function');
const priorMigration=priorMigrationName?base[priorMigrationName].bind(base):null;
function migrateProjectToCurrent(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Imported project must be an object.');
  const declaredWorkflow=input.workflow??input.workflowId;
  if(declaredWorkflow&&declaredWorkflow!=='mobile-closed-loop/30')throw new Error(`Imported project workflow must be mobile-closed-loop/30, received ${String(declaredWorkflow)}.`);
  if(input.stageCount!==undefined&&Number(input.stageCount)!==30)throw new Error(`Imported project must contain exactly 30 stages, received ${String(input.stageCount)}.`);
  if(input.revision!==undefined&&(!Number.isSafeInteger(input.revision)||input.revision<0))throw new Error('Imported project revision must be a nonnegative safe integer.');
  const stageKeys=Object.keys(input.stages||{});if(stageKeys.some(key=>!/^([1-9]|[12][0-9]|30)$/.test(String(key))))throw new Error('Imported project contains a stage outside the controlling 1-30 range.');
  if(input.schema===CURRENT_PROJECT_SCHEMA){
    if((input.workflow||input.workflowId)!=='mobile-closed-loop/30'||Number(input.stageCount)!==30||stageKeys.length!==30)throw new Error('A current /3 project must declare mobile-closed-loop/30 and exactly 30 stages.');
    return ensureV3Defaults(clone(input),{migrating:false});
  }
  const original=clone(input);
  let migrated;
  if(input.schema===PREVIOUS_PROJECT_SCHEMA)migrated=clone(input);
  else if(input.schema==='human-project/30'&&typeof globalThis.closedLoopCore?.migrateState==='function')migrated=globalThis.closedLoopCore.migrateState(clone(input));
  else if(priorMigration){migrated=priorMigration(clone(input));if(migrated&&typeof migrated.then==='function')throw new Error('Project migration must be deterministic and synchronous.');}
  else throw new Error('Unsupported project schema '+String(input.schema));
  migrated.workflow='mobile-closed-loop/30';migrated.stageCount=30;migrated.stages=migrated.stages&&typeof migrated.stages==='object'&&!Array.isArray(migrated.stages)?migrated.stages:{};
  for(let stage=1;stage<=30;stage++){
    const prior=migrated.stages[stage]&&typeof migrated.stages[stage]==='object'?migrated.stages[stage]:{};
    migrated.stages[stage]={...prior,stage,status:'NOT_STARTED',agentData:{},acceptedData:{},derivedData:{},gate:{complete:false,satisfied:false,blocked:false,reasons:['A current closed-loop-stage-response/3 acceptance is required after migration.']},pendingProposal:null,controllingPromptIdentity:null,invalidationReference:'SCHEMA_MIGRATION_TO_V3'};
  }
  migrated=ensureV3Defaults(migrated,{migrating:true});
  quarantineMigratedCanonicalState(migrated);
  const already=migrated.projectData.nonOperationalImportedPayloads.some(item=>item&&item.sourceSchema===original.schema&&item.sourceRevision===Number(original.revision||0)&&item.operational===false);
  if(!already)migrated.projectData.nonOperationalImportedPayloads.push({sourceSchema:String(original.schema||''),sourceRevision:Number(original.revision||0),operational:false,purpose:'ORIGINAL_IMPORTED_PAYLOAD_AUDIT_EVIDENCE',payload:original});
  /* Imported self-digests are evidence about the source payload, never the
     digest of the migrated canonical project. The exact originals remain in
     nonOperationalImportedPayloads and the store computes the new /3 digest. */
  delete migrated.projectHash;delete migrated.projectSha256;
  return migrated;
}
const replacement={...base,PROJECT_SCHEMA:CURRENT_PROJECT_SCHEMA,PROJECT_SCHEMA_ID:CURRENT_PROJECT_SCHEMA,RESPONSE_SCHEMA:CURRENT_RESPONSE_SCHEMA,RESPONSE_SCHEMA_ID:CURRENT_RESPONSE_SCHEMA,PREVIOUS_PROJECT_SCHEMA,PREVIOUS_RESPONSE_SCHEMA,TEST_IR_SCHEMA,PACKAGE_SCHEMA,migrateProjectToCurrent};
if(priorMigrationName)replacement[priorMigrationName]=migrateProjectToCurrent;
globalThis.closedLoopWorkflowSchema=Object.freeze(replacement);
})();

;(()=>{
'use strict';
const base=globalThis.closedLoopWorkflowSchema;
if(!base)throw new Error('closedLoopWorkflowSchema must exist before the Sections 53-70 schema layer.');
const P=base.PRODUCER,C=base.COLLECTION_POLICIES;
const {TRUTH_VALUES,EPISTEMIC_BASES,CURRENT_SCOPE_STATUSES,FRESHNESS_STATUSES,CONTRADICTION_STATUSES,MATERIALITY_VALUES,SEMANTIC_COVERAGE_VALUES,NORMATIVE_CLASSES,APPLICABILITY_VALUES,ENTAILMENT_VALUES,OBSERVATION_ORIGINS,TEST_ROLES,PROOF_OPERATORS,PROOF_LEAF_TYPES,DEFECT_SEVERITIES,DISCLOSURE_CLASSIFICATIONS,DELIVERY_STATES,RESERVATION_STATUSES,REGRESSION_LIFECYCLE}=base;
const enumType=values=>({valueType:'STRING',enumValues:Object.freeze([...values]),nullable:false});
const EXACT_RATIO_SCHEMA='closed-loop-exact-ratio/1';
const EXACT_RATIO_PROPERTIES=Object.freeze(['numberType','numerator','denominator']);
const TYPES=Object.freeze({STRING:{valueType:'STRING',enumValues:[],nullable:false},NULLABLE_STRING:{valueType:'STRING',enumValues:[],nullable:true},INTEGER:{valueType:'INTEGER',enumValues:[],nullable:false},NULLABLE_INTEGER:{valueType:'INTEGER',enumValues:[],nullable:true},NUMBER:{valueType:'NUMBER',enumValues:[],nullable:false},BOOLEAN:{valueType:'BOOLEAN',enumValues:[],nullable:false},OBJECT:{valueType:'OBJECT',enumValues:[],nullable:false},NULLABLE_OBJECT:{valueType:'OBJECT',enumValues:[],nullable:true},EXACT_RATIO:{valueType:'OBJECT',enumValues:[],nullable:false,closedProperties:EXACT_RATIO_PROPERTIES},OBJECT_ARRAY:{valueType:'OBJECT_ARRAY',enumValues:[],nullable:false},STRING_ARRAY:{valueType:'STRING_ARRAY',enumValues:[],nullable:false},REFERENCE:{valueType:'REFERENCE',enumValues:[],nullable:false},NULLABLE_REFERENCE:{valueType:'REFERENCE',enumValues:[],nullable:true},REFERENCE_ARRAY:{valueType:'REFERENCE_ARRAY',enumValues:[],nullable:false}});
function greatestCommonDivisor(left,right){let a=Math.abs(left),b=Math.abs(right);while(b){const next=a%b;a=b;b=next;}return a||1;}
function makeExactRatio(numerator,denominator){
  if(!Number.isSafeInteger(numerator)||numerator<0||!Number.isSafeInteger(denominator)||denominator<=0)throw new TypeError('Exact ratio requires a nonnegative safe-integer numerator and positive safe-integer denominator.');
  if(numerator>denominator)throw new RangeError('Closed-loop coverage and agreement ratios must be within 0 through 1.');
  const divisor=greatestCommonDivisor(numerator,denominator);
  return Object.freeze({numberType:'RATIO',numerator:numerator/divisor,denominator:denominator/divisor});
}
function validateExactRatio(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return {valid:false,reason:'Exact ratio must be a plain closed object.'};
  const keys=Object.getOwnPropertyNames(value);
  if(Object.getOwnPropertySymbols(value).length||keys.length!==3||keys.some(key=>!EXACT_RATIO_PROPERTIES.includes(key)))return {valid:false,reason:'Exact ratio must contain only numberType, numerator, and denominator.'};
  for(const key of keys){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!descriptor?.enumerable||!Object.prototype.hasOwnProperty.call(descriptor,'value'))return {valid:false,reason:'Exact ratio members must be enumerable data properties.'};}
  if(value.numberType!=='RATIO'||!Number.isSafeInteger(value.numerator)||value.numerator<0||!Number.isSafeInteger(value.denominator)||value.denominator<=0||value.numerator>value.denominator)return {valid:false,reason:'Exact ratio components are outside the closed 0 through 1 safe-integer contract.'};
  if(greatestCommonDivisor(value.numerator,value.denominator)!==1)return {valid:false,reason:'Exact ratio must be reduced to its unique canonical form.'};
  return {valid:true,reason:'VALID'};
}
function exactRatioToNumber(value){const check=validateExactRatio(value);if(!check.valid)throw new TypeError(check.reason);return value.numerator/value.denominator;}
const def=(name,producer,type=TYPES.STRING,collection='')=>base.field(name,producer,{valueType:type.valueType,enumValues:type.enumValues||[],nullable:type.nullable===true,closedProperties:type.closedProperties||null,responsePath:producer===P.AGENT?`/records/{collection}/*/fields/${name}`:null,derivationKey:producer===P.APPLICATION?`record.amendment.${collection}.${name}`:null,provenanceRequired:producer===P.AGENT});
function makeRecord({collection,title,idField,stage,policy,fields,ownership,types={},relationships={},required=[]}){
  const union=[...ownership.human,...ownership.humanDecision,...ownership.agent,...ownership.application];
  if(union.length!==fields.length||new Set(union).size!==fields.length||fields.some(name=>!union.includes(name)))throw new Error(`Sections 53-70 ownership for ${collection} is incomplete or overlapping.`);
  const definitions={};for(const name of fields){const producer=ownership.human.includes(name)?P.HUMAN:ownership.humanDecision.includes(name)?P.HUMAN_DECISION:ownership.agent.includes(name)?P.AGENT:P.APPLICATION;definitions[name]=def(name,producer,types[name]||TYPES.STRING,collection);}
  return Object.freeze({title,idField,prefix:idField.replace(/_ID$/,''),stage,fields:Object.freeze([...fields]),required:Object.freeze([...required]),relationships:Object.freeze({...relationships}),fieldDefinitions:Object.freeze(definitions),ownership:Object.freeze({human:Object.freeze([...ownership.human]),humanDecision:Object.freeze([...ownership.humanDecision]),agent:Object.freeze([...ownership.agent]),application:Object.freeze([...ownership.application])}),appendOnly:policy===C.APPEND_ONLY,commitPolicy:policy});
}
function augmentRecord(record,collection,{add={},producerOverrides={},typeOverrides={},relationships={},required=[]}){
  const fields=[...record.fields],definitions={...record.fieldDefinitions},ownership={human:[...record.ownership.human],humanDecision:[...record.ownership.humanDecision],agent:[...record.ownership.agent],application:[...record.ownership.application]};
  const producerKey=producer=>producer===P.HUMAN?'human':producer===P.HUMAN_DECISION?'humanDecision':producer===P.AGENT?'agent':'application';
  for(const [name,producer] of Object.entries(producerOverrides)){
    for(const values of Object.values(ownership)){const index=values.indexOf(name);if(index>=0)values.splice(index,1);}
    ownership[producerKey(producer)].push(name);const old=definitions[name];definitions[name]=def(name,producer,{valueType:old.valueType,enumValues:old.enumValues,nullable:old.nullable,closedProperties:old.closedProperties},collection);
  }
  for(const [name,spec] of Object.entries(add)){
    if(!fields.includes(name))fields.push(name);for(const values of Object.values(ownership)){const index=values.indexOf(name);if(index>=0)values.splice(index,1);}
    ownership[producerKey(spec.producer)].push(name);definitions[name]=def(name,spec.producer,spec.type||TYPES.STRING,collection);
  }
  for(const [name,type] of Object.entries(typeOverrides)){
    if(!definitions[name])throw new Error(`Cannot override unknown ${collection}.${name}.`);
    definitions[name]=def(name,definitions[name].producer,type,collection);
  }
  return Object.freeze({...record,fields:Object.freeze(fields),required:Object.freeze([...new Set([...record.required,...required])]),relationships:Object.freeze({...record.relationships,...relationships}),fieldDefinitions:Object.freeze(definitions),ownership:Object.freeze({human:Object.freeze(ownership.human),humanDecision:Object.freeze(ownership.humanDecision),agent:Object.freeze(ownership.agent),application:Object.freeze(ownership.application)})});
}
const semanticStateFields={
  TRUTH_VALUE:{producer:P.APPLICATION,type:enumType(TRUTH_VALUES)},EPISTEMIC_BASIS:{producer:P.APPLICATION,type:enumType(EPISTEMIC_BASES)},CURRENT_SCOPE_STATUS:{producer:P.APPLICATION,type:enumType(CURRENT_SCOPE_STATUSES)},FRESHNESS_STATUS:{producer:P.APPLICATION,type:enumType(FRESHNESS_STATUSES)},CONTRADICTION_STATUS:{producer:P.APPLICATION,type:enumType(CONTRADICTION_STATUSES)},REASONS:{producer:P.APPLICATION,type:TYPES.STRING_ARRAY},SUPPORTING_EVIDENCE_IDS:{producer:P.APPLICATION,type:TYPES.REFERENCE_ARRAY},DERIVATION_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_STRING}
};
const TEST_SEMANTIC_SUBJECT_KINDS=Object.freeze(['TEST','PROOF_EXPRESSION']);
const SEMANTIC_REVIEW_FINDINGS=Object.freeze(['EQUIVALENT','PARTIAL','UNKNOWN','NOT_EQUIVALENT']);
const APPLICABILITY_REVIEW_FINDINGS=Object.freeze(['ACCEPTED','REJECTED','UNKNOWN']);
const PROPOSITION_ROLES=Object.freeze(['PRIMARY_REQUIREMENT','CONDITIONAL_ACTIVATION']);
const added={};
added.propositions=makeRecord({collection:'propositions',title:'Canonical release-bearing propositions',idField:'PROPOSITION_ID',stage:4,policy:C.REPLACE_CURRENT_STAGE_SET,fields:['PROPOSITION_ID','REQUIREMENT_ID','SOURCE_IDS','SOURCE_STATE_SUMMARY','PROPOSITION_ROLE','PROPOSITION_TEXT','SUBJECT_AND_SCOPE_DESCRIPTION','SATISFACTION_MEANING','FAILURE_MEANING','CURRENT_SCOPE','CONTENT_SHA256','STATUS'],ownership:{human:[],humanDecision:[],agent:['PROPOSITION_ROLE','PROPOSITION_TEXT','SUBJECT_AND_SCOPE_DESCRIPTION','SATISFACTION_MEANING','FAILURE_MEANING'],application:['PROPOSITION_ID','REQUIREMENT_ID','SOURCE_IDS','SOURCE_STATE_SUMMARY','CURRENT_SCOPE','CONTENT_SHA256','STATUS']},types:{REQUIREMENT_ID:TYPES.REFERENCE,SOURCE_IDS:TYPES.REFERENCE_ARRAY,SOURCE_STATE_SUMMARY:TYPES.OBJECT_ARRAY,PROPOSITION_ROLE:enumType(PROPOSITION_ROLES),CURRENT_SCOPE:TYPES.OBJECT},relationships:{REQUIREMENT_ID:'requirements',SOURCE_IDS:'sources'},required:['PROPOSITION_TEXT','SUBJECT_AND_SCOPE_DESCRIPTION','SATISFACTION_MEANING','FAILURE_MEANING']});
added.propositionEquivalenceReviews=makeRecord({collection:'propositionEquivalenceReviews',title:'Independent proposition-equivalence reviews',idField:'PROP_EQ_REVIEW_ID',stage:5,policy:C.APPEND_SCOPED,fields:['PROP_EQ_REVIEW_ID','PROPOSITION_A_ID','PROPOSITION_B_ID','EQUIVALENCE_FINDING','REASONING','REVIEWER_ID','EVIDENCE_ID','CURRENT_SCOPE','ACCEPTED_STATUS','EQUIVALENCE_CLASS_ID'],ownership:{human:[],humanDecision:[],agent:['EQUIVALENCE_FINDING','REASONING','REVIEWER_ID'],application:['PROP_EQ_REVIEW_ID','PROPOSITION_A_ID','PROPOSITION_B_ID','EVIDENCE_ID','CURRENT_SCOPE','ACCEPTED_STATUS','EQUIVALENCE_CLASS_ID']},types:{PROPOSITION_A_ID:TYPES.REFERENCE,PROPOSITION_B_ID:TYPES.REFERENCE,EQUIVALENCE_FINDING:enumType(SEMANTIC_COVERAGE_VALUES),EVIDENCE_ID:TYPES.NULLABLE_REFERENCE,CURRENT_SCOPE:TYPES.OBJECT},relationships:{PROPOSITION_A_ID:'propositions',PROPOSITION_B_ID:'propositions',EVIDENCE_ID:'evidenceRecords'},required:['EQUIVALENCE_FINDING','REASONING','REVIEWER_ID']});
added.applicabilityRecords=makeRecord({collection:'applicabilityRecords',title:'Current applicability determinations',idField:'APPLICABILITY_ID',stage:5,policy:C.APPEND_SCOPED,fields:['APPLICABILITY_ID','SUBJECT_TYPE','SUBJECT_ID','ACTIVATION_PROPOSITION_ID','APPLICABILITY_PROPOSAL','REASONING','NORMATIVE_CLASSIFICATION_PROPOSAL','NORMATIVE_CLASSIFICATION','CLASSIFICATION_REVIEW_REQUIRED','EVIDENCE_IDS','INDEPENDENT_REVIEW_ID','APPLICABILITY','TRUTH_VALUE','EPISTEMIC_BASIS','FRESHNESS_STATUS','CONTRADICTION_STATUS','CURRENT_SELECTION','CURRENT_SCOPE','STATUS'],ownership:{human:[],humanDecision:[],agent:['APPLICABILITY_PROPOSAL','REASONING','NORMATIVE_CLASSIFICATION_PROPOSAL'],application:['APPLICABILITY_ID','SUBJECT_TYPE','SUBJECT_ID','ACTIVATION_PROPOSITION_ID','NORMATIVE_CLASSIFICATION','CLASSIFICATION_REVIEW_REQUIRED','EVIDENCE_IDS','INDEPENDENT_REVIEW_ID','APPLICABILITY','TRUTH_VALUE','EPISTEMIC_BASIS','FRESHNESS_STATUS','CONTRADICTION_STATUS','CURRENT_SELECTION','CURRENT_SCOPE','STATUS']},types:{SUBJECT_ID:TYPES.REFERENCE,ACTIVATION_PROPOSITION_ID:TYPES.NULLABLE_REFERENCE,NORMATIVE_CLASSIFICATION_PROPOSAL:enumType(NORMATIVE_CLASSES),NORMATIVE_CLASSIFICATION:enumType(NORMATIVE_CLASSES),CLASSIFICATION_REVIEW_REQUIRED:TYPES.BOOLEAN,EVIDENCE_IDS:TYPES.REFERENCE_ARRAY,INDEPENDENT_REVIEW_ID:TYPES.NULLABLE_REFERENCE,APPLICABILITY_PROPOSAL:enumType(APPLICABILITY_VALUES),APPLICABILITY:enumType(APPLICABILITY_VALUES),TRUTH_VALUE:enumType(TRUTH_VALUES),EPISTEMIC_BASIS:enumType(EPISTEMIC_BASES),FRESHNESS_STATUS:enumType(FRESHNESS_STATUSES),CONTRADICTION_STATUS:enumType(CONTRADICTION_STATUSES),CURRENT_SELECTION:TYPES.BOOLEAN,CURRENT_SCOPE:TYPES.OBJECT},relationships:{SUBJECT_ID:'propositions',ACTIVATION_PROPOSITION_ID:'propositions',EVIDENCE_IDS:'evidenceRecords',INDEPENDENT_REVIEW_ID:'applicabilityReviews'},required:['APPLICABILITY_PROPOSAL','REASONING','NORMATIVE_CLASSIFICATION_PROPOSAL']});
added.applicabilityReviews=makeRecord({collection:'applicabilityReviews',title:'Independent applicability and normative-classification reviews',idField:'APPLICABILITY_REVIEW_ID',stage:5,policy:C.APPEND_SCOPED,fields:['APPLICABILITY_REVIEW_ID','APPLICABILITY_ID','SUBJECT_PROPOSITION_ID','REVIEW_FINDING','REASONING','REVIEWER_ID','EVIDENCE_IDS','REVIEWED_NORMATIVE_CLASSIFICATION','SUBJECT_SEMANTIC_SHA256','AUTHOR_ACCEPTED_CHANGE_ID','REVIEW_ACCEPTED_CHANGE_ID','AUTHOR_PROMPT_IDENTITY','REVIEW_PROMPT_IDENTITY','INDEPENDENCE_STATUS','CURRENT_SCOPE','ACCEPTED_STATUS'],ownership:{human:[],humanDecision:[],agent:['REVIEW_FINDING','REASONING','REVIEWER_ID'],application:['APPLICABILITY_REVIEW_ID','APPLICABILITY_ID','SUBJECT_PROPOSITION_ID','EVIDENCE_IDS','REVIEWED_NORMATIVE_CLASSIFICATION','SUBJECT_SEMANTIC_SHA256','AUTHOR_ACCEPTED_CHANGE_ID','REVIEW_ACCEPTED_CHANGE_ID','AUTHOR_PROMPT_IDENTITY','REVIEW_PROMPT_IDENTITY','INDEPENDENCE_STATUS','CURRENT_SCOPE','ACCEPTED_STATUS']},types:{APPLICABILITY_ID:TYPES.REFERENCE,SUBJECT_PROPOSITION_ID:TYPES.REFERENCE,REVIEW_FINDING:enumType(APPLICABILITY_REVIEW_FINDINGS),EVIDENCE_IDS:TYPES.REFERENCE_ARRAY,REVIEWED_NORMATIVE_CLASSIFICATION:enumType(NORMATIVE_CLASSES),CURRENT_SCOPE:TYPES.OBJECT},relationships:{APPLICABILITY_ID:'applicabilityRecords',SUBJECT_PROPOSITION_ID:'propositions',EVIDENCE_IDS:'evidenceRecords'},required:['REVIEW_FINDING','REASONING','REVIEWER_ID']});
added.proofExpressions=makeRecord({collection:'proofExpressions',title:'Closed proof expressions',idField:'PROOF_EXPRESSION_ID',stage:6,policy:C.REPLACE_CURRENT_STAGE_SET,fields:['PROOF_EXPRESSION_ID','TARGET_PROPOSITION_ID','PROPOSED_EXPRESSION','SEMANTIC_RATIONALE','NORMALIZED_EXPRESSION','SEMANTIC_EQUIVALENCE_DISPOSITION','SEMANTIC_REVIEW_IDS','CURRENT_SCOPE_HASH','EXPRESSION_SHA256','TRUTH_VALUE','STATUS'],ownership:{human:[],humanDecision:[],agent:['PROPOSED_EXPRESSION','SEMANTIC_RATIONALE'],application:['PROOF_EXPRESSION_ID','TARGET_PROPOSITION_ID','NORMALIZED_EXPRESSION','SEMANTIC_EQUIVALENCE_DISPOSITION','SEMANTIC_REVIEW_IDS','CURRENT_SCOPE_HASH','EXPRESSION_SHA256','TRUTH_VALUE','STATUS']},types:{TARGET_PROPOSITION_ID:TYPES.REFERENCE,PROPOSED_EXPRESSION:TYPES.OBJECT,NORMALIZED_EXPRESSION:TYPES.OBJECT,SEMANTIC_EQUIVALENCE_DISPOSITION:enumType(SEMANTIC_COVERAGE_VALUES),SEMANTIC_REVIEW_IDS:TYPES.REFERENCE_ARRAY,TRUTH_VALUE:enumType(TRUTH_VALUES)},relationships:{TARGET_PROPOSITION_ID:'propositions',SEMANTIC_REVIEW_IDS:'testSemanticReviews'},required:['PROPOSED_EXPRESSION','SEMANTIC_RATIONALE']});
added.testSemanticReviews=makeRecord({collection:'testSemanticReviews',title:'Independent test and proof-expression semantic reviews',idField:'TEST_SEMANTIC_REVIEW_ID',stage:6,policy:C.APPEND_SCOPED,fields:['TEST_SEMANTIC_REVIEW_ID','SUBJECT_KIND','TEST_ID','PROOF_EXPRESSION_ID','TARGET_PROPOSITION_IDS','EQUIVALENCE_FINDING','REASONING','REVIEWER_ID','EVIDENCE_IDS','SUBJECT_SEMANTIC_SHA256','AUTHOR_ACCEPTED_CHANGE_ID','REVIEW_ACCEPTED_CHANGE_ID','AUTHOR_PROMPT_IDENTITY','REVIEW_PROMPT_IDENTITY','INDEPENDENCE_STATUS','CURRENT_SCOPE','ACCEPTED_STATUS'],ownership:{human:[],humanDecision:[],agent:['EQUIVALENCE_FINDING','REASONING','REVIEWER_ID'],application:['TEST_SEMANTIC_REVIEW_ID','SUBJECT_KIND','TEST_ID','PROOF_EXPRESSION_ID','TARGET_PROPOSITION_IDS','EVIDENCE_IDS','SUBJECT_SEMANTIC_SHA256','AUTHOR_ACCEPTED_CHANGE_ID','REVIEW_ACCEPTED_CHANGE_ID','AUTHOR_PROMPT_IDENTITY','REVIEW_PROMPT_IDENTITY','INDEPENDENCE_STATUS','CURRENT_SCOPE','ACCEPTED_STATUS']},types:{SUBJECT_KIND:enumType(TEST_SEMANTIC_SUBJECT_KINDS),TEST_ID:TYPES.NULLABLE_REFERENCE,PROOF_EXPRESSION_ID:TYPES.NULLABLE_REFERENCE,TARGET_PROPOSITION_IDS:TYPES.REFERENCE_ARRAY,EQUIVALENCE_FINDING:enumType(SEMANTIC_REVIEW_FINDINGS),EVIDENCE_IDS:TYPES.REFERENCE_ARRAY,CURRENT_SCOPE:TYPES.OBJECT},relationships:{TEST_ID:'tests',PROOF_EXPRESSION_ID:'proofExpressions',TARGET_PROPOSITION_IDS:'propositions',EVIDENCE_IDS:'evidenceRecords'},required:['EQUIVALENCE_FINDING','REASONING','REVIEWER_ID']});
added.proofObligations=makeRecord({collection:'proofObligations',title:'Application-derived proof obligations',idField:'PROOF_OBLIGATION_ID',stage:6,policy:C.APPLICATION_DERIVED,fields:['PROOF_OBLIGATION_ID','PROPOSITION_ID','REQUIREMENT_ID','NORMATIVE_CLASS','APPLICABILITY','ACTIVATION_PROPOSITION_ID','PROOF_EXPRESSION_ID','REQUIRED_TEST_IDS','REQUIRED_OBSERVATION_LEAF_IDS','REQUIRED_EVIDENCE_CLASSES','REQUIRED_EPISTEMIC_BASES','REQUIRED_SOURCE_IDS','SOURCE_STATE_REQUIREMENTS','SOURCE_STATE_SHA256','REQUIRED_ARTIFACT_IDS','REQUIRED_DEPENDENCY_IDS','FRESHNESS_REQUIREMENTS','INDEPENDENCE_REQUIREMENTS','REQUIRED_RUN_DIMENSIONS','SATISFACTION_STATE','BLOCKING_REASONS','CURRENT_SCOPE_HASH','STATUS'],ownership:{human:[],humanDecision:[],agent:[],application:['PROOF_OBLIGATION_ID','PROPOSITION_ID','REQUIREMENT_ID','NORMATIVE_CLASS','APPLICABILITY','ACTIVATION_PROPOSITION_ID','PROOF_EXPRESSION_ID','REQUIRED_TEST_IDS','REQUIRED_OBSERVATION_LEAF_IDS','REQUIRED_EVIDENCE_CLASSES','REQUIRED_EPISTEMIC_BASES','REQUIRED_SOURCE_IDS','SOURCE_STATE_REQUIREMENTS','SOURCE_STATE_SHA256','REQUIRED_ARTIFACT_IDS','REQUIRED_DEPENDENCY_IDS','FRESHNESS_REQUIREMENTS','INDEPENDENCE_REQUIREMENTS','REQUIRED_RUN_DIMENSIONS','SATISFACTION_STATE','BLOCKING_REASONS','CURRENT_SCOPE_HASH','STATUS']},types:{PROPOSITION_ID:TYPES.REFERENCE,REQUIREMENT_ID:TYPES.REFERENCE,NORMATIVE_CLASS:enumType(NORMATIVE_CLASSES),APPLICABILITY:enumType(APPLICABILITY_VALUES),ACTIVATION_PROPOSITION_ID:TYPES.NULLABLE_REFERENCE,PROOF_EXPRESSION_ID:TYPES.REFERENCE,REQUIRED_TEST_IDS:TYPES.REFERENCE_ARRAY,REQUIRED_OBSERVATION_LEAF_IDS:TYPES.STRING_ARRAY,REQUIRED_EVIDENCE_CLASSES:TYPES.STRING_ARRAY,REQUIRED_EPISTEMIC_BASES:TYPES.STRING_ARRAY,REQUIRED_SOURCE_IDS:TYPES.REFERENCE_ARRAY,SOURCE_STATE_REQUIREMENTS:TYPES.OBJECT_ARRAY,REQUIRED_ARTIFACT_IDS:TYPES.REFERENCE_ARRAY,REQUIRED_DEPENDENCY_IDS:TYPES.REFERENCE_ARRAY,FRESHNESS_REQUIREMENTS:TYPES.OBJECT,INDEPENDENCE_REQUIREMENTS:TYPES.OBJECT,REQUIRED_RUN_DIMENSIONS:TYPES.STRING_ARRAY,BLOCKING_REASONS:TYPES.STRING_ARRAY},relationships:{PROPOSITION_ID:'propositions',REQUIREMENT_ID:'requirements',ACTIVATION_PROPOSITION_ID:'propositions',PROOF_EXPRESSION_ID:'proofExpressions',REQUIRED_TEST_IDS:'tests',REQUIRED_SOURCE_IDS:'sources',REQUIRED_ARTIFACT_IDS:'artifacts',REQUIRED_DEPENDENCY_IDS:'environmentDependencies'}});
added.observationRecords=makeRecord({collection:'observationRecords',title:'Origin-preserving observations',idField:'OBSERVATION_ID',stage:null,policy:C.APPEND_SCOPED,fields:['OBSERVATION_ID','ORIGIN_CLASS','SUBMITTING_ACTOR','SUBJECT_DESCRIPTION','ARTIFACT_ID','RUN_ID','PRODUCT_ID','RESULT_ID','NATIVE_OBSERVED_VALUE','NATIVE_OBSERVED_LOCATION','NATIVE_METHOD_OR_TOOL','EXTERNAL_OBSERVED_VALUE','EXTERNAL_OBSERVED_LOCATION','EXTERNAL_METHOD_OR_TOOL','EXTERNAL_LIMITATIONS','HUMAN_OBSERVED_VALUE','HUMAN_OBSERVED_LOCATION','HUMAN_METHOD_OR_TOOL','INPUT_IDENTITIES_AND_HASHES','OUTPUT_IDENTITIES_AND_HASHES','EPISTEMIC_BASIS','FRESHNESS_STATUS','SOURCE_EVIDENCE_IDS','CURRENT_SCOPE','RAW_OR_EXECUTION_PROVENANCE','STATUS'],ownership:{human:['HUMAN_OBSERVED_VALUE','HUMAN_OBSERVED_LOCATION','HUMAN_METHOD_OR_TOOL'],humanDecision:[],agent:['EXTERNAL_OBSERVED_VALUE','EXTERNAL_OBSERVED_LOCATION','EXTERNAL_METHOD_OR_TOOL','EXTERNAL_LIMITATIONS'],application:['OBSERVATION_ID','ORIGIN_CLASS','SUBMITTING_ACTOR','SUBJECT_DESCRIPTION','ARTIFACT_ID','RUN_ID','PRODUCT_ID','RESULT_ID','NATIVE_OBSERVED_VALUE','NATIVE_OBSERVED_LOCATION','NATIVE_METHOD_OR_TOOL','INPUT_IDENTITIES_AND_HASHES','OUTPUT_IDENTITIES_AND_HASHES','EPISTEMIC_BASIS','FRESHNESS_STATUS','SOURCE_EVIDENCE_IDS','CURRENT_SCOPE','RAW_OR_EXECUTION_PROVENANCE','STATUS']},types:{ORIGIN_CLASS:enumType(OBSERVATION_ORIGINS),ARTIFACT_ID:TYPES.NULLABLE_REFERENCE,RUN_ID:TYPES.NULLABLE_REFERENCE,PRODUCT_ID:TYPES.NULLABLE_REFERENCE,RESULT_ID:TYPES.NULLABLE_STRING,NATIVE_OBSERVED_VALUE:TYPES.NULLABLE_OBJECT,NATIVE_OBSERVED_LOCATION:TYPES.NULLABLE_STRING,NATIVE_METHOD_OR_TOOL:TYPES.NULLABLE_STRING,EXTERNAL_OBSERVED_VALUE:TYPES.NULLABLE_OBJECT,EXTERNAL_OBSERVED_LOCATION:TYPES.NULLABLE_STRING,EXTERNAL_METHOD_OR_TOOL:TYPES.NULLABLE_STRING,EXTERNAL_LIMITATIONS:TYPES.NULLABLE_STRING,HUMAN_OBSERVED_VALUE:TYPES.NULLABLE_OBJECT,HUMAN_OBSERVED_LOCATION:TYPES.NULLABLE_STRING,HUMAN_METHOD_OR_TOOL:TYPES.NULLABLE_STRING,INPUT_IDENTITIES_AND_HASHES:TYPES.OBJECT_ARRAY,OUTPUT_IDENTITIES_AND_HASHES:TYPES.OBJECT_ARRAY,EPISTEMIC_BASIS:enumType(EPISTEMIC_BASES),FRESHNESS_STATUS:enumType(FRESHNESS_STATUSES),SOURCE_EVIDENCE_IDS:TYPES.REFERENCE_ARRAY,CURRENT_SCOPE:TYPES.OBJECT,RAW_OR_EXECUTION_PROVENANCE:TYPES.OBJECT},relationships:{ARTIFACT_ID:'artifacts',RUN_ID:'runs',PRODUCT_ID:'products',SOURCE_EVIDENCE_IDS:'evidenceRecords'}});
added.entailmentReviews=makeRecord({collection:'entailmentReviews',title:'Observation-to-proposition entailment reviews',idField:'ENTAILMENT_ID',stage:null,policy:C.APPEND_SCOPED,fields:['ENTAILMENT_ID','OBSERVATION_ID','PROPOSITION_ID','PROOF_OBLIGATION_ID','PROOF_LEAF_KEY','ENTAILMENT_FINDING','REASONING','REVIEWER_ID','EVIDENCE_IDS','ACCEPTED_RELATION','CURRENT_SCOPE','STATUS'],ownership:{human:[],humanDecision:[],agent:['ENTAILMENT_FINDING','REASONING','REVIEWER_ID'],application:['ENTAILMENT_ID','OBSERVATION_ID','PROPOSITION_ID','PROOF_OBLIGATION_ID','PROOF_LEAF_KEY','EVIDENCE_IDS','ACCEPTED_RELATION','CURRENT_SCOPE','STATUS']},types:{OBSERVATION_ID:TYPES.REFERENCE,PROPOSITION_ID:TYPES.REFERENCE,PROOF_OBLIGATION_ID:TYPES.NULLABLE_REFERENCE,ENTAILMENT_FINDING:enumType(ENTAILMENT_VALUES),EVIDENCE_IDS:TYPES.REFERENCE_ARRAY,ACCEPTED_RELATION:enumType(ENTAILMENT_VALUES),CURRENT_SCOPE:TYPES.OBJECT},relationships:{OBSERVATION_ID:'observationRecords',PROPOSITION_ID:'propositions',PROOF_OBLIGATION_ID:'proofObligations',EVIDENCE_IDS:'evidenceRecords'},required:['ENTAILMENT_FINDING','REASONING','REVIEWER_ID']});
added.environmentDependencies=makeRecord({collection:'environmentDependencies',title:'Release-bearing environment dependencies',idField:'DEPENDENCY_ID',stage:null,policy:C.APPEND_SCOPED,fields:['DEPENDENCY_ID','DEPENDENCY_TYPE','DEPENDENCY_DESCRIPTION','REQUIRED_CONDITION','ARTIFACT_ID','PROOF_OBLIGATION_ID','EVIDENCE_IDS','OBSERVED_IDENTITY','REQUIRED_VERSION_OR_CONDITION','AUTHENTICITY_STATUS','FRESHNESS_STATUS','EPISTEMIC_BASIS','CURRENT_SCOPE','RELEASE_CONSEQUENCE','STATUS'],ownership:{human:[],humanDecision:[],agent:['DEPENDENCY_DESCRIPTION','REQUIRED_CONDITION'],application:['DEPENDENCY_ID','DEPENDENCY_TYPE','ARTIFACT_ID','PROOF_OBLIGATION_ID','EVIDENCE_IDS','OBSERVED_IDENTITY','REQUIRED_VERSION_OR_CONDITION','AUTHENTICITY_STATUS','FRESHNESS_STATUS','EPISTEMIC_BASIS','CURRENT_SCOPE','RELEASE_CONSEQUENCE','STATUS']},types:{ARTIFACT_ID:TYPES.NULLABLE_REFERENCE,PROOF_OBLIGATION_ID:TYPES.NULLABLE_REFERENCE,EVIDENCE_IDS:TYPES.REFERENCE_ARRAY,AUTHENTICITY_STATUS:enumType(['VERIFIED','EXTERNALLY_SUPPORTED','SELF_ASSERTED','UNKNOWN','CONTRADICTED']),FRESHNESS_STATUS:enumType(FRESHNESS_STATUSES),EPISTEMIC_BASIS:enumType(EPISTEMIC_BASES),CURRENT_SCOPE:TYPES.OBJECT},relationships:{ARTIFACT_ID:'artifacts',PROOF_OBLIGATION_ID:'proofObligations',EVIDENCE_IDS:'evidenceRecords'},required:['DEPENDENCY_DESCRIPTION','REQUIRED_CONDITION']});
added.operationReservations=makeRecord({collection:'operationReservations',title:'Application operation reservations',idField:'OPERATION_RESERVATION_ID',stage:null,policy:C.UPDATE_RESERVED,fields:['OPERATION_RESERVATION_ID','JOB_ID','STAGE','OPERATION','TARGET_SLOT','TARGET_KEY','PACKAGE_ID','PACKAGE_MANIFEST_HASH','PACKAGE_DESCRIPTOR','REQUIRED_ARTIFACT_INPUTS','REQUIRED_ARTIFACT_INPUT_SET_SHA256','PROMPT_IDENTITY','CONTEXT_SIGNATURE','SCOPE','SCOPE_HASH','EXPECTED_REVISION','CHALLENGE_NONCE','STATUS','OWNING_BROWSER_TAB_INSTANCE','DISCLOSURE_CLASSIFICATION','AUTHORIZATION_BASIS','IDEMPOTENCY_KEY','CREATED_AT_DEVICE_TIME','TRANSITION_REASON','SUPERSEDED_BY'],ownership:{human:[],humanDecision:[],agent:[],application:['OPERATION_RESERVATION_ID','JOB_ID','STAGE','OPERATION','TARGET_SLOT','TARGET_KEY','PACKAGE_ID','PACKAGE_MANIFEST_HASH','PACKAGE_DESCRIPTOR','REQUIRED_ARTIFACT_INPUTS','REQUIRED_ARTIFACT_INPUT_SET_SHA256','PROMPT_IDENTITY','CONTEXT_SIGNATURE','SCOPE','SCOPE_HASH','EXPECTED_REVISION','CHALLENGE_NONCE','STATUS','OWNING_BROWSER_TAB_INSTANCE','DISCLOSURE_CLASSIFICATION','AUTHORIZATION_BASIS','IDEMPOTENCY_KEY','CREATED_AT_DEVICE_TIME','TRANSITION_REASON','SUPERSEDED_BY']},types:{STAGE:TYPES.INTEGER,PROMPT_IDENTITY:TYPES.STRING,PACKAGE_DESCRIPTOR:TYPES.NULLABLE_OBJECT,REQUIRED_ARTIFACT_INPUTS:TYPES.OBJECT_ARRAY,REQUIRED_ARTIFACT_INPUT_SET_SHA256:TYPES.STRING,SCOPE:TYPES.OBJECT,EXPECTED_REVISION:TYPES.INTEGER,STATUS:enumType(RESERVATION_STATUSES),DISCLOSURE_CLASSIFICATION:enumType(DISCLOSURE_CLASSIFICATIONS),TRANSITION_REASON:TYPES.NULLABLE_STRING,SUPERSEDED_BY:TYPES.NULLABLE_REFERENCE},relationships:{SUPERSEDED_BY:'operationReservations'}});
added.deliveryRecords=makeRecord({collection:'deliveryRecords',title:'Terminal application-derived delivery records',idField:'DELIVERY_ID',stage:30,policy:C.APPLICATION_DERIVED,fields:['DELIVERY_ID','JOB_ID','PRODUCT_ID','PRODUCT_VERSION','BASELINE_ID','RELEASE_ID','HASH_REVIEW_ID','EVIDENCE_CHAIN_VERSION','EVIDENCE_CHAIN_SET_SHA256','DEFECT_REGISTRY_VERSION','REGRESSION_REGISTRY_VERSION','REGISTRY_INTEGRITY_HASH','HUMAN_DELIVERY_AUTHORIZATION_ID','HUMAN_IDENTITY_ASSURANCE','AUTHORIZED_ARTIFACT_IDS','AUTHORIZED_FILENAMES','BYTE_SIZES','HASH_ALGORITHMS','DIGESTS','EXPECTED_PRECONDITION_REVISION','COMMITTED_PROJECT_REVISION','TERMINAL_PROOF_OBLIGATION_SET_HASH','TERMINAL_EVIDENCE_HASH','DELIVERY_STATE','CONTROLLING_REASON','RECEIPT_ID','EVENT_SEQUENCE','DELIVERY_RECORD_HASH'],ownership:{human:[],humanDecision:[],agent:[],application:['DELIVERY_ID','JOB_ID','PRODUCT_ID','PRODUCT_VERSION','BASELINE_ID','RELEASE_ID','HASH_REVIEW_ID','EVIDENCE_CHAIN_VERSION','EVIDENCE_CHAIN_SET_SHA256','DEFECT_REGISTRY_VERSION','REGRESSION_REGISTRY_VERSION','REGISTRY_INTEGRITY_HASH','HUMAN_DELIVERY_AUTHORIZATION_ID','HUMAN_IDENTITY_ASSURANCE','AUTHORIZED_ARTIFACT_IDS','AUTHORIZED_FILENAMES','BYTE_SIZES','HASH_ALGORITHMS','DIGESTS','EXPECTED_PRECONDITION_REVISION','COMMITTED_PROJECT_REVISION','TERMINAL_PROOF_OBLIGATION_SET_HASH','TERMINAL_EVIDENCE_HASH','DELIVERY_STATE','CONTROLLING_REASON','RECEIPT_ID','EVENT_SEQUENCE','DELIVERY_RECORD_HASH']},types:{PRODUCT_ID:TYPES.REFERENCE,BASELINE_ID:TYPES.REFERENCE,RELEASE_ID:TYPES.REFERENCE,AUTHORIZED_ARTIFACT_IDS:TYPES.REFERENCE_ARRAY,AUTHORIZED_FILENAMES:TYPES.STRING_ARRAY,BYTE_SIZES:TYPES.OBJECT,HASH_ALGORITHMS:TYPES.STRING_ARRAY,DIGESTS:TYPES.STRING_ARRAY,EXPECTED_PRECONDITION_REVISION:TYPES.INTEGER,COMMITTED_PROJECT_REVISION:TYPES.INTEGER,DELIVERY_STATE:enumType(DELIVERY_STATES),EVENT_SEQUENCE:TYPES.INTEGER},relationships:{PRODUCT_ID:'products',BASELINE_ID:'baselines',RELEASE_ID:'releaseRecords',AUTHORIZED_ARTIFACT_IDS:'artifacts'}});
added.deploymentManifests=makeRecord({collection:'deploymentManifests',title:'Source-to-deployment resource manifests',idField:'DEPLOYMENT_MANIFEST_ID',stage:null,policy:C.APPEND_ONLY,fields:['DEPLOYMENT_MANIFEST_ID','SCHEMA','SOURCE_COMMIT','WORKFLOW_RUN_ID','BUILD_IDENTITY','CANONICALIZATION_VERSION','RUNTIME_RESOURCES','CSP_VALUE','DEPENDENCY_MANIFEST_ID','TOOLCHAIN_MANIFEST_ID','BUILD_COMMAND','BUILD_ENVIRONMENT_IDENTITY','OVERALL_MANIFEST_DIGEST','EXTERNAL_RETRIEVAL_CLAIM','VERIFIED_DIGEST_COMPARISON','DEPLOYED_RESOURCE_STATUS','REPRODUCIBILITY_STATUS','STATUS'],ownership:{human:[],humanDecision:[],agent:['EXTERNAL_RETRIEVAL_CLAIM'],application:['DEPLOYMENT_MANIFEST_ID','SCHEMA','SOURCE_COMMIT','WORKFLOW_RUN_ID','BUILD_IDENTITY','CANONICALIZATION_VERSION','RUNTIME_RESOURCES','CSP_VALUE','DEPENDENCY_MANIFEST_ID','TOOLCHAIN_MANIFEST_ID','BUILD_COMMAND','BUILD_ENVIRONMENT_IDENTITY','OVERALL_MANIFEST_DIGEST','VERIFIED_DIGEST_COMPARISON','DEPLOYED_RESOURCE_STATUS','REPRODUCIBILITY_STATUS','STATUS']},types:{RUNTIME_RESOURCES:TYPES.OBJECT_ARRAY,EXTERNAL_RETRIEVAL_CLAIM:TYPES.NULLABLE_OBJECT,VERIFIED_DIGEST_COMPARISON:TYPES.OBJECT},required:[]});

const records={...base.RECORD_SCHEMAS,...added};
records.iterations=augmentRecord(records.iterations,'iterations',{typeOverrides:{PREVIOUS_ITERATION_ID:TYPES.NULLABLE_REFERENCE,CHANGESET_ID:TYPES.NULLABLE_REFERENCE}});
for(const collection of ['propositions','applicabilityRecords','proofObligations','entailmentReviews','environmentDependencies'])records[collection]=augmentRecord(records[collection],collection,{add:semanticStateFields,relationships:{SUPPORTING_EVIDENCE_IDS:'evidenceRecords'}});
records.sources=augmentRecord(records.sources,'sources',{add:{BYTE_IDENTITY_STATUS:{producer:P.APPLICATION},CLAIMED_PUBLISHER_IDENTITY:{producer:P.AGENT},RETRIEVAL_METHOD:{producer:P.AGENT},AUTHENTICITY_BASIS:{producer:P.APPLICATION,type:enumType(EPISTEMIC_BASES)},AUTHENTICITY_STATUS:{producer:P.APPLICATION,type:enumType(['VERIFIED','EXTERNALLY_SUPPORTED','SELF_ASSERTED','UNKNOWN','CONTRADICTED'])},FRESHNESS_STATUS:{producer:P.APPLICATION,type:enumType(FRESHNESS_STATUSES)}}});
const sourceFindingConsequenceFields=Object.freeze({SOURCE_AUTHENTICITY_STATUS:{producer:P.APPLICATION,type:enumType(['VERIFIED','EXTERNALLY_SUPPORTED','SELF_ASSERTED','UNKNOWN','CONTRADICTED'])},SOURCE_AUTHENTICITY_BASIS:{producer:P.APPLICATION,type:enumType(EPISTEMIC_BASES)},SOURCE_FRESHNESS_STATUS:{producer:P.APPLICATION,type:enumType(FRESHNESS_STATUSES)},SOURCE_FRESHNESS_BASIS:{producer:P.APPLICATION,type:enumType(EPISTEMIC_BASES)},SOURCE_EPISTEMIC_LIMITATION_REQUIRED:{producer:P.APPLICATION,type:TYPES.BOOLEAN}});
for(const collection of ['research','candidateRequirements'])records[collection]=augmentRecord(records[collection],collection,{add:sourceFindingConsequenceFields});
records.requirements=augmentRecord(records.requirements,'requirements',{add:{PRIMARY_PROPOSITION_ID:{producer:P.APPLICATION,type:TYPES.REFERENCE},SOURCE_IDS:{producer:P.APPLICATION,type:TYPES.REFERENCE_ARRAY},NORMATIVE_CLASSIFICATION:{producer:P.APPLICATION,type:enumType(NORMATIVE_CLASSES)},NORMATIVE_CLASSIFICATION_REVIEW_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_REFERENCE},CURRENT_APPLICABILITY:{producer:P.APPLICATION,type:enumType(APPLICABILITY_VALUES)},ACCEPTED_SEVERITY:{producer:P.APPLICATION,type:enumType(DEFECT_SEVERITIES)}},relationships:{PRIMARY_PROPOSITION_ID:'propositions',SOURCE_IDS:'sources',NORMATIVE_CLASSIFICATION_REVIEW_ID:'applicabilityReviews'}});
records.proofObligations=augmentRecord(records.proofObligations,'proofObligations',{add:{OBLIGATION_ROLE:{producer:P.APPLICATION,type:enumType(['RELEASE_PROPOSITION','CONDITIONAL_ACTIVATION'])}}});
records.tests=augmentRecord(records.tests,'tests',{add:{TEST_PROPOSITION_TEXT:{producer:P.AGENT},TARGET_PROPOSITION_IDS:{producer:P.APPLICATION,type:TYPES.REFERENCE_ARRAY},TESTED_SCOPE:{producer:P.AGENT,type:TYPES.OBJECT},POSITIVE_RESULT_MEANING:{producer:P.AGENT},NEGATIVE_RESULT_MEANING:{producer:P.AGENT},SEMANTIC_COVERAGE_DISPOSITION:{producer:P.AGENT,type:enumType(SEMANTIC_COVERAGE_VALUES)},ACCEPTED_SEMANTIC_COVERAGE:{producer:P.APPLICATION,type:enumType(SEMANTIC_COVERAGE_VALUES)},SEMANTIC_REVIEW_IDS:{producer:P.APPLICATION,type:TYPES.REFERENCE_ARRAY},TEST_ROLE:{producer:P.AGENT,type:enumType(TEST_ROLES)},RELEASE_BEARING:{producer:P.APPLICATION,type:TYPES.BOOLEAN},EXPECTED_VARIANCE_CONTRACT:{producer:P.AGENT,type:TYPES.OBJECT},REQUIRED_EVIDENCE_CLASSES:{producer:P.AGENT,type:TYPES.STRING_ARRAY},REQUIRED_EPISTEMIC_BASES:{producer:P.AGENT,type:TYPES.STRING_ARRAY},FRESHNESS_REQUIREMENTS:{producer:P.AGENT,type:TYPES.OBJECT},INDEPENDENCE_REQUIREMENTS:{producer:P.AGENT,type:TYPES.OBJECT},REQUIRED_RUN_DIMENSIONS:{producer:P.AGENT,type:TYPES.STRING_ARRAY}},relationships:{TARGET_PROPOSITION_IDS:'propositions',SEMANTIC_REVIEW_IDS:'testSemanticReviews'},required:['TEST_PROPOSITION_TEXT','TESTED_SCOPE','POSITIVE_RESULT_MEANING','NEGATIVE_RESULT_MEANING','SEMANTIC_COVERAGE_DISPOSITION','TEST_ROLE']});
records.observationRecords=augmentRecord(records.observationRecords,'observationRecords',{add:{TEST_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_REFERENCE},MUTATION_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_REFERENCE},INSPECTION_RESERVATION_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_REFERENCE}},relationships:{TEST_ID:'tests',MUTATION_ID:'failureTests',INSPECTION_RESERVATION_ID:'operationReservations'}});
records.failureTests=augmentRecord(records.failureTests,'failureTests',{add:{FAILURE_TEST_AVAILABILITY_CLASS:{producer:P.AGENT,type:enumType(['EXECUTABLE_NOW','DEFERRED_TARGET_DEPENDENT','NOT_APPLICABLE','BLOCKED'])},DEFERRED_EXECUTION_TRIGGER_STAGE:{producer:P.AGENT,type:TYPES.NULLABLE_INTEGER},DEFERRED_EXECUTION_PLAN:{producer:P.AGENT,type:TYPES.NULLABLE_OBJECT},OBSERVATION_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_REFERENCE},ENTAILMENT_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_REFERENCE}},relationships:{OBSERVATION_ID:'observationRecords',ENTAILMENT_ID:'entailmentReviews'}});
records.deterministicResults=augmentRecord(records.deterministicResults,'deterministicResults',{producerOverrides:{EXPECTED_RESULT:P.APPLICATION,ACTUAL_RESULT:P.APPLICATION,DETERMINATION:P.APPLICATION,EVIDENCE:P.APPLICATION},add:{PROPOSITION_ID:{producer:P.APPLICATION,type:TYPES.REFERENCE},PROOF_OBLIGATION_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_REFERENCE},OBSERVATION_ID:{producer:P.APPLICATION,type:TYPES.REFERENCE},ENTAILMENT_ID:{producer:P.APPLICATION,type:TYPES.REFERENCE},OBSERVATION_ORIGIN:{producer:P.APPLICATION,type:enumType(OBSERVATION_ORIGINS)},EPISTEMIC_BASIS:{producer:P.APPLICATION,type:enumType(EPISTEMIC_BASES)},INPUT_BINDING_BASIS:{producer:P.APPLICATION},RUNTIME_BUILD_IDENTITY:{producer:P.APPLICATION},TEST_WORKER_SHA256:{producer:P.APPLICATION},WORKER_PROTOCOL_VERSION:{producer:P.APPLICATION},PARSER_OR_ADAPTER_IDENTITIES:{producer:P.APPLICATION,type:TYPES.STRING_ARRAY},ENVIRONMENT_MANIFEST_ID:{producer:P.APPLICATION},FRESHNESS_STATUS:{producer:P.APPLICATION,type:enumType(FRESHNESS_STATUSES)}},relationships:{PROPOSITION_ID:'propositions',PROOF_OBLIGATION_ID:'proofObligations',OBSERVATION_ID:'observationRecords',ENTAILMENT_ID:'entailmentReviews'}});
for(const collection of ['verification','meaningResults','adversarialResults'])records[collection]=augmentRecord(records[collection],collection,{add:{PROPOSITION_ID:{producer:P.APPLICATION,type:TYPES.REFERENCE},PROOF_OBLIGATION_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_REFERENCE},OBSERVATION_ID:{producer:P.APPLICATION,type:TYPES.REFERENCE},ENTAILMENT_ID:{producer:P.APPLICATION,type:TYPES.REFERENCE},APPLICATION_DETERMINATION:{producer:P.APPLICATION,type:enumType(['SATISFIED','VIOLATED','UNDETERMINED'])},EPISTEMIC_BASIS:{producer:P.APPLICATION,type:enumType(EPISTEMIC_BASES)},FRESHNESS_STATUS:{producer:P.APPLICATION,type:enumType(FRESHNESS_STATUSES)}},relationships:{PROPOSITION_ID:'propositions',PROOF_OBLIGATION_ID:'proofObligations',OBSERVATION_ID:'observationRecords',ENTAILMENT_ID:'entailmentReviews'}});
records.representationInspections=augmentRecord(records.representationInspections,'representationInspections',{add:{TEST_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_REFERENCE},PROPOSITION_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_REFERENCE},PROOF_OBLIGATION_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_REFERENCE},OBSERVATION_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_REFERENCE},ENTAILMENT_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_REFERENCE},APPLICATION_DETERMINATION:{producer:P.APPLICATION,type:enumType(['SATISFIED','VIOLATED','UNDETERMINED'])},EPISTEMIC_BASIS:{producer:P.APPLICATION,type:enumType(EPISTEMIC_BASES)},FRESHNESS_STATUS:{producer:P.APPLICATION,type:enumType(FRESHNESS_STATUSES)}},relationships:{TEST_ID:'tests',PROPOSITION_ID:'propositions',PROOF_OBLIGATION_ID:'proofObligations',OBSERVATION_ID:'observationRecords',ENTAILMENT_ID:'entailmentReviews'}});
records.regressions=augmentRecord(records.regressions,'regressions',{add:{APPLICATION_LIFECYCLE:{producer:P.APPLICATION,type:enumType(REGRESSION_LIFECYCLE)},RETIREMENT_RECORD_IDS:{producer:P.APPLICATION,type:TYPES.STRING_ARRAY}}});
records.evidenceRecords=augmentRecord(records.evidenceRecords,'evidenceRecords',{add:{OBSERVATION_ORIGIN:{producer:P.APPLICATION,type:enumType(OBSERVATION_ORIGINS)},EPISTEMIC_BASIS:{producer:P.APPLICATION,type:enumType(EPISTEMIC_BASES)},FRESHNESS_STATUS:{producer:P.APPLICATION,type:enumType(FRESHNESS_STATUSES)},FRESHNESS_POLICY:{producer:P.APPLICATION,type:TYPES.OBJECT},FRESHNESS_EVALUATION_REASON:{producer:P.APPLICATION},OBSERVATION_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_REFERENCE},INSPECTION_RESERVATION_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_REFERENCE},SOURCE_SEARCH_CONTRACT_ID:{producer:P.APPLICATION},SOURCE_SEARCH_CONTRACT_SHA256:{producer:P.APPLICATION},SOURCE_SEARCH_CONTEXT_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_REFERENCE},SOURCE_SEARCH_ROLE:{producer:P.APPLICATION,type:enumType(['SEARCH_EXECUTION','ADEQUACY_REVIEW'])},ATTESTATION_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_STRING},ATTESTATION_VERIFICATION_STATUS:{producer:P.APPLICATION,type:{valueType:'STRING',enumValues:Object.freeze(['VERIFIED','NOT_VERIFIED','UNKNOWN']),nullable:true}},ATTESTATION_VERIFIER_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_STRING},ATTESTATION_BINDING:{producer:P.APPLICATION,type:TYPES.NULLABLE_OBJECT}},relationships:{OBSERVATION_ID:'observationRecords',INSPECTION_RESERVATION_ID:'operationReservations',SOURCE_SEARCH_CONTEXT_ID:'freshContexts'}});
records.evidenceChains=augmentRecord(records.evidenceChains,'evidenceChains',{add:{
  PROPOSITION_ID:{producer:P.APPLICATION,type:TYPES.REFERENCE},PROOF_OBLIGATION_ID:{producer:P.APPLICATION,type:TYPES.REFERENCE},
  APPLICABILITY_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_REFERENCE},APPLICABILITY_STATE:{producer:P.APPLICATION,type:enumType(APPLICABILITY_VALUES)},
  PROOF_EXPRESSION_ID:{producer:P.APPLICATION,type:TYPES.REFERENCE},OBSERVATION_IDS:{producer:P.APPLICATION,type:TYPES.REFERENCE_ARRAY},
  ENTAILMENT_IDS:{producer:P.APPLICATION,type:TYPES.REFERENCE_ARRAY},EPISTEMIC_BASES:{producer:P.APPLICATION,type:TYPES.STRING_ARRAY},
  FRESHNESS_STATUSES:{producer:P.APPLICATION,type:TYPES.STRING_ARRAY},ENVIRONMENT_DEPENDENCY_IDS:{producer:P.APPLICATION,type:TYPES.REFERENCE_ARRAY},
  CURRENT_SCOPE_STATUS:{producer:P.APPLICATION,type:enumType(CURRENT_SCOPE_STATUSES)},JUSTIFICATION_CYCLE_COUNT:{producer:P.APPLICATION,type:TYPES.INTEGER},
  STRUCTURALLY_COMPLETE:{producer:P.APPLICATION,type:TYPES.BOOLEAN},EVIDENCE_SUFFICIENT:{producer:P.APPLICATION,type:TYPES.BOOLEAN},
  ARTIFACT_IDENTITY_CURRENT:{producer:P.APPLICATION,type:TYPES.BOOLEAN},SOURCE_IDS:{producer:P.APPLICATION,type:TYPES.REFERENCE_ARRAY},SOURCE_EVIDENCE_IDS:{producer:P.APPLICATION,type:TYPES.REFERENCE_ARRAY},EVIDENCE_CHAIN_SET_SHA256:{producer:P.APPLICATION}
},relationships:{PROPOSITION_ID:'propositions',PROOF_OBLIGATION_ID:'proofObligations',APPLICABILITY_ID:'applicabilityRecords',PROOF_EXPRESSION_ID:'proofExpressions',OBSERVATION_IDS:'observationRecords',ENTAILMENT_IDS:'entailmentReviews',ENVIRONMENT_DEPENDENCY_IDS:'environmentDependencies',SOURCE_IDS:'sources',SOURCE_EVIDENCE_IDS:'evidenceRecords'}});
records.artifacts=augmentRecord(records.artifacts,'artifacts',{add:{RAW_FILENAME:{producer:P.APPLICATION},DISPLAY_FILENAME:{producer:P.APPLICATION},CANONICAL_PATH:{producer:P.APPLICATION},FILENAME_NORMALIZATION_VERSION:{producer:P.APPLICATION},COLLISION_KEYS:{producer:P.APPLICATION,type:TYPES.STRING_ARRAY},AUTHORIZED_DELIVERY_FILENAME:{producer:P.APPLICATION,type:TYPES.NULLABLE_STRING},HASH_ALGORITHM:{producer:P.APPLICATION},DECLARED_MEDIA_TYPE:{producer:P.APPLICATION},DETECTED_FORMAT:{producer:P.APPLICATION},PARSER_OR_ADAPTER_IDENTITY:{producer:P.APPLICATION},FORMAT_AMBIGUITY_STATUS:{producer:P.APPLICATION},DISCLOSURE_CLASSIFICATION:{producer:P.APPLICATION,type:enumType(DISCLOSURE_CLASSIFICATIONS)}}});
records.sources=augmentRecord(records.sources,'sources',{add:{AUTHENTICITY_TRUTH_VALUE:{producer:P.APPLICATION,type:enumType(TRUTH_VALUES)},CURRENT_SCOPE_STATUS:{producer:P.APPLICATION,type:enumType(CURRENT_SCOPE_STATUSES)},AUTHENTICITY_CONTRADICTION_STATUS:{producer:P.APPLICATION,type:enumType(CONTRADICTION_STATUSES)},AUTHENTICITY_REASONS:{producer:P.APPLICATION,type:TYPES.STRING_ARRAY},AUTHENTICITY_EVIDENCE_IDS:{producer:P.APPLICATION,type:TYPES.REFERENCE_ARRAY},AUTHENTICITY_DERIVATION_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_STRING},FRESHNESS_BASIS:{producer:P.APPLICATION,type:enumType(EPISTEMIC_BASES)},FRESHNESS_CONTRADICTION_STATUS:{producer:P.APPLICATION,type:enumType(CONTRADICTION_STATUSES)},FRESHNESS_REASONS:{producer:P.APPLICATION,type:TYPES.STRING_ARRAY},FRESHNESS_EVIDENCE_IDS:{producer:P.APPLICATION,type:TYPES.REFERENCE_ARRAY},FRESHNESS_DERIVATION_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_STRING}},relationships:{AUTHENTICITY_EVIDENCE_IDS:'evidenceRecords',FRESHNESS_EVIDENCE_IDS:'evidenceRecords'}});
records.freshContexts=augmentRecord(records.freshContexts,'freshContexts',{add:{APPLICATION_SESSION_DISTINCTNESS:{producer:P.APPLICATION,type:enumType(TRUTH_VALUES)},APPLICATION_INPUT_ISOLATION:{producer:P.APPLICATION,type:enumType(TRUTH_VALUES)},USER_TRANSFER_CONFORMITY:{producer:P.APPLICATION,type:enumType(TRUTH_VALUES)},EXTERNAL_CONTEXT_IDENTIFIER_DISTINCTNESS:{producer:P.APPLICATION,type:enumType(TRUTH_VALUES)},PROVIDER_CONTEXT_INDEPENDENCE:{producer:P.APPLICATION,type:enumType(TRUTH_VALUES)},EXECUTOR_OR_REVIEWER_ROLE_SEPARATION:{producer:P.APPLICATION,type:enumType(TRUTH_VALUES)},ENVIRONMENT_INDEPENDENCE:{producer:P.APPLICATION,type:enumType(TRUTH_VALUES)},INDEPENDENCE_EPISTEMIC_BASIS:{producer:P.APPLICATION,type:enumType(EPISTEMIC_BASES)},INDEPENDENCE_CURRENT_SCOPE_STATUS:{producer:P.APPLICATION,type:enumType(CURRENT_SCOPE_STATUSES)},INDEPENDENCE_FRESHNESS_STATUS:{producer:P.APPLICATION,type:enumType(FRESHNESS_STATUSES)},INDEPENDENCE_CONTRADICTION_STATUS:{producer:P.APPLICATION,type:enumType(CONTRADICTION_STATUSES)},INDEPENDENCE_REASONS:{producer:P.APPLICATION,type:TYPES.STRING_ARRAY},INDEPENDENCE_EVIDENCE_IDS:{producer:P.APPLICATION,type:TYPES.REFERENCE_ARRAY},INDEPENDENCE_DERIVATION_ID:{producer:P.APPLICATION,type:TYPES.NULLABLE_STRING}},relationships:{INDEPENDENCE_EVIDENCE_IDS:'evidenceRecords'}});
/* Ratios are persisted as an exact reduced numerator/denominator object.
   A binary floating-point Number is intentionally not accepted by the
   canonical JSON implementation, even for UI-friendly values such as 0.5. */
records.convergenceRecords=augmentRecord(records.convergenceRecords,'convergenceRecords',{typeOverrides:{
  REQUIREMENT_COVERAGE:TYPES.EXACT_RATIO,
  VERIFICATION_COVERAGE:TYPES.EXACT_RATIO,
  REGRESSION_SUCCESS:TYPES.EXACT_RATIO
}});

const EXACT_RATIO_STAGE_FIELD_NAMES=Object.freeze({
  6:Object.freeze(['MANDATORY_TEST_COVERAGE']),
  7:Object.freeze(['FAILURE_TEST_COVERAGE']),
  18:Object.freeze(['MANDATORY_REQUIREMENT_COVERAGE','MANDATORY_VERIFICATION_COVERAGE','PROOF_OBLIGATION_COVERAGE']),
  29:Object.freeze(['MANDATORY_EVIDENCE_CHAIN_COVERAGE','EPISTEMIC_BASIS_COVERAGE','FRESHNESS_COVERAGE','ENVIRONMENT_DEPENDENCY_COVERAGE'])
});
const exactRatioStageField=(prior)=>Object.freeze({...prior,
  valueType:'OBJECT',enumValues:Object.freeze([]),nullable:false,
  normalizerKey:'EXACT_RATIO_V1',normalizer:null,
  closedProperties:EXACT_RATIO_PROPERTIES,
  help:'Read-only exact ratio; recalculated by the application and stored as a reduced numerator/denominator pair.'
});
const stageFields=Object.freeze(Object.fromEntries(Object.entries(base.STAGE_FIELDS).map(([stage,definitions])=>{
  const next={...definitions};for(const name of EXACT_RATIO_STAGE_FIELD_NAMES[stage]||[]){if(!next[name])throw new Error(`Missing exact-ratio stage field ${stage}.${name}.`);next[name]=exactRatioStageField(next[name]);}
  return [stage,Object.freeze(next)];
})));
const amendmentStageFieldTypes=Object.freeze(Object.fromEntries(Object.entries(base.AMENDMENT_STAGE_FIELD_TYPES).map(([stage,definitions])=>{
  const next={...definitions};for(const name of EXACT_RATIO_STAGE_FIELD_NAMES[stage]||[]){if(next[name])next[name]=Object.freeze({...TYPES.EXACT_RATIO,normalizerKey:'EXACT_RATIO_V1'});}
  return [stage,Object.freeze(next)];
})));
function stageFieldDefinition(stage,name){const definition=stageFields[Number(stage)]?.[name];if(!definition)throw new Error(`Stage ${stage} field ${name} has no explicit type metadata.`);return definition;}

const recordOwnership=Object.freeze(Object.fromEntries(Object.entries(records).map(([name,record])=>[name,record.ownership])));
const unique=values=>Object.freeze([...new Set(values)]);
const stageAdds={4:['propositions'],5:['propositionEquivalenceReviews','applicabilityRecords','applicabilityReviews'],6:['proofExpressions','testSemanticReviews','environmentDependencies'],12:['observationRecords','entailmentReviews'],22:['observationRecords','entailmentReviews'],23:['observationRecords','entailmentReviews'],24:['observationRecords','entailmentReviews'],25:['observationRecords','entailmentReviews']};
const stageCollections=Object.freeze(Object.fromEntries(Array.from({length:base.STAGE_COUNT},(_,index)=>{const stage=index+1;return [stage,unique([...(base.STAGE_COLLECTIONS[stage]||[]),...(stageAdds[stage]||[])])];})));
const applicationCollections=Object.freeze(Object.fromEntries(Array.from({length:base.STAGE_COUNT},(_,index)=>{const stage=index+1,add=['operationReservations'];if(stage>=6)add.push('proofObligations');if(stage===22)add.push('observationRecords');if(stage===30)add.push('deliveryRecords');return [stage,unique([...(base.APPLICATION_COLLECTIONS[stage]||[]),...add])];})));
/* Prompt-readable context is deliberately narrower than application gate
   access. In particular, an operation that creates an observation or
   entailment must not receive prior reviewers' observations merely because
   those collections exist in canonical state. */
const proofContext=Object.freeze(['propositions','propositionEquivalenceReviews','applicabilityRecords','applicabilityReviews','proofExpressions','testSemanticReviews','proofObligations','environmentDependencies']);
const proofContextWithoutReviewHistory=Object.freeze(['propositions','applicabilityRecords','proofExpressions','proofObligations','environmentDependencies']);
const proofAndObservationContext=Object.freeze([...proofContext,'observationRecords','entailmentReviews']);
const AMENDMENT_PROMPT_READS=Object.freeze({
  5:Object.freeze(['propositions','applicabilityRecords','applicabilityReviews']),
  6:Object.freeze(['propositions','applicabilityRecords','applicabilityReviews','proofExpressions','testSemanticReviews','tests']),
  7:proofContext,8:proofContext,9:proofContext,10:Object.freeze(['proofObligations','environmentDependencies']),
  12:proofContextWithoutReviewHistory,13:proofAndObservationContext,14:proofAndObservationContext,15:proofAndObservationContext,16:proofAndObservationContext,
  18:proofAndObservationContext,
  22:proofContextWithoutReviewHistory,23:proofContextWithoutReviewHistory,24:proofContextWithoutReviewHistory,25:proofContextWithoutReviewHistory,
  26:proofAndObservationContext,27:proofAndObservationContext,29:proofAndObservationContext
});
const AMENDMENT_OPERATION_PROMPT_READS=Object.freeze({
  17:Object.freeze({
    FREEZE:Object.freeze(['proofObligations','environmentDependencies']),EXECUTE_RUN:Object.freeze([]),VERIFY:proofContextWithoutReviewHistory,
    COMPARE:proofAndObservationContext,ROOT_CAUSE:proofAndObservationContext,REGRESSION:proofAndObservationContext,CORRECT:proofAndObservationContext
  }),
  19:Object.freeze({
    CONFIRM_FREEZE:Object.freeze(['proofObligations','environmentDependencies']),EXECUTE_RUN:Object.freeze([]),VERIFY:proofContextWithoutReviewHistory,
    COMPARE:proofAndObservationContext,REGRESSION_VERIFY:proofAndObservationContext,CONFIRM:proofAndObservationContext
  })
});
const readCollections=Object.freeze(Object.fromEntries(Array.from({length:base.STAGE_COUNT},(_,index)=>{const stage=index+1,add=AMENDMENT_PROMPT_READS[stage]||[];return [stage,unique([...(base.READ_COLLECTIONS[stage]||[]),...add])];})));
const stageOperations=Object.freeze({...base.STAGE_OPERATIONS,
  5:Object.freeze(['COMPLETE','APPLICABILITY_REVIEW']),
  6:Object.freeze(['COMPLETE','SEMANTIC_REVIEW'])
});
const stageContracts=Object.freeze(Object.fromEntries(Array.from({length:base.STAGE_COUNT},(_,index)=>{const stage=index+1,current=base.STAGE_CONTRACTS[stage],supportCollections=[...(current.supportCollections||[])];if([5,6].includes(stage)&&!supportCollections.includes('freshContexts'))supportCollections.push('freshContexts');return [stage,Object.freeze({...current,readCollections:readCollections[stage],agentWritableCollections:stageCollections[stage],allowedCollections:stageCollections[stage],primaryCollections:stageCollections[stage],applicationCollections:applicationCollections[stage],supportCollections:Object.freeze(supportCollections),operations:stageOperations[stage]})];})));
function amendmentReadCollections(stage,operation){return AMENDMENT_OPERATION_PROMPT_READS[stage]?.[operation]||AMENDMENT_PROMPT_READS[stage]||[];}
function operationContract(stage,operation){
  const prior=base.operationContract(stage,operation);
  const semanticReview=stage===5&&operation==='APPLICABILITY_REVIEW'||stage===6&&operation==='SEMANTIC_REVIEW';
  const semanticAuthor=[5,6].includes(stage)&&operation==='COMPLETE';
  if(!prior&&!semanticReview)return null;
  const fallback=prior||{operation,readCollections:readCollections[stage],agentWritableCollections:stageCollections[stage],allowedStageData:stageContracts[stage]?.allowedStageData||[],applicationCollections:applicationCollections[stage],humanActions:stageContracts[stage]?.humanActions||[],scopeRequirements:[]};
  const operationScoped=stage===2||stage===5||stage===6||stage===17||stage===19;
  const operationWrites=operationScoped
    ? semanticReview
      ? [stage===5?'applicabilityReviews':'testSemanticReviews']
      : semanticAuthor
        ? stageCollections[stage].filter(collection=>collection!==(stage===5?'applicabilityReviews':'testSemanticReviews'))
      : unique([...(fallback.agentWritableCollections||[]),...((operation==='VERIFY')?['observationRecords','entailmentReviews']:[])]).filter(collection=>!(stage===5&&collection==='applicabilityReviews')&&!(stage===6&&collection==='testSemanticReviews'))
    : stageCollections[stage];
  const scopeRequirements=unique([...(fallback.scopeRequirements||[]),...([5,6].includes(stage)?['contextId']:[])]);
  return Object.freeze({...fallback,
    readCollections:unique([...(fallback.readCollections||[]),...amendmentReadCollections(stage,operation)]),
    agentWritableCollections:operationWrites,
    applicationCollections:applicationCollections[stage],
    scopeRequirements:Object.freeze(scopeRequirements)
  });
}
function validateProofExpression(expression){
  const issues=[],seen=new WeakSet();let nodes=0;
  const visit=(node,path='$')=>{if(!node||typeof node!=='object'||Array.isArray(node)){issues.push(`${path} must be a proof-expression object.`);return;}if(seen.has(node)){issues.push(`${path} creates a proof-expression cycle.`);return;}seen.add(node);nodes++;if(nodes>1024){issues.push('Proof expression exceeds 1024 nodes.');return;}const op=node.op;if(!PROOF_OPERATORS.includes(op)){issues.push(`${path}.op is unsupported.`);return;}const allowed=op==='LEAF'?['op','leafType','referenceId']:op==='AT_LEAST_K'?['op','k','children']:['op','children'];for(const key of Object.keys(node))if(!allowed.includes(key))issues.push(`${path} contains unknown property ${key}.`);if(op==='LEAF'){if(typeof node.leafType!=='string'||!node.leafType||typeof node.referenceId!=='string'||!node.referenceId)issues.push(`${path} LEAF requires leafType and referenceId.`);else if(!PROOF_LEAF_TYPES.includes(node.leafType))issues.push(`${path}.leafType is unsupported.`);}else{if(!Array.isArray(node.children)||!node.children.length)issues.push(`${path}.${op} requires nonempty children.`);else node.children.forEach((child,index)=>visit(child,`${path}.children[${index}]`));if(op==='AT_LEAST_K'&&(!Number.isSafeInteger(node.k)||node.k<1||node.k>node.children.length))issues.push(`${path}.k must be a safe integer from 1 through child count.`);}seen.delete(node);};
  visit(expression);return {valid:issues.length===0,issues};
}
const RESPONSE_ENVELOPE_CONTRACT=Object.freeze({schema:base.RESPONSE_SCHEMA,required:Object.freeze(['schema','jobId','stage','operation','promptIdentity','scope','responseType','humanInputRequests','stageData','records','evidence','unresolved','warnings','attachments']),optional:Object.freeze(['operationBinding']),closedProperties:Object.freeze(['schema','jobId','stage','operation','promptIdentity','operationBinding','scope','responseType','humanInputRequests','stageData','records','evidence','unresolved','warnings','attachments']),promptIdentity:Object.freeze({required:Object.freeze(['instructionId','bodySha256','contractSha256','contextSignature']),closedProperties:Object.freeze(['instructionId','bodySha256','contractSha256','contextSignature'])}),operationBinding:Object.freeze({required:Object.freeze(['packageId','operationReservationId','challengeNonce','projectRevision','scopeSha256','targetSlot']),closedProperties:Object.freeze(['packageId','operationReservationId','challengeNonce','projectRevision','scopeSha256','targetSlot']),conditional:true})});
const WORKER_IDENTITY_CONTRACT=Object.freeze({buildIdentity:base.BUILD_IDENTITY,workerProtocolVersion:base.WORKER_PROTOCOL_VERSION,workerByteDigest:Object.freeze({hashAlgorithm:'SHA-256',source:'closed-loop-deployment-manifest/1',requiredForReleaseBearingResult:true})});
const replacement={...base,version:'closed-loop-workflow-schema/3',__controllingCompletionAmendmentVersion:'closed-loop-controlling-completion/53-70/1',CANONICAL_JSON_VERSION:'closed-loop-canonical-json/1',PROOF_EXPRESSION_VERSION:'closed-loop-proof-expression/1',FILENAME_NORMALIZATION_VERSION:'closed-loop-filename/1',DEPLOYMENT_MANIFEST_SCHEMA:'closed-loop-deployment-manifest/1',WORKER_PROTOCOL_VERSION:base.WORKER_PROTOCOL_VERSION,BUILD_IDENTITY:base.BUILD_IDENTITY,WORKER_IDENTITY_CONTRACT,EXACT_RATIO_SCHEMA,EXACT_RATIO_PROPERTIES,EXACT_RATIO_STAGE_FIELD_NAMES,makeExactRatio,validateExactRatio,exactRatioToNumber,TYPES,TRUTH_VALUES,EPISTEMIC_BASES,CURRENT_SCOPE_STATUSES,FRESHNESS_STATUSES,CONTRADICTION_STATUSES,MATERIALITY_VALUES,SEMANTIC_COVERAGE_VALUES,NORMATIVE_CLASSES,NORMATIVE_CLASS_VALUES:NORMATIVE_CLASSES,APPLICABILITY_VALUES,ENTAILMENT_VALUES,OBSERVATION_ORIGINS,OBSERVATION_ORIGIN_VALUES:OBSERVATION_ORIGINS,TEST_ROLES,PROOF_OPERATORS,PROOF_EXPRESSION_OPERATORS:PROOF_OPERATORS,PROOF_LEAF_TYPES,DEFECT_SEVERITIES,DISCLOSURE_CLASSIFICATIONS,DELIVERY_STATES,DELIVERY_STATE_VALUES:DELIVERY_STATES,RESERVATION_STATUSES,REGRESSION_LIFECYCLE,PROPOSITION_ROLES,TEST_SEMANTIC_SUBJECT_KINDS,SEMANTIC_REVIEW_FINDINGS,APPLICABILITY_REVIEW_FINDINGS,RESPONSE_ENVELOPE_CONTRACT,AMENDMENT_STAGE_FIELD_TYPES:amendmentStageFieldTypes,STAGE_FIELDS:stageFields,stageFieldDefinition,RECORD_SCHEMAS:Object.freeze(records),RECORD_OWNERSHIP:recordOwnership,STAGE_OPERATIONS:stageOperations,STAGE_COLLECTIONS:stageCollections,APPLICATION_COLLECTIONS:applicationCollections,READ_COLLECTIONS:readCollections,STAGE_CONTRACTS:stageContracts,operationContract,allowedCollections:stage=>stageCollections[stage]||Object.freeze([]),recordAgentFields:collection=>Object.freeze(Object.values(records[collection]?.fieldDefinitions||{}).filter(item=>item.producer===P.AGENT).map(item=>item.name)),recordHumanFields:collection=>Object.freeze(Object.values(records[collection]?.fieldDefinitions||{}).filter(item=>item.producer===P.HUMAN||item.producer===P.HUMAN_DECISION).map(item=>item.name)),validateProofExpression};
globalThis.closedLoopWorkflowSchema=Object.freeze(replacement);
})();

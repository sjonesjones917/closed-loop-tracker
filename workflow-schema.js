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
const CONTRACT_PROFILE_ID='closed-loop-completion-profile/1';
const VALUE_TYPES=Object.freeze(['STRING','INTEGER','NUMBER','BOOLEAN','STRING_ARRAY','REFERENCE','REFERENCE_ARRAY','OBJECT','OBJECT_ARRAY']);
const COLLECTION_POLICIES=Object.freeze({REPLACE_CURRENT_STAGE_SET:'REPLACE_CURRENT_STAGE_SET',APPEND_SCOPED:'APPEND_SCOPED',UPDATE_RESERVED:'UPDATE_RESERVED',APPEND_ONLY:'APPEND_ONLY',APPLICATION_DERIVED:'APPLICATION_DERIVED'});
const DEFAULT_RESOURCE_LIMITS=Object.freeze({maxRawResponseBytes:1048576,maxJsonDepth:32,maxRecordsPerCollection:250,maxEvidenceRecords:500,maxAttachments:25,maxTextFieldLength:200000});
const RESPONSE_TYPES=Object.freeze(['DATA_PROPOSAL','HUMAN_INPUT_REQUIRED','BLOCKED','EXECUTION_FAILED']);
const CONFLICT_POLICIES=Object.freeze(['reject','request clarification','controlled override']);
const STAGE_OPERATIONS=Object.freeze({
  1:Object.freeze(['COMPLETE','SEMANTIC_CHALLENGE','RECONCILE_INTAKE']),
  2:Object.freeze(['COMPLETE','SEARCH_ADEQUACY_REVIEW','RECONCILE_SOURCE_SEARCH']),
  3:Object.freeze(['COMPLETE','SEMANTIC_CHALLENGE','RECONCILE_RESEARCH']),
  4:Object.freeze(['COMPLETE','DISPOSITION_CHALLENGE','ATOMICITY_CHALLENGE','RECONCILE_REQUIREMENTS']),
  5:Object.freeze(['COMPLETE','SEMANTIC_REVIEW','RECONCILE_REQUIREMENT_SET']),
  6:Object.freeze(['COMPLETE','PROOF_REVIEW','RECONCILE_VERIFICATION_SUITE']),
  7:Object.freeze(['COMPLETE','EXECUTE_FAILURE_TEST']),
  8:Object.freeze(['COMPLETE']),
  9:Object.freeze(['COMPLETE']),
  10:Object.freeze(['FREEZE']),
  11:Object.freeze(['EXECUTE_RUN']),
  12:Object.freeze(['VERIFY']),
  13:Object.freeze(['COMPARE']),
  14:Object.freeze(['ROOT_CAUSE']),
  15:Object.freeze(['COMPLETE','EXECUTE_REGRESSION']),
  16:Object.freeze(['CORRECT']),
  17:Object.freeze(['FREEZE','EXECUTE_RUN','VERIFY','COMPARE','ROOT_CAUSE','REGRESSION','CORRECT']),
  18:Object.freeze(['COMPLETE']),
  19:Object.freeze(['CONFIRM_FREEZE','EXECUTE_RUN','VERIFY','COMPARE','REGRESSION_VERIFY','CONFIRM']),
  20:Object.freeze(['FREEZE_BASELINE']),
  21:Object.freeze(['COMPLETE']),
  22:Object.freeze(['RUN_NATIVE_TESTS','EXECUTE_EXTERNAL_TEST']),
  23:Object.freeze(['COMPLETE']),
  24:Object.freeze(['RUN_NATIVE_ATTACKS','COMPLETE']),
  25:Object.freeze(['FREEZE_DELIVERY_CANDIDATE','COMPLETE']),
  26:Object.freeze(['COMPLETE','SEMANTIC_REVIEW','RECONCILE']),
  27:Object.freeze(['CALCULATE_RELEASE','ADVISORY_REVIEW']),
  28:Object.freeze(['VERIFY_IDENTITY','CAPTURE_DELIVERY_INTENT']),
  29:Object.freeze(['CALCULATE_EVIDENCE_CHAINS','INVESTIGATE_MISSING_EVIDENCE']),
  30:Object.freeze(['CALCULATE_TERMINAL','EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','RECORD_DELIVERY_EVIDENCE'])
});

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
  'JOB_ID','CONTRACT_PROFILE_ID','DATE_OPENED','CURRENT_ITERATION','CURRENT_STAGE','CURRENT_STATE','CURRENT_INPUT_VERSION',
  'CURRENT_SOURCE_SET_VERSION','CURRENT_RESEARCH_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION',
  'CURRENT_INSTRUCTION_VERSION','CURRENT_CANDIDATE_ID','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_PRODUCT_VERSION',
  'CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID',
  'CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID','CURRENT_BLOCKERS',
  'NEXT_REQUIRED_ACTION','LATEST_EVIDENCE_REFERENCE','INPUT_SET_HASH_OR_MANIFEST','JOB_RECORD_STATUS',
  'STATUS_EVIDENCE'
]);
const AGENT_JOB_FIELDS=Object.freeze([
  'EXACT_DELIVERABLE_REQUESTED','ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS'
]);

function jobFieldDefinition(name){
  if(HUMAN_DECISION_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN_DECISION,{nullable:true,provenanceRequired:false});
  if(APPLICATION_JOB_FIELDS.includes(name)){
    const nullablePointers=new Set(['CURRENT_ITERATION','CURRENT_SOURCE_SET_VERSION','CURRENT_RESEARCH_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION','CURRENT_INSTRUCTION_VERSION','CURRENT_CANDIDATE_ID','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_PRODUCT_VERSION','CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID','CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID','LATEST_EVIDENCE_REFERENCE']);
    const enums=name==='CURRENT_STATE'?['BLOCKED','AWAITING_HUMAN_INPUT','PROPOSAL_PENDING_REVIEW','RESPONSE_STAGED','AWAITING_EXTERNAL_RESPONSE','READY_FOR_NEXT_OPERATION','WORKFLOW_COMPLETE']:name==='JOB_RECORD_STATUS'?['INCOMPLETE','BLOCKED','COMPLETE']:name==='CONTRACT_PROFILE_ID'?[CONTRACT_PROFILE_ID]:[];
    return field(name,PRODUCER.APPLICATION,{nullable:nullablePointers.has(name),enumValues:enums,derivation:`Application derives ${name} from canonical project state.`});
  }
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
      "COMPONENT_SELECTION_DECISION_ID",
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
    "humanDecision": [],
    "agent": [],
    "application": [
      "BASELINE_ID",
      "SUPPORTING_CONFIRMATION_ID",
      "APPROVED_VERSIONS",
      "HASHES",
      "IMMUTABLE_ARTIFACT_RECORDS",
      "AUTHORIZED_RECIPIENT_ROLES",
      "CONTROLLED_STORAGE",
      "HUMAN_AUTHORIZATION",
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
const EXPLICIT_STAGE_FIELD_TYPES=Object.freeze({"1":{"ASSUMPTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AVAILABLE_TOOLS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DATE_OPENED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEADLINE_OR_TEMPORAL_SCOPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_DELIVERABLE_REQUESTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_USER_OBJECTIVE_VERBATIM":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPLICIT_USER_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_SET_CONTENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_SET_HASH_OR_MANIFEST":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_SET_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"JOB_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"JOB_OWNER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"JOB_RECORD_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"JOB_TITLE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_AUTHORITATIVE_SOURCES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROHIBITED_ACTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_OUTPUT_FORMAT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SUPPLIED_MATERIALS_INVENTORY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNKNOWN_INFORMATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"10":{"ALL_REQUIRED_COMPONENTS_PRESENT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ALL_RUNS_WILL_RECEIVE_IDENTICAL_FROZEN_MATERIALS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CHANGES_ALLOWED_DURING_BATCH":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FREEZE_DATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FREEZE_OWNER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FROZEN_COMPONENT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOL_CONFIGURATION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"11":{"CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTAMINATED_RUNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FRESH_CONTEXTS_CREATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FROZEN_EXECUTION_PACKAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUTS_SAVED_SEPARATELY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUNS_RECEIVING_EXACT_PACKAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUN_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"12":{"ACTIVE_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ACTUAL_MANDATORY_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPECTED_MANDATORY_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MISSING_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"REQUIREMENTS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SATISFIED_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"SELF_VALIDATED_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEST_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDETERMINED_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"VERIFICATION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"VIOLATED_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"13":{"COMPARISON_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CORRECTNESS_AFFECTING_DISAGREEMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INCONCLUSIVE_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROHIBITED_OUTPUT_VARIANCES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REPEATED_FAILURE_GROUPS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_SATISFIED_BY_ALL_TEN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_WITH_AT_LEAST_ONE_UNDETERMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_WITH_AT_LEAST_ONE_VIOLATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENT_COMPARISON_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNIQUE_FAILURES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"14":{"BLOCKED_ANALYSES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONFIRMED_ROOT_CAUSES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_ROOT_CAUSE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"ROOT_CAUSE_ANALYSIS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_MATERIAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNDETERMINED_ROOT_CAUSES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"15":{"CONFIRMED_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"CONFIRMED_DEFECTS_WITH_REGRESSION_TEST":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_TEST_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_TEST_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRE_CORRECTION_FAILURES_PROVEN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSION_FIXTURE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNCONVERTED_CONFIRMED_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"16":{"ARTIFACTS_CHANGED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ARTIFACT_CHANGE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"CHANGE_SET_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DOWNSTREAM_VERIFICATIONS_INVALIDATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IF_EXECUTION_ONLY_DEFECT_WAS_INSTRUCTION_PRESERVED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_CHANGED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IN_PLACE_MODIFICATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_VERSIONS_CREATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PREFLIGHT_REPEATED_IF_CHANGED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RCA_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TRIGGERING_DEFECT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"17":{"CHANGESET_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COMPARE_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CORRECTIONS_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTE_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IDENTICAL_PACKAGE_CONFIRMED_FOR_ALL_RUNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_FROZEN_VERSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OLD_CONVERSATIONS_CONTINUED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PREVIOUS_CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PREVIOUS_ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRIOR_OUTPUTS_WITHHELD":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSION_TESTS_ADDED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ROOT_CAUSE_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUN_NAMESPACE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEN_NEW_CONTEXTS_CREATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERIFY_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"18":{"ALL_CONDITIONS_SIMULTANEOUSLY_TRUE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"CRITICAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILED_CONDITIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_CORRECTNESS_AFFECTING_AMBIGUITIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_CORRECTNESS_AFFECTING_CONTRADICTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MAJOR_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MANDATORY_REQUIREMENTS_WITH_AFFIRMATIVE_APPLICABLE_VERIFICATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENTS_WITH_COMPLETE_SPECIFICATION_AND_APPLICABILITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENT_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"MANDATORY_UNRESOLVED_UNKNOWNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MANDATORY_VERIFICATION_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"METRICS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSION_TEST_SUCCESS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RETURN_STAGE_FOR_EACH_FAILURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SUCCESSFUL_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_STILL_APPLICABLE_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNEXPLAINED_CORRECTNESS_AFFECTING_EXECUTION_VARIANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"19":{"ALL_REGRESSION_TESTS_RUN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"COMPLETE_TEST_SUITE_RUN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONFIRMATION_ACCEPTANCE_CRITERIA_SATISFIED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONFIRMATION_ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CROSS_RUN_COMPARISON_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INJECTED_DEFECTS_NOT_DETECTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_CORRECTNESS_AFFECTING_VARIANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_CRITICAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_MAJOR_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_REQUIREMENTS_DISCOVERED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_RETURN_STAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUNS_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SAME_FROZEN_PACKAGE_USED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_CONVERGED_ITERATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEN_NEW_CONTEXTS_CREATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ZERO_CHANGE_AUDIT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"2":{"AUTHORITY_HIERARCHY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_CONTROLLING_SOURCES_EXAMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_CONFLICT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"SOURCE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"SOURCE_SET_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNRESOLVED_CONTROLLING_CONFLICTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"20":{"ALL_APPROVED_COMPONENTS_PRESENT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ALL_IMMUTABLE_FILES_HASHED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ANY_CHANGED_COMPONENT_RETAINS_BASELINE_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"APPROVED_VERSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_APPROVAL_DATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_FILE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_OWNER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_PACKAGE_SEPARATED_FROM_WORKING_FILES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SUPPORTING_CONFIRMATION_ITERATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNCHANGED_CONFIRMATION_SUCCEEDED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"}},"21":{"AFFECTED_VALIDATION_IDENTIFIED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_MATERIALS_SUPPLIED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EDITED_OUTSIDE_CONTROLLED_WORKFLOW":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EDIT_REQUIRED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTION_RECORD":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FRESH_CONTEXT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IF_YES_NEW_PRODUCT_VERSION_CREATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_FILE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"PRODUCTION_CONTEXT_REFERENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"22":{"APPLICABLE_MANDATORY_DETERMINISTIC_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DETERMINISTIC_TEST_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MISSING_TEST_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_HASHES_BEFORE_TEST":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_REJECTED_BY_MANDATORY_FAILURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SATISFIED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEST_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDETERMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"VALIDATOR_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VIOLATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"23":{"ACTIVE_MEANING_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVALUATOR_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVALUATOR_INDEPENDENT_FROM_GENERATOR":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MEANING_RECORDS_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MEANING_REQUIREMENT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MEANING_RUBRIC_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SATISFIED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDETERMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNSUPPORTED_BARE_CONCLUSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VIOLATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"24":{"ADVERSARIAL_CHECK_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"ADVERSARIAL_REVIEW_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ATTACKS_EXECUTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CRITICAL_DEFECTS_FOUND":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MAJOR_DEFECTS_FOUND":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_DEFECTS_FOUND":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSIONS_FOUND":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RETURN_TO_ROOT_CAUSE_REQUIRED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REVIEWER_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REVIEWER_INDEPENDENT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDETERMINED_ATTACKS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"25":{"APPROVED_BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DELIVERY_ARTIFACT_INVENTORY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FINAL_REPRESENTATION_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PACKAGE_INSPECTION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"PAGE_OR_VIEW_INSPECTION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REPRESENTATION_REVIEW_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_DELIVERY_ARTIFACTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_PACKAGED_FILES_OPENED_OR_TESTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_PACKAGED_FILES_REQUIRED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_PAGES_OR_VIEWS_INSPECTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_PAGES_OR_VIEWS_REQUIRED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TRANSFORMATION_CHAIN_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNRESOLVED_CRITICAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNRESOLVED_MAJOR_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNRESOLVED_REPRESENTATION_UNKNOWNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"26":{"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_REASON":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MISSING_EVIDENCE_LINKS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_CORRECTNESS_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_PRODUCT_DISCREPANCIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_REVIEW":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_CORRECTNESS_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_REVIEW":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RECONCILED_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RECONCILIATION_BLOCKER_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RECONCILIATION_DEFECT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REVIEW_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"27":{"AFFIRMATIVE_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKER_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKING_REQUIREMENT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_DECISION_RULE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_REASON":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DATE_AND_TIME":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILED_TEST_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENTS_DEMONSTRABLY_VIOLATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENTS_NOT_ESTABLISHED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENTS_WITH_AFFIRMATIVE_SUPPORTING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_VALIDATORS_FAILED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_VALIDATORS_SUCCEEDED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"MANDATORY_VALIDATORS_UNDETERMINED_OR_NOT_RUN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RECONCILED_REVIEW_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_GATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SELECTED_RELEASE_STATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_MANDATORY_VALIDATORS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNDETERMINED_OR_MISSING_TEST_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNRESOLVED_CRITICAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNRESOLVED_DEFECT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNRESOLVED_MAJOR_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"VIOLATED_REQUIREMENT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"28":{"ALL_RELEASE_HASHES_EQUAL_AUDITED_HASHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ANY_POST_REVIEW_MODIFICATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ARTIFACT_HASH_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"AUTHORIZATION_DATE_AND_TIME":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORIZATION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORIZED_BY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DELIVERY_AUTHORIZATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_AUTHORIZED_ARTIFACT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_AUTHORIZED_FILENAMES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HASH_ALGORITHM":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HASH_OPERATOR":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HASH_REVIEW_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HASH_TOOL_AND_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_GATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_GATE_STATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_ARTIFACTS_REHASHED_IMMEDIATELY_BEFORE_DELIVERY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_ARTIFACTS_REQUIRED_FOR_RELEASE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_ARTIFACTS_WITH_AUDITED_HASH":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_EXACT_HASH_MATCHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_HASH_MISMATCHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_UNKNOWN_HASH_COMPARISONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"29":{"ALL_MANDATORY_EVIDENCE_CHAINS_COMPLETE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE_CHAIN_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE_REPOSITORY_LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FINAL_EVIDENCE_CHAIN_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HASH_REVIEW_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INCOMPLETE_CHAIN_REQ_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"JOB_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_EVIDENCE_CHAIN_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"MANDATORY_REQUIREMENT_EVIDENCE_CHAIN_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_GATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REPRODUCTION_INSTRUCTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_MANDATORY_REQUIREMENTS_WITH_COMPLETE_CHAINS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_MANDATORY_REQUIREMENTS_WITH_INCOMPLETE_CHAINS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_MANDATORY_REQUIREMENTS_WITH_UNKNOWN_CHAIN_LINKS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNKNOWN_CHAIN_REQ_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"3":{"ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"CANDIDATE_REQUIREMENT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"CONFLICTING_OR_INVALIDATING_MATERIAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXCEPTIONS_AND_EDGE_CONDITIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"LATEST_PASS_NUMBER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESEARCH_GAPS_AND_BLOCKERS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESEARCH_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_RESEARCH_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"30":{"CONFIRMED_DEFECTS_MISSING_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"DEFECT_RECORDS_MISSING_REQUIRED_FIELDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_REGISTRY_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FINAL_REGISTRY_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FUTURE_BASELINE_REGRESSION_EXECUTION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"REGISTRY_HASH_OR_INTEGRITY_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGISTRY_IS_APPEND_ONLY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"REGISTRY_RETENTION_RULE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGISTRY_STORAGE_LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"REGRESSION_REGISTRY_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_ACTIVE_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_CONFIRMED_DEFECTS_WITH_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_DEFECT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_RETIRED_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"4":{"ATOMICITY_REVIEW_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKED_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONDITIONAL_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFINED_TERM_GAPS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OPTIONAL_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"5":{"APPLICABILITY_UNDETERMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CIRCULAR_DEPENDENCIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DUPLICATES_REMAINING":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IMPOSSIBLE_COMBINATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_REQUIREMENTS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_BLOCKERS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MISSING_PREREQUISITES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_REQUIREMENTS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_WITHOUT_VERIFICATION_PATH":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENT_DEFECT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDEFINED_TERMS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNRESOLVED_CONFLICTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNSUPPORTED_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"6":{"ACTIVE_MANDATORY_REQUIREMENTS_WITH_AT_LEAST_ONE_READY_TEST":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKED_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COVERAGE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_TEST_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEST_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TEST_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_ACTIVE_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"7":{"ACTIVE_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECTIVE_VALIDATORS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILURE_TEST_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"FAILURE_TEST_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"INVALID_FIXTURES_ACCEPTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MUTATION_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_WITH_AT_LEAST_ONE_FAILURE_TEST":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"8":{"AUTHORIZED_INPUTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COMPLETION_CRITERIA":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_RULES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFINED_TERMS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DRAFT_INSTRUCTION_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_FAILURE_RULES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_TRACE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"OBJECTIVE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_CONTRACT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_PROCEDURE_IN_ORDER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SCOPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_AUTHORITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOL_RULES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERIFICATION_AND_FAILURE_HANDLING":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"9":{"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVERY_SENTENCE_REVIEWED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_INSTRUCTION_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_MATERIAL_AMBIGUITIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_MATERIAL_CONFLICTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_INSTRUCTION_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PREFLIGHT_ITERATION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"PREFLIGHT_REVIEWER_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REVIEW_CONTEXT_INDEPENDENT_FROM_AUTHOR":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SENTENCE_REVIEW_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNAVAILABLE_REQUIRED_CAPABILITIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNVERIFIABLE_INSTRUCTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}}});
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
  '2':Object.freeze({SOURCE_APPLICABILITY_DETERMINATION:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['APPLICABLE_SOURCES_ESTABLISHED','NO_APPLICABLE_EXTERNAL_SOURCE','UNDETERMINED']),nullable:false,normalizerKey:null,closedProperties:null})}),
  '10':Object.freeze({ALL_FROZEN_COMPONENT_BYTES_HASHED:Object.freeze({valueType:'BOOLEAN',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),
  '25':Object.freeze({DELIVERY_CANDIDATE_SET_ID:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),
  '28':Object.freeze({DELIVERY_CANDIDATE_SET_ID:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),
  '30':Object.freeze({
    PRE_DELIVERY_CHECKPOINT_ID:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),
    DELIVERY_ID:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),
    DELIVERY_STATE:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['AUTHORIZED','BLOCKED']),nullable:false,normalizerKey:null,closedProperties:null}),
    DELIVERY_RECORD_HASH:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),
    DELIVERY_ATTEMPT_RECORDS:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})
  })
});
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
  CANDIDATE:Object.freeze({
    COMPONENT_SELECTION_DECISION_ID:Object.freeze({valueType:'REFERENCE',enumValues:[],nullable:false,normalizerKey:null,closedProperties:null})
  }),
  BASELINE:Object.freeze({
    HUMAN_AUTHORIZATION:Object.freeze({valueType:'REFERENCE',enumValues:[],nullable:false,normalizerKey:null,closedProperties:null})
  }),
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
  const producer=stageFieldProducer(stage,name),type=STAGE_FIELD_TYPE_OVERRIDES[String(stage)]?.[name]||EXPLICIT_STAGE_FIELD_TYPES[String(stage)]?.[name];if(!type)throw new Error(`Stage ${stage} field ${name} has no explicit type metadata.`);
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
    'CANDIDATE_ID','ITERATION_ID','COMPONENT_SELECTION_DECISION_ID','COMPONENT_MANIFEST','COMPONENT_VERSIONS','COMPONENT_HASHES','ROLE_DISTRIBUTION','IMMUTABLE_LOCATIONS',
    'TOOL_CONFIGURATION','SETTINGS','PERMISSIONS','LIMITATIONS','BATCH_CHANGE_RULE','STATUS','EVIDENCE'
  ],required:['COMPONENT_SELECTION_DECISION_ID','COMPONENT_MANIFEST','COMPONENT_VERSIONS','ROLE_DISTRIBUTION','IMMUTABLE_LOCATIONS','TOOL_CONFIGURATION','SETTINGS','PERMISSIONS','LIMITATIONS','BATCH_CHANGE_RULE','STATUS','EVIDENCE'],relationships:{ITERATION_ID:'iterations',COMPONENT_SELECTION_DECISION_ID:'humanDecisions'}}),
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
  ],required:['APPROVED_VERSIONS','IMMUTABLE_ARTIFACT_RECORDS','AUTHORIZED_RECIPIENT_ROLES','CONTROLLED_STORAGE','HUMAN_AUTHORIZATION','STATUS','EVIDENCE'],relationships:{SUPPORTING_CONFIRMATION_ID:'confirmationRecords',HUMAN_AUTHORIZATION:'humanDecisions'}}),
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
  1:['blockers'],2:['blockers'],3:['blockers'],4:['blockers'],5:['blockers'],6:['blockers'],7:['blockers'],8:['blockers'],
  9:['blockers','freshContexts'],10:['blockers'],11:['blockers','freshContexts'],12:['blockers','freshContexts'],13:['blockers'],14:['blockers'],
  15:['blockers'],16:['blockers'],17:['blockers','freshContexts'],18:['blockers'],19:['blockers','freshContexts'],20:['blockers'],21:['blockers','freshContexts'],
  22:['blockers'],23:['blockers','freshContexts'],24:['blockers','freshContexts'],25:['blockers','freshContexts'],26:['blockers'],27:['blockers'],28:['blockers'],29:['blockers'],30:['blockers']
});


const READ_COLLECTIONS=Object.freeze({1:[],2:[],3:['sources','sourceConflicts'],4:['research','candidateRequirements','sources','evidenceRecords','sourceConflicts'],5:['requirements','research','sources','sourceConflicts','evidenceRecords','candidateRequirements'],6:['requirements','requirementResolutions','artifacts','sources','research'],7:['requirements','tests','artifacts','evidenceRecords'],8:['requirements','tests','failureTests','requirementResolutions','sources','sourceConflicts'],9:['instructions','instructionTraces','requirements','tests','failureTests','requirementResolutions','sources','sourceConflicts'],10:['instructions','preflightRecords','tests','failureTests','artifacts'],11:['candidateFreezes','iterations','runs','freshContexts'],12:['runs','requirements','tests','freshContexts','sources','evidenceRecords'],13:['verification','runs','requirements','tests'],14:['defects','comparisons','verification','requirements','tests','instructions','instructionTraces','runs','candidateFreezes','failureTests','requirementResolutions','candidateRequirements','research','sources','sourceConflicts','artifacts','evidenceRecords'],15:['defects','rootCauses','comparisons','verification','runs','requirements','tests','failureTests','instructions','candidateFreezes','artifacts','evidenceRecords'],16:['defects','rootCauses','regressions','regressionExecutions','comparisons','verification','runs','requirements','requirementResolutions','candidateRequirements','research','sources','instructions','instructionTraces','tests','failureTests','candidateFreezes','artifacts','evidenceRecords','changes'],17:['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions'],18:['iterations','runs','verification','comparisons','defects','regressions','regressionExecutions','blockers','requirements','tests','rootCauses','changes'],19:['convergenceRecords','candidateFreezes','tests','regressions','regressionExecutions'],20:['confirmationRecords','candidateFreezes','iterations','artifacts'],21:['baselines','instructions','artifacts','freshContexts'],22:['products','tests','artifacts'],23:['products','requirements','tests','sources','evidenceRecords','research'],24:['products','requirements','tests','failureTests','regressions','regressionExecutions','defects','sources','evidenceRecords','research','artifacts'],25:['products','baselines','artifacts','requirements','tests','evidenceRecords'],26:['products','baselines','requirements','instructions','tests','runs','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','regressions','regressionExecutions','defects','blockers','evidenceRecords','confirmationRecords'],27:['requirements','tests','products','baselines','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','defects','blockers','regressionExecutions','evidenceRecords','confirmationRecords','regressions'],28:['releaseRecords','artifactIdentities','artifacts'],29:['sources','requirements','instructions','instructionTraces','runs','products','baselines','tests','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','regressions','regressionExecutions','releaseRecords','artifactIdentities','evidenceRecords','evidenceChains'],30:['defects','rootCauses','regressions','regressionExecutions','changes','baselines','evidenceRecords','requirements']});
const APPLICATION_COLLECTIONS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>[i+1,Object.freeze(['blockers','freshContexts','artifacts','releaseRecords','artifactIdentities','evidenceChains'])])));
const HUMAN_ACTIONS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>[i+1,Object.freeze(['ANSWER_HUMAN_INPUT','REJECT_RESPONSE','REQUEST_CORRECTION'])])));
const SCOPE_REQUIREMENTS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>{const s=i+1,keys=['projectRevision','inputVersion'];if(s>=3)keys.push('sourceSetVersion');if(s>=5)keys.push('requirementsVersion');if(s>=7)keys.push('testSuiteVersion');if(s>=9)keys.push('instructionVersion');if(s>=10&&s<=20)keys.push('iterationId','candidateId');if(s===9)keys.push('contextId');if(s===11)keys.push('runId','contextId');if(s>=20)keys.push('baselineId');if(s>=21)keys.push('productId');return [s,Object.freeze([...new Set(keys)])];})));
const OPERATION_CONTRACT_OVERRIDES=Object.freeze({1:Object.freeze({SEMANTIC_CHALLENGE:Object.freeze({readCollections:[],agentWritableCollections:['semanticChallenges'],allowedStageData:[]}),RECONCILE_INTAKE:Object.freeze({readCollections:['semanticChallenges'],agentWritableCollections:['semanticReviews']})}),2:Object.freeze({COMPLETE:Object.freeze({readCollections:[],agentWritableCollections:['sources','sourceConflicts','sourceSearchContracts']}),SEARCH_ADEQUACY_REVIEW:Object.freeze({readCollections:['sources','sourceConflicts','sourceSearchContracts'],agentWritableCollections:['semanticReviews'],allowedStageData:[]}),RECONCILE_SOURCE_SEARCH:Object.freeze({readCollections:['sources','sourceConflicts','sourceSearchContracts','semanticReviews'],agentWritableCollections:['sources','sourceConflicts','sourceSearchContracts','semanticReviews']})}),3:Object.freeze({SEMANTIC_CHALLENGE:Object.freeze({readCollections:['sources','sourceConflicts'],agentWritableCollections:['semanticChallenges'],allowedStageData:[]}),RECONCILE_RESEARCH:Object.freeze({readCollections:['sources','sourceConflicts','research','candidateRequirements','semanticChallenges'],agentWritableCollections:['research','candidateRequirements','semanticReviews'],allowedStageData:[]})}),4:Object.freeze({DISPOSITION_CHALLENGE:Object.freeze({readCollections:['research','candidateRequirements','sources','evidenceRecords','sourceConflicts'],agentWritableCollections:['semanticChallenges'],allowedStageData:[]}),ATOMICITY_CHALLENGE:Object.freeze({readCollections:['research','candidateRequirements','sources','evidenceRecords','sourceConflicts'],agentWritableCollections:['semanticChallenges'],allowedStageData:[]}),RECONCILE_REQUIREMENTS:Object.freeze({readCollections:['research','candidateRequirements','sources','evidenceRecords','sourceConflicts','requirements','propositions','semanticChallenges'],agentWritableCollections:['requirements','propositions','semanticReviews']})}),5:Object.freeze({SEMANTIC_REVIEW:Object.freeze({readCollections:['requirements','requirementResolutions','propositionEquivalenceReviews','applicabilityRecords','propositions','research','sources','sourceConflicts','evidenceRecords','candidateRequirements'],agentWritableCollections:['semanticReviews'],allowedStageData:[]}),RECONCILE_REQUIREMENT_SET:Object.freeze({readCollections:['requirements','requirementResolutions','propositionEquivalenceReviews','applicabilityRecords','propositions','research','sources','sourceConflicts','evidenceRecords','candidateRequirements','semanticReviews'],agentWritableCollections:['requirementResolutions','propositionEquivalenceReviews','applicabilityRecords','semanticReviews']})}),6:Object.freeze({COMPLETE:Object.freeze({readCollections:['requirements','requirementResolutions','artifacts','sources','research','propositions','applicabilityRecords'],agentWritableCollections:['tests','proofExpressions','environmentDependencies','expectedVarianceContracts']}),PROOF_REVIEW:Object.freeze({readCollections:['requirements','tests','proofExpressions','proofObligations','environmentDependencies','expectedVarianceContracts','propositions','applicabilityRecords','artifacts','sources','research'],agentWritableCollections:['semanticReviews'],allowedStageData:[]}),RECONCILE_VERIFICATION_SUITE:Object.freeze({readCollections:['requirements','tests','proofExpressions','proofObligations','environmentDependencies','expectedVarianceContracts','propositions','applicabilityRecords','artifacts','sources','research','semanticReviews'],agentWritableCollections:['tests','proofExpressions','environmentDependencies','expectedVarianceContracts','semanticReviews']})}),17:Object.freeze({FREEZE:Object.freeze({readCollections:['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions','instructions','requirements','artifacts'],agentWritableCollections:[],allowedStageData:[]}),EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts'],agentWritableCollections:['runs'],allowedStageData:[]}),VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts','sources','evidenceRecords'],agentWritableCollections:['verification'],allowedStageData:[]}),COMPARE:Object.freeze({readCollections:['verification','runs','requirements','tests'],agentWritableCollections:['comparisons'],allowedStageData:[]}),ROOT_CAUSE:Object.freeze({readCollections:['defects','comparisons','verification','requirements','tests','instructions','instructionTraces','runs','candidateFreezes','failureTests','requirementResolutions','candidateRequirements','research','sources','sourceConflicts','artifacts','evidenceRecords'],agentWritableCollections:['defects','rootCauses'],allowedStageData:[]}),REGRESSION:Object.freeze({readCollections:['defects','rootCauses','comparisons','verification','runs','requirements','tests','failureTests','instructions','candidateFreezes','artifacts','evidenceRecords','regressions','regressionExecutions'],agentWritableCollections:['regressions','regressionExecutions'],allowedStageData:[]}),CORRECT:Object.freeze({readCollections:['defects','rootCauses','regressions','regressionExecutions','comparisons','verification','runs','requirements','requirementResolutions','candidateRequirements','research','sources','instructions','instructionTraces','tests','failureTests','candidateFreezes','artifacts','evidenceRecords','changes'],agentWritableCollections:['changes'],allowedStageData:[]})}),19:Object.freeze({CONFIRM_FREEZE:Object.freeze({readCollections:['convergenceRecords','candidateFreezes','iterations','requirements','tests','artifacts'],agentWritableCollections:[],allowedStageData:[]}),EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts'],agentWritableCollections:['runs'],allowedStageData:[]}),VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts','sources','evidenceRecords'],agentWritableCollections:['verification'],allowedStageData:[]}),COMPARE:Object.freeze({readCollections:['verification','runs','requirements','tests'],agentWritableCollections:['comparisons'],allowedStageData:[]}),REGRESSION_VERIFY:Object.freeze({readCollections:['regressions','regressionExecutions','runs','tests','requirements','artifacts'],agentWritableCollections:['regressionExecutions'],allowedStageData:[]}),CONFIRM:Object.freeze({readCollections:['runs','verification','comparisons','tests','regressions','regressionExecutions','candidateFreezes','defects','blockers','evidenceRecords','requirements'],agentWritableCollections:['confirmationRecords'],allowedStageData:[]})})});
function operationContract(stage,operation){const operations=STAGE_OPERATIONS[stage]||['COMPLETE'];if(!operations.includes(operation))return null;const override=OPERATION_CONTRACT_OVERRIDES[stage]?.[operation]||{};let scopeRequirements=override.scopeRequirements||SCOPE_REQUIREMENTS[stage]||[];if((stage===17||stage===19)&&!['EXECUTE_RUN','VERIFY'].includes(operation))scopeRequirements=scopeRequirements.filter(key=>key!=='runId'&&key!=='contextId');const independentReview=stage===9||stage===12||stage===23||stage===24||((stage===17||stage===19)&&operation==='VERIFY');if(independentReview&&!scopeRequirements.includes('contextId'))scopeRequirements=[...scopeRequirements,'contextId'];return Object.freeze({operation,readCollections:Object.freeze(override.readCollections||READ_COLLECTIONS[stage]||[]),agentWritableCollections:Object.freeze(override.agentWritableCollections||STAGE_COLLECTIONS[stage]||[]),allowedStageData:Object.freeze(override.allowedStageData||STAGE_CONTRACTS[stage]?.allowedStageData||[]),applicationCollections:Object.freeze(APPLICATION_COLLECTIONS[stage]||[]),humanActions:Object.freeze(HUMAN_ACTIONS[stage]||[]),scopeRequirements:Object.freeze(scopeRequirements)});}

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
  PROJECT_SCHEMA,WORKFLOW_ID,CONTRACT_PROFILE_ID,STAGE_COUNT,VALUE_TYPES,COLLECTION_POLICIES,DEFAULT_RESOURCE_LIMITS,STAGE_OPERATIONS,READ_COLLECTIONS,APPLICATION_COLLECTIONS,HUMAN_ACTIONS,SCOPE_REQUIREMENTS,RECORD_OWNERSHIP,
  PRODUCER,RESPONSE_SCHEMA,RESPONSE_TYPES,CONFLICT_POLICIES,TEST_IR,validateTestIRSpec,validateTestIRBindings,validateTestIRTest,
  JOB_FIELDS,HUMAN_JOB_FIELDS,APPLICATION_JOB_FIELDS,AGENT_JOB_FIELDS,HUMAN_INTAKE_FIELDS,
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
const STAGE01_HUMAN_CAPTURE_FIELDS=Object.freeze(['JOB_TITLE','JOB_OWNER','EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY','REQUIRED_OUTPUT_FORMAT','DEADLINE_OR_TEMPORAL_SCOPE','DESIRED_SOURCE_COUNT','KNOWN_AUTHORITATIVE_SOURCES','AVAILABLE_TOOLS','PROHIBITED_ACTIONS','EXPLICIT_USER_REQUIREMENTS']);
function restoreMigratedStage01AcceptedCapture(migrated,original){return migrated;}
function normalizeTestRecords(value,seen=new WeakSet()){
  if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
  const fields=value.fields&&typeof value.fields==='object'&&!Array.isArray(value.fields)?value.fields:value;
  if(Object.prototype.hasOwnProperty.call(fields,'TEST_ID')||Object.prototype.hasOwnProperty.call(fields,'EXECUTABLE_KIND')||Object.prototype.hasOwnProperty.call(fields,'EXECUTABLE_SPEC')){
    if(fields.EXECUTABLE_KIND==='CUSTOM_PIPELINE')fields.EXECUTABLE_KIND='TEST_IR';
    if(!fields.EXECUTABLE_KIND)fields.EXECUTABLE_KIND='NONE';
    fields.EXECUTABLE_SPEC_VERSION=TEST_IR_SCHEMA;
    if(!Object.prototype.hasOwnProperty.call(fields,'EXECUTABLE_SPEC'))fields.EXECUTABLE_SPEC=null;
    if(!fields.EXECUTABLE_INPUT_BINDINGS||typeof fields.EXECUTABLE_INPUT_BINDINGS!=='object'||Array.isArray(fields.EXECUTABLE_INPUT_BINDINGS))fields.EXECUTABLE_INPUT_BINDINGS={};
    if(!Object.prototype.hasOwnProperty.call(fields,'EXECUTABLE_SPEC_SHA256'))fields.EXECUTABLE_SPEC_SHA256='';
  }
  if(Array.isArray(value)){for(const item of value)normalizeTestRecords(item,seen);}else for(const [key,item] of Object.entries(value)){if(key==='payload'&&value.operational===false)continue;normalizeTestRecords(item,seen);}
}
function markLegacyNonGating(project,original){
  project=ensureV3Defaults(project);project.job=project.job&&typeof project.job==='object'?project.job:{};
  project.projectData.nonOperationalImportedPayloads=Array.isArray(project.projectData.nonOperationalImportedPayloads)?project.projectData.nonOperationalImportedPayloads:[];
  const alreadyLegacy=original?.projectData?.contractProfileMigration?.status==='LEGACY_NON_GATING';
  const sourceSchema=alreadyLegacy?String(original.projectData.contractProfileMigration.sourceSchema||original?.schema||project.schema||''):String(original?.schema||project.schema||'');const sourceRevision=Number(original?.revision||0);
  if(!alreadyLegacy&&!project.projectData.nonOperationalImportedPayloads.some(item=>item&&item.sourceSchema===sourceSchema&&item.sourceRevision===sourceRevision&&item.operational===false))project.projectData.nonOperationalImportedPayloads.push({sourceSchema,sourceRevision,operational:false,purpose:'ORIGINAL_IMPORTED_PAYLOAD_AUDIT_EVIDENCE',payload:clone(original)});
  project.projectData.contractProfileMigration={status:'LEGACY_NON_GATING',sourceSchema,targetProfile:base.CONTRACT_PROFILE_ID,semanticProofMigrated:false};
  delete project.job.CONTRACT_PROFILE_ID;project.job.CURRENT_STATE='BLOCKED';project.job.JOB_RECORD_STATUS='INCOMPLETE';project.job.CURRENT_STAGE='STAGE 01';project.job.CURRENT_BLOCKERS=[...new Set([...(Array.isArray(project.job.CURRENT_BLOCKERS)?project.job.CURRENT_BLOCKERS:[]),'CONTRACT_PROFILE_MIGRATION_REQUIRED'])];
  const stage01=project?.stages?.['1']||project?.stages?.[1];if(stage01){stage01.status='NOT STARTED';stage01.decision='';stage01.decisionEvidence='';stage01.agentData={};stage01.acceptedData={};stage01.gate={satisfied:false,reasons:['Legacy/pre-profile data cannot satisfy current-profile Stage 01.']};}
  project.activeStage=1;project.projectHash='';return project;
}
function validateContractProfile(project){const reasons=[];if(project?.schema!==CURRENT_PROJECT_SCHEMA)reasons.push('Wrong project schema.');if(project?.job?.CONTRACT_PROFILE_ID!==base.CONTRACT_PROFILE_ID)reasons.push('Missing or wrong contract profile.');if(project?.projectData?.contractProfileMigration?.status==='LEGACY_NON_GATING')reasons.push('Project is legacy/non-gating.');return {valid:reasons.length===0,reasons};}
function ensureV3Defaults(project){
  project.schema=CURRENT_PROJECT_SCHEMA;
  project.workflow=project.workflow||project.workflowId||'mobile-closed-loop/30';
  project.projectData=project.projectData&&typeof project.projectData==='object'?project.projectData:{};
  for(const key of ['intakeCoverageManifests','obligationManifests','promptContextManifests','blindAliasMaps','nativeExecutionEvents'])if(!Array.isArray(project.projectData[key]))project.projectData[key]=[];
  if(!Array.isArray(project.projectData.nonOperationalImportedPayloads))project.projectData.nonOperationalImportedPayloads=[];
  project.projectData.schemaIdentities={...(project.projectData.schemaIdentities||{}),project:CURRENT_PROJECT_SCHEMA,response:CURRENT_RESPONSE_SCHEMA,testIr:TEST_IR_SCHEMA,verificationPackage:PACKAGE_SCHEMA};
  normalizeTestRecords(project);
  return project;
}
const priorMigrationName=['migrateProjectToCurrent','migrateProject','migrateLegacyProject','migrate'].find(name=>typeof base[name]==='function');
const priorMigration=priorMigrationName?base[priorMigrationName].bind(base):null;
function migrateProjectToCurrent(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Imported project must be an object.');
  const original=clone(input);
  if(input.schema===CURRENT_PROJECT_SCHEMA){const current=ensureV3Defaults(clone(input));return current?.job?.CONTRACT_PROFILE_ID===base.CONTRACT_PROFILE_ID?current:markLegacyNonGating(current,original);}
  let migrated;
  if(input.schema===PREVIOUS_PROJECT_SCHEMA)migrated=clone(input);
  else if(priorMigration){migrated=priorMigration(clone(input));if(migrated&&typeof migrated.then==='function')throw new Error('Project migration must be deterministic and synchronous.');}
  else throw new Error('Unsupported project schema '+String(input.schema));
  migrated=ensureV3Defaults(migrated);
  restoreMigratedStage01AcceptedCapture(migrated,original);
  return markLegacyNonGating(migrated,original);
}
const replacement={...base,PROJECT_SCHEMA:CURRENT_PROJECT_SCHEMA,PROJECT_SCHEMA_ID:CURRENT_PROJECT_SCHEMA,RESPONSE_SCHEMA:CURRENT_RESPONSE_SCHEMA,RESPONSE_SCHEMA_ID:CURRENT_RESPONSE_SCHEMA,PREVIOUS_PROJECT_SCHEMA,PREVIOUS_RESPONSE_SCHEMA,TEST_IR_SCHEMA,PACKAGE_SCHEMA,migrateProjectToCurrent,validateContractProfile};
if(priorMigrationName)replacement[priorMigrationName]=migrateProjectToCurrent;
globalThis.closedLoopWorkflowSchema=Object.freeze(replacement);
})();

/* INTEGRATED CONTROLLING COMPLETION 53-70 */
;(()=>{
'use strict';
const core=globalThis.closedLoopCore,s0=globalThis.closedLoopWorkflowSchema,h=globalThis.closedLoopHash;
if(!core||!s0||!h)throw new Error('Base schema/hash must load before integrated completion schema.');
const VERSION='closed-loop-controlling-completion/53-70/1',P=s0.PRODUCER,C=s0.COLLECTION_POLICIES;
const E=Object.freeze({truth:['TRUE','FALSE','UNKNOWN'],basis:['APPLICATION_OBSERVED','VERIFIED_EXTERNAL','EXTERNALLY_SUPPORTED','SELF_ASSERTED','NONE'],fresh:['CURRENT','EXPIRED','UNKNOWN','NOT_APPLICABLE'],scope:['CURRENT','STALE'],contradiction:['CLEAR','CONTRADICTED'],applicability:['APPLICABLE','NOT_APPLICABLE','UNKNOWN'],normative:['MANDATORY','CONDITIONAL','OPTIONAL','UNKNOWN'],coverage:['EQUIVALENT','PARTIAL','UNKNOWN','NOT_EQUIVALENT'],role:['REQUIRED_PROOF','SUPPORTING_PROOF','ADVISORY','NEGATIVE_ONLY','REGRESSION'],entailment:['ESTABLISHES','REFUTES','SUPPORTS_ONLY','CONTEXT_ONLY','DOES_NOT_ADDRESS','UNKNOWN'],origin:['NATIVE_APPLICATION_OBSERVATION','VERIFIED_EXTERNAL_OBSERVATION','EXTERNAL_CLAIM','HUMAN_OBSERVATION','AGENT_SEMANTIC_OBSERVATION'],delivery:['AUTHORIZED','BLOCKED','WITHDRAWN_FOR_FUTURE_USE','SUPERSEDED'],reservation:['RESERVED','EXPORTED','ORPHANED','RESUMED','RESPONSE_STAGED','ACCEPTED','REJECTED','CANCELLED','SUPERSEDED','EXPIRED_BY_SCOPE'],disclosure:['PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED','CREDENTIAL_SECRET','UNKNOWN']});
function field(name,producer,opt={}){return s0.field(name,producer,{valueType:opt.valueType||'STRING',enumValues:opt.enumValues||[],nullable:Boolean(opt.nullable),requiredAtStage:opt.stage==null?null:opt.stage,responsePath:producer===P.AGENT?`/records/{collection}/*/fields/${name}`:null,derivationKey:producer===P.APPLICATION?`completion.${name}`:null,provenanceRequired:producer===P.AGENT});}
function rec({title,idField,prefix,stage=null,agent=[],human=[],humanDecision=[],application=[],types={},required=[],relationships={},commitPolicy=C.APPEND_SCOPED}){const fields=[...human,...humanDecision,...agent,...application],ownership={human:Object.freeze([...human]),humanDecision:Object.freeze([...humanDecision]),agent:Object.freeze([...agent]),application:Object.freeze([...application])},defs={};for(const n of fields){const producer=human.includes(n)?P.HUMAN:humanDecision.includes(n)?P.HUMAN_DECISION:agent.includes(n)?P.AGENT:P.APPLICATION;defs[n]=field(n,producer,{...(types[n]||{}),...(relationships[n]?{valueType:'REFERENCE'}:{}),stage});}return Object.freeze({title,idField,prefix,stage,fields:Object.freeze(fields),required:Object.freeze(required),relationships:Object.freeze(relationships),fieldDefinitions:Object.freeze(defs),ownership:Object.freeze(ownership),appendOnly:commitPolicy!==C.UPDATE_RESERVED,commitPolicy});}
function extend(base,extras){const fields=[...base.fields],defs={...base.fieldDefinitions},own={human:[...base.ownership.human],humanDecision:[...base.ownership.humanDecision],agent:[...base.ownership.agent],application:[...base.ownership.application]};for(const [n,o] of Object.entries(extras)){if(fields.includes(n))continue;fields.push(n);own[o.owner].push(n);const producer={human:P.HUMAN,humanDecision:P.HUMAN_DECISION,agent:P.AGENT,application:P.APPLICATION}[o.owner];defs[n]=field(n,producer,o);}return Object.freeze({...base,fields:Object.freeze(fields),fieldDefinitions:Object.freeze(defs),ownership:Object.freeze(Object.fromEntries(Object.entries(own).map(([k,v])=>[k,Object.freeze(v)])))});}
const truthTypes={TRUTH_VALUE:{enumValues:E.truth},EPISTEMIC_BASIS:{enumValues:E.basis},CURRENT_SCOPE_STATUS:{enumValues:E.scope},FRESHNESS_STATUS:{enumValues:E.fresh},CONTRADICTION_STATUS:{enumValues:E.contradiction},REASONS:{valueType:'STRING_ARRAY'},SUPPORTING_EVIDENCE_IDS:{valueType:'REFERENCE_ARRAY'}};
const add={
propositions:rec({title:'Canonical propositions',idField:'PROPOSITION_ID',prefix:'PROPOSITION',stage:4,agent:['PROPOSITION_TEXT','SUBJECT_AND_SCOPE_DESCRIPTION','SATISFACTION_MEANING','FAILURE_MEANING'],application:['PROPOSITION_ID','REQUIREMENT_ID','CURRENT_SCOPE','CONTENT_SHA256','STATUS','TRUTH_VALUE','EPISTEMIC_BASIS','CURRENT_SCOPE_STATUS','FRESHNESS_STATUS','CONTRADICTION_STATUS','REASONS','SUPPORTING_EVIDENCE_IDS','DERIVATION_OR_REVIEW_IDS'],types:{...truthTypes,DERIVATION_OR_REVIEW_IDS:{valueType:'REFERENCE_ARRAY'}},required:['PROPOSITION_TEXT','SUBJECT_AND_SCOPE_DESCRIPTION','SATISFACTION_MEANING','FAILURE_MEANING'],relationships:{REQUIREMENT_ID:'requirements'},commitPolicy:C.REPLACE_CURRENT_STAGE_SET}),
propositionEquivalenceReviews:rec({title:'Proposition equivalence reviews',idField:'PROP_EQ_REVIEW_ID',prefix:'PROP-EQ',stage:5,agent:['DISPOSITION','REASONING'],application:['PROP_EQ_REVIEW_ID','PROPOSITION_A_ID','PROPOSITION_B_ID','CURRENT_SCOPE','ACCEPTED_STATUS'],types:{DISPOSITION:{enumValues:E.coverage}},relationships:{PROPOSITION_A_ID:'propositions',PROPOSITION_B_ID:'propositions'}}),
applicabilityRecords:rec({title:'Applicability records',idField:'APPLICABILITY_ID',prefix:'APPLICABILITY',stage:5,agent:['PROPOSED_APPLICABILITY','REASONING'],application:['APPLICABILITY_ID','SUBJECT_ID','ACTIVATION_PROOF_OBLIGATION_ID','SELECTED_APPLICABILITY','TRUTH_VALUE','EPISTEMIC_BASIS','CURRENT_SCOPE_STATUS','FRESHNESS_STATUS','CONTRADICTION_STATUS','REASONS','SUPPORTING_EVIDENCE_IDS'],types:{PROPOSED_APPLICABILITY:{enumValues:E.applicability},SELECTED_APPLICABILITY:{enumValues:E.applicability},...truthTypes},relationships:{SUBJECT_ID:'propositions',ACTIVATION_PROOF_OBLIGATION_ID:'proofObligations'}}),
proofExpressions:rec({title:'Proof expressions',idField:'PROOF_EXPRESSION_ID',prefix:'PROOF-EXPR',stage:6,agent:['PROPOSED_EXPRESSION','SEMANTIC_RATIONALE'],application:['PROOF_EXPRESSION_ID','TARGET_PROPOSITION_ID','NORMALIZED_EXPRESSION','SEMANTIC_EQUIVALENCE_DISPOSITION','ACCEPTED_SEMANTIC_REVIEW_IDS','CURRENT_SCOPE_HASH','EVALUATION_STATUS'],types:{PROPOSED_EXPRESSION:{valueType:'OBJECT'},NORMALIZED_EXPRESSION:{valueType:'OBJECT'},SEMANTIC_EQUIVALENCE_DISPOSITION:{enumValues:E.coverage},ACCEPTED_SEMANTIC_REVIEW_IDS:{valueType:'REFERENCE_ARRAY'}},relationships:{TARGET_PROPOSITION_ID:'propositions'},commitPolicy:C.REPLACE_CURRENT_STAGE_SET}),
proofObligations:rec({title:'Proof obligations',idField:'PROOF_OBLIGATION_ID',prefix:'PROOF-OBLIGATION',stage:6,application:['PROOF_OBLIGATION_ID','PROPOSITION_ID','REQUIREMENT_ID','NORMATIVE_CLASS','APPLICABILITY','PROOF_EXPRESSION_ID','REQUIRED_TEST_IDS','REQUIRED_EVIDENCE_CLASSES','ALLOWED_EPISTEMIC_BASES','REQUIRED_ARTIFACT_IDS','REQUIRED_DEPENDENCY_IDS','FRESHNESS_REQUIREMENTS','INDEPENDENCE_REQUIREMENTS','SATISFACTION_STATE','BLOCKING_REASONS','CURRENT_SCOPE_HASH','PROOF_OBLIGATION_SET_HASH'],types:{NORMATIVE_CLASS:{enumValues:E.normative},APPLICABILITY:{enumValues:E.applicability},REQUIRED_TEST_IDS:{valueType:'REFERENCE_ARRAY'},REQUIRED_EVIDENCE_CLASSES:{valueType:'STRING_ARRAY'},ALLOWED_EPISTEMIC_BASES:{valueType:'STRING_ARRAY'},REQUIRED_ARTIFACT_IDS:{valueType:'REFERENCE_ARRAY'},REQUIRED_DEPENDENCY_IDS:{valueType:'REFERENCE_ARRAY'},FRESHNESS_REQUIREMENTS:{valueType:'OBJECT'},INDEPENDENCE_REQUIREMENTS:{valueType:'STRING_ARRAY'},BLOCKING_REASONS:{valueType:'STRING_ARRAY'}},relationships:{PROPOSITION_ID:'propositions',REQUIREMENT_ID:'requirements',PROOF_EXPRESSION_ID:'proofExpressions'},commitPolicy:C.APPLICATION_DERIVED}),
observationRecords:rec({title:'Observation records',idField:'OBSERVATION_ID',prefix:'OBSERVATION',human:['HUMAN_OBSERVED_VALUE'],agent:['EXTERNAL_OR_AGENT_OBSERVED_VALUE'],application:['OBSERVATION_ID','APPLICATION_OBSERVED_VALUE','OBSERVATION_ORIGIN','SUBMITTING_ACTOR_OR_RUNTIME','SUBJECT_ID','OBSERVED_LOCATION','METHOD_OR_TOOL_IDENTITY','INPUT_IDENTITIES_AND_HASHES','OUTPUT_IDENTITIES_AND_HASHES','EPISTEMIC_BASIS','FRESHNESS_STATUS','SOURCE_EVIDENCE_IDS','CURRENT_SCOPE','RAW_OR_NATIVE_PROVENANCE'],types:{OBSERVATION_ORIGIN:{enumValues:E.origin},EPISTEMIC_BASIS:{enumValues:E.basis},FRESHNESS_STATUS:{enumValues:E.fresh},INPUT_IDENTITIES_AND_HASHES:{valueType:'OBJECT_ARRAY'},OUTPUT_IDENTITIES_AND_HASHES:{valueType:'OBJECT_ARRAY'},SOURCE_EVIDENCE_IDS:{valueType:'REFERENCE_ARRAY'},CURRENT_SCOPE:{valueType:'OBJECT'}},relationships:{SUBJECT_ID:'tests'}}),
entailmentReviews:rec({title:'Entailment reviews',idField:'ENTAILMENT_ID',prefix:'ENTAILMENT',agent:['ENTAILMENT_FINDING','REASONING'],application:['ENTAILMENT_ID','OBSERVATION_ID','TARGET_PROPOSITION_ID','TARGET_LEAF_ID','ACCEPTED_RELATION','ACCEPTED_STATUS','CURRENT_SCOPE','GATE_CONSEQUENCE'],types:{ENTAILMENT_FINDING:{enumValues:E.entailment},ACCEPTED_RELATION:{enumValues:E.entailment},CURRENT_SCOPE:{valueType:'OBJECT'}},relationships:{OBSERVATION_ID:'observationRecords',TARGET_PROPOSITION_ID:'propositions'}}),
environmentDependencies:rec({title:'Environment dependencies',idField:'DEPENDENCY_ID',prefix:'DEPENDENCY',agent:['DEPENDENCY_DESCRIPTION','PROPOSED_REQUIRED_CONDITION','TARGET_PROPOSITION_IDS'],application:['DEPENDENCY_ID','CURRENT_SCOPE','VERSION_OR_CONDITION','TRUTH_VALUE','EPISTEMIC_BASIS','FRESHNESS_STATUS','AUTHENTICITY_STATUS','RELEASE_CONSEQUENCE'],types:{TARGET_PROPOSITION_IDS:{valueType:'REFERENCE_ARRAY'},TRUTH_VALUE:{enumValues:E.truth},EPISTEMIC_BASIS:{enumValues:E.basis},FRESHNESS_STATUS:{enumValues:E.fresh}}}),
operationReservations:rec({title:'Operation reservations',idField:'OPERATION_RESERVATION_ID',prefix:'RESERVATION',application:['OPERATION_RESERVATION_ID','JOB_ID','STAGE','OPERATION','TARGET_SLOT','PACKAGE_ID','PROMPT_ID','SCOPE','EXPECTED_REVISION','RESERVATION_REVISION','CHALLENGE_NONCE','STATUS','OWNING_TAB_INSTANCE','IDEMPOTENCY_KEY','PAYLOAD_HASH'],types:{STAGE:{valueType:'INTEGER'},SCOPE:{valueType:'OBJECT'},EXPECTED_REVISION:{valueType:'INTEGER'},RESERVATION_REVISION:{valueType:'INTEGER'},STATUS:{enumValues:E.reservation}},commitPolicy:C.UPDATE_RESERVED}),
deliveryRecords:rec({title:'Delivery records',idField:'DELIVERY_ID',prefix:'DELIVERY',stage:30,application:['DELIVERY_ID','JOB_ID','PRODUCT_ID','PRODUCT_VERSION','BASELINE_ID','RELEASE_ID','HASH_REVIEW_ID','EVIDENCE_CHAIN_VERSION','EVIDENCE_CHAIN_SET_SHA256','DEFECT_REGISTRY_VERSION','REGRESSION_REGISTRY_VERSION','REGISTRY_INTEGRITY_HASH','HUMAN_DELIVERY_AUTHORIZATION_ID','HUMAN_IDENTITY_ASSURANCE','PRE_DELIVERY_CHECKPOINT_ID','AUTHORIZED_ARTIFACT_IDS','AUTHORIZED_FILENAMES','BYTE_SIZES','HASH_ALGORITHMS_AND_DIGESTS','EXPECTED_PRECONDITION_REVISION','COMMITTED_PROJECT_REVISION','TERMINAL_PROOF_OBLIGATION_SET_HASH','TERMINAL_EVIDENCE_HASH','DELIVERY_STATE','CONTROLLING_REASON','APPLICATION_RECEIPT','EVENT_SEQUENCE','DELIVERY_RECORD_HASH'],types:{AUTHORIZED_ARTIFACT_IDS:{valueType:'REFERENCE_ARRAY'},AUTHORIZED_FILENAMES:{valueType:'STRING_ARRAY'},BYTE_SIZES:{valueType:'STRING_ARRAY'},HASH_ALGORITHMS_AND_DIGESTS:{valueType:'OBJECT_ARRAY'},EXPECTED_PRECONDITION_REVISION:{valueType:'INTEGER'},COMMITTED_PROJECT_REVISION:{valueType:'INTEGER'},DELIVERY_STATE:{enumValues:E.delivery},EVENT_SEQUENCE:{valueType:'INTEGER'}},relationships:{PRODUCT_ID:'products',BASELINE_ID:'baselines',RELEASE_ID:'releaseRecords',PRE_DELIVERY_CHECKPOINT_ID:'backupCheckpoints'},commitPolicy:C.APPLICATION_DERIVED}),
deploymentManifests:rec({title:'Deployment manifests',idField:'DEPLOYMENT_MANIFEST_ID',prefix:'DEPLOYMENT',application:['DEPLOYMENT_MANIFEST_ID','SOURCE_COMMIT','WORKFLOW_RUN_ID','BUILD_IDENTITY','CANONICALIZATION_VERSION','RUNTIME_RESOURCES','CSP_IDENTITY','DEPENDENCY_TOOLCHAIN_IDENTITY','BUILD_COMMAND','BUILD_ENVIRONMENT_IDENTITY','MANIFEST_DIGEST','VERIFIED_DIGEST_COMPARISON','DEPLOYED_RESOURCE_STATUS'],types:{RUNTIME_RESOURCES:{valueType:'OBJECT_ARRAY'}},commitPolicy:C.APPEND_ONLY})};
const RS={...s0.RECORD_SCHEMAS,...add};RS.tests=extend(RS.tests,{TEST_PROPOSITION_TEXT:{owner:'agent'},TARGET_PROPOSITION_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},TESTED_SCOPE:{owner:'agent'},POSITIVE_RESULT_MEANING:{owner:'agent'},NEGATIVE_RESULT_MEANING:{owner:'agent'},SEMANTIC_COVERAGE_DISPOSITION:{owner:'agent',enumValues:E.coverage},SEMANTIC_REVIEW_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},TEST_ROLE:{owner:'agent',enumValues:E.role},RELEASE_BEARING:{owner:'application',valueType:'BOOLEAN'},EXPECTED_VARIANCE_CONTRACT:{owner:'agent',valueType:'OBJECT'}});
RS.sources=extend(RS.sources,{BYTE_IDENTITY_STATUS:{owner:'application'},CLAIMED_PUBLISHER_IDENTITY:{owner:'agent'},RETRIEVAL_LOCATION:{owner:'agent'},RETRIEVAL_METHOD:{owner:'agent'},AUTHENTICITY_BASIS:{owner:'application',enumValues:E.basis},AUTHENTICITY_STATUS:{owner:'application',enumValues:['VERIFIED','EXTERNALLY_SUPPORTED','SELF_ASSERTED','UNKNOWN','CONTRADICTED']},AUTHORITY_CLASSIFICATION:{owner:'agent'},FRESHNESS_STATUS:{owner:'application',enumValues:E.fresh}});
RS.artifacts=extend(RS.artifacts,{RAW_FILENAME:{owner:'application'},DISPLAY_FILENAME:{owner:'application'},CANONICAL_PATH:{owner:'application'},FILENAME_NORMALIZATION_VERSION:{owner:'application'},COLLISION_KEYS:{owner:'application',valueType:'OBJECT'},AUTHORIZED_DELIVERY_FILENAME:{owner:'application'},DISCLOSURE_CLASSIFICATION:{owner:'application',enumValues:E.disclosure},DECLARED_MEDIA_TYPE:{owner:'application'},DETECTED_FORMAT:{owner:'application'},PARSER_ADAPTER_IDENTITY:{owner:'application'},PARSE_CONTRACT:{owner:'application'},POLYGLOT_STATUS:{owner:'application'}});
const RO={...s0.RECORD_OWNERSHIP};for(const[k,v]of Object.entries(add))RO[k]=v.ownership;RO.tests=RS.tests.ownership;RO.sources=RS.sources.ownership;RO.artifacts=RS.artifacts.ownership;
const addStage=(m,n,a)=>Object.freeze({...m,[n]:Object.freeze([...new Set([...(m[n]||[]),...a])])});let SC=s0.STAGE_COLLECTIONS;SC=addStage(SC,4,['propositions']);SC=addStage(SC,5,['propositionEquivalenceReviews','applicabilityRecords']);SC=addStage(SC,6,['proofExpressions','environmentDependencies']);for(const n of[12,22,23,24,25,29])SC=addStage(SC,n,['observationRecords','entailmentReviews']);let RC=s0.READ_COLLECTIONS;for(let n=5;n<=30;n++)RC=addStage(RC,n,['propositions','propositionEquivalenceReviews','applicabilityRecords','proofExpressions','proofObligations','observationRecords','entailmentReviews','environmentDependencies']);let AC=s0.APPLICATION_COLLECTIONS;for(let n=1;n<=30;n++)AC=addStage(AC,n,['operationReservations','proofObligations']);AC=addStage(AC,30,['deliveryRecords','deploymentManifests']);const CONTRACTS=Object.freeze(Object.fromEntries(Array.from({length:30},(_,i)=>{const n=i+1,b=s0.STAGE_CONTRACTS[n];return[n,Object.freeze({...b,readCollections:RC[n]||[],agentWritableCollections:SC[n]||[],allowedCollections:SC[n]||[],primaryCollections:SC[n]||[],applicationCollections:AC[n]||[]})];})));
SC=addStage(SC,17,['observationRecords','entailmentReviews']);SC=addStage(SC,19,['observationRecords','entailmentReviews']);
const addedAgentCollections=Object.freeze({4:['propositions'],5:['propositionEquivalenceReviews','applicabilityRecords'],6:['proofExpressions','environmentDependencies'],12:['observationRecords','entailmentReviews'],17:['observationRecords','entailmentReviews'],19:['observationRecords','entailmentReviews'],22:['observationRecords','entailmentReviews'],23:['observationRecords','entailmentReviews'],24:['observationRecords','entailmentReviews'],25:['observationRecords','entailmentReviews'],29:['observationRecords','entailmentReviews']});
const completionReadCollections=Object.freeze(['propositions','propositionEquivalenceReviews','applicabilityRecords','proofExpressions','proofObligations','observationRecords','entailmentReviews','environmentDependencies','semanticReviews']);
const NARROW_SEMANTIC_OPERATION_KEYS=new Set(['1:SEMANTIC_CHALLENGE','1:RECONCILE_INTAKE','2:COMPLETE','2:SEARCH_ADEQUACY_REVIEW','2:RECONCILE_SOURCE_SEARCH','3:SEMANTIC_CHALLENGE','3:RECONCILE_RESEARCH','4:DISPOSITION_CHALLENGE','4:ATOMICITY_CHALLENGE','4:RECONCILE_REQUIREMENTS','5:SEMANTIC_REVIEW','5:RECONCILE_REQUIREMENT_SET','6:COMPLETE','6:PROOF_REVIEW','6:RECONCILE_VERIFICATION_SUITE']);
const REVIEW_ONLY_OPERATION_KEYS=new Set(['1:SEMANTIC_CHALLENGE','2:SEARCH_ADEQUACY_REVIEW','3:SEMANTIC_CHALLENGE','4:DISPOSITION_CHALLENGE','4:ATOMICITY_CHALLENGE','5:SEMANTIC_REVIEW','6:PROOF_REVIEW']);
function amendedOperationContract(stage,operation){const base=s0.operationContract(stage,operation);if(!base)return null;const key=`${stage}:${operation}`,narrow=NARROW_SEMANTIC_OPERATION_KEYS.has(key),addedAgent=narrow?[]:(addedAgentCollections[stage]||[]),addedRead=stage>=5&&!narrow?completionReadCollections:[],addedApplication=stage===30?['operationReservations','proofObligations','deliveryRecords','deploymentManifests']:['operationReservations','proofObligations'],allowedStageData=REVIEW_ONLY_OPERATION_KEYS.has(key)?[]:(CONTRACTS[stage]?.allowedStageData||base.allowedStageData||[]),external=EXTERNAL_OPERATION_KEYS.has(key),humanDecision=stage===28&&operation==='CAPTURE_DELIVERY_INTENT',operator=stage===30&&['EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','RECORD_DELIVERY_EVIDENCE'].includes(operation),acceptanceMode=external?((stage===1&&['COMPLETE','RECONCILE_INTAKE'].includes(operation))?'HUMAN_ACCEPTANCE_REQUIRED':'HUMAN_ACCEPTANCE_REQUIRED'):'DIRECT_COMMAND';return Object.freeze({...base,executorClass:external?'EXTERNAL_AGENT':humanDecision?'HUMAN_DECISION':operator?'OPERATOR_ACTION':'APPLICATION',acceptsExternalResponse:external,responseTypes:Object.freeze(external?[...s0.RESPONSE_TYPES]:[]),acceptanceMode,reservationRequired:external,completionPredicate:`STAGE_${String(stage).padStart(2,'0')}_${operation}_COMPLETION`,retryRule:external?'EXACT_RETRY_OR_REPLACEMENT_PROMPT':'IDEMPOTENT_COMMAND',minimumInputBindingBasis:external?'EXTERNALLY_SUPPORTED':'APPLICATION_OBSERVED',readCollections:Object.freeze([...new Set([...(base.readCollections||[]),...addedRead])]),agentWritableCollections:Object.freeze([...new Set([...(base.agentWritableCollections||[]),...addedAgent])]),applicationCollections:Object.freeze([...new Set([...(base.applicationCollections||[]),...addedApplication])]),allowedStageData:Object.freeze([...allowedStageData])});}

// Controlling contract closure: the runtime schema exposes the specification-named
// registries as the single closed authority. Legacy helper tables remain implementation
// inputs only; gates and ingestion consume the registries below.
const VERIFICATION_PHASE_VALUES=Object.freeze(['PREPRODUCT_ITERATION','FINAL_PRODUCT_DETERMINISTIC','FINAL_PRODUCT_MEANING','FINAL_PRODUCT_ADVERSARIAL','FINAL_REPRESENTATION','DELIVERY_IDENTITY','EVIDENCE_CLOSURE','REGISTRY_CLOSURE','TERMINAL_DELIVERY']);
const TIMING_FIELD_DEFS=Object.freeze({
  VERIFICATION_PHASE:{owner:'agent',enumValues:VERIFICATION_PHASE_VALUES},
  EARLIEST_EXECUTABLE_STAGE:{owner:'agent',valueType:'INTEGER'},
  REQUIRED_BY_STAGE:{owner:'agent',valueType:'INTEGER'},
  PER_RUN_REQUIRED:{owner:'agent',valueType:'BOOLEAN'},
  FINAL_PRODUCT_REQUIRED:{owner:'agent',valueType:'BOOLEAN'},
  DELIVERY_REQUIRED:{owner:'agent',valueType:'BOOLEAN'},
  TARGET_AVAILABILITY_CONDITION:{owner:'agent',valueType:'OBJECT'}
});
RS.tests=extend(RS.tests,TIMING_FIELD_DEFS);
RS.failureTests=extend(RS.failureTests,TIMING_FIELD_DEFS);
RS.regressions=extend(RS.regressions,TIMING_FIELD_DEFS);
RS.propositions=extend(RS.propositions,TIMING_FIELD_DEFS);

const addRequiredFamily=(name,config)=>{if(!RS[name]){RS[name]=rec(config);RO[name]=RS[name].ownership;}};
addRequiredFamily('humanDecisions',{title:'Human decisions',idField:'HUMAN_DECISION_ID',prefix:'HUMAN-DECISION',humanDecision:['PURPOSE','VALUE'],application:['HUMAN_DECISION_ID','JOB_ID','TARGET_ID','TARGET_FAMILY','SCOPE','IDENTITY_ASSURANCE','VALID_FROM','VALID_UNTIL','RECEIPT_ID','STATUS'],types:{SCOPE:{valueType:'OBJECT'}},commitPolicy:C.APPEND_SCOPED});
addRequiredFamily('sourceSearchContracts',{title:'Source search contracts',idField:'SOURCE_SEARCH_CONTRACT_ID',prefix:'SOURCE-SEARCH',stage:2,agent:['PROJECT_SCOPE','JURISDICTION_OR_SYSTEM_SCOPE','SOURCE_CLASSES_CONSIDERED','LOCATIONS_AND_REPOSITORIES','QUERIES_OR_STRATEGIES','DATE_OR_VERSION_CUTOFF','EXCLUSIONS','ACCESS_LIMITATIONS','ADEQUACY_RATIONALE','UNRESOLVED_DISCOVERY_RISK'],application:['SOURCE_SEARCH_CONTRACT_ID','EXECUTION_EVIDENCE_IDS','SEARCH_PERFORMER_CAPABILITY_ID','SCOPE','STATUS'],types:{SOURCE_CLASSES_CONSIDERED:{valueType:'STRING_ARRAY'},LOCATIONS_AND_REPOSITORIES:{valueType:'STRING_ARRAY'},QUERIES_OR_STRATEGIES:{valueType:'STRING_ARRAY'},EXCLUSIONS:{valueType:'STRING_ARRAY'},ACCESS_LIMITATIONS:{valueType:'STRING_ARRAY'},EXECUTION_EVIDENCE_IDS:{valueType:'REFERENCE_ARRAY'},SCOPE:{valueType:'OBJECT'}},commitPolicy:C.REPLACE_CURRENT_STAGE_SET});
addRequiredFamily('semanticChallenges',{title:'Semantic challenges',idField:'SEMANTIC_CHALLENGE_ID',prefix:'SEMANTIC-CHALLENGE',agent:['FINDINGS','DISPOSITION','REASONING'],application:['SEMANTIC_CHALLENGE_ID','TRIGGER','REVIEWED_TARGET_ID','AUTHOR_CONTEXT_ID','REVIEWER_CONTEXT_ID','AUTHOR_RESERVATION_ID','REVIEWER_RESERVATION_ID','INDEPENDENCE_DETERMINATION','RECONCILIATION_ID','SCOPE','STATUS'],types:{SCOPE:{valueType:'OBJECT'}},commitPolicy:C.APPEND_SCOPED});
addRequiredFamily('semanticReviews',{title:'Semantic reviews',idField:'SEMANTIC_REVIEW_ID',prefix:'SEMANTIC-REVIEW',agent:['REVIEW_QUESTION','FINDING','REASONING','RESULT'],application:['SEMANTIC_REVIEW_ID','REVIEWED_RECORD_IDS','REVIEWED_HASHES','AUTHOR_CONTEXT_ID','REVIEWER_CONTEXT_ID','RECONCILER_CONTEXT_ID','AUTHOR_RESERVATION_ID','REVIEWER_RESERVATION_ID','RECONCILER_RESERVATION_ID','INDEPENDENCE_DETERMINATION','ACCEPTED_DISPOSITION','RECONCILIATION_STATUS','SCOPE','GATE_EFFECT'],types:{REVIEWED_RECORD_IDS:{valueType:'REFERENCE_ARRAY'},REVIEWED_HASHES:{valueType:'STRING_ARRAY'},SCOPE:{valueType:'OBJECT'}},commitPolicy:C.APPEND_SCOPED});
addRequiredFamily('expectedVarianceContracts',{title:'Expected variance contracts',idField:'VARIANCE_CONTRACT_ID',prefix:'VARIANCE-CONTRACT',stage:6,agent:['DIMENSIONS','RATIONALE','ALLOWED_VARIANCE'],application:['VARIANCE_CONTRACT_ID','NORMALIZED_CONTRACT','FROZEN_AT','SCOPE','CONTRACT_SHA256','STATUS'],types:{DIMENSIONS:{valueType:'STRING_ARRAY'},NORMALIZED_CONTRACT:{valueType:'OBJECT'},SCOPE:{valueType:'OBJECT'}},commitPolicy:C.REPLACE_CURRENT_STAGE_SET});
addRequiredFamily('environmentManifests',{title:'Environment manifests',idField:'ENVIRONMENT_MANIFEST_ID',prefix:'ENVIRONMENT',application:['ENVIRONMENT_MANIFEST_ID','RUNTIME_FIELDS','EXTERNAL_CLAIMS','REQUIRED_FIELDS','UNAVAILABLE_FIELDS','EVIDENCE_BASES','SCOPE','STATUS'],types:{RUNTIME_FIELDS:{valueType:'OBJECT'},EXTERNAL_CLAIMS:{valueType:'OBJECT'},REQUIRED_FIELDS:{valueType:'STRING_ARRAY'},UNAVAILABLE_FIELDS:{valueType:'STRING_ARRAY'},EVIDENCE_BASES:{valueType:'OBJECT'},SCOPE:{valueType:'OBJECT'}},commitPolicy:C.APPEND_SCOPED});
addRequiredFamily('externalCapabilities',{title:'External capabilities',idField:'CAPABILITY_ID',prefix:'CAPABILITY',agent:['CAPABILITY_CLAIM','PURPOSE','TARGET'],application:['CAPABILITY_ID','VERIFICATION_BASIS','FRESHNESS_STATUS','ENVIRONMENT_MANIFEST_ID','AUTHORIZED','PERMISSIONS_READY','INPUTS_TRANSFERABLE','ROUTE_USABLE','EVIDENCE_OBTAINABLE','CAPABILITY_READY','SCOPE','STATUS'],types:{AUTHORIZED:{valueType:'BOOLEAN'},PERMISSIONS_READY:{valueType:'BOOLEAN'},INPUTS_TRANSFERABLE:{valueType:'BOOLEAN'},ROUTE_USABLE:{valueType:'BOOLEAN'},EVIDENCE_OBTAINABLE:{valueType:'BOOLEAN'},CAPABILITY_READY:{valueType:'BOOLEAN'},SCOPE:{valueType:'OBJECT'}},relationships:{ENVIRONMENT_MANIFEST_ID:'environmentManifests'},commitPolicy:C.APPEND_SCOPED});
addRequiredFamily('materialityReviews',{title:'Materiality reviews',idField:'MATERIALITY_REVIEW_ID',prefix:'MATERIALITY-REVIEW',agent:['REASONING','PROPOSED_MATERIALITY'],application:['MATERIALITY_REVIEW_ID','TARGET_ID','TARGET_FAMILY','ACCEPTED_MATERIALITY','REVIEW_ID','SCOPE','GATE_CONSEQUENCE','STATUS'],types:{PROPOSED_MATERIALITY:{enumValues:['MATERIAL','NONMATERIAL','UNKNOWN']},ACCEPTED_MATERIALITY:{enumValues:['MATERIAL','NONMATERIAL','UNKNOWN']},SCOPE:{valueType:'OBJECT'}},commitPolicy:C.APPEND_SCOPED});
addRequiredFamily('commandReceipts',{title:'Command receipts',idField:'COMMAND_RECEIPT_ID',prefix:'COMMAND-RECEIPT',application:['COMMAND_RECEIPT_ID','COMMAND_ID','IDEMPOTENCY_KEY','EXPECTED_REVISION','COMMITTED_REVISION','PAYLOAD_HASH','TARGET_ID','RESULT_IDENTITIES','RETRY_DISPOSITION','EVENT_SEQUENCE','STATUS'],types:{EXPECTED_REVISION:{valueType:'INTEGER'},COMMITTED_REVISION:{valueType:'INTEGER'},RESULT_IDENTITIES:{valueType:'REFERENCE_ARRAY'},EVENT_SEQUENCE:{valueType:'INTEGER'}},commitPolicy:C.APPEND_ONLY});
addRequiredFamily('backupPolicies',{title:'Backup policies',idField:'BACKUP_POLICY_ID',prefix:'BACKUP-POLICY',humanDecision:['POLICY_CHOICE'],application:['BACKUP_POLICY_ID','SCOPE','CURRENT_SELECTION','CHECKPOINT_TRIGGERS','ENFORCEMENT_STATUS'],types:{SCOPE:{valueType:'OBJECT'},CHECKPOINT_TRIGGERS:{valueType:'STRING_ARRAY'}},commitPolicy:C.APPEND_SCOPED});
addRequiredFamily('backupCheckpoints',{title:'Backup checkpoints',idField:'CHECKPOINT_ID',prefix:'CHECKPOINT',application:['CHECKPOINT_ID','PACKAGE_ID','PACKAGE_SHA256','PROJECT_REVISION','PROJECT_SHA256','ARTIFACT_MANIFEST_SHA256','CUSTODY_STATE','EXTERNAL_EVIDENCE_IDS','RESTORE_EVIDENCE_IDS','SCOPE','STATUS'],types:{PROJECT_REVISION:{valueType:'INTEGER'},EXTERNAL_EVIDENCE_IDS:{valueType:'REFERENCE_ARRAY'},RESTORE_EVIDENCE_IDS:{valueType:'REFERENCE_ARRAY'},SCOPE:{valueType:'OBJECT'},CUSTODY_STATE:{enumValues:['BACKUP_PACKAGE_GENERATED','BACKUP_EXPORT_ACTION_COMPLETED','EXTERNAL_COPY_CONFIRMED','RESTORE_TESTED_FROM_EXPORTED_COPY']}},commitPolicy:C.APPEND_ONLY});
addRequiredFamily('deliveryCandidateSets',{title:'Delivery candidate sets',idField:'DELIVERY_CANDIDATE_SET_ID',prefix:'DELIVERY-CANDIDATE',stage:25,application:['DELIVERY_CANDIDATE_SET_ID','PRODUCT_ID','PRODUCT_VERSION','BASELINE_ID','HUMAN_SELECTION_DECISION_ID','ARTIFACT_IDS','AUTHORIZED_FILENAMES','BYTE_LENGTHS','SHA256_VALUES','TRANSFORMATION_RECORD_IDS','PACKAGE_MEMBERSHIP','VIEWER_REQUIREMENTS','PRODUCT_LINEAGE','SCOPE','SET_SHA256','STATUS'],types:{ARTIFACT_IDS:{valueType:'REFERENCE_ARRAY'},AUTHORIZED_FILENAMES:{valueType:'STRING_ARRAY'},BYTE_LENGTHS:{valueType:'STRING_ARRAY'},SHA256_VALUES:{valueType:'STRING_ARRAY'},TRANSFORMATION_RECORD_IDS:{valueType:'REFERENCE_ARRAY'},PACKAGE_MEMBERSHIP:{valueType:'OBJECT_ARRAY'},VIEWER_REQUIREMENTS:{valueType:'STRING_ARRAY'},PRODUCT_LINEAGE:{valueType:'OBJECT'},SCOPE:{valueType:'OBJECT'}},relationships:{PRODUCT_ID:'products',BASELINE_ID:'baselines',HUMAN_SELECTION_DECISION_ID:'humanDecisions'},commitPolicy:C.APPLICATION_DERIVED});
addRequiredFamily('deliveryAttempts',{title:'Delivery attempts',idField:'DELIVERY_ATTEMPT_ID',prefix:'DELIVERY-ATTEMPT',stage:30,application:['DELIVERY_ATTEMPT_ID','DELIVERY_ID','ARTIFACT_IDS','BYTE_HASHES','OPERATOR_ACTION','INTENDED_RECIPIENT_OR_DESTINATION','CHANNEL','DEVICE_REPORTED_TIME','RESULT','EXTERNAL_RECEIPT_EVIDENCE_IDS','EPISTEMIC_BASIS','STATUS'],types:{ARTIFACT_IDS:{valueType:'REFERENCE_ARRAY'},BYTE_HASHES:{valueType:'STRING_ARRAY'},EXTERNAL_RECEIPT_EVIDENCE_IDS:{valueType:'REFERENCE_ARRAY'}},relationships:{DELIVERY_ID:'deliveryRecords'},commitPolicy:C.APPEND_ONLY});
addRequiredFamily('mobileAcceptanceRecords',{title:'Mobile acceptance records',idField:'MOBILE_ACCEPTANCE_RECORD_ID',prefix:'MOBILE-ACCEPTANCE',application:['MOBILE_ACCEPTANCE_RECORD_ID','MOBILE_ACCEPTANCE_TARGET_ID','DEPLOYED_COMMIT','DEPLOYMENT_MANIFEST_SHA256','ORIGIN','TEST_PROJECT_ID','VIEWPORT','DEVICE_PIXEL_RATIO','IOS_VERSION','SAFARI_USER_AGENT','PERFORMER','IDENTITY_ASSURANCE','CHALLENGE','EVIDENCE_IDS','RESULT','EPISTEMIC_BASIS','STATUS'],types:{VIEWPORT:{valueType:'OBJECT'},EVIDENCE_IDS:{valueType:'REFERENCE_ARRAY'}},commitPolicy:C.APPEND_ONLY});

const EXACT_SCOPE_DIMENSIONS=Object.freeze({
  1:['inputVersion'],2:['inputVersion','sourceSetVersion'],3:['inputVersion','sourceSetVersion','researchVersion'],4:['inputVersion','sourceSetVersion','researchVersion','requirementsVersion'],5:['inputVersion','sourceSetVersion','researchVersion','requirementsVersion'],6:['requirementsVersion','testSuiteVersion'],7:['requirementsVersion','testSuiteVersion'],8:['requirementsVersion','testSuiteVersion','instructionVersion'],9:['requirementsVersion','testSuiteVersion','instructionVersion'],10:['requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId'],11:['iterationId','candidateId','runId'],12:['iterationId','candidateId','runId','requirementsVersion','testSuiteVersion'],13:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],14:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],15:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],16:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],17:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],18:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],19:['sourceConvergedIterationId','confirmationIterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],20:['confirmationIterationId','baselineId'],21:['baselineId','productId'],22:['baselineId','productId','productVersion','requirementsVersion','testSuiteVersion'],23:['baselineId','productId','productVersion','requirementsVersion','testSuiteVersion'],24:['baselineId','productId','productVersion','requirementsVersion','testSuiteVersion'],25:['baselineId','productId','productVersion','deliveryCandidateSetId'],26:['baselineId','productId','productVersion','deliveryCandidateSetId','reviewVersion'],27:['baselineId','productId','productVersion','deliveryCandidateSetId','reconciledReviewVersion'],28:['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId'],29:['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId'],30:['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId','evidenceChainVersion']
});
const TARGET_DIMENSIONS_BY_STAGE=Object.freeze({2:['sourceSetVersion'],3:['researchVersion'],4:['requirementsVersion'],6:['testSuiteVersion'],8:['instructionVersion'],10:['iterationId','candidateId'],11:['runId'],19:['confirmationIterationId'],20:['baselineId'],21:['productId'],25:['deliveryCandidateSetId'],26:['reviewVersion'],27:['reconciledReviewVersion'],28:['releaseId'],29:['hashReviewId'],30:['evidenceChainVersion']});
const TARGET_DIMENSIONS_BY_OPERATION=Object.freeze({
  '19:CONFIRM_FREEZE':Object.freeze(['confirmationIterationId']),
  '19:EXECUTE_RUN':Object.freeze([]),'19:VERIFY':Object.freeze([]),'19:COMPARE':Object.freeze([]),'19:REGRESSION_VERIFY':Object.freeze([]),'19:CONFIRM':Object.freeze([]),
  '25:FREEZE_DELIVERY_CANDIDATE':Object.freeze(['deliveryCandidateSetId']),'25:COMPLETE':Object.freeze([]),
  '26:COMPLETE':Object.freeze(['reviewVersion']),'26:SEMANTIC_REVIEW':Object.freeze([]),'26:RECONCILE':Object.freeze([]),
  '27:CALCULATE_RELEASE':Object.freeze([]),'27:ADVISORY_REVIEW':Object.freeze([]),
  '28:VERIFY_IDENTITY':Object.freeze([]),'28:CAPTURE_DELIVERY_INTENT':Object.freeze([]),
  '29:CALCULATE_EVIDENCE_CHAINS':Object.freeze([]),'29:INVESTIGATE_MISSING_EVIDENCE':Object.freeze([]),
  '30:CALCULATE_TERMINAL':Object.freeze([]),'30:EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS':Object.freeze([]),'30:RECORD_DELIVERY_EVIDENCE':Object.freeze([])
});
const STAGE_OPERATION_SCOPE_MATRIX=Object.freeze(Object.fromEntries(Object.entries(s0.STAGE_OPERATIONS).flatMap(([stageText,operations])=>{const stage=Number(stageText);return operations.map(operation=>{const key=`${stage}:${operation}`,targets=new Set(Object.prototype.hasOwnProperty.call(TARGET_DIMENSIONS_BY_OPERATION,key)?TARGET_DIMENSIONS_BY_OPERATION[key]:(TARGET_DIMENSIONS_BY_STAGE[stage]||[]));const dimensions=Object.fromEntries((EXACT_SCOPE_DIMENSIONS[stage]||[]).map(name=>[name,targets.has(name)?'TARGET_RESERVED':'INPUT_CURRENT']));return [key,Object.freeze({stage,operation,requiredDimensions:Object.freeze([...(EXACT_SCOPE_DIMENSIONS[stage]||[])]),dimensions:Object.freeze(dimensions),prohibitedExtraDimensions:true})];});})));

const EXTERNAL_OPERATION_KEYS=new Set();
for(const [stageText,ops] of Object.entries(s0.STAGE_OPERATIONS)){const stage=Number(stageText);for(const operation of ops){const key=`${stage}:${operation}`;const app=(stage===10&&operation==='FREEZE')||(stage===18&&operation==='COMPLETE')||(stage===19&&['CONFIRM_FREEZE','CONFIRM'].includes(operation))||(stage===20&&operation==='FREEZE_BASELINE')||(stage===22&&operation==='RUN_NATIVE_TESTS')||(stage===24&&operation==='RUN_NATIVE_ATTACKS')||(stage===25&&operation==='FREEZE_DELIVERY_CANDIDATE')||(stage===27&&operation==='CALCULATE_RELEASE')||(stage===28&&operation==='VERIFY_IDENTITY')||(stage===29&&operation==='CALCULATE_EVIDENCE_CHAINS')||(stage===30&&operation==='CALCULATE_TERMINAL');const humanDecision=stage===28&&operation==='CAPTURE_DELIVERY_INTENT';const operator=stage===30&&['EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','RECORD_DELIVERY_EVIDENCE'].includes(operation);if(!app&&!humanDecision&&!operator)EXTERNAL_OPERATION_KEYS.add(key);}}
const STAGE_OPERATION_REGISTRY=Object.freeze(Object.fromEntries(Object.entries(s0.STAGE_OPERATIONS).flatMap(([stageText,operations])=>{const stage=Number(stageText);return operations.map(operation=>{const key=`${stage}:${operation}`,external=EXTERNAL_OPERATION_KEYS.has(key),humanDecision=stage===28&&operation==='CAPTURE_DELIVERY_INTENT',operator=stage===30&&['EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','RECORD_DELIVERY_EVIDENCE'].includes(operation);const base=amendedOperationContract(stage,operation)||{};const acceptanceMode=external?((stage===1&&['COMPLETE','RECONCILE_INTAKE'].includes(operation))?'HUMAN_ACCEPTANCE_REQUIRED':'HUMAN_ACCEPTANCE_REQUIRED'):'DIRECT_COMMAND';return [key,Object.freeze({stage,operation,executorClass:external?'EXTERNAL_AGENT':humanDecision?'HUMAN_DECISION':operator?'OPERATOR_ACTION':'APPLICATION',acceptsExternalResponse:external,responseTypes:Object.freeze(external?[...s0.RESPONSE_TYPES]:[]),acceptanceMode,reservationRequired:external,scope:STAGE_OPERATION_SCOPE_MATRIX[key],readCollections:Object.freeze([...(base.readCollections||[])]),writableCollections:Object.freeze(external?[...(base.agentWritableCollections||[])]:[]),agentWritableCollections:Object.freeze(external?[...(base.agentWritableCollections||[])]:[]),allowedStageData:Object.freeze([...(base.allowedStageData||[])]),scopeRequirements:Object.freeze([...(STAGE_OPERATION_SCOPE_MATRIX[key]?.requiredDimensions||[])]),applicationCollections:Object.freeze([...(base.applicationCollections||[])]),completionPredicate:`STAGE_${String(stage).padStart(2,'0')}_${operation}_COMPLETION`,retryRule:external?'EXACT_RETRY_OR_REPLACEMENT_PROMPT':'IDEMPOTENT_COMMAND',minimumInputBindingBasis:external?'EXTERNALLY_SUPPORTED':'APPLICATION_OBSERVED'})];});})));

const FIELD_REGISTRY_ENTRIES={};
for(const [name,definition] of Object.entries(s0.JOB_FIELDS||{}))FIELD_REGISTRY_ENTRIES[`JOB.${name}`]=Object.freeze({path:`/job/${name}`,producer:definition.producer,valueType:definition.valueType,nullable:Boolean(definition.nullable),cardinality:'ONE',requiredAtStage:definition.requiredAtStage??null,writableOperation:definition.producer===P.HUMAN?'SAVE_HUMAN_INPUT':definition.producer===P.HUMAN_DECISION?'RECORD_HUMAN_DECISION':null,classification:definition.producer===P.APPLICATION?'DERIVED_OR_IMMUTABLE':'CANONICAL',scopeDimensions:Object.freeze([]),migrationDefault:definition.nullable?null:'NO_DEFAULT',invalidationOwner:'workflow-engine.js',normalizerIdentity:definition.normalizerKey||null,derivationIdentity:definition.derivationKey||null});
for(const [family,definition] of Object.entries(RS))for(const [name,fieldDefinition] of Object.entries(definition.fieldDefinitions||{}))FIELD_REGISTRY_ENTRIES[`RECORD.${family}.${name}`]=Object.freeze({path:`/projectData/${family}/*/${name}`,producer:fieldDefinition.producer,valueType:fieldDefinition.valueType,nullable:Boolean(fieldDefinition.nullable),cardinality:'ONE',requiredAtStage:definition.stage??null,writableOperation:fieldDefinition.producer===P.AGENT?'REGISTERED_STAGE_OPERATION':fieldDefinition.producer===P.HUMAN?'SAVE_HUMAN_INPUT':fieldDefinition.producer===P.HUMAN_DECISION?'RECORD_HUMAN_DECISION':null,classification:fieldDefinition.producer===P.APPLICATION?'DERIVED_OR_IMMUTABLE':'CANONICAL',scopeDimensions:Object.freeze([]),migrationDefault:fieldDefinition.nullable?null:'NO_DEFAULT',invalidationOwner:'workflow-engine.js',normalizerIdentity:fieldDefinition.normalizerKey||null,derivationIdentity:fieldDefinition.derivationKey||null});
for(const [stageText,fields] of Object.entries(s0.STAGE_FIELDS||{}))for(const [name,definition] of Object.entries(fields||{}))FIELD_REGISTRY_ENTRIES[`STAGE.${stageText}.${name}`]=Object.freeze({path:`/stages/${stageText}/${name}`,producer:definition.producer,valueType:definition.valueType,nullable:Boolean(definition.nullable),cardinality:'ONE',requiredAtStage:Number(stageText),writableOperation:definition.producer===P.AGENT?'REGISTERED_STAGE_OPERATION':null,classification:definition.producer===P.APPLICATION?'DERIVED_SUMMARY':'PROPOSAL',scopeDimensions:Object.freeze([]),migrationDefault:definition.nullable?null:'NO_DEFAULT',invalidationOwner:'workflow-engine.js',normalizerIdentity:definition.normalizerKey||null,derivationIdentity:definition.derivationKey||null});
const FIELD_REGISTRY=Object.freeze(FIELD_REGISTRY_ENTRIES);
const DURABLE_OBJECT_REGISTRY=Object.freeze(Object.fromEntries(Object.entries(RS).map(([family,definition])=>[family,Object.freeze({family,idField:definition.idField,prefix:definition.prefix,stage:definition.stage??'GLOBAL',policy:definition.commitPolicy,producerPartitions:Object.freeze({human:Object.freeze([...(definition.ownership?.human||[])]),humanDecision:Object.freeze([...(definition.ownership?.humanDecision||[])]),agent:Object.freeze([...(definition.ownership?.agent||[])]),application:Object.freeze([...(definition.ownership?.application||[])])}),relationships:Object.freeze({...definition.relationships}),scope:'REGISTERED_CURRENT_SCOPE',invalidationOwner:'workflow-engine.js',hashInclusion:'REGISTERED_RECORD_PREIMAGE'})])));
const normalizerRegistry=Object.freeze({identity:'closed-loop-normalizer-registry/1',entries:Object.freeze({})});
const derivationRegistry=Object.freeze({identity:'closed-loop-derivation-registry/1',entries:Object.freeze({})});

const schema=Object.freeze({...s0,version:'closed-loop-workflow-schema/3',__controllingCompletionAmendmentVersion:VERSION,CONTROLLING_COMPLETION_ENUMS:E,RECORD_SCHEMAS:Object.freeze(RS),RECORD_OWNERSHIP:Object.freeze(RO),STAGE_COLLECTIONS:SC,READ_COLLECTIONS:RC,APPLICATION_COLLECTIONS:AC,STAGE_CONTRACTS:CONTRACTS,operationContract:amendedOperationContract,FIELD_REGISTRY,STAGE_OPERATION_REGISTRY,STAGE_OPERATION_SCOPE_MATRIX,DURABLE_OBJECT_REGISTRY,normalizerRegistry,derivationRegistry,VERIFICATION_PHASE_VALUES,EXACT_SCOPE_DIMENSIONS,allowedCollections:n=>Object.freeze([...(SC[n]||[])]),recordAgentFields:c=>Object.freeze(Object.values(RS[c]?.fieldDefinitions||{}).filter(d=>d.producer===P.AGENT).map(d=>d.name)),recordHumanFields:c=>Object.freeze(Object.values(RS[c]?.fieldDefinitions||{}).filter(d=>d.producer===P.HUMAN||d.producer===P.HUMAN_DECISION).map(d=>d.name))});globalThis.closedLoopWorkflowSchema=schema;
const augmented=globalThis.closedLoopWorkflowSchema;
globalThis.closedLoopWorkflowSchema=Object.freeze({...augmented,TRUTH_VALUES:Object.freeze([...E.truth]),EPISTEMIC_BASES:Object.freeze([...E.basis]),APPLICABILITY_VALUES:Object.freeze([...E.applicability]),ENTAILMENT_VALUES:Object.freeze([...E.entailment]),PROOF_EXPRESSION_OPERATORS:Object.freeze(['LEAF','ALL_OF','ANY_OF','AT_LEAST_K']),NORMATIVE_CLASS_VALUES:Object.freeze([...E.normative]),SEMANTIC_COVERAGE_VALUES:Object.freeze([...E.coverage]),OBSERVATION_ORIGIN_VALUES:Object.freeze([...E.origin]),DELIVERY_STATE_VALUES:Object.freeze([...E.delivery])});
})();

/* BUILD STAGE 03 CLOSED CONTRACT AMENDMENT */
;(()=>{
'use strict';
const s=globalThis.closedLoopWorkflowSchema,h=globalThis.closedLoopHash;
if(!s||!h)throw new Error('Stage 03 contract amendment requires workflow schema and hash authority.');
const VERSION='closed-loop-stage03-contract-closure/1';
const NO_NORMALIZER_ID='closed-loop-normalizer/none/1',NO_DERIVATION_ID='closed-loop-derivation/none/1';
const regId=(kind,key)=>`closed-loop-${kind}/1/${h.sha256Text(String(key)).slice(0,24)}`;
const normalizers={[NO_NORMALIZER_ID]:Object.freeze({id:NO_NORMALIZER_ID,version:1,implementationOwner:'workflow-schema.js',canonicalInputContract:'VALUE_UNCHANGED',outputContract:'VALUE_UNCHANGED',buildIdentity:VERSION,invalidationConsequences:'NONE'})};
const derivations={[NO_DERIVATION_ID]:Object.freeze({id:NO_DERIVATION_ID,version:1,implementationOwner:'workflow-schema.js',canonicalInputContract:'NO_APPLICATION_DERIVATION',outputContract:'NO_APPLICATION_DERIVATION',buildIdentity:VERSION,invalidationConsequences:'NONE'})};
const normalizerId=key=>{if(!key)return NO_NORMALIZER_ID;const id=regId('normalizer',key);normalizers[id]??=Object.freeze({id,version:1,implementationOwner:'workflow-schema.js',sourceKey:String(key),canonicalInputContract:'DECLARED_FIELD_INPUT',outputContract:'DECLARED_NORMALIZED_VALUE',buildIdentity:VERSION,invalidationConsequences:'INVALIDATE_AFFECTED_CURRENT_VALUES'});return id;};
const derivationId=key=>{if(!key)return NO_DERIVATION_ID;const id=regId('derivation',key);derivations[id]??=Object.freeze({id,version:1,implementationOwner:'workflow-engine.js',sourceKey:String(key),canonicalInputContract:'REGISTERED_CANONICAL_DEPENDENCIES',outputContract:'DECLARED_APPLICATION_VALUE',buildIdentity:VERSION,invalidationConsequences:'INVALIDATE_AFFECTED_DERIVED_VALUES'});return id;};
function stageForKey(key){const m=String(key).match(/^STAGE\.(\d+)\./);if(m)return Number(m[1]);const r=String(key).match(/^RECORD\.([^.]+)\./);if(r){const stage=s.RECORD_SCHEMAS?.[r[1]]?.stage;return Number.isInteger(stage)?stage:null;}return null;}
function definitionForKey(key){let m=String(key).match(/^JOB\.(.+)$/);if(m)return s.JOB_FIELDS?.[m[1]]||null;m=String(key).match(/^STAGE\.(\d+)\.(.+)$/);if(m)return s.STAGE_FIELDS?.[m[1]]?.[m[2]]||null;m=String(key).match(/^RECORD\.([^.]+)\.(.+)$/);if(m)return s.RECORD_SCHEMAS?.[m[1]]?.fieldDefinitions?.[m[2]]||null;return null;}
function relationshipForKey(key){const m=String(key).match(/^RECORD\.([^.]+)\.(.+)$/);return m?s.RECORD_SCHEMAS?.[m[1]]?.relationships?.[m[2]]||null:null;}
const fields={};
for(const [key,c] of Object.entries(s.FIELD_REGISTRY||{})){
  const d=definitionForKey(key)||{},stage=stageForKey(key),relationshipTarget=relationshipForKey(key);
  fields[key]=Object.freeze({...c,enumValues:Object.freeze([...(d.enumValues||[])]),requiredness:c.requiredAtStage!=null||stage!=null?'STAGE_BOUND':'CONTRACT_BOUND',relationshipTarget,relationshipDirection:relationshipTarget?'OUTBOUND_REFERENCE':null,scope:'REGISTERED_CURRENT_SCOPE',scopeDimensions:Object.freeze([...(Number.isInteger(stage)?s.EXACT_SCOPE_DIMENSIONS?.[stage]||[]:[])]),migrationRule:c.migrationDefault===null?'EXPLICIT_NULL_OR_ABSENT_UNTIL_CREATED':'NO_DEFAULT',normalizerIdentity:normalizerId(c.normalizerIdentity||d.normalizerKey||d.normalizer||null),derivationIdentity:derivationId(c.derivationIdentity||d.derivationKey||d.derivation||null)});
}
const operations={};
for(const [key,c] of Object.entries(s.STAGE_OPERATION_REGISTRY||{})){
  const independent=(c.stage===9)||(c.stage===12)||(c.stage===23)||(c.stage===24)||['SEMANTIC_CHALLENGE','SEARCH_ADEQUACY_REVIEW','DISPOSITION_CHALLENGE','ATOMICITY_CHALLENGE','SEMANTIC_REVIEW','PROOF_REVIEW'].includes(c.operation);
  operations[key]=Object.freeze({...c,targetSlotRule:'SHA256_CLOSED_REGISTERED_SCOPE',requiredInputFamilies:Object.freeze([...(c.readCollections||[])]),writableFieldsRule:c.acceptsExternalResponse?'FIELD_REGISTRY_AGENT_PARTITION_ONLY':'NO_EXTERNAL_WRITABLE_FIELDS',independenceRequired:independent});
}
const durable={};
for(const [family,c] of Object.entries(s.DURABLE_OBJECT_REGISTRY||{}))durable[family]=Object.freeze({...c,lifecyclePolicy:c.policy,migrationBehavior:'EXPLICIT_PROFILE_MIGRATION_OR_INVALIDATION',scopeDimensions:Object.freeze([...(Number.isInteger(c.stage)?s.EXACT_SCOPE_DIMENSIONS?.[c.stage]||[]:[])])});
const ATTACHMENT_SLOT_CONTRACT=Object.freeze({version:'closed-loop-attachment-slot/1',requiredProperties:Object.freeze(['attachmentSlotId','packageId','operationReservationId','jobId','stage','operation','purpose','role','required','allowedMediaTypes','filenameRule','maximumSize','expectedDigest']),mappingAuthority:'ATTACHMENT_SLOT_ID',selectionOrderAuthoritative:false,filenameAloneAuthoritative:false,crossPackageReuseAllowed:false});
function validateAttachmentSlotDefinition(slot){if(!slot||typeof slot!=='object'||Array.isArray(slot))return Object.freeze({valid:false,reason:'ATTACHMENT_SLOT_NOT_OBJECT'});for(const key of ATTACHMENT_SLOT_CONTRACT.requiredProperties)if(!Object.prototype.hasOwnProperty.call(slot,key))return Object.freeze({valid:false,reason:`ATTACHMENT_SLOT_MISSING_${key}`});if(typeof slot.attachmentSlotId!=='string'||!slot.attachmentSlotId)return Object.freeze({valid:false,reason:'ATTACHMENT_SLOT_ID_INVALID'});if(!Array.isArray(slot.allowedMediaTypes)||!slot.allowedMediaTypes.length)return Object.freeze({valid:false,reason:'ATTACHMENT_SLOT_MEDIA_CONTRACT_INVALID'});if(!Number.isSafeInteger(slot.maximumSize)||slot.maximumSize<0)return Object.freeze({valid:false,reason:'ATTACHMENT_SLOT_SIZE_INVALID'});return Object.freeze({valid:true,reason:null});}
const IDENTITY_ASSURANCE_VALUES=Object.freeze(['SELF_ASSERTED','VERIFIED_EXTERNAL','AUTHENTICATED']);
const PURPOSES=Object.freeze(['INTENT_CONFIRMATION','CANDIDATE_COMPONENT_SELECTION','BASELINE_AUTHORIZATION','DISCLOSURE_AUTHORIZATION','EXTERNAL_ACTION_RISK_AUTHORIZATION','CONTROLLED_EXCEPTION','REGRESSION_RETIREMENT_AUTHORIZATION','BACKUP_POLICY_SELECTION','TRADEOFF_OR_SCOPE_DECISION','VISUAL_BASELINE_AUTHORIZATION','HUMAN_AUTHORITY_CORRECTION']);
const HUMAN_DECISION_PURPOSE_REGISTRY=Object.freeze(Object.fromEntries(PURPOSES.map(purpose=>[purpose,Object.freeze({purpose,minimumIdentityAssurance:'SELF_ASSERTED',currentAvailableIdentityAssurance:'SELF_ASSERTED'})])));
function identityAssuranceSatisfies(purpose,actual){const c=HUMAN_DECISION_PURPOSE_REGISTRY[purpose];if(!c)return Object.freeze({allowed:false,reason:'UNKNOWN_HUMAN_DECISION_PURPOSE'});const a=IDENTITY_ASSURANCE_VALUES.indexOf(actual),m=IDENTITY_ASSURANCE_VALUES.indexOf(c.minimumIdentityAssurance);if(a<0||m<0)return Object.freeze({allowed:false,reason:'UNKNOWN_IDENTITY_ASSURANCE'});return Object.freeze({allowed:a>=m,reason:a>=m?null:'IDENTITY_ASSURANCE_BELOW_MINIMUM'});}
globalThis.closedLoopWorkflowSchema=Object.freeze({...s,FIELD_REGISTRY:Object.freeze(fields),STAGE_OPERATION_REGISTRY:Object.freeze(operations),DURABLE_OBJECT_REGISTRY:Object.freeze(durable),normalizerRegistry:Object.freeze({identity:'closed-loop-normalizer-registry/1',entries:Object.freeze(normalizers)}),derivationRegistry:Object.freeze({identity:'closed-loop-derivation-registry/1',entries:Object.freeze(derivations)}),ATTACHMENT_SLOT_CONTRACT,validateAttachmentSlotDefinition,IDENTITY_ASSURANCE_VALUES,HUMAN_DECISION_PURPOSE_REGISTRY,identityAssuranceSatisfies,stage03ContractClosureVersion:VERSION});
})();

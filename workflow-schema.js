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
const VALUE_TYPES=Object.freeze(['STRING','INTEGER','NUMBER','BOOLEAN','STRING_ARRAY','REFERENCE','REFERENCE_ARRAY','OBJECT','OBJECT_ARRAY']);
const COLLECTION_POLICIES=Object.freeze({REPLACE_CURRENT_STAGE_SET:'REPLACE_CURRENT_STAGE_SET',APPEND_SCOPED:'APPEND_SCOPED',UPDATE_RESERVED:'UPDATE_RESERVED',APPEND_ONLY:'APPEND_ONLY',APPLICATION_DERIVED:'APPLICATION_DERIVED'});
const DEFAULT_RESOURCE_LIMITS=Object.freeze({maxRawResponseBytes:1048576,maxJsonDepth:32,maxRecordsPerCollection:250,maxEvidenceRecords:500,maxAttachments:25,maxTextFieldLength:200000});
const RESPONSE_TYPES=Object.freeze(['DATA_PROPOSAL','HUMAN_INPUT_REQUIRED','BLOCKED','EXECUTION_FAILED']);
const CONFLICT_POLICIES=Object.freeze(['reject','request clarification','controlled override']);
const STAGE_OPERATIONS=Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>[i+1,Object.freeze(['COMPLETE'])]));
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
function ownerFromPartition(partition,name,label){const hits=[['human',PRODUCER.HUMAN],['humanDecision',PRODUCER.HUMAN_DECISION],['agent',PRODUCER.AGENT],['application',PRODUCER.APPLICATION]].filter(([key])=>partition?.[key]?.includes(name));if(hits.length!==1)throw new Error(`${label} field ${name} must occur in exactly one ownership partition.`);return hits[0][1];}

function stageFieldProducer(stage,name){return ownerFromPartition(core.STAGES[Number(stage)-1]?.ownership,name,`Stage ${stage}`);}
const TEST_IR=Object.freeze({
  version:'closed-loop-test-spec/1',
  capability:'CLOSED_LOOP_TEST_IR',
  executableKinds:Object.freeze(['NONE','TEST_IR']),
  operations:Object.freeze(['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE','ASSERT_EXISTS','ASSERT_TYPE','ASSERT_NE']),
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
  const producer=stageFieldProducer(stage,name),type=STAGE_FIELD_TYPE_OVERRIDES[String(stage)]?.[name]||EXPLICIT_STAGE_FIELD_TYPES[String(stage)]?.[name]||core.CONTROLLING_COMPLETION_STAGE_FIELD_DEFINITIONS?.[stage]?.[name];if(!type)throw new Error(`Stage ${stage} field ${name} has no explicit type metadata.`);
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
  1:['blockers'],2:['blockers'],3:['blockers'],4:['blockers'],5:['blockers'],6:['blockers'],7:['blockers'],8:['blockers'],
  9:['blockers','freshContexts'],10:['blockers'],11:['blockers','freshContexts'],12:['blockers','freshContexts'],13:['blockers'],14:['blockers'],
  15:['blockers'],16:['blockers'],17:['blockers','freshContexts'],18:['blockers'],19:['blockers','freshContexts'],20:['blockers'],21:['blockers','freshContexts'],
  22:['blockers'],23:['blockers','freshContexts'],24:['blockers','freshContexts'],25:['blockers','freshContexts'],26:['blockers'],27:['blockers'],28:['blockers'],29:['blockers'],30:['blockers']
});


const READ_COLLECTIONS=Object.freeze({1:[],2:[],3:['sources','sourceConflicts'],4:['research','candidateRequirements','sources','evidenceRecords','sourceConflicts'],5:['requirements','research','sources','sourceConflicts','evidenceRecords','candidateRequirements'],6:['requirements','requirementResolutions','artifacts','sources','research'],7:['requirements','tests','artifacts','evidenceRecords'],8:['requirements','tests','failureTests','requirementResolutions','sources','sourceConflicts'],9:['instructions','instructionTraces','requirements','tests','failureTests','requirementResolutions','sources','sourceConflicts'],10:['instructions','preflightRecords','tests','failureTests','artifacts'],11:['candidateFreezes','iterations','runs','freshContexts'],12:['runs','requirements','tests','freshContexts','sources','evidenceRecords'],13:['verification','runs','requirements','tests'],14:['defects','comparisons','verification','requirements','tests','instructions','instructionTraces','runs','candidateFreezes','failureTests','requirementResolutions','candidateRequirements','research','sources','sourceConflicts','artifacts','evidenceRecords'],15:['defects','rootCauses','comparisons','verification','runs','requirements','tests','failureTests','instructions','candidateFreezes','artifacts','evidenceRecords'],16:['defects','rootCauses','regressions','regressionExecutions','comparisons','verification','runs','requirements','requirementResolutions','candidateRequirements','research','sources','instructions','instructionTraces','tests','failureTests','candidateFreezes','artifacts','evidenceRecords','changes'],17:['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions'],18:['iterations','runs','verification','comparisons','defects','regressions','regressionExecutions','blockers','requirements','tests','rootCauses','changes'],19:['convergenceRecords','candidateFreezes','tests','regressions','regressionExecutions'],20:['confirmationRecords','candidateFreezes','iterations','artifacts'],21:['baselines','instructions','artifacts','freshContexts'],22:['products','tests','artifacts'],23:['products','requirements','tests','sources','evidenceRecords','research'],24:['products','requirements','tests','failureTests','regressions','regressionExecutions','defects','sources','evidenceRecords','research','artifacts'],25:['products','baselines','artifacts','requirements','tests','evidenceRecords'],26:['products','baselines','requirements','instructions','tests','runs','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','regressions','regressionExecutions','defects','blockers','evidenceRecords','confirmationRecords'],27:['requirements','tests','products','baselines','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','defects','blockers','regressionExecutions','evidenceRecords','confirmationRecords','regressions'],28:['releaseRecords','artifactIdentities','artifacts'],29:['sources','requirements','instructions','instructionTraces','runs','products','baselines','tests','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','regressions','regressionExecutions','releaseRecords','artifactIdentities','evidenceRecords','evidenceChains'],30:['defects','rootCauses','regressions','regressionExecutions','changes','baselines','evidenceRecords','requirements']});
const APPLICATION_COLLECTIONS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>[i+1,Object.freeze(['blockers','freshContexts','artifacts','releaseRecords','artifactIdentities','evidenceChains'])])));
const HUMAN_ACTIONS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>[i+1,Object.freeze(['ANSWER_HUMAN_INPUT','REJECT_RESPONSE','REQUEST_CORRECTION'])])));
const SCOPE_REQUIREMENTS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>{const s=i+1,keys=['projectRevision','inputVersion'];if(s>=3)keys.push('sourceSetVersion');if(s>=5)keys.push('requirementsVersion');if(s>=7)keys.push('testSuiteVersion');if(s>=9)keys.push('instructionVersion');if(s>=10&&s<=20)keys.push('iterationId','candidateId');if(s===9)keys.push('contextId');if(s===11)keys.push('runId','contextId');if(s>=20)keys.push('baselineId');if(s>=21)keys.push('productId');return [s,Object.freeze([...new Set(keys)])];})));
const OPERATION_CONTRACT_OVERRIDES=Object.freeze({17:Object.freeze({FREEZE:Object.freeze({readCollections:['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions','instructions','requirements','artifacts'],agentWritableCollections:[],allowedStageData:[]}),EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts'],agentWritableCollections:['runs'],allowedStageData:[]}),VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts','sources','evidenceRecords'],agentWritableCollections:['verification'],allowedStageData:[]}),COMPARE:Object.freeze({readCollections:['verification','runs','requirements','tests'],agentWritableCollections:['comparisons'],allowedStageData:[]}),ROOT_CAUSE:Object.freeze({readCollections:['defects','comparisons','verification','requirements','tests','instructions','instructionTraces','runs','candidateFreezes','failureTests','requirementResolutions','candidateRequirements','research','sources','sourceConflicts','artifacts','evidenceRecords'],agentWritableCollections:['defects','rootCauses'],allowedStageData:[]}),REGRESSION:Object.freeze({readCollections:['defects','rootCauses','comparisons','verification','runs','requirements','tests','failureTests','instructions','candidateFreezes','artifacts','evidenceRecords','regressions','regressionExecutions'],agentWritableCollections:['regressions','regressionExecutions'],allowedStageData:[]}),CORRECT:Object.freeze({readCollections:['defects','rootCauses','regressions','regressionExecutions','comparisons','verification','runs','requirements','requirementResolutions','candidateRequirements','research','sources','instructions','instructionTraces','tests','failureTests','candidateFreezes','artifacts','evidenceRecords','changes'],agentWritableCollections:['changes'],allowedStageData:[]})}),19:Object.freeze({CONFIRM_FREEZE:Object.freeze({readCollections:['convergenceRecords','candidateFreezes','iterations','requirements','tests','artifacts'],agentWritableCollections:[],allowedStageData:[]}),EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts'],agentWritableCollections:['runs'],allowedStageData:[]}),VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts','sources','evidenceRecords'],agentWritableCollections:['verification'],allowedStageData:[]}),COMPARE:Object.freeze({readCollections:['verification','runs','requirements','tests'],agentWritableCollections:['comparisons'],allowedStageData:[]}),REGRESSION_VERIFY:Object.freeze({readCollections:['regressions','regressionExecutions','runs','tests','requirements','artifacts'],agentWritableCollections:['regressionExecutions'],allowedStageData:[]}),CONFIRM:Object.freeze({readCollections:['runs','verification','comparisons','tests','regressions','regressionExecutions','candidateFreezes','defects','blockers','evidenceRecords','requirements'],agentWritableCollections:['confirmationRecords'],allowedStageData:[]})})});
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
  PROJECT_SCHEMA,WORKFLOW_ID,STAGE_COUNT,VALUE_TYPES,COLLECTION_POLICIES,DEFAULT_RESOURCE_LIMITS,STAGE_OPERATIONS,READ_COLLECTIONS,APPLICATION_COLLECTIONS,HUMAN_ACTIONS,SCOPE_REQUIREMENTS,RECORD_OWNERSHIP,
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
function restoreMigratedStage01AcceptedCapture(migrated,original){
  const stage01=migrated?.stages?.['1']||migrated?.stages?.[1];
  if(!stage01||String(stage01.status||'').toUpperCase()!=='COMPLETE')return migrated;
  stage01.agentData=stage01.agentData&&typeof stage01.agentData==='object'&&!Array.isArray(stage01.agentData)?stage01.agentData:{};
  const accepted=stage01.acceptedData&&typeof stage01.acceptedData==='object'&&!Array.isArray(stage01.acceptedData)?stage01.acceptedData:{};
  if(String(stage01.agentData.INPUT_SET_CONTENTS||'').trim())return migrated;
  if(String(accepted.INPUT_SET_CONTENTS||'').trim()){stage01.agentData.INPUT_SET_CONTENTS=String(accepted.INPUT_SET_CONTENTS);return migrated;}
  const legacy=original?.userJobInput&&typeof original.userJobInput==='object'&&!Array.isArray(original.userJobInput)?original.userJobInput:null;
  const human={};for(const name of STAGE01_HUMAN_CAPTURE_FIELDS){const value=original?.job?.[name];if(value!==undefined&&value!==null&&String(value).trim()!=='')human[name]=clone(value);}
  const source=legacy&&Object.keys(legacy).length?legacy:Object.keys(human).length?human:null;
  const captured=source?JSON.stringify(source):String(stage01.draftRecord||'').trim();
  if(captured)stage01.agentData.INPUT_SET_CONTENTS=captured;
  return migrated;
}
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
function ensureV3Defaults(project){
  project.schema=CURRENT_PROJECT_SCHEMA;
  project.workflow=project.workflow||project.workflowId||'mobile-closed-loop/30';
  project.projectData=project.projectData&&typeof project.projectData==='object'?project.projectData:{};
  for(const key of ['intakeCoverageManifests','obligationManifests','promptContextManifests','blindAliasMaps','nativeExecutionEvents','propositions','propositionEquivalenceReviews','applicabilityRecords','proofExpressions','proofObligations','semanticCoverageReviews','sourceSearchAdequacyReviews','requirementCompilationChallengeReviews','observationRecords','entailmentReviews','environmentDependencies','operationReservations','backupRecords','deliveryRecords','deploymentManifests','disclosureAuthorizations'])if(!Array.isArray(project.projectData[key]))project.projectData[key]=[];
  if(!Array.isArray(project.projectData.nonOperationalImportedPayloads))project.projectData.nonOperationalImportedPayloads=[];
  project.projectData.schemaIdentities={...(project.projectData.schemaIdentities||{}),project:CURRENT_PROJECT_SCHEMA,response:CURRENT_RESPONSE_SCHEMA,testIr:TEST_IR_SCHEMA,verificationPackage:PACKAGE_SCHEMA};
  normalizeTestRecords(project);
  return project;
}
const priorMigrationName=['migrateProjectToCurrent','migrateProject','migrateLegacyProject','migrate'].find(name=>typeof base[name]==='function');
const priorMigration=priorMigrationName?base[priorMigrationName].bind(base):null;
function migrateProjectToCurrent(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Imported project must be an object.');
  if(input.schema===CURRENT_PROJECT_SCHEMA)return ensureV3Defaults(clone(input));
  const original=clone(input);
  let migrated;
  if(input.schema===PREVIOUS_PROJECT_SCHEMA)migrated=clone(input);
  else if(priorMigration){migrated=priorMigration(clone(input));if(migrated&&typeof migrated.then==='function')throw new Error('Project migration must be deterministic and synchronous.');}
  else throw new Error('Unsupported project schema '+String(input.schema));
  migrated=ensureV3Defaults(migrated);
  restoreMigratedStage01AcceptedCapture(migrated,original);
  const already=migrated.projectData.nonOperationalImportedPayloads.some(item=>item&&item.sourceSchema===original.schema&&item.sourceRevision===Number(original.revision||0)&&item.operational===false);
  if(!already)migrated.projectData.nonOperationalImportedPayloads.push({sourceSchema:String(original.schema||''),sourceRevision:Number(original.revision||0),operational:false,purpose:'ORIGINAL_IMPORTED_PAYLOAD_AUDIT_EVIDENCE',payload:original});
  migrated.projectHash='';
  return migrated;
}
const replacement={...base,PROJECT_SCHEMA:CURRENT_PROJECT_SCHEMA,PROJECT_SCHEMA_ID:CURRENT_PROJECT_SCHEMA,RESPONSE_SCHEMA:CURRENT_RESPONSE_SCHEMA,RESPONSE_SCHEMA_ID:CURRENT_RESPONSE_SCHEMA,PREVIOUS_PROJECT_SCHEMA,PREVIOUS_RESPONSE_SCHEMA,TEST_IR_SCHEMA,PACKAGE_SCHEMA,migrateProjectToCurrent};
if(priorMigrationName)replacement[priorMigrationName]=migrateProjectToCurrent;
globalThis.closedLoopWorkflowSchema=Object.freeze(replacement);
})();

/* INTEGRATED CONTROLLING COMPLETION 53-70 */
;(()=>{
'use strict';
const core=globalThis.closedLoopCore,s0=globalThis.closedLoopWorkflowSchema,h=globalThis.closedLoopHash;
if(!core||!s0||!h)throw new Error('Base schema/hash must load before integrated completion schema.');
const VERSION='closed-loop-controlling-completion/53-70/1',P=s0.PRODUCER,C=s0.COLLECTION_POLICIES;
const E=Object.freeze({truth:['TRUE','FALSE','UNKNOWN'],basis:['APPLICATION_OBSERVED','VERIFIED_EXTERNAL','EXTERNALLY_SUPPORTED','SELF_ASSERTED','NONE'],fresh:['CURRENT','EXPIRED','UNKNOWN','NOT_APPLICABLE'],scope:['CURRENT','STALE'],contradiction:['CLEAR','CONTRADICTED'],applicability:['APPLICABLE','NOT_APPLICABLE','UNKNOWN'],normative:['MANDATORY','CONDITIONAL','OPTIONAL','UNKNOWN'],coverage:['EQUIVALENT','PARTIAL','UNKNOWN','NOT_EQUIVALENT'],role:['REQUIRED_PROOF','SUPPORTING_PROOF','ADVISORY','NEGATIVE_ONLY','REGRESSION'],entailment:['ESTABLISHES','REFUTES','SUPPORTS_ONLY','CONTEXT_ONLY','DOES_NOT_ADDRESS','UNKNOWN'],origin:['NATIVE_APPLICATION_OBSERVATION','VERIFIED_EXTERNAL_OBSERVATION','EXTERNAL_CLAIM','HUMAN_OBSERVATION','AGENT_SEMANTIC_OBSERVATION'],delivery:['AUTHORIZED','BLOCKED','WITHDRAWN_FOR_FUTURE_USE','SUPERSEDED'],reservation:['ACTIVE','ORPHANED','CANCELLED','ACCEPTED','SUPERSEDED'],disclosure:['PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED','CREDENTIAL_SECRET','UNKNOWN']});
function field(name,producer,opt={}){return s0.field(name,producer,{valueType:opt.valueType||'STRING',enumValues:opt.enumValues||[],nullable:Boolean(opt.nullable),closedProperties:opt.closedProperties||null,requiredAtStage:opt.stage==null?null:opt.stage,responsePath:producer===P.AGENT?`/records/{collection}/*/fields/${name}`:null,derivationKey:producer===P.APPLICATION?`completion.${name}`:null,provenanceRequired:producer===P.AGENT});}
function rec({title,idField,prefix,stage=null,agent=[],human=[],humanDecision=[],application=[],types={},required=[],relationships={},commitPolicy=C.APPEND_SCOPED}){const fields=[...human,...humanDecision,...agent,...application],ownership={human:Object.freeze([...human]),humanDecision:Object.freeze([...humanDecision]),agent:Object.freeze([...agent]),application:Object.freeze([...application])},defs={};for(const n of fields){const producer=human.includes(n)?P.HUMAN:humanDecision.includes(n)?P.HUMAN_DECISION:agent.includes(n)?P.AGENT:P.APPLICATION;defs[n]=field(n,producer,{...(relationships[n]?{valueType:'REFERENCE'}:{}),...(types[n]||{}),stage});}return Object.freeze({title,idField,prefix,stage,fields:Object.freeze(fields),required:Object.freeze(required),relationships:Object.freeze(relationships),fieldDefinitions:Object.freeze(defs),ownership:Object.freeze(ownership),appendOnly:commitPolicy===C.APPEND_ONLY,commitPolicy});}
function extend(base,extras){const fields=[...base.fields],defs={...base.fieldDefinitions},relationships={...(base.relationships||{})},own={human:[...base.ownership.human],humanDecision:[...base.ownership.humanDecision],agent:[...base.ownership.agent],application:[...base.ownership.application]};for(const [n,o] of Object.entries(extras)){if(fields.includes(n))continue;fields.push(n);own[o.owner].push(n);if(o.relationship)relationships[n]=o.relationship;const producer={human:P.HUMAN,humanDecision:P.HUMAN_DECISION,agent:P.AGENT,application:P.APPLICATION}[o.owner];defs[n]=field(n,producer,{...(o.relationship?{valueType:'REFERENCE'}:{}),...o});}return Object.freeze({...base,fields:Object.freeze(fields),relationships:Object.freeze(relationships),fieldDefinitions:Object.freeze(defs),ownership:Object.freeze(Object.fromEntries(Object.entries(own).map(([k,v])=>[k,Object.freeze(v)])))});}
function withRequired(base,names){return Object.freeze({...base,required:Object.freeze([...new Set([...(base.required||[]),...names])])});}
const truthTypes={TRUTH_VALUE:{enumValues:E.truth},EPISTEMIC_BASIS:{enumValues:E.basis},CURRENT_SCOPE_STATUS:{enumValues:E.scope},FRESHNESS_STATUS:{enumValues:E.fresh},CONTRADICTION_STATUS:{enumValues:E.contradiction},REASONS:{valueType:'STRING_ARRAY'},SUPPORTING_EVIDENCE_IDS:{valueType:'REFERENCE_ARRAY'}};
const epistemicFields=prefix=>({[`${prefix}TRUTH_VALUE`]:{owner:'application',enumValues:E.truth},[`${prefix}EPISTEMIC_BASIS`]:{owner:'application',enumValues:E.basis},[`${prefix}CURRENT_SCOPE_STATUS`]:{owner:'application',enumValues:E.scope},[`${prefix}FRESHNESS_STATUS`]:{owner:'application',enumValues:E.fresh},[`${prefix}CONTRADICTION_STATUS`]:{owner:'application',enumValues:E.contradiction},[`${prefix}REASONS`]:{owner:'application',valueType:'STRING_ARRAY'},[`${prefix}SUPPORTING_EVIDENCE_IDS`]:{owner:'application',valueType:'REFERENCE_ARRAY'},[`${prefix}DERIVATION_OR_REVIEW_IDS`]:{owner:'application',valueType:'REFERENCE_ARRAY'}});
const add={
propositions:rec({title:'Canonical propositions',idField:'PROPOSITION_ID',prefix:'PROPOSITION',stage:4,agent:['PROPOSITION_TEXT','SUBJECT_AND_SCOPE_DESCRIPTION','SATISFACTION_MEANING','FAILURE_MEANING'],application:['PROPOSITION_ID','REQUIREMENT_ID','CURRENT_SCOPE','CONTENT_SHA256','STATUS','TRUTH_VALUE','EPISTEMIC_BASIS','CURRENT_SCOPE_STATUS','FRESHNESS_STATUS','CONTRADICTION_STATUS','REASONS','SUPPORTING_EVIDENCE_IDS','DERIVATION_OR_REVIEW_IDS'],types:{...truthTypes,CURRENT_SCOPE:{valueType:'OBJECT'},DERIVATION_OR_REVIEW_IDS:{valueType:'REFERENCE_ARRAY'}},required:['PROPOSITION_TEXT','SUBJECT_AND_SCOPE_DESCRIPTION','SATISFACTION_MEANING','FAILURE_MEANING'],relationships:{REQUIREMENT_ID:'requirements'},commitPolicy:C.REPLACE_CURRENT_STAGE_SET}),
propositionEquivalenceReviews:rec({title:'Proposition equivalence reviews',idField:'PROP_EQ_REVIEW_ID',prefix:'PROP-EQ',stage:5,agent:['DISPOSITION','REASONING'],application:['PROP_EQ_REVIEW_ID','PROPOSITION_A_ID','PROPOSITION_B_ID','CURRENT_SCOPE','ACCEPTED_STATUS'],types:{DISPOSITION:{enumValues:E.coverage},CURRENT_SCOPE:{valueType:'OBJECT'}},relationships:{PROPOSITION_A_ID:'propositions',PROPOSITION_B_ID:'propositions'}}),
applicabilityRecords:rec({title:'Applicability records',idField:'APPLICABILITY_ID',prefix:'APPLICABILITY',stage:5,agent:['PROPOSED_APPLICABILITY','REASONING'],application:['APPLICABILITY_ID','SUBJECT_ID','SELECTED_APPLICABILITY','TRUTH_VALUE','EPISTEMIC_BASIS','CURRENT_SCOPE_STATUS','FRESHNESS_STATUS','CONTRADICTION_STATUS','REASONS','SUPPORTING_EVIDENCE_IDS'],types:{PROPOSED_APPLICABILITY:{enumValues:E.applicability},SELECTED_APPLICABILITY:{enumValues:E.applicability},...truthTypes},relationships:{SUBJECT_ID:'propositions'}}),
proofExpressions:rec({title:'Proof expressions',idField:'PROOF_EXPRESSION_ID',prefix:'PROOF-EXPR',stage:6,agent:['PROPOSED_EXPRESSION','SEMANTIC_RATIONALE'],application:['PROOF_EXPRESSION_ID','TARGET_PROPOSITION_ID','NORMALIZED_EXPRESSION','SEMANTIC_EQUIVALENCE_DISPOSITION','ACCEPTED_SEMANTIC_REVIEW_IDS','CURRENT_SCOPE_HASH','EVALUATION_STATUS'],types:{PROPOSED_EXPRESSION:{valueType:'OBJECT'},NORMALIZED_EXPRESSION:{valueType:'OBJECT'},SEMANTIC_EQUIVALENCE_DISPOSITION:{enumValues:E.coverage},ACCEPTED_SEMANTIC_REVIEW_IDS:{valueType:'REFERENCE_ARRAY'}},relationships:{TARGET_PROPOSITION_ID:'propositions'},commitPolicy:C.REPLACE_CURRENT_STAGE_SET}),
semanticCoverageReviews:rec({title:'Independent semantic coverage reviews',idField:'SEMANTIC_REVIEW_ID',prefix:'SEMANTIC-REVIEW',stage:6,agent:['SEMANTIC_COVERAGE_DISPOSITION','REASONING'],application:['SEMANTIC_REVIEW_ID','TARGET_KIND','TARGET_TEST_ID','TARGET_PROOF_EXPRESSION_ID','TARGET_SEMANTIC_HASH','AUTHOR_RAW_RESPONSE_ID','AUTHOR_CONTEXT_ID','AUTHOR_PROMPT_ID','REVIEWER_RAW_RESPONSE_ID','REVIEWER_CONTEXT_ID','REVIEWER_PROMPT_ID','OPERATION_RESERVATION_ID','PACKAGE_ID','APPLICATION_INPUT_ISOLATION','REVIEWER_CONTEXT_DISTINCT','RAW_RESPONSE_DISTINCT','CURRENT_SCOPE','CURRENT_SCOPE_HASH','ACCEPTED_STATUS','EPISTEMIC_BASIS','FRESHNESS_STATUS','INDEPENDENCE_REASONS'],types:{SEMANTIC_COVERAGE_DISPOSITION:{enumValues:E.coverage},TARGET_KIND:{enumValues:['TEST','PROOF_EXPRESSION']},REVIEWER_CONTEXT_DISTINCT:{valueType:'BOOLEAN'},RAW_RESPONSE_DISTINCT:{valueType:'BOOLEAN'},CURRENT_SCOPE:{valueType:'OBJECT'},APPLICATION_INPUT_ISOLATION:{enumValues:['APPLICATION_ESTABLISHED','UNKNOWN','VIOLATED']},ACCEPTED_STATUS:{enumValues:['ACCEPTED','BLOCKED','STALE','REJECTED']},EPISTEMIC_BASIS:{enumValues:E.basis},FRESHNESS_STATUS:{enumValues:E.fresh},INDEPENDENCE_REASONS:{valueType:'STRING_ARRAY'}},required:['SEMANTIC_COVERAGE_DISPOSITION','REASONING'],relationships:{TARGET_TEST_ID:'tests',TARGET_PROOF_EXPRESSION_ID:'proofExpressions',OPERATION_RESERVATION_ID:'operationReservations'},commitPolicy:C.APPEND_SCOPED}),
proofObligations:rec({title:'Proof obligations',idField:'PROOF_OBLIGATION_ID',prefix:'PROOF-OBLIGATION',stage:6,application:['PROOF_OBLIGATION_ID','PROPOSITION_ID','REQUIREMENT_ID','NORMATIVE_CLASS','APPLICABILITY','PROOF_EXPRESSION_ID','REQUIRED_TEST_IDS','REQUIRED_EVIDENCE_CLASSES','ALLOWED_EPISTEMIC_BASES','REQUIRED_ARTIFACT_IDS','REQUIRED_DEPENDENCY_IDS','FRESHNESS_REQUIREMENTS','INDEPENDENCE_REQUIREMENTS','SATISFACTION_STATE','BLOCKING_REASONS','CURRENT_SCOPE_HASH','PROOF_OBLIGATION_SET_HASH'],types:{NORMATIVE_CLASS:{enumValues:E.normative},APPLICABILITY:{enumValues:E.applicability},REQUIRED_TEST_IDS:{valueType:'REFERENCE_ARRAY'},REQUIRED_EVIDENCE_CLASSES:{valueType:'STRING_ARRAY'},ALLOWED_EPISTEMIC_BASES:{valueType:'STRING_ARRAY'},REQUIRED_ARTIFACT_IDS:{valueType:'REFERENCE_ARRAY'},REQUIRED_DEPENDENCY_IDS:{valueType:'REFERENCE_ARRAY'},FRESHNESS_REQUIREMENTS:{valueType:'OBJECT'},INDEPENDENCE_REQUIREMENTS:{valueType:'STRING_ARRAY'},BLOCKING_REASONS:{valueType:'STRING_ARRAY'}},relationships:{PROPOSITION_ID:'propositions',REQUIREMENT_ID:'requirements',PROOF_EXPRESSION_ID:'proofExpressions'},commitPolicy:C.APPLICATION_DERIVED}),
observationRecords:rec({title:'Observation records',idField:'OBSERVATION_ID',prefix:'OBSERVATION',human:['HUMAN_OBSERVED_VALUE'],agent:['EXTERNAL_OR_AGENT_OBSERVED_VALUE'],application:['OBSERVATION_ID','APPLICATION_OBSERVED_VALUE','OBSERVATION_ORIGIN','SUBMITTING_ACTOR_OR_RUNTIME','SUBJECT_ID','OBSERVED_LOCATION','METHOD_OR_TOOL_IDENTITY','INPUT_IDENTITIES_AND_HASHES','OUTPUT_IDENTITIES_AND_HASHES','EPISTEMIC_BASIS','FRESHNESS_STATUS','SOURCE_EVIDENCE_IDS','CURRENT_SCOPE','RAW_OR_NATIVE_PROVENANCE'],types:{OBSERVATION_ORIGIN:{enumValues:E.origin},EPISTEMIC_BASIS:{enumValues:E.basis},FRESHNESS_STATUS:{enumValues:E.fresh},INPUT_IDENTITIES_AND_HASHES:{valueType:'OBJECT_ARRAY'},OUTPUT_IDENTITIES_AND_HASHES:{valueType:'OBJECT_ARRAY'},SOURCE_EVIDENCE_IDS:{valueType:'REFERENCE_ARRAY'},CURRENT_SCOPE:{valueType:'OBJECT'}},relationships:{SUBJECT_ID:'tests'}}),
entailmentReviews:rec({title:'Entailment reviews',idField:'ENTAILMENT_ID',prefix:'ENTAILMENT',agent:['ENTAILMENT_FINDING','REASONING'],application:['ENTAILMENT_ID','OBSERVATION_ID','TARGET_PROPOSITION_ID','TARGET_LEAF_ID','ACCEPTED_RELATION','ACCEPTED_STATUS','CURRENT_SCOPE','GATE_CONSEQUENCE'],types:{ENTAILMENT_FINDING:{enumValues:E.entailment},ACCEPTED_RELATION:{enumValues:E.entailment},CURRENT_SCOPE:{valueType:'OBJECT'}},relationships:{OBSERVATION_ID:'observationRecords',TARGET_PROPOSITION_ID:'propositions'}}),
environmentDependencies:rec({title:'Environment dependencies',idField:'DEPENDENCY_ID',prefix:'DEPENDENCY',agent:['DEPENDENCY_DESCRIPTION','PROPOSED_REQUIRED_CONDITION','TARGET_PROPOSITION_IDS'],application:['DEPENDENCY_ID','CURRENT_SCOPE','VERSION_OR_CONDITION','TRUTH_VALUE','EPISTEMIC_BASIS','FRESHNESS_STATUS','AUTHENTICITY_STATUS','RELEASE_CONSEQUENCE'],types:{TARGET_PROPOSITION_IDS:{valueType:'REFERENCE_ARRAY'},TRUTH_VALUE:{enumValues:E.truth},EPISTEMIC_BASIS:{enumValues:E.basis},FRESHNESS_STATUS:{enumValues:E.fresh}}}),
operationReservations:rec({title:'Operation reservations',idField:'OPERATION_RESERVATION_ID',prefix:'RESERVATION',application:['OPERATION_RESERVATION_ID','JOB_ID','STAGE','OPERATION','TARGET_SLOT','PACKAGE_ID','PROMPT_ID','SCOPE','EXPECTED_REVISION','CHALLENGE_NONCE','STATUS','OWNING_TAB_INSTANCE','IDEMPOTENCY_KEY','PAYLOAD','PAYLOAD_HASH'],types:{STAGE:{valueType:'INTEGER'},SCOPE:{valueType:'OBJECT'},EXPECTED_REVISION:{valueType:'INTEGER'},PAYLOAD:{valueType:'OBJECT'},STATUS:{enumValues:E.reservation}},commitPolicy:C.UPDATE_RESERVED}),
backupRecords:rec({title:'Complete backup and restore-test records',idField:'BACKUP_ID',prefix:'BACKUP',stage:20,humanDecision:['UNENCRYPTED_SENSITIVE_EXPORT_ACKNOWLEDGED','HANDLING_DECISION_REASON','HUMAN_IDENTITY_ASSURANCE'],application:['BACKUP_ID','JOB_ID','CHECKPOINT_EVENT','PROJECT_REVISION','PROJECT_SHA256','CHECKPOINT_SHA256','ARTIFACT_MANIFEST_SHA256','ARTIFACT_SET_SHA256','ARTIFACT_IDS','ARTIFACT_BYTES_INCLUDED','PACKAGE_SHA256','PACKAGE_BLOB_SHA256','ENCRYPTION_STATUS','HANDLING_AUTHORIZATION_ID','RESTORE_TEST_STATUS','RESTORE_TEST_RECEIPT_ID','RESTORE_TEST_RECEIPT_SHA256','RESTORE_TESTED_AT_DEVICE_TIME','CURRENT_SCOPE','STATUS','APPLICATION_RECEIPT','BACKUP_RECORD_HASH'],types:{CHECKPOINT_EVENT:{enumValues:['BASELINE_APPROVAL','FINAL_DELIVERY']},PROJECT_REVISION:{valueType:'INTEGER'},ARTIFACT_IDS:{valueType:'REFERENCE_ARRAY'},ARTIFACT_BYTES_INCLUDED:{valueType:'BOOLEAN'},UNENCRYPTED_SENSITIVE_EXPORT_ACKNOWLEDGED:{valueType:'BOOLEAN'},HUMAN_IDENTITY_ASSURANCE:{enumValues:['SELF_ASSERTED','NOT_APPLICABLE']},ENCRYPTION_STATUS:{enumValues:['ENCRYPTED','UNENCRYPTED_ACKNOWLEDGED','NOT_REQUIRED']},RESTORE_TEST_STATUS:{enumValues:['PASSED','FAILED','NOT_RUN']},CURRENT_SCOPE:{valueType:'OBJECT'},STATUS:{enumValues:['CURRENT','STALE','SUPERSEDED','BLOCKED']}},relationships:{ARTIFACT_IDS:'artifacts'},commitPolicy:C.APPEND_SCOPED}),
deliveryRecords:rec({title:'Delivery records',idField:'DELIVERY_ID',prefix:'DELIVERY',stage:30,application:['DELIVERY_ID','JOB_ID','PRODUCT_ID','PRODUCT_VERSION','BASELINE_ID','RELEASE_ID','HASH_REVIEW_ID','EVIDENCE_CHAIN_VERSION','EVIDENCE_CHAIN_SET_SHA256','DEFECT_REGISTRY_VERSION','REGRESSION_REGISTRY_VERSION','REGISTRY_INTEGRITY_HASH','HUMAN_DELIVERY_AUTHORIZATION_ID','HUMAN_IDENTITY_ASSURANCE','AUTHORIZED_ARTIFACT_IDS','AUTHORIZED_FILENAMES','BYTE_SIZES','HASH_ALGORITHMS_AND_DIGESTS','EXPECTED_PRECONDITION_REVISION','COMMITTED_PROJECT_REVISION','TERMINAL_PROOF_OBLIGATION_SET_HASH','TERMINAL_EVIDENCE_HASH','DELIVERY_STATE','CONTROLLING_REASON','APPLICATION_RECEIPT','EVENT_SEQUENCE','DELIVERY_RECORD_HASH'],types:{AUTHORIZED_ARTIFACT_IDS:{valueType:'REFERENCE_ARRAY'},AUTHORIZED_FILENAMES:{valueType:'STRING_ARRAY'},BYTE_SIZES:{valueType:'STRING_ARRAY'},HASH_ALGORITHMS_AND_DIGESTS:{valueType:'OBJECT_ARRAY'},EXPECTED_PRECONDITION_REVISION:{valueType:'INTEGER'},COMMITTED_PROJECT_REVISION:{valueType:'INTEGER'},DELIVERY_STATE:{enumValues:E.delivery},EVENT_SEQUENCE:{valueType:'INTEGER'}},relationships:{PRODUCT_ID:'products',BASELINE_ID:'baselines',RELEASE_ID:'releaseRecords'},commitPolicy:C.APPLICATION_DERIVED}),
deploymentManifests:rec({title:'Deployment manifests',idField:'DEPLOYMENT_MANIFEST_ID',prefix:'DEPLOYMENT',application:['DEPLOYMENT_MANIFEST_ID','SOURCE_COMMIT','WORKFLOW_RUN_ID','BUILD_IDENTITY','CANONICALIZATION_VERSION','RUNTIME_RESOURCES','CSP_IDENTITY','DEPENDENCY_TOOLCHAIN_IDENTITY','BUILD_COMMAND','BUILD_ENVIRONMENT_IDENTITY','MANIFEST_DIGEST','VERIFIED_DIGEST_COMPARISON','DEPLOYED_RESOURCE_STATUS'],types:{RUNTIME_RESOURCES:{valueType:'OBJECT_ARRAY'}},commitPolicy:C.APPEND_ONLY}),
disclosureAuthorizations:rec({title:'Disclosure authorizations',idField:'DISCLOSURE_AUTHORIZATION_ID',prefix:'DISCLOSURE-AUTHORIZATION',humanDecision:['DISCLOSURE_DECISION','RECIPIENT_OR_PROVIDER','RECIPIENT_SUITABILITY_DECISION','PURPOSE_AND_LIMITS','EFFECTIVE_PERIOD_DECISION','DECISION_REASON'],application:['DISCLOSURE_AUTHORIZATION_ID','JOB_ID','ARTIFACT_IDS','DISCLOSURE_CLASSIFICATIONS','CURRENT_SCOPE','PROJECT_REVISION','STATUS','AUTHORIZATION_HASH','HUMAN_IDENTITY_ASSURANCE','DECISION_EVENT_ID','EVENT_SEQUENCE'],types:{DISCLOSURE_DECISION:{enumValues:['AUTHORIZE','DENY','REVOKE']},RECIPIENT_SUITABILITY_DECISION:{enumValues:['SUITABLE','NOT_SUITABLE','UNKNOWN']},ARTIFACT_IDS:{valueType:'REFERENCE_ARRAY'},DISCLOSURE_CLASSIFICATIONS:{valueType:'STRING_ARRAY'},CURRENT_SCOPE:{valueType:'OBJECT'},PROJECT_REVISION:{valueType:'INTEGER'},STATUS:{enumValues:['ACTIVE','DENIED','REVOKED','SUPERSEDED','STALE']},HUMAN_IDENTITY_ASSURANCE:{enumValues:['SELF_ASSERTED']},EVENT_SEQUENCE:{valueType:'INTEGER'}},required:['DISCLOSURE_DECISION','RECIPIENT_OR_PROVIDER','RECIPIENT_SUITABILITY_DECISION','PURPOSE_AND_LIMITS','DECISION_REASON'],commitPolicy:C.APPEND_SCOPED})};
const RS={...s0.RECORD_SCHEMAS,...add};RS.tests=extend(RS.tests,{TEST_PROPOSITION_TEXT:{owner:'agent'},TARGET_PROPOSITION_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},TESTED_SCOPE:{owner:'agent'},POSITIVE_RESULT_MEANING:{owner:'agent'},NEGATIVE_RESULT_MEANING:{owner:'agent'},SEMANTIC_COVERAGE_DISPOSITION:{owner:'agent',enumValues:E.coverage},SEMANTIC_REVIEW_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},TEST_ROLE:{owner:'agent',enumValues:E.role},RELEASE_BEARING:{owner:'application',valueType:'BOOLEAN'},EXPECTED_VARIANCE_CONTRACT:{owner:'agent',valueType:'OBJECT'}});
RS.propositions=extend(RS.propositions,{ACTIVATION_PROPOSITION_ID:{owner:'application',relationship:'propositions',nullable:true}});
RS.sourceSearchAdequacyReviews=rec({title:'Independent source-search adequacy reviews',idField:'SEARCH_ADEQUACY_REVIEW_ID',prefix:'SEARCH-ADEQUACY-REVIEW',stage:2,agent:['ADEQUACY_FINDING','REASONING'],application:['SEARCH_ADEQUACY_REVIEW_ID','SOURCE_SEARCH_CONTRACT_ID','SOURCE_SEARCH_CONTRACT_HASH','AUTHOR_RAW_RESPONSE_ID','AUTHOR_CONTEXT_ID','AUTHOR_PROMPT_ID','REVIEWER_RAW_RESPONSE_ID','REVIEWER_CONTEXT_ID','REVIEWER_PROMPT_ID','OPERATION_RESERVATION_ID','PACKAGE_ID','APPLICATION_INPUT_ISOLATION','REVIEWER_CONTEXT_DISTINCT','RAW_RESPONSE_DISTINCT','CURRENT_SCOPE','CURRENT_SCOPE_HASH','ACCEPTED_STATUS','EPISTEMIC_BASIS','FRESHNESS_STATUS','INDEPENDENCE_REASONS','SUPPORTING_EVIDENCE_IDS'],types:{ADEQUACY_FINDING:{enumValues:['ADEQUATE','PARTIAL','UNKNOWN','INADEQUATE']},REVIEWER_CONTEXT_DISTINCT:{valueType:'BOOLEAN'},RAW_RESPONSE_DISTINCT:{valueType:'BOOLEAN'},CURRENT_SCOPE:{valueType:'OBJECT'},APPLICATION_INPUT_ISOLATION:{enumValues:['APPLICATION_ESTABLISHED','UNKNOWN','VIOLATED']},ACCEPTED_STATUS:{enumValues:['ACCEPTED','BLOCKED','STALE','REJECTED']},EPISTEMIC_BASIS:{enumValues:E.basis},FRESHNESS_STATUS:{enumValues:E.fresh},INDEPENDENCE_REASONS:{valueType:'STRING_ARRAY'},SUPPORTING_EVIDENCE_IDS:{valueType:'REFERENCE_ARRAY'}},required:['ADEQUACY_FINDING','REASONING'],relationships:{OPERATION_RESERVATION_ID:'operationReservations'},commitPolicy:C.APPEND_SCOPED});
RS.requirementCompilationChallengeReviews=rec({title:'Independent requirement-compilation challenge reviews',idField:'REQUIREMENT_CHALLENGE_REVIEW_ID',prefix:'REQUIREMENT-CHALLENGE-REVIEW',stage:4,agent:['CHALLENGE_KIND','FINDING','REASONING'],application:['REQUIREMENT_CHALLENGE_REVIEW_ID','TARGET_OBLIGATION_IDS','TARGET_REQUIREMENT_IDS','TARGET_HASH','CHALLENGE_BATCH_HASH','AUTHOR_RAW_RESPONSE_ID','AUTHOR_CONTEXT_ID','AUTHOR_PROMPT_ID','REVIEWER_RAW_RESPONSE_ID','REVIEWER_CONTEXT_ID','REVIEWER_PROMPT_ID','OPERATION_RESERVATION_ID','PACKAGE_ID','APPLICATION_INPUT_ISOLATION','REVIEWER_CONTEXT_DISTINCT','RAW_RESPONSE_DISTINCT','CURRENT_SCOPE','CURRENT_SCOPE_HASH','ACCEPTED_STATUS','EPISTEMIC_BASIS','FRESHNESS_STATUS','INDEPENDENCE_REASONS','SUPPORTING_EVIDENCE_IDS'],types:{CHALLENGE_KIND:{enumValues:['DISPOSITION','ATOMICITY']},FINDING:{enumValues:['ACCEPTED','CORRECTION_REQUIRED','UNKNOWN']},TARGET_OBLIGATION_IDS:{valueType:'STRING_ARRAY'},TARGET_REQUIREMENT_IDS:{valueType:'REFERENCE_ARRAY'},REVIEWER_CONTEXT_DISTINCT:{valueType:'BOOLEAN'},RAW_RESPONSE_DISTINCT:{valueType:'BOOLEAN'},CURRENT_SCOPE:{valueType:'OBJECT'},APPLICATION_INPUT_ISOLATION:{enumValues:['APPLICATION_ESTABLISHED','UNKNOWN','VIOLATED']},ACCEPTED_STATUS:{enumValues:['ACCEPTED','BLOCKED','STALE','REJECTED']},EPISTEMIC_BASIS:{enumValues:E.basis},FRESHNESS_STATUS:{enumValues:E.fresh},INDEPENDENCE_REASONS:{valueType:'STRING_ARRAY'},SUPPORTING_EVIDENCE_IDS:{valueType:'REFERENCE_ARRAY'}},required:['CHALLENGE_KIND','FINDING','REASONING'],relationships:{OPERATION_RESERVATION_ID:'operationReservations'},commitPolicy:C.APPEND_SCOPED});
RS.tests=extend(RS.tests,epistemicFields('CAPABILITY_'));
RS.observationRecords=extend(RS.observationRecords,{ATTESTATION_CONTRACT_ID:{owner:'application'},ATTESTATION_PAYLOAD_SHA256:{owner:'application'},ATTESTATION_SIGNATURE_SHA256:{owner:'application'},ATTESTATION_PUBLIC_KEY_SHA256:{owner:'application'},ATTESTATION_VERIFICATION_STATUS:{owner:'application',enumValues:['VERIFIED','INVALID','NOT_APPLICABLE']}});
RS.entailmentReviews=extend(RS.entailmentReviews,{OBJECTIVE_ATTESTATION_ID:{owner:'application'},ATTESTATION_PAYLOAD_SHA256:{owner:'application'}});
RS.tests=withRequired(RS.tests,['TEST_PROPOSITION_TEXT','TESTED_SCOPE','POSITIVE_RESULT_MEANING','NEGATIVE_RESULT_MEANING','SEMANTIC_COVERAGE_DISPOSITION','TEST_ROLE','EXPECTED_VARIANCE_CONTRACT']);
RS.propositions=extend(RS.propositions,{CURRENT_SCOPE:{owner:'application',valueType:'OBJECT'},STATUS:{owner:'application',enumValues:['SATISFIED','VIOLATED','UNDETERMINED','BLOCKED']}});
RS.propositionEquivalenceReviews=extend(RS.propositionEquivalenceReviews,{EQUIVALENCE_CLASS_ID:{owner:'application'},TRUTH_VALUE:{owner:'application',enumValues:E.truth},EPISTEMIC_BASIS:{owner:'application',enumValues:E.basis},CURRENT_SCOPE_STATUS:{owner:'application',enumValues:E.scope},FRESHNESS_STATUS:{owner:'application',enumValues:E.fresh},CONTRADICTION_STATUS:{owner:'application',enumValues:E.contradiction},REASONS:{owner:'application',valueType:'STRING_ARRAY'},SUPPORTING_EVIDENCE_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},DERIVATION_OR_REVIEW_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'}});
RS.propositionEquivalenceReviews=withRequired(RS.propositionEquivalenceReviews,['DISPOSITION','REASONING']);
RS.applicabilityRecords=extend(RS.applicabilityRecords,{CURRENT_SCOPE:{owner:'application',valueType:'OBJECT'},DERIVATION_OR_REVIEW_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'}});
RS.applicabilityRecords=withRequired(RS.applicabilityRecords,['PROPOSED_APPLICABILITY','REASONING']);
RS.proofExpressions=extend(RS.proofExpressions,{CURRENT_SCOPE:{owner:'application',valueType:'OBJECT'},TRUTH_VALUE:{owner:'application',enumValues:E.truth},CONTRADICTION_STATUS:{owner:'application',enumValues:E.contradiction},REASONS:{owner:'application',valueType:'STRING_ARRAY'}});
RS.proofExpressions=withRequired(RS.proofExpressions,['PROPOSED_EXPRESSION','SEMANTIC_RATIONALE']);
RS.proofObligations=extend(RS.proofObligations,{ACTIVATION_PROPOSITION_ID:{owner:'application',relationship:'propositions'},REQUIRED_OBSERVATION_LEAF_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},REQUIRED_RUN_DIMENSIONS:{owner:'application',valueType:'STRING_ARRAY'},CURRENT_SCOPE:{owner:'application',valueType:'OBJECT'},TRUTH_VALUE:{owner:'application',enumValues:E.truth},EPISTEMIC_BASIS:{owner:'application',enumValues:E.basis},CURRENT_SCOPE_STATUS:{owner:'application',enumValues:E.scope},FRESHNESS_STATUS:{owner:'application',enumValues:E.fresh},CONTRADICTION_STATUS:{owner:'application',enumValues:E.contradiction},REASONS:{owner:'application',valueType:'STRING_ARRAY'},SUPPORTING_EVIDENCE_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},DERIVATION_OR_REVIEW_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'}});
RS.observationRecords=extend(RS.observationRecords,{EXTERNAL_OBSERVED_LOCATION:{owner:'agent'},EXTERNAL_METHOD_OR_TOOL_IDENTITY:{owner:'agent'},EXTERNAL_ATTRIBUTION_DETAILS:{owner:'agent',valueType:'OBJECT'},HUMAN_OBSERVED_LOCATION:{owner:'human'},SUBJECT_KIND:{owner:'application',enumValues:['ARTIFACT','SPECIMEN','RECORD','RUN','TEST','PRODUCT','ENVIRONMENT','EXTERNAL_SYSTEM','HUMAN_TASK','OTHER']},ATTRIBUTION_BASIS:{owner:'application',enumValues:E.basis},INPUT_BINDING_BASIS:{owner:'application',enumValues:['NATIVE_APPLICATION_BOUND','VERIFIED_TOOL_ATTESTED','TOOL_GENERATED_UNVERIFIED','EXTERNALLY_SUPPORTED','SELF_ASSERTED','UNKNOWN','MISMATCHED']},EVIDENCE_BASIS:{owner:'application',enumValues:E.basis},UNRESOLVED_EXTERNAL_ASSUMPTIONS:{owner:'application',valueType:'STRING_ARRAY'},CURRENT_SCOPE_STATUS:{owner:'application',enumValues:E.scope},CONTRADICTION_STATUS:{owner:'application',enumValues:E.contradiction},REASONS:{owner:'application',valueType:'STRING_ARRAY'},OBSERVED_AT:{owner:'application'},OBSERVED_AT_BASIS:{owner:'application',enumValues:['DEVICE_REPORTED','SOURCE_ASSERTED','VERIFIED_EXTERNAL']},VALID_FROM:{owner:'application',nullable:true},VALID_UNTIL:{owner:'application',nullable:true},SUPERSEDED_BY:{owner:'application',nullable:true},FRESHNESS_REQUIREMENT:{owner:'application',valueType:'OBJECT'},FRESHNESS_EVALUATION_REASON:{owner:'application'}});
RS.observationRecords=Object.freeze({...RS.observationRecords,requiredByOrigin:Object.freeze({NATIVE_APPLICATION_OBSERVATION:Object.freeze(['APPLICATION_OBSERVED_VALUE','OBSERVED_LOCATION','METHOD_OR_TOOL_IDENTITY']),VERIFIED_EXTERNAL_OBSERVATION:Object.freeze(['EXTERNAL_OR_AGENT_OBSERVED_VALUE','EXTERNAL_OBSERVED_LOCATION','EXTERNAL_METHOD_OR_TOOL_IDENTITY']),EXTERNAL_CLAIM:Object.freeze(['EXTERNAL_OR_AGENT_OBSERVED_VALUE','EXTERNAL_OBSERVED_LOCATION','EXTERNAL_METHOD_OR_TOOL_IDENTITY']),AGENT_SEMANTIC_OBSERVATION:Object.freeze(['EXTERNAL_OR_AGENT_OBSERVED_VALUE','EXTERNAL_OBSERVED_LOCATION']),HUMAN_OBSERVATION:Object.freeze(['HUMAN_OBSERVED_VALUE','HUMAN_OBSERVED_LOCATION'])})});
RS.entailmentReviews=extend(RS.entailmentReviews,{TRUTH_VALUE:{owner:'application',enumValues:E.truth},EPISTEMIC_BASIS:{owner:'application',enumValues:E.basis},CURRENT_SCOPE_STATUS:{owner:'application',enumValues:E.scope},FRESHNESS_STATUS:{owner:'application',enumValues:E.fresh},CONTRADICTION_STATUS:{owner:'application',enumValues:E.contradiction},REASONS:{owner:'application',valueType:'STRING_ARRAY'},SUPPORTING_EVIDENCE_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},DERIVATION_OR_REVIEW_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'}});
RS.entailmentReviews=withRequired(RS.entailmentReviews,['ENTAILMENT_FINDING','REASONING']);
RS.environmentDependencies=rec({title:'Environment dependencies',idField:'DEPENDENCY_ID',prefix:'DEPENDENCY',agent:['DEPENDENCY_DESCRIPTION','PROPOSED_REQUIRED_CONDITION'],application:['DEPENDENCY_ID','TARGET_PROPOSITION_IDS','CURRENT_SCOPE','VERSION_OR_CONDITION','TRUTH_VALUE','EPISTEMIC_BASIS','CURRENT_SCOPE_STATUS','FRESHNESS_STATUS','CONTRADICTION_STATUS','AUTHENTICITY_STATUS','RELEASE_CONSEQUENCE','REASONS','SUPPORTING_EVIDENCE_IDS','DERIVATION_OR_REVIEW_IDS','OBSERVED_AT','OBSERVED_AT_BASIS','VALID_FROM','VALID_UNTIL','SUPERSEDED_BY','FRESHNESS_REQUIREMENT','FRESHNESS_EVALUATION_REASON'],types:{TARGET_PROPOSITION_IDS:{valueType:'REFERENCE_ARRAY'},CURRENT_SCOPE:{valueType:'OBJECT'},TRUTH_VALUE:{enumValues:E.truth},EPISTEMIC_BASIS:{enumValues:E.basis},CURRENT_SCOPE_STATUS:{enumValues:E.scope},FRESHNESS_STATUS:{enumValues:E.fresh},CONTRADICTION_STATUS:{enumValues:E.contradiction},AUTHENTICITY_STATUS:{enumValues:['VERIFIED','EXTERNALLY_SUPPORTED','SELF_ASSERTED','UNKNOWN','CONTRADICTED']},REASONS:{valueType:'STRING_ARRAY'},SUPPORTING_EVIDENCE_IDS:{valueType:'REFERENCE_ARRAY'},DERIVATION_OR_REVIEW_IDS:{valueType:'REFERENCE_ARRAY'},OBSERVED_AT_BASIS:{enumValues:['DEVICE_REPORTED','SOURCE_ASSERTED','VERIFIED_EXTERNAL']},VALID_FROM:{nullable:true},VALID_UNTIL:{nullable:true},SUPERSEDED_BY:{nullable:true},FRESHNESS_REQUIREMENT:{valueType:'OBJECT'}},required:['DEPENDENCY_DESCRIPTION','PROPOSED_REQUIRED_CONDITION']});
RS.operationReservations=extend(RS.operationReservations,{CURRENT_SCOPE_STATUS:{owner:'application',enumValues:E.scope},PACKAGE_MANIFEST_HASH:{owner:'application'},VALIDITY_CONDITION:{owner:'application'},DISCLOSURE_CLASSIFICATION:{owner:'application',enumValues:E.disclosure},DISCLOSURE_AUTHORIZATION_BASIS:{owner:'application'},CREATED_BY_COMMAND_ID:{owner:'application'}});
RS.deliveryRecords=extend(RS.deliveryRecords,{TERMINAL_PREREQUISITE_HASHES:{owner:'application',valueType:'OBJECT'},CURRENT_SCOPE_STATUS:{owner:'application',enumValues:E.scope},CONTRADICTION_STATUS:{owner:'application',enumValues:E.contradiction},PREVIOUS_DELIVERY_ID:{owner:'application',relationship:'deliveryRecords',nullable:true},LIFECYCLE_CHANGE_ID:{owner:'application',nullable:true}});
RS.deploymentManifests=extend(RS.deploymentManifests,{SCHEMA:{owner:'application',enumValues:['closed-loop-deployment-manifest/1']},HASH_ALGORITHM:{owner:'application',enumValues:['SHA-256']},CANONICAL_BYTE_LENGTH:{owner:'application',valueType:'INTEGER'},WORKFLOW_FILE_DIGEST:{owner:'application'},TOOL_VERSIONS:{owner:'application',valueType:'OBJECT'},DEPENDENCY_INTEGRITY_VALUES:{owner:'application',valueType:'OBJECT'},REPRODUCIBILITY_STATUS:{owner:'application',enumValues:['REPRODUCIBLE','NONREPRODUCIBLE','UNKNOWN']},SUPPLY_CHAIN_EVIDENCE_LEVEL:{owner:'application',enumValues:E.basis}});
RS.sources=extend(RS.sources,{BYTE_IDENTITY_STATUS:{owner:'application'},CLAIMED_PUBLISHER_IDENTITY:{owner:'agent'},RETRIEVAL_LOCATION:{owner:'agent'},RETRIEVAL_METHOD:{owner:'agent'},AUTHENTICITY_BASIS:{owner:'application',enumValues:E.basis},AUTHENTICITY_STATUS:{owner:'application',enumValues:['VERIFIED','EXTERNALLY_SUPPORTED','SELF_ASSERTED','UNKNOWN','CONTRADICTED']},AUTHORITY_CLASSIFICATION:{owner:'agent'},FRESHNESS_STATUS:{owner:'application',enumValues:E.fresh},TRUTH_VALUE:{owner:'application',enumValues:E.truth},CURRENT_SCOPE_STATUS:{owner:'application',enumValues:E.scope},CONTRADICTION_STATUS:{owner:'application',enumValues:E.contradiction},REASONS:{owner:'application',valueType:'STRING_ARRAY'},SUPPORTING_EVIDENCE_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},DERIVATION_OR_REVIEW_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'}});
RS.sources=extend(RS.sources,{OBSERVED_AT:{owner:'application'},OBSERVED_AT_BASIS:{owner:'application',enumValues:['DEVICE_REPORTED','SOURCE_ASSERTED','VERIFIED_EXTERNAL']},VALID_FROM:{owner:'application',nullable:true},VALID_UNTIL:{owner:'application',nullable:true},SUPERSEDED_BY:{owner:'application',nullable:true},FRESHNESS_REQUIREMENT:{owner:'application',valueType:'OBJECT'},FRESHNESS_EVALUATION_REASON:{owner:'application'}});
RS.artifacts=extend(RS.artifacts,{RAW_FILENAME:{owner:'application'},DISPLAY_FILENAME:{owner:'application'},CANONICAL_PATH:{owner:'application'},FILENAME_NORMALIZATION_VERSION:{owner:'application'},COLLISION_KEYS:{owner:'application',valueType:'OBJECT'},AUTHORIZED_DELIVERY_FILENAME:{owner:'application'},DISCLOSURE_CLASSIFICATION:{owner:'application',enumValues:E.disclosure},DECLARED_MEDIA_TYPE:{owner:'application'},DETECTED_FORMAT:{owner:'application'},PARSER_ADAPTER_IDENTITY:{owner:'application'},PARSE_CONTRACT:{owner:'application'},POLYGLOT_STATUS:{owner:'application'},HASH_ALGORITHM:{owner:'application',enumValues:['SHA-256']},DIGEST:{owner:'application'},RAW_BYTE_LENGTH:{owner:'application',valueType:'INTEGER'}});
RS.failureTests=extend(RS.failureTests,{AVAILABILITY_CLASS:{owner:'agent',enumValues:['EXECUTABLE_NOW','DEFERRED_TARGET_DEPENDENT','NOT_APPLICABLE','BLOCKED']},DEFERRED_EXECUTION_TRIGGER_STAGE:{owner:'agent',valueType:'INTEGER'},DEFERRED_EXECUTION_PLAN:{owner:'agent',valueType:'OBJECT'},PROOF_OBLIGATION_ID:{owner:'application',relationship:'proofObligations'},OBSERVATION_ID:{owner:'application',relationship:'observationRecords'},ENTAILMENT_ID:{owner:'application',relationship:'entailmentReviews'}});
RS.instructions=extend(RS.instructions,{ENVIRONMENT_DEPENDENCY_INSTRUCTIONS:{owner:'agent'},DISCLOSURE_AND_SECRET_HANDLING_RULES:{owner:'agent'},DEFERRED_NEGATIVE_TEST_TRACE_RECORDS:{owner:'agent',valueType:'OBJECT_ARRAY'}});
RS.preflightRecords=extend(RS.preflightRecords,{INDEPENDENCE_DIMENSIONS:{owner:'application',valueType:'OBJECT',closedProperties:['APPLICATION_SESSION_DISTINCTNESS','APPLICATION_INPUT_ISOLATION','USER_TRANSFER_CONFORMITY','EXTERNAL_CONTEXT_IDENTIFIER_DISTINCTNESS','PROVIDER_CONTEXT_INDEPENDENCE','EXECUTOR_OR_REVIEWER_ROLE_SEPARATION','ENVIRONMENT_INDEPENDENCE']},PROVIDER_CONTEXT_INDEPENDENCE_STATUS:{owner:'application'},APPLICATION_INPUT_ISOLATION_STATUS:{owner:'application'},ENVIRONMENT_ASSUMPTION_FINDINGS:{owner:'agent',valueType:'OBJECT_ARRAY'},PROOF_OBLIGATION_TRACE_FINDINGS:{owner:'agent',valueType:'OBJECT_ARRAY'},DISCLOSURE_FINDINGS:{owner:'agent',valueType:'OBJECT_ARRAY'},...epistemicFields('INDEPENDENCE_')});
RS.candidateFreezes=extend(RS.candidateFreezes,{PROOF_OBLIGATION_SET_ID:{owner:'application'},ENVIRONMENT_MANIFEST_ID:{owner:'application'},EXTERNAL_DEPENDENCY_SET_ID:{owner:'application'},DISCLOSURE_POLICY_ID:{owner:'application'},FREEZE_INTEGRITY_BASIS:{owner:'application',enumValues:E.basis},EXTERNAL_CHECKPOINT_ID:{owner:'application'}});
RS.runs=extend(RS.runs,{APPLICATION_SESSION_DISTINCTNESS:{owner:'application'},APPLICATION_INPUT_ISOLATION:{owner:'application'},USER_TRANSFER_CONFORMITY:{owner:'application'},PROVIDER_CONTEXT_INDEPENDENCE:{owner:'application'},INDEPENDENCE_LIMITATIONS:{owner:'application',valueType:'STRING_ARRAY'},ENVIRONMENT_MANIFEST_ID:{owner:'application'},EXPECTED_VARIANCE_CONTRACT_ID:{owner:'application'},OPERATION_RESERVATION_ID:{owner:'application',relationship:'operationReservations'},PACKAGE_ID:{owner:'application'},CHALLENGE_NONCE:{owner:'application'},INPUT_BINDING_BASIS:{owner:'application',enumValues:['NATIVE_APPLICATION_BOUND','VERIFIED_TOOL_ATTESTED','TOOL_GENERATED_UNVERIFIED','EXTERNALLY_SUPPORTED','SELF_ASSERTED','UNKNOWN','MISMATCHED']},...epistemicFields('INDEPENDENCE_')});
RS.verification=extend(RS.verification,{PROPOSITION_ID:{owner:'application',relationship:'propositions'},OBSERVATION_ID:{owner:'application',relationship:'observationRecords'},ENTAILMENT_ID:{owner:'application',relationship:'entailmentReviews'},EPISTEMIC_BASIS:{owner:'application',enumValues:E.basis},FRESHNESS_STATUS:{owner:'application',enumValues:E.fresh},INDEPENDENCE_DIMENSIONS:{owner:'application',valueType:'OBJECT',closedProperties:['APPLICATION_SESSION_DISTINCTNESS','APPLICATION_INPUT_ISOLATION','USER_TRANSFER_CONFORMITY','EXTERNAL_CONTEXT_IDENTIFIER_DISTINCTNESS','PROVIDER_CONTEXT_INDEPENDENCE','EXECUTOR_OR_REVIEWER_ROLE_SEPARATION','ENVIRONMENT_INDEPENDENCE']},INPUT_BINDING_BASIS:{owner:'application',enumValues:['NATIVE_APPLICATION_BOUND','VERIFIED_TOOL_ATTESTED','TOOL_GENERATED_UNVERIFIED','EXTERNALLY_SUPPORTED','SELF_ASSERTED','UNKNOWN','MISMATCHED']},...epistemicFields('INDEPENDENCE_')});
RS.comparisons=extend(RS.comparisons,{PROPOSITION_ID:{owner:'application',relationship:'propositions'},EXPECTED_VARIANCE_CONTRACT_ID:{owner:'application'},ALLOWED_VARIANCES:{owner:'application',valueType:'OBJECT_ARRAY'},PROHIBITED_VARIANCES:{owner:'application',valueType:'OBJECT_ARRAY'},UNKNOWN_VARIANCES:{owner:'application',valueType:'OBJECT_ARRAY'},ENVIRONMENT_DIFFERENCE_RECORDS:{owner:'application',valueType:'OBJECT_ARRAY'},PROPOSITION_STABILITY:{owner:'application',valueType:'OBJECT'}});
RS.defects=extend(RS.defects,{AFFECTED_PROPOSITION_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},AFFECTED_PROOF_OBLIGATION_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},PROPOSED_SEVERITY:{owner:'agent',enumValues:['CRITICAL','MAJOR','MINOR','UNKNOWN']},SEVERITY_REVIEW_ID:{owner:'application'},ACCEPTED_SEVERITY:{owner:'application',enumValues:['CRITICAL','MAJOR','MINOR','UNKNOWN']},SEVERITY_DISPUTE_STATUS:{owner:'application'},PROPOSED_MATERIALITY:{owner:'agent',enumValues:['MATERIAL','NONMATERIAL','UNKNOWN']},ACCEPTED_MATERIALITY:{owner:'application',enumValues:['MATERIAL','NONMATERIAL','UNKNOWN']},MATERIALITY_REVIEW_ID:{owner:'application'},MATERIALITY_REASONING:{owner:'agent'},MATERIALITY_EVIDENCE_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'}});
RS.regressions=extend(RS.regressions,{PROPOSITION_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},PROOF_OBLIGATION_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},PRE_CORRECTION_OBSERVATION_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},PRE_CORRECTION_ENTAILMENT_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},POST_CORRECTION_OBSERVATION_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},POST_CORRECTION_ENTAILMENT_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},LIFECYCLE_STATUS:{owner:'application',enumValues:['ACTIVE','SUPERSEDED','RETIRED']},RETIREMENT_AUTHORITY_AND_EVIDENCE:{owner:'application',valueType:'OBJECT'}});
RS.changes=extend(RS.changes,{CORRECTION_SET_ID:{owner:'application'},AFFECTED_RECORD_FAMILIES:{owner:'application',valueType:'STRING_ARRAY'},EARLIEST_RESPONSIBLE_STAGE:{owner:'application',valueType:'INTEGER'},RESPONSIBLE_STAGE_MAP_VERSION:{owner:'application'},ATOMIC_CHANGE_MEMBERS:{owner:'application',valueType:'REFERENCE_ARRAY'},PROOF_OBLIGATIONS_INVALIDATED:{owner:'application',valueType:'REFERENCE_ARRAY'},DELIVERY_RECORDS_SUPERSEDED_OR_WITHDRAWN:{owner:'application',valueType:'REFERENCE_ARRAY'}});
RS.confirmationRecords=extend(RS.confirmationRecords,{CONFIRMATION_REQUIREMENT_CHALLENGE_COMPLETED:{owner:'application',valueType:'BOOLEAN'},NEW_REQUIREMENT_CANDIDATES_FOUND:{owner:'application',valueType:'INTEGER'},NEW_REQUIREMENT_CANDIDATE_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},CHALLENGE_SCOPE:{owner:'application',valueType:'OBJECT'},CHALLENGE_EPISTEMIC_BASIS:{owner:'application',enumValues:E.basis},PROVIDER_CONTEXT_INDEPENDENCE_SUMMARY:{owner:'application',valueType:'OBJECT'},ENVIRONMENT_COMPARABILITY_SUMMARY:{owner:'application',valueType:'OBJECT'}});
RS.baselines=extend(RS.baselines,{PROOF_OBLIGATION_SET_ID:{owner:'application'},ENVIRONMENT_DEPENDENCY_SET_ID:{owner:'application'},BACKUP_CHECKPOINT_ID:{owner:'application'},BASELINE_INTEGRITY_BASIS:{owner:'application',enumValues:E.basis},BASELINE_EXTERNAL_AUTHENTICATION_STATUS:{owner:'application',enumValues:['VERIFIED','EXTERNALLY_SUPPORTED','SELF_ASSERTED','UNKNOWN','CONTRADICTED']}});
RS.products=extend(RS.products,{PRODUCT_ENVIRONMENT_MANIFEST_ID:{owner:'application'},PRODUCT_EXTERNAL_DEPENDENCY_SET_ID:{owner:'application'},PRODUCT_DISCLOSURE_CLASSIFICATION:{owner:'application',enumValues:E.disclosure},PACKAGE_ID:{owner:'application'},OPERATION_RESERVATION_ID:{owner:'application',relationship:'operationReservations'},CHALLENGE_NONCE:{owner:'application'},INPUT_BINDING_BASIS:{owner:'application',enumValues:['NATIVE_APPLICATION_BOUND','VERIFIED_TOOL_ATTESTED','TOOL_GENERATED_UNVERIFIED','EXTERNALLY_SUPPORTED','SELF_ASSERTED','UNKNOWN','MISMATCHED']}});
RS.deterministicResults=extend(RS.deterministicResults,{PROPOSITION_ID:{owner:'application',relationship:'propositions'},PROOF_OBLIGATION_ID:{owner:'application',relationship:'proofObligations'},OBSERVATION_ORIGIN:{owner:'application',enumValues:E.origin},OBSERVATION_ID:{owner:'application',relationship:'observationRecords'},ENTAILMENT_ID:{owner:'application',relationship:'entailmentReviews'},EPISTEMIC_BASIS:{owner:'application',enumValues:E.basis},INPUT_BINDING_BASIS:{owner:'application',enumValues:['NATIVE_APPLICATION_BOUND','VERIFIED_TOOL_ATTESTED','TOOL_GENERATED_UNVERIFIED','EXTERNALLY_SUPPORTED','SELF_ASSERTED','UNKNOWN','MISMATCHED']},RUNTIME_BUILD_IDENTITY:{owner:'application'},TEST_WORKER_SHA256:{owner:'application'},WORKER_PROTOCOL_VERSION:{owner:'application'},PARSER_OR_ADAPTER_IDENTITIES:{owner:'application',valueType:'STRING_ARRAY'},ENVIRONMENT_MANIFEST_ID:{owner:'application'},FRESHNESS_STATUS:{owner:'application',enumValues:E.fresh}});
RS.meaningResults=extend(RS.meaningResults,{PROPOSITION_ID:{owner:'application',relationship:'propositions'},OBSERVATION_ID:{owner:'application',relationship:'observationRecords'},ENTAILMENT_ID:{owner:'application',relationship:'entailmentReviews'},EPISTEMIC_BASIS:{owner:'application',enumValues:E.basis},FRESHNESS_STATUS:{owner:'application',enumValues:E.fresh},INDEPENDENCE_DIMENSIONS:{owner:'application',valueType:'OBJECT',closedProperties:['APPLICATION_SESSION_DISTINCTNESS','APPLICATION_INPUT_ISOLATION','USER_TRANSFER_CONFORMITY','EXTERNAL_CONTEXT_IDENTIFIER_DISTINCTNESS','PROVIDER_CONTEXT_INDEPENDENCE','EXECUTOR_OR_REVIEWER_ROLE_SEPARATION','ENVIRONMENT_INDEPENDENCE']},BLINDNESS_DIMENSIONS:{owner:'application',valueType:'OBJECT'},RESIDUAL_CONTEXT_RISK:{owner:'application'},...epistemicFields('INDEPENDENCE_')});
RS.adversarialResults=extend(RS.adversarialResults,{TARGET_PROPOSITION_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},TARGET_PROOF_OBLIGATION_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},TARGET_REGRESSION_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},OBSERVATION_ID:{owner:'application',relationship:'observationRecords'},ENTAILMENT_ID:{owner:'application',relationship:'entailmentReviews'},EPISTEMIC_BASIS:{owner:'application',enumValues:E.basis},BLINDNESS_DIMENSIONS:{owner:'application',valueType:'OBJECT'},INDEPENDENCE_DIMENSIONS:{owner:'application',valueType:'OBJECT',closedProperties:['APPLICATION_SESSION_DISTINCTNESS','APPLICATION_INPUT_ISOLATION','USER_TRANSFER_CONFORMITY','EXTERNAL_CONTEXT_IDENTIFIER_DISTINCTNESS','PROVIDER_CONTEXT_INDEPENDENCE','EXECUTOR_OR_REVIEWER_ROLE_SEPARATION','ENVIRONMENT_INDEPENDENCE']},...epistemicFields('INDEPENDENCE_')});
RS.evidenceRecords=extend(RS.evidenceRecords,{OBSERVATION_ID:{owner:'application',relationship:'observationRecords'},OBSERVATION_ORIGIN:{owner:'application',enumValues:E.origin},EPISTEMIC_BASIS:{owner:'application',enumValues:E.basis},CURRENT_SCOPE_STATUS:{owner:'application',enumValues:E.scope},FRESHNESS_STATUS:{owner:'application',enumValues:E.fresh},CONTRADICTION_STATUS:{owner:'application',enumValues:E.contradiction},REASONS:{owner:'application',valueType:'STRING_ARRAY'},DERIVATION_OR_REVIEW_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'}});
RS.representationInspections=extend(RS.representationInspections,{INSPECTION_RESERVATION_ID:{owner:'application',relationship:'operationReservations'},INSPECTED_ARTIFACT_SHA256:{owner:'application'},VIEWER_IDENTITY_AND_VERSION:{owner:'application'},OBSERVATION_ID:{owner:'application',relationship:'observationRecords'},ENTAILMENT_ID:{owner:'application',relationship:'entailmentReviews'},INPUT_BINDING_BASIS:{owner:'application',enumValues:['NATIVE_APPLICATION_BOUND','VERIFIED_TOOL_ATTESTED','TOOL_GENERATED_UNVERIFIED','EXTERNALLY_SUPPORTED','SELF_ASSERTED','UNKNOWN','MISMATCHED']},HUMAN_IDENTITY_ASSURANCE:{owner:'application',enumValues:['SELF_ASSERTED']}});
RS.processAudits=extend(RS.processAudits,{PROOF_OBLIGATION_SET_ID:{owner:'application'},PROPOSITION_RECONCILIATION:{owner:'application',valueType:'OBJECT'},APPLICABILITY_RECONCILIATION:{owner:'application',valueType:'OBJECT'},EQUIVALENCE_RECONCILIATION:{owner:'application',valueType:'OBJECT'},ENTAILMENT_RECONCILIATION:{owner:'application',valueType:'OBJECT'},FRESHNESS_RECONCILIATION:{owner:'application',valueType:'OBJECT'},ENVIRONMENT_DEPENDENCY_RECONCILIATION:{owner:'application',valueType:'OBJECT'},EVIDENCE_CYCLE_FINDINGS:{owner:'application',valueType:'OBJECT_ARRAY'}});
RS.releaseRecords=extend(RS.releaseRecords,{PRODUCT_RELEASE_ELIGIBILITY:{owner:'application',valueType:'BOOLEAN'},PROOF_OBLIGATION_SET_ID:{owner:'application'},TOTAL_MANDATORY_PROPOSITIONS:{owner:'application',valueType:'INTEGER'},SATISFIED_MANDATORY_PROPOSITIONS:{owner:'application',valueType:'INTEGER'},VIOLATED_MANDATORY_PROPOSITIONS:{owner:'application',valueType:'INTEGER'},UNDETERMINED_MANDATORY_PROPOSITIONS:{owner:'application',valueType:'INTEGER'},UNKNOWN_APPLICABILITY_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},INSUFFICIENT_EPISTEMIC_BASIS_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},EXPIRED_EVIDENCE_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},DUE_DEFERRED_TEST_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},DEPENDENCY_BLOCKER_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},RELEASE_EVIDENCE_GRAPH_ACYCLIC:{owner:'application',valueType:'BOOLEAN'}});
RS.artifactIdentities=extend(RS.artifactIdentities,{DELIVERY_ARTIFACT_IDENTITY_VERIFIED:{owner:'application',valueType:'BOOLEAN'},HUMAN_DELIVERY_AUTHORIZATION_ID:{owner:'application'},DELIVERY_AUTHORIZATION_EFFECTIVE:{owner:'application',valueType:'BOOLEAN'},FILENAME_NORMALIZATION_VERSION:{owner:'application'},FORMAT_INTERPRETATION_RECORDS:{owner:'application',valueType:'OBJECT_ARRAY'},CURRENT_BYTE_REVERIFICATION_RECEIPT:{owner:'application'}});
RS.evidenceChains=extend(RS.evidenceChains,{PROOF_OBLIGATION_ID:{owner:'application',relationship:'proofObligations'},PROPOSITION_ID:{owner:'application',relationship:'propositions'},APPLICABILITY_ID:{owner:'application',relationship:'applicabilityRecords'},PROOF_EXPRESSION_ID:{owner:'application',relationship:'proofExpressions'},OBSERVATION_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},ENTAILMENT_IDS:{owner:'application',valueType:'REFERENCE_ARRAY'},EPISTEMIC_BASIS_COVERAGE:{owner:'application',valueType:'NUMBER'},FRESHNESS_COVERAGE:{owner:'application',valueType:'NUMBER'},ENVIRONMENT_DEPENDENCY_COVERAGE:{owner:'application',valueType:'NUMBER'},EVIDENCE_CHAIN_SET_SHA256:{owner:'application'},JUSTIFICATION_CYCLE_COUNT:{owner:'application',valueType:'INTEGER'},DELIVERY_AUTHORIZATION_EFFECTIVE:{owner:'application',valueType:'BOOLEAN'}});
const RO={...s0.RECORD_OWNERSHIP};for(const[k,v]of Object.entries(RS))RO[k]=v.ownership;
const addStage=(m,n,a)=>Object.freeze({...m,[n]:Object.freeze([...new Set([...(m[n]||[]),...a])])});
let SC=s0.STAGE_COLLECTIONS;
SC=addStage(SC,2,['sourceSearchAdequacyReviews']);SC=addStage(SC,4,['propositions','requirementCompilationChallengeReviews']);SC=addStage(SC,5,['propositionEquivalenceReviews','applicabilityRecords']);SC=addStage(SC,6,['proofExpressions','environmentDependencies','semanticCoverageReviews']);
for(const n of[12,17,19,22,23,24,25,29])SC=addStage(SC,n,['observationRecords','entailmentReviews']);
const semanticCore=Object.freeze(['propositions','propositionEquivalenceReviews','applicabilityRecords','proofExpressions','proofObligations','semanticCoverageReviews','environmentDependencies']);
const semanticWithEvidence=Object.freeze([...semanticCore,'observationRecords','entailmentReviews']);
const COMPLETION_READ_ADDITIONS=Object.freeze({
  5:['propositions','propositionEquivalenceReviews','applicabilityRecords'],6:['propositions','propositionEquivalenceReviews','applicabilityRecords'],
  7:semanticCore,8:semanticCore,9:semanticCore,10:['proofObligations','environmentDependencies'],12:semanticCore,
  13:semanticWithEvidence,14:semanticWithEvidence,15:semanticWithEvidence,16:semanticWithEvidence,17:semanticWithEvidence,18:semanticWithEvidence,19:semanticWithEvidence,
  20:['proofObligations','environmentDependencies'],21:['proofObligations','environmentDependencies'],22:semanticCore,23:semanticCore,24:semanticCore,25:semanticCore,
  26:semanticWithEvidence,27:semanticWithEvidence,28:['proofObligations'],29:semanticWithEvidence,30:semanticWithEvidence
});
let RC=s0.READ_COLLECTIONS;for(const[stage,collections]of Object.entries(COMPLETION_READ_ADDITIONS))RC=addStage(RC,Number(stage),collections);
let AC=s0.APPLICATION_COLLECTIONS;for(let n=1;n<=30;n++)AC=addStage(AC,n,['operationReservations','proofObligations']);AC=addStage(AC,30,['deliveryRecords','deploymentManifests']);
const SO=Object.freeze({...s0.STAGE_OPERATIONS,1:Object.freeze(['COMPLETE','SEMANTIC_CHALLENGE','RECONCILE_INTAKE']),2:Object.freeze(['COMPLETE','SEARCH_ADEQUACY_REVIEW']),4:Object.freeze(['COMPLETE','DISPOSITION_CHALLENGE','ATOMICITY_CHALLENGE','RECONCILE_REQUIREMENTS']),6:Object.freeze(['COMPLETE','SEMANTIC_REVIEW'])});
const CONTRACTS=Object.freeze(Object.fromEntries(Array.from({length:30},(_,i)=>{const n=i+1,b=s0.STAGE_CONTRACTS[n];return[n,Object.freeze({...b,operations:SO[n]||b.operations,readCollections:RC[n]||[],agentWritableCollections:SC[n]||[],allowedCollections:SC[n]||[],primaryCollections:SC[n]||[],applicationCollections:AC[n]||[]})];})));
const addedAgentCollections=Object.freeze({4:['propositions'],5:['propositionEquivalenceReviews','applicabilityRecords'],6:['proofExpressions','environmentDependencies'],12:['observationRecords','entailmentReviews'],22:['observationRecords','entailmentReviews'],23:['observationRecords','entailmentReviews'],24:['observationRecords','entailmentReviews'],25:['observationRecords','entailmentReviews'],29:['observationRecords','entailmentReviews']});
function operationReadAdditions(stage,operation){if((stage===17||stage===19)&&['EXECUTE_RUN','CONFIRM_FREEZE','FREEZE'].includes(operation))return[];if((stage===17||stage===19)&&operation==='VERIFY')return semanticCore;if((stage===17||stage===19)&&['COMPARE','ROOT_CAUSE','REGRESSION','REGRESSION_VERIFY','CORRECT','CONFIRM'].includes(operation))return semanticWithEvidence;return COMPLETION_READ_ADDITIONS[stage]||[];}
function operationAgentAdditions(stage,operation){if((stage===2&&operation==='SEARCH_ADEQUACY_REVIEW')||(stage===4&&['DISPOSITION_CHALLENGE','ATOMICITY_CHALLENGE'].includes(operation))||(stage===6&&operation==='SEMANTIC_REVIEW'))return[];if((stage===17||stage===19)&&operation==='VERIFY')return['observationRecords','entailmentReviews'];return addedAgentCollections[stage]||[];}
function baseOrSemanticOperation(stage,operation){const base=s0.operationContract(stage,operation);if(base)return base;if(!(SO[stage]||[]).includes(operation))return null;const contract=CONTRACTS[stage],applicationCollections=Object.freeze([...(s0.APPLICATION_COLLECTIONS[stage]||[]),'operationReservations']);if(stage===2&&operation==='SEARCH_ADEQUACY_REVIEW')return Object.freeze({operation,readCollections:Object.freeze(['sources','evidenceRecords']),agentWritableCollections:Object.freeze(['sourceSearchAdequacyReviews']),allowedStageData:Object.freeze([]),applicationCollections,humanActions:contract.humanActions,scopeRequirements:Object.freeze(['projectRevision','inputVersion','contextId'])});if(stage===4&&['DISPOSITION_CHALLENGE','ATOMICITY_CHALLENGE'].includes(operation))return Object.freeze({operation,readCollections:Object.freeze(['requirements','propositions','evidenceRecords']),agentWritableCollections:Object.freeze(['requirementCompilationChallengeReviews']),allowedStageData:Object.freeze([]),applicationCollections,humanActions:contract.humanActions,scopeRequirements:Object.freeze(['projectRevision','inputVersion','sourceSetVersion','contextId'])});if(stage===4&&operation==='RECONCILE_REQUIREMENTS')return Object.freeze({operation,readCollections:Object.freeze(['research','candidateRequirements','sources','evidenceRecords','sourceConflicts','requirements','propositions','requirementCompilationChallengeReviews']),agentWritableCollections:Object.freeze(['requirements','propositions']),allowedStageData:contract.allowedStageData,applicationCollections,humanActions:contract.humanActions,scopeRequirements:Object.freeze(['projectRevision','inputVersion','sourceSetVersion','contextId'])});if(stage===6&&operation==='SEMANTIC_REVIEW')return Object.freeze({operation,readCollections:Object.freeze(['requirements','tests','propositions','proofExpressions']),agentWritableCollections:Object.freeze(['semanticCoverageReviews']),allowedStageData:Object.freeze([]),applicationCollections,humanActions:contract.humanActions,scopeRequirements:Object.freeze(['contextId'])});return Object.freeze({operation,readCollections:Object.freeze([...(s0.READ_COLLECTIONS[stage]||[])]),agentWritableCollections:Object.freeze([...(s0.STAGE_COLLECTIONS[stage]||[])]),allowedStageData:contract.allowedStageData,applicationCollections:Object.freeze([...(s0.APPLICATION_COLLECTIONS[stage]||[])]),humanActions:contract.humanActions,scopeRequirements:contract.scopeRequirements});}
function amendedOperationContract(stage,operation){const base=baseOrSemanticOperation(stage,operation);if(!base)return null;const addedAgent=operationAgentAdditions(stage,operation),addedRead=operationReadAdditions(stage,operation),addedApplication=stage===30?['operationReservations','proofObligations','deliveryRecords','deploymentManifests']:['operationReservations','proofObligations'],scopeRequirements=[...(base.scopeRequirements||[])];if(([1,2,4,6].includes(stage)&&operation==='COMPLETE'||stage===1&&operation!=='COMPLETE')&&!scopeRequirements.includes('contextId'))scopeRequirements.push('contextId');let readCollections=[...new Set([...(base.readCollections||[]),...addedRead])];if(stage===24&&operation==='COMPLETE')readCollections=readCollections.filter(collection=>collection!=='regressionExecutions');const allowedStageData=['SEARCH_ADEQUACY_REVIEW','DISPOSITION_CHALLENGE','ATOMICITY_CHALLENGE','SEMANTIC_REVIEW'].includes(operation)?base.allowedStageData:(CONTRACTS[stage]?.allowedStageData||base.allowedStageData||[]);return Object.freeze({...base,readCollections:Object.freeze(readCollections),agentWritableCollections:Object.freeze([...new Set([...(base.agentWritableCollections||[]),...addedAgent])]),applicationCollections:Object.freeze([...new Set([...(base.applicationCollections||[]),...addedApplication])]),allowedStageData:Object.freeze([...(allowedStageData||[])]),scopeRequirements:Object.freeze(scopeRequirements)});}

const PROOF_EXPRESSION_VERSION='closed-loop-proof-expression/1',PROOF_OPERATORS=Object.freeze(['LEAF','ALL_OF','ANY_OF','AT_LEAST_K']),PROOF_LEAF_KEYS=Object.freeze(['testId','observationId','artifactId','dependencyId']);
function proofOperator(node){return String(node?.op??node?.type??'').trim().toUpperCase();}
function validateProofExpression(expression,{leafResolver=null}={}){
  const issues=[],stack=new WeakSet();
  const visit=(node,path)=>{
    if(!node||typeof node!=='object'||Array.isArray(node)){issues.push(`${path}: proof node must be an object.`);return;}
    if(stack.has(node)){issues.push(`${path}: proof expression cycle.`);return;}stack.add(node);
    const op=proofOperator(node),operatorKeys=['op','type'].filter(key=>Object.prototype.hasOwnProperty.call(node,key));
    if(operatorKeys.length!==1)issues.push(`${path}: provide exactly one of op or type.`);
    if(!PROOF_OPERATORS.includes(op)){issues.push(`${path}: unknown proof operator ${op||'MISSING'}.`);stack.delete(node);return;}
    if(op==='LEAF'){
      const unknown=Object.keys(node).filter(key=>!['op','type','version',...PROOF_LEAF_KEYS].includes(key));if(unknown.length)issues.push(`${path}: unknown LEAF properties ${unknown.join(', ')}.`);
      const refs=PROOF_LEAF_KEYS.filter(key=>typeof node[key]==='string'&&node[key].trim());if(refs.length!==1)issues.push(`${path}: LEAF requires exactly one non-empty registered reference.`);
      if(node.children!==undefined||node.k!==undefined)issues.push(`${path}: LEAF cannot contain children or k.`);
      if(refs.length===1&&typeof leafResolver==='function'){const result=leafResolver({kind:refs[0],id:node[refs[0]],node,path});if(result===false||result?.valid===false)issues.push(`${path}: ${result?.reason||'leaf reference is not current and admissible.'}`);}
    }else{
      const allowed=op==='AT_LEAST_K'?['op','type','version','children','k']:['op','type','version','children'],unknown=Object.keys(node).filter(key=>!allowed.includes(key));if(unknown.length)issues.push(`${path}: unknown ${op} properties ${unknown.join(', ')}.`);
      const childCount=Array.isArray(node.children)?node.children.length:0;if(!childCount)issues.push(`${path}: ${op} requires one or more children.`);else node.children.forEach((child,index)=>visit(child,`${path}/children/${index}`));
      if(op==='AT_LEAST_K'&&(!Number.isSafeInteger(node.k)||node.k<1||node.k>childCount))issues.push(`${path}: AT_LEAST_K requires safe integer 1 <= k <= child count.`);
      if(op!=='AT_LEAST_K'&&node.k!==undefined)issues.push(`${path}: ${op} cannot contain k.`);
      if(PROOF_LEAF_KEYS.some(key=>node[key]!==undefined))issues.push(`${path}: composite proof node cannot contain a leaf reference.`);
    }
    stack.delete(node);
  };
  if(expression?.version!==undefined&&expression.version!==PROOF_EXPRESSION_VERSION)issues.push(`$: unsupported proof-expression version ${String(expression.version)}.`);
  visit(expression,'$');return Object.freeze({valid:issues.length===0,issues:Object.freeze(issues)});
}
function normalizeProofExpression(expression,options={}){const result=validateProofExpression(expression,options);if(!result.valid)throw new TypeError(result.issues.join(' '));const normalize=node=>{const op=proofOperator(node);if(op==='LEAF'){const key=PROOF_LEAF_KEYS.find(name=>typeof node[name]==='string'&&node[name].trim());return Object.freeze({op,[key]:String(node[key])});}const output={op,children:Object.freeze(node.children.map(normalize))};if(op==='AT_LEAST_K')output.k=node.k;return Object.freeze(output);};return Object.freeze({version:PROOF_EXPRESSION_VERSION,...normalize(expression)});}
function evaluateProofExpression(expression,resolveLeaf){const validation=validateProofExpression(expression);if(!validation.valid)return Object.freeze({truthValue:'UNKNOWN',valid:false,reasons:validation.issues});if(typeof resolveLeaf!=='function')throw new TypeError('evaluateProofExpression requires a leaf resolver.');const walk=node=>{const op=proofOperator(node);if(op==='LEAF'){const key=PROOF_LEAF_KEYS.find(name=>typeof node[name]==='string'&&node[name].trim()),truth=String(resolveLeaf({kind:key,id:node[key],node})||'UNKNOWN').toUpperCase();return E.truth.includes(truth)?truth:'UNKNOWN';}const values=node.children.map(walk),trueCount=values.filter(value=>value==='TRUE').length,falseCount=values.filter(value=>value==='FALSE').length,unknownCount=values.length-trueCount-falseCount;if(op==='ALL_OF')return falseCount?'FALSE':unknownCount?'UNKNOWN':'TRUE';if(op==='ANY_OF')return trueCount?'TRUE':unknownCount?'UNKNOWN':'FALSE';return trueCount>=node.k?'TRUE':trueCount+unknownCount<node.k?'FALSE':'UNKNOWN';};return Object.freeze({truthValue:walk(expression),valid:true,reasons:Object.freeze([])});}

const schema=Object.freeze({...s0,version:'closed-loop-workflow-schema/3',__controllingCompletionAmendmentVersion:VERSION,CONTROLLING_COMPLETION_ENUMS:E,RECORD_SCHEMAS:Object.freeze(RS),RECORD_OWNERSHIP:Object.freeze(RO),STAGE_OPERATIONS:SO,STAGE_COLLECTIONS:SC,READ_COLLECTIONS:RC,APPLICATION_COLLECTIONS:AC,STAGE_CONTRACTS:CONTRACTS,operationContract:amendedOperationContract,allowedCollections:n=>Object.freeze([...(SC[n]||[])]),recordAgentFields:c=>Object.freeze(Object.values(RS[c]?.fieldDefinitions||{}).filter(d=>d.producer===P.AGENT).map(d=>d.name)),recordHumanFields:c=>Object.freeze(Object.values(RS[c]?.fieldDefinitions||{}).filter(d=>d.producer===P.HUMAN||d.producer===P.HUMAN_DECISION).map(d=>d.name)),PROOF_EXPRESSION_VERSION,validateProofExpression,normalizeProofExpression,evaluateProofExpression});globalThis.closedLoopWorkflowSchema=schema;
const augmented=globalThis.closedLoopWorkflowSchema;
globalThis.closedLoopWorkflowSchema=Object.freeze({...augmented,TRUTH_VALUES:Object.freeze([...E.truth]),EPISTEMIC_BASES:Object.freeze([...E.basis]),APPLICABILITY_VALUES:Object.freeze([...E.applicability]),ENTAILMENT_VALUES:Object.freeze([...E.entailment]),PROOF_EXPRESSION_OPERATORS:PROOF_OPERATORS,NORMATIVE_CLASS_VALUES:Object.freeze([...E.normative]),SEMANTIC_COVERAGE_VALUES:Object.freeze([...E.coverage]),OBSERVATION_ORIGIN_VALUES:Object.freeze([...E.origin]),DELIVERY_STATE_VALUES:Object.freeze([...E.delivery]),DISCLOSURE_CLASSIFICATION_VALUES:Object.freeze([...E.disclosure]),RESERVATION_STATE_VALUES:Object.freeze([...E.reservation]),INPUT_BINDING_BASIS_VALUES:Object.freeze(['NATIVE_APPLICATION_BOUND','VERIFIED_TOOL_ATTESTED','TOOL_GENERATED_UNVERIFIED','EXTERNALLY_SUPPORTED','SELF_ASSERTED','UNKNOWN','MISMATCHED']),INDEPENDENCE_DIMENSION_VALUES:Object.freeze(['APPLICATION_SESSION_DISTINCTNESS','APPLICATION_INPUT_ISOLATION','USER_TRANSFER_CONFORMITY','EXTERNAL_CONTEXT_IDENTIFIER_DISTINCTNESS','PROVIDER_CONTEXT_INDEPENDENCE','EXECUTOR_OR_REVIEWER_ROLE_SEPARATION','ENVIRONMENT_INDEPENDENCE']),EXPECTED_VARIANCE_VALUES:Object.freeze(['INVARIANT','ALLOWED_SET','NUMERIC_TOLERANCE','ORDER_INSENSITIVE','NONCORRECTNESS_VARIANCE_ALLOWED','UNKNOWN']),MATERIALITY_VALUES:Object.freeze(['MATERIAL','NONMATERIAL','UNKNOWN'])});
})();

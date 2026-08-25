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
const RESPONSE_SCHEMA='closed-loop-stage-response/2';
const VALUE_TYPES=Object.freeze(['STRING','INTEGER','NUMBER','BOOLEAN','STRING_ARRAY','REFERENCE','REFERENCE_ARRAY','OBJECT']);
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
  'JOB_TITLE','JOB_OWNER','EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',
  'REQUIRED_OUTPUT_FORMAT','DEADLINE_OR_TEMPORAL_SCOPE','KNOWN_AUTHORITATIVE_SOURCES',
  'AVAILABLE_TOOLS','PROHIBITED_ACTIONS','EXPLICIT_USER_REQUIREMENTS'
]);
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
  if(APPLICATION_JOB_FIELDS.includes(name))return field(name,PRODUCER.APPLICATION,{derivation:`Application derives ${name} from canonical project state.`});
  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:1,provenanceRequired:false});
  if(AGENT_JOB_FIELDS.includes(name))return field(name,PRODUCER.AGENT,{requiredAtStage:1});
  return field(name,PRODUCER.APPLICATION,{derivation:`Application owns unclassified job-control field ${name}.`});
}
const JOB_FIELDS=Object.freeze(Object.fromEntries([...new Set([...HUMAN_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])].map(name=>[name,jobFieldDefinition(name)])));


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
      "INPUTS",
      "TOOLS",
      "PROCEDURE",
      "EXPECTED_RESULT",
      "FAILURE_CONDITION",
      "EVIDENCE_TO_PRESERVE"
    ],
    "application": [
      "TEST_ID",
      "REQ_ID",
      "STATUS"
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
    "agent": [
      "PURPOSE",
      "LINEAGE",
      "EVIDENCE"
    ],
    "application": [
      "ITERATION_ID",
      "CANDIDATE_ID",
      "PREVIOUS_ITERATION_ID",
      "CHANGESET_ID",
      "STATUS"
    ]
  },
  "candidateFreezes": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "COMPONENT_MANIFEST",
      "COMPONENT_VERSIONS",
      "ROLE_DISTRIBUTION",
      "IMMUTABLE_LOCATIONS",
      "TOOL_CONFIGURATION",
      "SETTINGS",
      "PERMISSIONS",
      "LIMITATIONS",
      "BATCH_CHANGE_RULE",
      "EVIDENCE"
    ],
    "application": [
      "CANDIDATE_ID",
      "ITERATION_ID",
      "COMPONENT_HASHES",
      "STATUS"
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
      "INDEPENDENCE_STATUS",
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
    ]
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
      "PRE_CORRECTION_RESULT",
      "PRE_CORRECTION_EVIDENCE",
      "CORRECTION",
      "POST_CORRECTION_RESULT",
      "POST_CORRECTION_EVIDENCE",
      "PERMANENT_TEST_LOCATION",
      "APPLICABILITY",
      "RETIREMENT_AUTHORITY"
    ],
    "application": [
      "REG_ID",
      "DEFECT_ID",
      "REQ_ID",
      "FIXTURE_IDENTITY_HASH",
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
    "agent": [
      "APPROVED_VERSIONS",
      "IMMUTABLE_ARTIFACT_RECORDS",
      "AUTHORIZED_RECIPIENT_ROLES",
      "CONTROLLED_STORAGE",
      "EVIDENCE"
    ],
    "application": [
      "BASELINE_ID",
      "SUPPORTING_CONFIRMATION_ID",
      "HASHES",
      "STATUS"
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
      "FAILURES",
      "GENERATED_ARTIFACT_INVENTORY"
    ],
    "application": [
      "PRODUCT_ID",
      "PRODUCT_VERSION",
      "BASELINE_ID",
      "EXECUTION_ID",
      "PRODUCTION_CONTEXT_ID",
      "INSTRUCTION_VERSION",
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
      "DEFECT_ID"
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
      "STATUS"
    ]
  },
  "artifacts": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "FILENAME",
      "TYPE",
      "ROLE",
      "STORAGE_REFERENCE",
      "AVAILABILITY",
      "NOTES"
    ],
    "application": [
      "ARTIFACT_ID",
      "VERSION",
      "BYTE_SIZE",
      "SHA256"
    ]
  }
});
function ownerFromPartition(partition,name,label){const hits=[['human',PRODUCER.HUMAN],['humanDecision',PRODUCER.HUMAN_DECISION],['agent',PRODUCER.AGENT],['application',PRODUCER.APPLICATION]].filter(([key])=>partition?.[key]?.includes(name));if(hits.length!==1)throw new Error(`${label} field ${name} must occur in exactly one ownership partition.`);return hits[0][1];}
function explicitValueType(name,producer,isRelationship=false){if(isRelationship)return 'REFERENCE';if(producer===PRODUCER.APPLICATION&&/(?:^TOTAL_|_COUNT$|_RECORDS$|_RUNS$|_DEFECTS$|_UNKNOWNS$|_MISMATCHES$|_MATCHES$|^EXECUTED$|^SATISFIED$|^VIOLATED$|^UNDETERMINED$)/.test(name))return 'INTEGER';if(producer===PRODUCER.APPLICATION&&/(?:COVERAGE|SUCCESS)$/.test(name))return 'NUMBER';if(producer===PRODUCER.APPLICATION&&/(?:^ALL_|^ANY_|_CONFIRMED$|_SUCCEEDED$|_COMPLETE$|_APPEND_ONLY$)/.test(name))return 'BOOLEAN';return 'STRING';}

const HUMAN_STAGE_FIELDS=Object.freeze({
  1:new Set(HUMAN_JOB_FIELDS),
  10:new Set(['FREEZE_OWNER']),
  20:new Set(['BASELINE_OWNER']),
  28:new Set(['HASH_OPERATOR','EXACT_AUTHORIZED_ARTIFACT_IDS','EXACT_AUTHORIZED_FILENAMES','AUTHORIZED_BY'])
});
const HUMAN_DECISION_STAGE_FIELDS=Object.freeze({
  1:new Set(['JOB_TITLE','JOB_OWNER']),
  10:new Set(['FREEZE_OWNER']),
  20:new Set(['BASELINE_OWNER']),
  27:new Set([]),
  28:new Set(['HASH_OPERATOR','EXACT_AUTHORIZED_ARTIFACT_IDS','EXACT_AUTHORIZED_FILENAMES','AUTHORIZED_BY'])
});
const APPLICATION_EXACT_STAGE_FIELDS=new Set([
  'JOB_ID','DATE_OPENED','INPUT_SET_VERSION','INPUT_SET_HASH_OR_MANIFEST','JOB_RECORD_STATUS','STATUS_EVIDENCE',
  'SOURCE_SET_VERSION','RESEARCH_VERSION','REQUIREMENTS_VERSION','INPUT_REQUIREMENTS_VERSION','OUTPUT_REQUIREMENTS_VERSION',
  'TEST_SUITE_VERSION','MUTATION_SUITE_VERSION','DRAFT_INSTRUCTION_VERSION','INPUT_INSTRUCTION_VERSION','OUTPUT_INSTRUCTION_VERSION',
  'CANDIDATE_ID','ITERATION_ID','PREVIOUS_ITERATION_ID','NEW_ITERATION_ID','PREVIOUS_CANDIDATE_ID','NEW_CANDIDATE_ID',
  'CHANGE_SET_ID','CHANGESET_ID','RCA_VERSION','METRICS_VERSION','CONFIRMATION_ITERATION_ID','SOURCE_CONVERGED_ITERATION',
  'BASELINE_ID','PRODUCT_ID','PRODUCT_VERSION','EXECUTION_ID','RELEASE_GATE_ID','HASH_REVIEW_ID','REVIEW_VERSION',
  'COMPARISON_VERSION','ROOT_CAUSE_ANALYSIS_VERSION','REGRESSION_FIXTURE_VERSION','DEFECT_REGISTRY_VERSION',
  'REGRESSION_REGISTRY_VERSION','EVIDENCE_CHAIN_VERSION','REPRESENTATION_REVIEW_VERSION','ADVERSARIAL_REVIEW_VERSION',
  'MEANING_RUBRIC_VERSION','VALIDATOR_VERSION','RECONCILED_REVIEW_VERSION','DATE_AND_TIME','FREEZE_DATE','BASELINE_APPROVAL_DATE',
  'STAGE_DECISION','DECISION_EVIDENCE','SELECTED_RELEASE_STATE','DELIVERY_AUTHORIZATION','FINAL_RELEASE_STATUS'
]);
const APPLICATION_STAGE_PATTERN=/^(TOTAL_|CURRENT_|MANDATORY_|ACTIVE_|EXPECTED_|ACTUAL_|MISSING_|SATISFIED$|VIOLATED$|UNDETERMINED$|CRITICAL_|MAJOR_|UNRESOLVED_|KNOWN_CORRECTNESS_|UNEXPLAINED_|ALL_|ANY_|RUNS_COMPLETED$|FRESH_CONTEXTS_CREATED$|RUNS_RECEIVING_|CONTAMINATED_RUNS$|OUTPUTS_SAVED_|EXECUTED$|FAILED_|SUCCESSFUL_|INVALID_FIXTURES_ACCEPTED$|DEFECTIVE_VALIDATORS$|REQUIREMENTS_WITH_|CONFIRMED_DEFECTS|PRE_CORRECTION_|POST_CORRECTION_|ZERO_CHANGE_AUDIT$|TEN_NEW_CONTEXTS_CREATED$|SAME_FROZEN_PACKAGE_USED$|UNCHANGED_CONFIRMATION_SUCCEEDED$|PRODUCT_HASHES_|HASH_|AUTHORIZATION_|INCOMPLETE_|UNKNOWN_CHAIN_|MANDATORY_EVIDENCE_CHAIN_COVERAGE$|REGISTRY_IS_APPEND_ONLY$|FINAL_.*_DETERMINATION$)/;
const APPLICATION_STAGE_SUMMARY_PATTERN=/(?:_RECORDS|_RECORDS_COMPLETED|_FILE_RECORDS|_RESULTS|_INVENTORY)$/;

function stageFieldProducer(stage,name){return ownerFromPartition(core.STAGES[Number(stage)-1]?.ownership,name,`Stage ${stage}`);}
function stageFieldDefinition(stage,name){
  const producer=stageFieldProducer(stage,name);
  return field(name,producer,{
    requiredAtStage:stage,
    valueType:explicitValueType(name,producer,false),
    derivationKey:producer===PRODUCER.APPLICATION?`stage${String(stage).padStart(2,'0')}.${name}`:null,
    responsePath:producer===PRODUCER.AGENT?`/stageData/${name}`:null,
    help:producer===PRODUCER.APPLICATION?'Read-only; recalculated by the application.':''
  });
}
const STAGE_FIELDS=Object.freeze(Object.fromEntries(core.STAGES.map(stage=>[
  stage.number,
  Object.freeze(Object.fromEntries(stage.fields.map(name=>[name,stageFieldDefinition(stage.number,name)])))
])));

function recordSchema({title,idField,prefix,stage,fields,required=[],relationships={},provenanceRequired=true,appendOnly=true,ownership,commitPolicy=COLLECTION_POLICIES.APPEND_SCOPED}){
  const relSet=new Set(Object.keys(relationships)),definitions={};
  for(const name of fields){
    const producer=ownerFromPartition(ownership,name,title);
    definitions[name]=field(name,producer,{requiredAtStage:stage,responsePath:producer===PRODUCER.AGENT?`/records/{collection}/*/fields/${name}`:null,valueType:explicitValueType(name,producer,relSet.has(name)),derivationKey:producer===PRODUCER.APPLICATION?`record.${prefix}.${name}`:null,provenanceRequired:producer===PRODUCER.AGENT?provenanceRequired:false});
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
    'TEST_ID','REQ_ID','TEST_TYPE','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'
  ],required:['TEST_TYPE','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'],relationships:{REQ_ID:'requirements'}}),
  failureTests:recordSchema({ownership:RECORD_OWNERSHIP.failureTests,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Failure and mutation tests',idField:'MUTATION_ID',prefix:'MUTATION',stage:7,fields:[
    'MUTATION_ID','REQ_ID','VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','ACTUAL_RESULT','VALIDATOR_DEFECT_ID','EVIDENCE'
  ],required:['VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','EVIDENCE'],relationships:{REQ_ID:'requirements',VALIDATOR_DEFECT_ID:'defects'}}),
  instructions:recordSchema({ownership:RECORD_OWNERSHIP.instructions,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Production instructions',idField:'INSTRUCTION_ID',prefix:'PRODUCTION-INSTRUCTION',stage:8,fields:[
    'INSTRUCTION_ID','OBJECTIVE','AUTHORIZED_INPUTS','FAILURE_HANDLING','AUTHORITY_RULES','SCOPE','PROHIBITIONS','DEFINED_TERMS','ORDERED_PROCEDURE',
    'BRANCHES','TOOL_REQUIREMENTS','OUTPUT_CONTRACT','FACTUAL_STATE_HANDLING','REJECTION_BLOCKING_RULES','COMPLETION_CONDITIONS','REQUIREMENT_TRACEABILITY','INSTRUCTION_TEXT'
  ],required:['OBJECTIVE','AUTHORIZED_INPUTS','FAILURE_HANDLING','AUTHORITY_RULES','SCOPE','PROHIBITIONS','DEFINED_TERMS','ORDERED_PROCEDURE','TOOL_REQUIREMENTS','OUTPUT_CONTRACT','FACTUAL_STATE_HANDLING','REJECTION_BLOCKING_RULES','COMPLETION_CONDITIONS','REQUIREMENT_TRACEABILITY','INSTRUCTION_TEXT']}),
  preflightRecords:recordSchema({ownership:RECORD_OWNERSHIP.preflightRecords,commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,title:'Independent instruction preflight',idField:'REVIEW_ID',prefix:'PREFLIGHT-REVIEW',stage:9,fields:[
    'REVIEW_ID','INSTRUCTION_ID','CLAUSE','MULTIPLE_INTERPRETATIONS','UNDEFINED_OBJECTS','UNSUPPLIED_DEPENDENCIES','INTERNAL_CONFLICTS','UNAVAILABLE_CAPABILITIES',
    'OBJECTIVELY_VERIFIABLE','RESPONSIBLE_OPERATION_ASSIGNED','ORDER_CLEAR','FAILURE_BEHAVIOR_DEFINED','TRACEABILITY','DETERMINATION','FINDINGS','CORRECTIONS','EVIDENCE'
  ],required:['CLAUSE','DETERMINATION','FINDINGS','EVIDENCE'],relationships:{INSTRUCTION_ID:'instructions'}}),
  iterations:recordSchema({ownership:RECORD_OWNERSHIP.iterations,title:'Iteration controls',idField:'ITERATION_ID',prefix:'ITERATION',stage:10,fields:[
    'ITERATION_ID','CANDIDATE_ID','PREVIOUS_ITERATION_ID','CHANGESET_ID','PURPOSE','STATUS','LINEAGE','EVIDENCE'
  ],required:['PURPOSE','STATUS','LINEAGE','EVIDENCE'],relationships:{CANDIDATE_ID:'candidateFreezes',PREVIOUS_ITERATION_ID:'iterations',CHANGESET_ID:'changes'}}),
  candidateFreezes:recordSchema({ownership:RECORD_OWNERSHIP.candidateFreezes,commitPolicy:COLLECTION_POLICIES.UPDATE_RESERVED,title:'Frozen candidates',idField:'CANDIDATE_ID',prefix:'CANDIDATE',stage:10,fields:[
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
  ],required:['VERIFIER','VERIFIER_CONTEXT_ID','INDEPENDENCE_STATUS','INPUTS','PROCEDURE','EXPECTED_RESULT','OBSERVED_RESULT','EXACT_EVIDENCE','DETERMINATION'],relationships:{REQ_ID:'requirements',RUN_ID:'runs',TEST_ID:'tests',DEFECT_ID:'defects'}}),
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
  ],required:['FAILURE_FIXTURE','REPRODUCTION_PROCEDURE','DETECTION_METHOD','PRE_CORRECTION_RESULT','PRE_CORRECTION_EVIDENCE','CORRECTION','POST_CORRECTION_RESULT','POST_CORRECTION_EVIDENCE','PERMANENT_TEST_LOCATION','APPLICABILITY','ACTIVE_RETIRED_STATE'],relationships:{DEFECT_ID:'defects',REQ_ID:'requirements'}}),
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
  baselines:recordSchema({ownership:RECORD_OWNERSHIP.baselines,title:'Production baselines',idField:'BASELINE_ID',prefix:'BASELINE',stage:20,fields:[
    'BASELINE_ID','SUPPORTING_CONFIRMATION_ID','APPROVED_VERSIONS','HASHES','IMMUTABLE_ARTIFACT_RECORDS','AUTHORIZED_RECIPIENT_ROLES','CONTROLLED_STORAGE','HUMAN_AUTHORIZATION','STATUS','EVIDENCE'
  ],required:['APPROVED_VERSIONS','IMMUTABLE_ARTIFACT_RECORDS','AUTHORIZED_RECIPIENT_ROLES','CONTROLLED_STORAGE','HUMAN_AUTHORIZATION','STATUS','EVIDENCE'],relationships:{SUPPORTING_CONFIRMATION_ID:'confirmationRecords'}}),
  products:recordSchema({ownership:RECORD_OWNERSHIP.products,commitPolicy:COLLECTION_POLICIES.UPDATE_RESERVED,title:'Finished products',idField:'PRODUCT_ID',prefix:'PRODUCT',stage:21,fields:[
    'PRODUCT_ID','PRODUCT_VERSION','BASELINE_ID','EXECUTION_ID','PRODUCTION_CONTEXT_ID','BASELINE_MATERIALS','EXECUTION_TIMESTAMPS','INSTRUCTION_VERSION','TOOL_CONFIGURATION','DEVIATIONS','FAILURES','GENERATED_ARTIFACT_INVENTORY','STATUS'
  ],required:['PRODUCTION_CONTEXT_ID','BASELINE_MATERIALS','EXECUTION_TIMESTAMPS','TOOL_CONFIGURATION','DEVIATIONS','FAILURES','GENERATED_ARTIFACT_INVENTORY','STATUS'],relationships:{BASELINE_ID:'baselines',PRODUCTION_CONTEXT_ID:'freshContexts'}}),
  deterministicResults:recordSchema({ownership:RECORD_OWNERSHIP.deterministicResults,title:'Deterministic product verification',idField:'RESULT_ID',prefix:'DETERMINISTIC-RESULT',stage:22,fields:[
    'RESULT_ID','PRODUCT_ID','PRODUCT_SHA256','TEST_ID','TOOL_AND_VERSION','PROCEDURE','EXPECTED_RESULT','ACTUAL_RESULT','DETERMINATION','EVIDENCE','DEFECT_ID'
  ],required:['TOOL_AND_VERSION','PROCEDURE','EXPECTED_RESULT','ACTUAL_RESULT','DETERMINATION','EVIDENCE'],relationships:{PRODUCT_ID:'products',TEST_ID:'tests',DEFECT_ID:'defects'}}),
  meaningResults:recordSchema({ownership:RECORD_OWNERSHIP.meaningResults,title:'Independent meaning verification',idField:'MEANING_REVIEW_ID',prefix:'MEANING-REVIEW',stage:23,fields:[
    'MEANING_REVIEW_ID','REQ_ID','PRODUCT_ID','PRODUCT_LOCATION','EXTERNAL_SOURCE_EVIDENCE','REQUIRED_MEANING','OBSERVED_MEANING','EVIDENCE_BASED_COMPARISON','DETERMINATION','DEFECT_ID','UNDETERMINED_REASON'
  ],required:['PRODUCT_LOCATION','EXTERNAL_SOURCE_EVIDENCE','REQUIRED_MEANING','OBSERVED_MEANING','EVIDENCE_BASED_COMPARISON','DETERMINATION'],relationships:{REQ_ID:'requirements',PRODUCT_ID:'products',DEFECT_ID:'defects'}}),
  adversarialResults:recordSchema({ownership:RECORD_OWNERSHIP.adversarialResults,title:'Adversarial product verification',idField:'ATTACK_ID',prefix:'ATTACK',stage:24,fields:[
    'ATTACK_ID','PRODUCT_ID','ATTACK','METHOD','EXPECTED_BEHAVIOR','ACTUAL_RESULT','DETERMINATION','DEFECT_ID','SEVERITY','EVIDENCE'
  ],required:['ATTACK','METHOD','EXPECTED_BEHAVIOR','ACTUAL_RESULT','DETERMINATION','SEVERITY','EVIDENCE'],relationships:{PRODUCT_ID:'products',DEFECT_ID:'defects'}}),
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
  ],required:[],relationships:{REQ_ID:'requirements',INSTRUCTION_ID:'instructions',TEST_ID:'tests',RELEASE_DECISION_ID:'releaseRecords',ARTIFACT_HASH_IDENTITY:'artifactIdentities'}}),
  instructionTraces:recordSchema({ownership:{human:[],humanDecision:[],agent:['INSTRUCTION_LOCATION','IMPLEMENTED_BEHAVIOR'],application:['TRACE_ID','REQ_ID','INSTRUCTION_ID','EVIDENCE_ID','STATUS']},title:'Instruction traces',idField:'TRACE_ID',prefix:'TRACE',stage:8,fields:['TRACE_ID','REQ_ID','INSTRUCTION_ID','INSTRUCTION_LOCATION','IMPLEMENTED_BEHAVIOR','EVIDENCE_ID','STATUS'],required:['INSTRUCTION_LOCATION','IMPLEMENTED_BEHAVIOR'],relationships:{REQ_ID:'requirements',INSTRUCTION_ID:'instructions',EVIDENCE_ID:'evidenceRecords'},commitPolicy:COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET}),
  regressionExecutions:recordSchema({ownership:{human:[],humanDecision:[],agent:['PHASE','RESULT'],application:['REG_EXEC_ID','REG_ID','ITERATION_ID','CANDIDATE_ID','PRODUCT_ID','EVIDENCE_ID','EXECUTED_AT']},title:'Regression executions',idField:'REG_EXEC_ID',prefix:'REG-EXEC',stage:15,fields:['REG_EXEC_ID','REG_ID','ITERATION_ID','CANDIDATE_ID','PRODUCT_ID','PHASE','RESULT','EVIDENCE_ID','EXECUTED_AT'],required:['PHASE','RESULT'],relationships:{REG_ID:'regressions',ITERATION_ID:'iterations',CANDIDATE_ID:'candidateFreezes',PRODUCT_ID:'products',EVIDENCE_ID:'evidenceRecords'},commitPolicy:COLLECTION_POLICIES.APPEND_SCOPED}),
  blockers:recordSchema({ownership:RECORD_OWNERSHIP.blockers,title:'Blockers',idField:'BLOCKER_ID',prefix:'BLOCKER',stage:null,fields:[
    'BLOCKER_ID','MISSING_ITEM_TYPE','MISSING_FACT_INPUT_AUTHORITY_EVIDENCE_CAPABILITY_DECISION_RULE','AFFECTED_REQUIREMENTS','AFFECTED_TESTS','AFFECTED_ARTIFACTS','WHY_WORK_CANNOT_CONTINUE','ATTEMPTED_RESOLUTIONS','DOWNSTREAM_WORK_STOPPED','OWNER','STATUS','RESOLUTION_EVIDENCE','CLOSURE','REEVALUATION','REQUIRED_REVALIDATION'
  ],required:['MISSING_ITEM_TYPE','MISSING_FACT_INPUT_AUTHORITY_EVIDENCE_CAPABILITY_DECISION_RULE','WHY_WORK_CANNOT_CONTINUE','ATTEMPTED_RESOLUTIONS','DOWNSTREAM_WORK_STOPPED','STATUS']}),
  freshContexts:recordSchema({ownership:RECORD_OWNERSHIP.freshContexts,commitPolicy:COLLECTION_POLICIES.UPDATE_RESERVED,title:'Fresh agent contexts',idField:'CONTEXT_ID',prefix:'CONTEXT',stage:null,fields:[
    'CONTEXT_ID','EXTERNAL_CONTEXT_IDENTIFIER','ROLE','ITERATION_ID','RUN_ID','AUTHORIZED_PROJECT_INPUTS','AUTHORIZED_EXTERNAL_SOURCE_MATERIAL','FROZEN_ARTIFACT_VERSIONS','TOOL_AVAILABILITY','CONTAMINATION_STATUS','OUTPUT_IDENTITY','DEVIATIONS','EVIDENCE','USABILITY_DETERMINATION'
  ],required:['EXTERNAL_CONTEXT_IDENTIFIER','ROLE','AUTHORIZED_PROJECT_INPUTS','TOOL_AVAILABILITY','CONTAMINATION_STATUS','EVIDENCE','USABILITY_DETERMINATION'],relationships:{ITERATION_ID:'iterations',RUN_ID:'runs'}}),
  evidenceRecords:recordSchema({ownership:RECORD_OWNERSHIP.evidenceRecords,commitPolicy:COLLECTION_POLICIES.APPEND_SCOPED,title:'Evidence records',idField:'EVIDENCE_ID',prefix:'EVIDENCE',stage:null,fields:[
    'EVIDENCE_ID','KIND','DESCRIPTION','AUTHORITY_TYPE','SOURCE_ID','LOCATION','CONTENT','ATTACHMENT_ID','SHA256','STATUS'
  ],required:['KIND','DESCRIPTION','LOCATION','CONTENT','STATUS'],relationships:{SOURCE_ID:'sources',ATTACHMENT_ID:'artifacts'}}),
  artifacts:recordSchema({ownership:RECORD_OWNERSHIP.artifacts,title:'Files and artifacts',idField:'ARTIFACT_ID',prefix:'ARTIFACT',stage:null,fields:[
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
  10:['iterations','candidateFreezes'],
  11:['runs'],
  12:['verification'],
  13:['comparisons'],
  14:['defects','rootCauses'],
  15:['regressions','regressionExecutions'],
  16:['changes'],
  17:['iterations','candidateFreezes','runs'],
  18:['convergenceRecords'],
  19:['iterations','runs','confirmationRecords'],
  20:['baselines'],
  21:['products','artifacts'],
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


const READ_COLLECTIONS=Object.freeze({1:[],2:[],3:['sources','sourceConflicts'],4:['research','candidateRequirements','sources'],5:['requirements','research','sourceConflicts'],6:['requirements','requirementResolutions'],7:['requirements','tests'],8:['requirements','tests','failureTests','requirementResolutions'],9:['instructions','instructionTraces','requirements','tests'],10:['instructions','preflightRecords','tests','failureTests'],11:['candidateFreezes','iterations','freshContexts'],12:['runs','requirements','tests','freshContexts'],13:['verification','runs','requirements'],14:['defects','comparisons','verification'],15:['defects','rootCauses'],16:['defects','rootCauses','regressions','regressionExecutions'],17:['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions'],18:['iterations','runs','verification','comparisons','defects','regressions','regressionExecutions','blockers'],19:['convergenceRecords','candidateFreezes','tests','regressions','regressionExecutions'],20:['confirmationRecords','candidateFreezes','iterations'],21:['baselines','freshContexts'],22:['products','tests','artifacts'],23:['products','requirements','sources'],24:['products','requirements','regressions','regressionExecutions'],25:['products','artifacts'],26:['products','baselines','deterministicResults','meaningResults','adversarialResults','representationInspections'],27:['requirements','tests','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','defects','blockers','regressionExecutions'],28:['releaseRecords','artifactIdentities','artifacts'],29:['sources','requirements','instructions','instructionTraces','runs','products','tests','verification','deterministicResults','meaningResults','releaseRecords','artifactIdentities','evidenceRecords'],30:['defects','rootCauses','regressions','regressionExecutions','changes','baselines']});
const APPLICATION_COLLECTIONS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>[i+1,Object.freeze(['blockers','freshContexts','artifacts','releaseRecords','artifactIdentities','evidenceChains'])])));
const HUMAN_ACTIONS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>[i+1,Object.freeze(['ANSWER_HUMAN_INPUT','REJECT_RESPONSE','REQUEST_CORRECTION'])])));
const SCOPE_REQUIREMENTS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>{const s=i+1,keys=['projectRevision','inputVersion'];if(s>=3)keys.push('sourceSetVersion');if(s>=5)keys.push('requirementsVersion');if(s>=7)keys.push('testSuiteVersion');if(s>=9)keys.push('instructionVersion');if(s>=10&&s<=20)keys.push('iterationId','candidateId');if([11,12,17,19].includes(s))keys.push('runId','contextId');if(s>=20)keys.push('baselineId');if(s>=21)keys.push('productId');return [s,Object.freeze([...new Set(keys)])];})));
function operationContract(stage,operation){const operations=STAGE_OPERATIONS[stage]||['COMPLETE'];if(!operations.includes(operation))return null;return Object.freeze({operation,readCollections:Object.freeze(READ_COLLECTIONS[stage]||[]),agentWritableCollections:Object.freeze(STAGE_COLLECTIONS[stage]||[]),applicationCollections:Object.freeze(APPLICATION_COLLECTIONS[stage]||[]),humanActions:Object.freeze(HUMAN_ACTIONS[stage]||[]),scopeRequirements:Object.freeze(SCOPE_REQUIREMENTS[stage]||[])});}

const HUMAN_INTAKE_FIELDS=Object.freeze([
  'JOB_TITLE','JOB_OWNER','EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY','REQUIRED_OUTPUT_FORMAT',
  'DEADLINE_OR_TEMPORAL_SCOPE','KNOWN_AUTHORITATIVE_SOURCES','AVAILABLE_TOOLS','PROHIBITED_ACTIONS','EXPLICIT_USER_REQUIREMENTS'
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

const TARGET_PRODUCT_REFERENCE_PATTERN=/(?:closed-loop-tracker|current\s+application|existing\s+application|target\s+product|repository\s+file|source\s+code|app-core\.js|workbook\.js|prompt-engine\.js|TEST_PROJECT\.json|github\.com\/sjonesjones917\/closed-loop-tracker)/i;
function sourceClassificationIssues(fields={}){
  const issues=[];
  const combined=Object.values(fields).join(' ');
  if(TARGET_PRODUCT_REFERENCE_PATTERN.test(combined))issues.push('Target-product, operating-application, or repository artifacts cannot be classified as external governing sources.');
  if(!String(fields.TITLE||'').trim())issues.push('Source title is required.');
  if(!String(fields.ISSUING_ORGANIZATION_OR_AUTHOR||'').trim())issues.push('Issuing organization or author is required.');
  if(!String(fields.URL_REFERENCE||'').trim())issues.push('An external URL or formal reference is required.');
  if(/(?:repository|source code|current ui|existing implementation|target screenshot)/i.test(String(fields.SOURCE_TYPE||'')))issues.push('Source type describes an implementation artifact rather than independent external authority.');
  return issues;
}

globalThis.closedLoopWorkflowSchema=Object.freeze({
  version:'closed-loop-workflow-schema/2',
  PROJECT_SCHEMA,WORKFLOW_ID,STAGE_COUNT,VALUE_TYPES,COLLECTION_POLICIES,DEFAULT_RESOURCE_LIMITS,STAGE_OPERATIONS,READ_COLLECTIONS,APPLICATION_COLLECTIONS,HUMAN_ACTIONS,SCOPE_REQUIREMENTS,RECORD_OWNERSHIP,
  PRODUCER,RESPONSE_SCHEMA,RESPONSE_TYPES,CONFLICT_POLICIES,
  JOB_FIELDS,HUMAN_JOB_FIELDS,APPLICATION_JOB_FIELDS,AGENT_JOB_FIELDS,HUMAN_INTAKE_FIELDS,
  STAGE_FIELDS,STAGE_CONTRACTS,STAGE_COLLECTIONS,SUPPORT_COLLECTIONS,RECORD_SCHEMAS,
  field,stageFieldDefinition,allowedCollections,allowedAgentStageFields,humanStageFields,recordAgentFields,recordHumanFields,operationContract,authorizeMutation,
  sourceClassificationIssues,TARGET_PRODUCT_REFERENCE_PATTERN
});
})();

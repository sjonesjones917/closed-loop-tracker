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
STAGE_OPERATIONS[19]=Object.freeze(['EXECUTE_RUN','VERIFY','COMPARE','REGRESSION_VERIFY','CONFIRM']);
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
  'REQUIRED_OUTPUT_FORMAT','DEADLINE_OR_TEMPORAL_SCOPE','DESIRED_SOURCE_COUNT','KNOWN_AUTHORITATIVE_SOURCES',
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
  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});
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
      "PERMANENT_TEST_LOCATION",
      "APPLICABILITY",
      "RETIREMENT_AUTHORITY"
    ],
    "application": [
      "REG_ID",
      "DEFECT_ID",
      "REQ_ID",
      "FIXTURE_IDENTITY_HASH",
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
const EXPLICIT_STAGE_FIELD_TYPES=Object.freeze({"1":{"ASSUMPTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AVAILABLE_TOOLS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DATE_OPENED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEADLINE_OR_TEMPORAL_SCOPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_DELIVERABLE_REQUESTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_USER_OBJECTIVE_VERBATIM":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPLICIT_USER_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_SET_CONTENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_SET_HASH_OR_MANIFEST":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_SET_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"JOB_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"JOB_OWNER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"JOB_RECORD_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"JOB_TITLE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_AUTHORITATIVE_SOURCES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROHIBITED_ACTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_OUTPUT_FORMAT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SUPPLIED_MATERIALS_INVENTORY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNKNOWN_INFORMATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"10":{"ALL_REQUIRED_COMPONENTS_PRESENT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ALL_RUNS_WILL_RECEIVE_IDENTICAL_FROZEN_MATERIALS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CHANGES_ALLOWED_DURING_BATCH":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FREEZE_DATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FREEZE_OWNER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FROZEN_COMPONENT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"HASHES_RECORDED_WHERE_PRACTICAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOL_CONFIGURATION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"11":{"CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTAMINATED_RUNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FRESH_CONTEXTS_CREATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FROZEN_EXECUTION_PACKAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUTS_SAVED_SEPARATELY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUNS_RECEIVING_EXACT_PACKAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUN_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"12":{"ACTIVE_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ACTUAL_MANDATORY_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPECTED_MANDATORY_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MISSING_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"REQUIREMENTS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SATISFIED_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"SELF_VALIDATED_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEST_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDETERMINED_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"VERIFICATION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"VIOLATED_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"13":{"COMPARISON_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CORRECTNESS_AFFECTING_DISAGREEMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INCONCLUSIVE_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROHIBITED_OUTPUT_VARIANCES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REPEATED_FAILURE_GROUPS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_SATISFIED_BY_ALL_TEN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_WITH_AT_LEAST_ONE_UNDETERMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_WITH_AT_LEAST_ONE_VIOLATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENT_COMPARISON_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNIQUE_FAILURES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"14":{"BLOCKED_ANALYSES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONFIRMED_ROOT_CAUSES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_ROOT_CAUSE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"ROOT_CAUSE_ANALYSIS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_MATERIAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNDETERMINED_ROOT_CAUSES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"15":{"CONFIRMED_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"CONFIRMED_DEFECTS_WITH_REGRESSION_TEST":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_TEST_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_TEST_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"POST_CORRECTION_SUCCESSES_PROVEN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRE_CORRECTION_FAILURES_PROVEN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSION_FIXTURE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNCONVERTED_CONFIRMED_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"16":{"ARTIFACTS_CHANGED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ARTIFACT_CHANGE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"CHANGE_SET_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DOWNSTREAM_VERIFICATIONS_INVALIDATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IF_EXECUTION_ONLY_DEFECT_WAS_INSTRUCTION_PRESERVED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_CHANGED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IN_PLACE_MODIFICATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_VERSIONS_CREATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PREFLIGHT_REPEATED_IF_CHANGED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RCA_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TRIGGERING_DEFECT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"17":{"CHANGESET_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COMPARE_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CORRECTIONS_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTE_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IDENTICAL_PACKAGE_CONFIRMED_FOR_ALL_RUNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_FROZEN_VERSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OLD_CONVERSATIONS_CONTINUED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PREVIOUS_CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PREVIOUS_ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRIOR_OUTPUTS_WITHHELD":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSION_TESTS_ADDED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ROOT_CAUSE_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUN_NAMESPACE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEN_NEW_CONTEXTS_CREATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERIFY_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"18":{"ALL_CONDITIONS_SIMULTANEOUSLY_TRUE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"CRITICAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILED_CONDITIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_CORRECTNESS_AFFECTING_AMBIGUITIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_CORRECTNESS_AFFECTING_CONTRADICTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MAJOR_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MANDATORY_REQUIREMENTS_WITH_AFFIRMATIVE_APPLICABLE_VERIFICATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENTS_WITH_COMPLETE_SPECIFICATION_AND_APPLICABILITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENT_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"MANDATORY_UNRESOLVED_UNKNOWNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MANDATORY_VERIFICATION_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"METRICS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSION_TEST_SUCCESS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RETURN_STAGE_FOR_EACH_FAILURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SUCCESSFUL_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_STILL_APPLICABLE_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNEXPLAINED_CORRECTNESS_AFFECTING_EXECUTION_VARIANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"19":{"ALL_REGRESSION_TESTS_RUN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"COMPLETE_TEST_SUITE_RUN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONFIRMATION_ACCEPTANCE_CRITERIA_SATISFIED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONFIRMATION_ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CROSS_RUN_COMPARISON_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INJECTED_DEFECTS_NOT_DETECTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_CORRECTNESS_AFFECTING_VARIANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_CRITICAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_MAJOR_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_REQUIREMENTS_DISCOVERED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_RETURN_STAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUNS_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SAME_FROZEN_PACKAGE_USED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_CONVERGED_ITERATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEN_NEW_CONTEXTS_CREATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ZERO_CHANGE_AUDIT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"2":{"AUTHORITY_HIERARCHY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_CONTROLLING_SOURCES_EXAMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_CONFLICT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"SOURCE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"SOURCE_SET_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNRESOLVED_CONTROLLING_CONFLICTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"20":{"ALL_APPROVED_COMPONENTS_PRESENT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ALL_IMMUTABLE_FILES_HASHED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ANY_CHANGED_COMPONENT_RETAINS_BASELINE_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"APPROVED_VERSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_APPROVAL_DATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_FILE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_OWNER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_PACKAGE_SEPARATED_FROM_WORKING_FILES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SUPPORTING_CONFIRMATION_ITERATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNCHANGED_CONFIRMATION_SUCCEEDED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"}},"21":{"AFFECTED_VALIDATION_IDENTIFIED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_MATERIALS_SUPPLIED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EDITED_OUTSIDE_CONTROLLED_WORKFLOW":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EDIT_REQUIRED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTION_RECORD":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FRESH_CONTEXT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IF_YES_NEW_PRODUCT_VERSION_CREATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_FILE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"PRODUCTION_CONTEXT_REFERENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"22":{"APPLICABLE_MANDATORY_DETERMINISTIC_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DETERMINISTIC_TEST_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MISSING_TEST_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_HASHES_BEFORE_TEST":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_REJECTED_BY_MANDATORY_FAILURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SATISFIED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEST_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDETERMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"VALIDATOR_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VIOLATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"23":{"ACTIVE_MEANING_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVALUATOR_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVALUATOR_INDEPENDENT_FROM_GENERATOR":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MEANING_RECORDS_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MEANING_REQUIREMENT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MEANING_RUBRIC_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SATISFIED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDETERMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNSUPPORTED_BARE_CONCLUSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VIOLATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"24":{"ADVERSARIAL_CHECK_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"ADVERSARIAL_REVIEW_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ATTACKS_EXECUTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CRITICAL_DEFECTS_FOUND":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MAJOR_DEFECTS_FOUND":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_DEFECTS_FOUND":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSIONS_FOUND":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RETURN_TO_ROOT_CAUSE_REQUIRED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REVIEWER_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REVIEWER_INDEPENDENT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDETERMINED_ATTACKS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"25":{"APPROVED_BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DELIVERY_ARTIFACT_INVENTORY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FINAL_REPRESENTATION_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PACKAGE_INSPECTION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"PAGE_OR_VIEW_INSPECTION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REPRESENTATION_REVIEW_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_DELIVERY_ARTIFACTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_PACKAGED_FILES_OPENED_OR_TESTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_PACKAGED_FILES_REQUIRED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_PAGES_OR_VIEWS_INSPECTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_PAGES_OR_VIEWS_REQUIRED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TRANSFORMATION_CHAIN_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNRESOLVED_CRITICAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNRESOLVED_MAJOR_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNRESOLVED_REPRESENTATION_UNKNOWNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"26":{"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_REASON":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MISSING_EVIDENCE_LINKS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_CORRECTNESS_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_PRODUCT_DISCREPANCIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_REVIEW":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_CORRECTNESS_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_REVIEW":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RECONCILED_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RECONCILIATION_BLOCKER_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RECONCILIATION_DEFECT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REVIEW_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"27":{"AFFIRMATIVE_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKER_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKING_REQUIREMENT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_DECISION_RULE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_REASON":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DATE_AND_TIME":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILED_TEST_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENTS_DEMONSTRABLY_VIOLATED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENTS_NOT_ESTABLISHED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENTS_WITH_AFFIRMATIVE_SUPPORTING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_VALIDATORS_FAILED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_VALIDATORS_SUCCEEDED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"MANDATORY_VALIDATORS_UNDETERMINED_OR_NOT_RUN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RECONCILED_REVIEW_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_GATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SELECTED_RELEASE_STATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_MANDATORY_VALIDATORS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNDETERMINED_OR_MISSING_TEST_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNRESOLVED_CRITICAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNRESOLVED_DEFECT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNRESOLVED_MAJOR_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"VIOLATED_REQUIREMENT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"28":{"ALL_RELEASE_HASHES_EQUAL_AUDITED_HASHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ANY_POST_REVIEW_MODIFICATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ARTIFACT_HASH_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"AUTHORIZATION_DATE_AND_TIME":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORIZATION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORIZED_BY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DELIVERY_AUTHORIZATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_AUTHORIZED_ARTIFACT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_AUTHORIZED_FILENAMES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HASH_ALGORITHM":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HASH_OPERATOR":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HASH_REVIEW_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HASH_TOOL_AND_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_GATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_GATE_STATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_ARTIFACTS_REHASHED_IMMEDIATELY_BEFORE_DELIVERY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_ARTIFACTS_REQUIRED_FOR_RELEASE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_ARTIFACTS_WITH_AUDITED_HASH":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_EXACT_HASH_MATCHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_HASH_MISMATCHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_UNKNOWN_HASH_COMPARISONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"29":{"ALL_MANDATORY_EVIDENCE_CHAINS_COMPLETE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE_CHAIN_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE_REPOSITORY_LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FINAL_EVIDENCE_CHAIN_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HASH_REVIEW_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INCOMPLETE_CHAIN_REQ_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"JOB_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_EVIDENCE_CHAIN_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"MANDATORY_REQUIREMENT_EVIDENCE_CHAIN_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_GATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REPRODUCTION_INSTRUCTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_MANDATORY_REQUIREMENTS_WITH_COMPLETE_CHAINS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_MANDATORY_REQUIREMENTS_WITH_INCOMPLETE_CHAINS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_MANDATORY_REQUIREMENTS_WITH_UNKNOWN_CHAIN_LINKS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"UNKNOWN_CHAIN_REQ_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"3":{"ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"CANDIDATE_REQUIREMENT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"CONFLICTING_OR_INVALIDATING_MATERIAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXCEPTIONS_AND_EDGE_CONDITIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"LATEST_PASS_NUMBER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESEARCH_GAPS_AND_BLOCKERS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESEARCH_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_RESEARCH_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"30":{"CONFIRMED_DEFECTS_MISSING_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"DEFECT_RECORDS_MISSING_REQUIRED_FIELDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_REGISTRY_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FINAL_REGISTRY_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FUTURE_BASELINE_REGRESSION_EXECUTION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"REGISTRY_HASH_OR_INTEGRITY_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGISTRY_IS_APPEND_ONLY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"REGISTRY_RETENTION_RULE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGISTRY_STORAGE_LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"REGRESSION_REGISTRY_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_ACTIVE_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_CONFIRMED_DEFECTS_WITH_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_DEFECT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TOTAL_RETIRED_REGRESSION_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"4":{"ATOMICITY_REVIEW_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKED_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONDITIONAL_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFINED_TERM_GAPS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OPTIONAL_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"5":{"APPLICABILITY_UNDETERMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CIRCULAR_DEPENDENCIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DUPLICATES_REMAINING":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IMPOSSIBLE_COMBINATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_REQUIREMENTS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_BLOCKERS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MISSING_PREREQUISITES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_REQUIREMENTS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_WITHOUT_VERIFICATION_PATH":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENT_DEFECT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDEFINED_TERMS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNRESOLVED_CONFLICTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNSUPPORTED_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"6":{"ACTIVE_MANDATORY_REQUIREMENTS_WITH_AT_LEAST_ONE_READY_TEST":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKED_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COVERAGE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_TEST_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEST_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"TEST_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOTAL_ACTIVE_MANDATORY_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"}},"7":{"ACTIVE_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECTIVE_VALIDATORS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILURE_TEST_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"FAILURE_TEST_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"INVALID_FIXTURES_ACCEPTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MUTATION_SUITE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENTS_WITH_AT_LEAST_ONE_FAILURE_TEST":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"8":{"AUTHORIZED_INPUTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COMPLETION_CRITERIA":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_RULES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFINED_TERMS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DRAFT_INSTRUCTION_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_FAILURE_RULES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_TRACE_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"OBJECTIVE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_CONTRACT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_PROCEDURE_IN_ORDER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SCOPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_AUTHORITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOL_RULES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERIFICATION_AND_FAILURE_HANDLING":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"9":{"DECISION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVERY_SENTENCE_REVIEWED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUT_INSTRUCTION_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_MATERIAL_AMBIGUITIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KNOWN_MATERIAL_CONFLICTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_INSTRUCTION_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PREFLIGHT_ITERATION_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"PREFLIGHT_REVIEWER_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REVIEW_CONTEXT_INDEPENDENT_FROM_AUTHOR":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SENTENCE_REVIEW_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"STAGE_DECISION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNAVAILABLE_REQUIRED_CAPABILITIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNVERIFIABLE_INSTRUCTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}}});
const EXPLICIT_RECORD_FIELD_TYPES=Object.freeze({"ARTIFACT":{"ARTIFACT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AVAILABILITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BYTE_SIZE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FILENAME":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NOTES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ROLE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SHA256":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STORAGE_REFERENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TYPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"ARTIFACT-IDENTITY":{"ARTIFACT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"AUDITED_BYTE_SIZE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUDITED_FILENAME":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUDITED_SHA256":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUDITED_STORAGE_REFERENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUDITED_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORIZATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_HASH_MATCH":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_SIZE_MATCH":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IDENTITY_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"POST_AUDIT_MODIFICATION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRE_DELIVERY_SHA256":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_BYTE_SIZE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_FILENAME":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_STORAGE_REFERENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"ATTACK":{"ACTUAL_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ATTACK":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ATTACK_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPECTED_BEHAVIOR":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"METHOD":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"SEVERITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"BASELINE":{"APPROVED_VERSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORIZED_RECIPIENT_ROLES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLED_STORAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HASHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"HUMAN_AUTHORIZATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IMMUTABLE_ARTIFACT_RECORDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SUPPORTING_CONFIRMATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"}},"BLOCKER":{"AFFECTED_ARTIFACTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AFFECTED_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AFFECTED_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ATTEMPTED_RESOLUTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKER_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CLOSURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DOWNSTREAM_WORK_STOPPED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MISSING_FACT_INPUT_AUTHORITY_EVIDENCE_CAPABILITY_DECISION_RULE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MISSING_ITEM_TYPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OWNER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REEVALUATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_REVALIDATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESOLUTION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"WHY_WORK_CANNOT_CONTINUE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"CANDIDATE":{"BATCH_CHANGE_RULE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COMPONENT_HASHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COMPONENT_MANIFEST":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COMPONENT_VERSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"IMMUTABLE_LOCATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"LIMITATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PERMISSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ROLE_DISTRIBUTION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SETTINGS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOL_CONFIGURATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"CANDIDATE-REQ":{"APPLICABILITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CANDIDATE_OBLIGATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CANDIDATE_REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CLASSIFICATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEPENDENCIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"SOURCE_LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"CHAIN":{"ARTIFACT_HASH_IDENTITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"AUTHORITY_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CHAIN_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"MISSING_LINKS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ELEMENT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEASE_DECISION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEST_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"TEST_RESULT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"CHAIN-INVESTIGATION":{"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FOUND_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INVESTIGATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INVESTIGATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MISSING_LINK":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RECOMMENDED_ACTION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"UNRESOLVED_REASON":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"CHANGESET":{"AUTHORIZATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CHANGESET_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DOWNSTREAM_INVALIDATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_MODIFICATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_CHANGE_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"JUSTIFIED_UNCHANGED_ARTIFACTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_ARTIFACT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OLD_ARTIFACT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_REPEATED_PREFLIGHT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_RERUNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESPONSIBLE_LAYER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ROOT_CAUSE_ANALYSIS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TRIGGERING_DEFECT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"COMPARISON":{"ALL_TEN_SATISFIED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ANY_UNDETERMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"ANY_VIOLATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"BOOLEAN"},"AUTHORIZED_VARIANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COMPARISON_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CORRECTNESS_AFFECTING_VARIANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INCONCLUSIVE_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INTERPRETATION_VARIANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_VARIANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REPEATED_FAILURE_PATTERNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"RUN_DETERMINATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNIQUE_FAILURES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"CONFIRMATION":{"COMPARISON_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COMPLETE_TEST_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONFIRMATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONFIRMATION_ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_FAILURE_CASES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NEW_VARIANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REGRESSION_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"TEN_NEW_CONTEXTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERSION_HASH_COMPARISON":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ZERO_MATERIAL_CHANGES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"CONTEXT":{"AUTHORIZED_EXTERNAL_SOURCE_MATERIAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORIZED_PROJECT_INPUTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTAMINATION_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTEXT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEVIATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXTERNAL_CONTEXT_IDENTIFIER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FROZEN_ARTIFACT_VERSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"OUTPUT_IDENTITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ROLE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUN_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"TOOL_AVAILABILITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"USABILITY_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"CONVERGENCE":{"CONVERGED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONVERGENCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CORRECTNESS_AFFECTING_AMBIGUITY_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"CORRECTNESS_AFFECTING_CONTRADICTION_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"CRITICAL_DEFECT_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILED_CONDITIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"MAJOR_DEFECT_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MANDATORY_UNRESOLVED_UNKNOWN_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"REGRESSION_SUCCESS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"REQUIREMENT_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"},"RETURN_STAGES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"VERIFICATION_COVERAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"NUMBER"}},"DEFECT":{"CHANGED_ARTIFACTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CORRECTION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPECTED_CONDITION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBSERVED_FAILURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"REG_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"RELATIONSHIPS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"ROOT_CAUSE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ROOT_CAUSE_CATEGORY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUN_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"SEVERITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERIFICATION_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"DETERMINISTIC-RESULT":{"ACTUAL_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPECTED_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCEDURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"PRODUCT_SHA256":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESULT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEST_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"TOOL_AND_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"EVIDENCE":{"ATTACHMENT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"AUTHORITY_TYPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTENT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DESCRIPTION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"KIND":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SHA256":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"GATE-REVIEW":{"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"CONTROLLING_RULE_ANALYSIS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"GATE_REVIEW_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBSERVED_BLOCKERS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBSERVED_MISSING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBSERVED_VIOLATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"}},"INSPECTION":{"ARTIFACT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"BEFORE_AFTER_HASHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BYTE_SIZE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FILENAME":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSPECTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBSERVATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RENDERING_OPENING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_BY_TRACE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SHA256":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TRANSFORMATION_CHAIN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TRANSFORMATION_TOOLS_VERSIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"ITERATION":{"CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"CHANGESET_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"LINEAGE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PREVIOUS_ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"PURPOSE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"MEANING-REVIEW":{"DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE_BASED_COMPARISON":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXTERNAL_SOURCE_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MEANING_REVIEW_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBSERVED_MEANING":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"PRODUCT_LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_MEANING":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"UNDETERMINED_REASON":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"MUTATION":{"ACTUAL_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPECTED_REJECTION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FIXTURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MUTATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"VALIDATOR_DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"VIOLATION_MODE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"PREFLIGHT-REVIEW":{"CLAUSE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CORRECTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILURE_BEHAVIOR_DEFINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FINDINGS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"INTERNAL_CONFLICTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MULTIPLE_INTERPRETATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBJECTIVELY_VERIFIABLE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ORDER_CLEAR":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESPONSIBLE_OPERATION_ASSIGNED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REVIEW_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TRACEABILITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNAVAILABLE_CAPABILITIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDEFINED_OBJECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNSUPPLIED_DEPENDENCIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"PROCESS-AUDIT":{"APPROVED_INPUTS_VS_ACTUAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"APPROVED_INSTRUCTION_VS_ACTUAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"APPROVED_TOOLS_VS_ACTUAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORIZED_CHANGES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKERS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CHAIN_OF_CUSTODY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_AUDIT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCESS_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIRED_TESTS_VS_EXECUTED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNAUTHORIZED_MODIFICATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"PRODUCT":{"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"BASELINE_MATERIALS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEVIATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTION_TIMESTAMPS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILURES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"GENERATED_ARTIFACT_INVENTORY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCTION_CONTEXT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOL_CONFIGURATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"PRODUCT-AUDIT":{"AFFIRMATIVE_SATISFACTION_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"BLOCKERS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CRITICAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MAJOR_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MANDATORY_REQUIREMENT_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MANDATORY_TEST_COUNT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MANDATORY_UNKNOWNS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MEANING_VERIFICATION_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_AUDIT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VALIDATOR_RESULTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"PRODUCTION-INSTRUCTION":{"AUTHORITY_RULES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORIZED_INPUTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BRANCHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"COMPLETION_CONDITIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFINED_TERMS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FACTUAL_STATE_HANDLING":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILURE_HANDLING":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_TEXT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBJECTIVE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ORDERED_PROCEDURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_CONTRACT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROHIBITIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REJECTION_BLOCKING_RULES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENT_TRACEABILITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SCOPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOL_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"RCA":{"CATEGORY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"DOWNSTREAM_INVALIDATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EARLIEST_DEFECTIVE_LAYER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"LAYER_TRACE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RCA_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ROOT_CAUSE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"REG":{"ACTIVE_RETIRED_STATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"APPLICABILITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CORRECTION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"DETECTION_METHOD":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILURE_FIXTURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FIXTURE_IDENTITY_HASH":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PERMANENT_TEST_LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"POST_CORRECTION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"POST_CORRECTION_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRE_CORRECTION_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRE_CORRECTION_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REG_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REPRODUCTION_PROCEDURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"RETIREMENT_AUTHORITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"REG-EXEC":{"CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"EVIDENCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"EXECUTED_AT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"PHASE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"REG_EXEC_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REG_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"RELEASE":{"AFFIRMATIVE_EVIDENCE_COUNTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BASELINE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"BLOCKERS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKING_REQUIREMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_DECISION_RULE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CRITICAL_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILED_TESTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILED_VALIDATORS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MAJOR_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"MANDATORY_REQUIREMENT_COUNTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NOT_RUN_VALIDATORS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PRODUCT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"RELEASE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNDETERMINED_COUNTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNKNOWN_VALIDATORS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"UNRESOLVED_DEFECTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"INTEGER"},"VALIDATOR_COUNTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VIOLATED_COUNTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VIOLATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"REQ":{"APPLICABILITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFINED_TERMS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEPENDENCIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPECTED_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILURE_CONDITION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INTENDED_VERIFICATION_METHOD":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_OPTIONAL_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NOTES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBLIGATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBSERVABLE_SATISFACTION_CONDITION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROHIBITIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQUIREMENT_TYPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SEVERITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_AUTHORITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"SOURCE_LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"USER_INPUT_RELATIONSHIP":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"REQ-RESOLUTION":{"AFFECTED_DOWNSTREAM_WORK":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AFFECTED_REQ_IDS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CHANGED_REQUIREMENT_REFS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEFECT_TYPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"GOVERNING_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESOLUTION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESOLUTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESULTING_REQUIREMENTS_VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"RESEARCH":{"APPLICABILITY_FACTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CANDIDATE_REQUIREMENT_REFS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DEPENDENCIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_PORTION_EXAMINED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXAMPLES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXCEPTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPLANATORY_MATERIAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FINDING_CLASSIFICATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INVALIDATING_MATERIAL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"MANDATORY_STATEMENTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OPTIONAL_PRACTICES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PASS_NUMBER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROHIBITIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RECOMMENDATIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESEARCH_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESTRICTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SATURATION_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"}},"RUN":{"CANDIDATE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"COMPLETE_OUTPUT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTAMINATION_CHECK":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTEXT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"ENDED_AT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXECUTION_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FRESH_CONTEXT_RECORD":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ITERATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"NOTES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_ARTIFACT_IDENTITIES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OUTPUT_HASHES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RUN_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"STARTED_AT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOL_CONFIGURATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOL_FAILURES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"SOURCE":{"APPLICABLE_PORTIONS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORITY_LEVEL":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORITY_ROLE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_STATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CURRENCY_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSPECTION_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"ISSUING_ORGANIZATION_OR_AUTHOR":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"LOCAL_COPY_SHA256":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NOTES":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PUBLICATION_ORIGIN":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PUBLICATION_UPDATE_DATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RELEVANCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RETRIEVAL_DATE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_TYPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SUPERSESSION_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TITLE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"URL_REFERENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERSION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"SOURCE-CONFLICT":{"AFFECTED_WORK":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"AUTHORITY_RESOLUTION_RULE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"BLOCKER_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"CONFLICTING_PROPOSITION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONFLICT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"CONTROLLING_SOURCE_OBJECTIVELY_ESTABLISHED":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESOLUTION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"RESOLUTION_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_A":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"SOURCE_A_AUTHORITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"SOURCE_B":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"SOURCE_B_AUTHORITY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"TEST":{"EVIDENCE_TO_PRESERVE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPECTED_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"FAILURE_CONDITION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCEDURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEST_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TEST_TYPE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TOOLS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"TRACE":{"EVIDENCE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"IMPLEMENTED_BEHAVIOR":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INSTRUCTION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"INSTRUCTION_LOCATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"TRACE_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}},"VERIFICATION":{"DEFECT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"DETERMINATION":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXACT_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXPECTED_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INDEPENDENCE_STATUS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"INPUTS":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"OBSERVED_RESULT":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"PROCEDURE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"REQ_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"RUN_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"TEST_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"REFERENCE"},"UNDETERMINED_REASON":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERIFICATION_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERIFIER":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"VERIFIER_CONTEXT_ID":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"}}});
const RECORD_FIELD_TYPE_OVERRIDES=Object.freeze({
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
    const producer=ownerFromPartition(ownership,name,title),type=RECORD_FIELD_TYPE_OVERRIDES[prefix]?.[name]||EXPLICIT_RECORD_FIELD_TYPES[prefix]?.[name];if(!type)throw new Error(`${title} field ${name} has no explicit type metadata.`);
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
  ],required:['FAILURE_FIXTURE','REPRODUCTION_PROCEDURE','DETECTION_METHOD','PRE_CORRECTION_RESULT','PRE_CORRECTION_EVIDENCE','CORRECTION','PERMANENT_TEST_LOCATION','APPLICABILITY','ACTIVE_RETIRED_STATE'],relationships:{DEFECT_ID:'defects',REQ_ID:'requirements'}}),
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


const READ_COLLECTIONS=Object.freeze({1:[],2:[],3:['sources','sourceConflicts'],4:['research','candidateRequirements','sources'],5:['requirements','research','sourceConflicts'],6:['requirements','requirementResolutions'],7:['requirements','tests'],8:['requirements','tests','failureTests','requirementResolutions'],9:['instructions','instructionTraces','requirements','tests'],10:['instructions','preflightRecords','tests','failureTests'],11:['candidateFreezes','iterations','runs','freshContexts'],12:['runs','requirements','tests','freshContexts'],13:['verification','runs','requirements'],14:['defects','comparisons','verification'],15:['defects','rootCauses'],16:['defects','rootCauses','regressions','regressionExecutions'],17:['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions'],18:['iterations','runs','verification','comparisons','defects','regressions','regressionExecutions','blockers'],19:['convergenceRecords','candidateFreezes','tests','regressions','regressionExecutions'],20:['confirmationRecords','candidateFreezes','iterations'],21:['baselines','freshContexts'],22:['products','tests','artifacts'],23:['products','requirements','sources'],24:['products','requirements','regressions','regressionExecutions'],25:['products','artifacts'],26:['products','baselines','deterministicResults','meaningResults','adversarialResults','representationInspections'],27:['requirements','tests','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','defects','blockers','regressionExecutions'],28:['releaseRecords','artifactIdentities','artifacts'],29:['sources','requirements','instructions','instructionTraces','runs','products','tests','verification','deterministicResults','meaningResults','releaseRecords','artifactIdentities','evidenceRecords'],30:['defects','rootCauses','regressions','regressionExecutions','changes','baselines']});
const APPLICATION_COLLECTIONS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>[i+1,Object.freeze(['blockers','freshContexts','artifacts','releaseRecords','artifactIdentities','evidenceChains'])])));
const HUMAN_ACTIONS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>[i+1,Object.freeze(['ANSWER_HUMAN_INPUT','REJECT_RESPONSE','REQUEST_CORRECTION'])])));
const SCOPE_REQUIREMENTS=Object.freeze(Object.fromEntries(Array.from({length:STAGE_COUNT},(_,i)=>{const s=i+1,keys=['projectRevision','inputVersion'];if(s>=3)keys.push('sourceSetVersion');if(s>=5)keys.push('requirementsVersion');if(s>=7)keys.push('testSuiteVersion');if(s>=9)keys.push('instructionVersion');if(s>=10&&s<=20)keys.push('iterationId','candidateId');if(s===11)keys.push('runId','contextId');if(s>=20)keys.push('baselineId');if(s>=21)keys.push('productId');return [s,Object.freeze([...new Set(keys)])];})));
const OPERATION_CONTRACT_OVERRIDES=Object.freeze({
  17:Object.freeze({
    FREEZE:Object.freeze({readCollections:['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions'],agentWritableCollections:[],agentStageFields:['NEW_FROZEN_VERSIONS','OLD_CONVERSATIONS_CONTINUED','RUN_NAMESPACE','IDENTICAL_PACKAGE_CONFIRMED_FOR_ALL_RUNS','PRIOR_OUTPUTS_WITHHELD']}),
    EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts'],agentWritableCollections:['runs'],agentStageFields:[]}),
    VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts'],agentWritableCollections:['verification'],agentStageFields:[]}),
    COMPARE:Object.freeze({readCollections:['verification','runs','requirements'],agentWritableCollections:['comparisons'],agentStageFields:['EXECUTE_COMPLETED','VERIFY_COMPLETED','COMPARE_COMPLETED']}),
    ROOT_CAUSE:Object.freeze({readCollections:['defects','comparisons','verification'],agentWritableCollections:['defects','rootCauses'],agentStageFields:['ROOT_CAUSE_COMPLETED']}),
    REGRESSION:Object.freeze({readCollections:['defects','rootCauses','regressions','regressionExecutions'],agentWritableCollections:['regressions','regressionExecutions'],agentStageFields:['REGRESSION_TESTS_ADDED']}),
    CORRECT:Object.freeze({readCollections:['defects','rootCauses','regressions','regressionExecutions','changes'],agentWritableCollections:['changes'],agentStageFields:['CORRECTIONS_COMPLETED']})
  }),
  19:Object.freeze({
    EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts'],agentWritableCollections:['runs'],agentStageFields:[]}),
    VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts'],agentWritableCollections:['verification'],agentStageFields:[]}),
    COMPARE:Object.freeze({readCollections:['verification','runs','requirements'],agentWritableCollections:['comparisons'],agentStageFields:['CROSS_RUN_COMPARISON_COMPLETED']}),
    REGRESSION_VERIFY:Object.freeze({readCollections:['regressions','regressionExecutions','runs'],agentWritableCollections:['regressionExecutions'],agentStageFields:[]}),
    CONFIRM:Object.freeze({readCollections:['runs','verification','comparisons','regressionExecutions','candidateFreezes'],agentWritableCollections:['confirmationRecords'],agentStageFields:['COMPLETE_TEST_SUITE_RUN','NEW_CRITICAL_DEFECTS','NEW_MAJOR_DEFECTS','NEW_REQUIREMENTS_DISCOVERED','INJECTED_DEFECTS_NOT_DETECTED','NEW_CORRECTNESS_AFFECTING_VARIANCE','CONFIRMATION_ACCEPTANCE_CRITERIA_SATISFIED','REQUIRED_RETURN_STAGE']})
  })
});
function operationContract(stage,operation){const operations=STAGE_OPERATIONS[stage]||['COMPLETE'];if(!operations.includes(operation))return null;const override=OPERATION_CONTRACT_OVERRIDES[stage]?.[operation]||{};let scopeRequirements=override.scopeRequirements||SCOPE_REQUIREMENTS[stage]||[];if((stage===17||stage===19)&&!['EXECUTE_RUN','VERIFY'].includes(operation))scopeRequirements=scopeRequirements.filter(key=>key!=='runId'&&key!=='contextId');return Object.freeze({operation,readCollections:Object.freeze(override.readCollections||READ_COLLECTIONS[stage]||[]),agentWritableCollections:Object.freeze(override.agentWritableCollections||STAGE_COLLECTIONS[stage]||[]),agentStageFields:Object.freeze(override.agentStageFields||allowedAgentStageFields(stage)),applicationCollections:Object.freeze(APPLICATION_COLLECTIONS[stage]||[]),humanActions:Object.freeze(HUMAN_ACTIONS[stage]||[]),scopeRequirements:Object.freeze(scopeRequirements)});}

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

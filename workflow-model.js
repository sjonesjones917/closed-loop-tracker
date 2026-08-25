(()=>{
'use strict';

const RESPONSE_SCHEMA='closed-loop-stage-response/1';
const RESPONSE_TYPES=Object.freeze(['DATA_PROPOSAL','HUMAN_INPUT_REQUIRED','BLOCKED','EXECUTION_FAILED']);
const PRODUCERS=Object.freeze({HUMAN:'HUMAN',APPLICATION:'APPLICATION',AGENT:'AGENT',HUMAN_DECISION:'HUMAN_DECISION'});
const CONFLICT_POLICIES=Object.freeze(['reject','request clarification','controlled override']);

const label=value=>String(value||'')
  .replace(/([a-z0-9])([A-Z])/g,'$1 $2')
  .replaceAll('_',' ')
  .replace(/\s+/g,' ')
  .trim()
  .replace(/\b\w/g,c=>c.toUpperCase());

const meta=(producer,{editable=producer===PRODUCERS.HUMAN||producer===PRODUCERS.HUMAN_DECISION,requiredAtStage=null,derivation=null,responsePath=null,authority=null,conflictPolicy='reject',provenanceRequired=producer===PRODUCERS.AGENT,kind='text',help=''}={})=>Object.freeze({
  producer,editable,requiredAtStage,derivation,responsePath,authority:authority||producer,conflictPolicy,provenanceRequired,kind,help
});

const HUMAN_INTAKE_FIELDS=Object.freeze([
  'VERBATIM_JOB_REQUEST','SUPPLIED_MATERIALS','EXPLICIT_CONSTRAINTS','EXPLICIT_PROHIBITIONS',
  'EXPLICIT_DECISIONS','KNOWN_AUTHORITY_SUPPLIED_BY_USER','ALLOWED_OR_REQUIRED_TOOLS',
  'REQUESTED_OUTPUT_FORMAT','TEMPORAL_SCOPE','GEOGRAPHIC_OR_JURISDICTIONAL_SCOPE'
]);

const JOB_FIELDS=Object.freeze({
  JOB_ID:meta(PRODUCERS.APPLICATION,{derivation:'allocateUniqueJobId()',kind:'id'}),
  JOB_TITLE:meta(PRODUCERS.AGENT,{requiredAtStage:1,responsePath:'stageData.JOB_TITLE',authority:'accepted Stage 01 proposal',conflictPolicy:'request clarification'}),
  JOB_OWNER:meta(PRODUCERS.HUMAN,{requiredAtStage:1,authority:'operator'}),
  DATE_OPENED:meta(PRODUCERS.APPLICATION,{derivation:'creation timestamp',kind:'datetime'}),
  EXACT_USER_OBJECTIVE_VERBATIM:meta(PRODUCERS.APPLICATION,{requiredAtStage:1,derivation:'exact copy of User Job Input.VERBATIM_JOB_REQUEST',authority:'User Job Input',kind:'longtext'}),
  EXACT_DELIVERABLE_REQUESTED:meta(PRODUCERS.AGENT,{requiredAtStage:1,responsePath:'stageData.EXACT_DELIVERABLE_REQUESTED',authority:'accepted Stage 01 proposal',conflictPolicy:'request clarification',kind:'longtext'}),
  SUPPLIED_MATERIALS_INVENTORY:meta(PRODUCERS.APPLICATION,{requiredAtStage:1,derivation:'User Job Input supplied-material records',authority:'User Job Input',kind:'longtext'}),
  REQUIRED_OUTPUT_FORMAT:meta(PRODUCERS.AGENT,{requiredAtStage:1,responsePath:'stageData.REQUIRED_OUTPUT_FORMAT',authority:'User Job Input plus accepted Stage 01 proposal',conflictPolicy:'request clarification',kind:'longtext'}),
  DEADLINE_OR_TEMPORAL_SCOPE:meta(PRODUCERS.AGENT,{requiredAtStage:1,responsePath:'stageData.DEADLINE_OR_TEMPORAL_SCOPE',authority:'User Job Input plus accepted Stage 01 proposal',conflictPolicy:'request clarification',kind:'longtext'}),
  GEOGRAPHIC_OR_JURISDICTIONAL_SCOPE:meta(PRODUCERS.AGENT,{requiredAtStage:1,responsePath:'stageData.GEOGRAPHIC_OR_JURISDICTIONAL_SCOPE',authority:'User Job Input plus accepted Stage 01 proposal',conflictPolicy:'request clarification',kind:'longtext'}),
  KNOWN_AUTHORITATIVE_SOURCES:meta(PRODUCERS.APPLICATION,{derivation:'exact User Job Input known-authority statement',authority:'User Job Input',kind:'longtext'}),
  AVAILABLE_TOOLS:meta(PRODUCERS.APPLICATION,{derivation:'exact User Job Input tool statement',authority:'User Job Input',kind:'longtext'}),
  PROHIBITED_ACTIONS:meta(PRODUCERS.APPLICATION,{derivation:'exact User Job Input prohibitions',authority:'User Job Input',kind:'longtext'}),
  EXPLICIT_USER_REQUIREMENTS:meta(PRODUCERS.APPLICATION,{derivation:'exact User Job Input constraints and decisions',authority:'User Job Input',kind:'longtext'}),
  ASSUMPTIONS:meta(PRODUCERS.AGENT,{requiredAtStage:1,responsePath:'stageData.ASSUMPTIONS',authority:'accepted Stage 01 proposal',conflictPolicy:'request clarification',kind:'longtext'}),
  UNKNOWN_INFORMATION:meta(PRODUCERS.AGENT,{requiredAtStage:1,responsePath:'stageData.UNKNOWN_INFORMATION',authority:'accepted Stage 01 proposal',conflictPolicy:'request clarification',kind:'longtext'}),
  INPUT_SET_CONTENTS:meta(PRODUCERS.APPLICATION,{derivation:'canonical User Job Input and supplied-material identities',kind:'longtext'}),
  INPUT_SET_HASH_OR_MANIFEST:meta(PRODUCERS.APPLICATION,{derivation:'SHA-256 of bytes when available; otherwise controlled manifest with UNKNOWN hashes',kind:'longtext'}),
  JOB_RECORD_STATUS:meta(PRODUCERS.APPLICATION,{derivation:'Stage 01 gate',kind:'state'}),
  STATUS_EVIDENCE:meta(PRODUCERS.APPLICATION,{derivation:'Stage 01 canonical evidence references',kind:'longtext'}),
  CURRENT_ITERATION:meta(PRODUCERS.APPLICATION,{derivation:'latest active iteration',kind:'id'}),
  CURRENT_STAGE:meta(PRODUCERS.APPLICATION,{derivation:'earliest non-complete stage',kind:'state'}),
  CURRENT_STATE:meta(PRODUCERS.APPLICATION,{derivation:'workflow engine',kind:'state'}),
  CURRENT_INPUT_VERSION:meta(PRODUCERS.APPLICATION,{derivation:'User Job Input version sequence',kind:'version'}),
  CURRENT_SOURCE_SET_VERSION:meta(PRODUCERS.APPLICATION,{derivation:'accepted Stage 02 source-set version or NOT APPLICABLE',kind:'version'}),
  CURRENT_RESEARCH_VERSION:meta(PRODUCERS.APPLICATION,{derivation:'accepted Stage 03 research version or NOT APPLICABLE',kind:'version'}),
  CURRENT_REQUIREMENTS_VERSION:meta(PRODUCERS.APPLICATION,{derivation:'accepted Stage 04/05 requirements version or NOT APPLICABLE',kind:'version'}),
  CURRENT_TEST_SUITE_VERSION:meta(PRODUCERS.APPLICATION,{derivation:'accepted Stage 06 test-suite version or NOT APPLICABLE',kind:'version'}),
  CURRENT_MUTATION_SUITE_VERSION:meta(PRODUCERS.APPLICATION,{derivation:'accepted Stage 07 mutation-suite version or NOT APPLICABLE',kind:'version'}),
  CURRENT_INSTRUCTION_VERSION:meta(PRODUCERS.APPLICATION,{derivation:'accepted Stage 08 production-instruction version or NOT APPLICABLE',kind:'version'}),
  CURRENT_BASELINE_ID:meta(PRODUCERS.APPLICATION,{derivation:'latest valid Stage 20 baseline or NONE',kind:'id'}),
  CURRENT_PRODUCT_ID:meta(PRODUCERS.APPLICATION,{derivation:'latest Stage 21 product or NONE',kind:'id'}),
  CURRENT_BLOCKERS:meta(PRODUCERS.APPLICATION,{derivation:'open mandatory blocker IDs',kind:'state'}),
  NEXT_REQUIRED_ACTION:meta(PRODUCERS.APPLICATION,{derivation:'workflow engine',kind:'longtext'}),
  LATEST_EVIDENCE_REFERENCE:meta(PRODUCERS.APPLICATION,{derivation:'latest canonical evidence or UNKNOWN',kind:'id'})
});

const applicationStageField=(name,stage)=>{
  const upper=String(name).toUpperCase();
  if(['STAGE_DECISION','DECISION_EVIDENCE'].includes(upper))return false;
  if(stage===1&&['JOB_OWNER'].includes(upper))return false;
  if(stage===1&&['EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY','KNOWN_AUTHORITATIVE_SOURCES','AVAILABLE_TOOLS','PROHIBITED_ACTIONS','EXPLICIT_USER_REQUIREMENTS'].includes(upper))return true;
  if(/(^|_)(ID|VERSION|HASH|SHA256|DATE_AND_TIME|TIMESTAMP)$/.test(upper))return true;
  if(/(^TOTAL_|^CURRENT_|^LATEST_|^EXPECTED_|^ACTUAL_|^MISSING_|^UNRESOLVED_|^BLOCKED_|^ACTIVE_|^MANDATORY_|^OPTIONAL_|^CONDITIONAL_|^CRITICAL_|^MAJOR_|^MINOR_|^RUNS_|^OUTPUTS_|^FRESH_CONTEXTS_|^CONTAMINATED_|^DUPLICATES_|^UNDEFINED_|^CIRCULAR_|^UNSUPPORTED_|^APPLICABILITY_|^REQUIREMENTS_WITH_|^INVALID_FIXTURES_|^DEFECTIVE_VALIDATORS|^IN_PLACE_MODIFICATIONS|^OLD_CONVERSATIONS_|^TEN_NEW_CONTEXTS_|^ALL_|^ANY_|^ZERO_|^NO_|^REGISTRY_IS_|^DEFECT_RECORDS_MISSING_|^CONFIRMED_DEFECTS_MISSING_)/.test(upper))return true;
  if(/(COVERAGE|COUNT|COUNTS|STATUS|STATE|DETERMINATION|AUTHORIZATION|MATCHES|MISMATCHES|SUCCEEDED|COMPLETED|COMPLETE|PRESENT|EQUAL|RECONCILE|RECONCILED|NOT_RUN|UNKNOWN_COMPARISONS)$/.test(upper))return true;
  if(/(_RECORDS|_IDS|_INVENTORY)$/.test(upper))return true;
  return false;
};

function stageFieldMetadata(stage){
  const out={};
  for(const field of stage.fields||[]){
    let producer=PRODUCERS.AGENT;
    if(field==='STAGE_DECISION'||field==='DECISION_EVIDENCE')producer=PRODUCERS.HUMAN_DECISION;
    else if(stage.number===1&&field==='JOB_OWNER')producer=PRODUCERS.HUMAN;
    else if(applicationStageField(field,stage.number))producer=PRODUCERS.APPLICATION;
    out[field]=meta(producer,{
      editable:producer===PRODUCERS.HUMAN||producer===PRODUCERS.HUMAN_DECISION,
      requiredAtStage:stage.number,
      derivation:producer===PRODUCERS.APPLICATION?'workflow-engine canonical derivation':null,
      responsePath:producer===PRODUCERS.AGENT?`stageData.${field}`:null,
      authority:producer===PRODUCERS.AGENT?'accepted stage response with evidence':producer,
      conflictPolicy:producer===PRODUCERS.AGENT?'request clarification':'reject',
      provenanceRequired:producer===PRODUCERS.AGENT,
      kind:/(EVIDENCE|RECORDS|MATERIAL|SCOPE|RULE|CONDITION|PROCEDURE|OUTPUT|INPUT|UNKNOWN|ASSUMPTION|CONFLICT|ARTIFACT|DEFECT|BLOCKER|RESULT|RESEARCH|AUTHORITY|TOOLS|FILES|CONTENTS|NOTES|LOCATION|REASON|CHANGE|DEPEND|INVALID|REVIEW|COMPARISON)/.test(field)?'longtext':'text'
    });
  }
  return Object.freeze(out);
}

const f=(name,producer=PRODUCERS.AGENT,opts={})=>[name,meta(producer,{responsePath:producer===PRODUCERS.AGENT?`records[].${name}`:null,authority:producer===PRODUCERS.AGENT?'accepted stage response with evidence':producer,conflictPolicy:producer===PRODUCERS.AGENT?'request clarification':'reject',...opts})];
const schema=(title,id,prefix,stage,fields,{applicationFields=[],humanDecisionFields=[],relationships={},appendOnly=true,universal=false}={})=>{
  const map={};
  for(const name of fields){
    const producer=name===id||applicationFields.includes(name)?PRODUCERS.APPLICATION:humanDecisionFields.includes(name)?PRODUCERS.HUMAN_DECISION:PRODUCERS.AGENT;
    map[name]=meta(producer,{
      editable:producer===PRODUCERS.HUMAN_DECISION,
      requiredAtStage:stage,
      derivation:producer===PRODUCERS.APPLICATION?'application allocation or deterministic derivation':null,
      responsePath:producer===PRODUCERS.AGENT?`records.${title}[].${name}`:null,
      authority:producer===PRODUCERS.AGENT?'accepted stage response with evidence':producer,
      conflictPolicy:producer===PRODUCERS.AGENT?'request clarification':'reject',
      provenanceRequired:producer===PRODUCERS.AGENT&&!['NOTES'].includes(name),
      kind:/(EVIDENCE|NOTES|OBLIGATION|PROCEDURE|INPUTS|TOOLS|RESULT|FAILURE|SOURCE|DEPEND|PROHIB|TERMS|CONDITION|FIXTURE|CONFIGURATION|MANIFEST|HASHES|VARIANCE|CHANGE|INVALIDATION|AUDIT|MATERIAL|OBSERV|MEANING|CHAIN|BLOCKER|RECORD|LOCATION|DESCRIPTION|CONTENT|EXCERPT)/.test(name)?'longtext':'text'
    });
  }
  return Object.freeze({title,label:title,id,prefix,stage,fields:Object.freeze(fields.slice()),fieldMeta:Object.freeze(map),relationships:Object.freeze(relationships),appendOnly,universal});
};

const RECORD_SCHEMAS=Object.freeze({
  sources:schema('External Sources','SOURCE_ID','SOURCE',2,[
    'SOURCE_ID','TITLE','ISSUING_ORGANIZATION_OR_AUTHOR','SOURCE_TYPE','PUBLICATION_ORIGIN','URL_OR_REFERENCE','VERSION',
    'PUBLICATION_OR_UPDATE_DATE','RETRIEVAL_DATE','AUTHORITY_LEVEL','AUTHORITY_ROLE','RELEVANCE','APPLICABLE_PORTIONS',
    'INSPECTION_STATUS','CURRENCY_STATUS','SUPERSESSION_STATUS','CONTROLLING_STATE','LOCAL_COPY_ARTIFACT_REF','SOURCE_SHA256',
    'SOURCE_CLASS','INDEPENDENT_EXTERNAL_AUTHORITY','TARGET_PRODUCT_RELATIONSHIP','NOTES'
  ],{applicationFields:['SOURCE_ID','RETRIEVAL_DATE','SOURCE_SHA256']}),
  sourceConflicts:schema('Source Conflicts','CONFLICT_ID','SOURCE-CONFLICT',2,[
    'CONFLICT_ID','SOURCE_A','SOURCE_B','CONFLICTING_PROPOSITION','SOURCE_A_AUTHORITY','SOURCE_B_AUTHORITY','AUTHORITY_RESOLUTION_RULE',
    'OBJECTIVE_CONTROLLING_SOURCE_ESTABLISHED','RESOLUTION','RESOLUTION_STATUS','AFFECTED_WORK','BLOCKER_REF','EVIDENCE'
  ],{applicationFields:['CONFLICT_ID','RESOLUTION_STATUS'],relationships:{SOURCE_A:'sources',SOURCE_B:'sources',BLOCKER_REF:'blockers'}}),
  research:schema('Research Records','RESEARCH_ID','RESEARCH',3,[
    'RESEARCH_ID','SOURCE_ID','PASS_NUMBER','EXACT_PORTION_EXAMINED','FINDING_CLASS','FINDING','MANDATORY_STATEMENTS','RECOMMENDATIONS',
    'OPTIONAL_PRACTICES','EXAMPLES','EXPLANATORY_MATERIAL','PROHIBITIONS','EXCEPTIONS','DEPENDENCIES','APPLICABILITY_FACTS',
    'RESTRICTIONS','INVALIDATING_MATERIAL','CANDIDATE_REQUIREMENT_REFS','EVIDENCE'
  ],{applicationFields:['RESEARCH_ID'],relationships:{SOURCE_ID:'sources',CANDIDATE_REQUIREMENT_REFS:'candidateRequirements'}}),
  candidateRequirements:schema('Candidate Requirements','CANDIDATE_REQ_ID','CANDIDATE-REQ',3,[
    'CANDIDATE_REQ_ID','SOURCE_ID','SOURCE_LOCATION','CANDIDATE_OBLIGATION','FINDING_CLASS','APPLICABILITY','EVIDENCE','STATUS'
  ],{applicationFields:['CANDIDATE_REQ_ID','STATUS'],relationships:{SOURCE_ID:'sources'}}),
  requirements:schema('Requirement Records','REQ_ID','REQ',4,[
    'REQ_ID','OBLIGATION','REQUIREMENT_TYPE','MANDATORY_OR_OPTIONAL','GOVERNING_SOURCE_REF','SOURCE_LOCATION','SOURCE_AUTHORITY',
    'USER_INPUT_RELATIONSHIP','APPLICABILITY','DEPENDENCIES','PROHIBITIONS','DEFINED_TERMS','OBSERVABLE_SATISFACTION_CONDITION',
    'INTENDED_VERIFICATION_METHOD','EXPECTED_EVIDENCE','FAILURE_CONDITION','SEVERITY','STATUS','NOTES'
  ],{applicationFields:['REQ_ID','STATUS'],relationships:{GOVERNING_SOURCE_REF:'sources',DEPENDENCIES:'requirements'}}),
  tests:schema('Verification Tests','TEST_ID','TEST',6,[
    'TEST_ID','REQ_ID','TEST_TYPE','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'
  ],{applicationFields:['TEST_ID','STATUS'],relationships:{REQ_ID:'requirements'}}),
  failureTests:schema('Failure Tests','MUTATION_ID','MUTATION',7,[
    'MUTATION_ID','REQ_ID','VIOLATION_MODE','FIXTURE','EXPECTED_REJECTION','ACTUAL_RESULT','VALIDATOR_DEFECT_REF','EVIDENCE','STATUS'
  ],{applicationFields:['MUTATION_ID','STATUS'],relationships:{REQ_ID:'requirements',VALIDATOR_DEFECT_REF:'defects'}}),
  instructions:schema('Production Instructions','INSTRUCTION_ID','INSTRUCTION',8,[
    'INSTRUCTION_ID','INSTRUCTION_VERSION','OBJECTIVE','AUTHORIZED_INPUTS','FAILURE_HANDLING','AUTHORITY_RULES','SCOPE','PROHIBITIONS',
    'DEFINED_TERMS','ORDERED_PROCEDURE','BRANCHES','TOOL_REQUIREMENTS','OUTPUT_CONTRACT','TRUE_FALSE_UNKNOWN_HANDLING',
    'REJECTION_AND_BLOCKING_RULES','COMPLETION_CONDITIONS','REQUIREMENT_TRACE_REFS','CONTENT','CONTENT_SHA256','STATUS'
  ],{applicationFields:['INSTRUCTION_ID','INSTRUCTION_VERSION','CONTENT_SHA256','STATUS'],relationships:{REQUIREMENT_TRACE_REFS:'requirements'}}),
  preflightRecords:schema('Instruction Reviews','PREFLIGHT_ID','PREFLIGHT',9,[
    'PREFLIGHT_ID','INSTRUCTION_REF','CLAUSE','MULTIPLE_INTERPRETATIONS','UNDEFINED_OBJECTS','UNSUPPLIED_DEPENDENCIES','INTERNAL_CONFLICTS',
    'UNAVAILABLE_CAPABILITIES','OBJECTIVE_VERIFIABILITY','RESPONSIBLE_OPERATION','ORDERING','FAILURE_BEHAVIOR','TRACEABILITY','FINDING',
    'CORRECTION','DETERMINATION','EVIDENCE'
  ],{applicationFields:['PREFLIGHT_ID'],relationships:{INSTRUCTION_REF:'instructions'}}),
  candidateFreezes:schema('Candidate Freezes','CANDIDATE_ID','CANDIDATE',10,[
    'CANDIDATE_ID','ITERATION_ID','COMPONENT_MANIFEST','COMPONENT_VERSIONS','COMPONENT_HASHES','ROLE_DISTRIBUTION','IMMUTABLE_LOCATIONS',
    'TOOL_CONFIGURATION','SETTINGS','PERMISSIONS','LIMITATIONS','STATUS','EVIDENCE'
  ],{applicationFields:['CANDIDATE_ID','ITERATION_ID','COMPONENT_HASHES','STATUS']}),
  iterations:schema('Iterations','ITERATION_ID','ITERATION',10,[
    'ITERATION_ID','CANDIDATE_ID','ITERATION_TYPE','PREVIOUS_ITERATION_REF','CHANGESET_REF','CREATED_AT','STATUS','EVIDENCE'
  ],{applicationFields:['ITERATION_ID','CREATED_AT','STATUS'],relationships:{CANDIDATE_ID:'candidateFreezes',PREVIOUS_ITERATION_REF:'iterations',CHANGESET_REF:'changes'}}),
  runs:schema('Execution Runs','RUN_ID','RUN',11,[
    'RUN_ID','ITERATION_ID','CONTEXT_ID','STARTED_AT','ENDED_AT','FROZEN_CANDIDATE_REF','CONTAMINATION_STATUS','TOOL_CONFIGURATION',
    'EXECUTION_STATUS','OUTPUT_REF','OUTPUT_SHA256','TOOL_FAILURES','NOTES'
  ],{applicationFields:['RUN_ID','STARTED_AT','ENDED_AT','OUTPUT_SHA256','EXECUTION_STATUS'],relationships:{ITERATION_ID:'iterations',FROZEN_CANDIDATE_REF:'candidateFreezes',OUTPUT_REF:'generatedOutputs'}}),
  verification:schema('Run Verification','VERIFICATION_ID','VERIFY',12,[
    'VERIFICATION_ID','REQ_ID','RUN_ID','TEST_ID','VERIFIER','VERIFIER_CONTEXT_ID','INDEPENDENCE_STATUS','INPUTS','PROCEDURE',
    'EXPECTED_RESULT','OBSERVED_RESULT','EXACT_EVIDENCE','DETERMINATION','DEFECT_REF','UNDETERMINED_REASON'
  ],{applicationFields:['VERIFICATION_ID'],relationships:{REQ_ID:'requirements',RUN_ID:'runs',TEST_ID:'tests',DEFECT_REF:'defects'}}),
  comparisons:schema('Cross-Run Comparisons','COMPARISON_ID','COMPARE',13,[
    'COMPARISON_ID','REQ_ID','RUN_DETERMINATIONS','ALL_TEN_SATISFIED','ANY_VIOLATION','ANY_UNDETERMINED','INTERPRETATION_VARIANCE',
    'OUTPUT_VARIANCE','AUTHORIZED_VARIANCE','INCONCLUSIVE_TESTS','REPEATED_FAILURES','UNIQUE_FAILURES','CORRECTNESS_AFFECTING_VARIANCE',
    'DEFECT_REFS','EVIDENCE'
  ],{applicationFields:['COMPARISON_ID','RUN_DETERMINATIONS','ALL_TEN_SATISFIED','ANY_VIOLATION','ANY_UNDETERMINED'],relationships:{REQ_ID:'requirements',DEFECT_REFS:'defects'}}),
  defects:schema('Defects','DEFECT_ID','DEFECT',14,[
    'DEFECT_ID','DATE','JOB_ID','ITERATION_ID','RUN_ID','PRODUCT_ID','REQ_ID','OBSERVED_FAILURE','EXPECTED_CONDITION','EVIDENCE',
    'SEVERITY','ROOT_CAUSE_CATEGORY','ROOT_CAUSE','CORRECTION','CHANGED_ARTIFACT_REFS','REGRESSION_REF','VERIFICATION_RESULT','STATUS','RELATIONSHIPS'
  ],{applicationFields:['DEFECT_ID','DATE','JOB_ID','STATUS'],relationships:{ITERATION_ID:'iterations',RUN_ID:'runs',PRODUCT_ID:'products',REQ_ID:'requirements',REGRESSION_REF:'regressions'}}),
  rootCauses:schema('Root Causes','RCA_ID','RCA',14,[
    'RCA_ID','DEFECT_ID','CATEGORY','EARLIEST_DEFECTIVE_LAYER','BACKWARD_TRACE','ROOT_CAUSE','EVIDENCE','DOWNSTREAM_INVALIDATION'
  ],{applicationFields:['RCA_ID'],relationships:{DEFECT_ID:'defects'}}),
  regressions:schema('Regression Tests','REG_ID','REG',15,[
    'REG_ID','DEFECT_ID','REQ_ID','FAILURE_FIXTURE','FIXTURE_ARTIFACT_REF','FIXTURE_SHA256','REPRODUCTION_PROCEDURE','DETECTION_METHOD',
    'PRE_CORRECTION_RESULT','PRE_CORRECTION_EVIDENCE','CORRECTION','POST_CORRECTION_RESULT','POST_CORRECTION_EVIDENCE','PERMANENT_TEST_LOCATION',
    'APPLICABILITY','ACTIVE_OR_RETIRED','RETIREMENT_AUTHORITY'
  ],{applicationFields:['REG_ID','FIXTURE_SHA256','ACTIVE_OR_RETIRED'],relationships:{DEFECT_ID:'defects',REQ_ID:'requirements',FIXTURE_ARTIFACT_REF:'artifacts'}}),
  changes:schema('Changes and Invalidations','CHANGESET_ID','CHANGESET',16,[
    'CHANGESET_ID','TRIGGERING_DEFECT_REFS','ROOT_CAUSE_ANALYSIS','RESPONSIBLE_LAYER','OLD_ARTIFACT_VERSION','EXACT_MODIFICATION',
    'NEW_ARTIFACT_VERSION','DOWNSTREAM_INVALIDATION','REQUIRED_RERUNS','INSTRUCTION_CHANGE_DETERMINATION','REPEATED_PREFLIGHT_REQUIRED',
    'JUSTIFIED_UNCHANGED_ARTIFACTS','REVALIDATION_STATE','EVIDENCE'
  ],{applicationFields:['CHANGESET_ID','NEW_ARTIFACT_VERSION','DOWNSTREAM_INVALIDATION','REQUIRED_RERUNS','REVALIDATION_STATE'],relationships:{TRIGGERING_DEFECT_REFS:'defects'}}),
  convergenceRecords:schema('Convergence Records','CONVERGENCE_ID','CONVERGENCE',18,[
    'CONVERGENCE_ID','ITERATION_ID','MANDATORY_REQUIREMENT_COVERAGE','MANDATORY_VERIFICATION_COVERAGE','REGRESSION_SUCCESS',
    'CRITICAL_DEFECT_COUNT','MAJOR_DEFECT_COUNT','MANDATORY_UNRESOLVED_UNKNOWN_COUNT','CORRECTNESS_AFFECTING_CONTRADICTION_COUNT',
    'CORRECTNESS_AFFECTING_AMBIGUITY_COUNT','UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE_COUNT','CONVERGED','EVIDENCE'
  ],{applicationFields:['CONVERGENCE_ID','MANDATORY_REQUIREMENT_COVERAGE','MANDATORY_VERIFICATION_COVERAGE','REGRESSION_SUCCESS','CRITICAL_DEFECT_COUNT','MAJOR_DEFECT_COUNT','MANDATORY_UNRESOLVED_UNKNOWN_COUNT','CORRECTNESS_AFFECTING_CONTRADICTION_COUNT','CORRECTNESS_AFFECTING_AMBIGUITY_COUNT','UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE_COUNT','CONVERGED'],relationships:{ITERATION_ID:'iterations'}}),
  confirmationRecords:schema('Confirmation Records','CONFIRMATION_ID','CONFIRMATION',19,[
    'CONFIRMATION_ID','ITERATION_ID','UNCHANGED_COMPONENT_IDENTITIES','TEN_NEW_CONTEXTS','TEST_RESULT_SUMMARY','REGRESSION_RESULT_SUMMARY',
    'NEW_DEFECT_REFS','NEW_REQUIREMENT_GAPS','NEW_FAILURE_CASES','NEW_VARIANCE','CONFIRMED','EVIDENCE'
  ],{applicationFields:['CONFIRMATION_ID','UNCHANGED_COMPONENT_IDENTITIES','TEN_NEW_CONTEXTS','TEST_RESULT_SUMMARY','REGRESSION_RESULT_SUMMARY','CONFIRMED'],relationships:{ITERATION_ID:'iterations',NEW_DEFECT_REFS:'defects'}}),
  baselines:schema('Baselines','BASELINE_ID','BASELINE',20,[
    'BASELINE_ID','SUPPORTING_CONFIRMATION_REF','APPROVED_VERSIONS','APPROVED_HASHES','IMMUTABLE_ARTIFACT_REFS','AUTHORIZED_RECIPIENT_ROLES',
    'CONTROLLED_STORAGE','VALID','EVIDENCE'
  ],{applicationFields:['BASELINE_ID','APPROVED_HASHES','VALID'],humanDecisionFields:['AUTHORIZED_RECIPIENT_ROLES'],relationships:{SUPPORTING_CONFIRMATION_REF:'confirmationRecords',IMMUTABLE_ARTIFACT_REFS:'artifacts'}}),
  products:schema('Products','PRODUCT_ID','PRODUCT',21,[
    'PRODUCT_ID','PRODUCT_VERSION','BASELINE_ID','EXECUTION_ID','FRESH_CONTEXT_ID','BASELINE_MATERIAL_REFS','STARTED_AT','ENDED_AT',
    'INSTRUCTION_VERSION','TOOL_CONFIGURATION','DEVIATIONS','FAILURES','GENERATED_ARTIFACT_REFS','STATUS'
  ],{applicationFields:['PRODUCT_ID','PRODUCT_VERSION','STARTED_AT','ENDED_AT','STATUS'],relationships:{BASELINE_ID:'baselines',FRESH_CONTEXT_ID:'freshContexts',GENERATED_ARTIFACT_REFS:'artifacts'}}),
  deterministicResults:schema('Deterministic Product Verification','RESULT_ID','DET-RESULT',22,[
    'RESULT_ID','PRODUCT_ID','PRODUCT_SHA256','TEST_ID','TOOL_AND_VERSION','PROCEDURE','EXPECTED_RESULT','ACTUAL_RESULT','DETERMINATION','EVIDENCE','DEFECT_REF'
  ],{applicationFields:['RESULT_ID','PRODUCT_SHA256'],relationships:{PRODUCT_ID:'products',TEST_ID:'tests',DEFECT_REF:'defects'}}),
  meaningResults:schema('Independent Meaning Review','MEANING_REVIEW_ID','MEANING',23,[
    'MEANING_REVIEW_ID','REQ_ID','PRODUCT_ID','PRODUCT_LOCATION','EXTERNAL_SOURCE_EVIDENCE','REQUIRED_MEANING','OBSERVED_MEANING',
    'EVIDENCE_BASED_COMPARISON','DETERMINATION','DEFECT_REF','UNDETERMINED_REASON','REVIEWER_CONTEXT_ID'
  ],{applicationFields:['MEANING_REVIEW_ID'],relationships:{REQ_ID:'requirements',PRODUCT_ID:'products',DEFECT_REF:'defects'}}),
  adversarialResults:schema('Adversarial Verification','ATTACK_ID','ATTACK',24,[
    'ATTACK_ID','PRODUCT_ID','ATTACK','METHOD','EXPECTED_BEHAVIOR','ACTUAL_RESULT','DETERMINATION','DEFECT_REF','SEVERITY','EVIDENCE','REVIEWER_CONTEXT_ID'
  ],{applicationFields:['ATTACK_ID'],relationships:{PRODUCT_ID:'products',DEFECT_REF:'defects'}}),
  representationInspections:schema('Representation Inspections','INSPECTION_ID','INSPECTION',25,[
    'INSPECTION_ID','ARTIFACT_ID','FILENAME','VERSION','BYTE_SIZE','SHA256','REQUIRED_BY_REFS','TRANSFORMATION_CHAIN','TRANSFORMATION_TOOLS_AND_VERSIONS',
    'BEFORE_SHA256','AFTER_SHA256','RENDERING_OR_OPENING_EVIDENCE','CLIPPING','MISSING_CONTENT','BLANK_CONTENT','BROKEN_LAYOUT',
    'MISSING_OR_MISPLACED_GRAPHICS','MATERIAL_FONT_SUBSTITUTION','OVERLAP','HIDDEN_CONTENT','WRONG_ORDER','EXPORT_CORRUPTION',
    'PACKAGE_INVENTORY_FINDINGS','DEFECT_REF','DETERMINATION'
  ],{applicationFields:['INSPECTION_ID','FILENAME','VERSION','BYTE_SIZE','SHA256','BEFORE_SHA256','AFTER_SHA256'],relationships:{ARTIFACT_ID:'artifacts',DEFECT_REF:'defects'}}),
  processAudits:schema('Process Audits','PROCESS_AUDIT_ID','PROCESS-AUDIT',26,[
    'PROCESS_AUDIT_ID','APPROVED_INPUTS_VS_ACTUAL','APPROVED_INSTRUCTION_VS_ACTUAL','APPROVED_TOOLS_VS_ACTUAL','REQUIRED_TESTS_VS_EXECUTED',
    'UNAUTHORIZED_MODIFICATION','AUTHORIZED_CHANGES','CHAIN_OF_CUSTODY','PROCESS_DEFECT_REFS','BLOCKER_REFS','PROCESS_DETERMINATION','PROCESS_EVIDENCE'
  ],{applicationFields:['PROCESS_AUDIT_ID'],relationships:{PROCESS_DEFECT_REFS:'defects',BLOCKER_REFS:'blockers'}}),
  productAudits:schema('Product Audits','PRODUCT_AUDIT_ID','PRODUCT-AUDIT',26,[
    'PRODUCT_AUDIT_ID','MANDATORY_REQUIREMENT_COUNT','AFFIRMATIVE_SATISFACTION_COUNT','MANDATORY_TEST_COUNT','VALIDATOR_RESULTS',
    'MEANING_VERIFICATION_RESULTS','CRITICAL_DEFECT_COUNT','MAJOR_DEFECT_COUNT','MANDATORY_UNKNOWN_COUNT','PRODUCT_DEFECT_REFS','BLOCKER_REFS',
    'PRODUCT_DETERMINATION','PRODUCT_EVIDENCE'
  ],{applicationFields:['PRODUCT_AUDIT_ID','MANDATORY_REQUIREMENT_COUNT','AFFIRMATIVE_SATISFACTION_COUNT','MANDATORY_TEST_COUNT','VALIDATOR_RESULTS','MEANING_VERIFICATION_RESULTS','CRITICAL_DEFECT_COUNT','MAJOR_DEFECT_COUNT','MANDATORY_UNKNOWN_COUNT'],relationships:{PRODUCT_DEFECT_REFS:'defects',BLOCKER_REFS:'blockers'}}),
  releaseRecords:schema('Release Gates','RELEASE_ID','RELEASE',27,[
    'RELEASE_ID','PRODUCT_ID','BASELINE_ID','MANDATORY_REQUIREMENT_COUNT','AFFIRMATIVE_EVIDENCE_COUNT','VIOLATED_COUNT','UNDETERMINED_COUNT',
    'MANDATORY_VALIDATOR_COUNT','FAILED_VALIDATOR_REFS','NOT_RUN_VALIDATOR_REFS','UNKNOWN_VALIDATOR_REFS','CRITICAL_DEFECT_COUNT','MAJOR_DEFECT_COUNT',
    'BLOCKING_REQUIREMENT_REFS','VIOLATION_REFS','FAILED_TEST_REFS','UNRESOLVED_DEFECT_REFS','BLOCKER_REFS','CONTROLLING_DECISION_RULE',
    'RELEASE_DETERMINATION','CONTROLLING_EVIDENCE'
  ],{applicationFields:['RELEASE_ID','MANDATORY_REQUIREMENT_COUNT','AFFIRMATIVE_EVIDENCE_COUNT','VIOLATED_COUNT','UNDETERMINED_COUNT','MANDATORY_VALIDATOR_COUNT','FAILED_VALIDATOR_REFS','NOT_RUN_VALIDATOR_REFS','UNKNOWN_VALIDATOR_REFS','CRITICAL_DEFECT_COUNT','MAJOR_DEFECT_COUNT','BLOCKING_REQUIREMENT_REFS','VIOLATION_REFS','FAILED_TEST_REFS','UNRESOLVED_DEFECT_REFS','BLOCKER_REFS','CONTROLLING_DECISION_RULE','RELEASE_DETERMINATION'],relationships:{PRODUCT_ID:'products',BASELINE_ID:'baselines'}}),
  artifactIdentities:schema('Artifact Identities','IDENTITY_ID','IDENTITY',28,[
    'IDENTITY_ID','ARTIFACT_ID','AUDITED_FILENAME','AUDITED_VERSION','AUDITED_STORAGE_REFERENCE','AUDITED_BYTE_SIZE','AUDITED_SHA256',
    'RELEASE_FILENAME','RELEASE_VERSION','RELEASE_STORAGE_REFERENCE','RELEASE_BYTE_SIZE','PRE_DELIVERY_SHA256','EXACT_HASH_MATCH','EXACT_SIZE_MATCH',
    'POST_AUDIT_MODIFICATION','DELIVERY_AUTHORIZATION','EVIDENCE'
  ],{applicationFields:['IDENTITY_ID','AUDITED_FILENAME','AUDITED_VERSION','AUDITED_STORAGE_REFERENCE','AUDITED_BYTE_SIZE','AUDITED_SHA256','RELEASE_FILENAME','RELEASE_VERSION','RELEASE_STORAGE_REFERENCE','RELEASE_BYTE_SIZE','PRE_DELIVERY_SHA256','EXACT_HASH_MATCH','EXACT_SIZE_MATCH','POST_AUDIT_MODIFICATION','DELIVERY_AUTHORIZATION'],relationships:{ARTIFACT_ID:'artifacts'}}),
  evidenceChains:schema('Evidence Chains','CHAIN_ID','CHAIN',29,[
    'CHAIN_ID','REQ_ID','AUTHORITY_REF','REQUIREMENT_REF','INSTRUCTION_REF','EXECUTION_REF','PRODUCT_ELEMENT_REF','TEST_REF','TEST_RESULT_REF',
    'EVIDENCE_REF','RELEASE_DECISION_REF','ARTIFACT_HASH_IDENTITY_REF','STATUS','MISSING_LINKS'
  ],{applicationFields:['CHAIN_ID','AUTHORITY_REF','REQUIREMENT_REF','INSTRUCTION_REF','EXECUTION_REF','PRODUCT_ELEMENT_REF','TEST_REF','TEST_RESULT_REF','EVIDENCE_REF','RELEASE_DECISION_REF','ARTIFACT_HASH_IDENTITY_REF','STATUS','MISSING_LINKS'],relationships:{REQ_ID:'requirements',AUTHORITY_REF:'sources',REQUIREMENT_REF:'requirements',INSTRUCTION_REF:'instructions',EXECUTION_REF:'runs',TEST_REF:'tests',TEST_RESULT_REF:'verification',RELEASE_DECISION_REF:'releaseRecords',ARTIFACT_HASH_IDENTITY_REF:'artifactIdentities'}}),
  blockers:schema('Blockers','BLOCKER_ID','BLOCKER',1,[
    'BLOCKER_ID','MISSING_ITEM','AFFECTED_REQUIREMENT_REFS','AFFECTED_TEST_REFS','AFFECTED_ARTIFACT_REFS','WHY_WORK_CANNOT_CONTINUE',
    'ATTEMPTED_RESOLUTIONS','DOWNSTREAM_WORK_STOPPED','RESPONSIBLE_ACTOR','STATUS','RESOLUTION_EVIDENCE','CLOSURE','REEVALUATION','REQUIRED_REVALIDATION'
  ],{applicationFields:['BLOCKER_ID','STATUS'],humanDecisionFields:['CLOSURE'],relationships:{AFFECTED_REQUIREMENT_REFS:'requirements',AFFECTED_TEST_REFS:'tests',AFFECTED_ARTIFACT_REFS:'artifacts'},universal:true}),
  freshContexts:schema('Fresh Contexts','CONTEXT_ID','CONTEXT',9,[
    'CONTEXT_ID','JOB_ID','STAGE','ROLE','ITERATION_ID','RUN_ID','AUTHORIZED_PROJECT_INPUTS','AUTHORIZED_EXTERNAL_SOURCE_MATERIAL',
    'FROZEN_ARTIFACT_VERSIONS','TOOL_AVAILABILITY','CONTAMINATION_STATUS','OUTPUT_IDENTITY','DEVIATIONS','EVIDENCE','USABILITY_DETERMINATION'
  ],{applicationFields:['CONTEXT_ID','JOB_ID','STAGE','ROLE'],relationships:{ITERATION_ID:'iterations',RUN_ID:'runs'},universal:true}),
  artifacts:schema('Artifacts','ARTIFACT_ID','ARTIFACT',1,[
    'ARTIFACT_ID','FILENAME','ARTIFACT_TYPE','VERSION','BYTE_SIZE','SHA256','STAGE','ROLE','TIMESTAMP','STORAGE_REFERENCE','AVAILABILITY','NOTES'
  ],{applicationFields:['ARTIFACT_ID','BYTE_SIZE','SHA256','STAGE','ROLE','TIMESTAMP'],universal:true}),
  evidence:schema('Evidence','EVIDENCE_ID','EVIDENCE',1,[
    'EVIDENCE_ID','EVIDENCE_TYPE','DESCRIPTION','SOURCE_REFS','ARTIFACT_REFS','EXACT_EXCERPT','LOCATION','SHA256','CREATED_AT','RAW_RESPONSE_REF'
  ],{applicationFields:['EVIDENCE_ID','SHA256','CREATED_AT'],relationships:{SOURCE_REFS:'sources',ARTIFACT_REFS:'artifacts'},universal:true}),
  humanDecisions:schema('Human Decisions','DECISION_ID','DECISION',1,[
    'DECISION_ID','STAGE','DECISION_TYPE','DECISION','RATIONALE','AUTHORITY','CREATED_AT','RELATED_REFS'
  ],{applicationFields:['DECISION_ID','STAGE','CREATED_AT'],humanDecisionFields:['DECISION','RATIONALE'],universal:true}),
  controlledCorrections:schema('Controlled Corrections','CORRECTION_ID','CORRECTION',1,[
    'CORRECTION_ID','STAGE','TARGET_COLLECTION','TARGET_RECORD_ID','TARGET_FIELD','OLD_VALUE','NEW_VALUE','REASON','OPERATOR_IDENTITY',
    'PROVENANCE','DOWNSTREAM_INVALIDATION','REVALIDATION_REQUIRED','CREATED_AT'
  ],{applicationFields:['CORRECTION_ID','STAGE','OLD_VALUE','DOWNSTREAM_INVALIDATION','REVALIDATION_REQUIRED','CREATED_AT'],humanDecisionFields:['NEW_VALUE','REASON','OPERATOR_IDENTITY','PROVENANCE'],universal:true})
});

const STAGE_COLLECTIONS=Object.freeze({
  1:[],2:['sources','sourceConflicts'],3:['research','candidateRequirements'],4:['requirements'],5:['requirements'],6:['tests'],7:['failureTests'],
  8:['instructions'],9:['preflightRecords'],10:['candidateFreezes','iterations'],11:['runs'],12:['verification'],13:['comparisons'],14:['defects','rootCauses'],
  15:['regressions'],16:['changes'],17:['iterations','candidateFreezes','runs'],18:['convergenceRecords'],19:['iterations','runs','confirmationRecords'],
  20:['baselines'],21:['products','artifacts'],22:['deterministicResults'],23:['meaningResults'],24:['adversarialResults'],25:['representationInspections'],
  26:['processAudits','productAudits'],27:['releaseRecords'],28:['artifactIdentities'],29:['evidenceChains'],30:['defects','regressions']
});

const CONTEXT_CONTRACTS=Object.freeze({
  1:{collections:['userEntered','artifacts','humanInputAnswers'],maxRecords:30},
  2:{collections:['userEntered','artifacts','blockers'],maxRecords:30},
  3:{collections:['sources','sourceConflicts','blockers'],maxRecords:50},
  4:{collections:['research','candidateRequirements','sources'],maxRecords:60},
  5:{collections:['requirements','sourceConflicts','research','blockers'],maxRecords:60},
  6:{collections:['requirements','blockers'],maxRecords:100},
  7:{collections:['requirements','tests'],maxRecords:100},
  8:{collections:['requirements','tests','failureTests','sourceConflicts'],maxRecords:100},
  9:{collections:['instructions','requirements','tests'],maxRecords:100},
  10:{collections:['instructions','requirements','tests','failureTests','preflightRecords','artifacts'],maxRecords:100},
  11:{collections:['candidateFreezes','iterations','freshContexts','artifacts'],maxRecords:40},
  12:{collections:['runs','requirements','tests','freshContexts'],maxRecords:150},
  13:{collections:['verification','runs','requirements'],maxRecords:300},
  14:{collections:['defects','comparisons','verification'],maxRecords:200},
  15:{collections:['defects','rootCauses','tests'],maxRecords:150},
  16:{collections:['defects','rootCauses','regressions','changes'],maxRecords:150},
  17:{collections:['changes','candidateFreezes','tests','regressions','iterations'],maxRecords:150},
  18:{collections:['iterations','runs','verification','comparisons','defects','regressions','blockers'],maxRecords:300},
  19:{collections:['iterations','candidateFreezes','tests','regressions','freshContexts','convergenceRecords'],maxRecords:200},
  20:{collections:['iterations','candidateFreezes','confirmationRecords','baselines'],maxRecords:100},
  21:{collections:['baselines','freshContexts','artifacts','instructions'],maxRecords:100},
  22:{collections:['products','tests','artifacts'],maxRecords:200},
  23:{collections:['products','requirements','sources','freshContexts'],maxRecords:200},
  24:{collections:['products','requirements','regressions','freshContexts'],maxRecords:200},
  25:{collections:['products','artifacts'],maxRecords:200},
  26:{collections:['products','baselines','deterministicResults','meaningResults','adversarialResults','representationInspections'],maxRecords:300},
  27:{collections:['requirements','tests','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','defects','blockers'],maxRecords:400},
  28:{collections:['releaseRecords','artifactIdentities','artifacts'],maxRecords:200},
  29:{collections:['sources','requirements','instructions','runs','products','tests','verification','releaseRecords','artifactIdentities'],maxRecords:500},
  30:{collections:['defects','rootCauses','regressions','changes','baselines'],maxRecords:500}
});

const UNIVERSAL_COLLECTIONS=Object.freeze(['blockers']);
const ID_PREFIXES=Object.freeze(Object.fromEntries(Object.entries(RECORD_SCHEMAS).map(([name,value])=>[name,value.prefix])));
const VERSION_BY_STAGE=Object.freeze({1:['CURRENT_INPUT_VERSION','INPUT'],2:['CURRENT_SOURCE_SET_VERSION','SOURCE-SET'],3:['CURRENT_RESEARCH_VERSION','RESEARCH'],4:['CURRENT_REQUIREMENTS_VERSION','REQUIREMENTS'],5:['CURRENT_REQUIREMENTS_VERSION','REQUIREMENTS'],6:['CURRENT_TEST_SUITE_VERSION','TEST-SUITE'],7:['CURRENT_MUTATION_SUITE_VERSION','MUTATION-SUITE'],8:['CURRENT_INSTRUCTION_VERSION','INSTRUCTION']});

function stageFields(stage){return stageFieldMetadata(stage);}
function allowedCollections(stageNumber){return [...(STAGE_COLLECTIONS[stageNumber]||[]),...UNIVERSAL_COLLECTIONS];}
function allowedStageData(stage){const metadata=stageFields(stage);return Object.keys(metadata).filter(name=>metadata[name].producer===PRODUCERS.AGENT);}
function allowedRecordFields(collection){const schemaDef=RECORD_SCHEMAS[collection];if(!schemaDef)return [];return schemaDef.fields.filter(name=>schemaDef.fieldMeta[name].producer===PRODUCERS.AGENT);}
function humanStageFields(stage){const metadata=stageFields(stage);return Object.keys(metadata).filter(name=>metadata[name].producer===PRODUCERS.HUMAN||metadata[name].producer===PRODUCERS.HUMAN_DECISION);}
function applicationStageFields(stage){const metadata=stageFields(stage);return Object.keys(metadata).filter(name=>metadata[name].producer===PRODUCERS.APPLICATION);}
function responseContract(stage){
  const collections={};
  for(const name of allowedCollections(stage.number))collections[name]={idField:RECORD_SCHEMAS[name].id,allowedFields:allowedRecordFields(name),relationships:RECORD_SCHEMAS[name].relationships};
  return {schema:RESPONSE_SCHEMA,responseTypes:RESPONSE_TYPES.slice(),stage:stage.number,stageDataFields:allowedStageData(stage),collections,humanInputRequestFields:['temporaryKey','question','whyRequired','affectedStageFields','affectedRecords','answerType','allowedValues','blocking']};
}

function assertModel(core=globalThis.closedLoopCore){
  if(!core||!Array.isArray(core.STAGES)||core.STAGES.length!==30)throw new Error('The canonical 30-stage workflow must load before the ownership model.');
  for(const stage of core.STAGES)stageFields(stage);
  return true;
}

const api={RESPONSE_SCHEMA,RESPONSE_TYPES,PRODUCERS,CONFLICT_POLICIES,HUMAN_INTAKE_FIELDS,JOB_FIELDS,RECORD_SCHEMAS,STAGE_COLLECTIONS,CONTEXT_CONTRACTS,UNIVERSAL_COLLECTIONS,ID_PREFIXES,VERSION_BY_STAGE,label,meta,stageFields,allowedCollections,allowedStageData,allowedRecordFields,humanStageFields,applicationStageFields,responseContract,assertModel};
assertModel();
globalThis.closedLoopModel=Object.freeze(api);
dispatchEvent(new Event('closed-loop-model-ready'));
})();

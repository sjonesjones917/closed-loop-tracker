from pathlib import Path

def replace_once(s,old,new,label):
    if new in s:return s
    if old not in s:raise SystemExit(f'missing anchor: {label}')
    return s.replace(old,new,1)

# 1. Canonical Job contract.
p=Path('workbook.js');s=p.read_text()
for old,new,label in [
("job:{JOB_ID:id,JOB_TITLE:","job:{JOB_ID:id,CONTRACT_PROFILE_ID:'closed-loop-completion-profile/1',JOB_TITLE:",'job profile'),
("CURRENT_ITERATION:'',","CURRENT_ITERATION:null,",'iteration null'),
("CURRENT_STATE:'NOT STARTED',","CURRENT_STATE:'AWAITING_HUMAN_INPUT',",'current state'),
("CURRENT_SOURCE_SET_VERSION:'',","CURRENT_SOURCE_SET_VERSION:null,CURRENT_RESEARCH_VERSION:null,",'source/research'),
("CURRENT_REQUIREMENTS_VERSION:'',","CURRENT_REQUIREMENTS_VERSION:null,",'requirements'),
("CURRENT_TEST_SUITE_VERSION:'',","CURRENT_TEST_SUITE_VERSION:null,",'tests'),
("CURRENT_INSTRUCTION_VERSION:'',","CURRENT_INSTRUCTION_VERSION:null,CURRENT_CANDIDATE_ID:null,",'instruction/candidate'),
("CURRENT_BASELINE_ID:'NONE',","CURRENT_BASELINE_ID:null,",'baseline'),
("CURRENT_PRODUCT_ID:'NONE',","CURRENT_PRODUCT_ID:null,CURRENT_PRODUCT_VERSION:null,CURRENT_DELIVERY_CANDIDATE_SET_ID:null,CURRENT_REVIEW_VERSION:null,CURRENT_RECONCILED_REVIEW_VERSION:null,CURRENT_RELEASE_ID:null,CURRENT_HASH_REVIEW_ID:null,CURRENT_EVIDENCE_CHAIN_VERSION:null,CURRENT_DELIVERY_ID:null,",'product and terminal pointers'),
("LATEST_EVIDENCE_REFERENCE:'',","LATEST_EVIDENCE_REFERENCE:null,",'evidence pointer'),
("JOB_RECORD_STATUS:'NOT READY',","JOB_RECORD_STATUS:'INCOMPLETE',",'job status')]:s=replace_once(s,old,new,label)
p.write_text(s)

p=Path('workflow-schema.js');s=p.read_text()
s=replace_once(s,"const RESPONSE_SCHEMA='closed-loop-stage-response/3';","const RESPONSE_SCHEMA='closed-loop-stage-response/3';\nconst CONTRACT_PROFILE_ID='closed-loop-completion-profile/1';",'contract profile const')
old="'JOB_ID','DATE_OPENED','CURRENT_ITERATION','CURRENT_STAGE','CURRENT_STATE','CURRENT_INPUT_VERSION',\n  'CURRENT_SOURCE_SET_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION',\n  'CURRENT_INSTRUCTION_VERSION','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_BLOCKERS',\n  'NEXT_REQUIRED_ACTION','LATEST_EVIDENCE_REFERENCE','INPUT_SET_HASH_OR_MANIFEST','JOB_RECORD_STATUS',"
new="'JOB_ID','CONTRACT_PROFILE_ID','DATE_OPENED','CURRENT_ITERATION','CURRENT_STAGE','CURRENT_STATE','CURRENT_INPUT_VERSION',\n  'CURRENT_SOURCE_SET_VERSION','CURRENT_RESEARCH_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION',\n  'CURRENT_INSTRUCTION_VERSION','CURRENT_CANDIDATE_ID','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_PRODUCT_VERSION',\n  'CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID','CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID','CURRENT_BLOCKERS',\n  'NEXT_REQUIRED_ACTION','LATEST_EVIDENCE_REFERENCE','INPUT_SET_HASH_OR_MANIFEST','JOB_RECORD_STATUS',"
s=replace_once(s,old,new,'application job fields')
oldfn="if(APPLICATION_JOB_FIELDS.includes(name))return field(name,PRODUCER.APPLICATION,{derivation:`Application derives ${name} from canonical project state.`});"
newfn="if(APPLICATION_JOB_FIELDS.includes(name)){\n    const nullablePointers=new Set(['CURRENT_ITERATION','CURRENT_SOURCE_SET_VERSION','CURRENT_RESEARCH_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION','CURRENT_INSTRUCTION_VERSION','CURRENT_CANDIDATE_ID','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_PRODUCT_VERSION','CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID','CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID','LATEST_EVIDENCE_REFERENCE']);\n    const enumValues=name==='CURRENT_STATE'?['BLOCKED','AWAITING_HUMAN_INPUT','PROPOSAL_PENDING_REVIEW','RESPONSE_STAGED','AWAITING_EXTERNAL_RESPONSE','READY_FOR_NEXT_OPERATION','WORKFLOW_COMPLETE']:name==='JOB_RECORD_STATUS'?['INCOMPLETE','BLOCKED','COMPLETE']:[];\n    return field(name,PRODUCER.APPLICATION,{derivation:`Application derives ${name} from canonical project state.`,nullable:nullablePointers.has(name),enumValues,authority:name==='CONTRACT_PROFILE_ID'?CONTRACT_PROFILE_ID:undefined});\n  }"
s=replace_once(s,oldfn,newfn,'job field definition')
s=replace_once(s,"PROJECT_SCHEMA,WORKFLOW_ID,STAGE_COUNT,VALUE_TYPES","PROJECT_SCHEMA,WORKFLOW_ID,STAGE_COUNT,CONTRACT_PROFILE_ID,VALUE_TYPES",'profile export')

# 2. Fail-closed contract-profile migration.
anchor="const PACKAGE_SCHEMA='closed-loop-verification-package/1';\n"
if "const PROFILE_MIGRATION_SCHEMA='closed-loop-contract-profile-migration/1';" not in s:
    ins="""const PACKAGE_SCHEMA='closed-loop-verification-package/1';
const CURRENT_CONTRACT_PROFILE=base.CONTRACT_PROFILE_ID||'closed-loop-completion-profile/1';
const PROFILE_MIGRATION_SCHEMA='closed-loop-contract-profile-migration/1';
function contractProfileIdOf(project){return project?.job?.CONTRACT_PROFILE_ID??project?.contractProfileId??null;}
function validateContractProfile(project){
  const reasons=[];
  if(!project||typeof project!=='object'||Array.isArray(project))reasons.push('PROJECT_OBJECT_REQUIRED');
  if(project?.schema!==CURRENT_PROJECT_SCHEMA)reasons.push('CURRENT_PROJECT_SCHEMA_REQUIRED');
  if(contractProfileIdOf(project)!==CURRENT_CONTRACT_PROFILE)reasons.push('CURRENT_CONTRACT_PROFILE_REQUIRED');
  if(project?.projectData?.currentProfileEligible===false)reasons.push('HISTORICAL_NON_GATING_PROFILE_MIGRATION');
  for(const name of ['JOB_ID','CONTRACT_PROFILE_ID','CURRENT_STAGE','CURRENT_STATE','CURRENT_INPUT_VERSION','CURRENT_BLOCKERS','NEXT_REQUIRED_ACTION','INPUT_SET_HASH_OR_MANIFEST','JOB_RECORD_STATUS'])if(!Object.prototype.hasOwnProperty.call(project?.job||{},name))reasons.push(`MISSING_JOB_FIELD:${name}`);
  return Object.freeze({valid:reasons.length===0,current:reasons.length===0,contractProfileId:contractProfileIdOf(project),reasons:Object.freeze(reasons)});
}
function markHistoricalNonGating(project,original){
  project.projectData=project.projectData&&typeof project.projectData==='object'?project.projectData:{};
  project.projectData.currentProfileEligible=false;
  project.projectData.contractProfileMigration={schema:PROFILE_MIGRATION_SCHEMA,status:'HISTORICAL_NON_GATING',targetContractProfileId:CURRENT_CONTRACT_PROFILE,sourceSchema:String(original?.schema||project?.schema||''),sourceRevision:Number(original?.revision||0),reason:'Legacy data is preserved without fabricating current-profile semantic review, human authority, execution, evidence, file-first exchange, backup, mobile, or delivery proof.',fabricatedProof:false};
  return project;
}
"""
    if anchor not in s:raise SystemExit('missing package schema anchor')
    s=s.replace(anchor,ins,1)
oldmig="""function migrateProjectToCurrent(input){
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
"""
newmig="""function migrateProjectToCurrent(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Imported project must be an object.');
  const original=clone(input);
  if(input.schema===CURRENT_PROJECT_SCHEMA){const current=ensureV3Defaults(clone(input));if(contractProfileIdOf(current)!==CURRENT_CONTRACT_PROFILE)return markHistoricalNonGating(current,original);if(current.projectData?.currentProfileEligible===false)return current;current.projectData.currentProfileEligible=true;return current;}
  let migrated;
  if(input.schema===PREVIOUS_PROJECT_SCHEMA)migrated=clone(input);
  else if(priorMigration){migrated=priorMigration(clone(input));if(migrated&&typeof migrated.then==='function')throw new Error('Project migration must be deterministic and synchronous.');}
  else throw new Error('Unsupported project schema '+String(input.schema));
  migrated=ensureV3Defaults(migrated);restoreMigratedStage01AcceptedCapture(migrated,original);
  const already=migrated.projectData.nonOperationalImportedPayloads.some(item=>item&&item.sourceSchema===original.schema&&item.sourceRevision===Number(original.revision||0)&&item.operational===false);
  if(!already)migrated.projectData.nonOperationalImportedPayloads.push({sourceSchema:String(original.schema||''),sourceRevision:Number(original.revision||0),operational:false,purpose:'ORIGINAL_IMPORTED_PAYLOAD_AUDIT_EVIDENCE',payload:original});
  markHistoricalNonGating(migrated,original);migrated.projectHash='';return migrated;
}
const replacement={...base,PROJECT_SCHEMA:CURRENT_PROJECT_SCHEMA,PROJECT_SCHEMA_ID:CURRENT_PROJECT_SCHEMA,RESPONSE_SCHEMA:CURRENT_RESPONSE_SCHEMA,RESPONSE_SCHEMA_ID:CURRENT_RESPONSE_SCHEMA,PREVIOUS_PROJECT_SCHEMA,PREVIOUS_RESPONSE_SCHEMA,TEST_IR_SCHEMA,PACKAGE_SCHEMA,CONTRACT_PROFILE_ID:CURRENT_CONTRACT_PROFILE,PROFILE_MIGRATION_SCHEMA,validateContractProfile,migrateProjectToCurrent};
"""
if newmig not in s:s=replace_once(s,oldmig,newmig,'migration function')

# 3. Authoritative closed registries and per-operation authority/scope contracts.
marker='/* CLOSED CONTRACT REGISTRY RATC HET /1 */'
if marker not in s:
    layer=r'''
/* CLOSED CONTRACT REGISTRY RATC HET /1 */
;(()=>{
'use strict';
const b=globalThis.closedLoopWorkflowSchema;if(!b)throw new Error('workflow schema required');
const CP=b.CONTRACT_PROFILE_ID||'closed-loop-completion-profile/1';
const RESPONSE_TYPES=Object.freeze(['DATA_PROPOSAL','HUMAN_INPUT_REQUIRED','BLOCKED','EXECUTION_FAILED']);
const appOps=new Set(['10:FREEZE','18:COMPLETE','19:CONFIRM_FREEZE','19:CONFIRM','20:FREEZE_BASELINE','22:RUN_NATIVE_TESTS','24:RUN_NATIVE_ATTACKS','25:FREEZE_DELIVERY_CANDIDATE','27:CALCULATE_RELEASE','28:VERIFY_IDENTITY','29:CALCULATE_EVIDENCE_CHAINS','30:CALCULATE_TERMINAL','17:FREEZE']);
const humanDecisionOps=new Set(['28:CAPTURE_DELIVERY_INTENT']);
const operatorOps=new Set(['30:EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','30:RECORD_DELIVERY_EVIDENCE']);
const routedOps=new Set(['7:EXECUTE_FAILURE_TEST','15:EXECUTE_REGRESSION','17:REGRESSION','19:REGRESSION_VERIFY']);
const stageDims={
1:['inputVersion'],2:['inputVersion','sourceSetVersion'],3:['inputVersion','sourceSetVersion','researchVersion'],4:['inputVersion','sourceSetVersion','researchVersion','requirementsVersion'],5:['inputVersion','sourceSetVersion','researchVersion','requirementsVersion'],6:['requirementsVersion','testSuiteVersion'],7:['requirementsVersion','testSuiteVersion'],8:['requirementsVersion','testSuiteVersion','instructionVersion'],9:['requirementsVersion','testSuiteVersion','instructionVersion'],10:['requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId'],11:['iterationId','candidateId','runId'],12:['iterationId','candidateId','runId','requirementsVersion','testSuiteVersion'],13:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],14:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],15:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],16:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],17:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],18:['iterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],19:['sourceConvergedIterationId','confirmationIterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion'],20:['confirmationIterationId','baselineId'],21:['baselineId','productId'],22:['baselineId','productId','productVersion','requirementsVersion','testSuiteVersion'],23:['baselineId','productId','productVersion','requirementsVersion','testSuiteVersion'],24:['baselineId','productId','productVersion','requirementsVersion','testSuiteVersion'],25:['baselineId','productId','productVersion','deliveryCandidateSetId'],26:['baselineId','productId','productVersion','deliveryCandidateSetId','reviewVersion'],27:['baselineId','productId','productVersion','deliveryCandidateSetId','reconciledReviewVersion'],28:['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId'],29:['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId'],30:['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId','evidenceChainVersion']};
const stageTargets={2:new Set(['sourceSetVersion']),3:new Set(['researchVersion']),4:new Set(['requirementsVersion']),5:new Set(['requirementsVersion']),6:new Set(['testSuiteVersion']),8:new Set(['instructionVersion']),10:new Set(['iterationId','candidateId']),11:new Set(['runId']),19:new Set(['confirmationIterationId']),20:new Set(['baselineId']),21:new Set(['productId']),25:new Set(['deliveryCandidateSetId']),26:new Set(['reviewVersion']),27:new Set(['reconciledReviewVersion']),28:new Set(['releaseId']),29:new Set(['hashReviewId']),30:new Set(['evidenceChainVersion'])};
const stageFamilies={1:[],2:['sources','sourceConflicts','sourceSearchContracts'],3:['research','candidateRequirements'],4:['requirements','propositions'],5:['requirementResolutions','applicabilityRecords','semanticReviews'],6:['tests','proofExpressions','expectedVarianceContracts','semanticReviews'],7:['failureTests','regressionExecutions'],8:['instructions','instructionTraces'],9:['preflightRecords'],10:[],11:['runs'],12:['verification'],13:['comparisons'],14:['defects','rootCauses'],15:['regressions','regressionExecutions'],16:['changes'],17:['runs','verification','comparisons','rootCauses','regressions','regressionExecutions','changes'],18:[],19:['runs','verification','comparisons','regressionExecutions','confirmationRecords'],20:[],21:['products'],22:['observationRecords','evidenceRecords'],23:['meaningResults','observationRecords','evidenceRecords'],24:['adversarialResults','observationRecords','evidenceRecords'],25:['representationInspections'],26:['processAudits','productAudits','semanticReviews'],27:['releaseGateReviews'],28:[],29:['evidenceInvestigations'],30:[]};
const opSpecific={
'1:SEMANTIC_CHALLENGE':['semanticChallenges'],'1:RECONCILE_INTAKE':['semanticChallenges','semanticReviews'],
'2:SEARCH_ADEQUACY_REVIEW':['semanticReviews'],'2:RECONCILE_SOURCE_SEARCH':['sourceSearchContracts','semanticReviews'],
'3:SEMANTIC_CHALLENGE':['semanticChallenges'],'3:RECONCILE_RESEARCH':['research','candidateRequirements','semanticReviews'],
'4:DISPOSITION_CHALLENGE':['semanticChallenges','semanticReviews'],'4:ATOMICITY_CHALLENGE':['semanticChallenges','semanticReviews'],'4:RECONCILE_REQUIREMENTS':['requirements','propositions','semanticReviews'],
'5:SEMANTIC_REVIEW':['semanticReviews'],'5:RECONCILE_REQUIREMENT_SET':['requirementResolutions','applicabilityRecords','semanticReviews'],
'6:PROOF_REVIEW':['semanticReviews'],'6:RECONCILE_VERIFICATION_SUITE':['tests','proofExpressions','expectedVarianceContracts','semanticReviews'],
'27:ADVISORY_REVIEW':['releaseGateReviews'],'29:INVESTIGATE_MISSING_EVIDENCE':['evidenceInvestigations']};
function familiesFor(stage,op,executor){if(executor==='APPLICATION'||executor==='HUMAN_DECISION'||executor==='OPERATOR')return [];return Object.freeze([...(opSpecific[`${stage}:${op}`]||stageFamilies[stage]||[])]);}
const STAGE_OPERATION_SCOPE_MATRIX={};const STAGE_OPERATION_REGISTRY={};
for(const [stageText,ops] of Object.entries(b.STAGE_OPERATIONS)){const stage=Number(stageText);for(const op of ops){const key=`${stage}:${op}`;const executor=appOps.has(key)?'APPLICATION':humanDecisionOps.has(key)?'HUMAN_DECISION':operatorOps.has(key)?'OPERATOR':routedOps.has(key)?'ROUTED':'EXTERNAL_AGENT';const dims={projectRevision:'INPUT_CURRENT',contractProfileId:'IMMUTABLE_REFERENCE',scopeHash:'APPLICATION_DERIVED',promptOrCommandIdentity:executor==='EXTERNAL_AGENT'||executor==='ROUTED'?'IMMUTABLE_REFERENCE':'APPLICATION_DERIVED'};for(const d of stageDims[stage]||[])dims[d]=(stageTargets[stage]?.has(d)?'TARGET_RESERVED':'INPUT_CURRENT');STAGE_OPERATION_SCOPE_MATRIX[key]=Object.freeze(dims);STAGE_OPERATION_REGISTRY[key]=Object.freeze({stage,operation:op,executorClass:executor,responseTypes:Object.freeze(executor==='EXTERNAL_AGENT'||executor==='ROUTED'?[...RESPONSE_TYPES]:[]),acceptsExternalResponse:executor==='EXTERNAL_AGENT'||executor==='ROUTED',reservationRequired:executor==='EXTERNAL_AGENT'||executor==='ROUTED',acceptanceMode:executor==='EXTERNAL_AGENT'||executor==='ROUTED'?'HUMAN_ACCEPTANCE_REQUIRED':'NOT_APPLICABLE',writableFamilies:familiesFor(stage,op,executor),requiredScope:Object.freeze(Object.keys(dims)),scopeContract:Object.freeze(dims),targetSlotAlgorithm:'SHA-256(closed-loop-canonical-json/1({contractProfileId,jobId,stage,operation,operationSpecificTargetIdentities}))',retryRule:'Exact committed command retry returns its prior receipt; changed payload or stale scope is rejected.',completionPredicate:`Stage ${stage} completion contract`,independenceRequired:['SEMANTIC_CHALLENGE','SEARCH_ADEQUACY_REVIEW','DISPOSITION_CHALLENGE','ATOMICITY_CHALLENGE','SEMANTIC_REVIEW','PROOF_REVIEW','VERIFY','COMPARE','ADVISORY_REVIEW'].includes(op)});}}
Object.freeze(STAGE_OPERATION_SCOPE_MATRIX);Object.freeze(STAGE_OPERATION_REGISTRY);

function defFamily(name,idField,stage,policy,producerFields={}){const defs={};const ownership={human:[],humanDecision:[],agent:[],application:[]};for(const [producer,names] of Object.entries(producerFields))for(const n of names){ownership[producer].push(n);defs[n]=b.field(n,{human:b.PRODUCER.HUMAN,humanDecision:b.PRODUCER.HUMAN_DECISION,agent:b.PRODUCER.AGENT,application:b.PRODUCER.APPLICATION}[producer],{nullable:false});}return Object.freeze({title:name,idField,prefix:idField.replace(/_ID$/,''),stage,fields:Object.freeze(Object.keys(defs)),required:Object.freeze([idField]),relationships:Object.freeze({}),fieldDefinitions:Object.freeze(defs),ownership:Object.freeze(Object.fromEntries(Object.entries(ownership).map(([k,v])=>[k,Object.freeze(v)]))),commitPolicy:policy});}
const extras={
humanDecisions:defFamily('humanDecisions','HUMAN_DECISION_ID',null,b.COLLECTION_POLICIES.APPEND_SCOPED,{humanDecision:['PURPOSE','VALUE'],application:['HUMAN_DECISION_ID','TARGET_ID','SCOPE_HASH','IDENTITY_ASSURANCE','STATUS','RECEIPT_ID']}),
sourceSearchContracts:defFamily('sourceSearchContracts','SOURCE_SEARCH_CONTRACT_ID',2,b.COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,{agent:['SEARCH_SCOPE','JURISDICTION_OR_SYSTEM_SCOPE','SOURCE_CLASSES','LOCATIONS','QUERIES_OR_STRATEGIES','DATE_OR_VERSION_CUTOFF','EXCLUSIONS','ACCESS_LIMITATIONS','ADEQUACY_RATIONALE','UNRESOLVED_DISCOVERY_RISK'],application:['SOURCE_SEARCH_CONTRACT_ID','EXECUTION_EVIDENCE_IDS','CURRENT_SCOPE_HASH','STATUS']}),
semanticChallenges:defFamily('semanticChallenges','SEMANTIC_CHALLENGE_ID',null,b.COLLECTION_POLICIES.APPEND_SCOPED,{agent:['FINDINGS','REASONING'],application:['SEMANTIC_CHALLENGE_ID','TRIGGER','REVIEWED_TARGET_ID','AUTHOR_CONTEXT_ID','REVIEWER_CONTEXT_ID','RECONCILIATION_ID','CURRENT_SCOPE_HASH','STATUS']}),
semanticReviews:defFamily('semanticReviews','SEMANTIC_REVIEW_ID',null,b.COLLECTION_POLICIES.APPEND_SCOPED,{agent:['FINDING','REASONING'],application:['SEMANTIC_REVIEW_ID','AUTHOR_CONTEXT_ID','REVIEWER_CONTEXT_ID','RECONCILER_CONTEXT_ID','REVIEWED_HASHES','INDEPENDENCE_DETERMINATION','ACCEPTED_DISPOSITION','CURRENT_SCOPE_HASH','STATUS']}),
expectedVarianceContracts:defFamily('expectedVarianceContracts','VARIANCE_CONTRACT_ID',6,b.COLLECTION_POLICIES.REPLACE_CURRENT_STAGE_SET,{agent:['DIMENSIONS','RATIONALE'],application:['VARIANCE_CONTRACT_ID','NORMALIZED_CONTRACT','FROZEN_AT','CURRENT_SCOPE_HASH','STATUS']}),
environmentManifests:defFamily('environmentManifests','ENVIRONMENT_MANIFEST_ID',null,b.COLLECTION_POLICIES.APPEND_SCOPED,{application:['ENVIRONMENT_MANIFEST_ID','OBSERVED_RUNTIME','REQUIRED_FIELDS','UNAVAILABLE_FIELDS','EVIDENCE_BASES','CURRENT_SCOPE_HASH','STATUS']}),
externalCapabilities:defFamily('externalCapabilities','CAPABILITY_ID',null,b.COLLECTION_POLICIES.APPEND_SCOPED,{agent:['CAPABILITY_CLAIM'],application:['CAPABILITY_ID','VERIFICATION_BASIS','FRESHNESS_STATUS','ENVIRONMENT_MANIFEST_ID','CURRENT_SCOPE_HASH','ROUTING_CONSEQUENCE','STATUS']}),
materialityReviews:defFamily('materialityReviews','MATERIALITY_REVIEW_ID',null,b.COLLECTION_POLICIES.APPEND_SCOPED,{agent:['REASONING'],application:['MATERIALITY_REVIEW_ID','TARGET_ID','MATERIALITY','CURRENT_SCOPE_HASH','ACCEPTED_STATUS','GATE_CONSEQUENCE']}),
commandReceipts:defFamily('commandReceipts','COMMAND_RECEIPT_ID',null,b.COLLECTION_POLICIES.APPEND_ONLY,{application:['COMMAND_RECEIPT_ID','COMMAND_ID','IDEMPOTENCY_KEY','EXPECTED_REVISION','COMMITTED_REVISION','PAYLOAD_HASH','TARGET_ID','RESULT_IDS','RETRY_DISPOSITION']}),
backupPolicies:defFamily('backupPolicies','BACKUP_POLICY_ID',null,b.COLLECTION_POLICIES.APPEND_SCOPED,{humanDecision:['POLICY_CHOICE'],application:['BACKUP_POLICY_ID','CURRENT_SELECTION','CHECKPOINT_TRIGGERS','ENFORCEMENT','CURRENT_SCOPE_HASH','STATUS']}),
backupCheckpoints:defFamily('backupCheckpoints','CHECKPOINT_ID',null,b.COLLECTION_POLICIES.APPEND_ONLY,{application:['CHECKPOINT_ID','PACKAGE_ID','PACKAGE_SHA256','AUTHORIZED_ARTIFACT_IDS','CUSTODY_STATE','CURRENT_SCOPE_HASH','STATUS']}),
deliveryCandidateSets:defFamily('deliveryCandidateSets','DELIVERY_CANDIDATE_SET_ID',25,b.COLLECTION_POLICIES.APPLICATION_DERIVED,{application:['DELIVERY_CANDIDATE_SET_ID','ARTIFACT_IDS','AUTHORIZED_FILENAMES','BYTE_LENGTHS','SHA256_VALUES','TRANSFORMATIONS','PACKAGE_MEMBERSHIP','PRODUCT_LINEAGE','CURRENT_SCOPE_HASH','STATUS']}),
deliveryAttempts:defFamily('deliveryAttempts','DELIVERY_ATTEMPT_ID',30,b.COLLECTION_POLICIES.APPEND_ONLY,{application:['DELIVERY_ATTEMPT_ID','DELIVERY_ID','ARTIFACT_IDS','BYTE_HASHES','OPERATOR_ACTION','DESTINATION','CHANNEL','DEVICE_REPORTED_TIME','RESULT','EXTERNAL_RECEIPT_ID']}),
mobileAcceptanceRecords:defFamily('mobileAcceptanceRecords','MOBILE_ACCEPTANCE_RECORD_ID',null,b.COLLECTION_POLICIES.APPEND_ONLY,{application:['MOBILE_ACCEPTANCE_RECORD_ID','MOBILE_ACCEPTANCE_TARGET_ID','DEPLOYED_COMMIT','DEPLOYMENT_MANIFEST_SHA256','ORIGIN','TEST_PROJECT_ID','RESULT','EVIDENCE_IDS','EPISTEMIC_BASIS']})};
const RECORD_SCHEMAS=Object.freeze({...b.RECORD_SCHEMAS,...extras});
const DURABLE_OBJECT_REGISTRY=Object.freeze(Object.fromEntries(Object.entries(RECORD_SCHEMAS).map(([name,r])=>[name,Object.freeze({family:name,idField:r.idField,stage:r.stage??null,policy:r.commitPolicy,scope:'REGISTERED_CURRENT_SCOPE',relationships:r.relationships||Object.freeze({}),producerPartitions:r.ownership,lifecycle:'PRESERVE_HISTORY_AND_APPLY_FAMILY_POLICY',hashInclusion:'REGISTERED_HASH_PREIMAGE_REQUIRED',gateUse:'AS_DECLARED_BY_STAGE_AND_PROOF_OBLIGATION'})])));
const FIELD_REGISTRY={};
function addField(key,fd,classification,operations=[]){FIELD_REGISTRY[key]=Object.freeze({name:fd.name||key.split('.').at(-1),producer:fd.producer,valueType:fd.valueType,enumValues:fd.enumValues||Object.freeze([]),nullable:Boolean(fd.nullable),cardinality:String(fd.valueType||'').endsWith('_ARRAY')?'MANY':'ONE',requiredness:fd.requiredAtStage==null?'CONTRACT_DEPENDENT':`REQUIRED_AT_STAGE_${fd.requiredAtStage}`,writableOperations:Object.freeze(operations),classification,relationshipTarget:null,currentScopeDimensions:'REGISTERED_BY_OWNING_OPERATION',migrationDefault:'NO_SEMANTIC_DEFAULT',invalidationOwner:'workflow-engine.js',normalizerId:fd.normalizerKey||fd.normalizer||null,derivationId:fd.derivationKey||fd.derivation||null});}
for(const [n,fd] of Object.entries(b.JOB_FIELDS||{}))addField(`job.${n}`,fd,'CANONICAL_JOB_FIELD');
for(const [stage,defs] of Object.entries(b.STAGE_FIELDS||{}))for(const [n,fd] of Object.entries(defs||{}))addField(`stage.${stage}.${n}`,fd,'STAGE_PROJECTION');
for(const [family,r] of Object.entries(RECORD_SCHEMAS))for(const [n,fd] of Object.entries(r.fieldDefinitions||{})){const ops=Object.entries(STAGE_OPERATION_REGISTRY).filter(([,c])=>c.writableFamilies.includes(family)).map(([k])=>k);addField(`collection.${family}.${n}`,fd,'CANONICAL_RECORD_FIELD',ops);FIELD_REGISTRY[`collection.${family}.${n}`]=Object.freeze({...FIELD_REGISTRY[`collection.${family}.${n}`],relationshipTarget:r.relationships?.[n]||null});}
Object.freeze(FIELD_REGISTRY);
const normalizerRegistry=Object.freeze(Object.fromEntries([...new Set(Object.values(FIELD_REGISTRY).map(x=>x.normalizerId).filter(Boolean))].map(id=>[id,Object.freeze({id,owner:'workflow-schema.js',inputContract:'FIELD_DECLARED',outputContract:'FIELD_DECLARED',versionBound:true})])));
const derivationRegistry=Object.freeze(Object.fromEntries([...new Set(Object.values(FIELD_REGISTRY).map(x=>x.derivationId).filter(Boolean))].map(id=>[id,Object.freeze({id,owner:'workflow-engine.js',inputContract:'REGISTERED_SOURCE_RECORD_HASHES',outputContract:'FIELD_DECLARED',versionBound:true})])));
function operationContract(stage,operation){const c=STAGE_OPERATION_REGISTRY[`${Number(stage)}:${String(operation||'')}`];if(!c)throw new Error(`Unknown stage-operation ${stage}:${operation}`);return c;}
globalThis.closedLoopWorkflowSchema=Object.freeze({...b,FIELD_REGISTRY,STAGE_OPERATION_REGISTRY,STAGE_OPERATION_SCOPE_MATRIX,DURABLE_OBJECT_REGISTRY,normalizerRegistry,derivationRegistry,RECORD_SCHEMAS,operationContract});
})();
'''
    s += layer
p.write_text(s)

Path('verify-closed-contract-registries.mjs').write_text(r'''import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';class Event{constructor(type){this.type=type}}const c={console,crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,Uint8Array,ArrayBuffer,Date,Math,JSON,Set,Map,Event,dispatchEvent:()=>true};c.globalThis=c;vm.createContext(c);for(const f of ['workbook.js','hash.js','workflow-schema.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});const s=c.closedLoopWorkflowSchema;
for(const name of ['FIELD_REGISTRY','STAGE_OPERATION_REGISTRY','STAGE_OPERATION_SCOPE_MATRIX','DURABLE_OBJECT_REGISTRY','normalizerRegistry','derivationRegistry'])assert.ok(s[name]&&typeof s[name]==='object',`${name} missing`);
assert.equal(Object.keys(s.STAGE_OPERATION_REGISTRY).length,66,'exact stage-operation set must contain 66 combinations');
for(const key of ['18:COMPLETE','22:RUN_NATIVE_TESTS','24:RUN_NATIVE_ATTACKS','25:FREEZE_DELIVERY_CANDIDATE','27:CALCULATE_RELEASE','29:CALCULATE_EVIDENCE_CHAINS','30:CALCULATE_TERMINAL']){const o=s.STAGE_OPERATION_REGISTRY[key];assert.equal(o.executorClass,'APPLICATION',`${key} executor`);assert.equal(o.acceptsExternalResponse,false);assert.deepEqual([...o.writableFamilies],[],`${key} cannot expose agent-writable families`);}
assert.equal(s.STAGE_OPERATION_REGISTRY['27:ADVISORY_REVIEW'].executorClass,'EXTERNAL_AGENT');assert.deepEqual([...s.STAGE_OPERATION_REGISTRY['27:ADVISORY_REVIEW'].writableFamilies],['releaseGateReviews']);
assert.deepEqual(Object.keys(s.STAGE_OPERATION_SCOPE_MATRIX['12:VERIFY']).filter(k=>!['projectRevision','contractProfileId','scopeHash','promptOrCommandIdentity'].includes(k)).sort(),['candidateId','iterationId','requirementsVersion','runId','testSuiteVersion'].sort());
assert.deepEqual(Object.keys(s.STAGE_OPERATION_SCOPE_MATRIX['30:CALCULATE_TERMINAL']).filter(k=>!['projectRevision','contractProfileId','scopeHash','promptOrCommandIdentity'].includes(k)).sort(),['baselineId','deliveryCandidateSetId','evidenceChainVersion','hashReviewId','productId','productVersion','releaseId'].sort());
for(const f of ['humanDecisions','sourceSearchContracts','semanticChallenges','semanticReviews','expectedVarianceContracts','environmentManifests','externalCapabilities','materialityReviews','commandReceipts','backupPolicies','backupCheckpoints','deliveryCandidateSets','deliveryAttempts','mobileAcceptanceRecords'])assert.ok(s.RECORD_SCHEMAS[f]&&s.DURABLE_OBJECT_REGISTRY[f],`missing durable family ${f}`);
assert.ok(s.FIELD_REGISTRY['job.CONTRACT_PROFILE_ID']);assert.equal(s.FIELD_REGISTRY['job.CONTRACT_PROFILE_ID'].producer,'APPLICATION');
assert.throws(()=>s.operationContract(31,'COMPLETE'),/Unknown stage-operation/);
console.log('closed contract registries regression passed');
''')

Path('verify-canonical-job-contract.mjs').write_text(r'''import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);for(const f of ['workbook.js','hash.js','workflow-schema.js'])vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f});const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,p=core.createBlankState('JOB-CONTRACT-REGRESSION');assert.equal(p.job.CONTRACT_PROFILE_ID,'closed-loop-completion-profile/1');assert.equal(schema.CONTRACT_PROFILE_ID,'closed-loop-completion-profile/1');assert.deepEqual([...schema.JOB_FIELDS.CURRENT_STATE.enumValues],['BLOCKED','AWAITING_HUMAN_INPUT','PROPOSAL_PENDING_REVIEW','RESPONSE_STAGED','AWAITING_EXTERNAL_RESPONSE','READY_FOR_NEXT_OPERATION','WORKFLOW_COMPLETE']);assert.deepEqual([...schema.JOB_FIELDS.JOB_RECORD_STATUS.enumValues],['INCOMPLETE','BLOCKED','COMPLETE']);assert.equal(p.job.CURRENT_STATE,'AWAITING_HUMAN_INPUT');assert.equal(p.job.JOB_RECORD_STATUS,'INCOMPLETE');for(const name of ['CURRENT_ITERATION','CURRENT_SOURCE_SET_VERSION','CURRENT_RESEARCH_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION','CURRENT_INSTRUCTION_VERSION','CURRENT_CANDIDATE_ID','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_PRODUCT_VERSION','CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID','CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID','LATEST_EVIDENCE_REFERENCE']){assert.ok(name in p.job,`${name} missing`);assert.equal(p.job[name],null,`${name} must start null`);assert.equal(schema.JOB_FIELDS[name].nullable,true);}console.log('canonical job contract regression passed');
''')
Path('verify-contract-profile-migration.mjs').write_text(r'''import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';class Event{constructor(type){this.type=type}}const c={console,crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,Uint8Array,ArrayBuffer,Date,Math,JSON,Set,Map,Event,dispatchEvent:()=>true};c.globalThis=c;vm.createContext(c);for(const f of ['workbook.js','hash.js','workflow-schema.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});const s=c.closedLoopWorkflowSchema,b=c.closedLoopCore.createBlankState('PROFILE-CURRENT');assert.equal(s.validateContractProfile(b).valid,true);const p=structuredClone(b);delete p.job.CONTRACT_PROFILE_ID;const m=s.migrateProjectToCurrent(p);assert.equal(m.job.CONTRACT_PROFILE_ID,undefined);assert.equal(m.projectData.currentProfileEligible,false);assert.equal(m.projectData.contractProfileMigration.status,'HISTORICAL_NON_GATING');assert.equal(m.projectData.contractProfileMigration.fabricatedProof,false);assert.equal(s.validateContractProfile(m).valid,false);const l=s.migrateProjectToCurrent({schema:'closed-loop-project/2',revision:3,job:{JOB_ID:'LEGACY'},stages:{1:{stage:1,status:'COMPLETE',agentData:{},humanData:{},derivedData:{}}},projectData:{}});assert.equal(l.projectData.currentProfileEligible,false);assert.equal(s.validateContractProfile(l).valid,false);assert.equal(s.migrateProjectToCurrent(l).projectData.contractProfileMigration.status,'HISTORICAL_NON_GATING');console.log('contract-profile migration regression passed');
''')

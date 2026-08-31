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
  if(AGENT_JOB_FIELDS.includes(name))return field(name,PRODUCER.AGENT,{requiredAtStage:1,valueType:'STRING'});
  return field(name,PRODUCER.APPLICATION,{derivation:`Application owns unclassified job-control field ${name}.`});
}
const JOB_FIELDS=Object.freeze(Object.fromEntries([...new Set([...HUMAN_DECISION_JOB_FIELDS,...HUMAN_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])].map(name=>[name,jobFieldDefinition(name)])));


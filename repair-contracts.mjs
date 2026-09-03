import fs from 'node:fs';

function replaceExact(path, from, to) {
  const text = fs.readFileSync(path, 'utf8');
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${path}: expected exactly one repair target, found ${count}`);
  fs.writeFileSync(path, text.replace(from, to));
}

const workbookPath='workbook.js';
let workbook=fs.readFileSync(workbookPath,'utf8');
const jobPattern=/job:\{JOB_ID:id,JOB_TITLE:'New project'.*?STATUS_EVIDENCE:''\},stages:/s;
if(!jobPattern.test(workbook)) throw new Error('workbook.js: blank job target not found');
workbook=workbook.replace(jobPattern,`job:{
JOB_ID:id,
CONTRACT_PROFILE_ID:'closed-loop-completion-profile/1',
JOB_TITLE:'New project',
JOB_OWNER:null,
DATE_OPENED:new Date().toISOString(),
EXACT_USER_OBJECTIVE_VERBATIM:'',
EXACT_DELIVERABLE_REQUESTED:'',
SUPPLIED_MATERIALS_INVENTORY:null,
REQUIRED_OUTPUT_FORMAT:null,
DEADLINE_OR_TEMPORAL_SCOPE:null,
DESIRED_SOURCE_COUNT:null,
KNOWN_AUTHORITATIVE_SOURCES:null,
AVAILABLE_TOOLS:null,
PROHIBITED_ACTIONS:null,
EXPLICIT_USER_REQUIREMENTS:null,
ASSUMPTIONS:'',
UNKNOWN_INFORMATION:'',
CURRENT_ITERATION:null,
CURRENT_STAGE:'STAGE 01',
CURRENT_STATE:'AWAITING_HUMAN_INPUT',
CURRENT_INPUT_VERSION:'INPUT-v001',
CURRENT_SOURCE_SET_VERSION:null,
CURRENT_RESEARCH_VERSION:null,
CURRENT_REQUIREMENTS_VERSION:null,
CURRENT_TEST_SUITE_VERSION:null,
CURRENT_INSTRUCTION_VERSION:null,
CURRENT_CANDIDATE_ID:null,
CURRENT_BASELINE_ID:null,
CURRENT_PRODUCT_ID:null,
CURRENT_PRODUCT_VERSION:null,
CURRENT_DELIVERY_CANDIDATE_SET_ID:null,
CURRENT_REVIEW_VERSION:null,
CURRENT_RECONCILED_REVIEW_VERSION:null,
CURRENT_RELEASE_ID:null,
CURRENT_HASH_REVIEW_ID:null,
CURRENT_EVIDENCE_CHAIN_VERSION:null,
CURRENT_DELIVERY_ID:null,
CURRENT_BLOCKERS:[],
NEXT_REQUIRED_ACTION:{actionType:'CONTINUE_AGENT_CONVERSATION',heading:'Complete Stage 01 intake',explanation:'Provide the current human-authority intake needed to define the job.',primaryButton:'Continue',secondaryAction:null,filesToSend:[],filesToWithhold:[],expectedReturnFiles:[],blockingReason:null,canonicalStateChanged:false,newPromptRequired:true},
LATEST_EVIDENCE_REFERENCE:null,
INPUT_SET_CONTENTS:'',
INPUT_SET_HASH_OR_MANIFEST:'',
JOB_RECORD_STATUS:'INCOMPLETE',
STATUS_EVIDENCE:''
},stages:`);
fs.writeFileSync(workbookPath,workbook);

const schemaPath='workflow-schema.js';
replaceExact(schemaPath,
`const APPLICATION_JOB_FIELDS=Object.freeze([\n  'JOB_ID','DATE_OPENED','CURRENT_ITERATION','CURRENT_STAGE','CURRENT_STATE','CURRENT_INPUT_VERSION',\n  'CURRENT_SOURCE_SET_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION',\n  'CURRENT_INSTRUCTION_VERSION','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_BLOCKERS',\n  'NEXT_REQUIRED_ACTION','LATEST_EVIDENCE_REFERENCE','INPUT_SET_HASH_OR_MANIFEST','JOB_RECORD_STATUS',\n  'STATUS_EVIDENCE'\n]);`,
`const APPLICATION_JOB_FIELDS=Object.freeze([\n  'JOB_ID','CONTRACT_PROFILE_ID','DATE_OPENED','CURRENT_ITERATION','CURRENT_STAGE','CURRENT_STATE','CURRENT_INPUT_VERSION',\n  'CURRENT_SOURCE_SET_VERSION','CURRENT_RESEARCH_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION',\n  'CURRENT_INSTRUCTION_VERSION','CURRENT_CANDIDATE_ID','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_PRODUCT_VERSION',\n  'CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID',\n  'CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID','CURRENT_BLOCKERS',\n  'NEXT_REQUIRED_ACTION','LATEST_EVIDENCE_REFERENCE','INPUT_SET_HASH_OR_MANIFEST','JOB_RECORD_STATUS','STATUS_EVIDENCE'\n]);`);

replaceExact(schemaPath,
`function jobFieldDefinition(name){\n  if(HUMAN_DECISION_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN_DECISION,{nullable:true,provenanceRequired:false});\n  if(APPLICATION_JOB_FIELDS.includes(name))return field(name,PRODUCER.APPLICATION,{derivation:\`Application derives \${name} from canonical project state.\`});\n  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});\n  if(AGENT_JOB_FIELDS.includes(name))return field(name,PRODUCER.AGENT,{requiredAtStage:1,valueType:name==='INPUT_SET_CONTENTS'?'OBJECT':'STRING'});\n  return field(name,PRODUCER.APPLICATION,{derivation:\`Application owns unclassified job-control field \${name}.\`});\n}`,
`const NULLABLE_APPLICATION_JOB_FIELDS=new Set([\n  'CURRENT_ITERATION','CURRENT_SOURCE_SET_VERSION','CURRENT_RESEARCH_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION',\n  'CURRENT_INSTRUCTION_VERSION','CURRENT_CANDIDATE_ID','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_PRODUCT_VERSION',\n  'CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID',\n  'CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID','LATEST_EVIDENCE_REFERENCE'\n]);\nfunction jobFieldDefinition(name){\n  if(HUMAN_DECISION_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN_DECISION,{nullable:true,provenanceRequired:false});\n  if(APPLICATION_JOB_FIELDS.includes(name)){\n    const options={derivation:\`Application derives \${name} from canonical project state.\`,nullable:NULLABLE_APPLICATION_JOB_FIELDS.has(name)};\n    if(name==='CURRENT_BLOCKERS')options.valueType='OBJECT_ARRAY';\n    if(name==='NEXT_REQUIRED_ACTION')options.valueType='OBJECT';\n    if(name==='CURRENT_STATE')options.enumValues=['BLOCKED','AWAITING_HUMAN_INPUT','PROPOSAL_PENDING_REVIEW','RESPONSE_STAGED','AWAITING_EXTERNAL_RESPONSE','READY_FOR_NEXT_OPERATION','WORKFLOW_COMPLETE'];\n    if(name==='JOB_RECORD_STATUS')options.enumValues=['INCOMPLETE','BLOCKED','COMPLETE'];\n    return field(name,PRODUCER.APPLICATION,options);\n  }\n  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});\n  if(AGENT_JOB_FIELDS.includes(name))return field(name,PRODUCER.AGENT,{requiredAtStage:1,valueType:'STRING'});\n  throw new Error(\`UNDEFINED_FIELD_CONTRACT: \${name}\`);\n}`);

const workflowPath='.github/workflows/pages.yml';
let workflow=fs.readFileSync(workflowPath,'utf8');
if(!workflow.includes('node verify-section15-job-contract.mjs')){
  const needle='          node verify-hash.mjs\n';
  const count=workflow.split(needle).length-1;
  if(count!==1) throw new Error(`pages.yml: expected one verify-hash command, found ${count}`);
  workflow=workflow.replace(needle,`${needle}          node verify-canonical-id-contract.mjs\n          node verify-section15-job-contract.mjs\n`);
  fs.writeFileSync(workflowPath,workflow);
}

console.log('one-time contract repair applied');

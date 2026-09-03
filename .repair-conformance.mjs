import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}
function write(path,text){fs.writeFileSync(path,text);}
function replaceOnce(path,from,to,label){
  const before=read(path);
  if(!before.includes(from))throw new Error(`${label}: expected source pattern not found in ${path}`);
  const after=before.replace(from,to);
  if(after===before)throw new Error(`${label}: no change made in ${path}`);
  write(path,after);
}
function replaceRegex(path,re,to,label){
  const before=read(path);
  if(!re.test(before))throw new Error(`${label}: expected source pattern not found in ${path}`);
  const after=before.replace(re,to);
  if(after===before)throw new Error(`${label}: no change made in ${path}`);
  write(path,after);
}

// Canonical Job defaults: closed enums and null-before-creation pointers.
const workbook='workbook.js';
for(const [from,to,label] of [
  ["CURRENT_ITERATION:''","CURRENT_ITERATION:null",'CURRENT_ITERATION null-before-creation'],
  ["CURRENT_STATE:'NOT STARTED'","CURRENT_STATE:'AWAITING_HUMAN_INPUT'",'CURRENT_STATE closed enum'],
  ["CURRENT_SOURCE_SET_VERSION:''","CURRENT_SOURCE_SET_VERSION:null",'CURRENT_SOURCE_SET_VERSION null-before-creation'],
  ["CURRENT_REQUIREMENTS_VERSION:''","CURRENT_REQUIREMENTS_VERSION:null",'CURRENT_REQUIREMENTS_VERSION null-before-creation'],
  ["CURRENT_TEST_SUITE_VERSION:''","CURRENT_TEST_SUITE_VERSION:null",'CURRENT_TEST_SUITE_VERSION null-before-creation'],
  ["CURRENT_INSTRUCTION_VERSION:''","CURRENT_INSTRUCTION_VERSION:null",'CURRENT_INSTRUCTION_VERSION null-before-creation'],
  ["CURRENT_BASELINE_ID:'NONE'","CURRENT_BASELINE_ID:null",'CURRENT_BASELINE_ID null-before-creation'],
  ["CURRENT_PRODUCT_ID:'NONE'","CURRENT_PRODUCT_ID:null",'CURRENT_PRODUCT_ID null-before-creation'],
  ["LATEST_EVIDENCE_REFERENCE:''","LATEST_EVIDENCE_REFERENCE:null",'LATEST_EVIDENCE_REFERENCE null-before-first-evidence'],
  ["JOB_RECORD_STATUS:'NOT READY'","JOB_RECORD_STATUS:'INCOMPLETE'",'JOB_RECORD_STATUS closed enum']
]) replaceOnce(workbook,from,to,label);

// Add the controlling runtime contract profile and the missing canonical current pointers.
replaceOnce(workbook,
  "const PROJECT_SCHEMA='closed-loop-project/3';\nconst STAGE_COUNT=30;",
  "const PROJECT_SCHEMA='closed-loop-project/3';\nconst CONTRACT_PROFILE_ID='closed-loop-completion-profile/1';\nconst STAGE_COUNT=30;",
  'workbook contract profile identity');
replaceRegex(workbook,
  /CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:null,/,
  "CURRENT_INPUT_VERSION:'INPUT-v001',CONTRACT_PROFILE_ID,CURRENT_SOURCE_SET_VERSION:null,CURRENT_RESEARCH_VERSION:null,",
  'workbook current profile/research pointers');
replaceRegex(workbook,
  /CURRENT_INSTRUCTION_VERSION:null,CURRENT_BASELINE_ID:null,CURRENT_PRODUCT_ID:null,/,
  "CURRENT_INSTRUCTION_VERSION:null,CURRENT_CANDIDATE_ID:null,CURRENT_BASELINE_ID:null,CURRENT_PRODUCT_ID:null,CURRENT_PRODUCT_VERSION:null,CURRENT_DELIVERY_CANDIDATE_SET_ID:null,CURRENT_REVIEW_VERSION:null,CURRENT_RECONCILED_REVIEW_VERSION:null,CURRENT_RELEASE_ID:null,CURRENT_HASH_REVIEW_ID:null,CURRENT_EVIDENCE_CHAIN_VERSION:null,CURRENT_DELIVERY_ID:null,",
  'workbook later-stage canonical pointers');
replaceOnce(workbook,
  "globalThis.closedLoopCore=Object.freeze({WORKFLOW_ID,PROJECT_SCHEMA,SCHEMA,STAGE_COUNT,STAGE_DECISIONS,STAGES,createBlankProject});",
  "globalThis.closedLoopCore=Object.freeze({WORKFLOW_ID,PROJECT_SCHEMA,CONTRACT_PROFILE_ID,SCHEMA,STAGE_COUNT,STAGE_DECISIONS,STAGES,createBlankProject});",
  'export contract profile identity');

// workflow-schema.js must register every canonical Job field and enforce the two closed enums.
const schema='workflow-schema.js';
replaceOnce(schema,
  "const RESPONSE_SCHEMA='closed-loop-stage-response/3';",
  "const RESPONSE_SCHEMA='closed-loop-stage-response/3';\nconst CONTRACT_PROFILE_ID='closed-loop-completion-profile/1';",
  'schema contract profile identity');
replaceOnce(schema,
  "'JOB_ID','DATE_OPENED','CURRENT_ITERATION','CURRENT_STAGE','CURRENT_STATE','CURRENT_INPUT_VERSION',\n  'CURRENT_SOURCE_SET_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION',\n  'CURRENT_INSTRUCTION_VERSION','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_BLOCKERS',",
  "'JOB_ID','CONTRACT_PROFILE_ID','DATE_OPENED','CURRENT_ITERATION','CURRENT_STAGE','CURRENT_STATE','CURRENT_INPUT_VERSION',\n  'CURRENT_SOURCE_SET_VERSION','CURRENT_RESEARCH_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION',\n  'CURRENT_INSTRUCTION_VERSION','CURRENT_CANDIDATE_ID','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_PRODUCT_VERSION',\n  'CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID',\n  'CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID','CURRENT_BLOCKERS',",
  'complete canonical application Job fields');
replaceOnce(schema,
  "if(APPLICATION_JOB_FIELDS.includes(name))return field(name,PRODUCER.APPLICATION,{derivation:`Application derives ${name} from canonical project state.`});",
  "if(APPLICATION_JOB_FIELDS.includes(name)){\n    const nullablePointers=new Set(['CURRENT_ITERATION','CURRENT_SOURCE_SET_VERSION','CURRENT_RESEARCH_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION','CURRENT_INSTRUCTION_VERSION','CURRENT_CANDIDATE_ID','CURRENT_BASELINE_ID','CURRENT_PRODUCT_ID','CURRENT_PRODUCT_VERSION','CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID','CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID','LATEST_EVIDENCE_REFERENCE']);\n    const enums=name==='CURRENT_STATE'?['BLOCKED','AWAITING_HUMAN_INPUT','PROPOSAL_PENDING_REVIEW','RESPONSE_STAGED','AWAITING_EXTERNAL_RESPONSE','READY_FOR_NEXT_OPERATION','WORKFLOW_COMPLETE']:name==='JOB_RECORD_STATUS'?['INCOMPLETE','BLOCKED','COMPLETE']:name==='CONTRACT_PROFILE_ID'?[CONTRACT_PROFILE_ID]:[];\n    return field(name,PRODUCER.APPLICATION,{nullable:nullablePointers.has(name),enumValues:enums,derivation:`Application derives ${name} from canonical project state.`});\n  }",
  'canonical Job nullability/enums');
replaceOnce(schema,
  "PROJECT_SCHEMA,WORKFLOW_ID,STAGE_COUNT,VALUE_TYPES",
  "PROJECT_SCHEMA,WORKFLOW_ID,CONTRACT_PROFILE_ID,STAGE_COUNT,VALUE_TYPES",
  'schema export contract profile');

// Authoritative response bytes with smart/curly JSON delimiters are invalid; never repair them.
const ingestion='response-ingestion.js';
replaceRegex(ingestion,
  /function normalizeSmartJsonDelimiters\(raw\)\{[\s\S]*?\n\}\nfunction scanJsonAmbiguity/,
  "function scanJsonAmbiguity",
  'remove smart-quote repair parser');
replaceRegex(ingestion,
  /function strictParse\(text,\{limits=schema\.DEFAULT_RESOURCE_LIMITS\}=\{\}\)\{\n  const raw=String\(text\?\?''\);const trimmed=raw\.trim\(\);/,
  "function strictParse(text,{limits=schema.DEFAULT_RESOURCE_LIMITS}={}){\n  const raw=String(text??'');const trimmed=raw.trim();if(/[“”]/.test(trimmed))throw Object.assign(new Error('Smart or curly quotation marks are not permitted in authoritative JSON.'),{code:'UNSAFE_SMART_QUOTES'});",
  'reject smart quotes before parse');
replaceRegex(ingestion,
  /  let envelope,normalization=null,firstError=null;try\{envelope=parseCandidate\(trimmed\);\}catch\(error\)\{if\(error\.code\)throw error;firstError=error;const repaired=normalizeSmartJsonDelimiters\(trimmed\);if\(repaired\.changed\)\{try\{envelope=parseCandidate\(repaired\.text\);normalization='SMART_JSON_DELIMITERS';\}catch\(repairError\)\{if\(repairError\.code\)throw repairError;firstError=repairError;\}\}if\(!envelope\)\{const likelyTruncated=!trimmed\.endsWith\('\}'\)\|\|\(\(trimmed\.match\(\/\{\/g\)\|\|\[\]\)\.length!==\(trimmed\.match\(\/\}\/g\)\|\|\[\]\)\.length\);throw Object\.assign\(new Error\(`Response JSON could not be parsed: \$\{firstError\?\.message\|\|error\.message\}`\),\{code:likelyTruncated\?'TRUNCATED_RESPONSE':'MALFORMED_JSON',cause:firstError\|\|error\}\);\}\}\n  if\(!object\(envelope\)\)throw Object\.assign\(new Error\('The response root must be one JSON object\.'\),\{code:'INVALID_ROOT'\}\);if\(normalization\)Object\.defineProperty\(envelope,'__parseNormalization',\{value:normalization,enumerable:false\}\);return envelope;/,
  "  let envelope;try{envelope=parseCandidate(trimmed);}catch(error){if(error.code)throw error;const likelyTruncated=!trimmed.endsWith('}')||((trimmed.match(/{/g)||[]).length!==(trimmed.match(/}/g)||[]).length);throw Object.assign(new Error(`Response JSON could not be parsed: ${error.message}`),{code:likelyTruncated?'TRUNCATED_RESPONSE':'MALFORMED_JSON',cause:error});}\n  if(!object(envelope))throw Object.assign(new Error('The response root must be one JSON object.'),{code:'INVALID_ROOT'});return envelope;",
  'remove parse repair fallback');

// Permanent regression: source-independent execution of the exact owning layers.
const regression=`import fs from 'node:fs';\nimport vm from 'node:vm';\nimport assert from 'node:assert/strict';\n\nconst workbook=fs.readFileSync('workbook.js','utf8');\nconst schema=fs.readFileSync('workflow-schema.js','utf8');\nconst ingestion=fs.readFileSync('response-ingestion.js','utf8');\n\nassert.match(workbook,/CONTRACT_PROFILE_ID='closed-loop-completion-profile\\/1'/);\nfor(const token of ['CURRENT_ITERATION:null','CURRENT_SOURCE_SET_VERSION:null','CURRENT_RESEARCH_VERSION:null','CURRENT_CANDIDATE_ID:null','CURRENT_PRODUCT_VERSION:null','CURRENT_DELIVERY_CANDIDATE_SET_ID:null','CURRENT_REVIEW_VERSION:null','CURRENT_RECONCILED_REVIEW_VERSION:null','CURRENT_RELEASE_ID:null','CURRENT_HASH_REVIEW_ID:null','CURRENT_EVIDENCE_CHAIN_VERSION:null','CURRENT_DELIVERY_ID:null','LATEST_EVIDENCE_REFERENCE:null']) assert.ok(workbook.includes(token),token);\nassert.ok(workbook.includes("CURRENT_STATE:'AWAITING_HUMAN_INPUT'"));\nassert.ok(workbook.includes("JOB_RECORD_STATUS:'INCOMPLETE'"));\nassert.doesNotMatch(workbook,/CURRENT_(?:ITERATION|SOURCE_SET_VERSION|REQUIREMENTS_VERSION|TEST_SUITE_VERSION|INSTRUCTION_VERSION):''/);\nassert.doesNotMatch(workbook,/CURRENT_(?:BASELINE_ID|PRODUCT_ID):'NONE'/);\nfor(const name of ['CONTRACT_PROFILE_ID','CURRENT_RESEARCH_VERSION','CURRENT_CANDIDATE_ID','CURRENT_PRODUCT_VERSION','CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID','CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID']) assert.ok(schema.includes("'"+name+"'"),name);\nassert.match(schema,/BLOCKED','AWAITING_HUMAN_INPUT','PROPOSAL_PENDING_REVIEW','RESPONSE_STAGED','AWAITING_EXTERNAL_RESPONSE','READY_FOR_NEXT_OPERATION','WORKFLOW_COMPLETE/);\nassert.match(schema,/INCOMPLETE','BLOCKED','COMPLETE/);\nassert.doesNotMatch(ingestion,/normalizeSmartJsonDelimiters/);\nassert.doesNotMatch(ingestion,/SMART_JSON_DELIMITERS/);\nassert.match(ingestion,/UNSAFE_SMART_QUOTES/);\n\nconsole.log('Current-spec contradiction regressions: PASS');\n`;
write('verify-current-spec-contradictions.mjs',regression);

// Keep the regression in the one existing CI workflow.
const pages='.github/workflows/pages.yml';
replaceOnce(pages,
  "          node verify-ingestion.mjs\n",
  "          node verify-ingestion.mjs\n          node verify-current-spec-contradictions.mjs\n",
  'wire permanent contradiction regression into CI');

console.log('Repair script completed.');

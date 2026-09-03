import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for (const file of ['workbook.js','hash.js','workflow-schema.js']) {
  vm.runInThisContext(fs.readFileSync(new URL(`./${file}`, import.meta.url), 'utf8'), { filename:file });
}

const schema=globalThis.closedLoopWorkflowSchema;
assert(schema,'workflow schema did not load');

const expected={
  JOB_TITLE:{producer:'HUMAN_DECISION',valueType:'STRING',nullable:true,requiredAtStage:null},
  JOB_OWNER:{producer:'HUMAN_DECISION',valueType:'STRING',nullable:true,requiredAtStage:null},
  EXACT_USER_OBJECTIVE_VERBATIM:{producer:'HUMAN',valueType:'STRING',nullable:false,requiredAtStage:1},
  SUPPLIED_MATERIALS_INVENTORY:{producer:'HUMAN',valueType:'STRING',nullable:true,requiredAtStage:null},
  REQUIRED_OUTPUT_FORMAT:{producer:'HUMAN',valueType:'STRING',nullable:true,requiredAtStage:null},
  DEADLINE_OR_TEMPORAL_SCOPE:{producer:'HUMAN',valueType:'STRING',nullable:true,requiredAtStage:null},
  DESIRED_SOURCE_COUNT:{producer:'HUMAN',valueType:'INTEGER',nullable:true,requiredAtStage:null},
  KNOWN_AUTHORITATIVE_SOURCES:{producer:'HUMAN',valueType:'STRING',nullable:true,requiredAtStage:null},
  AVAILABLE_TOOLS:{producer:'HUMAN',valueType:'STRING',nullable:true,requiredAtStage:null},
  PROHIBITED_ACTIONS:{producer:'HUMAN',valueType:'STRING',nullable:true,requiredAtStage:null},
  EXPLICIT_USER_REQUIREMENTS:{producer:'HUMAN',valueType:'STRING',nullable:true,requiredAtStage:null},
  JOB_ID:{producer:'APPLICATION',valueType:'STRING',nullable:false,requiredAtStage:null},
  CONTRACT_PROFILE_ID:{producer:'APPLICATION',valueType:'STRING',nullable:false,requiredAtStage:null},
  DATE_OPENED:{producer:'APPLICATION',valueType:'STRING',nullable:false,requiredAtStage:null},
  CURRENT_ITERATION:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  CURRENT_STAGE:{producer:'APPLICATION',valueType:'STRING',nullable:false,requiredAtStage:null},
  CURRENT_STATE:{producer:'APPLICATION',valueType:'STRING',nullable:false,requiredAtStage:null,enumValues:['BLOCKED','AWAITING_HUMAN_INPUT','PROPOSAL_PENDING_REVIEW','RESPONSE_STAGED','AWAITING_EXTERNAL_RESPONSE','READY_FOR_NEXT_OPERATION','WORKFLOW_COMPLETE']},
  CURRENT_INPUT_VERSION:{producer:'APPLICATION',valueType:'STRING',nullable:false,requiredAtStage:null},
  CURRENT_SOURCE_SET_VERSION:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  CURRENT_RESEARCH_VERSION:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  CURRENT_REQUIREMENTS_VERSION:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  CURRENT_TEST_SUITE_VERSION:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  CURRENT_INSTRUCTION_VERSION:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  CURRENT_CANDIDATE_ID:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  CURRENT_BASELINE_ID:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  CURRENT_PRODUCT_ID:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  CURRENT_PRODUCT_VERSION:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  CURRENT_DELIVERY_CANDIDATE_SET_ID:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  CURRENT_REVIEW_VERSION:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  CURRENT_RECONCILED_REVIEW_VERSION:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  CURRENT_RELEASE_ID:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  CURRENT_HASH_REVIEW_ID:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  CURRENT_EVIDENCE_CHAIN_VERSION:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  CURRENT_DELIVERY_ID:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  CURRENT_BLOCKERS:{producer:'APPLICATION',valueType:'OBJECT',nullable:false,requiredAtStage:null},
  NEXT_REQUIRED_ACTION:{producer:'APPLICATION',valueType:'OBJECT',nullable:false,requiredAtStage:null},
  LATEST_EVIDENCE_REFERENCE:{producer:'APPLICATION',valueType:'STRING',nullable:true,requiredAtStage:null},
  INPUT_SET_HASH_OR_MANIFEST:{producer:'APPLICATION',valueType:'STRING',nullable:false,requiredAtStage:null},
  JOB_RECORD_STATUS:{producer:'APPLICATION',valueType:'STRING',nullable:false,requiredAtStage:null,enumValues:['INCOMPLETE','BLOCKED','COMPLETE']},
  STATUS_EVIDENCE:{producer:'APPLICATION',valueType:'STRING',nullable:false,requiredAtStage:null},
  EXACT_DELIVERABLE_REQUESTED:{producer:'AGENT',valueType:'STRING',nullable:false,requiredAtStage:1},
  ASSUMPTIONS:{producer:'AGENT',valueType:'STRING',nullable:false,requiredAtStage:1},
  UNKNOWN_INFORMATION:{producer:'AGENT',valueType:'STRING',nullable:false,requiredAtStage:1},
  INPUT_SET_CONTENTS:{producer:'AGENT',valueType:'STRING',nullable:false,requiredAtStage:1}
};

assert.deepEqual(Object.keys(schema.JOB_FIELDS).sort(),Object.keys(expected).sort(),'Section 15 job-field universe mismatch');
for(const [name,contract] of Object.entries(expected)){
  const actual=schema.JOB_FIELDS[name];
  assert(actual,`Missing job field ${name}`);
  for(const key of ['producer','valueType','nullable','requiredAtStage'])assert.equal(actual[key],contract[key],`${name}.${key}`);
  if(contract.enumValues)assert.deepEqual([...actual.enumValues],contract.enumValues,`${name}.enumValues`);
}

assert.deepEqual([...schema.HUMAN_JOB_FIELDS].sort(),Object.entries(expected).filter(([,v])=>v.producer==='HUMAN').map(([k])=>k).sort(),'HUMAN partition mismatch');
assert.deepEqual([...schema.AGENT_JOB_FIELDS].sort(),Object.entries(expected).filter(([,v])=>v.producer==='AGENT').map(([k])=>k).sort(),'AGENT partition mismatch');
assert.deepEqual([...schema.APPLICATION_JOB_FIELDS].sort(),Object.entries(expected).filter(([,v])=>v.producer==='APPLICATION').map(([k])=>k).sort(),'APPLICATION partition mismatch');

console.log(JSON.stringify({section15JobContract:'PASS',fields:Object.keys(expected).length},null,2));

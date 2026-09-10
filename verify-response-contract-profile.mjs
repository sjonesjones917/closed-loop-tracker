import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js']){
  vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
}

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
const ingestion=globalThis.closedLoopResponseIngestion;

const p=core.createBlankState('JOB-CONTRACT-PROFILE');
p.job.EXACT_USER_OBJECTIVE_VERBATIM='Verify response contract profile binding.';
p.job.CURRENT_INPUT_VERSION='INPUT-v001';
p.job.CURRENT_SOURCE_SET_VERSION='SOURCE-SET-v001';
engine.ensureShape(p);
engine.recalculate(p);

const pr=prompts.buildPromptRecord(1,p);
const descriptor=prompts.responseContractDescriptor(1,pr.operation);
assert(descriptor.envelope.topLevelKeys.includes('contractProfileId'));

const rendered=JSON.parse(prompts.responseContract(1,pr.operation,pr.instructionId,pr.bodySha256,pr.contractSha256,pr.contextSignature,pr.scope,p.job.JOB_ID));
assert.equal(rendered.contractProfileId,schema.CONTRACT_PROFILE_ID);

// Regression for the real Stage 03 failure: top-level record identity and nested
// relationship/evidence identity are different grammars. The generated contract
// must make that distinction explicit so an external agent cannot reasonably
// generalize record.targetId into relationships.*.targetId or evidence.*.targetId.
assert.deepEqual(descriptor.envelope.relationshipReferenceKeys,['tempKey','recordId'],'Response contract does not publish the closed relationship-reference key set.');
assert.deepEqual(descriptor.envelope.evidenceReferenceKeys,['tempKey','recordId'],'Response contract does not publish the closed evidence-reference key set.');
for(const [name,rule] of [
  ['relationshipReferenceRule',descriptor.envelope.relationshipReferenceRule],
  ['evidenceReferenceRule',descriptor.envelope.evidenceReferenceRule],
  ['targetIdBoundaryRule',descriptor.envelope.targetIdBoundaryRule]
]){
  assert.equal(typeof rule,'string',`${name} is not published as a machine-readable contract rule.`);
  assert.match(rule,/recordId/iu,`${name} does not name recordId.`);
  assert.match(rule,/tempKey/iu,`${name} does not name tempKey.`);
  assert.match(rule,/targetId/iu,`${name} does not distinguish targetId.`);
}

p.stages[1].status='COMPLETE';
p.stages[1].gate={complete:true,blocked:false,reasons:[]};
p.stages[2].status='COMPLETE';
p.stages[2].gate={complete:true,blocked:false,reasons:[]};
const stage3Prompt=prompts.buildPromptRecord(3,p,{operation:'COMPLETE'}).prompt;
for(const required of [
  'RELATIONSHIP AND EVIDENCE REFERENCE GRAMMAR — EXACT',
  '{"recordId":"SOURCE-000001"}',
  '{"tempKey":"source-1"}',
  'targetId is only a top-level record identity',
  'Never use targetId inside relationships',
  'evidence[].sourceRef',
  'evidence[].attachmentRef'
])assert(stage3Prompt.includes(required),`Generated Stage 03 prompt omitted exact reference-grammar guidance: ${required}`);

const base={
  schema:schema.RESPONSE_SCHEMA,
  contractProfileId:schema.CONTRACT_PROFILE_ID,
  jobId:p.job.JOB_ID,
  stage:1,
  operation:pr.operation,
  promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},
  scope:pr.scope,
  responseType:'BLOCKED',
  humanInputRequests:[],
  stageData:{},
  records:{},
  evidence:[],
  unresolved:[{temporaryKey:'u-1',kind:'MISSING_CAPABILITY',description:'Controlled blocker.',whyBlocking:'Contract-profile validation fixture.',affectedStageFields:[],affectedRecords:[],blocking:true}],
  warnings:[],
  attachments:[]
};
const valid=ingestion.validateEnvelope(p,base,{stage:1,promptRecord:pr,rawSha256:globalThis.closedLoopHash.sha256Text(JSON.stringify(base)),files:[]});
assert(!valid.issues.some(x=>x.code==='WRONG_CONTRACT_PROFILE'),JSON.stringify(valid.issues));
for(const bad of [null,'closed-loop-completion-profile/0']){
  const envelope={...base};
  if(bad===null)delete envelope.contractProfileId;
  else envelope.contractProfileId=bad;
  const issues=ingestion.validateEnvelope(p,envelope,{stage:1,promptRecord:pr,rawSha256:globalThis.closedLoopHash.sha256Text(JSON.stringify(envelope)),files:[]});
  assert(issues.issues.some(x=>x.code==='WRONG_CONTRACT_PROFILE'),JSON.stringify(issues.issues));
}

console.log(JSON.stringify({
  responseContractProfileBinding:'PASS',
  relationshipReferenceGrammarPublished:true,
  evidenceReferenceGrammarPublished:true,
  targetIdBoundaryPublished:true,
  stage3PromptReferenceExamples:true
}));

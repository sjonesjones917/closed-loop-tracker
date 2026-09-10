import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f});
const core=closedLoopCore,schema=closedLoopWorkflowSchema,engine=closedLoopWorkflowEngine,prompts=closedLoopPromptEngine,ingestion=closedLoopResponseIngestion;

const p=core.createBlankState('JOB-CONTRACT-PROFILE');
p.job.EXACT_USER_OBJECTIVE_VERBATIM='Verify response contract profile binding.';
p.job.CURRENT_INPUT_VERSION='INPUT-v001';
engine.ensureShape(p);
engine.recalculate(p);
const pr=prompts.buildPromptRecord(1,p);
const descriptor=prompts.responseContractDescriptor(1,pr.operation);
assert(descriptor.envelope.topLevelKeys.includes('contractProfileId'));

// Permanent regression for the real Stage 03 agent/application handshake defect:
// a proposed record uses top-level tempKey/targetId identity, while nested references
// use tempKey/recordId. The generated contract must publish that distinction exactly.
const stage3Descriptor=prompts.responseContractDescriptor(3,'COMPLETE');
const relationshipReferenceContract=stage3Descriptor.envelope.relationshipReferenceContract;
assert.deepEqual(relationshipReferenceContract.allowedKeys,['tempKey','recordId']);
assert.equal(relationshipReferenceContract.exactlyOneRequired,true);
assert.equal(relationshipReferenceContract.existingCanonicalRecordKey,'recordId');
assert.equal(relationshipReferenceContract.sameResponseRecordKey,'tempKey');
assert.deepEqual(relationshipReferenceContract.prohibitedKeys,['targetId']);
assert.equal(relationshipReferenceContract.bareStringAllowed,false);
assert.match(relationshipReferenceContract.targetIdScope,/top-level record identity/i);
assert.match(stage3Descriptor.envelope.recordIdentityRule,/does not apply inside relationships/i);
assert.equal(stage3Descriptor.envelope.evidenceReferenceContract.sourceRef,'relationshipReferenceContract');
assert.equal(stage3Descriptor.envelope.evidenceReferenceContract.attachmentRef,'relationshipReferenceContract');
assert.equal(stage3Descriptor.records.research.relationships.SOURCE_ID,'sources');
assert.equal(stage3Descriptor.records.candidateRequirements.relationships.SOURCE_ID,'sources');

const rendered=JSON.parse(prompts.responseContract(1,pr.operation,pr.instructionId,pr.bodySha256,pr.contractSha256,pr.contextSignature,pr.scope,p.job.JOB_ID));
assert.equal(rendered.contractProfileId,schema.CONTRACT_PROFILE_ID);
const base={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:1,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'u-1',kind:'MISSING_CAPABILITY',description:'Controlled blocker.',whyBlocking:'Contract-profile validation fixture.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};
const valid=ingestion.validateEnvelope(p,base,{stage:1,promptRecord:pr,rawSha256:closedLoopHash.sha256Text(JSON.stringify(base)),files:[]});
assert(!valid.issues.some(x=>x.code==='WRONG_CONTRACT_PROFILE'),JSON.stringify(valid.issues));
for(const bad of [null,'closed-loop-completion-profile/0']){
  const e={...base};
  if(bad===null)delete e.contractProfileId;else e.contractProfileId=bad;
  const issues=ingestion.validateEnvelope(p,e,{stage:1,promptRecord:pr,rawSha256:closedLoopHash.sha256Text(JSON.stringify(e)),files:[]});
  assert(issues.issues.some(x=>x.code==='WRONG_CONTRACT_PROFILE'),JSON.stringify(issues.issues));
}
console.log(JSON.stringify({responseContractProfileBinding:'PASS',stage03ReferenceEncodingPublished:true}));

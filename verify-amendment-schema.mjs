import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','project-store.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const hash=globalThis.closedLoopHash;
const engine=globalThis.closedLoopWorkflowEngine;
const store=globalThis.closedLoopProjectStore;
assert.equal(schema.version,'closed-loop-workflow-schema/3');
assert.equal(schema.BUILD_IDENTITY,'runtime-20260901-controlling-amendment-63');
assert.equal(schema.CANONICAL_JSON_VERSION,'closed-loop-canonical-json/1');
assert.equal(schema.WORKER_PROTOCOL_VERSION,'closed-loop-test-worker-protocol/1');
assert.equal(schema.WORKER_IDENTITY_CONTRACT.workerByteDigest.hashAlgorithm,'SHA-256');
assert.equal(schema.WORKER_IDENTITY_CONTRACT.workerByteDigest.requiredForReleaseBearingResult,true);

const amendmentFields=Object.values(schema.AMENDMENT_STAGE_FIELD_NAMES).flat();
assert.equal(amendmentFields.length,236,'all 236 Section 67 stage-field additions must be explicitly registered');
for(let stage=1;stage<=30;stage++){
  const stageDefinition=core.STAGES[stage-1];
  const definitions=schema.STAGE_FIELDS[stage];
  assert.equal(Object.keys(definitions).length,stageDefinition.fields.length,`Stage ${stage} schema must define every field`);
  for(const name of stageDefinition.fields){
    const definition=definitions[name];
    assert.ok(definition,`Stage ${stage}.${name} lacks a definition`);
    assert.ok(['HUMAN','HUMAN_DECISION','AGENT','APPLICATION'].includes(definition.producer),`Stage ${stage}.${name} has invalid producer`);
    assert.ok(schema.VALUE_TYPES.includes(definition.valueType),`Stage ${stage}.${name} lacks an explicit type`);
  }
}
assert.equal(schema.STAGE_FIELDS[28].DELIVERY_AUTHORIZATION.producer,'HUMAN_DECISION');
assert.equal(schema.STAGE_FIELDS[28].HUMAN_DELIVERY_INTENT.producer,'HUMAN_DECISION');
assert.equal(schema.STAGE_FIELDS[28].DELIVERY_AUTHORIZATION_EFFECTIVE.producer,'APPLICATION');

assert.equal(schema.EXACT_RATIO_SCHEMA,'closed-loop-exact-ratio/1');
const half=schema.makeExactRatio(1,2);
assert.deepEqual(half,{numberType:'RATIO',numerator:1,denominator:2});
assert.equal(schema.validateExactRatio(half).valid,true);
assert.equal(schema.validateExactRatio({numberType:'RATIO',numerator:2,denominator:4}).valid,false,'non-reduced ratios are not canonical');
assert.equal(schema.exactRatioToNumber(half),0.5,'presentation conversion must not mutate the canonical value');
for(const [stage,names] of Object.entries(schema.EXACT_RATIO_STAGE_FIELD_NAMES))for(const name of names){
  const definition=schema.STAGE_FIELDS[stage][name];
  assert.equal(definition.producer,'APPLICATION',`${stage}.${name} must remain application-owned`);
  assert.equal(definition.valueType,'OBJECT',`${stage}.${name} must use the exact-ratio object`);
  assert.deepEqual(definition.closedProperties,['numberType','numerator','denominator']);
  assert.equal(definition.normalizerKey,'EXACT_RATIO_V1');
}
for(const name of ['REQUIREMENT_COVERAGE','VERIFICATION_COVERAGE','REGRESSION_SUCCESS']){
  const definition=schema.RECORD_SCHEMAS.convergenceRecords.fieldDefinitions[name];
  assert.equal(definition.valueType,'OBJECT',`convergenceRecords.${name} must use an exact ratio`);
  assert.deepEqual(definition.closedProperties,['numberType','numerator','denominator']);
}
assert.match(hash.sha256Value({stages:{6:{derivedData:{MANDATORY_TEST_COVERAGE:half}}}}),/^[a-f0-9]{64}$/,'an intermediate half-coverage state must be canonically hashable');
assert.throws(()=>hash.sha256Value({stages:{6:{derivedData:{MANDATORY_TEST_COVERAGE:0.5}}}}),TypeError,'direct canonical JSON must still reject a binary fractional Number');
assert.match(store.projectSha256({schema:'closed-loop-project/3',workflow:'mobile-closed-loop/30',stageCount:30,revision:7,job:{JOB_ID:'JOB-RATIO'},stages:{6:{derivedData:{MANDATORY_TEST_COVERAGE:half}}},projectData:{}}),/^[a-f0-9]{64}$/,'the canonical persistence hash boundary must accept an exact intermediate ratio');
assert.throws(()=>store.projectSha256({schema:'closed-loop-project/3',workflow:'mobile-closed-loop/30',stageCount:30,revision:7,job:{JOB_ID:'JOB-FLOAT'},stages:{6:{derivedData:{MANDATORY_TEST_COVERAGE:0.5}}},projectData:{}}),TypeError,'the persistence hash boundary must not silently accept a binary fractional Number');
const intermediate=core.createBlankState('JOB-HALF-COVERAGE');
Object.assign(intermediate.job,{CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-v001',CURRENT_REQUIREMENTS_VERSION:'REQ-v001',CURRENT_TEST_SUITE_VERSION:'TEST-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'});
engine.ensureShape(intermediate);
const currentScope=engine.currentScope(intermediate);
for(const id of ['REQ-1','REQ-2'])intermediate.projectData.requirements.push({id,stage:4,active:true,scope:{...currentScope},fields:{REQ_ID:id,MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'},relationships:{}});
intermediate.projectData.tests.push({id:'TEST-1',stage:6,active:true,scope:{...currentScope},fields:{TEST_ID:'TEST-1',REQ_ID:'REQ-1',STATUS:'READY',EXECUTION_MODE:'HUMAN_INSPECTION'},relationships:{REQ_ID:'REQ-1'}});
const stageSixDerived=engine.deriveStageData(intermediate,6);
assert.deepEqual(stageSixDerived.MANDATORY_TEST_COVERAGE,half,'the engine must project intermediate 1/2 coverage into the exact-ratio schema');
intermediate.stages[6].derivedData=stageSixDerived;
assert.match(store.projectSha256(intermediate),/^[a-f0-9]{64}$/,'an engine-derived intermediate half-coverage project must persist and hash without binary-float ambiguity');

const addedFamilies={
  propositions:'PROPOSITION_ID',
  propositionEquivalenceReviews:'PROP_EQ_REVIEW_ID',
  applicabilityRecords:'APPLICABILITY_ID',
  proofExpressions:'PROOF_EXPRESSION_ID',
  proofObligations:'PROOF_OBLIGATION_ID',
  observationRecords:'OBSERVATION_ID',
  entailmentReviews:'ENTAILMENT_ID',
  environmentDependencies:'DEPENDENCY_ID',
  operationReservations:'OPERATION_RESERVATION_ID',
  deliveryRecords:'DELIVERY_ID',
  deploymentManifests:'DEPLOYMENT_MANIFEST_ID'
};
for(const [collection,idField] of Object.entries(addedFamilies)){
  const record=schema.RECORD_SCHEMAS[collection];
  assert.ok(record,`${collection} must exist`);
  assert.equal(record.idField,idField);
  const partitions=record.ownership;
  const union=[...(partitions.human||[]),...(partitions.humanDecision||[]),...(partitions.agent||[]),...(partitions.application||[])];
  assert.equal(union.length,record.fields.length,`${collection} ownership must be exhaustive`);
  assert.equal(new Set(union).size,record.fields.length,`${collection} ownership must be disjoint`);
  for(const name of record.fields)assert.equal(record.fieldDefinitions[name].producer,partitions.human.includes(name)?'HUMAN':partitions.humanDecision.includes(name)?'HUMAN_DECISION':partitions.agent.includes(name)?'AGENT':'APPLICATION',`${collection}.${name} producer mismatch`);
  for(const target of Object.values(record.relationships||{}))assert.ok(schema.RECORD_SCHEMAS[target],`${collection} references unknown collection ${target}`);
}

for(const collection of ['propositions','applicabilityRecords','proofObligations','entailmentReviews','environmentDependencies']){
  const fields=schema.RECORD_SCHEMAS[collection].fields;
  for(const name of ['TRUTH_VALUE','EPISTEMIC_BASIS','CURRENT_SCOPE_STATUS','FRESHNESS_STATUS','CONTRADICTION_STATUS','REASONS','SUPPORTING_EVIDENCE_IDS','DERIVATION_ID'])assert.ok(fields.includes(name),`${collection} lacks epistemic dimension ${name}`);
}
const observations=schema.RECORD_SCHEMAS.observationRecords;
assert.equal(observations.fieldDefinitions.NATIVE_OBSERVED_VALUE.producer,'APPLICATION');
assert.equal(observations.fieldDefinitions.EXTERNAL_OBSERVED_VALUE.producer,'AGENT');
assert.equal(observations.fieldDefinitions.HUMAN_OBSERVED_VALUE.producer,'HUMAN');
assert.equal(schema.RECORD_SCHEMAS.deterministicResults.fieldDefinitions.DETERMINATION.producer,'APPLICATION');
assert.equal(schema.RECORD_SCHEMAS.deterministicResults.fieldDefinitions.TEST_WORKER_SHA256.producer,'APPLICATION');
assert.equal(schema.RECORD_SCHEMAS.tests.fieldDefinitions.SEMANTIC_COVERAGE_DISPOSITION.producer,'AGENT');
assert.equal(schema.RECORD_SCHEMAS.tests.fieldDefinitions.ACCEPTED_SEMANTIC_COVERAGE.producer,'APPLICATION');
assert.equal(schema.RECORD_SCHEMAS.tests.fieldDefinitions.RELEASE_BEARING.producer,'APPLICATION');
assert.equal(schema.RECORD_SCHEMAS.applicabilityRecords.relationships.SUBJECT_ID,'propositions','applicability must bind its subject through a typed canonical proposition relationship');

assert.deepEqual(schema.TRUTH_VALUES,['TRUE','FALSE','UNKNOWN']);
assert.deepEqual(schema.APPLICABILITY_VALUES,['APPLICABLE','NOT_APPLICABLE','UNKNOWN']);
assert.deepEqual(schema.SEMANTIC_COVERAGE_VALUES,['EQUIVALENT','PARTIAL','UNKNOWN','NOT_EQUIVALENT']);
assert.deepEqual(schema.ENTAILMENT_VALUES,['ESTABLISHES','REFUTES','SUPPORTS_ONLY','CONTEXT_ONLY','DOES_NOT_ADDRESS','UNKNOWN']);
assert.deepEqual(schema.DELIVERY_STATES,['AUTHORIZED','BLOCKED','WITHDRAWN_FOR_FUTURE_USE','SUPERSEDED']);

assert.ok(schema.STAGE_OPERATIONS[1].includes('SEMANTIC_CHALLENGE')&&schema.STAGE_OPERATIONS[1].includes('RECONCILE_INTAKE'));
assert.ok(schema.STAGE_OPERATIONS[4].includes('DISPOSITION_CHALLENGE')&&schema.STAGE_OPERATIONS[4].includes('ATOMICITY_CHALLENGE'));
assert.ok(schema.operationContract(4,'COMPLETE').agentWritableCollections.includes('propositions'));
assert.ok(schema.operationContract(6,'COMPLETE').applicationCollections.includes('proofObligations'));
for(const collection of ['requirementResolutions','propositionEquivalenceReviews','applicabilityRecords'])assert.ok(schema.operationContract(5,'COMPLETE').agentWritableCollections.includes(collection),`Stage 5 COMPLETE cannot submit required author collection ${collection}`);
assert.equal(schema.operationContract(5,'COMPLETE').agentWritableCollections.includes('applicabilityReviews'),false,'Stage 5 COMPLETE improperly gained the independent applicability-review collection');
assert.deepEqual(schema.operationContract(5,'APPLICABILITY_REVIEW').agentWritableCollections,['applicabilityReviews'],'Stage 5 independent review write contract widened beyond applicabilityReviews');
for(const collection of ['tests','proofExpressions','environmentDependencies'])assert.ok(schema.operationContract(6,'COMPLETE').agentWritableCollections.includes(collection),`Stage 6 COMPLETE cannot submit required author collection ${collection}`);
assert.equal(schema.operationContract(6,'COMPLETE').agentWritableCollections.includes('testSemanticReviews'),false,'Stage 6 COMPLETE improperly gained the independent semantic-review collection');
assert.deepEqual(schema.operationContract(6,'SEMANTIC_REVIEW').agentWritableCollections,['testSemanticReviews'],'Stage 6 independent review write contract widened beyond testSemanticReviews');
assert.ok(schema.operationContract(30,'COMPLETE').applicationCollections.includes('deliveryRecords'));
assert.deepEqual(schema.operationContract(17,'EXECUTE_RUN').agentWritableCollections,['runs'],'amendment routing must not widen Stage 17 operation-specific writes');
assert.deepEqual(schema.operationContract(19,'VERIFY').agentWritableCollections,['verification','observationRecords','entailmentReviews'],'Stage 19 VERIFY must reuse the current observation and entailment contract without widening other suboperations');
for(const name of ['instructions','requirements','artifacts'])assert.ok(schema.operationContract(17,'FREEZE').readCollections.includes(name),`Stage 17 FREEZE lost operation input ${name}`);
assert.equal(schema.operationContract(17,'FREEZE').readCollections.includes('observationRecords'),false,'Stage 17 FREEZE must not receive later verification observations');
assert.equal(schema.operationContract(17,'FREEZE').agentWritableCollections.includes('observationRecords'),false,'Stage 17 FREEZE must not gain VERIFY writes');
for(const stage of [17,19])for(const name of ['verification','observationRecords','entailmentReviews'])assert.ok(schema.operationContract(stage,'VERIFY').agentWritableCollections.includes(name),`Stage ${stage} VERIFY must allow ${name}`);
for(const [stage,operation] of [[12,'COMPLETE'],[17,'VERIFY'],[19,'VERIFY'],[23,'COMPLETE'],[24,'COMPLETE']])for(const collection of ['observationRecords','entailmentReviews'])assert.equal(schema.operationContract(stage,operation).readCollections.includes(collection),false,`Stage ${stage}/${operation} must create ${collection} without receiving prior reviewer conclusions`);
for(const collection of ['propositions','proofExpressions','proofObligations','observationRecords','entailmentReviews'])assert.equal(schema.operationContract(21,'COMPLETE').readCollections.includes(collection),false,`Stage 21 production context must not receive broad ${collection} history`);
for(const collection of ['baselines','instructions','artifacts','freshContexts'])assert.equal(schema.operationContract(21,'COMPLETE').readCollections.includes(collection),true,`Stage 21 lost approved production input ${collection}`);
for(let stage=1;stage<=30;stage++)for(const operation of schema.STAGE_OPERATIONS[stage])assert.equal(schema.operationContract(stage,operation).readCollections.includes('operationReservations'),false,`Stage ${stage}/${operation} must keep application reservations private`);
for(const collection of ['observationRecords','entailmentReviews']){
  assert.equal(schema.operationContract(20,'COMPLETE').readCollections.includes(collection),false,`Stage 20 must not receive prior ${collection}`);
  assert.equal(schema.operationContract(21,'COMPLETE').readCollections.includes(collection),false,`Stage 21 must not receive prior ${collection}`);
  assert.equal(schema.operationContract(22,'COMPLETE').readCollections.includes(collection),false,`Stage 22 must create results without prior ${collection}`);
}
for(const name of ['PROPOSITION_ID','PROOF_OBLIGATION_ID','APPLICABILITY_ID','APPLICABILITY_STATE','PROOF_EXPRESSION_ID','OBSERVATION_IDS','ENTAILMENT_IDS','EPISTEMIC_BASES','FRESHNESS_STATUSES','ENVIRONMENT_DEPENDENCY_IDS','JUSTIFICATION_CYCLE_COUNT','EVIDENCE_CHAIN_SET_SHA256'])assert.equal(schema.RECORD_SCHEMAS.evidenceChains.fieldDefinitions[name].producer,'APPLICATION',`evidenceChains.${name} must be application-owned`);

const binding=schema.RESPONSE_ENVELOPE_CONTRACT.operationBinding;
assert.equal(binding.conditional,true);
assert.deepEqual(binding.required,['packageId','operationReservationId','challengeNonce','projectRevision','scopeSha256','targetSlot']);
assert.deepEqual(binding.closedProperties,binding.required);

assert.equal(schema.validateProofExpression({op:'ALL_OF',children:[{op:'LEAF',leafType:'TEST_RESULT',referenceId:'RESULT-1'},{op:'AT_LEAST_K',k:1,children:[{op:'LEAF',leafType:'OBSERVATION',referenceId:'OBS-1'}]}]}).valid,true);
assert.equal(schema.validateProofExpression({op:'LEAF',leafType:'TEST_RESULT_SET',referenceId:'TEST-1'}).valid,true,'a frozen TEST_ID result-set leaf must be a registered proof-expression primitive');
assert.equal(schema.validateProofExpression({op:'LEAF',leafType:'UNREGISTERED_FUTURE_RESULT',referenceId:'TEST-1'}).valid,false,'unregistered proof leaf types must fail closed');
assert.equal(schema.validateProofExpression({op:'ALL_OF',children:[]}).valid,false);
assert.equal(schema.validateProofExpression({op:'AT_LEAST_K',k:0,children:[{op:'LEAF',leafType:'TEST_RESULT',referenceId:'RESULT-1'}]}).valid,false);
assert.equal(schema.validateProofExpression({op:'LEAF',leafType:'TEST_RESULT',referenceId:'RESULT-1',script:'return true'}).valid,false);
const cyclic={op:'ALL_OF',children:[]};cyclic.children.push(cyclic);
assert.equal(schema.validateProofExpression(cyclic).valid,false);

console.log(JSON.stringify({verifyAmendmentSchema:'PASS',amendmentStageFields:amendmentFields.length,newRecordFamilies:Object.keys(addedFamilies).length,totalRecordFamilies:Object.keys(schema.RECORD_SCHEMAS).length,staticProducerPartitions:true,proofExpressionValidation:true,operationBindingClosed:true,buildIdentity:schema.BUILD_IDENTITY}));

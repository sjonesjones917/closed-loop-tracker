import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

function loadSchema(source=fs.readFileSync('workflow-schema.js','utf8')){
  const context={console,TextEncoder,TextDecoder,crypto:webcrypto,dispatchEvent(){},Event:function Event(type){this.type=type}};
  context.globalThis=context;
  vm.createContext(context);
  for(const file of ['workbook.js','hash.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  vm.runInContext(source,context,{filename:'workflow-schema.js'});
  return context.closedLoopWorkflowSchema;
}

function verify(source){
  const schema=loadSchema(source);
  for(const name of ['FIELD_REGISTRY','STAGE_OPERATION_REGISTRY','STAGE_OPERATION_SCOPE_MATRIX','DURABLE_OBJECT_REGISTRY'])assert.ok(schema[name],`${name} must be exported.`);
  assert.equal(Object.keys(schema.STAGE_OPERATION_REGISTRY).length,66,'Exactly 66 registered stage-operation combinations are required.');
  const requiredFamilies=['humanDecisions','sourceSearchContracts','semanticChallenges','semanticReviews','expectedVarianceContracts','environmentManifests','externalCapabilities','materialityReviews','commandReceipts','backupPolicies','backupCheckpoints','deliveryCandidateSets','deliveryAttempts','mobileAcceptanceRecords'];
  for(const family of requiredFamilies){assert.ok(schema.RECORD_SCHEMAS[family],`${family} must be a canonical family.`);assert.ok(schema.DURABLE_OBJECT_REGISTRY[family],`${family} must be in DURABLE_OBJECT_REGISTRY.`);}
  for(const field of ['VERIFICATION_PHASE','EARLIEST_EXECUTABLE_STAGE','REQUIRED_BY_STAGE','PER_RUN_REQUIRED','FINAL_PRODUCT_REQUIRED','DELIVERY_REQUIRED','TARGET_AVAILABILITY_CONDITION'])assert.ok(schema.RECORD_SCHEMAS.tests.fieldDefinitions[field],`tests.${field} is required.`);
  assert.deepEqual([...schema.STAGE_OPERATION_SCOPE_MATRIX['30:CALCULATE_TERMINAL'].requiredDimensions],['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId','evidenceChainVersion']);
  assert.deepEqual([...schema.STAGE_OPERATION_SCOPE_MATRIX['19:CONFIRM'].requiredDimensions],['sourceConvergedIterationId','confirmationIterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion']);
  assert.equal(schema.STAGE_OPERATION_REGISTRY['30:CALCULATE_TERMINAL'].executorClass,'APPLICATION');
  assert.equal(schema.STAGE_OPERATION_REGISTRY['28:CAPTURE_DELIVERY_INTENT'].executorClass,'HUMAN_DECISION');
  assert.equal(schema.STAGE_OPERATION_REGISTRY['1:COMPLETE'].executorClass,'EXTERNAL_AGENT');
  assert.equal(schema.STAGE_OPERATION_REGISTRY['1:COMPLETE'].reservationRequired,true);

  // The scope matrix is an operation contract, not a stage-wide label. Creation operations
  // reserve their target; later operations consume the already-created identity.
  assert.equal(schema.STAGE_OPERATION_SCOPE_MATRIX['25:FREEZE_DELIVERY_CANDIDATE'].dimensions.deliveryCandidateSetId,'TARGET_RESERVED','Stage 25 freeze must reserve the delivery-candidate set.');
  assert.equal(schema.STAGE_OPERATION_SCOPE_MATRIX['25:COMPLETE'].dimensions.deliveryCandidateSetId,'INPUT_CURRENT','Stage 25 inspection must consume the frozen delivery-candidate set.');
  assert.equal(schema.STAGE_OPERATION_SCOPE_MATRIX['19:CONFIRM_FREEZE'].dimensions.confirmationIterationId,'TARGET_RESERVED','Stage 19 freeze must reserve the confirmation iteration.');
  for(const operation of ['EXECUTE_RUN','VERIFY','COMPARE','REGRESSION_VERIFY','CONFIRM'])assert.equal(schema.STAGE_OPERATION_SCOPE_MATRIX[`19:${operation}`].dimensions.confirmationIterationId,'INPUT_CURRENT',`Stage 19 ${operation} must consume the current confirmation iteration.`);
  assert.equal(schema.STAGE_OPERATION_SCOPE_MATRIX['27:CALCULATE_RELEASE'].dimensions.reconciledReviewVersion,'INPUT_CURRENT','Stage 27 must consume the Stage 26 reconciled review.');
  assert.equal(schema.STAGE_OPERATION_SCOPE_MATRIX['28:VERIFY_IDENTITY'].dimensions.releaseId,'INPUT_CURRENT','Stage 28 must consume the Stage 27 release.');
  assert.equal(schema.STAGE_OPERATION_SCOPE_MATRIX['29:CALCULATE_EVIDENCE_CHAINS'].dimensions.hashReviewId,'INPUT_CURRENT','Stage 29 must consume the Stage 28 hash review.');
  assert.equal(schema.STAGE_OPERATION_SCOPE_MATRIX['30:CALCULATE_TERMINAL'].dimensions.evidenceChainVersion,'INPUT_CURRENT','Stage 30 must consume the Stage 29 evidence-chain version.');

  // A named derivation registry is not closed if FIELD_REGISTRY points at derivations that
  // have no registered contract. Every referenced derivation must resolve to metadata that
  // identifies its owner, contracts, implementation identity, and invalidation consequence.
  const derivationIds=[...new Set(Object.values(schema.FIELD_REGISTRY).map(entry=>entry.derivationIdentity).filter(Boolean))];
  assert.ok(derivationIds.length>0,'The field registry must contain application derivations.');
  for(const id of derivationIds){
    const entry=schema.derivationRegistry?.entries?.[id];
    assert.ok(entry,`Missing derivation registry entry ${id}.`);
    for(const key of ['registryId','version','implementationOwnerFile','canonicalInputContract','outputContract','implementationIdentity','invalidationConsequences'])assert.ok(entry[key]!==undefined&&entry[key]!==null&&entry[key]!=='',`Derivation ${id} is missing ${key}.`);
  }

  return {contractClosure:'PASS',stageOperations:66,durableFamilies:Object.keys(schema.DURABLE_OBJECT_REGISTRY).length,fieldContracts:Object.keys(schema.FIELD_REGISTRY).length,derivations:derivationIds.length};
}

const source=fs.readFileSync('workflow-schema.js','utf8');
const result=verify(source);
assert.throws(()=>verify(source.replace("30:['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId','evidenceChainVersion']","30:['baselineId','productId']")),/deepStrictEqual|Expected values to be strictly deep-equal/,'Mutation removing terminal scope dimensions must fail.');
assert.throws(()=>verify(source.replace("addRequiredFamily('humanDecisions'","addRequiredFamily('humanDecisionBROKEN'")),/humanDecisions must be a canonical family/,'Mutation removing humanDecisions must fail.');
console.log(JSON.stringify(result));

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

const REQUIRED_OPERATION_PROPERTIES=Object.freeze([
  'stage','operation','executorClass','acceptsExternalResponse','responseTypes','acceptanceMode','reservationRequired','scope',
  'readCollections','writableCollections','agentWritableCollections','allowedStageData','scopeRequirements','applicationCollections','completionPredicate','retryRule','minimumInputBindingBasis'
]);
const REQUIRED_FIELD_PROPERTIES=Object.freeze([
  'path','producer','valueType','enumValues','nullable','cardinality','requiredAtStage','requiredness','writableOperation','classification',
  'relationshipTarget','relationshipDirection','scope','scopeDimensions','migrationRule','invalidationOwner','normalizerIdentity','derivationIdentity'
]);

function verify(source){
  const schema=loadSchema(source);
  for(const name of ['FIELD_REGISTRY','STAGE_OPERATION_REGISTRY','STAGE_OPERATION_SCOPE_MATRIX','DURABLE_OBJECT_REGISTRY','normalizerRegistry','derivationRegistry','ATTACHMENT_SLOT_CONTRACT','HUMAN_DECISION_PURPOSE_REGISTRY'])assert.ok(schema[name],`${name} must be exported.`);
  assert.equal(Object.keys(schema.STAGE_OPERATION_REGISTRY).length,66,'Exactly 66 registered stage-operation combinations are required.');
  assert.deepEqual(Object.keys(schema.STAGE_OPERATION_REGISTRY).sort(),Object.keys(schema.STAGE_OPERATION_SCOPE_MATRIX).sort(),'Operation registry and scope matrix universes must be identical.');

  const requiredFamilies=['humanDecisions','sourceSearchContracts','semanticChallenges','semanticReviews','expectedVarianceContracts','environmentManifests','externalCapabilities','materialityReviews','commandReceipts','backupPolicies','backupCheckpoints','deliveryCandidateSets','deliveryAttempts','mobileAcceptanceRecords'];
  for(const family of requiredFamilies){assert.ok(schema.RECORD_SCHEMAS[family],`${family} must be a canonical family.`);assert.ok(schema.DURABLE_OBJECT_REGISTRY[family],`${family} must be in DURABLE_OBJECT_REGISTRY.`);}
  assert.deepEqual(Object.keys(schema.RECORD_SCHEMAS).sort(),Object.keys(schema.DURABLE_OBJECT_REGISTRY).sort(),'Every canonical family must have exactly one durable-object contract.');

  for(const [key,contract] of Object.entries(schema.STAGE_OPERATION_REGISTRY)){
    for(const property of REQUIRED_OPERATION_PROPERTIES)assert.ok(Object.prototype.hasOwnProperty.call(contract,property),`${key} missing operation property ${property}.`);
    assert.equal(contract.scope,schema.STAGE_OPERATION_SCOPE_MATRIX[key],`${key} must reference its exact scope contract.`);
    assert.deepEqual([...contract.scopeRequirements],[...contract.scope.requiredDimensions],`${key} scope requirements must equal the scope matrix.`);
  }
  assert.equal(schema.STAGE_OPERATION_REGISTRY['31:COMPLETE'],undefined,'Unknown stage-operation must fail closed.');
  assert.deepEqual([...schema.STAGE_OPERATION_SCOPE_MATRIX['30:CALCULATE_TERMINAL'].requiredDimensions],['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId','evidenceChainVersion']);
  assert.deepEqual([...schema.STAGE_OPERATION_SCOPE_MATRIX['19:CONFIRM'].requiredDimensions],['sourceConvergedIterationId','confirmationIterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion']);
  assert.equal(schema.STAGE_OPERATION_REGISTRY['30:CALCULATE_TERMINAL'].executorClass,'APPLICATION');
  assert.equal(schema.STAGE_OPERATION_REGISTRY['28:CAPTURE_DELIVERY_INTENT'].executorClass,'HUMAN_DECISION');
  assert.equal(schema.STAGE_OPERATION_REGISTRY['1:COMPLETE'].executorClass,'EXTERNAL_AGENT');
  assert.equal(schema.STAGE_OPERATION_REGISTRY['1:COMPLETE'].reservationRequired,true);
  assert.equal(schema.STAGE_OPERATION_REGISTRY['1:COMPLETE'].minimumInputBindingBasis,'EXTERNALLY_SUPPORTED','External operations must declare the minimum accepted input-binding basis.');
  assert.equal(schema.STAGE_OPERATION_REGISTRY['30:CALCULATE_TERMINAL'].minimumInputBindingBasis,'APPLICATION_OBSERVED','Application commands bind application-observed inputs.');

  const producerSets={HUMAN:0,HUMAN_DECISION:0,AGENT:0,APPLICATION:0};
  for(const [key,contract] of Object.entries(schema.FIELD_REGISTRY)){
    for(const property of REQUIRED_FIELD_PROPERTIES)assert.ok(Object.prototype.hasOwnProperty.call(contract,property),`${key} missing field contract property ${property}.`);
    assert.ok(Object.prototype.hasOwnProperty.call(producerSets,contract.producer),`${key} has unknown producer ${contract.producer}.`);
    producerSets[contract.producer]++;
    assert.ok(schema.normalizerRegistry.entries[contract.normalizerIdentity],`${key} references undefined normalizer ${contract.normalizerIdentity}.`);
    assert.ok(schema.derivationRegistry.entries[contract.derivationIdentity],`${key} references undefined derivation ${contract.derivationIdentity}.`);
  }
  assert.equal(Object.values(producerSets).reduce((a,b)=>a+b,0),Object.keys(schema.FIELD_REGISTRY).length,'Producer partitions must be exhaustive.');
  assert.equal(new Set(Object.keys(schema.FIELD_REGISTRY)).size,Object.keys(schema.FIELD_REGISTRY).length,'Field registry paths must be unique.');
  assert.equal(schema.FIELD_REGISTRY['RECORD.unknownFamily.UNKNOWN_FIELD'],undefined,'Unknown field must fail closed.');

  for(const field of ['VERIFICATION_PHASE','EARLIEST_EXECUTABLE_STAGE','REQUIRED_BY_STAGE','PER_RUN_REQUIRED','FINAL_PRODUCT_REQUIRED','DELIVERY_REQUIRED','TARGET_AVAILABILITY_CONDITION'])assert.ok(schema.RECORD_SCHEMAS.tests.fieldDefinitions[field],`tests.${field} is required.`);

  assert.equal(schema.ATTACHMENT_SLOT_CONTRACT.mappingAuthority,'ATTACHMENT_SLOT_ID');
  assert.equal(schema.ATTACHMENT_SLOT_CONTRACT.selectionOrderAuthoritative,false);
  assert.equal(schema.ATTACHMENT_SLOT_CONTRACT.filenameAloneAuthoritative,false);
  const validSlot={attachmentSlotId:'SLOT-1',packageId:'PKG-1',operationReservationId:'RES-1',jobId:'JOB-1',stage:11,operation:'EXECUTE_RUN',purpose:'RETURNED_ARTIFACT',role:'RUN_OUTPUT',required:true,allowedMediaTypes:['application/octet-stream'],filenameRule:'REGISTERED',maximumSize:1024,expectedDigest:null};
  assert.equal(schema.validateAttachmentSlotDefinition(validSlot).valid,true,'Valid attachment slot contract must be accepted.');
  assert.equal(schema.validateAttachmentSlotDefinition({...validSlot,attachmentSlotId:undefined}).valid,false,'Missing attachment-slot identity must reject.');

  assert.equal(schema.identityAssuranceSatisfies('BASELINE_AUTHORIZATION','SELF_ASSERTED').allowed,true,'Current baseline authority must permit its registered assurance.');
  assert.equal(schema.identityAssuranceSatisfies('VISUAL_BASELINE_AUTHORIZATION','SELF_ASSERTED').allowed,true,'Visual baseline authorization must be a registered human-decision purpose.');
  assert.equal(schema.identityAssuranceSatisfies('UNKNOWN_PURPOSE','SELF_ASSERTED').allowed,false,'Unknown human-decision purpose must reject.');
  assert.equal(schema.identityAssuranceSatisfies('BASELINE_AUTHORIZATION','NONE').allowed,false,'Identity assurance below the registered minimum must reject.');

  return {contractClosure:'PASS',stageOperations:66,durableFamilies:Object.keys(schema.DURABLE_OBJECT_REGISTRY).length,fieldContracts:Object.keys(schema.FIELD_REGISTRY).length,normalizers:Object.keys(schema.normalizerRegistry.entries).length,derivations:Object.keys(schema.derivationRegistry.entries).length,attachmentSlotContract:true,identityAssuranceContract:true};
}

const source=fs.readFileSync('workflow-schema.js','utf8');
const result=verify(source);
assert.throws(()=>verify(source.replace("30:['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId','evidenceChainVersion']","30:['baselineId','productId']")),/deepStrictEqual|Expected values to be strictly deep-equal/,'Mutation removing terminal scope dimensions must fail.');
assert.throws(()=>verify(source.replace("addRequiredFamily('humanDecisions'","addRequiredFamily('humanDecisionBROKEN'")),/humanDecisions must be a canonical family/,'Mutation removing humanDecisions must fail.');
assert.throws(()=>verify(source.replace("const normalizerId=key=>{if(!key)return NO_NORMALIZER_ID;","const normalizerId=key=>{if(!key)return 'closed-loop-normalizer/missing/1';")),/undefined normalizer/,'Undefined normalizer mutation must fail.');
assert.throws(()=>verify(source.replace("const derivationId=key=>{if(!key)return NO_DERIVATION_ID;","const derivationId=key=>{if(!key)return 'closed-loop-derivation/missing/1';")),/undefined derivation/,'Undefined derivation mutation must fail.');
assert.throws(()=>verify(source.replace("mappingAuthority:'ATTACHMENT_SLOT_ID'","mappingAuthority:'FILENAME'")),/Expected values to be strictly equal|ATTACHMENT_SLOT_ID/,'Filename-authoritative attachment mapping mutation must fail.');
assert.throws(()=>verify(source.replace("minimumIdentityAssurance:'SELF_ASSERTED'","minimumIdentityAssurance:'AUTHENTICATED'")),/Current baseline authority must permit/,'Identity-assurance minimum mutation must fail.');
console.log(JSON.stringify(result));

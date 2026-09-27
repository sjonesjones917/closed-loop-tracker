import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import {createHash} from 'node:crypto';
import {createVerifierRuntime} from './verifier-runtime.mjs';

function loadSchema(source=fs.readFileSync('workflow-schema.js','utf8')){
  const context={console,TextEncoder,TextDecoder,crypto:webcrypto,dispatchEvent(){},Event:function Event(type){this.type=type}};
  context.globalThis=context;
  createVerifierRuntime(context);
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
  assert.deepEqual([...schema.STAGE_OPERATION_SCOPE_MATRIX['19:CONFIRM'].requiredDimensions],['sourceConvergedIterationId','confirmationIterationId','candidateId','requirementsVersion','testSuiteVersion','instructionVersion','iterationId']);
  assert.equal(schema.STAGE_OPERATION_SCOPE_MATRIX['19:CONFIRM'].dimensions.iterationId,'IMMUTABLE_REFERENCE','The confirmation iteration alias must remain an explicit immutable reference.');
  assert.equal(schema.STAGE_OPERATION_REGISTRY['30:CALCULATE_TERMINAL'].executorClass,'APPLICATION');
  assert.equal(schema.STAGE_OPERATION_REGISTRY['28:CAPTURE_DELIVERY_INTENT'].executorClass,'HUMAN_DECISION');
  assert.equal(schema.STAGE_OPERATION_REGISTRY['1:COMPLETE'].executorClass,'EXTERNAL_AGENT');
  assert.equal(schema.STAGE_OPERATION_REGISTRY['1:COMPLETE'].reservationRequired,true);
  assert.equal(schema.STAGE_OPERATION_REGISTRY['1:COMPLETE'].minimumInputBindingBasis,'EXTERNALLY_SUPPORTED','External operations must declare the minimum accepted input-binding basis.');
  assert.equal(schema.STAGE_OPERATION_REGISTRY['30:CALCULATE_TERMINAL'].minimumInputBindingBasis,'APPLICATION_OBSERVED','Application commands bind application-observed inputs.');

  const declarations=[
    ...Object.entries(schema.JOB_FIELDS).map(([name,definition])=>({key:`JOB.${name}`,path:`/job/${name}`,definition,relationship:null})),
    ...Object.entries(schema.STAGE_FIELDS).flatMap(([stage,fields])=>Object.entries(fields).map(([name,definition])=>({key:`STAGE.${stage}.${name}`,path:`/stages/${stage}/${name}`,definition,relationship:null}))),
    ...Object.entries(schema.RECORD_SCHEMAS).flatMap(([family,record])=>Object.entries(record.fieldDefinitions).map(([name,definition])=>({key:`RECORD.${family}.${name}`,path:`/projectData/${family}/*/${name}`,definition,relationship:record.relationships?.[name]||null})))
  ];
  const expectedKeys=declarations.map(({key})=>key).sort();
  assert.equal(new Set(expectedKeys).size,expectedKeys.length,'FIELD_REGISTRY_UNIVERSE_ORACLE: declared fields must have unique identities.');
  const expectedSet=new Set(expectedKeys),actualKeys=Object.keys(schema.FIELD_REGISTRY);
  const missing=expectedKeys.filter(key=>!Object.hasOwn(schema.FIELD_REGISTRY,key)),unexpected=actualKeys.filter(key=>!expectedSet.has(key));
  assert.equal(missing.length+unexpected.length,0,`FIELD_REGISTRY_UNIVERSE_ORACLE: missing ${JSON.stringify(missing)}; undeclared ${JSON.stringify(unexpected)}.`);
  for(const {key,path,definition,relationship} of declarations){
    const contract=schema.FIELD_REGISTRY[key];
    assert.equal(contract.path,path,`FIELD_REGISTRY_BINDING_ORACLE: ${key} must address its declared field.`);
    assert.equal(contract.producer,definition.producer,`FIELD_REGISTRY_BINDING_ORACLE: ${key} producer must match its authoritative declaration.`);
    assert.equal(contract.valueType,definition.valueType,`FIELD_REGISTRY_BINDING_ORACLE: ${key} type must match its authoritative declaration.`);
    assert.equal(contract.nullable,Boolean(definition.nullable),`FIELD_REGISTRY_BINDING_ORACLE: ${key} nullability must match its authoritative declaration.`);
    assert.deepEqual([...contract.enumValues],[...(definition.enumValues||[])],`FIELD_REGISTRY_BINDING_ORACLE: ${key} enum must match its authoritative declaration.`);
    if(key.startsWith('RECORD.'))assert.equal(contract.relationshipTarget,relationship,`FIELD_REGISTRY_BINDING_ORACLE: ${key} relationship must match its authoritative declaration.`);
  }
  assert.equal(new Set(declarations.map(({key})=>schema.FIELD_REGISTRY[key].path)).size,declarations.length,'FIELD_REGISTRY_BINDING_ORACLE: field paths must be unique.');
  const producerSets={HUMAN:0,HUMAN_DECISION:0,AGENT:0,APPLICATION:0};
  for(const [key,contract] of Object.entries(schema.FIELD_REGISTRY)){
    for(const property of REQUIRED_FIELD_PROPERTIES)assert.ok(Object.prototype.hasOwnProperty.call(contract,property),`${key} missing field contract property ${property}.`);
    assert.ok(Object.prototype.hasOwnProperty.call(producerSets,contract.producer),`${key} has unknown producer ${contract.producer}.`);
    producerSets[contract.producer]++;
    assert.ok(schema.normalizerRegistry.entries[contract.normalizerIdentity],`${key} references undefined normalizer ${contract.normalizerIdentity}.`);
    assert.ok(schema.derivationRegistry.entries[contract.derivationIdentity],`${key} references undefined derivation ${contract.derivationIdentity}.`);
  }
  assert.equal(Object.values(producerSets).reduce((a,b)=>a+b,0),declarations.length,'Producer partitions must cover the complete declared field universe.');
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

  return {contractClosure:'PASS',stageOperations:66,durableFamilies:Object.keys(schema.DURABLE_OBJECT_REGISTRY).length,fieldContracts:Object.keys(schema.FIELD_REGISTRY).length,normalizers:Object.keys(schema.normalizerRegistry.entries).length,derivations:Object.keys(schema.derivationRegistry.entries).length,attachmentSlotContract:true,identityAssuranceContract:true,fieldRegistryProof:{
    expected:'Every declared Job, stage and canonical-record field occurs once in the registry and retains its declared path, producer, type, nullability, enum and record relationship target.',
    universeDefinition:'All current JOB_FIELDS, STAGE_FIELDS and RECORD_SCHEMAS.fieldDefinitions; independent of the FIELD_REGISTRY entries being checked.',
    includedIds:expectedKeys,excludedIds:[],numerator:declarations.length,denominator:expectedKeys.length,
    partitions:Object.fromEntries(['JOB.','STAGE.','RECORD.'].map(prefix=>[prefix,expectedKeys.filter(key=>key.startsWith(prefix)).length])),
    scope:'Declared-field registry completeness and binding only. This does not establish every specification field, nested-object contract, operation behavior, browser acceptance or physical-device acceptance.',
    result:'PASS'
  }};
}

const source=fs.readFileSync('workflow-schema.js','utf8');
const result=verify(source);
assert.throws(()=>verify(source.replace("30:['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId','evidenceChainVersion']","30:['baselineId','productId']")),/deepStrictEqual|Expected values to be strictly deep-equal/,'Mutation removing terminal scope dimensions must fail.');
assert.throws(()=>verify(source.replace("addRequiredFamily('humanDecisions'","addRequiredFamily('humanDecisionBROKEN'")),/humanDecisions must be a canonical family/,'Mutation removing humanDecisions must fail.');
assert.throws(()=>verify(source.replace("const normalizerId=key=>{if(!key)return NO_NORMALIZER_ID;","const normalizerId=key=>{if(!key)return 'closed-loop-normalizer/missing/1';")),/undefined normalizer/,'Undefined normalizer mutation must fail.');
assert.throws(()=>verify(source.replace("const derivationId=key=>{if(!key)return NO_DERIVATION_ID;","const derivationId=key=>{if(!key)return 'closed-loop-derivation/missing/1';")),/undefined derivation/,'Undefined derivation mutation must fail.');
assert.throws(()=>verify(source.replace("mappingAuthority:'ATTACHMENT_SLOT_ID'","mappingAuthority:'FILENAME'")),/Expected values to be strictly equal|ATTACHMENT_SLOT_ID/,'Filename-authoritative attachment mapping mutation must fail.');
assert.throws(()=>verify(source.replace("minimumIdentityAssurance:'SELF_ASSERTED'","minimumIdentityAssurance:'AUTHENTICATED'")),/Current baseline authority must permit/,'Identity-assurance minimum mutation must fail.');
// Specification 14.5: every declared field occurs exactly once in the closed
// registry. Removing an entry cannot shrink the verifier's expected universe.
const registryFaults=[];
for(const prefix of ['JOB.','STAGE.','RECORD.'])for(const [fault,mutation,oracle] of [
  ['missing','delete entries[key];','FIELD_REGISTRY_UNIVERSE_ORACLE'],
  ['undeclared',"entries[key+'.UNREGISTERED_FIELD']=entries[key];",'FIELD_REGISTRY_UNIVERSE_ORACLE'],
  ['aliased-path',"entries[key]={...entries[key],path:entries[Object.keys(entries).find(other=>other!==key)].path};",'FIELD_REGISTRY_BINDING_ORACLE'],
  ['wrong-producer',"entries[key]={...entries[key],producer:entries[key].producer==='APPLICATION'?'AGENT':'APPLICATION'};",'FIELD_REGISTRY_BINDING_ORACLE'],
  ['wrong-type',"entries[key]={...entries[key],valueType:entries[key].valueType==='BOOLEAN'?'STRING':'BOOLEAN'};",'FIELD_REGISTRY_BINDING_ORACLE'],
  ['wrong-nullability','entries[key]={...entries[key],nullable:!entries[key].nullable};','FIELD_REGISTRY_BINDING_ORACLE'],
  ['wrong-enum',"entries[key]={...entries[key],enumValues:[...entries[key].enumValues,'UNREGISTERED_ENUM_VALUE']};",'FIELD_REGISTRY_BINDING_ORACLE'],
  ...(prefix==='RECORD.'?[['wrong-relationship',"entries[key]={...entries[key],relationshipTarget:entries[key].relationshipTarget?'unregisteredFamily':'requirements'};",'FIELD_REGISTRY_BINDING_ORACLE']]:[])
]){
  const faultSource=source+`\n;(()=>{const s=globalThis.closedLoopWorkflowSchema,entries={...s.FIELD_REGISTRY};const key=Object.keys(entries).find(key=>key.startsWith(${JSON.stringify(prefix)}));if(!key)throw new Error('Registry fault target missing');${mutation}globalThis.closedLoopWorkflowSchema=Object.freeze({...s,FIELD_REGISTRY:Object.freeze(entries)});})();`;
  let rejected=null;
  try{verify(faultSource);}catch(error){rejected=error;}
  assert.ok(rejected?.message.startsWith(oracle),'FIELD_REGISTRY_FAULT_DETECTION_ORACLE: '+fault+' '+prefix+' must fail for its intended invariant; actual '+(rejected?.message||'PASS'));
  registryFaults.push({fault:fault+'-'+prefix,oracle,result:'DETECTED',diagnostic:rejected.message});
}
assert.equal(fs.readFileSync('workflow-schema.js','utf8'),source,'FIELD_REGISTRY_SOURCE_UNCHANGED_ORACLE');
const restored=verify(source);
assert.deepEqual(restored,result,'FIELD_REGISTRY_RESTORED_ORACLE');
console.log(JSON.stringify({...result,registryFaults,sourceSha256:createHash('sha256').update(source).digest('hex'),sourceRestored:true,restored:'PASS'}));

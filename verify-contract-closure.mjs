import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import {createHash} from 'node:crypto';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {verifySpecifiedJobFieldRegistry,verifySpecifiedJobFieldMutants,verifySpecifiedCarrierFieldRegistry,verifySpecifiedCarrierFieldMutants,verifyConditionalDeferredManifestCarrier,verifyRecoverySourceReferenceCarrier,verifyBackupImportStagingCarrier,verifyResponseStagingRecoveryCarriers,verifyJobPointerTargets,verifyMobileAcceptanceSessionCarriers,verifyMobileAcceptanceSessionMergeContract,verifyArtifactByteReferenceCarrier} from './test-specification-field-registry.mjs';

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

// Sections16.1 and16.1A fix these closed values independently of production.
const EXPECTED_VERIFICATION_PHASE_VALUES=Object.freeze(['PREPRODUCT_ITERATION','FINAL_PRODUCT_DETERMINISTIC','FINAL_PRODUCT_MEANING','FINAL_PRODUCT_ADVERSARIAL','FINAL_REPRESENTATION','DELIVERY_IDENTITY','EVIDENCE_CLOSURE','REGISTRY_CLOSURE','TERMINAL_DELIVERY']);
const EXPECTED_TIMING_SOURCE_KIND_VALUES=Object.freeze(['TEST','PROPOSITION','APPLICABILITY','PROOF_OBLIGATION']);

function verifyTimingFieldContracts(schema){
  assert.deepEqual([...schema.VERIFICATION_PHASE_VALUES].sort(),[...EXPECTED_VERIFICATION_PHASE_VALUES].sort(),'TIMING_FIELD_DECLARATION_ORACLE: exported verification phase vocabulary must contain exactly the nine Section16.1 values.');
  const timingTypes={VERIFICATION_PHASE:'ENUM',EARLIEST_EXECUTABLE_STAGE:'INTEGER',REQUIRED_BY_STAGE:'INTEGER',PER_RUN_REQUIRED:'BOOLEAN',FINAL_PRODUCT_REQUIRED:'BOOLEAN',DELIVERY_REQUIRED:'BOOLEAN',TARGET_AVAILABILITY_CONDITION:'OBJECT'};
  for(const family of ['tests','regressions','failureTests'])for(const [field,type] of Object.entries(timingTypes)){
    const definition=schema.RECORD_SCHEMAS[family].fieldDefinitions[field];
    assert.ok(definition,`TIMING_FIELD_DECLARATION_ORACLE: ${family}.${field} is required by Section 16.1.`);
    const expectedProducer=['propositions','proofObligations'].includes(family)?'APPLICATION':'AGENT';
    assert.equal(definition.producer,expectedProducer,`TIMING_FIELD_DECLARATION_ORACLE: ${family}.${field} producer must follow its canonical family.`);
    if(field==='VERIFICATION_PHASE')assert.deepEqual([...definition.enumValues].sort(),[...EXPECTED_VERIFICATION_PHASE_VALUES].sort(),`TIMING_FIELD_DECLARATION_ORACLE: ${family}.${field} must use the complete declared phase enum.`);
    else assert.equal(definition.valueType,type,`TIMING_FIELD_DECLARATION_ORACLE: ${family}.${field} must preserve its declared type.`);
  }
  for(const family of ['propositions','proofObligations'])for(const [field,type]of [['TIMING_ENTRIES','OBJECT_ARRAY'],['TIMING_SCHEDULE_SHA256','STRING']]){const d=schema.RECORD_SCHEMAS[family].fieldDefinitions[field];assert.ok(d&&d.producer==='APPLICATION'&&d.valueType===type,'TIMING_FIELD_DECLARATION_ORACLE: '+family+'.'+field+' must declare the application schedule.');}
  const object=schema.TIMING_CONTRACTS?.objects?.entry;assert.ok(object,'TIMING_FIELD_DECLARATION_ORACLE: closed timing entry contract is missing.');
  const sourceKind=object.fieldDefinitions.SOURCE_KIND;
  assert.ok(sourceKind&&sourceKind.producer==='APPLICATION'&&sourceKind.valueType==='ENUM','TIMING_FIELD_DECLARATION_ORACLE: SOURCE_KIND must be an application-owned enum.');
  assert.deepEqual([...sourceKind.enumValues].sort(),[...EXPECTED_TIMING_SOURCE_KIND_VALUES].sort(),'TIMING_FIELD_DECLARATION_ORACLE: SOURCE_KIND must contain exactly TEST, PROPOSITION, APPLICABILITY and PROOF_OBLIGATION.');
  assert.deepEqual([...object.closedFields].sort(),['LEAF_PATH','SOURCE_KIND','SOURCE_ID',...Object.keys(timingTypes)].sort(),'TIMING_FIELD_DECLARATION_ORACLE: exact entry field universe.');
  for(const [field,type]of Object.entries(timingTypes)){const d=object.fieldDefinitions[field];assert.ok(d&&d.producer==='APPLICATION'&&d.valueType===type,'TIMING_FIELD_DECLARATION_ORACLE: derived entry '+field+' must preserve application ownership and type.');if(field==='VERIFICATION_PHASE')assert.deepEqual([...d.enumValues].sort(),[...EXPECTED_VERIFICATION_PHASE_VALUES].sort(),'TIMING_FIELD_DECLARATION_ORACLE: complete entry phase enum.');}
  for(const producer of ['agent','application'])for(const [type,keys]of Object.entries({PHASE_TARGET:['type'],CURRENT_RECORD:['type','family','recordId'],VERIFIED_ARTIFACT_BYTES:['type','artifactId'],ALL_OF:['type','children'],ANY_OF:['type','children'],AT_LEAST_K:['type','k','children']})){const d=schema.TIMING_CONTRACTS.objects[producer+'Condition.'+type];assert.ok(d,'TIMING_FIELD_DECLARATION_ORACLE: missing closed condition '+type);assert.deepEqual([...d.closedFields].sort(),keys.sort(),'TIMING_FIELD_DECLARATION_ORACLE: exact condition shape '+type);}
  return {families:5,scalarFields:21,derivedScheduleFamilies:2};
}

function verify(source){
  const schema=loadSchema(source);
  verifyTimingFieldContracts(schema);
  for(const name of ['FIELD_REGISTRY','STAGE_OPERATION_REGISTRY','STAGE_OPERATION_SCOPE_MATRIX','DURABLE_OBJECT_REGISTRY','normalizerRegistry','derivationRegistry','ATTACHMENT_SLOT_CONTRACT','HUMAN_DECISION_PURPOSE_REGISTRY','CARRIER_FIELD_CONTRACTS'])assert.ok(schema[name],`${name} must be exported.`);
  const deferredOperations=[['EXECUTE_FAILURE_TEST','failureTests'],['EXECUTE_REGRESSION','regressions']],deferredKeys=[];
  for(const [operation,family]of deferredOperations)for(let stage=schema.RECORD_SCHEMAS[family].stage+1;stage<=schema.STAGE_COUNT;stage++){const key=stage+':'+operation,contract=schema.STAGE_OPERATION_REGISTRY[key];assert(contract?.deferredSubjectFamily===family,'DEFERRED_OPERATION_CONTRACT_ORACLE: missing conditional operation '+key);assert.deepEqual([...contract.agentWritableCollections],['regressionExecutions'],'DEFERRED_OPERATION_CONTRACT_ORACLE: '+key+' may append only execution receipts.');deferredKeys.push(key);}
  assert.equal(Object.keys(schema.STAGE_OPERATION_REGISTRY).length,66+deferredKeys.length,'The approved Section 32.4A combinations extend the original 66 closed operations.');
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

  // Sections 14.5, 14.9 and 35.7 include metadata receipts and their nested
  // mapping objects. The expected receipt fields come from those contracts,
  // not from the FIELD_REGISTRY entries under inspection.
  const receiptShapes={
    DELETE_PROJECT:{receipt:['jobId','commandId','idempotencyKey','payloadSha256','result','committedMetadataSequence','retentionExpiry']},
    CLONE:{receipt:['schema','commandId','sourceJobId','sourceProjectSha256','payloadSha256','resultingJobId','mappingManifest','mappingManifestSha256','result'],mappingManifest:['schema','sourceJobId','resultingJobId','files'],fileMapping:['sourceArtifactId','artifactId','sha256','byteSize','filename','mediaType']}
  },metadataDeclarations=[];
  for(const [operation,objects] of Object.entries(receiptShapes)){
    const variant=schema.DURABLE_OBJECT_REGISTRY.commandReceipts.metadataVariants?.[operation];
    assert.ok(variant?.objects,`COMMAND_RECEIPT_REGISTRY_ORACLE: ${operation} must declare its closed metadata objects.`);
    assert.deepEqual(Object.keys(variant.objects).sort(),Object.keys(objects).sort(),`COMMAND_RECEIPT_REGISTRY_ORACLE: ${operation} object universe.`);
    for(const [name,expectedFields] of Object.entries(objects)){
      const object=variant.objects[name];
      for(const property of ['identity','producerPartitions','scope','scopeDimensions','relationships','hashInclusion','lifecyclePolicy','migrationBehavior','gateUse','invalidationOwner','persistencePolicy'])assert.ok(Object.hasOwn(object,property),`COMMAND_RECEIPT_REGISTRY_ORACLE: ${operation}.${name} lacks ${property}.`);
      assert.equal(object.parentFamily,'commandReceipts','COMMAND_RECEIPT_REGISTRY_ORACLE: exactly one canonical parent owns each receipt object.');
      assert.equal(object.producer,'APPLICATION');
      const identity=operation==='DELETE_PROJECT'?'idempotencyKey':name==='receipt'?'commandId':name==='mappingManifest'?'PARENT_RECEIPT_AND_MAPPING_MANIFEST_SHA256':'PARENT_RECEIPT_AND_ARTIFACT_ID';
      assert.equal(object.identity,identity,'COMMAND_RECEIPT_REGISTRY_ORACLE: nested identity must remain bound to its completed command.');
      assert.deepEqual([...object.producerPartitions.application].sort(),expectedFields.toSorted(),'COMMAND_RECEIPT_REGISTRY_ORACLE: all receipt fields are application-owned.');
      for(const partition of ['human','humanDecision','agent'])assert.deepEqual([...object.producerPartitions[partition]],[]);
      assert.equal(object.scope,'EXACT_COMMAND_AND_PROJECT_IDENTITY');
      assert.deepEqual([...object.scopeDimensions],operation==='CLONE'?['sourceJobId','sourceProjectSha256','resultingJobId']:['jobId','idempotencyKey']);
      assert.equal(object.invalidationOwner,'project-store.js');
      assert.equal(object.persistencePolicy,'METADATA_AND_COMPLETE_RECOVERY');
      assert.equal(object.lifecyclePolicy,'IMMUTABLE_COMPLETED_COMMAND');
      assert.equal(object.migrationBehavior,'NO_DEFAULT_REJECT_INCOMPLETE_RECEIPT');
      assert.deepEqual([...object.hashInclusion].sort(),expectedFields.toSorted());
      assert.deepEqual([...object.gateUse],['EXACT_COMMAND_RETRY','TRANSACTION_COMMIT','HISTORY_RESTORE','BACKUP_EXPORT','BACKUP_RESTORE']);
      assert.deepEqual([...object.closedFields].sort(),expectedFields.toSorted(),`COMMAND_RECEIPT_REGISTRY_ORACLE: ${operation}.${name} closed fields.`);
      assert.deepEqual(Object.keys(object.fieldDefinitions).sort(),expectedFields.toSorted(),`COMMAND_RECEIPT_REGISTRY_ORACLE: ${operation}.${name} typed fields.`);
      for(const field of expectedFields){const definition=object.fieldDefinitions[field],entry=schema.FIELD_REGISTRY[definition.registryKey];metadataDeclarations.push({key:definition.registryKey,path:object.path+'/'+field,definition:{...definition,producer:object.producer},relationship:definition.relationshipTarget||null});if(entry)assert.equal(schema.derivationRegistry.entries[entry.derivationIdentity]?.implementationOwner,'project-store.js','COMMAND_RECEIPT_REGISTRY_ORACLE: receipt derivations must identify the actual persistence owner.');}
      assert.deepEqual(Object.entries(object.relationships).sort(),Object.entries(object.fieldDefinitions).filter(([,definition])=>definition.relationshipTarget).map(([field,definition])=>[field,definition.relationshipTarget]).sort());
    }
  }
  for(const [name,expected]of Object.entries({target:['family','recordId','recordSha256'],artifactTarget:['family','recordId','recordSha256','byteSize','sha256'],isolation:['kind','identity']})){
    const object=schema.DURABLE_OBJECT_REGISTRY.regressionExecutions.deferredExecutionContracts?.[name];assert(object,'DEFERRED_RECEIPT_CONTRACT_ORACLE: missing '+name);assert.deepEqual([...object.closedFields].sort(),expected.sort(),'DEFERRED_RECEIPT_CONTRACT_ORACLE: exact '+name+' shape');
    for(const [field,definition]of Object.entries(object.fieldDefinitions))metadataDeclarations.push({key:definition.registryKey,path:'/deferredExecution/'+name+'/'+field,definition,relationship:definition.relationshipTarget||null});
  }
  const declarations=[
    ...Object.entries(schema.JOB_FIELDS).map(([name,definition])=>({key:`JOB.${name}`,path:`/job/${name}`,definition,relationship:null})),
    ...Object.entries(schema.STAGE_FIELDS).flatMap(([stage,fields])=>Object.entries(fields).map(([name,definition])=>({key:`STAGE.${stage}.${name}`,path:`/stages/${stage}/${name}`,definition,relationship:null}))),
    ...Object.entries(schema.RECORD_SCHEMAS).flatMap(([family,record])=>Object.entries(record.fieldDefinitions).map(([name,definition])=>({key:`RECORD.${family}.${name}`,path:`/projectData/${family}/*/${name}`,definition,relationship:record.relationships?.[name]||null}))),
    ...metadataDeclarations,
    ...Object.values(schema.CARRIER_FIELD_CONTRACTS.objects).flatMap(object=>Object.entries(object.fieldDefinitions).map(([name,definition])=>({key:definition.registryKey,path:object.path+'/'+name,definition,relationship:definition.relationshipTarget||null}))),
    ...Object.values(schema.TIMING_CONTRACTS.objects).flatMap(object=>Object.entries(object.fieldDefinitions).map(([name,definition])=>({key:definition.registryKey,path:object.path+'/'+name,definition,relationship:definition.relationshipTarget||null})))
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
    if(key.startsWith('RECORD.')||key.startsWith('NESTED.'))assert.equal(contract.relationshipTarget,relationship,`FIELD_REGISTRY_BINDING_ORACLE: ${key} relationship must match its authoritative declaration.`);
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

  return {contractClosure:'PASS',stageOperations:Object.keys(schema.STAGE_OPERATION_REGISTRY).length,deferredOperations:deferredKeys.length,durableFamilies:Object.keys(schema.DURABLE_OBJECT_REGISTRY).length,fieldContracts:Object.keys(schema.FIELD_REGISTRY).length,normalizers:Object.keys(schema.normalizerRegistry.entries).length,derivations:Object.keys(schema.derivationRegistry.entries).length,attachmentSlotContract:true,identityAssuranceContract:true,operationRegistryProof:{includedIds:Object.keys(schema.STAGE_OPERATION_REGISTRY).sort(),expectedProperties:REQUIRED_OPERATION_PROPERTIES,result:'PASS'},scopeMatrixProof:{includedIds:Object.keys(schema.STAGE_OPERATION_SCOPE_MATRIX).sort(),result:'PASS'},durableRegistryProof:{includedIds:Object.keys(schema.RECORD_SCHEMAS).sort(),result:'PASS'},fieldRegistryProof:{
    expected:'Every declared Job, stage, canonical-record and metadata command-receipt field occurs once in the registry and retains its declared path, producer, type, nullability, enum and relationship target.',
    universeDefinition:'All current JOB_FIELDS, STAGE_FIELDS, RECORD_SCHEMAS.fieldDefinitions and the closed metadata receipt objects in DURABLE_OBJECT_REGISTRY.commandReceipts; independent of the FIELD_REGISTRY entries being checked.',
    includedIds:expectedKeys,excludedIds:[],numerator:declarations.length,denominator:expectedKeys.length,
    partitions:Object.fromEntries(['JOB.','STAGE.','RECORD.','NESTED.'].map(prefix=>[prefix,expectedKeys.filter(key=>key.startsWith(prefix)).length])),
    scope:'Declared-field registry completeness and binding only. This does not establish every specification field, nested-object contract, operation behavior, browser acceptance or physical-device acceptance.',
    result:'PASS'
  }};
}

const source=fs.readFileSync('workflow-schema.js','utf8');
const result=verify(source);
// The literal source table is checked separately from the declaration-derived
// registry consistency tests. Run its coherent mutation controls once.
const specificationJobFields=verifySpecifiedJobFieldRegistry(loadSchema(source));
const specificationJobFieldMutants=verifySpecifiedJobFieldMutants(loadSchema(source));
const specificationCarrierFields=verifySpecifiedCarrierFieldRegistry(loadSchema(source));
const specificationCarrierFieldMutants=verifySpecifiedCarrierFieldMutants(loadSchema(source));
const conditionalDeferredManifestCarrier=verifyConditionalDeferredManifestCarrier(loadSchema(source));
const recoverySourceReferenceCarrier=verifyRecoverySourceReferenceCarrier(loadSchema(source));
const backupImportStagingCarrier=verifyBackupImportStagingCarrier(loadSchema(source));
const responseStagingRecoveryCarriers=verifyResponseStagingRecoveryCarriers(loadSchema(source));
const jobPointerTargets=verifyJobPointerTargets(loadSchema(source));
const mobileAcceptanceSessionCarriers=verifyMobileAcceptanceSessionCarriers(loadSchema(source));
const mobileAcceptanceSessionMerge=verifyMobileAcceptanceSessionMergeContract(loadSchema(source));
const artifactByteReferenceCarrier=verifyArtifactByteReferenceCarrier(loadSchema(source));
assert.throws(()=>verify(source.replace("30:['baselineId','productId','productVersion','deliveryCandidateSetId','releaseId','hashReviewId','evidenceChainVersion']","30:['baselineId','productId']")),/deepStrictEqual|Expected values to be strictly deep-equal/,'Mutation removing terminal scope dimensions must fail.');
assert.throws(()=>verify(source.replace("addRequiredFamily('humanDecisions'","addRequiredFamily('humanDecisionBROKEN'")),/humanDecisions must be a canonical family/,'Mutation removing humanDecisions must fail.');
assert.throws(()=>verify(source.replace("const normalizerId=key=>{if(!key)return NO_NORMALIZER_ID;","const normalizerId=key=>{if(!key)return 'closed-loop-normalizer/missing/1';")),/undefined normalizer/,'Undefined normalizer mutation must fail.');
assert.throws(()=>verify(source.replace("if(!key)return NO_DERIVATION_ID;","if(!key)return 'closed-loop-derivation/missing/1';")),/undefined derivation/,'Undefined derivation mutation must fail.');
assert.throws(()=>verify(source.replace("mappingAuthority:'ATTACHMENT_SLOT_ID'","mappingAuthority:'FILENAME'")),/Expected values to be strictly equal|ATTACHMENT_SLOT_ID/,'Filename-authoritative attachment mapping mutation must fail.');
assert.throws(()=>verify(source.replace("minimumIdentityAssurance:'SELF_ASSERTED'","minimumIdentityAssurance:'AUTHENTICATED'")),/Current baseline authority must permit/,'Identity-assurance minimum mutation must fail.');
// Specification 14.5: every declared field occurs exactly once in the closed
// registry. Removing an entry cannot shrink the verifier's expected universe.
const registryFaults=[];
for(const prefix of ['JOB.','STAGE.','RECORD.','NESTED.'])for(const [fault,mutation,oracle] of [
  ['missing','delete entries[key];','FIELD_REGISTRY_UNIVERSE_ORACLE'],
  ['undeclared',"entries[key+'.UNREGISTERED_FIELD']=entries[key];",'FIELD_REGISTRY_UNIVERSE_ORACLE'],
  ['aliased-path',"entries[key]={...entries[key],path:entries[Object.keys(entries).find(other=>other!==key)].path};",'FIELD_REGISTRY_BINDING_ORACLE'],
  ['wrong-producer',"entries[key]={...entries[key],producer:entries[key].producer==='APPLICATION'?'AGENT':'APPLICATION'};",'FIELD_REGISTRY_BINDING_ORACLE'],
  ['wrong-type',"entries[key]={...entries[key],valueType:entries[key].valueType==='BOOLEAN'?'STRING':'BOOLEAN'};",'FIELD_REGISTRY_BINDING_ORACLE'],
  ['wrong-nullability','entries[key]={...entries[key],nullable:!entries[key].nullable};','FIELD_REGISTRY_BINDING_ORACLE'],
  ['wrong-enum',"entries[key]={...entries[key],enumValues:[...entries[key].enumValues,'UNREGISTERED_ENUM_VALUE']};",'FIELD_REGISTRY_BINDING_ORACLE'],
  ...(['RECORD.','NESTED.'].includes(prefix)?[['wrong-relationship',"entries[key]={...entries[key],relationshipTarget:entries[key].relationshipTarget?'unregisteredFamily':'requirements'};",'FIELD_REGISTRY_BINDING_ORACLE']]:[])
]){
  const faultSource=source+`\n;(()=>{const s=globalThis.closedLoopWorkflowSchema,entries={...s.FIELD_REGISTRY};const key=Object.keys(entries).find(key=>key.startsWith(${JSON.stringify(prefix)}));if(!key)throw new Error('Registry fault target missing');${mutation}globalThis.closedLoopWorkflowSchema=Object.freeze({...s,FIELD_REGISTRY:Object.freeze(entries)});})();`;
  let rejected=null;
  try{verify(faultSource);}catch(error){rejected=error;}
  assert.ok(rejected?.message.startsWith(oracle),'FIELD_REGISTRY_FAULT_DETECTION_ORACLE: '+fault+' '+prefix+' must fail for its intended invariant; actual '+(rejected?.message||'PASS'));
  registryFaults.push({fault:fault+'-'+prefix,oracle,result:'DETECTED',diagnostic:rejected.message});
}
const receiptContractFaults=[];
for(const [operation,names]of [['DELETE_PROJECT',['receipt']],['CLONE',['receipt','mappingManifest','fileMapping']]])for(const name of names)for(const property of ['identity','producerPartitions','scope','scopeDimensions','relationships','hashInclusion','lifecyclePolicy','migrationBehavior','gateUse','invalidationOwner','persistencePolicy']){
  const faultSource=source+`\n;(()=>{const s=globalThis.closedLoopWorkflowSchema,d=s.DURABLE_OBJECT_REGISTRY,family=d.commandReceipts,variants=family.metadataVariants,variant=variants[${JSON.stringify(operation)}],object={...variant.objects[${JSON.stringify(name)}]};delete object[${JSON.stringify(property)}];globalThis.closedLoopWorkflowSchema=Object.freeze({...s,DURABLE_OBJECT_REGISTRY:Object.freeze({...d,commandReceipts:Object.freeze({...family,metadataVariants:Object.freeze({...variants,[${JSON.stringify(operation)}]:Object.freeze({...variant,objects:Object.freeze({...variant.objects,[${JSON.stringify(name)}]:Object.freeze(object)})})})})})});})();`;
  let rejected=null;try{verify(faultSource);}catch(error){rejected=error;}
  assert.ok(rejected?.message.startsWith('COMMAND_RECEIPT_REGISTRY_ORACLE'),'COMMAND_RECEIPT_CONTRACT_FAULT_ORACLE: '+operation+'.'+name+' missing '+property+' must fail its intended contract.');
  receiptContractFaults.push({operation,object:name,missingProperty:property,result:'DETECTED',diagnostic:rejected.message});
}
const timingContractFaults=[];
for(const field of ['VERIFICATION_PHASE','EARLIEST_EXECUTABLE_STAGE','REQUIRED_BY_STAGE','PER_RUN_REQUIRED','FINAL_PRODUCT_REQUIRED','DELIVERY_REQUIRED','TARGET_AVAILABILITY_CONDITION'])for(const fault of ['missing','wrong-producer','wrong-type']){
  const mutation=fault==='missing'?`delete fields[${JSON.stringify(field)}];`:fault==='wrong-producer'?`fields[${JSON.stringify(field)}]={...fields[${JSON.stringify(field)}],producer:'AGENT'};`:field==='VERIFICATION_PHASE'?`fields[${JSON.stringify(field)}]={...fields[${JSON.stringify(field)}],enumValues:['UNREGISTERED_PHASE']};`:`fields[${JSON.stringify(field)}]={...fields[${JSON.stringify(field)}],valueType:'STRING'};`;
  const faultSource=source+`\n;(()=>{const s=globalThis.closedLoopWorkflowSchema,contract=s.TIMING_CONTRACTS,record=contract.objects.entry,fields={...record.fieldDefinitions};${mutation}globalThis.closedLoopWorkflowSchema=Object.freeze({...s,TIMING_CONTRACTS:Object.freeze({...contract,objects:Object.freeze({...contract.objects,entry:Object.freeze({...record,fieldDefinitions:Object.freeze(fields)})})})});})();`;
  let rejected=null;try{verify(faultSource);}catch(error){rejected=error;}
  assert.ok(rejected?.message.startsWith('TIMING_FIELD_DECLARATION_ORACLE'),`Timing declaration fault ${field}/${fault} must fail its intended invariant; actual ${rejected?.message||'PASS'}.`);
  timingContractFaults.push({field,fault,oracle:'TIMING_FIELD_DECLARATION_ORACLE',result:'DETECTED',diagnostic:rejected.message});
}
// A declaration and its registry projection can agree while both violate an
// explicit specification enum. These faults preserve that agreement.
const timingEnumContractFaults=[];
for(const [field,omittedValue] of [['SOURCE_KIND','PROOF_OBLIGATION'],['VERIFICATION_PHASE','TERMINAL_DELIVERY']]){
  const faultSource=source+`\n;(()=>{const s=globalThis.closedLoopWorkflowSchema,c=s.TIMING_CONTRACTS,drop=d=>Object.freeze({...d,enumValues:Object.freeze(d.enumValues.filter(value=>value!==${JSON.stringify(omittedValue)}))}),objects={...c.objects},entries={...s.FIELD_REGISTRY};for(const [name,object]of Object.entries(objects))if(object.fieldDefinitions[${JSON.stringify(field)}])objects[name]=Object.freeze({...object,fieldDefinitions:Object.freeze({...object.fieldDefinitions,[${JSON.stringify(field)}]:drop(object.fieldDefinitions[${JSON.stringify(field)}])})});for(const key of Object.keys(entries))if(key.endsWith('.'+${JSON.stringify(field)}))entries[key]=drop(entries[key]);const updates={TIMING_CONTRACTS:Object.freeze({...c,objects:Object.freeze(objects)}),FIELD_REGISTRY:Object.freeze(entries)};if(${JSON.stringify(field)}==='VERIFICATION_PHASE'){updates.VERIFICATION_PHASE_VALUES=Object.freeze(s.VERIFICATION_PHASE_VALUES.filter(value=>value!==${JSON.stringify(omittedValue)}));const records={...s.RECORD_SCHEMAS};for(const family of ['tests','regressions','failureTests']){const r=records[family];records[family]=Object.freeze({...r,fieldDefinitions:Object.freeze({...r.fieldDefinitions,VERIFICATION_PHASE:drop(r.fieldDefinitions.VERIFICATION_PHASE)})});}updates.RECORD_SCHEMAS=Object.freeze(records);}globalThis.closedLoopWorkflowSchema=Object.freeze({...s,...updates});})();`;
  const changed=loadSchema(faultSource);
  for(const object of Object.values(changed.TIMING_CONTRACTS.objects)){const d=object.fieldDefinitions[field];if(d)assert.deepEqual([...changed.FIELD_REGISTRY[d.registryKey].enumValues],[...d.enumValues],'TIMING_ENUM_FAULT_COHERENCE_ORACLE: nested declaration and registry must agree before the specification fault is tested.');}
  for(const [family,record]of Object.entries(changed.RECORD_SCHEMAS)){const d=record.fieldDefinitions[field];if(d)assert.deepEqual([...changed.FIELD_REGISTRY['RECORD.'+family+'.'+field].enumValues],[...d.enumValues],'TIMING_ENUM_FAULT_COHERENCE_ORACLE: record declaration and registry must agree before the specification fault is tested.');}
  let rejected=null;try{verify(faultSource);}catch(error){rejected=error;}
  assert.ok(rejected?.message.startsWith('TIMING_FIELD_DECLARATION_ORACLE'),`TIMING_ENUM_CLOSURE_FAULT_ORACLE: consistent ${field} omission must fail the independent specification vocabulary oracle; actual ${rejected?.message||'PASS'}.`);
  timingEnumContractFaults.push({field,omittedValue,declarationAndRegistryAgree:true,oracle:'TIMING_FIELD_DECLARATION_ORACLE',result:'DETECTED',diagnostic:rejected.message});
}
assert.equal(fs.readFileSync('workflow-schema.js','utf8'),source,'FIELD_REGISTRY_SOURCE_UNCHANGED_ORACLE');
const restored=verify(source);
assert.deepEqual(restored,result,'FIELD_REGISTRY_RESTORED_ORACLE');
console.log(JSON.stringify({...result,specificationJobFields,specificationJobFieldMutants,specificationCarrierFields,specificationCarrierFieldMutants,conditionalDeferredManifestCarrier,recoverySourceReferenceCarrier,backupImportStagingCarrier,responseStagingRecoveryCarriers,jobPointerTargets,mobileAcceptanceSessionCarriers,mobileAcceptanceSessionMerge,artifactByteReferenceCarrier,registryFaults,receiptContractFaults,timingContractFaults,timingEnumContractFaults,sourceSha256:createHash('sha256').update(source).digest('hex'),sourceRestored:true,restored:'PASS'}));

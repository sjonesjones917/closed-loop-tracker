import assert from 'node:assert/strict';

// Independent literals transcribed from the controlling Section15 table.
// They are deliberately not generated from JOB_FIELDS or FIELD_REGISTRY.
// Tuple: name, producer, value type, nullable, editable, required stage.
export const SPECIFICATION_JOB_FIELDS=Object.freeze([
 Object.freeze(["JOB_TITLE","HUMAN_DECISION","STRING",true,true,null]),
 Object.freeze(["JOB_OWNER","HUMAN_DECISION","STRING",true,true,null]),
 Object.freeze(["EXACT_USER_OBJECTIVE_VERBATIM","HUMAN","STRING",false,true,1]),
 Object.freeze(["SUPPLIED_MATERIALS_INVENTORY","HUMAN","STRING",true,true,null]),
 Object.freeze(["REQUIRED_OUTPUT_FORMAT","HUMAN","STRING",true,true,null]),
 Object.freeze(["DEADLINE_OR_TEMPORAL_SCOPE","HUMAN","STRING",true,true,null]),
 Object.freeze(["DESIRED_SOURCE_COUNT","HUMAN","INTEGER",true,true,null]),
 Object.freeze(["KNOWN_AUTHORITATIVE_SOURCES","HUMAN","STRING",true,true,null]),
 Object.freeze(["AVAILABLE_TOOLS","HUMAN","STRING",true,true,null]),
 Object.freeze(["PROHIBITED_ACTIONS","HUMAN","STRING",true,true,null]),
 Object.freeze(["EXPLICIT_USER_REQUIREMENTS","HUMAN","STRING",true,true,null]),
 Object.freeze(["JOB_ID","APPLICATION","STRING",false,false,null]),
 Object.freeze(["CONTRACT_PROFILE_ID","APPLICATION","STRING",false,false,null]),
 Object.freeze(["DATE_OPENED","APPLICATION","STRING",false,false,null]),
 Object.freeze(["CURRENT_ITERATION","APPLICATION","STRING",true,false,null]),
 Object.freeze(["CURRENT_STAGE","APPLICATION","STRING",false,false,null]),
 Object.freeze(["CURRENT_STATE","APPLICATION","STRING",false,false,null]),
 Object.freeze(["CURRENT_INPUT_VERSION","APPLICATION","STRING",false,false,null]),
 Object.freeze(["CURRENT_SOURCE_SET_VERSION","APPLICATION","STRING",true,false,null]),
 Object.freeze(["CURRENT_RESEARCH_VERSION","APPLICATION","STRING",true,false,null]),
 Object.freeze(["CURRENT_REQUIREMENTS_VERSION","APPLICATION","STRING",true,false,null]),
 Object.freeze(["CURRENT_TEST_SUITE_VERSION","APPLICATION","STRING",true,false,null]),
 Object.freeze(["CURRENT_INSTRUCTION_VERSION","APPLICATION","STRING",true,false,null]),
 Object.freeze(["CURRENT_CANDIDATE_ID","APPLICATION","STRING",true,false,null]),
 Object.freeze(["CURRENT_BASELINE_ID","APPLICATION","STRING",true,false,null]),
 Object.freeze(["CURRENT_PRODUCT_ID","APPLICATION","STRING",true,false,null]),
 Object.freeze(["CURRENT_PRODUCT_VERSION","APPLICATION","STRING",true,false,null]),
 Object.freeze(["CURRENT_DELIVERY_CANDIDATE_SET_ID","APPLICATION","STRING",true,false,null]),
 Object.freeze(["CURRENT_REVIEW_VERSION","APPLICATION","STRING",true,false,null]),
 Object.freeze(["CURRENT_RECONCILED_REVIEW_VERSION","APPLICATION","STRING",true,false,null]),
 Object.freeze(["CURRENT_RELEASE_ID","APPLICATION","STRING",true,false,null]),
 Object.freeze(["CURRENT_HASH_REVIEW_ID","APPLICATION","STRING",true,false,null]),
 Object.freeze(["CURRENT_EVIDENCE_CHAIN_VERSION","APPLICATION","STRING",true,false,null]),
 Object.freeze(["CURRENT_DELIVERY_ID","APPLICATION","STRING",true,false,null]),
 Object.freeze(["CURRENT_BLOCKERS","APPLICATION","STRUCTURED_JSON",false,false,null]),
 Object.freeze(["NEXT_REQUIRED_ACTION","APPLICATION","OBJECT",false,false,null]),
 Object.freeze(["LATEST_EVIDENCE_REFERENCE","APPLICATION","STRING",true,false,null]),
 Object.freeze(["INPUT_SET_HASH_OR_MANIFEST","APPLICATION","STRING",false,false,null]),
 Object.freeze(["JOB_RECORD_STATUS","APPLICATION","STRING",false,false,null]),
 Object.freeze(["STATUS_EVIDENCE","APPLICATION","STRING",false,false,null]),
 Object.freeze(["EXACT_DELIVERABLE_REQUESTED","AGENT","STRING",false,false,1]),
 Object.freeze(["ASSUMPTIONS","AGENT","STRING",false,false,1]),
 Object.freeze(["UNKNOWN_INFORMATION","AGENT","STRING",false,false,1]),
 Object.freeze(["INPUT_SET_CONTENTS","AGENT","STRING",false,false,1])
]);
const CURRENT_STATES=Object.freeze(['BLOCKED','AWAITING_HUMAN_INPUT','PROPOSAL_PENDING_REVIEW','RESPONSE_STAGED','AWAITING_EXTERNAL_RESPONSE','READY_FOR_NEXT_OPERATION','WORKFLOW_COMPLETE']);
const JOB_STATUSES=Object.freeze(['INCOMPLETE','BLOCKED','COMPLETE']);
const JOB_ENUMS=Object.freeze({CURRENT_STATE:CURRENT_STATES,JOB_RECORD_STATUS:JOB_STATUSES,CONTRACT_PROFILE_ID:Object.freeze(['closed-loop-completion-profile/1'])});
// Section15 intentionally says 'Structured value' for CURRENT_BLOCKERS. This
// oracle checks that declared abstraction; it does not prescribe a new model.
const STRUCTURED_JSON_TYPES=Object.freeze(['OBJECT','OBJECT_ARRAY','STRING_ARRAY','REFERENCE_ARRAY','JSON']);
export const REQUIRED_REGISTRY_ATTRIBUTES=Object.freeze(['path','producer','valueType','enumValues','nullable','cardinality','requiredAtStage','requiredness','writableOperation','classification','relationshipTarget','relationshipDirection','scope','scopeDimensions','migrationRule','invalidationOwner','normalizerIdentity','derivationIdentity']);
const plain=value=>JSON.parse(JSON.stringify(value));
// These are the source-named fields, not an enumeration of whichever fields
// production happens to register. The owning contract may declare additional
// non-envelope fields, but cannot omit one of these source obligations.
export const SPECIFICATION_CARRIER_FIELDS=Object.freeze({
 responseEnvelope:Object.freeze(['schema','contractProfileId','jobId','stage','operation','promptIdentity','packageId','operationReservationId','challengeNonce','scope','responseType','humanInputRequests','humanAuthorityCandidates','stageData','records','evidence','unresolved','warnings','attachments']),
 promptIdentity:Object.freeze(['instructionId','bodySha256','contractSha256','contextSignature']),
 handoff:Object.freeze(['filesToSend','recordsToSend','filesToWithhold','instruction','expectedReturnFiles','expectedStructuredResponse','requiredEvidenceDescription','promptArtifactId','promptFilename','promptByteLength','promptSha256','packageId','operationReservationId','challengeNonce','containerContractVersion','attachmentSlots','externalActionRiskClasses','authorizationIds','disclosureAuthorizationIds']),
 attachmentSlot:Object.freeze(['attachmentSlotId','packageId','operationReservationId','jobId','stage','operation','purpose','role','required','allowedMediaTypes','filenameRule','maximumSize','expectedDigest']),
 runtimeResult:Object.freeze(['testId','testSpecVersion','testSpecSha256','status','expected','actual','observations','evidence','executorVersion','inputArtifactIds','inputArtifactSha256Values','startedAtDeviceTime','endedAtDeviceTime']),
 executionPlanItem:Object.freeze(['testId','requirementId','executionMode','requiredCapability','executorClass','executionRoute','executableNow','capabilityReady','artifactReady','blockingReason','requiredArtifactIds','requiredArtifactNames','operatorAction','returnRequirements'])
});
const SPECIFICATION_EXECUTION_ROUTES=Object.freeze(['APPLICATION','INDEPENDENT_AI','EXTERNAL_AGENT_TOOL','HUMAN','EXTERNAL_SYSTEM','BLOCKED']);
export function verifySpecifiedCarrierFieldRegistry(schema){
 const contracts=schema.CARRIER_FIELD_CONTRACTS?.objects;
 assert(contracts&&typeof contracts==='object','SPECIFICATION_CARRIER_REGISTRY_OMISSION_ORACLE: authoritative carrier contracts are absent.');
 const observations=[];
 for(const [name,requiredFields]of Object.entries(SPECIFICATION_CARRIER_FIELDS)){
  const object=contracts[name];
  assert(object&&typeof object==='object','SPECIFICATION_CARRIER_REGISTRY_OMISSION_ORACLE: '+name);
  assert(Array.isArray(object.closedFields),'SPECIFICATION_CARRIER_CLOSED_FIELDS_ORACLE: '+name);
  assert.deepEqual([...object.closedFields].sort(),Object.keys(object.fieldDefinitions||{}).sort(),'SPECIFICATION_CARRIER_CLOSED_FIELDS_ORACLE: '+name);
  assert.equal(new Set(object.closedFields).size,object.closedFields.length,'SPECIFICATION_CARRIER_CLOSED_FIELDS_ORACLE: '+name);
  if(['responseEnvelope','promptIdentity'].includes(name))assert.deepEqual([...object.closedFields].sort(),[...requiredFields].sort(),'SPECIFICATION_CARRIER_SOURCE_UNIVERSE_ORACLE: '+name);
  for(const field of requiredFields){
   const definition=object.fieldDefinitions[field];
   assert(definition,'SPECIFICATION_CARRIER_REGISTRY_OMISSION_ORACLE: '+name+'.'+field);
   assert(typeof definition.registryKey==='string'&&definition.registryKey,'SPECIFICATION_CARRIER_FIELD_IDENTITY_ORACLE: '+name+'.'+field);
   const entry=schema.FIELD_REGISTRY[definition.registryKey];requireAttributes(entry,definition.registryKey);
   assert.equal(entry.path,object.path+'/'+field,'SPECIFICATION_CARRIER_FIELD_PATH_ORACLE: '+name+'.'+field);
   for(const property of ['producer','valueType','nullable'])assert.equal(entry[property],definition[property],'SPECIFICATION_CARRIER_PROJECTION_ORACLE: '+name+'.'+field+'.'+property);
   assert.deepEqual(plain(entry.enumValues),plain(definition.enumValues||[]),'SPECIFICATION_CARRIER_PROJECTION_ORACLE: '+name+'.'+field+'.enumValues');
   const claims=['responseType','humanInputRequests','humanAuthorityCandidates','stageData','records','evidence','unresolved','warnings','attachments'];
   const producer=name==='responseEnvelope'&&claims.includes(field)?'AGENT':'APPLICATION';
   assert.equal(entry.producer,producer,'SPECIFICATION_CARRIER_PRODUCER_ORACLE: '+name+'.'+field);
   if(name==='executionPlanItem'&&field==='executionRoute')assert.deepEqual([...entry.enumValues].sort(),[...SPECIFICATION_EXECUTION_ROUTES].sort(),'SPECIFICATION_CARRIER_ROUTE_ENUM_ORACLE');
   assert(Object.hasOwn(schema.normalizerRegistry.entries,entry.normalizerIdentity),'SPECIFICATION_CARRIER_NORMALIZER_ORACLE: '+name+'.'+field);
   assert(Object.hasOwn(schema.derivationRegistry.entries,entry.derivationIdentity),'SPECIFICATION_CARRIER_DERIVATION_ORACLE: '+name+'.'+field);
   observations.push({object:name,field,registryKey:definition.registryKey,producer,passed:true});
  }
 }
 return {checkId:'registry.specification-carrier-fields',observations,passed:true,scopeLimit:'Finite source-named carrier declaration membership, owner partition and registry projection. runtimeResult covers Section22.3 only; additional path-specific Section22.6 identities remain separate. Does not establish generated package bytes, actor authority, canonical admission or complete Section14.5 closure.'};
}
export function verifySpecifiedCarrierFieldMutants(schema){
 verifySpecifiedCarrierFieldRegistry(schema);
 const cases=[];
 const changedObject=(name,object,entries=schema.FIELD_REGISTRY)=>({...schema,CARRIER_FIELD_CONTRACTS:{...schema.CARRIER_FIELD_CONTRACTS,objects:{...schema.CARRIER_FIELD_CONTRACTS.objects,[name]:object}},FIELD_REGISTRY:entries});
 for(const [name,fields]of Object.entries(SPECIFICATION_CARRIER_FIELDS)){
  const object=schema.CARRIER_FIELD_CONTRACTS.objects[name];
  for(const field of fields){
   const definition=object.fieldDefinitions[field],key=definition.registryKey;
   const definitions={...object.fieldDefinitions},entries={...schema.FIELD_REGISTRY};delete definitions[field];delete entries[key];
   const removed=changedObject(name,{...object,closedFields:object.closedFields.filter(value=>value!==field),fieldDefinitions:definitions},entries);
   assert.throws(()=>verifySpecifiedCarrierFieldRegistry(removed),/SPECIFICATION_CARRIER_(SOURCE_UNIVERSE|REGISTRY_OMISSION)_ORACLE/,'SPECIFICATION_CARRIER_MUTANT_ORACLE: coherent omission '+name+'.'+field);
   cases.push({object:name,field,fault:'coherent-declaration-and-registry-omission',detected:true});
   const producer=definition.producer==='APPLICATION'?'AGENT':'APPLICATION',changed=changedObject(name,{...object,fieldDefinitions:{...object.fieldDefinitions,[field]:{...definition,producer}}},{...schema.FIELD_REGISTRY,[key]:{...schema.FIELD_REGISTRY[key],producer}});
   assert.throws(()=>verifySpecifiedCarrierFieldRegistry(changed),/SPECIFICATION_CARRIER_PRODUCER_ORACLE/,'SPECIFICATION_CARRIER_MUTANT_ORACLE: coherent owner change '+name+'.'+field);
   cases.push({object:name,field,fault:'coherent-declaration-and-registry-producer',detected:true});
  }
  const absent=changedObject(name,undefined);
  assert.throws(()=>verifySpecifiedCarrierFieldRegistry(absent),/SPECIFICATION_CARRIER_REGISTRY_OMISSION_ORACLE/);cases.push({object:name,fault:'missing-object',detected:true});
  const key=object.fieldDefinitions[fields[0]].registryKey;
  for(const property of REQUIRED_REGISTRY_ATTRIBUTES){
   const entry={...schema.FIELD_REGISTRY[key]};delete entry[property];
   assert.throws(()=>verifySpecifiedCarrierFieldRegistry(changedObject(name,object,{...schema.FIELD_REGISTRY,[key]:entry})),/SPECIFICATION_FIELD_REGISTRY_ATTRIBUTE_ORACLE/,'SPECIFICATION_CARRIER_MUTANT_ORACLE: '+name+'.'+property);
   cases.push({object:name,field:fields[0],fault:'missing-registry-attribute',property,detected:true});
  }
 }
 const object=schema.CARRIER_FIELD_CONTRACTS.objects.executionPlanItem,definition=object.fieldDefinitions.executionRoute,key=definition.registryKey;
 for(const [fault,enumValues]of [['missing-BLOCKED',definition.enumValues.filter(value=>value!=='BLOCKED')],['unregistered-route',[...definition.enumValues,'EXTERNAL_AGENT']]]){
  const changed=changedObject('executionPlanItem',{...object,fieldDefinitions:{...object.fieldDefinitions,executionRoute:{...definition,enumValues}}},{...schema.FIELD_REGISTRY,[key]:{...schema.FIELD_REGISTRY[key],enumValues}});
  assert.throws(()=>verifySpecifiedCarrierFieldRegistry(changed),/SPECIFICATION_CARRIER_ROUTE_ENUM_ORACLE/);cases.push({object:'executionPlanItem',field:'executionRoute',fault,detected:true});
 }
 return {checkId:'registry.specification-carrier-mutants',negativeCases:cases.length,cases,restored:verifySpecifiedCarrierFieldRegistry(schema).passed,passed:true,scopeLimit:'Coherent source-field/owner omissions, required registry attributes and literal route vocabulary. No generated package, canonical mutation or external execution is simulated by these declaration mutants.'};
}
function requireAttributes(entry,key){
 assert(entry&&typeof entry==='object'&&!Array.isArray(entry),'SPECIFICATION_FIELD_REGISTRY_MEMBER_ORACLE: '+key);
 for(const property of REQUIRED_REGISTRY_ATTRIBUTES)assert(Object.hasOwn(entry,property),'SPECIFICATION_FIELD_REGISTRY_ATTRIBUTE_ORACLE: '+key+'.'+property);
 for(const property of ['path','producer','valueType','cardinality','requiredness','classification','scope','migrationRule','invalidationOwner','normalizerIdentity','derivationIdentity'])assert(typeof entry[property]==='string'&&entry[property].length>0,'SPECIFICATION_FIELD_REGISTRY_ATTRIBUTE_TYPE_ORACLE: '+key+'.'+property);
 assert.equal(typeof entry.nullable,'boolean','SPECIFICATION_FIELD_REGISTRY_ATTRIBUTE_TYPE_ORACLE: '+key+'.nullable');
 for(const property of ['enumValues','scopeDimensions'])assert(Array.isArray(entry[property])&&entry[property].every(value=>typeof value==='string'),'SPECIFICATION_FIELD_REGISTRY_ATTRIBUTE_TYPE_ORACLE: '+key+'.'+property);
}
export function verifySpecifiedJobFieldRegistry(schema){
 const names=SPECIFICATION_JOB_FIELDS.map(row=>row[0]).sort(),actual=Object.keys(schema.JOB_FIELDS).sort();
 assert.deepEqual(actual,names,'SPECIFICATION_JOB_UNIVERSE_ORACLE');
 assert.deepEqual(Object.keys(schema.FIELD_REGISTRY).filter(key=>key.startsWith('JOB.')).sort(),names.map(name=>'JOB.'+name).sort(),'SPECIFICATION_JOB_REGISTRY_UNIVERSE_ORACLE');
 const observations=[];
 for(const [name,producer,valueType,nullable,editable,requiredAtStage]of SPECIFICATION_JOB_FIELDS){
  const key='JOB.'+name,entry=schema.FIELD_REGISTRY[key],definition=schema.JOB_FIELDS[name];requireAttributes(entry,key);
  for(const [subject,value]of [['definition',definition],['registry',entry]]){
   assert.equal(value.producer,producer,'SPECIFICATION_JOB_PRODUCER_ORACLE: '+subject+' '+name);
   if(valueType==='STRUCTURED_JSON')assert(STRUCTURED_JSON_TYPES.includes(value.valueType),'SPECIFICATION_JOB_TYPE_ORACLE: '+subject+' '+name);
   else assert.equal(value.valueType,valueType,'SPECIFICATION_JOB_TYPE_ORACLE: '+subject+' '+name);
   assert.equal(value.nullable,nullable,'SPECIFICATION_JOB_NULLABILITY_ORACLE: '+subject+' '+name);
   assert.equal(value.requiredAtStage,requiredAtStage,'SPECIFICATION_JOB_REQUIREDNESS_ORACLE: '+subject+' '+name);
   assert.deepEqual(plain(value.enumValues),JOB_ENUMS[name]||[],'SPECIFICATION_JOB_ENUM_ORACLE: '+subject+' '+name);
  }
  assert.equal(definition.editable,editable,'SPECIFICATION_JOB_EDITABILITY_ORACLE: '+name);
  assert.equal(entry.path,'/job/'+name,'SPECIFICATION_JOB_PATH_ORACLE: '+name);
  assert.equal(entry.cardinality,'ONE','SPECIFICATION_JOB_CARDINALITY_ORACLE: '+name);
  observations.push({field:name,registryKey:key,producer,valueType:entry.valueType,nullable,editable,requiredAtStage,passed:true});
 }
 return {checkId:'registry.specification-job-field-table',expectedFieldNames:names,observations,passed:true,scopeLimit:'All44 literal Section15 field declaration tuples and their registry projections. Does not establish every writer, required-stage transition, value derivation, persistence or authority provenance.'};
}
export function verifySpecifiedJobFieldMutants(schema){
 const cases=[];
 for(const [name]of SPECIFICATION_JOB_FIELDS)for(const [property,replacement,oracle]of [
  ['producer','UNREGISTERED_PRODUCER','SPECIFICATION_JOB_PRODUCER_ORACLE'],
  ['valueType','UNREGISTERED_TYPE','SPECIFICATION_JOB_TYPE_ORACLE'],
  ['nullable',!schema.JOB_FIELDS[name].nullable,'SPECIFICATION_JOB_NULLABILITY_ORACLE'],
  ['requiredAtStage',schema.JOB_FIELDS[name].requiredAtStage===1?null:1,'SPECIFICATION_JOB_REQUIREDNESS_ORACLE'],
  ['enumValues',['UNREGISTERED_ENUM'],'SPECIFICATION_JOB_ENUM_ORACLE']
 ]){
  // Alter both declarations coherently. Comparing two projections generated
  // from the same wrong value must not satisfy the specification oracle.
  const changed={...schema,JOB_FIELDS:{...schema.JOB_FIELDS,[name]:{...schema.JOB_FIELDS[name],[property]:replacement}},FIELD_REGISTRY:{...schema.FIELD_REGISTRY,['JOB.'+name]:{...schema.FIELD_REGISTRY['JOB.'+name],[property]:replacement}}};
  assert.throws(()=>verifySpecifiedJobFieldRegistry(changed),error=>error.message.includes(oracle),'SPECIFICATION_JOB_MUTANT_ORACLE: '+name+'.'+property);
  cases.push({field:name,property,coherentDeclarationAndRegistryMutation:true,expectedOracle:oracle,detected:true});
 }
 for(const [name]of SPECIFICATION_JOB_FIELDS){
  const changed={...schema,JOB_FIELDS:{...schema.JOB_FIELDS,[name]:{...schema.JOB_FIELDS[name],editable:!schema.JOB_FIELDS[name].editable}}};
  assert.throws(()=>verifySpecifiedJobFieldRegistry(changed),/SPECIFICATION_JOB_EDITABILITY_ORACLE/);cases.push({field:name,property:'editable',expectedOracle:'SPECIFICATION_JOB_EDITABILITY_ORACLE',detected:true});
 }
 for(const kind of ['missing','extra']){
  const changed={...schema,JOB_FIELDS:{...schema.JOB_FIELDS},FIELD_REGISTRY:{...schema.FIELD_REGISTRY}};
  if(kind==='missing'){delete changed.JOB_FIELDS.JOB_ID;delete changed.FIELD_REGISTRY['JOB.JOB_ID'];}
  else{changed.JOB_FIELDS.UNREGISTERED_FIELD=schema.JOB_FIELDS.JOB_ID;changed.FIELD_REGISTRY['JOB.UNREGISTERED_FIELD']=schema.FIELD_REGISTRY['JOB.JOB_ID'];}
  assert.throws(()=>verifySpecifiedJobFieldRegistry(changed),/SPECIFICATION_JOB_UNIVERSE_ORACLE/);cases.push({property:kind+'-field',coherentDeclarationAndRegistryMutation:true,detected:true});
 }
 return {checkId:'registry.specification-job-field-mutants',negativeCases:cases.length,cases,restored:verifySpecifiedJobFieldRegistry(schema).passed,passed:true,scopeLimit:'Literal declaration/type/ownership mutation controls; no application-state mutation or runtime value enforcement claimed.'};
}

// The conditional receipt transport is an application-issued manifest carrier,
// not an ordinary response field. Section32.4A supplies these exact operation
// ranges; real emitted ZIP and echo validation remain separately verified.
export function verifyConditionalDeferredManifestCarrier(schema){
 const expectedKeys=[...Array.from({length:23},(_,i)=>(i+8)+':EXECUTE_FAILURE_TEST'),...Array.from({length:15},(_,i)=>(i+16)+':EXECUTE_REGRESSION')].sort();
 const actualKeys=Object.entries(schema.STAGE_OPERATION_REGISTRY).filter(([,row])=>row.deferredSubjectFamily).map(([key])=>key).sort();
 assert.deepEqual(actualKeys,expectedKeys,'CONDITIONAL_MANIFEST_OPERATION_UNIVERSE_ORACLE');
 const inspect=candidate=>{
  const object=candidate.CARRIER_FIELD_CONTRACTS.objects.deferredExecutionManifest;
  assert(object,'CONDITIONAL_MANIFEST_DECLARATION_ORACLE');
  assert.deepEqual([...object.closedFields],['deferredExecutionBinding'],'CONDITIONAL_MANIFEST_DECLARATION_ORACLE');
  const definition=object.fieldDefinitions.deferredExecutionBinding,entry=candidate.FIELD_REGISTRY[definition?.registryKey];
  assert(definition&&entry,'CONDITIONAL_MANIFEST_DECLARATION_ORACLE');requireAttributes(entry,definition.registryKey);
  assert.equal(entry.path,'/manifest/deferredExecutionBinding','CONDITIONAL_MANIFEST_DECLARATION_ORACLE');
  for(const value of [definition,entry]){assert.equal(value.valueType,'OBJECT','CONDITIONAL_MANIFEST_DECLARATION_ORACLE');assert.equal(value.producer,'APPLICATION','CONDITIONAL_MANIFEST_DECLARATION_ORACLE');assert.equal(value.nullable,false,'CONDITIONAL_MANIFEST_DECLARATION_ORACLE');}
  assert.equal(entry.requiredness,'CONDITIONAL_DEFERRED_EXECUTION_OPERATION','CONDITIONAL_MANIFEST_DECLARATION_ORACLE');
  return true;
 };
 inspect(schema);const object=schema.CARRIER_FIELD_CONTRACTS.objects.deferredExecutionManifest,definition=object.fieldDefinitions.deferredExecutionBinding,key=definition.registryKey,cases=[];
 for(const [fault,property,value]of [['wrong-type','valueType','STRING'],['wrong-owner','producer','AGENT'],['nullable','nullable',true],['wrong-path','path','/manifest/otherBinding'],['unconditional','requiredness','EVERY_AUTHORITATIVE_CARRIER']]){
  const changed={...schema,CARRIER_FIELD_CONTRACTS:{...schema.CARRIER_FIELD_CONTRACTS,objects:{...schema.CARRIER_FIELD_CONTRACTS.objects,deferredExecutionManifest:{...object,fieldDefinitions:{deferredExecutionBinding:{...definition,[property]:value}}}}},FIELD_REGISTRY:{...schema.FIELD_REGISTRY,[key]:{...schema.FIELD_REGISTRY[key],[property]:value}}};
  assert.throws(()=>inspect(changed),/CONDITIONAL_MANIFEST_DECLARATION_ORACLE/);cases.push(fault);
 }
 for(const fault of ['missing-object','missing-field']){const objects={...schema.CARRIER_FIELD_CONTRACTS.objects},entries={...schema.FIELD_REGISTRY};if(fault==='missing-object')delete objects.deferredExecutionManifest;else delete entries[key];assert.throws(()=>inspect({...schema,CARRIER_FIELD_CONTRACTS:{...schema.CARRIER_FIELD_CONTRACTS,objects},FIELD_REGISTRY:entries}),/CONDITIONAL_MANIFEST_DECLARATION_ORACLE/);cases.push(fault);}
 return {checkId:'registry.conditional-deferred-manifest',conditionalOperationKeys:expectedKeys,conditionalOperations:expectedKeys.length,ordinaryOperations:Object.keys(schema.STAGE_OPERATION_REGISTRY).length-expectedKeys.length,negativeCases:cases.length,cases,passed:inspect(schema),scopeLimit:'Conditional declaration applicability and literal type/authority/path projection only. Does not establish emitted ZIP binding, response echo, admission or workflow completion.'};
}

// Sections12.3/14.5 retain store ownership while requiring closed package
// carrier fields. These are byte-recovery metadata, never canonical authority.
export function verifyRecoverySourceReferenceCarrier(schema){
 const referenceFields=['schema','checkpointId','snapshotSha256','activation'],activationFields=['projectSha256','projectHash','revision','historyActivationId','restoredCandidates','activeView','activeStage'];
 const contract=schema.RECOVERY_SOURCE_REFERENCE_CONTRACT;
 assert(contract,'RECOVERY_SOURCE_CARRIER_REGISTRY_ORACLE');
 assert.equal(contract.schema,'closed-loop-recovery-source-reference/1');assert.equal(contract.operational,false);
 assert.deepEqual([...contract.referenceFields],referenceFields);assert.deepEqual([...contract.activationFields],activationFields);
 for(const [name,names]of [['recoverySourceReference',referenceFields],['recoverySourceActivation',activationFields],['recoverySourceReferenceMap',['sourceArchiveReferences']]]){
  const object=schema.CARRIER_FIELD_CONTRACTS.objects[name];assert(object,'RECOVERY_SOURCE_CARRIER_REGISTRY_ORACLE');assert.equal(object.owner,'project-store.js');assert.deepEqual([...object.closedFields],names);
  for(const key of names){const definition=object.fieldDefinitions[key],entry=schema.FIELD_REGISTRY[definition.registryKey];requireAttributes(entry,definition.registryKey);assert.equal(entry.producer,'APPLICATION');assert.equal(entry.path,object.path+'/'+key);assert.equal(entry.classification,'CARRIER');assert.equal(entry.scope,'EXACT_RETAINED_SOURCE_BYTES');assert.equal(entry.invalidationOwner,'project-store.js');assert.equal(entry.migrationRule,'PRESERVE_EXACT_SOURCE_REPRESENTATION_OR_RAW_BYTES');}
 }
 const valid={schema:'closed-loop-recovery-source-reference/1',checkpointId:'CHECKPOINT-SOURCE',snapshotSha256:'a'.repeat(64),activation:{revision:7,activeStage:1,restoredCandidates:{retained:['exact source value']},historyActivationId:null}},before=JSON.stringify(valid);
 assert.equal(schema.validateRecoverySourceReference(valid).valid,true);assert.equal(JSON.stringify(valid),before,'RECOVERY_SOURCE_REFERENCE_PRESERVATION_ORACLE');
 assert.equal(schema.validateRecoverySourceReference({...valid,activation:{}}).valid,true,'RECOVERY_SOURCE_OPTIONAL_ACTIVATION_ORACLE');
 const negatives=[null,[],{},...referenceFields.map(key=>{const value=structuredClone(valid);delete value[key];return value;}),{...valid,schema:'UNKNOWN'},{...valid,checkpointId:[]},{...valid,snapshotSha256:'A'.repeat(64)},{...valid,extra:true},{...valid,activation:null},{...valid,activation:[]},{...valid,activation:{job:{JOB_ID:'OTHER'}}}];
 for(const value of negatives){const before=JSON.stringify(value),result=schema.validateRecoverySourceReference(value);assert.equal(result.valid,false,'RECOVERY_SOURCE_REFERENCE_SHAPE_ORACLE');assert(result.issues.length);assert.equal(JSON.stringify(value),before);}
 const omitted={...schema,RECOVERY_SOURCE_REFERENCE_CONTRACT:undefined};assert.throws(()=>verifyRecoverySourceReferenceCarrier(omitted),/RECOVERY_SOURCE_CARRIER_REGISTRY_ORACLE/);
 return {passed:true,referenceFields,activationFields,registeredFields:12,invalidShapeCases:negatives.length,conformingControls:2,scopeLimit:'Carrier registry and closed shape only; exact source bytes, checkpoint integrity, import atomicity and capacity use production store tests.'};
}

export function verifyBackupImportStagingCarrier(schema){
 const fields=['schema','stagingId','jobId','rawFilename','mediaType','byteSize','sha256','createdAt'],contract=schema.BACKUP_IMPORT_STAGING_CONTRACT,object=schema.CARRIER_FIELD_CONTRACTS.objects.backupImportStaging;
 assert(contract&&object,'BACKUP_IMPORT_STAGING_CARRIER_ORACLE');assert.equal(contract.schema,'closed-loop-backup-import-staging/1');assert.equal(contract.operational,false);assert.deepEqual([...contract.fields],fields);assert.equal(object.owner,'project-store.js');assert.equal(object.persistencePolicy,'PENDING_METADATA_ONLY');
 for(const key of fields){const definition=object.fieldDefinitions[key],entry=schema.FIELD_REGISTRY[definition.registryKey];requireAttributes(entry,definition.registryKey);assert.equal(entry.producer,'APPLICATION');assert.equal(entry.path,'/metadata/backupImportStaging/*/'+key);assert.equal(entry.scope,'EXACT_SELECTED_BACKUP_BYTES');assert.equal(entry.classification,'CARRIER');}
 const retained=schema.CARRIER_FIELD_CONTRACTS.objects.retainedImportSelection,parent=schema.CARRIER_FIELD_CONTRACTS.objects.lastVerifiedImportSelection;assert(retained&&parent,'BACKUP_IMPORT_RECEIPT_CARRIER_ORACLE');assert.equal(retained.persistencePolicy,'IMPORT_RECEIPT_METADATA_ONLY');assert.deepEqual([...retained.closedFields],fields);assert.deepEqual([...parent.closedFields],['selectedBackupImport']);assert.equal(parent.fieldDefinitions.selectedBackupImport.objectContract,'retainedImportSelection');
 for(const key of fields){const {registryKey:pendingKey,...pending}=object.fieldDefinitions[key],{registryKey:retainedKey,...definition}=retained.fieldDefinitions[key];assert.notEqual(pendingKey,retainedKey);assert.deepEqual(definition,pending,'BACKUP_IMPORT_RECEIPT_SHARED_RULE_ORACLE');const entry=schema.FIELD_REGISTRY[retainedKey];assert.equal(Object.hasOwn(entry,'registryKey'),false,'BACKUP_IMPORT_RECEIPT_REGISTRY_ALIAS_ORACLE');assert.equal(entry.path,'/metadata/lastVerifiedImport/selectedBackupImport/'+key);assert.equal(entry.producer,'APPLICATION');assert.equal(entry.invalidationOwner,'project-store.js');}
 const valid={schema:'closed-loop-backup-import-staging/1',stagingId:'PENDING-BACKUP',jobId:'DISPLAYING-PROJECT',rawFilename:'Original raw name é.backup',mediaType:'application/gzip',byteSize:32,sha256:'a'.repeat(64),createdAt:'2026-10-06T00:00:00.000Z'},controls=[valid,{...valid,rawFilename:'',mediaType:'',byteSize:0,createdAt:'2026-10-06T01:00:00+01:00'}];
 for(const value of controls){const before=JSON.stringify(value);assert.equal(schema.validateBackupImportStaging(value).valid,true,'BACKUP_IMPORT_STAGING_VALID_ORACLE');assert.equal(JSON.stringify(value),before);}
 const negatives=[null,[],{},...fields.map(key=>{const value={...valid};delete value[key];return value;}),{...valid,stagingId:''},{...valid,jobId:[]},{...valid,rawFilename:null},{...valid,mediaType:3},{...valid,byteSize:-1},{...valid,byteSize:1.5},{...valid,byteSize:Number.MAX_SAFE_INTEGER+1},{...valid,sha256:'A'.repeat(64)},{...valid,schema:'UNREGISTERED'},{...valid,createdAt:'2026-02-30T00:00:00Z'},{...valid,createdAt:'2026-10-06'},{...valid,blob:'Not part of descriptor'}];
 for(const value of negatives){const before=JSON.stringify(value),result=schema.validateBackupImportStaging(value);assert.equal(result.valid,false,'BACKUP_IMPORT_STAGING_REJECTION_ORACLE');assert(result.issues.length);assert.equal(JSON.stringify(value),before);}
 assert.throws(()=>verifyBackupImportStagingCarrier({...schema,BACKUP_IMPORT_STAGING_CONTRACT:undefined}),/BACKUP_IMPORT_STAGING_CARRIER_ORACLE/);
 return {passed:true,registeredFields:fields.length*2+1,conformingControls:controls.length,invalidShapeCases:negatives.length,scopeLimit:'Pending/retained import metadata descriptor authority and shared shape only; real selected Blob identity, persistence, recovery, release and UI are store/operator tests.'};
}

export function verifyResponseStagingRecoveryCarriers(schema){
 const expected={responseStaging:['schema','stagingId','jobId','stage','rawFilename','mediaType','byteSize','sha256','promptIdentity','packageId','operationReservationId','challengeNonce','status','createdAt','rejection'],responseStagingRejection:['code','byteSize','maxRawResponseBytes','at'],responseStagingRetirement:['schema','jobId','stagingId','retiredAt'],responseStagingRecovery:['schema','jobId','stagingId','artifactId','kind','stage','rawFilename','sha256','byteSize','outcome','code','checkedAt','bytesRemoved','stagingOccurrenceRemoved']};
 const paths={responseStaging:'/metadata/responseStaging/*',responseStagingRejection:'/metadata/responseStaging/*/rejection',responseStagingRetirement:'/metadata/responseStagingRetired/*',responseStagingRecovery:'/metadata/responseStagingRecovery/*'};
 for(const [name,fields]of Object.entries(expected)){const object=schema.CARRIER_FIELD_CONTRACTS.objects[name];assert(object,'RESPONSE_STAGING_CARRIER_ORACLE');assert.equal(object.owner,'project-store.js');assert.deepEqual([...object.closedFields],fields);for(const key of fields){const entry=schema.FIELD_REGISTRY[object.fieldDefinitions[key].registryKey];requireAttributes(entry,object.fieldDefinitions[key].registryKey);assert.equal(entry.producer,'APPLICATION');assert.equal(entry.classification,'CARRIER');assert.equal(entry.scope,name==='responseStagingRecovery'?'EXACT_STORED_FILE_RECOVERY_BOUNDARY':'EXACT_STAGED_RESPONSE_BYTES');assert.equal(entry.path,paths[name]+'/'+key,'RESPONSE_STAGING_META_PATH_ORACLE');assert.equal(entry.invalidationOwner,'project-store.js');}}
 assert.deepEqual([...schema.RESPONSE_STAGING_CONTRACT.requiredFields],expected.responseStaging.filter(key=>key!=='rejection'),'RESPONSE_STAGING_REQUIRED_FIELDS_ORACLE');assert.equal(schema.RESPONSE_STAGING_CONTRACT.fieldDefinitions.promptIdentity.objectContract,'promptIdentity','RESPONSE_STAGING_PROMPT_RULE_OWNER_ORACLE');assert.equal(schema.RESPONSE_STAGING_CONTRACT.operational,false);
 const at='2026-10-06T23:00:00.000Z',digest='a'.repeat(64),response={schema:'closed-loop-response-staging/1',stagingId:'RESPONSE-STAGING-EXACT',jobId:'JOB-EXACT',stage:1,rawFilename:'response.json',mediaType:'application/json',byteSize:31,sha256:digest,promptIdentity:{instructionId:'INSTRUCTION-EXACT',bodySha256:digest,contractSha256:digest,contextSignature:digest},packageId:'PACKAGE-EXACT',operationReservationId:'RESERVATION-EXACT',challengeNonce:'NONCE-EXACT',status:'HASHED_AND_REVERIFIED',createdAt:at},retirement={schema:'closed-loop-response-staging-retirement/1',jobId:'JOB-EXACT',stagingId:response.stagingId,retiredAt:at},recovery={schema:'closed-loop-response-staging-recovery/1',jobId:'JOB-EXACT',stagingId:response.stagingId,artifactId:'RAW-'+response.stagingId,kind:'RAW_RESPONSE',stage:1,rawFilename:'response.json',sha256:digest,byteSize:31,outcome:'METADATA_RECOVERED',code:'EXACT_METADATA_RECONSTRUCTED',checkedAt:at};
 const cases=[
  {name:'response',validate:schema.validateResponseStagingDescriptor,value:response,controls:[response,{...response,stage:30,rawFilename:'',mediaType:'',byteSize:0,promptIdentity:null,packageId:null,operationReservationId:null,challengeNonce:null},{...response,rejection:{code:'OVERSIZED_RESPONSE',byteSize:31,maxRawResponseBytes:30,at}}],invalid:[null,[],{...response,extra:true},{...response,blob:'not descriptor data'},{...response,stage:0},{...response,stage:31},{...response,stage:1.5},{...response,byteSize:-1},{...response,byteSize:Number.MAX_SAFE_INTEGER+1},{...response,sha256:'A'.repeat(64)},{...response,promptIdentity:[]},{...response,promptIdentity:{...response.promptIdentity,extra:true}},{...response,promptIdentity:{...response.promptIdentity,instructionId:null}},{...response,status:'CANONICAL'},{...response,createdAt:'2026-02-30T00:00:00Z'},{...response,createdAt:'2026-10-06'},{...response,rejection:null},{...response,rejection:{code:'OTHER',byteSize:31,maxRawResponseBytes:30,at}},{...response,rejection:{code:'OVERSIZED_RESPONSE',byteSize:31,maxRawResponseBytes:30,at,extra:true}},{...response,stagingId:null},{...response,jobId:''},{...response,packageId:[]},{...response,rawFilename:null}]},
  {name:'retirement',validate:schema.validateResponseStagingRetirement,value:retirement,controls:[retirement],invalid:[null,[],{...retirement,stagingId:null},{...retirement,retiredAt:'2026-10-06'},{...retirement,jobId:''},{...retirement,extra:true}]},
  {name:'recovery',validate:schema.validateResponseStagingRecovery,value:recovery,controls:[recovery,{...recovery,stagingId:null,stage:null,rawFilename:null,sha256:null,byteSize:null,outcome:'BLOCKED',code:'MISSING_ORIGINAL_IDENTITY'},{...recovery,outcome:'ALREADY_RECORDED'},{...recovery,kind:'RETURNED_FILE'},{...recovery,kind:'ARTIFACT'},{...recovery,bytesRemoved:false},{...recovery,outcome:'UNREFERENCED_STAGING_REMOVED',bytesRemoved:true},{...recovery,outcome:'UNREFERENCED_STAGING_REMOVED',stagingOccurrenceRemoved:true,bytesRemoved:false},{...recovery,outcome:'UNREFERENCED_STAGING_REMOVED',stagingOccurrenceRemoved:true,bytesRemoved:true}],invalid:[null,[],{...recovery,artifactId:''},{...recovery,kind:null},{...recovery,kind:'CANONICAL'},{...recovery,stage:31},{...recovery,stage:'1'},{...recovery,rawFilename:''},{...recovery,rawFilename:[]},{...recovery,outcome:'READY_FOR_PROMOTION'},{...recovery,sha256:'not a digest'},{...recovery,byteSize:-1},{...recovery,stagingId:''},{...recovery,checkedAt:'yesterday'},{...recovery,extra:true},{...recovery,code:null},{...recovery,bytesRemoved:true},{...recovery,bytesRemoved:'true'},{...recovery,bytesRemoved:null},{...recovery,outcome:'UNREFERENCED_STAGING_REMOVED'},{...recovery,outcome:'UNREFERENCED_STAGING_REMOVED',bytesRemoved:false},{...recovery,stagingOccurrenceRemoved:true},{...recovery,outcome:'UNREFERENCED_STAGING_REMOVED',stagingOccurrenceRemoved:true},{...recovery,outcome:'UNREFERENCED_STAGING_REMOVED',stagingOccurrenceRemoved:false,bytesRemoved:true},{...recovery,outcome:'UNREFERENCED_STAGING_REMOVED',stagingOccurrenceRemoved:'true',bytesRemoved:false}]}
 ];let conformingControls=0,invalidShapeCases=0;
 for(const row of cases){assert.equal(typeof row.validate,'function','RESPONSE_STAGING_VALIDATOR_OWNER_ORACLE');for(const value of row.controls){const before=JSON.stringify(value);assert.equal(row.validate(value).valid,true,'RESPONSE_STAGING_VALID_CONTROL_ORACLE: '+row.name);assert.equal(JSON.stringify(value),before);conformingControls++;}const required=Object.keys(row.value);for(const key of required){const value={...row.value};delete value[key];row.invalid.push(value);}for(const value of row.invalid){const before=JSON.stringify(value),result=row.validate(value);assert.equal(result.valid,false,'RESPONSE_STAGING_REJECTION_ORACLE: '+row.name);assert(result.issues.length);assert.equal(JSON.stringify(value),before);invalidShapeCases++;}}
 assert.throws(()=>verifyResponseStagingRecoveryCarriers({...schema,validateResponseStagingDescriptor:()=>({valid:true,issues:[]})}),/RESPONSE_STAGING_REJECTION_ORACLE: response/,'RESPONSE_STAGING_INTENDED_VALIDATOR_FAULT_ORACLE');
 return {passed:true,registeredFields:Object.values(expected).reduce((n,fields)=>n+fields.length,0),conformingControls,invalidShapeCases,scopeLimit:'Shared storage carrier shape, nullable absent-source identity, declaration ownership and preservation. Byte custody, startup detection, exact retry, retirement, stale scope and promotion remain production store/UI obligations.'};
}

export function verifyJobPointerTargets(schema){
 const expected={CURRENT_ITERATION:['iterations','ITERATION_ID','RETAINED_RECORD'],CURRENT_SOURCE_SET_VERSION:['artifactVersions','version','STAGE_VERSION','SOURCE-SET'],CURRENT_RESEARCH_VERSION:['artifactVersions','version','STAGE_VERSION','RESEARCH'],CURRENT_REQUIREMENTS_VERSION:['artifactVersions','version','STAGE_VERSION','REQUIREMENTS'],CURRENT_TEST_SUITE_VERSION:['artifactVersions','version','STAGE_VERSION','TEST-SUITE'],CURRENT_INSTRUCTION_VERSION:['artifactVersions','version','STAGE_VERSION','INSTRUCTION'],CURRENT_CANDIDATE_ID:['candidateFreezes','CANDIDATE_ID','RETAINED_RECORD'],CURRENT_BASELINE_ID:['baselines','BASELINE_ID','RETAINED_RECORD'],CURRENT_PRODUCT_ID:['products','PRODUCT_ID','COMPLETED_PRODUCT'],CURRENT_PRODUCT_VERSION:['products','PRODUCT_VERSION','COMPLETED_PRODUCT'],CURRENT_DELIVERY_CANDIDATE_SET_ID:['deliveryCandidateSets','DELIVERY_CANDIDATE_SET_ID','RETAINED_RECORD'],CURRENT_REVIEW_VERSION:['artifactVersions','version','STAGE_VERSION','REVIEW'],CURRENT_RECONCILED_REVIEW_VERSION:['artifactVersions','version','STAGE_VERSION','REVIEW'],CURRENT_RELEASE_ID:['releaseRecords','RELEASE_ID','RETAINED_RECORD'],CURRENT_HASH_REVIEW_ID:['artifactIdentities','identityEvidenceSha256','COMPLETE_HASH_REVIEW'],CURRENT_EVIDENCE_CHAIN_VERSION:['evidenceChains','EVIDENCE_CHAIN_VERSION','COMPLETE_EVIDENCE_CHAIN'],CURRENT_DELIVERY_ID:['deliveryRecords','DELIVERY_ID','RETAINED_RECORD'],LATEST_EVIDENCE_REFERENCE:['evidenceRecords','EVIDENCE_ID','RETAINED_RECORD']};
 assert(schema.JOB_POINTER_TARGETS,'JOB_POINTER_DECLARATION_ORACLE');assert.deepEqual(Object.keys(schema.JOB_POINTER_TARGETS).sort(),Object.keys(expected).sort(),'JOB_POINTER_DECLARATION_POPULATION_ORACLE');
 for(const [name,[family,field,creationRule,kind]]of Object.entries(expected)){
  const actual=schema.JOB_POINTER_TARGETS[name],definition=schema.JOB_FIELDS[name];assert.equal(schema.FIELD_REGISTRY['JOB.'+name].relationshipTarget,family,'JOB_POINTER_FIELD_REFERENCE_ORACLE: '+name);assert.equal(schema.FIELD_REGISTRY['JOB.'+name].relationshipDirection,'OUTBOUND_REFERENCE','JOB_POINTER_FIELD_DIRECTION_ORACLE: '+name);assert.equal(definition.producer,'APPLICATION');assert.equal(definition.nullable,true);assert.equal(definition.valueType,'STRING');
  assert.deepEqual({...actual},{family,field,creationRule,...(kind?{kind}:{}),...(name==='CURRENT_HASH_REVIEW_ID'?{valuePrefix:'HASH_REVIEW-',uppercase:true}:{}),retainsAfterInvalidation:true,establishesGateCurrentness:false},'JOB_POINTER_TARGET_OWNER_ORACLE: '+name);
 }
 const omitted={...schema,JOB_POINTER_TARGETS:{...schema.JOB_POINTER_TARGETS}};delete omitted.JOB_POINTER_TARGETS.CURRENT_PRODUCT_ID;assert.throws(()=>verifyJobPointerTargets(omitted),/JOB_POINTER_DECLARATION_POPULATION_ORACLE/);
 const wrong={...schema,JOB_POINTER_TARGETS:{...schema.JOB_POINTER_TARGETS,CURRENT_PRODUCT_ID:{...schema.JOB_POINTER_TARGETS.CURRENT_PRODUCT_ID,family:'runs'}}};assert.throws(()=>verifyJobPointerTargets(wrong),/JOB_POINTER_TARGET_OWNER_ORACLE/);
 const undeclared={...schema,FIELD_REGISTRY:{...schema.FIELD_REGISTRY,'JOB.CURRENT_PRODUCT_ID':{...schema.FIELD_REGISTRY['JOB.CURRENT_PRODUCT_ID'],relationshipTarget:null,relationshipDirection:null}}};assert.throws(()=>verifyJobPointerTargets(undeclared),/JOB_POINTER_FIELD_REFERENCE_ORACLE/);
 return {passed:true,pointers:18,closedFamiliesAndCreationRules:true,historicalRetentionDoesNotEstablishCurrentness:true,scopeLimit:'Shared declaration only. Conditional creation, membership, invalidation retention, store admission and reload/restore require engine/store controls.'};
}

export function verifyMobileAcceptanceSessionCarriers(schema){
 const expected={mobileInitialProjectPackage:['testProjectId','mediaType','base64','sha256','byteSize','capturedAt'],mobilePreparationProjectPackage:['testProjectId','mediaType','base64','sha256','byteSize','capturedAt'],mobileInitialProjectState:['revision','projectSha256'],mobileStorageUnavailableReasons:['persistent','quotaBytes','usageBytes'],mobileStorageObservations:['persistent','quotaBytes','usageBytes','recordedAt','evidenceBasis','unavailableReasons'],mobileAcceptancePreparation:['schema','preparationId','targetId','challenge','sourceCommit','deploymentManifestDigest','origin','basePath','testProjectId','procedureVersion','buildIdentity','recordedAt','evidenceBasis','initialProjectPackage','storageObservations'],mobileAcceptanceSessionAnchors:['version','jobId','buildIdentity','target','initialProjectState','initialProjectPackage','preparation']};
 for(const [name,names]of Object.entries(expected)){const carrier=schema.CARRIER_FIELD_CONTRACTS.objects[name];assert(carrier,'MOBILE_SESSION_CARRIER_ORACLE: '+name);assert.deepEqual([...carrier.closedFields],names);assert.equal(carrier.owner,'app-core.js');for(const name of names){const field=carrier.fieldDefinitions[name],entry=schema.FIELD_REGISTRY[field.registryKey];assert.equal(entry.producer,'APPLICATION');assert.equal(entry.classification,'CARRIER');assert.equal(entry.path,carrier.path+'/'+name,'MOBILE_SESSION_PATH_ORACLE');requireAttributes(entry,field.registryKey);}}
 assert.deepEqual([...schema.MOBILE_ACCEPTANCE_SESSION_ANCHOR_CONTRACT.requiredFields],['version','jobId','buildIdentity','target']);assert.equal(schema.MOBILE_ACCEPTANCE_SESSION_ANCHOR_CONTRACT.preservesOtherSessionFields,true);
 const at='2026-10-06T23:00:00.000Z',target={mobileAcceptanceTargetId:'SYNTHETIC-TARGET',preparationId:'SYNTHETIC-PREPARATION',challenge:'a'.repeat(32),sourceCommit:'b'.repeat(40),deploymentManifestDigest:'c'.repeat(64),origin:'https://example.test',basePath:'/synthetic/',testProjectId:'SYNTHETIC-PROJECT',procedureVersion:'SYNTHETIC-PROCEDURE',buildIdentity:'SYNTHETIC-BUILD'},initialProjectPackage={testProjectId:target.testProjectId,mediaType:'application/gzip',base64:'eA==',sha256:'d'.repeat(64),byteSize:1,capturedAt:at},preparation={schema:'closed-loop-mobile-acceptance-preparation/1',preparationId:target.preparationId,targetId:target.mobileAcceptanceTargetId,...Object.fromEntries(['challenge','sourceCommit','deploymentManifestDigest','origin','basePath','testProjectId','procedureVersion','buildIdentity'].map(key=>[key,target[key]])),recordedAt:at,evidenceBasis:'APPLICATION_OBSERVATION',initialProjectPackage,storageObservations:{persistent:false,quotaBytes:100.5,usageBytes:0,recordedAt:at,evidenceBasis:'APPLICATION_OBSERVATION',unavailableReasons:{}}},bare={version:1,jobId:target.testProjectId,buildIdentity:target.buildIdentity,target},value={...bare,initialProjectState:{revision:0,projectSha256:'e'.repeat(64)},initialProjectPackage,preparation,observations:[],unknownExtension:{exact:'preserve'}};
 const unknown={...value,preparation:{...preparation,storageObservations:{...preparation.storageObservations,persistent:'UNKNOWN',quotaBytes:'UNKNOWN',usageBytes:'UNKNOWN',unavailableReasons:{persistent:'Not reported by this controlled capability.',quotaBytes:'Not reported.',usageBytes:'Not reported.'}}}};
 for(const control of [bare,{...bare,initialProjectState:value.initialProjectState},{...bare,initialProjectPackage},value,unknown]){const before=JSON.stringify(control);assert.equal(schema.validateMobileAcceptanceSessionAnchors(control).valid,true,'MOBILE_SESSION_VALID_SHAPE_ORACLE');assert.equal(JSON.stringify(control),before);}
 const invalid=[null,[],{...value,version:2},{...value,jobId:'another project'},{...value,buildIdentity:''},{...value,target:[]},{...value,initialProjectState:null},{...value,initialProjectState:{revision:-1,projectSha256:'e'.repeat(64)}},{...value,initialProjectState:{...value.initialProjectState,extra:true}},{...value,initialProjectPackage:{...initialProjectPackage,byteSize:0}},{...value,initialProjectPackage:{...initialProjectPackage,sha256:'reported label'}},{...value,initialProjectPackage:{...initialProjectPackage,extra:true}},{...value,preparation:{...preparation,buildIdentity:'another build'}},{...value,preparation:{...preparation,targetId:'another target'}},{...value,preparation:{...preparation,initialProjectPackage:{...initialProjectPackage,base64:'eQ=='}}},{...value,preparation:{...preparation,recordedAt:'2026-10-06'}},{...value,preparation:{...preparation,storageObservations:{...preparation.storageObservations,persistent:'GRANTED'}}},{...value,preparation:{...preparation,storageObservations:{...preparation.storageObservations,quotaBytes:-1}}},{...value,preparation:{...preparation,storageObservations:{...preparation.storageObservations,quotaBytes:NaN}}},{...value,preparation:{...preparation,storageObservations:{...preparation.storageObservations,persistent:'UNKNOWN'}}},{...value,preparation:{...preparation,storageObservations:{...preparation.storageObservations,unavailableReasons:{other:'not registered'}}}}];
 for(const key of ['version','jobId','buildIdentity','target','initialProjectPackage']){const missing={...value};delete missing[key];invalid.push(missing);}
 for(const key of Object.keys(preparation)){const missing={...preparation};delete missing[key];invalid.push({...value,preparation:missing});}
 for(const input of invalid){const before=JSON.stringify(input),result=schema.validateMobileAcceptanceSessionAnchors(input);assert.equal(result.valid,false,'MOBILE_SESSION_INVALID_SHAPE_ORACLE');assert(result.issues.length);assert.equal(JSON.stringify(input),before);}
 assert.throws(()=>verifyMobileAcceptanceSessionCarriers({...schema,validateMobileAcceptanceSessionAnchors:()=>({valid:true,issues:[]})}),/MOBILE_SESSION_INVALID_SHAPE_ORACLE/);
 return {passed:true,registeredFields:45,conformingControls:5,invalidShapeCases:invalid.length,scopeLimit:'Shape-only synthetic session anchors, not a valid gzip package, physical target, physical device or accepted external evidence. Store proves exact bytes and immutability; evidence verifier proves target/preparation semantics.'};
}

export function verifyMobileAcceptanceSessionMergeContract(schema){
 const contract=schema.MOBILE_ACCEPTANCE_SESSION_MERGE_CONTRACT;assert(contract,'MOBILE_SESSION_MERGE_CONTRACT_ORACLE');assert.deepEqual([...contract.fields],['observations','receipts','exports','runtimeCountsByTab','capabilityCopies']);assert.deepEqual([...contract.identityCollections],['observations','receipts']);assert.deepEqual([...contract.exactSetCollections],['exports']);assert.deepEqual([...contract.keyedMapCollections],['capabilityCopies']);assert.equal(contract.fieldDefinitions.capabilityCopies.mergePolicy,'PER_KEY_REPLACE');assert.equal(contract.fieldDefinitions.capabilityCopies.mapKeyPolicy,'OWN_STRING_KEYS');assert.equal(contract.fieldDefinitions.capabilityCopies.mapValueType,'OBJECT');assert.equal(contract.counterMap,'runtimeCountsByTab');assert.deepEqual([...contract.counterFields],['errors','rejections']);assert.equal(contract.omissionPreservesExisting,true);assert.equal(contract.conflictingIdentity,'REJECT');
 for(const [name,fields]of [['mobileAcceptanceSessionMutable',['observations','receipts','exports','runtimeCountsByTab','capabilityCopies']],['mobileSessionRuntimeCounts',['errors','rejections']]]){const object=schema.CARRIER_FIELD_CONTRACTS.objects[name];assert.deepEqual([...object.closedFields],fields);assert.equal(object.owner,'app-core.js');for(const key of fields){const field=object.fieldDefinitions[key],entry=schema.FIELD_REGISTRY[field.registryKey];assert.equal(entry.path,object.path+'/'+key);assert.equal(entry.producer,'APPLICATION');requireAttributes(entry,field.registryKey);}}
 const valid=[{}, {observations:[],receipts:[],exports:[],runtimeCountsByTab:{}},{observations:[{receiptId:'SYNTHETIC-OBSERVATION',retainedExtension:{verbatim:'keep exact'}}],receipts:[{receiptId:'SYNTHETIC-RECEIPT',status:'No authority asserted by this shape fixture'}],exports:[{filename:'synthetic.txt',sha256:'reported value'}],runtimeCountsByTab:{tab:{errors:2,rejections:1}}},{runtimeCountsByTab:JSON.parse('{"__proto__":{"errors":0,"rejections":0},"constructor":{"errors":1,"rejections":0}}')},{capabilityCopies:{AUTHOR:{copiedAt:'retained exact claim'},REVIEWER:{}}},{capabilityCopies:JSON.parse('{"__proto__":{},"constructor":{}}')}];
 for(const value of valid){const before=JSON.stringify(value);assert.equal(schema.validateMobileAcceptanceSessionMutable(value).valid,true,'MOBILE_SESSION_MUTABLE_VALID_ORACLE');assert.equal(JSON.stringify(value),before);}
 const invalid=[null,[],{observations:{}},{receipts:null},{exports:'not a list'},{runtimeCountsByTab:[]},{observations:[null]},{receipts:[[]]},{observations:[{}]},{receipts:[{receiptId:''}]},{receipts:[{receiptId:'  '}]},{receipts:[{receiptId:3}]},{exports:[3]},{runtimeCountsByTab:{tab:{errors:1}}},{runtimeCountsByTab:{tab:{errors:0,rejections:-1}}},{runtimeCountsByTab:{tab:{errors:1.5,rejections:0}}},{runtimeCountsByTab:{tab:{errors:Number.MAX_SAFE_INTEGER+1,rejections:0}}},{runtimeCountsByTab:{tab:{errors:'0',rejections:0}}},{runtimeCountsByTab:{tab:{errors:0,rejections:0,other:0}}},{runtimeCountsByTab:{'':{errors:0,rejections:0}}},{capabilityCopies:[]},{capabilityCopies:null},{capabilityCopies:{role:null}},{capabilityCopies:{role:[]}},{capabilityCopies:{role:'copied'}},{capabilityCopies:{'':{}}}];
 for(const value of invalid){const before=JSON.stringify(value),result=schema.validateMobileAcceptanceSessionMutable(value);assert.equal(result.valid,false,'MOBILE_SESSION_MUTABLE_INVALID_ORACLE');assert(result.issues.length);assert.equal(JSON.stringify(value),before);}
 assert.throws(()=>verifyMobileAcceptanceSessionMergeContract({...schema,validateMobileAcceptanceSessionMutable:()=>({valid:true,issues:[]})}),/MOBILE_SESSION_MUTABLE_INVALID_ORACLE/);
 return {passed:true,registeredFields:7,conformingShapeControls:valid.length,invalidShapeCases:invalid.length,scopeLimit:'Shared minimal shape/merge policy only. Actual atomic receipt union, conflict rejection, exact export union, monotonic failure counters and per-role capability-map merge are store-owned; no physical receipt authority is inferred.'};
}

export function verifyArtifactByteReferenceCarrier(schema){
 const expected=['schema','jobId','sha256','byteSize'],contract=schema.ARTIFACT_BYTE_REFERENCE_CONTRACT;
 assert(contract,'ARTIFACT_BYTE_REFERENCE_CARRIER_ORACLE');assert.equal(contract.schema,'closed-loop-artifact-byte-reference/1');assert.deepEqual([...contract.fields],expected);assert.equal(contract.privateStorageOnly,true);assert.equal(contract.canonicalIdentity,false);
 for(const [name,path]of [['artifactByteReference','/storage/artifacts/*/byteReference'],['responseStagingByteReference','/metadata/responseStaging/*/byteReference']]){const object=schema.CARRIER_FIELD_CONTRACTS.objects[name];assert(object,'ARTIFACT_BYTE_REFERENCE_CARRIER_ORACLE');assert.equal(object.owner,'project-store.js');assert.equal(object.persistencePolicy,'PRIVATE_STORAGE_ONLY_HYDRATED_BEFORE_PUBLIC_FILE_API');assert.deepEqual([...object.closedFields],expected);for(const key of expected){const definition=object.fieldDefinitions[key],entry=schema.FIELD_REGISTRY[definition.registryKey];requireAttributes(entry,definition.registryKey);assert.equal(entry.path,path+'/'+key);assert.equal(entry.producer,'APPLICATION');assert.equal(entry.classification,'CARRIER');assert.equal(entry.scope,'EXACT_PROJECT_AND_STORED_BYTE_IDENTITY');}}
 const valid={schema:'closed-loop-artifact-byte-reference/1',jobId:'JOB-SYNTHETIC',sha256:'ab'.repeat(32),byteSize:0};for(const value of [valid,{...valid,byteSize:Number.MAX_SAFE_INTEGER}]){const before=JSON.stringify(value);assert.equal(schema.validateArtifactByteReference(value).valid,true,'ARTIFACT_BYTE_REFERENCE_VALID_ORACLE');assert.equal(JSON.stringify(value),before);}
 const invalid=[null,[],{},...expected.map(key=>Object.fromEntries(Object.entries(valid).filter(([name])=>name!==key))),{...valid,jobId:''},{...valid,jobId:1},{...valid,sha256:'AB'.repeat(32)},{...valid,sha256:'ab'.repeat(31)},{...valid,sha256:null},{...valid,byteSize:-1},{...valid,byteSize:1.5},{...valid,byteSize:Number.MAX_SAFE_INTEGER+1},{...valid,byteSize:'0'},{...valid,schema:'unknown'},{...valid,artifactId:'UNAUTHORIZED-IDENTITY'},{...valid,blob:{}}];for(const value of invalid){const before=JSON.stringify(value),result=schema.validateArtifactByteReference(value);assert.equal(result.valid,false,'ARTIFACT_BYTE_REFERENCE_INVALID_ORACLE');assert(result.issues.length);assert.equal(JSON.stringify(value),before);}
 assert.throws(()=>verifyArtifactByteReferenceCarrier({...schema,validateArtifactByteReference:()=>({valid:true,issues:[]})}),/ARTIFACT_BYTE_REFERENCE_INVALID_ORACLE/);
 return {passed:true,registeredFields:8,conformingShapeControls:2,invalidShapeCases:invalid.length,scopeLimit:'Private carrier shape and registration only; the store separately owns row/body identity, exact bytes, atomic migration and public Blob hydration.'};
}

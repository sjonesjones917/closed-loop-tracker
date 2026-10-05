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

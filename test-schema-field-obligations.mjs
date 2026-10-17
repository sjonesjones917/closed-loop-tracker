import assert from 'node:assert/strict';
// Exact Section 38 literals; independent of production declarations.
export const SECTION38_FAMILIES=Object.freeze([
 Object.freeze(["sources","SOURCE_ID",2,"REPLACE_CURRENT_STAGE_SET"]),
 Object.freeze(["sourceConflicts","CONFLICT_ID",2,"APPEND_SCOPED"]),
 Object.freeze(["research","RESEARCH_ID",3,"REPLACE_CURRENT_STAGE_SET"]),
 Object.freeze(["candidateRequirements","CANDIDATE_REQ_ID",3,"REPLACE_CURRENT_STAGE_SET"]),
 Object.freeze(["requirements","REQ_ID",4,"REPLACE_CURRENT_STAGE_SET"]),
 Object.freeze(["requirementResolutions","RESOLUTION_ID",5,"REPLACE_CURRENT_STAGE_SET"]),
 Object.freeze(["tests","TEST_ID",6,"REPLACE_CURRENT_STAGE_SET"]),
 Object.freeze(["failureTests","MUTATION_ID",7,"REPLACE_CURRENT_STAGE_SET"]),
 Object.freeze(["instructions","INSTRUCTION_ID",8,"REPLACE_CURRENT_STAGE_SET"]),
 Object.freeze(["preflightRecords","REVIEW_ID",9,"REPLACE_CURRENT_STAGE_SET"]),
 Object.freeze(["iterations","ITERATION_ID",10,"APPLICATION_DERIVED"]),
 Object.freeze(["candidateFreezes","CANDIDATE_ID",10,"APPLICATION_DERIVED"]),
 Object.freeze(["runs","RUN_ID",11,"UPDATE_RESERVED"]),
 Object.freeze(["verification","VERIFICATION_ID",12,"APPEND_SCOPED"]),
 Object.freeze(["comparisons","COMPARISON_ID",13,"APPEND_SCOPED"]),
 Object.freeze(["defects","DEFECT_ID",14,"APPEND_ONLY"]),
 Object.freeze(["rootCauses","RCA_ID",14,"APPEND_SCOPED"]),
 Object.freeze(["regressions","REG_ID",15,"APPEND_ONLY"]),
 Object.freeze(["changes","CHANGESET_ID",16,"APPEND_SCOPED"]),
 Object.freeze(["convergenceRecords","CONVERGENCE_ID",18,"APPLICATION_DERIVED"]),
 Object.freeze(["confirmationRecords","CONFIRMATION_ID",19,"APPEND_SCOPED"]),
 Object.freeze(["baselines","BASELINE_ID",20,"APPLICATION_DERIVED"]),
 Object.freeze(["products","PRODUCT_ID",21,"UPDATE_RESERVED"]),
 Object.freeze(["deterministicResults","RESULT_ID",22,"APPEND_SCOPED"]),
 Object.freeze(["meaningResults","MEANING_REVIEW_ID",23,"APPEND_SCOPED"]),
 Object.freeze(["adversarialResults","ATTACK_ID",24,"APPEND_SCOPED"]),
 Object.freeze(["representationInspections","INSPECTION_ID",25,"APPEND_SCOPED"]),
 Object.freeze(["processAudits","PROCESS_AUDIT_ID",26,"REPLACE_CURRENT_STAGE_SET"]),
 Object.freeze(["productAudits","PRODUCT_AUDIT_ID",26,"REPLACE_CURRENT_STAGE_SET"]),
 Object.freeze(["releaseGateReviews","GATE_REVIEW_ID",27,"APPEND_SCOPED"]),
 Object.freeze(["releaseRecords","RELEASE_ID",27,"APPLICATION_DERIVED"]),
 Object.freeze(["artifactIdentities","IDENTITY_ID",28,"APPLICATION_DERIVED"]),
 Object.freeze(["evidenceInvestigations","INVESTIGATION_ID",29,"APPEND_SCOPED"]),
 Object.freeze(["evidenceChains","CHAIN_ID",29,"APPLICATION_DERIVED"]),
 Object.freeze(["instructionTraces","TRACE_ID",8,"REPLACE_CURRENT_STAGE_SET"]),
 Object.freeze(["regressionExecutions","REG_EXEC_ID",15,"APPEND_SCOPED"]),
 Object.freeze(["blockers","BLOCKER_ID","GLOBAL","APPEND_SCOPED"]),
 Object.freeze(["freshContexts","CONTEXT_ID","GLOBAL","UPDATE_RESERVED"]),
 Object.freeze(["evidenceRecords","EVIDENCE_ID","GLOBAL","APPEND_SCOPED"]),
 Object.freeze(["artifacts","ARTIFACT_ID","GLOBAL","APPLICATION_DERIVED"]),
]);
export const SECTION38_RELATIONSHIPS=Object.freeze({
 sourceConflicts:Object.freeze({SOURCE_A:'sources',SOURCE_B:'sources',BLOCKER_ID:'blockers'}),
 research:Object.freeze({SOURCE_ID:'sources'}),candidateRequirements:Object.freeze({SOURCE_ID:'sources'}),
 requirements:Object.freeze({SOURCE_ID:'sources'}),tests:Object.freeze({REQ_ID:'requirements'}),
 failureTests:Object.freeze({REQ_ID:'requirements',VALIDATOR_DEFECT_ID:'defects'}),
 preflightRecords:Object.freeze({INSTRUCTION_ID:'instructions'}),
 verification:Object.freeze({REQ_ID:'requirements',RUN_ID:'runs',TEST_ID:'tests',DEFECT_ID:'defects'})
});
const plain=value=>JSON.parse(JSON.stringify(value));
function inspect(schema){
 const observations=[];
 for(const [family,idField,stage,policy]of SECTION38_FAMILIES){
  const record=schema.RECORD_SCHEMAS?.[family],durable=schema.DURABLE_OBJECT_REGISTRY?.[family];
  assert(record&&durable,'SECTION38_FAMILY_EXISTENCE_ORACLE: '+family);
  assert.equal(durable.family,family,'SECTION38_DURABLE_PARENT_ORACLE: '+family);
  assert.equal(record.idField,idField,'SECTION38_ID_LITERAL_ORACLE: '+family);
  assert.equal(durable.idField,idField,'SECTION38_ID_LITERAL_ORACLE: '+family);
  assert.equal(record.stage===null?'GLOBAL':record.stage,stage,'SECTION38_STAGE_LITERAL_ORACLE: '+family);
  assert.equal(durable.stage,stage,'SECTION38_STAGE_LITERAL_ORACLE: '+family);
  assert.equal(record.commitPolicy,policy,'SECTION38_POLICY_DECLARATION_ORACLE: '+family);
  assert.equal(durable.policy,policy,'SECTION38_POLICY_DECLARATION_ORACLE: '+family);
  const entry=schema.FIELD_REGISTRY?.['RECORD.'+family+'.'+idField];
  for(const field of [record.fieldDefinitions?.[idField],entry]){
   assert(field,'SECTION38_ID_DECLARATION_ORACLE: '+family);
   assert.equal(field.producer,'APPLICATION','SECTION38_ID_OWNER_ORACLE: '+family);
   assert.equal(field.valueType,'STRING','SECTION38_ID_TYPE_ORACLE: '+family);
   assert.equal(field.nullable,false,'SECTION38_ID_NULLABILITY_ORACLE: '+family);
  }
  assert.equal(entry.path,'/projectData/'+family+'/*/'+idField,'SECTION38_ID_PATH_ORACLE: '+family);
  const relationships=SECTION38_RELATIONSHIPS[family]||{};
  for(const [fieldName,target]of Object.entries(relationships)){
   assert.equal(record.relationships?.[fieldName],target,'SECTION38_RELATIONSHIP_TARGET_ORACLE: '+family+'.'+fieldName);
   for(const field of [record.fieldDefinitions?.[fieldName],schema.FIELD_REGISTRY?.['RECORD.'+family+'.'+fieldName]]){
    assert.equal(field?.producer,'APPLICATION','SECTION38_RELATIONSHIP_OWNER_ORACLE: '+family+'.'+fieldName);
    assert.equal(field?.valueType,'REFERENCE','SECTION38_RELATIONSHIP_TYPE_ORACLE: '+family+'.'+fieldName);
   }
   assert.equal(schema.FIELD_REGISTRY?.['RECORD.'+family+'.'+fieldName]?.relationshipTarget,target,'SECTION38_RELATIONSHIP_FIELD_TARGET_ORACLE: '+family+'.'+fieldName);
  }
  observations.push({family,idField,stage,policy,relationships:plain(relationships),declarationsPassed:true});
 }
 return observations;
}
export function verifySchemaFieldObligations(schema){
 const observations=inspect(schema),mutants=[];
 const changed=(family,record,durable,registry=schema.FIELD_REGISTRY)=>({...schema,RECORD_SCHEMAS:{...schema.RECORD_SCHEMAS,[family]:record},DURABLE_OBJECT_REGISTRY:{...schema.DURABLE_OBJECT_REGISTRY,[family]:durable},FIELD_REGISTRY:registry});
 const rejected=(candidate,family,fault,oracle)=>{assert.throws(()=>inspect(candidate),error=>error.message.includes(oracle),'SECTION38_MUTANT_DETECTION_ORACLE: '+family+'.'+fault);mutants.push({family,fault,oracle,detected:true});};
 for(const [family,idField]of SECTION38_FAMILIES){
  const record=schema.RECORD_SCHEMAS[family],durable=schema.DURABLE_OBJECT_REGISTRY[family];
  rejected(changed(family,undefined,undefined),family,'coherent-family-omission','SECTION38_FAMILY_EXISTENCE_ORACLE');
  for(const [property,projection,replacement,oracle]of [
   ['idField','idField','WRONG_ID','SECTION38_ID_LITERAL_ORACLE'],
   ['stage','stage',31,'SECTION38_STAGE_LITERAL_ORACLE'],
   ['commitPolicy','policy','APPEND_WHATEVER','SECTION38_POLICY_DECLARATION_ORACLE']
  ])rejected(changed(family,{...record,[property]:replacement},{...durable,[projection]:replacement}),family,'coherent-'+property,oracle);
  const key='RECORD.'+family+'.'+idField;
  for(const [property,replacement,oracle]of [['producer','AGENT','SECTION38_ID_OWNER_ORACLE'],['valueType','OBJECT','SECTION38_ID_TYPE_ORACLE'],['nullable',true,'SECTION38_ID_NULLABILITY_ORACLE']]){
   rejected(changed(family,{...record,fieldDefinitions:{...record.fieldDefinitions,[idField]:{...record.fieldDefinitions[idField],[property]:replacement}}},durable,{...schema.FIELD_REGISTRY,[key]:{...schema.FIELD_REGISTRY[key],[property]:replacement}}),family,'coherent-ID-'+property,oracle);
  }
  for(const [name]of Object.entries(SECTION38_RELATIONSHIPS[family]||{})){
   const relationKey='RECORD.'+family+'.'+name;
   rejected(changed(family,{...record,relationships:{...record.relationships,[name]:'artifacts'},fieldDefinitions:{...record.fieldDefinitions,[name]:{...record.fieldDefinitions[name],relationshipTarget:'artifacts'}}},durable,{...schema.FIELD_REGISTRY,[relationKey]:{...schema.FIELD_REGISTRY[relationKey],relationshipTarget:'artifacts'}}),family,'coherent-relationship-target-'+name,'SECTION38_RELATIONSHIP_TARGET_ORACLE');
   rejected(changed(family,{...record,fieldDefinitions:{...record.fieldDefinitions,[name]:{...record.fieldDefinitions[name],producer:'AGENT'}}},durable,{...schema.FIELD_REGISTRY,[relationKey]:{...schema.FIELD_REGISTRY[relationKey],producer:'AGENT'}}),family,'coherent-relationship-owner-'+name,'SECTION38_RELATIONSHIP_OWNER_ORACLE');
  }
 }
 inspect(schema);
 return {checkId:'schema.section38-field-obligations',passed:true,observations,mutants,restored:true,families:40,negativeCases:mutants.length,scopeLimit:'Exact 40 target family existence, ID/stage/policy declarations and 14 source-named typed relationship declarations. Policy execution, family writers, authority provenance, required/optional reference admission, persistent lifecycle, execution, artifact bytes and browser/native storage remain with their behavioral owners.',synthetic:true,actualBrowser:false};
}

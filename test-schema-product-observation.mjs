import assert from 'node:assert/strict';

// §38 lines 3833–3862. These literal content partitions are independent of
// recordAgentFields/ownership; normalized result authority is not an agent claim.
const declarations = [
  {family:'products',stage:21,operation:'COMPLETE',
    agent:['BASELINE_MATERIALS','EXECUTION_TIMESTAMPS','TOOL_CONFIGURATION','DEVIATIONS','FAILURES'],
    application:['PRODUCT_ID','PRODUCT_VERSION','BASELINE_ID','EXECUTION_ID','PRODUCTION_CONTEXT_ID','INSTRUCTION_VERSION','GENERATED_ARTIFACT_INVENTORY','STATUS']},
  {family:'deterministicResults',stage:22,operation:'EXECUTE_EXTERNAL_TEST',agent:[],
    application:['RESULT_ID','PRODUCT_ID','PRODUCT_SHA256','TEST_ID','DEFECT_ID','APPLICATION_DETERMINATION','RUNTIME_VERSION','TEST_SPEC_SHA256','INPUT_ARTIFACT_IDENTITIES','RUNTIME_OBSERVATIONS','EXPECTED_RESULT','ACTUAL_RESULT','DETERMINATION']},
  {family:'meaningResults',stage:23,operation:'COMPLETE',
    agent:['PRODUCT_LOCATION','EXTERNAL_SOURCE_EVIDENCE','REQUIRED_MEANING','OBSERVED_MEANING','EVIDENCE_BASED_COMPARISON','DETERMINATION','UNDETERMINED_REASON'],
    application:['MEANING_REVIEW_ID','REQ_ID','TEST_ID','PRODUCT_ID','DEFECT_ID']},
  {family:'adversarialResults',stage:24,operation:'COMPLETE',
    agent:['ATTACK','METHOD','EXPECTED_BEHAVIOR','ACTUAL_RESULT','DETERMINATION','SEVERITY','EVIDENCE'],
    application:['ATTACK_ID','PRODUCT_ID','TEST_ID','REG_ID','DEFECT_ID','APPLICATION_DETERMINATION','RUNTIME_VERSION','TEST_SPEC_SHA256','INPUT_ARTIFACT_IDENTITIES','RUNTIME_OBSERVATIONS']},
  {family:'representationInspections',stage:25,operation:'COMPLETE',
    agent:['REQUIRED_BY_TRACE','TRANSFORMATION_CHAIN','TRANSFORMATION_TOOLS_VERSIONS','RENDERING_OPENING_EVIDENCE','OBSERVATIONS','DETERMINATION','EVIDENCE'],
    application:['INSPECTION_ID','ARTIFACT_ID','FILENAME','VERSION','BYTE_SIZE','SHA256','BEFORE_AFTER_HASHES','DEFECT_ID']}
];
const limitation='Literal field ownership, canonical registry classification, mutation authorization and producer descriptor only. This does not exercise owning late-stage reservation/admission, normalization, persistence, independent review, human or external execution, stage completion, or release. Stage22 externally submitted observations must retain their original evidence separately from application-owned canonical normalization; native execution proof is separate.';

export function inspectSchemaProductObservation(schema,prompts){
  const cases=[];
  for(const group of declarations){
    const descriptor=prompts?.responseContractDescriptor(group.stage,group.operation)?.records?.[group.family];
    for(const [producer,names]of [['AGENT',group.agent],['APPLICATION',group.application]])for(const field of names){
      const caseId=group.family+'.'+field,definition=schema.RECORD_SCHEMAS[group.family]?.fieldDefinitions?.[field],registry=schema.FIELD_REGISTRY['RECORD.'+caseId];
      try{
        assert.equal(definition?.producer,producer,'PRODUCT_OBSERVATION_OWNER_ORACLE: '+caseId);
        assert.equal(registry?.producer,producer,'PRODUCT_OBSERVATION_REGISTRY_OWNER_ORACLE: '+caseId);
        assert.equal(schema.authorizeMutation({fieldDefinition:definition,actor:'AGENT',mutationType:'RESPONSE_INGESTION'}).authorized,producer==='AGENT','PRODUCT_OBSERVATION_MUTATION_OWNER_ORACLE: '+caseId);
        assert.equal(schema.authorizeMutation({fieldDefinition:definition,actor:'APPLICATION',mutationType:'DERIVATION'}).authorized,producer==='APPLICATION','PRODUCT_OBSERVATION_DERIVATION_OWNER_ORACLE: '+caseId);
        if(producer==='AGENT'){
          assert.equal(definition.valueType,'STRING','PRODUCT_OBSERVATION_CONTENT_TYPE_ORACLE: '+caseId);
          assert.equal(definition.provenanceRequired,true,'PRODUCT_OBSERVATION_CONTENT_PROVENANCE_ORACLE: '+caseId);
          assert.equal(definition.responsePath,'/records/{collection}/*/fields/'+field,'PRODUCT_OBSERVATION_CONTENT_PATH_ORACLE: '+caseId);
        }
        if(prompts){
          if(producer==='AGENT')assert.ok(descriptor,'PRODUCT_OBSERVATION_DESCRIPTOR_ORACLE: '+group.family);
          assert.equal(Boolean(descriptor&&Object.hasOwn(descriptor.agentFields,field)),producer==='AGENT','PRODUCT_OBSERVATION_PUBLICATION_ORACLE: '+caseId);
        }
        cases.push({caseId,expectedProducer:producer,actualProducer:definition.producer,passed:true});
      }catch(error){cases.push({caseId,expectedProducer:producer,actualProducer:definition?.producer||null,classification:registry?.classification||null,passed:false,oracle:error.message.split('\n')[0]});}
    }
  }
  return {cases,synthetic:true,actualBrowser:false,actualAdmission:false,fullClauseProof:false,scopeLimit:limitation};
}

export function verifySchemaProductObservationControls(schema){
  const controls=[];
  for(const family of ['products','meaningResults','adversarialResults','representationInspections']){
    const group=declarations.find(row=>row.family===family);
    for(const [kind,name,replacement]of [['agent-content-made-application',group.agent[0],'APPLICATION'],['application-identity-made-agent',group.application[0],'AGENT']]){
      const field={...schema.RECORD_SCHEMAS[family].fieldDefinitions[name],producer:replacement},key='RECORD.'+family+'.'+name;
      const changed={...schema,RECORD_SCHEMAS:{...schema.RECORD_SCHEMAS,[family]:{...schema.RECORD_SCHEMAS[family],fieldDefinitions:{...schema.RECORD_SCHEMAS[family].fieldDefinitions,[name]:field}}},FIELD_REGISTRY:{...schema.FIELD_REGISTRY,[key]:{...schema.FIELD_REGISTRY[key],producer:replacement}}};
      const observed=inspectSchemaProductObservation(changed).cases.find(row=>row.caseId===family+'.'+name);
      assert.equal(observed.passed,false,'PRODUCT_OBSERVATION_FAULT_DETECTION_ORACLE: '+family+':'+kind);
      assert.equal(observed.oracle,'PRODUCT_OBSERVATION_OWNER_ORACLE: '+family+'.'+name,'PRODUCT_OBSERVATION_INTENDED_FAULT_ORACLE');
      controls.push({caseId:family+':'+kind,oracle:observed.oracle,detected:true});
    }
  }
  // Retain explicit controls for the three original Stage22 ownership failures.
  // Expected APPLICATION ownership is independently literal in declarations;
  // these coherent AGENT projections must fail that same owning assertion.
  for(const name of ['EXPECTED_RESULT','ACTUAL_RESULT','DETERMINATION']){
    const family='deterministicResults',field={...schema.RECORD_SCHEMAS[family].fieldDefinitions[name],producer:'AGENT'},key='RECORD.'+family+'.'+name;
    const changed={...schema,RECORD_SCHEMAS:{...schema.RECORD_SCHEMAS,[family]:{...schema.RECORD_SCHEMAS[family],fieldDefinitions:{...schema.RECORD_SCHEMAS[family].fieldDefinitions,[name]:field}}},FIELD_REGISTRY:{...schema.FIELD_REGISTRY,[key]:{...schema.FIELD_REGISTRY[key],producer:'AGENT'}}};
    const observed=inspectSchemaProductObservation(changed).cases.find(row=>row.caseId===family+'.'+name);
    assert.equal(observed.passed,false,'PRODUCT_OBSERVATION_FAULT_DETECTION_ORACLE: '+family+':application-result-made-agent:'+name);
    assert.equal(observed.oracle,'PRODUCT_OBSERVATION_OWNER_ORACLE: '+family+'.'+name,'PRODUCT_OBSERVATION_INTENDED_FAULT_ORACLE');
    controls.push({caseId:family+':application-result-made-agent:'+name,oracle:observed.oracle,detected:true});
  }
  return controls;
}
export function verifySchemaProductObservation(schema,prompts){
  const result=inspectSchemaProductObservation(schema,prompts),faults=verifySchemaProductObservationControls(schema);
  assert.deepEqual(result.cases.filter(row=>!row.passed),[],'PRODUCT_OBSERVATION_COMPLETE_OWNERSHIP_ORACLE');
  return {schemaProductObservation:'PASS',...result,faults};
}

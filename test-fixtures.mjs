export function scalarFor(def,name,overrides={}){
  if(Object.hasOwn(overrides,name))return overrides[name];
  if(String(name).toUpperCase()==='EXECUTION_MODE')return 'EXTERNAL_AGENT_TOOL';
  if(def.enumValues?.length)return def.enumValues[0];
  if(def.valueType==='BOOLEAN')return true;
  if(def.valueType==='INTEGER')return 1;
  if(def.valueType==='NUMBER')return 1;
  if(def.valueType==='STRING_ARRAY'||def.valueType==='REFERENCE_ARRAY')return ['fixture'];
  if(def.valueType==='OBJECT')return {};
  const upper=String(name).toUpperCase();
  if(upper.includes('ARTIFACT_REQUIREMENTS'))return 'NONE';
  if(upper.includes('DETERMINATION'))return 'SATISFIED';
  if(upper.includes('INDEPENDENCE'))return 'INDEPENDENT';
  if(upper.includes('CONTAMINATION'))return 'NONE';
  if(upper.includes('SEVERITY'))return 'MINOR';
  if(upper.includes('STATUS'))return 'ACTIVE';
  if(upper.includes('APPLICABILITY'))return 'APPLICABLE';
  if(upper.includes('MANDATORY_OPTIONAL'))return 'MANDATORY';
  if(upper.includes('TEST_TYPE'))return 'DETERMINISTIC';
  if(upper.includes('EXPECTED_REJECTION'))return 'REJECT';
  if(upper.includes('ACTUAL_RESULT'))return 'SATISFIED';
  return `fixture-${String(name).toLowerCase()}`;
}
export function recordProposal(schema,collection,{tempKey,targetId,relationships={},overrides={},evidenceRef='evidence-1'}={}){
  const def=schema.RECORD_SCHEMAS[collection],fields={};
  for(const name of def.required){const fd=def.fieldDefinitions[name];if(fd?.producer===schema.PRODUCER.AGENT)fields[name]=scalarFor(fd,name,overrides);}
  for(const [name,value] of Object.entries(overrides))if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=value;
  return {tempKey:targetId?undefined:(tempKey||`${collection}-1`),targetId:targetId||undefined,fields,relationships,evidenceRefs:evidenceRef?[evidenceRef]:[]};
}
export function evidence(label='fixture'){return {temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:`${label} evidence`,authorityType:'CONTROLLED_TEST_EXECUTION',location:'verify-full-cycle.mjs',content:`controlled ${label} evidence`};}

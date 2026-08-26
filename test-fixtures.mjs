export const evidence=(key='evidence-1',content='controlled evidence')=>({temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Controlled lifecycle evidence',location:'verify-full-cycle.mjs',content:key==='evidence-1'?content:key});

export function envelope(schema,project,stage,promptRecord,{responseType='DATA_PROPOSAL',stageData={},records={},evidenceRecords=[evidence()],humanInputRequests=[],unresolved=[],warnings=[],attachments=[]}={}){
  return {schema:schema.RESPONSE_SCHEMA,jobId:project.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType,humanInputRequests,stageData,records,evidence:evidenceRecords,unresolved,warnings,attachments};
}

export const proposal=(tempKey,fields,relationships={},evidenceRefs=['evidence-1'])=>({tempKey,targetId:null,fields,relationships,evidenceRefs});
export const targetUpdate=(targetId,fields,evidenceRefs=['evidence-1'])=>({tempKey:null,targetId,fields,relationships:{},evidenceRefs});
export const refTemp=tempKey=>({tempKey});
export const refId=recordId=>({recordId});

export function scalarFor(def,name,overrides={}){
  if(Object.hasOwn(overrides,name))return overrides[name];
  if(def.enumValues?.length)return def.enumValues[0];
  if(def.valueType==='BOOLEAN')return true;
  if(def.valueType==='INTEGER'||def.valueType==='NUMBER')return 1;
  if(def.valueType==='STRING_ARRAY'||def.valueType==='REFERENCE_ARRAY')return ['fixture'];
  if(def.valueType==='OBJECT')return {};
  const upper=String(name).toUpperCase();
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
  const def=schema.RECORD_SCHEMAS[collection];
  if(!def)throw new Error(`Unknown fixture collection: ${collection}`);
  const fields={};
  for(const name of def.required){
    const fd=def.fieldDefinitions[name];
    if(fd?.producer===schema.PRODUCER.AGENT)fields[name]=scalarFor(fd,name,overrides);
  }
  for(const [name,value] of Object.entries(overrides))if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=value;
  return {tempKey:targetId?null:(tempKey||`${collection}-1`),targetId:targetId||null,fields,relationships,evidenceRefs:evidenceRef?[evidenceRef]:[]};
}

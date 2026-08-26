export function semanticValue(name,definition={}){
  if(definition.enumValues?.length)return definition.enumValues[0];
  switch(definition.valueType){
    case 'INTEGER': return 1;
    case 'NUMBER': return 1;
    case 'BOOLEAN': return false;
    case 'STRING_ARRAY': return ['fixture'];
    case 'REFERENCE_ARRAY': return ['fixture'];
    case 'OBJECT': return {fixture:true};
    case 'REFERENCE': return 'fixture';
  }
  if(/STATUS|STATE|DETERMINATION|RESULT/.test(name))return 'SATISFIED';
  return `fixture-${String(name).toLowerCase()}`;
}

export function agentFields(schema,collection,overrides={}){
  const def=schema.RECORD_SCHEMAS[collection],fields={};
  for(const name of def.required){const fd=def.fieldDefinitions[name];if(fd?.producer===schema.PRODUCER.AGENT)fields[name]=semanticValue(name,fd);}
  return {...fields,...overrides};
}

export function evidence(key='evidence-1',content='Controlled full-cycle evidence'){
  return {temporaryKey:key,kind:'WORKFLOW_EVIDENCE',description:'Controlled full-cycle verification evidence',location:'verify-full-cycle.mjs',content};
}

export function proposal(tempKey,fields,relationships={},evidenceRefs=['evidence-1']){
  return {tempKey,fields,relationships,evidenceRefs};
}
export function targetProposal(targetId,fields,relationships={},evidenceRefs=['evidence-1']){
  return {tempKey:null,targetId,fields,relationships,evidenceRefs};
}

export function envelope(schema,project,stage,promptRecord,{responseType='DATA_PROPOSAL',stageData={},records={},evidenceRecords=[evidence()],humanInputRequests=[],unresolved=[],warnings=[],attachments=[]}={}){
  return {schema:schema.RESPONSE_SCHEMA,jobId:project.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType,humanInputRequests,stageData,records,evidence:evidenceRecords,unresolved,warnings,attachments};
}

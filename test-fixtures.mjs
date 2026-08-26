export const evidence=(key='evidence-1',content='controlled evidence')=>({temporaryKey:key,kind:'WORKFLOW_EVIDENCE',description:'Controlled lifecycle evidence',location:'verify-full-cycle.mjs',content});
export function envelope(schema,project,stage,promptRecord,{responseType='DATA_PROPOSAL',stageData={},records={},evidenceRecords=[evidence()],humanInputRequests=[],unresolved=[],warnings=[],attachments=[]}={}){
  return {schema:schema.RESPONSE_SCHEMA,jobId:project.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType,humanInputRequests,stageData,records,evidence:evidenceRecords,unresolved,warnings,attachments};
}
export const proposal=(tempKey,fields,relationships={},evidenceRefs=['evidence-1'])=>({tempKey,targetId:null,fields,relationships,evidenceRefs});
export const targetUpdate=(targetId,fields,evidenceRefs=['evidence-1'])=>({tempKey:null,targetId,fields,relationships:{},evidenceRefs});
export const refTemp=tempKey=>({tempKey});
export const refId=recordId=>({recordId});
export function valueFor(definition,name='VALUE'){
  if(definition?.enumValues?.length)return definition.enumValues[0];
  switch(definition?.valueType){
    case 'INTEGER': return 1;
    case 'NUMBER': return 1;
    case 'BOOLEAN': return false;
    case 'STRING_ARRAY': case 'REFERENCE_ARRAY': return [`fixture-${String(name).toLowerCase()}`];
    case 'OBJECT': return {fixture:true};
    case 'REFERENCE': return `REF-${String(name).replace(/[^A-Z0-9]/gi,'-')}`;
    default:return `fixture-${String(name).toLowerCase()}`;
  }
}
export function agentFields(schema,collection,overrides={}){
  const definition=schema.RECORD_SCHEMAS[collection],fields={};if(!definition)throw new Error(`Unknown fixture collection ${collection}.`);
  for(const name of definition.required){const field=definition.fieldDefinitions[name];if(field?.producer===schema.PRODUCER.AGENT)fields[name]=valueFor(field,name);}
  return {...fields,...overrides};
}
export function stageAgentData(schema,stage,overrides={}){const data={};for(const name of schema.allowedAgentStageFields(stage)){const def=schema.STAGE_FIELDS[stage][name];data[name]=valueFor(def,name);}return {...data,...overrides};}
export function record(schema,collection,tempKey,overrides={},relationships={},evidenceRefs=['evidence-1']){return proposal(tempKey,agentFields(schema,collection,overrides),relationships,evidenceRefs);}
export const sourceRecord=(schema,key='source-1',overrides={},relationships={})=>record(schema,'sources',key,overrides,relationships);
export const requirementRecord=(schema,key='requirement-1',overrides={},relationships={})=>record(schema,'requirements',key,overrides,relationships);
export const testRecord=(schema,key='test-1',overrides={},relationships={})=>record(schema,'tests',key,overrides,relationships);
export const verificationRecord=(schema,key='verification-1',overrides={},relationships={})=>record(schema,'verification',key,overrides,relationships);
export const comparisonRecord=(schema,key='comparison-1',overrides={},relationships={})=>record(schema,'comparisons',key,overrides,relationships);
export const defectRecord=(schema,key='defect-1',overrides={},relationships={})=>record(schema,'defects',key,overrides,relationships);
export const rootCauseRecord=(schema,key='rca-1',overrides={},relationships={})=>record(schema,'rootCauses',key,overrides,relationships);
export const regressionRecord=(schema,key='regression-1',overrides={},relationships={})=>record(schema,'regressions',key,overrides,relationships);
export const changeRecord=(schema,key='change-1',overrides={},relationships={})=>record(schema,'changes',key,overrides,relationships);
export const auditRecord=(schema,collection,key='audit-1',overrides={},relationships={})=>record(schema,collection,key,overrides,relationships);
export const attachment=(temporaryKey,filename,mediaType,byteSize,sha256,required=true)=>({temporaryKey,filename,mediaType,byteSize,sha256,required});
export const runBatch=(slots)=>slots.map((slot,index)=>({index,...slot}));
export const releaseFile=(artifactId,name,size,sha256,storageReference=`indexeddb:${artifactId}`)=>({artifactId,name,size,sha256,storageReference,version:'APPLICATION-CONTROLLED'});

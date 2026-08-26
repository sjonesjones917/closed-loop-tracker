export const evidence=(key='evidence-1',content='controlled evidence')=>({temporaryKey:key,kind:'WORKFLOW_EVIDENCE',description:'Controlled lifecycle evidence',location:'verify-full-cycle.mjs',content});
export function envelope(schema,project,stage,promptRecord,{responseType='DATA_PROPOSAL',stageData={},records={},evidenceRecords=[evidence()],humanInputRequests=[],unresolved=[],warnings=[],attachments=[]}={}){
  return {schema:schema.RESPONSE_SCHEMA,jobId:project.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType,humanInputRequests,stageData,records,evidence:evidenceRecords,unresolved,warnings,attachments};
}
export const proposal=(tempKey,fields,relationships={},evidenceRefs=['evidence-1'])=>({tempKey,targetId:null,fields,relationships,evidenceRefs});
export const targetUpdate=(targetId,fields,evidenceRefs=['evidence-1'])=>({tempKey:null,targetId,fields,relationships:{},evidenceRefs});
export const refTemp=tempKey=>({tempKey});
export const refId=recordId=>({recordId});

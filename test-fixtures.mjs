export function evidenceFixture(stage,{temporaryKey=`e-${stage}`,kind='WORKFLOW_EVIDENCE',description=`Evidence for stage ${stage}`,location='controlled fixture',content=`controlled evidence ${stage}`}={}){
  return [{temporaryKey,kind,description,location,content}];
}

export function responseEnvelope({schema,jobId,stage,promptRecord,responseType='DATA_PROPOSAL',stageData={},records={},evidence=evidenceFixture(stage),humanInputRequests=[],unresolved=[],warnings=[],attachments=[]}){
  return {
    schema,jobId,stage,operation:promptRecord.operation,
    promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},
    scope:promptRecord.scope,responseType,humanInputRequests,stageData,records,evidence,unresolved,warnings,attachments
  };
}

export function humanQuestionEnvelope({schema,jobId,stage,promptRecord,question='What human-only fact is required?',whyRequired='The stage cannot reliably proceed without human authority.',answerType='TEXT',affectedStageFields=[],affectedRecords=[],allowedValues=[]}){
  return responseEnvelope({schema,jobId,stage,promptRecord,responseType:'HUMAN_INPUT_REQUIRED',stageData:{},records:{},evidence:[],humanInputRequests:[{temporaryKey:'question-1',question,whyRequired,affectedStageFields,affectedRecords,answerType,allowedValues,blocking:true}]});
}

export function proposedRecord({tempKey=null,targetId=null,fields={},relationships={},evidenceRefs=[],notes=''}){
  return {tempKey,targetId,fields,relationships,evidenceRefs,notes};
}

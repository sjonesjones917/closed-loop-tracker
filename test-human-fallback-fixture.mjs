// Independent Section 18 control population. This constructor consumes identities
// from an actual exported package; it never creates canonical project identities.
export const HUMAN_FALLBACK_CASES=Object.freeze([
 Object.freeze({key:'fallback-text',answerType:'TEXT',question:'What title should the inventory display?',whyRequired:'The display title is a human preference.',allowedValues:[],answer:'Field inventory'}),
 Object.freeze({key:'fallback-long-text',answerType:'LONG_TEXT',question:'What audience background should the inventory assume?',whyRequired:'The intended audience background is a human requirement.',allowedValues:[],answer:'New field technicians.\nUse plain language and explain abbreviations.'}),
 Object.freeze({key:'fallback-boolean',answerType:'BOOLEAN',question:'May the inventory include the organization logo?',whyRequired:'Only the human can grant this content permission.',allowedValues:[],answer:false}),
 Object.freeze({key:'fallback-number',answerType:'NUMBER',question:'How many printed copies are required?',whyRequired:'The required copy count is a human delivery requirement.',allowedValues:[],answer:2}),
 Object.freeze({key:'fallback-choice',answerType:'CHOICE',question:'Which delivery format do you authorize?',whyRequired:'The final delivery format is a human choice.',allowedValues:['PDF','PRINT'],answer:'PDF'}),
 Object.freeze({key:'fallback-multi-choice',answerType:'MULTI_CHOICE',question:'Which presentation options do you require?',whyRequired:'Presentation preferences require human selection.',allowedValues:['LARGE_PRINT','HIGH_CONTRAST','COLOR'],answer:['LARGE_PRINT','HIGH_CONTRAST']}),
 Object.freeze({key:'fallback-date',answerType:'DATE',question:'What calendar date is the delivery deadline?',whyRequired:'The delivery deadline must come from the human.',allowedValues:[],answer:'2026-10-15'}),
 Object.freeze({key:'fallback-file-reference',answerType:'FILE_REFERENCE',question:'Which already supplied file is your chosen visual reference?',whyRequired:'Selection of the human-preferred reference requires human authority.',allowedValues:[]})
]);
export function humanFallbackResponse(manifest){
 for(const name of ['jobId','operation','packageId','operationReservationId','challengeNonce'])if(typeof manifest?.[name]!=='string'||!manifest[name])throw new Error('FALLBACK_FIXTURE_IDENTITY_REQUIRED: '+name);
 if(manifest.stage!==1||manifest.operation!=='COMPLETE'||!manifest.promptIdentity||!manifest.scope)throw new Error('FALLBACK_FIXTURE_REQUIRES_ACTUAL_STAGE1_COMPLETE_PACKAGE');
 return {schema:'closed-loop-stage-response/3',contractProfileId:'closed-loop-completion-profile/1',jobId:manifest.jobId,stage:1,operation:manifest.operation,promptIdentity:structuredClone(manifest.promptIdentity),packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:structuredClone(manifest.scope),responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:HUMAN_FALLBACK_CASES.map(row=>({temporaryKey:row.key,question:row.question,whyRequired:row.whyRequired,affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],answerType:row.answerType,allowedValues:[...row.allowedValues],blocking:true})),humanAuthorityCandidates:[],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
}
export function humanFallbackAnswers(fileArtifactId){
 if(typeof fileArtifactId!=='string'||!fileArtifactId)throw new Error('FALLBACK_FIXTURE_ACTUAL_FILE_ID_REQUIRED');
 return Object.fromEntries(HUMAN_FALLBACK_CASES.map(row=>[row.key,row.answerType==='FILE_REFERENCE'?fileArtifactId:structuredClone(row.answer)]));
}

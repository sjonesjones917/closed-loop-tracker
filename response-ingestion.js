(()=>{
'use strict';

const core=globalThis.closedLoopCore;
const model=globalThis.closedLoopModel;
const workflow=globalThis.closedLoopWorkflow;
if(!core||!model||!workflow)throw new Error('The canonical workbook, ownership model, and workflow engine must load before response ingestion.');

const VERSION='2026-08-25-r1';
const TOP_LEVEL_KEYS=Object.freeze(['schema','jobId','stage','promptIdentity','responseType','humanInputRequests','stageData','records','evidence','unresolved','warnings','attachments']);
const REQUEST_KEYS=Object.freeze(['temporaryKey','question','whyRequired','affectedStageFields','affectedRecords','answerType','allowedValues','blocking']);
const EVIDENCE_KEYS=Object.freeze(['temporaryKey','evidenceType','description','sourceRefs','artifactRefs','exactExcerpt','location','supports']);
const ATTACHMENT_KEYS=Object.freeze(['temporaryKey','filename','mediaType','byteSize','sha256','availability','notes']);
const FORMAL_EMPTY=new Set(['UNKNOWN','NONE','NOT APPLICABLE','']);
const safe=value=>Array.isArray(value)?value:[];
const text=value=>String(value??'').trim();
const upper=value=>text(value).toUpperCase();
const clone=value=>JSON.parse(JSON.stringify(value));
const now=()=>new Date().toISOString();
const pointerEscape=value=>String(value).replaceAll('~','~0').replaceAll('/','~1');

function nextLocalId(project,key,prefix){
  workflow.ensureProjectData(project);
  const counters=project.projectData.idCounters;
  const value=Number(counters[key]||0)+1;counters[key]=value;
  return `${prefix}-${String(value).padStart(4,'0')}`;
}

function strictParse(raw){
  const source=String(raw??'');
  if(!source.trim())throw new Error('The returned response is empty.');
  const trimmed=source.trim();
  if(trimmed.startsWith('```')||trimmed.endsWith('```'))throw new Error('The response must be a bare JSON object, not a markdown code fence.');
  const value=JSON.parse(trimmed);
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('The response envelope must be one JSON object.');
  return value;
}

function projectFingerprintObject(project){
  const collections={};
  for(const name of Object.keys(model.RECORD_SCHEMAS))collections[name]=workflow.activeRecords(project,name);
  return {
    job:Object.fromEntries(Object.entries(project.job||{}).filter(([key])=>!['CURRENT_STATE','CURRENT_STAGE','NEXT_REQUIRED_ACTION','LATEST_EVIDENCE_REFERENCE','CURRENT_BLOCKERS'].includes(key))),
    userEntered:project.projectData?.userEntered||{},
    stageRecords:project.projectData?.stageRecords||{},
    collections,
    humanInputAnswers:project.projectData?.humanInputAnswers||[],
    promptIdentities:safe(project.projectData?.generatedPrompts).filter(record=>record.status==='CURRENT').map(record=>({stage:record.stage,instructionId:record.instructionId,payloadSha256:record.payloadSha256,status:record.status}))
  };
}
async function projectFingerprint(project){return core.sha256Text(JSON.stringify(projectFingerprintObject(project)));}

function currentPrompt(project,stage){return safe(project.projectData?.generatedPrompts).filter(record=>Number(record.stage)===Number(stage)&&record.status==='CURRENT').at(-1)||null;}
function promptMatches(record,identity){return record&&identity&&text(identity.instructionId)===text(record.instructionId)&&text(identity.sha256)===text(record.payloadSha256||record.promptIdentity?.sha256);}

function addIssue(result,code,message,path='',severity='ERROR'){result.issues.push({code,message,path,severity});if(severity==='ERROR')result.valid=false;}
function checkUnknownKeys(result,value,allowed,path){for(const key of Object.keys(value||{}))if(!allowed.includes(key))addIssue(result,'UNKNOWN_FIELD',`Unknown field ${key}.`,`${path}/${pointerEscape(key)}`);}
function validTempKey(value){return /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/.test(text(value));}
function valuesOfRelationship(value){if(Array.isArray(value))return value.map(text).filter(Boolean);return text(value).split(/\s*,\s*/).filter(Boolean);}

function existingRecordById(project,collection,id){
  if(!text(id)||FORMAL_EMPTY.has(upper(id)))return null;
  if(model.RECORD_SCHEMAS[collection])return workflow.findRecord(project,collection,id);
  return safe(project.projectData?.[collection]).find(record=>text(record.id||record.outputId||record.promptId||record.receiptId)===text(id));
}

function validateHumanRequests(result,envelope,contract,tempKeys){
  if(!Array.isArray(envelope.humanInputRequests))addIssue(result,'TYPE_ERROR','humanInputRequests must be an array.','/humanInputRequests');
  for(const [index,request] of safe(envelope.humanInputRequests).entries()){
    const path=`/humanInputRequests/${index}`;
    if(!request||typeof request!=='object'||Array.isArray(request)){addIssue(result,'TYPE_ERROR','Each human-input request must be an object.',path);continue;}
    checkUnknownKeys(result,request,REQUEST_KEYS,path);
    if(!validTempKey(request.temporaryKey))addIssue(result,'INVALID_TEMP_KEY','A valid temporaryKey is required.',`${path}/temporaryKey`);
    else if(tempKeys.has(request.temporaryKey))addIssue(result,'DUPLICATE_TEMP_KEY',`Duplicate temporary key ${request.temporaryKey}.`,`${path}/temporaryKey`);
    else tempKeys.set(request.temporaryKey,{type:'humanInputRequest',index});
    for(const key of ['question','whyRequired','answerType'])if(!text(request[key]))addIssue(result,'REQUIRED_FIELD',`${key} is required.`,`${path}/${key}`);
    if(!Array.isArray(request.affectedStageFields)||!Array.isArray(request.affectedRecords)||!Array.isArray(request.allowedValues))addIssue(result,'TYPE_ERROR','affectedStageFields, affectedRecords, and allowedValues must be arrays.',path);
    for(const field of safe(request.affectedStageFields))if(!Object.prototype.hasOwnProperty.call(model.stageFields(core.STAGES[contract.stage-1]),field))addIssue(result,'UNKNOWN_STAGE_FIELD',`Human-input request references unknown Stage ${contract.stage} field ${field}.`,`${path}/affectedStageFields`);
    for(const collection of safe(request.affectedRecords))if(!model.allowedCollections(contract.stage).includes(collection))addIssue(result,'UNKNOWN_COLLECTION',`Human-input request references collection ${collection} outside Stage ${contract.stage}.`,`${path}/affectedRecords`);
    if(!['TEXT','CHOICE','BOOLEAN','NUMBER','DATE','FILE_REFERENCE'].includes(upper(request.answerType)))addIssue(result,'INVALID_ANSWER_TYPE',`Unsupported answerType ${request.answerType}.`,`${path}/answerType`);
    if(upper(request.answerType)==='CHOICE'&&!request.allowedValues.length)addIssue(result,'MISSING_ALLOWED_VALUES','CHOICE requests require allowedValues.',`${path}/allowedValues`);
    if(typeof request.blocking!=='boolean')addIssue(result,'TYPE_ERROR','blocking must be true or false.',`${path}/blocking`);
  }
}

function validateEvidence(result,envelope,tempKeys){
  if(!Array.isArray(envelope.evidence))addIssue(result,'TYPE_ERROR','evidence must be an array.','/evidence');
  for(const [index,evidence] of safe(envelope.evidence).entries()){
    const path=`/evidence/${index}`;
    if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)){addIssue(result,'TYPE_ERROR','Each evidence entry must be an object.',path);continue;}
    checkUnknownKeys(result,evidence,EVIDENCE_KEYS,path);
    if(!validTempKey(evidence.temporaryKey))addIssue(result,'INVALID_TEMP_KEY','A valid evidence temporaryKey is required.',`${path}/temporaryKey`);
    else if(tempKeys.has(evidence.temporaryKey))addIssue(result,'DUPLICATE_TEMP_KEY',`Duplicate temporary key ${evidence.temporaryKey}.`,`${path}/temporaryKey`);
    else tempKeys.set(evidence.temporaryKey,{type:'evidence',index});
    for(const key of ['evidenceType','description','location'])if(!text(evidence[key]))addIssue(result,'REQUIRED_FIELD',`${key} is required.`,`${path}/${key}`);
    for(const key of ['sourceRefs','artifactRefs'])if(!Array.isArray(evidence[key]))addIssue(result,'TYPE_ERROR',`${key} must be an array.`,`${path}/${key}`);
    if(evidence.supports!==undefined&&!Array.isArray(evidence.supports))addIssue(result,'TYPE_ERROR','supports must be an array when present.',`${path}/supports`);
  }
}

function validateAttachments(result,envelope,tempKeys){
  if(!Array.isArray(envelope.attachments))addIssue(result,'TYPE_ERROR','attachments must be an array.','/attachments');
  for(const [index,attachment] of safe(envelope.attachments).entries()){
    const path=`/attachments/${index}`;
    if(!attachment||typeof attachment!=='object'||Array.isArray(attachment)){addIssue(result,'TYPE_ERROR','Each attachment entry must be an object.',path);continue;}
    checkUnknownKeys(result,attachment,ATTACHMENT_KEYS,path);
    if(!validTempKey(attachment.temporaryKey))addIssue(result,'INVALID_TEMP_KEY','A valid attachment temporaryKey is required.',`${path}/temporaryKey`);
    else if(tempKeys.has(attachment.temporaryKey))addIssue(result,'DUPLICATE_TEMP_KEY',`Duplicate temporary key ${attachment.temporaryKey}.`,`${path}/temporaryKey`);
    else tempKeys.set(attachment.temporaryKey,{type:'attachment',index});
    if(!text(attachment.filename))addIssue(result,'REQUIRED_FIELD','filename is required.',`${path}/filename`);
    if(text(attachment.sha256)&&!['BYTES PROVIDED','RETAINED BYTES'].includes(upper(attachment.availability)))addIssue(result,'UNVERIFIED_HASH','A response may not establish an attachment SHA-256 when actual bytes are not provided.',`${path}/sha256`);
  }
}

function validateStageData(result,envelope,stage,contract){
  if(!envelope.stageData||typeof envelope.stageData!=='object'||Array.isArray(envelope.stageData)){addIssue(result,'TYPE_ERROR','stageData must be an object.','/stageData');return;}
  const metadata=model.stageFields(stage),allowed=new Set(contract.stageDataFields);
  for(const [key,value] of Object.entries(envelope.stageData)){
    const path=`/stageData/${pointerEscape(key)}`;
    if(!metadata[key])addIssue(result,'UNKNOWN_STAGE_FIELD',`Unknown Stage ${stage.number} field ${key}.`,path);
    else if(!allowed.has(key))addIssue(result,'OWNERSHIP_VIOLATION',`The agent may not set ${key}; it is owned by ${metadata[key].producer}.`,path);
    else if(value===undefined)addIssue(result,'INVALID_VALUE',`${key} cannot be undefined.`,path);
  }
}

function recordSignature(collection,record,allowedFields){
  const normalized={};
  for(const field of allowedFields){if(['NOTES','EVIDENCE'].includes(field))continue;const value=record[field];if(value!==undefined)normalized[field]=typeof value==='string'?value.trim().toLowerCase():value;}
  return JSON.stringify(normalized);
}

function validateRecords(result,envelope,stage,contract,tempKeys){
  if(!envelope.records||typeof envelope.records!=='object'||Array.isArray(envelope.records)){addIssue(result,'TYPE_ERROR','records must be an object.','/records');return;}
  const allowedCollections=new Set(Object.keys(contract.collections)),recordLocations=new Map(),signatures=new Map();
  for(const [collection,records] of Object.entries(envelope.records)){
    const collectionPath=`/records/${pointerEscape(collection)}`;
    if(!allowedCollections.has(collection)){addIssue(result,'UNKNOWN_COLLECTION',`Collection ${collection} is not permitted at Stage ${stage.number}.`,collectionPath);continue;}
    if(!Array.isArray(records)){addIssue(result,'TYPE_ERROR',`${collection} must be an array.`,collectionPath);continue;}
    const definition=contract.collections[collection],schema=model.RECORD_SCHEMAS[collection],allowed=new Set(definition.allowedFields);
    for(const [index,record] of records.entries()){
      const path=`${collectionPath}/${index}`;
      if(!record||typeof record!=='object'||Array.isArray(record)){addIssue(result,'TYPE_ERROR','Each proposed record must be an object.',path);continue;}
      const allowedKeys=new Set(['tempKey','evidenceRefs',...definition.allowedFields]);
      for(const key of Object.keys(record)){
        if(!allowedKeys.has(key)){
          if(key===schema.id||schema.fieldMeta[key]?.producer===model.PRODUCERS.APPLICATION)addIssue(result,'OWNERSHIP_VIOLATION',`The agent may not set application-owned field ${key}.`,`${path}/${pointerEscape(key)}`);
          else addIssue(result,'UNKNOWN_RECORD_FIELD',`Unknown field ${key} for ${collection}.`,`${path}/${pointerEscape(key)}`);
        }
      }
      if(!validTempKey(record.tempKey))addIssue(result,'INVALID_TEMP_KEY','Every proposed record requires a valid response-local tempKey.',`${path}/tempKey`);
      else if(tempKeys.has(record.tempKey))addIssue(result,'DUPLICATE_TEMP_KEY',`Duplicate temporary key ${record.tempKey}.`,`${path}/tempKey`);
      else{tempKeys.set(record.tempKey,{type:'record',collection,index});recordLocations.set(record.tempKey,{collection,index,record});}
      if(!Array.isArray(record.evidenceRefs)||!record.evidenceRefs.length)addIssue(result,'MISSING_EVIDENCE','Every proposed canonical record requires at least one evidenceRef.',`${path}/evidenceRefs`);
      const signature=recordSignature(collection,record,definition.allowedFields);
      if(signature&&signature!=='{}'){
        const key=`${collection}|${signature}`;
        if(signatures.has(key))addIssue(result,'DUPLICATE_RECORD',`Duplicate ${collection} proposal matches ${signatures.get(key)}.`,path);
        else signatures.set(key,path);
        for(const existing of workflow.activeRecords(result.project,collection)){
          const existingValues=Object.fromEntries(definition.allowedFields.map(field=>[field,workflow.recordValue(existing,field)]));
          if(recordSignature(collection,existingValues,definition.allowedFields)===signature)addIssue(result,'DUPLICATE_RECORD',`The proposed ${collection} record duplicates existing canonical record ${workflow.canonicalId(existing,schema)}.`,path);
        }
      }
      if(collection==='sources'){
        const proposed={fields:record,...record};
        if(upper(record.SOURCE_CLASS)!=='EXTERNAL GOVERNING SOURCE')addIssue(result,'INVALID_SOURCE_CLASS','Stage 02 records must be classified as EXTERNAL GOVERNING SOURCE.',`${path}/SOURCE_CLASS`);
        if(upper(record.INDEPENDENT_EXTERNAL_AUTHORITY)!=='TRUE')addIssue(result,'NON_INDEPENDENT_SOURCE','Stage 02 requires affirmative independent external authority.',`${path}/INDEPENDENT_EXTERNAL_AUTHORITY`);
        if(upper(record.TARGET_PRODUCT_RELATIONSHIP)!=='INDEPENDENT EXTERNAL AUTHORITY')addIssue(result,'TARGET_PRODUCT_SOURCE_PROHIBITED','The target product, operating application, repository, and prior implementation cannot be a governing source.',`${path}/TARGET_PRODUCT_RELATIONSHIP`);
        if(!workflow.sourceIsIndependent(proposed))addIssue(result,'TARGET_PRODUCT_SOURCE_PROHIBITED','The proposed source is missing independent authority identity or refers to the current target/repository.',path);
      }
    }
  }
  return recordLocations;
}

function validateReferences(result,envelope,contract,tempKeys,recordLocations){
  const evidenceKeys=new Set([...tempKeys.entries()].filter(([,value])=>value.type==='evidence').map(([key])=>key));
  for(const [collection,records] of Object.entries(envelope.records||{})){
    if(!contract.collections[collection]||!Array.isArray(records))continue;
    const definition=contract.collections[collection];
    for(const [index,record] of records.entries()){
      const path=`/records/${pointerEscape(collection)}/${index}`;
      for(const evidenceRef of safe(record.evidenceRefs))if(!evidenceKeys.has(text(evidenceRef))&&!existingRecordById(result.project,'evidence',evidenceRef))addIssue(result,'INVALID_EVIDENCE_REFERENCE',`Evidence reference ${evidenceRef} does not resolve.`,`${path}/evidenceRefs`);
      for(const [field,targetCollection] of Object.entries(definition.relationships||{})){
        const raw=record[field];if(raw===undefined||raw===null||FORMAL_EMPTY.has(upper(raw)))continue;
        for(const reference of valuesOfRelationship(raw)){
          const local=recordLocations.get(reference);
          if(local&&local.collection!==targetCollection)addIssue(result,'INVALID_RELATIONSHIP',`${field} reference ${reference} resolves to ${local.collection}, not ${targetCollection}.`,`${path}/${pointerEscape(field)}`);
          else if(!local&&!existingRecordById(result.project,targetCollection,reference))addIssue(result,'MISSING_RELATIONSHIP',`${field} reference ${reference} does not resolve to an accepted ${targetCollection} record or response-local key.`,`${path}/${pointerEscape(field)}`);
        }
      }
    }
  }
  for(const [index,evidence] of safe(envelope.evidence).entries()){
    for(const reference of safe(evidence.sourceRefs))if(!existingRecordById(result.project,'sources',reference)&&!recordLocations.get(reference))addIssue(result,'INVALID_SOURCE_REFERENCE',`Evidence source reference ${reference} does not resolve.`,`/evidence/${index}/sourceRefs`);
    for(const reference of safe(evidence.artifactRefs))if(!existingRecordById(result.project,'artifacts',reference)&&!recordLocations.get(reference))addIssue(result,'INVALID_ARTIFACT_REFERENCE',`Evidence artifact reference ${reference} does not resolve.`,`/evidence/${index}/artifactRefs`);
  }
}

function validateResponseTypeRules(result,envelope){
  const type=envelope.responseType,stageCount=Object.keys(envelope.stageData||{}).length,recordCount=Object.values(envelope.records||{}).reduce((sum,value)=>sum+(Array.isArray(value)?value.length:0),0),questions=safe(envelope.humanInputRequests).length;
  if(type==='DATA_PROPOSAL'){
    if(questions) addIssue(result,'RESPONSE_TYPE_CONFLICT','DATA_PROPOSAL must not include humanInputRequests. Use HUMAN_INPUT_REQUIRED instead.','/responseType');
    if(stageCount+recordCount===0)addIssue(result,'EMPTY_PROPOSAL','DATA_PROPOSAL must propose at least one agent-owned stage value or record.','/responseType');
    if(!safe(envelope.evidence).length)addIssue(result,'MISSING_EVIDENCE','DATA_PROPOSAL requires evidence.','/evidence');
  }
  if(type==='HUMAN_INPUT_REQUIRED'){
    if(!questions)addIssue(result,'MISSING_HUMAN_REQUEST','HUMAN_INPUT_REQUIRED requires at least one humanInputRequest.','/humanInputRequests');
    if(stageCount||recordCount)addIssue(result,'RESPONSE_TYPE_CONFLICT','HUMAN_INPUT_REQUIRED must not propose canonical stageData or records.','/responseType');
  }
  if(type==='BLOCKED'&&stageCount)addIssue(result,'RESPONSE_TYPE_CONFLICT','BLOCKED must not propose stageData.','/stageData');
  if(type==='EXECUTION_FAILED'&&(stageCount||recordCount))addIssue(result,'RESPONSE_TYPE_CONFLICT','EXECUTION_FAILED must not propose canonical stageData or records.','/responseType');
}

function validateEnvelope(project,stageNumber,promptRecord,envelope,{duplicateRaw=false}={}){
  workflow.ensureProjectData(project);
  const stage=core.STAGES[stageNumber-1],contract=model.responseContract(stage),result={valid:true,issues:[],checks:[],project,stage:stageNumber,contract};
  checkUnknownKeys(result,envelope,TOP_LEVEL_KEYS,'');
  if(envelope.schema!==model.RESPONSE_SCHEMA)addIssue(result,'SCHEMA_MISMATCH',`schema must be ${model.RESPONSE_SCHEMA}.`,'/schema');
  if(text(envelope.jobId)!==text(project.job.JOB_ID))addIssue(result,'JOB_ID_MISMATCH',`Response JOB_ID ${envelope.jobId||'UNKNOWN'} does not match ${project.job.JOB_ID}.`,'/jobId');
  if(Number(envelope.stage)!==Number(stageNumber))addIssue(result,'STAGE_MISMATCH',`Response stage ${envelope.stage} does not match Stage ${stageNumber}.`,'/stage');
  if(!model.RESPONSE_TYPES.includes(envelope.responseType))addIssue(result,'INVALID_RESPONSE_TYPE',`responseType must be one of ${model.RESPONSE_TYPES.join(', ')}.`,'/responseType');
  if(!promptMatches(promptRecord,envelope.promptIdentity))addIssue(result,'STALE_PROMPT_IDENTITY','The response promptIdentity does not match the current saved instruction.','/promptIdentity');
  if(duplicateRaw)addIssue(result,'DUPLICATE_RESPONSE','This exact raw response was already recorded for the current prompt.','');
  const tempKeys=new Map();
  validateHumanRequests(result,envelope,contract,tempKeys);
  validateEvidence(result,envelope,tempKeys);
  validateAttachments(result,envelope,tempKeys);
  validateStageData(result,envelope,stage,contract);
  const recordLocations=validateRecords(result,envelope,stage,contract,tempKeys)||new Map();
  validateReferences(result,envelope,contract,tempKeys,recordLocations);
  validateResponseTypeRules(result,envelope);
  result.checks=[
    {name:'SCHEMA_VALIDATE',passed:!result.issues.some(issue=>['SCHEMA_MISMATCH','TYPE_ERROR','UNKNOWN_FIELD','UNKNOWN_RECORD_FIELD'].includes(issue.code))},
    {name:'IDENTITY_VALIDATE',passed:!result.issues.some(issue=>['JOB_ID_MISMATCH','STAGE_MISMATCH','STALE_PROMPT_IDENTITY','DUPLICATE_RESPONSE'].includes(issue.code))},
    {name:'OWNERSHIP_VALIDATE',passed:!result.issues.some(issue=>issue.code==='OWNERSHIP_VIOLATION')},
    {name:'STAGE_SCOPE_VALIDATE',passed:!result.issues.some(issue=>['UNKNOWN_COLLECTION','UNKNOWN_STAGE_FIELD'].includes(issue.code))},
    {name:'RELATIONSHIP_VALIDATE',passed:!result.issues.some(issue=>['INVALID_RELATIONSHIP','MISSING_RELATIONSHIP','INVALID_SOURCE_REFERENCE','INVALID_ARTIFACT_REFERENCE'].includes(issue.code))},
    {name:'EVIDENCE_VALIDATE',passed:!result.issues.some(issue=>['MISSING_EVIDENCE','INVALID_EVIDENCE_REFERENCE','UNVERIFIED_HASH'].includes(issue.code))},
    {name:'DUPLICATE_VALIDATE',passed:!result.issues.some(issue=>['DUPLICATE_TEMP_KEY','DUPLICATE_RECORD','DUPLICATE_RESPONSE'].includes(issue.code))}
  ];
  delete result.project;delete result.contract;
  return result;
}

function outputAndReceipt(project,stage,promptRecord,raw,rawSha256,rawResponseId,metadata={}){
  const outputId=`STAGE-${String(stage).padStart(2,'0')}-OUTPUT-${String(safe(project.projectData.generatedOutputs).filter(record=>Number(record.stage)===Number(stage)).length+1).padStart(3,'0')}`;
  const createdAt=now();
  const output={outputId,stage,role:core.STAGES[stage-1].role,iteration:project.job.CURRENT_ITERATION||'NOT APPLICABLE',createdAt,sha256:rawSha256,output:raw,rawResponseId,status:'RAW_RESPONSE'};
  project.projectData.generatedOutputs.push(output);
  const receiptId=`RECEIPT-${String(project.projectData.outputReceipts.length+1).padStart(5,'0')}`;
  const receipt={receiptId,jobId:project.job.JOB_ID,stage,role:core.STAGES[stage-1].role,contextId:metadata.contextId||'UNKNOWN',iteration:metadata.iteration||project.job.CURRENT_ITERATION||'NOT APPLICABLE',runId:metadata.runId||'NOT APPLICABLE',requestDateTime:promptRecord?.generatedAt||'UNKNOWN',responseDateTime:createdAt,inputIdentities:[project.job.CURRENT_INPUT_VERSION||'UNKNOWN'],relevantVersions:{sourceSet:project.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',requirements:project.job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE',tests:project.job.CURRENT_TEST_SUITE_VERSION||'NOT APPLICABLE',instruction:project.job.CURRENT_INSTRUCTION_VERSION||'NOT APPLICABLE'},promptIdentity:promptRecord?{instructionId:promptRecord.instructionId,sha256:promptRecord.payloadSha256}:null,completeSavedOutput:raw,outputArtifactIdentity:{outputId,sha256:rawSha256},files:metadata.files||[],completionState:'RAW_RESPONSE',truncation:'UNKNOWN',refusal:'UNKNOWN',toolFailures:'UNKNOWN',missingAttachments:'UNKNOWN',malformedOutput:'UNKNOWN',deviations:[],defectRefs:[],blockerRefs:[],nextRequiredVerificationStage:`STAGE ${String(stage).padStart(2,'0')} RESPONSE VALIDATION`,rawResponseId,parsedProposalId:null,validationResultId:null,acceptedChangeId:null,rejectedResponseId:null,extractionManifestId:null};
  project.projectData.outputReceipts.push(receipt);
  return {output,receipt};
}

async function previewPlan(project,envelope,stage,rawResponseId){
  const draft=clone(project);workflow.ensureProjectData(draft);
  const tempMap={},evidencePlan=[],recordPlan=[],questionPlan=[];
  for(const evidence of safe(envelope.evidence)){
    const id=workflow.allocateId(draft,'evidence');tempMap[evidence.temporaryKey]={collection:'evidence',canonicalId:id};evidencePlan.push({temporaryKey:evidence.temporaryKey,canonicalId:id,...clone(evidence)});
  }
  for(const [collection,records] of Object.entries(envelope.records||{}))for(const record of safe(records)){
    const id=workflow.allocateId(draft,collection);tempMap[record.tempKey]={collection,canonicalId:id};recordPlan.push({collection,temporaryKey:record.tempKey,canonicalId:id,fields:clone(record)});
  }
  for(const request of safe(envelope.humanInputRequests)){
    const id=nextLocalId(draft,'human-input-request','QUESTION');tempMap[request.temporaryKey]={collection:'humanInputRequests',canonicalId:id};questionPlan.push({temporaryKey:request.temporaryKey,canonicalId:id,...clone(request)});
  }
  const resolve=value=>{
    if(Array.isArray(value))return value.map(resolve);
    if(typeof value==='string'&&tempMap[value])return tempMap[value].canonicalId;
    return value;
  };
  for(const plan of recordPlan){
    const definition=model.RECORD_SCHEMAS[plan.collection];
    for(const field of Object.keys(definition.relationships||{}))if(plan.fields[field]!==undefined)plan.fields[field]=resolve(plan.fields[field]);
    plan.fields.evidenceRefs=safe(plan.fields.evidenceRefs).map(resolve);
  }
  return {stage,rawResponseId,tempMap,stageData:clone(envelope.stageData||{}),evidencePlan,recordPlan,questionPlan,unresolved:clone(envelope.unresolved||[]),warnings:clone(envelope.warnings||[]),attachments:clone(envelope.attachments||[])};
}

async function parseAndValidate(project,stage,raw,promptRecord=currentPrompt(project,stage),metadata={}){
  workflow.ensureProjectData(project);
  const rawSha256=await core.sha256Text(String(raw??'')),rawResponseId=nextLocalId(project,`raw-response-${stage}`,`RAW-S${String(stage).padStart(2,'0')}`),createdAt=now();
  const duplicate=project.projectData.rawResponses.find(record=>Number(record.stage)===Number(stage)&&record.promptInstructionId===promptRecord?.instructionId&&record.sha256===rawSha256);
  const rawRecord={rawResponseId,jobId:project.job.JOB_ID,stage,promptInstructionId:promptRecord?.instructionId||'UNKNOWN',promptSha256:promptRecord?.payloadSha256||'UNKNOWN',receivedAt:createdAt,raw:String(raw??''),sha256:rawSha256,status:'RAW_RESPONSE'};
  project.projectData.rawResponses.push(rawRecord);
  const {receipt}=outputAndReceipt(project,stage,promptRecord,String(raw??''),rawSha256,rawResponseId,metadata);
  let envelope,parseError=null;
  try{envelope=strictParse(raw);}catch(error){parseError=error;}
  const parsedProposalId=nextLocalId(project,`parsed-proposal-${stage}`,`PARSED-S${String(stage).padStart(2,'0')}`);
  const parsedRecord={parsedProposalId,rawResponseId,stage,parsedAt:now(),schema:envelope?.schema||'UNPARSEABLE',responseType:envelope?.responseType||'UNKNOWN',envelope:envelope?clone(envelope):null,parseError:parseError?String(parseError.message||parseError):null,status:parseError?'REJECTED_RESPONSE':'PARSED_PROPOSAL'};
  project.projectData.parsedProposals.push(parsedRecord);receipt.parsedProposalId=parsedProposalId;
  let validation;
  if(parseError)validation={valid:false,issues:[{code:'MALFORMED_JSON',message:parseError.message||String(parseError),path:'',severity:'ERROR'}],checks:[{name:'PARSE',passed:false}],stage};
  else validation=validateEnvelope(project,stage,promptRecord,envelope,{duplicateRaw:Boolean(duplicate)});
  const validationResultId=nextLocalId(project,`validation-result-${stage}`,`VALIDATION-S${String(stage).padStart(2,'0')}`);
  const validationRecord={validationResultId,rawResponseId,parsedProposalId,stage,validatedAt:now(),valid:validation.valid,issues:clone(validation.issues),checks:clone(validation.checks),status:'VALIDATION_RESULT'};
  project.projectData.validationResults.push(validationRecord);receipt.validationResultId=validationResultId;
  if(!validation.valid){
    const rejectedResponseId=nextLocalId(project,`rejected-response-${stage}`,`REJECTED-S${String(stage).padStart(2,'0')}`);
    const rejected={rejectedResponseId,rawResponseId,parsedProposalId,validationResultId,stage,rejectedAt:now(),reason:'PRECOMMIT_VALIDATION_FAILED',issues:clone(validation.issues),status:'REJECTED_RESPONSE'};
    project.projectData.rejectedResponses.push(rejected);receipt.rejectedResponseId=rejectedResponseId;receipt.completionState='REJECTED_RESPONSE';receipt.malformedOutput=parseError?'TRUE':'FALSE';rawRecord.status='REJECTED_RESPONSE';parsedRecord.status='REJECTED_RESPONSE';
    project.projectData.history.push({eventId:`EVENT-${Date.now()}`,createdAt:now(),stage,type:'RESPONSE_REJECTED',rawResponseId,validationResultId,rejectedResponseId});
    workflow.recalculateProject(project);
    return {valid:false,rawRecord,parsedRecord,validationRecord,rejected,receipt};
  }
  const proposalId=nextLocalId(project,`response-proposal-${stage}`,`PROPOSAL-S${String(stage).padStart(2,'0')}`),plan=await previewPlan(project,envelope,stage,rawResponseId);
  const proposal={proposalId,rawResponseId,parsedProposalId,validationResultId,stage,responseType:envelope.responseType,promptIdentity:clone(envelope.promptIdentity),baseFingerprint:'PENDING',createdAt:now(),status:'PENDING_REVIEW',plan,envelope:clone(envelope)};
  project.projectData.responseProposals.push(proposal);rawRecord.status='PARSED_PROPOSAL';parsedRecord.status='PARSED_PROPOSAL';receipt.completionState='PARSED_PROPOSAL';
  project.projectData.history.push({eventId:`EVENT-${Date.now()}`,createdAt:now(),stage,type:'RESPONSE_VALIDATED',rawResponseId,proposalId,validationResultId});
  workflow.recalculateProject(project);proposal.baseFingerprint=await projectFingerprint(project);
  return {valid:true,rawRecord,parsedRecord,validationRecord,proposal,receipt};
}

function resolvePlanValue(value,tempMap){
  if(Array.isArray(value))return value.map(item=>resolvePlanValue(item,tempMap));
  if(typeof value==='string'&&tempMap[value])return tempMap[value].canonicalId;
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,resolvePlanValue(item,tempMap)]));
  return value;
}

async function commitProposal(project,proposalId,{operator='Human operator'}={}){
  workflow.ensureProjectData(project);
  const proposal=project.projectData.responseProposals.find(record=>record.proposalId===proposalId);
  if(!proposal)throw new Error(`Proposal ${proposalId} was not found.`);
  if(proposal.status!=='PENDING_REVIEW')throw new Error(`Proposal ${proposalId} is ${proposal.status}, not pending review.`);
  const fingerprint=await projectFingerprint(project);
  if(fingerprint!==proposal.baseFingerprint)throw new Error('The project changed after validation. Re-parse the response against the current canonical state.');
  const promptRecord=currentPrompt(project,proposal.stage),revalidation=validateEnvelope(project,proposal.stage,promptRecord,proposal.envelope);
  if(!revalidation.valid)throw new Error(`Precommit revalidation failed: ${revalidation.issues.map(issue=>issue.message).join(' ')}`);
  const committedAt=now(),rawResponseId=proposal.rawResponseId,tempMap=proposal.plan.tempMap,manifestEntries=[];
  const rules=['SCHEMA_VALIDATE','IDENTITY_VALIDATE','OWNERSHIP_VALIDATE','STAGE_SCOPE_VALIDATE','RELATIONSHIP_VALIDATE','EVIDENCE_VALIDATE','DUPLICATE_VALIDATE'];
  const evidenceIdMap={};
  for(const evidence of proposal.plan.evidencePlan){
    const id=evidence.canonicalId,fields={EVIDENCE_ID:id,EVIDENCE_TYPE:evidence.evidenceType,DESCRIPTION:evidence.description,SOURCE_REFS:resolvePlanValue(evidence.sourceRefs,tempMap),ARTIFACT_REFS:resolvePlanValue(evidence.artifactRefs,tempMap),EXACT_EXCERPT:evidence.exactExcerpt,LOCATION:evidence.location,CREATED_AT:committedAt,RAW_RESPONSE_REF:rawResponseId};
    fields.SHA256=await core.sha256Text(JSON.stringify(fields));
    const record={id,stage:proposal.stage,createdAt:committedAt,fields,...fields,recordSha256:fields.SHA256};project.projectData.evidence.push(record);evidenceIdMap[evidence.temporaryKey]=id;
    manifestEntries.push({JSON_POINTER_IN_RESPONSE:`/evidence/${safe(proposal.envelope.evidence).findIndex(item=>item.temporaryKey===evidence.temporaryKey)}`,TEMPORARY_RESPONSE_KEY:evidence.temporaryKey,CANONICAL_RECORD_TYPE:'evidence',CANONICAL_RECORD_ID:id,CANONICAL_FIELD:'*',NORMALIZED_VALUE:clone(fields)});
  }
  const stageRecord=project.projectData.stageRecords[proposal.stage]=project.projectData.stageRecords[proposal.stage]||{stage:proposal.stage,fields:{}};
  stageRecord.fields=stageRecord.fields&&typeof stageRecord.fields==='object'?stageRecord.fields:{};
  for(const [field,value] of Object.entries(proposal.plan.stageData||{})){
    const normalized=resolvePlanValue(value,tempMap);stageRecord.fields[field]=normalized;
    if(proposal.stage===1&&model.JOB_FIELDS[field]?.producer===model.PRODUCERS.AGENT)project.job[field]=normalized;
    manifestEntries.push({JSON_POINTER_IN_RESPONSE:`/stageData/${pointerEscape(field)}`,TEMPORARY_RESPONSE_KEY:'NOT APPLICABLE',CANONICAL_RECORD_TYPE:'stageRecord',CANONICAL_RECORD_ID:`STAGE-${String(proposal.stage).padStart(2,'0')}`,CANONICAL_FIELD:field,NORMALIZED_VALUE:clone(normalized)});
  }
  for(const item of proposal.plan.recordPlan){
    const schema=model.RECORD_SCHEMAS[item.collection],fields={};
    fields[schema.id]=item.canonicalId;
    for(const field of schema.fields){if(field===schema.id)continue;if(item.fields[field]!==undefined)fields[field]=resolvePlanValue(item.fields[field],tempMap);}
    const evidenceRefs=safe(item.fields.evidenceRefs).map(reference=>evidenceIdMap[reference]||resolvePlanValue(reference,tempMap));
    fields.EVIDENCE_REFS=evidenceRefs;
    if(item.collection==='blockers'&&!fields.STATUS)fields.STATUS='OPEN';
    const record={id:item.canonicalId,stage:proposal.stage,createdAt:committedAt,rawResponseId,promptInstructionId:proposal.promptIdentity.instructionId,evidenceRefs,fields,...fields};
    record.recordSha256=await core.sha256Text(JSON.stringify(fields));project.projectData[item.collection].push(record);
    const sourceIndex=safe(proposal.envelope.records?.[item.collection]).findIndex(candidate=>candidate.tempKey===item.temporaryKey);
    for(const [field,value] of Object.entries(fields))manifestEntries.push({JSON_POINTER_IN_RESPONSE:field===schema.id?'APPLICATION_ASSIGNED':`/records/${pointerEscape(item.collection)}/${sourceIndex}/${pointerEscape(field)}`,TEMPORARY_RESPONSE_KEY:item.temporaryKey,CANONICAL_RECORD_TYPE:item.collection,CANONICAL_RECORD_ID:item.canonicalId,CANONICAL_FIELD:field,NORMALIZED_VALUE:clone(value)});
  }
  for(const item of proposal.plan.questionPlan){
    const request={requestId:item.canonicalId,id:item.canonicalId,stage:proposal.stage,temporaryKey:item.temporaryKey,question:item.question,whyRequired:item.whyRequired,affectedStageFields:clone(item.affectedStageFields),affectedRecords:clone(item.affectedRecords),answerType:item.answerType,allowedValues:clone(item.allowedValues),blocking:Boolean(item.blocking),status:'OPEN',createdAt:committedAt,rawResponseId,promptInstructionId:proposal.promptIdentity.instructionId};
    project.projectData.humanInputRequests.push(request);
    manifestEntries.push({JSON_POINTER_IN_RESPONSE:`/humanInputRequests/${safe(proposal.envelope.humanInputRequests).findIndex(candidate=>candidate.temporaryKey===item.temporaryKey)}`,TEMPORARY_RESPONSE_KEY:item.temporaryKey,CANONICAL_RECORD_TYPE:'humanInputRequests',CANONICAL_RECORD_ID:item.canonicalId,CANONICAL_FIELD:'*',NORMALIZED_VALUE:clone(request)});
  }
  if(proposal.responseType==='BLOCKED'&&!proposal.plan.recordPlan.some(item=>item.collection==='blockers')){
    const id=workflow.allocateId(project,'blockers'),fields={BLOCKER_ID:id,MISSING_ITEM:text(proposal.envelope.unresolved?.[0]?.description||proposal.envelope.unresolved?.[0]||'Required authority, evidence, capability, or decision is unavailable.'),WHY_WORK_CANNOT_CONTINUE:'The accepted BLOCKED response established that the current stage cannot continue.',STATUS:'OPEN',RESOLUTION_EVIDENCE:'UNKNOWN'};
    project.projectData.blockers.push({id,stage:proposal.stage,createdAt:committedAt,fields,...fields,rawResponseId});
  }
  if(proposal.responseType==='EXECUTION_FAILED'){
    const id=workflow.allocateId(project,'blockers'),fields={BLOCKER_ID:id,MISSING_ITEM:'Required execution capability or successful execution',WHY_WORK_CANNOT_CONTINUE:text(proposal.envelope.warnings?.join('\n'))||'The external execution failed.',STATUS:'OPEN',RESOLUTION_EVIDENCE:'UNKNOWN'};
    project.projectData.blockers.push({id,stage:proposal.stage,createdAt:committedAt,fields,...fields,rawResponseId});
  }
  if(proposal.responseType==='DATA_PROPOSAL'&&proposal.stage>=2&&proposal.stage<=8)workflow.nextVersion(project,proposal.stage);
  const acceptedChangeId=nextLocalId(project,`accepted-change-${proposal.stage}`,`ACCEPTED-S${String(proposal.stage).padStart(2,'0')}`);
  const priorAccepted=project.projectData.acceptedChanges.some(change=>Number(change.stage)===Number(proposal.stage)&&change.status==='ACCEPTED_CANONICAL_CHANGE');
  let invalidated=[];
  if(priorAccepted)invalidated=workflow.materialStageChange(project,proposal.stage,acceptedChangeId);
  const extractionManifestId=nextLocalId(project,`extraction-manifest-${proposal.stage}`,`MANIFEST-S${String(proposal.stage).padStart(2,'0')}`);
  const manifest={extractionManifestId,RAW_RESPONSE_ID:rawResponseId,PROMPT_ID:proposal.promptIdentity.instructionId,PROMPT_SHA256:proposal.promptIdentity.sha256,JOB_ID:project.job.JOB_ID,STAGE:proposal.stage,RESPONSE_SCHEMA_VERSION:model.RESPONSE_SCHEMA,VALIDATION_RULES_EXECUTED:rules,VALIDATION_RESULT:'VALID',COMMITTED_AT:committedAt,entries:manifestEntries.map(entry=>({RAW_RESPONSE_ID:rawResponseId,PROMPT_ID:proposal.promptIdentity.instructionId,PROMPT_SHA256:proposal.promptIdentity.sha256,JOB_ID:project.job.JOB_ID,STAGE:proposal.stage,RESPONSE_SCHEMA_VERSION:model.RESPONSE_SCHEMA,VALIDATION_RULES_EXECUTED:rules,VALIDATION_RESULT:'VALID',COMMITTED_AT:committedAt,...entry}))};
  project.projectData.extractionManifests.push(manifest);
  const change={acceptedChangeId,proposalId,rawResponseId,stage:proposal.stage,responseType:proposal.responseType,acceptedBy:operator,committedAt,status:'ACCEPTED_CANONICAL_CHANGE',canonicalRecordIds:proposal.plan.recordPlan.map(item=>item.canonicalId),evidenceIds:Object.values(evidenceIdMap),questionIds:proposal.plan.questionPlan.map(item=>item.canonicalId),extractionManifestId,downstreamInvalidated:invalidated};
  project.projectData.acceptedChanges.push(change);proposal.status='ACCEPTED_CANONICAL_CHANGE';proposal.acceptedChangeId=acceptedChangeId;proposal.extractionManifestId=extractionManifestId;
  const parsed=project.projectData.parsedProposals.find(record=>record.parsedProposalId===proposal.parsedProposalId);if(parsed)parsed.status='ACCEPTED_CANONICAL_CHANGE';
  const rawRecord=project.projectData.rawResponses.find(record=>record.rawResponseId===rawResponseId);if(rawRecord)rawRecord.status='ACCEPTED_CANONICAL_CHANGE';
  const receipt=project.projectData.outputReceipts.find(record=>record.rawResponseId===rawResponseId);if(receipt){receipt.acceptedChangeId=acceptedChangeId;receipt.extractionManifestId=extractionManifestId;receipt.completionState='ACCEPTED_CANONICAL_CHANGE';receipt.nextRequiredVerificationStage=`STAGE ${String(proposal.stage).padStart(2,'0')} CANONICAL GATE`;}
  project.projectData.history.push({eventId:`EVENT-${Date.now()}`,createdAt:committedAt,stage:proposal.stage,type:'RESPONSE_ACCEPTED',proposalId,acceptedChangeId,extractionManifestId,canonicalRecordIds:change.canonicalRecordIds,downstreamInvalidated:invalidated});
  project.stages[proposal.stage].acceptedData=clone(stageRecord.fields);
  workflow.recalculateProject(project);
  stageRecord.derivedFields=clone(project.stages[proposal.stage].derivedFields||{});stageRecord.status=project.stages[proposal.stage].status;stageRecord.rawResponseId=rawResponseId;stageRecord.acceptedChangeId=acceptedChangeId;stageRecord.extractionManifestId=extractionManifestId;
  return {change,manifest,project};
}

function rejectProposal(project,proposalId,reason='Operator rejected the proposed canonical changes.',operator='Human operator'){
  workflow.ensureProjectData(project);
  const proposal=project.projectData.responseProposals.find(record=>record.proposalId===proposalId);
  if(!proposal)throw new Error(`Proposal ${proposalId} was not found.`);
  if(proposal.status!=='PENDING_REVIEW')throw new Error(`Proposal ${proposalId} is ${proposal.status}, not pending review.`);
  const rejectedResponseId=nextLocalId(project,`rejected-response-${proposal.stage}`,`REJECTED-S${String(proposal.stage).padStart(2,'0')}`),rejected={rejectedResponseId,proposalId,rawResponseId:proposal.rawResponseId,stage:proposal.stage,rejectedAt:now(),rejectedBy:operator,reason,status:'REJECTED_RESPONSE'};
  project.projectData.rejectedResponses.push(rejected);proposal.status='REJECTED_RESPONSE';proposal.rejectedResponseId=rejectedResponseId;
  const raw=project.projectData.rawResponses.find(record=>record.rawResponseId===proposal.rawResponseId);if(raw)raw.status='REJECTED_RESPONSE';
  const receipt=project.projectData.outputReceipts.find(record=>record.rawResponseId===proposal.rawResponseId);if(receipt){receipt.rejectedResponseId=rejectedResponseId;receipt.completionState='REJECTED_RESPONSE';}
  project.projectData.history.push({eventId:`EVENT-${Date.now()}`,createdAt:now(),stage:proposal.stage,type:'PROPOSAL_REJECTED',proposalId,rejectedResponseId,reason});
  workflow.recalculateProject(project);return rejected;
}

function correctionRequest(project,proposalId,reason,operator='Human operator'){
  const rejected=rejectProposal(project,proposalId,reason||'Correction requested.',operator);
  rejected.correctionRequested=true;
  const proposal=project.projectData.responseProposals.find(record=>record.proposalId===proposalId),prompt=currentPrompt(project,proposal.stage);
  rejected.correctionInstruction=`Return a corrected ${model.RESPONSE_SCHEMA} envelope for JOB_ID ${project.job.JOB_ID}, Stage ${proposal.stage}, prompt ${prompt?.instructionId||'UNKNOWN'} / ${prompt?.payloadSha256||'UNKNOWN'}. Correction required: ${reason||'Resolve the validation or operator-review findings.'} Preserve the same strict ownership, evidence, and non-circular authority rules.`;
  return rejected;
}

const api={version:VERSION,TOP_LEVEL_KEYS,strictParse,projectFingerprint,currentPrompt,validateEnvelope,parseAndValidate,commitProposal,rejectProposal,correctionRequest,projectFingerprintObject};
globalThis.closedLoopIngestion=Object.freeze(api);
dispatchEvent(new Event('closed-loop-ingestion-ready'));
})();

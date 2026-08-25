(()=>{
'use strict';

const schema=globalThis.closedLoopWorkflowSchema;
const workflow=globalThis.closedLoopWorkflowEngine;
const hash=globalThis.closedLoopHash;
if(!schema||!workflow||!hash)throw new Error('workflow-schema.js, workflow-engine.js, and hash.js must load before response-ingestion.js.');

const TOP_LEVEL_KEYS=Object.freeze(['schema','jobId','stage','operation','promptIdentity','scope','responseType','humanInputRequests','stageData','records','evidence','unresolved','warnings','attachments']);
const RECORD_KEYS=Object.freeze(['tempKey','targetId','fields','relationships','evidenceRefs','notes']);
const EVIDENCE_KEYS=Object.freeze(['temporaryKey','kind','description','authorityType','sourceRef','location','content','attachmentRef','notes']);
const QUESTION_KEYS=Object.freeze(['temporaryKey','question','whyRequired','affectedStageFields','affectedRecords','answerType','allowedValues','blocking']);
const ATTACHMENT_KEYS=Object.freeze(['temporaryKey','filename','mediaType','byteSize','sha256','required']);
const UNRESOLVED_KEYS=Object.freeze(['temporaryKey','kind','description','whyBlocking','affectedStageFields','affectedRecords','blocking']);
const WARNING_KEYS=Object.freeze(['code','message','path']);
const UNRESOLVED_KINDS=Object.freeze(['MISSING_HUMAN_INPUT','MISSING_AUTHORITY','MISSING_EVIDENCE','MISSING_CAPABILITY','MISSING_ARTIFACT','UNRESOLVED_CONFLICT','EXECUTION_FAILURE','TOOL_FAILURE','UNKNOWN']);
const ANSWER_TYPES=Object.freeze(['TEXT','LONG_TEXT','BOOLEAN','NUMBER','CHOICE','MULTI_CHOICE','DATE','FILE_REFERENCE']);

const clone=workflow.clone;
const now=workflow.now;
const safe=workflow.safe;
const upper=workflow.upper;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const pointerEscape=value=>String(value).replaceAll('~','~0').replaceAll('/','~1');
const issue=(code,path,message,severity='ERROR')=>({code,path,message,severity});
const unknownKeys=(value,allowed,path,issues)=>{
  if(!object(value))return;
  for(const key of Object.keys(value))if(!allowed.includes(key))issues.push(issue('UNKNOWN_PROPERTY',`${path}/${pointerEscape(key)}`,`Unknown property ${key}.`));
};


const byteLength=text=>new TextEncoder().encode(String(text??'')).byteLength;
function scanJsonAmbiguity(raw,maxDepth){let i=0,depth=0;const stack=[];const ws=()=>{while(/\s/.test(raw[i]||''))i++;};const str=()=>{let out='';if(raw[i++]!=='"')throw new Error('Expected string.');while(i<raw.length){const c=raw[i++];if(c==='"')return out;if(c==='\\'){const e=raw[i++];if(e==='u'){out+=String.fromCharCode(parseInt(raw.slice(i,i+4),16));i+=4;}else out+=({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f'}[e]??e);}else out+=c;}throw new Error('Unterminated string.');};const value=()=>{ws();const c=raw[i];if(c==='{')return obj();if(c==='[')return arr();if(c==='"'){str();return;}const m=raw.slice(i).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);if(!m)throw new Error('Invalid JSON token.');i+=m[0].length;};const obj=()=>{depth++;if(depth>maxDepth){const e=new Error('JSON nesting exceeds the stage resource limit.');e.code='EXCESSIVE_JSON_DEPTH';throw e;}i++;const keys=new Set();ws();if(raw[i]==='}'){i++;depth--;return;}while(i<raw.length){ws();const key=str();if(keys.has(key)){const e=new Error(`Duplicate JSON member ${key}.`);e.code='DUPLICATE_JSON_MEMBER';throw e;}keys.add(key);ws();if(raw[i++]!==':')throw new Error('Expected colon.');value();ws();if(raw[i]==='}'){i++;depth--;return;}if(raw[i++]!==',')throw new Error('Expected comma.');}throw new Error('Unterminated object.');};const arr=()=>{depth++;if(depth>maxDepth){const e=new Error('JSON nesting exceeds the stage resource limit.');e.code='EXCESSIVE_JSON_DEPTH';throw e;}i++;ws();if(raw[i]===']'){i++;depth--;return;}while(i<raw.length){value();ws();if(raw[i]===']'){i++;depth--;return;}if(raw[i++]!==',')throw new Error('Expected comma.');}throw new Error('Unterminated array.');};value();ws();if(i!==raw.length)throw new Error('Trailing material.');}
function validateValue(definition,value,path,issues,{required=false}={}){if(value===null){if(!definition.nullable)issues.push(issue('PROHIBITED_NULL',path,'Null is not permitted.'));return;}const t=definition.valueType;const emptyString=typeof value==='string'&&!value.trim();if(required&&emptyString)issues.push(issue('EMPTY_REQUIRED_STRING',path,'Required string is empty.'));if(typeof value==='string'&&value.trim()==='<value>')issues.push(issue('PLACEHOLDER_VALUE',path,'Prompt placeholder <value> cannot be accepted as data.'));if(t==='STRING'&&typeof value!=='string')issues.push(issue('WRONG_VALUE_TYPE',path,'Expected STRING.'));else if(t==='INTEGER'&&(!Number.isInteger(value)||!Number.isFinite(value)))issues.push(issue('WRONG_VALUE_TYPE',path,'Expected finite INTEGER.'));else if(t==='NUMBER'&&(typeof value!=='number'||!Number.isFinite(value)))issues.push(issue('WRONG_VALUE_TYPE',path,'Expected finite NUMBER.'));else if(t==='BOOLEAN'&&typeof value!=='boolean')issues.push(issue('WRONG_VALUE_TYPE',path,'Expected BOOLEAN.'));else if((t==='STRING_ARRAY'||t==='REFERENCE_ARRAY')&&!Array.isArray(value))issues.push(issue('WRONG_VALUE_TYPE',path,`Expected ${t}.`));else if(t==='STRING_ARRAY'&&Array.isArray(value)&&value.some(v=>typeof v!=='string'))issues.push(issue('WRONG_VALUE_TYPE',path,'STRING_ARRAY items must be strings.'));else if(t==='OBJECT'&&!object(value))issues.push(issue('WRONG_VALUE_TYPE',path,'Expected OBJECT.'));if(required&&Array.isArray(value)&&!value.length)issues.push(issue('EMPTY_REQUIRED_ARRAY',path,'Required array is empty.'));if(definition.enumValues?.length&&!definition.enumValues.includes(value))issues.push(issue('INVALID_ENUM_VALUE',path,`Value must be one of ${definition.enumValues.join(', ')}.`));if(typeof value==='string'&&value.length>200000)issues.push(issue('TEXT_FIELD_TOO_LARGE',path,'Text field exceeds the configured maximum length.'));if(t==='OBJECT'&&object(value)&&definition.closedProperties)for(const key of Object.keys(value))if(!definition.closedProperties.includes(key))issues.push(issue('UNKNOWN_NESTED_PROPERTY',`${path}/${pointerEscape(key)}`,`Unknown nested property ${key}.`));}
function currentScope(project,promptRecord){return clone(promptRecord?.scope||{});}

function strictParse(text,{limits=schema.DEFAULT_RESOURCE_LIMITS}={}){
  const raw=String(text??'');
  const trimmed=raw.trim();
  if(!trimmed)throw Object.assign(new Error('Returned output is empty.'),{code:'EMPTY_RESPONSE'});
  if(byteLength(raw)>limits.maxRawResponseBytes)throw Object.assign(new Error('Returned output exceeds the stage byte limit.'),{code:'OVERSIZED_RESPONSE'});
  try{scanJsonAmbiguity(trimmed,limits.maxJsonDepth);}catch(error){if(error.code)throw error;}
  if(trimmed.startsWith('```')||trimmed.endsWith('```'))throw Object.assign(new Error('The response must be one JSON object without a Markdown code fence.'),{code:'NON_JSON_WRAPPER'});
  let envelope;
  try{envelope=JSON.parse(trimmed);}catch(error){
    const likelyTruncated=!trimmed.endsWith('}')||((trimmed.match(/{/g)||[]).length!==(trimmed.match(/}/g)||[]).length);
    throw Object.assign(new Error(`Response JSON could not be parsed: ${error.message}`),{code:likelyTruncated?'TRUNCATED_RESPONSE':'MALFORMED_JSON',cause:error});
  }
  if(!object(envelope))throw Object.assign(new Error('The response root must be one JSON object.'),{code:'INVALID_ROOT'});
  if(JSON.stringify(envelope)!==trimmed){
    // Whitespace is permitted, but trailing or leading non-JSON material is not. JSON.parse would already reject trailing material.
  }
  return envelope;
}

function promptRecordFor(project,prompt){
  if(!prompt)return null;
  const id=prompt.instructionId||prompt.promptId;
  return safe(project?.projectData?.generatedPrompts).find(record=>(record.instructionId||record.promptId)===id)||prompt;
}

function validateEnvelope(project,envelope,{stage,promptRecord,rawSha256}={}){
  workflow.ensureShape(project);
  const issues=[];
  const stageNumber=Number(stage);
  const contract=schema.STAGE_CONTRACTS[stageNumber];
  if(!contract)issues.push(issue('INVALID_STAGE','/stage',`Stage ${stage} is outside the 30-stage workflow.`));
  unknownKeys(envelope,TOP_LEVEL_KEYS,'',issues);
  if(envelope.schema!==schema.RESPONSE_SCHEMA)issues.push(issue('WRONG_SCHEMA','/schema',`Expected ${schema.RESPONSE_SCHEMA}.`));
  if(String(envelope.jobId||'')!==String(project.job.JOB_ID||''))issues.push(issue('WRONG_JOB_ID','/jobId',`Response JOB_ID ${envelope.jobId||'MISSING'} does not match ${project.job.JOB_ID}.`));
  if(Number(envelope.stage)!==stageNumber)issues.push(issue('WRONG_STAGE','/stage',`Response stage ${envelope.stage??'MISSING'} does not match Stage ${stageNumber}.`));
  const expectedOperation=promptRecord?.operation||contract?.operations?.[0];if(String(envelope.operation||'')!==String(expectedOperation||''))issues.push(issue('WRONG_OPERATION','/operation',`Expected operation ${expectedOperation||'UNKNOWN'}.`));
  if(!object(envelope.scope))issues.push(issue('INVALID_SCOPE','/scope','scope must be an object.'));else{unknownKeys(envelope.scope,['projectRevision','inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','runId','contextId','baselineId','productId'],'/scope',issues);const expected=currentScope(project,promptRecord);for(const key of contract?.scopeRequirements||[])if(JSON.stringify(envelope.scope[key]??null)!==JSON.stringify(expected[key]??null))issues.push(issue('STALE_SCOPE',`/scope/${key}`,`Scope ${key} does not match the controlling prompt.`));}
  if(!schema.RESPONSE_TYPES.includes(envelope.responseType))issues.push(issue('INVALID_RESPONSE_TYPE','/responseType',`Response type must be one of ${schema.RESPONSE_TYPES.join(', ')}.`));

  if(!object(envelope.promptIdentity))issues.push(issue('MISSING_PROMPT_IDENTITY','/promptIdentity','promptIdentity must be an object.'));
  else{
    unknownKeys(envelope.promptIdentity,['instructionId','bodySha256','contractSha256','contextSignature'],'/promptIdentity',issues);
    const expectedId=promptRecord?.instructionId||promptRecord?.promptId;
    const expectedHash=promptRecord?.bodySha256||promptRecord?.sha256;
    const expectedContractHash=promptRecord?.contractSha256;const expectedContextSignature=promptRecord?.contextSignature;
    if(!expectedId||!expectedHash||!expectedContractHash||!expectedContextSignature)issues.push(issue('PROMPT_NOT_SAVED','/promptIdentity','The controlling generated instruction is unavailable or has no canonical identity.'));
    if(String(envelope.promptIdentity.instructionId||'')!==String(expectedId||''))issues.push(issue('STALE_PROMPT_IDENTITY','/promptIdentity/instructionId',`Expected instruction ${expectedId||'UNKNOWN'}.`));
    if(String(envelope.promptIdentity.bodySha256||'')!==String(expectedHash||''))issues.push(issue('STALE_PROMPT_HASH','/promptIdentity/bodySha256',`Expected body SHA-256 ${expectedHash||'UNKNOWN'}.`));
    if(String(envelope.promptIdentity.contractSha256||'')!==String(expectedContractHash||''))issues.push(issue('STALE_CONTRACT_HASH','/promptIdentity/contractSha256',`Expected contract SHA-256 ${expectedContractHash||'UNKNOWN'}.`));
    if(String(envelope.promptIdentity.contextSignature||'')!==String(expectedContextSignature||''))issues.push(issue('STALE_CONTEXT_SIGNATURE','/promptIdentity/contextSignature',`Expected context signature ${expectedContextSignature||'UNKNOWN'}.`));
    const latest=safe(project.projectData.generatedPrompts).filter(record=>Number(record.stage)===stageNumber&&!record.invalidatedBy).at(-1);
    if(latest&&String(latest.instructionId||latest.promptId)!==String(expectedId||''))issues.push(issue('STALE_PROMPT_IDENTITY','/promptIdentity/instructionId','A newer generated instruction exists for this stage.'));
  }

  if(!object(envelope.stageData))issues.push(issue('INVALID_STAGE_DATA','/stageData','stageData must be an object.'));
  if(!object(envelope.records))issues.push(issue('INVALID_RECORDS','/records','records must be an object.'));
  for(const key of ['humanInputRequests','evidence','unresolved','warnings','attachments'])if(!Array.isArray(envelope[key]))issues.push(issue('INVALID_ARRAY',`/${key}`,`${key} must be an array.`));

  const seenTemporaryKeys=new Map();
  const registerTemp=(key,path,type)=>{
    const value=String(key||'').trim();
    if(!value){issues.push(issue('MISSING_TEMPORARY_KEY',path,'A response-local temporary key is required.'));return '';}
    if(!/^[A-Za-z][A-Za-z0-9._:-]{0,119}$/.test(value))issues.push(issue('INVALID_TEMPORARY_KEY',path,'Temporary keys must begin with a letter and contain only letters, digits, dot, underscore, colon, or hyphen.'));
    if(seenTemporaryKeys.has(value))issues.push(issue('DUPLICATE_TEMPORARY_KEY',path,`Temporary key ${value} is already used at ${seenTemporaryKeys.get(value)}.`));
    else seenTemporaryKeys.set(value,`${type}:${path}`);
    return value;
  };

  const allowedStageData=new Set(contract?.allowedStageData||[]);
  if(object(envelope.stageData)){
    for(const [name,value] of Object.entries(envelope.stageData)){
      const path=`/stageData/${pointerEscape(name)}`;
      const definition=schema.STAGE_FIELDS[stageNumber]?.[name];
      if(!definition){issues.push(issue('UNKNOWN_STAGE_FIELD',path,`Stage ${stageNumber} has no field ${name}.`));continue;}
      validateValue(definition,value,path,issues);
      if(!allowedStageData.has(name))issues.push(issue('FIELD_OWNERSHIP_VIOLATION',path,`${name} is owned by ${definition.producer}, not the external agent.`));
      if(value===undefined)issues.push(issue('UNDEFINED_VALUE',path,'Undefined values cannot be ingested.'));
    }
  }

  const allowedCollections=new Set(contract?.agentWritableCollections||contract?.allowedCollections||[]);
  for(const [collection,list] of Object.entries(envelope.records||{}))if(Array.isArray(list)&&list.length>(contract?.resourceLimits?.maxRecordsPerCollection||250))issues.push(issue('RESOURCE_LIMIT_EXCEEDED',`/records/${pointerEscape(collection)}`,'Too many records in collection.'));
  if(safe(envelope.evidence).length>(contract?.resourceLimits?.maxEvidenceRecords||500))issues.push(issue('RESOURCE_LIMIT_EXCEEDED','/evidence','Too many evidence records.'));if(safe(envelope.attachments).length>(contract?.resourceLimits?.maxAttachments||25))issues.push(issue('RESOURCE_LIMIT_EXCEEDED','/attachments','Too many attachments.'));
  const responseRecordIndex=new Map();
  if(object(envelope.records)){
    for(const [collection,list] of Object.entries(envelope.records)){
      const collectionPath=`/records/${pointerEscape(collection)}`;
      const definition=schema.RECORD_SCHEMAS[collection];
      if(!definition){issues.push(issue('UNKNOWN_COLLECTION',collectionPath,`Unknown canonical collection ${collection}.`));continue;}
      if(!allowedCollections.has(collection))issues.push(issue('STAGE_SCOPE_VIOLATION',collectionPath,`${collection} is not writable from Stage ${stageNumber}.`));
      if(!Array.isArray(list)){issues.push(issue('INVALID_COLLECTION_VALUE',collectionPath,`${collection} must be an array.`));continue;}
      list.forEach((record,index)=>{
        const path=`${collectionPath}/${index}`;
        if(!object(record)){issues.push(issue('INVALID_RECORD',path,'Each record proposal must be an object.'));return;}
        unknownKeys(record,RECORD_KEYS,path,issues);
        const identityCount=Number(Boolean(record.tempKey))+Number(Boolean(record.targetId));if(identityCount!==1)issues.push(issue('INVALID_RECORD_IDENTITY',path,'Provide exactly one of tempKey or targetId.'));
        let tempKey='';if(record.tempKey){tempKey=registerTemp(record.tempKey,`${path}/tempKey`,collection);if(tempKey)responseRecordIndex.set(tempKey,{collection,record,path});}
        if(record.targetId){const target=workflow.records(project,collection,{active:true}).find(existing=>workflow.recordId(existing,collection)===String(record.targetId));if(!target)issues.push(issue('INVALID_RESERVED_TARGET',`${path}/targetId`,`Target ${record.targetId} does not exist as an active ${collection} record.`));else if(!['RESERVED','PENDING_AGENT','OPEN'].includes(upper(workflow.recordValue(target,'STATUS')||target.status||'RESERVED')))issues.push(issue('INVALID_RESERVED_TARGET',`${path}/targetId`,'Target record is not in an agent-completable reserved state.'));}
        if(!object(record.fields)){issues.push(issue('INVALID_RECORD_FIELDS',`${path}/fields`,'fields must be an object.'));return;}
        if(record.relationships!==undefined&&!object(record.relationships))issues.push(issue('INVALID_RELATIONSHIPS',`${path}/relationships`,'relationships must be an object.'));
        if(record.evidenceRefs!==undefined&&!Array.isArray(record.evidenceRefs))issues.push(issue('INVALID_EVIDENCE_REFS',`${path}/evidenceRefs`,'evidenceRefs must be an array.'));
        const allowedFields=new Set(schema.recordAgentFields(collection));
        for(const [name,value] of Object.entries(record.fields)){
          const fieldPath=`${path}/fields/${pointerEscape(name)}`;
          const fieldDefinition=definition.fieldDefinitions[name];
          if(!fieldDefinition){issues.push(issue('UNKNOWN_RECORD_FIELD',fieldPath,`${collection} has no field ${name}.`));continue;}
          validateValue(fieldDefinition,value,fieldPath,issues,{required:definition.required.includes(name)});
          if(!allowedFields.has(name))issues.push(issue('FIELD_OWNERSHIP_VIOLATION',fieldPath,`${name} is owned by ${fieldDefinition.producer}; the agent cannot set it.`));
          if(value===undefined)issues.push(issue('UNDEFINED_VALUE',fieldPath,'Undefined values cannot be ingested.'));
        }
        for(const required of definition.required){
          const def=definition.fieldDefinitions[required];
          if(def?.producer!==schema.PRODUCER.AGENT)continue;
          const value=record.fields[required];
          if(value===undefined||value===null||(typeof value==='string'&&!value.trim())||(Array.isArray(value)&&!value.length))issues.push(issue('MISSING_REQUIRED_FIELD',`${path}/fields/${pointerEscape(required)}`,`${required} is required.`));
        }
        if(object(record.relationships)){
          for(const [name,reference] of Object.entries(record.relationships)){
            const relationPath=`${path}/relationships/${pointerEscape(name)}`;
            const expectedCollection=definition.relationships[name];
            if(!expectedCollection){issues.push(issue('UNKNOWN_RELATIONSHIP',relationPath,`${name} is not a relationship field for ${collection}.`));continue;}
            if(!object(reference)){issues.push(issue('INVALID_RELATIONSHIP_REFERENCE',relationPath,'Relationship reference must be an object.'));continue;}
            unknownKeys(reference,['tempKey','recordId'],relationPath,issues);
            const count=Number(Boolean(reference.tempKey))+Number(Boolean(reference.recordId));
            if(count!==1)issues.push(issue('INVALID_RELATIONSHIP_REFERENCE',relationPath,'Provide exactly one of tempKey or recordId.'));
          }
        }
        if(collection==='sources')for(const message of schema.sourceClassificationIssues(record.fields))issues.push(issue('INVALID_EXTERNAL_SOURCE',path,message));
      });
    }
  }

  const evidenceIndex=new Map();
  if(Array.isArray(envelope.evidence))envelope.evidence.forEach((evidence,index)=>{
    const path=`/evidence/${index}`;
    if(!object(evidence)){issues.push(issue('INVALID_EVIDENCE',path,'Evidence must be an object.'));return;}
    unknownKeys(evidence,EVIDENCE_KEYS,path,issues);
    const tempKey=registerTemp(evidence.temporaryKey,`${path}/temporaryKey`,'evidence');
    if(tempKey)evidenceIndex.set(tempKey,{evidence,path});
    for(const name of ['kind','description','location','content'])if(!String(evidence[name]??'').trim())issues.push(issue('MISSING_EVIDENCE_FIELD',`${path}/${name}`,`${name} is required.`));
    if(evidence.sourceRef!==undefined&&!object(evidence.sourceRef))issues.push(issue('INVALID_EVIDENCE_SOURCE_REF',`${path}/sourceRef`,'sourceRef must be a relationship object.'));
  });

  if(object(envelope.records))for(const [collection,list] of Object.entries(envelope.records))if(Array.isArray(list))list.forEach((record,index)=>{
    const path=`/records/${pointerEscape(collection)}/${index}`;
    const definition=schema.RECORD_SCHEMAS[collection];
    for(const evidenceRef of safe(record?.evidenceRefs))if(!evidenceIndex.has(String(evidenceRef)))issues.push(issue('UNRESOLVED_EVIDENCE_REFERENCE',`${path}/evidenceRefs`,`Evidence reference ${evidenceRef} does not exist.`));
    const hasAgentData=object(record?.fields)&&Object.keys(record.fields).some(name=>definition?.fieldDefinitions?.[name]?.provenanceRequired);
    if(hasAgentData&&!safe(record.evidenceRefs).length)issues.push(issue('MISSING_PROVENANCE',`${path}/evidenceRefs`,'Agent-produced canonical record data requires at least one evidence reference.'));
    if(object(record?.relationships))for(const [name,reference] of Object.entries(record.relationships)){
      const expectedCollection=definition?.relationships?.[name];
      if(!expectedCollection||!object(reference))continue;
      if(reference.tempKey){
        const target=responseRecordIndex.get(String(reference.tempKey));
        if(!target)issues.push(issue('UNRESOLVED_RELATIONSHIP',`${path}/relationships/${pointerEscape(name)}`,`Temporary relationship ${reference.tempKey} does not exist.`));
        else if(target.collection!==expectedCollection)issues.push(issue('WRONG_RELATIONSHIP_TYPE',`${path}/relationships/${pointerEscape(name)}`,`${name} must refer to ${expectedCollection}, not ${target.collection}.`));
      }else if(reference.recordId){
        const exists=workflow.records(project,expectedCollection,{active:false}).some(existing=>workflow.recordId(existing,expectedCollection)===String(reference.recordId));
        if(!exists)issues.push(issue('UNRESOLVED_RELATIONSHIP',`${path}/relationships/${pointerEscape(name)}`,`Canonical ${expectedCollection} record ${reference.recordId} does not exist.`));
      }
    }
  });

  const questionIndex=new Map();
  if(Array.isArray(envelope.humanInputRequests))envelope.humanInputRequests.forEach((request,index)=>{
    const path=`/humanInputRequests/${index}`;
    if(!object(request)){issues.push(issue('INVALID_HUMAN_INPUT_REQUEST',path,'Human input request must be an object.'));return;}
    unknownKeys(request,QUESTION_KEYS,path,issues);
    const tempKey=registerTemp(request.temporaryKey,`${path}/temporaryKey`,'question');
    if(tempKey)questionIndex.set(tempKey,request);
    for(const name of ['question','whyRequired','answerType'])if(!String(request[name]??'').trim())issues.push(issue('MISSING_QUESTION_FIELD',`${path}/${name}`,`${name} is required.`));
    if(!ANSWER_TYPES.includes(request.answerType))issues.push(issue('INVALID_ANSWER_TYPE',`${path}/answerType`,`${request.answerType||'MISSING'} is not a supported answerType.`));
    if(!Array.isArray(request.affectedStageFields))issues.push(issue('INVALID_ARRAY',`${path}/affectedStageFields`,'affectedStageFields must be an array.'));
    if(!Array.isArray(request.affectedRecords))issues.push(issue('INVALID_ARRAY',`${path}/affectedRecords`,'affectedRecords must be an array.'));
    if(!Array.isArray(request.allowedValues))issues.push(issue('INVALID_ARRAY',`${path}/allowedValues`,'allowedValues must be an array.'));
    for(const name of safe(request.affectedStageFields))if(!schema.STAGE_FIELDS[stageNumber]?.[name])issues.push(issue('UNKNOWN_STAGE_FIELD',`${path}/affectedStageFields`,`${name} is not a Stage ${stageNumber} field.`));
    for(const collection of safe(request.affectedRecords))if(!allowedCollections.has(collection))issues.push(issue('STAGE_SCOPE_VIOLATION',`${path}/affectedRecords`,`${collection} is outside Stage ${stageNumber}.`));
  });


  if(Array.isArray(envelope.unresolved))envelope.unresolved.forEach((item,index)=>{const path=`/unresolved/${index}`;if(!object(item)){issues.push(issue('INVALID_UNRESOLVED',path,'Unresolved item must be an object.'));return;}unknownKeys(item,UNRESOLVED_KEYS,path,issues);if(!UNRESOLVED_KINDS.includes(item.kind))issues.push(issue('INVALID_UNRESOLVED_KIND',`${path}/kind`,'Unresolved kind is not controlled.'));for(const key of ['temporaryKey','description','whyBlocking'])if(!String(item[key]??'').trim())issues.push(issue('MISSING_UNRESOLVED_FIELD',`${path}/${key}`,`${key} is required.`));if(!Array.isArray(item.affectedStageFields)||!Array.isArray(item.affectedRecords))issues.push(issue('INVALID_UNRESOLVED_TARGETS',path,'affectedStageFields and affectedRecords must be arrays.'));});
  if(Array.isArray(envelope.warnings))envelope.warnings.forEach((item,index)=>{const path=`/warnings/${index}`;if(!object(item)){issues.push(issue('INVALID_WARNING',path,'Warning must be an object.'));return;}unknownKeys(item,WARNING_KEYS,path,issues);for(const key of ['code','message','path'])if(!String(item[key]??'').trim())issues.push(issue('MISSING_WARNING_FIELD',`${path}/${key}`,`${key} is required.`));});

  if(Array.isArray(envelope.attachments))envelope.attachments.forEach((attachment,index)=>{
    const path=`/attachments/${index}`;
    if(!object(attachment)){issues.push(issue('INVALID_ATTACHMENT',path,'Attachment metadata must be an object.'));return;}
    unknownKeys(attachment,ATTACHMENT_KEYS,path,issues);
    registerTemp(attachment.temporaryKey,`${path}/temporaryKey`,'attachment');
    if(!String(attachment.filename||'').trim())issues.push(issue('MISSING_ATTACHMENT_FILENAME',`${path}/filename`,'filename is required.'));
  });

  if(envelope.responseType==='HUMAN_INPUT_REQUIRED'){
    if(!safe(envelope.humanInputRequests).length)issues.push(issue('MISSING_HUMAN_INPUT_REQUESTS','/humanInputRequests','HUMAN_INPUT_REQUIRED must include at least one question.'));
    if(Object.keys(envelope.stageData||{}).length)issues.push(issue('MIXED_RESPONSE_TYPE','/stageData','A clarification response cannot also propose canonical stage data.'));
    if(Object.values(envelope.records||{}).some(list=>safe(list).length))issues.push(issue('MIXED_RESPONSE_TYPE','/records','A clarification response cannot also propose canonical records.'));
  }
  if(envelope.responseType==='DATA_PROPOSAL'){
    if(safe(envelope.humanInputRequests).some(request=>request.blocking!==false))issues.push(issue('MIXED_RESPONSE_TYPE','/humanInputRequests','A DATA_PROPOSAL cannot contain blocking human-input requests.'));
    const hasData=Object.keys(envelope.stageData||{}).length||Object.values(envelope.records||{}).some(list=>safe(list).length);
    if(!hasData)issues.push(issue('EMPTY_DATA_PROPOSAL','/','DATA_PROPOSAL contains no stage data or records.'));
    if(!safe(envelope.evidence).length)issues.push(issue('MISSING_PROVENANCE','/evidence','DATA_PROPOSAL requires evidence.'));
  }
  if(envelope.responseType==='BLOCKED'){if(Object.keys(envelope.stageData||{}).length||Object.values(envelope.records||{}).some(list=>safe(list).length)||safe(envelope.humanInputRequests).length)issues.push(issue('MIXED_RESPONSE_TYPE','/','BLOCKED must not contain stageData, records, or humanInputRequests.'));if(!safe(envelope.unresolved).length)issues.push(issue('MISSING_BLOCKER_DETAIL','/unresolved','BLOCKED requires structured unresolved detail.'));}
  if(envelope.responseType==='EXECUTION_FAILED'){if(Object.keys(envelope.stageData||{}).length||Object.values(envelope.records||{}).some(list=>safe(list).length))issues.push(issue('MIXED_RESPONSE_TYPE','/','EXECUTION_FAILED must not contain canonical stageData or records.'));if(!safe(envelope.unresolved).length&&!safe(envelope.warnings).length)issues.push(issue('MISSING_FAILURE_DETAIL','/unresolved','EXECUTION_FAILED requires failure detail.'));}

  const canonicalEnvelopeSha256=hash.canonicalEnvelopeSha256(envelope);
  const priorCanonicalEnvelope=safe(project.projectData.rawResponses).find(record=>record.canonicalEnvelopeSha256===canonicalEnvelopeSha256&&Number(record.stage)===stageNumber&&(record.promptInstructionId||'')===(promptRecord?.instructionId||promptRecord?.promptId||''));if(priorCanonicalEnvelope)issues.push(issue('DUPLICATE_RESPONSE','/',`This canonical envelope already exists as ${priorCanonicalEnvelope.rawResponseId}.`));
  const priorDuplicate=safe(project.projectData.rawResponses).find(record=>record.status!=='PRESERVED'&&record.sha256===rawSha256&&Number(record.stage)===stageNumber&&(record.promptInstructionId||'')===(promptRecord?.instructionId||promptRecord?.promptId||''));
  if(priorDuplicate)issues.push(issue('DUPLICATE_RESPONSE','/',`This exact response was already preserved as ${priorDuplicate.rawResponseId}.`));

  return {
    valid:issues.every(item=>item.severity!=='ERROR'),
    issues,
    errorCount:issues.filter(item=>item.severity==='ERROR').length,
    warningCount:issues.filter(item=>item.severity==='WARNING').length,
    checkedAt:now(),
    responseSchema:envelope.schema,
    responseType:envelope.responseType,
    temporaryRecordIndex:responseRecordIndex,
    temporaryEvidenceIndex:evidenceIndex,canonicalEnvelopeSha256
  };
}

function planProposal(project,envelope,{rawRecord,promptRecord,validationRecord}){
  const proposalId=workflow.allocateInfrastructureId(project,'PARSED-PROPOSAL','responseProposals');
  const tempToCanonical={};
  const evidence=[];
  for(const source of safe(envelope.evidence)){
    const id=workflow.allocateId(project,'evidenceRecords');
    tempToCanonical[source.temporaryKey]={collection:'evidenceRecords',id};
    const fields={
      EVIDENCE_ID:id,KIND:source.kind,DESCRIPTION:source.description,AUTHORITY_TYPE:source.authorityType||'UNKNOWN',
      SOURCE_ID:'UNKNOWN',LOCATION:source.location,CONTENT:source.content,ATTACHMENT_ID:'UNKNOWN',SHA256:'UNKNOWN',STATUS:'PRESERVED'
    };
    evidence.push({id,stage:Number(envelope.stage),createdAt:now(),active:true,fields,...fields,sourceProposalId:proposalId,rawResponseId:rawRecord.rawResponseId,temporaryKey:source.temporaryKey,sourceReference:clone(source.sourceRef||null),attachmentReference:source.attachmentRef||null});
  }
  for(const [collection,list] of Object.entries(envelope.records||{}))for(const proposed of safe(list)){
    const id=workflow.allocateId(project,collection);
    tempToCanonical[proposed.tempKey]={collection,id};
  }
  const canonicalRecords={};
  for(const [collection,list] of Object.entries(envelope.records||{})){
    canonicalRecords[collection]=safe(list).map(proposed=>{
      const definition=schema.RECORD_SCHEMAS[collection];
      const id=tempToCanonical[proposed.tempKey].id;
      const fields=clone(proposed.fields||{});
      fields[definition.idField]=id;
      const relationships={};
      for(const [name,reference] of Object.entries(proposed.relationships||{})){
        const target=reference.tempKey?tempToCanonical[reference.tempKey]:{collection:definition.relationships[name],id:String(reference.recordId)};
        relationships[name]=target.id;
        fields[name]=target.id;
      }
      const evidenceRefs=safe(proposed.evidenceRefs).map(ref=>tempToCanonical[ref]?.id).filter(Boolean);
      return {
        id,stage:Number(envelope.stage),createdAt:now(),active:true,fields,...fields,relationships,evidenceRefs,
        notes:proposed.notes||'',temporaryKey:proposed.tempKey,sourceProposalId:proposalId,rawResponseId:rawRecord.rawResponseId
      };
    });
  }
  for(const evidenceRecord of evidence){
    const source=evidenceRecord.sourceReference;
    if(source?.tempKey)evidenceRecord.fields.SOURCE_ID=evidenceRecord.SOURCE_ID=tempToCanonical[source.tempKey]?.id||'UNKNOWN';
    else if(source?.recordId)evidenceRecord.fields.SOURCE_ID=evidenceRecord.SOURCE_ID=String(source.recordId);
    if(evidenceRecord.attachmentReference)evidenceRecord.fields.ATTACHMENT_ID=evidenceRecord.ATTACHMENT_ID=tempToCanonical[evidenceRecord.attachmentReference]?.id||'UNKNOWN';
    evidenceRecord.fields.SHA256=evidenceRecord.SHA256=hash.sha256Text(String(evidenceRecord.CONTENT||''));
    evidenceRecord.sha256=hash.sha256Value(evidenceRecord.fields);
  }
  for(const records of Object.values(canonicalRecords))for(const record of records)record.sha256=hash.sha256Value({fields:record.fields,relationships:record.relationships,evidenceRefs:record.evidenceRefs});

  const proposedStageData=clone(envelope.stageData||{});
  const changes=[];
  for(const [name,value] of Object.entries(proposedStageData))changes.push({jsonPointer:`/stageData/${pointerEscape(name)}`,canonicalRecordType:'stageData',canonicalRecordId:`STAGE-${String(envelope.stage).padStart(2,'0')}`,canonicalField:name,normalizedValue:clone(value),temporaryResponseKey:null});
  for(const [collection,list] of Object.entries(canonicalRecords))for(const record of list){
    for(const [name,value] of Object.entries(record.fields))changes.push({jsonPointer:`/records/${pointerEscape(collection)}/${pointerEscape(record.temporaryKey)}/fields/${pointerEscape(name)}`,canonicalRecordType:collection,canonicalRecordId:record.id,canonicalField:name,normalizedValue:clone(value),temporaryResponseKey:record.temporaryKey});
    for(const evidenceId of record.evidenceRefs)changes.push({jsonPointer:`/records/${pointerEscape(collection)}/${pointerEscape(record.temporaryKey)}/evidenceRefs`,canonicalRecordType:collection,canonicalRecordId:record.id,canonicalField:'evidenceRefs',normalizedValue:evidenceId,temporaryResponseKey:record.temporaryKey});
  }
  for(const record of evidence)for(const [name,value] of Object.entries(record.fields))changes.push({jsonPointer:`/evidence/${pointerEscape(record.temporaryKey)}/${pointerEscape(name)}`,canonicalRecordType:'evidenceRecords',canonicalRecordId:record.id,canonicalField:name,normalizedValue:clone(value),temporaryResponseKey:record.temporaryKey});

  return {
    proposalId,rawResponseId:rawRecord.rawResponseId,validationId:validationRecord.validationId,promptId:promptRecord.instructionId||promptRecord.promptId,
    bodySha256:promptRecord.bodySha256||promptRecord.sha256,promptSha256:promptRecord.bodySha256||promptRecord.sha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature,scopeSha256:promptRecord.scopeSha256,jobId:envelope.jobId,stage:Number(envelope.stage),responseSchemaVersion:envelope.schema,responseType:envelope.responseType,
    createdAt:now(),status:'PENDING_OPERATOR_REVIEW',envelope:clone(envelope),proposedStageData,canonicalRecords,evidence,tempToCanonical,changes,
    humanInputRequests:clone(envelope.humanInputRequests||[]),unresolved:clone(envelope.unresolved||[]),warnings:clone(envelope.warnings||[]),attachments:clone(envelope.attachments||[])
  };
}

function createReceipt(project,{stage,promptRecord,rawRecord,validationRecord,proposal}){
  const receiptId=workflow.allocateInfrastructureId(project,'RECEIPT','outputReceipts');
  const receipt={
    receiptId,jobId:project.job.JOB_ID,stage:Number(stage),role:globalThis.closedLoopCore?.STAGES?.[Number(stage)-1]?.role||'UNKNOWN',contextId:'UNKNOWN',
    iteration:project.job.CURRENT_ITERATION||'NOT APPLICABLE',runId:'NOT APPLICABLE',requestDateTime:promptRecord.generatedAt||'UNKNOWN',responseDateTime:rawRecord.createdAt,
    inputIdentities:[project.job.CURRENT_INPUT_VERSION||'UNKNOWN'],sourceSetVersion:project.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',requirementsVersion:project.job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE',instructionVersion:project.job.CURRENT_INSTRUCTION_VERSION||'NOT APPLICABLE',testSuiteVersion:project.job.CURRENT_TEST_SUITE_VERSION||'NOT APPLICABLE',
    promptInstructionId:promptRecord.instructionId||promptRecord.promptId,promptSha256:promptRecord.sha256||promptRecord.bodySha256,rawResponseId:rawRecord.rawResponseId,rawResponseSha256:rawRecord.sha256,
    parsedProposalId:proposal?.proposalId||'NONE',validationId:validationRecord.validationId,acceptedCanonicalChangeId:'NONE',rejectedResponseId:'NONE',extractionManifestId:'NONE',
    outputArtifactIdentity:rawRecord.outputId,files:[],completionState:validationRecord.valid?'PARSED_PENDING_REVIEW':'VALIDATION_FAILED',truncation:validationRecord.issues.some(item=>item.code==='TRUNCATED_RESPONSE'),refusal:false,toolFailures:[],missingAttachments:[],malformedOutput:!validationRecord.valid,deviations:clone(validationRecord.issues),defects:[],blockers:[],nextRequiredVerificationStage:`STAGE ${String(stage).padStart(2,'0')} RESPONSE REVIEW`,createdAt:now()
  };
  project.projectData.outputReceipts.push(receipt);
  return receipt;
}

function prepare(project,{stage,text,promptRecord,contextId='UNKNOWN',files=[]}={}){
  const next=clone(project);
  workflow.ensureShape(next);
  const stageNumber=Number(stage);
  const prompt=promptRecordFor(next,promptRecord);
  const rawResponseId=workflow.allocateInfrastructureId(next,'RAW-RESPONSE','rawResponses');
  const outputId=workflow.allocateInfrastructureId(next,`STAGE-${String(stageNumber).padStart(2,'0')}-OUTPUT`,'generatedOutputs');
  const rawText=String(text??'');
  const rawSha256=hash.rawResponseSha256(rawText);
  const rawRecord={rawResponseId,outputId,jobId:next.job.JOB_ID,stage:stageNumber,role:globalThis.closedLoopCore?.STAGES?.[stageNumber-1]?.role||'UNKNOWN',contextId,iteration:next.job.CURRENT_ITERATION||'NOT APPLICABLE',promptInstructionId:prompt?.instructionId||prompt?.promptId||'UNKNOWN',promptSha256:prompt?.sha256||prompt?.bodySha256||'UNKNOWN',createdAt:now(),sha256:rawSha256,completeRawResponse:rawText,files:clone(files),status:'PRESERVED',projectRevision:Number(next.revision||0)};
  next.projectData.rawResponses.push(rawRecord);
  next.projectData.generatedOutputs.push({outputId,rawResponseId,stage:stageNumber,role:rawRecord.role,iteration:rawRecord.iteration,createdAt:rawRecord.createdAt,sha256:rawSha256,output:rawText,status:'RAW_RESPONSE_PRESERVED'});
  workflow.addHistory(next,'RAW_RESPONSE_PRESERVED',{stage:stageNumber,rawResponseId,outputId,sha256:rawSha256});

  let envelope=null,parseError=null;
  try{envelope=strictParse(rawText);}catch(error){parseError=error;}
  let validation;
  if(parseError){
    validation={valid:false,issues:[issue(parseError.code||'MALFORMED_JSON','/',parseError.message)],errorCount:1,warningCount:0,checkedAt:now(),responseSchema:null,responseType:null};
  }else validation=validateEnvelope(next,envelope,{stage:stageNumber,promptRecord:prompt,rawSha256});
  if(envelope)rawRecord.canonicalEnvelopeSha256=hash.canonicalEnvelopeSha256(envelope);
  const validationId=workflow.allocateInfrastructureId(next,'VALIDATION','responseValidations');
  const validationRecord={validationId,rawResponseId,jobId:next.job.JOB_ID,stage:stageNumber,promptId:prompt?.instructionId||prompt?.promptId||'UNKNOWN',promptSha256:prompt?.sha256||prompt?.bodySha256||'UNKNOWN',createdAt:now(),valid:validation.valid,issues:clone(validation.issues),errorCount:validation.errorCount,warningCount:validation.warningCount,responseSchema:validation.responseSchema,responseType:validation.responseType,status:validation.valid?'VALID':'REJECTED'};
  next.projectData.responseValidations.push(validationRecord);
  rawRecord.validationId=validationId;
  rawRecord.status=validation.valid?'VALIDATED_PENDING_REVIEW':'VALIDATION_FAILED';

  let proposal=null;
  if(validation.valid){
    proposal=planProposal(next,envelope,{rawRecord,promptRecord:prompt,validationRecord});
    next.projectData.responseProposals.push(proposal);
    rawRecord.proposalId=proposal.proposalId;
  }
  const receipt=createReceipt(next,{stage:stageNumber,promptRecord:prompt||{},rawRecord,validationRecord,proposal});
  rawRecord.receiptId=receipt.receiptId;
  validationRecord.receiptId=receipt.receiptId;
  if(proposal)proposal.receiptId=receipt.receiptId;
  workflow.addHistory(next,validation.valid?'RESPONSE_VALIDATED':'RESPONSE_VALIDATION_FAILED',{stage:stageNumber,rawResponseId,validationId,proposalId:proposal?.proposalId||'NONE',issueCodes:validation.issues.map(item=>item.code)});
  workflow.recalculate(next);
  return {project:next,rawRecord,validation:validationRecord,proposal,receipt};
}

function findProposal(project,proposalId){return safe(project?.projectData?.responseProposals).find(item=>item.proposalId===proposalId);}
function findReceipt(project,receiptId){return safe(project?.projectData?.outputReceipts).find(item=>item.receiptId===receiptId);}
function findRaw(project,rawResponseId){return safe(project?.projectData?.rawResponses).find(item=>item.rawResponseId===rawResponseId);}
function findValidation(project,validationId){return safe(project?.projectData?.responseValidations).find(item=>item.validationId===validationId);}

function ensureProposalCurrent(project,proposal){
  if(!proposal)throw new Error('Response proposal does not exist.');
  if(proposal.status!=='PENDING_OPERATOR_REVIEW')throw new Error(`Response proposal is ${proposal.status}, not pending review.`);
  const latest=safe(project.projectData.generatedPrompts).filter(record=>Number(record.stage)===Number(proposal.stage)&&!record.invalidatedBy).at(-1);
  if(!latest)throw new Error('The controlling generated instruction no longer exists.');
  if((latest.instructionId||latest.promptId)!==proposal.promptId||(latest.sha256||latest.bodySha256)!==proposal.promptSha256)throw new Error('The response proposal is stale because a newer prompt identity exists.');
}

function commit(project,proposalId,{operator='HUMAN_OPERATOR',reviewNote='Accepted after operator review.'}={}){
  const next=clone(project);
  workflow.ensureShape(next);
  const proposal=findProposal(next,proposalId);
  ensureProposalCurrent(next,proposal);
  const validation=findValidation(next,proposal.validationId);
  if(!validation?.valid)throw new Error('Only a fully valid response proposal can be committed.');
  const stage=Number(proposal.stage);
  const priorCommitted=workflow.acceptedChanges(next,stage).length>0;
  const downstreamActive=Object.values(next.stages).some(state=>Number(state.number)>stage&&(state.status==='COMPLETE'||state.acceptedResponseIds?.length));
  const changeId=workflow.allocateInfrastructureId(next,'ACCEPTED-CHANGE','acceptedChanges');
  if(priorCommitted&&downstreamActive)workflow.invalidateDownstream(next,stage,changeId,'Accepted canonical response revised an upstream stage.');

  const committedRecordIds=[];
  for(const evidence of proposal.evidence){
    if(next.projectData.evidenceRecords.some(record=>workflow.recordId(record,'evidenceRecords')===evidence.id))throw new Error(`Evidence ID collision: ${evidence.id}.`);
    next.projectData.evidenceRecords.push(clone(evidence));committedRecordIds.push(evidence.id);
  }
  for(const [collection,list] of Object.entries(proposal.canonicalRecords)){
    for(const canonical of list){
      if(next.projectData[collection].some(record=>workflow.recordId(record,collection)===canonical.id))throw new Error(`Canonical ID collision: ${canonical.id}.`);
      const contentDuplicate=next.projectData[collection].find(record=>record.sha256===canonical.sha256&&workflow.isActiveRecord(record));
      if(contentDuplicate)throw new Error(`Canonical duplicate detected: ${collection} proposal duplicates ${workflow.recordId(contentDuplicate,collection)}.`);
      next.projectData[collection].push(clone(canonical));committedRecordIds.push(canonical.id);
    }
  }

  const state=next.stages[stage];
  state.acceptedData={...state.acceptedData,...clone(proposal.proposedStageData)};
  state.acceptedResponseIds.push(proposal.rawResponseId);
  if(stage===1){
    for(const name of schema.AGENT_JOB_FIELDS)if(Object.hasOwn(proposal.proposedStageData,name))next.job[name]=clone(proposal.proposedStageData[name]);
  }

  const acceptedChange={changeId,rawResponseId:proposal.rawResponseId,proposalId:proposal.proposalId,validationId:proposal.validationId,jobId:next.job.JOB_ID,stage,responseType:proposal.responseType,operator,reviewNote,committedAt:now(),status:'COMMITTED',canonicalRecordIds:committedRecordIds,stageFields:Object.keys(proposal.proposedStageData),promptId:proposal.promptId,promptSha256:proposal.promptSha256};
  next.projectData.acceptedChanges.push(acceptedChange);
  proposal.status='ACCEPTED';proposal.acceptedChangeId=changeId;proposal.reviewedAt=acceptedChange.committedAt;proposal.reviewedBy=operator;proposal.reviewNote=reviewNote;
  validation.status='ACCEPTED';
  const raw=findRaw(next,proposal.rawResponseId);if(raw){raw.status='ACCEPTED_CANONICAL_CHANGE';raw.acceptedChangeId=changeId;}

  const manifestId=workflow.allocateInfrastructureId(next,'EXTRACTION-MANIFEST','extractionManifests');
  const manifest={manifestId,rawResponseId:proposal.rawResponseId,promptId:proposal.promptId,promptSha256:proposal.promptSha256,jobId:next.job.JOB_ID,stage,responseSchemaVersion:proposal.responseSchemaVersion,acceptedChangeId:changeId,committedAt:acceptedChange.committedAt,entries:proposal.changes.map(entry=>({...clone(entry),validationRulesExecuted:['SCHEMA','IDENTITY','OWNERSHIP','STAGE_SCOPE','RELATIONSHIP','EVIDENCE','DUPLICATE'],validationResult:'SATISFIED',committedAt:acceptedChange.committedAt}))};
  next.projectData.extractionManifests.push(manifest);
  acceptedChange.extractionManifestId=manifestId;

  if(proposal.responseType==='HUMAN_INPUT_REQUIRED'){
    for(const request of proposal.humanInputRequests){
      next.projectData.humanInputRequests.push({requestId:workflow.allocateInfrastructureId(next,'HUMAN-INPUT-REQUEST','humanInputRequests'),temporaryKey:request.temporaryKey,jobId:next.job.JOB_ID,stage,rawResponseId:proposal.rawResponseId,promptId:proposal.promptId,question:request.question,whyRequired:request.whyRequired,affectedStageFields:clone(request.affectedStageFields),affectedRecords:clone(request.affectedRecords),answerType:request.answerType,allowedValues:clone(request.allowedValues),blocking:request.blocking!==false,status:'OPEN',createdAt:acceptedChange.committedAt});
    }
    acceptedChange.status='QUESTIONS_CREATED';
  }

  const receipt=findReceipt(next,proposal.receiptId);
  if(receipt){receipt.acceptedCanonicalChangeId=changeId;receipt.extractionManifestId=manifestId;receipt.completionState=proposal.responseType==='HUMAN_INPUT_REQUIRED'?'HUMAN_INPUT_REQUIRED':'ACCEPTED_CANONICAL_CHANGE';receipt.nextRequiredVerificationStage=proposal.responseType==='HUMAN_INPUT_REQUIRED'?`STAGE ${String(stage).padStart(2,'0')} HUMAN INPUT`:`STAGE ${String(stage).padStart(2,'0')} GATE RECALCULATION`;}

  workflow.registerStageVersion(next,stage,changeId);
  workflow.recalculate(next);
  if(stage===27){workflow.recordReleaseDetermination(next);}
  if(stage===29){workflow.constructEvidenceChains(next);}
  if(stage===30){
    const registry=next.projectData.permanentRegistry;
    registry.appendOnly=true;registry.defects=safe(registry.defects);registry.regressions=safe(registry.regressions);
    for(const record of workflow.records(next,'defects',{active:false}))if(!registry.defects.some(item=>item.id===workflow.recordId(record,'defects')))registry.defects.push({id:workflow.recordId(record,'defects'),sha256:record.sha256,record:clone(record)});
    for(const record of workflow.records(next,'regressions',{active:false}))if(!registry.regressions.some(item=>item.id===workflow.recordId(record,'regressions')))registry.regressions.push({id:workflow.recordId(record,'regressions'),sha256:record.sha256,record:clone(record)});
    registry.updatedAt=now();registry.sha256=hash.sha256Value({appendOnly:registry.appendOnly,defects:registry.defects,regressions:registry.regressions});
  }
  workflow.addHistory(next,'CANONICAL_RESPONSE_COMMITTED',{stage,rawResponseId:proposal.rawResponseId,proposalId,changeId,manifestId,canonicalRecordIds:committedRecordIds});
  workflow.recalculate(next);
  return {project:next,acceptedChange,manifest,receipt:findReceipt(next,proposal.receiptId)};
}

function reject(project,proposalId,{operator='HUMAN_OPERATOR',reason='Rejected after operator review.',requestCorrection=false}={}){
  const next=clone(project);
  workflow.ensureShape(next);
  const proposal=findProposal(next,proposalId);
  if(!proposal)throw new Error('Response proposal does not exist.');
  if(proposal.status!=='PENDING_OPERATOR_REVIEW')throw new Error(`Response proposal is ${proposal.status}, not pending review.`);
  const rejectedResponseId=workflow.allocateInfrastructureId(next,'REJECTED-RESPONSE','rejectedResponses');
  const rejected={rejectedResponseId,rawResponseId:proposal.rawResponseId,proposalId,validationId:proposal.validationId,jobId:next.job.JOB_ID,stage:proposal.stage,operator,reason,requestCorrection:Boolean(requestCorrection),rejectedAt:now(),status:requestCorrection?'CORRECTION_REQUESTED':'REJECTED'};
  next.projectData.rejectedResponses.push(rejected);
  proposal.status=rejected.status;proposal.reviewedAt=rejected.rejectedAt;proposal.reviewedBy=operator;proposal.reviewNote=reason;
  const validation=findValidation(next,proposal.validationId);if(validation)validation.status=rejected.status;
  const raw=findRaw(next,proposal.rawResponseId);if(raw)raw.status=rejected.status;
  const receipt=findReceipt(next,proposal.receiptId);if(receipt){receipt.rejectedResponseId=rejectedResponseId;receipt.completionState=rejected.status;receipt.nextRequiredVerificationStage=`REGENERATE STAGE ${String(proposal.stage).padStart(2,'0')} RESPONSE`;}
  workflow.addHistory(next,rejected.status,{stage:proposal.stage,rawResponseId:proposal.rawResponseId,proposalId,rejectedResponseId,reason});
  workflow.recalculate(next);
  return {project:next,rejected,receipt};
}

function answerHumanInput(project,answers,{operator='HUMAN_OPERATOR'}={}){
  const next=clone(project);
  workflow.ensureShape(next);
  const answerMap=object(answers)?answers:{};
  const changed=[];
  const clarifications=safe(next.projectData.userEntered.clarifications);
  for(const request of safe(next.projectData.humanInputRequests).filter(item=>upper(item.status)==='OPEN')){
    if(!Object.hasOwn(answerMap,request.requestId))continue;
    const value=answerMap[request.requestId];
    if(request.blocking!==false&&(value===undefined||value===null||String(value).trim()===''))throw new Error(`Answer is required for ${request.requestId}.`);
    if(request.answerType==='CHOICE'&&request.allowedValues.length&&!request.allowedValues.includes(value))throw new Error(`${request.requestId} must use an allowed value.`);
    const answerId=workflow.allocateInfrastructureId(next,'HUMAN-INPUT-ANSWER','humanInputAnswers');
    const record={answerId,requestId:request.requestId,jobId:next.job.JOB_ID,stage:request.stage,question:request.question,answer:clone(value),operator,answeredAt:now(),authority:'User Job Input'};
    next.projectData.humanInputAnswers.push(record);
    request.status='ANSWERED';request.answerId=answerId;request.answeredAt=record.answeredAt;
    clarifications.push({requestId:request.requestId,question:request.question,answer:clone(value),answerId,stage:request.stage,answeredAt:record.answeredAt});
    changed.push(`CLARIFICATION:${request.requestId}`);
  }
  if(!changed.length)throw new Error('No open human-input request received an answer.');
  next.projectData.userEntered.clarifications=clarifications;
  const version=workflow.recordHumanInputVersion(next,changed,operator);
  workflow.addHistory(next,'HUMAN_INPUT_REQUESTS_ANSWERED',{answerCount:changed.length,inputVersion:version.version,requestIds:changed});
  workflow.recalculate(next);
  return {project:next,version,answeredCount:changed.length};
}

globalThis.closedLoopResponseIngestion=Object.freeze({
  version:'closed-loop-response-ingestion/2',TOP_LEVEL_KEYS,RECORD_KEYS,EVIDENCE_KEYS,QUESTION_KEYS,ATTACHMENT_KEYS,ANSWER_TYPES,
  strictParse,scanJsonAmbiguity,validateValue,validateEnvelope,planProposal,prepare,commit,reject,answerHumanInput,findProposal,findReceipt,findRaw,findValidation
});
})();

from pathlib import Path
import re, subprocess

p=Path('workflow-schema.js'); s=p.read_text()
s=s.replace('      "EXECUTABLE_KIND",\n      "EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC",\n      "EXECUTABLE_INPUT_BINDINGS"','      "EXECUTABLE_KIND",\n      "EXECUTABLE_SPEC",\n      "EXECUTABLE_INPUT_BINDINGS"',1)
marker='      "TEST_ID",\n      "REQ_ID",\n      "STATUS"\n    ]\n  },\n  "failureTests"'
assert marker in s
s=s.replace(marker,'      "TEST_ID",\n      "REQ_ID",\n      "EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC_SHA256",\n      "STATUS"\n    ]\n  },\n  "failureTests"',1)
start=s.index('const TEST_IR=Object.freeze({'); end=s.index('function validateTestIRBindings',start)
replacement='''const TEST_IR_STEP_CONTRACTS=Object.freeze({
  LOAD_ARTIFACT:Object.freeze({required:Object.freeze(['binding']),optional:Object.freeze([])}),
  READ_BYTES:Object.freeze({required:Object.freeze([]),optional:Object.freeze([])}),
  DECODE_UTF8:Object.freeze({required:Object.freeze([]),optional:Object.freeze([])}),
  PARSE_JSON:Object.freeze({required:Object.freeze([]),optional:Object.freeze([])}),
  PARSE_CSV:Object.freeze({required:Object.freeze(['delimiter','header','quote','newline','encoding']),optional:Object.freeze([])}),
  PARSE_XML:Object.freeze({required:Object.freeze([]),optional:Object.freeze([])}),
  SELECT_JSON_PATH:Object.freeze({required:Object.freeze(['path']),optional:Object.freeze([])}),
  SELECT_XML:Object.freeze({required:Object.freeze(['path']),optional:Object.freeze([])}),
  COUNT:Object.freeze({required:Object.freeze([]),optional:Object.freeze([])}),
  SUM:Object.freeze({required:Object.freeze([]),optional:Object.freeze([])}),
  MIN:Object.freeze({required:Object.freeze([]),optional:Object.freeze([])}),
  MAX:Object.freeze({required:Object.freeze([]),optional:Object.freeze([])}),
  SORT:Object.freeze({required:Object.freeze([]),optional:Object.freeze(['direction'])}),
  UNIQUE:Object.freeze({required:Object.freeze([]),optional:Object.freeze([])}),
  HASH_SHA256:Object.freeze({required:Object.freeze([]),optional:Object.freeze([])}),
  REGEX:Object.freeze({required:Object.freeze(['pattern']),optional:Object.freeze(['flags'])}),
  COMPARE:Object.freeze({required:Object.freeze([]),optional:Object.freeze(['value','binding','operator','numericMode','absoluteTolerance','relativeTolerance']),exactlyOne:Object.freeze(['value','binding'])}),
  ASSERT_EQ:Object.freeze({required:Object.freeze(['value']),optional:Object.freeze(['message','numericMode','absoluteTolerance','relativeTolerance'])}),
  ASSERT_GT:Object.freeze({required:Object.freeze(['value']),optional:Object.freeze(['message'])}),
  ASSERT_GTE:Object.freeze({required:Object.freeze(['value']),optional:Object.freeze(['message'])}),
  ASSERT_LT:Object.freeze({required:Object.freeze(['value']),optional:Object.freeze(['message'])}),
  ASSERT_LTE:Object.freeze({required:Object.freeze(['value']),optional:Object.freeze(['message'])}),
  ASSERT_MATCH:Object.freeze({required:Object.freeze(['pattern']),optional:Object.freeze(['flags','message'])}),
  ASSERT_CONTAINS:Object.freeze({required:Object.freeze(['value']),optional:Object.freeze(['message'])}),
  ASSERT_NOT_CONTAINS:Object.freeze({required:Object.freeze(['value']),optional:Object.freeze(['message'])}),
  ASSERT_SET_EQUAL:Object.freeze({required:Object.freeze(['value']),optional:Object.freeze(['message'])}),
  BYTE_COMPARE:Object.freeze({required:Object.freeze(['binding']),optional:Object.freeze([])})
});
const TEST_IR=Object.freeze({version:'closed-loop-test-spec/1',capability:'CLOSED_LOOP_TEST_IR',executableKinds:Object.freeze(['NONE','TEST_IR']),operations:Object.freeze(Object.keys(TEST_IR_STEP_CONTRACTS)),operationContracts:TEST_IR_STEP_CONTRACTS,limits:Object.freeze({maxSteps:128,maxInputBytes:33554432,maxTotalInputBytes:33554432,maxTextBytes:16777216,maxCollectionItems:100000,maxParsedDepth:64,maxSelectorDepth:32,maxRegexLength:2000,maxRegexInputBytes:2097152,maxCsvCells:250000,workerTimeoutMs:5000,maxArchiveExpandedBytes:67108864})});
const TEST_IR_FORBIDDEN_STEP_KEYS=Object.freeze(['code','javascript','python','shell','command','eval','function','script','source']);
function validateTestIRSpec(spec){
  const issues=[];
  if(!spec||typeof spec!=='object'||Array.isArray(spec))return {valid:false,issues:['EXECUTABLE_SPEC must be an object.']};
  for(const key of Object.keys(spec))if(!['version','steps'].includes(key))issues.push(`EXECUTABLE_SPEC contains unsupported root property ${key}.`);
  if(spec.version!==TEST_IR.version)issues.push(`EXECUTABLE_SPEC.version must be ${TEST_IR.version}.`);
  if(!Array.isArray(spec.steps)||!spec.steps.length)issues.push('EXECUTABLE_SPEC.steps must be a non-empty array.');
  if((spec.steps?.length||0)>TEST_IR.limits.maxSteps)issues.push(`EXECUTABLE_SPEC exceeds ${TEST_IR.limits.maxSteps} steps.`);
  for(const [index,step] of (spec.steps||[]).entries()){
    if(!step||typeof step!=='object'||Array.isArray(step)){issues.push(`Step ${index} must be an object.`);continue;}
    const contract=TEST_IR_STEP_CONTRACTS[step.op];if(!contract){issues.push(`Step ${index} uses unsupported operation ${String(step.op||'UNKNOWN')}.`);continue;}
    for(const key of TEST_IR_FORBIDDEN_STEP_KEYS)if(Object.prototype.hasOwnProperty.call(step,key))issues.push(`Step ${index} contains forbidden executable field ${key}.`);
    const allowed=new Set(['op',...contract.required,...contract.optional]);for(const key of Object.keys(step))if(!allowed.has(key))issues.push(`Step ${index} ${step.op} contains unsupported property ${key}.`);
    for(const key of contract.required)if(!Object.prototype.hasOwnProperty.call(step,key))issues.push(`Step ${index} ${step.op} requires ${key}.`);
    if(contract.exactlyOne){const count=contract.exactlyOne.filter(key=>Object.prototype.hasOwnProperty.call(step,key)).length;if(count!==1)issues.push(`Step ${index} ${step.op} requires exactly one of ${contract.exactlyOne.join(', ')}.`);}
    if(['LOAD_ARTIFACT','BYTE_COMPARE'].includes(step.op)&&typeof step.binding!=='string')issues.push(`Step ${index} ${step.op} binding must be a string.`);
    if(step.op==='PARSE_CSV'){if(typeof step.delimiter!=='string'||step.delimiter.length!==1)issues.push(`Step ${index} PARSE_CSV delimiter must be one character.`);if(typeof step.header!=='boolean')issues.push(`Step ${index} PARSE_CSV header must be BOOLEAN.`);if(typeof step.quote!=='string'||step.quote.length!==1)issues.push(`Step ${index} PARSE_CSV quote must be one character.`);if(!['LF','CRLF','AUTO'].includes(step.newline))issues.push(`Step ${index} PARSE_CSV newline must be LF, CRLF, or AUTO.`);if(step.encoding!=='UTF-8')issues.push(`Step ${index} PARSE_CSV encoding must be UTF-8.`);}
    if(step.op==='SELECT_JSON_PATH'&&(typeof step.path!=='string'||!/^(?:\$)(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\d+\]|\[\*\])*$/.test(step.path)))issues.push(`Step ${index} uses unsupported JSON selector syntax.`);
    if(step.op==='SELECT_XML'&&(typeof step.path!=='string'||!/^\/?[A-Za-z_][A-Za-z0-9_.:-]*(?:\/[A-Za-z_][A-Za-z0-9_.:-]*)*$/.test(step.path)))issues.push(`Step ${index} uses unsupported XML selector syntax.`);
    if(['REGEX','ASSERT_MATCH'].includes(step.op)&&(typeof step.pattern!=='string'||step.pattern.length>TEST_IR.limits.maxRegexLength))issues.push(`Step ${index} regex is invalid or exceeds the deterministic runtime limit.`);
    if(['ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE'].includes(step.op)&&typeof step.value!=='number')issues.push(`Step ${index} ${step.op} requires a numeric value.`);
    if(step.op==='ASSERT_SET_EQUAL'&&!Array.isArray(step.value))issues.push(`Step ${index} ASSERT_SET_EQUAL value must be an array.`);
  }
  return {valid:issues.length===0,issues};
}
'''
s=s[:start]+replacement+s[end:]
s=s.replace("    EXECUTABLE_SPEC:Object.freeze({valueType:VALUE_TYPES.OBJECT,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),\n    EXECUTABLE_INPUT_BINDINGS", "    EXECUTABLE_SPEC:Object.freeze({valueType:VALUE_TYPES.OBJECT,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),\n    EXECUTABLE_SPEC_SHA256:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),\n    EXECUTABLE_INPUT_BINDINGS",1)
s=s.replace("'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS'", "'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC','EXECUTABLE_SPEC_SHA256','EXECUTABLE_INPUT_BINDINGS'",1)
p.write_text(s)

p=Path('test-runtime.js'); s=p.read_text()
for pattern in [r"\n  ASSERT_EXISTS:\{required:\[\],optional:\['message'\],types:\{message:'string'\}\},",r"\n  ASSERT_TYPE:\{required:\['value'\],optional:\['message'\],types:\{value:'typeName',message:'string'\}\},",r"\n  ASSERT_NE:\{required:\['value'\],optional:\['message','numericMode','absoluteTolerance','relativeTolerance'\],types:\{message:'string',numericMode:'numericMode',absoluteTolerance:'nonnegativeNumber',relativeTolerance:'nonnegativeNumber'\}\},"]:
    s,n=re.subn(pattern,'',s,count=1); assert n==1, pattern
old="const ASSERTION_OPS=new Set(['ASSERT_EXISTS','ASSERT_TYPE','ASSERT_NE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL']);"; assert old in s
s=s.replace(old,"const ASSERTION_OPS=new Set(['ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL']);",1)
s,n=re.subn(r"\n      case 'ASSERT_EXISTS':[^\n]+",'',s,count=1); assert n==1
s,n=re.subn(r"\n      case 'ASSERT_TYPE':\{[^\n]+",'',s,count=1); assert n==1
s,n=re.subn(r"\n      case 'ASSERT_NE':[^\n]+",'',s,count=1); assert n==1
p.write_text(s)

p=Path('workflow-engine.js'); s=p.read_text(); old="tests:Object.freeze({STATUS:'READY'})"; assert old in s
s=s.replace(old,"tests:Object.freeze({STATUS:'READY',EXECUTABLE_SPEC_VERSION:schema.TEST_IR.version})",1)
replacement='''function constructEvidenceChains(project){ensureShape(project);const scope=currentScope(project),requirements=mandatoryRequirements(project,scope),instructions=recordsForCurrentScope(project,'instructions'),product=recordsForCurrentScope(project,'products').at(-1),productId=recordId(product,'products'),executionId=String(recordValue(product,'EXECUTION_ID')||'').trim(),release=recordsForCurrentScope(project,'releaseRecords').at(-1),identities=recordsForCurrentScope(project,'artifactIdentities'),traces=recordsForCurrentScope(project,'instructionTraces'),created=[];
  const instructionById=new Map(instructions.map(record=>[recordId(record,'instructions'),record]));const traceByReq=new Map();for(const trace of traces){const reqId=String(recordValue(trace,'REQ_ID')||trace.relationships?.REQ_ID||'');if(reqId&&!traceByReq.has(reqId))traceByReq.set(reqId,trace);}
  const resultCollections=['verification','deterministicResults','meaningResults','adversarialResults'],resultEntries=[];for(const collection of resultCollections)for(const record of recordsForCurrentScope(project,collection))resultEntries.push({collection,record,reqId:resultRequirementId(project,record),testId:String(recordValue(record,'TEST_ID')||record.relationships?.TEST_ID||'')});
  const resultsByReq=new Map(),resultsByReqTest=new Map();for(const entry of resultEntries){if(entry.reqId){const list=resultsByReq.get(entry.reqId)||[];list.push(entry);resultsByReq.set(entry.reqId,list);}if(entry.reqId&&entry.testId){const key=entry.reqId+'|'+entry.testId,list=resultsByReqTest.get(key)||[];list.push(entry);resultsByReqTest.set(key,list);}}
  const priorByReq=new Map();for(const record of records(project,'evidenceChains',{active:false})){const reqId=String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'');if(reqId&&!record.invalidatedBy&&!priorByReq.has(reqId))priorByReq.set(reqId,record);}const authorizedIdentities=identities.filter(record=>upper(recordValue(record,'AUTHORIZATION'))==='AUTHORIZED'&&truth(recordValue(record,'EXACT_HASH_MATCH'))&&truth(recordValue(record,'EXACT_SIZE_MATCH'))),artifactIdentityComplete=identities.length>0&&authorizedIdentities.length===identities.length;
  for(const requirement of requirements){const reqId=requirementId(requirement),sourceId=String(recordValue(requirement,'SOURCE_ID')||requirement.relationships?.SOURCE_ID||recordValue(requirement,'USER_INPUT_RELATIONSHIP')||''),trace=traceByReq.get(reqId),instructionId=String(recordValue(trace,'INSTRUCTION_ID')||trace?.relationships?.INSTRUCTION_ID||'').trim(),instruction=instructionById.get(instructionId),tests=applicableTests(project,requirement),entries=resultsByReq.get(reqId)||[],evidenceIds=new Set(),missing=[];
    for(const entry of entries)for(const id of evidenceReferences(entry.record))evidenceIds.add(id);if(!sourceId)missing.push('AUTHORITY');if(!trace)missing.push('INSTRUCTION_TRACE');if(!instruction)missing.push('INSTRUCTION');if(!productId)missing.push('PRODUCT');if(productId&&!executionId)missing.push('EXECUTION');for(const test of tests){const tid=recordId(test,'tests'),testEntries=resultsByReqTest.get(reqId+'|'+tid)||[];if(!testEntries.length)missing.push('TEST_RESULT:'+tid);else for(const entry of testEntries){const result=entry.record,effective=effectiveDetermination(entry.collection,result,test,project),contract=evaluateEvidenceContract(test,result,null,project),sufficiency=evaluateEvidenceSufficiency(project,{requirement,test,result});if(effective!=='SATISFIED')missing.push('NON_SATISFIED_EFFECTIVE_RESULT:'+tid);if(!contract.sufficient||!sufficiency.sufficient)missing.push('INSUFFICIENT_EVIDENCE:'+tid);}}if(!tests.length)missing.push('TEST');if(!evidenceIds.size)missing.push('CANONICAL_EVIDENCE');if(!release)missing.push('RELEASE_DECISION');else if(upper(recordValue(release,'DETERMINATION'))!=='ACCEPTED')missing.push('RELEASE_NOT_ACCEPTED');if(!artifactIdentityComplete)missing.push('DELIVERY_ARTIFACT_IDENTITY');
    const prior=priorByReq.get(reqId),id=prior?recordId(prior,'evidenceChains'):allocateId(project,'evidenceChains'),fields={CHAIN_ID:id,REQ_ID:reqId,AUTHORITY_ID:sourceId||'UNKNOWN',INSTRUCTION_ID:instruction?instructionId:'UNKNOWN',EXECUTION_ID:executionId||'UNKNOWN',PRODUCT_ELEMENT:productId||'UNKNOWN',TEST_ID:tests.map(test=>recordId(test,'tests')),TEST_RESULT_ID:entries.map(entry=>entry.record.id||entry.record.recordId).filter(Boolean),EVIDENCE_ID:[...evidenceIds],RELEASE_DECISION_ID:recordId(release,'releaseRecords')||'UNKNOWN',ARTIFACT_HASH_IDENTITY:identities.map(record=>recordId(record,'artifactIdentities')),STATUS:missing.length?'INCOMPLETE':'COMPLETE',MISSING_LINKS:[...new Set(missing)]},record={id,stage:29,createdAt:prior?.createdAt||now(),updatedAt:now(),active:true,fields,...fields,scope:clone(scope),source:'APPLICATION_DERIVATION',derivationKey:'stage29.evidenceChains'};refreshRecordHashes(record,'evidenceChains');if(prior)Object.assign(prior,record);else project.projectData.evidenceChains.push(record);created.push(record);}
  addHistory(project,'EVIDENCE_CHAINS_CONSTRUCTED',{count:created.length,complete:created.filter(record=>record.STATUS==='COMPLETE').length});recalculate(project);return created;
}'''
s,n=re.subn(r'function constructEvidenceChains\(project\)\{.*?\n\}',replacement,s,count=1,flags=re.S); assert n==1
p.write_text(s)

p=Path('response-ingestion.js'); s=p.read_text(); anchor="        if(collection==='sources')for(const message of schema.sourceClassificationIssues(record.fields))issues.push(issue('INVALID_EXTERNAL_SOURCE',path,message));"; assert anchor in s
addition=anchor+"\n        if(collection==='tests'){const mode=upper(record.fields.EXECUTION_MODE),kind=upper(record.fields.EXECUTABLE_KIND);if(mode==='APPLICATION_DETERMINISTIC'||kind==='TEST_IR'){const candidate={fields:{...record.fields,EXECUTABLE_SPEC_VERSION:schema.TEST_IR.version}},shape=schema.validateTestIRTest(candidate);for(const message of shape.issues)issues.push(issue('INVALID_TEST_IR',path,message));const runtime=globalThis.closedLoopTestRuntime;if(!runtime)issues.push(issue('TEST_RUNTIME_UNAVAILABLE',path,'The application Test IR runtime is unavailable.'));else{const runtimeCheck=runtime.validateSpec(record.fields.EXECUTABLE_SPEC,record.fields.EXECUTABLE_INPUT_BINDINGS);for(const message of runtimeCheck.issues)issues.push(issue('INVALID_TEST_IR',path,message));}}}"
s=s.replace(anchor,addition,1)
old="      const fields={...workflow.applicationInitialFields(collection),...clone(proposed.fields||{})};\n      fields[definition.idField]=id;"; assert old in s
new="      const fields={...workflow.applicationInitialFields(collection),...clone(proposed.fields||{})};\n      if(collection==='tests'){fields.EXECUTABLE_SPEC_VERSION=schema.TEST_IR.version;const runtime=globalThis.closedLoopTestRuntime;if(String(fields.EXECUTABLE_KIND||'').toUpperCase()==='TEST_IR'&&runtime)fields.EXECUTABLE_SPEC_SHA256=hash.sha256Value(runtime.normalizeSpec(fields.EXECUTABLE_SPEC));else fields.EXECUTABLE_SPEC_SHA256=null;}\n      fields[definition.idField]=id;"
s=s.replace(old,new,1); p.write_text(s)

p=Path('app-core.js'); s=p.read_text(); s,n=re.subn(r'async function executeTestWorker\(spec,artifacts,timeoutMs=10000\)\{.*?\}\n(?=async function runNativeStage22Tests)', '', s, count=1, flags=re.S); assert n==1
old="const result=await executeTestWorker(engine.recordValue(test,'EXECUTABLE_SPEC'),artifactPayload);"; assert old in s
s=s.replace(old,"const runtime=globalThis.closedLoopTestRuntime;if(!runtime)throw new Error('Application Test IR runtime is unavailable.');const result=await runtime.executeTest(test,artifactPayload,{});",1); p.write_text(s)

p=Path('prompt-engine.js'); s=p.read_text(); old='Use EXECUTION_MODE = APPLICATION_DETERMINISTIC, REQUIRED_CAPABILITY = ${schema.TEST_IR.capability}, EXECUTABLE_KIND = TEST_IR, EXECUTABLE_SPEC_VERSION = ${schema.TEST_IR.version}, plus valid EXECUTABLE_SPEC and EXECUTABLE_INPUT_BINDINGS whenever the proposition can be represented faithfully.'; assert old in s
new='Use EXECUTION_MODE = APPLICATION_DETERMINISTIC, REQUIRED_CAPABILITY = ${schema.TEST_IR.capability}, EXECUTABLE_KIND = TEST_IR, plus valid EXECUTABLE_SPEC and EXECUTABLE_INPUT_BINDINGS whenever the proposition can be represented faithfully. Target Test IR version ${schema.TEST_IR.version}; the application owns and assigns EXECUTABLE_SPEC_VERSION and the normalized executable-spec SHA-256, so never write either application-owned field.'
s=s.replace(old,new,1); p.write_text(s)

# Restore full controlling verification/deployment workflow and remove this one-time repair file before committing.
normal=subprocess.check_output(['git','show','93abba63068aac8f01b14a0461e1a53c7271f1f7:.github/workflows/pages.yml'],text=True)
Path('.github/workflows/pages.yml').write_text(normal)
Path('repair-final.py').unlink()

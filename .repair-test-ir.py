from pathlib import Path
import re

ROOT=Path('.')

def read(name): return (ROOT/name).read_text()
def write(name,text): (ROOT/name).write_text(text)
def replace_once(text,old,new,label):
    count=text.count(old)
    if count!=1: raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old,new,1)
def regex_once(text,pattern,repl,label,flags=0):
    out,count=re.subn(pattern,repl,text,count=1,flags=flags)
    if count!=1: raise SystemExit(f'{label}: expected exactly one regex anchor, found {count}')
    return out

def add_partition_fields(text,collection,partition,fields):
    pattern=rf'("{re.escape(collection)}"\s*:\s*\{{.*?"{re.escape(partition)}"\s*:\s*\[)(.*?)(\])'
    m=re.search(pattern,text,re.S)
    if not m: raise SystemExit(f'ownership {collection}.{partition}: anchor missing')
    body=m.group(2)
    missing=[f for f in fields if f'"{f}"' not in body]
    if not missing: return text
    stripped=body.rstrip()
    suffix=body[len(stripped):]
    if stripped.strip(): stripped += ','
    indent='\n      '
    stripped += ''.join(f'{indent}"{f}"'+(',' if i<len(missing)-1 else '') for i,f in enumerate(missing))
    return text[:m.start(2)]+stripped+suffix+text[m.end(2):]

# ---- workflow-schema.js ----------------------------------------------------
s=read('workflow-schema.js')
s=replace_once(s,
"STAGE_OPERATIONS[19]=Object.freeze(['EXECUTE_RUN','VERIFY','COMPARE','REGRESSION_VERIFY','CONFIRM']);",
"STAGE_OPERATIONS[19]=Object.freeze(['CONFIRM_FREEZE','EXECUTE_RUN','VERIFY','COMPARE','REGRESSION_VERIFY','CONFIRM']);",
'Stage 19 operation contract')

s=add_partition_fields(s,'tests','agent',['EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS'])
s=add_partition_fields(s,'deterministicResults','application',['APPLICATION_DETERMINATION','RUNTIME_VERSION','TEST_SPEC_SHA256','INPUT_ARTIFACT_IDENTITIES','RUNTIME_OBSERVATIONS'])
s=add_partition_fields(s,'evidenceRecords','application',['APPLICATION_EVIDENCE_KIND','APPLICATION_EVIDENCE_DESCRIPTION','APPLICATION_EVIDENCE_CONTENT'])

s=replace_once(s,
"'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'",
"'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'",
'Test record field inventory')
s=replace_once(s,
"'RESULT_ID','PRODUCT_ID','PRODUCT_SHA256','TEST_ID','TOOL_AND_VERSION','PROCEDURE','EXPECTED_RESULT','ACTUAL_RESULT','DETERMINATION','EVIDENCE','DEFECT_ID'",
"'RESULT_ID','PRODUCT_ID','PRODUCT_SHA256','TEST_ID','APPLICATION_DETERMINATION','RUNTIME_VERSION','TEST_SPEC_SHA256','INPUT_ARTIFACT_IDENTITIES','RUNTIME_OBSERVATIONS','TOOL_AND_VERSION','PROCEDURE','EXPECTED_RESULT','ACTUAL_RESULT','DETERMINATION','EVIDENCE','DEFECT_ID'",
'Deterministic result field inventory')
s=replace_once(s,
"'EVIDENCE_ID','KIND','DESCRIPTION','AUTHORITY_TYPE','SOURCE_ID','LOCATION','CONTENT','ATTACHMENT_ID','SHA256','STATUS'",
"'EVIDENCE_ID','APPLICATION_EVIDENCE_KIND','APPLICATION_EVIDENCE_DESCRIPTION','APPLICATION_EVIDENCE_CONTENT','KIND','DESCRIPTION','AUTHORITY_TYPE','SOURCE_ID','LOCATION','CONTENT','ATTACHMENT_ID','SHA256','STATUS'",
'Evidence field inventory')

insert=r'''const TEST_IR=Object.freeze({
  version:'closed-loop-test-spec/1',
  capability:'CLOSED_LOOP_TEST_IR',
  executableKinds:Object.freeze(['NONE','CUSTOM_PIPELINE']),
  operations:Object.freeze(['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','SELECT_JSON_PATH','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','BYTE_COMPARE','ASSERT_EXISTS','ASSERT_TYPE','ASSERT_EQ','ASSERT_NE','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL']),
  limits:Object.freeze({maxSteps:64,maxTextBytes:16777216,maxCollectionItems:100000,maxRegexLength:2000,maxCsvCells:250000})
});
const TEST_IR_FORBIDDEN_STEP_KEYS=Object.freeze(['code','javascript','python','shell','command','eval','function','script']);
function validateTestIRSpec(spec){
  const issues=[];
  if(!spec||typeof spec!=='object'||Array.isArray(spec))issues.push('EXECUTABLE_SPEC must be an object.');
  if(spec?.version!==TEST_IR.version)issues.push(`EXECUTABLE_SPEC.version must be ${TEST_IR.version}.`);
  if(!Array.isArray(spec?.steps)||!spec.steps.length)issues.push('EXECUTABLE_SPEC.steps must be a non-empty array.');
  if((spec?.steps?.length||0)>TEST_IR.limits.maxSteps)issues.push(`EXECUTABLE_SPEC exceeds ${TEST_IR.limits.maxSteps} steps.`);
  for(const [index,step] of (spec?.steps||[]).entries()){
    if(!step||typeof step!=='object'||Array.isArray(step)){issues.push(`Step ${index} must be an object.`);continue;}
    if(!TEST_IR.operations.includes(step.op))issues.push(`Step ${index} uses unsupported operation ${String(step.op||'UNKNOWN')}.`);
    for(const key of TEST_IR_FORBIDDEN_STEP_KEYS)if(Object.prototype.hasOwnProperty.call(step,key))issues.push(`Step ${index} contains forbidden executable field ${key}.`);
    if((step.op==='REGEX'||step.op==='ASSERT_MATCH')&&String(step.pattern??step.value??'').length>TEST_IR.limits.maxRegexLength)issues.push(`Step ${index} regex exceeds the deterministic runtime limit.`);
  }
  return {valid:issues.length===0,issues};
}
function validateTestIRBindings(bindings){
  const issues=[];
  if(!bindings||typeof bindings!=='object'||Array.isArray(bindings))return {valid:false,issues:['EXECUTABLE_INPUT_BINDINGS must be an object.']};
  for(const [name,binding] of Object.entries(bindings)){
    if(!/^[A-Z][A-Z0-9_]{0,63}$/.test(name))issues.push(`Invalid Test IR binding name ${name}.`);
    if(typeof binding==='string'){if(!binding.trim())issues.push(`Binding ${name} is empty.`);continue;}
    if(!binding||typeof binding!=='object'||Array.isArray(binding)){issues.push(`Binding ${name} must be an artifact ID string or a binding object.`);continue;}
    const allowed=new Set(['artifactId','source','artifactRole','filename']);
    for(const key of Object.keys(binding))if(!allowed.has(key))issues.push(`Binding ${name} contains unsupported key ${key}.`);
    if(binding.source&&!['CURRENT_PRODUCT','CURRENT_SCOPE'].includes(binding.source))issues.push(`Binding ${name} has unsupported source ${binding.source}.`);
    if(!String(binding.artifactId||binding.artifactRole||binding.filename||'').trim())issues.push(`Binding ${name} does not identify an artifact.`);
  }
  return {valid:issues.length===0,issues};
}
function validateTestIRTest(test){
  const get=key=>test?.fields?.[key]??test?.[key];
  const issues=[];
  if(String(get('EXECUTION_MODE')||'').toUpperCase()!=='APPLICATION_DETERMINISTIC')issues.push('Test is not routed to APPLICATION_DETERMINISTIC.');
  if(String(get('REQUIRED_CAPABILITY')||'').trim()!==TEST_IR.capability)issues.push(`REQUIRED_CAPABILITY must be ${TEST_IR.capability}.`);
  if(String(get('EXECUTABLE_KIND')||'').toUpperCase()!=='CUSTOM_PIPELINE')issues.push('EXECUTABLE_KIND must be CUSTOM_PIPELINE.');
  if(get('EXECUTABLE_SPEC_VERSION')!==TEST_IR.version)issues.push(`EXECUTABLE_SPEC_VERSION must be ${TEST_IR.version}.`);
  issues.push(...validateTestIRSpec(get('EXECUTABLE_SPEC')).issues,...validateTestIRBindings(get('EXECUTABLE_INPUT_BINDINGS')).issues);
  return {valid:issues.length===0,issues};
}
const ADDITIONAL_RECORD_FIELD_TYPES=Object.freeze({
  TEST:Object.freeze({
    EXECUTABLE_KIND:Object.freeze({valueType:VALUE_TYPES.ENUM,enumValues:TEST_IR.executableKinds,nullable:true,normalizerKey:null,closedProperties:null}),
    EXECUTABLE_SPEC_VERSION:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),
    EXECUTABLE_SPEC:Object.freeze({valueType:VALUE_TYPES.OBJECT,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),
    EXECUTABLE_INPUT_BINDINGS:Object.freeze({valueType:VALUE_TYPES.OBJECT,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null})
  }),
  'DETERMINISTIC-RESULT':Object.freeze({
    APPLICATION_DETERMINATION:Object.freeze({valueType:VALUE_TYPES.ENUM,enumValues:Object.freeze(['SATISFIED','VIOLATED','UNDETERMINED']),nullable:true,normalizerKey:null,closedProperties:null}),
    RUNTIME_VERSION:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),
    TEST_SPEC_SHA256:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),
    INPUT_ARTIFACT_IDENTITIES:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),
    RUNTIME_OBSERVATIONS:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null})
  }),
  EVIDENCE:Object.freeze({
    APPLICATION_EVIDENCE_KIND:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),
    APPLICATION_EVIDENCE_DESCRIPTION:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),
    APPLICATION_EVIDENCE_CONTENT:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null})
  })
});

'''
s=replace_once(s,'function stageFieldDefinition(stage,name){',insert+'function stageFieldDefinition(stage,name){','Test IR schema descriptor insertion')
s=replace_once(s,
"const producer=ownerFromPartition(ownership,name,title),type=RECORD_FIELD_TYPE_OVERRIDES[prefix]?.[name]||EXPLICIT_RECORD_FIELD_TYPES[prefix]?.[name];",
"const producer=ownerFromPartition(ownership,name,title),type=ADDITIONAL_RECORD_FIELD_TYPES[prefix]?.[name]||RECORD_FIELD_TYPE_OVERRIDES[prefix]?.[name]||EXPLICIT_RECORD_FIELD_TYPES[prefix]?.[name];",
'Additional record type metadata lookup')
s=replace_once(s,
"19:Object.freeze({EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts'],agentWritableCollections:['runs'],allowedStageData:[]}),",
"19:Object.freeze({CONFIRM_FREEZE:Object.freeze({readCollections:['convergenceRecords','candidateFreezes','iterations'],agentWritableCollections:[],allowedStageData:[]}),EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts'],agentWritableCollections:['runs'],allowedStageData:[]}),",
'Stage 19 CONFIRM_FREEZE operation override')
s=replace_once(s,
"PRODUCER,RESPONSE_SCHEMA,RESPONSE_TYPES,CONFLICT_POLICIES,",
"PRODUCER,RESPONSE_SCHEMA,RESPONSE_TYPES,CONFLICT_POLICIES,TEST_IR,validateTestIRSpec,validateTestIRBindings,validateTestIRTest,",
'Export Test IR schema API')
write('workflow-schema.js',s)

# ---- workflow-engine.js ----------------------------------------------------
e=read('workflow-engine.js')
e=regex_once(e,r"const APPLICATION_TEST_EXECUTORS=Object\.freeze\(\{\}\);\s*function applicationTestCapabilities\(\)\{return Object\.freeze\(Object\.keys\(APPLICATION_TEST_EXECUTORS\)\);\}",
"function applicationTestCapabilities(){return Object.freeze([schema.TEST_IR.capability]);}\nfunction applicationTestSupported(test){return schema.validateTestIRTest(test).valid;}",
'Native executor registry replacement',re.S)
e=e.replace("Object.prototype.hasOwnProperty.call(APPLICATION_TEST_EXECUTORS,String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim())","applicationTestSupported(test)")
e=e.replace("Object.prototype.hasOwnProperty.call(APPLICATION_TEST_EXECUTORS,requiredCapability)","applicationTestSupported(test)")
if 'APPLICATION_TEST_EXECUTORS' in e: raise SystemExit('workflow-engine.js still references APPLICATION_TEST_EXECUTORS after Test IR routing patch')

e=replace_once(e,
"stage===19?['EXECUTE_RUN','VERIFY','COMPARE','REGRESSION_VERIFY','CONFIRM']:[]",
"stage===19?['CONFIRM_FREEZE','EXECUTE_RUN','VERIFY','COMPARE','REGRESSION_VERIFY','CONFIRM']:[]",
'Stage19 repeated-iteration operation set')

# Application-native evidence is authoritative only for application-runtime results.
e=replace_once(e,
"function claimedDetermination(collection,record){if(collection==='processAudits')",
"function claimedDetermination(collection,record){if(collection==='deterministicResults'&&record?.source==='APPLICATION_TEST_RUNTIME')return upper(recordValue(record,'APPLICATION_DETERMINATION'));if(collection==='processAudits')",
'Application deterministic claimed determination')

e=replace_once(e,
"function evaluateResultConsistency(collection,record,test,project){\n  const reasons=[],claimed=claimedDetermination(collection,record),evidence=evaluateEvidenceContract(test,record,null,project);let determination='UNDETERMINED';",
"function evaluateResultConsistency(collection,record,test,project){\n  const reasons=[],claimed=claimedDetermination(collection,record),evidence=evaluateEvidenceContract(test,record,null,project);let determination='UNDETERMINED';\n  if(collection==='deterministicResults'&&record?.source==='APPLICATION_TEST_RUNTIME'){const app=upper(recordValue(record,'APPLICATION_DETERMINATION')||'UNDETERMINED'),epistemic=evaluateEvidenceSufficiency(project,{requirement:records(project,'requirements').find(r=>requirementId(r)===resultRequirementId(project,record))||null,test,result:record});const nativeReasons=[...evidence.reasons,...epistemic.reasons];return {determination:nativeReasons.length&&app==='SATISFIED'?'UNDETERMINED':app,reasons:[...new Set(nativeReasons)],claimedDetermination:app,evidence};}",
'Application deterministic adjudication')

# Native evidence payload counts as canonical evidence and never needs an external context.
e=replace_once(e,
"for(const item of evidence){const authority=upper(recordValue(item,'AUTHORITY_TYPE')),attachmentId=String(recordValue(item,'ATTACHMENT_ID')||item?.relationships?.ATTACHMENT_ID||'').trim();if(adjudicationEmpty(recordValue(item,'KIND')))reasons.push('Canonical evidence kind is missing.');if(!authority||authority==='UNKNOWN')reasons.push('Canonical evidence authority type is missing or unknown.');if(adjudicationEmpty(recordValue(item,'CONTENT'))&&adjudicationEmpty(recordValue(item,'DESCRIPTION'))&&adjudicationEmpty(recordValue(item,'LOCATION')))reasons.push('Canonical evidence contains no preserved observation payload.');if(attachmentId&&attachmentId!=='UNKNOWN'){",
"for(const item of evidence){const native=item?.source==='APPLICATION_TEST_RUNTIME',authority=native?'APPLICATION':upper(recordValue(item,'AUTHORITY_TYPE')),attachmentId=String(recordValue(item,'ATTACHMENT_ID')||item?.relationships?.ATTACHMENT_ID||'').trim();if(adjudicationEmpty(native?recordValue(item,'APPLICATION_EVIDENCE_KIND'):recordValue(item,'KIND')))reasons.push('Canonical evidence kind is missing.');if(!authority||authority==='UNKNOWN')reasons.push('Canonical evidence authority type is missing or unknown.');if(adjudicationEmpty(native?recordValue(item,'APPLICATION_EVIDENCE_CONTENT'):recordValue(item,'CONTENT'))&&adjudicationEmpty(native?recordValue(item,'APPLICATION_EVIDENCE_DESCRIPTION'):recordValue(item,'DESCRIPTION'))&&adjudicationEmpty(recordValue(item,'LOCATION')))reasons.push('Canonical evidence contains no preserved observation payload.');if(attachmentId&&attachmentId!=='UNKNOWN'){",
'Application evidence contract recognition')

e=replace_once(e,
"const ids=evidenceReferences(result),evidence=ids.map(id=>records(project,'evidenceRecords').find(x=>recordId(x,'evidenceRecords')===id)).filter(Boolean),narrative=['EXACT_EVIDENCE','EVIDENCE','PROCESS_EVIDENCE','PRODUCT_EVIDENCE','CONTROLLING_EVIDENCE'].map(k=>String(recordValue(result,k)||'').trim()).find(Boolean)||'',",
"const ids=evidenceReferences(result),evidence=ids.map(id=>records(project,'evidenceRecords').find(x=>recordId(x,'evidenceRecords')===id)).filter(Boolean),nativeEvidence=evidence.filter(x=>x?.source==='APPLICATION_TEST_RUNTIME'),narrative=nativeEvidence.map(x=>String(recordValue(x,'APPLICATION_EVIDENCE_CONTENT')||recordValue(x,'APPLICATION_EVIDENCE_DESCRIPTION')||'').trim()).find(Boolean)||['EXACT_EVIDENCE','EVIDENCE','PROCESS_EVIDENCE','PRODUCT_EVIDENCE','CONTROLLING_EVIDENCE'].map(k=>String(recordValue(result,k)||'').trim()).find(Boolean)||'',",
'Application native evidence narrative')

# Stage 22 must consume effective determination, not raw agent field.
e=replace_once(e,
"if(results.some(record=>upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))reasons.push('A deterministic finished-product verification is violated or undetermined.');",
"if(results.some(record=>effectiveDetermination('deterministicResults',record,expected.find(t=>recordId(t,'tests')===String(recordValue(record,'TEST_ID')||record.relationships?.TEST_ID||'')),project)!=='SATISFIED'))reasons.push('A deterministic finished-product verification is violated or undetermined.');",
'Stage22 effective determination gate')

native_cmd=r'''function recordApplicationDeterministicResult(project,{testId,productId,runtimeResult,inputArtifacts=[]}={}){
  ensureShape(project);const tid=String(testId||''),pid=String(productId||'');const test=recordsForCurrentScope(project,'tests').find(r=>recordId(r,'tests')===tid),product=recordsForCurrentScope(project,'products').find(r=>recordId(r,'products')===pid);
  if(!test||!schema.validateTestIRTest(test).valid)throw new Error(`Test ${tid||'UNKNOWN'} is not a valid current application-native Test IR test.`);if(!product)throw new Error(`Product ${pid||'UNKNOWN'} is not the current product.`);
  const determination=upper(runtimeResult?.determination||'UNDETERMINED');if(!['SATISFIED','VIOLATED','UNDETERMINED'].includes(determination))throw new Error('Native deterministic runtime returned an invalid determination.');if(runtimeResult?.status!=='COMPLETE'&&determination!=='UNDETERMINED')throw new Error('Incomplete native runtime execution cannot claim a conclusive determination.');
  const spec=recordValue(test,'EXECUTABLE_SPEC'),specSha256=hash.sha256Value(spec),artifactIdentities=inputArtifacts.map(a=>({artifactId:String(a.artifactId),filename:String(a.filename||''),byteSize:Number(a.byteSize),sha256:String(a.sha256||'')}));
  if(!artifactIdentities.length)throw new Error('Application-native deterministic execution requires at least one exact input artifact identity.');for(const a of artifactIdentities){const canonical=recordsForCurrentScope(project,'artifacts').find(r=>recordId(r,'artifacts')===a.artifactId);if(!canonical||upper(recordValue(canonical,'AVAILABILITY'))!=='BYTES_PERSISTED_AND_VERIFIED'||String(recordValue(canonical,'SHA256'))!==a.sha256||Number(recordValue(canonical,'BYTE_SIZE'))!==a.byteSize)throw new Error(`Native deterministic input ${a.artifactId} is not application-verified current bytes.`);}
  const evidencePayload={testId:tid,productId:pid,determination,runtimeVersion:String(runtimeResult?.runtimeVersion||runtimeResult?.executorVersion||'closed-loop-test-runtime/1'),specVersion:String(runtimeResult?.specVersion||schema.TEST_IR.version),testSpecSha256:specSha256,inputArtifacts:artifactIdentities,observations:safe(runtimeResult?.observations),expected:runtimeResult?.expected??null,actual:runtimeResult?.actual??null};
  const identityHash=hash.sha256Value(evidencePayload),existing=recordsForCurrentScope(project,'deterministicResults').find(r=>r.source==='APPLICATION_TEST_RUNTIME'&&String(recordValue(r,'TEST_ID')||r.relationships?.TEST_ID||'')===tid&&String(recordValue(r,'PRODUCT_ID')||r.relationships?.PRODUCT_ID||'')===pid&&String(recordValue(r,'TEST_SPEC_SHA256')||'')===specSha256&&r.nativeExecutionIdentitySha256===identityHash);if(existing)return existing;
  if(recordsForCurrentScope(project,'deterministicResults').some(r=>String(recordValue(r,'TEST_ID')||r.relationships?.TEST_ID||'')===tid))throw new Error(`A current deterministic result already exists for ${tid}; invalidate/correct it before another result is committed.`);
  const evidence=commandRecord(project,'evidenceRecords',{APPLICATION_EVIDENCE_KIND:'APPLICATION_DETERMINISTIC_EXECUTION',APPLICATION_EVIDENCE_DESCRIPTION:`Application-native deterministic execution evidence for ${tid}.`,APPLICATION_EVIDENCE_CONTENT:JSON.stringify(evidencePayload),SHA256:identityHash,STATUS:'CURRENT'},{stage:22,source:'APPLICATION_TEST_RUNTIME'});
  const result=commandRecord(project,'deterministicResults',{PRODUCT_ID:pid,PRODUCT_SHA256:hash.sha256Value(artifactIdentities),TEST_ID:tid,APPLICATION_DETERMINATION:determination,RUNTIME_VERSION:evidencePayload.runtimeVersion,TEST_SPEC_SHA256:specSha256,INPUT_ARTIFACT_IDENTITIES:JSON.stringify(artifactIdentities),RUNTIME_OBSERVATIONS:JSON.stringify(safe(runtimeResult?.observations))},{stage:22,source:'APPLICATION_TEST_RUNTIME'});result.relationships={...(result.relationships||{}),PRODUCT_ID:pid,TEST_ID:tid};result.evidenceRefs=[recordId(evidence,'evidenceRecords')];result.nativeExecutionIdentitySha256=identityHash;refreshRecordHashes(result,'deterministicResults');addHistory(project,'APPLICATION_TEST_EXECUTED',{stage:22,recordId:recordId(result,'deterministicResults'),testId:tid,productId:pid,determination,evidenceId:recordId(evidence,'evidenceRecords'),testSpecSha256:specSha256,inputArtifactIds:artifactIdentities.map(x=>x.artifactId)});recalculate(project);return result;
}
'''
e=replace_once(e,'function operationalMetrics(project){',native_cmd+'function operationalMetrics(project){','Native deterministic result command insertion')
e=replace_once(e,
"registerArtifactBytes,freezeCandidate,beginUnchangedConfirmationIteration,freezeBaseline,reserveProductExecution,createNewJobReset,",
"registerArtifactBytes,freezeCandidate,beginUnchangedConfirmationIteration,freezeBaseline,reserveProductExecution,createNewJobReset,recordApplicationDeterministicResult,",
'Export native deterministic result command')
write('workflow-engine.js',e)

# ---- prompt-engine.js ------------------------------------------------------
p=read('prompt-engine.js')
ir_prompt=r'''${stage===6?`CLOSED LOOP TEST IR — APPLICATION-OWNED DETERMINISTIC LANGUAGE
Version: ${schema.TEST_IR.version}
Registered capability: ${schema.TEST_IR.capability}
Supported operations: ${schema.TEST_IR.operations.join(', ')}

For every proposed test, first decide whether the proposition can be represented exactly and safely using only this grammar. If yes, you MUST use EXECUTION_MODE = APPLICATION_DETERMINISTIC, REQUIRED_CAPABILITY = ${schema.TEST_IR.capability}, EXECUTABLE_KIND = CUSTOM_PIPELINE, EXECUTABLE_SPEC_VERSION = ${schema.TEST_IR.version}, and provide EXECUTABLE_SPEC plus EXECUTABLE_INPUT_BINDINGS. The executable specification is a test definition, not proof that execution occurred. Do not invent operations, parsers, code, shell commands, JavaScript, Python, or hidden executable behavior. If the proposition cannot be faithfully reduced to this language, set EXECUTABLE_KIND = NONE and route it to the correct independent agent, human, or external system. Subject/domain meaning belongs in the requirement/test design; the runtime remains domain-blind.

EXECUTABLE_SPEC shape:
{"version":"${schema.TEST_IR.version}","steps":[{"op":"<one supported operation>","...":"operation parameters"}]}
EXECUTABLE_INPUT_BINDINGS is an object whose keys are uppercase binding names and whose values are either an exact ARTIFACT_ID string or a closed object using only artifactId, source (CURRENT_PRODUCT or CURRENT_SCOPE), artifactRole, and filename. Never claim browser-local bytes have been transferred merely because a binding identifies them.

`:''}'''
p=replace_once(p,"${[6,12].includes(stage)?`APPLICATION-NATIVE TEST CAPABILITIES",ir_prompt+"${[6,12,22].includes(stage)?`APPLICATION-NATIVE TEST CAPABILITIES",'Stage6 Test IR prompt grammar')
write('prompt-engine.js',p)

# ---- project-store.js ------------------------------------------------------
ps=read('project-store.js')
package_fn=r'''async function createExecutionPackage({project,stage,testIds=[],productId=null}={}){
  if(!project||typeof project!=='object')throw new Error('A canonical project is required for an execution package.');const engine=globalThis.closedLoopWorkflowEngine,jobId=projectIdentity(project),ids=[...new Set(testIds.map(String).filter(Boolean))],plan=engine.executionHandoff(project,{stage:Number(stage),testIds:ids}),artifactIds=[...new Set(plan.send.map(x=>String(x.artifactId||'')).filter(Boolean))],artifactEntries=[];
  for(const artifactId of artifactIds){const canonical=engine.records(project,'artifacts').find(r=>engine.recordId(r,'artifacts')===artifactId&&engine.isActiveRecord(r));if(!canonical)throw storageError(`Execution-package artifact ${artifactId} is not current canonical state.`,'EXECUTION_PACKAGE_ARTIFACT_STALE');const row=await getArtifact(artifactId);if(!row||String(row.jobId)!==jobId)throw storageError(`Execution-package artifact ${artifactId} has no stored bytes for ${jobId}.`,'EXECUTION_PACKAGE_BYTES_MISSING');const bytes=new Uint8Array(await row.blob.arrayBuffer()),sha256=await hash.sha256Bytes(bytes),byteSize=bytes.byteLength,expectedSha=String(engine.recordValue(canonical,'SHA256')||''),expectedSize=Number(engine.recordValue(canonical,'BYTE_SIZE'));if(sha256!==expectedSha||byteSize!==expectedSize)throw storageError(`Execution-package artifact ${artifactId} failed byte identity verification.`,'EXECUTION_PACKAGE_ARTIFACT_MISMATCH');artifactEntries.push({artifactId,filename:String(engine.recordValue(canonical,'FILENAME')||row.filename||artifactId),mediaType:String(row.mediaType||'application/octet-stream'),byteSize,sha256,role:String(engine.recordValue(canonical,'ROLE')||''),base64:bytesToBase64(bytes)});}
  const tests=engine.records(project,'tests').filter(t=>ids.includes(engine.recordId(t,'tests'))).map(t=>({testId:engine.recordId(t,'tests'),requirementId:String(engine.recordValue(t,'REQ_ID')||t.relationships?.REQ_ID||''),fields:clone(t.fields||{}),relationships:clone(t.relationships||{})}));const manifest={schema:'closed-loop-verification-package/1',workflow:project.workflow,projectSchema:project.schema,responseSchema:globalThis.closedLoopWorkflowSchema?.RESPONSE_SCHEMA,jobId,stage:Number(stage),productId:productId||project.job?.CURRENT_PRODUCT_ID||null,testIds:ids,artifacts:artifactEntries.map(({base64,...x})=>x),handoff:clone(plan),createdAt:now()};const body={manifest,tests,artifacts:artifactEntries},packageSha256=hash.sha256Value(body),payload={...body,packageSha256};const compressed=await compressBytes(new TextEncoder().encode(JSON.stringify(payload)));return {blob:new Blob([compressed],{type:'application/gzip'}),filename:`VERIFY-${jobId}-STAGE-${String(stage).padStart(2,'0')}.clverify.gz`,manifest,packageSha256};
}
'''
ps=replace_once(ps,'async function storageHealth(){',package_fn+'async function storageHealth(){','Execution package function insertion')
ps=replace_once(ps,
'putArtifact,getArtifact,deleteArtifact,listArtifacts,verifyProjectArtifacts,exportPackage,importPackage,storageHealth,',
'putArtifact,getArtifact,deleteArtifact,listArtifacts,verifyProjectArtifacts,createExecutionPackage,exportPackage,importPackage,storageHealth,',
'Export createExecutionPackage')
write('project-store.js',ps)

# ---- app-core.js -----------------------------------------------------------
a=read('app-core.js')
runner=r'''function nativeStage22Tests(){if(Number(current?.activeStage)!==22)return [];const productId=String(current.job?.CURRENT_PRODUCT_ID||''),existing=new Set(engine.records(current,'deterministicResults').filter(r=>engine.isActiveRecord(r)).map(r=>String(engine.recordValue(r,'TEST_ID')||r.relationships?.TEST_ID||'')));return engine.testExecutionPlan(current).items.filter(item=>item.executionMode==='APPLICATION_DETERMINISTIC'&&item.executableNow&&!existing.has(item.testId)&&engine.records(current,'tests').some(t=>engine.recordId(t,'tests')===item.testId&&schema.validateTestIRTest(t).valid)&&productId);}
function resolveNativeBinding(test,bindingName,binding){const currentArtifacts=engine.recordsForCurrentScope(current,'artifacts').filter(r=>engine.isActiveRecord(r)&&String(engine.recordValue(r,'AVAILABILITY')||'').toUpperCase()==='BYTES_PERSISTED_AND_VERIFIED'),productId=String(current.job.CURRENT_PRODUCT_ID||'');let matches=[];if(typeof binding==='string')matches=currentArtifacts.filter(a=>engine.recordId(a,'artifacts')===binding);else{matches=currentArtifacts.filter(a=>{if(binding.artifactId&&engine.recordId(a,'artifacts')!==String(binding.artifactId))return false;if(binding.filename&&String(engine.recordValue(a,'FILENAME')||'')!==String(binding.filename))return false;if(binding.artifactRole&&String(engine.recordValue(a,'ROLE')||'')!==String(binding.artifactRole))return false;if(binding.source==='CURRENT_PRODUCT'&&String(a.scope?.productId||'')!==productId)return false;return true;});}if(matches.length!==1)throw new Error(`Test ${engine.recordId(test,'tests')} binding ${bindingName} resolved to ${matches.length} verified current artifacts; exactly one is required.`);return matches[0];}
async function executeTestWorker(spec,artifacts,timeoutMs=10000){return new Promise((resolve,reject)=>{const worker=new Worker('test-worker.js'),requestId='TEST-RUN-'+crypto.randomUUID(),timer=setTimeout(()=>{worker.terminate();reject(new Error('Deterministic test exceeded its execution time limit.'));},timeoutMs);worker.onmessage=event=>{if(event.data?.requestId!==requestId)return;clearTimeout(timer);worker.terminate();resolve(event.data.result);};worker.onerror=event=>{clearTimeout(timer);worker.terminate();reject(new Error(event.message||'Deterministic test worker failed.'));};worker.postMessage({requestId,spec,artifacts});});}
async function runNativeStage22Tests(){const items=nativeStage22Tests();if(!items.length){announce('no pending automatic tests');return;}const next=clone(current),productId=String(current.job.CURRENT_PRODUCT_ID||'');try{const staged=[];for(const item of items){const test=engine.records(current,'tests').find(t=>engine.recordId(t,'tests')===item.testId),bindings=engine.recordValue(test,'EXECUTABLE_INPUT_BINDINGS')||{},artifactPayload={},identities=[];for(const [bindingName,binding] of Object.entries(bindings)){const canonical=resolveNativeBinding(test,bindingName,binding),artifactId=engine.recordId(canonical,'artifacts'),row=await projectStore.getArtifact(artifactId);if(!row)throw new Error(`Stored bytes are missing for ${artifactId}.`);const bytes=new Uint8Array(await row.blob.arrayBuffer()),actualSha=globalThis.closedLoopHash.sha256Bytes?await globalThis.closedLoopHash.sha256Bytes(bytes):row.sha256,expectedSha=String(engine.recordValue(canonical,'SHA256')||''),expectedSize=Number(engine.recordValue(canonical,'BYTE_SIZE'));if(bytes.byteLength!==expectedSize||actualSha!==expectedSha)throw new Error(`Stored bytes for ${artifactId} no longer match canonical identity.`);artifactPayload[bindingName]={artifactId,filename:String(engine.recordValue(canonical,'FILENAME')||row.filename),sha256:actualSha,byteSize:bytes.byteLength,bytes};identities.push({artifactId,filename:String(engine.recordValue(canonical,'FILENAME')||row.filename),sha256:actualSha,byteSize:bytes.byteLength});}const result=await executeTestWorker(engine.recordValue(test,'EXECUTABLE_SPEC'),artifactPayload);if(result?.status==='EXECUTION_FAILED')throw new Error(`${item.testId}: ${result.error||'deterministic execution failed'}`);staged.push({testId:item.testId,result,inputArtifacts:identities});}for(const item of staged)engine.recordApplicationDeterministicResult(next,{testId:item.testId,productId,runtimeResult:item.result,inputArtifacts:item.inputArtifacts});await persistReplacement(next);announce(`automatic verification complete: ${staged.length} test${staged.length===1?'':'s'} executed`);render();}catch(error){announce('automatic verification blocked');alert(`Automatic verification did not commit any partial result: ${error.message||error}`);}}
async function downloadExecutionPackage(){try{const stage=Number(current.activeStage),plan=engine.testExecutionPlan(current),ids=plan.items.filter(item=>item.executionMode!=='APPLICATION_DETERMINISTIC'&&item.operatorAction!=='NO_ACTION').map(item=>item.testId);if(!ids.length)throw new Error('No external verification package is required for the current state.');const pkg=await projectStore.createExecutionPackage({project:current,stage,testIds:ids,productId:current.job.CURRENT_PRODUCT_ID});const url=URL.createObjectURL(pkg.blob),link=document.createElement('a');link.href=url;link.download=pkg.filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);announce('verification package prepared');}catch(error){announce('verification package blocked');alert(error.message||error);}}
'''
a=replace_once(a,'function projectManagementMarkup(){',runner+'function projectManagementMarkup(){','App native test runner insertion')

# Primary action buttons live in existing execution guidance; technical data remains advanced.
a=replace_once(a,
"const summaryRows=items.map(item=>`<div class=\"record-row\"><div class=\"record-key\">${esc(item.testId)} · ${esc(item.requirementId||'NO REQUIREMENT')}</div><div class=\"record-value\">${esc(actionLabel[item.operatorAction]||item.operatorAction)}${item.blockingReason?`<br><span class=\"help\">${esc(item.blockingReason)}</span>`:''}</div></div>`).join('');",
"const summaryRows=items.map(item=>`<div class=\"record-row\"><div class=\"record-key\">${esc(item.testId)} · ${esc(item.requirementId||'NO REQUIREMENT')}</div><div class=\"record-value\">${esc(actionLabel[item.operatorAction]||item.operatorAction)}${item.blockingReason?`<br><span class=\"help\">${esc(item.blockingReason)}</span>`:''}</div></div>`).join(''),nativePending=n===22?nativeStage22Tests():[],externalPending=items.filter(item=>item.executionMode!=='APPLICATION_DETERMINISTIC'&&item.operatorAction!=='NO_ACTION'&&item.operatorAction!=='BLOCKED');",
'Execution guidance pending action derivation')
a=replace_once(a,
"return `<div class=\"panel\"><h2 class=\"section-title\">What you need to do now</h2><p class=\"section-intro\">Execution responsibility and file transfer are derived from the canonical Stage 6 tests. The application does not ask you to infer who runs a test or which bytes must move.</p><div class=\"record-rows\">${summaryRows}</div>${send}${withhold}${back}${downloads}<details class=\"record-card\"><summary>Advanced verification details<span>Audit</span></summary><div class=\"record-body\">${items.map(item=>details(item.testId,item)).join('')}</div></details></div>`;",
"return `<div class=\"panel\"><h2 class=\"section-title\">What you need to do now</h2><p class=\"section-intro\">Execution responsibility and file transfer are derived from the canonical Stage 6 tests. The application does not ask you to infer who runs a test or which bytes must move.</p>${nativePending.length?`<div class=\"button-row\"><button class=\"primary\" id=\"run-native-tests\" type=\"button\">Run ${nativePending.length} automatic test${nativePending.length===1?'':'s'}</button></div>`:''}${externalPending.length?`<div class=\"button-row\"><button id=\"download-execution-package\" type=\"button\">Download verification package</button></div>`:''}<div class=\"record-rows\">${summaryRows}</div>${send}${withhold}${back}${downloads}<details class=\"record-card\"><summary>Advanced verification details<span>Audit</span></summary><div class=\"record-body\">${items.map(item=>details(item.testId,item)).join('')}</div></details></div>`;",
'Execution guidance primary buttons')
a=replace_once(a,
"if($('#verify-stored-files'))$('#verify-stored-files').onclick=verifyStoredFilesNow;",
"if($('#verify-stored-files'))$('#verify-stored-files').onclick=verifyStoredFilesNow;if($('#run-native-tests'))$('#run-native-tests').onclick=runNativeStage22Tests;if($('#download-execution-package'))$('#download-execution-package').onclick=downloadExecutionPackage;",
'Wire automatic test and package actions')
write('app-core.js',a)

# ---- verify-test-runtime.mjs ----------------------------------------------
vt=r'''import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const context={console,TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,structuredClone,crypto:globalThis.crypto};context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync('test-runtime.js','utf8'),context,{filename:'test-runtime.js'});const runtime=context.closedLoopTestRuntime;
assert.equal(runtime.CAPABILITY,'CLOSED_LOOP_TEST_IR');assert.equal(runtime.SPEC_VERSION,'closed-loop-test-spec/1');assert.ok(runtime.OPS.includes('BYTE_COMPARE'));assert.ok(!runtime.OPS.some(x=>/JAVASCRIPT|PYTHON|SHELL/i.test(x)));
const invalid=runtime.validateSpec({version:runtime.SPEC_VERSION,steps:[{op:'ASSERT_EQ',value:1,javascript:'alert(1)'}]});assert.equal(invalid.valid,false);
const test={EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:runtime.CAPABILITY,EXECUTABLE_KIND:'CUSTOM_PIPELINE',EXECUTABLE_SPEC_VERSION:runtime.SPEC_VERSION,EXECUTABLE_INPUT_BINDINGS:{PRODUCT:'ARTIFACT-1'},EXECUTABLE_SPEC:{version:runtime.SPEC_VERSION,steps:[{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_JSON'},{op:'SELECT_JSON_PATH',path:'$.records'},{op:'COUNT'},{op:'ASSERT_EQ',value:2}]}};assert.equal(runtime.supports(test),true);
const bytes=new TextEncoder().encode(JSON.stringify({records:[1,2]}));const result=await runtime.execute({spec:test.EXECUTABLE_SPEC,artifacts:{PRODUCT:{artifactId:'ARTIFACT-1',filename:'data.json',sha256:'x'.repeat(64),bytes}}});assert.equal(result.determination,'SATISFIED');
const failed=await runtime.execute({spec:{...test.EXECUTABLE_SPEC,steps:[...test.EXECUTABLE_SPEC.steps.slice(0,-1),{op:'ASSERT_EQ',value:3}]},artifacts:{PRODUCT:{artifactId:'ARTIFACT-1',filename:'data.json',sha256:'x'.repeat(64),bytes}}});assert.equal(failed.determination,'VIOLATED');
console.log('verify-test-runtime: PASS');
'''
write('verify-test-runtime.mjs',vt)

# ---- permanent CI ----------------------------------------------------------
y=read('.github/workflows/pages.yml')
if 'node --check test-runtime.js' not in y:
    y=replace_once(y,'node --check app-core.js','node --check app-core.js\n          node --check test-runtime.js\n          node --check test-worker.js\n          node --check verify-test-runtime.mjs','CI syntax coverage for Test IR')
if 'node verify-test-runtime.mjs' not in y:
    anchor='- name: Verify complete application model'
    if anchor in y:
        y=y.replace(anchor,"- name: Verify generic deterministic Test IR\n        run: node verify-test-runtime.mjs\n\n      "+anchor,1)
    else:
        raise SystemExit('CI test insertion anchor missing')
write('.github/workflows/pages.yml',y)

# ---- extend existing deterministic acceptance without duplicating suites --
vc=read('verify-complete.mjs')
extra=r'''
// Generic subject-neutral Test IR is a real registered application-native route, not a prose-only capability claim.
assert.equal(schema.TEST_IR.version,'closed-loop-test-spec/1');
assert.equal(schema.TEST_IR.capability,'CLOSED_LOOP_TEST_IR');
assert.ok(schema.TEST_IR.operations.includes('PARSE_JSON')&&schema.TEST_IR.operations.includes('BYTE_COMPARE'));
assert.ok(!schema.TEST_IR.operations.some(op=>/JAVASCRIPT|PYTHON|SHELL/i.test(op)));
assert.deepEqual(schema.STAGE_OPERATIONS[19],['CONFIRM_FREEZE','EXECUTE_RUN','VERIFY','COMPARE','REGRESSION_VERIFY','CONFIRM']);
{
  const native={fields:{EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',EXECUTABLE_KIND:'CUSTOM_PIPELINE',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_INPUT_BINDINGS:{PRODUCT:'ARTIFACT-TEST'},EXECUTABLE_SPEC:{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'HASH_SHA256'},{op:'ASSERT_EQ',value:'0'.repeat(64)}]}}};
  assert.equal(schema.validateTestIRTest(native).valid,true);
  assert.equal(engine.applicationTestCapabilities().includes('CLOSED_LOOP_TEST_IR'),true);
}
'''
if 'Generic subject-neutral Test IR is a real registered application-native route' not in vc:
    idx=vc.rfind("console.log(")
    if idx<0: raise SystemExit('verify-complete console anchor missing')
    vc=vc[:idx]+extra+vc[idx:]
write('verify-complete.mjs',vc)

print('one-time Test IR repair applied')

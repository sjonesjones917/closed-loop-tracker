import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const write=(path,text)=>fs.writeFileSync(path,text);
const replaceOnce=(text,from,to,label)=>{
  const i=text.indexOf(from);
  if(i<0)throw new Error(`Repair anchor not found: ${label}`);
  if(text.indexOf(from,i+1)>=0)throw new Error(`Repair anchor is ambiguous: ${label}`);
  return text.slice(0,i)+to+text.slice(i+from.length);
};
const replaceRegexOnce=(text,re,to,label)=>{
  const probe=new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g');
  const matches=[...text.matchAll(probe)];
  if(matches.length!==1)throw new Error(`Repair regex ${label} matched ${matches.length} times.`);
  return text.replace(re,to);
};

// Extend the existing TEST record with one small subject-neutral declarative Test IR.
{
  const path='workflow-schema.js';let s=read(path);
  s=replaceOnce(s,
`      "ARTIFACT_REQUIREMENTS",\n      "INPUTS",`,
`      "ARTIFACT_REQUIREMENTS",\n      "EXECUTABLE_KIND",\n      "EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC",\n      "EXECUTABLE_INPUT_BINDINGS",\n      "INPUTS",`,'TEST ownership fields');
  s=replaceOnce(s,
`    'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'`,
`    'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS','INPUTS','TOOLS','PROCEDURE','EXPECTED_RESULT','FAILURE_CONDITION','EVIDENCE_TO_PRESERVE','STATUS'`,'TEST record field list');
  s=replaceOnce(s,
`    ARTIFACT_REQUIREMENTS:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})`,
`    ARTIFACT_REQUIREMENTS:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),\n    EXECUTABLE_KIND:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['NONE','PIPELINE']),nullable:false,normalizerKey:null,closedProperties:null}),\n    EXECUTABLE_SPEC_VERSION:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),\n    EXECUTABLE_SPEC:Object.freeze({valueType:'OBJECT',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:Object.freeze(['version','steps'])}),\n    EXECUTABLE_INPUT_BINDINGS:Object.freeze({valueType:'OBJECT',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})`,'TEST IR type overrides');
  write(path,s);
}

// Register and implement one safe generic native capability inside the existing workflow engine.
{
  const path='workflow-engine.js';let s=read(path);
  const block=String.raw`
const APPLICATION_TEST_IR_VERSION='closed-loop-test-spec/1';
const APPLICATION_TEST_IR_CAPABILITY='CLOSED_LOOP_TEST_IR_V1';
const APPLICATION_TEST_IR_OPERATIONS=Object.freeze([
  'LOAD_ARTIFACT','READ_BYTES','READ_METADATA','DECODE_UTF8','PARSE_JSON','SELECT','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256',
  'ASSERT_EQ','ASSERT_NE','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL'
]);
const APPLICATION_TEST_IR_SOURCES=Object.freeze(['SUBJECT','TEST_INPUT']);
function applicationTestIrContract(){return Object.freeze({version:APPLICATION_TEST_IR_VERSION,capability:APPLICATION_TEST_IR_CAPABILITY,kind:'PIPELINE',sources:APPLICATION_TEST_IR_SOURCES,operations:APPLICATION_TEST_IR_OPERATIONS,limits:Object.freeze({maxSteps:128,maxSelectDepth:64,maxCollectionItems:100000,maxDecodedTextBytes:5*1024*1024})});}
function validateApplicationTestSpec(test){
  const mode=upper(recordValue(test,'EXECUTION_MODE')),kind=upper(recordValue(test,'EXECUTABLE_KIND')||'NONE'),type=upper(recordValue(test,'TEST_TYPE'));
  if(mode!=='APPLICATION_DETERMINISTIC')return {valid:true,kind:'NONE',reason:null};
  if(type!=='DETERMINISTIC')return {valid:false,kind,reason:'APPLICATION_DETERMINISTIC is only valid for TEST_TYPE = DETERMINISTIC.'};
  if(String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim()!==APPLICATION_TEST_IR_CAPABILITY)return {valid:false,kind,reason:'APPLICATION_DETERMINISTIC must use '+APPLICATION_TEST_IR_CAPABILITY+'.'};
  if(kind!=='PIPELINE')return {valid:false,kind,reason:'APPLICATION_DETERMINISTIC requires EXECUTABLE_KIND = PIPELINE.'};
  const version=String(recordValue(test,'EXECUTABLE_SPEC_VERSION')||'').trim(),spec=recordValue(test,'EXECUTABLE_SPEC'),bindings=recordValue(test,'EXECUTABLE_INPUT_BINDINGS');
  if(version!==APPLICATION_TEST_IR_VERSION)return {valid:false,kind,reason:'Executable test specification version must be '+APPLICATION_TEST_IR_VERSION+'.'};
  if(!spec||typeof spec!=='object'||Array.isArray(spec)||spec.version!==APPLICATION_TEST_IR_VERSION||!Array.isArray(spec.steps)||!spec.steps.length)return {valid:false,kind,reason:'EXECUTABLE_SPEC must contain a non-empty '+APPLICATION_TEST_IR_VERSION+' steps array.'};
  if(spec.steps.length>128)return {valid:false,kind,reason:'Executable test contains more than 128 steps.'};
  if(!bindings||typeof bindings!=='object'||Array.isArray(bindings))return {valid:false,kind,reason:'EXECUTABLE_INPUT_BINDINGS must be an object.'};
  let assertionCount=0;
  for(let index=0;index<spec.steps.length;index++){
    const step=spec.steps[index];if(!step||typeof step!=='object'||Array.isArray(step))return {valid:false,kind,reason:'Executable step '+index+' is not an object.'};
    const op=upper(step.op);if(!APPLICATION_TEST_IR_OPERATIONS.includes(op))return {valid:false,kind,reason:'Unsupported executable operation '+String(step.op||'MISSING')+'.'};
    if(op==='LOAD_ARTIFACT'){
      const binding=bindings[String(step.binding||'')];if(!binding||typeof binding!=='object')return {valid:false,kind,reason:'LOAD_ARTIFACT references an undefined binding.'};
      if(!APPLICATION_TEST_IR_SOURCES.includes(upper(binding.source)))return {valid:false,kind,reason:'Executable binding source must be SUBJECT or TEST_INPUT.'};
      if(!Number.isInteger(Number(binding.index))||Number(binding.index)<0)return {valid:false,kind,reason:'Executable binding index must be a non-negative integer.'};
    }
    if(op.startsWith('ASSERT_'))assertionCount++;
  }
  if(!assertionCount)return {valid:false,kind,reason:'Executable test must contain at least one ASSERT operation.'};
  return {valid:true,kind,reason:null,version,spec,bindings,assertionCount};
}
const pointerSelect=(value,pointer)=>{
  const raw=String(pointer??'');if(raw==='')return value;
  if(!raw.startsWith('/'))throw new Error('SELECT path must be an RFC 6901 JSON Pointer beginning with /.');
  const parts=raw.slice(1).split('/').map(x=>x.replaceAll('~1','/').replaceAll('~0','~'));if(parts.length>64)throw new Error('SELECT path exceeds maximum depth.');
  let current=value;for(const part of parts){if(current===null||current===undefined)return undefined;if(Array.isArray(current)){const n=Number(part);if(!Number.isInteger(n)||n<0||n>=current.length)return undefined;current=current[n];}else if(typeof current==='object'){current=current[part];}else return undefined;}return current;
};
const sameValue=(a,b)=>hash.sha256Value(a)===hash.sha256Value(b);
const comparableNumber=value=>{const n=Number(value);if(!Number.isFinite(n))throw new Error('Numeric assertion received a non-finite value.');return n;};
const normalizeActual=value=>value instanceof Uint8Array?{byteLength:value.byteLength}:value;
async function executeApplicationTest(test,inputs={}){
  const validation=validateApplicationTestSpec(test);if(!validation.valid)throw new Error(validation.reason||'Application-native test specification is invalid.');
  let value=null;const trace=[],assertions=[];
  const boundArtifact=name=>{const binding=validation.bindings[String(name||'')],source=upper(binding?.source),index=Number(binding?.index),list=safe(inputs?.[source]);const artifact=list[index];if(!artifact)throw new Error('Executable binding '+String(name||'')+' does not resolve to supplied '+source+' input '+index+'.');return artifact;};
  const assertStep=(op,expected,passed)=>{const row={op,expected:clone(expected),actual:clone(normalizeActual(value)),passed:Boolean(passed)};assertions.push(row);trace.push(row);};
  for(let index=0;index<validation.spec.steps.length;index++){
    const step=validation.spec.steps[index],op=upper(step.op);
    if(op==='LOAD_ARTIFACT'){value=boundArtifact(step.binding);trace.push({op,binding:String(step.binding||''),artifactId:String(value?.artifactId||'VIRTUAL')});continue;}
    if(op==='READ_BYTES'){if(!value?.bytes)throw new Error('READ_BYTES requires an artifact value with bytes.');value=value.bytes instanceof Uint8Array?value.bytes:new Uint8Array(value.bytes);trace.push({op,byteLength:value.byteLength});continue;}
    if(op==='READ_METADATA'){if(!value?.metadata||typeof value.metadata!=='object')throw new Error('READ_METADATA requires an artifact value.');const field=String(step.field||'');value=value.metadata[field];trace.push({op,field,value:normalizeActual(value)});continue;}
    if(op==='DECODE_UTF8'){if(!(value instanceof Uint8Array))throw new Error('DECODE_UTF8 requires byte input.');if(value.byteLength>5*1024*1024)throw new Error('Decoded text input exceeds the 5 MiB native-test limit.');value=new TextDecoder('utf-8',{fatal:true}).decode(value);trace.push({op,length:value.length});continue;}
    if(op==='PARSE_JSON'){if(typeof value!=='string')throw new Error('PARSE_JSON requires decoded text.');value=JSON.parse(value);trace.push({op});continue;}
    if(op==='SELECT'){value=pointerSelect(value,step.path);trace.push({op,path:String(step.path||''),value:normalizeActual(value)});continue;}
    if(op==='COUNT'){if(Array.isArray(value)||typeof value==='string')value=value.length;else if(value&&typeof value==='object')value=Object.keys(value).length;else throw new Error('COUNT requires an array, object, or string.');trace.push({op,value});continue;}
    if(op==='SUM'||op==='MIN'||op==='MAX'){if(!Array.isArray(value)||value.length>100000)throw new Error(op+' requires an array within the native collection limit.');const nums=value.map(comparableNumber);value=op==='SUM'?nums.reduce((a,b)=>a+b,0):op==='MIN'?Math.min(...nums):Math.max(...nums);trace.push({op,value});continue;}
    if(op==='SORT'){if(!Array.isArray(value)||value.length>100000)throw new Error('SORT requires an array within the native collection limit.');value=[...value].sort((a,b)=>String(a).localeCompare(String(b)));trace.push({op,count:value.length});continue;}
    if(op==='UNIQUE'){if(!Array.isArray(value)||value.length>100000)throw new Error('UNIQUE requires an array within the native collection limit.');const seen=new Map();for(const item of value)seen.set(hash.sha256Value(item),item);value=[...seen.values()];trace.push({op,count:value.length});continue;}
    if(op==='HASH_SHA256'){if(value instanceof Uint8Array)value=await hash.sha256Bytes(value);else if(typeof value==='string')value=await hash.sha256Bytes(new TextEncoder().encode(value));else value=hash.sha256Value(value);trace.push({op,value});continue;}
    if(op==='ASSERT_EQ'){assertStep(op,step.value,sameValue(value,step.value));continue;}
    if(op==='ASSERT_NE'){assertStep(op,step.value,!sameValue(value,step.value));continue;}
    if(op==='ASSERT_GT'){assertStep(op,step.value,comparableNumber(value)>comparableNumber(step.value));continue;}
    if(op==='ASSERT_GTE'){assertStep(op,step.value,comparableNumber(value)>=comparableNumber(step.value));continue;}
    if(op==='ASSERT_LT'){assertStep(op,step.value,comparableNumber(value)<comparableNumber(step.value));continue;}
    if(op==='ASSERT_LTE'){assertStep(op,step.value,comparableNumber(value)<=comparableNumber(step.value));continue;}
    if(op==='ASSERT_CONTAINS'){const passed=typeof value==='string'?value.includes(String(step.value)):Array.isArray(value)?value.some(item=>sameValue(item,step.value)):false;assertStep(op,step.value,passed);continue;}
    if(op==='ASSERT_NOT_CONTAINS'){const passed=typeof value==='string'?!value.includes(String(step.value)):Array.isArray(value)?!value.some(item=>sameValue(item,step.value)):false;assertStep(op,step.value,passed);continue;}
    if(op==='ASSERT_SET_EQUAL'){if(!Array.isArray(value)||!Array.isArray(step.value))throw new Error('ASSERT_SET_EQUAL requires array actual and expected values.');const left=[...new Set(value.map(x=>hash.sha256Value(x)))].sort(),right=[...new Set(step.value.map(x=>hash.sha256Value(x)))].sort();assertStep(op,step.value,sameValue(left,right));continue;}
    throw new Error('Unhandled native test operation '+op+'.');
  }
  const determination=assertions.length&&assertions.every(x=>x.passed)?'SATISFIED':'VIOLATED',actualResult={finalValue:normalizeActual(value),assertions};
  const executionHash=hash.sha256Value({testId:recordId(test,'tests'),spec:validation.spec,bindings:validation.bindings,inputs:Object.fromEntries(Object.entries(inputs||{}).map(([k,list])=>[k,safe(list).map(x=>({artifactId:x.artifactId,sha256:x.metadata?.sha256,byteSize:x.metadata?.byteSize}))])),actualResult,determination});
  return {testId:recordId(test,'tests'),requirementId:testRequirementId(test),determination,actualResult,assertions,trace,executionHash,executorCapability:APPLICATION_TEST_IR_CAPABILITY,executorVersion:APPLICATION_TEST_IR_VERSION,inputArtifactIds:[...new Set(Object.values(inputs||{}).flatMap(list=>safe(list).map(x=>String(x.artifactId||'')).filter(Boolean)))],inputHashes:[...new Set(Object.values(inputs||{}).flatMap(list=>safe(list).map(x=>String(x.metadata?.sha256||'')).filter(Boolean)))]};
}
function commitApplicationDeterministicExecutions(project,{stage=Number(project.activeStage||0),executions=[],operatorLabel='APPLICATION_NATIVE'}={}){
  ensureShape(project);const created=[];
  for(const execution of safe(executions)){
    const test=recordsForCurrentScope(project,'tests').find(t=>recordId(t,'tests')===String(execution.testId||''));if(!test)throw new Error('Native execution test does not resolve in current scope: '+String(execution.testId||''));
    if(upper(recordValue(test,'EXECUTION_MODE'))!=='APPLICATION_DETERMINISTIC'||!validateApplicationTestSpec(test).valid)throw new Error('Native execution is not authorized by the current TEST record.');
    const candidateAttachment=String(execution.inputArtifactIds?.[0]||''),firstArtifactId=/^ARTIFACT-/i.test(candidateAttachment)?candidateAttachment:'UNKNOWN',evidence=commandRecord(project,'evidenceRecords',{KIND:'APPLICATION_NATIVE_TEST_EXECUTION',DESCRIPTION:'Deterministic execution of '+execution.testId+' by '+APPLICATION_TEST_IR_CAPABILITY+'.',AUTHORITY_TYPE:'APPLICATION_DETERMINISTIC',SOURCE_ID:'UNKNOWN',LOCATION:'browser-local deterministic test runtime',CONTENT:JSON.stringify({executionHash:execution.executionHash,determination:execution.determination,assertions:execution.assertions,trace:execution.trace,inputArtifactIds:execution.inputArtifactIds,inputHashes:execution.inputHashes}),ATTACHMENT_ID:firstArtifactId,SHA256:execution.executionHash,STATUS:'PRESERVED'},{stage,source:'APPLICATION_TEST_EXECUTION'}),evidenceId=recordId(evidence,'evidenceRecords');
    if(stage===12){
      const key=String(execution.requirementId||'')+'|'+String(execution.runId||'')+'|'+String(execution.testId||''),prior=recordsForCurrentScope(project,'verification').filter(r=>verificationKey(r)===key);for(const r of prior){r.active=false;r.validity='SUPERSEDED';r.invalidatedBy='APPLICATION-NATIVE-'+execution.executionHash;refreshRecordHashes(r,'verification');}
      const result=commandRecord(project,'verification',{REQ_ID:execution.requirementId,RUN_ID:execution.runId,TEST_ID:execution.testId,DEFECT_ID:'UNKNOWN',VERIFIER:'Closed Loop deterministic runtime',VERIFIER_CONTEXT_ID:'APPLICATION_NATIVE:'+APPLICATION_TEST_IR_CAPABILITY,INDEPENDENCE_STATUS:'APPLICATION_ESTABLISHED',INPUTS:execution.inputArtifactIds.join(', ')||('RUN '+execution.runId),PROCEDURE:'Execute canonical '+APPLICATION_TEST_IR_VERSION+' TEST '+execution.testId+'.',EXPECTED_RESULT:String(recordValue(test,'EXPECTED_RESULT')||'SATISFIED'),OBSERVED_RESULT:execution.determination,EXACT_EVIDENCE:evidenceId,DETERMINATION:execution.determination,UNDETERMINED_REASON:''},{stage:12,source:'APPLICATION_TEST_EXECUTION'});result.evidenceRefs=[evidenceId];result.executionEvidenceSha256=execution.executionHash;refreshRecordHashes(result,'verification');created.push(result);
    }else if(stage===22){
      const productId=String(currentScope(project).productId||project.job.CURRENT_PRODUCT_ID||''),prior=recordsForCurrentScope(project,'deterministicResults').filter(r=>String(recordValue(r,'TEST_ID')||r.relationships?.TEST_ID||'')===String(execution.testId)&&String(recordValue(r,'PRODUCT_ID')||r.relationships?.PRODUCT_ID||'')===productId);for(const r of prior){r.active=false;r.validity='SUPERSEDED';r.invalidatedBy='APPLICATION-NATIVE-'+execution.executionHash;refreshRecordHashes(r,'deterministicResults');}
      const result=commandRecord(project,'deterministicResults',{PRODUCT_ID:productId,PRODUCT_SHA256:String(execution.inputHashes?.[0]||''),TEST_ID:execution.testId,DEFECT_ID:'UNKNOWN',TOOL_AND_VERSION:APPLICATION_TEST_IR_CAPABILITY+' / '+APPLICATION_TEST_IR_VERSION,PROCEDURE:'Execute canonical '+APPLICATION_TEST_IR_VERSION+' TEST '+execution.testId+'.',EXPECTED_RESULT:String(recordValue(test,'EXPECTED_RESULT')||'SATISFIED'),ACTUAL_RESULT:JSON.stringify(execution.actualResult),DETERMINATION:execution.determination,EVIDENCE:evidenceId},{stage:22,source:'APPLICATION_TEST_EXECUTION'});result.evidenceRefs=[evidenceId];result.executionEvidenceSha256=execution.executionHash;refreshRecordHashes(result,'deterministicResults');created.push(result);
    }else throw new Error('Application-native test commit is supported only for Stage 12 and Stage 22.');
    addHistory(project,'APPLICATION_NATIVE_TEST_EXECUTED',{stage,testId:execution.testId,runId:execution.runId||null,determination:execution.determination,executionHash:execution.executionHash,evidenceId,operatorLabel});
  }
  recalculate(project);return created;
}
const APPLICATION_TEST_EXECUTORS=Object.freeze({[APPLICATION_TEST_IR_CAPABILITY]:APPLICATION_TEST_IR_VERSION});`;
  s=replaceOnce(s,`const APPLICATION_TEST_EXECUTORS=Object.freeze({});`,block,'native executor registry');
  s=replaceOnce(s,`applicationExecutorSupported=mode!=='APPLICATION_DETERMINISTIC'||Object.prototype.hasOwnProperty.call(APPLICATION_TEST_EXECUTORS,requiredCapability),validMode=`,
`applicationSpec=validateApplicationTestSpec(test),applicationExecutorSupported=mode!=='APPLICATION_DETERMINISTIC'||(Object.prototype.hasOwnProperty.call(APPLICATION_TEST_EXECUTORS,requiredCapability)&&applicationSpec.valid),validMode=`,'execution plan native spec validation');
  s=replaceOnce(s,`mode==='APPLICATION_DETERMINISTIC'&&!applicationExecutorSupported?'No application-native executor is registered for '+requiredCapability+'.':`,
`mode==='APPLICATION_DETERMINISTIC'&&!applicationExecutorSupported?(applicationSpec.reason||('No application-native executor is registered for '+requiredCapability+'.')):`,'execution plan native block reason');
  s=replaceOnce(s,`artifactReady,applicationExecutorSupported,capabilityReady,operatorAction,operatorActionText:`,
`artifactReady,applicationExecutorSupported,applicationSpec,capabilityReady,executionRoute:mode==='APPLICATION_DETERMINISTIC'?'APPLICATION':mode==='EXTERNAL_AGENT_TOOL'?'TOOL_AGENT':mode==='INDEPENDENT_AGENT_REVIEW'?'INDEPENDENT_AI':mode==='HUMAN_INSPECTION'?'HUMAN':mode==='EXTERNAL_SYSTEM'?'EXTERNAL_SYSTEM':'BLOCKED',userAction:mode==='APPLICATION_DETERMINISTIC'?'RUN_IN_APP':mode==='EXTERNAL_AGENT_TOOL'?'SEND_VERIFICATION_PACKAGE':mode==='INDEPENDENT_AGENT_REVIEW'?'SEND_VERIFICATION_PACKAGE':mode==='HUMAN_INSPECTION'?'COMPLETE_INSPECTION':mode==='EXTERNAL_SYSTEM'?'RUN_EXTERNAL_SYSTEM':'BLOCKED',operatorAction,operatorActionText:`,'execution plan user route');
  s=replaceOnce(s,`mode==='APPLICATION_DETERMINISTIC'&&!Object.prototype.hasOwnProperty.call(APPLICATION_TEST_EXECUTORS,String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim())`,
`mode==='APPLICATION_DETERMINISTIC'&&(!Object.prototype.hasOwnProperty.call(APPLICATION_TEST_EXECUTORS,String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim())||!validateApplicationTestSpec(test).valid)`,'stage 6 native spec gate');
  s=replaceOnce(s,`const op=String(operation||'').toUpperCase(),testStages=stage===12||[22,23,24].includes(stage)||(stage===17&&['VERIFY','REGRESSION'].includes(op))||(stage===19&&['VERIFY','REGRESSION_VERIFY'].includes(op)),ids=testIds?new Set(testIds.map(String)):null,items=testStages?testExecutionPlan(project).items.filter(i=>!ids||ids.has(i.testId)):[]`,
`const op=String(operation||'').toUpperCase(),testStages=stage===12||[22,23,24].includes(stage)||(stage===17&&['VERIFY','REGRESSION'].includes(op))||(stage===19&&['VERIFY','REGRESSION_VERIFY'].includes(op)),ids=testIds?new Set(testIds.map(String)):null,stageTestType=stage===22?'DETERMINISTIC':stage===23?'MEANING':stage===24?'ADVERSARIAL':null,items=testStages?testExecutionPlan(project).items.filter(i=>(!ids||ids.has(i.testId))&&(!stageTestType||i.testType===stageTestType)):[]`,'stage-specific handoff test type');
  s=s.replace(`if([23,24,25].includes(stage))for(const a of artifacts)`,`if([22,23,24,25].includes(stage))for(const a of artifacts)`);
  if(!s.includes(`if([22,23,24,25].includes(stage))for(const a of artifacts)`))throw new Error('Stage 22 artifact handoff repair did not apply.');
  s=replaceOnce(s,`if(role==='VERIFICATION'){\n    const run=`, `if(role==='VERIFICATION'){\n    if(String(verifierContextId||'').startsWith('APPLICATION_NATIVE:'))return {determination:'APPLICATION_ESTABLISHED',reasons:[],evidence:[String(verifierContextId)]};\n    const run=`,'native verifier independence');
  s=replaceRegexOnce(s,/case 22:\{\s*requireAccepted\(\);const mandatoryIds=new Set\(mandatoryRequirements\(project,currentScope\(project\)\)\.map\(requirementId\)\),expected=recordsForCurrentScope\(project,'tests'\)\.filter\(test=>mandatoryIds\.has\(testRequirementId\(test\)\)&&upper\(recordValue\(test,'TEST_TYPE'\)\)==='DETERMINISTIC'&&!\['RETIRED','BLOCKED','NOT READY'\]\.includes\(upper\(recordValue\(test,'STATUS'\)\|\|'READY'\)\)\),results=/,
`case 22:{\n      const mandatoryIds=new Set(mandatoryRequirements(project,currentScope(project)).map(requirementId)),expected=recordsForCurrentScope(project,'tests').filter(test=>mandatoryIds.has(testRequirementId(test))&&upper(recordValue(test,'TEST_TYPE'))==='DETERMINISTIC'&&!['RETIRED','BLOCKED','NOT READY'].includes(upper(recordValue(test,'STATUS')||'READY')));if(expected.some(test=>upper(recordValue(test,'EXECUTION_MODE'))!=='APPLICATION_DETERMINISTIC'))requireAccepted();const results=`,'Stage 22 native-only accepted-response bypass');
  s=replaceOnce(s,`return 'No external action required. The application can perform the current deterministic verification route.';`,
`return 'Run automatic verification in this application. No external prompt or file transfer is required for the application-native tests.';`,'native next action wording');
  s=replaceOnce(s,`coverageMetrics,convergenceMetrics,releaseMetrics,applicationTestCapabilities,capabilityAffirmativelyAvailable,testExecutionPlan,executionHandoff,`,
`coverageMetrics,convergenceMetrics,releaseMetrics,applicationTestCapabilities,applicationTestIrContract,validateApplicationTestSpec,executeApplicationTest,commitApplicationDeterministicExecutions,capabilityAffirmativelyAvailable,testExecutionPlan,executionHandoff,`,'engine exports');
  write(path,s);
}

// Teach Stage 06 to compile subject-neutral executable tests into the registered Test IR when possible.
{
  const path='prompt-engine.js';let s=read(path);
  s=replaceOnce(s,
`For every test define TEST_TYPE, EXECUTION_MODE, REQUIRED_CAPABILITY, ARTIFACT_REQUIREMENTS, inputs, tools, procedure, expected result, failure condition, and evidence to preserve.`,
`For every test define TEST_TYPE, EXECUTION_MODE, REQUIRED_CAPABILITY, ARTIFACT_REQUIREMENTS, EXECUTABLE_KIND, EXECUTABLE_SPEC_VERSION, EXECUTABLE_SPEC, EXECUTABLE_INPUT_BINDINGS, inputs, tools, procedure, expected result, failure condition, and evidence to preserve. First attempt to express every objectively mechanical proposition using the registered subject-neutral application Test IR. For an application-native test use EXECUTABLE_KIND = PIPELINE, EXECUTABLE_SPEC_VERSION = closed-loop-test-spec/1, REQUIRED_CAPABILITY = CLOSED_LOOP_TEST_IR_V1, and EXECUTABLE_SPEC = {"version":"closed-loop-test-spec/1","steps":[...]}. EXECUTABLE_INPUT_BINDINGS maps symbolic names to {"source":"SUBJECT"|"TEST_INPUT","index":N}; SUBJECT means the exact current run output during Stage 12 and the exact finished-product artifact during Stage 22. Supported operations are LOAD_ARTIFACT, READ_BYTES, READ_METADATA, DECODE_UTF8, PARSE_JSON, SELECT using RFC 6901 JSON Pointer, COUNT, SUM, MIN, MAX, SORT, UNIQUE, HASH_SHA256, ASSERT_EQ, ASSERT_NE, ASSERT_GT, ASSERT_GTE, ASSERT_LT, ASSERT_LTE, ASSERT_CONTAINS, ASSERT_NOT_CONTAINS, and ASSERT_SET_EQUAL. Do not invent operations and do not emit arbitrary JavaScript, Python, shell commands, regular expressions, or executable code. For every non-native test use EXECUTABLE_KIND = NONE, EXECUTABLE_SPEC_VERSION = NONE, EXECUTABLE_SPEC = {}, and EXECUTABLE_INPUT_BINDINGS = {}.`, 'Stage 06 Test IR contract');
  s=replaceOnce(s,
`APPLICATION_DETERMINISTIC is reserved for an exact REQUIRED_CAPABILITY listed in APPLICATION-NATIVE TEST CAPABILITIES in this controlling prompt.`,
`APPLICATION_DETERMINISTIC is reserved for an exact REQUIRED_CAPABILITY listed in APPLICATION-NATIVE TEST CAPABILITIES in this controlling prompt and requires a valid application-owned executable Test IR specification. Prefer APPLICATION_DETERMINISTIC whenever the tested proposition can be represented exactly by the declared safe generic operations; otherwise route it to the real independent agent, human, or external system rather than weakening the proposition.`,'Stage 06 native preference');
  s=replaceOnce(s,
` let missing=matrix.missing.map(key=>{const [requirementId,runId,testId]=String(key).split('|');return {requirementId,runId,testId};});if(scope.runId)missing=missing.filter(item=>item.runId===String(scope.runId));`,
` let missing=matrix.missing.map(key=>{const [requirementId,runId,testId]=String(key).split('|');return {requirementId,runId,testId};});const nativeIds=new Set(workflow.testExecutionPlan(state).items.filter(item=>item.executionMode==='APPLICATION_DETERMINISTIC'&&item.applicationExecutorSupported).map(item=>item.testId));missing=missing.filter(item=>!nativeIds.has(item.testId));if(scope.runId)missing=missing.filter(item=>item.runId===String(scope.runId));`,'Stage 12 external batch excludes native triples');
  write(path,s);
}

// Put native execution and exact file retrieval directly in the existing operator UI.
{
  const path='app-core.js';let s=read(path);
  const replacement=String.raw`function testExecutionGuidanceMarkup(n){
  const operation=selectedOperation(n),verificationStage=n===6||n===12||[22,23,24].includes(n)||(n===17&&['VERIFY','REGRESSION'].includes(operation))||(n===19&&['VERIFY','REGRESSION_VERIFY'].includes(operation));if(!verificationStage)return '';
  const plan=engine.testExecutionPlan(current);if(!plan.total&&n!==6)return '';
  const relevant=plan.items.filter(item=>n===22?item.testType==='DETERMINISTIC':n===23?item.testType==='MEANING':n===24?item.testType==='ADVERSARIAL':true),handoff=engine.executionHandoff(current,{stage:n,operation}),blocked=relevant.filter(x=>!x.executableNow),native=relevant.filter(x=>x.executionMode==='APPLICATION_DETERMINISTIC'&&x.executableNow),external=relevant.filter(x=>x.executionMode!=='APPLICATION_DETERMINISTIC'&&x.executionMode!=='UNAVAILABLE'),currentResultIds=new Set(n===22?engine.recordsForCurrentScope(current,'deterministicResults').map(x=>String(engine.recordValue(x,'TEST_ID')||x.relationships?.TEST_ID||'')):[]),pendingNative=n===22?native.filter(x=>!currentResultIds.has(x.testId)):native;
  if(n===6){const rows=relevant.map(x=>({test:x.testId,requirement:x.requirementId,howItRuns:x.executionRoute,capability:x.requiredCapability,ready:x.executableNow?'YES':'NO',blockingReason:x.blockingReason||'NONE'}));return '<div class="panel" id="execution-guidance"><h2 class="section-title">How these tests will run</h2><p class="section-intro">AI is creating the verification plan now. No tests are executed at Stage 06. The application will run mechanically expressible tests itself; only tests that genuinely need judgment, specialized software, a human, or a physical/external system leave the application.</p>'+((blocked.length)?'<div class="notice warn"><strong>Some tests cannot run yet.</strong><br>'+blocked.map(x=>esc(x.testId)+': '+esc(x.blockingReason||'Execution route is incomplete.')).join('<br>')+'</div>':'')+details('Advanced verification details',rows,false)+'</div>';}
  const primary=[];
  if((n===12||n===22)&&pendingNative.length)primary.push('<div class="notice success"><strong>'+pendingNative.length+' test'+(pendingNative.length===1?'':'s')+' can run automatically.</strong><br>No ChatGPT handoff is required for these mechanical checks.</div><div class="button-row"><button id="run-native-tests">Run '+pendingNative.length+' automatic test'+(pendingNative.length===1?'':'s')+'</button></div>');
  for(const item of external){if(!item.executableNow)continue;const files=item.requiredArtifactIds.map((id,index)=>id+' — '+(item.requiredArtifactNames[index]||'file')).join(', ');if(item.operatorAction==='SEND_TO_INDEPENDENT_REVIEWER')primary.push('<div class="notice"><strong>Independent AI review required.</strong><br>Open a fresh reviewer context. '+(files?'Attach: '+esc(files)+'. ':'')+'Do not send prior verifier conclusions or proposed corrections.</div>');else if(item.operatorAction==='SEND_TO_TOOL_AGENT')primary.push('<div class="notice"><strong>Run this in a tool-capable AI environment.</strong><br>Required capability: '+esc(item.requiredCapability)+'. '+(files?'Attach: '+esc(files)+'.':'')+'</div>');else if(item.operatorAction==='HUMAN_INSPECTION')primary.push('<div class="notice"><strong>Human inspection required.</strong><br>Perform the stored inspection procedure and preserve the requested observation evidence.</div>');else if(item.operatorAction==='USE_EXTERNAL_SYSTEM')primary.push('<div class="notice"><strong>External system required.</strong><br>Use '+esc(item.requiredCapability)+' and return its exact result/evidence.</div>');}
  if(blocked.length)primary.push('<div class="notice warn" tabindex="-1"><strong>Verification is blocked.</strong><br>'+blocked.map(x=>esc(x.testId)+': '+esc(x.blockingReason||'Required capability or exact bytes are missing.')).join('<br>')+'</div>');
  const sendButtons=handoff.send.map(x=>'<button data-download-artifact="'+esc(x.artifactId)+'">Download '+esc(x.filename)+'</button>').join('');if(sendButtons)primary.push('<div><h3>Files to send</h3><p class="section-intro">Download these exact stored bytes and attach them to the external verifier. Browser storage does not transfer them automatically.</p><div class="button-row">'+sendButtons+'</div></div>');
  if(handoff.withhold.length)primary.push('<div class="notice"><strong>Do not send:</strong> '+handoff.withhold.map(x=>esc(x.artifactIdOrCategory)).join('; ')+'</div>');
  if(handoff.expectBack.length)primary.push('<div class="notice"><strong>What must come back:</strong> '+handoff.expectBack.map(x=>esc(x.filenameOrPattern||x.kind)).join('; ')+'</div>');
  const advanced=relevant.map(item=>({test:item.testId,requirement:item.requirementId,executionRoute:item.executionRoute,userAction:item.userAction,capability:item.requiredCapability,ready:item.executableNow?'YES':'NO',blockingReason:item.blockingReason||'NONE',files:item.requiredArtifactIds.join(', ')||'NONE',returnEvidence:item.returnRequirements.requiredEvidenceDescription}));
  return '<div class="panel" id="execution-guidance"><h2 class="section-title">What happens next</h2><p class="section-intro">The application has already determined who must act, what exact files are needed, what must be withheld, and what proof must come back. Follow only the action shown here.</p>'+primary.join('')+details('Advanced verification details',advanced,false)+'</div>';
}
function interactionModeMarkup`;
  s=replaceRegexOnce(s,/function testExecutionGuidanceMarkup\(n\)\{[\s\S]*?\n\}\nfunction interactionModeMarkup/,replacement,'execution guidance UI');
  const helpers=String.raw`
async function downloadCanonicalArtifact(artifactId){try{const row=await projectStore.getArtifact(String(artifactId));if(!row?.blob)throw new Error('Stored artifact bytes are unavailable.');const url=URL.createObjectURL(row.blob),a=document.createElement('a');a.href=url;a.download=row.filename||String(artifactId);document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);announce('artifact downloaded');}catch(error){announce('artifact download failed');alert('Artifact download failed: '+(error.message||error));}}
async function nativeExecutionInput(row,artifactId){const bytes=new Uint8Array(await row.blob.arrayBuffer());return {artifactId:String(artifactId||row.artifactId||'VIRTUAL'),metadata:{filename:String(row.filename||artifactId||'artifact'),mediaType:String(row.mediaType||row.blob.type||'application/octet-stream'),byteSize:bytes.byteLength,sha256:String(row.sha256||await globalThis.closedLoopHash.sha256Bytes(bytes))},bytes};}
async function runNativeTests(){try{const stage=Number(current.activeStage||0);if(![12,22].includes(stage))throw new Error('Automatic verification is available only at Stage 12 and Stage 22.');const plan=engine.testExecutionPlan(current),nativeById=new Map(plan.items.filter(x=>x.testType==='DETERMINISTIC'&&x.executionMode==='APPLICATION_DETERMINISTIC'&&x.executableNow).map(x=>[x.testId,x]));if(!nativeById.size)throw new Error('No application-native test is ready.');const executions=[];
  const testInputCache=new Map();const loadStored=async id=>{if(testInputCache.has(id))return testInputCache.get(id);const row=await projectStore.getArtifact(id);if(!row?.blob)throw new Error('Required stored bytes are unavailable for '+id+'.');const value=await nativeExecutionInput(row,id);testInputCache.set(id,value);return value;};
  if(stage===22){const productId=String(current.job.CURRENT_PRODUCT_ID||''),productArtifacts=engine.recordsForCurrentScope(current,'artifacts').filter(a=>String(a.scope?.productId||'')===productId&&String(engine.recordValue(a,'AVAILABILITY')||'').toUpperCase()==='BYTES_PERSISTED_AND_VERIFIED');if(!productArtifacts.length)throw new Error('No verified finished-product bytes are available.');const subject=[];for(const a of productArtifacts)subject.push(await loadStored(engine.recordId(a,'artifacts')));const existing=new Set(engine.recordsForCurrentScope(current,'deterministicResults').map(r=>String(engine.recordValue(r,'TEST_ID')||r.relationships?.TEST_ID||'')));for(const [testId,item] of nativeById){if(existing.has(testId))continue;const test=engine.recordsForCurrentScope(current,'tests').find(t=>engine.recordId(t,'tests')===testId),testInputs=[];for(const id of item.requiredArtifactIds)testInputs.push(await loadStored(id));const execution=await engine.executeApplicationTest(test,{SUBJECT:subject,TEST_INPUT:testInputs});executions.push(execution);}}
  else{const iteration=engine.records(current,'iterations').filter(r=>engine.isActiveRecord(r)).at(-1);if(!iteration)throw new Error('No current iteration exists.');const iterationId=engine.recordId(iteration,'iterations'),matrix=engine.verificationMatrix(current,iterationId);for(const key of matrix.missing){const [reqId,runId,testId]=key.split('|'),item=nativeById.get(testId);if(!item)continue;const test=engine.recordsForScope(current,'tests',matrix.scope).find(t=>engine.recordId(t,'tests')===testId),run=matrix.runs.find(r=>engine.recordId(r,'runs')===runId);if(!test||!run)continue;const artifactIds=[...new Set((String(engine.recordValue(run,'OUTPUT_ARTIFACT_IDENTITIES')||'').match(/ARTIFACT-[A-Za-z0-9-]+/g)||[]))],subject=[];for(const id of artifactIds){try{subject.push(await loadStored(id));}catch{}}if(!subject.length){const text=String(engine.recordValue(run,'COMPLETE_OUTPUT')||''),bytes=new TextEncoder().encode(text),sha256=await globalThis.closedLoopHash.sha256Bytes(bytes);subject.push({artifactId:'RUN_OUTPUT:'+runId,metadata:{filename:runId+'.txt',mediaType:'text/plain',byteSize:bytes.byteLength,sha256},bytes});}const testInputs=[];for(const id of item.requiredArtifactIds)testInputs.push(await loadStored(id));const execution=await engine.executeApplicationTest(test,{SUBJECT:subject,TEST_INPUT:testInputs});execution.requirementId=reqId;execution.runId=runId;executions.push(execution);}}
  if(!executions.length){announce('automatic tests already complete');return;}const next=clone(current);engine.commitApplicationDeterministicExecutions(next,{stage,executions,operatorLabel:$('#operator-label')?.value.trim()||'HUMAN_OPERATOR'});await persistReplacement(next);announce('automatic verification complete');render();}catch(error){announce('automatic verification failed');const node=$('#execution-guidance');node?.focus();alert('Automatic verification failed without accepting a synthetic result: '+(error.message||error));}}
`;
  s=replaceOnce(s,`function wire(){`,helpers+`\nfunction wire(){`,'app native helper insertion');
  s=replaceOnce(s,`function wire(){document.querySelectorAll('[data-view]')`,
`function wire(){if($('#run-native-tests'))$('#run-native-tests').onclick=runNativeTests;document.querySelectorAll('[data-download-artifact]').forEach(button=>button.onclick=()=>downloadCanonicalArtifact(button.dataset.downloadArtifact));document.querySelectorAll('[data-view]')`,'app native/download wiring');
  write(path,s);
}

// Update existing verification assertions to recognize and prove the registered native capability.
{
  const path='verify-complete.mjs';let s=read(path);
  s=replaceOnce(s,`assert(engine.applicationTestCapabilities().length===0,'Unexpected application-native executor registration.');`,
`assert(engine.applicationTestCapabilities().includes('CLOSED_LOOP_TEST_IR_V1'),'The subject-neutral native Test IR executor is not registered.');`,'verify-complete native capability expectation');
  const insertion=String.raw`

// Registered subject-neutral Test IR validates and executes a real deterministic assertion.
{
  const p=project('JOB-NATIVE-IR-EXECUTION');Object.assign(p.job,{CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001'});const scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TEST-SUITE-v001'};
  const test={id:'TEST-NATIVE-IR',stage:6,active:true,scope,fields:{TEST_ID:'TEST-NATIVE-IR',REQ_ID:'REQ-NATIVE-IR',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR_V1',ARTIFACT_REQUIREMENTS:'NONE',EXECUTABLE_KIND:'PIPELINE',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_SPEC:{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'SUBJECT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_JSON'},{op:'SELECT',path:'/records'},{op:'COUNT'},{op:'ASSERT_EQ',value:2}]},EXECUTABLE_INPUT_BINDINGS:{SUBJECT:{source:'SUBJECT',index:0}},INPUTS:'current subject',TOOLS:'Closed Loop Test IR',PROCEDURE:'Count records exactly.',EXPECTED_RESULT:'2 records',FAILURE_CONDITION:'record count differs',EVIDENCE_TO_PRESERVE:'application execution trace',STATUS:'READY'},relationships:{REQ_ID:'REQ-NATIVE-IR'}};
  assert(engine.validateApplicationTestSpec(test).valid,'Valid native Test IR was rejected.');const bytes=new TextEncoder().encode('{"records":[1,2]}'),sha256=await globalThis.closedLoopHash.sha256Bytes(bytes),result=await engine.executeApplicationTest(test,{SUBJECT:[{artifactId:'SUBJECT-1',metadata:{filename:'subject.json',mediaType:'application/json',byteSize:bytes.byteLength,sha256},bytes}],TEST_INPUT:[]});assert(result.determination==='SATISFIED'&&result.assertions.length===1&&result.assertions[0].passed,'Native Test IR did not execute the expected deterministic assertion.');
  const malformed=JSON.parse(JSON.stringify(test));malformed.fields.EXECUTABLE_SPEC.steps.push({op:'SHELL_COMMAND',value:'rm -rf /'});assert(!engine.validateApplicationTestSpec(malformed).valid,'Native Test IR accepted an arbitrary unsupported operation.');
}
`;
  s=replaceOnce(s,`// Stage 06 continuously rechecks exact required artifact custody from canonical evidence and current verified bytes.`,insertion+`\n// Stage 06 continuously rechecks exact required artifact custody from canonical evidence and current verified bytes.`,'native IR execution regression block');
  write(path,s);
}
{
  const path='verify-definition-of-done.mjs';let s=read(path);
  s=replaceOnce(s,`assert(engine.applicationTestCapabilities().length===0,'APPLICATION_TEST_EXECUTORS is no longer empty without a proven native executor.');`,
`assert(engine.applicationTestCapabilities().includes('CLOSED_LOOP_TEST_IR_V1'),'The registered application-native executor is not the proven subject-neutral Test IR capability.');`,'definition-of-done native capability');
  s=replaceOnce(s,`for(const token of ['evaluateEvidenceContract','evaluateResultConsistency','effectiveDetermination','validateTraceIntegrity','detectCurrentContradictions','releaseMetrics','testExecutionPlan','executionHandoff'])`,
`for(const token of ['evaluateEvidenceContract','evaluateResultConsistency','effectiveDetermination','validateTraceIntegrity','detectCurrentContradictions','releaseMetrics','testExecutionPlan','executionHandoff','validateApplicationTestSpec','executeApplicationTest','commitApplicationDeterministicExecutions'])`,'definition-of-done native engine tokens');
  write(path,s);
}

console.log('Applied subject-neutral native Test IR and operator execution controls.');

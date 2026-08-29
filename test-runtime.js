(()=>{
'use strict';

const hash=globalThis.closedLoopHash;
if(!hash)throw new Error('hash.js must load before test-runtime.js.');

const SPEC_VERSION='closed-loop-test-spec/1';
const RUNTIME_VERSION='closed-loop-test-runtime/1';
const CAPABILITY='CLOSED_LOOP_TEST_RUNTIME_V1';
const MAX_STEPS=128;
const MAX_REGEX_LENGTH=2048;
const MAX_SELECTOR_DEPTH=32;
const OPS=Object.freeze([
  'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','SELECT_JSON_PATH','COUNT','LENGTH','UNIQUE','SORT','SUM','MIN','MAX','HASH_SHA256','REGEX',
  'ASSERT_EQ','ASSERT_NE','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','ASSERT_TRUE','ASSERT_FALSE'
]);
const OP_SET=new Set(OPS);
const upper=value=>String(value??'').trim().toUpperCase();
const recordFields=record=>record?.fields&&typeof record.fields==='object'?record.fields:record||{};
const recordValue=(record,key)=>recordFields(record)?.[key]??record?.[key];
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));

function normalizeSpec(test){
  const version=String(recordValue(test,'EXECUTABLE_SPEC_VERSION')||'').trim();
  const raw=recordValue(test,'EXECUTABLE_SPEC');
  const bindings=recordValue(test,'EXECUTABLE_INPUT_BINDINGS');
  return {version,spec:raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:null,bindings:bindings&&typeof bindings==='object'&&!Array.isArray(bindings)?bindings:{}};
}
function validateSelector(path){
  if(typeof path!=='string'||!path.startsWith('$'))return 'SELECT_JSON_PATH path must start with $.';
  if(path.length>2048)return 'SELECT_JSON_PATH path is too long.';
  const tokens=path.match(/(?:\.[A-Za-z0-9_$-]+|\[(?:0|[1-9]\d*|\*)\])/g)||[];
  const normalized=path.replace(/(?:\.[A-Za-z0-9_$-]+|\[(?:0|[1-9]\d*|\*)\])/g,'');
  if(normalized!=='$')return 'SELECT_JSON_PATH uses unsupported selector syntax.';
  if(tokens.length>MAX_SELECTOR_DEPTH)return 'SELECT_JSON_PATH exceeds maximum selector depth.';
  return null;
}
function validateStep(step,index){
  if(!step||typeof step!=='object'||Array.isArray(step))return `Step ${index+1} must be an object.`;
  const op=upper(step.op);if(!OP_SET.has(op))return `Step ${index+1} uses unsupported operation ${op||'UNKNOWN'}.`;
  if(op==='LOAD_ARTIFACT'&&!String(step.binding||'').trim())return `Step ${index+1} LOAD_ARTIFACT requires binding.`;
  if(op==='SELECT_JSON_PATH')return validateSelector(String(step.path||''));
  if(op==='REGEX'||op==='ASSERT_MATCH'){
    const pattern=String(step.pattern??step.value??'');
    if(!pattern)return `Step ${index+1} ${op} requires a pattern.`;
    if(pattern.length>MAX_REGEX_LENGTH)return `Step ${index+1} regex exceeds the maximum length.`;
    try{new RegExp(pattern,String(step.flags||''));}catch{return `Step ${index+1} regex is invalid.`;}
  }
  return null;
}
function validateSpec(spec,bindings={}){
  const reasons=[];
  if(!spec||typeof spec!=='object'||Array.isArray(spec))reasons.push('Executable Test IR must be an object.');
  if(spec&&String(spec.version||'')!==SPEC_VERSION)reasons.push(`Executable Test IR version must be ${SPEC_VERSION}.`);
  const steps=Array.isArray(spec?.steps)?spec.steps:[];
  if(!steps.length)reasons.push('Executable Test IR requires at least one step.');
  if(steps.length>MAX_STEPS)reasons.push(`Executable Test IR exceeds ${MAX_STEPS} steps.`);
  for(let i=0;i<steps.length;i++){const issue=validateStep(steps[i],i);if(issue)reasons.push(issue);}
  const declaredBindings=bindings&&typeof bindings==='object'&&!Array.isArray(bindings)?bindings:{};
  for(const [key,value] of Object.entries(declaredBindings))if(!String(key).trim()||!(typeof value==='string'||value&&typeof value==='object'))reasons.push(`Input binding ${key||'UNKNOWN'} is invalid.`);
  return {valid:reasons.length===0,reasons:[...new Set(reasons)],stepCount:steps.length};
}
function supports(test){
  if(upper(recordValue(test,'EXECUTION_MODE'))!=='APPLICATION_DETERMINISTIC')return false;
  if(String(recordValue(test,'REQUIRED_CAPABILITY')||'').trim()!==CAPABILITY)return false;
  const normalized=normalizeSpec(test);if(normalized.version!==SPEC_VERSION||!normalized.spec)return false;
  return validateSpec(normalized.spec,normalized.bindings).valid;
}
function capabilities(){return Object.freeze([CAPABILITY]);}
function createWorker(){return new Worker(`test-worker.js?runtime=${encodeURIComponent(RUNTIME_VERSION)}`);}
async function execute({test,artifacts=[]}={}){
  if(!supports(test))throw new Error('The test is not supported by the registered Closed Loop Test Runtime.');
  const normalized=normalizeSpec(test),validation=validateSpec(normalized.spec,normalized.bindings);if(!validation.valid)throw new Error(validation.reasons.join(' '));
  const serialArtifacts=[];
  for(const item of artifacts){
    if(!item||!item.artifactId||!item.bytes)throw new Error('Every runtime artifact requires artifactId and bytes.');
    const bytes=item.bytes instanceof ArrayBuffer?item.bytes:item.bytes.buffer instanceof ArrayBuffer?item.bytes.buffer.slice(item.bytes.byteOffset,item.bytes.byteOffset+item.bytes.byteLength):null;
    if(!bytes)throw new Error(`Artifact ${item.artifactId} does not expose transferable bytes.`);
    serialArtifacts.push({artifactId:String(item.artifactId),filename:String(item.filename||item.artifactId),sha256:String(item.sha256||''),byteSize:Number(item.byteSize??bytes.byteLength),bytes});
  }
  const testId=String(recordValue(test,'TEST_ID')||test?.id||'UNKNOWN'),specHash=hash.sha256Value(normalized.spec),message={runtimeVersion:RUNTIME_VERSION,specVersion:SPEC_VERSION,testId,spec:clone(normalized.spec),bindings:clone(normalized.bindings),artifacts:serialArtifacts};
  return await new Promise((resolve,reject)=>{
    const worker=createWorker(),timer=setTimeout(()=>{worker.terminate();reject(new Error('Deterministic test exceeded the execution time limit.'));},15000);
    worker.onmessage=event=>{clearTimeout(timer);worker.terminate();const result=event.data||{};if(result.error){reject(new Error(result.error));return;}resolve({...result,testId,testSpecSha256:specHash,executorVersion:RUNTIME_VERSION,specVersion:SPEC_VERSION});};
    worker.onerror=event=>{clearTimeout(timer);worker.terminate();reject(new Error(event.message||'Deterministic test worker failed.'));};
    const transfers=serialArtifacts.map(a=>a.bytes);worker.postMessage(message,transfers);
  });
}

globalThis.closedLoopTestRuntime=Object.freeze({SPEC_VERSION,RUNTIME_VERSION,CAPABILITY,OPS,MAX_STEPS,validateSpec,supports,capabilities,execute});
})();

(()=>{
'use strict';
const VERSION='closed-loop-test-runtime/1';
const SPEC_VERSION='closed-loop-test-spec/1';
const CAPABILITY='CLOSED_LOOP_TEST_IR';
const OPS=Object.freeze([
  'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','SELECT_JSON_PATH',
  'COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','BYTE_COMPARE',
  'ASSERT_EXISTS','ASSERT_TYPE','ASSERT_EQ','ASSERT_NE','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE',
  'ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL'
]);
const LIMITS=Object.freeze({maxSteps:64,maxTextBytes:16*1024*1024,maxCollectionItems:100000,maxRegexLength:2000,maxCsvCells:250000});
const FORBIDDEN_STEP_KEYS=Object.freeze(['code','javascript','python','shell','command','eval','function','script']);
const bytesOf=value=>value instanceof Uint8Array?value:value instanceof ArrayBuffer?new Uint8Array(value):ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):null;
const field=(test,key)=>test?.fields?.[key]??test?.[key];
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
async function sha256(bytes){const data=bytesOf(bytes);if(!data)throw new Error('HASH_SHA256 requires bytes.');const digest=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false,cells=0;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;continue;}
    if(ch==='"'){if(cell.length)throw new Error('Malformed CSV: quote begins inside an unquoted field.');quoted=true;continue;}
    if(ch===','){row.push(cell);cell='';cells++;}
    else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';cells++;}
    else if(ch==='\r'){if(text[i+1]==='\n')continue;row.push(cell);rows.push(row);row=[];cell='';cells++;}
    else cell+=ch;
    if(cells>LIMITS.maxCsvCells)throw new Error('CSV exceeds deterministic runtime cell limit.');
  }
  if(quoted)throw new Error('Malformed CSV: unterminated quoted field.');
  if(cell.length||row.length){row.push(cell);rows.push(row);}
  if(rows.length>LIMITS.maxCollectionItems)throw new Error('CSV exceeds deterministic runtime row limit.');
  return rows;
}
function selectJsonPath(value,path){
  const text=String(path||'').trim();if(text==='$')return value;if(!text.startsWith('$.'))throw new Error('SELECT_JSON_PATH supports only deterministic root paths beginning with $.');
  const parts=[];for(const token of text.slice(2).split('.')){const m=token.match(/^([^\[\]]+)(?:\[(\d+)\])?$/);if(!m)throw new Error('Unsupported JSON path token: '+token);parts.push(m[1]);if(m[2]!==undefined)parts.push(Number(m[2]));}
  let out=value;for(const part of parts){if(out===null||out===undefined||!(part in Object(out)))throw new Error('JSON path does not exist: '+text);out=out[part];}return out;
}
function comparable(value){return value instanceof Uint8Array?[...value]:value;}
function assertCondition(ok,expected,actual,message){return {determination:ok?'SATISFIED':'VIOLATED',expected,actual,message:message||null};}
function validateSpec(spec){
  const issues=[];
  if(!spec||typeof spec!=='object'||Array.isArray(spec))issues.push('Test IR must be an object.');
  if(spec?.version!==SPEC_VERSION)issues.push('Unsupported Test IR version.');
  if(!Array.isArray(spec?.steps)||!spec.steps.length)issues.push('Test IR requires at least one step.');
  if((spec?.steps?.length||0)>LIMITS.maxSteps)issues.push('Test IR exceeds maximum step count.');
  for(const [index,step] of (spec?.steps||[]).entries()){
    if(!step||typeof step!=='object'||Array.isArray(step)){issues.push(`Step ${index} is not an object.`);continue;}
    if(!OPS.includes(step.op))issues.push(`Step ${index} uses unsupported operation ${String(step.op)}.`);
    for(const key of FORBIDDEN_STEP_KEYS)if(Object.prototype.hasOwnProperty.call(step,key))issues.push(`Step ${index} contains forbidden executable field ${key}.`);
    if(step.op==='REGEX'||step.op==='ASSERT_MATCH')if(String(step.pattern??step.value??'').length>LIMITS.maxRegexLength)issues.push(`Step ${index} regex exceeds maximum length.`);
  }
  return {valid:issues.length===0,issues};
}
function validateBindings(bindings){
  const issues=[];if(!bindings||typeof bindings!=='object'||Array.isArray(bindings))return {valid:false,issues:['EXECUTABLE_INPUT_BINDINGS must be an object.']};
  for(const [name,binding] of Object.entries(bindings)){if(!/^[A-Z][A-Z0-9_]{0,63}$/.test(name))issues.push(`Invalid Test IR binding name ${name}.`);if(typeof binding==='string')continue;if(!binding||typeof binding!=='object'||Array.isArray(binding)){issues.push(`Binding ${name} must be an artifact ID string or a closed binding object.`);continue;}const allowed=new Set(['artifactId','source','artifactRole','filename']);for(const key of Object.keys(binding))if(!allowed.has(key))issues.push(`Binding ${name} contains unsupported key ${key}.`);if(binding.source&&binding.source!=='CURRENT_PRODUCT'&&binding.source!=='CURRENT_SCOPE')issues.push(`Binding ${name} has unsupported source ${binding.source}.`);if(!binding.artifactId&&!binding.artifactRole&&!binding.filename)issues.push(`Binding ${name} does not identify an artifact.`);}
  return {valid:issues.length===0,issues};
}
function supports(test){
  if(String(field(test,'EXECUTION_MODE')||'').toUpperCase()!=='APPLICATION_DETERMINISTIC')return false;
  if(String(field(test,'REQUIRED_CAPABILITY')||'').toUpperCase()!==CAPABILITY)return false;
  if(String(field(test,'EXECUTABLE_KIND')||'').toUpperCase()!=='CUSTOM_PIPELINE')return false;
  if(field(test,'EXECUTABLE_SPEC_VERSION')!==SPEC_VERSION)return false;
  return validateSpec(field(test,'EXECUTABLE_SPEC')).valid&&validateBindings(field(test,'EXECUTABLE_INPUT_BINDINGS')).valid;
}
async function execute({spec,artifacts}){
  const check=validateSpec(spec);if(!check.valid)throw new Error(check.issues.join(' '));
  const source=artifacts&&typeof artifacts==='object'?artifacts:{};let value=null,currentArtifact=null,lastRegex=null,assertion=null;const observations=[];
  for(const [index,step] of spec.steps.entries()){
    switch(step.op){
      case 'LOAD_ARTIFACT':{const a=source[step.binding];if(!a)throw new Error(`Artifact binding ${step.binding} is unavailable.`);currentArtifact=a;value=a;observations.push({step:index,op:step.op,binding:step.binding,artifactId:a.artifactId||null,filename:a.filename||null,sha256:a.sha256||null});break;}
      case 'READ_BYTES':{const bytes=bytesOf(currentArtifact?.bytes??value?.bytes??value);if(!bytes)throw new Error('READ_BYTES requires artifact bytes.');value=bytes;observations.push({step:index,op:step.op,byteLength:bytes.byteLength});break;}
      case 'DECODE_UTF8':{const bytes=bytesOf(value);if(!bytes)throw new Error('DECODE_UTF8 requires bytes.');if(bytes.byteLength>LIMITS.maxTextBytes)throw new Error('Text input exceeds deterministic runtime byte limit.');value=new TextDecoder('utf-8',{fatal:true}).decode(bytes);break;}
      case 'PARSE_JSON':value=JSON.parse(String(value));break;
      case 'PARSE_CSV':value=parseCsv(String(value));break;
      case 'SELECT_JSON_PATH':value=selectJsonPath(value,step.path);break;
      case 'COUNT':{if(value==null||typeof value.length!=='number')throw new Error('COUNT requires an array, string, or array-like value.');if(value.length>LIMITS.maxCollectionItems)throw new Error('COUNT input exceeds collection limit.');value=value.length;break;}
      case 'SUM':case 'MIN':case 'MAX':{if(!Array.isArray(value)||value.length>LIMITS.maxCollectionItems)throw new Error(`${step.op} requires a bounded array.`);const nums=value.map(Number);if(nums.some(x=>!Number.isFinite(x)))throw new Error(`${step.op} requires finite numeric values.`);value=step.op==='SUM'?nums.reduce((a,b)=>a+b,0):step.op==='MIN'?Math.min(...nums):Math.max(...nums);break;}
      case 'SORT':{if(!Array.isArray(value)||value.length>LIMITS.maxCollectionItems)throw new Error('SORT requires a bounded array.');value=[...value].sort((a,b)=>stable(a).localeCompare(stable(b)));break;}
      case 'UNIQUE':{if(!Array.isArray(value)||value.length>LIMITS.maxCollectionItems)throw new Error('UNIQUE requires a bounded array.');const seen=new Set();value=value.filter(v=>{const k=stable(v);if(seen.has(k))return false;seen.add(k);return true;});break;}
      case 'HASH_SHA256':value=await sha256(value);break;
      case 'REGEX':{const r=new RegExp(String(step.pattern||''),String(step.flags||''));lastRegex=r;value=r.test(String(value));break;}
      case 'COMPARE':{const other=Object.prototype.hasOwnProperty.call(step,'value')?step.value:source[step.binding]?.value;value=stable(comparable(value))===stable(comparable(other));break;}
      case 'BYTE_COMPARE':{const left=bytesOf(value),other=bytesOf(source[step.binding]?.bytes);if(!left||!other)throw new Error('BYTE_COMPARE requires byte-backed current value and target binding.');let equal=left.byteLength===other.byteLength;if(equal)for(let i=0;i<left.byteLength;i++)if(left[i]!==other[i]){equal=false;break;}value=equal;break;}
      case 'ASSERT_EXISTS':assertion=assertCondition(value!==null&&value!==undefined,step.value??'present',value,step.message);break;
      case 'ASSERT_TYPE':{const actual=Array.isArray(value)?'array':value===null?'null':typeof value;assertion=assertCondition(actual===String(step.value),step.value,actual,step.message);break;}
      case 'ASSERT_EQ':assertion=assertCondition(stable(comparable(value))===stable(comparable(step.value)),step.value,comparable(value),step.message);break;
      case 'ASSERT_NE':assertion=assertCondition(stable(comparable(value))!==stable(comparable(step.value)),`not ${stable(step.value)}`,comparable(value),step.message);break;
      case 'ASSERT_GT':assertion=assertCondition(Number(value)>Number(step.value),`> ${step.value}`,value,step.message);break;
      case 'ASSERT_GTE':assertion=assertCondition(Number(value)>=Number(step.value),`>= ${step.value}`,value,step.message);break;
      case 'ASSERT_LT':assertion=assertCondition(Number(value)<Number(step.value),`< ${step.value}`,value,step.message);break;
      case 'ASSERT_LTE':assertion=assertCondition(Number(value)<=Number(step.value),`<= ${step.value}`,value,step.message);break;
      case 'ASSERT_MATCH':{const r=lastRegex||new RegExp(String(step.pattern??step.value??''),String(step.flags||''));assertion=assertCondition(r.test(String(value)),String(r),value,step.message);break;}
      case 'ASSERT_CONTAINS':{const ok=Array.isArray(value)?value.some(v=>stable(v)===stable(step.value)):String(value).includes(String(step.value));assertion=assertCondition(ok,`contains ${stable(step.value)}`,value,step.message);break;}
      case 'ASSERT_NOT_CONTAINS':{const ok=Array.isArray(value)?!value.some(v=>stable(v)===stable(step.value)):!String(value).includes(String(step.value));assertion=assertCondition(ok,`does not contain ${stable(step.value)}`,value,step.message);break;}
      case 'ASSERT_SET_EQUAL':{if(!Array.isArray(value)||!Array.isArray(step.value))throw new Error('ASSERT_SET_EQUAL requires arrays.');const a=[...new Set(value.map(stable))].sort(),b=[...new Set(step.value.map(stable))].sort();assertion=assertCondition(stable(a)===stable(b),step.value,value,step.message);break;}
      default:throw new Error(`Unsupported Test IR operation ${step.op}.`);
    }
    if(assertion){observations.push({step:index,op:step.op,...assertion});if(assertion.determination==='VIOLATED')return {status:'COMPLETE',determination:'VIOLATED',expected:assertion.expected,actual:assertion.actual,observations,runtimeVersion:VERSION,specVersion:SPEC_VERSION};assertion=null;}
  }
  const finalAssertion=[...observations].reverse().find(x=>x.determination);return {status:'COMPLETE',determination:finalAssertion?.determination||'UNDETERMINED',expected:finalAssertion?.expected??null,actual:finalAssertion?.actual??value,observations,executorVersion:VERSION,runtimeVersion:VERSION,specVersion:SPEC_VERSION};
}
globalThis.closedLoopTestRuntime=Object.freeze({VERSION,SPEC_VERSION,CAPABILITY,OPS,LIMITS,validateSpec,validateBindings,supports,execute,capabilities:()=>Object.freeze([CAPABILITY])});
})();

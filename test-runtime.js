(()=>{
'use strict';
const VERSION='closed-loop-test-runtime/2';
const SPEC_VERSION='closed-loop-test-spec/1';
const CAPABILITY='CLOSED_LOOP_TEST_IR';
const OPS=Object.freeze([
  'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML',
  'COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE',
  'ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'
]);
const LIMITS=Object.freeze({
  maxInputBytes:16*1024*1024,
  maxDecompressedBytes:32*1024*1024,
  maxSteps:64,
  maxSelectorDepth:32,
  maxParsedDepth:64,
  maxCollectionItems:100000,
  maxRegexLength:2000,
  maxRegexInputLength:2*1024*1024,
  maxCsvCells:250000,
  workerTimeoutMs:10000,
  maxArchiveExpansionBytes:32*1024*1024
});
const FORBIDDEN_STEP_KEYS=Object.freeze(['code','javascript','python','shell','command','eval','function','script','import','dynamicImport','network','url','fetch']);
const bytesOf=value=>value instanceof Uint8Array?value:value instanceof ArrayBuffer?new Uint8Array(value):ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):null;
const field=(test,key)=>test?.fields?.[key]??test?.[key];
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const isPlainObject=v=>v&&typeof v==='object'&&!Array.isArray(v)&&!(v instanceof Uint8Array)&&!(v instanceof ArrayBuffer);
function depthOf(value,seen=new Set()){if(value===null||typeof value!=='object')return 0;if(seen.has(value))throw new Error('Parsed structure contains a cycle.');seen.add(value);let depth=1;if(Array.isArray(value)){for(const item of value)depth=Math.max(depth,1+depthOf(item,seen));}else for(const item of Object.values(value))depth=Math.max(depth,1+depthOf(item,seen));seen.delete(value);return depth;}
function enforceParsedLimits(value){const depth=depthOf(value);if(depth>LIMITS.maxParsedDepth)throw new Error('Parsed structure exceeds deterministic runtime depth limit.');const visit=v=>{if(Array.isArray(v)){if(v.length>LIMITS.maxCollectionItems)throw new Error('Parsed collection exceeds deterministic runtime collection limit.');for(const x of v)visit(x);}else if(isPlainObject(v)){const values=Object.values(v);if(values.length>LIMITS.maxCollectionItems)throw new Error('Parsed object exceeds deterministic runtime collection limit.');for(const x of values)visit(x);}};visit(value);return value;}
async function sha256(bytes){const data=bytesOf(bytes);if(!data)throw new Error('HASH_SHA256 requires bytes.');const digest=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function parseCsv(text,config){
  if(!config||typeof config!=='object'||Array.isArray(config))throw new Error('PARSE_CSV requires explicit config.');
  const allowed=new Set(['delimiter','header','quote','newline','encoding']);for(const key of Object.keys(config))if(!allowed.has(key))throw new Error('PARSE_CSV config contains unsupported property '+key+'.');
  const delimiter=String(config.delimiter??''),quote=String(config.quote??''),newline=String(config.newline??''),encoding=String(config.encoding??'').toUpperCase();
  if(delimiter.length!==1)throw new Error('PARSE_CSV delimiter must be exactly one character.');if(quote.length!==1)throw new Error('PARSE_CSV quote must be exactly one character.');if(!['LF','CRLF','CR','ANY'].includes(newline))throw new Error('PARSE_CSV newline must be LF, CRLF, CR, or ANY.');if(encoding!=='UTF-8')throw new Error('Version 1 PARSE_CSV supports UTF-8 only.');if(typeof config.header!=='boolean')throw new Error('PARSE_CSV header must be boolean.');
  const rows=[];let row=[],cell='',quoted=false,cells=0;
  const pushCell=()=>{row.push(cell);cell='';cells++;if(cells>LIMITS.maxCsvCells)throw new Error('CSV exceeds deterministic runtime cell limit.');};
  const pushRow=()=>{pushCell();rows.push(row);row=[];if(rows.length>LIMITS.maxCollectionItems)throw new Error('CSV exceeds deterministic runtime row limit.');};
  for(let i=0;i<text.length;i++){
    const ch=text[i];if(quoted){if(ch===quote&&text[i+1]===quote){cell+=quote;i++;}else if(ch===quote)quoted=false;else cell+=ch;continue;}
    if(ch===quote){if(cell.length)throw new Error('Malformed CSV: quote begins inside an unquoted field.');quoted=true;continue;}
    if(ch===delimiter){pushCell();continue;}
    const crlf=ch==='\r'&&text[i+1]==='\n',line=(newline==='ANY'&&(ch==='\n'||ch==='\r'))||(newline==='LF'&&ch==='\n')||(newline==='CR'&&ch==='\r'&&!crlf)||(newline==='CRLF'&&crlf);
    if(line){if(crlf)i++;pushRow();continue;}cell+=ch;
  }
  if(quoted)throw new Error('Malformed CSV: unterminated quoted field.');if(cell.length||row.length)pushRow();
  if(!config.header)return rows;if(!rows.length)return [];const headers=rows[0];if(new Set(headers).size!==headers.length)throw new Error('PARSE_CSV header names must be unique.');return rows.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??''])));
}
function parseXml(text){
  if(typeof DOMParser==='undefined')throw new Error('PARSE_XML is unavailable in this execution environment.');const doc=new DOMParser().parseFromString(String(text),'application/xml');if(doc.querySelector?.('parsererror'))throw new Error('Malformed XML.');return doc;
}
function selectorDepth(text){return String(text||'').split(/[./\[\]]+/).filter(Boolean).length;}
function selectJsonPath(value,path){
  const text=String(path||'').trim();if(selectorDepth(text)>LIMITS.maxSelectorDepth)throw new Error('SELECT_JSON_PATH exceeds selector depth limit.');if(text==='$')return value;if(!text.startsWith('$.'))throw new Error('SELECT_JSON_PATH supports only deterministic root paths beginning with $.');
  const parts=[];for(const token of text.slice(2).split('.')){const m=token.match(/^([A-Za-z_][A-Za-z0-9_-]*)(?:\[(\d+)\])?$/);if(!m)throw new Error('Unsupported JSON selector token: '+token);parts.push(m[1]);if(m[2]!==undefined)parts.push(Number(m[2]));}
  let out=value;for(const part of parts){if(out===null||out===undefined||!(part in Object(out)))throw new Error('JSON path does not exist: '+text);out=out[part];}return out;
}
function selectXml(value,selector){
  const text=String(selector||'').trim();if(selectorDepth(text)>LIMITS.maxSelectorDepth)throw new Error('SELECT_XML exceeds selector depth limit.');if(!/^\/?[A-Za-z_][A-Za-z0-9_.-]*(?:\/[A-Za-z_][A-Za-z0-9_.-]*)*(?:\/@[A-Za-z_][A-Za-z0-9_.-]*)?$/.test(text))throw new Error('Unsupported XML selector syntax.');
  const doc=value?.documentElement?value:null;if(!doc)throw new Error('SELECT_XML requires parsed XML.');const parts=text.replace(/^\//,'').split('/'),attribute=parts.at(-1)?.startsWith('@')?parts.pop().slice(1):null;let nodes=[doc.documentElement];if(parts[0]===doc.documentElement.nodeName)parts.shift();for(const part of parts)nodes=nodes.flatMap(node=>[...node.children].filter(child=>child.nodeName===part));if(nodes.length>LIMITS.maxCollectionItems)throw new Error('SELECT_XML result exceeds collection limit.');if(attribute)return nodes.map(node=>node.getAttribute(attribute));return nodes;
}
function comparable(value){return value instanceof Uint8Array?[...value]:value;}
function exactNumber(value){if(typeof value==='bigint')return {kind:'integer',value};if(typeof value==='number'&&Number.isSafeInteger(value))return {kind:'integer',value:BigInt(value)};if(typeof value==='string'&&/^-?\d+$/.test(value.trim()))return {kind:'integer',value:BigInt(value.trim())};return null;}
function numericCompare(actual,expected,op,step){
  const ai=exactNumber(actual),ei=exactNumber(expected);if(ai&&ei){const a=ai.value,b=ei.value;return op==='EQ'?a===b:op==='GT'?a>b:op==='GTE'?a>=b:op==='LT'?a<b:a<=b;}
  const a=Number(actual),b=Number(expected);if(!Number.isFinite(a)||!Number.isFinite(b))throw new Error(op+' requires finite numeric values.');
  if(op==='EQ'){const abs=step.absoluteTolerance,rel=step.relativeTolerance;if(abs===undefined&&rel===undefined)throw new Error('Approximate numeric equality requires explicit absoluteTolerance, relativeTolerance, or exact integer/decimal-string semantics.');const diff=Math.abs(a-b),allowed=Math.max(abs===undefined?0:Number(abs),rel===undefined?0:Math.abs(b)*Number(rel));if(!Number.isFinite(allowed)||allowed<0)throw new Error('Numeric tolerance must be a finite nonnegative number.');return diff<=allowed;}
  return op==='GT'?a>b:op==='GTE'?a>=b:op==='LT'?a<b:a<=b;
}
function assertCondition(ok,expected,actual,message){return {determination:ok?'SATISFIED':'VIOLATED',expected,actual,message:message||null};}
const STEP_KEYS=Object.freeze({
  LOAD_ARTIFACT:['op','binding'],READ_BYTES:['op'],DECODE_UTF8:['op'],PARSE_JSON:['op'],PARSE_CSV:['op','config'],PARSE_XML:['op'],SELECT_JSON_PATH:['op','path'],SELECT_XML:['op','selector'],COUNT:['op'],SUM:['op'],MIN:['op'],MAX:['op'],SORT:['op'],UNIQUE:['op'],HASH_SHA256:['op'],REGEX:['op','pattern','flags'],COMPARE:['op','value','binding'],ASSERT_EQ:['op','value','absoluteTolerance','relativeTolerance','message'],ASSERT_GT:['op','value','message'],ASSERT_GTE:['op','value','message'],ASSERT_LT:['op','value','message'],ASSERT_LTE:['op','value','message'],ASSERT_MATCH:['op','pattern','flags','message'],ASSERT_CONTAINS:['op','value','message'],ASSERT_NOT_CONTAINS:['op','value','message'],ASSERT_SET_EQUAL:['op','value','message'],BYTE_COMPARE:['op','binding']
});
function validateSpec(spec,bindings={}){
  const issues=[];if(!spec||typeof spec!=='object'||Array.isArray(spec))return {valid:false,issues:['Test IR must be an object.']};for(const key of Object.keys(spec))if(!['version','steps'].includes(key))issues.push('Test IR contains unsupported root property '+key+'.');if(spec.version!==SPEC_VERSION)issues.push('Unsupported Test IR version.');if(!Array.isArray(spec.steps)||!spec.steps.length)issues.push('Test IR requires at least one step.');if((spec.steps?.length||0)>LIMITS.maxSteps)issues.push('Test IR exceeds maximum step count.');
  for(const [index,step] of (spec.steps||[]).entries()){
    if(!step||typeof step!=='object'||Array.isArray(step)){issues.push(`Step ${index} is not an object.`);continue;}if(!OPS.includes(step.op)){issues.push(`Step ${index} uses unsupported operation ${String(step.op)}.`);continue;}for(const key of FORBIDDEN_STEP_KEYS)if(Object.prototype.hasOwnProperty.call(step,key))issues.push(`Step ${index} contains forbidden executable field ${key}.`);for(const key of Object.keys(step))if(!STEP_KEYS[step.op].includes(key))issues.push(`Step ${index} ${step.op} contains unsupported property ${key}.`);
    if(step.op==='LOAD_ARTIFACT'||step.op==='BYTE_COMPARE')if(typeof step.binding!=='string'||!step.binding)issues.push(`Step ${index} ${step.op} requires binding.`);if(step.op==='SELECT_JSON_PATH'&&typeof step.path!=='string')issues.push(`Step ${index} SELECT_JSON_PATH requires string path.`);if(step.op==='SELECT_XML'&&typeof step.selector!=='string')issues.push(`Step ${index} SELECT_XML requires string selector.`);if(step.op==='PARSE_CSV'&&(!step.config||typeof step.config!=='object'||Array.isArray(step.config)))issues.push(`Step ${index} PARSE_CSV requires explicit config.`);if(['REGEX','ASSERT_MATCH'].includes(step.op)&&String(step.pattern??'').length>LIMITS.maxRegexLength)issues.push(`Step ${index} regex exceeds maximum length.`);
  }
  const bindingCheck=validateBindings(bindings);issues.push(...bindingCheck.issues);return {valid:issues.length===0,issues};
}
function validateBindings(bindings){
  const issues=[];if(!bindings||typeof bindings!=='object'||Array.isArray(bindings))return {valid:false,issues:['EXECUTABLE_INPUT_BINDINGS must be an object.']};for(const [name,binding] of Object.entries(bindings)){if(!/^[A-Z][A-Z0-9_]{0,63}$/.test(name))issues.push(`Invalid Test IR binding name ${name}.`);if(typeof binding==='string')continue;if(!binding||typeof binding!=='object'||Array.isArray(binding)){issues.push(`Binding ${name} must be an artifact ID string or a closed binding object.`);continue;}const allowed=new Set(['artifactId','source','artifactRole','filename','canonicalBinding']);for(const key of Object.keys(binding))if(!allowed.has(key))issues.push(`Binding ${name} contains unsupported key ${key}.`);if(binding.source&&!['CURRENT_PRODUCT','CURRENT_SCOPE','CANONICAL_BINDING'].includes(binding.source))issues.push(`Binding ${name} has unsupported source ${binding.source}.`);if(!binding.artifactId&&!binding.artifactRole&&!binding.filename&&!binding.canonicalBinding)issues.push(`Binding ${name} does not identify an artifact or immutable canonical binding.`);}return {valid:issues.length===0,issues};
}
function supports(test){if(String(field(test,'EXECUTION_MODE')||'').toUpperCase()!=='APPLICATION_DETERMINISTIC')return false;if(String(field(test,'REQUIRED_CAPABILITY')||'').toUpperCase()!==CAPABILITY)return false;if(String(field(test,'EXECUTABLE_KIND')||'').toUpperCase()!=='TEST_IR')return false;if(field(test,'EXECUTABLE_SPEC_VERSION')!==SPEC_VERSION)return false;return validateSpec(field(test,'EXECUTABLE_SPEC'),field(test,'EXECUTABLE_INPUT_BINDINGS')).valid;}
async function executeTest(test,artifacts={},canonicalBindings={}){if(!supports(test))throw new Error('Test is not a supported current TEST_IR test.');return execute({spec:field(test,'EXECUTABLE_SPEC'),artifacts,canonicalBindings});}
async function execute({spec,artifacts={},canonicalBindings={}}){
  const check=validateSpec(spec,Object.fromEntries(Object.keys(artifacts||{}).map(k=>[k,k])));if(!check.valid&&check.issues.some(x=>!x.startsWith('EXECUTABLE_INPUT_BINDINGS')))throw new Error(check.issues.join(' '));let totalBytes=0;for(const artifact of Object.values(artifacts||{})){const b=bytesOf(artifact?.bytes);if(b)totalBytes+=b.byteLength;}if(totalBytes>LIMITS.maxInputBytes)throw new Error('Test input exceeds deterministic runtime byte limit.');
  const source={...(artifacts||{})};for(const [k,v] of Object.entries(canonicalBindings||{}))source[k]={value:v,canonicalBinding:true};let value=null,currentArtifact=null,lastRegex=null,assertion=null;const observations=[];
  for(const [index,step] of spec.steps.entries()){
    switch(step.op){
      case 'LOAD_ARTIFACT':{const a=source[step.binding];if(!a)throw new Error(`Artifact binding ${step.binding} is unavailable.`);currentArtifact=a;value=a.canonicalBinding?a.value:a;observations.push({step:index,op:step.op,binding:step.binding,artifactId:a.artifactId||null,filename:a.filename||null,sha256:a.sha256||null,canonicalBinding:Boolean(a.canonicalBinding)});break;}
      case 'READ_BYTES':{const bytes=bytesOf(currentArtifact?.bytes??value?.bytes??value);if(!bytes)throw new Error('READ_BYTES requires artifact bytes.');if(bytes.byteLength>LIMITS.maxInputBytes)throw new Error('READ_BYTES exceeds deterministic runtime byte limit.');value=bytes;observations.push({step:index,op:step.op,byteLength:bytes.byteLength});break;}
      case 'DECODE_UTF8':{const bytes=bytesOf(value);if(!bytes)throw new Error('DECODE_UTF8 requires bytes.');if(bytes.byteLength>LIMITS.maxInputBytes)throw new Error('Text input exceeds deterministic runtime byte limit.');value=new TextDecoder('utf-8',{fatal:true}).decode(bytes);break;}
      case 'PARSE_JSON':value=enforceParsedLimits(JSON.parse(String(value)));break;
      case 'PARSE_CSV':value=enforceParsedLimits(parseCsv(String(value),step.config));break;
      case 'PARSE_XML':value=parseXml(String(value));break;
      case 'SELECT_JSON_PATH':value=selectJsonPath(value,step.path);break;
      case 'SELECT_XML':value=selectXml(value,step.selector);break;
      case 'COUNT':{if(value==null||typeof value.length!=='number')throw new Error('COUNT requires an array, string, or array-like value.');if(value.length>LIMITS.maxCollectionItems)throw new Error('COUNT input exceeds collection limit.');value=value.length;break;}
      case 'SUM':case 'MIN':case 'MAX':{if(!Array.isArray(value)||value.length>LIMITS.maxCollectionItems)throw new Error(`${step.op} requires a bounded array.`);const ints=value.map(exactNumber);if(ints.every(Boolean)){const vals=ints.map(x=>x.value);value=step.op==='SUM'?vals.reduce((a,b)=>a+b,0n):step.op==='MIN'?vals.reduce((a,b)=>a<b?a:b):vals.reduce((a,b)=>a>b?a:b);}else{const nums=value.map(Number);if(nums.some(x=>!Number.isFinite(x)))throw new Error(`${step.op} requires finite numeric values.`);value=step.op==='SUM'?nums.reduce((a,b)=>a+b,0):step.op==='MIN'?Math.min(...nums):Math.max(...nums);}break;}
      case 'SORT':{if(!Array.isArray(value)||value.length>LIMITS.maxCollectionItems)throw new Error('SORT requires a bounded array.');value=[...value].sort((a,b)=>stable(a).localeCompare(stable(b)));break;}
      case 'UNIQUE':{if(!Array.isArray(value)||value.length>LIMITS.maxCollectionItems)throw new Error('UNIQUE requires a bounded array.');const seen=new Set();value=value.filter(v=>{const k=stable(v);if(seen.has(k))return false;seen.add(k);return true;});break;}
      case 'HASH_SHA256':value=await sha256(value);break;
      case 'REGEX':{const input=String(value);if(input.length>LIMITS.maxRegexInputLength)throw new Error('REGEX input exceeds deterministic runtime limit.');const r=new RegExp(String(step.pattern||''),String(step.flags||''));lastRegex=r;value=r.test(input);break;}
      case 'COMPARE':{const other=Object.prototype.hasOwnProperty.call(step,'value')?step.value:source[step.binding]?.value;value=stable(comparable(value))===stable(comparable(other));break;}
      case 'BYTE_COMPARE':{const left=bytesOf(value?.bytes??value),other=bytesOf(source[step.binding]?.bytes);if(!left||!other)throw new Error('BYTE_COMPARE requires byte-backed current value and target binding.');let equal=left.byteLength===other.byteLength;if(equal)for(let i=0;i<left.byteLength;i++)if(left[i]!==other[i]){equal=false;break;}value=equal;break;}
      case 'ASSERT_EQ':{const a=exactNumber(value),b=exactNumber(step.value),numeric=(a&&b)||typeof value==='number'||typeof step.value==='number';const ok=numeric?numericCompare(value,step.value,'EQ',step):stable(comparable(value))===stable(comparable(step.value));assertion=assertCondition(ok,step.value,comparable(value),step.message);break;}
      case 'ASSERT_GT':assertion=assertCondition(numericCompare(value,step.value,'GT',step),`> ${step.value}`,value,step.message);break;
      case 'ASSERT_GTE':assertion=assertCondition(numericCompare(value,step.value,'GTE',step),`>= ${step.value}`,value,step.message);break;
      case 'ASSERT_LT':assertion=assertCondition(numericCompare(value,step.value,'LT',step),`< ${step.value}`,value,step.message);break;
      case 'ASSERT_LTE':assertion=assertCondition(numericCompare(value,step.value,'LTE',step),`<= ${step.value}`,value,step.message);break;
      case 'ASSERT_MATCH':{const input=String(value);if(input.length>LIMITS.maxRegexInputLength)throw new Error('ASSERT_MATCH input exceeds deterministic runtime limit.');const r=lastRegex||new RegExp(String(step.pattern??''),String(step.flags||''));assertion=assertCondition(r.test(input),String(r),value,step.message);break;}
      case 'ASSERT_CONTAINS':{const ok=Array.isArray(value)?value.some(v=>stable(v)===stable(step.value)):String(value).includes(String(step.value));assertion=assertCondition(ok,`contains ${stable(step.value)}`,value,step.message);break;}
      case 'ASSERT_NOT_CONTAINS':{const ok=Array.isArray(value)?!value.some(v=>stable(v)===stable(step.value)):!String(value).includes(String(step.value));assertion=assertCondition(ok,`does not contain ${stable(step.value)}`,value,step.message);break;}
      case 'ASSERT_SET_EQUAL':{if(!Array.isArray(value)||!Array.isArray(step.value))throw new Error('ASSERT_SET_EQUAL requires arrays.');const a=[...new Set(value.map(stable))].sort(),b=[...new Set(step.value.map(stable))].sort();assertion=assertCondition(stable(a)===stable(b),step.value,value,step.message);break;}
      default:throw new Error(`Unsupported Test IR operation ${step.op}.`);
    }
    if(assertion){observations.push({step:index,op:step.op,...assertion});if(assertion.determination==='VIOLATED')return {status:'COMPLETE',determination:'VIOLATED',expected:assertion.expected,actual:assertion.actual,observations,executorVersion:VERSION,runtimeVersion:VERSION,testSpecVersion:SPEC_VERSION};assertion=null;}
  }
  const finalAssertion=[...observations].reverse().find(x=>x.determination);return {status:'COMPLETE',determination:finalAssertion?.determination||'UNDETERMINED',expected:finalAssertion?.expected??null,actual:finalAssertion?.actual??value,observations,executorVersion:VERSION,runtimeVersion:VERSION,testSpecVersion:SPEC_VERSION};
}
function capabilities(){return Object.freeze({capability:CAPABILITY,specVersion:SPEC_VERSION,operations:[...OPS],limits:{...LIMITS},prohibited:['arbitrary JavaScript','arbitrary Python','shell commands','dynamic imports','eval','Function','arbitrary network access','unregistered executable source']});}
globalThis.closedLoopTestRuntime=Object.freeze({VERSION,SPEC_VERSION,CAPABILITY,OPS,LIMITS,validateSpec,validateBindings,supports,execute,executeTest,capabilities});
})();

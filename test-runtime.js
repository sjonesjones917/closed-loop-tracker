(()=>{
'use strict';
const VERSION='closed-loop-test-runtime/1';
const SPEC_VERSION='closed-loop-test-spec/1';
const CAPABILITY='CLOSED_LOOP_TEST_IR';
const OPS=Object.freeze([
  'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML',
  'SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256',
  'REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH',
  'ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'
]);
const LIMITS=Object.freeze({
  maxInputBytes:16*1024*1024,
  maxDecompressedBytes:32*1024*1024,
  maxSteps:64,
  maxSelectorDepth:32,
  maxParsedDepth:64,
  maxCollectionItems:100000,
  maxRegexPatternBytes:2048,
  maxRegexInputBytes:2*1024*1024,
  maxWorkerDurationMs:5000,
  maxArchiveExpansionBytes:32*1024*1024,
  maxCsvCells:250000,
  maxXmlNodes:100000
});
const FORBIDDEN_STEP_KEYS=Object.freeze(['code','javascript','python','shell','command','eval','function','script','module','import']);
const ROOT_KEYS=Object.freeze(new Set(['version','steps']));
const STEP_KEYS=Object.freeze({
  LOAD_ARTIFACT:new Set(['op','binding']),READ_BYTES:new Set(['op']),DECODE_UTF8:new Set(['op','encoding']),
  PARSE_JSON:new Set(['op']),PARSE_CSV:new Set(['op','config']),PARSE_XML:new Set(['op']),
  SELECT_JSON_PATH:new Set(['op','path']),SELECT_XML:new Set(['op','path']),COUNT:new Set(['op']),SUM:new Set(['op']),MIN:new Set(['op']),MAX:new Set(['op']),
  SORT:new Set(['op','direction']),UNIQUE:new Set(['op']),HASH_SHA256:new Set(['op']),
  REGEX:new Set(['op','pattern','flags']),COMPARE:new Set(['op','value','binding']),
  ASSERT_EQ:new Set(['op','value','absoluteTolerance','relativeTolerance']),ASSERT_GT:new Set(['op','value']),ASSERT_GTE:new Set(['op','value']),ASSERT_LT:new Set(['op','value']),ASSERT_LTE:new Set(['op','value']),
  ASSERT_MATCH:new Set(['op','pattern','flags']),ASSERT_CONTAINS:new Set(['op','value']),ASSERT_NOT_CONTAINS:new Set(['op','value']),ASSERT_SET_EQUAL:new Set(['op','value']),BYTE_COMPARE:new Set(['op','binding'])
});
const bytesOf=value=>value instanceof Uint8Array?value:value instanceof ArrayBuffer?new Uint8Array(value):ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):null;
const field=(test,key)=>test?.fields?.[key]??test?.[key];
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
function utf8Bytes(text){return new TextEncoder().encode(String(text)).byteLength;}
async function sha256(bytes){const data=bytesOf(bytes);if(!data)throw new Error('HASH_SHA256 requires bytes.');const digest=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function parsedDepth(value,depth=0,seen=new Set()){if(depth>LIMITS.maxParsedDepth)throw new Error('Parsed structure exceeds deterministic depth limit.');if(value===null||typeof value!=='object')return depth;if(seen.has(value))throw new Error('Parsed structure contains a cycle.');seen.add(value);let count=0;for(const child of Array.isArray(value)?value:Object.values(value)){count++;if(count>LIMITS.maxCollectionItems)throw new Error('Parsed structure exceeds deterministic collection limit.');parsedDepth(child,depth+1,seen);}seen.delete(value);return depth;}
function safeRegex(pattern,flags=''){
  const p=String(pattern??''),f=String(flags??'');
  if(utf8Bytes(p)>LIMITS.maxRegexPatternBytes)throw new Error('Regex pattern exceeds deterministic limit.');
  if(!/^[imsu]*$/.test(f)||new Set(f).size!==f.length)throw new Error('Regex flags are outside the registered safe subset.');
  if(/\\[1-9]/.test(p)||/\(\?[=!<]/.test(p)||/\(\?<[^=!]/.test(p))throw new Error('Regex uses unsupported backreference or lookaround syntax.');
  if(/\([^)]*(?:\*|\+|\{\d+(?:,\d*)?\})[^)]*\)(?:\*|\+|\{\d+(?:,\d*)?\})/.test(p))throw new Error('Regex contains a prohibited nested quantifier.');
  return new RegExp(p,f);
}
function validateJsonSelector(path){const text=String(path??'').trim();if(text==='$')return {valid:true,depth:0};if(!text.startsWith('$.'))return {valid:false,reason:'JSON selector must be $ or begin with $.'};const tokens=text.slice(2).split('.');if(tokens.length>LIMITS.maxSelectorDepth)return {valid:false,reason:'JSON selector exceeds depth limit.'};for(const token of tokens)if(!/^[A-Za-z_$][\w$-]*(?:\[(?:\d+|\*)\])?$/.test(token))return {valid:false,reason:`Unsupported JSON selector token ${token}.`};return {valid:true,depth:tokens.length};}
function selectJsonPath(value,path){const check=validateJsonSelector(path);if(!check.valid)throw new Error(check.reason);const text=String(path).trim();if(text==='$')return value;let nodes=[value];for(const token of text.slice(2).split('.')){const match=token.match(/^([^\[]+)(?:\[(\d+|\*)\])?$/),key=match[1],index=match[2];nodes=nodes.flatMap(node=>{const next=node==null?undefined:node[key];if(index===undefined)return [next];if(index==='*')return Array.isArray(next)?next:[];const i=Number(index);return Array.isArray(next)&&i<next.length?[next[i]]:[];}).filter(v=>v!==undefined);if(nodes.length>LIMITS.maxCollectionItems)throw new Error('JSON selector result exceeds collection limit.');}return nodes.length===1?nodes[0]:nodes;}
function parseCsv(text,config){
  if(!config||typeof config!=='object'||Array.isArray(config))throw new Error('PARSE_CSV requires explicit config.');
  const required=['delimiter','header','quote','newline','encoding'];for(const key of required)if(!own(config,key))throw new Error(`PARSE_CSV config requires ${key}.`);
  const allowed=new Set(required);for(const key of Object.keys(config))if(!allowed.has(key))throw new Error(`PARSE_CSV config contains unsupported key ${key}.`);
  const delimiter=String(config.delimiter),quote=String(config.quote),newline=String(config.newline).toUpperCase(),encoding=String(config.encoding).toUpperCase();
  if([...delimiter].length!==1||['\r','\n'].includes(delimiter))throw new Error('CSV delimiter must be one non-newline character.');
  if([...quote].length!==1||quote===delimiter||['\r','\n'].includes(quote))throw new Error('CSV quote must be one distinct non-newline character.');
  if(typeof config.header!=='boolean')throw new Error('CSV header must be boolean.');
  if(!['AUTO','LF','CRLF','CR'].includes(newline))throw new Error('CSV newline must be AUTO, LF, CRLF, or CR.');
  if(encoding!=='UTF-8'&&encoding!=='UTF8')throw new Error('CSV v1 supports UTF-8 only.');
  const rows=[];let row=[],cell='',quoted=false,cells=0;
  const isBreak=(i)=>newline==='LF'?text[i]==='\n':newline==='CR'?text[i]==='\r':newline==='CRLF'?text[i]==='\r'&&text[i+1]==='\n':text[i]==='\n'||text[i]==='\r';
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){if(ch===quote&&text[i+1]===quote){cell+=quote;i++;}else if(ch===quote)quoted=false;else cell+=ch;continue;}
    if(ch===quote){if(cell.length)throw new Error('Malformed CSV: quote begins inside an unquoted field.');quoted=true;continue;}
    if(ch===delimiter){row.push(cell);cell='';cells++;}
    else if(isBreak(i)){row.push(cell);rows.push(row);row=[];cell='';cells++;if(text[i]==='\r'&&text[i+1]==='\n')i++;}
    else cell+=ch;
    if(cells>LIMITS.maxCsvCells)throw new Error('CSV exceeds deterministic cell limit.');
  }
  if(quoted)throw new Error('Malformed CSV: unterminated quoted field.');
  if(cell.length||row.length){row.push(cell);rows.push(row);}
  if(rows.length>LIMITS.maxCollectionItems)throw new Error('CSV exceeds deterministic row limit.');
  if(!config.header)return rows;
  if(!rows.length)return [];
  const headers=rows[0];if(new Set(headers).size!==headers.length)throw new Error('CSV header contains duplicate names.');
  return rows.slice(1).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]??''])));
}
function decodeXmlEntities(text){return String(text).replace(/&([^;]+);/g,(_,name)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[name]??(()=>{throw new Error(`Unsupported XML entity &${name};`);})()));}
function parseXml(text){
  const source=String(text);if(/<!DOCTYPE|<!ENTITY|<\?/i.test(source))throw new Error('XML DTD, entities, and processing instructions are unsupported.');
  const synthetic={name:'#document',attributes:{},children:[],text:''},stack=[synthetic];let nodes=0,last=0;const re=/<[^>]+>/g;let match;
  while((match=re.exec(source))){const rawText=source.slice(last,match.index);if(rawText)stack.at(-1).text+=decodeXmlEntities(rawText);const tag=match[0];last=re.lastIndex;if(/^<!--/.test(tag)){if(!/-->$/.test(tag))throw new Error('Malformed XML comment.');continue;}if(/^<\//.test(tag)){const name=tag.slice(2,-1).trim();if(stack.length===1||stack.at(-1).name!==name)throw new Error(`Mismatched XML closing tag ${name}.`);stack.pop();continue;}const selfClosing=/\/>$/.test(tag),inner=tag.slice(1,selfClosing?-2:-1).trim(),m=inner.match(/^([A-Za-z_][\w:.-]*)([\s\S]*)$/);if(!m)throw new Error('Malformed XML start tag.');const [,name,rest]=m,attributes={};let consumed='';const attr=/\s+([A-Za-z_][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;let a;while((a=attr.exec(rest))){if(own(attributes,a[1]))throw new Error(`Duplicate XML attribute ${a[1]}.`);attributes[a[1]]=decodeXmlEntities(a[2].slice(1,-1));consumed+=a[0];}if(rest.trim()&&consumed.replace(/\s/g,'')!==rest.replace(/\s/g,''))throw new Error('Unsupported or malformed XML attribute syntax.');const node={name,attributes,children:[],text:''};stack.at(-1).children.push(node);nodes++;if(nodes>LIMITS.maxXmlNodes)throw new Error('XML exceeds node limit.');if(!selfClosing){stack.push(node);if(stack.length-1>LIMITS.maxParsedDepth)throw new Error('XML exceeds parsed depth limit.');}}
  if(source.slice(last))stack.at(-1).text+=decodeXmlEntities(source.slice(last));if(stack.length!==1)throw new Error(`Unclosed XML tag ${stack.at(-1).name}.`);if(synthetic.children.length!==1)throw new Error('XML must contain exactly one document element.');return synthetic.children[0];
}
function validateXmlSelector(path){const text=String(path??'').trim();if(!text.startsWith('/'))return {valid:false,reason:'XML selector must begin with /.'};const parts=text.split('/').slice(1);if(parts.length>LIMITS.maxSelectorDepth)return {valid:false,reason:'XML selector exceeds depth limit.'};if(!parts.length)return {valid:false,reason:'XML selector is empty.'};for(let i=0;i<parts.length;i++){const part=parts[i];if(i===parts.length-1&&(part==='text()'||/^@[A-Za-z_][\w:.-]*$/.test(part)))continue;if(!/^[A-Za-z_][\w:.-]*(?:\[\d+\])?$/.test(part))return {valid:false,reason:`Unsupported XML selector token ${part}.`};}return {valid:true,parts};}
function selectXml(root,path){const check=validateXmlSelector(path);if(!check.valid)throw new Error(check.reason);let nodes=[root];for(let i=0;i<check.parts.length;i++){const part=check.parts[i];if(part==='text()')return nodes.length===1?nodes[0].text:nodes.map(n=>n.text);if(part.startsWith('@')){const key=part.slice(1),values=nodes.map(n=>n.attributes?.[key]).filter(v=>v!==undefined);return values.length===1?values[0]:values;}const m=part.match(/^([^\[]+)(?:\[(\d+)\])?$/),name=m[1],index=m[2];if(i===0&&nodes.length===1&&nodes[0]?.name===name){if(index!==undefined&&Number(index)!==0)nodes=[];continue;}nodes=nodes.flatMap(n=>(n.children||[]).filter(c=>c.name===name));if(index!==undefined)nodes=nodes[Number(index)]?[nodes[Number(index)]]:[];if(nodes.length>LIMITS.maxCollectionItems)throw new Error('XML selector result exceeds collection limit.');}return nodes.length===1?nodes[0]:nodes;}
function validateStep(step,index,issues){
  if(!step||typeof step!=='object'||Array.isArray(step)){issues.push(`Step ${index} is not an object.`);return;}
  const op=String(step.op||'');if(!OPS.includes(op)){issues.push(`Step ${index} uses unsupported operation ${op||'UNKNOWN'}.`);return;}
  const allowed=STEP_KEYS[op];for(const key of Object.keys(step))if(!allowed.has(key))issues.push(`Step ${index} operation ${op} contains unknown property ${key}.`);
  for(const key of FORBIDDEN_STEP_KEYS)if(own(step,key))issues.push(`Step ${index} contains forbidden executable field ${key}.`);
  const needsBinding=['LOAD_ARTIFACT','BYTE_COMPARE'].includes(op);if(needsBinding&&(!own(step,'binding')||!String(step.binding).trim()))issues.push(`Step ${index} ${op} requires binding.`);
  if(op==='SELECT_JSON_PATH'){const check=validateJsonSelector(step.path);if(!check.valid)issues.push(`Step ${index}: ${check.reason}`);}
  if(op==='SELECT_XML'){const check=validateXmlSelector(step.path);if(!check.valid)issues.push(`Step ${index}: ${check.reason}`);}
  if(op==='PARSE_CSV'){try{parseCsv('',step.config);}catch(error){issues.push(`Step ${index}: ${error.message}`);}}
  if(op==='REGEX'||op==='ASSERT_MATCH'){try{safeRegex(step.pattern??step.value??'',step.flags||'');}catch(error){issues.push(`Step ${index}: ${error.message}`);}}
  if(['ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL'].includes(op)&&!own(step,'value'))issues.push(`Step ${index} ${op} requires value.`);
  if(op==='ASSERT_EQ'){for(const key of ['absoluteTolerance','relativeTolerance'])if(own(step,key)&&(!Number.isFinite(step[key])||step[key]<0))issues.push(`Step ${index} ${key} must be a finite nonnegative number.`);}
  if(op==='SORT'&&own(step,'direction')&&!['ASC','DESC'].includes(String(step.direction).toUpperCase()))issues.push(`Step ${index} SORT direction must be ASC or DESC.`);
}
function validateSpec(spec){
  const issues=[];if(!spec||typeof spec!=='object'||Array.isArray(spec))return {valid:false,issues:['Test IR must be an object.']};
  for(const key of Object.keys(spec))if(!ROOT_KEYS.has(key))issues.push(`Test IR contains unknown root property ${key}.`);
  if(spec.version!==SPEC_VERSION)issues.push('Unsupported Test IR version.');if(!Array.isArray(spec.steps)||!spec.steps.length)issues.push('Test IR requires at least one step.');if((spec.steps?.length||0)>LIMITS.maxSteps)issues.push('Test IR exceeds maximum step count.');
  for(const [index,step] of (spec.steps||[]).entries())validateStep(step,index,issues);return {valid:issues.length===0,issues};
}
function validateBindings(bindings){
  const issues=[];if(!bindings||typeof bindings!=='object'||Array.isArray(bindings))return {valid:false,issues:['EXECUTABLE_INPUT_BINDINGS must be an object.']};
  for(const [name,binding] of Object.entries(bindings)){if(!/^[A-Z][A-Z0-9_]{0,63}$/.test(name))issues.push(`Invalid Test IR binding name ${name}.`);if(typeof binding==='string'){if(!binding.trim())issues.push(`Binding ${name} is empty.`);continue;}if(!binding||typeof binding!=='object'||Array.isArray(binding)){issues.push(`Binding ${name} must be an artifact ID string or a closed binding object.`);continue;}const allowed=new Set(['artifactId','source','artifactRole','filename','canonicalKey']);for(const key of Object.keys(binding))if(!allowed.has(key))issues.push(`Binding ${name} contains unsupported key ${key}.`);if(binding.source&&!['CURRENT_PRODUCT','CURRENT_SCOPE','CANONICAL_VALUE'].includes(binding.source))issues.push(`Binding ${name} has unsupported source ${binding.source}.`);if(binding.source==='CANONICAL_VALUE'){if(!binding.canonicalKey)issues.push(`Binding ${name} requires canonicalKey.`);}else if(!binding.artifactId&&!binding.artifactRole&&!binding.filename)issues.push(`Binding ${name} does not identify an artifact.`);}
  return {valid:issues.length===0,issues};
}
function supports(test){if(String(field(test,'EXECUTION_MODE')||'').toUpperCase()!=='APPLICATION_DETERMINISTIC')return false;if(String(field(test,'REQUIRED_CAPABILITY')||'').toUpperCase()!==CAPABILITY)return false;if(String(field(test,'EXECUTABLE_KIND')||'').toUpperCase()!=='TEST_IR')return false;if(field(test,'EXECUTABLE_SPEC_VERSION')!==SPEC_VERSION)return false;return validateSpec(field(test,'EXECUTABLE_SPEC')).valid&&validateBindings(field(test,'EXECUTABLE_INPUT_BINDINGS')).valid;}
function normalizeArtifacts(artifacts){if(Array.isArray(artifacts))return Object.fromEntries(artifacts.map(a=>[String(a.binding||a.artifactId||a.filename),a]));return artifacts&&typeof artifacts==='object'?artifacts:{};}
function finiteNumber(value,label){if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`${label} requires a finite numeric value.`);if(!Number.isSafeInteger(value))throw new Error(`${label} precision is unsupported natively without explicit tolerance or exact nonnumeric representation.`);return value;}
function equality(actual,expected,step){if(typeof actual==='number'||typeof expected==='number'){if(typeof actual!=='number'||typeof expected!=='number'||!Number.isFinite(actual)||!Number.isFinite(expected))throw new Error('ASSERT_EQ numeric operands must both be finite numbers.');const hasAbs=own(step,'absoluteTolerance'),hasRel=own(step,'relativeTolerance');if(hasAbs||hasRel){const abs=hasAbs?step.absoluteTolerance:0,rel=hasRel?step.relativeTolerance:0,diff=Math.abs(actual-expected),scale=Math.max(Math.abs(actual),Math.abs(expected));return diff<=Math.max(abs,rel*scale);}if(!Number.isSafeInteger(actual)||!Number.isSafeInteger(expected))throw new Error('Precision-sensitive numeric equality requires explicit tolerance or exact decimal-string representation.');return actual===expected;}return stable(actual)===stable(expected);}
function assertResult(ok,expected,actual){return {determination:ok?'SATISFIED':'VIOLATED',expected,actual};}
async function execute({spec,artifacts,canonicalBindings={}}={}){
  const check=validateSpec(spec);if(!check.valid)throw new Error(check.issues.join(' '));const source=normalizeArtifacts(artifacts);let totalBytes=0;for(const a of Object.values(source)){const b=bytesOf(a?.bytes??a);if(b)totalBytes+=b.byteLength;}if(totalBytes>LIMITS.maxInputBytes)throw new Error('Total Test IR input exceeds deterministic byte limit.');let value=null,currentArtifact=null,lastRegex=null;const observations=[];
  for(const [index,step] of spec.steps.entries()){
    let assertion=null;
    switch(step.op){
      case 'LOAD_ARTIFACT':{const a=source[step.binding];if(a){currentArtifact=a;value=a;break;}if(own(canonicalBindings,step.binding)){currentArtifact=null;value=canonicalBindings[step.binding];break;}throw new Error(`Artifact or canonical binding ${step.binding} is unavailable.`);}
      case 'READ_BYTES':{const b=bytesOf(currentArtifact?.bytes??value?.bytes??value);if(!b)throw new Error('READ_BYTES requires artifact bytes.');value=b;observations.push({step:index,op:step.op,byteLength:b.byteLength});break;}
      case 'DECODE_UTF8':{if(step.encoding&& !['UTF-8','UTF8'].includes(String(step.encoding).toUpperCase()))throw new Error('DECODE_UTF8 supports UTF-8 only.');const b=bytesOf(value);if(!b)throw new Error('DECODE_UTF8 requires bytes.');if(b.byteLength>LIMITS.maxInputBytes)throw new Error('Text input exceeds deterministic byte limit.');value=new TextDecoder('utf-8',{fatal:true}).decode(b);break;}
      case 'PARSE_JSON':value=JSON.parse(String(value));parsedDepth(value);break;
      case 'PARSE_CSV':value=parseCsv(String(value),step.config);parsedDepth(value);break;
      case 'PARSE_XML':value=parseXml(String(value));break;
      case 'SELECT_JSON_PATH':value=selectJsonPath(value,step.path);break;
      case 'SELECT_XML':value=selectXml(value,step.path);break;
      case 'COUNT':{if(Array.isArray(value)||typeof value==='string')value=value.length;else if(value&&typeof value==='object')value=Object.keys(value).length;else throw new Error('COUNT requires a collection, object, or string.');break;}
      case 'SUM':case 'MIN':case 'MAX':{if(!Array.isArray(value)||value.length>LIMITS.maxCollectionItems)throw new Error(`${step.op} requires a bounded array.`);const nums=value.map((v,i)=>finiteNumber(v,`${step.op}[${i}]`));value=step.op==='SUM'?nums.reduce((a,b)=>a+b,0):step.op==='MIN'?Math.min(...nums):Math.max(...nums);if(!Number.isSafeInteger(value))throw new Error(`${step.op} result exceeds exact safe-integer semantics.`);break;}
      case 'SORT':{if(!Array.isArray(value)||value.length>LIMITS.maxCollectionItems)throw new Error('SORT requires a bounded array.');value=[...value].sort((a,b)=>stable(a).localeCompare(stable(b)));if(String(step.direction||'ASC').toUpperCase()==='DESC')value.reverse();break;}
      case 'UNIQUE':{if(!Array.isArray(value)||value.length>LIMITS.maxCollectionItems)throw new Error('UNIQUE requires a bounded array.');const seen=new Set();value=value.filter(v=>{const k=stable(v);if(seen.has(k))return false;seen.add(k);return true;});break;}
      case 'HASH_SHA256':value=await sha256(value);break;
      case 'REGEX':{if(utf8Bytes(value)>LIMITS.maxRegexInputBytes)throw new Error('Regex input exceeds deterministic limit.');lastRegex=safeRegex(step.pattern,step.flags||'');value=lastRegex.test(String(value));break;}
      case 'COMPARE':{const other=own(step,'value')?step.value:source[step.binding]?.value??canonicalBindings[step.binding];value=stable(value)===stable(other);break;}
      case 'BYTE_COMPARE':{const left=bytesOf(value),right=bytesOf(source[step.binding]?.bytes??source[step.binding]);if(!left||!right)throw new Error('BYTE_COMPARE requires byte-backed current value and target binding.');let equal=left.byteLength===right.byteLength;if(equal)for(let i=0;i<left.byteLength;i++)if(left[i]!==right[i]){equal=false;break;}value=equal;break;}
      case 'ASSERT_EQ':assertion=assertResult(equality(value,step.value,step),step.value,value);break;
      case 'ASSERT_GT':assertion=assertResult(finiteNumber(value,'ASSERT_GT')>finiteNumber(step.value,'ASSERT_GT expected'),`> ${step.value}`,value);break;
      case 'ASSERT_GTE':assertion=assertResult(finiteNumber(value,'ASSERT_GTE')>=finiteNumber(step.value,'ASSERT_GTE expected'),`>= ${step.value}`,value);break;
      case 'ASSERT_LT':assertion=assertResult(finiteNumber(value,'ASSERT_LT')<finiteNumber(step.value,'ASSERT_LT expected'),`< ${step.value}`,value);break;
      case 'ASSERT_LTE':assertion=assertResult(finiteNumber(value,'ASSERT_LTE')<=finiteNumber(step.value,'ASSERT_LTE expected'),`<= ${step.value}`,value);break;
      case 'ASSERT_MATCH':{if(utf8Bytes(value)>LIMITS.maxRegexInputBytes)throw new Error('Regex input exceeds deterministic limit.');const r=lastRegex||safeRegex(step.pattern,step.flags||'');assertion=assertResult(r.test(String(value)),String(r),value);break;}
      case 'ASSERT_CONTAINS':{const ok=Array.isArray(value)?value.some(v=>stable(v)===stable(step.value)):String(value).includes(String(step.value));assertion=assertResult(ok,`contains ${stable(step.value)}`,value);break;}
      case 'ASSERT_NOT_CONTAINS':{const ok=Array.isArray(value)?!value.some(v=>stable(v)===stable(step.value)):!String(value).includes(String(step.value));assertion=assertResult(ok,`does not contain ${stable(step.value)}`,value);break;}
      case 'ASSERT_SET_EQUAL':{if(!Array.isArray(value)||!Array.isArray(step.value))throw new Error('ASSERT_SET_EQUAL requires arrays.');const a=[...new Set(value.map(stable))].sort(),b=[...new Set(step.value.map(stable))].sort();assertion=assertResult(stable(a)===stable(b),step.value,value);break;}
      default:throw new Error(`Unsupported Test IR operation ${step.op}.`);
    }
    if(assertion){observations.push({step:index,op:step.op,...assertion});if(assertion.determination==='VIOLATED')return {status:'COMPLETE',determination:'VIOLATED',expected:assertion.expected,actual:assertion.actual,observations,executorVersion:VERSION,runtimeVersion:VERSION,specVersion:SPEC_VERSION};}
  }
  const last=[...observations].reverse().find(x=>x.determination);return {status:'COMPLETE',determination:last?.determination||'UNDETERMINED',expected:last?.expected??null,actual:last?.actual??value,observations,executorVersion:VERSION,runtimeVersion:VERSION,specVersion:SPEC_VERSION};
}
function workerQuery(){try{const src=globalThis.document?.currentScript?.src;if(src)return new URL(src).search;}catch{}return '';}
const BUILD_QUERY=workerQuery();
function executeTest(test,artifacts,canonicalBindings={}){
  if(!supports(test))return Promise.resolve({status:'EXECUTION_FAILED',determination:'UNDETERMINED',error:'Unsupported or invalid deterministic Test IR.',runtimeVersion:VERSION,specVersion:SPEC_VERSION});
  const spec=field(test,'EXECUTABLE_SPEC');
  if(typeof Worker!=='function')return execute({spec,artifacts,canonicalBindings});
  return new Promise(resolve=>{const requestId=`TEST-${Date.now()}-${Math.random().toString(36).slice(2)}`,worker=new Worker(`test-worker.js${BUILD_QUERY}`);let settled=false;const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();resolve(result);};const timer=setTimeout(()=>finish({status:'EXECUTION_FAILED',determination:'UNDETERMINED',error:'Worker execution exceeded deterministic runtime limit.',runtimeVersion:VERSION,specVersion:SPEC_VERSION}),LIMITS.maxWorkerDurationMs);worker.onmessage=event=>{if(event.data?.requestId===requestId)finish(event.data.result);};worker.onerror=event=>finish({status:'EXECUTION_FAILED',determination:'UNDETERMINED',error:String(event.message||'Worker execution failed.'),runtimeVersion:VERSION,specVersion:SPEC_VERSION});worker.postMessage({requestId,spec,artifacts,canonicalBindings});});
}
function capabilities(){return Object.freeze({capability:CAPABILITY,specVersion:SPEC_VERSION,operations:OPS,limits:LIMITS});}
globalThis.closedLoopTestRuntime=Object.freeze({VERSION,SPEC_VERSION,CAPABILITY,OPS,LIMITS,validateSpec,validateBindings,supports,execute,executeTest,capabilities});
})();
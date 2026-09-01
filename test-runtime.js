(()=>{
'use strict';

const root=globalThis;
const VERSION='closed-loop-test-runtime/1';
const RUNTIME_BUILD_ID='runtime-20260901-zero-loss-62';
const WORKER_PROTOCOL_VERSION='closed-loop-test-worker-protocol/1';
const TEST_WORKER_SHA256='99f016896e47551b5db1baa69d833cc0de95537c888d0b7edab57ec20cfc6b3d';
const SPEC_VERSION='closed-loop-test-spec/1';
const EXECUTABLE_KIND='TEST_IR';
const CAPABILITY='CLOSED_LOOP_TEST_IR';
const canonicalHash=root.closedLoopHash;
if(!canonicalHash||canonicalHash.canonicalizationVersion!=='closed-loop-canonical-json/1')throw new Error('Closed Loop canonical JSON /1 must load before the Test IR runtime.');

/* Centralized implementation limits. These are support-contract limits, not claims
   about every browser or every possible project. Every boundary is fail-closed. */
const LIMITS=Object.freeze({
  maxTotalInputBytes:32*1024*1024,
  maxTextBytes:16*1024*1024,
  maxDecompressedBytes:64*1024*1024,
  maxSteps:128,
  maxSelectorDepth:32,
  maxParsedDepth:64,
  maxParsedNodes:250000,
  maxCollectionItems:100000,
  maxRegexPatternBytes:2048,
  maxRegexLength:2000,
  maxRegexInputBytes:2*1024*1024,
  maxCsvCells:250000,
  maxXmlNodes:100000,
  maxSpecCanonicalBytes:1024*1024,
  maxCanonicalInputBytes:8*1024*1024,
  maxResultCanonicalBytes:2*1024*1024,
  maxObservationValueBytes:64*1024,
  maxJsonStringBytes:4*1024*1024,
  maxJsonObjectMembers:100000,
  maxNumericDigits:4096,
  workerTimeoutMs:5000,
  maxArchiveExpansionBytes:64*1024*1024
});

const STATUS=Object.freeze({
  SATISFIED:'SATISFIED',
  VIOLATED:'VIOLATED',
  UNDETERMINED:'UNDETERMINED',
  BLOCKED:'BLOCKED',
  EXECUTION_FAILED:'EXECUTION_FAILED'
});

const OP_DEFINITIONS=Object.freeze({
  LOAD_ARTIFACT:{required:['binding'],optional:[],types:{binding:'binding'}},
  READ_BYTES:{required:[],optional:[],types:{}},
  DECODE_UTF8:{required:[],optional:[],types:{}},
  PARSE_JSON:{required:[],optional:[],types:{}},
  PARSE_CSV:{required:['delimiter','header','quote','newline','encoding'],optional:[],types:{delimiter:'delimiter',header:'boolean',quote:'quote',newline:'csvNewline',encoding:'utf8'}},
  PARSE_XML:{required:[],optional:[],types:{}},
  SELECT_JSON_PATH:{required:['path'],optional:[],types:{path:'jsonSelector'}},
  SELECT_XML:{required:['path'],optional:[],types:{path:'xmlSelector'}},
  COUNT:{required:[],optional:[],types:{}},
  SUM:{required:[],optional:[],types:{}},
  MIN:{required:[],optional:[],types:{}},
  MAX:{required:[],optional:[],types:{}},
  SORT:{required:[],optional:['direction','domain'],types:{direction:'sortDirection',domain:'sortDomain'}},
  UNIQUE:{required:[],optional:[],types:{}},
  HASH_SHA256:{required:[],optional:[],types:{}},
  REGEX:{required:['pattern'],optional:['flags'],types:{pattern:'regex',flags:'regexFlags'}},
  COMPARE:{required:['operator'],optional:['value','binding','numericMode','absTol','relTol'],types:{binding:'binding',operator:'compareOperator',numericMode:'numericMode',absTol:'exactNonnegativeDecimal',relTol:'exactNonnegativeDecimal'},oneOf:[['value'],['binding']]},
  ASSERT_EXISTS:{required:[],optional:['message'],types:{message:'string'}},
  ASSERT_TYPE:{required:['value'],optional:['message'],types:{value:'typeName',message:'string'}},
  ASSERT_NE:{required:['value'],optional:['message','numericMode','absTol','relTol'],types:{message:'string',numericMode:'numericMode',absTol:'exactNonnegativeDecimal',relTol:'exactNonnegativeDecimal'}},
  ASSERT_EQ:{required:['value'],optional:['message','numericMode','absTol','relTol'],types:{message:'string',numericMode:'numericMode',absTol:'exactNonnegativeDecimal',relTol:'exactNonnegativeDecimal'}},
  ASSERT_GT:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_GTE:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_LT:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_LTE:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_MATCH:{required:['pattern'],optional:['flags','message'],types:{pattern:'regex',flags:'regexFlags',message:'string'}},
  ASSERT_CONTAINS:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_NOT_CONTAINS:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_SET_EQUAL:{required:['value'],optional:['message'],types:{message:'string',value:'array'}},
  BYTE_COMPARE:{required:['binding'],optional:[],types:{binding:'binding'}}
});
const OPS=Object.freeze(Object.keys(OP_DEFINITIONS));
const ASSERTION_OPS=new Set(['ASSERT_EXISTS','ASSERT_TYPE','ASSERT_NE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL']);
const encoder=new TextEncoder();
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const bytesOf=value=>value instanceof Uint8Array?value:value instanceof ArrayBuffer?new Uint8Array(value):ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):null;
const field=(test,key)=>test?.fields?.[key]??test?.[key];
const scalarCompare=(a,b)=>{const aa=Array.from(String(a),ch=>ch.codePointAt(0)),bb=Array.from(String(b),ch=>ch.codePointAt(0)),n=Math.min(aa.length,bb.length);for(let i=0;i<n;i++)if(aa[i]!==bb[i])return aa[i]-bb[i];return aa.length-bb.length;};
const canonical=value=>canonicalHash.stableStringify(value);
const byteLength=value=>encoder.encode(String(value)).byteLength;

class RuntimeError extends Error{
  constructor(code,message,disposition=STATUS.EXECUTION_FAILED){super(message);this.name='ClosedLoopTestRuntimeError';this.code=code;this.disposition=disposition;}
}
const fail=(code,message,disposition)=>{throw new RuntimeError(code,message,disposition);};

async function sha256(bytes){
  const data=bytesOf(bytes);if(!data)fail('BYTES_REQUIRED','SHA-256 requires byte input.');
  const digest=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
async function sha256Canonical(value){return canonicalHash.sha256Value(value);}

function validateResourceEnvelope(claim={}){
  const issues=[];const allowed=new Set(['totalInputBytes','decompressedBytes','archiveExpansionBytes']);for(const key of Object.keys(claim||{}))if(!allowed.has(key))issues.push('Unknown resource-envelope property '+key+'.');
  const checks=[['totalInputBytes','maxTotalInputBytes'],['decompressedBytes','maxDecompressedBytes'],['archiveExpansionBytes','maxArchiveExpansionBytes']];
  for(const [key,limitKey] of checks){if(!Object.prototype.hasOwnProperty.call(claim,key))continue;const value=claim[key];if(!Number.isSafeInteger(value)||value<0)issues.push(key+' must be a nonnegative safe integer.');else if(value>LIMITS[limitKey])issues.push(key+' exceeds '+limitKey+'.');}
  return {valid:issues.length===0,issues};
}
function validateRegex(pattern,flags=''){
  const issues=[];const text=String(pattern);const flagText=String(flags||'');
  if(byteLength(text)>LIMITS.maxRegexPatternBytes||text.length>LIMITS.maxRegexLength)issues.push('Regex pattern exceeds the registered byte limit.');
  if(!/^[imsu]*$/.test(flagText)||new Set(flagText).size!==flagText.length)issues.push('Regex flags must be a unique subset of i, m, s, and u.');
  if(/\\[1-9]/.test(text)||/\\k</.test(text))issues.push('Regex backreferences are not supported.');
  if(/\(\?/.test(text))issues.push('Regex lookaround, named groups, and inline mode groups are not supported.');
  if(/[()]/.test(text))issues.push('Regex grouping is outside the registered safe subset.');
  if((text.match(/[+*]/g)||[]).length>16)issues.push('Regex contains too many unbounded quantifiers.');
  try{if(!issues.length)new RegExp(text,flagText);}catch(error){issues.push(`Regex is invalid: ${error.message}`);}
  return issues;
}

function parseJsonSelector(path){
  const text=String(path||'');
  if(text==='$')return [];
  if(!text.startsWith('$'))fail('UNSUPPORTED_JSON_SELECTOR','JSON selector must begin with $.');
  const parts=[];let i=1;
  while(i<text.length){
    const ch=text[i];
    if(ch==='.'){i++;const start=i;while(i<text.length&&/[A-Za-z0-9_:-]/.test(text[i]))i++;if(i===start)fail('UNSUPPORTED_JSON_SELECTOR',`Empty JSON selector segment in ${text}.`);parts.push(text.slice(start,i));continue;}
    if(ch==='['){const end=text.indexOf(']',i+1);if(end<0)fail('UNSUPPORTED_JSON_SELECTOR',`Unclosed JSON selector index in ${text}.`);const raw=text.slice(i+1,end);if(!/^(0|[1-9]\d*)$/.test(raw)||raw.length>16)fail('UNSUPPORTED_JSON_SELECTOR',`Only safe nonnegative numeric JSON selector indexes are supported: ${text}.`);const index=Number(raw);if(!Number.isSafeInteger(index))fail('UNSUPPORTED_JSON_SELECTOR',`JSON selector index is outside the safe-integer range: ${text}.`);parts.push(index);i=end+1;continue;}
    fail('UNSUPPORTED_JSON_SELECTOR',`JSON selector requires .name or [index] at character ${i}: ${text}.`);
  }
  if(parts.length>LIMITS.maxSelectorDepth)fail('SELECTOR_LIMIT','JSON selector exceeds the registered depth limit.');
  return parts;
}
function selectJsonPath(value,path){
  const parts=parseJsonSelector(path);let current=value;
  for(const part of parts){
    if(current===null||current===undefined||!hasOwn(Object(current),part))fail('JSON_PATH_MISSING',`JSON selector does not resolve: ${path}.`,STATUS.UNDETERMINED);
    current=current[part];
  }
  return current;
}

function decodeXmlEntity(entity){
  const known={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(hasOwn(known,entity))return known[entity];
  if(/^#\d+$/.test(entity)){const code=Number(entity.slice(1));if(Number.isInteger(code)&&code>=0&&code<=0x10ffff)return String.fromCodePoint(code);}
  if(/^#x[0-9a-f]+$/i.test(entity)){const code=parseInt(entity.slice(2),16);if(Number.isInteger(code)&&code>=0&&code<=0x10ffff)return String.fromCodePoint(code);}
  fail('UNSUPPORTED_XML_ENTITY',`Unsupported XML entity &${entity};.`);
}
const decodeXmlText=text=>String(text).replace(/&([^;]+);/g,(_,entity)=>decodeXmlEntity(entity));
function parseXmlAttributes(source){
  const attributes={};let rest=String(source||'').trim();
  while(rest){
    const match=rest.match(/^([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*("[^"]*"|'[^']*')\s*/);if(!match)fail('MALFORMED_XML',`Malformed XML attribute text: ${rest.slice(0,80)}.`);
    if(hasOwn(attributes,match[1]))fail('MALFORMED_XML',`Duplicate XML attribute ${match[1]}.`);
    attributes[match[1]]=decodeXmlText(match[2].slice(1,-1));rest=rest.slice(match[0].length);
  }
  return attributes;
}
function parseXml(text){
  let source=String(text||'');
  if(/<!DOCTYPE|<!ENTITY/i.test(source))fail('UNSAFE_XML','DTD and entity declarations are prohibited.');
  source=source.replace(/^\uFEFF?\s*<\?xml\s[^?]*\?>\s*/i,'');
  const documentNode={name:'#document',attributes:{},children:[],textParts:[]};const stack=[documentNode];let nodes=0;let index=0;
  const appendText=value=>{if(value)stack.at(-1).textParts.push(decodeXmlText(value));};
  while(index<source.length){
    const open=source.indexOf('<',index);if(open<0){appendText(source.slice(index));break;}appendText(source.slice(index,open));
    if(source.startsWith('<!--',open)){const end=source.indexOf('-->',open+4);if(end<0)fail('MALFORMED_XML','Unterminated XML comment.');index=end+3;continue;}
    if(source.startsWith('<![CDATA[',open)){const end=source.indexOf(']]>',open+9);if(end<0)fail('MALFORMED_XML','Unterminated XML CDATA section.');stack.at(-1).textParts.push(source.slice(open+9,end));index=end+3;continue;}
    if(source.startsWith('<?',open))fail('UNSAFE_XML','XML processing instructions are not supported.');
    const close=source.indexOf('>',open+1);if(close<0)fail('MALFORMED_XML','Unterminated XML tag.');
    let body=source.slice(open+1,close).trim();
    if(body.startsWith('!'))fail('UNSAFE_XML','Unsupported XML declaration.');
    if(body.startsWith('/')){
      const name=body.slice(1).trim();if(stack.length===1||stack.at(-1).name!==name)fail('MALFORMED_XML',`Unexpected XML closing tag ${name}.`);stack.pop();index=close+1;continue;
    }
    const selfClosing=/\/$/.test(body);if(selfClosing)body=body.slice(0,-1).trim();
    const nameMatch=body.match(/^([A-Za-z_][A-Za-z0-9_.:-]*)/);if(!nameMatch)fail('MALFORMED_XML','XML element name is invalid.');
    const node={name:nameMatch[1],attributes:parseXmlAttributes(body.slice(nameMatch[0].length)),children:[],textParts:[]};
    stack.at(-1).children.push(node);nodes++;if(nodes>LIMITS.maxXmlNodes)fail('XML_NODE_LIMIT','XML exceeds the registered node limit.');
    if(!selfClosing)stack.push(node);index=close+1;
  }
  if(stack.length!==1)fail('MALFORMED_XML',`Unclosed XML element ${stack.at(-1).name}.`);
  if(documentNode.children.length!==1)fail('MALFORMED_XML','XML must contain exactly one document element.');
  return documentNode.children[0];
}
function parseXmlSelector(path){
  const text=String(path||'');if(!text.startsWith('/')||text.startsWith('//'))fail('UNSUPPORTED_XML_SELECTOR','XML selector must be an absolute child path beginning with one /.');
  const raw=text.slice(1).split('/');if(!raw.length||raw.some(part=>!part))fail('UNSUPPORTED_XML_SELECTOR','XML selector contains an empty segment.');
  if(raw.length>LIMITS.maxSelectorDepth)fail('SELECTOR_LIMIT','XML selector exceeds the registered depth limit.');
  return raw.map((part,index)=>{
    if(part==='text()'){if(index!==raw.length-1)fail('UNSUPPORTED_XML_SELECTOR','text() is supported only as the final XML selector segment.');return {kind:'text'};}
    if(part.startsWith('@')){if(index!==raw.length-1||!/^@[A-Za-z_][A-Za-z0-9_.:-]*$/.test(part))fail('UNSUPPORTED_XML_SELECTOR','XML attributes are supported only as a valid final @name segment.');return {kind:'attribute',name:part.slice(1)};}
    const match=part.match(/^([A-Za-z_][A-Za-z0-9_.:-]*)(?:\[(\d+)\])?$/);if(!match||match[2]==='0'||(match[2]&&(!Number.isSafeInteger(Number(match[2]))||match[2].length>16)))fail('UNSUPPORTED_XML_SELECTOR',`Unsupported XML selector segment ${part}.`);return {kind:'element',name:match[1],index:match[2]?Number(match[2]):null};
  });
}
function xmlText(node){return [...node.textParts,...node.children.map(xmlText)].join('');}
function selectXml(rootNode,path){
  const parts=parseXmlSelector(path);const first=parts.shift();if(first.kind!=='element'||first.name!==rootNode.name||(first.index&&first.index!==1))fail('XML_PATH_MISSING',`XML selector does not address document element ${rootNode.name}.`,STATUS.UNDETERMINED);
  let current=[rootNode];
  for(const part of parts){
    if(part.kind==='text')return current.map(xmlText);
    if(part.kind==='attribute')return current.map(node=>node.attributes[part.name]).filter(value=>value!==undefined);
    const next=[];for(const node of current){const matches=node.children.filter(child=>child.name===part.name);if(part.index){if(matches[part.index-1])next.push(matches[part.index-1]);}else next.push(...matches);}current=next;
  }
  if(!current.length)fail('XML_PATH_MISSING',`XML selector does not resolve: ${path}.`,STATUS.UNDETERMINED);
  return current;
}


function validateJsonSourceExact(text){
  const source=String(text),length=source.length;let i=0,nodes=0;
  const ws=()=>{while(i<length&&/[\x20\x09\x0a\x0d]/.test(source[i]))i++;};
  const error=message=>fail('MALFORMED_JSON',`JSON parse failed: ${message} at character ${i}.`,STATUS.UNDETERMINED);
  const stringToken=()=>{if(source[i]!=='"')error('Expected string');const start=i++;let escaped=false;for(;i<length;i++){const ch=source[i];if(escaped){if(ch==='u'){if(!/^[0-9a-fA-F]{4}$/.test(source.slice(i+1,i+5)))error('Invalid Unicode escape');i+=4;}else if(!'"\\/bfnrt'.includes(ch))error('Invalid string escape');escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(ch==='"'){i++;let value;try{value=JSON.parse(source.slice(start,i));}catch{error('Invalid JSON string');}try{canonicalHash.stableStringify(value);}catch(cause){fail('INVALID_JSON_UNICODE',cause.message,STATUS.UNDETERMINED);}if(byteLength(value)>LIMITS.maxJsonStringBytes)fail('JSON_STRING_LIMIT','JSON string exceeds the registered byte limit.');return value;}if(ch.charCodeAt(0)<0x20)error('Unescaped control character');}error('Unterminated string');};
  const numberToken=()=>{const match=source.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);if(!match)error('Invalid number');const raw=match[0];i+=raw.length;if(raw.replace(/[^0-9]/g,'').length>LIMITS.maxNumericDigits)fail('NUMERIC_DIGIT_LIMIT','JSON numeric token exceeds the registered digit limit.',STATUS.UNDETERMINED);if(raw.includes('.')||/[eE]/.test(raw))fail('UNSUPPORTED_JSON_NUMBER',`PARSE_JSON numeric token ${raw} is not a safe-integer JSON number. Use a typed exact number representation.`,STATUS.UNDETERMINED);const n=Number(raw);if(!Number.isSafeInteger(n)||Object.is(n,-0))fail('UNSUPPORTED_JSON_NUMBER',`PARSE_JSON numeric token ${raw} is outside the finite safe-integer domain.`,STATUS.UNDETERMINED);};
  let parseValue,parseObject,parseArray;
  parseObject=depth=>{if(depth>LIMITS.maxParsedDepth)fail('PARSED_DEPTH_LIMIT','JSON exceeds the registered depth limit.');i++;ws();const keys=new Set();let members=0;if(source[i]==='}'){i++;return;}while(i<length){ws();const key=stringToken();if(keys.has(key))fail('DUPLICATE_JSON_MEMBER',`PARSE_JSON rejects duplicate object member ${key}.`,STATUS.UNDETERMINED);keys.add(key);members++;if(members>LIMITS.maxJsonObjectMembers)fail('JSON_MEMBER_LIMIT','JSON object exceeds the registered member limit.');ws();if(source[i++]!==':')error('Expected colon');parseValue(depth+1);ws();if(source[i]==='}'){i++;return;}if(source[i++]!==',')error('Expected comma');}error('Unterminated object');};
  parseArray=depth=>{if(depth>LIMITS.maxParsedDepth)fail('PARSED_DEPTH_LIMIT','JSON exceeds the registered depth limit.');i++;ws();let items=0;if(source[i]===']'){i++;return;}while(i<length){parseValue(depth+1);items++;if(items>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT','JSON array exceeds the registered collection limit.');ws();if(source[i]===']'){i++;return;}if(source[i++]!==',')error('Expected comma');}error('Unterminated array');};
  parseValue=depth=>{if(depth>LIMITS.maxParsedDepth)fail('PARSED_DEPTH_LIMIT','JSON exceeds the registered depth limit.');nodes++;if(nodes>LIMITS.maxParsedNodes)fail('PARSED_NODE_LIMIT','JSON exceeds the registered node limit.');ws();const ch=source[i];if(ch==='"'){stringToken();return;}if(ch==='{'){parseObject(depth);return;}if(ch==='['){parseArray(depth);return;}if(source.startsWith('true',i)){i+=4;return;}if(source.startsWith('false',i)){i+=5;return;}if(source.startsWith('null',i)){i+=4;return;}if(ch==='-'||/\d/.test(ch||'')){numberToken();return;}error('Unexpected token');};
  ws();parseValue(1);ws();if(i!==length)error('Trailing content');return true;
}
function exactDecimalParts(value){
  if(value&&typeof value==='object'&&!Array.isArray(value)){
    if(value.numberType!=='DECIMAL'||Object.keys(value).length!==2||!hasOwn(value,'value'))fail('UNSUPPORTED_NUMERIC_PRECISION','Typed decimal must contain exactly numberType DECIMAL and value.',STATUS.UNDETERMINED);
    value=value.value;
  }
  const text=String(value);if(!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)||text==='-0'||/^-0(?:\.0+)?$/.test(text))fail('UNSUPPORTED_NUMERIC_PRECISION','Exact decimal value must be canonical plain decimal text with no exponent or negative zero.',STATUS.UNDETERMINED);
  if(text.replace(/[^0-9]/g,'').length>LIMITS.maxNumericDigits)fail('NUMERIC_DIGIT_LIMIT','Exact decimal exceeds the registered digit limit.',STATUS.UNDETERMINED);
  const neg=text[0]==='-',body=neg?text.slice(1):text,[whole,fraction='']=body.split('.'),scale=fraction.length,digits=BigInt((whole+fraction)||'0');return{sign:neg?-1n:1n,digits,scale};
}
function exactIntegerBigInt(value){
  if(isSafeIntegerValue(value))return BigInt(value);
  if(!value||typeof value!=='object'||Array.isArray(value)||value.numberType!=='INTEGER'||Object.keys(value).length!==2||!hasOwn(value,'value'))fail('UNSUPPORTED_NUMERIC_PRECISION','Exact integer must be a safe integer or typed INTEGER value.',STATUS.UNDETERMINED);
  const text=String(value.value);if(!/^-?(?:0|[1-9]\d*)$/.test(text)||text==='-0')fail('UNSUPPORTED_NUMERIC_PRECISION','Typed INTEGER value must be canonical base-10 text without negative zero.',STATUS.UNDETERMINED);if(text.replace('-','').length>LIMITS.maxNumericDigits)fail('NUMERIC_DIGIT_LIMIT','Exact integer exceeds the registered digit limit.',STATUS.UNDETERMINED);return BigInt(text);
}
function integerOutput(value,typed){return !typed&&value>=BigInt(Number.MIN_SAFE_INTEGER)&&value<=BigInt(Number.MAX_SAFE_INTEGER)?Number(value):{numberType:'INTEGER',value:value.toString()};}
function decimalAlign(a,b){const scale=Math.max(a.scale,b.scale),pow=n=>10n**BigInt(n);return{a:a.sign*a.digits*pow(scale-a.scale),b:b.sign*b.digits*pow(scale-b.scale),scale};}
function decimalAbsDiff(a,b){const x=decimalAlign(exactDecimalParts(a),exactDecimalParts(b));return{digits:x.a>=x.b?x.a-x.b:x.b-x.a,scale:x.scale};}
function decimalAbs(value){const p=exactDecimalParts(value);return{digits:p.digits,scale:p.scale};}
function decimalMaxAbs(a,b){const aa=decimalAbs(a),bb=decimalAbs(b),x=decimalAlign({...aa,sign:1n},{...bb,sign:1n});return x.a>=x.b?{digits:x.a,scale:x.scale}:{digits:x.b,scale:x.scale};}
function decimalMultiply(a,b){const aa=exactDecimalParts(a),bb=b&&b.digits!==undefined?b:decimalAbs(b);return{digits:aa.digits*bb.digits,scale:aa.scale+bb.scale};}
function decimalLTE(left,right){const x=decimalAlign({sign:1n,digits:left.digits,scale:left.scale},{sign:1n,digits:right.digits,scale:right.scale});return x.a<=x.b;}
function exactApproximate(actual,expected,step){const absTol=step.absTol??'0',relTol=step.relTol??'0',diff=decimalAbsDiff(actual,expected),abs=decimalAbs(absTol),relProduct=decimalMultiply(relTol,decimalMaxAbs(actual,expected)),maxTol=decimalLTE(abs,relProduct)?relProduct:abs;return decimalLTE(diff,maxTol);}
function sortDomain(values,declared){if(!values.length)return declared||'STRING';const inferred=typeof values[0]==='string'?'STRING':typeof values[0]==='boolean'?'BOOLEAN':Number.isSafeInteger(values[0])||values[0]?.numberType==='INTEGER'?'INTEGER':values[0]?.numberType==='DECIMAL'?'DECIMAL':null,domain=declared||inferred;if(!domain)fail('SORT_DOMAIN','SORT requires an explicit supported homogeneous domain.',STATUS.UNDETERMINED);const ok=v=>domain==='STRING'?typeof v==='string':domain==='BOOLEAN'?typeof v==='boolean':domain==='INTEGER'?(Number.isSafeInteger(v)||v?.numberType==='INTEGER'):domain==='DECIMAL'&&v?.numberType==='DECIMAL';if(!values.every(ok))fail('SORT_DOMAIN','SORT input is not homogeneous in the declared domain.',STATUS.UNDETERMINED);return domain;}
function compareSortValues(a,b,domain){if(domain==='STRING')return scalarCompare(a,b);if(domain==='BOOLEAN')return a===b?0:a?1:-1;if(domain==='INTEGER'){const aa=exactIntegerBigInt(a),bb=exactIntegerBigInt(b);return aa===bb?0:aa<bb?-1:1;}if(domain==='DECIMAL')return compareDecimal(a,b);return 0;}

function inspectStructure(value){
  let nodes=0,maxDepth=0;const seen=new Set();const stack=[{value,depth:1}];
  while(stack.length){const item=stack.pop();nodes++;maxDepth=Math.max(maxDepth,item.depth);if(nodes>LIMITS.maxParsedNodes)fail('PARSED_NODE_LIMIT','Parsed structure exceeds the registered node limit.');if(maxDepth>LIMITS.maxParsedDepth)fail('PARSED_DEPTH_LIMIT','Parsed structure exceeds the registered depth limit.');const current=item.value;if(!current||typeof current!=='object'||seen.has(current))continue;seen.add(current);if(Array.isArray(current)){if(current.length>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT','Parsed array exceeds the registered collection limit.');for(const child of current)stack.push({value:child,depth:item.depth+1});}else for(const child of Object.values(current))stack.push({value:child,depth:item.depth+1});}
  return {nodes,maxDepth};
}

function parseCsv(text,configuration){
  const {delimiter,header,quote,newline,encoding}=configuration;if(encoding!=='UTF-8')fail('UNSUPPORTED_ENCODING','Version 1 CSV supports UTF-8 only.');
  const rows=[];let row=[],cell='',quoted=false,cells=0,index=0;const source=String(text);
  const newlineAt=position=>{if(newline==='LF')return source[position]==='\n'?1:0;if(newline==='CR')return source[position]==='\r'?1:0;if(newline==='CRLF')return source.startsWith('\r\n',position)?2:0;if(source.startsWith('\r\n',position))return 2;if(source[position]==='\n'||source[position]==='\r')return 1;return 0;};
  const pushCell=()=>{row.push(cell);cell='';cells++;if(cells>LIMITS.maxCsvCells)fail('CSV_CELL_LIMIT','CSV exceeds the registered cell limit.');};
  while(index<source.length){const ch=source[index];if(quoted){if(ch===quote&&source[index+1]===quote){cell+=quote;index+=2;continue;}if(ch===quote){quoted=false;index++;continue;}cell+=ch;index++;continue;}if(ch===quote){if(cell.length)fail('MALFORMED_CSV','CSV quote begins inside an unquoted field.');quoted=true;index++;continue;}if(ch===delimiter){pushCell();index++;continue;}const width=newlineAt(index);if(width){pushCell();rows.push(row);row=[];index+=width;continue;}cell+=ch;index++;}
  if(quoted)fail('MALFORMED_CSV','CSV has an unterminated quoted field.');if(cell.length||row.length){pushCell();rows.push(row);}if(rows.length>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT','CSV exceeds the registered row limit.');
  if(!header)return rows;if(!rows.length)return [];const names=rows.shift();if(new Set(names).size!==names.length)fail('MALFORMED_CSV','CSV header names must be unique.');return rows.map((values,rowIndex)=>{if(values.length!==names.length)fail('MALFORMED_CSV',`CSV row ${rowIndex+2} has ${values.length} cells; expected ${names.length}.`);return Object.fromEntries(names.map((name,column)=>[name,values[column]]));});
}

function compareDecimal(left,right){
  const aligned=decimalAlign(exactDecimalParts(left),exactDecimalParts(right));return aligned.a===aligned.b?0:aligned.a<aligned.b?-1:1;
}
function isSafeIntegerValue(value){return typeof value==='number'&&Number.isSafeInteger(value);}
function exactEqual(actual,expected,step){
  const mode=step.numericMode;
  if(mode==='INTEGER')return exactIntegerBigInt(actual)===exactIntegerBigInt(expected);
  if(mode==='DECIMAL_STRING')return compareDecimal(actual,expected)===0;
  if(mode==='APPROXIMATE')return exactApproximate(actual,expected,step);
  if(actual?.numberType==='INTEGER'||expected?.numberType==='INTEGER')return exactIntegerBigInt(actual)===exactIntegerBigInt(expected);
  if(actual?.numberType==='DECIMAL'||expected?.numberType==='DECIMAL')return compareDecimal(actual,expected)===0;
  if(typeof actual==='number'||typeof expected==='number'){
    if(!isSafeIntegerValue(actual)||!isSafeIntegerValue(expected))fail('UNSUPPORTED_NUMERIC_PRECISION','Exact numeric equality is supported only for safe integers unless DECIMAL_STRING or APPROXIMATE semantics are explicit.',STATUS.UNDETERMINED);
    return actual===expected;
  }
  return canonical(actual)===canonical(expected);
}
function orderedCompare(actual,expected){
  if(isSafeIntegerValue(actual)||actual?.numberType==='INTEGER'||isSafeIntegerValue(expected)||expected?.numberType==='INTEGER'){const a=exactIntegerBigInt(actual),b=exactIntegerBigInt(expected);return a===b?0:a<b?-1:1;}
  try{return compareDecimal(actual,expected);}catch{fail('UNSUPPORTED_NUMERIC_PRECISION','Ordered numeric comparison supports exact integers or exact decimal values only.',STATUS.UNDETERMINED);}
}
function validateType(value,type){
  switch(type){
    case 'string':return typeof value==='string';case 'boolean':return typeof value==='boolean';case 'array':return Array.isArray(value);
    case 'binding':return typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(value);
    case 'delimiter':return typeof value==='string'&&[...value].length===1&&!['\r','\n'].includes(value);
    case 'quote':return typeof value==='string'&&[...value].length===1&&!['\r','\n'].includes(value);
    case 'csvNewline':return ['AUTO','LF','CRLF','CR'].includes(value);
    case 'utf8':return value==='UTF-8';case 'sortDirection':return ['ASC','DESC'].includes(value);case 'sortDomain':return ['STRING','BOOLEAN','INTEGER','DECIMAL'].includes(value);
    case 'regex':return typeof value==='string';case 'regexFlags':return typeof value==='string';
    case 'jsonSelector':try{parseJsonSelector(value);return true;}catch{return false;}
    case 'xmlSelector':try{parseXmlSelector(value);return true;}catch{return false;}
    case 'compareOperator':return ['EQ','NE','GT','GTE','LT','LTE'].includes(value);
    case 'typeName':return ['string','number','boolean','object','array','null','undefined','bytes'].includes(value);
    case 'numericMode':return ['INTEGER','DECIMAL_STRING','APPROXIMATE'].includes(value);
    case 'exactNonnegativeDecimal':try{const p=exactDecimalParts(value);return p.sign>0n||p.digits===0n;}catch{return false;}case 'nonnegativeNumber':return typeof value==='number'&&Number.isFinite(value)&&value>=0;
    default:return true;
  }
}
function validateStep(step,index){
  const issues=[];if(!step||typeof step!=='object'||Array.isArray(step))return [`Step ${index} must be an object.`];const definition=OP_DEFINITIONS[step.op];if(!definition)return [`Step ${index} uses unknown operation ${String(step.op)}.`];
  const allowed=new Set(['op',...definition.required,...definition.optional]);for(const key of Object.keys(step))if(!allowed.has(key))issues.push(`Step ${index} operation ${step.op} contains unknown property ${key}.`);
  for(const key of definition.required)if(!hasOwn(step,key))issues.push(`Step ${index} operation ${step.op} is missing required property ${key}.`);
  for(const [key,type] of Object.entries(definition.types||{}))if(hasOwn(step,key)&&!validateType(step[key],type))issues.push(`Step ${index} operation ${step.op} has invalid ${key}.`);
  for(const alternatives of definition.oneOf||[]){/* evaluated together below */}
  if(definition.oneOf){const present=definition.oneOf.filter(group=>group.every(key=>hasOwn(step,key)));if(present.length!==1)issues.push(`Step ${index} operation ${step.op} requires exactly one of ${definition.oneOf.map(group=>group.join('+')).join(' or ')}.`);}
  if((step.op==='REGEX'||step.op==='ASSERT_MATCH')&&typeof step.pattern==='string')issues.push(...validateRegex(step.pattern,step.flags).map(message=>`Step ${index}: ${message}`));
  if(['COMPARE','ASSERT_EQ','ASSERT_NE'].includes(step.op)&&step.numericMode==='APPROXIMATE'&&!['absTol','relTol'].some(key=>hasOwn(step,key)))issues.push(`Step ${index} approximate comparison tolerance requires absTol, relTol, or both.`);
  if(['COMPARE','ASSERT_EQ','ASSERT_NE'].includes(step.op)&&hasOwn(step,'value')){
    if(typeof step.value==='number'&&(!Number.isSafeInteger(step.value)||Object.is(step.value,-0)))issues.push(`Step ${index} numeric literals must be finite safe integers; use a typed exact number representation.`);
    if(step.value&&typeof step.value==='object'&&!Array.isArray(step.value)&&hasOwn(step.value,'numberType')){try{if(step.value.numberType==='INTEGER')exactIntegerBigInt(step.value);else if(step.value.numberType==='DECIMAL')exactDecimalParts(step.value);else throw new Error('Unknown typed number.');}catch(error){issues.push(`Step ${index} has invalid typed number: ${error.message}`);}}
    if(step.numericMode==='INTEGER')try{exactIntegerBigInt(step.value);}catch(error){issues.push(`Step ${index} INTEGER comparison has invalid expected value: ${error.message}`);}
    if(['DECIMAL_STRING','APPROXIMATE'].includes(step.numericMode))try{exactDecimalParts(step.value);}catch(error){issues.push(`Step ${index} ${step.numericMode} comparison has invalid expected value: ${error.message}`);}
  }
  if(step.op==='PARSE_CSV'&&step.delimiter===step.quote)issues.push(`Step ${index} CSV delimiter and quote must differ.`);
  return issues;
}
function validatePipeline(spec,bindings){
  const issues=[],steps=Array.isArray(spec?.steps)?spec.steps:[];
  if(!steps.length)return issues;
  if(steps[0]?.op!=='LOAD_ARTIFACT')issues.push('Test IR pipeline must begin with LOAD_ARTIFACT so every assertion is bound to an explicit input.');
  if(steps.slice(1).some(step=>step?.op==='LOAD_ARTIFACT'))issues.push('LOAD_ARTIFACT is supported only as the first pipeline step; additional inputs use registered binding arguments.');
  const assertions=steps.map((step,index)=>ASSERTION_OPS.has(step?.op)?index:-1).filter(index=>index>=0);
  if(assertions.length!==1||assertions[0]!==steps.length-1)issues.push('Test IR requires exactly one terminal assertion operation.');
  const bindingKind=name=>{const binding=bindings?.[name];if(typeof binding==='string')return 'ARTIFACT';return binding?.kind||'ARTIFACT';};
  const accepts=(state,allowed)=>state==='UNKNOWN'||allowed.includes(state);
  let state='UNSET';
  const rules={READ_BYTES:[['ARTIFACT'],'BYTES'],DECODE_UTF8:[['BYTES'],'STRING'],PARSE_JSON:[['STRING'],'UNKNOWN'],PARSE_CSV:[['STRING'],'ARRAY'],PARSE_XML:[['STRING'],'XML'],SELECT_JSON_PATH:[['JSON','UNKNOWN'],'UNKNOWN'],SELECT_XML:[['XML'],'ARRAY'],COUNT:[['ARRAY','STRING','BYTES','UNKNOWN'],'INTEGER'],SUM:[['ARRAY','UNKNOWN'],'INTEGER'],MIN:[['ARRAY','UNKNOWN'],'INTEGER'],MAX:[['ARRAY','UNKNOWN'],'INTEGER'],SORT:[['ARRAY','UNKNOWN'],'ARRAY'],UNIQUE:[['ARRAY','UNKNOWN'],'ARRAY'],HASH_SHA256:[['BYTES'],'STRING'],REGEX:[['STRING'],'BOOLEAN'],COMPARE:[['UNKNOWN','ARRAY','STRING','BYTES','JSON','XML','INTEGER','BOOLEAN'],'BOOLEAN'],BYTE_COMPARE:[['BYTES'],'BOOLEAN'],ASSERT_EXISTS:[['UNKNOWN','ARRAY','STRING','BYTES','JSON','XML','INTEGER','BOOLEAN'],'ASSERTION'],ASSERT_TYPE:[['UNKNOWN','ARRAY','STRING','BYTES','JSON','XML','INTEGER','BOOLEAN'],'ASSERTION'],ASSERT_NE:[['UNKNOWN','ARRAY','STRING','BYTES','JSON','XML','INTEGER','BOOLEAN'],'ASSERTION'],ASSERT_EQ:[['UNKNOWN','ARRAY','STRING','BYTES','JSON','XML','INTEGER','BOOLEAN'],'ASSERTION'],ASSERT_GT:[['UNKNOWN','INTEGER','STRING'],'ASSERTION'],ASSERT_GTE:[['UNKNOWN','INTEGER','STRING'],'ASSERTION'],ASSERT_LT:[['UNKNOWN','INTEGER','STRING'],'ASSERTION'],ASSERT_LTE:[['UNKNOWN','INTEGER','STRING'],'ASSERTION'],ASSERT_MATCH:[['STRING'],'ASSERTION'],ASSERT_CONTAINS:[['ARRAY','STRING'],'ASSERTION'],ASSERT_NOT_CONTAINS:[['ARRAY','STRING'],'ASSERTION'],ASSERT_SET_EQUAL:[['ARRAY'],'ASSERTION']};
  for(const [index,step] of steps.entries()){
    if(!step||!OP_DEFINITIONS[step.op])continue;
    if(step.op==='LOAD_ARTIFACT'){state=bindingKind(step.binding)==='CANONICAL_VALUE'?'UNKNOWN':'ARTIFACT';continue;}
    const rule=rules[step.op];if(!rule)continue;if(!accepts(state,rule[0]))issues.push(`Step ${index} operation ${step.op} cannot consume pipeline type ${state}.`);state=rule[1];
  }
  return issues;
}
function validateSpec(spec,bindings){
  const issues=[];
  if(!spec||typeof spec!=='object'||Array.isArray(spec))return {valid:false,issues:['Test IR must be an object.']};
  for(const key of Object.keys(spec))if(!['version','steps'].includes(key))issues.push(`Test IR contains unknown root property ${key}.`);
  if(spec.version!==SPEC_VERSION)issues.push(`Unsupported Test IR version ${String(spec.version)}.`);
  if(!Array.isArray(spec.steps)||!spec.steps.length)issues.push('Test IR requires a nonempty steps array.');
  if((spec.steps?.length||0)>LIMITS.maxSteps)issues.push(`Test IR exceeds the ${LIMITS.maxSteps}-step limit.`);
  for(const [index,step] of (spec.steps||[]).entries())issues.push(...validateStep(step,index));
  if(Array.isArray(spec.steps)&&spec.steps.length&&!spec.steps.some(step=>ASSERTION_OPS.has(step?.op)))issues.push('Test IR must contain at least one registered assertion operation.');
  if(bindings!==undefined){const bindingResult=validateBindings(bindings);issues.push(...bindingResult.issues);const declared=new Set(Object.keys(bindings||{}));for(const [index,step] of (spec.steps||[]).entries())if(step&&typeof step.binding==='string'&&!declared.has(step.binding))issues.push(`Step ${index} references undeclared binding ${step.binding}.`);}
  issues.push(...validatePipeline(spec,bindings));
  try{const bytes=encoder.encode(canonical(spec)).byteLength;if(bytes>LIMITS.maxSpecCanonicalBytes)issues.push(`Test IR exceeds the ${LIMITS.maxSpecCanonicalBytes}-byte canonical specification limit.`);}catch(error){issues.push(`Test IR is not valid closed-loop-canonical-json/1: ${error.message}`);}
  return {valid:issues.length===0,issues};
}
function validateBindings(bindings){
  const issues=[];if(!bindings||typeof bindings!=='object'||Array.isArray(bindings))return {valid:false,issues:['EXECUTABLE_INPUT_BINDINGS must be a closed object.']};
  for(const [name,binding] of Object.entries(bindings)){
    if(!/^[A-Z][A-Z0-9_]{0,63}$/.test(name))issues.push(`Invalid Test IR binding name ${name}.`);
    if(typeof binding==='string'){if(!binding.trim())issues.push(`Binding ${name} cannot be empty.`);continue;}
    if(!binding||typeof binding!=='object'||Array.isArray(binding)){issues.push(`Binding ${name} must be an artifact ID string or a closed binding object.`);continue;}
    const kind=binding.kind||'ARTIFACT';if(!['ARTIFACT','CANONICAL_VALUE'].includes(kind))issues.push(`Binding ${name} has unsupported kind ${kind}.`);
    const allowed=new Set(kind==='CANONICAL_VALUE'?['kind','canonicalKey','valueSha256']:['kind','artifactId','source','artifactRole','filename','expectedSha256']);for(const key of Object.keys(binding))if(!allowed.has(key))issues.push(`Binding ${name} contains property ${key} outside the closed ${kind} binding contract.`);
    if(kind==='ARTIFACT'){
      if(![binding.artifactId,binding.artifactRole,binding.filename].some(value=>typeof value==='string'&&value.trim()))issues.push(`Binding ${name} does not identify an artifact.`);
      if(binding.source&&!['CURRENT_PRODUCT','CURRENT_SCOPE','EXPLICIT_ARTIFACT'].includes(binding.source))issues.push(`Binding ${name} has unsupported source ${binding.source}.`);
      if(binding.expectedSha256!==undefined&&!/^[0-9a-f]{64}$/.test(String(binding.expectedSha256)))issues.push(`Binding ${name} expectedSha256 is invalid.`);
    }else{
      if(typeof binding.canonicalKey!=='string'||!binding.canonicalKey.trim())issues.push(`Binding ${name} does not identify an immutable canonical value.`);
      if(!/^[0-9a-f]{64}$/.test(String(binding.valueSha256||'')))issues.push(`Binding ${name} requires a valid valueSha256.`);
    }
  }
  return {valid:issues.length===0,issues};
}
function normalizeSpec(spec,bindings){
  const check=validateSpec(spec,bindings);if(!check.valid)fail('INVALID_TEST_IR',check.issues.join(' '));
  return {version:SPEC_VERSION,steps:spec.steps.map(step=>Object.fromEntries(Object.entries(step).sort(([a],[b])=>a==='op'?-1:b==='op'?1:scalarCompare(a,b))))};
}
function supports(test){
  if(String(field(test,'EXECUTION_MODE')||'').toUpperCase()!=='APPLICATION_DETERMINISTIC')return false;
  if(String(field(test,'REQUIRED_CAPABILITY')||'').toUpperCase()!==CAPABILITY)return false;
  if(String(field(test,'EXECUTABLE_KIND')||'').toUpperCase()!==EXECUTABLE_KIND)return false;
  if(field(test,'EXECUTABLE_SPEC_VERSION')!==SPEC_VERSION)return false;
  return validateSpec(field(test,'EXECUTABLE_SPEC'),field(test,'EXECUTABLE_INPUT_BINDINGS')).valid;
}
function resolveBinding(name,artifacts,canonicalBindings){
  if(hasOwn(artifacts||{},name))return {kind:'ARTIFACT',value:artifacts[name]};
  if(hasOwn(canonicalBindings||{},name))return {kind:'CANONICAL_VALUE',value:canonicalBindings[name]};
  fail('MISSING_BINDING',`Required binding ${name} is unavailable.`,STATUS.BLOCKED);
}
function valueFromBinding(name,artifacts,canonicalBindings){const resolved=resolveBinding(name,artifacts,canonicalBindings);return resolved.kind==='ARTIFACT'?(resolved.value?.value??resolved.value):resolved.value?.value??resolved.value;}
function collection(value,op){if(!Array.isArray(value))fail('COLLECTION_REQUIRED',`${op} requires an array.`);if(value.length>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT',`${op} input exceeds the registered collection limit.`);return value;}
function resultForAssertion(ok,expected,actual,message){return {determination:ok?STATUS.SATISFIED:STATUS.VIOLATED,expected,actual,message:message||null};}

async function verifyBoundInputs(bindings,artifacts,canonicalBindings){
  const check=validateBindings(bindings);if(!check.valid)fail('INVALID_BINDINGS',check.issues.join(' '));
  const declaredNames=Object.keys(bindings).sort(scalarCompare),declared=new Set(declaredNames),inputBindings=[];let totalInputBytes=0,canonicalInputBytes=0;
  for(const name of Object.keys(artifacts||{}))if(!declared.has(name))fail('UNDECLARED_INPUT_BINDING',`Artifact payload contains undeclared binding ${name}.`);
  for(const name of Object.keys(canonicalBindings||{}))if(!declared.has(name))fail('UNDECLARED_INPUT_BINDING',`Canonical payload contains undeclared binding ${name}.`);
  for(const name of declaredNames){
    const raw=bindings[name],descriptor=typeof raw==='string'?{kind:'ARTIFACT',artifactId:raw}:{...raw,kind:raw.kind||'ARTIFACT'};
    if(descriptor.kind==='ARTIFACT'){
      if(hasOwn(canonicalBindings||{},name))fail('BINDING_KIND_MISMATCH',`Binding ${name} requires artifact bytes, not a canonical value.`,STATUS.BLOCKED);
      if(!hasOwn(artifacts||{},name))fail('MISSING_BINDING',`Required artifact binding ${name} is unavailable.`,STATUS.BLOCKED);
      const artifact=artifacts[name],bytes=bytesOf(artifact?.bytes??artifact);if(!bytes)fail('MISSING_ARTIFACT_BYTES',`Required artifact binding ${name} has no byte-backed value.`,STATUS.BLOCKED);
      const artifactId=String(artifact?.artifactId||'');if(!artifactId)fail('MISSING_ARTIFACT_IDENTITY',`Required artifact binding ${name} has no canonical artifact identity.`,STATUS.BLOCKED);
      if(descriptor.artifactId&&artifactId!==String(descriptor.artifactId))fail('BINDING_IDENTITY_MISMATCH',`Artifact binding ${name} resolved to ${artifactId}, not ${descriptor.artifactId}.`,STATUS.BLOCKED);
      const filename=String(artifact?.filename||'');if(descriptor.filename&&filename!==String(descriptor.filename))fail('BINDING_FILENAME_MISMATCH',`Artifact binding ${name} filename does not match its declared binding.`,STATUS.BLOCKED);
      if(artifact?.byteSize!==undefined&&Number(artifact.byteSize)!==bytes.byteLength)fail('ARTIFACT_SIZE_MISMATCH',`Artifact ${artifactId} bytes do not match its declared byte size.`,STATUS.BLOCKED);
      const calculated=await sha256(bytes),claimed=String(artifact?.sha256||'').toLowerCase(),expected=String(descriptor.expectedSha256||'').toLowerCase();
      if(claimed&&claimed!==calculated)fail('ARTIFACT_HASH_MISMATCH',`Artifact ${artifactId} bytes do not match its declared SHA-256.`,STATUS.BLOCKED);
      if(expected&&expected!==calculated)fail('BINDING_HASH_MISMATCH',`Artifact binding ${name} bytes do not match the binding's expected SHA-256.`,STATUS.BLOCKED);
      totalInputBytes+=bytes.byteLength;inputBindings.push({binding:name,kind:'ARTIFACT',artifactId,filename,byteLength:bytes.byteLength,sha256:calculated});
    }else{
      if(hasOwn(artifacts||{},name))fail('BINDING_KIND_MISMATCH',`Binding ${name} requires an immutable canonical value, not artifact bytes.`,STATUS.BLOCKED);
      if(!hasOwn(canonicalBindings||{},name))fail('MISSING_BINDING',`Required canonical binding ${name} is unavailable.`,STATUS.BLOCKED);
      const supplied=canonicalBindings[name];if(!supplied||typeof supplied!=='object'||Array.isArray(supplied)||!hasOwn(supplied,'value'))fail('INVALID_CANONICAL_BINDING',`Canonical binding ${name} must carry canonicalKey, value, and valueSha256.`,STATUS.BLOCKED);
      const canonicalKey=String(supplied.canonicalKey||'');if(canonicalKey!==String(descriptor.canonicalKey))fail('BINDING_IDENTITY_MISMATCH',`Canonical binding ${name} resolved to ${canonicalKey||'UNKNOWN'}, not ${descriptor.canonicalKey}.`,STATUS.BLOCKED);
      let serialized,calculated;try{serialized=canonical(supplied.value);calculated=await sha256Canonical(supplied.value);}catch(error){fail('INVALID_CANONICAL_BINDING',`Canonical binding ${name} is not valid closed-loop-canonical-json/1: ${error.message}`,STATUS.BLOCKED);}
      const bytes=encoder.encode(serialized).byteLength;canonicalInputBytes+=bytes;totalInputBytes+=bytes;
      if(canonicalInputBytes>LIMITS.maxCanonicalInputBytes)fail('CANONICAL_INPUT_LIMIT','Canonical bindings exceed the registered byte limit.',STATUS.BLOCKED);
      if(String(descriptor.valueSha256).toLowerCase()!==calculated)fail('BINDING_HASH_MISMATCH',`Canonical binding ${name} no longer matches its declared value SHA-256.`,STATUS.BLOCKED);
      if(String(supplied.valueSha256||'').toLowerCase()!==calculated)fail('CANONICAL_VALUE_HASH_MISMATCH',`Canonical binding ${name} payload does not match its value SHA-256.`,STATUS.BLOCKED);
      inputBindings.push({binding:name,kind:'CANONICAL_VALUE',canonicalKey,canonicalByteLength:bytes,valueSha256:calculated});
    }
    if(totalInputBytes>LIMITS.maxTotalInputBytes)fail('INPUT_BYTE_LIMIT','Bound inputs exceed the registered total-input byte limit.',STATUS.BLOCKED);
  }
  return {inputBindings,totalInputBytes,canonicalInputBytes};
}

async function boundedObservationValue(value){
  if(value===undefined)return {summaryType:'UNDEFINED'};
  const bytes=bytesOf(value);if(bytes)return {summaryType:'BYTES',byteLength:bytes.byteLength,sha256:await sha256(bytes)};
  let serialized;try{serialized=canonical(value);}catch(error){fail('UNREPRESENTABLE_RESULT',`Runtime result is not valid closed-loop-canonical-json/1: ${error.message}`);}
  const canonicalByteLength=encoder.encode(serialized).byteLength;if(canonicalByteLength<=LIMITS.maxObservationValueBytes)return value;
  return {summaryType:'CANONICAL_VALUE',valueType:value===null?'null':Array.isArray(value)?'array':typeof value,canonicalByteLength,sha256:await sha256Canonical(value),...(Array.isArray(value)?{itemCount:value.length}:{})};
}
async function finalizeResult(result){
  const normalized={...result,expected:await boundedObservationValue(result.expected),actual:await boundedObservationValue(result.actual),observations:[]};
  for(const observation of result.observations||[]){const item={...observation};if(hasOwn(item,'expected'))item.expected=await boundedObservationValue(item.expected);if(hasOwn(item,'actual'))item.actual=await boundedObservationValue(item.actual);normalized.observations.push(item);}
  let serialized;try{serialized=canonical(normalized);}catch(error){fail('UNREPRESENTABLE_RESULT',`Normalized runtime result cannot be canonically recorded: ${error.message}`);}
  if(encoder.encode(serialized).byteLength>LIMITS.maxResultCanonicalBytes)fail('RESULT_BYTE_LIMIT','Normalized runtime result exceeds the registered canonical byte limit.');
  return normalized;
}

async function execute({spec,artifacts={},canonicalBindings={},metadata={}}){
  const bindings=metadata?.bindings;if(bindings===undefined)fail('INVALID_BINDINGS','Execution requires the exact accepted EXECUTABLE_INPUT_BINDINGS contract.');const bindingCheck=validateBindings(bindings);if(!bindingCheck.valid)fail('INVALID_BINDINGS',bindingCheck.issues.join(' '));const specCheck=validateSpec(spec,bindings);if(!specCheck.valid)fail('INVALID_TEST_IR',specCheck.issues.join(' '));
  const normalized=normalizeSpec(spec,bindings),verifiedInputs=await verifyBoundInputs(bindings,artifacts,canonicalBindings),inputBindings=verifiedInputs.inputBindings,inputArtifactBindings=inputBindings.filter(item=>item.kind==='ARTIFACT'),inputCanonicalBindings=inputBindings.filter(item=>item.kind==='CANONICAL_VALUE'),inputArtifactIds=inputArtifactBindings.map(item=>item.artifactId),inputArtifactSha256Values=inputArtifactBindings.map(item=>item.sha256);
  let value=null,current=null;const observations=[];let finalAssertion=null;
  for(const [index,step] of normalized.steps.entries()){
    switch(step.op){
      case 'LOAD_ARTIFACT':{
        const resolved=resolveBinding(step.binding,artifacts,canonicalBindings);current=resolved;value=resolved.kind==='CANONICAL_VALUE'?(resolved.value?.value??resolved.value):resolved.value;
        const identity=inputBindings.find(item=>item.binding===step.binding);if(resolved.kind==='ARTIFACT')observations.push({step:index,op:step.op,...identity});
        else observations.push({step:index,op:step.op,...identity});
        break;
      }
      case 'READ_BYTES':{const bytes=bytesOf(current?.kind==='ARTIFACT'?(current.value?.bytes??current.value):value);if(!bytes)fail('BYTES_REQUIRED','READ_BYTES requires a byte-backed artifact binding.');value=bytes;observations.push({step:index,op:step.op,byteLength:bytes.byteLength});break;}
      case 'DECODE_UTF8':{const bytes=bytesOf(value);if(!bytes)fail('BYTES_REQUIRED','DECODE_UTF8 requires bytes.');if(bytes.byteLength>LIMITS.maxTextBytes)fail('TEXT_BYTE_LIMIT','UTF-8 input exceeds the registered text-byte limit.');if(bytes.byteLength>LIMITS.maxDecompressedBytes)fail('DECOMPRESSED_BYTE_LIMIT','UTF-8 input exceeds the registered decompressed-byte limit.');try{value=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('INVALID_UTF8','Input is not valid UTF-8.',STATUS.UNDETERMINED);}break;}
      case 'PARSE_JSON':{const source=String(value);validateJsonSourceExact(source);try{value=JSON.parse(source);}catch(error){fail('MALFORMED_JSON',`JSON parse failed: ${error.message}`,STATUS.UNDETERMINED);}inspectStructure(value);break;}
      case 'PARSE_CSV':value=parseCsv(String(value),step);inspectStructure(value);break;
      case 'PARSE_XML':value=parseXml(String(value));inspectStructure(value);break;
      case 'SELECT_JSON_PATH':value=selectJsonPath(value,step.path);break;
      case 'SELECT_XML':value=selectXml(value,step.path);break;
      case 'COUNT':{if(value==null||typeof value.length!=='number')fail('COUNT_INPUT','COUNT requires an array, string, or array-like value.',STATUS.UNDETERMINED);if(value.length>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT','COUNT input exceeds the registered collection limit.');value=value.length;break;}
      case 'SUM':case 'MIN':case 'MAX':{const values=collection(value,step.op);if(step.op!=='SUM'&&!values.length)fail('EMPTY_COLLECTION',`${step.op} requires at least one exact integer.`,STATUS.UNDETERMINED);const typed=values.some(item=>item&&typeof item==='object'),integers=values.map(exactIntegerBigInt);let result;if(step.op==='SUM')result=integers.reduce((sum,item)=>sum+item,0n);else result=integers.reduce((best,item)=>step.op==='MIN'?(item<best?item:best):(item>best?item:best));if(result.toString().replace('-','').length>LIMITS.maxNumericDigits)fail('NUMERIC_DIGIT_LIMIT',`${step.op} result exceeds the registered exact-integer digit limit.`,STATUS.UNDETERMINED);value=integerOutput(result,typed);break;}
      case 'SORT':{const direction=step.direction||'ASC',items=[...collection(value,'SORT')],domain=sortDomain(items,step.domain);value=items.sort((a,b)=>compareSortValues(a,b,domain));if(direction==='DESC')value.reverse();break;}
      case 'UNIQUE':{const seen=new Set();value=collection(value,'UNIQUE').filter(item=>{const key=canonical(item);if(seen.has(key))return false;seen.add(key);return true;});break;}
      case 'HASH_SHA256':value=await sha256(value);break;
      case 'REGEX':{const input=String(value);if(byteLength(input)>LIMITS.maxRegexInputBytes)fail('REGEX_INPUT_LIMIT','Regex input exceeds the registered byte limit.');const regexIssues=validateRegex(step.pattern,step.flags);if(regexIssues.length)fail('UNSAFE_REGEX',regexIssues.join(' '));value=new RegExp(step.pattern,step.flags||'').test(input);break;}
      case 'COMPARE':{const expected=hasOwn(step,'value')?step.value:valueFromBinding(step.binding,artifacts,canonicalBindings),operator=step.operator,cmp=['EQ','NE'].includes(operator)?null:orderedCompare(value,expected);if(operator==='EQ')value=exactEqual(value,expected,step);else if(operator==='NE')value=!exactEqual(value,expected,step);else if(operator==='GT')value=cmp>0;else if(operator==='GTE')value=cmp>=0;else if(operator==='LT')value=cmp<0;else value=cmp<=0;break;}
      case 'BYTE_COMPARE':{const left=bytesOf(value),resolved=resolveBinding(step.binding,artifacts,canonicalBindings),right=bytesOf(resolved.kind==='ARTIFACT'?(resolved.value?.bytes??resolved.value):resolved.value?.value??resolved.value);if(!left||!right)fail('BYTES_REQUIRED','BYTE_COMPARE requires byte-backed current and target bindings.');let equal=left.byteLength===right.byteLength;if(equal)for(let i=0;i<left.byteLength;i++)if(left[i]!==right[i]){equal=false;break;}value=equal;break;}
      case 'ASSERT_EXISTS':finalAssertion=resultForAssertion(value!==null&&value!==undefined,'present',value,step.message);break;
      case 'ASSERT_TYPE':{const actual=bytesOf(value)?'bytes':Array.isArray(value)?'array':value===null?'null':typeof value;finalAssertion=resultForAssertion(actual===step.value,step.value,actual,step.message);break;}
      case 'ASSERT_NE':finalAssertion=resultForAssertion(!exactEqual(value,step.value,step),`not ${canonical(step.value)}`,value,step.message);break;
      case 'ASSERT_EQ':finalAssertion=resultForAssertion(exactEqual(value,step.value,step),step.value,value,step.message);break;
      case 'ASSERT_GT':finalAssertion=resultForAssertion(orderedCompare(value,step.value)>0,`> ${step.value}`,value,step.message);break;
      case 'ASSERT_GTE':finalAssertion=resultForAssertion(orderedCompare(value,step.value)>=0,`>= ${step.value}`,value,step.message);break;
      case 'ASSERT_LT':finalAssertion=resultForAssertion(orderedCompare(value,step.value)<0,`< ${step.value}`,value,step.message);break;
      case 'ASSERT_LTE':finalAssertion=resultForAssertion(orderedCompare(value,step.value)<=0,`<= ${step.value}`,value,step.message);break;
      case 'ASSERT_MATCH':{const input=String(value);if(byteLength(input)>LIMITS.maxRegexInputBytes)fail('REGEX_INPUT_LIMIT','Regex input exceeds the registered byte limit.');const regexIssues=validateRegex(step.pattern,step.flags);if(regexIssues.length)fail('UNSAFE_REGEX',regexIssues.join(' '));finalAssertion=resultForAssertion(new RegExp(step.pattern,step.flags||'').test(input),`matches /${step.pattern}/${step.flags||''}`,value,step.message);break;}
      case 'ASSERT_CONTAINS':{const ok=Array.isArray(value)?value.some(item=>canonical(item)===canonical(step.value)):String(value).includes(String(step.value));finalAssertion=resultForAssertion(ok,`contains ${canonical(step.value)}`,value,step.message);break;}
      case 'ASSERT_NOT_CONTAINS':{const ok=Array.isArray(value)?!value.some(item=>canonical(item)===canonical(step.value)):!String(value).includes(String(step.value));finalAssertion=resultForAssertion(ok,`does not contain ${canonical(step.value)}`,value,step.message);break;}
      case 'ASSERT_SET_EQUAL':{const actual=collection(value,'ASSERT_SET_EQUAL');const left=[...new Set(actual.map(canonical))].sort(),right=[...new Set(step.value.map(canonical))].sort();finalAssertion=resultForAssertion(canonical(left)===canonical(right),step.value,actual,step.message);break;}
      default:fail('UNKNOWN_OPERATION',`Unsupported Test IR operation ${step.op}.`);
    }
    if(finalAssertion){observations.push({step:index,op:step.op,...finalAssertion});if(finalAssertion.determination===STATUS.VIOLATED)break;}
  }
  const testSpecSha256=await sha256Canonical(normalized);
  return finalizeResult({
    testId:metadata.testId||null,
    testSpecVersion:SPEC_VERSION,
    testSpecSha256,
    status:'COMPLETE',
    determination:finalAssertion?.determination||STATUS.UNDETERMINED,
    expected:finalAssertion?.expected??null,
    actual:finalAssertion?.actual??value,
    observations,
    evidence:[{kind:'APPLICATION_NATIVE_RUNTIME_OBSERVATION',testSpecSha256,inputBindings}],
    executorVersion:VERSION,
    runtimeVersion:VERSION,
    runtimeBuildIdentity:RUNTIME_BUILD_ID,
    workerProtocolVersion:null,
    testWorkerSha256:null,
    workerAttestation:null,
    inputBindings,
    inputArtifactIds,
    inputArtifactSha256Values,
    inputCanonicalBindingKeys:inputCanonicalBindings.map(item=>item.canonicalKey),
    inputCanonicalValueSha256Values:inputCanonicalBindings.map(item=>item.valueSha256)
  });
}

function workerUrl(candidate){
  const source=typeof document!=='undefined'?document.currentScript?.src:null,base=source||root.location?.href||'https://closed-loop.invalid/';let url;
  try{url=new URL(candidate||'test-worker.js',base);}catch{throw new RuntimeError('WORKER_URL_INVALID','The isolated Test IR worker URL is invalid.');}
  const pageOrigin=root.location?.origin;if(pageOrigin&&pageOrigin!=='null'&&url.origin!==pageOrigin)throw new RuntimeError('WORKER_ORIGIN_MISMATCH','The isolated Test IR worker must use the application origin.');
  if(url.hash)throw new RuntimeError('WORKER_URL_INVALID','The isolated Test IR worker URL must not contain a fragment.');
  const keys=[...url.searchParams.keys()];if(keys.some(key=>key!=='v'))throw new RuntimeError('WORKER_URL_INVALID','The isolated Test IR worker URL may contain only the shared build identity.');
  const suppliedBuild=url.searchParams.get('v');if(suppliedBuild&&suppliedBuild!==RUNTIME_BUILD_ID)throw new RuntimeError('WORKER_URL_BUILD_IDENTITY_MISMATCH',`Test IR worker URL build ${suppliedBuild} does not match ${RUNTIME_BUILD_ID}.`);
  url.search='';url.searchParams.set('v',RUNTIME_BUILD_ID);return url.href;
}
function workerDeclaration(source,name){return String(source).match(new RegExp(`(?:^|\\n)const\\s+${name}\\s*=\\s*['\"]([^'\"]+)['\"]\\s*;`))?.[1]||'';}
async function attestWorkerBytes(url,fetchFn){
  if(typeof fetchFn!=='function')throw new RuntimeError('WORKER_BYTE_ATTESTATION_UNAVAILABLE','The application cannot retrieve and attest the exact Test IR worker bytes.');
  let response;try{response=await fetchFn(url,{method:'GET',cache:'no-store',credentials:'same-origin',redirect:'error'});}catch(error){throw new RuntimeError('WORKER_BYTE_FETCH_FAILED',`The exact Test IR worker bytes could not be retrieved: ${String(error?.message||error)}`);}
  if(!response||response.ok!==true)throw new RuntimeError('WORKER_BYTE_FETCH_FAILED',`The exact Test IR worker bytes could not be retrieved${response?.status?` (HTTP ${response.status})`:''}.`);
  if(response.redirected)throw new RuntimeError('WORKER_BYTE_FETCH_REDIRECTED','The Test IR worker byte request was redirected.');
  if(response.url){let finalUrl;try{finalUrl=new URL(response.url,url).href;}catch{throw new RuntimeError('WORKER_BYTE_FETCH_FAILED','The Test IR worker byte response URL is invalid.');}if(finalUrl!==url)throw new RuntimeError('WORKER_BYTE_FETCH_URL_MISMATCH','The fetched Test IR worker bytes did not come from the exact execution URL.');}
  let bytes;try{bytes=new Uint8Array(await response.arrayBuffer());}catch(error){throw new RuntimeError('WORKER_BYTE_FETCH_FAILED',`The Test IR worker byte response could not be read: ${String(error?.message||error)}`);}
  const testWorkerSha256=await sha256(bytes),source=new TextDecoder('utf-8',{fatal:true}).decode(bytes),runtimeBuildIdentity=workerDeclaration(source,'RUNTIME_BUILD_ID'),workerProtocolVersion=workerDeclaration(source,'WORKER_PROTOCOL_VERSION'),attestation={runtimeBuildIdentity,workerProtocolVersion,testWorkerSha256};
  const reject=(code,message)=>{const error=new RuntimeError(code,message);error.workerAttestation=attestation;throw error;};
  if(testWorkerSha256!==TEST_WORKER_SHA256)reject('WORKER_BYTE_IDENTITY_MISMATCH',`Observed Test IR worker SHA-256 ${testWorkerSha256} does not match ${TEST_WORKER_SHA256}.`);
  if(runtimeBuildIdentity!==RUNTIME_BUILD_ID)reject('WORKER_BYTE_BUILD_IDENTITY_MISMATCH',`Observed Test IR worker build ${runtimeBuildIdentity||'UNKNOWN'} does not match ${RUNTIME_BUILD_ID}.`);
  if(workerProtocolVersion!==WORKER_PROTOCOL_VERSION)reject('WORKER_BYTE_PROTOCOL_MISMATCH',`Observed Test IR worker protocol ${workerProtocolVersion||'UNKNOWN'} does not match ${WORKER_PROTOCOL_VERSION}.`);
  return Object.freeze(attestation);
}
function executionFailure(test,startedAtDeviceTime,error,workerAttestation=error?.workerAttestation){
  const disposition=[STATUS.BLOCKED,STATUS.UNDETERMINED].includes(error?.disposition)?error.disposition:STATUS.EXECUTION_FAILED;
  return {testId:field(test,'TEST_ID')||test?.testId||null,testSpecVersion:SPEC_VERSION,testSpecSha256:null,status:disposition,determination:STATUS.UNDETERMINED,expected:null,actual:null,observations:[],evidence:[],executorVersion:VERSION,runtimeVersion:VERSION,runtimeBuildIdentity:workerAttestation?.runtimeBuildIdentity||null,workerProtocolVersion:workerAttestation?.workerProtocolVersion||null,testWorkerSha256:workerAttestation?.testWorkerSha256||null,workerAttestation:workerAttestation?{...workerAttestation}:null,inputBindings:[],inputArtifactIds:[],inputArtifactSha256Values:[],inputCanonicalBindingKeys:[],inputCanonicalValueSha256Values:[],startedAtDeviceTime,endedAtDeviceTime:new Date().toISOString(),failure:{code:error?.code||'WORKER_EXECUTION_FAILED',message:String(error?.message||error)}};
}
async function executeTest(test,artifacts,canonicalBindings,options={}){
  const spec=field(test,'EXECUTABLE_SPEC'),bindings=field(test,'EXECUTABLE_INPUT_BINDINGS'),startedAtDeviceTime=new Date().toISOString(),check=validateSpec(spec,bindings);if(!check.valid)return executionFailure(test,startedAtDeviceTime,new RuntimeError('INVALID_TEST_IR',check.issues.join(' ')));
  let normalized,verifiedInputs,expectedSpecSha256;try{normalized=normalizeSpec(spec,bindings);verifiedInputs=await verifyBoundInputs(bindings,artifacts||{},canonicalBindings||{});expectedSpecSha256=await sha256Canonical(normalized);}catch(error){return executionFailure(test,startedAtDeviceTime,error);}
  const WorkerClass=options.Worker||root.Worker;if(typeof WorkerClass!=='function')return executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_UNAVAILABLE','The isolated Test IR worker is unavailable.'));
  let exactWorkerUrl,workerAttestation;try{exactWorkerUrl=workerUrl(options.workerUrl);workerAttestation=await attestWorkerBytes(exactWorkerUrl,options.fetch||root.fetch);}catch(error){return executionFailure(test,startedAtDeviceTime,error);}
  return new Promise(resolve=>{
    const requestId=`test-ir-${Date.now()}-${Math.random().toString(36).slice(2)}`;let settled=false,worker;try{worker=new WorkerClass(exactWorkerUrl);}catch(error){resolve(executionFailure(test,startedAtDeviceTime,error,workerAttestation));return;}
    const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);try{worker.terminate();}catch{}resolve(result);};
    const requestedTimeout=Number(options.timeoutMs),timeoutMs=Number.isFinite(requestedTimeout)&&requestedTimeout>0?Math.min(requestedTimeout,LIMITS.workerTimeoutMs):LIMITS.workerTimeoutMs;
    const timer=setTimeout(()=>finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_TIMEOUT',`Test IR worker exceeded ${timeoutMs} ms.`),workerAttestation)),timeoutMs);
    worker.onmessage=event=>{const message=event?.data||{};if(message.requestId!==requestId)return;if(message.runtimeBuildIdentity!==workerAttestation.runtimeBuildIdentity){finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_BUILD_IDENTITY_MISMATCH',`Test IR worker build ${String(message.runtimeBuildIdentity||'UNKNOWN')} does not match ${workerAttestation.runtimeBuildIdentity}.`),workerAttestation));return;}if(message.workerProtocolVersion!==workerAttestation.workerProtocolVersion){finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_PROTOCOL_MISMATCH',`Test IR worker protocol ${String(message.workerProtocolVersion||'UNKNOWN')} does not match ${workerAttestation.workerProtocolVersion}.`),workerAttestation));return;}if(canonical(message.workerAttestation)!==canonical(workerAttestation)){finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_ATTESTATION_HANDSHAKE_MISMATCH','The Test IR worker did not echo the exact parent-observed byte attestation.'),workerAttestation));return;}if(message.ok){const result=message.result;if(result?.runtimeBuildIdentity!==workerAttestation.runtimeBuildIdentity){finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_RESULT_BUILD_IDENTITY_MISMATCH','Test IR worker result build identity does not match the observed worker bytes.'),workerAttestation));return;}if(result?.workerProtocolVersion!==workerAttestation.workerProtocolVersion){finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_RESULT_PROTOCOL_MISMATCH','Test IR worker result protocol does not match the observed worker bytes.'),workerAttestation));return;}if(result?.testWorkerSha256!==workerAttestation.testWorkerSha256){finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_RESULT_BYTE_IDENTITY_MISMATCH','Test IR worker result is not bound to the observed worker-byte SHA-256.'),workerAttestation));return;}try{if(result?.status!=='COMPLETE'||!Object.values(STATUS).filter(value=>!['BLOCKED','EXECUTION_FAILED'].includes(value)).includes(result?.determination))throw new RuntimeError('INVALID_WORKER_RESULT','Test IR worker returned an invalid normalized completion state.');if(result?.testId!==(field(test,'TEST_ID')||test?.testId||null)||result?.testSpecVersion!==SPEC_VERSION||result?.testSpecSha256!==expectedSpecSha256)throw new RuntimeError('WORKER_RESULT_SCOPE_MISMATCH','Test IR worker result does not match the exact test and Test IR identity.');if(canonical(result.inputBindings)!==canonical(verifiedInputs.inputBindings))throw new RuntimeError('WORKER_RESULT_INPUT_BINDING_MISMATCH','Test IR worker result does not match the independently verified input bindings.');const resultBytes=encoder.encode(canonical(result)).byteLength;if(resultBytes>LIMITS.maxResultCanonicalBytes)throw new RuntimeError('RESULT_BYTE_LIMIT','Test IR worker result exceeds the registered canonical byte limit.');}catch(error){finish(executionFailure(test,startedAtDeviceTime,error,workerAttestation));return;}finish({...result,runtimeBuildIdentity:workerAttestation.runtimeBuildIdentity,workerProtocolVersion:workerAttestation.workerProtocolVersion,testWorkerSha256:workerAttestation.testWorkerSha256,startedAtDeviceTime,endedAtDeviceTime:new Date().toISOString()});}else finish(executionFailure(test,startedAtDeviceTime,new RuntimeError(message.error?.code||'WORKER_EXECUTION_FAILED',message.error?.message||'Worker execution failed.',message.error?.disposition||STATUS.EXECUTION_FAILED),workerAttestation));};
    worker.onerror=event=>finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_ERROR',event?.message||'Test IR worker failed.'),workerAttestation));
    try{worker.postMessage({type:'EXECUTE_TEST_IR',requestId,runtimeBuildIdentity:workerAttestation.runtimeBuildIdentity,workerProtocolVersion:workerAttestation.workerProtocolVersion,workerAttestation,spec:normalized,bindings,artifacts:artifacts||{},canonicalBindings:canonicalBindings||{},metadata:{testId:field(test,'TEST_ID')||test?.testId||null,bindings}});}catch(error){finish(executionFailure(test,startedAtDeviceTime,error,workerAttestation));}
  });
}

const operationContracts=()=>JSON.parse(JSON.stringify(OP_DEFINITIONS));
const capabilities=()=>Object.freeze([CAPABILITY]);
root.closedLoopTestRuntime=Object.freeze({VERSION,RUNTIME_BUILD_ID,WORKER_PROTOCOL_VERSION,TEST_WORKER_SHA256,SPEC_VERSION,EXECUTABLE_KIND,CAPABILITY,OPS,OP_DEFINITIONS,LIMITS,STATUS,RuntimeError,validateSpec,validateBindings,normalizeSpec,supports,execute,executeTest,capabilities,operationContracts,sha256Canonical,validateResourceEnvelope});
})();

/* INTEGRATED CONTROLLING COMPLETION 53-70 */
;(()=>{
'use strict';
const r0=globalThis.closedLoopTestRuntime;
if(!r0)throw new Error('Base Test IR runtime must load before integrated completion runtime.');
const VERSION='closed-loop-controlling-completion/53-70/1',fv=(r,k)=>r?.fields?.[k]??r?.[k];
function validate(spec,bindings){try{return r0.validateSpec(spec,bindings);}catch(error){return{valid:false,issues:[String(error?.message||error)]};}}
const runtime=Object.freeze({...r0,VERSION:'closed-loop-test-runtime/3',__controllingCompletionAmendmentVersion:VERSION,validateSpec:validate,supports:test=>{const spec=fv(test,'EXECUTABLE_SPEC')||test?.EXECUTABLE_SPEC,bindings=fv(test,'EXECUTABLE_INPUT_BINDINGS')||test?.EXECUTABLE_INPUT_BINDINGS;return validate(spec,bindings).valid&&r0.supports(test);},execute:(request,...args)=>r0.execute(request,...args),executeTest:(test,...args)=>r0.executeTest(test,...args)});globalThis.closedLoopTestRuntime=runtime;
})();

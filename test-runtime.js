(()=>{
'use strict';

const root=globalThis;
const VERSION='closed-loop-test-runtime/1';
const RUNTIME_BUILD_ID='runtime-20260901-controlling-amendment-63';
const BUILD_IDENTITY=RUNTIME_BUILD_ID;
const WORKER_PROTOCOL_VERSION='closed-loop-test-worker-protocol/1';
const CANONICALIZATION_VERSION='closed-loop-canonical-json/1';
const TEST_WORKER_SHA256='28988e6085f2d0aefee9db8dc95ac95488269c5e4a1f38e1e4dc639146b0ab7d';
const SPEC_VERSION='closed-loop-test-spec/1';
const EXECUTABLE_KIND='TEST_IR';
const CAPABILITY='CLOSED_LOOP_TEST_IR';
/* document.currentScript is populated only while this file is evaluating.
   Capture it now so a later operator click cannot lose the shared build token
   when the same-origin worker URL is constructed. */
const RUNTIME_SCRIPT_URL=typeof document!=='undefined'?document.currentScript?.src||null:null;
const PARSER_IDENTITIES=Object.freeze({
  JSON:'closed-loop-json-parser/1',
  CSV:'closed-loop-csv-parser/1',
  XML:'closed-loop-xml-parser/1',
  JSON_SELECTOR:'closed-loop-json-selector/1',
  XML_SELECTOR:'closed-loop-xml-selector/1',
  REGEX:'closed-loop-safe-regex/1',
  NUMERIC:'closed-loop-exact-number/1'
});

/* One centralized support envelope. Limits are deterministic support-contract
   boundaries, not claims about every browser, archive, or project. */
const LIMITS=Object.freeze({
  maxTotalInputBytes:32*1024*1024,
  maxTextBytes:16*1024*1024,
  maxCanonicalBindingBytes:8*1024*1024,
  maxCanonicalStringBytes:2*1024*1024,
  maxDecompressedBytes:64*1024*1024,
  maxSteps:128,
  maxSpecBytes:512*1024,
  maxSelectorDepth:32,
  maxParsedDepth:64,
  maxParsedNodes:250000,
  maxCollectionItems:100000,
  maxJsonObjectMembers:100000,
  maxJsonStringBytes:2*1024*1024,
  maxJsonNumberTokenBytes:512,
  maxRegexPatternBytes:2048,
  maxRegexLength:2000,
  maxRegexInputBytes:2*1024*1024,
  maxRegexUnboundedQuantifiers:8,
  maxRegexQuantifier:10000,
  maxRegexCaptureCount:0,
  maxCsvCells:250000,
  maxCsvRows:100000,
  maxCsvColumns:10000,
  maxCsvFieldBytes:2*1024*1024,
  maxCsvTotalCharacters:16*1024*1024,
  maxXmlNodes:100000,
  maxXmlDepth:64,
  maxXmlAttributesPerElement:1000,
  maxXmlAttributeBytes:1024*1024,
  maxXmlTextNodeBytes:2*1024*1024,
  maxXmlNamespaces:1000,
  maxXmlTotalTextBytes:16*1024*1024,
  maxExactNumericDigits:512,
  workerTimeoutMs:5000,
  maxArchiveExpansionBytes:64*1024*1024
});

const STATUS=Object.freeze({SATISFIED:'SATISFIED',VIOLATED:'VIOLATED',UNDETERMINED:'UNDETERMINED',EXECUTION_FAILED:'EXECUTION_FAILED'});

const OP_ARGUMENT_DEFINITIONS={
  LOAD_ARTIFACT:{required:['binding'],optional:[],types:{binding:'binding'}},
  READ_BYTES:{required:[],optional:[],types:{}},
  DECODE_UTF8:{required:[],optional:[],types:{}},
  PARSE_JSON:{required:[],optional:[],types:{}},
  PARSE_CSV:{required:['delimiter','header','quote','quoteEscaping','newline','emptyLinePolicy','columnCountPolicy','encoding'],optional:[],types:{delimiter:'delimiter',header:'boolean',quote:'quote',quoteEscaping:'quoteEscaping',newline:'csvNewline',emptyLinePolicy:'emptyLinePolicy',columnCountPolicy:'columnCountPolicy',encoding:'utf8'}},
  PARSE_XML:{required:[],optional:[],types:{}},
  SELECT_JSON_PATH:{required:['path'],optional:[],types:{path:'jsonSelector'}},
  SELECT_XML:{required:['path'],optional:[],types:{path:'xmlSelector'}},
  COUNT:{required:[],optional:[],types:{}},
  SUM:{required:[],optional:[],types:{}},
  MIN:{required:[],optional:[],types:{}},
  MAX:{required:[],optional:[],types:{}},
  SORT:{required:['valueType'],optional:['direction'],types:{valueType:'sortValueType',direction:'sortDirection'}},
  UNIQUE:{required:[],optional:[],types:{}},
  HASH_SHA256:{required:[],optional:[],types:{}},
  REGEX:{required:['pattern'],optional:['flags'],types:{pattern:'regex',flags:'regexFlags'}},
  COMPARE:{required:['operator'],optional:['value','binding','numericMode','absTol','relTol','absoluteTolerance','relativeTolerance'],types:{binding:'binding',operator:'compareOperator',numericMode:'numericMode',absTol:'exactNonnegativeDecimal',relTol:'exactNonnegativeDecimal',absoluteTolerance:'exactNonnegativeDecimal',relativeTolerance:'exactNonnegativeDecimal'},oneOf:[['value'],['binding']]},
  ASSERT_EQ:{required:['value'],optional:['message','numericMode','absTol','relTol','absoluteTolerance','relativeTolerance'],types:{message:'string',numericMode:'numericMode',absTol:'exactNonnegativeDecimal',relTol:'exactNonnegativeDecimal',absoluteTolerance:'exactNonnegativeDecimal',relativeTolerance:'exactNonnegativeDecimal'}},
  ASSERT_GT:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_GTE:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_LT:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_LTE:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_MATCH:{required:['pattern'],optional:['flags','message'],types:{pattern:'regex',flags:'regexFlags',message:'string'}},
  ASSERT_CONTAINS:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_NOT_CONTAINS:{required:['value'],optional:['message'],types:{message:'string'}},
  ASSERT_SET_EQUAL:{required:['value'],optional:['message'],types:{message:'string',value:'array'}},
  BYTE_COMPARE:{required:['binding'],optional:[],types:{binding:'binding'}}
};
const PIPELINE_CONTRACTS={
  LOAD_ARTIFACT:{inputTypes:['NONE'],outputType:'BOUND_VALUE',resourceCost:'BINDING'},
  READ_BYTES:{inputTypes:['BOUND_ARTIFACT','BYTES'],outputType:'BYTES',resourceCost:'BYTES'},
  DECODE_UTF8:{inputTypes:['BYTES'],outputType:'STRING',resourceCost:'PARSER'},
  PARSE_JSON:{inputTypes:['STRING'],outputType:'JSON',resourceCost:'PARSER'},
  PARSE_CSV:{inputTypes:['STRING'],outputType:'ARRAY',resourceCost:'PARSER'},
  PARSE_XML:{inputTypes:['STRING'],outputType:'XML',resourceCost:'PARSER'},
  SELECT_JSON_PATH:{inputTypes:['JSON'],outputType:'ANY',resourceCost:'SELECTOR'},
  SELECT_XML:{inputTypes:['XML'],outputType:'ARRAY',resourceCost:'SELECTOR'},
  COUNT:{inputTypes:['ARRAY','STRING'],outputType:'INTEGER',resourceCost:'COLLECTION'},
  SUM:{inputTypes:['ARRAY'],outputType:'EXACT_NUMBER',resourceCost:'NUMERIC'},
  MIN:{inputTypes:['ARRAY'],outputType:'EXACT_NUMBER',resourceCost:'NUMERIC'},
  MAX:{inputTypes:['ARRAY'],outputType:'EXACT_NUMBER',resourceCost:'NUMERIC'},
  SORT:{inputTypes:['ARRAY'],outputType:'ARRAY',resourceCost:'COLLECTION'},
  UNIQUE:{inputTypes:['ARRAY'],outputType:'ARRAY',resourceCost:'COLLECTION'},
  HASH_SHA256:{inputTypes:['BYTES'],outputType:'STRING',resourceCost:'BYTES'},
  REGEX:{inputTypes:['STRING'],outputType:'BOOLEAN',resourceCost:'REGEX'},
  COMPARE:{inputTypes:['ANY'],outputType:'BOOLEAN',resourceCost:'NUMERIC'},
  ASSERT_EQ:{inputTypes:['ANY'],outputType:'ASSERTION',resourceCost:'ASSERTION'},
  ASSERT_GT:{inputTypes:['SCALAR'],outputType:'ASSERTION',resourceCost:'ASSERTION'},
  ASSERT_GTE:{inputTypes:['SCALAR'],outputType:'ASSERTION',resourceCost:'ASSERTION'},
  ASSERT_LT:{inputTypes:['SCALAR'],outputType:'ASSERTION',resourceCost:'ASSERTION'},
  ASSERT_LTE:{inputTypes:['SCALAR'],outputType:'ASSERTION',resourceCost:'ASSERTION'},
  ASSERT_MATCH:{inputTypes:['STRING'],outputType:'ASSERTION',resourceCost:'REGEX'},
  ASSERT_CONTAINS:{inputTypes:['ARRAY','STRING'],outputType:'ASSERTION',resourceCost:'COLLECTION'},
  ASSERT_NOT_CONTAINS:{inputTypes:['ARRAY','STRING'],outputType:'ASSERTION',resourceCost:'COLLECTION'},
  ASSERT_SET_EQUAL:{inputTypes:['ARRAY'],outputType:'ASSERTION',resourceCost:'COLLECTION'},
  BYTE_COMPARE:{inputTypes:['BYTES'],outputType:'BOOLEAN',resourceCost:'BYTES'}
};
function deepFreeze(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;for(const child of Object.values(value))deepFreeze(child);return Object.freeze(value);}
const OP_DEFINITIONS=deepFreeze(Object.fromEntries(Object.entries(OP_ARGUMENT_DEFINITIONS).map(([op,definition])=>[op,{...definition,...PIPELINE_CONTRACTS[op]}])));
const OPS=Object.freeze(Object.keys(OP_DEFINITIONS));
const ASSERTION_OPS=new Set(['ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL']);
const encoder=new TextEncoder();
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const bytesOf=value=>value instanceof Uint8Array?value:value instanceof ArrayBuffer?new Uint8Array(value):ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):null;
const field=(test,key)=>test?.fields?.[key]??test?.[key];
const byteLength=value=>encoder.encode(String(value)).byteLength;

class RuntimeError extends Error{
  constructor(code,message,disposition=STATUS.EXECUTION_FAILED){super(message);this.name='ClosedLoopTestRuntimeError';this.code=code;this.disposition=disposition;}
}
const fail=(code,message,disposition)=>{throw new RuntimeError(code,message,disposition);};

function assertUnicodeScalars(value,path='string'){
  const text=String(value);
  for(let index=0;index<text.length;index++){
    const code=text.charCodeAt(index);
    if(code>=0xd800&&code<=0xdbff){const low=text.charCodeAt(index+1);if(!(low>=0xdc00&&low<=0xdfff))throw new TypeError(`${path} contains an unpaired high surrogate.`);index++;}
    else if(code>=0xdc00&&code<=0xdfff)throw new TypeError(`${path} contains an unpaired low surrogate.`);
  }
  return text;
}
function scalarCompare(left,right){
  const a=[...assertUnicodeScalars(left)],b=[...assertUnicodeScalars(right)],length=Math.min(a.length,b.length);
  for(let index=0;index<length;index++){const x=a[index].codePointAt(0),y=b[index].codePointAt(0);if(x!==y)return x<y?-1:1;}
  return a.length===b.length?0:a.length<b.length?-1:1;
}
function validateCanonicalValue(value,path='$',seen=new Set()){
  if(value===null)return;
  const type=typeof value;
  if(type==='string'){assertUnicodeScalars(value,path);if(byteLength(value)>LIMITS.maxCanonicalStringBytes)throw new TypeError(`${path} exceeds the canonical string limit.`);return;}
  if(type==='boolean')return;
  if(type==='number'){if(!Number.isSafeInteger(value)||Object.is(value,-0))throw new TypeError(`${path} must be a finite safe integer and cannot be negative zero.`);return;}
  if(type!=='object')throw new TypeError(`${path} contains prohibited ${type}.`);
  if(seen.has(value))throw new TypeError(`${path} is cyclic.`);seen.add(value);
  if(Array.isArray(value)){
    const keys=Object.keys(value);for(let index=0;index<value.length;index++)if(!hasOwn(value,index))throw new TypeError(`${path} is sparse.`);
    if(keys.some(key=>!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=value.length))throw new TypeError(`${path} has non-index array properties.`);
    for(let index=0;index<value.length;index++)validateCanonicalValue(value[index],`${path}[${index}]`,seen);
  }else{
    if(Object.prototype.toString.call(value)!=='[object Object]')throw new TypeError(`${path} must be a plain object.`);
    if(Object.getOwnPropertySymbols(value).length)throw new TypeError(`${path} has symbol keys.`);
    for(const key of Object.keys(value)){
      assertUnicodeScalars(key,`${path} key`);const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!descriptor||!hasOwn(descriptor,'value'))throw new TypeError(`${path}.${key} is an accessor.`);
      validateCanonicalValue(descriptor.value,`${path}.${key}`,seen);
    }
  }
  seen.delete(value);
}
function canonicalBridge(value){if(value===null||typeof value!=='object')return value;if(Array.isArray(value))return value.map(canonicalBridge);const output=Object.create(null);for(const key of Object.keys(value))output[key]=canonicalBridge(value[key]);return output;}
function canonical(value){
  validateCanonicalValue(value);
  const stringify=root.closedLoopHash?.stableStringify;
  if(typeof stringify!=='function')fail('CANONICALIZER_UNAVAILABLE',`${CANONICALIZATION_VERSION} is unavailable.`);
  const serialized=stringify(canonicalBridge(value));if(byteLength(serialized)>LIMITS.maxCanonicalBindingBytes)fail('CANONICAL_BYTE_LIMIT','Canonical value exceeds the registered byte limit.');return serialized;
}

async function sha256(bytes){
  const data=bytesOf(bytes);if(!data)fail('BYTES_REQUIRED','SHA-256 requires byte input.');
  const digest=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
async function sha256Canonical(value){return sha256(encoder.encode(canonical(value)));}

function validateResourceEnvelope(claim={}){
  const issues=[];const allowed=new Set(['totalInputBytes','decompressedBytes','archiveExpansionBytes']);for(const key of Object.keys(claim||{}))if(!allowed.has(key))issues.push('Unknown resource-envelope property '+key+'.');
  const checks=[['totalInputBytes','maxTotalInputBytes'],['decompressedBytes','maxDecompressedBytes'],['archiveExpansionBytes','maxArchiveExpansionBytes']];
  for(const [key,limitKey] of checks){if(!hasOwn(claim,key))continue;const value=claim[key];if(!Number.isSafeInteger(value)||value<0)issues.push(key+' must be a nonnegative safe integer.');else if(value>LIMITS[limitKey])issues.push(key+' exceeds '+limitKey+'.');}
  return {valid:issues.length===0,issues};
}

function validateRegex(pattern,flags=''){
  const issues=[];const text=String(pattern),flagText=String(flags||'');
  if(byteLength(text)>LIMITS.maxRegexPatternBytes||text.length>LIMITS.maxRegexLength)issues.push('Regex pattern exceeds the registered byte limit.');
  if(!/^[imsu]*$/.test(flagText)||new Set(flagText).size!==flagText.length)issues.push('Regex flags must be a unique subset of i, m, s, and u.');
  let inClass=false,escaped=false,unbounded=0,captures=0;
  const simpleEscapes=new Set(['\\','.','+','*','?','{','}','[',']','|','^','$','-','/','t','n','r','f','v','0','d','D','s','S','w','W','b','B']);
  for(let index=0;index<text.length;index++){
    const ch=text[index];
    if(escaped){
      escaped=false;
      if(ch==='0'&&/[0-9]/.test(text[index+1]||'')){issues.push('Regex legacy-octal escape ambiguity is outside the registered subset.');break;}
      if(ch==='x'){if(!/^[0-9a-fA-F]{2}$/.test(text.slice(index+1,index+3))){issues.push('Regex contains an invalid hexadecimal escape.');break;}index+=2;continue;}
      if(ch==='u'){if(!/^[0-9a-fA-F]{4}$/.test(text.slice(index+1,index+5))){issues.push('Regex contains an invalid Unicode escape.');break;}index+=4;continue;}
      if(!simpleEscapes.has(ch)){issues.push(`Regex escape \\${ch} is outside the registered subset.`);break;}
      continue;
    }
    if(ch==='\\'){escaped=true;continue;}
    if(ch==='['&&!inClass){inClass=true;continue;}if(ch===']'&&inClass){inClass=false;continue;}
    if(!inClass&&ch==='('){captures++;issues.push('Regex grouping, lookaround, and inline mode groups are outside the registered subset.');break;}
    if(!inClass&&(ch==='*'||ch==='+'))unbounded++;
    if(!inClass&&ch==='{'){
      const end=text.indexOf('}',index+1);if(end<0){issues.push('Regex contains an unclosed bounded quantifier.');break;}
      const body=text.slice(index+1,end),match=body.match(/^(0|[1-9]\d*)(?:,(0|[1-9]\d*)?)?$/);
      if(!match){issues.push('Regex contains a bounded quantifier outside the registered grammar.');break;}
      const minimum=Number(match[1]),maximum=body.includes(',')?(match[2]===undefined||match[2]===''?null:Number(match[2])):minimum;
      if(!Number.isSafeInteger(minimum)||(maximum!==null&&!Number.isSafeInteger(maximum))||minimum>LIMITS.maxRegexQuantifier||(maximum!==null&&maximum>LIMITS.maxRegexQuantifier)){issues.push('Regex bounded quantifier exceeds the registered limit.');break;}
      if(maximum!==null&&maximum<minimum){issues.push('Regex bounded quantifier maximum is less than its minimum.');break;}
      if(maximum===null)unbounded++;index=end;
    }
  }
  if(escaped)issues.push('Regex ends with an incomplete escape.');if(inClass)issues.push('Regex contains an unclosed character class.');
  if(captures>LIMITS.maxRegexCaptureCount)issues.push('Regex capture count exceeds the registered limit.');
  if(unbounded>LIMITS.maxRegexUnboundedQuantifiers)issues.push('Regex contains too many unbounded quantifiers.');
  try{if(!issues.length)new RegExp(text,flagText);}catch(error){issues.push(`Regex is invalid: ${error.message}`);}
  return [...new Set(issues)];
}

function parseJsonSelector(path){
  const text=String(path||'');assertUnicodeScalars(text,'JSON selector');
  if(text==='$')return [];
  if(!text.startsWith('$.'))fail('UNSUPPORTED_JSON_SELECTOR','JSON selector must be $ or begin with $.');
  const parts=[];let i=2,token='';const pushToken=()=>{if(!token)fail('UNSUPPORTED_JSON_SELECTOR',`Empty JSON selector segment in ${text}.`);parts.push(token);token='';};
  while(i<text.length){const ch=text[i];if(ch==='.') {pushToken();i++;continue;}if(ch==='['){if(token)pushToken();const end=text.indexOf(']',i+1);if(end<0)fail('UNSUPPORTED_JSON_SELECTOR',`Unclosed JSON selector index in ${text}.`);const raw=text.slice(i+1,end);if(!/^(0|[1-9]\d*)$/.test(raw)||raw.length>15||Number(raw)>Number.MAX_SAFE_INTEGER)fail('UNSUPPORTED_JSON_SELECTOR',`Only safe nonnegative numeric JSON selector indexes are supported: ${text}.`);parts.push(Number(raw));i=end+1;if(text[i]==='.')i++;continue;}if(!/[A-Za-z0-9_:-]/.test(ch))fail('UNSUPPORTED_JSON_SELECTOR',`Unsupported JSON selector character ${ch}.`);token+=ch;i++;}
  if(token)pushToken();if(parts.length>LIMITS.maxSelectorDepth)fail('SELECTOR_LIMIT','JSON selector exceeds the registered depth limit.');return parts;
}
function selectJsonPath(value,path){let current=value;for(const part of parseJsonSelector(path)){if(current===null||current===undefined||!hasOwn(Object(current),part))fail('JSON_PATH_MISSING',`JSON selector does not resolve: ${path}.`,STATUS.UNDETERMINED);current=current[part];}return current;}

function parseJson(text){
  const source=String(text);if(byteLength(source)>LIMITS.maxTextBytes)fail('TEXT_BYTE_LIMIT','JSON input exceeds the registered text-byte limit.');assertUnicodeScalars(source,'JSON source');
  let index=0,nodes=0;const whitespace=()=>{while(/[\x20\t\r\n]/.test(source[index]||''))index++;};
  const syntax=message=>fail('MALFORMED_JSON',message,STATUS.UNDETERMINED);
  const node=depth=>{nodes++;if(nodes>LIMITS.maxParsedNodes)fail('PARSED_NODE_LIMIT','JSON exceeds the registered node limit.');if(depth>LIMITS.maxParsedDepth)fail('PARSED_DEPTH_LIMIT','JSON exceeds the registered depth limit.');};
  function stringToken(){
    if(source[index]!=='"')syntax(`Expected JSON string at byte ${index}.`);const start=index++;
    while(index<source.length){const code=source.charCodeAt(index),ch=source[index++];if(ch==='"'){const raw=source.slice(start,index);let decoded;try{decoded=JSON.parse(raw);}catch(error){syntax(`JSON string parse failed: ${error.message}`);}assertUnicodeScalars(decoded,'JSON string');if(byteLength(decoded)>LIMITS.maxJsonStringBytes)fail('JSON_STRING_LIMIT','JSON string exceeds the registered limit.');return decoded;}if(code<0x20)syntax('JSON strings cannot contain unescaped control characters.');if(ch==='\\'){if(index>=source.length)syntax('JSON string ends with an incomplete escape.');const escape=source[index++];if(escape==='u'){if(!/^[0-9a-fA-F]{4}$/.test(source.slice(index,index+4)))syntax('JSON string contains an invalid Unicode escape.');index+=4;}else if(!'"\\/bfnrt'.includes(escape))syntax(`JSON string contains unsupported escape \\${escape}.`);}}
    syntax('Unterminated JSON string.');
  }
  function numberToken(){
    const match=source.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);if(!match)syntax(`Invalid JSON number at byte ${index}.`);const token=match[0];if(byteLength(token)>LIMITS.maxJsonNumberTokenBytes)fail('JSON_NUMBER_LIMIT','JSON numeric token exceeds the registered limit.');index+=token.length;if(/[.eE]/.test(token))fail('UNSUPPORTED_NUMERIC_PRECISION','PARSE_JSON does not silently approximate decimal or exponent numeric tokens.',STATUS.UNDETERMINED);const number=Number(token);if(!Number.isSafeInteger(number)||Object.is(number,-0))fail('UNSUPPORTED_NUMERIC_PRECISION','PARSE_JSON supports only non-negative-zero safe integer numeric literals.',STATUS.UNDETERMINED);
  }
  function value(depth){
    whitespace();node(depth);const ch=source[index];
    if(ch==='"'){stringToken();return;}
    if(ch==='{'){index++;whitespace();const keys=new Set();let members=0;if(source[index]==='}'){index++;return;}while(true){whitespace();const key=stringToken();if(keys.has(key))fail('DUPLICATE_JSON_MEMBER',`JSON object contains duplicate member ${key}.`,STATUS.UNDETERMINED);keys.add(key);members++;if(members>LIMITS.maxJsonObjectMembers)fail('JSON_MEMBER_LIMIT','JSON object exceeds the registered member limit.');whitespace();if(source[index++]!==':')syntax('JSON object member is missing a colon.');value(depth+1);whitespace();const delimiter=source[index++];if(delimiter==='}')break;if(delimiter!==',')syntax('JSON object members must be comma-separated.');}return;}
    if(ch==='['){index++;whitespace();let items=0;if(source[index]===']'){index++;return;}while(true){items++;if(items>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT','JSON array exceeds the registered collection limit.');value(depth+1);whitespace();const delimiter=source[index++];if(delimiter===']')break;if(delimiter!==',')syntax('JSON array items must be comma-separated.');}return;}
    if(source.startsWith('true',index)){index+=4;return;}if(source.startsWith('false',index)){index+=5;return;}if(source.startsWith('null',index)){index+=4;return;}if(ch==='-'||/[0-9]/.test(ch||'')){numberToken();return;}syntax(`Unexpected JSON token at byte ${index}.`);
  }
  value(1);whitespace();if(index!==source.length)syntax(`Unexpected trailing JSON content at byte ${index}.`);
  let parsed;try{parsed=JSON.parse(source);}catch(error){syntax(`JSON parse failed: ${error.message}`);}return parsed;
}

function xmlCodePointAllowed(code){return code===0x9||code===0xa||code===0xd||(code>=0x20&&code<=0xd7ff)||(code>=0xe000&&code<=0xfffd)||(code>=0x10000&&code<=0x10ffff);}
function validateXmlCharacters(text,location){for(const ch of assertUnicodeScalars(text,location)){if(!xmlCodePointAllowed(ch.codePointAt(0)))fail('MALFORMED_XML',`${location} contains an XML-prohibited character.`);}}
function decodeXmlEntity(entity){
  const known={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(hasOwn(known,entity))return known[entity];let code=null;
  if(/^#(?:0|[1-9]\d*)$/.test(entity))code=Number(entity.slice(1));else if(/^#x[0-9a-f]+$/i.test(entity))code=parseInt(entity.slice(2),16);
  if(Number.isInteger(code)&&xmlCodePointAllowed(code)&&!(code>=0xd800&&code<=0xdfff))return String.fromCodePoint(code);
  fail('UNSUPPORTED_XML_ENTITY',`Unsupported or invalid XML entity &${entity};.`);
}
function decodeXmlText(text,location='XML text'){
  const source=String(text);let output='';for(let index=0;index<source.length;){if(source[index]!=='&'){output+=source[index++];continue;}const end=source.indexOf(';',index+1);if(end<0)fail('MALFORMED_XML',`${location} contains an unescaped ampersand.`);const entity=source.slice(index+1,end);if(!entity||/[&<>\s]/.test(entity))fail('MALFORMED_XML',`${location} contains a malformed entity.`);output+=decodeXmlEntity(entity);index=end+1;}validateXmlCharacters(output,location);return output;
}
function parseXmlAttributes(source,counters){
  const attributes=Object.create(null);let rest=String(source||'').trim(),count=0;
  while(rest){const match=rest.match(/^([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*("[^"]*"|'[^']*')\s*/);if(!match)fail('MALFORMED_XML',`Malformed XML attribute text: ${rest.slice(0,80)}.`);const name=match[1],raw=match[2].slice(1,-1);if(hasOwn(attributes,name))fail('MALFORMED_XML',`Duplicate XML attribute ${name}.`);if(raw.includes('<'))fail('MALFORMED_XML',`XML attribute ${name} contains an unescaped less-than sign.`);const decoded=decodeXmlText(raw,`XML attribute ${name}`);if(byteLength(decoded)>LIMITS.maxXmlAttributeBytes)fail('XML_ATTRIBUTE_LIMIT',`XML attribute ${name} exceeds the registered byte limit.`);attributes[name]=decoded;count++;if(count>LIMITS.maxXmlAttributesPerElement)fail('XML_ATTRIBUTE_LIMIT','XML element exceeds the registered attribute-count limit.');if(name==='xmlns'||name.startsWith('xmlns:')){counters.namespaces++;if(counters.namespaces>LIMITS.maxXmlNamespaces)fail('XML_NAMESPACE_LIMIT','XML exceeds the registered namespace-declaration limit.');}rest=rest.slice(match[0].length);}
  return attributes;
}
function xmlTagClose(source,start){let quote=null;for(let index=start;index<source.length;index++){const ch=source[index];if(quote){if(ch===quote)quote=null;continue;}if(ch==='"'||ch==="'"){quote=ch;continue;}if(ch==='>')return index;}return -1;}
function parseXml(text){
  let source=String(text);if(byteLength(source)>LIMITS.maxTextBytes)fail('TEXT_BYTE_LIMIT','XML input exceeds the registered text-byte limit.');validateXmlCharacters(source,'XML source');if(/<!DOCTYPE|<!ENTITY/i.test(source))fail('UNSAFE_XML','DTD and entity declarations are prohibited.');source=source.replace(/^\uFEFF?\s*<\?xml\s[^?]*\?>\s*/i,'');
  const documentNode={name:'#document',attributes:Object.create(null),children:[],textParts:[],content:[]},stack=[documentNode],counters={nodes:0,namespaces:0,totalTextBytes:0};let index=0;
  const appendText=(raw,location='XML text')=>{if(!raw)return;if(raw.includes(']]>'))fail('MALFORMED_XML','XML text cannot contain the CDATA closing sequence.');const value=decodeXmlText(raw,location);if(byteLength(value)>LIMITS.maxXmlTextNodeBytes)fail('XML_TEXT_LIMIT','XML text node exceeds the registered byte limit.');counters.totalTextBytes+=byteLength(value);if(counters.totalTextBytes>LIMITS.maxXmlTotalTextBytes)fail('XML_TEXT_LIMIT','XML total text exceeds the registered byte limit.');stack.at(-1).textParts.push(value);stack.at(-1).content.push({kind:'text',value});};
  while(index<source.length){const open=source.indexOf('<',index);if(open<0){appendText(source.slice(index));break;}appendText(source.slice(index,open));
    if(source.startsWith('<!--',open)){const end=source.indexOf('-->',open+4);if(end<0)fail('MALFORMED_XML','Unterminated XML comment.');if(source.slice(open+4,end).includes('--'))fail('MALFORMED_XML','XML comments cannot contain --.');index=end+3;continue;}
    if(source.startsWith('<![CDATA[',open)){const end=source.indexOf(']]>',open+9);if(end<0)fail('MALFORMED_XML','Unterminated XML CDATA section.');const value=source.slice(open+9,end);validateXmlCharacters(value,'XML CDATA');if(byteLength(value)>LIMITS.maxXmlTextNodeBytes)fail('XML_TEXT_LIMIT','XML CDATA exceeds the registered text-node limit.');counters.totalTextBytes+=byteLength(value);if(counters.totalTextBytes>LIMITS.maxXmlTotalTextBytes)fail('XML_TEXT_LIMIT','XML total text exceeds the registered byte limit.');stack.at(-1).textParts.push(value);stack.at(-1).content.push({kind:'text',value});index=end+3;continue;}
    if(source.startsWith('<?',open))fail('UNSAFE_XML','XML processing instructions are not supported.');const close=xmlTagClose(source,open+1);if(close<0)fail('MALFORMED_XML','Unterminated XML tag.');let body=source.slice(open+1,close).trim();if(body.startsWith('!'))fail('UNSAFE_XML','Unsupported XML declaration.');
    if(body.startsWith('/')){const name=body.slice(1).trim();if(!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(name)||stack.length===1||stack.at(-1).name!==name)fail('MALFORMED_XML',`Unexpected XML closing tag ${name}.`);stack.pop();index=close+1;continue;}
    const selfClosing=/\/$/.test(body);if(selfClosing)body=body.slice(0,-1).trim();const nameMatch=body.match(/^([A-Za-z_][A-Za-z0-9_.:-]*)/);if(!nameMatch)fail('MALFORMED_XML','XML element name is invalid.');const node={name:nameMatch[1],attributes:parseXmlAttributes(body.slice(nameMatch[0].length),counters),children:[],textParts:[],content:[]};stack.at(-1).children.push(node);stack.at(-1).content.push({kind:'element',node});counters.nodes++;if(counters.nodes>LIMITS.maxXmlNodes)fail('XML_NODE_LIMIT','XML exceeds the registered node limit.');if(stack.length>LIMITS.maxXmlDepth)fail('XML_DEPTH_LIMIT','XML exceeds the registered depth limit.');if(!selfClosing)stack.push(node);index=close+1;
  }
  if(stack.length!==1)fail('MALFORMED_XML',`Unclosed XML element ${stack.at(-1).name}.`);if(documentNode.children.length!==1)fail('MALFORMED_XML','XML must contain exactly one document element.');if(documentNode.textParts.some(value=>value.trim()))fail('MALFORMED_XML','XML contains non-whitespace text outside the document element.');return documentNode.children[0];
}
function parseXmlSelector(path){
  const text=String(path||'');assertUnicodeScalars(text,'XML selector');if(!text.startsWith('/')||text.startsWith('//'))fail('UNSUPPORTED_XML_SELECTOR','XML selector must be an absolute qualified-name child path beginning with one /.');const raw=text.slice(1).split('/');if(!raw.length||raw.some(part=>!part))fail('UNSUPPORTED_XML_SELECTOR','XML selector contains an empty segment.');if(raw.length>LIMITS.maxSelectorDepth)fail('SELECTOR_LIMIT','XML selector exceeds the registered depth limit.');return raw.map((part,index)=>{if(part==='text()'){if(index!==raw.length-1)fail('UNSUPPORTED_XML_SELECTOR','text() is supported only as the final XML selector segment.');return {kind:'text'};}if(part.startsWith('@')){if(index!==raw.length-1||!/^@[A-Za-z_][A-Za-z0-9_.:-]*$/.test(part))fail('UNSUPPORTED_XML_SELECTOR','XML attributes are supported only as a valid final @qualifiedName segment.');return {kind:'attribute',name:part.slice(1)};}const match=part.match(/^([A-Za-z_][A-Za-z0-9_.:-]*)(?:\[(\d+)\])?$/);if(!match||match[2]==='0'||(match[2]&&Number(match[2])>Number.MAX_SAFE_INTEGER))fail('UNSUPPORTED_XML_SELECTOR',`Unsupported XML selector segment ${part}.`);return {kind:'element',name:match[1],index:match[2]?Number(match[2]):null};});
}
function xmlText(node){return node.content.map(item=>item.kind==='text'?item.value:xmlText(item.node)).join('');}
function selectXml(rootNode,path){const parts=parseXmlSelector(path),first=parts.shift();if(first.kind!=='element'||first.name!==rootNode.name||(first.index&&first.index!==1))fail('XML_PATH_MISSING',`XML selector does not address document element ${rootNode.name}.`,STATUS.UNDETERMINED);let current=[rootNode];for(const part of parts){if(part.kind==='text')return current.map(xmlText);if(part.kind==='attribute')return current.map(node=>node.attributes[part.name]).filter(value=>value!==undefined);const next=[];for(const node of current){const matches=node.children.filter(child=>child.name===part.name);if(part.index){if(matches[part.index-1])next.push(matches[part.index-1]);}else next.push(...matches);}current=next;}if(!current.length)fail('XML_PATH_MISSING',`XML selector does not resolve: ${path}.`,STATUS.UNDETERMINED);return current;}

function inspectStructure(value){let nodes=0,maxDepth=0;const seen=new Set(),stack=[{value,depth:1}];while(stack.length){const item=stack.pop();nodes++;maxDepth=Math.max(maxDepth,item.depth);if(nodes>LIMITS.maxParsedNodes)fail('PARSED_NODE_LIMIT','Parsed structure exceeds the registered node limit.');if(maxDepth>LIMITS.maxParsedDepth)fail('PARSED_DEPTH_LIMIT','Parsed structure exceeds the registered depth limit.');const current=item.value;if(typeof current==='string'&&byteLength(current)>LIMITS.maxCanonicalStringBytes)fail('STRING_LIMIT','Parsed string exceeds the registered byte limit.');if(!current||typeof current!=='object'||seen.has(current))continue;seen.add(current);if(Array.isArray(current)){if(current.length>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT','Parsed array exceeds the registered collection limit.');for(const child of current)stack.push({value:child,depth:item.depth+1});}else{const values=Object.values(current);if(values.length>LIMITS.maxJsonObjectMembers)fail('OBJECT_MEMBER_LIMIT','Parsed object exceeds the registered member limit.');for(const child of values)stack.push({value:child,depth:item.depth+1});}}return {nodes,maxDepth};}

function parseCsv(text,configuration){
  const {delimiter,header,quote,quoteEscaping,newline,emptyLinePolicy,columnCountPolicy,encoding}=configuration;if(encoding!=='UTF-8')fail('UNSUPPORTED_ENCODING','Version 1 CSV supports UTF-8 only.');if(quoteEscaping!=='DOUBLE_QUOTE')fail('UNSUPPORTED_CSV_CONTRACT','Version 1 CSV supports DOUBLE_QUOTE escaping only.');const source=String(text);if(source.length>LIMITS.maxCsvTotalCharacters||byteLength(source)>LIMITS.maxTextBytes)fail('CSV_TEXT_LIMIT','CSV exceeds the registered total-text limit.');assertUnicodeScalars(source,'CSV source');
  const rows=[];let row=[],cell='',quoted=false,afterQuote=false,cells=0,index=0,rowHadDelimiter=false,rowHadQuote=false;
  const newlineAt=position=>{if(newline==='LF')return source[position]==='\n'?1:0;if(newline==='CR')return source[position]==='\r'?1:0;if(newline==='CRLF')return source.startsWith('\r\n',position)?2:0;if(source.startsWith('\r\n',position))return 2;if(source[position]==='\n'||source[position]==='\r')return 1;return 0;};
  const pushCell=()=>{if(byteLength(cell)>LIMITS.maxCsvFieldBytes)fail('CSV_FIELD_LIMIT','CSV field exceeds the registered byte limit.');row.push(cell);cell='';cells++;if(cells>LIMITS.maxCsvCells)fail('CSV_CELL_LIMIT','CSV exceeds the registered cell limit.');if(row.length>LIMITS.maxCsvColumns)fail('CSV_COLUMN_LIMIT','CSV row exceeds the registered column limit.');afterQuote=false;};
  const pushRow=()=>{pushCell();const empty=!rowHadDelimiter&&!rowHadQuote&&row.length===1&&row[0]==='';if(empty&&emptyLinePolicy==='REJECT')fail('MALFORMED_CSV','CSV contains an empty line prohibited by its contract.');if(!(empty&&emptyLinePolicy==='SKIP'))rows.push(row);if(rows.length>LIMITS.maxCsvRows)fail('CSV_ROW_LIMIT','CSV exceeds the registered row limit.');row=[];rowHadDelimiter=false;rowHadQuote=false;};
  while(index<source.length){
    if(quoted){if(source.startsWith(quote+quote,index)){cell+=quote;index+=quote.length*2;continue;}if(source.startsWith(quote,index)){quoted=false;afterQuote=true;index+=quote.length;continue;}if(source[index]==='\r'||source[index]==='\n'){const width=newlineAt(index);if(!width)fail('MALFORMED_CSV','CSV contains a newline sequence outside the configured newline contract.');cell+=source.slice(index,index+width);index+=width;continue;}cell+=source[index++];continue;}
    if(afterQuote){if(source.startsWith(delimiter,index)){pushCell();rowHadDelimiter=true;index+=delimiter.length;continue;}const width=newlineAt(index);if(width){pushRow();index+=width;continue;}fail('MALFORMED_CSV','Characters after a closing quote must be a delimiter, configured newline, or end of input.');}
    if(source.startsWith(quote,index)){if(cell.length)fail('MALFORMED_CSV','CSV quote begins inside an unquoted field.');quoted=true;rowHadQuote=true;index+=quote.length;continue;}
    if(source.startsWith(delimiter,index)){pushCell();rowHadDelimiter=true;index+=delimiter.length;continue;}const width=newlineAt(index);if(width){pushRow();index+=width;continue;}if(source[index]==='\r'||source[index]==='\n')fail('MALFORMED_CSV','CSV contains a newline sequence outside the configured newline contract.');cell+=source[index++];
  }
  if(quoted)fail('MALFORMED_CSV','CSV has an unterminated quoted field.');if(source.length&&(!(source.endsWith('\n')||source.endsWith('\r'))||cell.length||row.length||afterQuote||rowHadDelimiter||rowHadQuote))pushRow();
  const expectedColumns=rows.length?rows[0].length:0;if(columnCountPolicy==='STRICT')for(let rowIndex=0;rowIndex<rows.length;rowIndex++)if(rows[rowIndex].length!==expectedColumns)fail('MALFORMED_CSV',`CSV row ${rowIndex+1} has ${rows[rowIndex].length} cells; expected ${expectedColumns}.`);
  if(!header)return rows;if(!rows.length)return [];const names=rows.shift();if(new Set(names).size!==names.length||names.some(name=>name===''))fail('MALFORMED_CSV','CSV header names must be unique and nonempty.');return rows.map((values,rowIndex)=>{if(values.length!==names.length)fail('MALFORMED_CSV',`CSV row ${rowIndex+2} has ${values.length} cells; expected ${names.length}.`);return Object.fromEntries(names.map((name,column)=>[name,values[column]]));});
}

function canonicalIntegerText(text){const value=String(text);if(!/^-?(?:0|[1-9]\d*)$/.test(value)||value==='-0')return null;if(value.replace('-','').length>LIMITS.maxExactNumericDigits)return null;return value;}
function canonicalDecimalText(text){const value=String(text);if(!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)||/^-0(?:\.0+)?$/.test(value))return null;if(value.replace(/[-.]/g,'').length>LIMITS.maxExactNumericDigits)return null;return value;}
function exactNumber(value){
  if(typeof value==='number'){if(!Number.isSafeInteger(value)||Object.is(value,-0))return null;return {kind:'INTEGER',coefficient:BigInt(value),scale:0,canonical:String(value)};}
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['numberType','value'].includes(key))||typeof value.value!=='string')return null;
  if(value.numberType==='INTEGER'){const text=canonicalIntegerText(value.value);if(text===null)return null;return {kind:'INTEGER',coefficient:BigInt(text),scale:0,canonical:text};}
  if(value.numberType==='DECIMAL'){const text=canonicalDecimalText(value.value);if(text===null)return null;const negative=text.startsWith('-'),unsigned=negative?text.slice(1):text,[whole,fraction='']=unsigned.split('.'),coefficient=BigInt((negative?'-':'')+whole+fraction);return {kind:'DECIMAL',coefficient,scale:fraction.length,canonical:text};}
  return null;
}
function exactNonnegative(value){const number=exactNumber(value);return Boolean(number&&number.coefficient>=0n);}
const pow10=power=>10n**BigInt(power);
function alignNumbers(left,right){const scale=Math.max(left.scale,right.scale);return {left:left.coefficient*pow10(scale-left.scale),right:right.coefficient*pow10(scale-right.scale),scale};}
function compareExactNumbers(left,right){const aligned=alignNumbers(left,right);return aligned.left===aligned.right?0:aligned.left<aligned.right?-1:1;}
function absoluteExact(value){return {...value,coefficient:value.coefficient<0n?-value.coefficient:value.coefficient};}
function subtractExact(left,right){const aligned=alignNumbers(left,right);return {kind:'DECIMAL',coefficient:aligned.left-aligned.right,scale:aligned.scale};}
function multiplyExact(left,right){const coefficient=left.coefficient*right.coefficient;if(coefficient.toString().replace('-','').length>LIMITS.maxExactNumericDigits*2)fail('NUMERIC_DIGIT_LIMIT','Exact numeric multiplication exceeds the registered digit limit.');return {kind:'DECIMAL',coefficient,scale:left.scale+right.scale};}
function approximateEqual(actual,expected,step){
  const a=exactNumber(actual),b=exactNumber(expected);if(!a||!b)fail('UNSUPPORTED_NUMERIC_PRECISION','Approximate comparison requires safe integers or typed exact INTEGER/DECIMAL values.',STATUS.UNDETERMINED);
  const hasAbs=hasOwn(step,'absTol')||hasOwn(step,'absoluteTolerance'),hasRel=hasOwn(step,'relTol')||hasOwn(step,'relativeTolerance');if(!hasAbs&&!hasRel)fail('INVALID_NUMERIC_TOLERANCE','Approximate comparison requires an absTol tolerance, a relTol tolerance, or both.');
  const absValue=hasOwn(step,'absTol')?step.absTol:step.absoluteTolerance,relValue=hasOwn(step,'relTol')?step.relTol:step.relativeTolerance,zero={kind:'DECIMAL',coefficient:0n,scale:0},abs=hasAbs?exactNumber(absValue):zero,rel=hasRel?exactNumber(relValue):zero;if(!abs||!rel||abs.kind!=='DECIMAL'||rel.kind!=='DECIMAL'||abs.coefficient<0n||rel.coefficient<0n)fail('INVALID_NUMERIC_TOLERANCE','Approximate tolerances must be exact nonnegative DECIMAL values.');
  const difference=absoluteExact(subtractExact(a,b)),magnitude=compareExactNumbers(absoluteExact(a),absoluteExact(b))>=0?absoluteExact(a):absoluteExact(b),relative=multiplyExact(rel,magnitude),limit=compareExactNumbers(abs,relative)>=0?abs:relative;return compareExactNumbers(difference,limit)<=0;
}
function exactEqual(actual,expected,step={}){
  const mode=step.numericMode;if(mode==='APPROXIMATE')return approximateEqual(actual,expected,step);
  if(mode==='INTEGER'||mode==='DECIMAL_STRING'){const a=exactNumber(actual),b=exactNumber(expected);if(!a||!b||(mode==='INTEGER'&&(a.scale||b.scale)))fail('UNSUPPORTED_NUMERIC_PRECISION',`${mode} comparison requires the corresponding exact typed values.`,STATUS.UNDETERMINED);return compareExactNumbers(a,b)===0;}
  if(typeof actual==='number'||typeof expected==='number'){if(!Number.isSafeInteger(actual)||!Number.isSafeInteger(expected)||Object.is(actual,-0)||Object.is(expected,-0))fail('UNSUPPORTED_NUMERIC_PRECISION','Exact numeric equality supports only safe integers unless an exact numeric mode is explicit.',STATUS.UNDETERMINED);return actual===expected;}
  return canonical(actual)===canonical(expected);
}
function orderedCompare(actual,expected){
  const a=exactNumber(actual),b=exactNumber(expected);if(a&&b)return compareExactNumbers(a,b);
  if(typeof actual==='string'&&typeof expected==='string')return scalarCompare(actual,expected);
  if(typeof actual==='boolean'&&typeof expected==='boolean')return actual===expected?0:actual?1:-1;
  fail('ORDER_DOMAIN_MISMATCH','Ordered comparison requires two exact numeric values, two strings, or two Booleans.',STATUS.UNDETERMINED);
}
function collection(value,op){if(!Array.isArray(value))fail('COLLECTION_REQUIRED',`${op} requires an array.`);if(value.length>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT',`${op} input exceeds the registered collection limit.`);return value;}
function typeTag(value){return value===null?'null':bytesOf(value)?'bytes':Array.isArray(value)?'array':typeof value;}
function canonicalEqualityKey(value){const number=exactNumber(value);if(number)return `${number.kind}:${number.canonical}`;return `${typeTag(value)}:${canonical(value)}`;}
function sortComparator(type){
  return (left,right)=>{
    if(type==='STRING'){if(typeof left!=='string'||typeof right!=='string')fail('SORT_DOMAIN_MISMATCH','SORT STRING requires a homogeneous string collection.');return scalarCompare(left,right);}
    if(type==='BOOLEAN'){if(typeof left!=='boolean'||typeof right!=='boolean')fail('SORT_DOMAIN_MISMATCH','SORT BOOLEAN requires a homogeneous Boolean collection.');return left===right?0:left?1:-1;}
    if(type==='INTEGER'){const a=exactNumber(left),b=exactNumber(right);if(!a||!b||a.scale||b.scale)fail('SORT_DOMAIN_MISMATCH','SORT INTEGER requires exact integer values.');return compareExactNumbers(a,b);}
    if(type==='DECIMAL'){const a=exactNumber(left),b=exactNumber(right);if(!a||!b)fail('SORT_DOMAIN_MISMATCH','SORT DECIMAL requires exact numeric values.');return compareExactNumbers(a,b);}
    if(type==='CANONICAL_JSON')return scalarCompare(canonical(left),canonical(right));
    fail('SORT_DOMAIN_MISMATCH',`Unsupported SORT domain ${type}.`);
  };
}

function validateType(value,type){
  switch(type){
    case 'string':return typeof value==='string';case 'boolean':return typeof value==='boolean';case 'array':return Array.isArray(value);
    case 'binding':return typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(value);
    case 'delimiter':case 'quote':return typeof value==='string'&&[...value].length===1&&!['\r','\n'].includes(value)&&value.length>0;
    case 'quoteEscaping':return value==='DOUBLE_QUOTE';case 'emptyLinePolicy':return ['KEEP','SKIP','REJECT'].includes(value);case 'columnCountPolicy':return ['STRICT','VARIABLE'].includes(value);
    case 'csvNewline':return ['AUTO','LF','CRLF','CR'].includes(value);case 'utf8':return value==='UTF-8';case 'sortDirection':return ['ASC','DESC'].includes(value);case 'sortValueType':return ['STRING','INTEGER','DECIMAL','BOOLEAN','CANONICAL_JSON'].includes(value);
    case 'regex':case 'regexFlags':return typeof value==='string';case 'jsonSelector':try{parseJsonSelector(value);return true;}catch{return false;}case 'xmlSelector':try{parseXmlSelector(value);return true;}catch{return false;}
    case 'compareOperator':return ['EQ','NE','GT','GTE','LT','LTE'].includes(value);case 'numericMode':return ['INTEGER','DECIMAL_STRING','APPROXIMATE'].includes(value);case 'exactNonnegative':return exactNonnegative(value);case 'exactNonnegativeDecimal':{const normalized=typeof value==='string'?{numberType:'DECIMAL',value}:value,number=exactNumber(normalized);return Boolean(number&&number.kind==='DECIMAL'&&number.coefficient>=0n);}default:return true;
  }
}
function validateStep(step,index){
  const issues=[];if(!step||typeof step!=='object'||Array.isArray(step))return [`Step ${index} must be an object.`];const definition=OP_DEFINITIONS[step.op];if(!definition)return [`Step ${index} uses unknown operation ${String(step.op)}.`];const allowed=new Set(['op',...definition.required,...definition.optional]);for(const key of Object.keys(step))if(!allowed.has(key))issues.push(`Step ${index} operation ${step.op} contains unknown property ${key}.`);for(const key of definition.required)if(!hasOwn(step,key))issues.push(`Step ${index} operation ${step.op} is missing required property ${key}.`);for(const [key,type] of Object.entries(definition.types||{}))if(hasOwn(step,key)&&!validateType(step[key],type))issues.push(`Step ${index} operation ${step.op} has invalid ${key}.`);if(definition.oneOf){const present=definition.oneOf.filter(group=>group.every(key=>hasOwn(step,key)));if(present.length!==1)issues.push(`Step ${index} operation ${step.op} requires exactly one of ${definition.oneOf.map(group=>group.join('+')).join(' or ')}.`);}if((step.op==='REGEX'||step.op==='ASSERT_MATCH')&&typeof step.pattern==='string')issues.push(...validateRegex(step.pattern,step.flags).map(message=>`Step ${index}: ${message}`));const toleranceKeys=['absTol','relTol','absoluteTolerance','relativeTolerance'],hasTolerance=toleranceKeys.some(key=>hasOwn(step,key));if(hasOwn(step,'absTol')&&hasOwn(step,'absoluteTolerance'))issues.push(`Step ${index} provides both absTol and its compatibility alias absoluteTolerance.`);if(hasOwn(step,'relTol')&&hasOwn(step,'relativeTolerance'))issues.push(`Step ${index} provides both relTol and its compatibility alias relativeTolerance.`);if(['COMPARE','ASSERT_EQ'].includes(step.op)&&step.numericMode==='APPROXIMATE'&&!hasTolerance)issues.push(`Step ${index} approximate comparison requires an absTol tolerance, a relTol tolerance, or both.`);if(['COMPARE','ASSERT_EQ'].includes(step.op)&&step.numericMode!=='APPROXIMATE'&&hasTolerance)issues.push(`Step ${index} tolerances require APPROXIMATE numericMode.`);if(step.op==='COMPARE'&&!['EQ','NE'].includes(step.operator)&&(hasOwn(step,'numericMode')||hasTolerance))issues.push(`Step ${index} COMPARE numericMode and tolerances are supported only for EQ or NE.`);if(step.op==='PARSE_CSV'&&step.delimiter===step.quote)issues.push(`Step ${index} CSV delimiter and quote must differ.`);if(step.op==='PARSE_CSV'&&step.header&&step.columnCountPolicy!=='STRICT')issues.push(`Step ${index} header CSV requires STRICT columnCountPolicy.`);try{validateCanonicalValue(step,`$.steps[${index}]`);}catch(error){issues.push(`Step ${index} is not canonical: ${error.message}`);}return issues;
}
function normalizedBinding(binding){return typeof binding==='string'?{kind:'ARTIFACT',artifactId:binding}:binding;}
function validateBindings(bindings){
  const issues=[];if(!bindings||typeof bindings!=='object'||Array.isArray(bindings))return {valid:false,issues:['EXECUTABLE_INPUT_BINDINGS must be a closed object.']};
  for(const [name,raw] of Object.entries(bindings)){
    if(!/^[A-Z][A-Z0-9_]{0,63}$/.test(name))issues.push(`Invalid Test IR binding name ${name}.`);const binding=normalizedBinding(raw);if(!binding||typeof binding!=='object'||Array.isArray(binding)){issues.push(`Binding ${name} must be an artifact ID string or a closed binding object.`);continue;}
    const allowed=new Set(['kind','artifactId','source','artifactRole','filename','expectedSha256','canonicalKey','valueSha256','jobId','projectRevision','scopeSha256']);for(const key of Object.keys(binding))if(!allowed.has(key))issues.push(`Binding ${name} contains unknown property ${key}.`);const kind=binding.kind||'ARTIFACT';if(!['ARTIFACT','CANONICAL_VALUE'].includes(kind))issues.push(`Binding ${name} has unsupported kind ${kind}.`);if(kind==='ARTIFACT'&&!binding.artifactId&&!binding.artifactRole&&!binding.filename)issues.push(`Binding ${name} does not identify an artifact.`);if(kind==='CANONICAL_VALUE'&&(typeof binding.canonicalKey!=='string'||!binding.canonicalKey.trim()))issues.push(`Binding ${name} does not identify an immutable canonical value.`);if(binding.source&&!['CURRENT_PRODUCT','CURRENT_SCOPE','EXPLICIT_ARTIFACT'].includes(binding.source))issues.push(`Binding ${name} has unsupported source ${binding.source}.`);if(hasOwn(binding,'artifactId')&&(typeof binding.artifactId!=='string'||!binding.artifactId))issues.push(`Binding ${name} artifactId is invalid.`);if(hasOwn(binding,'artifactRole')&&(typeof binding.artifactRole!=='string'||!binding.artifactRole))issues.push(`Binding ${name} artifactRole is invalid.`);if(hasOwn(binding,'filename')&&(typeof binding.filename!=='string'||!binding.filename||/[\0\r\n]/.test(binding.filename)))issues.push(`Binding ${name} filename is invalid.`);if(hasOwn(binding,'jobId')&&(typeof binding.jobId!=='string'||!binding.jobId))issues.push(`Binding ${name} jobId is invalid.`);if(hasOwn(binding,'projectRevision')&&(!Number.isSafeInteger(binding.projectRevision)||binding.projectRevision<0))issues.push(`Binding ${name} projectRevision must be a nonnegative safe integer.`);if(binding.expectedSha256&&!/^[0-9a-f]{64}$/.test(binding.expectedSha256))issues.push(`Binding ${name} expectedSha256 is invalid.`);if(binding.valueSha256&&!/^[0-9a-f]{64}$/.test(binding.valueSha256))issues.push(`Binding ${name} valueSha256 is invalid.`);if(binding.scopeSha256&&!/^[0-9a-f]{64}$/.test(binding.scopeSha256))issues.push(`Binding ${name} scopeSha256 is invalid.`);try{validateCanonicalValue(binding,`$.bindings.${name}`);}catch(error){issues.push(`Binding ${name} is not canonical: ${error.message}`);}
  }
  return {valid:issues.length===0,issues};
}
function validatePipeline(steps,bindings){
  const issues=[];let state='NONE';const definitions=bindings||{};
  const requireState=(allowed,index,op,dynamicAllowed=true)=>{if(allowed.includes(state))return;if(dynamicAllowed&&['ANY','JSON','CANONICAL_VALUE','UNKNOWN_BOUND_VALUE'].includes(state))return;issues.push(`Step ${index} operation ${op} cannot consume ${state}.`);};
  for(const [index,step] of steps.entries()){
    switch(step?.op){
      case 'LOAD_ARTIFACT':{const binding=normalizedBinding(definitions[step.binding]);state=binding?.kind==='CANONICAL_VALUE'?'CANONICAL_VALUE':binding?'BOUND_ARTIFACT':'UNKNOWN_BOUND_VALUE';break;}
      case 'READ_BYTES':requireState(['BOUND_ARTIFACT','BYTES','UNKNOWN_BOUND_VALUE'],index,step.op,false);state='BYTES';break;
      case 'DECODE_UTF8':requireState(['BYTES'],index,step.op,false);state='STRING';break;
      case 'PARSE_JSON':requireState(['STRING'],index,step.op);state='JSON';break;
      case 'PARSE_CSV':requireState(['STRING'],index,step.op);state='ARRAY';break;
      case 'PARSE_XML':requireState(['STRING'],index,step.op);state='XML';break;
      case 'SELECT_JSON_PATH':requireState(['JSON'],index,step.op);state='ANY';break;
      case 'SELECT_XML':requireState(['XML'],index,step.op);state='ARRAY';break;
      case 'COUNT':requireState(['ARRAY','STRING'],index,step.op);state='INTEGER';break;
      case 'SUM':case 'MIN':case 'MAX':case 'SORT':case 'UNIQUE':requireState(['ARRAY'],index,step.op);state=step.op==='SORT'||step.op==='UNIQUE'?'ARRAY':'ANY';break;
      case 'HASH_SHA256':requireState(['BYTES'],index,step.op,false);state='STRING';break;
      case 'REGEX':requireState(['STRING'],index,step.op);state='BOOLEAN';break;
      case 'COMPARE':requireState(['INTEGER','EXACT_NUMBER','STRING','BOOLEAN','ARRAY','JSON','CANONICAL_VALUE','ANY'],index,step.op);if(step.binding){const target=normalizedBinding(definitions[step.binding]);if(target&&target.kind!=='CANONICAL_VALUE')issues.push(`Step ${index} operation COMPARE binding ${step.binding} must be a CANONICAL_VALUE binding.`);}state='BOOLEAN';break;
      case 'BYTE_COMPARE':{requireState(['BYTES'],index,step.op,false);const target=normalizedBinding(definitions[step.binding]);if(target&&target.kind==='CANONICAL_VALUE')issues.push(`Step ${index} operation BYTE_COMPARE binding ${step.binding} must be an ARTIFACT binding.`);state='BOOLEAN';break;}
      case 'ASSERT_EQ':requireState(['INTEGER','EXACT_NUMBER','STRING','BOOLEAN','ARRAY','JSON','XML','CANONICAL_VALUE','ANY'],index,step.op);break;
      case 'ASSERT_GT':case 'ASSERT_GTE':case 'ASSERT_LT':case 'ASSERT_LTE':requireState(['INTEGER','EXACT_NUMBER','STRING','BOOLEAN'],index,step.op);break;
      case 'ASSERT_MATCH':requireState(['STRING'],index,step.op);break;
      case 'ASSERT_CONTAINS':case 'ASSERT_NOT_CONTAINS':requireState(['ARRAY','STRING'],index,step.op);break;
      case 'ASSERT_SET_EQUAL':requireState(['ARRAY'],index,step.op);break;
    }
  }
  return issues;
}
function validateSpec(spec,bindings){
  const issues=[];if(!spec||typeof spec!=='object'||Array.isArray(spec))return {valid:false,issues:['Test IR must be an object.']};for(const key of Object.keys(spec))if(!['version','steps'].includes(key))issues.push(`Test IR contains unknown root property ${key}.`);if(spec.version!==SPEC_VERSION)issues.push(`Unsupported Test IR version ${String(spec.version)}.`);if(!Array.isArray(spec.steps)||!spec.steps.length)issues.push('Test IR requires a nonempty steps array.');if((spec.steps?.length||0)>LIMITS.maxSteps)issues.push(`Test IR exceeds the ${LIMITS.maxSteps}-step limit.`);for(const [index,step] of (spec.steps||[]).entries())issues.push(...validateStep(step,index));if(Array.isArray(spec.steps)&&spec.steps.length&&!spec.steps.some(step=>ASSERTION_OPS.has(step?.op)))issues.push('Test IR must contain at least one registered assertion operation.');if(bindings!==undefined){const bindingResult=validateBindings(bindings);issues.push(...bindingResult.issues);const declared=new Set(Object.keys(bindings||{})),used=new Set();for(const [index,step] of (spec.steps||[]).entries())if(step&&typeof step.binding==='string'){used.add(step.binding);if(!declared.has(step.binding))issues.push(`Step ${index} references undeclared binding ${step.binding}.`);}for(const name of declared)if(!used.has(name))issues.push(`Binding ${name} is declared but unused by Test IR.`);}if(Array.isArray(spec.steps))issues.push(...validatePipeline(spec.steps,bindings));try{validateCanonicalValue(spec);const size=byteLength(canonical(spec));if(size>LIMITS.maxSpecBytes)issues.push('Test IR exceeds the registered specification byte limit.');}catch(error){issues.push(`Test IR is not canonical: ${error.message}`);}return {valid:issues.length===0,issues};
}
function normalizeSpec(spec,bindings){const check=validateSpec(spec,bindings);if(!check.valid)fail('INVALID_TEST_IR',check.issues.join(' '));const normalized=JSON.parse(canonical(spec));for(const step of normalized.steps){if(hasOwn(step,'absoluteTolerance')){step.absTol=step.absoluteTolerance;delete step.absoluteTolerance;}if(hasOwn(step,'relativeTolerance')){step.relTol=step.relativeTolerance;delete step.relativeTolerance;}for(const key of ['absTol','relTol'])if(typeof step[key]==='string')step[key]={numberType:'DECIMAL',value:step[key]};}return JSON.parse(canonical(normalized));}
function supports(test){if(String(field(test,'EXECUTION_MODE')||'').toUpperCase()!=='APPLICATION_DETERMINISTIC')return false;if(String(field(test,'REQUIRED_CAPABILITY')||'').toUpperCase()!==CAPABILITY)return false;if(String(field(test,'EXECUTABLE_KIND')||'').toUpperCase()!==EXECUTABLE_KIND)return false;if(field(test,'EXECUTABLE_SPEC_VERSION')!==SPEC_VERSION)return false;return validateSpec(field(test,'EXECUTABLE_SPEC'),field(test,'EXECUTABLE_INPUT_BINDINGS')).valid;}

async function verifyExecutionInputs(bindingDefinitions,artifacts,canonicalBindings){
  const bindingCheck=validateBindings(bindingDefinitions);if(!bindingCheck.valid)fail('INVALID_BINDINGS',bindingCheck.issues.join(' '));const declaredNames=new Set(Object.keys(bindingDefinitions));for(const name of Object.keys(artifacts||{}))if(!declaredNames.has(name))fail('UNDECLARED_ARTIFACT_INPUT',`Artifact input ${name} is not declared.`);for(const name of Object.keys(canonicalBindings||{}))if(!declaredNames.has(name))fail('UNDECLARED_CANONICAL_INPUT',`Canonical input ${name} is not declared.`);
  const verifiedArtifacts={},verifiedCanonical={},inputArtifactBindings=[],canonicalInputBindings=[];let totalInputBytes=0;
  for(const [name,rawDefinition] of Object.entries(bindingDefinitions)){
    const definition=normalizedBinding(rawDefinition),kind=definition.kind||'ARTIFACT';
    if(kind==='ARTIFACT'){
      if(!hasOwn(artifacts||{},name)||hasOwn(canonicalBindings||{},name))fail('ARTIFACT_BINDING_MISSING',`Binding ${name} requires one artifact input.`);const artifact=artifacts[name];if(!artifact||typeof artifact!=='object'||Array.isArray(artifact))fail('INVALID_ARTIFACT_INPUT',`Binding ${name} requires a closed artifact object.`);const allowed=new Set(['artifactId','filename','sha256','byteSize','bytes','mediaType','jobId','projectRevision','scopeSha256','source','artifactRole']);for(const key of Object.keys(artifact))if(!allowed.has(key))fail('INVALID_ARTIFACT_INPUT',`Artifact input ${name} contains unknown property ${key}.`);const bytes=bytesOf(artifact.bytes);if(!bytes)fail('BYTES_REQUIRED',`Artifact binding ${name} has no bytes.`);totalInputBytes+=bytes.byteLength;if(totalInputBytes>LIMITS.maxTotalInputBytes)fail('INPUT_BYTE_LIMIT','Artifact inputs exceed the registered total-input limit.');const artifactId=String(artifact.artifactId||''),filename=String(artifact.filename||''),declaredHash=String(artifact.sha256||'').toLowerCase(),expectedHash=String(definition.expectedSha256||'').toLowerCase();if(!artifactId)fail('ARTIFACT_ID_REQUIRED',`Artifact binding ${name} has no artifact identity.`);if(!filename||/[\0\r\n]/.test(filename))fail('ARTIFACT_FILENAME_REQUIRED',`Artifact binding ${name} requires a safe filename.`);if(definition.artifactId&&artifactId!==String(definition.artifactId))fail('ARTIFACT_ID_MISMATCH',`Artifact binding ${name} expected ${definition.artifactId} but received ${artifactId}.`);if(definition.filename&&filename!==String(definition.filename))fail('ARTIFACT_FILENAME_MISMATCH',`Artifact binding ${name} expected filename ${definition.filename} but received ${filename}.`);if(definition.artifactRole&&String(artifact.artifactRole||'')!==String(definition.artifactRole))fail('ARTIFACT_ROLE_MISMATCH',`Artifact binding ${name} does not match role ${definition.artifactRole}.`);if(definition.source&&String(artifact.source||'')!==String(definition.source))fail('ARTIFACT_SOURCE_MISMATCH',`Artifact binding ${name} does not match source ${definition.source}.`);if(!/^[0-9a-f]{64}$/.test(declaredHash))fail('ARTIFACT_HASH_REQUIRED',`Artifact binding ${name} requires a lowercase application-computed SHA-256.`);const calculated=await sha256(bytes);if(declaredHash!==calculated||expectedHash&&expectedHash!==calculated)fail('ARTIFACT_HASH_MISMATCH',`Artifact ${artifactId} bytes do not match the bound SHA-256.`);if(hasOwn(artifact,'byteSize')&&(!Number.isSafeInteger(artifact.byteSize)||artifact.byteSize!==bytes.byteLength))fail('ARTIFACT_SIZE_MISMATCH',`Artifact ${artifactId} byte size does not match its bytes.`);if(definition.jobId&&String(artifact.jobId||'')!==String(definition.jobId))fail('CROSS_PROJECT_ARTIFACT_BINDING',`Artifact ${artifactId} does not belong to the bound project.`);if(hasOwn(definition,'projectRevision')&&artifact.projectRevision!==definition.projectRevision)fail('STALE_ARTIFACT_BINDING',`Artifact ${artifactId} does not match project revision ${definition.projectRevision}.`);if(definition.scopeSha256&&String(artifact.scopeSha256||'')!==String(definition.scopeSha256))fail('STALE_ARTIFACT_BINDING',`Artifact ${artifactId} is outside the bound scope.`);verifiedArtifacts[name]={...artifact,bytes,sha256:calculated,byteSize:bytes.byteLength};inputArtifactBindings.push({binding:name,artifactId,filename,byteSize:bytes.byteLength,sha256:calculated,projectRevision:artifact.projectRevision??null,scopeSha256:artifact.scopeSha256||null});
    }else{
      if(!hasOwn(canonicalBindings||{},name)||hasOwn(artifacts||{},name))fail('CANONICAL_BINDING_MISSING',`Binding ${name} requires one immutable canonical input.`);const input=canonicalBindings[name];if(!input||typeof input!=='object'||Array.isArray(input))fail('INVALID_CANONICAL_INPUT',`Binding ${name} requires a closed canonical input object.`);const allowed=new Set(['canonicalKey','value','valueSha256','jobId','projectRevision','scopeSha256']);for(const key of Object.keys(input))if(!allowed.has(key))fail('INVALID_CANONICAL_INPUT',`Canonical input ${name} contains unknown property ${key}.`);if(String(input.canonicalKey||'')!==String(definition.canonicalKey||''))fail('CANONICAL_KEY_MISMATCH',`Canonical input ${name} does not match ${definition.canonicalKey}.`);validateCanonicalValue(input.value,`canonicalBindings.${name}.value`);const serialized=canonical(input.value),size=byteLength(serialized);totalInputBytes+=size;if(totalInputBytes>LIMITS.maxTotalInputBytes)fail('INPUT_BYTE_LIMIT','Canonical inputs exceed the registered total-input limit.');const declaredHash=String(input.valueSha256||'').toLowerCase(),expectedHash=String(definition.valueSha256||'').toLowerCase();if(!/^[0-9a-f]{64}$/.test(declaredHash))fail('CANONICAL_VALUE_HASH_REQUIRED',`Canonical input ${name} requires a lowercase application-computed value hash.`);const calculated=await sha256(encoder.encode(serialized));if(declaredHash!==calculated||expectedHash&&expectedHash!==calculated)fail('CANONICAL_VALUE_HASH_MISMATCH',`Canonical input ${name} does not match its bound value hash.`);if(definition.jobId&&String(input.jobId||'')!==String(definition.jobId))fail('CROSS_PROJECT_CANONICAL_BINDING',`Canonical input ${name} does not belong to the bound project.`);if(hasOwn(definition,'projectRevision')&&input.projectRevision!==definition.projectRevision)fail('STALE_CANONICAL_BINDING',`Canonical input ${name} does not match project revision ${definition.projectRevision}.`);if(definition.scopeSha256&&String(input.scopeSha256||'')!==String(definition.scopeSha256))fail('STALE_CANONICAL_BINDING',`Canonical input ${name} is outside the bound scope.`);verifiedCanonical[name]={...input,valueSha256:calculated};canonicalInputBindings.push({binding:name,canonicalKey:String(input.canonicalKey),canonicalByteLength:size,valueSha256:calculated,projectRevision:input.projectRevision??null,scopeSha256:input.scopeSha256||null});
    }
  }
  const envelope=validateResourceEnvelope({totalInputBytes});if(!envelope.valid)fail('INPUT_BYTE_LIMIT',envelope.issues.join(' '));return {artifacts:verifiedArtifacts,canonicalBindings:verifiedCanonical,inputArtifactBindings,canonicalInputBindings,totalInputBytes};
}
function resolveBinding(name,artifacts,canonicalBindings){if(hasOwn(artifacts||{},name))return {kind:'ARTIFACT',value:artifacts[name]};if(hasOwn(canonicalBindings||{},name))return {kind:'CANONICAL_VALUE',value:canonicalBindings[name]};fail('MISSING_BINDING',`Required binding ${name} is unavailable.`);}
function valueFromBinding(name,artifacts,canonicalBindings){const resolved=resolveBinding(name,artifacts,canonicalBindings);return resolved.kind==='ARTIFACT'?(resolved.value?.value??resolved.value):resolved.value?.value;}
function resultForAssertion(ok,expected,actual,message){return {determination:ok?STATUS.SATISFIED:STATUS.VIOLATED,expected,actual,message:message||null};}

async function execute({spec,artifacts={},canonicalBindings={},metadata={}}){
  const bindings=metadata.bindings,normalized=normalizeSpec(spec,bindings),verified=await verifyExecutionInputs(bindings,artifacts,canonicalBindings);artifacts=verified.artifacts;canonicalBindings=verified.canonicalBindings;
  let value=null,current=null,finalAssertion=null;const observations=[];const parserIdentities=[];
  for(const [index,step] of normalized.steps.entries()){
    let assertion=null;
    switch(step.op){
      case 'LOAD_ARTIFACT':{const resolved=resolveBinding(step.binding,artifacts,canonicalBindings);current=resolved;value=resolved.kind==='CANONICAL_VALUE'?resolved.value.value:resolved.value;observations.push(resolved.kind==='ARTIFACT'?{step:index,op:step.op,binding:step.binding,bindingKind:'ARTIFACT',artifactId:resolved.value.artifactId,filename:resolved.value.filename,sha256:resolved.value.sha256}:{step:index,op:step.op,binding:step.binding,bindingKind:'CANONICAL_VALUE',canonicalKey:resolved.value.canonicalKey,valueSha256:resolved.value.valueSha256});break;}
      case 'READ_BYTES':{const bytes=bytesOf(current?.kind==='ARTIFACT'?current.value.bytes:value);if(!bytes)fail('BYTES_REQUIRED','READ_BYTES requires a byte-backed artifact binding.');value=bytes;observations.push({step:index,op:step.op,byteLength:bytes.byteLength});break;}
      case 'DECODE_UTF8':{const bytes=bytesOf(value);if(!bytes)fail('BYTES_REQUIRED','DECODE_UTF8 requires bytes.');if(bytes.byteLength>LIMITS.maxTextBytes)fail('TEXT_BYTE_LIMIT','UTF-8 input exceeds the registered text-byte limit.');if(bytes.byteLength>LIMITS.maxDecompressedBytes)fail('DECOMPRESSED_BYTE_LIMIT','UTF-8 input exceeds the registered decompressed-byte limit.');try{value=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('INVALID_UTF8','Input is not valid UTF-8.',STATUS.UNDETERMINED);}assertUnicodeScalars(value,'UTF-8 text');break;}
      case 'PARSE_JSON':value=parseJson(value);parserIdentities.push(PARSER_IDENTITIES.JSON);break;
      case 'PARSE_CSV':value=parseCsv(value,step);inspectStructure(value);parserIdentities.push(PARSER_IDENTITIES.CSV);break;
      case 'PARSE_XML':value=parseXml(value);parserIdentities.push(PARSER_IDENTITIES.XML);break;
      case 'SELECT_JSON_PATH':value=selectJsonPath(value,step.path);parserIdentities.push(PARSER_IDENTITIES.JSON_SELECTOR);break;
      case 'SELECT_XML':value=selectXml(value,step.path);parserIdentities.push(PARSER_IDENTITIES.XML_SELECTOR);break;
      case 'COUNT':{if(Array.isArray(value))value=value.length;else if(typeof value==='string')value=[...value].length;else fail('COUNT_INPUT','COUNT requires an array or string.',STATUS.UNDETERMINED);break;}
      case 'SUM':{const values=collection(value,'SUM').map(item=>{const number=exactNumber(item);if(!number||number.scale)fail('UNSUPPORTED_NUMERIC_PRECISION','SUM supports exact integers only.',STATUS.UNDETERMINED);return number;});let sum=0n;for(const item of values){sum+=item.coefficient;if(sum.toString().replace('-','').length>LIMITS.maxExactNumericDigits)fail('INTEGER_OVERFLOW','SUM exceeded the registered exact-integer digit limit.',STATUS.UNDETERMINED);}value=sum>=BigInt(Number.MIN_SAFE_INTEGER)&&sum<=BigInt(Number.MAX_SAFE_INTEGER)?Number(sum):{numberType:'INTEGER',value:String(sum)};break;}
      case 'MIN':case 'MAX':{const values=collection(value,step.op);if(!values.length)fail('EMPTY_COLLECTION',`${step.op} requires a nonempty collection.`,STATUS.UNDETERMINED);for(const item of values)if(!exactNumber(item))fail('UNSUPPORTED_NUMERIC_PRECISION',`${step.op} supports exact numeric values only.`,STATUS.UNDETERMINED);value=values.reduce((best,item)=>step.op==='MIN'?(orderedCompare(item,best)<0?item:best):(orderedCompare(item,best)>0?item:best));break;}
      case 'SORT':{const compare=sortComparator(step.valueType),direction=step.direction==='DESC'?-1:1;value=[...collection(value,'SORT')].sort((left,right)=>direction*compare(left,right));break;}
      case 'UNIQUE':{const seen=new Set();value=collection(value,'UNIQUE').filter(item=>{const key=canonicalEqualityKey(item);if(seen.has(key))return false;seen.add(key);return true;});break;}
      case 'HASH_SHA256':value=await sha256(value);break;
      case 'REGEX':{if(typeof value!=='string')fail('REGEX_INPUT_TYPE','REGEX requires string input.',STATUS.UNDETERMINED);if(byteLength(value)>LIMITS.maxRegexInputBytes)fail('REGEX_INPUT_LIMIT','Regex input exceeds the registered byte limit.');const regexIssues=validateRegex(step.pattern,step.flags);if(regexIssues.length)fail('UNSAFE_REGEX',regexIssues.join(' '));value=new RegExp(step.pattern,step.flags||'').test(value);parserIdentities.push(PARSER_IDENTITIES.REGEX);break;}
      case 'COMPARE':{const expected=hasOwn(step,'value')?step.value:valueFromBinding(step.binding,artifacts,canonicalBindings),operator=step.operator,cmp=['EQ','NE'].includes(operator)?null:orderedCompare(value,expected);if(operator==='EQ')value=exactEqual(value,expected,step);else if(operator==='NE')value=!exactEqual(value,expected,step);else if(operator==='GT')value=cmp>0;else if(operator==='GTE')value=cmp>=0;else if(operator==='LT')value=cmp<0;else value=cmp<=0;break;}
      case 'BYTE_COMPARE':{const left=bytesOf(value),resolved=resolveBinding(step.binding,artifacts,canonicalBindings),right=bytesOf(resolved.kind==='ARTIFACT'?resolved.value.bytes:resolved.value.value);if(!left||!right)fail('BYTES_REQUIRED','BYTE_COMPARE requires byte-backed current and target bindings.');let equal=left.byteLength===right.byteLength;if(equal)for(let i=0;i<left.byteLength;i++)if(left[i]!==right[i]){equal=false;break;}value=equal;break;}
      case 'ASSERT_EQ':assertion=resultForAssertion(exactEqual(value,step.value,step),step.value,value,step.message);break;
      case 'ASSERT_GT':assertion=resultForAssertion(orderedCompare(value,step.value)>0,`> ${canonical(step.value)}`,value,step.message);break;
      case 'ASSERT_GTE':assertion=resultForAssertion(orderedCompare(value,step.value)>=0,`>= ${canonical(step.value)}`,value,step.message);break;
      case 'ASSERT_LT':assertion=resultForAssertion(orderedCompare(value,step.value)<0,`< ${canonical(step.value)}`,value,step.message);break;
      case 'ASSERT_LTE':assertion=resultForAssertion(orderedCompare(value,step.value)<=0,`<= ${canonical(step.value)}`,value,step.message);break;
      case 'ASSERT_MATCH':{if(typeof value!=='string')fail('REGEX_INPUT_TYPE','ASSERT_MATCH requires string input.',STATUS.UNDETERMINED);if(byteLength(value)>LIMITS.maxRegexInputBytes)fail('REGEX_INPUT_LIMIT','Regex input exceeds the registered byte limit.');const regexIssues=validateRegex(step.pattern,step.flags);if(regexIssues.length)fail('UNSAFE_REGEX',regexIssues.join(' '));assertion=resultForAssertion(new RegExp(step.pattern,step.flags||'').test(value),`matches /${step.pattern}/${step.flags||''}`,value,step.message);parserIdentities.push(PARSER_IDENTITIES.REGEX);break;}
      case 'ASSERT_CONTAINS':{let ok;if(Array.isArray(value))ok=value.some(item=>canonicalEqualityKey(item)===canonicalEqualityKey(step.value));else if(typeof value==='string'&&typeof step.value==='string')ok=value.includes(step.value);else fail('CONTAINS_DOMAIN_MISMATCH','ASSERT_CONTAINS requires an array or two strings.',STATUS.UNDETERMINED);assertion=resultForAssertion(ok,`contains ${canonical(step.value)}`,value,step.message);break;}
      case 'ASSERT_NOT_CONTAINS':{let ok;if(Array.isArray(value))ok=!value.some(item=>canonicalEqualityKey(item)===canonicalEqualityKey(step.value));else if(typeof value==='string'&&typeof step.value==='string')ok=!value.includes(step.value);else fail('CONTAINS_DOMAIN_MISMATCH','ASSERT_NOT_CONTAINS requires an array or two strings.',STATUS.UNDETERMINED);assertion=resultForAssertion(ok,`does not contain ${canonical(step.value)}`,value,step.message);break;}
      case 'ASSERT_SET_EQUAL':{const actual=collection(value,'ASSERT_SET_EQUAL'),left=[...new Set(actual.map(canonicalEqualityKey))].sort(scalarCompare),right=[...new Set(step.value.map(canonicalEqualityKey))].sort(scalarCompare);assertion=resultForAssertion(canonical(left)===canonical(right),step.value,actual,step.message);break;}
      default:fail('UNKNOWN_OPERATION',`Unsupported Test IR operation ${step.op}.`);
    }
    if(assertion){finalAssertion=assertion;observations.push({step:index,op:step.op,...assertion});if(assertion.determination===STATUS.VIOLATED)break;}
  }
  const testSpecSha256=await sha256Canonical(normalized),inputArtifactIds=verified.inputArtifactBindings.map(item=>item.artifactId),inputArtifactSha256Values=verified.inputArtifactBindings.map(item=>item.sha256),workerSecurityStatus=root.closedLoopWorkerSecurityStatus||{networkLocked:false,dynamicCodeLocked:false,dynamicImportScriptsLocked:false,nestedWorkersLocked:false,workerContext:false},hashBuildIdentity=root.closedLoopHash?.BUILD_IDENTITY||null;
  return {testId:metadata.testId||null,testSpecVersion:SPEC_VERSION,testSpecSha256,status:'COMPLETE',determination:finalAssertion?.determination||STATUS.UNDETERMINED,expected:finalAssertion?.expected??null,actual:finalAssertion?.actual??value,observations,evidence:[{kind:'APPLICATION_NATIVE_RUNTIME_OBSERVATION',testSpecSha256,inputArtifactBindings:verified.inputArtifactBindings,canonicalInputBindings:verified.canonicalInputBindings}],executorVersion:VERSION,runtimeVersion:VERSION,runtimeBuildIdentity:RUNTIME_BUILD_ID,hashBuildIdentity,testWorkerSha256:TEST_WORKER_SHA256,workerProtocolVersion:WORKER_PROTOCOL_VERSION,canonicalizationVersion:CANONICALIZATION_VERSION,parserIdentities:[...new Set(parserIdentities)],workerSecurityStatus,inputArtifactIds,inputArtifactSha256Values,inputArtifactBindings:verified.inputArtifactBindings,canonicalInputBindings:verified.canonicalInputBindings};
}

function workerUrl(){const base=RUNTIME_SCRIPT_URL||root.location?.href;if(!base)return `test-worker.js?v=${encodeURIComponent(RUNTIME_BUILD_ID)}`;const url=new URL('test-worker.js',base);url.search='';url.searchParams.set('v',RUNTIME_BUILD_ID);return url.href;}
function executionFailure(test,startedAtDeviceTime,error,testSpecSha256=null){const disposition=error?.disposition===STATUS.UNDETERMINED?STATUS.UNDETERMINED:STATUS.EXECUTION_FAILED;return {testId:field(test,'TEST_ID')||test?.testId||null,testSpecVersion:SPEC_VERSION,testSpecSha256,status:disposition,determination:STATUS.UNDETERMINED,expected:null,actual:null,observations:[],evidence:[],executorVersion:VERSION,runtimeVersion:VERSION,runtimeBuildIdentity:RUNTIME_BUILD_ID,hashBuildIdentity:root.closedLoopHash?.BUILD_IDENTITY||null,testWorkerSha256:TEST_WORKER_SHA256,workerProtocolVersion:WORKER_PROTOCOL_VERSION,canonicalizationVersion:CANONICALIZATION_VERSION,parserIdentities:[],inputArtifactIds:[],inputArtifactSha256Values:[],inputArtifactBindings:[],canonicalInputBindings:[],startedAtDeviceTime,endedAtDeviceTime:new Date().toISOString(),failure:{code:error?.code||'WORKER_EXECUTION_FAILED',message:String(error?.message||error)}};}
function validateWorkerResult(result,{testId,testSpecSha256}){
  if(!result||typeof result!=='object'||Array.isArray(result))fail('INVALID_WORKER_RESULT','Worker returned a non-object result.');if(result.testId!==testId||result.testSpecVersion!==SPEC_VERSION||result.testSpecSha256!==testSpecSha256)fail('WORKER_RESULT_BINDING_MISMATCH','Worker result does not match the exact test and Test IR.');if(result.runtimeVersion!==VERSION||result.runtimeBuildIdentity!==RUNTIME_BUILD_ID||result.hashBuildIdentity!==RUNTIME_BUILD_ID||result.testWorkerSha256!==TEST_WORKER_SHA256||result.workerProtocolVersion!==WORKER_PROTOCOL_VERSION||result.canonicalizationVersion!==CANONICALIZATION_VERSION)fail('WORKER_IDENTITY_MISMATCH','Worker runtime, hash authority, bytes, protocol, or canonicalization identity does not match the current build.');if(result.status!=='COMPLETE'||!['SATISFIED','VIOLATED','UNDETERMINED'].includes(result.determination))fail('INVALID_WORKER_RESULT','Worker returned an invalid completion disposition.');if(!result.workerSecurityStatus?.networkLocked||!result.workerSecurityStatus?.dynamicCodeLocked||!result.workerSecurityStatus?.dynamicImportScriptsLocked||!result.workerSecurityStatus?.nestedWorkersLocked||!result.workerSecurityStatus?.workerContext)fail('WORKER_SECURITY_NOT_ESTABLISHED','Worker did not establish the registered isolation controls.');return result;
}
async function executeTest(test,artifacts,canonicalBindings,options={}){
  const spec=field(test,'EXECUTABLE_SPEC'),bindings=field(test,'EXECUTABLE_INPUT_BINDINGS'),startedAtDeviceTime=new Date().toISOString(),check=validateSpec(spec,bindings);if(!check.valid)return executionFailure(test,startedAtDeviceTime,new RuntimeError('INVALID_TEST_IR',check.issues.join(' ')));
  let normalized,testSpecSha256;try{normalized=normalizeSpec(spec,bindings);testSpecSha256=await sha256Canonical(normalized);}catch(error){return executionFailure(test,startedAtDeviceTime,error);}
  const WorkerClass=options.Worker||root.Worker;if(typeof WorkerClass!=='function')return executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_UNAVAILABLE','The isolated Test IR worker is unavailable.'),testSpecSha256);let worker;try{worker=new WorkerClass(options.workerUrl||workerUrl());}catch(error){return executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_CONSTRUCTION_FAILED',error?.message||String(error)),testSpecSha256);}
  const requestedTimeout=Number(options.timeoutMs??LIMITS.workerTimeoutMs),timeoutMs=Number.isFinite(requestedTimeout)&&requestedTimeout>0?Math.min(requestedTimeout,LIMITS.workerTimeoutMs):LIMITS.workerTimeoutMs,testId=field(test,'TEST_ID')||test?.testId||null;
  return new Promise(resolve=>{const requestId=`test-ir-${Date.now()}-${crypto.getRandomValues(new Uint32Array(4)).join('-')}`;let settled=false;const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);try{worker.terminate();}catch{}resolve(result);};const timer=setTimeout(()=>finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_TIMEOUT',`Test IR worker exceeded ${timeoutMs} ms.`),testSpecSha256)),timeoutMs);worker.onmessage=event=>{const message=event?.data||{};if(message.requestId!==requestId)return;if(message.ok){try{const result=validateWorkerResult(message.result,{testId,testSpecSha256});finish({...result,startedAtDeviceTime,endedAtDeviceTime:new Date().toISOString()});}catch(error){finish(executionFailure(test,startedAtDeviceTime,error,testSpecSha256));}}else finish(executionFailure(test,startedAtDeviceTime,new RuntimeError(message.error?.code||'WORKER_EXECUTION_FAILED',message.error?.message||'Worker execution failed.',message.error?.disposition||STATUS.EXECUTION_FAILED),testSpecSha256));};worker.onerror=event=>finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_ERROR',event?.message||'Test IR worker failed.'),testSpecSha256));try{worker.postMessage({type:'EXECUTE_TEST_IR',protocolVersion:WORKER_PROTOCOL_VERSION,runtimeBuildIdentity:RUNTIME_BUILD_ID,testWorkerSha256:TEST_WORKER_SHA256,requestId,spec:normalized,bindings,artifacts:artifacts||{},canonicalBindings:canonicalBindings||{},metadata:{testId,bindings}});}catch(error){finish(executionFailure(test,startedAtDeviceTime,error,testSpecSha256));}});
}

const operationContracts=()=>JSON.parse(canonical(OP_DEFINITIONS));
const capabilities=()=>Object.freeze([CAPABILITY]);
root.closedLoopTestRuntime=Object.freeze({VERSION,BUILD_IDENTITY,RUNTIME_BUILD_ID,WORKER_PROTOCOL_VERSION,CANONICALIZATION_VERSION,TEST_WORKER_SHA256,SPEC_VERSION,EXECUTABLE_KIND,CAPABILITY,PARSER_IDENTITIES,OPS,OP_DEFINITIONS,LIMITS,STATUS,RuntimeError,validateSpec,validateBindings,normalizeSpec,supports,execute,executeTest,capabilities,operationContracts,sha256Canonical,validateResourceEnvelope,scalarCompare,validateRegex,workerUrl});
})();

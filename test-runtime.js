(()=>{
'use strict';

const root=globalThis;
const VERSION='closed-loop-test-runtime/1';
const RUNTIME_BUILD_ID=(()=>{try{return typeof document!=='undefined'&&document.currentScript?.src?new URL(document.currentScript.src).searchParams.get('v')||'UNMANIFESTED_LOCAL_RUNTIME':'UNMANIFESTED_LOCAL_RUNTIME';}catch{return 'UNMANIFESTED_LOCAL_RUNTIME';}})();
const SPEC_VERSION='closed-loop-test-spec/1';
const EXECUTABLE_KIND='TEST_IR';
const CAPABILITY='CLOSED_LOOP_TEST_IR';
const TEST_IR_LANGUAGE_VERSION='closed-loop-test-ir-language/1';
const OPERATION_REGISTRY_VERSION='closed-loop-test-ir-operations/1';
const OPERATION_REGISTRY_SHA256='929be82a05d8a08798009a7f7245a231a4f517291053b0bf549ff52ad6f8afc9';
const JSON_SELECTOR_REGISTRY_VERSION='closed-loop-json-selector/1';
const JSON_SELECTOR_REGISTRY_SHA256='546daaa22cccdbbdb10ba55da859b21b09c852781f42726cd5fb4f8356cd1ee5';
const XML_SELECTOR_REGISTRY_VERSION='closed-loop-xml-selector/1';
const XML_SELECTOR_REGISTRY_SHA256='83077fa4cfae3a215852e01728cde32f943c46ae7ba4bc5e845b2347b4a0a903';
const REGEX_REGISTRY_VERSION='closed-loop-regex/1';
const REGEX_REGISTRY_SHA256='dd4585d69d80059a7b284ef1307e2782ab5de81439b3ce0da31aa634de6ab2b8';

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
  workerTimeoutMs:5000,
  maxArchiveExpansionBytes:64*1024*1024
});

const STATUS=Object.freeze({
  SATISFIED:'SATISFIED',
  VIOLATED:'VIOLATED',
  UNDETERMINED:'UNDETERMINED',
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
  COMPARE:{required:[],optional:['value','binding','operator','numericMode','absTol','relTol','absoluteTolerance','relativeTolerance'],types:{binding:'binding',operator:'compareOperator',numericMode:'numericMode',absTol:'exactNonnegativeDecimal',relTol:'exactNonnegativeDecimal',absoluteTolerance:'exactNonnegativeDecimal',relativeTolerance:'exactNonnegativeDecimal'},oneOf:[['value'],['binding']]},
  ASSERT_EXISTS:{required:[],optional:['message'],types:{message:'string'}},
  ASSERT_TYPE:{required:['value'],optional:['message'],types:{value:'typeName',message:'string'}},
  ASSERT_NE:{required:['value'],optional:['message','numericMode','absTol','relTol','absoluteTolerance','relativeTolerance'],types:{message:'string',numericMode:'numericMode',absTol:'exactNonnegativeDecimal',relTol:'exactNonnegativeDecimal',absoluteTolerance:'exactNonnegativeDecimal',relativeTolerance:'exactNonnegativeDecimal'}},
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
});
const PORT_CONTRACTS=Object.freeze({
  LOAD_ARTIFACT:Object.freeze({requiredInputs:Object.freeze(['binding']),optionalInputs:Object.freeze([]),outputs:Object.freeze({artifact:'ARTIFACT'})}),
  READ_BYTES:Object.freeze({requiredInputs:Object.freeze(['artifact']),optionalInputs:Object.freeze([]),outputs:Object.freeze({bytes:'BYTES'})}),
  DECODE_UTF8:Object.freeze({requiredInputs:Object.freeze(['bytes']),optionalInputs:Object.freeze([]),outputs:Object.freeze({text:'STRING'})}),
  PARSE_JSON:Object.freeze({requiredInputs:Object.freeze(['text']),optionalInputs:Object.freeze([]),outputs:Object.freeze({value:'VALUE'})}),
  PARSE_CSV:Object.freeze({requiredInputs:Object.freeze(['text','delimiter','header','quote','newline','encoding']),optionalInputs:Object.freeze([]),outputs:Object.freeze({value:'VALUE'})}),
  PARSE_XML:Object.freeze({requiredInputs:Object.freeze(['text']),optionalInputs:Object.freeze([]),outputs:Object.freeze({value:'XML_NODE'})}),
  SELECT_JSON_PATH:Object.freeze({requiredInputs:Object.freeze(['value','path']),optionalInputs:Object.freeze([]),outputs:Object.freeze({selection:'VALUE'})}),
  SELECT_XML:Object.freeze({requiredInputs:Object.freeze(['value','path']),optionalInputs:Object.freeze([]),outputs:Object.freeze({selection:'VALUE'})}),
  COUNT:Object.freeze({requiredInputs:Object.freeze(['value']),optionalInputs:Object.freeze([]),outputs:Object.freeze({count:'INTEGER'})}),
  SUM:Object.freeze({requiredInputs:Object.freeze(['value']),optionalInputs:Object.freeze([]),outputs:Object.freeze({value:'INTEGER'})}),
  MIN:Object.freeze({requiredInputs:Object.freeze(['value']),optionalInputs:Object.freeze([]),outputs:Object.freeze({value:'INTEGER'})}),
  MAX:Object.freeze({requiredInputs:Object.freeze(['value']),optionalInputs:Object.freeze([]),outputs:Object.freeze({value:'INTEGER'})}),
  SORT:Object.freeze({requiredInputs:Object.freeze(['value']),optionalInputs:Object.freeze(['direction','domain']),outputs:Object.freeze({value:'VALUE'})}),
  UNIQUE:Object.freeze({requiredInputs:Object.freeze(['value']),optionalInputs:Object.freeze([]),outputs:Object.freeze({value:'VALUE'})}),
  HASH_SHA256:Object.freeze({requiredInputs:Object.freeze(['bytes']),optionalInputs:Object.freeze([]),outputs:Object.freeze({sha256:'STRING'})}),
  REGEX:Object.freeze({requiredInputs:Object.freeze(['value','pattern']),optionalInputs:Object.freeze(['flags']),outputs:Object.freeze({match:'BOOLEAN'})}),
  COMPARE:Object.freeze({requiredInputs:Object.freeze(['left','right']),optionalInputs:Object.freeze(['operator','numericMode','absTol','relTol','absoluteTolerance','relativeTolerance']),outputs:Object.freeze({comparison:'BOOLEAN'})}),
  ASSERT_EQ:Object.freeze({requiredInputs:Object.freeze(['actual','expected']),optionalInputs:Object.freeze(['numericMode','absTol','relTol','absoluteTolerance','relativeTolerance','message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  ASSERT_GT:Object.freeze({requiredInputs:Object.freeze(['actual','expected']),optionalInputs:Object.freeze(['message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  ASSERT_GTE:Object.freeze({requiredInputs:Object.freeze(['actual','expected']),optionalInputs:Object.freeze(['message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  ASSERT_LT:Object.freeze({requiredInputs:Object.freeze(['actual','expected']),optionalInputs:Object.freeze(['message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  ASSERT_LTE:Object.freeze({requiredInputs:Object.freeze(['actual','expected']),optionalInputs:Object.freeze(['message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  ASSERT_MATCH:Object.freeze({requiredInputs:Object.freeze(['actual','pattern']),optionalInputs:Object.freeze(['flags','message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  ASSERT_CONTAINS:Object.freeze({requiredInputs:Object.freeze(['actual','expected']),optionalInputs:Object.freeze(['message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  ASSERT_NOT_CONTAINS:Object.freeze({requiredInputs:Object.freeze(['actual','expected']),optionalInputs:Object.freeze(['message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  ASSERT_SET_EQUAL:Object.freeze({requiredInputs:Object.freeze(['actual','expected']),optionalInputs:Object.freeze(['message']),outputs:Object.freeze({assertion:'ASSERTION'})}),
  BYTE_COMPARE:Object.freeze({requiredInputs:Object.freeze(['left','right']),optionalInputs:Object.freeze([]),outputs:Object.freeze({comparison:'BOOLEAN'})})
});
const PORT_TYPE_SETS=Object.freeze({
  ARTIFACT:Object.freeze(['ARTIFACT']),
  BYTES:Object.freeze(['BYTES']),
  BYTE_BACKED:Object.freeze(['BYTES','ARTIFACT']),
  STRING:Object.freeze(['STRING']),
  BOOLEAN:Object.freeze(['BOOLEAN']),
  VALUE:Object.freeze(['VALUE']),
  XML_NODE:Object.freeze(['XML_NODE']),
  JSON_VALUE:Object.freeze(['VALUE','STRING','INTEGER','BOOLEAN']),
  COUNTABLE:Object.freeze(['VALUE','STRING']),
  DECIMAL_INPUT:Object.freeze(['STRING','INTEGER'])
});
const INPUT_PORT_TYPES=Object.freeze({
  LOAD_ARTIFACT:Object.freeze({binding:Object.freeze(['ARTIFACT','VALUE'])}),
  READ_BYTES:Object.freeze({artifact:PORT_TYPE_SETS.ARTIFACT}),
  DECODE_UTF8:Object.freeze({bytes:PORT_TYPE_SETS.BYTES}),
  PARSE_JSON:Object.freeze({text:PORT_TYPE_SETS.STRING}),
  PARSE_CSV:Object.freeze({text:PORT_TYPE_SETS.STRING,delimiter:PORT_TYPE_SETS.STRING,header:PORT_TYPE_SETS.BOOLEAN,quote:PORT_TYPE_SETS.STRING,newline:PORT_TYPE_SETS.STRING,encoding:PORT_TYPE_SETS.STRING}),
  PARSE_XML:Object.freeze({text:PORT_TYPE_SETS.STRING}),
  SELECT_JSON_PATH:Object.freeze({value:PORT_TYPE_SETS.JSON_VALUE,path:PORT_TYPE_SETS.STRING}),
  SELECT_XML:Object.freeze({value:PORT_TYPE_SETS.XML_NODE,path:PORT_TYPE_SETS.STRING}),
  COUNT:Object.freeze({value:PORT_TYPE_SETS.COUNTABLE}),
  SUM:Object.freeze({value:PORT_TYPE_SETS.VALUE}),
  MIN:Object.freeze({value:PORT_TYPE_SETS.VALUE}),
  MAX:Object.freeze({value:PORT_TYPE_SETS.VALUE}),
  SORT:Object.freeze({value:PORT_TYPE_SETS.VALUE,direction:PORT_TYPE_SETS.STRING,domain:PORT_TYPE_SETS.STRING}),
  UNIQUE:Object.freeze({value:PORT_TYPE_SETS.VALUE}),
  HASH_SHA256:Object.freeze({bytes:PORT_TYPE_SETS.BYTES}),
  REGEX:Object.freeze({value:PORT_TYPE_SETS.JSON_VALUE,pattern:PORT_TYPE_SETS.STRING,flags:PORT_TYPE_SETS.STRING}),
  COMPARE:Object.freeze({left:PORT_TYPE_SETS.JSON_VALUE,right:PORT_TYPE_SETS.JSON_VALUE,operator:PORT_TYPE_SETS.STRING,numericMode:PORT_TYPE_SETS.STRING,absTol:PORT_TYPE_SETS.DECIMAL_INPUT,relTol:PORT_TYPE_SETS.DECIMAL_INPUT,absoluteTolerance:PORT_TYPE_SETS.DECIMAL_INPUT,relativeTolerance:PORT_TYPE_SETS.DECIMAL_INPUT}),
  ASSERT_EQ:Object.freeze({actual:PORT_TYPE_SETS.JSON_VALUE,expected:PORT_TYPE_SETS.JSON_VALUE,numericMode:PORT_TYPE_SETS.STRING,absTol:PORT_TYPE_SETS.DECIMAL_INPUT,relTol:PORT_TYPE_SETS.DECIMAL_INPUT,absoluteTolerance:PORT_TYPE_SETS.DECIMAL_INPUT,relativeTolerance:PORT_TYPE_SETS.DECIMAL_INPUT,message:PORT_TYPE_SETS.STRING}),
  ASSERT_GT:Object.freeze({actual:PORT_TYPE_SETS.JSON_VALUE,expected:PORT_TYPE_SETS.JSON_VALUE,message:PORT_TYPE_SETS.STRING}),
  ASSERT_GTE:Object.freeze({actual:PORT_TYPE_SETS.JSON_VALUE,expected:PORT_TYPE_SETS.JSON_VALUE,message:PORT_TYPE_SETS.STRING}),
  ASSERT_LT:Object.freeze({actual:PORT_TYPE_SETS.JSON_VALUE,expected:PORT_TYPE_SETS.JSON_VALUE,message:PORT_TYPE_SETS.STRING}),
  ASSERT_LTE:Object.freeze({actual:PORT_TYPE_SETS.JSON_VALUE,expected:PORT_TYPE_SETS.JSON_VALUE,message:PORT_TYPE_SETS.STRING}),
  ASSERT_MATCH:Object.freeze({actual:PORT_TYPE_SETS.JSON_VALUE,pattern:PORT_TYPE_SETS.STRING,flags:PORT_TYPE_SETS.STRING,message:PORT_TYPE_SETS.STRING}),
  ASSERT_CONTAINS:Object.freeze({actual:PORT_TYPE_SETS.JSON_VALUE,expected:PORT_TYPE_SETS.JSON_VALUE,message:PORT_TYPE_SETS.STRING}),
  ASSERT_NOT_CONTAINS:Object.freeze({actual:PORT_TYPE_SETS.JSON_VALUE,expected:PORT_TYPE_SETS.JSON_VALUE,message:PORT_TYPE_SETS.STRING}),
  ASSERT_SET_EQUAL:Object.freeze({actual:PORT_TYPE_SETS.VALUE,expected:PORT_TYPE_SETS.VALUE,message:PORT_TYPE_SETS.STRING}),
  BYTE_COMPARE:Object.freeze({left:PORT_TYPE_SETS.BYTE_BACKED,right:PORT_TYPE_SETS.BYTE_BACKED})
});
function operationRegistryDefinitionIssues(){
  const issues=[];
  for(const [op,contract] of Object.entries(PORT_CONTRACTS)){
    const declared=INPUT_PORT_TYPES[op];
    if(!declared){issues.push(`Operation ${op} has no registered input-type contract.`);continue;}
    const ports=[...contract.requiredInputs,...contract.optionalInputs];
    for(const port of ports)if(!Array.isArray(declared[port])||!declared[port].length)issues.push(`Operation ${op} input ${port} has no accepted type set.`);
    for(const port of Object.keys(declared))if(!ports.includes(port))issues.push(`Operation ${op} has an input-type contract for undeclared port ${port}.`);
    for(const [port,type] of Object.entries(contract.outputs||{}))if(typeof type!=='string'||!type)issues.push(`Operation ${op} output ${port} has no exact type.`);
  }
  for(const op of Object.keys(INPUT_PORT_TYPES))if(!PORT_CONTRACTS[op])issues.push(`Input-type registry contains unknown operation ${op}.`);
  return issues;
}
const OPERATION_REGISTRY_DEFINITION_ISSUES=Object.freeze(operationRegistryDefinitionIssues());
if(OPERATION_REGISTRY_DEFINITION_ISSUES.length)throw new Error(`Invalid Test IR operation registry: ${OPERATION_REGISTRY_DEFINITION_ISSUES.join(' ')}`);
const OPS=Object.freeze(Object.keys(PORT_CONTRACTS));
const ASSERTION_OPS=new Set(['ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL']);
const encoder=new TextEncoder();
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const bytesOf=value=>value instanceof Uint8Array?value:value instanceof ArrayBuffer?new Uint8Array(value):ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):null;
const field=(test,key)=>test?.fields?.[key]??test?.[key];
const scalarCompare=(a,b)=>{const aa=Array.from(String(a),ch=>ch.codePointAt(0)),bb=Array.from(String(b),ch=>ch.codePointAt(0)),n=Math.min(aa.length,bb.length);for(let i=0;i<n;i++)if(aa[i]!==bb[i])return aa[i]-bb[i];return aa.length-bb.length;};
const canonical=value=>{const authority=root.closedLoopHash;if(!authority||authority.canonicalizationVersion!=='closed-loop-canonical-json/1'||typeof authority.stableStringify!=='function')fail('CANONICAL_HASH_AUTHORITY_UNAVAILABLE','Test IR requires the shared closed-loop-canonical-json/1 authority.');return authority.stableStringify(value);};
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
async function sha256Canonical(value){return sha256(encoder.encode(canonical(value)));}

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
  if(/\\\\[1-9]/.test(text)||/\\\\k</.test(text))issues.push('Regex backreferences are not supported.');
  if(/\\\\[pP]\\{/.test(text))issues.push('Unicode property escapes are not supported in closed-loop-regex/1.');
  for(let i=0;i<text.length;i++){
    if(text[i]==='\\\\'){i++;continue;}
    if(text[i]==='('&&text[i+1]==='?'&&text[i+2]!==':')issues.push('Regex lookaround, named groups, and inline mode groups are not supported.');
  }
  if(/\\((?:[^()\\\\]|\\\\.)*[+*](?:[^()\\\\]|\\\\.)*\\)\\s*(?:[+*]|\\{)/.test(text))issues.push('Regex nested unbounded quantification is outside the registered safe subset.');
  if((text.match(/(?:^|[^\\\\])[+*]/g)||[]).length>16)issues.push('Regex contains too many unbounded quantifiers.');
  if(/\([^()]*[+*][^()]*\)\s*(?:[+*]|\{)/.test(text))issues.push('Regex nested unbounded quantification is outside the registered safe subset.');
  try{if(!issues.length)new RegExp(text,flagText);}catch(error){issues.push(`Regex is invalid: ${error.message}`);}
  return [...new Set(issues)];
}

function parseJsonSelector(path){
  const text=String(path||'');if(text==='$')return [];
  if(!text.startsWith('$'))fail('UNSUPPORTED_JSON_SELECTOR','JSON selector must begin with $.');
  const parts=[];let i=1;
  const identifier=()=>{const match=text.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);if(!match)fail('UNSUPPORTED_JSON_SELECTOR',`Expected identifier at character ${i} in ${text}.`);i+=match[0].length;return match[0];};
  const quotedName=()=>{if(text[i]!=="'")fail('UNSUPPORTED_JSON_SELECTOR',`Expected single-quoted bracket name in ${text}.`);i++;let out='';while(i<text.length){const ch=text[i++];if(ch==="'")return out;if(ch==='\\\\'){if(i>=text.length)fail('UNSUPPORTED_JSON_SELECTOR',`Invalid bracket-name escape in ${text}.`);const next=text[i++];if(next!=="'"&&next!=='\\\\')fail('UNSUPPORTED_JSON_SELECTOR',`Only escaped quote and backslash are supported in bracket names: ${text}.`);out+=next;}else out+=ch;}fail('UNSUPPORTED_JSON_SELECTOR',`Unclosed bracket name in ${text}.`);};
  while(i<text.length){
    if(text[i]==='.'){
      i++;if(text[i]==='*'){parts.push({kind:'wildcard'});i++;}
      else parts.push({kind:'child',key:identifier()});
    }else if(text[i]==='['){
      i++;if(text[i]==='*'){i++;if(text[i++]!==']')fail('UNSUPPORTED_JSON_SELECTOR',`Malformed wildcard segment in ${text}.`);parts.push({kind:'wildcard'});}
      else if(text[i]==="'"){const key=quotedName();if(text[i++]!==']')fail('UNSUPPORTED_JSON_SELECTOR',`Unclosed bracket-name segment in ${text}.`);parts.push({kind:'child',key});}
      else {const match=text.slice(i).match(/^(0|[1-9]\\d*)/);if(!match)fail('UNSUPPORTED_JSON_SELECTOR',`Only nonnegative array indexes, single-quoted child names, and * are supported in brackets: ${text}.`);i+=match[0].length;if(text[i++]!==']')fail('UNSUPPORTED_JSON_SELECTOR',`Unclosed array index in ${text}.`);parts.push({kind:'index',index:Number(match[0])});}
    }else fail('UNSUPPORTED_JSON_SELECTOR',`Unsupported JSON selector character ${text[i]} at ${i}.`);
    if(parts.length>LIMITS.maxSelectorDepth)fail('SELECTOR_LIMIT','JSON selector exceeds the registered depth limit.');
  }
  return parts;
}
function selectJsonPath(value,path){
  const parts=parseJsonSelector(path);let current=[value],multi=false;
  for(const part of parts){
    const next=[];
    for(const node of current){
      if(part.kind==='child'){
        if(node!==null&&typeof node==='object'&&hasOwn(node,part.key))next.push(node[part.key]);
      }else if(part.kind==='index'){
        if(Array.isArray(node)&&part.index<node.length)next.push(node[part.index]);
      }else if(part.kind==='wildcard'){
        multi=true;if(Array.isArray(node))next.push(...node);else if(node!==null&&typeof node==='object')next.push(...Object.values(node));
      }
    }
    if(!next.length)fail('JSON_PATH_MISSING',`JSON selector does not resolve: ${path}.`,STATUS.UNDETERMINED);
    current=next;
  }
  return multi?current:current[0];
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
    const match=part.match(/^([A-Za-z_][A-Za-z0-9_.:-]*)(?:\[(\d+)\])?$/);if(!match||match[2]==='0')fail('UNSUPPORTED_XML_SELECTOR',`Unsupported XML selector segment ${part}.`);return {kind:'element',name:match[1],index:match[2]?Number(match[2]):null};
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
  const source=String(text),length=source.length;let i=0;
  const ws=()=>{while(i<length&&/[\x20\x09\x0a\x0d]/.test(source[i]))i++;};
  const error=message=>fail('MALFORMED_JSON',`JSON parse failed: ${message} at character ${i}.`,STATUS.UNDETERMINED);
  const stringToken=()=>{if(source[i]!=='"')error('Expected string');const start=i++;let escaped=false;for(;i<length;i++){const ch=source[i];if(escaped){if(ch==='u'){if(!/^[0-9a-fA-F]{4}$/.test(source.slice(i+1,i+5)))error('Invalid Unicode escape');i+=4;}else if(!'"\\/bfnrt'.includes(ch))error('Invalid string escape');escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(ch==='"'){i++;try{return JSON.parse(source.slice(start,i));}catch{error('Invalid JSON string');}}if(ch.charCodeAt(0)<0x20)error('Unescaped control character');}error('Unterminated string');};
  const numberToken=()=>{const match=source.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);if(!match)error('Invalid number');const raw=match[0];i+=raw.length;if(raw.includes('.')||/[eE]/.test(raw))fail('UNSUPPORTED_JSON_NUMBER',`PARSE_JSON numeric token ${raw} is not a safe-integer JSON number. Use a typed exact number representation.`,STATUS.UNDETERMINED);const n=Number(raw);if(!Number.isSafeInteger(n)||Object.is(n,-0))fail('UNSUPPORTED_JSON_NUMBER',`PARSE_JSON numeric token ${raw} is outside the finite safe-integer domain.`,STATUS.UNDETERMINED);};
  let parseValue,parseObject,parseArray;
  parseObject=()=>{i++;ws();const keys=new Set();if(source[i]==='}'){i++;return;}while(i<length){ws();const key=stringToken();if(keys.has(key))fail('DUPLICATE_JSON_MEMBER',`PARSE_JSON rejects duplicate object member ${key}.`,STATUS.UNDETERMINED);keys.add(key);ws();if(source[i++]!==':')error('Expected colon');parseValue();ws();if(source[i]==='}'){i++;return;}if(source[i++]!==',')error('Expected comma');}error('Unterminated object');};
  parseArray=()=>{i++;ws();if(source[i]===']'){i++;return;}while(i<length){parseValue();ws();if(source[i]===']'){i++;return;}if(source[i++]!==',')error('Expected comma');}error('Unterminated array');};
  parseValue=()=>{ws();const ch=source[i];if(ch==='"'){stringToken();return;}if(ch==='{'){parseObject();return;}if(ch==='['){parseArray();return;}if(source.startsWith('true',i)){i+=4;return;}if(source.startsWith('false',i)){i+=5;return;}if(source.startsWith('null',i)){i+=4;return;}if(ch==='-'||/\d/.test(ch||'')){numberToken();return;}error('Unexpected token');};
  ws();parseValue();ws();if(i!==length)error('Trailing content');return true;
}
function exactDecimalParts(value){
  if(value&&typeof value==='object'&&!Array.isArray(value)&&value.numberType==='DECIMAL')value=value.value;
  const text=String(value);if(!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)||text==='-0'||/^-0(?:\.0+)?$/.test(text))fail('UNSUPPORTED_NUMERIC_PRECISION','Exact decimal value must be canonical plain decimal text with no exponent or negative zero.',STATUS.UNDETERMINED);
  const neg=text[0]==='-',body=neg?text.slice(1):text,[whole,fraction='']=body.split('.'),scale=fraction.length,digits=BigInt((whole+fraction)||'0');return{sign:neg?-1n:1n,digits,scale};
}
function decimalAlign(a,b){const scale=Math.max(a.scale,b.scale),pow=n=>10n**BigInt(n);return{a:a.sign*a.digits*pow(scale-a.scale),b:b.sign*b.digits*pow(scale-b.scale),scale};}
function decimalAbsDiff(a,b){const x=decimalAlign(exactDecimalParts(a),exactDecimalParts(b));return{digits:x.a>=x.b?x.a-x.b:x.b-x.a,scale:x.scale};}
function decimalAbs(value){const p=exactDecimalParts(value);return{digits:p.digits,scale:p.scale};}
function decimalMaxAbs(a,b){const aa=decimalAbs(a),bb=decimalAbs(b),x=decimalAlign({...aa,sign:1n},{...bb,sign:1n});return x.a>=x.b?{digits:x.a,scale:x.scale}:{digits:x.b,scale:x.scale};}
function decimalMultiply(a,b){const aa=exactDecimalParts(a),bb=b&&b.digits!==undefined?b:decimalAbs(b);return{digits:aa.digits*bb.digits,scale:aa.scale+bb.scale};}
function decimalLTE(left,right){const x=decimalAlign({sign:1n,digits:left.digits,scale:left.scale},{sign:1n,digits:right.digits,scale:right.scale});return x.a<=x.b;}
function exactApproximate(actual,expected,step){const absTol=step.absTol??step.absoluteTolerance??'0',relTol=step.relTol??step.relativeTolerance??'0',diff=decimalAbsDiff(actual,expected),abs=decimalAbs(absTol),relProduct=decimalMultiply(relTol,decimalMaxAbs(actual,expected)),maxTol=decimalLTE(abs,relProduct)?relProduct:abs;return decimalLTE(diff,maxTol);}
function sortDomain(values,declared){if(!values.length)return declared||'STRING';const inferred=typeof values[0]==='string'?'STRING':typeof values[0]==='boolean'?'BOOLEAN':Number.isSafeInteger(values[0])?'INTEGER':values[0]&&values[0].numberType==='DECIMAL'?'DECIMAL':null,domain=declared||inferred;if(!domain)fail('SORT_DOMAIN','SORT requires an explicit supported homogeneous domain.',STATUS.UNDETERMINED);const ok=v=>domain==='STRING'?typeof v==='string':domain==='BOOLEAN'?typeof v==='boolean':domain==='INTEGER'?Number.isSafeInteger(v):domain==='DECIMAL'&&v&&v.numberType==='DECIMAL';if(!values.every(ok))fail('SORT_DOMAIN','SORT input is not homogeneous in the declared domain.',STATUS.UNDETERMINED);return domain;}
function compareSortValues(a,b,domain){if(domain==='STRING')return scalarCompare(a,b);if(domain==='BOOLEAN')return a===b?0:a?1:-1;if(domain==='INTEGER')return a===b?0:a<b?-1:1;if(domain==='DECIMAL')return compareDecimal(a.value,b.value);return 0;}

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

function normalizeDecimal(value){
  const text=String(value).trim();const match=text.match(/^([+-]?)(\d+)(?:\.(\d+))?$/);if(!match)return null;let whole=match[2].replace(/^0+(?=\d)/,'');let fraction=(match[3]||'').replace(/0+$/,'');if(whole==='0'&&!fraction)return '0';return `${match[1]==='-'?'-':''}${whole}${fraction?'.'+fraction:''}`;
}
function compareDecimal(left,right){
  const a=normalizeDecimal(left),b=normalizeDecimal(right);if(a===null||b===null)fail('UNSUPPORTED_NUMERIC_PRECISION','Exact decimal comparison requires plain decimal strings.',STATUS.UNDETERMINED);if(a===b)return 0;const negA=a.startsWith('-'),negB=b.startsWith('-');if(negA!==negB)return negA?-1:1;const aa=negA?a.slice(1):a,bb=negB?b.slice(1):b;const [aw,af='']=aa.split('.'),[bw,bf='']=bb.split('.');let result=aw.length!==bw.length?(aw.length<bw.length?-1:1):aw!==bw?(aw<bw?-1:1):af.padEnd(Math.max(af.length,bf.length),'0')===bf.padEnd(Math.max(af.length,bf.length),'0')?0:af.padEnd(Math.max(af.length,bf.length),'0')<bf.padEnd(Math.max(af.length,bf.length),'0')?-1:1;return negA?-result:result;
}
function isSafeIntegerValue(value){return typeof value==='number'&&Number.isSafeInteger(value);}
function exactEqual(actual,expected,step){
  const mode=step.numericMode;
  if(mode==='DECIMAL_STRING')return compareDecimal(actual,expected)===0;
  if(mode==='APPROXIMATE')return exactApproximate(actual,expected,step);
  if(typeof actual==='number'||typeof expected==='number'){
    if(!isSafeIntegerValue(actual)||!isSafeIntegerValue(expected))fail('UNSUPPORTED_NUMERIC_PRECISION','Exact numeric equality is supported only for safe integers unless DECIMAL_STRING or APPROXIMATE semantics are explicit.',STATUS.UNDETERMINED);
    return actual===expected;
  }
  return canonical(actual)===canonical(expected);
}
function orderedCompare(actual,expected){
  if(isSafeIntegerValue(actual)&&isSafeIntegerValue(expected))return actual===expected?0:actual<expected?-1:1;
  if(typeof actual==='string'&&typeof expected==='string'&&normalizeDecimal(actual)!==null&&normalizeDecimal(expected)!==null)return compareDecimal(actual,expected);
  fail('UNSUPPORTED_NUMERIC_PRECISION','Ordered numeric comparison supports safe integers or plain decimal strings only.',STATUS.UNDETERMINED);
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
  if(['COMPARE','ASSERT_EQ'].includes(step.op)&&step.numericMode==='APPROXIMATE'&&!['absTol','relTol','absoluteTolerance','relativeTolerance'].some(key=>hasOwn(step,key)))issues.push(`Step ${index} approximate comparison requires absTol, relTol, or an explicitly supported compatibility tolerance.`);
  if(['COMPARE','ASSERT_EQ'].includes(step.op)&&typeof step.value==='number'&&!Number.isSafeInteger(step.value))issues.push(`Step ${index} numeric literals must be finite safe integers; use a typed DECIMAL value for precision-sensitive comparisons.`);
  if(step.op==='PARSE_CSV'&&step.delimiter===step.quote)issues.push(`Step ${index} CSV delimiter and quote must differ.`);
  return issues;
}
function deepClone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function isInputRef(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const keys=Object.keys(value);
  if(keys.length===1&&keys[0]==='literal')return true;
  if(keys.length===1&&keys[0]==='bindingRef')return typeof value.bindingRef==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(value.bindingRef);
  if(keys.length===2&&keys.includes('stepRef')&&keys.includes('output'))return typeof value.stepRef==='string'&&typeof value.output==='string'&&value.output.length>0;
  return false;
}
function literalPortType(value){
  if(bytesOf(value))return 'BYTES';
  if(typeof value==='string')return 'STRING';
  if(typeof value==='boolean')return 'BOOLEAN';
  if(typeof value==='number')return Number.isSafeInteger(value)?'INTEGER':'INVALID_NUMBER';
  if(value===null||Array.isArray(value)||(value&&typeof value==='object'))return 'VALUE';
  return 'UNSUPPORTED_LITERAL';
}
function bindingPortType(name,bindings){
  if(bindings===undefined||!hasOwn(bindings||{},name))return null;
  const binding=bindings[name];
  if(typeof binding==='string')return 'ARTIFACT';
  if(!binding||typeof binding!=='object'||Array.isArray(binding))return null;
  return (binding.kind||'ARTIFACT')==='CANONICAL_VALUE'?'VALUE':'ARTIFACT';
}
function stepOutputPortType(step,output,bindings){
  const contract=PORT_CONTRACTS[step?.op];if(!contract||!hasOwn(contract.outputs,output))return null;
  if(step.op==='LOAD_ARTIFACT'&&output==='artifact'){
    const name=step.inputs?.binding?.bindingRef;
    return typeof name==='string'?bindingPortType(name,bindings):null;
  }
  return contract.outputs[output];
}
function inputReferencePortType(ref,prior,bindings){
  if(hasOwn(ref,'literal'))return literalPortType(ref.literal);
  if(hasOwn(ref,'bindingRef'))return bindingPortType(ref.bindingRef,bindings);
  if(hasOwn(ref,'stepRef'))return prior.has(ref.stepRef)?stepOutputPortType(prior.get(ref.stepRef),ref.output,bindings):null;
  return null;
}
function validateDagSpec(spec,bindings){
  const issues=[];
  if(!spec||typeof spec!=='object'||Array.isArray(spec))return {valid:false,issues:['Test IR must be an object.']};
  const rootKeys=['version','languageVersion','operationRegistryVersion','operationRegistrySha256','steps','result'];
  for(const key of Object.keys(spec))if(!rootKeys.includes(key))issues.push(`Test IR contains unknown root property ${key}.`);
  for(const key of rootKeys)if(!hasOwn(spec,key))issues.push(`Test IR is missing required root property ${key}.`);
  if(spec.version!==SPEC_VERSION)issues.push(`Unsupported Test IR version ${String(spec.version)}.`);
  if(spec.languageVersion!==TEST_IR_LANGUAGE_VERSION)issues.push(`Unsupported Test IR language version ${String(spec.languageVersion)}.`);
  if(spec.operationRegistryVersion!==OPERATION_REGISTRY_VERSION)issues.push(`Unsupported operation registry version ${String(spec.operationRegistryVersion)}.`);
  if(spec.operationRegistrySha256!==OPERATION_REGISTRY_SHA256)issues.push('Operation registry digest does not match the current registered semantics.');
  if(!Array.isArray(spec.steps)||!spec.steps.length)issues.push('Test IR requires a nonempty steps array.');
  if((spec.steps?.length||0)>LIMITS.maxSteps)issues.push(`Test IR exceeds the ${LIMITS.maxSteps}-step limit.`);
  const ids=new Set(),prior=new Map();
  for(const [index,step] of (spec.steps||[]).entries()){
    if(!step||typeof step!=='object'||Array.isArray(step)){issues.push(`Step ${index} must be an object.`);continue;}
    for(const key of Object.keys(step))if(!['stepId','op','inputs'].includes(key))issues.push(`Step ${index} contains unknown property ${key}.`);
    if(typeof step.stepId!=='string'||!/^S[0-9]{3,}$/.test(step.stepId))issues.push(`Step ${index} requires a canonical stepId such as S001.`);
    else if(ids.has(step.stepId))issues.push(`Duplicate stepId ${step.stepId}.`);
    const contract=PORT_CONTRACTS[step.op];if(!contract){issues.push(`Step ${index} uses unknown operation ${String(step.op)}.`);continue;}
    if(!step.inputs||typeof step.inputs!=='object'||Array.isArray(step.inputs)){issues.push(`Step ${index} operation ${step.op} requires a closed inputs object.`);continue;}
    const allowed=[...contract.requiredInputs,...contract.optionalInputs];for(const key of Object.keys(step.inputs))if(!allowed.includes(key))issues.push(`Step ${index} operation ${step.op} contains unknown input port ${key}.`);
    for(const key of contract.requiredInputs)if(!hasOwn(step.inputs,key))issues.push(`Step ${index} operation ${step.op} is missing required input port ${key}.`);
    for(const [name,ref] of Object.entries(step.inputs)){
      if(!isInputRef(ref)){issues.push(`Step ${index} input ${name} is not one literal, bindingRef, or prior step output reference.`);continue;}
      if(hasOwn(ref,'bindingRef')&&bindings!==undefined&&!hasOwn(bindings||{},ref.bindingRef))issues.push(`Step ${index} references undeclared binding ${ref.bindingRef}.`);
      if(step.op==='LOAD_ARTIFACT'&&name==='binding'&&!hasOwn(ref,'bindingRef'))issues.push(`Step ${index} LOAD_ARTIFACT binding must be an explicit bindingRef.`);
      if(hasOwn(ref,'stepRef')){
        if(!prior.has(ref.stepRef))issues.push(`Step ${index} has a forward, missing, or cyclic reference to ${ref.stepRef}.`);
        else {const priorStep=prior.get(ref.stepRef),priorContract=PORT_CONTRACTS[priorStep.op];if(!priorContract||!hasOwn(priorContract.outputs,ref.output))issues.push(`Step ${index} references unknown output port ${ref.output} on ${ref.stepRef}.`);}
      }
      const acceptedTypes=INPUT_PORT_TYPES[step.op]?.[name],providedType=inputReferencePortType(ref,prior,bindings);
      if(!acceptedTypes)issues.push(`Step ${index} operation ${step.op} input ${name} has no registered type contract.`);
      else if(providedType&&providedType!=='UNSUPPORTED_LITERAL'&&providedType!=='INVALID_NUMBER'&&!acceptedTypes.includes(providedType)){
        const source=hasOwn(ref,'stepRef')?`${ref.stepRef}.${ref.output}`:hasOwn(ref,'bindingRef')?`binding ${ref.bindingRef}`:'literal';
        issues.push(`Step ${index} input ${name} requires ${acceptedTypes.join(' or ')} but ${source} produces ${providedType}.`);
      }else if(providedType==='UNSUPPORTED_LITERAL'||providedType==='INVALID_NUMBER')issues.push(`Step ${index} input ${name} has unsupported literal type ${providedType}.`);
    }
    if(step.op==='REGEX'||step.op==='ASSERT_MATCH'){
      const pattern=step.inputs?.pattern?.literal,flags=step.inputs?.flags?.literal;if(typeof pattern==='string')issues.push(...validateRegex(pattern,flags).map(message=>`Step ${index}: ${message}`));
    }
    if(step.op==='PARSE_CSV'){
      for(const key of ['delimiter','header','quote','newline','encoding'])if(step.inputs?.[key]&&!hasOwn(step.inputs[key],'literal'))issues.push(`Step ${index} PARSE_CSV ${key} must be a literal contract value.`);
      const cfg=Object.fromEntries(['delimiter','header','quote','newline','encoding'].map(key=>[key,step.inputs?.[key]?.literal]));
      if(cfg.delimiter!==undefined&&!validateType(cfg.delimiter,'delimiter'))issues.push(`Step ${index} PARSE_CSV delimiter is invalid.`);
      if(cfg.header!==undefined&&!validateType(cfg.header,'boolean'))issues.push(`Step ${index} PARSE_CSV header is invalid.`);
      if(cfg.quote!==undefined&&!validateType(cfg.quote,'quote'))issues.push(`Step ${index} PARSE_CSV quote is invalid.`);
      if(cfg.newline!==undefined&&!validateType(cfg.newline,'csvNewline'))issues.push(`Step ${index} PARSE_CSV newline is invalid.`);
      if(cfg.encoding!==undefined&&!validateType(cfg.encoding,'utf8'))issues.push(`Step ${index} PARSE_CSV encoding is invalid.`);
      if(cfg.delimiter!==undefined&&cfg.quote!==undefined&&cfg.delimiter===cfg.quote)issues.push(`Step ${index} CSV delimiter and quote must differ.`);
    }
    ids.add(step.stepId);prior.set(step.stepId,step);
  }
  if(!spec.result||typeof spec.result!=='object'||Array.isArray(spec.result)||Object.keys(spec.result).sort().join(',')!=='output,stepRef')issues.push('Test IR result must contain exactly stepRef and output.');
  else if(!prior.has(spec.result.stepRef))issues.push(`Test IR result references missing step ${String(spec.result.stepRef)}.`);
  else {const contract=PORT_CONTRACTS[prior.get(spec.result.stepRef).op];if(!hasOwn(contract.outputs,spec.result.output))issues.push(`Test IR result references unknown output ${String(spec.result.output)}.`);}
  if(bindings!==undefined){const bindingResult=validateBindings(bindings);issues.push(...bindingResult.issues);}
  return {valid:issues.length===0,issues:[...new Set(issues)]};
}
function validateLegacySpec(spec,bindings){
  const issues=[];
  if(!spec||typeof spec!=='object'||Array.isArray(spec))return {valid:false,issues:['Test IR must be an object.']};
  for(const key of Object.keys(spec))if(!['version','steps'].includes(key))issues.push(`Legacy Test IR authoring form contains unknown root property ${key}.`);
  if(spec.version!==SPEC_VERSION)issues.push(`Unsupported Test IR version ${String(spec.version)}.`);
  if(!Array.isArray(spec.steps)||!spec.steps.length)issues.push('Test IR requires a nonempty steps array.');
  if((spec.steps?.length||0)>LIMITS.maxSteps)issues.push(`Test IR exceeds the ${LIMITS.maxSteps}-step limit.`);
  for(const [index,step] of (spec.steps||[]).entries()){
    issues.push(...validateStep(step,index));if(step?.op&&!PORT_CONTRACTS[step.op])issues.push(`Legacy authoring operation ${step.op} cannot compile to the canonical closed operation registry.`);
  }
  if(Array.isArray(spec.steps)&&spec.steps.length&&!spec.steps.some(step=>ASSERTION_OPS.has(step?.op)))issues.push('Test IR must contain at least one registered assertion operation.');
  if(bindings!==undefined){const bindingResult=validateBindings(bindings);issues.push(...bindingResult.issues);const declared=new Set(Object.keys(bindings||{}));for(const [index,step] of (spec.steps||[]).entries())if(step&&typeof step.binding==='string'&&!declared.has(step.binding))issues.push(`Step ${index} references undeclared binding ${step.binding}.`);}
  return {valid:issues.length===0,issues:[...new Set(issues)]};
}
function validateSpec(spec,bindings){
  if(spec&&typeof spec==='object'&&hasOwn(spec,'languageVersion'))return validateDagSpec(spec,bindings);
  const legacy=validateLegacySpec(spec,bindings);if(!legacy.valid)return legacy;
  try{return validateDagSpec(compileLegacySpec(spec),bindings);}catch(error){return {valid:false,issues:[String(error?.message||error)]};}
}
function validateBindings(bindings){
  const issues=[];if(!bindings||typeof bindings!=='object'||Array.isArray(bindings))return {valid:false,issues:['EXECUTABLE_INPUT_BINDINGS must be a closed object.']};
  for(const [name,binding] of Object.entries(bindings)){
    if(!/^[A-Z][A-Z0-9_]{0,63}$/.test(name))issues.push(`Invalid Test IR binding name ${name}.`);
    if(typeof binding==='string'){if(!binding.trim())issues.push(`Binding ${name} cannot be empty.`);continue;}
    if(!binding||typeof binding!=='object'||Array.isArray(binding)){issues.push(`Binding ${name} must be an artifact ID string or a closed binding object.`);continue;}
    const allowed=new Set(['kind','artifactId','source','artifactRole','filename','expectedSha256','canonicalKey','valueSha256']);for(const key of Object.keys(binding))if(!allowed.has(key))issues.push(`Binding ${name} contains unknown property ${key}.`);
    const kind=binding.kind||'ARTIFACT';if(!['ARTIFACT','CANONICAL_VALUE'].includes(kind))issues.push(`Binding ${name} has unsupported kind ${kind}.`);
    if(kind==='ARTIFACT'&&!binding.artifactId&&!binding.artifactRole&&!binding.filename)issues.push(`Binding ${name} does not identify an artifact.`);
    if(kind==='CANONICAL_VALUE'&&!binding.canonicalKey)issues.push(`Binding ${name} does not identify an immutable canonical value.`);
    if(binding.source&&!['CURRENT_PRODUCT','CURRENT_SCOPE','EXPLICIT_ARTIFACT'].includes(binding.source))issues.push(`Binding ${name} has unsupported source ${binding.source}.`);
    if(binding.expectedSha256&&!/^[0-9a-f]{64}$/.test(binding.expectedSha256))issues.push(`Binding ${name} expectedSha256 is invalid.`);
    if(binding.valueSha256&&!/^[0-9a-f]{64}$/.test(binding.valueSha256))issues.push(`Binding ${name} valueSha256 is invalid.`);
  }
  return {valid:issues.length===0,issues};
}
function outputPortFor(op){const outputs=Object.keys(PORT_CONTRACTS[op]?.outputs||{});if(outputs.length!==1)fail('UNDEFINED_OPERATION_OUTPUT',`Operation ${op} does not have exactly one registered output in version 1.`);return outputs[0];}
function priorRef(previous){if(!previous)fail('IMPLICIT_OPERAND_MISSING','Legacy authoring syntax requires a prior value-producing step.');return {stepRef:previous.stepId,output:previous.output};}
function literal(value){return {literal:deepClone(value)};}
function binding(name){return {bindingRef:String(name)};}
function compileLegacySpec(spec){
  const legacy=validateLegacySpec(spec);if(!legacy.valid)fail('INVALID_TEST_IR',legacy.issues.join(' '));
  const steps=[];let previous=null;
  for(const [index,old] of spec.steps.entries()){
    const stepId=`S${String(index+1).padStart(3,'0')}`;let inputs={};
    switch(old.op){
      case 'LOAD_ARTIFACT':inputs={binding:binding(old.binding)};break;
      case 'READ_BYTES':inputs={artifact:priorRef(previous)};break;
      case 'DECODE_UTF8':inputs={bytes:priorRef(previous)};break;
      case 'PARSE_JSON':inputs={text:priorRef(previous)};break;
      case 'PARSE_CSV':inputs={text:priorRef(previous),delimiter:literal(old.delimiter),header:literal(old.header),quote:literal(old.quote),newline:literal(old.newline),encoding:literal(old.encoding)};break;
      case 'PARSE_XML':inputs={text:priorRef(previous)};break;
      case 'SELECT_JSON_PATH':inputs={value:priorRef(previous),path:literal(old.path)};break;
      case 'SELECT_XML':inputs={value:priorRef(previous),path:literal(old.path)};break;
      case 'COUNT':case 'SUM':case 'MIN':case 'MAX':case 'UNIQUE':inputs={value:priorRef(previous)};break;
      case 'SORT':inputs={value:priorRef(previous)};if(old.direction!==undefined)inputs.direction=literal(old.direction);if(old.domain!==undefined)inputs.domain=literal(old.domain);break;
      case 'HASH_SHA256':inputs={bytes:priorRef(previous)};break;
      case 'REGEX':inputs={value:priorRef(previous),pattern:literal(old.pattern)};if(old.flags!==undefined)inputs.flags=literal(old.flags);break;
      case 'COMPARE':inputs={left:priorRef(previous),right:hasOwn(old,'value')?literal(old.value):binding(old.binding)};for(const key of ['operator','numericMode','absTol','relTol','absoluteTolerance','relativeTolerance'])if(old[key]!==undefined)inputs[key]=literal(old[key]);break;
      case 'BYTE_COMPARE':inputs={left:priorRef(previous),right:binding(old.binding)};break;
      case 'ASSERT_EQ':case 'ASSERT_GT':case 'ASSERT_GTE':case 'ASSERT_LT':case 'ASSERT_LTE':inputs={actual:priorRef(previous),expected:literal(old.value)};for(const key of ['numericMode','absTol','relTol','absoluteTolerance','relativeTolerance','message'])if(old[key]!==undefined)inputs[key]=literal(old[key]);break;
      case 'ASSERT_MATCH':inputs={actual:priorRef(previous),pattern:literal(old.pattern)};for(const key of ['flags','message'])if(old[key]!==undefined)inputs[key]=literal(old[key]);break;
      case 'ASSERT_CONTAINS':case 'ASSERT_NOT_CONTAINS':case 'ASSERT_SET_EQUAL':inputs={actual:priorRef(previous),expected:literal(old.value)};if(old.message!==undefined)inputs.message=literal(old.message);break;
      default:fail('UNKNOWN_OPERATION',`Legacy authoring operation ${old.op} cannot compile to the canonical operation registry.`);
    }
    const step={stepId,op:old.op,inputs};steps.push(step);previous={stepId,output:outputPortFor(old.op)};
  }
  return {version:SPEC_VERSION,languageVersion:TEST_IR_LANGUAGE_VERSION,operationRegistryVersion:OPERATION_REGISTRY_VERSION,operationRegistrySha256:OPERATION_REGISTRY_SHA256,steps,result:{stepRef:previous.stepId,output:previous.output}};
}
function normalizeSpec(spec){
  const normalized=spec&&typeof spec==='object'&&hasOwn(spec,'languageVersion')?deepClone(spec):compileLegacySpec(spec);
  const check=validateDagSpec(normalized);if(!check.valid)fail('INVALID_TEST_IR',check.issues.join(' '));
  return normalized;
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
  fail('MISSING_BINDING',`Required binding ${name} is unavailable.`);
}
function valueFromBinding(name,artifacts,canonicalBindings){const resolved=resolveBinding(name,artifacts,canonicalBindings);return resolved.kind==='ARTIFACT'?(resolved.value?.value??resolved.value):resolved.value?.value??resolved.value;}
function collection(value,op){if(!Array.isArray(value))fail('COLLECTION_REQUIRED',`${op} requires an array.`);if(value.length>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT',`${op} input exceeds the registered collection limit.`);return value;}
function resultForAssertion(ok,expected,actual,message){return {determination:ok?STATUS.SATISFIED:STATUS.VIOLATED,expected,actual,message:message||null};}

function unwrapValue(value){return value&&typeof value==='object'&&!Array.isArray(value)&&hasOwn(value,'value')?value.value:value;}
function resolveDagInput(ref,outputs,artifacts,canonicalBindings){
  if(hasOwn(ref,'literal'))return deepClone(ref.literal);
  if(hasOwn(ref,'bindingRef'))return resolveBinding(ref.bindingRef,artifacts,canonicalBindings).value;
  const step=outputs.get(ref.stepRef);if(!step||!hasOwn(step,ref.output))fail('MISSING_STEP_OUTPUT',`Required output ${ref.stepRef}.${ref.output} is unavailable.`);return step[ref.output];
}
function bytesFrom(value){return bytesOf(value?.bytes??value);}
function assertion(ok,expected,actual,message){return {determination:ok?STATUS.SATISFIED:STATUS.VIOLATED,expected,actual,message:message||null};}
function observationValue(value){
  const bytes=bytesFrom(value);if(bytes)return {kind:'BYTES',byteLength:bytes.byteLength};
  if(value&&typeof value==='object'&&value.determination)return {kind:'ASSERTION',determination:value.determination,expected:value.expected,actual:value.actual,message:value.message||null};
  if(Array.isArray(value))return {kind:'ARRAY',length:value.length};
  if(value&&typeof value==='object')return {kind:'OBJECT',keys:Object.keys(value).slice(0,50)};
  return {kind:typeof value,value};
}
async function execute({spec,artifacts={},canonicalBindings={},metadata={}}){
  const normalized=normalizeSpec(spec);const check=validateDagSpec(normalized,metadata.bindings);if(!check.valid)fail('INVALID_TEST_IR',check.issues.join(' '));
  const bindingCheck=validateBindings(metadata.bindings||Object.fromEntries([...Object.keys(artifacts),...Object.keys(canonicalBindings)].map(key=>[key,{kind:hasOwn(artifacts,key)?'ARTIFACT':'CANONICAL_VALUE',artifactId:hasOwn(artifacts,key)?String(artifacts[key]?.artifactId||key):undefined,canonicalKey:hasOwn(canonicalBindings,key)?key:undefined}])));if(!bindingCheck.valid)fail('INVALID_BINDINGS',bindingCheck.issues.join(' '));
  const uniqueBuffers=new Set();let totalInputBytes=0;for(const artifact of Object.values(artifacts||{})){const bytes=bytesFrom(artifact);if(bytes&&!uniqueBuffers.has(bytes.buffer)){uniqueBuffers.add(bytes.buffer);totalInputBytes+=bytes.byteLength;}}
  const envelope=validateResourceEnvelope({totalInputBytes});if(!envelope.valid)fail('INPUT_BYTE_LIMIT',envelope.issues.join(' '));
  const observations=[],outputs=new Map(),inputArtifactIds=[],inputArtifactSha256Values=[];
  for(const [bindingName,artifact] of Object.entries(artifacts||{})){const bytes=bytesFrom(artifact);if(!bytes)continue;const calculated=await sha256(bytes);if(artifact?.sha256&&String(artifact.sha256).toLowerCase()!==calculated)fail('ARTIFACT_HASH_MISMATCH',`Artifact ${artifact.artifactId||bindingName} bytes do not match its declared SHA-256.`);inputArtifactIds.push(String(artifact?.artifactId||bindingName));inputArtifactSha256Values.push(calculated);}
  for(const step of normalized.steps){
    const inputs=Object.fromEntries(Object.entries(step.inputs).map(([name,ref])=>[name,resolveDagInput(ref,outputs,artifacts,canonicalBindings)]));let out;
    switch(step.op){
      case 'LOAD_ARTIFACT':out={artifact:inputs.binding};break;
      case 'READ_BYTES':{const bytes=bytesFrom(inputs.artifact);if(!bytes)fail('BYTES_REQUIRED','READ_BYTES requires a byte-backed artifact binding.');out={bytes};break;}
      case 'DECODE_UTF8':{const bytes=bytesFrom(inputs.bytes);if(!bytes)fail('BYTES_REQUIRED','DECODE_UTF8 requires bytes.');if(bytes.byteLength>LIMITS.maxTextBytes)fail('TEXT_BYTE_LIMIT','UTF-8 input exceeds the registered text-byte limit.');if(bytes.byteLength>LIMITS.maxDecompressedBytes)fail('DECOMPRESSED_BYTE_LIMIT','UTF-8 input exceeds the registered decompressed-byte limit.');try{out={text:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};}catch{fail('INVALID_UTF8','Input is not valid UTF-8.',STATUS.UNDETERMINED);}break;}
      case 'PARSE_JSON':{const source=String(unwrapValue(inputs.text));validateJsonSourceExact(source);let value;try{value=JSON.parse(source);}catch(error){fail('MALFORMED_JSON',`JSON parse failed: ${error.message}`,STATUS.UNDETERMINED);}inspectStructure(value);out={value};break;}
      case 'PARSE_CSV':{const value=parseCsv(String(unwrapValue(inputs.text)),{delimiter:inputs.delimiter,header:inputs.header,quote:inputs.quote,newline:inputs.newline,encoding:inputs.encoding});inspectStructure(value);out={value};break;}
      case 'PARSE_XML':{const value=parseXml(String(unwrapValue(inputs.text)));inspectStructure(value);out={value};break;}
      case 'SELECT_JSON_PATH':out={selection:selectJsonPath(unwrapValue(inputs.value),inputs.path)};break;
      case 'SELECT_XML':out={selection:selectXml(unwrapValue(inputs.value),inputs.path)};break;
      case 'COUNT':{const value=unwrapValue(inputs.value);if(value==null||typeof value.length!=='number')fail('COUNT_INPUT','COUNT requires an array, string, or array-like value.',STATUS.UNDETERMINED);if(value.length>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT','COUNT input exceeds the registered collection limit.');out={count:value.length};break;}
      case 'SUM':case 'MIN':case 'MAX':{const values=collection(unwrapValue(inputs.value),step.op);if(!values.every(isSafeIntegerValue))fail('UNSUPPORTED_NUMERIC_PRECISION',`${step.op} supports safe integers only in version 1.`,STATUS.UNDETERMINED);const value=step.op==='SUM'?values.reduce((sum,item)=>{const next=sum+item;if(!Number.isSafeInteger(next))fail('INTEGER_OVERFLOW','SUM exceeded exact safe-integer range.',STATUS.UNDETERMINED);return next;},0):step.op==='MIN'?Math.min(...values):Math.max(...values);out={value};break;}
      case 'SORT':{const items=[...collection(unwrapValue(inputs.value),'SORT')],domain=sortDomain(items,inputs.domain);items.sort((a,b)=>compareSortValues(a,b,domain));if((inputs.direction||'ASC')==='DESC')items.reverse();out={value:items};break;}
      case 'UNIQUE':{const seen=new Set(),value=collection(unwrapValue(inputs.value),'UNIQUE').filter(item=>{const key=canonical(item);if(seen.has(key))return false;seen.add(key);return true;});out={value};break;}
      case 'HASH_SHA256':{const bytes=bytesFrom(inputs.bytes);if(!bytes)fail('BYTES_REQUIRED','HASH_SHA256 requires bytes.');out={sha256:await sha256(bytes)};break;}
      case 'REGEX':{const input=String(unwrapValue(inputs.value));if(byteLength(input)>LIMITS.maxRegexInputBytes)fail('REGEX_INPUT_LIMIT','Regex input exceeds the registered byte limit.');const regexIssues=validateRegex(inputs.pattern,inputs.flags);if(regexIssues.length)fail('UNSAFE_REGEX',regexIssues.join(' '));out={match:new RegExp(inputs.pattern,inputs.flags||'').test(input)};break;}
      case 'COMPARE':{const left=unwrapValue(inputs.left),right=unwrapValue(inputs.right),operator=inputs.operator||'EQ';const options={numericMode:inputs.numericMode,absTol:inputs.absTol,relTol:inputs.relTol,absoluteTolerance:inputs.absoluteTolerance,relativeTolerance:inputs.relativeTolerance};const cmp=['EQ','NE'].includes(operator)?null:orderedCompare(left,right);let comparison;if(operator==='EQ')comparison=exactEqual(left,right,options);else if(operator==='NE')comparison=!exactEqual(left,right,options);else if(operator==='GT')comparison=cmp>0;else if(operator==='GTE')comparison=cmp>=0;else if(operator==='LT')comparison=cmp<0;else if(operator==='LTE')comparison=cmp<=0;else fail('INVALID_COMPARE_OPERATOR',`Unsupported compare operator ${operator}.`);out={comparison};break;}
      case 'BYTE_COMPARE':{const left=bytesFrom(inputs.left),right=bytesFrom(inputs.right);if(!left||!right)fail('BYTES_REQUIRED','BYTE_COMPARE requires explicit byte-backed left and right inputs.');let comparison=left.byteLength===right.byteLength;if(comparison)for(let i=0;i<left.byteLength;i++)if(left[i]!==right[i]){comparison=false;break;}out={comparison};break;}
      case 'ASSERT_EQ':{const actual=unwrapValue(inputs.actual),expected=unwrapValue(inputs.expected),options={numericMode:inputs.numericMode,absTol:inputs.absTol,relTol:inputs.relTol,absoluteTolerance:inputs.absoluteTolerance,relativeTolerance:inputs.relativeTolerance};out={assertion:assertion(exactEqual(actual,expected,options),expected,actual,inputs.message)};break;}
      case 'ASSERT_GT':case 'ASSERT_GTE':case 'ASSERT_LT':case 'ASSERT_LTE':{const actual=unwrapValue(inputs.actual),expected=unwrapValue(inputs.expected),cmp=orderedCompare(actual,expected),ok=step.op==='ASSERT_GT'?cmp>0:step.op==='ASSERT_GTE'?cmp>=0:step.op==='ASSERT_LT'?cmp<0:cmp<=0;out={assertion:assertion(ok,`${step.op.slice(7)} ${expected}`,actual,inputs.message)};break;}
      case 'ASSERT_MATCH':{const actual=String(unwrapValue(inputs.actual));if(byteLength(actual)>LIMITS.maxRegexInputBytes)fail('REGEX_INPUT_LIMIT','Regex input exceeds the registered byte limit.');const regexIssues=validateRegex(inputs.pattern,inputs.flags);if(regexIssues.length)fail('UNSAFE_REGEX',regexIssues.join(' '));out={assertion:assertion(new RegExp(inputs.pattern,inputs.flags||'').test(actual),`matches /${inputs.pattern}/${inputs.flags||''}`,actual,inputs.message)};break;}
      case 'ASSERT_CONTAINS':case 'ASSERT_NOT_CONTAINS':{const actual=unwrapValue(inputs.actual),expected=unwrapValue(inputs.expected),contains=Array.isArray(actual)?actual.some(item=>canonical(item)===canonical(expected)):String(actual).includes(String(expected)),ok=step.op==='ASSERT_CONTAINS'?contains:!contains;out={assertion:assertion(ok,step.op==='ASSERT_CONTAINS'?`contains ${canonical(expected)}`:`does not contain ${canonical(expected)}`,actual,inputs.message)};break;}
      case 'ASSERT_SET_EQUAL':{const actual=collection(unwrapValue(inputs.actual),'ASSERT_SET_EQUAL'),expected=collection(unwrapValue(inputs.expected),'ASSERT_SET_EQUAL'),left=[...new Set(actual.map(canonical))].sort(),right=[...new Set(expected.map(canonical))].sort();out={assertion:assertion(canonical(left)===canonical(right),expected,actual,inputs.message)};break;}
      default:fail('UNKNOWN_OPERATION',`Unsupported Test IR operation ${step.op}.`);
    }
    outputs.set(step.stepId,out);const port=Object.keys(out)[0];observations.push({stepId:step.stepId,op:step.op,outputPort:port,...observationValue(out[port])});
    if(out.assertion?.determination===STATUS.VIOLATED)break;
  }
  const selected=outputs.get(normalized.result.stepRef);if(!selected||!hasOwn(selected,normalized.result.output))fail('RESULT_OUTPUT_UNAVAILABLE','The selected Test IR result output was not produced.');const resultValue=selected[normalized.result.output];
  const normalizedDagSha256=await sha256Canonical(normalized),determination=resultValue?.determination||STATUS.UNDETERMINED;
  const usedJsonSelector=normalized.steps.some(step=>step.op==='SELECT_JSON_PATH'),usedXmlSelector=normalized.steps.some(step=>step.op==='SELECT_XML'),usedRegex=normalized.steps.some(step=>step.op==='REGEX'||step.op==='ASSERT_MATCH');
  return {testId:metadata.testId||null,testSpecVersion:SPEC_VERSION,testSpecSha256:normalizedDagSha256,normalizedDagSha256,testIrLanguageVersion:TEST_IR_LANGUAGE_VERSION,operationRegistryVersion:OPERATION_REGISTRY_VERSION,operationRegistrySha256:OPERATION_REGISTRY_SHA256,jsonSelectorRegistryVersion:usedJsonSelector?JSON_SELECTOR_REGISTRY_VERSION:null,jsonSelectorRegistrySha256:usedJsonSelector?JSON_SELECTOR_REGISTRY_SHA256:null,xmlSelectorRegistryVersion:usedXmlSelector?XML_SELECTOR_REGISTRY_VERSION:null,xmlSelectorRegistrySha256:usedXmlSelector?XML_SELECTOR_REGISTRY_SHA256:null,regexRegistryVersion:usedRegex?REGEX_REGISTRY_VERSION:null,regexRegistrySha256:usedRegex?REGEX_REGISTRY_SHA256:null,selectedResultStepId:normalized.result.stepRef,selectedResultPort:normalized.result.output,status:'COMPLETE',determination,expected:resultValue?.expected??null,actual:resultValue?.actual??resultValue,observations,evidence:[{kind:'APPLICATION_NATIVE_RUNTIME_OBSERVATION',testSpecSha256:normalizedDagSha256,inputArtifactIds:[...new Set(inputArtifactIds)],inputArtifactSha256Values:[...new Set(inputArtifactSha256Values)]}],executorVersion:VERSION,runtimeVersion:VERSION,inputArtifactIds:[...new Set(inputArtifactIds)],inputArtifactSha256Values:[...new Set(inputArtifactSha256Values)]};
}

function workerUrl(){
  const source=typeof document!=='undefined'?document.currentScript?.src:null;const base=source||root.location?.href;if(!base)return 'test-worker.js';const url=new URL('test-worker.js',base);if(source)url.search=new URL(source).search;return url.href;
}
function executionFailure(test,startedAtDeviceTime,error){
  const disposition=error?.disposition===STATUS.UNDETERMINED?STATUS.UNDETERMINED:STATUS.EXECUTION_FAILED;
  return {testId:field(test,'TEST_ID')||test?.testId||null,testSpecVersion:SPEC_VERSION,testSpecSha256:null,status:disposition,determination:STATUS.UNDETERMINED,expected:null,actual:null,observations:[],evidence:[],executorVersion:VERSION,runtimeVersion:VERSION,inputArtifactIds:[],inputArtifactSha256Values:[],startedAtDeviceTime,endedAtDeviceTime:new Date().toISOString(),failure:{code:error?.code||'WORKER_EXECUTION_FAILED',message:String(error?.message||error)}};
}
function executeTest(test,artifacts,canonicalBindings,options={}){
  const spec=field(test,'EXECUTABLE_SPEC');const bindings=field(test,'EXECUTABLE_INPUT_BINDINGS');const check=validateSpec(spec,bindings);const startedAtDeviceTime=new Date().toISOString();if(!check.valid)return Promise.resolve(executionFailure(test,startedAtDeviceTime,new RuntimeError('INVALID_TEST_IR',check.issues.join(' '))));
  const WorkerClass=options.Worker||root.Worker;if(typeof WorkerClass!=='function')return Promise.resolve(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_UNAVAILABLE','The isolated Test IR worker is unavailable.')));
  return new Promise(resolve=>{
    const requestId=`test-ir-${Date.now()}-${Math.random().toString(36).slice(2)}`;let settled=false;const worker=new WorkerClass(options.workerUrl||workerUrl());
    const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);try{worker.terminate();}catch{}resolve(result);};
    const timer=setTimeout(()=>finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_TIMEOUT',`Test IR worker exceeded ${LIMITS.workerTimeoutMs} ms.`))),Number(options.timeoutMs||LIMITS.workerTimeoutMs));
    worker.onmessage=event=>{const message=event?.data||{};if(message.requestId!==requestId)return;if(message.ok){finish({...message.result,startedAtDeviceTime,endedAtDeviceTime:new Date().toISOString()});}else finish(executionFailure(test,startedAtDeviceTime,new RuntimeError(message.error?.code||'WORKER_EXECUTION_FAILED',message.error?.message||'Worker execution failed.',message.error?.disposition||STATUS.EXECUTION_FAILED)));};
    worker.onerror=event=>finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_ERROR',event?.message||'Test IR worker failed.')));
    try{worker.postMessage({type:'EXECUTE_TEST_IR',requestId,spec:normalizeSpec(spec),bindings,artifacts:artifacts||{},canonicalBindings:canonicalBindings||{},metadata:{testId:field(test,'TEST_ID')||test?.testId||null,bindings}});}catch(error){finish(executionFailure(test,startedAtDeviceTime,error));}
  });
}

const operationContracts=()=>Object.fromEntries(Object.entries(PORT_CONTRACTS).map(([op,contract])=>[op,{...JSON.parse(JSON.stringify(contract)),inputTypes:JSON.parse(JSON.stringify(INPUT_PORT_TYPES[op])),outputTypeResolver:op==='LOAD_ARTIFACT'?'BINDING_KIND':null}]));
const capabilities=()=>Object.freeze([CAPABILITY]);
root.closedLoopTestRuntime=Object.freeze({VERSION,SPEC_VERSION,EXECUTABLE_KIND,CAPABILITY,TEST_IR_LANGUAGE_VERSION,OPERATION_REGISTRY_VERSION,OPERATION_REGISTRY_SHA256,JSON_SELECTOR_REGISTRY_VERSION,JSON_SELECTOR_REGISTRY_SHA256,XML_SELECTOR_REGISTRY_VERSION,XML_SELECTOR_REGISTRY_SHA256,REGEX_REGISTRY_VERSION,REGEX_REGISTRY_SHA256,OPS,OP_DEFINITIONS,PORT_CONTRACTS,INPUT_PORT_TYPES,OPERATION_REGISTRY_DEFINITION_ISSUES,LIMITS,STATUS,RuntimeError,validateSpec,validateBindings,normalizeSpec,supports,execute,executeTest,capabilities,operationContracts,sha256Canonical,validateResourceEnvelope,validateRegex,parseJsonSelector});
})();

(()=>{
'use strict';

const root=globalThis;
const VERSION='closed-loop-test-runtime/1';
const RUNTIME_BUILD_ID='runtime-20260830-live-operator-59';
const DEPLOYMENT_TEST_WORKER_SHA256='__CLOSED_LOOP_TEST_WORKER_SHA256__';
const WORKER_PROTOCOL_VERSION='closed-loop-test-worker-protocol/1';
const SPEC_VERSION='closed-loop-test-spec/1';
const EXECUTABLE_KIND='TEST_IR';
const CAPABILITY='CLOSED_LOOP_TEST_IR';

/* Centralized implementation limits. These are support-contract limits, not claims
   about every browser or every possible project. Every boundary is fail-closed. */
const LIMITS=Object.freeze({
  maxTotalInputBytes:32*1024*1024,
  maxTextBytes:16*1024*1024,
  maxDecompressedBytes:64*1024*1024,
  maxSteps:128,
  maxSelectorDepth:32,
  maxParsedDepth:64,
  maxXmlDepth:64,
  maxParsedNodes:250000,
  maxCollectionItems:100000,
  maxRegexPatternBytes:2048,
  maxRegexLength:2000,
  maxRegexInputBytes:2*1024*1024,
  maxCsvCells:250000,
  maxCsvRows:100000,
  maxCsvColumns:250000,
  maxCsvFieldCharacters:1024*1024,
  maxCsvTotalCharacters:16*1024*1024,
  maxXmlNodes:100000,
  maxXmlAttributes:250000,
  maxXmlAttributesPerNode:1024,
  maxXmlAttributeCharacters:1024*1024,
  maxXmlTextNodeCharacters:4*1024*1024,
  maxXmlTotalTextCharacters:16*1024*1024,
  maxXmlNamespaces:1024,
  maxExactIntegerDigits:4096,
  maxExactDecimalDigits:4096,
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
  LOAD_ARTIFACT:{required:['binding'],optional:[],types:{binding:'binding'},input:['EMPTY'],output:['ARTIFACT','CANONICAL_VALUE']},
  READ_BYTES:{required:[],optional:[],types:{},input:['ARTIFACT'],output:['BYTES']},
  DECODE_UTF8:{required:[],optional:[],types:{},input:['BYTES'],output:['STRING']},
  PARSE_JSON:{required:[],optional:[],types:{},input:['STRING'],output:['JSON_VALUE']},
  PARSE_CSV:{required:['delimiter','header','quote','newline','encoding'],optional:['quoteEscaping','emptyLinePolicy','columnCountPolicy'],types:{delimiter:'delimiter',header:'boolean',quote:'quote',quoteEscaping:'csvQuoteEscaping',newline:'csvNewline',emptyLinePolicy:'csvEmptyLinePolicy',columnCountPolicy:'csvColumnCountPolicy',encoding:'utf8'},input:['STRING'],output:['ARRAY']},
  PARSE_XML:{required:[],optional:[],types:{},input:['STRING'],output:['XML_NODE']},
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
const OPS=Object.freeze(Object.keys(OP_DEFINITIONS));
const ASSERTION_OPS=new Set(['ASSERT_EXISTS','ASSERT_TYPE','ASSERT_NE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL']);
const encoder=new TextEncoder();
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const bytesOf=value=>value instanceof Uint8Array?value:value instanceof ArrayBuffer?new Uint8Array(value):ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):null;
const field=(test,key)=>test?.fields?.[key]??test?.[key];
function runtimeBuildIdentity(){
  if(typeof root.__CLOSED_LOOP_BUILD_IDENTITY==='string'&&root.__CLOSED_LOOP_BUILD_IDENTITY)return root.__CLOSED_LOOP_BUILD_IDENTITY;
  const source=typeof document!=='undefined'?document.currentScript?.src:null,locationHref=root.location?.href||'';
  try{const url=new URL(source||locationHref);return url.searchParams.get('v')||url.searchParams.get('build')||RUNTIME_BUILD_ID;}catch{return RUNTIME_BUILD_ID;}
}
const scalarCompare=(a,b)=>{const aa=Array.from(String(a),ch=>ch.codePointAt(0)),bb=Array.from(String(b),ch=>ch.codePointAt(0)),n=Math.min(aa.length,bb.length);for(let i=0;i<n;i++)if(aa[i]!==bb[i])return aa[i]-bb[i];return aa.length-bb.length;};
function exactValueIssues(value,path='$',seen=new Set()){
  const issues=[];
  const visit=(current,location)=>{
    if(typeof current==='number'){
      if(!Number.isSafeInteger(current)||Object.is(current,-0))issues.push(`${location} is not a finite nonnegative-zero safe integer JSON number; use a typed DECIMAL or INTEGER representation.`);
      return;
    }
    if(typeof current==='string'){
      for(let i=0;i<current.length;i++){const code=current.charCodeAt(i);if(code>=0xd800&&code<=0xdbff){const next=current.charCodeAt(i+1);if(!(next>=0xdc00&&next<=0xdfff))issues.push(`${location} contains an unpaired high surrogate.`);else i++;}else if(code>=0xdc00&&code<=0xdfff)issues.push(`${location} contains an unpaired low surrogate.`);}
      return;
    }
    if(current===null||typeof current==='boolean')return;
    if(typeof current==='undefined'||typeof current==='function'||typeof current==='symbol'||typeof current==='bigint'){issues.push(`${location} has unsupported type ${typeof current}.`);return;}
    if(!current||typeof current!=='object')return;
    if(bytesOf(current)){issues.push(`${location} contains binary data where a canonical semantic value is required.`);return;}
    if(seen.has(current)){issues.push(`${location} contains a cycle.`);return;}
    seen.add(current);
    if(Array.isArray(current)){
      for(let i=0;i<current.length;i++){if(!hasOwn(current,i))issues.push(`${location}[${i}] is a sparse-array hole.`);else visit(current[i],`${location}[${i}]`);}
    }else{
      if(Object.prototype.toString.call(current)!=='[object Object]')issues.push(`${location} is an implementation-specific object.`);
      for(const [key,item] of Object.entries(current)){visit(key,`${location}{key}`);visit(item,`${location}.${key}`);}
    }
    seen.delete(current);
  };
  visit(value,path);return issues;
}
function canonical(value){
  const issues=exactValueIssues(value);if(issues.length)fail('NONCANONICAL_VALUE',issues.join(' '),STATUS.UNDETERMINED);
  return JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>scalarCompare(a,b))):v);
}
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
  if(!text.startsWith('$.'))fail('UNSUPPORTED_JSON_SELECTOR','JSON selector must be $ or begin with $.');
  const parts=[];let i=2;let token='';
  const pushToken=()=>{if(!token)fail('UNSUPPORTED_JSON_SELECTOR',`Empty JSON selector segment in ${text}.`);parts.push(token);token='';};
  while(i<text.length){
    const ch=text[i];
    if(ch==='.') {pushToken();i++;continue;}
    if(ch==='['){if(token)pushToken();const end=text.indexOf(']',i+1);if(end<0)fail('UNSUPPORTED_JSON_SELECTOR',`Unclosed JSON selector index in ${text}.`);const raw=text.slice(i+1,end);if(!/^(0|[1-9]\d*)$/.test(raw))fail('UNSUPPORTED_JSON_SELECTOR',`Only nonnegative numeric JSON selector indexes are supported: ${text}.`);parts.push(Number(raw));i=end+1;if(text[i]==='.')i++;continue;}
    if(!/[A-Za-z0-9_:-]/.test(ch))fail('UNSUPPORTED_JSON_SELECTOR',`Unsupported JSON selector character ${ch}.`);
    token+=ch;i++;
  }
  if(token)pushToken();
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
  const allowedCode=code=>Number.isInteger(code)&&code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)&&![0xfffe,0xffff].includes(code);
  if(/^#\d+$/.test(entity)){const code=Number(entity.slice(1));if(allowedCode(code))return String.fromCodePoint(code);}
  if(/^#x[0-9a-f]+$/i.test(entity)){const code=parseInt(entity.slice(2),16);if(allowedCode(code))return String.fromCodePoint(code);}
  fail('UNSUPPORTED_XML_ENTITY',`Unsupported XML entity &${entity};.`);
}
const decodeXmlText=text=>String(text).replace(/&([^;]+);/g,(_,entity)=>decodeXmlEntity(entity));
function parseXmlAttributes(source){
  const attributes={};let rest=String(source||'').trim();
  while(rest){
    const match=rest.match(/^([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*("[^"]*"|'[^']*')\s*/);if(!match)fail('MALFORMED_XML',`Malformed XML attribute text: ${rest.slice(0,80)}.`);
    if(match[1].includes(':')||/^xmlns$/i.test(match[1]))fail('UNSUPPORTED_XML_NAMESPACE','Version 1 XML uses a closed no-namespace contract.');
    if(hasOwn(attributes,match[1]))fail('MALFORMED_XML',`Duplicate XML attribute ${match[1]}.`);
    const value=decodeXmlText(match[2].slice(1,-1));if(value.length>LIMITS.maxXmlAttributeCharacters)fail('XML_ATTRIBUTE_LIMIT','XML attribute exceeds the registered character limit.');attributes[match[1]]=value;if(Object.keys(attributes).length>LIMITS.maxXmlAttributesPerNode)fail('XML_ATTRIBUTE_LIMIT','XML element exceeds the registered attribute-count limit.');rest=rest.slice(match[0].length);
  }
  return attributes;
}
function parseXml(text){
  let source=String(text||'');
  if(/<!DOCTYPE|<!ENTITY/i.test(source))fail('UNSAFE_XML','DTD and entity declarations are prohibited.');
  source=source.replace(/^\uFEFF?\s*<\?xml\s[^?]*\?>\s*/i,'');
  const documentNode={name:'#document',attributes:{},children:[],textParts:[]};const stack=[documentNode];let nodes=0,attributes=0,totalText=0,index=0;
  const appendText=value=>{if(value){const decoded=decodeXmlText(value);if(decoded.length>LIMITS.maxXmlTextNodeCharacters)fail('XML_TEXT_LIMIT','XML text node exceeds the registered character limit.');totalText+=decoded.length;if(totalText>LIMITS.maxXmlTotalTextCharacters)fail('XML_TEXT_LIMIT','XML exceeds the registered total-text limit.');stack.at(-1).textParts.push(decoded);}};
  while(index<source.length){
    const open=source.indexOf('<',index);if(open<0){appendText(source.slice(index));break;}appendText(source.slice(index,open));
    if(source.startsWith('<!--',open)){const end=source.indexOf('-->',open+4);if(end<0)fail('MALFORMED_XML','Unterminated XML comment.');index=end+3;continue;}
    if(source.startsWith('<![CDATA[',open)){const end=source.indexOf(']]>',open+9);if(end<0)fail('MALFORMED_XML','Unterminated XML CDATA section.');appendText(source.slice(open+9,end));index=end+3;continue;}
    if(source.startsWith('<?',open))fail('UNSAFE_XML','XML processing instructions are not supported.');
    const close=source.indexOf('>',open+1);if(close<0)fail('MALFORMED_XML','Unterminated XML tag.');
    let body=source.slice(open+1,close).trim();
    if(body.startsWith('!'))fail('UNSAFE_XML','Unsupported XML declaration.');
    if(body.startsWith('/')){
      const name=body.slice(1).trim();if(stack.length===1||stack.at(-1).name!==name)fail('MALFORMED_XML',`Unexpected XML closing tag ${name}.`);stack.pop();index=close+1;continue;
    }
    const selfClosing=/\/$/.test(body);if(selfClosing)body=body.slice(0,-1).trim();
    const nameMatch=body.match(/^([A-Za-z_][A-Za-z0-9_.:-]*)/);if(!nameMatch)fail('MALFORMED_XML','XML element name is invalid.');if(nameMatch[1].includes(':'))fail('UNSUPPORTED_XML_NAMESPACE','Version 1 XML uses a closed no-namespace contract.');
    const node={name:nameMatch[1],attributes:parseXmlAttributes(body.slice(nameMatch[0].length)),children:[],textParts:[]};
    attributes+=Object.keys(node.attributes).length;if(attributes>LIMITS.maxXmlAttributes)fail('XML_ATTRIBUTE_LIMIT','XML exceeds the registered total attribute-count limit.');
    stack.at(-1).children.push(node);nodes++;if(nodes>LIMITS.maxXmlNodes)fail('XML_NODE_LIMIT','XML exceeds the registered node limit.');
    if(!selfClosing){stack.push(node);if(stack.length-1>LIMITS.maxXmlDepth)fail('XML_DEPTH_LIMIT','XML exceeds the registered depth limit.');}index=close+1;
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
  if(text.replace(/[-.]/g,'').length>LIMITS.maxExactDecimalDigits)fail('DECIMAL_DIGIT_LIMIT','Exact decimal exceeds the registered digit limit.',STATUS.UNDETERMINED);
  const neg=text[0]==='-',body=neg?text.slice(1):text,[whole,fraction='']=body.split('.'),scale=fraction.length,digits=BigInt((whole+fraction)||'0');return{sign:neg?-1n:1n,digits,scale};
}
function exactIntegerParts(value){
  if(typeof value==='number'){
    if(!Number.isSafeInteger(value)||Object.is(value,-0))fail('UNSUPPORTED_NUMERIC_PRECISION','Exact integer number must be a finite safe integer and cannot be negative zero.',STATUS.UNDETERMINED);
    return {integer:BigInt(value),typed:false};
  }
  if(!value||typeof value!=='object'||Array.isArray(value)||value.numberType!=='INTEGER'||typeof value.value!=='string')fail('UNSUPPORTED_NUMERIC_PRECISION','Exact integer must be a safe integer or typed INTEGER value.',STATUS.UNDETERMINED);
  const text=value.value;if(!/^-?(?:0|[1-9]\d*)$/.test(text)||text==='-0')fail('UNSUPPORTED_NUMERIC_PRECISION','Typed INTEGER must contain canonical base-10 text with no plus sign, redundant zero, exponent, or negative zero.',STATUS.UNDETERMINED);
  if(text.replace('-','').length>LIMITS.maxExactIntegerDigits)fail('INTEGER_DIGIT_LIMIT','Exact integer exceeds the registered digit limit.',STATUS.UNDETERMINED);
  return {integer:BigInt(text),typed:true};
}
function isExactInteger(value){try{exactIntegerParts(value);return true;}catch{return false;}}
function exactIntegerValue(integer,forceTyped=false){
  const min=BigInt(Number.MIN_SAFE_INTEGER),max=BigInt(Number.MAX_SAFE_INTEGER);
  return !forceTyped&&integer>=min&&integer<=max?Number(integer):{numberType:'INTEGER',value:integer.toString()};
}
function compareExactIntegers(left,right){const a=exactIntegerParts(left).integer,b=exactIntegerParts(right).integer;return a===b?0:a<b?-1:1;}
function decimalAlign(a,b){const scale=Math.max(a.scale,b.scale),pow=n=>10n**BigInt(n);return{a:a.sign*a.digits*pow(scale-a.scale),b:b.sign*b.digits*pow(scale-b.scale),scale};}
function decimalAbsDiff(a,b){const x=decimalAlign(exactDecimalParts(a),exactDecimalParts(b));return{digits:x.a>=x.b?x.a-x.b:x.b-x.a,scale:x.scale};}
function decimalAbs(value){const p=exactDecimalParts(value);return{digits:p.digits,scale:p.scale};}
function decimalMaxAbs(a,b){const aa=decimalAbs(a),bb=decimalAbs(b),x=decimalAlign({...aa,sign:1n},{...bb,sign:1n});return x.a>=x.b?{digits:x.a,scale:x.scale}:{digits:x.b,scale:x.scale};}
function decimalMultiply(a,b){const aa=exactDecimalParts(a),bb=b&&b.digits!==undefined?b:decimalAbs(b);return{digits:aa.digits*bb.digits,scale:aa.scale+bb.scale};}
function decimalLTE(left,right){const x=decimalAlign({sign:1n,digits:left.digits,scale:left.scale},{sign:1n,digits:right.digits,scale:right.scale});return x.a<=x.b;}
function exactApproximate(actual,expected,step){const absTol=step.absTol??step.absoluteTolerance??'0',relTol=step.relTol??step.relativeTolerance??'0',diff=decimalAbsDiff(actual,expected),abs=decimalAbs(absTol),relProduct=decimalMultiply(relTol,decimalMaxAbs(actual,expected)),maxTol=decimalLTE(abs,relProduct)?relProduct:abs;return decimalLTE(diff,maxTol);}
function sortDomain(values,declared){if(!values.length)return declared||'STRING';const inferred=typeof values[0]==='string'?'STRING':typeof values[0]==='boolean'?'BOOLEAN':isExactInteger(values[0])?'INTEGER':values[0]&&values[0].numberType==='DECIMAL'?'DECIMAL':null,domain=declared||inferred;if(!domain)fail('SORT_DOMAIN','SORT requires an explicit supported homogeneous domain.',STATUS.UNDETERMINED);const ok=v=>domain==='STRING'?typeof v==='string':domain==='BOOLEAN'?typeof v==='boolean':domain==='INTEGER'?isExactInteger(v):domain==='DECIMAL'&&v&&v.numberType==='DECIMAL';if(!values.every(ok))fail('SORT_DOMAIN','SORT input is not homogeneous in the declared domain.',STATUS.UNDETERMINED);return domain;}
function compareSortValues(a,b,domain){if(domain==='STRING')return scalarCompare(a,b);if(domain==='BOOLEAN')return a===b?0:a?1:-1;if(domain==='INTEGER')return compareExactIntegers(a,b);if(domain==='DECIMAL')return compareDecimal(a.value,b.value);return 0;}

function inspectStructure(value){
  let nodes=0,maxDepth=0;const seen=new Set();const stack=[{value,depth:1}];
  while(stack.length){const item=stack.pop();nodes++;maxDepth=Math.max(maxDepth,item.depth);if(nodes>LIMITS.maxParsedNodes)fail('PARSED_NODE_LIMIT','Parsed structure exceeds the registered node limit.');if(maxDepth>LIMITS.maxParsedDepth)fail('PARSED_DEPTH_LIMIT','Parsed structure exceeds the registered depth limit.');const current=item.value;if(!current||typeof current!=='object'||seen.has(current))continue;seen.add(current);if(Array.isArray(current)){if(current.length>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT','Parsed array exceeds the registered collection limit.');for(const child of current)stack.push({value:child,depth:item.depth+1});}else for(const child of Object.values(current))stack.push({value:child,depth:item.depth+1});}
  return {nodes,maxDepth};
}

function parseCsv(text,configuration){
  const {delimiter,header,quote,newline,encoding}=configuration,quoteEscaping=configuration.quoteEscaping||'DOUBLE',emptyLinePolicy=configuration.emptyLinePolicy||'PRESERVE',columnCountPolicy=configuration.columnCountPolicy||'CONSISTENT';if(encoding!=='UTF-8')fail('UNSUPPORTED_ENCODING','Version 1 CSV supports UTF-8 only.');
  const rows=[];let row=[],cell='',quoted=false,cells=0,index=0;const source=String(text);if(source.length>LIMITS.maxCsvTotalCharacters)fail('CSV_CHARACTER_LIMIT','CSV exceeds the registered total-character limit.');
  const newlineAt=position=>{if(newline==='LF')return source[position]==='\n'?1:0;if(newline==='CR')return source[position]==='\r'?1:0;if(newline==='CRLF')return source.startsWith('\r\n',position)?2:0;if(source.startsWith('\r\n',position))return 2;if(source[position]==='\n'||source[position]==='\r')return 1;return 0;};
  const pushCell=()=>{if(cell.length>LIMITS.maxCsvFieldCharacters)fail('CSV_FIELD_LIMIT','CSV field exceeds the registered character limit.');row.push(cell);cell='';cells++;if(cells>LIMITS.maxCsvCells)fail('CSV_CELL_LIMIT','CSV exceeds the registered cell limit.');if(row.length>LIMITS.maxCsvColumns)fail('CSV_COLUMN_LIMIT','CSV row exceeds the registered column limit.');};
  const pushRow=()=>{const blank=row.length===1&&row[0]==='';if(blank&&emptyLinePolicy==='REJECT')fail('CSV_EMPTY_LINE','CSV contains an empty line prohibited by the parse contract.');if(!(blank&&emptyLinePolicy==='SKIP'))rows.push(row);row=[];if(rows.length>LIMITS.maxCsvRows)fail('CSV_ROW_LIMIT','CSV exceeds the registered row limit.');};
  while(index<source.length){const ch=source[index];if(quoted){if(ch===quote&&source[index+1]===quote&&quoteEscaping==='DOUBLE'){cell+=quote;index+=2;continue;}if(ch===quote){quoted=false;index++;continue;}cell+=ch;if(cell.length>LIMITS.maxCsvFieldCharacters)fail('CSV_FIELD_LIMIT','CSV field exceeds the registered character limit.');index++;continue;}if(ch===quote){if(cell.length)fail('MALFORMED_CSV','CSV quote begins inside an unquoted field.');quoted=true;index++;continue;}if(ch===delimiter){pushCell();index++;continue;}const width=newlineAt(index);if(width){pushCell();pushRow();index+=width;continue;}if((newline==='LF'&&ch==='\r')||(newline==='CR'&&ch==='\n')||(newline==='CRLF'&&(ch==='\n'||ch==='\r')))fail('CSV_NEWLINE_MISMATCH','CSV contains a newline outside the declared newline policy.');cell+=ch;if(cell.length>LIMITS.maxCsvFieldCharacters)fail('CSV_FIELD_LIMIT','CSV field exceeds the registered character limit.');index++;}
  if(quoted)fail('MALFORMED_CSV','CSV has an unterminated quoted field.');if(cell.length||row.length){pushCell();pushRow();}
  if(!rows.length)return [];
  const expectedColumns=rows[0].length;if(columnCountPolicy==='CONSISTENT')for(const [rowIndex,values] of rows.entries())if(values.length!==expectedColumns)fail('MALFORMED_CSV',`CSV row ${rowIndex+1} has ${values.length} cells; expected ${expectedColumns}.`);
  if(!header)return rows;const names=rows.shift();if(new Set(names).size!==names.length)fail('MALFORMED_CSV','CSV header names must be unique.');return rows.map((values,rowIndex)=>{if(values.length!==names.length)fail('MALFORMED_CSV',`CSV row ${rowIndex+2} has ${values.length} cells; expected ${names.length}.`);return Object.fromEntries(names.map((name,column)=>[name,values[column]]));});
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
  if(typeof actual==='number'||typeof expected==='number'||actual?.numberType==='INTEGER'||expected?.numberType==='INTEGER'){
    if(!isExactInteger(actual)||!isExactInteger(expected))fail('UNSUPPORTED_NUMERIC_PRECISION','Exact numeric equality requires two exact integers unless DECIMAL_STRING or APPROXIMATE semantics are explicit.',STATUS.UNDETERMINED);
    return compareExactIntegers(actual,expected)===0;
  }
  return canonical(actual)===canonical(expected);
}
function orderedCompare(actual,expected){
  if(isExactInteger(actual)&&isExactInteger(expected))return compareExactIntegers(actual,expected);
  const aDecimal=actual&&typeof actual==='object'&&actual.numberType==='DECIMAL'?actual.value:actual;
  const bDecimal=expected&&typeof expected==='object'&&expected.numberType==='DECIMAL'?expected.value:expected;
  if(typeof aDecimal==='string'&&typeof bDecimal==='string'&&normalizeDecimal(aDecimal)!==null&&normalizeDecimal(bDecimal)!==null)return compareDecimal(aDecimal,bDecimal);
  fail('UNSUPPORTED_NUMERIC_PRECISION','Ordered numeric comparison supports exact integers or explicit decimal strings only.',STATUS.UNDETERMINED);
}
function validateType(value,type){
  switch(type){
    case 'string':return typeof value==='string';case 'boolean':return typeof value==='boolean';case 'array':return Array.isArray(value);
    case 'binding':return typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(value);
    case 'delimiter':return typeof value==='string'&&[...value].length===1&&!['\r','\n'].includes(value);
    case 'quote':return typeof value==='string'&&[...value].length===1&&!['\r','\n'].includes(value);
    case 'csvNewline':return ['AUTO','LF','CRLF','CR'].includes(value);
    case 'csvQuoteEscaping':return value==='DOUBLE';
    case 'csvEmptyLinePolicy':return ['PRESERVE','SKIP','REJECT'].includes(value);
    case 'csvColumnCountPolicy':return ['CONSISTENT','VARIABLE'].includes(value);
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
function validateExactLiteral(value,path){
  const issues=exactValueIssues(value,path);
  const visit=(current,location)=>{
    if(Array.isArray(current)){current.forEach((item,index)=>visit(item,`${location}[${index}]`));return;}
    if(!current||typeof current!=='object'||bytesOf(current))return;
    if(hasOwn(current,'numberType')){
      const keys=Object.keys(current).sort();
      if(keys.length!==2||keys[0]!=='numberType'||keys[1]!=='value')issues.push(`${location} typed number must contain exactly numberType and value.`);
      try{if(current.numberType==='INTEGER')exactIntegerParts(current);else if(current.numberType==='DECIMAL')exactDecimalParts(current);else issues.push(`${location} has unknown typed number ${String(current.numberType)}.`);}catch(error){issues.push(`${location}: ${error.message}`);}
      return;
    }
    for(const [key,item] of Object.entries(current))visit(item,`${location}.${key}`);
  };
  visit(value,path);return issues;
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
  if(hasOwn(step,'value'))issues.push(...validateExactLiteral(step.value,`Step ${index}.value`));
  if(step.op==='PARSE_CSV'&&step.delimiter===step.quote)issues.push(`Step ${index} CSV delimiter and quote must differ.`);
  return issues;
}
function validateTypedPipeline(spec,bindings){
  const issues=[];let type='EMPTY';const declared=bindings&&typeof bindings==='object'?bindings:{};
  const allow=(index,step,types)=>{if(!types.includes(type)&&type!=='UNKNOWN')issues.push(`Step ${index} operation ${step.op} cannot consume ${type}; expected ${types.join(' or ')}.`);};
  for(const [index,step] of (Array.isArray(spec?.steps)?spec.steps:[]).entries()){
    if(!step||!OP_DEFINITIONS[step.op])continue;
    switch(step.op){
      case 'LOAD_ARTIFACT':{const binding=declared[step.binding];if(binding&&typeof binding==='object'&&(binding.kind||'ARTIFACT')==='CANONICAL_VALUE')type='CANONICAL_VALUE';else if(binding)type='ARTIFACT';else type='UNKNOWN';break;}
      case 'READ_BYTES':allow(index,step,['ARTIFACT']);type='BYTES';break;
      case 'DECODE_UTF8':allow(index,step,['BYTES']);type='STRING';break;
      case 'PARSE_JSON':allow(index,step,['STRING']);type='JSON_VALUE';break;
      case 'PARSE_CSV':allow(index,step,['STRING']);type='ARRAY';break;
      case 'PARSE_XML':allow(index,step,['STRING']);type='XML_NODE';break;
      case 'SELECT_JSON_PATH':allow(index,step,['JSON_VALUE','OBJECT','ARRAY']);type='UNKNOWN';break;
      case 'SELECT_XML':allow(index,step,['XML_NODE','ARRAY']);type='ARRAY';break;
      case 'COUNT':allow(index,step,['ARRAY','STRING','BYTES','JSON_VALUE']);type='INTEGER';break;
      case 'SUM':case 'MIN':case 'MAX':allow(index,step,['ARRAY','CANONICAL_VALUE','JSON_VALUE']);type='INTEGER';break;
      case 'SORT':case 'UNIQUE':allow(index,step,['ARRAY','CANONICAL_VALUE','JSON_VALUE']);type='ARRAY';break;
      case 'HASH_SHA256':allow(index,step,['BYTES']);type='STRING';break;
      case 'REGEX':allow(index,step,['STRING']);type='BOOLEAN';break;
      case 'COMPARE':type='BOOLEAN';break;
      case 'BYTE_COMPARE':allow(index,step,['BYTES']);type='BOOLEAN';break;
      default:break;
    }
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
  issues.push(...validateTypedPipeline(spec,bindings));
  if(Array.isArray(spec.steps)&&spec.steps.length&&!spec.steps.some(step=>ASSERTION_OPS.has(step?.op)))issues.push('Test IR must contain at least one registered assertion operation.');
  if(bindings!==undefined){const bindingResult=validateBindings(bindings);issues.push(...bindingResult.issues);const declared=new Set(Object.keys(bindings||{}));for(const [index,step] of (spec.steps||[]).entries())if(step&&typeof step.binding==='string'&&!declared.has(step.binding))issues.push(`Step ${index} references undeclared binding ${step.binding}.`);}
  return {valid:issues.length===0,issues};
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
function normalizeSpec(spec){
  const check=validateSpec(spec);if(!check.valid)fail('INVALID_TEST_IR',check.issues.join(' '));
  return {version:SPEC_VERSION,steps:spec.steps.map(source=>{
    const step=source.op==='PARSE_CSV'?{quoteEscaping:'DOUBLE',emptyLinePolicy:'PRESERVE',columnCountPolicy:'CONSISTENT',...source}:{...source};
    return Object.fromEntries(Object.entries(step).sort(([a],[b])=>a==='op'?-1:b==='op'?1:scalarCompare(a,b)));
  })};
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

async function execute({spec,artifacts={},canonicalBindings={},metadata={}}){
  const normalized=normalizeSpec(spec);const bindingCheck=validateBindings(metadata.bindings||Object.fromEntries([...Object.keys(artifacts),...Object.keys(canonicalBindings)].map(key=>[key,{kind:hasOwn(artifacts,key)?'ARTIFACT':'CANONICAL_VALUE',artifactId:hasOwn(artifacts,key)?String(artifacts[key]?.artifactId||key):undefined,canonicalKey:hasOwn(canonicalBindings,key)?key:undefined}])));if(!bindingCheck.valid)fail('INVALID_BINDINGS',bindingCheck.issues.join(' '));
  let totalInputBytes=0;for(const artifact of Object.values(artifacts||{})){const bytes=bytesOf(artifact?.bytes??artifact);if(bytes)totalInputBytes+=bytes.byteLength;}
  const envelope=validateResourceEnvelope({totalInputBytes});if(!envelope.valid)fail('INPUT_BYTE_LIMIT',envelope.issues.join(' '));
  let value=null,current=null;const observations=[];let finalAssertion=null;const inputArtifactHashes=new Map(),recordInputArtifact=(artifactId,digest)=>{const id=String(artifactId),sha=String(digest||'').toLowerCase();if(inputArtifactHashes.has(id)&&inputArtifactHashes.get(id)!==sha)fail('ARTIFACT_IDENTITY_CONTRADICTION',`Artifact ${id} resolved to incompatible SHA-256 values.`);inputArtifactHashes.set(id,sha);};
  /* PREHASH_EVERY_BOUND_ARTIFACT: every consumed package input is identity-bound, even when a comparison operation references it without LOAD_ARTIFACT. */
  for(const [bindingName,artifact] of Object.entries(artifacts||{})){const bytes=bytesOf(artifact?.bytes??artifact);if(!bytes)continue;const calculated=await sha256(bytes),contract=metadata.bindings?.[bindingName];if(artifact?.sha256&&String(artifact.sha256).toLowerCase()!==calculated)fail('ARTIFACT_HASH_MISMATCH',`Artifact ${artifact.artifactId||bindingName} bytes do not match its declared SHA-256.`);if(contract?.expectedSha256&&String(contract.expectedSha256).toLowerCase()!==calculated)fail('ARTIFACT_BINDING_MISMATCH',`Artifact ${artifact.artifactId||bindingName} bytes do not match the immutable Test IR binding.`);if(artifact?.byteSize!=null&&Number(artifact.byteSize)!==bytes.byteLength)fail('ARTIFACT_SIZE_MISMATCH',`Artifact ${artifact.artifactId||bindingName} bytes do not match its declared byte size.`);recordInputArtifact(artifact?.artifactId||bindingName,calculated);}
  for(const [bindingName,binding] of Object.entries(canonicalBindings||{})){const issues=validateExactLiteral(binding?.value??binding,`canonicalBindings.${bindingName}`);if(issues.length)fail('INVALID_CANONICAL_BINDING',issues.join(' '));const contract=metadata.bindings?.[bindingName],expected=String(contract?.valueSha256||binding?.valueSha256||'').toLowerCase();if(expected){const calculated=await sha256Canonical(binding?.value??binding);if(calculated!==expected)fail('CANONICAL_BINDING_MISMATCH',`Canonical binding ${bindingName} changed from its immutable hash-bound value.`);}}
  for(const [index,step] of normalized.steps.entries()){
    switch(step.op){
      case 'LOAD_ARTIFACT':{
        const resolved=resolveBinding(step.binding,artifacts,canonicalBindings);current=resolved;value=resolved.kind==='CANONICAL_VALUE'?(resolved.value?.value??resolved.value):resolved.value;
        if(resolved.kind==='ARTIFACT'){const artifact=resolved.value;const bytes=bytesOf(artifact?.bytes??artifact);const calculated=bytes?await sha256(bytes):null;if(artifact?.sha256&&calculated&&String(artifact.sha256).toLowerCase()!==calculated)fail('ARTIFACT_HASH_MISMATCH',`Artifact ${artifact.artifactId||step.binding} bytes do not match its declared SHA-256.`);recordInputArtifact(artifact?.artifactId||step.binding,calculated||String(artifact?.sha256||''));observations.push({step:index,op:step.op,binding:step.binding,bindingKind:'ARTIFACT',artifactId:artifact?.artifactId||null,filename:artifact?.filename||null,sha256:calculated||artifact?.sha256||null});}
        else observations.push({step:index,op:step.op,binding:step.binding,bindingKind:'CANONICAL_VALUE'});
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
      case 'SUM':case 'MIN':case 'MAX':{const values=collection(value,step.op);if(!values.length)fail('EMPTY_COLLECTION',`${step.op} requires a nonempty exact-integer collection.`,STATUS.UNDETERMINED);if(!values.every(isExactInteger))fail('UNSUPPORTED_NUMERIC_PRECISION',`${step.op} supports exact integers only in version 1.`,STATUS.UNDETERMINED);const parsed=values.map(exactIntegerParts),forceTyped=parsed.some(item=>item.typed);let result;if(step.op==='SUM')result=parsed.reduce((sum,item)=>sum+item.integer,0n);else result=parsed.slice(1).reduce((best,item)=>step.op==='MIN'?(item.integer<best?item.integer:best):(item.integer>best?item.integer:best),parsed[0].integer);if(result.toString().replace('-','').length>LIMITS.maxExactIntegerDigits)fail('INTEGER_DIGIT_LIMIT',`${step.op} result exceeds the registered exact-integer digit limit.`,STATUS.UNDETERMINED);value=exactIntegerValue(result,forceTyped);break;}
      case 'SORT':{const direction=step.direction||'ASC',items=[...collection(value,'SORT')],domain=sortDomain(items,step.domain);value=items.sort((a,b)=>compareSortValues(a,b,domain));if(direction==='DESC')value.reverse();break;}
      case 'UNIQUE':{const seen=new Set();value=collection(value,'UNIQUE').filter(item=>{const key=canonical(item);if(seen.has(key))return false;seen.add(key);return true;});break;}
      case 'HASH_SHA256':value=await sha256(value);break;
      case 'REGEX':{const input=String(value);if(byteLength(input)>LIMITS.maxRegexInputBytes)fail('REGEX_INPUT_LIMIT','Regex input exceeds the registered byte limit.');const regexIssues=validateRegex(step.pattern,step.flags);if(regexIssues.length)fail('UNSAFE_REGEX',regexIssues.join(' '));value=new RegExp(step.pattern,step.flags||'').test(input);break;}
      case 'COMPARE':{const expected=hasOwn(step,'value')?step.value:valueFromBinding(step.binding,artifacts,canonicalBindings);const operator=step.operator||'EQ';const cmp=['EQ','NE'].includes(operator)?null:orderedCompare(value,expected);if(operator==='EQ')value=exactEqual(value,expected,step);else if(operator==='NE')value=!exactEqual(value,expected,step);else if(operator==='GT')value=cmp>0;else if(operator==='GTE')value=cmp>=0;else if(operator==='LT')value=cmp<0;else value=cmp<=0;break;}
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
  const inputArtifactIds=[...inputArtifactHashes.keys()],inputArtifactSha256Values=[...inputArtifactHashes.values()];return {
    testId:metadata.testId||null,
    testSpecVersion:SPEC_VERSION,
    testSpecSha256,
    status:'COMPLETE',
    determination:finalAssertion?.determination||STATUS.UNDETERMINED,
    expected:finalAssertion?.expected??null,
    actual:finalAssertion?.actual??value,
    observations,
    evidence:[{kind:'APPLICATION_NATIVE_RUNTIME_OBSERVATION',testSpecSha256,inputArtifactIds:[...inputArtifactIds],inputArtifactSha256Values:[...inputArtifactSha256Values]}],
    executorVersion:VERSION,
    runtimeVersion:VERSION,
    runtimeBuildIdentity:metadata.runtimeBuildIdentity||runtimeBuildIdentity(),
    testWorkerSha256:metadata.testWorkerSha256||null,
    workerProtocolVersion:metadata.workerProtocolVersion||null,
    parserOrAdapterIdentities:[...new Set(normalized.steps.filter(step=>['PARSE_JSON','PARSE_CSV','PARSE_XML'].includes(step.op)).map(step=>`${step.op}:closed-loop-test-runtime/1`))],
    inputArtifactIds:[...inputArtifactIds],
    inputArtifactSha256Values:[...inputArtifactSha256Values]
  };
}

function workerUrl(){
  const source=typeof document!=='undefined'?document.currentScript?.src:null;const base=source||root.location?.href;if(!base)return `test-worker.js?v=${encodeURIComponent(runtimeBuildIdentity())}`;const url=new URL('test-worker.js',base);url.searchParams.set('v',runtimeBuildIdentity());return url.href;
}
function expectedWorkerSha256(options={}){
  const explicit=options.testWorkerSha256||options.workerSha256;if(explicit)return /^[a-f0-9]{64}$/i.test(String(explicit))?String(explicit).toLowerCase():null;
  return /^[a-f0-9]{64}$/i.test(DEPLOYMENT_TEST_WORKER_SHA256)?DEPLOYMENT_TEST_WORKER_SHA256.toLowerCase():null;
}
function deploymentWorkerSha256(){return expectedWorkerSha256({});}
function randomChallenge(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');}
function executionFailure(test,startedAtDeviceTime,error){
  const disposition=error?.disposition===STATUS.UNDETERMINED?STATUS.UNDETERMINED:STATUS.EXECUTION_FAILED;
  return {testId:field(test,'TEST_ID')||test?.testId||null,testSpecVersion:SPEC_VERSION,testSpecSha256:null,status:disposition,determination:STATUS.UNDETERMINED,expected:null,actual:null,observations:[],evidence:[],executorVersion:VERSION,runtimeVersion:VERSION,runtimeBuildIdentity:runtimeBuildIdentity(),testWorkerSha256:null,workerProtocolVersion:WORKER_PROTOCOL_VERSION,inputArtifactIds:[],inputArtifactSha256Values:[],startedAtDeviceTime,endedAtDeviceTime:new Date().toISOString(),failure:{code:error?.code||'WORKER_EXECUTION_FAILED',message:String(error?.message||error)}};
}
function executeTest(test,artifacts,canonicalBindings,options={}){
  const spec=field(test,'EXECUTABLE_SPEC');const bindings=field(test,'EXECUTABLE_INPUT_BINDINGS');const check=validateSpec(spec,bindings);const startedAtDeviceTime=new Date().toISOString();if(!check.valid)return Promise.resolve(executionFailure(test,startedAtDeviceTime,new RuntimeError('INVALID_TEST_IR',check.issues.join(' '))));
  const workerSha256=expectedWorkerSha256(options);if(!workerSha256)return Promise.resolve(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_IDENTITY_UNAVAILABLE','The exact deployed test-worker.js SHA-256 was not injected or supplied; native execution fails closed.')));
  const WorkerClass=options.Worker||root.Worker;if(typeof WorkerClass!=='function')return Promise.resolve(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_UNAVAILABLE','The isolated Test IR worker is unavailable.')));
  return new Promise(resolve=>{
    const requestId=`test-ir-${randomChallenge()}`,workerChallengeNonce=randomChallenge();let settled=false;const worker=new WorkerClass(options.workerUrl||workerUrl());
    const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);try{worker.terminate();}catch{}resolve(result);};
    const timer=setTimeout(()=>finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_TIMEOUT',`Test IR worker exceeded ${LIMITS.workerTimeoutMs} ms.`))),Number(options.timeoutMs||LIMITS.workerTimeoutMs));
    worker.onmessage=event=>{const message=event?.data||{};if(message.requestId!==requestId)return;if(message.workerProtocolVersion!==WORKER_PROTOCOL_VERSION||message.workerChallengeNonce!==workerChallengeNonce){finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_IDENTITY_MISMATCH','Worker response protocol or challenge identity does not match the current execution.')));return;}if(message.ok){const result=message.result||{};if(result.runtimeBuildIdentity!==runtimeBuildIdentity()||result.workerProtocolVersion!==WORKER_PROTOCOL_VERSION||String(result.testWorkerSha256||'')!==String(workerSha256||'')){finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_IDENTITY_MISMATCH','Worker result build or byte identity does not match the current runtime manifest.')));return;}finish({...result,startedAtDeviceTime,endedAtDeviceTime:new Date().toISOString()});}else finish(executionFailure(test,startedAtDeviceTime,new RuntimeError(message.error?.code||'WORKER_EXECUTION_FAILED',message.error?.message||'Worker execution failed.',message.error?.disposition||STATUS.EXECUTION_FAILED)));};
    worker.onerror=event=>finish(executionFailure(test,startedAtDeviceTime,new RuntimeError('WORKER_ERROR',event?.message||'Test IR worker failed.')));
    try{worker.postMessage({type:'EXECUTE_TEST_IR',requestId,workerProtocolVersion:WORKER_PROTOCOL_VERSION,workerChallengeNonce,spec:normalizeSpec(spec),bindings,artifacts:artifacts||{},canonicalBindings:canonicalBindings||{},metadata:{testId:field(test,'TEST_ID')||test?.testId||null,bindings,runtimeBuildIdentity:runtimeBuildIdentity(),testWorkerSha256:workerSha256,workerProtocolVersion:WORKER_PROTOCOL_VERSION}});}catch(error){finish(executionFailure(test,startedAtDeviceTime,error));}
  });
}

const operationContracts=()=>JSON.parse(JSON.stringify(OP_DEFINITIONS));
const capabilities=()=>Object.freeze([CAPABILITY]);
root.closedLoopTestRuntime=Object.freeze({VERSION,SPEC_VERSION,EXECUTABLE_KIND,CAPABILITY,RUNTIME_BUILD_ID,DEPLOYMENT_TEST_WORKER_SHA256,WORKER_PROTOCOL_VERSION,OPS,OP_DEFINITIONS,LIMITS,STATUS,RuntimeError,validateSpec,validateBindings,normalizeSpec,supports,execute,executeTest,capabilities,operationContracts,sha256Canonical,validateResourceEnvelope,exactValueIssues,runtimeBuildIdentity,deploymentWorkerSha256});
})();

/* INTEGRATED CONTROLLING COMPLETION 53-70 */
;(()=>{
'use strict';
const r0=globalThis.closedLoopTestRuntime;
if(!r0)throw new Error('Base Test IR runtime must load before integrated completion runtime.');
const VERSION='closed-loop-controlling-completion/53-70/1',safe=v=>Array.isArray(v)?v:[],up=v=>String(v==null?'':v).trim().toUpperCase(),fv=(r,k)=>r?.fields?.[k]??r?.[k];
function exactIssues(spec){const out=[];const walk=(v,path='$')=>{if(typeof v==='number'&&(!Number.isSafeInteger(v)||Object.is(v,-0)))out.push(`${path} contains an unsupported numeric literal; use an exact typed number representation.`);if(Array.isArray(v))v.forEach((x,i)=>walk(x,`${path}[${i}]`));else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))walk(x,`${path}.${k}`);};walk(spec);return out;}function validate(spec){let b;try{b=r0.validateSpec(spec);}catch(err){return{valid:false,issues:[String(err?.message||err)]};}const issues=[...(b?.issues||[]),...exactIssues(spec)];return{...b,valid:issues.length===0,issues:[...new Set(issues)]};}const runtime=Object.freeze({...r0,VERSION:'closed-loop-test-runtime/3',__controllingCompletionAmendmentVersion:VERSION,validateSpec:validate,supports:test=>{const spec=fv(test,'EXECUTABLE_SPEC')||test?.EXECUTABLE_SPEC;return validate(spec).valid&&r0.supports(test);},execute:async (request,...args)=>{const spec=request?.spec??request;const v=validate(spec);if(!v.valid)throw new r0.RuntimeError('UNSUPPORTED_EXACT_SEMANTICS',v.issues.join(' '));return r0.execute(request,...args);},executeTest:async (test,...args)=>{const spec=fv(test,'EXECUTABLE_SPEC')||test?.EXECUTABLE_SPEC,v=validate(spec);if(!v.valid)throw new r0.RuntimeError('UNSUPPORTED_EXACT_SEMANTICS',v.issues.join(' '));return r0.executeTest(test,...args);}});globalThis.closedLoopTestRuntime=runtime;
})();

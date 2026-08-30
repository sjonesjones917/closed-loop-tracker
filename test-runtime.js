(()=>{
'use strict';

const root=globalThis;
const VERSION='closed-loop-test-runtime/1';
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
  SORT:{required:[],optional:['direction'],types:{direction:'sortDirection'}},
  UNIQUE:{required:[],optional:[],types:{}},
  HASH_SHA256:{required:[],optional:[],types:{}},
  REGEX:{required:['pattern'],optional:['flags'],types:{pattern:'regex',flags:'regexFlags'}},
  COMPARE:{required:[],optional:['value','binding','operator','numericMode','absoluteTolerance','relativeTolerance'],types:{binding:'binding',operator:'compareOperator',numericMode:'numericMode',absoluteTolerance:'nonnegativeNumber',relativeTolerance:'nonnegativeNumber'},oneOf:[['value'],['binding']]},
  ASSERT_EXISTS:{required:[],optional:['message'],types:{message:'string'}},
  ASSERT_TYPE:{required:['value'],optional:['message'],types:{value:'typeName',message:'string'}},
  ASSERT_NE:{required:['value'],optional:['message','numericMode','absoluteTolerance','relativeTolerance'],types:{message:'string',numericMode:'numericMode',absoluteTolerance:'nonnegativeNumber',relativeTolerance:'nonnegativeNumber'}},
  ASSERT_EQ:{required:['value'],optional:['message','numericMode','absoluteTolerance','relativeTolerance'],types:{message:'string',numericMode:'numericMode',absoluteTolerance:'nonnegativeNumber',relativeTolerance:'nonnegativeNumber'}},
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
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
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
  if(mode==='APPROXIMATE'){
    const a=Number(actual),b=Number(expected);if(!Number.isFinite(a)||!Number.isFinite(b))fail('INVALID_NUMERIC_VALUE','Approximate comparison requires finite numeric values.',STATUS.UNDETERMINED);const abs=Number(step.absoluteTolerance||0),rel=Number(step.relativeTolerance||0);return Math.abs(a-b)<=Math.max(abs,rel*Math.max(Math.abs(a),Math.abs(b)));
  }
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
    case 'utf8':return value==='UTF-8';case 'sortDirection':return ['ASC','DESC'].includes(value);
    case 'regex':return typeof value==='string';case 'regexFlags':return typeof value==='string';
    case 'jsonSelector':try{parseJsonSelector(value);return true;}catch{return false;}
    case 'xmlSelector':try{parseXmlSelector(value);return true;}catch{return false;}
    case 'compareOperator':return ['EQ','NE','GT','GTE','LT','LTE'].includes(value);
    case 'typeName':return ['string','number','boolean','object','array','null','undefined','bytes'].includes(value);
    case 'numericMode':return ['INTEGER','DECIMAL_STRING','APPROXIMATE'].includes(value);
    case 'nonnegativeNumber':return typeof value==='number'&&Number.isFinite(value)&&value>=0;
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
  if(['COMPARE','ASSERT_EQ'].includes(step.op)&&step.numericMode==='APPROXIMATE'&&!(Number(step.absoluteTolerance)>0||Number(step.relativeTolerance)>0))issues.push(`Step ${index} approximate comparison requires a positive absoluteTolerance or relativeTolerance.`);
  if(['COMPARE','ASSERT_EQ'].includes(step.op)&&typeof step.value==='number'&&!Number.isSafeInteger(step.value)&&step.numericMode!=='APPROXIMATE')issues.push(`Step ${index} non-integer numeric equality requires explicit APPROXIMATE semantics and tolerance.`);
  if(step.op==='PARSE_CSV'&&step.delimiter===step.quote)issues.push(`Step ${index} CSV delimiter and quote must differ.`);
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
  return {version:SPEC_VERSION,steps:spec.steps.map(step=>Object.fromEntries(Object.entries(step).sort(([a],[b])=>a==='op'?-1:b==='op'?1:a.localeCompare(b))))};
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
  const uniqueBuffers=new Set();let totalInputBytes=0;for(const artifact of Object.values(artifacts||{})){const bytes=bytesOf(artifact?.bytes??artifact);if(bytes&&!uniqueBuffers.has(bytes.buffer)){uniqueBuffers.add(bytes.buffer);totalInputBytes+=bytes.byteLength;}}
  const envelope=validateResourceEnvelope({totalInputBytes});if(!envelope.valid)fail('INPUT_BYTE_LIMIT',envelope.issues.join(' '));
  let value=null,current=null;const observations=[];let finalAssertion=null;const inputArtifactIds=[];const inputArtifactSha256Values=[];
  /* PREHASH_EVERY_BOUND_ARTIFACT: every consumed package input is identity-bound, even when a comparison operation references it without LOAD_ARTIFACT. */
  for(const [bindingName,artifact] of Object.entries(artifacts||{})){const bytes=bytesOf(artifact?.bytes??artifact);if(!bytes)continue;const calculated=await sha256(bytes);if(artifact?.sha256&&String(artifact.sha256).toLowerCase()!==calculated)fail('ARTIFACT_HASH_MISMATCH',`Artifact ${artifact.artifactId||bindingName} bytes do not match its declared SHA-256.`);inputArtifactIds.push(String(artifact?.artifactId||bindingName));inputArtifactSha256Values.push(calculated);}
  for(const [index,step] of normalized.steps.entries()){
    switch(step.op){
      case 'LOAD_ARTIFACT':{
        const resolved=resolveBinding(step.binding,artifacts,canonicalBindings);current=resolved;value=resolved.kind==='CANONICAL_VALUE'?(resolved.value?.value??resolved.value):resolved.value;
        if(resolved.kind==='ARTIFACT'){const artifact=resolved.value;const bytes=bytesOf(artifact?.bytes??artifact);const calculated=bytes?await sha256(bytes):null;if(artifact?.sha256&&calculated&&String(artifact.sha256).toLowerCase()!==calculated)fail('ARTIFACT_HASH_MISMATCH',`Artifact ${artifact.artifactId||step.binding} bytes do not match its declared SHA-256.`);inputArtifactIds.push(String(artifact?.artifactId||step.binding));inputArtifactSha256Values.push(calculated||String(artifact?.sha256||''));observations.push({step:index,op:step.op,binding:step.binding,bindingKind:'ARTIFACT',artifactId:artifact?.artifactId||null,filename:artifact?.filename||null,sha256:calculated||artifact?.sha256||null});}
        else observations.push({step:index,op:step.op,binding:step.binding,bindingKind:'CANONICAL_VALUE'});
        break;
      }
      case 'READ_BYTES':{const bytes=bytesOf(current?.kind==='ARTIFACT'?(current.value?.bytes??current.value):value);if(!bytes)fail('BYTES_REQUIRED','READ_BYTES requires a byte-backed artifact binding.');value=bytes;observations.push({step:index,op:step.op,byteLength:bytes.byteLength});break;}
      case 'DECODE_UTF8':{const bytes=bytesOf(value);if(!bytes)fail('BYTES_REQUIRED','DECODE_UTF8 requires bytes.');if(bytes.byteLength>LIMITS.maxTextBytes)fail('TEXT_BYTE_LIMIT','UTF-8 input exceeds the registered text-byte limit.');if(bytes.byteLength>LIMITS.maxDecompressedBytes)fail('DECOMPRESSED_BYTE_LIMIT','UTF-8 input exceeds the registered decompressed-byte limit.');try{value=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('INVALID_UTF8','Input is not valid UTF-8.',STATUS.UNDETERMINED);}break;}
      case 'PARSE_JSON':{try{value=JSON.parse(String(value));}catch(error){fail('MALFORMED_JSON',`JSON parse failed: ${error.message}`,STATUS.UNDETERMINED);}inspectStructure(value);break;}
      case 'PARSE_CSV':value=parseCsv(String(value),step);inspectStructure(value);break;
      case 'PARSE_XML':value=parseXml(String(value));inspectStructure(value);break;
      case 'SELECT_JSON_PATH':value=selectJsonPath(value,step.path);break;
      case 'SELECT_XML':value=selectXml(value,step.path);break;
      case 'COUNT':{if(value==null||typeof value.length!=='number')fail('COUNT_INPUT','COUNT requires an array, string, or array-like value.',STATUS.UNDETERMINED);if(value.length>LIMITS.maxCollectionItems)fail('COLLECTION_LIMIT','COUNT input exceeds the registered collection limit.');value=value.length;break;}
      case 'SUM':case 'MIN':case 'MAX':{const values=collection(value,step.op);if(!values.every(isSafeIntegerValue))fail('UNSUPPORTED_NUMERIC_PRECISION',`${step.op} supports safe integers only in version 1.`,STATUS.UNDETERMINED);value=step.op==='SUM'?values.reduce((sum,item)=>{const next=sum+item;if(!Number.isSafeInteger(next))fail('INTEGER_OVERFLOW','SUM exceeded exact safe-integer range.',STATUS.UNDETERMINED);return next;},0):step.op==='MIN'?Math.min(...values):Math.max(...values);break;}
      case 'SORT':{const direction=step.direction||'ASC';value=[...collection(value,'SORT')].sort((a,b)=>canonical(a).localeCompare(canonical(b)));if(direction==='DESC')value.reverse();break;}
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
  return {
    testId:metadata.testId||null,
    testSpecVersion:SPEC_VERSION,
    testSpecSha256,
    status:'COMPLETE',
    determination:finalAssertion?.determination||STATUS.UNDETERMINED,
    expected:finalAssertion?.expected??null,
    actual:finalAssertion?.actual??value,
    observations,
    evidence:[{kind:'APPLICATION_NATIVE_RUNTIME_OBSERVATION',testSpecSha256,inputArtifactIds:[...new Set(inputArtifactIds)],inputArtifactSha256Values:[...new Set(inputArtifactSha256Values)]}],
    executorVersion:VERSION,
    runtimeVersion:VERSION,
    inputArtifactIds:[...new Set(inputArtifactIds)],
    inputArtifactSha256Values:[...new Set(inputArtifactSha256Values)]
  };
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

const operationContracts=()=>JSON.parse(JSON.stringify(OP_DEFINITIONS));
const capabilities=()=>Object.freeze([CAPABILITY]);
root.closedLoopTestRuntime=Object.freeze({VERSION,SPEC_VERSION,EXECUTABLE_KIND,CAPABILITY,OPS,OP_DEFINITIONS,LIMITS,STATUS,RuntimeError,validateSpec,validateBindings,normalizeSpec,supports,execute,executeTest,capabilities,operationContracts,sha256Canonical,validateResourceEnvelope});
})();

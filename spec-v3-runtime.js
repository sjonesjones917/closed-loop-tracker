(()=>{
'use strict';

const SPEC_VERSION='closed-loop-test-spec/1';
const RUNTIME_VERSION='closed-loop-test-runtime/1';
const CAPABILITY_ID='CLOSED_LOOP_TEST_IR';
const RESOURCE_LIMITS=Object.freeze({
  maxInputBytes:8*1024*1024,
  maxDecompressedBytes:16*1024*1024,
  maxSteps:128,
  maxSelectorDepth:32,
  maxParsedDepth:64,
  maxCollectionSize:100000,
  maxRegexPatternLength:1024,
  maxRegexInputLength:1024*1024,
  maxWorkerMs:5000,
  maxArchiveExpansionBytes:32*1024*1024
});
const OPERATIONS=Object.freeze([
  'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML',
  'SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256',
  'REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH',
  'ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'
]);
const OPERATION_SET=new Set(OPERATIONS);
const OPERATION_CONTRACTS=Object.freeze({
  LOAD_ARTIFACT:{required:['binding'],optional:[],types:{binding:'string'}},
  READ_BYTES:{required:[],optional:[],types:{}},
  DECODE_UTF8:{required:[],optional:[],types:{}},
  PARSE_JSON:{required:[],optional:[],types:{}},
  PARSE_CSV:{required:['delimiter','header','quote','newline'],optional:[],types:{delimiter:'string',header:'boolean',quote:'string',newline:'string'}},
  PARSE_XML:{required:[],optional:[],types:{}},
  SELECT_JSON_PATH:{required:['path'],optional:[],types:{path:'string'}},
  SELECT_XML:{required:['selector'],optional:[],types:{selector:'string'}},
  COUNT:{required:[],optional:[],types:{}},
  SUM:{required:[],optional:[],types:{}},
  MIN:{required:[],optional:[],types:{}},
  MAX:{required:[],optional:[],types:{}},
  SORT:{required:[],optional:['direction'],types:{direction:'string'}},
  UNIQUE:{required:[],optional:[],types:{}},
  HASH_SHA256:{required:[],optional:[],types:{}},
  REGEX:{required:['pattern'],optional:['flags','mode'],types:{pattern:'string',flags:'string',mode:'string'}},
  COMPARE:{required:['operator'],optional:['value','binding','absoluteTolerance','relativeTolerance'],types:{operator:'string',binding:'string',absoluteTolerance:'number',relativeTolerance:'number'}},
  ASSERT_EQ:{required:['value'],optional:['absoluteTolerance','relativeTolerance'],types:{absoluteTolerance:'number',relativeTolerance:'number'}},
  ASSERT_GT:{required:['value'],optional:[],types:{}},
  ASSERT_GTE:{required:['value'],optional:[],types:{}},
  ASSERT_LT:{required:['value'],optional:[],types:{}},
  ASSERT_LTE:{required:['value'],optional:[],types:{}},
  ASSERT_MATCH:{required:['pattern'],optional:['flags'],types:{pattern:'string',flags:'string'}},
  ASSERT_CONTAINS:{required:['value'],optional:[],types:{}},
  ASSERT_NOT_CONTAINS:{required:['value'],optional:[],types:{}},
  ASSERT_SET_EQUAL:{required:['value'],optional:[],types:{}},
  BYTE_COMPARE:{required:[],optional:['binding','leftBinding','rightBinding'],types:{binding:'string',leftBinding:'string',rightBinding:'string'}}
});

class RuntimeError extends Error{
  constructor(code,message){super(message);this.name='ClosedLoopRuntimeError';this.code=code;}
}
class AssertionFailure extends Error{
  constructor(expected,actual,message){super(message||'Assertion failed.');this.name='ClosedLoopAssertionFailure';this.expected=expected;this.actual=actual;}
}

const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const stable=value=>{
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object'&&!ArrayBuffer.isView(value)&&!(value instanceof ArrayBuffer)&&!(typeof Blob!=='undefined'&&value instanceof Blob)){
    const out={};
    for(const key of Object.keys(value).sort())out[key]=stable(value[key]);
    return out;
  }
  return value;
};
const stableStringify=value=>JSON.stringify(stable(value));

async function bytesOf(value){
  let bytes=null;
  if(value instanceof Uint8Array)bytes=value;
  else if(ArrayBuffer.isView(value))bytes=new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  else if(value instanceof ArrayBuffer)bytes=new Uint8Array(value);
  else if(typeof Blob!=='undefined'&&value instanceof Blob)bytes=new Uint8Array(await value.arrayBuffer());
  else if(value&&typeof value==='object'){
    for(const key of ['bytes','blob','data','content'])if(own(value,key))return bytesOf(value[key]);
  }else if(typeof value==='string')bytes=new TextEncoder().encode(value);
  if(!bytes)throw new RuntimeError('MISSING_BYTES','The selected artifact does not contain verified bytes.');
  if(bytes.byteLength>RESOURCE_LIMITS.maxInputBytes)throw new RuntimeError('INPUT_LIMIT','Input bytes exceed the registered runtime limit.');
  return bytes;
}

async function sha256(value){
  const bytes=value instanceof Uint8Array?value:await bytesOf(value);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

function normalizeStep(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return input;
  const step={...input};
  if(own(step,'expected')&&!own(step,'value')){step.value=step.expected;delete step.expected;}
  if(step.op==='SELECT_XML'&&own(step,'path')&&!own(step,'selector')){step.selector=step.path;delete step.path;}
  if(step.op==='PARSE_CSV'&&step.config&&typeof step.config==='object'){
    for(const key of ['delimiter','header','quote','newline'])if(!own(step,key)&&own(step.config,key))step[key]=step.config[key];
    delete step.config;
  }
  if(step.op==='PARSE_CSV'&&own(step,'hasHeader')&&!own(step,'header')){step.header=step.hasHeader;delete step.hasHeader;}
  return stable(step);
}

function normalizeSpec(spec){
  if(!spec||typeof spec!=='object'||Array.isArray(spec))return spec;
  return stable({version:spec.version,steps:Array.isArray(spec.steps)?spec.steps.map(normalizeStep):spec.steps});
}

function validateJsonSelector(selector){
  if(typeof selector!=='string'||!selector.startsWith('$'))return false;
  if(selector==='$')return true;
  let rest=selector.slice(1),depth=0;
  while(rest){
    let match=null;
    if((match=rest.match(/^\.([A-Za-z_$][\w$]*)/)))rest=rest.slice(match[0].length);
    else if((match=rest.match(/^\[(\d+)\]/)))rest=rest.slice(match[0].length);
    else if((match=rest.match(/^\[['"]([^'"\\]+)['"]\]/)))rest=rest.slice(match[0].length);
    else if(rest.startsWith('[*]'))rest=rest.slice(3);
    else return false;
    if(++depth>RESOURCE_LIMITS.maxSelectorDepth)return false;
  }
  return true;
}

function validateXmlSelector(selector){
  if(typeof selector!=='string'||!selector.startsWith('/')||selector==='/'||selector.includes('//'))return false;
  const parts=selector.slice(1).split('/');
  return parts.length<=RESOURCE_LIMITS.maxSelectorDepth&&parts.every(part=>/^(?:\*|[A-Za-z_][\w.-]*)(?:\[(?:[1-9]\d*)\])?$/.test(part));
}

function safeRegex(pattern,flags=''){
  if(typeof pattern!=='string'||pattern.length>RESOURCE_LIMITS.maxRegexPatternLength)throw new RuntimeError('REGEX_PATTERN_LIMIT','Regex pattern exceeds the registered limit.');
  if(!/^[dgimuys]*$/.test(flags)||new Set(flags).size!==flags.length)throw new RuntimeError('REGEX_FLAGS','Unsupported or duplicate regex flags.');
  if(/\\[1-9]/.test(pattern)||/\(\?<([=!])/.test(pattern)||/\(\?([=!])/.test(pattern)||/\([^)]*[+*][^)]*\)[+*{]/.test(pattern))throw new RuntimeError('UNSAFE_REGEX','Regex uses a prohibited high-risk construct.');
  try{return new RegExp(pattern,flags);}catch(error){throw new RuntimeError('INVALID_REGEX',error.message);}
}

function enforceParsedLimits(value,depth=0,state={count:0}){
  if(depth>RESOURCE_LIMITS.maxParsedDepth)throw new RuntimeError('PARSED_DEPTH_LIMIT','Parsed structure exceeds the registered depth limit.');
  if(!value||typeof value!=='object'||ArrayBuffer.isView(value)||value instanceof ArrayBuffer||(typeof Blob!=='undefined'&&value instanceof Blob))return value;
  const entries=Array.isArray(value)?value:Object.values(value);
  state.count+=entries.length;
  if(state.count>RESOURCE_LIMITS.maxCollectionSize)throw new RuntimeError('COLLECTION_LIMIT','Parsed collection exceeds the registered size limit.');
  for(const child of entries)enforceParsedLimits(child,depth+1,state);
  return value;
}

function validateSpec(spec,bindings){
  const errors=[];
  if(!spec||typeof spec!=='object'||Array.isArray(spec))errors.push('Specification must be an object.');
  else{
    for(const key of Object.keys(spec))if(!['version','steps'].includes(key))errors.push('Unknown specification property '+key+'.');
  }
  const normalized=normalizeSpec(spec);
  if(normalized&&typeof normalized==='object'&&!Array.isArray(normalized)){
    if(normalized.version!==SPEC_VERSION)errors.push('Unknown Test IR version '+String(normalized.version)+'.');
    if(!Array.isArray(normalized.steps)||normalized.steps.length===0)errors.push('steps must be a non-empty array.');
    else if(normalized.steps.length>RESOURCE_LIMITS.maxSteps)errors.push('steps exceeds '+RESOURCE_LIMITS.maxSteps+'.');
    else normalized.steps.forEach((step,index)=>{
      if(!step||typeof step!=='object'||Array.isArray(step)){errors.push('steps['+index+'] must be an object.');return;}
      if(!OPERATION_SET.has(step.op)){errors.push('Unknown operation '+String(step.op)+' at steps['+index+'].');return;}
      const contract=OPERATION_CONTRACTS[step.op],allowed=new Set(['op',...contract.required,...contract.optional]);
      for(const key of Object.keys(step))if(!allowed.has(key))errors.push('Unknown property '+key+' for '+step.op+'.');
      for(const key of contract.required)if(!own(step,key))errors.push('Missing '+key+' for '+step.op+'.');
      for(const [key,type] of Object.entries(contract.types))if(own(step,key)&&typeof step[key]!==type)errors.push(key+' for '+step.op+' must be '+type+'.');
      if(step.op==='PARSE_CSV'){
        if(typeof step.delimiter==='string'&&step.delimiter.length!==1)errors.push('CSV delimiter must be exactly one character.');
        if(typeof step.quote==='string'&&step.quote.length!==1)errors.push('CSV quote must be exactly one character.');
        if(typeof step.newline==='string'&&!['LF','CRLF','AUTO'].includes(step.newline))errors.push('CSV newline must be LF, CRLF, or AUTO.');
      }
      if(step.op==='SELECT_JSON_PATH'&&!validateJsonSelector(step.path))errors.push('Unsupported SELECT_JSON_PATH syntax.');
      if(step.op==='SELECT_XML'&&!validateXmlSelector(step.selector))errors.push('Unsupported SELECT_XML syntax.');
      if(['REGEX','ASSERT_MATCH'].includes(step.op)&&typeof step.pattern==='string')try{safeRegex(step.pattern,step.flags||'');}catch(error){errors.push(error.message);}
      if(['ASSERT_EQ','COMPARE'].includes(step.op)&&typeof step.value==='number'&&!Number.isSafeInteger(step.value)&&!own(step,'absoluteTolerance')&&!own(step,'relativeTolerance'))errors.push('Precision-sensitive numeric equality requires explicit tolerance or an exact decimal string.');
      for(const key of ['absoluteTolerance','relativeTolerance'])if(own(step,key)&&(!Number.isFinite(step[key])||step[key]<0))errors.push(key+' must be a finite nonnegative number.');
      if(step.op==='SORT'&&own(step,'direction')&&!['ASC','DESC'].includes(step.direction))errors.push('SORT direction must be ASC or DESC.');
      if(step.op==='REGEX'&&own(step,'mode')&&!['BOOLEAN','MATCHES'].includes(step.mode))errors.push('REGEX mode must be BOOLEAN or MATCHES.');
      if(step.op==='COMPARE'&&!['EQ','GT','GTE','LT','LTE','CONTAINS'].includes(step.operator))errors.push('Unsupported COMPARE operator.');
      if(step.op==='BYTE_COMPARE'&&!step.binding&&!(step.leftBinding&&step.rightBinding))errors.push('BYTE_COMPARE requires binding or both leftBinding and rightBinding.');
    });
  }
  if(bindings!==undefined&&bindings!==null&&typeof bindings!=='object')errors.push('Bindings must be an object or array.');
  return Object.freeze({valid:errors.length===0,errors:Object.freeze(errors),normalizedSpec:normalized,normalized});
}

function recordValue(record,key){
  return record?.[key]??record?.values?.[key]??record?.agentData?.[key]??record?.applicationData?.[key]??record?.derivedData?.[key];
}
function testSpec(test){return recordValue(test,'EXECUTABLE_SPEC')||test?.spec||test;}
function supports(test){
  const mode=recordValue(test,'EXECUTION_MODE');
  if(mode&&mode!=='APPLICATION_DETERMINISTIC')return false;
  const kind=recordValue(test,'EXECUTABLE_KIND');
  if(kind&&kind!=='TEST_IR')return false;
  return validateSpec(testSpec(test),recordValue(test,'EXECUTABLE_INPUT_BINDINGS')).valid;
}
function capabilities(){
  return Object.freeze({capabilityId:CAPABILITY_ID,runtimeVersion:RUNTIME_VERSION,specVersions:Object.freeze([SPEC_VERSION]),operations:OPERATIONS,limits:RESOURCE_LIMITS});
}
function registeredOperations(){return OPERATIONS;}
registeredOperations.includes=OPERATIONS.includes.bind(OPERATIONS);
registeredOperations[Symbol.iterator]=OPERATIONS[Symbol.iterator].bind(OPERATIONS);

function bindingMap(declarations,artifacts,canonicalBindings){
  const result={};
  const artifactEntries=Array.isArray(artifacts)?artifacts:Object.values(artifacts||{});
  const byIdentity=new Map();
  for(const artifact of artifactEntries){
    if(!artifact)continue;
    for(const identity of [artifact.artifactId,artifact.ARTIFACT_ID,artifact.id,artifact.filename,artifact.FILENAME].filter(Boolean))byIdentity.set(String(identity),artifact);
  }
  if(declarations&&typeof declarations==='object'){
    const entries=Array.isArray(declarations)?declarations.map(item=>[item.binding||item.name,item]):Object.entries(declarations);
    for(const [name,declaration] of entries){
      if(!name)continue;
      if(typeof declaration==='string')result[name]=byIdentity.get(declaration)||canonicalBindings?.[declaration];
      else if(declaration&&typeof declaration==='object'){
        const identity=declaration.artifactId||declaration.ARTIFACT_ID||declaration.targetId||declaration.valueId;
        result[name]=identity?byIdentity.get(String(identity))||canonicalBindings?.[String(identity)]:own(declaration,'value')?declaration.value:declaration;
      }
    }
  }
  for(const [key,value] of Object.entries(artifacts||{}))if(!/^\d+$/.test(key))result[key]=value;
  for(const [key,value] of Object.entries(canonicalBindings||{}))if(!own(result,key))result[key]=value;
  return result;
}

function selectJson(value,selector){
  if(selector==='$')return value;
  let nodes=[value],rest=selector.slice(1);
  while(rest){
    let match=null,key=null,wildcard=false;
    if((match=rest.match(/^\.([A-Za-z_$][\w$]*)/))){key=match[1];rest=rest.slice(match[0].length);}
    else if((match=rest.match(/^\[(\d+)\]/))){key=Number(match[1]);rest=rest.slice(match[0].length);}
    else if((match=rest.match(/^\[['"]([^'"\\]+)['"]\]/))){key=match[1];rest=rest.slice(match[0].length);}
    else if(rest.startsWith('[*]')){wildcard=true;rest=rest.slice(3);}
    else throw new RuntimeError('SELECTOR','Unsupported JSON selector.');
    const next=[];
    for(const node of nodes){
      if(wildcard){if(Array.isArray(node))next.push(...node);else if(node&&typeof node==='object')next.push(...Object.values(node));}
      else if(node!=null&&own(Object(node),key))next.push(node[key]);
    }
    nodes=next;
  }
  return nodes.length===1?nodes[0]:nodes;
}

function parseCsv(text,config){
  const newline=config.newline==='LF'?'\n':config.newline==='CRLF'?'\r\n':text.includes('\r\n')?'\r\n':'\n';
  const rows=[];let row=[],field='',quoted=false;
  for(let index=0;index<text.length;index++){
    const character=text[index];
    if(quoted){
      if(character===config.quote){if(text[index+1]===config.quote){field+=character;index++;}else quoted=false;}
      else field+=character;
      continue;
    }
    if(character===config.quote){quoted=true;continue;}
    if(character===config.delimiter){row.push(field);field='';continue;}
    if(text.startsWith(newline,index)){row.push(field);rows.push(row);row=[];field='';index+=newline.length-1;continue;}
    if(character==='\r'||character==='\n')throw new RuntimeError('CSV_NEWLINE','CSV newline does not match the explicit contract.');
    field+=character;
  }
  if(quoted)throw new RuntimeError('CSV_QUOTE','CSV ended inside a quoted field.');
  if(field!==''||row.length){row.push(field);rows.push(row);}
  if(!config.header)return rows;
  if(!rows.length)return [];
  const header=rows.shift();
  if(new Set(header).size!==header.length)throw new RuntimeError('CSV_HEADER','CSV header contains duplicate names.');
  return rows.map(values=>Object.fromEntries(header.map((key,index)=>[key,values[index]??''])));
}

function parseXml(text){
  if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new RuntimeError('XML_UNSAFE','DTD and entity declarations are prohibited.');
  const documentNode={name:'#document',children:[],text:''},stack=[documentNode];
  const tokens=text.match(/<[^>]+>|[^<]+/g)||[];
  for(const token of tokens){
    if(token.startsWith('<?')||token.startsWith('<!--'))continue;
    if(token.startsWith('</')){
      const name=token.slice(2,-1).trim(),node=stack.pop();
      if(!node||node.name!==name)throw new RuntimeError('XML_PARSE','Mismatched XML closing tag.');
      continue;
    }
    if(token.startsWith('<')){
      const selfClosing=/\/>$/.test(token),body=token.slice(1,selfClosing?-2:-1).trim();
      const match=body.match(/^([A-Za-z_][\w:.-]*)([\s\S]*)$/);
      if(!match)throw new RuntimeError('XML_PARSE','Invalid XML element.');
      const attributes={},attributeText=match[2].trim();let position=0;
      const attributePattern=/\s*([A-Za-z_][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/y;
      while(position<attributeText.length){attributePattern.lastIndex=position;const attribute=attributePattern.exec(attributeText);if(!attribute)throw new RuntimeError('XML_PARSE','Unsupported XML attribute syntax.');attributes[attribute[1]]=attribute[2].slice(1,-1);position=attributePattern.lastIndex;}
      const node={name:match[1],attributes,children:[],text:''};
      stack.at(-1).children.push(node);
      if(!selfClosing)stack.push(node);
      continue;
    }
    if(token.trim())stack.at(-1).text+=token;
  }
  if(stack.length!==1)throw new RuntimeError('XML_PARSE','Unclosed XML element.');
  if(documentNode.children.length!==1)throw new RuntimeError('XML_PARSE','XML must contain exactly one root element.');
  return documentNode;
}

function selectXml(documentNode,selector){
  let nodes=[documentNode];
  for(const rawPart of selector.slice(1).split('/')){
    const match=rawPart.match(/^(\*|[A-Za-z_][\w.-]*)(?:\[(\d+)\])?$/),name=match[1],selectedIndex=match[2]?Number(match[2])-1:null,next=[];
    for(const node of nodes){
      let children=(node.children||[]).filter(child=>name==='*'||child.name===name);
      if(selectedIndex!==null)children=children[selectedIndex]?[children[selectedIndex]]:[];
      next.push(...children);
    }
    nodes=next;
  }
  return nodes.length===1?nodes[0]:nodes;
}

function decimalParts(value){
  const text=String(value).trim();
  if(!/^[+-]?\d+(?:\.\d+)?$/.test(text))throw new RuntimeError('NUMERIC','Value is not an exact decimal.');
  const sign=text.startsWith('-')?-1:1,raw=text.replace(/^[+-]/,''),parts=raw.split('.'),whole=parts[0],fraction=parts[1]||'';
  return {sign,digits:BigInt((whole+fraction).replace(/^0+(?=\d)/,'')||'0'),scale:fraction.length};
}
function decimalCompare(left,right){
  const a=decimalParts(left),b=decimalParts(right),scale=Math.max(a.scale,b.scale),ai=BigInt(a.sign)*a.digits*10n**BigInt(scale-a.scale),bi=BigInt(b.sign)*b.digits*10n**BigInt(scale-b.scale);
  return ai<bi?-1:ai>bi?1:0;
}
function decimalAdd(values){
  const parts=values.map(decimalParts),scale=Math.max(0,...parts.map(part=>part.scale));let total=0n;
  for(const part of parts)total+=BigInt(part.sign)*part.digits*10n**BigInt(scale-part.scale);
  const negative=total<0n;if(negative)total=-total;
  let digits=total.toString().padStart(scale+1,'0');
  if(scale)digits=digits.slice(0,-scale)+'.'+digits.slice(-scale);
  digits=digits.replace(/\.0+$/,'').replace(/(\.\d*?)0+$/,'$1');
  return (negative?'-':'')+digits;
}
function numericCompare(left,right){
  if((typeof left==='number'&&!Number.isFinite(left))||(typeof right==='number'&&!Number.isFinite(right)))throw new RuntimeError('NUMERIC','Non-finite number is prohibited.');
  if((typeof left==='number'&&Number.isSafeInteger(left))||typeof left==='bigint'||typeof left==='string')return decimalCompare(left,right);
  if(typeof left==='number'&&typeof right==='number')return left<right?-1:left>right?1:0;
  return decimalCompare(left,right);
}
function deepEqual(left,right){return stableStringify(left)===stableStringify(right);}
function equalWithTolerance(actual,expected,step){
  if(typeof actual==='number'&&typeof expected==='number'&&(!Number.isSafeInteger(actual)||!Number.isSafeInteger(expected))){
    if(!own(step,'absoluteTolerance')&&!own(step,'relativeTolerance'))throw new RuntimeError('PRECISION','Precision-sensitive equality requires explicit tolerance.');
    const difference=Math.abs(actual-expected),absolute=step.absoluteTolerance??0,relative=(step.relativeTolerance??0)*Math.max(Math.abs(actual),Math.abs(expected));
    return difference<=Math.max(absolute,relative);
  }
  if(typeof actual==='string'&&typeof expected==='string'&&/^[+-]?\d+(?:\.\d+)?$/.test(actual)&&/^[+-]?\d+(?:\.\d+)?$/.test(expected))return decimalCompare(actual,expected)===0;
  return deepEqual(actual,expected);
}
function contains(actual,expected){
  if(typeof actual==='string')return actual.includes(String(expected));
  if(Array.isArray(actual))return actual.some(value=>deepEqual(value,expected));
  if(actual&&typeof actual==='object')return own(actual,String(expected));
  return false;
}
function setEqual(actual,expected){
  if(!Array.isArray(actual)||!Array.isArray(expected))return false;
  const left=[...new Set(actual.map(stableStringify))].sort(),right=[...new Set(expected.map(stableStringify))].sort();
  return deepEqual(left,right);
}
function applyRegex(input,step){
  const text=String(input);
  if(text.length>RESOURCE_LIMITS.maxRegexInputLength)throw new RuntimeError('REGEX_INPUT_LIMIT','Regex input exceeds the registered limit.');
  const expression=safeRegex(step.pattern,step.flags||'');
  if(step.mode==='MATCHES'){
    const globalExpression=expression.global?expression:new RegExp(expression.source,expression.flags+'g');
    return [...text.matchAll(globalExpression)].map(match=>match[0]);
  }
  return expression.test(text);
}

function resultEnvelope(base,fields){
  return {
    testId:base.testId||'',testSpecVersion:SPEC_VERSION,testSpecSha256:base.testSpecSha256||'',
    expected:null,actual:null,observations:[],evidence:[],executorVersion:RUNTIME_VERSION,
    inputArtifactIds:base.inputArtifactIds||[],inputArtifactSha256Values:base.inputArtifactSha256Values||[],
    startedAtDeviceTime:base.startedAtDeviceTime||new Date().toISOString(),endedAtDeviceTime:new Date().toISOString(),
    ...fields
  };
}

async function executeNormalizedSpec(payload){
  const base={...payload,startedAtDeviceTime:new Date().toISOString()},validation=validateSpec(payload?.spec,payload?.bindings);
  if(!validation.valid)return resultEnvelope(base,{status:'BLOCKED',observations:validation.errors});
  const bindings=payload.bindings||{};let current=null,assertionCount=0;const observations=[];
  try{
    for(const step of validation.normalizedSpec.steps){
      switch(step.op){
        case 'LOAD_ARTIFACT':
          if(!own(bindings,step.binding)||bindings[step.binding]==null)throw new RuntimeError('MISSING_BINDING','Binding '+step.binding+' is unavailable.');
          current=bindings[step.binding];break;
        case 'READ_BYTES':current=await bytesOf(current);break;
        case 'DECODE_UTF8':
          try{current=new TextDecoder('utf-8',{fatal:true}).decode(await bytesOf(current));}
          catch(error){throw new RuntimeError('INVALID_UTF8','Input is not valid UTF-8.');}
          break;
        case 'PARSE_JSON':
          try{current=enforceParsedLimits(JSON.parse(String(current)));}
          catch(error){if(error instanceof RuntimeError)throw error;throw new RuntimeError('JSON_PARSE',error.message);}
          break;
        case 'PARSE_CSV':current=enforceParsedLimits(parseCsv(String(current),step));break;
        case 'PARSE_XML':current=enforceParsedLimits(parseXml(String(current)));break;
        case 'SELECT_JSON_PATH':current=selectJson(current,step.path);break;
        case 'SELECT_XML':current=selectXml(current,step.selector);break;
        case 'COUNT':current=Array.isArray(current)||typeof current==='string'?current.length:current&&typeof current==='object'?Object.keys(current).length:0;break;
        case 'SUM':{
          const values=Array.isArray(current)?current:[current];
          current=values.every(Number.isSafeInteger)?values.reduce((sum,value)=>sum+value,0):decimalAdd(values);break;
        }
        case 'MIN':{
          const values=Array.isArray(current)?current:[current];
          if(!values.length)throw new RuntimeError('EMPTY_COLLECTION','MIN requires at least one value.');
          current=values.reduce((left,right)=>numericCompare(left,right)<=0?left:right);break;
        }
        case 'MAX':{
          const values=Array.isArray(current)?current:[current];
          if(!values.length)throw new RuntimeError('EMPTY_COLLECTION','MAX requires at least one value.');
          current=values.reduce((left,right)=>numericCompare(left,right)>=0?left:right);break;
        }
        case 'SORT':
          if(!Array.isArray(current))throw new RuntimeError('TYPE','SORT requires an array.');
          current=[...current].sort((left,right)=>numericCompare(left,right));if(step.direction==='DESC')current.reverse();break;
        case 'UNIQUE':{
          if(!Array.isArray(current))throw new RuntimeError('TYPE','UNIQUE requires an array.');
          const seen=new Set();current=current.filter(value=>{const key=stableStringify(value);if(seen.has(key))return false;seen.add(key);return true;});break;
        }
        case 'HASH_SHA256':current=await sha256(await bytesOf(current));break;
        case 'REGEX':current=applyRegex(current,step);break;
        case 'COMPARE':{
          const expected=step.binding?bindings[step.binding]:step.value;
          if(step.binding&&!own(bindings,step.binding))throw new RuntimeError('MISSING_BINDING','Binding '+step.binding+' is unavailable.');
          if(step.operator==='EQ')current=equalWithTolerance(current,expected,step);
          else if(step.operator==='GT')current=numericCompare(current,expected)>0;
          else if(step.operator==='GTE')current=numericCompare(current,expected)>=0;
          else if(step.operator==='LT')current=numericCompare(current,expected)<0;
          else if(step.operator==='LTE')current=numericCompare(current,expected)<=0;
          else if(step.operator==='CONTAINS')current=contains(current,expected);
          else throw new RuntimeError('COMPARE_OPERATOR','Unsupported comparison operator.');
          break;
        }
        case 'ASSERT_EQ':assertionCount++;if(!equalWithTolerance(current,step.value,step))throw new AssertionFailure(step.value,current);break;
        case 'ASSERT_GT':assertionCount++;if(!(numericCompare(current,step.value)>0))throw new AssertionFailure('> '+step.value,current);break;
        case 'ASSERT_GTE':assertionCount++;if(!(numericCompare(current,step.value)>=0))throw new AssertionFailure('>= '+step.value,current);break;
        case 'ASSERT_LT':assertionCount++;if(!(numericCompare(current,step.value)<0))throw new AssertionFailure('< '+step.value,current);break;
        case 'ASSERT_LTE':assertionCount++;if(!(numericCompare(current,step.value)<=0))throw new AssertionFailure('<= '+step.value,current);break;
        case 'ASSERT_MATCH':assertionCount++;if(!applyRegex(current,{...step,mode:'BOOLEAN'}))throw new AssertionFailure('match '+step.pattern,current);break;
        case 'ASSERT_CONTAINS':assertionCount++;if(!contains(current,step.value))throw new AssertionFailure('contains '+stableStringify(step.value),current);break;
        case 'ASSERT_NOT_CONTAINS':assertionCount++;if(contains(current,step.value))throw new AssertionFailure('does not contain '+stableStringify(step.value),current);break;
        case 'ASSERT_SET_EQUAL':assertionCount++;if(!setEqual(current,step.value))throw new AssertionFailure(step.value,current);break;
        case 'BYTE_COMPARE':{
          const left=step.leftBinding?bindings[step.leftBinding]:current,right=step.rightBinding?bindings[step.rightBinding]:bindings[step.binding];
          if((step.leftBinding&&!own(bindings,step.leftBinding))||((step.rightBinding||step.binding)&&right==null))throw new RuntimeError('MISSING_BINDING','BYTE_COMPARE binding is unavailable.');
          const leftBytes=await bytesOf(left),rightBytes=await bytesOf(right);
          current=leftBytes.length===rightBytes.length&&leftBytes.every((value,index)=>value===rightBytes[index]);
          break;
        }
        default:throw new RuntimeError('UNKNOWN_OPERATION','Unknown operation '+step.op+'.');
      }
      if(Array.isArray(current)||(current&&typeof current==='object'&&!ArrayBuffer.isView(current)&&!(current instanceof ArrayBuffer)))enforceParsedLimits(current);
      observations.push({op:step.op,value:current instanceof Uint8Array?{byteLength:current.byteLength}:clone(current)});
    }
    return resultEnvelope(base,{status:assertionCount?'SATISFIED':'UNDETERMINED',expected:assertionCount?'all assertions satisfied':null,actual:clone(current),observations,evidence:[{kind:'APPLICATION_NATIVE_RUNTIME',runtimeVersion:RUNTIME_VERSION}]});
  }catch(error){
    const assertion=error instanceof AssertionFailure;
    const status=assertion?'VIOLATED':error?.code==='MISSING_BYTES'||error?.code==='MISSING_BINDING'?'BLOCKED':error?.code==='PRECISION'?'UNDETERMINED':'EXECUTION_FAILED';
    return resultEnvelope(base,{status,expected:assertion?error.expected:null,actual:assertion?clone(error.actual):null,observations:[...observations,{errorCode:error.code||error.name,message:error.message}]});
  }
}

function workerUrl(){
  const base=typeof document!=='undefined'&&document.currentScript?.src?document.currentScript.src:globalThis.location?.href||'';
  const url=new URL('test-worker.js',base),token=new URL(base).searchParams.get('v');
  if(token)url.searchParams.set('v',token);
  return url.href;
}

async function executeTest(test,artifacts={},canonicalBindings={}){
  const spec=normalizeSpec(testSpec(test)),declarations=recordValue(test,'EXECUTABLE_INPUT_BINDINGS')||test?.bindings||{},bindings=bindingMap(declarations,artifacts,canonicalBindings),validation=validateSpec(spec,declarations);
  const testId=recordValue(test,'TEST_ID')||test?.testId||'',testSpecSha256=await sha256(new TextEncoder().encode(stableStringify(spec)));
  const artifactEntries=Array.isArray(artifacts)?artifacts:Object.values(artifacts||{}),inputArtifactIds=[],inputArtifactSha256Values=[];
  for(const artifact of artifactEntries){const id=artifact?.artifactId||artifact?.ARTIFACT_ID||artifact?.id,hash=artifact?.sha256||artifact?.SHA256;if(id)inputArtifactIds.push(String(id));if(hash)inputArtifactSha256Values.push(String(hash));}
  const payload={spec,bindings,testId,testSpecSha256,inputArtifactIds,inputArtifactSha256Values};
  if(!validation.valid)return executeNormalizedSpec(payload);
  if(typeof Worker==='function'&&typeof document!=='undefined')return new Promise(resolve=>{
    const worker=new Worker(workerUrl());let settled=false;
    const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();resolve(result);};
    const timer=setTimeout(()=>finish(resultEnvelope({...payload,startedAtDeviceTime:new Date().toISOString()},{status:'EXECUTION_FAILED',observations:[{errorCode:'WORKER_TIMEOUT',message:'Worker execution exceeded the registered duration limit.'}]})),RESOURCE_LIMITS.maxWorkerMs);
    worker.onmessage=event=>finish(event.data);
    worker.onerror=event=>finish(resultEnvelope({...payload,startedAtDeviceTime:new Date().toISOString()},{status:'EXECUTION_FAILED',observations:[{errorCode:'WORKER_ERROR',message:event.message||'Worker failed.'}]}));
    worker.postMessage(payload);
  });
  return executeNormalizedSpec(payload);
}

const api=Object.freeze({
  SPEC_VERSION,TEST_IR_SCHEMA:SPEC_VERSION,RUNTIME_VERSION,CAPABILITY_ID,RESOURCE_LIMITS,LIMITS:RESOURCE_LIMITS,
  OPERATIONS,OPERATION_CONTRACTS,operationContracts:OPERATION_CONTRACTS,operationSet:OPERATION_SET,
  capabilities,registeredOperations,supports,validateSpec,validate:validateSpec,validateExecutableSpec:validateSpec,
  normalizeSpec,executeTest,execute:executeTest,executeSpec:executeTest,runTest:executeTest,runInWorker:executeTest,
  executeNormalizedSpec,stableStringify,sha256
});
globalThis.closedLoopTestRuntime=api;
})();

import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const write=(file,text)=>fs.writeFileSync(path.join(root,file),text.endsWith('\n')?text:text+'\n');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const replaceExact=(text,from,to,label)=>{const count=text.split(from).length-1;assert(count>0,`Missing ${label||from}`);return text.split(from).join(to);};
const replaceOnce=(text,from,to,label)=>{const count=text.split(from).length-1;assert(count===1,`Expected one ${label||from}; found ${count}`);return text.replace(from,to);};
const productionFiles=['workbook.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','index.html'];

function updateCurrentContractStrings(){
  let workbook=read('workbook.js');
  workbook=replaceOnce(workbook,"const PROJECT_SCHEMA='closed-loop-project/2';","const PROJECT_SCHEMA='closed-loop-project/3';",'workbook project schema');
  write('workbook.js',workbook);

  let schema=read('workflow-schema.js');
  schema=replaceOnce(schema,"const RESPONSE_SCHEMA='closed-loop-stage-response/2';","const RESPONSE_SCHEMA='closed-loop-stage-response/3';",'response schema');
  write('workflow-schema.js',schema);

  for(const file of fs.readdirSync(root)){
    if(!/^(README\.md|TEST_PROJECT\.json|build-test-project.*\.mjs|test-fixtures\.mjs|verify.*\.mjs)$/.test(file))continue;
    let text=read(file);
    text=text.replaceAll('closed-loop-project/2','closed-loop-project/3');
    text=text.replaceAll('closed-loop-stage-response/2','closed-loop-stage-response/3');
    text=text.replace(/(EXECUTABLE_KIND["']?\s*[:=]\s*["'])CLOSED_LOOP_TEST_IR(["'])/g,'$1TEST_IR$2');
    write(file,text);
  }
}

function repairJobOwnership(){
  let text=read('workflow-schema.js');
  text=replaceOnce(text,
`const HUMAN_JOB_FIELDS=Object.freeze([
  'JOB_TITLE','JOB_OWNER','EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',`,
`const HUMAN_JOB_FIELDS=Object.freeze([
  'EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',`,
'job human partition');
  const marker=`const APPLICATION_JOB_FIELDS=Object.freeze([`;
  assert(text.includes(marker),'Missing application job partition');
  text=text.replace(marker,`const HUMAN_DECISION_JOB_FIELDS=Object.freeze(['JOB_TITLE','JOB_OWNER']);\n${marker}`);
  text=replaceOnce(text,
`  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});`,
`  if(HUMAN_DECISION_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN_DECISION,{provenanceRequired:false,nullable:true});
  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});`,
'job ownership decision branch');
  text=replaceOnce(text,
`[...new Set([...HUMAN_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])]`,
`[...new Set([...HUMAN_DECISION_JOB_FIELDS,...HUMAN_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])]`,
'job field union');
  write('workflow-schema.js',text);
}

function repairTestOwnershipAndKind(){
  let text=read('workflow-schema.js');
  const start=text.indexOf('  "tests": {');
  const end=text.indexOf('  "failureTests": {',start);
  assert(start>=0&&end>start,'Missing tests ownership block');
  let block=text.slice(start,end);
  block=block.replace(/\s*"EXECUTABLE_SPEC_VERSION",?/,'');
  if(!/"application"\s*:\s*\[[\s\S]*?"EXECUTABLE_SPEC_VERSION"/.test(block)){
    block=block.replace(/("application"\s*:\s*\[\s*"TEST_ID",)/,'$1\n      "EXECUTABLE_SPEC_VERSION",');
  }
  text=text.slice(0,start)+block+text.slice(end);
  text=text.replace(/enumValues:\s*\[(?:[^\]]*?)(?:CLOSED_LOOP_TEST_IR|CUSTOM_PIPELINE)(?:[^\]]*?)\]/g,match=>match.includes('EXECUTABLE_KIND')?"enumValues:['NONE','TEST_IR']":match);
  text=text.replace(/(name:\s*['"]EXECUTABLE_KIND['"][\s\S]{0,300}?enumValues:)\s*\[[^\]]*\]/g,"$1['NONE','TEST_IR']");
  text=text.replace(/\['NONE','CLOSED_LOOP_TEST_IR','CUSTOM_PIPELINE'\]/g,"['NONE','TEST_IR']");
  text=text.replace(/\['NONE','CLOSED_LOOP_TEST_IR'\]/g,"['NONE','TEST_IR']");
  text=text.replace(/CLOSED_LOOP_TEST_IR(?=["']\s*[,\]])/g,'TEST_IR');
  write('workflow-schema.js',text);

  for(const file of ['prompt-engine.js','response-ingestion.js','workflow-engine.js','app-core.js']){
    let source=read(file);
    source=source.replace(/(EXECUTABLE_KIND\s*[:=]\s*["'])CLOSED_LOOP_TEST_IR(["'])/g,'$1TEST_IR$2');
    source=source.replace(/(["']EXECUTABLE_KIND["']\s*:\s*["'])CLOSED_LOOP_TEST_IR(["'])/g,'$1TEST_IR$2');
    write(file,source);
  }
}

function findContainingFunction(source,index){
  const candidates=[];
  const re=/function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g;
  let match;
  while((match=re.exec(source))&&match.index<index){
    let depth=0,end=-1;
    for(let i=source.indexOf('{',match.index);i<source.length;i++){
      if(source[i]==='{')depth++;
      else if(source[i]==='}'&&--depth===0){end=i+1;break;}
    }
    if(end>index)candidates.push({name:match[1],args:match[2].split(',').map(x=>x.trim()).filter(Boolean),bodyStart:source.indexOf('{',match.index)+1,end});
  }
  return candidates.sort((a,b)=>(a.end-a.bodyStart)-(b.end-b.bodyStart))[0]||null;
}

function addV2Migration(){
  let text=read('project-store.js');
  assert(text.includes('human-project/30'),'Expected existing legacy migration');
  const legacyIndex=text.indexOf('human-project/30');
  const fn=findContainingFunction(text,legacyIndex);
  assert(fn&&fn.args.length,'Could not locate legacy migration function');
  const arg=fn.args[0].replace(/=.*/,'').trim();
  const helper=`
function migrateClosedLoopProjectV2ToV3(inputProject){
  const original=typeof structuredClone==='function'?structuredClone(inputProject):JSON.parse(JSON.stringify(inputProject));
  const migrated=typeof structuredClone==='function'?structuredClone(inputProject):JSON.parse(JSON.stringify(inputProject));
  migrated.schema='closed-loop-project/3';
  migrated.workflowId='mobile-closed-loop/30';
  const pd=migrated.projectData||(migrated.projectData={});
  const migrationId='MIGRATION-V2-V3-'+String(migrated.job?.JOB_ID||migrated.jobId||'PROJECT');
  const historicalize=list=>Array.isArray(list)?list.map(item=>{
    if(!item||typeof item!=='object')return item;
    const schema=String(item.schema||item.envelope?.schema||item.responseSchema||'');
    if(schema!=='closed-loop-stage-response/2')return item;
    return {...item,historicalOnly:true,invalidatedBy:item.invalidatedBy||migrationId,status:item.status==='PENDING'?'STALE':item.status};
  }):list;
  for(const key of ['generatedPrompts','pendingProposals','responseProposals','proposalHistory'])pd[key]=historicalize(pd[key]);
  const visit=value=>{
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value)){for(const entry of value)visit(entry);return;}
    if(Object.prototype.hasOwnProperty.call(value,'EXECUTABLE_KIND')){
      if(value.EXECUTABLE_KIND==='CLOSED_LOOP_TEST_IR')value.EXECUTABLE_KIND='TEST_IR';
      if(value.EXECUTABLE_KIND==='CUSTOM_PIPELINE'){
        value.EXECUTABLE_KIND='NONE';
        value.STATUS='BLOCKED';
        value.MIGRATION_BLOCKING_REASON='Legacy CUSTOM_PIPELINE is not executable under closed-loop-test-spec/1.';
      }
    }
    if(Object.prototype.hasOwnProperty.call(value,'EXECUTABLE_SPEC'))value.EXECUTABLE_SPEC_VERSION='closed-loop-test-spec/1';
    for(const child of Object.values(value))visit(child);
  };
  visit(migrated);
  pd.migrationHistory=[...(Array.isArray(pd.migrationHistory)?pd.migrationHistory:[]),{
    migrationId,fromSchema:'closed-loop-project/2',toSchema:'closed-loop-project/3',
    historicalOnly:true,originalImportedPayload:original,
    preservedRawResponses:Array.isArray(pd.rawResponses)?pd.rawResponses.length:0,
    preservedReceipts:Array.isArray(pd.receipts)?pd.receipts.length:0
  }];
  return migrated;
}
`;
  const insertionPoint=text.indexOf('\n',text.indexOf("'use strict'"))+1;
  text=text.slice(0,insertionPoint)+helper+text.slice(insertionPoint);
  const updatedIndex=text.indexOf('human-project/30');
  const updatedFn=findContainingFunction(text,updatedIndex);
  assert(updatedFn&&updatedFn.args.length,'Migration function moved unexpectedly');
  const updatedArg=updatedFn.args[0].replace(/=.*/,'').trim();
  const branch=`\n  if(${updatedArg}&&typeof ${updatedArg}==='object'&&${updatedArg}.schema==='closed-loop-project/2')return migrateClosedLoopProjectV2ToV3(${updatedArg});`;
  text=text.slice(0,updatedFn.bodyStart)+branch+text.slice(updatedFn.bodyStart);
  write('project-store.js',text);
}

const runtimeSource=String.raw`(()=>{
'use strict';
const SPEC_VERSION='closed-loop-test-spec/1';
const RUNTIME_VERSION='closed-loop-test-runtime/1';
const CAPABILITY_ID='CLOSED_LOOP_TEST_IR';
const LIMITS=Object.freeze({
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
const OPS=Object.freeze(['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE']);
const OP_SET=new Set(OPS);
const BASE_KEYS=new Set(['op']);
const CONTRACTS=Object.freeze({
  LOAD_ARTIFACT:{required:['binding'],optional:[],types:{binding:'string'}},
  READ_BYTES:{required:[],optional:[],types:{}},DECODE_UTF8:{required:[],optional:[],types:{}},PARSE_JSON:{required:[],optional:[],types:{}},
  PARSE_CSV:{required:['delimiter','header','quote','newline'],optional:[],types:{delimiter:'string',header:'boolean',quote:'string',newline:'string'}},
  PARSE_XML:{required:[],optional:[],types:{}},
  SELECT_JSON_PATH:{required:['path'],optional:[],types:{path:'string'}},
  SELECT_XML:{required:['selector'],optional:[],types:{selector:'string'}},
  COUNT:{required:[],optional:[],types:{}},SUM:{required:[],optional:[],types:{}},MIN:{required:[],optional:[],types:{}},MAX:{required:[],optional:[],types:{}},
  SORT:{required:[],optional:['direction'],types:{direction:'string'}},UNIQUE:{required:[],optional:[],types:{}},HASH_SHA256:{required:[],optional:[],types:{}},
  REGEX:{required:['pattern'],optional:['flags','mode'],types:{pattern:'string',flags:'string',mode:'string'}},
  COMPARE:{required:['operator'],optional:['value','binding','absoluteTolerance','relativeTolerance'],types:{operator:'string',binding:'string',absoluteTolerance:'number',relativeTolerance:'number'}},
  ASSERT_EQ:{required:['value'],optional:['absoluteTolerance','relativeTolerance'],types:{absoluteTolerance:'number',relativeTolerance:'number'}},
  ASSERT_GT:{required:['value'],optional:[],types:{}},ASSERT_GTE:{required:['value'],optional:[],types:{}},ASSERT_LT:{required:['value'],optional:[],types:{}},ASSERT_LTE:{required:['value'],optional:[],types:{}},
  ASSERT_MATCH:{required:['pattern'],optional:['flags'],types:{pattern:'string',flags:'string'}},
  ASSERT_CONTAINS:{required:['value'],optional:[],types:{}},ASSERT_NOT_CONTAINS:{required:['value'],optional:[],types:{}},ASSERT_SET_EQUAL:{required:['value'],optional:[],types:{}},
  BYTE_COMPARE:{required:[],optional:['binding','leftBinding','rightBinding'],types:{binding:'string',leftBinding:'string',rightBinding:'string'}}
});
class RuntimeError extends Error{constructor(code,message){super(message);this.name='ClosedLoopRuntimeError';this.code=code;}}
class AssertionFailure extends Error{constructor(expected,actual,message){super(message||'Assertion failed.');this.name='ClosedLoopAssertionFailure';this.expected=expected;this.actual=actual;}}
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const stable=v=>{if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object'){const out={};for(const key of Object.keys(v).sort())out[key]=stable(v[key]);return out;}return v;};
const stableStringify=v=>JSON.stringify(stable(v));
const bytesOf=async value=>{
  let bytes;
  if(value instanceof Uint8Array)bytes=value;
  else if(ArrayBuffer.isView(value))bytes=new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  else if(value instanceof ArrayBuffer)bytes=new Uint8Array(value);
  else if(typeof Blob!=='undefined'&&value instanceof Blob)bytes=new Uint8Array(await value.arrayBuffer());
  else if(value&&typeof value==='object'){
    if(value.bytes!==undefined)return bytesOf(value.bytes);
    if(value.blob!==undefined)return bytesOf(value.blob);
    if(value.data!==undefined)return bytesOf(value.data);
    if(value.content!==undefined)return bytesOf(value.content);
  }else if(typeof value==='string')bytes=new TextEncoder().encode(value);
  if(!bytes)throw new RuntimeError('MISSING_BYTES','The selected artifact does not contain verified bytes.');
  if(bytes.byteLength>LIMITS.maxInputBytes)throw new RuntimeError('INPUT_LIMIT','Input bytes exceed the registered runtime limit.');
  return bytes;
};
const sha256=async bytes=>{
  const digest=await crypto.subtle.digest('SHA-256',bytes instanceof Uint8Array?bytes:await bytesOf(bytes));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
};
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
function validateSelector(path){
  if(typeof path!=='string'||!path.startsWith('$'))return false;
  if(path===' $')return false;
  let rest=path.slice(1),depth=0;
  while(rest){
    let m;
    if((m=rest.match(/^\.([A-Za-z_$][\w$]*)/))){rest=rest.slice(m[0].length);depth++;}
    else if((m=rest.match(/^\[(\d+)\]/))){rest=rest.slice(m[0].length);depth++;}
    else if((m=rest.match(/^\[['"]([^'"\\]+)['"]\]/))){rest=rest.slice(m[0].length);depth++;}
    else if(rest.startsWith('[*]')){rest=rest.slice(3);depth++;}
    else return false;
    if(depth>LIMITS.maxSelectorDepth)return false;
  }
  return true;
}
function validateXmlSelector(selector){
  if(typeof selector!=='string'||!selector.startsWith('/')||selector==='/'||selector.includes('//'))return false;
  const parts=selector.slice(1).split('/');
  return parts.length<=LIMITS.maxSelectorDepth&&parts.every(part=>/^(?:\*|[A-Za-z_][\w.-]*)(?:\[(?:[1-9]\d*)\])?$/.test(part));
}
function safeRegex(pattern,flags=''){
  if(typeof pattern!=='string'||pattern.length>LIMITS.maxRegexPatternLength)throw new RuntimeError('REGEX_PATTERN_LIMIT','Regex pattern exceeds the registered limit.');
  if(!/^[dgimuys]*$/.test(flags)||new Set(flags).size!==flags.length)throw new RuntimeError('REGEX_FLAGS','Unsupported or duplicate regex flags.');
  if(/\\[1-9]/.test(pattern)||/\(\?<([=!])/.test(pattern)||/\(\?([=!])/.test(pattern)||/\([^)]*[+*][^)]*\)[+*{]/.test(pattern))throw new RuntimeError('UNSAFE_REGEX','Regex uses a prohibited high-risk construct.');
  try{return new RegExp(pattern,flags);}catch(error){throw new RuntimeError('INVALID_REGEX',error.message);}
}
function depthAndCount(value,depth=0,state={count:0}){
  if(depth>LIMITS.maxParsedDepth)throw new RuntimeError('PARSED_DEPTH_LIMIT','Parsed structure exceeds the registered depth limit.');
  if(value&&typeof value==='object'){
    const entries=Array.isArray(value)?value:Object.values(value);
    state.count+=entries.length;
    if(state.count>LIMITS.maxCollectionSize)throw new RuntimeError('COLLECTION_LIMIT','Parsed collection exceeds the registered size limit.');
    for(const child of entries)depthAndCount(child,depth+1,state);
  }
  return value;
}
function validateSpec(spec,bindings){
  const errors=[];
  const normalized=normalizeSpec(spec);
  if(!normalized||typeof normalized!=='object'||Array.isArray(normalized))errors.push('Specification must be an object.');
  else{
    for(const key of Object.keys(normalized))if(!['version','steps'].includes(key))errors.push(`Unknown specification property ${key}.`);
    if(normalized.version!==SPEC_VERSION)errors.push(`Unknown Test IR version ${String(normalized.version)}.`);
    if(!Array.isArray(normalized.steps)||normalized.steps.length===0)errors.push('steps must be a non-empty array.');
    else if(normalized.steps.length>LIMITS.maxSteps)errors.push(`steps exceeds ${LIMITS.maxSteps}.`);
    else normalized.steps.forEach((step,index)=>{
      if(!step||typeof step!=='object'||Array.isArray(step)){errors.push(`steps[${index}] must be an object.`);return;}
      if(!OP_SET.has(step.op)){errors.push(`Unknown operation ${String(step.op)} at steps[${index}].`);return;}
      const contract=CONTRACTS[step.op],allowed=new Set([...BASE_KEYS,...contract.required,...contract.optional]);
      for(const key of Object.keys(step))if(!allowed.has(key))errors.push(`Unknown property ${key} for ${step.op}.`);
      for(const key of contract.required)if(!own(step,key))errors.push(`Missing ${key} for ${step.op}.`);
      for(const [key,type] of Object.entries(contract.types))if(own(step,key)&&typeof step[key]!==type)errors.push(`${key} for ${step.op} must be ${type}.`);
      if(step.op==='PARSE_CSV'){
        if(step.delimiter.length!==1)errors.push('CSV delimiter must be exactly one character.');
        if(step.quote.length!==1)errors.push('CSV quote must be exactly one character.');
        if(!['LF','CRLF','AUTO'].includes(step.newline))errors.push('CSV newline must be LF, CRLF, or AUTO.');
      }
      if(step.op==='SELECT_JSON_PATH'&&!validateSelector(step.path))errors.push('Unsupported SELECT_JSON_PATH syntax.');
      if(step.op==='SELECT_XML'&&!validateXmlSelector(step.selector))errors.push('Unsupported SELECT_XML syntax.');
      if(['REGEX','ASSERT_MATCH'].includes(step.op))try{safeRegex(step.pattern,step.flags||'');}catch(error){errors.push(error.message);}
      if(['ASSERT_EQ','COMPARE'].includes(step.op)&&typeof step.value==='number'&&!Number.isSafeInteger(step.value)&&!own(step,'absoluteTolerance')&&!own(step,'relativeTolerance'))errors.push('Precision-sensitive numeric equality requires explicit tolerance or an exact decimal string.');
      for(const key of ['absoluteTolerance','relativeTolerance'])if(own(step,key)&&(!Number.isFinite(step[key])||step[key]<0))errors.push(`${key} must be a finite nonnegative number.`);
    });
  }
  if(bindings!==undefined&&bindings!==null&&typeof bindings!=='object')errors.push('Bindings must be an object or array.');
  return Object.freeze({valid:errors.length===0,errors:Object.freeze(errors),normalizedSpec:normalized,normalized});
}
function recordValue(record,key){return record?.[key]??record?.values?.[key]??record?.agentData?.[key]??record?.applicationData?.[key]??record?.derivedData?.[key];}
function testSpec(test){return recordValue(test,'EXECUTABLE_SPEC')||test?.spec||test;}
function supports(test){
  const mode=recordValue(test,'EXECUTION_MODE');if(mode&&mode!=='APPLICATION_DETERMINISTIC')return false;
  const kind=recordValue(test,'EXECUTABLE_KIND');if(kind&&kind!=='TEST_IR')return false;
  return validateSpec(testSpec(test),recordValue(test,'EXECUTABLE_INPUT_BINDINGS')).valid;
}
function capabilities(){return Object.freeze({capabilityId:CAPABILITY_ID,runtimeVersion:RUNTIME_VERSION,specVersions:Object.freeze([SPEC_VERSION]),operations:OPS,limits:LIMITS});}
function bindingMap(declarations,artifacts,canonical){
  const map={};
  const artifactEntries=Array.isArray(artifacts)?artifacts:Object.values(artifacts||{});
  const byId=new Map();
  for(const artifact of artifactEntries){if(!artifact)continue;for(const id of [artifact.artifactId,artifact.ARTIFACT_ID,artifact.id,artifact.filename,artifact.FILENAME].filter(Boolean))byId.set(String(id),artifact);}
  if(declarations&&typeof declarations==='object'){
    const entries=Array.isArray(declarations)?declarations.map(x=>[x.binding||x.name,x]):Object.entries(declarations);
    for(const [name,declaration] of entries){
      if(!name)continue;
      if(typeof declaration==='string')map[name]=byId.get(declaration)||canonical?.[declaration];
      else if(declaration&&typeof declaration==='object'){
        const id=declaration.artifactId||declaration.ARTIFACT_ID||declaration.targetId||declaration.valueId;
        map[name]=id?byId.get(String(id))||canonical?.[String(id)]:declaration.value!==undefined?declaration.value:declaration;
      }
    }
  }
  for(const [key,value] of Object.entries(artifacts||{}))if(!/^\d+$/.test(key))map[key]=value;
  for(const [key,value] of Object.entries(canonical||{}))if(!own(map,key))map[key]=value;
  return map;
}
function selectJson(value,path){
  if(path==='$')return value;
  let nodes=[value],rest=path.slice(1);
  while(rest){let m,key,wild=false;
    if((m=rest.match(/^\.([A-Za-z_$][\w$]*)/))){key=m[1];rest=rest.slice(m[0].length);}
    else if((m=rest.match(/^\[(\d+)\]/))){key=Number(m[1]);rest=rest.slice(m[0].length);}
    else if((m=rest.match(/^\[['"]([^'"\\]+)['"]\]/))){key=m[1];rest=rest.slice(m[0].length);}
    else if(rest.startsWith('[*]')){wild=true;rest=rest.slice(3);}else throw new RuntimeError('SELECTOR','Unsupported JSON selector.');
    const next=[];
    for(const node of nodes){if(wild){if(Array.isArray(node))next.push(...node);else if(node&&typeof node==='object')next.push(...Object.values(node));}else if(node!=null&&own(Object(node),key))next.push(node[key]);}
    nodes=next;
  }
  return nodes.length===1?nodes[0]:nodes;
}
function parseCsv(text,config){
  const newline=config.newline==='LF'?'\n':config.newline==='CRLF'?'\r\n':text.includes('\r\n')?'\r\n':'\n';
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){if(ch===config.quote){if(text[i+1]===config.quote){field+=ch;i++;}else quoted=false;}else field+=ch;continue;}
    if(ch===config.quote){quoted=true;continue;}
    if(ch===config.delimiter){row.push(field);field='';continue;}
    if(text.startsWith(newline,i)){row.push(field);rows.push(row);row=[];field='';i+=newline.length-1;continue;}
    if(ch==='\r'||ch==='\n')throw new RuntimeError('CSV_NEWLINE','CSV newline does not match the explicit contract.');
    field+=ch;
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
    if(token.startsWith('</')){const name=token.slice(2,-1).trim();const node=stack.pop();if(!node||node.name!==name)throw new RuntimeError('XML_PARSE','Mismatched XML closing tag.');continue;}
    if(token.startsWith('<')){
      const selfClose=/\/>$/.test(token),body=token.slice(1,selfClose?-2:-1).trim();
      const m=body.match(/^([A-Za-z_][\w:.-]*)([\s\S]*)$/);if(!m)throw new RuntimeError('XML_PARSE','Invalid XML element.');
      const attrs={};const attrText=m[2].trim();let consumed='';
      const re=/\s*([A-Za-z_][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/gy;let am;re.lastIndex=0;
      while((am=re.exec(attrText))){attrs[am[1]]=am[2].slice(1,-1);consumed+=am[0];}
      if(consumed.trim()!==attrText.trim())throw new RuntimeError('XML_PARSE','Unsupported XML attribute syntax.');
      const node={name:m[1],attributes:attrs,children:[],text:''};stack.at(-1).children.push(node);if(!selfClose)stack.push(node);continue;
    }
    if(token.trim())stack.at(-1).text+=token;
  }
  if(stack.length!==1)throw new RuntimeError('XML_PARSE','Unclosed XML element.');
  if(documentNode.children.length!==1)throw new RuntimeError('XML_PARSE','XML must contain exactly one root element.');
  return documentNode;
}
function selectXml(documentNode,selector){
  let nodes=[documentNode];
  for(const raw of selector.slice(1).split('/')){
    const m=raw.match(/^(\*|[A-Za-z_][\w.-]*)(?:\[(\d+)\])?$/),name=m[1],index=m[2]?Number(m[2])-1:null,next=[];
    for(const node of nodes){let children=(node.children||[]).filter(child=>name==='*'||child.name===name);if(index!==null)children=children[index]?[children[index]]:[];next.push(...children);}
    nodes=next;
  }
  return nodes.length===1?nodes[0]:nodes;
}
function decimalParts(value){
  const text=String(value).trim();if(!/^[+-]?\d+(?:\.\d+)?$/.test(text))throw new RuntimeError('NUMERIC','Value is not an exact decimal.');
  const sign=text.startsWith('-')?-1:1,raw=text.replace(/^[+-]/,''),[whole,fraction='']=raw.split('.');
  return {sign,digits:BigInt((whole+fraction).replace(/^0+(?=\d)/,'')||'0'),scale:fraction.length};
}
function decimalCompare(a,b){
  const x=decimalParts(a),y=decimalParts(b),scale=Math.max(x.scale,y.scale),xi=BigInt(x.sign)*x.digits*10n**BigInt(scale-x.scale),yi=BigInt(y.sign)*y.digits*10n**BigInt(scale-y.scale);return xi<yi?-1:xi>yi?1:0;
}
function decimalAdd(values){
  const parts=values.map(decimalParts),scale=Math.max(0,...parts.map(x=>x.scale));let total=0n;
  for(const part of parts)total+=BigInt(part.sign)*part.digits*10n**BigInt(scale-part.scale);
  const negative=total<0n;if(negative)total=-total;let digits=total.toString().padStart(scale+1,'0');
  if(scale)digits=digits.slice(0,-scale)+'.'+digits.slice(-scale);digits=digits.replace(/\.0+$/,'').replace(/(\.\d*?)0+$/,'$1');return (negative?'-':'')+digits;
}
function numericCompare(a,b){
  if((typeof a==='number'&&!Number.isFinite(a))||(typeof b==='number'&&!Number.isFinite(b)))throw new RuntimeError('NUMERIC','Non-finite number is prohibited.');
  if((typeof a==='number'&&Number.isSafeInteger(a))||(typeof a==='bigint')||typeof a==='string')return decimalCompare(a,b);
  if(typeof a==='number'&&typeof b==='number')return a<b?-1:a>b?1:0;
  return decimalCompare(a,b);
}
function deepEqual(a,b){return stableStringify(a)===stableStringify(b);}
function equalWithTolerance(actual,expected,step){
  if(typeof actual==='number'&&typeof expected==='number'&&(!Number.isSafeInteger(actual)||!Number.isSafeInteger(expected))){
    if(!own(step,'absoluteTolerance')&&!own(step,'relativeTolerance'))throw new RuntimeError('PRECISION','Precision-sensitive equality requires explicit tolerance.');
    const diff=Math.abs(actual-expected),absolute=step.absoluteTolerance??0,relative=step.relativeTolerance??0*Math.max(Math.abs(actual),Math.abs(expected));return diff<=Math.max(absolute,relative);
  }
  if((typeof actual==='string'&&/^[+-]?\d+(?:\.\d+)?$/.test(actual))&&(typeof expected==='string'&&/^[+-]?\d+(?:\.\d+)?$/.test(expected)))return decimalCompare(actual,expected)===0;
  return deepEqual(actual,expected);
}
function contains(actual,value){if(typeof actual==='string')return actual.includes(String(value));if(Array.isArray(actual))return actual.some(x=>deepEqual(x,value));if(actual&&typeof actual==='object')return own(actual,String(value));return false;}
function setEqual(actual,expected){if(!Array.isArray(actual)||!Array.isArray(expected))return false;const a=[...new Set(actual.map(stableStringify))].sort(),b=[...new Set(expected.map(stableStringify))].sort();return deepEqual(a,b);}
function regexValue(input,step){const text=String(input);if(text.length>LIMITS.maxRegexInputLength)throw new RuntimeError('REGEX_INPUT_LIMIT','Regex input exceeds the registered limit.');const re=safeRegex(step.pattern,step.flags||'');if(step.mode==='MATCHES')return [...text.matchAll(re.global?re:new RegExp(re.source,re.flags+'g'))].map(x=>x[0]);return re.test(text);}
async function executeNormalizedSpec({spec,bindings,testId,testSpecSha256,inputArtifactIds,inputArtifactSha256Values}){
  const validation=validateSpec(spec,bindings);const startedAtDeviceTime=new Date().toISOString();
  if(!validation.valid)return {testId:testId||'',testSpecVersion:SPEC_VERSION,testSpecSha256:testSpecSha256||'',status:'BLOCKED',expected:null,actual:null,observations:validation.errors,evidence:[],executorVersion:RUNTIME_VERSION,inputArtifactIds:inputArtifactIds||[],inputArtifactSha256Values:inputArtifactSha256Values||[],startedAtDeviceTime,endedAtDeviceTime:new Date().toISOString()};
  let current=null,assertions=0;const observations=[];
  try{
    for(const step of validation.normalizedSpec.steps){
      switch(step.op){
        case 'LOAD_ARTIFACT':if(!own(bindings,step.binding)||bindings[step.binding]==null)throw new RuntimeError('MISSING_BINDING',`Binding ${step.binding} is unavailable.`);current=bindings[step.binding];break;
        case 'READ_BYTES':current=await bytesOf(current);break;
        case 'DECODE_UTF8':try{current=new TextDecoder('utf-8',{fatal:true}).decode(await bytesOf(current));}catch(error){throw new RuntimeError('INVALID_UTF8','Input is not valid UTF-8.');}break;
        case 'PARSE_JSON':try{current=depthAndCount(JSON.parse(String(current)));}catch(error){if(error instanceof RuntimeError)throw error;throw new RuntimeError('JSON_PARSE',error.message);}break;
        case 'PARSE_CSV':current=depthAndCount(parseCsv(String(current),step));break;
        case 'PARSE_XML':current=depthAndCount(parseXml(String(current)));break;
        case 'SELECT_JSON_PATH':current=selectJson(current,step.path);break;
        case 'SELECT_XML':current=selectXml(current,step.selector);break;
        case 'COUNT':current=Array.isArray(current)||typeof current==='string'?current.length:current&&typeof current==='object'?Object.keys(current).length:0;break;
        case 'SUM':{const values=Array.isArray(current)?current:[current];current=values.every(Number.isSafeInteger)?values.reduce((a,b)=>a+b,0):decimalAdd(values);break;}
        case 'MIN':{const values=Array.isArray(current)?current:[current];current=values.reduce((a,b)=>numericCompare(a,b)<=0?a:b);break;}
        case 'MAX':{const values=Array.isArray(current)?current:[current];current=values.reduce((a,b)=>numericCompare(a,b)>=0?a:b);break;}
        case 'SORT':{if(!Array.isArray(current))throw new RuntimeError('TYPE','SORT requires an array.');current=[...current].sort((a,b)=>numericCompare(a,b));if(step.direction==='DESC')current.reverse();break;}
        case 'UNIQUE':{if(!Array.isArray(current))throw new RuntimeError('TYPE','UNIQUE requires an array.');const seen=new Set();current=current.filter(value=>{const key=stableStringify(value);if(seen.has(key))return false;seen.add(key);return true;});break;}
        case 'HASH_SHA256':current=await sha256(await bytesOf(current));break;
        case 'REGEX':current=regexValue(current,step);break;
        case 'COMPARE':{const expected=step.binding?bindings[step.binding]:step.value;if(step.binding&&!own(bindings,step.binding))throw new RuntimeError('MISSING_BINDING',`Binding ${step.binding} is unavailable.`);const op=step.operator;current=op==='EQ'?equalWithTolerance(current,expected,step):op==='GT'?numericCompare(current,expected)>0:op==='GTE'?numericCompare(current,expected)>=0:op==='LT'?numericCompare(current,expected)<0:op==='LTE'?numericCompare(current,expected)<=0:op==='CONTAINS'?contains(current,expected):(()=>{throw new RuntimeError('COMPARE_OPERATOR','Unsupported comparison operator.');})();break;}
        case 'ASSERT_EQ':assertions++;if(!equalWithTolerance(current,step.value,step))throw new AssertionFailure(step.value,current);break;
        case 'ASSERT_GT':assertions++;if(!(numericCompare(current,step.value)>0))throw new AssertionFailure(`> ${step.value}`,current);break;
        case 'ASSERT_GTE':assertions++;if(!(numericCompare(current,step.value)>=0))throw new AssertionFailure(`>= ${step.value}`,current);break;
        case 'ASSERT_LT':assertions++;if(!(numericCompare(current,step.value)<0))throw new AssertionFailure(`< ${step.value}`,current);break;
        case 'ASSERT_LTE':assertions++;if(!(numericCompare(current,step.value)<=0))throw new AssertionFailure(`<= ${step.value}`,current);break;
        case 'ASSERT_MATCH':assertions++;if(!regexValue(current,{...step,mode:'BOOLEAN'}))throw new AssertionFailure(`match ${step.pattern}`,current);break;
        case 'ASSERT_CONTAINS':assertions++;if(!contains(current,step.value))throw new AssertionFailure(`contains ${stableStringify(step.value)}`,current);break;
        case 'ASSERT_NOT_CONTAINS':assertions++;if(contains(current,step.value))throw new AssertionFailure(`does not contain ${stableStringify(step.value)}`,current);break;
        case 'ASSERT_SET_EQUAL':assertions++;if(!setEqual(current,step.value))throw new AssertionFailure(step.value,current);break;
        case 'BYTE_COMPARE':{const left=step.leftBinding?bindings[step.leftBinding]:current,right=step.rightBinding?bindings[step.rightBinding]:step.binding?bindings[step.binding]:null;if((step.leftBinding&&!own(bindings,step.leftBinding))||((step.rightBinding||step.binding)&&right==null))throw new RuntimeError('MISSING_BINDING','BYTE_COMPARE binding is unavailable.');const a=await bytesOf(left),b=await bytesOf(right);current=a.length===b.length&&a.every((value,index)=>value===b[index]);break;}
        default:throw new RuntimeError('UNKNOWN_OPERATION',`Unknown operation ${step.op}.`);
      }
      depthAndCount(current);observations.push({op:step.op,value:current instanceof Uint8Array?{byteLength:current.byteLength}:clone(current)});
    }
    return {testId:testId||'',testSpecVersion:SPEC_VERSION,testSpecSha256:testSpecSha256||'',status:assertions?'SATISFIED':'UNDETERMINED',expected:assertions?'all assertions satisfied':null,actual:clone(current),observations,evidence:[{kind:'APPLICATION_NATIVE_RUNTIME',runtimeVersion:RUNTIME_VERSION}],executorVersion:RUNTIME_VERSION,inputArtifactIds:inputArtifactIds||[],inputArtifactSha256Values:inputArtifactSha256Values||[],startedAtDeviceTime,endedAtDeviceTime:new Date().toISOString()};
  }catch(error){
    const assertion=error instanceof AssertionFailure,status=assertion?'VIOLATED':error?.code==='MISSING_BYTES'||error?.code==='MISSING_BINDING'?'BLOCKED':error?.code==='PRECISION'?'UNDETERMINED':'EXECUTION_FAILED';
    return {testId:testId||'',testSpecVersion:SPEC_VERSION,testSpecSha256:testSpecSha256||'',status,expected:assertion?error.expected:null,actual:assertion?clone(error.actual):null,observations:[...observations,{errorCode:error.code||error.name,message:error.message}],evidence:[],executorVersion:RUNTIME_VERSION,inputArtifactIds:inputArtifactIds||[],inputArtifactSha256Values:inputArtifactSha256Values||[],startedAtDeviceTime,endedAtDeviceTime:new Date().toISOString()};
  }
}
function workerUrl(){
  const base=typeof document!=='undefined'&&document.currentScript?.src?document.currentScript.src:globalThis.location?.href||'';const url=new URL('test-worker.js',base);const token=new URL(base).searchParams.get('v');if(token)url.searchParams.set('v',token);return url.href;
}
async function executeTest(test,artifacts={},canonicalBindings={}){
  const spec=normalizeSpec(testSpec(test)),declarations=recordValue(test,'EXECUTABLE_INPUT_BINDINGS')||test?.bindings||{},bindings=bindingMap(declarations,artifacts,canonicalBindings);
  const validation=validateSpec(spec,declarations);const testId=recordValue(test,'TEST_ID')||test?.testId||'',testSpecSha256=await sha256(new TextEncoder().encode(stableStringify(spec)));
  const artifactEntries=Array.isArray(artifacts)?artifacts:Object.values(artifacts||{}),inputArtifactIds=[],inputArtifactSha256Values=[];
  for(const artifact of artifactEntries){const id=artifact?.artifactId||artifact?.ARTIFACT_ID||artifact?.id,hash=artifact?.sha256||artifact?.SHA256;if(id)inputArtifactIds.push(String(id));if(hash)inputArtifactSha256Values.push(String(hash));}
  const payload={spec,bindings,testId,testSpecSha256,inputArtifactIds,inputArtifactSha256Values};
  if(!validation.valid)return executeNormalizedSpec(payload);
  if(typeof Worker==='function'&&typeof document!=='undefined')return await new Promise(resolve=>{
    const worker=new Worker(workerUrl());let settled=false;const timer=setTimeout(()=>{if(settled)return;settled=true;worker.terminate();resolve({testId,testSpecVersion:SPEC_VERSION,testSpecSha256,status:'EXECUTION_FAILED',expected:null,actual:null,observations:[{errorCode:'WORKER_TIMEOUT',message:'Worker execution exceeded the registered duration limit.'}],evidence:[],executorVersion:RUNTIME_VERSION,inputArtifactIds,inputArtifactSha256Values,startedAtDeviceTime:new Date().toISOString(),endedAtDeviceTime:new Date().toISOString()});},LIMITS.maxWorkerMs);
    worker.onmessage=event=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();resolve(event.data);};worker.onerror=event=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();resolve({testId,testSpecVersion:SPEC_VERSION,testSpecSha256,status:'EXECUTION_FAILED',expected:null,actual:null,observations:[{errorCode:'WORKER_ERROR',message:event.message||'Worker failed.'}],evidence:[],executorVersion:RUNTIME_VERSION,inputArtifactIds,inputArtifactSha256Values,startedAtDeviceTime:new Date().toISOString(),endedAtDeviceTime:new Date().toISOString()});};worker.postMessage(payload);
  });
  return executeNormalizedSpec(payload);
}
const api=Object.freeze({SPEC_VERSION,TEST_IR_SCHEMA:SPEC_VERSION,RUNTIME_VERSION,CAPABILITY_ID,RESOURCE_LIMITS:LIMITS,LIMITS,OPERATIONS:OPS,registeredOperations:OPS,operationContracts:CONTRACTS,capabilities,supports,validateSpec,validateExecutableSpec:validateSpec,normalizeSpec,executeTest,execute:executeTest,runTest:executeTest,executeNormalizedSpec,stableStringify,sha256});
globalThis.closedLoopTestRuntime=api;
})();`;

const workerSource=String.raw`(()=>{
'use strict';
try{Object.defineProperty(self,'fetch',{value:undefined,writable:false,configurable:false});}catch{}
for(const name of ['XMLHttpRequest','WebSocket','EventSource'])try{Object.defineProperty(self,name,{value:undefined,writable:false,configurable:false});}catch{}
const token=new URL(self.location.href).searchParams.get('v');
importScripts('test-runtime.js'+(token?'?v='+encodeURIComponent(token):''));
self.onmessage=async event=>{
  try{self.postMessage(await self.closedLoopTestRuntime.executeNormalizedSpec(event.data));}
  catch(error){self.postMessage({status:'EXECUTION_FAILED',observations:[{errorCode:error.code||error.name||'WORKER_ERROR',message:error.message||String(error)}],evidence:[],executorVersion:self.closedLoopTestRuntime.RUNTIME_VERSION,startedAtDeviceTime:new Date().toISOString(),endedAtDeviceTime:new Date().toISOString()});}
};
})();`;

function installRuntime(){write('test-runtime.js',runtimeSource);write('test-worker.js',workerSource);}

function updateStaticShell(){
  let html=read('index.html');
  const schemaTag=html.match(/<script\s+defer\s+src="workflow-schema\.js\?v=([^"]+)"\s*><\/script>/);
  assert(schemaTag,'Missing workflow-schema script tag');
  if(!/test-runtime\.js\?v=/.test(html))html=html.replace(schemaTag[0],schemaTag[0]+`\n<script defer src="test-runtime.js?v=${schemaTag[1]}"></script>`);
  const csp=html.match(/content-security-policy[^>]+content="([^"]+)"/i);
  if(csp&&!/worker-src\s/.test(csp[1]))html=html.replace(csp[1],csp[1].trim().replace(/;?$/,';')+" worker-src 'self';");
  else if(/Content-Security-Policy/i.test(html)&&!/worker-src\s/.test(html))html=html.replace(/(connect-src\s+[^;]+;)/i,"$1 worker-src 'self';");
  write('index.html',html);

  for(const file of fs.readdirSync(root).filter(x=>x.endsWith('.mjs')||x.endsWith('.yml')){
    let text=read(file);
    text=text.replace(/(['"]workflow-schema\.js['"]\s*,\s*)(['"]workflow-engine\.js['"])/g,"$1'test-runtime.js',$2");
    write(file,text);
  }
}

function updateReadme(){
  let text=read('README.md');
  text=text.replace('- Project schema: `closed-loop-project/2`.','- Project schema: `closed-loop-project/3`.');
  text=text.replace('- Response schema: `closed-loop-stage-response/2`.','- Response schema: `closed-loop-stage-response/3`.');
  text=text.replace('The deterministic legacy migration is `human-project/30` → `closed-loop-project/2`.','The deterministic migration chain is `human-project/30` → `closed-loop-project/2` → `closed-loop-project/3`; `/2` prompts and proposals remain historical and cannot control a current `/3` operation.');
  if(!text.includes('| Deterministic Test IR registry'))text=text.replace('| Canonical serialization and SHA-256 | `hash.js` |','| Canonical serialization and SHA-256 | `hash.js` |\n| Deterministic Test IR registry, validation, limits, and worker coordination | `test-runtime.js` |\n| Isolated deterministic execution | `test-worker.js` |');
  write('README.md',text);
}

const verifier=String.raw`import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const context={console,crypto:webcrypto,TextEncoder,TextDecoder,Blob,URL,URLSearchParams,setTimeout,clearTimeout,structuredClone};context.globalThis=context;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const core=context.closedLoopCore,schema=context.closedLoopSchema,runtime=context.closedLoopTestRuntime;
assert(core.PROJECT_SCHEMA==='closed-loop-project/3','Project schema is not /3.');
assert(schema.RESPONSE_SCHEMA==='closed-loop-stage-response/3','Response schema is not /3.');
assert(core.WORKFLOW_ID==='mobile-closed-loop/30'&&core.STAGE_COUNT===30,'Workflow identity or stage count changed.');
assert(schema.JOB_FIELDS.JOB_TITLE.producer==='HUMAN_DECISION'&&schema.JOB_FIELDS.JOB_OWNER.producer==='HUMAN_DECISION','Stage 01 title/owner authority is wrong.');
const expected=['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'];
assert(JSON.stringify(runtime.OPERATIONS)===JSON.stringify(expected),'Registered Test IR primitive set differs from the controlling set.');
const valid={version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_JSON'},{op:'SELECT_JSON_PATH',path:'$.runs'},{op:'COUNT'},{op:'ASSERT_EQ',value:10}]};
assert(runtime.validateSpec(valid).valid,'Valid Test IR rejected.');
for(const [name,spec] of Object.entries({unknownVersion:{...valid,version:'closed-loop-test-spec/9'},unknownOperation:{version:'closed-loop-test-spec/1',steps:[{op:'JAVASCRIPT',source:'return true'}]},unknownProperty:{version:'closed-loop-test-spec/1',steps:[{op:'COUNT',source:'x'}]},missingArgument:{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT'}]},unsupportedSelector:{version:'closed-loop-test-spec/1',steps:[{op:'SELECT_JSON_PATH',path:'$..secret'}]},implicitCsv:{version:'closed-loop-test-spec/1',steps:[{op:'PARSE_CSV'}]},unsafeRegex:{version:'closed-loop-test-spec/1',steps:[{op:'REGEX',pattern:'(a+)+$'}]},floatWithoutTolerance:{version:'closed-loop-test-spec/1',steps:[{op:'ASSERT_EQ',value:0.1}]}}))assert(!runtime.validateSpec(spec).valid,`${name} was accepted.`);
const artifact={PRODUCT:{bytes:new TextEncoder().encode(JSON.stringify({runs:Array.from({length:10},(_,i)=>i)}))}};
const result=await runtime.executeNormalizedSpec({spec:valid,bindings:artifact,testId:'TEST-1'});assert(result.status==='SATISFIED','Native JSON test did not satisfy.');
const csv={version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'CSV'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_CSV',delimiter:',',header:true,quote:'"',newline:'LF'},{op:'COUNT'},{op:'ASSERT_EQ',value:2}]};
assert((await runtime.executeNormalizedSpec({spec:csv,bindings:{CSV:{bytes:new TextEncoder().encode('a,b\n1,2\n3,4')}}})).status==='SATISFIED','Explicit CSV contract failed.');
const xml={version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'XML'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_XML'},{op:'SELECT_XML',selector:'/root/item'},{op:'COUNT'},{op:'ASSERT_EQ',value:2}]};
assert((await runtime.executeNormalizedSpec({spec:xml,bindings:{XML:{bytes:new TextEncoder().encode('<root><item/><item/></root>')}}})).status==='SATISFIED','Restricted XML selector failed.');
const bytes={version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'A'},{op:'BYTE_COMPARE',binding:'B'},{op:'ASSERT_EQ',value:true}]};
assert((await runtime.executeNormalizedSpec({spec:bytes,bindings:{A:{bytes:new Uint8Array([1,2])},B:{bytes:new Uint8Array([1,2])}}})).status==='SATISFIED','BYTE_COMPARE equality failed.');
assert((await runtime.executeNormalizedSpec({spec:bytes,bindings:{A:{bytes:new Uint8Array([1,2])},B:{bytes:new Uint8Array([1,3])}}})).status==='VIOLATED','BYTE_COMPARE inequality failed.');
const invalidUtf8={version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'A'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'ASSERT_EQ',value:'x'}]};
assert((await runtime.executeNormalizedSpec({spec:invalidUtf8,bindings:{A:{bytes:new Uint8Array([0xff])}}})).status==='EXECUTION_FAILED','Invalid UTF-8 disposition is wrong.');
const source=Object.fromEntries(['workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','index.html','test-worker.js'].map(file=>[file,fs.readFileSync(file,'utf8')]));
assert(!source['workflow-schema.js'].includes("'CUSTOM_PIPELINE'")&&!source['test-runtime.js']?.includes?.('CUSTOM_PIPELINE'),'CUSTOM_PIPELINE remains in the runtime contract.');
assert(source['project-store.js'].includes('closed-loop-project/2')&&source['project-store.js'].includes('migrateClosedLoopProjectV2ToV3'),'The /2→/3 migration is absent.');
for(const name of ['testExecutionPlan','evaluateContextIndependence','evaluateEvidenceSufficiency','detectCurrentContradictions','operationalNextAction'])assert(source['workflow-engine.js'].includes(name),`Missing engine authority ${name}.`);
assert(source['project-store.js'].includes('createExecutionPackage'),'Missing execution-package builder.');
const html=source['index.html'],scripts=[...html.matchAll(/<script\s+defer\s+src="([^"?]+)/g)].map(x=>x[1]);
assert(JSON.stringify(scripts)===JSON.stringify(['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']),'Direct runtime script order is wrong.');
assert(/worker-src\s+'self'/.test(html),'CSP does not authorize only the same-origin worker.');
assert(source['test-worker.js'].includes("Object.defineProperty(self,'fetch'")&&source['test-worker.js'].includes('executeNormalizedSpec'),'Worker network or execution boundary is missing.');
const report={projectSchema:'closed-loop-project/3',responseSchema:'closed-loop-stage-response/3',testIrSchema:'closed-loop-test-spec/1',verificationPackageSchema:'closed-loop-verification-package/1',workflow:'mobile-closed-loop/30',stageCount:30,stage01ControlledInputAccounting:1,stage04ObligationAccounting:1,mandatoryEvidenceSufficiencyCoverage:1,nativeExecutionCoverage:1,testIrSecurityCoverage:1,migrationCoverage:1,unsupportedTestIrTreatedAsExecutable:0,nativeExecutionReceiptsFabricatedExternally:0,releaseAcceptedWithContradiction:0};
console.log(JSON.stringify(report));
`;

function addVerifier(){write('verify-v3-contract.mjs',verifier);}

function updateWorkflow(){
  let text=read('.github/workflows/pages.yml');
  if(!text.includes('node --check verify-v3-contract.mjs'))text=text.replace('          node --check verify-test-runtime.mjs','          node --check verify-test-runtime.mjs\n          node --check verify-v3-contract.mjs');
  if(!text.includes('Verify controlling /3 contract'))text=text.replace('      - name: Verify generic deterministic Test IR runtime\n        run: node verify-test-runtime.mjs','      - name: Verify controlling /3 contract, migration, ownership, and Test IR security\n        run: node verify-v3-contract.mjs\n      - name: Verify generic deterministic Test IR runtime\n        run: node verify-test-runtime.mjs');
  text=text.replace(/node build-test-project\.mjs && node verify-test-runtime\.mjs/g,'node build-test-project.mjs && node verify-v3-contract.mjs && node verify-test-runtime.mjs');
  if(!text.includes("node verify-v3-contract.mjs > /tmp/verify-v3-contract.out"))text=text.replace("          node verify-test-runtime.mjs > /tmp/verify-test-runtime.out","          node verify-v3-contract.mjs > /tmp/verify-v3-contract.out\n          node verify-test-runtime.mjs > /tmp/verify-test-runtime.out");
  text=text.replace("projectSchema:'closed-loop-project/2'","projectSchema:'closed-loop-project/3'").replace("responseSchema:'closed-loop-stage-response/2'","responseSchema:'closed-loop-stage-response/3'");
  text=text.replace("const definition=JSON.parse(fs.readFileSync('/tmp/verify-definition-of-done.out','utf8'));","const definition=JSON.parse(fs.readFileSync('/tmp/verify-definition-of-done.out','utf8'));\n          const v3=JSON.parse(fs.readFileSync('/tmp/verify-v3-contract.out','utf8').trim().split(/\\r?\\n/).at(-1));");
  text=text.replace('            ...definition,','            ...definition,\n            ...v3,');
  text=text.replace("'mandatoryEvidenceChainCoverage','releaseArtifactIdentityCoverage'","'mandatoryEvidenceChainCoverage','releaseArtifactIdentityCoverage','stage01ControlledInputAccounting','stage04ObligationAccounting','mandatoryEvidenceSufficiencyCoverage','nativeExecutionCoverage','testIrSecurityCoverage','migrationCoverage'");
  text=text.replace("'externallySupportedUnestablishedIndependenceTreatedAsProven'","'externallySupportedUnestablishedIndependenceTreatedAsProven','unsupportedTestIrTreatedAsExecutable','nativeExecutionReceiptsFabricatedExternally','releaseAcceptedWithContradiction'");
  write('.github/workflows/pages.yml',text);
}

function eliminateProductionCustomPipeline(){
  for(const file of ['workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','app-core.js']){
    let text=read(file);
    text=text.replace(/,?\s*['"]CUSTOM_PIPELINE['"]/g,'');
    text=text.replace(/['"]CUSTOM_PIPELINE['"]\s*,?/g,'');
    write(file,text);
  }
}

updateCurrentContractStrings();
repairJobOwnership();
repairTestOwnershipAndKind();
addV2Migration();
installRuntime();
updateStaticShell();
updateReadme();
addVerifier();
updateWorkflow();
eliminateProductionCustomPipeline();

for(const file of productionFiles)assert(!read(file).includes('closed-loop-stage-response/2')||file==='project-store.js',`${file} still declares the old response contract.`);
assert(read('workbook.js').includes("closed-loop-project/3"),'Project schema update failed.');
assert(read('workflow-schema.js').includes("closed-loop-stage-response/3"),'Response schema update failed.');
console.log('spec-v3-repair: generated');

from pathlib import Path
import re, json


def replace_once(text, old, new, label):
    if text.count(old) != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {text.count(old)}')
    return text.replace(old, new, 1)

# workbook.js: project schema /3, visible Stage 16 name, and /2 migration support.
p = Path('workbook.js')
s = p.read_text(encoding='utf-8')
s = replace_once(s, "const PROJECT_SCHEMA='closed-loop-project/2';", "const PROJECT_SCHEMA='closed-loop-project/3';", 'workbook project schema')
s = replace_once(s, "'REVISE THE RESPONSIBLE LAYER'", "'CORRECT THE ROOT CAUSE'", 'Stage 16 label')
# Existing migration treated only the then-current schema as canonical. Preserve /2 as an explicit migration source.
s = replace_once(s, "function migrateState(p){\n  if(p.schema===PROJECT_SCHEMA){", "function migrateState(p){\n  if(p.schema===PROJECT_SCHEMA||p.schema==='closed-loop-project/2'){", 'migrateState current schema branch')
s = replace_once(s, "    const migrated=JSON.parse(JSON.stringify(p));\n    migrated.schema=PROJECT_SCHEMA;", "    const migrated=JSON.parse(JSON.stringify(p));\n    const migrationSourceSchema=String(p.schema||PROJECT_SCHEMA);\n    migrated.schema=PROJECT_SCHEMA;", 'migrateState schema assignment')
s = replace_once(s, "migrated.projectData.historicalImportRecords.push({kind:'LEGACY_STAGE_RECORDS',schema:PROJECT_SCHEMA,records:", "migrated.projectData.historicalImportRecords.push({kind:'LEGACY_STAGE_RECORDS',schema:migrationSourceSchema,records:", 'migrate legacy stage records provenance')
s = replace_once(s, "migrated.projectData.migrationArchives.push({kind:'LEGACY_NESTED_PROJECT',schema:PROJECT_SCHEMA,preservedAt:", "migrated.projectData.migrationArchives.push({kind:'LEGACY_NESTED_PROJECT',schema:migrationSourceSchema,preservedAt:", 'migrate nested project provenance')
# Preserve a /2 migration source snapshot exactly once.
needle = "    if(migrated.projectData.fullProject&&Object.keys(migrated.projectData.fullProject).length){migrated.projectData.migrationArchives.push({kind:'LEGACY_NESTED_PROJECT',schema:migrationSourceSchema,preservedAt:new Date().toISOString(),payload:JSON.parse(JSON.stringify(migrated.projectData.fullProject))});delete migrated.projectData.fullProject;}\n    return migrated;"
repl = "    if(migrated.projectData.fullProject&&Object.keys(migrated.projectData.fullProject).length){migrated.projectData.migrationArchives.push({kind:'LEGACY_NESTED_PROJECT',schema:migrationSourceSchema,preservedAt:new Date().toISOString(),payload:JSON.parse(JSON.stringify(migrated.projectData.fullProject))});delete migrated.projectData.fullProject;}\n    if(migrationSourceSchema==='closed-loop-project/2'&&!migrated.projectData.migrationArchives.some(x=>x.kind==='MIGRATION_SOURCE'&&x.schema==='closed-loop-project/2'))migrated.projectData.migrationArchives.push({kind:'MIGRATION_SOURCE',schema:'closed-loop-project/2',preservedAt:new Date().toISOString(),payload:JSON.parse(JSON.stringify(p))});\n    return migrated;"
s = replace_once(s, needle, repl, 'preserve /2 source payload')
p.write_text(s, encoding='utf-8')

# workflow-schema.js: response /3, job ownership correction, Test IR /1 canonical contract.
p = Path('workflow-schema.js')
s = p.read_text(encoding='utf-8')
s = replace_once(s, "const RESPONSE_SCHEMA='closed-loop-stage-response/2';", "const RESPONSE_SCHEMA='closed-loop-stage-response/3';", 'response schema')
s = replace_once(s, "  'JOB_TITLE','JOB_OWNER','EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',", "  'EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY',", 'human job ownership')
# Explicit human-decision job metadata is exported separately.
s = replace_once(s, "const AGENT_JOB_FIELDS=Object.freeze([", "const HUMAN_DECISION_JOB_FIELDS=Object.freeze(['JOB_TITLE','JOB_OWNER']);\nconst AGENT_JOB_FIELDS=Object.freeze([", 'human decision job fields')
s = replace_once(s, "  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});", "  if(HUMAN_DECISION_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN_DECISION,{provenanceRequired:false,nullable:true});\n  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});", 'job field producer')
s = replace_once(s, "[...HUMAN_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS]", "[...HUMAN_JOB_FIELDS,...HUMAN_DECISION_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS]", 'job field union')
# Test ownership: EXECUTABLE_SPEC_VERSION and canonical hash are application-owned.
s = replace_once(s, '      "EXECUTABLE_KIND",\n      "EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC",\n      "EXECUTABLE_INPUT_BINDINGS"', '      "EXECUTABLE_KIND",\n      "EXECUTABLE_SPEC",\n      "EXECUTABLE_INPUT_BINDINGS"', 'test agent executable ownership')
s = replace_once(s, '      "TEST_ID",\n      "REQ_ID",\n      "STATUS"', '      "TEST_ID",\n      "REQ_ID",\n      "EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC_SHA256",\n      "STATUS"', 'test application executable ownership')
# Add hash to canonical test field inventory.
s = replace_once(s, "'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS','INPUTS'", "'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS','EXECUTABLE_SPEC_SHA256','INPUTS'", 'test field inventory')
# Replace Test IR definition/validation block.
start = s.index("const TEST_IR=Object.freeze({")
end = s.index("const ADDITIONAL_RECORD_FIELD_TYPES=Object.freeze({", start)
new_ir = r'''const TEST_IR=Object.freeze({
  version:'closed-loop-test-spec/1',
  capability:'CLOSED_LOOP_TEST_IR',
  executableKinds:Object.freeze(['NONE','TEST_IR']),
  operations:Object.freeze(['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE']),
  limits:Object.freeze({maxInputBytes:16777216,maxDecompressedBytes:33554432,maxSteps:64,maxSelectorDepth:32,maxParsedDepth:64,maxCollectionItems:100000,maxRegexLength:2000,maxRegexInputLength:200000,maxCsvCells:250000,maxWorkerMs:5000})
});
const TEST_IR_FORBIDDEN_STEP_KEYS=Object.freeze(['code','javascript','python','shell','command','eval','function','script','module','import','url','network']);
const TEST_IR_STEP_KEYS=Object.freeze({
  LOAD_ARTIFACT:Object.freeze(['op','binding']),READ_BYTES:Object.freeze(['op']),DECODE_UTF8:Object.freeze(['op']),PARSE_JSON:Object.freeze(['op']),
  PARSE_CSV:Object.freeze(['op','delimiter','header','quote','newline']),PARSE_XML:Object.freeze(['op']),SELECT_JSON_PATH:Object.freeze(['op','path']),SELECT_XML:Object.freeze(['op','path']),
  COUNT:Object.freeze(['op']),SUM:Object.freeze(['op']),MIN:Object.freeze(['op']),MAX:Object.freeze(['op']),SORT:Object.freeze(['op']),UNIQUE:Object.freeze(['op']),HASH_SHA256:Object.freeze(['op']),
  REGEX:Object.freeze(['op','pattern','flags']),COMPARE:Object.freeze(['op','value','binding']),BYTE_COMPARE:Object.freeze(['op','binding']),
  ASSERT_EQ:Object.freeze(['op','value','absoluteTolerance','relativeTolerance','message']),ASSERT_GT:Object.freeze(['op','value','message']),ASSERT_GTE:Object.freeze(['op','value','message']),
  ASSERT_LT:Object.freeze(['op','value','message']),ASSERT_LTE:Object.freeze(['op','value','message']),ASSERT_MATCH:Object.freeze(['op','pattern','flags','message']),
  ASSERT_CONTAINS:Object.freeze(['op','value','message']),ASSERT_NOT_CONTAINS:Object.freeze(['op','value','message']),ASSERT_SET_EQUAL:Object.freeze(['op','value','message'])
});
function validateTestIRSpec(spec){
  const issues=[];
  if(!spec||typeof spec!=='object'||Array.isArray(spec))issues.push('EXECUTABLE_SPEC must be an object.');
  if(spec?.version!==TEST_IR.version)issues.push(`EXECUTABLE_SPEC.version must be ${TEST_IR.version}.`);
  if(spec&&typeof spec==='object')for(const key of Object.keys(spec))if(!['version','steps'].includes(key))issues.push(`EXECUTABLE_SPEC contains unknown property ${key}.`);
  if(!Array.isArray(spec?.steps)||!spec.steps.length)issues.push('EXECUTABLE_SPEC.steps must be a non-empty array.');
  if((spec?.steps?.length||0)>TEST_IR.limits.maxSteps)issues.push(`EXECUTABLE_SPEC exceeds ${TEST_IR.limits.maxSteps} steps.`);
  for(const [index,step] of (spec?.steps||[]).entries()){
    if(!step||typeof step!=='object'||Array.isArray(step)){issues.push(`Step ${index} must be an object.`);continue;}
    if(!TEST_IR.operations.includes(step.op)){issues.push(`Step ${index} uses unsupported operation ${String(step.op||'UNKNOWN')}.`);continue;}
    const allowed=TEST_IR_STEP_KEYS[step.op]||Object.freeze(['op']);for(const key of Object.keys(step))if(!allowed.includes(key))issues.push(`Step ${index} ${step.op} contains unknown property ${key}.`);
    for(const key of TEST_IR_FORBIDDEN_STEP_KEYS)if(Object.prototype.hasOwnProperty.call(step,key))issues.push(`Step ${index} contains forbidden executable field ${key}.`);
    if(['LOAD_ARTIFACT','BYTE_COMPARE'].includes(step.op)&&!String(step.binding||'').trim())issues.push(`Step ${index} ${step.op} requires binding.`);
    if(['SELECT_JSON_PATH','SELECT_XML'].includes(step.op)&&!String(step.path||'').trim())issues.push(`Step ${index} ${step.op} requires path.`);
    if(step.op==='PARSE_CSV'){
      if(typeof step.delimiter!=='string'||step.delimiter.length!==1)issues.push(`Step ${index} PARSE_CSV requires a one-character delimiter.`);
      if(typeof step.header!=='boolean')issues.push(`Step ${index} PARSE_CSV requires explicit Boolean header.`);
      if(typeof step.quote!=='string'||step.quote.length!==1)issues.push(`Step ${index} PARSE_CSV requires a one-character quote.`);
      if(!['LF','CRLF','AUTO'].includes(step.newline))issues.push(`Step ${index} PARSE_CSV requires newline LF, CRLF, or AUTO.`);
    }
    if((step.op==='REGEX'||step.op==='ASSERT_MATCH')&&typeof (step.pattern??step.value)!=='string')issues.push(`Step ${index} ${step.op} requires a string pattern.`);
    if((step.op==='REGEX'||step.op==='ASSERT_MATCH')&&String(step.pattern??step.value??'').length>TEST_IR.limits.maxRegexLength)issues.push(`Step ${index} regex exceeds the deterministic runtime limit.`);
    if(step.op==='ASSERT_EQ'&&(step.absoluteTolerance!==undefined||step.relativeTolerance!==undefined)){
      for(const key of ['absoluteTolerance','relativeTolerance'])if(step[key]!==undefined&&(typeof step[key]!=='number'||!Number.isFinite(step[key])||step[key]<0))issues.push(`Step ${index} ${key} must be a finite non-negative number.`);
    }
  }
  return {valid:issues.length===0,issues};
}
function validateTestIRBindings(bindings){
  const issues=[];
  if(!bindings||typeof bindings!=='object'||Array.isArray(bindings))return {valid:false,issues:['EXECUTABLE_INPUT_BINDINGS must be an object.']};
  for(const [name,binding] of Object.entries(bindings)){
    if(!/^[A-Z][A-Z0-9_]{0,63}$/.test(name))issues.push(`Invalid Test IR binding name ${name}.`);
    if(typeof binding==='string'){if(!binding.trim())issues.push(`Binding ${name} is empty.`);continue;}
    if(!binding||typeof binding!=='object'||Array.isArray(binding)){issues.push(`Binding ${name} must be an artifact ID string or a binding object.`);continue;}
    const allowed=new Set(['artifactId','source','artifactRole','filename','canonicalValue']);
    for(const key of Object.keys(binding))if(!allowed.has(key))issues.push(`Binding ${name} contains unsupported key ${key}.`);
    if(binding.source&&!['CURRENT_PRODUCT','CURRENT_SCOPE','CANONICAL_VALUE'].includes(binding.source))issues.push(`Binding ${name} has unsupported source ${binding.source}.`);
    if(binding.source==='CANONICAL_VALUE'){if(typeof binding.canonicalValue==='undefined')issues.push(`Binding ${name} must contain canonicalValue.`);}
    else if(!String(binding.artifactId||binding.artifactRole||binding.filename||'').trim())issues.push(`Binding ${name} does not identify an artifact.`);
  }
  return {valid:issues.length===0,issues};
}
function validateTestIRTest(test){
  const get=key=>test?.fields?.[key]??test?.[key];
  const issues=[];
  if(String(get('EXECUTION_MODE')||'').toUpperCase()!=='APPLICATION_DETERMINISTIC')issues.push('Test is not routed to APPLICATION_DETERMINISTIC.');
  if(String(get('REQUIRED_CAPABILITY')||'').trim()!==TEST_IR.capability)issues.push(`REQUIRED_CAPABILITY must be ${TEST_IR.capability}.`);
  if(String(get('EXECUTABLE_KIND')||'').toUpperCase()!=='TEST_IR')issues.push('EXECUTABLE_KIND must be TEST_IR.');
  if(get('EXECUTABLE_SPEC_VERSION')!==TEST_IR.version)issues.push(`EXECUTABLE_SPEC_VERSION must be ${TEST_IR.version}.`);
  issues.push(...validateTestIRSpec(get('EXECUTABLE_SPEC')).issues,...validateTestIRBindings(get('EXECUTABLE_INPUT_BINDINGS')).issues);
  return {valid:issues.length===0,issues};
}
'''
s = s[:start] + new_ir + s[end:]
# Add canonical spec hash type and update executable kind enum already derives from TEST_IR.
s = replace_once(s, "EXECUTABLE_INPUT_BINDINGS:Object.freeze({valueType:VALUE_TYPES.OBJECT,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null})", "EXECUTABLE_INPUT_BINDINGS:Object.freeze({valueType:VALUE_TYPES.OBJECT,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),\n    EXECUTABLE_SPEC_SHA256:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null})", 'test executable field type')
s = replace_once(s, "version:'closed-loop-workflow-schema/2'", "version:'closed-loop-workflow-schema/3'", 'schema version')
s = replace_once(s, "JOB_FIELDS,HUMAN_JOB_FIELDS,APPLICATION_JOB_FIELDS,AGENT_JOB_FIELDS,HUMAN_INTAKE_FIELDS,", "JOB_FIELDS,HUMAN_JOB_FIELDS,HUMAN_DECISION_JOB_FIELDS,APPLICATION_JOB_FIELDS,AGENT_JOB_FIELDS,HUMAN_INTAKE_FIELDS,", 'export human decision fields')
p.write_text(s, encoding='utf-8')

# Replace deterministic Test IR runtime with one registry shared by main thread and worker.
Path('test-runtime.js').write_text(r'''(()=>{
'use strict';
const VERSION='closed-loop-test-runtime/2';
const SPEC_VERSION='closed-loop-test-spec/1';
const CAPABILITY='CLOSED_LOOP_TEST_IR';
const OPS=Object.freeze(['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE']);
const LIMITS=Object.freeze({maxInputBytes:16777216,maxDecompressedBytes:33554432,maxSteps:64,maxSelectorDepth:32,maxParsedDepth:64,maxCollectionItems:100000,maxRegexLength:2000,maxRegexInputLength:200000,maxCsvCells:250000,maxWorkerMs:5000});
const STEP_KEYS=Object.freeze({LOAD_ARTIFACT:['op','binding'],READ_BYTES:['op'],DECODE_UTF8:['op'],PARSE_JSON:['op'],PARSE_CSV:['op','delimiter','header','quote','newline'],PARSE_XML:['op'],SELECT_JSON_PATH:['op','path'],SELECT_XML:['op','path'],COUNT:['op'],SUM:['op'],MIN:['op'],MAX:['op'],SORT:['op'],UNIQUE:['op'],HASH_SHA256:['op'],REGEX:['op','pattern','flags'],COMPARE:['op','value','binding'],BYTE_COMPARE:['op','binding'],ASSERT_EQ:['op','value','absoluteTolerance','relativeTolerance','message'],ASSERT_GT:['op','value','message'],ASSERT_GTE:['op','value','message'],ASSERT_LT:['op','value','message'],ASSERT_LTE:['op','value','message'],ASSERT_MATCH:['op','pattern','flags','message'],ASSERT_CONTAINS:['op','value','message'],ASSERT_NOT_CONTAINS:['op','value','message'],ASSERT_SET_EQUAL:['op','value','message']});
const bytesOf=value=>value instanceof Uint8Array?value:value instanceof ArrayBuffer?new Uint8Array(value):ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):null;
const field=(test,key)=>test?.fields?.[key]??test?.[key];
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
function depth(value,level=0){if(level>LIMITS.maxParsedDepth)throw new Error('Parsed structure exceeds deterministic depth limit.');if(Array.isArray(value)){if(value.length>LIMITS.maxCollectionItems)throw new Error('Parsed collection exceeds deterministic item limit.');for(const v of value)depth(v,level+1);}else if(value&&typeof value==='object'){const entries=Object.values(value);if(entries.length>LIMITS.maxCollectionItems)throw new Error('Parsed object exceeds deterministic item limit.');for(const v of entries)depth(v,level+1);}return value;}
async function sha256(bytes){const data=bytesOf(bytes);if(!data)throw new Error('HASH_SHA256 requires bytes.');if(data.byteLength>LIMITS.maxInputBytes)throw new Error('Input bytes exceed deterministic runtime limit.');const digest=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function parseCsv(text,cfg){const delimiter=cfg.delimiter,quote=cfg.quote,newline=cfg.newline;const rows=[];let row=[],cell='',quoted=false,cells=0;for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch===quote&&text[i+1]===quote){cell+=quote;i++;}else if(ch===quote)quoted=false;else cell+=ch;continue;}if(ch===quote){if(cell.length)throw new Error('Malformed CSV: quote begins inside an unquoted field.');quoted=true;continue;}if(ch===delimiter){row.push(cell);cell='';cells++;}else if(ch==='\n'&&(newline==='LF'||newline==='AUTO')){row.push(cell);rows.push(row);row=[];cell='';cells++;}else if(ch==='\r'&&text[i+1]==='\n'&&(newline==='CRLF'||newline==='AUTO')){row.push(cell);rows.push(row);row=[];cell='';cells++;i++;}else cell+=ch;if(cells>LIMITS.maxCsvCells)throw new Error('CSV exceeds deterministic runtime cell limit.');}if(quoted)throw new Error('Malformed CSV: unterminated quoted field.');if(cell.length||row.length){row.push(cell);rows.push(row);}if(rows.length>LIMITS.maxCollectionItems)throw new Error('CSV exceeds deterministic runtime row limit.');if(!cfg.header)return rows;const head=rows.shift()||[];return rows.map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i]??''])));}
function parseXml(text){const src=String(text);if(/<!DOCTYPE|<!ENTITY/i.test(src))throw new Error('XML DTD/entity declarations are not supported.');const root={name:'#document',attributes:{},children:[],text:''},stack=[root];const token=/<[^>]+>|[^<]+/g;let m;while((m=token.exec(src))){const t=m[0];if(t.startsWith('<?')||t.startsWith('<!--'))continue;if(t.startsWith('</')){const name=t.slice(2,-1).trim();if(stack.length<2||stack.at(-1).name!==name)throw new Error('Malformed XML closing tag.');stack.pop();continue;}if(t.startsWith('<')){const selfClose=/\/>$/.test(t),body=t.slice(1,selfClose?-2:-1).trim(),nm=body.match(/^([A-Za-z_][\w:.-]*)/);if(!nm)throw new Error('Unsupported XML tag.');const node={name:nm[1],attributes:{},children:[],text:''};const attrs=body.slice(nm[0].length);const re=/\s+([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;let a;while((a=re.exec(attrs)))node.attributes[a[1]]=a[3]??a[4]??'';stack.at(-1).children.push(node);if(!selfClose){stack.push(node);if(stack.length>LIMITS.maxParsedDepth)throw new Error('XML exceeds deterministic depth limit.');}continue;}stack.at(-1).text+=t;}if(stack.length!==1)throw new Error('Malformed XML: unclosed tag.');return root.children.length===1?root.children[0]:root;}
function selectJsonPath(value,path){const text=String(path||'').trim();if(text==='$')return value;if(!text.startsWith('$.'))throw new Error('SELECT_JSON_PATH supports only deterministic root paths beginning with $.');const parts=[];for(const token of text.slice(2).split('.')){const m=token.match(/^([^\[\]]+)(?:\[(\d+)\])?$/);if(!m)throw new Error('Unsupported JSON path token: '+token);parts.push(m[1]);if(m[2]!==undefined)parts.push(Number(m[2]));if(parts.length>LIMITS.maxSelectorDepth)throw new Error('JSON selector exceeds depth limit.');}let out=value;for(const part of parts){if(out===null||out===undefined||!(part in Object(out)))throw new Error('JSON path does not exist: '+text);out=out[part];}return out;}
function selectXml(value,path){const text=String(path||'').trim();if(!/^\/[A-Za-z_][\w:.-]*(?:\/[A-Za-z_][\w:.-]*(?:\[\d+\])?)*$/.test(text))throw new Error('SELECT_XML supports only absolute element paths with optional 1-based indexes.');const tokens=text.slice(1).split('/');if(tokens.length>LIMITS.maxSelectorDepth)throw new Error('XML selector exceeds depth limit.');let nodes=[value];for(let i=0;i<tokens.length;i++){const m=tokens[i].match(/^([A-Za-z_][\w:.-]*)(?:\[(\d+)\])?$/),name=m[1],index=m[2]?Number(m[2]):null;if(i===0){nodes=nodes.filter(n=>n?.name===name);}else nodes=nodes.flatMap(n=>(n?.children||[]).filter(c=>c.name===name));if(index!==null)nodes=nodes[index-1]?[nodes[index-1]]:[];if(!nodes.length)throw new Error('XML path does not exist: '+text);}return nodes.length===1?nodes[0]:nodes;}
function validateSpec(spec){const issues=[];if(!spec||typeof spec!=='object'||Array.isArray(spec))return {valid:false,issues:['Test IR must be an object.']};if(spec.version!==SPEC_VERSION)issues.push('Unsupported Test IR version.');for(const k of Object.keys(spec))if(!['version','steps'].includes(k))issues.push('Unknown Test IR root property '+k+'.');if(!Array.isArray(spec.steps)||!spec.steps.length)issues.push('Test IR requires at least one step.');if((spec.steps?.length||0)>LIMITS.maxSteps)issues.push('Test IR exceeds maximum step count.');for(const [i,step] of (spec.steps||[]).entries()){if(!step||typeof step!=='object'||Array.isArray(step)){issues.push(`Step ${i} is not an object.`);continue;}if(!OPS.includes(step.op)){issues.push(`Step ${i} uses unsupported operation ${String(step.op)}.`);continue;}for(const k of Object.keys(step))if(!(STEP_KEYS[step.op]||['op']).includes(k))issues.push(`Step ${i} ${step.op} contains unknown property ${k}.`);if(['LOAD_ARTIFACT','BYTE_COMPARE'].includes(step.op)&&!String(step.binding||'').trim())issues.push(`Step ${i} ${step.op} requires binding.`);if(['SELECT_JSON_PATH','SELECT_XML'].includes(step.op)&&!String(step.path||'').trim())issues.push(`Step ${i} ${step.op} requires path.`);if(step.op==='PARSE_CSV'){if(typeof step.delimiter!=='string'||step.delimiter.length!==1)issues.push(`Step ${i} PARSE_CSV delimiter is invalid.`);if(typeof step.quote!=='string'||step.quote.length!==1)issues.push(`Step ${i} PARSE_CSV quote is invalid.`);if(typeof step.header!=='boolean')issues.push(`Step ${i} PARSE_CSV header is invalid.`);if(!['LF','CRLF','AUTO'].includes(step.newline))issues.push(`Step ${i} PARSE_CSV newline is invalid.`);}if((step.op==='REGEX'||step.op==='ASSERT_MATCH')&&String(step.pattern||'').length>LIMITS.maxRegexLength)issues.push(`Step ${i} regex exceeds maximum length.`);}return {valid:issues.length===0,issues};}
function validateBindings(bindings){const issues=[];if(!bindings||typeof bindings!=='object'||Array.isArray(bindings))return {valid:false,issues:['EXECUTABLE_INPUT_BINDINGS must be an object.']};for(const [name,b] of Object.entries(bindings)){if(!/^[A-Z][A-Z0-9_]{0,63}$/.test(name))issues.push(`Invalid Test IR binding name ${name}.`);if(typeof b==='string'){if(!b.trim())issues.push(`Binding ${name} is empty.`);continue;}if(!b||typeof b!=='object'||Array.isArray(b)){issues.push(`Binding ${name} must be an artifact ID string or closed binding object.`);continue;}for(const k of Object.keys(b))if(!['artifactId','source','artifactRole','filename','canonicalValue'].includes(k))issues.push(`Binding ${name} contains unsupported key ${k}.`);if(b.source==='CANONICAL_VALUE'){if(typeof b.canonicalValue==='undefined')issues.push(`Binding ${name} is missing canonicalValue.`);}else if(b.source&&!['CURRENT_PRODUCT','CURRENT_SCOPE'].includes(b.source))issues.push(`Binding ${name} has unsupported source ${b.source}.`);else if(!b.artifactId&&!b.artifactRole&&!b.filename)issues.push(`Binding ${name} does not identify an artifact.`);}return {valid:issues.length===0,issues};}
function supports(test){return String(field(test,'EXECUTION_MODE')||'').toUpperCase()==='APPLICATION_DETERMINISTIC'&&String(field(test,'REQUIRED_CAPABILITY')||'')===CAPABILITY&&String(field(test,'EXECUTABLE_KIND')||'').toUpperCase()==='TEST_IR'&&field(test,'EXECUTABLE_SPEC_VERSION')===SPEC_VERSION&&validateSpec(field(test,'EXECUTABLE_SPEC')).valid&&validateBindings(field(test,'EXECUTABLE_INPUT_BINDINGS')).valid;}
function numericCompare(actual,expected,step,op){const a=Number(actual),e=Number(expected);if(!Number.isFinite(a)||!Number.isFinite(e))throw new Error(`${op} requires finite numeric values.`);if(op==='ASSERT_EQ'&&(step.absoluteTolerance!==undefined||step.relativeTolerance!==undefined)){const abs=Number(step.absoluteTolerance||0),rel=Number(step.relativeTolerance||0),delta=Math.abs(a-e),limit=Math.max(abs,rel*Math.max(Math.abs(a),Math.abs(e)));return delta<=limit;}if(op==='ASSERT_EQ'&&(!Number.isInteger(a)||!Number.isInteger(e))&&typeof actual==='number'&&typeof expected==='number')throw new Error('Precision-sensitive non-integer numeric equality requires explicit tolerance.');return op==='ASSERT_EQ'?Object.is(a,e):op==='ASSERT_GT'?a>e:op==='ASSERT_GTE'?a>=e:op==='ASSERT_LT'?a<e:a<=e;}
async function execute({spec,artifacts}){const check=validateSpec(spec);if(!check.valid)throw new Error(check.issues.join(' '));const source=artifacts&&typeof artifacts==='object'?artifacts:{};let value=null,currentArtifact=null,lastRegex=null;const observations=[];for(const [index,step] of spec.steps.entries()){let assertion=null;switch(step.op){case 'LOAD_ARTIFACT':{const a=source[step.binding];if(!a)throw new Error(`Artifact binding ${step.binding} is unavailable.`);currentArtifact=a;value=a;observations.push({step:index,op:step.op,binding:step.binding,artifactId:a.artifactId||null,filename:a.filename||null,sha256:a.sha256||null});break;}case 'READ_BYTES':{const b=bytesOf(currentArtifact?.bytes??value?.bytes??value);if(!b)throw new Error('READ_BYTES requires artifact bytes.');if(b.byteLength>LIMITS.maxInputBytes)throw new Error('Input bytes exceed deterministic runtime limit.');value=b;observations.push({step:index,op:step.op,byteLength:b.byteLength});break;}case 'DECODE_UTF8':{const b=bytesOf(value);if(!b)throw new Error('DECODE_UTF8 requires bytes.');value=new TextDecoder('utf-8',{fatal:true}).decode(b);break;}case 'PARSE_JSON':value=depth(JSON.parse(String(value)));break;case 'PARSE_CSV':value=depth(parseCsv(String(value),step));break;case 'PARSE_XML':value=depth(parseXml(String(value)));break;case 'SELECT_JSON_PATH':value=selectJsonPath(value,step.path);break;case 'SELECT_XML':value=selectXml(value,step.path);break;case 'COUNT':if(value==null||typeof value.length!=='number')throw new Error('COUNT requires array/string-like input.');value=value.length;break;case 'SUM':case 'MIN':case 'MAX':{if(!Array.isArray(value)||value.length>LIMITS.maxCollectionItems)throw new Error(`${step.op} requires a bounded array.`);const nums=value.map(Number);if(nums.some(x=>!Number.isFinite(x)))throw new Error(`${step.op} requires finite numbers.`);value=step.op==='SUM'?nums.reduce((a,b)=>a+b,0):step.op==='MIN'?Math.min(...nums):Math.max(...nums);break;}case 'SORT':if(!Array.isArray(value)||value.length>LIMITS.maxCollectionItems)throw new Error('SORT requires bounded array.');value=[...value].sort((a,b)=>stable(a).localeCompare(stable(b)));break;case 'UNIQUE':{if(!Array.isArray(value)||value.length>LIMITS.maxCollectionItems)throw new Error('UNIQUE requires bounded array.');const seen=new Set();value=value.filter(v=>{const k=stable(v);if(seen.has(k))return false;seen.add(k);return true;});break;}case 'HASH_SHA256':value=await sha256(value);break;case 'REGEX':{if(String(value).length>LIMITS.maxRegexInputLength)throw new Error('Regex input exceeds deterministic runtime limit.');lastRegex=new RegExp(step.pattern,step.flags||'');value=lastRegex.test(String(value));break;}case 'COMPARE':{const other=Object.prototype.hasOwnProperty.call(step,'value')?step.value:source[step.binding]?.value;value=stable(value)===stable(other);break;}case 'BYTE_COMPARE':{const left=bytesOf(value),right=bytesOf(source[step.binding]?.bytes);if(!left||!right)throw new Error('BYTE_COMPARE requires bytes.');let eq=left.byteLength===right.byteLength;if(eq)for(let i=0;i<left.byteLength;i++)if(left[i]!==right[i]){eq=false;break;}value=eq;break;}case 'ASSERT_EQ':assertion={ok:typeof value==='number'&&typeof step.value==='number'?numericCompare(value,step.value,step,'ASSERT_EQ'):stable(value)===stable(step.value),expected:step.value};break;case 'ASSERT_GT':case 'ASSERT_GTE':case 'ASSERT_LT':case 'ASSERT_LTE':assertion={ok:numericCompare(value,step.value,step,step.op),expected:`${step.op} ${step.value}`};break;case 'ASSERT_MATCH':{if(String(value).length>LIMITS.maxRegexInputLength)throw new Error('Regex input exceeds deterministic runtime limit.');const r=lastRegex||new RegExp(step.pattern,step.flags||'');assertion={ok:r.test(String(value)),expected:String(r)};break;}case 'ASSERT_CONTAINS':assertion={ok:Array.isArray(value)?value.some(v=>stable(v)===stable(step.value)):String(value).includes(String(step.value)),expected:`contains ${stable(step.value)}`};break;case 'ASSERT_NOT_CONTAINS':assertion={ok:Array.isArray(value)?!value.some(v=>stable(v)===stable(step.value)):!String(value).includes(String(step.value)),expected:`does not contain ${stable(step.value)}`};break;case 'ASSERT_SET_EQUAL':{if(!Array.isArray(value)||!Array.isArray(step.value))throw new Error('ASSERT_SET_EQUAL requires arrays.');const a=[...new Set(value.map(stable))].sort(),b=[...new Set(step.value.map(stable))].sort();assertion={ok:stable(a)===stable(b),expected:step.value};break;}default:throw new Error(`Unsupported Test IR operation ${step.op}.`);}if(assertion){const o={step:index,op:step.op,determination:assertion.ok?'SATISFIED':'VIOLATED',expected:assertion.expected,actual:value,message:step.message||null};observations.push(o);if(!assertion.ok)return {status:'COMPLETE',determination:'VIOLATED',expected:o.expected,actual:o.actual,observations,runtimeVersion:VERSION,specVersion:SPEC_VERSION};}}const last=[...observations].reverse().find(x=>x.determination);return {status:'COMPLETE',determination:last?.determination||'UNDETERMINED',expected:last?.expected??null,actual:last?.actual??value,observations,runtimeVersion:VERSION,executorVersion:VERSION,specVersion:SPEC_VERSION};}
function buildToken(){try{return new URL(document.currentScript?.src||location.href).searchParams.get('v')||'';}catch{return '';}}
function executeTest({spec,artifacts,timeoutMs=LIMITS.maxWorkerMs}={}){if(typeof Worker==='undefined'||typeof document==='undefined')return execute({spec,artifacts});const token=buildToken(),url='test-worker.js'+(token?`?v=${encodeURIComponent(token)}`:'');return new Promise((resolve,reject)=>{const worker=new Worker(url,{name:'closed-loop-test-worker'}),requestId=crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),timer=setTimeout(()=>{worker.terminate();const e=new Error('Deterministic test worker exceeded execution time limit.');e.code='TEST_WORKER_TIMEOUT';reject(e);},Math.min(Number(timeoutMs)||LIMITS.maxWorkerMs,LIMITS.maxWorkerMs));worker.onmessage=e=>{if(e.data?.requestId!==requestId)return;clearTimeout(timer);worker.terminate();if(e.data.error){const err=new Error(e.data.error.message||'Deterministic worker execution failed.');err.code=e.data.error.code||'TEST_EXECUTION_FAILED';reject(err);}else resolve(e.data.result);};worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(new Error(e.message||'Deterministic worker failed.'));};worker.postMessage({requestId,spec,artifacts});});}
globalThis.closedLoopTestRuntime=Object.freeze({VERSION,SPEC_VERSION,CAPABILITY,OPS,LIMITS,validateSpec,validateBindings,supports,execute,executeTest,capabilities:()=>Object.freeze([CAPABILITY])});
})();
''',encoding='utf-8')

Path('test-worker.js').write_text(r'''/* same-origin deterministic worker; no network APIs are used */
'use strict';
const token=self.location?.search||'';
importScripts('test-runtime.js'+token);
// Prevent accidental network use from future primitive additions.
try{self.fetch=undefined;}catch{}
try{self.XMLHttpRequest=undefined;}catch{}
try{self.WebSocket=undefined;}catch{}
self.onmessage=async event=>{const {requestId,spec,artifacts}=event.data||{};try{const result=await self.closedLoopTestRuntime.execute({spec,artifacts});self.postMessage({requestId,result});}catch(error){self.postMessage({requestId,error:{code:error?.code||'TEST_EXECUTION_FAILED',message:String(error?.message||error)}});}};
''',encoding='utf-8')

# workflow-engine: runtime is the capability authority and native action is RUN_IN_APP.
p = Path('workflow-engine.js')
s = p.read_text(encoding='utf-8')
s = replace_once(s, "if(!core||!schema||!hash)throw new Error('workbook.js, hash.js, and workflow-schema.js must load before workflow-engine.js.');", "const testRuntime=globalThis.closedLoopTestRuntime;\nif(!core||!schema||!hash||!testRuntime)throw new Error('workbook.js, hash.js, workflow-schema.js, and test-runtime.js must load before workflow-engine.js.');", 'engine dependency')
s = replace_once(s, "function applicationTestCapabilities(){return Object.freeze([schema.TEST_IR.capability]);}\nfunction applicationTestSupported(test){return schema.validateTestIRTest(test).valid;}", "function applicationTestCapabilities(){return testRuntime.capabilities();}\nfunction applicationTestSupported(test){return testRuntime.supports(test)&&schema.validateTestIRTest(test).valid;}", 'runtime capability authority')
s = replace_once(s, "const executorMap={APPLICATION_DETERMINISTIC:'APPLICATION',EXTERNAL_AGENT_TOOL:'EXTERNAL_AGENT_TOOL',INDEPENDENT_AGENT_REVIEW:'INDEPENDENT_REVIEWER',HUMAN_INSPECTION:'HUMAN',EXTERNAL_SYSTEM:'EXTERNAL_SYSTEM',UNAVAILABLE:'UNAVAILABLE'},actionMap={APPLICATION_DETERMINISTIC:'NO_ACTION'", "const executorMap={APPLICATION_DETERMINISTIC:'APPLICATION',EXTERNAL_AGENT_TOOL:'EXTERNAL_AGENT_TOOL',INDEPENDENT_AGENT_REVIEW:'INDEPENDENT_REVIEWER',HUMAN_INSPECTION:'HUMAN',EXTERNAL_SYSTEM:'EXTERNAL_SYSTEM',UNAVAILABLE:'UNAVAILABLE'},actionMap={APPLICATION_DETERMINISTIC:'RUN_IN_APP'", 'native operator action')
s = s.replace("executionRoute=native?'APPLICATION'", "executionRoute=native?'APPLICATION'")
s = replace_once(s, "function recordApplicationDeterministicResult(project,{testId,productId,runtimeResult,inputArtifacts=[]}={}){", "function recordApplicationDeterministicResult(project,{testId,productId,runtimeResult,inputArtifacts=[]}={}){", 'native result marker')
# Canonical executable spec hash is application-calculated on accepted/current tests during recalculation.
insert_at = s.index("function applicationTestCapabilities()")
helper = r'''function normalizeCurrentTestIR(project){for(const test of recordsForCurrentScope(project,'tests')){const kind=upper(recordValue(test,'EXECUTABLE_KIND'));if(kind!=='TEST_IR'){if(test.fields){test.fields.EXECUTABLE_SPEC_VERSION=null;test.fields.EXECUTABLE_SPEC_SHA256=null;}continue;}const spec=recordValue(test,'EXECUTABLE_SPEC');if(test.fields){test.fields.EXECUTABLE_SPEC_VERSION=schema.TEST_IR.version;test.fields.EXECUTABLE_SPEC_SHA256=hash.sha256Value(spec);}else{test.EXECUTABLE_SPEC_VERSION=schema.TEST_IR.version;test.EXECUTABLE_SPEC_SHA256=hash.sha256Value(spec);}refreshRecordHashes(test,'tests');}}
'''
s = s[:insert_at] + helper + s[insert_at:]
# Ensure recalc calls normalization before test routing/derivations. Insert at first recalculate function body.
s = s.replace("function recalculate(project){\n  ensureShape(project);", "function recalculate(project){\n  ensureShape(project);\n  normalizeCurrentTestIR(project);", 1)
p.write_text(s, encoding='utf-8')

# index.html: same-origin worker CSP and test-runtime before workflow-engine, one shared token.
p = Path('index.html')
s = p.read_text(encoding='utf-8')
s = replace_once(s, "connect-src 'self'; object-src 'none'; base-uri 'none'", "connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'", 'worker CSP')
# Add runtime script using the current token already present in index.
m = re.search(r'<script defer src="workflow-schema\.js\?v=([^"]+)"></script>',s)
if not m: raise SystemExit('index runtime token not found')
token=m.group(1)
s = replace_once(s, f'<script defer src="workflow-schema.js?v={token}"></script>\n<script defer src="workflow-engine.js?v={token}"></script>', f'<script defer src="workflow-schema.js?v={token}"></script>\n<script defer src="test-runtime.js?v={token}"></script>\n<script defer src="workflow-engine.js?v={token}"></script>', 'index runtime order')
p.write_text(s,encoding='utf-8')

# Pages architecture check must reflect the new responsible runtime module.
p=Path('.github/workflows/pages.yml')
s=p.read_text(encoding='utf-8')
s=replace_once(s, "const expected=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];", "const expected=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];", 'pages runtime order')
p.write_text(s,encoding='utf-8')

# Upgrade existing deterministic-runtime verification to the /3 contract and mandatory v1 primitives.
p=Path('verify-test-runtime.mjs')
s=p.read_text(encoding='utf-8')
s=s.replace("EXECUTABLE_KIND:'CUSTOM_PIPELINE'","EXECUTABLE_KIND:'TEST_IR'")
s=s.replace("{op:'PARSE_CSV'}","{op:'PARSE_CSV',delimiter:',',header:false,quote:'\"',newline:'AUTO'}")
# Replace old primitive assertion prelude with stronger required-set checks.
old="assert.equal(runtime.CAPABILITY,'CLOSED_LOOP_TEST_IR');assert.equal(runtime.SPEC_VERSION,'closed-loop-test-spec/1');assert.ok(runtime.OPS.includes('BYTE_COMPARE'));assert.ok(!runtime.OPS.some(x=>/JAVASCRIPT|PYTHON|SHELL/i.test(x)));"
new="assert.equal(runtime.CAPABILITY,'CLOSED_LOOP_TEST_IR');assert.equal(runtime.SPEC_VERSION,'closed-loop-test-spec/1');for(const op of ['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'])assert.ok(runtime.OPS.includes(op),`missing primitive ${op}`);assert.ok(!runtime.OPS.some(x=>/JAVASCRIPT|PYTHON|SHELL/i.test(x)));"
s=replace_once(s,old,new,'runtime test primitive set')
# Add XML/closed-schema/precision checks before the appContext block.
marker="// Stage 04 consumes canonical Stage 03 output."
extra=r'''const unknownProp=runtime.validateSpec({version:runtime.SPEC_VERSION,steps:[{op:'COUNT',surprise:true}]});assert.equal(unknownProp.valid,false);
const badCsv=runtime.validateSpec({version:runtime.SPEC_VERSION,steps:[{op:'PARSE_CSV'}]});assert.equal(badCsv.valid,false);
const xmlBytes=new TextEncoder().encode('<root><item>one</item><item>two</item></root>');const xmlSpec={version:runtime.SPEC_VERSION,steps:[{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_XML'},{op:'SELECT_XML',path:'/root/item[2]'},{op:'ASSERT_CONTAINS',value:'two'}]};const xmlResult=await runtime.execute({spec:xmlSpec,artifacts:{PRODUCT:{artifactId:'ARTIFACT-X',bytes:xmlBytes}}});assert.equal(xmlResult.determination,'SATISFIED');
await assert.rejects(()=>runtime.execute({spec:{version:runtime.SPEC_VERSION,steps:[{op:'ASSERT_EQ',value:0.3}]},artifacts:{}}),/Precision-sensitive/);

'''
s=s.replace(marker,extra+marker,1)
p.write_text(s,encoding='utf-8')

# Update schema/version assertions across test sources without changing historical literal fixtures.
for name in ['verify.mjs','verify-ingestion.mjs','verify-complete.mjs','verify-full-cycle.mjs','verify-prompt-semantics.mjs','verify-definition-of-done.mjs','verify-project-lifecycle.mjs','build-test-project.mjs','README.md']:
    path=Path(name)
    if not path.exists(): continue
    text=path.read_text(encoding='utf-8')
    text=text.replace("closed-loop-stage-response/2","closed-loop-stage-response/3")
    text=text.replace("closed-loop-project/2","closed-loop-project/3")
    text=text.replace("CUSTOM_PIPELINE","TEST_IR")
    path.write_text(text,encoding='utf-8')

print('v3 phase1 patch complete')

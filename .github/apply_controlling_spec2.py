from pathlib import Path

def rep(text,old,new,label):
    if old not in text: raise SystemExit(f'missing patch anchor: {label}')
    return text.replace(old,new,1)

p=Path('workflow-schema.js');s=p.read_text()
s=rep(s,"  '1':Object.freeze({DESIRED_SOURCE_COUNT:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:true,normalizerKey:null,closedProperties:null})}),","  '1':Object.freeze({DESIRED_SOURCE_COUNT:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:true,normalizerKey:null,closedProperties:null}),INTAKE_ACCOUNTING:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),\n  '4':Object.freeze({OBLIGATION_ACCOUNTING:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),",'Stage 01/04 accounting field types')
s=rep(s,"executableKinds:Object.freeze(['NONE','CUSTOM_PIPELINE']),","executableKinds:Object.freeze(['NONE','TEST_IR']),",'Test IR kind enum')
s=rep(s,"operations:Object.freeze(['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','SELECT_JSON_PATH',","operations:Object.freeze(['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML',",'required XML operations')
s=rep(s,"limits:Object.freeze({maxSteps:64,maxTextBytes:16777216,maxCollectionItems:100000,maxRegexLength:2000,maxCsvCells:250000})","limits:Object.freeze({maxTotalInputBytes:33554432,maxDecompressedBytes:67108864,maxSteps:64,maxSelectorDepth:64,maxParsedDepth:128,maxCollectionItems:100000,maxRegexLength:2000,maxRegexInputLength:4194304,maxCsvCells:250000,maxWorkerDurationMs:5000,maxArchiveExpansionBytes:67108864})",'central Test IR limits')
s=rep(s,"if(String(get('EXECUTABLE_KIND')||'').toUpperCase()!=='CUSTOM_PIPELINE')issues.push('EXECUTABLE_KIND must be CUSTOM_PIPELINE.');","if(String(get('EXECUTABLE_KIND')||'').toUpperCase()!=='TEST_IR')issues.push('EXECUTABLE_KIND must be TEST_IR.');",'schema Test IR kind validation')
# Application owns the canonical spec version; validate supplied normalized canonical tests but do not expose it as agent-writable.
s=s.replace("  if(get('EXECUTABLE_SPEC_VERSION')!==TEST_IR.version)issues.push(`EXECUTABLE_SPEC_VERSION must be ${TEST_IR.version}.`);","  if(get('EXECUTABLE_SPEC_VERSION')!==undefined&&get('EXECUTABLE_SPEC_VERSION')!==null&&get('EXECUTABLE_SPEC_VERSION')!==TEST_IR.version)issues.push(`EXECUTABLE_SPEC_VERSION must be ${TEST_IR.version}.`);",1)
# Mirror the runtime's closed operation property contracts in ingestion-time schema validation.
old="""    if(!TEST_IR.operations.includes(step.op))issues.push(`Step ${index} uses unsupported operation ${String(step.op||'UNKNOWN')}.`);
    for(const key of TEST_IR_FORBIDDEN_STEP_KEYS)if(Object.prototype.hasOwnProperty.call(step,key))issues.push(`Step ${index} contains forbidden executable field ${key}.`);
    if((step.op==='REGEX'||step.op==='ASSERT_MATCH')&&String(step.pattern??step.value??'').length>TEST_IR.limits.maxRegexLength)issues.push(`Step ${index} regex exceeds the deterministic runtime limit.`);"""
new="""    if(!TEST_IR.operations.includes(step.op)){issues.push(`Step ${index} uses unsupported operation ${String(step.op||'UNKNOWN')}.`);continue;}
    for(const key of TEST_IR_FORBIDDEN_STEP_KEYS)if(Object.prototype.hasOwnProperty.call(step,key))issues.push(`Step ${index} contains forbidden executable field ${key}.`);
    const common=new Set(['op','message']),allowed={LOAD_ARTIFACT:['binding'],READ_BYTES:[],DECODE_UTF8:[],PARSE_JSON:[],PARSE_CSV:['delimiter','header','quote','newline'],PARSE_XML:[],SELECT_JSON_PATH:['path'],SELECT_XML:['selector'],COUNT:[],SUM:[],MIN:[],MAX:[],SORT:[],UNIQUE:[],HASH_SHA256:[],REGEX:['pattern','flags'],COMPARE:['value','binding'],BYTE_COMPARE:['binding'],ASSERT_EXISTS:['value'],ASSERT_TYPE:['value'],ASSERT_EQ:['value','absoluteTolerance','relativeTolerance'],ASSERT_NE:['value'],ASSERT_GT:['value'],ASSERT_GTE:['value'],ASSERT_LT:['value'],ASSERT_LTE:['value'],ASSERT_MATCH:['pattern','flags','value'],ASSERT_CONTAINS:['value'],ASSERT_NOT_CONTAINS:['value'],ASSERT_SET_EQUAL:['value']}[step.op]||[];for(const key of Object.keys(step))if(!common.has(key)&&!allowed.includes(key))issues.push(`Step ${index} contains unknown operation property ${key}.`);
    if(['LOAD_ARTIFACT','BYTE_COMPARE'].includes(step.op)&&!String(step.binding||'').trim())issues.push(`Step ${index} requires binding.`);
    if(step.op==='SELECT_JSON_PATH'&&!String(step.path||'').trim())issues.push(`Step ${index} requires path.`);
    if(step.op==='SELECT_XML'&&!String(step.selector||'').trim())issues.push(`Step ${index} requires selector.`);
    if(step.op==='PARSE_CSV'&&(typeof step.delimiter!=='string'||step.delimiter.length!==1||typeof step.quote!=='string'||step.quote.length!==1||typeof step.header!=='boolean'||!['LF','CRLF'].includes(step.newline)))issues.push(`Step ${index} requires explicit delimiter, header, quote, and newline CSV configuration.`);
    if((step.op==='REGEX'||step.op==='ASSERT_MATCH')&&String(step.pattern??step.value??'').length>TEST_IR.limits.maxRegexLength)issues.push(`Step ${index} regex exceeds the deterministic runtime limit.`);"""
s=rep(s,old,new,'closed schema Test IR op contracts')
p.write_text(s)

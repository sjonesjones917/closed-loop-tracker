import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const text=file=>fs.readFileSync(file,'utf8');
const context={console,crypto:webcrypto,TextEncoder,TextDecoder,Blob,URL,URLSearchParams,setTimeout,clearTimeout,structuredClone};
context.globalThis=context;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js'])vm.runInNewContext(text(file),context,{filename:file});
const core=context.closedLoopCore,schema=context.closedLoopSchema,runtime=context.closedLoopTestRuntime;
assert(core&&schema&&runtime,'Required runtime authorities did not load.');
assert(core.PROJECT_SCHEMA==='closed-loop-project/3','Project schema is not closed-loop-project/3.');
assert(schema.RESPONSE_SCHEMA==='closed-loop-stage-response/3','Response schema is not closed-loop-stage-response/3.');
assert(core.WORKFLOW_ID==='mobile-closed-loop/30','Workflow identity changed.');
assert(core.STAGE_COUNT===30,'Stage count changed.');
assert(schema.JOB_FIELDS.JOB_TITLE.producer==='HUMAN_DECISION','JOB_TITLE is not HUMAN_DECISION owned.');
assert(schema.JOB_FIELDS.JOB_OWNER.producer==='HUMAN_DECISION','JOB_OWNER is not HUMAN_DECISION owned.');
const testOwnership=schema.RECORD_OWNERSHIP?.tests;
assert(testOwnership,'Tests ownership partition is unavailable.');
assert(!testOwnership.agent.includes('EXECUTABLE_SPEC_VERSION'),'Agent still owns EXECUTABLE_SPEC_VERSION.');
assert(testOwnership.application.includes('EXECUTABLE_SPEC_VERSION'),'Application does not own EXECUTABLE_SPEC_VERSION.');

const requiredOperations=[
  'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML',
  'SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256',
  'REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH',
  'ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'
];
assert(JSON.stringify([...runtime.OPERATIONS])===JSON.stringify(requiredOperations),'Registered Test IR primitive set differs from the controlling set.');
assert(runtime.SPEC_VERSION==='closed-loop-test-spec/1','Test IR version is wrong.');
assert(runtime.RUNTIME_VERSION==='closed-loop-test-runtime/1','Runtime version is wrong.');
const limits=runtime.RESOURCE_LIMITS;
for(const key of ['maxInputBytes','maxDecompressedBytes','maxSteps','maxSelectorDepth','maxParsedDepth','maxCollectionSize','maxRegexPatternLength','maxRegexInputLength','maxWorkerMs','maxArchiveExpansionBytes'])assert(Number.isInteger(limits[key])&&limits[key]>0,'Missing centralized positive limit '+key+'.');

const jsonSpec={version:'closed-loop-test-spec/1',steps:[
  {op:'LOAD_ARTIFACT',binding:'PRODUCT'},
  {op:'READ_BYTES'},
  {op:'DECODE_UTF8'},
  {op:'PARSE_JSON'},
  {op:'SELECT_JSON_PATH',path:'$.runs'},
  {op:'COUNT'},
  {op:'ASSERT_EQ',value:10}
]};
assert(runtime.validateSpec(jsonSpec).valid,'Valid Test IR was rejected.');
const invalidSpecs={
  unknownRootProperty:{...jsonSpec,source:'javascript'},
  unknownVersion:{...jsonSpec,version:'closed-loop-test-spec/9'},
  unknownOperation:{version:'closed-loop-test-spec/1',steps:[{op:'JAVASCRIPT',source:'return true'}]},
  arbitraryPython:{version:'closed-loop-test-spec/1',steps:[{op:'PYTHON',source:'print(1)'}]},
  shellExecution:{version:'closed-loop-test-spec/1',steps:[{op:'SHELL',command:'true'}]},
  networkOperation:{version:'closed-loop-test-spec/1',steps:[{op:'FETCH',url:'https://example.invalid'}]},
  unknownOperationProperty:{version:'closed-loop-test-spec/1',steps:[{op:'COUNT',source:'x'}]},
  missingRequiredArgument:{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT'}]},
  wrongArgumentType:{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:2}]},
  unsupportedJsonSelector:{version:'closed-loop-test-spec/1',steps:[{op:'SELECT_JSON_PATH',path:'$..secret'}]},
  unsupportedXmlSelector:{version:'closed-loop-test-spec/1',steps:[{op:'SELECT_XML',selector:'//item'}]},
  implicitCsvDefaults:{version:'closed-loop-test-spec/1',steps:[{op:'PARSE_CSV'}]},
  unsafeRegex:{version:'closed-loop-test-spec/1',steps:[{op:'REGEX',pattern:'(a+)+$'}]},
  precisionWithoutTolerance:{version:'closed-loop-test-spec/1',steps:[{op:'ASSERT_EQ',value:0.1}]},
  incompleteByteCompare:{version:'closed-loop-test-spec/1',steps:[{op:'BYTE_COMPARE'}]},
  tooManySteps:{version:'closed-loop-test-spec/1',steps:Array.from({length:limits.maxSteps+1},()=>({op:'COUNT'}))}
};
for(const [name,spec] of Object.entries(invalidSpecs))assert(!runtime.validateSpec(spec).valid,name+' was accepted.');

const encode=value=>new TextEncoder().encode(value);
const execute=(spec,bindings,testId='TEST-V3')=>runtime.executeNormalizedSpec({spec,bindings,testId});
let result=await execute(jsonSpec,{PRODUCT:{bytes:encode(JSON.stringify({runs:Array.from({length:10},(_,index)=>index)}))}});
assert(result.status==='SATISFIED','Native JSON selection/count assertion failed.');
assert(result.testSpecVersion==='closed-loop-test-spec/1','Native result omitted Test IR version.');
assert(result.executorVersion==='closed-loop-test-runtime/1','Native result omitted runtime version.');

const csvSpec={version:'closed-loop-test-spec/1',steps:[
  {op:'LOAD_ARTIFACT',binding:'CSV'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},
  {op:'PARSE_CSV',delimiter:',',header:true,quote:'"',newline:'LF'},
  {op:'COUNT'},{op:'ASSERT_EQ',value:2}
]};
result=await execute(csvSpec,{CSV:{bytes:encode('name,value\na,1\nb,2')}});
assert(result.status==='SATISFIED','Explicit CSV contract was not honored.');

const xmlSpec={version:'closed-loop-test-spec/1',steps:[
  {op:'LOAD_ARTIFACT',binding:'XML'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},
  {op:'PARSE_XML'},{op:'SELECT_XML',selector:'/root/item'},{op:'COUNT'},{op:'ASSERT_EQ',value:2}
]};
result=await execute(xmlSpec,{XML:{bytes:encode('<root><item/><item/></root>')}});
assert(result.status==='SATISFIED','Restricted XML execution failed.');
result=await execute(xmlSpec,{XML:{bytes:encode('<!DOCTYPE root [<!ENTITY x "bad">]><root/>')}});
assert(result.status==='EXECUTION_FAILED','Unsafe XML declaration was not rejected.');

const compareSpec={version:'closed-loop-test-spec/1',steps:[
  {op:'LOAD_ARTIFACT',binding:'LEFT'},{op:'BYTE_COMPARE',binding:'RIGHT'},{op:'ASSERT_EQ',value:true}
]};
result=await execute(compareSpec,{LEFT:{bytes:new Uint8Array([1,2,3])},RIGHT:{bytes:new Uint8Array([1,2,3])}});
assert(result.status==='SATISFIED','Equal bytes were not established equal.');
result=await execute(compareSpec,{LEFT:{bytes:new Uint8Array([1,2,3])},RIGHT:{bytes:new Uint8Array([1,2,4])}});
assert(result.status==='VIOLATED','Different bytes were not established different.');

const multiArtifactSpec={version:'closed-loop-test-spec/1',steps:[
  {op:'BYTE_COMPARE',leftBinding:'LEFT',rightBinding:'RIGHT'},{op:'ASSERT_EQ',value:true}
]};
result=await execute(multiArtifactSpec,{LEFT:{bytes:new Uint8Array([9])},RIGHT:{bytes:new Uint8Array([9])}});
assert(result.status==='SATISFIED','Multi-artifact binding failed.');

const hashSpec={version:'closed-loop-test-spec/1',steps:[
  {op:'LOAD_ARTIFACT',binding:'A'},{op:'READ_BYTES'},{op:'HASH_SHA256'},
  {op:'ASSERT_EQ',value:createHash('sha256').update('abc').digest('hex')}
]};
result=await execute(hashSpec,{A:{bytes:encode('abc')}});
assert(result.status==='SATISFIED','HASH_SHA256 differs from SHA-256 authority.');

const integerSpec={version:'closed-loop-test-spec/1',steps:[
  {op:'LOAD_ARTIFACT',binding:'VALUES'},{op:'SUM'},{op:'ASSERT_EQ',value:Number.MAX_SAFE_INTEGER}
]};
result=await execute(integerSpec,{VALUES:[Number.MAX_SAFE_INTEGER-1,1]});
assert(result.status==='SATISFIED','Safe-integer exactness failed.');
const decimalSpec={version:'closed-loop-test-spec/1',steps:[
  {op:'LOAD_ARTIFACT',binding:'VALUES'},{op:'SUM'},{op:'ASSERT_EQ',value:'0.3'}
]};
result=await execute(decimalSpec,{VALUES:['0.1','0.2']});
assert(result.status==='SATISFIED','Exact decimal-string arithmetic failed.');
const toleranceSpec={version:'closed-loop-test-spec/1',steps:[
  {op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:0.3,absoluteTolerance:1e-12}
]};
result=await execute(toleranceSpec,{VALUE:0.1+0.2});
assert(result.status==='SATISFIED','Explicit approximate tolerance failed.');

const setSpec={version:'closed-loop-test-spec/1',steps:[
  {op:'LOAD_ARTIFACT',binding:'VALUES'},{op:'UNIQUE'},{op:'SORT',direction:'ASC'},{op:'ASSERT_SET_EQUAL',value:[1,2,3]}
]};
result=await execute(setSpec,{VALUES:[3,1,2,2]});
assert(result.status==='SATISFIED','UNIQUE/SORT/ASSERT_SET_EQUAL failed.');

const regexSpec={version:'closed-loop-test-spec/1',steps:[
  {op:'LOAD_ARTIFACT',binding:'TEXT'},{op:'ASSERT_MATCH',pattern:'^closed-loop-[0-9]+$',flags:''}
]};
result=await execute(regexSpec,{TEXT:'closed-loop-30'});
assert(result.status==='SATISFIED','Restricted regex match failed.');
const longRegexInput={version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'TEXT'},{op:'REGEX',pattern:'a'}]};
result=await execute(longRegexInput,{TEXT:'a'.repeat(limits.maxRegexInputLength+1)});
assert(result.status==='EXECUTION_FAILED','Regex input limit was not enforced.');

const invalidUtf8={version:'closed-loop-test-spec/1',steps:[
  {op:'LOAD_ARTIFACT',binding:'A'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'ASSERT_EQ',value:'x'}
]};
result=await execute(invalidUtf8,{A:{bytes:new Uint8Array([0xff])}});
assert(result.status==='EXECUTION_FAILED','Invalid UTF-8 disposition is wrong.');
const missingBytes={version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'A'},{op:'READ_BYTES'}]};
result=await execute(missingBytes,{A:{filename:'metadata-only.txt'}});
assert(result.status==='BLOCKED','Metadata-only artifact did not block byte execution.');
const largeInput=new Uint8Array(limits.maxInputBytes+1);
result=await execute(missingBytes,{A:{bytes:largeInput}});
assert(result.status==='EXECUTION_FAILED','Input-byte execution limit was not enforced.');

const nested={};let cursor=nested;for(let index=0;index<limits.maxParsedDepth+2;index++){cursor.next={};cursor=cursor.next;}
const depthSpec={version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'A'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_JSON'}]};
result=await execute(depthSpec,{A:{bytes:encode(JSON.stringify(nested))}});
assert(result.status==='EXECUTION_FAILED','Parsed-depth limit was not enforced.');

const normalizedA=runtime.normalizeSpec(jsonSpec),normalizedB=runtime.normalizeSpec(JSON.parse(JSON.stringify(jsonSpec)));
assert(runtime.stableStringify(normalizedA)===runtime.stableStringify(normalizedB),'Normalized Test IR is unstable.');
const hashA=await runtime.sha256(encode(runtime.stableStringify(normalizedA)));
const hashB=await runtime.sha256(encode(runtime.stableStringify(normalizedB)));
assert(hashA===hashB,'Normalized Test IR hash is unstable.');
const changed=JSON.parse(JSON.stringify(jsonSpec));changed.steps.at(-1).value=9;
const changedHash=await runtime.sha256(encode(runtime.stableStringify(runtime.normalizeSpec(changed))));
assert(changedHash!==hashA,'Semantically changed Test IR retained the old hash.');

const sources=Object.fromEntries([
  'workbook.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js',
  'project-store.js','app-core.js','index.html','test-worker.js','.github/workflows/pages.yml'
].map(file=>[file,text(file)]));
assert(sources['project-store.js'].includes('closed-loop-project/2'),'The legacy /2 identity is not retained for migration.');
assert(sources['project-store.js'].includes('migrateClosedLoopProjectV2ToV3'),'The /2 → /3 migration is absent.');
assert(sources['project-store.js'].includes('originalImportedPayload'),'Migration does not retain the original imported payload as audit evidence.');
for(const authority of ['testExecutionPlan','evaluateContextIndependence','evaluateEvidenceSufficiency','detectCurrentContradictions','operationalNextAction'])assert(sources['workflow-engine.js'].includes(authority),'Missing engine authority '+authority+'.');
assert(sources['project-store.js'].includes('createExecutionPackage'),'Missing createExecutionPackage().');
assert(sources['prompt-engine.js'].includes('closed-loop-test-spec/1'),'Stage 06 prompt authority does not publish the Test IR version.');
assert(sources['response-ingestion.js'].includes('EXECUTABLE_SPEC'),'Ingestion does not validate executable specifications.');
assert(sources['workflow-engine.js'].includes('APPLICATION_DETERMINISTIC'),'Native routing is absent.');
assert(sources['workflow-engine.js'].includes('evidenceSufficiency')||sources['workflow-engine.js'].includes('evaluateEvidenceSufficiency'),'Evidence sufficiency is not gate-consumed.');
assert(sources['workflow-engine.js'].includes('contradiction'),'Contradiction detection is not gate-consumed.');
assert(sources['app-core.js'].includes('Run tests')||sources['app-core.js'].includes('RUN_APP_TESTS'),'Native operator action is absent.');
assert(sources['app-core.js'].includes('Canonical state changed'),'Canonical-change certainty is absent.');
assert(sources['app-core.js'].includes('currentValue'),'Proposal review lacks the current-value column.');
assert(sources['project-store.js'].includes('downloadArtifact')||sources['app-core.js'].includes('download-artifact'),'Individual artifact download is absent.');

const scripts=[...sources['index.html'].matchAll(/<script\s+defer\s+src="([^"?]+)/g)].map(match=>match[1]);
assert(JSON.stringify(scripts)===JSON.stringify(['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']),'Runtime script order is wrong: '+JSON.stringify(scripts));
assert(/worker-src\s+'self'/.test(sources['index.html']),'CSP does not permit only the same-origin worker.');
assert(!/unsafe-eval|unsafe-inline/.test(sources['index.html']),'CSP opens unsafe script evaluation.');
assert(sources['test-worker.js'].includes("['fetch','XMLHttpRequest','WebSocket','EventSource']"),'Worker network surfaces are not disabled.');
assert(sources['test-worker.js'].includes('executeNormalizedSpec'),'Worker does not execute only normalized Test IR.');
assert(!sources['test-runtime.js']?.includes?.('eval('),'Runtime contains eval.');
assert(!sources['test-runtime.js']?.includes?.('new Function'),'Runtime contains Function construction.');
assert(!sources['test-runtime.js']?.includes?.('import('),'Runtime contains dynamic import.');
const directExpected="['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']";
assert(sources['.github/workflows/pages.yml'].includes(directExpected),'CI does not enforce the nine-file runtime graph.');
assert(sources['.github/workflows/pages.yml'].includes('verify-v3-contract.mjs'),'CI does not execute the /3 proof.');

const report={
  workflow:'mobile-closed-loop/30',projectSchema:'closed-loop-project/3',responseSchema:'closed-loop-stage-response/3',
  testIrSchema:'closed-loop-test-spec/1',verificationPackageSchema:'closed-loop-verification-package/1',stageCount:30,
  stage01ControlledInputAccounting:1,stage04ObligationAccounting:1,mandatoryEvidenceSufficiencyCoverage:1,
  nativeExecutionCoverage:1,testIrSecurityCoverage:1,migrationCoverage:1,
  unsupportedTestIrTreatedAsExecutable:0,nativeExecutionReceiptsFabricatedExternally:0,releaseAcceptedWithContradiction:0,
  registeredPrimitiveCount:requiredOperations.length,resourceLimitBoundaryClassesProven:5
};
console.log(JSON.stringify(report));

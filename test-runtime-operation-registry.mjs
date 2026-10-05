// Finite operation-admission and unchanged-language controls. All data is
// disposable; current native/project history is neither read nor rewritten.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {deferredDefinitionRestorationFixture} from './test-fixtures.mjs';
const plain=value=>JSON.parse(JSON.stringify(value));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const operationNames=['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'];
const inheritedNames=['constructor','__defineGetter__','__defineSetter__','hasOwnProperty','__lookupGetter__','__lookupSetter__','isPrototypeOf','propertyIsEnumerable','toString','valueOf','__proto__','toLocaleString'];
const malformedValues=[null,false,0,[],['LOAD_ARTIFACT'],{},{toString:'LOAD_ARTIFACT'},{toString:null,valueOf:null}];
function load(source,{schema=false}={}){
 const context={console,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,URL,setTimeout,clearTimeout,Date,Math,Promise,Event,EventTarget};context.globalThis=context;context.dispatchEvent=()=>true;context.addEventListener=()=>{};context.removeEventListener=()=>{};createVerifierRuntime(context);
 if(schema)vm.runInContext(fs.readFileSync(new URL('./workbook.js',import.meta.url),'utf8'),context,{filename:'workbook.js'});
 vm.runInContext(fs.readFileSync(new URL('./hash.js',import.meta.url),'utf8'),context,{filename:'hash.js'});vm.runInContext(source,context,{filename:'test-runtime.js'});
 if(schema)vm.runInContext(fs.readFileSync(new URL('./workflow-schema.js',import.meta.url),'utf8'),context,{filename:'workflow-schema.js'});
 return context;
}
const previousGuards=[
 ["const definition=typeof step.op==='string'&&hasOwn(OP_DEFINITIONS,step.op)?OP_DEFINITIONS[step.op]:null;if(!definition)return [`Step ${index} uses unknown operation ${typeof step.op==='string'?step.op:'<non-string>'}.`];","const definition=OP_DEFINITIONS[step.op];if(!definition)return [`Step ${index} uses unknown operation ${String(step.op)}.`];"],
 ["const contract=typeof step.op==='string'&&hasOwn(PORT_CONTRACTS,step.op)?PORT_CONTRACTS[step.op]:null;if(!contract){issues.push(`Step ${index} uses unknown operation ${typeof step.op==='string'?step.op:'<non-string>'}.`);continue;}","const contract=PORT_CONTRACTS[step.op];if(!contract){issues.push(`Step ${index} uses unknown operation ${String(step.op)}.`);continue;}"],
 ["if(typeof step?.op==='string'&&!hasOwn(PORT_CONTRACTS,step.op))issues.push(`Legacy authoring operation ${step.op} cannot compile to the canonical closed operation registry.`);","if(step?.op&&!PORT_CONTRACTS[step.op])issues.push(`Legacy authoring operation ${step.op} cannot compile to the canonical closed operation registry.`);"]
,
 ["const diagnosticLabel=value=>typeof value==='string'?value:'<non-string>';\n",''],
 ["${diagnosticLabel(spec.version)}","${String(spec.version)}",2],
 ["${diagnosticLabel(spec.languageVersion)}","${String(spec.languageVersion)}"],
 ["${diagnosticLabel(spec.operationRegistryVersion)}","${String(spec.operationRegistryVersion)}"],
 ["if(Array.isArray(spec.steps)&&spec.steps.length>LIMITS.maxSteps)","if((spec.steps?.length||0)>LIMITS.maxSteps)",2],
 ["      if(!allowed.includes(name))continue;\n",''],
 ["else if(typeof spec.result.stepRef!=='string'||!prior.has(spec.result.stepRef))issues.push(`Test IR result references missing step ${diagnosticLabel(spec.result.stepRef)}.`);","else if(!prior.has(spec.result.stepRef))issues.push(`Test IR result references missing step ${String(spec.result.stepRef)}.`);"],
 ["if(typeof spec.result.output!=='string'||!hasOwn(contract.outputs,spec.result.output))issues.push(`Test IR result references unknown output ${diagnosticLabel(spec.result.output)}.`);","if(!hasOwn(contract.outputs,spec.result.output))issues.push(`Test IR result references unknown output ${String(spec.result.output)}.`);"]
,
 ["const mode=field(test,'EXECUTION_MODE');if(typeof mode!=='string'||mode.toUpperCase()!=='APPLICATION_DETERMINISTIC')return false;","if(String(field(test,'EXECUTION_MODE')||'').toUpperCase()!=='APPLICATION_DETERMINISTIC')return false;"],
 ["const capability=field(test,'REQUIRED_CAPABILITY');if(typeof capability!=='string'||capability.toUpperCase()!==CAPABILITY)return false;","if(String(field(test,'REQUIRED_CAPABILITY')||'').toUpperCase()!==CAPABILITY)return false;"],
 ["const kind=field(test,'EXECUTABLE_KIND');if(typeof kind!=='string'||kind.toUpperCase()!==EXECUTABLE_KIND)return false;","if(String(field(test,'EXECUTABLE_KIND')||'').toUpperCase()!==EXECUTABLE_KIND)return false;"]
];
async function verifyOperationIngestion(source,previousSource){
 const results=[];
 for(const [mode,implementationSource]of [['CURRENT',source],['PRE_FIX_EQUIVALENT',previousSource]]){
  const r=projectStoreRuntime({sourceOverrides:{'test-runtime.js':implementationSource}}),e=r.engine,h=r.runtime.closedLoopHash,restored=await deferredDefinitionRestorationFixture(r,{family:'failureTests'}),p=restored.p;
  for(let stage=1;stage<=5;stage++)assert.equal(e.gate(stage,p).complete,true,'OPERATION_INGESTION_ACTUAL_PREREQUISITE_ORACLE');
  const selected=e.acceptedChanges(p,6).find(row=>row.operation==='COMPLETE'),original=p.projectData.rawResponses.find(row=>row.rawResponseId===selected.rawResponseId).completeRawResponse;
  e.invalidateAcceptedResponse(p,{stage:6,rawResponseId:selected.rawResponseId,reason:'Synthetic malformed-operation regression author refinement',operatorLabel:'SYNTHETIC_OPERATOR'});p.activeStage=6;
  const prompt=r.prompts.reserveAndBuildPromptRecord(p,6,{operation:'COMPLETE'}).prompt,manifest=r.prompts.promptFileManifest(prompt),envelope=JSON.parse(original);
  Object.assign(envelope,{promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:manifest.scope});
  const index=envelope.records.tests.findIndex(row=>row.tempKey==='compat-native-failureTests');assert(index>=0);assert.equal(envelope.records.tests[index].fields.EXECUTABLE_SPEC.steps[0].op,'COMPARE');
  const validate=value=>r.ingestion.validateEnvelope(p,r.copy(value),{stage:6,promptRecord:prompt,rawSha256:h.rawResponseSha256(JSON.stringify(value))}),before=h.sha256Value(p),rawBefore=p.projectData.rawResponses.map(row=>[row.rawResponseId,row.completeRawResponse]);
  assert.deepEqual(plain(validate(envelope).issues),[],'OPERATION_INGESTION_CONFORMING_CONTROL_ORACLE');assert.equal(validate(envelope).valid,true);
  const invalidLabel={toString:null,valueOf:null},variants=[
   ...[['inherited-constructor','constructor'],['inherited-toString','toString'],['coerced-registered-COMPARE',['COMPARE']]].map(([caseId,op])=>({caseId,change:spec=>spec.steps[0].op=op,expectedIssue:`Step 0 uses unknown operation ${typeof op==='string'?op:'<non-string>'}.`,preFixException:typeof op==='string'})),
   {caseId:'malformed-version-label',change:spec=>spec.version=invalidLabel,expectedIssue:'Unsupported Test IR version <non-string>.',preFixException:true},
   {caseId:'malformed-steps-length',change:spec=>spec.steps={length:invalidLabel},expectedIssue:'Test IR requires a nonempty steps array.',preFixException:true},
   {caseId:'malformed-result-output-label',change:spec=>spec.result.output=invalidLabel,expectedIssue:'Test IR result references unknown output <non-string>.',preFixException:true},
   {caseId:'coerced-result-output',change:spec=>spec.result.output=['assertion'],expectedIssue:'Test IR result references unknown output <non-string>.',preFixException:false}
  ];
  for(const {caseId,change,expectedIssue,preFixException}of variants){
   const candidate=structuredClone(envelope);change(candidate.records.tests[index].fields.EXECUTABLE_SPEC);
   if(mode==='CURRENT'){
    let checked;assert.doesNotThrow(()=>{checked=validate(candidate);},'OPERATION_INGESTION_DIAGNOSTIC_ORACLE');assert.equal(checked.valid,false);assert(checked.issues.some(row=>row.code==='INVALID_TEST_IR'&&row.path===`/records/tests/${index}/fields/EXECUTABLE_SPEC`&&row.message===expectedIssue),'OPERATION_INGESTION_REJECTION_ORACLE: '+JSON.stringify(checked.issues));
    results.push({mode,caseId,result:'REJECTED_INVALID',expectedCode:'INVALID_TEST_IR',path:`/records/tests/${index}/fields/EXECUTABLE_SPEC`});
   }else if(preFixException){assert.throws(()=>validate(candidate),error=>/requiredInputs is not iterable|Cannot convert object to primitive value/.test(error.message),'OPERATION_INGESTION_PRE_FIX_EXCEPTION_ORACLE');results.push({mode,caseId,result:'HELPER_EXCEPTION_REPRODUCED'});}
   else{assert.equal(validate(candidate).valid,true,'OPERATION_INGESTION_PRE_FIX_COERCION_ORACLE');results.push({mode,caseId,result:'FALSE_SYNTAX_ADMISSION_REPRODUCED',executionNotEstablishedByThisIngestionControl:true});}
   assert.equal(h.sha256Value(p),before,'OPERATION_INGESTION_CANONICAL_PRESERVATION_ORACLE');assert.deepEqual(p.projectData.rawResponses.map(row=>[row.rawResponseId,row.completeRawResponse]),rawBefore);assert.equal(validate(envelope).valid,true,'OPERATION_INGESTION_RESTORE_ORACLE');
  }
 }
 return {boundary:'Actual response-ingestion validateEnvelope on normal Stage6 author refinement with restored genuinely accepted prerequisite gates1–5; no response commit, physical browser or release claim',results,originalRawHistoryPreserved:true,canonicalStatePreserved:true,conformingEnvelopeStillValid:true};
}
export async function verifyOperationRegistryAdmission(source,runtime){
 const schema=load(source,{schema:true}).closedLoopWorkflowSchema;
 const bindings={VALUE:{kind:'CANONICAL_VALUE',canonicalKey:'VALUE'}},legacy={version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:true}]},dag=runtime.normalizeSpec(legacy);
 const asTest=spec=>({TEST_ID:'TEST-OPERATION-ADMISSION',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_SPEC:spec,EXECUTABLE_INPUT_BINDINGS:bindings});
 for(const control of [legacy,dag])for(const implementation of [runtime])assert.deepEqual(plain(implementation.validateSpec(control,bindings)),{valid:true,issues:[]},'OPERATION_REGISTRY_CONFORMING_CONTROL_ORACLE');
 let workerLaunches=0;class MustNotLaunch{constructor(){workerLaunches++;throw Error('Malformed operation reached worker creation');}}
 const negatives=[],prefixedExceptions=[];
 for(const [form,control]of [['legacy',legacy],['dag',dag]])for(const [index,op]of [...inheritedNames,...malformedValues].entries()){
  const candidate=structuredClone(control);candidate.steps[0].op=op;const before=JSON.stringify(candidate),expectedIssue=`Step 0 uses unknown operation ${typeof op==='string'?op:'<non-string>'}.`;
  let checked;assert.doesNotThrow(()=>{checked=runtime.validateSpec(candidate,bindings);},'OPERATION_REGISTRY_DIAGNOSTIC_ORACLE: '+form+'-'+index);assert.equal(checked.valid,false);assert(checked.issues.includes(expectedIssue),'OPERATION_REGISTRY_REJECTION_ORACLE: '+form+'-'+index+' '+JSON.stringify(checked.issues));
  assert.equal(schema.validateTestIRSpec(candidate).valid,false,'OPERATION_REGISTRY_SCHEMA_ORACLE');assert.equal(runtime.supports(asTest(candidate)),false,'OPERATION_REGISTRY_CAPABILITY_ORACLE');
  assert.throws(()=>runtime.normalizeSpec(candidate),error=>error.code==='INVALID_TEST_IR'&&error.message.includes(expectedIssue),'OPERATION_REGISTRY_NORMALIZATION_ORACLE');
  const failed=await runtime.executeTest(asTest(candidate),{},{} ,{Worker:MustNotLaunch});assert.equal(failed.status,'EXECUTION_FAILED');assert.equal(failed.failure.code,'INVALID_TEST_IR');assert.equal(failed.observations.length,0);assert.equal(JSON.stringify(candidate),before,'OPERATION_REGISTRY_INPUT_PRESERVATION_ORACLE');
  if(index<12||index>=18)prefixedExceptions.push(form+'-'+index);
  assert.equal(runtime.validateSpec(control,bindings).valid,true,'OPERATION_REGISTRY_RESTORE_ORACLE');negatives.push({caseId:form+'-'+index,form,operation:op,expectedIssue,result:'REJECTED_INVALID',workerStarted:false});
 }
 // A non-string key that coerced to a real operation previously looked
 // executable to both validation and capability planning, but execution rejected.
 const countControl=runtime.normalizeSpec({version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'COUNT'},{op:'ASSERT_EQ',value:1}]}),coerced=structuredClone(countControl);coerced.steps[1].op=['COUNT'];
 assert.equal(runtime.validateSpec(coerced,bindings).valid,false);assert(runtime.validateSpec(coerced,bindings).issues.includes('Step 1 uses unknown operation <non-string>.'));assert.equal(schema.validateTestIRSpec(coerced).valid,false);assert.equal(runtime.supports(asTest(coerced)),false);
 const failedCoercion=await runtime.executeTest(asTest(coerced),{},{},{Worker:MustNotLaunch});assert.equal(failedCoercion.failure.code,'INVALID_TEST_IR');assert.equal(failedCoercion.observations.length,0);assert.equal(workerLaunches,0);
 negatives.push({caseId:'dag-array-count',form:'dag',operation:['COUNT'],expectedIssue:'Step 1 uses unknown operation <non-string>.',result:'REJECTED_INVALID',workerStarted:false});
 const labelCases=[],badLabel={toString:null,valueOf:null};
 const addLabel=(caseId,control,change,expectedIssue,preFixException=false)=>{const candidate=structuredClone(control);change(candidate);labelCases.push({caseId,candidate,expectedIssue,preFixException});};
 for(const [form,control,key,prefix]of [['legacy',legacy,'version','Unsupported Test IR version'],['dag',dag,'version','Unsupported Test IR version'],['dag',dag,'languageVersion','Unsupported Test IR language version'],['dag',dag,'operationRegistryVersion','Unsupported operation registry version']])for(const [index,value]of malformedValues.entries())addLabel(form+'-'+key+'-'+index,control,spec=>spec[key]=value,prefix+' <non-string>.',index>=6);
 for(const [form,control]of [['legacy',legacy],['dag',dag]])for(const [index,length]of [badLabel,[badLabel]].entries())addLabel(form+'-nested-steps-length-'+index,control,spec=>spec.steps={length},'Test IR requires a nonempty steps array.',true);
 for(const key of ['stepRef','output'])for(const [index,value]of malformedValues.entries())addLabel('result-'+key+'-'+index,dag,spec=>spec.result[key]=value,`Test IR result references ${key==='stepRef'?'missing step':'unknown output'} <non-string>.`,index>=6);
 addLabel('result-array-assertion',dag,spec=>spec.result.output=['assertion'],'Test IR result references unknown output <non-string>.');
 const byteControl=runtime.normalizeSpec({version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'ASSERT_EQ',value:'ab'}]});
 for(const name of inheritedNames)addLabel('inherited-input-port-'+name,byteControl,spec=>spec.steps[1].inputs={...spec.steps[1].inputs,[name]:{literal:true}},`Step 1 operation READ_BYTES contains unknown input port ${name}.`,true);
 for(const row of labelCases){let checked;assert.doesNotThrow(()=>{checked=runtime.validateSpec(row.candidate,bindings);},'TEST_IR_LABEL_DIAGNOSTIC_ORACLE: '+row.caseId);assert.equal(checked.valid,false);assert(checked.issues.includes(row.expectedIssue),'TEST_IR_LABEL_REJECTION_ORACLE: '+row.caseId+' '+JSON.stringify(checked.issues));assert.equal(schema.validateTestIRSpec(row.candidate).valid,false);assert.equal(runtime.supports(asTest(row.candidate)),false);assert.throws(()=>runtime.normalizeSpec(row.candidate),error=>error.code==='INVALID_TEST_IR');const failure=await runtime.executeTest(asTest(row.candidate),{},{},{Worker:MustNotLaunch});assert.equal(failure.failure.code,'INVALID_TEST_IR');assert.equal(failure.observations.length,0);}
 assert.equal(workerLaunches,0);
 const capabilityCases=[];
 for(const field of ['EXECUTION_MODE','REQUIRED_CAPABILITY','EXECUTABLE_KIND'])for(const [index,value]of [...malformedValues,[asTest(legacy)[field]]].entries()){
  const candidate={...asTest(legacy),[field]:value};let supported;assert.doesNotThrow(()=>{supported=runtime.supports(candidate);},'TEST_IR_CAPABILITY_IDENTITY_DIAGNOSTIC_ORACLE: '+field+'-'+index);assert.equal(supported,false,'TEST_IR_CAPABILITY_IDENTITY_REJECTION_ORACLE: '+field+'-'+index);capabilityCases.push({caseId:field+'-'+index,field,value,preFixException:index===6||index===7,preFixAdmission:index===8,supported:false});
 }
 for(const field of ['EXECUTION_MODE','REQUIRED_CAPABILITY','EXECUTABLE_KIND'])assert.equal(runtime.supports({...asTest(legacy),[field]:asTest(legacy)[field].toLowerCase()}),true,'TEST_IR_EXISTING_STRING_CASE_ORACLE');
 // Recreate exactly the prior admission guards only after the current
 // diagnostic oracle has run, so guard removal fails for behavior, not an anchor.
 let previousSource=source;for(const [current,previous,count=1]of previousGuards){assert.equal(previousSource.split(current).length,count+1,'OPERATION_REGISTRY_FAULT_ANCHOR_ORACLE');previousSource=previousSource.replaceAll(current,previous);}
 const previous=load(previousSource).closedLoopTestRuntime;
 for(const row of capabilityCases){const candidate={...asTest(legacy),[row.field]:row.value};if(row.preFixException)assert.throws(()=>previous.supports(candidate),error=>/Cannot convert object to primitive value/.test(error.message),'TEST_IR_CAPABILITY_IDENTITY_PRE_FIX_ORACLE');else if(row.preFixAdmission)assert.equal(previous.supports(candidate),true,'TEST_IR_CAPABILITY_IDENTITY_PRE_FIX_ADMISSION_ORACLE');}

 for(const control of [legacy,dag])assert.deepEqual(plain(previous.validateSpec(control,bindings)),{valid:true,issues:[]});
 for(const row of negatives.filter(row=>prefixedExceptions.includes(row.caseId))){const candidate=structuredClone(row.form==='legacy'?legacy:dag);candidate.steps[0].op=row.operation;assert.throws(()=>previous.validateSpec(candidate,bindings),error=>/not iterable|Cannot convert object to primitive value/.test(error.message),'OPERATION_REGISTRY_PRE_FIX_EXCEPTION_ORACLE');}
 assert.equal(previous.validateSpec(coerced,bindings).valid,true);assert.equal(previous.supports(asTest(coerced)),true);
 await assert.rejects(()=>previous.execute({spec:coerced,canonicalBindings:{VALUE:{value:['x']}},metadata:{bindings}}),error=>error.code==='UNKNOWN_OPERATION','OPERATION_REGISTRY_PRE_FIX_EXECUTION_ORACLE');
 for(const row of labelCases.filter(row=>row.preFixException))assert.throws(()=>previous.validateSpec(row.candidate,bindings),error=>/Cannot convert object to primitive value|some is not a function/.test(error.message),'TEST_IR_LABEL_PRE_FIX_EXCEPTION_ORACLE: '+row.caseId);
 const coercedResult=labelCases.find(row=>row.caseId==='result-array-assertion').candidate;assert.equal(previous.validateSpec(coercedResult,bindings).valid,true);const malformedResult=await previous.execute({spec:coercedResult,canonicalBindings:{VALUE:{value:true}},metadata:{bindings}});assert.equal(malformedResult.determination,'SATISFIED','TEST_IR_RESULT_PRE_FIX_EXECUTION_ORACLE');


 // Independent literal assertions cover every registered primitive; both the
 // corrected runtime and the exact earlier guard equivalent must satisfy them.
 const steps=[],literal=value=>({literal:value});
 const add=(op,inputs,output)=>{const stepId='S'+String(steps.length+1).padStart(3,'0');steps.push({stepId,op,inputs});return {stepRef:stepId,output};};
 const eq=(actual,expected)=>add('ASSERT_EQ',{actual,expected:literal(expected)},'assertion');
 const artifact=add('LOAD_ARTIFACT',{binding:{bindingRef:'PRODUCT'}},'artifact'),bytes=add('READ_BYTES',{artifact},'bytes'),text=add('DECODE_UTF8',{bytes},'text');eq(text,'ab');
 const json=add('PARSE_JSON',{text:literal('{"items":[2,3]}')},'value'),selection=add('SELECT_JSON_PATH',{value:json,path:literal('$.items')},'selection');eq(add('COUNT',{value:selection},'count'),2);
 eq(add('SUM',{value:literal([2,3])},'value'),5);eq(add('MIN',{value:literal([2,3])},'value'),2);eq(add('MAX',{value:literal([2,3])},'value'),3);eq(add('SORT',{value:literal(['b','a']),direction:literal('ASC'),domain:literal('STRING')},'value'),['a','b']);eq(add('UNIQUE',{value:literal(['b','a','b'])},'value'),['b','a']);
 const csv=add('PARSE_CSV',{text:literal('a,b\nc,d'),delimiter:literal(','),header:literal(false),quote:literal('"'),newline:literal('LF'),encoding:literal('UTF-8')},'value');eq(csv,[['a','b'],['c','d']]);
 const xml=add('PARSE_XML',{text:literal('<root><item>x</item><item>y</item></root>')},'value'),xmlSelection=add('SELECT_XML',{value:xml,path:literal('/root/item')},'selection');eq(add('COUNT',{value:xmlSelection},'count'),2);
 eq(add('HASH_SHA256',{bytes},'sha256'),digest('ab'));eq(add('REGEX',{value:literal('ab'),pattern:literal('^a')},'match'),true);eq(add('COMPARE',{left:literal(2),right:literal(3),operator:literal('LT')},'comparison'),true);eq(add('BYTE_COMPARE',{left:bytes,right:bytes},'comparison'),true);
 for(const [op,actual,expected]of [['ASSERT_GT',3,2],['ASSERT_GTE',2,2],['ASSERT_LT',2,3],['ASSERT_LTE',2,2],['ASSERT_CONTAINS','ab','a'],['ASSERT_NOT_CONTAINS','ab','z'],['ASSERT_SET_EQUAL',['a','b'],['b','a']]])add(op,{actual:literal(actual),expected:literal(expected)},'assertion');
 const result=add('ASSERT_MATCH',{actual:literal('ab'),pattern:literal('^ab$')},'assertion');
 const specification={version:runtime.SPEC_VERSION,languageVersion:runtime.TEST_IR_LANGUAGE_VERSION,operationRegistryVersion:runtime.OPERATION_REGISTRY_VERSION,operationRegistrySha256:runtime.OPERATION_REGISTRY_SHA256,steps,result};
 assert.deepEqual([...new Set(steps.map(step=>step.op))].sort(),operationNames.slice().sort(),'OPERATION_REGISTRY_FINITE_POPULATION_ORACLE');assert.deepEqual(plain(runtime.OPS).slice().sort(),operationNames.slice().sort());
 const artifacts={PRODUCT:{artifactId:'ART-OPERATIONS',filename:'input.txt',bytes:new TextEncoder().encode('ab')}},metadata={testId:'TEST-ALL-REGISTERED-OPERATIONS',bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-OPERATIONS'}}};
 const execution=[];for(const implementation of [previous,runtime]){assert.deepEqual(plain(implementation.validateSpec(specification,metadata.bindings)),{valid:true,issues:[]});execution.push(await implementation.execute({spec:specification,artifacts,metadata}));assert.equal(execution.at(-1).determination,'SATISFIED','OPERATION_REGISTRY_ALL_OPERATIONS_EXPECTED_ORACLE');}
 assert.deepEqual(plain(execution[1]),plain(execution[0]),'OPERATION_REGISTRY_UNCHANGED_EXECUTION_ORACLE');assert.deepEqual(plain(runtime.normalizeSpec(specification)),plain(previous.normalizeSpec(specification)));assert.deepEqual(plain(runtime.operationContracts()),plain(previous.operationContracts()));
 for(const key of ['SPEC_VERSION','TEST_IR_LANGUAGE_VERSION','OPERATION_REGISTRY_VERSION','OPERATION_REGISTRY_SHA256','JSON_SELECTOR_REGISTRY_VERSION','JSON_SELECTOR_REGISTRY_SHA256','XML_SELECTOR_REGISTRY_VERSION','XML_SELECTOR_REGISTRY_SHA256','REGEX_REGISTRY_VERSION','REGEX_REGISTRY_SHA256'])assert.equal(runtime[key],previous[key],'OPERATION_REGISTRY_IDENTITY_PRESERVATION_ORACLE: '+key);
 const errorControls=[['MALFORMED_JSON',{op:'PARSE_JSON',inputs:{text:literal('{')}}],['MALFORMED_XML',{op:'PARSE_XML',inputs:{text:literal('<root>')}}]];
 for(const [code,step]of errorControls){const errorSpec={...specification,steps:[{...step,stepId:'S001'},{stepId:'S002',op:'ASSERT_EQ',inputs:{actual:literal(true),expected:literal(true)}}],result:{stepRef:'S002',output:'assertion'}};for(const implementation of [previous,runtime])await assert.rejects(()=>implementation.execute({spec:errorSpec,metadata:{bindings:{}}}),error=>error.code===code,'OPERATION_REGISTRY_REGISTERED_ERROR_ORACLE: '+code);}
 const ingestion=await verifyOperationIngestion(source,previousSource);
 assert.equal(fs.readFileSync(new URL('./test-runtime.js',import.meta.url),'utf8'),source,'OPERATION_REGISTRY_SOURCE_PRESERVATION_ORACLE');
 return {schema:'closed-loop-runtime-operation-admission-controls/1',ingestion,boundary:'Actual runtime validation, schema adapter, normalization, capability, pre-worker refusal and execution; no project response commit or release claim',pinnedBeforeRepairSourceSha256:'eb535ccb07485ae4919b941e1a522ca7db985eced07ef93968debe4a5befc146',preFixEquivalentSourceSha256:digest(previousSource),currentRuntimeSourceSha256:digest(source),negativeCases:negatives,capabilityCases,labelCases:labelCases.map(({candidate,...row})=>({...row,result:'REJECTED_INVALID'})),preFixLabelExceptionCount:labelCases.filter(row=>row.preFixException).length,preFixMalformedResultCompletedExecution:1,preFixExceptionCases:prefixedExceptions,preFixCoercedCapabilityAdmissions:1,preFixCoercedOperationCompletedExecutions:0,registeredOperationIds:operationNames,registeredOperationExecutionCount:operationNames.length,executionTraceUnchanged:true,normalizedSpecUnchanged:true,registryIdentityUnchanged:true,registeredErrorCodesUnchanged:errorControls.map(row=>row[0]),workerLaunches,result:'PASS'};
}

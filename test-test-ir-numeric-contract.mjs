import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const literal=value=>({literal:value});
const plain=value=>JSON.parse(JSON.stringify(value));
const decimal=value=>({numberType:'DECIMAL',value});

// Complete public API controls at the shared numeric owners. Fixture outcomes
// are reviewed literal expectations, never answers from an alternate evaluator.
export async function verifyTestIrNumericContract(runtime,hashValue){
 const bytes=fs.readFileSync(new URL('./verification/test-ir-numeric-contract-cases.json',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'fe706bc12f8458d4272092a97ad66baa4172716243f5f175443655cd5da9ca94','Numeric fixture identity');
 const fixture=JSON.parse(bytes);assert.equal(fixture.population,173);assert.equal(fixture.cases.length,173);
 const current='aea1efab8e1c342d550653238ef2740bd625c2ec5bbadb0dbaf76fcd1034492d',prior='21b4c97a596fecd7ec5dca7788ded488827ef71c0aee3a041f89bd19d0eede00';
 assert.equal(runtime.OPERATION_REGISTRY_SHA256,current,'Independent current numeric registry identity');
 const base={version:runtime.SPEC_VERSION,languageVersion:runtime.TEST_IR_LANGUAGE_VERSION,operationRegistryVersion:runtime.OPERATION_REGISTRY_VERSION,operationRegistrySha256:current};
 const execute=spec=>runtime.execute({spec,metadata:{bindings:{}}}),cases=[];
 const make=row=>{
  const options=Object.fromEntries(Object.entries(row.settings||{}).map(([key,value])=>[key,literal(value)]));
  let steps;
  if(row.operation==='SORT')steps=[
   {stepId:'S001',op:'SORT',inputs:{value:literal(row.actual),...options}},
   {stepId:'S002',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S001',output:'value'},expected:literal(row.expected)}}
  ];
  else if(row.operation.startsWith('COMPARE_'))steps=[
   {stepId:'S001',op:'COMPARE',inputs:{left:literal(row.actual),right:literal(row.expected),operator:literal(row.operation.slice('COMPARE_'.length)),...options}},
   {stepId:'S002',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S001',output:'comparison'},expected:literal(true)}}
  ];
  else steps=[{stepId:'S001',op:row.operation,inputs:{actual:literal(row.actual),expected:literal(row.expected),...options}}];
  return {...base,steps,result:{stepRef:steps.at(-1).stepId,output:'assertion'}};
 };
 const check=async row=>{
  const spec=make(row),before=JSON.stringify(spec);let validation;
  assert.doesNotThrow(()=>{validation=runtime.validateSpec(spec,{});},row.id+' validation must return issues');
  assert.equal(validation.valid,row.normative.validationValid,row.id+' admission: '+JSON.stringify(validation.issues));
  if(row.normative.validationValid)assert.deepEqual(plain(validation.issues),[],row.id+' valid definition issues');
  if(row.validationIssues)assert.deepEqual(plain(validation.issues),row.validationIssues,row.id+' original validation cause');
  if(row.requiredValidationIssue)assert.ok(validation.issues.includes(row.requiredValidationIssue),row.id+' exact invalid tolerance cause');
  if(row.normative.error){
   let caught;try{await execute(spec);}catch(error){caught=error;}
   assert.ok(caught,row.id+' invalid value produced a result');
   assert.equal(caught.name,'ClosedLoopTestRuntimeError',row.id+' typed error');
   assert.equal(caught.code,row.normative.error.code,row.id+' refusal code');
   assert.equal(caught.disposition,row.normative.error.disposition,row.id+' refusal disposition');
   if(row.regressionErrorMessage)assert.equal(caught.message,row.regressionErrorMessage,row.id+' original/declared refusal cause');
   if(row.requiredValidationIssue)assert.ok(caught.message.includes(row.requiredValidationIssue),row.id+' execution refusal cause');
   cases.push({caseId:row.id,group:row.group,code:caught.code,disposition:caught.disposition});
  }else{
   const result=await execute(spec);
   assert.deepEqual({determination:result.determination,actual:plain(result.actual)},row.normative.result,row.id+' exact result');
   assert.equal(result.operationRegistrySha256,current,row.id+' actual current identity');
   cases.push({caseId:row.id,group:row.group,determination:result.determination,actual:plain(result.actual)});
  }
  assert.equal(JSON.stringify(spec),before,row.id+' original operands and definition unchanged');
 };
 for(const row of fixture.cases)await check(row);

 // Invalid unequal operands must fail before NE can turn false equality into a
 // true comparison; these are additional post-repair controls, not baseline rows.
 for(const [name,actual]of [['number',1],['singleton-array',['1']]])await check({id:'unequal-invalid-ne-'+name,group:'additional-ne-control',operation:'COMPARE_NE',actual,expected:'2',settings:{numericMode:'DECIMAL_STRING'},normative:{validationValid:true,error:{code:'UNSUPPORTED_NUMERIC_PRECISION',disposition:'UNDETERMINED'}}});
 for(const operation of ['COMPARE_EQ','COMPARE_NE','ASSERT_EQ'])await check({id:'decimal-string-signed-zero-'+operation,group:'additional-decimal-control',operation,actual:'-0.000',expected:'+000',settings:{numericMode:'DECIMAL_STRING'},normative:{validationValid:true,result:{determination:operation==='COMPARE_NE'?'VIOLATED':'SATISFIED',actual:operation==='ASSERT_EQ'?'-0.000':operation==='COMPARE_EQ'}}});
 for(const [operation,truth]of [['COMPARE_EQ',false],['COMPARE_NE',true],['ASSERT_EQ',false],['COMPARE_GT',true],['COMPARE_GTE',true],['COMPARE_LT',false],['COMPARE_LTE',false]])await check({id:'decimal-string-high-precision-'+operation,group:'additional-decimal-control',operation,actual:'9007199254740993',expected:'9007199254740992',settings:{numericMode:'DECIMAL_STRING'},normative:{validationValid:true,result:{determination:truth?'SATISFIED':'VIOLATED',actual:operation==='ASSERT_EQ'?'9007199254740993':truth}}});

 const fields=spec=>({TEST_ID:'SYNTHETIC-NUMERIC-CONTRACT-IDENTITY',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:base.version,EXECUTABLE_SPEC:spec,EXECUTABLE_SPEC_SHA256:hashValue(spec),EXECUTABLE_INPUT_BINDINGS:{}});
 let workerLaunches=0;class MustNotLaunch{constructor(){workerLaunches++;throw Error('stale numeric definition launched worker');}}
 const stale=async(id,row)=>{
  const spec={...make(row),operationRegistrySha256:prior},validation=runtime.validateSpec(spec,{}, {allowPriorRegistry:true});
  assert.equal(validation.valid,false,id+' retained changed semantics admitted');
  assert.ok(validation.issues.includes('Operation registry digest does not match the current registered semantics.'),id+' actual registry fence');
  await assert.rejects(()=>execute(spec),error=>error.code==='INVALID_TEST_IR',id+' direct execution fence');
  const test={fields:fields(spec)};assert.equal(runtime.supports(test),false,id+' retained capability');
  const result=await runtime.executeTest(test,{}, {},{Worker:MustNotLaunch});assert.equal(result.failure.code,'INVALID_TEST_IR',id);assert.equal(result.determination,'UNDETERMINED');assert.deepEqual(plain(result.observations),[]);
  cases.push({caseId:id,group:'prior-numeric-identity',code:result.failure.code,workerStarted:false});
 };
 for(const operation of ['COMPARE_EQ','COMPARE_NE','ASSERT_EQ'])await stale('prior-decimal-mode-'+operation,{operation,actual:'1',expected:'1.0',settings:{numericMode:'DECIMAL_STRING'}});
 for(const operation of ['COMPARE_GT','COMPARE_GTE','COMPARE_LT','COMPARE_LTE','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE'])await stale('prior-ordered-'+operation,{operation,actual:2,expected:1});
 for(const [name,settings]of [['explicit',{domain:'DECIMAL'}],['inferred',{}]])await stale('prior-sort-decimal-'+name,{operation:'SORT',actual:[decimal('2'),decimal('1')],expected:[decimal('1'),decimal('2')],settings});
 for(const [domain,actual,expected]of [['STRING',['z','a'],['a','z']],['BOOLEAN',[true,false],[false,true]],['INTEGER',[2,-1],[-1,2]]]){
  const spec={...make({operation:'SORT',actual,expected,settings:{domain}}),operationRegistrySha256:prior},test={fields:fields(spec)};
  assert.equal(runtime.supports(test),true,'Unaffected prior '+domain+' sort support');
  const result=await execute(spec);assert.equal(result.determination,'SATISFIED');assert.deepEqual(plain(result.actual),expected);assert.equal(result.operationRegistrySha256,prior,'Unaffected prior sort must not be relabeled');
  cases.push({caseId:'prior-sort-unaffected-'+domain,group:'prior-numeric-identity',determination:'SATISFIED',operationRegistrySha256:prior,actual:plain(result.actual)});
 }
 for(const [name,steps]of [
  ['decimal-equality',[{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:'1',numericMode:'DECIMAL_STRING'}]],
  ['decimal-sort',[{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'SORT',domain:'DECIMAL'},{op:'ASSERT_EQ',value:[decimal('1')]}]]
 ]){
  const legacy={version:base.version,steps},oldDag={...runtime.normalizeSpec(legacy),operationRegistrySha256:prior};
  const test={fields:{...fields(oldDag),EXECUTABLE_SPEC:legacy,EXECUTABLE_INPUT_BINDINGS:{VALUE:{kind:'CANONICAL_VALUE',canonicalKey:'VALUE'}}}};
  assert.equal(runtime.supports(test),false,'Prior legacy '+name+' stale');
  const result=await runtime.executeTest(test,{}, {},{Worker:MustNotLaunch});assert.equal(result.failure.code,'STALE_EXECUTABLE_SPEC_IDENTITY');assert.equal(result.determination,'UNDETERMINED');assert.deepEqual(plain(result.observations),[]);
  cases.push({caseId:'prior-legacy-'+name,group:'prior-numeric-identity',code:result.failure.code,workerStarted:false});
 }
 assert.equal(workerLaunches,0);
 const compatibility=plain(runtime.authoringContract().priorRegistryCompatibility);
 assert.deepEqual(compatibility.excludedOperations,['SELECT_JSON_PATH','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','PARSE_JSON','SELECT_XML','REGEX','ASSERT_MATCH']);
 assert.deepEqual(compatibility.excludedNumericModes,{COMPARE:['APPROXIMATE','DECIMAL_STRING'],ASSERT_EQ:['APPROXIMATE','DECIMAL_STRING']});
 assert.deepEqual(compatibility.excludedCompareOperators,['GT','GTE','LT','LTE']);assert.deepEqual(compatibility.excludedSortDomains,['DECIMAL']);assert.equal(compatibility.excludedInferredSortDomain,true);
 assert.equal(cases.length,203,'173 retained normative cases,12 additional semantic controls,18 identity controls');assert.equal(new Set(cases.map(row=>row.caseId)).size,203);
 return {passed:true,cases,workerLaunches,currentRegistrySha256:current,fixtureSha256:'fe706bc12f8458d4272092a97ad66baa4172716243f5f175443655cd5da9ca94',synthetic:true,actualBrowser:false,boundary:'203 finite complete public-API controls across shared decimal comparison/normalization/SORT owners and retained-identity gates; no whole arbitrary-input, native-worker, browser, project lifecycle or final-owner acceptance claim.'};
}

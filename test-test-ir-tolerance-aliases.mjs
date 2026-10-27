import assert from 'node:assert/strict';

const literal=value=>({literal:value});
const decimal=value=>({numberType:'DECIMAL',value});
const plain=value=>JSON.parse(JSON.stringify(value));

// Finite controls for §§21.10/D2. All determinations come from the complete
// public production runtime; no copied evaluator or binary-float oracle.
export async function verifyTestIrToleranceAliases(runtime,hashValue){
 const base={version:runtime.SPEC_VERSION,languageVersion:runtime.TEST_IR_LANGUAGE_VERSION,operationRegistryVersion:runtime.OPERATION_REGISTRY_VERSION,operationRegistrySha256:runtime.OPERATION_REGISTRY_SHA256};
 const cases=[],execute=spec=>runtime.execute({spec,metadata:{bindings:{}}});
 const definition=(kind,actual,expected,settings,comparison=true)=>{
  const options=Object.fromEntries(Object.entries(settings).map(([key,value])=>[key,literal(value)]));
  const steps=kind==='ASSERT_EQ'?[{stepId:'S001',op:'ASSERT_EQ',inputs:{actual:literal(actual),expected:literal(expected),...options}}]:[
   {stepId:'S001',op:'COMPARE',inputs:{left:literal(actual),right:literal(expected),operator:literal(kind.slice('COMPARE_'.length)),...options}},
   {stepId:'S002',op:'ASSERT_EQ',inputs:{actual:{stepRef:'S001',output:'comparison'},expected:literal(comparison)}}
  ];
  return {...base,steps,result:{stepRef:steps.at(-1).stepId,output:'assertion'}};
 };
 const accepted=async(caseId,spec,expectedActual,determination='SATISFIED')=>{
  const before=JSON.stringify(spec),checked=runtime.validateSpec(spec,{});
  assert.equal(checked.valid,true,caseId+': '+JSON.stringify(checked.issues));
  const result=await execute(spec);
  assert.equal(result.determination,determination,caseId);
  assert.deepEqual(plain(result.actual),plain(expectedActual),caseId+' exact actual');
  assert.equal(result.operationRegistrySha256,base.operationRegistrySha256,caseId+' current identity');
  assert.equal(JSON.stringify(spec),before,caseId+' original input unchanged');
  cases.push({caseId,determination:result.determination,actual:plain(result.actual),sourceUnchanged:true});
 };
 const rejected=async(caseId,spec,requiredIssue)=>{
  let checked;assert.doesNotThrow(()=>{checked=runtime.validateSpec(spec,{});},caseId+' must return validation issues');
  assert.equal(checked.valid,false,caseId+' unexpectedly admitted');
  assert.ok(checked.issues.includes(requiredIssue),caseId+' wrong rejection: '+JSON.stringify(checked.issues));
  await assert.rejects(()=>execute(spec),error=>error.code==='INVALID_TEST_IR'&&error.message.includes(requiredIssue),caseId+' execute must reject definition');
  cases.push({caseId,code:'INVALID_TEST_IR',issue:requiredIssue});
 };

 // Preserve the exact original six independent tolerance vectors.
 for(const [caseId,actual,expected,settings,determination]of [
  ['relative-tolerance-inside','110','100',{relTol:'0.1'},'SATISFIED'],
  ['relative-tolerance-outside','112','100',{relTol:'0.1'},'VIOLATED'],
  ['combined-relative-dominates','110','100',{absTol:'1',relTol:'0.1'},'SATISFIED'],
  ['combined-not-summed','112','100',{absTol:'1',relTol:'0.1'},'VIOLATED'],
  ['combined-absolute-boundary','120','100',{absTol:'20',relTol:'0.01'},'SATISFIED'],
  ['combined-absolute-outside','121','100',{absTol:'20',relTol:'0.01'},'VIOLATED']
 ])await accepted(caseId,definition('ASSERT_EQ',actual,expected,{numericMode:'APPROXIMATE',...settings}),actual,determination);

 // Exact seventeen source-confirmed forbidden configurations from the
 // independent public-API baseline; now reject at definition admission.
 const aliases=['absTol','relTol','absoluteTolerance','relativeTolerance'];
 for(const [ki,kind]of ['COMPARE_EQ','COMPARE_NE','ASSERT_EQ'].entries())for(const [mi,mode]of [undefined,'INTEGER','DECIMAL_STRING'].entries()){
  const alias=aliases[(ki*3+mi)%aliases.length],settings={...(mode===undefined?{}:{numericMode:mode}),[alias]:'1'};
  await rejected(`mode-admission-${kind}-${mode??'omitted'}-${alias}`,definition(kind,'2','1',settings),'Step 0 tolerance arguments require numericMode APPROXIMATE.');
 }
 for(const [index,operator]of ['GT','GTE','LT','LTE'].entries()){
  for(const mode of [undefined,'APPROXIMATE']){
   const settings={...(mode===undefined?{}:{numericMode:mode}),[aliases[index]]:'1'};
   await rejected(`ordered-admission-${operator}-${mode??'omitted'}-${aliases[index]}`,definition('COMPARE_'+operator,'2','1',settings),'Step 0 ordered comparison cannot use APPROXIMATE numericMode or tolerance arguments.');
  }
  // Additional regression coverage, distinct from the seventeen-case baseline:
  // APPROXIMATE remains forbidden even without a tolerance argument.
  await rejected(`ordered-admission-${operator}-approximate-without-tolerance`,definition('COMPARE_'+operator,'2','1',{numericMode:'APPROXIMATE'}),'Step 0 ordered comparison cannot use APPROXIMATE numericMode or tolerance arguments.');
 }
 await accepted('permitted-ordinary-eq',definition('ASSERT_EQ','1','1',{}),'1');
 await accepted('permitted-ordinary-ordered',definition('COMPARE_GT','2','1',{},true),true);
 await accepted('permitted-approximate-assert',definition('ASSERT_EQ','2','1',{numericMode:'APPROXIMATE',absTol:'1'}),'2');
 await accepted('permitted-approximate-ne',definition('COMPARE_NE','2','1',{numericMode:'APPROXIMATE',relTol:'1'},false),false);

 const pairs=[['absTol','absoluteTolerance'],['relTol','relativeTolerance']];
 const equalValues=[
  ['decimal-spelling','1','1.0'],['number-string',1,'1.000'],
  ['typed-string',decimal('1.0'),'1'],['string-typed','1',decimal('1.00')],
  ['separate-typed',decimal('1'),decimal('1.000')],['number-typed',1,decimal('1.0')],
  ['zero',0,decimal('0.000')],
  ['high-precision','0.1000000000000000001',decimal('0.10000000000000000010')]
 ];
 for(const kind of ['ASSERT_EQ','COMPARE_EQ','COMPARE_NE'])for(const [short,long]of pairs){
  for(const [name,left,right]of equalValues){
   const actual=name==='zero'||name==='high-precision'?'1':'2',comparison=kind!=='COMPARE_NE';
   await accepted(`${kind}-${short}-equal-${name}`,definition(kind,actual,'1',{numericMode:'APPROXIMATE',[short]:left,[long]:right},comparison),kind==='ASSERT_EQ'?actual:comparison);
  }
  for(const [name,left,right]of [['ordinary','1','2'],['high-precision','0.1000000000000000001','0.1000000000000000002']]){
   await rejected(`${kind}-${short}-unequal-${name}`,definition(kind,'2','1',{numericMode:'APPROXIMATE',[short]:left,[long]:right}),`Step 0 contains contradictory ${short} and ${long} tolerances.`);
  }
 }

 // Each invalid alias is checked independently even when its peer is valid or
 // identical. Equality must never cause the invalid member to be ignored.
 const invalidValues=[
  ['negative','-1'],['negative-zero','-0.0'],['exponent','1e0'],
  ['extra-key',{numberType:'DECIMAL',value:'1',extra:true}],
  ['numeric-typed-value',{numberType:'DECIMAL',value:1}],
  ['unsafe-number',9007199254740992],['nonfinite',Infinity],['number-negative-zero',-0]
 ];
 for(const [short,long]of pairs)for(const badKey of [short,long])for(const [name,bad]of invalidValues){
  await rejected(`${short}-${badKey}-invalid-${name}`,definition('ASSERT_EQ','1','1',{numericMode:'APPROXIMATE',[short]:'1',[long]:'1',[badKey]:bad}),`Step 0 input ${badKey} is invalid.`);
 }
 for(const [short,long]of pairs)for(const [name,bad]of invalidValues){
  await rejected(`${short}-duplicate-invalid-${name}`,definition('ASSERT_EQ','1','1',{numericMode:'APPROXIMATE',[short]:bad,[long]:bad}),`Step 0 input ${short} is invalid.`);
 }
 for(const kind of ['ASSERT_EQ','COMPARE_EQ','COMPARE_NE']){
  await rejected(`${kind}-missing-tolerance`,definition(kind,'1','1',{numericMode:'APPROXIMATE'}),'Step 0 approximate comparison requires an explicit tolerance.');
 }
 await accepted('both-components-equal',definition('ASSERT_EQ','120','100',{numericMode:'APPROXIMATE',absTol:'20',absoluteTolerance:decimal('20.00'),relTol:'0.01',relativeTolerance:decimal('0.010')}),'120');
 await accepted('negative-operands-remain-valid',definition('ASSERT_EQ',decimal('-2.0'),'-1',{numericMode:'APPROXIMATE',absTol:1,absoluteTolerance:'1.00'}),decimal('-2.0'));
 await accepted('safe-integer-boundary',definition('ASSERT_EQ',9007199254740991,9007199254740990,{numericMode:'APPROXIMATE',absTol:1,absoluteTolerance:decimal('1.0')}),9007199254740991);
 await accepted('decimal-beyond-number-range-remains-exact',definition('ASSERT_EQ','9007199254740993','9007199254740992',{numericMode:'APPROXIMATE',absTol:'1',absoluteTolerance:'1.0'}),'9007199254740993');
 await accepted('omitted-mode-stays-exact',definition('ASSERT_EQ','1','1.0',{}),'1','VIOLATED');
 await accepted('integer-mode-stays-exact',definition('ASSERT_EQ',1,1,{numericMode:'INTEGER'}),1);
 await accepted('decimal-string-mode-unchanged',definition('ASSERT_EQ',' +01.00 ','1',{numericMode:'DECIMAL_STRING'}),' +01.00 ');
 await accepted('omitted-relative-is-zero',definition('ASSERT_EQ','100','102',{numericMode:'APPROXIMATE',absoluteTolerance:'1'}),'100','VIOLATED');
 await accepted('omitted-absolute-is-zero',definition('ASSERT_EQ','0','1',{numericMode:'APPROXIMATE',relativeTolerance:'0.5'}),'0','VIOLATED');
 await accepted('approximate-ne-outside-tolerance',definition('COMPARE_NE','2','1',{numericMode:'APPROXIMATE',absTol:0,absoluteTolerance:'0.0'},true),true);
 const defaultOperator=definition('COMPARE_EQ','1','1',{},true);delete defaultOperator.steps[0].inputs.operator;
 await accepted('compare-default-operator-stays-eq',defaultOperator,true);

 // The global normalizer preserves the signed operand domain, but refuses
 // unsupported precision/malformed typed operands rather than coercing them.
 for(const [name,bad]of [['typed-extra',{numberType:'DECIMAL',value:'1',extra:true}],['typed-number',{numberType:'DECIMAL',value:1}],['array',['1']],['null',null],['exponent','1e0']]){
  const spec=definition('ASSERT_EQ',bad,'1',{numericMode:'APPROXIMATE',absTol:'0'});
  await assert.rejects(()=>execute(spec),error=>error.code==='UNSUPPORTED_NUMERIC_PRECISION'&&error.disposition==='UNDETERMINED',name+' operand must not coerce');
  cases.push({caseId:'operand-'+name,code:'UNSUPPORTED_NUMERIC_PRECISION',disposition:'UNDETERMINED'});
 }

 // Fresh legacy authoring compiles through the same root validator.
 const legacy={version:base.version,steps:[{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_EQ',value:'1',numericMode:'APPROXIMATE',absTol:1,absoluteTolerance:decimal('1.0')}]};
 const legacyResult=await runtime.execute({spec:legacy,canonicalBindings:{VALUE:{value:'2'}},metadata:{bindings:{VALUE:{kind:'CANONICAL_VALUE',canonicalKey:'VALUE'}}}});
 assert.equal(legacyResult.determination,'SATISFIED');assert.equal(legacyResult.actual,'2');
 cases.push({caseId:'current-legacy-alias-normalization',determination:'SATISFIED',actual:'2'});

 const previousCurrent='77e7b900e5f7f5ac66033564cc0cb4f323cc76b7f7dd95ac6d173c0f649f655d';
 const retainedPrior='21b4c97a596fecd7ec5dca7788ded488827ef71c0aee3a041f89bd19d0eede00';
 assert.equal(base.operationRegistrySha256,'aea1efab8e1c342d550653238ef2740bd625c2ec5bbadb0dbaf76fcd1034492d','independently pinned current registry descriptor');
 assert.notEqual(base.operationRegistrySha256,previousCurrent,'changed semantics require new identity');
 const retainedFields=spec=>({TEST_ID:'SYNTHETIC-TOLERANCE-IDENTITY',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:base.version,EXECUTABLE_SPEC:spec,EXECUTABLE_SPEC_SHA256:hashValue(spec),EXECUTABLE_INPUT_BINDINGS:{}});
 let workerLaunches=0;class MustNotLaunch{constructor(){workerLaunches++;throw Error('stale tolerance definition reached worker');}}
 for(const digest of [previousCurrent,retainedPrior])for(const kind of ['ASSERT_EQ','COMPARE_EQ','COMPARE_NE']){
  const stale={...definition(kind,'1','1',{numericMode:'APPROXIMATE',absTol:'0'}),operationRegistrySha256:digest};
  const check=runtime.validateSpec(stale,{}, {allowPriorRegistry:true});assert.equal(check.valid,false);assert.ok(check.issues.includes('Operation registry digest does not match the current registered semantics.'));
  await assert.rejects(()=>execute(stale),error=>error.code==='INVALID_TEST_IR');
  const test={fields:retainedFields(stale)};assert.equal(runtime.supports(test),false);
  const result=await runtime.executeTest(test,{}, {},{Worker:MustNotLaunch});assert.equal(result.failure.code,'INVALID_TEST_IR');assert.equal(result.determination,'UNDETERMINED');assert.deepEqual(plain(result.observations),[]);
  cases.push({caseId:`stale-${digest===previousCurrent?'previous-current':'retained-prior'}-${kind}`,code:result.failure.code,workerStarted:false});
 }
 for(const kind of ['ASSERT_EQ','COMPARE_EQ'])for(const alias of aliases){
  const stale={...definition(kind,'1','1',{numericMode:'INTEGER',[alias]:'0'}),operationRegistrySha256:retainedPrior};
  const checked=runtime.validateSpec(stale,{}, {allowPriorRegistry:true});assert.equal(checked.valid,false);assert.ok(checked.issues.includes('Operation registry digest does not match the current registered semantics.'));
  const test={fields:retainedFields(stale)};assert.equal(runtime.supports(test),false);
  const result=await runtime.executeTest(test,{}, {},{Worker:MustNotLaunch});assert.equal(result.failure.code,'INVALID_TEST_IR');assert.equal(result.determination,'UNDETERMINED');assert.deepEqual(plain(result.observations),[]);
  cases.push({caseId:`stale-retained-tolerance-port-${kind}-${alias}`,code:result.failure.code,workerStarted:false});
 }
 const ordinaryPrior={...definition('ASSERT_EQ',true,true,{}),operationRegistrySha256:retainedPrior};
 assert.equal(runtime.supports({fields:retainedFields(ordinaryPrior)}),true);
 const priorResult=await execute(ordinaryPrior);assert.equal(priorResult.determination,'SATISFIED');assert.equal(priorResult.operationRegistrySha256,retainedPrior);
 cases.push({caseId:'ordinary-prior-identity-preserved',determination:'SATISFIED',operationRegistrySha256:priorResult.operationRegistrySha256});
 for(const digest of [previousCurrent,retainedPrior]){
  const priorLegacyDag={...runtime.normalizeSpec(legacy),operationRegistrySha256:digest};
  const priorLegacy={fields:{...retainedFields(priorLegacyDag),EXECUTABLE_SPEC:legacy,EXECUTABLE_INPUT_BINDINGS:{VALUE:{kind:'CANONICAL_VALUE',canonicalKey:'VALUE'}}}};
  assert.equal(runtime.supports(priorLegacy),false);
  const priorLegacyResult=await runtime.executeTest(priorLegacy,{}, {},{Worker:MustNotLaunch});assert.equal(priorLegacyResult.failure.code,'STALE_EXECUTABLE_SPEC_IDENTITY');assert.equal(priorLegacyResult.determination,'UNDETERMINED');
  cases.push({caseId:`${digest===previousCurrent?'previous-current':'prior'}-legacy-approximate-stale`,code:priorLegacyResult.failure.code,workerStarted:false});
 }
 assert.equal(workerLaunches,0);

 const published=runtime.authoringContract();
 assert.match(published.numericSemantics.approximate,/normalize to exactly the same mathematical value/);
 assert.doesNotMatch(published.numericSemantics.approximate,/strictly equal primitives|typed DECIMAL objects conflict/);
 assert.deepEqual(plain(published.priorRegistryCompatibility.excludedNumericModes),{COMPARE:['APPROXIMATE','DECIMAL_STRING'],ASSERT_EQ:['APPROXIMATE','DECIMAL_STRING']});
 assert.deepEqual(plain(published.priorRegistryCompatibility.excludedInputPorts),{COMPARE:aliases,ASSERT_EQ:aliases});
 assert.equal(cases.length,176,'Exact bounded regression population');assert.equal(new Set(cases.map(row=>row.caseId)).size,176,'Unique bounded regression identities');
 return {passed:true,cases,workerLaunches,currentRegistrySha256:base.operationRegistrySha256,synthetic:true,actualBrowser:false,boundary:'176 finite complete public runtime.execute/validateSpec/executeTest controls for normalized tolerance alias equality, numeric-mode admission, exact-domain refusal and identity staleness; no whole numeric requirement, project acceptance, actual worker or browser coverage claim.'};
}

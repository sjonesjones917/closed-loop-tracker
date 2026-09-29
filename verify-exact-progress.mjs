import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

// Section 34.1 prohibits fractional JSON numbers in persisted canonical data.
// Coverage must retain the exact count ratio during incomplete work too.
const fault=process.env.CLRT_EXACT_PROGRESS_FAULT==='fractional-coverage';
const r=projectStoreRuntime({fault:fault?{file:'workflow-engine.js',id:'fractional-coverage',before:'value:requirements.length?schema.canonicalRatio(covered,requirements.length):0',after:'value:requirements.length?covered/requirements.length:0'}:null});
const {core,engine,store,ingestion,copy,runtime}=r,schema=runtime.closedLoopWorkflowSchema,hash=runtime.closedLoopHash,cases=[];
let ratios=0;
for(let total=1;total<=128;total++)for(let complete=0;complete<=total;complete++){
  const encoded=schema.canonicalRatio(complete,total);
  assert.equal(schema.isCanonicalNumber(encoded),true);
  assert.doesNotThrow(()=>hash.sha256Value(encoded));
  if(typeof encoded==='number')assert.equal(encoded*total,complete);
  else{const [n,d]=encoded.slice(9).split('/').map(BigInt);assert.equal(n*BigInt(total),BigInt(complete)*d);}
  ratios++;
}
cases.push({name:'Every completion count through 128 preserves its exact rational value and canonical JSON identity',result:'PASS',ratios});
for(const [text,expected] of [['0',0],['-0',0],['.5','rational:1/2'],['1.25','rational:5/4'],['-1.25','rational:-5/4'],['2.50e1',25],['1e-10','rational:1/10000000000'],['9007199254740993','rational:9007199254740993/1']])assert.equal(schema.canonicalDecimal(text),expected);
for(const value of [0.5,Number.NaN,Number.POSITIVE_INFINITY,-0,'0.5','rational:2/4','rational:1/0','rational:01/2','rational:2/1']){
  const issues=[];ingestion.validateValue({valueType:'NUMBER',nullable:false},value,'/value',issues);
  assert.ok(issues.some(issue=>issue.code==='WRONG_VALUE_TYPE'),'EXACT_NUMBER_GATE_ORACLE: noncanonical number was accepted');
}
for(const value of [0,1,'rational:1/2','rational:9007199254740993/1']){
  const issues=[];ingestion.validateValue({valueType:'NUMBER',nullable:false},value,'/value',issues);assert.equal(issues.length,0);
  assert.equal(ingestion.validateHumanAnswer({requestId:'NUMERIC-ANSWER',answerType:'NUMBER',blocking:true},value,core.createBlankState('ANSWER')),true);
}
cases.push({name:'Decimal entry preserves precision; canonical NUMBER validation rejects the violation and accepts exact values',result:'PASS'});

let p=await store.createProject({commandId:'EXACT-PROGRESS-PROJECT'}),draft=copy(p);
draft.job.CURRENT_REQUIREMENTS_VERSION='DISPOSABLE-REQUIREMENTS';draft.job.CURRENT_TEST_SUITE_VERSION='DISPOSABLE-TESTS';
const scope=engine.currentScope(draft),requirements=[];
function fixtureRecord(collection,stage,values){const id=engine.allocateId(draft,collection),fields={...values,[schema.RECORD_SCHEMAS[collection].idField]:id},record=copy({id,stage,active:true,scope,fields,...fields,source:'SYNTHETIC_DISPOSABLE_FIXTURE'});engine.refreshRecordHashes(record,collection);draft.projectData[collection].push(record);return record;}
for(let index=0;index<2;index++)requirements.push(fixtureRecord('requirements',4,{OBLIGATION:'Disposable coverage subject '+index,MANDATORY_OPTIONAL_STATUS:'MANDATORY',APPLICABILITY:'APPLICABLE'}));
fixtureRecord('tests',6,{REQ_ID:engine.recordId(requirements[0],'requirements'),STATUS:'READY'});
const derived=engine.DERIVATIONS['stage06.mandatoryTestCoverage'](draft);
assert.equal(derived.value,'rational:1/2','EXACT_PROGRESS_ORACLE: partial coverage must use a canonical exact value');
p=await store.writeProject(draft,{expectedProjectRevision:p.revision});
const view=copy({activeStage:6,activeView:'Workflow',scrollX:'0.5',scrollY:'123.25',drafts:{numericAnswer:{value:schema.canonicalDecimal('0.125')}}});
const checkpoint=await store.saveCheckpoint(p.job.JOB_ID,{expectedProjectRevision:p.revision,view});
const read=await store.readProject(p.job.JOB_ID);assert.equal(engine.DERIVATIONS['stage06.mandatoryTestCoverage'](read).value,'rational:1/2');
const restored=await store.restoreCheckpoint(p.job.JOB_ID,checkpoint,{expectedProjectRevision:p.revision});
assert.deepEqual(copy(restored.view),copy(view));assert.equal(engine.DERIVATIONS['stage06.mandatoryTestCoverage'](restored.project).value,'rational:1/2');
cases.push({name:'Partial canonical work and exact numeric drafts survive durable checkpoint, read and whole-version restoration',result:'PASS'});
console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Node production derivation, validation and persistence with transaction adapter',bounds:{maxCoverageDenominator:128,decimalCharacters:4096,decimalExponentMagnitude:4096},cases},null,2));

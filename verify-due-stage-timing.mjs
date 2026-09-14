import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import {operatorPrefixFixture} from './operator-prefix-fixture.mjs';

function load(engineSource=fs.readFileSync('workflow-engine.js','utf8')){const context={console,TextEncoder,TextDecoder,URL,URLSearchParams,crypto:webcrypto,dispatchEvent(){},Event:function Event(type){this.type=type}};context.globalThis=context;vm.createContext(context);for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});vm.runInContext(engineSource,context,{filename:'workflow-engine.js'});return context;}
function testRecord(fields){return {fields:{...fields},...fields};}
function verifyTiming(engineSource){const c=load(engineSource),core=c.closedLoopCore,engine=c.closedLoopWorkflowEngine,p=core.createBlankState('JOB-DUE-STAGE');engine.ensureShape(p);Object.assign(p.job,{CURRENT_ITERATION:'ITERATION-TEST',CURRENT_CANDIDATE_ID:'CANDIDATE-TEST',CURRENT_PRODUCT_ID:null,CURRENT_PRODUCT_VERSION:null,CURRENT_DELIVERY_CANDIDATE_SET_ID:null,CURRENT_RELEASE_ID:null,CURRENT_HASH_REVIEW_ID:null,CURRENT_EVIDENCE_CHAIN_VERSION:null});const pre=testRecord({VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:12,REQUIRED_BY_STAGE:12,PER_RUN_REQUIRED:true,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{phaseTarget:true}}),finalProduct=testRecord({VERIFICATION_PHASE:'FINAL_PRODUCT_DETERMINISTIC',EARLIEST_EXECUTABLE_STAGE:22,REQUIRED_BY_STAGE:22,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:true,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{phaseTarget:true}}),missing=testRecord({VERIFICATION_PHASE:'PREPRODUCT_ITERATION'});assert.equal(engine.testDueState(p,pre,12,{perRunOnly:true}).dueNow,true,'A current due PREPRODUCT per-run test must be due at Stage 12.');assert.equal(engine.testDueState(p,finalProduct,12,{perRunOnly:true}).dueNow,false,'A final-product test must not become a Stage 12 per-run obligation.');assert.equal(engine.testDueState(p,finalProduct,12,{perRunOnly:true}).targetAvailability,'FALSE','Final-product target availability must remain false before a product exists.');assert.equal(engine.testDueState(p,missing,12,{perRunOnly:true}).valid,false,'Missing verification timing fields must fail closed.');p.job.CURRENT_PRODUCT_ID='PRODUCT-TEST';p.job.CURRENT_PRODUCT_VERSION='PRODUCT-V1';assert.equal(engine.testDueState(p,finalProduct,22).dueNow,true,'The final-product test becomes due when its target exists at its required stage.');return {dueStageTiming:'PASS'};}
const source=fs.readFileSync('workflow-engine.js','utf8');
verifyTiming(source);
const serialized=operatorPrefixFixture(13),cases=[];
function matrixOracle(engineSource){
  const c=load(engineSource),engine=c.closedLoopWorkflowEngine,p=vm.runInContext('JSON.parse('+JSON.stringify(serialized)+')',c);
  const iteration=engine.records(p,'iterations').find(row=>row.stage===10),iterationId=engine.recordId(iteration,'iterations');
  const tests=engine.recordsForCurrentScope(p,'tests'),perRun=tests.filter(row=>engine.recordValue(row,'PER_RUN_REQUIRED')===true).map(row=>engine.recordId(row,'tests'));
  const finalTests=tests.filter(row=>engine.recordValue(row,'FINAL_PRODUCT_REQUIRED')===true).map(row=>engine.recordId(row,'tests'));
  assert.equal(perRun.length,1);assert.equal(finalTests.length,3,'Fixture must contain actual final-product tests to detect accidental inclusion.');
  const matrix=engine.verificationMatrix(p,iterationId),relations=engine.requiredVerificationRelationSet(p);
  assert.equal(matrix.expected.length,10,'DUE_MATRIX_ORACLE: only the due per-run test creates run obligations');
  assert.equal(relations.tuples.length,10,'DUE_RELATION_ORACLE: proof obligations must exclude tests whose targets do not yet exist');
  assert(matrix.expected.every(key=>perRun.includes(key.split('|')[2])),'DUE_MATRIX_ORACLE: final-product tuple entered the per-run matrix');
  assert(relations.tuples.every(row=>perRun.includes(row.TEST_ID)),'DUE_RELATION_ORACLE: final-product tuple entered the proof relation set');
  assert.equal(matrix.missing.length,0);assert.equal(matrix.invalid.length,0);
  assert.equal(engine.gate(13,p).complete,true,'The complete due verification set permits comparison progression.');
  return {perRunTestIds:perRun,excludedFinalTestIds:finalTests,expectedTupleIds:matrix.expected};
}
cases.push({caseId:'due-matrix-and-proof-relation-boundary',result:'PASS',...matrixOracle(source)});
for(const [caseId,before,after,reason] of [
 ['bypassed-matrix-timing','const timing=testDueState(project,test,12,{perRunOnly:true});','const timing={valid:true,blocking:false,dueNow:true};',/DUE_MATRIX_ORACLE/],
 ['bypassed-proof-relation-timing','const timing=e0.testDueState(p,t,12,{perRunOnly:true});','const timing={valid:true,blocking:false,dueNow:true};',/DUE_RELATION_ORACLE/]
]){
 assert(source.includes(before),'Missing fault anchor');
 assert.throws(()=>matrixOracle(source.replace(before,after)),reason,'The executed oracle must detect '+caseId);
 matrixOracle(source);cases.push({caseId,result:'DETECTED',restored:'PASS'});
}
console.log(JSON.stringify({dueStageTiming:'PASS',synthetic:true,cases,physicalDeviceAcceptance:false}));

import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {pathToFileURL} from 'node:url';

// Retain every executed case. Expected success is independent of its outcome.
export function assertStage29CaseObservation(observation){
 assert(Array.isArray(observation.cases)&&observation.cases.length>0,'STAGE29_OBSERVATION_CASES');
 for(const row of observation.cases)assert(typeof row.name==='string'&&row.name&&typeof row.passed==='boolean','STAGE29_OBSERVATION_CASE_SHAPE');
 const expected=observation.cases.map(({name})=>({name,passed:true}));
 const observed=observation.cases.map(({name,passed})=>({name,passed}));
 assert.deepEqual(observation.expected,expected,'STAGE29_OBSERVATION_EXPECTED');
 assert.deepEqual(observation.observed,observed,'STAGE29_OBSERVATION_OBSERVED');
 assert.equal(observation.passed,isDeepStrictEqual(expected,observed),'STAGE29_OBSERVATION_RESULT');
 assert.equal(observation.passed,true,'STAGE29_OBSERVATION_FAILED_CASE');
 return observation;
}
export function stage29CaseObservation(fields){
 const expected=fields.cases.map(({name})=>({name,passed:true}));
 const observed=fields.cases.map(({name,passed})=>({name,passed}));
 return assertStage29CaseObservation({...fields,expected,observed,passed:isDeepStrictEqual(expected,observed)});
}
export function verifyStage29ObservationRefusals(){
 const good=stage29CaseObservation({checkId:'synthetic-observation-contract',boundary:'synthetic observation serialization only',cases:[{name:'first',passed:true},{name:'second',passed:true}]});
 let refusals=0;
 for(const field of ['expected','observed']){
  for(const mutate of [row=>{delete row[field];},row=>{row[field][0].passed=false;},row=>{row[field][0].name='unexecuted case';},row=>{row[field].pop();}]){
   const bad=structuredClone(good);mutate(bad);assert.throws(()=>assertStage29CaseObservation(bad),{code:'ERR_ASSERTION'});refusals++;
  }
 }
 const wrongResult=structuredClone(good);wrongResult.passed=false;
 assert.throws(()=>assertStage29CaseObservation(wrongResult),/STAGE29_OBSERVATION_RESULT/);refusals++;
 assert.throws(()=>stage29CaseObservation({...good,cases:[{name:'actual failed case',passed:false}]}),/STAGE29_OBSERVATION_FAILED_CASE/);refusals++;
 assert.throws(()=>stage29CaseObservation({...good,cases:[]}),/STAGE29_OBSERVATION_CASES/);refusals++;
 return {positiveCases:good.cases.length,refusals};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(verifyStage29ObservationRefusals()));

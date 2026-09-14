import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {operatorPrefixFixture} from './operator-prefix-fixture.mjs';

// Specification §§1.2, 30 and 36.4: an unresolved contradiction cannot
// establish satisfaction. These are result-evaluator component cases. The
// run/evidence/context foundation comes from accepted synthetic operations;
// the final-result records below are disposable evaluator inputs, not a
// claim of completing the final-product stages or external review.
const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'];
function load(fault=false){
 const c=vm.createContext({TextEncoder,TextDecoder,Blob,crypto:globalThis.crypto,Event:class{},dispatchEvent(){}});
 for(const file of files){let s=fs.readFileSync(file,'utf8');if(fault&&file==='workflow-engine.js'){const anchor='function resultOutcomeConflict(collection,record,test){';assert(s.includes(anchor),'Missing fault anchor');s=s.replace(anchor,anchor+' return null;');}vm.runInContext(s,c,{filename:file});}
 return {engine:c.closedLoopWorkflowEngine,copy:x=>vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify(x))+')',c)};
}
const runtime=load(),e=runtime.engine,base=JSON.parse(operatorPrefixFixture(13)),observed=base.projectData.verification.find(r=>!r.invalidatedBy),testId=e.recordValue(observed,'TEST_ID');
const cases=[];
function oracle(api,copy){
 for(const [family,field] of [['verification','OBSERVED_RESULT'],['deterministicResults','ACTUAL_RESULT'],['meaningResults','EVIDENCE_BASED_COMPARISON'],['adversarialResults','ACTUAL_RESULT']]){
  const p=copy(base),test=p.projectData.tests.find(t=>e.recordId(t,'tests')===testId),row=copy(observed);
  Object.assign(test.fields,{EXPECTED_RESULT:'PASSED',ARTIFACT_REQUIREMENTS:'NONE'});Object.assign(test,test.fields);
  Object.assign(row.fields,{OBSERVED_RESULT:'PASSED',ACTUAL_RESULT:'PASSED',EXPECTED_RESULT:'PASSED',REQUIRED_MEANING:'The required meaning.',OBSERVED_MEANING:'The required meaning.',PRODUCT_LOCATION:'result.txt',EVIDENCE_BASED_COMPARISON:'PASSED',DETERMINATION:'SATISFIED'});Object.assign(row,row.fields);
  assert.equal(api.evaluateResultConsistency(family,row,test,p).determination,'SATISFIED',family+': valid baseline failed');
  row.fields[field]='FAILED';row[field]='FAILED';
  const result=api.evaluateResultConsistency(family,row,test,p);
  assert.notEqual(result.determination,'SATISFIED','RESULT_CONFLICT_ORACLE: '+family+' accepted a failed observation with a favorable claim');
  assert(result.reasons.some(reason=>reason.includes('OBSERVED_OUTCOME_CONFLICT')&&reason.includes(field)),'RESULT_CONFLICT_ORACLE: '+family+' failed for an unrelated reason');
  row.fields[field]='PASSED';row[field]='PASSED';
  assert.equal(api.evaluateResultConsistency(family,row,test,p).determination,'SATISFIED',family+': repair did not progress');
  // A word inside prose is not a controlled negative outcome.
  row.fields[field]='The earlier attempt FAILED; this corrected attempt meets the requirement.';row[field]=row.fields[field];
  assert.equal(api.evaluateResultConsistency(family,row,test,p).determination,'SATISFIED',family+': arbitrary prose was treated as a controlled outcome');
  if(family!=='meaningResults'){
   // A test may intentionally require a rejected/failed operation. Matching
   // expected negative output is not itself an adverse test determination.
   test.fields.EXPECTED_RESULT='FAILED';test.EXPECTED_RESULT='FAILED';row.fields.EXPECTED_RESULT='FAILED';row.EXPECTED_RESULT='FAILED';row.fields[field]='FAILED';row[field]='FAILED';
   assert.equal(api.evaluateResultConsistency(family,row,test,p).determination,'SATISFIED',family+': expected negative output was prohibited');
  }
  cases.push({family,field,baseline:'SATISFIED',violation:result,repair:'SATISFIED'});
 }
}
oracle(e,runtime.copy);
const fault=load(true);assert.throws(()=>oracle(fault.engine,fault.copy),/RESULT_CONFLICT_ORACLE/,'The tests did not detect bypassed conflict validation');
console.log(JSON.stringify({resultContradictions:'PASS',evidenceClass:'SYNTHETIC_RESULT_EVALUATOR_COMPONENT_CASES',cases,bypassedConflictFault:'DETECTED',arbitraryProseNotKeywordScanned:true,expectedNegativeOutcomesPreserved:true,completeOperatorJourney:false}));

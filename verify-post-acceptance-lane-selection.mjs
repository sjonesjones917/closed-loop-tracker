import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync('app-core.js','utf8');
function productionFunction(name,nextMarker){
  const start=source.indexOf(`function ${name}(`),end=source.indexOf(nextMarker,start);
  assert.ok(start>=0&&end>start,`LANE_SELECTION_PRODUCTION_FUNCTION_${name}_ORACLE`);
  return source.slice(start,end).trim();
}
const production=productionFunction('rebaseAcceptedLaneSelection','\nconst stageContinuationErrors');
function compile(functionSource){return Function(`"use strict";return (${functionSource});`)();}
function state(){return {operations:{2:'COMPLETE',17:'COMPARE'},runs:{2:'RUN-OLD',17:'RUN-COMPLETE'}};}
function assertRetired(fn,oracle){const x=state();fn(2,null,x.operations,x.runs);assert.equal(Object.hasOwn(x.operations,2),false,`${oracle}_OPERATION`);assert.equal(Object.hasOwn(x.runs,2),false,`${oracle}_RUN`);return x;}

const fn=compile(production);
const retired=assertRetired(fn,'POST_ACCEPTANCE_LANE_RETIREMENT_ORACLE');
assert.equal(retired.operations[17],'COMPARE','Acceptance lane retirement mutated another stage operation.');
assert.equal(retired.runs[17],'RUN-COMPLETE','Acceptance lane retirement mutated another stage run.');
const continued=state(),continuation={stage:2,operation:'SEARCH_ADEQUACY_REVIEW',scope:{runId:'RUN-NEW'}};
fn(2,continuation,continued.operations,continued.runs);
assert.equal(continued.operations[2],'SEARCH_ADEQUACY_REVIEW','POST_ACCEPTANCE_CONTINUATION_OPERATION_ORACLE');
assert.equal(continued.runs[2],'RUN-NEW','POST_ACCEPTANCE_CONTINUATION_RUN_ORACLE');

const injectedFaults=[];
for(const fault of [
  {id:'KEEP-STALE-OPERATION-SELECTION',mutate:text=>text.replace('delete operations[stage];',''),oracle:'FAULT_STALE_OPERATION'},
  {id:'KEEP-STALE-RUN-SELECTION',mutate:text=>text.replace('delete runs[stage];',''),oracle:'FAULT_STALE_RUN'}
]){
  let detected=false,message='';
  try{assertRetired(compile(fault.mutate(production)),fault.oracle);}catch(error){detected=true;message=String(error.message||error);}
  assert.equal(detected,true,`${fault.id}_MUTATION_DETECTION_ORACLE`);
  injectedFaults.push({fault:fault.id,result:'DETECTED',detectedBy:message});
}
console.log(JSON.stringify({schema:'closed-loop-post-acceptance-lane-selection-regression/1',result:'PASS',behavior:'Committed acceptance retires stale operation and run selections; an explicit committed continuation becomes the new lane.',injectedFaults},null,2));

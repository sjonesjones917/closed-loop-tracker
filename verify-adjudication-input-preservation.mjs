import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'];
const engineSource=fs.readFileSync('workflow-engine.js','utf8');
function runtime(fault=false){
 const sandbox=vm.createContext({console,TextEncoder,TextDecoder,Blob,crypto:globalThis.crypto,Event:class{},dispatchEvent(){}});
 for(const file of files){
  let code=file==='workflow-engine.js'?engineSource:fs.readFileSync(file,'utf8');
  if(fault&&file==='workflow-engine.js'){
   const anchor='copy.projectData[collection]=safe(project?.projectData?.[collection]).map(record=>clone(record));';
   assert.equal(code.split(anchor).length,2,'One adjudication input-isolation mutation target is required');
   code=code.replace(anchor,'copy.projectData[collection]=safe(project?.projectData?.[collection]).slice();');
  }
  vm.runInContext(code,sandbox,{filename:file});
 }
 return sandbox;
}
const families={verification:'DETERMINATION',deterministicResults:'DETERMINATION',meaningResults:'DETERMINATION',adversarialResults:'DETERMINATION',representationInspections:'DETERMINATION',preflightRecords:'DETERMINATION',confirmationRecords:'DETERMINATION',processAudits:'PROCESS_DETERMINATION',productAudits:'PRODUCT_DETERMINATION',regressionExecutions:'RESULT',products:'STATUS'};
function fixture(r){
 const p=r.closedLoopCore.createBlankState('ADJUDICATION-INPUT-PRESERVATION'),e=r.closedLoopWorkflowEngine;e.ensureShape(p);
 for(const [family,key] of Object.entries(families)){
  const id='STIPULATED-'+family,definition=r.closedLoopWorkflowSchema.RECORD_SCHEMAS[family],fields={[definition.idField]:id,[key]:family==='products'?'COMPLETED':'SATISFIED'};
  // These are stipulated canonical claims without supporting evidence. The
  // reducer may reject the claims, but cannot rewrite the recorded submission.
  p.projectData[family].push(e.clone({id,active:true,stage:definition.stage||1,scope:e.currentScope(p),fields}));
 }
 return p;
}
function oracle(r){
 const e=r.closedLoopWorkflowEngine,p=fixture(r),read=()=>Object.fromEntries(Object.entries(families).map(([family,key])=>[family,p.projectData[family].map(row=>row.fields[key])])),before=JSON.stringify(read()),cases=[];
 for(let stage=1;stage<=r.closedLoopCore.STAGES.length;stage++){
  e.gate(stage,p);
  assert.equal(JSON.stringify(read()),before,'GATE_INPUT_MUTATION_ORACLE: evaluating a gate rewrote canonical submitted conclusions');
  cases.push({stage,result:'INPUT_CONCLUSIONS_PRESERVED'});
 }
 return cases;
}
const control=runtime(),cases=oracle(control);
assert.throws(()=>oracle(runtime(true)),/GATE_INPUT_MUTATION_ORACLE/);
assert.equal(oracle(control).length,cases.length);
console.log(JSON.stringify({evidenceClass:'gate input-preservation component',cases,families:Object.keys(families),fault:'shared-conclusion-records',faultDetected:true,restoredControl:'PASS',completeOperatorJourney:false,workloadLatencyEstablished:false}));

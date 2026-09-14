import fs from 'node:fs';
import vm from 'node:vm';
import {operatorPrefixFixture} from './operator-prefix-fixture.mjs';
import assert from 'node:assert/strict';

// Specification §37, Stage 13: compare every due run under its frozen
// variance contract; prohibited variance needs a real defect; UNKNOWN blocks.
// The prerequisite project is built by the ordinary production commands and
// accepted synthetic responses. No alternate engine or forced gate is loaded.
const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'];
function load(fault=null){
  const c=vm.createContext({TextEncoder,TextDecoder,Blob,crypto:globalThis.crypto,Event:class{},dispatchEvent(){}});
  for(const file of runtimeFiles){let source=fs.readFileSync(file,'utf8');if(fault?.file===file){assert(source.includes(fault.before),'Fault anchor missing');source=source.replace(fault.before,fault.after);}vm.runInContext(source,c,{filename:file});}
  return {engine:c.closedLoopWorkflowEngine,hash:c.closedLoopHash,copy:text=>vm.runInContext('JSON.parse('+JSON.stringify(text)+')',c)};
}
const serialized=operatorPrefixFixture(13);
const {engine:e,copy,hash}=load(),base=copy(serialized),cases=[],failures=[];
const iterationId=e.recordId(e.records(base,'iterations').find(row=>row.stage===10),'iterations');
const comparison=p=>e.recordsForIteration(p,'comparisons',iterationId)[0];
const set=(row,fields,family)=>{Object.assign(row.fields,fields);Object.assign(row,fields);e.refreshRecordHashes(row,family);};
assert.equal(e.gate(13,base).complete,true,'The complete clean prerequisite journey must pass before any negative case.');
const matrix=e.verificationMatrix(base,iterationId),stability=e.executionStability(base,iterationId);
const expectedAcceptedOperations=base.projectData.acceptedChanges.filter(change=>change.status==='COMMITTED'&&!change.invalidatedBy&&[11,12].includes(Number(change.stage))).map(change=>change.changeId).sort();
const operationMetrics=e.operationalMetrics(base);assert.deepEqual(Array.from(operationMetrics.independentAcceptedOperationIds).sort(),Array.from(expectedAcceptedOperations),'Accepted run and verification operations were not counted from their acceptance records.');
assert.equal(operationMetrics.materiallyIndependentAcceptedOperations,expectedAcceptedOperations.length);
const duplicateRecord=copy(serialized);duplicateRecord.projectData.verification.push(e.clone(duplicateRecord.projectData.verification[0]));assert.equal(e.operationalMetrics(duplicateRecord).materiallyIndependentAcceptedOperations,expectedAcceptedOperations.length,'A second verification row counted an operation twice.');
assert.equal(matrix.expected.length,10);assert.equal(matrix.missing.length,0);assert.equal(matrix.duplicates.length,0);
assert.equal(stability.runCount,10);assert.equal(stability.requirementsWithCompleteAgreement,1);
const dueTestIds=Array.from(new Set(matrix.expected.map(key=>key.split('|')[2]))).sort();
assert.deepEqual(Object.keys(stability.testStability).sort(),dueTestIds,'STABILITY_DUE_ORACLE: tests with no due run observations were reported as unstable.');
cases.push({caseId:'clean-ten-run-comparison',actual:e.gate(13,base),result:'PASS'});
const stabilityFault=load({file:'workflow-engine.js',before:".filter(test=>dueTestIds.has(recordId(test,'tests')))",after:''});
assert.throws(()=>assert.deepEqual(Object.keys(stabilityFault.engine.executionStability(stabilityFault.copy(serialized),iterationId).testStability).sort(),dueTestIds,'STABILITY_DUE_ORACLE: future tests entered current run statistics'),/STABILITY_DUE_ORACLE/);
cases.push({caseId:'non-due-tests-excluded-from-current-stability',result:'PASS',mutant:'DETECTED'});
function rejected(caseId,change,reason){
  const p=copy(serialized);change(p);const actual=e.gate(13,p);
  try{assert.equal(actual.complete,false,caseId+': prohibited state was accepted');assert(actual.reasons.some(item=>reason.test(item)),caseId+': rejection did not identify its violation: '+actual.reasons.join('; '));assert.equal(e.gate(13,copy(serialized)).complete,true,caseId+': restoring the original valid data did not recover');cases.push({caseId,actual,result:'PASS',corrected:'PASS'});}catch(error){failures.push({caseId,actual,error:error.message});}
}
rejected('missing-current-verification',p=>p.projectData.verification.splice(0,1),/verification|undetermined|missing/i);
rejected('duplicate-current-verification',p=>{const row=e.clone(p.projectData.verification[0]);row.id='DUPLICATE';set(row,{VERIFICATION_ID:row.id},'verification');p.projectData.verification.push(row);},/duplicate|verification|exactly one/i);
rejected('missing-frozen-variance-contract',p=>{const t=e.recordsForCurrentScope(p,'tests').find(row=>e.recordValue(row,'PER_RUN_REQUIRED'));delete t.fields.EXPECTED_VARIANCE_CONTRACT;delete t.EXPECTED_VARIANCE_CONTRACT;e.refreshRecordHashes(t,'tests');},/variance.*contract|EXPECTED_VARIANCE_CONTRACT/i);
rejected('unknown-variance-authorization',p=>set(comparison(p),{AUTHORIZED_VARIANCE:'UNKNOWN'},'comparisons'),/variance|UNKNOWN/i);
for(const reference of ['NONE','DOES-NOT-EXIST'])rejected('prohibited-variance-with-'+reference,p=>set(comparison(p),{OUTPUT_VARIANCE:'A prohibited representation difference was found.',AUTHORIZED_VARIANCE:'FALSE',CORRECTNESS_AFFECTING_VARIANCE:'TRUE',DEFECT_IDS:reference},'comparisons'),/defect/i);
// Retain the original arithmetic cases, using observed production-run evidence.
const failedRun=copy(operatorPrefixFixture(13,{initialFailure:true}));
const failedIteration=e.recordId(e.records(failedRun,'iterations').find(row=>row.stage===10),'iterations');
const failedStability=e.executionStability(failedRun,failedIteration);
assert.equal(e.gate(13,failedRun).complete,true,'A comparison with an evidenced defect must progress to root-cause analysis.');
for(const [kind,rows] of Object.entries({requirement:failedStability.requirementStability,test:failedStability.testStability})){
  const counts=Object.values(rows).find(row=>row.satisfied===9&&row.violated===1);
  assert(counts,kind+': nine satisfied observations and one failed observation must remain visible');
  assert.equal(counts.undetermined,0);assert.equal(counts.agreementRate,0.9);
}
assert.equal(failedStability.requirementsWithDisagreement,1);
cases.push({caseId:'observed-failure-with-real-defect-progresses',actual:e.gate(13,failedRun),stability:failedStability,result:'PASS'});
// Starting a later iteration must not detach an earlier comparison from
// the evidence belonging to its own accepted iteration.
const continuation=copy(operatorPrefixFixture(16,{initialFailure:true}));
const selected=['CANDIDATE-FILE'],selection=e.recordRegisteredHumanDecision(continuation,{stage:17,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:hash.sha256Value(selected),value:selected,operatorLabel:'SYNTHETIC'});
e.freezeCandidate(continuation,{stage:17,artifactIds:selected,selectionDecisionId:e.recordId(selection,'humanDecisions')});
e.reserveRunBatch(continuation,{stage:17});
assert.equal(e.gate(13,continuation).complete,true,'ITERATION_EVIDENCE_ORACLE: starting a new iteration invalidated an earlier valid defect-evidence link');
assert.equal(e.gate(16,continuation).complete,true,'The preserved correction prerequisites cannot continue into the new iteration');
const wrongScope=load({file:'workflow-engine.js',before:"safe(defect.evidenceRefs).some(id=>recordsForIteration(project,'evidenceRecords',iterationId)",after:"safe(defect.evidenceRefs).some(id=>recordsForCurrentScope(project,'evidenceRecords')"});
assert.throws(()=>assert.equal(wrongScope.engine.gate(13,wrongScope.copy(JSON.stringify(continuation))).complete,true,'ITERATION_EVIDENCE_ORACLE: earlier evidence was selected through the latest iteration'),/ITERATION_EVIDENCE_ORACLE/);
cases.push({caseId:'earlier-comparison-keeps-own-iteration-evidence',result:'PASS',wrongIterationScopeFault:'DETECTED'});
const unknown=copy(serialized),unknownRow=unknown.projectData.verification[0];unknownRow.evidenceRefs=[];
const unknownStability=e.executionStability(unknown,iterationId),unknownCounts=Object.values(unknownStability.requirementStability)[0];
assert.equal(unknownCounts.satisfied,9);assert.equal(unknownCounts.violated,0);assert.equal(unknownCounts.undetermined,1);assert.equal(unknownCounts.agreementRate,0.9);
assert.equal(e.gate(13,unknown).complete,false,'Missing observation evidence must not establish a run determination.');
cases.push({caseId:'unevidenced-run-remains-undetermined',actual:e.gate(13,unknown),stability:unknownStability,result:'PASS'});
const fault=load({file:'workflow-engine.js',before:'if(stage===13){\n    const iteration=latestIteration(project,[10])',after:'if(false){\n    const iteration=latestIteration(project,[10])'});
const mutant=fault.copy(serialized),mutantRow=fault.engine.recordsForIteration(mutant,'comparisons',iterationId)[0];
Object.assign(mutantRow.fields,{OUTPUT_VARIANCE:'Prohibited difference',AUTHORIZED_VARIANCE:'FALSE',CORRECTNESS_AFFECTING_VARIANCE:'TRUE',DEFECT_IDS:'DOES-NOT-EXIST'});Object.assign(mutantRow,mutantRow.fields);fault.engine.refreshRecordHashes(mutantRow,'comparisons');
assert.throws(()=>assert.equal(fault.engine.gate(13,mutant).complete,false,'COMPARISON_ORACLE: prohibited variance has no actual defect'),/COMPARISON_ORACLE/,'The permanent comparison oracle must detect the bypassed production gate.');
assert.equal(e.gate(13,copy(serialized)).complete,true);
cases.push({caseId:'bypassed-comparison-gate-mutant',result:'DETECTED',restored:'PASS'});
if(failures.length){console.error(JSON.stringify({failures},null,2));process.exitCode=1;}
console.log(JSON.stringify({crossRunComparison:failures.length?'FAIL':'PASS',stage:13,synthetic:true,actualBrowserJourney:false,productionRuntime:runtimeFiles,cases,failures}));

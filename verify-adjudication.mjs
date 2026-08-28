import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const engine=globalThis.closedLoopWorkflowEngine;
if(!engine)throw new Error('Semantic adjudication runtime failed to load.');
const assert=(value,message)=>{if(!value)throw new Error(message);};
const tmp=path.join(os.tmpdir(),`closed-loop-adjudication-${process.pid}.json`);
const lifecycle=spawnSync(process.execPath,['verify-full-cycle.mjs'],{cwd:process.cwd(),env:{...process.env,CLOSED_LOOP_PROJECT_OUT:tmp,TERM:'dumb'},encoding:'utf8',timeout:120000});
if(lifecycle.status!==0)throw new Error(`Full-cycle fixture failed before semantic mutations.\n${lifecycle.stdout}\n${lifecycle.stderr}`);
const baseline=JSON.parse(fs.readFileSync(tmp,'utf8'));fs.unlinkSync(tmp);engine.ensureShape(baseline);engine.recalculate(baseline);
assert(engine.releaseMetrics(baseline).determination==='ACCEPTED','Baseline semantic fixture is not releasable before mutations.');
const clone=()=>engine.clone(baseline),set=(record,key,value)=>{if(!record)throw new Error(`Missing record for ${key}`);record.fields={...(record.fields||{}),[key]:value};record[key]=value;},current=(p,c)=>engine.recordsForCurrentScope(p,c).at(-1),all=(p,c)=>engine.records(p,c);
const cases=[
 ['preflight unresolved defect',p=>set(current(p,'preflightRecords'),'FINDINGS','MATERIAL DEFECT REMAINS')],
 ['verification failed observation with favorable claim',p=>{const r=current(p,'verification');set(r,'OBSERVED_RESULT','FAILED');set(r,'DETERMINATION','SATISFIED');}],
 ['unchanged confirmation reports hash mismatch',p=>{const r=current(p,'confirmationRecords');set(r,'VERSION_HASH_COMPARISON','MISMATCH');set(r,'DETERMINATION','SATISFIED');}],
 ['production completed while reporting failure',p=>{const r=current(p,'products');set(r,'FAILURES','MATERIAL FAILURE');set(r,'STATUS','COMPLETED');}],
 ['deterministic result failed with favorable claim',p=>{const r=current(p,'deterministicResults');set(r,'ACTUAL_RESULT','FAILED');set(r,'DETERMINATION','SATISFIED');}],
 ['meaning comparison mismatches favorable claim',p=>{const r=current(p,'meaningResults');set(r,'EVIDENCE_BASED_COMPARISON','MISMATCH');set(r,'DETERMINATION','SATISFIED');}],
 ['adversarial attack finds material defect',p=>{const r=current(p,'adversarialResults');set(r,'ACTUAL_RESULT','MATERIAL_DEFECT_FOUND');set(r,'SEVERITY','MAJOR');set(r,'DETERMINATION','SATISFIED');}],
 ['representation observation finds material defect',p=>{const r=current(p,'representationInspections');set(r,'OBSERVATIONS','MATERIAL_DEFECT_FOUND');set(r,'DETERMINATION','SATISFIED');}],
 ['process audit reports unauthorized modification',p=>{const r=current(p,'processAudits');set(r,'UNAUTHORIZED_MODIFICATION','TRUE');set(r,'PROCESS_DETERMINATION','SATISFIED');}],
 ['product audit reports failed validators',p=>{const r=current(p,'productAudits');set(r,'VALIDATOR_RESULTS','FAILED');set(r,'PRODUCT_DETERMINATION','SATISFIED');}],
 ['regression execution fails after correction',p=>{const r=current(p,'regressionExecutions');set(r,'RESULT','FAILED');}],
 ['failure test accepts invalid fixture',p=>{const r=current(p,'failureTests');set(r,'EXECUTION_OUTCOME','ACCEPTED_INVALID');set(r,'ACTUAL_RESULT','Invalid fixture was accepted');set(r,'VALIDATOR_DEFECT_ID','');}],
 ['root cause loses earliest defective layer',p=>{const r=all(p,'rootCauses').find(engine.isActiveRecord);set(r,'EARLIEST_DEFECTIVE_LAYER','');}],
 ['changeset loses downstream invalidation',p=>{const r=all(p,'changes').find(engine.isActiveRecord);set(r,'DOWNSTREAM_INVALIDATION','');}]
];
const results=[];
for(const [name,mutate] of cases){const p=clone();mutate(p);const contradictions=engine.detectCurrentContradictions(p),release=engine.releaseMetrics(p);assert(release.determination!=='ACCEPTED',`${name}: contradictory current state still released ACCEPTED.`);results.push({name,release:release.determination,contradictions:contradictions.length});}
// Bare narrative alone may not establish an otherwise favorable result.
{
 const p=clone(),r=current(p,'deterministicResults');r.evidenceRefs=[];set(r,'EVIDENCE','looks good');const testId=String(engine.recordValue(r,'TEST_ID')||r.relationships?.TEST_ID||''),test=engine.recordsForCurrentScope(p,'tests').find(t=>engine.recordId(t,'tests')===testId),adjudication=engine.evaluateResultConsistency(p,'deterministicResults',r,test);assert(adjudication.determination!=='SATISFIED'&&!adjudication.evidence.sufficient,'Narrative-only deterministic evidence was treated as sufficient proof.');assert(engine.releaseMetrics(p).determination!=='ACCEPTED','Narrative-only deterministic evidence still released ACCEPTED.');
}
// Mandatory verifier independence must be application-established, not merely externally asserted.
{
 const p=clone(),r=current(p,'verification');set(r,'VERIFIER_CONTEXT_ID','UNREGISTERED-EXTERNAL-CONTEXT');set(r,'INDEPENDENCE_STATUS','INDEPENDENT');const iterationId=String(r.scope?.iterationId||p.job.CURRENT_ITERATION||''),runId=String(engine.recordValue(r,'RUN_ID')||r.relationships?.RUN_ID||''),testId=String(engine.recordValue(r,'TEST_ID')||r.relationships?.TEST_ID||''),test=engine.recordsForCurrentScope(p,'tests').find(t=>engine.recordId(t,'tests')===testId),independence=engine.evaluateContextIndependence(p,{role:'VERIFICATION',iterationId,runId,verifierContextId:'UNREGISTERED-EXTERNAL-CONTEXT'});assert(independence.determination==='EXTERNALLY_SUPPORTED','Unregistered external verifier should remain externally supported rather than falsely application-established.');const matrix=engine.verificationMatrix(p,iterationId);assert(matrix.invalid.some(item=>item===r)||matrix.invalid.length>0,'Mandatory verification matrix accepted an unregistered verifier context.');assert(engine.evaluateResultConsistency(p,'verification',r,test).determination==='SATISFIED','Independence mutation unexpectedly changed semantic result adjudication.');assert(engine.releaseMetrics(p).determination!=='ACCEPTED','Externally-supported-only mandatory verifier identity still released ACCEPTED.');
}
console.log(JSON.stringify({semanticFalseAcceptanceCases:cases.length,narrativeOnlyEvidenceRejected:true,mandatoryIndependenceRequiresApplicationEstablishment:true,results},null,2));

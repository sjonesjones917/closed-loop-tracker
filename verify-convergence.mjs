import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
assert(core&&schema&&engine,'Stage 21 convergence verifier could not load runtime authorities.');
assert.equal(typeof engine.closedMetricFromUniverse,'function','Runtime closed-metric evaluator is missing.');
assert.equal(typeof engine.recordConvergenceDetermination,'function','Application-owned Stage 18 convergence command is missing.');

function record(collection,id,stage,fields,scope={}){
  const definition=schema.RECORD_SCHEMAS[collection];
  assert(definition,`Missing schema for ${collection}.`);
  const all={...fields,[definition.idField]:id};
  const row={id,stage,active:true,scope:{...scope},fields:all,...all};
  engine.refreshRecordHashes(row,collection);
  return row;
}

const p=core.createBlankState('JOB-STAGE21-CONVERGENCE');
Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Verify application-owned non-vacuous convergence.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'});
engine.ensureShape(p);
const scope=engine.currentScope(p);

// Intentional invalid fixture: an empty denominator cannot manufacture 100%.
let metric=engine.closedMetricFromUniverse(p,{metricId:'stage18.regressionSuccess',universeDefinition:'Current applicable due PREPRODUCT_ITERATION regressions at Stage 18.',universeIds:[],includedIds:[],scopeRule:scope});
assert.equal(metric.denominator,0,'Empty-universe fixture did not create a zero denominator.');
assert.equal(metric.disposition,'BLOCKED','Unreviewed empty regression universe did not fail closed.');
assert.equal(metric.value,null,'Unreviewed empty regression universe manufactured a percentage.');

// Repaired fixture: only a current evidence-backed independent semantic review may establish EMPTY_UNIVERSE.
const evidence=record('evidenceRecords','EVIDENCE-EMPTY-REGRESSION',18,{KIND:'APPLICATION_RECORD_SET',AUTHORITY_TYPE:'APPLICATION',DESCRIPTION:'The current applicable due PREPRODUCT_ITERATION regression universe is empty.',CONTENT:'Closed application-derived regression inventory contains zero current applicable due entries.',STATUS:'PRESERVED'},scope);
p.projectData.evidenceRecords.push(evidence);
const review=record('semanticReviews','SEMANTIC-EMPTY-REGRESSION',18,{REVIEWED_RECORD_IDS:[],REVIEWED_HASHES:[],AUTHOR_CONTEXT_ID:'CONTEXT-EMPTY-AUTHOR',REVIEWER_CONTEXT_ID:'CONTEXT-EMPTY-REVIEWER',AUTHOR_RESERVATION_ID:'RESERVATION-EMPTY-AUTHOR',REVIEWER_RESERVATION_ID:'RESERVATION-EMPTY-REVIEWER',INDEPENDENCE_DETERMINATION:'APPLICATION_ESTABLISHED',REVIEW_QUESTION:'EMPTY_UNIVERSE:stage18.regressionSuccess',FINDING:'Independent review confirms the closed current applicable due regression universe is empty.',REASONING:'Reviewed the application-derived closed universe and its current scope.',RESULT:'ACCEPTED',ACCEPTED_DISPOSITION:'EMPTY_UNIVERSE',RECONCILIATION_STATUS:'NOT_REQUIRED',GATE_EFFECT:'ALLOW_IF_OTHER_GATES_PASS'},scope);
review.evidenceRefs=[evidence.id];
p.projectData.semanticReviews.push(review);
metric=engine.closedMetricFromUniverse(p,{metricId:'stage18.regressionSuccess',universeDefinition:'Current applicable due PREPRODUCT_ITERATION regressions at Stage 18.',universeIds:[],includedIds:[],scopeRule:scope});
assert.equal(metric.disposition,'SATISFIED','Accepted independent EMPTY_UNIVERSE review did not permit the zero-denominator metric.');
assert.equal(metric.value,1,'Reviewed empty universe did not produce the permitted satisfied metric value.');
assert(metric.evidenceReferences.includes('SEMANTIC-EMPTY-REGRESSION')&&metric.evidenceReferences.includes('EVIDENCE-EMPTY-REGRESSION'),'Closed metric omitted its accepted review/evidence identities.');

// Stage 18 COMPLETE is application-owned. A gate may fail for real convergence reasons, but never because no external DATA_PROPOSAL was accepted.
p.stages[17].status='COMPLETE';
p.stages[17].gate={complete:true,blocked:false,reasons:[]};
let g=engine.gate(18,p);
assert(!g.reasons.some(reason=>/No validated agent response has been accepted/i.test(String(reason))),'Stage 18 still requires an artificial external-agent acceptance.');

// Application calculation is explicit, canonical, and idempotent even when its determination is BLOCKED/not converged.
const first=engine.recordConvergenceDetermination(p);
const second=engine.recordConvergenceDetermination(p);
assert.equal(engine.recordId(first,'convergenceRecords'),engine.recordId(second,'convergenceRecords'),'Exact convergence recalculation created a duplicate current determination.');
assert.equal(engine.records(p,'convergenceRecords').length,1,'Application convergence command created duplicate canonical convergence records.');
assert.equal(first.source,'APPLICATION_DERIVATION','Convergence record is not application-owned.');

// The repaired runtime must still execute the repository's complete synthetic lifecycle; Stage 18 in that lifecycle now uses the application command.
await import('./verify-full-cycle.mjs');

console.log(JSON.stringify({controllerStage:'21',applicationStage:'18',convergence:'PASS',intentionalInvalidFixturesRejected:['unreviewed-empty-regression-universe','artificial-agent-acceptance-for-application-command'],repairedPathProgressed:true,isolatedDisposableProject:true}));

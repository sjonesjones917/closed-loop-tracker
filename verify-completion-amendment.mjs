import fs from 'node:fs';
import vm from 'node:vm';

const assert=(ok,message)=>{if(!ok)throw new Error(message);};
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
assert(schema?.PROJECT_SCHEMA==='closed-loop-project/3','Completion amendment must remain in closed-loop-project/3.');
assert(schema?.RESPONSE_SCHEMA==='closed-loop-stage-response/3','Completion amendment must remain in closed-loop-stage-response/3.');
assert(globalThis.closedLoopCore?.STAGE_COUNT===30,'Completion amendment must not add a stage.');

const requiredFamilies={
  propositions:{stage:4,policy:'REPLACE_CURRENT_STAGE_SET',id:'PROPOSITION_ID'},
  propositionEquivalenceReviews:{stage:5,policy:'APPEND_SCOPED',id:'PROP_EQ_REVIEW_ID'},
  applicabilityRecords:{stage:5,policy:'APPEND_SCOPED',id:'APPLICABILITY_ID'},
  proofExpressions:{stage:6,policy:'REPLACE_CURRENT_STAGE_SET',id:'PROOF_EXPRESSION_ID'},
  proofObligations:{stage:6,policy:'APPLICATION_DERIVED',id:'PROOF_OBLIGATION_ID'},
  observationRecords:{stage:null,policy:'APPEND_SCOPED',id:'OBSERVATION_ID'},
  entailmentReviews:{stage:null,policy:'APPEND_SCOPED',id:'ENTAILMENT_ID'},
  environmentDependencies:{stage:null,policy:'APPEND_SCOPED',id:'DEPENDENCY_ID'},
  operationReservations:{stage:null,policy:'UPDATE_RESERVED',id:'OPERATION_RESERVATION_ID'},
  deliveryRecords:{stage:30,policy:'APPLICATION_DERIVED',id:'DELIVERY_ID'},
  deploymentManifests:{stage:null,policy:'APPEND_ONLY',id:'DEPLOYMENT_MANIFEST_ID'}
};
for(const [name,expected] of Object.entries(requiredFamilies)){
  const family=schema?.RECORD_SCHEMAS?.[name];
  assert(family,`Section 68 canonical family missing: ${name}`);
  assert(family.idField===expected.id,`${name} must use ${expected.id}.`);
  assert(family.commitPolicy===expected.policy,`${name} must use ${expected.policy}.`);
  assert((family.stage??null)===expected.stage,`${name} has wrong responsible stage.`);
}

for(const token of ['TRUE','FALSE','UNKNOWN'])assert(schema?.TRUTH_VALUES?.includes(token),`Truth model missing ${token}.`);
for(const token of ['APPLICATION_OBSERVED','VERIFIED_EXTERNAL','EXTERNALLY_SUPPORTED','SELF_ASSERTED','NONE'])assert(schema?.EPISTEMIC_BASES?.includes(token),`Epistemic model missing ${token}.`);
for(const token of ['APPLICABLE','NOT_APPLICABLE','UNKNOWN'])assert(schema?.APPLICABILITY_VALUES?.includes(token),`Applicability model missing ${token}.`);
for(const token of ['ESTABLISHES','REFUTES','SUPPORTS_ONLY','CONTEXT_ONLY','DOES_NOT_ADDRESS','UNKNOWN'])assert(schema?.ENTAILMENT_VALUES?.includes(token),`Entailment model missing ${token}.`);
for(const token of ['LEAF','ALL_OF','ANY_OF','AT_LEAST_K'])assert(schema?.PROOF_EXPRESSION_OPERATORS?.includes(token),`Proof-expression language missing ${token}.`);

assert(typeof engine?.evaluateProofExpression==='function','workflow-engine.js must own deterministic proof-expression evaluation.');
assert(typeof engine?.deriveProofObligations==='function','workflow-engine.js must derive the current proof-obligation registry.');
assert(typeof engine?.evaluatePropositionState==='function','workflow-engine.js must derive proposition truth with UNKNOWN fail-closed semantics.');
assert(typeof engine?.deriveRequiredVerificationRelationSet==='function','workflow-engine.js must derive the Stage 12 required relation set M.');
assert(typeof engine?.deriveTerminalDeliveryRecord==='function','workflow-engine.js must derive final Stage 30 delivery authorization.');
assert(typeof engine?.responsibleStageForMutation==='function','workflow-engine.js must own one responsible-stage invalidation map.');

const html=fs.readFileSync('index.html','utf8');
assert(!/Stage\s*31|Operation\s*31/i.test(html),'Completion amendment must not add Stage or Operation 31.');
const app=fs.readFileSync('app-core.js','utf8');
for(const text of ['eligible for final delivery checks','delivery is not yet authorized'])assert(app.toLowerCase().includes(text),`Operator terminal-state wording missing: ${text}`);

console.log(JSON.stringify({completionAmendment:'PASS',stageCount:30,canonicalFamilies:Object.keys(requiredFamilies).length,truthModel:true,proofObligationModel:true,terminalDeliveryModel:true},null,2));

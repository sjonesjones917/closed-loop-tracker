import fs from 'node:fs';
import vm from 'node:vm';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine;
const assert=(v,m)=>{if(!v)throw new Error(m);};
const project=()=>{const p=core.createBlankState('JOB-ADJUDICATION');p.job.JOB_ID='JOB-ADJUDICATION';p.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(p);return p;};
const rec=(collection,fields,id=`${schema.RECORD_SCHEMAS[collection].prefix}-ADJ`)=>({id,stage:schema.RECORD_SCHEMAS[collection].stage,active:true,fields:{...fields,[schema.RECORD_SCHEMAS[collection].idField]:id},...fields,[schema.RECORD_SCHEMAS[collection].idField]:id,evidenceRefs:['EVIDENCE-ADJ']});
const p=project();
Object.assign(p.job,{CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'});
const currentScope=engine.currentScope(p);
p.projectData.evidenceRecords.push(rec('evidenceRecords',{KIND:'EXECUTION_REPORT',DESCRIPTION:'Controlled adjudication evidence',AUTHORITY_TYPE:'EXTERNAL_AGENT',LOCATION:'verify-adjudication.mjs',CONTENT:'Observed controlled result',STATUS:'PRESERVED'},'EVIDENCE-ADJ'));
const cases=[
  ['verification',rec('verification',{VERIFIER:'reviewer',VERIFIER_CONTEXT_ID:'CONTEXT-V',INDEPENDENCE_STATUS:'INDEPENDENT',INPUTS:'RUN-X',PROCEDURE:'verify',EXPECTED_RESULT:'SATISFIED',OBSERVED_RESULT:'FAILED',EXACT_EVIDENCE:'EVIDENCE-ADJ',DETERMINATION:'SATISFIED',REQ_ID:'REQ-X',RUN_ID:'RUN-X',TEST_ID:'TEST-X'},'VERIFICATION-ADJ')],
  ['deterministicResults',rec('deterministicResults',{PRODUCT_ID:'PRODUCT-X',TEST_ID:'TEST-X',TOOL_AND_VERSION:'tool 1',PROCEDURE:'run',EXPECTED_RESULT:'SATISFIED',ACTUAL_RESULT:'FAILED',DETERMINATION:'SATISFIED',EVIDENCE:'EVIDENCE-ADJ'},'DETERMINISTIC-ADJ')],
  ['meaningResults',rec('meaningResults',{REQ_ID:'REQ-X',TEST_ID:'TEST-X',PRODUCT_ID:'PRODUCT-X',PRODUCT_LOCATION:'section 1',EXTERNAL_SOURCE_EVIDENCE:'source',REQUIRED_MEANING:'A',OBSERVED_MEANING:'B',EVIDENCE_BASED_COMPARISON:'MISMATCH',DETERMINATION:'SATISFIED'},'MEANING-ADJ')],
  ['adversarialResults',rec('adversarialResults',{PRODUCT_ID:'PRODUCT-X',TEST_ID:'TEST-X',ATTACK:'attack',METHOD:'method',EXPECTED_BEHAVIOR:'SATISFIED',ACTUAL_RESULT:'FAILED',DETERMINATION:'SATISFIED',SEVERITY:'MAJOR',EVIDENCE:'EVIDENCE-ADJ'},'ATTACK-ADJ')],
  ['representationInspections',rec('representationInspections',{ARTIFACT_ID:'ARTIFACT-X',REQUIRED_BY_TRACE:'REQ-X',TRANSFORMATION_CHAIN:'none',TRANSFORMATION_TOOLS_VERSIONS:'none',RENDERING_OPENING_EVIDENCE:'opened',OBSERVATIONS:'DEFECT FOUND',DETERMINATION:'SATISFIED',EVIDENCE:'EVIDENCE-ADJ'},'INSPECTION-ADJ')],
  ['preflightRecords',rec('preflightRecords',{INSTRUCTION_ID:'INSTRUCTION-X',CLAUSE:'clause',INTERNAL_CONFLICTS:'TRUE',FINDINGS:'MATERIAL CONFLICT',DETERMINATION:'SATISFIED',EVIDENCE:'EVIDENCE-ADJ'},'PREFLIGHT-ADJ')],
  ['processAudits',rec('processAudits',{APPROVED_INPUTS_VS_ACTUAL:'MISMATCH',APPROVED_INSTRUCTION_VS_ACTUAL:'MATCH',APPROVED_TOOLS_VS_ACTUAL:'MATCH',REQUIRED_TESTS_VS_EXECUTED:'MATCH',UNAUTHORIZED_MODIFICATION:'NONE',AUTHORIZED_CHANGES:'NONE',CHAIN_OF_CUSTODY:'SATISFIED',PROCESS_DEFECTS:'NONE',BLOCKERS:'NONE',PROCESS_DETERMINATION:'SATISFIED',PROCESS_EVIDENCE:'EVIDENCE-ADJ'},'PROCESS-AUDIT-ADJ')],
  ['productAudits',rec('productAudits',{VALIDATOR_RESULTS:'FAILED',MEANING_VERIFICATION_RESULTS:'SATISFIED',PRODUCT_DEFECTS:'NONE',BLOCKERS:'NONE',PRODUCT_DETERMINATION:'SATISFIED',PRODUCT_EVIDENCE:'EVIDENCE-ADJ'},'PRODUCT-AUDIT-ADJ')],
  ['products',rec('products',{BASELINE_ID:'BASELINE-X',PRODUCTION_CONTEXT_ID:'CONTEXT-X',BASELINE_MATERIALS:['A'],EXECUTION_TIMESTAMPS:{},TOOL_CONFIGURATION:'tool',DEVIATIONS:'NONE',FAILURES:'FATAL FAILURE',GENERATED_ARTIFACT_INVENTORY:['ARTIFACT-X'],STATUS:'COMPLETED'},'PRODUCT-ADJ')],
  ['regressionExecutions',rec('regressionExecutions',{REG_ID:'REG-X',PHASE:'POST_CORRECTION',RESULT:'FAILED',EVIDENCE_ID:'EVIDENCE-ADJ'},'REG-EXEC-ADJ')],
  ['confirmationRecords',rec('confirmationRecords',{SOURCE_ITERATION_ID:'ITERATION-A',CONFIRMATION_ITERATION_ID:'ITERATION-B',DETERMINATION:'SATISFIED',EVIDENCE:'EVIDENCE-ADJ'},'CONFIRMATION-ADJ')]
];
for(const [collection,record] of cases){record.scope={...currentScope};p.projectData[collection].push(record);const e=engine.evaluateResultConsistency(p,collection,record);assert(e.determination!=='SATISFIED',`${collection} contradictory favorable claim remained SATISFIED.`);}
const contradictions=engine.detectCurrentContradictions(p);
assert(contradictions.length>0,'Central contradiction detector emitted no contradictions for contradictory current records.');
assert(schema.RECORD_SCHEMAS.failureTests.fieldDefinitions.EXECUTION_OUTCOME.enumValues.join('|')==='REJECTED_INVALID|ACCEPTED_INVALID|UNDETERMINED|NOT_RUN','Stage 07 execution outcome is not a controlled enum.');
for(const [collection,field] of [['comparisons','RUN_DETERMINATIONS'],['comparisons','CORRECTNESS_AFFECTING_VARIANCE'],['confirmationRecords','DETERMINATION'],['processAudits','PROCESS_DETERMINATION'],['productAudits','PRODUCT_DETERMINATION']])assert(schema.RECORD_SCHEMAS[collection].fieldDefinitions[field].producer===schema.PRODUCER.APPLICATION,`${collection}.${field} is not application-owned.`);
const engineSource=fs.readFileSync('workflow-engine.js','utf8');
assert(engineSource.includes('effectiveDetermination(project'), 'Gates/release do not route through effectiveDetermination.');
assert(engineSource.includes('evaluateEvidenceContract(')&&engineSource.includes('validateTraceIntegrity('),'Central adjudication boundaries are missing.');

// Trace-integrity mutations: presence alone must never satisfy RCA/change gates.
const traceProject=project();
Object.assign(traceProject.job,{CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001'});
const defect=rec('defects',{REQ_ID:'REQ-TRACE',OBSERVED_FAILURE:'Observed failure',EXPECTED_CONDITION:'Expected condition',EVIDENCE:'EVIDENCE-TRACE',SEVERITY:'MAJOR',STATUS:'CONFIRMED'},'DEFECT-TRACE');
defect.scope={...engine.currentScope(traceProject),iterationId:'ITERATION-TRACE'};
traceProject.projectData.defects.push(defect);
const badRca=rec('rootCauses',{DEFECT_ID:'DEFECT-TRACE',CATEGORY:'INSTRUCTION',LAYER_TRACE:'instruction -> execution',EARLIEST_DEFECTIVE_LAYER:'INSTRUCTION',ROOT_CAUSE:'Missing control',EVIDENCE:'',DOWNSTREAM_INVALIDATION:''},'RCA-TRACE-BAD');
badRca.scope={...defect.scope};
traceProject.projectData.rootCauses.push(badRca);
assert(engine.validateRootCauseRecord(traceProject,badRca).valid===false,'Incomplete RCA incorrectly satisfied trace integrity.');
const goodRca=rec('rootCauses',{DEFECT_ID:'DEFECT-TRACE',CATEGORY:'INSTRUCTION',LAYER_TRACE:'instruction -> execution',EARLIEST_DEFECTIVE_LAYER:'INSTRUCTION',ROOT_CAUSE:'Missing control',EVIDENCE:'EVIDENCE-TRACE',DOWNSTREAM_INVALIDATION:'Stages 16-30'},'RCA-TRACE-GOOD');
goodRca.scope={...defect.scope};
traceProject.projectData.rootCauses.push(goodRca);
assert(engine.validateRootCauseRecord(traceProject,goodRca).valid===true,'Complete RCA was rejected by trace integrity.');
const badChange=rec('changes',{TRIGGERING_DEFECT_IDS:['DEFECT-TRACE'],ROOT_CAUSE_ANALYSIS:'RCA-TRACE-GOOD',RESPONSIBLE_LAYER:'TEST',OLD_ARTIFACT_VERSION:'v1',EXACT_MODIFICATION:'Correct instruction',NEW_ARTIFACT_VERSION:'v2',DOWNSTREAM_INVALIDATION:'Stages 17-30',REQUIRED_RERUNS:'Stages 17-19',INSTRUCTION_CHANGE_DETERMINATION:'CHANGED',JUSTIFIED_UNCHANGED_ARTIFACTS:'NONE',EVIDENCE:'EVIDENCE-TRACE'},'CHANGESET-TRACE-BAD');
badChange.scope={...defect.scope};
traceProject.projectData.changes.push(badChange);
assert(engine.validateChangeTrace(traceProject,badChange).valid===false,'Responsible-layer mismatch incorrectly satisfied change trace.');
const goodChange=JSON.parse(JSON.stringify(badChange));
goodChange.id=goodChange.CHANGESET_ID=goodChange.fields.CHANGESET_ID='CHANGESET-TRACE-GOOD';
goodChange.fields.RESPONSIBLE_LAYER=goodChange.RESPONSIBLE_LAYER='INSTRUCTION';
assert(engine.validateChangeTrace(traceProject,goodChange).valid===true,'Correct RCA-to-change trace was rejected.');

console.log(JSON.stringify({tableDrivenFalseAcceptanceCases:cases.length,contradictions:contradictions.length,traceIntegrityNegativeCases:2,centralEffectiveDetermination:true,stage7ControlledOutcome:true,applicationOwnedConclusions:true},null,2));

import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,schema=globalThis.closedLoopWorkflowSchema;
const assert=(v,m)=>{if(!v)throw new Error(m);};
const clone=v=>JSON.parse(JSON.stringify(v));

const base=core.createBlankState('JOB-ADJUDICATION-INVARIANT');
engine.ensureShape(base);
base.job.CURRENT_INPUT_VERSION='INPUT-v001';

let seq=0;
function canonical(collection,stage,fields={},extra={}){
  const d=schema.RECORD_SCHEMAS[collection];
  const id=`${d.prefix}-INV-${String(++seq).padStart(3,'0')}`;
  return {id,stage,active:true,scope:{inputVersion:'INPUT-v001'},fields:{[d.idField]:id,...fields},...extra};
}
function addEvidence(project){
  const e=canonical('evidenceRecords',22,{KIND:'EXECUTION_RECEIPT',AUTHORITY_TYPE:'APPLICATION_OBSERVED',CONTENT:'controlled observed result',DESCRIPTION:'canonical invariant evidence',LOCATION:'invariant'});
  project.projectData.evidenceRecords.push(e);
  return e.id;
}
function withEvidence(record,evidenceId){record.evidenceRefs=[evidenceId];return record;}

// Structural evidence contract: prose is supplemental only.
{
  const p=clone(base),r=canonical('deterministicResults',22,{DETERMINATION:'SATISFIED',ACTUAL_RESULT:'PASSED',EVIDENCE:'x'});
  assert(engine.evaluateEvidenceContract(null,r,null,p).sufficient===false,'bare narrative evidence established sufficiency');
  assert(engine.effectiveDetermination('deterministicResults',r,null,p)!=='SATISFIED','bare narrative evidence established SATISFIED');
}

// Controlled Stage 7 outcome is application-evaluated, not prose-parsed.
{
  const p=clone(base),eid=addEvidence(p);
  const rejected=withEvidence(canonical('failureTests',7,{ACTUAL_RESULT:'INVALID FIXTURE REJECTED',EXECUTION_OUTCOME:'REJECTED_INVALID',EVIDENCE:'supplemental'}),eid);
  const accepted=withEvidence(canonical('failureTests',7,{ACTUAL_RESULT:'INVALID FIXTURE ACCEPTED',EXECUTION_OUTCOME:'ACCEPTED_INVALID',EVIDENCE:'supplemental'}),eid);
  assert(engine.effectiveDetermination('failureTests',rejected,null,p)==='SATISFIED','REJECTED_INVALID did not derive SATISFIED with canonical evidence');
  assert(engine.effectiveDetermination('failureTests',accepted,null,p)==='VIOLATED','ACCEPTED_INVALID did not derive VIOLATED');
}

const cases=[
  ['preflightRecords',9,{DETERMINATION:'SATISFIED',MULTIPLE_INTERPRETATIONS:'TRUE',OBJECTIVELY_VERIFIABLE:'TRUE',RESPONSIBLE_OPERATION_ASSIGNED:'TRUE',ORDER_CLEAR:'TRUE',FAILURE_BEHAVIOR_DEFINED:'TRUE',TRACEABILITY:'TRUE'}],
  ['verification',12,{DETERMINATION:'SATISFIED',OBSERVED_RESULT:'FAILED'}],
  ['confirmationRecords',19,{DETERMINATION:'SATISFIED',NEW_DEFECTS:'TRUE'}],
  ['products',21,{STATUS:'COMPLETED',FAILURES:'FAILED'}, {completionState:'COMPLETED'}],
  ['deterministicResults',22,{DETERMINATION:'SATISFIED',ACTUAL_RESULT:'FAILED'}],
  ['meaningResults',23,{DETERMINATION:'SATISFIED',EVIDENCE_BASED_COMPARISON:'FAILED',OBSERVED_MEANING:'wrong',REQUIRED_MEANING:'right'}],
  ['adversarialResults',24,{DETERMINATION:'SATISFIED',ACTUAL_RESULT:'FAILED',SEVERITY:'MAJOR'}],
  ['representationInspections',25,{DETERMINATION:'SATISFIED',DEFECT_ID:'DEFECT-INVARIANT',OBSERVATIONS:'FAILED'}],
  ['processAudits',26,{PROCESS_DETERMINATION:'SATISFIED',UNAUTHORIZED_MODIFICATION:'TRUE',APPROVED_INPUTS_VS_ACTUAL:'MATCH',APPROVED_INSTRUCTION_VS_ACTUAL:'MATCH',APPROVED_TOOLS_VS_ACTUAL:'MATCH',REQUIRED_TESTS_VS_EXECUTED:'MATCH',CHAIN_OF_CUSTODY:'INTACT'}],
  ['productAudits',26,{PRODUCT_DETERMINATION:'SATISFIED',CRITICAL_DEFECTS:1,MAJOR_DEFECTS:0,MANDATORY_UNKNOWNS:0,VALIDATOR_RESULTS:'PASSED',MEANING_VERIFICATION_RESULTS:'PASSED'}],
  ['regressionExecutions',30,{RESULT:'FAILED',PHASE:'POST_CORRECTION',REG_ID:'REG-INVARIANT'}]
];
const stageFor={preflightRecords:9,verification:12,confirmationRecords:19,products:21,deterministicResults:22,meaningResults:23,adversarialResults:24,representationInspections:25,processAudits:26,productAudits:26,regressionExecutions:30};
let rejected=0;
for(const [collection,stage,fields,extra={}] of cases){
  const p=clone(base),eid=addEvidence(p),r=withEvidence(canonical(collection,stage,fields,extra),eid);
  p.projectData[collection].push(r);
  const effective=engine.effectiveDetermination(collection,r,null,p);
  const stageGate=engine.gate(stageFor[collection],p);
  const release=engine.releaseMetrics(p);
  assert(effective!=='SATISFIED'||stageGate.complete===false||release.determination!=='ACCEPTED',`${collection}: contradictory favorable record escaped all fail-closed barriers`);
  assert(release.determination!=='ACCEPTED',`${collection}: contradictory favorable record allowed release ACCEPTED`);
  rejected++;
}

// Within-record contradiction detection must delegate to effective adjudication.
{
  const p=clone(base),eid=addEvidence(p),r=withEvidence(canonical('deterministicResults',22,{DETERMINATION:'SATISFIED',ACTUAL_RESULT:'FAILED'}),eid);
  p.projectData.deterministicResults.push(r);
  const contradictions=engine.detectCurrentContradictions(p);
  assert(contradictions.some(x=>x.type==='CLAIMED_FAVORABLE_EFFECTIVE_CONFLICT'),'failed observation + favorable claim was not emitted as a contradiction');
}

assert(engine.applicationTestCapabilities().length===0,'native executor registry was broadened without an implemented executor');
const source=fs.readFileSync('workflow-engine.js','utf8');
assert(!source.includes("['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue("),'external favorable regression RESULT shortcut remains');
assert(!/\bsemantic\b/i.test(source),'unchanged acceptance suite terminology invariant would fail');
for(const token of ['evaluateEvidenceContract','evaluateResultConsistency','effectiveDetermination','validateTraceIntegrity','effectiveRegressionDetermination'])assert(source.includes(token),`missing central adjudication token ${token}`);
const schemaSource=fs.readFileSync('workflow-schema.js','utf8');
assert(schemaSource.includes('EXECUTION_OUTCOME'),'Stage 7 controlled outcome is absent from schema');
for(const v of ['REJECTED_INVALID','ACCEPTED_INVALID','UNDETERMINED','NOT_RUN'])assert(schemaSource.includes(v),`Stage 7 enum lacks ${v}`);

console.log(JSON.stringify({applicationOwnedAdjudication:true,contradictoryFavorableCasesRejected:rejected,bareNarrativeRejected:true,stage7ControlledOutcome:true,contradictionDelegation:true,nativeExecutorRegistryStillEmpty:true},null,2));

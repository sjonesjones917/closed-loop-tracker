import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const assert=(value,message)=>{if(!value)throw new Error(message);};
const clone=value=>JSON.parse(JSON.stringify(value));
const CURRENT_SCOPE=Object.freeze({inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TEST-SUITE-v001',instructionVersion:'INSTRUCTION-v001'});
function record(collection,stage,fields,id,scope=CURRENT_SCOPE){const definition=schema.RECORD_SCHEMAS[collection],all={...fields,[definition.idField]:id},value={id,stage,active:true,scope:{...scope},fields:all,...all};engine.refreshRecordHashes(value,collection);return value;}
function baseProject(){
  const p=core.createBlankState('JOB-STAGE18-RCA-REGRESSION');
  Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Prove current-scope root cause closure and permanent pre-correction regression execution.',CURRENT_INPUT_VERSION:CURRENT_SCOPE.inputVersion,CURRENT_SOURCE_SET_VERSION:CURRENT_SCOPE.sourceSetVersion,CURRENT_REQUIREMENTS_VERSION:CURRENT_SCOPE.requirementsVersion,CURRENT_TEST_SUITE_VERSION:CURRENT_SCOPE.testSuiteVersion,CURRENT_INSTRUCTION_VERSION:CURRENT_SCOPE.instructionVersion});
  engine.ensureShape(p);
  for(let stage=1;stage<=13;stage++){p.stages[stage].status='COMPLETE';p.stages[stage].gate={complete:true,blocked:false,reasons:[]};}
  p.projectData.acceptedChanges.push({changeId:'CHANGE-STAGE18-RCA',stage:14,status:'COMMITTED',responseType:'DATA_PROPOSAL',scope:{...CURRENT_SCOPE}});
  const defect=record('defects',14,{REQ_ID:'REQ-STAGE18',OBSERVED_FAILURE:'The current candidate exhibits a confirmed material failure.',EXPECTED_CONDITION:'The controlled proposition is satisfied.',EVIDENCE:'Preserved Stage 13 comparison and verification evidence.',SEVERITY:'MAJOR',STATUS:'CONFIRMED'},'DEFECT-STAGE18');
  p.projectData.defects.push(defect);
  return {p,defect};
}
function rootCause(scope=CURRENT_SCOPE,overrides={}){return record('rootCauses',14,{DEFECT_ID:'DEFECT-STAGE18',CATEGORY:'INSTRUCTION',LAYER_TRACE:'User input -> source/research -> requirement -> instruction -> execution -> observed output',EARLIEST_DEFECTIVE_LAYER:'INSTRUCTION',ROOT_CAUSE:'The production instruction first introduced the behavior that caused the preserved material failure.',EVIDENCE:'Backward trace over preserved canonical Stage 13 comparison, verification, instruction, requirement, research, source, run, and artifact evidence.',DOWNSTREAM_INVALIDATION:'Stage 15 regression definition/execution and Stage 16 correction are required before any corrected rerun.',...overrides},'RCA-STAGE18',scope);}
function withCurrentRca(){const base=baseProject();base.p.projectData.rootCauses.push(rootCause());return base;}
function addRegression(p,{result='VIOLATED',withExecution=true,withEvidence=true}={}){
  p.stages[14].status='COMPLETE';p.stages[14].gate={complete:true,blocked:false,reasons:[]};
  p.projectData.acceptedChanges.push({changeId:'CHANGE-STAGE18-REGRESSION',stage:15,status:'COMMITTED',responseType:'DATA_PROPOSAL',scope:{...CURRENT_SCOPE}});
  const regression=record('regressions',15,{DEFECT_ID:'DEFECT-STAGE18',REQ_ID:'REQ-STAGE18',FAILURE_FIXTURE:'fixture://stage18/confirmed-material-failure-v1',FIXTURE_IDENTITY_HASH:'sha256:'+'a'.repeat(64),REPRODUCTION_PROCEDURE:'Run the preserved failing fixture against the exact pre-correction candidate and evaluate the controlled failure condition.',DETECTION_METHOD:'Compare the controlled observed result with the mandatory expected condition.',PRE_CORRECTION_RESULT:'VIOLATED',PRE_CORRECTION_EVIDENCE:'EVIDENCE-STAGE18-PRE',CORRECTION:'Stage 16 must correct the earliest defective instruction layer; Stage 15 does not claim correction success.',POST_CORRECTION_RESULT:'',POST_CORRECTION_EVIDENCE:'',PERMANENT_TEST_LOCATION:'verification/regressions/stage18-confirmed-material-failure',APPLICABILITY:'APPLICABLE',ACTIVE_RETIRED_STATE:'ACTIVE',RETIREMENT_AUTHORITY:'NONE'},'REG-STAGE18');
  p.projectData.regressions.push(regression);
  let evidence=null,execution=null;
  if(withEvidence){evidence=record('evidenceRecords',15,{KIND:'REGRESSION_EXECUTION',AUTHORITY_TYPE:'APPLICATION',DESCRIPTION:'Actual pre-correction regression execution observation.',CONTENT:'The preserved fixture executed against the pre-correction candidate and reproduced the controlled failure.',STATUS:'PRESERVED'},'EVIDENCE-STAGE18-PRE');p.projectData.evidenceRecords.push(evidence);}
  if(withExecution){execution=record('regressionExecutions',15,{REG_ID:'REG-STAGE18',PHASE:'PRE_CORRECTION',RESULT:result},'REG-EXEC-STAGE18-PRE');if(withEvidence)execution.evidenceRefs=['EVIDENCE-STAGE18-PRE'];p.projectData.regressionExecutions.push(execution);}
  return {regression,evidence,execution};
}

// Stage 14 positive: exactly one complete current-scope RCA closes the current material defect.
{
  const {p}=withCurrentRca();
  const gate=engine.gate(14,p);assert(gate.complete,`Current-scope Stage 14 RCA did not close: ${gate.reasons.join(' | ')}`);
  const derived=engine.deriveStageData(p,14);assert(derived.TOTAL_MATERIAL_DEFECTS===1&&derived.DEFECT_ROOT_CAUSE_RECORDS===1,'Stage 14 derived counts are not exact.');assert(derived.CONFIRMED_ROOT_CAUSES.length===1&&derived.CONFIRMED_ROOT_CAUSES[0]==='DEFECT-STAGE18','Stage 14 did not derive the confirmed current RCA.');assert(derived.UNDETERMINED_ROOT_CAUSES.length===0&&derived.BLOCKED_ANALYSES.length===0,'Positive current RCA remained undetermined or blocked.');
}
// Historical/stale RCA must not satisfy a current gate. This is the permanent regression for the Stage 18 scope defect.
{
  const {p}=baseProject();const stale={...CURRENT_SCOPE,instructionVersion:'INSTRUCTION-v000'};p.projectData.rootCauses.push(rootCause(stale));
  const gate=engine.gate(14,p);assert(!gate.complete&&gate.blocked,'A stale out-of-current-scope RCA incorrectly satisfied Stage 14.');assert(gate.reasons.some(reason=>reason.includes('Root-cause analysis is missing')||reason.includes('Exactly one complete RCA')),'Stale RCA rejection did not identify missing current RCA coverage.');
  const derived=engine.deriveStageData(p,14);assert(derived.DEFECT_ROOT_CAUSE_RECORDS===0&&derived.UNDETERMINED_ROOT_CAUSES.includes('DEFECT-STAGE18'),'Derived Stage 14 data disagrees with current-scope gate semantics.');
}
// A current RCA is complete only when every controlling RCA field, including CATEGORY, is present.
for(const key of ['CATEGORY','LAYER_TRACE','EARLIEST_DEFECTIVE_LAYER','ROOT_CAUSE','EVIDENCE','DOWNSTREAM_INVALIDATION']){
  const {p}=baseProject(),r=rootCause();r.fields[key]=r[key]='';engine.refreshRecordHashes(r,'rootCauses');p.projectData.rootCauses.push(r);const gate=engine.gate(14,p);assert(!gate.complete&&gate.reasons.some(reason=>reason.includes(`RCA ${key} is missing`)||reason.includes('RCA evidence linkage is missing')),`Missing RCA ${key} did not block Stage 14.`);
}
// Duplicate current RCA is ambiguous and must block rather than silently choosing one.
{
  const {p}=baseProject(),a=rootCause(),b=clone(a);b.id='RCA-STAGE18-DUP';b.fields.RCA_ID=b.RCA_ID='RCA-STAGE18-DUP';engine.refreshRecordHashes(b,'rootCauses');p.projectData.rootCauses.push(a,b);const gate=engine.gate(14,p);assert(!gate.complete&&gate.reasons.some(reason=>reason.includes('Exactly one complete RCA')),'Duplicate current RCA did not block Stage 14.');
}

// Stage 15 positive: permanent definition + actual sufficiently evidenced pre-correction failure closes Stage 15 without claiming later success.
{
  const {p}=withCurrentRca();addRegression(p);const gate=engine.gate(15,p);assert(gate.complete,`Stage 15 positive pre-correction regression did not close: ${gate.reasons.join(' | ')}`);const derived=engine.deriveStageData(p,15);assert(derived.CONFIRMED_DEFECTS===1&&derived.REGRESSION_RECORDS===1,'Stage 15 derived counts are not exact.');assert(derived.CONFIRMED_DEFECTS_WITH_REGRESSION_TEST.includes('DEFECT-STAGE18'),'Confirmed defect lacks derived permanent regression coverage.');assert(derived.PRE_CORRECTION_FAILURES_PROVEN.includes('DEFECT-STAGE18'),'Actual pre-correction failure was not application-derived as proven.');assert(!Object.prototype.hasOwnProperty.call(derived,'POST_CORRECTION_SUCCESSES_PROVEN'),'Stage 15 incorrectly claims later post-correction success.');
}
// Definition without actual execution is insufficient.
{
  const {p}=withCurrentRca();addRegression(p,{withExecution:false});const gate=engine.gate(15,p);assert(!gate.complete&&gate.reasons.some(reason=>reason.includes('lacks an actual sufficiently evidenced pre-correction failing execution')),'Regression definition without actual pre-correction execution passed Stage 15.');
}
// A non-failing pre-correction execution does not prove the regression.
{
  const {p}=withCurrentRca();addRegression(p,{result:'SATISFIED'});const gate=engine.gate(15,p);assert(!gate.complete&&gate.reasons.some(reason=>reason.includes('lacks an actual sufficiently evidenced pre-correction failing execution')),'Pre-correction execution that did not fail passed Stage 15.');
}
// Narrative fields without canonical linked execution evidence are non-controlling.
{
  const {p}=withCurrentRca();addRegression(p,{withEvidence:false});const gate=engine.gate(15,p);assert(!gate.complete&&gate.reasons.some(reason=>reason.includes('lacks an actual sufficiently evidenced pre-correction failing execution')),'Pre-correction execution without canonical evidence passed Stage 15.');
}
// Every current confirmed defect requires a permanent definition.
{
  const {p}=withCurrentRca();p.stages[14].status='COMPLETE';p.projectData.acceptedChanges.push({changeId:'CHANGE-STAGE18-REGRESSION-MISSING',stage:15,status:'COMMITTED',responseType:'DATA_PROPOSAL',scope:{...CURRENT_SCOPE}});const gate=engine.gate(15,p);assert(!gate.complete&&gate.reasons.some(reason=>reason.includes('Permanent regression definitions are missing')),'Confirmed defect without permanent regression definition passed Stage 15.');
}
assert(schema.RECORD_SCHEMAS.regressions.commitPolicy==='APPEND_ONLY','Regression registry is not append-only.');assert(schema.RECORD_SCHEMAS.rootCauses.commitPolicy==='APPEND_SCOPED','RCA registry is not scoped append-preserving.');
console.log(JSON.stringify({controllerStage:'18',applicationStages:[14,15],rootCauseAndRegressions:'PASS',currentScopeRcaEnforced:true,staleRcaRejected:true,completeRcaFieldsEnforced:true,duplicateRcaRejected:true,permanentRegressionAppendOnly:true,actualPreCorrectionExecutionRequired:true,canonicalPreCorrectionEvidenceRequired:true,preCorrectionFailureRequired:true,postCorrectionSuccessNotClaimedAtStage15:true,isolatedDisposableProject:true}));

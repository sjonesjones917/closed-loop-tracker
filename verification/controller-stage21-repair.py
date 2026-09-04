from pathlib import Path

def replace_once(path, old, new):
    p=Path(path); text=p.read_text()
    count=text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old[:120]!r}')
    p.write_text(text.replace(old,new,1))

replace_once('workflow-schema.js',
    "required:['ITERATION_ID','FAILED_CONDITIONS','RETURN_STAGES','EVIDENCE'],relationships:{ITERATION_ID:'iterations'}}),",
    "required:[],relationships:{ITERATION_ID:'iterations'}}),")

engine=Path('workflow-engine.js')
text=engine.read_text()
old_cov="regressionSuccess:regressions.length?regressions.filter(r=>successful.has(recordId(r,'regressions'))).length/regressions.length:1};}"
new_cov="regressionSuccess:regressions.length?regressions.filter(r=>successful.has(recordId(r,'regressions'))).length/regressions.length:null,regressionUniverseEmpty:regressions.length===0};}"
if text.count(old_cov)!=1: raise SystemExit('coverageMetrics regression-success expression not uniquely found')
text=text.replace(old_cov,new_cov,1)

old_gate="""case 18:{
      requireAccepted();const metrics=convergenceMetrics(project);
      if(!metrics.converged)reasons.push('All convergence conditions are not simultaneously satisfied.');
      break;
    }"""
new_gate="""case 18:{
      const metrics=convergenceMetrics(project),rows=recordsForCurrentScope(project,'convergenceRecords').filter(record=>Number(record.stage)===18&&isActiveRecord(record));
      if(rows.length!==1)reasons.push('Exactly one current application-derived convergence record is required.');
      if(!metrics.converged)reasons.push('All convergence conditions are not simultaneously satisfied.');
      if(rows.length===1){const row=rows[0],checks=[['ITERATION_ID',metrics.iterationId],['REQUIREMENT_COVERAGE',metrics.requirementCoverage],['VERIFICATION_COVERAGE',metrics.verificationCoverage],['REGRESSION_SUCCESS',metrics.regressionSuccess],['CRITICAL_DEFECT_COUNT',metrics.criticalDefects],['MAJOR_DEFECT_COUNT',metrics.majorDefects],['MANDATORY_UNRESOLVED_UNKNOWN_COUNT',metrics.mandatoryUnresolvedUnknowns],['CORRECTNESS_AFFECTING_CONTRADICTION_COUNT',metrics.contradictions],['CORRECTNESS_AFFECTING_AMBIGUITY_COUNT',metrics.ambiguities],['UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE_COUNT',metrics.unexplainedVariance],['CONVERGED',metrics.converged]];if(checks.some(([key,value])=>hash.stableStringify(recordValue(row,key))!==hash.stableStringify(value)))reasons.push('The current convergence record does not match the application-derived current convergence metrics.');}
      break;
    }"""
if text.count(old_gate)!=1: raise SystemExit('Stage 18 gate block not uniquely found')
text=text.replace(old_gate,new_gate,1)

marker="function operationalMetrics(project){"
if text.count(marker)!=1: raise SystemExit('operationalMetrics insertion marker not uniquely found')
func="""function recordConvergenceDetermination(project){
  ensureShape(project);
  if(project.stages?.[17]?.status!=='COMPLETE')throw new Error('Stage 17 must be COMPLETE before Stage 18 convergence can be calculated.');
  const metrics=convergenceMetrics(project),scope=scopeForIteration(project,metrics.iterationId),fields={ITERATION_ID:metrics.iterationId,REQUIREMENT_COVERAGE:metrics.requirementCoverage,VERIFICATION_COVERAGE:metrics.verificationCoverage,REGRESSION_SUCCESS:metrics.regressionSuccess,CRITICAL_DEFECT_COUNT:metrics.criticalDefects,MAJOR_DEFECT_COUNT:metrics.majorDefects,MANDATORY_UNRESOLVED_UNKNOWN_COUNT:metrics.mandatoryUnresolvedUnknowns,CORRECTNESS_AFFECTING_CONTRADICTION_COUNT:metrics.contradictions,CORRECTNESS_AFFECTING_AMBIGUITY_COUNT:metrics.ambiguities,UNEXPLAINED_CORRECTNESS_AFFECTING_VARIANCE_COUNT:metrics.unexplainedVariance,CONVERGED:metrics.converged},identity=hash.sha256Value(fields),current=recordsForCurrentScope(project,'convergenceRecords').filter(record=>Number(record.stage)===18&&isActiveRecord(record)),same=current.find(record=>record.applicationConvergenceIdentitySha256===identity);
  if(same)return same;
  for(const record of current){record.active=false;record.validity='SUPERSEDED';record.invalidatedBy='APPLICATION_RECALCULATION';refreshRecordHashes(record,'convergenceRecords');}
  const result=commandRecord(project,'convergenceRecords',fields,{stage:18,source:'APPLICATION_DERIVED',scope});result.applicationConvergenceIdentitySha256=identity;refreshRecordHashes(result,'convergenceRecords');addHistory(project,'CONVERGENCE_CALCULATED',{stage:18,recordId:recordId(result,'convergenceRecords'),iterationId:metrics.iterationId,converged:metrics.converged,metrics:clone(fields)});recalculate(project);return result;
}
"""
text=text.replace(marker,func+marker,1)

old_actions="const ACTION_TYPES=Object.freeze(['RUN_APP_TESTS','CALCULATE_RELEASE','BUILD_EVIDENCE_CHAINS'"
new_actions="const ACTION_TYPES=Object.freeze(['RUN_APP_TESTS','CALCULATE_CONVERGENCE','CALCULATE_RELEASE','BUILD_EVIDENCE_CHAINS'"
if text.count(old_actions)!=1: raise SystemExit('ACTION_TYPES prefix not uniquely found')
text=text.replace(old_actions,new_actions,1)
stage19="  if(stage===19){\n"
stage18="  if(stage===18){const metrics=convergenceMetrics(project),rows=recordsForCurrentScope(project,'convergenceRecords').filter(record=>Number(record.stage)===18&&isActiveRecord(record));if(!rows.length)return actionEnvelope(project,stage,{actionType:'CALCULATE_CONVERGENCE',heading:'Calculate preproduct convergence',explanation:'The application must calculate Stage 18 from the complete current due PREPRODUCT_ITERATION universe. No external agent response can set convergence. The calculation fails closed on missing verification, regressions, contradictions, defects, unknowns, ambiguity, unexplained variance, or a vacuous regression universe.',primaryButton:'Calculate convergence'});if(!metrics.converged)return actionEnvelope(project,stage,{actionType:'BLOCKED',heading:'Convergence conditions are not satisfied',explanation:'The current application-derived convergence record is not converged. Resolve the recorded due preproduct failure at its responsible stage; do not replace the calculation with an agent assertion.',blockingReason:'All current due Stage 18 convergence conditions must be simultaneously satisfied.'});}\n"
if text.count(stage19)!=1: raise SystemExit('stage 19 action marker not uniquely found')
text=text.replace(stage19,stage18+stage19,1)
old_export="createNewJobReset,recordApplicationDeterministicResult,"
new_export="createNewJobReset,recordApplicationDeterministicResult,recordConvergenceDetermination,"
if text.count(old_export)!=1: raise SystemExit('engine export marker not uniquely found')
text=text.replace(old_export,new_export,1)
engine.write_text(text)

app=Path('app-core.js'); a=app.read_text()
old="RUN_APP_TESTS:'Application',CALCULATE_RELEASE:'Application'"
if a.count(old)!=1: raise SystemExit('app action actor marker not uniquely found')
a=a.replace(old,"RUN_APP_TESTS:'Application',CALCULATE_CONVERGENCE:'Application',CALCULATE_RELEASE:'Application'",1)
old="action.actionType==='RUN_APP_TESTS'?`<button class=\"primary\" id=\"run-native-tests\" type=\"button\">${esc(action.primaryButton)}</button>`:action.actionType==='CALCULATE_RELEASE'?"
new="action.actionType==='RUN_APP_TESTS'?`<button class=\"primary\" id=\"run-native-tests\" type=\"button\">${esc(action.primaryButton)}</button>`:action.actionType==='CALCULATE_CONVERGENCE'?`<button class=\"primary\" id=\"calculate-stage18-convergence\" type=\"button\">${esc(action.primaryButton)}</button>`:action.actionType==='CALCULATE_RELEASE'?"
if a.count(old)!=1: raise SystemExit('app next action button marker not uniquely found')
a=a.replace(old,new,1)
wire_marker="if($('#calculate-stage27-release'))$('#calculate-stage27-release').onclick=async()=>"
if a.count(wire_marker)!=1: raise SystemExit('app-core Stage 27 wire marker missing or ambiguous')
convergence_wire="if($('#calculate-stage18-convergence'))$('#calculate-stage18-convergence').onclick=async()=>{try{if(Number(current.activeStage)!==18)throw new Error('Convergence calculation belongs only to Stage 18.');const next=clone(current);engine.recordConvergenceDetermination(next);await persistReplacement(next);announce('convergence determination calculated');render();requestAnimationFrame(()=>$('#next-required-action')?.focus());}catch(error){announce('convergence calculation blocked');alert(error.message||error);}};"
a=a.replace(wire_marker,convergence_wire+wire_marker,1)
app.write_text(a)

replace_once('verify-full-cycle.mjs',
    "data(18,{stageData:{RETURN_STAGE_FOR_EACH_FAILURE:'NONE'}});complete(18);",
    "assert.equal(engine.acceptedChanges(p,18).length,0,'Stage 18 convergence must not depend on an external accepted proposal.');const convergence18=engine.recordConvergenceDetermination(p);assert.equal(engine.recordValue(convergence18,'CONVERGED'),true,'Application-owned Stage 18 convergence did not affirm the complete corrected iteration.');complete(18);")

Path('verify-convergence.mjs').write_text("""import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine;
assert(core&&schema&&engine,'Convergence verifier could not load runtime authorities.');
assert.equal(typeof engine.recordConvergenceDetermination,'function','Stage 18 lacks an application-owned convergence command.');
assert.equal(schema.RECORD_SCHEMAS.convergenceRecords.commitPolicy,'APPLICATION_DERIVED','Convergence records are not application-derived.');
assert.deepEqual(schema.RECORD_SCHEMAS.convergenceRecords.required,[],'Application-derived convergence incorrectly requires agent-owned explanatory fields.');
const blank=core.createBlankState('JOB-CONVERGENCE-NEGATIVE');engine.ensureShape(blank);for(let stage=1;stage<=17;stage++)blank.stages[stage].status='COMPLETE';blank.activeStage=18;engine.recalculate(blank);
const empty=engine.convergenceMetrics(blank);
assert.equal(empty.converged,false,'Empty state incorrectly establishes convergence.');
assert.equal(empty.regressionSuccess,null,'An empty regression denominator was silently treated as 100%.');
assert.equal(empty.regressionUniverseEmpty,true,'Empty regression universe is not explicitly exposed.');
assert.equal(engine.operationalNextAction(blank,18).actionType,'CALCULATE_CONVERGENCE','Stage 18 operator path still asks for an external response instead of application calculation.');
const blocked=engine.recordConvergenceDetermination(blank);
assert.equal(engine.recordValue(blocked,'CONVERGED'),false,'Invalid empty fixture produced a favorable convergence record.');
assert.equal(engine.gate(18,blank).complete,false,'Invalid empty convergence fixture passed Stage 18.');
assert.equal(engine.acceptedChanges(blank,18).length,0,'Stage 18 application calculation fabricated an external accepted response.');
await import('./verify-full-cycle.mjs');
console.log('verify-convergence: PASS');
""")

pages=Path('.github/workflows/pages.yml'); y=pages.read_text()
needle="          node verify-complete.mjs\n          node verify-full-cycle.mjs\n"
if y.count(needle)!=1: raise SystemExit('pages.yml workflow/gates insertion point not uniquely found')
y=y.replace(needle,"          node verify-complete.mjs\n          node verify-convergence.mjs\n          node verify-full-cycle.mjs\n",1)
pages.write_text(y)

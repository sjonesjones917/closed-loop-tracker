from pathlib import Path
import re
p=Path('workflow-engine.js'); text=p.read_text()
old="  4:['CURRENT_REQUIREMENTS_VERSION','REQUIREMENTS'],5:['CURRENT_REQUIREMENTS_VERSION','REQUIREMENTS'],6:['CURRENT_TEST_SUITE_VERSION','TEST-SUITE'],"
new="  4:['CURRENT_REQUIREMENTS_VERSION','REQUIREMENTS'],6:['CURRENT_TEST_SUITE_VERSION','TEST-SUITE'],"
if text.count(old)!=1: raise SystemExit('Stage 5 version pattern mismatch')
text=text.replace(old,new,1)
pattern=r"function defectResolvedByRegression\(project,defect\)\{.*?\}\nfunction unresolvedMaterialDefects"
replacement="""function defectResolvedByRegression(project,defect){
  const defectId=recordId(defect,'defects'),linked=records(project,'regressions').filter(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||'')===defectId&&upper(recordValue(r,'ACTIVE_RETIRED_STATE')||'ACTIVE')!=='RETIRED');
  if(!linked.length)return false;
  const iterationId=recordId(latestIteration(project,[10,17,19]),'iterations')||String(project.job.CURRENT_ITERATION||'').trim();
  const source=iterationId?currentRegressionExecutions(project,iterationId):records(project,'regressionExecutions');
  return linked.every(reg=>{const id=recordId(reg,'regressions'),executions=source.filter(x=>String(recordValue(x,'REG_ID')||x.relationships?.REG_ID||'')===id&&upper(recordValue(x,'PHASE'))!=='PRE_CORRECTION');return executions.length===1&&['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(executions[0],'RESULT')));});
}
function unresolvedMaterialDefects"""
text,count=re.subn(pattern,replacement,text,count=1,flags=re.S)
if count!=1: raise SystemExit('Regression closure pattern mismatch')
pattern=r"function acceptedOperationSet\(project,stage\)\{.*?\}\nfunction candidateComponentIdentity"
replacement="""function acceptedOperationSet(project,stage,scopeRule={}){
  const proposals=safe(project.projectData.responseProposals),out=new Set(),keys=['iterationId','candidateId','baselineId','productId'];
  for(const c of acceptedChanges(project,stage)){
    const proposal=proposals.find(p=>p.proposalId===c.proposalId),op=c.operation||proposal?.envelope?.operation,scope={...(proposal?.envelope?.scope||{}),...(c.scope||{}),...(c.applicationScopeBinding||{})};
    if(keys.some(key=>scopeRule[key]!==undefined&&scopeRule[key]!==null&&String(scope[key]??'')!==String(scopeRule[key])))continue;
    if(op)out.add(String(op));
  }
  return out;
}
function candidateComponentIdentity"""
text,count=re.subn(pattern,replacement,text,count=1,flags=re.S)
if count!=1: raise SystemExit('Operation scope pattern mismatch')
old="ops=acceptedOperationSet(project,stage),requiredOps=";new="ops=acceptedOperationSet(project,stage,{iterationId}),requiredOps="
if text.count(old)!=1: raise SystemExit('Iteration evaluator operation pattern mismatch')
text=text.replace(old,new,1)
old="project.job.CURRENT_ITERATION=iterationId;addHistory(project,'CANDIDATE_FROZEN'"
new="project.job.CURRENT_ITERATION=iterationId;if(freezeStage===17){const freezeChange=[...acceptedChanges(project,17)].reverse().find(change=>String(change.operation||'')==='FREEZE'&&!change.applicationScopeBinding);if(freezeChange)freezeChange.applicationScopeBinding={iterationId,candidateId};}addHistory(project,'CANDIDATE_FROZEN'"
if text.count(old)!=1: raise SystemExit('Freeze binding pattern mismatch')
text=text.replace(old,new,1)
p.write_text(text)

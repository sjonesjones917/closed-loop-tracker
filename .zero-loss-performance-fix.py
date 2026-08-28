from pathlib import Path

p=Path('workflow-engine.js')
s=p.read_text()

old="function deriveStageData(project,stage){ensureShape(project);const derived={};const ids=collection=>recordsForCurrentScope(project,collection).filter(r=>Number(r.stage)===Number(stage)).map(r=>recordId(r,collection));const metrics=coverageMetrics(project);const convergence=convergenceMetrics(project);const release=releaseMetrics(project);switch(stage){"
new="function deriveStageData(project,stage){ensureShape(project);const derived={};const ids=collection=>recordsForCurrentScope(project,collection).filter(r=>Number(r.stage)===Number(stage)).map(r=>recordId(r,collection));const metrics=[4,6,12].includes(Number(stage))?coverageMetrics(project):null;const convergence=Number(stage)===18?convergenceMetrics(project):null;const release=Number(stage)===27?releaseMetrics(project):null;switch(stage){"
if s.count(old)!=1:
    raise SystemExit(f'deriveStageData anchor count {s.count(old)}')
s=s.replace(old,new,1)

start=s.index('function executionStability(project,iterationId){')
end=s.index('function executionHandoff(project,',start)
replacement="""function executionStability(project,iterationId){
  const matrix=verificationMatrix(project,iterationId),byReq={},byTest={},byReqRun=new Map(),byTestValues=new Map();
  const combine=list=>list.some(x=>x==='VIOLATED')?'VIOLATED':list.some(x=>x==='UNDETERMINED')?'UNDETERMINED':list.length&&list.every(x=>x==='SATISFIED')?'SATISFIED':'UNDETERMINED';
  for(const v of matrix.verification){
    const determination=effectiveDetermination('verification',v,testForResult(project,v),project),reqId=String(recordValue(v,'REQ_ID')||v.relationships?.REQ_ID||''),runId=String(recordValue(v,'RUN_ID')||v.relationships?.RUN_ID||''),testId=String(recordValue(v,'TEST_ID')||v.relationships?.TEST_ID||''),reqRunKey=reqId+'|'+runId;
    if(!byReqRun.has(reqRunKey))byReqRun.set(reqRunKey,[]);byReqRun.get(reqRunKey).push(determination);
    if(!byTestValues.has(testId))byTestValues.set(testId,[]);byTestValues.get(testId).push(determination);
  }
  for(const req of matrix.requirements){const rid=requirementId(req),perRun=matrix.runs.map(run=>combine(byReqRun.get(rid+'|'+recordId(run,'runs'))||[])),counts={satisfied:perRun.filter(x=>x==='SATISFIED').length,violated:perRun.filter(x=>x==='VIOLATED').length,undetermined:perRun.filter(x=>x==='UNDETERMINED').length};byReq[rid]={...counts,agreementRate:matrix.runs.length?Math.max(...Object.values(counts))/matrix.runs.length:0};}
  for(const test of recordsForScope(project,'tests',matrix.scope)){const tid=recordId(test,'tests'),vals=byTestValues.get(tid)||[],counts={satisfied:vals.filter(x=>x==='SATISFIED').length,violated:vals.filter(x=>x==='VIOLATED').length,undetermined:vals.filter(x=>x==='UNDETERMINED').length};byTest[tid]={...counts,agreementRate:matrix.runs.length?Math.max(...Object.values(counts))/matrix.runs.length:0};}
  const defects=recordsForIteration(project,'defects',iterationId),patterns=new Map(),newDefectsByRun={};for(const d of defects){const key=hash.sha256Value([recordValue(d,'OBSERVED_FAILURE'),recordValue(d,'EXPECTED_CONDITION')]);patterns.set(key,(patterns.get(key)||0)+1);const run=String(recordValue(d,'RUN_ID')||d.relationships?.RUN_ID||'UNASSIGNED');newDefectsByRun[run]=(newDefectsByRun[run]||0)+1;}
  return {runCount:matrix.runs.length,requirementStability:byReq,testStability:byTest,totalDistinctDefects:defects.length,repeatedDefectCount:[...patterns.values()].filter(n=>n>1).reduce((a,n)=>a+n,0),uniqueDefectCount:[...patterns.values()].filter(n=>n===1).length,newDefectsByRun,unexplainedVarianceCount:recordsForIteration(project,'comparisons',iterationId).filter(r=>truth(recordValue(r,'CORRECTNESS_AFFECTING_VARIANCE'))&&!truth(recordValue(r,'AUTHORIZED_VARIANCE'))).length};
}
"""
s=s[:start]+replacement+s[end:]

# Recalculation has a strict serial prerequisite: once the first non-complete stage is reached,
# downstream stages cannot be actionable. Do not perform expensive downstream release/adjudication
# reductions, and do not recompute immutable derived summaries for already-complete upstream stages.
rstart=s.index('function recalculate(project){')
completed=s.index('  const completed=Object.values(project.stages)',rstart)
newprefix="""function recalculate(project){
  ensureShape(project);
  let previousComplete=true;
  for(let stage=1;stage<=30;stage++){
    const state=project.stages[stage];
    if(!previousComplete){
      const prerequisite=`Stage ${String(stage-1).padStart(2,'0')} is not complete.`;
      state.status='NOT STARTED';
      state.gate={complete:false,blocked:false,reasons:[prerequisite]};
      state.decision='';
      state.decisionEvidence=prerequisite;
      state.derivedData={STAGE_DECISION:'NOT READY - CORRECTION REQUIRED',DECISION_EVIDENCE:prerequisite};
      continue;
    }
    const wasComplete=state.status==='COMPLETE',result=gate(stage,project);
    state.gate=result;
    if(result.blocked){state.status='BLOCKED';}
    else if(result.complete){state.status='COMPLETE';}
    else if(hasStageActivity(project,stage)){state.status='IN PROGRESS';}
    else state.status='READY';
    state.decision=state.status==='COMPLETE'?'READY TO PROCEED':state.status==='BLOCKED'?'BLOCKED':'';
    state.decisionEvidence=result.reasons.length?result.reasons.join('; '):'Derived canonical stage gate satisfied.';
    if(!wasComplete||state.status!=='COMPLETE'||!state.derivedData||!Object.keys(state.derivedData).length)state.derivedData=deriveStageData(project,stage);
    previousComplete=state.status==='COMPLETE';
  }
"""
s=s[:rstart]+newprefix+s[completed:]

p.write_text(s)
print('zero-loss-performance-fix applied')

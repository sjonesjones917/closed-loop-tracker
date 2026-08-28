from pathlib import Path

p=Path('workflow-engine.js')
s=p.read_text()

def replace_once(old,new,label):
    global s
    if old in s:
        s=s.replace(old,new,1)
    elif new not in s:
        raise RuntimeError(label+' anchor missing')

# Convergence is an iteration-local proposition. Later product/release evidence
# must never retroactively make Stage 18 incomplete. Derive only contradictions
# that exist inside the current repeated-iteration verification set.
anchor="function convergenceMetrics(project){"
if 'function convergenceContradictionCount(' not in s:
    pos=s.find(anchor)
    if pos<0: raise RuntimeError('convergenceMetrics anchor missing')
    helper="""function convergenceContradictionCount(project,iterationId){
  const groups=new Map(),rows=iterationId?recordsForIteration(project,'verification',iterationId):[];
  for(const r of rows){const key=verificationKey(r),e=evaluateResultConsistency('verification',r,testForResult(project,r),project);if(!groups.has(key))groups.set(key,new Set());groups.get(key).add(e.determination);}
  let count=0;
  for(const ds of groups.values())if(ds.size>1)count+=1;
  for(const r of rows){const e=evaluateResultConsistency('verification',r,testForResult(project,r),project);if(e.claimedDetermination==='SATISFIED'&&e.determination!=='SATISFIED')count+=1;}
  return count;
}
"""
    s=s[:pos]+helper+s[pos:]
replace_once("contradictions=detectCurrentContradictions(project).filter(x=>x.severity==='RELEASE_MATERIAL').length","contradictions=convergenceContradictionCount(project,iterationId)",'Stage 18 contradiction reduction')

# Repeated-iteration regression success is application-adjudicated, never read
# from the externally supplied RESULT string.
old="if(mode!=='INITIAL')for(const reg of activeRegressions(project)){const id=recordId(reg,'regressions'),xs=regExec.filter(x=>String(recordValue(x,'REG_ID')||x.relationships?.REG_ID||'')===id),latest=xs.at(-1),evidence=latest?evaluateEvidenceSufficiency(project,{result:latest}):{sufficient:false};if(xs.length!==1||!['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(latest,'RESULT')))||!evidence.sufficient)regFailures.push(id);}"
new="if(mode!=='INITIAL')for(const reg of activeRegressions(project)){const id=recordId(reg,'regressions'),xs=regExec.filter(x=>String(recordValue(x,'REG_ID')||x.relationships?.REG_ID||'')===id),latest=xs.at(-1),effective=latest?effectiveRegressionDetermination(project,latest):{determination:'UNDETERMINED'};if(xs.length!==1||effective.determination!=='SATISFIED')regFailures.push(id);}"
replace_once(old,new,'evaluateIteration regression adjudication')

# Stability statistics must describe application-effective verification facts,
# not the agent's claimed DETERMINATION field.
old=".map(v=>upper(recordValue(v,'DETERMINATION'))))),counts="
new=".map(v=>effectiveDetermination('verification',v,testForResult(project,v),project)))),counts="
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise RuntimeError('requirement stability effective-determination anchor missing')
old=".map(v=>upper(recordValue(v,'DETERMINATION'))),counts="
new=".map(v=>effectiveDetermination('verification',v,testForResult(project,v),project)),counts="
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise RuntimeError('test stability effective-determination anchor missing')

# Baseline authorization must depend on the application-derived unchanged
# confirmation, not the submitted confirmation conclusion.
old="const confirmation=recordsForCurrentScope(project,'confirmationRecords').filter(r=>upper(recordValue(r,'DETERMINATION'))==='SATISFIED').at(-1);"
new="const confirmation=recordsForCurrentScope(project,'confirmationRecords').filter(r=>effectiveDetermination('confirmationRecords',r,null,project)==='SATISFIED').at(-1);"
replace_once(old,new,'freezeBaseline effective confirmation')

# Stage 29 requires the same structural evidence contract used by result
# adjudication. The older helper intentionally tolerated narrative evidence and
# therefore cannot be the controlling chain-completeness test.
old="else for(const result of testResults)if(!evaluateEvidenceSufficiency(project,{requirement,test,result}).sufficient)missing.push('INSUFFICIENT_EVIDENCE:'+tid);"
new="else for(const result of testResults)if(!evaluateEvidenceContract(test,result,null,project).sufficient)missing.push('INSUFFICIENT_EVIDENCE:'+tid);"
replace_once(old,new,'evidence-chain structural sufficiency')

p.write_text(s)

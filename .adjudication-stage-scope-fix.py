from pathlib import Path

p=Path('workflow-engine.js')
s=p.read_text()

def replace_once(old,new,label):
    global s
    if old in s:
        s=s.replace(old,new,1)
    elif new not in s:
        raise RuntimeError(label+' anchor missing')

# Stage 18 is an iteration-local proposition. Later product/release evidence
# cannot retroactively invalidate an already completed convergence calculation.
# Use the same application adjudicator, but only over the current iteration's
# verification facts.
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

# Baseline authorization is controlled by the application-derived unchanged
# confirmation, never the externally supplied conclusion field.
old="const confirmation=recordsForCurrentScope(project,'confirmationRecords').filter(r=>upper(recordValue(r,'DETERMINATION'))==='SATISFIED').at(-1);"
new="const confirmation=recordsForCurrentScope(project,'confirmationRecords').filter(r=>effectiveDetermination('confirmationRecords',r,null,project)==='SATISFIED').at(-1);"
replace_once(old,new,'freezeBaseline effective confirmation')

# Stage 29 chain completeness must use the same structural evidence contract
# that controls result adjudication. Bare narrative is supplementary only.
old="else for(const result of testResults)if(!evaluateEvidenceSufficiency(project,{requirement,test,result}).sufficient)missing.push('INSUFFICIENT_EVIDENCE:'+tid);"
new="else for(const result of testResults)if(!evaluateEvidenceContract(test,result,null,project).sufficient)missing.push('INSUFFICIENT_EVIDENCE:'+tid);"
replace_once(old,new,'evidence-chain structural sufficiency')

p.write_text(s)

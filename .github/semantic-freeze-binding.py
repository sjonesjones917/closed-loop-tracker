from pathlib import Path

p=Path('workflow-engine.js')
text=p.read_text()
old="""function acceptedOperationSet(project,stage,scopeRule={}){
  const proposals=safe(project.projectData.responseProposals),out=new Set(),keys=['iterationId','candidateId','baselineId','productId'];
  for(const c of acceptedChanges(project,stage)){
    const proposal=proposals.find(p=>p.proposalId===c.proposalId),op=c.operation||proposal?.envelope?.operation,scope=c.scope||proposal?.envelope?.scope||{};
    if(keys.some(key=>scopeRule[key]!==undefined&&scopeRule[key]!==null&&String(scope[key]??'')!==String(scopeRule[key])))continue;
    if(op)out.add(String(op));
  }
  return out;
}
"""
new="""function acceptedOperationSet(project,stage,scopeRule={}){
  const proposals=safe(project.projectData.responseProposals),out=new Set(),keys=['iterationId','candidateId','baselineId','productId'];
  for(const c of acceptedChanges(project,stage)){
    const proposal=proposals.find(p=>p.proposalId===c.proposalId),op=String(c.operation||proposal?.envelope?.operation||''),scope=c.scope||proposal?.envelope?.scope||{};
    if(['FREEZE','CONFIRM_FREEZE'].includes(op)&&c.allocatedIterationId){if(String(c.allocatedIterationId)===String(scopeRule.iterationId||'')&&String(c.allocatedCandidateId||'')===String(scopeRule.candidateId||''))out.add(op);continue;}
    if(keys.some(key=>scopeRule[key]!==undefined&&scopeRule[key]!==null&&String(scope[key]??'')!==String(scopeRule[key])))continue;
    if(op)out.add(op);
  }
  return out;
}
function bindAllocatedIterationOperation(project,stage,operation,iterationId,candidateId){const change=acceptedChanges(project,stage).filter(c=>String(c.operation||'')===String(operation)&&!c.allocatedIterationId).at(-1);if(!change)throw new Error(`Stage ${stage} ${operation} requires a current accepted operation response before application identity allocation.`);change.allocatedIterationId=String(iterationId);change.allocatedCandidateId=String(candidateId);return change;}
"""
if text.count(old)!=1: raise SystemExit(f'acceptedOperationSet patched source occurrence count = {text.count(old)}')
text=text.replace(old,new,1)
old2="""  project.job.CURRENT_ITERATION=iterationId;addHistory(project,'CANDIDATE_FROZEN',{stage:freezeStage,iterationId,candidateId,artifactIds:manifest.map(a=>a.artifactId),unchangedConfirmation:freezeStage===19,operatorLabel,identityAssurance:'SELF_ASSERTED'});recalculate(project);return {iteration,candidate};
"""
new2="""  if(freezeStage===17)bindAllocatedIterationOperation(project,17,'FREEZE',iterationId,candidateId);else if(freezeStage===19)bindAllocatedIterationOperation(project,19,'CONFIRM_FREEZE',iterationId,candidateId);project.job.CURRENT_ITERATION=iterationId;addHistory(project,'CANDIDATE_FROZEN',{stage:freezeStage,iterationId,candidateId,artifactIds:manifest.map(a=>a.artifactId),unchangedConfirmation:freezeStage===19,operatorLabel,identityAssurance:'SELF_ASSERTED'});recalculate(project);return {iteration,candidate};
"""
if text.count(old2)!=1: raise SystemExit(f'freezeCandidate binding point occurrence count = {text.count(old2)}')
text=text.replace(old2,new2,1)
old3="""project.projectData.iterations.push(iteration);project.job.CURRENT_ITERATION=iterationId;addHistory(project,'UNCHANGED_CONFIRMATION_ITERATION_STARTED',{stage:19,iterationId,candidateId:String(candidateId),previousIterationId,operatorLabel,identityAssurance:'SELF_ASSERTED'});recalculate(project);return iteration;
"""
new3="""project.projectData.iterations.push(iteration);bindAllocatedIterationOperation(project,19,'CONFIRM_FREEZE',iterationId,String(candidateId));project.job.CURRENT_ITERATION=iterationId;addHistory(project,'UNCHANGED_CONFIRMATION_ITERATION_STARTED',{stage:19,iterationId,candidateId:String(candidateId),previousIterationId,operatorLabel,identityAssurance:'SELF_ASSERTED'});recalculate(project);return iteration;
"""
if text.count(old3)!=1: raise SystemExit(f'unchanged-confirmation binding point occurrence count = {text.count(old3)}')
text=text.replace(old3,new3,1)
p.write_text(text)

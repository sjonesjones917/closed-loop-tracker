from pathlib import Path

p=Path('response-ingestion.js')
s=p.read_text()
old="""      if(reference.tempKey){
        const target=responseRecordIndex.get(String(reference.tempKey));
        if(!target)issues.push(issue('UNRESOLVED_RELATIONSHIP',`${path}/relationships/${pointerEscape(name)}`,`Temporary relationship ${reference.tempKey} does not exist.`));
        else if(target.collection!==expectedCollection)issues.push(issue('WRONG_RELATIONSHIP_TYPE',`${path}/relationships/${pointerEscape(name)}`,`${name} must refer to ${expectedCollection}, not ${target.collection}.`));
      }else if(reference.recordId){"""
new="""      if(reference.tempKey){
        const target=responseRecordIndex.get(String(reference.tempKey));
        const evidenceTarget=expectedCollection==='evidenceRecords'?evidenceIndex.get(String(reference.tempKey)):null;
        if(!target&&!evidenceTarget)issues.push(issue('UNRESOLVED_RELATIONSHIP',`${path}/relationships/${pointerEscape(name)}`,`Temporary relationship ${reference.tempKey} does not exist.`));
        else if(target&&target.collection!==expectedCollection)issues.push(issue('WRONG_RELATIONSHIP_TYPE',`${path}/relationships/${pointerEscape(name)}`,`${name} must refer to ${expectedCollection}, not ${target.collection}.`));
      }else if(reference.recordId){"""
assert old in s
p.write_text(s.replace(old,new,1))

p=Path('verify-full-cycle.mjs')
s=p.read_text()
old="""for(let i=0;i<slots.length;i++){
  const slot=slots[i];pr=savePrompt(11,{scope:{runId:slot.runId,contextId:slot.contextId,iterationId,candidateId}});"""
new="""for(let i=0;i<slots.length;i++){
  const slot=slots[i];engine.registerFreshContext(p,{stage:11,externalContextIdentifier:`EXTERNAL-CONTEXT-11-${i+1}`,operatorLabel:'FULL_CYCLE_OPERATOR'});pr=savePrompt(11,{scope:{runId:slot.runId,contextId:slot.contextId,iterationId,candidateId}});"""
assert old in s
s=s.replace(old,new,1)
old="""for(let i=0;i<slots17.length;i++){const slot=slots17[i];pr=savePrompt(17,{operation:'EXECUTE_RUN',scope:{runId:slot.runId,contextId:slot.contextId,iterationId:iteration17,candidateId:candidate17}});"""
new="""for(let i=0;i<slots17.length;i++){const slot=slots17[i];engine.registerFreshContext(p,{stage:17,externalContextIdentifier:`EXTERNAL-CONTEXT-17-${i+1}`,operatorLabel:'FULL_CYCLE_OPERATOR'});pr=savePrompt(17,{operation:'EXECUTE_RUN',scope:{runId:slot.runId,contextId:slot.contextId,iterationId:iteration17,candidateId:candidate17}});"""
assert old in s
p.write_text(s.replace(old,new,1))

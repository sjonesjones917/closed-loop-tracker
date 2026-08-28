from pathlib import Path
p=Path('workflow-engine.js')
s=p.read_text()
gate_pos=s.index('function gate(stage,project){')
start=s.index("  const add=x=>{for(const r of safe(x))if(r&&!reasons.includes(r))reasons.push(r);};", gate_pos)
end=s.index("  const blocked=questions.length>0||blockers.length>0||executionFailures.length>0;", start)
s=s[:start]+"  addSemanticGateReasons(reasons,stage,canonicalProject);\n"+s[end:]
helper=r'''function addSemanticGateReasons(reasons,stage,project){
  const add=items=>{for(const reason of safe(items))if(reason&&!reasons.includes(reason))reasons.push(reason);};

  if(stage===9){
    for(const record of recordsForCurrentScope(project,'preflightRecords')){
      const result=evaluateResultConsistency('preflightRecords',record,null,project);
      if(result.determination!=='SATISFIED')add(result.reasons.length?result.reasons:['Preflight is not application-derived SATISFIED.']);
    }
  }

  if(stage===13){
    const iteration=latestIteration(project,[10,17,19]);
    const iterationId=recordId(iteration,'iterations');
    for(const requirement of mandatoryRequirements(project,scopeForIteration(project,iterationId))){
      const reqId=requirementId(requirement);
      const facts=comparisonFacts(project,reqId,iterationId);
      const rows=recordsForIteration(project,'comparisons',iterationId).filter(record=>String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'')===reqId);
      if(rows.length!==1)add([`Exactly one comparison record is required for ${reqId}.`]);
      if(facts.anyViolation)add([`Derived comparison contains a violation for ${reqId}.`]);
      if(facts.anyUndetermined)add([`Derived comparison contains an undetermined result for ${reqId}.`]);
      if(!facts.allSatisfied&&!facts.anyViolation&&!facts.anyUndetermined)add([`Derived comparison is incomplete for ${reqId}.`]);
    }
  }

  if(stage===14){
    for(const defect of confirmedDefects(project)){
      const defectId=recordId(defect,'defects');
      const rcas=records(project,'rootCauses').filter(record=>String(recordValue(record,'DEFECT_ID')||record.relationships?.DEFECT_ID||'')===defectId);
      if(rcas.length!==1){add([`Exactly one complete RCA is required for ${defectId}.`]);continue;}
      const validation=validateRootCauseRecord(rcas[0],project);
      if(!validation.valid)add(validation.reasons.map(reason=>`${defectId}: ${reason}`));
    }
  }

  if(stage===16){
    for(const defect of confirmedDefects(project)){
      const defectId=recordId(defect,'defects');
      const changes=records(project,'changes',{stage:16}).filter(change=>{
        const raw=recordValue(change,'TRIGGERING_DEFECT_IDS');
        const ids=Array.isArray(raw)?raw.map(String):String(raw||'').split(/[;,\s]+/).filter(Boolean);
        return ids.includes(defectId);
      });
      if(changes.length!==1){add([`Exactly one responsible-layer changeset trace is required for ${defectId}.`]);continue;}
      const validation=validateChangeTrace(changes[0],project);
      if(!validation.valid)add(validation.reasons.map(reason=>`${defectId}: ${reason}`));
    }
  }

  if(stage===19){
    for(const record of recordsForCurrentScope(project,'confirmationRecords')){
      const result=confirmationDetermination(project,record);
      if(result.determination!=='SATISFIED')add(result.reasons.length?result.reasons:['Unchanged confirmation is not application-derived SATISFIED.']);
    }
  }

  if(stage===20){
    const satisfied=recordsForCurrentScope(project,'confirmationRecords').filter(record=>effectiveDetermination('confirmationRecords',record,null,project)==='SATISFIED');
    if(satisfied.length!==1)add(['Exactly one application-derived successful unchanged confirmation is required.']);
  }

  if(stage===21){
    for(const record of recordsForCurrentScope(project,'products')){
      const result=evaluateResultConsistency('products',record,null,project);
      if(result.determination!=='SATISFIED')add(result.reasons.length?result.reasons:['Production execution is not application-derived SATISFIED.']);
    }
  }

  const collection={22:'deterministicResults',23:'meaningResults',24:'adversarialResults',25:'representationInspections'}[stage];
  if(collection){
    for(const record of recordsForCurrentScope(project,collection)){
      const result=evaluateResultConsistency(collection,record,testForResult(project,record),project);
      if(result.determination!=='SATISFIED')add(result.reasons.length?result.reasons:[`${collection} contains a non-satisfied effective result.`]);
    }
  }

  if(stage===26){
    for(const record of recordsForCurrentScope(project,'processAudits')){
      const result=auditDetermination('processAudits',record,project);
      if(result.determination!=='SATISFIED')add(result.reasons);
    }
    for(const record of recordsForCurrentScope(project,'productAudits')){
      const result=auditDetermination('productAudits',record,project);
      if(result.determination!=='SATISFIED')add(result.reasons);
    }
  }

  if(stage>=27&&releaseMetrics(project).determination==='ACCEPTED'&&detectCurrentContradictions(project).length){
    add(['Release cannot be ACCEPTED while an adjudication contradiction exists.']);
  }
}

'''
s=s[:gate_pos]+helper+s[gate_pos:]
p.write_text(s)

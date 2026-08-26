from pathlib import Path

p=Path('workflow-engine.js'); s=p.read_text()
old="""function registerFreshContext(project,{stage=project.activeStage,externalContextIdentifier,operatorLabel='HUMAN_OPERATOR'}={}){
  if(!String(externalContextIdentifier||'').trim())throw new Error('An external fresh-context identifier is required.');
  const record=commandRecord(project,'freshContexts',{EXTERNAL_CONTEXT_IDENTIFIER:String(externalContextIdentifier).trim(),ROLE:core.STAGES[Number(stage)-1]?.role||'UNKNOWN',ITERATION_ID:project.job.CURRENT_ITERATION||'NOT APPLICABLE',RUN_ID:'NOT APPLICABLE',AUTHORIZED_PROJECT_INPUTS:project.job.CURRENT_INPUT_VERSION||'UNKNOWN',AUTHORIZED_EXTERNAL_SOURCE_MATERIAL:project.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',FROZEN_ARTIFACT_VERSIONS:'CURRENT AUTHORIZED VERSIONS',TOOL_AVAILABILITY:'UNKNOWN',CONTAMINATION_STATUS:'UNKNOWN',OUTPUT_IDENTITY:'UNKNOWN',DEVIATIONS:'NONE RECORDED',EVIDENCE:'Context identifier supplied by operator.',USABILITY_DETERMINATION:'UNKNOWN'},{stage,source:'HUMAN_INPUT'});
  addHistory(project,'FRESH_CONTEXT_REGISTERED',{stage,recordId:record.id,operatorLabel,identityAssurance:'SELF_ASSERTED'});recalculate(project);return record;
}"""
new="""function registerFreshContext(project,{stage=project.activeStage,externalContextIdentifier,operatorLabel='HUMAN_OPERATOR'}={}){
  ensureShape(project);const identifier=String(externalContextIdentifier||'').trim();const placeholder=new Set(['','UNASSIGNED','UNKNOWN','PENDING','NOT APPLICABLE','NONE']);if(placeholder.has(upper(identifier)))throw new Error('A real external fresh-context identifier is required.');
  const iterationId=String(project.job.CURRENT_ITERATION||'NOT APPLICABLE');const current=records(project,'freshContexts',{stage}).filter(record=>String(recordValue(record,'ITERATION_ID')||record.scope?.iterationId||'')===iterationId);if(current.some(record=>upper(recordValue(record,'EXTERNAL_CONTEXT_IDENTIFIER'))===upper(identifier)))throw new Error('This external context identifier is already registered for the current iteration.');
  let record=current.find(record=>placeholder.has(upper(recordValue(record,'EXTERNAL_CONTEXT_IDENTIFIER'))));
  if(record){record.fields=record.fields&&typeof record.fields==='object'?record.fields:{};record.fields.EXTERNAL_CONTEXT_IDENTIFIER=identifier;record.EXTERNAL_CONTEXT_IDENTIFIER=identifier;record.fulfilledAt=now();record.fulfilledBy=operatorLabel;record.identityAssurance='SELF_ASSERTED';}
  else record=commandRecord(project,'freshContexts',{EXTERNAL_CONTEXT_IDENTIFIER:identifier,ROLE:core.STAGES[Number(stage)-1]?.role||'UNKNOWN',ITERATION_ID:iterationId,RUN_ID:'NOT APPLICABLE',AUTHORIZED_PROJECT_INPUTS:project.job.CURRENT_INPUT_VERSION||'UNKNOWN',AUTHORIZED_EXTERNAL_SOURCE_MATERIAL:project.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',FROZEN_ARTIFACT_VERSIONS:'CURRENT AUTHORIZED VERSIONS',TOOL_AVAILABILITY:'UNKNOWN',CONTAMINATION_STATUS:'UNKNOWN',OUTPUT_IDENTITY:'UNKNOWN',DEVIATIONS:'NONE RECORDED',EVIDENCE:'Context identifier supplied by operator.',USABILITY_DETERMINATION:'UNKNOWN'},{stage,source:'HUMAN_INPUT'});
  addHistory(project,'FRESH_CONTEXT_REGISTERED',{stage,recordId:record.id,externalContextIdentifier:identifier,operatorLabel,identityAssurance:'SELF_ASSERTED'});recalculate(project);return record;
}"""
assert old in s
s=s.replace(old,new,1)
old="function evaluateIteration(project,iterationId,mode='INITIAL'){const matrix=verificationMatrix(project,iterationId);const runs=matrix.runs;const contexts=new Set(runs.map(r=>String(recordValue(r,'CONTEXT_ID')||r.relationships?.CONTEXT_ID||r.scope?.contextId||'')));"
new="function evaluateIteration(project,iterationId,mode='INITIAL'){const matrix=verificationMatrix(project,iterationId);const runs=matrix.runs;const contextRecords=recordsForCurrentScope(project,'freshContexts',{iterationId});const contextById=new Map(contextRecords.map(record=>[recordId(record,'freshContexts'),record]));const placeholder=new Set(['','UNASSIGNED','UNKNOWN','PENDING','NOT APPLICABLE','NONE']);const resolvedContexts=runs.map(run=>{const id=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||'');const record=contextById.get(id);const externalIdentifier=String(recordValue(record,'EXTERNAL_CONTEXT_IDENTIFIER')||'').trim();return {id,record,externalIdentifier};});const contexts=new Set(resolvedContexts.filter(item=>item.record&&!placeholder.has(upper(item.externalIdentifier))).map(item=>upper(item.externalIdentifier)));"
assert old in s
s=s.replace(old,new,1)
old="if(contexts.size!==10||contexts.has(''))reasons.push('Ten distinct current fresh contexts are required.');"
new="if(resolvedContexts.some(item=>!item.record||placeholder.has(upper(item.externalIdentifier)))||contexts.size!==10)reasons.push('Ten distinct, actually registered external fresh contexts are required.');"
assert old in s
s=s.replace(old,new,1)
old="return {mode,iterationId,runs:runs.map(r=>recordId(r,'runs')),contextCount:contexts.size,candidateIds:[...candidates],matrix,"
new="return {mode,iterationId,runs:runs.map(r=>recordId(r,'runs')),contextCount:contexts.size,contextRecordIds:resolvedContexts.map(item=>item.id),externalContextIdentifiers:resolvedContexts.map(item=>item.externalIdentifier),candidateIds:[...candidates],matrix,"
assert old in s
p.write_text(s.replace(old,new,1))

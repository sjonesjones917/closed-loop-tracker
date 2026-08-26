from pathlib import Path

def replace_once(path, old, new):
    p=Path(path);s=p.read_text()
    if s.count(old)!=1: raise SystemExit(f'{path}: expected one occurrence, found {s.count(old)}')
    p.write_text(s.replace(old,new,1))

# Receipts must retain exact run/context/iteration identity from the controlling prompt.
replace_once('response-ingestion.js',
"const receipt={receiptId,jobId:project.job.JOB_ID,stage:Number(stage),role:globalThis.closedLoopCore?.STAGES?.[Number(stage)-1]?.role||'UNKNOWN',contextId:'UNKNOWN',iteration:project.job.CURRENT_ITERATION||'NOT APPLICABLE',runId:'NOT APPLICABLE',requestDateTime:promptRecord.generatedAt||'UNKNOWN'",
"const receipt={receiptId,jobId:project.job.JOB_ID,stage:Number(stage),role:globalThis.closedLoopCore?.STAGES?.[Number(stage)-1]?.role||'UNKNOWN',contextId:promptRecord.scope?.contextId||'NOT APPLICABLE',iteration:promptRecord.scope?.iterationId||project.job.CURRENT_ITERATION||'NOT APPLICABLE',runId:promptRecord.scope?.runId||'NOT APPLICABLE',requestDateTime:promptRecord.generatedAt||'UNKNOWN'")

p=Path('workflow-engine.js');s=p.read_text()
start=s.index("function evaluateIteration(project,iterationId,mode='INITIAL'){")
end=s.index("function deriveMandatoryTestCoverage",start)
old=s[start:end]
new="""function evaluateIteration(project,iterationId,mode='INITIAL'){
  const candidateId=iterationCandidateId(project,iterationId),iterationScope={iterationId,...(candidateId?{candidateId}:{})},matrix=verificationMatrix(project,iterationId),runs=matrix.runs;
  const contextRecords=recordsForCurrentScope(project,'freshContexts',iterationScope),contextById=new Map(contextRecords.map(record=>[recordId(record,'freshContexts'),record])),placeholder=new Set(['','UNASSIGNED','UNKNOWN','PENDING','NOT APPLICABLE','NONE']);
  const resolvedContexts=runs.map(run=>{const id=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||'');const record=contextById.get(id),externalIdentifier=String(recordValue(record,'EXTERNAL_CONTEXT_IDENTIFIER')||'').trim();return {id,record,externalIdentifier};});
  const contexts=new Set(resolvedContexts.filter(item=>item.record&&!placeholder.has(upper(item.externalIdentifier))).map(item=>upper(item.externalIdentifier)));
  const runCandidateIds=runs.map(r=>String(recordValue(r,'CANDIDATE_ID')||r.relationships?.CANDIDATE_ID||r.scope?.candidateId||'').trim()),candidateRecord=records(project,'candidateFreezes').find(r=>recordId(r,'candidateFreezes')===candidateId),candidateManifest=recordValue(candidateRecord,'COMPONENT_MANIFEST')||[],candidateComponentHashes=recordValue(candidateRecord,'COMPONENT_HASHES')||{};
  const contaminated=runs.filter(r=>!['NONE','FALSE','CLEAN','NOT CONTAMINATED'].includes(upper(recordValue(r,'CONTAMINATION_CHECK')))),stage=Number(runs[0]?.stage||0),runIds=new Set(runs.map(r=>recordId(r,'runs')));
  const acceptedRawByRun=new Map(),acceptedReceiptByRun=new Map();
  for(const raw of safe(project.projectData.rawResponses).filter(x=>Number(x.stage)===stage&&!x.invalidatedBy&&x.status==='ACCEPTED_DATA_CHANGE'&&String(x.promptScope?.iterationId||x.iteration||'')===String(iterationId||''))){const runId=String(x.promptScope?.runId||'');if(runIds.has(runId))acceptedRawByRun.set(runId,(acceptedRawByRun.get(runId)||0)+1);}
  for(const receipt of safe(project.projectData.outputReceipts).filter(x=>Number(x.stage)===stage&&x.completionState==='ACCEPTED_DATA_CHANGE'&&String(x.iteration||'')===String(iterationId||''))){const runId=String(receipt.runId||'');if(runIds.has(runId))acceptedReceiptByRun.set(runId,(acceptedReceiptByRun.get(runId)||0)+1);}
  const missingRaw=[...runIds].filter(id=>!acceptedRawByRun.has(id)),missingReceipts=[...runIds].filter(id=>!acceptedReceiptByRun.has(id));
  const comparisons=recordsForCurrentScope(project,'comparisons',iterationScope),defects=recordsForCurrentScope(project,'defects',iterationScope),rca=recordsForCurrentScope(project,'rootCauses',iterationScope),regExec=currentRegressionExecutions(project,iterationId),unexplained=comparisons.filter(r=>truth(recordValue(r,'CORRECTNESS_AFFECTING_VARIANCE'))&&!truth(recordValue(r,'AUTHORIZED_VARIANCE'))),reasons=[];
  if(runs.length!==10)reasons.push('Exactly ten current runs are required.');
  if(resolvedContexts.some(item=>!item.record||placeholder.has(upper(item.externalIdentifier)))||contexts.size!==10)reasons.push('Ten distinct, actually registered external fresh contexts are required.');
  if(!candidateId||!candidateRecord)reasons.push('The iteration must resolve to one existing frozen candidate identity.');
  if(runCandidateIds.some(id=>id!==candidateId))reasons.push('Every current run must reference the exact frozen candidate identity for this iteration.');
  if(!candidateManifest.length||!Object.keys(candidateComponentHashes).length)reasons.push('The frozen candidate must retain its verified component manifest and hashes.');
  if(contaminated.length)reasons.push('A current run is contaminated or contamination is unknown.');
  if(missingRaw.length)reasons.push(`Accepted EXECUTE_RUN raw responses are missing for run(s): ${missingRaw.join(', ')}.`);
  if(missingReceipts.length)reasons.push(`Accepted EXECUTE_RUN receipts are missing for run(s): ${missingReceipts.join(', ')}.`);
  if(mode!=='INITIAL'&&(matrix.expected.length===0||matrix.missing.length||matrix.duplicates.length||matrix.invalid.length))reasons.push('The current REQ × RUN × TEST matrix is incomplete or invalid.');
  if(mode!=='INITIAL'&&!regExec.length&&records(project,'regressions').length)reasons.push('Current regression executions are required.');
  if(unexplained.length)reasons.push('Unexplained correctness-affecting variance remains.');
  return {mode,iterationId,runs:[...runIds],contextCount:contexts.size,contextRecordIds:resolvedContexts.map(item=>item.id),externalContextIdentifiers:resolvedContexts.map(item=>item.externalIdentifier),candidateIds:[...new Set(runCandidateIds)],candidateId,candidateManifestSha256:candidateManifest.length?hash.sha256Value(candidateManifest):null,acceptedRunRawCount:acceptedRawByRun.size,acceptedRunReceiptCount:acceptedReceiptByRun.size,missingRawRunIds:missingRaw,missingReceiptRunIds:missingReceipts,matrix,comparisonCount:comparisons.length,defectCount:defects.length,rootCauseCount:rca.length,regressionExecutionCount:regExec.length,unexplainedVarianceCount:unexplained.length,complete:reasons.length===0,reasons};
}
"""
p.write_text(s[:start]+new+s[end:])

# Add focused negative proof: different output hashes are allowed; wrong candidate and missing per-run receipt/raw fail.
p=Path('verify-complete.mjs');s=p.read_text();marker="console.log(JSON.stringify({"
if marker not in s: raise SystemExit('verify-complete marker absent')
insert="""
// Iteration identity is the frozen candidate, not identical output bytes; every run requires its own accepted raw response and receipt.
{
  const p=project('JOB-ITERATION-IDENTITY'),iterationId='ITERATION-IDENTITY',candidateId='CANDIDATE-IDENTITY';p.job.CURRENT_ITERATION=iterationId;
  const candidate=record('candidateFreezes',10,{ITERATION_ID:iterationId,COMPONENT_MANIFEST:[{artifactId:'A',sha256:'a'.repeat(64)}],COMPONENT_HASHES:{A:'a'.repeat(64)},STATUS:'FROZEN'},candidateId);candidate.scope={iterationId,candidateId};p.projectData.candidateFreezes.push(candidate);
  const iteration=record('iterations',10,{CANDIDATE_ID:candidateId,STATUS:'FROZEN'},iterationId);iteration.scope={iterationId,candidateId};p.projectData.iterations.push(iteration);
  for(let i=1;i<=10;i++){const runId=`RUN-I-${i}`,contextId=`CTX-I-${i}`,ctx=record('freshContexts',11,{ITERATION_ID:iterationId,RUN_ID:runId,EXTERNAL_CONTEXT_IDENTIFIER:`external-${i}`,CONTAMINATION_STATUS:'CLEAN'},contextId);ctx.scope={iterationId,candidateId};p.projectData.freshContexts.push(ctx);const run=record('runs',11,{ITERATION_ID:iterationId,CANDIDATE_ID:candidateId,CONTEXT_ID:contextId,CONTAMINATION_CHECK:'CLEAN',OUTPUT_HASHES:`different-output-${i}`,EXECUTION_STATUS:'COMPLETED'},runId);run.scope={iterationId,candidateId,runId,contextId};p.projectData.runs.push(run);p.projectData.rawResponses.push({rawResponseId:`RAW-I-${i}`,stage:11,status:'ACCEPTED_DATA_CHANGE',promptScope:{iterationId,candidateId,runId,contextId}});p.projectData.outputReceipts.push({receiptId:`REC-I-${i}`,stage:11,completionState:'ACCEPTED_DATA_CHANGE',iteration:iterationId,runId,contextId});}
  let ev=engine.evaluateIteration(p,iterationId,'INITIAL');assert(ev.complete,'Different valid output hashes were incorrectly treated as candidate identity: '+ev.reasons.join(' | '));
  p.projectData.runs[0].fields.CANDIDATE_ID=p.projectData.runs[0].CANDIDATE_ID='CANDIDATE-WRONG';ev=engine.evaluateIteration(p,iterationId,'INITIAL');assert(!ev.complete&&ev.reasons.some(x=>x.includes('exact frozen candidate identity')),'Wrong per-run candidate identity was accepted.');
  p.projectData.runs[0].fields.CANDIDATE_ID=p.projectData.runs[0].CANDIDATE_ID=candidateId;p.projectData.outputReceipts.pop();ev=engine.evaluateIteration(p,iterationId,'INITIAL');assert(!ev.complete&&ev.missingReceiptRunIds.length===1,'Missing per-run receipt was masked by stage-level receipt count.');
  p.projectData.outputReceipts.push({receiptId:'REC-I-10B',stage:11,completionState:'ACCEPTED_DATA_CHANGE',iteration:iterationId,runId:'RUN-I-10',contextId:'CTX-I-10'});p.projectData.rawResponses=p.projectData.rawResponses.filter(x=>x.promptScope.runId!=='RUN-I-9');ev=engine.evaluateIteration(p,iterationId,'INITIAL');assert(!ev.complete&&ev.missingRawRunIds.includes('RUN-I-9'),'Missing per-run raw response was masked by stage-level raw count.');
}

"""
p.write_text(s.replace(marker,insert+marker,1))

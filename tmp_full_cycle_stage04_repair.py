from pathlib import Path
p=Path('verify-full-cycle.mjs')
text=p.read_text()
anchor=" const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData,records,evidence:[evidence(`stage-${stage}-${pr.operation}`)],unresolved:[],warnings:[],attachments:[]};"
insert=""" if(stage===4&&!stageData.OBLIGATION_ACCOUNTING){const manifest=engine.stage04ObligationManifest(p),requirementTempKeys=(records.requirements||[]).map(r=>String(r?.tempKey||'')).filter(Boolean),requiredIntentIds=new Set(engine.recordsForCurrentScope(p,'intentStatements').filter(r=>String(engine.recordValue(r,'REQUIREMENT_RELEVANCE')||'').toUpperCase()==='REQUIREMENT').map(r=>engine.recordId(r,'intentStatements')));stageData.OBLIGATION_ACCOUNTING=(manifest.entries||[]).map(entry=>requiredIntentIds.has(String(entry.sourceIdentity||''))?{obligationId:String(entry.obligationId||''),disposition:'REQUIREMENT',requirementTempKeys:requirementTempKeys.slice(0,1),reason:''}:{obligationId:String(entry.obligationId||''),disposition:'RETAINED_NONNORMATIVE_CONTEXT',requirementTempKeys:[],reason:'Full-cycle fixture retains this application-enumerated project context.'});}
 const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData,records,evidence:[evidence(`stage-${stage}-${pr.operation}`)],unresolved:[],warnings:[],attachments:[]};"""
if text.count(anchor)!=1:
    raise SystemExit(f'full-cycle envelope anchor count {text.count(anchor)}')
text=text.replace(anchor,insert,1)
p.write_text(text)

from pathlib import Path

p=Path('verify-ingestion.mjs')
text=p.read_text()
anchor="  if(!Object.keys(stageData).length&&stage!==1){\n    const collection=writableCollections.find(name=>name!=='blockers'&&schema.recordAgentFields(name).length)||writableCollections.find(name=>schema.recordAgentFields(name).length);"
replacement="  if(!Object.keys(stageData).length&&stage!==1){\n    const collection=writableCollections.find(name=>name!=='blockers'&&schema.recordAgentFields(name).length)||writableCollections.find(name=>schema.recordAgentFields(name).length);"
if anchor not in text:
    raise SystemExit('verify-ingestion fixture anchor missing')
# Insert Stage 04 accounting after records have been synthesized and before the return envelope.
return_anchor="  return {\n    schema:schema.RESPONSE_SCHEMA,"
insert="""  if(stage===4){
    const obligationManifest=engine.stage04ObligationManifest(p);
    stageData.OBLIGATION_ACCOUNTING=(obligationManifest.entries||[]).map(entry=>({obligationId:String(entry.obligationId||''),disposition:'RETAINED_NONNORMATIVE_CONTEXT',requirementTempKeys:[],reason:'Synthetic ingestion fixture retains this application-enumerated obligation as controlling context.'}));
  }
  return {
    schema:schema.RESPONSE_SCHEMA,"""
if text.count(return_anchor)!=1:
    raise SystemExit(f'verify-ingestion return anchor count {text.count(return_anchor)}')
text=text.replace(return_anchor,insert,1)
p.write_text(text)

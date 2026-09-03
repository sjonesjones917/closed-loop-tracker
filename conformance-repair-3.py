from pathlib import Path
p=Path('verify-ingestion.mjs')
s=p.read_text()
old="    const collection=writableCollections.find(name=>name!=='blockers'&&schema.recordAgentFields(name).length)||writableCollections.find(name=>schema.recordAgentFields(name).length);"
new="    const createableCollections=writableCollections.filter(name=>schema.RECORD_SCHEMAS[name]?.commitPolicy!==schema.COLLECTION_POLICIES.UPDATE_RESERVED);\n    const collection=createableCollections.find(name=>name!=='blockers'&&schema.recordAgentFields(name).length)||createableCollections.find(name=>schema.recordAgentFields(name).length);"
if new not in s:
    if old not in s: raise SystemExit('ingestion fixture collection-selection anchor missing')
    s=s.replace(old,new,1)
old_block="""// demonstrated-smart-quote-and-stageData-provenance-regression-v1
{
  let p=project('JOB-SMART-JSON-RECOVERY'),pr=savePrompt(p,1),e=validEnvelope(p,1,pr);
  e.stageData={...e.stageData,EXACT_DELIVERABLE_REQUESTED:'Patent application draft',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'Later filing-route facts'};
  const standard=JSON.stringify(e);const smart=standard.replace(/\"([^\"\\\\]*(?:\\\\.[^\"\\\\]*)*)\"/g,'“$1”');
  const prepared=ingestion.prepare(p,{stage:1,text:smart,promptRecord:pr});
  if(!prepared.validation.valid)throw new Error('Deterministic smart-quote delimiter recovery failed: '+JSON.stringify(prepared.validation.issues));
  if(!prepared.validation.issues.some(x=>x.code==='JSON_TYPOGRAPHY_NORMALIZED'&&x.severity==='WARNING'))throw new Error('Smart-quote recovery was not auditable.');
  if(prepared.rawRecord.completeRawResponse!==smart)throw new Error('Smart-quote recovery changed the preserved raw response.');
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SMART_QUOTE_REGRESSION'});const stageEntries=committed.manifest.entries.filter(x=>x.canonicalCollection==='stageData');
  if(stageEntries.length!==4||stageEntries.some(x=>!Array.isArray(x.evidenceIds)||x.evidenceIds.length===0))throw new Error('StageData provenance is not linked to canonical response evidence.');
}
"""
new_block="""// demonstrated-smart-quote-fail-closed-regression-v2
{
  let p=project('JOB-SMART-JSON-REJECT'),pr=savePrompt(p,1),e=validEnvelope(p,1,pr);
  e.stageData={...e.stageData,EXACT_DELIVERABLE_REQUESTED:'Controlled deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'Later-stage facts'};
  const standard=JSON.stringify(e);const smart=standard.replace(/\"([^\"\\\\]*(?:\\\\.[^\"\\\\]*)*)\"/g,'“$1”');
  const prepared=ingestion.prepare(p,{stage:1,text:smart,promptRecord:pr});
  if(prepared.validation.valid)throw new Error('Authoritative smart-quote JSON was accepted instead of rejected.');
  if(!prepared.validation.issues.some(x=>x.code==='SMART_JSON_QUOTATION'&&x.severity==='ERROR'))throw new Error('Smart-quote rejection did not use the controlling closed failure code.');
  if(prepared.rawRecord.completeRawResponse!==smart)throw new Error('Smart-quote rejection changed the preserved raw response.');
  if(prepared.proposal)throw new Error('Rejected smart-quote response created a canonical proposal.');
}
"""
if new_block not in s:
    if old_block not in s: raise SystemExit('obsolete smart-quote recovery regression anchor missing')
    s=s.replace(old_block,new_block,1)
p.write_text(s)
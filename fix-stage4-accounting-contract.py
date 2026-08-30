from pathlib import Path
p=Path('exhaustive-bootstrap.py')
text=p.read_text()
old="function evaluateObligationAccounting(project,{requirements=[],evidence=[]}={}){\n  const manifest=obligationManifest(project),expected=new Set(manifest.items.map(item=>item.obligationId)),mapped=new Map(),disposed=new Map(),errors=[];"
new="function evaluateObligationAccounting(project,{requirements=null,evidence=null}={}){\n  if(requirements===null)requirements=recordsForCurrentScope(project,'requirements');\n  if(evidence===null)evidence=safe(project?.projectData?.evidenceRecords).filter(record=>isActiveRecord(record)).map(record=>({kind:record?.kind??record?.KIND??record?.fields?.kind??record?.fields?.KIND??'',content:record?.content??record?.CONTENT??record?.fields?.content??record?.fields?.CONTENT??''}));\n  const manifest=obligationManifest(project),expected=new Set(manifest.items.map(item=>item.obligationId)),mapped=new Map(),disposed=new Map(),errors=[];"
if new not in text:
    if old not in text: raise SystemExit('Stage 04 accounting persisted-input anchor missing')
    text=text.replace(old,new,1)
old2="coverage=expected.size?accounted.length/expected.size:1;return {closed:errors.length===0&&coverage===1,coverage,obligationCount:expected.size,accountedCount:accounted.length,missingObligationIds:[...expected].filter(id=>!mapped.has(id)&&!disposed.has(id)),mapped,disposed,errors,manifest};"
new2="coverage=expected.size?accounted.length/expected.size:1,blocked=[...disposed.values()].filter(item=>item.disposition==='BLOCKED');return {closed:errors.length===0&&coverage===1,coverage,obligationCount:expected.size,accountedCount:accounted.length,missingObligationIds:[...expected].filter(id=>!mapped.has(id)&&!disposed.has(id)),mapped,disposed,blocked,errors,manifest};"
if new2 not in text:
    if old2 not in text: raise SystemExit('Stage 04 blocked-disposition source anchor missing')
    text=text.replace(old2,new2,1)
p.write_text(text)

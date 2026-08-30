from pathlib import Path
p=Path('workflow-engine.js')
text=p.read_text()
old="""  const coverage=manifest.obligationCount===0?1:(manifest.obligationCount-missing.length)/manifest.obligationCount;return {stage:4,obligationCount:manifest.obligationCount,requirements:[...mapped],dispositions:[...dispositionById.values()],missing,duplicateDispositionIds:[...duplicates],coverage,closed:errors.length===0,errors};
}"""
new="""  const coverage=manifest.obligationCount===0?1:(manifest.obligationCount-missing.length)/manifest.obligationCount;const dispositions=[...dispositionById.values()],blocked=dispositions.filter(item=>item.disposition==='BLOCKED');return {stage:4,obligationCount:manifest.obligationCount,requirements:[...mapped],dispositions,blocked,missing,duplicateDispositionIds:[...duplicates],coverage,closed:errors.length===0,errors};
}"""
if old not in text:
    raise SystemExit('Stage 04 accounting evaluator return anchor missing')
text=text.replace(old,new,1)
p.write_text(text)

from pathlib import Path
p=Path('exhaustive-bootstrap.py')
text=p.read_text()
old="coverage=expected.size?accounted.length/expected.size:1;return {closed:errors.length===0&&coverage===1,coverage,obligationCount:expected.size,accountedCount:accounted.length,missingObligationIds:[...expected].filter(id=>!mapped.has(id)&&!disposed.has(id)),mapped,disposed,errors,manifest};"
new="coverage=expected.size?accounted.length/expected.size:1,blocked=[...disposed.values()].filter(item=>item.disposition==='BLOCKED');return {closed:errors.length===0&&coverage===1,coverage,obligationCount:expected.size,accountedCount:accounted.length,missingObligationIds:[...expected].filter(id=>!mapped.has(id)&&!disposed.has(id)),mapped,disposed,blocked,errors,manifest};"
if new in text:
    p.write_text(text)
elif old in text:
    text=text.replace(old,new,1)
    p.write_text(text)
else:
    raise SystemExit('Stage 04 accounting evaluator source anchor missing')

from pathlib import Path
p=Path('workflow-engine.js')
text=p.read_text()
needle="dispositions:[...dispositionById.values()]"
replacement="dispositions:[...dispositionById.values()],blocked:[...dispositionById.values()].filter(item=>item.disposition==='BLOCKED')"
if replacement in text:
    p.write_text(text)
elif needle in text:
    text=text.replace(needle,replacement,1)
    p.write_text(text)
else:
    raise SystemExit('Stage 04 accounting disposition token missing')

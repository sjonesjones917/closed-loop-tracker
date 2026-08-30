from pathlib import Path

p = Path('workflow-engine.js')
text = p.read_text()
old = "const VERSION_BY_STAGE=Object.freeze({\n  1:['CURRENT_INPUT_VERSION','INPUT'],2:['CURRENT_SOURCE_SET_VERSION','SOURCE-SET'],3:['CURRENT_RESEARCH_VERSION','RESEARCH'],"
new = "const VERSION_BY_STAGE=Object.freeze({\n  2:['CURRENT_SOURCE_SET_VERSION','SOURCE-SET'],3:['CURRENT_RESEARCH_VERSION','RESEARCH'],"
if old not in text:
    raise SystemExit('VERSION_BY_STAGE Stage 01 anchor missing')
text = text.replace(old, new, 1)
p.write_text(text)

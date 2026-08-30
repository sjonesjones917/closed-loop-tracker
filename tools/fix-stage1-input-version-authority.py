from pathlib import Path

p = Path('workflow-engine.js')
s = p.read_text()
old = "  1:['CURRENT_INPUT_VERSION','INPUT'],2:['CURRENT_SOURCE_SET_VERSION','SOURCE-SET'],3:['CURRENT_RESEARCH_VERSION','RESEARCH'],"
new = "  2:['CURRENT_SOURCE_SET_VERSION','SOURCE-SET'],3:['CURRENT_RESEARCH_VERSION','RESEARCH'],"
if old not in s:
    raise SystemExit('Stage 1 VERSION_BY_STAGE anchor missing')
s = s.replace(old, new, 1)
p.write_text(s)

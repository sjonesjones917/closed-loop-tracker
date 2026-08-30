from pathlib import Path

p = Path('workflow-engine.js')
s = p.read_text()
old = 'function evaluateIntakeCoverage(project,inputSetContents){'
new = 'function evaluateIntakeCoverage(project,inputSetContents=project?.job?.INPUT_SET_CONTENTS){'
if old not in s:
    raise SystemExit('evaluateIntakeCoverage signature anchor missing')
s = s.replace(old, new, 1)
p.write_text(s)

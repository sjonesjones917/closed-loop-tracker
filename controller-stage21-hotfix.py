from pathlib import Path
p=Path('controller-stage21-apply.py')
s=p.read_text()
old="marker='node verify-corrected-iteration.mjs'"
new="marker='node verify-complete.mjs'"
if old not in s:
    raise SystemExit('Stage 21 Pages workflow insertion marker missing')
s=s.replace(old,new,1)
old="blank.activeStage=18;engine.recalculate(blank);"
new="blank.activeStage=18;blank.projectData.humanInputRequests=[];blank.projectData.responseProposals=[];engine.recalculate(blank);"
if old not in s:
    raise SystemExit('Stage 21 negative-fixture cleanup marker missing')
p.write_text(s.replace(old,new,1))

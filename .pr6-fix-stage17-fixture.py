from pathlib import Path
p=Path('verify-full-cycle.mjs')
s=p.read_text()
old="stageData:stageData(17,{PREVIOUS_ITERATION_ID:iterationId,PREVIOUS_CANDIDATE_ID:candidateId,CHANGESET_ID:recordId('changes'),OLD_CONVERSATIONS_CONTINUED:'NO',PRIOR_OUTPUTS_WITHHELD:'YES'})"
new="stageData:stageData(17,{OLD_CONVERSATIONS_CONTINUED:'NO',PRIOR_OUTPUTS_WITHHELD:'YES'})"
assert old in s
p.write_text(s.replace(old,new,1))

from pathlib import Path
import re
# Apply the original deterministic repair, then correct its test literal before syntax/testing.
exec(Path('.repair-stage-agent-ux.py').read_text(),{})
p=Path('verify-prompt-semantics.mjs'); v=p.read_text()
v,n=re.subn(r"\|\|!first\.prompt\.includes\('EXACT_USER_OBJECTIVE_VERBATIM:\nUNKNOWN'\)","||!first.prompt.includes('EXACT_USER_OBJECTIVE_VERBATIM:')||!first.prompt.includes('UNKNOWN')",v,count=1)
assert n==1, 'Generated Stage 01 first-contact assertion was not found'
p.write_text(v)

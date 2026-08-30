from pathlib import Path
import re
p=Path('workflow-engine.js'); t=p.read_text()
new="if(stage===4)return 'Use the current Stage 04 instruction. It already carries current User Job Input, the complete canonical Stage 01 intent-statement ledger and accepted job definition, and the complete accepted Stage 03 research and candidate obligations. Do not attach, resend, reopen, or otherwise reuse the original intent file. Do not ask the user to repeat any project information already captured. If required canonical context is incomplete, return the exact earlier-stage deficiency and block Stage 04 until that earlier stage is exhausted.';"
pattern=r"if\(stage===4\)return '(?:[^'\\]|\\.)*';"
updated,count=re.subn(pattern,new,t,count=1)
if count!=1: raise SystemExit(f'Stage 4 next-action target count={count}')
p.write_text(updated)

from pathlib import Path
p=Path('workflow-engine.js'); t=p.read_text()
old="if(stage===4)return 'Use the current Stage 04 instruction. It already carries current User Job Input, the accepted Stage 01 job definition, and accepted Stage 03 findings. Do not attach or resend the original intent file. If required canonical context is incomplete, return the exact earlier-stage deficiency instead of asking the user to provide the same material again.';"
new="if(stage===4)return 'Use the current Stage 04 instruction. It already carries current User Job Input, the complete canonical Stage 01 intent-statement ledger and accepted job definition, and the complete accepted Stage 03 research and candidate obligations. Do not attach, resend, reopen, or otherwise reuse the original intent file. Do not ask the user to repeat any project information already captured. If required canonical context is incomplete, return the exact earlier-stage deficiency and block Stage 04 until that earlier stage is exhausted.';"
if old not in t: raise SystemExit('Stage 4 next-action target missing')
p.write_text(t.replace(old,new,1))

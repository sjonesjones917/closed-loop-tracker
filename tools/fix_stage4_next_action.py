from pathlib import Path
p=Path('workflow-engine.js'); t=p.read_text()
old="The current Stage 04 instruction already contains the application-generated obligation manifest and captured project intent. Do not attach, resend, retype, summarize, or reopen the original intent file."
new="The current Stage 04 instruction already contains current User Job Input, the complete canonical Stage 01 intent-statement ledger and accepted job definition, and the complete accepted Stage 03 research and candidate obligations through the application-generated obligation manifest. Do not attach, resend, reopen, retype, summarize, or otherwise reuse the original intent file. Do not ask the user to repeat project information already captured. If required canonical context is incomplete, Stage 04 must block on the exact earlier-stage deficiency until that earlier stage is exhausted."
if old not in t: raise SystemExit('structured Stage 4 explanation target missing')
p.write_text(t.replace(old,new,1))

from pathlib import Path
p=Path('prompt-engine.js'); t=p.read_text()
old='Preserve the exact requested deliverable; do not downgrade it merely because a downstream viewing or execution tool is unavailable.'
new='Preserve the exact requested deliverable; do not downgrade it merely because a downstream viewing or execution tool is unavailable. If a genuinely necessary substitute deliverable is proposed because the requested deliverable cannot later be completed reliably, place the exact substitute in EXACT_DELIVERABLE_REQUESTED and require genuine human intent confirmation before treating that substitute as authority; never silently substitute it.'
if new not in t:
    if old not in t: raise SystemExit('Stage 01 deliverable preservation anchor missing')
    t=t.replace(old,new,1)
p.write_text(t)
print('Stage 01 substitute deliverable now requires human intent confirmation')

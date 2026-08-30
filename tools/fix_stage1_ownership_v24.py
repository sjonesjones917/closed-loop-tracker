from pathlib import Path
p=Path('prompt-engine.js'); t=p.read_text()
anchor="Stage 01 is COMPLETE HUMAN-AUTHORITY INTAKE. Exhaust the user intent before Stage 01 can complete."
insert="Stage 01 is COMPLETE HUMAN-AUTHORITY INTAKE. The application already owns JOB_ID, DATE_OPENED, the current input version, canonical hashes, lifecycle state, and Stage 01 gate state; do not assign or overwrite them. Exhaust the user intent before Stage 01 can complete."
if insert not in t:
    if anchor not in t: raise SystemExit('Stage 01 ownership insertion anchor missing')
    t=t.replace(anchor,insert,1)
p.write_text(t)
print('Stage 01 application ownership is explicit')

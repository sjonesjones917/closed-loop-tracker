from pathlib import Path
p=Path('build-test-project.mjs')
s=p.read_text()
old="for(const token of ['Parse / validate response','Proposed extracted changes','Accept response','Reject response','Request correction','Human-owned stage input','Application-derived job control','Independent external sources only.'])if(!app.includes(token))throw new Error(`Human-facing ingestion UI missing: ${token}`);"
new="for(const token of ['Parse / validate response','Proposed extracted changes','Accept response','Reject response','Request correction','Human-owned stage input','Application-derived job control'])if(!app.includes(token))throw new Error(`Human-facing ingestion UI missing: ${token}`);\nif(app.includes('Independent external sources only.'))throw new Error('Agent-facing Stage 02 semantics leaked back into the operator UI instead of remaining in the controlling prompt.');"
if old not in s: raise SystemExit('stale UI assertion marker missing')
p.write_text(s.replace(old,new,1))

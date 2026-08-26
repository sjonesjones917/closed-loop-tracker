from pathlib import Path
p=Path('workflow-engine.js');s=p.read_text()
old="const evidenceIds=new Set();for(const r of results){for(const id of safe(r.evidenceIds))evidenceIds.add(id);if(recordValue(r,'EVIDENCE_ID'))evidenceIds.add(recordValue(r,'EVIDENCE_ID'));}"
new="const evidenceIds=new Set();for(const r of results){for(const id of safe(r.evidenceRefs))evidenceIds.add(id);for(const id of safe(r.evidenceIds))evidenceIds.add(id);if(recordValue(r,'EVIDENCE_ID'))evidenceIds.add(recordValue(r,'EVIDENCE_ID'));}"
assert old in s
p.write_text(s.replace(old,new,1))

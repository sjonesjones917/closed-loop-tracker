from pathlib import Path
p=Path('workflow-engine.js');s=p.read_text()
old="safe(recordValue(product,'GENERATED_ARTIFACT_INVENTORY')).map(String)"
new="(Array.isArray(recordValue(product,'GENERATED_ARTIFACT_INVENTORY'))?recordValue(product,'GENERATED_ARTIFACT_INVENTORY'):String(recordValue(product,'GENERATED_ARTIFACT_INVENTORY')||'').split(/[,|\\n]+/)).map(String).map(x=>x.trim()).filter(Boolean)"
assert s.count(old)==2,s.count(old)
p.write_text(s.replace(old,new))

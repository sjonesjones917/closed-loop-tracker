from pathlib import Path
p=Path('workflow-engine.js');s=p.read_text()
old="""  if(instruction){const fields=recordFields(instruction),definition=schema.RECORD_SCHEMAS.instructions;for(const field of definition?.required||[])walk(fields[field],field);}"""
new="""  if(instruction){const fields=recordFields(instruction);for(const field of schema.recordAgentFields('instructions'))walk(fields[field],field);}"""
if old not in s: raise SystemExit('preflight instruction enumeration anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
for name in ['index.html','app-core.js','test-runtime.js']:
    f=Path(name);f.write_text(f.read_text().replace('runtime-20260830-live-operator-67','runtime-20260830-live-operator-68'))

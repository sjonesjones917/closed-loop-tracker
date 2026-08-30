from pathlib import Path

root=Path(__file__).resolve().parents[1]

p=root/'workflow-schema.js'
s=p.read_text(encoding='utf-8')
old="'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS','INPUTS'"
new="'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC_SHA256','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS','INPUTS'"
if old not in s:
    raise SystemExit('workflow-schema.js Test IR field-list anchor missing')
s=s.replace(old,new,1)
s=s.replace('valueType:VALUE_TYPES.ENUM', "valueType:'STRING'")
s=s.replace('valueType:VALUE_TYPES.STRING_ARRAY', "valueType:'STRING_ARRAY'")
s=s.replace('valueType:VALUE_TYPES.STRING', "valueType:'STRING'")
s=s.replace('valueType:VALUE_TYPES.OBJECT', "valueType:'OBJECT'")
p.write_text(s,encoding='utf-8')

p=root/'prompt-engine.js'
s=p.read_text(encoding='utf-8')
old='EXECUTABLE_KIND = TEST_IR, EXECUTABLE_SPEC_VERSION = ${schema.TEST_IR.version}, and provide EXECUTABLE_SPEC plus EXECUTABLE_INPUT_BINDINGS.'
new='EXECUTABLE_KIND = TEST_IR, and provide EXECUTABLE_SPEC plus EXECUTABLE_INPUT_BINDINGS. The application stamps EXECUTABLE_SPEC_VERSION = ${schema.TEST_IR.version} and the canonical executable-spec SHA-256 after validated ingestion.'
if old not in s:
    raise SystemExit('prompt-engine.js Stage 06 Test IR ownership anchor missing')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

p=root/'response-ingestion.js'
s=p.read_text(encoding='utf-8')
anchor='  const relationshipIssues=[];'
insertion="""  for(const record of canonicalRecords.tests||[]){
    record.fields=record.fields||{};
    record.fields.EXECUTABLE_SPEC_VERSION=schema.TEST_IR.version;
    record.fields.EXECUTABLE_SPEC_SHA256=String(record.fields.EXECUTABLE_KIND||'').toUpperCase()==='TEST_IR'?hash.sha256Value(record.fields.EXECUTABLE_SPEC):null;
  }

"""
if anchor not in s:
    raise SystemExit('response-ingestion.js relationship-validation anchor missing')
s=s.replace(anchor,insertion+anchor,1)
p.write_text(s,encoding='utf-8')

# Remove every temporary repair-only artifact. Permanent verification remains.
for rel in [
    'tools/complete-controlling-spec-repair.py',
    'tools/execute-controlling-spec-repair.py',
    'tools/apply-controlling-spec-fix.py',
    '.github/workflows/apply-controlling-spec-fix.yml',
    '.github/workflows/apply-controlling-spec-fix-v2.yml',
    '.github/workflows/apply-controlling-spec-fix-v3.yml',
    'repair-diagnostic.log'
]:
    q=root/rel
    if q.exists(): q.unlink()

print('controlling-spec completion patches applied')

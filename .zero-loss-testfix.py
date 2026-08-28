from pathlib import Path

path = Path('verify-ingestion.mjs')
text = path.read_text()
old = "function safeValue(name){\n  if(/ARTIFACT_REQUIREMENTS/.test(name))return 'NONE';\n"
new = "function safeValue(name){\n  const controlled=String(name).toUpperCase();\n  if(controlled==='EXECUTION_OUTCOME')return 'REJECTED_INVALID';\n  if(controlled==='PREFLIGHT_OBSERVATION')return 'NO_MATERIAL_DEFECT';\n  if(controlled==='OBSERVATION_OUTCOME')return 'SATISFIED';\n  if(/ARTIFACT_REQUIREMENTS/.test(name))return 'NONE';\n"
if text.count(old) != 1:
    raise SystemExit(f'controlled ingestion fixture target mismatch: {text.count(old)}')
path.write_text(text.replace(old, new, 1))

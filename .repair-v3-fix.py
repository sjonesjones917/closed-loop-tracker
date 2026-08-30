from pathlib import Path
p=Path('.repair-v3.py')
s=p.read_text()
s=s.replace("EXECUTABLE_SPEC.steps[${index}] uses unsupported operation ${String(step.op)}.","Step ${index} uses unsupported operation ${String(step.op||'UNKNOWN')}.")
p.write_text(s)
print('repair matcher corrected')

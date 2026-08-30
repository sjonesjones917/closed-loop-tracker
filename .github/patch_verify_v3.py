from pathlib import Path
p=Path('verify.mjs');s=p.read_text()
s=s.replace("'workflow-schema.js','workflow-engine.js'","'workflow-schema.js','test-runtime.js','workflow-engine.js'")
s=s.replace("'workflow-schema.js','workflow-engine.js','prompt-engine.js'","'workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'")
s=s.replace("'Revise the Responsible Layer'","'Correct the Root Cause'")
p.write_text(s)

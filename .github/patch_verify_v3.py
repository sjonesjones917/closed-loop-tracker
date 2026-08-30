from pathlib import Path
p=Path('verify.mjs');s=p.read_text()
s=s.replace("'workflow-schema.js','workflow-engine.js'","'workflow-schema.js','test-runtime.js','workflow-engine.js'")
s=s.replace("'workflow-schema.js','workflow-engine.js','prompt-engine.js'","'workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'")
s=s.replace("'Revise the Responsible Layer'","'Correct the Root Cause'")
s=s.replace("'closed-loop-stage-response/2'","'closed-loop-stage-response/3'")
s=s.replace("core.PROJECT_SCHEMA==='closed-loop-project/2'","core.PROJECT_SCHEMA==='closed-loop-project/3'")
s=s.replace("schema.RESPONSE_SCHEMA==='closed-loop-stage-response/2'","schema.RESPONSE_SCHEMA==='closed-loop-stage-response/3'")
s=s.replace("'Response schema /2 is required.'","'Response schema /3 is required.'")
p.write_text(s)
# retrigger marker: current verifier expectations are v3

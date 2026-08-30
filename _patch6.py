from pathlib import Path
for name in ['build-test-project.mjs','verify.mjs']:
 p=Path(name);s=p.read_text().replace("'workflow-schema.js','workflow-engine.js'","'workflow-schema.js','test-runtime.js','workflow-engine.js'");p.write_text(s)

from pathlib import Path
p=Path('verify-hash.mjs');s=p.read_text().replace("'workflow-schema.js','workflow-engine.js'","'workflow-schema.js','test-runtime.js','workflow-engine.js'");p.write_text(s)

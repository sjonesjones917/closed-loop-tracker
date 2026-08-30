from pathlib import Path
old='runtime-5859ee5a07f239ae';new='runtime-b288410245b5dcfd'
for name in ['index.html','app-core.js','test-worker.js','verify-browser.mjs','verify-browser-extra.mjs','verify-live.mjs']:
 p=Path(name);p.write_text(p.read_text().replace(old,new))
p=Path('verify-hash.mjs');s=p.read_text().replace("'workflow-schema.js','workflow-engine.js'","'workflow-schema.js','test-runtime.js','workflow-engine.js'");p.write_text(s)

from pathlib import Path
for name in ['prompt-engine.js','verify-prompt-semantics.mjs','verify-intent-capture.mjs']:
    p=Path(name); t=p.read_text(); t=t.replace("the user's actual request","the actual user request"); p.write_text(t)
print('Stage 01 subject-neutral project-derived question wording is JS-literal safe')

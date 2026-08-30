from pathlib import Path
p=Path('prompt-engine.js')
s=p.read_text()
old="const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/36';"
new="const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/38';"
if old not in s:
    raise SystemExit('expected prompt-engine identity not found')
p.write_text(s.replace(old,new,1))

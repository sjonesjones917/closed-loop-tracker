from pathlib import Path

path = Path('verify-prompt-semantics.mjs')
text = path.read_text()
old = "  if(before.contextManifest.executionHandoff.send.length||before.contextManifest.executionHandoff.withhold.length||before.contextManifest.executionHandoff.expectBack.length)throw new Error('Stage 04 context manifest incorrectly contains an execution handoff.');"
new = "  const stage04Handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});\n  if(stage04Handoff.send.length||stage04Handoff.withhold.length||stage04Handoff.expectBack.length)throw new Error('Stage 04 incorrectly contains an execution handoff.');"
if text.count(old) != 1:
    raise SystemExit('Expected one Stage 04 prompt regression assertion to correct')
path.write_text(text.replace(old, new, 1).rstrip() + '\n')
Path('.github/stage04-test-fix.py').unlink()

from pathlib import Path

# Apply the already-defined minimal source repair and its syntax-test correction.
exec(Path('.repair-stage-agent-ux-v2.py').read_text(), {})

# Replace the obsolete regression expectation that forbade proactive Stage 01 intake.
p=Path('verify-prompt-semantics.mjs')
v=p.read_text()
old="  'Never ask for information merely because a later stage will need it',"
new="  'Stage 01 also owns proactive human intake: before finalizing Stage 01, collect the human-specific facts and decisions that are already foreseeable as necessary to achieve the requested outcome',"
assert old in v, 'Obsolete Stage 01 deferral-only test expectation not found'
v=v.replace(old,new,1)
p.write_text(v)

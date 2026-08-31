from pathlib import Path

path = Path('verify-full-cycle.mjs')
text = path.read_text()
old = "EXPLICIT_USER_REQUIREMENTS:'The deliverable must contain the required verified content.',CURRENT_INPUT_VERSION:'INPUT-v001'"
new = "EXPLICIT_USER_REQUIREMENTS:'The deliverable must contain the required verified content.',AVAILABLE_TOOLS:'fixture-required_capability',CURRENT_INPUT_VERSION:'INPUT-v001'"
if old not in text:
    raise AssertionError('Full-cycle job fixture initialization was not found.')
path.write_text(text.replace(old, new, 1))
print('Full-cycle fixture now affirmatively declares the external capability required by its Stage 06 tests; production missing-capability blocking remains unchanged.')

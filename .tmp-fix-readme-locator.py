from pathlib import Path
import re
p=Path('/tmp/test-artifact-custody.py')
s=p.read_text()
block="""# 5) Documentation: describe the now-enforced custody rule.
patch('README.md',
'''When an external agent returns an actual file, its response declares the attachment and the operator attaches the exact returned bytes in the stage file control before parsing. The application then verifies the actual filename/media type/byte size/SHA-256 and stores the Blob. A filename, hash claim, repository path, or code block alone never counts as possession of a file, and browser-local bytes are not assumed to be accessible to an external agent.''',
'''When an external agent returns an actual file, its response declares the attachment and the operator attaches the exact returned bytes in the stage file control before parsing. The application then verifies the actual filename/media type/byte size/SHA-256 and stores the Blob. A filename, hash claim, repository path, or code block alone never counts as possession of a file, and browser-local bytes are not assumed to be accessible to an external agent. When a TEST has `ARTIFACT_REQUIREMENTS` other than `NONE`, the application derives `TEST_ARTIFACT_IDS` only from evidence linked to those verified bytes, and Stage 6 remains blocked until that canonical custody link exists.''')

# 6) Acceptance proof:"""
s,n=re.subn(r'# 5\) Documentation:.*?# 6\) Acceptance proof:',block,s,flags=re.S)
if n!=1: raise SystemExit(f'Expected one README patch section, found {n}')
p.write_text(s)

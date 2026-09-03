from pathlib import Path
import runpy

root=Path('.')
legacy=root/'repair-authoritative-exchange.py'
if legacy.exists():
    runpy.run_path(str(legacy),run_name='__main__')

prompt=root/'prompt-engine.js'
text=prompt.read_text()
needle="    'Continue normal concise human conversation only when genuinely required. When ready, return one authoritative UTF-8 response.json file plus any required returned files in the named attachment slots.',"
replacement="    'Continue normal concise human conversation only when genuinely required. Return the final response as response.json and any required files. Use the named attachment slots for every returned file.',"
if needle in text:
    text=text.replace(needle,replacement,1)
elif 'Return the final response as response.json and any required files.' not in text:
    raise RuntimeError('authoritative prompt final-response marker is missing')
prompt.write_text(text)

regression=root/'verify-file-first-response.mjs'
regression_text=regression.read_text().replace("assert.equal(descriptor.contractProfileId,schema.CONTRACT_PROFILE_ID,'Response contract is not bound to the current contract profile.');","assert.equal(descriptor.contractProfileId,core.CONTRACT_PROFILE,'Response contract is not bound to the current contract profile.');")
regression.write_text(regression_text)

from pathlib import Path
import runpy

root=Path('.')
base=root/'repair-authoritative-exchange.py'
if base.exists():
    text=base.read_text()
    text=text.replace("s=replace_range(s,start,end,attachment_validation,end,'attachment validation')","s=replace_range(s,start,end,attachment_validation,'attachment validation')")
    base.write_text(text)

for candidate in ('repair-authoritative-exchange-v3.py','repair-authoritative-exchange-v2.py','repair-authoritative-exchange.py'):
    path=root/candidate
    if path.exists():
        runpy.run_path(str(path),run_name='__main__')
        break

prompt=root/'prompt-engine.js'
if prompt.exists():
    text=prompt.read_text()
    required='Return the final response as response.json and any required files.'
    if required not in text:
        text=text.replace(
            'Continue normal concise human conversation only when genuinely required. When ready, return one authoritative UTF-8 response.json file plus any required returned files in the named attachment slots.',
            'Continue normal concise human conversation only when genuinely required. Return the final response as response.json and any required files. Use the named attachment slots for every returned file.'
        )
    if required not in text:
        raise RuntimeError('authoritative response.json instruction remains absent')
    prompt.write_text(text)

regression=root/'verify-file-first-response.mjs'
if regression.exists():
    text=regression.read_text().replace(
        "assert.equal(descriptor.contractProfileId,schema.CONTRACT_PROFILE_ID,'Response contract is not bound to the current contract profile.');",
        "assert.equal(descriptor.contractProfileId,core.CONTRACT_PROFILE,'Response contract is not bound to the current contract profile.');"
    )
    regression.write_text(text)

print('authoritative exchange v4 repair applied')

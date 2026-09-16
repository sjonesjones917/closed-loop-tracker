"""Materialize and test the existing exact repair; retain publication inputs.

The immutable JSON blobs are readable, digest-bound data edits, not executable
scripts. Both transport files are removed from the candidate. This program does
not update a branch, deploy the application, or claim browser acceptance.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request

BASE = '6f9c93a9b6ca9934459dddbefbd9c80ed9f05fe8'
TRANSPORT = {'.github/operator-repair.py', '.github/workflows/transfer-verified-operator-repair.yml'}
FILES = {'.github/workflows/pages.yml', 'app-core.js', 'project-store.js', 'prompt-engine.js', 'response-ingestion.js', 'verify-browser-extra.mjs', 'verify-complete-operator-journey.mjs', 'verify-complete.mjs', 'verify-file-first-operator.mjs', 'verify-full-cycle.mjs', 'verify-ingestion.mjs', 'verify-operator-action-lifecycle.mjs', 'verify-operator-control-state-fault.mjs', 'verify-operator-counterpart.mjs', 'verify-product-attachment-journey.mjs', 'verify-project-lifecycle.mjs', 'verify-response-authority-integrity.mjs', 'verify-returned-slot-authority.mjs'}
PAYLOADS = [
    ('5807356a4fcfc3876c6a81f32cee69b1a91468c8', '15c5ffc64f9d75a8ae3847db76f883675aa174ae457e08b6d5539d39a7a39a57'),
    ('5f6a7574dfbaf82ca934bb6e875dda0808377017', '0f80befbec586583370ee27767c30e5cc289ea150857d33e98fc406195d153f9'),
    ('ac378b0b6ba95f4b5ae41108c6547772cdd4e7eb', 'a217e8d2f18bbbd41d251b1e129354b31e7a2568d1b78822d0b3e2426c6eda54'),
    ('ddc307cd1d27c4a8316d878b9f7ee6514fb2c272', 'd184da6f6f90b498998b4d0a365aca7e86926efdbaa3d3a6c44d64f50d75231b'),
    ('0f34235da493f72a5e86605f69b5de41120edf29', '43374474dbe407b6fd4392bf2498bf4a9ca479884ff48c268587239128bf0379'),
    ('e92112b0f4f2d00b07b726901641bb84c29ecc79', 'bd60b73a74f4a4470f0aa95683530234592f2b1636d078e5bc40806a8f7b100f'),
    ('25fc4db1bb7a470342b33c07b19ab0fde3d2b6ba', '03fb209026dd58f55f3c3e98437aef8b68b4628cd941feda2d3fb8a73c9dfc1c'),
]

def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()

def digest(data):
    return hashlib.sha256(data).hexdigest()

repository = os.environ['REPOSITORY']
assert repository == 'sjonesjones917/closed-loop-tracker'
api = 'https://api.github.com/repos/' + repository

def request(route, body=None):
    data = None if body is None else json.dumps(body).encode('utf-8')
    req = urllib.request.Request(api + route, data=data, method='GET' if body is None else 'POST', headers={
        'Authorization': 'Bearer ' + os.environ['GH_TOKEN'],
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
    })
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)

parent = git('rev-parse', 'HEAD')
base_tree = git('rev-parse', 'HEAD^{tree}')
assert set(git('diff', '--name-only', BASE, 'HEAD').splitlines()) == TRANSPORT, 'Concurrent product changes: refusing to overwrite'
repairs = {}
for blob_sha, expected_digest in PAYLOADS:
    blob = request('/git/blobs/' + blob_sha)
    assert blob['sha'] == blob_sha and blob['encoding'] == 'base64'
    raw = base64.b64decode(blob['content'])
    assert digest(raw) == expected_digest, 'Repair payload digest mismatch'
    part = json.loads(raw.decode('utf-8'))
    assert not set(part).intersection(repairs), 'Duplicate file repair'
    repairs.update(part)
assert set(repairs) == FILES

outputs = {}
for name, repair in repairs.items():
    path = Path(name)
    if repair['before'] is None:
        assert not path.exists(), 'Unexpected existing file: ' + name
        source = ''
    else:
        raw = path.read_bytes()
        assert digest(raw) == repair['before'], 'Unexpected source bytes: ' + name
        source = raw.decode('utf-8')
    previous_end = 0
    for start, end, text in repair['edits']:
        assert type(start) is int and type(end) is int and isinstance(text, str)
        assert previous_end <= start <= end <= len(source), 'Invalid edit range'
        previous_end = end
    for start, end, text in reversed(repair['edits']):
        source = source[:start] + text + source[end:]
    raw = source.encode('utf-8')
    assert digest(raw) == repair['after'], 'Reconstructed source mismatch: ' + name
    outputs[name] = raw
for name, raw in outputs.items():
    Path(name).write_bytes(raw)
for name in TRANSPORT:
    Path(name).unlink()

checks = []
logdir = Path('/tmp/exact-operator-repair-checks')
logdir.mkdir(exist_ok=True)
commands = [['node', '--check', name] for name in sorted(FILES) if name.endswith(('.js', '.mjs'))]
commands += [['node', name] for name in [
    'verify-test-runtime-limits.mjs',
    'verify-ingestion.mjs',
    'verify-operator-action-lifecycle.mjs',
    'verify-operator-control-state-fault.mjs',
    'verify-ui-acceptance-impact.mjs',
    'verify-ui-persistence-preconditions.mjs',
    'verify-file-first-operator.mjs',
    'verify-data-route-closure.mjs',
    'verify-project-lifecycle.mjs',
    'verify-build-stage-ledger.mjs',
    'verify-complete.mjs',
]]
for index, command in enumerate(commands):
    started = time.monotonic()
    logfile = logdir / (str(index).zfill(2) + '.log')
    with logfile.open('w') as stream:
        result = subprocess.run(command, stdout=stream, stderr=subprocess.STDOUT, timeout=720)
    check = {'command': command, 'exitCode': result.returncode, 'seconds': round(time.monotonic() - started, 3), 'logSha256': digest(logfile.read_bytes())}
    checks.append(check)
    print(json.dumps(check), flush=True)
    if result.returncode:
        print(logfile.read_text()[-12000:], flush=True)
        raise RuntimeError('Mandatory candidate check failed')

expected_tracked = {name for name, repair in repairs.items() if repair['before'] is not None} | TRANSPORT
assert set(git('diff', '--name-only').splitlines()) == expected_tracked, 'Unexpected tracked source mutation'
entries = []
for name in sorted(FILES):
    raw = Path(name).read_bytes()
    assert raw == outputs[name], 'A verification command changed candidate source'
    blob = request('/git/blobs', {'content': raw.decode('utf-8'), 'encoding': 'utf-8'})['sha']
    assert blob == git('hash-object', name), 'Git source object mismatch'
    entries.append({'path': name, 'mode': '100644', 'type': 'blob', 'sha': blob})
for name in sorted(TRANSPORT):
    entries.append({'path': name, 'mode': '100644', 'type': 'blob', 'sha': None})
git('add', '--', *sorted(FILES | TRANSPORT))
assert set(git('diff', '--cached', '--name-only').splitlines()) == FILES | TRANSPORT
expected_tree = git('write-tree')
# The Actions token rejected creating this workflow-containing tree. Retain the
# exact verified objects for publication by the connected authorized GitHub
# account. This is a transfer manifest, not a successful publication claim.
manifest = {
    'candidate': None,
    'parent': parent,
    'baseTree': base_tree,
    'expectedTree': expected_tree,
    'treeEntries': entries,
    'publicationRequired': True,
    'branchUpdated': False,
    'actualBrowserJourney': False,
    'physicalDeviceAcceptance': False,
    'files': {name: digest(outputs[name]) for name in sorted(FILES)},
    'checks': checks,
}
Path('candidate-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest), flush=True)

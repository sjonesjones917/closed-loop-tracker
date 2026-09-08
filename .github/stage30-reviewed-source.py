"""Temporary, digest-pinned source transport. Never merge this bootstrap commit.
The prepared tree restores the complete verification/deployment workflow and removes
this script and its payload. An owner-created commit must run the ordinary PR test
job successfully before any merge. This transport performs no acceptance or release.
"""
import gzip
import hashlib
import io
import json
from pathlib import Path
import subprocess

BASE = 'c4ad551fa4de6deae81a83d12a66df4ca5ca0dab'
BASE_TREE = 'eb015d298a036fb1488278805d940bf344f90ba7'
REVIEWED_TREE = 'c68bd23e9009ef58ec4fe00f665608e2944c24f6'
FINAL_TREE = 'ccb5cc86b748e0f10ba70e1cc81fb4e06d87e8da'
BUNDLE_SHA256 = '745e7d56eabd9e03554d3625d129a9f83ec9a5ef8d8c3982008b8d1571c9d0cd'
DESTINATION = 'refs/heads/controller/stage30-prepared-ccb5cc86b748'
ALLOWED = {'.github/workflows/pages.yml','app-core.js','final-acceptance.mjs','project-store.js','prompt-engine.js','response-ingestion.js','verify-browser-extra.mjs','verify-controller-v3-gap-closure.mjs','verify-final-acceptance.mjs','verify-final-product-timing.mjs','verify-full-cycle.mjs','verify-ingestion.mjs','verify-prompt-file-identity.mjs','verify-prompt-semantics.mjs','verify-v3-definition-of-done.mjs','workflow-engine.js'}
FOLLOWUP = {'path':'verify-complete.mjs','beforeSha256':'dfc40cb31a72d02217d7d4a2d5a55d0f36e94b50b7467be416da022825f08072','afterSha256':'f39ff84974adb1af8967a61b1223962d1ecc0a0366ea13f6fa738d78ab6a4883','edits':[[59165,59435,",CURRENT_PRODUCT_VERSION:'PRODUCT-v001'});\n  const scope=engine.currentScope(p),req=record('requirements',4,{OBLIGATION:'Native deterministic proposition',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'},'REQ-NATIVE-22');\n  const native=record('tests',6,{REQ_ID:'REQ-NATIVE-22',TEST_TYPE:'DETERMINISTIC',VERIFICATION_PHASE:'FINAL_PRODUCT_DETERMINISTIC',EARLIEST_EXECUTABLE_STAGE:22,REQUIRED_BY_STAGE:22,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:true,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{phaseTarget:true}"]]}

def git(*args):
    return subprocess.check_output(['git', *args]).decode().strip()

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def apply(entry):
    path = Path(entry['path'])
    require(not path.is_symlink(), 'Symlink target rejected')
    before = path.read_bytes() if path.exists() else b''
    require((hashlib.sha256(before).hexdigest() if path.exists() else None) == entry['beforeSha256'], 'Source bytes changed: ' + str(path))
    cursor = 0
    for start, end, text in entry['edits']:
        require(type(start) is int and type(end) is int and cursor <= start <= end <= len(before) and isinstance(text, str), 'Invalid or overlapping source edit')
        cursor = end
    after = before
    for start, end, text in reversed(entry['edits']):
        after = after[:start] + text.encode('utf-8') + after[end:]
    require(hashlib.sha256(after).hexdigest() == entry['afterSha256'], 'Result digest mismatch: ' + str(path))
    path.write_bytes(after)

require(git('rev-parse', 'HEAD^') == BASE, 'Unexpected bootstrap parent')
require(git('rev-parse', BASE + '^{tree}') == BASE_TREE, 'Unexpected baseline tree')
require(not git('status', '--porcelain'), 'Workspace is not clean')
parts = [Path('.github/stage30-reviewed-source.part' + str(i)) for i in range(1, 4)]
compressed = b''.join(path.read_bytes() for path in parts)
require(hashlib.sha256(compressed).hexdigest() == BUNDLE_SHA256, 'Transport bytes mismatch')
with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as stream:
    text = stream.read(2 * 1024 * 1024 + 1)
require(len(text) <= 2 * 1024 * 1024, 'Source bundle exceeds size limit')
bundle = json.loads(text)
require(bundle['schema'] == 'closed-loop-reviewed-source-edits/1' and bundle['baseCommit'] == BASE and bundle['baseTree'] == BASE_TREE and bundle['expectedTree'] == REVIEWED_TREE, 'Unexpected source manifest')
require(len(bundle['files']) == len(ALLOWED) and {entry['path'] for entry in bundle['files']} == ALLOWED, 'Unexpected source change set')
Path('.github/workflows/pages.yml').write_bytes(subprocess.check_output(['git','show',BASE + ':.github/workflows/pages.yml']))
for entry in bundle['files']:
    apply(entry)
for path in parts + [Path(__file__)]:
    path.unlink()
subprocess.run(['git','add','-A'],check=True)
require(git('write-tree') == REVIEWED_TREE, 'Reviewed tree mismatch; no commit or push allowed')
apply(FOLLOWUP)
subprocess.run(['git','add','-A'],check=True)
require(git('write-tree') == FINAL_TREE, 'Final tree mismatch; no commit or push allowed')
subprocess.run(['git','config','user.name','closed-loop-source-transport'],check=True)
subprocess.run(['git','config','user.email','closed-loop-source-transport@users.noreply.github.com'],check=True)
subprocess.run(['git','commit','-m','Materialize exact reviewed Stage 30 repair; ordinary PR verification still required'],check=True)
subprocess.run(['git','push','origin','HEAD:' + DESTINATION],check=True)
print(json.dumps({'preparedCommit':git('rev-parse','HEAD'),'preparedTree':FINAL_TREE,'destination':DESTINATION,'acceptanceClaimed':False,'releaseTagCreated':False}))

#!/usr/bin/env python3
from __future__ import annotations
import base64
import gzip
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / 'payload-manifest.json').read_text())
DIST = ROOT / 'dist'

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)

encoded_parts: list[str] = []
for record in MANIFEST['payload']['parts']:
    path = ROOT / record['file']
    data = path.read_bytes()
    require(len(data) == record['length'], f"Length mismatch: {record['file']}")
    require(sha256(data) == record['sha256'], f"SHA-256 mismatch: {record['file']}")
    encoded_parts.append(data.decode('ascii'))

encoded = ''.join(encoded_parts)
require(len(encoded) == MANIFEST['payload']['encodedLength'], 'Encoded payload length mismatch.')
application = gzip.decompress(base64.b64decode(encoded, validate=True))
require(len(application) == MANIFEST['application']['size'], 'Application byte size mismatch.')
require(sha256(application) == MANIFEST['application']['sha256'], 'Application SHA-256 mismatch.')

# Semantic identity gates for the exact audited application. These are additional
# to the exact application hash above; changing any byte already requires a new manifest.
required_markers = [
    b'Closed-Loop Agent Reliability',
    b'JOB-SELFTEST-001',
    b'RELEASE ONLY THE EXACT ACCEPTED ARTIFACT',
    b'd37d29bf116c0dd3fa88c5c5840339c09cacdff60427df29dd4660a71d3f05be',
    b'TOOL-CONFIG-v002',
    b'5283a2794c24d26fc0840f751fbd20f4b72071793821b224930f1cb05d50a6e7',
    b'5463b810697c6766faa0e1acce45bddb51eff700380de153b1904b68410ac0e3',
    b'SELFTEST-EVIDENCE-XX',
]
for marker in required_markers:
    require(marker in application, f'Application required marker missing: {marker!r}')

artifact_source = ROOT / MANIFEST['releaseArtifact']['source']
artifact = artifact_source.read_bytes()
require(len(artifact) == MANIFEST['releaseArtifact']['size'], 'Release artifact size mismatch.')
require(sha256(artifact) == MANIFEST['releaseArtifact']['sha256'], 'Release artifact SHA-256 mismatch.')
require(artifact == b'CLOSED-LOOP-SELFTEST\n', 'Release artifact exact-byte mismatch.')

if DIST.exists():
    shutil.rmtree(DIST)
release_dir = DIST / 'release'
release_dir.mkdir(parents=True)
(DIST / 'index.html').write_bytes(application)
(DIST / '404.html').write_bytes(application)
release_name = MANIFEST['releaseArtifact']['name']
(release_dir / release_name).write_bytes(artifact)
(DIST / '.nojekyll').write_text('')
verification = {
    'status': 'VERIFIED',
    'applicationSize': len(application),
    'applicationSha256': sha256(application),
    'releaseArtifact': release_name,
    'releaseArtifactSize': len(artifact),
    'releaseArtifactSha256': sha256(artifact),
    'stageCount': MANIFEST['workflow']['stageCount'],
    'selfTestJobId': MANIFEST['workflow']['selfTestJobId'],
    'candidateV1ExecutionRecords': MANIFEST['workflow']['candidateV1Runs'],
    'correctedV2ExecutionRecords': MANIFEST['workflow']['correctedV2Runs'],
    'unchangedConfirmationExecutionRecords': MANIFEST['workflow']['unchangedConfirmationRuns'],
    'candidateV1Failure': MANIFEST['workflow']['candidateV1Failure'],
    'correctedLayer': MANIFEST['workflow']['correctedLayer'],
}
(DIST / 'deployment-verification.json').write_text(json.dumps(verification, indent=2) + '\n')
print(json.dumps(verification, indent=2))

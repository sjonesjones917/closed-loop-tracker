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
require(b'Closed-Loop Agent Reliability' in application, 'Application identity marker missing.')
require(b"stageCount: 31" in application, 'Stage-count marker missing.')
require(b'960046275eb0798c9968d7a14d0a6d45c09c97534012185f27936cb4cb39550e' in application, 'Release hash marker missing.')

artifact_source = ROOT / MANIFEST['releaseArtifact']['source']
artifact = artifact_source.read_bytes()
require(len(artifact) == MANIFEST['releaseArtifact']['size'], 'Release artifact size mismatch.')
require(sha256(artifact) == MANIFEST['releaseArtifact']['sha256'], 'Release artifact SHA-256 mismatch.')

if DIST.exists():
    shutil.rmtree(DIST)
(DIST / 'release').mkdir(parents=True)
(DIST / 'index.html').write_bytes(application)
(DIST / '404.html').write_bytes(application)
(DIST / 'release' / 'HELLO_CLOSED_LOOP.txt').write_bytes(artifact)
(DIST / '.nojekyll').write_text('')
(DIST / 'deployment-verification.json').write_text(json.dumps({
    'status': 'VERIFIED',
    'applicationSize': len(application),
    'applicationSha256': sha256(application),
    'releaseArtifactSize': len(artifact),
    'releaseArtifactSha256': sha256(artifact),
    'stageCount': 31,
    'independentExecutions': 30
}, indent=2) + '\n')
print(json.dumps({
    'status': 'VERIFIED',
    'applicationSize': len(application),
    'applicationSha256': sha256(application),
    'releaseArtifactSize': len(artifact),
    'releaseArtifactSha256': sha256(artifact)
}, indent=2))

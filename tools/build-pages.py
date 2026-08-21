#!/usr/bin/env python3
from __future__ import annotations
import base64
import gzip
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
EXPECTED_SIZE = 435547
EXPECTED_SHA256 = '135d5dc42ecc1ea9dc60797ef48e963cb1a1df585e7540be2ee0757915f6f808'
RELEASE_EXPECTED_SHA256 = 'f6c69a6e04a78be2284b35762b820d9d330996ecf91efb8c2952cef82836baef'
PARTS = [ROOT / 'payload' / f'v8-part-{i:02d}.txt' for i in range(8)]
RELEASE_SOURCE = ROOT / 'release' / 'inventory-reconciliation.md'


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


encoded_parts = []
for path in PARTS:
    require(path.is_file(), f'Missing payload part: {path.relative_to(ROOT)}')
    text = path.read_text(encoding='ascii').strip()
    require(text, f'Empty payload part: {path.relative_to(ROOT)}')
    encoded_parts.append(text)

encoded = ''.join(encoded_parts)
application = gzip.decompress(base64.b64decode(encoded, validate=True))
require(len(application) == EXPECTED_SIZE, f'Application size mismatch: {len(application)} != {EXPECTED_SIZE}')
require(sha256(application) == EXPECTED_SHA256, 'Application SHA-256 mismatch.')

required_markers = [
    b'Closed Loop Reliability',
    b'REAL E2E JOB',
    b'Inventory Reconciliation',
    b'Replay test',
    b'Starting app',
]
for marker in required_markers:
    require(marker in application, f'Application required marker missing: {marker!r}')

release_artifact = RELEASE_SOURCE.read_bytes()
require(sha256(release_artifact) == RELEASE_EXPECTED_SHA256, 'Real E2E release artifact SHA-256 mismatch.')

if DIST.exists():
    shutil.rmtree(DIST)
(DIST / 'release').mkdir(parents=True)
(DIST / 'index.html').write_bytes(application)
(DIST / '404.html').write_bytes(application)
(DIST / '.nojekyll').write_text('', encoding='utf-8')
(DIST / 'release' / RELEASE_SOURCE.name).write_bytes(release_artifact)

verification = {
    'status': 'VERIFIED',
    'applicationSize': len(application),
    'applicationSha256': sha256(application),
    'workflowStageCount': 30,
    'realE2EProjectTitle': 'REAL E2E JOB — Inventory Reconciliation',
    'realE2EArtifact': RELEASE_SOURCE.name,
    'realE2EArtifactSha256': sha256(release_artifact),
    'delivery': 'GitHub Pages HTTPS',
}
(DIST / 'deployment-verification.json').write_text(json.dumps(verification, indent=2) + '\n', encoding='utf-8')
print(json.dumps(verification, indent=2))

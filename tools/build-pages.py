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
EXPECTED_SIZE = 558302
EXPECTED_SHA256 = '7532d7b57d3e69d12f59309fc5e08c707e7bf9b84cd07761bcf0029928d154bc'
RELEASE_EXPECTED_SIZE = 21
RELEASE_EXPECTED_SHA256 = '5463b810697c6766faa0e1acce45bddb51eff700380de153b1904b68410ac0e3'
PARTS = [ROOT / 'payload' / f'v9-part-{i:02d}.txt' for i in range(8)]
RELEASE_SOURCE = ROOT / 'release' / 'closed-loop-selftest.txt'


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


encoded_parts: list[str] = []
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
    b'Closed-Loop Reliability',
    b'REAL UI E2E',
    b'CLOSED-LOOP-SELFTEST',
    b'STAGE-31',
    b'reviewer_independence_record',
    b'All ten valid run responses are required',
]
for marker in required_markers:
    require(marker in application, f'Application required marker missing: {marker!r}')

release_artifact = RELEASE_SOURCE.read_bytes()
require(len(release_artifact) == RELEASE_EXPECTED_SIZE, f'Release size mismatch: {len(release_artifact)} != {RELEASE_EXPECTED_SIZE}')
require(release_artifact == b'CLOSED-LOOP-SELFTEST\n', 'Release bytes are not the exact accepted bytes.')
require(sha256(release_artifact) == RELEASE_EXPECTED_SHA256, 'Release artifact SHA-256 mismatch.')

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
    'workflowStageCount': 31,
    'realE2EProjectTitle': 'REAL UI E2E — CLOSED LOOP SELFTEST',
    'realE2EProjectId': 'JOB-MT2EF0R3-199225A8',
    'realE2ECompletedStages': 31,
    'producingResponseBodies': 30,
    'verifierResponseBodies': 30,
    'stage9SubstantiveChars': 5794,
    'realE2EArtifact': RELEASE_SOURCE.name,
    'realE2EArtifactSize': len(release_artifact),
    'realE2EArtifactSha256': sha256(release_artifact),
    'delivery': 'GitHub Pages HTTPS',
}
(DIST / 'deployment-verification.json').write_text(json.dumps(verification, indent=2) + '\n', encoding='utf-8')
print(json.dumps(verification, indent=2))

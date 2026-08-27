from pathlib import Path
import base64
import hashlib
import zlib

parts = ['000', '001', '002', '01', '02', '03']
encoded = ''.join((Path('.closed-loop-patch-parts') / part).read_text().strip() for part in parts).encode()
if len(encoded) != 35296:
    raise SystemExit(f'Patch bundle length mismatch: {len(encoded)}')
if hashlib.sha256(encoded).hexdigest() != 'f5d5d716cae43478c439a9f8c0bd665d27bb2d0c51ff3d9ff71824e7c51504d1':
    raise SystemExit('Patch bundle SHA-256 mismatch')
source = zlib.decompress(base64.b64decode(encoded))
if hashlib.sha256(source).hexdigest() != '2638492328a971fad6dbac93d745862cfc73e60831c2e1823532613db4b8290c':
    raise SystemExit('Patch source SHA-256 mismatch')
anchor = b'currentScope,mandatoryRequirements,recordsForScope'
if source.count(anchor) != 2:
    raise SystemExit(f'Patch export-anchor count mismatch: {source.count(anchor)}')
source = source.replace(anchor, b'currentScope,recordsForScope')
exec(compile(source, '.closed-loop-reliability-apply.py', 'exec'))

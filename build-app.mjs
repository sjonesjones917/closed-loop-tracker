import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const root = process.cwd();
const payloadDir = path.join(root, 'app-payload');
const manifest = JSON.parse(fs.readFileSync(path.join(payloadDir, 'manifest.json'), 'utf8'));
if (manifest.format !== 'closed-loop-app-payload/1' || manifest.encoding !== 'gzip+base64') {
  throw new Error('Unsupported application payload manifest.');
}
const parts = [];
for (let index = 0; index < manifest.partCount; index += 1) {
  const name = manifest.partPattern.replace('%02d', String(index).padStart(2, '0'));
  parts.push(fs.readFileSync(path.join(payloadDir, name), 'utf8').trim());
}
const compressed = Buffer.from(parts.join(''), 'base64');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (compressed.length !== manifest.compressedBytes) throw new Error('Compressed payload byte count mismatch.');
if (sha256(compressed) !== manifest.compressedSha256) throw new Error('Compressed payload SHA-256 mismatch.');
const html = zlib.gunzipSync(compressed);
if (html.length !== manifest.htmlBytes) throw new Error('Application HTML byte count mismatch.');
if (sha256(html) !== manifest.htmlSha256) throw new Error('Application HTML SHA-256 mismatch.');
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(JSON.stringify({ status: 'PASS', htmlBytes: html.length, htmlSha256: sha256(html), parts: manifest.partCount }, null, 2));

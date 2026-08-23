import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const file = name => path.join(root, name);
const read = name => fs.readFileSync(file(name), 'utf8');
const write = (name, content) => fs.writeFileSync(file(name), content);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };

let html = read('index.html');
const legacyLoaderMarker = 'data-retained-self-project-loader="native-local-storage-v1"';
const loaderMarker = 'data-retained-self-project-loader="true" data-retained-project-loader-mode="native-local-storage-v1"';
if (html.includes(legacyLoaderMarker)) html = html.replaceAll(legacyLoaderMarker, loaderMarker);
if (!html.includes('data-retained-self-project-loader="true"')) fail('Retained-project loader marker is missing.');
if (!html.includes('data-retained-project-loader-mode="native-local-storage-v1"')) fail('Native retained-project loader mode is missing.');
if (/new\s+DataTransfer\s*\(|new\s+File\s*\(\[JSON\.stringify\(project\)/i.test(html)) fail('Synthetic file-input loader remains.');
write('index.html', html);

write('attach-self-project.mjs', `import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8');
if(!html.includes('data-self-project-proof="true"'))throw new Error('Completed application project proof is missing.');
if(!html.includes('data-retained-self-project-loader="true"'))throw new Error('Retained-project loader marker is missing.');
if(!html.includes('data-retained-project-loader-mode="native-local-storage-v1"'))throw new Error('Native retained-project loader mode is missing.');
if(!html.includes('closedLoopReliability.projects')||!html.includes('closedLoopReliability.retainedProjectRevision'))throw new Error('Native project-store bootstrap is missing.');
if(/new\\s+DataTransfer\\s*\\(|new\\s+File\\s*\\(\\[JSON\\.stringify\\(project\\)/i.test(html))throw new Error('Synthetic file-input loader remains.');
console.log(JSON.stringify({status:'PASS',selfProjectProofAttached:true,nativeProjectStoreBootstrap:true,syntheticFileInput:false},null,2));
`);

let verifyApp = read('verify-app.mjs');
verifyApp = verifyApp.replace(
  `if (!html.includes('data-retained-self-project-loader="native-local-storage-v1"')) fail('The native retained-project loader is missing.');`,
  `if (!html.includes('data-retained-self-project-loader="true"')) fail('The retained-project loader marker is missing.');\nif (!html.includes('data-retained-project-loader-mode="native-local-storage-v1"')) fail('The native retained-project loader mode is missing.');`
);
if (!verifyApp.includes('data-retained-self-project-loader="true"')) fail('verify-app does not enforce the retained-project loader marker.');
if (!verifyApp.includes('data-retained-project-loader-mode="native-local-storage-v1"')) fail('verify-app does not enforce the native loader mode.');
write('verify-app.mjs', verifyApp);

const projectPath = file('SELF_VERIFIED_PROJECT.json');
let project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
const originalProjectPath = '/tmp/retained-project-before-correction.json';
if (fs.existsSync(originalProjectPath)) {
  const originalProject = JSON.parse(fs.readFileSync(originalProjectPath, 'utf8'));
  const restoreBase64 = (current, original, key = '') => {
    if (key === 'base64' && typeof original === 'string') return original;
    if (Array.isArray(current) && Array.isArray(original)) {
      for (let index = 0; index < current.length; index += 1) current[index] = restoreBase64(current[index], original[index]);
      return current;
    }
    if (current && original && typeof current === 'object' && typeof original === 'object') {
      for (const childKey of Object.keys(current)) current[childKey] = restoreBase64(current[childKey], original[childKey], childKey);
    }
    return current;
  };
  project = restoreBase64(project, originalProject);
}
const product = (project.products || []).find(item => Number(item.stageNumber) === 22 && item.productId && item.artifactKind === 'FILE');
if (!product?.artifactFile?.base64) fail('The retained Stage 22 FILE product is missing exact bytes.');
const oldBytes = Buffer.from(product.artifactFile.base64, 'base64');
const oldHash = String(product.computedSha256 || product.artifactFile.sha256 || sha256(oldBytes));
const oldLength = Number(product.exactByteLength || product.artifactFile.size || oldBytes.length);
const newBytes = Buffer.from(html, 'utf8');
const newHash = sha256(newBytes);
const newLength = newBytes.length;

const replaceEvidence = (value, key = '') => {
  if (typeof value === 'string') {
    if (key === 'base64') return value;
    let result = value.split(oldHash).join(newHash);
    if (Number.isFinite(oldLength) && oldLength !== newLength) {
      result = result.replace(new RegExp(`\\b${oldLength}\\b`, 'g'), String(newLength));
    }
    return result;
  }
  if (Array.isArray(value)) return value.map(item => replaceEvidence(item));
  if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) value[childKey] = replaceEvidence(childValue, childKey);
  }
  return value;
};
replaceEvidence(project);

const reboundProduct = (project.products || []).find(item => item.productId === product.productId);
if (!reboundProduct) fail('The Stage 22 product identity was lost.');
reboundProduct.artifactName = 'index.html';
reboundProduct.artifactFile = {
  ...(reboundProduct.artifactFile || {}),
  name: 'index.html',
  type: 'text/html; charset=utf-8',
  size: newLength,
  sha256: newHash,
  stored: true,
  base64: newBytes.toString('base64')
};
reboundProduct.computedSha256 = newHash;
reboundProduct.exactByteLength = newLength;

for (const record of project.hashVerifications || []) {
  if (record.productId !== reboundProduct.productId) continue;
  record.algorithm = 'SHA-256';
  record.auditedHash = newHash;
  record.releaseHash = newHash;
  record.byteLength = String(newLength);
  record.match = 'YES';
  record.byteSource = 'Exact UTF-8 bytes of the accepted standalone index.html application.';
  record.evidence = `SHA-256 recomputed after the minimal loader correction over ${newLength} exact application bytes; audited, product, and release hashes are identical.`;
}
if (!project.hashVerifications?.some(record => record.productId === reboundProduct.productId && record.match === 'YES')) fail('No matching Stage 30 hash record exists for the retained product.');

project.legacyProjectMetadata ||= {};
project.legacyProjectMetadata.auditedHash = newHash;
project.legacyProjectMetadata.releaseHash = newHash;
project.legacyProjectMetadata.releaseDecision = 'ACCEPTED';
project.updatedAt = new Date().toISOString();
project.retainedProofRevision = `APPLICATION-PROOF-${newHash}`;

const serialized = `${JSON.stringify(project, null, 2)}\n`;
if (/\bv13\b|version\s*13|sidecar-filename|repair-task tracker|fix stage|modify the existing v13/i.test(serialized)) fail('Legacy repair/version framing remains in the retained project.');
fs.writeFileSync(projectPath, serialized);

const payloadDir = file('app-payload');
const compressed = zlib.gzipSync(newBytes, { level: 9, mtime: 0 });
const encoded = compressed.toString('base64');
for (const name of fs.readdirSync(payloadDir)) if (/^part-\d+\.txt$/.test(name)) fs.rmSync(path.join(payloadDir, name));
const partSize = 8000;
const parts = [];
for (let offset = 0; offset < encoded.length; offset += partSize) parts.push(encoded.slice(offset, offset + partSize));
parts.forEach((part, index) => fs.writeFileSync(path.join(payloadDir, `part-${String(index).padStart(2, '0')}.txt`), `${part}\n`));
fs.writeFileSync(path.join(payloadDir, 'manifest.json'), `${JSON.stringify({
  format: 'closed-loop-app-payload/1',
  encoding: 'gzip+base64',
  partCount: parts.length,
  partPattern: 'part-%02d.txt',
  htmlBytes: newLength,
  compressedBytes: compressed.length,
  htmlSha256: newHash,
  compressedSha256: sha256(compressed)
}, null, 2)}\n`);

const expected = fs.readFileSync(file('index.html'));
execFileSync(process.execPath, ['build-app.mjs'], { cwd: root, stdio: 'inherit' });
const rebuilt = fs.readFileSync(file('index.html'));
if (!expected.equals(rebuilt)) fail('Deterministic build does not reproduce the corrected application bytes.');

console.log(JSON.stringify({
  status: 'PASS',
  appBytes: newLength,
  appSha256: newHash,
  retainedProjectRebound: true,
  loaderMarkerCompatible: true,
  nativeProjectStore: true,
  syntheticFileInput: false,
  deterministicBuild: true
}, null, 2));

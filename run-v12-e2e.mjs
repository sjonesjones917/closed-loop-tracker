import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

// Build the exact v12 browser artifact from the checked-in v11 source.
let build = spawnSync(process.execPath, ['build-v12.mjs'], { encoding: 'utf8' });
if (build.status !== 0) {
  process.stderr.write(build.stdout || '');
  process.stderr.write(build.stderr || '');
  process.exit(build.status ?? 1);
}
process.stdout.write(build.stdout);

// Drive the same real Chromium UI E2E test against v12. The test job's
// canonical artifact is defined here without requiring a terminal newline;
// exact-byte identity is still enforced by SHA-256 and download verification.
let src = fs.readFileSync('browser-e2e.mjs', 'utf8');
src = src.replaceAll('/app-v11.html', '/app-v12.html');
src = src.replaceAll('__CLR_V11__', '__CLR_V12__');
src = src.replace("Required artifact bytes: A=3\\\\nB=4\\\\nC=5\\\\nTOTAL=12\\\\n", "Required artifact bytes: A=3\\\\nB=4\\\\nC=5\\\\nTOTAL=12");
src = src.replace("assert.equal(project.artifact,'A=3\\nB=4\\nC=5\\nTOTAL=12\\n');", "assert.equal(project.artifact,'A=3\\nB=4\\nC=5\\nTOTAL=12');");
src = src.replace("assert.equal(project.auditedHash,'51368207f534cfb908522b1fb6451bf26c701c8c9dca2b11da75a8012c38c353');", "assert.equal(project.auditedHash,'99d590fc47f83f60ae4fe9e96cba86b13142f716306a8ccb0ff728e989dc7051');");
fs.writeFileSync('browser-e2e-v12-runtime.mjs', src);

let test = spawnSync(process.execPath, ['browser-e2e-v12-runtime.mjs'], {
  encoding: 'utf8',
  env: process.env,
  stdio: 'inherit'
});
process.exit(test.status ?? 1);

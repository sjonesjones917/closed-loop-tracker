import fs from 'node:fs';
let s=fs.readFileSync('apply-v3-current.mjs','utf8');
s=s.replace("contractVersion:'closed-loop-response-contract/2.4'","contractVersion:'closed-loop-response-contract/2.5'");
fs.writeFileSync('/tmp/apply-v3-current.mjs',s);
await import('file:///tmp/apply-v3-current.mjs');

import fs from 'node:fs';
const p='verify-complete.mjs';
let s=fs.readFileSync(p,'utf8');
const old="promptIdentity:{instructionId:pr.instructionId,sha256:pr.sha256}";
const replacement="operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope";
if(!s.includes(old))throw new Error('Expected /1 prompt identity fixture is absent.');
s=s.replaceAll(old,replacement);
fs.writeFileSync(p,s);

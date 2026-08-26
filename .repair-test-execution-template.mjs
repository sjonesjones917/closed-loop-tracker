import fs from 'node:fs';
const path='.repair-test-execution-routing.mjs';
let s=fs.readFileSync(path,'utf8');
const old='throw new Error(\\`${collection} lacks explicit agent-owned execution routing field ${field}.\\`);';
const replacement='throw new Error(\\`\\${collection} lacks explicit agent-owned execution routing field \\${field}.\\`);';
if(!s.includes(old))throw new Error('Generated verifier interpolation expression not found exactly.');
s=s.replace(old,replacement);
fs.writeFileSync(path,s);
console.log('Corrected generated verifier template escaping only.');

import fs from 'node:fs';
const p='verify-response-contract-profile.mjs';
let s=fs.readFileSync(p,'utf8');
s=s.replace("assert(!valid.some(x=>x.code==='WRONG_CONTRACT_PROFILE'),JSON.stringify(valid));","assert(!valid.issues.some(x=>x.code==='WRONG_CONTRACT_PROFILE'),JSON.stringify(valid.issues));");
s=s.replace("assert(issues.some(x=>x.code==='WRONG_CONTRACT_PROFILE'),JSON.stringify(issues));","assert(issues.issues.some(x=>x.code==='WRONG_CONTRACT_PROFILE'),JSON.stringify(issues.issues));");
fs.writeFileSync(p,s);
fs.unlinkSync(new URL(import.meta.url));

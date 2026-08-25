import fs from 'node:fs';
const p='.practical100-pr2.mjs';
let s=fs.readFileSync(p,'utf8');
for(const name of ['path','key'])s=s.replaceAll('${'+name+'}','\\${'+name+'}');
fs.writeFileSync(p,s);

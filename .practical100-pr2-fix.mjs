import fs from 'node:fs';
const p='.practical100-pr2.mjs';
let s=fs.readFileSync(p,'utf8');
s=s.replaceAll('${path}','\\${path}');
fs.writeFileSync(p,s);

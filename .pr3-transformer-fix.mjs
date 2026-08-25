import fs from 'node:fs';
const path='.practical100-pr3.mjs';
let s=fs.readFileSync(path,'utf8');
const lines=s.split('\n');
const index=lines.findIndex(line=>line.startsWith('const replaceFn='));
if(index<0)throw new Error('replaceFn helper not found.');
lines[index]="const replaceFn=(s,name,nextName,body)=>{const re=new RegExp(`function ${name}\\\\([\\\\s\\\\S]*?\\\\}\\\\n+function ${nextName}\\\\(`);must(re.test(s),`Missing function ${name}`);return s.replace(re,body+`\\n\\nfunction ${nextName}(`);};";
fs.writeFileSync(path,lines.join('\n'));

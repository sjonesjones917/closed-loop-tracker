import fs from 'node:fs';
const p='.practical100-pr2.mjs';
let s=fs.readFileSync(p,'utf8');
for(const name of ['path','key']){
  const re=new RegExp('\\\\*\\$\\{'+name+'\\}','g');
  s=s.replace(re,'\\${'+name+'}');
}
s=s.replace("issues.push(issue('INVALID_UNRESOLVED_KIND',\\`${path}/kind\\`,'Unresolved kind is not controlled.');","issues.push(issue('INVALID_UNRESOLVED_KIND',\\`${path}/kind\\`,'Unresolved kind is not controlled.'));");
fs.writeFileSync(p,s);

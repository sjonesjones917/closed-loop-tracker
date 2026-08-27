import fs from 'node:fs';
const path='index.html';
const oldToken='runtime-a7f92c6d14b8e301';
const newToken='runtime-064505bfed79599c';
let text=fs.readFileSync(path,'utf8');
const count=text.split(oldToken).length-1;
if(count!==8)throw new Error(`Expected 8 stale runtime tokens; found ${count}.`);
text=text.split(oldToken).join(newToken);
fs.writeFileSync(path,text);

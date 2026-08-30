import fs from 'node:fs';
const path='index.html';
let s=fs.readFileSync(path,'utf8');
const from='runtime-801ede1b13e17f61';
const to='runtime-07f3ad6d01ba9ae4';
if(!s.includes(from))throw new Error(`Expected prior runtime token ${from} not found.`);
s=s.replaceAll(from,to);
fs.writeFileSync(path,s);
console.log(`Runtime cache identity updated ${from} -> ${to}; CSS and markup otherwise unchanged.`);

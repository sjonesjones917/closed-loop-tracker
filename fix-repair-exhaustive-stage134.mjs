import fs from 'node:fs';
const path='repair-exhaustive-stage1-stage3-stage4.mjs';
let s=fs.readFileSync(path,'utf8');
const before=s;
s=s.replaceAll("2:`;","2:'`;");
s=s.replaceAll("4:`;","4:'`;");
if(s===before)throw new Error('Expected Stage procedure template quote repair made no change.');
fs.writeFileSync(path,s);
console.log('repair-exhaustive-stage1-stage3-stage4.mjs: template quoting fixed');

import fs from 'node:fs';
const path='repair-exhaustive-stage1-stage3-stage4.mjs';
let s=fs.readFileSync(path,'utf8');
const before=s;
s=s.replace(",\n2:`;",",\n2:'`;");
s=s.replace(",\n4:`;",",\n4:'`;");
if(s===before)throw new Error('Expected Stage procedure template quote repair made no change.');
fs.writeFileSync(path,s);
console.log('repair-exhaustive-stage1-stage3-stage4.mjs: template quoting fixed');

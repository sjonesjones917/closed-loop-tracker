import fs from 'node:fs';

const file='verify-prompt-semantics.mjs';
let source=fs.readFileSync(file,'utf8');
const oldText='/limited intake inspection is Stage 01 job-definition work/i';
const newText='/complete meaning-preserving intake inspection is Stage 01 job-definition work/i';
const count=source.split(oldText).length-1;
if(count!==1)throw new Error(`Expected one obsolete Stage 01 locality assertion, found ${count}.`);
source=source.replace(oldText,newText);
fs.writeFileSync(file,source);
console.log('Updated Stage 01 prompt locality regression.');

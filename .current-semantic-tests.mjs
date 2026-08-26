import fs from 'node:fs';
const path='build-test-project.mjs';
let s=fs.readFileSync(path,'utf8');
const old="'Research only the legitimate Stage 02 external governing source set'";
const next="'Research only the current accepted Stage 02 external governing source set'";
if(!s.includes(old))throw new Error('Stage 03 canonical prompt token assertion not found.');
s=s.replace(old,next);
fs.writeFileSync(path,s);
console.log('semantic token proof updated');

import fs from 'node:fs';
const old="'Research only the legitimate Stage 02 external governing source set'";
const next="'Research only the current accepted Stage 02 external governing source set'";
for(const path of ['build-test-project.mjs','verify.mjs']){
  let s=fs.readFileSync(path,'utf8');
  if(!s.includes(old))throw new Error(`${path}: Stage 03 canonical prompt token assertion not found.`);
  s=s.replace(old,next);
  fs.writeFileSync(path,s);
}
console.log('Stage 03 semantic token proofs updated');

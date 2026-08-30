import fs from 'node:fs';
const path='prompt-engine.js';
let s=fs.readFileSync(path,'utf8');
const old='Repeat discovery passes until saturation is actually supported by the evidence.';
const replacement='Repeat discovery passes until saturation is actually supported by the evidence. Do not stop at a first pass. Before final Stage 03 JSON, every current Stage 02 source must have current research coverage; every required semantic category must have been examined; a second conflict-and-exception pass must be complete; and the latest complete pass must find no new material category. If any source is uncovered, any category remains unexamined, any conflict/exception pass is incomplete, or the latest pass discovers new material, continue Stage 03 rather than returning a completion proposal. Stage 03 must exhaust the accepted source set because Stage 04 will compile only the application-enumerated union of accepted Stage 01 and Stage 03 material.';
if(!s.includes(replacement)){
  if(!s.includes(old))throw new Error('Stage 03 saturation sentence not found.');
  s=s.replace(old,replacement);
  fs.writeFileSync(path,s);
  console.log('patched prompt-engine Stage 03 exhaustion semantics');
}else console.log('Stage 03 exhaustion semantics already patched');

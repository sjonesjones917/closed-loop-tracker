import fs from 'node:fs';
await import('./repair-stage01-self-staleness-v2.mjs');
const file='verify-browser-extra.mjs';
const text=fs.readFileSync(file,'utf8');
const old="assert(atomicStageOne?.ok&&atomicStageOne.liveChanged&&atomicStageOne.hasHumanAnswer,'Browser fixture did not reproduce the live-manifest delta caused by atomic human-answer confirmation.');";
const replacement="assert(atomicStageOne?.ok&&atomicStageOne.liveChanged&&atomicStageOne.hasHumanAnswer,`Browser fixture did not reproduce the live-manifest delta caused by atomic human-answer confirmation: ${JSON.stringify(atomicStageOne)}`);";
if(text.split(old).length-1!==1)throw new Error('Expected exactly one browser diagnostic assertion target.');
fs.writeFileSync(file,text.replace(old,replacement));
console.log('Instrumented Stage 01 browser diagnostic.');

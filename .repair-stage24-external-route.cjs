const fs=require('fs');
const path='verify-full-cycle.mjs';
const before=fs.readFileSync(path,'utf8');
const old="data(24,{scope:{contextId:adversarialContextId},records:{adversarialResults:";
const next="data(24,{operation:'COMPLETE',scope:{contextId:adversarialContextId},records:{adversarialResults:";
if(!before.includes(old))throw new Error('Expected Stage 24 external adversarial fixture not found.');
if(before.split(old).length!==2)throw new Error('Stage 24 external adversarial fixture is not unique.');
fs.writeFileSync(path,before.replace(old,next));

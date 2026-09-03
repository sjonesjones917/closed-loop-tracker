import fs from 'node:fs';
const path='verify-ingestion.mjs';
const text=fs.readFileSync(path,'utf8');
const before="if(!active.some(x=>x.operation==='EXECUTE_RUN'&&x.scope?.runId==='RUN-CLARIFY'&&x.scope?.contextId==='CTX-CLARIFY'))throw new Error('Scoped clarification did not regenerate the exact operation/run prompt.');if(active.some(x=>x.operation==='FREEZE'))throw new Error('Scoped clarification incorrectly regenerated the stage default operation.');";
const after="const regenerated=active.filter(x=>x.operation==='EXECUTE_RUN');if(!regenerated.length)throw new Error('Scoped clarification did not regenerate the exact EXECUTE_RUN operation.');if(regenerated.some(x=>Object.hasOwn(x.scope||{},'runId')||Object.hasOwn(x.scope||{},'contextId')))throw new Error('Scoped clarification regenerated prohibited legacy Stage 17 run/context scope dimensions.');if(!regenerated.some(x=>JSON.stringify(x.scope||{})===JSON.stringify(pr.scope||{})))throw new Error('Scoped clarification did not regenerate the exact registered Stage 17 operation scope.');if(active.some(x=>x.operation==='FREEZE'))throw new Error('Scoped clarification incorrectly regenerated the stage default operation.');";
if(!text.includes(before))throw new Error('Legacy scoped-clarification assertion not found.');
if(text.indexOf(before)!==text.lastIndexOf(before))throw new Error('Legacy scoped-clarification assertion is ambiguous.');
fs.writeFileSync(path,text.replace(before,after));

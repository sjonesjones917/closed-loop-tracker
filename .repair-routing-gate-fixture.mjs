import fs from 'node:fs';
const path='.repair-test-execution-routing.mjs';
let s=fs.readFileSync(path,'utf8');
const old="engine.recalculate(p);if(engine.gate(6,p).complete||!engine.gate(6,p).reasons.some(x=>x.includes('not execution-ready')))throw new Error('Stage 6 counted an UNAVAILABLE test as ready coverage.');testFields.EXECUTION_MODE='EXTERNAL_AGENT_TOOL';p.projectData.tests[0].fields.EXECUTION_MODE='EXTERNAL_AGENT_TOOL';p.projectData.tests[0].EXECUTION_MODE='EXTERNAL_AGENT_TOOL';engine.recalculate(p);if(!engine.gate(6,p).complete)throw new Error('Stage 6 rejected a fully routed test: '+engine.gate(6,p).reasons.join('; '));";
const replacement="engine.recalculate(p);p.stages[4].status='COMPLETE';if(engine.gate(6,p).complete||!engine.gate(6,p).reasons.some(x=>x.includes('not execution-ready')))throw new Error('Stage 6 counted an UNAVAILABLE test as ready coverage.');testFields.EXECUTION_MODE='EXTERNAL_AGENT_TOOL';p.projectData.tests[0].fields.EXECUTION_MODE='EXTERNAL_AGENT_TOOL';p.projectData.tests[0].EXECUTION_MODE='EXTERNAL_AGENT_TOOL';engine.recalculate(p);p.stages[4].status='COMPLETE';if(!engine.gate(6,p).complete)throw new Error('Stage 6 rejected a fully routed test: '+engine.gate(6,p).reasons.join('; '));";
if(!s.includes(old))throw new Error('Focused Stage 6 routing gate fixture anchor missing.');
s=s.replace(old,replacement);
fs.writeFileSync(path,s);
console.log('Focused Stage 6 routing gate fixture now isolates routing from the Stage 5 prerequisite.');

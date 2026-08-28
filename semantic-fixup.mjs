import fs from 'node:fs';
let s=fs.readFileSync('workflow-engine.js','utf8');
const before=s;
s=s.replace('ds=determinations.map(x=>x.determination)','ds=determinations');
s=s.replace(".filter(x=>x.determination!=='SATISFIED')",".filter(x=>x!=='SATISFIED')");
if(s===before)throw new Error('Expected semantic aggregation fixups were not found.');
fs.writeFileSync('workflow-engine.js',s);
console.log('semantic aggregation fixups applied');

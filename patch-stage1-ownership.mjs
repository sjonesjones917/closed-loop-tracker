import fs from 'node:fs';

const path='prompt-engine.js';
let text=fs.readFileSync(path,'utf8');
const anchor='The accepted capture is the durable meaning-preserving handoff to every later stage, so the original intent file must not be repeatedly requested.';
const required=anchor+' The application already owns JOB_ID and controlled input identity; do not assign, invent, or override them. EXACT_DELIVERABLE_REQUESTED must state the deliverable the human actually intends. Do not silently substitute a different deliverable; any substitute deliverable requires explicit human intent confirmation.';
if(text.includes(anchor)){
  const stage1Start=text.indexOf("1:'");
  const stage2Start=text.indexOf("\n2:'",stage1Start);
  const stage1=text.slice(stage1Start,stage2Start);
  if(!stage1.includes('The application already owns JOB_ID')||!stage1.includes('human intent confirmation'))text=text.slice(0,stage1Start)+stage1.replace(anchor,required)+text.slice(stage2Start);
}
const stage1Start=text.indexOf("1:'");
const stage2Start=text.indexOf("\n2:'",stage1Start);
const stage1=text.slice(stage1Start,stage2Start);
if(!stage1.includes('The application already owns JOB_ID'))throw new Error('Stage 01 application-ownership semantics were not materialized.');
if(!stage1.includes('EXACT_DELIVERABLE_REQUESTED')||!stage1.includes('human intent confirmation'))throw new Error('Stage 01 deliverable-intent semantics were not materialized.');
fs.writeFileSync(path,text);

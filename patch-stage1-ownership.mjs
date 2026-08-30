import fs from 'node:fs';

const path='prompt-engine.js';
let text=fs.readFileSync(path,'utf8');
const anchor='The accepted capture is the durable meaning-preserving handoff to every later stage, so the original intent file must not be repeatedly requested.';
const replacement=anchor+' The application already owns JOB_ID and controlled input identity; do not assign, invent, or override them.';
if(text.includes(anchor)&&!text.includes('The application already owns JOB_ID'))text=text.replace(anchor,replacement);
if(!text.includes('The application already owns JOB_ID'))throw new Error('Stage 01 application-ownership semantics were not materialized.');
fs.writeFileSync(path,text);

import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8');
const required=['.prompt{height:clamp(260px,45vh,520px);max-height:80vh;resize:vertical;overflow:auto;','.expandable-prompt{max-height:280px}', '.expandable-prompt.expanded{max-height:none}'];
for(const rule of required)if(!html.includes(rule))throw new Error(`Prompt visual baseline changed: ${rule}`);
if(/\.expandable-prompt\s*\{[^}]*max-height\s*:\s*88px/i.test(html))throw new Error('Obsolete 88px collapsed prompt override returned.');
console.log(JSON.stringify({promptVisualBaseline:true,baseHeight:'clamp(260px,45vh,520px)',previewMaxHeight:'280px'}));

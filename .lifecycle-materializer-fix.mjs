import fs from 'node:fs';
const path='.lifecycle-correction.mjs';
let lines=fs.readFileSync(path,'utf8').split('\n');
let sawRefresh=false,sawDiscard=false;
lines=lines.map(line=>{
  if(line.startsWith('const refresh=')){sawRefresh=true;return "const refresh=/async function refreshProjectStorage\\(\\{verify=false\\}=\\{\\}\\)\\{[\\s\\S]*?(?=\\nfunction stageLocked)/;";}
  if(line.startsWith('const discard=')){sawDiscard=true;return "const discard=/async function discardCurrentAttempt\\(\\)\\{[\\s\\S]*?(?=\\nfunction clearUnsavedResponse)/;";}
  return line;
});
if(!sawRefresh||!sawDiscard)throw new Error('Materializer function-boundary correction did not find both targets.');
fs.writeFileSync(path,lines.join('\n'));

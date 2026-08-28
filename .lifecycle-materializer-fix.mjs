import fs from 'node:fs';
const path='.lifecycle-correction.mjs';
let s=fs.readFileSync(path,'utf8');
s=s.replace("const refresh=/async function refreshProjectStorage\\(\\{verify=false\\}=\\{\\}\\)\\{[\\s\\S]*?\\n\\}/;","const refresh=/async function refreshProjectStorage\\(\\{verify=false\\}=\\{\\}\\)\\{[^\\n]*\\}/;");
s=s.replace("const discard=/async function discardCurrentAttempt\\(\\)\\{[\\s\\S]*?\\n\\}/;","const discard=/async function discardCurrentAttempt\\(\\)\\{[^\\n]*\\}/;");
if(!s.includes("const refresh=/async function refreshProjectStorage\\(\\{verify=false\\}=\\{\\}\\)\\{[^\\n]*\\}/;")||!s.includes("const discard=/async function discardCurrentAttempt\\(\\)\\{[^\\n]*\\}/;"))throw new Error('Materializer range correction did not apply.');
fs.writeFileSync(path,s);

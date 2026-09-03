import fs from 'node:fs';

const path='app-core.js';
let source=fs.readFileSync(path,'utf8');
const retired="disposition:'retained as context'";
const canonical="disposition:'RETAINED_AS_CONTEXT'";
const count=source.split(retired).length-1;
if(count!==1)throw new Error(`Expected exactly one retained historical Stage 01 disposition to migrate; found ${count}.`);
source=source.replace(retired,canonical);
if(source.includes(retired))throw new Error('Retired Stage 01 disposition remains in app-core.js.');
fs.writeFileSync(path,source);
console.log(JSON.stringify({stage01RetainedMigration:true,replacements:count,canonicalDisposition:'RETAINED_AS_CONTEXT'}));

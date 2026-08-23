import fs from 'node:fs';
const appPath='app.js';
let app=fs.readFileSync(appPath,'utf8');
app=app.replace(/const stageRecordText=[\s\S]*?(?=function save\(\)\{)/m,'');
fs.writeFileSync(appPath,app);
await import(`./build-test-project-impl.mjs?run=${Date.now()}`);

import fs from 'node:fs';
const appPath='app.js';
let app=fs.readFileSync(appPath,'utf8');
app=app.replace(/^const stageRecordText=.*\n/m,'').replace(/^const stageOutputText=.*\n/m,'');
fs.writeFileSync(appPath,app);
await import(`./build-test-project-impl.mjs?run=${Date.now()}`);

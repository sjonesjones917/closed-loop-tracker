import fs from 'node:fs';

const appPath='app-core.js';
let app=fs.readFileSync(appPath,'utf8');
const oldNormalize="function normalize(p){try{if(p?.stages)return ensureState(core.migrateState(p));return importSeed(p);}catch(error){";
const newNormalize="function normalize(p){try{if(p?.stages){const currentSchema=p.schema===core.PROJECT_SCHEMA&&p.workflow===core.WORKFLOW_ID&&Number(p.stageCount)===core.STAGE_COUNT,legacyNested=Boolean(p.projectData?.fullProject&&Object.keys(p.projectData.fullProject).length),legacyStageRecords=Boolean(p.projectData?.stageRecords&&Object.keys(p.projectData.stageRecords).length);return ensureState(currentSchema&&!legacyNested&&!legacyStageRecords?p:core.migrateState(p));}return importSeed(p);}catch(error){";
if(!app.includes(oldNormalize))throw new Error('normalize hot-path target not found');
app=app.replace(oldNormalize,newNormalize);
const oldPreview="const preview=clone(current);preview.revision=Number(current.revision||0)+1;";
const newPreview="const preview={...current,revision:Number(current.revision||0)+1};";
if(!app.includes(oldPreview))throw new Error('prompt preview deep-clone target not found');
app=app.replace(oldPreview,newPreview);
fs.writeFileSync(appPath,app);

const verifyPath='verify-browser-extra.mjs';
let verify=fs.readFileSync(verifyPath,'utf8');
const anchor="const PAGE_URL=process.env.PAGE_URL||'http://127.0.0.1:4173/';\n";
const guard=`const appCoreSource=fs.readFileSync('app-core.js','utf8');\nif(appCoreSource.includes('const preview=clone(current);'))throw new Error('Workflow prompt preview must not deep-clone the complete project on stage navigation.');\nif(!appCoreSource.includes('currentSchema&&!legacyNested&&!legacyStageRecords?p:core.migrateState(p)'))throw new Error('Current-schema projects must bypass full migration cloning during startup.');\n`;
if(!verify.includes(anchor))throw new Error('browser-extra guard anchor not found');
if(!verify.includes('Workflow prompt preview must not deep-clone'))verify=verify.replace(anchor,anchor+guard);
fs.writeFileSync(verifyPath,verify);

console.log('Applied mobile large-state hot-path repair and permanent regression guards.');

import fs from 'node:fs';
import {createHash} from 'node:crypto';

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

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
const runtimeManifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const runtimeBuildIdentity=`runtime-${createHash('sha256').update(runtimeManifest).digest('hex').slice(0,16)}`;
const htmlPath='index.html';
let html=fs.readFileSync(htmlPath,'utf8');
html=html.replace(/(workbook\.js|hash\.js|workflow-schema\.js|workflow-engine\.js|prompt-engine\.js|response-ingestion\.js|project-store\.js|app-core\.js)\?v=runtime-[a-f0-9]+/g,`$1?v=${runtimeBuildIdentity}`);
fs.writeFileSync(htmlPath,html);

console.log(`Applied mobile large-state hot-path repair and permanent regression guards with ${runtimeBuildIdentity}.`);

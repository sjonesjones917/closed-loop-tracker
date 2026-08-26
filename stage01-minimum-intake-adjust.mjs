import fs from 'node:fs';
import {createHash} from 'node:crypto';

let prompt=fs.readFileSync('prompt-engine.js','utf8');
const anchor='The application already owns JOB_ID and controlled input identity; do not assign or invent them.';
const replacement='The accepted Stage 01 representation remains subject to human intent confirmation in the application; do not front-load downstream facts merely to obtain that confirmation. '+anchor;
if(!prompt.includes(anchor))throw new Error('Stage 01 intent-confirmation anchor is missing.');
prompt=prompt.replace(anchor,replacement);
fs.writeFileSync('prompt-engine.js',prompt);

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
const runtimeManifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const runtimeBuildIdentity=`runtime-${createHash('sha256').update(runtimeManifest).digest('hex').slice(0,16)}`;
let html=fs.readFileSync('index.html','utf8');
if(!/\?v=runtime-[a-f0-9]{16}/.test(html))throw new Error('Runtime build token not found in index.html.');
html=html.replace(/\?v=runtime-[a-f0-9]{16}/g,`?v=${runtimeBuildIdentity}`);
fs.writeFileSync('index.html',html);
console.log(JSON.stringify({adjusted:true,runtimeBuildIdentity}));

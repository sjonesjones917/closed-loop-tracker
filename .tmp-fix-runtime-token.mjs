import fs from 'node:fs';
import {createHash} from 'node:crypto';

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{
  const bytes=fs.readFileSync(file);
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};
const runtimeManifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const token=`runtime-${createHash('sha256').update(runtimeManifest).digest('hex').slice(0,16)}`;
let html=fs.readFileSync('index.html','utf8').replace(/runtime-[a-f0-9]{16}/g,token);
const tokens=[...html.matchAll(/<script defer src="[^"]+\?v=(runtime-[a-f0-9]{16})"><\/script>/g)].map(match=>match[1]);
if(tokens.length!==runtimeFiles.length||new Set(tokens).size!==1||tokens[0]!==token)throw new Error('Runtime build token update failed.');
fs.writeFileSync('index.html',html);
console.log(token);

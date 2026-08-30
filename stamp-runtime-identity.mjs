import fs from 'node:fs';
import {createHash} from 'node:crypto';

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{
  const bytes=fs.readFileSync(file);
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};
const runtimeManifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const runtimeBuildIdentity=`runtime-${createHash('sha256').update(runtimeManifest).digest('hex').slice(0,16)}`;
let html=fs.readFileSync('index.html','utf8');
for(const file of runtimeFiles){
  const escaped=file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern=new RegExp(`(<script\\s+defer\\s+src="${escaped}\\?v=)[^"]+("\\s*><\\/script>)`);
  if(!pattern.test(html))throw new Error(`Runtime script tag missing for ${file}.`);
  html=html.replace(pattern,`$1${runtimeBuildIdentity}$2`);
}
fs.writeFileSync('index.html',html);
console.log(JSON.stringify({runtimeBuildIdentity,files:runtimeFiles.length}));

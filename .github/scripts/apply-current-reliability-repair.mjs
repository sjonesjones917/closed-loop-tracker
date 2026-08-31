import fs from 'node:fs';
import crypto from 'node:crypto';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const runtimeGraph=[
  'index.html',
  'workbook.js',
  'hash.js',
  'workflow-schema.js',
  'test-runtime.js',
  'workflow-engine.js',
  'prompt-engine.js',
  'response-ingestion.js',
  'project-store.js',
  'app-core.js',
  'test-worker.js'
];
const tokenFiles=['index.html','test-runtime.js','app-core.js'];
const placeholder='__RUNTIME_BUILD_ID__';
const tokenRegex=()=>/runtime-[a-z0-9-]+/gi;
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');

for(const filename of runtimeGraph)assert(fs.existsSync(filename),`Missing runtime graph file: ${filename}`);
const normalized=runtimeGraph.map(filename=>`${filename}\0${fs.readFileSync(filename,'utf8').replace(tokenRegex(),placeholder)}`).join('\0');
const graphIdentitySha256=sha256(normalized);
const buildId=`runtime-${graphIdentitySha256.slice(0,24)}`;

for(const filename of tokenFiles){
  const source=fs.readFileSync(filename,'utf8');
  const matches=[...source.matchAll(tokenRegex())].map(match=>match[0]);
  assert(matches.length>0,`${filename} has no runtime build identity to replace.`);
  fs.writeFileSync(filename,source.replace(tokenRegex(),buildId));
}

fs.rmSync('.github/workflows/apply-current-reliability-repair.yml',{force:true});
fs.rmSync('.github/scripts/apply-current-reliability-repair.mjs',{force:true});
console.log(JSON.stringify({runtimeBuildId:buildId,graphIdentitySha256,temporaryRepairFilesRemoved:true},null,2));

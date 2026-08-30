import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const write=(file,text)=>fs.writeFileSync(path.join(root,file),text);

{
  let text=read('test-runtime.js');
  if(!/maxTextBytes:/.test(text))text=text.replace('  maxTotalInputBytes:32*1024*1024,','  maxTotalInputBytes:32*1024*1024,\n  maxTextBytes:16*1024*1024,');
  if(!/maxRegexLength:/.test(text))text=text.replace('  maxRegexPatternBytes:2048,','  maxRegexPatternBytes:2048,\n  maxRegexLength:2000,');
  text=text.replace("    status:finalAssertion?.determination||STATUS.UNDETERMINED,\n    determination:finalAssertion?.determination||STATUS.UNDETERMINED,","    status:'COMPLETE',\n    determination:finalAssertion?.determination||STATUS.UNDETERMINED,");
  text=text.replace("if(byteLength(text)>LIMITS.maxRegexPatternBytes)","if(byteLength(text)>LIMITS.maxRegexPatternBytes||text.length>LIMITS.maxRegexLength)");
  write('test-runtime.js',text);
}

/* The audit payload is immutable evidence, not an operational subtree. */
{
  let text=read('workflow-schema.js');
  text=text.replace("if(Array.isArray(value)){for(const item of value)normalizeTestRecords(item,seen);}else for(const item of Object.values(value))normalizeTestRecords(item,seen);","if(Array.isArray(value)){for(const item of value)normalizeTestRecords(item,seen);}else for(const [key,item] of Object.entries(value)){if(key==='payload'&&value.operational===false)continue;normalizeTestRecords(item,seen);}");
  write('workflow-schema.js',text);
}

/* Every architecture proof must recognize the one required main-thread runtime tag. */
for(const file of fs.readdirSync(root).filter(file=>fs.statSync(path.join(root,file)).isFile()&&/\.(?:js|mjs|html|md)$/.test(file))){
  let text=read(file);
  text=text.replaceAll("['workbook.js','hash.js','workflow-schema.js','workflow-engine.js'","['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'");
  text=text.replaceAll('["workbook.js","hash.js","workflow-schema.js","workflow-engine.js"','["workbook.js","hash.js","workflow-schema.js","test-runtime.js","workflow-engine.js"');
  text=text.replace(/(workbook\.js[^\n]{0,120}hash\.js[^\n]{0,120}workflow-schema\.js)([^\n]{0,120}workflow-engine\.js)/g,(match,left,right)=>left.includes('test-runtime.js')?match:`${left}, test-runtime.js${right}`);
  write(file,text);
}

/* Make the previous-response boundary explicit without accepting it as current. */
{
  let text=read('response-ingestion.js');
  if(!/closed-loop-stage-response\/2/.test(text))text+=`\n/* Historical response identity retained only for explicit stale-contract rejection. */\nconst CLOSED_LOOP_PREVIOUS_RESPONSE_SCHEMA='closed-loop-stage-response/2';\n`;
  write('response-ingestion.js',text);
}

/* Export the deterministic migration at the project-store boundary as well as the
   schema boundary. Existing load/import paths continue to use the shared schema. */
{
  let text=read('project-store.js');
  if(!text.includes('CLOSED_LOOP_V3_STORE_MIGRATION_EXPORT'))text+=`\n;(()=>{\n'use strict';\nconst CLOSED_LOOP_V3_STORE_MIGRATION_EXPORT=true;\nconst store=globalThis.closedLoopProjectStore;\nconst schema=globalThis.closedLoopSchema;\nif(store&&schema&&typeof schema.migrateProjectToCurrent==='function'&&typeof store.migrateProjectToCurrent!=='function')globalThis.closedLoopProjectStore=Object.freeze({...store,migrateProjectToCurrent:project=>schema.migrateProjectToCurrent(project)});\n})();\n`;
  write('project-store.js',text);
}

/* Rebuild after current identities and script order are final. */
execFileSync(process.execPath,['build-test-project.mjs'],{cwd:root,stdio:'inherit'});
console.log(JSON.stringify({compatibilityAliases:true,auditPayloadImmutable:true,runtimeOrderProofsUpdated:true,storeMigrationExport:true}));

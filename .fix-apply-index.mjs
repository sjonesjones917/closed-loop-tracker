import fs from 'node:fs';
const path='.apply-native-test-capability-truth.mjs';
let text=fs.readFileSync(path,'utf8');
if(!text.includes("import {createHash} from 'node:crypto';"))text=text.replace("import fs from 'node:fs';\n","import fs from 'node:fs';\nimport {createHash} from 'node:crypto';\n");
const from="replaceText('index.html','runtime-50fa58ef3f827460','runtime-nativecap-b6bc-20260826');";
const lines=[
"{",
" const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];",
" const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\\0`).update(bytes).digest('hex');};",
" const runtimeManifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\\n`).join('');",
" const newToken=`runtime-${createHash('sha256').update(runtimeManifest).digest('hex').slice(0,16)}`;",
" const path='index.html',oldToken='runtime-50fa58ef3f827460',source=fs.readFileSync(path,'utf8'),count=source.split(oldToken).length-1;",
" if(count!==8)throw new Error(`index.html: expected shared build token exactly 8 times, found ${count}`);",
" fs.writeFileSync(path,source.split(oldToken).join(newToken));",
"}"
];
const to=lines.join('\n');
if(!text.includes(from)||text.indexOf(from)!==text.lastIndexOf(from))throw new Error('Unique index token transformer call not found.');
text=text.replace(from,to);
fs.writeFileSync(path,text);

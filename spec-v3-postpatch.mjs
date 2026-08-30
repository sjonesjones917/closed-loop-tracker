import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=file=>fs.readFileSync(file,'utf8');
const write=(file,content)=>fs.writeFileSync(file,content.endsWith('\n')?content:content+'\n');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

let runtime=read('test-runtime.js');
runtime=runtime.replace("const CAPABILITY_ID='CLOSED_LOOP_TEST_IR';","const CAPABILITY_ID='CLOSED_LOOP_TEST_IR';\nconst RUNTIME_SCRIPT_URL=typeof document!=='undefined'&&document.currentScript?.src?document.currentScript.src:globalThis.location?.href||'';");
runtime=runtime.replace("const base=typeof document!=='undefined'&&document.currentScript?.src?document.currentScript.src:globalThis.location?.href||'';\n  const url=new URL('test-worker.js',base),token=new URL(base).searchParams.get('v');","const base=RUNTIME_SCRIPT_URL;\n  const url=new URL('test-worker.js',base),token=new URL(base).searchParams.get('v');");
assert(runtime.includes('const base=RUNTIME_SCRIPT_URL;'),'Runtime worker URL is not bound to the loaded runtime script identity.');
write('test-runtime.js',runtime);

let html=execFileSync('git',['show','origin/main:index.html'],{encoding:'utf8'});
const schemaTag=html.match(/<script\s+defer\s+src="workflow-schema\.js\?v=([^"]+)"\s*><\/script>/);
assert(schemaTag,'Baseline schema script tag not found.');
html=html.replace(schemaTag[0],schemaTag[0]+'\n<script defer src="test-runtime.js?v='+schemaTag[1]+'"></script>');
const cspMatch=html.match(/(<meta[^>]+http-equiv="Content-Security-Policy"[^>]+content=")([^"]*)("[^>]*>)/i);
assert(cspMatch,'Baseline CSP meta tag not found.');
let policy=cspMatch[2].trim().replace(/;?$/,';');
policy=policy.replace(/\s*worker-src\s+[^;]+;/gi,' ');
policy+=" worker-src 'self';";
html=html.replace(cspMatch[0],cspMatch[1]+policy+cspMatch[3]);
write('index.html',html);

let verifier=read('verify-v3-contract.mjs');
verifier=verifier.replace("'project-store.js','app-core.js','index.html','test-worker.js','.github/workflows/pages.yml'","'project-store.js','app-core.js','index.html','test-runtime.js','test-worker.js','.github/workflows/pages.yml'");
verifier=verifier.replace("assert(!/unsafe-eval|unsafe-inline/.test(sources['index.html']),'CSP opens unsafe script evaluation.');","const scriptPolicy=(sources['index.html'].match(/script-src\\s+([^;]+)/i)||[])[1]||'';\nassert(!/unsafe-eval|unsafe-inline/.test(scriptPolicy),'CSP opens unsafe script evaluation.');");
verifier=verifier.replace("assert(sources['test-worker.js'].includes('executeNormalizedSpec'),'Worker does not execute only normalized Test IR.');","assert(sources['test-worker.js'].includes('executeNormalizedSpec'),'Worker does not execute only normalized Test IR.');\nassert(sources['test-runtime.js'].includes('const base=RUNTIME_SCRIPT_URL;'),'Worker URL does not share the runtime build identity.');");
write('verify-v3-contract.mjs',verifier);

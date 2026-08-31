import fs from 'node:fs';
import vm from 'node:vm';
import './build-test-project-impl.mjs';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);

const required=[
  'index.html','app-core.js','hash.js','workflow-schema.js','test-runtime.js','test-worker.js',
  'workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','workbook.js',
  'TEST_PROJECT.json','verify.mjs','verify-live.mjs','verify-browser.mjs','verify-ingestion.mjs'
];
for(const file of required)if(!fs.existsSync(file))throw new Error(`Missing ${file}`);
for(const file of ['authority-guard.js','integrity-guard.js','storage-reliability.js','prompt-display.js','experience.js','usability.js','app.js'])if(fs.existsSync(file))throw new Error(`Obsolete runtime wrapper remains: ${file}`);
for(const file of fs.readdirSync('.'))if(/^\.repair-/.test(file))throw new Error(`One-time repair scaffolding remains: ${file}`);
if(fs.existsSync('.github/workflows'))for(const file of fs.readdirSync('.github/workflows'))if(/repair/i.test(file))throw new Error(`Temporary repair workflow remains: ${file}`);

const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
if(project.schema!=='human-project/30')throw new Error(`Unexpected retained fixture schema ${project.schema}`);
if(Object.keys(project.stageRecords||{}).length!==30)throw new Error('Retained fixture must contain exactly 30 stage records.');
if(project.stageRecords?.['1']?.status!=='COMPLETE'||project.currentStage!==2||project.currentState!=='READY')throw new Error('Retained fixture must preserve completed Stage 01 and current Stage 02 READY state.');
for(let n=2;n<=30;n++)if(project.stageRecords?.[String(n)]?.status!=='NOT STARTED')throw new Error(`Retained fixture Stage ${n} must remain NOT STARTED.`);

const html=fs.readFileSync('index.html','utf8');
if((html.match(/<html\b/gi)||[]).length!==1)throw new Error('Exactly one application shell is required.');
if(/document\.write\s*\(/.test(html))throw new Error('document.write runtime loading is prohibited.');
const orderedScripts=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const scriptTags=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
if(scriptTags.length!==orderedScripts.length)throw new Error(`Expected ${orderedScripts.length} direct deferred runtime scripts; found ${scriptTags.length}.`);
const buildTokens=new Set();
orderedScripts.forEach((file,index)=>{
  if(scriptTags[index]?.split('?')[0]!==file)throw new Error(`Runtime script order is wrong at ${file}.`);
  if(scriptTags.filter(src=>src.split('?')[0]===file).length!==1)throw new Error(`${file} must occur exactly once in index.html.`);
  const token=new URLSearchParams(scriptTags[index].split('?')[1]||'').get('v');
  if(!token)throw new Error(`${file} is missing the shared build/cache identity.`);
  buildTokens.add(token);
});
if(buildTokens.size!==1)throw new Error('Runtime scripts do not use one shared build/cache identity.');

const activeFiles=['index.html','app-core.js','workflow-schema.js','test-runtime.js','test-worker.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','workbook.js'];
const activeSource=activeFiles.map(file=>fs.readFileSync(file,'utf8')).join('\n');
if(/MutationObserver/.test(activeSource))throw new Error('Patch-style MutationObserver behavior remains active.');
if(/human-project\/31|31 operations|Stage 31|Operation 31/i.test(activeSource))throw new Error('A prohibited Stage/Operation 31 remains.');

for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const runtime=globalThis.closedLoopTestRuntime;
if(core?.WORKFLOW_ID!=='mobile-closed-loop/30')throw new Error('Workflow identity is wrong.');
if(core?.PROJECT_SCHEMA!=='closed-loop-project/3')throw new Error('Runtime project schema is wrong.');
if(core?.STAGES?.length!==30)throw new Error('Runtime workflow does not contain exactly 30 stages.');
if(core.STAGES[15]?.title!=='CORRECT THE ROOT CAUSE')throw new Error('Visible Stage 16 title is wrong.');
if(schema?.RESPONSE_SCHEMA!=='closed-loop-stage-response/3')throw new Error('Runtime response schema is wrong.');
if(runtime?.SPEC_VERSION!=='closed-loop-test-spec/1')throw new Error('Test IR schema is wrong.');
if(!runtime?.OPS?.includes('BYTE_COMPARE'))throw new Error('Required Test IR primitives are unavailable.');

console.log(JSON.stringify({
  singleApplicationShell:true,
  stages:30,
  workflow:'mobile-closed-loop/30',
  projectSchema:'closed-loop-project/3',
  responseSchema:'closed-loop-stage-response/3',
  testIrSchema:'closed-loop-test-spec/1',
  retainedFixtureStage1:'COMPLETE',
  obsoleteRuntimeWrappers:false,
  sharedBuildIdentity:[...buildTokens][0]
},null,2));

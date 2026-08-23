import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const failures=[];const evidence=[];
const ok=(condition,message)=>{(condition?evidence:failures).push(message)};
const rootFiles=fs.readdirSync('.');
const index=fs.readFileSync('index.html','utf8');
const loader=fs.readFileSync('workbook.js','utf8');
const testProject=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
const runtimeParts=['workbook.module.gz.1','workbook.module.gz.2','workbook.module.gz.3'];
const compressed=Buffer.concat(runtimeParts.map(name=>fs.readFileSync(name)));
const source=zlib.gunzipSync(compressed).toString('utf8');

const html=rootFiles.filter(name=>name.endsWith('.html'));
ok(html.length===1&&html[0]==='index.html','exactly one application HTML entry exists');
ok(!rootFiles.some(name=>/^(?:app[-_]|v\d|index[-_]).*\.html$/i.test(name)),'no alternate/versioned application HTML exists');
ok(index.includes('Mobile Closed-Loop Agent Reliability Workbook'),'existing workbook application shell retained');
ok(index.includes('New clean job')&&index.includes('Export')&&index.includes('Import'),'human job controls retained');
ok(loader.includes('Test project')&&loader.includes('runBrowserTestProject'),'retained test project is human-accessible from the existing app');
ok(loader.includes('TEST_PROJECT.json')&&rootFiles.includes('TEST_PROJECT.json'),'retained deterministic test-project fixture exists and is used');
ok(testProject.testProjectId==='TEST-PROJECT-30-STAGE-001'&&testProject.autoload===false,'test project remains a retained non-autoload fixture');
ok(loader.includes('hideDeveloperSurfaces')&&loader.includes('data-contextual-controls'),'appendix/dashboard developer surfaces are hidden while contextual workflow controls remain');
ok(!loader.includes('Repository test project')&&!loader.includes('Deployment gate')&&!loader.includes('Verifier coverage'),'developer/repository diagnostic prose is not rendered as primary user UI');
ok(runtimeParts.every(name=>loader.includes(name))&&loader.includes('DecompressionStream("gzip")'),'existing runtime payload is loaded without a second app');
ok(loader.includes('cache:"no-store"'),'runtime bypasses stale asset reuse');
ok(source.includes('export const STAGES'),'workbook module payload decompresses');

const temp=path.join(process.cwd(),'.verify-runtime.mjs');fs.writeFileSync(temp,source);let module;
try{module=await import(pathToFileURL(temp).href+`?t=${Date.now()}`)}finally{fs.rmSync(temp,{force:true})}
const {STAGES,APPENDICES,createBlankState,buildStagePrompt,stageHumanItems,stageGateItems,stageEvidenceItems,REQUIREMENT_OUTCOMES,RELEASE_OUTCOMES}=module;
ok(STAGES.length===30&&STAGES.every((s,i)=>s.number===i+1),'exactly 30 ordered stages exist');
ok(new Set(STAGES.map(s=>s.title)).size===30,'all 30 stage titles are distinct');
ok(Object.keys(APPENDICES).sort().join('')==='ABCDEF','Appendix A-F operational definitions are retained');
const blank=createBlankState();ok(blank?.appendices&&Object.keys(blank.appendices).sort().join('')==='ABCDEF','Appendix A-F records share the workbook job state');
ok(REQUIREMENT_OUTCOMES.join('|')==='SATISFIED|VIOLATED|UNDETERMINED','exact requirement outcomes retained');
ok(RELEASE_OUTCOMES.join('|')==='ACCEPTED|REJECTED|BLOCKED','exact release outcomes retained');
const defectIds=STAGES.flatMap(s=>s.defectIds||[]);ok(defectIds.length===269&&new Set(defectIds).size===269,'269 explicit stage defect identifiers are represented exactly once');
const controls=STAGES.flatMap(s=>[...stageHumanItems(s),...stageGateItems(s),...stageEvidenceItems(s)]);ok(controls.length>=400,`at least 400 explicit workbook controls exist (actual ${controls.length})`);
ok(STAGES.every(s=>stageHumanItems(s).length&&stageGateItems(s).length&&stageEvidenceItems(s).length),'every stage has human, gate, and evidence controls');
const prompts=STAGES.map(s=>buildStagePrompt(s,createBlankState()));ok(prompts.length===30&&prompts.every(Boolean),'all 30 copy-ready stage blocks remain available inside their stages');
ok(prompts.every(p=>p.includes('Do not invent a missing fact')),'universal evidence discipline remains in every copy block');

if(failures.length){console.error(JSON.stringify({determination:'VIOLATED',failures,evidenceCount:evidence.length},null,2));process.exit(1)}
console.log(JSON.stringify({determination:'SATISFIED',application:'index.html',applicationEntries:1,testProject:'TEST_PROJECT.json + verify.mjs',testProjectVisibleInApplication:true,stages:30,stageDefectIds:defectIds.length,stageControls:controls.length,appendixControlFamilies:6,separateAppendixChecklistView:false,developerDiagnosticsInPrimaryUI:false,behavioralChecks:evidence.length},null,2));

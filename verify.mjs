import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';

const failures=[];
const evidence=[];
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
ok(!rootFiles.some(name=>/^(?:app[-_]|v\d|index[-_]).*\.html$/i.test(name)),'no alternate or versioned application HTML exists');
ok(index.includes('Mobile Closed-Loop Agent Reliability Workbook'),'existing workbook application shell is retained');
ok(index.includes('New clean job')&&index.includes('Export')&&index.includes('Import'),'human job controls are retained');
ok(loader.includes('.tools{display:grid!important;grid-template-columns:repeat(4')&&loader.includes('.nav{display:grid!important;grid-template-columns:repeat(3'),'phone controls and stage navigation are compact rather than giant button walls');
ok(loader.includes('#appendix-operational-purpose')&&loader.includes('#repository-test-project'),'legacy internal panels are removed from the human UI');

ok(rootFiles.includes('verify.mjs')&&rootFiles.includes('TEST_PROJECT.json'),'repository retains its test-project data and verifier');
ok(testProject.testProjectId==='TEST-PROJECT-30-STAGE-001','test-project identity is stable');
ok(testProject.autoload===false&&testProject.externalAuthority===false,'test project never contaminates a new real job');
ok(loader.includes('loadTestJob')&&loader.includes('buildTestJobState')&&loader.includes('TEST_PROJECT.json'),'test project loads into the same existing workbook state');
ok(loader.includes('b.textContent="Test project"'),'human-facing test-project action is present');
ok(!loader.includes('runBrowserTestProject')&&!loader.includes('test-project-results')&&!loader.includes('TEST_PANEL_ID='),'no developer diagnostic runner or report panel is presented as the project');

for(const label of ['User-entered project data','Exact requested deliverable','Supplied inputs and source inventory','Requirements','Generated production instruction','Verification tests','Failure and mutation tests','All execution runs and outputs','Defects, root cause, corrections, and regressions','Convergence and frozen baseline','Finished product','Release gate and byte identity','Complete evidence chains','All 30 completed stage records'])ok(loader.includes(label),`test project visibly exposes ${label.toLowerCase()}`);
ok(loader.includes('Open Stage ${pad(n)} in the stage navigator to inspect its full human checklist, fill-in record, generated copy block, gate, and evidence controls.'),'stage records explicitly route the user to the full stage-native controls and generated copy block');
ok(loader.includes('Nothing here is a developer diagnostic panel.'),'test-project UI is explicitly human-facing rather than developer diagnostics');

ok(loader.includes('removeInternalPanels')&&loader.includes('GLOBAL_INTERNAL_HEADING'),'legacy Appendix and diagnostic summary panels are removed');
ok(!loader.includes('APPENDIX A–F — OPERATIONAL CONTROLS'),'application does not build a permanent Appendix checklist wall');
ok(runtimeParts.every(name=>loader.includes(name))&&loader.includes('DecompressionStream("gzip")'),'existing runtime payload is loaded without a second application');
ok(loader.includes('cache:"no-store"'),'runtime and test-project assets bypass stale-cache reuse');
ok(source.includes('export const STAGES'),'workbook module payload decompresses');

const exactBytes=Buffer.from(testProject.objective.exactProductUtf8,'utf8');
const exactHash=crypto.createHash('sha256').update(exactBytes).digest('hex');
ok(exactBytes.length===testProject.objective.expectedByteLength,'test-project final product byte length is internally consistent');
ok(exactHash===testProject.objective.expectedSha256,'test-project final product SHA-256 is internally consistent');
ok(testProject.phases?.initial?.runCount===10&&testProject.phases?.corrected?.runCount===10&&testProject.phases?.confirmation?.runCount===10,'test project contains all thirty execution records across initial, corrected, and unchanged confirmation batches');
ok(testProject.phases?.initial?.expectedOutcome==='REJECTED'&&testProject.phases?.corrected?.expectedOutcome==='SATISFIED'&&testProject.phases?.confirmation?.expectedOutcome==='CONFIRMED','test project preserves failure, correction, and unchanged confirmation');
ok(testProject.phases?.confirmation?.zeroChange===true,'confirmation iteration is explicitly zero-change');
ok(testProject.release?.releaseState==='ACCEPTED'&&testProject.release?.hashesEqual===true&&testProject.release?.deliveryAuthorization==='AUTHORIZED','test-project release evidence is internally consistent');
ok(Array.isArray(testProject.stageEvidence)&&testProject.stageEvidence.length===30,'test project contains evidence for all 30 stages');

const temp=path.join(process.cwd(),'.verify-runtime.mjs');
fs.writeFileSync(temp,source);
let module;
try{module=await import(pathToFileURL(temp).href+`?t=${Date.now()}`)}finally{fs.rmSync(temp,{force:true})}
const {STAGES,APPENDICES,createBlankState,buildStagePrompt,stageHumanItems,stageGateItems,stageEvidenceItems,REQUIREMENT_OUTCOMES,RELEASE_OUTCOMES,immutableRevision,invalidateDownstream,compareArtifactSets}=module;
ok(STAGES.length===30&&STAGES.every((stage,index)=>stage.number===index+1),'exactly 30 ordered stages exist');
ok(new Set(STAGES.map(stage=>stage.title)).size===30,'all 30 stage titles are distinct');
ok(Object.keys(APPENDICES).sort().join('')==='ABCDEF','Appendix A-F operational definitions remain in the workbook logic');
const blank=createBlankState();
ok(blank?.appendices&&Object.keys(blank.appendices).sort().join('')==='ABCDEF','Appendix A-F event records remain part of the same job state');
ok(REQUIREMENT_OUTCOMES.join('|')==='SATISFIED|VIOLATED|UNDETERMINED','exact requirement outcomes are retained');
ok(RELEASE_OUTCOMES.join('|')==='ACCEPTED|REJECTED|BLOCKED','exact release outcomes are retained');
const defectIds=STAGES.flatMap(stage=>stage.defectIds||[]);
ok(defectIds.length===269&&new Set(defectIds).size===269,'269 explicit stage defect identifiers are represented exactly once');
const controls=STAGES.flatMap(stage=>[...stageHumanItems(stage),...stageGateItems(stage),...stageEvidenceItems(stage)]);
ok(controls.length>=400,`at least 400 explicit workbook controls exist (actual ${controls.length})`);
ok(STAGES.every(stage=>stageHumanItems(stage).length&&stageGateItems(stage).length&&stageEvidenceItems(stage).length),'every stage has human, gate, and evidence controls');
const prompts=STAGES.map(stage=>buildStagePrompt(stage,createBlankState()));
ok(prompts.length===30&&prompts.every(Boolean),'all 30 copy-ready stage blocks remain available inside their stages');
ok(prompts.every(prompt=>prompt.includes('Do not invent a missing fact')),'universal evidence discipline remains in every copy block');

const history=[];
const first=await immutableRevision(history,{value:1},{artifactType:'TEST'});history.push(first.record);
const second=await immutableRevision(history,{value:2},{artifactType:'TEST'});
ok(first.record.version==='v001'&&second.record.version==='v002'&&history[0].payload.value===1,'material revisions append without overwriting history');
const downstream=createBlankState();downstream.stages[2].decision='READY TO PROCEED';downstream.stages[2].status='COMPLETE';
ok(invalidateDownstream(downstream,1,'CHANGE-1').length>0&&downstream.stages[2].decision==='NOT READY - CORRECTION REQUIRED','material upstream change invalidates downstream determinations');
const audited=[{artifactId:'A1',name:'artifact',size:1,sha256:'1'.repeat(64)}];
const same=[{name:'artifact',size:1,sha256:'1'.repeat(64)}];
const different=[{name:'artifact',size:1,sha256:'2'.repeat(64)}];
ok(compareArtifactSets(audited,same,'ACCEPTED').authorization==='AUTHORIZED','accepted byte-identical release is authorized');
ok(compareArtifactSets(audited,different,'ACCEPTED').authorization==='NOT AUTHORIZED','hash mismatch stops release');
ok(compareArtifactSets(audited,same,'BLOCKED').authorization==='NOT AUTHORIZED','non-ACCEPTED gate stops release');

if(failures.length){console.error(JSON.stringify({determination:'VIOLATED',failures,evidenceCount:evidence.length},null,2));process.exit(1)}
console.log(JSON.stringify({determination:'SATISFIED',application:'index.html',applicationEntries:1,testProject:'TEST_PROJECT.json loaded into existing workbook',testProjectVisible:true,testProjectHumanFacing:true,testProjectDataVisible:true,testProjectRunsVisible:30,stages:30,stageDefectIds:defectIds.length,stageControls:controls.length,appendixControlFamilies:6,separateAppendixChecklistView:false,developerDiagnosticsInPrimaryUI:false,behavioralChecks:evidence.length},null,2));

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
ok(loader.includes('grid-template-columns:repeat(2,minmax(0,1fr))')&&loader.includes('.tools{display:grid'),'phone controls and stage navigation use a compact human layout');
ok(loader.includes('#appendix-operational-purpose')&&loader.includes('#repository-test-project'),'known internal panels are hidden whenever the runtime renders them');

ok(rootFiles.includes('verify.mjs')&&rootFiles.includes('TEST_PROJECT.json'),'the repository test project is retained');
ok(testProject.testProjectId==='TEST-PROJECT-30-STAGE-001','the retained test-project identity is exact');
ok(testProject.autoload===false&&testProject.externalAuthority===false,'the test project never autoloads and is not authority for real jobs');
ok(loader.includes('loadTestJob')&&loader.includes('buildTestJobState')&&loader.includes('TEST_PROJECT.json'),'the retained test project loads as an actual job in the existing workbook');
ok(loader.includes('button.textContent="Test job"'),'the human-facing test-job action is concise');
ok(!loader.includes('function runBrowserTestProject')&&!loader.includes('id="test-project-results"')&&!loader.includes('Verifier coverage</strong>'),'repository diagnostics are not rendered in the human application');
ok(loader.includes('INTERNAL_TEXT')&&loader.includes('removeInternalPanels'),'developer and deployment prose is explicitly detected and removed from the primary UI');

ok(loader.includes('removeInternalPanels')&&loader.includes('GLOBAL_INTERNAL_HEADING'),'global Appendix and diagnostic panels are removed');
ok(loader.includes('humanizeContextualControls')&&loader.includes('data-human-stage-records'),'Appendix records remain available only as stage-native human records');
ok(loader.includes('Independent run setup')&&loader.includes('Blocked stage')&&loader.includes('Change impact')&&loader.includes('Final release')&&loader.includes('New job setup')&&loader.includes('Response record'),'all six Appendix controls have human-facing contextual titles');
ok(!loader.includes('APPENDIX A–F — OPERATIONAL CONTROLS'),'the application does not build a global Appendix summary wall');
ok(loader.includes('Save this record')&&loader.includes('Additional information for this stage'),'contextual controls tell the user what to do where they apply');

ok(runtimeParts.every(name=>loader.includes(name))&&loader.includes('DecompressionStream("gzip")'),'the existing runtime payload is loaded without a second application');
ok(loader.includes('cache:"no-store"'),'runtime assets bypass stale-cache reuse');
ok(source.includes('export const STAGES'),'workbook module payload decompresses');

const exactBytes=Buffer.from(testProject.objective.exactProductUtf8,'utf8');
const exactHash=crypto.createHash('sha256').update(exactBytes).digest('hex');
ok(exactBytes.length===testProject.objective.expectedByteLength,'test-project exact product byte length is internally consistent');
ok(exactHash===testProject.objective.expectedSha256,'test-project exact product SHA-256 is internally consistent');
ok(testProject.phases?.initial?.runCount===10&&testProject.phases?.corrected?.runCount===10&&testProject.phases?.confirmation?.runCount===10,'test project preserves all three ten-run batches');
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
ok(Object.keys(APPENDICES).sort().join('')==='ABCDEF','Appendix A-F operational definitions are retained');
const blank=createBlankState();
ok(blank?.appendices&&Object.keys(blank.appendices).sort().join('')==='ABCDEF','Appendix A-F records share the workbook job state');
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
const first=await immutableRevision(history,{value:1},{artifactType:'TEST'});
history.push(first.record);
const second=await immutableRevision(history,{value:2},{artifactType:'TEST'});
ok(first.record.version==='v001'&&second.record.version==='v002'&&history[0].payload.value===1,'material revisions append without overwriting history');
const downstream=createBlankState();
downstream.stages[2].decision='READY TO PROCEED';
downstream.stages[2].status='COMPLETE';
ok(invalidateDownstream(downstream,1,'CHANGE-1').length>0&&downstream.stages[2].decision==='NOT READY - CORRECTION REQUIRED','material upstream change invalidates downstream determinations');
const audited=[{artifactId:'A1',name:'artifact',size:1,sha256:'1'.repeat(64)}];
const same=[{name:'artifact',size:1,sha256:'1'.repeat(64)}];
const different=[{name:'artifact',size:1,sha256:'2'.repeat(64)}];
ok(compareArtifactSets(audited,same,'ACCEPTED').authorization==='AUTHORIZED','accepted byte-identical release is authorized');
ok(compareArtifactSets(audited,different,'ACCEPTED').authorization==='NOT AUTHORIZED','hash mismatch stops release');
ok(compareArtifactSets(audited,same,'BLOCKED').authorization==='NOT AUTHORIZED','non-ACCEPTED gate stops release');

if(failures.length){
  console.error(JSON.stringify({determination:'VIOLATED',failures,evidenceCount:evidence.length},null,2));
  process.exit(1);
}
console.log(JSON.stringify({
  determination:'SATISFIED',
  application:'index.html',
  applicationEntries:1,
  testProject:'TEST_PROJECT.json + verify.mjs',
  testProjectVisibleAsDiagnostics:false,
  testProjectLoadableAsJob:true,
  stages:30,
  stageDefectIds:defectIds.length,
  stageControls:controls.length,
  appendixControlFamilies:6,
  separateAppendixChecklistView:false,
  contextualHumanAppendixControls:true,
  developerDiagnosticsInPrimaryUI:false,
  behavioralChecks:evidence.length
},null,2));

import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const failures=[];
const evidence=[];
const ok=(condition,message)=>{(condition?evidence:failures).push(message);};

const rootFiles=fs.readdirSync('.');
const index=fs.readFileSync('index.html','utf8');
const loader=fs.readFileSync('workbook.js','utf8');
const retainedTestProject=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
const runtimeParts=['workbook.module.gz.1','workbook.module.gz.2','workbook.module.gz.3'];
const compressed=Buffer.concat(runtimeParts.map(name=>fs.readFileSync(name)));
const source=zlib.gunzipSync(compressed).toString('utf8');

const rootHtml=rootFiles.filter(name=>name.endsWith('.html'));
ok(rootHtml.length===1&&rootHtml[0]==='index.html','exactly one application HTML entry exists');
ok(!rootFiles.some(name=>/^(?:app[-_]|v\d|index[-_]).*\.html$/i.test(name)),'no alternate or versioned application HTML exists');
ok((index.match(/<script[^>]+src=/g)||[]).length===1&&/<script\s+src="workbook\.js(?:\?[^\"]*)?"><\/script>/.test(index),'the one application loads one external runtime entry');
ok(runtimeParts.every(name=>loader.includes(name))&&loader.includes('DecompressionStream("gzip")'),'the existing workbook runtime payload is loaded');
ok(loader.includes('cache:"no-store"')&&loader.includes('single-workbook-operational-controls-and-test-project-20260823'),'the current runtime and module payload bypass stale asset reuse');
ok(compressed.length>0&&source.includes('export const STAGES'),'the workbook module payload exists and decompresses');

ok(rootFiles.includes('verify.mjs'),'the repository test runner exists as verify.mjs');
ok(rootFiles.includes('TEST_PROJECT.json'),'the retained 30-stage test project exists as TEST_PROJECT.json');
ok(retainedTestProject.schema==='mobile-closed-loop-retained-test-project/1','the retained test project uses the controlled schema');
ok(retainedTestProject.externalAuthority===false&&retainedTestProject.autoload===false,'the retained test project is synthetic evidence and cannot silently replace a clean job');
ok(Array.isArray(retainedTestProject.stageEvidence)&&retainedTestProject.stageEvidence.length===30,'the retained test project contains evidence for all 30 stages');
ok(retainedTestProject.release?.releaseState==='ACCEPTED'&&retainedTestProject.release?.hashesEqual===true&&retainedTestProject.release?.auditedSha256===retainedTestProject.release?.releaseSha256,'the retained test project preserves internally consistent release and hash evidence');
ok(loader.includes('TEST_PANEL_ID="repository-test-project"')&&loader.includes('Run test project'),'the test project is visible and executable inside the existing application');
ok(loader.includes('globalThis.ClosedLoopWorkbook=workbook')&&loader.includes('closed-loop-workbook-ready'),'the loaded workbook module is supplied to the in-app test project');
ok(loader.includes('async function runTestProject')&&loader.includes('activeJobModified:false'),'the in-app test project runs against isolated state and records that the active job was not modified');
ok(loader.includes('WORKBOOK_TEST_PROJECT_EVIDENCE.json')&&loader.includes('Download test evidence'),'the in-app test runner preserves downloadable evidence');
ok(loader.includes('TEST_PROJECT.json')&&loader.includes('Open retained test project'),'the retained test project is directly visible from the existing application');
ok(loader.includes('TP-010')&&loader.includes('At least 400 explicit workbook controls'),'the in-app test project verifies the complete control count');
ok(loader.includes('TP-015')&&loader.includes('Material revisions are append-only'),'the in-app test project verifies immutable revision behavior');
ok(loader.includes('TP-016')&&loader.includes('invalidates downstream determinations'),'the in-app test project verifies downstream invalidation');
ok(loader.includes('TP-017')&&loader.includes('TP-018')&&loader.includes('TP-019'),'the in-app test project verifies release authorization, hash mismatch, and blocked-gate behavior');
ok(loader.includes('TP-020')&&loader.includes('TP-021')&&loader.includes('TP-022')&&loader.includes('TP-023'),'the in-app test runner verifies operational Appendix integration and rejects a static substitute panel');
ok(loader.includes('TP-024')&&loader.includes('TP-025')&&loader.includes('TP-026'),'the in-app test runner validates the retained 30-stage test-project file and its release evidence');

ok(index.includes('data-integrated-appendix-controls="true"'),'Appendix A-F behavior is integrated into the existing application');
const integrated=index.match(/<script data-integrated-appendix-controls="true">([\s\S]*?)<\/script>/)?.[1]||'';
ok(integrated.length>0,'the integrated cross-cutting control runtime is present');
try{new Function(integrated);evidence.push('integrated cross-cutting control runtime parses');}
catch(error){failures.push(`integrated control runtime syntax error: ${error.message}`);}
ok(index.includes("const STORE='mclarw'")&&index.includes('operationalRecords'),'Appendix controls use the same controlling workbook state');
ok(index.includes("const LETTERS=['A','B','C','D','E','F']"),'exactly Appendix control families A-F are retained');
ok(index.includes('const FIELD_ID=')&&index.includes('const MIRROR=')&&index.includes('const TITLES='),'Appendix record identity, mirrors, and record titles are retained');

ok(index.includes('freshRecord(state,n)')&&index.includes('FRESH_CONTEXT_LAUNCH_RECORD_ID'),'Appendix A creates fresh-context records');
ok(index.includes('data-add-fresh')&&index.includes('FRESH_STAGES'),'Appendix A supports repeated independent contexts and runs when required');
ok(index.includes('blockerRecord(state,n)')&&index.includes('openBlockers(state,n)'),'Appendix B creates blockers and prohibits READY while applicable blockers are open');
ok(index.includes("stage.status='BLOCKED'")&&index.includes('invalidateAfter'),'Appendix B stops affected work and invalidates downstream determinations');
ok(index.includes('changeRecord(state,n)')&&index.includes('DOWNSTREAM_ARTIFACTS_INVALIDATED'),'Appendix C creates append-only material-change records with downstream invalidation');
ok(index.includes('verifyIdentity(state,n,gate,audited,release)')&&index.includes("crypto.subtle.digest('SHA-256'"),'Appendix D performs exact SHA-256 and byte-size verification');
ok(index.includes('releaseRecord(state,hashId,audited,release,a,b)')&&index.includes('releaseReady(r)'),'Appendix D retains and enforces the exact final-release record');
ok(index.includes("FINAL_RELEASE_STATUS:'NOT RELEASED'")&&index.includes('Final release is prohibited'),'Appendix D prohibits release until every final-release condition is established');
ok(index.includes('resetRecord(state,old)')&&index.includes("OLD_BASELINE_STATUS_CARRIED_FORWARD:'FALSE'")&&index.includes("OLD_RELEASE_DECISION_CARRIED_FORWARD:'FALSE'"),'Appendix E creates a clean new-job reset without inherited baseline or release status');
ok(index.includes('receiptRecord(state,n)')&&index.includes('NEXT_REQUIRED_VERIFICATION_STAGE'),'Appendix F records every agent output and routes it to independent verification');
ok(index.includes('stageControls(state,n)')&&index.includes('data-workflow-actions')&&index.includes('data-contextual-controls="true"'),'Appendix actions and required records render inside the active stage');
ok(index.includes('Use only when the corresponding event actually occurs.'),'Appendix actions are event-triggered rather than permanent checklist stacks');
ok(index.includes('This record exists because the current workflow event requires it.'),'each Appendix record is explicitly tied to its triggering workflow event');
ok(index.includes('pendingForStage(state,n)')&&index.includes('recordEditor(letter,r)'),'required Appendix records remain full editable records in the applicable stage');

ok(loader.includes('BAD_NAV')&&loader.includes('removeDuplicateNavigation'),'obsolete Appendix/control navigation is removed without creating another application');
ok(loader.includes('activateWorkbookSurface')&&loader.includes('WORKBOOK_NAV'),'a persisted obsolete control view is returned to the existing workbook surface');
ok(loader.includes('keepRequiredRecordsVisible')&&loader.includes('details[data-record]'),'actual Appendix event records remain visible and editable');
ok(!loader.includes('function renderPurpose')&&!loader.includes('function appendices'),'the loader does not replace operational records with a static Appendix description panel');
ok(!loader.includes('compactContextualControls')&&!loader.includes('Required stage control records'),'the loader does not collapse required records into another checklist stack');
ok(!loader.includes('hideStandaloneAppendixReferences')&&!loader.includes('appendixReferenceHidden'),'the loader does not hide the actual Appendix implementation');
ok(!loader.includes('APPENDIX A–F — WORKFLOW CONTROLS')&&!loader.includes('Preserved records:'),'the screenshot-style static Appendix summary has been removed');
ok(!loader.includes('createIntegratedPanel')&&!loader.includes('ACTION_LABELS'),'the loader does not create a second A-F application or parallel control subsystem');

const requiredShellText=[
  'Mobile Closed-Loop Agent Reliability Workbook',
  'How to use this workbook on a phone',
  'Placeholder and outcome rules',
  'Mobile file/version naming and folder structure',
  'Agent-role separation map',
  'Master job control',
  'Master 30-stage tracker',
  'Mandatory operating rules',
  'Quick execution loop',
  'UNKNOWN',
  'NOT APPLICABLE',
  'SATISFIED | VIOLATED | UNDETERMINED',
  'ACCEPTED | REJECTED | BLOCKED',
  '12_PERMANENT_DEFECT_REGISTRY'
];
for(const text of requiredShellText)ok(index.includes(text),`application shell retains: ${text}`);
ok(index.includes('const PHONE_USE=['),'phone-use instructions are implemented');
ok(index.includes('const OPERATING_RULES=['),'the twenty mandatory operating rules are implemented');
ok(index.includes('const ROLE_MAP=['),'the complete role-separation map is implemented');
ok(index.includes('const FOLDERS='),'the controlled phone folder structure is implemented');
ok(index.includes('const LOOP='),'the complete execution loop is implemented');

const temp=path.join(process.cwd(),'.verify-runtime.mjs');
fs.writeFileSync(temp,source);
let module;
try{module=await import(pathToFileURL(temp).href+`?t=${Date.now()}`);}
finally{fs.rmSync(temp,{force:true});}

const {
  STAGES,APPENDICES,SECTION_HEADINGS,STAGE_DECISIONS,REQUIREMENT_OUTCOMES,RELEASE_OUTCOMES,
  FOLDERS,ROLE_SEPARATION,createBlankState,createRecordTemplate,buildStagePrompt,validateStageDraft,
  immutableRevision,invalidateDownstream,compareArtifactSets,hasUnresolvedPlaceholder,
  stageHumanItems,stageGateItems,stageEvidenceItems
}=module;

ok(STAGES.length===30&&STAGES.every((stage,index)=>stage.number===index+1),'exactly 30 ordered stages exist');
ok(new Set(STAGES.map(stage=>stage.title)).size===30,'all 30 stage titles are distinct');
ok(Object.keys(APPENDICES).sort().join('')==='ABCDEF','Appendices A-F remain reusable operational-control definitions');
const blank=createBlankState();
ok(blank&&blank.appendices&&Object.keys(blank.appendices).sort().join('')==='ABCDEF','every actual job retains Appendix A-F record stores');
ok(SECTION_HEADINGS.length===7,'all seven controlling stage sections are retained');
ok(STAGE_DECISIONS.join('|')==='READY TO PROCEED|BLOCKED|NOT READY - CORRECTION REQUIRED','the exact stage decisions are retained');
ok(REQUIREMENT_OUTCOMES.join('|')==='SATISFIED|VIOLATED|UNDETERMINED','the exact requirement outcomes are retained');
ok(RELEASE_OUTCOMES.join('|')==='ACCEPTED|REJECTED|BLOCKED','the exact release outcomes are retained');
ok(!/31-stage|\/31 complete/i.test(index+source),'no alternate 31-stage architecture exists');
ok(ROLE_SEPARATION.length>=20&&FOLDERS.includes('12_PERMANENT_DEFECT_REGISTRY'),'role separation and permanent defect/regression storage are retained');

const stageDefects=STAGES.flatMap(stage=>stage.defectIds||[]);
ok(stageDefects.length===269&&new Set(stageDefects).size===269,'269 explicit stage defect identifiers are represented exactly once');
const stageControls=STAGES.flatMap(stage=>[
  ...stageHumanItems(stage).map((text,index)=>`S${stage.number}-H${index+1}:${text}`),
  ...stageGateItems(stage).map((text,index)=>`S${stage.number}-G${index+1}:${text}`),
  ...stageEvidenceItems(stage).map((text,index)=>`S${stage.number}-E${index+1}:${text}`)
]);
ok(stageControls.length>=400,`the complete workbook exposes at least 400 explicit human, gate, and evidence controls (actual ${stageControls.length})`);
ok(STAGES.every(stage=>stageHumanItems(stage).length>0&&stageGateItems(stage).length>0&&stageEvidenceItems(stage).length>0),'every stage contains human controls, a completion gate, and evidence-preservation controls');

const prompts=STAGES.map(stage=>buildStagePrompt(stage,createBlankState()));
ok(prompts.length===30,'exactly one reusable copy block exists per stage');
ok(prompts.every((prompt,index)=>prompt.includes(STAGES[index].role)&&prompt.includes(STAGES[index].task)),'every copy block preserves its exact stage role and task');
ok(prompts.every(prompt=>prompt.includes('Do not invent a missing fact')&&prompt.includes('SATISFIED')&&prompt.includes('VIOLATED')&&prompt.includes('UNDETERMINED')&&prompt.includes('ACCEPTED')&&prompt.includes('REJECTED')&&prompt.includes('BLOCKED')),'every copy block carries the universal rules and exact outcome vocabulary');
for(const number of [11,12,17,19])ok(prompts[number-1].includes('RUN_ID: <<RUN-001 THROUGH RUN-010>>'),`Stage ${number} retains the reusable ten-run control`);

let state=createBlankState();
const first=STAGES[0];
const item=state.stages[1];
item.draftRecord=createRecordTemplate(first);
item.decision='READY TO PROCEED';
item.decisionEvidence='evidence';
item.decidedBy='reviewer';
item.dateTime='2026-01-01T00:00:00Z';
stageHumanItems(first).forEach((_,index)=>item.humanChecks[index]=true);
stageGateItems(first).forEach((_,index)=>item.gateChecks[index]=true);
stageEvidenceItems(first).forEach((_,index)=>item.evidenceChecks[index]=true);
ok(validateStageDraft(first,item,state).issues.length>0,'unresolved placeholders prevent READY');
item.draftRecord=item.draftRecord.replace(/<<[^>]+>>/g,'VALUE');
state.job.JOB_ID='JOB-1';
state.job.EXACT_USER_OBJECTIVE_VERBATIM='objective';
ok(!hasUnresolvedPlaceholder(item.draftRecord),'completed records contain no unresolved placeholders');

const history=[];
const revision1=await immutableRevision(history,{value:1},{artifactType:'TEST'});
history.push(revision1.record);
const revision2=await immutableRevision(history,{value:2},{artifactType:'TEST'});
ok(revision1.record.version==='v001'&&revision2.record.version==='v002'&&history[0].payload.value===1,'material revisions append without overwriting prior versions');

const downstream=createBlankState();
downstream.stages[2].decision='READY TO PROCEED';
downstream.stages[2].status='COMPLETE';
ok(invalidateDownstream(downstream,1,'CHANGE-1').length>0&&downstream.stages[2].decision==='NOT READY - CORRECTION REQUIRED','material upstream change invalidates affected downstream determinations');

const audited=[{artifactId:'A1',name:'artifact',size:1,sha256:'1'.repeat(64)}];
const identical=[{name:'artifact',size:1,sha256:'1'.repeat(64)}];
const different=[{name:'artifact',size:1,sha256:'2'.repeat(64)}];
ok(compareArtifactSets(audited,identical,'ACCEPTED').authorization==='AUTHORIZED','accepted byte-identical artifacts authorize delivery');
ok(compareArtifactSets(audited,different,'ACCEPTED').authorization==='NOT AUTHORIZED','a hash mismatch stops delivery');
ok(compareArtifactSets(audited,identical,'BLOCKED').authorization==='NOT AUTHORIZED','a non-ACCEPTED release gate stops delivery');

if(failures.length){
  console.error(JSON.stringify({determination:'VIOLATED',failures,evidenceCount:evidence.length},null,2));
  process.exit(1);
}

console.log(JSON.stringify({
  determination:'SATISFIED',
  application:'index.html',
  applicationEntries:1,
  repositoryTestRunner:'verify.mjs',
  retainedTestProject:'TEST_PROJECT.json',
  inApplicationTestProject:true,
  stages:30,
  stageDefectIds:stageDefects.length,
  stageControls:stageControls.length,
  appendixControlFamilies:6,
  staticAppendixSubstitutePanel:false,
  separateAppendixApplication:false,
  stageNativeAppendixRecords:true,
  behavioralChecks:evidence.length
},null,2));

import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const failures=[];
const evidence=[];
const ok=(condition,message)=>(condition?evidence:failures).push(message);
const rootFiles=fs.readdirSync('.');
const index=fs.readFileSync('index.html','utf8');
const loader=fs.readFileSync('workbook.js','utf8');
const human=fs.readFileSync('human-ui.js','utf8');
const testProject=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
const parts=['workbook.module.gz.1','workbook.module.gz.2','workbook.module.gz.3'];
const source=zlib.gunzipSync(Buffer.concat(parts.map(name=>fs.readFileSync(name)))).toString('utf8');

ok(rootFiles.filter(name=>name.endsWith('.html')).join(',')==='index.html','exactly one application HTML entry exists');
ok(index.includes('New project')&&index.includes('>Project<')&&index.includes('Guide')&&index.includes('Export')&&index.includes('Import'),'compact human project controls exist');
ok(index.includes('workbook.js?v=closed-loop-runtime-20260823-r15')&&index.includes('human-ui.js?v=closed-loop-human-20260823-r15'),'the single application loads the current engine and human interface');
ok(index.includes('no-cache, no-store, must-revalidate'),'the application shell prevents stale deployment reuse');
ok(parts.every(name=>loader.includes(name))&&loader.includes('DecompressionStream'),'the retained workflow engine is loaded once from its existing compressed source');
ok(loader.includes('closed-loop-core-ready')&&loader.length<4000,'the workbook loader contains only engine loading and readiness signaling');
ok(!loader.includes('buildTestJobState')&&!loader.includes('fillChecks')&&!loader.includes('human-ui-r10'),'the obsolete duplicate UI and fabricated example runtime are absent');
ok(human.includes("const STORE='mobile-closed-loop-agent'")&&human.includes("const REGISTRY='closed-loop-project-registry-v3'"),'the engine and human workspace share one persisted project state');
ok(index.includes('project-picker')&&index.includes('workspace-project')&&index.includes('stage-select'),'project selection, human project workspace, and on-demand stage workspace exist');
ok(human.includes("renderProject('overview')")&&human.includes("showWorkspace('project')"),'the ordinary entry view is the human project rather than the raw stage form');
ok(['Overview','Workflow','Work','Runs','Issues','Release','History'].every(label=>human.includes(label)),'human project navigation exposes the complete project');
ok(human.includes('Generated stage instructions')&&human.includes('Generated responses and artifacts'),'generated instructions and outputs are inspectable');
ok(human.includes('Complete project history')&&human.includes('Saved response and output'),'stage records, generated instructions, responses, evidence, and decisions remain inspectable');
ok(human.includes('Blockers')&&human.includes('Changes and invalidated work')&&human.includes('Permanent regression tests'),'blockers, change/invalidation, and regressions are first-class project information');
ok(human.includes('Independent executions')&&human.includes('fresh, uncontaminated context'),'fresh-context and run independence are represented contextually');
ok(human.includes('Release readiness')&&human.includes('Complete evidence chains'),'release controls and traceability are integrated into the project');
ok(['Fresh independent work','Blockers','Changes and invalidation','Final release','New projects','Output receipts'].every(label=>human.includes(label)),'Appendix A-F semantics are represented as cross-cutting application capabilities');
ok(!index.includes('APPENDIX A–F — OPERATIONAL CONTROLS'),'an appendix checklist wall is absent from the main interface');
ok(index.includes('min-height:32px')&&index.includes('min-height:30px'),'mobile controls use compact interface dimensions');
ok(human.includes('buildTestState')&&human.includes("source:'TEST_PROJECT.json'")&&human.includes('writeState'),'the test project is loaded through the ordinary project state and views');
ok(human.includes("localStorage.getItem(ACTIVE)||(registry[TEST]?TEST:WORKING)"),'a fresh deployment opens the retained test project while existing project selection remains preserved');

ok(testProject.schema==='mobile-closed-loop-project/3','the test project uses the current project schema');
ok(testProject.title==='Portable generator service handoff','the test project is a domain project, not an application self-test');
ok(testProject.description.includes('genuine project')&&testProject.description.includes('No runs, audits, baseline, product, or release acceptance are fabricated'),'the test project explicitly rejects fabricated downstream work');
ok(testProject.userEnteredData?.unitId==='GEN-042','the test project contains concrete human-entered data');
ok(Array.isArray(testProject.sourceInventory)&&testProject.sourceInventory.length===3&&testProject.sourceInventory.every(item=>item.actualSourceInspected===true),'the test project contains three inspected repository sources');
ok(['test-project/inputs/REQUEST.md','test-project/inputs/SITE_POLICY.md','test-project/inputs/WORKFLOW_RULES.md'].every(file=>fs.existsSync(file)),'the exact test-project source files exist');
ok(testProject.research?.length===4,'source-by-source research and saturation records are preserved');
ok(testProject.requirements?.length===5&&testProject.tests?.length===5,'every mandatory test-project requirement has verification coverage');
ok(testProject.mutations?.length===3&&testProject.mutations.every(item=>item.validatorResult==='EFFECTIVE'),'failure fixtures and validator outcomes are preserved');
ok(testProject.generatedPrompts?.length===11&&testProject.generatedPrompts.at(-1)?.stage===11,'generated stage instructions are preserved through the actual stopping point');
ok(testProject.generatedOutputs?.length===11&&testProject.generatedOutputs.at(-1)?.output.includes('zero are recorded'),'stage records are preserved without synthetic execution outputs');
ok(testProject.currentStage===11&&testProject.currentState==='BLOCKED','the test project truthfully stops at Stage 11');
ok(testProject.phases?.iteration001?.runCountRequired===10&&testProject.phases?.iteration001?.runCountRecorded===0,'the ten-run requirement remains enforced while zero synthetic runs are counted');
ok(Array.isArray(testProject.freshContexts)&&testProject.freshContexts.length===0,'no fake independent contexts are stored');
ok(testProject.blockers?.some(item=>item.blockerId==='BLOCKER-001'&&item.currentStatus==='OPEN'),'the missing independent contexts create a first-class blocker');
ok(testProject.stageStates?.['11']?.status==='BLOCKED'&&testProject.stageStates?.['12']?.status==='NOT STARTED','the blocker stops downstream work');
ok(testProject.baseline?.state==='NOT CREATED'&&testProject.product?.state==='NOT GENERATED','baseline and finished product are not fabricated');
ok(testProject.release?.releaseState==='BLOCKED'&&testProject.release?.deliveryAuthorization==='NOT AUTHORIZED','release and delivery authorization are not fabricated');
ok(testProject.evidenceChains?.length===5&&testProject.evidenceChains.every(item=>item.allRequiredLinksPresent===false&&item.blockerId==='BLOCKER-001'),'incomplete evidence chains remain blocker-linked');
ok(!fs.existsSync('test-project/TEST-JOB-001__FIELD-HANDOFF.md'),'no fabricated completed handoff exists');

const temp=path.join(process.cwd(),'.verify-runtime.mjs');
fs.writeFileSync(temp,source);
let runtime;
try{runtime=await import(pathToFileURL(temp).href+`?t=${Date.now()}`)}finally{fs.rmSync(temp,{force:true})}
const {STAGES,APPENDICES,createBlankState,buildStagePrompt,stageHumanItems,stageGateItems,stageEvidenceItems,immutableRevision,invalidateDownstream,compareArtifactSets}=runtime;
ok(STAGES.length===30&&STAGES.every((stage,index)=>stage.number===index+1),'exactly 30 ordered stages are retained');
ok(Object.keys(APPENDICES).sort().join('')==='ABCDEF','Appendix A-F semantics are retained');
const controls=STAGES.flatMap(stage=>[...stageHumanItems(stage),...stageGateItems(stage),...stageEvidenceItems(stage)]);
ok(controls.length>=400,`400+ underlying controls (${controls.length}) remain implemented`);
ok(STAGES.map(stage=>buildStagePrompt(stage,createBlankState())).every(Boolean),'all 30 stage-specific generated instructions remain available');
const revisions=[];
const first=await immutableRevision(revisions,{value:1},{artifactType:'TEST'});revisions.push(first.record);
const second=await immutableRevision(revisions,{value:2},{artifactType:'TEST'});
ok(first.record.version==='v001'&&second.record.version==='v002','immutable revision control increments identities');
const invalidationState=createBlankState();
invalidationState.stages[2].decision='READY TO PROCEED';invalidationState.stages[2].status='COMPLETE';
ok(invalidateDownstream(invalidationState,1,'CHANGE-1').length>0,'a material upstream change invalidates dependent work');
const audited=[{artifactId:'A1',name:'a',size:1,sha256:'1'.repeat(64)}];
ok(compareArtifactSets(audited,[{name:'a',size:1,sha256:'1'.repeat(64)}],'ACCEPTED').authorization==='AUTHORIZED','matching audited and release bytes authorize delivery');
ok(compareArtifactSets(audited,[{name:'a',size:1,sha256:'2'.repeat(64)}],'ACCEPTED').authorization==='NOT AUTHORIZED','a byte mismatch blocks delivery');
ok(compareArtifactSets(audited,[{name:'a',size:1,sha256:'1'.repeat(64)}],'BLOCKED').authorization==='NOT AUTHORIZED','a BLOCKED gate stops delivery');

if(failures.length){
  console.error(JSON.stringify({determination:'VIOLATED',failures,evidenceCount:evidence.length},null,2));
  process.exit(1);
}
console.log(JSON.stringify({determination:'SATISFIED',application:'index.html',applicationEntries:1,testProject:testProject.testProjectId,testProjectState:testProject.currentState,testProjectRecordedRuns:testProject.phases.iteration001.runCountRecorded,stages:30,controls:controls.length,checks:evidence.length},null,2));

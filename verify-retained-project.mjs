import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const failures=[];
const evidence=[];
const check=(condition,message)=>{(condition?evidence:failures).push(message)};
const index=fs.readFileSync('index.html','utf8');
const loader=fs.readFileSync('workbook.js','utf8');
const readme=fs.readFileSync('README.md','utf8');
const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
const importFixture=JSON.parse(fs.readFileSync('RETAINED_TEST_PROJECT.json','utf8'));
const rootFiles=fs.readdirSync('.');
const rootHtml=rootFiles.filter(name=>name.endsWith('.html'));

check(rootHtml.length===1&&rootHtml[0]==='index.html','one application entry remains: index.html');
check(!rootFiles.some(name=>/test.*\.html$/i.test(name)),'the retained test project is data, not another application');
check(/^mobile-closed-loop-retained-test-project\/[12]$/.test(project.schema),'retained test project uses a supported project schema');
check(project.testProjectId==='TEST-PROJECT-30-STAGE-001','retained project has a stable test-project identity');
check(project.externalAuthority===false&&project.autoload===false,'retained project is non-authoritative and explicitly opened');
check(project.objective?.exactUserObjective&&project.objective?.exactFilename,'retained project stores the exact user request and deliverable data');
check(Array.isArray(project.stageEvidence)&&project.stageEvidence.length===30,'retained project preserves exactly 30 stage-evidence records');
check(project.stageEvidence.every(Boolean),'every retained stage has evidence that the app materializes into a filled record');
check(Array.isArray(project.requirements)&&project.requirements.length===4,'retained project stores four generated atomic requirements');
check(Array.isArray(project.tests)&&project.tests.length===4,'retained project stores four generated verification tests');
check(Array.isArray(project.mutations)&&project.mutations.length===4,'retained project stores four failure tests');
check(project.productionInstruction?.procedure?.length===5,'retained project stores the complete generated production instruction');
check(Object.values(project.phases||{}).reduce((sum,phase)=>sum+phase.runCount,0)===30,'retained phases define exactly 30 execution records');
check(Object.values(project.phases||{}).reduce((sum,phase)=>sum+phase.runCount*project.requirements.length,0)===120,'retained phases define exactly 120 independent requirement verification records');
check(project.release?.releaseState==='ACCEPTED'&&project.release?.hashesEqual===true,'release decision and exact artifact identity are preserved');
check((project.evidenceChains||[]).length===project.requirements.length&&project.evidenceChains.every(chain=>chain.allRequiredLinksPresent),'one complete evidence chain is preserved per mandatory requirement');

check(loader.includes('const PROJECT_STORE="mclarw-projects"'),'the existing app has one saved-project registry');
check(loader.includes('function saveCurrentProject(')&&loader.includes('function openSavedProject('),'the existing app preserves and reopens named projects');
check(loader.includes('function materializeTestProject(')&&loader.includes('executionRuns')&&loader.includes('verificationMatrix'),'retained project expansion creates every run and verification record');
check(loader.includes('function currentPanel(')&&loader.includes('function testPanel('),'current and retained projects use the same project-inspection surface');
check(loader.includes('All 30 stage records and generated prompts')&&loader.includes('data-generated-prompt'),'all 30 generated prompts are visibly inspectable');
check(loader.includes('Complete stored project data')&&loader.includes('Complete test-project data'),'nothing is hidden from complete raw inspection');
check(loader.includes('data-download-current')&&loader.includes('data-download-test'),'complete current and retained project data can be exported');
check(loader.includes('data-load-test'),'the retained project can be loaded into the existing workbook without a second app');
check(loader.includes('saveCurrentProject(false);writeState(buildTestState(spec));location.reload()'),'loading the retained project preserves the current named project first');
check(loader.includes('Exact user request, supplied materials, and filled-in job data'),'human-facing labels describe user-relevant project information');
check(loader.includes('All execution records')&&loader.includes('All independent verification records'),'human-facing labels expose execution and verification evidence');
check(!index.includes('TEST-JOB-001'),'test-project job data is not hard-coded into the application shell');
check((index.match(/<script[^>]+src=/g)||[]).length===1,'project support does not add another runtime entry');
check(readme.includes('Project data')&&readme.includes('Test project')&&readme.includes('30 execution records')&&readme.includes('120 independent verification records'),'repository documentation describes the complete human-facing project inspection');

check(importFixture.schema==='mclarw/30','legacy retained import fixture still uses the current workbook schema');
check(importFixture.projectKind==='RETAINED_TEST_PROJECT'&&importFixture.nonAuthoritative===true,'legacy import fixture remains explicitly non-authoritative');
check(Array.isArray(importFixture.stages)&&importFixture.stages.length===30,'legacy import fixture remains a valid 30-stage import file');

const chunks=['workbook.module.gz.1','workbook.module.gz.2','workbook.module.gz.3'];
const compressed=Buffer.concat(chunks.map(name=>fs.readFileSync(name)));
const source=zlib.gunzipSync(compressed).toString('utf8');
const temp=path.join(process.cwd(),'.verify-retained-runtime.mjs');
fs.writeFileSync(temp,source);
let runtime;
try{runtime=await import(pathToFileURL(temp).href+'?t='+Date.now())}finally{fs.rmSync(temp,{force:true})}
const blank=runtime.createBlankState();
check(blank.schema==='mclarw/30'&&blank.stages.length===30,'new clean job uses the same current 30-stage schema');
check(blank.stages.every(stage=>stage.status==='NOT STARTED'),'new clean job remains empty rather than inheriting retained project status');
check(blank.job.currentStage===1&&blank.job.currentState==='NOT STARTED','new clean job starts at Stage 01 and NOT STARTED');
check(blank.job.id===''&&blank.job.title==='','new clean job does not inherit the retained test project identity');
const prompts=runtime.STAGES.map(stage=>runtime.buildStagePrompt(stage,blank));
check(prompts.length===30&&prompts.every(Boolean),'the runtime generates exactly one complete prompt for every retained project stage');

if(failures.length){console.error(JSON.stringify({determination:'VIOLATED',failures,evidenceCount:evidence.length},null,2));process.exit(1)}
console.log(JSON.stringify({determination:'SATISFIED',application:'index.html',applicationEntries:1,retainedTestProject:'TEST_PROJECT.json',storedStageEvidence:project.stageEvidence.length,derivedExecutionRecords:30,derivedVerificationRecords:120,generatedStagePrompts:prompts.length,legacyImportFixture:'RETAINED_TEST_PROJECT.json',evidenceCount:evidence.length},null,2));

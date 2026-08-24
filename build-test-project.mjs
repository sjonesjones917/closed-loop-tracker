import fs from 'node:fs';
import './build-test-project-impl.mjs';

const required=['index.html','app.js','app-core.js','prompt-engine.js','workbook.js','experience.js','TEST_PROJECT.json','AUTHORIZED_OPERATION_01.txt','verify.mjs','verify-live.mjs','verify-browser.mjs','verify-prompts-live.mjs','verify-prompt-isolation.mjs'];
for(const file of required)if(!fs.existsSync(file))throw new Error(`Missing ${file}`);

const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
if(project.schema!=='human-project/30')throw new Error(`Unexpected project schema ${project.schema}`);
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Authorized retained project identity is wrong.');
if(Object.keys(project.stageRecords||{}).length!==30)throw new Error('Retained project must contain exactly 30 stage records.');
if(project.stageRecords?.['1']?.status!=='COMPLETE'||project.currentStage!==2||project.currentState!=='READY')throw new Error('Retained project must preserve completed Stage 01 and current Stage 02 READY state.');
for(let n=2;n<=30;n++)if(project.stageRecords?.[String(n)]?.status!=='NOT STARTED')throw new Error(`Stage ${n} must remain NOT STARTED.`);

const loader=fs.readFileSync('app.js','utf8');
const app=fs.readFileSync('app-core.js','utf8');
const prompts=fs.readFileSync('prompt-engine.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const experience=fs.readFileSync('experience.js','utf8');
const isolation=fs.readFileSync('verify-prompt-isolation.mjs','utf8');

for(const token of ['prompt-engine.js','app-core.js'])if(!loader.includes(token))throw new Error(`Application loader is missing ${token}`);
for(const token of [
  'const recordSchemas=',
  'function structuredRecords(',
  'function addStructuredRecord(',
  'function createUniqueJobId(',
  'function validateStructuredStageState(',
  'function appendixDefault(',
  'structuredIssues=validateStructuredStageState',
  "['Release control',current.release]",
  'filenamesIdentical',
  'retainedBytes:false',
  "recordHistory('STAGE_DECISION_SAVED'",
  "19:['runs']"
])if(!app.includes(token))throw new Error(`Committed application core is missing ${token}`);
for(const token of ['core.buildStagePrompt=build','const procedures={','const inputCollections={','AUTHORIZED INPUTS FOR THIS STAGE','STAGE-SPECIFIC TASK','CONTROLLING PROJECT INPUT','PROJECT-SCOPE BOUNDARY','Do not instruct the operator to reuse this prompt for other jobs','genuinely independent external authorities','Research only the legitimate Stage 02 external governing source set','2026-08-24-r2'])if(!prompts.includes(token))throw new Error(`Project-specific prompt engine is missing ${token}`);
for(let n=1;n<=30;n++)if(!prompts.includes(`${n}:'`))throw new Error(`Stage ${n} does not have a stage-specific prompt procedure.`);
for(const token of ['100000','Cross-project retained-test contamination','Stage 01 reusable-template prohibition missing','Stage 02 authority boundary missing'])if(!isolation.includes(token))throw new Error(`Prompt isolation test is missing ${token}`);
for(const token of ['Mobile closed-loop control','Current work','Completed work','Continue current stage','Work for this stage','Completion controls','Find project information','Supporting records','deleteCurrentProject','enforceConsistentPageWidth'])if(!experience.includes(token))throw new Error(`Human-facing experience is missing ${token}`);
if(!/<link\s+rel=["']icon["']/i.test(html))throw new Error('Application icon is missing.');
if(!html.includes('experience.js?v=closed-loop-runtime-20260823-2103-r3'))throw new Error('Human-facing experience asset is not wired into the single application shell.');
if(!html.includes('closed-loop-runtime-20260823-2037-r2'))throw new Error('Expected deployed cache identity is missing.');
if(html.includes('closed-loop-retained-project-refresh'))throw new Error('The app shell must not delete a retained project from browser storage during load.');
const uiSource=loader+app+prompts+html+experience+fs.readFileSync('workbook.js','utf8');
const banned=new RegExp('se'+'mantic','i');
if(banned.test(uiSource))throw new Error('Prohibited application terminology remains.');
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(uiSource+JSON.stringify(project)))throw new Error('Unrelated product content remains.');

console.log('Retained project, application core, project-scoped 30-stage prompt engine, and human-facing experience verified without rewriting project data.');
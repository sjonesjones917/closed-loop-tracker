import fs from 'node:fs';
import './build-test-project-impl.mjs';

const required=['index.html','app.js','workbook.js','TEST_PROJECT.json','AUTHORIZED_OPERATION_01.txt','verify.mjs','verify-live.mjs','verify-browser.mjs'];
for(const file of required)if(!fs.existsSync(file))throw new Error(`Missing ${file}`);

const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
if(project.schema!=='human-project/30')throw new Error(`Unexpected project schema ${project.schema}`);
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Authorized retained project identity is wrong.');
if(Object.keys(project.stageRecords||{}).length!==30)throw new Error('Retained project must contain exactly 30 stage records.');
if(project.stageRecords?.['1']?.status!=='COMPLETE'||project.currentStage!==2||project.currentState!=='READY')throw new Error('Retained project must preserve completed Stage 01 and current Stage 02 READY state.');
for(let n=2;n<=30;n++)if(project.stageRecords?.[String(n)]?.status!=='NOT STARTED')throw new Error(`Stage ${n} must remain NOT STARTED.`);

const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
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
])if(!app.includes(token))throw new Error(`Committed application is missing ${token}`);
if(!/<link\s+rel=["']icon["']/i.test(html))throw new Error('Application icon is missing.');
if(!html.includes('closed-loop-30-runtime-20260823-2001'))throw new Error('Expected deployed cache identity is missing.');

console.log('Retained project and committed application verified without rewriting source files.');

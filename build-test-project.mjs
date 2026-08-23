import fs from 'node:fs';

const required=['index.html','app.js','workbook.js','TEST_PROJECT.json','AUTHORIZED_OPERATION_01.txt','verify.mjs'];
for(const file of required)if(!fs.existsSync(file))throw new Error(`Missing ${file}`);

const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
if(project.schema!=='human-project/30')throw new Error(`Unexpected project schema ${project.schema}`);
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Authorized retained project identity is wrong.');
if(Object.keys(project.stageRecords||{}).length!==30)throw new Error('Retained project must contain exactly 30 stage records.');
if(project.stageRecords?.['1']?.status!=='COMPLETE'||project.currentStage!==2||project.currentState!=='READY')throw new Error('Retained project must preserve completed Stage 01 and current Stage 02 READY state.');
for(let n=2;n<=30;n++)if(project.stageRecords?.[String(n)]?.status!=='NOT STARTED')throw new Error(`Stage ${n} must remain NOT STARTED.`);

const appPath='app.js';
let app=fs.readFileSync(appPath,'utf8');
app=app.replace('async async function saveJob(', 'async function saveJob(');
app=app.replace('async function createUniqueJobId(', 'function createUniqueJobId(');
for(const token of ['const recordSchemas=','function structuredRecords(','function addStructuredRecord(','function createUniqueJobId(','document.querySelectorAll(\'[data-add-record]\')'])if(!app.includes(token))throw new Error(`Canonical application is missing ${token}`);

if(!app.includes('const blockingRecord=openBlockers().find(')){
  const needle='const check=core.validateStageDraft(d,s,current);';
  const replacement="const blockingRecord=openBlockers().find(x=>{const bStage=Number(String(x.stageDiscovered||x.STAGE_DISCOVERED||x.fields?.STAGE_DISCOVERED||'').match(/\\d+/)?.[0]||0);return !bStage||bStage<=n;});if(blockingRecord&&s.decision==='READY TO PROCEED'){s.status='BLOCKED';current.job.CURRENT_STAGE=`STAGE ${String(n).padStart(2,'0')}`;current.job.CURRENT_STATE='BLOCKED';current.job.NEXT_REQUIRED_ACTION=`Resolve blocker ${blockingRecord.blockerId||blockingRecord.BLOCKER_ID||blockingRecord.id||blockingRecord.fields?.BLOCKER_ID||'UNKNOWN'} before continuing.`;const m=$('#stage-message');m.className='notice warn';m.innerHTML='<strong>Stage blocked.</strong><br>An open mandatory blocker must be resolved before advancement.';save();header();return;}const check=core.validateStageDraft(d,s,current);";
  if(!app.includes(needle))throw new Error('Cannot locate stage validation gate.');
  app=app.replace(needle,replacement);
}
fs.writeFileSync(appPath,app);

const html=fs.readFileSync('index.html','utf8');
if(!/<link\s+rel=["']icon["']/i.test(html))throw new Error('Application icon is missing.');
console.log('Retained project verified; canonical structured application and blocker gate are materialized.');

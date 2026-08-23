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
const start=app.indexOf('function overview(){');
const end=start<0?-1:app.indexOf('const jobFields=',start);
if(start<0||end<0)throw new Error('Cannot locate the shared Overview renderer.');
const overview=`function overview(){const d=current.projectData;return \`<div class="hero"><div class="hero-top"><div><h2>\${esc(current.job.JOB_TITLE)}</h2><p>\${esc(current.job.EXACT_USER_OBJECTIVE_VERBATIM||'Define this project in Project.')}</p></div><span class="status \${statusClass(current.job.CURRENT_STATE)}">\${esc(current.job.CURRENT_STATE)}</span></div><div class="facts"><div class="fact"><strong>\${completion()}/30</strong><span>Stages complete</span></div><div class="fact"><strong>\${esc(current.job.CURRENT_STAGE)}</strong><span>Current stage</span></div><div class="fact"><strong>\${d.generatedPrompts.length}</strong><span>Saved instructions</span></div><div class="fact"><strong>\${d.generatedOutputs.length}</strong><span>Saved outputs</span></div></div></div><div class="panel"><h2 class="section-title">Next action</h2><div class="notice \${statusClass(current.job.CURRENT_STATE)}">\${esc(current.job.NEXT_REQUIRED_ACTION||'Open the current stage.')}</div></div><div class="panel"><h2 class="section-title">Project contents</h2><div class="grid-3"><div class="fact"><strong>\${d.requirements.length}</strong><span>Requirements</span></div><div class="fact"><strong>\${d.tests.length}</strong><span>Tests</span></div><div class="fact"><strong>\${d.runs.length}</strong><span>Runs</span></div></div></div><div class="panel"><h2 class="section-title">30-stage workflow</h2><div class="workflow-list">\${core.STAGES.map(s=>{const st=current.stages[s.number];return \`<div class="stage-card\${s.number===current.activeStage?' current':''}"><div class="stage-head"><div class="stage-number">\${String(s.number).padStart(2,'0')}</div><div><div class="stage-name">\${esc(s.title)}</div><div class="stage-meta">\${esc(st.status)}</div></div><button class="compact-button" data-stage="\${s.number}" aria-label="Open Stage \${String(s.number).padStart(2,'0')}">Open</button></div></div>\`;}).join('')}</div></div>\`;}
`;
const next=app.slice(0,start)+overview+app.slice(end);
if(next!==app)fs.writeFileSync(appPath,next);

console.log('Retained project verified; 30-stage tracker uses compact explicit Open actions.');

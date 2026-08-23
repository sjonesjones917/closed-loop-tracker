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

function replaceFunction(source,name,replacement,nextMarker){
  const start=source.indexOf(`function ${name}(`);
  const end=start<0?-1:source.indexOf(nextMarker,start);
  if(start<0||end<0)throw new Error(`Cannot locate ${name}.`);
  return source.slice(0,start)+replacement+'\n'+source.slice(end);
}

const overview=`function overview(){const d=current.projectData;return \`<div class="hero"><div class="hero-top"><div><h2>\${esc(current.job.JOB_TITLE)}</h2><p>\${esc(current.job.EXACT_USER_OBJECTIVE_VERBATIM||'Define this project in Project.')}</p></div><span class="status \${statusClass(current.job.CURRENT_STATE)}">\${esc(current.job.CURRENT_STATE)}</span></div><div class="facts"><div class="fact"><strong>\${completion()}/30</strong><span>Stages complete</span></div><div class="fact"><strong>\${esc(current.job.CURRENT_STAGE)}</strong><span>Current stage</span></div><div class="fact"><strong>\${d.generatedPrompts.length}</strong><span>Saved instructions</span></div><div class="fact"><strong>\${d.generatedOutputs.length}</strong><span>Saved outputs</span></div></div></div><div class="panel"><h2 class="section-title">Next action</h2><div class="notice \${statusClass(current.job.CURRENT_STATE)}">\${esc(current.job.NEXT_REQUIRED_ACTION||'Open the current stage.')}</div></div><div class="panel"><h2 class="section-title">Project contents</h2><div class="grid-3"><div class="fact"><strong>\${d.requirements.length}</strong><span>Requirements</span></div><div class="fact"><strong>\${d.tests.length}</strong><span>Tests</span></div><div class="fact"><strong>\${d.runs.length}</strong><span>Runs</span></div></div></div><div class="panel"><h2 class="section-title">30-stage workflow</h2><div class="workflow-list">\${core.STAGES.map(s=>{const st=current.stages[s.number];return \`<div class="stage-card\${s.number===current.activeStage?' current':''}"><div class="stage-head"><div class="stage-number">\${String(s.number).padStart(2,'0')}</div><div><div class="stage-name">\${esc(s.title)}</div><div class="stage-meta">\${esc(st.status)}</div></div><button class="compact-button" data-stage="\${s.number}" aria-label="Open Stage \${String(s.number).padStart(2,'0')}">Open</button></div></div>\`;}).join('')}</div></div>\`;}`;
app=replaceFunction(app,'overview',overview,'const jobFields=');

const saveJob=`async function saveJob(){const before=await controlledJobHash(current.job),previousState=current.job.CURRENT_STATE,previousStage=current.job.CURRENT_STAGE;document.querySelectorAll('[data-job]').forEach(x=>current.job[x.dataset.job]=x.value);const after=await controlledJobHash(current.job);current.projectData.userEntered={...current.projectData.userEntered,objective:current.job.EXACT_USER_OBJECTIVE_VERBATIM,deliverable:current.job.EXACT_DELIVERABLE_REQUESTED,requiredOutputFormat:current.job.REQUIRED_OUTPUT_FORMAT,deadlineOrTemporalScope:current.job.DEADLINE_OR_TEMPORAL_SCOPE,knownAuthorities:current.job.KNOWN_AUTHORITATIVE_SOURCES,availableTools:current.job.AVAILABLE_TOOLS,prohibitedActions:current.job.PROHIBITED_ACTIONS,explicitRequirements:String(current.job.EXPLICIT_USER_REQUIREMENTS||'').split(/\\r?\\n/).filter(Boolean)};if(before!==after){if(current.stages[1].status==='COMPLETE'){const id=\`JOB-CHANGE-\${Date.now()}\`;current.jobRevisions.push({id,createdAt:new Date().toISOString(),beforeSha256:before,afterSha256:after});core.invalidateDownstream(current,1,id);current.stages[1].status='NOT READY';current.stages[1].decision='';current.stages[1].decisionEvidence='';current.job.CURRENT_STAGE='STAGE 01';current.activeStage=1;current.job.CURRENT_STATE='NOT READY';current.job.NEXT_REQUIRED_ACTION='Reconfirm Stage 01 after the project input changed.';}else current.job.CURRENT_STATE=current.job.EXACT_USER_OBJECTIVE_VERBATIM.trim()?(previousState==='BLOCKED'?'BLOCKED':'IN PROGRESS'):'NOT STARTED';}else{current.job.CURRENT_STATE=previousState;current.job.CURRENT_STAGE=previousStage;}save();render();}`;
app=replaceFunction(app,'saveJob',saveJob,'function syncStageRecordFromForm');

const addNew=`function createUniqueJobId(){const base=new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,17);let suffix=0,id;do{id=\`JOB-\${base}\${suffix?\`-\${String(suffix).padStart(2,'0')}\`:''}\`;suffix++;}while(projects.some(p=>p.job?.JOB_ID===id));return id;}\nasync function addNew(){const p=ensureState(core.createBlankState(createUniqueJobId()));p.activeView='Project';const now=new Date().toISOString();p.job.DATE_OPENED=now;const fields={NEW_JOB_ID:p.job.JOB_ID,NEW_JOB_TITLE:p.job.JOB_TITLE,JOB_OWNER:'UNKNOWN',DATE_OPENED:now,MASTER_TEMPLATE_VERSION:'CURRENT 30-STAGE WORKFLOW',MASTER_TEMPLATE_SHA256:'NOT CALCULATED',NEW_WORKBOOK_FILENAME:'NOT APPLICABLE',NEW_WORKBOOK_VERSION:'v001',NEW_FOLDER_ROOT:'BROWSER PROJECT STORAGE',SUPPLIED_INPUT_FILES:'NONE',SUPPLIED_INPUT_HASHES:'NONE',EXACT_USER_REQUEST_CAPTURED_IN_STAGE_01:'FALSE',OLD_JOB_MATERIAL_REUSED:'FALSE',AUTHORIZED_REUSED_ARTIFACTS:'NONE',OLD_BASELINE_STATUS_CARRIED_FORWARD:'FALSE',OLD_RELEASE_DECISION_CARRIED_FORWARD:'FALSE',OLD_REQUIREMENT_OR_TEST_CARRIED_FORWARD_WITHOUT_REVALIDATION:'FALSE',NEW_JOB_START_STAGE:'STAGE 01',RESET_COMPLETED_BY:'APPLICATION',RESET_DATE_AND_TIME:now,RESET_EVIDENCE:'A clean 30-stage project was created without prior job state.'};const text=core.APPENDICES.E.fields.map(k=>\`\${k}: \${fields[k]??'UNKNOWN'}\`).join('\\n'),record={id:p.job.JOB_ID,createdAt:now,fields,text,sha256:await core.sha256Text(text)};p.appendices.E.records.push(record);p.projectData.newJobResets.push(record);projects.unshift(p);current=p;save();render();}`;
app=replaceFunction(app,'addNew',addNew,'function readStored');

fs.writeFileSync(appPath,app);

const htmlPath='index.html';
let html=fs.readFileSync(htmlPath,'utf8');
const icon=`<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23161616'/%3E%3Cpath d='M8 16h16M16 8v16' stroke='white' stroke-width='3'/%3E%3C/svg%3E">`;
if(!/<link\s+rel=["']icon["']/i.test(html)){
  const marker='<title>Closed-Loop Reliability</title>';
  if(!html.includes(marker))throw new Error('Cannot locate application title for favicon insertion.');
  html=html.replace(marker,`${marker}\n${icon}`);
  fs.writeFileSync(htmlPath,html);
}

console.log('Retained project verified; compact 30-stage tracker, stable project state, unique job creation, and inline application icon are materialized.');

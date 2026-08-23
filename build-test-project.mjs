import fs from 'node:fs';

const projectPath='TEST_PROJECT.json';
const appPath='app.js';
const workbookPath='workbook.js';
const indexPath='index.html';
for(const path of [projectPath,appPath,workbookPath,indexPath])if(!fs.existsSync(path))throw new Error(`Missing ${path}`);

const project=JSON.parse(fs.readFileSync(projectPath,'utf8'));
if(project.schema!=='human-project/30')throw new Error(`Unexpected project schema ${project.schema}`);
if(project.jobId!=='JOB-20260823144121'||project.title!=='Mobile Closed-Loop Agent Reliability Workbook')throw new Error('Retained project identity is wrong.');
if(project.currentStage!==2||project.currentState!=='READY'||project.stageRecords?.['1']?.status!=='COMPLETE')throw new Error('Retained project state is wrong.');
for(let n=2;n<=30;n++){
  const r=project.stageRecords?.[String(n)];
  if(r?.status!=='NOT STARTED'||Object.keys(r||{}).some(k=>k!=='status'))throw new Error(`Stage ${n} must remain status-only and not started.`);
}
if((project.generatedPrompts||[]).length!==1||(project.generatedOutputs||[]).length!==1||(project.outputReceipts||[]).length!==1)throw new Error('Retained project must preserve one Stage 01 instruction, output, and receipt.');
for(const name of ['requirements','tests','runRecords','verificationRecords','comparisons','regressions','evidenceChains'])if((project[name]||[]).length!==0)throw new Error(`${name} contains fabricated downstream data.`);

let app=fs.readFileSync(appPath,'utf8');
const recursive='<div class="record-body">${stageRecordEditor(d,s,locked)}</div>';
const raw='<div class="record-body"><textarea class="code-text stage-record" id="stage-record"${locked?\' disabled\':\'\'}>${esc(s.draftRecord)}</textarea></div>';
if(app.includes(recursive))app=app.replace(recursive,raw);
if(!app.includes('function stageRecordEditor(')||!app.includes('data-stage-field')||!app.includes('id="stage-record"'))throw new Error('Structured stage editor is incomplete.');
if(app.includes(recursive))throw new Error('Recursive stage editor defect remains.');
if(app.includes("1:['B','C','E','F']")||app.includes('TEST-GEN-042'))throw new Error('Unauthorized Stage 01 appendix or fallback remains.');
fs.writeFileSync(appPath,app);

const workbook=fs.readFileSync(workbookPath,'utf8');
for(const token of ['UNIVERSAL OPERATING RULES','Stage 06 requires 100% mandatory test coverage.','Stage 10 requires every frozen component.','Stage 17 requires ten new execution contexts.','Stage 26 requires separate satisfied process and product determinations'])if(!workbook.includes(token))throw new Error(`Workflow control missing: ${token}`);
const html=fs.readFileSync(indexPath,'utf8');
if(!html.includes('closed-loop-30-runtime-5'))throw new Error('Cache identity is wrong.');
const source=app+workbook+html+JSON.stringify(project);
if(/GEN-042|field status report|maintenance[- ]handoff/i.test(source))throw new Error('Unrelated product content remains.');
const banned=new RegExp('se'+'mantic','i');if(banned.test(source))throw new Error('Prohibited interface terminology remains.');
console.log(`validated and materialized existing single app: ${project.jobId}`);

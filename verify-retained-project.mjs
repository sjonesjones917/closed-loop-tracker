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
const project=JSON.parse(fs.readFileSync('RETAINED_TEST_PROJECT.json','utf8'));
const rootFiles=fs.readdirSync('.');
const rootHtml=rootFiles.filter(name=>name.endsWith('.html'));

check(rootHtml.length===1&&rootHtml[0]==='index.html','one application entry remains: index.html');
check(!rootFiles.some(name=>/test.*\.html$/i.test(name)),'the retained test project is data, not another application');
check(project.schema==='mclarw/30','retained test project uses the current 30-stage schema');
check(project.projectKind==='RETAINED_TEST_PROJECT','retained project has an explicit test-project identity');
check(project.nonAuthoritative===true,'retained project is explicitly non-authoritative');
check(project.job?.id==='RETAINED-TEST-PROJECT','retained project has a stable JOB_ID');
check(project.job?.currentState==='IN PROGRESS','retained project does not claim acceptance or release');
check(Array.isArray(project.stages)&&project.stages.length===30,'retained project contains exactly 30 stages');
check(project.stages.every((stage,index)=>stage.number===index+1),'retained project stage numbers are exactly 1 through 30');
check(project.stages.every(stage=>typeof stage.record==='string'&&stage.record.length>0),'every retained-project stage has a usable record');
check(project.stages.every(stage=>stage.decision==='NOT READY - CORRECTION REQUIRED'),'retained project makes no unsupported READY determination');
check(Object.keys(project.appendices||{}).sort().join('')==='ABCDEF','retained project preserves Appendix A-F data stores');
check(Object.keys(project.operationalRecords||{}).sort().join('')==='ABCDEF','retained project preserves Appendix A-F operational record stores');
check(Object.values(project.operationalRecords||{}).every(Array.isArray),'retained project operational record stores are arrays');

check(loader.includes('const PROJECT_STORE="mclarw-projects"'),'existing application has a saved-project registry');
check(loader.includes('const RETAINED_PROJECT_URL="RETAINED_TEST_PROJECT.json"'),'existing application loads the retained test project');
check(loader.includes('function renderProjectSwitcher()'),'existing application renders the Projects control');
check(loader.includes('Retained test project'),'Projects control visibly names the retained test project');
check(loader.includes('function saveCurrentProject(')&&loader.includes('function openSelectedProject('),'existing application can save and switch projects');
check(loader.includes('if(control&&(control.textContent||"").trim()==="New clean job")saveCurrentProject(false)'),'creating a clean job first preserves the active project');
check(loader.includes('localStorage.setItem(STORE,JSON.stringify(project))')&&loader.includes('location.reload()'),'project switching uses the existing workbook state and application');
check(!index.includes('RETAINED-TEST-PROJECT'),'test-project job data is not hard-coded into the application shell');
check((index.match(/<script[^>]+src=/g)||[]).length===1&&index.includes('<script src="workbook.js"></script>'),'project support does not add a second runtime entry');
check(readme.includes('RETAINED_TEST_PROJECT.json')&&readme.includes('Retained test project'),'repository documentation identifies the retained test project');

const chunks=['workbook.module.gz.1','workbook.module.gz.2','workbook.module.gz.3'];
const compressed=Buffer.concat(chunks.map(name=>fs.readFileSync(name)));
const source=zlib.gunzipSync(compressed).toString('utf8');
const temp=path.join(process.cwd(),'.verify-retained-runtime.mjs');
fs.writeFileSync(temp,source);
let runtime;
try{runtime=await import(pathToFileURL(temp).href+'?t='+Date.now())}finally{fs.rmSync(temp,{force:true})}
const blank=runtime.createBlankState();
check(blank.schema==='mclarw/30'&&blank.stages.length===30,'new clean job uses the same current schema');
check(blank.stages.every(stage=>stage.status==='NOT STARTED'),'new clean job remains empty rather than inheriting the retained project');
check(blank.job.currentStage===1&&blank.job.currentState==='NOT STARTED','new clean job starts at Stage 01 and NOT STARTED');
check(blank.job.id===''&&blank.job.title==='','new clean job does not inherit the retained test project identity');

if(failures.length){
  console.error(JSON.stringify({determination:'VIOLATED',failures,evidenceCount:evidence.length},null,2));
  process.exit(1);
}
console.log(JSON.stringify({determination:'SATISFIED',application:'index.html',applicationEntries:1,retainedTestProject:'RETAINED_TEST_PROJECT.json',testProjectStages:project.stages.length,newJobStages:blank.stages.length,evidenceCount:evidence.length},null,2));

import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const candidates=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean);
const executablePath=candidates.find(path=>fs.existsSync(path));
if(!executablePath)throw new Error(`No Chromium executable found. Checked: ${candidates.join(', ')}`);
const selfProject=JSON.parse(fs.readFileSync('SELF_VERIFIED_PROJECT.json','utf8'));
const port=4173;const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
await new Promise(resolve=>setTimeout(resolve,700));
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
const errors=[];const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:1});
page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
try{
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'});
  if((await page.title())!=='Closed-Loop Agent Reliability')throw new Error('Wrong browser title.');
  if((await page.locator('h1').innerText())!=='Closed-Loop Agent Reliability')throw new Error('Wrong browser heading.');
  await page.waitForFunction(({name,id})=>{const text=document.querySelector('#projectsView')?.innerText||'';return text.includes(name)||text.includes(id);},{name:selfProject.name,id:selfProject.projectId},{timeout:5000});
  const projectsText=await page.locator('#projectsView').innerText();
  if(!projectsText.includes(selfProject.name)&&!projectsText.includes(selfProject.projectId))throw new Error('Retained self-project is not visible as an application project.');
  if(errors.length)throw new Error(`Self-project load errors: ${errors.join(' | ')}`);

  await page.click('#newProjectBtn');
  await page.fill('#newName','Arbitrary engineering job');
  await page.fill('#newObjective','Determine and deliver a verified engineering result from user intent and independent external authority.');
  await page.fill('#newDeliverables','A completed, verified, accepted, and releasable result.');
  await page.selectOption('#newOwnerType','HUMAN');
  await page.fill('#newOwnerName','Human project owner');
  await page.click('#newProjectForm button[type="submit"]');

  const scopeFields=page.locator('[data-job-field]');
  if((await scopeFields.count())!==20)throw new Error('Stage 1 does not render all 20 scopes.');
  await scopeFields.evaluateAll(elements=>elements.forEach((element,index)=>{if(!element.value)element.value=`Explicit scope value ${index+1}; NONE where not applicable.`;}));
  await page.click('[data-complete-stage="1"]');await page.waitForTimeout(100);await page.click('.topNav [data-view="workflow"]');
  if((await page.locator('.stagePanel h2').innerText())!=='INVENTORY SOURCES')throw new Error('Stage 1 did not advance to Stage 2.');
  if((await page.locator('.stageButton').count())!==31)throw new Error('Workflow does not render exactly 31 stages.');
  await page.click('.stagePanel [data-add-record="externalSources"]');
  if((await page.locator('#recordDialogTitle').innerText())!=='Add external source')throw new Error('External source editor did not open.');
  if((await page.locator('#rf-externallyAccessed').count())!==1||(await page.locator('#rf-independentOfArtifact').count())!==1)throw new Error('External source non-circularity controls are missing.');
  await page.click('[data-close-dialog="recordDialog"]');await page.click('[data-view="records"]');
  const recordsText=await page.locator('#recordsView').innerText();for(const label of ['USER JOB INPUT','EXTERNAL RESEARCH SOURCE','WORKFLOW-GENERATED ARTIFACT'])if(!recordsText.includes(label))throw new Error(`Information-class UI is missing ${label}.`);
  await page.screenshot({path:'PHONE_SMOKE_393.png',fullPage:true});await page.setViewportSize({width:320,height:720});await page.click('[data-view="workflow"]');await page.screenshot({path:'PHONE_SMOKE_320.png',fullPage:false});
  if(errors.length)throw new Error(`Browser errors: ${errors.join(' | ')}`);
  const report={status:'PASS',title:await page.title(),retainedSelfProjectVisible:true,retainedSelfProjectName:selfProject.name,stagesRendered:await page.locator('.stageButton').count(),stage1ScopesRendered:await scopeFields.count(),humanOwnerCreated:true,externalSourceGuardRendered:true,informationClassesRendered:3,phoneWidthsTested:[393,320],browserErrors:errors};
  fs.writeFileSync('BROWSER_SMOKE_REPORT.json',`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));
}finally{await browser.close();server.kill('SIGTERM');}

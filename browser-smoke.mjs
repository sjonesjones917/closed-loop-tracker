import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const candidates=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean);
const executablePath=candidates.find(path=>fs.existsSync(path));
if(!executablePath)throw new Error(`No Chromium executable found. Checked: ${candidates.join(', ')}`);
const selfProject=JSON.parse(fs.readFileSync('SELF_VERIFIED_PROJECT.json','utf8'));
const port=4173;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
await new Promise(resolve=>setTimeout(resolve,700));
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
const errors=[];
const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:1});
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error'&&!/Failed to load resource: the server responded with a status of 404/i.test(message.text()))errors.push(message.text())});
try{
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'});
  if((await page.title())!=='Closed-Loop Agent Reliability')throw new Error('Wrong browser title.');
  if((await page.locator('h1').innerText())!=='Closed-Loop Agent Reliability')throw new Error('Wrong browser heading.');

  await page.waitForFunction(({name,id})=>{const raw=localStorage.getItem('closedLoopReliability.projects')||'[]';try{return JSON.parse(raw).some(project=>project.projectId===id&&project.name===name)}catch{return false}},{name:selfProject.name,id:selfProject.projectId},{timeout:8000});
  const loadedSelf=await page.evaluate(id=>{const list=JSON.parse(localStorage.getItem('closedLoopReliability.projects')||'[]');return list.find(project=>project.projectId===id)||null},selfProject.projectId);
  if(!loadedSelf)throw new Error('Completed application project is not loaded as a native application project.');
  if(loadedSelf.schema!=='closed-loop-project/1')throw new Error('Completed application project is not using the current application schema.');
  if(!Array.isArray(loadedSelf.stages)||loadedSelf.stages.length!==31||loadedSelf.stages.some((stage,index)=>stage.number!==index+1||stage.status!=='COMPLETE'))throw new Error('Completed application project does not preserve all 31 completed stages.');
  if(!loadedSelf.stages.some(stage=>stage.assignedActorType==='HUMAN_AGENT_TEAM'||stage.assignedActorType==='HUMAN'))throw new Error('Completed application project excludes human work ownership.');
  if(!/Closed-Loop Agent Reliability application/i.test(`${loadedSelf.name} ${loadedSelf.job?.exactUserObjective||''}`))throw new Error('Completed application project is not about the application itself.');
  const retainedNarrative=JSON.stringify({name:loadedSelf.name,job:loadedSelf.job,stages:loadedSelf.stages,workflowArtifacts:loadedSelf.workflowArtifacts,executions:loadedSelf.executions,verificationRecords:loadedSelf.verificationRecords,comparisons:loadedSelf.comparisons,defects:loadedSelf.defects,regressionTests:loadedSelf.regressionTests,corrections:loadedSelf.corrections,convergenceCycles:loadedSelf.convergenceCycles,baselines:loadedSelf.baselines,products:loadedSelf.products,processAudits:loadedSelf.processAudits,productAudits:loadedSelf.productAudits,decisions:loadedSelf.decisions,releases:loadedSelf.releases});
  if(/\bv13\b|version 13|sidecar-filename defect|implementation-history defect|first-candidate sidecar|repair-task tracker|fix stage/i.test(retainedNarrative))throw new Error('Completed application project still contains repair/version scope drift.');

  await page.click('.topNav [data-view="projects"]');
  const retainedCard=page.locator('[data-retained-application-project="true"]');
  await retainedCard.waitFor({state:'visible',timeout:8000});
  const projectsText=await page.locator('#projectsView').innerText();
  if(!projectsText.includes(selfProject.name)&&!projectsText.includes(selfProject.projectId))throw new Error('Completed application project is not visible in the Projects view.');
  if(!/31\/31 stages complete/i.test(await page.locator('#retainedProjectStatus').innerText()))throw new Error('Completed application project status does not show all 31 stages.');
  const destructive=retainedCard.locator('button,a,[role="button"]').filter({hasText:/delete|remove/i});
  for(let index=0;index<await destructive.count();index+=1){const control=destructive.nth(index);if(await control.isVisible()&&await control.isEnabled())throw new Error('Completed application project can be deleted from the application UI.');}

  await page.click('#showRetainedProjectBtn');
  await page.waitForFunction(()=>{const view=document.querySelector('#workflowView');return Boolean(view&&!view.classList.contains('hidden'))},{timeout:5000});
  const retainedWorkflowText=await page.locator('#workflowView').innerText();
  if(!retainedWorkflowText.includes(selfProject.name))throw new Error('Open completed project did not select the retained application project.');
  if((await page.locator('.stageButton').count())!==31)throw new Error('Completed application project does not render the exact 31-stage workflow.');
  const pageText=await page.locator('body').innerText();
  if(/Agent response|paste agent response|copy prompt|exact stage prompt/i.test(pageText))throw new Error('Prompt-relay UI text is visible in the human-first application.');
  if(errors.length)throw new Error(`Completed application project load errors: ${errors.join(' | ')}`);

  await page.click('.topNav [data-view="projects"]');
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
  await page.click('[data-complete-stage="1"]');
  await page.waitForTimeout(100);
  await page.click('.topNav [data-view="workflow"]');
  if((await page.locator('.stagePanel h2').innerText())!=='INVENTORY SOURCES')throw new Error('Stage 1 did not advance to Stage 2.');
  if((await page.locator('.stageButton').count())!==31)throw new Error('Workflow does not render exactly 31 stages.');
  await page.click('.stagePanel [data-add-record="externalSources"]');
  if((await page.locator('#recordDialogTitle').innerText())!=='Add external source')throw new Error('External source editor did not open.');
  if((await page.locator('#rf-externallyAccessed').count())!==1||(await page.locator('#rf-independentOfArtifact').count())!==1)throw new Error('External source non-circularity controls are missing.');
  await page.click('[data-close-dialog="recordDialog"]');
  await page.click('[data-view="records"]');
  const recordsText=await page.locator('#recordsView').innerText();
  for(const label of ['USER JOB INPUT','EXTERNAL RESEARCH SOURCE','WORKFLOW-GENERATED ARTIFACT'])if(!recordsText.includes(label))throw new Error(`Information-class UI is missing ${label}.`);

  await page.screenshot({path:'PHONE_SMOKE_393.png',fullPage:true});
  await page.setViewportSize({width:320,height:720});
  await page.click('[data-view="projects"]');
  if(!(await page.locator('[data-retained-application-project="true"]').isVisible()))throw new Error('Completed application project is not visible at 320px phone width.');
  await page.click('[data-view="workflow"]');
  await page.screenshot({path:'PHONE_SMOKE_320.png',fullPage:false});
  if(errors.length)throw new Error(`Browser errors: ${errors.join(' | ')}`);

  const report={status:'PASS',title:await page.title(),retainedApplicationProjectVisible:true,retainedApplicationProjectNative:true,retainedApplicationProjectProtected:true,retainedApplicationProjectName:selfProject.name,retainedApplicationProjectStagesComplete:31,retainedApplicationProjectOpened:true,stagesRendered:await page.locator('.stageButton').count(),stage1ScopesRendered:await scopeFields.count(),humanOwnerCreated:true,externalSourceGuardRendered:true,informationClassesRendered:3,promptRelayArchitecture:false,phoneWidthsTested:[393,320],browserErrors:errors};
  fs.writeFileSync('BROWSER_SMOKE_REPORT.json',`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}finally{
  await browser.close();
  server.kill('SIGTERM');
}

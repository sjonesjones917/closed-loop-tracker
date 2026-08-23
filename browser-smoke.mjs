import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';

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

  await page.waitForFunction(({name,id})=>{try{return JSON.parse(localStorage.getItem('closedLoopReliability.projects')||'[]').some(project=>project.projectId===id&&project.name===name)}catch{return false}},{name:selfProject.name,id:selfProject.projectId},{timeout:5000});
  const loadedSelf=await page.evaluate(id=>JSON.parse(localStorage.getItem('closedLoopReliability.projects')||'[]').find(project=>project.projectId===id)||null,selfProject.projectId);
  if(!loadedSelf)throw new Error('Retained application project is not loaded as a native project.');
  if(loadedSelf.schema!=='closed-loop-project/1')throw new Error('Retained application project is not using the current schema.');
  if(!Array.isArray(loadedSelf.stages)||loadedSelf.stages.length!==31||loadedSelf.stages.some((stage,index)=>stage.number!==index+1||stage.status!=='COMPLETE'))throw new Error('Retained application project does not preserve all 31 completed stages.');
  if(loadedSelf.stages.some(stage=>!String(stage.executionPrompt||'').trim()||!/^[a-f0-9]{64}$/i.test(String(stage.executionPromptSourceHash||''))))throw new Error('Retained application project does not preserve all 31 copy-ready stage prompts and prompt-source hashes.');
  for(const [stageNumber,required] of [[2,['Perform actual outward external source discovery','never use the artifact, source code, tests, project JSON, prior agent output, or workflow records as authority']],[8,['This stage execution prompt is not the production instruction itself']],[11,['RUN_ID: <<RUN-001 through RUN-010>>','do not create ten different prompts']],[20,['MODE: <<PRODUCER or VERIFIER>>','RUN_ID: <<RUN-001 through RUN-010>>']]])for(const text of required)if(!String(loadedSelf.stages[stageNumber-1].executionPrompt||'').includes(text))throw new Error(`Retained Stage ${stageNumber} prompt is missing: ${text}`);
  if(!Array.isArray(loadedSelf.productionInstructions)||!loadedSelf.productionInstructions.some(record=>Number(record.stageNumber)===8&&String(record.promptText||'').includes('PRODUCTION INSTRUCTION'))||!loadedSelf.productionInstructions.some(record=>Number(record.stageNumber)===9&&String(record.promptText||'').includes('PREFLIGHTED PRODUCTION INSTRUCTION')))throw new Error('Retained application project does not preserve the Stage 8 production instruction and Stage 9 preflighted instruction as separate outputs.');
  if(!/Closed-Loop Agent Reliability application/i.test(`${loadedSelf.name} ${loadedSelf.job?.exactUserObjective||''}`))throw new Error('Retained project is not about the application itself.');
  if(/\bv13\b|version 13|sidecar-filename defect|repair-task tracker|fix stage/i.test(JSON.stringify(loadedSelf.job||{})))throw new Error('Retained project still contains repair or version framing in its job definition.');

  await page.click('.topNav [data-view="projects"]');
  const projectsText=await page.locator('#projectsView').innerText();
  if(!projectsText.includes(selfProject.name)&&!projectsText.includes(selfProject.projectId))throw new Error('Retained application project is not visible in Projects.');

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
  if((await page.locator('[data-stage-prompt-system="true"]').count())!==1)throw new Error('Stage execution prompt panel is not rendered.');

  await page.selectOption('[data-stage-meta="assignedActorType"][data-stage="2"]','HUMAN_AGENT_TEAM');
  await page.fill('[data-stage-meta="assignedActorName"][data-stage="2"]','Source research team');
  await page.click('[data-start-stage="2"]');
  await page.waitForTimeout(150);
  const stage2Prompt=await page.locator('[data-stage-prompt-text="2"]').inputValue();
  for(const required of ['STAGE 2 OF 31 — INVENTORY SOURCES','source-authority analyst','Perform actual outward external source discovery','never use the artifact, source code, tests, project JSON, prior agent output, or workflow records as authority','externalSources (External research sources)','researchCoverage (Research-question coverage)'])if(!stage2Prompt.includes(required))throw new Error(`Stage 2 prompt is missing: ${required}`);
  if(!await page.locator('[data-copy-stage-prompt][data-stage="2"]').isEnabled())throw new Error('Stage 2 copy-ready prompt control is disabled after generation.');

  await page.click('[data-select-stage="11"]');
  await page.click('[data-generate-stage-prompt][data-stage="11"]');
  await page.waitForTimeout(150);
  const stage11Prompt=await page.locator('[data-stage-prompt-text="11"]').inputValue();
  for(const required of ['STAGE 11 OF 31 — RUN 10 INDEPENDENT EXECUTIONS','RUN_ID: <<RUN-001 through RUN-010>>','Use this exact same prompt for each run','do not create ten different prompts'])if(!stage11Prompt.includes(required))throw new Error(`Stage 11 reusable prompt is missing: ${required}`);
  if((stage11Prompt.match(/RUN_ID: <<RUN-001 through RUN-010>>/g)||[]).length!==1)throw new Error('Stage 11 generated multiple run prompts instead of one reusable template.');

  await page.click('[data-select-stage="20"]');
  await page.click('[data-generate-stage-prompt][data-stage="20"]');
  await page.waitForTimeout(150);
  const stage20Prompt=await page.locator('[data-stage-prompt-text="20"]').inputValue();
  for(const required of ['MODE: <<PRODUCER or VERIFIER>>','RUN_ID: <<RUN-001 through RUN-010>>','ten separate fresh verifiers'])if(!stage20Prompt.includes(required))throw new Error(`Stage 20 reusable confirmation prompt is missing: ${required}`);

  for(let stageNumber=1;stageNumber<=31;stageNumber+=1){
    await page.click(`[data-select-stage="${stageNumber}"]`);
    if((await page.locator('[data-stage-prompt-system="true"]').count())!==1)throw new Error(`Stage ${stageNumber} lacks its stage-specific prompt panel.`);
    if((await page.locator(`[data-generate-stage-prompt][data-stage="${stageNumber}"]`).count())!==1)throw new Error(`Stage ${stageNumber} lacks its prompt generator.`);
  }

  await page.click('[data-select-stage="2"]');
  await page.click('.stagePanel [data-add-record="externalSources"]');
  if((await page.locator('#recordDialogTitle').innerText())!=='Add external source')throw new Error('External source editor did not open.');
  if((await page.locator('#rf-externallyAccessed').count())!==1||(await page.locator('#rf-independentOfArtifact').count())!==1)throw new Error('External source non-circularity controls are missing.');
  await page.click('[data-close-dialog="recordDialog"]');
  await page.click('[data-view="records"]');
  const recordsText=await page.locator('#recordsView').innerText();
  for(const label of ['USER JOB INPUT','EXTERNAL RESEARCH SOURCE','WORKFLOW-GENERATED ARTIFACT'])if(!recordsText.includes(label))throw new Error(`Information-class UI is missing ${label}.`);

  await page.screenshot({path:'PHONE_SMOKE_393.png',fullPage:true});
  await page.setViewportSize({width:320,height:720});
  await page.click('[data-view="workflow"]');
  await page.screenshot({path:'PHONE_SMOKE_320.png',fullPage:false});
  if(errors.length)throw new Error(`Browser errors: ${errors.join(' | ')}`);

  const report={status:'PASS',title:await page.title(),retainedSelfProjectVisible:true,retainedSelfProjectNative:true,retainedSelfProjectName:selfProject.name,retainedSelfProjectStagesComplete:31,retainedSelfProjectStagePrompts:31,retainedProductionInstructionOutputs:2,stagesRendered:await page.locator('.stageButton').count(),stagePromptPanelsVerified:31,stage2ExternalResearchPrompt:true,stage11SingleReusablePrompt:true,stage20ProducerVerifierTemplate:true,stage1ScopesRendered:await scopeFields.count(),humanOwnerCreated:true,humanAgentTeamPromptRequired:true,externalSourceGuardRendered:true,informationClassesRendered:3,phoneWidthsTested:[393,320],browserErrors:errors};
  fs.writeFileSync('BROWSER_SMOKE_REPORT.json',`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}finally{
  await browser.close();
  server.kill('SIGTERM');
}

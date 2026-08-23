import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';

const candidates=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean);
const executablePath=candidates.find(path=>fs.existsSync(path));
if(!executablePath)throw new Error(`No Chromium executable found. Checked: ${candidates.join(', ')}`);
const port=4174;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
await new Promise(resolve=>setTimeout(resolve,700));
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:393,height:852}});
const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error'&&!/404/i.test(message.text()))errors.push(message.text())});
try{
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>{try{return JSON.parse(localStorage.getItem('closedLoopReliability.projects')||'[]').some(p=>Array.isArray(p.requirements)&&p.requirements.length&&Array.isArray(p.acceptanceTests)&&p.acceptanceTests.length)}catch{return false}},{timeout:5000});
  await page.evaluate(()=>{
    const STORE='closedLoopReliability.projects',SELECTED='closedLoopReliability.selectedProject';
    const projects=JSON.parse(localStorage.getItem(STORE)||'[]');
    const base=projects.find(p=>Array.isArray(p.requirements)&&p.requirements.length&&Array.isArray(p.acceptanceTests)&&p.acceptanceTests.length&&Array.isArray(p.mutationTests)&&p.mutationTests.length);
    if(!base)throw new Error('No retained project with requirements and tests is available for prompt-generation smoke testing.');
    const test=structuredClone(base);
    test.projectId='PROJECT-PROMPT-GENERATION-SMOKE';
    test.name='Prompt generation smoke project';
    test.productionInstructions=[];
    test.preflightReviews=[];
    test.stages=test.stages.map((stage,index)=>({...stage,status:index<7?'COMPLETE':'NOT_STARTED',completionEvidence:index<7?(stage.completionEvidence||`Completed prerequisite stage ${index+1}.`):'',blocker:'',completedAt:index<7?(stage.completedAt||new Date().toISOString()):null}));
    test.selectedStage=8;
    const filtered=projects.filter(p=>p.projectId!==test.projectId);
    filtered.push(test);
    localStorage.setItem(STORE,JSON.stringify(filtered));
    localStorage.setItem(SELECTED,test.projectId);
  });
  await page.reload({waitUntil:'networkidle'});
  await page.click('[data-view="workflow"]');
  if((await page.locator('.stagePanel h2').innerText())!=='AUTHOR PRODUCTION INSTRUCTION')throw new Error('Stage 8 is not selected.');
  if((await page.locator('[data-generate-production-instruction]').count())!==1)throw new Error('Stage 8 production prompt generator is missing.');
  await page.click('[data-generate-production-instruction]');
  const stage8=await page.evaluate(()=>{
    const projects=JSON.parse(localStorage.getItem('closedLoopReliability.projects')||'[]');
    const project=projects.find(p=>p.projectId==='PROJECT-PROMPT-GENERATION-SMOKE');
    return project?.productionInstructions?.filter(r=>Number(r.stageNumber)===8).slice(-1)[0]||null;
  });
  if(!stage8)throw new Error('Stage 8 did not persist a production instruction record.');
  for(const required of ['INSTRUCTION-v','PRODUCTION INSTRUCTION','OBJECTIVE','INDEPENDENT EXTERNAL AUTHORITY','MANDATORY ATOMIC REQUIREMENTS','ACCEPTANCE TESTS','FAILURE / MUTATION TESTS','TRUTH SEMANTICS','COMPLETION CRITERIA']){
    const hay=`${stage8.instructionId||''}\n${stage8.promptText||''}`;
    if(!hay.includes(required))throw new Error(`Stage 8 generated prompt is missing ${required}.`);
  }
  if(!String(stage8.promptText||'').includes('REQ-'))throw new Error('Stage 8 generated prompt does not contain requirement traceability.');
  if(!String(stage8.promptText||'').includes('TEST-'))throw new Error('Stage 8 generated prompt does not contain acceptance-test traceability.');

  await page.evaluate(()=>{
    const STORE='closedLoopReliability.projects';
    const projects=JSON.parse(localStorage.getItem(STORE)||'[]');
    const project=projects.find(p=>p.projectId==='PROJECT-PROMPT-GENERATION-SMOKE');
    project.stages[7].status='COMPLETE';
    project.stages[7].completionEvidence='Stage 8 generated production prompt verified for smoke test.';
    project.stages[7].completedAt=new Date().toISOString();
    project.selectedStage=9;
    localStorage.setItem(STORE,JSON.stringify(projects));
  });
  await page.reload({waitUntil:'networkidle'});
  await page.click('[data-view="workflow"]');
  if((await page.locator('.stagePanel h2').innerText())!=='PREFLIGHT INSTRUCTION')throw new Error('Stage 9 is not selected.');
  if((await page.locator('[data-generate-preflighted-instruction]').count())!==1)throw new Error('Stage 9 preflighted prompt generator is missing.');
  await page.click('[data-generate-preflighted-instruction]');
  const stage9=await page.evaluate(()=>{
    const projects=JSON.parse(localStorage.getItem('closedLoopReliability.projects')||'[]');
    const project=projects.find(p=>p.projectId==='PROJECT-PROMPT-GENERATION-SMOKE');
    return {instruction:project?.productionInstructions?.filter(r=>Number(r.stageNumber)===9).slice(-1)[0]||null,review:project?.preflightReviews?.filter(r=>Number(r.stageNumber)===9).slice(-1)[0]||null};
  });
  if(!stage9.instruction||!String(stage9.instruction.promptText||'').startsWith('PREFLIGHTED PRODUCTION INSTRUCTION'))throw new Error('Stage 9 did not persist a preflighted production prompt.');
  if(!stage9.review||!['RESOLVED','NONE_FOUND'].includes(stage9.review.status))throw new Error('Stage 9 did not persist resolved preflight evidence.');
  if(stage9.instruction.instructionId===stage8.instructionId)throw new Error('Stage 9 reused the Stage 8 instruction identity instead of generating a new version.');
  if(errors.length)throw new Error(`Browser errors: ${errors.join(' | ')}`);
  const report={status:'PASS',stage8Generator:true,stage8InstructionId:stage8.instructionId,stage8PromptBytes:new TextEncoder().encode(stage8.promptText).length,stage9Generator:true,stage9InstructionId:stage9.instruction.instructionId,stage9PreflightStatus:stage9.review.status,browserErrors:errors};
  fs.writeFileSync('PROMPT_GENERATION_SMOKE.json',`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}finally{
  await browser.close();
  server.kill('SIGTERM');
}

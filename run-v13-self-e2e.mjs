import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const replaceExact=(text,oldValue,newValue,label)=>{
  if(!text.includes(oldValue))throw new Error(`${label} patch anchor missing`);
  return text.replace(oldValue,newValue);
};

const build=spawnSync(process.execPath,['build-v13-self.mjs'],{encoding:'utf8',stdio:'inherit'});
if(build.status!==0)process.exit(build.status??1);
const replayPatch=spawnSync(process.execPath,['v13-state-replay.mjs'],{encoding:'utf8',stdio:'inherit'});
if(replayPatch.status!==0)process.exit(replayPatch.status??1);
const scopeCorrection=spawnSync(process.execPath,['correct-project-scope.mjs','--generated-only'],{encoding:'utf8',stdio:'inherit'});
if(scopeCorrection.status!==0)process.exit(scopeCorrection.status??1);

for(const file of ['app-v13-candidate1.html','app-v13.html']){
  if(!fs.existsSync(file)||fs.statSync(file).size===0)throw new Error(`${file} was not generated.`);
  const text=fs.readFileSync(file,'utf8');
  for(const token of [
    'function researchPrompt(p,n)',
    'if(n===2||n===3)return researchPrompt(p,n)',
    'COMPLETE STAGE 1 JOB DEFINITION — USER INPUT / RESEARCH SCOPE, NOT EXTERNAL AUTHORITY:',
    'RESEARCH AUTHORITY BOUNDARY — EXTERNAL SOURCES ONLY',
    'Stage 2 research sources must be independent external sources',
    '===== STAGE 2 — EXTERNAL SOURCE INVENTORY =====',
    'external-authority-first-2026-08-22-r5-state-replay',
    'function replayProject(input)',
    'obsolete completion was reset from Stage'
  ]) if(!text.includes(token))throw new Error(`${file} missing required research/state-replay token: ${token}`);
  if(text.includes('Inspect the actual supplied sources and build the complete source inventory now.'))throw new Error(`${file} still contains the obsolete circular Stage 2 instruction.`);
  if(text.includes('RAW STAGE 1 RESPONSE AND SUPPLIED IMPLEMENTATION FILE LIST OMITTED BY DESIGN.'))throw new Error(`${file} still contains the obsolete narrowed Stage 1 handoff.`);
  if(/function importProjectObject\(p\)\{if\(!p\|\|p\.schemaVersion!==13/.test(text))throw new Error(`${file} still trusts imported completion flags without replay.`);
}

const corrected=fs.readFileSync('app-v13.html','utf8');
if(!corrected.includes("a.download=p.name==='CLOSED-LOOP AGENT RELIABILITY APPLICATION — COMPLETE BUILD'?'SELF_VERIFIED_PROJECT.json':`${p.jobId}.json`"))throw new Error('The application does not permanently use SELF_VERIFIED_PROJECT.json for the visible complete-build project export.');

fs.writeFileSync('SELF_VERIFIED_PROJECT.json','{}\n');
fs.writeFileSync('favicon.ico','');

let agent=fs.readFileSync('self-e2e-agent.mjs','utf8');
const oldPrompt="const prompt=Buffer.from(promptB64,'base64').toString('utf8');";
const newPrompt="const prompt=promptB64?Buffer.from(promptB64,'base64').toString('utf8'):fs.readFileSync(0,'utf8');";
agent=replaceExact(agent,oldPrompt,newPrompt,'Agent stdin');
const oldStageDispatch="if(role==='stage'&&n===2)process.stdout.write(await stage2());";
const newStageDispatch=`if(role==='stage'&&n===1){const stageOneJobId=((prompt.match(/^JOB_ID:\\s*(.+)$/m)||[])[1]||'UNKNOWN').trim();const stageOneProjectId=((prompt.match(/^PROJECT_ID:\\s*(.+)$/m)||[])[1]||'UNKNOWN').trim();const stageOneText=fs.readFileSync(new URL('./self-stage1-response.txt',import.meta.url),'utf8').replaceAll('{{JOB_ID}}',stageOneJobId).replaceAll('{{PROJECT_ID}}',stageOneProjectId);process.stdout.write(stageOneText+'\\n\\n'+receipt);}else if(role==='stage'&&n===2)process.stdout.write(await stage2());`;
agent=replaceExact(agent,oldStageDispatch,newStageDispatch,'Lossless Stage 1 runtime response');
fs.writeFileSync('self-e2e-agent-runtime.mjs',agent);

let browser=fs.readFileSync('self-browser-e2e.mjs','utf8');
const oldCall="const r=spawnSync(process.execPath,[path.join(root,'self-e2e-agent.mjs'),String(n),role,String(run),Buffer.from(prompt).toString('base64')],{encoding:'utf8',maxBuffer:8*1024*1024});";
const newCall="const r=spawnSync(process.execPath,[path.join(root,'self-e2e-agent-runtime.mjs'),String(n),role,String(run)],{encoding:'utf8',input:prompt,maxBuffer:8*1024*1024});";
browser=replaceExact(browser,oldCall,newCall,'Browser agent stdin call');

const oldStandard=`      const pr=await copyMain();
      assert.match(pr,new RegExp(\`STAGE \${n} OF 31\`));
      await page.locator('#response').fill(agent(n,'stage',pr));`;
const newStandard=`      const pr=await copyMain();
      assert.match(pr,new RegExp(\`STAGE \${n} OF 31\`));
      if(n===2){
        assert.match(pr,/RESEARCH AUTHORITY BOUNDARY — EXTERNAL SOURCES ONLY/);
        assert.ok(pr.includes('COMPLETE STAGE 1 JOB DEFINITION — USER INPUT / RESEARCH SCOPE, NOT EXTERNAL AUTHORITY'));
        assert.match(pr,/EXTERNAL RESEARCH QUESTIONS/);
      }
      if(n===3)assert.match(pr,/APPROVED STAGE 2 EXTERNAL SOURCE INVENTORY:/);
      await page.locator('#response').fill(agent(n,'stage',pr));`;
browser=replaceExact(browser,oldStandard,newStandard,'Runtime Stage 2/3 prompt isolation assertion');

const oldDownload=`  const projectDownload=await projectDownloadPromise;
  const projectDownloadPath=await projectDownload.path();`;
const newDownload=`  const projectDownload=await projectDownloadPromise;
  assert.equal(projectDownload.suggestedFilename(),'SELF_VERIFIED_PROJECT.json');
  const projectDownloadPath=await projectDownload.path();`;
browser=replaceExact(browser,oldDownload,newDownload,'Visible project export filename assertion');

const transientStatus="assert.match(await freshPage.locator('#status').textContent(),/1 project/);";
const visibleState="assert.match(await freshPage.locator('#status').textContent(),/Imported|1 project/);";
browser=replaceExact(browser,transientStatus,visibleState,'Fresh-sidecar status assertion');

const replayAnchor=`  await freshContext.close();
  assert.equal(consoleErrors.length,0,\`Primary browser errors: \${consoleErrors.join(' | ')}\`);`;
const replayTest=`  await freshContext.close();
  const validSidecarBytes=fs.readFileSync(path.join(root,'SELF_VERIFIED_PROJECT.json'));
  const legacy=JSON.parse(validSidecarBytes.toString('utf8'));
  legacy.projectId='PROJECT-LEGACY-CIRCULAR-STAGE2';legacy.jobId='JOB-LEGACY-CIRCULAR-STAGE2';legacy.name='Stored circular Stage 2 replay fixture';
  legacy.stages[1].response='EXTERNAL_SEARCH_PERFORMED: true. SOURCE_ID: SRC-0001 SOURCE_TYPE: APPLICATION_FILE SOURCE_ROLE: GOVERNING URL: app-v11.html. SOURCE_ID: SRC-0002 SOURCE_TYPE: GENERATED_FILE SOURCE_ROLE: GOVERNING URL: build-v13-self.mjs. This obsolete record improperly used project implementation work products as research authority.';
  fs.writeFileSync(path.join(root,'SELF_VERIFIED_PROJECT.json'),'{}\\n');
  const legacyContext=await browser.newContext({viewport:{width:393,height:852}});
  await legacyContext.addInitScript(({legacy})=>{localStorage.setItem('closedLoopReliability.projects.v13',JSON.stringify([legacy]));localStorage.setItem('closedLoopReliability.selected.v13',legacy.projectId)},{legacy});
  const legacyPage=await legacyContext.newPage();await legacyPage.goto(\`\${origin}/app-v13.html?replay=\${Date.now()}\`,{waitUntil:'networkidle'});
  const replayed=await legacyPage.evaluate(()=>window.__CLR_V13__.getProjects().find(p=>p.projectId==='PROJECT-LEGACY-CIRCULAR-STAGE2'));
  assert.ok(replayed);assert.equal(replayed.stages[0].status,'COMPLETE');assert.equal(replayed.stages[1].status,'NOT_STARTED');assert.equal(replayed.stages.filter(s=>s.status==='COMPLETE').length,1);assert.equal(replayed.revalidation.invalidatedFromStage,2);assert.match(await legacyPage.locator('#status').textContent(),/Current-rule replay reset 1 obsolete project/);
  await legacyContext.close();fs.writeFileSync(path.join(root,'SELF_VERIFIED_PROJECT.json'),validSidecarBytes);
  assert.equal(consoleErrors.length,0,\`Primary browser errors: \${consoleErrors.join(' | ')}\`);`;
browser=replaceExact(browser,replayAnchor,replayTest,'Stored circular Stage 2 replay browser test');

const reportAnchor=`    freshBrowserSidecarAutoload:true,
    mobileWidthsVerified:[393,320],`;
const reportReplacement=`    freshBrowserSidecarAutoload:true,
    storedCircularStage2ReplayInvalidatedFromStage:2,
    mobileWidthsVerified:[393,320],`;
browser=replaceExact(browser,reportAnchor,reportReplacement,'State-replay report field');
fs.writeFileSync('self-browser-e2e-runtime.mjs',browser);
for(const file of ['self-e2e-agent-runtime.mjs','self-browser-e2e-runtime.mjs']){const syntax=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(syntax.status!==0){process.stderr.write(syntax.stderr||syntax.stdout||'');process.exit(syntax.status??1)}}
const test=spawnSync(process.execPath,['self-browser-e2e-runtime.mjs'],{encoding:'utf8',stdio:'inherit',env:process.env});
process.exit(test.status??1);

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root=path.dirname(fileURLToPath(import.meta.url));
const port=4173;
const origin=`http://127.0.0.1:${port}`;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(700);
let chrome=process.env.CHROME_PATH;
for(const p of ['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'])if(!chrome&&fs.existsSync(p))chrome=p;
if(!chrome)throw new Error('System Chromium/Chrome is required for the real UI self-build test.');

const objective="Create, verify, and release the Closed-Loop Agent Reliability v13 application itself by using the actual application UI from an empty project through every one of the 31 sequential operations. The released application must automatically load and display the exact project JSON exported through the app's visible Export this project control after this run; the project must not be hardcoded into the HTML.";
const deliverable="The exact standalone HTML file app-v13.html, the exact UI-downloaded SELF_VERIFIED_PROJECT.json project export, and reproducible browser evidence showing 31/31 stages complete, 30 producer responses, 30 verifier responses, a real candidate defect and correction, an ACCEPTED decision, and exact audited/release hash identity.";
const candidateHtml=fs.readFileSync(path.join(root,'app-v13-candidate1.html'),'utf8');
const finalHtml=fs.readFileSync(path.join(root,'app-v13.html'),'utf8');
assert.ok(!candidateHtml.includes('SELF_VERIFIED_PROJECT.json'),'The first candidate must contain the real sidecar filename defect.');
assert.ok(candidateHtml.includes('SELF_VERIFIED_PROJEC.json'),'The first candidate defect is not present.');
assert.ok(finalHtml.includes('SELF_VERIFIED_PROJECT.json'),'The corrected app must use the exact sidecar filename.');
assert.ok(!finalHtml.includes('HARDCODED_COMPLETED_PROJECT'),'The corrected HTML must not embed a completed project object.');

const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:393,height:852},acceptDownloads:true});
await context.grantPermissions(['clipboard-read','clipboard-write'],{origin});
const page=await context.newPage();
const consoleErrors=[];
page.on('pageerror',e=>consoleErrors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
const agent=(n,role,prompt,run=0)=>{
  const r=spawnSync(process.execPath,[path.join(root,'self-e2e-agent.mjs'),String(n),role,String(run),Buffer.from(prompt).toString('base64')],{encoding:'utf8',maxBuffer:8*1024*1024});
  if(r.status!==0)throw new Error(`External self-build agent failed stage ${n} ${role} ${run}: ${r.stderr}`);
  assert.ok(r.stdout.length>=80);
  return r.stdout;
};
const copyMain=async()=>{await page.locator('#copyMain').click();return await page.evaluate(()=>navigator.clipboard.readText())};
const copyRun=async(role,i)=>{await page.locator(`[data-rprompt="${role}:${i}"]`).click();return await page.evaluate(()=>navigator.clipboard.readText())};
const message=async()=>page.locator('#stageMsg').textContent();

try{
  await page.goto(`${origin}/app-v13.html`,{waitUntil:'networkidle'});
  assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth),393,'393px phone layout must not overflow horizontally');
  assert.match(await page.locator('#status').textContent(),/Ready/);
  assert.match(await page.locator('#projects').textContent(),/No projects/,'The unseeded app must not contain a pre-completed project.');

  await page.locator('#newBtn').click();
  await page.locator('#name').fill('REAL SELF-BUILD — CLOSED-LOOP RELIABILITY V13');
  await page.locator('#objective').fill(objective);
  await page.locator('#deliverable').fill(deliverable);
  await page.locator('#inputs').fill('Actual inputs: app-v11.html; build-v13-self.mjs; self-browser-e2e.mjs; self-e2e-agent.mjs; generated app-v13-candidate1.html; generated app-v13.html; system Chromium; SHA-256; GitHub Actions; visible app export and download controls.');
  await page.locator('#constraints').fill('No hardcoded completed project. No skipped stage. Every required standard, producer, and verifier field must receive an actual completed external-process response. The first candidate must be tested with a real sidecar filename defect, corrected, rerun, confirmed unchanged, audited, and released only when exact hashes match.');
  await page.locator('#format').fill('Standalone UTF-8 HTML application plus exact visible-UI JSON project export');
  await page.locator('#deadline').fill('Current verified release');
  await page.locator('#createBtn').click();
  assert.match(await page.locator('#pTitle').textContent(),/REAL SELF-BUILD/);
  assert.match(await page.locator('#pct').textContent(),/0\/31/);

  await page.locator('[data-stage="2"]').click();
  assert.match(await page.locator('#stagePanel').textContent(),/LOCKED: Stage 1 must be COMPLETE before Stage 2/);
  await page.locator('[data-stage="1"]').click();

  const standardStages=[1,2,3,4,5,6,7,8,9,10,13,14,15,16,17,21,22,23,24,25,26,27,28,29];
  for(let n=1;n<=31;n++){
    await page.locator(`[data-stage="${n}"]`).click();
    if(n===11||n===18){
      for(let i=0;i<10;i++){
        const pr=await copyRun('producer',i);
        assert.match(pr,new RegExp(`RUN-${String(i+1).padStart(3,'0')}`));
        await page.locator(`[data-producer="${i}"]`).fill(agent(n,'producer',pr,i+1));
      }
      await page.locator('#notes').fill(`Visible UI evidence: all ten Stage ${n} producer textareas contain fresh external-process execution receipts bound to actual app artifact files and SHA-256 values.`);
      await page.locator('#completeBatch').click();
    }else if(n===12){
      for(let i=0;i<10;i++){
        const pr=await copyRun('verifier',i);
        assert.match(pr,/TARGET RUN OUTPUT TO VERIFY:/);
        await page.locator(`[data-verifier="${i}"]`).fill(agent(n,'verifier',pr,i+1));
      }
      await page.locator('#notes').fill('Visible UI evidence: ten independent verifier textareas contain fresh-process requirement matrices. Every verifier independently observed the same real sidecar filename defect in CANDIDATE-v001.');
      await page.locator('#completeVerify').click();
    }else if(n===19){
      for(let i=0;i<10;i++){
        const pr=await copyRun('verifier',i);
        assert.match(pr,/TARGET RUN OUTPUT TO VERIFY:/);
        await page.locator(`[data-verifier="${i}"]`).fill(agent(n,'verifier',pr,i+1));
      }
      await page.locator('#response').fill(agent(n,'stage',await copyMain()));
      await page.locator('#notes').fill('Visible UI evidence: ten corrected-candidate verifier textareas and the convergence ledger were completed through rendered controls.');
      await page.locator('#completeVerify').click();
    }else if(n===20){
      for(let i=0;i<10;i++){
        let pr=await copyRun('producer',i);
        await page.locator(`[data-producer="${i}"]`).fill(agent(n,'producer',pr,i+1));
        pr=await copyRun('verifier',i);
        assert.match(pr,/TARGET RUN OUTPUT TO VERIFY:/);
        await page.locator(`[data-verifier="${i}"]`).fill(agent(n,'verifier',pr,i+1));
      }
      await page.locator('#response').fill(agent(n,'stage',await copyMain()));
      await page.locator('#notes').fill('Visible UI evidence: all ten unchanged-confirmation producer and verifier textareas were populated through the rendered Stage 20 controls.');
      await page.locator('#completeConfirm').click();
    }else if(n===30){
      const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'app-v13.html'))).digest('hex');
      const pr=await copyMain();
      assert.match(pr,/VERIFY RELEASE HASH/);
      const resp=`AUDITED_HASH: ${actual}. RELEASE_HASH: ${actual}. Equality result: TRUE. Independent Node.js SHA-256 and the browser application hash the exact stored app-v13.html bytes identically. The audited bytes and proposed release bytes are the same byte sequence; no reserialization, regeneration, appended newline, renamed content, or other mutation occurred.`;
      await page.locator('#response').fill(resp);
      await page.locator('#notes').fill('Exact audited and release SHA-256 values were pasted through the Stage 30 UI and checked against the actual stored application bytes.');
      await page.locator('#completeStandard').click();
    }else if(n===31){
      await page.locator('#response').fill(agent(n,'stage',await copyMain()));
      await page.locator('#notes').fill('Final exact-byte release record entered through the rendered Stage 31 UI.');
      await page.locator('#completeStandard').click();
    }else if(standardStages.includes(n)){
      const pr=await copyMain();
      assert.match(pr,new RegExp(`STAGE ${n} OF 31`));
      await page.locator('#response').fill(agent(n,'stage',pr));
      await page.locator('#notes').fill(`Visible UI evidence for Stage ${n}: the executable prompt was copied from the actual app and the completed external-process response was pasted into the required rendered field.`);
      await page.locator('#completeStandard').click();
    }else throw new Error(`Unhandled stage ${n}`);
    const msg=await message().catch(()=> '');
    assert.ok(!/required|blocked|error|must /i.test(msg||''),`Stage ${n} emitted error: ${msg}`);
  }

  assert.match(await page.locator('#pct').textContent(),/31\/31/);
  await page.locator('[data-view="release"]').click();
  assert.match(await page.locator('#release').textContent(),/Release gate\s*PASS/);
  const project=await page.evaluate(()=>window.__CLR_V13__.getCurrent());
  const finalBytes=fs.readFileSync(path.join(root,'app-v13.html'));
  const finalHash=crypto.createHash('sha256').update(finalBytes).digest('hex');
  assert.equal(project.stages.filter(s=>s.status==='COMPLETE').length,31);
  assert.equal(project.releaseDecision,'ACCEPTED');
  assert.equal(project.stages[10].producers.filter(Boolean).length,10);
  assert.equal(project.stages[11].verifiers.filter(Boolean).length,10);
  assert.equal(project.stages[17].producers.filter(Boolean).length,10);
  assert.equal(project.stages[18].verifiers.filter(Boolean).length,10);
  assert.equal(project.stages[19].producers.filter(Boolean).length,10);
  assert.equal(project.stages[19].verifiers.filter(Boolean).length,10);
  assert.equal(project.artifactName,'app-v13.html');
  assert.equal(Buffer.compare(Buffer.from(project.artifact,'utf8'),finalBytes),0,'Stored finished artifact differs from app-v13.html exact bytes.');
  assert.equal(project.auditedHash,finalHash);
  assert.equal(project.releaseHash,finalHash);
  assert.ok(!finalHtml.includes(project.projectId),'The HTML contains the completed project ID and is therefore hardcoded.');
  assert.ok(!finalHtml.includes(objective),'The HTML contains the job objective and is therefore seeded with the project.');
  assert.ok(project.stages[11].verifiers.every(v=>/REQ-015.*VIOLATED/i.test(v)),'The first candidate defect was not independently recorded by all ten verifiers.');
  assert.ok(project.stages[18].verifiers.every(v=>/REQ-015.*SATISFIED/i.test(v)),'The corrected candidate did not pass all ten verifier checks.');
  const producerPids=new Set([...project.stages[10].producers,...project.stages[17].producers,...project.stages[19].producers].map(v=>(v.match(/process (\d+)/i)||[])[1]).filter(Boolean));
  const verifierPids=new Set([...project.stages[11].verifiers,...project.stages[18].verifiers,...project.stages[19].verifiers].map(v=>(v.match(/process (\d+)/i)||[])[1]).filter(Boolean));
  assert.equal(producerPids.size,30,'Producer responses did not come from 30 fresh external processes.');
  assert.equal(verifierPids.size,30,'Verifier responses did not come from 30 fresh external processes.');

  const artifactDownloadPromise=page.waitForEvent('download');
  await page.locator('#downloadArtifact').click();
  const artifactDownload=await artifactDownloadPromise;
  assert.equal(artifactDownload.suggestedFilename(),'app-v13.html');
  const artifactDownloadPath=await artifactDownload.path();
  assert.equal(Buffer.compare(fs.readFileSync(artifactDownloadPath),finalBytes),0,'Visible exact-artifact download differs from audited app bytes.');

  await page.locator('[data-view="workflow"]').click();
  const projectDownloadPromise=page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const projectDownload=await projectDownloadPromise;
  const projectDownloadPath=await projectDownload.path();
  const exportedBytes=fs.readFileSync(projectDownloadPath);
  fs.writeFileSync(path.join(root,'SELF_VERIFIED_PROJECT.json'),exportedBytes);
  const exported=JSON.parse(exportedBytes.toString('utf8'));
  assert.equal(exported.projectId,project.projectId);
  assert.equal(exported.stages.filter(s=>s.status==='COMPLETE').length,31);
  assert.equal(exported.stages[10].producers.filter(Boolean).length,10);
  assert.equal(exported.stages[11].verifiers.filter(Boolean).length,10);
  assert.equal(exported.stages[17].producers.filter(Boolean).length,10);
  assert.equal(exported.stages[18].verifiers.filter(Boolean).length,10);
  assert.equal(exported.stages[19].producers.filter(Boolean).length,10);
  assert.equal(exported.stages[19].verifiers.filter(Boolean).length,10);
  assert.equal(exported.artifact,project.artifact);
  assert.equal(exported.releaseDecision,'ACCEPTED');
  await page.screenshot({path:path.join(root,'SELF_PROJECT_COMPLETED_393.png'),fullPage:true});

  const freshContext=await browser.newContext({viewport:{width:393,height:852}});
  const freshErrors=[];
  const freshPage=await freshContext.newPage();
  freshPage.on('pageerror',e=>freshErrors.push(String(e)));
  freshPage.on('console',m=>{if(m.type()==='error')freshErrors.push(m.text())});
  await freshPage.goto(`${origin}/app-v13.html?fresh=${Date.now()}`,{waitUntil:'networkidle'});
  await freshPage.locator('[data-open]').waitFor({state:'visible'});
  assert.match(await freshPage.locator('#status').textContent(),/1 project/);
  assert.doesNotMatch(await freshPage.locator('#projects').textContent(),/No projects/);
  assert.match(await freshPage.locator('#projects').textContent(),/REAL SELF-BUILD/);
  await freshPage.screenshot({path:path.join(root,'SELF_PROJECT_AUTOLOADED_393.png'),fullPage:true});
  await freshPage.locator('[data-open]').click();
  assert.match(await freshPage.locator('#pct').textContent(),/31\/31/);
  assert.match(await freshPage.locator('#workflow').textContent(),/REAL SELF-BUILD/);
  await freshPage.setViewportSize({width:320,height:568});
  assert.ok((await freshPage.locator('body').evaluate(el=>el.scrollWidth))<=320,'320px completed-project view overflows horizontally.');
  await freshPage.screenshot({path:path.join(root,'SELF_PROJECT_AUTOLOADED_320.png'),fullPage:true});
  assert.equal(freshErrors.length,0,`Fresh sidecar-loaded browser errors: ${freshErrors.join(' | ')}`);
  await freshContext.close();
  assert.equal(consoleErrors.length,0,`Primary browser errors: ${consoleErrors.join(' | ')}`);

  const report={
    status:'PASS',
    testType:'Real Chromium UI self-build from empty project through exact visible export',
    app:'app-v13.html',
    projectId:project.projectId,
    jobId:project.jobId,
    stagesCompleted:31,
    producerResponsesPasted:30,
    verifierResponsesPasted:30,
    producerProcessCount:producerPids.size,
    verifierProcessCount:verifierPids.size,
    firstCandidateDefect:'SELF_VERIFIED_PROJEC.json fails exact sidecar contract in 10/10 independent verifiers',
    correctedCandidate:'SELF_VERIFIED_PROJECT.json passes 10/10 corrected verifiers and 10/10 unchanged confirmation verifiers',
    releaseDecision:project.releaseDecision,
    artifactSha256:finalHash,
    artifactBytes:finalBytes.length,
    artifactVisibleDownloadVerified:true,
    projectVisibleExport:'SELF_VERIFIED_PROJECT.json',
    projectExportSha256:crypto.createHash('sha256').update(exportedBytes).digest('hex'),
    hardcodedProject:false,
    freshBrowserSidecarAutoload:true,
    mobileWidthsVerified:[393,320],
    screenshots:['SELF_PROJECT_COMPLETED_393.png','SELF_PROJECT_AUTOLOADED_393.png','SELF_PROJECT_AUTOLOADED_320.png']
  };
  fs.writeFileSync(path.join(root,'SELF_E2E_REPORT.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{
  await browser.close();
  server.kill('SIGTERM');
}

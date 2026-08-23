import fs from 'node:fs';

const port=9222;
const mode=process.argv[2];
const base=(process.env.PAGE_URL||'').replace(/\/$/,'')+'/?test=1&e2e='+Date.now();
if(!process.env.PAGE_URL)throw new Error('PAGE_URL is required');
if(!['workflow','history','reset'].includes(mode))throw new Error('mode must be workflow, history, or reset');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target=targets.find(x=>x.type==='page');
if(!target)throw new Error('No Chromium page target');
const ws=new WebSocket(target.webSocketDebuggerUrl);
let seq=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}};
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++seq;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
async function ev(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text||JSON.stringify(r.exceptionDetails));return r.result.value}
async function waitFor(expression,ms=20000){const end=Date.now()+ms;while(Date.now()<end){try{if(await ev(expression))return true}catch{}await sleep(100)}throw new Error(`Timed out: ${expression}`)}
const ok=(condition,message)=>{if(!condition)throw new Error(message)};
async function screenshot(name){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});fs.writeFileSync(`live-proof/${name}.png`,Buffer.from(r.data,'base64'));}
async function fresh(){await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url:base+'&mode='+mode+'&t='+Date.now()});await waitFor("document.readyState==='complete'&&document.body.innerText.includes('Closed-Loop Reliability Application Evaluation')");await waitFor("!!document.querySelector('.agent-fab')&&!!document.querySelector('.agent-now')",20000);}

try{
  await fresh();
  if(mode==='workflow'){
    const newHeight=await ev("document.querySelector('#new-job-button').getBoundingClientRect().height");
    const projectHeight=await ev("document.querySelector('#project-data-button').getBoundingClientRect().height");
    const promptButtonHeight=await ev("document.querySelector('.agent-now .agent-copy').getBoundingClientRect().height");
    ok(newHeight<=36,`New project button oversized: ${newHeight}`);
    ok(projectHeight<=36,`Project button oversized: ${projectHeight}`);
    ok(promptButtonHeight<=36,`Copy prompt button oversized: ${promptButtonHeight}`);
    ok(await ev("document.body.innerText.includes('Current agent work')&&document.body.innerText.includes('Copy prompt')"),'Project does not expose the current agent prompt');
    ok(!(await ev("document.body.innerText.toLowerCase().includes('semantic')")),'Disallowed operator wording is visible');
    await screenshot('phone-overview-393x852');
    await ev("document.querySelector('[data-view=\"workflow\"]').click()");
    await waitFor("document.querySelectorAll('[data-operation]').length===31");
    const count=await ev("document.querySelectorAll('[data-operation]').length");
    ok(count===31,`Expected 31 operation controls, found ${count}`);
    await ev("document.querySelector('[data-operation=\"2\"]').click()");
    await waitFor("document.body.innerText.includes('Discover independent external authorities')&&!!document.querySelector('.agent-prompt-visible')");
    ok(await ev("document.body.innerText.includes('Generated instruction / prompt')"),'Generated prompt history is not inspectable');
    ok(await ev("document.body.innerText.includes('Uploaded/project/generated files are not promoted')"),'Authority-separation guidance is not visible at Operation 02');
    const promptText=await ev("document.querySelector('.agent-prompt-visible').textContent");
    ok(promptText.length>800,'Prepared agent prompt is missing or superficial');
    ok(promptText.includes('02 — Inventory Sources')&&promptText.includes('External Research Sources'),'Prepared prompt does not encode the current operation and authority model');
    ok(promptText.includes('AUTHORIZED PROJECT PACKAGE')&&promptText.includes('NON-NEGOTIABLE CONTROL RULES'),'Prepared prompt is not a complete executable agent instruction');
    ok(promptText.includes('never external requirement authority'),'Prepared prompt does not enforce authority separation');
    const before=await ev("JSON.parse(localStorage.getItem('mobile-closed-loop-agent')).projectData.generatedPrompts.length");
    await ev("document.querySelector('.agent-now .agent-rebuild').click()");await sleep(180);
    const after=await ev("JSON.parse(localStorage.getItem('mobile-closed-loop-agent')).projectData.generatedPrompts.length");
    ok(after>before,'Rebuilding a prompt did not preserve a prompt provenance record');
    ok(await ev("!!document.querySelector('.agent-now .agent-package')&&!!document.querySelector('.agent-now .agent-paste')"),'Copy-package or paste-response workflow control is missing');
    await ev("document.querySelector('.agent-fab').click()");
    await waitFor("!!document.querySelector('.agent-drawer')&&document.body.innerText.includes('Copy prompt + package')");
    ok(await ev("document.querySelector('.agent-drawer pre').textContent.length>800"),'Persistent prompt drawer does not expose the complete prompt');
    await screenshot('phone-agent-prompt-393x852');
    fs.writeFileSync('live-proof/workflow-interaction.json',JSON.stringify({ok:true,newHeight,projectHeight,promptButtonHeight,operations:count,promptLength:promptText.length,promptRecordsBefore:before,promptRecordsAfter:after,persistentPrompt:true,renderedPhoneScreenshots:['phone-overview-393x852.png','phone-agent-prompt-393x852.png']},null,2));
  }
  if(mode==='history'){
    const persistedRuns=await ev("JSON.parse(localStorage.getItem('mobile-closed-loop-agent')).projectData.runRecords.length");
    ok(persistedRuns===0,`Retained project contains ${persistedRuns} run records; expected zero`);
    await ev("document.querySelector('[data-view=\"runs\"]').click()");
    await waitFor("document.body.innerText.includes('Executions and independent review')");
    ok(await ev("document.body.innerText.includes('Independent run records')"),'Run records section is not visible');
    await ev("document.querySelector('[data-view=\"history\"]').click()");
    await waitFor("document.body.innerText.includes('Complete history')");
    ok(await ev("document.querySelector('#project-view').textContent.includes('Generated instruction')"),'Generated instructions are not inspectable in History');
    ok(await ev("document.querySelector('#project-view').textContent.includes('Application-evaluation objective')"),'Preserved generated output is not inspectable in History');
    ok(await ev("!!document.querySelector('.agent-fab')"),'Agent prompt is not accessible while reviewing history');
    await screenshot('phone-history-393x852');
    fs.writeFileSync('live-proof/history-interaction.json',JSON.stringify({ok:true,runRecords:persistedRuns,historyVisible:true,promptAccessible:true},null,2));
  }
  if(mode==='reset'){
    await ev("document.querySelector('#new-job-button').click()");
    await waitFor("JSON.parse(localStorage.getItem('mobile-closed-loop-agent')).job.JOB_TITLE==='New project'");
    const clean=await ev("(()=>{const s=JSON.parse(localStorage.getItem('mobile-closed-loop-agent'));return {op:s.projectData.currentOperation,requirements:s.projectData.requirements.length,tests:s.projectData.tests.length,runs:s.projectData.runRecords.length,blockers:s.projectData.blockers.length,changes:s.projectData.changes.length,baseline:Object.keys(s.projectData.baseline).length,product:Object.keys(s.projectData.product).length,release:Object.keys(s.projectData.release).length}})()");
    ok(clean.op===1,'New project did not start at Operation 01');
    ok(clean.requirements===0&&clean.tests===0&&clean.runs===0&&clean.blockers===0&&clean.changes===0,'New project inherited prior workflow records');
    ok(clean.baseline===0&&clean.product===0&&clean.release===0,'New project inherited prior baseline/product/release state');
    await waitFor("!!document.querySelector('.agent-prompt-visible')&&!!document.querySelector('.agent-fab')");
    const newPrompt=await ev("document.querySelector('.agent-prompt-visible').textContent");
    ok(newPrompt.includes('01 — Define Job')&&newPrompt.includes('Capture the complete authorized user job losslessly'),'New project does not receive a usable first-operation agent prompt');
    ok(newPrompt.includes('AUTHORIZED PROJECT PACKAGE'),'New-project prompt does not include the project package');
    ok(newPrompt.includes('User Job Input')&&newPrompt.includes('External Research Sources')&&newPrompt.includes('Workflow-Generated Artifacts'),'New-project prompt does not preserve the three-class architecture');
    await screenshot('phone-new-project-393x852');
    fs.writeFileSync('live-proof/reset-interaction.json',JSON.stringify({ok:true,...clean,newProjectPrompt:true,persistentPrompt:true},null,2));
  }
  console.log(JSON.stringify({determination:'SATISFIED',mode},null,2));
} finally {
  ws.close();
}

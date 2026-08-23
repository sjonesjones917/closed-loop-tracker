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
async function fresh(){await send('Page.enable');await send('Page.navigate',{url:base+'&mode='+mode+'&t='+Date.now()});await waitFor("document.readyState==='complete'&&document.body.innerText.includes('Closed-Loop Reliability application repair')");}

try{
  await fresh();
  if(mode==='workflow'){
    const newHeight=await ev("document.querySelector('#new-job-button').getBoundingClientRect().height");
    const projectHeight=await ev("document.querySelector('#project-data-button').getBoundingClientRect().height");
    ok(newHeight<=36,`New project button oversized: ${newHeight}`);
    ok(projectHeight<=36,`Project button oversized: ${projectHeight}`);

    // The product must be usable immediately from the ordinary Project screen.
    await waitFor("!!document.querySelector('.agent-now')&&!!document.querySelector('.agent-fab')&&!!document.querySelector('.agent-prompt-visible')");
    const initialTitle=await ev("document.querySelector('.agent-now-title strong').textContent");
    const initialPrompt=await ev("document.querySelector('.agent-prompt-visible').textContent");
    ok(initialTitle.includes('11')&&initialTitle.includes('Run 10 Independent Executions'),'Default project screen does not identify the current agent work');
    ok(initialPrompt.length>1200,'Default project screen does not expose a substantive current prompt');
    ok(initialPrompt.includes('CLOSED-LOOP RELIABILITY WORK ORDER'),'Current prompt is not a real work order');
    ok(initialPrompt.includes('AUTHORIZED PROJECT PACKAGE')&&initialPrompt.includes('NON-NEGOTIABLE CONTROL RULES'),'Current prompt is missing authorized context or control rules');
    ok(initialPrompt.includes('Existing implementation')&&initialPrompt.includes('never external requirement authority'),'Current prompt does not enforce authority separation');
    ok(await ev("!!document.querySelector('.agent-copy')&&!!document.querySelector('.agent-open')&&!!document.querySelector('.agent-rebuild')&&!!document.querySelector('.agent-package')&&!!document.querySelector('.agent-paste')"),'Project screen is missing agent workflow controls');
    ok(await ev("document.querySelector('.agent-fab').textContent.includes('Agent prompt')"),'Persistent agent prompt control is missing');

    await ev("document.querySelector('.agent-open').click()");
    await waitFor("!!document.querySelector('.agent-drawer')&&document.querySelector('.agent-drawer pre').textContent.length>1200");
    ok(await ev("document.querySelector('.agent-drawer').innerText.includes('Copy prompt')&&document.querySelector('.agent-drawer').innerText.includes('Copy prompt + package')&&document.querySelector('.agent-drawer').innerText.includes('Paste agent response')"),'Full prompt drawer is not operational');
    await ev("document.querySelector('.agent-close').click()");

    await ev("document.querySelector('[data-view=workflow]').click()");
    await waitFor("document.body.innerText.includes('31-operation workflow')");
    const count=await ev("document.querySelectorAll('[data-operation]').length");
    ok(count===31,`Expected 31 operation controls, found ${count}`);
    await ev("document.querySelector('[data-operation=2]').click()");
    await waitFor("document.body.innerText.includes('Discover independent external authorities')");
    ok(await ev("document.body.innerText.includes('Generated instruction / prompt')"),'Generated prompt history is not inspectable');
    ok(await ev("document.body.innerText.includes('Uploaded/project/generated files are not promoted')"),'Authority-separation guidance is not visible at Operation 02');
    await waitFor("document.querySelector('.agent-now-title strong')?.textContent.includes('02')&&document.querySelector('.agent-prompt-visible')?.textContent.includes('02 — Inventory Sources')");
    const promptText=await ev("document.querySelector('.agent-prompt-visible').textContent");
    ok(promptText.length>1000,'Operation 02 prepared agent prompt is missing or superficial');
    ok(promptText.includes('External Research Sources')&&promptText.includes('Project uploads'),'Operation 02 prompt does not encode the external-authority boundary');
    const before=await ev("JSON.parse(localStorage.getItem('mobile-closed-loop-agent')).projectData.generatedPrompts.length");
    await ev("document.querySelector('.agent-rebuild').click()");await sleep(150);
    const after=await ev("JSON.parse(localStorage.getItem('mobile-closed-loop-agent')).projectData.generatedPrompts.length");
    ok(after>before,'Rebuilding a prompt did not preserve a prompt provenance record');
    fs.writeFileSync('live-proof/workflow-interaction.json',JSON.stringify({ok:true,newHeight,projectHeight,operations:count,initialPromptLength:initialPrompt.length,operation2PromptLength:promptText.length,promptRecordsBefore:before,promptRecordsAfter:after,projectImmediatePrompt:true,persistentPromptControl:true},null,2));
  }
  if(mode==='history'){
    const persistedRuns=await ev("JSON.parse(localStorage.getItem('mobile-closed-loop-agent')).projectData.runRecords.length");
    ok(persistedRuns===0,`Retained project contains ${persistedRuns} run records; expected zero`);
    await waitFor("!!document.querySelector('.agent-fab')&&!!document.querySelector('.agent-now')");
    await ev("document.querySelector('[data-view=runs]').click()");
    await waitFor("document.body.innerText.includes('Executions and independent review')");
    ok(await ev("document.body.innerText.includes('Independent run records')"),'Run records section is not visible');
    ok(await ev("!!document.querySelector('.agent-now')&&!!document.querySelector('.agent-fab')"),'Agent prompt disappeared outside the operation screen');
    await ev("document.querySelector('[data-view=history]').click()");
    await waitFor("document.body.innerText.includes('Complete history')");
    ok(await ev("document.body.innerText.includes('Generated instruction')"),'Generated instructions are not inspectable in History');
    ok(await ev("document.body.innerText.includes('Lossless application-repair job definition preserved.')"),'Preserved generated output is not inspectable in History');
    ok(await ev("!!document.querySelector('.agent-now')&&!!document.querySelector('.agent-fab')"),'Agent prompt is not persistently accessible from History');
    fs.writeFileSync('live-proof/history-interaction.json',JSON.stringify({ok:true,runRecords:persistedRuns,historyVisible:true,promptPersistentAcrossViews:true},null,2));
  }
  if(mode==='reset'){
    await ev("document.querySelector('#new-job-button').click()");
    await waitFor("JSON.parse(localStorage.getItem('mobile-closed-loop-agent')).job.JOB_TITLE==='New project'");
    const clean=await ev("(()=>{const s=JSON.parse(localStorage.getItem('mobile-closed-loop-agent'));return {op:s.projectData.currentOperation,requirements:s.projectData.requirements.length,tests:s.projectData.tests.length,runs:s.projectData.runRecords.length,blockers:s.projectData.blockers.length,changes:s.projectData.changes.length,baseline:Object.keys(s.projectData.baseline).length,product:Object.keys(s.projectData.product).length,release:Object.keys(s.projectData.release).length}})()");
    ok(clean.op===1,'New project did not start at Operation 01');
    ok(clean.requirements===0&&clean.tests===0&&clean.runs===0&&clean.blockers===0&&clean.changes===0,'New project inherited prior workflow records');
    ok(clean.baseline===0&&clean.product===0&&clean.release===0,'New project inherited prior baseline/product/release state');
    await waitFor("document.querySelector('.agent-now-title strong')?.textContent.includes('01')&&document.querySelector('.agent-prompt-visible')?.textContent.includes('01 — Define Job')");
    const newPrompt=await ev("document.querySelector('.agent-prompt-visible').textContent");
    ok(newPrompt.length>1000&&newPrompt.includes('Capture the complete authorized user job losslessly'),'New project does not receive a substantive usable Operation 01 prompt immediately');
    ok(await ev("!!document.querySelector('.agent-copy')&&!!document.querySelector('.agent-fab')"),'New project has no immediately accessible Copy prompt control');
    fs.writeFileSync('live-proof/reset-interaction.json',JSON.stringify({ok:true,...clean,newProjectPrompt:true,newProjectPromptLength:newPrompt.length,immediateCopyControl:true},null,2));
  }
  console.log(JSON.stringify({determination:'SATISFIED',mode},null,2));
} finally {
  ws.close();
}

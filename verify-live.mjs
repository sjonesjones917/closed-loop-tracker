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
async function fresh(){await send('Page.enable');await send('Page.navigate',{url:base+'&mode='+mode+'&t='+Date.now()});await waitFor("document.readyState==='complete'&&document.body.innerText.includes('Closed-Loop Reliability application repair')");await waitFor("!!document.querySelector('[data-prompt-center]')",20000);}

try{
  await fresh();
  if(mode==='workflow'){
    const newHeight=await ev("document.querySelector('#new-job-button').getBoundingClientRect().height");
    const projectHeight=await ev("document.querySelector('#project-data-button').getBoundingClientRect().height");
    ok(newHeight<=36,`New project button oversized: ${newHeight}`);
    ok(projectHeight<=36,`Project button oversized: ${projectHeight}`);
    ok(await ev("document.body.innerText.includes('Copy prompt')"),'Project overview does not expose the current prompt action');
    await ev("document.querySelector('[data-prompt-center]').click()");
    await waitFor("document.querySelectorAll('[data-prompt-operation]').length===31");
    ok(await ev("document.body.innerText.includes('Every workflow operation has a project-specific prompt')"),'Prompts workspace explanation is missing');
    ok(await ev("!!document.querySelector('#copy-current-prompt')"),'Prompts workspace lacks Copy current prompt');
    await ev("document.querySelector('[data-prompt-operation=2]').click()");
    await waitFor("document.body.innerText.includes('Discover independent external authorities')");
    ok(await ev("document.body.innerText.includes('Generated instruction / prompt')"),'Generated prompt history is not inspectable');
    ok(await ev("document.body.innerText.includes('Uploaded/project/generated files are not promoted')"),'Authority-separation guidance is not visible at Operation 02');
    await waitFor("document.body.innerText.includes('Use with your agent')&&document.querySelector('#copy-agent-prompt')");
    const promptText=await ev("document.querySelector('#agent-prompt-text').textContent");
    ok(promptText.length>800,'Prepared agent prompt is missing or superficial');
    ok(promptText.includes('Operation 02')&&promptText.includes('External Research Sources'),'Prepared prompt does not encode the current operation and authority model');
    ok(promptText.includes('AUTHORIZED PROJECT CONTEXT')&&promptText.includes('CONTROL RULES'),'Prepared prompt is not a complete executable agent instruction');
    const promptButtonHeight=await ev("document.querySelector('#copy-agent-prompt').getBoundingClientRect().height");
    ok(promptButtonHeight<=36,`Copy prompt button oversized: ${promptButtonHeight}`);
    const before=await ev("JSON.parse(localStorage.getItem('mobile-closed-loop-agent')).projectData.generatedPrompts.length");
    await ev("document.querySelector('#refresh-agent-prompt').click()");await sleep(150);
    const after=await ev("JSON.parse(localStorage.getItem('mobile-closed-loop-agent')).projectData.generatedPrompts.length");
    ok(after>before,'Rebuilding a prompt did not preserve a prompt provenance record');
    ok(await ev("!!document.querySelector('#copy-agent-package')&&!!document.querySelector('#paste-agent-response')"),'Copy-package or paste-response workflow control is missing');
    fs.writeFileSync('live-proof/workflow-interaction.json',JSON.stringify({ok:true,newHeight,projectHeight,promptButtonHeight,operations:31,promptLength:promptText.length,promptRecordsBefore:before,promptRecordsAfter:after,promptCenter:true},null,2));
  }
  if(mode==='history'){
    const persistedRuns=await ev("JSON.parse(localStorage.getItem('mobile-closed-loop-agent')).projectData.runRecords.length");
    ok(persistedRuns===0,`Retained project contains ${persistedRuns} run records; expected zero`);
    await ev("document.querySelector('[data-view=runs]').click()");
    await waitFor("document.body.innerText.includes('Executions and independent review')");
    ok(await ev("document.body.innerText.includes('Independent run records')"),'Run records section is not visible');
    await ev("document.querySelector('[data-view=history]').click()");
    await waitFor("document.body.innerText.includes('Complete history')");
    ok(await ev("document.body.innerText.includes('Generated instruction')"),'Generated instructions are not inspectable in History');
    ok(await ev("document.body.innerText.includes('Lossless application-repair job definition preserved.')"),'Preserved generated output is not inspectable in History');
    fs.writeFileSync('live-proof/history-interaction.json',JSON.stringify({ok:true,runRecords:persistedRuns,historyVisible:true},null,2));
  }
  if(mode==='reset'){
    await ev("document.querySelector('#new-job-button').click()");
    await waitFor("JSON.parse(localStorage.getItem('mobile-closed-loop-agent')).job.JOB_TITLE==='New project'");
    const clean=await ev("(()=>{const s=JSON.parse(localStorage.getItem('mobile-closed-loop-agent'));return {op:s.projectData.currentOperation,requirements:s.projectData.requirements.length,tests:s.projectData.tests.length,runs:s.projectData.runRecords.length,blockers:s.projectData.blockers.length,changes:s.projectData.changes.length,baseline:Object.keys(s.projectData.baseline).length,product:Object.keys(s.projectData.product).length,release:Object.keys(s.projectData.release).length}})()");
    ok(clean.op===1,'New project did not start at Operation 01');
    ok(clean.requirements===0&&clean.tests===0&&clean.runs===0&&clean.blockers===0&&clean.changes===0,'New project inherited prior workflow records');
    ok(clean.baseline===0&&clean.product===0&&clean.release===0,'New project inherited prior baseline/product/release state');
    await waitFor("!!document.querySelector('[data-prompt-center]')");
    await ev("document.querySelector('[data-prompt-center]').click()");
    await waitFor("document.querySelectorAll('[data-prompt-operation]').length===31");
    await ev("document.querySelector('[data-prompt-operation=1]').click()");
    await waitFor("document.body.innerText.includes('Use with your agent')&&document.querySelector('#agent-prompt-text')");
    const newPrompt=await ev("document.querySelector('#agent-prompt-text').textContent");
    ok(newPrompt.includes('Operation 01')&&newPrompt.includes('lossless job definition'),'New project does not receive a usable first-operation agent prompt');
    ok(newPrompt.includes('AUTHORIZED PROJECT CONTEXT'),'New-project prompt does not include project context');
    fs.writeFileSync('live-proof/reset-interaction.json',JSON.stringify({ok:true,...clean,newProjectPrompt:true,promptCenter:true},null,2));
  }
  console.log(JSON.stringify({determination:'SATISFIED',mode},null,2));
} finally {
  ws.close();
}

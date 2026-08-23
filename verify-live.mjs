import fs from 'node:fs';
const mode=process.argv[2]||'workflow',base=process.env.PAGE_URL;
if(!base)throw new Error('PAGE_URL is required');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tabs=await fetch('http://127.0.0.1:9222/json').then(r=>r.json());
const tab=tabs[0];if(!tab?.webSocketDebuggerUrl)throw new Error('No Chrome debugging target');
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});
let seq=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const {res,rej}=pending.get(m.id);pending.delete(m.id);m.error?rej(new Error(JSON.stringify(m.error))):res(m.result)}};
const send=(method,params={})=>new Promise((res,rej)=>{const id=++seq;pending.set(id,{res,rej});ws.send(JSON.stringify({id,method,params}))});
const evalJS=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});return r.result.value};
await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true});
await send('Page.navigate',{url:`${base.replace(/\/$/,'')}/?test=1&verify=${Date.now()}`});
for(let i=0;i<80;i++){await sleep(100);const ready=await evalJS(`document.body.innerText.includes('GEN-042 maintenance handoff')`);if(ready)break;if(i===79)throw new Error('Application did not render retained project')}
const must=(x,m)=>{if(!x)throw new Error(m)};
if(mode==='workflow'){
  await evalJS(`document.querySelector('[data-view="workflow"]')?.click()`);await sleep(120);
  const result=await evalJS(`(()=>({count:document.querySelectorAll('.workflow-row').length,text:document.body.innerText,scroll:document.documentElement.scrollWidth-innerWidth,buttons:[...document.querySelectorAll('button')].map(b=>({t:b.innerText.trim(),h:b.getBoundingClientRect().height,w:b.getBoundingClientRect().width})),schema:JSON.parse(localStorage.getItem('mobile-closed-loop-agent')).projectData.schema}))()`);
  must(result.count===30,'live workflow must contain exactly 30 stages');must(result.schema==='human-project/30','live project schema must be human-project/30');must(result.text.includes('Preserve Failures Permanently'),'Stage 30 must be visible');must(!result.text.includes('Release Exact Accepted Artifact'),'extra operation must not be visible');must(!result.text.includes('Current agent work'),'persistent agent panel must not exist');must(result.scroll<=1,'320px layout must not horizontally overflow');
  for(const b of result.buttons.filter(x=>x.t)){must(b.h>=28&&b.h<=48,`button height outside compact usable range: ${b.t} ${b.h}`)}
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.mkdirSync('live-proof',{recursive:true});fs.writeFileSync('live-proof/phone-320.png',Buffer.from(shot.data,'base64'));
  console.log('live 320px workflow verified: exact 30 stages, compact controls, no persistent agent panel');
}else if(mode==='history'){
  await evalJS(`document.querySelector('[data-view="history"]')?.click()`);await sleep(100);const t=await evalJS(`document.body.innerText`);must(t.includes('Complete project history'),'history view missing');must(t.includes('Stage states'),'stage history missing');must(t.includes('Output receipts'),'output receipts missing');must(t.includes('preserved artifacts')||t.includes('Preserved artifacts'),'artifact history missing');console.log('live history verified');
}else if(mode==='reset'){
  await evalJS(`document.getElementById('new-job-button').click()`);await sleep(120);const x=await evalJS(`(()=>{const s=JSON.parse(localStorage.getItem('mobile-closed-loop-agent'));return {schema:s.projectData.schema,stage:s.projectData.currentStage,req:s.projectData.requirements.length,runs:s.projectData.runRecords.length,chains:s.projectData.evidenceChains.length,baseline:Object.keys(s.projectData.baseline).length,product:Object.keys(s.projectData.product).length,gate:Object.keys(s.projectData.releaseGate).length,title:s.job.JOB_TITLE}})()`);must(x.schema==='human-project/30','new project schema incorrect');must(x.stage===1&&x.req===0&&x.runs===0&&x.chains===0,'new project inherited prior job records');must(x.baseline===0&&x.product===0&&x.gate===0,'new project inherited baseline/product/release');must(x.title==='New project','new project title incorrect');console.log('live new-project reset verified');
}else throw new Error(`Unknown mode ${mode}`);
ws.close();

import fs from 'node:fs';
const mode=process.argv[2]||'workflow',base=process.env.PAGE_URL,TEST_KEY='retained-real-test-project';
if(!base)throw new Error('PAGE_URL is required');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tabs=await fetch('http://127.0.0.1:9222/json').then(r=>r.json());
const tab=tabs.find(t=>t.type==='page'&&t.webSocketDebuggerUrl)||tabs.find(t=>t.webSocketDebuggerUrl);if(!tab?.webSocketDebuggerUrl)throw new Error('No Chrome page debugging target');
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});
let seq=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const {res,rej}=pending.get(m.id);pending.delete(m.id);m.error?rej(new Error(JSON.stringify(m.error))):res(m.result)}};
const send=(method,params={})=>new Promise((res,rej)=>{const id=++seq;pending.set(id,{res,rej});ws.send(JSON.stringify({id,method,params}))});
const evalJS=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});return r.result.value};
await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true});
await send('Page.navigate',{url:`${base.replace(/\/$/,'')}/?verify=${Date.now()}`});
let ready=false;for(let i=0;i<300;i++){await sleep(100);ready=await evalJS(`!!document.querySelector('#project-picker option[value="${TEST_KEY}"]')`);if(ready)break}
if(!ready){const d=await evalJS(`(()=>({url:location.href,subtitle:document.getElementById('subtitle')?.textContent,options:[...document.querySelectorAll('#project-picker option')].map(o=>({value:o.value,text:o.textContent})),storage:[...Array(localStorage.length)].map((_,i)=>localStorage.key(i)),body:document.body?.innerText?.slice(0,1200)}))()`);throw new Error(`Application did not load retained project: ${JSON.stringify(d)}`)}
await evalJS(`(()=>{const s=document.getElementById('project-picker');const o=s.querySelector('option[value="${TEST_KEY}"]');s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);await sleep(150);
const must=(x,m)=>{if(!x)throw new Error(m)};
if(mode==='workflow'){
  const result=await evalJS(`(()=>{const r=JSON.parse(localStorage.getItem('closed-loop-project-registry-v30')||'{}'),a=localStorage.getItem('closed-loop-active-project-v30'),p=r[a];return {count:document.querySelectorAll('.stage-list [data-stage]').length,text:document.body.innerText,scroll:document.documentElement.scrollWidth-innerWidth,buttons:[...document.querySelectorAll('.controls button,.tabs button,.stage-list button')].map(b=>({t:b.innerText.trim(),h:b.getBoundingClientRect().height,w:b.getBoundingClientRect().width})),schema:p?.schema,stageRecords:Object.keys(p?.stageRecords||{}).length,runs:p?.runs?.length||0,verification:p?.verification?.length||0,prompts:p?.generatedPrompts?.length||0,outputs:p?.agentOutputs?.length||0,title:p?.job?.title}})()`);
  must(result.title==='GEN-042 maintenance handoff','retained real test project is not active');
  must(result.schema==='closed-loop-project/30','live project schema must be closed-loop-project/30');
  must(result.stageRecords===30&&result.count===30,'live workflow must contain exactly 30 stages');
  must(result.runs===20,'retained real project must preserve two complete ten-run iterations');
  must(result.verification===200,'retained real project must preserve the complete requirement-by-run verification records');
  must(result.prompts===30&&result.outputs===30,'all generated stage instructions and saved outputs must remain in the project');
  must(result.text.includes('Preserve Failures Permanently'),'Stage 30 must be visible');
  must(!result.text.includes('Release Exact Accepted Artifact'),'extra operation must not be visible');
  must(!result.text.includes('Current agent work'),'persistent agent panel must not exist');
  must(result.scroll<=1,'320px layout must not horizontally overflow');
  for(const b of result.buttons.filter(x=>x.t)){must(b.h>=28&&b.h<=52,`compact control height outside usable range: ${b.t} ${b.h}`)}
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.mkdirSync('live-proof',{recursive:true});fs.writeFileSync('live-proof/phone-320.png',Buffer.from(shot.data,'base64'));
  console.log('live 320px workflow verified: retained real project, exact 30 stages, 20 runs, 200 verification records, visible generated instructions/outputs, compact controls');
}else if(mode==='history'){
  await evalJS(`document.querySelector('[data-tab="records"]')?.click()`);await sleep(100);const records=String(await evalJS(`document.body.innerText`));
  for(const required of ['Complete project record','User-entered job data','Attached files','Sources','Research','Requirements','Tests','Failure tests','Production instructions','Generated agent blocks','Agent outputs and receipts','Fresh contexts','Run records','Verification records','Comparisons','Defects','Regressions','Controlled changes','Audits','Release records','Evidence chains','All stage records'])must(records.includes(required),`complete project record is missing ${required}`);
  await evalJS(`document.querySelector('[data-tab="history"]')?.click()`);await sleep(100);const history=String(await evalJS(`document.body.innerText`));must(history.includes('History'),'history view missing');
  console.log('live project records verified: user data, instructions, outputs, runs, evidence, release records, and stage records are visible');
}else if(mode==='reset'){
  await evalJS(`document.getElementById('new-project').click()`);await sleep(120);const x=await evalJS(`(()=>{const r=JSON.parse(localStorage.getItem('closed-loop-project-registry-v30')||'{}'),a=localStorage.getItem('closed-loop-active-project-v30'),p=r[a];return {schema:p?.schema,stage:p?.job?.currentStage,req:p?.requirements?.length,runs:p?.runs?.length,chains:p?.evidenceChains?.length,artifacts:p?.artifacts?.length,audits:p?.audits?.length,release:p?.releaseRecords?.length,title:p?.job?.title,records:Object.keys(p?.stageRecords||{}).length}})()`);must(x.schema==='closed-loop-project/30','new project schema incorrect');must(x.records===30&&x.stage===1&&x.req===0&&x.runs===0&&x.chains===0,'new project inherited prior job records');must(x.artifacts===0&&x.audits===0&&x.release===0,'new project inherited prior artifacts or release evidence');must(x.title==='New project','new project title incorrect');console.log('live new-project reset verified');
}else throw new Error(`Unknown mode ${mode}`);
ws.close();

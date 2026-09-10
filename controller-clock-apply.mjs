import fs from 'node:fs';

const path = 'verify-human-stage-walkthrough.mjs';
const source = fs.readFileSync(path, 'utf8');
if (source.includes('closedLoopVirtualClockInstalled')) {
  console.log('Virtual clock already installed.');
  process.exit(0);
}
const anchor = "    await send('Runtime.enable');\n";
if (!source.includes(anchor)) throw new Error('Runtime.enable anchor not found in human walkthrough verifier.');
const injection = `${anchor}    await send('Runtime.evaluate',{expression:\`(()=>{const realSetTimeout=globalThis.setTimeout.bind(globalThis),realClearTimeout=globalThis.clearTimeout.bind(globalThis),timers=new Map();let virtualNow=Date.now(),next=0;Object.defineProperty(globalThis,'closedLoopVirtualClockInstalled',{value:true,configurable:false});Date.now=()=>virtualNow;globalThis.setTimeout=(fn,delay=0,...args)=>{const id=++next,t=Number(delay)||0;if(t>=1000){virtualNow+=t;const h=realSetTimeout(()=>{timers.delete(id);fn(...args)},0);timers.set(id,h);return id}const h=realSetTimeout(()=>{timers.delete(id);fn(...args)},Math.max(0,t));timers.set(id,h);return id};globalThis.clearTimeout=id=>{const h=timers.get(id);if(h!==undefined){timers.delete(id);realClearTimeout(h)}};return true})()\`,returnByValue:true});\n`;
const updated = source.replace(anchor, injection);
if (updated === source) throw new Error('Human walkthrough verifier was not changed.');
fs.writeFileSync(path, updated);

const regressionPath = 'verify-human-walkthrough-clock.mjs';
fs.writeFileSync(regressionPath, `import fs from 'node:fs';\nimport assert from 'node:assert/strict';\nconst source=fs.readFileSync('verify-human-stage-walkthrough.mjs','utf8');\nassert(source.includes('closedLoopVirtualClockInstalled'),'walkthrough does not install the deterministic browser clock');\nassert(source.includes('realSetTimeout'),'walkthrough does not preserve the browser timer authority');\nassert(source.includes('realClearTimeout'),'walkthrough does not preserve clearTimeout authority');\nassert(source.includes('if(t>=1000){virtualNow+=t'),'long operational waits are not virtualized');\nassert(!/globalThis\\.clearTimeout=id=>\\{[^}]*clearTimeout\\(h\\)/s.test(source),'clearTimeout override recursively invokes itself');\nconsole.log(JSON.stringify({invalidFixture:'real wall-clock delays can exceed the controller execution window',repairedPath:'long operational waits are virtualized while short event-loop ordering remains asynchronous'}));\n`);

const workflowPath = '.github/workflows/pages.yml';
let workflow = fs.readFileSync(workflowPath, 'utf8');
if (!workflow.includes('node verify-human-walkthrough-clock.mjs')) {
  const workflowAnchor = '          node verify-human-stage-walkthrough.mjs\n';
  if (!workflow.includes(workflowAnchor)) throw new Error('Human walkthrough workflow anchor not found.');
  workflow = workflow.replace(workflowAnchor, `          node verify-human-walkthrough-clock.mjs\n${workflowAnchor}`);
  fs.writeFileSync(workflowPath, workflow);
}
console.log('Applied deterministic browser-clock regression repair.');

import fs from 'node:fs';

const path='verify-browser.mjs';
let source=fs.readFileSync(path,'utf8');
const start=source.indexOf("async function selectResponseFile(cdp,text,filename='response.json'){");
const end=source.indexOf('async function setWidth',start);
if(start<0||end<0)throw new Error('Existing response-file browser helper was not found.');
const replacement=`async function selectResponseFile(cdp,text,filename='response.json'){
  const safeName=String(filename||'response.json').replace(/[^A-Za-z0-9._-]/g,'_'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-response-file-')),filePath=path.join(directory,safeName);
  fs.writeFileSync(filePath,String(text??''),'utf8');
  await cdp.send('DOM.enable');
  let lastState=null;
  for(let attempt=1;attempt<=4;attempt++){
    const ready=await evalValue(cdp,\`(()=>{const input=document.querySelector('#response-json-file'),button=document.querySelector('#process-response-file');return {input:Boolean(input),connected:Boolean(input?.isConnected),inputDisabled:Boolean(input?.disabled),button:Boolean(button),buttonDisabled:Boolean(button?.disabled),buttonWired:typeof button?.onclick==='function'};})()\`);
    assert(ready?.input&&ready?.button,'Authoritative response-file controls are unavailable.');
    assert(!ready.inputDisabled&&!ready.buttonDisabled&&ready.buttonWired,\`Authoritative response-file controls are not ready: \${JSON.stringify(ready)}\`);
    const handle=await cdp.send('Runtime.evaluate',{expression:\`document.querySelector('#response-json-file')\`,returnByValue:false});
    assert(handle.result?.objectId,'Authoritative response-file input is unavailable.');
    await cdp.send('DOM.setFileInputFiles',{files:[filePath],objectId:handle.result.objectId});
    const selected=await evalValue(cdp,\`(()=>{const input=document.querySelector('#response-json-file');if(!input||input.files.length!==1)return false;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return input.files[0].name===\${JSON.stringify(safeName)};})()\`);
    if(!selected){await sleep(120);continue;}
    await sleep(180);
    lastState=await evalValue(cdp,\`(()=>{const input=document.querySelector('#response-json-file'),button=document.querySelector('#process-response-file'),status=document.querySelector('#response-file-status')?.textContent||'';return {connected:Boolean(input?.isConnected),selectedName:input?.files?.[0]?.name||null,fileCount:input?.files?.length||0,status,buttonDisabled:Boolean(button?.disabled),buttonWired:typeof button?.onclick==='function'};})()\`);
    if(lastState.connected&&lastState.fileCount===1&&lastState.selectedName===safeName&&lastState.status.includes(safeName)&&!lastState.buttonDisabled&&lastState.buttonWired)return;
  }
  throw new Error(\`The authoritative response-file selection did not remain bound to a stable current control: \${JSON.stringify(lastState)}\`);
}
`;
source=source.slice(0,start)+replacement+source.slice(end);
fs.writeFileSync(path,source);
console.log('Stabilized the real-browser response-file selection proof across current-control rerenders.');

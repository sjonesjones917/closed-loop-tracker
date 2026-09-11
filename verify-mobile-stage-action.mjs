import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PAGE_URL=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const browser=process.env.BROWSER||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chrome'].find(fs.existsSync);
if(!browser)throw new Error('Chrome/Chromium was not found');
const port=9700+Math.floor(Math.random()*200),profile=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-mobile-stage-'));
const proc=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
async function getJson(url,opts){const response=await fetch(url,opts);if(!response.ok)throw new Error(`${url} -> ${response.status}`);return response.json();}
async function poll(fn,timeout=20000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{return await fn();}catch(error){last=error;await sleep(120);}}throw last||new Error('Timed out');}
class CDP{constructor(ws){this.ws=new WebSocket(ws);this.id=0;this.pending=new Map();this.ready=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);};}async send(method,params={}){await this.ready;const id=++this.id,promise=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));this.ws.send(JSON.stringify({id,method,params}));return promise;}close(){this.ws.close();}}
async function evaluate(cdp,expression){const result=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Evaluation failed');return result.result?.value;}
async function waitFor(cdp,expression,timeout=20000){return poll(async()=>{const value=await evaluate(cdp,expression);if(!value)throw new Error(`Waiting: ${expression}`);return value;},timeout);}
async function click(cdp,selector){assert(await evaluate(cdp,`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return false;node.click();return true})()`),`Missing clickable ${selector}`);await sleep(160);}
async function fill(cdp,selector,value){assert(await evaluate(cdp,`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return false;node.value=${JSON.stringify(value)};node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));return true})()`),`Missing input ${selector}`);}
async function setWidth(cdp,width,height=844){await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await sleep(150);}
async function openStage(cdp,stage){await click(cdp,'[data-view="Workflow"]');await evaluate(cdp,`(()=>{const select=document.querySelector('#stage-picker');if(!select)return false;select.value=${JSON.stringify(String(stage))};select.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);await waitFor(cdp,`document.body.innerText.includes('Stage ${String(stage).padStart(2,'0')}')`);}

async function main(){
  await poll(()=>getJson(`http://127.0.0.1:${port}/json/version`));
  const target=await getJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${PAGE_URL}?mobile-stage-regression=${Date.now()}`)}`,{method:'PUT'}),cdp=new CDP(target.webSocketDebuggerUrl);
  await cdp.ready;await cdp.send('Runtime.enable');await cdp.send('Page.enable');
  await waitFor(cdp,`document.readyState==='complete'`);await waitFor(cdp,`globalThis.closedLoopAppReady===true`);assert(!(await evaluate(cdp,'globalThis.closedLoopAppError')),await evaluate(cdp,'globalThis.closedLoopAppError'));
  await click(cdp,'#new-project');await waitFor(cdp,`Boolean(document.querySelector('[data-job="SUPPLIED_MATERIALS_INVENTORY"]'))`);
  const filename='MAINFRAME_INVENTION_DISCLOSURE_COUNSEL_READY_LOGIC_CLEAN_2_WITH_A_DELIBERATELY_LONG_UNBROKEN_MOBILE_FILENAME_1234567890.pdf';
  await fill(cdp,'[data-job="SUPPLIED_MATERIALS_INVENTORY"]',JSON.stringify([{type:'FILE',exactNameOrReference:filename}]));await click(cdp,'#save-job');
  await openStage(cdp,4);
  await evaluate(cdp,`(()=>{const next=document.querySelector('.stage-hero>.stage-action-strip>span:last-child');if(!next)return false;next.textContent='Send the Stage 04 instruction with '+${JSON.stringify(filename)}+'. The prompt does not include those materials.';return true})()`);
  for(const width of [320,393]){
    await setWidth(cdp,width);
    const state=await evaluate(cdp,`(()=>{const filename=${JSON.stringify(filename)},strip=document.querySelector('.stage-hero>.stage-action-strip'),spans=[...strip?.querySelectorAll(':scope>span')||[]],copy=document.querySelector('#copy-prompt'),prompt=document.querySelector('#generated-prompt'),nodes=[...document.querySelectorAll('.notice,.stage-hero>.stage-action-strip>span')].filter(node=>node.textContent.includes(filename));const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth};};return {innerWidth,innerHeight,documentScroll:document.documentElement.scrollWidth,bodyScroll:document.body.scrollWidth,strip:strip&&rect(strip),spans:spans.map(rect),labels:spans.map(node=>getComputedStyle(node,'::before').content),filenameNodes:nodes.map(rect),copy:copy&&rect(copy),prompt:prompt&&rect(prompt),filenamePresent:document.body.innerText.includes(filename)};})()`);
    assert(state.filenamePresent,`Long Stage 04 filename is missing at ${width}px.`);
    assert(state.documentScroll<=width+1&&state.bodyScroll<=width+1,`Document horizontally overflows at ${width}px: ${JSON.stringify(state)}`);
    assert(state.strip&&state.spans.length===2&&state.spans.every(rect=>rect.left>=-1&&rect.right<=width+1&&rect.scrollWidth<=rect.clientWidth+1),`Current state or next action is clipped at ${width}px: ${JSON.stringify(state)}`);
    assert(state.labels[0].includes('Current state:')&&state.labels[1].includes('Next:'),`State/action labels are not explicit at ${width}px: ${JSON.stringify(state.labels)}`);
    assert(state.filenameNodes.length>=1&&state.filenameNodes.every(rect=>rect.left>=-1&&rect.right<=width+1&&rect.scrollWidth<=rect.clientWidth+1),`Long filename is clipped at ${width}px: ${JSON.stringify(state.filenameNodes)}`);
    assert(state.copy&&state.copy.left>=-1&&state.copy.right<=width+1&&state.copy.height>=44,`Primary copy action is unusable at ${width}px: ${JSON.stringify(state.copy)}`);
    assert(state.prompt&&state.prompt.left>=-1&&state.prompt.right<=width+1,`Prompt box exceeds the viewport at ${width}px: ${JSON.stringify(state.prompt)}`);
  }
  await evaluate(cdp,`(async()=>{const p=closedLoopCore.createBlankState('BROWSER-ACCUMULATED-HISTORY');p.activeView='Records';p.projectData.rawResponses=Array.from({length:600},(_,i)=>({rawResponseId:'RAW-PRESSURE-'+i,stage:i%30+1,status:'PRESERVED',rawText:'H'.repeat(80000)+'é🙂TAIL-'+i}));await closedLoopProjectStore.writeProject(p);await closedLoopProjectStore.metaPut('selectedProject',p.job.JOB_ID);})()`);
  await cdp.send('Page.reload');await waitFor(cdp,`globalThis.closedLoopAppReady===true`,60000);await click(cdp,'[data-view="Records"]');
  const pressureDom=await evaluate(cdp,`({bytes:document.querySelector('#screen').innerHTML.length,nodes:document.querySelector('#screen').querySelectorAll('*').length})`);
  assert(pressureDom.bytes<100000&&pressureDom.nodes<1500,`Collapsed accumulated history was eagerly rendered: ${JSON.stringify(pressureDom)}`);
  await evaluate(cdp,`(()=>{const node=[...document.querySelectorAll('summary')].find(node=>node.textContent.includes('Raw agent responses'));node.parentElement.open=true;})()`);
  await waitFor(cdp,`Boolean(document.querySelector('[data-detail-page]'))`);
  const pagedDom=await evaluate(cdp,`({bytes:document.querySelector('#screen').innerHTML.length,nodes:document.querySelector('#screen').querySelectorAll('*').length})`);
  assert(pagedDom.bytes<150000&&pagedDom.nodes<2000,`Opening accumulated history rendered every record: ${JSON.stringify(pagedDom)}`);
  // The original section arrows also operate the bounded text inside accumulated history.
  await evaluate(cdp,`(()=>{const history=[...document.querySelectorAll('summary')].find(n=>n.textContent.startsWith('Raw agent responses')).parentElement;history.querySelector('[data-detail-id]').open=true;})()`);
  await waitFor(cdp,`[...document.querySelectorAll('summary')].some(n=>/raw.*text/i.test(n.textContent)&&n.closest('[data-detail-id]')?.querySelector('summary')===n)`);
  await evaluate(cdp,`(()=>{const text=[...document.querySelectorAll('summary')].find(n=>/raw.*text/i.test(n.textContent)&&n.closest('[data-detail-id]')?.querySelector('summary')===n);text.parentElement.open=true;})()`);
  await waitFor(cdp,`Boolean(document.querySelector('.data-text-page'))`);
  await evaluate(cdp,`(()=>{const text=document.querySelector('.data-text-page');text.scrollTop=0;text.scrollIntoView({block:'center'});dispatchEvent(new Event('scroll'));})()`);
  await waitFor(cdp,`document.querySelector('#section-bottom-jump')?.hidden===false`);
  await click(cdp,'#section-bottom-jump');
  await waitFor(cdp,`(()=>{const text=document.querySelector('.data-text-page');return text.scrollTop+text.clientHeight>=text.scrollHeight-1;})()`);
  await waitFor(cdp,`document.querySelector('#section-top-jump')?.hidden===false`);
  await click(cdp,'#section-top-jump');await waitFor(cdp,`document.querySelector('.data-text-page').scrollTop===0`);
  // Every stage shares these details and prompt controls, including Stage 03.
  for(let stage=1;stage<=30;stage++){
    await openStage(cdp,stage);
    await evaluate(cdp,`(()=>{const node=document.querySelector('#generated-prompt');if(node)node.textContent='Long preserved instruction\\n'.repeat(12000);})()`);
    if(await evaluate(cdp,`Boolean(document.querySelector('#toggle-prompt'))`)){
      await click(cdp,'#toggle-prompt');
      const bounds=await evaluate(cdp,`(()=>{const node=document.querySelector('#generated-prompt');return {height:node.getBoundingClientRect().height,viewport:innerHeight,scrollable:node.scrollHeight>node.clientHeight,overflow:getComputedStyle(node).overflowY};})()`);
      assert(bounds.height<=bounds.viewport&&bounds.scrollable&&['auto','scroll'].includes(bounds.overflow),`Stage ${stage}: expanded instruction is unbounded: ${JSON.stringify(bounds)}`);
      await evaluate(cdp,`(()=>{const node=document.querySelector('#generated-prompt');node.scrollTop=(node.scrollHeight-node.clientHeight)/2;node.scrollIntoView({block:'center'});dispatchEvent(new Event('scroll'));})()`);
      await waitFor(cdp,`document.querySelector('#prompt-top-jump')?.hidden===false&&document.querySelector('#prompt-bottom-jump')?.hidden===false`);
      await click(cdp,'#prompt-bottom-jump');await waitFor(cdp,`(()=>{const node=document.querySelector('#generated-prompt');return node.scrollTop+node.clientHeight>=node.scrollHeight-1;})()`);
      await click(cdp,'#toggle-prompt');
    }
  }
  // The same retained history must also leave through the real complete-export action.
  await evaluate(cdp,`(()=>{globalThis.__historyExportBlob=null;globalThis.__historyExportError='';globalThis.__historyCreateUrl=URL.createObjectURL;URL.createObjectURL=blob=>{globalThis.__historyExportBlob=blob;return globalThis.__historyCreateUrl(blob);};window.alert=message=>{globalThis.__historyExportError=String(message);};})()`);
  await click(cdp,'#project-actions-toggle');await click(cdp,'#export-project');
  await waitFor(cdp,`document.querySelector('#app-live-status')?.textContent==='complete project package exported'||globalThis.__historyExportError`,60000);
  assert(!(await evaluate(cdp,'globalThis.__historyExportError')),`Accumulated complete export failed: ${await evaluate(cdp,'globalThis.__historyExportError')}`);
  const historyExport=await evaluate(cdp,`(async()=>{const blob=globalThis.__historyExportBlob,payload=JSON.parse(await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text()),{packageSha256,...body}=payload,rows=payload.project.projectData.rawResponses;return {jobId:payload.project.job.JOB_ID,records:rows.length,lastRecordComplete:rows.at(-1).rawText.endsWith('é🙂TAIL-599'),rawCharacters:rows.reduce((sum,row)=>sum+row.rawText.length,0),hashVerified:closedLoopHash.sha256Value(body)===packageSha256};})()`);
  assert(historyExport.jobId==='BROWSER-ACCUMULATED-HISTORY'&&historyExport.records===600&&historyExport.lastRecordComplete&&historyExport.rawCharacters>=48000000&&historyExport.hashVerified,`Complete accumulated export lost bytes or identity: ${JSON.stringify(historyExport)}`);
  await evaluate(cdp,`(()=>{URL.createObjectURL=globalThis.__historyCreateUrl;delete globalThis.__historyExportBlob;})()`);
  await evaluate(cdp,`closedLoopProjectStore.removeProject('BROWSER-ACCUMULATED-HISTORY')`);
  console.log(JSON.stringify({all30StageAccumulatedDataViews:true,historyRecords:600,minimumRawHistoryBytes:48000000,collapsedDom:pressureDom,pagedDom,historyExport}));
  const mobileTarget=await evaluate(cdp,`(()=>{const now=Date.now(),challenge=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');return {physicalDeviceRequired:true,mobileAcceptanceTargetId:'MOBILE-TARGET-BROWSER',challenge,challengeIssuedAt:new Date(now).toISOString(),challengeExpiresAt:new Date(now+3600000).toISOString(),sourceCommit:'${'f'.repeat(40)}',deploymentManifestDigest:'${'a'.repeat(64)}',origin:location.origin,basePath:'/closed-loop-tracker/',testProjectId:'BROWSER-MOBILE-STAGE30',procedureVersion:'actual-iphone-safari/1',viewport:{width:393,height:852,devicePixelRatio:3},deviceModel:'iPhone 15',iosVersion:'19.0',safariVersion:'19.0',safariUserAgent:'Mozilla/5.0 (iPhone) Safari/604.1'};})()`);
  const browserProject=await evaluate(cdp,`(()=>globalThis.closedLoopCore.createBlankState('BROWSER-STAGE30'))()`);browserProject.activeStage=30;await evaluate(cdp,`closedLoopProjectStore.writeAll(${JSON.stringify([browserProject])}).then(()=>closedLoopProjectStore.metaPut('selectedProject','BROWSER-STAGE30'))`);await cdp.send('Page.reload');await waitFor(cdp,`globalThis.closedLoopAppReady===true`);await click(cdp,'[data-view="Workflow"]');await waitFor(cdp,`Boolean(document.querySelector('#mobile-acceptance-panel'))`);
  const sessionKey='stage30MobileAcceptance.v1:BROWSER-STAGE30';
  await fill(cdp,'#mobile-acceptance-target-json',JSON.stringify(mobileTarget));await click(cdp,'#run-mobile-capability-probe');await waitFor(cdp,`document.body.innerText.includes('PASS')`);
  const targetAfterProbe=await evaluate(cdp,`(()=>{const node=document.querySelector('#mobile-acceptance-target-json');if(!node)return null;try{return JSON.parse(node.value);}catch{return {parseFailed:true,value:node.value};}})()`);
  assert(targetAfterProbe&&!targetAfterProbe.parseFailed&&targetAfterProbe.challenge===mobileTarget.challenge&&targetAfterProbe.mobileAcceptanceTargetId===mobileTarget.mobileAcceptanceTargetId,`Pinned mobile target was lost or altered by the capability-probe rerender: ${JSON.stringify(targetAfterProbe)}`);
  await cdp.send('Page.reload');await waitFor(cdp,`globalThis.closedLoopAppReady===true`);await click(cdp,'[data-view="Workflow"]');await waitFor(cdp,`Boolean(document.querySelector('#mobile-acceptance-panel'))`);
  const targetAfterReload=await evaluate(cdp,`(()=>{const node=document.querySelector('#mobile-acceptance-target-json');if(!node)return null;try{return JSON.parse(node.value);}catch{return {parseFailed:true,value:node.value};}})()`);
  assert(targetAfterReload&&!targetAfterReload.parseFailed&&targetAfterReload.challenge===mobileTarget.challenge&&targetAfterReload.mobileAcceptanceTargetId===mobileTarget.mobileAcceptanceTargetId,`Persisted mobile target was lost or altered by a page reload: ${JSON.stringify(targetAfterReload)}`);
  await evaluate(cdp,`(()=>{globalThis.__mobileAcceptanceAlert='';window.alert=message=>{globalThis.__mobileAcceptanceAlert=String(message||'');};return true;})()`);
  await fill(cdp,'#mobile-acceptance-target-json','');await click(cdp,'#record-mobile-acceptance-measurements');
  const measurementState=await waitFor(cdp,`(async()=>{const session=await closedLoopProjectStore.metaGet(${JSON.stringify(sessionKey)});return session?.measurements?.recordedAt?{target:session.target,measurements:session.measurements}:null;})()`);
  assert(measurementState.target?.challenge===mobileTarget.challenge&&measurementState.measurements?.challenge===mobileTarget.challenge&&measurementState.measurements?.targetId===mobileTarget.mobileAcceptanceTargetId,`Post-probe measurements were not bound to the persisted target: ${JSON.stringify(measurementState)}`);
  assert(!(await evaluate(cdp,'globalThis.__mobileAcceptanceAlert')),`Post-probe measurement capture was blocked: ${await evaluate(cdp,'globalThis.__mobileAcceptanceAlert')}`);
  const targetAfterMeasurements=await evaluate(cdp,`(()=>{const node=document.querySelector('#mobile-acceptance-target-json');if(!node)return null;try{return JSON.parse(node.value);}catch{return {parseFailed:true,value:node.value};}})()`);
  assert(targetAfterMeasurements&&!targetAfterMeasurements.parseFailed&&targetAfterMeasurements.challenge===mobileTarget.challenge&&targetAfterMeasurements.mobileAcceptanceTargetId===mobileTarget.mobileAcceptanceTargetId,`Pinned mobile target was lost after measurement rerender: ${JSON.stringify(targetAfterMeasurements)}`);
  await click(cdp,'#record-mobile-acceptance-receipt');
  const receiptState=await waitFor(cdp,`(async()=>{const session=await closedLoopProjectStore.metaGet(${JSON.stringify(sessionKey)}),receipts=Array.isArray(session?.receipts)?session.receipts:[];return receipts.length?{target:session.target,receipts}:null;})()`);
  assert(receiptState.target?.challenge===mobileTarget.challenge&&receiptState.receipts.every(row=>row.challenge===mobileTarget.challenge&&row.targetId===mobileTarget.mobileAcceptanceTargetId),`Post-probe receipts were not bound to the persisted target: ${JSON.stringify(receiptState)}`);
  assert(!(await evaluate(cdp,'globalThis.__mobileAcceptanceAlert')),`Post-probe receipt capture was blocked: ${await evaluate(cdp,'globalThis.__mobileAcceptanceAlert')}`);
  const targetAfterReceipts=await evaluate(cdp,`(()=>{const node=document.querySelector('#mobile-acceptance-target-json');if(!node)return null;try{return JSON.parse(node.value);}catch{return {parseFailed:true,value:node.value};}})()`);
  assert(targetAfterReceipts&&!targetAfterReceipts.parseFailed&&targetAfterReceipts.challenge===mobileTarget.challenge&&targetAfterReceipts.mobileAcceptanceTargetId===mobileTarget.mobileAcceptanceTargetId,`Pinned mobile target was lost after receipt rerender: ${JSON.stringify(targetAfterReceipts)}`);
  const measurementsBeforeMismatch=await evaluate(cdp,`closedLoopProjectStore.metaGet(${JSON.stringify(sessionKey)}).then(session=>session?.measurements?.recordedAt||null)`);
  await evaluate(cdp,"globalThis.__mobileAcceptanceAlert=''");await fill(cdp,'#mobile-acceptance-target-json',JSON.stringify({...mobileTarget,deviceModel:'iPhone 14'}));await click(cdp,'#record-mobile-acceptance-measurements');
  await waitFor(cdp,`document.querySelector('#next-required-action > .notice')?.textContent.includes('does not match the persisted acceptance-session target')`);
  assert(!(await evaluate(cdp,'globalThis.__mobileAcceptanceAlert')),'A mismatched acceptance target opened a native popup instead of the existing inline notice.');
  const mismatchState=await evaluate(cdp,`closedLoopProjectStore.metaGet(${JSON.stringify(sessionKey)}).then(session=>({target:session?.target,recordedAt:session?.measurements?.recordedAt||null}))`);
  assert(mismatchState.target?.deviceModel===mobileTarget.deviceModel&&mismatchState.target?.challenge===mobileTarget.challenge,`Target mismatch mutated the persisted acceptance target: ${JSON.stringify(mismatchState.target)}`);
  assert(mismatchState.recordedAt===measurementsBeforeMismatch,`Target mismatch mutated persisted measurements: before=${measurementsBeforeMismatch} after=${mismatchState.recordedAt}`);
  await fill(cdp,'#mobile-acceptance-target-json',JSON.stringify(mobileTarget));
  const storageState=await evaluate(cdp,`(async()=>{const all=await closedLoopProjectStore.readAll(),project=all.find(x=>x.job?.JOB_ID==='BROWSER-STAGE30'),keys=Object.keys(project?.projectData||{}).filter(key=>['mobileAcceptanceTarget','mobileCapabilityProbe','mobileAcceptanceReceipts','mobileAcceptanceMeasurements'].includes(key));return {keys,manualReceipt:Boolean(document.querySelector('#mobile-acceptance-receipt-kind')),manualMeasurements:['#mobile-runtime-exceptions','#mobile-unhandled-rejections','#mobile-horizontal-overflow','#mobile-primary-text','#mobile-secondary-text','#mobile-touch-target'].filter(selector=>document.querySelector(selector)).length};})()`);assert(storageState.keys.length===0,`Acceptance-session data leaked into unregistered projectData keys: ${JSON.stringify(storageState.keys)}`);assert(!storageState.manualReceipt,'APPLICATION_OBSERVED mobile receipts must not be created by an operator-selected receipt-kind declaration.');assert(storageState.manualMeasurements===0,'APPLICATION_OBSERVED mobile runtime/layout measurements must be mechanically captured, not manually typed.');
  console.log(JSON.stringify({mobileStageActionRegression:true,widths:[320,393],longFilenameWrapped:true,stateAndActionExplicit:true,primaryActionReachable:true,promptVisualBaselinePreserved:true,horizontalOverflow:false,pinnedTargetSurvivesProbeRender:true,pinnedTargetSurvivesReload:true,postProbeStoredTargetIndependentOfEphemeralTextarea:true,postProbeMeasurementsRecorded:true,postProbeReceiptsRecorded:true,pinnedTargetSurvivesPostProbeRenders:true,targetMismatchRejectedWithoutMutation:true}));
  cdp.close();
}
async function cleanup(){if(!proc.killed)proc.kill('SIGTERM');await Promise.race([new Promise(resolve=>proc.once('exit',resolve)),sleep(1000)]);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}}
try{await main();}finally{await cleanup();}

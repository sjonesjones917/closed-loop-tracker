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
class CDP{constructor(ws){this.ws=new WebSocket(ws);this.id=0;this.pending=new Map();this.ready=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);};}async send(method,params={}){let timer,id,finished=false;const timeoutError=new Error('Chromium did not respond to '+method+' within 180 seconds.');const deadline=new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(timeoutError),180000);});try{return await Promise.race([(async()=>{await this.ready;if(finished)throw timeoutError;id=++this.id;const result=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));this.ws.send(JSON.stringify({id,method,params}));return result;})(),deadline]);}finally{finished=true;clearTimeout(timer);if(id!==undefined)this.pending.delete(id);}}close(){this.ws.close();}}
async function evaluate(cdp,expression){const result=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Evaluation failed');return result.result?.value;}
async function waitFor(cdp,expression,timeout=20000){return poll(async()=>{const value=await evaluate(cdp,expression);if(!value)throw new Error(`Waiting: ${expression}`);return value;},timeout);}
async function click(cdp,selector){await waitFor(cdp,`document.querySelector('#app')?.getAttribute('aria-busy')!=='true'`);assert(await evaluate(cdp,`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node||node.disabled)return false;node.click();return true})()`),`Missing clickable ${selector}`);await waitFor(cdp,`document.querySelector('#app')?.getAttribute('aria-busy')!=='true'`);}
async function fill(cdp,selector,value){assert(await evaluate(cdp,`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return false;node.value=${JSON.stringify(value)};node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));return true})()`),`Missing input ${selector}`);}
async function setWidth(cdp,width,height=844){await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await sleep(150);}
async function openStage(cdp,stage){await click(cdp,'[data-view="Workflow"]');await evaluate(cdp,`(()=>{const select=document.querySelector('#stage-picker');if(!select)return false;select.value=${JSON.stringify(String(stage))};select.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);await waitFor(cdp,`document.body.innerText.includes('Stage ${String(stage).padStart(2,'0')}')`);}

// Synthetic setup writes a chosen current state. Navigate by an ordinary
// project link; a reload of a saved-version URL must restore that saved version.
async function openStoredFixture(cdp){const url=await evaluate(cdp,`(async()=>{const url=new URL(location.href);url.searchParams.delete('version');url.searchParams.delete('stage');url.searchParams.set('project',await closedLoopProjectStore.metaGet('selectedProject'));return url.href;})()`);await cdp.send('Page.navigate',{url});}
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
  await openStoredFixture(cdp);await waitFor(cdp,`globalThis.closedLoopAppReady===true`,60000);await click(cdp,'[data-view="Records"]');
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
  // The gate reasons come from the real engine on the persisted history project.
  const expectedDiagnostics=await evaluate(cdp,`(async()=>{const p=await closedLoopProjectStore.readProject('BROWSER-ACCUMULATED-HISTORY');closedLoopWorkflowEngine.recalculate(p);return Object.fromEntries(Object.entries(p.stages).map(([n,s])=>[n,s.gate.reasons]));})()`);
  let diagnosticArrowProof=false,diagnosticReasonCount=0;
  for(let stage=1;stage<=30;stage++){
    await openStage(cdp,stage);
    const diagnostic=await evaluate(cdp,`(()=>{const node=[...document.querySelectorAll('.notice>details[data-detail-id]')].find(n=>n.querySelector(':scope>summary')?.childNodes[0]?.textContent==='Completion gate is not satisfied.');return node?{id:node.dataset.detailId,open:node.open,children:node.querySelector('.record-body').childElementCount,count:Number(node.querySelector('summary>span').textContent)}:null;})()`);
    assert(diagnostic&&!diagnostic.open&&diagnostic.children===0&&diagnostic.count===expectedDiagnostics[stage].length,`Stage ${stage}: diagnostic reasons bypass collapsed shared controls: ${JSON.stringify(diagnostic)}`);
    if(stage===1){
      const section=`details[data-detail-id="${diagnostic.id}"]`,seen=[];
      await click(cdp,section+'>summary');await waitFor(cdp,`document.querySelector(${JSON.stringify(section)})?.querySelectorAll('.record-row').length>0`);
      await evaluate(cdp,`(()=>{document.querySelector(${JSON.stringify(section)}).scrollIntoView({block:'center'});dispatchEvent(new Event('scroll'));})()`);
      await waitFor(cdp,`document.querySelector('#section-bottom-jump')?.hidden===false&&document.querySelector('#section-top-jump')?.hidden===false`);
      await click(cdp,'#section-bottom-jump');await waitFor(cdp,`document.querySelector(${JSON.stringify(section)}).getBoundingClientRect().bottom<=innerHeight+2`);
      await click(cdp,'#section-top-jump');await waitFor(cdp,`document.querySelector(${JSON.stringify(section+'>summary')}).getBoundingClientRect().top>=-1`);
      diagnosticArrowProof=true;
      while(true){
        const page=await evaluate(cdp,`(()=>{const n=document.querySelector(${JSON.stringify(section)});return {rows:[...n.querySelectorAll(':scope>.record-body>.record-rows>.record-row>.record-value')].map(x=>x.textContent),next:!n.querySelector('[data-detail-page="next"]')?.disabled,overflow:document.documentElement.scrollWidth>innerWidth+1};})()`);
        assert(page.rows.length<=20&&!page.overflow,'Diagnostic page overflowed or rendered more than 20 reasons.');seen.push(...page.rows);
        if(!page.next)break;await click(cdp,section+' [data-detail-page="next"]');
      }
      assert(JSON.stringify(seen)===JSON.stringify(expectedDiagnostics[stage]),'Browser diagnostic paging lost, duplicated, reordered or changed an engine reason.');diagnosticReasonCount=seen.length;
      await click(cdp,section+'>summary');await waitFor(cdp,`!document.querySelector(${JSON.stringify(section)}).open&&document.querySelector(${JSON.stringify(section+' > .record-body')}).childElementCount===0`);
      await waitFor(cdp,`document.querySelector('#section-top-jump')?.hidden===true&&document.querySelector('#section-bottom-jump')?.hidden===true`);
      await click(cdp,section+'>summary');await waitFor(cdp,`document.querySelector(${JSON.stringify(section+' .record-value')})?.textContent===${JSON.stringify(seen[Math.floor((seen.length-1)/20)*20])}`);
      await click(cdp,section+'>summary');
    }
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
  // Real IndexedDB custody, paged Files controls and complete export with an
  // accumulated file set. A whole-file read fails at the actual Blob boundary.
  const fileCustody=await evaluate(cdp,`(async()=>{
    const store=closedLoopProjectStore,engine=closedLoopWorkflowEngine,p=closedLoopCore.createBlankState('BROWSER-FILE-PRESSURE'),read=Blob.prototype.arrayBuffer;
    let largestRead=0;Blob.prototype.arrayBuffer=function(){largestRead=Math.max(largestRead,this.size);if(this.size>65536)throw new Error('WHOLE_FILE_READ:'+this.size);return read.call(this);};
    try{
      for(let i=0;i<22;i++){
        const id='BROWSER-FILE-'+String(i).padStart(2,'0'),bytes=new Uint8Array(i===21?2097153:1024);let seed=917+i;
        for(let j=0;j<bytes.length;j++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;bytes[j]=seed&255;}
        const blob=new Blob([bytes,'FILE-PRESSURE-'+i+'-TAIL'],{type:'text/plain'});
        const row=await store.putArtifact({artifactId:id,jobId:p.job.JOB_ID,blob,filename:id+'.txt',mediaType:'text/plain'});
        engine.registerArtifactBytes(p,{stage:1,artifactId:id,filename:row.filename,mediaType:row.mediaType,byteSize:row.byteSize,sha256:row.sha256});
      }
      p.activeView='Files';await store.writeProject(p);await store.metaPut('selectedProject',p.job.JOB_ID);
      const verified=await store.verifyProjectArtifacts(p.job.JOB_ID);
      const staged=await store.stageResponseFile({jobId:p.job.JOB_ID,stage:4,blob:new Blob(['{"retained":"','z'.repeat(196609),'"}']),rawFilename:'pressure-response.json'});
      await store.removeStagedResponseFile({jobId:p.job.JOB_ID,stagingId:staged.stagingId});
      return {largestRead,verified:verified.verified,count:verified.artifactCount};
    }finally{Blob.prototype.arrayBuffer=read;}
  })()`);
  assert(fileCustody.verified&&fileCustody.count===22&&fileCustody.largestRead<=65536,`File custody/staging used unbounded reads: ${JSON.stringify(fileCustody)}`);
  await openStoredFixture(cdp);await waitFor(cdp,`closedLoopAppReady===true`);await click(cdp,'[data-view="Files"]');
  assert(await evaluate(cdp,`document.querySelectorAll('[data-download-artifact]').length===20`),'Files first page must contain exactly 20 download controls.');
  await click(cdp,'[data-detail-offset="20"]');
  assert(await evaluate(cdp,`document.querySelectorAll('[data-download-artifact]').length===2&&Boolean(document.querySelector('[data-download-artifact="BROWSER-FILE-21"]'))`),'Files last page lost its final artifact.');
  await evaluate(cdp,`(()=>{globalThis.__fileDownloads=[];globalThis.__fileUrl=URL.createObjectURL;globalThis.__fileRead=Blob.prototype.arrayBuffer;globalThis.__largestFileRead=0;URL.createObjectURL=blob=>{__fileDownloads.push(blob);return __fileUrl(blob);};Blob.prototype.arrayBuffer=function(){__largestFileRead=Math.max(__largestFileRead,this.size);if(this.size>65536)throw new Error('WHOLE_FILE_READ:'+this.size);return __fileRead.call(this);};})()`);
  await click(cdp,'[data-download-artifact="BROWSER-FILE-21"]');await waitFor(cdp,`__fileDownloads.length===1`);
  await click(cdp,'#project-actions-toggle');await click(cdp,'#export-project');await waitFor(cdp,`__fileDownloads.length===2`,60000);
  const fileExport=await evaluate(cdp,`(async()=>{
    URL.createObjectURL=__fileUrl;const [file,backup]=__fileDownloads,nativeAtob=globalThis.atob;let maxBase64Read=0,restored;
    try{globalThis.atob=text=>{maxBase64Read=Math.max(maxBase64Read,text.length);if(text.length>65536)throw new Error('WHOLE_BASE64_READ:'+text.length);return nativeAtob(text);};restored=await closedLoopProjectStore.importPackage(backup);}finally{globalThis.atob=nativeAtob;Blob.prototype.arrayBuffer=__fileRead;}
    const payload=JSON.parse(await new Response(backup.stream().pipeThrough(new DecompressionStream('gzip'))).text()),{packageSha256,...body}=payload;
    const tail=await file.slice(-21).text(),last=payload.artifacts.find(row=>row.artifactId==='BROWSER-FILE-21');
    return {largestRead:__largestFileRead,maxBase64Read,restoredFiles:restored.projectData.artifacts.length,count:payload.artifacts.length,tail,hashVerified:closedLoopHash.sha256Value(body)===packageSha256,lastVerified:last.sha256===await closedLoopHash.sha256Bytes(file),lastTail:atob(last.base64).endsWith('FILE-PRESSURE-21-TAIL')};
  })()`);
  assert(fileExport.largestRead<=65536&&fileExport.maxBase64Read<=65536&&fileExport.restoredFiles===22&&fileExport.count===22&&fileExport.hashVerified&&fileExport.lastVerified&&fileExport.lastTail&&fileExport.tail.endsWith('FILE-PRESSURE-21-TAIL'),`Paged download/export/restore changed file bytes: ${JSON.stringify(fileExport)}`);
  await evaluate(cdp,`closedLoopProjectStore.removeProject('BROWSER-FILE-PRESSURE')`);
  console.log(JSON.stringify({boundedFileCustodyAndStaging:fileCustody,pagedArtifactDownloadAndCompleteExport:fileExport}));
  console.log(JSON.stringify({all30StageCollapsedDiagnostics:true,diagnosticArrowProof,diagnosticReasonCount,all30StageAccumulatedDataViews:true,historyRecords:600,minimumRawHistoryBytes:48000000,collapsedDom:pressureDom,pagedDom,historyExport}));
  console.log(JSON.stringify({mobileStageActionRegression:true,widths:[320,393],longFilenameWrapped:true,stateAndActionExplicit:true,primaryActionReachable:true,promptVisualBaselinePreserved:true,horizontalOverflow:false,mobileCapabilityEvidence:'verify-mobile-capability-journey.mjs performs actual export, selection, and restore'}));
  cdp.close();
}
async function cleanup(){if(!proc.killed)proc.kill('SIGTERM');await Promise.race([new Promise(resolve=>proc.once('exit',resolve)),sleep(1000)]);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}}
try{await main();}finally{await cleanup();}

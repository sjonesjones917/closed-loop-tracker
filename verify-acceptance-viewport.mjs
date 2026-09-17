import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createOperatorBrowser,digest} from './operator-browser-driver.mjs';
import {readStoreArchive} from './test-zip.mjs';
import {OBJECTIVE,responseFixture} from './operator-journey-fixtures.mjs';

// Controlling specification 39.11/39.12 and operator UX-001/002/003/013.
// Synthetic external counterpart, actual application controls and file bytes.
// This does not claim physical-device acceptance or independent human evidence.
globalThis.dispatchEvent=()=>true;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine;
const directory=path.resolve(process.env.ACCEPTANCE_VIEWPORT_EVIDENCE_DIR||'acceptance-viewport-evidence');
fs.mkdirSync(directory,{recursive:true});
const report={schema:'closed-loop-browser-cases/1',sourceCommit:process.env.GITHUB_SHA||null,basis:'SYNTHETIC_COUNTERPART_ACTUAL_BROWSER_CONTROLS_AND_FILES',physicalDeviceAcceptance:false,expected:'After input save, deep workflow reading, rejection/retry and committed acceptance, the sole next-action summary and its actual enabled primary control are fully visible and unobscured. Forward progress must not explicitly scroll upward. The assertion is not repaired by scrolling the test driver.',cases:[],complete:false};
function persist(){fs.writeFileSync(path.join(directory,'acceptance-viewport.json'),JSON.stringify(report,null,2)+'\n');}
const geometry=`(()=>{const summary=document.querySelector('#next-required-action'),control=summary?.querySelector('button,input,select'),box=node=>{if(!node)return null;const r=node.getBoundingClientRect(),s=getComputedStyle(node),x=Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)),y=Math.max(0,Math.min(innerHeight-1,r.top+r.height/2)),front=document.elementFromPoint(x,y);return {id:node.id,tag:node.tagName,classes:node.className,rect:r.toJSON(),position:s.position,top:s.top,overflowX:s.overflowX,overflowY:s.overflowY,display:s.display,disabled:Boolean(node.disabled),visible:s.display!=='none'&&s.visibility!=='hidden',unobscured:Boolean(front&&(front===node||node.contains(front))),front:front?.id||front?.className||front?.tagName};};return {width:innerWidth,height:innerHeight,scrollX,scrollY,documentOverflow:document.documentElement.scrollWidth-innerWidth,summaryCount:document.querySelectorAll('#next-required-action').length,summary:box(summary),control:box(control),ancestors:[...function*(n){for(let p=n?.parentElement;p;p=p.parentElement)yield p}(summary)].map(box),header:box(document.querySelector('.app-header')),tabs:box(document.querySelector('.view-tabs')),focused:document.activeElement?.id,action:summary?.innerText,forwardScrollCalls:globalThis.__viewportScrollCalls||[]};})()`;
function assertSurface(value,label){
 assert.equal(value.summaryCount,1,`${label}: the next action is missing or duplicated`);
 for(const [key,node]of [['summary',value.summary],['control',value.control]]){
  assert.ok(node?.visible&&node.rect.height>0,`${label}: ${key} missing or hidden`);
  assert.ok(node.rect.top>=0&&node.rect.bottom<=value.height,`ACTION_SURFACE_ORACLE ${label}: ${key} outside viewport: ${JSON.stringify(value)}`);
  assert.ok(node.unobscured,`ACTION_SURFACE_ORACLE ${label}: ${key} is obscured: ${JSON.stringify(value)}`);
 }
 assert.equal(value.control.disabled,false,`${label}: next control still disabled`);
 assert.ok(value.documentOverflow<=1,`${label}: document overflows horizontally`);
}
async function observe(browser,row,label){
 const value=await browser.evaluate(geometry);row.observations.push({label,value});persist();
 try{assertSurface(value,label);}catch(error){row.failures.push(String(error.message));}
 return value;
}
async function instruction(browser){
 const [archive]=await browser.download('#next-export-prompt-file'),members=readStoreArchive(archive.bytes);
 const bytes=name=>Buffer.from(members.find(m=>m.canonicalPath===name)?.bytes||[]);
 const manifest=JSON.parse(bytes('manifest.json').toString()),instructionBytes=bytes('instruction.txt');
 assert.equal(digest(instructionBytes),manifest.instruction.bodySha256,'Downloaded instruction bytes disagree with manifest');
 const contextFiles=manifest.contextFiles.map(file=>{const value=bytes(file.path);assert.equal(digest(value),file.sha256);assert.equal(value.length,file.byteSize);return {filename:file.path,bytes:value,sha256:digest(value)};});
 const project=await browser.readProject(),prompt=project.projectData.generatedPrompts.find(p=>p.instructionId===manifest.promptIdentity.instructionId);assert.ok(prompt);
 return responseFixture({schema,engine,prompt,manifest,contextFiles,instructionBytes});
}
async function ingest(browser,request){await browser.selectFiles('#response-json-file',[{filename:'response.json',bytes:Buffer.from(JSON.stringify(request)+'\n')}]);await browser.click('#process-response-file');}
try{
 for(const [width,height]of [[320,568],[393,852],[1280,800]]){
  const row={caseId:`ACCEPTANCE-VIEWPORT-${width}x${height}`,status:'UNVERIFIED',observations:[],faults:[],diagnostics:[],failures:[]};report.cases.push(row);let browser;
  try{
   browser=await createOperatorBrowser({directory:path.join(directory,`${width}x${height}`),width,height});
   await browser.click('#new-project');await browser.fill('[data-job="JOB_TITLE"]','Acceptance viewport regression');await browser.fill('[data-job="EXACT_USER_OBJECTIVE_VERBATIM"]',OBJECTIVE);await browser.click('#save-job');
   await observe(browser,row,'After Save');
   // Move to an actual later workflow panel; the distance comes from its DOM
   // geometry, not a stage-specific pixel offset. No scroll after observation.
   await browser.evaluate(`document.querySelector('#response-heading').scrollIntoView({block:'center'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
   await observe(browser,row,'While reading response panel');
   const original=await instruction(browser),before=await browser.readProject();
   await ingest(browser,{...original,jobId:'WRONG-PROJECT'});
   const rejected=await browser.readProject();assert.equal(rejected.projectData.acceptedChanges.length,before.projectData.acceptedChanges.length);assert.ok(rejected.projectData.responseValidations.some(r=>r.valid===false));
   await browser.click('#prepare-replacement-attempt');await observe(browser,row,'After explicit retry');
   const valid=await instruction(browser);await ingest(browser,valid);assert.ok(await browser.exists('#accept-proposal'),'Otherwise valid response did not reach review');
   // Observe native scroll APIs without changing their effects. Start recording
   // at the actual acceptance click, after the driver has exposed that control.
   await browser.evaluate(`(()=>{globalThis.__viewportScrollCalls=[];let recording=false;document.querySelector('#accept-proposal').addEventListener('click',()=>{recording=true},{capture:true,once:true});for(const name of ['scrollTo','scrollBy']){const original=window[name];window[name]=function(...args){const before=scrollY;const result=original.apply(this,args);if(recording)globalThis.__viewportScrollCalls.push({method:name,before,after:scrollY,args});return result;};}const original=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(...args){const before=scrollY;const result=original.apply(this,args);if(recording)globalThis.__viewportScrollCalls.push({method:'scrollIntoView',id:this.id,before,after:scrollY,args});return result;};})()`);
   await browser.click('#accept-proposal');
   const accepted=await browser.readProject();assert.equal(accepted.projectData.acceptedChanges.length,before.projectData.acceptedChanges.length+1,'Acceptance did not commit exactly once');
   const after=await observe(browser,row,'After accepted response');
   assert.ok(after.forwardScrollCalls.every(call=>call.after>=call.before),'FORWARD_SCROLL_ORACLE: acceptance explicitly scrolled upward');
   // One targeted mutation, no persistent project edits. Reintroduce the
   // non-scrolling body scroll container and require the viewport oracle to fail.
   // Restore the exact inline declaration even when the mutation test fails.
   const savedStyle=await browser.evaluate(`document.body.getAttribute('style')`);
   try{
    await browser.evaluate(`document.body.style.overflowX='hidden';document.querySelector('#response-heading').scrollIntoView({block:'center'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const fault=await browser.evaluate(geometry);let detected=false;
    try{assertSurface(fault,'Body overflow mutation');}catch(error){detected=/ACTION_SURFACE_ORACLE/.test(error.message);}
    row.faults.push({fault:'BODY_HIDDEN_OVERFLOW_SCROLL_CONTAINER',detected,actual:fault});assert.ok(detected,'FAULT_DETECTION_GAP: hidden-overflow mutation escaped the action-surface oracle');
   }finally{await browser.evaluate(`(()=>{const value=${JSON.stringify(savedStyle)};if(value===null)document.body.removeAttribute('style');else document.body.setAttribute('style',value);dispatchEvent(new Event('scroll'));return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);}
   await observe(browser,row,'After restoring production layout');
   // Diagnostic geometry does not change the production verdict. This isolates
   // the earliest layout authority when the production path is still failing.
   if(row.failures.length){
    const originalBody=await browser.evaluate(`document.body.getAttribute('style')`),originalScreen=await browser.evaluate(`document.querySelector('#screen').getAttribute('style')`);
    for(const variant of ['BODY_CLIP','BODY_CLIP_FLEX']){
     await browser.evaluate(`(()=>{document.body.style.overflowX='clip';${variant==='BODY_CLIP_FLEX'?"document.querySelector('#screen').style.display='flex';document.querySelector('#screen').style.flexDirection='column';":''}dispatchEvent(new Event('scroll'));return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
     row.diagnostics.push({variant,actual:await browser.evaluate(geometry)});
    }
    await browser.evaluate(`(()=>{for(const [node,value]of [[document.body,${JSON.stringify(originalBody)}],[document.querySelector('#screen'),${JSON.stringify(originalScreen)}]]){if(value===null)node.removeAttribute('style');else node.setAttribute('style',value);}dispatchEvent(new Event('scroll'));})()`);
   }
   assert.equal(browser.exceptions().length,0,'Runtime exception or browser dialog');
  }catch(error){row.failures.push(String(error.stack||error));}
  finally{if(browser){row.events=browser.events;try{await browser.inspect(Number(await browser.evaluate(`document.querySelector('#stage-picker')?.value||1`)));}catch(error){row.captureFailure=String(error.message);}await browser.close();}row.status=row.failures.length?'FAIL':'PASS';persist();console.log(JSON.stringify(row));}
 }
 report.complete=report.cases.every(row=>row.status==='PASS');process.exitCode=report.complete?0:1;
}finally{persist();console.log(JSON.stringify({acceptanceViewport:report.complete,cases:report.cases.map(row=>({caseId:row.caseId,status:row.status}))}));}

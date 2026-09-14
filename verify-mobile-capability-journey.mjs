import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createOperatorBrowser} from './operator-browser-driver.mjs';

const directory=path.resolve(process.env.MOBILE_EVIDENCE_DIR||'mobile-capability-evidence'),browser=await createOperatorBrowser({directory}),cases=[];
const record=(name,observation)=>{cases.push({name,result:'PASS',observation});console.log(JSON.stringify(cases.at(-1)));};
async function panel(){await browser.click('[data-view="Workflow"]');await browser.fill('#stage-picker',30);}
async function shownTarget(){return JSON.parse(await browser.evaluate(`document.querySelector('#mobile-acceptance-target-json').value`));}
async function probeResult(){return browser.evaluate(`(()=>{const key=[...document.querySelectorAll('#mobile-acceptance-panel .record-key')].find(node=>node.textContent.trim().toLowerCase()==='capability probe');return key?.parentElement.innerText||'';})()`);}
try{
  await panel();const page=await browser.evaluate(`({origin:location.origin,basePath:new URL('.',location.href).pathname,safariUserAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,devicePixelRatio}})`),manifest=await (await fetch(new URL('closed-loop-deployment-manifest.json',page.origin+page.basePath))).json();
  const target={...page,sourceCommit:manifest.sourceCommit,deploymentManifestDigest:manifest.manifestDigest.digest,mobileAcceptanceTargetId:'SYNTHETIC-CAPABILITY-'+randomUUID(),challenge:randomUUID().replaceAll('-','')+randomUUID().replaceAll('-',''),testProjectId:'CAPABILITY-'+randomUUID(),procedureVersion:'actual-iphone-safari/1',deviceModel:'SYNTHETIC_CHROMIUM',iosVersion:'NOT_APPLICABLE',safariVersion:'NOT_APPLICABLE',physicalDeviceRequired:false};
  await browser.fill('#mobile-acceptance-target-json',JSON.stringify(target));await browser.click('#run-mobile-capability-probe');assert.match(await browser.evaluate('document.body.innerText'),/Create the pinned test project/);record('probe cannot pass before the pinned project exists',{});
  await browser.click('#start-mobile-acceptance-project');await panel();assert.deepEqual(await shownTarget(),target);
  await browser.click('#run-mobile-capability-probe');assert.match(await probeResult(),/BLOCKED/);record('probe rejects missing actual file and restore operations',{});
  for(const role of ['RESPONSE','RETURNED','MANIFEST']){const [file]=await browser.download(`[data-mobile-probe-export="${role}"]`);await browser.selectFiles(`[data-mobile-probe-file="${role}"]`,[{filename:file.filename,bytes:file.bytes}]);record('actual exported '+role.toLowerCase()+' bytes selected',{sha256:file.sha256,byteSize:file.bytes.length});}
  const {project,file:backup}=await browser.project();assert.equal(project.job.JOB_ID,target.testProjectId);await browser.selectFiles('#import-file',[{filename:backup.filename,bytes:backup.bytes}]);await panel();assert.deepEqual(await shownTarget(),target);record('restored the selected exported backup bytes',{sha256:backup.sha256,byteSize:backup.bytes.length});
  await browser.click('#run-mobile-capability-probe');assert.match(await probeResult(),/PASS/);record('probe passes after all actual capability operations',{});
  await browser.reload();await panel();assert.deepEqual(await shownTarget(),target);assert.match(await probeResult(),/PASS/);record('pinned target and completed probe survive reload',{});
  await browser.fill('#mobile-acceptance-target-json','');await browser.click('#record-mobile-acceptance-measurements');await browser.click('#record-mobile-acceptance-receipt');assert.deepEqual(await shownTarget(),target);assert.match(await browser.evaluate('document.body.innerText'),/Acceptance operations still required/);record('only observed receipts are collected; missing journey operations remain explicit',{});
  await browser.fill('#mobile-acceptance-target-json',JSON.stringify({...target,deviceModel:'DIFFERENT'}));await browser.click('#record-mobile-acceptance-measurements');assert.match(await browser.evaluate('document.body.innerText'),/does not match the persisted acceptance-session target/);await browser.reload();await panel();assert.deepEqual(await shownTarget(),target);record('target mismatch is rejected without changing the pinned session',{});
  assert.deepEqual(browser.exceptions(),[]);await browser.inspect(30);
}catch(error){cases.push({name:'journey failure',result:'FAIL',message:error.stack,visibleState:await browser.evaluate(`document.querySelector('#mobile-acceptance-panel')?.innerText||document.body.innerText`)});try{await browser.inspect(30);}catch{}console.error(error);process.exitCode=1;}
finally{fs.writeFileSync(path.join(directory,'capability.json'),JSON.stringify({basis:'ACTUAL_CHROMIUM_FILE_TRANSPORT',physicalIPhoneAcceptance:false,cases,events:browser.events},null,2)+'\n');await browser.close();}

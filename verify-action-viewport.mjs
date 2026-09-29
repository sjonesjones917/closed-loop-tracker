import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createOperatorBrowser} from './operator-browser-driver.mjs';
import {OBJECTIVE} from './operator-journey-fixtures.mjs';

// Exact viewport acceptance values from controlling specification 39.12.
// This is synthetic Chromium evidence, not physical-iPhone acceptance.
const viewports=[[320,568],[393,852],[1280,800]];
const directory=path.resolve(process.env.VIEWPORT_EVIDENCE_DIR||'action-viewport-evidence');
fs.mkdirSync(directory,{recursive:true});
const report={basis:'ACTUAL_CHROMIUM_CONTROLS_WITH_SYNTHETIC_PROJECT_INPUT',physicalDeviceAcceptance:false,expected:'After Save and ordinary Workflow navigation, the whole actionable summary and actual next-action button are visible and unobscured without an additional test-driver scroll.',cases:[],complete:false};
const geometryExpression=`(()=>{const selectors=['.app-header','.view-tabs','#next-required-action','#next-export-prompt-file','#save-job'];const boxes=selectors.map(selector=>{const node=document.querySelector(selector);if(!node)return {selector,present:false};const rect=node.getBoundingClientRect(),style=getComputedStyle(node);const x=Math.min(innerWidth-1,Math.max(0,rect.left+rect.width/2)),y=Math.min(innerHeight-1,Math.max(0,rect.top+rect.height/2)),front=document.elementFromPoint(x,y);return {selector,present:true,rect:rect.toJSON(),text:node.innerText,disabled:Boolean(node.disabled),style:{position:style.position,display:style.display,visibility:style.visibility,scrollMarginTop:style.scrollMarginTop},centerUnobscured:Boolean(front&&(front===node||node.contains(front))),frontElement:front?.id||front?.className||front?.tagName||null};});return {width:innerWidth,height:innerHeight,scrollX,scrollY,activeElement:document.activeElement?.id||null,view:document.querySelector('[data-view][aria-selected="true"]')?.dataset.view,boxes};})()`;
function persist(){fs.writeFileSync(path.join(directory,'viewport.json'),JSON.stringify(report,null,2)+'\n');}
async function inspect(browser,label,result){const geometry=await browser.evaluate(geometryExpression);result.observations.push({label,geometry});persist();const summary=geometry.boxes.find(box=>box.selector==='#next-required-action'),button=geometry.boxes.find(box=>box.selector==='#next-export-prompt-file');assert.ok(summary?.present,`${label}: missing actionable summary`);assert.ok(button?.present,`${label}: missing actual export control`);assert.ok(summary.rect.top>=0&&summary.rect.bottom<=geometry.height,`${label}: actionable summary outside viewport: ${JSON.stringify(geometry)}`);assert.ok(button.rect.top>=0&&button.rect.bottom<=geometry.height&&!button.disabled&&button.centerUnobscured,`${label}: actual next control is outside viewport, disabled or obscured: ${JSON.stringify(geometry)}`);assert.match(summary.text,/Current state:/);assert.match(summary.text,/Who acts:/);}
try{
 for(const [width,height]of viewports){
  const result={width,height,status:'UNVERIFIED',observations:[],events:[],failure:null};report.cases.push(result);let browser;
  try{
   browser=await createOperatorBrowser({directory:path.join(directory,`${width}x${height}`),width,height});
   await browser.click('#new-project');
   await browser.fill('[data-job="JOB_TITLE"]',`Viewport regression ${width}`);
   await browser.fill('[data-job="EXACT_USER_OBJECTIVE_VERBATIM"]',OBJECTIVE);
   result.observations.push({label:'Before Save',geometry:await browser.evaluate(geometryExpression)});
   await browser.click('#save-job');
   await inspect(browser,'After Save',result);
   const saved=await browser.readProject();assert.equal(saved.job.EXACT_USER_OBJECTIVE_VERBATIM,OBJECTIVE,'Save did not persist the exact input');
   await browser.click('[data-view="Project"]');
   await browser.click('[data-view="Workflow"]');
   await inspect(browser,'After ordinary Workflow navigation',result);
   assert.equal(browser.exceptions().length,0,'The operator path raised a runtime exception or dialog');
   result.status='PASS';
  }catch(error){result.status='FAIL';result.failure=String(error.stack||error);process.exitCode=1;}
  finally{if(browser){result.events=browser.events;try{const stage=Number(await browser.evaluate(`document.querySelector('#stage-picker')?.value||1`));await browser.inspect(stage);}catch(error){result.screenshotFailure=String(error.message);}await browser.close();}persist();}
 }
 report.complete=report.cases.every(row=>row.status==='PASS');
}finally{persist();console.log(JSON.stringify(report,null,2));}

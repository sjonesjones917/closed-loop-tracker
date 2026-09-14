// Disposable driver cases executed in the existing Chromium CI browser.
import assert from 'node:assert/strict';
import {clickVisibleControl} from './browser-interactions.mjs';
export async function verifyBrowserInteractions(cdp){
  async function read(expression){const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
  const root='clrt-disposable-driver-check',cases=[];
  await read(`(()=>{const root=document.createElement('div');root.id='${root}';root.style.cssText='position:fixed;inset:0;z-index:2147483647;background:white;color:black;overflow:auto;';root.innerHTML='<button id="driver-visible" style="display:block;width:150px;height:50px">Visible</button><button id="driver-hidden" style="display:none">Hidden</button><div style="position:relative;width:160px;height:60px"><button id="driver-covered" style="width:150px;height:50px">Covered</button><div style="position:absolute;inset:0;background:white"></div></div><button id="driver-disabled" disabled>Disabled</button><details id="driver-details"><summary style="height:50px">Open</summary><button id="driver-nested" style="height:50px">Nested</button></details>';root.addEventListener('click',event=>{if(event.target.tagName==='BUTTON'){event.target.dataset.count=String(Number(event.target.dataset.count||0)+1);event.target.dataset.trusted=String(event.isTrusted);}});document.body.append(root);return true;})()`);
  const clicks=id=>read(`Number(document.querySelector('#'+${JSON.stringify(id)}).dataset.count||0)`);
  async function rejectHidden(click){await assert.rejects(()=>click(cdp,'#driver-hidden'),/HIDDEN_CONTROL/,'A hidden control must be rejected by the operator driver.');assert.equal(await clicks('driver-hidden'),0);}
  try{
    await clickVisibleControl(cdp,'#driver-visible');assert.equal(await clicks('driver-visible'),1);assert.equal(await read(`document.querySelector('#driver-visible').dataset.trusted`),'true');cases.push({id:'visible-control-real-pointer',result:'PASS'});
    await rejectHidden(clickVisibleControl);cases.push({id:'hidden-control-rejected',result:'PASS'});
    await assert.rejects(()=>clickVisibleControl(cdp,'#driver-covered'),/OBSTRUCTED_CONTROL/);assert.equal(await clicks('driver-covered'),0);cases.push({id:'covered-control-rejected',result:'PASS'});
    await assert.rejects(()=>clickVisibleControl(cdp,'#driver-disabled'),/DISABLED_CONTROL/);assert.equal(await clicks('driver-disabled'),0);cases.push({id:'disabled-control-rejected',result:'PASS'});
    await clickVisibleControl(cdp,'#driver-nested');assert.equal(await clicks('driver-nested'),1);assert.equal(await read(`document.querySelector('#driver-details').open`),true);cases.push({id:'closed-disclosure-opened-through-pointer',result:'PASS'});
    // Reintroduce the previous driver: this deliberately activates a hidden
    // button. The same rejection oracle must fail, not merely return a flag.
    const domClick=async(_cdp,selector)=>read(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await assert.rejects(()=>rejectHidden(domClick),/Missing expected rejection/);assert.equal(await clicks('driver-hidden'),1);cases.push({id:'previous-dom-click-fault-detected',result:'PASS'});
    await read(`document.querySelector('#driver-hidden').dataset.count='0'`);await rejectHidden(clickVisibleControl);cases.push({id:'restored-driver-rejects-hidden',result:'PASS'});
    return {browserInteractionDriver:'PASS',cases,physicalTouchOrKeyboardAcceptance:false};
  }finally{await read(`document.querySelector('#${root}')?.remove()`);}
}

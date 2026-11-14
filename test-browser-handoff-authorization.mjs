import assert from 'node:assert/strict';

// Explicit, disposable-fixture-only operator decisions through rendered form
// controls. No canonical writes, policy bypass, or claim of genuine human acts.
// Callers retain their existing ZIP/response/byte assertions independently.
export async function downloadSyntheticHandoff(browser,selector,{syntheticProject=false,action=null,scanInspection=null,recipient='Synthetic isolated verifier actor',provider='Synthetic local verifier context',suitabilityBasis='Only this declared disposable fixture is supplied to an isolated verifier; no actual private user data or external transfer is involved.'}={}){
 assert.equal(syntheticProject,true,'SYNTHETIC_HANDOFF_BROWSER_SETUP: explicitly identify an isolated synthetic project.');
 return browser.captureDownloads(async()=>{
  await browser.click(selector);
  // There are two distinct registered decisions, not an unbounded retry loop.
  // Action authorization can change the files that disclosure must then review.
  for(let step=0;step<2&&await browser.exists('#handoff-review');step++){
   assert.equal(await browser.exists('#authorize-handoff'),true,'SYNTHETIC_HANDOFF_BROWSER_SETUP: the selected material cannot be authorized.');
   const purposes=await browser.evaluate(`[...document.querySelectorAll('#handoff-review input[id^="handoff-purpose-"]:checked')].map(node=>node.value)`);
   assert.ok(purposes.length,'SYNTHETIC_HANDOFF_BROWSER_SETUP: no required decision was selected by the application.');
   for(const [key,value]of Object.entries({recipient,provider,suitabilityBasis}))if(await browser.exists('#handoff-'+key))await browser.fill('#handoff-'+key,value);
   if(purposes.includes('EXTERNAL_ACTION_RISK_AUTHORIZATION')){
    assert.ok(action,'SYNTHETIC_HANDOFF_BROWSER_SETUP: this fixture must declare its actual disposable action contract.');
    for(const [key,value]of Object.entries(action)){
     if(key==='riskClasses'){
      assert.ok(Array.isArray(value)&&value.length,'The fixture must declare its exact risk classes.');
      const selected=await browser.evaluate(`(()=>{const node=document.querySelector('#handoff-riskClasses'),values=${JSON.stringify(value)};if(!node||values.some(value=>![...node.options].some(option=>option.value===value)))return false;for(const option of node.options)option.selected=values.includes(option.value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
      assert.equal(selected,true,'The rendered action control must support the declared risk classes.');
     }else await browser.fill('#handoff-action-'+key,value);
    }
   }
   if(await browser.exists('#handoff-inspection-classification')){
    assert.ok(scanInspection,'SYNTHETIC_HANDOFF_BROWSER_SETUP: inspect the fixture marker bytes and declare the exact noncredential basis.');
    await browser.fill('#handoff-inspection-classification',scanInspection.classification);await browser.fill('#handoff-inspection-basis',scanInspection.basis);
   }
   await browser.fill('#handoff-operator','SYNTHETIC_TEST_OPERATOR');
   if(!(await browser.evaluate(`document.querySelector('#handoff-confirmed')?.checked===true`)))await browser.click('#handoff-confirmed');
   await browser.click('#authorize-handoff');
   browser.events.push({operation:'syntheticHandoffDecisionViaControls',purposes:purposes.includes('EXTERNAL_ACTION_RISK_AUTHORIZATION')?['EXTERNAL_ACTION_RISK_AUTHORIZATION']:purposes,operatorLabel:'SYNTHETIC_TEST_OPERATOR',syntheticHumanDecision:true,actualExternalTransfer:false});
  }
  assert.equal(await browser.exists('#handoff-review'),false,'SYNTHETIC_HANDOFF_BROWSER_SETUP: the saved decisions did not allow their current unchanged handoff.');
 });
}

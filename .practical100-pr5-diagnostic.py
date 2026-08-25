from pathlib import Path

for name in ['verify-browser.mjs','verify-browser-extra.mjs']:
    p=Path(name);s=p.read_text()
    marker="await fill(cdp,'#stage-output',JSON.stringify(envelope));await click(cdp,'#parse-output');await waitExpr(cdp,`document.body.innerText.includes('Proposed extracted changes')`);"
    if marker in s:
        replacement="""await fill(cdp,'#stage-output',JSON.stringify(envelope));await click(cdp,'#parse-output');await sleep(400);try{await cdp.send('Page.handleJavaScriptDialog',{accept:true});}catch{}const proposalReady=await evalValue(cdp,`document.body.innerText.includes('Proposed extracted changes')`);if(!proposalReady){const diagnostic=await evalValue(cdp,`(async()=>{const id=document.querySelector('#current-project-summary')?.textContent?.split(' · ')[0],all=await globalThis.closedLoopProjectStore.readAll(),p=all.find(x=>x.job?.JOB_ID===id)||all[0];return {projectRevision:p?.revision,prompt:p?.projectData?.generatedPrompts?.filter(x=>Number(x.stage)===2).at(-1),validation:p?.projectData?.responseValidations?.at(-1),raw:p?.projectData?.rawResponses?.at(-1),appError:globalThis.closedLoopAppError};})()`);throw new Error('Stage 02 proposal diagnostic: '+JSON.stringify(diagnostic));}"""
        s=s.replace(marker,replacement,1)
    p.write_text(s)

from pathlib import Path
p=Path('verify-browser-extra.mjs')
t=p.read_text()
old="const envelope={schema:'closed-loop-stage-response/2',"
new="const envelope={schema:'closed-loop-stage-response/3',"
if old not in t:
    raise SystemExit('Expected legacy /2 proposal fixture not found')
t=t.replace(old,new,1)
t=t.replace("await waitExpr(cdp,`document.body.innerText.includes('Proposed extracted changes')`);retained=await activeProject(cdp);assert(retained.projectData.sources.length===0,'Pending proposal mutated canonical state.');", "await waitExpr(cdp,`Boolean(document.querySelector('#proposal-heading'))`);retained=await activeProject(cdp);assert(retained.projectData.sources.length===0,'Pending proposal mutated canonical state.');",1)
t=t.replace("await openStage(cdp,2);await waitExpr(cdp,`document.body.innerText.includes('Proposed extracted changes')`);retained=await activeProject(cdp);", "await openStage(cdp,2);await waitExpr(cdp,`Boolean(document.querySelector('#proposal-heading'))`);retained=await activeProject(cdp);",1)
p.write_text(t)

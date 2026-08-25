from pathlib import Path
# The bundled retained project is the supported human-project/30 migration input.
p=Path('app-core.js');s=p.read_text()
old="function importSeed(raw){if(raw?.schema!==core.SCHEMA)throw new Error('Bundled project must use the 30-stage project schema.');if(raw.stages)return ensureState(raw);"
new="function importSeed(raw){if(![core.SCHEMA,'human-project/30'].includes(raw?.schema))throw new Error('Bundled project must use a supported 30-stage project schema.');if(raw.stages)return ensureState(raw.schema===core.SCHEMA?raw:core.migrateState(raw));"
assert old in s;s=s.replace(old,new,1);p.write_text(s)

p=Path('verify-browser.mjs');s=p.read_text()
old="assert(await evalValue(cdp,`[...document.querySelectorAll('#project-picker option')].filter(o=>o.textContent.includes('Mobile Closed-Loop Agent Reliability Workbook')).length===1`),'Retained project missing or duplicated in clean state.');"
new="assert((await allProjects(cdp)).filter(p=>p.job?.JOB_ID==='JOB-20260823144121').length===1,'Retained project missing or duplicated in clean state.');"
assert old in s;s=s.replace(old,new,1)
old="assert(await evalValue(cdp,`[...document.querySelectorAll('#project-picker option')].some(o=>o.textContent.includes('Legitimate Browser Project'))`),'Existing legitimate project was destroyed during retained-project reconciliation.');"
new="assert((await allProjects(cdp)).some(p=>p.job?.JOB_ID===userJob&&p.job?.JOB_TITLE==='Legitimate Browser Project'),'Existing legitimate project was destroyed during retained-project reconciliation.');"
assert old in s;s=s.replace(old,new,1)
old="assert(await evalValue(cdp,`[...document.querySelectorAll('#project-picker option')].filter(o=>o.textContent.includes('Mobile Closed-Loop Agent Reliability Workbook')).length===1`),'Retained project duplicated after existing-state reload.');"
new="assert((await allProjects(cdp)).filter(p=>p.job?.JOB_ID==='JOB-20260823144121').length===1,'Retained project duplicated after existing-state reload.');"
assert old in s;s=s.replace(old,new,1)
p.write_text(s)

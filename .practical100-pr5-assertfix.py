from pathlib import Path
import re

# The bundled retained project is the supported human-project/30 migration input.
p=Path('app-core.js');s=p.read_text()
old="function importSeed(raw){if(raw?.schema!==core.SCHEMA)throw new Error('Bundled project must use the 30-stage project schema.');if(raw.stages)return ensureState(raw);"
new="function importSeed(raw){if(![core.SCHEMA,'human-project/30'].includes(raw?.schema))throw new Error('Bundled project must use a supported 30-stage project schema.');if(raw.stages)return ensureState(raw.schema===core.SCHEMA?raw:core.migrateState(raw));"
assert old in s;s=s.replace(old,new,1)

# Loading is read-only unless a bundled migration seed or a new blank project must actually be inserted.
match=re.search(r"async function load\(\)\{.*?\}\n\$\('#project-picker'\)",s,re.S)
assert match
new_load=r'''async function load(){core=globalThis.closedLoopCore;schema=globalThis.closedLoopWorkflowSchema;engine=globalThis.closedLoopWorkflowEngine;ingestion=globalThis.closedLoopResponseIngestion;projectStore=globalThis.closedLoopProjectStore;if(!core||!schema||!engine||!ingestion||!projectStore)throw new Error('Closed-loop runtime modules did not load.');await projectStore.ready;projects=(await projectStore.readAll()).filter(Boolean).map(normalize);let needsPersist=false;try{const res=await fetch(`TEST_PROJECT.json?retained=${Date.now()}`,{cache:'no-store'});if(!res.ok)throw new Error(`HTTP ${res.status}`);let test=importSeed(await res.json()),i=projects.findIndex(p=>p.isRetainedTestProject||p.job.JOB_ID===test.job.JOB_ID);if(i>=0){const stored=projects[i];projects.splice(i,1);if(stored.retainedSpecRevision&&stored.retainedSpecRevision===test.retainedSpecRevision)test=stored;else needsPersist=true;}else needsPersist=true;projects.unshift(test);}catch(error){console.error('Bundled retained project could not load',error);}if(!projects.length){projects=[ensureState(core.createBlankState(createUniqueJobId()))];needsPersist=true;}current=projects[0];if(needsPersist){const selectedId=current.job.JOB_ID;projects=await projectStore.writeAll(projects);current=projects.find(p=>p.job?.JOB_ID===selectedId)||projects[0];}const health=await projectStore.storageHealth();globalThis.closedLoopStorageHealth=health;const node=$('#storage-status');if(node)node.textContent=`Storage: ${health.persistent?'persistent':'not persistent'} · ${health.usage??'unknown'} / ${health.quota??'unknown'} bytes · revision ${health.lastCommittedRevision?.revision??current.revision??0}`;render();}
$('#project-picker')'''
s=s[:match.start()]+new_load+s[match.end():]
p.write_text(s)

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

# A plain reload must not mutate the project revision or stale a pending proposal.
p=Path('verify-browser-extra.mjs');s=p.read_text()
old="retained=await activeProject(cdp);assert(retained.projectData.sources.length===0,'Pending proposal mutated canonical state.');\n  await evalValue(cdp,`location.reload();true`)"
new="retained=await activeProject(cdp);assert(retained.projectData.sources.length===0,'Pending proposal mutated canonical state.');const pendingRevision=retained.revision;\n  await evalValue(cdp,`location.reload();true`)"
assert old in s;s=s.replace(old,new,1)
old="retained=await activeProject(cdp);assert(retained.projectData.sources.length===0&&retained.projectData.responseProposals.some(x=>x.status==='PENDING_OPERATOR_REVIEW'),'Pending proposal did not survive reload exactly.');"
new="retained=await activeProject(cdp);assert(Number(retained.revision)===Number(pendingRevision),'Reload changed the project revision and staled the pending proposal.');assert(retained.projectData.sources.length===0&&retained.projectData.responseProposals.some(x=>x.status==='PENDING_OPERATOR_REVIEW'),'Pending proposal did not survive reload exactly.');"
assert old in s;s=s.replace(old,new,1)
p.write_text(s)

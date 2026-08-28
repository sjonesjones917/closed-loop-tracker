from pathlib import Path

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing hardening anchor: {label}')
    return text.replace(old,new,1)

# Keep browser-local project lifecycle metadata in the same deletion transaction as project and Blob custody.
p=Path('project-store.js'); s=p.read_text()
old="""    const selected=await request(meta.get('selectedProject'));if(String(selected?.value||'')===jobId){if(replacementSelectedProjectId)meta.put({key:'selectedProject',value:replacementSelectedProjectId,updatedAt:now()});else meta.delete('selectedProject');}\n    const lastCommitted=await request(meta.get('lastCommittedRevision'));if(String(lastCommitted?.value?.jobId||'')===jobId)meta.delete('lastCommittedRevision');\n    fault('during-project-delete');"""
new="""    const selected=await request(meta.get('selectedProject'));if(String(selected?.value||'')===jobId){if(replacementSelectedProjectId)meta.put({key:'selectedProject',value:replacementSelectedProjectId,updatedAt:now()});else meta.delete('selectedProject');}\n    const projectUiRow=await request(meta.get('projectUi'));if(projectUiRow?.value&&typeof projectUiRow.value==='object'&&!Array.isArray(projectUiRow.value)&&Object.prototype.hasOwnProperty.call(projectUiRow.value,jobId)){const nextProjectUi=clone(projectUiRow.value);delete nextProjectUi[jobId];meta.put({key:'projectUi',value:nextProjectUi,updatedAt:now()});}\n    const lastCommitted=await request(meta.get('lastCommittedRevision'));if(String(lastCommitted?.value?.jobId||'')===jobId)meta.delete('lastCommittedRevision');\n    fault('during-project-delete');"""
s=replace_once(s,old,new,'atomic projectUi deletion')
p.write_text(s)

p=Path('app-core.js'); s=p.read_text()
old="async function addNew(){const p=ensureState(core.createBlankState(createUniqueJobId()));p.job.DATE_OPENED=new Date().toISOString();p.activeView='Project';engine.createNewJobReset(p);const next=[p,...projects];await persistAll(next);current=projects.find(x=>x.job?.JOB_ID===p.job.JOB_ID)||p;render();}"
new="async function addNew(){const p=ensureState(core.createBlankState(createUniqueJobId()));p.job.DATE_OPENED=new Date().toISOString();p.activeView='Project';engine.createNewJobReset(p);const next=[p,...projects];await persistAll(next);current=projects.find(x=>x.job?.JOB_ID===p.job.JOB_ID)||p;await refreshProjectStorage();render();}"
s=replace_once(s,old,new,'new project storage refresh')
old="projects=(await projectStore.readAll()).filter(Boolean).map(normalize);current=projects.find(project=>project.job?.JOB_ID===replacement.job.JOB_ID)||projects[0];\n    if(!current)throw new Error('No replacement project was available after deletion.');"
new="projects=(await projectStore.readAll()).filter(Boolean).map(normalize);projectUi=await projectStore.metaGet('projectUi')||{};current=projects.find(project=>project.job?.JOB_ID===replacement.job.JOB_ID)||projects[0];\n    if(!current)throw new Error('No replacement project was available after deletion.');await refreshProjectStorage();"
s=replace_once(s,old,new,'deleted project management metadata refresh')
p.write_text(s)

# Strengthen the focused static proof to require atomic management-metadata cleanup.
p=Path('apply-lifecycle-patch.py'); s=p.read_text()
old="assert(store.includes(\"openTransaction([PROJECTS,ARTIFACTS,META],'readwrite')\")&&store.includes('during-project-delete')&&store.includes('String(artifact.jobId)===jobId'),'Project deletion must remain one transaction over project/meta and owned artifact Blob rows.');"
new="assert(store.includes(\"openTransaction([PROJECTS,ARTIFACTS,META],'readwrite')\")&&store.includes('during-project-delete')&&store.includes('String(artifact.jobId)===jobId')&&store.includes(\"meta.get('projectUi')\")&&store.includes('delete nextProjectUi[jobId]'),'Project deletion must remain one transaction over project/meta, lifecycle metadata, and owned artifact Blob rows.');"
s=replace_once(s,old,new,'lifecycle deletion proof')
p.write_text(s)

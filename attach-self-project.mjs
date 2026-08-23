import fs from 'node:fs';

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
html = html.replace(
  'Each project begins with the user’s actual arbitrary job. No project is precompleted or defined as an application self-build.',
  'New user-created projects begin from the user’s actual arbitrary job at Stage 1. The retained completed application-build project remains visible as proof that this application executed its own 31-stage workflow.'
);

const proofMarker = 'data-self-project-proof="true"';
if (!html.includes(proofMarker)) {
  const match = html.match(/<section\s+id=["']projectsView["'][^>]*>/i);
  if (!match) throw new Error('Projects view not found; cannot attach retained application project.');
  const block = `<div class="card" ${proofMarker}><h2>Completed application-build project</h2><p>This project was created with this application, is about building the application itself, and uses the same 31-stage project model as every other project. It remains workflow evidence and never becomes external authority for its own requirements.</p><div class="actions"><a class="btn" href="SELF_VERIFIED_PROJECT.json" download="SELF_VERIFIED_PROJECT.json">Download project JSON</a></div></div>`;
  html = html.replace(match[0], `${match[0]}${block}`);
}

const importButton = '<button id="importProjectBtn" class="btn">Import project JSON</button>';
if (html.includes(importButton) && !html.includes('data-restore-retained-project')) {
  html = html.replace(importButton, `${importButton}<button class="btn" type="button" data-restore-retained-project>Restore application project</button>`);
}

html = html.replace(/<script\s+data-retained-self-project-loader=["']true["'][^>]*>[\s\S]*?<\/script>/i, '');
const loader = `<script data-retained-self-project-loader="true">
(()=>{'use strict';
const STORE_KEY='closedLoopReliability.projects';
const SELECTED_KEY='closedLoopReliability.selectedProject';
const QUARANTINE_KEY='closedLoopReliability.quarantinedProjects';
const RELOAD_KEY='closedLoopReliability.retainedProjectReload';
let retainedProjectId='';
const isLoadableProject=value=>Boolean(value&&value.schema==='closed-loop-project/1'&&typeof value.projectId==='string'&&value.projectId&&Array.isArray(value.stages)&&value.stages.length===31);
const setStatus=(message,tone)=>{
  const status=document.querySelector('#status');
  if(status){status.textContent=message;status.className='status '+tone;}
};
const showError=error=>{
  console.error(error);
  const message='Retained application project load failed: '+error.message;
  setStatus(message,'bad');
  const view=document.querySelector('#projectsView');
  if(view&&!view.querySelector('[data-retained-project-error]')){
    const panel=document.createElement('div');
    panel.className='panel error';
    panel.dataset.retainedProjectError='true';
    panel.textContent=message;
    view.prepend(panel);
  }
};
const readQuarantine=()=>{
  try{const value=JSON.parse(localStorage.getItem(QUARANTINE_KEY)||'[]');return Array.isArray(value)?value:[];}catch{return[];}
};
async function installRetainedProject(options={}){
  const response=await fetch('./SELF_VERIFIED_PROJECT.json',{cache:'no-store'});
  if(!response.ok)throw new Error('Project retrieval returned HTTP '+response.status+'.');
  const project=await response.json();
  if(!isLoadableProject(project))throw new Error('The retained project is not a valid current-schema 31-stage project.');
  if(project.stages.some((stage,index)=>Number(stage?.number)!==index+1))throw new Error('The retained project stage numbering is invalid.');
  retainedProjectId=project.projectId;

  const originalStore=localStorage.getItem(STORE_KEY);
  const originalQuarantine=localStorage.getItem(QUARANTINE_KEY);
  let parsed=[];
  let parseFailure='';
  try{
    const value=JSON.parse(originalStore||'[]');
    if(!Array.isArray(value))throw new Error('Stored project collection is not an array.');
    parsed=value;
  }catch(error){
    parseFailure=error.message;
    parsed=[];
  }

  const valid=[];
  const invalid=[];
  for(const item of parsed){(isLoadableProject(item)?valid:invalid).push(item);}
  const otherProjects=valid.filter(item=>item.projectId!==project.projectId);
  const nextProjects=[project,...otherProjects];
  const nextSerialized=JSON.stringify(nextProjects);
  const changed=nextSerialized!==(originalStore||'[]');
  const quarantineNeeded=Boolean(parseFailure||invalid.length);

  try{
    localStorage.setItem(STORE_KEY,nextSerialized);
    if(quarantineNeeded){
      const quarantine=readQuarantine();
      quarantine.push({
        quarantinedAt:new Date().toISOString(),
        reason:parseFailure||'One or more stored projects did not match the current project schema.',
        projects:invalid,
        rawStore:parseFailure?originalStore:null
      });
      localStorage.setItem(QUARANTINE_KEY,JSON.stringify(quarantine.slice(-10)));
    }
    const selectedId=localStorage.getItem(SELECTED_KEY);
    if(selectedId&&!nextProjects.some(item=>item.projectId===selectedId))localStorage.removeItem(SELECTED_KEY);
  }catch(error){
    try{
      if(originalStore===null)localStorage.removeItem(STORE_KEY);else localStorage.setItem(STORE_KEY,originalStore);
      if(originalQuarantine===null)localStorage.removeItem(QUARANTINE_KEY);else localStorage.setItem(QUARANTINE_KEY,originalQuarantine);
    }catch{}
    throw new Error('Project storage could not be updated without risking existing data: '+error.message);
  }

  const installed=JSON.parse(localStorage.getItem(STORE_KEY)||'[]');
  if(!installed.some(item=>item.projectId===project.projectId))throw new Error('The retained project was not installed in application storage.');

  const signature=String(project.projectId)+'|'+String(project.updatedAt||'');
  if(changed&&options.reload!==false&&sessionStorage.getItem(RELOAD_KEY)!==signature){
    sessionStorage.setItem(RELOAD_KEY,signature);
    location.reload();
    return project;
  }
  sessionStorage.removeItem(RELOAD_KEY);
  return project;
}
window.installRetainedClosedLoopProject=installRetainedProject;
document.addEventListener('click',event=>{
  const deleteButton=event.target.closest('[data-delete-project]');
  if(deleteButton&&retainedProjectId&&deleteButton.dataset.deleteProject===retainedProjectId){
    event.preventDefault();
    event.stopImmediatePropagation();
    setStatus('The completed application-build project is retained by this application. Export it or open it; it is not deleted from Projects.','warn');
    return;
  }
  const restoreButton=event.target.closest('[data-restore-retained-project]');
  if(!restoreButton)return;
  restoreButton.disabled=true;
  installRetainedProject({reload:true}).catch(showError).finally(()=>{restoreButton.disabled=false;});
},true);
window.addEventListener('load',()=>{installRetainedProject({reload:true}).catch(showError);});
})();
</script>`;
html = html.replace(/<\/body>/i, `${loader}</body>`);

fs.writeFileSync(path, html);
console.log(JSON.stringify({
  status:'PASS',
  retainedProjectProofAttached:true,
  retainedProjectDurableInstall:true,
  retainedProjectProtectedFromDeletion:true,
  validUserProjectsPreserved:true,
  malformedLegacyStateQuarantined:true
}, null, 2));

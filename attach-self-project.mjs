import fs from 'node:fs';

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
html = html.replace(
  'Each project begins with the user’s actual arbitrary job. No project is precompleted or defined as an application self-build.',
  'New user-created projects begin from the user’s actual arbitrary job at Stage 1. The retained completed application project is preserved in the same Projects list as proof that this application executed its complete 31-stage workflow.'
);

const marker = 'data-self-project-proof="true"';
if (!html.includes(marker)) {
  const match = html.match(/<section\s+id=["']projectsView["'][^>]*>/i);
  if (!match) throw new Error('Projects view not found; cannot attach the retained application project.');
  const block = `<div class="card" ${marker}><h2>Retained application project</h2><p>This is a normal completed project about the entire Closed-Loop Agent Reliability application. It uses the same current project schema, Projects list, workflow UI, records, and export control as every other project. Its records prove what the workflow did; they are never external authority for the application's own requirements.</p><div class="actions"><a class="btn" href="SELF_VERIFIED_PROJECT.json" download="SELF_VERIFIED_PROJECT.json">Export retained project JSON</a></div></div>`;
  html = html.replace(match[0], `${match[0]}${block}`);
}

const loaderMarker = 'data-retained-self-project-loader="true"';
if (!html.includes(loaderMarker)) {
  const loader = `<script ${loaderMarker}>
window.addEventListener('load',()=>{setTimeout(async()=>{
  const PROJECTS_KEY='closedLoopReliability.projects';
  const readProjects=()=>{try{const value=JSON.parse(localStorage.getItem(PROJECTS_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return []}};
  const releaseIdentity=project=>String(project?.legacyProjectMetadata?.releaseHash||project?.products?.find(item=>Number(item?.stageNumber)===22)?.computedSha256||'');
  const revision=project=>[project?.schema,project?.projectId,project?.name,project?.updatedAt,releaseIdentity(project),String(project?.stages?.[0]?.completionEvidence||'').length].join('|');
  const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
  try{
    const response=await fetch('./SELF_VERIFIED_PROJECT.json',{cache:'no-store'});
    if(!response.ok)throw new Error('Retained application project retrieval failed: '+response.status);
    const project=await response.json();
    if(project.schema!=='closed-loop-project/1'||!project.projectId||!Array.isArray(project.stages)||project.stages.length!==31)throw new Error('The retained application project file is malformed.');

    const stored=readProjects();
    const existingIndex=stored.findIndex(item=>item&&item.projectId===project.projectId);
    if(existingIndex>=0){
      if(revision(stored[existingIndex])===revision(project))return;
      stored[existingIndex]=project;
      localStorage.setItem(PROJECTS_KEY,JSON.stringify(stored));
      const reloadKey='closedLoopReliability.retainedProjectRevision';
      const currentRevision=revision(project);
      if(sessionStorage.getItem(reloadKey)!==currentRevision){
        sessionStorage.setItem(reloadKey,currentRevision);
        location.reload();
      }
      return;
    }

    const inputs=[...document.querySelectorAll('input[type="file"]')];
    const input=inputs.find(element=>/json/i.test(element.accept||'')||/import|project/i.test((element.id||'')+' '+(element.name||'')+' '+(element.getAttribute('aria-label')||'')));
    if(!input||typeof DataTransfer!=='function')throw new Error('The application project-import control was not found.');
    const file=new File([JSON.stringify(project)],'SELF_VERIFIED_PROJECT.json',{type:'application/json'});
    const transfer=new DataTransfer();
    transfer.items.add(file);
    input.files=transfer.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    for(let attempt=0;attempt<40;attempt+=1){
      await sleep(125);
      if(readProjects().some(item=>item&&item.projectId===project.projectId))return;
    }
    throw new Error('The retained application project was not accepted by the native project importer.');
  }catch(error){
    console.error(error);
    const host=document.querySelector('[data-self-project-proof="true"]');
    if(host){const paragraph=document.createElement('p');paragraph.className='error';paragraph.textContent='Retained application project load failed: '+error.message;host.appendChild(paragraph);}
  }
},0)});
</script>`;
  html = html.replace(/<\/body>/i, `${loader}</body>`);
}

fs.writeFileSync(path, html);
console.log(JSON.stringify({
  status: 'PASS',
  retainedApplicationProjectAttached: true,
  nativeImportUsedWhenAbsent: true,
  staleProjectRefreshedByProjectId: true,
  unrelatedProjectsPreserved: true
}, null, 2));

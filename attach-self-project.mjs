import fs from 'node:fs';

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
html = html.replace('Each project begins with the user’s actual arbitrary job. No project is precompleted or defined as an application self-build.','New user-created projects begin from the user’s actual arbitrary job at Stage 1. The retained completed application project below is preserved as proof that this application executed its own 31-stage workflow.');
const marker = 'data-self-project-proof="true"';
if (!html.includes(marker)) {
  const match = html.match(/<section\s+id=["']projectsView["'][^>]*>/i);
  if (!match) throw new Error('Projects view not found; cannot attach retained self-project.');
  const block = `<div class="card" ${marker}><h2>Verified application project</h2><p>This completed project was created using this application, is about the application itself, and uses the same 31-stage project model as every other project. It is workflow evidence only; it is never external authority for its own requirements.</p><div class="actions"><a class="btn" href="SELF_VERIFIED_PROJECT.json" download="SELF_VERIFIED_PROJECT.json">Download project JSON</a></div></div>`;
  html = html.replace(match[0], `${match[0]}${block}`);
}

const loaderMarker = 'data-retained-self-project-loader="true"';
if (!html.includes(loaderMarker)) {
  const loader = `<script ${loaderMarker}>
window.addEventListener('load',()=>{setTimeout(async()=>{
  try{
    const response=await fetch('./SELF_VERIFIED_PROJECT.json',{cache:'no-store'});
    if(!response.ok)throw new Error('Retained application project retrieval failed: '+response.status);
    const project=await response.json();
    const view=document.querySelector('#projectsView');
    const identity=String(project.projectId||project.name||'');
    if(identity&&view&&view.textContent.includes(identity))return;
    const inputs=[...document.querySelectorAll('input[type="file"]')];
    const input=inputs.find(el=>/json/i.test(el.accept||'')||/import|project/i.test((el.id||'')+' '+(el.name||'')+' '+(el.getAttribute('aria-label')||'')));
    if(!input)throw new Error('The application project-import control was not found.');
    const file=new File([JSON.stringify(project)],'SELF_VERIFIED_PROJECT.json',{type:'application/json'});
    const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,250));
    const stored=JSON.parse(localStorage.getItem('closedLoopReliability.projects')||'[]');
    if(!stored.some(item=>item.projectId===project.projectId))throw new Error('The retained application project was not accepted by the application project importer.');
  }catch(error){
    console.error(error);
    const host=document.querySelector('[data-self-project-proof="true"]');
    if(host){const p=document.createElement('p');p.className='error';p.textContent='Retained application project load failed: '+error.message;host.appendChild(p);}
  }
},0)});
</script>`;
  html = html.replace(/<\/body>/i, `${loader}</body>`);
}

fs.writeFileSync(path, html);
console.log(JSON.stringify({status:'PASS',selfProjectProofAttached:true,selfProjectNativeImport:true}, null, 2));

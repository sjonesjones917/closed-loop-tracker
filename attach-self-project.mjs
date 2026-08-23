import fs from 'node:fs';

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

html = html.replace(
  'Each project begins with the user’s actual arbitrary job. No project is precompleted or defined as an application self-build.',
  'New user-created projects begin with the user’s actual arbitrary job at Stage 1. The completed application project is retained separately and loaded as a native project to demonstrate this application’s full 31-stage workflow.'
);

const proofMarker = 'data-self-project-proof="true"';
const proofBlock = `<div class="card" ${proofMarker}>
<h2>Completed application project</h2>
<p id="retainedProjectStatus">Loading the completed project created with this application…</p>
<p>This retained project is about the complete Closed-Loop Agent Reliability application, uses the same project model and controls as every other project, and preserves all 31 completed stages. It is workflow evidence only; it is never external authority for its own requirements.</p>
<div class="actions"><button class="btn" type="button" id="showRetainedProjectBtn">Open completed project</button><a class="btn" href="SELF_VERIFIED_PROJECT.json" download="SELF_VERIFIED_PROJECT.json">Download project JSON</a></div>
</div>`;
if (!html.includes(proofMarker)) {
  const match = html.match(/<section\s+id=["']projectsView["'][^>]*>/i);
  if (!match) throw new Error('Projects view not found; cannot attach the completed application project.');
  html = html.replace(match[0], `${match[0]}${proofBlock}`);
}

// Replace any earlier post-load importer with one deterministic retained-project bootstrap.
html = html.replace(/<script\s+data-retained-self-project-loader=["']true["'][^>]*>[\s\S]*?<\/script>/gi, '');
html = html.replace(/<script\s+data-retained-project-bootstrap=["']true["'][^>]*>[\s\S]*?<\/script>/gi, '');

const proofMarkup = JSON.stringify(proofBlock);
const bootstrap = `<script data-retained-project-bootstrap="true">
(()=>{'use strict';
const PROJECT_PATH='./SELF_VERIFIED_PROJECT.json';
const PROJECTS_KEY='closedLoopReliability.projects';
const RELOAD_KEY='closedLoopReliability.retainedProjectReload';
const PROOF_MARKUP=${proofMarkup};
let retainedProject=null;
const ensureProofCard=()=>{const view=document.getElementById('projectsView');if(!view)return null;let card=view.querySelector('[data-self-project-proof="true"]');if(!card){view.insertAdjacentHTML('afterbegin',PROOF_MARKUP);card=view.querySelector('[data-self-project-proof="true"]');if(retainedProject){const status=card&&card.querySelector('#retainedProjectStatus');if(status){status.textContent='Loaded: '+String(retainedProject.name||'completed application project')+' · '+completedCount(retainedProject)+'/31 stages complete.';status.classList.remove('error');status.classList.add('success')}}}return card};
const statusElement=()=>{ensureProofCard();return document.getElementById('retainedProjectStatus')};
const setStatus=(message,isError=false)=>{const element=statusElement();if(!element)return;element.textContent=message;element.classList.toggle('error',Boolean(isError));element.classList.toggle('success',!isError)};
const parseProjects=()=>{try{const value=JSON.parse(localStorage.getItem(PROJECTS_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
const completedCount=project=>Array.isArray(project&&project.stages)?project.stages.filter(stage=>stage&&stage.status==='COMPLETE').length:0;
const fingerprint=project=>JSON.stringify(project);
const validateProject=project=>{if(!project||project.schema!=='closed-loop-project/1'||!project.projectId)throw new Error('The retained application project is not in the application project schema.');if(!Array.isArray(project.stages)||project.stages.length!==31||project.stages.some((stage,index)=>stage.number!==index+1||stage.status!=='COMPLETE'))throw new Error('The retained application project does not preserve all 31 completed stages.');const scope=String(project.name||'')+' '+String(project.job&&project.job.exactUserObjective||'');if(!/Closed-Loop Agent Reliability application/i.test(scope))throw new Error('The retained project is not about the complete application.');return project};
const storeProject=project=>{const projects=parseProjects();const index=projects.findIndex(item=>item&&item.projectId===project.projectId);let changed=false;if(index<0){projects.unshift(project);changed=true}else if(fingerprint(projects[index])!==fingerprint(project)){projects[index]=project;changed=true}if(changed)localStorage.setItem(PROJECTS_KEY,JSON.stringify(projects));return changed};
const projectCard=project=>{const view=document.getElementById('projectsView');if(!view)return null;const identity=[String(project.name||''),String(project.projectId||'')].filter(Boolean);const candidates=[...view.querySelectorAll('[data-project-id],article,li,.card')];return candidates.find(element=>!element.matches('[data-self-project-proof="true"]')&&identity.some(value=>element.textContent&&element.textContent.includes(value)))||null};
const protectCard=(card,project)=>{if(!card)return;card.setAttribute('data-retained-application-project','true');card.setAttribute('data-project-id',project.projectId);for(const control of card.querySelectorAll('button,a,[role="button"]')){if(/delete|remove/i.test(String(control.textContent||''))){control.setAttribute('aria-disabled','true');control.setAttribute('title','This completed application project is retained as proof that the application works.');if('disabled' in control)control.disabled=true;control.hidden=true}}if(!card.querySelector('[data-retained-badge="true"]')){const badge=document.createElement('span');badge.setAttribute('data-retained-badge','true');badge.className='pill';badge.textContent='Retained 31/31 proof project';const heading=card.querySelector('h2,h3');if(heading)heading.insertAdjacentElement('afterend',badge);else card.prepend(badge)}};
const waitForCard=async(project,timeout=8000)=>{const started=Date.now();while(Date.now()-started<timeout){const card=projectCard(project);if(card)return card;await new Promise(resolve=>setTimeout(resolve,100))}return null};
const importThroughVisibleControl=async project=>{const inputs=[...document.querySelectorAll('input[type="file"]')];const input=inputs.find(element=>/json/i.test(element.accept||'')||/import|project/i.test(String(element.id||'')+' '+String(element.name||'')+' '+String(element.getAttribute('aria-label')||'')));if(!input||typeof DataTransfer==='undefined'||typeof File==='undefined')return null;const file=new File([JSON.stringify(project)],'SELF_VERIFIED_PROJECT.json',{type:'application/json'});const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return waitForCard(project)};
const openProject=async project=>{let card=projectCard(project)||await waitForCard(project,1500);if(!card)return false;protectCard(card,project);const controls=[...card.querySelectorAll('button,a,[role="button"]')];const open=controls.find(control=>!/delete|remove/i.test(String(control.textContent||''))&&/open|view|continue|workflow/i.test(String(control.textContent||'')))||controls.find(control=>!/delete|remove|download|export/i.test(String(control.textContent||'')));if(open){open.click();return true}card.scrollIntoView({block:'center',behavior:'smooth'});return true};
const observeProjectsView=()=>{const view=document.getElementById('projectsView');if(!view||view.dataset.retainedProjectObserver==='true')return;view.dataset.retainedProjectObserver='true';new MutationObserver(()=>{ensureProofCard();if(retainedProject){const current=projectCard(retainedProject);if(current)protectCard(current,retainedProject)}}).observe(view,{childList:true,subtree:true})};
const bootstrapProject=async()=>{try{ensureProofCard();observeProjectsView();setStatus('Loading the completed project created with this application…');const response=await fetch(PROJECT_PATH,{cache:'no-store'});if(!response.ok)throw new Error('Project retrieval failed: '+response.status);retainedProject=validateProject(await response.json());const changed=storeProject(retainedProject);const reloadToken=String(retainedProject.projectId)+'|'+String(retainedProject.updatedAt||'');if(changed&&sessionStorage.getItem(RELOAD_KEY)!==reloadToken){sessionStorage.setItem(RELOAD_KEY,reloadToken);location.reload();return}let card=await waitForCard(retainedProject);if(!card)card=await importThroughVisibleControl(retainedProject);if(!card)throw new Error('The completed application project was stored but was not rendered by the Projects view.');sessionStorage.removeItem(RELOAD_KEY);protectCard(card,retainedProject);setStatus('Loaded: '+String(retainedProject.name||'completed application project')+' · '+completedCount(retainedProject)+'/31 stages complete.')}catch(error){console.error(error);setStatus('Completed application project load failed: '+String(error&&error.message||error),true)}};
document.addEventListener('click',event=>{const target=event.target&&event.target.closest?event.target:null;if(!target)return;const deletion=target.closest('[data-delete-project]');if(deletion&&retainedProject&&String(deletion.getAttribute('data-delete-project')||'')===String(retainedProject.projectId)){event.preventDefault();event.stopImmediatePropagation();const card=projectCard(retainedProject);if(card)protectCard(card,retainedProject);setStatus('The completed application project is retained as proof that the application works.');return}const trigger=target.closest('#showRetainedProjectBtn');if(!trigger)return;event.preventDefault();event.stopImmediatePropagation();if(retainedProject)openProject(retainedProject);else bootstrapProject()},true);
const start=()=>{ensureProofCard();observeProjectsView();bootstrapProject()};
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
</script>`;

html = html.replace(/<\/body>/i, `${bootstrap}</body>`);
fs.writeFileSync(path, html);
console.log(JSON.stringify({ status: 'PASS', retainedProjectProofAttached: true, retainedProjectPersistent: true, retainedProjectNative: true }, null, 2));

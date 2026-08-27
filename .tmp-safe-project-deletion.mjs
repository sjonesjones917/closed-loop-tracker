import fs from 'node:fs';
import {createHash} from 'node:crypto';

const appPath='app-core.js';
let app=fs.readFileSync(appPath,'utf8');
if(!app.includes('function projectView(){'))throw new Error('Expected projectView function was not found.');
app=app.replace('function projectView(){','function projectViewBase(){');
const humanStageMarker='function humanStageMarkup(n,locked){';
if(!app.includes(humanStageMarker))throw new Error('Expected humanStageMarkup marker was not found.');
const managementMarkup=`function projectDeletionMarkup(){
  const jobId=String(current?.job?.JOB_ID||'').trim();
  if(!jobId)return '';
  if(current?.isRetainedTestProject)return \`<details class="record-card" id="project-management"><summary>Project management<span>Advanced</span></summary><div class="record-body"><div class="notice">This built-in retained reference project is restored by the application and cannot be permanently deleted. Select a normal project to use project deletion.</div></div></details>\`;
  return \`<details class="record-card" id="project-management"><summary>Project management<span>Advanced</span></summary><div class="record-body"><div class="notice danger"><strong>Permanent deletion.</strong><br>This removes this project and every artifact byte stored for it from this browser. Export a backup first if you may need it later.</div><div class="field"><label for="delete-project-confirmation">Type the exact JOB_ID to enable deletion</label><input id="delete-project-confirmation" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="\${esc(jobId)}" aria-describedby="delete-project-confirmation-help"><span class="help" id="delete-project-confirmation-help">Required: \${esc(jobId)}</span></div><div class="button-row"><button class="danger" id="delete-project" type="button" disabled>Permanently delete project</button></div></div></details>\`;
}
function projectView(){return projectViewBase()+projectDeletionMarkup();}
`;
app=app.replace(humanStageMarker,managementMarkup+humanStageMarker);

const wireMarker='function wire(){';
if(!app.includes(wireMarker))throw new Error('Expected wire marker was not found.');
const deletionFunctions=`function syncDeleteProjectControl(){
  const input=$('#delete-project-confirmation'),button=$('#delete-project');
  if(!input||!button)return;
  button.disabled=input.value.trim()!==String(current?.job?.JOB_ID||'').trim();
}
async function deleteCurrentProject(){
  const input=$('#delete-project-confirmation'),button=$('#delete-project'),jobId=String(current?.job?.JOB_ID||'').trim();
  if(current?.isRetainedTestProject){alert('The built-in retained reference project is restored by the application and cannot be permanently deleted.');return;}
  if(!jobId||!input||input.value.trim()!==jobId){input?.focus();syncDeleteProjectControl();return;}
  const deletingProject=current,remaining=projects.filter(project=>String(project?.job?.JOB_ID||'')!==jobId);let replacement=remaining[0]||null,createdReplacement=null;
  input.disabled=true;if(button)button.disabled=true;
  try{
    if(!replacement){
      createdReplacement=ensureState(core.createBlankState(createUniqueJobId()));createdReplacement.job.DATE_OPENED=new Date().toISOString();createdReplacement.activeView='Project';engine.createNewJobReset(createdReplacement);
      const saved=await projectStore.writeAll([createdReplacement]);replacement=saved[0]||createdReplacement;remaining.push(replacement);
    }
    const removed=await projectStore.removeProject(jobId,{expectedProjectRevision:Number(deletingProject.revision||0),replacementSelectedProjectId:String(replacement.job.JOB_ID)});
    if(!removed)throw new Error('The project no longer exists in browser storage.');
  }catch(error){
    if(createdReplacement&&replacement)try{await projectStore.removeProject(String(replacement.job.JOB_ID),{expectedProjectRevision:Number(replacement.revision||0)});}catch{}
    input.disabled=false;syncDeleteProjectControl();announce('project deletion failed');alert(\`Project was not deleted. No project data was intentionally removed: \${error.message||error}\`);return;
  }
  try{
    projects=(await projectStore.readAll()).filter(Boolean).map(normalize);current=projects.find(project=>project.job?.JOB_ID===replacement.job.JOB_ID)||projects[0];
    if(!current)throw new Error('No replacement project was available after deletion.');
    current.activeView='Overview';announce(\`project \${jobId} permanently deleted\`);render();
  }catch(error){announce('project deleted; application reload required');location.reload();}
}
`;
app=app.replace(wireMarker,deletionFunctions+wireMarker);
const saveJobWire="if($('#save-job'))$('#save-job').onclick=saveJob;";
if(!app.includes(saveJobWire))throw new Error('Expected save-job wiring marker was not found.');
app=app.replace(saveJobWire,saveJobWire+"if($('#delete-project-confirmation'))$('#delete-project-confirmation').oninput=syncDeleteProjectControl;if($('#delete-project'))$('#delete-project').onclick=deleteCurrentProject;syncDeleteProjectControl();");
fs.writeFileSync(appPath,app);

const storePath='project-store.js';
let store=fs.readFileSync(storePath,'utf8');
const removePattern=/async function removeProjectIndexed\(projectsOrJobId\)\{.*?\nfunction removeProject\(projectsOrJobId,jobIdOrStorage,storage\)\{.*?\n\nasync function putArtifact/s;
if(!removePattern.test(store))throw new Error('Expected project-store removal implementation was not found.');
const safeRemoval=`async function removeProjectIndexed(projectsOrJobId,options={}){
  const jobId=String(projectsOrJobId||'').trim(),expected=options?.expectedProjectRevision,replacementSelectedProjectId=String(options?.replacementSelectedProjectId||'').trim();
  if(!jobId)throw storageError('JOB_ID is required for project deletion.','PROJECT_DELETE_JOB_ID_REQUIRED');
  if(replacementSelectedProjectId===jobId)throw storageError('The deleted project cannot also be the replacement selected project.','INVALID_PROJECT_DELETE_REPLACEMENT');
  const tx=await openTransaction([PROJECTS,ARTIFACTS,META],'readwrite'),projects=tx.objectStore(PROJECTS),artifacts=tx.objectStore(ARTIFACTS),meta=tx.objectStore(META);
  try{
    const prior=await request(projects.get(jobId));if(!prior){await complete(tx);return false;}
    if(expected!==undefined&&expected!==null&&Number(prior.revision)!==Number(expected)){const error=storageError(\`Project revision conflict for \${jobId}: expected \${expected}, found \${prior.revision}.\`,'STALE_PROJECT_REVISION');throw error;}
    if(replacementSelectedProjectId){const replacement=await request(projects.get(replacementSelectedProjectId));if(!replacement)throw storageError(\`Replacement project \${replacementSelectedProjectId} is not stored.\`,'PROJECT_DELETE_REPLACEMENT_MISSING');}
    const artifactRows=await request(artifacts.getAll());projects.delete(jobId);for(const artifact of artifactRows)if(String(artifact.jobId)===jobId)artifacts.delete(artifact.artifactId);
    const selected=await request(meta.get('selectedProject'));if(String(selected?.value||'')===jobId){if(replacementSelectedProjectId)meta.put({key:'selectedProject',value:replacementSelectedProjectId,updatedAt:now()});else meta.delete('selectedProject');}
    const lastCommitted=await request(meta.get('lastCommittedRevision'));if(String(lastCommitted?.value?.jobId||'')===jobId)meta.delete('lastCommittedRevision');
    fault('during-project-delete');await complete(tx);try{new BroadcastChannel('closed-loop-reliability').postMessage({type:'PROJECT_DELETED',jobId,replacementSelectedProjectId:replacementSelectedProjectId||null});}catch{}return true;
  }catch(error){try{tx.abort();}catch{}throw error;}
}
function removeProject(projectsOrJobId,jobIdOrStorage,storage){if(Array.isArray(projectsOrJobId)&&storage){const next=clone(projectsOrJobId).filter(project=>projectIdentity(project)!==String(jobIdOrStorage||''));writeAllLegacy(next,storage);return next;}return removeProjectIndexed(projectsOrJobId,jobIdOrStorage||{});}

async function putArtifact`;
store=store.replace(removePattern,safeRemoval);
fs.writeFileSync(storePath,store);

const browserPath='verify-browser.mjs';
let browser=fs.readFileSync(browserPath,'utf8');
const outputMarker=/\n\s*console\.log\(JSON\.stringify\(\{browser:true/;
const outputMatch=browser.match(outputMarker);
if(!outputMatch)throw new Error('Expected verify-browser result marker was not found.');
const deletionTest=`
 // Project deletion is intentionally hidden, exact-ID-gated, stale-safe, and removes stored artifact bytes.
 await click(cdp,'#new-project');await waitExpr(cdp,\`Boolean(document.querySelector('#project-management')&&!document.querySelector('#project-management').open)\`);
 const deletionJobId=await evalValue(cdp,\`document.querySelector('#current-project-summary')?.textContent?.split(' · ')[0]\`);assert(deletionJobId&&deletionJobId!=='JOB-20260823144121','New project was not selected for deletion testing.');
 const deletionArtifactId='DELETE-ARTIFACT-'+Date.now();await evalValue(cdp,\`(async()=>{await globalThis.closedLoopProjectStore.putArtifact({artifactId:\${JSON.stringify(deletionArtifactId)},jobId:\${JSON.stringify(deletionJobId)},blob:new Blob(['delete-project-artifact'],{type:'text/plain'}),filename:'delete-project-artifact.txt',mediaType:'text/plain'});return true;})()\`);
 const initialDeleteState=await evalValue(cdp,\`(()=>{const details=document.querySelector('#project-management'),button=document.querySelector('#delete-project');return {open:details?.open,disabled:button?.disabled};})()\`);assert(initialDeleteState&&!initialDeleteState.open&&initialDeleteState.disabled,\`Project deletion is not safely hidden and disabled by default: \${JSON.stringify(initialDeleteState)}\`);
 await click(cdp,'#project-management > summary');await fill(cdp,'#delete-project-confirmation','WRONG-JOB-ID');assert(await evalValue(cdp,\`document.querySelector('#delete-project')?.disabled===true\`),'Wrong confirmation text enabled project deletion.');
 const staleDeleteBlocked=await evalValue(cdp,\`(async()=>{const store=globalThis.closedLoopProjectStore,all=await store.readAll(),target=all.find(project=>project.job?.JOB_ID===\${JSON.stringify(deletionJobId)}),replacement=all.find(project=>project.job?.JOB_ID!==\${JSON.stringify(deletionJobId)});try{await store.removeProject(\${JSON.stringify(deletionJobId)},{expectedProjectRevision:Number(target?.revision||0)+1,replacementSelectedProjectId:replacement?.job?.JOB_ID||''});return false;}catch(error){return error?.code==='STALE_PROJECT_REVISION';}})()\`);assert(staleDeleteBlocked,'Stale project deletion was not rejected.');
 const preservedAfterStale=await evalValue(cdp,\`(async()=>({project:(await globalThis.closedLoopProjectStore.readAll()).some(project=>project.job?.JOB_ID===\${JSON.stringify(deletionJobId)}),artifacts:(await globalThis.closedLoopProjectStore.listArtifacts(\${JSON.stringify(deletionJobId)})).length}))()\`);assert(preservedAfterStale.project&&preservedAfterStale.artifacts===1,\`Stale deletion changed project or artifact custody: \${JSON.stringify(preservedAfterStale)}\`);
 await fill(cdp,'#delete-project-confirmation',deletionJobId);await waitExpr(cdp,\`document.querySelector('#delete-project')?.disabled===false\`);await click(cdp,'#delete-project');await waitExpr(cdp,\`!document.querySelector('#current-project-summary')?.textContent?.startsWith(\${JSON.stringify(deletionJobId)})\`,12000);
 const deletionState=await evalValue(cdp,\`(async()=>{const all=await globalThis.closedLoopProjectStore.readAll(),selected=await globalThis.closedLoopProjectStore.metaGet('selectedProject'),currentId=document.querySelector('#current-project-summary')?.textContent?.split(' · ')[0];return {projectExists:all.some(project=>project.job?.JOB_ID===\${JSON.stringify(deletionJobId)}),artifactCount:(await globalThis.closedLoopProjectStore.listArtifacts(\${JSON.stringify(deletionJobId)})).length,selected,currentId};})()\`);assert(!deletionState.projectExists&&deletionState.artifactCount===0&&deletionState.selected===deletionState.currentId,\`Project deletion did not atomically remove project/artifacts and select a surviving project: \${JSON.stringify(deletionState)}\`);
 await click(cdp,'[data-view="Project"]');const retainedProtection=await activeProject(cdp);if(retainedProtection?.isRetainedTestProject)assert(await evalValue(cdp,\`Boolean(document.querySelector('#project-management')&&!document.querySelector('#delete-project')&&document.querySelector('#project-management').innerText.includes('cannot be permanently deleted'))\`),'Built-in retained reference project is not protected from deletion.');
`;
browser=browser.replace(outputMarker,deletionTest+outputMatch[0]);
if(!browser.includes('genericLongSectionNavigation:true,reloadPersistence:true'))throw new Error('Expected browser result flags were not found.');
browser=browser.replace('genericLongSectionNavigation:true,reloadPersistence:true','genericLongSectionNavigation:true,projectDeletion:true,reloadPersistence:true');
fs.writeFileSync(browserPath,browser);

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
const runtimeManifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const runtimeBuildIdentity=`runtime-${createHash('sha256').update(runtimeManifest).digest('hex').slice(0,16)}`;
const indexPath='index.html';
let index=fs.readFileSync(indexPath,'utf8');
const tokens=[...index.matchAll(/<script\s+defer\s+src="[^"]+\?v=([^"]+)"/g)].map(match=>match[1]);
if(tokens.length!==runtimeFiles.length||new Set(tokens).size!==1)throw new Error(`Expected one shared token across ${runtimeFiles.length} runtime scripts; found ${JSON.stringify(tokens)}.`);
index=index.replaceAll(tokens[0],runtimeBuildIdentity);
fs.writeFileSync(indexPath,index);

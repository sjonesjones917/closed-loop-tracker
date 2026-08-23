import fs from 'node:fs';

const inputPath = process.argv[2] || 'index.html';
const outputPath = process.argv[3] || inputPath;
let html = fs.readFileSync(inputPath, 'utf8');
const changes = [];

function replaceOnce(label, search, replacement) {
  if (typeof search === 'string') {
    const first = html.indexOf(search);
    const last = html.lastIndexOf(search);
    if (first < 0 || first !== last) throw new Error(`${label}: expected one literal match; first=${first}, last=${last}`);
    html = html.slice(0, first) + replacement + html.slice(first + search.length);
  } else {
    const flags = search.flags.includes('g') ? search.flags : search.flags + 'g';
    const count = [...html.matchAll(new RegExp(search.source, flags))].length;
    if (count !== 1) throw new Error(`${label}: expected one regular-expression match; found ${count}`);
    html = html.replace(search, replacement);
  }
  changes.push(label);
}

replaceOnce(
  'new-project-boundary-copy',
  '<div class="boundary"><strong>No seeded build job</strong>This creates an empty project for the job entered above. It does not load a self-build project, an application repair project, or any prior generated workflow state.</div>',
  '<div class="boundary"><strong>New projects start empty</strong>This creates a 0/31 project for the job entered above. The retained completed application demonstration remains available in Projects and is never copied into new work.</div>'
);

replaceOnce(
  'new-project-role',
  "const project={schema:'closed-loop-project/1',projectId:uid('PROJECT'),name:input.name.trim(),createdAt:now(),updatedAt:now(),job,stages:STAGES.map(blankStage),selectedStage:1};",
  "const project={schema:'closed-loop-project/1',projectRole:'USER_PROJECT',projectId:uid('PROJECT'),name:input.name.trim(),createdAt:now(),updatedAt:now(),job,stages:STAGES.map(blankStage),selectedStage:1};"
);

replaceOnce(
  'project-shape-role',
  "function ensureProjectShape(project){if(!project||project.schema!=='closed-loop-project/1'||!project.projectId||!Array.isArray(project.stages)||project.stages.length!==31)throw Error('This is not a valid current Closed-Loop project export. Legacy self-build exports are intentionally not loaded.');const copy=structuredClone(project);copy.job=copy.job||{};",
  "function ensureProjectShape(project){if(!project||project.schema!=='closed-loop-project/1'||!project.projectId||!Array.isArray(project.stages)||project.stages.length!==31)throw Error('This is not a valid current Closed-Loop project export.');const copy=structuredClone(project);copy.projectRole=copy.projectRole==='RETAINED_APPLICATION_DEMONSTRATION'?'RETAINED_APPLICATION_DEMONSTRATION':'USER_PROJECT';copy.job=copy.job||{};"
);

replaceOnce(
  'projects-view',
  /function renderProjects\(\)\{[\s\S]*?\}\nfunction renderJob/,
  `function renderProjects(){const root=$('projectsView');const ordered=projects.slice().sort((a,b)=>Number(b.projectRole==='RETAINED_APPLICATION_DEMONSTRATION')-Number(a.projectRole==='RETAINED_APPLICATION_DEMONSTRATION'));const projectCards=ordered.map(project=>{const done=completedCount(project),pct=Math.round(done/31*100),retained=project.projectRole==='RETAINED_APPLICATION_DEMONSTRATION';const badges=[retained?'<span class="badge external">RETAINED APPLICATION DEMONSTRATION</span>':'',selectedProjectId===project.projectId?'<span class="badge good">OPEN</span>':''].filter(Boolean).join(' ');const finalAction=retained?'<button class="btn" data-reload-retained>Reload verified project</button>':'<button class="btn danger" data-delete-project="'+esc(project.projectId)+'">Delete</button>';return '<article class="panel projectCard"'+(retained?' data-retained-project="true"':'')+'><div class="stageHeaderTop"><div><h2>'+esc(project.name)+'</h2><div class="fine muted">'+esc(project.projectId)+' · Updated '+esc(new Date(project.updatedAt).toLocaleString())+'</div></div><div class="actions tight">'+badges+'</div></div><div class="objective">'+esc(project.job.exactUserObjective||'No objective entered.')+'</div><div class="progress"><i style="width:'+pct+'%"></i></div><div class="projectMeta"><span class="pill">'+done+'/31 complete</span><span class="pill">'+project.userInputs.length+' inputs</span><span class="pill">'+project.externalSources.length+' external sources</span><span class="pill">'+project.workflowArtifacts.length+' registered artifacts</span></div><div class="actions"><button class="btn primary" data-open-project="'+esc(project.projectId)+'">Open project</button><button class="btn" data-export-project="'+esc(project.projectId)+'">Export JSON</button>'+finalAction+'</div></article>'}).join('');root.innerHTML='<div class="panel"><div class="stageHeaderTop"><div><h2>Projects</h2><div class="muted lead">The retained completed project demonstrates this application through the same current project schema and exact 31-stage workflow. Every user-created project starts empty at 0/31.</div></div></div><div class="actions"><button id="newProjectBtn" class="btn primary">New project</button><button id="importProjectBtn" class="btn">Import project JSON</button><button class="btn" data-reload-retained>Reload retained application project</button></div></div>'+(projectCards||'<div class="empty">The retained project is loading. New projects may still be created immediately.</div>')}
function renderJob`
);

replaceOnce(
  'retained-delete-protection',
  /function deleteProject\(id\)\{[\s\S]*?\}\nfunction openProject/,
  `function deleteProject(id){const project=projects.find(p=>p.projectId===id);if(!project)return;if(project.projectRole==='RETAINED_APPLICATION_DEMONSTRATION'){toast('The retained application demonstration cannot be deleted. Reload it from the published verified project when needed.','warn');return}if(!confirm('Delete project “'+project.name+'” from this browser?'))return;projects=projects.filter(p=>p.projectId!==id);if(selectedProjectId===id)selectedProjectId=null;save();switchView('projects');toast('Project deleted.','warn')}
function openProject`
);

replaceOnce(
  'native-project-import-export-loader',
  /function exportProject\(projectId\)\{[\s\S]*?\}\nasync function importProject\(file\)\{[\s\S]*?\}\nfunction copyRecord/,
  `function exportProject(projectId){const project=projects.find(p=>p.projectId===projectId);if(!project)return;const filename=project.projectRole==='RETAINED_APPLICATION_DEMONSTRATION'?'SELF_VERIFIED_PROJECT.json':(project.name.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'closed-loop-project')+'.json';downloadBlob(new TextEncoder().encode(JSON.stringify(project,null,2)+'\\n'),filename,'application/json')}
function validateProjectData(input){const project=ensureProjectShape(input);for(const name of ALL_COLLECTION_NAMES)for(const record of project[name])validateRecord(COLLECTIONS[name],record,project);for(let n=1;n<=31;n++){if(project.stages[n-1].status!=='COMPLETE')throw Error('Retained project validation failed: Stage '+n+' is not COMPLETE.');validateStage(project,n)}return project}
function installProjectData(input,options={}){let project=ensureProjectShape(input);if(options.retained){project.projectRole='RETAINED_APPLICATION_DEMONSTRATION';project=validateProjectData(project)}else if(project.projectRole==='RETAINED_APPLICATION_DEMONSTRATION')project.projectRole='USER_PROJECT';const existing=options.retained?projects.findIndex(item=>item.projectRole==='RETAINED_APPLICATION_DEMONSTRATION'||item.projectId===project.projectId):projects.findIndex(item=>item.projectId===project.projectId);if(existing>=0&&!options.retained&&projects[existing].projectRole==='RETAINED_APPLICATION_DEMONSTRATION')throw Error('The retained application demonstration can only be replaced by its published verified project.');if(existing>=0&&!options.replace&&!confirm('A project with this ID already exists. Replace it with the imported project?'))return null;if(existing>=0)projects[existing]=project;else if(options.retained)projects.unshift(project);else projects.push(project);if(options.select||!selectedProjectId)selectedProjectId=project.projectId;selectedStage=project.selectedStage||1;save();renderAll();if(options.open)switchView('workflow');return structuredClone(project)}
async function loadRetainedProject(options={}){const response=await fetch('./SELF_VERIFIED_PROJECT.json',{cache:'no-store'});if(!response.ok)throw Error('Published retained project request failed with HTTP '+response.status+'.');const data=await response.json();const project=installProjectData(data,{retained:true,replace:true,select:Boolean(options.select),open:Boolean(options.open)});if(!options.silent){setStatus('Retained application project loaded and validated: '+project.name+'.','good');toast('Retained application project reloaded.','good')}return project}
async function importProject(file){try{const data=JSON.parse(await file.text());const project=installProjectData(data,{open:true});if(project)toast('Current project imported.','good')}catch(error){toast('Import rejected: '+error.message,'bad')}}
function copyRecord`
);

replaceOnce(
  'retained-reload-control',
  "if(target.id==='importProjectBtn'){$('importInput').click();return}if(target.dataset.closeDialog)",
  "if(target.id==='importProjectBtn'){$('importInput').click();return}if(target.hasAttribute('data-reload-retained')){void loadRetainedProject({select:true}).catch(error=>{setStatus('Retained application project could not be loaded: '+error.message,'bad');toast(error.message,'bad')});return}if(target.dataset.closeDialog)"
);

replaceOnce(
  'native-public-api-and-startup',
  'load();renderAll();\n})();',
  `window.ClosedLoopReliability=Object.freeze({
  getProjects:()=>structuredClone(projects),
  getCurrentProject:()=>cur()?structuredClone(cur()):null,
  getProject:projectId=>{const project=projects.find(item=>item.projectId===projectId);return project?structuredClone(project):null},
  validateProjectData:input=>structuredClone(validateProjectData(input)),
  importProjectData:(input,options={})=>installProjectData(input,options),
  loadRetainedProject:options=>loadRetainedProject(options||{}),
  exportProjectData:projectId=>{const project=projects.find(item=>item.projectId===projectId);return project?structuredClone(project):null}
});
load();renderAll();void loadRetainedProject({silent:true}).then(project=>setStatus('Ready. Retained application project validated; '+projects.length+' project'+(projects.length===1?'':'s')+' available.','good')).catch(error=>setStatus('Ready for new work. Retained application project could not be loaded: '+error.message,'warn'));
})();`
);

const prohibited = [
  ['DataTransfer import transport', /new DataTransfer\s*\(/],
  ['prompt relay label', /Exact stage prompt|Agent response — REQUIRED|Copy current prompt/],
  ['obsolete no-project claim', /No project is precompleted or defined as an application self-build/]
];
for (const [label, pattern] of prohibited) if (pattern.test(html)) throw new Error(`Corrected application still contains prohibited ${label}.`);
for (const token of ['RETAINED_APPLICATION_DEMONSTRATION','loadRetainedProject','validateProjectData','Initial work owner type','HUMAN_AGENT_TEAM']) if (!html.includes(token)) throw new Error(`Corrected application is missing ${token}.`);

fs.writeFileSync(outputPath, html);
fs.writeFileSync('APPLICATION_CORRECTION_REPORT.json', JSON.stringify({status:'PASS',inputPath,outputPath,changes,byteLength:Buffer.byteLength(html)},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',changes,byteLength:Buffer.byteLength(html)},null,2));

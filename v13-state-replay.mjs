import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const exact=(text,from,to,label)=>{
  if(!text.includes(from))throw new Error(`${label} patch anchor missing`);
  return text.replace(from,to);
};

const base=spawnSync(process.execPath,['v13-state-replay-base.mjs'],{encoding:'utf8',stdio:'inherit'});
if(base.status!==0)process.exit(base.status??1);

const stdinTransport=spawnSync(process.execPath,['v13-agent-stdin-replay.mjs'],{encoding:'utf8',stdio:'inherit'});
if(stdinTransport.status!==0)process.exit(stdinTransport.status??1);

for(const file of ['app-v13-candidate1.html','app-v13.html']){
  let s=fs.readFileSync(file,'utf8');
  if(!s.includes('id="projectId"')){
    const oldForm='<div class="field"><label>Project name *</label><input id="name"></div>';
    const newForm='<div class="field"><label>Project ID (preserve an existing identifier when supplied)</label><input id="projectId" autocomplete="off" placeholder="PROJECT-..."></div><div class="field"><label>Job ID (preserve an existing identifier when supplied)</label><input id="jobId" autocomplete="off" placeholder="JOB-..."></div>'+oldForm;
    s=exact(s,oldForm,newForm,`${file} visible identifier fields`);
  }

  if(!s.includes('const suppliedProjectId=String(v.projectId||\'\').trim()')){
    const oldCreate="function createProject(v){if(!v.name.trim()||!v.objective.trim()||!v.deliverable.trim())throw Error('Project name, exact objective, and exact deliverable are required.');return{schemaVersion:13,projectId:id('PROJECT'),jobId:id('JOB'),";
    const newCreate="function createProject(v){if(!v.name.trim()||!v.objective.trim()||!v.deliverable.trim())throw Error('Project name, exact objective, and exact deliverable are required.');const suppliedProjectId=String(v.projectId||'').trim(),suppliedJobId=String(v.jobId||'').trim();if(suppliedProjectId&&!/^PROJECT-[A-Z0-9-]+$/i.test(suppliedProjectId))throw Error('Project ID must begin PROJECT- and contain only letters, numbers, and hyphens.');if(suppliedJobId&&!/^JOB-[A-Z0-9-]+$/i.test(suppliedJobId))throw Error('Job ID must begin JOB- and contain only letters, numbers, and hyphens.');if(suppliedProjectId&&projects.some(p=>p.projectId===suppliedProjectId))throw Error('That Project ID already exists in this browser.');return{schemaVersion:13,projectId:suppliedProjectId||id('PROJECT'),jobId:suppliedJobId||id('JOB'),";
    s=exact(s,oldCreate,newCreate,`${file} identifier-preserving project creation`);
  }

  if(!s.includes("createProject({projectId:$('projectId').value,jobId:$('jobId').value")){
    const oldSubmit="createProject({name:$('name').value,objective:$('objective').value";
    const newSubmit="createProject({projectId:$('projectId').value,jobId:$('jobId').value,name:$('name').value,objective:$('objective').value";
    s=exact(s,oldSubmit,newSubmit,`${file} identifier form submission`);
  }

  for(const token of ['id="projectId"','id="jobId"',"projectId:suppliedProjectId||id('PROJECT')","jobId:suppliedJobId||id('JOB')"]){
    if(!s.includes(token))throw new Error(`${file} missing visible exact-identifier token ${token}`);
  }
  fs.writeFileSync(file,s);
}

let stageAgent=fs.readFileSync('self-e2e-agent.mjs','utf8');
const filenameBasedResearchClaim='Deploy byte-identical app-v13.html/index.html and validated SELF_VERIFIED_PROJECT.json from the accepted run.';
const authorityBasedResearchClaim='Deploy the byte-identical accepted HTML application and its separately validated project-export sidecar from the accepted run.';
if(stageAgent.includes(filenameBasedResearchClaim))stageAgent=stageAgent.replace(filenameBasedResearchClaim,authorityBasedResearchClaim);
if(/FINDING-0007[\s\S]*?REQUIREMENT_IMPLICATION:[^\n]*(?:app-v\d+\.html|SELF_VERIFIED_PROJECT\.json)/i.test(stageAgent))throw new Error('Stage 3 runtime response still treats implementation filenames as research evidence.');
fs.writeFileSync('self-e2e-agent.mjs',stageAgent);

let browser=fs.readFileSync('self-browser-e2e.mjs','utf8');
if(!browser.includes("page.locator('#projectId').fill('PROJECT-MT3M46X0-075JMP')")){
  const creationAnchor="  await page.locator('#newBtn').click();\n";
  const creationReplacement="  await page.locator('#newBtn').click();\n  await page.locator('#projectId').fill('PROJECT-MT3M46X0-075JMP');\n  await page.locator('#jobId').fill('JOB-MT3M46X0-M0LIB9');\n";
  browser=exact(browser,creationAnchor,creationReplacement,'visible exact identifier entry');
}
if(!browser.includes("page.locator('#pIds').textContent(),/PROJECT-MT3M46X0-075JMP/")){
  const createdAnchor="  assert.match(await page.locator('#pct').textContent(),/0\\/31/);";
  const createdReplacement="  assert.match(await page.locator('#pct').textContent(),/0\\/31/);\n  assert.match(await page.locator('#pIds').textContent(),/PROJECT-MT3M46X0-075JMP/);\n  assert.match(await page.locator('#pIds').textContent(),/JOB-MT3M46X0-M0LIB9/);";
  browser=exact(browser,createdAnchor,createdReplacement,'visible exact identifier display assertion');
}
if(!browser.includes("assert.equal(project.projectId,'PROJECT-MT3M46X0-075JMP')")){
  const projectAnchor="  assert.equal(project.stages.filter(s=>s.status==='COMPLETE').length,31);";
  const projectReplacement="  assert.equal(project.projectId,'PROJECT-MT3M46X0-075JMP');\n  assert.equal(project.jobId,'JOB-MT3M46X0-M0LIB9');\n  assert.equal(project.stages.filter(s=>s.status==='COMPLETE').length,31);";
  browser=exact(browser,projectAnchor,projectReplacement,'completed exact identifier assertion');
}
if(!browser.includes("assert.equal(exported.projectId,'PROJECT-MT3M46X0-075JMP')")){
  const exportAnchor="  assert.equal(exported.projectId,project.projectId);";
  const exportReplacement="  assert.equal(exported.projectId,'PROJECT-MT3M46X0-075JMP');\n  assert.equal(exported.jobId,'JOB-MT3M46X0-M0LIB9');\n  assert.equal(exported.projectId,project.projectId);";
  browser=exact(browser,exportAnchor,exportReplacement,'exported exact identifier assertion');
}
fs.writeFileSync('self-browser-e2e.mjs',browser);
console.log(JSON.stringify({status:'PATCHED_EXISTING_APPLICATION',visibleProjectIdField:true,visibleJobIdField:true,exactSelfBuildProjectId:'PROJECT-MT3M46X0-075JMP',exactSelfBuildJobId:'JOB-MT3M46X0-M0LIB9',projectNameIndependentIdentifierInsertion:true,stage3ResearchFilenameLeak:false,agentTransport:'STDIN'}));
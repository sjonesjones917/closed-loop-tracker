function stagePromptRequired(stage){return['AGENT','HUMAN_AGENT_TEAM'].includes(String(stage?.assignedActorType||''))}
function stagePromptSafe(value,depth=0){
  if(depth>6)return'[DEPTH LIMIT; use attached project export]';
  if(value===null||value===undefined)return value;
  if(typeof value==='string')return value.length>6000?`${value.slice(0,6000)}\n[TRUNCATED IN PROMPT; use attached project export for exact remainder]`:value;
  if(Array.isArray(value)){const limit=40;const items=value.slice(0,limit).map(item=>stagePromptSafe(item,depth+1));if(value.length>limit)items.push(`[${value.length-limit} ADDITIONAL RECORDS OMITTED; use attached project export]`);return items;}
  if(typeof value==='object'){
    const result={};
    for(const [key,item] of Object.entries(value)){
      if(key==='base64'){result[key]='[EXACT BYTES OMITTED FROM PROMPT; attach the registered file or project export]';continue}
      result[key]=stagePromptSafe(item,depth+1);
    }
    return result;
  }
  return value;
}
function stagePromptRecordSchema(n){
  if(n===1)return JOB_FIELDS.map(([key,label])=>`${key}: ${label}`).concat(['userInputs: supplied-input records']).join('\n');
  const groups=STAGE_GROUPS[n]||[];
  if(!groups.length)return'Use the stage completion evidence and exact prior structured records required by the stage.';
  return groups.map(name=>{
    const config=COLLECTIONS[name];
    return `${name} (${config.label})\n${config.fields.map(field=>`- ${field.key}${field.required?' [REQUIRED]':''}: ${field.label}`).join('\n')}`;
  }).join('\n\n');
}
function stagePromptAuthorizedData(project,n){
  const spec=STAGE_PROMPT_SPECS[n];
  const stageState={...project.stages[n-1]};delete stageState.executionPrompt;delete stageState.executionPromptGeneratedAt;delete stageState.executionPromptSourceHash;const data={job:stagePromptSafe(project.job),projectId:project.projectId,projectName:project.name,currentStage:stagePromptSafe(stageState)};
  for(const name of spec.inputs||[]){
    if(name==='job')continue;
    if(Array.isArray(project[name]))data[name]=stagePromptSafe(project[name]);
  }
  if(n>1)data.priorStage={number:n-1,name:project.stages[n-2].name,status:project.stages[n-2].status,completionEvidence:stagePromptSafe(project.stages[n-2].completionEvidence)};
  return data;
}
function buildStageExecutionPrompt(project,n){
  const spec=STAGE_PROMPT_SPECS[n],stage=project.stages[n-1],manifest=STAGES[n-1];
  if(!spec)throw Error(`No stage prompt specification exists for Stage ${n}.`);
  const owner=`${stage.assignedActorType||'HUMAN'}${stage.assignedActorName?` — ${stage.assignedActorName}`:''}`;
  const packageNames=(spec.inputs||[]).join(', ')||'stage completion evidence';
  return [
    'CLOSED-LOOP AGENT RELIABILITY — STAGE EXECUTION PROMPT',
    `STAGE ${n} OF 31 — ${manifest.name}`,
    `ROLE\nYou are the ${spec.role}.`,
    `JOB CONTROL\nPROJECT_ID: ${project.projectId}\nPROJECT_NAME: ${project.name}\nWORK_OWNER: ${owner}\nCURRENT_STAGE_STATUS: ${stage.status}\nAUTHORIZED PROJECT COLLECTIONS: ${packageNames}`,
    spec.runTemplate?`REUSABLE RUN TEMPLATE\n${spec.runTemplate}`:'',
    `AUTHORIZED INPUT RULE\nUse only the exact authorized records and files listed in this prompt or attached with the exported current project. Treat USER JOB INPUT as intent and supplied facts. Treat EXTERNAL RESEARCH SOURCE as independent authority only when registered and actually accessed. Treat WORKFLOW-GENERATED ARTIFACT as evidence of workflow activity, never as retroactive external authority.`,
    `TASK\n${spec.task}`,
    `REQUIRED OUTPUT\n${spec.output}`,
    `NATIVE RECORD SCHEMA TO POPULATE\n${stagePromptRecordSchema(n)}`,
    `HUMAN / AGENT BOUNDARY\nThe application keeps humans, agents, human-agent teams, tools, and organizations as first-class work owners. This prompt delegates only this stage's assigned work. It does not replace the structured human-operable records, stage gates, or independent review requirements.`,
    `UNIVERSAL OPERATING RULES\n- Perform this stage now; do not return a plan for someone else.\n- Do not perform a later stage.\n- Do not invent facts, sources, tool use, execution, test results, evidence, file contents, or hashes.\n- Use UNKNOWN only when the authorized evidence and available tools cannot establish the fact.\n- A mandatory unknown is BLOCKED.\n- Do not silently resolve authoritative conflicts.\n- Use SATISFIED, VIOLATED, or UNDETERMINED for requirement outcomes.\n- Use ACCEPTED, REJECTED, or BLOCKED only where the release stage requires it.\n- Preserve exact IDs, versions, source locations, product locations, tool evidence, and dependencies.\n- Return completed stage work, not generic agent instructions.`,
    `AUTHORIZED PROJECT DATA\n${JSON.stringify(stagePromptAuthorizedData(project,n),null,2)}`,
    `ATTACHMENTS\nAttach the current exported project JSON and every exact external file or product file referenced by the authorized records. Do not rely on memory from another chat.`
  ].filter(Boolean).join('\n\n');
}
function renderStagePrompt(project,n){
  const stage=project.stages[n-1],required=stagePromptRequired(stage),prompt=String(stage.executionPrompt||'');
  const runNote=[11,12,18,20].includes(n)?'<div class="warning"><strong>One reusable prompt</strong> Use the same prompt in fresh contexts with the RUN_ID or MODE placeholders. The app does not generate ten different prompts.</div>':'';
  return `<div class="recordGroup" data-stage-prompt-system="true"><div class="groupHeader"><div><h3>Stage ${n} execution prompt</h3><div class="fine muted">${required?'Required for the assigned agent or human-agent team.':'Optional support for a human-owned stage.'} This prompt performs only ${esc(STAGES[n-1].name)} and uses this stage's exact inputs and native record schema.</div></div><div class="actions tight"><button class="btn small primary" data-generate-stage-prompt data-stage="${n}">${prompt?'Regenerate':'Generate'} stage prompt</button><button class="btn small" data-copy-stage-prompt data-stage="${n}" ${prompt?'':'disabled'}>Copy stage prompt</button><button class="btn small" data-download-stage-prompt data-stage="${n}" ${prompt?'':'disabled'}>Download prompt</button></div></div>${runNote}${prompt?`<div class="field"><label>Copy-ready prompt</label><textarea readonly data-stage-prompt-text="${n}" style="min-height:260px">${esc(prompt)}</textarea></div><div class="fine muted">Generated ${esc(stage.executionPromptGeneratedAt||'')} · Source SHA-256: <span class="hash">${esc(stage.executionPromptSourceHash||'not calculated')}</span></div>`:'<div class="empty">No prompt generated for this stage yet.</div>'}</div>`;
}
async function generateStagePrompt(n,{copy=false}={}){
  const project=cur();if(!project)return'';
  try{
    invalidateFrom(project,n,`Stage ${n} execution prompt regenerated.`);
    const stage=project.stages[n-1];
    const sourceSnapshot=stagePromptAuthorizedData(project,n);
    stage.executionPrompt=buildStageExecutionPrompt(project,n);
    stage.executionPromptGeneratedAt=now();
    stage.executionPromptSourceHash=await sha256Text(stableStringify(sourceSnapshot));
    stage.status=stage.status==='NOT_STARTED'?'IN_PROGRESS':stage.status;
    stage.startedAt=stage.startedAt||now();
    stage.updatedAt=now();
    updateProjectTimestamp(project);save();renderAll();
    if(copy)await navigator.clipboard.writeText(stage.executionPrompt);
    toast(copy?`Stage ${n} prompt generated and copied.`:`Stage ${n} prompt generated.`,'good');
    return stage.executionPrompt;
  }catch(error){toast(error.message,'bad');return''}
}
async function copyStagePrompt(n){
  const project=cur();if(!project)return;
  const prompt=project.stages[n-1].executionPrompt||await generateStagePrompt(n);
  if(!prompt)return;
  try{await navigator.clipboard.writeText(prompt);toast(`Stage ${n} prompt copied.`,'good')}catch{toast('Clipboard access failed. Use Download prompt.','bad')}
}
async function downloadStagePrompt(n){
  const project=cur();if(!project)return;
  const prompt=project.stages[n-1].executionPrompt||await generateStagePrompt(n);
  if(!prompt)return;
  const name=`${project.projectId}__STAGE-${String(n).padStart(2,'0')}__PROMPT.txt`;
  downloadBlob(new TextEncoder().encode(prompt),name,'text/plain; charset=utf-8');
}

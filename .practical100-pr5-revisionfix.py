from pathlib import Path

# Prompt registration belongs to the workflow engine; bind identity to the revision that will be committed.
p=Path('workflow-engine.js');s=p.read_text()
marker='globalThis.closedLoopWorkflowEngine=Object.freeze({'
assert marker in s
command=r'''
function registerGeneratedPrompt(project,promptRecord){
  ensureShape(project);if(!promptRecord?.instructionId||!Number.isInteger(Number(promptRecord?.stage)))throw new Error('A complete generated prompt record is required.');
  const expectedRevision=Number(project.revision||0)+1;if(Number(promptRecord.scope?.projectRevision)!==expectedRevision)throw new Error(`Generated prompt revision ${promptRecord.scope?.projectRevision} does not match next committed revision ${expectedRevision}.`);
  const existing=safe(project.projectData.generatedPrompts).find(x=>x.instructionId===promptRecord.instructionId);if(existing)return existing;
  const invalidationId=`PROMPT-SUPERSEDED-${promptRecord.instructionId}`;for(const prior of safe(project.projectData.generatedPrompts).filter(x=>Number(x.stage)===Number(promptRecord.stage)&&!x.invalidatedBy))prior.invalidatedBy=invalidationId;
  const record={...clone(promptRecord),source:'APPLICATION_PROMPT_REGISTRATION'};project.projectData.generatedPrompts.push(record);project.stages[Number(record.stage)].currentPromptId=record.instructionId;
  addHistory(project,'INSTRUCTION_SAVED',{recordId:record.instructionId,stage:Number(record.stage),sha256:record.bodySha256||record.sha256,projectRevision:expectedRevision});return record;
}
'''
assert 'function registerGeneratedPrompt(' not in s
s=s.replace(marker,command+'\n'+marker,1)
anchor='clone,now,safe,upper,truth,falsey,numeric,recordFields,recordValue,recordId,isActiveRecord,records,'
assert anchor in s
s=s.replace(anchor,anchor+'registerGeneratedPrompt,',1)
p.write_text(s)

# Generate previews for the next committed revision and persist exactly that prompt before copy or ingestion.
p=Path('app-core.js');s=p.read_text()
old="function currentStagePrompt(n){const saved=safe(current.projectData.generatedPrompts).filter(x=>Number(x.stage)===n);if(current.stages[n].status==='COMPLETE'&&saved.length&&saved.at(-1)?.prompt)return saved.at(-1).prompt;return globalThis.closedLoopPromptEngine.buildPromptRecord(n,current).prompt;}"
new="function currentPromptRecord(n){return safe(current.projectData.generatedPrompts).filter(x=>Number(x.stage)===Number(n)&&!x.invalidatedBy&&Number(x.scope?.projectRevision)===Number(current.revision||0)).at(-1)||null;}\nfunction currentStagePrompt(n){const saved=currentPromptRecord(n);if(saved?.prompt)return saved.prompt;const preview=clone(current);preview.revision=Number(current.revision||0)+1;return globalThis.closedLoopPromptEngine.buildPromptRecord(n,preview).prompt;}"
assert old in s;s=s.replace(old,new,1)
start=s.index('async function savePromptRecord(n){')
end=s.index('\nasync function prepareStageResponse()',start)
new_fn=r'''async function savePromptRecord(n){
  const existing=currentPromptRecord(n);if(existing)return existing;
  const preview=clone(current);preview.revision=Number(current.revision||0)+1;
  const candidate=globalThis.closedLoopPromptEngine.buildPromptRecord(n,preview),next=clone(current),record={...candidate,generatedAt:new Date().toISOString(),iteration:current.job.CURRENT_ITERATION||'NOT APPLICABLE'};
  engine.registerGeneratedPrompt(next,record);await persistReplacement(next);
  const committed=currentPromptRecord(n);if(!committed||committed.instructionId!==record.instructionId)throw new Error('The generated prompt was not committed with its controlling revision.');return committed;
}'''
s=s[:start]+new_fn+s[end:]
# The proposal transaction will commit one revision after the current prompt/raw state.
s=s.replace("const prepared=ingestion.prepare(current,{stage:n,text,promptRecord:prompt,files:safe(current.stages[n].authorizedFiles)});","const prepared=ingestion.prepare(current,{stage:n,text,promptRecord:prompt,files:safe(current.stages[n].authorizedFiles),expectedProjectRevision:Number(current.revision||0)+1});",1)
s=s.replace("if($('#save-prompt'))$('#save-prompt').onclick=async()=>{await savePromptRecord(current.activeStage);await save();render();};","if($('#save-prompt'))$('#save-prompt').onclick=async()=>{await savePromptRecord(current.activeStage);render();};",1)
s=s.replace("if($('#copy-prompt'))$('#copy-prompt').onclick=async()=>{const record=await savePromptRecord(current.activeStage);await save();await navigator.clipboard?.writeText(record.prompt);};","if($('#copy-prompt'))$('#copy-prompt').onclick=async()=>{const record=await savePromptRecord(current.activeStage);await navigator.clipboard?.writeText(record.prompt);};",1)
p.write_text(s)

# Proposal staleness is checked against the revision that contains the durable proposal.
p=Path('response-ingestion.js');s=p.read_text()
old="function proposalPreconditions(project,envelope,promptRecord){return {projectRevision:Number(project.revision||0),instructionId:promptRecord?.instructionId||promptRecord?.promptId||null,bodySha256:promptRecord?.bodySha256||promptRecord?.sha256||null,contractSha256:promptRecord?.contractSha256||null,contextSignature:promptRecord?.contextSignature||null,scopeSha256:hash.sha256Value(envelope.scope||{}),referencedRecordHashes:referencedRecordHashes(project,envelope)};}"
new="function proposalPreconditions(project,envelope,promptRecord,expectedProjectRevision=Number(project.revision||0)){return {projectRevision:Number(expectedProjectRevision),instructionId:promptRecord?.instructionId||promptRecord?.promptId||null,bodySha256:promptRecord?.bodySha256||promptRecord?.sha256||null,contractSha256:promptRecord?.contractSha256||null,contextSignature:promptRecord?.contextSignature||null,scopeSha256:hash.sha256Value(envelope.scope||{}),referencedRecordHashes:referencedRecordHashes(project,envelope)};}"
assert old in s;s=s.replace(old,new,1)
s=s.replace("function planProposal(project,envelope,{rawRecord,promptRecord,validationRecord}){","function planProposal(project,envelope,{rawRecord,promptRecord,validationRecord,expectedProjectRevision=Number(project.revision||0)}){",1)
s=s.replace("preconditions:proposalPreconditions(project,envelope,promptRecord),","preconditions:proposalPreconditions(project,envelope,promptRecord,expectedProjectRevision),",1)
s=s.replace("function prepare(project,{stage,text,promptRecord,contextId='UNKNOWN',files=[]}={}){","function prepare(project,{stage,text,promptRecord,contextId='UNKNOWN',files=[],expectedProjectRevision=Number(project?.revision||0)}={}){",1)
s=s.replace("proposal=planProposal(next,envelope,{rawRecord,promptRecord:prompt,validationRecord});","proposal=planProposal(next,envelope,{rawRecord,promptRecord:prompt,validationRecord,expectedProjectRevision});",1)
p.write_text(s)

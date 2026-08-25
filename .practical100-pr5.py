from pathlib import Path
import re

# Fix and complete the IndexedDB adapter already introduced on this PR branch.
p=Path('project-store.js'); s=p.read_text()
s=s.replace("const byteSize=blob.size,sha256=await hash.sha256Bytes(blob),db=await openDatabase()", "const byteSize=blob.size,sha256=await hash.sha256Bytes(await blob.arrayBuffer()),db=await openDatabase()")
s=s.replace("await hash.sha256Bytes(verified.blob)!==sha256", "await hash.sha256Bytes(await verified.blob.arrayBuffer())!==sha256")
p.write_text(s)

# Add validated workflow-engine commands so app-core never constructs canonical records.
p=Path('workflow-engine.js'); s=p.read_text()
marker='globalThis.closedLoopWorkflowEngine=Object.freeze({'
assert marker in s
commands=r'''
function commandRecord(project,collection,fields,{stage=null,source='APPLICATION_COMMAND',scope=null}={}){
  ensureShape(project);const definition=schema.RECORD_SCHEMAS[collection];if(!definition)throw new Error(`Unknown canonical collection: ${collection}.`);
  const id=allocateId(project,collection),deviceTimestamp=now(),full={...clone(fields),[definition.idField]:id};
  const record={id,stage:stage??Number(project.activeStage||0)||null,createdAt:deviceTimestamp,updatedAt:deviceTimestamp,active:true,scope:scope||currentScope(project),fields:full,...full,source};
  record.contentSha256=hash.contentSha256?hash.contentSha256({fields:full,relationships:{},evidenceRefs:[]}):hash.sha256Value(full);
  record.recordSha256=hash.recordSha256?hash.recordSha256(record):hash.sha256Value(record);record.sha256=record.recordSha256;
  project.projectData[collection].push(record);return record;
}
function createHumanBlocker(project,{stage=project.activeStage,reason,operatorLabel='HUMAN_OPERATOR'}={}){
  if(!String(reason||'').trim())throw new Error('A blocker reason is required.');
  const record=commandRecord(project,'blockers',{MISSING_ITEM_TYPE:'UNRESOLVED',MISSING_FACT_INPUT_AUTHORITY_EVIDENCE_CAPABILITY_DECISION_RULE:String(reason).trim(),AFFECTED_REQUIREMENTS:'UNKNOWN',AFFECTED_TESTS:'UNKNOWN',AFFECTED_ARTIFACTS:'UNKNOWN',WHY_WORK_CANNOT_CONTINUE:String(reason).trim(),ATTEMPTED_RESOLUTIONS:'NONE',DOWNSTREAM_WORK_STOPPED:`STAGE ${String(stage).padStart(2,'0')} AND DEPENDENT WORK`,OWNER:operatorLabel,STATUS:'OPEN',RESOLUTION_EVIDENCE:'NONE',CLOSURE:'OPEN',REEVALUATION:'REQUIRED',REQUIRED_REVALIDATION:'REQUIRED'},{stage,source:'HUMAN_DECISION'});
  addHistory(project,'HUMAN_BLOCKER_CREATED',{stage,recordId:record.id,operatorLabel,identityAssurance:'SELF_ASSERTED'});recalculate(project);return record;
}
function registerFreshContext(project,{stage=project.activeStage,externalContextIdentifier,operatorLabel='HUMAN_OPERATOR'}={}){
  if(!String(externalContextIdentifier||'').trim())throw new Error('An external fresh-context identifier is required.');
  const record=commandRecord(project,'freshContexts',{EXTERNAL_CONTEXT_IDENTIFIER:String(externalContextIdentifier).trim(),ROLE:core.STAGES[Number(stage)-1]?.role||'UNKNOWN',ITERATION_ID:project.job.CURRENT_ITERATION||'NOT APPLICABLE',RUN_ID:'NOT APPLICABLE',AUTHORIZED_PROJECT_INPUTS:project.job.CURRENT_INPUT_VERSION||'UNKNOWN',AUTHORIZED_EXTERNAL_SOURCE_MATERIAL:project.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',FROZEN_ARTIFACT_VERSIONS:'CURRENT AUTHORIZED VERSIONS',TOOL_AVAILABILITY:'UNKNOWN',CONTAMINATION_STATUS:'UNKNOWN',OUTPUT_IDENTITY:'UNKNOWN',DEVIATIONS:'NONE RECORDED',EVIDENCE:'Context identifier supplied by operator.',USABILITY_DETERMINATION:'UNKNOWN'},{stage,source:'HUMAN_INPUT'});
  addHistory(project,'FRESH_CONTEXT_REGISTERED',{stage,recordId:record.id,operatorLabel,identityAssurance:'SELF_ASSERTED'});recalculate(project);return record;
}
function recordHumanDecision(project,{stage=project.activeStage,field,value,operatorLabel='HUMAN_OPERATOR'}={}){
  ensureShape(project);const definition=schema.STAGE_FIELDS[stage]?.[field];if(!definition)throw new Error(`Unknown Stage ${stage} field ${field}.`);
  schema.authorizeMutation({fieldDefinition:definition,actor:definition.producer===schema.PRODUCER.HUMAN?'HUMAN':'HUMAN_DECISION',mutationType:'SET'});
  project.stages[stage].humanData[field]=clone(value);const event=addHistory(project,'HUMAN_DECISION_RECORDED',{stage,field,value:clone(value),operatorLabel,identityAssurance:'SELF_ASSERTED'});recalculate(project);return event;
}
function invalidateAcceptedResponse(project,{stage=project.activeStage,rawResponseId,reason='Corrected response required.',operatorLabel='HUMAN_OPERATOR'}={}){
  ensureShape(project);const change=acceptedChanges(project,stage).find(item=>!rawResponseId||item.rawResponseId===rawResponseId);if(!change)throw new Error('No current accepted data change exists for invalidation.');
  const event=addHistory(project,'ACCEPTED_RESPONSE_INVALIDATED',{stage,rawResponseId:change.rawResponseId,reason,operatorLabel,identityAssurance:'SELF_ASSERTED'});change.invalidatedBy=event.eventId;invalidateDownstream(project,stage,event.eventId,reason);recalculate(project);return event;
}
function reserveRunBatch(project,{stage=project.activeStage,iterationId=null,candidateId=null,count=10}={}){
  ensureShape(project);if(count!==10)throw new Error('Run batches must contain exactly ten slots.');const resolvedIteration=iterationId||project.job.CURRENT_ITERATION;if(!resolvedIteration)throw new Error('A current iteration is required before reserving runs.');
  const created=[];for(let i=0;i<count;i++){const context=commandRecord(project,'freshContexts',{EXTERNAL_CONTEXT_IDENTIFIER:'UNASSIGNED',ROLE:core.STAGES[Number(stage)-1]?.role||'UNKNOWN',ITERATION_ID:resolvedIteration,RUN_ID:'PENDING',AUTHORIZED_PROJECT_INPUTS:project.job.CURRENT_INPUT_VERSION||'UNKNOWN',AUTHORIZED_EXTERNAL_SOURCE_MATERIAL:project.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',FROZEN_ARTIFACT_VERSIONS:'CURRENT AUTHORIZED VERSIONS',TOOL_AVAILABILITY:'UNKNOWN',CONTAMINATION_STATUS:'UNKNOWN',OUTPUT_IDENTITY:'UNKNOWN',DEVIATIONS:'NONE',EVIDENCE:'Application-reserved context slot.',USABILITY_DETERMINATION:'PENDING'},{stage,source:'APPLICATION_RESERVATION'});const run=commandRecord(project,'runs',{ITERATION_ID:resolvedIteration,CANDIDATE_ID:candidateId||'PENDING',CONTEXT_ID:context.id,FRESH_CONTEXT_RECORD:context.id,CONTAMINATION_CHECK:'PENDING',TOOL_CONFIGURATION:'PENDING',EXECUTION_STATUS:'RESERVED',COMPLETE_OUTPUT:''},{stage,source:'APPLICATION_RESERVATION'});context.fields.RUN_ID=context.RUN_ID=run.id;created.push({runId:run.id,contextId:context.id});}
  addHistory(project,'RUN_BATCH_RESERVED',{stage,iterationId:resolvedIteration,count,slots:created});recalculate(project);return created;
}
function registerArtifactBytes(project,{stage=project.activeStage,artifactId,filename,mediaType,byteSize,sha256,lineage={},role='STAGE_ARTIFACT'}={}){
  ensureShape(project);if(!artifactId||!filename||!Number.isInteger(Number(byteSize))||Number(byteSize)<0||!/^[a-f0-9]{64}$/i.test(String(sha256||'')))throw new Error('Verified artifact identity is incomplete.');
  if(records(project,'artifacts',{active:false}).some(r=>recordId(r,'artifacts')===String(artifactId)))return records(project,'artifacts',{active:false}).find(r=>recordId(r,'artifacts')===String(artifactId));
  const fields={FILENAME:String(filename),TYPE:String(mediaType||'application/octet-stream'),VERSION:'APPLICATION-CONTROLLED',BYTE_SIZE:Number(byteSize),SHA256:String(sha256).toLowerCase(),ROLE:role,STORAGE_REFERENCE:`indexeddb:${artifactId}`,AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED',NOTES:JSON.stringify(lineage)};
  const definition=schema.RECORD_SCHEMAS.artifacts,id=String(artifactId),deviceTimestamp=now(),full={...fields,[definition.idField]:id};const record={id,stage,createdAt:deviceTimestamp,updatedAt:deviceTimestamp,active:true,scope:currentScope(project),fields:full,...full,source:'APPLICATION_BYTES_VERIFIED'};record.contentSha256=hash.sha256Value(fields);record.recordSha256=hash.sha256Value(record);record.sha256=record.recordSha256;project.projectData.artifacts.push(record);addHistory(project,'ARTIFACT_BYTES_REGISTERED',{stage,artifactId:id,byteSize:Number(byteSize),sha256:String(sha256).toLowerCase()});recalculate(project);return record;
}
function freezeCandidate(project,options={}){addHistory(project,'CANDIDATE_FREEZE_REQUESTED',{stage:10,...clone(options)});return options;}
function freezeBaseline(project,options={}){addHistory(project,'BASELINE_FREEZE_REQUESTED',{stage:20,...clone(options)});return options;}
'''
s=s.replace(marker,commands+'\n'+marker,1)
# Add commands to engine export.
export_anchor='clone,now,safe,upper,truth,falsey,numeric,recordFields,recordValue,recordId,isActiveRecord,records,'
assert export_anchor in s
s=s.replace(export_anchor,export_anchor+'createHumanBlocker,registerFreshContext,recordHumanDecision,invalidateAcceptedResponse,reserveRunBatch,registerArtifactBytes,freezeCandidate,freezeBaseline,',1)
p.write_text(s)

# Patch app-core to use IndexedDB asynchronously and engine-owned command paths.
p=Path('app-core.js'); s=p.read_text()
old="function persistAll(nextProjects){projectStore.writeAll(nextProjects);projects=nextProjects;}\nfunction persistReplacement(next){engine.ensureShape(next);engine.recalculate(next);const candidate=projects.map(p=>p===current?next:p);if(!candidate.includes(next)&&!candidate.some(p=>p.job?.JOB_ID===next.job?.JOB_ID))candidate.unshift(next);projectStore.writeAll(candidate);projects=candidate;current=next;return next;}\nfunction save(){try{projectStore.writeAll(projects);return true;}catch(error){console.error(error);alert(`Save failed without replacing the prior persisted project state: ${error.message||error}`);return false;}}"
new="async function persistAll(nextProjects){projects=await projectStore.writeAll(nextProjects);return projects;}\nasync function persistReplacement(next){engine.ensureShape(next);engine.recalculate(next);const committed=await projectStore.replaceProject(next,{expectedProjectRevision:Number(current?.revision||0)});projects=projects.map(p=>p===current||p.job?.JOB_ID===committed.job?.JOB_ID?committed:p);if(!projects.some(p=>p.job?.JOB_ID===committed.job?.JOB_ID))projects.unshift(committed);current=committed;return committed;}\nasync function save(){try{projects=await projectStore.writeAll(projects);current=projects.find(p=>p.job?.JOB_ID===current?.job?.JOB_ID)||current;announce('saved');return true;}catch(error){console.error(error);announce('storage failed');alert(`Save failed without replacing the prior persisted project state: ${error.message||error}`);return false;}}"
assert old in s;s=s.replace(old,new,1)
# Simple live status helper.
insert="const statusClass=v=>"
pos=s.find(insert);assert pos>=0
# inject announce after statusClass line's semicolon
semi=s.find(';',pos);s=s[:semi+1]+"\nfunction announce(message){const node=$('#app-live-status');if(node)node.textContent=String(message||'');}"+s[semi+1:]

# Typed clarification renderer.
old=re.search(r"function clarificationMarkup\(n,locked\)\{.*?\}\nfunction currentStagePrompt",s,re.S);assert old
new=r'''function humanAnswerControl(q){const id=esc(q.requestId),values=safe(q.allowedValues);switch(q.answerType){case 'TEXT':return `<input data-human-answer="${id}" type="text">`;case 'LONG_TEXT':return `<textarea data-human-answer="${id}"></textarea>`;case 'BOOLEAN':return `<select data-human-answer="${id}"><option value=""></option><option value="true">true</option><option value="false">false</option></select>`;case 'NUMBER':return `<input data-human-answer="${id}" type="number" step="any">`;case 'CHOICE':return `<select data-human-answer="${id}"><option value=""></option>${values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select>`;case 'MULTI_CHOICE':return `<select data-human-answer="${id}" multiple>${values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select>`;case 'DATE':return `<input data-human-answer="${id}" type="date">`;case 'FILE_REFERENCE':{const artifacts=engine.records(current,'artifacts');return `<select data-human-answer="${id}"><option value=""></option>${artifacts.map(a=>`<option value="${esc(engine.recordId(a,'artifacts'))}">${esc(recordValue(a,'FILENAME')||engine.recordId(a,'artifacts'))}</option>`).join('')}</select>`;}default:return `<textarea data-human-answer="${id}"></textarea>`;}}
function clarificationMarkup(n,locked){const items=engine.unresolvedHumanRequests(current,n);if(!items.length)return '';return `<div class="panel"><h2 class="section-title">Human clarification required</h2><p class="section-intro">Answer only these human-authority questions. Answers are type-validated and versioned as User Job Input before the same stage instruction is regenerated.</p>${items.map(q=>`<div class="field"><label>${esc(q.question)}</label><span class="help">${esc(q.whyRequired)}</span>${humanAnswerControl(q)}</div>`).join('')}<div class="button-row"><button class="primary" id="save-human-answers"${locked?' disabled':''}>Save human answers</button></div></div>`;}
function currentStagePrompt'''
s=s[:old.start()]+new+s[old.end():]

# Concise proposal diff with raw under disclosure.
old=re.search(r"function proposalMarkup\(n\)\{.*?\}\nfunction stageConfirmationMarkup",s,re.S);assert old
new=r'''function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>Number(x.stage)===n&&x.status==='PENDING_OPERATOR_REVIEW').at(-1);if(!p)return validationMarkup(n);const rows=safe(p.changes).map(c=>({recordType:c.canonicalRecordType||c.canonicalCollection||'stageData',temporaryKey:c.temporaryResponseKey||'',canonicalId:c.canonicalRecordId||'APPLICATION_ASSIGNED',field:c.canonicalField||c.canonicalRelationship||'',proposedValue:c.normalizedValue,jsonPointer:c.jsonPointer||'',evidence:c.evidenceIds||'',validation:'SATISFIED'}));return `<div class="panel" id="proposal-heading" tabindex="-1"><h2 class="section-title">Proposed extracted changes</h2><p class="section-intro">Nothing below is canonical until you accept the complete validated proposal.</p>${details('Proposal diff',rows,true)}<details class="record-card"><summary>Advanced raw proposal<span>Audit</span></summary><div class="record-body">${details('Complete proposal',p)}</div></details><div class="button-row"><button class="primary" id="accept-proposal">Accept response</button><button id="reject-proposal">Reject response</button><button id="request-correction">Request correction</button></div></div>`;}
function stageConfirmationMarkup'''
s=s[:old.start()]+new+s[old.end():]

# Replace support controls with inline validated forms and remove generic controlled-change form.
old=re.search(r"function controls\(d,locked\)\{.*?\}\nfunction workflow",s,re.S);assert old
new=r'''function controls(d,locked){const n=d.number,allowFresh=schema.STAGE_CONTRACTS[n].supportCollections.includes('freshContexts'),runBatch=[11,12,17,19].includes(n);return `<details class="record-card"><summary>Supporting records<span>Contextual</span></summary><div class="record-body"><p class="section-intro">Use authority-specific controls only. Canonical IDs, lifecycle state, timestamps, and hashes are application-assigned.</p><div class="field"><label>Blocker reason</label><textarea id="blocker-reason"></textarea></div><div class="button-row"><button id="add-blocker"${locked?' disabled':''}>Create blocker</button></div>${allowFresh?`<div class="field"><label>External fresh-context identifier</label><input id="fresh-context-id"></div><div class="button-row"><button id="add-fresh-context"${locked?' disabled':''}>Register fresh context</button></div>`:''}${runBatch?`<div class="button-row"><button id="reserve-run-batch"${locked?' disabled':''}>Reserve ten run/context slots</button></div>`:''}<div class="field"><label>Operator label</label><input id="operator-label" value="HUMAN_OPERATOR"><span class="help">Identity assurance: SELF_ASSERTED</span></div></div></details>`;}
function workflow'''
s=s[:old.start()]+new+s[old.end():]

# Replace direct canonical UI actions.
old=re.search(r"function canonicalSupportRecord\(.*?\nasync function hashFile",s,re.S);assert old
new=r'''async function addBlocker(){const reason=$('#blocker-reason')?.value.trim(),operatorLabel=$('#operator-label')?.value.trim()||'HUMAN_OPERATOR';if(!reason){alert('A blocker reason is required.');return;}const next=clone(current);engine.createHumanBlocker(next,{stage:current.activeStage,reason,operatorLabel});await persistReplacement(next);announce('saved');render();}
async function addFreshContext(){const externalContextIdentifier=$('#fresh-context-id')?.value.trim(),operatorLabel=$('#operator-label')?.value.trim()||'HUMAN_OPERATOR';if(!externalContextIdentifier){alert('An external fresh-context identifier is required.');return;}const next=clone(current);engine.registerFreshContext(next,{stage:current.activeStage,externalContextIdentifier,operatorLabel});await persistReplacement(next);announce('saved');render();}
async function reserveRunBatch(){const next=clone(current);try{engine.reserveRunBatch(next,{stage:current.activeStage,count:10});await persistReplacement(next);announce('saved');render();}catch(error){alert(error.message||error);}}
async function hashFile'''
s=s[:old.start()]+new+s[old.end():]
# Replace hashFile body so actual bytes persist.
old=re.search(r"async function hashFile\(file\)\{return \{.*?\};\}\nfunction wire",s,re.S);assert old
new=r'''async function hashFile(file){const artifactId=crypto.randomUUID?.()||`ARTIFACT-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,blob=file.slice(0,file.size,file.type||'application/octet-stream'),stored=await projectStore.putArtifact({artifactId,jobId:current.job.JOB_ID,blob,filename:file.name,mediaType:file.type||'application/octet-stream',lineage:{stage:current.activeStage,role:core.STAGES[current.activeStage-1]?.role||'UNKNOWN'}});const next=clone(current);engine.registerArtifactBytes(next,{stage:current.activeStage,artifactId,filename:stored.filename,mediaType:stored.mediaType,byteSize:stored.byteSize,sha256:stored.sha256,lineage:stored.lineage});current=next;return {artifactId,name:stored.filename,type:stored.mediaType,size:stored.byteSize,sha256:stored.sha256,stage:`STAGE ${String(current.activeStage).padStart(2,'0')}`,role:core.STAGES[current.activeStage-1]?.role||'UNKNOWN',retainedBytes:true,availability:'IndexedDB Blob bytes persisted and rehashed on read-back.',addedAt:new Date().toISOString()};}
function wire'''
s=s[:old.start()]+new+s[old.end():]

# Async mutation handlers and run batch wiring.
s=s.replace("function acceptPendingProposal(){", "async function acceptPendingProposal(){")
s=s.replace("persistReplacement(result.project);render();}catch(error){alert(`Response was not committed", "await persistReplacement(result.project);announce('response accepted');render();}catch(error){alert(`Response was not committed",1)
s=s.replace("function rejectPendingProposal(requestCorrection=false){", "async function rejectPendingProposal(requestCorrection=false){")
s=s.replace("persistReplacement(result.project);render();}\nasync function addBlocker", "await persistReplacement(result.project);announce('response rejected');render();}\nasync function addBlocker",1)
s=s.replace("persistReplacement(prepared.project);render();}catch(error){alert(`Response could not be preserved or validated", "await persistReplacement(prepared.project);announce(prepared.validation?.valid?'proposal ready':'validation failed');render();queueMicrotask(()=>$(prepared.validation?.valid?'#proposal-heading':'#validation-report')?.focus());}catch(error){alert(`Response could not be preserved or validated",1)
s=s.replace("function saveHumanStageFields(){", "async function saveHumanStageFields(){")
s=s.replace("function saveHumanAnswers(){", "async function saveHumanAnswers(){")
s=s.replace("function confirmStageOne(){", "async function confirmStageOne(){")
# Broadly convert persistence in these function sections where unique.
s=s.replace("persistReplacement(next);render();}\nfunction saveHumanStageFields", "await persistReplacement(next);render();}\nasync function saveHumanStageFields",1)
s=s.replace("persistReplacement(next);render();}\nasync function saveHumanAnswers", "await persistReplacement(next);render();}\nasync function saveHumanAnswers",1)
s=s.replace("persistReplacement(result.project);render();}catch(error){alert(error.message||error);}}\nasync function confirmStageOne", "await persistReplacement(result.project);render();}catch(error){alert(error.message||error);}}\nasync function confirmStageOne",1)
s=s.replace("persistReplacement(next);render();}\nasync function savePromptRecord", "await persistReplacement(next);render();}\nasync function savePromptRecord",1)
# saveJob already async
s=s.replace("persistReplacement(next);render();}\nasync function saveHumanStageFields", "await persistReplacement(next);render();}\nasync function saveHumanStageFields",1)
# Wire async navigation without canonical save-on-navigation.
s=s.replace("document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{current.activeView=b.dataset.view;save();render();});", "document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{current.activeView=b.dataset.view;render();});")
s=s.replace("document.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>{current.activeStage=Number(b.dataset.stage);current.activeView='Workflow';save();render();});", "document.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>{current.activeStage=Number(b.dataset.stage);current.activeView='Workflow';render();});")
s=s.replace("if($('#stage-picker'))$('#stage-picker').onchange=e=>{current.activeStage=Number(e.target.value);save();render();};", "if($('#stage-picker'))$('#stage-picker').onchange=e=>{current.activeStage=Number(e.target.value);render();};")
s=s.replace("if($('#record-controlled-change'))$('#record-controlled-change').onclick=recordControlledChange;", "if($('#reserve-run-batch'))$('#reserve-run-batch').onclick=reserveRunBatch;")
s=s.replace("if($('#stage-files'))$('#stage-files').onchange=async e=>{const next=clone(current);next.stages[current.activeStage].authorizedFiles.push(...await Promise.all(Array.from(e.target.files||[]).map(hashFile)));persistReplacement(next);render();};", "if($('#stage-files'))$('#stage-files').onchange=async e=>{try{const files=[];for(const file of Array.from(e.target.files||[]))files.push(await hashFile(file));const next=clone(current);next.stages[current.activeStage].authorizedFiles.push(...files);await persistReplacement(next);announce('saved');render();}catch(error){announce('storage failed');alert(`Artifact storage failed without authorizing metadata-only state: ${error.message||error}`);}};")

# Correct multi-choice extraction.
s=s.replace("const answers=Object.fromEntries([...document.querySelectorAll('[data-human-answer]')].map(x=>[x.dataset.humanAnswer,x.value]));", "const answers=Object.fromEntries([...document.querySelectorAll('[data-human-answer]')].map(x=>[x.dataset.humanAnswer,x.multiple?[...x.selectedOptions].map(o=>o.value):x.type==='number'?(x.value===''?'':Number(x.value)):x.value]));")

# Load IndexedDB asynchronously, request/display storage health, package import/export.
old=re.search(r"async function load\(\)\{.*?\}\n\$\('#project-picker'\)",s,re.S);assert old
new=r'''async function load(){core=globalThis.closedLoopCore;schema=globalThis.closedLoopWorkflowSchema;engine=globalThis.closedLoopWorkflowEngine;ingestion=globalThis.closedLoopResponseIngestion;projectStore=globalThis.closedLoopProjectStore;if(!core||!schema||!engine||!ingestion||!projectStore)throw new Error('Closed-loop runtime modules did not load.');await projectStore.ready;projects=(await projectStore.readAll()).filter(Boolean).map(normalize);try{const res=await fetch(`TEST_PROJECT.json?retained=${Date.now()}`,{cache:'no-store'});if(!res.ok)throw new Error(`HTTP ${res.status}`);let test=importSeed(await res.json()),i=projects.findIndex(p=>p.isRetainedTestProject||p.job.JOB_ID===test.job.JOB_ID);if(i>=0){const stored=projects[i];projects.splice(i,1);if(stored.retainedSpecRevision&&stored.retainedSpecRevision===test.retainedSpecRevision)test=stored;}projects.unshift(test);}catch(error){console.error('Bundled retained project could not load',error);}if(!projects.length)projects=[ensureState(core.createBlankState(createUniqueJobId()))];current=projects[0];await save();const health=await projectStore.storageHealth();globalThis.closedLoopStorageHealth=health;const node=$('#storage-status');if(node)node.textContent=`Storage: ${health.persistent?'persistent':'not persistent'} · ${health.usage??'unknown'} / ${health.quota??'unknown'} bytes · revision ${health.lastCommittedRevision?.revision??current.revision??0}`;render();}
$('#project-picker')'''
s=s[:old.start()]+new+s[old.end():]
# project picker must not save selection as canonical mutation
s=s.replace("$('#project-picker').onchange=e=>{current=projects[Number(e.target.value)];save();render();};", "$('#project-picker').onchange=e=>{current=projects[Number(e.target.value)];render();};")
# Export/import complete compressed package.
s=s.replace("$('#export-project').onclick=()=>{const blob=new Blob([JSON.stringify(current,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${current.job.JOB_ID||'project'}.json`;a.click();URL.revokeObjectURL(a.href);};", "$('#export-project').onclick=async()=>{try{const blob=await projectStore.exportPackage(current.job.JOB_ID),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${current.job.JOB_ID||'project'}.closed-loop.json.gz`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0);announce('saved');}catch(error){alert(`Complete export failed: ${error.message||error}`);}};")
old=re.search(r"\$\('#import-file'\)\.onchange=async e=>\{.*?\};\nif\(globalThis\.closedLoopCore\)",s,re.S);assert old
new=r'''$('#import-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;const before=clone(projects);try{const imported=await projectStore.importPackage(f);projects=(await projectStore.readAll()).filter(Boolean).map(normalize);current=projects.find(x=>x.job.JOB_ID===imported.job.JOB_ID)||projects[0];announce('project reloaded');render();}catch(error){projects=before;alert(`Import rejected without changing existing projects: ${error.message||error}`);}finally{e.target.value='';}};
if(globalThis.closedLoopCore)'''
s=s[:old.start()]+new+s[old.end():]

# Remove operational legacy nesting: archive as non-operational migration data.
s=s.replace("p.projectData.fullProject=clone(raw);", "p.projectData.migrationArchives=safe(p.projectData.migrationArchives);p.projectData.migrationArchives.push({kind:'ORIGINAL_IMPORT_PAYLOAD',operational:false,payload:clone(raw)});")
s=s.replace("if(r.status==='COMPLETE'||Object.keys(r).some(k=>k!=='status'))p.projectData.stageRecords[n]=clone(r);", "if(r.status==='COMPLETE'||Object.keys(r).some(k=>k!=='status'))p.projectData.migrationArchives.push({kind:'LEGACY_STAGE_RECORD',stage:n,operational:false,payload:clone(r)});")
s=s.replace("r.projectData.recoveredProjects=[{reason:String(error.message||error),completeOriginalProject:clone(p)}];", "r.projectData.recoveredProjects=[{reason:String(error.message||error),quarantinedOriginalProject:clone(p),operational:false}];")

p.write_text(s)

# Add storage/accessibility status regions and CSP without changing the shell.
p=Path('index.html'); s=p.read_text()
if('http-equiv="Content-Security-Policy"' not in s:
    s=s.replace('<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">','<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n<meta http-equiv="Content-Security-Policy" content="default-src \'self\' data: blob:; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; connect-src \'self\'; object-src \'none\'; base-uri \'none\'">',1)
body=s.find('<body');body_end=s.find('>',body)
assert body>=0
s=s[:body_end+1]+"\n<div id=\"app-live-status\" aria-live=\"polite\" class=\"sr-only\"></div>\n"+s[body_end+1:]
# Put storage status into existing header if possible.
needle='<div class="progress-line">'
assert needle in s
s=s.replace(needle,'<div id="storage-status" class="brand p" role="status">Storage status loading…</div>'+needle,1)
if '.sr-only{' not in s:
    s=s.replace('</style>','.sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}\n</style>',1)
p.write_text(s)

# Verification: enforce no direct app-core canonical writes/prompt(), IndexedDB and Blob/package surfaces.
p=Path('verify.mjs'); s=p.read_text()
append=r'''
// Practical-100 PR5 persistence/UI boundaries.
{
 const storeSource=fs.readFileSync('project-store.js','utf8'),appSource=fs.readFileSync('app-core.js','utf8'),engineSource=fs.readFileSync('workflow-engine.js','utf8');
 for(const token of ["DB_NAME='closed-loop-reliability'","createObjectStore(PROJECTS","createObjectStore(ARTIFACTS","createObjectStore(META",'expectedProjectRevision','BroadcastChannel','putArtifact','exportPackage','importPackage','CompressionStream','projectSha256'])if(!storeSource.includes(token))throw new Error(`PR5 storage boundary missing ${token}.`);
 if(/\bprompt\s*\(/.test(appSource))throw new Error('Browser prompt() remains in app-core canonical actions.');
 if(/projectData\s*\[[^\]]+\]\s*\.push\s*\(/.test(appSource))throw new Error('Direct projectData collection push remains in app-core.');
 for(const command of ['createHumanBlocker','registerFreshContext','invalidateAcceptedResponse','recordHumanDecision','freezeCandidate','freezeBaseline','reserveRunBatch','registerArtifactBytes'])if(!engineSource.includes(`function ${command}`))throw new Error(`Engine command missing ${command}.`);
 for(const token of ['identityAssurance','SELF_ASSERTED','MULTI_CHOICE','FILE_REFERENCE','Proposal diff','retainedBytes:true'])if(!appSource.includes(token))throw new Error(`PR5 UI boundary missing ${token}.`);
}
'''
s+=append
p.write_text(s)

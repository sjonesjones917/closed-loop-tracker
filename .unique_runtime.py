from pathlib import Path

def once(s, old, new, label):
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected one match, found {n}')
    return s.replace(old,new,1)

# workflow-engine: recovery, exact candidate reservation, derived Stage17/19 operation sequencing.
p=Path('workflow-engine.js');s=p.read_text()
old="""function invalidateAcceptedResponse(project,{stage=project.activeStage,rawResponseId,reason='Corrected response required.',operatorLabel='HUMAN_OPERATOR'}={}){
  ensureShape(project);const change=acceptedChanges(project,stage).find(item=>!rawResponseId||item.rawResponseId===rawResponseId);if(!change)throw new Error('No current accepted data change exists for invalidation.');
  const event=addHistory(project,'ACCEPTED_RESPONSE_INVALIDATED',{stage,rawResponseId:change.rawResponseId,reason,operatorLabel,identityAssurance:'SELF_ASSERTED'});change.invalidatedBy=event.eventId;invalidateDownstream(project,stage,event.eventId,reason);recalculate(project);return event;
}"""
new="""function acceptedChangeScope(project,change){if(change?.scope)return clone(change.scope);const proposal=safe(project?.projectData?.responseProposals).find(item=>item.proposalId===change?.proposalId);return clone(proposal?.envelope?.scope||proposal?.scope||{});}
function acceptedChangeOperation(project,change){if(change?.operation)return change.operation;const proposal=safe(project?.projectData?.responseProposals).find(item=>item.proposalId===change?.proposalId);return proposal?.envelope?.operation||'COMPLETE';}
function invalidateAcceptedResponse(project,{stage=project.activeStage,rawResponseId,reason='Corrected response required.',operatorLabel='HUMAN_OPERATOR'}={}){
  ensureShape(project);const change=acceptedChanges(project,stage).find(item=>!rawResponseId||item.rawResponseId===rawResponseId);if(!change)throw new Error('No current accepted data change exists for invalidation.');
  const operation=acceptedChangeOperation(project,change),scope=acceptedChangeScope(project,change),event=addHistory(project,'ACCEPTED_RESPONSE_INVALIDATED',{stage,rawResponseId:change.rawResponseId,reason,operation,scope,operatorLabel,identityAssurance:'SELF_ASSERTED'});change.invalidatedBy=event.eventId;
  const ids=new Set(change.canonicalRecordIds||[]);for(const [collection,list] of Object.entries(project.projectData)){const definition=schema.RECORD_SCHEMAS[collection];if(!definition||!Array.isArray(list))continue;for(const record of list){if(!ids.has(recordId(record,collection)))continue;if(record.source==='APPLICATION_RESERVATION'||record.reserved){record.status='RESERVED';record.completionState='AWAITING_AGENT_COMPLETION';record.evidenceRefs=[];for(const [name,def] of Object.entries(definition.fieldDefinitions||{}))if(def.producer===schema.PRODUCER.AGENT){if(record.fields)delete record.fields[name];delete record[name];}}else{record.active=false;record.validity='INVALIDATED';record.invalidatedBy=event.eventId;}}}
  for(const evidence of records(project,'evidenceRecords',{stage,active:false}).filter(record=>record.rawResponseId===change.rawResponseId)){evidence.active=false;evidence.validity='INVALIDATED';evidence.invalidatedBy=event.eventId;}
  const state=project.stages[Number(stage)];state.agentData={};state.acceptedData={};state.acceptedDataChangeIds=safe(state.acceptedDataChangeIds).filter(id=>id!==change.changeId);state.acceptedResponseIds=safe(state.acceptedResponseIds).filter(id=>id!==change.rawResponseId);if(state.currentPromptId){for(const prompt of safe(project.projectData.generatedPrompts).filter(item=>item.instructionId===state.currentPromptId&&!item.invalidatedBy))prompt.invalidatedBy=event.eventId;state.currentPromptId=null;}
  invalidateDownstream(project,stage,event.eventId,reason);recalculate(project);return event;
}"""
s=once(s,old,new,'accepted response invalidation')
old="ensureShape(project);if(count!==10)throw new Error('Run batches must contain exactly ten slots.');const resolvedIteration=iterationId||project.job.CURRENT_ITERATION;if(!resolvedIteration)throw new Error('A current iteration is required before reserving runs.');"
new="ensureShape(project);if(count!==10)throw new Error('Run batches must contain exactly ten slots.');const resolvedIteration=iterationId||project.job.CURRENT_ITERATION;if(!resolvedIteration)throw new Error('A current iteration is required before reserving runs.');const resolvedCandidate=candidateId||iterationCandidateId(project,resolvedIteration);if(!resolvedCandidate||['PENDING','UNKNOWN','UNASSIGNED'].includes(upper(resolvedCandidate)))throw new Error('A current application-frozen candidate is required before reserving runs.');"
s=once(s,old,new,'run candidate precondition')
s=once(s,"CANDIDATE_ID:candidateId||'PENDING'","CANDIDATE_ID:resolvedCandidate",'run candidate stamp')
marker="function registerArtifactBytes(project,{stage=project.activeStage,artifactId,filename,mediaType,byteSize,sha256,lineage={},role='STAGE_ARTIFACT'}={}){"
insert="""function nextPromptOperation(project,stage){
  ensureShape(project);const n=Number(stage),ops=schema.STAGE_OPERATIONS[n]||['COMPLETE'];if(![17,19].includes(n))return {operation:ops[0],scope:{},blockedReason:null};
  const scope=currentScope(project),changes=acceptedChanges(project,n),has=op=>changes.some(change=>acceptedChangeOperation(project,change)===op);
  const freezeSatisfied=n===17?recordsForCurrentScope(project,'candidateFreezes').some(r=>Number(r.stage)===17):recordsForCurrentScope(project,'iterations').some(r=>Number(r.stage)===19&&upper(recordValue(r,'PURPOSE'))==='UNCHANGED_CONFIRMATION');
  if(!freezeSatisfied)return {operation:ops[0],scope:{},blockedReason:n===17?'Freeze the corrected candidate through the application before agent operations begin.':'Begin the unchanged-confirmation iteration through the application before agent operations begin.'};
  for(const op of ops){if(op===ops[0])continue;if(op==='EXECUTE_RUN'){const runs=recordsForCurrentScope(project,'runs',{iterationId:scope.iterationId,candidateId:scope.candidateId});if(runs.length!==10)return {operation:op,scope:{},blockedReason:'Reserve exactly ten run/context slots for the current frozen candidate before execution.'};const run=runs.find(record=>upper(recordValue(record,'EXECUTION_STATUS'))!=='COMPLETED');if(run)return {operation:op,scope:{runId:recordId(run,'runs'),contextId:String(recordValue(run,'CONTEXT_ID')||'')},blockedReason:null};continue;}if(!has(op))return {operation:op,scope:{},blockedReason:null};}
  return {operation:ops.at(-1),scope:{},blockedReason:null,complete:true};
}
"""
if marker not in s: raise SystemExit('operation insertion marker missing')
s=s.replace(marker,insert+marker,1)
old_export="records,registerGeneratedPrompt,createHumanBlocker,registerFreshContext,recordHumanDecision,invalidateAcceptedResponse,invalidateStageForAuthorityChange,reserveRunBatch"
new_export="records,registerGeneratedPrompt,createHumanBlocker,registerFreshContext,recordHumanDecision,acceptedChangeScope,acceptedChangeOperation,nextPromptOperation,invalidateAcceptedResponse,invalidateStageForAuthorityChange,reserveRunBatch"
s=once(s,old_export,new_export,'workflow export')
p.write_text(s)

# response-ingestion: accepted change and receipt retain controlling operation/scope.
p=Path('response-ingestion.js');s=p.read_text()
old="contextId:'UNKNOWN',iteration:project.job.CURRENT_ITERATION||'NOT APPLICABLE',runId:'NOT APPLICABLE'"
new="operation:promptRecord.operation||'COMPLETE',contextId:promptRecord.scope?.contextId||'NOT APPLICABLE',iteration:promptRecord.scope?.iterationId||project.job.CURRENT_ITERATION||'NOT APPLICABLE',runId:promptRecord.scope?.runId||'NOT APPLICABLE'"
s=once(s,old,new,'receipt operation scope')
old="status:'COMMITTED',canonicalRecordIds:committedRecordIds,stageFields:Object.keys(proposal.proposedStageData)"
new="status:'COMMITTED',operation:proposal.envelope.operation||'COMPLETE',scope:clone(proposal.envelope.scope||{}),canonicalRecordIds:committedRecordIds,stageFields:Object.keys(proposal.proposedStageData)"
s=once(s,old,new,'accepted change operation scope')
p.write_text(s)

# app-core: derived operation sequence, exact refinement target, Stage29 derivation action, accurate Stage2 screen wording.
p=Path('app-core.js');s=p.read_text()
old="function promptOptions(n){const operation=selectedOperation(n),options={operation},requiresRun=(schema.operationContract(n,operation)?.scopeRequirements||[]).includes('runId');if(requiresRun){const run=selectedRun(n);if(run){const runId=engine.recordId(run,'runs'),contextId=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||'');options.scope={runId,contextId};}}return options;}"
new="function promptOptions(n){const plan=engine.nextPromptOperation(current,n),operation=[17,19].includes(Number(n))?plan.operation:selectedOperation(n),options={operation,scope:{...(plan.scope||{})}},requiresRun=(schema.operationContract(n,operation)?.scopeRequirements||[]).includes('runId');if(requiresRun&&!options.scope.runId){const run=selectedRun(n);if(run){const runId=engine.recordId(run,'runs'),contextId=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||'');options.scope={...options.scope,runId,contextId};}}return options;}"
s=once(s,old,new,'prompt options')
start=s.index('function operationMarkup(n,locked){');end=s.index('\nfunction validationMarkup',start)
s=s[:start]+"function operationMarkup(n,locked){const operations=stageOperations(n);if(operations.length<=1)return '';if([17,19].includes(Number(n))){const plan=engine.nextPromptOperation(current,n);return `<div class=\"panel\"><h2 class=\"section-title\">Current required operation</h2><p class=\"section-intro\">The application selects the next operation from current canonical evidence. The operator does not coordinate internal operation ordering or identities.</p><div class=\"record-row\"><div class=\"record-key\">Operation</div><div class=\"record-value\">${esc(plan.operation.replaceAll('_',' '))}</div></div>${plan.blockedReason?`<div class=\"notice warn\">${esc(plan.blockedReason)}</div>`:''}</div>`;}const active=selectedOperation(n);return `<div class=\"panel\"><h2 class=\"section-title\">Stage operation</h2><div class=\"record-row\"><div class=\"record-key\">Operation</div><div class=\"record-value\">${esc(active.replaceAll('_',' '))}</div></div></div>`;}"+s[end:]
s=s.replace("const picker=(schema.operationContract(n,selectedOperation(n))?.scopeRequirements||[]).includes('runId')&&runs.length?","const picker=n===11&&(schema.operationContract(n,selectedOperation(n))?.scopeRequirements||[]).includes('runId')&&runs.length?",1)
s=s.replace('<strong>External governing sources only.</strong> The target product, this operating application, repository, source code, UI, screenshots, stored project state, prior generated targets, and project-generated artifacts cannot receive Stage 02 source authority.','<strong>Independent external sources appropriate to this job.</strong> Prefer the most authoritative, reputable, direct, and current sources for each proposition. Supplied or existing target/repository artifacts may be implementation evidence for an explicit audit or repair job, but they are not independent external authority merely because they exist.',1)
# exact accepted-response selector (preserve existing control wording)
needle='<div class="field"><label>Why refinement is required</label><textarea id="accepted-refinement-reason"></textarea></div><button id="refine-accepted-response">Invalidate accepted result and request refinement</button>'
replacement='<div class="field"><label>Accepted response to refine</label><select id="accepted-refinement-target">${engine.acceptedChanges(current,n).map(change=>`<option value="${esc(change.rawResponseId)}">${esc(engine.acceptedChangeOperation(current,change))}${engine.acceptedChangeScope(current,change).runId?` · ${esc(engine.acceptedChangeScope(current,change).runId)}`:""} · ${esc(change.changeId)}</option>`).join("")}</select></div><div class="field"><label>Why refinement is required</label><textarea id="accepted-refinement-reason"></textarea></div><button id="refine-accepted-response">Invalidate accepted result and request refinement</button>'
s=once(s,needle,replacement,'refinement selector')
old="const next=clone(current),change=engine.acceptedChanges(next,current.activeStage).at(-1);if(!change)throw new Error('No current accepted response exists to refine.');engine.invalidateAcceptedResponse(next,{stage:current.activeStage,rawResponseId:change.rawResponseId,reason,operatorLabel:$('#operator-label')?.value.trim()||'HUMAN_OPERATOR'});"
new="const next=clone(current),rawResponseId=$('#accepted-refinement-target')?.value||engine.acceptedChanges(next,current.activeStage).at(-1)?.rawResponseId,change=engine.acceptedChanges(next,current.activeStage).find(item=>item.rawResponseId===rawResponseId);if(!change)throw new Error('Select a current accepted response to refine.');engine.invalidateAcceptedResponse(next,{stage:current.activeStage,rawResponseId:change.rawResponseId,reason,operatorLabel:$('#operator-label')?.value.trim()||'HUMAN_OPERATOR'});"
s=once(s,old,new,'refinement handler')
s=once(s,'function provenanceMarkup(n){','function evidenceChainControlMarkup(n,locked){if(n!==29)return \'\';return `<div class="panel"><h2 class="section-title">Application evidence graph</h2><p class="section-intro">Build and verify the evidence chains deterministically from current canonical identities. The human does not type routine traceability links.</p><div class="button-row"><button id="build-evidence-chains"${locked?\' disabled\':\'\'}>Build / verify evidence chains</button></div></div>`;}\nfunction provenanceMarkup(n){','Stage29 control')
s=once(s,'${acceptedStageMarkup(n)}${artifactControlMarkup(n,locked)}${provenanceMarkup(n)}${controls(d,locked)}`;}','${acceptedStageMarkup(n)}${artifactControlMarkup(n,locked)}${evidenceChainControlMarkup(n,locked)}${provenanceMarkup(n)}${controls(d,locked)}`;}','Stage29 render')
s=once(s,"if($('#calculate-release-state'))$('#calculate-release-state').onclick=async()=>{","if($('#build-evidence-chains'))$('#build-evidence-chains').onclick=async()=>{try{const next=clone(current);engine.constructEvidenceChains(next);await persistReplacement(next);announce('evidence chains rebuilt from canonical state');render();}catch(error){alert(error.message||error);}};if($('#calculate-release-state'))$('#calculate-release-state').onclick=async()=>{",'Stage29 wire')
p.write_text(s)

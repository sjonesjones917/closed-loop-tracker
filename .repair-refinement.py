from pathlib import Path

p=Path('workflow-engine.js'); s=p.read_text()
old="""function invalidateAcceptedResponse(project,{stage=project.activeStage,rawResponseId,reason='Corrected response required.',operatorLabel='HUMAN_OPERATOR'}={}){
  ensureShape(project);const change=acceptedChanges(project,stage).find(item=>!rawResponseId||item.rawResponseId===rawResponseId);if(!change)throw new Error('No current accepted data change exists for invalidation.');
  const proposal=safe(project.projectData.responseProposals).find(item=>item.proposalId===change.proposalId),operation=change.operation||proposal?.envelope?.operation||'COMPLETE',scope=clone(change.scope||proposal?.scope||proposal?.envelope?.scope||{});const event=addHistory(project,'ACCEPTED_RESPONSE_INVALIDATED',{stage,rawResponseId:change.rawResponseId,promptId:change.promptId||proposal?.promptId||null,operation,scope,reason,operatorLabel,identityAssurance:'SELF_ASSERTED'});change.invalidatedBy=event.eventId;invalidateDownstream(project,stage,event.eventId,reason);recalculate(project);return event;
}"""
new="""function invalidateAcceptedResponse(project,{stage=project.activeStage,rawResponseId,reason='Corrected response required.',operatorLabel='HUMAN_OPERATOR'}={}){
  ensureShape(project);const number=Number(stage),current=acceptedChanges(project,number),selected=current.find(item=>!rawResponseId||item.rawResponseId===rawResponseId);if(!selected)throw new Error('No current accepted data change exists for invalidation.');
  const proposal=safe(project.projectData.responseProposals).find(item=>item.proposalId===selected.proposalId),operation=selected.operation||proposal?.envelope?.operation||'COMPLETE',scope=clone(selected.scope||proposal?.scope||proposal?.envelope?.scope||{});const event=addHistory(project,'ACCEPTED_RESPONSE_INVALIDATED',{stage:number,rawResponseId:selected.rawResponseId,promptId:selected.promptId||proposal?.promptId||null,operation,scope,reason,operatorLabel,identityAssurance:'SELF_ASSERTED'}),id=event.eventId,proposalIds=new Set(current.map(change=>change.proposalId)),rawIds=new Set(current.map(change=>change.rawResponseId)),canonicalIds=new Set(current.flatMap(change=>safe(change.canonicalRecordIds)));
  for(const change of current)change.invalidatedBy=id;
  for(const prompt of safe(project.projectData.generatedPrompts).filter(item=>Number(item.stage)===number&&!item.invalidatedBy))prompt.invalidatedBy=id;
  for(const pending of safe(project.projectData.responseProposals).filter(item=>Number(item.stage)===number&&!item.invalidatedBy)){if(proposalIds.has(pending.proposalId)||pending.status==='PENDING_OPERATOR_REVIEW'){pending.invalidatedBy=id;pending.status='INVALIDATED_FOR_REFINEMENT';}}
  for(const confirmation of safe(project.projectData.stageConfirmations).filter(item=>Number(item.stage)===number&&!item.invalidatedBy))confirmation.invalidatedBy=id;
  for(const collection of Object.keys(schema.RECORD_SCHEMAS))for(const record of records(project,collection,{stage:number,active:false}))if(!record.invalidatedBy&&(proposalIds.has(record.sourceProposalId)||rawIds.has(record.rawResponseId)||canonicalIds.has(recordId(record,collection)))){record.invalidatedBy=id;record.active=false;record.validity='INVALIDATED';}
  const state=project.stages[number];state.agentData={};state.acceptedData={};state.acceptedDataChangeIds=[];state.acceptedResponseIds=[];state.currentPromptId=null;state.status='NOT STARTED';state.invalidatedBy=id;
  if(number<30)invalidateDownstream(project,number,id,reason);else recalculate(project);return event;
}"""
if old not in s: raise SystemExit('invalidateAcceptedResponse anchor missing')
p.write_text(s.replace(old,new,1))

p=Path('verify-complete.mjs'); s=p.read_text()
marker='// Accepted-response refinement removes all current same-stage canonical authority.'
if marker in s: raise SystemExit('refinement proof already present')
insert=r'''
// Accepted-response refinement removes all current same-stage canonical authority.
{
  const p=project('JOB-REFINEMENT-CANONICAL'),stage=2,source=record('sources',2,{TITLE:'Accepted source'},'SOURCE-REFINE');
  source.sourceProposalId='PROPOSAL-REFINE';source.rawResponseId='RAW-REFINE';source.scope={inputVersion:p.job.CURRENT_INPUT_VERSION};p.projectData.sources.push(source);
  p.projectData.acceptedChanges.push({changeId:'CHANGE-REFINE',stage,status:'COMMITTED',responseType:'DATA_PROPOSAL',proposalId:'PROPOSAL-REFINE',rawResponseId:'RAW-REFINE',promptId:'INSTRUCTION-REFINE',operation:'COMPLETE',scope:{},canonicalRecordIds:['SOURCE-REFINE']});
  p.projectData.responseProposals.push({proposalId:'PROPOSAL-REFINE',stage,status:'COMMITTED',rawResponseId:'RAW-REFINE',promptId:'INSTRUCTION-REFINE',scope:{},envelope:{operation:'COMPLETE',scope:{}}});
  p.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'SOURCES_IDENTIFIED'};p.stages[2].acceptedData={...p.stages[2].agentData};p.stages[2].acceptedDataChangeIds=['CHANGE-REFINE'];p.stages[2].acceptedResponseIds=['RAW-REFINE'];p.stages[2].currentPromptId='INSTRUCTION-REFINE';
  const reason='The accepted source analysis omitted an applicable authority and must be replaced completely.';engine.invalidateAcceptedResponse(p,{stage:2,rawResponseId:'RAW-REFINE',reason,operatorLabel:'VERIFY'});
  assert(engine.records(p,'sources',{stage:2}).length===0,'Invalidated accepted response left same-stage canonical source active.');assert(engine.acceptedChanges(p,2).length===0,'Invalidated accepted change retained current stage authority.');assert(Object.keys(p.stages[2].agentData||{}).length===0&&p.stages[2].acceptedDataChangeIds.length===0&&p.stages[2].acceptedResponseIds.length===0,'Invalidated stage retained accepted agent state.');const replacement=prompts.buildPromptRecord(2,p);assert(replacement.prompt.includes(reason),'Replacement prompt omitted accepted-result refinement reason.');assert(replacement.contextManifest.acceptedResultRefinements?.some(x=>x.reason===reason),'Replacement prompt identity did not bind the refinement reason.');
}

'''
idx=s.rfind('console.log(JSON.stringify(')
if idx<0: raise SystemExit('verify-complete report anchor missing')
p.write_text(s[:idx]+insert+s[idx:])

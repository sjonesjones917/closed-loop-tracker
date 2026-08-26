from pathlib import Path

ENGINE = Path('workflow-engine.js')
INGESTION = Path('response-ingestion.js')
VERIFY = Path('verify-ingestion.mjs')

new_invalidator = r'''function invalidateAcceptedResponse(project,{stage=project.activeStage,rawResponseId,reason='Corrected response required.',operatorLabel='HUMAN_OPERATOR'}={}){
  ensureShape(project);const number=Number(stage),current=acceptedChanges(project,number),selected=current.find(item=>!rawResponseId||item.rawResponseId===rawResponseId);if(!selected)throw new Error('No current accepted data change exists for invalidation.');
  const proposal=safe(project.projectData.responseProposals).find(item=>item.proposalId===selected.proposalId),operation=selected.operation||proposal?.envelope?.operation||'COMPLETE',scope=clone(selected.scope||proposal?.scope||proposal?.envelope?.scope||{}),target={stage:number,operation,scope};const laneChanges=current.filter(change=>samePromptTarget(change,target));if(!laneChanges.length)throw new Error('No current accepted data change exists for the selected refinement lane.');const event=addHistory(project,'ACCEPTED_RESPONSE_INVALIDATED',{stage:number,rawResponseId:selected.rawResponseId,promptId:selected.promptId||proposal?.promptId||null,operation,scope,reason,operatorLabel,identityAssurance:'SELF_ASSERTED'}),id=event.eventId,laneChangeIds=new Set(laneChanges.map(change=>change.changeId)),proposalIds=new Set(laneChanges.map(change=>change.proposalId)),rawIds=new Set(laneChanges.map(change=>change.rawResponseId)),canonicalIds=new Set(laneChanges.flatMap(change=>safe(change.canonicalRecordIds)));
  const restored=new Set();for(const change of [...laneChanges].sort((a,b)=>Number(a.eventSequence||0)-Number(b.eventSequence||0)))for(const before of safe(change.recordBeforeImages)){const key=`${before.collection}:${before.recordId}`;if(restored.has(key))continue;const list=safe(project.projectData[before.collection]),index=list.findIndex(record=>recordId(record,before.collection)===String(before.recordId));if(index>=0){list[index]=clone(before.record);restored.add(key);}}
  for(const change of laneChanges)change.invalidatedBy=id;
  for(const prompt of safe(project.projectData.generatedPrompts).filter(item=>!item.invalidatedBy&&samePromptTarget(item,target)))prompt.invalidatedBy=id;
  for(const pending of safe(project.projectData.responseProposals).filter(item=>!item.invalidatedBy&&samePromptTarget(item,target))){if(proposalIds.has(pending.proposalId)||pending.status==='PENDING_OPERATOR_REVIEW'){pending.invalidatedBy=id;pending.status='INVALIDATED_FOR_REFINEMENT';}}
  for(const confirmation of safe(project.projectData.stageConfirmations).filter(item=>Number(item.stage)===number&&!item.invalidatedBy&&(!item.acceptedChangeId||laneChangeIds.has(item.acceptedChangeId))))confirmation.invalidatedBy=id;
  for(const collection of Object.keys(schema.RECORD_SCHEMAS))for(const record of records(project,collection,{stage:number,active:false})){const key=`${collection}:${recordId(record,collection)}`;if(restored.has(key))continue;if(!record.invalidatedBy&&(proposalIds.has(record.sourceProposalId)||rawIds.has(record.rawResponseId)||canonicalIds.has(recordId(record,collection)))){record.invalidatedBy=id;record.active=false;record.validity='INVALIDATED';}}
  const remaining=acceptedChanges(project,number).sort((a,b)=>Number(a.eventSequence||0)-Number(b.eventSequence||0)),rebuilt={};for(const change of remaining){const source=safe(project.projectData.responseProposals).find(item=>item.proposalId===change.proposalId);Object.assign(rebuilt,clone(source?.proposedStageData||{}));}const state=project.stages[number];state.agentData=rebuilt;state.acceptedData=state.agentData;state.acceptedDataChangeIds=remaining.map(change=>change.changeId);state.acceptedResponseIds=remaining.map(change=>change.rawResponseId);state.currentPromptId=safe(project.projectData.generatedPrompts).filter(item=>Number(item.stage)===number&&!item.invalidatedBy).at(-1)?.instructionId||null;state.invalidatedBy=null;if(number===1){for(const name of schema.AGENT_JOB_FIELDS)delete project.job[name];for(const [name,value] of Object.entries(rebuilt))if(schema.AGENT_JOB_FIELDS.includes(name))project.job[name]=clone(value);}
  if(number<30)invalidateDownstream(project,number,id,reason);else recalculate(project);return event;
}
'''

engine = ENGINE.read_text()
a = engine.index('function invalidateAcceptedResponse(')
b = engine.index('function reserveRunBatch(', a)
engine = engine[:a] + new_invalidator + engine[b:]
ENGINE.write_text(engine)

ingestion = INGESTION.read_text()
old = 'const committedRecordIds=[];for(const evidence of proposal.evidence)'
new = 'const committedRecordIds=[],recordBeforeImages=[];for(const evidence of proposal.evidence)'
if old not in ingestion:
    raise SystemExit('commit record list anchor not found')
ingestion = ingestion.replace(old, new, 1)
old = "if(!target)throw new Error(`Reserved target disappeared: ${canonical.id}.`);target.fields="
new = "if(!target)throw new Error(`Reserved target disappeared: ${canonical.id}.`);recordBeforeImages.push({collection,recordId:canonical.id,record:clone(target)});target.fields="
if old not in ingestion:
    raise SystemExit('reserved target mutation anchor not found')
ingestion = ingestion.replace(old, new, 1)
old = 'canonicalRecordIds:committedRecordIds,stageFields:'
new = 'canonicalRecordIds:committedRecordIds,recordBeforeImages,stageFields:'
if old not in ingestion:
    raise SystemExit('accepted change anchor not found')
ingestion = ingestion.replace(old, new, 1)
INGESTION.write_text(ingestion)

marker = '// Accepted-result refinement is scoped to the exact run/context lane and restores application-reserved targets.'
verify = VERIFY.read_text()
if marker not in verify:
    block = r'''

// Accepted-result refinement is scoped to the exact run/context lane and restores application-reserved targets.
{
  let p=project('JOB-TARGETED-REFINEMENT');
  const stage=11,iterationId='ITERATION-TARGETED',candidateId='CANDIDATE-TARGETED';
  p.job.CURRENT_ITERATION=iterationId;
  const slots=engine.reserveRunBatch(p,{stage,iterationId,candidateId,count:10});
  const originalA=JSON.parse(JSON.stringify(engine.records(p,'runs',{stage}).find(r=>engine.recordId(r,'runs')===slots[0].runId)));
  const originalB=JSON.parse(JSON.stringify(engine.records(p,'runs',{stage}).find(r=>engine.recordId(r,'runs')===slots[1].runId)));
  const acceptRun=(state,slot,label)=>{
    const pr={...prompts.buildPromptRecord(stage,state,{scope:{iterationId,candidateId,runId:slot.runId,contextId:slot.contextId}}),generatedAt:new Date().toISOString()};
    state.projectData.generatedPrompts.push(pr);
    const e={schema:schema.RESPONSE_SCHEMA,jobId:state.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{runs:[{targetId:slot.runId,fields:{FRESH_CONTEXT_RECORD:slot.contextId,STARTED_AT:`${label}-start`,ENDED_AT:`${label}-end`,CONTAMINATION_CHECK:'NONE',TOOL_CONFIGURATION:`${label}-tools`,EXECUTION_STATUS:'COMPLETE',COMPLETE_OUTPUT:`${label}-output`,OUTPUT_ARTIFACT_IDENTITIES:'NONE',TOOL_FAILURES:'NONE',NOTES:`${label}-notes`},relationships:{},evidenceRefs:['evidence-1']}]},evidence:[{temporaryKey:'evidence-1',kind:'EXECUTION_EVIDENCE',description:`${label} execution evidence`,location:'targeted-refinement fixture',content:`${label}-evidence`}],unresolved:[],warnings:[],attachments:[]};
    const prepared=ingestion.prepare(state,{stage,text:JSON.stringify(e),promptRecord:pr});
    if(!prepared.validation.valid)throw new Error(`${label} run proposal invalid: ${JSON.stringify(prepared.validation.issues)}`);
    return ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY',reviewNote:`Accept ${label}.`}).project;
  };
  p=acceptRun(p,slots[0],'RUN-A');
  const changeA=engine.acceptedChanges(p,stage).find(c=>c.scope?.runId===slots[0].runId);
  if(!changeA?.recordBeforeImages?.some(x=>x.collection==='runs'&&x.recordId===slots[0].runId))throw new Error('Reserved-target acceptance did not preserve a canonical before-image.');
  p=acceptRun(p,slots[1],'RUN-B');
  const changeB=engine.acceptedChanges(p,stage).find(c=>c.scope?.runId===slots[1].runId);
  if(!changeB)throw new Error('Independent Run B acceptance missing before refinement.');
  const reason='Refine Run A only; Run B is already acceptable.';
  engine.invalidateAcceptedResponse(p,{stage,rawResponseId:changeA.rawResponseId,reason,operatorLabel:'VERIFY'});
  const remaining=engine.acceptedChanges(p,stage),runA=engine.records(p,'runs',{stage,active:false}).find(r=>engine.recordId(r,'runs')===slots[0].runId),runB=engine.records(p,'runs',{stage,active:false}).find(r=>engine.recordId(r,'runs')===slots[1].runId);
  if(remaining.length!==1||remaining[0].changeId!==changeB.changeId)throw new Error('Refining Run A invalidated an unrelated accepted Run B lane.');
  if(JSON.stringify(runA)!==JSON.stringify(originalA))throw new Error('Refining Run A did not restore the exact application-reserved Run A before-image.');
  if(runB?.COMPLETE_OUTPUT!=='RUN-B-output'||runB?.active===false||runB?.invalidatedBy)throw new Error('Refining Run A damaged the accepted Run B canonical record.');
  if(p.stages[stage].acceptedDataChangeIds.length!==1||p.stages[stage].acceptedDataChangeIds[0]!==changeB.changeId||p.stages[stage].acceptedResponseIds[0]!==changeB.rawResponseId)throw new Error('Stage accepted-state indexes were not rebuilt from surviving lanes.');
  const activePrompts=p.projectData.generatedPrompts.filter(x=>Number(x.stage)===stage&&!x.invalidatedBy);
  if(!activePrompts.some(x=>x.scope?.runId===slots[1].runId)||activePrompts.some(x=>x.scope?.runId===slots[0].runId))throw new Error('Refinement prompt invalidation was not limited to the selected run/context lane.');
  const replacement=prompts.buildPromptRecord(stage,p,{scope:{iterationId,candidateId,runId:slots[0].runId,contextId:slots[0].contextId}});
  if(!replacement.prompt.includes(reason))throw new Error('Targeted replacement prompt omitted the accepted-result refinement reason.');
  if(JSON.stringify(originalB)===JSON.stringify(runB))throw new Error('Run B fixture did not actually exercise a committed reserved-target update.');
}
'''
    anchor = '// Semantic response-type and reference validation must fail closed.'
    if anchor in verify:
        verify = verify.replace(anchor, block + '\n' + anchor, 1)
    else:
        verify += block
    VERIFY.write_text(verify)

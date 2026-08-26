from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')

def write(path, text):
    Path(path).write_text(text, encoding='utf-8')

def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old,new,1)

def replace_count(text, old, new, expected, label):
    count=text.count(old)
    if count!=expected:
        raise SystemExit(f'{label}: expected {expected} matches, found {count}')
    return text.replace(old,new)

# 1. Operation contracts own both record collections and stageData fields.
path='workflow-schema.js'
s=read(path)
s=replace_once(s,
"FREEZE:Object.freeze({readCollections:['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions'],agentWritableCollections:[]})",
"FREEZE:Object.freeze({readCollections:['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions'],agentWritableCollections:[],allowedStageData:['NEW_FROZEN_VERSIONS','OLD_CONVERSATIONS_CONTINUED']})",
'stage17 FREEZE stageData')
s=replace_count(s,
"EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts'],agentWritableCollections:['runs']})",
"EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts'],agentWritableCollections:['runs'],allowedStageData:[]})",2,
'EXECUTE_RUN stageData')
s=replace_count(s,
"VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts'],agentWritableCollections:['verification']})",
"VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts'],agentWritableCollections:['verification'],allowedStageData:[]})",2,
'VERIFY stageData')
s=replace_count(s,
"COMPARE:Object.freeze({readCollections:['verification','runs','requirements'],agentWritableCollections:['comparisons']})",
"COMPARE:Object.freeze({readCollections:['verification','runs','requirements'],agentWritableCollections:['comparisons'],allowedStageData:[]})",2,
'COMPARE stageData')
s=replace_once(s,
"ROOT_CAUSE:Object.freeze({readCollections:['defects','comparisons','verification'],agentWritableCollections:['defects','rootCauses']})",
"ROOT_CAUSE:Object.freeze({readCollections:['defects','comparisons','verification'],agentWritableCollections:['defects','rootCauses'],allowedStageData:['ROOT_CAUSE_COMPLETED']})",
'ROOT_CAUSE stageData')
s=replace_once(s,
"REGRESSION:Object.freeze({readCollections:['defects','rootCauses','regressions','regressionExecutions'],agentWritableCollections:['regressions','regressionExecutions']})",
"REGRESSION:Object.freeze({readCollections:['defects','rootCauses','regressions','regressionExecutions'],agentWritableCollections:['regressions','regressionExecutions'],allowedStageData:[]})",
'REGRESSION stageData')
s=replace_once(s,
"CORRECT:Object.freeze({readCollections:['defects','rootCauses','regressions','regressionExecutions','changes'],agentWritableCollections:['changes']})",
"CORRECT:Object.freeze({readCollections:['defects','rootCauses','regressions','regressionExecutions','changes'],agentWritableCollections:['changes'],allowedStageData:['CORRECTIONS_COMPLETED']})",
'CORRECT stageData')
s=replace_once(s,
"CONFIRM_FREEZE:Object.freeze({readCollections:['convergenceRecords','candidateFreezes','iterations'],agentWritableCollections:[]})",
"CONFIRM_FREEZE:Object.freeze({readCollections:['convergenceRecords','candidateFreezes','iterations'],agentWritableCollections:[],allowedStageData:['COMPLETE_TEST_SUITE_RUN']})",
'CONFIRM_FREEZE stageData')
s=replace_once(s,
"REGRESSION_VERIFY:Object.freeze({readCollections:['regressions','regressionExecutions','runs'],agentWritableCollections:['regressionExecutions']})",
"REGRESSION_VERIFY:Object.freeze({readCollections:['regressions','regressionExecutions','runs'],agentWritableCollections:['regressionExecutions'],allowedStageData:[]})",
'REGRESSION_VERIFY stageData')
s=replace_once(s,
"CONFIRM:Object.freeze({readCollections:['runs','verification','comparisons','regressionExecutions','candidateFreezes'],agentWritableCollections:['confirmationRecords']})",
"CONFIRM:Object.freeze({readCollections:['runs','verification','comparisons','regressionExecutions','candidateFreezes'],agentWritableCollections:['confirmationRecords'],allowedStageData:[]})",
'CONFIRM stageData')
old="return Object.freeze({operation,readCollections:Object.freeze(override.readCollections||READ_COLLECTIONS[stage]||[]),agentWritableCollections:Object.freeze(override.agentWritableCollections||STAGE_COLLECTIONS[stage]||[]),applicationCollections:Object.freeze(APPLICATION_COLLECTIONS[stage]||[]),humanActions:Object.freeze(HUMAN_ACTIONS[stage]||[]),scopeRequirements:Object.freeze(scopeRequirements)});"
new="return Object.freeze({operation,readCollections:Object.freeze(override.readCollections||READ_COLLECTIONS[stage]||[]),agentWritableCollections:Object.freeze(override.agentWritableCollections||STAGE_COLLECTIONS[stage]||[]),allowedStageData:Object.freeze(override.allowedStageData||STAGE_CONTRACTS[stage]?.allowedStageData||[]),applicationCollections:Object.freeze(APPLICATION_COLLECTIONS[stage]||[]),humanActions:Object.freeze(HUMAN_ACTIONS[stage]||[]),scopeRequirements:Object.freeze(scopeRequirements)});"
s=replace_once(s,old,new,'operationContract allowedStageData')
write(path,s)

# 2. Prompt contract and field guidance use the exact operation field surface.
path='prompt-engine.js'
s=read(path)
s=replace_once(s,
" const contract=schema.STAGE_CONTRACTS[stage],op=schema.operationContract(stage,operation),writable=op?.agentWritableCollections||contract.agentWritableCollections;\n const stageData=Object.fromEntries(contract.allowedStageData.map(name=>[name,responseFieldContract(schema.STAGE_FIELDS[stage][name])]));",
" const contract=schema.STAGE_CONTRACTS[stage],op=schema.operationContract(stage,operation),writable=op?.agentWritableCollections||contract.agentWritableCollections,stageFields=op?.allowedStageData||contract.allowedStageData;\n const stageData=Object.fromEntries(stageFields.map(name=>[name,responseFieldContract(schema.STAGE_FIELDS[stage][name])]));",
'prompt descriptor operation stageData')
s=replace_once(s,"contractVersion:'closed-loop-response-contract/2.1'","contractVersion:'closed-loop-response-contract/2.2'",'contract version')
s=replace_once(s,"agentStageFields:[...contract.allowedStageData]","agentStageFields:[...stageFields]",'descriptor agentStageFields')
s=replace_once(s,
" const fields=contract.allowedStageData.length?contract.allowedStageData.map(x=>{const d=schema.STAGE_FIELDS[stage][x];return `- ${x}: ${d.valueType}${d.enumValues?.length?` enum(${d.enumValues.join(' | ')})`:''}${d.nullable?' nullable':''}`;}).join('\\n'):'- No agent-owned stageData fields; use permitted records/evidence only.';",
" const stageFields=op?.allowedStageData||contract.allowedStageData;\n const fields=stageFields.length?stageFields.map(x=>{const d=schema.STAGE_FIELDS[stage][x];return `- ${x}: ${d.valueType}${d.enumValues?.length?` enum(${d.enumValues.join(' | ')})`:''}${d.nullable?' nullable':''}`;}).join('\\n'):'- No agent-owned stageData fields for this operation; use permitted records/evidence only.';",
'prompt body operation stageData')
write(path,s)

# 3. Ingestion enforces operation field isolation, record identity mode, target lifecycle, and target scope.
path='response-ingestion.js'
s=read(path)
s=replace_once(s,
"  const allowedStageData=new Set(contract?.allowedStageData||[]);",
"  const allowedStageData=new Set(operationContract?.allowedStageData||contract?.allowedStageData||[]);",
'ingestion operation stageData set')
s=replace_once(s,
"      if(!allowedStageData.has(name)||!schema.authorizeMutation({fieldDefinition:definition,actor:'AGENT',mutationType:'RESPONSE_INGESTION'}).authorized)issues.push(issue('FIELD_OWNERSHIP_VIOLATION',path,`${name} is owned by ${definition.producer}, not the external agent.`));",
"      if(!allowedStageData.has(name))issues.push(issue('STAGE_OPERATION_FIELD_VIOLATION',path,`${name} is not writable by operation ${expectedOperation}.`));\n      else if(!schema.authorizeMutation({fieldDefinition:definition,actor:'AGENT',mutationType:'RESPONSE_INGESTION'}).authorized)issues.push(issue('FIELD_OWNERSHIP_VIOLATION',path,`${name} is owned by ${definition.producer}, not the external agent.`));",
'ingestion stageData violation')
old="""        const identityCount=Number(Boolean(record.tempKey))+Number(Boolean(record.targetId));if(identityCount!==1)issues.push(issue('INVALID_RECORD_IDENTITY',path,'Provide exactly one of tempKey or targetId.'));
        let tempKey='';if(record.tempKey){tempKey=registerTemp(record.tempKey,`${path}/tempKey`,collection);if(tempKey)responseRecordIndex.set(tempKey,{collection,record,path});}
        if(record.targetId){const target=workflow.records(project,collection,{active:true}).find(existing=>workflow.recordId(existing,collection)===String(record.targetId));if(!target)issues.push(issue('INVALID_RESERVED_TARGET',`${path}/targetId`,`Target ${record.targetId} does not exist as an active ${collection} record.`));else if(!['RESERVED','PENDING_AGENT','OPEN'].includes(upper(workflow.recordValue(target,'STATUS')||target.status||'RESERVED')))issues.push(issue('INVALID_RESERVED_TARGET',`${path}/targetId`,'Target record is not in an agent-completable reserved state.'));}
"""
new="""        const identityCount=Number(Boolean(record.tempKey))+Number(Boolean(record.targetId));if(identityCount!==1)issues.push(issue('INVALID_RECORD_IDENTITY',path,'Provide exactly one of tempKey or targetId.'));
        const identityMode=definition.commitPolicy===schema.COLLECTION_POLICIES.UPDATE_RESERVED?'TARGET_ID_ONLY':'TEMP_KEY_ONLY';
        if(identityMode==='TARGET_ID_ONLY'&&!record.targetId)issues.push(issue('INVALID_RECORD_IDENTITY',path,`${collection} is application-reserved and must use targetId.`));
        if(identityMode==='TARGET_ID_ONLY'&&record.tempKey)issues.push(issue('INVALID_RECORD_IDENTITY',`${path}/tempKey`,`${collection} cannot create a new record from this operation.`));
        if(identityMode==='TEMP_KEY_ONLY'&&!record.tempKey)issues.push(issue('INVALID_RECORD_IDENTITY',path,`${collection} must be proposed with a response-local tempKey.`));
        if(identityMode==='TEMP_KEY_ONLY'&&record.targetId)issues.push(issue('INVALID_RECORD_IDENTITY',`${path}/targetId`,`${collection} does not permit agent updates of existing canonical records.`));
        let tempKey='';if(record.tempKey){tempKey=registerTemp(record.tempKey,`${path}/tempKey`,collection);if(tempKey)responseRecordIndex.set(tempKey,{collection,record,path});}
        if(record.targetId){const target=workflow.records(project,collection,{active:true}).find(existing=>workflow.recordId(existing,collection)===String(record.targetId));if(!target)issues.push(issue('INVALID_RESERVED_TARGET',`${path}/targetId`,`Target ${record.targetId} does not exist as an active ${collection} record.`));else{const lifecycle=upper(target.status||workflow.recordValue(target,'STATUS')||'RESERVED');if(!['RESERVED','PENDING_AGENT','OPEN'].includes(lifecycle))issues.push(issue('INVALID_RESERVED_TARGET',`${path}/targetId`,'Target record is not in an agent-completable reserved state.'));const expected=currentScope(project,promptRecord),targetScope=target.scope||{};for(const key of ['iterationId','candidateId','baselineId','productId'])if(expected[key]!=null&&targetScope[key]!=null&&String(expected[key])!==String(targetScope[key]))issues.push(issue('TARGET_SCOPE_MISMATCH',`${path}/targetId`,`Target ${record.targetId} belongs to a different ${key}.`));if(collection==='runs'&&expected.runId&&String(record.targetId)!==String(expected.runId))issues.push(issue('TARGET_SCOPE_MISMATCH',`${path}/targetId`,`Target run ${record.targetId} does not match controlling run ${expected.runId}.`));if(collection==='runs'&&expected.contextId&&String(workflow.recordValue(target,'CONTEXT_ID')||'')!==String(expected.contextId))issues.push(issue('TARGET_SCOPE_MISMATCH',`${path}/targetId`,`Target run context does not match controlling context ${expected.contextId}.`));if(collection==='products'&&expected.productId&&String(record.targetId)!==String(expected.productId))issues.push(issue('TARGET_SCOPE_MISMATCH',`${path}/targetId`,`Target product ${record.targetId} does not match controlling product ${expected.productId}.`));}}
"""
s=replace_once(s,old,new,'record identity and target scope validation')
s=replace_once(s,
"  const committedRecordIds=[];for(const evidence of proposal.evidence){",
"  const committedRecordIds=[],reservedTargetSnapshots=[];for(const evidence of proposal.evidence){",
'reserved target snapshot declaration')
s=replace_once(s,
"if(canonical.updateTargetId){const target=next.projectData[collection].find(r=>workflow.recordId(r,collection)===canonical.id&&workflow.isActiveRecord(r));if(!target)throw new Error(`Reserved target disappeared: ${canonical.id}.`);target.fields=",
"if(canonical.updateTargetId){const target=next.projectData[collection].find(r=>workflow.recordId(r,collection)===canonical.id&&workflow.isActiveRecord(r));if(!target)throw new Error(`Reserved target disappeared: ${canonical.id}.`);reservedTargetSnapshots.push({collection,id:canonical.id,record:clone(target)});target.fields=",
'capture reserved target snapshot')
s=replace_once(s,
"canonicalEnvelopeSha256:proposal.canonicalEnvelopeSha256,operation:proposal.envelope?.operation||null,scope:clone(proposal.envelope?.scope||proposal.scope||{})};",
"canonicalEnvelopeSha256:proposal.canonicalEnvelopeSha256,operation:proposal.envelope?.operation||null,scope:clone(proposal.envelope?.scope||proposal.scope||{}),reservedTargetSnapshots};",
'accepted change target snapshots')
write(path,s)

# 4. Refinement retracts only the exact operation/scope lane and restores its application reservation.
path='workflow-engine.js'
s=read(path)
pattern=r"function invalidateAcceptedResponse\(project,\{stage=project\.activeStage,rawResponseId,reason='Corrected response required\.',operatorLabel='HUMAN_OPERATOR'\}=\{\}\)\{.*?\n\}\nfunction reserveRunBatch"
replacement="""function invalidateAcceptedResponse(project,{stage=project.activeStage,rawResponseId,reason='Corrected response required.',operatorLabel='HUMAN_OPERATOR'}={}){
  ensureShape(project);const number=Number(stage),current=acceptedChanges(project,number),selected=current.find(item=>!rawResponseId||item.rawResponseId===rawResponseId);if(!selected)throw new Error('No current accepted data change exists for invalidation.');
  const proposal=safe(project.projectData.responseProposals).find(item=>item.proposalId===selected.proposalId),operation=selected.operation||proposal?.envelope?.operation||'COMPLETE',scope=clone(selected.scope||proposal?.scope||proposal?.envelope?.scope||{}),laneKeys=['iterationId','candidateId','runId','contextId','baselineId','productId'],scalar=value=>String(value??''),sameLane=item=>String(item?.operation||item?.envelope?.operation||'COMPLETE')===String(operation)&&laneKeys.every(key=>scalar((item?.scope||item?.envelope?.scope||{})[key])===scalar(scope?.[key]));
  const affected=current.filter(sameLane);if(!affected.length)throw new Error('The selected accepted response no longer belongs to a current refinement lane.');
  const event=addHistory(project,'ACCEPTED_RESPONSE_INVALIDATED',{stage:number,rawResponseId:selected.rawResponseId,promptId:selected.promptId||proposal?.promptId||null,operation,scope,reason,operatorLabel,identityAssurance:'SELF_ASSERTED'}),id=event.eventId,proposalIds=new Set(affected.map(change=>change.proposalId)),rawIds=new Set(affected.map(change=>change.rawResponseId)),canonicalIds=new Set(affected.flatMap(change=>safe(change.canonicalRecordIds))),snapshotMap=new Map();
  for(const change of affected){change.invalidatedBy=id;for(const snapshot of safe(change.reservedTargetSnapshots))snapshotMap.set(`${snapshot.collection}:${snapshot.id}`,clone(snapshot.record));}
  for(const prompt of safe(project.projectData.generatedPrompts).filter(item=>Number(item.stage)===number&&!item.invalidatedBy&&sameLane(item)))prompt.invalidatedBy=id;
  for(const pending of safe(project.projectData.responseProposals).filter(item=>Number(item.stage)===number&&!item.invalidatedBy&&sameLane(item))){if(proposalIds.has(pending.proposalId)||pending.status==='PENDING_OPERATOR_REVIEW'||pending.status==='ACCEPTED'){pending.invalidatedBy=id;pending.status='INVALIDATED_FOR_REFINEMENT';}}
  for(const confirmation of safe(project.projectData.stageConfirmations).filter(item=>Number(item.stage)===number&&!item.invalidatedBy))confirmation.invalidatedBy=id;
  for(const collection of Object.keys(schema.RECORD_SCHEMAS)){const list=safe(project.projectData[collection]);for(let index=0;index<list.length;index++){const record=list[index],recordIdentity=recordId(record,collection),key=`${collection}:${recordIdentity}`;if(snapshotMap.has(key)){list[index]=clone(snapshotMap.get(key));continue;}if(!record.invalidatedBy&&(proposalIds.has(record.sourceProposalId)||rawIds.has(record.rawResponseId)||canonicalIds.has(recordIdentity))){record.invalidatedBy=id;record.active=false;record.validity='INVALIDATED';}}}
  const remaining=acceptedChanges(project,number).sort((a,b)=>Number(a.eventSequence||0)-Number(b.eventSequence||0)),rebuilt={};for(const change of remaining){const acceptedProposal=safe(project.projectData.responseProposals).find(item=>item.proposalId===change.proposalId);Object.assign(rebuilt,clone(acceptedProposal?.proposedStageData||{}));}
  const state=project.stages[number];state.agentData=rebuilt;state.acceptedData=clone(rebuilt);state.acceptedDataChangeIds=remaining.map(change=>change.changeId);state.acceptedResponseIds=remaining.map(change=>change.rawResponseId);state.currentPromptId=null;state.status='NOT STARTED';state.invalidatedBy=null;
  if(number<30)invalidateDownstream(project,number,id,reason);else recalculate(project);return event;
}
function reserveRunBatch"""
s,count=re.subn(pattern,replacement,s,flags=re.S)
if count!=1:
    raise SystemExit(f'scoped refinement function: expected one replacement, found {count}')
write(path,s)

# 5. Tests use operation-level stageData and prove the newly closed ingestion boundaries.
path='verify-ingestion.mjs'
s=read(path)
s=replace_once(s,
"  const contract=schema.STAGE_CONTRACTS[stage];\n  const stageData={};\n  if(contract.allowedStageData.length)stageData[contract.allowedStageData[0]]=safeValue(contract.allowedStageData[0]);",
"  const contract=schema.STAGE_CONTRACTS[stage],operationContract=schema.operationContract(stage,promptRecord.operation),stageFields=operationContract?.allowedStageData||contract.allowedStageData;\n  const stageData={};\n  if(stageFields.length)stageData[stageFields[0]]=safeValue(stageFields[0]);",
'validEnvelope operation fields')
append="""

// Operation field surfaces and record identity modes are enforced fail closed.
{
  let p=project('JOB-NEG-OPERATION-STAGEDATA'),stage=17;const pr={...prompts.buildPromptRecord(stage,p,{operation:'EXECUTE_RUN',scope:{runId:'RUN-OP-1',contextId:'CTX-OP-1'}}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{VERIFY_COMPLETED:'TRUE'},records:{},evidence:[{temporaryKey:'op-evidence',kind:'WORKFLOW_EVIDENCE',description:'operation isolation',location:'fixture',content:'operation isolation'}],unresolved:[],warnings:[],attachments:[]};const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='STAGE_OPERATION_FIELD_VIOLATION'))throw new Error('EXECUTE_RUN accepted VERIFY stageData.');negativeCount++;
}
{
  const p=project('JOB-NEG-NONRESERVED-TARGET'),stage=2,pr=savePrompt(p,stage),e=validEnvelope(p,stage,pr);e.stageData={};e.records={sources:[sourceProposal('source-policy')]};delete e.records.sources[0].tempKey;e.records.sources[0].targetId='SOURCE-000001';const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='INVALID_RECORD_IDENTITY'))throw new Error('Non-reserved collection accepted targetId update semantics.');negativeCount++;
}
function completeFields(collection){const definition=schema.RECORD_SCHEMAS[collection],fields={};for(const name of definition.required)if(definition.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=valueForDefinition(definition.fieldDefinitions[name]);return fields;}
function proposalEnvelope(p,stage,pr,records){return {schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records,evidence:[{temporaryKey:'policy-evidence',kind:'WORKFLOW_EVIDENCE',description:'record identity policy',location:'fixture',content:'record identity policy'}],unresolved:[],warnings:[],attachments:[]};}
{
  let p=project('JOB-NEG-RESERVED-TEMPKEY'),stage=21;p.job.CURRENT_BASELINE_ID='BASELINE-000001';p.job.CURRENT_PRODUCT_ID='PRODUCT-000001';const pr={...prompts.buildPromptRecord(stage,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);const e=proposalEnvelope(p,stage,pr,{products:[{tempKey:'new-product',fields:completeFields('products'),relationships:{},evidenceRefs:['policy-evidence']}]});const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='INVALID_RECORD_IDENTITY'))throw new Error('Application-reserved collection accepted tempKey creation.');negativeCount++;
}
{
  let p=project('JOB-NEG-COMPLETED-TARGET'),stage=21,productId='PRODUCT-000001';p.job.CURRENT_BASELINE_ID='BASELINE-000001';p.job.CURRENT_PRODUCT_ID=productId;p.projectData.products.push({id:productId,stage,active:true,status:'COMPLETED',scope:{baselineId:'BASELINE-000001',productId},fields:{PRODUCT_ID:productId,BASELINE_ID:'BASELINE-000001',STATUS:'RESERVED'},PRODUCT_ID:productId,BASELINE_ID:'BASELINE-000001',STATUS:'RESERVED'});const pr={...prompts.buildPromptRecord(stage,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);const e=proposalEnvelope(p,stage,pr,{products:[{targetId:productId,fields:completeFields('products'),relationships:{},evidenceRefs:['policy-evidence']}]});const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='INVALID_RESERVED_TARGET'))throw new Error('Completed reserved target was agent-completable a second time.');negativeCount++;
}
{
  let p=project('JOB-NEG-TARGET-SCOPE'),stage=11,runId='RUN-SCOPE-B';p.projectData.runs.push({id:runId,stage,active:true,status:'RESERVED',scope:{},fields:{RUN_ID:runId,CONTEXT_ID:'CTX-SCOPE-B'},RUN_ID:runId,CONTEXT_ID:'CTX-SCOPE-B'});const pr={...prompts.buildPromptRecord(stage,p,{scope:{runId:'RUN-SCOPE-A',contextId:'CTX-SCOPE-A'}}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);const e=proposalEnvelope(p,stage,pr,{runs:[{targetId:runId,fields:completeFields('runs'),relationships:{},evidenceRefs:['policy-evidence']}]});const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='TARGET_SCOPE_MISMATCH'))throw new Error('Reserved target outside the controlling run/context scope was accepted.');negativeCount++;
}
console.log(JSON.stringify({operationStageDataIsolation:true,reservedTargetPolicy:true,completedReservedTargetBlocked:true,targetScopeIsolation:true,totalNegativeCases:negativeCount},null,2));
"""
if 'operationStageDataIsolation:true' in s:
    raise SystemExit('verify-ingestion operation-isolation tests already present')
s=s.rstrip()+append+'\n'
write(path,s)

# Prompt semantic regression: operation descriptor must expose only operation-owned stage fields.
path='verify-prompt-semantics.mjs'
s=read(path)
s=replace_once(s,"closed-loop-response-contract/2.1","closed-loop-response-contract/2.2",'prompt semantic contract version')
append="""

// Multi-operation stages expose only stageData owned by the selected operation.
{
 const p=baseProject(),execute=prompts.responseContractDescriptor(17,'EXECUTE_RUN'),root=prompts.responseContractDescriptor(17,'ROOT_CAUSE'),freeze=prompts.responseContractDescriptor(17,'FREEZE');
 if(execute.agentStageFields.length||Object.keys(execute.stageData).length)throw new Error('Stage 17 EXECUTE_RUN still exposes cross-operation stageData.');
 if(!root.agentStageFields.includes('ROOT_CAUSE_COMPLETED')||root.agentStageFields.includes('CORRECTIONS_COMPLETED'))throw new Error('Stage 17 ROOT_CAUSE stageData boundary is incorrect.');
 if(!freeze.agentStageFields.includes('NEW_FROZEN_VERSIONS')||freeze.agentStageFields.includes('ROOT_CAUSE_COMPLETED'))throw new Error('Stage 17 FREEZE stageData boundary is incorrect.');
}
"""
if 'Multi-operation stages expose only stageData' in s:
    raise SystemExit('prompt operation field regression already present')
s=s.rstrip()+append+'\n'
write(path,s)

# Scoped accepted-result refinement regression using two independently reserved Stage 11 lanes.
path='verify-complete.mjs'
s=read(path)
append="""

// Refining one accepted run restores only that reservation and preserves unrelated accepted lanes.
{
 let p=project('JOB-SCOPED-ACCEPTED-REFINEMENT'),stage=11;p.job.CURRENT_ITERATION='ITERATION-REFINE';
 const slots=engine.reserveRunBatch(p,{stage,iterationId:'ITERATION-REFINE',candidateId:'CANDIDATE-REFINE',count:10});
 const acceptLane=(slot,label)=>{const pr={...prompts.buildPromptRecord(stage,p,{scope:{runId:slot.runId,contextId:slot.contextId}}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);const fields={FRESH_CONTEXT_RECORD:slot.contextId,CONTAMINATION_CHECK:'NONE',TOOL_CONFIGURATION:'CONTROLLED',EXECUTION_STATUS:'COMPLETED',COMPLETE_OUTPUT:`output-${label}`};const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{runs:[{targetId:slot.runId,fields,relationships:{},evidenceRefs:['lane-evidence']}]},evidence:[{temporaryKey:'lane-evidence',kind:'WORKFLOW_EVIDENCE',description:'lane evidence',location:'fixture',content:`lane-${label}`}],unresolved:[],warnings:[],attachments:[]};const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});assert(prepared.validation.valid,`Scoped lane ${label} rejected: ${JSON.stringify(prepared.validation.issues)}`);const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'});p=committed.project;return committed.acceptedChange;};
 const changeA=acceptLane(slots[0],'A'),changeB=acceptLane(slots[1],'B');const runBBefore=engine.records(p,'runs',{active:true}).find(r=>engine.recordId(r,'runs')===slots[1].runId);assert(runBBefore?.status==='COMPLETED','Run B was not completed before refinement.');
 engine.invalidateAcceptedResponse(p,{stage,rawResponseId:changeA.rawResponseId,reason:'Run A needs a more complete answer.',operatorLabel:'VERIFY'});engine.recalculate(p);
 const runA=engine.records(p,'runs',{active:true}).find(r=>engine.recordId(r,'runs')===slots[0].runId),runB=engine.records(p,'runs',{active:true}).find(r=>engine.recordId(r,'runs')===slots[1].runId);assert(runA?.status==='RESERVED','Refined Run A reservation was not restored.');assert(runB?.status==='COMPLETED','Unrelated Run B was invalidated by Run A refinement.');assert(!changeB.invalidatedBy&&engine.acceptedChanges(p,stage).some(c=>c.changeId===changeB.changeId),'Unrelated accepted Run B change was invalidated.');assert(p.projectData.generatedPrompts.some(x=>x.scope?.runId===slots[1].runId&&!x.invalidatedBy),'Unrelated Run B prompt was invalidated.');
}
console.log(JSON.stringify({scopedAcceptedResultRefinement:true},null,2));
"""
if 'scopedAcceptedResultRefinement:true' in s:
    raise SystemExit('scoped refinement regression already present')
s=s.rstrip()+append+'\n'
write(path,s)

# Runtime source changed: rotate all direct module URLs together so returning browsers cannot reuse stale code.
path='index.html'
s=read(path)
s=replace_count(s,'runtime-a65aea8f838f5b99','runtime-scoped-reliability-20260826-r1',8,'runtime build token rotation')
write(path,s)

print('Scoped reliability repair applied.')

from pathlib import Path

# workflow-engine.js: persist explicit application-owned Stage 19 freeze confirmation
p=Path('workflow-engine.js'); s=p.read_text()
old="function acceptedControlEvents(project,stage){return safe(project?.projectData?.responseDispositions).filter(item=>Number(item.stage)===Number(stage)&&['ACCEPTED_HUMAN_QUESTION_SET','ACCEPTED_BLOCKER_EVENT','ACCEPTED_EXECUTION_FAILURE'].includes(item.type)&&!item.invalidatedBy);}"
new="function acceptedControlEvents(project,stage){return safe(project?.projectData?.responseDispositions).filter(item=>Number(item.stage)===Number(stage)&&['ACCEPTED_HUMAN_QUESTION_SET','ACCEPTED_BLOCKER_EVENT','ACCEPTED_EXECUTION_FAILURE','APPLICATION_FREEZE_CONFIRMATION'].includes(item.type)&&!item.invalidatedBy);}"
assert old in s
s=s.replace(old,new,1)

old="project.projectData.iterations.push(iteration);project.job.CURRENT_ITERATION=iterationId;addHistory(project,'UNCHANGED_CONFIRMATION_ITERATION_STARTED',{stage:19,iterationId,candidateId:String(candidateId),previousIterationId,operatorLabel,identityAssurance:'SELF_ASSERTED'});recalculate(project);return iteration;"
new="""project.projectData.iterations.push(iteration);project.job.CURRENT_ITERATION=iterationId;
  const componentHashesSha256=hash.sha256Value(componentHashes),controlEventId=allocateInfrastructureId(project,'FREEZE-CONFIRM','responseDispositions'),receiptId=allocateInfrastructureId(project,'RECEIPT','outputReceipts'),controlEvidenceSha256=hash.sha256Value({candidateId:String(candidateId),previousIterationId,confirmationIterationId:iterationId,componentHashesSha256});
  const controlEvent={controlEventId,id:controlEventId,type:'APPLICATION_FREEZE_CONFIRMATION',stage:19,operation:'CONFIRM_FREEZE',iterationId,candidateId:String(candidateId),sourceIterationId:previousIterationId,componentHashesSha256,determination:'SATISFIED',evidenceSha256:controlEvidenceSha256,receiptId,createdAt,active:true,source:'APPLICATION_DERIVATION'};
  project.projectData.responseDispositions.push(controlEvent);project.stages[19].acceptedControlEventIds=[...new Set([...(project.stages[19].acceptedControlEventIds||[]),controlEventId])];
  project.projectData.outputReceipts.push({receiptId,jobId:project.job.JOB_ID,stage:19,operation:'CONFIRM_FREEZE',role:'APPLICATION',contextId:'APPLICATION',iteration:iterationId,candidateId:String(candidateId),requestDateTime:createdAt,responseDateTime:createdAt,completionState:'APPLICATION_CONTROL_COMPLETE',canonicalStateChanged:true,acceptedChange:controlEventId,downstreamInvalidated:[],newPromptRequired:false,evidenceSha256:controlEvidenceSha256,createdAt});
  addHistory(project,'UNCHANGED_CONFIRMATION_ITERATION_STARTED',{stage:19,iterationId,candidateId:String(candidateId),previousIterationId,operatorLabel,identityAssurance:'SELF_ASSERTED',controlEventId,receiptId,componentHashesSha256,evidenceSha256:controlEvidenceSha256});recalculate(project);return iteration;"""
assert old in s
s=s.replace(old,new,1)

old="case 19:{requireAccepted();const iteration=latestIteration(project,[19]);const ev=evaluateIteration(project,recordId(iteration,'iterations'),'UNCHANGED_CONFIRMATION');if(!ev.complete)reasons.push(...ev.reasons);requireCount('confirmationRecords',1);if(collection('confirmationRecords').some(r=>upper(recordValue(r,'DETERMINATION'))!=='SATISFIED'))reasons.push('Unchanged confirmation is not affirmatively satisfied.');break;}"
new="case 19:{requireAccepted();const iteration=latestIteration(project,[19]),iterationId=recordId(iteration,'iterations'),candidateId=iterationCandidateId(project,iterationId),freezeConfirmation=acceptedControlEvents(project,19).filter(event=>event.type==='APPLICATION_FREEZE_CONFIRMATION'&&String(event.iterationId||'')===String(iterationId||'')&&String(event.candidateId||'')===String(candidateId||'')&&upper(event.determination)==='SATISFIED').at(-1);if(!freezeConfirmation)reasons.push('The application-owned semantic freeze confirmation is missing for the current unchanged-confirmation iteration.');const ev=evaluateIteration(project,iterationId,'UNCHANGED_CONFIRMATION');if(!ev.complete)reasons.push(...ev.reasons);requireCount('confirmationRecords',1);if(collection('confirmationRecords').some(r=>upper(recordValue(r,'DETERMINATION'))!=='SATISFIED'))reasons.push('Unchanged confirmation is not affirmatively satisfied.');break;}"
assert old in s
s=s.replace(old,new,1)
p.write_text(s)

# app-core.js: completed application-owned CONFIRM_FREEZE must never become an agent prompt.
p=Path('app-core.js'); s=p.read_text()
old="function selectedOperation(n){const allowed=stageOperations(n);return allowed.includes(operationSelection[n])?operationSelection[n]:allowed[0];}"
new="function selectedOperation(n){const allowed=stageOperations(n),chosen=allowed.includes(operationSelection[n])?operationSelection[n]:allowed[0];if(Number(n)===19&&chosen==='CONFIRM_FREEZE'){const iterationId=String(current?.job?.CURRENT_ITERATION||''),confirmed=safe(current?.projectData?.responseDispositions).some(item=>item?.type==='APPLICATION_FREEZE_CONFIRMATION'&&!item.invalidatedBy&&String(item.iterationId||'')===iterationId&&String(item.determination||'').toUpperCase()==='SATISFIED');if(confirmed&&allowed.includes('EXECUTE_RUN'))return 'EXECUTE_RUN';}return chosen;}"
assert old in s
s=s.replace(old,new,1)

# If historical/current UI explicitly lands on CONFIRM_FREEZE before application initialization, suppress external prompt anyway.
old="function currentStagePrompt(n){const lock=stageLocked(n);if(Number(n)===28)return 'NO EXTERNAL AGENT INSTRUCTION REQUIRED"
new="function currentStagePrompt(n){const lock=stageLocked(n);if(Number(n)===19&&selectedOperation(19)==='CONFIRM_FREEZE')return 'NO EXTERNAL AGENT INSTRUCTION REQUIRED\\n\\nStage 19 semantic freeze confirmation is an application-owned operation. Use the current next-action control to begin the unchanged confirmation. The application binds the exact converged candidate identity and component hashes, records the control event and receipt, and then advances to execution. Do not send an agent prompt or paste agent JSON for CONFIRM_FREEZE.';if(Number(n)===28)return 'NO EXTERNAL AGENT INSTRUCTION REQUIRED"
assert old in s
s=s.replace(old,new,1)

# Prevent save/copy/response controls if a stale UI lane ever resolves to CONFIRM_FREEZE.
old="applicationOnlyInteraction=(n===22&&nativeStage22Tests().length>0)||n===28||['CALCULATE_RELEASE','BUILD_EVIDENCE_CHAINS','FREEZE_CANDIDATE','RESERVE_RUN_BATCH','BEGIN_UNCHANGED_CONFIRMATION','FREEZE_BASELINE','REGISTER_PRODUCTION_CONTEXT','RESERVE_PRODUCT_EXECUTION'].includes(displayedStageAction(n).actionType)"
new="applicationOnlyInteraction=(n===22&&nativeStage22Tests().length>0)||n===28||(n===19&&selectedOperation(n)==='CONFIRM_FREEZE')||['CALCULATE_RELEASE','BUILD_EVIDENCE_CHAINS','FREEZE_CANDIDATE','RESERVE_RUN_BATCH','BEGIN_UNCHANGED_CONFIRMATION','FREEZE_BASELINE','REGISTER_PRODUCTION_CONTEXT','RESERVE_PRODUCT_EXECUTION'].includes(displayedStageAction(n).actionType)"
assert old in s
s=s.replace(old,new,1)
p.write_text(s)

# Advance shared runtime token only; no CSS/geometry changes.
import re
BUILD='runtime-20260830-live-operator-54'
for name in ['index.html','app-core.js','test-runtime.js']:
    p=Path(name); text=p.read_text(); text=re.sub(r'runtime-20260830-live-operator-\d+',BUILD,text); p.write_text(text)

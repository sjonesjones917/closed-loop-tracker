from pathlib import Path
import re

p=Path('response-ingestion.js');s=p.read_text()
block=re.search(r"function prepare\(project,.*?\n\}\n\nfunction findProposal",s,re.S)
assert block
replacement=r'''function captureRaw(project,{stage,text,promptRecord,contextId='UNKNOWN',files=[]}={}){
  const next=clone(project);workflow.ensureShape(next);const stageNumber=Number(stage),prompt=promptRecordFor(next,promptRecord);
  if(!Number.isInteger(stageNumber)||stageNumber<1||stageNumber>schema.STAGE_COUNT)throw new Error('A valid stage is required for raw capture.');
  if(!prompt)throw new Error('The controlling persisted prompt is required for raw capture.');
  const rawResponseId=workflow.allocateInfrastructureId(next,'RAW-RESPONSE','rawResponses'),outputId=workflow.allocateInfrastructureId(next,`STAGE-${String(stageNumber).padStart(2,'0')}-OUTPUT`,'generatedOutputs'),rawText=String(text??''),rawSha256=hash.rawResponseSha256(rawText),createdAt=now();
  const rawRecord={rawResponseId,outputId,jobId:next.job.JOB_ID,stage:stageNumber,role:globalThis.closedLoopCore?.STAGES?.[stageNumber-1]?.role||'UNKNOWN',contextId,iteration:next.job.CURRENT_ITERATION||'NOT APPLICABLE',promptInstructionId:prompt.instructionId||prompt.promptId,promptBodySha256:prompt.bodySha256||prompt.sha256,promptContractSha256:prompt.contractSha256,promptContextSignature:prompt.contextSignature,promptScope:clone(prompt.scope||{}),createdAt,sha256:rawSha256,completeRawResponse:rawText,files:clone(files),status:'PRESERVED',projectRevisionAtCapture:Number(next.revision||0)};
  next.projectData.rawResponses.push(rawRecord);next.projectData.generatedOutputs.push({outputId,rawResponseId,stage:stageNumber,role:rawRecord.role,iteration:rawRecord.iteration,createdAt,sha256:rawSha256,output:rawText,status:'RAW_RESPONSE_PRESERVED'});workflow.addHistory(next,'RAW_RESPONSE_PRESERVED',{stage:stageNumber,rawResponseId,outputId,sha256:rawSha256,promptInstructionId:rawRecord.promptInstructionId});
  return {project:next,rawRecord,promptRecord:prompt};
}

function prepareCaptured(project,{rawResponseId,promptRecord=null,expectedCommittedRevision=null}={}){
  const next=clone(project);workflow.ensureShape(next);const rawRecord=findRaw(next,rawResponseId);if(!rawRecord)throw new Error('Preserved raw response does not exist.');
  if(rawRecord.status!=='PRESERVED'&&rawRecord.status!=='VALIDATION_FAILED'&&rawRecord.status!=='VALIDATED_PENDING_REVIEW'){
    const priorReceipt=rawRecord.receiptId?findReceipt(next,rawRecord.receiptId):null,priorProposal=rawRecord.proposalId?findProposal(next,rawRecord.proposalId):null,priorValidation=rawRecord.validationId?findValidation(next,rawRecord.validationId):null;
    return {project:next,rawRecord,validation:priorValidation,proposal:priorProposal,receipt:priorReceipt,disposition:safe(next.projectData.responseDispositions).find(d=>d.rawResponseId===rawRecord.rawResponseId)||null,idempotent:true};
  }
  const stageNumber=Number(rawRecord.stage),prompt=promptRecordFor(next,promptRecord||{instructionId:rawRecord.promptInstructionId});if(!prompt)throw new Error('The controlling persisted prompt is unavailable.');const rawText=String(rawRecord.completeRawResponse??'');
  let envelope=null,parseError=null;try{envelope=strictParse(rawText);}catch(error){parseError=error;}
  if(envelope){
    const envelopeHash=hash.canonicalEnvelopeSha256(envelope),prior=safe(next.projectData.rawResponses).find(r=>r.rawResponseId!==rawRecord.rawResponseId&&r.canonicalEnvelopeSha256===envelopeHash&&Number(r.stage)===stageNumber&&r.promptInstructionId===(prompt.instructionId||prompt.promptId));
    rawRecord.canonicalEnvelopeSha256=envelopeHash;
    if(prior){rawRecord.status='DUPLICATE_RESPONSE';rawRecord.duplicateOfRawResponseId=prior.rawResponseId;rawRecord.receiptId=prior.receiptId||null;rawRecord.validationId=prior.validationId||null;rawRecord.proposalId=prior.proposalId||null;workflow.addHistory(next,'DUPLICATE_RESPONSE_RETURNED',{stage:stageNumber,rawResponseId:rawRecord.rawResponseId,duplicateOfRawResponseId:prior.rawResponseId});return {project:next,rawRecord,validation:prior.validationId?findValidation(next,prior.validationId):null,proposal:prior.proposalId?findProposal(next,prior.proposalId):null,receipt:prior.receiptId?findReceipt(next,prior.receiptId):null,disposition:safe(next.projectData.responseDispositions).find(d=>d.rawResponseId===prior.rawResponseId)||null,duplicate:true};}
  }
  let validation;if(parseError)validation={valid:false,issues:[issue(parseError.code||'MALFORMED_JSON','/',parseError.message)],errorCount:1,warningCount:0,checkedAt:now(),responseSchema:null,responseType:null};else validation=validateEnvelope(next,envelope,{stage:stageNumber,promptRecord:prompt,rawSha256:rawRecord.sha256});
  const validationId=workflow.allocateInfrastructureId(next,'VALIDATION','responseValidations'),validationRecord={validationId,rawResponseId:rawRecord.rawResponseId,jobId:next.job.JOB_ID,stage:stageNumber,promptId:prompt.instructionId||prompt.promptId,promptSha256:prompt.bodySha256||prompt.sha256,createdAt:now(),valid:validation.valid,issues:clone(validation.issues),errorCount:validation.errorCount,warningCount:validation.warningCount,responseSchema:validation.responseSchema,responseType:validation.responseType,status:validation.valid?'VALID':'REJECTED'};
  next.projectData.responseValidations.push(validationRecord);rawRecord.validationId=validationId;rawRecord.status=validation.valid?'VALIDATED_PENDING_REVIEW':'VALIDATION_FAILED';
  let proposal=null;if(validation.valid){proposal=planProposal(next,envelope,{rawRecord,promptRecord:prompt,validationRecord,expectedProjectRevision:expectedCommittedRevision===null?Number(next.revision||0):Number(expectedCommittedRevision)});next.projectData.responseProposals.push(proposal);rawRecord.proposalId=proposal.proposalId;}
  const receipt=createReceipt(next,{stage:stageNumber,promptRecord:prompt,rawRecord,validationRecord,proposal});let responseDisposition=null;
  if(!validation.valid){responseDisposition=disposition(next,'VALIDATION_FAILED_RESPONSE',{stage:stageNumber,rawResponseId:rawRecord.rawResponseId,promptId:prompt.instructionId||prompt.promptId,validationId,receiptId:receipt.receiptId,details:{issueCodes:validation.issues.map(x=>x.code)}});receipt.rejectedResponseId=responseDisposition.dispositionId;receipt.completionState='VALIDATION_FAILED_RESPONSE';rawRecord.dispositionId=responseDisposition.dispositionId;}
  rawRecord.receiptId=receipt.receiptId;validationRecord.receiptId=receipt.receiptId;if(proposal)proposal.receiptId=receipt.receiptId;workflow.addHistory(next,validation.valid?'RESPONSE_VALIDATED':'RESPONSE_VALIDATION_FAILED',{stage:stageNumber,rawResponseId:rawRecord.rawResponseId,validationId,proposalId:proposal?.proposalId||'NONE',issueCodes:validation.issues.map(item=>item.code)});workflow.recalculate(next);
  return {project:next,rawRecord,validation:validationRecord,proposal,receipt,disposition:responseDisposition};
}

function prepare(project,options={}){const captured=captureRaw(project,options);return prepareCaptured(captured.project,{rawResponseId:captured.rawRecord.rawResponseId,promptRecord:captured.promptRecord,expectedCommittedRevision:options.expectedProjectRevision??options.expectedCommittedRevision??null});}

function findProposal'''
s=s[:block.start()]+replacement+s[block.end():]
# Export the two durable operations while retaining prepare as the one compatibility path.
match=re.search(r"globalThis\.closedLoopResponseIngestion=Object\.freeze\(\{(.*?)\}\);",s,re.S)
assert match
body=match.group(1)
assert 'prepare' in body
if 'captureRaw' not in body:
    body=body.replace('prepare,','captureRaw,prepareCaptured,prepare,',1)
s=s[:match.start(1)]+body+s[match.end(1):]
p.write_text(s)

p=Path('app-core.js');s=p.read_text()
match=re.search(r"async function prepareStageResponse\(\)\{.*?\}\nfunction pendingProposal",s,re.S)
assert match
replacement=r'''function downloadRawRecovery(text,prompt,error){const payload={schema:'closed-loop-raw-response-recovery/1',failedOperation:'RAW_CAPTURE',canonicalStateChanged:false,jobId:current?.job?.JOB_ID||null,stage:current?.activeStage||null,promptIdentity:prompt?{instructionId:prompt.instructionId||prompt.promptId,bodySha256:prompt.bodySha256||prompt.sha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature}:null,error:String(error?.message||error),rawResponse:String(text??'')},blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${current?.job?.JOB_ID||'project'}-raw-response-recovery.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0);}
async function prepareStageResponse(){
  const n=current.activeStage,text=$('#stage-output')?.value||'',prompt=await savePromptRecord(n);let captured;
  try{captured=ingestion.captureRaw(current,{stage:n,text,promptRecord:prompt,files:safe(current.stages[n].authorizedFiles)});captured.project.stages[n].responseDraft=text;await persistReplacement(captured.project);announce('saved');}
  catch(error){console.error(error);announce('storage failed');downloadRawRecovery(text,prompt,error);alert(`Raw response storage failed. Canonical state did not change. The pasted response remains in place and a recovery file was produced: ${error.message||error}`);return;}
  try{const prepared=ingestion.prepareCaptured(current,{rawResponseId:captured.rawRecord.rawResponseId,promptRecord:prompt,expectedCommittedRevision:Number(current.revision||0)+1});await persistReplacement(prepared.project);announce(prepared.validation?.valid?'proposal ready':'validation failed');render();queueMicrotask(()=>$(prepared.validation?.valid?'#proposal-heading':'#validation-report')?.focus());}
  catch(error){console.error(error);announce('storage failed');alert(`The raw response was preserved, but validation/proposal storage failed. Canonical state did not change: ${error.message||error}`);}
}
function pendingProposal'''
s=s[:match.start()]+replacement+s[match.end():]
p.write_text(s)

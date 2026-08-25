from pathlib import Path
import re

def replace_func(src,name,body):
    marker=f'function {name}('
    start=src.find(marker)
    if start<0: raise RuntimeError(f'Missing function {name}')
    brace=src.find('{',start);depth=0;quote=None;esc=False
    for i in range(brace,len(src)):
        c=src[i]
        if quote:
            if esc:esc=False
            elif c=='\\':esc=True
            elif c==quote:quote=None
        else:
            if c in "'\"`":quote=c
            elif c=='{':depth+=1
            elif c=='}':
                depth-=1
                if depth==0:return src[:start]+body+src[i+1:]
    raise RuntimeError(f'Unterminated {name}')

# Atomic complete package import: validate package/artifact bytes before one project+artifact activation transaction.
p=Path('project-store.js');s=p.read_text()
s=replace_func(s,'importPackage',r'''function importPackage(blob){return (async()=>{try{const compressed=new Uint8Array(await blob.arrayBuffer()),json=new TextDecoder().decode(await decompressBytes(compressed)),payload=JSON.parse(json),{packageSha256,...body}=payload;if(hash.sha256Value(body)!==packageSha256)throw new Error('Project package hash mismatch.');if(body.schema!=='closed-loop-project-package/1')throw new Error('Unsupported project package schema.');const verified=[];for(const a of body.artifacts||[]){const bytes=base64ToBytes(a.base64);if(bytes.byteLength!==Number(a.byteSize))throw new Error(`Artifact ${a.artifactId} byte size mismatch.`);if(await hash.sha256Bytes(bytes)!==a.sha256)throw new Error(`Artifact ${a.artifactId} hash mismatch.`);verified.push({...a,bytes});}const project=body.project,id=projectIdentity(project);if(!id)throw new Error('Imported project has no JOB_ID.');const db=await openDatabase(),tx=db.transaction([PROJECTS,ARTIFACTS,META],'readwrite'),ps=tx.objectStore(PROJECTS),prior=await request(ps.get(id)),currentRevision=Number(prior?.revision||0),next=clone(project);next.revision=prior?currentRevision+1:Number(project.revision||0);delete next.projectSha256;const digest=projectSha256(next);fault('before-package-activation');ps.put({jobId:id,revision:next.revision,project:next,projectSha256:digest,updatedAt:now()});for(const a of verified){fault('during-artifact-blob-write');tx.objectStore(ARTIFACTS).put({artifactId:a.artifactId,jobId:id,blob:new Blob([a.bytes],{type:a.mediaType}),filename:a.filename,mediaType:a.mediaType,byteSize:Number(a.byteSize),sha256:a.sha256,lineage:clone(a.lineage),createdAt:a.createdAt||now()});}tx.objectStore(META).put({key:'lastCommittedRevision',value:{jobId:id,revision:next.revision,projectSha256:digest},updatedAt:now()});fault('before-package-commit');await complete(tx);next.projectSha256=digest;return next;}catch(error){throw Object.assign(error,{existingProjectsUnchanged:true});}})();}''')
# Export fault hook for storage-failure matrix and expose fault for controlled browser tests.
s=s.replace("async function exportPackage(jobId){", "async function exportPackage(jobId){fault('before-package-export');")
s=s.replace("storageHealth,metaGet,metaPut,clearLegacy", "storageHealth,metaGet,metaPut,clearLegacy,fault") if 'clearLegacy,fault' not in s else s
p.write_text(s)

# Split raw capture from parse/proposal while preserving prepare() compatibility for existing tests.
p=Path('response-ingestion.js');s=p.read_text()
old_start=s.find("function prepare(project,{stage,text,promptRecord,contextId='UNKNOWN',files=[]}={}){")
if old_start<0: raise RuntimeError('prepare signature not found')
brace=s.find('{',old_start);depth=0;quote=None;esc=False;end=None
for i in range(brace,len(s)):
    c=s[i]
    if quote:
        if esc:esc=False
        elif c=='\\':esc=True
        elif c==quote:quote=None
    else:
        if c in "'\"`":quote=c
        elif c=='{':depth+=1
        elif c=='}':
            depth-=1
            if depth==0:end=i+1;break
if end is None:raise RuntimeError('prepare body incomplete')
replacement=r'''function captureRaw(project,{stage,text,promptRecord,contextId='UNKNOWN',files=[]}={}){const next=clone(project);workflow.ensureShape(next);const stageNumber=Number(stage),prompt=promptRecordFor(next,promptRecord),rawResponseId=workflow.allocateInfrastructureId(next,'RAW-RESPONSE','rawResponses'),outputId=workflow.allocateInfrastructureId(next,`STAGE-${String(stageNumber).padStart(2,'0')}-OUTPUT`,'generatedOutputs'),rawText=String(text??''),rawSha256=hash.rawResponseSha256(rawText),rawRecord={rawResponseId,outputId,jobId:next.job.JOB_ID,stage:stageNumber,role:globalThis.closedLoopCore?.STAGES?.[stageNumber-1]?.role||'UNKNOWN',contextId,iteration:next.job.CURRENT_ITERATION||'NOT APPLICABLE',promptInstructionId:prompt?.instructionId||prompt?.promptId||'UNKNOWN',promptSha256:prompt?.sha256||prompt?.bodySha256||'UNKNOWN',createdAt:now(),sha256:rawSha256,completeRawResponse:rawText,files:clone(files),status:'PRESERVED',projectRevision:Number(next.revision||0)};next.projectData.rawResponses.push(rawRecord);next.projectData.generatedOutputs.push({outputId,rawResponseId,stage:stageNumber,role:rawRecord.role,iteration:rawRecord.iteration,createdAt:rawRecord.createdAt,sha256:rawSha256,output:rawText,status:'RAW_RESPONSE_PRESERVED'});workflow.addHistory(next,'RAW_RESPONSE_PRESERVED',{stage:stageNumber,rawResponseId,outputId,sha256:rawSha256});return {project:next,rawRecord};}
function prepare(project,{stage,text,promptRecord,contextId='UNKNOWN',files=[],rawResponseId=null}={}){let next,rawRecord;if(rawResponseId){next=clone(project);workflow.ensureShape(next);rawRecord=safe(next.projectData.rawResponses).find(r=>r.rawResponseId===String(rawResponseId));if(!rawRecord)throw new Error(`Preserved raw response ${rawResponseId} does not exist.`);}else{const capture=captureRaw(project,{stage,text,promptRecord,contextId,files});next=capture.project;rawRecord=capture.rawRecord;}const stageNumber=Number(stage),prompt=promptRecordFor(next,promptRecord),rawText=rawRecord.completeRawResponse,rawSha256=rawRecord.sha256;if(Number(rawRecord.stage)!==stageNumber)throw new Error('Preserved raw response belongs to another stage.');let envelope=null,parseError=null;try{envelope=strictParse(rawText);}catch(error){parseError=error;}if(envelope){const envelopeHash=hash.canonicalEnvelopeSha256(envelope),prior=safe(next.projectData.rawResponses).find(r=>r.rawResponseId!==rawRecord.rawResponseId&&r.canonicalEnvelopeSha256===envelopeHash&&Number(r.stage)===stageNumber&&r.promptInstructionId===(prompt?.instructionId||prompt?.promptId));if(prior){const receipt=findReceipt(next,prior.receiptId),proposal=prior.proposalId?findProposal(next,prior.proposalId):null,validation=prior.validationId?findValidation(next,prior.validationId):null;return {project:next,rawRecord:prior,validation,proposal,receipt,disposition:safe(next.projectData.responseDispositions).find(d=>d.rawResponseId===prior.rawResponseId)||null,duplicate:true};}}let validation;if(parseError)validation={valid:false,issues:[issue(parseError.code||'MALFORMED_JSON','/',parseError.message)],errorCount:1,warningCount:0,checkedAt:now(),responseSchema:null,responseType:null};else validation=validateEnvelope(next,envelope,{stage:stageNumber,promptRecord:prompt,rawSha256});if(envelope)rawRecord.canonicalEnvelopeSha256=hash.canonicalEnvelopeSha256(envelope);const validationId=workflow.allocateInfrastructureId(next,'VALIDATION','responseValidations'),validationRecord={validationId,rawResponseId:rawRecord.rawResponseId,jobId:next.job.JOB_ID,stage:stageNumber,promptId:prompt?.instructionId||prompt?.promptId||'UNKNOWN',promptSha256:prompt?.sha256||prompt?.bodySha256||'UNKNOWN',createdAt:now(),valid:validation.valid,issues:clone(validation.issues),errorCount:validation.errorCount,warningCount:validation.warningCount,responseSchema:validation.responseSchema,responseType:validation.responseType,status:validation.valid?'VALID':'REJECTED'};next.projectData.responseValidations.push(validationRecord);rawRecord.validationId=validationId;rawRecord.status=validation.valid?'VALIDATED_PENDING_REVIEW':'VALIDATION_FAILED';let proposal=null;if(validation.valid){proposal=planProposal(next,envelope,{rawRecord,promptRecord:prompt,validationRecord});next.projectData.responseProposals.push(proposal);rawRecord.proposalId=proposal.proposalId;}const receipt=createReceipt(next,{stage:stageNumber,promptRecord:prompt||{},rawRecord,validationRecord,proposal});let responseDisposition=null;if(!validation.valid){responseDisposition=disposition(next,'VALIDATION_FAILED_RESPONSE',{stage:stageNumber,rawResponseId:rawRecord.rawResponseId,promptId:prompt?.instructionId||prompt?.promptId||'UNKNOWN',validationId,receiptId:receipt.receiptId,details:{issueCodes:validation.issues.map(x=>x.code)}});receipt.rejectedResponseId=responseDisposition.dispositionId;receipt.completionState='VALIDATION_FAILED_RESPONSE';rawRecord.dispositionId=responseDisposition.dispositionId;}rawRecord.receiptId=receipt.receiptId;validationRecord.receiptId=receipt.receiptId;if(proposal)proposal.receiptId=receipt.receiptId;workflow.addHistory(next,validation.valid?'RESPONSE_VALIDATED':'RESPONSE_VALIDATION_FAILED',{stage:stageNumber,rawResponseId:rawRecord.rawResponseId,validationId,proposalId:proposal?.proposalId||'NONE',issueCodes:validation.issues.map(item=>item.code)});workflow.recalculate(next);return {project:next,rawRecord,validation:validationRecord,proposal,receipt,disposition:responseDisposition};}'''
s=s[:old_start]+replacement+s[end:]
s=s.replace('proposalPreconditions,prepare,commit', 'proposalPreconditions,captureRaw,prepare,commit')
p.write_text(s)

# Add engine commands for prompt storage, migration quarantine, and new-project reset.
p=Path('workflow-engine.js');s=p.read_text();marker='globalThis.closedLoopWorkflowEngine=Object.freeze({';idx=s.find(marker)
if idx<0:raise RuntimeError('workflow-engine export missing')
helpers=r'''
function saveGeneratedPrompt(project,prompt){ensureShape(project);const existing=safe(project.projectData.generatedPrompts).find(x=>Number(x.stage)===Number(prompt.stage)&&x.contextSignature===prompt.contextSignature&&x.bodySha256===prompt.bodySha256&&!x.invalidatedBy);if(existing)return existing;const record={...clone(prompt),generatedAt:now(),iteration:project.job.CURRENT_ITERATION||'NOT APPLICABLE'};project.projectData.generatedPrompts.push(record);addHistory(project,'INSTRUCTION_SAVED',{recordId:record.instructionId||record.promptId,stage:Number(record.stage),sha256:record.sha256||record.bodySha256});return record;}
function archiveMigrationPayload(project,{kind='ORIGINAL_IMPORT_PAYLOAD',stage=null,payload,reason=null}={}){ensureShape(project);project.projectData.migrationArchives=safe(project.projectData.migrationArchives);const archive={archiveId:allocateInfrastructureId(project,'MIGRATION-ARCHIVE','migrationArchives'),kind,stage,operational:false,payload:clone(payload),reason,createdAt:now()};project.projectData.migrationArchives.push(archive);return archive;}
function recordNewJobReset(project,fields){ensureShape(project);const definition=schema.RECORD_SCHEMAS.newJobResets,id=allocateId(project,'newJobResets'),full={...clone(fields),[definition.idField]:id},record={id,stage:1,createdAt:now(),active:true,fields:full,...full,source:'APPLICATION_DERIVATION'};record.sha256=hash.sha256Value(full);project.projectData.newJobResets.push(record);addHistory(project,'NEW_JOB_RESET_RECORDED',{recordId:id});return record;}
function replaceImportedCollection(project,collection,value){ensureShape(project);if(!Object.prototype.hasOwnProperty.call(project.projectData,collection))throw new Error(`Unknown import collection ${collection}.`);project.projectData[collection]=clone(safe(value));return project.projectData[collection];}
'''
s=s[:idx]+helpers+'\n'+s[idx:]
s=s.replace('freezeCandidate,freezeBaseline,', 'freezeCandidate,freezeBaseline,saveGeneratedPrompt,archiveMigrationPayload,recordNewJobReset,replaceImportedCollection,')
p.write_text(s)

# Finalize app persistence: prompt save and raw/proposal writes do not advance canonical revision; acceptance does.
p=Path('app-core.js');s=p.read_text()
s=replace_func(s,'persistReplacement',r'''function persistReplacement(next,{incrementRevision=true}={}){return (async()=>{engine.ensureShape(next);engine.recalculate(next);const committed=await projectStore.replaceProject(next,{expectedProjectRevision:Number(current?.revision||0),incrementRevision});projects=projects.map(p=>p===current||p.job?.JOB_ID===committed.job?.JOB_ID?committed:p);if(!projects.some(p=>p.job?.JOB_ID===committed.job?.JOB_ID))projects.unshift(committed);current=committed;return committed;})();}''')
s=replace_func(s,'save',r'''function save(){return (async()=>{try{if(!current)return true;await persistReplacement(current,{incrementRevision:false});announce('saved');return true;}catch(error){console.error(error);announce('storage failed');alert(`Save failed without replacing the prior persisted project state: ${error.message||error}`);return false;}})();}''')
s=replace_func(s,'savePromptRecord',r'''function savePromptRecord(n){return (async()=>{const candidate=globalThis.closedLoopPromptEngine.buildPromptRecord(n,current),next=clone(current),record=engine.saveGeneratedPrompt(next,candidate),already=safe(current.projectData.generatedPrompts).some(x=>(x.instructionId||x.promptId)===(record.instructionId||record.promptId));if(!already)await persistReplacement(next,{incrementRevision:false});return record;})();}''')
s=replace_func(s,'prepareStageResponse',r'''function prepareStageResponse(){return (async()=>{const n=current.activeStage,text=$('#stage-output')?.value||'',prompt=await savePromptRecord(n);try{projectStore.fault('before-raw-write');const captured=ingestion.captureRaw(current,{stage:n,text,promptRecord:prompt,files:safe(current.stages[n].authorizedFiles)});captured.project.stages[n].responseDraft=text;await persistReplacement(captured.project,{incrementRevision:false});projectStore.fault('after-raw-commit');const prepared=ingestion.prepare(current,{stage:n,text,promptRecord:prompt,files:safe(current.stages[n].authorizedFiles),rawResponseId:captured.rawRecord.rawResponseId});await persistReplacement(prepared.project,{incrementRevision:false});announce(prepared.validation?.valid?'proposal ready':'validation failed');render();queueMicrotask(()=>$(prepared.validation?.valid?'#proposal-heading':'#validation-report')?.focus());}catch(error){announce('storage failed');try{const blob=new Blob([text],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${current.job.JOB_ID}-raw-response-recovery.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0);}catch{}alert(`Response storage/validation failed. The returned-output field remains unchanged and canonical state did not change: ${error.message||error}`);}})();}''')
# Ensure canonical acceptance/rejection/human changes await revisioned persistence; normalize accidental bare calls from prior transformer.
s=s.replace('await persistReplacement(result.project);announce(\'response accepted\')','await persistReplacement(result.project,{incrementRevision:true});announce(\'response accepted\')')
s=s.replace('await persistReplacement(result.project);announce(\'response rejected\')','await persistReplacement(result.project,{incrementRevision:true});announce(\'response rejected\')')
# Replace legacy active copies with engine-owned quarantine and historical migration records.
s=s.replace("p.projectData.userEntered=clone(raw.userJobInput||{});for(const [to,from] of Object.entries(map))p.projectData[to]=safe(raw[from]);", "p.projectData.userEntered=clone(raw.userJobInput||{});for(const [to,from] of Object.entries(map))engine.replaceImportedCollection(p,to,safe(raw[from]));")
s=s.replace("p.projectData.migrationArchives=safe(p.projectData.migrationArchives);p.projectData.migrationArchives.push({kind:'ORIGINAL_IMPORT_PAYLOAD',operational:false,payload:clone(raw)});", "engine.archiveMigrationPayload(p,{kind:'ORIGINAL_IMPORT_PAYLOAD',payload:raw});")
s=s.replace("p.projectData.migrationArchives.push({kind:'LEGACY_STAGE_RECORD',stage:n,operational:false,payload:clone(r)});", "engine.archiveMigrationPayload(p,{kind:'LEGACY_STAGE_RECORD',stage:n,payload:r});")
s=s.replace("r.projectData.recoveredProjects=[{reason:String(error.message||error),quarantinedOriginalProject:clone(p),operational:false}];", "engine.archiveMigrationPayload(r,{kind:'FAILED_MIGRATION',payload:p,reason:String(error.message||error)});")
s=s.replace('p.projectData.newJobResets.push(reset);','engine.recordNewJobReset(p,reset.fields||reset);')
# Remove any remaining direct projectData collection push in app-core by failing transformation; assignments for userEntered/permanentRegistry are non-collection metadata.
o=re.findall(r'projectData\.([A-Za-z0-9_]+)\.push\(',s)
if o:raise RuntimeError('Direct projectData pushes remain in app-core: '+','.join(sorted(set(o))))
p.write_text(s)

# Make validation report focusable.
p=Path('app-core.js');s=p.read_text();s=s.replace('<div class="notice danger"><strong>Response rejected before canonical mutation.</strong>','<div class="notice danger" id="validation-report" tabindex="-1"><strong>Response rejected before canonical mutation.</strong>');p.write_text(s)
print('PR5 finalization complete')

from pathlib import Path
import re


def replace_once(path, old, new, label):
    p=Path(path); text=p.read_text()
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    p.write_text(text.replace(old,new,1))

# 1. Stage 01 prompt/context must contain the exact application-verified supplied artifact manifest.
replace_once('workflow-schema.js',
"const READ_COLLECTIONS=Object.freeze({1:[],2:[],3:['sources','sourceConflicts']",
"const READ_COLLECTIONS=Object.freeze({1:['artifacts'],2:[],3:['sources','sourceConflicts']",
'Stage 01 artifact read contract')

# 2. Resource-limit enforcement must use the same effective limit represented by the response contract.
p=Path('response-ingestion.js'); text=p.read_text()
old="function validateValue(definition,value,path,issues,{required=false}={}){"
new="function validateValue(definition,value,path,issues,{required=false,maxTextFieldLength=schema.DEFAULT_RESOURCE_LIMITS.maxTextFieldLength}={}){"
if text.count(old)!=1: raise SystemExit('validateValue signature mismatch')
text=text.replace(old,new,1)
old="if(typeof value==='string'&&value.length>200000)issues.push(issue('TEXT_FIELD_TOO_LARGE',path,'Text field exceeds the configured maximum length.'));"
new="if(typeof value==='string'&&value.length>Number(maxTextFieldLength))issues.push(issue('TEXT_FIELD_TOO_LARGE',path,'Text field exceeds the configured maximum length.'));"
if text.count(old)!=1: raise SystemExit('hard-coded text limit mismatch')
text=text.replace(old,new,1)
old="const expectedOperation=promptRecord?.operation||contract?.operations?.[0];const operationContract=schema.operationContract(stageNumber,expectedOperation);if(String(envelope.operation||'')!==String(expectedOperation||''))"
new="const expectedOperation=promptRecord?.operation||contract?.operations?.[0];const operationContract=schema.operationContract(stageNumber,expectedOperation);const effectiveResourceLimits=operationContract?.resourceLimits||contract?.resourceLimits||schema.DEFAULT_RESOURCE_LIMITS;if(String(envelope.operation||'')!==String(expectedOperation||''))"
if text.count(old)!=1: raise SystemExit('operation contract location mismatch')
text=text.replace(old,new,1)
old="validateValue(definition,value,path,issues);"
new="validateValue(definition,value,path,issues,{maxTextFieldLength:effectiveResourceLimits.maxTextFieldLength});"
if text.count(old)!=1: raise SystemExit('stageData validateValue call mismatch')
text=text.replace(old,new,1)
old="validateValue(fieldDefinition,value,fieldPath,issues,{required:definition.required.includes(name)});"
new="validateValue(fieldDefinition,value,fieldPath,issues,{required:definition.required.includes(name),maxTextFieldLength:effectiveResourceLimits.maxTextFieldLength});"
if text.count(old)!=1: raise SystemExit('record validateValue call mismatch')
text=text.replace(old,new,1)
p.write_text(text)

# 3. Input identity includes actual Stage 01 supplied bytes, and stage activity includes prompts/proposals/confirmations.
p=Path('workflow-engine.js'); text=p.read_text()
old="function hasStageActivity(project,stage){\n  if(acceptedChanges(project,stage).length)return true;\n  if(safe(project?.projectData?.rawResponses).some(item=>Number(item.stage)===Number(stage)))return true;\n  if(unresolvedHumanRequests(project,stage).length)return true;"
new="function hasStageActivity(project,stage){\n  if(acceptedChanges(project,stage).length)return true;\n  if(safe(project?.projectData?.generatedPrompts).some(item=>Number(item.stage)===Number(stage)&&!item.invalidatedBy))return true;\n  if(safe(project?.projectData?.responseProposals).some(item=>Number(item.stage)===Number(stage)&&!item.invalidatedBy))return true;\n  if(safe(project?.projectData?.stageConfirmations).some(item=>Number(item.stage)===Number(stage)&&!item.invalidatedBy))return true;\n  if(safe(project?.projectData?.rawResponses).some(item=>Number(item.stage)===Number(stage)))return true;\n  if(unresolvedHumanRequests(project,stage).length)return true;"
if text.count(old)!=1: raise SystemExit('hasStageActivity mismatch')
text=text.replace(old,new,1)
old="const payload={...Object.fromEntries(schema.HUMAN_INTAKE_FIELDS.map(name=>[name,project.job[name]??''])),clarifications:clone(project.projectData.userEntered?.clarifications||[])};"
new="const suppliedArtifacts=records(project,'artifacts').filter(record=>Number(record.stage)===1).map(record=>({artifactId:recordId(record,'artifacts'),logicalPath:String(recordValue(record,'FILENAME')||''),mediaType:String(recordValue(record,'TYPE')||''),byteSize:Number(recordValue(record,'BYTE_SIZE')),sha256:String(recordValue(record,'SHA256')||''),availability:String(recordValue(record,'AVAILABILITY')||'')})).sort((a,b)=>a.artifactId.localeCompare(b.artifactId));\n  const payload={...Object.fromEntries(schema.HUMAN_INTAKE_FIELDS.map(name=>[name,project.job[name]??''])),clarifications:clone(project.projectData.userEntered?.clarifications||[]),suppliedArtifacts};"
if text.count(old)!=1: raise SystemExit('input version payload mismatch')
text=text.replace(old,new,1)

# Stage 20 baseline is derived exclusively from the exact Stage 19-confirmed candidate manifest.
pattern=r"function freezeBaseline\(project,\{artifactIds=\[\],operatorLabel='HUMAN_OPERATOR',authorization='AUTHORIZED'\}=\{\}\)\{.*?\n\}\nfunction reserveProductExecution"
m=re.search(pattern,text,re.S)
if not m: raise SystemExit('freezeBaseline function not found')
replacement="""function freezeBaseline(project,{artifactIds=[],operatorLabel='HUMAN_OPERATOR',authorization='AUTHORIZED'}={}){
  ensureShape(project);const confirmation=recordsForCurrentScope(project,'confirmationRecords').filter(r=>upper(recordValue(r,'DETERMINATION'))==='SATISFIED').at(-1);if(!confirmation)throw new Error('A current successful unchanged confirmation is required before baseline freeze.');const currentIteration=records(project,'iterations').find(r=>recordId(r,'iterations')===String(project.job.CURRENT_ITERATION||'')&&isActiveRecord(r));if(!currentIteration||Number(currentIteration.stage)!==19)throw new Error('The current unchanged-confirmation iteration is required before baseline freeze.');const currentCandidateId=iterationCandidateId(project,recordId(currentIteration,'iterations')),currentCandidate=records(project,'candidateFreezes').find(r=>recordId(r,'candidateFreezes')===currentCandidateId&&isActiveRecord(r));if(!currentCandidate||!candidateComponentIdentity(project,currentCandidateId))throw new Error('The unchanged-confirmation iteration does not resolve to an active frozen candidate.');const candidateManifest=safe(recordValue(currentCandidate,'COMPONENT_MANIFEST')),candidateArtifactIds=candidateManifest.map(item=>String(item?.artifactId||''));if(!candidateArtifactIds.length||candidateArtifactIds.some(id=>!id)||new Set(candidateArtifactIds).size!==candidateArtifactIds.length)throw new Error('The confirmed candidate manifest is incomplete or contains duplicate artifact identities.');if(safe(artifactIds).length&&hash.sha256Value([...new Set(safe(artifactIds).map(String))].sort())!==hash.sha256Value([...candidateArtifactIds].sort()))throw new Error('Baseline artifact selection cannot differ from the exact confirmed candidate manifest.');const artifacts=selectedArtifacts(project,candidateArtifactIds),byId=new Map(artifacts.map(a=>[recordId(a,'artifacts'),a]));for(const item of candidateManifest){const artifact=byId.get(String(item.artifactId));if(!artifact||String(recordValue(artifact,'FILENAME'))!==String(item.filename)||Number(recordValue(artifact,'BYTE_SIZE'))!==Number(item.byteSize)||String(recordValue(artifact,'SHA256'))!==String(item.sha256)||String(recordValue(artifact,'STORAGE_REFERENCE'))!==String(item.storageReference))throw new Error(`Confirmed candidate artifact ${item.artifactId||'UNKNOWN'} no longer matches its frozen manifest.`);}const baselineId=allocateId(project,'baselines'),createdAt=now(),approvedVersions={inputVersion:project.job.CURRENT_INPUT_VERSION,sourceSetVersion:project.job.CURRENT_SOURCE_SET_VERSION,requirementsVersion:project.job.CURRENT_REQUIREMENTS_VERSION,testSuiteVersion:project.job.CURRENT_TEST_SUITE_VERSION,instructionVersion:project.job.CURRENT_INSTRUCTION_VERSION,iterationId:recordId(currentIteration,'iterations'),candidateId:currentCandidateId,hashes:Object.fromEntries(candidateManifest.map(item=>[String(item.artifactId),String(item.sha256)]))};const fields={BASELINE_ID:baselineId,SUPPORTING_CONFIRMATION_ID:recordId(confirmation,'confirmationRecords'),APPROVED_VERSIONS:approvedVersions,IMMUTABLE_ARTIFACT_RECORDS:[...candidateArtifactIds],HASHES:approvedVersions.hashes,HUMAN_AUTHORIZATION:authorization,AUTHORIZED_RECIPIENT_ROLES:'CURRENT AUTHORIZED ROLES',CONTROLLED_STORAGE:'INDEXEDDB VERIFIED BYTES',STATUS:'FROZEN',EVIDENCE:hash.sha256Value({approvedVersions,operatorLabel})};const record={id:baselineId,stage:20,createdAt,active:true,scope:{...currentScope(project),baselineId},fields,...fields,source:'APPLICATION_DERIVATION'};record.contentSha256=hash.contentRecordSha256(record,'BASELINE_ID');record.recordSha256=hash.recordSha256(record);record.sha256=record.recordSha256;project.projectData.baselines.push(record);project.job.CURRENT_BASELINE_ID=baselineId;addHistory(project,'BASELINE_FROZEN',{stage:20,baselineId,artifactIds:fields.IMMUTABLE_ARTIFACT_RECORDS,candidateId:currentCandidateId,operatorLabel,identityAssurance:'SELF_ASSERTED'});recalculate(project);return record;
}
function reserveProductExecution"""
text=text[:m.start()]+replacement+text[m.end():]

# Strengthen the Stage 20 gate to prove candidate-manifest == baseline artifact identity.
old="if(String(approved.iterationId||'')!==iterationId||String(approved.candidateId||'')!==candidateId||!candidateComponentIdentity(project,candidateId))reasons.push('The current baseline does not preserve the exact unchanged-confirmation iteration and frozen candidate identity.');"
new="if(String(approved.iterationId||'')!==iterationId||String(approved.candidateId||'')!==candidateId||!candidateComponentIdentity(project,candidateId))reasons.push('The current baseline does not preserve the exact unchanged-confirmation iteration and frozen candidate identity.');const candidate=records(project,'candidateFreezes').find(r=>recordId(r,'candidateFreezes')===candidateId&&isActiveRecord(r)),manifest=safe(recordValue(candidate,'COMPONENT_MANIFEST')),expectedIds=manifest.map(item=>String(item?.artifactId||'')),baselineIds=safe(recordValue(baseline,'IMMUTABLE_ARTIFACT_RECORDS')).map(String),expectedHashes=Object.fromEntries(manifest.map(item=>[String(item?.artifactId||''),String(item?.sha256||'')]));if(hash.sha256Value([...expectedIds].sort())!==hash.sha256Value([...baselineIds].sort())||hash.sha256Value(expectedHashes)!==hash.sha256Value(recordValue(baseline,'HASHES')||{}))reasons.push('The current baseline artifact set or hashes differ from the exact confirmed candidate manifest.');"
if text.count(old)!=1: raise SystemExit('Stage 20 gate identity check mismatch')
text=text.replace(old,new,1)
p.write_text(text)

# 4. UI/operator authority: input changes invalidate existing Stage 01 work; stage decisions do not rewrite global input identity.
p=Path('app-core.js'); text=p.read_text()
old="engine.recordHumanInputVersion(next,changed,'HUMAN_OPERATOR');if(next.stages[1].status==='COMPLETE'&&!next.isRetainedTestProject)engine.invalidateStageForAuthorityChange(next,{stage:1,reason:'User Job Input changed after Stage 01 completion.',operatorLabel:'HUMAN_OPERATOR'});"
new="const hadStageOneActivity=engine.hasStageActivity(current,1);engine.recordHumanInputVersion(next,changed,'HUMAN_OPERATOR');if(hadStageOneActivity&&!next.isRetainedTestProject)engine.invalidateStageForAuthorityChange(next,{stage:1,reason:'Authoritative User Job Input changed after Stage 01 work began.',operatorLabel:'HUMAN_OPERATOR'});"
if text.count(old)!=1: raise SystemExit('saveJob invalidation mismatch')
text=text.replace(old,new,1)
old="async function saveHumanStageFields(){const next=clone(current),stage=next.activeStage,changed=[];"
new="async function saveHumanStageFields(){const next=clone(current),stage=next.activeStage,hadActivity=engine.hasStageActivity(current,stage),changed=[];"
if text.count(old)!=1: raise SystemExit('saveHumanStageFields header mismatch')
text=text.replace(old,new,1)
old="if(changed.length){engine.recordHumanInputVersion(next,changed.map(x=>`STAGE_${stage}:${x}`),'HUMAN_OPERATOR');if(current.stages[stage].status==='COMPLETE')engine.invalidateStageForAuthorityChange(next,{stage,reason:'Human-owned stage input changed after completion.',operatorLabel:$('#operator-label')?.value.trim()||'HUMAN_OPERATOR'});await persistReplacement(next);}"
new="if(changed.length){if(hadActivity)engine.invalidateStageForAuthorityChange(next,{stage,reason:'Stage-specific human authority changed after stage work began.',operatorLabel:$('#operator-label')?.value.trim()||'HUMAN_OPERATOR'});await persistReplacement(next);}"
if text.count(old)!=1: raise SystemExit('saveHumanStageFields body mismatch')
text=text.replace(old,new,1)
old="async function registerStageFiles(fileList){const stage=current.activeStage,created=[];try{"
new="async function registerStageFiles(fileList){const stage=current.activeStage,hadStageOneActivity=stage===1&&engine.hasStageActivity(current,1),created=[];try{"
if text.count(old)!=1: raise SystemExit('registerStageFiles header mismatch')
text=text.replace(old,new,1)
old="for(const item of created){const stored=item.stored;engine.registerArtifactBytes(next,{stage,artifactId:stored.artifactId,filename:stored.filename,mediaType:stored.mediaType,byteSize:stored.byteSize,sha256:stored.sha256,lineage:stored.lineage});next.stages[stage].authorizedFiles.push(item.view);}await persistReplacement(next);"
new="for(const item of created){const stored=item.stored;engine.registerArtifactBytes(next,{stage,artifactId:stored.artifactId,filename:stored.filename,mediaType:stored.mediaType,byteSize:stored.byteSize,sha256:stored.sha256,lineage:stored.lineage});next.stages[stage].authorizedFiles.push(item.view);}if(stage===1){engine.recordHumanInputVersion(next,created.map(item=>`SUPPLIED_ARTIFACT:${item.stored.artifactId}`),'HUMAN_OPERATOR');if(hadStageOneActivity&&!next.isRetainedTestProject)engine.invalidateStageForAuthorityChange(next,{stage:1,reason:'Verified supplied artifact bytes changed after Stage 01 work began.',operatorLabel:'HUMAN_OPERATOR'});}await persistReplacement(next);"
if text.count(old)!=1: raise SystemExit('registerStageFiles commit mismatch')
text=text.replace(old,new,1)

# Stage 20 does not request replacement files; it authorizes/re-verifies the exact Stage 19 candidate bytes.
pattern=r"function artifactControlMarkup\(n,locked\)\{.*?\nfunction runBatchMarkup"
m=re.search(pattern,text,re.S)
if not m: raise SystemExit('artifactControlMarkup not found')
replacement="""function artifactControlMarkup(n,locked){if(n===19)return `<div class=\"panel\"><h2 class=\"section-title\">Unchanged candidate control</h2><p class=\"section-intro\">Stage 19 reuses the exact current Stage 17 frozen candidate identity and hashes. Do not select replacement files or create a new candidate.</p><div class=\"button-row\"><button id=\"begin-unchanged-confirmation\"${locked?' disabled':''}>Begin unchanged confirmation using Stage 17 candidate</button></div></div>`;if(n===20)return `<div class=\"panel\"><h2 class=\"section-title\">Baseline authorization</h2><p class=\"section-intro\">The production baseline is derived only from the exact Stage 19-confirmed candidate. The application re-reads and re-hashes those stored bytes before authorization; replacement file selection is not permitted here.</p><div class=\"button-row\"><button id=\"freeze-baseline\"${locked?' disabled':''}>Verify confirmed bytes and authorize baseline</button></div></div>`;const applicable=[10,17,21,25].includes(n),files=safe(current.stages[n].authorizedFiles);return `<div class=\"panel\"><h2 class=\"section-title\">${applicable?'Artifact control':'Authorized files for this stage'}</h2><p class=\"section-intro\">Actual selected bytes are stored in IndexedDB, hashed by the application, read back, and rehashed before becoming canonical artifact identities.</p><div class=\"grid-2\"><div class=\"field\"><label>Select exact files</label><input id=\"stage-files\" type=\"file\" multiple${locked?' disabled':''}></div><div class=\"field\"><label>Select structured package folder</label><input id=\"stage-directory\" type=\"file\" webkitdirectory directory multiple${locked?' disabled':''}><span class=\"help\">Use folder selection when directory structure is meaningful; canonical filenames preserve paths relative to the selected root.</span></div></div>${files.length?details('Verified artifact bytes',files,true):'<div class=\"empty-state\">No verified stage artifact bytes.</div>'}<div class=\"button-row\">${[10,17].includes(n)?`<button id=\"freeze-candidate\"${locked?' disabled':''}>${n===17?'Freeze corrected candidate':'Freeze selected candidate'}</button>`:''}${n===21?`<button id=\"reserve-product-execution\"${locked?' disabled':''}>Reserve product execution</button>`:''}</div></div>`;}
function runBatchMarkup"""
text=text[:m.start()]+replacement+text[m.end():]

insert="""async function verifyConfirmedCandidateBytesForBaseline(){const iteration=engine.records(current,'iterations').filter(r=>Number(r.stage)===19&&engine.isActiveRecord(r)).at(-1);if(!iteration)throw new Error('The current Stage 19 unchanged-confirmation iteration is required.');const candidateId=String(recordValue(iteration,'CANDIDATE_ID')||iteration.scope?.candidateId||''),candidate=engine.records(current,'candidateFreezes').find(r=>engine.recordId(r,'candidateFreezes')===candidateId&&engine.isActiveRecord(r));if(!candidate)throw new Error('The confirmed Stage 19 candidate cannot be resolved.');const manifest=recordValue(candidate,'COMPONENT_MANIFEST');if(!Array.isArray(manifest)||!manifest.length)throw new Error('The confirmed candidate has no exact component manifest.');for(const item of manifest){const stored=await projectStore.getArtifact(item.artifactId);if(!stored||String(stored.jobId)!==String(current.job.JOB_ID))throw new Error(`Confirmed candidate artifact ${item.artifactId} is missing from this project storage.`);const digest=await globalThis.closedLoopHash.sha256Bytes(await stored.blob.arrayBuffer());if(String(stored.filename)!==String(item.filename)||Number(stored.byteSize)!==Number(item.byteSize)||String(stored.sha256)!==String(item.sha256)||digest!==String(item.sha256))throw new Error(`Confirmed candidate artifact ${item.artifactId} failed immediate pre-baseline byte verification.`);}return manifest.map(item=>String(item.artifactId));}
"""
marker="async function auditedSelections(files){"
if text.count(marker)!=1: raise SystemExit('auditedSelections marker mismatch')
text=text.replace(marker,insert+marker,1)
old="if($('#freeze-baseline'))$('#freeze-baseline').onclick=async()=>{try{const next=clone(current);engine.freezeBaseline(next,{artifactIds:selectedArtifactIds(),operatorLabel:$('#operator-label')?.value.trim()||'HUMAN_OPERATOR'});await persistReplacement(next);"
new="if($('#freeze-baseline'))$('#freeze-baseline').onclick=async()=>{try{await verifyConfirmedCandidateBytesForBaseline();const next=clone(current);engine.freezeBaseline(next,{operatorLabel:$('#operator-label')?.value.trim()||'HUMAN_OPERATOR'});await persistReplacement(next);"
if text.count(old)!=1: raise SystemExit('freeze baseline handler mismatch')
text=text.replace(old,new,1)

# Deterministic project restoration: never fall back to the bundled retained fixture when a normal project exists.
old="current=projects.find(p=>p.job?.JOB_ID===savedSelectedProjectId)||projects[0];"
new="current=projects.find(p=>p.job?.JOB_ID===savedSelectedProjectId)||projects.find(p=>!p.isRetainedTestProject)||projects[0];"
if text.count(old)!=1: raise SystemExit('selected project fallback mismatch')
text=text.replace(old,new,1)
old="const health=await projectStore.storageHealth();"
new="await projectStore.metaPut('selectedProject',current.job.JOB_ID);const health=await projectStore.storageHealth();"
if text.count(old)!=1: raise SystemExit('load selection persistence marker mismatch')
text=text.replace(old,new,1)
old="async function addNew(){const p=ensureState(core.createBlankState(createUniqueJobId()));p.job.DATE_OPENED=new Date().toISOString();p.activeView='Project';engine.createNewJobReset(p);const next=[p,...projects];await persistAll(next);current=projects.find(x=>x.job?.JOB_ID===p.job.JOB_ID)||p;render();}"
new="async function addNew(){const p=ensureState(core.createBlankState(createUniqueJobId()));p.job.DATE_OPENED=new Date().toISOString();p.activeView='Project';engine.createNewJobReset(p);const next=[p,...projects];await persistAll(next);current=projects.find(x=>x.job?.JOB_ID===p.job.JOB_ID)||p;await projectStore.metaPut('selectedProject',current.job.JOB_ID);render();}"
if text.count(old)!=1: raise SystemExit('addNew selection mismatch')
text=text.replace(old,new,1)
old="current=projects.find(x=>x.job.JOB_ID===imported.job.JOB_ID)||projects[0];announce('project package imported and reloaded');"
new="current=projects.find(x=>x.job.JOB_ID===imported.job.JOB_ID)||projects.find(p=>!p.isRetainedTestProject)||projects[0];await projectStore.metaPut('selectedProject',current.job.JOB_ID);announce('project package imported and reloaded');"
if text.count(old)!=1: raise SystemExit('import selection mismatch')
text=text.replace(old,new,1)
old="async function save(){try{projects=await projectStore.writeAll(projects);current=projects.find(p=>p.job?.JOB_ID===current?.job?.JOB_ID)||current;announce('saved');"
new="async function save(){try{projects=await projectStore.writeAll(projects);current=projects.find(p=>p.job?.JOB_ID===current?.job?.JOB_ID)||current;await projectStore.metaPut('selectedProject',current.job.JOB_ID);announce('saved');"
if text.count(old)!=1: raise SystemExit('save selection mismatch')
text=text.replace(old,new,1)
p.write_text(text)

# 5. Stage 15 must define the regression and actual pre-correction failure, not require a future correction.
p=Path('workflow-schema.js'); text=p.read_text()
old="required:['FAILURE_FIXTURE','REPRODUCTION_PROCEDURE','DETECTION_METHOD','PRE_CORRECTION_RESULT','PRE_CORRECTION_EVIDENCE','CORRECTION','PERMANENT_TEST_LOCATION','APPLICABILITY','ACTIVE_RETIRED_STATE']"
new="required:['FAILURE_FIXTURE','REPRODUCTION_PROCEDURE','DETECTION_METHOD','PRE_CORRECTION_RESULT','PRE_CORRECTION_EVIDENCE','PERMANENT_TEST_LOCATION','APPLICABILITY','ACTIVE_RETIRED_STATE']"
if text.count(old)!=1: raise SystemExit('Stage 15 required regression fields mismatch')
text=text.replace(old,new,1)
p.write_text(text)

print('minimum semantic repair applied')

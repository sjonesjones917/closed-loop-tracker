import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {authorizeSyntheticHandoff} from './test-handoff-authorization.mjs';
import {readStoreArchive} from './test-zip.mjs';

// Independent literals from controlling §§6.5–6.6. These expectations must not
// be generated from the producer or accounting validator under examination.
const categories=Object.freeze(['QUALIFIERS','EXCEPTIONS','DEPENDENCIES','NEGATIVE_REQUIREMENTS','DO_NOT_CHANGE','VISUAL_CONSTRAINTS','TEMPORAL_CONSTRAINTS','ACCEPTANCE_CONDITIONS','AUTHORITY_STATEMENTS','TOOL_RESTRICTIONS','FILE_REFERENCES','OUTPUT_FORMAT_REQUIREMENTS','CORRECTIONS','LATER_OVERRIDES']);
const dispositions=Object.freeze(['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED']);
// Four independent canonical Job expectations from controlling §15. The input
// accounting string is compared byte-for-byte, not reconstructed by a consumer.
const agentJobFields=Object.freeze(['EXACT_DELIVERABLE_REQUESTED','ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS']);
function assertAgentJob(project,expected,point){
 for(const field of agentJobFields){
  assert.equal(Object.hasOwn(project.job,field),Object.hasOwn(expected,field),'STAGE01_SPEC_AGENT_JOB_PRESENCE_ORACLE: '+point+': '+field);
  if(Object.hasOwn(expected,field)){assert.equal(typeof project.job[field],'string','STAGE01_SPEC_AGENT_JOB_TYPE_ORACLE: '+point+': '+field);assert.equal(project.job[field],expected[field],'STAGE01_SPEC_AGENT_JOB_VALUE_ORACLE: '+point+': '+field);}
 }
}
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const snapshotSources=overrides=>Object.fromEntries(runtimeFiles.map(file=>[file,overrides[file]??fs.readFileSync(file,'utf8')]));
const boundary='Actual saved Stage1 instruction ZIP and authoritative response-file staging/capture/admission; explicit operator commit, canonical Job save/reload and current confirmation gate under transaction adapter. Synthetic actor; no browser, human semantic inspection or external conversation claimed.';

function capture(prompt){
 const manifest=prompt.contextManifest.intakeCoverageManifest;
 return {schema:'closed-loop-stage01-capture/2',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,pass1Completed:true,pass2OmissionChallenge:{completed:true,checkedCategories:[...categories],omissionsFound:[],omissionsResolved:true},units:manifest.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',extractedStatements:[{statementKey:'statement-'+index,text:unit.rawValueText||unit.label,statementClass:'CONTEXT',sourceLocation:unit.sourceLocation}]}))};
}
function envelope(r,p,prompt,accounting){
 const manifest=r.prompts.promptFileManifest(prompt);
 return {schema:'closed-loop-stage-response/3',contractProfileId:r.runtime.closedLoopWorkflowSchema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:1,operation:prompt.operation,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:manifest.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],humanAuthorityCandidates:[],stageData:{EXACT_DELIVERABLE_REQUESTED:'A complete one-page inventory.',ASSUMPTIONS:'No additional assumptions.',UNKNOWN_INFORMATION:'No unanswered human questions.',INPUT_SET_CONTENTS:JSON.stringify(accounting)},records:{},evidence:[{temporaryKey:'intake-evidence',kind:'SYNTHETIC_INTAKE',description:'Controlled accounting and gate evidence.',authorityType:'AGENT_CLAIM',location:'response.json',content:'This synthetic response tests transport/accounting and does not establish real semantic inspection.'}],unresolved:[],warnings:[],attachments:[]};
}
async function admitted(r,p,prompt,value,{allowPriorAccepted=false}={}){
 const priorAgentJob=Object.fromEntries(agentJobFields.filter(field=>Object.hasOwn(p.job,field)).map(field=>[field,p.job[field]]));
 assertAgentJob(p,priorAgentJob,'before-response');
 const text=JSON.stringify(value),identity={promptIdentity:value.promptIdentity,packageId:value.packageId,operationReservationId:value.operationReservationId,challengeNonce:value.challengeNonce};
 const staged=await r.store.stageResponseFile({jobId:p.job.JOB_ID,stage:1,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',...identity});
 const file=await r.store.readStagedResponseFile({jobId:p.job.JOB_ID,stagingId:staged.stagingId});
 assert.equal(file.sha256,digest(Buffer.from(text)),'STAGE01_SPEC_RAW_BYTES_ORACLE');
 const raw=r.ingestion.captureRaw(p,{stage:1,text,promptRecord:prompt,transport:r.copy({authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,status:file.status,sha256:file.sha256,byteSize:file.byteSize,...identity})});
 const prepared=r.ingestion.prepareCaptured(raw.project,{rawResponseId:raw.rawRecord.rawResponseId,promptRecord:prompt,expectedCommittedRevision:p.revision});
 assert.equal(prepared.project.projectData.rawResponses.find(row=>row.rawResponseId===raw.rawRecord.rawResponseId)?.completeRawResponse,text,'STAGE01_SPEC_RAW_PRESERVATION_ORACLE');
 if(!allowPriorAccepted)assert.equal(prepared.project.projectData.acceptedChanges.length,0,'STAGE01_SPEC_PREACCEPTANCE_ORACLE');
 assert.equal(prepared.project.projectData.acceptedChanges.length,p.projectData.acceptedChanges.length,'STAGE01_SPEC_PREACCEPTANCE_ORACLE');
 assertAgentJob(raw.project,priorAgentJob,'captured-before-admission');assertAgentJob(prepared.project,priorAgentJob,'pending-or-rejected');assertAgentJob(p,priorAgentJob,'unchanged-source');
 return prepared;
}

// Controlling Section 49 requires the Stage 01 agent to be the first semantic
// reader and every required file to be available to that agent. Exercise the
// saved handoff package rather than inferring file availability from metadata.
// The actor remains synthetic: these controls establish application custody
// and package bytes, not the correctness of an external semantic reading.
export async function verifyStage01FirstReaderFileHandoffControls({sourceOverrides={}}={}){
 sourceOverrides=snapshotSources(sourceOverrides);
 const expectedBytes=Buffer.from('Stage 01 must read this exact required file.\n','utf8'),expectedSha256=digest(expectedBytes),expectedFilename='stage01-required-input.txt';
 const boundary='Actual saved Stage 01 prompt plus a directly constructed canonical artifact Blob, record, current human-input version, synthetic handoff authorization, execution-package construction and ZIP member bytes under the transaction adapter. The instruction and absence of accepted Stage 01 response/data before handoff are asserted; no normal UI file-selection path, external actor semantic read, browser or human observation is claimed.';
 const expectedCaseIds=['valid-required-file','missing-stored-blob','same-job-unregistered-blob-excluded','same-job-registered-other-stage-excluded','mutated-stored-bytes'];
 async function fixture(label,{authorized=true,canonical=true,artifactStage=1,captureAsHumanInput=true}={}){
  const r=projectStoreRuntime({sourceOverrides}),blank=r.core.createBlankState('JOB-STAGE01-FILE-HANDOFF-'+label);
  Object.assign(blank.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Read the exact supplied file before extracting the complete intent.',EXPLICIT_USER_REQUIREMENTS:'Every required supplied file must reach Stage 01 unchanged.',CURRENT_INPUT_VERSION:'INPUT-v001'});r.engine.ensureShape(blank);r.engine.recalculate(blank);
  let p=await r.store.writeProject(blank,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
  const artifactId=r.engine.allocateId(p,'artifacts',r.copy({commandId:'SYNTHETIC-STAGE01-FILE-'+label,targetSlot:'stage01-input',idempotencyKey:'FILE_INTAKE',payload:{filename:expectedFilename,sha256:expectedSha256,byteSize:expectedBytes.length}})),blob=new Blob([expectedBytes],{type:'text/plain'}),lineage=r.copy({stage:artifactStage,role:artifactStage===1?'HUMAN_INPUT':'STAGE_ARTIFACT'});
  const stored=await r.store.putArtifact({artifactId,jobId:p.job.JOB_ID,blob,filename:expectedFilename,mediaType:'text/plain',lineage});
  assert.equal(stored.sha256,expectedSha256,'STAGE01_REQUIRED_FILE_STORED_SHA_ORACLE');
  if(canonical){
   r.engine.registerArtifactBytes(p,r.copy({stage:artifactStage,artifactId,filename:expectedFilename,mediaType:'text/plain',byteSize:expectedBytes.length,sha256:expectedSha256,role:'HUMAN_INPUT',lineage}));
   if(authorized)p.stages[1].authorizedFiles.push(r.copy({artifactId,name:expectedFilename,type:'text/plain',size:expectedBytes.length,sha256:expectedSha256,stage:'STAGE 01',role:r.core.STAGES[0].role,retainedBytes:true}));
   if(captureAsHumanInput){
    p.projectData.userEntered.suppliedArtifactFiles=r.copy({[artifactId]:{artifactId,filename:expectedFilename,sha256:expectedSha256,byteSize:expectedBytes.length,mediaType:'text/plain'}});
    p.projectData.userEntered.suppliedArtifactText=r.copy({[artifactId]:{artifactId,filename:expectedFilename,sha256:expectedSha256,byteSize:expectedBytes.length,mediaType:'text/plain',text:expectedBytes.toString('utf8')}});
    r.engine.recordHumanInputVersion(p,['STAGE_01_SUPPLIED_ARTIFACTS'],'SYNTHETIC_STAGE01_FILE_FIXTURE');
   }
  }
  p=await r.store.writeProject(p,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
  const draft=r.copy(p),issued=r.prompts.reserveAndBuildPromptRecord(draft,1,{operation:'COMPLETE'},{owningTabInstance:'SYNTHETIC-STAGE01-FILE-HANDOFF'}).prompt;
  p=await r.store.writeProject(draft,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
  const prompt=p.projectData.generatedPrompts.find(row=>row.instructionId===issued.instructionId);
  assert.equal(p.projectData.acceptedChanges.length,0,'STAGE01_FIRST_READER_PREHANDOFF_ACCEPTED_CHANGE_ORACLE');
  assert.equal(p.stages[1].acceptedResponseIds.length,0,'STAGE01_FIRST_READER_PREHANDOFF_RESPONSE_ORACLE');
  assert.equal(Object.keys(p.stages[1].acceptedData).length,0,'STAGE01_FIRST_READER_PREHANDOFF_SEMANTIC_DATA_ORACLE');
  return {r,p,prompt,artifactId};
 }
 const cases=[];
 {
  const f=await fixture('VALID'),artifact=f.r.engine.records(f.p,'artifacts').find(row=>f.r.engine.recordId(row,'artifacts')===f.artifactId),authorized=await authorizeSyntheticHandoff(f.r,{project:f.p,prompt:f.prompt}),pkg=await f.r.store.createExecutionPackage(authorized.request),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),manifest=JSON.parse(Buffer.from(members.find(row=>row.canonicalPath==='manifest.json').bytes).toString('utf8')),manifestArtifact=manifest.artifacts.find(row=>row.artifactId===f.artifactId),expectedPath=`artifacts/${f.artifactId}/${expectedFilename}`,member=members.find(row=>row.canonicalPath===expectedPath);
  assert.match(authorized.prompt.prompt,/first semantic reader/i,'STAGE01_FIRST_SEMANTIC_READER_INSTRUCTION_ORACLE');
  assert.ok(artifact&&f.r.engine.isActiveRecord(artifact),'STAGE01_REQUIRED_FILE_CANONICAL_RECORD_ORACLE');
  assert.equal(artifact.stage,1,'STAGE01_REQUIRED_FILE_OPERATION_STAGE_ORACLE');
  assert.equal(f.p.stages[1].authorizedFiles.some(row=>String(row.artifactId||row.id||'')===f.artifactId),true,'STAGE01_REQUIRED_FILE_EXPLICIT_SELECTION_ORACLE');
  assert.ok(authorized.prompt.contextManifest.intakeCoverageManifest.units.some(row=>row.artifactId===f.artifactId),'STAGE01_REQUIRED_FILE_INTAKE_UNIT_ORACLE');
  assert.ok(member,'STAGE01_REQUIRED_FILE_PACKAGE_MEMBER_ORACLE');
  assert.equal(member.canonicalPath,expectedPath,'STAGE01_REQUIRED_FILE_CANONICAL_PATH_ORACLE');
  assert.equal(Buffer.compare(Buffer.from(member.bytes),expectedBytes),0,'STAGE01_REQUIRED_FILE_EXACT_BYTES_ORACLE');
  assert.deepEqual({filename:manifestArtifact?.filename,byteSize:manifestArtifact?.byteSize,sha256:manifestArtifact?.sha256},{filename:expectedFilename,byteSize:expectedBytes.length,sha256:expectedSha256},'STAGE01_REQUIRED_FILE_MANIFEST_IDENTITY_ORACLE');
  cases.push({caseId:'valid-required-file',acceptedSemanticResponsesBeforeHandoff:0,firstSemanticReaderInstruction:true,canonicalRecordPresent:true,stage01OperationArtifact:true,stage01Authorized:true,intakeUnitBound:true,actualSavedPackage:true,exactMemberBytes:true,exactManifestIdentity:true,passed:true});
 }
 {
  const f=await fixture('MISSING');await f.r.store.deleteArtifact(f.artifactId,f.p.job.JOB_ID);
  await assert.rejects(f.r.store.prepareExecutionPackageReview({project:f.p,stage:1,operation:'COMPLETE',instructionId:f.prompt.instructionId}),error=>error.code==='EXECUTION_PACKAGE_BYTES_MISSING','STAGE01_REQUIRED_FILE_MISSING_BYTES_ORACLE');
  cases.push({caseId:'missing-stored-blob',expectedCode:'EXECUTION_PACKAGE_BYTES_MISSING',packageCreated:false,passed:true});
 }
 {
  const f=await fixture('UNAUTHORIZED',{authorized:false,canonical:false}),authorized=await authorizeSyntheticHandoff(f.r,{project:f.p,prompt:f.prompt}),pkg=await f.r.store.createExecutionPackage(authorized.request),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),manifest=JSON.parse(Buffer.from(members.find(row=>row.canonicalPath==='manifest.json').bytes).toString('utf8'));
  assert.equal(authorized.prompt.contextManifest.intakeCoverageManifest.units.some(row=>row.artifactId===f.artifactId),false,'STAGE01_UNAUTHORIZED_FILE_INTAKE_UNIT_ORACLE');
  assert.equal(manifest.artifacts.some(row=>row.artifactId===f.artifactId)||members.some(row=>row.canonicalPath.startsWith(`artifacts/${f.artifactId}/`)),false,'STAGE01_UNAUTHORIZED_FILE_PACKAGE_ORACLE');
  cases.push({caseId:'same-job-unregistered-blob-excluded',sameJobStoredBlob:true,canonicalRecordPresent:false,stage01Authorized:false,intakeUnitBound:false,packageMemberPresent:false,passed:true});
 }
 {
  const f=await fixture('REGISTERED-OTHER-STAGE',{authorized:false,canonical:true,artifactStage:2,captureAsHumanInput:false}),artifact=f.r.engine.records(f.p,'artifacts').find(row=>f.r.engine.recordId(row,'artifacts')===f.artifactId),authorized=await authorizeSyntheticHandoff(f.r,{project:f.p,prompt:f.prompt}),pkg=await f.r.store.createExecutionPackage(authorized.request),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),manifest=JSON.parse(Buffer.from(members.find(row=>row.canonicalPath==='manifest.json').bytes).toString('utf8'));
  assert.deepEqual({...f.r.runtime.closedLoopWorkflowSchema.STAGE_OPERATION_SCOPE_MATRIX['1:COMPLETE'].dimensions},{inputVersion:'INPUT_CURRENT'},'STAGE01_REGISTERED_WRONG_SCOPE_OPERATION_CONTRACT_ORACLE');
  assert.ok(artifact&&f.r.engine.isActiveRecord(artifact),'STAGE01_REGISTERED_WRONG_SCOPE_CANONICAL_RECORD_ORACLE');
  assert.equal(artifact.stage,2,'STAGE01_REGISTERED_WRONG_SCOPE_STAGE_ORACLE');
  assert.equal(artifact.scope?.inputVersion,authorized.prompt.scope?.inputVersion,'STAGE01_REGISTERED_WRONG_SCOPE_CURRENT_INPUT_ORACLE');
  assert.equal(f.p.stages[1].authorizedFiles.some(row=>String(row.artifactId||row.id||'')===f.artifactId),false,'STAGE01_REGISTERED_WRONG_SCOPE_SELECTION_ORACLE');
  assert.equal(authorized.prompt.contextManifest.intakeCoverageManifest.units.some(row=>row.artifactId===f.artifactId),false,'STAGE01_REGISTERED_WRONG_SCOPE_INTAKE_UNIT_ORACLE');
  assert.equal(manifest.artifacts.some(row=>row.artifactId===f.artifactId)||members.some(row=>row.canonicalPath.startsWith(`artifacts/${f.artifactId}/`)),false,'STAGE01_REGISTERED_WRONG_SCOPE_PACKAGE_ORACLE');
  cases.push({caseId:'same-job-registered-other-stage-excluded',sameJobStoredBlob:true,canonicalRecordPresent:true,currentInputVersionScope:true,otherOperationStage:true,stage01Authorized:false,intakeUnitBound:false,packageMemberPresent:false,passed:true});
 }
 {
  const f=await fixture('MUTATED'),changedBytes=Buffer.from('Stage 01 received different bytes under the same identity.\n','utf8');await f.r.store.deleteArtifact(f.artifactId,f.p.job.JOB_ID);await f.r.store.putArtifact({artifactId:f.artifactId,jobId:f.p.job.JOB_ID,blob:new Blob([changedBytes],{type:'text/plain'}),filename:expectedFilename,mediaType:'text/plain',lineage:{stage:1,role:'HUMAN_INPUT'}});
  await assert.rejects(f.r.store.prepareExecutionPackageReview({project:f.p,stage:1,operation:'COMPLETE',instructionId:f.prompt.instructionId}),error=>error.code==='EXECUTION_PACKAGE_ARTIFACT_MISMATCH','STAGE01_REQUIRED_FILE_MUTATED_BYTES_ORACLE');
  cases.push({caseId:'mutated-stored-bytes',expectedCode:'EXECUTION_PACKAGE_ARTIFACT_MISMATCH',packageCreated:false,passed:true});
 }
 assert.deepEqual(cases.map(row=>row.caseId),expectedCaseIds,'STAGE01_FIRST_READER_FILE_CASE_POPULATION_ORACLE');
 return {result:'PASS',synthetic:true,actualBrowser:false,realExternalActor:false,wholeClausePASS:false,boundary,expectedCaseIds,cases,verificationObservations:[{checkId:'stage01.first-reader-required-file-package',boundary,expected:{caseIds:expectedCaseIds},observed:{caseIds:cases.map(row=>row.caseId),passed:cases.every(row=>row.passed)},passed:true}]};
}
function instructionOracle(text,operation){
 const contractStart='RESPONSE CONTRACT DEFINITIONS\n',contractEnd='\n\nEND HASHED INSTRUCTION BODY',start=text.indexOf(contractStart),end=text.indexOf(contractEnd,start);
 assert.ok(start>=0&&end>start,'STAGE01_SPEC_AGENT_JOB_PUBLISHED_CONTRACT_ORACLE');const contract=JSON.parse(text.slice(start+contractStart.length,end));
 for(const field of agentJobFields){const definition=contract.stageData?.[field];assert.ok(definition,'STAGE01_SPEC_AGENT_JOB_PUBLISHED_FIELD_ORACLE: '+field);assert.deepEqual({producer:definition.producer,valueType:definition.valueType,nullable:definition.nullable,requiredAtStage:definition.requiredAtStage,responsePath:definition.responsePath},{producer:'AGENT',valueType:'STRING',nullable:false,requiredAtStage:1,responsePath:'/stageData/'+field},'STAGE01_SPEC_AGENT_JOB_PUBLISHED_RULE_ORACLE: '+field);}
 const line=text.split('\n').find(row=>row.startsWith('{"schema":"closed-loop-stage01-capture/2"'));
 assert.ok(line,'STAGE01_SPEC_ACCOUNTING_SHAPE_ORACLE');
 const declared=JSON.parse(line);
 assert.deepEqual(declared.pass2OmissionChallenge.checkedCategories,[...categories],'STAGE01_SPEC_CATEGORIES_ORACLE');
 assert.deepEqual(declared.units[0].disposition.split('|'),[...dispositions],'STAGE01_SPEC_DISPOSITIONS_ORACLE');
 assert.equal(declared.pass1Completed,true,'STAGE01_SPEC_PASS_ONE_ORACLE');
 assert.equal(declared.pass2OmissionChallenge.completed,true,'STAGE01_SPEC_PASS_TWO_ORACLE');
 assert.equal(declared.pass2OmissionChallenge.omissionsResolved,true,'STAGE01_SPEC_RESOLUTION_ORACLE');
 const procedure=text.slice(text.indexOf('STAGE PROCEDURE'),text.indexOf('GOVERNING STAGE INVARIANTS'));
 if(operation==='COMPLETE')for(const required of ['PASS 1 — EXHAUSTIVE EXTRACTION','read the complete current user request and every accessible supplied artifact from beginning to end','extract every distinct project-relevant human-origin fact, requirement, constraint, prohibition, decision, requested output','PASS 2 — OMISSION CHALLENGE','compare the Pass 1 ledger back against every application intake unit','Resolve every omission before final JSON'])assert.ok(procedure.includes(required),'STAGE01_SPEC_PROCEDURE_ORACLE: '+required);
 else for(const required of ['every accepted independent semantic challenge','preserve every valid extracted item','final omission-challenge pass','complete replacement Stage 01 stageData'])assert.ok(procedure.includes(required),'STAGE01_SPEC_RECONCILIATION_ORACLE: '+required);
 assert.ok(/Do not perform (?:later-stage research|external research)/.test(procedure),'STAGE01_SPEC_STAGE_BOUNDARY_ORACLE');
 assert.match(text,/normal conversational agent|ordinary conversation/,'STAGE01_SPEC_CONVERSATION_ORACLE: normal human conversation');
 for(const required of ['humanAuthorityCandidates','do not write it directly into HUMAN or HUMAN_DECISION','The human must never be asked to create, repair, or reformat agent JSON'])assert.ok(text.includes(required),'STAGE01_SPEC_CONVERSATION_ORACLE: '+required);
 return declared;
}
export async function verifyStage01SpecificationControls({sourceOverrides={}}={}){
 sourceOverrides=snapshotSources(sourceOverrides);const sourceSha256=Object.fromEntries(runtimeFiles.map(file=>[file,digest(sourceOverrides[file])]));
 const firstReaderFileHandoffControls=await verifyStage01FirstReaderFileHandoffControls({sourceOverrides});
 const observations=[],packages=[],faults=[],agentJobControls=[],agentJobLifecycleControls=[];
 for(const operation of ['COMPLETE','RECONCILE_INTAKE']){
  const r=projectStoreRuntime({sourceOverrides}),blank=r.core.createBlankState('JOB-SPEC-STAGE01-'+operation);
  assertAgentJob(blank,{},'blank-project');
  Object.assign(blank.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Produce a complete one-page inventory.',EXPLICIT_USER_REQUIREMENTS:'Preserve all supplied human input.',CURRENT_INPUT_VERSION:'INPUT-v001'});r.engine.ensureShape(blank);r.engine.recalculate(blank);
  let p=await r.store.writeProject(blank,{expectedProjectRevision:0,incrementRevision:false,createOnly:true}),draft=r.copy(p);
  const issued=r.prompts.reserveAndBuildPromptRecord(draft,1,{operation},{owningTabInstance:'SYNTHETIC-SPEC-CONTROL'}).prompt;
  p=await r.store.writeProject(draft,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
  let prompt=p.projectData.generatedPrompts.find(row=>row.instructionId===issued.instructionId);
  const authorized=await authorizeSyntheticHandoff(r,{project:p,prompt});p=authorized.project;prompt=authorized.prompt;
  assertAgentJob(p,{},'saved-before-response');
  if(operation==='COMPLETE'){
   const destination=projectStoreRuntime({sourceOverrides}),imported=await destination.store.importPackage(await r.store.exportPackage(p.job.JOB_ID)),restored=await destination.store.readProject(imported.job.JOB_ID);
   assertAgentJob(restored,{},'preacceptance-export-import-reload');
   agentJobLifecycleControls.push({caseId:'preacceptance-export-absence',normalCreation:true,saved:true,exported:true,imported:true,reloaded:true,allFourAbsent:true});
  }
  const pkg=await r.store.createExecutionPackage(authorized.request);
  const members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),instruction=members.find(row=>row.canonicalPath==='instruction.txt'),manifest=JSON.parse(Buffer.from(members.find(row=>row.canonicalPath==='manifest.json').bytes).toString('utf8')),text=Buffer.from(instruction.bytes).toString('utf8');
  assert.equal(text,prompt.prompt,'STAGE01_SPEC_SAVED_INSTRUCTION_ORACLE');assert.equal(digest(instruction.bytes),manifest.promptIdentity.bodySha256,'STAGE01_SPEC_MANIFEST_BYTES_ORACLE');instructionOracle(text,operation);
  packages.push({operation,actualSavedZip:true,exactInstructionBytes:true,agentJobContractPublished:true,categoryCount:categories.length,dispositionCount:dispositions.length,producerVersion:prompt.promptEngineVersion});
  // Faults operate on the exact inspected exported carrier, not production
  // source. They prove the assertion detects missing mandatory guidance.
  for(const [name,changed,oracle]of [['missing-category',text.replace('"LATER_OVERRIDES"','"REMOVED_CATEGORY"'),'STAGE01_SPEC_CATEGORIES_ORACLE'],['unresolved-omissions',text.replace('"omissionsResolved":true','"omissionsResolved":false'),'STAGE01_SPEC_RESOLUTION_ORACLE']]){
   assert.throws(()=>instructionOracle(changed,operation),new RegExp(oracle));faults.push({operation,name,intendedFailure:oracle});
  }
  if(operation!=='COMPLETE')continue;
  const original=r.runtime.closedLoopHash.sha256Value(p),base=capture(prompt),cases=[
   ['pass1-incomplete',value=>{value.pass1Completed=false;},'Pass 1'],
   ['pass2-incomplete',value=>{value.pass2OmissionChallenge.completed=false;},'Pass 2'],
   ['omissions-unresolved',value=>{value.pass2OmissionChallenge.omissionsResolved=false;},'unresolved omissions'],
   ['duplicate-category',value=>{value.pass2OmissionChallenge.checkedCategories.push(categories[0]);},'duplicate checked categories'],
   ['unknown-category',value=>{value.pass2OmissionChallenge.checkedCategories.push('UNDECLARED_CATEGORY');},'unknown category'],
   ['omitted-unit',value=>{value.units.pop();},'omitted controlled input unit'],
   ['duplicate-unit',value=>{value.units.push(structuredClone(value.units[0]));},'exactly one accounting entry'],
   ['unknown-unit',value=>{value.units[0].sourceUnitId='INPUT-UNIT-NOT-ISSUED';},'unknown unit'],
   ['wrong-unit-hash',value=>{value.units[0].sourceRawValueSha256='0'.repeat(64);},'exact source raw-value hash'],
   ['wrong-input-version',value=>{value.inputVersion='STALE';},'current input version'],
   ['wrong-manifest',value=>{value.manifestSha256='0'.repeat(64);},'current application intake manifest'],
   ['unknown-disposition',value=>{value.units[0].disposition='SATISFIED';},'invalid disposition'],
   ['inaccessible-required-content',value=>{value.units[0].disposition='INACCESSIBLE_OR_BLOCKED';value.units[0].reason='Required content unavailable.';},'inaccessible or blocked']
  ];
  for(const category of categories)cases.push(['omitted-category-'+category,value=>{value.pass2OmissionChallenge.checkedCategories=value.pass2OmissionChallenge.checkedCategories.filter(entry=>entry!==category);},'required category '+category]);
  for(const [caseId,mutate,reason]of cases){
   const value=structuredClone(base);mutate(value);const prepared=await admitted(r,p,prompt,envelope(r,p,prompt,value));
   assert.equal(prepared.validation.valid,false,'STAGE01_SPEC_ADMISSION_ORACLE: '+caseId);
   assert.ok(prepared.validation.issues.some(issue=>issue.code==='INCOMPLETE_INTAKE_ACCOUNTING'&&issue.message.includes(reason)),'STAGE01_SPEC_INTENDED_FAILURE_ORACLE: '+caseId+': '+JSON.stringify(prepared.validation.issues));
   assert.equal(r.engine.gate(1,prepared.project).complete,false,'STAGE01_SPEC_REJECTED_GATE_ORACLE: '+caseId);
   observations.push({caseId,expectedCode:'INCOMPLETE_INTAKE_ACCOUNTING',actualCodes:prepared.validation.issues.map(row=>row.code),requiredReason:reason,accepted:false,canonicalChanges:0,rawPreserved:true,stageComplete:false});
  }
  assert.equal(r.runtime.closedLoopHash.sha256Value(p),original,'STAGE01_SPEC_INPUT_ISOLATION_ORACLE');
  for(const field of agentJobFields){
   const response=envelope(r,p,prompt,base);response.stageData[field]=null;const prepared=await admitted(r,p,prompt,response);
   assert.equal(prepared.validation.valid,false,'STAGE01_SPEC_AGENT_JOB_NULL_ADMISSION_ORACLE: '+field);assert.ok(prepared.validation.issues.some(issue=>issue.code==='PROHIBITED_NULL'&&issue.path==='/stageData/'+field),'STAGE01_SPEC_AGENT_JOB_NULL_REASON_ORACLE: '+field);assert.equal(r.engine.gate(1,prepared.project).complete,false,'STAGE01_SPEC_AGENT_JOB_NULL_GATE_ORACLE: '+field);
   agentJobControls.push({caseId:'null-'+field,field,expectedCode:'PROHIBITED_NULL',actualCodes:prepared.validation.issues.map(issue=>issue.code),exactIssuePath:'/stageData/'+field,exactIssueFound:true,admitted:false,canonicalJobAbsent:true,rawPreserved:true,stageComplete:false});
  }
  // Distinct literal agent values catch a swapped/misrouted canonical projection.
  const expectedAgentJob={EXACT_DELIVERABLE_REQUESTED:'A complete one-page inventory.',ASSUMPTIONS:'No additional assumptions.',UNKNOWN_INFORMATION:'No unanswered human questions.',INPUT_SET_CONTENTS:JSON.stringify(base)};
  const control=await admitted(r,p,prompt,envelope(r,p,prompt,base));assert.equal(control.validation.valid,true,'STAGE01_SPEC_CONFORMING_ADMISSION_ORACLE: '+JSON.stringify(control.validation.issues));
  const pendingGate=r.engine.gate(1,control.project);assert.equal(pendingGate.complete,false,'STAGE01_SPEC_PENDING_GATE_ORACLE');assert.ok(pendingGate.reasons.some(reason=>reason.includes('No validated agent response has been accepted')),'STAGE01_SPEC_PENDING_REASON_ORACLE');
  const committed=r.ingestion.commit(control.project,control.proposal.proposalId,{operator:'SYNTHETIC_SPEC_OPERATOR'}),accepted=committed.project;
  assertAgentJob(accepted,expectedAgentJob,'operator-accepted');assertAgentJob(control.project,{},'unchanged-pending-source');
  assert.equal(JSON.parse(accepted.projectData.rawResponses.find(row=>row.rawResponseId===committed.acceptedChange.rawResponseId).completeRawResponse).stageData.INPUT_SET_CONTENTS,expectedAgentJob.INPUT_SET_CONTENTS,'STAGE01_SPEC_AGENT_JOB_ACCOUNTING_RAW_ORACLE');
  let gate=r.engine.gate(1,accepted);assert.equal(gate.complete,false,'STAGE01_SPEC_CONFIRMATION_REQUIRED_ORACLE');assert.ok(gate.reasons.some(reason=>reason.includes('Human confirmation bound')));
  r.engine.recordStageConfirmation(accepted,1,true,'The synthetic represented intent matches.','SYNTHETIC_SPEC_OPERATOR',{acceptedChangeId:committed.acceptedChange.changeId,inputVersion:accepted.job.CURRENT_INPUT_VERSION,instructionId:prompt.instructionId,contextSignature:prompt.contextSignature});
  assert.equal(r.engine.gate(1,accepted).complete,true,'STAGE01_SPEC_CONFIRMATION_CONTROL_ORACLE');
  for(const [caseId,mutate,reason]of [
   ['missing-confirmation',value=>{value.projectData.stageConfirmations=[];},'Human confirmation bound'],
   ['wrong-confirmation-input',value=>{value.projectData.stageConfirmations.at(-1).inputVersion='STALE';},'Human confirmation bound'],
   ['wrong-confirmation-change',value=>{value.projectData.stageConfirmations.at(-1).acceptedChangeId='NOT_CURRENT';},'Human confirmation bound'],
   ['blank-objective',value=>{value.job.EXACT_USER_OBJECTIVE_VERBATIM='';},'Verbatim User Job Input'],
   ['missing-objective',value=>{delete value.job.EXACT_USER_OBJECTIVE_VERBATIM;},'Verbatim User Job Input']
  ]){
   const value=r.copy(accepted);mutate(value);gate=r.engine.gate(1,value);assert.equal(gate.complete,false,'STAGE01_SPEC_GATE_NEGATIVE_ORACLE: '+caseId);assert.ok(gate.reasons.some(item=>item.includes(reason)),'STAGE01_SPEC_GATE_REASON_ORACLE: '+caseId);
   observations.push({caseId,expectedComplete:false,actualComplete:gate.complete,requiredReason:reason,gateReasonFound:true,syntheticCorruptionProjection:true});
  }
  for(const field of agentJobFields){
   const response=envelope(r,p,prompt,base);delete response.stageData[field];const prepared=await admitted(r,p,prompt,response);
   if(field==='INPUT_SET_CONTENTS'){
    assert.equal(prepared.validation.valid,false,'STAGE01_SPEC_AGENT_JOB_MISSING_INTAKE_ORACLE');assert.ok(prepared.validation.issues.some(issue=>issue.code==='INCOMPLETE_INTAKE_ACCOUNTING'&&issue.path==='/stageData/INPUT_SET_CONTENTS'),'STAGE01_SPEC_AGENT_JOB_MISSING_INTAKE_REASON_ORACLE');assert.equal(r.engine.gate(1,prepared.project).complete,false,'STAGE01_SPEC_AGENT_JOB_MISSING_INTAKE_GATE_ORACLE');
    agentJobControls.push({caseId:'missing-'+field,field,admitted:false,expectedCode:'INCOMPLETE_INTAKE_ACCOUNTING',actualCodes:prepared.validation.issues.map(issue=>issue.code),exactIssuePath:'/stageData/'+field,exactIssueFound:true,canonicalJobAbsent:true,rawPreserved:true,stageComplete:false});continue;
   }
   assert.equal(prepared.validation.valid,true,'STAGE01_SPEC_AGENT_JOB_PARTIAL_ADMISSION_ORACLE: '+field+': '+JSON.stringify(prepared.validation.issues));
   const partialCommit=r.ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC_SPEC_OPERATOR'}),partial=partialCommit.project;
   assert.notEqual(r.engine.operationalNextAction(partial).actionType,'CONFIRM_STAGE_ONE_INTENT','STAGE01_SPEC_AGENT_JOB_NO_PREMATURE_CONFIRM_ORACLE: '+field);
   // Section15 gives the Stage1 gate authority over this closed status. Both
   // blocked and unblocked incomplete work must remain distinct from COMPLETE.
   const statusGate=r.engine.gate(1,partial),expectedStatus=statusGate.blocked?'BLOCKED':'INCOMPLETE';assert.equal(statusGate.complete,false,'STAGE01_SPEC_AGENT_JOB_PARTIAL_STATUS_GATE_ORACLE: '+field);
   assert.equal(partial.job.JOB_RECORD_STATUS,expectedStatus,'STAGE01_SPEC_AGENT_JOB_PARTIAL_STATUS_ORACLE: '+field);assert.equal(partial.stages[1].derivedData.JOB_RECORD_STATUS,expectedStatus,'STAGE01_SPEC_AGENT_JOB_PARTIAL_DERIVED_STATUS_ORACLE: '+field);
   r.engine.recordStageConfirmation(partial,1,true,'The synthetic partial intent matches.','SYNTHETIC_SPEC_OPERATOR',{acceptedChangeId:partialCommit.acceptedChange.changeId,inputVersion:partial.job.CURRENT_INPUT_VERSION,instructionId:prompt.instructionId,contextSignature:prompt.contextSignature});
   assert.equal(Object.hasOwn(partial.job,field),false,'STAGE01_SPEC_AGENT_JOB_PARTIAL_ABSENCE_ORACLE: '+field);
   const partialGate=r.engine.gate(1,partial);assert.equal(partialGate.complete,false,'STAGE01_SPEC_AGENT_JOB_REQUIRED_GATE_ORACLE: '+field+': '+JSON.stringify(partialGate));
   const requiredReason=field==='EXACT_DELIVERABLE_REQUESTED'?'intended deliverable':field;assert.ok(partialGate.reasons.some(reason=>reason.includes(requiredReason)),'STAGE01_SPEC_AGENT_JOB_REQUIRED_REASON_ORACLE: '+field+': '+JSON.stringify(partialGate.reasons));
   agentJobControls.push({caseId:'missing-'+field,field,admitted:true,operatorAccepted:true,currentConfirmation:true,missingCanonicalValue:true,stageComplete:false,requiredReason,gateReasonFound:true,noPrematureConfirmation:true,jobStatusNotComplete:true,derivedStatusMatchesGate:true,observedJobStatus:partial.job.JOB_RECORD_STATUS,reasons:[...partialGate.reasons]});
  }
  const stored=await r.store.writeProject(accepted,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256}),reloaded=await r.store.readProject(p.job.JOB_ID);
  assertAgentJob(stored,expectedAgentJob,'saved');assertAgentJob(reloaded,expectedAgentJob,'reloaded');
  assert.equal(reloaded.projectData.rawResponses.find(row=>row.rawResponseId===committed.acceptedChange.rawResponseId).completeRawResponse,accepted.projectData.rawResponses.find(row=>row.rawResponseId===committed.acceptedChange.rawResponseId).completeRawResponse,'STAGE01_SPEC_AGENT_JOB_RELOADED_RAW_ORACLE');
  assert.equal(r.engine.gate(1,reloaded).complete,true,'STAGE01_SPEC_AGENT_JOB_RELOADED_GATE_ORACLE');
  for(const field of agentJobFields)agentJobControls.push({caseId:'accepted-reloaded-'+field,field,absentBeforeAcceptance:true,absentWhilePending:true,pendingSourceUnchanged:true,operatorAccepted:true,exactAcceptedValue:true,valueType:'string',saved:true,reloaded:true,exactReloadedValue:true,rawPreserved:true,stageComplete:true});
  observations.push({caseId:'conforming-current-intent',authoritativeFile:true,operatorAccepted:true,currentConfirmation:true,stageComplete:true});
 }
 agentJobLifecycleControls.push(...await verifyStage01AgentJobLifecycle({sourceOverrides}));
 const expected={authorOperations:2,omissionCategories:14,dispositions:6,admissionNegatives:27,gateNegatives:5,conformingComplete:1,carrierFaults:4},observed={authorOperations:packages.length,omissionCategories:categories.length,dispositions:dispositions.length,admissionNegatives:observations.filter(row=>row.expectedCode).length,gateNegatives:observations.filter(row=>row.expectedComplete===false).length,conformingComplete:observations.filter(row=>row.caseId==='conforming-current-intent'&&row.stageComplete).length,carrierFaults:faults.length};
 assert.deepEqual(observed,expected,'STAGE01_SPEC_CASE_POPULATION_ORACLE');
 const agentJobExpected={fields:4,nullRejected:4,missingRequired:4,acceptedReloaded:4},agentJobObserved={fields:agentJobFields.length,nullRejected:agentJobControls.filter(row=>row.caseId.startsWith('null-')&&row.admitted===false&&row.stageComplete===false).length,missingRequired:agentJobControls.filter(row=>row.caseId.startsWith('missing-')&&row.stageComplete===false).length,acceptedReloaded:agentJobControls.filter(row=>row.caseId.startsWith('accepted-reloaded-')&&row.exactAcceptedValue&&row.exactReloadedValue&&row.stageComplete).length};
 assert.deepEqual(agentJobObserved,agentJobExpected,'STAGE01_SPEC_AGENT_JOB_CASE_POPULATION_ORACLE');
 const lifecycleExpected=['preacceptance-export-absence','literal-unknown-string',...agentJobFields.map(field=>'projection-mismatch-'+field),'accepted-empty-open-string','same-input-partial-accumulation','changed-input-missing-ASSUMPTIONS','changed-input-missing-UNKNOWN_INFORMATION','accepted-intake-refinement'];assert.deepEqual(agentJobLifecycleControls.map(row=>row.caseId),lifecycleExpected,'STAGE01_SPEC_AGENT_JOB_LIFECYCLE_POPULATION_ORACLE');
 return {stage01SpecificationControls:'PASS',sourceSha256,boundary,synthetic:true,actualBrowser:false,realExternalActor:false,packages,observations,faults,agentJobControls,agentJobLifecycleControls,firstReaderFileHandoffControls,verificationObservations:[{checkId:'STAGE01-SPECIFICATION-CONTRACT-CONTROLS',boundary,expected,observed,passed:true},{checkId:'STAGE01-AGENT-JOB-PROJECTION-CONTROLS',boundary,expected:agentJobExpected,observed:agentJobObserved,passed:true},{checkId:'STAGE01-AGENT-JOB-LIFECYCLE-CONTROLS',boundary,expected:lifecycleExpected,observed:agentJobLifecycleControls.map(row=>row.caseId),passed:true}]};
}

// A named focused boundary also permits guarded old-owner fault controls without
// rerunning the unrelated accounting population or weakening its assertions.
export async function verifyStage01AgentJobLifecycle({sourceOverrides={},scenario=null}={}){
 sourceOverrides=snapshotSources(sourceOverrides);
 if(scenario!==null)assert.ok(['literal','accepted-empty','accumulation','changed-input','refinement'].includes(scenario),'STAGE01_SPEC_AGENT_JOB_LIFECYCLE_SCENARIO_ORACLE');
 const agentJobLifecycleControls=[];
 // These short sequences use independent disposable projects. Identity and
 // acceptance come from the normal saved file handoff; only the actor is synthetic.
 async function issued(r,p){
  const draft=r.copy(p),created=r.prompts.reserveAndBuildPromptRecord(draft,1,{operation:'COMPLETE'},{owningTabInstance:'SYNTHETIC-AGENT-JOB-SEQUENCE'}).prompt;
  p=await r.store.writeProject(draft,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
  const authorized=await authorizeSyntheticHandoff(r,{project:p,prompt:p.projectData.generatedPrompts.find(row=>row.instructionId===created.instructionId)});
  const pkg=await r.store.createExecutionPackage(authorized.request),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer()));
  instructionOracle(Buffer.from(members.find(row=>row.canonicalPath==='instruction.txt').bytes).toString('utf8'),'COMPLETE');
  return {p:authorized.project,prompt:authorized.prompt};
 }
 async function sequence(label){
  const r=projectStoreRuntime({sourceOverrides}),blank=r.core.createBlankState('JOB-SPEC-AGENT-'+label);assertAgentJob(blank,{},'sequence-blank');
  Object.assign(blank.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Produce a complete one-page inventory.',EXPLICIT_USER_REQUIREMENTS:'Preserve all supplied human input.',CURRENT_INPUT_VERSION:'INPUT-v001'});r.engine.ensureShape(blank);r.engine.recalculate(blank);
  r.engine.recordHumanInputVersion(blank,['EXACT_USER_OBJECTIVE_VERBATIM','EXPLICIT_USER_REQUIREMENTS'],'SYNTHETIC_SPEC_OPERATOR');
  const p=await r.store.writeProject(blank,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});return {r,...await issued(r,p)};
 }
 async function acceptSequence(r,p,prompt,response,{confirm=true}={}){
  const before=Object.fromEntries(agentJobFields.filter(field=>Object.hasOwn(p.job,field)).map(field=>[field,p.job[field]])),prepared=await admitted(r,p,prompt,response,{allowPriorAccepted:true});
  assert.equal(prepared.validation.valid,true,'STAGE01_SPEC_AGENT_JOB_SEQUENCE_ADMISSION_ORACLE: '+JSON.stringify(prepared.validation.issues));
  const pending=await r.store.writeProject(prepared.project,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256}),pendingReload=await r.store.readProject(p.job.JOB_ID);assertAgentJob(pendingReload,before,'sequence-pending-reload');
  const committed=r.ingestion.commit(pendingReload,prepared.proposal.proposalId,{operator:'SYNTHETIC_SPEC_OPERATOR',replacementConfirmation:r.ingestion.acceptanceImpact(pendingReload,prepared.proposal.proposalId)}),accepted=committed.project;
  if(confirm)r.engine.recordStageConfirmation(accepted,1,true,'The synthetic represented intent matches.','SYNTHETIC_SPEC_OPERATOR',{acceptedChangeId:committed.acceptedChange.changeId,inputVersion:accepted.job.CURRENT_INPUT_VERSION,instructionId:prompt.instructionId,contextSignature:prompt.contextSignature});
  const mutationConfirmation=r.store.mutationImpact(pendingReload,accepted);
  await r.store.writeProject(accepted,{expectedProjectRevision:pending.revision,expectedStateSha256:pending.projectSha256,mutationConfirmation});return {p:await r.store.readProject(p.job.JOB_ID),acceptedChange:committed.acceptedChange};
 }
 if(!scenario||scenario==='literal'){
  const f=await sequence('LITERAL'),response=envelope(f.r,f.p,f.prompt,capture(f.prompt));response.stageData.ASSUMPTIONS='UNKNOWN';response.stageData.UNKNOWN_INFORMATION='NONE';
  const accepted=await acceptSequence(f.r,f.p,f.prompt,response);assertAgentJob(accepted.p,{EXACT_DELIVERABLE_REQUESTED:'A complete one-page inventory.',ASSUMPTIONS:'UNKNOWN',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:response.stageData.INPUT_SET_CONTENTS},'literal-control');
  assert.equal(f.r.engine.gate(1,accepted.p).complete,true,'STAGE01_SPEC_AGENT_JOB_LITERAL_STRING_ORACLE');
  agentJobLifecycleControls.push({caseId:'literal-unknown-string',assumptions:'UNKNOWN',unknownInformation:'NONE',operatorAccepted:true,pendingReload:true,acceptedReload:true,stageComplete:true});
  for(const field of agentJobFields){
   const projected=f.r.copy(accepted.p);projected.job[field]='SYNTHETIC MISMATCH WITH ACCEPTED PROPOSAL';const gate=f.r.engine.gate(1,projected);
   assert.equal(gate.complete,false,'STAGE01_SPEC_AGENT_JOB_PROJECTION_MISMATCH_ORACLE: '+field);assert.ok(gate.reasons.some(reason=>reason.includes(field)),'STAGE01_SPEC_AGENT_JOB_PROJECTION_REASON_ORACLE: '+field);
   agentJobLifecycleControls.push({caseId:'projection-mismatch-'+field,field,syntheticGateOnlyCounterexample:true,stageComplete:false,fieldReasonFound:true});
  }
 }
 if(!scenario||scenario==='accepted-empty'){
  const f=await sequence('ACCEPTED-EMPTY'),response=envelope(f.r,f.p,f.prompt,capture(f.prompt));response.stageData.ASSUMPTIONS='';response.stageData.UNKNOWN_INFORMATION='';
  const accepted=await acceptSequence(f.r,f.p,f.prompt,response),expected={EXACT_DELIVERABLE_REQUESTED:'A complete one-page inventory.',ASSUMPTIONS:'',UNKNOWN_INFORMATION:'',INPUT_SET_CONTENTS:response.stageData.INPUT_SET_CONTENTS};assertAgentJob(accepted.p,expected,'accepted-empty-reload');
  assert.equal(f.r.engine.gate(1,accepted.p).complete,true,'STAGE01_SPEC_AGENT_JOB_ACCEPTED_EMPTY_ORACLE');
  const destination=projectStoreRuntime({sourceOverrides}),imported=await destination.store.importPackage(await f.r.store.exportPackage(accepted.p.job.JOB_ID)),reloaded=await destination.store.readProject(imported.job.JOB_ID);assertAgentJob(reloaded,expected,'accepted-empty-restored');
  assert.equal(destination.engine.gate(1,reloaded).complete,true,'STAGE01_SPEC_AGENT_JOB_ACCEPTED_EMPTY_RESTORED_ORACLE');assert.equal((reloaded.projectData.migrationArchives||[]).some(row=>row.kind==='LEGACY_UNACCEPTED_AGENT_JOB_DEFAULTS'),false,'STAGE01_SPEC_AGENT_JOB_ACCEPTED_EMPTY_NOT_DEFAULT_ORACLE');
  assert.equal(reloaded.projectData.rawResponses.find(row=>row.rawResponseId===accepted.acceptedChange.rawResponseId).completeRawResponse,accepted.p.projectData.rawResponses.find(row=>row.rawResponseId===accepted.acceptedChange.rawResponseId).completeRawResponse,'STAGE01_SPEC_AGENT_JOB_ACCEPTED_EMPTY_RAW_ORACLE');
  agentJobLifecycleControls.push({caseId:'accepted-empty-open-string',realAcceptanceBoundary:true,syntheticActor:true,pendingReload:true,acceptedReload:true,exportImportReload:true,rawPreserved:true,agentEmptyPreserved:true,stageComplete:true});
 }
 if(!scenario||scenario==='accumulation'){
  const f=await sequence('ACCUMULATE'),first=envelope(f.r,f.p,f.prompt,capture(f.prompt));delete first.stageData.ASSUMPTIONS;delete first.stageData.UNKNOWN_INFORMATION;
  const partial=await acceptSequence(f.r,f.p,f.prompt,first);assert.equal(f.r.engine.gate(1,partial.p).complete,false,'STAGE01_SPEC_AGENT_JOB_ACCUMULATION_PARTIAL_ORACLE');
  const next=await issued(f.r,partial.p),second=envelope(f.r,next.p,next.prompt,capture(next.prompt));delete second.stageData.EXACT_DELIVERABLE_REQUESTED;second.stageData.ASSUMPTIONS='UNKNOWN';second.stageData.UNKNOWN_INFORMATION='NONE';
  assert.equal(next.p.job.CURRENT_INPUT_VERSION,partial.p.job.CURRENT_INPUT_VERSION,'STAGE01_SPEC_AGENT_JOB_ACCUMULATION_INPUT_ORACLE');
  const accepted=await acceptSequence(f.r,next.p,next.prompt,second);assertAgentJob(accepted.p,{EXACT_DELIVERABLE_REQUESTED:'A complete one-page inventory.',ASSUMPTIONS:'UNKNOWN',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:second.stageData.INPUT_SET_CONTENTS},'accumulated-reloaded');
  assert.equal(accepted.p.projectData.acceptedChanges.length,2,'STAGE01_SPEC_AGENT_JOB_ACCUMULATED_PROPOSALS_ORACLE');
  assert.equal(f.r.engine.gate(1,accepted.p).complete,true,'STAGE01_SPEC_AGENT_JOB_ACCUMULATION_COMPLETE_ORACLE');
  agentJobLifecycleControls.push({caseId:'same-input-partial-accumulation',sameInputVersion:true,acceptedProposals:2,pendingReload:true,acceptedReload:true,firstStageComplete:false,finalStageComplete:true,priorFieldPreserved:true});
 }
 for(const field of !scenario||scenario==='changed-input'?['ASSUMPTIONS','UNKNOWN_INFORMATION']:[]){
  const f=await sequence('CHANGED-'+field),first=envelope(f.r,f.p,f.prompt,capture(f.prompt));first.stageData.ASSUMPTIONS='SYNTHETIC_PRIOR_ASSUMPTIONS_'+field;first.stageData.UNKNOWN_INFORMATION='SYNTHETIC_PRIOR_UNKNOWNS_'+field;
  const before=(await acceptSequence(f.r,f.p,f.prompt,first)).p,priorRaw=before.projectData.rawResponses.map(row=>({id:row.rawResponseId,text:row.completeRawResponse})),priorProposals=before.projectData.responseProposals.map(row=>({id:row.proposalId,stageData:JSON.stringify(row.proposedStageData)}));
  const changed=f.r.copy(before);changed.job.EXACT_USER_OBJECTIVE_VERBATIM='Produce a revised complete two-page inventory.';f.r.engine.recordHumanInputVersion(changed,['EXACT_USER_OBJECTIVE_VERBATIM'],'SYNTHETIC_SPEC_OPERATOR');
  assertAgentJob(changed,{},'changed-input-current-projection-cleared');
  const mutationConfirmation=f.r.store.mutationImpact(before,changed),saved=await f.r.store.writeProject(changed,{expectedProjectRevision:before.revision,expectedStateSha256:before.projectSha256,mutationConfirmation});
  assert.notEqual(saved.job.CURRENT_INPUT_VERSION,before.job.CURRENT_INPUT_VERSION,'STAGE01_SPEC_AGENT_JOB_CHANGED_INPUT_ORACLE');
  assertAgentJob(saved,{},'changed-input-projection-cleared');assert.deepEqual(Object.keys(saved.stages[1].agentData),[],'STAGE01_SPEC_AGENT_JOB_CHANGED_STAGE_PROJECTION_ORACLE');
  for(const raw of priorRaw)assert.equal(saved.projectData.rawResponses.find(row=>row.rawResponseId===raw.id).completeRawResponse,raw.text,'STAGE01_SPEC_AGENT_JOB_CHANGED_RAW_PRESERVED_ORACLE');
  for(const proposal of priorProposals)assert.equal(JSON.stringify(saved.projectData.responseProposals.find(row=>row.proposalId===proposal.id).proposedStageData),proposal.stageData,'STAGE01_SPEC_AGENT_JOB_CHANGED_PROPOSAL_PRESERVED_ORACLE');
  assert.throws(()=>f.r.prompts.buildPromptRecord(2,saved,{operation:'COMPLETE'}),error=>error.code==='UPSTREAM_STAGE_INCOMPLETE','STAGE01_SPEC_AGENT_JOB_CHANGED_DOWNSTREAM_GATE_ORACLE');
  const authorityProjection=f.r.prompts.contextFor(2,saved,'COMPLETE',f.r.prompts.scopeFor(2,saved));for(const marker of [first.stageData.ASSUMPTIONS,first.stageData.UNKNOWN_INFORMATION])assert.equal(authorityProjection.includes(marker),false,'STAGE01_SPEC_AGENT_JOB_CHANGED_AUTHORITY_PROJECTION_ORACLE');
  const next=await issued(f.r,saved),response=envelope(f.r,next.p,next.prompt,capture(next.prompt));delete response.stageData[field];
  const accepted=(await acceptSequence(f.r,next.p,next.prompt,response)).p,gate=f.r.engine.gate(1,accepted);
  assert.equal(gate.complete,false,'STAGE01_SPEC_AGENT_JOB_STALE_CONTRIBUTION_ORACLE: '+field);assert.ok(gate.reasons.some(reason=>reason.includes(field)),'STAGE01_SPEC_AGENT_JOB_STALE_REASON_ORACLE: '+field);
  assert.ok(accepted.projectData.acceptedChanges.some(row=>row.changeId===before.projectData.acceptedChanges.at(-1).changeId),'STAGE01_SPEC_AGENT_JOB_HISTORY_PRESERVATION_ORACLE');
  agentJobLifecycleControls.push({caseId:'changed-input-missing-'+field,field,changedHumanInput:true,currentJobAndStageProjectionCleared:true,priorRawAndProposalBytesPreserved:true,downstreamExportBlocked:true,downstreamAuthorityProjectionOnly:true,obsoleteAuthorityWithheld:true,currentStage1Package:true,operatorAccepted:true,currentConfirmation:true,pendingReload:true,acceptedReload:true,priorAcceptedHistoryPreserved:true,stageComplete:false,fieldReasonFound:true});
 }
 if(!scenario||scenario==='refinement'){
  const f=await sequence('REFINEMENT'),first=envelope(f.r,f.p,f.prompt,capture(f.prompt));first.stageData.ASSUMPTIONS='SYNTHETIC_REFINED_ASSUMPTIONS';delete first.stageData.UNKNOWN_INFORMATION;
  const partial=await acceptSequence(f.r,f.p,f.prompt,first),next=await issued(f.r,partial.p),second=envelope(f.r,next.p,next.prompt,capture(next.prompt));delete second.stageData.EXACT_DELIVERABLE_REQUESTED;delete second.stageData.ASSUMPTIONS;second.stageData.UNKNOWN_INFORMATION='SYNTHETIC_REFINED_UNKNOWNS';
  const accepted=(await acceptSequence(f.r,next.p,next.prompt,second)).p;assert.equal(f.r.engine.gate(1,accepted).complete,true,'STAGE01_SPEC_AGENT_JOB_REFINEMENT_READY_ORACLE');
  assert.equal(accepted.projectData.acceptedChanges.length,2,'STAGE01_SPEC_AGENT_JOB_REFINEMENT_PROPOSALS_ORACLE');
  const changed=f.r.copy(accepted),priorRaw=accepted.projectData.rawResponses.map(row=>({id:row.rawResponseId,text:row.completeRawResponse})),priorProposals=accepted.projectData.responseProposals.map(row=>({id:row.proposalId,stageData:JSON.stringify(row.proposedStageData)}));
  f.r.engine.invalidateAcceptedResponse(changed,{stage:1,rawResponseId:partial.acceptedChange.rawResponseId,reason:'The synthetic operator requests correction of the accepted intake.',operatorLabel:'SYNTHETIC_SPEC_OPERATOR'});
  // Ordinary COMPLETE author contributions share the refinement lane. Retire
  // both current contributions while preserving their immutable source content.
  assertAgentJob(changed,{},'refinement-projection-cleared');assert.deepEqual(Object.keys(changed.stages[1].agentData),[],'STAGE01_SPEC_AGENT_JOB_REFINEMENT_STAGE_PROJECTION_ORACLE');
  assert.equal(f.r.engine.gate(1,changed).complete,false,'STAGE01_SPEC_AGENT_JOB_REFINEMENT_GATE_ORACLE');
  const mutationConfirmation=f.r.store.mutationImpact(accepted,changed),stored=await f.r.store.writeProject(changed,{expectedProjectRevision:accepted.revision,expectedStateSha256:accepted.projectSha256,mutationConfirmation}),reloaded=await f.r.store.readProject(stored.job.JOB_ID);assertAgentJob(reloaded,{},'refinement-reloaded');
  for(const raw of priorRaw)assert.equal(reloaded.projectData.rawResponses.find(row=>row.rawResponseId===raw.id).completeRawResponse,raw.text,'STAGE01_SPEC_AGENT_JOB_REFINEMENT_RAW_PRESERVED_ORACLE');
  for(const proposal of priorProposals)assert.equal(JSON.stringify(reloaded.projectData.responseProposals.find(row=>row.proposalId===proposal.id).proposedStageData),proposal.stageData,'STAGE01_SPEC_AGENT_JOB_REFINEMENT_PROPOSAL_PRESERVED_ORACLE');
  assert.throws(()=>f.r.prompts.buildPromptRecord(2,reloaded,{operation:'COMPLETE'}),error=>error.code==='UPSTREAM_STAGE_INCOMPLETE','STAGE01_SPEC_AGENT_JOB_REFINEMENT_DOWNSTREAM_GATE_ORACLE');
  const authorityProjection=f.r.prompts.contextFor(2,reloaded,'COMPLETE',f.r.prompts.scopeFor(2,reloaded));for(const marker of [first.stageData.ASSUMPTIONS,second.stageData.UNKNOWN_INFORMATION])assert.equal(authorityProjection.includes(marker),false,'STAGE01_SPEC_AGENT_JOB_REFINEMENT_AUTHORITY_PROJECTION_ORACLE');
  await issued(f.r,reloaded);
  agentJobLifecycleControls.push({caseId:'accepted-intake-refinement',acceptedProposals:2,sameCompleteLaneInvalidated:true,currentJobAndStageProjectionCleared:true,savedAndReloaded:true,priorRawAndProposalBytesPreserved:true,downstreamExportBlocked:true,downstreamAuthorityProjectionOnly:true,obsoleteAuthorityWithheld:true,currentStage1Package:true,stageComplete:false});
 }
 return agentJobLifecycleControls;
}

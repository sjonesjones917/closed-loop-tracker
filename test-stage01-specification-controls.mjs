import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {authorizeSyntheticHandoff} from './test-handoff-authorization.mjs';
import {readStoreArchive} from './test-zip.mjs';

// Independent literals from controlling §§6.5–6.6. These expectations must not
// be generated from the producer or accounting validator under examination.
const categories=Object.freeze(['QUALIFIERS','EXCEPTIONS','DEPENDENCIES','NEGATIVE_REQUIREMENTS','DO_NOT_CHANGE','VISUAL_CONSTRAINTS','TEMPORAL_CONSTRAINTS','ACCEPTANCE_CONDITIONS','AUTHORITY_STATEMENTS','TOOL_RESTRICTIONS','FILE_REFERENCES','OUTPUT_FORMAT_REQUIREMENTS','CORRECTIONS','LATER_OVERRIDES']);
const dispositions=Object.freeze(['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED']);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const boundary='Actual saved Stage1 instruction ZIP and authoritative response-file staging/capture/admission; explicit operator commit and current confirmation gate under transaction adapter. Synthetic actor; no browser, human semantic inspection or external conversation claimed.';

function capture(prompt){
 const manifest=prompt.contextManifest.intakeCoverageManifest;
 return {schema:'closed-loop-stage01-capture/2',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,pass1Completed:true,pass2OmissionChallenge:{completed:true,checkedCategories:[...categories],omissionsFound:[],omissionsResolved:true},units:manifest.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',extractedStatements:[{statementKey:'statement-'+index,text:unit.rawValueText||unit.label,statementClass:'CONTEXT',sourceLocation:unit.sourceLocation}]}))};
}
function envelope(r,p,prompt,accounting){
 const manifest=r.prompts.promptFileManifest(prompt);
 return {schema:'closed-loop-stage-response/3',contractProfileId:r.runtime.closedLoopWorkflowSchema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:1,operation:prompt.operation,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:manifest.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],humanAuthorityCandidates:[],stageData:{EXACT_DELIVERABLE_REQUESTED:'A complete one-page inventory.',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(accounting)},records:{},evidence:[{temporaryKey:'intake-evidence',kind:'SYNTHETIC_INTAKE',description:'Controlled accounting and gate evidence.',authorityType:'AGENT_CLAIM',location:'response.json',content:'This synthetic response tests transport/accounting and does not establish real semantic inspection.'}],unresolved:[],warnings:[],attachments:[]};
}
async function admitted(r,p,prompt,value){
 const text=JSON.stringify(value),identity={promptIdentity:value.promptIdentity,packageId:value.packageId,operationReservationId:value.operationReservationId,challengeNonce:value.challengeNonce};
 const staged=await r.store.stageResponseFile({jobId:p.job.JOB_ID,stage:1,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',...identity});
 const file=await r.store.readStagedResponseFile({jobId:p.job.JOB_ID,stagingId:staged.stagingId});
 assert.equal(file.sha256,digest(Buffer.from(text)),'STAGE01_SPEC_RAW_BYTES_ORACLE');
 const raw=r.ingestion.captureRaw(p,{stage:1,text,promptRecord:prompt,transport:r.copy({authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,status:file.status,sha256:file.sha256,byteSize:file.byteSize,...identity})});
 const prepared=r.ingestion.prepareCaptured(raw.project,{rawResponseId:raw.rawRecord.rawResponseId,promptRecord:prompt,expectedCommittedRevision:p.revision});
 assert.equal(prepared.project.projectData.rawResponses.find(row=>row.rawResponseId===raw.rawRecord.rawResponseId)?.completeRawResponse,text,'STAGE01_SPEC_RAW_PRESERVATION_ORACLE');
 assert.equal(prepared.project.projectData.acceptedChanges.length,0,'STAGE01_SPEC_PREACCEPTANCE_ORACLE');
 return prepared;
}
function instructionOracle(text,operation){
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
export async function verifyStage01SpecificationControls(){
 const observations=[],packages=[],faults=[];
 for(const operation of ['COMPLETE','RECONCILE_INTAKE']){
  const r=projectStoreRuntime(),blank=r.core.createBlankState('JOB-SPEC-STAGE01-'+operation);
  Object.assign(blank.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Produce a complete one-page inventory.',EXPLICIT_USER_REQUIREMENTS:'Preserve all supplied human input.',CURRENT_INPUT_VERSION:'INPUT-v001'});r.engine.ensureShape(blank);r.engine.recalculate(blank);
  let p=await r.store.writeProject(blank,{expectedProjectRevision:0,incrementRevision:false,createOnly:true}),draft=r.copy(p);
  const issued=r.prompts.reserveAndBuildPromptRecord(draft,1,{operation},{owningTabInstance:'SYNTHETIC-SPEC-CONTROL'}).prompt;
  p=await r.store.writeProject(draft,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
  let prompt=p.projectData.generatedPrompts.find(row=>row.instructionId===issued.instructionId);
  const authorized=await authorizeSyntheticHandoff(r,{project:p,prompt});p=authorized.project;prompt=authorized.prompt;
  const pkg=await r.store.createExecutionPackage(authorized.request);
  const members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),instruction=members.find(row=>row.canonicalPath==='instruction.txt'),manifest=JSON.parse(Buffer.from(members.find(row=>row.canonicalPath==='manifest.json').bytes).toString('utf8')),text=Buffer.from(instruction.bytes).toString('utf8');
  assert.equal(text,prompt.prompt,'STAGE01_SPEC_SAVED_INSTRUCTION_ORACLE');assert.equal(digest(instruction.bytes),manifest.promptIdentity.bodySha256,'STAGE01_SPEC_MANIFEST_BYTES_ORACLE');instructionOracle(text,operation);
  packages.push({operation,actualSavedZip:true,exactInstructionBytes:true,categoryCount:categories.length,dispositionCount:dispositions.length,producerVersion:prompt.promptEngineVersion});
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
  const control=await admitted(r,p,prompt,envelope(r,p,prompt,base));assert.equal(control.validation.valid,true,'STAGE01_SPEC_CONFORMING_ADMISSION_ORACLE: '+JSON.stringify(control.validation.issues));
  const pendingGate=r.engine.gate(1,control.project);assert.equal(pendingGate.complete,false,'STAGE01_SPEC_PENDING_GATE_ORACLE');assert.ok(pendingGate.reasons.some(reason=>reason.includes('No validated agent response has been accepted')),'STAGE01_SPEC_PENDING_REASON_ORACLE');
  const committed=r.ingestion.commit(control.project,control.proposal.proposalId,{operator:'SYNTHETIC_SPEC_OPERATOR'}),accepted=committed.project;
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
  observations.push({caseId:'conforming-current-intent',authoritativeFile:true,operatorAccepted:true,currentConfirmation:true,stageComplete:true});
 }
 const expected={authorOperations:2,omissionCategories:14,dispositions:6,admissionNegatives:27,gateNegatives:5,conformingComplete:1,carrierFaults:4},observed={authorOperations:packages.length,omissionCategories:categories.length,dispositions:dispositions.length,admissionNegatives:observations.filter(row=>row.expectedCode).length,gateNegatives:observations.filter(row=>row.expectedComplete===false).length,conformingComplete:observations.filter(row=>row.caseId==='conforming-current-intent'&&row.stageComplete).length,carrierFaults:faults.length};
 assert.deepEqual(observed,expected,'STAGE01_SPEC_CASE_POPULATION_ORACLE');
 return {stage01SpecificationControls:'PASS',boundary,synthetic:true,actualBrowser:false,realExternalActor:false,packages,observations,faults,verificationObservations:[{checkId:'STAGE01-SPECIFICATION-CONTRACT-CONTROLS',boundary,expected,observed,passed:true}]};
}

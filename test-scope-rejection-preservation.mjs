import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// Independent literal population retained from the partial ingestion boundary.
// This helper owns no prerequisite fixture and never manufactures a stage gate.
const cases = [
 ['project revision',2,'projectRevision','COMPLETE'], ['input version',2,'inputVersion','COMPLETE'],
 ['source set version',3,'sourceSetVersion','COMPLETE'], ['requirements version',5,'requirementsVersion','COMPLETE'],
 ['test suite version',7,'testSuiteVersion','COMPLETE'], ['instruction version',9,'instructionVersion','COMPLETE'],
 ['iteration',11,'iterationId','EXECUTE_RUN'], ['candidate',11,'candidateId','EXECUTE_RUN'],
 ['run',11,'runId','EXECUTE_RUN'], ['context',11,'contextId','EXECUTE_RUN'],
 ['baseline',21,'baselineId','COMPLETE'], ['product',21,'productId','COMPLETE'],
 ['non-required populated scope identity',2,'baselineId','COMPLETE'], ['research version',3,'researchVersion','COMPLETE'],
 ['source converged iteration',19,'sourceConvergedIterationId','COMPARE'], ['confirmation iteration',19,'confirmationIterationId','COMPARE'],
 ['product version',23,'productVersion','COMPLETE'], ['delivery candidate set',25,'deliveryCandidateSetId','COMPLETE'],
 ['review version',26,'reviewVersion','COMPLETE'], ['reconciled review version',27,'reconciledReviewVersion','ADVISORY_REVIEW'],
 ['release identity',29,'releaseId','INVESTIGATE_MISSING_EVIDENCE'], ['hash review identity',29,'hashReviewId','INVESTIGATE_MISSING_EVIDENCE'],
 ['prohibited evidence-chain version',2,'evidenceChainVersion','COMPLETE']
];
const faultOracles = [
 ['canonical-job-pointer','SCOPE_CANONICAL_STATE_ORACLE'], ['canonical-record','SCOPE_CANONICAL_STATE_ORACLE'],
 ['project-revision','SCOPE_CANONICAL_STATE_ORACLE'], ['reservation-binding','SCOPE_RESERVATION_BINDING_ORACLE'],
 ['unrelated-reservation','SCOPE_CANONICAL_STATE_ORACLE'], ['new-proposal','SCOPE_NO_NEW_PROPOSAL_ORACLE'],
 ['existing-proposal','SCOPE_PRIOR_PROPOSALS_ORACLE'], ['retained-raw-prefix','SCOPE_RETAINED_AUDIT_ORACLE'],
 ['retained-audit-prefix','SCOPE_RETAINED_AUDIT_ORACLE'], ['raw-body-hash','SCOPE_RAW_EXACT_ORACLE'],
 ['projection-receipt','SCOPE_PROJECTION_RECEIPT_ORACLE'], ['gate-outcome','SCOPE_GATE_OUTCOME_ORACLE'],
 ['original-input','SCOPE_INPUT_PROJECT_ORACLE']
];
const auditFamilies=['rawResponses','generatedOutputs','responseValidations','outputReceipts','responseDispositions','rejectedResponses','history','allocationReceipts'];
const operationalFamilies=[...auditFamilies,'responseProposals','idCounters','eventSequence'];
const excludedStageFields=['gate','status','derivedData','responseDraft'];
const reservationOmissions=['/STATUS','/fields/STATUS','/recordSha256','/sha256','/updatedAt'];
const idOf=([name,stage,key])=>`scope.${stage}.${key}.${name.replaceAll(' ','-')}`;
const value=(row,key)=>Object.hasOwn(row?.fields||{},key)?row.fields[key]:row?.[key];
const scalarOrder=(a,b)=>{const left=[...a],right=[...b];for(let i=0;i<Math.min(left.length,right.length);i++){const n=left[i].codePointAt(0)-right[i].codePointAt(0);if(n)return n;}return left.length-right.length;};

// Independent streaming canonical serialization and Node SHA-256. Production
// receipt validators and hash outputs are not used as expected digests.
function* canonical(value){
 if(value===null){yield 'null';return;}
 if(typeof value==='string'||typeof value==='boolean'){yield JSON.stringify(value);return;}
 if(typeof value==='number'){assert(Number.isFinite(value)&&!Object.is(value,-0),'SCOPE_CANONICAL_NUMBER_ORACLE');yield JSON.stringify(value);return;}
 assert(value&&typeof value==='object','SCOPE_CANONICAL_VALUE_ORACLE');
 if(Array.isArray(value)){yield '[';for(let i=0;i<value.length;i++){assert(Object.hasOwn(value,i),'SCOPE_CANONICAL_ARRAY_ORACLE');if(i)yield ',';yield* canonical(value[i]);}yield ']';return;}
 yield '{';const keys=Object.keys(value).sort(scalarOrder);for(let i=0;i<keys.length;i++){if(i)yield ',';yield JSON.stringify(keys[i]);yield ':';yield* canonical(value[keys[i]]);}yield '}';
}
function digest(value){const hash=createHash('sha256');for(const chunk of canonical(value))hash.update(chunk,'utf8');return hash.digest('hex');}
const textDigest=text=>createHash('sha256').update(text,'utf8').digest('hex');
function omit(source,pointers){
 const copy={...source};
 for(const pointer of pointers){const keys=pointer.slice(1).split('/').map(key=>key.replaceAll('~1','/').replaceAll('~0','~'));let node=copy;
  for(let i=0;i<keys.length-1;i++){if(!node[keys[i]]||typeof node[keys[i]]!=='object'){node=null;break;}node[keys[i]]={...node[keys[i]]};node=node[keys[i]];}if(node)delete node[keys.at(-1)];}
 return copy;
}
const recordDigest=row=>digest(omit(row,['/recordSha256','/sha256']));
function contentDigest(row,idField){return digest(omit({fields:row.fields||{},relationships:row.relationships||{},evidenceRefs:row.evidenceRefs||[]},[idField,'CREATED_AT','UPDATED_AT','VERSION','STATUS'].map(key=>'/fields/'+key)));}
const normalizedReservation=row=>omit(row,reservationOmissions);
function protectedProject(project,reservationId){
 const result={...project,job:omit(project.job,['/CURRENT_STATE','/NEXT_REQUIRED_ACTION']),projectData:{...project.projectData},stages:{}};
 delete result.projectSha256;delete result.projectData.applicationProjection;
 for(const key of operationalFamilies)delete result.projectData[key];
 for(const [number,state]of Object.entries(project.stages))result.stages[number]=omit(state,excludedStageFields.map(key=>'/'+key));
 result.projectData.operationReservations=project.projectData.operationReservations.map(row=>row.id===reservationId?normalizedReservation(row):row);
 return result;
}
function gates(project){return Object.fromEntries(Object.entries(project.stages).map(([number,state])=>[number,{status:state.status,decision:state.decision,decisionEvidence:state.decisionEvidence,gate:omit(state.gate||{},['/checkedAt'])}]));}
function selectedProjectionRows(runtime,project,contract){
 return Object.fromEntries(Object.entries(contract.canonicalOutputFamilies).map(([family,definition])=>{
  let rows=runtime.engine.recordsForCurrentScope(project,family);
  if(definition.selection!=='CURRENT_SCOPE')rows=rows.filter(row=>row.active!==false&&!row.invalidatedBy&&!['RETIRED','INVALIDATED','SUPERSEDED'].includes(String(value(row,'STATUS')||row.validity||'').trim().toUpperCase()));
  if(definition.selection==='SCOPED_ACTIVE_VALID_PROPOSED_APPLICABILITY')rows=rows.filter(row=>['APPLICABLE','NOT_APPLICABLE','UNKNOWN'].includes(String(value(row,'PROPOSED_APPLICABILITY')||'').trim().toUpperCase()));
  return [family,rows];
 }));
}
function assertProjection(runtime,project){
 const contract=runtime.schema.PROJECT_PROJECTION_DERIVATION_CONTRACT,projection=project.projectData.applicationProjection,receipt=projection?.receipt,label='SCOPE_PROJECTION_RECEIPT_ORACLE';
 assert(receipt&&projection.inputObservations,label+': current receipt and observed inputs');
 const closed=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
 assert(closed(projection,['schema','observedAt','inputObservations','receipt']),label+': closed projection');assert.equal(projection.schema,'closed-loop-current-projection/1',label+': projection schema');
 assert(typeof projection.observedAt==='string'&&Number.isFinite(Date.parse(projection.observedAt))&&new Date(projection.observedAt).toISOString()===projection.observedAt,label+': observation epoch');
 assert(closed(receipt,['schema','derivationId','derivationVersion','registryEntrySha256','canonicalInputSha256','sourceRecordHashes','outputSha256']),label+': closed receipt');
 assert(closed(projection.inputObservations,['artifactCustody','promptRetention','applicationCapabilities'])&&Object.values(projection.inputObservations).every(Array.isArray),label+': closed observed inputs');
 const selected=selectedProjectionRows(runtime,project,contract),sources=[],recordUniverse={};
 for(const family of Object.keys(runtime.schema.RECORD_SCHEMAS).sort(scalarOrder)){
  const rows=project.projectData[family],idField=runtime.schema.RECORD_SCHEMAS[family].idField;
  assert(Array.isArray(rows),label+': canonical family '+family);
  recordUniverse[family]=rows.map(row=>{const id=String(row.id||row.recordId||value(row,idField)||'');assert(id,label+': allocated record identity');
   sources.push({family,id,sha256:selected[family]?.includes(row)?digest(omit(row,contract.canonicalOutputFamilies[family].omissions)):recordDigest(row)});return id;});
 }
 sources.sort((a,b)=>scalarOrder(a.family,b.family)||scalarOrder(a.id,b.id));
 const jobSource=Object.fromEntries(Object.entries(project.job).filter(([key])=>!contract.jobOutputFields.includes(key)));
 const stageSource=Object.fromEntries(Object.entries(project.stages).map(([number,state])=>[number,Object.fromEntries(Object.entries(state).filter(([key])=>!contract.stageOutputFields.includes(key)))]));
 const nonrecord=Object.fromEntries(Object.keys(project.projectData).filter(key=>!Object.hasOwn(runtime.schema.RECORD_SCHEMAS,key)&&key!==contract.storageKey).sort(scalarOrder).map(key=>[key,digest(project.projectData[key])]));
 const input={calculation:contract.algorithmVersion,derivationId:contract.id,observedAt:projection.observedAt,sourceBinding:{schema:contract.canonicalInputContract.sourceBinding,projection:contract.canonicalInputContract.sourceProjection,records:sources},sourceProjections:{jobSha256:digest(jobSource),stageInputsSha256:digest(stageSource),projectSourceSha256:digest({schema:project.schema,workflow:project.workflow,stageCount:project.stageCount,activeStage:project.activeStage,release:project.release}),recordUniverseSha256:digest(recordUniverse),nonrecordProjectData:nonrecord,artifactCustody:projection.inputObservations.artifactCustody,promptRetention:projection.inputObservations.promptRetention,applicationCapabilities:projection.inputObservations.applicationCapabilities}};
 const output={job:Object.fromEntries(contract.jobOutputFields.map(key=>[key,project.job[key]])),stages:Object.fromEntries(Object.entries(project.stages).map(([number,state])=>[number,Object.fromEntries(contract.stageOutputFields.map(key=>[key,state[key]]))])),canonicalRecords:Object.fromEntries(Object.entries(selected).map(([family,rows])=>[family,rows.map(row=>{const fields=contract.canonicalOutputFamilies[family].fields;return {id:String(row.id||row.recordId||value(row,runtime.schema.RECORD_SCHEMAS[family].idField)||''),fields:Object.fromEntries(fields.filter(key=>Object.hasOwn(row.fields||{},key)).map(key=>[key,row.fields[key]])),aliases:Object.fromEntries(fields.filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]]))};})]))};
 assert.equal(receipt.schema,'closed-loop-derivation-receipt/1',label+': schema');assert.equal(receipt.derivationId,contract.id,label+': identity');assert.equal(receipt.derivationVersion,contract.version,label+': version');
 assert.equal(receipt.registryEntrySha256,digest(contract),label+': registry');assert.equal(digest(receipt.sourceRecordHashes),digest(sources),label+': source hashes');
 assert.equal(receipt.canonicalInputSha256,digest(input),label+': input');assert.equal(receipt.outputSha256,digest(output),label+': output');
}
function selectedReservation(runtime,project,prompt){
 const rows=project.projectData.operationReservations.filter(row=>row.id===prompt.operationReservationId);assert.equal(rows.length,1,'SCOPE_RESERVATION_BINDING_ORACLE: unique current reservation');const row=rows[0];
 assert.equal(row.source,'APPLICATION_RESERVATION','SCOPE_RESERVATION_BINDING_ORACLE: application owner');assert(!row.invalidatedBy,'SCOPE_RESERVATION_BINDING_ORACLE: active binding');
 assert.equal(typeof row.fields?.STATUS,'string','SCOPE_RESERVATION_BINDING_ORACLE: status field');assert.equal(row.STATUS,row.fields.STATUS,'SCOPE_RESERVATION_BINDING_ORACLE: exact status aliases');
 for(const [key,expected]of Object.entries({JOB_ID:project.job.JOB_ID,STAGE:Number(prompt.stage),OPERATION:prompt.operation,PROMPT_ID:prompt.instructionId,PACKAGE_ID:prompt.packageId,CHALLENGE_NONCE:prompt.challengeNonce,TARGET_SLOT:prompt.targetSlot,EXPECTED_REVISION:project.revision,RESERVATION_REVISION:project.revision}))assert.equal(value(row,key),expected,'SCOPE_RESERVATION_BINDING_ORACLE: '+key);
 assert.equal(digest(value(row,'SCOPE')),digest(prompt.scope),'SCOPE_RESERVATION_BINDING_ORACLE: exact prompt scope');assert.equal(digest(row.scope),digest(prompt.scope),'SCOPE_RESERVATION_BINDING_ORACLE: retained scope');
 assert.equal(row.recordSha256,recordDigest(row),'SCOPE_RESERVATION_RECORD_HASH_ORACLE');assert.equal(row.sha256,row.recordSha256,'SCOPE_RESERVATION_RECORD_HASH_ORACLE: alias');
 assert.equal(row.contentSha256,contentDigest(row,'OPERATION_RESERVATION_ID'),'SCOPE_RESERVATION_CONTENT_HASH_ORACLE');return row;
}
function assertRetainedAudit(before,after){for(const family of auditFamilies){const prior=before.projectData[family],next=after.projectData[family];assert(Array.isArray(prior)&&Array.isArray(next)&&next.length>=prior.length,'SCOPE_RETAINED_AUDIT_ORACLE: '+family+' length');assert.equal(digest(next.slice(0,prior.length)),digest(prior),'SCOPE_RETAINED_AUDIT_ORACLE: '+family+' prefix');}}
function blockedEnvelope(runtime,project,prompt){const manifest=runtime.prompts.promptFileManifest(prompt);return {schema:runtime.schema.RESPONSE_SCHEMA,contractProfileId:runtime.schema.CONTRACT_PROFILE_ID,jobId:project.job.JOB_ID,stage:Number(prompt.stage),operation:prompt.operation,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:{...manifest.scope},responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'scope-control',kind:'MISSING_CAPABILITY',description:'Controlled blocked scope fixture',whyBlocking:'Scope identity validation only; no external work is claimed.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};}
function assertRejected(runtime,before,input,prompt,result,raw,baseline){
 assert.equal(digest(input),baseline.input,'SCOPE_INPUT_PROJECT_ORACLE');assert.equal(result.project.revision,before.revision,'SCOPE_CANONICAL_STATE_ORACLE: revision');assert.equal(result.proposal,null,'SCOPE_NO_NEW_PROPOSAL_ORACLE');
 assert.equal(digest(result.project.projectData.responseProposals),baseline.proposals,'SCOPE_PRIOR_PROPOSALS_ORACLE');
 const row=selectedReservation(runtime,result.project,prompt);assert.equal(digest(normalizedReservation(row)),baseline.reservation,'SCOPE_RESERVATION_BINDING_ORACLE: preserved content and identity');assert.equal(row.fields.STATUS,'REJECTED','SCOPE_RESERVATION_STATUS_ORACLE: field');assert.equal(row.STATUS,'REJECTED','SCOPE_RESERVATION_STATUS_ORACLE: alias');
 const canonicalSha256After=digest(protectedProject(result.project,prompt.operationReservationId));assert.equal(canonicalSha256After,baseline.canonical,'SCOPE_CANONICAL_STATE_ORACLE');
 assert.equal(digest(gates(result.project)),baseline.gates,'SCOPE_GATE_OUTCOME_ORACLE');assertRetainedAudit(before,result.project);
 const retained=runtime.ingestion.findRaw(result.project,result.rawRecord.rawResponseId);assert(retained,'SCOPE_RAW_EXACT_ORACLE: retained rejection raw');assert.equal(retained.completeRawResponse,raw,'SCOPE_RAW_EXACT_ORACLE: body');assert.equal(retained.sha256,textDigest(raw),'SCOPE_RAW_EXACT_ORACLE: digest');assert.equal(digest(result.rawRecord),digest(retained),'SCOPE_RAW_EXACT_ORACLE: returned/retained raw');
 assertProjection(runtime,result.project);return canonicalSha256After;
}
function changeRow(result,family,index,mutate){const original=result.project.projectData[family][index],row={...original,fields:original.fields?{...original.fields}:undefined};if(row.fields===undefined)delete row.fields;mutate(row);result.project.projectData[family]=result.project.projectData[family].map((entry,i)=>i===index?row:entry);return row;}
function copiedResult(result){return {...result,project:{...result.project,job:{...result.project.job},stages:{...result.project.stages},projectData:{...result.project.projectData}}};}
function detectingControls(runtime,before,input,prompt,result,raw,baseline){
 const canonicalFamily=Object.keys(runtime.schema.RECORD_SCHEMAS).find(family=>family!=='operationReservations'&&before.projectData[family].length>0);assert(canonicalFamily,'SCOPE_FAULT_FIXTURE_ORACLE: genuine prior canonical record');
 const unrelated=before.projectData.operationReservations.findIndex(row=>row.id!==prompt.operationReservationId);assert(unrelated>=0,'SCOPE_FAULT_FIXTURE_ORACLE: genuine prior reservation');assert(before.projectData.responseProposals.length>0&&before.projectData.rawResponses.length>0&&before.projectData.history.length>0,'SCOPE_FAULT_FIXTURE_ORACLE: genuine nonempty retained prefixes');
 return faultOracles.map(([caseId,oracle])=>{
  const changed=copiedResult(result);let source=input;
  if(caseId==='canonical-job-pointer')changed.project.job.CURRENT_INPUT_VERSION='CORRUPTED-CURRENT-INPUT';
  if(caseId==='canonical-record')changeRow(changed,canonicalFamily,0,row=>{row.scopeFault='A changed canonical record must not be hidden by acceptedChanges equality.';});
  if(caseId==='project-revision')changed.project.revision++;
  if(caseId==='reservation-binding')changeRow(changed,'operationReservations',changed.project.projectData.operationReservations.findIndex(row=>row.id===prompt.operationReservationId),row=>{row.fields.PACKAGE_ID=row.PACKAGE_ID='CORRUPTED-PACKAGE';});
  if(caseId==='unrelated-reservation')changeRow(changed,'operationReservations',unrelated,row=>{row.fields.PACKAGE_ID=row.PACKAGE_ID='CORRUPTED-UNRELATED-PACKAGE';});
  if(caseId==='new-proposal'){changed.proposal={proposalId:'FORBIDDEN-NEW-PROPOSAL'};changed.project.projectData.responseProposals=[...changed.project.projectData.responseProposals,changed.proposal];}
  if(caseId==='existing-proposal')changeRow(changed,'responseProposals',0,row=>{row.status='CORRUPTED-PRIOR-PROPOSAL';});
  if(caseId==='retained-raw-prefix')changeRow(changed,'rawResponses',0,row=>{row.completeRawResponse+='CORRUPTED-PREFIX';});
  if(caseId==='retained-audit-prefix')changeRow(changed,'history',0,row=>{row.type='CORRUPTED-RETAINED-AUDIT';});
  if(caseId==='raw-body-hash'){const index=changed.project.projectData.rawResponses.findIndex(row=>row.rawResponseId===result.rawRecord.rawResponseId);changed.rawRecord=changeRow(changed,'rawResponses',index,row=>{row.sha256='0'.repeat(64);});}
  if(caseId==='projection-receipt')changed.project.projectData.applicationProjection={...changed.project.projectData.applicationProjection,receipt:{...changed.project.projectData.applicationProjection.receipt,canonicalInputSha256:'0'.repeat(64)}};
  if(caseId==='gate-outcome'){const state=changed.project.stages[1];changed.project.stages[1]={...state,gate:{...state.gate,complete:!state.gate.complete}};}
  if(caseId==='original-input')source={...input,job:{...input.job,JOB_TITLE:'CORRUPTED-ORIGINAL-INPUT'}};
  assert.throws(()=>assertRejected(runtime,before,source,prompt,changed,raw,baseline),error=>error?.code==='ERR_ASSERTION'&&error.message.includes(oracle),'SCOPE_INTENDED_CORRUPTION_ORACLE: '+caseId+' must fail '+oracle);
  return {caseId,oracle,detected:true,control:'COPY_ON_WRITE_ACTUAL_PREPARED_STATE'};
 });
}
export function createReservedScopeRejectionProof(){
 const observations=[],faults=[],seen=new Set();
 function observe(runtime,source,prompt){
  const matching=cases.filter(entry=>entry[1]===Number(prompt.stage)&&entry[3]===prompt.operation&&!seen.has(idOf(entry)));if(!matching.length)return;
  const sourceBefore=digest(source),project=runtime.engine.clone(source);
  // Reservation registration appends real prompt/history without always refreshing
  // the projection receipt. Normalize only this disposable clone through the real
  // owner, then freeze its rejection baseline; never force gates or edit pointers.
  assert.equal(digest(project.projectData.generatedPrompts.map(row=>runtime.prompts.promptContextRetentionState(row))),digest(source.projectData.generatedPrompts.map(row=>runtime.prompts.promptContextRetentionState(row))),'SCOPE_RETAINED_PROMPT_CONTEXT_ORACLE');
  runtime.engine.recalculate(project);
  assert.equal(runtime.engine.jobPointerIntegrityIssues(project).length,0,'SCOPE_CURRENT_POINTER_INTEGRITY_ORACLE');
  const saved=project.projectData.generatedPrompts.filter(row=>row.instructionId===prompt.instructionId&&!row.invalidatedBy);assert.equal(saved.length,1,'SCOPE_GENUINE_SAVED_PROMPT_ORACLE');prompt=saved[0];
  assert.equal(prompt.source,'APPLICATION_PROMPT_REGISTRATION','SCOPE_GENUINE_SAVED_PROMPT_ORACLE: owner');assert.equal(prompt.transportBindingRequired,true,'SCOPE_GENUINE_SAVED_PROMPT_ORACLE: reserved');
  const reservation=selectedReservation(runtime,project,prompt);assert(['RESERVED','EXPORTED','ORPHANED','RESUMED','RESPONSE_STAGED'].includes(value(reservation,'STATUS')),'SCOPE_CURRENT_RESERVATION_STATUS_ORACLE');
  assertProjection(runtime,project);
  const before={input:digest(project),canonical:digest(protectedProject(project,prompt.operationReservationId)),reservation:digest(normalizedReservation(reservation)),proposals:digest(project.projectData.responseProposals),gates:digest(gates(project))};
  const envelope=blockedEnvelope(runtime,project,prompt),transport={authority:'NONAUTHORITATIVE_TEXT_FALLBACK',packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce};
  let control=runtime.ingestion.prepare(project,{stage:Number(prompt.stage),text:JSON.stringify(envelope),promptRecord:prompt,transport});
  assert.equal(control.validation.valid,true,'SCOPE_CURRENT_CONTROL_ORACLE: '+JSON.stringify(control.validation.issues));assert.equal(control.validation.errorCount,0,'SCOPE_CURRENT_CONTROL_ORACLE: zero errors');assert(!control.validation.issues.some(issue=>issue.severity==='ERROR'),'SCOPE_CURRENT_CONTROL_ORACLE: no error issue');assert(control.proposal,'SCOPE_CURRENT_CONTROL_PROPOSAL_ORACLE');assert.equal(control.proposal.status,'PENDING_OPERATOR_REVIEW','SCOPE_CURRENT_CONTROL_PROPOSAL_ORACLE: status');control=null;
  assert.equal(digest(project),before.input,'SCOPE_INPUT_PROJECT_ORACLE: conforming control');
  for(const entry of matching){const [name,stage,key,operation]=entry,changed={...envelope,scope:{...envelope.scope}};changed.scope[key]=key==='projectRevision'?changed.scope[key]+1:`STALE-${key}`;
   assert.notEqual(changed.scope[key],envelope.scope[key],'SCOPE_SINGLE_KEY_MUTATION_ORACLE: changed identity');
   assert(key==='projectRevision'?Number.isSafeInteger(changed.scope[key])&&changed.scope[key]===envelope.scope[key]+1:typeof changed.scope[key]==='string'&&changed.scope[key]===`STALE-${key}`,'SCOPE_SINGLE_KEY_MUTATION_ORACLE: typed value');
   assert.equal(digest(omit(changed,['/scope/'+key])),digest(omit(envelope,['/scope/'+key])),'SCOPE_SINGLE_KEY_MUTATION_ORACLE: exact other envelope members');
   const raw=JSON.stringify(changed),result=runtime.ingestion.prepare(project,{stage,text:raw,promptRecord:prompt,transport}),path='/scope/'+key;
   assert.equal(result.validation.valid,false,'SCOPE_REJECTION_ORACLE: '+name);assert(result.validation.issues.some(issue=>issue.code==='STALE_SCOPE'&&issue.path===path),'SCOPE_REJECTION_ORACLE: exact '+path+' '+JSON.stringify(result.validation.issues));assert(!result.validation.issues.some(issue=>issue.code==='WRONG_VALUE_TYPE'&&issue.path===path),'SCOPE_TYPED_STALE_ORACLE: '+name);
   const after=assertRejected(runtime,project,project,prompt,result,raw,before);
   if(!faults.length)faults.push(...detectingControls(runtime,project,project,prompt,result,raw,before));
   assert.equal(digest(source),sourceBefore,'SCOPE_LIFECYCLE_CALLER_PRESERVED_ORACLE');
   const row={caseId:idOf(entry),name,stage,key,operation,instructionId:prompt.instructionId,operationReservationId:prompt.operationReservationId,expectedCode:'STALE_SCOPE',observedCode:'STALE_SCOPE',observedPath:path,currentControlAccepted:true,currentControlProposalCreated:true,currentControlProposalStatus:'PENDING_OPERATOR_REVIEW',rejected:true,typeConforming:true,noNewProposal:true,priorProposalsPreserved:true,canonicalStatePreserved:true,inputProjectPreserved:true,rawExact:true,rawSha256Verified:true,retainedAuditPrefixesPreserved:true,reservationBindingPreserved:true,reservationRecordHashVerified:true,reservationContentHashVerified:true,reservationStatus:'REJECTED',projectionReceiptVerified:true,gateOutcomePreserved:true,canonicalSha256Before:before.canonical,canonicalSha256After:after,inputSha256Before:before.input,inputSha256After:digest(project),canonicalRevisionBefore:project.revision,canonicalRevisionAfter:result.project.revision,acceptedChangesBefore:project.projectData.acceptedChanges.length,acceptedChangesAfter:result.project.projectData.acceptedChanges.length};
   observations.push(row);seen.add(row.caseId);
  }
 }
 function finish(){
  assert.equal(observations.length,23,'SCOPE_TERMINAL_EXACT_POPULATION_ORACLE');assert.equal(new Set(observations.map(row=>row.key)).size,22,'SCOPE_TERMINAL_EXACT_POPULATION_ORACLE:22keys');
  assert.deepEqual([...seen].sort(),cases.map(idOf).sort(),'SCOPE_TERMINAL_EXACT_POPULATION_ORACLE:23pairs');
  assert.deepEqual(faults.map(row=>[row.caseId,row.oracle]),faultOracles,'SCOPE_TERMINAL_EXACT_FAULT_POPULATION_ORACLE');
  return {schema:'closed-loop-reserved-scope-rejection-proof/1',passed:true,boundary:'PREPARE_REJECTION_ON_GENUINE_RESERVED_LIFECYCLE',caseCount:23,keyCount:22,cases:cases.map(entry=>observations.find(row=>row.caseId===idOf(entry))),faults,synthetic:true,actualBrowser:false,actualExternalActor:false,fullPersistenceProof:false,canonicalAcceptancePerformed:false,priorStagesForcedComplete:false};
 }
 return {observe,finish,observations,faults};
}

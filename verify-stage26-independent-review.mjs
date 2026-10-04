import fs from 'node:fs';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {reservationScopeFixture} from './test-reservation-scope-fixture.mjs';
import {responseFixture} from './operator-journey-fixtures.mjs';
import {readStoreArchive} from './test-zip.mjs';
const publicationProjection='...(outcomeInterpretation?{outcomeInterpretation}:{})',promptSource=fs.readFileSync('prompt-engine.js','utf8'),publicationFault=process.argv.includes('--fault=audit-outcome-publication');
if(publicationFault)assert.equal(promptSource.split(publicationProjection).length-1,1,'AUDIT_PUBLICATION_FAULT_SETUP_ORACLE');
const r=projectStoreRuntime({sourceOverrides:publicationFault?{'prompt-engine.js':promptSource.replace(publicationProjection,'...{}')}:{}}),{engine,core,prompts,ingestion}=r,schema=r.runtime.closedLoopWorkflowSchema,hash=r.runtime.closedLoopHash;
// Controlling field semantics and the approved bounded repair plan preserve an
// open STRING observation. These literal oracles are independent of the runtime
// interpretation API: publication must tell the agent what the application uses.
const satisfyingValues=['SATISFIED','SUCCESS','SUCCEEDED','PASS','PASSED','ACCEPTED','AUTHORIZED','CONFIRMED','COMPLETE','COMPLETED','VALID','MATCH','MATCHED','IDENTICAL','SAME','COMPLIANT','TRUE','YES','REJECTED_INVALID'];
const failureValues=['VIOLATED','FAIL','FAILED','FAILURE','REJECTED','INVALID','MISMATCH','MISMATCHED','NONCOMPLIANT','FALSE','NO','ACCEPTED_INVALID'];
const unknownValues=['UNDETERMINED','UNKNOWN','BLOCKED','NOT RUN','NOT_RUN','UNAVAILABLE','UNVERIFIED','NOT ESTABLISHED'];
const comparisonFields={processAudits:['APPROVED_INPUTS_VS_ACTUAL','APPROVED_INSTRUCTION_VS_ACTUAL','APPROVED_TOOLS_VS_ACTUAL','REQUIRED_TESTS_VS_EXECUTED','CHAIN_OF_CUSTODY'],productAudits:['VALIDATOR_RESULTS','MEANING_VERIFICATION_RESULTS']},publicationObservations=[],auditComparisonPublicationEvidence=[];
function assertPublication(prompt){
 const emitted=prompt.prompt.split('RESPONSE CONTRACT DEFINITIONS\n')[1];assert(emitted,'AUDIT_OUTCOME_PUBLICATION_ORACLE: actual instruction has no response contract.');
 const descriptor=JSON.parse(emitted.split('\n\nEND HASHED INSTRUCTION BODY')[0]),publicDescriptor=JSON.parse(JSON.stringify(prompts.responseContractDescriptor(26,prompt.operation))),manifest=prompts.promptFileManifest(prompt),expectedFields=[];
 assert.deepEqual(descriptor,publicDescriptor,'AUDIT_OUTCOME_PUBLICATION_ORACLE: the final emitted contract differs from its current public descriptor.');
 for(const [collection,names]of Object.entries(comparisonFields))for(const name of names){
  const field=descriptor.records[collection]?.agentFields?.[name];
  if(prompt.operation==='SEMANTIC_REVIEW'){assert.equal(field,undefined,'AUDIT_REVIEW_FIELD_ISOLATION_ORACLE: reviewer contract permits author comparisons.');continue;}
  assert(field,'AUDIT_OUTCOME_PUBLICATION_ORACLE: missing '+collection+'.'+name);assert.equal(field.valueType,'STRING','AUDIT_OUTCOME_PUBLICATION_ORACLE: observation became a closed token field.');assert.deepEqual(field.enumValues,[],'AUDIT_OUTCOME_PUBLICATION_ORACLE: an unsupported closed enum was added.');
  const policy=field.outcomeInterpretation;assert(policy,'AUDIT_OUTCOME_PUBLICATION_ORACLE: '+collection+'.'+name+' has no published STRING interpretation.');
  const expected={version:'closed-loop-audit-comparison/1',valueType:'STRING',normalization:'TRIM_AND_UPPERCASE_FOR_ADJUDICATION_ONLY',satisfyingValues:collection==='processAudits'?[...satisfyingValues,'INTACT']:satisfyingValues,failureValues,unknownValues,failureConsequence:'UNDETERMINED',unknownConsequence:'UNDETERMINED',unrecognizedConsequence:'UNDETERMINED',semanticAuthority:'AGENT'};
  for(const [key,value]of Object.entries(expected))assert.deepEqual(policy[key],value,'AUDIT_OUTCOME_PUBLICATION_ORACLE: '+collection+'.'+name+' '+key);
  assert.equal(typeof policy.positiveTokenRule,'string','AUDIT_OUTCOME_PUBLICATION_ORACLE: no epistemic rule was communicated.');for(const meaning of ['fact','evidence','scope','independent','contradiction','release'])assert(policy.positiveTokenRule.toLowerCase().includes(meaning),'AUDIT_OUTCOME_PUBLICATION_ORACLE: positive token rule omits '+meaning);
  expectedFields.push(collection+'.'+name);
 }
 if(prompt.operation!=='SEMANTIC_REVIEW')assert(prompt.prompt.includes('AUDIT COMPARISON STRING INTERPRETATION'),'AUDIT_OUTCOME_PUBLICATION_ORACLE: current author instruction lacks comparison guidance.');
 assert.equal(prompt.contractSha256,hash.sha256Value(r.copy(descriptor)),'AUDIT_OUTCOME_PUBLICATION_ORACLE: published interpretation is outside current contract identity.');
 assert.equal(manifest.promptIdentity.contractSha256,prompt.contractSha256,'AUDIT_OUTCOME_PUBLICATION_ORACLE: manifest does not bind current interpretation contract.');
 assert.equal(manifest.instruction.sha256,hash.sha256Text(prompt.prompt),'AUDIT_OUTCOME_PUBLICATION_ORACLE: manifest does not bind actual instruction bytes.');assert.equal(manifest.instruction.byteSize,Buffer.byteLength(prompt.prompt,'utf8'),'AUDIT_OUTCOME_PUBLICATION_ORACLE: instruction byte count is wrong.');
 auditComparisonPublicationEvidence.push({operation:prompt.operation,actualInstruction:prompt.prompt,actualDescriptor:descriptor,manifest});
 if(prompt.operation!=='SEMANTIC_REVIEW')publicationObservations.push({checkId:'S26-PUBLISHED-COMPARISON-'+prompt.operation,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:1045','specification/closed-loop-reliability-controlling-implementation-specification.txt:3557'],boundary:'actual reserved author instruction, final typed descriptor and manifest byte/contract identity',expected:{valueType:'STRING',enumValues:[],publishedFields:expectedFields,interpretationBound:true},observed:{valueType:'STRING',enumValues:[],publishedFields:expectedFields,interpretationBound:manifest.promptIdentity.contractSha256===hash.sha256Value(r.copy(descriptor)),instructionSha256:manifest.instruction.sha256,contractSha256:prompt.contractSha256},passed:true});
}

// Isolated scope/proposal boundary: prior-stage bodies are deliberately absent.
// This fixture proves independent review authority, not a complete journey.
const fixture=reservationScopeFixture({core,schema,engine:{...engine,refreshRecordHashes:(row,family)=>Object.assign(row,engine.refreshRecordHashes(r.copy(row),family))}},schema.STAGE_OPERATION_REGISTRY['26:COMPLETE']);
let p=r.copy(fixture.project);p.job.EXACT_USER_OBJECTIVE_VERBATIM='Review the two current audit bodies.';
for(const[key,field]of Object.entries({baselineId:'CURRENT_BASELINE_ID',productId:'CURRENT_PRODUCT_ID',productVersion:'CURRENT_PRODUCT_VERSION',deliveryCandidateSetId:'CURRENT_DELIVERY_CANDIDATE_SET_ID'}))if(fixture.scope[key])p.job[field]=fixture.scope[key];
const authorBase=engine.clone(p);
async function accept(operation,{reviewResult=null,fileFirst=false}={}){
 if(fileFirst){for(const record of p.projectData.generatedPrompts)if(!record.invalidatedBy)await r.store.persistPromptContextFiles(record,p);p=await r.store.writeProject(p,{expectedProjectRevision:0,createOnly:true});}
 const storedBaseRevision=fileFirst?p.revision:null;
 p.stages[25].status='COMPLETE';p.stages[25].gate=r.copy({complete:true,blocked:false,reasons:[]});
 const {prompt}=prompts.reserveAndBuildPromptRecord(p,26,{operation,scope:operation==='COMPLETE'?fixture.scope:{}});assertPublication(prompt);let envelope=responseFixture({schema,engine,prompt,manifest:prompts.promptFileManifest(prompt),instructionBytes:Buffer.from(prompt.prompt)});
 if(reviewResult)envelope.records.semanticReviews[0].fields.RESULT=reviewResult;
 if(fileFirst){
  for(const record of p.projectData.generatedPrompts)if(!record.invalidatedBy)await r.store.persistPromptContextFiles(record,p);
  p=await r.store.writeProject(p,{expectedProjectRevision:storedBaseRevision});
  const pkg=await r.store.createExecutionPackage({jobId:p.job.JOB_ID,stage:26,operation,instructionId:prompt.instructionId}),packageBytes=new Uint8Array(await pkg.blob.arrayBuffer()),members=readStoreArchive(packageBytes),member=path=>{const file=members.find(row=>row.canonicalPath===path);assert(file,'S26_RECONCILE_PACKAGE_MEMBER_ORACLE: '+path);return Buffer.from(file.bytes);};
  const manifest=JSON.parse(member('manifest.json').toString('utf8')),instructionBytes=member('instruction.txt'),contextFiles=manifest.contextFiles.map(file=>{const bytes=member(file.path);assert.equal(bytes.length,file.byteSize,'S26_RECONCILE_CONTEXT_BYTES_ORACLE');assert.equal(hash.sha256Text(bytes.toString('utf8')),file.sha256,'S26_RECONCILE_CONTEXT_BYTES_ORACLE');return {filename:file.path,bytes};});
  assert.equal(manifest.operation,'RECONCILE','S26_RECONCILE_PACKAGE_IDENTITY_ORACLE');assert.equal(manifest.promptIdentity.instructionId,prompt.instructionId,'S26_RECONCILE_PACKAGE_IDENTITY_ORACLE');assert.equal(manifest.operationReservationId,prompt.operationReservationId,'S26_RECONCILE_PACKAGE_IDENTITY_ORACLE');assert.equal(instructionBytes.toString('utf8'),prompt.prompt,'S26_RECONCILE_INSTRUCTION_BYTES_ORACLE');assert.equal(manifest.promptIdentity.contractSha256,prompt.contractSha256,'S26_RECONCILE_PACKAGE_IDENTITY_ORACLE');
  envelope=responseFixture({schema,engine,prompt,manifest,contextFiles,instructionBytes});
  const text=JSON.stringify(envelope),blob=new Blob([text],{type:'application/json'}),identity=envelope.promptIdentity,transport={packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce};
  const staged=await r.store.stageResponseFile({jobId:p.job.JOB_ID,stage:26,blob,rawFilename:'response.json',promptIdentity:r.copy(identity),...transport});
  const returned=await r.store.readStagedResponseFile({jobId:p.job.JOB_ID,stagingId:staged.stagingId});assert.equal(Buffer.from(returned.bytes).toString('utf8'),text,'S26_RECONCILE_RESPONSE_BYTES_ORACLE');
  Object.assign(transport,{authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,rawFilename:staged.rawFilename,status:staged.status,promptIdentity:staged.promptIdentity,sha256:staged.sha256,byteSize:staged.byteSize});
  const captured=ingestion.captureRaw(p,{stage:26,text,promptRecord:prompt,transport}),save=next=>r.store.writeProject(next,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
  p=await save(captured.project);const stagedProject=await r.store.readProject(p.job.JOB_ID);assert.equal(stagedProject.projectData.rawResponses.at(-1).completeRawResponse,text,'S26_RECONCILE_RESPONSE_RELOAD_ORACLE');
  const prepared=ingestion.prepareCaptured(p,{rawResponseId:captured.rawRecord.rawResponseId});assert.equal(prepared.validation.valid,true,'S26_RECONCILE_FILE_ADMISSION_ORACLE: '+JSON.stringify(prepared.validation.issues));
  p=await save(prepared.project);const impact=ingestion.acceptanceImpact(p,prepared.proposal.proposalId),committed=ingestion.commit(p,prepared.proposal.proposalId,{replacementConfirmation:impact});
  const storeImpact=r.store.mutationImpact(p,committed.project);assert.equal(storeImpact.requiresConfirmation,true,'S26_RECONCILE_REPLACEMENT_REVIEW_ORACLE');await assert.rejects(()=>r.store.writeProject(committed.project,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256}),error=>error.code==='MUTATION_CONFIRMATION_REQUIRED','S26_RECONCILE_REPLACEMENT_REVIEW_ORACLE');
  p=await r.store.writeProject(committed.project,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256,mutationConfirmation:storeImpact});const loaded=await r.store.readProject(p.job.JOB_ID);assert.deepEqual(r.copy(loaded.projectData),r.copy(p.projectData),'S26_RECONCILE_IMMEDIATE_STORAGE_ORACLE');p=loaded;return prompt;
 }
 const prepared=ingestion.prepare(p,{stage:26,text:JSON.stringify(envelope),promptRecord:prompt,transport:{packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce}});
 assert.equal(prepared.validation.valid,true,'AUDIT_REVIEW_FIXTURE_ORACLE: '+JSON.stringify(prepared.validation.issues));
 const impact=ingestion.acceptanceImpact(prepared.project,prepared.proposal.proposalId);p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{replacementConfirmation:impact}).project;return prompt;
}
const author=await accept('COMPLETE'),authored=engine.clone(p);
// Reconciliation publishes the same authoring contract without changing current
// accepted work merely to inspect an instruction.
const reconciliationProject=engine.clone(authored),reconciliationBefore=hash.sha256Value(r.copy({process:reconciliationProject.projectData.processAudits,product:reconciliationProject.projectData.productAudits}));
reconciliationProject.stages[25].status='COMPLETE';reconciliationProject.stages[25].gate=r.copy({complete:true,blocked:false,reasons:[]});
assertPublication(prompts.reserveAndBuildPromptRecord(reconciliationProject,26,{operation:'RECONCILE'}).prompt);
assert.equal(hash.sha256Value(r.copy({process:reconciliationProject.projectData.processAudits,product:reconciliationProject.projectData.productAudits})),reconciliationBefore,'AUDIT_RECONCILIATION_PUBLICATION_STATE_ORACLE: generating guidance replaced accepted audits.');
// Exercise accepted observations, not an enum mock or policy self-comparison.
// Evidence is synthetic and scoped; neither favorable tokens nor this isolated
// fixture constitute a complete project or real external audit.
const interpretationCases=[];
for(const [collection,field,value,expected]of [
 ['processAudits','APPROVED_INPUTS_VS_ACTUAL','  matched  ','SATISFIED'],
 ['processAudits','CHAIN_OF_CUSTODY','INTACT','SATISFIED'],
 ['productAudits','VALIDATOR_RESULTS','  satisfied  ','SATISFIED'],
 ['productAudits','VALIDATOR_RESULTS','INTACT','UNDETERMINED'],
 ['processAudits','APPROVED_INPUTS_VS_ACTUAL','UNKNOWN','UNDETERMINED'],
 ['processAudits','APPROVED_INPUTS_VS_ACTUAL','MISMATCH','UNDETERMINED'],
 ['processAudits','APPROVED_INPUTS_VS_ACTUAL','The actual inputs exactly match the approved inputs','UNDETERMINED'],
 ['productAudits','MEANING_VERIFICATION_RESULTS','UNKNOWN','UNDETERMINED'],
 ['productAudits','MEANING_VERIFICATION_RESULTS','MISMATCH','UNDETERMINED'],
 ['productAudits','MEANING_VERIFICATION_RESULTS','The observed product satisfies the required meaning','UNDETERMINED']
]){
 const q=engine.clone(authorBase);q.stages[25].status='COMPLETE';q.stages[25].gate=r.copy({complete:true,blocked:false,reasons:[]});
 const {prompt}=prompts.reserveAndBuildPromptRecord(q,26,{operation:'COMPLETE',scope:fixture.scope}),envelope=responseFixture({schema,engine,prompt,manifest:prompts.promptFileManifest(prompt),instructionBytes:Buffer.from(prompt.prompt)});envelope.records[collection][0].fields[field]=value;
 const prepared=ingestion.prepare(q,{stage:26,text:JSON.stringify(envelope),promptRecord:prompt,transport:{packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce}});
 assert.equal(prepared.validation.valid,true,'AUDIT_STRING_OBSERVATION_ORACLE: valid open observation was rejected '+JSON.stringify(prepared.validation.issues));const impact=ingestion.acceptanceImpact(prepared.project,prepared.proposal.proposalId),accepted=ingestion.commit(prepared.project,prepared.proposal.proposalId,{replacementConfirmation:impact}).project,audit=engine.recordsForCurrentScope(accepted,collection).at(-1),evaluation=engine.evaluateResultConsistency(collection,audit,null,accepted);
 assert.equal(engine.recordValue(audit,field),value,'AUDIT_STORED_OBSERVATION_ORACLE: adjudication normalization changed authored observation.');assert.equal(evaluation.determination,expected,'AUDIT_OUTCOME_INTERPRETATION_ORACLE: '+collection+'.'+field+' '+value+' '+JSON.stringify(evaluation));if(expected==='UNDETERMINED')assert(evaluation.reasons.some(reason=>reason.includes(field)),'AUDIT_UNKNOWN_REASON_ORACLE: unrecognized outcome failed for an unrelated reason.');
 assert.equal(engine.semanticReviewCompletion(accepted,26).complete,false,'AUDIT_POSITIVE_TOKEN_AUTHORITY_ORACLE: authored token replaced independent review.');interpretationCases.push({collection,field,value,validationValid:prepared.validation.valid,storedValue:engine.recordValue(audit,field),effectiveDetermination:evaluation.determination,reasons:evaluation.reasons,independentReviewComplete:false});
}
publicationObservations.push({checkId:'S26-PUBLISHED-POSITIVE-STRING-CONTROLS',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:3557'],boundary:'actual reserved response validation and canonical audit consequence',expected:{cases:3,storedObservationsUnchanged:true,independentReviewStillRequired:true},observed:{cases:interpretationCases.filter(row=>row.effectiveDetermination==='SATISFIED').length,storedObservationsUnchanged:interpretationCases.every(row=>row.value===row.storedValue),independentReviewStillRequired:interpretationCases.every(row=>row.independentReviewComplete===false)},passed:true});
publicationObservations.push({checkId:'S26-PUBLISHED-UNKNOWN-STRING-CONTROLS',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:3557'],boundary:'actual accepted adverse, unknown and unrecognized audit observation consequence; open STRING preserved',expected:{cases:7,effectiveDetermination:'UNDETERMINED'},observed:{cases:interpretationCases.filter(row=>row.effectiveDetermination==='UNDETERMINED').length,results:interpretationCases.filter(row=>row.effectiveDetermination==='UNDETERMINED')},passed:true});

assert.equal(engine.semanticReviewCompletion(p,26).complete,false,'AUDIT_REVIEW_ORACLE: authored audits bypass independent review');
assert.equal(engine.semanticReviewCompletion(p,26).reasons.some(reason=>reason.includes('independently bound')),true);
assert.equal(engine.operationalNextAction(p,26).operation,'SEMANTIC_REVIEW','Authored audits have no independent reviewer action');
const authorVersion=p.job.CURRENT_REVIEW_VERSION,reviewPrompt=await accept('SEMANTIC_REVIEW'),state=engine.semanticReviewCompletion(p,26);
assert.equal(state.complete,true,'AUDIT_CURRENT_REVIEW_ORACLE: independent current review did not complete');
assert.equal(p.job.CURRENT_REVIEW_VERSION,authorVersion,'Reviewer response changed authored audit version');
assert.deepEqual([...state.basis.targets.map(row=>row.collection)].sort(),['processAudits','productAudits']);
const review=state.reviews[0];assert.notEqual(review.AUTHOR_CONTEXT_ID,review.REVIEWER_CONTEXT_ID);assert.notEqual(review.AUTHOR_RESERVATION_ID,review.REVIEWER_RESERVATION_ID);assert.equal(review.AUTHOR_RESERVATION_ID,author.operationReservationId);assert.equal(review.REVIEWER_RESERVATION_ID,reviewPrompt.operationReservationId);
const verificationObservations=[...publicationObservations,{checkId:'S26-AUTHOR-REQUIRES-INDEPENDENT-REVIEW',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:2424'],boundary:'accepted authored process/product audits -> next reviewer action',expected:{accepted:false,nextOperation:'SEMANTIC_REVIEW'},observed:{accepted:engine.semanticReviewCompletion(authored,26).complete,nextOperation:engine.operationalNextAction(authored,26).operation},violation:'AUTHOR_SELF_APPROVAL',accepted:false,passed:true},{checkId:'S26-CURRENT-BOUND-INDEPENDENT-REVIEW',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:2424'],boundary:'reserved independent reviewer -> canonical review authority',expected:{accepted:true,targetCollections:['processAudits','productAudits'],authoredVersionPreserved:true},observed:{accepted:state.complete,targetCollections:state.basis.targets.map(row=>row.collection).sort(),authoredVersionPreserved:p.job.CURRENT_REVIEW_VERSION===authorVersion,reviewId:review.id,authorReservationId:review.AUTHOR_RESERVATION_ID,reviewerReservationId:review.REVIEWER_RESERVATION_ID},passed:true}];
for(const violation of['MISSING_REVIEW','STALE_AUDIT','STALE_AUDIT_EVIDENCE','MISSING_REVIEW_EVIDENCE','REUSED_AUTHOR_CONTEXT','REUSED_AUTHOR_RESERVATION','UNRESOLVED_REVIEW_FINDING']){
 const q=engine.clone(p),row=q.projectData.semanticReviews.find(row=>row.id===review.id);
 if(violation==='MISSING_REVIEW')row.active=false;
 if(violation==='STALE_AUDIT'){const audit=q.projectData.processAudits.at(-1);audit.fields.PROCESS_EVIDENCE+=' Changed substantive evidence.';audit.PROCESS_EVIDENCE=audit.fields.PROCESS_EVIDENCE;engine.refreshRecordHashes(audit,'processAudits');}
 if(violation==='STALE_AUDIT_EVIDENCE'){const audit=q.projectData.processAudits.at(-1);audit.evidenceRefs=[];engine.refreshRecordHashes(audit,'processAudits');}
 if(violation==='MISSING_REVIEW_EVIDENCE')for(const evidence of q.projectData.evidenceRecords.filter(evidence=>row.evidenceRefs.includes(evidence.id)))evidence.active=false;
 if(violation==='REUSED_AUTHOR_CONTEXT')row.fields.REVIEWER_CONTEXT_ID=row.REVIEWER_CONTEXT_ID=row.AUTHOR_CONTEXT_ID;
 if(violation==='REUSED_AUTHOR_RESERVATION')row.fields.REVIEWER_RESERVATION_ID=row.REVIEWER_RESERVATION_ID=row.AUTHOR_RESERVATION_ID;
 if(violation==='UNRESOLVED_REVIEW_FINDING')row.fields.RESULT=row.RESULT='UNKNOWN';
 if(violation==='UNRESOLVED_REVIEW_FINDING')assert.equal(engine.operationalNextAction(q,26).operation,'RECONCILE','An unresolved audit review has no distinct reconciliation route');
 const observed=engine.semanticReviewCompletion(q,26);assert.equal(observed.complete,false,'AUDIT_REVIEW_ORACLE: accepted '+violation);
 verificationObservations.push({checkId:'S26-'+violation,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:2424'],boundary:'current independent review -> audit progression authority',expected:{accepted:false},observed:{accepted:observed.complete,reasons:observed.reasons},violation,accepted:false,passed:true});
}

// Proposed bounded operation coverage: actual accepted adverse review ->
// distinct authoring reconciliation -> fresh independent review. Synthetic
// scope prerequisites do not establish the complete prior-stage journey.
const reconciliationOperationCases=[];
{
 const retained=p;
 try{
  p=engine.clone(authored);
  const unknownReview=await accept('SEMANTIC_REVIEW',{reviewResult:'UNKNOWN'});
  assert.equal(engine.semanticReviewCompletion(p,26).complete,false,'S26_RECONCILE_UNKNOWN_ORACLE');
  assert.equal(engine.operationalNextAction(p,26).operation,'RECONCILE','S26_RECONCILE_ROUTE_ORACLE');
  const priorAudits=r.copy([...p.projectData.processAudits,...p.projectData.productAudits]),priorRawRows=r.copy(p.projectData.rawResponses).map(row=>({rawResponseId:row.rawResponseId,completeRawResponse:row.completeRawResponse}));
  const reconciliation=await accept('RECONCILE',{fileFirst:true});
  assert.notEqual(reconciliation.operationReservationId,author.operationReservationId,'S26_RECONCILER_DISTINCT_ORACLE');
  assert.notEqual(reconciliation.operationReservationId,unknownReview.operationReservationId,'S26_RECONCILER_DISTINCT_ORACLE');
  assert.equal(engine.semanticReviewCompletion(p,26).complete,false,'S26_RECONCILE_NOT_SELF_APPROVAL_ORACLE');
  assert.equal(engine.operationalNextAction(p,26).operation,'SEMANTIC_REVIEW','S26_RECONCILE_NEW_REVIEW_ORACLE');
  const reconcileChange=engine.acceptedChanges(p,26).find(row=>row.operation==='RECONCILE');
  assert(reconcileChange,'S26_RECONCILE_EXACT_ADMISSION_ORACLE');
  for(const prior of priorAudits){const current=[...p.projectData.processAudits,...p.projectData.productAudits].find(row=>row.id===prior.id);assert(current,'S26_RECONCILE_HISTORY_RECORD_ORACLE');assert.equal(hash.sha256Value(r.copy(current.fields)),hash.sha256Value(r.copy(prior.fields)),'S26_RECONCILE_HISTORY_RECORD_ORACLE');assert.deepEqual(r.copy(current.evidenceRefs),r.copy(prior.evidenceRefs),'S26_RECONCILE_HISTORY_EVIDENCE_ORACLE');}
  for(const prior of priorRawRows)assert.equal(p.projectData.rawResponses.find(row=>row.rawResponseId===prior.rawResponseId)?.completeRawResponse,prior.completeRawResponse,'S26_RECONCILE_RAW_HISTORY_ORACLE');
  const reconciliationRaw=p.projectData.rawResponses.find(row=>row.rawResponseId===reconcileChange.rawResponseId)?.completeRawResponse;assert.equal(JSON.parse(reconciliationRaw).operation,'RECONCILE','S26_RECONCILE_RAW_IDENTITY_ORACLE');
  const nextReview=await accept('SEMANTIC_REVIEW'),reviewedState=engine.semanticReviewCompletion(p,26);
  assert.equal(reviewedState.complete,true,'S26_RECONCILE_FRESH_REVIEW_ORACLE');
  assert.notEqual(nextReview.operationReservationId,unknownReview.operationReservationId,'S26_RECONCILE_REVIEW_CONTEXT_ORACLE');
  assert.equal(reviewedState.reviews.at(-1).AUTHOR_RESERVATION_ID,reconciliation.operationReservationId,'S26_RECONCILE_NEW_AUTHOR_BINDING_ORACLE');
  for(const promptRecord of p.projectData.generatedPrompts)if(!promptRecord.invalidatedBy)await r.store.persistPromptContextFiles(promptRecord,p);
  p=await r.store.writeProject(p);
  const loaded=await r.store.readProject(p.job.JOB_ID);
  assert.deepEqual(r.copy(loaded.projectData),r.copy(p.projectData),'S26_RECONCILE_STORAGE_ORACLE');
  assert.equal(engine.semanticReviewCompletion(loaded,26).complete,true,'S26_RECONCILE_RELOAD_REVIEW_ORACLE');
  reconciliationOperationCases.push({operation:'RECONCILE',boundary:'actual reserve -> saved ZIP instruction/manifest/context bytes -> staged strict JSON Blob -> read/rehashed bytes -> capture/operational save -> prepareCaptured -> operator commit -> immediate store/read -> fresh review -> store/read',requiredStructuredResponseSlots:prompts.promptFileManifest(reconciliation).attachmentSlots.filter(row=>row.required&&row.role==='STRUCTURED_RESPONSE').length,requiredOtherReturnedAttachmentSlots:prompts.promptFileManifest(reconciliation).attachmentSlots.filter(row=>row.required&&row.role!=='STRUCTURED_RESPONSE').length,actualExportedZipInstructionManifestAndContext:true,authoritativeResponseBlobStagedAndRehashed:true,immediateReconcileCommitStoreReload:true,responseBytes:Buffer.byteLength(reconciliationRaw,'utf8'),responseSha256:hash.sha256Text(reconciliationRaw),retainedRawHistory:true,retainedAuthoredFieldsAndEvidence:true,acceptedChangeId:reconcileChange.changeId,proposalId:reconcileChange.proposalId,reconciliationReservationId:reconciliation.operationReservationId,priorUnknownReservationId:unknownReview.operationReservationId,freshReviewReservationId:nextReview.operationReservationId,actualBrowser:false,realExternalActor:false,priorStagesEstablished:false});
 }finally{p=retained;}
}

const anchor='function semanticReviewCompletion(p,stage){',source=fs.readFileSync('workflow-engine.js','utf8');assert.equal(source.split(anchor).length-1,1);
const defective=projectStoreRuntime({sourceOverrides:{'workflow-engine.js':source.replace(anchor,anchor+"if(stage===26)return {complete:true,reasons:[],reviews:[],basis:null};")}}),counterexample=defective.copy(authored);
assert.throws(()=>assert.equal(defective.engine.semanticReviewCompletion(counterexample,26).complete,false,'AUDIT_REVIEW_ORACLE: controlled author bypass'),/AUDIT_REVIEW_ORACLE/);
verificationObservations.push({checkId:'S26-CONTROLLED-AUTHOR-BYPASS-DETECTED',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:2424'],boundary:'controlled former author-only approval -> independent boundary oracle',expected:{violationDetected:true},observed:{violationDetected:true,defectiveAccepted:true},passed:true});
console.log(JSON.stringify({stage26IndependentReview:'PASS',isolatedScopeFixture:true,completeJourneyProven:false,reconciliationOperationCases,verificationObservations,auditComparisonPublicationEvidence,interpretationCases},null,2));

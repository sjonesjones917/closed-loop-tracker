import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {testIrAuthorPrerequisite} from './test-test-ir-author-prerequisite.mjs';
import {authorizeFixtureHandoff} from './test-fixtures.mjs';
import {readStoreArchive} from './test-zip.mjs';
const INPUTS=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const sha=value=>createHash('sha256').update(value).digest('hex');
export async function prepareExpectedVarianceAuthor({sourceOverrides={}}={}){
 const sources=Object.fromEntries(INPUTS.map(file=>[file,sourceOverrides[file]??fs.readFileSync(file,'utf8')]));
 let r=projectStoreRuntime({sourceOverrides:sources,storageWorker:false});let {p:retained}=await testIrAuthorPrerequisite(r);
 const baseline={rawResponses:r.copy(retained.projectData.rawResponses),acceptedChanges:r.copy(retained.projectData.acceptedChanges),legacyContractCount:r.engine.recordsForCurrentScope(retained,'expectedVarianceContracts').length};
 assert.equal(baseline.legacyContractCount,0,'EXPECTED_VARIANCE_LEGACY_FIXTURE_BOUNDARY_ORACLE');
 const legacyWritten=await r.store.writeProject(retained,{createOnly:true,expectedProjectRevision:0,incrementRevision:false}),legacyRows=structuredClone(r.rows),legacyClock=r.runtime.Date;
 const cold=projectStoreRuntime({sourceOverrides:sources,storageWorker:false});cold.runtime.Date=legacyClock;for(const[name,rows]of legacyRows)cold.rows.set(name,structuredClone(rows));r=cold;
 retained=await r.store.readProject(legacyWritten.job.JOB_ID);const e=r.engine,activationEvents=retained.projectData.history.filter(event=>event.type==='EXPECTED_VARIANCE_CONTRACTS_ACTIVATED');
 assert.equal(activationEvents.length,1,'EXPECTED_VARIANCE_NAMED_COLD_ACTIVATION_ORACLE');const activation=activationEvents[0];
 assert.equal(activation.sourceProjectSha256,legacyWritten.projectSha256,'EXPECTED_VARIANCE_ACTIVATION_SOURCE_IDENTITY_ORACLE');assert.equal(activation.historicalFreezeClaimed,false,'EXPECTED_VARIANCE_NO_HISTORICAL_FREEZE_INVENTION_ORACLE');
 assert.equal(e.gate(6,retained).complete,true,'EXPECTED_VARIANCE_LEGACY_SUPPORTED_PROGRESS_ORACLE');
 for(const old of baseline.rawResponses)assert.equal(r.ingestion.findRaw(retained,old.rawResponseId).completeRawResponse,old.completeRawResponse,'EXPECTED_VARIANCE_LEGACY_RAW_UNCHANGED_ORACLE');
 for(const old of baseline.acceptedChanges)assert.deepEqual(JSON.parse(JSON.stringify(retained.projectData.acceptedChanges.find(row=>row.changeId===old.changeId))),JSON.parse(JSON.stringify(old)),'EXPECTED_VARIANCE_LEGACY_ACCEPTED_HISTORY_UNCHANGED_ORACLE');
 for(const test of e.recordsForCurrentScope(retained,'tests')){const state=e.expectedVarianceContractState(retained,test);assert.equal(state.complete,true,'EXPECTED_VARIANCE_LEGACY_SOURCE_BOUND_ORACLE '+JSON.stringify(state.reasons));assert.equal(value(r,state.record,'FROZEN_AT'),activation.deviceTimestamp,'EXPECTED_VARIANCE_LEGACY_ACTUAL_ACTIVATION_TIME_ORACLE');}
 baseline.gate6=e.gate(6,retained);baseline.activation={eventId:activation.eventId,recordCount:activation.records.length,sourceProjectSha256:activation.sourceProjectSha256,historicalFreezeClaimed:false};
 const accepted=e.acceptedChanges(retained,6).find(row=>row.operation==='COMPLETE');assert(accepted,'EXPECTED_VARIANCE_RETAINED_AUTHOR_ORACLE');
 const originalText=retained.projectData.rawResponses.find(row=>row.rawResponseId===accepted.rawResponseId)?.completeRawResponse;assert.equal(typeof originalText,'string');
 const beforeCorrection=r.copy(retained);e.invalidateAcceptedResponse(retained,{stage:6,rawResponseId:accepted.rawResponseId,reason:'Synthetic expected-variance contract correction regression',operatorLabel:'SYNTHETIC_OPERATOR'});
 retained.activeStage=6;let p=await r.store.writeProject(retained,{expectedProjectRevision:retained.revision,expectedStateSha256:retained.projectSha256,mutationConfirmation:r.store.mutationImpact(beforeCorrection,retained)});
 const draft=r.copy(p),issued=r.prompts.reserveAndBuildPromptRecord(draft,6,{operation:'COMPLETE'}).prompt;
 p=await r.store.writeProject(draft,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 const authorized=await authorizeFixtureHandoff(r,{project:p,prompt:p.projectData.generatedPrompts.find(row=>row.instructionId===issued.instructionId)}),pkg=await r.store.createExecutionPackage(authorized.request),packageBytes=new Uint8Array(await pkg.blob.arrayBuffer()),members=readStoreArchive(packageBytes),manifest=JSON.parse(Buffer.from(members.find(row=>row.canonicalPath==='manifest.json').bytes));
 const declared=manifest.responseContract?.expectedVarianceContract,instruction=Buffer.from(members.find(row=>row.canonicalPath==='instruction.txt').bytes).toString('utf8');
 assert.deepEqual(declared?.directInput?.relationship,{TEST_ID:'tests'},'EXPECTED_VARIANCE_PUBLISHED_TYPED_MEMBERSHIP_ORACLE');
 assert.deepEqual(declared?.outputFields,['TEST_ID','NORMALIZED_CONTRACT','FROZEN_AT','SCOPE','CONTRACT_SHA256','STATUS'],'EXPECTED_VARIANCE_PUBLISHED_APPLICATION_FIELDS_ORACLE');
 assert.deepEqual(declared?.embeddedInput?.required,{dimensions:'nonempty STRING_ARRAY',allowedVariance:'nonempty STRING'},'EXPECTED_VARIANCE_PUBLISHED_INPUT_SHAPE_ORACLE');
 assert.match(instruction,/EXPECTED VARIANCE CONTRACT — DECLARED AUTHORING AND APPLICATION FREEZE/,'EXPECTED_VARIANCE_INSTRUCTION_PUBLICATION_ORACLE');
 assert.match(instruction,/UNKNOWN or unsupported variance cannot be treated as an allowed difference/,'EXPECTED_VARIANCE_NO_UNKNOWN_APPROVAL_INSTRUCTION_ORACLE');
 const envelope=JSON.parse(originalText);Object.assign(envelope,{humanAuthorityCandidates:[],promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:manifest.scope});
 for(const row of envelope.records.tests||[])if(row.fields?.EXECUTABLE_SPEC?.languageVersion)row.fields.EXECUTABLE_SPEC.operationRegistrySha256=r.runtime.closedLoopTestRuntime.authoringContract().operationRegistrySha256;
 const rowSnapshot=structuredClone(r.rows),projectSnapshot=r.copy(authorized.project),promptSnapshot=r.copy(authorized.prompt),runtimeDate=r.runtime.Date;
 const isolated=()=>{const n=projectStoreRuntime({sourceOverrides:sources,storageWorker:false});n.runtime.Date=runtimeDate;for(const[name,rows]of rowSnapshot)n.rows.set(name,structuredClone(rows));return {r:n,project:n.copy(projectSnapshot),prompt:n.copy(promptSnapshot),envelope:structuredClone(envelope)};};
 return {baseline,sources,originalAuthorEnvelope:structuredClone(envelope),sourceSha256:Object.fromEntries(Object.entries(sources).map(([file,source])=>[file,sha(source)])),fixtureSha256:sha(fs.readFileSync('verification/deferred-definition-compatibility-legacy-fixture-20261005.json')),manifest,packageBytes,members,isolated};
}
export async function stageExpectedVarianceResponse(h,{mutate=()=>{},persist=false,accept=false}={}){
 const {r,project,prompt,envelope}=h.isolated();mutate(envelope,r,project);const text=JSON.stringify(envelope),m=h.manifest;
 const staged=await r.store.stageResponseFile({jobId:project.job.JOB_ID,stage:6,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:m.promptIdentity,packageId:m.packageId,operationReservationId:m.operationReservationId,challengeNonce:m.challengeNonce}),file=await r.store.readStagedResponseFile({jobId:project.job.JOB_ID,stagingId:staged.stagingId});
 const captured=r.ingestion.captureRaw(project,{stage:6,text,promptRecord:prompt,transport:r.copy({authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,status:file.status,sha256:file.sha256,byteSize:file.byteSize,promptIdentity:m.promptIdentity,packageId:m.packageId,operationReservationId:m.operationReservationId,challengeNonce:m.challengeNonce})}),prepared=r.ingestion.prepareCaptured(captured.project,{rawResponseId:captured.rawRecord.rawResponseId});
 let next=prepared.project,saved=null,loaded=null;
 if(accept){try{assert.equal(prepared.validation.valid,true,'EXPECTED_VARIANCE_VALID_CONTROL_ADMISSION_ORACLE '+JSON.stringify(prepared.validation.issues));}catch(error){error.varianceFixtureContext={synthetic:true,actualBrowser:false,archivedClockUtc:new r.runtime.Date().toISOString(),project:prepared.project,prompt,envelope,manifest:h.manifest,validation:prepared.validation,sourceSha256:h.sourceSha256};throw error;}assert(prepared.proposal);next=r.ingestion.commit(next,prepared.proposal.proposalId,{operator:'SYNTHETIC_VARIANCE_OPERATOR',replacementConfirmation:r.ingestion.acceptanceImpact(next,prepared.proposal.proposalId)}).project;}
 if(persist||accept){saved=await r.store.writeProject(next,{expectedProjectRevision:project.revision,expectedStateSha256:project.projectSha256,mutationConfirmation:r.store.mutationImpact(project,next)});loaded=await r.store.readProject(saved.job.JOB_ID);assert.equal(r.ingestion.findRaw(loaded,captured.rawRecord.rawResponseId).completeRawResponse,text,'EXPECTED_VARIANCE_RAW_ROUNDTRIP_ORACLE');for(const old of h.baseline.rawResponses){const retained=r.ingestion.findRaw(loaded,old.rawResponseId);assert(retained,'EXPECTED_VARIANCE_PRIOR_RAW_PRESERVATION_ORACLE');assert.equal(retained.completeRawResponse,old.completeRawResponse,'EXPECTED_VARIANCE_PRIOR_BYTES_PRESERVATION_ORACLE');}}
 return {r,project,prompt,envelope,text,staged,file,captured,prepared,saved,loaded,current:loaded||next};
}

const LITERAL_NESTED={dimensions:['requirement-truth'],allowedVariance:'No variance in requirement truth.'};
export function verifyExpectedVarianceNormalizer(r){
 const s=r.runtime.closedLoopWorkflowSchema,normalize=s.normalizeExpectedVarianceContract;
 assert.equal(typeof normalize,'function','EXPECTED_VARIANCE_NORMALIZER_OWNER_ORACLE');
 const positive=[
  {id:'nested-literal',input:LITERAL_NESTED,expected:LITERAL_NESTED},
  {id:'direct-literal',form:'CANONICAL_FIELDS',input:{DIMENSIONS:['requirement-truth'],ALLOWED_VARIANCE:'No variance in requirement truth.'},expected:LITERAL_NESTED},
  {id:'optional-rationale-preserved',input:{...LITERAL_NESTED,rationale:'Exact declared requirement.'},expected:{...LITERAL_NESTED,rationale:'Exact declared requirement.'}},
  {id:'extensions-and-order-preserved',input:{dimensions:['z','z',' a '],allowedVariance:'  No change.  ',vendorExtension:{label:'λ😀',value:null,nested:[0,false,'x']}},expected:{dimensions:['z','z',' a '],allowedVariance:'  No change.  ',vendorExtension:{label:'λ😀',value:null,nested:[0,false,'x']}}},
  {id:'unresolved-text-not-elevated',input:{dimensions:['requirement-truth'],allowedVariance:'UNKNOWN'},expected:{dimensions:['requirement-truth'],allowedVariance:'UNKNOWN'}}
 ],negative=[
  {id:'null-contract',input:null},
  {id:'array-contract',input:[]},
  {id:'missing-dimensions',input:{allowedVariance:'NONE'}},
  {id:'empty-dimensions',input:{dimensions:[],allowedVariance:'NONE'}},
  {id:'wrong-dimensions',input:{dimensions:'bytes',allowedVariance:'NONE'}},
  {id:'wrong-dimension-member',input:{dimensions:['bytes',null],allowedVariance:'NONE'}},
  {id:'empty-dimension-member',input:{dimensions:[' '],allowedVariance:'NONE'}},
  {id:'missing-allowed-variance',input:{dimensions:['bytes']}},
  {id:'blank-allowed-variance',input:{dimensions:['bytes'],allowedVariance:' '}},
  {id:'wrong-allowed-variance',input:{dimensions:['bytes'],allowedVariance:false}},
  {id:'null-rationale',input:{...LITERAL_NESTED,rationale:null}},
  {id:'unknown-source-form',form:'UNKNOWN',input:LITERAL_NESTED}
 ];
 // Source insertion A defines blank using exactly U+0009–000D and U+0020.
 // Unicode whitespace outside that set is meaningful and must survive both forms.
 for(const character of ['\u0085','\u00a0','\u1680','\u2000','\u2001','\u2002','\u2003','\u2004','\u2005','\u2006','\u2007','\u2008','\u2009','\u200a','\u2028','\u2029','\u202f','\u205f','\u3000','\ufeff']){
  const expected={dimensions:[character,' '+character+' ',character],allowedVariance:character,rationale:''},id=character.codePointAt(0).toString(16);
  positive.push({id:'ascii-nonblank-embedded-'+id,input:expected,expected});
  positive.push({id:'ascii-nonblank-direct-'+id,form:'CANONICAL_FIELDS',input:{DIMENSIONS:expected.dimensions,ALLOWED_VARIANCE:character,RATIONALE:''},expected});
 }
 for(const blank of ['', '\t','\n','\v','\f','\r',' ',' \t\n\v\f\r '])for(const form of ['EMBEDDED','CANONICAL_FIELDS']){
  negative.push({id:'ascii-blank-dimension-'+form+'-'+JSON.stringify(blank),form,input:form==='EMBEDDED'?{dimensions:[blank],allowedVariance:'NONE'}:{DIMENSIONS:[blank],ALLOWED_VARIANCE:'NONE'}});
  negative.push({id:'ascii-blank-variance-'+form+'-'+JSON.stringify(blank),form,input:form==='EMBEDDED'?{dimensions:['bytes'],allowedVariance:blank}:{DIMENSIONS:['bytes'],ALLOWED_VARIANCE:blank}});
 }
 const cases=[];
 for(const t of positive){const result=normalize(r.copy(t.input),{form:t.form||'EMBEDDED'});assert.equal(result.valid,true,'EXPECTED_VARIANCE_NORMALIZATION_POSITIVE_ORACLE '+t.id);assert.deepEqual(JSON.parse(JSON.stringify(result.normalized)),t.expected,'EXPECTED_VARIANCE_LOSSLESS_NORMALIZATION_ORACLE '+t.id);if(!Object.hasOwn(t.expected,'rationale'))assert.equal(Object.hasOwn(result.normalized,'rationale'),false,'EXPECTED_VARIANCE_NO_INVENTED_RATIONALE_ORACLE');cases.push({id:t.id,expected:'VALID_EXACT_NORMALIZED',result:'PASS'});}
 for(const t of negative){const result=normalize(r.copy(t.input),{form:t.form||'EMBEDDED'});assert.equal(result.valid,false,'EXPECTED_VARIANCE_NORMALIZATION_NEGATIVE_ORACLE '+t.id);assert.equal(result.normalized,null,'EXPECTED_VARIANCE_NO_INVALID_NORMALIZATION_ORACLE '+t.id);assert(result.issues.length,'EXPECTED_VARIANCE_DIAGNOSTIC_ORACLE '+t.id);cases.push({id:t.id,expected:'INVALID_WITH_DIAGNOSTIC',result:'PASS'});}
 return {caseCount:cases.length,cases,result:'PASS'};
}
const value=(r,row,key)=>r.engine.recordValue(row,key);
const perRun=envelope=>{const test=envelope.records.tests.find(row=>row.fields.PER_RUN_REQUIRED===true);assert(test?.tempKey,'EXPECTED_VARIANCE_DUE_TEST_FIXTURE_ORACLE');return test;};
const directFor=(test,envelope)=>({tempKey:'typed-variance-contract',fields:{DIMENSIONS:['requirement-truth'],ALLOWED_VARIANCE:'No variance in requirement truth.'},relationships:{TEST_ID:{tempKey:test.tempKey}},evidenceRefs:[envelope.evidence[0].temporaryKey]});
function assertIndependentReviewPending(result){
 const gate=result.r.engine.gate(6,result.current);
 assert.equal(gate.complete,false,'EXPECTED_VARIANCE_AUTHOR_CANNOT_COMPLETE_ORACLE');
 assert(gate.reasons.some(reason=>reason.includes('INDEPENDENT_PROOF_REVIEW_REQUIRED')),'EXPECTED_VARIANCE_INDEPENDENT_PROOF_REVIEW_PRESERVED_ORACLE '+JSON.stringify(gate.reasons));
 return gate;
}
function assertFrozenContract(result,expected,{direct=false}={}){
 const {r,current,prepared,envelope}=result,testKey=perRun(envelope).tempKey,testId=prepared.proposal.tempToCanonical[testKey].id,test=r.engine.recordsForCurrentScope(current,'tests').find(row=>row.id===testId);
 assert(test,'EXPECTED_VARIANCE_CANONICAL_TEST_ORACLE');
 const rows=r.engine.recordsForCurrentScope(current,'expectedVarianceContracts').filter(row=>value(r,row,'TEST_ID')===testId);
 assert.equal(rows.length,1,'EXPECTED_VARIANCE_UNIQUE_MEMBERSHIP_ORACLE');
 const row=rows[0],normalized=JSON.parse(JSON.stringify(value(r,row,'NORMALIZED_CONTRACT')));
 assert.deepEqual(normalized,expected,'EXPECTED_VARIANCE_EXPECTED_SEMANTICS_ORACLE');
 if(!Object.hasOwn(expected,'rationale'))assert.equal(Object.hasOwn(normalized,'rationale'),false,'EXPECTED_VARIANCE_NO_INVENTED_RATIONALE_ORACLE');
 assert.match(value(r,row,'CONTRACT_SHA256'),/^[a-f0-9]{64}$/,'EXPECTED_VARIANCE_DIGEST_ORACLE');
 assert.equal(value(r,row,'FROZEN_AT'),prepared.validation.createdAt,'EXPECTED_VARIANCE_ACTUAL_VALIDATION_TIME_ORACLE');
 assert.equal(value(r,row,'STATUS'),'FROZEN','EXPECTED_VARIANCE_FREEZE_IS_NOT_APPROVAL_ORACLE');
 assert.equal(row.varianceSource.rawResponseId,result.captured.rawRecord.rawResponseId,'EXPECTED_VARIANCE_RAW_BINDING_ORACLE');
 assert.equal(row.varianceSource.validationId,prepared.validation.validationId,'EXPECTED_VARIANCE_VALIDATION_BINDING_ORACLE');
 assert.equal(row.relationships.TEST_ID,testId,'EXPECTED_VARIANCE_TYPED_MEMBERSHIP_ORACLE');
 assert.equal(row.source==='APPLICATION_VARIANCE_MATERIALIZATION',!direct,'EXPECTED_VARIANCE_SOURCE_FORM_ORACLE');
 const state=r.engine.expectedVarianceContractState(current,test);
 assert.equal(state.complete,true,'EXPECTED_VARIANCE_CURRENT_SOURCE_BINDING_ORACLE '+JSON.stringify(state.reasons));
 assert.equal(state.record.id,row.id,'EXPECTED_VARIANCE_CURRENT_SELECTION_ORACLE');
 assert.deepEqual(JSON.parse(JSON.stringify(state.normalized)),expected,'EXPECTED_VARIANCE_STATE_SEMANTICS_ORACLE');
 assert.equal(r.engine.expectedVarianceContractDigest(current,test),value(r,row,'CONTRACT_SHA256'),'EXPECTED_VARIANCE_CONSUMER_DIGEST_ORACLE');
 assertIndependentReviewPending(result);
 return {row,test,testId};
}
async function submitRetainedVarianceUpdate(h,authorResult,{direct}){
 const original=authorResult.r,rows=structuredClone(original.rows),r=projectStoreRuntime({sourceOverrides:h.sources,storageWorker:false});r.runtime.Date=original.runtime.Date;for(const[name,entries]of rows)r.rows.set(name,structuredClone(entries));
 const project=await r.store.readProject(authorResult.current.job.JOB_ID),priorContracts=r.copy(r.engine.recordsForCurrentScope(project,'expectedVarianceContracts')),priorTests=r.copy(r.engine.recordsForCurrentScope(project,'tests')),draft=r.copy(project),issued=r.prompts.reserveAndBuildPromptRecord(draft,6,{operation:'COMPLETE'}).prompt,saved=await r.store.writeProject(draft,{expectedProjectRevision:project.revision,expectedStateSha256:project.projectSha256}),authorized=await authorizeFixtureHandoff(r,{project:saved,prompt:saved.projectData.generatedPrompts.find(row=>row.instructionId===issued.instructionId)}),pkg=await r.store.createExecutionPackage(authorized.request),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),manifest=JSON.parse(Buffer.from(members.find(row=>row.canonicalPath==='manifest.json').bytes)),envelope=structuredClone(h.originalAuthorEnvelope);
 Object.assign(envelope,{humanAuthorityCandidates:[],promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:manifest.scope,stageData:{},records:{},evidence:structuredClone(h.originalAuthorEnvelope.evidence)});
 if(direct)envelope.records.expectedVarianceContracts=priorTests.map((test,index)=>({tempKey:'retained-contract-'+index,fields:{DIMENSIONS:['requirement-truth'],ALLOWED_VARIANCE:'No variance in requirement truth.'},relationships:{TEST_ID:{recordId:test.id}},evidenceRefs:[envelope.evidence[0].temporaryKey]}));
 else {envelope.records.proofExpressions=structuredClone(h.originalAuthorEnvelope.records.proofExpressions);for(const row of envelope.records.proofExpressions){const key=row.fields.PROPOSED_EXPRESSION.testId.tempKey;assert(authorResult.prepared.proposal.tempToCanonical[key]?.id,'EXPECTED_VARIANCE_SPARSE_TARGET_FIXTURE_ORACLE');row.fields.PROPOSED_EXPRESSION.testId={recordId:authorResult.prepared.proposal.tempToCanonical[key].id};}}
 const result=await stageExpectedVarianceResponse({...h,manifest,isolated:()=>({r,project:r.copy(authorized.project),prompt:r.copy(authorized.prompt),envelope:structuredClone(envelope)})},{accept:true});
 assert.deepEqual(r.engine.recordsForCurrentScope(result.current,'tests').map(row=>row.id).sort(),priorTests.map(row=>row.id).sort(),'EXPECTED_VARIANCE_RETAINED_TEST_MEMBERSHIP_ORACLE');
 for(const test of r.engine.recordsForCurrentScope(result.current,'tests')){const state=r.engine.expectedVarianceContractState(result.current,test);assert.equal(state.complete,true,'EXPECTED_VARIANCE_RETAINED_CURRENT_BINDING_ORACLE '+JSON.stringify(state.reasons));assert.deepEqual(JSON.parse(JSON.stringify(state.normalized)),LITERAL_NESTED,'EXPECTED_VARIANCE_RETAINED_EXACT_VALUE_ORACLE');}
 for(const old of priorContracts){const preserved=r.engine.records(result.current,'expectedVarianceContracts',{active:false}).find(row=>row.id===old.id);assert(preserved,'EXPECTED_VARIANCE_REBIND_OLD_HISTORY_PRESERVED_ORACLE');assert.deepEqual(JSON.parse(JSON.stringify(value(r,preserved,'NORMALIZED_CONTRACT'))),JSON.parse(JSON.stringify(value(r,old,'NORMALIZED_CONTRACT'))),'EXPECTED_VARIANCE_REBIND_OLD_MEANING_UNCHANGED_ORACLE');assert.equal(value(r,preserved,'FROZEN_AT'),value(r,old,'FROZEN_AT'),'EXPECTED_VARIANCE_REBIND_OLD_FREEZE_UNCHANGED_ORACLE');}
 assertIndependentReviewPending(result);
 return result;
}
async function acceptIndependentVarianceProofReview(h,authorResult){
 const r=authorResult.r,project=authorResult.current,prior=h.baseline.acceptedChanges.find(row=>Number(row.stage)===6&&row.operation==='PROOF_REVIEW');assert(prior,'EXPECTED_VARIANCE_RETAINED_REVIEW_BYTES_ORACLE');
 const raw=h.baseline.rawResponses.find(row=>row.rawResponseId===prior.rawResponseId);assert.equal(typeof raw?.completeRawResponse,'string','EXPECTED_VARIANCE_REVIEW_RESPONSE_BYTES_ORACLE');
 const draft=r.copy(project),issued=r.prompts.reserveAndBuildPromptRecord(draft,6,{operation:'PROOF_REVIEW'}).prompt,saved=await r.store.writeProject(draft,{expectedProjectRevision:project.revision,expectedStateSha256:project.projectSha256}),authorized=await authorizeFixtureHandoff(r,{project:saved,prompt:saved.projectData.generatedPrompts.find(row=>row.instructionId===issued.instructionId)}),pkg=await r.store.createExecutionPackage(authorized.request),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),manifest=JSON.parse(Buffer.from(members.find(row=>row.canonicalPath==='manifest.json').bytes)),envelope=JSON.parse(raw.completeRawResponse);
 Object.assign(envelope,{humanAuthorityCandidates:[],promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:manifest.scope});
 const result=await stageExpectedVarianceResponse({...h,manifest,isolated:()=>({r,project:r.copy(authorized.project),prompt:r.copy(authorized.prompt),envelope:structuredClone(envelope)})},{accept:true});
 const gate=r.engine.gate(6,result.current);assert.equal(gate.complete,true,'EXPECTED_VARIANCE_VALID_REVIEWED_PROGRESS_ORACLE '+JSON.stringify(gate.reasons));
 return result;
}
export async function verifyExpectedVarianceContract({sourceOverrides={},report=false,onProgress=null,onlyCases=null}={}){
 const startedAt=new Date().toISOString(),started=performance.now(),h=await prepareExpectedVarianceAuthor({sourceOverrides}),normalization=verifyExpectedVarianceNormalizer(h.isolated().r),cases=[{id:'retained-completed-six-compatibility',expected:'NAMED_COLD_ACTIVATION_CURRENT_COMPLETE',activation:h.baseline.activation,rawPreserved:true,acceptedHistoryUnchanged:true,boundary:'transaction-adapter-save/cold-read/named-activation/gate',result:'PASS'}];
 const selected=id=>onlyCases===null||onlyCases.includes(id),requiresStoredControl=onlyCases===null||onlyCases.some(id=>['direct-retained-current-test-set','sparse-stage6-retains-contract-bindings','tampered-normalized-contract','tampered-contract-hash','tampered-freeze-time','stale-freeze-scope','changed-authored-source'].includes(id));
 const recordCase=entry=>{cases.push(entry);onProgress?.({completedCases:cases.length,...entry});};onProgress?.({completedCases:1,...cases[0]});
 recordCase({id:'exported-producer-contract',expected:'EXACT_TYPED_SOURCE_AND_OUTPUT_RULES_PUBLISHED',boundary:'actual-saved-execution-ZIP/instruction/manifest',result:'PASS'});
 const positives=[
  {id:'nested-author-normalized-stored',expected:LITERAL_NESTED,mutate:()=>{}},
  {id:'nested-extension-preserved',expected:{...LITERAL_NESTED,extension:{label:'λ😀',values:[false,0,null,' exact ']}},mutate:envelope=>{perRun(envelope).fields.EXPECTED_VARIANCE_CONTRACT={...LITERAL_NESTED,extension:{label:'λ😀',values:[false,0,null,' exact ']}};}},
  {id:'ascii-nonblank-nested-stored',expected:{dimensions:['\u00a0','\u2003','\ufeff'],allowedVariance:'\u00a0',rationale:''},mutate:envelope=>{perRun(envelope).fields.EXPECTED_VARIANCE_CONTRACT={dimensions:['\u00a0','\u2003','\ufeff'],allowedVariance:'\u00a0',rationale:''};}},
  {id:'ascii-nonblank-direct-stored',direct:true,expected:{dimensions:['\u00a0','\u2003','\ufeff'],allowedVariance:'\u00a0',rationale:''},mutate:envelope=>{const test=perRun(envelope);delete test.fields.EXPECTED_VARIANCE_CONTRACT;const row=directFor(test,envelope);Object.assign(row.fields,{DIMENSIONS:['\u00a0','\u2003','\ufeff'],ALLOWED_VARIANCE:'\u00a0',RATIONALE:''});envelope.records.expectedVarianceContracts=[row];}},
  {id:'direct-typed-author-normalized-stored',direct:true,expected:LITERAL_NESTED,mutate:envelope=>{const test=perRun(envelope);delete test.fields.EXPECTED_VARIANCE_CONTRACT;envelope.records.expectedVarianceContracts=[directFor(test,envelope)];}},
  {id:'matching-nested-direct-single-contract',direct:true,expected:LITERAL_NESTED,mutate:envelope=>{envelope.records.expectedVarianceContracts=[directFor(perRun(envelope),envelope)];}}
 ];
 let storedControl=null;
 for(const testCase of positives.filter(row=>selected(row.id)||row.id==='nested-author-normalized-stored'&&requiresStoredControl||row.id==='direct-typed-author-normalized-stored'&&selected('direct-contract-independent-review-progress'))){const result=await stageExpectedVarianceResponse(h,{mutate:testCase.mutate,accept:true});assertFrozenContract(result,testCase.expected,{direct:testCase.direct});if(testCase.id==='nested-author-normalized-stored')storedControl=result;if(testCase.id==='direct-typed-author-normalized-stored'&&selected('direct-contract-independent-review-progress')){await acceptIndependentVarianceProofReview(h,result);recordCase({id:'direct-contract-independent-review-progress',expected:'FRESH_REVIEWED_STAGE6_COMPLETE',rawPreserved:true,boundary:'fresh-review-package/staged-response/admission/acceptance/transaction-adapter-save-reload/gate',result:'PASS'});}recordCase({id:testCase.id,expected:'ACCEPTED_STORED_SOURCE_BOUND_INDEPENDENT_REVIEW_PENDING',rawPreserved:true,boundary:'saved-package/staged-response/admission/acceptance/transaction-adapter-save-reload',result:'PASS'});}
 const negatives=[
  {id:'conflicting-nested-direct',code:'INVALID_EXPECTED_VARIANCE_BINDING',mutate:envelope=>{const row=directFor(perRun(envelope),envelope);row.fields.ALLOWED_VARIANCE='A different authored contract.';envelope.records.expectedVarianceContracts=[row];}},
  {id:'duplicate-direct-membership',code:'INVALID_EXPECTED_VARIANCE_BINDING',mutate:envelope=>{const row=directFor(perRun(envelope),envelope);envelope.records.expectedVarianceContracts=[row,{...structuredClone(row),tempKey:'duplicate-variance-contract'}];}},
  {id:'missing-direct-membership',code:'MISSING_EXPECTED_VARIANCE_TEST',mutate:envelope=>{const row=directFor(perRun(envelope),envelope);row.relationships={};envelope.records.expectedVarianceContracts=[row];}},
  {id:'wrong-family-direct-membership',expectedPath:'/records/expectedVarianceContracts/0/relationships/TEST_ID',mutate:(envelope,r,project)=>{const row=directFor(perRun(envelope),envelope);row.relationships.TEST_ID={recordId:r.engine.recordsForCurrentScope(project,'requirements')[0].id};envelope.records.expectedVarianceContracts=[row];}},
  {id:'unknown-direct-membership',expectedPath:'/records/expectedVarianceContracts/0/relationships/TEST_ID',mutate:envelope=>{const row=directFor(perRun(envelope),envelope);row.relationships.TEST_ID={recordId:'TEST-UNKNOWN-UNALLOCATED'};envelope.records.expectedVarianceContracts=[row];}},
  {id:'stale-direct-membership',code:'UNRESOLVED_RELATIONSHIP',expectedPath:'/records/expectedVarianceContracts/0/relationships/TEST_ID',mutate:(envelope,r,project)=>{const row=directFor(perRun(envelope),envelope);row.relationships.TEST_ID={recordId:r.engine.records(project,'tests',{active:false})[0].id};envelope.records.expectedVarianceContracts=[row];}},
  {id:'empty-dimensions',code:'INVALID_EXPECTED_VARIANCE_CONTRACT',mutate:envelope=>{perRun(envelope).fields.EXPECTED_VARIANCE_CONTRACT={dimensions:[],allowedVariance:'NONE'};}},
  {id:'wrong-nested-dimensions-type',code:'INVALID_EXPECTED_VARIANCE_CONTRACT',mutate:envelope=>{perRun(envelope).fields.EXPECTED_VARIANCE_CONTRACT={dimensions:'bytes',allowedVariance:'NONE'};}},
  {id:'blank-allowed-variance',code:'INVALID_EXPECTED_VARIANCE_CONTRACT',mutate:envelope=>{perRun(envelope).fields.EXPECTED_VARIANCE_CONTRACT={dimensions:['bytes'],allowedVariance:' '};}},
  {id:'ascii-blank-direct-variance',code:'INVALID_EXPECTED_VARIANCE_CONTRACT',mutate:envelope=>{const row=directFor(perRun(envelope),envelope);row.fields.ALLOWED_VARIANCE=' \t\n\r\v\f ';envelope.records.expectedVarianceContracts=[row];}},
  {id:'ascii-blank-direct-dimension',code:'INVALID_EXPECTED_VARIANCE_CONTRACT',mutate:envelope=>{const row=directFor(perRun(envelope),envelope);row.fields.DIMENSIONS=[' \t\n\r\v\f '];envelope.records.expectedVarianceContracts=[row];}},
  {id:'application-field-injection',expectedPath:'/records/expectedVarianceContracts/0/fields/NORMALIZED_CONTRACT',mutate:envelope=>{const row=directFor(perRun(envelope),envelope);row.fields.NORMALIZED_CONTRACT=LITERAL_NESTED;envelope.records.expectedVarianceContracts=[row];}}
 ];
 for(const testCase of negatives.filter(row=>selected(row.id))){const result=await stageExpectedVarianceResponse(h,{mutate:testCase.mutate,persist:testCase.id==='empty-dimensions'});assert.equal(result.prepared.validation.valid,false,'EXPECTED_VARIANCE_INVALID_AUTHOR_REJECTED_ORACLE '+testCase.id);assert.equal(Boolean(result.prepared.proposal),false,'EXPECTED_VARIANCE_INVALID_NO_PROPOSAL_ORACLE '+testCase.id);const issues=result.prepared.validation.issues;if(testCase.code)assert(issues.some(item=>item.code===testCase.code),'EXPECTED_VARIANCE_INTENDED_DIAGNOSTIC_ORACLE '+testCase.id+' '+JSON.stringify(issues));if(testCase.expectedPath)assert(issues.some(item=>item.path?.startsWith(testCase.expectedPath)),'EXPECTED_VARIANCE_TYPED_DIAGNOSTIC_PATH_ORACLE '+testCase.id+' '+JSON.stringify(issues));recordCase({id:testCase.id,expected:'REJECTED_NO_PROPOSAL',codes:issues.map(item=>item.code),rawPreserved:testCase.id==='empty-dimensions',boundary:testCase.id==='empty-dimensions'?'staged-response/admission/transaction-adapter-save-reload':'staged-response/admission',result:'PASS'});}
 for(const testCase of [
  {id:'missing-contract-partial-record',mutate:envelope=>{for(const test of envelope.records.tests)delete test.fields.EXPECTED_VARIANCE_CONTRACT;}},
  {id:'unknown-substantive-variance',mutate:envelope=>{perRun(envelope).fields.EXPECTED_VARIANCE_CONTRACT={dimensions:['requirement-truth'],allowedVariance:'UNKNOWN'};}}
 ].filter(row=>selected(row.id))){const result=await stageExpectedVarianceResponse(h,{mutate:testCase.mutate,accept:true}),gate=assertIndependentReviewPending(result);if(testCase.id==='missing-contract-partial-record')assert(gate.reasons.some(reason=>/variance/i.test(reason)),'EXPECTED_VARIANCE_ABSENCE_BLOCKS_DUE_WORK_ORACLE');else assertFrozenContract(result,{dimensions:['requirement-truth'],allowedVariance:'UNKNOWN'});recordCase({id:testCase.id,expected:'RECORDED_WITHOUT_STAGE_COMPLETION',reasons:gate.reasons,boundary:'admission/acceptance/transaction-adapter-save-reload/gate',result:'PASS'});}
 if(requiresStoredControl)assert(storedControl,'EXPECTED_VARIANCE_STORED_CONTROL_ORACLE');
 for(const testCase of [{id:'direct-retained-current-test-set',direct:true},{id:'sparse-stage6-retains-contract-bindings',direct:false}].filter(row=>selected(row.id))){await submitRetainedVarianceUpdate(h,storedControl,{direct:testCase.direct});recordCase({id:testCase.id,expected:'RETAINED_TESTS_CURRENT_CONTRACTS_HISTORY_PRESERVED',rawPreserved:true,boundary:'saved-package/staged-response/admission/acceptance/transaction-adapter-save-reload/currentness',result:'PASS'});}

 const faultCases=[
  {id:'tampered-normalized-contract',mutate:({row})=>{row.fields.NORMALIZED_CONTRACT.allowedVariance='Changed after freeze';row.NORMALIZED_CONTRACT=row.fields.NORMALIZED_CONTRACT;}},
  {id:'tampered-contract-hash',mutate:({row})=>{row.fields.CONTRACT_SHA256='0'.repeat(64);row.CONTRACT_SHA256=row.fields.CONTRACT_SHA256;}},
  {id:'tampered-freeze-time',mutate:({row})=>{row.fields.FROZEN_AT='2000-01-01T00:00:00.000Z';row.FROZEN_AT=row.fields.FROZEN_AT;}},
  {id:'stale-freeze-scope',mutate:({row})=>{row.fields.SCOPE.testSuiteVersion='SYNTHETIC-STALE-SUITE';row.SCOPE=row.fields.SCOPE;}},
  {id:'changed-authored-source',mutate:({test})=>{test.fields.EXPECTED_VARIANCE_CONTRACT.allowedVariance='Changed after freeze';test.EXPECTED_VARIANCE_CONTRACT=test.fields.EXPECTED_VARIANCE_CONTRACT;}}
 ];
 for(const fault of faultCases.filter(row=>selected(row.id))){const r=storedControl.r,project=r.copy(storedControl.current),testId=storedControl.prepared.proposal.tempToCanonical[perRun(storedControl.envelope).tempKey].id,test=r.engine.recordsForCurrentScope(project,'tests').find(row=>row.id===testId),row=r.engine.recordsForCurrentScope(project,'expectedVarianceContracts').find(row=>value(r,row,'TEST_ID')===testId);fault.mutate({row,test,project});const state=r.engine.expectedVarianceContractState(project,test);assert.equal(state.complete,false,'EXPECTED_VARIANCE_STALE_REJECTED_ORACLE '+fault.id);assert.equal(r.engine.expectedVarianceContractDigest(project,test),null,'EXPECTED_VARIANCE_STALE_NOT_CONSUMED_ORACLE '+fault.id);assert(state.reasons.length,'EXPECTED_VARIANCE_STALE_DIAGNOSTIC_ORACLE '+fault.id);const gate=r.engine.gate(6,project);assert.equal(gate.complete,false,'EXPECTED_VARIANCE_STALE_GATE_ORACLE '+fault.id);assert(gate.reasons.some(reason=>/variance/i.test(reason)),'EXPECTED_VARIANCE_STALE_GATE_CAUSE_ORACLE '+fault.id+' '+JSON.stringify(gate.reasons));recordCase({id:fault.id,expected:'CURRENTNESS_FALSE_NO_CONSUMER_DIGEST',reasons:state.reasons,boundary:'isolated-canonical-fault/currentness/gate',result:'PASS'});}
 const result={result:onlyCases===null?'PASS':'PARTIAL_PASS',requestedCases:onlyCases,sourceSha256:h.sourceSha256,fixtureSha256:h.fixtureSha256,synthetic:true,actualBrowser:false,actualStorageAdapter:true,actualStorageWorker:false,normalization,caseCount:cases.length,cases,startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-started};
 if(report)console.log(JSON.stringify(result));return result;
}

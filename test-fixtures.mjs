import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {readStoreArchive} from './test-zip.mjs';
import {restoreArtifactFixture,hydrateRetainedPromptContexts,bindAcceptanceUi} from './test-project-store-runtime.mjs';

export function scalarFor(def,name,overrides={}){
  if(Object.hasOwn(overrides,name))return overrides[name];
  // Generic synthetic actors perform generally routable independent review.
  // Tool/system fixtures must select their route and establish scoped readiness.
  if(String(name).toUpperCase()==='EXECUTION_MODE')return 'INDEPENDENT_AGENT_REVIEW';
  if(def.enumValues?.length)return def.enumValues[0];
  if(def.valueType==='BOOLEAN')return true;
  if(def.valueType==='INTEGER')return 1;
  if(def.valueType==='NUMBER')return 1;
  if(def.valueType==='STRING_ARRAY'||def.valueType==='REFERENCE_ARRAY')return ['fixture'];
  if(String(name).toUpperCase()==='EXPECTED_VARIANCE_CONTRACT')return {dimensions:['requirement-truth'],allowedVariance:'No variance in requirement truth.'};
  if(def.valueType==='OBJECT')return {};
  const upper=String(name).toUpperCase();
  if(upper.includes('ARTIFACT_REQUIREMENTS'))return 'NONE';
  if(upper.includes('DETERMINATION'))return 'SATISFIED';
  if(upper.includes('INDEPENDENCE'))return 'INDEPENDENT';
  if(upper.includes('CONTAMINATION'))return 'NONE';
  if(upper.includes('SEVERITY'))return 'MINOR';
  if(upper.includes('STATUS'))return 'ACTIVE';
  if(upper.includes('APPLICABILITY'))return 'APPLICABLE';
  if(upper.includes('MANDATORY_OPTIONAL'))return 'MANDATORY';
  if(upper.includes('TEST_TYPE'))return 'DETERMINISTIC';
  if(upper.includes('EXPECTED_REJECTION'))return 'REJECT';
  if(upper.includes('ACTUAL_RESULT'))return 'SATISFIED';
  return `fixture-${String(name).toLowerCase()}`;
}
export function recordProposal(schema,collection,{tempKey,targetId,relationships={},overrides={},evidenceRef='evidence-1'}={}){
  const def=schema.RECORD_SCHEMAS[collection],fields=['tests','regressions'].includes(collection)?{EXPECTED_VARIANCE_CONTRACT:{dimensions:['requirement-truth'],allowedVariance:'No variance in requirement truth.'},VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:12,REQUIRED_BY_STAGE:12,PER_RUN_REQUIRED:true,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'}}:{};
  if(collection==='failureTests')Object.assign(fields,{VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:def.stage,REQUIRED_BY_STAGE:def.stage,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'}});
  if(collection!=='tests')delete fields.EXPECTED_VARIANCE_CONTRACT;
  for(const name of def.required){const fd=def.fieldDefinitions[name];if(fd?.producer===schema.PRODUCER.AGENT)fields[name]=scalarFor(fd,name,overrides);}
  for(const [name,value] of Object.entries(overrides))if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=value;
  return {tempKey:targetId?undefined:(tempKey||`${collection}-1`),targetId:targetId||undefined,fields,relationships,evidenceRefs:evidenceRef?[evidenceRef]:[]};
}
export function evidence(label='fixture'){return {temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:`${label} evidence`,location:'verify-full-cycle.mjs',content:`controlled ${label} evidence`};}

// These meanings come from the approved eight-byte VERIFIED / nine-byte
// VERIFIED + LF example. The fixture author must supply the current published
// test profile and actual evidence; this helper grants no compatibility authority.
export function deferredCompatibilityFixtureValues(family,{actualTarget='The preserved eight-byte VERIFIED fixture and the current reviewed target input contract.',rationale='The preserved eight-byte fixture omits the required terminal LF. The reviewed complete-content comparison distinguishes it from nine-byte VERIFIED followed by LF.'}={}){
  const common={actualTargetCompatibility:'TRUE',outcomeCompatibility:'TRUE',actualTarget,rationale};
  if(family==='failureTests')return {...common,expectedRejectionMeaning:'SATISFIED means the exact eight-byte VERIFIED fixture is rejected for differing from the required nine-byte VERIFIED followed by LF; it is not an affirmative product pass.'};
  if(family==='regressions')return {...common,preCorrectionFailureMeaning:'The original eight-byte VERIFIED target fails complete comparison with nine-byte VERIFIED followed by LF, so the actual PRE_CORRECTION result must be VIOLATED.',postCorrectionSuccessMeaning:'After correction, a distinct target identity containing the required terminal LF matches the nine-byte content, so actual POST_CORRECTION must be SATISFIED while the original negative fixture remains preserved.'};
  throw new Error('Compatibility fixture family must be failureTests or regressions.');
}

export function deferredDefinitionSupportFixture(schema,{family,definition,testProfile,fixture,defectRef,supportingEvidenceRefs,knownInvalidCase='The attributable preserved fixture is exactly the eight-byte VERIFIED value; the governing reviewed comparison requires nine-byte VERIFIED followed by LF. Its missing LF is the negative case, not a successful ordinary observation.'}){
  if(!schema.DEFERRED_DEFINITION_SUPPORT_CONTRACT)throw new Error('The published deferred-definition support contract is unavailable.');
  if(!testProfile||typeof testProfile.recordId!=='string'||typeof testProfile.semanticSha256!=='string'||typeof testProfile.inputContractSha256!=='string')throw new Error('Copy the complete current application-published reviewed test profile.');
  const report={schema:schema.DEFERRED_DEFINITION_SUPPORT_CONTRACT.schema,definition,test:{recordId:testProfile.recordId,semanticSha256:testProfile.semanticSha256,inputContractSha256:testProfile.inputContractSha256},fixture,knownInvalidCase,basis:'AGENT_SEMANTIC_OBSERVATION',supportingEvidenceRefs,...(defectRef?{defectRef}:{})};
  const checked=schema.validateDeferredDefinitionSupport(report,family);if(!checked.valid)throw new Error('Support fixture violates its published schema: '+JSON.stringify(checked.issues));
  return report;
}

// Copy a published profile, never manufacture a test identity or digest.
export function deferredPublishedTestProfile(prompt,testId){
  const profiles=(prompt.contextManifest?.deferredDefinitionTestProfiles||[]).filter(row=>row.recordId===testId);
  if(profiles.length!==1||typeof profiles[0].semanticSha256!=='string'||typeof profiles[0].inputContractSha256!=='string')throw new Error('The current instruction must publish exactly one complete reviewed test support profile.');
  return profiles[0];
}

export function deferredDefinitionResponseFixture({schema,engine,prompts},project,prompt,{family,fields,relationships,fixtureValue='VERIFIED',fixtureArtifactId=null,defectId=null,defectEvidenceIds=[],tempKey='supported-definition',compatibility=deferredCompatibilityFixtureValues(family),knownInvalidCase='The preserved fixture is exactly eight UTF-8 bytes VERIFIED. It omits the terminal LF required by the current governing nine-byte complete-content comparison. This exact original negative case accounts for fixture rejection and, for regression, original target failure and a distinct corrected target match.'}={}){
  const testId=relationships?.EXECUTION_TEST_ID?.recordId;if(typeof testId!=='string')throw new Error('A supported fixture requires its application-provided execution test relationship.');
  const testProfile=deferredPublishedTestProfile(prompt,testId),manifest=prompts.promptFileManifest(prompt),fixture=fixtureArtifactId?{artifactRef:{recordId:fixtureArtifactId}}:{literal:{value:fixtureValue}};
  const report=deferredDefinitionSupportFixture(schema,{family,definition:{tempKey},testProfile,fixture,...(defectId?{defectRef:{recordId:defectId}}:{}),supportingEvidenceRefs:[{tempKey:'negative-fixture'},{tempKey:'known-invalid-account'},...defectEvidenceIds.map(recordId=>({recordId}))],knownInvalidCase:{evidenceRef:{tempKey:'known-invalid-account'}}});
  const artifact=fixtureArtifactId?engine.records(project,'artifacts').find(row=>engine.recordId(row,'artifacts')===fixtureArtifactId):null;
  const evidence=[{temporaryKey:'negative-fixture',kind:'PRESERVED_NEGATIVE_FIXTURE',description:'Exact preserved synthetic negative fixture; no future execution is claimed.',authorityType:'AGENT_CLAIM',location:artifact?engine.recordValue(artifact,'FILENAME'):'response.json#/evidence/0/content',content:fixtureValue.trim()?fixtureValue:JSON.stringify({fixtureLiteral:fixtureValue}),...(fixtureArtifactId?{attachmentRef:{recordId:fixtureArtifactId}}:{})},{temporaryKey:'known-invalid-account',kind:'ATTRIBUTABLE_NEGATIVE_CASE_ACCOUNT',description:'Complete attributable author account of this exact preserved negative case.',authorityType:'AGENT_CLAIM',location:'response.json',content:knownInvalidCase},{temporaryKey:'definition-support',kind:'DEFERRED_DEFINITION_SUPPORT',description:'Attributable supported author correspondence to the current reviewed test and preserved negative fixture.',authorityType:'AGENT_CLAIM',location:'response.json',content:JSON.stringify(report)}];
  return {schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:project.job.JOB_ID,stage:prompt.stage,operation:prompt.operation,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:manifest.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{[family]:[{tempKey,fields:{...fields,EXECUTION_COMPATIBILITY:compatibility},relationships,evidenceRefs:['negative-fixture','known-invalid-account','definition-support'],notes:'Synthetic definition author fixture; admission does not establish future execution or stage completion.'}]},evidence,unresolved:[],warnings:[],attachments:[]};
}

// Reusable actual author admission for maintained isolated regression fixtures.
// The caller supplies a derived prerequisite snapshot and its captured bytes;
// this helper never creates a prerequisite, edits a reviewed test, or sets a gate.
export function readDeferredDefinitionLegacyFixture(r,filename='verification/deferred-definition-compatibility-legacy-fixture-20261005.json'){
 const carrier=JSON.parse(fs.readFileSync(filename,'utf8'));assert.equal(carrier.schema,'closed-loop-deferred-definition-legacy-carrier/1');assert.equal(carrier.encoding,'gzip-base64');const compressed=Buffer.from(carrier.gzipBase64,'base64');assert.equal(compressed.toString('base64'),carrier.gzipBase64);assert.equal(compressed.length,carrier.gzipByteSize);const bytes=gunzipSync(compressed,{maxOutputLength:32*1024*1024}),text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);assert.equal(bytes.length,carrier.decodedByteSize);assert.equal(r.runtime.closedLoopHash.sha256Text(text),carrier.decodedSha256,'ADMITTED_DEFERRED_RESTORATION_DECODED_IDENTITY_ORACLE');const payload=JSON.parse(text);assert.equal(payload.schema,'closed-loop-deferred-definition-legacy-fixture/1');assert.equal(payload.earlierCompleteFlagsForced,false);return payload;
}
export async function deferredFailureExecutionResponseFixture({schema,hash},manifest,binding,{isolationIdentity='synthetic-disposable-negative-comparison',filename='synthetic-failure-execution.json'}={}){
 assert(binding?.subjectId&&binding.phase==='FAILURE_VALIDATION','DEFERRED_FAILURE_RECEIPT_CURRENT_BINDING_REQUIRED');const invalid=Buffer.from(binding.fixture,'utf8'),expected=Buffer.from('VERIFIED\n','utf8');assert.notDeepEqual(invalid,expected,'DEFERRED_FAILURE_RECEIPT_ACTUAL_NEGATIVE_COMPARISON_REQUIRED');const isolation={kind:'TEST_PROJECT_CLONE',identity:isolationIdentity},raw=JSON.stringify({schema:'SYNTHETIC_DISPOSABLE_COMPARISON/1',synthetic:true,binding,isolation,actualInvalidRejected:!invalid.equals(expected),actualConformingAccepted:expected.equals(Buffer.from('VERIFIED\n','utf8')),externalActor:false,actualBrowser:false}),bytes=Buffer.from(raw,'utf8'),blob=new Blob([bytes],{type:'application/json'}),sha256=await hash.sha256Bytes(blob),slot=manifest.attachmentSlots.find(row=>row.role==='SUPPORTING_EVIDENCE');assert(slot,'DEFERRED_FAILURE_RECEIPT_ACTUAL_RETURNED_SLOT_REQUIRED');const report={schema:schema.DEFERRED_EXECUTION_EVIDENCE.schema,binding,phase:binding.phase,result:'SATISFIED',isolation,observedResult:'The actual preserved invalid bytes differ from VERIFIED plus LF and are rejected; the conforming nine-byte control matches.',performer:'Synthetic Node executor in disposable comparison',evidenceLocation:filename,isolationEvidence:'Exact isolated inputs, binding and comparison retained as returned bytes; synthetic only.'},envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:manifest.jobId,stage:manifest.stage,operation:manifest.operation,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:manifest.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{regressionExecutions:[{tempKey:'receipt',fields:{PHASE:binding.phase,RESULT:'SATISFIED'},relationships:{MUTATION_ID:{recordId:binding.subjectId}},evidenceRefs:['execution'],notes:'Actual synthetic disposable negative comparison.'}]},evidence:[{temporaryKey:'execution',kind:'EXTERNAL_EXECUTION',description:'Actual synthetic disposable negative comparison',authorityType:'EXTERNAL_SYSTEM',location:filename,content:JSON.stringify(report),attachmentRef:{tempKey:'returned'},notes:'Synthetic fixture, not real external acceptance.'}],unresolved:[],warnings:[],attachments:[{temporaryKey:'returned',attachmentSlotId:slot.attachmentSlotId,role:slot.role,filename,mediaType:'application/json',byteSize:bytes.length,sha256,required:true}]};return {envelope,returnedAttachments:[{temporaryKey:'returned',bytes}],rawAttachmentText:raw,actualInvalidRejected:true,actualConformingAccepted:true,synthetic:true,actualBrowser:false};
}
export async function deferredDefinitionRestorationFixture(r,{family,executionStage=family==='regressions'?16:8,filename,prefix=null,subjectId=null}={}){
 const payload=prefix?null:readDeferredDefinitionLegacyFixture(r,filename),retained=prefix||payload.admittedDueFixtures?.[family]||payload.cohorts?.[family]?.currentSupportedRecovery;assert(retained?.project&&retained.artifacts,'ADMITTED_DEFERRED_RESTORATION_ACTUAL_RECEIPT_REQUIRED');const archivedFixtureClockUtc=retained.archivedFixtureClockUtc||payload?.archivedFixtureClockUtc;if(archivedFixtureClockUtc){assert.equal(new Date(archivedFixtureClockUtc).toISOString(),archivedFixtureClockUtc);r.runtime.Date=class extends Date{constructor(...args){super(...(args.length?args:[archivedFixtureClockUtc]));}static now(){return Date.parse(archivedFixtureClockUtc);}};}let p=r.copy(retained.project);await restoreArtifactFixture(r.store,retained.artifacts);await hydrateRetainedPromptContexts(r,p,retained.contextFiles||[]);const e=r.engine,subject=e.recordsForCurrentScope(p,family).find(row=>row.id===(subjectId||retained.subjectId))||e.recordsForCurrentScope(p,family).find(row=>row.temporaryKey==='conditional-future-failure');assert(subject,'ADMITTED_DEFERRED_RESTORATION_SUBJECT_REQUIRED');const test=e.recordsForCurrentScope(p,'tests').find(row=>row.id===e.recordValue(subject,'EXECUTION_TEST_ID'));assert(test);const raw=p.projectData.rawResponses.find(row=>row.rawResponseId===subject.rawResponseId);assert(raw?.completeRawResponse,'ADMITTED_DEFERRED_RESTORATION_RAW_REQUIRED');assert(e.acceptedChanges(p,Number(raw.stage)).some(row=>row.canonicalRecordIds?.includes(subject.id)&&row.rawResponseId===raw.rawResponseId),'ADMITTED_DEFERRED_RESTORATION_ACCEPTED_IDENTITY_REQUIRED');assert.equal(e.deferredDefinitionCompatibilityState(p,subject,family).compatible,true,'ADMITTED_DEFERRED_RESTORATION_CURRENT_SUPPORT_REQUIRED');p.activeStage=executionStage;const plan=e.deferredExecutionPlan(p,executionStage);assert(plan.items.some(row=>row.subjectId===subject.id&&row.executableNow),'ADMITTED_DEFERRED_RESTORATION_EXECUTABLE_REQUIRED');return {p,subject,test,stage:executionStage,rawResponseId:raw.rawResponseId,...(archivedFixtureClockUtc?{archivedFixtureClockUtc}:{}),synthetic:true,actualBrowser:false,priorStagesAreSetupOnly:true};
}
export function deferredReviewedPrerequisiteFixture(r,key,{filename}={}){const carrier=readDeferredDefinitionLegacyFixture(r,filename).reviewedPrefixes?.[key];assert.equal(carrier?.schema,'closed-loop-reviewed-prerequisite-carrier/1');assert.equal(carrier.encoding,'gzip-base64');const compressed=Buffer.from(carrier.gzipBase64,'base64');assert.equal(compressed.toString('base64'),carrier.gzipBase64);assert.equal(compressed.length,carrier.gzipByteSize);const bytes=gunzipSync(compressed,{maxOutputLength:128*1024*1024}),text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);assert.equal(bytes.length,carrier.decodedByteSize);assert.equal(r.runtime.closedLoopHash.sha256Text(text),carrier.decodedSha256,'REVIEWED_DEFERRED_PREREQUISITE_DECODED_IDENTITY_ORACLE');const prefix=JSON.parse(text);assert.equal(prefix.synthetic,true);assert.equal(prefix.earlierCompleteFlagsForced,false);return prefix;}
export async function deferredDefinitionAdmissionFixture(r,{prefix,family,testId,testKey,stage=family==='regressions'?15:7,operation='COMPLETE',fixtureValue='VERIFIED',fixtureArtifactId=null,defectId=null,tempKey='supported-definition',compatibility=deferredCompatibilityFixtureValues(family),knownInvalidCase,fields:fieldOverrides={}}={}){
 const e=r.engine,s=r.runtime.closedLoopWorkflowSchema,h=r.runtime.closedLoopHash;assert(prefix?.project&&prefix.earlierCompleteFlagsForced===false,'ADMITTED_DEFERRED_FIXTURE_DERIVED_PREFIX_REQUIRED');
 assert(s.deferredDefinitionWriter(stage,operation),'ADMITTED_DEFERRED_FIXTURE_WRITER_REQUIRED');let p=r.copy(prefix.project);
 await restoreArtifactFixture(r.store,prefix.artifacts);await hydrateRetainedPromptContexts(r,p,prefix.contextFiles||[]);
 for(let prior=1;prior<stage;prior++)assert.equal(e.gate(prior,p).complete,true,'ADMITTED_DEFERRED_FIXTURE_UPSTREAM_ORACLE: '+prior);
 const test=e.recordsForCurrentScope(p,'tests').find(row=>testId?row.id===testId:row.temporaryKey===testKey);assert(test,'ADMITTED_DEFERRED_FIXTURE_CURRENT_TEST_REQUIRED');
 const reqId=e.recordValue(test,'REQ_ID'),defect=family==='regressions'?e.recordsForCurrentScope(p,'defects').find(row=>defectId?row.id===defectId:e.recordValue(row,'REQ_ID')===reqId):null;if(family==='regressions')assert(defect,'ADMITTED_DEFERRED_FIXTURE_CURRENT_DEFECT_REQUIRED');
 const timing=Object.fromEntries(s.TIMING_FIELDS.map(name=>[name,r.copy(e.recordValue(test,name))])),fields={...recordProposal(s,family).fields,...timing,...(family==='failureTests'?{VIOLATION_MODE:'MISSING_REQUIRED_TERMINAL_LF',FIXTURE:fixtureValue,EXPECTED_REJECTION:'REJECT',ACTUAL_RESULT:'NOT_RUN',EXECUTION_OUTCOME:'NOT_RUN'}:{FAILURE_FIXTURE:fixtureValue,REPRODUCTION_PROCEDURE:'Apply the reviewed complete-content predicate to the exact preserved original negative fixture and actual due target.',DETECTION_METHOD:'Complete-content comparison including terminal LF.',CORRECTION:'Use a distinct corrected target preserving the required terminal LF.',PERMANENT_TEST_LOCATION:'Current typed regression registry',APPLICABILITY:'APPLICABLE'}),...fieldOverrides},relationships={REQ_ID:{recordId:reqId},EXECUTION_TEST_ID:{recordId:test.id},...(defect?{DEFECT_ID:{recordId:defect.id}}:{})};
 const prior=await r.store.readProject(p.job.JOB_ID);p=await r.store.writeProject(p,{expectedProjectRevision:prior?.revision||0,...(prior?{expectedStateSha256:prior.projectSha256}:{createOnly:true}),incrementRevision:!prior});const draft=r.copy(p);draft.activeStage=stage;
 const issued=r.prompts.reserveAndBuildPromptRecord(draft,stage,{operation}).prompt;p=await r.store.writeProject(draft,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 const prompt=p.projectData.generatedPrompts.find(row=>row.instructionId===issued.instructionId),pkg=await r.store.createExecutionPackage({jobId:p.job.JOB_ID,stage,operation,instructionId:prompt.instructionId}),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),manifest=JSON.parse(Buffer.from(members.find(row=>row.canonicalPath==='manifest.json').bytes).toString('utf8'));
 assert.equal(Buffer.from(members.find(row=>row.canonicalPath==='instruction.txt').bytes).toString('utf8'),prompt.prompt);assert(manifest.contextManifest?.deferredDefinitionTestProfiles,'ADMITTED_DEFERRED_FIXTURE_ACTUAL_PUBLISHED_PROFILES_REQUIRED');
 const publicPrompt={...prompt,contextManifest:manifest.contextManifest},envelope=deferredDefinitionResponseFixture({schema:s,engine:e,prompts:{promptFileManifest:()=>manifest}},p,publicPrompt,{family,fields,relationships,fixtureValue,fixtureArtifactId,defectId:defect?.id,defectEvidenceIds:defect?.evidenceRefs||[],tempKey,compatibility,...(knownInvalidCase===undefined?{}:{knownInvalidCase})}),text=JSON.stringify(envelope),staged=await r.store.stageResponseFile({jobId:p.job.JOB_ID,stage,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce}),file=await r.store.readStagedResponseFile({jobId:p.job.JOB_ID,stagingId:staged.stagingId});
 assert.equal(new TextDecoder('utf-8',{fatal:true}).decode(file.bytes),text);const captured=r.ingestion.captureRaw(p,{stage,text,promptRecord:prompt,transport:r.copy({authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,rawFilename:'response.json',mediaType:'application/json',status:file.status,sha256:file.sha256,byteSize:file.byteSize,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce})}),prepared=r.ingestion.prepareCaptured(captured.project,{rawResponseId:captured.rawRecord.rawResponseId});
 assert.equal(prepared.validation.valid,true,'ADMITTED_DEFERRED_FIXTURE_ADMISSION_ORACLE: '+JSON.stringify(prepared.validation.issues));const executionCount=e.records(p,'regressionExecutions').length;p=await r.store.writeProject(prepared.project,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 const failures=bindAcceptanceUi(r,p,prepared.proposal.proposalId);await r.runtime.accept();if(r.runtime.replacementReview)await r.runtime.confirm();assert.equal(failures.length,0,'ADMITTED_DEFERRED_FIXTURE_OPERATOR_ORACLE: '+failures.map(row=>row.message).join(' '));p=await r.store.readProject(p.job.JOB_ID);assert.equal(r.store.validateProjectIntegrity(p).valid,true);assert.equal(e.records(p,'regressionExecutions').length,executionCount);
 const subject=e.records(p,family).find(row=>row.rawResponseId===captured.rawRecord.rawResponseId);assert(subject);assert.equal(e.deferredDefinitionCompatibilityState(p,subject,family).compatible,true);
 return {p,subject,test:e.records(p,'tests').find(row=>row.id===test.id),defect:family==='regressions'?e.records(p,'defects').find(row=>row.id===defect.id):null,prompt,manifest,members,envelope,rawResponseId:captured.rawRecord.rawResponseId,responseSha256:file.sha256,packageSha256:await h.sha256Bytes(pkg.blob),synthetic:true,actualBrowser:false,priorStagesAreSetupOnly:true};
}

// Controlled external actor responses still use production context/ingestion/
// acceptance. The synthetic bounded search makes no live-service claim.
export function acceptPrerequisite(runtime,project,stage,{operation='COMPLETE',stageData={},records={}}={}){
  const {schema,engine,prompts,ingestion}=runtime,preparedContext=engine.preparePromptContext(project,stage,{operation}),pr=prompts.buildPromptRecord(stage,project,preparedContext.options);
  project.projectData.generatedPrompts.push(pr);
  const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:project.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData,records,evidence:[evidence(`stage-${stage}-${operation}`)],unresolved:[],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(project,{stage,text:JSON.stringify(envelope),promptRecord:pr});
  if(!prepared.validation.valid)throw new Error(JSON.stringify(prepared.validation.issues));
  return ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'BROWSER_FIXTURE',replacementConfirmation:ingestion.acceptanceImpact(prepared.project,prepared.proposal.proposalId)});
}
export function stage01AcceptanceFixture(runtime,jobId='JOB-BROWSER-PROOF-PERSISTENCE'){
  const {core,engine}=runtime;let p=core.createBlankState(jobId);
  Object.assign(p.job,{JOB_TITLE:'Response acceptance persistence',EXACT_USER_OBJECTIVE_VERBATIM:'Produce a verified checklist.',EXPLICIT_USER_REQUIREMENTS:'The checklist must contain the required verified content.',CURRENT_INPUT_VERSION:'INPUT-v001'});
  engine.ensureShape(p);engine.recalculate(p);
  const manifest=engine.intakeCoverageManifest(p),capture={schema:'closed-loop-stage01-capture/2',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,pass1Completed:true,pass2OmissionChallenge:{completed:true,checkedCategories:['QUALIFIERS','EXCEPTIONS','DEPENDENCIES','NEGATIVE_REQUIREMENTS','DO_NOT_CHANGE','VISUAL_CONSTRAINTS','TEMPORAL_CONSTRAINTS','ACCEPTANCE_CONDITIONS','AUTHORITY_STATEMENTS','TOOL_RESTRICTIONS','FILE_REFERENCES','OUTPUT_FORMAT_REQUIREMENTS','CORRECTIONS','LATER_OVERRIDES'],omissionsFound:[],omissionsResolved:true},units:manifest.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'EXTRACTED_RELEVANT_INFORMATION',reason:'Preserved for downstream reuse.',extractedStatements:[{statementKey:`s-${i}`,text:u.rawValueText,statementClass:'REQUIREMENT'}]}))};
  const first=acceptPrerequisite(runtime,p,1,{stageData:{EXACT_DELIVERABLE_REQUESTED:'Verified checklist',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)}});p=first.project;
  engine.recordStageConfirmation(p,1,true,'Intent confirmed','BROWSER_FIXTURE',{acceptedChangeId:first.acceptedChange.changeId,inputVersion:p.job.CURRENT_INPUT_VERSION,instructionId:first.acceptedChange.promptId,contextSignature:first.acceptedChange.contextSignature,operatorLabel:'BROWSER_FIXTURE'});
  engine.recalculate(p);if(!engine.gate(1,p).complete)throw new Error('Stage01 prerequisite did not complete.');return p;
}
export function boundedSearchProposal(schema){
  return recordProposal(schema,'sourceSearchContracts',{tempKey:'bounded-fixture-search',overrides:{PROJECT_SCOPE:'The closed synthetic checklist fixture and its supplied human inputs.',JURISDICTION_OR_SYSTEM_SCOPE:'Disposable hermetic fixture; no legal or external-system authority is claimed.',SOURCE_CLASSES_CONSIDERED:['Project-supplied references'],LOCATIONS_AND_REPOSITORIES:['The complete controlled fixture input set'],QUERIES_OR_STRATEGIES:['Inspect every declared input location and supplied reference.','Final registered query round found no new candidate; no accepted authority has an undisposed citation.'],DATE_OR_VERSION_CUTOFF:'Current controlled fixture input version',EXCLUSIONS:['Other generic source classes are inapplicable to this explicitly hermetic fixture; no live-domain authority is asserted.'],ACCESS_LIMITATIONS:[],ADEQUACY_RATIONALE:'The versioned fixture checklist considered all seven generic source classes. Every registered location was inspected, the final query round was saturated, authority-chain closure is empty, no location was inaccessible, every discovered candidate has a disposition, and no material residual risk remains. The independent reviewer must assess this external fixture claim.',UNRESOLVED_DISCOVERY_RISK:'NONE'}});
}
// Advance through actual acceptance and independently bound source review to
// the first proposition-producing stage. No prerequisite gate is forced green.
// Retain exact report text in canonical evidence through the supported source-
// search registration API. This is a declared hermetic external-claim fixture,
// not a fabricated stored artifact, human identity or live-network execution.
export function registerFixtureSourceSearchCapability(runtime,project,{checks={},register=true}={}){
  const {engine}=runtime,contract=engine.recordsForCurrentScope(project,'sourceSearchContracts').at(-1);if(!contract)throw new Error('Fixture search contract is missing.');
  const report=engine.externalCapabilityEvidenceTemplate(project,engine.recordId(contract,'sourceSearchContracts')),time=Date.now();
  // This positive hermetic claim remains current for the full declared 120m
  // operator-journey gate. Expired reports still fail production freshness checks.
  Object.assign(report,{reportedBy:'SYNTHETIC_SEARCH_PERFORMER',environment:'Explicit closed hermetic fixture input universe',observedAt:new Date(time-1000).toISOString(),validUntil:new Date(time+7200000).toISOString()});
  report.action={target:engine.recordValue(contract,'PROJECT_SCOPE'),riskClasses:['READ_ONLY'],expectedEffect:'Inspect only the complete declared synthetic input universe and preserve its search observations.',reversibility:'No mutation',maximumCost:'0',authority:'Controlled test fixture operator',containment:'No network or external authority is claimed',stopCondition:'Stop when every declared fixture location and stopping criterion is accounted for',responsibleActor:'SYNTHETIC_SEARCH_PERFORMER'};
  for(const [key,check]of Object.entries(report.checks)){check.status=checks[key]||'TRUE';check.evidence=`Controlled fixture ${key} basis; not an independently observed live external capability.`;}
  if(!register)return report;
  const record=engine.registerExternalCapabilityEvidence(project,{reportText:JSON.stringify(report),operatorConfirmed:true,operatorLabel:'SYNTHETIC_FIXTURE_OPERATOR'});
  return record;
}
export function stage04AcceptanceFixture(runtime,jobId='JOB-BROWSER-PROOF-PERSISTENCE'){
  const {schema,engine}=runtime;let p=stage01AcceptanceFixture(runtime,jobId);
  p=acceptPrerequisite(runtime,p,2,{stageData:{AUTHORITY_HIERARCHY:'No external authority applies to the controlled fixture.',SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE',KNOWN_CONTROLLING_SOURCES_EXAMINED:'The controlled bounded search found no applicable external governing source.'},records:{sourceSearchContracts:[boundedSearchProposal(schema)]}}).project;
  registerFixtureSourceSearchCapability(runtime,p);
  p=acceptPrerequisite(runtime,p,2,{operation:'SEARCH_ADEQUACY_REVIEW',records:{semanticReviews:[recordProposal(schema,'semanticReviews',{tempKey:'fixture-search-review',overrides:{REVIEW_QUESTION:'Was the bounded fixture search executed adequately?',FINDING:'The closed fixture input universe is exhausted with no applicable external source.',REASONING:'Compared the declared source classes, locations, executed query evidence, stopping criteria, dispositions, exclusions and residual risk with the controlled fixture scope.',RESULT:'ACCEPTED'}})]}}).project;
  p=acceptPrerequisite(runtime,p,3,{stageData:{EXCEPTIONS_AND_EDGE_CONDITIONS:'NONE',CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE',RESEARCH_GAPS_AND_BLOCKERS:'NONE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false}}).project;
  for(let n=1;n<=3;n++)if(!engine.gate(n,p).complete)throw new Error(`Fixture prerequisite ${n}: ${engine.gate(n,p).reasons.join(' | ')}`);
  p.activeStage=4;p.activeView='Workflow';return p;
}

export function stage04AcceptanceEnvelope(runtime,p,pr){
  const {schema,engine}=runtime,manifest=engine.obligationManifest(p),target=manifest.items.find(item=>item.text==='The checklist must contain the required verified content.');
  if(!target)throw new Error('The fixture lost its exact human requirement.');
  const records={requirements:[recordProposal(schema,'requirements',{tempKey:'req',overrides:{OBLIGATION:target.text,REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:target.obligationId,APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'Required content is present.',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC_AND_INDEPENDENT_CONTENT_REVIEW',EXPECTED_EVIDENCE:'Canonical verification evidence',FAILURE_CONDITION:'Required content absent',SEVERITY:'MAJOR'}})],propositions:[recordProposal(schema,'propositions',{tempKey:'prop',relationships:{REQUIREMENT_ID:{tempKey:'req'}},overrides:{PROPOSITION_TEXT:target.text,SUBJECT_AND_SCOPE_DESCRIPTION:'The current checklist and requirement scope.',SATISFACTION_MEANING:'The required verified content is present.',FAILURE_MEANING:'The required verified content is absent.'}})]};
  const stageEvidence=[evidence('stage-4'),...manifest.items.filter(item=>item.obligationId!==target.obligationId).map((item,i)=>({temporaryKey:`context-${i}`,kind:'OBLIGATION_DISPOSITION',description:'Preserved fixture context',authorityType:'AGENT_CLAIM',location:'Stage 04 obligation accounting',content:JSON.stringify({obligationId:item.obligationId,disposition:'retained nonnormative context',reason:'Preserved descriptive context for this checklist fixture.'})}))];
  return {schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:4,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},...(pr.transportBindingRequired?{packageId:pr.packageId,operationReservationId:pr.operationReservationId,challengeNonce:pr.challengeNonce}:{}),scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records,evidence:stageEvidence,unresolved:[],warnings:[],attachments:[]};
}

// Accumulate real failed-response and replacement-instruction records. The first
// three stages use production intake/acceptance; no gate is forced complete.
export async function accumulatedStage04Fixture(runtime,{jobId='ACCUMULATED-STAGE4',attempts=100,responseCharacters=20000}={}){
  let project=stage04AcceptanceFixture(runtime,jobId);
  let prompt=runtime.prompts.reserveAndBuildPromptRecord(project,4).prompt;
  if(runtime.store)await runtime.store.persistPromptContextFiles(prompt,project);
  for(let index=0;index<attempts;index++){
    const text=`Invalid response ${index}: ${'X'.repeat(responseCharacters)} é🙂 ACCUMULATION-TAIL-${index}`;
    const result=runtime.ingestion.prepare(project,{stage:4,text,promptRecord:prompt});
    if(result.validation.valid||!result.rawRecord||!result.validation.validationId)throw new Error('Accumulation fixture did not preserve a real failed response and validation.');
    project=result.project;
    prompt=runtime.prompts.reserveAndBuildPromptRecord(project,4).prompt;
    if(runtime.store)await runtime.store.persistPromptContextFiles(prompt,project);
  }
  project.activeStage=4;project.activeView='Workflow';return project;
}

// Export may prepare a current instruction and record its receipt. Those
// operational changes must not replace accepted work or rewrite retained bytes.
// Backup restoration must recover the exact post-export project data.
export function stageHandoffRecoveryProof(before,exported,restored,hash){
  const stable=value=>JSON.stringify(value,(_key,row)=>row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.keys(row).sort().map(key=>[key,row[key]])):row);
  const equal=(a,b)=>hash.sha256Text(stable(a))===hash.sha256Text(stable(b));
  const preparation=new Set(['generatedPrompts','operationReservations','history','allocationReceipts','idCounters','eventSequence']);
  const accepted=p=>Object.fromEntries(Object.entries(p.projectData).filter(([key])=>!preparation.has(key)));
  const promptBytes=p=>Object.fromEntries(Object.entries(p).filter(([key])=>key!=='invalidatedBy'));
  const retained=(before.projectData.generatedPrompts||[]).every(prior=>{
    const after=exported.projectData.generatedPrompts.find(row=>row.instructionId===prior.instructionId);
    return after&&equal(promptBytes(prior),promptBytes(after));
  });
  const prefix=family=>equal(before.projectData[family]||[],(exported.projectData[family]||[]).slice(0,(before.projectData[family]||[]).length));
  const authoredStages=p=>Object.fromEntries(Object.entries(p.stages).map(([stage,row])=>[stage,row.agentData||{}]));
  return {acceptedDataUnchanged:equal(accepted(before),accepted(exported)),authoredStagesUnchanged:equal(authoredStages(before),authoredStages(exported)),retainedPromptBytes:retained,historyPrefixPreserved:prefix('history'),allocationPrefixPreserved:prefix('allocationReceipts'),restoredProjectDataExact:equal(exported.projectData,restored.projectData),restoredAuthoredStagesExact:equal(authoredStages(exported),authoredStages(restored)),rawResponses:restored.projectData.rawResponses.length,generatedPrompts:restored.projectData.generatedPrompts.length};
}

// Current/stale route sentinels exercise projection, not accepted stage results.
// Supply the verified canonical shape and governing relationships reached by
// semantic review and independent product-review selectors. Do not derive any
// read/write oracle or semantic approval from production implementation here.
export function routeProjectionFixtureFields(collection,{idPrefix,variant,marker}){
 const id=family=>`${idPrefix}-${family}-${variant}`;
 if(collection==='proofExpressions'){
  const leaf={type:'LEAF',testId:id('tests'),requiredDisposition:'SATISFIED',truthExtraction:'ACCEPTED_ENTAILMENT',evidenceClasses:['OBSERVATION_RECORD','ACCEPTED_ENTAILMENT'],scopeBinding:'CURRENT'};
  return {PROPOSED_EXPRESSION:leaf,NORMALIZED_EXPRESSION:leaf,SEMANTIC_RATIONALE:marker};
 }
 if(collection==='instructionTraces')return {INSTRUCTION_ID:id('instructions')};
 if(collection==='requirements')return {SOURCE_ID:id('sources')};
 if(collection==='evidenceRecords')return {SOURCE_ID:id('sources'),ATTACHMENT_ID:id('artifacts')};
 return {};
}

// Bounded canonical records for logic fixtures use the production identity,
// application field defaults and hash authorities. They are synthetic evidence.
export function canonicalFixtureRecord({engine,schema},project,collection,fields,{scope={},relationships={},stage=schema.RECORD_SCHEMAS[collection].stage}={}){
 const def=schema.RECORD_SCHEMAS[collection],id=engine.allocateId(project,collection,{payload:engine.clone(fields)}),values=engine.clone({...engine.applicationInitialFields(collection),...fields,[def.idField]:id});
 const row=engine.clone({id,stage,active:true,scope:{...engine.currentScope(project),...scope},relationships,fields:values,...values,source:'CONTROLLED_CANONICAL_TARGET_FIXTURE'});
 engine.refreshRecordHashes(row,collection);project.projectData[collection].push(row);return row;
}

// Isolated downstream fixtures supply their authored prerequisites directly.
// Import the review through production ingestion so those fixtures cannot use
// a bare author/raw ID as proof authority. The full-cycle test also authors the
// complete suite through production ingestion and checks every prerequisite.
function reviewSemanticFixture(runtime,project,stage){
 const {engine,prompts,ingestion,schema}=runtime,reviewOperation=stage===6?'PROOF_REVIEW':'SEMANTIC_REVIEW';
 const priorStages=engine.clone(project.stages),author=engine.preparePromptContext(project,stage,{operation:'COMPLETE'}),authorPrompt=prompts.buildPromptRecord(stage,project,author.options);
 project.projectData.generatedPrompts.push(authorPrompt);
 project.projectData.acceptedChanges.push({changeId:'FIXTURE-AUTHORED-REVIEW-'+stage+'-'+project.projectData.acceptedChanges.length,stage,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'COMPLETE',promptId:authorPrompt.instructionId,scope:authorPrompt.scope,source:'CONTROLLED_DOWNSTREAM_PREREQUISITE_FIXTURE'});
 const prepared=engine.preparePromptContext(project,stage,{operation:reviewOperation}),prompt=prompts.buildPromptRecord(stage,project,prepared.options);project.projectData.generatedPrompts.push(prompt);
 const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:project.job.JOB_ID,stage,operation:reviewOperation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{semanticReviews:[recordProposal(schema,'semanticReviews',{tempKey:'fixture-proof-review',overrides:{REVIEW_QUESTION:'Does the controlled prerequisite proof suffice?',FINDING:'The observation-backed proposition requires accepted current evidence of the exact proposition.',REASONING:'Every current required test and expression is included; no alternate weaker branch is permitted.',RESULT:'ACCEPTED'}})]},evidence:[evidence('downstream-fixture-proof-review')],unresolved:[],warnings:[],attachments:[]};
 const proposal=ingestion.prepare(project,{stage,text:JSON.stringify(envelope),promptRecord:prompt});if(!proposal.validation.valid)throw new Error('Fixture proof review failed intake: '+JSON.stringify(proposal.validation.issues));
 Object.assign(project,ingestion.commit(proposal.project,proposal.proposal.proposalId,{operator:'DOWNSTREAM_FIXTURE',replacementConfirmation:ingestion.acceptanceImpact(proposal.project,proposal.proposal.proposalId)}).project);
 // These focused tests retain their explicit, already-controlled prerequisites.
 project.stages=priorStages;
}

export function reviewProofFixture(runtime,project){return reviewSemanticFixture(runtime,project,6);}
export function reviewApplicabilityFixture(runtime,project){return reviewSemanticFixture(runtime,project,5);}

// Otherwise valid Test IR cases at the advertised support limits. Each invalid
// variant changes one value and exceeds only the named limit.
export function testIrLimitFixtures(runtime){
 const limits=runtime.LIMITS,make=steps=>({version:runtime.SPEC_VERSION,steps}),clone=value=>structuredClone(value),encode=text=>new TextEncoder().encode(text);
 const read=[{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'}];
 const artifact=text=>({artifacts:{PRODUCT:{artifactId:'ART-LIMIT',filename:'limit.txt',bytes:encode(text)}},metadata:{bindings:{PRODUCT:{kind:'ARTIFACT',artifactId:'ART-LIMIT'}}}});
 let jsonValue=true;for(let n=0;n<limits.maxSelectorDepth;n++)jsonValue={x:jsonValue};
 const json=make([...clone(read),{op:'PARSE_JSON'},{op:'SELECT_JSON_PATH',path:'$.'+Array(limits.maxSelectorDepth).fill('x').join('.')},{op:'ASSERT_EQ',value:true}]);
 const jsonOver=clone(json);jsonOver.steps[4].path+='.x';
 // Keep the selected element empty: added text would independently exceed the
 // parsed-structure depth limit at the current selector boundary.
 const xml=make([...clone(read),{op:'PARSE_XML'},{op:'SELECT_XML',path:'/'+Array(limits.maxSelectorDepth).fill('n').join('/')},{op:'COUNT'},{op:'ASSERT_EQ',value:1}]);
 const xmlOver=clone(xml);xmlOver.steps[4].path+='/n';
 const bytePattern='é'.repeat(Math.floor(limits.maxRegexPatternBytes/2))+'a'.repeat(limits.maxRegexPatternBytes%2),characterPattern='a'.repeat(limits.maxRegexLength);
 if(bytePattern.length+1>limits.maxRegexLength||encode(characterPattern+'a').length>limits.maxRegexPatternBytes)throw new Error('TEST_IR_LIMIT_FIXTURE_INDEPENDENCE_ORACLE: current regex bounds need independent byte and character fixtures.');
 const regex=pattern=>make([{op:'LOAD_ARTIFACT',binding:'VALUE'},{op:'ASSERT_MATCH',pattern,flags:'u'}]);
 const canonical=value=>({canonicalBindings:{VALUE:{value}},metadata:{bindings:{VALUE:{kind:'CANONICAL_VALUE',canonicalKey:'VALUE'}}}});
 return [
  {caseId:'JSON_SELECTOR_DEPTH',control:json,invalid:jsonOver,expectedIssue:'operation SELECT_JSON_PATH has invalid path.',execution:artifact(JSON.stringify(jsonValue)),limit:limits.maxSelectorDepth},
  {caseId:'XML_SELECTOR_DEPTH',control:xml,invalid:xmlOver,expectedIssue:'operation SELECT_XML has invalid path.',execution:artifact('<n>'.repeat(limits.maxSelectorDepth-1)+'<n/>'+'</n>'.repeat(limits.maxSelectorDepth-1)),limit:limits.maxSelectorDepth},
  {caseId:'REGEX_PATTERN_BYTES',control:regex(bytePattern),invalid:regex(bytePattern+'a'),expectedIssue:'Regex pattern exceeds the registered byte limit.',execution:canonical(bytePattern),limit:limits.maxRegexPatternBytes,controlBytes:encode(bytePattern).length,invalidBytes:encode(bytePattern+'a').length,invalidCharacters:(bytePattern+'a').length},
  {caseId:'REGEX_PATTERN_CHARACTERS',control:regex(characterPattern),invalid:regex(characterPattern+'a'),expectedIssue:'Regex pattern exceeds the registered byte limit.',execution:canonical(characterPattern),limit:limits.maxRegexLength,controlCharacters:characterPattern.length,invalidCharacters:characterPattern.length+1,invalidBytes:encode(characterPattern+'a').length}
 ];
}

// Repository publication metadata only: these screenshot references and visual
// measurements are declared synthetic. The decision and receipt are generated
// by the production command in an isolated project, never a claimed human run.
export function visualBaselineFixture({core,engine,runtime},{commit='a'.repeat(40),sourceCommit=commit,decisionPurpose='VISUAL_BASELINE_AUTHORIZATION',baselineResourcePaths,promptBoxWidth,promptBoxHeight}={}){
 const hash={...runtime.closedLoopHash,sha256Value:value=>runtime.closedLoopHash.sha256Value(engine.clone(value))},paths=['index.html','workbook.js','hash.js','workflow-schema.js','test-runtime.js','test-worker.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','TEST_PROJECT.json','.nojekyll'];
 function manifest(source,resourcePaths=paths){
  const buildIdentity='SYNTHETIC-VISUAL-BUILD-'+source,description={schema:'closed-loop-deployment-manifest/1',sourceCommit:source,buildIdentity,canonicalOrigin:'https://sjonesjones917.github.io',canonicalHost:'sjonesjones917.github.io',canonicalBasePath:'/closed-loop-tracker/',deploymentEnvironment:'github-pages',noCrossOriginRedirect:true,permittedRuntimeOrigin:'SAME_ORIGIN_ONLY',canonicalizationVersion:hash.canonicalizationVersion,runtimeResources:resourcePaths.map(path=>({path,mediaType:'application/octet-stream',byteSize:1,hashAlgorithm:'SHA-256',digest:hash.sha256Value({syntheticResource:path,source}),buildIdentity}))};
  return {...description,manifestDigest:{hashAlgorithm:'SHA-256',digest:hash.sha256Value(description)}};
 }
 const baseline={VISUAL_BASELINE_ID:'DISPOSABLE-VISUAL-BASELINE',sourceCommit,deploymentManifest:manifest(sourceCommit,baselineResourcePaths??paths),viewports:[[320,568],[393,852],[1280,800]].map(([width,height])=>({id:`DISPOSABLE-${width}x${height}`,width,height,promptBox:{width:promptBoxWidth??width-20,height:promptBoxHeight??120,widthBehavior:'Viewport fits without horizontal overflow',heightBehavior:'Intentional bounded prompt scrolling',computedStyles:{width:`${width-20}px`,height:'120px',overflowY:'auto'}},referenceScreenshot:{reference:`DISPOSABLE-BEFORE-${width}x${height}.png`,sha256:hash.sha256Value({syntheticBefore:width,height})}})),allowedChangeRegions:[{id:'DISPOSABLE-ALLOWED',viewportId:'DISPOSABLE-320x568',selector:'#synthetic-required-ui',normativeRequirementReference:'DISPOSABLE-SPECIFICATION-UI-REQUIREMENT'}],dynamicRegions:[{id:'DISPOSABLE-DYNAMIC',viewportId:'DISPOSABLE-393x852',selector:'#synthetic-clock'}]},baselineSha256=hash.sha256Value(baseline);
 const comparison={VISUAL_BASELINE_ID:baseline.VISUAL_BASELINE_ID,baselineSha256,comparedCommit:commit,deploymentManifest:manifest(commit),viewportIds:baseline.viewports.map(row=>row.id),screenshots:baseline.viewports.map(({id,width,height})=>({viewportId:id,reference:`DISPOSABLE-AFTER-${width}x${height}.png`,sha256:hash.sha256Value({syntheticAfter:width,height})})),changedRegionIds:[],ignoredDynamicRegionIds:['DISPOSABLE-DYNAMIC']};
 const project=core.createBlankState('JOB-DISPOSABLE-VISUAL-EVIDENCE');engine.ensureShape(project);
 const authorityRecord=engine.recordRegisteredHumanDecision(project,{purpose:decisionPurpose,targetFamily:'job',targetId:project.job.JOB_ID,value:{authorized:true,VISUAL_BASELINE_ID:baseline.VISUAL_BASELINE_ID,baselineSha256},operatorLabel:'SYNTHETIC-VISUAL-OPERATOR'}),authorityReceipt=project.projectData.history.find(event=>event.eventId===authorityRecord.fields.RECEIPT_ID);
 return JSON.parse(JSON.stringify({status:'PROVEN',sourceCommit,comparedCommit:commit,comparisonResult:'PASS',authority:'VISUAL_BASELINE_AUTHORIZATION',authorityRecordId:authorityRecord.id,evidenceReferences:['DISPOSABLE-APPROVAL','DISPOSABLE-BEFORE-AFTER'],baseline,comparison,authorityRecord,authorityReceipt}));
}

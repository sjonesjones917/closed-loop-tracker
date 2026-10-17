import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {artifactFixtureId} from './test-artifact-fixtures.mjs';

const plain=value=>JSON.parse(JSON.stringify(value));
const digest=value=>createHash('sha256').update(value).digest('hex');
const roles=[[11,'EXECUTE_RUN'],[12,'VERIFY'],[17,'EXECUTE_RUN'],[17,'VERIFY'],[19,'EXECUTE_RUN'],[19,'VERIFY']];

// §26.1/26.2: independent contexts must not receive prior run feedback.
// Prerequisites below are explicitly synthetic, as in the existing relation
// fixture. Only the BLOCKED response, admission and operator commit are real
// production operations; no browser, storage or full prerequisite gate claim.
export async function verifyIndependentRunFeedback({sourceOverrides={},caseFilter=null,onlyCorrectionFeedback=false,onlyDiagnosticFeedback=false,onlyHistoricalFeedback=false,onlyStageSummaryFeedback=false}={}){
 sourceOverrides=Object.fromEntries(['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'].map(file=>[file,sourceOverrides[file]??fs.readFileSync(file,'utf8')]));
 const testSourceSha256=digest(fs.readFileSync(import.meta.filename));
 const r=projectStoreRuntime({sourceOverrides}),{core,engine,prompts,ingestion}=r,schema=r.runtime.closedLoopWorkflowSchema,cases=[];
 function record(family,stage,fields,id,scope){const values={...fields,[schema.RECORD_SCHEMAS[family].idField]:id},row=r.copy({id,stage,active:true,scope:{...scope},fields:values,...values});engine.refreshRecordHashes(row,family);return row;}
 function syntheticPrerequisites(p,stage){for(let n=1;n<stage;n++){p.stages[n].status='COMPLETE';p.stages[n].gate={complete:true,blocked:false,reasons:[]};}}
 function fixture(stage,operation){
  const p=core.createBlankState('JOB-FEEDBACK-'+stage+'-'+operation);Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Apply the current governing instructions independently.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'});engine.ensureShape(p);
  const freezeStage=stage<=12?10:17,runStage=stage<=12?11:stage,aid=artifactFixtureId(engine,p,'candidate');engine.registerArtifactBytes(p,{stage:10,artifactId:aid,filename:'candidate.bin',mediaType:'application/octet-stream',byteSize:1,sha256:'a'.repeat(64)});
  const decision=engine.recordRegisteredHumanDecision(p,{stage:freezeStage,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:r.runtime.closedLoopHash.sha256Value([aid]),value:[aid],operatorLabel:'SYNTHETIC'}),frozen=engine.freezeCandidate(p,{stage:freezeStage,artifactIds:[aid],selectionDecisionId:engine.recordId(decision,'humanDecisions'),operatorLabel:'SYNTHETIC'}),candidateId=engine.recordId(frozen.candidate,'candidateFreezes');let iteration=frozen.iteration;
  if(stage===19){p.stages[18].status='COMPLETE';iteration=engine.beginUnchangedConfirmationIteration(p,{candidateId,operatorLabel:'SYNTHETIC'});}
  const iid=engine.recordId(iteration,'iterations'),scope=engine.scopeForIteration(p,iid);
  p.projectData.requirements.push(record('requirements',4,{MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE',OBLIGATION:'Apply the stated current obligation.'},'REQ-FEEDBACK',scope));
  p.projectData.tests.push(record('tests',6,{REQ_ID:'REQ-FEEDBACK',TEST_TYPE:'MEANING',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'independent semantic review',ARTIFACT_REQUIREMENTS:'NONE',EVIDENCE_TO_PRESERVE:'review observation',STATUS:'READY',VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:12,REQUIRED_BY_STAGE:12,PER_RUN_REQUIRED:true,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'}},'TEST-FEEDBACK',scope));
  const slots=engine.reserveRunBatch(p,{stage:runStage,iterationId:iid,candidateId,count:10});
  for(const [index,slot]of slots.entries()){
   const ctx=p.projectData.freshContexts.find(row=>row.id===slot.contextId),run=p.projectData.runs.find(row=>row.id===slot.runId);
   for(const [key,value]of Object.entries({EXTERNAL_CONTEXT_IDENTIFIER:'synthetic-generator-'+index,CONTAMINATION_STATUS:'NONE',AUTHORIZED_PROJECT_INPUTS:['candidate']}))ctx.fields[key]=ctx[key]=value;
   if(operation==='VERIFY'){for(const [key,value]of Object.entries({CONTAMINATION_CHECK:'NONE',EXECUTION_STATUS:'COMPLETED'}))run.fields[key]=run[key]=value;run.status='COMPLETED';}
   engine.refreshRecordHashes(ctx,'freshContexts');engine.refreshRecordHashes(run,'runs');
  }
  syntheticPrerequisites(p,stage);return {p,stage,operation,slots,iid,scope};
 }
 function promptFor(p,f,index,producer=prompts){const target=f.slots[index],prepared=engine.preparePromptContext(p,f.stage,{operation:f.operation,scope:{runId:target.runId,...(f.operation==='EXECUTE_RUN'?{contextId:target.contextId}:{})}});return producer.buildPromptRecord(f.stage,p,prepared.options);}
 function blockFirstRun(f){
  const p=engine.clone(f.p),prompt=promptFor(p,f,0);p.projectData.generatedPrompts.push(prompt);
  const marker='FORBIDDEN_PREVIOUS_FINDING_'+f.stage+'_'+f.operation;
  const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:f.stage,operation:f.operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'BLOCKED',humanInputRequests:[],humanAuthorityCandidates:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'prior-finding',kind:'MISSING_EVIDENCE',description:marker+': prior actor reported a substantive unmet proposition.',whyBlocking:'Prior actor could not support the required finding.',affectedStageFields:[],affectedRecords:['TEST-FEEDBACK'],blocking:true}],warnings:[],attachments:[]},text=JSON.stringify(envelope),prepared=ingestion.prepare(p,{stage:f.stage,text,promptRecord:prompt});
  assert.equal(prepared.validation.valid,true,'RUN_FEEDBACK_BLOCKED_ADMISSION_ORACLE '+f.stage+' '+f.operation+' '+JSON.stringify(prepared.validation.issues));
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC_FEEDBACK_CONTROL',replacementConfirmation:ingestion.acceptanceImpact(prepared.project,prepared.proposal.proposalId)}).project,raw=committed.projectData.rawResponses.find(row=>row.rawResponseId===prepared.rawRecord.rawResponseId),blocker=committed.projectData.blockers.find(row=>row.rawResponseId===raw.rawResponseId);
  assert.equal(raw.completeRawResponse,text,'RUN_FEEDBACK_RAW_PRESERVATION_SETUP_ORACLE');assert.equal(raw.status,'ACCEPTED_BLOCKER_EVENT','RUN_FEEDBACK_BLOCKER_COMMIT_ORACLE');assert(blocker,'RUN_FEEDBACK_BLOCKER_COMMIT_ORACLE');assert.notEqual(committed.stages[f.stage].status,'COMPLETE','RUN_FEEDBACK_BLOCKED_NOT_COMPLETE_ORACLE');
  // Admission/commit recalculates the synthetic prerequisites. Restore only
  // their disclosed fixture readiness before the independent carrier check.
  syntheticPrerequisites(committed,f.stage);return {p:committed,marker,rawId:raw.rawResponseId,blockerId:blocker.id,pending:prepared};
 }
 function governingControl(p,f){
  const marker='AUTHORIZED_GOVERNING_INPUT_'+f.stage+'_'+f.operation,fields={MISSING_ITEM_TYPE:'MISSING_CAPABILITY',MISSING_FACT_INPUT_AUTHORITY_EVIDENCE_CAPABILITY_DECISION_RULE:marker,AFFECTED_REQUIREMENTS:'REQ-FEEDBACK',AFFECTED_TESTS:'TEST-FEEDBACK',AFFECTED_ARTIFACTS:'STAGE '+f.stage,WHY_WORK_CANNOT_CONTINUE:'Current prerequisite capability is unavailable. '+('Explicit synthetic governing input. '.repeat(2500)),ATTEMPTED_RESOLUTIONS:'NONE',DOWNSTREAM_WORK_STOPPED:'STAGE '+f.stage,OWNER:'HUMAN',STATUS:'OPEN',RESOLUTION_EVIDENCE:'NONE',CLOSURE:'OPEN',REEVALUATION:'REQUIRED',REQUIRED_REVALIDATION:'REQUIRED'},row=record('blockers',8,fields,'BLOCKER-GOVERNING-'+f.stage+'-'+f.operation,f.scope);
  // A typed governing-input projection control, not a claim of a real human
  // action or completed prerequisite. It has no prior-run/response provenance.
  row.source='HUMAN';engine.refreshRecordHashes(row,'blockers');p.projectData.blockers.push(row);return marker;
 }
 function stageSummaryControl(f){
  const p=engine.clone(f.p),governing=governingControl(p,f),prepared=engine.preparePromptContext(p,f.stage,{operation:f.operation,scope:{runId:f.slots[1].runId,...(f.operation==='EXECUTE_RUN'?{contextId:f.slots[1].contextId}:{})}}).options;
  const compareOptions=f.stage===17&&f.operation==='VERIFY'?engine.preparePromptContext(p,17,{operation:'COMPARE'}).options:null;
  const marker='FORBIDDEN_PRIOR_STAGE_SUMMARY_'+f.stage+'_'+f.operation;
  // Explicitly synthetic inputs to the existing derived-feedback owner. This
  // establishes carrier policy, not accepted verification or gate completion.
  p.projectData.acceptedChanges.push(r.copy({acceptedChangeId:'SYNTHETIC-FEEDBACK-'+f.stage+'-'+f.operation,stage:f.stage,status:'COMMITTED',responseType:'DATA_PROPOSAL'}));
  p.stages[f.stage].gate={complete:false,blocked:true,reasons:[marker+': prior comparison concluded that an earlier answer needs correction.']};
  const feedback=engine.stageCompletionFeedback(p,f.stage);assert(feedback.some(row=>row.code==='STAGE_COMPLETION_REQUIRED'&&row.message.includes(marker)),'RUN_STAGE_SUMMARY_OWNER_SETUP_ORACLE');
  const before=plain({acceptedChanges:p.projectData.acceptedChanges,gate:p.stages[f.stage].gate}),prompt=prompts.buildPromptRecord(f.stage,p,prepared),files=prompts.materializePromptContextFiles(prompt,p),carriers=[{name:'instruction.txt',text:prompt.prompt},...files.map(file=>({name:file.path,text:file.text})),{name:'manifest.json',text:JSON.stringify(prompts.promptFileManifest(prompt))},{name:'contextManifest',text:JSON.stringify(prompt.contextManifest)}];
  assert(carriers.some(carrier=>carrier.text.includes(governing)),'RUN_STAGE_SUMMARY_GOVERNING_RETAINED_ORACLE');
  for(const carrier of carriers)assert.equal(carrier.text.includes(marker),false,'RUN_STAGE_SUMMARY_WITHHELD_ORACLE '+f.stage+':'+f.operation+' '+carrier.name);
  assert.deepEqual(plain(prompt.contextManifest.completionFailures),[],'RUN_STAGE_SUMMARY_MANIFEST_EMPTY_ORACLE');
  let compareControl=null;
  if(compareOptions){const comparison=prompts.buildPromptRecord(17,p,compareOptions),comparisonFiles=prompts.materializePromptContextFiles(comparison,p),joined=[comparison.prompt,...comparisonFiles.map(file=>file.text),JSON.stringify(prompts.promptFileManifest(comparison)),JSON.stringify(comparison.contextManifest)].join('\n');assert(joined.includes(marker),'RUN_STAGE_SUMMARY_COMPARE_RETAINS_ORACLE');assert(comparison.contextManifest.completionFailures.some(row=>row.message.includes(marker)),'RUN_STAGE_SUMMARY_COMPARE_MANIFEST_RETAINS_ORACLE');compareControl={operation:'COMPARE',stageSummaryRetained:true};}
  assert.deepEqual(plain({acceptedChanges:p.projectData.acceptedChanges,gate:p.stages[f.stage].gate}),before,'RUN_STAGE_SUMMARY_LOCAL_DERIVED_INPUT_UNCHANGED_ORACLE');
  return {syntheticAcceptedChangeAndGateInput:true,productionStageCompletionFeedbackOwner:true,stageSummaryWithheld:true,manifestCompletionFailures:[],governingInputRetained:true,compareControl};
 }
 function diagnosticControl(f,blocked,{legacyProducer=null}={}){
  const p=engine.clone(f.p),governing=governingControl(p,f),prompt=promptFor(p,f,0);p.projectData.generatedPrompts.push(prompt);
  const marker='FORBIDDEN_PRIOR_DIAGNOSTIC_CONTENT_'+f.stage+'_'+f.operation,wrongJob='FORBIDDEN_PRIOR_JOB_CLAIM_'+f.stage+'_'+f.operation,numericKey='123456789012345678901234567890',family=f.operation==='EXECUTE_RUN'?'runs':'verification',envelope=JSON.parse(blocked.pending.rawRecord.completeRawResponse);
  envelope.promptIdentity={instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature};envelope.scope=prompt.scope;envelope.jobId=wrongJob;envelope.unresolved[0][marker]='Substantive prior review supplied in an invalid property name.';envelope.records[family]=[{...(family==='runs'?{targetId:prompt.scope.runId}:{tempKey:'numeric-diagnostic'}),fields:{[numericKey]:'Substantive prior review encoded in an undeclared numeric field key.'},relationships:{},evidenceRefs:[]}];
  const text=JSON.stringify(envelope),prepared=ingestion.prepare(p,{stage:f.stage,text,promptRecord:prompt});
  assert.equal(prepared.validation.valid,false,'RUN_DIAGNOSTIC_INVALID_ADMISSION_ORACLE');assert(prepared.validation.issues.some(row=>row.code==='UNKNOWN_PROPERTY'&&row.path==='/unresolved/0/'+marker),'RUN_DIAGNOSTIC_UNTRUSTED_PATH_SETUP_ORACLE');assert(prepared.validation.issues.some(row=>row.code==='WRONG_JOB_ID'&&row.message.includes(wrongJob)),'RUN_DIAGNOSTIC_UNTRUSTED_VALUE_SETUP_ORACLE');
  assert(prepared.validation.issues.some(row=>row.code==='UNKNOWN_RECORD_FIELD'&&row.path==='/records/'+family+'/0/fields/'+numericKey),'RUN_DIAGNOSTIC_NUMERIC_KEY_SETUP_ORACLE');
  const next=engine.clone(prepared.project),saved=next.projectData.generatedPrompts.find(row=>row.instructionId===prompt.instructionId);saved.invalidatedBy='SYNTHETIC_PROTOCOL_RETRY';syntheticPrerequisites(next,f.stage);
  const producer=legacyProducer||prompts,before=plain({rawResponses:next.projectData.rawResponses,validations:next.projectData.responseValidations}),replacement=producer.buildPromptRecord(f.stage,next,{operation:f.operation,scope:prompt.scope}),files=producer.materializePromptContextFiles(replacement,next),manifest=producer.promptFileManifest(replacement),carriers=[{name:'instruction.txt',text:replacement.prompt},...files.map(file=>({name:file.path,text:file.text})),{name:'manifest.json',text:JSON.stringify(manifest)}],joined=carriers.map(row=>row.text).join('\n');
  if(legacyProducer){prompts.retainPromptContextFiles(replacement,files);assert.equal(prompts.runPromptContextIsolation(next,replacement).determination,'UNKNOWN','RUN_FEEDBACK_LEGACY_UNTYPED_DIAGNOSTIC_ORACLE');return {legacyUntypedDiagnostic:'UNKNOWN',actualContextFiles:files.length};}
  assert.equal(joined.includes(governing),true,'RUN_DIAGNOSTIC_GOVERNING_RETAINED_ORACLE');assert.equal(joined.includes('UNKNOWN_PROPERTY'),true,'RUN_DIAGNOSTIC_CODE_RETAINED_ORACLE');assert.equal(joined.includes('WRONG_JOB_ID'),true,'RUN_DIAGNOSTIC_ID_CODE_RETAINED_ORACLE');
  // The recognized field path remains actionable without echoing the unknown
  // field name or the supplied wrong identity into the independent context.
  assert.equal(joined.includes('/unresolved/<index-or-unrecognized-property>'),true,'RUN_DIAGNOSTIC_KNOWN_PATH_RETAINED_ORACLE');assert.equal(joined.includes('/jobId'),true,'RUN_DIAGNOSTIC_ID_PATH_RETAINED_ORACLE');assert.equal(joined.includes('/records/'+family+'/<index-or-unrecognized-property>/fields/<index-or-unrecognized-property>'),true,'RUN_DIAGNOSTIC_NUMERIC_STRUCTURAL_PATH_ORACLE');
  for(const carrier of carriers){for(const forbidden of [marker,wrongJob])assert.equal(carrier.text.includes(forbidden),false,'RUN_DIAGNOSTIC_WITHHELD_ORACLE '+f.stage+':'+f.operation+' '+carrier.name);assert.equal(carrier.text.includes(numericKey),false,'RUN_DIAGNOSTIC_NUMERIC_KEY_WITHHELD_ORACLE '+f.stage+':'+f.operation+' '+carrier.name);}
  assert.deepEqual(plain({rawResponses:next.projectData.rawResponses,validations:next.projectData.responseValidations}),before,'RUN_DIAGNOSTIC_LOCAL_EVIDENCE_UNCHANGED_ORACLE');assert.equal(ingestion.findRaw(next,prepared.rawRecord.rawResponseId).completeRawResponse,text,'RUN_DIAGNOSTIC_EXACT_RAW_PRESERVED_ORACLE');
  assert.equal(prompts.runPromptContextIsolation(next,replacement).determination,'CURRENT','RUN_DIAGNOSTIC_CURRENT_CONTRACT_ASSESSMENT_ORACLE');
  return {realInvalidIngestion:true,rawResponseId:prepared.rawRecord.rawResponseId,validationId:prepared.validation.validationId,unknownFieldAndWrongIdentityWithheld:true,numericFieldKeyWithheld:true,codesAndRecognizedPathsRetained:true,fullLocalValidationAndRawPreserved:true,actualContextFiles:files.length};
 }
 function historicalControls(f,blocked){
  let legacySource=sourceOverrides['prompt-engine.js']??fs.readFileSync('prompt-engine.js','utf8');
  // Documented pre-feedback equivalent: preserve shared record authorization,
  // admission and identities; restore only the old standalone feedback paths
  // and their producer epoch. Never modify the saved carrier after generation.
  const mutations=[
   ["const INDEPENDENT_RUN_PROMPT_VERSION='closed-loop-prompt-engine/95';","const INDEPENDENT_RUN_PROMPT_VERSION='closed-loop-prompt-engine/94';"],
   ["const INDEPENDENT_RUN_CONTEXT_VERSION='closed-loop-independent-run-context/2';","const INDEPENDENT_RUN_CONTEXT_VERSION='closed-loop-independent-run-context/1';"],
   ["const authorizedOpen=open.flatMap(record=>{const authorization=contextContentAuthorization(state,{stage,operation,family:'blockers',record,scope});return authorization.allowed?[authorization.record]:[];});","const authorizedOpen=open;"],
   ['const isolated=Boolean(independentFeedbackContextRole(stage,operation)),validationFailures=','const isolated=false,validationFailures=']
  ];
  for(const [before,after]of mutations){assert.equal(legacySource.split(before).length,2,'RUN_FEEDBACK_LEGACY_EQUIVALENT_ANCHOR_ORACLE');legacySource=legacySource.replace(before,after);}
  vm.runInContext(legacySource,r.runtime,{filename:'prompt-engine.js:pre-feedback-equivalent'});const legacy=r.runtime.closedLoopPromptEngine;r.runtime.closedLoopPromptEngine=prompts;
  const usingLegacy=fn=>{r.runtime.closedLoopPromptEngine=legacy;try{return fn();}finally{r.runtime.closedLoopPromptEngine=prompts;}};
  const observe=(p,prompt,expected,label)=>{const files=legacy.materializePromptContextFiles(prompt,p);assert(files.length>0,'RUN_FEEDBACK_LEGACY_EXTERNAL_BYTES_ORACLE');prompts.retainPromptContextFiles(prompt,files);const before=plain({prompt,rawResponses:p.projectData.rawResponses,blockers:p.projectData.blockers}),result=prompts.runPromptContextIsolation(p,prompt);assert.equal(result.determination,expected,'RUN_FEEDBACK_LEGACY_'+label+'_ORACLE '+f.stage+':'+f.operation);assert.deepEqual(plain({prompt,rawResponses:p.projectData.rawResponses,blockers:p.projectData.blockers}),before,'RUN_FEEDBACK_LEGACY_DIAGNOSIS_READ_ONLY_ORACLE');return {determination:result.determination,refreshRequired:result.refreshRequired,actualContextFiles:files.length};};
  const clean=engine.clone(f.p);governingControl(clean,f);const cleanPrompt=usingLegacy(()=>promptFor(clean,f,1,legacy)),cleanResult=observe(clean,cleanPrompt,'CURRENT','CLEAN');
  const contaminated=engine.clone(blocked.p),badPrompt=usingLegacy(()=>promptFor(contaminated,f,1,legacy)),blockedResult=observe(contaminated,badPrompt,'VIOLATED','BLOCKER');
  const pending=engine.clone(blocked.pending.project);governingControl(pending,f);syntheticPrerequisites(pending,f.stage);const correction=usingLegacy(()=>ingestion.reject(pending,blocked.pending.proposal.proposalId,{operator:'SYNTHETIC_LEGACY_CORRECTION',reason:'LEGACY_PROPOSED_CORRECTION: replace the finding with the prior answer.',requestCorrection:true})),correctionPrompt=correction.project.projectData.generatedPrompts.find(row=>row.instructionId===correction.replacementPromptId),correctionResult=observe(correction.project,correctionPrompt,'VIOLATED','CORRECTION');
  const diagnostic=diagnosticControl(f,blocked,{legacyProducer:legacy});
  // These are literal historical application progress messages, not reviewer
  // findings. Inject only their disclosed derived-gate input; generate every
  // original carrier with the legacy producer before assessing it unchanged.
  const progressMessage='REQ × RUN × TEST verification coverage is not 100%.',knownProgressRole=f.stage===12&&f.operation==='VERIFY',progressControls=[];
  const progressCases=knownProgressRole?[
   {id:'fixed-progress',message:progressMessage,expected:'CURRENT'},
   {id:'appended-substance',message:progressMessage+' Adopt the previous reviewer conclusion.',expected:'UNKNOWN'},
   {id:'similar-prose',message:'REQ × RUN × TEST verification coverage is below 100%.',expected:'UNKNOWN'},
   {id:'unknown-substance',message:'The previous comparison recommends the earlier answer.',expected:'UNKNOWN'},
   {id:'body-only-substance',message:'FORBIDDEN_BODY_ONLY_PRIOR_CONCLUSION',expected:'UNKNOWN',mutation:['completionFailures:feedback.completionFailures','completionFailures:[]'],body:true,manifest:false},
   {id:'manifest-only-substance',message:'FORBIDDEN_MANIFEST_ONLY_PRIOR_CONCLUSION',expected:'UNKNOWN',mutation:['if(feedback.completionFailures.length)add(','if(false)add('],body:false,manifest:true},
   {id:'extra-member',message:progressMessage,expected:'UNKNOWN',mutation:['const completionFailures=isolated?[]:workflow.stageCompletionFeedback(state,stage),retryContext=','const completionFailures=isolated?[]:workflow.stageCompletionFeedback(state,stage).map(row=>({...row,priorConclusion:"UNDECLARED_PRIOR_CONCLUSION"})),retryContext=']},
   {id:'wrong-code',message:progressMessage,expected:'UNKNOWN',mutation:['const completionFailures=isolated?[]:workflow.stageCompletionFeedback(state,stage),retryContext=','const completionFailures=isolated?[]:workflow.stageCompletionFeedback(state,stage).map(row=>({...row,code:"UNDECLARED_COMPLETION_CODE"})),retryContext=']},
   {id:'wrong-stage',message:progressMessage,expected:'UNKNOWN',mutation:['const completionFailures=isolated?[]:workflow.stageCompletionFeedback(state,stage),retryContext=','const completionFailures=isolated?[]:workflow.stageCompletionFeedback(state,stage).map(row=>({...row,stage:13})),retryContext=']}
  ]:[{id:'wrong-operation-role',message:progressMessage,expected:'UNKNOWN'}];
  for(const control of progressCases){
   const p=engine.clone(f.p);governingControl(p,f);const target=f.slots[1],prepared=engine.preparePromptContext(p,f.stage,{operation:f.operation,scope:{runId:target.runId,...(f.operation==='EXECUTE_RUN'?{contextId:target.contextId}:{})}});
   p.projectData.acceptedChanges.push(r.copy({acceptedChangeId:'SYNTHETIC-HISTORICAL-PROGRESS-'+control.id,stage:f.stage,status:'COMMITTED',responseType:'DATA_PROPOSAL'}));p.stages[f.stage].gate={complete:false,blocked:true,reasons:[control.message]};
   assert(engine.stageCompletionFeedback(p,f.stage).some(row=>row.code==='STAGE_COMPLETION_REQUIRED'&&row.stage===f.stage&&row.message===control.message),'RUN_FEEDBACK_LEGACY_PROGRESS_OWNER_SETUP_ORACLE');
   let producer=legacy;
   if(control.mutation){const [before,after]=control.mutation;assert.equal(legacySource.split(before).length,2,'RUN_FEEDBACK_LEGACY_PROGRESS_PRODUCER_ANCHOR_ORACLE '+control.id);vm.runInContext(legacySource.replace(before,after),r.runtime,{filename:'prompt-engine.js:historical-progress-'+control.id});producer=r.runtime.closedLoopPromptEngine;r.runtime.closedLoopPromptEngine=prompts;}
   const packet=producer.buildPromptRecord(f.stage,p,prepared.options),files=producer.materializePromptContextFiles(packet,p),body=[packet.prompt,...files.map(file=>file.text)].join('\n'),manifest=JSON.stringify(packet.contextManifest);
   assert.equal(body.includes(control.message),control.body??true,'RUN_FEEDBACK_LEGACY_PROGRESS_BODY_SETUP_ORACLE '+control.id);assert.equal(manifest.includes(control.message),control.manifest??true,'RUN_FEEDBACK_LEGACY_PROGRESS_MANIFEST_SETUP_ORACLE '+control.id);
   prompts.retainPromptContextFiles(packet,files);const before=plain({packet,files,rawResponses:p.projectData.rawResponses,blockers:p.projectData.blockers,acceptedChanges:p.projectData.acceptedChanges,gate:p.stages[f.stage].gate}),assessment=prompts.runPromptContextIsolation(p,packet);
   assert.equal(assessment.determination,control.expected,'RUN_FEEDBACK_LEGACY_PROGRESS_'+control.id.toUpperCase().replaceAll('-','_')+'_ORACLE '+f.stage+':'+f.operation);assert.deepEqual(plain({packet,files,rawResponses:p.projectData.rawResponses,blockers:p.projectData.blockers,acceptedChanges:p.projectData.acceptedChanges,gate:p.stages[f.stage].gate}),before,'RUN_FEEDBACK_LEGACY_PROGRESS_READ_ONLY_ORACLE');
   progressControls.push({caseId:control.id,determination:assessment.determination,refreshRequired:assessment.refreshRequired,bodyCarriesFeedback:control.body??true,manifestCarriesFeedback:control.manifest??true,actualContextFiles:files.length,originalCarriersPreserved:true,syntheticDerivedGateInput:true});
  }
  // Synthetic recorded export is solely a future-context eligibility control.
  // It does not claim that an external actor actually received these bytes.
  let futureContext=null;
  if(f.operation==='VERIFY'){contaminated.projectData.generatedPrompts.push(badPrompt);contaminated.projectData.history.push(r.copy({type:'INSTRUCTION_PACKAGE_EXPORTED',promptId:badPrompt.instructionId}));assert.equal(engine.currentVerificationContext(contaminated,f.stage,f.slots[1].runId,badPrompt.scope.contextId),null,'RUN_FEEDBACK_LEGACY_EXPOSED_FUTURE_CONTEXT_ORACLE');futureContext='REJECTED_AFTER_SYNTHETIC_EXPORT_EVENT';}
  return {preFeedbackEquivalent:true,clean:cleanResult,blocked:blockedResult,correction:correctionResult,diagnostic,progressControls,futureContext,rawAndPacketHistoryPreserved:true};
 }
 for(const [stage,operation]of roles){
  const caseId=stage+':'+operation;if(caseFilter&&caseFilter!==caseId)continue;
  const f=fixture(stage,operation);if(onlyStageSummaryFeedback){cases.push({caseId,passed:true,stageSummaryControl:stageSummaryControl(f)});continue;}const blocked=blockFirstRun(f),governing=governingControl(blocked.p,f),before=plain({rawResponses:blocked.p.projectData.rawResponses,blockers:blocked.p.projectData.blockers}),prompt=promptFor(blocked.p,f,1),files=prompts.materializePromptContextFiles(prompt,blocked.p),manifest=prompts.promptFileManifest(prompt),carriers=[{name:'instruction.txt',text:prompt.prompt},...files.map(file=>({name:file.path,text:file.text})),{name:'manifest.json',text:JSON.stringify(manifest)}],joined=carriers.map(row=>row.text).join('\n');
  if(onlyHistoricalFeedback){cases.push({caseId,passed:true,historicalControls:historicalControls(f,blocked)});continue;}
  const diagnostic=onlyCorrectionFeedback?null:diagnosticControl(f,blocked);
  if(onlyDiagnosticFeedback){cases.push({caseId,passed:true,diagnosticControl:diagnostic});continue;}
  assert.equal(prompt.scope.runId,f.slots[1].runId,'RUN_FEEDBACK_NEXT_RUN_BINDING_ORACLE');assert(files.length>0,'RUN_FEEDBACK_EXTERNALIZED_CONTROL_ORACLE');
  assert.equal(joined.includes(governing),true,'RUN_FEEDBACK_GOVERNING_INPUT_RETAINED_ORACLE '+caseId);
  if(!onlyCorrectionFeedback)for(const carrier of carriers)assert.equal(carrier.text.includes(blocked.marker),false,'RUN_FEEDBACK_WITHHELD_ORACLE '+caseId+' '+carrier.name);
  assert.deepEqual(plain({rawResponses:blocked.p.projectData.rawResponses,blockers:blocked.p.projectData.blockers}),before,'RUN_FEEDBACK_HISTORY_UNCHANGED_ORACLE');
  assert.equal(prompts.runPromptContextIsolation(blocked.p,prompt).determination,'CURRENT','RUN_FEEDBACK_CLEAN_ASSESSMENT_ORACLE');
  // Fork the actual admitted pending response, preserving the operator's
  // correction event locally while withholding its proposed answer from the
  // replacement independent instruction and its manifest.
  const pending=engine.clone(blocked.pending.project),correctionGoverning=governingControl(pending,f),correctionMarker='FORBIDDEN_PROPOSED_CORRECTION_'+caseId,reason=correctionMarker+': revise the substantive answer to the prior reviewer conclusion.',rawBefore=ingestion.findRaw(pending,blocked.rawId).completeRawResponse;
  syntheticPrerequisites(pending,stage);
  const rejected=ingestion.reject(pending,blocked.pending.proposal.proposalId,{operator:'SYNTHETIC_CORRECTION_OPERATOR',reason,requestCorrection:true}),replacement=rejected.project.projectData.generatedPrompts.find(row=>row.instructionId===rejected.replacementPromptId);
  assert(replacement,'RUN_FEEDBACK_REPLACEMENT_CREATED_ORACLE '+caseId);
  assert.equal(rejected.rejected.reason,reason,'RUN_FEEDBACK_LOCAL_CORRECTION_PRESERVED_ORACLE');assert.equal(ingestion.findRaw(rejected.project,blocked.rawId).completeRawResponse,rawBefore,'RUN_FEEDBACK_REJECTED_RAW_PRESERVED_ORACLE');
  const replacementFiles=prompts.materializePromptContextFiles(replacement,rejected.project),replacementManifest=prompts.promptFileManifest(replacement),replacementCarriers=[{name:'instruction.txt',text:replacement.prompt},...replacementFiles.map(file=>({name:file.path,text:file.text})),{name:'manifest.json',text:JSON.stringify(replacementManifest)}],replacementJoined=replacementCarriers.map(row=>row.text).join('\n');
  assert.equal(replacementJoined.includes(correctionGoverning),true,'RUN_FEEDBACK_CORRECTION_GOVERNING_RETAINED_ORACLE '+caseId);
  assert.equal(replacementJoined.includes(rejected.rejected.rejectedResponseId),true,'RUN_FEEDBACK_CORRECTION_IDENTITY_RETAINED_ORACLE '+caseId);
  for(const carrier of replacementCarriers){assert.equal(carrier.text.includes(correctionMarker),false,'RUN_CORRECTION_WITHHELD_ORACLE '+caseId+' '+carrier.name);assert.equal(carrier.text.includes(blocked.marker),false,'RUN_CORRECTION_RAW_WITHHELD_ORACLE '+caseId+' '+carrier.name);}
  const correctionControl={actualRejectAndReplacement:true,rejectedResponseId:rejected.rejected.rejectedResponseId,localReasonAndRawPreserved:true,eventIdentityRetained:true,proposedCorrectionWithheld:true,actualContextFiles:replacementFiles.length};
  let compareControl=null;
  if(stage===17&&operation==='VERIFY'){
   const p=engine.clone(blocked.p),options=engine.preparePromptContext(p,17,{operation:'COMPARE'}).options,comparison=prompts.buildPromptRecord(17,p,options),comparisonFiles=prompts.materializePromptContextFiles(comparison,p),all=[comparison.prompt,...comparisonFiles.map(file=>file.text),JSON.stringify(prompts.promptFileManifest(comparison))].join('\n');
   assert.equal(all.includes(blocked.marker),true,'RUN_FEEDBACK_COMPARISON_RETAINS_FINDING_ORACLE');assert.equal(all.includes(governing),true,'RUN_FEEDBACK_COMPARISON_RETAINS_GOVERNING_ORACLE');compareControl={operation:'COMPARE',priorFindingRetained:true};
  }
  cases.push({caseId,passed:true,realBlockedAdmissionAndCommit:true,priorRun:f.slots[0].runId,nextRun:f.slots[1].runId,originalRawResponseId:blocked.rawId,originalBlockerId:blocked.blockerId,actualContextFiles:files.length,checkedCarriers:carriers.map(row=>({name:row.name,sha256:digest(row.text)})),governingInputRetained:true,priorFindingWithheld:!onlyCorrectionFeedback,rawAndBlockerHistoryUnchanged:true,diagnosticControl:diagnostic,correctionControl,stageSummaryControl:onlyCorrectionFeedback?null:stageSummaryControl(f),compareControl,historicalControls:onlyCorrectionFeedback?null:historicalControls(f,blocked)});
 }
 assert(cases.length>0,'RUN_FEEDBACK_NONEMPTY_CASE_SELECTION_ORACLE');
 return {suite:'independent-run-feedback',synthetic:true,actualBrowser:false,boundary:'Production BLOCKED ingestion and operator commit, invalid-response diagnostics, rejection/replacement, then generated instruction/context/manifest and retained legacy-carrier assessment; prerequisite readiness, governing HUMAN record, accepted-change/gate input for stage-summary projection and historical export event explicitly synthetic. No storage, exported ZIP, real-agent or physical-device claim.',testSourceSha256,sourceSha256:Object.fromEntries(Object.entries(sourceOverrides).map(([file,source])=>[file,digest(source)])),cases};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){const path=process.argv.find(arg=>arg.startsWith('--prompt-source='))?.slice(16),sourceOverrides=path?{'prompt-engine.js':fs.readFileSync(path,'utf8')}:{},caseFilter=process.argv.find(arg=>arg.startsWith('--case='))?.slice(7)||null;console.log(JSON.stringify(await verifyIndependentRunFeedback({sourceOverrides,caseFilter,onlyCorrectionFeedback:process.argv.includes('--corrections-only'),onlyDiagnosticFeedback:process.argv.includes('--diagnostics-only'),onlyHistoricalFeedback:process.argv.includes('--historical-only'),onlyStageSummaryFeedback:process.argv.includes('--stage-summary-only')}),null,2));}

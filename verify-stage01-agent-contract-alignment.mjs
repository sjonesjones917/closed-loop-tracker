import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import {projectStoreRuntime,bindAcceptanceUi} from './test-project-store-runtime.mjs';
import {readStoreArchive} from './test-zip.mjs';
import {reservationScopeFixture} from './test-reservation-scope-fixture.mjs';
import {recordProposal,canonicalFixtureRecord,reviewProofFixture} from './test-fixtures.mjs';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});

const core=closedLoopCore,schema=closedLoopWorkflowSchema,engine=closedLoopWorkflowEngine,prompts=closedLoopPromptEngine,ingestion=closedLoopResponseIngestion;

function project(jobId){
  const p=core.createBlankState(jobId);
  Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Prepare a complete technical filing from the supplied invention description.',EXPLICIT_USER_REQUIREMENTS:'Preserve the user intent and do not ask the user to repair agent JSON.',CURRENT_INPUT_VERSION:'INPUT-v001'});
  engine.ensureShape(p);engine.recalculate(p);return p;
}
function savedPrompt(p){
  const prompt={...prompts.buildPromptRecord(1,p,{operation:'COMPLETE'}),generatedAt:new Date().toISOString()};
  p.projectData.generatedPrompts.push(prompt);return prompt;
}
function captureFor(prompt){
  const manifest=prompt.contextManifest.intakeCoverageManifest;
  return {schema:'closed-loop-stage01-capture/2',inputVersion:manifest.inputVersion,manifestSha256:manifest.manifestSha256,pass1Completed:true,pass2OmissionChallenge:{completed:true,checkedCategories:['QUALIFIERS','EXCEPTIONS','DEPENDENCIES','NEGATIVE_REQUIREMENTS','DO_NOT_CHANGE','VISUAL_CONSTRAINTS','TEMPORAL_CONSTRAINTS','ACCEPTANCE_CONDITIONS','AUTHORITY_STATEMENTS','TOOL_RESTRICTIONS','FILE_REFERENCES','OUTPUT_FORMAT_REQUIREMENTS','CORRECTIONS','LATER_OVERRIDES'],omissionsFound:[],omissionsResolved:true},units:manifest.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'EXTRACTED_RELEVANT_INFORMATION',reason:'Captured exactly once.',extractedStatements:[{statementKey:'statement-'+String(index+1),text:unit.rawValueText||unit.label||unit.unitId,statementClass:'CONTEXT',sourceLocation:unit.sourceLocation}]}))};
}

{
  const parsed=ingestion.strictParse('{"note":"The user answered “yes” and requested the broadest practical coverage."}');
  assert.equal(parsed.note,'The user answered “yes” and requested the broadest practical coverage.','Unicode punctuation inside a valid JSON string was altered or rejected.');
  assert.throws(()=>ingestion.strictParse('{“note”:1}'),error=>error?.code==='UNSAFE_SMART_QUOTES','Curly JSON syntax delimiters must still fail closed.');
}

{
  const descriptor=prompts.responseContractDescriptor(1,'COMPLETE');
  assert.deepEqual(descriptor.envelope.humanAuthorityClassValues,['HUMAN','HUMAN_DECISION']);
  assert.deepEqual(descriptor.envelope.humanDecisionPurposeValues,Object.keys(schema.HUMAN_DECISION_PURPOSE_REGISTRY));
  assert.match(descriptor.envelope.relationshipReferenceRule,/omit.*sourceRef.*attachmentRef|sourceRef.*attachmentRef.*omit/i);
  assert.match(descriptor.envelope.relationshipReferenceRule,/INPUT-UNIT-.*not.*sourceRef/i);
  assert.match(descriptor.envelope.humanAuthorityCandidateRule,/ordinary.*HUMAN/i);
  assert.match(descriptor.envelope.humanAuthorityCandidateRule,/omit decisionPurpose, targetFamily, and targetId/i);
}

{
  const p=project('JOB-STAGE01-CONTRACT-ALIGNMENT');
  const prompt=savedPrompt(p),capture=captureFor(prompt);
  for(const expected of [
    'sourceRef and evidence[].attachmentRef are OPTIONAL',
    'never send null',
    'INPUT-UNIT-* intake accounting IDs are not source records',
    'authorityClass is exactly HUMAN or HUMAN_DECISION',
    'For HUMAN, OMIT decisionPurpose, targetFamily, and targetId'
  ])assert.ok(prompt.prompt.includes(expected),'Stage 01 instruction omitted controlling rule: '+expected);

  const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:1,operation:'COMPLETE',promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},packageId:prompt.packageId||null,operationReservationId:prompt.operationReservationId||null,challengeNonce:prompt.challengeNonce||null,scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],humanAuthorityCandidates:[{temporaryKey:'human-answer-1',label:'Filing breadth preference',value:'Use the broadest practical coverage.',authorityClass:'HUMAN',claimedConversationBasis:'The human supplied this preference in the Stage 01 conversation.',externalResponsePointer:'conversation-message-1',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[]}],stageData:{EXACT_DELIVERABLE_REQUESTED:'Complete technical filing with the broadest practical coverage.',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)},records:{},evidence:[{temporaryKey:'evidence-1',kind:'INTAKE',description:'Stage 01 semantic intake',authorityType:'AGENT_CLAIM',location:'response.json',content:'The user answered “yes”; no canonical sources record or returned attachment applies.'}],unresolved:[],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(envelope),promptRecord:prompt});
  assert.equal(prepared.validation.valid,true,'A contract-conforming Stage 01 response matching the uploaded failure pattern was rejected: '+JSON.stringify(prepared.validation.issues));
}

{
  const p=project('JOB-STAGE01-VALIDATION-REPAIR');
  const prompt=savedPrompt(p);
  p.projectData.responseValidations.push({validationId:'VALIDATION-REPRO',stage:1,promptId:prompt.instructionId,valid:false,issues:[
    {code:'INVALID_EVIDENCE_SOURCE_REF',path:'/evidence/0/sourceRef',message:'sourceRef must be a relationship object.'},
    {code:'UNRESOLVED_EVIDENCE_SOURCE',path:'/evidence/1/sourceRef',message:'Evidence source must resolve to a current active source.'},
    {code:'INVALID_HUMAN_AUTHORITY_CLASS',path:'/humanAuthorityCandidates/0/authorityClass',message:'authorityClass must be HUMAN or HUMAN_DECISION.'},
    {code:'HUMAN_CANDIDATE_DECISION_FIELDS',path:'/humanAuthorityCandidates/1',message:'Decision-specific fields are permitted only when authorityClass is HUMAN_DECISION.'},
    {code:'INVALID_HUMAN_DECISION_PURPOSE',path:'/humanAuthorityCandidates/2/decisionPurpose',message:'A registered HUMAN_DECISION candidate requires a controlled decisionPurpose.'}
  ]});
  const replacement=prompts.buildPromptRecord(1,p,{operation:'COMPLETE'});
  assert.match(replacement.prompt,/APPLICATION VALIDATION REPAIR — CONTROLLING INSTRUCTIONS/);
  assert.match(replacement.prompt,/omit sourceRef entirely; never send null/i);
  assert.match(replacement.prompt,/INPUT-UNIT-.*not source/i);
  assert.match(replacement.prompt,/authorityClass must be exactly HUMAN or HUMAN_DECISION/i);
  assert.match(replacement.prompt,/For authorityClass HUMAN, omit decisionPurpose, targetFamily, and targetId/i);
  assert.match(replacement.prompt,/decisionPurpose must be one of:/i);
}

// Independent values come from controlling Section17.13 and the supported
// unresolved-response contract, not from the production descriptor under test.
let fallbackObservation;
const expectedAnswerTypes=['TEXT','LONG_TEXT','BOOLEAN','NUMBER','CHOICE','MULTI_CHOICE','DATE','FILE_REFERENCE'];
const expectedUnresolvedKinds=['MISSING_HUMAN_INPUT','MISSING_APPLICATION_CONTEXT','INADEQUATE_PRIOR_OUTPUT','MISSING_AUTHORITY','MISSING_EVIDENCE','MISSING_CAPABILITY','WORK_TOO_LARGE_FOR_ENVIRONMENT','MISSING_ARTIFACT','UNRESOLVED_CONFLICT','EXECUTION_FAILURE','TOOL_FAILURE','UNKNOWN'];
{
  const p=project('JOB-CLOSED-FALLBACK-CONTRACT'),prompt=savedPrompt(p),descriptor=prompts.responseContractDescriptor(1,'COMPLETE');
  assert.deepEqual(descriptor.envelope.humanInputAnswerTypeValues,expectedAnswerTypes,'FALLBACK_ENUM_ORACLE: published answer types must match Section17.13');
  assert.deepEqual(descriptor.envelope.unresolvedKindValues,expectedUnresolvedKinds,'FALLBACK_ENUM_ORACLE: published unresolved kinds must match the supported consumer contract');
  for(const value of [...expectedAnswerTypes,...expectedUnresolvedKinds])assert.ok(prompt.prompt.includes('"'+value+'"'),'FALLBACK_ENUM_ORACLE: exact generated instruction omitted '+value);
  const response={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:1,operation:'COMPLETE',promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
  let acceptedControls=0;
  for(const answerType of expectedAnswerTypes){
    const envelope={...response,humanInputRequests:[{temporaryKey:'question-'+answerType,question:'Supply the missing human-authority preference.',whyRequired:'Only the human can establish it.',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],answerType,allowedValues:['CHOICE','MULTI_CHOICE'].includes(answerType)?['FIRST','SECOND']:[],blocking:true}]};
    const result=ingestion.validateEnvelope(p,envelope,{stage:1,promptRecord:prompt,rawSha256:closedLoopHash.rawResponseSha256(JSON.stringify(envelope))});
    assert.equal(result.valid,true,'FALLBACK_CONTROL_ORACLE: '+answerType+' conforming fallback rejected: '+JSON.stringify(result.issues));acceptedControls+=Number(result.valid);
  }
  const invalid={...response,humanInputRequests:[{temporaryKey:'unsupported',question:'Supply the preference.',whyRequired:'Human-only preference.',affectedStageFields:[],affectedRecords:[],answerType:'STRING',allowedValues:[],blocking:true}]};
  const rejected=ingestion.validateEnvelope(p,invalid,{stage:1,promptRecord:prompt,rawSha256:closedLoopHash.rawResponseSha256(JSON.stringify(invalid))});
  assert.equal(rejected.valid,false);const error=rejected.issues.find(row=>row.code==='INVALID_ANSWER_TYPE');assert.ok(error);
  for(const value of expectedAnswerTypes)assert.ok(error.message.includes(value),'FALLBACK_CONTROL_ORACLE: corrective diagnostic omitted '+value);
  const blocked={...response,responseType:'BLOCKED',unresolved:[{temporaryKey:'unsupported-kind',kind:'NOT_A_KIND',description:'A missing supported capability.',whyBlocking:'The result cannot be produced.',affectedStageFields:[],affectedRecords:[],blocking:true}]};
  const badKind=ingestion.validateEnvelope(p,blocked,{stage:1,promptRecord:prompt,rawSha256:closedLoopHash.rawResponseSha256(JSON.stringify(blocked))});
  assert.equal(badKind.valid,false);
  const kindError=badKind.issues.find(row=>row.code==='INVALID_UNRESOLVED_KIND');assert.ok(kindError);
  for(const value of expectedUnresolvedKinds)assert.ok(kindError.message.includes(value),'FALLBACK_CONTROL_ORACLE: corrective diagnostic omitted '+value);
  fallbackObservation={checkId:'BOUNDARY-FALLBACK-CLOSED-ENUMS',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:735','specification/closed-loop-reliability-controlling-implementation-specification.txt:1595'],boundary:'Final generated instruction and deterministic fallback validator',expected:{answerTypes:expectedAnswerTypes,unresolvedKinds:expectedUnresolvedKinds,conformingTypesAccepted:8,unsupportedAnswerAccepted:false,unsupportedKindAccepted:false},observed:{answerTypes:descriptor.envelope.humanInputAnswerTypeValues,unresolvedKinds:descriptor.envelope.unresolvedKindValues,conformingTypesAccepted:acceptedControls,unsupportedAnswerAccepted:rejected.valid,unsupportedKindAccepted:badKind.valid,answerErrorCode:error.code,unresolvedErrorCode:kindError.code},passed:true,violation:'unsupported closed fallback value',accepted:false};
}

// Section10 requires the exact writable contract before the first submission.
// Inspect the final reserved instruction, not a template or the private validator.
// The alphabet and 120-character boundary preserve the current supported key
// format; the canonical evidence schema already declares STRING fields.
const envelopePublicationObservations=[];
{
  const p=project('JOB-CLOSED-ENVELOPE-PUBLICATION'),prompt=prompts.reserveAndBuildPromptRecord(p,1,{operation:'COMPLETE'},{owningTabInstance:'SYNTHETIC-CONTRACT-PUBLICATION'}).prompt;
  const start='RESPONSE CONTRACT DEFINITIONS\n',end='\n\nEND HASHED INSTRUCTION BODY',first=prompt.prompt.indexOf(start),last=prompt.prompt.indexOf(end,first);
  assert.ok(first>=0&&last>first,'EMITTED_ENVELOPE_SETUP_ORACLE: reserved instruction must contain its complete response contract');
  const emitted=ingestion.strictParse(prompt.prompt.slice(first+start.length,last)),objects=[];
  const visit=value=>{if(!value||typeof value!=='object')return;if(!Array.isArray(value))objects.push(value);for(const item of Object.values(value))visit(item);};visit(emitted.envelope);
  const failures=[],check=(name,work)=>{try{work();envelopePublicationObservations.push({name,result:'PASS'});}catch(error){envelopePublicationObservations.push({name,result:'FAIL',message:error.message});failures.push(error);}};
  check('TEMPORARY_KEY_PUBLICATION_ORACLE',()=>{
    const rule=objects.find(value=>value.pattern==='^[A-Za-z][A-Za-z0-9._:-]{0,119}$'&&value.maxLength===120);
    assert.ok(rule,'TEMPORARY_KEY_PUBLICATION_ORACLE: final emitted contract must publish the complete ASCII key grammar and 120-character maximum');
    assert.equal(rule.valueType,'STRING','TEMPORARY_KEY_PUBLICATION_ORACLE: response-local keys are strings');
    const groups=rule.uniqueAcross||rule.uniqueness?.groups;
    assert.ok(Array.isArray(groups),'TEMPORARY_KEY_PUBLICATION_ORACLE: final emitted contract must declare its shared uniqueness groups');
    for(const group of ['records','attachments','evidence','humanInputRequests','humanAuthorityCandidates'])assert.ok(groups.some(value=>String(value).split('.')[0]===group),'TEMPORARY_KEY_PUBLICATION_ORACLE: shared key namespace omitted '+group);
    assert.ok(rule.normalization==='NONE'||rule.normalization==='PRESERVE_EXACT'||rule.normalizationAllowed===false||rule.trim===false&&rule.coerce===false,'TEMPORARY_KEY_PUBLICATION_ORACLE: keys must retain their exact typed identity without silent normalization');
  });
  check('EVIDENCE_STRING_PUBLICATION_ORACLE',()=>{
    const names=['kind','description','location','content','authorityType'],definitions=objects.find(value=>names.every(name=>value[name]&&typeof value[name]==='object'&&value[name].valueType==='STRING'));
    assert.ok(definitions,'EVIDENCE_STRING_PUBLICATION_ORACLE: final emitted contract must publish all five mapped evidence STRING fields');
    for(const name of names){assert.equal(definitions[name].nullable,false,'EVIDENCE_STRING_PUBLICATION_ORACLE: '+name+' must not admit null');assert.equal(definitions[name].required,name!=='authorityType','EVIDENCE_STRING_PUBLICATION_ORACLE: '+name+' requiredness must match the evidence envelope');}
  });
  console.log(JSON.stringify({envelopePublicationObservations,synthetic:true,actualBrowser:false}));
  if(failures.length)throw new AggregateError(failures,'EMITTED_ENVELOPE_CONTRACT_ORACLE: controlling contract is incomplete');
}


// The current producer must disclose the already-enforced conditional reason
// obligation. A pending proposal is not acceptance or semantic completion.
const requiredReasonDispositions=['NO_PROJECT_RELEVANT_INFORMATION','INACCESSIBLE_OR_BLOCKED'];
function emittedReasonPublicationOracle(prompt,runtime=globalThis){
  const start='RESPONSE CONTRACT DEFINITIONS\n',end='\n\nEND HASHED INSTRUCTION BODY',first=prompt.prompt.indexOf(start),last=prompt.prompt.indexOf(end,first);
  assert.ok(first>=0&&last>first,'INTAKE_REASON_PUBLICATION_SETUP_ORACLE: final instruction contract missing');
  const emitted=runtime.closedLoopResponseIngestion.strictParse(prompt.prompt.slice(first+start.length,last));
  assert.deepEqual([...emitted.intakeAccountingContract?.reasonRequiredDispositions||[]],requiredReasonDispositions,'INTAKE_REASON_PUBLICATION_ORACLE: final instruction must publish the complete enforced reason-required disposition set');
  assert.equal(emitted.intakeAccountingContract.reasonOptionalForOtherDispositions,true,'INTAKE_REASON_PUBLICATION_ORACLE: do not add a reason obligation to other dispositions');
  const rule=prompt.prompt.split('\n').find(line=>/nonblank reason.*required.*disposition/i.test(line));
  assert.ok(rule&&requiredReasonDispositions.every(value=>rule.includes(value)),'INTAKE_REASON_PUBLICATION_ORACLE: accounting guidance omitted conditional requiredness');
  assert.ok(!prompt.prompt.includes('"reason":"optional concise reason"'),'INTAKE_REASON_PUBLICATION_ORACLE: accounting shape must not declare reason universally optional');
  return emitted;
}
function reasonEnvelope(runtime,state,prompt,capture){
  const manifest=runtime.closedLoopPromptEngine.promptFileManifest(prompt),schema=runtime.closedLoopWorkflowSchema;
  return {schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:state.job.JOB_ID,stage:1,operation:prompt.operation,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:manifest.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],humanAuthorityCandidates:[],stageData:{EXACT_DELIVERABLE_REQUESTED:state.job.EXACT_USER_OBJECTIVE_VERBATIM,ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)},records:{},evidence:[{temporaryKey:'reason-admission-evidence',kind:'SYNTHETIC_CONTRACT_ADMISSION',description:'Mechanical conditional reason proposal-admission control; not semantic extraction, acceptance or stage completion.',authorityType:'AGENT_CLAIM',location:'verify-stage01-agent-contract-alignment.mjs',content:'Synthetic native admission only; no external execution, human confirmation or accepted result asserted.'}],unresolved:[],warnings:[],attachments:[]};
}
const conditionalReasonObservations=[];
{
  const permissions=Object.values(schema.STAGE_OPERATION_REGISTRY).filter(row=>row.executorClass==='EXTERNAL_AGENT'&&schema.operationContract(row.stage,row.operation)?.allowedStageData?.includes('INPUT_SET_CONTENTS'));
  assert.ok(permissions.length,'INTAKE_REASON_PUBLICATION_SETUP_ORACLE: no intake accounting producer operations');
  for(const operation of permissions){
    const p=project('JOB-REASON-PUBLICATION-'+operation.operation),prompt=prompts.reserveAndBuildPromptRecord(p,operation.stage,{operation:operation.operation},{owningTabInstance:'SYNTHETIC-REASON-CONTRACT'}).prompt;
    const emitted=emittedReasonPublicationOracle(prompt),capture=captureFor(prompt),manifest=prompts.promptFileManifest(prompt);
    assert.equal(closedLoopHash.sha256Value(emitted),manifest.promptIdentity.contractSha256,'INTAKE_REASON_PUBLICATION_ORACLE: final declared rule is not bound to exported contract identity');
    const control=structuredClone(capture);control.units[0]={...control.units[0],disposition:'NO_PROJECT_RELEVANT_INFORMATION',reason:'No project-relevant information.',extractedStatements:[]};
    const omitted=structuredClone(control);delete omitted.units[0].reason;
    const inaccessible=structuredClone(control);inaccessible.units[0].disposition='INACCESSIBLE_OR_BLOCKED';
    const transport={authority:'NONAUTHORITATIVE_TEXT_FALLBACK',materializedAsResponseFile:true,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce},before=closedLoopHash.sha256Value(p);
    const otherwiseOptional=structuredClone(capture);delete otherwiseOptional.units[0].reason;
    const observations=[];
    for(const [name,unitCapture,valid]of [['REASON_PRESENT',control,true],['REASON_OMITTED',omitted,false],['INACCESSIBLE_WITH_REASON',inaccessible,false],['OTHER_DISPOSITION_REASON_OMITTED',otherwiseOptional,true]]){
      const response=reasonEnvelope(globalThis,p,prompt,unitCapture),prepared=ingestion.prepare(p,{stage:operation.stage,text:JSON.stringify(response),promptRecord:prompt,transport});
      assert.equal(prepared.validation.valid,valid,'INTAKE_REASON_ADMISSION_ORACLE: '+name+' produced unexpected pending-proposal admission');
      if(name==='REASON_OMITTED'){assert.equal(prepared.validation.issues.length,1,'INTAKE_REASON_ADMISSION_ORACLE: otherwise-valid omission must identify only its reason defect');assert.match(prepared.validation.issues[0].message,/requires a reason for NO_PROJECT_RELEVANT_INFORMATION/);}
      if(name==='INACCESSIBLE_WITH_REASON')assert.ok(prepared.validation.issues.some(issue=>/inaccessible or blocked.*cannot satisfy Stage 01 completion/.test(issue.message)),'INTAKE_REASON_BLOCKED_ORACLE: an explanatory reason cannot satisfy inaccessible mandatory material');
      assert.equal(prepared.project.projectData.acceptedChanges.length,0,'INTAKE_REASON_ADMISSION_ORACLE: proposal preparation accepted work');assert.notEqual(prepared.project.stages[1].gate?.complete,true,'INTAKE_REASON_ADMISSION_ORACLE: mechanical proposal established completion');
      observations.push({name,valid:prepared.validation.valid,issueCodes:prepared.validation.issues.map(row=>row.code),proposalStatus:prepared.proposal?.status||null});
    }
    assert.equal(closedLoopHash.sha256Value(p),before,'INTAKE_REASON_ADMISSION_ORACLE: preparation mutated its input project');
    conditionalReasonObservations.push({operation:operation.stage+':'+operation.operation,contractHashVerified:true,observations,accepted:false,stageComplete:false});
  }
}

// Use the actual cached UI save owner and production store, not a private
// version-selector fixture. The earlier controlled generation omits only the
// newly disclosed rule and uses its retained /81 generation marker.
const promptSource=fs.readFileSync('prompt-engine.js','utf8'),appSource=fs.readFileSync(process.env.APP_SOURCE||'app-core.js','utf8');
const reasonDescriptorSpread="...(stageFields.includes('INPUT_SET_CONTENTS')?{intakeAccountingContract:{schema:'closed-loop-stage01-capture/2',reasonRequiredDispositions:[...workflow.INTAKE_ACCOUNTING_REASON_REQUIRED_DISPOSITIONS],reasonOptionalForOtherDispositions:true}}:{}),";
const reasonGuidance="\\nA nonblank reason is required when disposition is ${workflow.INTAKE_ACCOUNTING_REASON_REQUIRED_DISPOSITIONS.join(' or ')}; otherwise reason is optional. A reason never makes inaccessible required material complete.";
function legacyReasonPromptSource(source){
  assert.ok(source.includes(reasonDescriptorSpread)&&source.includes(reasonGuidance),'INTAKE_CACHE_SETUP_ORACLE: missing controlled legacy publication anchors');
  return source.replace(/const PROMPT_ENGINE_VERSION='[^']+';/,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/81';").replace(reasonDescriptorSpread,'').replace(reasonGuidance,'').replace('"reason":"concise reason; required for the dispositions specified below, otherwise optional"','"reason":"optional concise reason"');
}
function uiOwner(name){
  const start=appSource.search(new RegExp('(?:async )?function '+name+'\\(')),a=appSource.indexOf('\nfunction ',start+1),b=appSource.indexOf('\nasync function ',start+1),end=Math.min(...[a,b].filter(value=>value>=0));
  assert.ok(start>=0&&end>start,'INTAKE_CACHE_SETUP_ORACLE: actual UI owner missing '+name);return appSource.slice(start,end);
}
const cachedUiOwners=['promptMatches','currentPromptEngineVersion','promptVersionCurrent','currentPromptRecord','savePromptRecord'].map(uiOwner).join('\n');
async function cachedReasonFixture(currentSource,status='RESERVED',storeSource=fs.readFileSync('project-store.js','utf8')){
  const r=projectStoreRuntime({sourceOverrides:{'prompt-engine.js':currentSource,'project-store.js':storeSource}}),currentProducer=r.prompts;
  vm.runInContext(legacyReasonPromptSource(promptSource),r.runtime,{filename:'prompt-engine.js:controlled-legacy-generation'});
  const oldProducer=r.runtime.closedLoopPromptEngine,blank=r.core.createBlankState('JOB-INTAKE-CACHE-'+status);Object.assign(blank.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Preserve the complete current intake.',CURRENT_INPUT_VERSION:'INPUT-v001'});blank.activeStage=1;blank.activeView='Workflow';r.engine.ensureShape(blank);r.engine.recalculate(blank);
  let p=await r.store.writeProject(blank,{expectedProjectRevision:0,incrementRevision:false,createOnly:true}),draft=r.copy(p);
  const old=oldProducer.reserveAndBuildPromptRecord(draft,1,{operation:'COMPLETE'},{owningTabInstance:'SYNTHETIC-INTAKE-CACHE'}).prompt;
  if(status==='EXPORTED')r.engine.transitionOperationReservation(draft.projectData.operationReservations.find(row=>r.engine.recordId(row,'operationReservations')===old.operationReservationId),'EXPORTED');
  p=await r.store.writeProject(draft,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
  r.runtime.closedLoopPromptEngine=currentProducer;
  bindAcceptanceUi(r,p,null);Object.assign(r.runtime,{promptOptions:()=>r.copy({operation:'COMPLETE'}),externalAgentOperation:()=>true,selectedOperation:()=> 'COMPLETE',operationExecutorClass:()=> 'EXTERNAL_AGENT'});
  vm.runInContext(cachedUiOwners+'\nglobalThis.cachedIntakeUi={current:()=>currentPromptRecord(1),save:()=>savePromptRecord(1)};',r.runtime);
  return {r,p,old,oldProducer};
}
async function cachedReasonExportOracle(currentSource,status,storeSource){
  const {r,p,old}=await cachedReasonFixture(currentSource,status,storeSource),before={accepted:r.runtime.closedLoopHash.sha256Value(p.projectData.acceptedChanges),prompt:old.prompt,bodySha256:old.bodySha256,contractSha256:old.contractSha256,contextSignature:old.contextSignature};
  const originalCheckpoint=(await r.store.historyList(p.job.JOB_ID)).activeId;
  assert.equal(r.ingestion.prepareStageContinuation(p,{stage:1,preview:true}),null,'INTAKE_CACHE_SETUP_ORACLE: fixture must exercise a first attempt without retry work');
  let replacement;await assert.doesNotReject(async()=>{try{replacement=await r.runtime.cachedIntakeUi.save();}catch(error){console.log(JSON.stringify({phase:'cached-initial-save',status,errorCode:error.code||null,message:error.message,impact:r.runtime.replacementReview?.impact||null,oldReservation:p.projectData.operationReservations.find(row=>r.engine.recordId(row,'operationReservations')===old.operationReservationId),candidateReservation:r.runtime.replacementReview?.next?.projectData.operationReservations.find(row=>r.engine.recordId(row,'operationReservations')===old.operationReservationId),synthetic:true,actualBrowser:false}));throw error;}},'INTAKE_CACHED_EXPORT_ORACLE: explicit export must refresh an obsolete first request, not collide with its live reservation');
  const current=r.runtime.current;
  assert.notEqual(replacement.instructionId,old.instructionId,'INTAKE_CACHED_EXPORT_ORACLE: deficient cached instruction remained selected');assert.equal(replacement.promptEngineVersion,r.prompts.version,'INTAKE_CACHED_EXPORT_ORACLE: refreshed instruction has obsolete generation');
  const prior=current.projectData.generatedPrompts.find(row=>row.instructionId===old.instructionId);assert.equal(prior.prompt,before.prompt);assert.equal(prior.bodySha256,before.bodySha256);assert.equal(prior.contractSha256,before.contractSha256);assert.equal(prior.contextSignature,before.contextSignature);assert.ok(prior.invalidatedBy,'INTAKE_CACHE_HISTORY_ORACLE: old instruction remains active');
  assert.equal(r.engine.recordValue(current.projectData.operationReservations.find(row=>r.engine.recordId(row,'operationReservations')===old.operationReservationId),'STATUS'),'SUPERSEDED','INTAKE_CACHE_AUTHORITY_ORACLE: exact obsolete reservation did not terminate');
  assert.equal(r.runtime.closedLoopHash.sha256Value(current.projectData.acceptedChanges),before.accepted,'INTAKE_CACHE_HISTORY_ORACLE: refresh changed accepted work');
  const declared=emittedReasonPublicationOracle(replacement,r.runtime),pkg=await r.store.createExecutionPackage({jobId:current.job.JOB_ID,stage:1,operation:'COMPLETE',instructionId:replacement.instructionId}),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),member=name=>members.find(row=>row.canonicalPath===name),manifest=JSON.parse(new TextDecoder().decode(member('manifest.json').bytes));
  assert.equal(new TextDecoder().decode(member('instruction.txt').bytes),replacement.prompt,'INTAKE_CACHED_EXPORT_ORACLE: package does not contain the saved instruction bytes');assert.equal(manifest.promptIdentity.instructionId,replacement.instructionId);assert.equal(manifest.responseContractSha256,r.runtime.closedLoopHash.sha256Value(declared));
  assert.notEqual(replacement.challengeNonce,old.challengeNonce,'INTAKE_CACHE_STALENESS_ORACLE: replacement reused an obsolete challenge');
  const stale=reasonEnvelope(r.runtime,current,old,captureFor(old)),staleCheck=r.ingestion.validateEnvelope(current,r.copy(stale),{stage:1,promptRecord:replacement,rawSha256:r.runtime.closedLoopHash.sha256Text(JSON.stringify(stale))});
  assert.equal(staleCheck.valid,false,'INTAKE_CACHE_STALENESS_ORACLE: old external response was silently accepted under replacement transport');assert.ok(staleCheck.issues.some(issue=>issue.code==='STALE_PROMPT_IDENTITY'),'INTAKE_CACHE_STALENESS_ORACLE: obsolete instruction identity was not rejected');
  const revision=current.revision,count=current.projectData.generatedPrompts.length,reservationCount=current.projectData.operationReservations.length,again=await r.runtime.cachedIntakeUi.save();assert.equal(again.instructionId,replacement.instructionId,'INTAKE_CACHE_REUSE_ORACLE: unchanged save churned identity');assert.equal(r.runtime.current.revision,revision);assert.equal(r.runtime.current.projectData.generatedPrompts.length,count);assert.equal(r.runtime.current.projectData.operationReservations.length,reservationCount);
  const replacementCheckpoint=(await r.store.historyList(p.job.JOB_ID)).activeId,restored=(await r.store.restoreCheckpoint(p.job.JOB_ID,originalCheckpoint,{expectedProjectRevision:r.runtime.current.revision})).project,retainedOld=restored.projectData.generatedPrompts.find(row=>row.instructionId===old.instructionId);
  assert.equal(retainedOld.prompt,before.prompt,'INTAKE_CACHE_RECOVERY_ORACLE: restoring prior issuance changed its exact instruction');assert.equal(retainedOld.bodySha256,before.bodySha256);assert.equal(retainedOld.contractSha256,before.contractSha256);assert.equal(restored.projectData.acceptedChanges.length,0,'INTAKE_CACHE_RECOVERY_ORACLE: transport restoration created accepted work');
  r.runtime.current=restored;r.runtime.projects=r.copy([restored]);const afterRestore=await r.runtime.cachedIntakeUi.save();assert.equal(afterRestore.promptEngineVersion,r.prompts.version,'INTAKE_CACHE_RECOVERY_ORACLE: explicit export after restoration failed to refresh current generation');emittedReasonPublicationOracle(afterRestore,r.runtime);
  assert.ok((await r.store.historyList(p.job.JOB_ID)).entries.some(entry=>entry.id===replacementCheckpoint),'INTAKE_CACHE_RECOVERY_ORACLE: new continuation erased the previous retained issuance');
  return {status,oldGeneration:old.promptEngineVersion,currentGeneration:replacement.promptEngineVersion,exportedBytesVerified:true,oldBytesPreserved:true,acceptedWorkUnchanged:true,unchangedSaveReused:true,obsoleteResponseRejected:true,priorVersionRestoredExactly:true,subsequentFreshSaveValid:true,previousContinuationRetained:true,actualBrowser:false};
}
const cacheObservations=[];
for(const status of ['RESERVED','EXPORTED'])cacheObservations.push(await cachedReasonExportOracle(promptSource,status));

// A malformed or foreign owner must remain guarded. These disposable one-field
// counterexamples deliberately do not represent persisted valid project state.
async function staleAuthorityRejectionOracle(currentSource,kind){
  const {r,p,old}=await cachedReasonFixture(currentSource),state=r.copy(p),reservation=state.projectData.operationReservations.find(row=>r.engine.recordId(row,'operationReservations')===old.operationReservationId),prior=state.projectData.generatedPrompts.find(row=>row.instructionId===old.instructionId);
  if(kind==='EXPECTED_REVISION')reservation.fields.EXPECTED_REVISION=Number(state.revision)+1;
  if(kind==='FOREIGN_JOB')prior.jobId='FOREIGN_JOB';
  if(kind==='FOREIGN_ACTIVATION')prior.historyActivationId='FOREIGN_ACTIVATION';
  if(kind==='FOREIGN_NONCE')prior.challengeNonce='00000000000000000000000000000000';
  if(kind==='CORRUPTED_TEXT')prior.prompt+='corrupted';
  if(kind==='RESPONSE_STAGED'){r.engine.transitionOperationReservation(reservation,'EXPORTED');r.engine.transitionOperationReservation(reservation,'RESPONSE_STAGED');}
  const expectedOwnerStatus=r.engine.recordValue(reservation,'STATUS');
  const before=r.runtime.closedLoopHash.sha256Value(state);
  assert.throws(()=>r.prompts.reserveAndBuildPromptRecord(state,1,{operation:'COMPLETE'}),/An authoritative reservation already controls this target operation slot/,'INTAKE_CACHE_AUTHORITY_REJECTION_ORACLE: '+kind+' must not authorize replacement');
  assert.equal(r.engine.recordValue(reservation,'STATUS'),expectedOwnerStatus,'INTAKE_CACHE_AUTHORITY_REJECTION_ORACLE: malformed or staged old owner was superseded');assert.equal(state.projectData.generatedPrompts.length,p.projectData.generatedPrompts.length);assert.equal(prior.prompt,kind==='CORRUPTED_TEXT'?old.prompt+'corrupted':old.prompt);
  // Allocation preparation may reserve scratch identities before the unchanged
  // guard rejects. It must not accept work or change the old authority.
  assert.equal(state.projectData.acceptedChanges.length,0);return {kind,rejectedByExistingGuard:true,oldOwnerPreserved:true,accepted:false};
}
async function capturedResponseRejectionOracle(currentSource){
  const {r,p,old}=await cachedReasonFixture(currentSource,'EXPORTED'),capture=r.ingestion.captureRaw(p,{stage:1,text:JSON.stringify({synthetic:'Preserved returned response awaiting intake processing'}),promptRecord:old}),state=capture.project,reservation=state.projectData.operationReservations.find(row=>r.engine.recordId(row,'operationReservations')===old.operationReservationId),rawBytes=capture.rawRecord.completeRawResponse,rawHash=capture.rawRecord.sha256,rawSnapshot=r.runtime.closedLoopHash.sha256Value(capture.rawRecord);
  assert.equal(state.projectData.responseProposals.length,0,'INTAKE_CACHE_CAPTURE_SETUP_ORACLE: captured response control already has a proposal');
  assert.equal(r.engine.recordValue(reservation,'STATUS'),'EXPORTED','INTAKE_CACHE_CAPTURE_SETUP_ORACLE: capture unexpectedly staged its owner');
  assert.throws(()=>r.prompts.reserveAndBuildPromptRecord(state,1,{operation:'COMPLETE'}),/An authoritative reservation already controls this target operation slot/,'INTAKE_CACHE_CAPTURE_REJECTION_ORACLE: an existing captured response must retain its live request authority');
  assert.equal(r.engine.recordValue(reservation,'STATUS'),'EXPORTED','INTAKE_CACHE_CAPTURE_REJECTION_ORACLE: captured response owner was superseded');assert.equal(capture.rawRecord.completeRawResponse,rawBytes);assert.equal(capture.rawRecord.sha256,rawHash);assert.equal(r.runtime.closedLoopHash.sha256Value(capture.rawRecord),rawSnapshot);assert.equal(state.projectData.generatedPrompts.length,p.projectData.generatedPrompts.length);assert.equal(state.projectData.acceptedChanges.length,0);
  return {rawStatus:capture.rawRecord.status,authorityStatus:'EXPORTED',capturedBytesPreserved:true,blockedByExistingAuthorityGuard:true,accepted:false};
}
const capturedResponseObservation=await capturedResponseRejectionOracle(promptSource);
const negativeCacheObservations=[];
for(const kind of ['EXPECTED_REVISION','FOREIGN_JOB','FOREIGN_ACTIVATION','FOREIGN_NONCE','CORRUPTED_TEXT','RESPONSE_STAGED'])negativeCacheObservations.push(await staleAuthorityRejectionOracle(promptSource,kind));

// Demonstrate that these final-content and cache gates detect their intended
// faults in isolated existing runtime variants, without editing source files.
const publicationFaultSource=promptSource.replace(reasonDescriptorSpread,'');
{
  const fault=projectStoreRuntime({sourceOverrides:{'prompt-engine.js':publicationFaultSource}}),state=fault.core.createBlankState('JOB-INTAKE-PUBLICATION-FAULT');Object.assign(state.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Preserve complete current intake.',CURRENT_INPUT_VERSION:'INPUT-v001'});fault.engine.ensureShape(state);fault.engine.recalculate(state);const issued=fault.prompts.reserveAndBuildPromptRecord(state,1,{operation:'COMPLETE'}).prompt;
  assert.throws(()=>emittedReasonPublicationOracle(issued,fault.runtime),/INTAKE_REASON_PUBLICATION_ORACLE/,'Conditional reason gate did not detect missing delivered declaration');
}
const noVersionBumpSource=promptSource.replace(/const PROMPT_ENGINE_VERSION='[^']+';/,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/81';");
await assert.rejects(()=>cachedReasonExportOracle(noVersionBumpSource,'RESERVED'),/INTAKE_CACHED_EXPORT_ORACLE/,'Cached instruction gate did not detect omitted generation update');
const refreshStart=promptSource.indexOf('  // A generation change makes a saved first request obsolete'),refreshEnd=promptSource.indexOf('  if(workflow.allocateInstructionIdentity(state,provisional.identityAllocation)',refreshStart);assert.ok(refreshStart>=0&&refreshEnd>refreshStart,'INTAKE_CACHE_SETUP_ORACLE: freshness owner anchor missing');
const noRefreshSource=promptSource.slice(0,refreshStart)+promptSource.slice(refreshEnd);
await assert.rejects(()=>cachedReasonExportOracle(noRefreshSource,'EXPORTED'),/INTAKE_CACHED_EXPORT_ORACLE/,'Cached instruction gate did not detect missing exact supersession');
const expectedRevisionGuard="&&Number(recordValue(reservation,'EXPECTED_REVISION'))===Number(state.revision||0)";assert.ok(promptSource.includes(expectedRevisionGuard),'INTAKE_CACHE_SETUP_ORACLE: expected-revision guard anchor missing');
await assert.rejects(()=>staleAuthorityRejectionOracle(promptSource.replace(expectedRevisionGuard,''),'EXPECTED_REVISION'),/INTAKE_CACHE_AUTHORITY_REJECTION_ORACLE/,'Cached authority gate did not detect bypassed expected-revision validation');
const capturedResponseGuard="      if(safe(state.projectData.rawResponses).some(raw=>!raw.invalidatedBy&&Number(raw.stage)===stage&&raw.promptInstructionId===(record.instructionId||record.promptId)))return false;";assert.ok(promptSource.includes(capturedResponseGuard),'INTAKE_CACHE_SETUP_ORACLE: captured response guard anchor missing');
await assert.rejects(()=>capturedResponseRejectionOracle(promptSource.replace(capturedResponseGuard,'')),/INTAKE_CACHE_CAPTURE_REJECTION_ORACLE/,'Cached authority gate did not detect bypassed captured-response protection');
// Shared reservation freshness also passes through independent-role and
// frozen-run preparation. Native fixture builders supply valid scope identities;
// prerequisite projections below are explicitly synthetic scope-boundary data,
// not a completed workflow or independent external execution.
const sharedContextRefreshObservations=[];
for(const [stage,operation,behaviorClass]of [[5,'COMPLETE','SEMANTIC_AUTHOR'],[5,'SEMANTIC_REVIEW','INDEPENDENT_SEMANTIC_REVIEW'],[9,'COMPLETE','INDEPENDENT_CONTEXT'],[11,'EXECUTE_RUN','FROZEN_RUN']]){
 const r=projectStoreRuntime(),currentProducer=r.prompts;
 vm.runInContext(legacyReasonPromptSource(promptSource),r.runtime,{filename:'prompt-engine.js:controlled-legacy-context-class'});
 const oldProducer=r.runtime.closedLoopPromptEngine,registration=r.runtime.closedLoopWorkflowSchema.STAGE_OPERATION_REGISTRY[stage+':'+operation],fixture=vm.runInContext('('+reservationScopeFixture.toString()+')',r.runtime)({core:r.core,schema:r.runtime.closedLoopWorkflowSchema,engine:r.engine},registration),state=r.copy(fixture.project);
 state.stages[stage-1].status='COMPLETE';state.stages[stage-1].gate=r.copy({complete:true,blocked:false,reasons:[]});
 const options=r.copy({operation,scope:fixture.scope}),old=oldProducer.reserveAndBuildPromptRecord(state,stage,options).prompt,oldBytes=old.prompt,oldBinding=r.copy(old.contextManifest.semanticReviewBinding||{}),priorContexts=r.runtime.closedLoopHash.sha256Value(state.projectData.freshContexts),acceptedBefore=r.runtime.closedLoopHash.sha256Value(state.projectData.acceptedChanges);
 r.runtime.closedLoopPromptEngine=currentProducer;
 const fresh=currentProducer.reserveAndBuildPromptRecord(state,stage,options).prompt;
 assert.notEqual(fresh.instructionId,old.instructionId,'SHARED_REFRESH_CONTEXT_ORACLE: '+behaviorClass+' did not refresh obsolete issuance');assert.equal(fresh.promptEngineVersion,currentProducer.version);assert.equal(old.prompt,oldBytes);assert.equal(r.runtime.closedLoopHash.sha256Value(state.projectData.acceptedChanges),acceptedBefore,'SHARED_REFRESH_CONTEXT_ORACLE: transport refresh accepted role work');
 assert.doesNotThrow(()=>r.engine.assertOperationScope(state,stage,operation,fresh.scope),'SHARED_REFRESH_CONTEXT_ORACLE: role scope was weakened or stale');
 assert.ok(currentProducer.promptTransportBinding(state,stage,operation,fresh.instructionId,fresh.scope),'SHARED_REFRESH_CONTEXT_ORACLE: refreshed role lacks native authority');
 const currentBinding=fresh.contextManifest.semanticReviewBinding||{};
 if(behaviorClass==='INDEPENDENT_SEMANTIC_REVIEW'){assert.ok(currentBinding.reviewerContextId,'SHARED_REFRESH_CONTEXT_ORACLE: reviewer role context absent');assert.equal(currentBinding.reviewerContextId,oldBinding.reviewerContextId,'SHARED_REFRESH_CONTEXT_ORACLE: native unused reviewer choice unexpectedly changed');}
 if(behaviorClass==='FROZEN_RUN'){for(const key of ['candidateId','iterationId','runId','contextId'])assert.equal(fresh.scope[key],old.scope[key],'SHARED_REFRESH_CONTEXT_ORACLE: unchanged frozen-run identity changed '+key);}
 sharedContextRefreshObservations.push({stage,operation,behaviorClass,refreshed:true,nativeScopeAndBindingPreserved:true,contextPolicyUnchanged:priorContexts===r.runtime.closedLoopHash.sha256Value(state.projectData.freshContexts),independenceEstablished:false,runCountContribution:0,fixture:'SYNTHETIC_SCOPE_BOUNDARY_PROJECTION'});
}

// Reuse the existing cheap deferred fixture definition and its authoritative
// canonical builders. This does not run the full timing suite or create a
// separately maintained fixture/schema authority.
const dueSource=fs.readFileSync('verify-due-stage-timing.mjs','utf8'),deferredStart=dueSource.indexOf('async function smallDeferredFixture('),deferredEnd=dueSource.indexOf('async function deferredReservationBoundaries(',deferredStart);assert.ok(deferredStart>=0&&deferredEnd>deferredStart,'SHARED_REFRESH_DEFERRED_SETUP_ORACLE: existing native fixture owner unavailable');
const canonical=(r,p,family,fields,scope={})=>canonicalFixtureRecord({engine:r.engine,schema:r.runtime.closedLoopWorkflowSchema},p,family,fields,{scope});
const smallDeferredFixture=Function('canonical','recordProposal','reviewProofFixture','Blob',dueSource.slice(deferredStart,deferredEnd)+'\nreturn smallDeferredFixture;')(canonical,recordProposal,reviewProofFixture,Blob);
for(const [family,operation]of [['failureTests','EXECUTE_FAILURE_TEST'],['regressions','EXECUTE_REGRESSION']]){
 const r=projectStoreRuntime(),currentProducer=r.prompts,s=r.runtime.closedLoopWorkflowSchema;
 const {p,test,stage}=await smallDeferredFixture(r,{family}),subject=canonical(r,p,family,{...recordProposal(s,family).fields,...Object.fromEntries(s.TIMING_FIELDS.map(key=>[key,r.engine.recordValue(test,key)])),REQ_ID:r.engine.recordValue(test,'REQ_ID'),EXECUTION_TEST_ID:test.id,...(family==='failureTests'?{FIXTURE:'A disposable invalid fixture.',EXPECTED_REJECTION:r.engine.recordValue(test,'EXPECTED_RESULT'),ACTUAL_RESULT:'NOT_RUN',EXECUTION_OUTCOME:'NOT_RUN'}:{FAILURE_FIXTURE:'A preserved invalid fixture.',ACTIVE_RETIRED_STATE:'ACTIVE'})});subject.scope=r.engine.clone(test.scope);r.engine.refreshRecordHashes(subject,family);
 vm.runInContext(legacyReasonPromptSource(promptSource),r.runtime,{filename:'prompt-engine.js:controlled-legacy-deferred-class'});
 const old=r.runtime.closedLoopPromptEngine.reserveAndBuildPromptRecord(p,stage,{operation}).prompt,oldBinding=old.contextManifest.deferredExecutionBinding,definitionHash=r.runtime.closedLoopHash.sha256Value(subject),oldBytes=old.prompt;
 r.runtime.closedLoopPromptEngine=currentProducer;const fresh=currentProducer.reserveAndBuildPromptRecord(p,stage,{operation}).prompt;
 assert.notEqual(fresh.instructionId,old.instructionId,'SHARED_REFRESH_DEFERRED_ORACLE: obsolete conditional work did not receive fresh transport');assert.equal(old.prompt,oldBytes);assert.equal(r.runtime.closedLoopHash.sha256Value(subject),definitionHash,'SHARED_REFRESH_DEFERRED_ORACLE: refreshing transport mutated scheduled definition');const selectedWork=({projectRevision,...binding})=>binding;assert.deepEqual(r.copy(selectedWork(fresh.contextManifest.deferredExecutionBinding)),r.copy(selectedWork(oldBinding)),'SHARED_REFRESH_DEFERRED_ORACLE: replacement changed exact scheduled work binding');assert.equal(fresh.contextManifest.deferredExecutionBinding.projectRevision,oldBinding.projectRevision+1,'SHARED_REFRESH_DEFERRED_ORACLE: new external reservation did not commit exactly one revision');assert.equal(fresh.scope.projectRevision,p.revision,'SHARED_REFRESH_DEFERRED_ORACLE: emitted operation revision does not equal current reservation revision');assert.doesNotThrow(()=>r.engine.assertOperationScope(p,stage,operation,fresh.scope));
 sharedContextRefreshObservations.push({stage,operation,behaviorClass:'DEFERRED_SUBJECT',family,refreshed:true,exactScheduledBindingPreserved:true,definitionUnchanged:true,externalExecutionClaimed:false,fixture:'EXISTING_SMALL_DEFERRED_NATIVE_FIXTURE'});
}

// Confirmation remains mandatory when the candidate changes retained
// issuance bytes or binding metadata. These are exactly-one-violation impact
// counterexamples; actual write admission is independently guarded too.
const transportImpactObservations=[];
for(const faultKind of ['RETAINED_INSTRUCTION_BYTES','RETAINED_RESERVATION_OWNER','CURRENT_OWNER_WITH_RESPONSE']){
 const {r,p,old}=await cachedReasonFixture(promptSource,'EXPORTED'),candidate=r.copy(p),fresh=r.prompts.reserveAndBuildPromptRecord(candidate,1,{operation:'COMPLETE'}).prompt;
 assert.equal(r.store.mutationImpact(p,candidate).requiresConfirmation,false,'INTAKE_TRANSPORT_IMPACT_ORACLE: exact unsubmitted obsolete transport refresh added a human decision');
 if(faultKind==='RETAINED_INSTRUCTION_BYTES')candidate.projectData.generatedPrompts.find(row=>row.instructionId===old.instructionId).prompt+='altered retained bytes';
 if(faultKind==='RETAINED_RESERVATION_OWNER')candidate.projectData.operationReservations.find(row=>r.engine.recordId(row,'operationReservations')===old.operationReservationId).fields.OWNING_TAB_INSTANCE='ALTERED_OWNER';
 if(faultKind==='CURRENT_OWNER_WITH_RESPONSE'){const captured=r.ingestion.captureRaw(p,{stage:1,text:'{}',promptRecord:old});p.projectData.rawResponses=captured.project.projectData.rawResponses;candidate.projectData.rawResponses=r.copy(captured.project.projectData.rawResponses);}
 const impact=r.store.mutationImpact(p,candidate);assert.equal(impact.requiresConfirmation,true,'INTAKE_TRANSPORT_HISTORY_GUARD_ORACLE: '+faultKind+' must retain the existing review boundary');assert.ok(impact.affected.some(item=>item.work.some(work=>work.kind==='operationReservations')),'INTAKE_TRANSPORT_HISTORY_GUARD_ORACLE: non-exempt old transport must appear in review impact');transportImpactObservations.push({faultKind,requiresConfirmation:true,accepted:false});
}
const storeSource=fs.readFileSync('project-store.js','utf8'),transportExemption="if(family==='operationReservations'&&unansweredInstructionTransportReplacement(prior,next,row,replacement))continue;";assert.ok(storeSource.includes(transportExemption),'INTAKE_TRANSPORT_SETUP_ORACLE: exact transport impact owner missing');
await assert.rejects(()=>cachedReasonExportOracle(promptSource,'RESERVED',storeSource.replace(transportExemption,"if(false)continue;")),/INTAKE_CACHED_EXPORT_ORACLE/,'Cached export gate did not detect loss of transport-only impact classification');
const conditionalReasonFaultsDetected=['OMIT_PUBLISHED_REASON_RULE','OMIT_PROMPT_GENERATION_UPDATE','OMIT_EXACT_STALE_AUTHORITY_REFRESH','BYPASS_EXPECTED_REVISION_GUARD','BYPASS_CAPTURED_RESPONSE_GUARD','OMIT_EXACT_TRANSPORT_IMPACT_CLASSIFICATION'];
console.log(JSON.stringify({conditionalReasonPublication:'PASS',conditionalReasonObservations,cachedInitialInstructionRefresh:'PASS',cacheObservations,negativeCacheObservations,capturedResponseObservation,transportImpactObservations,sharedContextRefreshObservations,conditionalReasonFaultsDetected,synthetic:true,actualBrowser:false,realAgent:false,stageCompletionEstablished:false}));

console.log(JSON.stringify({stage01AgentContractAlignment:'PASS',legalUnicodeStringPunctuation:true,smartStructuralDelimitersRejected:true,typedEvidenceReferencesPublished:true,humanAuthorityEnumsPublished:true,validationRepairGuidancePublished:true,conformingStage01ResponseAccepted:true,fallbackAnswerTypesPublished:true,fallbackUnresolvedKindsPublished:true,fallbackControlsValidated:true,envelopePublicationComplete:true,envelopePublicationObservations,conditionalReasonPublication:true,cachedInitialInstructionRefresh:true,conditionalReasonFaultsDetected,verificationObservations:[fallbackObservation]}));

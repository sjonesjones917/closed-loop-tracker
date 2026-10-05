import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import {projectStoreRuntime,bindAcceptanceUi} from './test-project-store-runtime.mjs';
import {readStoreArchive} from './test-zip.mjs';
import {reservationScopeFixture} from './test-reservation-scope-fixture.mjs';
import {deferredDefinitionRestorationFixture} from './test-fixtures.mjs';
import assert from 'node:assert/strict';
import {verifyStage01SpecificationControls} from './test-stage01-specification-controls.mjs';

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
// Controlled /82 equivalent retains its existing conditional reason rule and
// all runtime/business owners. Only the newly structured shared producer
// disclosures are removed; this is not a claim of historical source byte identity.
const sharedBoundaryDescriptorKeys=['echoContract','nestedFieldContracts','relationshipReferenceContract','recordIdentityContract','humanDecisionTargetContract','canonicalJsonContract'];
function legacySharedDescriptorPromptSource(source){
  let legacy=source.replace(/const PROMPT_ENGINE_VERSION='[^']+';/,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/82';");
  for(const [key,owner]of [['echoContract','RESPONSE_ECHO_CONTRACT'],['nestedFieldContracts','RESPONSE_NESTED_FIELD_CONTRACTS'],['relationshipReferenceContract','RESPONSE_RELATIONSHIP_REFERENCE_CONTRACT'],['recordIdentityContract','RESPONSE_RECORD_IDENTITY_CONTRACT'],['humanDecisionTargetContract','HUMAN_DECISION_TARGET_CONTRACT']]){
    const declaration=key+':schema.'+owner+',';assert.equal(legacy.split(declaration).length,2,'INTAKE_SHARED_CACHE_SETUP_ORACLE: missing unique structured disclosure '+key);legacy=legacy.replace(declaration,'');
  }
  const start=legacy.indexOf('canonicalJsonContract:{version:hash.canonicalizationVersion,'),end=legacy.indexOf('relationshipReferenceRule:',start);
  assert.ok(start>=0&&end>start,'INTAKE_SHARED_CACHE_SETUP_ORACLE: canonical disclosure anchor missing');
  return legacy.slice(0,start)+legacy.slice(end);
}
// The final producer epoch must also replace an exact /85 issuance. This
// controlled equivalent preserves every current producer rule and changes only
// its application generation marker; it is not a historical-source reconstruction.
// Content-specific oracles above and the Test IR/deferred-definition owning
// checks establish the changed disclosures separately.
function legacyCurrent85PromptSource(source){
  return source.replace(/const PROMPT_ENGINE_VERSION='[^']+';/,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/85';");
}
function emittedSharedBoundaryContractOracle(emitted,runtime){
  const envelope=JSON.parse(JSON.stringify(emitted.envelope)),echo=envelope.echoContract,nested=envelope.nestedFieldContracts;
  assert.equal(echo?.normalization,'NONE','INTAKE_SHARED_CONTRACT_PUBLICATION_ORACLE: echo normalization must be explicit');
  for(const [group,names,type]of [['envelopeFields',['jobId','operation'],'STRING'],['envelopeFields',['stage'],'INTEGER'],['promptIdentityFields',['instructionId','bodySha256','contractSha256','contextSignature'],'STRING'],['reservationIdentityFields',['packageId','operationReservationId','challengeNonce'],'STRING']])for(const name of names)assert.deepEqual(echo[group]?.[name],{valueType:type,nullable:false},'INTAKE_SHARED_CONTRACT_PUBLICATION_ORACLE: missing typed echo '+group+'.'+name);
  for(const [family,names,type]of [['attachments',['sha256'],'STRING'],['humanInputRequests',['question','whyRequired'],'STRING'],['humanAuthorityCandidates',['label','claimedConversationBasis','externalResponsePointer'],'STRING'],['unresolved',['temporaryKey','description','whyBlocking'],'STRING'],['warnings',['code','message','path'],'STRING'],['humanInputRequests',['affectedStageFields','affectedRecords'],'STRING_ARRAY'],['humanAuthorityCandidates',['affectedStageFields','affectedRecords'],'STRING_ARRAY'],['unresolved',['affectedStageFields','affectedRecords'],'STRING_ARRAY']])for(const name of names)assert.deepEqual(nested?.[family]?.[name],{valueType:type,nullable:false,required:true,...(type==='STRING_ARRAY'?{emptyArrayAllowed:true}:{})},'INTAKE_SHARED_CONTRACT_PUBLICATION_ORACLE: missing nested shape '+family+'.'+name);
  for(const [key,allowedKeys]of [['relationshipReferenceContract',['tempKey','recordId']],['recordIdentityContract',['tempKey','targetId']]]){
    const rule=envelope[key];assert.deepEqual(rule?.allowedKeys,allowedKeys,'INTAKE_SHARED_CONTRACT_PUBLICATION_ORACLE: missing identity keys '+key);assert.equal(rule.identityMemberCount,1);assert.equal(rule.identityValueType,'STRING');assert.equal(rule.nullable,false);assert.equal(rule.empty,false);assert.equal(rule.normalization,'NONE');
  }
  const target=envelope.humanDecisionTargetContract;
  assert.equal(target?.fields.decisionPurpose.type,'STRING','INTAKE_SHARED_CONTRACT_PUBLICATION_ORACLE: target purpose type absent');assert.equal(target.fields.decisionPurpose.normalization,'NONE');assert.equal(target.fields.targetFamily.type,'STRING');assert.equal(target.fields.targetId.type,'STRING');assert.equal(target.fields.targetId.nonempty,true);
  assert.equal(target.forms.CURRENT_JOB.targetId,'EXACT_CURRENT_JOB_ID');assert.equal(target.forms.CURRENT_CANONICAL_RECORD.targetId,'EXACT_CURRENT_CANONICAL_RECORD_ID');assert.equal(target.forms.ARTIFACT_SET_SELECTION.targetId,'SHA256_OF_CANONICAL_JSON_OF_SORTED_ARTIFACT_IDS');assert.equal(target.forms.ARTIFACT_SET_SELECTION.sort,'ECMASCRIPT_DEFAULT_STRING_SORT_OF_APPLICATION_ARTIFACT_IDS');assert.equal(target.forms.ARTIFACT_SET_SELECTION.identityAuthority,'APPLICATION_REDERIVED_BINDING_DIGEST_OF_EXACT_SELECTED_IDS');
  assert.equal(envelope.canonicalJsonContract?.version,runtime.closedLoopHash.canonicalizationVersion,'INTAKE_SHARED_CONTRACT_PUBLICATION_ORACLE: canonical encoding version absent');assert.match(envelope.canonicalJsonContract.unicode,/Unicode scalar.*unpaired UTF-16/);assert.match(envelope.canonicalJsonContract.numbers,/safe integers.*-0.*non-finite.*non-integer/);
  return sharedBoundaryDescriptorKeys.length;
}
function uiOwner(name){
  const start=appSource.search(new RegExp('(?:async )?function '+name+'\\(')),a=appSource.indexOf('\nfunction ',start+1),b=appSource.indexOf('\nasync function ',start+1),end=Math.min(...[a,b].filter(value=>value>=0));
  assert.ok(start>=0&&end>start,'INTAKE_CACHE_SETUP_ORACLE: actual UI owner missing '+name);return appSource.slice(start,end);
}
const cachedUiOwners=['promptMatches','currentPromptEngineVersion','promptVersionCurrent','currentPromptRecord','savePromptRecord'].map(uiOwner).join('\n');
async function cachedReasonFixture(currentSource,status='RESERVED',storeSource=fs.readFileSync('project-store.js','utf8'),legacyKind='REASON81'){
  const r=projectStoreRuntime({sourceOverrides:{'prompt-engine.js':currentSource,'project-store.js':storeSource}}),currentProducer=r.prompts;
  vm.runInContext(legacyKind==='GENERATION85'?legacyCurrent85PromptSource(promptSource):legacyKind==='SHARED82'?legacySharedDescriptorPromptSource(promptSource):legacyReasonPromptSource(promptSource),r.runtime,{filename:'prompt-engine.js:controlled-legacy-generation-'+legacyKind});
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
async function cachedReasonExportOracle(currentSource,status,storeSource,legacyKind='REASON81'){
  const {r,p,old}=await cachedReasonFixture(currentSource,status,storeSource,legacyKind),before={accepted:r.runtime.closedLoopHash.sha256Value(p.projectData.acceptedChanges),prompt:old.prompt,bodySha256:old.bodySha256,contractSha256:old.contractSha256,contextSignature:old.contextSignature};
  if(legacyKind==='SHARED82'){
    const legacyDeclared=emittedReasonPublicationOracle(old,r.runtime);assert.equal(old.promptEngineVersion,'closed-loop-prompt-engine/82','INTAKE_SHARED_CACHE_SETUP_ORACLE: old equivalent must use /82');for(const key of sharedBoundaryDescriptorKeys)assert.equal(Object.hasOwn(legacyDeclared.envelope,key),false,'INTAKE_SHARED_CACHE_SETUP_ORACLE: legacy equivalent already includes '+key);
  }
  if(legacyKind==='GENERATION85'){
    assert.equal(old.promptEngineVersion,'closed-loop-prompt-engine/85','INTAKE_EPOCH85_CACHE_SETUP_ORACLE: exact old generation absent');
    emittedSharedBoundaryContractOracle(emittedReasonPublicationOracle(old,r.runtime),r.runtime);
  }
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
  const packagedDeclared=emittedReasonPublicationOracle({prompt:new TextDecoder().decode(member('instruction.txt').bytes)},r.runtime),sharedContractsPublished=emittedSharedBoundaryContractOracle(packagedDeclared,r.runtime);assert.deepEqual(packagedDeclared,declared,'INTAKE_SHARED_CONTRACT_PUBLICATION_ORACLE: packaged declarations differ from saved instruction');
  assert.notEqual(replacement.challengeNonce,old.challengeNonce,'INTAKE_CACHE_STALENESS_ORACLE: replacement reused an obsolete challenge');
  const stale=reasonEnvelope(r.runtime,current,old,captureFor(old)),staleCheck=r.ingestion.validateEnvelope(current,r.copy(stale),{stage:1,promptRecord:replacement,rawSha256:r.runtime.closedLoopHash.sha256Text(JSON.stringify(stale))});
  assert.equal(staleCheck.valid,false,'INTAKE_CACHE_STALENESS_ORACLE: old external response was silently accepted under replacement transport');assert.ok(staleCheck.issues.some(issue=>issue.code==='STALE_PROMPT_IDENTITY'),'INTAKE_CACHE_STALENESS_ORACLE: obsolete instruction identity was not rejected');
  const revision=current.revision,count=current.projectData.generatedPrompts.length,reservationCount=current.projectData.operationReservations.length,again=await r.runtime.cachedIntakeUi.save();assert.equal(again.instructionId,replacement.instructionId,'INTAKE_CACHE_REUSE_ORACLE: unchanged save churned identity');assert.equal(r.runtime.current.revision,revision);assert.equal(r.runtime.current.projectData.generatedPrompts.length,count);assert.equal(r.runtime.current.projectData.operationReservations.length,reservationCount);
  const replacementCheckpoint=(await r.store.historyList(p.job.JOB_ID)).activeId,restored=(await r.store.restoreCheckpoint(p.job.JOB_ID,originalCheckpoint,{expectedProjectRevision:r.runtime.current.revision})).project,retainedOld=restored.projectData.generatedPrompts.find(row=>row.instructionId===old.instructionId);
  assert.equal(retainedOld.prompt,before.prompt,'INTAKE_CACHE_RECOVERY_ORACLE: restoring prior issuance changed its exact instruction');assert.equal(retainedOld.bodySha256,before.bodySha256);assert.equal(retainedOld.contractSha256,before.contractSha256);assert.equal(restored.projectData.acceptedChanges.length,0,'INTAKE_CACHE_RECOVERY_ORACLE: transport restoration created accepted work');
  r.runtime.current=restored;r.runtime.projects=r.copy([restored]);const afterRestore=await r.runtime.cachedIntakeUi.save();assert.equal(afterRestore.promptEngineVersion,r.prompts.version,'INTAKE_CACHE_RECOVERY_ORACLE: explicit export after restoration failed to refresh current generation');emittedReasonPublicationOracle(afterRestore,r.runtime);
  assert.ok((await r.store.historyList(p.job.JOB_ID)).entries.some(entry=>entry.id===replacementCheckpoint),'INTAKE_CACHE_RECOVERY_ORACLE: new continuation erased the previous retained issuance');
  return {status,legacyKind,oldGeneration:old.promptEngineVersion,currentGeneration:replacement.promptEngineVersion,exportedBytesVerified:true,sharedContractsPublished,oldBytesPreserved:true,acceptedWorkUnchanged:true,acceptedChangeCountBefore:p.projectData.acceptedChanges.length,unchangedSaveReused:true,obsoleteResponseRejected:true,priorVersionRestoredExactly:true,subsequentFreshSaveValid:true,previousContinuationRetained:true,actualBrowser:false};
}
const cacheObservations=[];
for(const status of ['RESERVED','EXPORTED'])cacheObservations.push(await cachedReasonExportOracle(promptSource,status));
const sharedDescriptorCacheObservations=[];
for(const status of ['RESERVED','EXPORTED'])sharedDescriptorCacheObservations.push(await cachedReasonExportOracle(promptSource,status,undefined,'SHARED82'));

const current85CacheObservations=[];
for(const status of ['RESERVED','EXPORTED'])current85CacheObservations.push(await cachedReasonExportOracle(promptSource,status,undefined,'GENERATION85'));
for(const status of ['RESERVED','EXPORTED'])await assert.rejects(()=>cachedReasonExportOracle(legacyCurrent85PromptSource(promptSource),status,undefined,'GENERATION85'),/INTAKE_CACHED_EXPORT_ORACLE/,'Current /85 cache gate did not detect an omitted producer epoch change for '+status);
console.log(JSON.stringify({current85CacheObservations,current85NoVersionBumpDetected:true,onlyOldGenerationChanged:true,contentDisclosureCoverage:'Separate owning producer/runtime/deferred-definition assertions',actualBrowser:false}));

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
const noSharedVersionBumpSource=promptSource.replace(/const PROMPT_ENGINE_VERSION='[^']+';/,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/82';"),sharedDescriptorFaultsDetected=[];
for(const status of ['RESERVED','EXPORTED']){await assert.rejects(()=>cachedReasonExportOracle(noSharedVersionBumpSource,status,undefined,'SHARED82'),/INTAKE_CACHED_EXPORT_ORACLE/,'Shared descriptor cached gate did not detect omitted /83 generation update for '+status);sharedDescriptorFaultsDetected.push({kind:'OMIT_SHARED_DESCRIPTOR_PROMPT_GENERATION_UPDATE',status,detectedBy:'INTAKE_CACHED_EXPORT_ORACLE'});}
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

// Restore genuinely admitted author work with its raw response, current review,
// accepted identity and actual bytes. A direct canonical fixture no longer
// qualifies the newly mandatory deferred-definition compatibility contract.
for(const [family,operation]of [['failureTests','EXECUTE_FAILURE_TEST'],['regressions','EXECUTE_REGRESSION']]){
 const r=projectStoreRuntime(),currentProducer=r.prompts;
 const {p,subject,stage}=await deferredDefinitionRestorationFixture(r,{family});
 vm.runInContext(legacyReasonPromptSource(promptSource),r.runtime,{filename:'prompt-engine.js:controlled-legacy-deferred-class'});
 const old=r.runtime.closedLoopPromptEngine.reserveAndBuildPromptRecord(p,stage,{operation}).prompt,oldBinding=old.contextManifest.deferredExecutionBinding,definitionHash=r.runtime.closedLoopHash.sha256Value(subject),oldBytes=old.prompt;
 r.runtime.closedLoopPromptEngine=currentProducer;const fresh=currentProducer.reserveAndBuildPromptRecord(p,stage,{operation}).prompt;
 assert.notEqual(fresh.instructionId,old.instructionId,'SHARED_REFRESH_DEFERRED_ORACLE: obsolete conditional work did not receive fresh transport');assert.equal(old.prompt,oldBytes);assert.equal(r.runtime.closedLoopHash.sha256Value(subject),definitionHash,'SHARED_REFRESH_DEFERRED_ORACLE: refreshing transport mutated scheduled definition');const selectedWork=({projectRevision,...binding})=>binding;assert.deepEqual(r.copy(selectedWork(fresh.contextManifest.deferredExecutionBinding)),r.copy(selectedWork(oldBinding)),'SHARED_REFRESH_DEFERRED_ORACLE: replacement changed exact scheduled work binding');assert.equal(fresh.contextManifest.deferredExecutionBinding.projectRevision,oldBinding.projectRevision+1,'SHARED_REFRESH_DEFERRED_ORACLE: new external reservation did not commit exactly one revision');assert.equal(fresh.scope.projectRevision,p.revision,'SHARED_REFRESH_DEFERRED_ORACLE: emitted operation revision does not equal current reservation revision');assert.doesNotThrow(()=>r.engine.assertOperationScope(p,stage,operation,fresh.scope));
 sharedContextRefreshObservations.push({stage,operation,behaviorClass:'DEFERRED_SUBJECT',family,refreshed:true,exactScheduledBindingPreserved:true,definitionUnchanged:true,externalExecutionClaimed:false,fixture:'RETAINED_ACTUALLY_ADMITTED_SUPPORTED_DEFERRED_DEFINITION',authorRawAndAcceptedBindingPreserved:true});
}

// A controlled /84 equivalent omits the newly completed governing-defect
// support carrier. The existing author work is genuinely admitted and retained;
// this is producer-cache recovery evidence, not historical source byte identity.
function legacyDefinitionCarrierPromptSource(source){
 const anchor="deferredDefinitionWriter(stage,operation)&&collection==='defects'?";assert.equal(source.split(anchor).length,2,'DEFINITION_CARRIER_CACHE_SETUP_ORACLE: governing support carrier anchor missing');
 return source.replace(/const PROMPT_ENGINE_VERSION='[^']+';/,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/84';").replace(anchor,'false?');
}
function definitionPackageRows(members,family){
 const manifest=JSON.parse(Buffer.from(members.find(row=>row.canonicalPath==='manifest.json').bytes).toString('utf8')),instruction=Buffer.from(members.find(row=>row.canonicalPath==='instruction.txt').bytes).toString('utf8'),blocks=[];
 for(const match of instruction.matchAll(/BEGIN_UNTRUSTED_DATA_BLOCK\s*([\s\S]*?)\s*END_UNTRUSTED_DATA_BLOCK/g))blocks.push(JSON.parse(match[1]));
 for(const file of manifest.contextFiles||[])for(const block of JSON.parse(Buffer.from(members.find(row=>row.canonicalPath===file.path).bytes).toString('utf8')).members||[])blocks.push(block);
 const block=blocks.find(row=>row.sourceIdentity==='collection.'+family);return block?JSON.parse(block.value).records:[];
}
async function cachedDefinitionCarrierOracle(currentSource,status){
 const r=projectStoreRuntime({sourceOverrides:{'prompt-engine.js':currentSource}}),currentProducer=r.prompts,{p:restored}=await deferredDefinitionRestorationFixture(r,{family:'regressions'});restored.activeStage=15;restored.activeView='Workflow';
 let p=await r.store.writeProject(restored,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
 vm.runInContext(legacyDefinitionCarrierPromptSource(promptSource),r.runtime,{filename:'prompt-engine.js:controlled-84-governing-defect-carrier'});
 const oldProducer=r.runtime.closedLoopPromptEngine,draft=r.copy(p),old=oldProducer.reserveAndBuildPromptRecord(draft,15,{operation:'COMPLETE'}).prompt;
 if(status==='EXPORTED')r.engine.transitionOperationReservation(draft.projectData.operationReservations.find(row=>r.engine.recordId(row,'operationReservations')===old.operationReservationId),'EXPORTED');
 p=await r.store.writeProject(draft,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 const oldPackage=await r.store.createExecutionPackage({jobId:p.job.JOB_ID,stage:15,operation:'COMPLETE',instructionId:old.instructionId}),oldMembers=readStoreArchive(new Uint8Array(await oldPackage.blob.arrayBuffer()));assert(definitionPackageRows(oldMembers,'defects').length);assert(definitionPackageRows(oldMembers,'defects').every(row=>!Object.hasOwn(row,'evidenceRefs')),'DEFINITION_CARRIER_CACHE_SETUP_ORACLE: old packet already supplies governing support');
 const before={accepted:r.runtime.closedLoopHash.sha256Value(p.projectData.acceptedChanges),definitions:r.runtime.closedLoopHash.sha256Value(p.projectData.regressions),raw:r.runtime.closedLoopHash.sha256Value(p.projectData.rawResponses),prompt:old.prompt,bodySha256:old.bodySha256,contractSha256:old.contractSha256,contextSignature:old.contextSignature};
 r.runtime.closedLoopPromptEngine=currentProducer;bindAcceptanceUi(r,p,null);Object.assign(r.runtime,{promptOptions:()=>r.copy({operation:'COMPLETE'}),externalAgentOperation:()=>true,selectedOperation:()=> 'COMPLETE',operationExecutorClass:()=> 'EXTERNAL_AGENT'});vm.runInContext(cachedUiOwners+'\nglobalThis.cachedDefinitionUi={save:()=>savePromptRecord(15)};',r.runtime);
 const fresh=await r.runtime.cachedDefinitionUi.save(),current=r.runtime.current;assert.notEqual(fresh.instructionId,old.instructionId,'DEFINITION_CARRIER_CACHE_REFRESH_ORACLE: old deficient author packet remained selected');assert.equal(fresh.promptEngineVersion,r.prompts.version);
 const prior=current.projectData.generatedPrompts.find(row=>row.instructionId===old.instructionId);for(const key of ['prompt','bodySha256','contractSha256','contextSignature'])assert.equal(prior[key],before[key],'DEFINITION_CARRIER_CACHE_HISTORY_ORACLE: old '+key+' changed');assert(prior.invalidatedBy);assert.equal(r.engine.recordValue(current.projectData.operationReservations.find(row=>row.id===old.operationReservationId),'STATUS'),'SUPERSEDED');for(const [family,key]of [['acceptedChanges','accepted'],['regressions','definitions'],['rawResponses','raw']])assert.equal(r.runtime.closedLoopHash.sha256Value(current.projectData[family]),before[key],'DEFINITION_CARRIER_CACHE_HISTORY_ORACLE: refresh mutated retained '+family);
 const pkg=await r.store.createExecutionPackage({jobId:current.job.JOB_ID,stage:15,operation:'COMPLETE',instructionId:fresh.instructionId}),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),defects=definitionPackageRows(members,'defects'),provided=new Set(definitionPackageRows(members,'evidenceRecords').map(row=>row.id));assert(defects.length);assert(defects.every(row=>Array.isArray(row.evidenceRefs)&&row.evidenceRefs.length&&row.evidenceRefs.every(id=>provided.has(id))&&row.unavailableEvidenceRefCount===0),'DEFINITION_CARRIER_PUBLICATION_ORACLE: fresh actual package omits its governing authorized evidence');assert.equal(Buffer.from(members.find(row=>row.canonicalPath==='instruction.txt').bytes).toString('utf8'),fresh.prompt);
 const oldManifest=oldProducer.promptFileManifest(old),blocked={schema:r.runtime.closedLoopWorkflowSchema.RESPONSE_SCHEMA,contractProfileId:r.runtime.closedLoopWorkflowSchema.CONTRACT_PROFILE_ID,jobId:current.job.JOB_ID,stage:15,operation:'COMPLETE',promptIdentity:oldManifest.promptIdentity,packageId:oldManifest.packageId,operationReservationId:oldManifest.operationReservationId,challengeNonce:oldManifest.challengeNonce,scope:oldManifest.scope,responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'old-missing-defect-support',kind:'MISSING_APPLICATION_CONTEXT',description:'The old saved packet omits the governing defect support identities.',whyBlocking:'A response cannot bind the required support from that incomplete packet.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]},stale=r.ingestion.validateEnvelope(current,r.copy(blocked),{stage:15,promptRecord:fresh,rawSha256:r.runtime.closedLoopHash.sha256Text(JSON.stringify(blocked))});assert.equal(stale.valid,false);assert(stale.issues.some(row=>row.code==='STALE_PROMPT_IDENTITY'),'DEFINITION_CARRIER_CACHE_STALENESS_ORACLE: old author response remained authoritative');
 const revision=current.revision,count=current.projectData.generatedPrompts.length,reservations=current.projectData.operationReservations.length,again=await r.runtime.cachedDefinitionUi.save();assert.equal(again.instructionId,fresh.instructionId,'DEFINITION_CARRIER_CACHE_REUSE_ORACLE');assert.equal(r.runtime.current.revision,revision);assert.equal(r.runtime.current.projectData.generatedPrompts.length,count);assert.equal(r.runtime.current.projectData.operationReservations.length,reservations);
 return {status,stage:15,operation:'COMPLETE',oldGeneration:old.promptEngineVersion,currentGeneration:fresh.promptEngineVersion,oldActualPackageOmittedSupport:true,freshActualPackagePublishedSupport:true,oldBytesAndAuthorWorkPreserved:true,obsoleteResponseRejected:true,unchangedSaveReused:true,synthetic:true,actualBrowser:false};
}
const definitionCarrierCacheObservations=[];for(const status of ['RESERVED','EXPORTED'])definitionCarrierCacheObservations.push(await cachedDefinitionCarrierOracle(promptSource,status));
const noDefinitionCarrierVersionBump=promptSource.replace(/const PROMPT_ENGINE_VERSION='[^']+';/,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/84';");await assert.rejects(()=>cachedDefinitionCarrierOracle(noDefinitionCarrierVersionBump,'RESERVED'),/DEFINITION_CARRIER_CACHE_REFRESH_ORACLE/,'Definition carrier cache did not detect an unchanged generation');
console.log(JSON.stringify({definitionCarrierCacheObservations,definitionCarrierNoVersionBumpDetected:true}));

// Controlled /86 retains the exact pre-correction procedure/completion owners.
// The full pinned /86 source was separately reproduced; this small maintained
// equivalent tests the contradictory cached operation and preserves current
// unrelated producer contracts rather than claiming complete historical bytes.
const legacyConditional86Owners={"procedureFor": "function procedureFor(stage,operation){const procedure=operationSpecial?.[stage]?.[operation]||stageSpecial[stage],invariant=stageInvariant?.[stage]||'';const combined=[procedure,invariant].filter(Boolean).join('\\n');return (stage===17||stage===19)?`CURRENT DECLARED OPERATION: ${operation}\\n${combined}`:combined;}", "stageCompletionDirective": "function stageCompletionDirective(stage){return STAGE_COMPLETION_DIRECTIVES[stage]||'Complete the current stage only when every requirement of its declared stage contract is satisfied or explicitly blocked with exact reason and evidence.';}"};
function legacyConditional86PromptSource(source){
 let old=source.replace(/const PROMPT_ENGINE_VERSION='[^']+';/,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/86';");
 for(const [name,body]of Object.entries(legacyConditional86Owners)){const start=old.indexOf('function '+name+'('),ends=[old.indexOf('\nfunction ',start+1),old.indexOf('\nasync function ',start+1)].filter(index=>index>=0),end=Math.min(...ends);assert(start>=0&&end>start,'CONDITIONAL86_CACHE_OWNER_ANCHOR_ORACLE: '+name);old=old.slice(0,start)+body+old.slice(end);}
 return old;
}
async function cachedConditional86Oracle(currentSource,status,oldSource=legacyConditional86PromptSource(promptSource)){
 const r=projectStoreRuntime({sourceOverrides:{'prompt-engine.js':currentSource}}),currentProducer=r.prompts,e=r.engine,h=r.runtime.closedLoopHash,{p:restored}=await deferredDefinitionRestorationFixture(r,{family:'failureTests'}),operation='EXECUTE_FAILURE_TEST',stage=8;
 for(let prior=1;prior<stage;prior++)assert.equal(e.gate(prior,restored).complete,true,'CONDITIONAL86_ACTUAL_PREREQUISITE_ORACLE: '+prior);
 let p=await r.store.writeProject(restored,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});vm.runInContext(oldSource,r.runtime,{filename:'prompt-engine.js:controlled-86-ordinary-directive-contradiction'});
 const oldProducer=r.runtime.closedLoopPromptEngine,draft=r.copy(p),old=oldProducer.reserveAndBuildPromptRecord(draft,stage,{operation}).prompt;assert.equal(old.promptEngineVersion,'closed-loop-prompt-engine/86');
 if(status==='EXPORTED')e.transitionOperationReservation(draft.projectData.operationReservations.find(row=>e.recordId(row,'operationReservations')===old.operationReservationId),'EXPORTED');
 p=await r.store.writeProject(draft,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 const oldPkg=await r.store.createExecutionPackage({jobId:p.job.JOB_ID,stage,operation,instructionId:old.instructionId}),oldMembers=readStoreArchive(new Uint8Array(await oldPkg.blob.arrayBuffer())),oldInstruction=Buffer.from(oldMembers.find(row=>row.canonicalPath==='instruction.txt').bytes).toString('utf8'),ordinary='Complete only when one coherent current production instruction contains every required section and every current mandatory requirement has a complete instruction trace.';
 assert.equal(oldInstruction,old.prompt);assert(oldInstruction.includes(ordinary),'CONDITIONAL86_OLD_CONTRADICTION_REQUIRED');assert(oldInstruction.includes('Return exactly one regressionExecutions record'),'CONDITIONAL86_OLD_RECEIPT_CONTRACT_REQUIRED');
 const before=Object.fromEntries(['acceptedChanges','failureTests','regressionExecutions','rawResponses','responseProposals'].map(family=>[family,h.sha256Value(p.projectData[family])]));r.runtime.closedLoopPromptEngine=currentProducer;bindAcceptanceUi(r,p,null);Object.assign(r.runtime,{promptOptions:()=>r.copy({operation}),externalAgentOperation:()=>true,selectedOperation:()=>operation,operationExecutorClass:()=> 'EXTERNAL_AGENT'});vm.runInContext(cachedUiOwners+'\nglobalThis.cachedConditional86Ui={save:()=>savePromptRecord(8)};',r.runtime);
 const fresh=await r.runtime.cachedConditional86Ui.save(),current=r.runtime.current;assert.notEqual(fresh.instructionId,old.instructionId,'CONDITIONAL86_CACHE_REFRESH_ORACLE: contradictory cached operation remained selected');assert.equal(fresh.promptEngineVersion,currentProducer.version);
 const retained=current.projectData.generatedPrompts.find(row=>row.instructionId===old.instructionId);for(const key of ['prompt','bodySha256','contractSha256','contextSignature'])assert.equal(retained[key],old[key],'CONDITIONAL86_OLD_BYTES_PRESERVED_ORACLE');assert.equal(e.recordValue(current.projectData.operationReservations.find(row=>e.recordId(row,'operationReservations')===old.operationReservationId),'STATUS'),'SUPERSEDED');
 for(const [family,digest]of Object.entries(before))assert.equal(h.sha256Value(current.projectData[family]),digest,'CONDITIONAL86_NO_CANONICAL_CHANGE_ORACLE: '+family);
 const pkg=await r.store.createExecutionPackage({jobId:current.job.JOB_ID,stage,operation,instructionId:fresh.instructionId}),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),instruction=Buffer.from(members.find(row=>row.canonicalPath==='instruction.txt').bytes).toString('utf8'),manifest=JSON.parse(Buffer.from(members.find(row=>row.canonicalPath==='manifest.json').bytes).toString('utf8'));
 assert.equal(instruction,fresh.prompt);assert.equal(instruction.includes(ordinary),false,'CONDITIONAL86_FRESH_CONTRADICTION_ORACLE');assert(instruction.includes('Return exactly one regressionExecutions record'));assert.deepEqual(manifest.responseContract.agentWritableCollections,['regressionExecutions']);assert.deepEqual(manifest.responseContract.agentStageFields,[]);
 const material=({projectRevision,...binding})=>binding;assert.deepEqual(r.copy(material(fresh.contextManifest.deferredExecutionBinding)),r.copy(material(old.contextManifest.deferredExecutionBinding)));assert.equal(fresh.contextManifest.deferredExecutionBinding.projectRevision,old.contextManifest.deferredExecutionBinding.projectRevision+1);assert.notEqual(fresh.packageId,old.packageId);assert.notEqual(fresh.challengeNonce,old.challengeNonce);assert.equal(e.gate(stage,current).complete,false,'CONDITIONAL86_TRANSPORT_CANNOT_COMPLETE_STAGE_ORACLE');
 const oldManifest=oldProducer.promptFileManifest(old),blocked={schema:r.runtime.closedLoopWorkflowSchema.RESPONSE_SCHEMA,contractProfileId:r.runtime.closedLoopWorkflowSchema.CONTRACT_PROFILE_ID,jobId:current.job.JOB_ID,stage,operation,promptIdentity:oldManifest.promptIdentity,packageId:oldManifest.packageId,operationReservationId:oldManifest.operationReservationId,challengeNonce:oldManifest.challengeNonce,scope:oldManifest.scope,responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'old-contradictory-operation',kind:'MISSING_APPLICATION_CONTEXT',description:'The saved instruction requires ordinary stage work while authorizing only a scheduled receipt.',whyBlocking:'The declared operation and completion directions conflict.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]},stale=r.ingestion.validateEnvelope(current,r.copy(blocked),{stage,promptRecord:fresh,rawSha256:h.sha256Text(JSON.stringify(blocked))});assert.equal(stale.valid,false);assert(stale.issues.some(row=>row.code==='STALE_PROMPT_IDENTITY'),'CONDITIONAL86_STALE_TRANSPORT_REJECTED_ORACLE');
 const revision=current.revision,count=current.projectData.generatedPrompts.length,again=await r.runtime.cachedConditional86Ui.save();assert.equal(again.instructionId,fresh.instructionId);assert.equal(r.runtime.current.revision,revision);assert.equal(r.runtime.current.projectData.generatedPrompts.length,count);const reloaded=await r.store.readProject(current.job.JOB_ID);assert.equal(reloaded.projectData.generatedPrompts.find(row=>row.instructionId===old.instructionId).prompt,oldInstruction);assert.equal(reloaded.projectData.generatedPrompts.find(row=>row.instructionId===fresh.instructionId).prompt,instruction);
 return {status,stage,operation,oldGeneration:old.promptEngineVersion,currentGeneration:fresh.promptEngineVersion,oldPackageSha256:await h.sha256Bytes(oldPkg.blob),freshPackageSha256:await h.sha256Bytes(pkg.blob),oldContradictionObserved:true,freshReceiptOnlyContract:true,exactScheduledBindingPreserved:true,oldBytesAndCanonicalWorkPreserved:true,obsoleteResponseRejected:true,unchangedSaveIdempotent:true,ordinaryStageStillIncomplete:true,transactionAndReloadVerified:true,synthetic:true,actualBrowser:false};
}
const conditional86CacheObservations=[];for(const status of ['RESERVED','EXPORTED'])conditional86CacheObservations.push(await cachedConditional86Oracle(promptSource,status));
const noConditional86VersionBump=promptSource.replace(/const PROMPT_ENGINE_VERSION='[^']+';/,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/86';");for(const status of ['RESERVED','EXPORTED'])await assert.rejects(()=>cachedConditional86Oracle(noConditional86VersionBump,status),/CONDITIONAL86_CACHE_REFRESH_ORACLE/,'Contradictory /86 conditional cache did not detect an unchanged generation for '+status);
console.log(JSON.stringify({conditional86CacheObservations,conditional86NoVersionBumpDetected:true}));

// The selected independent-review route must not recover prior conclusions
// through an already-saved /87 retry. This controlled equivalent disables only
// the new conditional prior-output authorization guards; exact /87 bytes are separately retained.
function legacyIndependent87PromptSource(source){
 const gate='deferred?independentDeferred:number===12';assert.equal(source.split(gate).length,2,'INDEPENDENT87_CACHE_POLICY_ANCHOR_ORACLE');
 return source.replace(/const PROMPT_ENGINE_VERSION='[^']+';/,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/87';").replace(gate,'deferred?false:number===12').replace('if(independentDeferred){','if(false){');
}
async function cachedIndependent87Oracle(currentSource,status,oldSource=legacyIndependent87PromptSource(promptSource)){
 const r=projectStoreRuntime({sourceOverrides:{'prompt-engine.js':currentSource}}),e=r.engine,i=r.ingestion,h=r.runtime.closedLoopHash,currentProducer=r.prompts,{p:restored,test}=await deferredDefinitionRestorationFixture(r,{family:'failureTests'}),stage=8,operation='EXECUTE_FAILURE_TEST',marker='REJECTED_INDEPENDENT_REVIEW_CONCLUSION_MUST_NOT_REACH_NEXT_REVIEW';
 assert.equal(e.recordValue(test,'EXECUTION_MODE'),'INDEPENDENT_AGENT_REVIEW');for(let prior=1;prior<stage;prior++)assert.equal(e.gate(prior,restored).complete,true);
 vm.runInContext(oldSource,r.runtime,{filename:'prompt-engine.js:controlled-87-independent-retry-leak'});const oldProducer=r.runtime.closedLoopPromptEngine;let p=await r.store.writeProject(restored,{createOnly:true,expectedProjectRevision:0,incrementRevision:false}),draft=r.copy(p),first=oldProducer.reserveAndBuildPromptRecord(draft,stage,{operation}).prompt;p=await r.store.writeProject(draft,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 const firstManifest=oldProducer.promptFileManifest(first),envelope={schema:r.runtime.closedLoopWorkflowSchema.RESPONSE_SCHEMA,contractProfileId:r.runtime.closedLoopWorkflowSchema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage,operation,promptIdentity:firstManifest.promptIdentity,packageId:first.packageId,operationReservationId:first.operationReservationId,challengeNonce:first.challengeNonce,scope:first.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{regressionExecutions:[{tempKey:'invalid-prior-review',fields:{PHASE:false,RESULT:'SATISFIED'},relationships:{MUTATION_ID:{recordId:first.contextManifest.deferredExecutionBinding.subjectId}},evidenceRefs:['unsupported-review'],notes:marker}]},evidence:[{temporaryKey:'unsupported-review',kind:'EXTERNAL_EXECUTION',description:marker,authorityType:'AGENT_CLAIM',content:marker}],attachments:[],warnings:[],unresolved:[]},text=JSON.stringify(envelope),staged=await r.store.stageResponseFile({jobId:p.job.JOB_ID,stage,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:firstManifest.promptIdentity,packageId:first.packageId,operationReservationId:first.operationReservationId,challengeNonce:first.challengeNonce}),file=await r.store.readStagedResponseFile({jobId:p.job.JOB_ID,stagingId:staged.stagingId}),captured=i.captureRaw(p,{stage,text,promptRecord:first,transport:r.copy({authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,status:file.status,sha256:file.sha256,byteSize:file.byteSize,promptIdentity:firstManifest.promptIdentity,packageId:first.packageId,operationReservationId:first.operationReservationId,challengeNonce:first.challengeNonce})}),prepared=i.prepareCaptured(captured.project,{rawResponseId:captured.rawRecord.rawResponseId,promptRecord:first,expectedCommittedRevision:p.revision});
 assert.equal(prepared.validation.valid,false);assert(prepared.validation.issues.some(row=>row.code==='WRONG_VALUE_TYPE'&&String(row.path).includes('PHASE')),'INDEPENDENT87_INTENDED_PROTOCOL_FAILURE_ORACLE');p=await r.store.writeProject(prepared.project,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});draft=r.copy(p);const old=oldProducer.reserveAndBuildPromptRecord(draft,stage,{operation}).prompt;p=await r.store.writeProject(draft,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 const oldPkg=await r.store.createExecutionPackage({jobId:p.job.JOB_ID,stage,operation,instructionId:old.instructionId}),oldMembers=readStoreArchive(new Uint8Array(await oldPkg.blob.arrayBuffer()));assert(oldMembers.some(row=>Buffer.from(row.bytes).toString('utf8').includes(marker)),'INDEPENDENT87_ACTUAL_LEAKED_PACKAGE_REQUIRED');assert(old.contextManifest.retryAttemptInputs.length>0);assert.equal(old.promptEngineVersion,'closed-loop-prompt-engine/87');
 if(status==='EXPORTED'){const failures=bindAcceptanceUi(r,p,null);vm.runInContext(uiOwner('recordInstructionExport'),r.runtime);await r.runtime.recordInstructionExport(old);assert.equal(failures.length,0,'INDEPENDENT87_EXPORT_OWNER_FAILURE_ORACLE');p=await r.store.readProject(p.job.JOB_ID);assert(p.projectData.history.some(row=>row.type==='INSTRUCTION_PACKAGE_EXPORTED'&&row.promptId===old.instructionId),'INDEPENDENT87_EXPORT_HISTORY_REQUIRED');}
 const before=Object.fromEntries(['acceptedChanges','failureTests','regressionExecutions','rawResponses','responseProposals','responseValidations'].map(family=>[family,h.sha256Value(p.projectData[family])]));r.runtime.closedLoopPromptEngine=currentProducer;bindAcceptanceUi(r,p,null);Object.assign(r.runtime,{promptOptions:()=>r.copy({operation}),externalAgentOperation:()=>true,selectedOperation:()=>operation,operationExecutorClass:()=> 'EXTERNAL_AGENT'});vm.runInContext(cachedUiOwners+'\nglobalThis.cachedIndependent87Ui={save:()=>savePromptRecord(8)};',r.runtime);
 const fresh=await r.runtime.cachedIndependent87Ui.save(),current=r.runtime.current;assert.notEqual(fresh.instructionId,old.instructionId,'INDEPENDENT87_CACHE_REFRESH_ORACLE: exposed retry remained authoritative');assert.equal(fresh.promptEngineVersion,currentProducer.version);assert.notEqual(fresh.packageId,old.packageId);assert.notEqual(fresh.challengeNonce,old.challengeNonce);
 const pkg=await r.store.createExecutionPackage({jobId:current.job.JOB_ID,stage,operation,instructionId:fresh.instructionId}),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),manifest=JSON.parse(Buffer.from(members.find(row=>row.canonicalPath==='manifest.json').bytes).toString('utf8')),instruction=Buffer.from(members.find(row=>row.canonicalPath==='instruction.txt').bytes).toString('utf8');assert.equal(instruction,fresh.prompt);assert.equal(members.some(row=>Buffer.from(row.bytes).toString('utf8').includes(marker)),false,'INDEPENDENT87_NO_PRIOR_CONCLUSION_CARRIER_ORACLE');assert.equal((manifest.retryInputs||[]).length,0);assert(instruction.includes('WRONG_VALUE_TYPE')&&instruction.includes('PHASE'),'INDEPENDENT87_ACTIONABLE_PROTOCOL_FEEDBACK_ORACLE');assert(instruction.includes('fresh independent reviewer conversation'),'INDEPENDENT87_FRESH_CONTEXT_RECOVERY_ORACLE');assert(instruction.includes('does not restore independence'),'INDEPENDENT87_EXPOSURE_NOT_ERASED_ORACLE');
 const policy=currentProducer.deferredExecutionContextPolicy(current,stage,operation);assert.equal(policy.independentReview,true);assert.equal(policy.requiresFreshConversation,true);assert.equal(policy.priorExportMayHaveExposedRejectedWork,status==='EXPORTED','INDEPENDENT87_EXPOSURE_STATUS_ORACLE');
 for(const [family,digest]of Object.entries(before))assert.equal(h.sha256Value(current.projectData[family]),digest,'INDEPENDENT87_CANONICAL_AND_RAW_PRESERVATION_ORACLE: '+family);const prior=current.projectData.generatedPrompts.find(row=>row.instructionId===old.instructionId);for(const key of ['prompt','bodySha256','contractSha256','contextSignature'])assert.equal(prior[key],old[key]);assert.equal(e.recordValue(current.projectData.operationReservations.find(row=>e.recordId(row,'operationReservations')===old.operationReservationId),'STATUS'),'SUPERSEDED');assert.equal(e.gate(stage,current).complete,false);
 const revision=current.revision,again=await r.runtime.cachedIndependent87Ui.save();assert.equal(again.instructionId,fresh.instructionId);assert.equal(r.runtime.current.revision,revision);const reloaded=await r.store.readProject(current.job.JOB_ID);assert.equal(reloaded.projectData.rawResponses.find(row=>row.rawResponseId===captured.rawRecord.rawResponseId).completeRawResponse,text);assert.equal(reloaded.projectData.generatedPrompts.find(row=>row.instructionId===old.instructionId).prompt,old.prompt);
 return {status,stage,operation,oldGeneration:old.promptEngineVersion,currentGeneration:fresh.promptEngineVersion,oldPackageSha256:await h.sha256Bytes(oldPkg.blob),freshPackageSha256:await h.sha256Bytes(pkg.blob),actualWrongTypeFileRejected:true,actualPriorConclusionLeakedByOldPackage:true,noPriorConclusionInAnyFreshCarrier:true,actionableProtocolFeedbackRetained:true,freshReviewConversationRequired:true,priorExportMayHaveExposedRejectedWork:policy.priorExportMayHaveExposedRejectedWork,rawAndCanonicalWorkPreserved:true,oldPackageBytesPreserved:true,unchangedSaveIdempotent:true,ordinaryStageStillIncomplete:true,storedAndReloaded:true,synthetic:true,actualBrowser:false,actualExternalExposureClaimed:false};
}
const independent87CacheObservations=[];for(const status of ['RESERVED','EXPORTED'])independent87CacheObservations.push(await cachedIndependent87Oracle(promptSource,status));
const noIndependent87VersionBump=promptSource.replace(/const PROMPT_ENGINE_VERSION='[^']+';/,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/87';");await assert.rejects(()=>cachedIndependent87Oracle(noIndependent87VersionBump,'EXPORTED'),/INDEPENDENT87_CACHE_REFRESH_ORACLE/,'Independent-review /87 cache did not detect unchanged generation');
console.log(JSON.stringify({independent87CacheObservations,independent87NoVersionBumpDetected:true}));

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
console.log(JSON.stringify({conditionalReasonPublication:'PASS',conditionalReasonObservations,cachedInitialInstructionRefresh:'PASS',cacheObservations,sharedDescriptorCacheObservations,sharedDescriptorFaultsDetected,negativeCacheObservations,capturedResponseObservation,transportImpactObservations,sharedContextRefreshObservations,conditionalReasonFaultsDetected,synthetic:true,actualBrowser:false,realAgent:false,stageCompletionEstablished:false}));

console.log(JSON.stringify(await verifyStage01SpecificationControls()));
console.log(JSON.stringify({stage01AgentContractAlignment:'PASS',legalUnicodeStringPunctuation:true,smartStructuralDelimitersRejected:true,typedEvidenceReferencesPublished:true,humanAuthorityEnumsPublished:true,validationRepairGuidancePublished:true,conformingStage01ResponseAccepted:true,fallbackAnswerTypesPublished:true,fallbackUnresolvedKindsPublished:true,fallbackControlsValidated:true,envelopePublicationComplete:true,envelopePublicationObservations,conditionalReasonPublication:true,cachedInitialInstructionRefresh:true,sharedDescriptorInitialInstructionRefresh:true,sharedDescriptorFaultsDetected,conditionalReasonFaultsDetected,verificationObservations:[fallbackObservation]}));

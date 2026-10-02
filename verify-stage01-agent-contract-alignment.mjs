import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';
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

console.log(JSON.stringify({stage01AgentContractAlignment:'PASS',legalUnicodeStringPunctuation:true,smartStructuralDelimitersRejected:true,typedEvidenceReferencesPublished:true,humanAuthorityEnumsPublished:true,validationRepairGuidancePublished:true,conformingStage01ResponseAccepted:true}));

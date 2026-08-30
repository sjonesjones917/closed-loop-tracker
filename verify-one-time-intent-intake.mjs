import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion;
const assert=(value,message)=>{if(!value)throw new Error(message);};

assert(schema.STAGE_CONTRACTS[1].agentWritableCollections.includes('intentStatements'),'Stage 01 cannot write canonical intent statements.');
assert(schema.STAGE_CONTRACTS[3].readCollections.includes('intentStatements'),'Stage 03 cannot read canonical intent statements.');
assert(schema.STAGE_CONTRACTS[4].readCollections.includes('intentStatements'),'Stage 04 cannot read canonical intent statements.');
assert(schema.STAGE_FIELDS[1].INTAKE_ACCOUNTING?.valueType==='OBJECT_ARRAY','Stage 01 intake accounting is not a closed object-array contract.');
assert(schema.STAGE_FIELDS[4].OBLIGATION_ACCOUNTING?.valueType==='OBJECT_ARRAY','Stage 04 obligation accounting is not a closed object-array contract.');

function savePrompt(project,stage,options={}){
  const record={...prompts.buildPromptRecord(stage,project,options),generatedAt:new Date().toISOString()};
  project.projectData.generatedPrompts.push(record);
  return record;
}
function evidence(label='coverage proof'){
  return [{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:label,location:'verify-one-time-intent-intake.mjs',content:'controlled proof'}];
}
function envelope(project,stage,prompt,records,stageData={}){
  return {schema:schema.RESPONSE_SCHEMA,jobId:project.job.JOB_ID,stage,operation:prompt.operation,promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},scope:prompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData,records,evidence:evidence(),unresolved:[],warnings:[],attachments:[]};
}
function prepare(project,stage,prompt,records,stageData={}){
  return ingestion.prepare(project,{stage,text:JSON.stringify(envelope(project,stage,prompt,records,stageData)),promptRecord:prompt});
}
function commitPrepared(prepared,operator='INTAKE_REGRESSION'){
  assert(prepared.validation.valid,`Expected valid response was rejected: ${JSON.stringify(prepared.validation.issues)}`);
  return ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator}).project;
}
function intent(tempKey,location,text,relevance='REQUIREMENT'){
  return {tempKey,fields:{SOURCE_MATERIAL:'authorized human input',SOURCE_LOCATION:location,EXACT_STATEMENT:text,STATEMENT_KIND:relevance==='REQUIREMENT'?'REQUIREMENT':'OTHER',REQUIREMENT_RELEVANCE:relevance==='REQUIREMENT'?'REQUIREMENT':'CONTEXT_ONLY',NORMATIVE_FORCE:relevance==='REQUIREMENT'?'MUST':'FACTUAL',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled exhaustive-intake fixture'},relationships:{},evidenceRefs:['evidence-1']};
}
function sourceProposal(){
  return {tempKey:'source-1',fields:{TITLE:'Controlled external authority',ISSUING_ORGANIZATION_OR_AUTHOR:'Controlled issuer',SOURCE_TYPE:'OFFICIAL_STANDARD',PUBLICATION_ORIGIN:'Official publication',URL_REFERENCE:'https://example.invalid/controlled-authority',PUBLICATION_UPDATE_DATE:'2026-08-30',RETRIEVAL_DATE:'2026-08-30',AUTHORITY_LEVEL:'PRIMARY TECHNICAL AUTHORITY',AUTHORITY_ROLE:'GOVERNING WHERE APPLICABLE',RELEVANCE:'Controls one external obligation in this fixture.',APPLICABLE_PORTIONS:'Controlled section 1',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT SUPERSEDED',CONTROLLING_STATE:'CONTROLLING WHERE APPLICABLE',NOTES:'Synthetic source record; no network claim is made.'},relationships:{},evidenceRefs:['evidence-1']};
}
function candidate(tempKey,statementId,sourceId){
  return {tempKey,fields:{SOURCE_LOCATION:statementId,CANDIDATE_OBLIGATION:`Preserve ${statementId} without weakening it.`,CLASSIFICATION:'USER_REQUIREMENT',APPLICABILITY:'APPLICABLE',DEPENDENCIES:'NONE',EVIDENCE:`Canonical statement ${statementId}`},relationships:sourceId?{SOURCE_ID:{recordId:sourceId}}:{},evidenceRefs:['evidence-1']};
}
function requirement(tempKey,statementId,obligation){
  return {tempKey,fields:{OBLIGATION:obligation,REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:statementId,APPLICABILITY:'APPLICABLE',DEPENDENCIES:'NONE',PROHIBITIONS:'NONE',DEFINED_TERMS:'NONE',OBSERVABLE_SATISFACTION_CONDITION:'The specified behavior is present and independently observable.',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC_AND_INDEPENDENT_CONTENT_REVIEW',EXPECTED_EVIDENCE:'Current application-bound verification evidence',FAILURE_CONDITION:'The specified behavior is absent, weakened, contradicted, or requires repeated user input.',SEVERITY:'MAJOR',NOTES:'Controlled Stage 04 fixture'},relationships:{},evidenceRefs:['evidence-1']};
}

let project=core.createBlankState('JOB-ONE-TIME-INTENT');
Object.assign(project.job,{
  JOB_TITLE:'One-time intent proof',
  EXACT_USER_OBJECTIVE_VERBATIM:'Capture every user-supplied statement. Never request the same information twice.\nStage 4 must receive every accepted Stage 1 and Stage 3 detail.',
  SUPPLIED_MATERIALS_INVENTORY:'intent.txt',
  REQUIRED_OUTPUT_FORMAT:'Working static browser application.',
  EXPLICIT_USER_REQUIREMENTS:'Keep the established visual layout unchanged; preserve the 280px prompt preview.',
  CURRENT_INPUT_VERSION:'INPUT-v001',
  CURRENT_SOURCE_SET_VERSION:'NOT APPLICABLE'
});
engine.ensureShape(project);engine.recalculate(project);

const stage1Prompt=savePrompt(project,1);
const intakeManifest=engine.stage01IntakeManifest(project);
assert(intakeManifest.entries.length>=7,'Stage 01 manifest did not conservatively split all supplied statements and fields into controlled units.');
assert(stage1Prompt.intakeManifest?.manifestSha256===intakeManifest.manifestSha256,'Stage 01 prompt record is not bound to the exact current intake manifest.');
assert(stage1Prompt.prompt.includes(`MANIFEST_SHA256: ${intakeManifest.manifestSha256}`),'Stage 01 prompt omits the exact intake manifest hash.');
assert((stage1Prompt.prompt.match(/PROJECT DATA EXECUTION RULE — MANDATORY/g)||[]).length===1,'Prompt repeats the project-data execution rule instead of stating it once.');
for(const entry of intakeManifest.entries){
  assert(stage1Prompt.prompt.includes(entry.inputId),`Stage 01 generated prompt omits input identity ${entry.inputId}.`);
  assert(stage1Prompt.prompt.includes(String(entry.value)),`Stage 01 generated prompt omits the exact controlled value for ${entry.inputId}.`);
}
assert(stage1Prompt.prompt.includes('one intentStatements record for every atomic statement'),'Stage 01 prompt does not require exhaustive statement capture.');
assert(stage1Prompt.prompt.includes('Use the original intent file now, in Stage 01 only'),'Stage 01 prompt does not establish one-time use.');
assert(stage1Prompt.prompt.includes('PERSISTED HUMAN ANSWERS — ALREADY SUPPLIED; DO NOT ASK AGAIN'),'Stage 01 prompt does not forbid repeated questions for persisted answers.');

const intentRecords=[
  intent('intent-objective','human request / objective','Capture every user-supplied statement.'),
  intent('intent-no-repeat','human request / objective','Never request the same information twice.'),
  intent('intent-stage4','human request / objective','Stage 4 must receive every accepted Stage 1 and Stage 3 detail.'),
  intent('intent-visual','explicit requirements','Keep the established visual layout unchanged; preserve the 280px prompt preview.'),
  intent('intent-context','job metadata','The requested output is a working static browser application and intent.txt is a supplied material.','CONTEXT')
];
const mappedTempKey=entry=>{
  const value=String(entry.value||'');
  if(value.includes('Never request'))return 'intent-no-repeat';
  if(value.includes('Stage 4'))return 'intent-stage4';
  if(value.includes('visual layout')||value.includes('280px'))return 'intent-visual';
  if(value.includes('Capture every'))return 'intent-objective';
  return 'intent-context';
};
const intakeAccounting=intakeManifest.entries.map(entry=>({inputId:entry.inputId,disposition:'INCORPORATED_INTO_JOB_DEFINITION',intentStatementTempKeys:[mappedTempKey(entry)],reason:''}));
const stage1Data={EXACT_DELIVERABLE_REQUESTED:'A working static browser closed-loop reliability application.',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:'The current human request and supplied intent.txt material.',INTAKE_ACCOUNTING:intakeAccounting};

let prepared=prepare(project,1,stage1Prompt,{intentStatements:intentRecords},{...stage1Data,INTAKE_ACCOUNTING:intakeAccounting.slice(0,-1)});
assert(!prepared.validation.valid&&prepared.validation.issues.some(item=>item.code==='MISSING_INTAKE_DISPOSITION'),'Stage 01 accepted an omitted application-generated input unit.');
prepared=prepare(project,1,stage1Prompt,{intentStatements:intentRecords},{...stage1Data,INTAKE_ACCOUNTING:[...intakeAccounting,intakeAccounting[0]]});
assert(!prepared.validation.valid&&prepared.validation.issues.some(item=>item.code==='DUPLICATE_INTAKE_DISPOSITION'),'Stage 01 accepted a duplicate input disposition.');
prepared=prepare(project,1,stage1Prompt,{intentStatements:intentRecords},{...stage1Data,INTAKE_ACCOUNTING:intakeAccounting.map((entry,index)=>index?entry:{...entry,inputId:'INPUT-NOT-IN-MANIFEST'})});
assert(!prepared.validation.valid&&prepared.validation.issues.some(item=>item.code==='UNKNOWN_INTAKE_INPUT_ID'),'Stage 01 accepted an unknown input identity.');
prepared=prepare(project,1,stage1Prompt,{intentStatements:intentRecords},{...stage1Data,INTAKE_ACCOUNTING:intakeAccounting.map((entry,index)=>index?entry:{...entry,intentStatementTempKeys:['intent-does-not-exist']})});
assert(!prepared.validation.valid&&prepared.validation.issues.some(item=>item.code==='INVALID_INTAKE_STATEMENT_MAPPING'),'Stage 01 accepted a mapping to a nonexistent intent statement.');
prepared=prepare(project,1,stage1Prompt,{intentStatements:[...intentRecords,intent('intent-orphan','unmapped','This statement is deliberately unmapped.')]},stage1Data);
assert(!prepared.validation.valid&&prepared.validation.issues.some(item=>item.code==='UNACCOUNTED_INTENT_STATEMENT'),'Stage 01 accepted an intent statement with no controlled-input origin.');

prepared=prepare(project,1,stage1Prompt,{intentStatements:intentRecords},stage1Data);
assert(prepared.validation.valid,`Stage 01 complete intake accounting was rejected: ${JSON.stringify(prepared.validation.issues)}`);
const inputVersionBeforeAcceptance=project.job.CURRENT_INPUT_VERSION,manifestShaBeforeAcceptance=intakeManifest.manifestSha256;
const committedStage1=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'INTAKE_REGRESSION'});
project=committedStage1.project;
assert(project.job.CURRENT_INPUT_VERSION===inputVersionBeforeAcceptance,'Accepting agent normalization incorrectly created a new human-input version.');
assert(engine.stage01IntakeManifest(project).manifestSha256===manifestShaBeforeAcceptance,'Stage 01 acceptance changed the controlled human-input manifest it was supposed to account for.');
engine.recordStageConfirmation(project,1,true,'Current intent confirmed','INTAKE_REGRESSION',{acceptedChangeId:committedStage1.acceptedChange.changeId,inputVersion:project.job.CURRENT_INPUT_VERSION,instructionId:committedStage1.acceptedChange.promptId,contextSignature:committedStage1.acceptedChange.contextSignature,operatorLabel:'INTAKE_REGRESSION'});
engine.recalculate(project);
assert(engine.gate(1,project).complete,`Stage 01 gate did not close after complete manifest accounting: ${engine.gate(1,project).reasons.join(' | ')}`);

for(const stage of [2,3,4]){
  const prompt=prompts.buildPromptRecord(stage,project);
  assert(prompt.prompt.includes('The original Stage 01 intent file is prohibited input for this stage.'),`Stage ${stage} does not prohibit original-file reuse.`);
  assert(!prompt.prompt.includes('Attach or provide the original material with the Stage 04 instruction.'),`Stage ${stage} still requests the original file.`);
  assert(!prompt.prompt.includes('Send the Stage 04 instruction with'),`Stage ${stage} still tells the operator to resend the file.`);
}
const handoff=engine.executionHandoff(project,{stage:4,operation:'COMPLETE'});
assert(handoff.conversationMaterials.length===0,'Stage 04 still creates an original-material resend list.');
assert(handoff.withhold.length===0,'Stage 04 still turns the original intent file into a later-stage handoff item.');
assert(engine.operationalNextAction(project,4).includes('Do not attach, resend, reopen, or otherwise reuse the original intent file.'),'Stage 04 next action still permits file reuse.');

const stage2Prompt=savePrompt(project,2);
prepared=prepare(project,2,stage2Prompt,{sources:[sourceProposal()]},{AUTHORITY_HIERARCHY:'The controlled official source governs its stated external obligation.',SOURCE_APPLICABILITY_DETERMINATION:'APPLICABLE_SOURCES_ESTABLISHED',KNOWN_CONTROLLING_SOURCES_EXAMINED:'The controlled source was inspected for this fixture.'});
project=commitPrepared(prepared,'SOURCE_REGRESSION');
const sourceId=engine.recordId(engine.recordsForCurrentScope(project,'sources')[0],'sources');
assert(sourceId,'Stage 02 fixture did not create a current source identity.');

const currentRequirementIntentIds=engine.recordsForCurrentScope(project,'intentStatements').filter(record=>String(engine.recordValue(record,'REQUIREMENT_RELEVANCE')).toUpperCase()==='REQUIREMENT').map(record=>engine.recordId(record,'intentStatements'));
const stage3Prompt=savePrompt(project,3);
const stage3Records={
  research:[{tempKey:'research-1',fields:{PASS_NUMBER:'1',EXACT_PORTION_EXAMINED:'Controlled section 1',MANDATORY_STATEMENTS:'The finished application must preserve one external obligation.',RECOMMENDATIONS:'Preserve exact traceability.',OPTIONAL_PRACTICES:'NONE',EXAMPLES:'NONE',EXPLANATORY_MATERIAL:'The source is used only to prove Stage 3 carry-forward.',PROHIBITIONS:'Do not discard applicable source obligations.',EXCEPTIONS:'NONE',DEPENDENCIES:'Current source identity and evidence.',APPLICABILITY_FACTS:'Applicable to the controlled fixture.',RESTRICTIONS:'NONE',INVALIDATING_MATERIAL:'NONE',FINDING_CLASSIFICATION:'MANDATORY_REQUIREMENT',SOURCE_EVIDENCE:'Controlled source evidence.',CANDIDATE_REQUIREMENT_REFS:'candidate-external',SATURATION_STATUS:'SATURATED'},relationships:{SOURCE_ID:{recordId:sourceId}},evidenceRefs:['evidence-1']}],
  candidateRequirements:[
    ...currentRequirementIntentIds.map((statementId,index)=>candidate(`candidate-intent-${index+1}`,statementId,sourceId)),
    {tempKey:'candidate-external',fields:{SOURCE_LOCATION:'Controlled section 1',CANDIDATE_OBLIGATION:'The finished application must preserve one external obligation.',CLASSIFICATION:'EXTERNAL_REQUIREMENT',APPLICABILITY:'APPLICABLE',DEPENDENCIES:'Current source identity',EVIDENCE:'Controlled source evidence'},relationships:{SOURCE_ID:{recordId:sourceId}},evidenceRefs:['evidence-1']}
  ]
};
prepared=prepare(project,3,stage3Prompt,stage3Records,{EXCEPTIONS_AND_EDGE_CONDITIONS:'NONE',CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE',RESEARCH_GAPS_AND_BLOCKERS:'NONE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',LATEST_PASS_NUMBER:'2',NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE'});
assert(prepared.validation.valid,`Stage 03 exhaustive fixture was rejected: ${JSON.stringify(prepared.validation.issues)}`);
project=commitPrepared(prepared,'RESEARCH_REGRESSION');

const stage4Prompt=savePrompt(project,4);
const obligationManifest=engine.stage04ObligationManifest(project);
assert(stage4Prompt.obligationManifest?.manifestSha256===obligationManifest.manifestSha256,'Stage 04 prompt record is not bound to the exact current obligation universe.');
assert(stage4Prompt.prompt.includes(`MANIFEST_SHA256: ${obligationManifest.manifestSha256}`),'Stage 04 generated prompt omits the exact obligation-manifest hash.');
for(const entry of obligationManifest.entries)assert(stage4Prompt.prompt.includes(entry.obligationId),`Stage 04 generated prompt omits obligation identity ${entry.obligationId}.`);
for(const requiredKind of ['HUMAN_INPUT','STAGE01_JOB_DEFINITION','STAGE01_INTAKE_DISPOSITION','STAGE01_INTENT','STAGE03_STAGE_DATA','STAGE03_RESEARCH','STAGE03_CANDIDATE_OBLIGATION','STAGE02_APPLICABLE_SOURCE'])assert(obligationManifest.entries.some(entry=>entry.sourceKind===requiredKind),`Stage 04 obligation universe omits ${requiredKind}.`);
for(const requiredText of ['Never request the same information twice.','Stage 4 must receive every accepted Stage 1 and Stage 3 detail.','The finished application must preserve one external obligation.','Do not discard applicable source obligations.'])assert(stage4Prompt.prompt.includes(requiredText),`Stage 04 generated prompt omits carried-forward detail: ${requiredText}`);

const requirementRecords=currentRequirementIntentIds.map((statementId,index)=>requirement(`requirement-${index+1}`,statementId,`Implement ${engine.recordValue(engine.recordsForCurrentScope(project,'intentStatements').find(record=>engine.recordId(record,'intentStatements')===statementId),'EXACT_STATEMENT')}`));
const primaryRequirementKey=requirementRecords[0].tempKey;
const requirementKeyByStatement=new Map(currentRequirementIntentIds.map((id,index)=>[id,requirementRecords[index].tempKey]));
const completeAccounting=obligationManifest.entries.map(entry=>{
  if(entry.sourceKind==='STAGE01_INTENT'&&requirementKeyByStatement.has(String(entry.sourceIdentity)))return {obligationId:entry.obligationId,disposition:'REQUIREMENT',requirementTempKeys:[requirementKeyByStatement.get(String(entry.sourceIdentity))],reason:''};
  if(entry.sourceKind==='STAGE03_CANDIDATE_OBLIGATION'||(entry.sourceKind==='STAGE03_RESEARCH'&&['MANDATORY_STATEMENTS','PROHIBITIONS'].includes(String(entry.location))))return {obligationId:entry.obligationId,disposition:'REQUIREMENT',requirementTempKeys:[primaryRequirementKey],reason:''};
  return {obligationId:entry.obligationId,disposition:'RETAINED_NONNORMATIVE_CONTEXT',requirementTempKeys:[],reason:'Retained as current controlling context without converting this entire packet into a separate normative requirement.'};
});
const stage4Data={DEFINED_TERM_GAPS:'NONE',OBLIGATION_ACCOUNTING:completeAccounting};

prepared=prepare(project,4,stage4Prompt,{requirements:requirementRecords},{...stage4Data,OBLIGATION_ACCOUNTING:completeAccounting.slice(0,-1)});
assert(!prepared.validation.valid&&prepared.validation.issues.some(item=>item.code==='MISSING_OBLIGATION_DISPOSITION'),'Stage 04 accepted incomplete application-generated obligation accounting.');
const requiredIntentManifestEntry=obligationManifest.entries.find(entry=>entry.sourceKind==='STAGE01_INTENT'&&requirementKeyByStatement.has(String(entry.sourceIdentity)));
prepared=prepare(project,4,stage4Prompt,{requirements:requirementRecords},{...stage4Data,OBLIGATION_ACCOUNTING:completeAccounting.map(entry=>entry.obligationId===requiredIntentManifestEntry.obligationId?{obligationId:entry.obligationId,disposition:'RETAINED_NONNORMATIVE_CONTEXT',requirementTempKeys:[],reason:'Deliberately wrong fixture.'}:entry)});
assert(!prepared.validation.valid&&prepared.validation.issues.some(item=>item.code==='INVALID_INTENT_OBLIGATION_DISPOSITION'),'Stage 04 accepted a requirement-relevant Stage 01 intent as nonnormative context.');
const generic=requirement('requirement-generic',currentRequirementIntentIds[0],'Generic invalid relationship fixture');generic.fields.USER_INPUT_RELATIONSHIP='User Job Input';
prepared=prepare(project,4,stage4Prompt,{requirements:[generic,...requirementRecords.slice(1)]},stage4Data);
assert(!prepared.validation.valid&&prepared.validation.issues.some(item=>item.code==='INVALID_INTENT_STATEMENT_REFERENCE'),'Stage 04 accepted a generic user-input label instead of an exact STATEMENT_ID.');
const orphan=requirement('requirement-orphan',currentRequirementIntentIds[0],'Deliberately unmapped requirement proposal.');
prepared=prepare(project,4,stage4Prompt,{requirements:[...requirementRecords,orphan]},stage4Data);
assert(!prepared.validation.valid&&prepared.validation.issues.some(item=>item.code==='UNACCOUNTED_REQUIREMENT_PROPOSAL'),'Stage 04 accepted a requirement not mapped from the obligation universe.');
prepared=prepare(project,4,stage4Prompt,{requirements:requirementRecords},stage4Data);
assert(prepared.validation.valid,`Stage 04 complete canonical and obligation coverage was rejected: ${JSON.stringify(prepared.validation.issues)}`);

const changedProject=engine.clone(project),changedResearch=engine.recordsForCurrentScope(changedProject,'research')[0];
changedResearch.fields.MANDATORY_STATEMENTS+=' Added current Stage 3 detail.';changedResearch.MANDATORY_STATEMENTS=changedResearch.fields.MANDATORY_STATEMENTS;
const changedStage4Prompt=prompts.buildPromptRecord(4,changedProject);
assert(changedStage4Prompt.obligationManifest.manifestSha256!==stage4Prompt.obligationManifest.manifestSha256,'Changing accepted Stage 3 detail did not change the Stage 04 obligation universe.');
assert(changedStage4Prompt.contextSignature!==stage4Prompt.contextSignature,'Changing accepted Stage 3 detail did not invalidate the Stage 04 prompt context identity.');
assert(changedStage4Prompt.prompt.includes('Added current Stage 3 detail.'),'Changed Stage 3 detail was not carried into the regenerated Stage 04 prompt.');

console.log(JSON.stringify({
  stage1PromptContainsEveryInputId:true,
  stage1OmissionRejected:true,
  stage1DuplicateRejected:true,
  stage1UnknownIdentityRejected:true,
  stage1OrphanStatementRejected:true,
  humanInputVersionStableAfterAgentAcceptance:true,
  originalIntentFileUsedOnce:true,
  stage3CanonicalIntentCoverage:true,
  stage4PromptContainsEveryObligationId:true,
  stage4UnionKinds:8,
  stage4OmissionRejected:true,
  stage4RequiredIntentDowngradeRejected:true,
  stage4OrphanRequirementRejected:true,
  stage4PromptInvalidatesWhenStage3Changes:true,
  establishedPromptVisualUntouched:true
},null,2));

import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js']){
  vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
}
const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
if(!core||!schema||!engine||!prompts||!ingestion)throw new Error('Runtime modules failed to load.');
if(core.STAGES.length!==30)throw new Error(`Expected 30 stages; found ${core.STAGES.length}.`);

function prepareStage4Upstream(p){
  const intake=prompts.buildPromptRecord(1,p).contextManifest.intakeCoverageManifest;
  p.stages[1].agentData.INPUT_SET_CONTENTS=JSON.stringify({schema:'closed-loop-stage01-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,semanticPasses:{exhaustiveExtractionCompleted:true,omissionChallengeCompleted:true,omissionsResolved:true},units:intake.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'EXTRACTED_RELEVANT_INFORMATION',reason:'',extractedStatements:[{statementKey:'S'+String(i+1),text:u.rawValueText||('Captured '+u.label),statementClass:'FACT'}]}))});
  p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true,blocked:false,reasons:[]};
  p.stages[2].status='COMPLETE';p.stages[2].gate={complete:true,blocked:false,reasons:[]};p.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='NO_APPLICABLE_EXTERNAL_SOURCE';
  p.stages[3].status='COMPLETE';p.stages[3].gate={complete:true,blocked:false,reasons:[]};
  return p;
}
function project(jobId='JOB-INGESTION-TEST'){
  const p=core.createBlankState(jobId);
  p.job.JOB_ID=jobId;
  p.job.JOB_TITLE='Ingestion verification project';
  p.job.EXACT_USER_OBJECTIVE_VERBATIM='Verify the closed-loop response ingestion path.';
  p.job.CURRENT_INPUT_VERSION='INPUT-v001';
  engine.ensureShape(p);
  engine.recalculate(p);
  return p;
}
function preparePromptPrerequisites(p,stage){
  if(stage<=1)return p;
  const intake=prompts.buildPromptRecord(1,p).contextManifest.intakeCoverageManifest;
  p.stages[1].agentData.INPUT_SET_CONTENTS=JSON.stringify({schema:'closed-loop-stage01-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,semanticPasses:{exhaustiveExtractionCompleted:true,omissionChallengeCompleted:true,omissionsResolved:true},units:intake.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'EXTRACTED_RELEVANT_INFORMATION',reason:'',extractedStatements:[{statementKey:'S'+String(i+1),text:u.rawValueText||('Captured '+u.label),statementClass:'FACT'}]}))});
  p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true,blocked:false,reasons:[]};
  if(stage>=3){p.stages[2].status='COMPLETE';p.stages[2].gate={complete:true,blocked:false,reasons:[]};p.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='NO_APPLICABLE_EXTERNAL_SOURCE';}
  if(stage>=4){p.stages[3].status='COMPLETE';p.stages[3].gate={complete:true,blocked:false,reasons:[]};}
  for(let prior=4;prior<stage;prior++){p.stages[prior].status='COMPLETE';p.stages[prior].gate={complete:true,blocked:false,reasons:[]};}
  return p;
}
function fixturePromptOperation(stage){
  return stage===19?'COMPARE':schema.STAGE_CONTRACTS[stage].operations[0];
}
function fixturePromptOptions(stage,operation=fixturePromptOperation(stage)){
  const required=schema.operationContract(stage,operation)?.scopeRequirements||[];
  const scope={};
  if(required.includes('runId'))scope.runId=`RUN-${stage}-${operation}-FIXTURE`;
  if(required.includes('contextId'))scope.contextId=`CONTEXT-${stage}-${operation}-FIXTURE`;
  return {operation,...(Object.keys(scope).length?{scope}:{})};
}
function isVerifierOperation(stage,operation){return Number(stage)===12||([17,19].includes(Number(stage))&&operation==='VERIFY');}
function seedVerificationRelation(p,{runId='RUN-VERIFICATION-FIXTURE',contextId='CONTEXT-VERIFICATION-FIXTURE',iterationId='ITERATION-VERIFICATION-FIXTURE',candidateId='CANDIDATE-VERIFICATION-FIXTURE'}={}){
  engine.ensureShape(p);
  if(engine.requiredVerificationRelationSet(p,iterationId).tuples.some(tuple=>tuple.runId===runId))return;
  const ids={requirementId:`REQ-${runId}`,propositionId:`PROPOSITION-${runId}`,testId:`TEST-${runId}`,runId,contextId,iterationId,candidateId};
  const versions={inputVersion:p.job.CURRENT_INPUT_VERSION,sourceSetVersion:p.job.CURRENT_SOURCE_SET_VERSION,requirementsVersion:p.job.CURRENT_REQUIREMENTS_VERSION,testSuiteVersion:p.job.CURRENT_TEST_SUITE_VERSION,instructionVersion:p.job.CURRENT_INSTRUCTION_VERSION};
  const requirementScope={inputVersion:versions.inputVersion,sourceSetVersion:versions.sourceSetVersion,requirementsVersion:versions.requirementsVersion};
  const testScope={...requirementScope,testSuiteVersion:versions.testSuiteVersion};
  const iterationScope={...testScope,instructionVersion:versions.instructionVersion,iterationId,candidateId};
  p.projectData.requirements.push({id:ids.requirementId,stage:4,active:true,validity:'CURRENT',scope:requirementScope,fields:{REQ_ID:ids.requirementId,MANDATORY_OPTIONAL_STATUS:'MANDATORY',NORMATIVE_CLASSIFICATION:'MANDATORY',APPLICABILITY:'APPLICABLE',PRIMARY_PROPOSITION_ID:ids.propositionId},relationships:{PRIMARY_PROPOSITION_ID:ids.propositionId}});
  p.projectData.propositions.push({id:ids.propositionId,stage:4,active:true,validity:'CURRENT',scope:requirementScope,fields:{PROPOSITION_ID:ids.propositionId,REQUIREMENT_ID:ids.requirementId,PROPOSITION_TEXT:'The controlled verification fixture satisfies its required proposition.',SUBJECT_AND_SCOPE_DESCRIPTION:'The exact current reserved run.',SATISFACTION_MEANING:'The required run output satisfies the proposition.',FAILURE_MEANING:'The required run output does not satisfy the proposition.',STATUS:'CURRENT'},relationships:{REQUIREMENT_ID:ids.requirementId}});
  p.projectData.tests.push({id:ids.testId,stage:6,active:true,validity:'CURRENT',scope:testScope,fields:{TEST_ID:ids.testId,REQ_ID:ids.requirementId,TEST_TYPE:'PROGRAMMATIC',STATUS:'READY',TEST_ROLE:'REQUIRED_PROOF',RELEASE_BEARING:true,TARGET_PROPOSITION_IDS:[ids.propositionId],TEST_PROPOSITION_TEXT:'The exact current run satisfies the required proposition.',POSITIVE_RESULT_MEANING:'The proposition is established.',NEGATIVE_RESULT_MEANING:'The proposition is refuted.',SEMANTIC_COVERAGE_DISPOSITION:'EQUIVALENT'},relationships:{REQ_ID:ids.requirementId,TARGET_PROPOSITION_IDS:[ids.propositionId]}});
  p.projectData.candidateFreezes.push({id:candidateId,stage:10,active:true,validity:'CURRENT',scope:iterationScope,fields:{CANDIDATE_ID:candidateId,ITERATION_ID:iterationId},relationships:{ITERATION_ID:iterationId}});
  p.projectData.iterations.push({id:iterationId,stage:10,active:true,validity:'CURRENT',scope:iterationScope,fields:{ITERATION_ID:iterationId,CANDIDATE_ID:candidateId},relationships:{CANDIDATE_ID:candidateId}});
  p.projectData.freshContexts.push({id:contextId,stage:11,active:true,validity:'CURRENT',scope:{...iterationScope,runId,contextId},fields:{CONTEXT_ID:contextId,ITERATION_ID:iterationId,RUN_ID:runId},relationships:{ITERATION_ID:iterationId,RUN_ID:runId}});
  p.projectData.runs.push({id:runId,stage:11,active:true,validity:'CURRENT',scope:{...iterationScope,runId,contextId},fields:{RUN_ID:runId,ITERATION_ID:iterationId,CANDIDATE_ID:candidateId,CONTEXT_ID:contextId},relationships:{ITERATION_ID:iterationId,CANDIDATE_ID:candidateId,CONTEXT_ID:contextId}});
  p.job.CURRENT_ITERATION=iterationId;
  const relation=engine.requiredVerificationRelationSet(p,iterationId);
  if(!relation.tuples.some(tuple=>tuple.propositionId===ids.propositionId&&tuple.requirementId===ids.requirementId&&tuple.runId===runId&&tuple.testId===ids.testId))throw new Error('Verifier fixture failed to create one coherent current proposition/requirement/test/run relation.');
}
function fixtureBuildPrompt(stage,p,options=fixturePromptOptions(stage)){
  preparePromptPrerequisites(p,stage);
  const operation=options?.operation||fixturePromptOperation(stage),scope=options?.scope||{};
  if(isVerifierOperation(stage,operation))seedVerificationRelation(p,{runId:scope.runId||`RUN-${stage}-${operation}-FIXTURE`,contextId:scope.contextId||`CONTEXT-${stage}-${operation}-FIXTURE`,iterationId:scope.iterationId||'ITERATION-VERIFICATION-FIXTURE',candidateId:scope.candidateId||'CANDIDATE-VERIFICATION-FIXTURE'});
  return prompts.buildPromptRecord(stage,p,options);
}
function savePrompt(p,stage){
  preparePromptPrerequisites(p,stage);
  if(stage===4)prepareStage4Upstream(p);
  const operation=fixturePromptOperation(stage);
  const options=fixturePromptOptions(stage,operation);
  const record={...fixtureBuildPrompt(stage,p,options),generatedAt:new Date().toISOString(),iteration:p.job.CURRENT_ITERATION||'NOT APPLICABLE'};
  p.projectData.generatedPrompts.push(record);
  return record;
}
function reserveFixturePrompt(p,{stage,operation,targetSlot,contextId}){
  const scope=prompts.scopeFor(stage,p,{contextId});
  const provisionalPrompt=fixtureBuildPrompt(stage,p,{operation,scope:{contextId}});
  const packageManifestHash=globalThis.closedLoopHash.sha256Value({
    schema:'closed-loop-verification-package/1',
    jobId:p.job.JOB_ID,
    stage,
    operation,
    targetSlot,
    scope
  });
  const packageId=`PACKAGE-${packageManifestHash.slice(0,24).toUpperCase()}`;
  const reservation=engine.reserveOperation(p,{
    stage,
    operation,
    targetSlot,
    packageId,
    promptIdentity:provisionalPrompt.instructionId,
    contextSignature:'',
    packageManifestHash,
    expectedRevision:Number(p.revision||0),
    owningBrowserTabInstance:'INGESTION-FIXTURE-TAB',
    scope,
    disclosureClassification:'INTERNAL',
    authorizationBasis:'CONTROLLED_VERIFICATION_FIXTURE'
  });
  const promptRecord={...fixtureBuildPrompt(stage,p,{operation,scope:{contextId}}),generatedAt:new Date().toISOString(),iteration:p.job.CURRENT_ITERATION||'NOT APPLICABLE'};
  p.projectData.generatedPrompts.push(promptRecord);
  if(!promptRecord.operationBinding)throw new Error(`Reserved Stage ${stage} ${operation} fixture did not receive its application operation binding.`);
  const reservationId=engine.recordId(reservation,'operationReservations');
  if(promptRecord.operationBinding.operationReservationId!==reservationId)throw new Error(`Reserved Stage ${stage} ${operation} prompt bound the wrong operation reservation.`);
  return {promptRecord,reservation,reservationId,packageId,packageManifestHash,scope};
}
function safeValue(name){
  if(name==='TEST_TYPE')return 'DETERMINISTIC';
  if(name==='EXECUTION_MODE')return 'EXTERNAL_AGENT_TOOL';
  if(/ARTIFACT_REQUIREMENTS/.test(name))return 'NONE';
  if(/URL_REFERENCE/.test(name))return 'https://www.w3.org/TR/WCAG22/';
  if(/SOURCE_TYPE/.test(name))return 'OFFICIAL_STANDARD';
  if(/TITLE/.test(name))return 'Web Content Accessibility Guidelines (WCAG) 2.2';
  if(/ISSUING_ORGANIZATION_OR_AUTHOR/.test(name))return 'World Wide Web Consortium';
  if(/PUBLICATION_ORIGIN/.test(name))return 'W3C Recommendation';
  if(/INSPECTION_STATUS/.test(name))return 'INSPECTED';
  if(/CURRENCY_STATUS/.test(name))return 'CURRENT';
  if(/SUPERSESSION_STATUS/.test(name))return 'NOT SUPERSEDED';
  if(/CONTROLLING_STATE/.test(name))return 'CONTROLLING WHERE APPLICABLE';
  if(/AUTHORITY_LEVEL|AUTHORITY_ROLE/.test(name))return 'PRIMARY TECHNICAL AUTHORITY';
  if(/STATUS|STATE|DETERMINATION|RESULT/.test(name))return 'SATISFIED';
  if(/PASS_NUMBER/.test(name))return 1;
  return `verified-${name.toLowerCase()}`;
}
function valueForDefinition(def){if(def.enumValues?.length)return def.enumValues[0];if(def.valueType==='INTEGER')return 1;if(def.valueType==='NUMBER')return 1;if(def.valueType==='BOOLEAN')return true;if(def.valueType==='STRING_ARRAY'||def.valueType==='REFERENCE_ARRAY')return ['verified'];if(def.valueType==='OBJECT_ARRAY')return [{}];if(def.valueType==='OBJECT'||def.valueType==='NULLABLE_OBJECT')return {};return 'verified';}
function validEnvelope(p,stage,promptRecord){
  const contract=schema.STAGE_CONTRACTS[stage],operationContract=schema.operationContract(stage,promptRecord.operation),stageFields=operationContract?.allowedStageData||contract.allowedStageData,writableCollections=operationContract?.agentWritableCollections||contract.allowedCollections;
  const stageData={};
  const agentStageFields=stageFields.filter(name=>schema.stageFieldDefinition(stage,name).producer===schema.PRODUCER.AGENT);
  if(agentStageFields.length){const name=agentStageFields[0];stageData[name]=valueForDefinition(schema.stageFieldDefinition(stage,name));}
  if(stage===1){const m=promptRecord.contextManifest.intakeCoverageManifest;stageData.EXACT_DELIVERABLE_REQUESTED='Verified deliverable';stageData.ASSUMPTIONS='NONE';stageData.UNKNOWN_INFORMATION='NONE';stageData.INPUT_SET_CONTENTS=JSON.stringify({schema:'closed-loop-stage01-capture/1',inputVersion:m.inputVersion,manifestSha256:m.manifestSha256,semanticPasses:{exhaustiveExtractionCompleted:true,omissionChallengeCompleted:true,omissionsResolved:true},units:m.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'EXTRACTED_RELEVANT_INFORMATION',reason:'',extractedStatements:[{statementKey:'S'+String(i+1),text:u.rawValueText||u.label,statementClass:'FACT'}]}))});}
  const records={};
  if(!Object.keys(stageData).length||stage===4){
    const collection=writableCollections.find(name=>name!=='blockers'&&schema.recordAgentFields(name).length)||writableCollections.find(name=>schema.recordAgentFields(name).length);
    if(!collection)return null;
    const def=schema.RECORD_SCHEMAS[collection];
    const fields={};
    for(const name of def.required){if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=safeValue(name);}
    if(!Object.keys(fields).length){const agentField=schema.recordAgentFields(collection)[0];if(agentField)fields[agentField]=safeValue(agentField);}
    records[collection]=[{tempKey:'record-1',fields,relationships:{},evidenceRefs:['evidence-1']}];
    if(stage===4&&collection==='requirements'){
      const obligationManifest=promptRecord.contextManifest.obligationManifest;
      records.requirements=(obligationManifest.items||[]).map((item,index)=>{
        const requirementFields={};
        for(const name of def.required)if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)requirementFields[name]=safeValue(name);
        requirementFields.USER_INPUT_RELATIONSHIP=item.obligationId;
        return {tempKey:'requirement-'+String(index+1),fields:requirementFields,relationships:{},evidenceRefs:['evidence-1']};
      });
      records.propositions=records.requirements.map((requirement,index)=>({
        tempKey:'proposition-'+String(index+1),
        fields:{
          PROPOSITION_TEXT:`The controlled deliverable satisfies ${requirement.fields.USER_INPUT_RELATIONSHIP}.`,
          SUBJECT_AND_SCOPE_DESCRIPTION:'The current controlled deliverable in the current project scope.',
          SATISFACTION_MEANING:'Current evidence establishes the complete linked obligation.',
          FAILURE_MEANING:'Current evidence establishes that the linked obligation is not completely satisfied.'
        },
        relationships:{REQUIREMENT_ID:{tempKey:requirement.tempKey}},
        evidenceRefs:['evidence-1']
      }));
    }
  }
  return {
    schema:schema.RESPONSE_SCHEMA,
    jobId:p.job.JOB_ID,
    stage,
    operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},...(promptRecord.operationBinding?{operationBinding:{...promptRecord.operationBinding}}:{}),scope:promptRecord.scope,
    responseType:'DATA_PROPOSAL',
    humanInputRequests:[],stageData,records,
    evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Controlled verification evidence',location:'verification fixture',content:`stage-${stage}-evidence`}],
    unresolved:[],warnings:[],attachments:[]
  };
}
function blockedEnvelope(p,stage,promptRecord){return {schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:{...promptRecord.scope},responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'u-1',kind:'MISSING_CAPABILITY',description:'Controlled blocked fixture',whyBlocking:'Scope identity validation fixture.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};}
function sourceProposal(tempKey='source-1',overrides={}){return {tempKey,fields:{TITLE:'Web Content Accessibility Guidelines (WCAG) 2.2',ISSUING_ORGANIZATION_OR_AUTHOR:'World Wide Web Consortium',SOURCE_TYPE:'OFFICIAL_STANDARD',PUBLICATION_ORIGIN:'W3C Recommendation',URL_REFERENCE:'https://www.w3.org/TR/WCAG22/',PUBLICATION_UPDATE_DATE:'2024-12-12',RETRIEVAL_DATE:'2026-08-25',AUTHORITY_LEVEL:'PRIMARY TECHNICAL AUTHORITY',AUTHORITY_ROLE:'GOVERNING WHERE APPLICABLE',RELEVANCE:'Independent accessibility authority',APPLICABLE_PORTIONS:'Conformance requirements',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT SUPERSEDED',CONTROLLING_STATE:'CONTROLLING WHERE APPLICABLE',NOTES:'Controlled fixture',...overrides},relationships:{},evidenceRefs:['evidence-1']};}

function sourceSearchEnvelope(p,promptRecord,{performerExternalContextId}={}){
  const envelope=validEnvelope(p,2,promptRecord);
  envelope.stageData={
    AUTHORITY_HIERARCHY:'No applicable external source was found inside the exact bounded search universe.',SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE',KNOWN_CONTROLLING_SOURCES_EXAMINED:'Every user-identified source and declared search location was examined.',SEARCH_UNIVERSE:'The declared verification fixture source universe.',SEARCH_PROCEDURE:'Search every declared location using every recorded strategy and disposition every candidate.',SEARCH_LOCATIONS:'Fixture repository A; fixture repository B',SEARCH_QUERIES_OR_STRATEGIES:'exact fixture phrase; governing authority phrase',SEARCH_CUTOFF:'2026-09-01',SEARCH_LIMITATIONS:'No unrecorded access limitation inside the bounded fixture universe.',SEARCH_EXECUTION_EVIDENCE:'source-search-execution',DISCOVERY_RISK:'NONMATERIAL'
  };
  envelope.records={};
  envelope.evidence=[{temporaryKey:'source-search-execution',kind:'SOURCE_SEARCH_EXECUTION',description:'The bounded search procedure was executed completely.',location:'Reserved Stage 02 search context',content:JSON.stringify({executed:true,status:'COMPLETE',searchPerformerContextId:performerExternalContextId,userIdentifiedSourcesInputSha256:globalThis.closedLoopHash.sha256Value(String(p.job.KNOWN_AUTHORITATIVE_SOURCES||'')),discoveredCandidates:[]})}];
  return envelope;
}

function sourceAdequacyEnvelope(p,promptRecord,{performerExternalContextId,reviewerExternalContextId}={}){
  return {schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:2,operation:'ADEQUACY_REVIEW',promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},operationBinding:{...promptRecord.operationBinding},scope:{...promptRecord.scope},responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{},evidence:[{temporaryKey:'source-search-adequacy',kind:'SOURCE_SEARCH_ADEQUACY_REVIEW',description:'Independent review accepted the exact bounded search procedure and its empty candidate set.',location:'Separately reserved Stage 02 adequacy-review context',content:JSON.stringify({determination:'ADEQUATE',reviewerContextId:reviewerExternalContextId,searchPerformerContextId:performerExternalContextId,independenceBasis:'APPLICATION_ESTABLISHED',discoveryRiskMateriality:'NONMATERIAL',discoveredCandidateCount:0,reviewedCandidateDispositions:true,reason:'The bounded locations, strategies, cutoff, limitations, and complete empty candidate disposition set are adequate for this fixture.'})}],unresolved:[],warnings:[],attachments:[]};
}

function reservedSourceSearchFixture(p,label='FIXTURE'){
  p.activeStage=2;
  const token=String(label).replace(/[^A-Z0-9]+/gi,'-').toUpperCase(),performerExternalContextId=`EXTERNAL-STAGE02-${token}`,performer=engine.registerFreshContext(p,{stage:2,externalContextIdentifier:performerExternalContextId,operatorLabel:'VERIFICATION_OPERATOR',purpose:'GENERAL'}),performerContextId=engine.recordId(performer,'freshContexts'),reserved=reserveFixturePrompt(p,{stage:2,operation:'SEARCH_EXECUTION',targetSlot:`STAGE02-SEARCH-${token}`,contextId:performerContextId});
  return {promptRecord:reserved.promptRecord,envelope:sourceSearchEnvelope(p,reserved.promptRecord,{performerExternalContextId}),performerExternalContextId,performerContextId,reserved};
}

const allStages=[];
for(let stage=1;stage<=30;stage++){
  let p=project(`JOB-E2E-${String(stage).padStart(2,'0')}`);
  p.activeStage=stage;
  if(stage===2){
    const performerExternalContextId='EXTERNAL-STAGE02-SEARCH-FIXTURE',performer=engine.registerFreshContext(p,{stage:2,externalContextIdentifier:performerExternalContextId,operatorLabel:'VERIFICATION_OPERATOR',purpose:'GENERAL'}),performerContextId=engine.recordId(performer,'freshContexts');
    const searchReserved=reserveFixturePrompt(p,{stage:2,operation:'SEARCH_EXECUTION',targetSlot:'STAGE02-SEARCH-EXECUTION',contextId:performerContextId}),searchPrompt=searchReserved.promptRecord,searchEnvelope=sourceSearchEnvelope(p,searchPrompt,{performerExternalContextId}),searchPrepared=ingestion.prepare(p,{stage:2,text:JSON.stringify(searchEnvelope),promptRecord:searchPrompt});
    if(!searchPrepared.validation.valid)throw new Error(`Stage 2 SEARCH_EXECUTION valid response rejected: ${JSON.stringify(searchPrepared.validation.issues)}`);
    if(!searchPrepared.proposal||searchPrepared.proposal.status!=='PENDING_OPERATOR_REVIEW'||searchPrepared.project.projectData.acceptedChanges.length)throw new Error('Stage 2 SEARCH_EXECUTION did not remain raw-first pending operator acceptance.');
    const searchCommitted=ingestion.commit(searchPrepared.project,searchPrepared.proposal.proposalId,{operator:'VERIFICATION_OPERATOR',reviewNote:'Accepted the bounded source-search execution fixture.'});
    p=searchCommitted.project;p.activeStage=2;
    if(p.projectData.acceptedChanges.length!==1||p.projectData.acceptedChanges[0].operation!=='SEARCH_EXECUTION')throw new Error('Stage 2 SEARCH_EXECUTION did not create exactly one operation-bound canonical change.');

    const reviewerExternalContextId='EXTERNAL-STAGE02-ADEQUACY-FIXTURE',reviewer=engine.registerFreshContext(p,{stage:2,externalContextIdentifier:reviewerExternalContextId,operatorLabel:'VERIFICATION_OPERATOR',purpose:'REVIEWER'}),reviewerContextId=engine.recordId(reviewer,'freshContexts');
    const reviewReserved=reserveFixturePrompt(p,{stage:2,operation:'ADEQUACY_REVIEW',targetSlot:'STAGE02-ADEQUACY-REVIEW',contextId:reviewerContextId}),reviewPrompt=reviewReserved.promptRecord,reviewEnvelope=sourceAdequacyEnvelope(p,reviewPrompt,{performerExternalContextId,reviewerExternalContextId}),reviewPrepared=ingestion.prepare(p,{stage:2,text:JSON.stringify(reviewEnvelope),promptRecord:reviewPrompt});
    if(!reviewPrepared.validation.valid)throw new Error(`Stage 2 ADEQUACY_REVIEW valid response rejected: ${JSON.stringify(reviewPrepared.validation.issues)}`);
    if(!reviewPrepared.proposal||reviewPrepared.proposal.status!=='PENDING_OPERATOR_REVIEW'||reviewPrepared.project.projectData.acceptedChanges.length!==1)throw new Error('Stage 2 ADEQUACY_REVIEW did not preserve the accepted search while awaiting separate operator acceptance.');
    const reviewCommitted=ingestion.commit(reviewPrepared.project,reviewPrepared.proposal.proposalId,{operator:'VERIFICATION_OPERATOR',reviewNote:'Accepted the independent bounded-search adequacy review fixture.'});
    p=reviewCommitted.project;
    if(p.projectData.acceptedChanges.length!==2||p.projectData.acceptedChanges[1].operation!=='ADEQUACY_REVIEW')throw new Error('Stage 2 did not preserve the ordered SEARCH_EXECUTION then ADEQUACY_REVIEW changes.');
    if(p.projectData.extractionManifests.length!==2)throw new Error('Stage 2 did not preserve separate extraction manifests for search and adequacy review.');
    const sourceAssessment=engine.sourceSearchAssessment(p);if(!sourceAssessment.complete)throw new Error(`Stage 2 bounded search sequence did not close its own current contract: ${sourceAssessment.reasons.join(' | ')} Details: ${JSON.stringify(sourceAssessment)}`);
    const serialized=JSON.stringify(p),reloaded=JSON.parse(serialized);engine.ensureShape(reloaded);
    if(reloaded.projectData.rawResponses.at(-1)?.completeRawResponse!==JSON.stringify(reviewEnvelope))throw new Error('Stage 2 independent adequacy response did not survive reload.');
    const nextPrompt=fixtureBuildPrompt(3,reloaded,fixturePromptOptions(3)).prompt;if(!nextPrompt.includes(`JOB_ID: ${p.job.JOB_ID}`)||!nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error('Stage 3 prompt did not consume the accepted bounded Stage 2 search and adequacy sequence.');
    allStages.push({stage,searchProposal:searchPrepared.proposal.proposalId,adequacyProposal:reviewPrepared.proposal.proposalId,accepted:p.projectData.acceptedChanges.at(-1).changeId});
    continue;
  }
  const promptRecord=savePrompt(p,stage);
  const envelope=validEnvelope(p,stage,promptRecord);
  if(!envelope){
    const prohibited={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
    const rejected=ingestion.prepare(p,{stage,text:JSON.stringify(prohibited),promptRecord});
    if(rejected.validation.valid)throw new Error(`Stage ${stage} application-only contract accepted an empty agent DATA_PROPOSAL.`);
    allStages.push({stage,applicationControlled:true});
    continue;
  }
  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(envelope),promptRecord});
  if(!prepared.validation.valid)throw new Error(`Stage ${stage} valid response rejected: ${JSON.stringify(prepared.validation.issues)}`);
  if(!prepared.proposal||prepared.proposal.status!=='PENDING_OPERATOR_REVIEW')throw new Error(`Stage ${stage} did not create a pending proposal.`);
  if(prepared.project.projectData.acceptedChanges.length)throw new Error(`Stage ${stage} mutated canonical state before operator acceptance.`);
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFICATION_OPERATOR',reviewNote:'Controlled test acceptance.'});
  p=committed.project;
  if(!p.projectData.acceptedChanges.length)throw new Error(`Stage ${stage} did not create an accepted canonical change.`);
  if(!p.projectData.extractionManifests.length)throw new Error(`Stage ${stage} did not create an extraction manifest.`);
  const receipt=p.projectData.outputReceipts.at(-1);
  if(receipt.acceptedCanonicalChangeId==='NONE'||receipt.extractionManifestId==='NONE')throw new Error(`Stage ${stage} receipt was not linked through canonical acceptance.`);
  const serialized=JSON.stringify(p); const reloaded=JSON.parse(serialized); engine.ensureShape(reloaded);
  if(reloaded.projectData.rawResponses.at(-1)?.completeRawResponse!==JSON.stringify(envelope))throw new Error(`Stage ${stage} raw response did not survive reload.`);
  if(stage<30){const nextStage=stage+1;preparePromptPrerequisites(reloaded,nextStage);if(nextStage===4)prepareStage4Upstream(reloaded);const nextOptions=fixturePromptOptions(nextStage),nextPrompt=fixtureBuildPrompt(nextStage,reloaded,nextOptions).prompt,isolated=[11,12,23,24].includes(nextStage);if(!nextPrompt.includes(`JOB_ID: ${p.job.JOB_ID}`))throw new Error(`Stage ${nextStage} prompt lost JOB_ID isolation.`);if(isolated&&nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${nextStage} isolation prompt leaked generic prior-stage context.`);if(!isolated&&!nextPrompt.includes('PRIOR STAGE DECISION AND ACCEPTED DATA'))throw new Error(`Stage ${nextStage} prompt did not consume accepted prior-stage context.`);}
  allStages.push({stage,proposal:prepared.proposal.proposalId,accepted:p.projectData.acceptedChanges.at(-1).changeId});
}

let negativeCount=0;
function negativeAt(name,stage,mutate,expectedCode){
  const p=project(`JOB-NEG-${name.replace(/[^A-Z0-9]/gi,'').toUpperCase()}`),stage2=Number(stage)===2?reservedSourceSearchFixture(p,name):null,promptRecord=stage2?.promptRecord||savePrompt(p,stage);
  let envelope=stage2?.envelope||validEnvelope(p,stage,promptRecord);if(!envelope)throw new Error(`${name}: Stage ${stage} has no agent envelope fixture.`);const mutated=mutate(envelope,p,promptRecord);if(mutated!==undefined)envelope=mutated;
  const text=typeof envelope==='string'?envelope:JSON.stringify(envelope);
  const prepared=ingestion.prepare(p,{stage,text,promptRecord});
  if(prepared.validation.valid)throw new Error(`${name}: invalid response was accepted.`);
  if(expectedCode&&!prepared.validation.issues.some(issue=>issue.code===expectedCode))throw new Error(`${name}: expected ${expectedCode}; got ${prepared.validation.issues.map(x=>x.code).join(', ')}.`);
  if(prepared.project.projectData.acceptedChanges.length)throw new Error(`${name}: canonical state changed on validation failure.`);
  if(!prepared.project.projectData.rawResponses.length||!prepared.project.projectData.responseValidations.length)throw new Error(`${name}: failed raw response/validation was not preserved.`);
  negativeCount++;
}
function scopeNegative(name,stage,key){const p=project(`JOB-SCOPE-${name.replace(/[^A-Z0-9]/gi,'').toUpperCase()}`),pr=savePrompt(p,stage),e=blockedEnvelope(p,stage,pr);e.scope[key]=`STALE-${key}`;const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='STALE_SCOPE'&&i.path===`/scope/${key}`))throw new Error(`${name}: stale ${key} was not rejected.`);if(prepared.project.projectData.acceptedChanges.length)throw new Error(`${name}: stale scope mutated canonical state.`);negativeCount++;}
const negative=(name,mutate,expectedCode)=>negativeAt(name,2,mutate,expectedCode);

// Stage 01 /3 accepts only the exact closed disposition vocabulary. Every
// current value is ingestible with its contracted statement/reason shape;
// broad artifact exclusions additionally require challenge reconciliation.
{
  const dispositions=['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE'];
  for(const disposition of dispositions){
    const p=project(`JOB-STAGE01-DISPOSITION-${disposition}`),pr=savePrompt(p,1),e=validEnvelope(p,1,pr),capture=JSON.parse(e.stageData.INPUT_SET_CONTENTS),noStatement=['NO_PROJECT_RELEVANT_INFORMATION','INACCESSIBLE_OR_BLOCKED'].includes(disposition);
    capture.units=capture.units.map(unit=>({...unit,disposition,reason:noStatement?'The controlled raw unit was deliberately excluded under this exact fixture disposition.':'',extractedStatements:noStatement?[]:unit.extractedStatements,...(disposition==='LATER_RESOLVABLE'?{laterResolutionPath:'STAGE_02_BOUNDED_SOURCE_RESEARCH'}:{})}));
    if(disposition==='UNRESOLVED_HUMAN_AUTHORITY')capture.humanAuthorityIssues=capture.units.map(unit=>({sourceUnitId:unit.sourceUnitId,statementKey:unit.extractedStatements[0].statementKey,questionClass:'ASK_NOW_NONBLOCKING',disposition:'ASKED_AND_DEFERRED',answer:'DEFERRED_BY_HUMAN_AUTHORITY'}));
    e.stageData.INPUT_SET_CONTENTS=JSON.stringify(capture);
    const prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(e),promptRecord:pr});
    if(!prepared.validation.valid)throw new Error(`Exact Stage 01 disposition ${disposition} was rejected: ${JSON.stringify(prepared.validation.issues)}`);
  }
  {
    const p=project('JOB-STAGE01-LEGACY-DISPOSITION'),pr=savePrompt(p,1),e=validEnvelope(p,1,pr),capture=JSON.parse(e.stageData.INPUT_SET_CONTENTS);capture.units[0].disposition='incorporated into the job definition';e.stageData.INPUT_SET_CONTENTS=JSON.stringify(capture);const prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(e),promptRecord:pr});
    if(prepared.validation.valid||!prepared.validation.issues.some(issue=>issue.code==='INVALID_CURRENT_INTAKE_DISPOSITION'))throw new Error('Legacy Stage 01 disposition phrase was not rejected by the current /3 contract.');negativeCount++;
  }
  for(const disposition of ['NO_PROJECT_RELEVANT_INFORMATION','INACCESSIBLE_OR_BLOCKED']){
    let p=project(`JOB-STAGE01-CHALLENGE-${disposition}`);const artifactId=`ARTIFACT-STAGE01-${disposition}`,sha256='a'.repeat(64),artifactScope={inputVersion:p.job.CURRENT_INPUT_VERSION};
    p.projectData.artifacts.push({id:artifactId,stage:1,active:true,validity:'CURRENT',scope:artifactScope,fields:{ARTIFACT_ID:artifactId,FILENAME:'large-intake-fixture.txt',TYPE:'text/plain',VERSION:'1',BYTE_SIZE:1048576,SHA256:sha256,ROLE:'USER_SUPPLIED_INPUT',STORAGE_REFERENCE:'indexeddb-fixture',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},relationships:{}});p.stages[1].authorizedFiles=[{artifactId}];
    const pr=savePrompt(p,1);if(!pr.contextManifest.semanticChallengePlan?.challengeRequired)throw new Error(`${disposition} artifact fixture did not activate the bounded Stage 01 semantic challenge.`);
    const e=validEnvelope(p,1,pr),capture=JSON.parse(e.stageData.INPUT_SET_CONTENTS),artifactUnit=pr.contextManifest.intakeCoverageManifest.units.find(unit=>unit.artifactId===artifactId);if(!artifactUnit)throw new Error('Stage 01 challenge fixture omitted its supplied artifact from the raw-input manifest.');
    const unit=capture.units.find(item=>item.sourceUnitId===artifactUnit.unitId);unit.disposition=disposition;unit.reason='The complete supplied artifact received a broad semantic exclusion in this controlled challenge fixture.';unit.extractedStatements=[];capture.artifactInspections=[{sourceUnitId:artifactUnit.unitId,artifactId,artifactSha256:sha256,complete:true}];e.stageData.INPUT_SET_CONTENTS=JSON.stringify(capture);
    const unchallenged=ingestion.prepare(p,{stage:1,text:JSON.stringify(e),promptRecord:pr});
    if(unchallenged.validation.valid||!unchallenged.validation.issues.some(issue=>issue.code==='STAGE01_BROAD_EXCLUSION_UNCHALLENGED')||!unchallenged.validation.issues.some(issue=>issue.code==='REQUIRED_SEMANTIC_CHALLENGE_MISSING'))throw new Error(`${disposition} did not fail closed before independent challenge reconciliation.`);
    p=unchallenged.project;
    e.evidence.push({temporaryKey:'semantic-challenge-reconciliation',kind:'SEMANTIC_CHALLENGE_RECONCILIATION',description:'Independent broad-exclusion challenge reconciliation',location:'fresh controlled Stage 01 challenge context',content:JSON.stringify({sourceUnitId:artifactUnit.unitId,disposition,determination:'NO_MATERIAL_OMISSION_FOUND_BY_DEFINED_CHALLENGE'})});
    const selfAsserted=ingestion.prepare(p,{stage:1,text:JSON.stringify(e),promptRecord:pr});
    if(selfAsserted.validation.valid||!selfAsserted.validation.issues.some(issue=>issue.code==='REQUIRED_SEMANTIC_CHALLENGE_MISSING'))throw new Error(`${disposition} incorrectly accepted same-response self-asserted challenge evidence.`);
    p=selfAsserted.project;negativeCount+=2;

    const challengeContext=`CONTEXT-STAGE01-${disposition}-CHALLENGE`,challengeSlot=`STAGE01-${disposition}-CHALLENGE`,challengeReservation=reserveFixturePrompt(p,{stage:1,operation:'SEMANTIC_CHALLENGE',targetSlot:challengeSlot,contextId:challengeContext}),challengePrompt=challengeReservation.promptRecord;
    if(challengePrompt.contextManifest.semanticSuboperationInputs.length)throw new Error(`${disposition} independent challenge leaked the first extraction into its omission-discovery context.`);
    const challengeEnvelope=validEnvelope(p,1,challengePrompt),challengeCapture=JSON.parse(challengeEnvelope.stageData.INPUT_SET_CONTENTS);
    challengeCapture.artifactInspections=[{sourceUnitId:artifactUnit.unitId,artifactId,artifactSha256:sha256,complete:true}];challengeEnvelope.stageData.INPUT_SET_CONTENTS=JSON.stringify(challengeCapture);challengeEnvelope.stageData.CHALLENGE_FINDING_RECORDS=[{sourceUnitId:artifactUnit.unitId,sourceUnitIds:[artifactUnit.unitId],determination:'NO_MATERIAL_OMISSION_FOUND_BY_DEFINED_CHALLENGE',reason:'A separately reserved raw-input-only challenge inspected the complete controlled artifact.'}];challengeEnvelope.operationBinding={...challengePrompt.operationBinding};challengeEnvelope.evidence.push({temporaryKey:'independent-semantic-challenge',kind:'SEMANTIC_CHALLENGE_RECONCILIATION',description:'Separately reserved Stage 01 omission challenge',location:challengeContext,content:JSON.stringify({sourceUnitId:artifactUnit.unitId,disposition,determination:'NO_MATERIAL_OMISSION_FOUND_BY_DEFINED_CHALLENGE'})});
    const challengePrepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(challengeEnvelope),promptRecord:challengePrompt});
    if(!challengePrepared.validation.valid)throw new Error(`${disposition} separately reserved SEMANTIC_CHALLENGE was rejected: ${JSON.stringify(challengePrepared.validation.issues)}`);
    const challengeCommitted=ingestion.commit(challengePrepared.project,challengePrepared.proposal.proposalId,{operator:'VERIFY',reviewNote:'Accepted independent semantic challenge.'});p=challengeCommitted.project;
    if(!challengeCommitted.acceptedChange)throw new Error(`${disposition} semantic challenge did not create an accepted canonical change.`);
    const acceptedChallengeReservation=p.projectData.operationReservations.find(record=>engine.recordId(record,'operationReservations')===challengeReservation.reservationId);if(engine.recordValue(acceptedChallengeReservation,'STATUS')!=='ACCEPTED'||acceptedChallengeReservation.active!==false)throw new Error(`${disposition} semantic challenge reservation was not closed as ACCEPTED.`);

    const reconcileContext=`CONTEXT-STAGE01-${disposition}-RECONCILE`,reconcileSlot=`STAGE01-${disposition}-RECONCILE`,reconcileReservation=reserveFixturePrompt(p,{stage:1,operation:'RECONCILE_INTAKE',targetSlot:reconcileSlot,contextId:reconcileContext}),reconcilePrompt=reconcileReservation.promptRecord,reconcileInputs=reconcilePrompt.contextManifest.semanticSuboperationInputs,firstInput=reconcileInputs.filter(item=>item.operation==='COMPLETE').at(-1),challengeInput=reconcileInputs.filter(item=>item.operation==='SEMANTIC_CHALLENGE').at(-1);
    if(!firstInput||!challengeInput||challengeInput.acceptanceStatus!=='ACCEPTED'||!challengeInput.acceptedChangeId)throw new Error(`${disposition} reconciliation prompt did not bind the failed first extraction and accepted independent challenge.`);
    const observedIdentities=[firstInput.applicationContextIdentity,challengeInput.applicationContextIdentity,reconcileReservation.reservationId];if(new Set(observedIdentities).size!==3)throw new Error(`${disposition} first extraction, challenge, and reconciliation did not use three distinct application identities.`);
    const reconcileEnvelope=validEnvelope(p,1,reconcilePrompt),reconcileCapture=JSON.parse(reconcileEnvelope.stageData.INPUT_SET_CONTENTS),reconcileUnit=reconcileCapture.units.find(item=>item.sourceUnitId===artifactUnit.unitId);reconcileUnit.disposition=disposition;reconcileUnit.reason='The separately reserved challenge found no omitted project-relevant information under the defined review scope.';reconcileUnit.extractedStatements=[];reconcileCapture.artifactInspections=[{sourceUnitId:artifactUnit.unitId,artifactId,artifactSha256:sha256,complete:true}];reconcileEnvelope.stageData.INPUT_SET_CONTENTS=JSON.stringify(reconcileCapture);reconcileEnvelope.stageData.CHALLENGE_FINDING_RECORDS=[{sourceUnitId:artifactUnit.unitId,sourceUnitIds:[artifactUnit.unitId],determination:'RECONCILED_NO_MATERIAL_OMISSION',challengeAcceptedChangeId:challengeInput.acceptedChangeId}];reconcileEnvelope.operationBinding={...reconcilePrompt.operationBinding};reconcileEnvelope.evidence.push({temporaryKey:'reconciled-semantic-challenge',kind:'SEMANTIC_CHALLENGE_RECONCILIATION',description:'Application-bound Stage 01 reconciliation',location:reconcileContext,content:JSON.stringify({sourceUnitId:artifactUnit.unitId,disposition,determination:'RECONCILED_NO_MATERIAL_OMISSION',challengeAcceptedChangeId:challengeInput.acceptedChangeId})});
    const reconciled=ingestion.prepare(p,{stage:1,text:JSON.stringify(reconcileEnvelope),promptRecord:reconcilePrompt});
    if(!reconciled.validation.valid)throw new Error(`${disposition} independently reserved RECONCILE_INTAKE was rejected: ${JSON.stringify(reconciled.validation.issues)}`);
    const reconciliationCommitted=ingestion.commit(reconciled.project,reconciled.proposal.proposalId,{operator:'VERIFY',reviewNote:'Accepted independently bound intake reconciliation.'});
    if(!reconciliationCommitted.acceptedChange||reconciliationCommitted.acceptedChange.operation!=='RECONCILE_INTAKE')throw new Error(`${disposition} reconciliation did not commit through RECONCILE_INTAKE.`);
  }
}

// A response remains bound to the frozen canonical package-descriptor digest,
// not merely to a copied package ID or nonce.
{
  const p=project('JOB-PACKAGE-DESCRIPTOR-DIGEST-MUTATION'),reserved=reserveFixturePrompt(p,{stage:1,operation:'SEMANTIC_CHALLENGE',targetSlot:'PACKAGE-DIGEST-MUTATION',contextId:'CONTEXT-PACKAGE-DIGEST-MUTATION'}),pr=reserved.promptRecord,e=validEnvelope(p,1,pr);e.operationBinding={...pr.operationBinding};
  const changedDigest='b'.repeat(64);reserved.reservation.fields.PACKAGE_MANIFEST_HASH=changedDigest;reserved.reservation.PACKAGE_MANIFEST_HASH=changedDigest;reserved.reservation.packageManifestHash=changedDigest;
  const prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(e),promptRecord:pr});
  if(prepared.validation.valid||!prepared.validation.issues.some(issue=>issue.code==='PACKAGE_DESCRIPTOR_IDENTITY_MISMATCH'))throw new Error(`A changed frozen package-manifest digest was not rejected: ${JSON.stringify(prepared.validation.issues)}`);
  if(prepared.project.projectData.acceptedChanges.length)throw new Error('Package-descriptor digest mismatch mutated canonical state.');negativeCount++;
}

// Stage 04 release-reducing dispositions and multi-obligation merges cannot
// carry their own approval. Each requires a separately reserved, accepted
// challenge and a third, distinct reconciliation reservation.
{
  const dispositionEnvelope=(p,pr,{includeChallenge=true}={})=>{
    const e=validEnvelope(p,4,pr),obligationId=pr.contextManifest.obligationManifest.items[0]?.obligationId,requirement=e.records.requirements.find(item=>String(item.fields.USER_INPUT_RELATIONSHIP).includes(obligationId));
    if(!obligationId||!requirement)throw new Error('Stage 04 disposition fixture could not select a current manifest obligation and its proposed requirement.');
    e.records.requirements=e.records.requirements.filter(item=>item!==requirement);e.records.propositions=e.records.propositions.filter(item=>item.relationships?.REQUIREMENT_ID?.tempKey!==requirement.tempKey);
    e.evidence.push({temporaryKey:'release-reducing-disposition',kind:'OBLIGATION_DISPOSITION',description:'Controlled non-requirement disposition',location:'Stage 04 fixture',content:JSON.stringify({obligationId,disposition:'inapplicable',reason:'The controlled fixture asserts that this obligation is outside the current scope.'})});
    if(includeChallenge)e.evidence.push({temporaryKey:'self-asserted-disposition-challenge',kind:'OBLIGATION_DISPOSITION_CHALLENGE',description:'Same-response challenge claim that must not establish independence',location:'Same Stage 04 response',content:JSON.stringify({obligationId,determination:'NOT_APPLICABLE',reason:'Same-response self-approval fixture.'})});
    return {e,obligationId};
  };
  let p=project('JOB-STAGE04-DISPOSITION-CHALLENGE'),completePrompt=savePrompt(p,4),first=dispositionEnvelope(p,completePrompt),firstPrepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(first.e),promptRecord:completePrompt});
  if(firstPrepared.validation.valid||!firstPrepared.validation.issues.some(issue=>issue.code==='REQUIRED_STAGE04_DISPOSITION_CHALLENGE_MISSING')||!firstPrepared.validation.issues.some(issue=>issue.code==='UNCHALLENGED_OBLIGATION_DISPOSITION'))throw new Error(`Stage 04 COMPLETE self-approved a release-reducing disposition: ${JSON.stringify(firstPrepared.validation.issues)}`);
  p=firstPrepared.project;negativeCount++;
  const compilerPrepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(validEnvelope(p,4,completePrompt)),promptRecord:completePrompt});if(!compilerPrepared.validation.valid)throw new Error(`Stage 04 controlling compiler fixture was rejected before disposition challenge: ${JSON.stringify(compilerPrepared.validation.issues)}`);p=ingestion.commit(compilerPrepared.project,compilerPrepared.proposal.proposalId,{operator:'VERIFY',reviewNote:'Accepted controlling compiler output before independent disposition challenge.'}).project;
  const challengeReservation=reserveFixturePrompt(p,{stage:4,operation:'DISPOSITION_CHALLENGE',targetSlot:'STAGE04-DISPOSITION-CHALLENGE',contextId:'CONTEXT-STAGE04-DISPOSITION-CHALLENGE'}),challengePrompt=challengeReservation.promptRecord,challengeInputs=challengePrompt.contextManifest.semanticSuboperationInputs;
  if(!challengeInputs.some(item=>item.operation==='COMPLETE')||challengeInputs.some(item=>item.applicationContextIdentity===challengeReservation.reservationId))throw new Error('Stage 04 disposition challenge was not bound to a distinct first-compiler identity.');
  const challengeEnvelope=validEnvelope(p,4,challengePrompt);challengeEnvelope.operationBinding={...challengePrompt.operationBinding};challengeEnvelope.stageData.OBLIGATION_DISPOSITION_CHALLENGE_RECORDS=[{obligationId:first.obligationId,determination:'NOT_APPLICABLE',reason:'Independent review accepted the bounded inapplicability rationale.'}];challengeEnvelope.evidence.push({temporaryKey:'independent-disposition-challenge',kind:'OBLIGATION_DISPOSITION_CHALLENGE',description:'Separately reserved disposition challenge',location:'Independent Stage 04 challenge context',content:JSON.stringify({obligationId:first.obligationId,determination:'NOT_APPLICABLE',reason:'Independent review accepted the bounded inapplicability rationale.'})});
  const challengePrepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(challengeEnvelope),promptRecord:challengePrompt});if(!challengePrepared.validation.valid)throw new Error(`Separately reserved Stage 04 DISPOSITION_CHALLENGE was rejected: ${JSON.stringify(challengePrepared.validation.issues)}`);
  const challengeCommitted=ingestion.commit(challengePrepared.project,challengePrepared.proposal.proposalId,{operator:'VERIFY',reviewNote:'Accepted independent disposition challenge.'});p=challengeCommitted.project;
  const challengeRequirementsVersion=p.job.CURRENT_REQUIREMENTS_VERSION,challengeEvidenceIds=challengeCommitted.acceptedChange.canonicalRecordIds.filter(id=>p.projectData.evidenceRecords.some(record=>engine.recordId(record,'evidenceRecords')===id));
  if(!challengeEvidenceIds.length)throw new Error('Stage 04 challenge fixture did not preserve its challenge evidence identity before reconciliation.');
  const reconcileReservation=reserveFixturePrompt(p,{stage:4,operation:'RECONCILE_REQUIREMENTS',targetSlot:'STAGE04-DISPOSITION-RECONCILE',contextId:'CONTEXT-STAGE04-DISPOSITION-RECONCILE'}),reconcilePrompt=reconcileReservation.promptRecord,reconcileInputs=reconcilePrompt.contextManifest.semanticSuboperationInputs,firstInput=reconcileInputs.filter(item=>item.operation==='COMPLETE').at(-1),challengeInput=reconcileInputs.filter(item=>item.operation==='DISPOSITION_CHALLENGE').at(-1);
  if(!firstInput||!challengeInput||challengeInput.acceptanceStatus!=='ACCEPTED'||new Set([firstInput.applicationContextIdentity,challengeInput.applicationContextIdentity,reconcileReservation.reservationId]).size!==3)throw new Error('Stage 04 disposition reconciliation did not bind three distinct compiler/challenge/reconciliation identities.');
  const reconciledDisposition=dispositionEnvelope(p,reconcilePrompt);reconciledDisposition.e.operationBinding={...reconcilePrompt.operationBinding};reconciledDisposition.e.stageData.OBLIGATION_DISPOSITION_CHALLENGE_RECORDS=[{obligationId:reconciledDisposition.obligationId,determination:'NOT_APPLICABLE',challengeAcceptedChangeId:challengeInput.acceptedChangeId}];
  const reconciledPrepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(reconciledDisposition.e),promptRecord:reconcilePrompt});if(!reconciledPrepared.validation.valid)throw new Error(`Separately reserved Stage 04 disposition reconciliation was rejected: ${JSON.stringify(reconciledPrepared.validation.issues)}`);
  const reconciledCommitted=ingestion.commit(reconciledPrepared.project,reconciledPrepared.proposal.proposalId,{operator:'VERIFY',reviewNote:'Accepted independently challenged disposition reconciliation.'});if(reconciledCommitted.acceptedChange?.operation!=='RECONCILE_REQUIREMENTS')throw new Error('Stage 04 disposition reconciliation did not commit through RECONCILE_REQUIREMENTS.');
  const finalProject=reconciledCommitted.project,finalRequirementsVersion=finalProject.job.CURRENT_REQUIREMENTS_VERSION,currentDispositionEvidence=engine.recordsForCurrentScope(finalProject,'evidenceRecords').filter(record=>Number(record.stage)===4&&String(engine.recordValue(record,'KIND')||'').toUpperCase()==='OBLIGATION_DISPOSITION');
  if(!currentDispositionEvidence.length)throw new Error('Stage 04 reconciliation lost its same-transaction obligation-disposition evidence after advancing requirementsVersion.');
  if(reconciledCommitted.acceptedChange.scope?.requirementsVersion!==finalRequirementsVersion||reconciledCommitted.manifest.scope?.requirementsVersion!==finalRequirementsVersion||reconciledCommitted.manifest.entries.some(entry=>entry.scope?.requirementsVersion!==finalRequirementsVersion)||reconciledCommitted.receipt.requirementsVersion!==finalRequirementsVersion)throw new Error('Stage 04 reconciliation receipt, accepted change, or extraction manifest retained the pre-commit requirementsVersion.');
  for(const id of reconciledCommitted.acceptedChange.canonicalRecordIds){let located=null,collection=null;for(const [name,records] of Object.entries(finalProject.projectData)){if(!Array.isArray(records)||!schema.RECORD_SCHEMAS[name])continue;const hit=records.find(record=>engine.recordId(record,name)===id);if(hit){located=hit;collection=name;break;}}if(!located)continue;if(located.scope?.requirementsVersion!==finalRequirementsVersion)throw new Error(`Stage 04 same-transaction ${collection} record ${id} retained stale requirementsVersion ${located.scope?.requirementsVersion}.`);if(located.recordSha256!==globalThis.closedLoopHash.recordSha256(located))throw new Error(`Stage 04 same-transaction ${collection} record ${id} was not rehashed after scope synchronization.`);}
  for(const id of challengeEvidenceIds){const prior=finalProject.projectData.evidenceRecords.find(record=>engine.recordId(record,'evidenceRecords')===id);if(prior.scope?.requirementsVersion!==challengeRequirementsVersion)throw new Error(`Stage 04 reconciliation retroactively restamped prior challenge evidence ${id}.`);}
  const accounting=engine.evaluateObligationAccounting(finalProject);if(!accounting.complete)throw new Error(`Stage 04 obligation accounting did not survive same-transaction scope synchronization: ${accounting.reasons.join(' ')}`);
}
{
  const mergeEnvelope=(p,pr,{includeChallenge=true}={})=>{
    const e=validEnvelope(p,4,pr),obligationIds=pr.contextManifest.obligationManifest.items.slice(0,2).map(item=>item.obligationId),requirements=obligationIds.map(id=>e.records.requirements.find(item=>String(item.fields.USER_INPUT_RELATIONSHIP).includes(id)));
    if(obligationIds.length!==2||requirements.some(item=>!item))throw new Error('Stage 04 atomicity fixture requires two current manifest obligations and requirements.');
    requirements[0].fields.USER_INPUT_RELATIONSHIP=obligationIds.join(' + ');e.records.requirements=e.records.requirements.filter(item=>item!==requirements[1]);e.records.propositions=e.records.propositions.filter(item=>item.relationships?.REQUIREMENT_ID?.tempKey!==requirements[1].tempKey);
    if(includeChallenge)e.evidence.push({temporaryKey:'self-asserted-atomicity-challenge',kind:'ATOMICITY_CHALLENGE',description:'Same-response atomicity claim that must not establish independence',location:'Same Stage 04 response',content:JSON.stringify({obligationIds,determination:'NO_SEMANTIC_LOSS',reason:'Same-response self-approval fixture.'})});
    return {e,obligationIds};
  };
  let p=project('JOB-STAGE04-ATOMICITY-CHALLENGE'),completePrompt=savePrompt(p,4),first=mergeEnvelope(p,completePrompt),firstPrepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(first.e),promptRecord:completePrompt});
  if(firstPrepared.validation.valid||!firstPrepared.validation.issues.some(issue=>issue.code==='REQUIRED_STAGE04_ATOMICITY_CHALLENGE_MISSING')||!firstPrepared.validation.issues.some(issue=>issue.code==='UNCHALLENGED_OBLIGATION_MERGE'))throw new Error(`Stage 04 COMPLETE self-approved a multi-obligation merge: ${JSON.stringify(firstPrepared.validation.issues)}`);
  p=firstPrepared.project;negativeCount++;
  const compilerPrepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(validEnvelope(p,4,completePrompt)),promptRecord:completePrompt});if(!compilerPrepared.validation.valid)throw new Error(`Stage 04 controlling compiler fixture was rejected before atomicity challenge: ${JSON.stringify(compilerPrepared.validation.issues)}`);p=ingestion.commit(compilerPrepared.project,compilerPrepared.proposal.proposalId,{operator:'VERIFY',reviewNote:'Accepted controlling compiler output before independent atomicity challenge.'}).project;
  const challengeReservation=reserveFixturePrompt(p,{stage:4,operation:'ATOMICITY_CHALLENGE',targetSlot:'STAGE04-ATOMICITY-CHALLENGE',contextId:'CONTEXT-STAGE04-ATOMICITY-CHALLENGE'}),challengePrompt=challengeReservation.promptRecord,challengeEnvelope=validEnvelope(p,4,challengePrompt);challengeEnvelope.operationBinding={...challengePrompt.operationBinding};challengeEnvelope.stageData.ATOMICITY_CHALLENGE_RECORDS=[{obligationIds:first.obligationIds,determination:'NO_SEMANTIC_LOSS',reason:'Independent review found the two obligations materially equivalent for this fixture.'}];challengeEnvelope.evidence.push({temporaryKey:'independent-atomicity-challenge',kind:'ATOMICITY_CHALLENGE',description:'Separately reserved atomicity challenge',location:'Independent Stage 04 challenge context',content:JSON.stringify({obligationIds:first.obligationIds,determination:'NO_SEMANTIC_LOSS',reason:'Independent review found no semantic distinction lost.'})});
  const challengePrepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(challengeEnvelope),promptRecord:challengePrompt});if(!challengePrepared.validation.valid)throw new Error(`Separately reserved Stage 04 ATOMICITY_CHALLENGE was rejected: ${JSON.stringify(challengePrepared.validation.issues)}`);
  const challengeCommitted=ingestion.commit(challengePrepared.project,challengePrepared.proposal.proposalId,{operator:'VERIFY',reviewNote:'Accepted independent atomicity challenge.'});p=challengeCommitted.project;
  const reconcileReservation=reserveFixturePrompt(p,{stage:4,operation:'RECONCILE_REQUIREMENTS',targetSlot:'STAGE04-ATOMICITY-RECONCILE',contextId:'CONTEXT-STAGE04-ATOMICITY-RECONCILE'}),reconcilePrompt=reconcileReservation.promptRecord,reconcileInputs=reconcilePrompt.contextManifest.semanticSuboperationInputs,firstInput=reconcileInputs.filter(item=>item.operation==='COMPLETE').at(-1),challengeInput=reconcileInputs.filter(item=>item.operation==='ATOMICITY_CHALLENGE').at(-1);
  if(!firstInput||!challengeInput||challengeInput.acceptanceStatus!=='ACCEPTED'||new Set([firstInput.applicationContextIdentity,challengeInput.applicationContextIdentity,reconcileReservation.reservationId]).size!==3)throw new Error('Stage 04 atomicity reconciliation did not bind three distinct compiler/challenge/reconciliation identities.');
  const reconciledMerge=mergeEnvelope(p,reconcilePrompt);reconciledMerge.e.operationBinding={...reconcilePrompt.operationBinding};reconciledMerge.e.stageData.ATOMICITY_CHALLENGE_RECORDS=[{obligationIds:reconciledMerge.obligationIds,determination:'NO_SEMANTIC_LOSS',challengeAcceptedChangeId:challengeInput.acceptedChangeId}];
  const reconciledPrepared=ingestion.prepare(p,{stage:4,text:JSON.stringify(reconciledMerge.e),promptRecord:reconcilePrompt});if(!reconciledPrepared.validation.valid)throw new Error(`Separately reserved Stage 04 atomicity reconciliation was rejected: ${JSON.stringify(reconciledPrepared.validation.issues)}`);
  const reconciledCommitted=ingestion.commit(reconciledPrepared.project,reconciledPrepared.proposal.proposalId,{operator:'VERIFY',reviewNote:'Accepted independently challenged atomicity reconciliation.'});if(reconciledCommitted.acceptedChange?.operation!=='RECONCILE_REQUIREMENTS')throw new Error('Stage 04 atomicity reconciliation did not commit through RECONCILE_REQUIREMENTS.');
}

// Mobile/chat smart punctuation is normalized while the exact raw response remains preserved for audit.
{
  const p=project('JOB-SMART-QUOTE-JSON'),stage=2,fixture=reservedSourceSearchFixture(p,'SMART-QUOTE-JSON'),promptRecord=fixture.promptRecord,envelope=fixture.envelope;
  envelope.evidence[0].description='He said "keep the exact words" while preserving the structured search-execution content.';
  const canonical=JSON.stringify(envelope);
  let smart='',inString=false;
  for(let i=0;i<canonical.length;i++){
    const c=canonical[i];
    if(!inString&&c==='"'){smart+='“';inString=true;continue;}
    if(inString){
      if(c==='\\'&&canonical[i+1]==='"'){smart+='"';i++;continue;}
      if(c==='"'){smart+='”';inString=false;continue;}
    }
    smart+=c;
  }
  const prepared=ingestion.prepare(p,{stage,text:smart,promptRecord});
  if(!prepared.validation.valid)throw new Error(`Smart-quoted mobile JSON was not normalized: ${JSON.stringify(prepared.validation.issues)}`);
  if(!prepared.validation.issues.some(issue=>issue.code==='JSON_TYPOGRAPHY_NORMALIZED'&&issue.severity==='WARNING'))throw new Error(`Smart-quote normalization warning was not preserved: ${JSON.stringify(prepared.validation.issues)}`);
  if(prepared.rawRecord.completeRawResponse!==smart)throw new Error('Exact smart-quoted raw response was not preserved unchanged.');
  if(prepared.project.projectData.acceptedChanges.length)throw new Error('Smart-quoted response changed canonical state before operator acceptance.');
}
negative('empty response',()=>'', 'EMPTY_RESPONSE');
negative('malformed JSON',()=>'{"schema":}','MALFORMED_JSON');
negative('truncated JSON',()=>'{"schema":"closed-loop-stage-response/2"','TRUNCATED_RESPONSE');
negative('markdown wrapped',(e)=>'```json\n'+JSON.stringify(e)+'\n```','NON_JSON_WRAPPER');
negative('duplicate JSON member',(e)=>JSON.stringify(e).replace('"stage":2','"stage":2,"stage":3'),'DUPLICATE_JSON_MEMBER');
negative('wrong root type',()=> '[]','INVALID_ROOT');
negative('unknown top-level property',(e)=>{e.unexpected='forbidden';},'UNKNOWN_PROPERTY');
negative('oversized response',()=> 'x'.repeat(schema.DEFAULT_RESOURCE_LIMITS.maxRawResponseBytes+1),'OVERSIZED_RESPONSE');
negative('excessive nesting',()=> '['.repeat(schema.DEFAULT_RESOURCE_LIMITS.maxJsonDepth+1)+'0'+']'.repeat(schema.DEFAULT_RESOURCE_LIMITS.maxJsonDepth+1),'EXCESSIVE_JSON_DEPTH');
negative('wrong schema',(e)=>{e.schema='closed-loop-stage-response/999';},'WRONG_SCHEMA');
negative('wrong job',(e)=>{e.jobId='JOB-OTHER';},'WRONG_JOB_ID');
negative('wrong stage',(e)=>{e.stage=3;},'WRONG_STAGE');
negative('wrong operation',(e)=>{e.operation='NOT_THE_OPERATION';},'WRONG_OPERATION');
negative('stale prompt id',(e)=>{e.promptIdentity.instructionId='INSTRUCTION-STALE';},'STALE_PROMPT_IDENTITY');
negative('stale prompt hash',(e)=>{e.promptIdentity.bodySha256='0'.repeat(64);},'STALE_PROMPT_HASH');
negative('stale contract hash',(e)=>{e.promptIdentity.contractSha256='0'.repeat(64);},'STALE_CONTRACT_HASH');
negative('stale context signature',(e)=>{e.promptIdentity.contextSignature='0'.repeat(64);},'STALE_CONTEXT_SIGNATURE');
for(const [name,stage,key] of [['project revision',2,'projectRevision'],['input version',2,'inputVersion'],['source set version',3,'sourceSetVersion'],['requirements version',5,'requirementsVersion'],['test suite version',7,'testSuiteVersion'],['instruction version',9,'instructionVersion'],['iteration',10,'iterationId'],['candidate',10,'candidateId'],['run',11,'runId'],['context',11,'contextId'],['baseline',20,'baselineId'],['product',21,'productId']])scopeNegative(name,stage,key);
scopeNegative('non-required populated scope identity',2,'baselineId');
negative('blocked human input uses wrong recovery lane',(e)=>{e.responseType='BLOCKED';e.stageData={};e.records={};e.evidence=[];e.unresolved=[{temporaryKey:'human-needed',kind:'MISSING_HUMAN_INPUT',description:'Human decision required',whyBlocking:'Only the human can supply this authority.',affectedStageFields:[],affectedRecords:[],blocking:true}];},'WRONG_RECOVERY_CHANNEL');
negative('execution failed without an attempted failure',(e)=>{e.responseType='EXECUTION_FAILED';e.stageData={};e.records={};e.evidence=[];e.unresolved=[{temporaryKey:'capability-missing',kind:'MISSING_CAPABILITY',description:'Required capability is unavailable',whyBlocking:'The operation cannot begin without the capability.',affectedStageFields:[],affectedRecords:[],blocking:true}];},'MISSING_EXECUTION_FAILURE_DETAIL');
negative('cross-project response',(e)=>{e.jobId='JOB-CROSS-PROJECT';},'WRONG_JOB_ID');
negative('unknown collection',(e)=>{e.records.unknownCollection=[];},'UNKNOWN_COLLECTION');
negative('unknown stage field',(e)=>{e.stageData.UNKNOWN_STAGE_FIELD='x';},'UNKNOWN_STAGE_FIELD');
negative('agent application field',(e)=>{e.stageData.SOURCE_SET_VERSION='SOURCE-SET-v999';},'FIELD_OWNERSHIP_VIOLATION');
negative('agent human field',(e)=>{e.records.blockers=[{tempKey:'blocker-1',fields:{OWNER:'agent-overwrite'},relationships:{},evidenceRefs:['evidence-1']}];},'FIELD_OWNERSHIP_VIOLATION');
{
  const candidate=Object.entries(schema.STAGE_FIELDS).flatMap(([stage,defs])=>Object.entries(defs).map(([name,def])=>({stage:Number(stage),name,def}))).find(x=>x.def.producer===schema.PRODUCER.HUMAN_DECISION);
  if(!candidate)throw new Error('No HUMAN_DECISION stage field exists to verify ownership.');const p=project('JOB-NEG-HUMAN-DECISION'),pr=savePrompt(p,candidate.stage),e=validEnvelope(p,candidate.stage,pr)||{schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:candidate.stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{},evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'ownership',location:'fixture',content:'ownership'}],unresolved:[],warnings:[],attachments:[]};e.stageData[candidate.name]=valueForDefinition(candidate.def);const prepared=ingestion.prepare(p,{stage:candidate.stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='FIELD_OWNERSHIP_VIOLATION'))throw new Error('Agent mutation of HUMAN_DECISION field was accepted.');negativeCount++;
}
{const externalRepoIssues=schema.sourceClassificationIssues({TITLE:'Official vendor reference implementation',ISSUING_ORGANIZATION_OR_AUTHOR:'Example Vendor',SOURCE_TYPE:'OFFICIAL SOURCE CODE REPOSITORY',PUBLICATION_ORIGIN:'Vendor-maintained repository',URL_REFERENCE:'https://github.com/example-vendor/reference-implementation',AUTHORITY_LEVEL:'PRIMARY DIRECT EVIDENCE',AUTHORITY_ROLE:'SUPPORTING EVIDENCE',RELEVANCE:'Direct evidence of the vendor implementation',APPLICABLE_PORTIONS:'Published implementation behavior',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT SUPERSEDED',CONTROLLING_STATE:'NON-GOVERNING EVIDENCE'});if(externalRepoIssues.length)throw new Error(`Legitimate external source-code repository was rejected: ${externalRepoIssues.join(' | ')}`);}
{const currentPatentForms=schema.sourceClassificationIssues({TITLE:'Current application forms and filing instructions',ISSUING_ORGANIZATION_OR_AUTHOR:'Independent Patent Office',SOURCE_TYPE:'OFFICIAL ADMINISTRATIVE SOURCE',PUBLICATION_ORIGIN:'Independent official website',URL_REFERENCE:'https://example.gov/current-application-forms',AUTHORITY_LEVEL:'OFFICIAL',AUTHORITY_ROLE:'OPERATIONAL GUIDANCE',RELEVANCE:'Current application forms for an external filing process',APPLICABLE_PORTIONS:'Current application forms',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT SUPERSEDED',CONTROLLING_STATE:'GOVERNING WHERE APPLICABLE'});if(currentPatentForms.length)throw new Error(`Legitimate external source containing the phrase current application was rejected: ${currentPatentForms.join(' | ')}`);}
negative('target product source',(e)=>{e.stageData={};e.records={sources:[sourceProposal('source-target',{TITLE:'Current application repository',ISSUING_ORGANIZATION_OR_AUTHOR:'Project repository',SOURCE_TYPE:'repository source code',PUBLICATION_ORIGIN:'current application',URL_REFERENCE:'https://github.com/sjonesjones917/closed-loop-tracker',AUTHORITY_LEVEL:'PRIMARY',AUTHORITY_ROLE:'GOVERNING',RELEVANCE:'target product',APPLICABLE_PORTIONS:'app-core.js',CONTROLLING_STATE:'CONTROLLING'})]};},'INVALID_EXTERNAL_SOURCE');
negative('duplicate temp key',(e)=>{e.stageData={};e.records={sources:[sourceProposal('dup'),sourceProposal('dup',{TITLE:'Second source'})]};},'DUPLICATE_TEMPORARY_KEY');
negative('unknown record field',(e)=>{e.stageData={};e.records={sources:[sourceProposal('source-unknown',{UNKNOWN_FIELD:'forbidden'})]};},'UNKNOWN_RECORD_FIELD');
negative('wrong value type',(e)=>{e.stageData={};const r=sourceProposal('source-type');r.fields.TITLE=42;e.records={sources:[r]};},'WRONG_VALUE_TYPE');
negative('prohibited null',(e)=>{e.stageData={};const r=sourceProposal('source-null');r.fields.TITLE=null;e.records={sources:[r]};},'PROHIBITED_NULL');
negative('empty required string',(e)=>{e.stageData={};const r=sourceProposal('source-empty');r.fields.TITLE='';e.records={sources:[r]};},'EMPTY_REQUIRED_STRING');
negative('placeholder value',(e)=>{e.stageData={};const r=sourceProposal('source-placeholder');r.fields.TITLE='<value>';e.records={sources:[r]};},'PLACEHOLDER_VALUE');
{const issues=[];ingestion.validateValue({valueType:'STRING',enumValues:['ALLOWED'],nullable:false},'__INVALID_ENUM__','/invalid-enum',issues,{required:true});if(!issues.some(i=>i.code==='INVALID_ENUM_VALUE'))throw new Error('invalid enum: expected INVALID_ENUM_VALUE.');negativeCount++;}
negative('missing evidence',(e)=>{e.evidence=[];},'MISSING_PROVENANCE');
negative('unresolved evidence reference',(e)=>{e.stageData={};const r=sourceProposal('source-evidence');r.evidenceRefs=['does-not-exist'];e.records={sources:[r]};},'UNRESOLVED_EVIDENCE_REFERENCE');
negative('unresolved evidence source',(e)=>{e.evidence[0].sourceRef={recordId:'SOURCE-NOT-THERE'};},'UNRESOLVED_EVIDENCE_SOURCE');
negative('unresolved evidence attachment',(e)=>{e.evidence[0].attachmentRef={recordId:'ARTIFACT-NOT-THERE'};},'UNRESOLVED_EVIDENCE_ATTACHMENT');
negative('invalid record identity',(e)=>{e.stageData={};const r=sourceProposal('source-both');r.targetId='SOURCE-ALSO';e.records={sources:[r]};},'INVALID_RECORD_IDENTITY');
negativeAt('unresolved relationship',3,(e)=>{e.stageData={};e.records={research:[{tempKey:'research-1',fields:{PASS_NUMBER:1,EXACT_PORTION_EXAMINED:'Controlled source portion',FINDING_CLASSIFICATION:'FACT',SOURCE_EVIDENCE:'Controlled evidence'},relationships:{SOURCE_ID:{recordId:'SOURCE-DOES-NOT-EXIST'}},evidenceRefs:['evidence-1']}]};},'UNRESOLVED_RELATIONSHIP');
negativeAt('wrong relationship type',14,(e)=>{e.stageData={};e.records={rootCauses:[{tempKey:'wrong-type',fields:{CATEGORY:'INSTRUCTION',LAYER_TRACE:'trace',EARLIEST_DEFECTIVE_LAYER:'INSTRUCTION',ROOT_CAUSE:'cause',EVIDENCE:'evidence',DOWNSTREAM_INVALIDATION:'downstream'},relationships:{DEFECT_ID:{tempKey:'wrong-type'}},evidenceRefs:['evidence-1']}]};},'WRONG_RELATIONSHIP_TYPE');
negativeAt('wrong relationship cardinality',3,(e)=>{e.stageData={};e.records={research:[{tempKey:'research-cardinality',fields:{PASS_NUMBER:1,EXACT_PORTION_EXAMINED:'Controlled source portion',FINDING_CLASSIFICATION:'FACT',SOURCE_EVIDENCE:'Controlled evidence'},relationships:{SOURCE_ID:[{recordId:'SOURCE-A'},{recordId:'SOURCE-B'}]},evidenceRefs:['evidence-1']}]};},'INVALID_RELATIONSHIP_REFERENCE');
negative('mixed human input response',(e)=>{e.responseType='HUMAN_INPUT_REQUIRED';e.humanInputRequests=[{temporaryKey:'q',question:'Need input?',whyRequired:'Human authority required.',affectedStageFields:[],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}];},'MIXED_RESPONSE_TYPE');
negative('mixed blocked response',(e)=>{e.responseType='BLOCKED';e.unresolved=[{temporaryKey:'u',kind:'MISSING_AUTHORITY',description:'Missing authority',whyBlocking:'Cannot proceed',affectedStageFields:[],affectedRecords:[],blocking:true}];},'MIXED_RESPONSE_TYPE');
negative('mixed execution failed response',(e)=>{e.responseType='EXECUTION_FAILED';e.unresolved=[{temporaryKey:'u',kind:'EXECUTION_FAILURE',description:'Execution failed',whyBlocking:'Cannot proceed',affectedStageFields:[],affectedRecords:[],blocking:true}];},'MIXED_RESPONSE_TYPE');
negative('empty data proposal',(e)=>{e.stageData={};e.records={};e.evidence=[];},'EMPTY_DATA_PROPOSAL');
negative('evidence resource limit',(e)=>{const max=schema.STAGE_CONTRACTS[2].resourceLimits.maxEvidenceRecords;e.evidence=Array.from({length:max+1},(_,i)=>({temporaryKey:`e-${i}`,kind:'WORKFLOW_EVIDENCE',description:'e',location:'fixture',content:'e'}));},'RESOURCE_LIMIT_EXCEEDED');

// Attachment declarations are claims; only application-hashed supplied bytes may satisfy them.
{
  const exactFile={artifactId:'ARTIFACT-ATTACHMENT-1',name:'result.pdf',type:'application/pdf',size:48203,sha256:'a'.repeat(64)};
  const make=(job='JOB-ATTACHMENT')=>{const p=project(job),stage=2,fixture=reservedSourceSearchFixture(p,job),pr=fixture.promptRecord,e=fixture.envelope;e.attachments=[{temporaryKey:'attachment-1',filename:'result.pdf',mediaType:'application/pdf',byteSize:48203,sha256:'a'.repeat(64),required:true}];e.evidence[0].attachmentRef={tempKey:'attachment-1'};return {p,stage,pr,e};};
  {const {p,stage,pr,e}=make('JOB-ATTACHMENT-VALID'),prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr,files:[exactFile]});if(!prepared.validation.valid)throw new Error(`Valid verified attachment rejected: ${JSON.stringify(prepared.validation.issues)}`);if(prepared.proposal.tempToCanonical['attachment-1']?.id!==exactFile.artifactId||prepared.proposal.evidence[0].ATTACHMENT_ID!==exactFile.artifactId)throw new Error('Verified attachment temporary key did not resolve to the canonical artifact ID.');}
  for(const [name,files,mutate,code] of [
    ['missing required attachment',[],()=>{},'MISSING_REQUIRED_ATTACHMENT'],
    ['wrong attachment filename',[exactFile],e=>{e.attachments[0].filename='other.pdf';},'ATTACHMENT_FILENAME_MISMATCH'],
    ['wrong attachment byte size',[exactFile],e=>{e.attachments[0].byteSize=48204;},'ATTACHMENT_BYTE_SIZE_MISMATCH'],
    ['wrong attachment hash',[exactFile],e=>{e.attachments[0].sha256='b'.repeat(64);},'ATTACHMENT_SHA256_MISMATCH']
  ]){const {p,stage,pr,e}=make(`JOB-${name.replace(/[^A-Z0-9]/gi,'').toUpperCase()}`);mutate(e);const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr,files});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code===code))throw new Error(`${name}: expected ${code}; got ${prepared.validation.issues.map(i=>i.code).join(', ')}.`);if(prepared.project.projectData.acceptedChanges.length)throw new Error(`${name}: canonical state changed.`);negativeCount++;}
}

// Duplicate response is semantic, not whitespace-sensitive.
{
  let p=project('JOB-NEG-DUPLICATE'),stage=2,fixture=reservedSourceSearchFixture(p,'DUPLICATE'),promptRecord=fixture.promptRecord,envelope=fixture.envelope,text=JSON.stringify(envelope);
  const first=ingestion.prepare(p,{stage,text,promptRecord});
  if(!first.validation.valid)throw new Error('Duplicate fixture first response unexpectedly invalid.');
  const reordered={...envelope,warnings:[...envelope.warnings]};const second=ingestion.prepare(first.project,{stage,text:JSON.stringify(reordered,null,2),promptRecord});
  if(!second.duplicate||second.rawRecord.rawResponseId!==first.rawRecord.rawResponseId||second.receipt.receiptId!==first.receipt.receiptId)throw new Error('Semantic duplicate with different whitespace did not return the existing response and receipt.');
  negativeCount++;
}

// HUMAN_INPUT_REQUIRED must contain actual blocking human-authority work.
{
 const p=project('JOB-NONBLOCKING-HUMAN-INPUT'),stage=1,promptRecord=savePrompt(p,stage);
 const envelope={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'question-optional',question:'Optional preference?',whyRequired:'This preference is not required to continue.',affectedStageFields:[],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:false}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
 const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(envelope),promptRecord});
 if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='MISSING_BLOCKING_HUMAN_INPUT_REQUEST'))throw new Error('All-nonblocking HUMAN_INPUT_REQUIRED was accepted.');
 if(prepared.project.projectData.acceptedChanges.length)throw new Error('Invalid clarification mutated canonical state.');
 negativeCount++;
}

// Clarification loop: structured question -> accepted question record -> human answer -> INPUT version increments.
{
  let p=project('JOB-CLARIFICATION'),stage=1,promptRecord=savePrompt(p,stage);
  const envelope={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'question-1',question:'Which jurisdiction controls the requested release?',whyRequired:'The operator must establish jurisdictional scope.',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(envelope),promptRecord});
  if(!prepared.validation.valid)throw new Error(`Clarification envelope rejected: ${JSON.stringify(prepared.validation.issues)}`);
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFICATION_OPERATOR'});p=committed.project;
  const request=p.projectData.humanInputRequests.at(-1);if(!request||request.status!=='OPEN')throw new Error('Human clarification request was not created.');
  const before=p.job.CURRENT_INPUT_VERSION;
  const answered=ingestion.answerHumanInput(p,{[request.requestId]:'United States'},{operator:'VERIFICATION_OPERATOR'});p=answered.project;
  if(p.job.CURRENT_INPUT_VERSION===before)throw new Error('Clarification answer did not create a new User Job Input version.');
  if(engine.unresolvedHumanRequests(p,stage).length)throw new Error('Answered clarification remained open.');
}

// Exact primitive value-validator failures, including values JSON cannot represent faithfully.
for(const [name,definition,value,code] of [
  ['non-finite number',{valueType:'NUMBER',enumValues:[],nullable:false},Infinity,'WRONG_VALUE_TYPE'],
  ['integer required',{valueType:'INTEGER',enumValues:[],nullable:false},1.5,'WRONG_VALUE_TYPE'],
  ['boolean required',{valueType:'BOOLEAN',enumValues:[],nullable:false},'true','WRONG_VALUE_TYPE'],
  ['array required',{valueType:'STRING_ARRAY',enumValues:[],nullable:false},'x','WRONG_VALUE_TYPE'],
  ['empty required array',{valueType:'STRING_ARRAY',enumValues:[],nullable:false},[],'EMPTY_REQUIRED_ARRAY']
]){const issues=[];ingestion.validateValue(definition,value,`/${name}`,issues,{required:true});if(!issues.some(i=>i.code===code))throw new Error(`${name}: expected ${code}.`);negativeCount++;}

// Public mutators honor the caller's compare-and-swap revision before any raw
// or canonical state can be created.
{
  const p=project('JOB-STALE-COMMAND-REVISION'),stage=2,fixture=reservedSourceSearchFixture(p,'STALE-COMMAND-REVISION'),pr=fixture.promptRecord,text=JSON.stringify(fixture.envelope),counts={raw:p.projectData.rawResponses.length,outputs:p.projectData.generatedOutputs.length,commands:p.projectData.commandReceipts.length};let stale=false;
  try{ingestion.captureRaw(p,{stage,text,promptRecord:pr,commandExpectedRevision:Number(p.revision||0)+1,idempotencyKey:'STALE-COMMAND-REVISION'});}catch(error){stale=error?.code==='STALE_COMMAND_REVISION';}
  if(!stale)throw new Error('Public captureRaw accepted a stale commandExpectedRevision.');if(p.projectData.rawResponses.length!==counts.raw||p.projectData.generatedOutputs.length!==counts.outputs||p.projectData.commandReceipts.length!==counts.commands)throw new Error('Stale command revision changed raw, output, or command-receipt state.');negativeCount++;
}

console.log(JSON.stringify({stagesExercised:allStages.length,responseSchema:schema.RESPONSE_SCHEMA,negativeCases:negativeCount,clarificationLoop:true,atomicPrecommit:true,extractionManifest:true,canonicalIdsApplicationAssigned:true,scopeIdentityMatrix:true,verifiedAttachmentBinding:true},null,2));

// PR3 transaction/disposition invariants.
{let p=project('JOB-PR3-IDEMP'),stage=2,fixture=reservedSourceSearchFixture(p,'PR3-IDEMP'),pr=fixture.promptRecord,e=fixture.envelope;const first=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});const accepted=ingestion.commit(first.project,first.proposal.proposalId,{operator:'VERIFY'});const again=ingestion.commit(accepted.project,first.proposal.proposalId,{operator:'VERIFY'});if(!again.idempotent||again.project.projectData.acceptedChanges.length!==accepted.project.projectData.acceptedChanges.length)throw new Error('Repeat acceptance was not idempotent.');const repeated=ingestion.prepare(accepted.project,{stage,text:JSON.stringify(e),promptRecord:pr});if(!repeated.idempotent||repeated.receipt?.receiptId!==first.receipt?.receiptId)throw new Error('Repeated public prepare command did not return its existing receipt/disposition.');const manifest=accepted.manifest;if(!manifest.entries.some(x=>/^\/records\/[^/]+\/0\/fields\//.test(x.jsonPointer||''))&&!manifest.entries.some(x=>/^\/stageData\//.test(x.jsonPointer||'')))throw new Error('Extraction manifest does not contain exact response JSON pointers.');}
{let p=project('JOB-PR3-QUESTION'),stage=1,pr=savePrompt(p,stage);const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'q1',question:'Need number?',whyRequired:'Human-only value.',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],answerType:'NUMBER',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});const control=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'});p=control.project;if(p.projectData.acceptedChanges.length)throw new Error('Question set counted as accepted DATA change.');const q=p.projectData.humanInputRequests.at(-1);let bad=false;try{ingestion.answerHumanInput(p,{[q.requestId]:'3'},{operator:'VERIFY'});}catch{bad=true;}if(!bad)throw new Error('NUMBER answer accepted a string.');const oldPrompt=pr.instructionId;const answered=ingestion.answerHumanInput(p,{[q.requestId]:3},{operator:'VERIFY'});p=answered.project;if(p.projectData.generatedPrompts.find(x=>(x.instructionId||x.promptId)===oldPrompt)?.invalidatedBy==null)throw new Error('Clarification did not invalidate prior prompt.');if(!answered.generatedPromptIds[0]||answered.generatedPromptIds[0]===oldPrompt)throw new Error('Clarification did not regenerate the stage prompt.');}
{let p=project('JOB-PR3-REJECT'),stage=2,fixture=reservedSourceSearchFixture(p,'PR3-REJECT'),pr=fixture.promptRecord,e=fixture.envelope,prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});p=ingestion.reject(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY',reason:'Controlled rejection.'}).project;let blocked=false;try{ingestion.commit(p,prepared.proposal.proposalId,{operator:'VERIFY'});}catch(error){blocked=error.code==='PROPOSAL_NOT_ACCEPTABLE';}if(!blocked)throw new Error('Acceptance after rejection was not prohibited.');negativeCount++;}
{let p=project('JOB-PR3-STALE-REVISION'),stage=2,fixture=reservedSourceSearchFixture(p,'PR3-STALE-REVISION'),pr=fixture.promptRecord,e=fixture.envelope,prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});p=prepared.project;p.revision=Number(p.revision||0)+1;let stale=false;try{ingestion.commit(p,prepared.proposal.proposalId,{operator:'VERIFY'});}catch(error){stale=error.code==='STALE_PROPOSAL';}if(!stale)throw new Error('Proposal stale after project revision change was accepted.');negativeCount++;}
{
  let p=project('JOB-PR3-REFERENCED-HASH-REFRESH'),stage=3,sourceId='SOURCE-REFERENCED-HASH-REFRESH';
  const sourceFields={SOURCE_ID:sourceId,...sourceProposal('unused').fields},source={id:sourceId,stage:2,active:true,validity:'CURRENT',scope:engine.currentScope(p),fields:sourceFields,relationships:{},evidenceRefs:[],...sourceFields};
  engine.refreshRecordHashes(source,'sources');p.projectData.sources.push(source);
  const pr=savePrompt(p,stage),e=proposalEnvelope(p,stage,pr,{research:[{tempKey:'research-referenced-hash',fields:completeFields('research'),relationships:{SOURCE_ID:{recordId:sourceId}},evidenceRefs:['policy-evidence']}]});
  source.fields.AUTHENTICITY_STATUS='VERIFIED';source.AUTHENTICITY_STATUS='VERIFIED';source.fields.AUTHENTICITY_BASIS='APPLICATION_OBSERVED';source.AUTHENTICITY_BASIS='APPLICATION_OBSERVED';engine.refreshRecordHashes(source,'sources');
  const hashBeforePrepare=source.recordSha256,prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});
  if(!prepared.validation.valid)throw new Error('Referenced-record hash refresh fixture was rejected: '+JSON.stringify(prepared.validation.issues));
  const normalizedSource=prepared.project.projectData.sources.find(item=>engine.recordId(item,'sources')===sourceId),boundHash=prepared.proposal.preconditions.referencedRecordHashes[`sources:${sourceId}`];
  if(!normalizedSource||normalizedSource.recordSha256===hashBeforePrepare)throw new Error('Prepare-time recalculation did not exercise a referenced source hash change.');
  if(boundHash!==normalizedSource.recordSha256)throw new Error('Proposal preconditions retained the pre-recalculation referenced-record hash.');
  const staleProject=JSON.parse(JSON.stringify(prepared.project)),changedSource=staleProject.projectData.sources.find(item=>engine.recordId(item,'sources')===sourceId);changedSource.fields.NOTES='Changed after proposal preparation.';changedSource.NOTES=changedSource.fields.NOTES;engine.refreshRecordHashes(changedSource,'sources');let stale=false;try{ingestion.commit(staleProject,prepared.proposal.proposalId,{operator:'VERIFY'});}catch(error){stale=error.code==='STALE_PROPOSAL';}if(!stale)throw new Error('A real post-preparation referenced-record change did not stale the proposal.');negativeCount++;
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'});if(!committed.acceptedChange)throw new Error('A proposal bound to the post-recalculation referenced-record hash could not be committed.');
}
{let p=project('JOB-PR3-STALE-PROMPT-ENGINE'),stage=2,fixture=reservedSourceSearchFixture(p,'PR3-STALE-PROMPT-ENGINE'),pr=fixture.promptRecord,e=fixture.envelope;pr.promptEngineVersion='closed-loop-prompt-engine/obsolete';const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='STALE_PROMPT_ENGINE_VERSION'))throw new Error('Response to an obsolete prompt-engine instruction was accepted.');if(prepared.project.projectData.acceptedChanges.length)throw new Error('Obsolete prompt-engine response mutated canonical state.');negativeCount++;}
{let p=project('JOB-PR3-STALE-PROPOSAL-ENGINE'),stage=2,fixture=reservedSourceSearchFixture(p,'PR3-STALE-PROPOSAL-ENGINE'),pr=fixture.promptRecord,e=fixture.envelope,prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});const proposal=prepared.project.projectData.responseProposals.find(x=>x.proposalId===prepared.proposal.proposalId);proposal.preconditions.promptEngineVersion='closed-loop-prompt-engine/obsolete';let stale=false;try{ingestion.commit(prepared.project,proposal.proposalId,{operator:'VERIFY'});}catch(error){stale=error.code==='STALE_PROPOSAL';}if(!stale)throw new Error('Proposal created under an obsolete prompt engine was accepted.');if(prepared.project.projectData.acceptedChanges.length)throw new Error('Obsolete prompt-engine proposal mutated canonical state.');negativeCount++;}
console.log(JSON.stringify({pr3Dispositions:true,preconditions:true,promptEnginePreconditions:true,idempotentAcceptance:true,canonicalEnvelopeIdempotency:true,typedHumanAnswers:true,clarificationPromptInvalidation:true,exactManifestPointers:true,acceptanceAfterRejectionBlocked:true,staleProjectRevisionBlocked:true,totalNegativeCases:negativeCount},null,2));

// Every public ingestion mutation is command-idempotent. An exact mobile
// double-tap returns the original identities without duplicating raw or
// canonical state; reuse of the same key for changed content fails closed.
{
  const expectConflict=fn=>{let rejected=false;try{fn();}catch(error){rejected=/(?:Command or idempotency identity|Idempotency key) was reused with different command content/.test(String(error?.message||error));}if(!rejected)throw new Error('Changed command content reused an idempotency key without rejection.');};
  let p=project('JOB-COMMAND-IDEMP-CAPTURE'),stage=3,pr=savePrompt(p,stage),text=JSON.stringify(validEnvelope(p,stage,pr));
  const captured=ingestion.captureRaw(p,{stage,text,promptRecord:pr,idempotencyKey:'INGEST-CAPTURE-EXACT'}),captureCounts={raw:captured.project.projectData.rawResponses.length,outputs:captured.project.projectData.generatedOutputs.length,receipts:captured.project.projectData.commandReceipts.length};
  const captureReplay=ingestion.captureRaw(captured.project,{stage,text,promptRecord:pr,idempotencyKey:'INGEST-CAPTURE-EXACT'});
  if(!captureReplay.idempotent||captureReplay.rawRecord.rawResponseId!==captured.rawRecord.rawResponseId||captureReplay.project.projectData.rawResponses.length!==captureCounts.raw||captureReplay.project.projectData.generatedOutputs.length!==captureCounts.outputs||captureReplay.project.projectData.commandReceipts.length!==captureCounts.receipts)throw new Error('captureRaw exact retry duplicated state or changed its result identity.');
  expectConflict(()=>ingestion.captureRaw(captureReplay.project,{stage,text:'{"changed":true}',promptRecord:pr,idempotencyKey:'INGEST-CAPTURE-EXACT'}));

  p=project('JOB-COMMAND-IDEMP-PREPARE');pr=savePrompt(p,stage);text=JSON.stringify(validEnvelope(p,stage,pr));
  const prepared=ingestion.prepare(p,{stage,text,promptRecord:pr,idempotencyKey:'INGEST-PREPARE-EXACT'}),prepareCounts={raw:prepared.project.projectData.rawResponses.length,validations:prepared.project.projectData.responseValidations.length,proposals:prepared.project.projectData.responseProposals.length,receipts:prepared.project.projectData.outputReceipts.length,commands:prepared.project.projectData.commandReceipts.length};
  const prepareReplay=ingestion.prepare(prepared.project,{stage,text,promptRecord:pr,idempotencyKey:'INGEST-PREPARE-EXACT'});
  if(!prepareReplay.idempotent||prepareReplay.proposal?.proposalId!==prepared.proposal?.proposalId||prepareReplay.rawRecord?.rawResponseId!==prepared.rawRecord?.rawResponseId||prepareReplay.project.projectData.rawResponses.length!==prepareCounts.raw||prepareReplay.project.projectData.responseValidations.length!==prepareCounts.validations||prepareReplay.project.projectData.responseProposals.length!==prepareCounts.proposals||prepareReplay.project.projectData.outputReceipts.length!==prepareCounts.receipts||prepareReplay.project.projectData.commandReceipts.length!==prepareCounts.commands)throw new Error('prepare exact retry duplicated raw, validation, proposal, receipt, or command state.');
  expectConflict(()=>ingestion.prepare(prepareReplay.project,{stage,text:'{"changed":true}',promptRecord:pr,idempotencyKey:'INGEST-PREPARE-EXACT'}));

  const accepted=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY',reviewNote:'Exact acceptance.',idempotencyKey:'INGEST-COMMIT-EXACT'}),acceptCounts={changes:accepted.project.projectData.acceptedChanges.length,records:accepted.project.projectData.sources.length,manifests:accepted.project.projectData.extractionManifests.length,commands:accepted.project.projectData.commandReceipts.length};
  const acceptReplay=ingestion.commit(accepted.project,prepared.proposal.proposalId,{operator:'VERIFY',reviewNote:'Exact acceptance.',idempotencyKey:'INGEST-COMMIT-EXACT'});
  if(!acceptReplay.idempotent||acceptReplay.acceptedChange?.changeId!==accepted.acceptedChange?.changeId||acceptReplay.project.projectData.acceptedChanges.length!==acceptCounts.changes||acceptReplay.project.projectData.sources.length!==acceptCounts.records||acceptReplay.project.projectData.extractionManifests.length!==acceptCounts.manifests||acceptReplay.project.projectData.commandReceipts.length!==acceptCounts.commands)throw new Error('commit exact retry duplicated canonical state.');
  expectConflict(()=>ingestion.commit(acceptReplay.project,prepared.proposal.proposalId,{operator:'VERIFY',reviewNote:'Changed acceptance.',idempotencyKey:'INGEST-COMMIT-EXACT'}));

  p=project('JOB-COMMAND-IDEMP-REJECT');pr=savePrompt(p,stage);text=JSON.stringify(validEnvelope(p,stage,pr));const rejectPrepared=ingestion.prepare(p,{stage,text,promptRecord:pr});
  const rejected=ingestion.reject(rejectPrepared.project,rejectPrepared.proposal.proposalId,{operator:'VERIFY',reason:'Exact rejection.',idempotencyKey:'INGEST-REJECT-EXACT'}),rejectCounts={rejected:0,dispositions:0,commands:0};
  rejectCounts.rejected=rejected.project.projectData.rejectedResponses.length;rejectCounts.dispositions=rejected.project.projectData.responseDispositions.length;rejectCounts.commands=rejected.project.projectData.commandReceipts.length;
  const rejectReplay=ingestion.reject(rejected.project,rejectPrepared.proposal.proposalId,{operator:'VERIFY',reason:'Exact rejection.',idempotencyKey:'INGEST-REJECT-EXACT'});
  if(!rejectReplay.idempotent||rejectReplay.rejected?.rejectedResponseId!==rejected.rejected?.rejectedResponseId||rejectReplay.project.projectData.rejectedResponses.length!==rejectCounts.rejected||rejectReplay.project.projectData.responseDispositions.length!==rejectCounts.dispositions||rejectReplay.project.projectData.commandReceipts.length!==rejectCounts.commands)throw new Error('reject exact retry duplicated rejection state.');
  expectConflict(()=>ingestion.reject(rejectReplay.project,rejectPrepared.proposal.proposalId,{operator:'VERIFY',reason:'Changed rejection.',idempotencyKey:'INGEST-REJECT-EXACT'}));

  p=project('JOB-COMMAND-IDEMP-ABANDON');pr=savePrompt(p,stage);text=JSON.stringify(validEnvelope(p,stage,pr));const abandonPrepared=ingestion.prepare(p,{stage,text,promptRecord:pr});preparePromptPrerequisites(abandonPrepared.project,stage);
  const abandoned=ingestion.abandon(abandonPrepared.project,abandonPrepared.proposal.proposalId,{operator:'VERIFY',reason:'Exact abandonment.',idempotencyKey:'INGEST-ABANDON-EXACT'}),abandonCounts={dispositions:0,prompts:0,commands:0};
  abandonCounts.dispositions=abandoned.project.projectData.responseDispositions.length;abandonCounts.prompts=abandoned.project.projectData.generatedPrompts.length;abandonCounts.commands=abandoned.project.projectData.commandReceipts.length;
  const abandonReplay=ingestion.abandon(abandoned.project,abandonPrepared.proposal.proposalId,{operator:'VERIFY',reason:'Exact abandonment.',idempotencyKey:'INGEST-ABANDON-EXACT'});
  if(!abandonReplay.idempotent||abandonReplay.disposition?.dispositionId!==abandoned.disposition?.dispositionId||abandonReplay.project.projectData.responseDispositions.length!==abandonCounts.dispositions||abandonReplay.project.projectData.generatedPrompts.length!==abandonCounts.prompts||abandonReplay.project.projectData.commandReceipts.length!==abandonCounts.commands)throw new Error('abandon exact retry duplicated disposition or replacement-prompt state.');
  expectConflict(()=>ingestion.abandon(abandonReplay.project,abandonPrepared.proposal.proposalId,{operator:'VERIFY',reason:'Changed abandonment.',idempotencyKey:'INGEST-ABANDON-EXACT'}));

  p=project('JOB-COMMAND-IDEMP-ANSWER');pr=savePrompt(p,1);const question={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:1,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'idempotent-question',question:'Provide the exact human-owned answer.',whyRequired:'Only the human can supply this value.',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
  const questionPrepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(question),promptRecord:pr}),questionCommitted=ingestion.commit(questionPrepared.project,questionPrepared.proposal.proposalId,{operator:'VERIFY'}),request=questionCommitted.project.projectData.humanInputRequests.at(-1),answers={[request.requestId]:'Exact human answer'};
  const answered=ingestion.answerHumanInput(questionCommitted.project,answers,{operator:'VERIFY',idempotencyKey:'INGEST-ANSWER-EXACT'}),answerCounts={answers:answered.project.projectData.humanInputAnswers.length,versions:answered.project.projectData.inputVersions.length,prompts:answered.project.projectData.generatedPrompts.length,commands:answered.project.projectData.commandReceipts.length};
  const answerReplay=ingestion.answerHumanInput(answered.project,answers,{operator:'VERIFY',idempotencyKey:'INGEST-ANSWER-EXACT'});
  if(!answerReplay.idempotent||answerReplay.answeredCount!==answered.answeredCount||answerReplay.project.projectData.humanInputAnswers.length!==answerCounts.answers||answerReplay.project.projectData.inputVersions.length!==answerCounts.versions||answerReplay.project.projectData.generatedPrompts.length!==answerCounts.prompts||answerReplay.project.projectData.commandReceipts.length!==answerCounts.commands)throw new Error('answerHumanInput exact retry duplicated answers, input versions, or replacement prompts.');
  expectConflict(()=>ingestion.answerHumanInput(answerReplay.project,{[request.requestId]:'Changed human answer'},{operator:'VERIFY',idempotencyKey:'INGEST-ANSWER-EXACT'}));
  console.log(JSON.stringify({publicMutationIdempotency:['captureRaw','prepare','commit','reject','abandon','answerHumanInput'],changedPayloadReuseRejected:true},null,2));
}
// Rejected output refinement becomes explicit controlling prompt context.
{let p=project('JOB-REFINEMENT-LOOP'),stage=3,pr=savePrompt(p,stage),e=validEnvelope(p,stage,pr),prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});preparePromptPrerequisites(prepared.project,stage);const result=ingestion.reject(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY',reason:'Add the missing controlling-source rationale and make the result more complete.',requestCorrection:true});p=result.project;const old=p.projectData.generatedPrompts.find(x=>(x.instructionId||x.promptId)===pr.instructionId),replacement=p.projectData.generatedPrompts.filter(x=>Number(x.stage)===stage&&!x.invalidatedBy).at(-1);if(!old?.invalidatedBy||!replacement||replacement.instructionId===pr.instructionId||!replacement.prompt.includes('Add the missing controlling-source rationale and make the result more complete.'))throw new Error('Correction request was not bound into a replacement prompt.');}
// EXECUTION_FAILED is fail-closed and a successful exact-scope replacement resolves it.
{let p=project('JOB-EXECUTION-FAIL-CLOSED'),stage=1,pr=savePrompt(p,stage);const fail={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'EXECUTION_FAILED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'failure-1',kind:'TOOL_FAILURE',description:'Required tool failed.',whyBlocking:'The operation could not be executed.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};let prepared=ingestion.prepare(p,{stage,text:JSON.stringify(fail),promptRecord:pr});p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;if(p.stages[stage].status!=='BLOCKED'||!engine.gate(stage,p).reasons.some(x=>x.includes('execution failure')))throw new Error('Accepted execution failure did not fail closed.');const replacement=validEnvelope(p,stage,pr);prepared=ingestion.prepare(p,{stage,text:JSON.stringify(replacement),promptRecord:pr});p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;if(p.projectData.executionFailures.some(x=>Number(x.stage)===stage&&!x.resolvedBy&&!x.invalidatedBy))throw new Error('Successful replacement did not resolve execution failure.');}

{let p=project('JOB-PARALLEL-PROMPT-VALIDATION'),stage=17;p.revision=0;const a={...fixtureBuildPrompt(stage,{...p,revision:1},{operation:'EXECUTE_RUN',scope:{runId:'RUN-A',contextId:'CTX-A'}}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(a);const b={...fixtureBuildPrompt(stage,{...p,revision:1},{operation:'EXECUTE_RUN',scope:{runId:'RUN-B',contextId:'CTX-B'}}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(b);const q={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:a.operation,promptIdentity:{instructionId:a.instructionId,bodySha256:a.bodySha256,contractSha256:a.contractSha256,contextSignature:a.contextSignature},scope:a.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'parallel-q',question:'Provide the missing run-specific value.',whyRequired:'The selected run cannot continue without it.',affectedStageFields:[],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(q),promptRecord:a});if(!prepared.validation.valid)throw new Error('Unrelated newer run prompt incorrectly staled the controlling run prompt: '+JSON.stringify(prepared.validation.issues));}
{let p=project('JOB-SCOPED-CLARIFICATION'),stage=17;p.revision=0;const pr={...fixtureBuildPrompt(stage,{...p,revision:1},{operation:'EXECUTE_RUN',scope:{runId:'RUN-CLARIFY',contextId:'CTX-CLARIFY'}}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);const q={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'scoped-q',question:'Provide the run-specific missing input.',whyRequired:'This exact run is missing required human authority.',affectedStageFields:[],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};let prepared=ingestion.prepare(p,{stage,text:JSON.stringify(q),promptRecord:pr});if(!prepared.validation.valid)throw new Error('Scoped clarification response invalid: '+JSON.stringify(prepared.validation.issues));p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;const request=p.projectData.humanInputRequests.at(-1);preparePromptPrerequisites(p,stage);p=ingestion.answerHumanInput(p,{[request.requestId]:'Exact run-specific answer'},{operator:'VERIFY'}).project;const active=p.projectData.generatedPrompts.filter(x=>Number(x.stage)===stage&&!x.invalidatedBy);if(!active.some(x=>x.operation==='EXECUTE_RUN'&&x.scope?.runId==='RUN-CLARIFY'&&x.scope?.contextId==='CTX-CLARIFY'))throw new Error('Scoped clarification did not regenerate the exact operation/run prompt.');if(active.some(x=>x.operation==='FREEZE'))throw new Error('Scoped clarification incorrectly regenerated the stage default operation.');}


// Raw capture audit scope must be controlled by the persisted prompt, not a caller-supplied context hint.
{
  const p=project('JOB-RAW-SCOPE');
  p.job.CURRENT_ITERATION='ITERATION-SCOPE-001';
  const prompt=fixtureBuildPrompt(17,p,{operation:'EXECUTE_RUN',scope:{iterationId:'ITERATION-SCOPE-001',candidateId:'CANDIDATE-SCOPE-001',runId:'RUN-SCOPE-001',contextId:'CONTEXT-SCOPE-001'}});
  p.projectData.generatedPrompts.push({...prompt,generatedAt:new Date().toISOString()});
  const captured=ingestion.captureRaw(p,{stage:17,text:'{}',promptRecord:prompt,contextId:'MISLEADING-CALLER-CONTEXT'});
  if(captured.rawRecord.runId!=='RUN-SCOPE-001'||captured.rawRecord.contextId!=='CONTEXT-SCOPE-001'||captured.rawRecord.iteration!=='ITERATION-SCOPE-001')throw new Error('Raw-response audit identity is not bound to the controlling prompt scope.');
}


// Accepted BLOCKED canonical blockers must carry a hash of the complete stored record.
{
  let p=project('JOB-BLOCKER-RECORD-HASH'),stage=2,pr=savePrompt(p,stage);
  const blocked={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'blocked-1',kind:'MISSING_APPLICATION_CONTEXT',description:'Required application context is unavailable.',whyBlocking:'The current stage cannot proceed reliably.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(blocked),promptRecord:pr});
  if(!prepared.validation.valid)throw new Error('Blocked-response regression fixture is invalid: '+JSON.stringify(prepared.validation.issues));
  p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;
  const blocker=p.projectData.blockers.at(-1),expected=globalThis.closedLoopHash.recordSha256(blocker);
  if(!blocker||blocker.recordSha256!==expected||blocker.sha256!==expected)throw new Error('Accepted BLOCKED canonical blocker does not carry a recomputable complete-record hash.');
}


// A later accepted replacement resolves only earlier agent BLOCKED records in the exact stage/operation/scope lane.
{
  let p=project('JOB-BLOCKER-RECOVERY'),stage=3,pr=savePrompt(p,stage);
  const blocked={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'BLOCKED',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'blocked-recovery-1',kind:'MISSING_APPLICATION_CONTEXT',description:'Required application context is unavailable.',whyBlocking:'The current stage cannot proceed reliably.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};
  let prepared=ingestion.prepare(p,{stage,text:JSON.stringify(blocked),promptRecord:pr});
  if(!prepared.validation.valid)throw new Error('Blocked recovery fixture is invalid: '+JSON.stringify(prepared.validation.issues));
  p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;
  const agentBlocker=p.projectData.blockers.at(-1);if(!agentBlocker||engine.openBlockers(p,stage).length!==1)throw new Error('Accepted BLOCKED response did not create exactly one open agent blocker.');
  const humanBlocker=engine.createHumanBlocker(p,{stage,reason:'Independent human blocker must remain open.',operatorLabel:'VERIFY'});
  const replacementPrompt=savePrompt(p,stage),replacement=validEnvelope(p,stage,replacementPrompt);
  prepared=ingestion.prepare(p,{stage,text:JSON.stringify(replacement),promptRecord:replacementPrompt});
  if(!prepared.validation.valid)throw new Error('Replacement recovery fixture is invalid: '+JSON.stringify(prepared.validation.issues));
  p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFY'}).project;
  const resolved=p.projectData.blockers.find(x=>engine.recordId(x,'blockers')===engine.recordId(agentBlocker,'blockers')),stillOpen=p.projectData.blockers.find(x=>engine.recordId(x,'blockers')===engine.recordId(humanBlocker,'blockers'));
  if(engine.recordValue(resolved,'STATUS')!=='RESOLVED'||engine.recordValue(resolved,'RESOLUTION_EVIDENCE')==='NONE')throw new Error('Accepted replacement did not resolve the earlier exact-lane agent blocker.');
  if(engine.recordValue(stillOpen,'STATUS')!=='OPEN')throw new Error('Accepted replacement incorrectly resolved an unrelated human blocker.');
  if(resolved.recordSha256!==globalThis.closedLoopHash.recordSha256(resolved)||resolved.sha256!==resolved.recordSha256)throw new Error('Resolved blocker hash was not refreshed from complete canonical state.');
}


// Semantic response-type and reference validation must fail closed.
{
  const issues=[];
  ingestion.validateValue({valueType:'REFERENCE',nullable:false,enumValues:[]},123,'/ref',issues);
  if(!issues.some(x=>x.code==='WRONG_VALUE_TYPE'))throw new Error('Numeric scalar REFERENCE escaped type validation.');
  const arrayIssues=[];
  ingestion.validateValue({valueType:'REFERENCE_ARRAY',nullable:false,enumValues:[]},['REQ-1',2],'/refs',arrayIssues);
  if(!arrayIssues.some(x=>x.code==='WRONG_VALUE_TYPE'))throw new Error('Mixed REFERENCE_ARRAY escaped item validation.');
}
{
  const p=project('JOB-BLOCKED-SEMANTICS'),stage=1,pr={...fixtureBuildPrompt(stage,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);
  const base={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,humanInputRequests:[],stageData:{},records:{},evidence:[],warnings:[],attachments:[]};
  const nonblocking={...base,responseType:'BLOCKED',unresolved:[{temporaryKey:'u1',kind:'MISSING_EVIDENCE',description:'Nonblocking observation',whyBlocking:'It is explicitly not blocking.',affectedStageFields:[],affectedRecords:[],blocking:false}]};
  const blocked=ingestion.prepare(p,{stage,text:JSON.stringify(nonblocking),promptRecord:pr});
  if(blocked.validation.valid||!blocked.validation.issues.some(x=>x.code==='MISSING_BLOCKING_UNRESOLVED'))throw new Error('BLOCKED without an actual blocker was accepted.');
  const mixed={...base,responseType:'DATA_PROPOSAL',stageData:{EXACT_DELIVERABLE_REQUESTED:'Self-contained specification'},evidence:[{temporaryKey:'e1',kind:'WORKFLOW_EVIDENCE',description:'Fixture',location:'test',content:'fixture'}],unresolved:[{temporaryKey:'u2',kind:'MISSING_EVIDENCE',description:'Blocking missing evidence',whyBlocking:'Cannot proceed reliably.',affectedStageFields:[],affectedRecords:[],blocking:true}]};
  const mixedResult=ingestion.prepare(p,{stage,text:JSON.stringify(mixed),promptRecord:pr});
  if(mixedResult.validation.valid||!mixedResult.validation.issues.some(x=>x.code==='MIXED_RESPONSE_TYPE'&&x.path==='/unresolved'))throw new Error('DATA_PROPOSAL with a blocking unresolved item was accepted.');
  const failed={...base,responseType:'EXECUTION_FAILED',humanInputRequests:[{temporaryKey:'q1',question:'Supply value?',whyRequired:'Needed after failure.',affectedStageFields:[],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}],unresolved:[{temporaryKey:'u3',kind:'EXECUTION_FAILURE',description:'Execution failed',whyBlocking:'Execution did not complete.',affectedStageFields:[],affectedRecords:[],blocking:true}]};
  const failedResult=ingestion.prepare(p,{stage,text:JSON.stringify(failed),promptRecord:pr});
  if(failedResult.validation.valid||!failedResult.validation.issues.some(x=>x.code==='MIXED_RESPONSE_TYPE'))throw new Error('EXECUTION_FAILED silently accepted human-input requests that commit would discard.');
}

// Operation field surfaces and record identity modes are enforced fail closed.
{
  let p=project('JOB-NEG-OPERATION-STAGEDATA'),stage=17;const pr={...fixtureBuildPrompt(stage,p,{operation:'EXECUTE_RUN',scope:{runId:'RUN-OP-1',contextId:'CTX-OP-1'}}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{VERIFY_COMPLETED:'TRUE'},records:{},evidence:[{temporaryKey:'op-evidence',kind:'WORKFLOW_EVIDENCE',description:'operation isolation',location:'fixture',content:'operation isolation'}],unresolved:[],warnings:[],attachments:[]};const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='FIELD_OWNERSHIP_VIOLATION'))throw new Error('EXECUTE_RUN accepted application-owned VERIFY stageData.');negativeCount++;
}
{
  const p=project('JOB-NEG-NONRESERVED-TARGET'),stage=2,fixture=reservedSourceSearchFixture(p,'NONRESERVED-TARGET'),pr=fixture.promptRecord,e=fixture.envelope;e.stageData={};e.records={sources:[sourceProposal('source-policy')]};delete e.records.sources[0].tempKey;e.records.sources[0].targetId='SOURCE-000001';const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='INVALID_RECORD_IDENTITY'))throw new Error('Non-reserved collection accepted targetId update semantics.');negativeCount++;
}
function completeFields(collection){const definition=schema.RECORD_SCHEMAS[collection],fields={};for(const name of definition.required)if(definition.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=valueForDefinition(definition.fieldDefinitions[name]);return fields;}
function proposalEnvelope(p,stage,pr,records){return {schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records,evidence:[{temporaryKey:'policy-evidence',kind:'WORKFLOW_EVIDENCE',description:'record identity policy',location:'fixture',content:'record identity policy'}],unresolved:[],warnings:[],attachments:[]};}
{
  let p=project('JOB-NEG-RESERVED-TEMPKEY'),stage=21;p.job.CURRENT_BASELINE_ID='BASELINE-000001';p.job.CURRENT_PRODUCT_ID='PRODUCT-000001';const pr={...fixtureBuildPrompt(stage,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);const e=proposalEnvelope(p,stage,pr,{products:[{tempKey:'new-product',fields:completeFields('products'),relationships:{},evidenceRefs:['policy-evidence']}]});const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='INVALID_RECORD_IDENTITY'))throw new Error('Application-reserved collection accepted tempKey creation.');negativeCount++;
}
{
  let p=project('JOB-NEG-COMPLETED-TARGET'),stage=21,productId='PRODUCT-000001';p.job.CURRENT_BASELINE_ID='BASELINE-000001';p.job.CURRENT_PRODUCT_ID=productId;p.projectData.products.push({id:productId,stage,active:true,status:'COMPLETED',scope:{baselineId:'BASELINE-000001',productId},fields:{PRODUCT_ID:productId,BASELINE_ID:'BASELINE-000001',STATUS:'RESERVED'},PRODUCT_ID:productId,BASELINE_ID:'BASELINE-000001',STATUS:'RESERVED'});const pr={...fixtureBuildPrompt(stage,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);const e=proposalEnvelope(p,stage,pr,{products:[{targetId:productId,fields:completeFields('products'),relationships:{},evidenceRefs:['policy-evidence']}]});const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='INVALID_RESERVED_TARGET'))throw new Error('Completed reserved target was agent-completable a second time.');negativeCount++;
}
{
  let p=project('JOB-NEG-TARGET-SCOPE'),stage=11,runId='RUN-SCOPE-B';p.projectData.runs.push({id:runId,stage,active:true,status:'RESERVED',scope:{},fields:{RUN_ID:runId,CONTEXT_ID:'CTX-SCOPE-B'},RUN_ID:runId,CONTEXT_ID:'CTX-SCOPE-B'});const pr={...fixtureBuildPrompt(stage,p,{scope:{runId:'RUN-SCOPE-A',contextId:'CTX-SCOPE-A'}}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);const e=proposalEnvelope(p,stage,pr,{runs:[{targetId:runId,fields:completeFields('runs'),relationships:{},evidenceRefs:['policy-evidence']}]});const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='TARGET_SCOPE_MISMATCH'))throw new Error('Reserved target outside the controlling run/context scope was accepted.');negativeCount++;
}
console.log(JSON.stringify({operationStageDataIsolation:true,reservedTargetPolicy:true,completedReservedTargetBlocked:true,targetScopeIsolation:true,totalNegativeCases:negativeCount},null,2));

// Additional fail-closed semantic boundaries found outside the prior matrix.
{
  const p=project('JOB-UNPERSISTED-PROMPT'),stage=2,pr=fixtureBuildPrompt(stage,p),e=validEnvelope(p,stage,pr);let rejected=false;
  try{ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});}catch(error){rejected=/controlling persisted prompt|unavailable/i.test(String(error.message||error));}
  if(!rejected)throw new Error('Caller-supplied prompt object was accepted without a persisted canonical prompt record.');negativeCount++;
}
{
  const p=project('JOB-READABLE-CLARIFICATION'),stage=3,pr=savePrompt(p,stage),e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'q-read',question:'Which accepted source should control this ambiguity?',whyRequired:'The question concerns an already-readable canonical source.',affectedStageFields:[],affectedRecords:['sources'],answerType:'TEXT',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(!prepared.validation.valid)throw new Error('Clarification could not reference readable Stage 3 source records: '+JSON.stringify(prepared.validation.issues));
}
{
  const p=project('JOB-HUMAN-QUESTION-MIX'),stage=1,pr=savePrompt(p,stage),e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'q-only',question:'Need input?',whyRequired:'Human authority required.',affectedStageFields:[],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[{temporaryKey:'u-second',kind:'MISSING_HUMAN_INPUT',description:'Same missing input.',whyBlocking:'Same blocking condition.',affectedStageFields:[],affectedRecords:[],blocking:true}],warnings:[],attachments:[]};const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='MIXED_RESPONSE_TYPE'&&i.path==='/unresolved'))throw new Error('HUMAN_INPUT_REQUIRED accepted a second blocking unresolved channel.');negativeCount++;
}
{
  const p=project('JOB-QUESTION-VALUES'),stage=1,pr=savePrompt(p,stage),e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'q-choice',question:'Choose one.',whyRequired:'A controlled choice is required.',affectedStageFields:[],affectedRecords:[],answerType:'CHOICE',allowedValues:[],blocking:true}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='INVALID_ALLOWED_VALUES'))throw new Error('CHOICE question accepted an empty allowed-values contract.');negativeCount++;
}
{
  const p=project('JOB-HUMAN-ANSWER-EDGES');for(const [request,value] of [
    [{requestId:'Q-MULTI',answerType:'MULTI_CHOICE',allowedValues:['A','B'],blocking:true},[]],
    [{requestId:'Q-DATE',answerType:'DATE',allowedValues:[],blocking:true},'2026-02-31'],
    [{requestId:'Q-DUP',answerType:'MULTI_CHOICE',allowedValues:['A','B'],blocking:true},['A','A']]
  ]){let rejected=false;try{ingestion.validateHumanAnswer(request,value,p);}catch(error){rejected=error.code==='INVALID_HUMAN_ANSWER';}if(!rejected)throw new Error(`Invalid human answer was accepted for ${request.requestId}.`);negativeCount++;}
}

// Accepted control responses preserve evidence; supplied control flags are typed.
{
  const p=project('JOB-NEG-CONTROL-BOOLEAN'),pr=savePrompt(p,1);
  const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:1,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'HUMAN_INPUT_REQUIRED',humanInputRequests:[{temporaryKey:'q-bool',question:'Need value?',whyRequired:'Human authority required.',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:'false'}],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(e),promptRecord:pr});
  if(prepared.validation.valid||!prepared.validation.issues.some(i=>i.code==='WRONG_VALUE_TYPE'&&i.path==='/humanInputRequests/0/blocking'))throw new Error('String blocking flag was accepted as Boolean.');
  negativeCount++;
}
for(const responseType of ['HUMAN_INPUT_REQUIRED','BLOCKED','EXECUTION_FAILED']){
  let p=project(`JOB-CONTROL-EVIDENCE-${responseType}`),pr=savePrompt(p,1);
  const e={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:1,operation:pr.operation,promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType,humanInputRequests:[],stageData:{},records:{},evidence:[{temporaryKey:'control-evidence',kind:'WORKFLOW_EVIDENCE',description:'Controlled recovery evidence',location:'verification fixture',content:'Canonical control-response evidence'}],unresolved:[],warnings:[],attachments:[]};
  if(responseType==='HUMAN_INPUT_REQUIRED')e.humanInputRequests=[{temporaryKey:'q',question:'Exact value?',whyRequired:'Human authority required.',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],answerType:'TEXT',allowedValues:[],blocking:true}];
  else e.unresolved=[{temporaryKey:'u',kind:responseType==='BLOCKED'?'MISSING_APPLICATION_CONTEXT':'TOOL_FAILURE',description:'Cannot proceed.',whyBlocking:'Required condition unavailable.',affectedStageFields:['EXACT_DELIVERABLE_REQUESTED'],affectedRecords:[],blocking:true}];
  const prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(e),promptRecord:pr});
  if(!prepared.validation.valid)throw new Error(`${responseType} control evidence fixture rejected: ${JSON.stringify(prepared.validation.issues)}`);
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'VERIFICATION_OPERATOR'});
  const ids=committed.disposition?.evidenceIds||[];
  if(ids.length!==1||!committed.project.projectData.evidenceRecords.some(r=>engine.recordId(r,'evidenceRecords')===ids[0]))throw new Error(`${responseType} discarded canonical evidence.`);
}
console.log(JSON.stringify({persistedPromptAuthority:true,readableClarificationTargets:true,humanInputResponseExclusivity:true,choiceContractValidation:true,humanAnswerEdgeValidation:true,totalNegativeCases:negativeCount},null,2));


// Final boundary: the stage contract is the only individual text-field length authority.
{
  const definition={valueType:'STRING',enumValues:[],nullable:false,closedProperties:null};
  const tooLong=[]; ingestion.validateValue(definition,'1234','/contract-text',tooLong,{maxTextFieldLength:3});
  if(!tooLong.some(item=>item.code==='TEXT_FIELD_TOO_LARGE'))throw new Error('validateValue ignored the supplied response-contract text limit.');
  const exact=[]; ingestion.validateValue(definition,'123','/contract-text',exact,{maxTextFieldLength:3});
  if(exact.some(item=>item.code==='TEXT_FIELD_TOO_LARGE'))throw new Error('validateValue rejected a value exactly at the response-contract text limit.');
}

// Final boundary: naming a required executable/input artifact is not possession of its bytes.
{
  const p=project('JOB-TEST-ARTIFACT-BYTES'),stage=6,pr=savePrompt(p,stage),e=validEnvelope(p,stage,pr);
  if(!e)throw new Error('Stage 06 did not produce a response envelope fixture.');
  const def=schema.RECORD_SCHEMAS.tests,fields={};
  for(const name of def.required)if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=valueForDefinition(def.fieldDefinitions[name]);
  fields.EXECUTION_MODE='EXTERNAL_AGENT_TOOL';fields.REQUIRED_CAPABILITY='FIXTURE_EXTERNAL_TOOL';fields.EXECUTABLE_KIND='NONE';fields.ARTIFACT_REQUIREMENTS='fixture.js';
  e.stageData={};e.records={tests:[{tempKey:'test-artifact-record',fields,relationships:{},evidenceRefs:['evidence-1']}]};
  let prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr});
  if(!prepared.validation.valid)throw new Error('Stage 06 future artifact requirement was rejected before execution readiness: '+JSON.stringify(prepared.validation.issues));
  if(prepared.validation.issues.some(item=>item.code==='MISSING_REQUIRED_TEST_ARTIFACT'))throw new Error('Stage 06 incorrectly required execution bytes while accepting a test definition.');
  const sha='a'.repeat(64);
  e.attachments=[{temporaryKey:'test-artifact-1',filename:'fixture.js',mediaType:'application/javascript',byteSize:3,sha256:sha,required:true}];
  e.evidence[0].attachmentRef={tempKey:'test-artifact-1'};
  prepared=ingestion.prepare(p,{stage,text:JSON.stringify(e),promptRecord:pr,files:[{artifactId:'ARTIFACT-TEST-000001',name:'fixture.js',type:'application/javascript',size:3,sha256:sha}]});
  if(prepared.validation.issues.some(item=>item.code==='MISSING_REQUIRED_TEST_ARTIFACT'))throw new Error('Byte-backed TEST artifact evidence did not satisfy artifact custody validation.');
  if(!prepared.validation.valid)throw new Error('Byte-backed TEST artifact fixture was otherwise invalid: '+JSON.stringify(prepared.validation.issues));
  const proposedTest=prepared.proposal?.canonicalRecords?.tests?.[0],proposedEvidence=prepared.proposal?.evidence?.[0];
  if(!proposedTest||!proposedEvidence||!(Array.isArray(proposedTest.evidenceRefs)?proposedTest.evidenceRefs:[]).includes(proposedEvidence.id)||proposedEvidence.ATTACHMENT_ID!=='ARTIFACT-TEST-000001')throw new Error('TEST artifact custody did not resolve through canonical evidence to the verified artifact identity.');
}


// Regression execution truth cannot be asserted on the permanent regression definition.
negativeAt('regression definition execution-truth injection',15,(e)=>{
  const def=schema.RECORD_SCHEMAS.regressions,fields={};
  for(const name of def.required)if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=valueForDefinition(def.fieldDefinitions[name]);
  fields.PRE_CORRECTION_RESULT='VIOLATED';
  e.stageData={};
  e.records={regressions:[{tempKey:'regression-definition',fields,relationships:{},evidenceRefs:['evidence-1']}]};
},'FIELD_OWNERSHIP_VIOLATION');


// demonstrated-smart-quote-and-stageData-provenance-regression-v1
{
  let p=project('JOB-SMART-JSON-RECOVERY'),pr=savePrompt(p,1),e=validEnvelope(p,1,pr);
  e.stageData={...e.stageData,EXACT_DELIVERABLE_REQUESTED:'Patent application draft',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'Later filing-route facts'};
  const standard=JSON.stringify(e);const smart=standard.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g,'“$1”');
  const prepared=ingestion.prepare(p,{stage:1,text:smart,promptRecord:pr});
  if(!prepared.validation.valid)throw new Error('Deterministic smart-quote delimiter recovery failed: '+JSON.stringify(prepared.validation.issues));
  if(!prepared.validation.issues.some(x=>x.code==='JSON_TYPOGRAPHY_NORMALIZED'&&x.severity==='WARNING'))throw new Error('Smart-quote recovery was not auditable.');
  if(prepared.rawRecord.completeRawResponse!==smart)throw new Error('Smart-quote recovery changed the preserved raw response.');
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SMART_QUOTE_REGRESSION'});const stageEntries=committed.manifest.entries.filter(x=>x.canonicalCollection==='stageData');
  if(stageEntries.length!==4||stageEntries.some(x=>!Array.isArray(x.evidenceIds)||x.evidenceIds.length===0))throw new Error('StageData provenance is not linked to canonical response evidence.');
}


// reliability-v2: external responses remain unable to override application-derived proof authorities.
{
 const source=fs.readFileSync('workflow-engine.js','utf8');for(const token of ['evaluateContextIndependence','evaluateEvidenceSufficiency','detectCurrentContradictions'])if(!source.includes(token))throw new Error('Missing deterministic reliability authority: '+token);const ingestionSource=fs.readFileSync('response-ingestion.js','utf8');if(/INDEPENDENCE_PROVEN_BY_APPLICATION|EVIDENCE_SUFFICIENT/.test(ingestionSource))throw new Error('Ingestion introduced agent-writable derived reliability authority.');
}

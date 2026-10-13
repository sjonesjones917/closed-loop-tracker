import {createVerifierRuntime} from './verifier-runtime.mjs';
import {routeProjectionFixtureFields,deferredDefinitionRestorationFixture,acceptPrerequisite,boundedSearchProposal,recordProposal,registerFixtureSourceSearchCapability,stage01AcceptanceFixture} from './test-fixtures.mjs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import fs from 'node:fs';
import vm from 'node:vm';

const assert=(value,message)=>{if(!value)throw new Error(message);};
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
assert(core&&schema&&engine&&prompts&&ingestion,'Data-route audit runtime failed to load.');

let state=core.createBlankState('JOB-DATA-ROUTE-CLOSURE');
Object.assign(state.job,{
  JOB_ID:'JOB-DATA-ROUTE-CLOSURE',
  JOB_TITLE:'Data route closure fixture',
  EXACT_USER_OBJECTIVE_VERBATIM:'Prove every canonical data family travels through the exact authorized 30-stage route.',
  EXPLICIT_USER_REQUIREMENTS:'Never ask the human to repeat captured information. Make every stage action explicit and low-friction.',
  SUPPLIED_MATERIALS_INVENTORY:'NONE',
  CURRENT_INPUT_VERSION:'INPUT-ROUTE-v1',
  CURRENT_SOURCE_SET_VERSION:'SOURCE-ROUTE-v1',
  CURRENT_RESEARCH_VERSION:'RESEARCH-ROUTE-v1',
  CURRENT_REQUIREMENTS_VERSION:'REQ-ROUTE-v1',
  CURRENT_TEST_SUITE_VERSION:'TEST-ROUTE-v1',
  CURRENT_INSTRUCTION_VERSION:'INST-ROUTE-v1',
  CURRENT_ITERATION:'ITER-ROUTE-v1',
  CURRENT_BASELINE_ID:'BASE-ROUTE-v1',
  CURRENT_PRODUCT_ID:'PROD-ROUTE-v1'
});
engine.ensureShape(state);
engine.recalculate(state);
function bindIntake(){
const intake=prompts.intakeCoverageManifest(state);
state.stages[1].agentData={
  EXACT_DELIVERABLE_REQUESTED:'Complete route-proven deliverable.',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',
  INPUT_SET_CONTENTS:JSON.stringify({schema:'closed-loop-stage01-capture/2',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,pass1Completed:true,pass2OmissionChallenge:{completed:true,checkedCategories:['QUALIFIERS','EXCEPTIONS','DEPENDENCIES','NEGATIVE_REQUIREMENTS','DO_NOT_CHANGE','VISUAL_CONSTRAINTS','TEMPORAL_CONSTRAINTS','ACCEPTANCE_CONDITIONS','AUTHORITY_STATEMENTS','TOOL_RESTRICTIONS','FILE_REFERENCES','OUTPUT_FORMAT_REQUIREMENTS','CORRECTIONS','LATER_OVERRIDES'],omissionsFound:[],omissionsResolved:true},units:intake.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'route closure fixture',externalInspectionClaimed:u.kind==='SUPPLIED_MATERIAL'&&Number(u.byteSize||0)>0?true:undefined,extractedStatements:[{statementKey:`S${i+1}`,text:u.rawValueText||u.label||u.unitId,statementClass:'CONTEXT',sourceLocation:u.kind==='SUPPLIED_MATERIAL'?u.sourceLocation:undefined}]}))})
};
}
const runtime={core,schema,engine,prompts,ingestion};
const source=n=>recordProposal(schema,'sources',{tempKey:`route-source-${n}`,overrides:{TITLE:`Data route closure source ${n}`,ISSUING_ORGANIZATION_OR_AUTHOR:`Independent synthetic fixture authority ${n}`,SOURCE_TYPE:'OFFICIAL_STANDARD',PUBLICATION_ORIGIN:'Independent synthetic fixture publication',URL_REFERENCE:`https://example.invalid/data-route-closure-${n}`,AUTHORITY_LEVEL:'PRIMARY',AUTHORITY_ROLE:'GOVERNING',RELEVANCE:'Supplies the controlled data-route source relationship.',APPLICABLE_PORTIONS:'Complete controlled source',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT_SUPERSEDED',CONTROLLING_STATE:'CONTROLLING'}});
state=stage01AcceptanceFixture(runtime,state.job.JOB_ID,{project:state});
state=acceptPrerequisite(runtime,state,2,{stageData:{AUTHORITY_HIERARCHY:'The two declared independent synthetic authorities are reconciled for the closed fixture.',KNOWN_CONTROLLING_SOURCES_EXAMINED:'The bounded search inspected both declared synthetic authorities and retained their resolved relationship.'},records:{sources:[source(1),source(2)],sourceConflicts:[recordProposal(schema,'sourceConflicts',{tempKey:'route-source-conflict',relationships:{SOURCE_A:{tempKey:'route-source-1'},SOURCE_B:{tempKey:'route-source-2'}},overrides:{CONFLICTING_PROPOSITION:'The two synthetic authorities use distinct labels for the same route obligation.',SOURCE_A_AUTHORITY:'Independent synthetic fixture authority 1',SOURCE_B_AUTHORITY:'Independent synthetic fixture authority 2',AUTHORITY_RESOLUTION_RULE:'The more specific route statement controls within this closed fixture.',CONTROLLING_SOURCE_OBJECTIVELY_ESTABLISHED:'TRUE',RESOLUTION:'Both statements are compatible after applying the declared specific-over-general rule.',RESOLUTION_STATUS:'RESOLVED',AFFECTED_WORK:'The controlled data-route source relationship.',EVIDENCE:'Exact synthetic source statements and their resolved relationship are retained.'}})],sourceSearchContracts:[boundedSearchProposal(schema)]}}).project;
registerFixtureSourceSearchCapability(runtime,state);
state=acceptPrerequisite(runtime,state,2,{operation:'SEARCH_ADEQUACY_REVIEW',records:{semanticReviews:[recordProposal(schema,'semanticReviews',{tempKey:'route-search-review',overrides:{REVIEW_QUESTION:'Was the bounded fixture search and conflict disposition executed adequately?',FINDING:'The closed fixture input universe is exhausted and its retained source relationship is resolved.',REASONING:'Compared the declared source classes, locations, executed query evidence, stopping criteria, source dispositions, exclusions and residual risk with the controlled fixture scope.',RESULT:'ACCEPTED'}})]}}).project;
const acceptedSourceIds=engine.recordsForCurrentScope(state,'sources').map(row=>engine.recordId(row,'sources'));
assert(acceptedSourceIds.length===2&&engine.sourceSearchAdequacyState(state).complete,'Data-route fixture failed to establish its accepted Stage 02 source-search prerequisite.');
state=acceptPrerequisite(runtime,state,3,{stageData:{EXCEPTIONS_AND_EDGE_CONDITIONS:'NONE',CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE',RESEARCH_GAPS_AND_BLOCKERS:'NONE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false},records:{research:acceptedSourceIds.map((sourceId,index)=>recordProposal(schema,'research',{tempKey:`route-research-${index+1}`,relationships:{SOURCE_ID:{recordId:sourceId}},overrides:{PASS_NUMBER:'2',EXACT_PORTION_EXAMINED:'Complete controlled source',FINDING_CLASSIFICATION:'CONTROLLING_ROUTE_INPUT',SOURCE_EVIDENCE:'Exact synthetic source statement retained in the accepted Stage 02 inventory.',SATURATION_STATUS:'SATURATED'}}))}}).project;
assert(engine.gate(3,state).complete,'Data-route fixture failed to establish accepted Stage 03 coverage of its current Stage 02 sources.');
const prerequisiteRows=Object.fromEntries(['sources','sourceConflicts','research','freshContexts','evidenceRecords','operationReservations','humanDecisions','sourceSearchContracts','semanticReviews','environmentManifests','externalCapabilities'].map(collection=>[collection,engine.clone(state.projectData[collection]||[])]));
const acceptedSearchReviewId=engine.recordId(prerequisiteRows.semanticReviews.find(row=>Number(row.stage)===2),'semanticReviews');
assert(acceptedSearchReviewId,'Data-route fixture lost its accepted Stage 02 search-adequacy review while establishing Stage 03 coverage.');
for(let stage=1;stage<30;stage++){state.stages[stage].status='COMPLETE';state.stages[stage].gate={complete:true,blocked:false,reasons:[]};}

const versionScopeFor=collection=>{
  const stage=Number(schema.RECORD_SCHEMAS[collection]?.stage||0),scope={};
  if(stage>=2){scope.inputVersion=state.job.CURRENT_INPUT_VERSION;scope.sourceSetVersion=state.job.CURRENT_SOURCE_SET_VERSION;}
  if(stage>=3)scope.researchVersion=state.job.CURRENT_RESEARCH_VERSION;
  if(stage>=4)scope.requirementsVersion=state.job.CURRENT_REQUIREMENTS_VERSION;
  if(stage>=6)scope.testSuiteVersion=state.job.CURRENT_TEST_SUITE_VERSION;
  if(stage>=8)scope.instructionVersion=state.job.CURRENT_INSTRUCTION_VERSION;
  if(!Object.keys(scope).length)scope.inputVersion=state.job.CURRENT_INPUT_VERSION;
  return scope;
};
const staleScopeFor=collection=>{const scope=versionScopeFor(collection);const key=Object.keys(scope)[0];scope[key]=`STALE-${scope[key]}`;return scope;};
const varianceFixtureFields=(id,testId,scope,variant)=>{const normalized={dimensions:['requirement-truth'],allowedVariance:'No correctness-affecting variance is allowed in the controlled route projection.',rationale:`${variant} controlled route projection contract.`};return{VARIANCE_CONTRACT_ID:id,DIMENSIONS:normalized.dimensions,RATIONALE:normalized.rationale,ALLOWED_VARIANCE:normalized.allowedVariance,TEST_ID:testId,NORMALIZED_CONTRACT:normalized,FROZEN_AT:'2026-10-12T00:00:00.000Z',SCOPE:scope,CONTRACT_SHA256:globalThis.closedLoopHash.sha256Value(normalized),STATUS:'FROZEN'};};

const collectionSentinels={};
for(const [collection,recordSchema] of Object.entries(schema.RECORD_SCHEMAS)){
  const currentId=`ROUTE-${collection}-CURRENT`;
  const staleId=`ROUTE-${collection}-STALE`;
  const agentField=Object.values(recordSchema.fieldDefinitions).find(def=>def.producer===schema.PRODUCER.AGENT)?.name;
  const fields={[recordSchema.idField]:currentId};
  const staleFields={[recordSchema.idField]:staleId};
  if(agentField){fields[agentField]=`CURRENT-SENTINEL-${collection}`;staleFields[agentField]=`STALE-SENTINEL-${collection}`;}
  if(collection==='defects'){fields.EXPECTED_CONDITION='Expected fixture condition';staleFields.EXPECTED_CONDITION='Stale fixture condition';}
  Object.assign(fields,routeProjectionFixtureFields(collection,{idPrefix:'ROUTE',variant:'CURRENT',marker:`CURRENT-SENTINEL-${collection}`}));
  if(['research','requirements','evidenceRecords'].includes(collection))fields.SOURCE_ID=acceptedSourceIds[0];
  Object.assign(staleFields,routeProjectionFixtureFields(collection,{idPrefix:'ROUTE',variant:'STALE',marker:`STALE-SENTINEL-${collection}`}));
  const currentScope=versionScopeFor(collection),staleScope=staleScopeFor(collection);
  if(collection==='expectedVarianceContracts'){
    assert(collectionSentinels.tests?.currentId&&collectionSentinels.tests?.staleId,'Expected-variance route controls require current and stale Test identities.');
    Object.assign(fields,varianceFixtureFields(currentId,collectionSentinels.tests.currentId,currentScope,'Current'));
    Object.assign(staleFields,varianceFixtureFields(staleId,collectionSentinels.tests.staleId,staleScope,'Stale'));
  }
  const relationships=collection==='expectedVarianceContracts'?{TEST_ID:collectionSentinels.tests.currentId}:{};
  const staleRelationships=collection==='expectedVarianceContracts'?{TEST_ID:collectionSentinels.tests.staleId}:{};
  const current={stage:recordSchema.stage||1,fields,scope:currentScope,relationships,active:true,validity:'CURRENT'};
  const stale={stage:recordSchema.stage||1,fields:staleFields,scope:staleScope,relationships:staleRelationships,active:true,validity:'CURRENT'};
  engine.refreshRecordHashes(current,collection);engine.refreshRecordHashes(stale,collection);
  const retained=prerequisiteRows[collection]||[],routeSentinel=retained.length&&!['sources','sourceConflicts','sourceSearchContracts'].includes(collection)?current:null,selectedCurrent=routeSentinel||retained.at(-1)||current;
  state.projectData[collection]=[stale,...(retained.length?retained:[current]),...(routeSentinel?[routeSentinel]:[])];
  const selectedCurrentId=engine.recordId(selectedCurrent,collection),selectedFields=selectedCurrent.fields||fields;
  collectionSentinels[collection]={currentId:selectedCurrentId,staleId,currentText:typeof selectedFields[agentField]==='string'?selectedFields[agentField]:selectedCurrentId,staleText:`STALE-SENTINEL-${collection}`};
  const selected=engine.recordsForCurrentScope(state,collection);
  assert(selected.some(record=>engine.recordId(record,collection)===selectedCurrentId),`${collection}: current-scope selector omitted current record.`);
  assert(!selected.some(record=>engine.recordId(record,collection)===staleId),`${collection}: current-scope selector admitted stale record.`);
}

bindIntake();
assert(engine.sourceSearchAdequacyState(state).complete&&collectionSentinels.semanticReviews.currentId!==acceptedSearchReviewId&&engine.recordsForCurrentScope(state,'semanticReviews').some(row=>engine.recordId(row,'semanticReviews')===acceptedSearchReviewId),'Data-route projection must retain the accepted Stage 02 adequacy review separately from the unbound semantic-review route sentinel.');

const forbiddenReads={
  '11:EXECUTE_RUN':['verification','comparisons','defects','rootCauses','changes','meaningResults','adversarialResults'],
  '12:VERIFY':['comparisons','rootCauses','changes'],
  '23:COMPLETE':['deterministicResults','adversarialResults'],
  '24:COMPLETE':['deterministicResults','meaningResults']
};
for(const operation of ['EXECUTE_RUN','VERIFY'])for(const stage of [17,19])forbiddenReads[`${stage}:${operation}`]=operation==='EXECUTE_RUN'?['verification','comparisons','rootCauses','changes']:['comparisons','rootCauses','changes'];
// Readable secondary families are not permission to embed unbound prior
// conclusions in independent product reviews (specification Stages 23/24).
const unboundSecondaryWithheld={23:['observationRecords','entailmentReviews','semanticReviews'],24:['observationRecords','entailmentReviews','semanticReviews']};
// §28.1/28.2 and §36.2 preserve governing inputs and exclude unbound secondary
// conclusions in each independent execution/verification role. Keep this
// specification-side expectation independent of the production selector.
const independentRunRoles=['11:EXECUTE_RUN','12:VERIFY','17:EXECUTE_RUN','17:VERIFY','19:EXECUTE_RUN','19:VERIFY'];
const independentRunSecondaryFamilies=['observationRecords','entailmentReviews','semanticReviews'];
const independentRunUnboundContextObservations=[];
// NREQ-15bcea4db7a052db7fc4f619dac3acae, NREQ-1126421373496db4a5b96b755fb2b49c,
// and the Section 26.5 review contract permit only these COMPARE operations to
// consume their separately authored independent materiality review in the same
// registered operation. Every other write still requires a downstream reader.
const sameOperationReviewRoutes=new Set(['13:COMPARE:materialityReviews','17:COMPARE:materialityReviews','19:COMPARE:materialityReviews']);
const sameOperationReviewContractValid=(op,collection)=>Boolean(op&&op.readCollections.includes(collection)&&op.agentWritableCollections.includes(collection)&&op.agentWritableCollections.includes('semanticReviews'));
const sameOperationReviewSupported=(producer,consumers,{routes=sameOperationReviewRoutes,contractFor=(stage,operation)=>schema.operationContract(stage,operation)}={})=>routes.has(`${producer.stage}:${producer.operation}:${producer.collection}`)&&sameOperationReviewContractValid(contractFor(producer.stage,producer.operation),producer.collection)&&consumers.some(consumer=>consumer.stage===producer.stage&&consumer.operation===producer.operation);
for(const key of sameOperationReviewRoutes){const [stageText,operation,collection]=key.split(':'),op=schema.operationContract(Number(stageText),operation);assert(sameOperationReviewContractValid(op,collection),`Registered same-operation review route is incomplete: ${key}.`);}


let operationsChecked=0,readEdgesChecked=0,writableCollectionsChecked=0,writableFieldsChecked=0,relationshipDefinitionsChecked=0;
const writeProducers=new Map();
const readConsumers=new Map();
for(let stage=1;stage<=30;stage++){
  const stageContract=schema.STAGE_CONTRACTS[stage];
  assert(stageContract&&Array.isArray(stageContract.operations)&&stageContract.operations.length,`Stage ${stage} lacks operations.`);
  for(const operation of stageContract.operations){
    operationsChecked++;
    const op=schema.operationContract(stage,operation);
    assert(op,`Stage ${stage}/${operation} lacks operation contract.`);
    for(const collection of op.readCollections){
      readEdgesChecked++;
      assert(schema.RECORD_SCHEMAS[collection],`Stage ${stage}/${operation} reads unknown ${collection}.`);
      if(!readConsumers.has(collection))readConsumers.set(collection,[]);readConsumers.get(collection).push({stage,operation});
    }
    for(const collection of op.agentWritableCollections){
      writableCollectionsChecked++;
      const rs=schema.RECORD_SCHEMAS[collection];assert(rs,`Stage ${stage}/${operation} writes unknown ${collection}.`);
      if(!writeProducers.has(collection))writeProducers.set(collection,[]);writeProducers.get(collection).push({stage,operation});
      const agentFields=schema.recordAgentFields(collection);assert(agentFields.length,`Stage ${stage}/${operation} exposes ${collection} but it has no agent-writable fields.`);
      for(const name of agentFields){writableFieldsChecked++;const def=rs.fieldDefinitions[name];assert(def.producer===schema.PRODUCER.AGENT,`${collection}.${name} writable producer is not AGENT.`);assert(def.responsePath&&def.responsePath.includes('/records/{collection}/'),`${collection}.${name} lacks canonical record response path.`);assert(def.provenanceRequired===true,`${collection}.${name} does not require provenance.`);}
      for(const [relationship,target] of Object.entries(rs.relationships||{})){relationshipDefinitionsChecked++;assert(schema.RECORD_SCHEMAS[target],`${collection}.${relationship} points to unknown ${target}.`);const def=rs.fieldDefinitions[relationship];assert(def&&def.producer===schema.PRODUCER.APPLICATION,`${collection}.${relationship} relationship is not application-owned.`);}
    }
    for(const field of op.allowedStageData){const def=schema.STAGE_FIELDS[stage]?.[field];assert(def&&def.producer===schema.PRODUCER.AGENT,`Stage ${stage}/${operation} exposes unauthorized stage field ${field}.`);writableFieldsChecked++;}
    for(const blocked of forbiddenReads[`${stage}:${operation}`]||[])assert(!op.readCollections.includes(blocked),`Stage ${stage}/${operation} leaks forbidden ${blocked}.`);

    const availableScope={projectRevision:state.revision,inputVersion:state.job.CURRENT_INPUT_VERSION,sourceSetVersion:state.job.CURRENT_SOURCE_SET_VERSION,requirementsVersion:state.job.CURRENT_REQUIREMENTS_VERSION,testSuiteVersion:state.job.CURRENT_TEST_SUITE_VERSION,instructionVersion:state.job.CURRENT_INSTRUCTION_VERSION,iterationId:'ITER-ROUTE-v1',candidateId:'CAND-ROUTE-v1',runId:collectionSentinels.runs.currentId,contextId:collectionSentinels.freshContexts.currentId,baselineId:'BASE-ROUTE-v1',productId:'PROD-ROUTE-v1'};
    const scope=Object.fromEntries(op.scopeRequirements.map(key=>[key,availableScope[key]||engine.currentScope(state)[key]||key.toUpperCase()+'-ROUTE']));
    for(const key of op.scopeRequirements)assert(scope[key]!==undefined,`Fixture missing required scope ${key} for Stage ${stage}/${operation}.`);
    let record;
    try{record=prompts.buildPromptRecord(stage,state,{operation,scope});}catch(error){assert((schema.STAGE_OPERATION_REGISTRY[`${stage}:${operation}`].deferredSubjectFamily&&error.code==='DEFERRED_EXECUTION_UNAVAILABLE')||(schema.STAGE_OPERATION_REGISTRY[`${stage}:${operation}`].acceptsExternalResponse===false&&error.code==='NON_EXTERNAL_OPERATION'),`Stage ${stage}/${operation} unexpectedly failed prompt generation: ${error.message}`);record=null;}
    if(record){
      const manifest=record.contextManifest?.readCollections||{};
      for(const collection of op.readCollections){
        const ids=(manifest[collection]||[]).map(item=>item.id);
        const sent=collectionSentinels[collection];
        if(Number(schema.RECORD_SCHEMAS[collection].stage)>stage){assert(!ids.includes(sent.currentId)&&!record.prompt.includes(sent.currentText),`Stage ${stage}/${operation} leaked subsequent-stage ${collection}.`);continue;}
        const independentUnbound=independentRunRoles.includes(`${stage}:${operation}`)&&independentRunSecondaryFamilies.includes(collection);
        if(unboundSecondaryWithheld[stage]?.includes(collection)||independentUnbound){
          assert(!ids.includes(sent.currentId)&&!record.prompt.includes(sent.currentText)&&!record.prompt.includes(sent.currentId),`Stage ${stage}/${operation} leaked unauthorized current ${collection}.`);
          assert(!ids.includes(sent.staleId)&&!record.prompt.includes(sent.staleText)&&!record.prompt.includes(sent.staleId),`Stage ${stage}/${operation} leaked unauthorized stale ${collection}.`);
          if(independentUnbound){
            const carriers=[record.prompt,JSON.stringify(prompts.promptFileManifest(record)),...prompts.materializePromptContextFiles(record,state).map(file=>file.text)].join('\n');
            assert(![sent.currentId,sent.currentText,sent.staleId,sent.staleText].some(value=>carriers.includes(value)),`ROUTE_UNBOUND_SECONDARY_CARRIER_ORACLE: ${stage}/${operation} exposed ${collection} through an exported carrier.`);
            independentRunUnboundContextObservations.push({operationKey:`${stage}:${operation}`,collection,currentWithheld:true,staleWithheld:true,allCarriersWithheld:true});
          }
          continue;
        }
        assert(ids.includes(sent.currentId),`Stage ${stage}/${operation} prompt manifest omitted current ${collection}.`);
        assert(!ids.includes(sent.staleId),`Stage ${stage}/${operation} prompt manifest leaked stale ${collection}.`);
        assert(record.prompt.includes(sent.currentText)||record.prompt.includes(sent.currentId),`Stage ${stage}/${operation} prompt body omitted selected ${collection} content.`);
        assert(!record.prompt.includes(sent.staleText)&&!record.prompt.includes(sent.staleId),`Stage ${stage}/${operation} prompt body leaked stale ${collection}.`);
      }
      for(const collection of op.agentWritableCollections){
        assert(record.prompt.includes(collection),`Stage ${stage}/${operation} prompt omits writable collection ${collection}.`);
        for(const field of schema.recordAgentFields(collection))assert(record.prompt.includes(field),`Stage ${stage}/${operation} prompt omits legitimate return field ${collection}.${field}.`);
      }
      for(const field of op.allowedStageData)assert(record.prompt.includes(field),`Stage ${stage}/${operation} prompt omits writable stageData ${field}.`);
    }
  }
}

for(const key of independentRunRoles)for(const collection of independentRunSecondaryFamilies)assert(independentRunUnboundContextObservations.filter(row=>row.operationKey===key&&row.collection===collection).length===1,`ROUTE_UNBOUND_SECONDARY_POPULATION_ORACLE: ${key}/${collection} was not checked exactly once.`);

const terminalFamilies=new Set(['releaseGateReviews','evidenceInvestigations']);
for(const [collection,producers] of writeProducers){
  if(terminalFamilies.has(collection))continue;
  const consumers=readConsumers.get(collection)||[];
  for(const producer of producers){
    const later=consumers.some(c=>c.stage>producer.stage||(c.stage===producer.stage&&c.operation!==producer.operation));
    const sameOperationReview=sameOperationReviewSupported({...producer,collection},consumers);
    assert(later||sameOperationReview||producer.stage===30,`${collection} written at Stage ${producer.stage}/${producer.operation} has no downstream retrieval or registered same-operation independent review path.`);
  }
}

let invalidationStagesChecked=0;
for(let changedStage=1;changedStage<30;changedStage++){
  const p=core.createBlankState(`JOB-INVALIDATION-${changedStage}`);engine.ensureShape(p);
  for(let stage=1;stage<=30;stage++){p.stages[stage].status='COMPLETE';p.stages[stage].acceptedData={marker:`S${stage}`};p.stages[stage].acceptedDataChangeIds=[`CHANGE-${stage}`];}
  p.projectData.generatedPrompts=Array.from({length:30},(_,i)=>({stage:i+1,instructionId:`PROMPT-${i+1}`,operation:'COMPLETE'}));
  const invalidated=engine.invalidateDownstream(p,changedStage,`ROUTE-CHANGE-${changedStage}`,'route closure mutation');
  invalidationStagesChecked++;
  for(let stage=1;stage<changedStage;stage++)assert(!p.stages[stage].invalidatedBy,`Stage ${changedStage} change invalidated upstream Stage ${stage}.`);
  for(let stage=changedStage+1;stage<=30;stage++)assert(p.stages[stage].status==='NOT STARTED'&&p.stages[stage].invalidatedBy===`ROUTE-CHANGE-${changedStage}`,`Stage ${changedStage} change failed to invalidate downstream Stage ${stage}.`);
  assert(invalidated.every(stage=>stage>changedStage),`Stage ${changedStage} invalidation reported upstream stage.`);
}

const promptSource=fs.readFileSync('prompt-engine.js','utf8');
for(const phrase of [
  'CONVERSATION PRECEDENCE — HUMAN EXPERIENCE IS PART OF EXECUTION',
  'ask the human directly in concise plain language',
  'The human supplies project information once',
  'If this prompt lists files that you must receive, do not pretend you received or inspected them',
  'Ask the human to attach or send the exact listed file only when those bytes are actually required'
])assert(promptSource.includes(phrase),`Prompt authority missing human-experience invariant: ${phrase}`);
const ordinaryInstruction='Before final JSON, re-read the complete current-stage instruction';
const deferredInstruction='Before final JSON, re-read the complete current-operation instruction';
function assertReviewInstruction(text,required,scope){assert(text.includes(required),`PROMPT_HUMAN_EXPERIENCE_ORACLE: generated ${scope} instruction omitted its complete current-work review.`);}
const ordinaryPrompt=prompts.buildPromptRecord(1,state,{operation:'COMPLETE'}).prompt;
assertReviewInstruction(ordinaryPrompt,ordinaryInstruction,'Stage 01');
const deferredRuntime=projectStoreRuntime(),deferredFixture=await deferredDefinitionRestorationFixture(deferredRuntime,{family:'failureTests'});
const deferredPrompt=deferredRuntime.prompts.reserveAndBuildPromptRecord(deferredFixture.p,deferredFixture.stage,{operation:'EXECUTE_FAILURE_TEST'}).prompt.prompt;
assertReviewInstruction(deferredPrompt,deferredInstruction,'conditional execution');
const phraseTemplate='Before final JSON, re-read the complete current-${task} instruction';
assert(promptSource.includes(phraseTemplate),'PROMPT_HUMAN_EXPERIENCE_SETUP_ORACLE: the controlling prompt template was not reached.');
const omittedSource=promptSource.replace(phraseTemplate,'Before final JSON, omit the current instruction review');
const omittedRuntime=projectStoreRuntime({sourceOverrides:{'prompt-engine.js':omittedSource}}),omittedState=omittedRuntime.core.createBlankState('ROUTE-OMITTED-PROMPT-REVIEW');
omittedRuntime.engine.ensureShape(omittedState);
let omissionDetected=false;
try{assertReviewInstruction(omittedRuntime.prompts.buildPromptRecord(1,omittedState,{operation:'COMPLETE'}).prompt,ordinaryInstruction,'Stage 01');}catch(error){omissionDetected=error.message.includes('PROMPT_HUMAN_EXPERIENCE_ORACLE');}
assert(omissionDetected,'PROMPT_HUMAN_EXPERIENCE_MUTATION_ORACLE: omission in the production prompt source was not detected at the generated instruction.');
for(const subject of ['patent','legal','medical','software','aec','mechanical','cad','cam','cnc','scientific','financial']){
  const branchPattern=new RegExp(`(?:\\bif\\b|\\bswitch\\b|\\bcase\\b)[^\\n]{0,120}\\b${subject}\\b`,'i');
  assert(!branchPattern.test(promptSource),`prompt-engine.js contains subject-specific runtime branch for ${subject}.`);
}
const uiSource=fs.readFileSync('app-core.js','utf8');
assert(uiSource.includes('NEXT_REQUIRED_ACTION')&&uiSource.includes('currentNextAction'),`UI is not driven by the application-derived structured next action.`);
assert(uiSource.includes('Double-check before you continue')&&uiSource.includes('operatorChecks'),`Operator UI does not expose the stage-specific double-check guide.`);
for(let stage=1;stage<=30;stage++){const probe=core.createBlankState(`JOB-OPERATOR-CHECK-${stage}`);engine.ensureShape(probe);probe.activeStage=stage;probe.job.CURRENT_STAGE=`STAGE ${String(stage).padStart(2,'0')}`;engine.recalculate(probe);const action=engine.operationalNextAction(probe,stage);assert(Array.isArray(action.operatorChecks)&&action.operatorChecks.length>0,`Stage ${stage} structured action lacks operator double-check guidance.`);}
assert(!/agent must |agent should |the agent should/i.test(uiSource),`External-agent behavioral instruction leaked outside prompt-engine.js.`);

console.log(JSON.stringify({
  dataRouteClosure:'PASS',
  independentRunUnboundContextObservations,
  scopeLimit:'Synthetic current/stale projection sentinels exercise actual prompt and contract owners; no stage completion, functional lifecycle, or independent semantic approval claim.',
  stages:30,
  operationsChecked,
  canonicalFamilies:Object.keys(schema.RECORD_SCHEMAS).length,
  readEdgesChecked,
  writableCollectionsChecked,
  writableFieldsChecked,
  relationshipDefinitionsChecked,
  invalidationStagesChecked,
  currentScopeStaleExclusion:true,
  promptReadSerialization:true,
  responseAuthorizationClosure:true,
  provenanceContractClosure:true,
  downstreamForwardingClosure:true,
  downstreamOnlyInvalidation:true,
  subjectNeutralPromptAuthority:true,
  humanExperiencePromptContract:true
},null,2));

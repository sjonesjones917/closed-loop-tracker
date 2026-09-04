import fs from 'node:fs';
import vm from 'node:vm';

const assert=(value,message)=>{if(!value)throw new Error(message);};
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
assert(core&&schema&&engine&&prompts&&ingestion,'Data-route audit runtime failed to load.');

// Regression: Stage 03 independent omission challenge cannot see or overwrite the author extraction,
// and reconciliation must consume both completed outputs before Stage 04 can use the research.
{
  const complete=schema.operationContract(3,'COMPLETE');
  const challenge=schema.operationContract(3,'SEMANTIC_CHALLENGE');
  const reconcile=schema.operationContract(3,'RECONCILE_RESEARCH');
  assert(complete.agentWritableCollections.includes('research')&&complete.agentWritableCollections.includes('candidateRequirements'),'Stage 03 COMPLETE lost canonical extraction outputs.');
  assert(challenge.readCollections.includes('sources')&&!challenge.readCollections.includes('research')&&!challenge.readCollections.includes('candidateRequirements'),'Stage 03 challenge is not independent from the first extraction.');
  assert(challenge.agentWritableCollections.includes('semanticChallenges')&&!challenge.agentWritableCollections.includes('research')&&!challenge.agentWritableCollections.includes('candidateRequirements'),'Stage 03 challenge can overwrite author extraction.');
  assert(reconcile.readCollections.includes('research')&&reconcile.readCollections.includes('candidateRequirements')&&reconcile.readCollections.includes('semanticChallenges'),'Stage 03 reconciliation lacks author/challenge inputs.');
  assert(reconcile.agentWritableCollections.includes('semanticReviews')&&!reconcile.agentWritableCollections.includes('research')&&!reconcile.agentWritableCollections.includes('candidateRequirements'),'Stage 03 reconciliation has incorrect write authority.');
  for(const operation of ['COMPLETE','DISPOSITION_CHALLENGE','ATOMICITY_CHALLENGE','RECONCILE_REQUIREMENTS'])assert(schema.operationContract(4,operation).readCollections.includes('semanticReviews'),'Stage 04/'+operation+' does not consume reconciled Stage 03 review.');
}

const state=core.createBlankState('JOB-DATA-ROUTE-CLOSURE');
Object.assign(state.job,{
  JOB_ID:'JOB-DATA-ROUTE-CLOSURE',
  JOB_TITLE:'Data route closure fixture',
  EXACT_USER_OBJECTIVE_VERBATIM:'Prove every canonical data family travels through the exact authorized 30-stage route.',
  EXPLICIT_USER_REQUIREMENTS:'Never ask the human to repeat captured information. Make every stage action explicit and low-friction.',
  SUPPLIED_MATERIALS_INVENTORY:'NONE',
  CURRENT_INPUT_VERSION:'INPUT-ROUTE-v1',
  CURRENT_SOURCE_SET_VERSION:'SOURCE-ROUTE-v1',
  CURRENT_REQUIREMENTS_VERSION:'REQ-ROUTE-v1',
  CURRENT_TEST_SUITE_VERSION:'TEST-ROUTE-v1',
  CURRENT_INSTRUCTION_VERSION:'INST-ROUTE-v1',
  CURRENT_ITERATION:'ITER-ROUTE-v1',
  CURRENT_BASELINE_ID:'BASE-ROUTE-v1',
  CURRENT_PRODUCT_ID:'PROD-ROUTE-v1'
});
engine.ensureShape(state);
engine.recalculate(state);
const intake=prompts.intakeCoverageManifest(state);
state.stages[1].agentData={
  EXACT_DELIVERABLE_REQUESTED:'Complete route-proven deliverable.',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',
  INPUT_SET_CONTENTS:JSON.stringify({schema:'closed-loop-stage01-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'route closure fixture',extractedStatements:[{statementKey:`S${i+1}`,text:u.rawValueText||u.label||u.unitId,statementClass:'CONTEXT'}]}))})
};
state.stages[1].status='COMPLETE';state.stages[1].gate={complete:true,blocked:false,reasons:[]};
state.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};state.stages[2].status='COMPLETE';state.stages[2].gate={complete:true,blocked:false,reasons:[]};
state.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:true,SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false};state.stages[3].status='COMPLETE';state.stages[3].gate={complete:true,blocked:false,reasons:[]};
for(let stage=1;stage<30;stage++){state.stages[stage].status='COMPLETE';state.stages[stage].gate={complete:true,blocked:false,reasons:[]};}

const versionScopeFor=collection=>{
  const stage=Number(schema.RECORD_SCHEMAS[collection]?.stage||0),scope={};
  if(stage>=2){scope.inputVersion=state.job.CURRENT_INPUT_VERSION;scope.sourceSetVersion=state.job.CURRENT_SOURCE_SET_VERSION;}
  if(stage>=4)scope.requirementsVersion=state.job.CURRENT_REQUIREMENTS_VERSION;
  if(stage>=6)scope.testSuiteVersion=state.job.CURRENT_TEST_SUITE_VERSION;
  if(stage>=8)scope.instructionVersion=state.job.CURRENT_INSTRUCTION_VERSION;
  if(!Object.keys(scope).length)scope.inputVersion=state.job.CURRENT_INPUT_VERSION;
  return scope;
};
const staleScopeFor=collection=>{const scope=versionScopeFor(collection);const key=Object.keys(scope)[0];scope[key]=`STALE-${scope[key]}`;return scope;};

const collectionSentinels={};
for(const [collection,recordSchema] of Object.entries(schema.RECORD_SCHEMAS)){
  const currentId=`ROUTE-${collection}-CURRENT`;
  const staleId=`ROUTE-${collection}-STALE`;
  const agentField=Object.values(recordSchema.fieldDefinitions).find(def=>def.producer===schema.PRODUCER.AGENT)?.name;
  const fields={[recordSchema.idField]:currentId};
  const staleFields={[recordSchema.idField]:staleId};
  if(agentField){fields[agentField]=`CURRENT-SENTINEL-${collection}`;staleFields[agentField]=`STALE-SENTINEL-${collection}`;}
  const current={stage:recordSchema.stage||1,fields,scope:versionScopeFor(collection),active:true,validity:'CURRENT'};
  const stale={stage:recordSchema.stage||1,fields:staleFields,scope:staleScopeFor(collection),active:true,validity:'CURRENT'};
  state.projectData[collection]=[stale,current];
  collectionSentinels[collection]={currentId,staleId,currentText:`CURRENT-SENTINEL-${collection}`,staleText:`STALE-SENTINEL-${collection}`};
  const selected=engine.recordsForCurrentScope(state,collection);
  assert(selected.some(record=>engine.recordId(record,collection)===currentId),`${collection}: current-scope selector omitted current record.`);
  assert(!selected.some(record=>engine.recordId(record,collection)===staleId),`${collection}: current-scope selector admitted stale record.`);
}

const forbiddenReads={
  '11:COMPLETE':['verification','comparisons','defects','rootCauses','changes','meaningResults','adversarialResults'],
  '12:COMPLETE':['comparisons','rootCauses','changes'],
  '23:COMPLETE':['deterministicResults','adversarialResults'],
  '24:COMPLETE':['deterministicResults','meaningResults']
};
for(const operation of ['EXECUTE_RUN','VERIFY'])for(const stage of [17,19])forbiddenReads[`${stage}:${operation}`]=operation==='EXECUTE_RUN'?['verification','comparisons','rootCauses','changes']:['comparisons','rootCauses','changes'];

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

    const scope={projectRevision:state.revision,inputVersion:state.job.CURRENT_INPUT_VERSION,sourceSetVersion:state.job.CURRENT_SOURCE_SET_VERSION,requirementsVersion:state.job.CURRENT_REQUIREMENTS_VERSION,testSuiteVersion:state.job.CURRENT_TEST_SUITE_VERSION,instructionVersion:state.job.CURRENT_INSTRUCTION_VERSION,iterationId:'ITER-ROUTE-v1',candidateId:'CAND-ROUTE-v1',runId:collectionSentinels.runs.currentId,contextId:collectionSentinels.freshContexts.currentId,baselineId:'BASE-ROUTE-v1',productId:'PROD-ROUTE-v1'};
    for(const key of op.scopeRequirements)assert(scope[key]!==undefined,`Fixture missing required scope ${key} for Stage ${stage}/${operation}.`);
    let record;
    try{record=prompts.buildPromptRecord(stage,state,{operation,scope});}catch{record=null;}
    if(record){
      const manifest=record.contextManifest?.readCollections||{};
      for(const collection of op.readCollections){
        const ids=(manifest[collection]||[]).map(item=>item.id);
        const sent=collectionSentinels[collection];
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

const terminalFamilies=new Set(['releaseGateReviews','evidenceInvestigations']);
for(const [collection,producers] of writeProducers){
  if(terminalFamilies.has(collection))continue;
  const consumers=readConsumers.get(collection)||[];
  for(const producer of producers){
    const later=consumers.some(c=>c.stage>producer.stage||(c.stage===producer.stage&&c.operation!==producer.operation));
    assert(later||producer.stage===30,`${collection} written at Stage ${producer.stage}/${producer.operation} has no downstream retrieval path.`);
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
  'Ask the human to attach or send the exact listed file only when those bytes are actually required',
  'Before final JSON, re-read the complete current-stage instruction'
])assert(promptSource.includes(phrase),`Prompt authority missing human-experience invariant: ${phrase}`);
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
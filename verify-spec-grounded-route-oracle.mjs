import fs from 'node:fs';
import vm from 'node:vm';

const assert=(value,message)=>{if(!value)throw new Error(message);};
const equalSet=(actual,expected,label)=>{
  const a=[...new Set(actual||[])].sort(),e=[...new Set(expected||[])].sort();
  assert(JSON.stringify(a)===JSON.stringify(e),`${label}: expected [${e.join(', ')}], got [${a.join(', ')}].`);
};
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
assert(core&&schema&&engine&&prompts&&ingestion,'Specification-grounded route oracle runtime failed to load.');
assert(core.STAGE_COUNT===30&&core.STAGES.length===30,'The controlling workflow must contain exactly 30 stages.');

// This oracle is intentionally independent from workflow-schema.js READ_COLLECTIONS/STAGE_COLLECTIONS.
// It is the executable specification-side ruler. Production declarations are compared to it, never used to construct it.
const READ={
1:[],2:[],3:['sources','sourceConflicts'],4:['research','candidateRequirements','sources','evidenceRecords','sourceConflicts'],5:['requirements','research','sources','sourceConflicts','evidenceRecords','candidateRequirements'],6:['requirements','requirementResolutions','artifacts','sources','research'],7:['requirements','tests','artifacts','evidenceRecords'],8:['requirements','tests','failureTests','requirementResolutions','sources','sourceConflicts'],9:['instructions','instructionTraces','requirements','tests','failureTests','requirementResolutions','sources','sourceConflicts'],10:['instructions','preflightRecords','tests','failureTests','artifacts'],11:['candidateFreezes','iterations','runs','freshContexts'],12:['runs','requirements','tests','freshContexts','sources','evidenceRecords'],13:['verification','runs','requirements','tests'],14:['defects','comparisons','verification','requirements','tests','instructions','instructionTraces','runs','candidateFreezes','failureTests','requirementResolutions','candidateRequirements','research','sources','sourceConflicts','artifacts','evidenceRecords'],15:['defects','rootCauses','comparisons','verification','runs','requirements','tests','failureTests','instructions','candidateFreezes','artifacts','evidenceRecords'],16:['defects','rootCauses','regressions','regressionExecutions','comparisons','verification','runs','requirements','requirementResolutions','candidateRequirements','research','sources','instructions','instructionTraces','tests','failureTests','candidateFreezes','artifacts','evidenceRecords','changes'],17:['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions'],18:['iterations','runs','verification','comparisons','defects','regressions','regressionExecutions','blockers','requirements','tests','rootCauses','changes'],19:['convergenceRecords','candidateFreezes','tests','regressions','regressionExecutions'],20:['confirmationRecords','candidateFreezes','iterations','artifacts'],21:['baselines','instructions','artifacts','freshContexts'],22:['products','tests','artifacts'],23:['products','requirements','tests','sources','evidenceRecords','research'],24:['products','requirements','tests','failureTests','regressions','regressionExecutions','defects','sources','evidenceRecords','research','artifacts'],25:['products','baselines','artifacts','requirements','tests','evidenceRecords'],26:['products','baselines','requirements','instructions','tests','runs','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','regressions','regressionExecutions','defects','blockers','evidenceRecords','confirmationRecords'],27:['requirements','tests','products','baselines','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','defects','blockers','regressionExecutions','evidenceRecords','confirmationRecords','regressions'],28:['releaseRecords','artifactIdentities','artifacts'],29:['sources','requirements','instructions','instructionTraces','runs','products','baselines','tests','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','regressions','regressionExecutions','releaseRecords','artifactIdentities','evidenceRecords','evidenceChains'],30:['defects','rootCauses','regressions','regressionExecutions','changes','baselines','evidenceRecords','requirements']
};
const WRITES={
1:[],2:['sources','sourceConflicts'],3:['research','candidateRequirements'],4:['requirements'],5:['requirementResolutions'],6:['tests'],7:['failureTests'],8:['instructions','instructionTraces'],9:['preflightRecords'],10:[],11:['runs'],12:['verification'],13:['comparisons'],14:['defects','rootCauses'],15:['regressions','regressionExecutions'],16:['changes'],17:['iterations','candidateFreezes','runs'],18:['convergenceRecords'],19:['iterations','runs','confirmationRecords'],20:[],21:['products'],22:['deterministicResults'],23:['meaningResults'],24:['adversarialResults'],25:['representationInspections'],26:['processAudits','productAudits'],27:['releaseGateReviews'],28:[],29:['evidenceInvestigations'],30:['defects','regressions']
};
const OP={
'17:FREEZE':{read:['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions','instructions','requirements','artifacts'],write:[]},
'17:EXECUTE_RUN':{read:['candidateFreezes','iterations','runs','freshContexts'],write:['runs']},
'17:VERIFY':{read:['runs','requirements','tests','freshContexts','sources','evidenceRecords'],write:['verification']},
'17:COMPARE':{read:['verification','runs','requirements','tests'],write:['comparisons']},
'17:ROOT_CAUSE':{read:['defects','comparisons','verification','requirements','tests','instructions','instructionTraces','runs','candidateFreezes','failureTests','requirementResolutions','candidateRequirements','research','sources','sourceConflicts','artifacts','evidenceRecords'],write:['defects','rootCauses']},
'17:REGRESSION':{read:['defects','rootCauses','comparisons','verification','runs','requirements','tests','failureTests','instructions','candidateFreezes','artifacts','evidenceRecords','regressions','regressionExecutions'],write:['regressions','regressionExecutions']},
'17:CORRECT':{read:['defects','rootCauses','regressions','regressionExecutions','comparisons','verification','runs','requirements','requirementResolutions','candidateRequirements','research','sources','instructions','instructionTraces','tests','failureTests','candidateFreezes','artifacts','evidenceRecords','changes'],write:['changes']},
'19:CONFIRM_FREEZE':{read:['convergenceRecords','candidateFreezes','iterations','requirements','tests','artifacts'],write:[]},
'19:EXECUTE_RUN':{read:['candidateFreezes','iterations','runs','freshContexts'],write:['runs']},
'19:VERIFY':{read:['runs','requirements','tests','freshContexts','sources','evidenceRecords'],write:['verification']},
'19:COMPARE':{read:['verification','runs','requirements','tests'],write:['comparisons']},
'19:REGRESSION_VERIFY':{read:['regressions','regressionExecutions','runs','tests','requirements','artifacts'],write:['regressionExecutions']},
'19:CONFIRM':{read:['runs','verification','comparisons','tests','regressions','regressionExecutions','candidateFreezes','defects','blockers','evidenceRecords','requirements'],write:['confirmationRecords']}
};
const WITHHOLD={
'11:COMPLETE':['verification','comparisons','defects','rootCauses','changes','meaningResults','adversarialResults'],
'12:COMPLETE':['comparisons','rootCauses','changes'],
'17:EXECUTE_RUN':['verification','comparisons','rootCauses','changes'],
'17:VERIFY':['comparisons','rootCauses','changes'],
'19:EXECUTE_RUN':['verification','comparisons','rootCauses','changes'],
'19:VERIFY':['comparisons','rootCauses','changes'],
'23:COMPLETE':['deterministicResults','adversarialResults'],
'24:COMPLETE':['deterministicResults','meaningResults']
};

const expectedFor=(stage,operation)=>OP[`${stage}:${operation}`]||{read:READ[stage],write:WRITES[stage]};
const state=core.createBlankState('JOB-SPEC-ROUTE-ORACLE');
Object.assign(state.job,{JOB_ID:'JOB-SPEC-ROUTE-ORACLE',JOB_TITLE:'Specification-grounded route proof',JOB_OWNER:'Operator',EXACT_USER_OBJECTIVE_VERBATIM:'Prove the complete thirty-stage canonical data route against an independent specification-side oracle.',SUPPLIED_MATERIALS_INVENTORY:'intent-spec.txt',REQUIRED_OUTPUT_FORMAT:'Controlled deliverable',DEADLINE_OR_TEMPORAL_SCOPE:'NONE',DESIRED_SOURCE_COUNT:1,KNOWN_AUTHORITATIVE_SOURCES:'NONE',AVAILABLE_TOOLS:'Authorized tools',PROHIBITED_ACTIONS:'Do not repeat captured user information.',EXPLICIT_USER_REQUIREMENTS:'Use the complete current canonical route and keep the operator experience concise.',CURRENT_INPUT_VERSION:'INPUT-ORACLE-v1',CURRENT_SOURCE_SET_VERSION:'SOURCE-ORACLE-v1',CURRENT_REQUIREMENTS_VERSION:'REQ-ORACLE-v1',CURRENT_TEST_SUITE_VERSION:'TEST-ORACLE-v1',CURRENT_INSTRUCTION_VERSION:'INST-ORACLE-v1',CURRENT_ITERATION:'ITER-ORACLE-v1',CURRENT_BASELINE_ID:'BASE-ORACLE-v1',CURRENT_PRODUCT_ID:'PROD-ORACLE-v1'});
engine.ensureShape(state);engine.recalculate(state);
const intake=prompts.intakeCoverageManifest(state);
state.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'Controlled deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify({schema:'closed-loop-stage01-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'retained as context',reason:'oracle fixture',extractedStatements:[{statementKey:`S${i+1}`,text:u.rawValueText||u.label||u.unitId,statementClass:'CONTEXT'}]}))})};
state.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};
state.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:true,SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false};
for(let stage=1;stage<30;stage++){state.stages[stage].status='COMPLETE';state.stages[stage].gate={complete:true,blocked:false,reasons:[]};}

const scopeFor=collection=>{
  const stage=Number(schema.RECORD_SCHEMAS[collection]?.stage||0),scope={inputVersion:state.job.CURRENT_INPUT_VERSION};
  if(stage>=2)scope.sourceSetVersion=state.job.CURRENT_SOURCE_SET_VERSION;
  if(stage>=4)scope.requirementsVersion=state.job.CURRENT_REQUIREMENTS_VERSION;
  if(stage>=6)scope.testSuiteVersion=state.job.CURRENT_TEST_SUITE_VERSION;
  if(stage>=8)scope.instructionVersion=state.job.CURRENT_INSTRUCTION_VERSION;
  return scope;
};
const sentinels={};
for(const [collection,def] of Object.entries(schema.RECORD_SCHEMAS)){
  const agentField=Object.values(def.fieldDefinitions).find(x=>x.producer===schema.PRODUCER.AGENT)?.name;
  const currentId=`ORACLE-${collection}-CURRENT`,staleId=`ORACLE-${collection}-STALE`;
  const currentFields={[def.idField]:currentId},staleFields={[def.idField]:staleId};
  if(agentField){currentFields[agentField]=`CURRENT-ORACLE-${collection}`;staleFields[agentField]=`STALE-ORACLE-${collection}`;}
  const current={stage:def.stage||1,fields:currentFields,scope:scopeFor(collection),active:true,validity:'CURRENT'};
  const staleScope={...scopeFor(collection)},first=Object.keys(staleScope)[0];staleScope[first]=`STALE-${staleScope[first]}`;
  const stale={stage:def.stage||1,fields:staleFields,scope:staleScope,active:true,validity:'CURRENT'};
  state.projectData[collection]=[stale,current];
  sentinels[collection]={currentId,staleId,currentText:currentFields[agentField]||currentId,staleText:staleFields[agentField]||staleId};
  const selected=engine.recordsForCurrentScope(state,collection);
  assert(selected.some(r=>engine.recordId(r,collection)===currentId),`${collection}: current-scope selector omitted the current oracle record.`);
  assert(!selected.some(r=>engine.recordId(r,collection)===staleId),`${collection}: current-scope selector admitted the stale oracle record.`);
}

const lane={projectRevision:state.revision,inputVersion:state.job.CURRENT_INPUT_VERSION,sourceSetVersion:state.job.CURRENT_SOURCE_SET_VERSION,requirementsVersion:state.job.CURRENT_REQUIREMENTS_VERSION,testSuiteVersion:state.job.CURRENT_TEST_SUITE_VERSION,instructionVersion:state.job.CURRENT_INSTRUCTION_VERSION,iterationId:'ITER-ORACLE-v1',candidateId:'CAND-ORACLE-v1',runId:sentinels.runs.currentId,contextId:sentinels.freshContexts.currentId,baselineId:'BASE-ORACLE-v1',productId:'PROD-ORACLE-v1'};
let operations=0,promptsBuilt=0,readEdges=0,writeEdges=0,withheldEdges=0;
const producers=new Map(),consumers=new Map();
for(let stage=1;stage<=30;stage++){
  const declared=schema.STAGE_CONTRACTS[stage];
  assert(declared,`Stage ${stage} has no declared contract.`);
  equalSet(declared.operations,stage===17?['FREEZE','EXECUTE_RUN','VERIFY','COMPARE','ROOT_CAUSE','REGRESSION','CORRECT']:stage===19?['CONFIRM_FREEZE','EXECUTE_RUN','VERIFY','COMPARE','REGRESSION_VERIFY','CONFIRM']:['COMPLETE'],`Stage ${stage} operation set`);
  for(const operation of declared.operations){
    operations++;
    const expected=expectedFor(stage,operation),actual=schema.operationContract(stage,operation);
    assert(actual,`Stage ${stage}/${operation} has no operation contract.`);
    equalSet(actual.readCollections,expected.read,`Stage ${stage}/${operation} read contract`);
    equalSet(actual.agentWritableCollections,expected.write,`Stage ${stage}/${operation} write contract`);
    for(const c of expected.read){readEdges++;if(!consumers.has(c))consumers.set(c,[]);consumers.get(c).push({stage,operation});}
    for(const c of expected.write){writeEdges++;if(!producers.has(c))producers.set(c,[]);producers.get(c).push({stage,operation});}
    for(const blocked of WITHHOLD[`${stage}:${operation}`]||[]){withheldEdges++;assert(!expected.read.includes(blocked),`Specification oracle contradicts itself: Stage ${stage}/${operation} both reads and withholds ${blocked}.`);}

    let record;
    try{record=prompts.buildPromptRecord(stage,state,{operation,scope:lane});}
    catch(error){throw new Error(`Stage ${stage}/${operation} prompt generation failed under the route oracle: ${error?.message||error}`);}
    assert(record?.prompt&&record?.contextManifest,`Stage ${stage}/${operation} did not produce a complete prompt record.`);promptsBuilt++;
    const manifest=record.contextManifest.readCollections||{};
    for(const collection of expected.read){
      const ids=(manifest[collection]||[]).map(x=>x.id),s=sentinels[collection];
      assert(ids.includes(s.currentId),`Stage ${stage}/${operation} prompt manifest omitted current ${collection}.`);
      assert(!ids.includes(s.staleId),`Stage ${stage}/${operation} prompt manifest leaked stale ${collection}.`);
      assert(record.prompt.includes(s.currentText)||record.prompt.includes(s.currentId),`Stage ${stage}/${operation} prompt body omitted current ${collection}.`);
      assert(!record.prompt.includes(s.staleText)&&!record.prompt.includes(s.staleId),`Stage ${stage}/${operation} prompt body leaked stale ${collection}.`);
    }
    for(const collection of WITHHOLD[`${stage}:${operation}`]||[]){const s=sentinels[collection];assert(!record.prompt.includes(s.currentText)&&!record.prompt.includes(s.currentId),`Stage ${stage}/${operation} leaked specifically withheld ${collection}.`);}
    for(const collection of expected.write){
      assert(record.prompt.includes(collection),`Stage ${stage}/${operation} omitted writable collection ${collection} from the response contract.`);
      for(const field of schema.recordAgentFields(collection))assert(record.prompt.includes(field),`Stage ${stage}/${operation} omitted legitimate returned field ${collection}.${field}.`);
    }
    for(const field of actual.allowedStageData)assert(record.prompt.includes(field),`Stage ${stage}/${operation} omitted legitimate returned stageData field ${field}.`);
    for(const phrase of ['CONVERSATION PRECEDENCE — HUMAN EXPERIENCE IS PART OF EXECUTION','ask the human directly in concise plain language','The human supplies project information once','Before final JSON, re-read the complete current-stage instruction'])assert(record.prompt.includes(phrase),`Stage ${stage}/${operation} prompt omitted the human-experience rule: ${phrase}`);
    const action=engine.operationalNextAction(state,stage);
    assert(action&&typeof action==='object',`Stage ${stage} has no structured next action.`);
    for(const key of ['actionType','heading','explanation','primaryButton','filesToSend','filesToWithhold','expectedReturnFiles','canonicalStateChanged','newPromptRequired'])assert(Object.prototype.hasOwnProperty.call(action,key),`Stage ${stage} next action omitted ${key}.`);
    assert(Array.isArray(action.operatorChecks)&&action.operatorChecks.length>0,`Stage ${stage} gives the operator no double-check guidance.`);
  }
}

const terminal=new Set(['releaseGateReviews','evidenceInvestigations']);
for(const [collection,writers] of producers){
  if(terminal.has(collection))continue;
  const readers=consumers.get(collection)||[];
  for(const writer of writers){
    const later=readers.some(r=>r.stage>writer.stage||(r.stage===writer.stage&&r.operation!==writer.operation));
    assert(later||writer.stage===30,`${collection} is written by Stage ${writer.stage}/${writer.operation} but the specification oracle has no later retrieval path.`);
  }
}

// Infrastructure families are cross-stage canonical transport, not stage record families.
for(const family of ['rawResponses','responseValidations','responseProposals','outputReceipts','extractionManifests','generatedPrompts','promptContextManifests','acceptedChanges'])assert(Array.isArray(state.projectData[family]),`Infrastructure family ${family} is missing from canonical project state.`);

// Stage 01 file-custody experience: a declared required file must result in truthful transfer guidance, not a claim of automatic access.
const stage1=prompts.buildPromptRecord(1,state,{operation:'COMPLETE',scope:lane});
assert(stage1.prompt.includes('If this prompt lists files that you must receive, do not pretend you received or inspected them'),'Stage 01 does not tell the agent to fail honestly when required bytes were not transferred.');
assert(stage1.prompt.includes('Ask the human to attach or send the exact listed file only when those bytes are actually required'),'Stage 01 does not give the required polite missing-file recovery behavior.');

// The full ingestion executable remains part of the fixed ruler; this oracle ensures CI cannot omit it while claiming route closure.
const workflowSource=fs.readFileSync('.github/workflows/pages.yml','utf8');
assert(workflowSource.includes('node verify-ingestion.mjs'),'CI no longer executes the raw-first ingestion proof.');
assert(workflowSource.includes('node verify-human-stage-walkthrough.mjs'),'CI no longer executes the human operator experience proof.');

console.log(JSON.stringify({specGroundedRouteOracle:'PASS',stages:30,operations,promptsBuilt,readEdges,writeEdges,withheldEdges,currentScopeSelectors:true,independentReadWriteOracle:true,withheldContextOracle:true,promptGenerationCannotSilentlySkip:true,downstreamForwardingOracle:true,operatorDoubleCheckGuidance:true,humanExperiencePromptContract:true,infrastructureFamiliesPresent:true},null,2));

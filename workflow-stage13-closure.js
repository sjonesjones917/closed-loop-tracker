(()=>{
'use strict';

const prior=globalThis.closedLoopWorkflowEngine;
const schema=globalThis.closedLoopWorkflowSchema;
const hash=globalThis.closedLoopHash;
if(!prior||!schema||!hash)throw new Error('workflow-engine.js, workflow-schema.js, and hash.js must load before workflow-stage13-closure.js.');

const VERSION='closed-loop-stage13-cross-run-closure/1';
const safe=value=>Array.isArray(value)?value:[];
const up=value=>String(value==null?'':value).trim().toUpperCase();
const fv=(record,key)=>prior.recordValue(record,key);
const rid=(record,collection)=>prior.recordId(record,collection);
const list=value=>{
  if(Array.isArray(value))return value.map(String).map(x=>x.trim()).filter(Boolean);
  if(value==null||value==='')return [];
  if(typeof value==='string'){
    try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parsed.map(String).map(x=>x.trim()).filter(Boolean);}catch{}
    return value.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
  }
  return [String(value)];
};
const nonempty=value=>{
  const text=up(value);
  return Boolean(text)&&!['UNKNOWN','UNDETERMINED','PENDING','NOT RECORDED','NOT_RECORDED'].includes(text);
};
const parseBoolean=value=>{
  if(value===true)return 'TRUE';
  if(value===false)return 'FALSE';
  const text=up(value);
  if(['TRUE','YES','AUTHORIZED','ALLOWED','ACCEPTED'].includes(text))return 'TRUE';
  if(['FALSE','NO','PROHIBITED','UNAUTHORIZED','REJECTED'].includes(text))return 'FALSE';
  return 'UNKNOWN';
};
const varianceState=value=>{
  if(value==null||value==='')return 'UNKNOWN';
  if(typeof value==='object')return Object.keys(value).length?'PRESENT':'NONE';
  const text=up(value);
  if(!text||['UNKNOWN','UNDETERMINED','PENDING','NOT RECORDED','NOT_RECORDED'].includes(text))return 'UNKNOWN';
  if(['NONE','NO','FALSE','NOT APPLICABLE','NOT_APPLICABLE','N/A','NA','NO VARIANCE','NO_VARIANCE'].includes(text))return 'NONE';
  return 'PRESENT';
};
const isObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length>0;
const tupleKey=(reqId,runId,testId)=>[String(reqId),String(runId),String(testId)].join('|');
const iteration=project=>prior.records(project,'iterations').filter(record=>Number(record.stage)===10&&record.active!==false&&!record.invalidatedBy).at(-1)||null;
const currentIterationId=project=>rid(iteration(project),'iterations');
const stage13Comparisons=(project,iterationId)=>iterationId?prior.recordsForIteration(project,'comparisons',iterationId):[];
const verificationRows=(project,iterationId)=>iterationId?prior.recordsForIteration(project,'verification',iterationId):[];
const currentTests=project=>prior.recordsForCurrentScope(project,'tests');
const currentRequirements=project=>prior.recordsForCurrentScope(project,'requirements');
const evidenceRefs=record=>{
  const direct=[...safe(record?.evidenceRefs),...safe(record?.evidenceIds),...safe(fv(record,'EVIDENCE_IDS')),...safe(fv(record,'EVIDENCE_REFS'))];
  return [...new Set(direct.map(String).filter(Boolean))].sort(hash.compareUnicodeScalarSequence);
};
function contractForTest(test){
  const value=fv(test,'EXPECTED_VARIANCE_CONTRACT');
  if(!isObject(value))return {valid:false,reason:`Test ${rid(test,'tests')||'UNKNOWN'} lacks a frozen EXPECTED_VARIANCE_CONTRACT object.`,contract:null,sha256:null};
  return {valid:true,reason:'FROZEN_TEST_CONTRACT',contract:value,sha256:hash.sha256Value(value)};
}
function effective(project,verification){
  const testId=String(fv(verification,'TEST_ID')||verification?.relationships?.TEST_ID||'');
  const test=currentTests(project).find(item=>rid(item,'tests')===testId)||null;
  return prior.effectiveDetermination('verification',verification,test,project);
}
function crossRunModel(project){
  prior.ensureShape(project);
  const iterationId=currentIterationId(project),reasons=[];
  if(!iterationId)reasons.push('Stage 13 requires one current Stage 10 frozen iteration.');
  const relation=prior.deriveRequiredVerificationRelationSet(project);
  for(const blocker of safe(relation?.timingBlockers))reasons.push(`Verification timing is unresolved for ${blocker.TEST_ID||'UNKNOWN'}: ${safe(blocker.reasons).join(' ')||'UNKNOWN timing state'}.`);
  const tuples=safe(relation?.tuples).filter(tuple=>String(tuple.REQ_ID||'')&&String(tuple.RUN_ID||'')&&String(tuple.TEST_ID||''));
  if(!tuples.length)reasons.push('No due PER_RUN_REQUIRED mandatory proposition verification tuples are established for Stage 13.');
  const runIds=[...new Set(tuples.map(tuple=>String(tuple.RUN_ID)))].sort(hash.compareUnicodeScalarSequence);
  if(runIds.length!==10)reasons.push(`Stage 13 requires exactly ten current run identities; found ${runIds.length}.`);
  const expected=new Map();
  for(const tuple of tuples){
    const key=tupleKey(tuple.REQ_ID,tuple.RUN_ID,tuple.TEST_ID);
    if(expected.has(key))reasons.push(`Required verification relation is duplicated for ${key}.`);
    expected.set(key,tuple);
  }
  const rows=verificationRows(project,iterationId),byKey=new Map();
  for(const row of rows){
    const key=tupleKey(fv(row,'REQ_ID')||row?.relationships?.REQ_ID,fv(row,'RUN_ID')||row?.relationships?.RUN_ID,fv(row,'TEST_ID')||row?.relationships?.TEST_ID);
    if(!byKey.has(key))byKey.set(key,[]);
    byKey.get(key).push(row);
  }
  for(const key of expected.keys()){
    const count=safe(byKey.get(key)).length;
    if(count!==1)reasons.push(`Exactly one current verification record is required for ${key}; found ${count}.`);
  }
  const dueTestIds=[...new Set(tuples.map(tuple=>String(tuple.TEST_ID)))].sort(hash.compareUnicodeScalarSequence),contracts={};
  for(const testId of dueTestIds){
    const test=currentTests(project).find(item=>rid(item,'tests')===testId),contract=contractForTest(test);
    contracts[testId]=contract;
    if(!contract.valid)reasons.push(contract.reason);
  }
  const grouped=new Map();
  for(const tuple of tuples){
    const reqId=String(tuple.REQ_ID),propositionId=String(tuple.PROPOSITION_ID||''),groupKey=[reqId,propositionId].join('|');
    if(!grouped.has(groupKey))grouped.set(groupKey,{REQ_ID:reqId,PROPOSITION_ID:propositionId,tuples:[]});
    grouped.get(groupKey).tuples.push(tuple);
  }
  const facts={};
  for(const group of grouped.values()){
    const determinations=[],verificationIds=[],allEvidenceIds=new Set(),contractHashes=new Set(),perRun={};
    for(const tuple of group.tuples){
      const key=tupleKey(tuple.REQ_ID,tuple.RUN_ID,tuple.TEST_ID),matches=safe(byKey.get(key)),row=matches.length===1?matches[0]:null,determination=row?effective(project,row):'UNDETERMINED';
      determinations.push(determination);
      if(row){verificationIds.push(rid(row,'verification'));for(const id of evidenceRefs(row))allEvidenceIds.add(id);}
      const contract=contracts[String(tuple.TEST_ID)];if(contract?.sha256)contractHashes.add(contract.sha256);
      const runId=String(tuple.RUN_ID);if(!perRun[runId])perRun[runId]=[];perRun[runId].push({testId:String(tuple.TEST_ID),verificationId:row?rid(row,'verification'):'',determination});
    }
    const runDeterminations={};
    for(const runId of Object.keys(perRun).sort(hash.compareUnicodeScalarSequence)){
      const values=perRun[runId].map(item=>item.determination);
      runDeterminations[runId]=values.some(value=>value==='VIOLATED')?'VIOLATED':values.some(value=>value!=='SATISFIED')?'UNDETERMINED':'SATISFIED';
    }
    const values=Object.values(runDeterminations),allTenSatisfied=runIds.length===10&&values.length===10&&values.every(value=>value==='SATISFIED'),anyViolation=values.some(value=>value==='VIOLATED'),anyUndetermined=values.some(value=>value==='UNDETERMINED');
    facts[group.REQ_ID]={REQ_ID:group.REQ_ID,PROPOSITION_ID:group.PROPOSITION_ID,RUN_IDS:runIds,RUN_DETERMINATIONS:runDeterminations,ALL_TEN_SATISFIED:allTenSatisfied,ANY_VIOLATION:anyViolation,ANY_UNDETERMINED:anyUndetermined,SATISFIED_COUNT:values.filter(value=>value==='SATISFIED').length,VIOLATED_COUNT:values.filter(value=>value==='VIOLATED').length,UNDETERMINED_COUNT:values.filter(value=>value==='UNDETERMINED').length,VERIFICATION_IDS:verificationIds.filter(Boolean).sort(hash.compareUnicodeScalarSequence),EVIDENCE_IDS:[...allEvidenceIds].sort(hash.compareUnicodeScalarSequence),EXPECTED_VARIANCE_CONTRACT_SHA256:[...contractHashes].sort(hash.compareUnicodeScalarSequence)};
  }
  const comparisons=stage13Comparisons(project,iterationId),comparisonsByReq=new Map();
  for(const record of comparisons){const reqId=String(fv(record,'REQ_ID')||record?.relationships?.REQ_ID||'');if(!comparisonsByReq.has(reqId))comparisonsByReq.set(reqId,[]);comparisonsByReq.get(reqId).push(record);}
  const dueReqIds=Object.keys(facts).sort(hash.compareUnicodeScalarSequence);
  for(const reqId of dueReqIds){
    const count=safe(comparisonsByReq.get(reqId)).length;
    if(count!==1)reasons.push(`Exactly one Stage 13 comparison is required for due requirement ${reqId}; found ${count}.`);
  }
  const comparisonAnalysis={};
  for(const reqId of dueReqIds){
    const record=safe(comparisonsByReq.get(reqId))[0];if(!record)continue;
    const interpretationVariance=varianceState(fv(record,'INTERPRETATION_VARIANCE')),outputVariance=varianceState(fv(record,'OUTPUT_VARIANCE')),authorized=parseBoolean(fv(record,'AUTHORIZED_VARIANCE')),correctness=parseBoolean(fv(record,'CORRECTNESS_AFFECTING_VARIANCE')),defectIds=list(fv(record,'DEFECT_IDS')).filter(id=>!['NONE','NOT APPLICABLE','NOT_APPLICABLE','N/A','NA'].includes(up(id))),evidence=String(fv(record,'EVIDENCE')||'').trim();
    if(interpretationVariance==='UNKNOWN')reasons.push(`Comparison ${rid(record,'comparisons')} has UNKNOWN interpretation variance.`);
    if(outputVariance==='UNKNOWN')reasons.push(`Comparison ${rid(record,'comparisons')} has UNKNOWN output variance.`);
    if(authorized==='UNKNOWN')reasons.push(`Comparison ${rid(record,'comparisons')} has UNKNOWN variance authorization.`);
    if(correctness==='UNKNOWN')reasons.push(`Comparison ${rid(record,'comparisons')} has UNKNOWN correctness-affecting variance state.`);
    if(!nonempty(fv(record,'INCONCLUSIVE_TESTS')))reasons.push(`Comparison ${rid(record,'comparisons')} does not conclusively classify inconclusive tests.`);
    if(!nonempty(fv(record,'REPEATED_FAILURE_PATTERNS')))reasons.push(`Comparison ${rid(record,'comparisons')} does not classify repeated failure patterns.`);
    if(!nonempty(fv(record,'UNIQUE_FAILURES')))reasons.push(`Comparison ${rid(record,'comparisons')} does not classify unique failures.`);
    if(!evidence||up(evidence)==='UNKNOWN')reasons.push(`Comparison ${rid(record,'comparisons')} lacks current comparison evidence.`);
    const prohibited=(interpretationVariance==='PRESENT'||outputVariance==='PRESENT')&&authorized==='FALSE';
    const defectRequired=prohibited||correctness==='TRUE';
    if(defectRequired&&!defectIds.length)reasons.push(`Comparison ${rid(record,'comparisons')} has prohibited or correctness-affecting variance without a DEFECT_IDS handoff to Stage 14.`);
    if(facts[reqId]?.ANY_UNDETERMINED)reasons.push(`Due requirement ${reqId} contains an application-derived UNDETERMINED run determination.`);
    comparisonAnalysis[reqId]={comparisonId:rid(record,'comparisons'),interpretationVariance,outputVariance,authorizedVariance:authorized,correctnessAffectingVariance:correctness,prohibited,defectRequired,defectIds};
  }
  const model={version:VERSION,iterationId,relationSetId:String(relation?.id||''),runIds,requiredTupleCount:expected.size,verificationCount:rows.length,dueRequirementIds:dueReqIds,contracts:Object.fromEntries(Object.entries(contracts).map(([id,value])=>[id,value?.sha256||null])),facts,comparisonAnalysis,reasons:[...new Set(reasons)]};
  model.comparisonVersion='COMPARISON-'+hash.sha256Value({iterationId:model.iterationId,relationSetId:model.relationSetId,runIds:model.runIds,contracts:model.contracts,facts:model.facts}).slice(0,16).toUpperCase();
  return model;
}
function syncComparisonApplicationFields(project,model){
  for(const [reqId,fact] of Object.entries(model.facts)){
    const records=stage13Comparisons(project,model.iterationId).filter(record=>String(fv(record,'REQ_ID')||record?.relationships?.REQ_ID||'')===reqId);
    if(records.length!==1)continue;
    const record=records[0];record.fields=record.fields&&typeof record.fields==='object'?record.fields:{};
    for(const [key,value] of Object.entries({ALL_TEN_SATISFIED:fact.ALL_TEN_SATISFIED,ANY_VIOLATION:fact.ANY_VIOLATION,ANY_UNDETERMINED:fact.ANY_UNDETERMINED})){
      record.fields[key]=value;record[key]=value;
    }
    record.applicationDerivedComparison={comparisonVersion:model.comparisonVersion,relationSetId:model.relationSetId,requiredRunIds:model.runIds,requiredTupleCount:model.requiredTupleCount,fact};
    prior.refreshRecordHashes(record,'comparisons');
  }
}
const LEGACY_STAGE13_REASON=/^(?:Cross-run comparison is missing for:|Exactly one comparison record is required for |Derived comparison contains a violation for |Derived comparison contains an undetermined result for )/;
function gate(stageOrProject,projectOrStage){
  const stage=typeof stageOrProject==='number'?Number(stageOrProject):Number(projectOrStage),project=typeof stageOrProject==='number'?projectOrStage:stageOrProject;
  if(stage!==13)return prior.gate(stage,project);
  const base=prior.gate(13,project),model=crossRunModel(project);syncComparisonApplicationFields(project,model);
  const reasons=[...safe(base.reasons).filter(reason=>!LEGACY_STAGE13_REASON.test(String(reason))),...model.reasons];
  const unique=[...new Set(reasons)];
  return {...base,complete:unique.length===0,blocked:Boolean(base.blocked&&safe(base.reasons).some(reason=>!LEGACY_STAGE13_REASON.test(String(reason))))||unique.some(reason=>/UNKNOWN|UNDETERMINED|missing|lacks|without|requires exactly|found 0|unresolved/i.test(String(reason))),reasons:unique,crossRunComparison:model};
}
function deriveStageData(project,stage){
  if(Number(stage)!==13)return prior.deriveStageData(project,stage);
  const model=crossRunModel(project);syncComparisonApplicationFields(project,model);const comparisons=stage13Comparisons(project,model.iterationId),stability=model.iterationId?prior.executionStability(project,model.iterationId):{repeatedDefectCount:0,uniqueDefectCount:0};
  return {ITERATION_ID:model.iterationId||'NONE',COMPARISON_VERSION:model.comparisonVersion,REQUIREMENT_COMPARISON_RECORDS:comparisons.length,REQUIREMENTS_SATISFIED_BY_ALL_TEN:model.dueRequirementIds.filter(id=>model.facts[id]?.ALL_TEN_SATISFIED),REQUIREMENTS_WITH_AT_LEAST_ONE_VIOLATION:model.dueRequirementIds.filter(id=>model.facts[id]?.ANY_VIOLATION),REQUIREMENTS_WITH_AT_LEAST_ONE_UNDETERMINED:model.dueRequirementIds.filter(id=>model.facts[id]?.ANY_UNDETERMINED),CORRECTNESS_AFFECTING_DISAGREEMENTS:Object.values(model.comparisonAnalysis).filter(item=>item.correctnessAffectingVariance==='TRUE').map(item=>item.comparisonId),PROHIBITED_OUTPUT_VARIANCES:Object.values(model.comparisonAnalysis).filter(item=>item.outputVariance==='PRESENT'&&item.authorizedVariance==='FALSE').map(item=>item.comparisonId),INCONCLUSIVE_TESTS:model.dueRequirementIds.filter(id=>model.facts[id]?.ANY_UNDETERMINED),REPEATED_FAILURE_GROUPS:stability.repeatedDefectCount||0,UNIQUE_FAILURES:stability.uniqueDefectCount||0,APPLICATION_DERIVED_COMPARISON_FACTS:model.facts,EXPECTED_VARIANCE_CONTRACT_HASHES:model.contracts,REQUIRED_VERIFICATION_RELATION_SET_ID:model.relationSetId,REQUIRED_VERIFICATION_TUPLE_COUNT:model.requiredTupleCount,STABILITY_SUMMARY:stability};
}
function applyStatus(project,stage,result){
  const state=project.stages[stage];state.gate=result;
  if(result.blocked)state.status='BLOCKED';else if(result.complete)state.status='COMPLETE';else if(prior.hasStageActivity(project,stage))state.status='IN PROGRESS';else state.status='READY';
  state.decision=state.status==='COMPLETE'?'READY TO PROCEED':state.status==='BLOCKED'?'BLOCKED':'';
  state.decisionEvidence=result.reasons.length?result.reasons.join('; '):'Derived canonical stage gate satisfied.';
  return state.status==='COMPLETE';
}
function recalculate(project){
  prior.recalculate(project);prior.ensureShape(project);
  if(project.stages[12].status!=='COMPLETE')return project;
  const stage13=gate(13,project);applyStatus(project,13,stage13);project.stages[13].derivedData={...(project.stages[13].derivedData||{}),...deriveStageData(project,13)};
  let previousComplete=project.stages[13].status==='COMPLETE';
  for(let stage=14;stage<=30;stage++){
    const state=project.stages[stage];
    if(!previousComplete){const prerequisite=`Stage ${String(stage-1).padStart(2,'0')} is not complete.`;state.status='NOT STARTED';state.gate={complete:false,blocked:false,reasons:[prerequisite]};state.decision='';state.decisionEvidence=prerequisite;previousComplete=false;continue;}
    const result=prior.gate(stage,project);previousComplete=applyStatus(project,stage,result);state.derivedData={...(state.derivedData||{}),...prior.deriveStageData(project,stage)};
  }
  const first=Object.values(project.stages).find(state=>state.status!=='COMPLETE'),currentStage=first?Number(first.number):30;project.job.CURRENT_STAGE=`STAGE ${String(currentStage).padStart(2,'0')}`;
  if(project.job.CURRENT_STATE==='BLOCKED'&&project.stages[currentStage].status!=='BLOCKED'&&!prior.openBlockers(project).length)project.job.CURRENT_STATE='READY_FOR_NEXT_OPERATION';
  project.job.NEXT_REQUIRED_ACTION=Object.values(project.stages).every(state=>state.status==='COMPLETE')?project.job.NEXT_REQUIRED_ACTION:prior.operationalNextAction(project,currentStage);
  return project;
}

const engine=Object.freeze({...prior,version:'closed-loop-workflow-engine/3-stage13-closure',__stage13CrossRunClosureVersion:VERSION,evaluateCrossRunComparison:crossRunModel,gate,deriveStageData,recalculate});
globalThis.closedLoopWorkflowEngine=engine;
})();

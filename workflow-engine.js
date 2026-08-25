(()=>{
'use strict';

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const hash=globalThis.closedLoopHash;
if(!core||!schema||!hash)throw new Error('workbook.js, hash.js, and workflow-schema.js must load before workflow-engine.js.');

const STAGE_STATES=Object.freeze(['NOT STARTED','IN PROGRESS','BLOCKED','READY','COMPLETE']);
const FORMAL_STATES=Object.freeze(['UNKNOWN','NONE','NOT APPLICABLE','TRUE','FALSE','SATISFIED','VIOLATED','UNDETERMINED','ACCEPTED','REJECTED','BLOCKED']);
const INFRA_COLLECTIONS=Object.freeze([
  'inputVersions','rawResponses','responseProposals','responseValidations','acceptedChanges','rejectedResponses','extractionManifests',
  'humanInputRequests','humanInputAnswers','stageConfirmations','artifactVersions','generatedPrompts','generatedOutputs','outputReceipts',
  'history','newJobResets','reviews','recoveredProjects'
]);
const ALL_COLLECTIONS=Object.freeze([...new Set([...Object.keys(schema.RECORD_SCHEMAS),...INFRA_COLLECTIONS])]);

const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const now=()=>new Date().toISOString();
const safe=value=>Array.isArray(value)?value:[];
const upper=value=>String(value??'').trim().toUpperCase();
const truth=value=>['TRUE','YES','SATISFIED','ACCEPTED','AUTHORIZED','CONFIRMED','CONVERGED','COMPLETE','SUCCESS','SUCCEEDED','EFFECTIVE'].includes(upper(value));
const falsey=value=>['FALSE','NO','NONE','0','NOT APPLICABLE'].includes(upper(value));
const numeric=value=>{const parsed=Number(String(value??'').replace(/[^0-9.-]/g,''));return Number.isFinite(parsed)?parsed:0;};
const recordFields=record=>record?.fields&&typeof record.fields==='object'?record.fields:record||{};
const recordValue=(record,key)=>recordFields(record)?.[key]??record?.[key];
const recordId=(record,collection)=>{
  const idField=schema.RECORD_SCHEMAS[collection]?.idField;
  return String(record?.id||record?.recordId||(idField?recordValue(record,idField):'')||'').trim();
};
const isActiveRecord=record=>record?.active!==false&&!record?.invalidatedBy&&!['RETIRED','INVALIDATED','SUPERSEDED'].includes(upper(recordValue(record,'STATUS')||record?.validity));
const records=(project,collection,{stage,active=true}={})=>safe(project?.projectData?.[collection]).filter(record=>(stage===undefined||Number(record?.stage)===Number(stage))&&(!active||isActiveRecord(record)));

function ensureShape(project){
  if(!project||typeof project!=='object')throw new TypeError('Project must be an object.');
  project.projectData=project.projectData&&typeof project.projectData==='object'?project.projectData:{};
  for(const collection of ALL_COLLECTIONS)project.projectData[collection]=safe(project.projectData[collection]);
  project.projectData.permanentRegistry=project.projectData.permanentRegistry&&typeof project.projectData.permanentRegistry==='object'?project.projectData.permanentRegistry:{};
  project.projectData.stageRecords=project.projectData.stageRecords&&typeof project.projectData.stageRecords==='object'?project.projectData.stageRecords:{};
  project.projectData.userEntered=project.projectData.userEntered&&typeof project.projectData.userEntered==='object'?project.projectData.userEntered:{};
  project.projectData.idCounters=project.projectData.idCounters&&typeof project.projectData.idCounters==='object'?project.projectData.idCounters:{};
  project.stages=project.stages&&typeof project.stages==='object'?project.stages:{};
  for(let stage=1;stage<=30;stage++){
    const prior=project.stages[stage]||project.stages[String(stage)]||{};
    project.stages[stage]={
      number:stage,status:'NOT STARTED',decision:'',decisionEvidence:'',nextStage:'',decidedBy:'',dateTime:'',
      draftRecord:prior.draftRecord||core.stageTemplate(core.STAGES[stage-1]),responseDraft:'',authorizedFiles:[],humanChecks:{},gateChecks:{},evidenceChecks:{},revisions:[],
      acceptedData:{},humanData:{},acceptedResponseIds:[],gate:{complete:false,blocked:false,reasons:[]},invalidatedBy:null,
      ...prior,
      number:stage,
      authorizedFiles:safe(prior.authorizedFiles),revisions:safe(prior.revisions),acceptedData:prior.acceptedData&&typeof prior.acceptedData==='object'?prior.acceptedData:{},humanData:prior.humanData&&typeof prior.humanData==='object'?prior.humanData:{},acceptedResponseIds:safe(prior.acceptedResponseIds)
    };
  }
  project.job=project.job&&typeof project.job==='object'?project.job:{};
  project.release={gateState:'',auditedDraft:[],releaseDraft:[],comparisons:[],authorization:'NOT AUTHORIZED',authorizedArtifactIds:[],...(project.release||{})};
  for(const name of ['auditedDraft','releaseDraft','comparisons','authorizedArtifactIds'])project.release[name]=safe(project.release[name]);
  return project;
}

function addHistory(project,type,details={}){
  ensureShape(project);
  const event={eventId:`EVENT-${String(project.projectData.history.length+1).padStart(6,'0')}`,createdAt:now(),type,...clone(details)};
  project.projectData.history.push(event);
  return event;
}

function existingIds(project,collection){return new Set(records(project,collection,{active:false}).map(record=>recordId(record,collection)).filter(Boolean));}
function allocateId(project,collection){
  ensureShape(project);
  const definition=schema.RECORD_SCHEMAS[collection];
  if(!definition)throw new Error(`Unknown canonical collection: ${collection}.`);
  const existing=existingIds(project,collection);
  let counter=Math.max(0,Number(project.projectData.idCounters[collection]||0));
  let candidate='';
  do{counter+=1;candidate=`${definition.prefix}-${String(counter).padStart(6,'0')}`;}while(existing.has(candidate));
  project.projectData.idCounters[collection]=counter;
  return candidate;
}
function allocateInfrastructureId(project,prefix,collection){
  ensureShape(project);
  const key=`infra:${collection}:${prefix}`;
  let counter=Math.max(0,Number(project.projectData.idCounters[key]||0));
  const existing=new Set(safe(project.projectData[collection]).map(record=>String(record?.id||record?.rawResponseId||record?.proposalId||record?.validationId||record?.changeId||record?.manifestId||record?.receiptId||record?.promptId||'')).filter(Boolean));
  let candidate='';
  do{counter+=1;candidate=`${prefix}-${String(counter).padStart(6,'0')}`;}while(existing.has(candidate));
  project.projectData.idCounters[key]=counter;
  return candidate;
}

function nextVersion(current,prefix){
  const match=String(current||'').match(/v(\d+)$/i);
  const number=match?Number(match[1])+1:1;
  return `${prefix}-v${String(number).padStart(3,'0')}`;
}
const VERSION_BY_STAGE=Object.freeze({
  1:['CURRENT_INPUT_VERSION','INPUT'],2:['CURRENT_SOURCE_SET_VERSION','SOURCE-SET'],3:['CURRENT_RESEARCH_VERSION','RESEARCH'],
  4:['CURRENT_REQUIREMENTS_VERSION','REQUIREMENTS'],5:['CURRENT_REQUIREMENTS_VERSION','REQUIREMENTS'],6:['CURRENT_TEST_SUITE_VERSION','TEST-SUITE'],
  7:['CURRENT_MUTATION_SUITE_VERSION','MUTATION-SUITE'],8:['CURRENT_INSTRUCTION_VERSION','INSTRUCTION']
});
function versionCollections(stage){return schema.STAGE_CONTRACTS[stage]?.primaryCollections||[];}
function registerStageVersion(project,stage,acceptedChangeId){
  ensureShape(project);
  const config=VERSION_BY_STAGE[stage];
  if(!config)return null;
  const [jobField,prefix]=config;
  const payload={stage,collections:Object.fromEntries(versionCollections(stage).map(collection=>[collection,records(project,collection).map(record=>({id:recordId(record,collection),fields:recordFields(record),relationships:record.relationships||{},sha256:record.sha256||null}))])),acceptedData:project.stages[stage].acceptedData};
  const sha256=hash.sha256Value(payload);
  const latest=safe(project.projectData.artifactVersions).filter(item=>item.stage===stage&&item.kind===prefix).at(-1);
  if(latest?.sha256===sha256){project.job[jobField]=latest.version;return latest;}
  const version=nextVersion(project.job[jobField],prefix);
  const record={versionId:allocateInfrastructureId(project,'VERSION','artifactVersions'),stage,kind:prefix,version,sha256,createdAt:now(),acceptedChangeId,payload};
  project.projectData.artifactVersions.push(record);
  project.job[jobField]=version;
  return record;
}

function unresolvedHumanRequests(project,stage){return safe(project?.projectData?.humanInputRequests).filter(request=>Number(request.stage)===Number(stage)&&upper(request.status||'OPEN')==='OPEN'&&request.blocking!==false);}
function openBlockers(project,stage){
  return records(project,'blockers').filter(blocker=>{
    const status=upper(recordValue(blocker,'STATUS')||blocker.status||'OPEN');
    if(!['OPEN','BLOCKED','IN PROGRESS','UNKNOWN'].includes(status))return false;
    if(stage===undefined)return true;
    const blockerStage=Number(blocker.stage||recordValue(blocker,'STAGE_DISCOVERED')||0);
    if(blockerStage===Number(stage))return true;
    const affected=String(recordValue(blocker,'AFFECTED_ARTIFACTS')||recordValue(blocker,'DOWNSTREAM_WORK_STOPPED')||'');
    return new RegExp(`(?:STAGE\\s*0?${stage}\\b|\\b${stage}\\b)`,`i`).test(affected);
  });
}
function acceptedChanges(project,stage){return safe(project?.projectData?.acceptedChanges).filter(change=>Number(change.stage)===Number(stage)&&change.status==='COMMITTED'&&!change.invalidatedBy);}
function hasStageActivity(project,stage){
  if(acceptedChanges(project,stage).length)return true;
  if(safe(project?.projectData?.rawResponses).some(item=>Number(item.stage)===Number(stage)))return true;
  if(unresolvedHumanRequests(project,stage).length)return true;
  if((schema.STAGE_CONTRACTS[stage]?.allowedCollections||[]).some(collection=>records(project,collection,{stage}).length))return true;
  return Boolean(Object.keys(project?.stages?.[stage]?.acceptedData||{}).length);
}
function latestIteration(project,stages=[10,17,19]){
  const candidates=records(project,'iterations').filter(record=>stages.includes(Number(record.stage)));
  return candidates.at(-1)||null;
}
function mandatoryRequirements(project){
  return records(project,'requirements').filter(record=>{
    const value=upper(recordValue(record,'MANDATORY_OPTIONAL_STATUS')||recordValue(record,'MANDATORY')||'MANDATORY');
    return value!=='OPTIONAL'&&value!=='FALSE'&&value!=='NO';
  });
}
function confirmedDefects(project){
  return records(project,'defects').filter(record=>{
    const status=upper(recordValue(record,'STATUS')||'CONFIRMED');
    return !['REJECTED','DUPLICATE','NOT A DEFECT','RETIRED'].includes(status);
  });
}
function unresolvedMaterialDefects(project){
  return confirmedDefects(project).filter(record=>{
    const severity=upper(recordValue(record,'SEVERITY'));
    const status=upper(recordValue(record,'STATUS'));
    return ['CRITICAL','MAJOR'].includes(severity)&&!['CLOSED','CLOSED VERIFIED','CLOSED_VERIFIED','RESOLVED','CORRECTED AND VERIFIED','RETIRED'].includes(status);
  });
}
function requirementId(record){return recordId(record,'requirements');}
function testRequirementId(record){return String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'');}
function runIterationId(record){return String(recordValue(record,'ITERATION_ID')||record.relationships?.ITERATION_ID||'');}
function verificationKey(record){return [recordValue(record,'REQ_ID')||record.relationships?.REQ_ID,recordValue(record,'RUN_ID')||record.relationships?.RUN_ID,recordValue(record,'TEST_ID')||record.relationships?.TEST_ID].join('|');}

function coverageMetrics(project){
  const requirements=mandatoryRequirements(project);
  const tests=records(project,'tests');
  const covered=new Set(tests.map(testRequirementId).filter(Boolean));
  const requirementCoverage=requirements.length?requirements.filter(req=>covered.has(requirementId(req))).length/requirements.length:0;
  const runs=records(project,'runs').filter(record=>[11,17].includes(Number(record.stage)));
  const latest=latestIteration(project,[10,17]);
  const iterationId=latest?recordId(latest,'iterations'):String(project.job.CURRENT_ITERATION||'');
  const iterationRuns=iterationId?runs.filter(run=>runIterationId(run)===iterationId):runs.slice(-10);
  const verification=records(project,'verification');
  const expectedPairs=[];
  for(const requirement of requirements)for(const run of iterationRuns)expectedPairs.push(`${requirementId(requirement)}|${recordId(run,'runs')}`);
  const actualPairs=new Set(verification.map(record=>`${recordValue(record,'REQ_ID')||record.relationships?.REQ_ID}|${recordValue(record,'RUN_ID')||record.relationships?.RUN_ID}`));
  const verificationCoverage=expectedPairs.length?expectedPairs.filter(pair=>actualPairs.has(pair)).length/expectedPairs.length:0;
  const regressions=records(project,'regressions').filter(record=>upper(recordValue(record,'ACTIVE_RETIRED_STATE')||'ACTIVE')!=='RETIRED');
  const successful=regressions.filter(record=>truth(recordValue(record,'POST_CORRECTION_RESULT'))||['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(record,'POST_CORRECTION_RESULT')))).length;
  return {
    mandatoryRequirementCount:requirements.length,
    requirementsWithTests:requirements.filter(req=>covered.has(requirementId(req))).length,
    requirementCoverage,
    iterationRunCount:iterationRuns.length,
    expectedVerificationCount:expectedPairs.length,
    actualVerificationPairCount:expectedPairs.filter(pair=>actualPairs.has(pair)).length,
    verificationCoverage,
    activeRegressionCount:regressions.length,
    successfulRegressionCount:successful,
    regressionSuccess:regressions.length?successful/regressions.length:1
  };
}

function convergenceMetrics(project){
  const coverage=coverageMetrics(project);
  const material=unresolvedMaterialDefects(project);
  const critical=material.filter(record=>upper(recordValue(record,'SEVERITY'))==='CRITICAL').length;
  const major=material.filter(record=>upper(recordValue(record,'SEVERITY'))==='MAJOR').length;
  const mandatoryUnknowns=records(project,'verification').filter(record=>upper(recordValue(record,'DETERMINATION'))==='UNDETERMINED').length+openBlockers(project).length;
  const comparisonRecords=records(project,'comparisons');
  const contradictions=comparisonRecords.filter(record=>truth(recordValue(record,'ANY_VIOLATION'))&&truth(recordValue(record,'ALL_TEN_SATISFIED'))).length;
  const ambiguities=comparisonRecords.filter(record=>upper(recordValue(record,'INTERPRETATION_VARIANCE'))&&!falsey(recordValue(record,'INTERPRETATION_VARIANCE'))).length;
  const unexplainedVariance=comparisonRecords.filter(record=>truth(recordValue(record,'CORRECTNESS_AFFECTING_VARIANCE'))&&!truth(recordValue(record,'AUTHORIZED_VARIANCE'))).length;
  const result={
    requirementCoverage:coverage.requirementCoverage,
    verificationCoverage:coverage.verificationCoverage,
    regressionSuccess:coverage.regressionSuccess,
    criticalDefects:critical,
    majorDefects:major,
    mandatoryUnresolvedUnknowns:mandatoryUnknowns,
    contradictions,
    ambiguities,
    unexplainedVariance
  };
  result.converged=result.requirementCoverage===1&&result.verificationCoverage===1&&result.regressionSuccess===1&&critical===0&&major===0&&mandatoryUnknowns===0&&contradictions===0&&ambiguities===0&&unexplainedVariance===0;
  return result;
}

function releaseMetrics(project){
  const requirements=mandatoryRequirements(project);
  const deterministic=records(project,'deterministicResults');
  const meaning=records(project,'meaningResults');
  const resultByRequirement=new Map();
  const add=(record,collection)=>{
    const req=String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'');
    if(!req)return;
    const determination=upper(recordValue(record,'DETERMINATION'));
    if(!resultByRequirement.has(req))resultByRequirement.set(req,[]);
    resultByRequirement.get(req).push({determination,collection,id:recordId(record,collection)});
  };
  deterministic.forEach(record=>add(record,'deterministicResults'));
  meaning.forEach(record=>add(record,'meaningResults'));
  let satisfied=0,violated=0,undetermined=0;
  const blockingRequirements=[],violatedRequirements=[];
  for(const requirement of requirements){
    const id=requirementId(requirement),results=resultByRequirement.get(id)||[];
    if(results.some(result=>result.determination==='VIOLATED')){violated++;violatedRequirements.push(id);}
    else if(results.some(result=>result.determination==='SATISFIED'))satisfied++;
    else{undetermined++;blockingRequirements.push(id);}
  }
  const validators=[...deterministic,...meaning];
  const failedValidators=validators.filter(record=>upper(recordValue(record,'DETERMINATION'))==='VIOLATED');
  const unknownValidators=validators.filter(record=>upper(recordValue(record,'DETERMINATION'))==='UNDETERMINED');
  const defects=unresolvedMaterialDefects(project);
  const critical=defects.filter(record=>upper(recordValue(record,'SEVERITY'))==='CRITICAL').length;
  const major=defects.filter(record=>upper(recordValue(record,'SEVERITY'))==='MAJOR').length;
  const blockers=openBlockers(project);
  let determination='ACCEPTED';
  if(violated>0||failedValidators.length>0||critical>0||major>0)determination='REJECTED';
  else if(undetermined>0||unknownValidators.length>0||blockers.length>0||requirements.length===0)determination='BLOCKED';
  return {
    determination,mandatoryRequirementCount:requirements.length,satisfied,violated,undetermined,
    validatorCount:validators.length,failedValidatorIds:failedValidators.map(record=>record.id),unknownValidatorIds:unknownValidators.map(record=>record.id),
    criticalDefects:critical,majorDefects:major,blockingRequirements,violatedRequirements,blockerIds:blockers.map(record=>recordId(record,'blockers'))
  };
}

function gate(stage,project){
  ensureShape(project);
  const reasons=[];
  if(stage>1&&project.stages[stage-1].status!=='COMPLETE')reasons.push(`Stage ${String(stage-1).padStart(2,'0')} is not complete.`);
  const questions=unresolvedHumanRequests(project,stage);
  if(questions.length)reasons.push(`${questions.length} blocking human-input request${questions.length===1?' is':'s are'} unresolved.`);
  const blockers=openBlockers(project,stage);
  if(blockers.length)reasons.push(`${blockers.length} open mandatory blocker${blockers.length===1?' affects':'s affect'} this stage.`);
  const changes=acceptedChanges(project,stage);
  const hasAccepted=changes.length>0||project.stages[stage].acceptedResponseIds.length>0;
  const collection=name=>records(project,name,{stage});
  const all=name=>records(project,name);
  const requireAccepted=()=>{if(!hasAccepted)reasons.push('No validated agent response has been accepted for this stage.');};
  const requireCount=(name,min,message)=>{if(collection(name).length<min)reasons.push(message||`${min} ${name} record${min===1?' is':'s are'} required.`);};
  const previousReasons=reasons.length;

  switch(stage){
    case 1:{
      const retainedHistorical=project.isRetainedTestProject&&project.stages[1].status==='COMPLETE'&&project.projectData.stageRecords?.[1];
      if(!String(project.job.EXACT_USER_OBJECTIVE_VERBATIM||'').trim())reasons.push('Verbatim User Job Input is required.');
      if(!retainedHistorical){
        requireAccepted();
        const confirmed=safe(project.projectData.stageConfirmations).some(item=>Number(item.stage)===1&&item.confirmed===true&&!item.invalidatedBy);
        if(!confirmed)reasons.push('Human confirmation that the represented objective and deliverable match intent is required.');
      }
      break;
    }
    case 2:
      requireAccepted();requireCount('sources',1,'At least one inspected independent external governing source is required.');
      for(const source of collection('sources'))reasons.push(...schema.sourceClassificationIssues(recordFields(source)).map(issue=>`${recordId(source,'sources')}: ${issue}`));
      if(collection('sourceConflicts').some(record=>['UNRESOLVED','BLOCKED','UNKNOWN','OPEN'].includes(upper(recordValue(record,'RESOLUTION_STATUS')))))reasons.push('An external-source conflict remains unresolved or blocked.');
      break;
    case 3:{
      requireAccepted();requireCount('research',1);
      const sourceIds=all('sources').map(record=>recordId(record,'sources'));
      const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||'')));
      const missing=sourceIds.filter(id=>!researched.has(id));
      if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);
      break;
    }
    case 4:
      requireAccepted();requireCount('requirements',1);
      for(const req of collection('requirements'))for(const name of schema.RECORD_SCHEMAS.requirements.required)if(!String(recordValue(req,name)||'').trim())reasons.push(`${recordId(req,'requirements')}: ${name} is missing.`);
      break;
    case 5:
      requireAccepted();
      if(collection('requirementResolutions').some(record=>['OPEN','UNRESOLVED','BLOCKED','UNKNOWN'].includes(upper(recordValue(record,'STATUS')))))reasons.push('A requirement-set defect remains unresolved.');
      break;
    case 6:{
      requireAccepted();
      const metrics=coverageMetrics(project);
      if(metrics.mandatoryRequirementCount===0)reasons.push('No active mandatory requirements exist to cover.');
      if(metrics.requirementCoverage!==1)reasons.push(`Mandatory requirement-to-test coverage is ${(metrics.requirementCoverage*100).toFixed(2)}%, not 100%.`);
      break;
    }
    case 7:{
      requireAccepted();
      const reqs=mandatoryRequirements(project),covered=new Set(all('failureTests').map(testRequirementId));
      const missing=reqs.filter(req=>!covered.has(requirementId(req))).map(requirementId);
      if(missing.length)reasons.push(`Failure tests are missing for: ${missing.join(', ')}.`);
      if(all('failureTests').some(record=>truth(recordValue(record,'ACTUAL_RESULT'))&&upper(recordValue(record,'EXPECTED_REJECTION')).includes('REJECT')))reasons.push('A known-invalid fixture was accepted.');
      break;
    }
    case 8:requireAccepted();requireCount('instructions',1);if(project.stages[6].status!=='COMPLETE')reasons.push('Resolved requirements and complete verification coverage are required first.');break;
    case 9:
      requireAccepted();requireCount('preflightRecords',1);
      if(collection('preflightRecords').some(record=>['VIOLATED','UNDETERMINED','BLOCKED','REJECTED'].includes(upper(recordValue(record,'DETERMINATION')))))reasons.push('Instruction preflight contains an unresolved material finding.');
      break;
    case 10:requireAccepted();requireCount('iterations',1);requireCount('candidateFreezes',1);break;
    case 11:{
      requireAccepted();const runs=collection('runs');
      if(runs.length!==10)reasons.push(`Exactly 10 independent runs are required; ${runs.length} exist.`);
      const contexts=new Set(runs.map(record=>String(recordValue(record,'CONTEXT_ID')||record.relationships?.CONTEXT_ID||'')));
      if(contexts.size!==runs.length)reasons.push('Every run must use a distinct fresh context.');
      if(runs.some(record=>!['NONE','FALSE','CLEAN','NOT CONTAMINATED'].includes(upper(recordValue(record,'CONTAMINATION_CHECK')))))reasons.push('At least one run is contaminated or has an unknown contamination state.');
      const candidates=new Set(runs.map(record=>String(recordValue(record,'CANDIDATE_ID')||record.relationships?.CANDIDATE_ID||'')));
      if(candidates.size!==1)reasons.push('All ten runs must use one identical frozen candidate.');
      break;
    }
    case 12:{
      requireAccepted();const metrics=coverageMetrics(project);
      if(metrics.iterationRunCount!==10)reasons.push('The current verification batch does not contain exactly ten runs.');
      if(metrics.expectedVerificationCount===0||metrics.verificationCoverage!==1)reasons.push(`Verification matrix coverage is ${(metrics.verificationCoverage*100).toFixed(2)}%, not 100%.`);
      if(all('verification').some(record=>upper(recordValue(record,'INDEPENDENCE_STATUS'))!=='INDEPENDENT'))reasons.push('A verification record is not independent.');
      break;
    }
    case 13:{
      requireAccepted();const reqs=mandatoryRequirements(project),compared=new Set(collection('comparisons').map(record=>String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'')));
      const missing=reqs.filter(req=>!compared.has(requirementId(req))).map(requirementId);
      if(missing.length)reasons.push(`Cross-run comparison is missing for: ${missing.join(', ')}.`);
      break;
    }
    case 14:{
      requireAccepted();const defects=confirmedDefects(project),analysed=new Set(all('rootCauses').map(record=>String(recordValue(record,'DEFECT_ID')||record.relationships?.DEFECT_ID||'')));
      const missing=defects.filter(defect=>!analysed.has(recordId(defect,'defects'))).map(defect=>recordId(defect,'defects'));
      if(missing.length)reasons.push(`Root-cause analysis is missing for: ${missing.join(', ')}.`);
      break;
    }
    case 15:{
      requireAccepted();const defects=confirmedDefects(project),covered=new Set(all('regressions').map(record=>String(recordValue(record,'DEFECT_ID')||record.relationships?.DEFECT_ID||'')));
      const missing=defects.filter(defect=>!covered.has(recordId(defect,'defects'))).map(defect=>recordId(defect,'defects'));
      if(missing.length)reasons.push(`Permanent regression tests are missing for: ${missing.join(', ')}.`);
      break;
    }
    case 16:requireAccepted();if(confirmedDefects(project).length&&!collection('changes').length)reasons.push('A responsible-layer changeset or blocker is required for confirmed defects.');break;
    case 17:{
      requireAccepted();const runs=collection('runs');
      if(runs.length!==10)reasons.push(`The corrected iteration requires exactly ten new runs; ${runs.length} exist.`);
      if(collection('iterations').length<1||collection('candidateFreezes').length<1)reasons.push('A new iteration and a new frozen candidate are required.');
      break;
    }
    case 18:{
      requireAccepted();const metrics=convergenceMetrics(project);
      if(!metrics.converged)reasons.push('All convergence conditions are not simultaneously satisfied.');
      break;
    }
    case 19:{
      requireAccepted();const runs=collection('runs');
      if(runs.length!==10)reasons.push(`Unchanged confirmation requires exactly ten new runs; ${runs.length} exist.`);
      requireCount('confirmationRecords',1);
      if(collection('confirmationRecords').some(record=>upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))reasons.push('Unchanged confirmation is not affirmatively satisfied.');
      break;
    }
    case 20:requireAccepted();requireCount('baselines',1);if(!all('confirmationRecords').some(record=>upper(recordValue(record,'DETERMINATION'))==='SATISFIED'))reasons.push('A successful unchanged confirmation is required.');break;
    case 21:requireAccepted();requireCount('products',1);if(!all('baselines').length)reasons.push('An approved production baseline is required.');break;
    case 22:{
      requireAccepted();requireCount('deterministicResults',1);
      if(collection('deterministicResults').some(record=>upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))reasons.push('A deterministic finished-product verification is violated or undetermined.');
      break;
    }
    case 23:{
      requireAccepted();requireCount('meaningResults',1);
      if(collection('meaningResults').some(record=>upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))reasons.push('A meaning verification is violated or undetermined.');
      break;
    }
    case 24:{
      requireAccepted();requireCount('adversarialResults',1);
      if(collection('adversarialResults').some(record=>['VIOLATED','UNDETERMINED','FAILED'].includes(upper(recordValue(record,'DETERMINATION')))))reasons.push('Adversarial verification found an unresolved result.');
      break;
    }
    case 25:{
      requireAccepted();requireCount('representationInspections',1);
      if(collection('representationInspections').some(record=>upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))reasons.push('A final representation inspection is violated or undetermined.');
      break;
    }
    case 26:
      requireAccepted();requireCount('processAudits',1);requireCount('productAudits',1);
      if(collection('processAudits').some(record=>upper(recordValue(record,'PROCESS_DETERMINATION'))!=='SATISFIED'))reasons.push('Process audit is not SATISFIED.');
      if(collection('productAudits').some(record=>upper(recordValue(record,'PRODUCT_DETERMINATION'))!=='SATISFIED'))reasons.push('Product audit is not SATISFIED.');
      break;
    case 27:requireAccepted();if(!all('releaseRecords').length)reasons.push('The application has not recorded a release determination.');break;
    case 28:{
      const release=all('releaseRecords').at(-1);
      if(upper(recordValue(release,'DETERMINATION'))!=='ACCEPTED')reasons.push('Stage 27 must be ACCEPTED before artifact identity verification.');
      if(!all('artifactIdentities').length)reasons.push('No audited-versus-delivery artifact identity comparison exists.');
      if(all('artifactIdentities').some(record=>!truth(recordValue(record,'EXACT_HASH_MATCH'))||!truth(recordValue(record,'EXACT_SIZE_MATCH'))||upper(recordValue(record,'AUTHORIZATION'))!=='AUTHORIZED'))reasons.push('At least one release artifact does not exactly match the audited artifact.');
      break;
    }
    case 29:{
      const reqs=mandatoryRequirements(project),chains=all('evidenceChains'),byReq=new Map(chains.map(record=>[String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||''),record]));
      const incomplete=reqs.filter(req=>upper(recordValue(byReq.get(requirementId(req)),'STATUS'))!=='COMPLETE').map(requirementId);
      if(incomplete.length)reasons.push(`Complete evidence chains are missing for: ${incomplete.join(', ')}.`);
      break;
    }
    case 30:{
      requireAccepted();const defects=confirmedDefects(project),covered=new Set(all('regressions').map(record=>String(recordValue(record,'DEFECT_ID')||record.relationships?.DEFECT_ID||'')));
      const missing=defects.filter(defect=>!covered.has(recordId(defect,'defects'))).map(defect=>recordId(defect,'defects'));
      if(missing.length)reasons.push(`Permanent regression information is missing for: ${missing.join(', ')}.`);
      break;
    }
  }
  const blocked=questions.length>0||blockers.length>0;
  return {stage,complete:reasons.length===0,blocked,reasons,acceptedResponseCount:changes.length,checkedAt:now(),priorReasonCount:previousReasons};
}

function deriveStageData(project,stage){
  ensureShape(project);
  const accepted=clone(project.stages[stage].acceptedData||{});
  const derived={};
  const ids=collection=>records(project,collection,{stage}).map(record=>recordId(record,collection));
  const metrics=coverageMetrics(project);
  const convergence=convergenceMetrics(project);
  const release=releaseMetrics(project);
  switch(stage){
    case 1:Object.assign(derived,{JOB_ID:project.job.JOB_ID,DATE_OPENED:project.job.DATE_OPENED,INPUT_SET_VERSION:project.job.CURRENT_INPUT_VERSION,INPUT_SET_HASH_OR_MANIFEST:project.job.INPUT_SET_HASH_OR_MANIFEST||'UNKNOWN',JOB_RECORD_STATUS:project.stages[1].status==='COMPLETE'?'READY':'NOT READY',STATUS_EVIDENCE:project.stages[1].gate?.reasons?.join('; ')||'Canonical Stage 01 records and human confirmation.'});break;
    case 2:Object.assign(derived,{SOURCE_SET_VERSION:project.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',SOURCE_RECORDS:ids('sources'),SOURCE_CONFLICT_RECORDS:ids('sourceConflicts'),KNOWN_CONTROLLING_SOURCES_EXAMINED:records(project,'sources',{stage}).filter(record=>upper(recordValue(record,'INSPECTION_STATUS'))==='INSPECTED').length,UNRESOLVED_CONTROLLING_CONFLICTS:records(project,'sourceConflicts',{stage}).filter(record=>upper(recordValue(record,'RESOLUTION_STATUS'))!=='RESOLVED').length});break;
    case 3:Object.assign(derived,{RESEARCH_VERSION:project.job.CURRENT_RESEARCH_VERSION||'NOT APPLICABLE',SOURCE_RESEARCH_RECORDS:ids('research'),CANDIDATE_REQUIREMENT_RECORDS:ids('candidateRequirements'),LATEST_PASS_NUMBER:Math.max(0,...records(project,'research',{stage}).map(record=>numeric(recordValue(record,'PASS_NUMBER'))))});break;
    case 4:Object.assign(derived,{REQUIREMENTS_VERSION:project.job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE',REQUIREMENT_RECORDS:ids('requirements'),TOTAL_REQUIREMENTS:records(project,'requirements').length,MANDATORY_REQUIREMENTS:mandatoryRequirements(project).length,OPTIONAL_REQUIREMENTS:records(project,'requirements').length-mandatoryRequirements(project).length,BLOCKED_REQUIREMENTS:openBlockers(project,4).length});break;
    case 5:Object.assign(derived,{INPUT_REQUIREMENTS_VERSION:project.job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE',OUTPUT_REQUIREMENTS_VERSION:project.job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE',REQUIREMENT_DEFECT_RECORDS:ids('requirementResolutions'),MANDATORY_BLOCKERS:openBlockers(project,5).length});break;
    case 6:Object.assign(derived,{TEST_SUITE_VERSION:project.job.CURRENT_TEST_SUITE_VERSION||'NOT APPLICABLE',TEST_RECORDS:ids('tests'),TOTAL_ACTIVE_MANDATORY_REQUIREMENTS:metrics.mandatoryRequirementCount,ACTIVE_MANDATORY_REQUIREMENTS_WITH_AT_LEAST_ONE_READY_TEST:metrics.requirementsWithTests,MANDATORY_TEST_COVERAGE:metrics.requirementCoverage,BLOCKED_MANDATORY_REQUIREMENTS:openBlockers(project,6).length});break;
    case 7:Object.assign(derived,{MUTATION_SUITE_VERSION:project.job.CURRENT_MUTATION_SUITE_VERSION||'NOT APPLICABLE',FAILURE_TEST_RECORDS:ids('failureTests'),ACTIVE_REQUIREMENTS:metrics.mandatoryRequirementCount,REQUIREMENTS_WITH_AT_LEAST_ONE_FAILURE_TEST:new Set(records(project,'failureTests').map(testRequirementId)).size,FAILURE_TEST_COVERAGE:metrics.mandatoryRequirementCount?new Set(records(project,'failureTests').map(testRequirementId)).size/metrics.mandatoryRequirementCount:0});break;
    case 11:Object.assign(derived,{RUN_RECORDS:ids('runs'),FRESH_CONTEXTS_CREATED:new Set(records(project,'runs',{stage}).map(record=>recordValue(record,'CONTEXT_ID')||record.relationships?.CONTEXT_ID)).size,RUNS_RECEIVING_EXACT_PACKAGE:records(project,'runs',{stage}).length,CONTAMINATED_RUNS:records(project,'runs',{stage}).filter(record=>!['NONE','FALSE','CLEAN','NOT CONTAMINATED'].includes(upper(recordValue(record,'CONTAMINATION_CHECK')))).length,OUTPUTS_SAVED_SEPARATELY:records(project,'runs',{stage}).filter(record=>String(recordValue(record,'COMPLETE_OUTPUT')||'').trim()).length});break;
    case 12:Object.assign(derived,{ACTIVE_MANDATORY_REQUIREMENTS:metrics.mandatoryRequirementCount,RUNS:metrics.iterationRunCount,EXPECTED_MANDATORY_RECORDS:metrics.expectedVerificationCount,ACTUAL_MANDATORY_RECORDS:metrics.actualVerificationPairCount,MISSING_RECORDS:metrics.expectedVerificationCount-metrics.actualVerificationPairCount,SATISFIED_RECORDS:records(project,'verification').filter(record=>upper(recordValue(record,'DETERMINATION'))==='SATISFIED').length,VIOLATED_RECORDS:records(project,'verification').filter(record=>upper(recordValue(record,'DETERMINATION'))==='VIOLATED').length,UNDETERMINED_RECORDS:records(project,'verification').filter(record=>upper(recordValue(record,'DETERMINATION'))==='UNDETERMINED').length});break;
    case 18:Object.assign(derived,{MANDATORY_REQUIREMENT_COVERAGE:convergence.requirementCoverage,MANDATORY_VERIFICATION_COVERAGE:convergence.verificationCoverage,REGRESSION_TEST_SUCCESS:convergence.regressionSuccess,CRITICAL_DEFECTS:convergence.criticalDefects,MAJOR_DEFECTS:convergence.majorDefects,MANDATORY_UNRESOLVED_UNKNOWNS:convergence.mandatoryUnresolvedUnknowns,KNOWN_CORRECTNESS_AFFECTING_CONTRADICTIONS:convergence.contradictions,KNOWN_CORRECTNESS_AFFECTING_AMBIGUITIES:convergence.ambiguities,UNEXPLAINED_CORRECTNESS_AFFECTING_EXECUTION_VARIANCE:convergence.unexplainedVariance,ALL_CONDITIONS_SIMULTANEOUSLY_TRUE:convergence.converged});break;
    case 27:Object.assign(derived,{TOTAL_MANDATORY_REQUIREMENTS:release.mandatoryRequirementCount,MANDATORY_REQUIREMENTS_WITH_AFFIRMATIVE_SUPPORTING_EVIDENCE:release.satisfied,MANDATORY_REQUIREMENTS_DEMONSTRABLY_VIOLATED:release.violated,MANDATORY_REQUIREMENTS_NOT_ESTABLISHED:release.undetermined,TOTAL_MANDATORY_VALIDATORS:release.validatorCount,MANDATORY_VALIDATORS_FAILED:release.failedValidatorIds.length,MANDATORY_VALIDATORS_UNDETERMINED_OR_NOT_RUN:release.unknownValidatorIds.length,UNRESOLVED_CRITICAL_DEFECTS:release.criticalDefects,UNRESOLVED_MAJOR_DEFECTS:release.majorDefects,BLOCKING_REQUIREMENT_IDS:release.blockingRequirements,VIOLATED_REQUIREMENT_IDS:release.violatedRequirements,BLOCKER_IDS:release.blockerIds,SELECTED_RELEASE_STATE:release.determination});break;
    case 29:{
      const reqs=mandatoryRequirements(project),chains=records(project,'evidenceChains');const complete=chains.filter(record=>upper(recordValue(record,'STATUS'))==='COMPLETE').length;
      Object.assign(derived,{MANDATORY_REQUIREMENT_EVIDENCE_CHAIN_RECORDS:chains.map(record=>recordId(record,'evidenceChains')),TOTAL_MANDATORY_REQUIREMENTS:reqs.length,TOTAL_MANDATORY_REQUIREMENTS_WITH_COMPLETE_CHAINS:complete,TOTAL_MANDATORY_REQUIREMENTS_WITH_INCOMPLETE_CHAINS:Math.max(0,reqs.length-complete),MANDATORY_EVIDENCE_CHAIN_COVERAGE:reqs.length?complete/reqs.length:0,ALL_MANDATORY_EVIDENCE_CHAINS_COMPLETE:reqs.length>0&&complete===reqs.length});break;
    }
  }
  derived.STAGE_DECISION=project.stages[stage].status==='COMPLETE'?'READY TO PROCEED':project.stages[stage].status==='BLOCKED'?'BLOCKED':'NOT READY - CORRECTION REQUIRED';
  derived.DECISION_EVIDENCE=project.stages[stage].gate?.reasons?.length?project.stages[stage].gate.reasons.join('; '):'Canonical records, relationships, deterministic calculations, accepted evidence, and required human decisions satisfy the stage gate.';
  return {...(project.stages[stage].humanData||{}),...accepted,...derived};
}

function recalculate(project){
  ensureShape(project);
  let previousComplete=true;
  for(let stage=1;stage<=30;stage++){
    const result=gate(stage,project);
    const state=project.stages[stage];
    state.gate=result;
    const retainedStageOne=stage===1&&project.isRetainedTestProject&&state.status==='COMPLETE'&&project.projectData.stageRecords?.[1]&&!state.invalidatedBy;
    if(retainedStageOne){state.status='COMPLETE';state.gate={...result,complete:true,reasons:[]};previousComplete=true;continue;}
    if(!previousComplete){state.status='NOT STARTED';}
    else if(result.blocked){state.status='BLOCKED';}
    else if(result.complete){state.status='COMPLETE';}
    else if(hasStageActivity(project,stage)){state.status='IN PROGRESS';}
    else state.status='READY';
    state.decision=state.status==='COMPLETE'?'READY TO PROCEED':state.status==='BLOCKED'?'BLOCKED':'';
    state.decisionEvidence=result.reasons.length?result.reasons.join('; '):'Derived canonical stage gate satisfied.';
    state.acceptedData=deriveStageData(project,stage);
    previousComplete=state.status==='COMPLETE';
  }
  const completed=Object.values(project.stages).filter(state=>state.status==='COMPLETE').length;
  const currentStage=completed===30?30:Math.max(1,Object.values(project.stages).find(state=>state.status!=='COMPLETE')?.number||30);
  const current=project.stages[currentStage];
  project.activeStage=Math.max(1,Math.min(30,Number(project.activeStage||currentStage)));
  project.job.CURRENT_STAGE=`STAGE ${String(currentStage).padStart(2,'0')}`;
  project.job.CURRENT_STATE=completed===30?'COMPLETE':current.status==='BLOCKED'?'BLOCKED':current.status==='IN PROGRESS'?'IN PROGRESS':'READY';
  project.job.CURRENT_BLOCKERS=openBlockers(project).length?openBlockers(project).map(record=>recordId(record,'blockers')).join(', '):'NONE';
  project.job.NEXT_REQUIRED_ACTION=completed===30?'Preserve the completed workflow and exact release evidence.':`${current.status==='BLOCKED'?'Resolve blockers for':'Proceed to'} Operation ${String(currentStage).padStart(2,'0')} — ${core.STAGES[currentStage-1].title.replace(/\b\w/g,ch=>ch.toUpperCase())}.`;
  project.job.LATEST_EVIDENCE_REFERENCE=safe(project.projectData.acceptedChanges).at(-1)?.changeId||project.job.LATEST_EVIDENCE_REFERENCE||'NONE';
  project.job.JOB_RECORD_STATUS=project.stages[1].status==='COMPLETE'?'READY':'NOT READY';
  project.job.STATUS_EVIDENCE=project.stages[1].gate?.reasons?.join('; ')||'Stage 01 canonical evidence is complete.';
  return project;
}

function invalidateDownstream(project,stage,changeId,reason='Material upstream change'){
  ensureShape(project);
  const invalidatedStages=[];
  for(let number=Number(stage)+1;number<=30;number++){
    const state=project.stages[number];
    if(state.status!=='NOT STARTED'||state.acceptedResponseIds.length)invalidatedStages.push(number);
    state.status='NOT STARTED';state.invalidatedBy=changeId;state.gate={complete:false,blocked:false,reasons:[`Invalidated by ${changeId}: ${reason}.`]};
    for(const collection of schema.STAGE_CONTRACTS[number]?.allowedCollections||[]){
      for(const record of records(project,collection,{stage:number,active:false}))if(!record.invalidatedBy){record.invalidatedBy=changeId;record.active=false;record.validity='INVALIDATED';}
    }
    for(const change of acceptedChanges(project,number))change.invalidatedBy=changeId;
  }
  project.release.gateState='';project.release.authorization='NOT AUTHORIZED';project.release.authorizedArtifactIds=[];
  addHistory(project,'DOWNSTREAM_INVALIDATED',{stage,changeId,reason,invalidatedStages});
  recalculate(project);
  return invalidatedStages;
}

function recordHumanInputVersion(project,changedFields,operator='HUMAN_OPERATOR'){
  ensureShape(project);
  const payload={...Object.fromEntries(schema.HUMAN_INTAKE_FIELDS.map(name=>[name,project.job[name]??''])),clarifications:clone(project.projectData.userEntered?.clarifications||[])};
  const sha256=hash.sha256Value(payload);
  const latest=safe(project.projectData.inputVersions).at(-1);
  if(latest?.sha256===sha256)return latest;
  const version=nextVersion(project.job.CURRENT_INPUT_VERSION,'INPUT');
  const record={inputVersionId:allocateInfrastructureId(project,'INPUT-VERSION','inputVersions'),version,sha256,createdAt:now(),operator,changedFields:[...changedFields],payload};
  project.projectData.inputVersions.push(record);
  project.job.CURRENT_INPUT_VERSION=version;
  project.job.INPUT_SET_HASH_OR_MANIFEST=sha256;
  project.projectData.userEntered={...project.projectData.userEntered,...payload};
  addHistory(project,'USER_JOB_INPUT_VERSIONED',{recordId:record.inputVersionId,version,changedFields:[...changedFields],sha256});
  return record;
}

function recordStageConfirmation(project,stage,confirmed,statement,operator='HUMAN_OPERATOR'){
  ensureShape(project);
  const record={confirmationId:allocateInfrastructureId(project,'STAGE-CONFIRMATION','stageConfirmations'),stage:Number(stage),confirmed:Boolean(confirmed),statement:String(statement||''),operator,createdAt:now()};
  project.projectData.stageConfirmations.push(record);
  addHistory(project,'HUMAN_STAGE_CONFIRMATION',{stage:Number(stage),recordId:record.confirmationId,confirmed:Boolean(confirmed)});
  recalculate(project);
  return record;
}

function recordReleaseDetermination(project){
  ensureShape(project);
  const metrics=releaseMetrics(project);
  const definition=schema.RECORD_SCHEMAS.releaseRecords;
  const id=allocateId(project,'releaseRecords');
  const fields={
    RELEASE_ID:id,
    PRODUCT_ID:recordId(records(project,'products').at(-1),'products')||'UNKNOWN',
    BASELINE_ID:recordId(records(project,'baselines').at(-1),'baselines')||'UNKNOWN',
    DETERMINATION:metrics.determination,
    MANDATORY_REQUIREMENT_COUNTS:metrics.mandatoryRequirementCount,
    AFFIRMATIVE_EVIDENCE_COUNTS:metrics.satisfied,
    VIOLATED_COUNTS:metrics.violated,
    UNDETERMINED_COUNTS:metrics.undetermined,
    VALIDATOR_COUNTS:metrics.validatorCount,
    FAILED_VALIDATORS:metrics.failedValidatorIds,
    NOT_RUN_VALIDATORS:metrics.undetermined,
    UNKNOWN_VALIDATORS:metrics.unknownValidatorIds,
    CRITICAL_DEFECTS:metrics.criticalDefects,
    MAJOR_DEFECTS:metrics.majorDefects,
    BLOCKING_REQUIREMENTS:metrics.blockingRequirements,
    VIOLATIONS:metrics.violatedRequirements,
    FAILED_TESTS:metrics.failedValidatorIds,
    UNRESOLVED_DEFECTS:unresolvedMaterialDefects(project).map(record=>recordId(record,'defects')),
    BLOCKERS:metrics.blockerIds,
    CONTROLLING_DECISION_RULE:'REJECTED for demonstrated mandatory violation or unresolved critical/major defect; BLOCKED for missing mandatory evidence, authority, input, capability, decision rule, or validator result; ACCEPTED only with affirmative evidence for every mandatory requirement and successful mandatory validators.',
    CONTROLLING_EVIDENCE:hash.sha256Value(metrics)
  };
  const record={id,stage:27,createdAt:now(),active:true,fields,...fields,sha256:hash.sha256Value(fields),source:'APPLICATION_DERIVATION'};
  project.projectData.releaseRecords.push(record);
  project.release.gateState=metrics.determination;
  addHistory(project,'RELEASE_DETERMINATION_CALCULATED',{recordId:id,determination:metrics.determination});
  recalculate(project);
  return record;
}

function constructEvidenceChains(project){
  ensureShape(project);
  const requirements=mandatoryRequirements(project);
  const instruction=records(project,'instructions').at(-1);
  const product=records(project,'products').at(-1);
  const release=records(project,'releaseRecords').at(-1);
  const identities=records(project,'artifactIdentities');
  const existing=records(project,'evidenceChains',{active:false});
  const created=[];
  for(const requirement of requirements){
    const reqId=requirementId(requirement);
    const sourceId=String(recordValue(requirement,'SOURCE_ID')||requirement.relationships?.SOURCE_ID||'');
    const test=records(project,'tests').find(record=>testRequirementId(record)===reqId);
    const verification=records(project,'verification').find(record=>String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'')===reqId&&upper(recordValue(record,'DETERMINATION'))==='SATISFIED');
    const productResult=[...records(project,'deterministicResults'),...records(project,'meaningResults')].find(record=>String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'')===reqId&&upper(recordValue(record,'DETERMINATION'))==='SATISFIED');
    const missing=[];
    if(!sourceId&&!String(recordValue(requirement,'USER_INPUT_RELATIONSHIP')||'').trim())missing.push('AUTHORITY');
    if(!instruction)missing.push('INSTRUCTION');
    if(!product)missing.push('PRODUCT');
    if(!test)missing.push('TEST');
    if(!verification&&!productResult)missing.push('TEST_RESULT');
    if(!release)missing.push('RELEASE_DECISION');
    if(upper(recordValue(release,'DETERMINATION'))==='ACCEPTED'&&!identities.length)missing.push('ARTIFACT_HASH_IDENTITY');
    const prior=existing.find(record=>String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||'')===reqId&&!record.invalidatedBy);
    const id=prior?recordId(prior,'evidenceChains'):allocateId(project,'evidenceChains');
    const fields={
      CHAIN_ID:id,REQ_ID:reqId,AUTHORITY_ID:sourceId||recordValue(requirement,'USER_INPUT_RELATIONSHIP')||'UNKNOWN',
      INSTRUCTION_ID:recordId(instruction,'instructions')||'UNKNOWN',EXECUTION_ID:recordId(product,'products')||'UNKNOWN',
      PRODUCT_ELEMENT:recordValue(productResult,'PRODUCT_LOCATION')||recordValue(productResult,'RESULT_ID')||recordId(productResult,productResult&&records(project,'deterministicResults').includes(productResult)?'deterministicResults':'meaningResults')||'UNKNOWN',
      TEST_ID:recordId(test,'tests')||'UNKNOWN',TEST_RESULT_ID:recordId(verification,'verification')||recordId(productResult,'deterministicResults')||recordId(productResult,'meaningResults')||'UNKNOWN',
      EVIDENCE_ID:verification?.rawResponseId||productResult?.rawResponseId||'UNKNOWN',RELEASE_DECISION_ID:recordId(release,'releaseRecords')||'UNKNOWN',
      ARTIFACT_HASH_IDENTITY:identities.map(record=>recordId(record,'artifactIdentities')),STATUS:missing.length?'INCOMPLETE':'COMPLETE',MISSING_LINKS:missing
    };
    const record={id,stage:29,createdAt:prior?.createdAt||now(),updatedAt:now(),active:true,fields,...fields,sha256:hash.sha256Value(fields),source:'APPLICATION_DERIVATION'};
    if(prior)Object.assign(prior,record);else project.projectData.evidenceChains.push(record);
    created.push(record);
  }
  addHistory(project,'EVIDENCE_CHAINS_CONSTRUCTED',{count:created.length,complete:created.filter(record=>record.STATUS==='COMPLETE').length});
  recalculate(project);
  return created;
}

function verifyArtifactIdentity(project,audited,delivery){
  ensureShape(project);
  if(upper(recordValue(records(project,'releaseRecords').at(-1),'DETERMINATION'))!=='ACCEPTED')throw new Error('Artifact identity verification is prohibited until Stage 27 is ACCEPTED.');
  const a=safe(audited),d=safe(delivery),created=[];
  const max=Math.max(a.length,d.length);
  for(let index=0;index<max;index++){
    const left=a[index]||{},right=d[index]||{};
    const id=allocateId(project,'artifactIdentities');
    const fields={
      IDENTITY_ID:id,ARTIFACT_ID:left.artifactId||right.artifactId||'UNKNOWN',AUDITED_FILENAME:left.name||'MISSING',AUDITED_VERSION:left.version||'UNKNOWN',AUDITED_STORAGE_REFERENCE:left.storageReference||'BROWSER FILE SELECTION',AUDITED_BYTE_SIZE:left.size??'UNKNOWN',AUDITED_SHA256:left.sha256||'UNKNOWN',
      RELEASE_FILENAME:right.name||'MISSING',RELEASE_VERSION:right.version||'UNKNOWN',RELEASE_STORAGE_REFERENCE:right.storageReference||'BROWSER FILE SELECTION',RELEASE_BYTE_SIZE:right.size??'UNKNOWN',PRE_DELIVERY_SHA256:right.sha256||'UNKNOWN',
      EXACT_HASH_MATCH:Boolean(left.sha256&&right.sha256&&left.sha256===right.sha256),EXACT_SIZE_MATCH:Number.isFinite(Number(left.size))&&Number(left.size)===Number(right.size),POST_AUDIT_MODIFICATION_EVIDENCE:left.sha256===right.sha256?'NONE':'MISMATCH',AUTHORIZATION:'NOT AUTHORIZED'
    };
    fields.AUTHORIZATION=fields.EXACT_HASH_MATCH&&fields.EXACT_SIZE_MATCH&&fields.AUDITED_FILENAME===fields.RELEASE_FILENAME?'AUTHORIZED':'NOT AUTHORIZED';
    const record={id,stage:28,createdAt:now(),active:true,fields,...fields,sha256:hash.sha256Value(fields),source:'APPLICATION_DERIVATION'};
    project.projectData.artifactIdentities.push(record);created.push(record);
  }
  project.release.authorization=created.length&&created.every(record=>record.AUTHORIZATION==='AUTHORIZED')?'AUTHORIZED':'NOT AUTHORIZED';
  project.release.authorizedArtifactIds=project.release.authorization==='AUTHORIZED'?created.map(record=>record.ARTIFACT_ID):[];
  addHistory(project,'ARTIFACT_IDENTITY_VERIFIED',{count:created.length,authorization:project.release.authorization});
  recalculate(project);
  return created;
}

globalThis.closedLoopWorkflowEngine=Object.freeze({
  version:'closed-loop-workflow-engine/1',STAGE_STATES,FORMAL_STATES,ALL_COLLECTIONS,
  clone,now,safe,upper,truth,falsey,numeric,recordFields,recordValue,recordId,isActiveRecord,records,
  ensureShape,addHistory,allocateId,allocateInfrastructureId,nextVersion,registerStageVersion,
  unresolvedHumanRequests,openBlockers,acceptedChanges,hasStageActivity,mandatoryRequirements,confirmedDefects,unresolvedMaterialDefects,
  coverageMetrics,convergenceMetrics,releaseMetrics,gate,deriveStageData,recalculate,invalidateDownstream,
  recordHumanInputVersion,recordStageConfirmation,recordReleaseDetermination,constructEvidenceChains,verifyArtifactIdentity
});
})();

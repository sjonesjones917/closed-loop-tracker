(()=>{
'use strict';

const model=globalThis.closedLoopModel;
const core=globalThis.closedLoopCore;
if(!model||!core)throw new Error('The workflow model and canonical workbook must load before the workflow engine.');

const safe=value=>Array.isArray(value)?value:[];
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const text=value=>String(value??'').trim();
const upper=value=>text(value).toUpperCase();
const recordValue=(record,key)=>record?.[key]??record?.fields?.[key]??'';
const recordUpper=(record,key)=>upper(recordValue(record,key));
const truth=value=>['TRUE','YES','SATISFIED','ACCEPTED','AUTHORIZED','CONFIRMED','CONVERGED','COMPLETE','READY','SUCCESS','EFFECTIVE','VALID'].includes(upper(value));
const falsehood=value=>['FALSE','NO','NONE','0','NOT APPLICABLE'].includes(upper(value));
const unique=array=>[...new Set(array.filter(Boolean))];
const now=()=>new Date().toISOString();

const CANONICAL_ARRAYS=Object.freeze([
  ...Object.keys(model.RECORD_SCHEMAS),
  'generatedPrompts','generatedOutputs','outputReceipts','rawResponses','parsedProposals','validationResults','responseProposals',
  'acceptedChanges','rejectedResponses','extractionManifests','humanInputRequests','humanInputAnswers','instructionContexts',
  'newJobResets','reviews','history','recoveredProjects'
]);

function ensureProjectData(project){
  project.projectData=project.projectData&&typeof project.projectData==='object'?project.projectData:{};
  for(const name of CANONICAL_ARRAYS)project.projectData[name]=safe(project.projectData[name]);
  project.projectData.userEntered=project.projectData.userEntered&&typeof project.projectData.userEntered==='object'?project.projectData.userEntered:{};
  project.projectData.stageRecords=project.projectData.stageRecords&&typeof project.projectData.stageRecords==='object'?project.projectData.stageRecords:{};
  project.projectData.permanentRegistry=project.projectData.permanentRegistry&&typeof project.projectData.permanentRegistry==='object'?project.projectData.permanentRegistry:{};
  project.projectData.idCounters=project.projectData.idCounters&&typeof project.projectData.idCounters==='object'?project.projectData.idCounters:{};
  project.projectData.versionCounters=project.projectData.versionCounters&&typeof project.projectData.versionCounters==='object'?project.projectData.versionCounters:{};
  project.projectData.fullProject=project.projectData.fullProject&&typeof project.projectData.fullProject==='object'?project.projectData.fullProject:{};
  project.stages=project.stages&&typeof project.stages==='object'?project.stages:{};
  for(let n=1;n<=30;n++)project.stages[n]=project.stages[n]||project.stages[String(n)]||{number:n,status:'NOT STARTED',decision:'',decisionEvidence:'',dateTime:'',nextStage:'',revisions:[]};
  project.job=project.job&&typeof project.job==='object'?project.job:{};
  return project;
}

function canonicalId(record,schema){return text(record?.id||record?.[schema.id]||record?.fields?.[schema.id]);}
function activeRecords(project,collection){return safe(project?.projectData?.[collection]).filter(record=>!record.invalidatedAt&&!record.invalidatedBy&&upper(record.status||record.STATUS||record.fields?.STATUS)!=='INVALIDATED');}
function recordsAt(project,collection,stage){return activeRecords(project,collection).filter(record=>Number(record.stage||record.STAGE||record.fields?.STAGE||stage)===Number(stage));}
function findRecord(project,collection,id){const schema=model.RECORD_SCHEMAS[collection];return activeRecords(project,collection).find(record=>canonicalId(record,schema)===text(id));}

function existingIds(project,collection){
  const schema=model.RECORD_SCHEMAS[collection];
  return new Set(safe(project?.projectData?.[collection]).map(record=>canonicalId(record,schema)).filter(Boolean));
}

function allocateId(project,collection){
  ensureProjectData(project);
  const schema=model.RECORD_SCHEMAS[collection];
  if(!schema)throw new Error(`Unknown canonical collection: ${collection}`);
  const ids=existingIds(project,collection),counter=project.projectData.idCounters;
  let value=Number(counter[collection]||0);
  let id;
  do{id=`${schema.prefix}-${String(++value).padStart(4,'0')}`;}while(ids.has(id));
  counter[collection]=value;
  return id;
}

function allocateInstructionId(project,stage){
  ensureProjectData(project);
  const key=`instruction-stage-${stage}`,counter=project.projectData.idCounters;
  const next=Number(counter[key]||0)+1;counter[key]=next;
  return `INSTRUCTION-${text(project.job.JOB_ID)||'UNKNOWN'}-S${String(stage).padStart(2,'0')}-v${String(next).padStart(3,'0')}`;
}

function nextVersion(project,stage){
  ensureProjectData(project);
  const info=model.VERSION_BY_STAGE[stage];
  if(!info)return null;
  const [jobField,prefix]=info,key=`stage-${stage}-${prefix}`;
  const next=Number(project.projectData.versionCounters[key]||0)+1;
  project.projectData.versionCounters[key]=next;
  const version=`${prefix}-v${String(next).padStart(3,'0')}`;
  project.job[jobField]=version;
  return version;
}

function currentVersion(project,stage){const info=model.VERSION_BY_STAGE[stage];return info?text(project.job[info[0]])||'NOT APPLICABLE':'NOT APPLICABLE';}
function openQuestions(project,stage){return activeRecords(project,'humanInputRequests').filter(q=>Number(q.stage)===Number(stage)&&upper(q.status)==='OPEN');}
function latestBlockerRevisions(project){
  const map=new Map();
  for(const record of safe(project?.projectData?.blockers)){
    const id=canonicalId(record,model.RECORD_SCHEMAS.blockers)||text(record.blockerId);
    if(id)map.set(id,record);
  }
  return [...map.values()];
}
function openBlockers(project,stage=null){
  return latestBlockerRevisions(project).filter(record=>{
    if(!['OPEN','BLOCKED','UNRESOLVED'].includes(recordUpper(record,'STATUS')||upper(record.status)))return false;
    if(stage===null)return true;
    const discovered=Number(record.stage||recordValue(record,'STAGE')||recordValue(record,'STAGE_DISCOVERED')||0);
    return !discovered||discovered<=Number(stage);
  });
}

function mandatoryRequirements(project){
  return activeRecords(project,'requirements').filter(record=>{
    const mandatory=recordUpper(record,'MANDATORY_OR_OPTIONAL')||recordUpper(record,'MANDATORY');
    const applicability=recordUpper(record,'APPLICABILITY');
    const status=recordUpper(record,'STATUS');
    return ['MANDATORY','REQUIRED','TRUE','YES'].includes(mandatory)&&!['NOT APPLICABLE','RETIRED','INACTIVE'].includes(applicability)&&!['RETIRED','INACTIVE','SUPERSEDED'].includes(status);
  });
}
function activeRequirements(project){return activeRecords(project,'requirements').filter(record=>!['NOT APPLICABLE','RETIRED','INACTIVE','SUPERSEDED'].includes(recordUpper(record,'APPLICABILITY')||recordUpper(record,'STATUS')));}
function idOf(project,collection,record){return canonicalId(record,model.RECORD_SCHEMAS[collection]);}
function linked(record,key,id){const value=recordValue(record,key);if(Array.isArray(value))return value.map(text).includes(text(id));return text(value).split(/[\s,]+/).includes(text(id))||text(value)===text(id);}
function pct(numerator,denominator){return denominator===0?0:Number(((numerator/denominator)*100).toFixed(6));}

function requirementCoverage(project){
  const requirements=mandatoryRequirements(project),tests=activeRecords(project,'tests');
  const covered=requirements.filter(req=>tests.some(test=>linked(test,'REQ_ID',idOf(project,'requirements',req)))).length;
  return {total:requirements.length,covered,percent:pct(covered,requirements.length)};
}
function verificationCoverage(project,runs=activeRecords(project,'runs')){
  const requirements=mandatoryRequirements(project),results=activeRecords(project,'verification');
  const expected=requirements.length*runs.length;
  let actual=0;
  for(const req of requirements)for(const run of runs){const reqId=idOf(project,'requirements',req),runId=idOf(project,'runs',run);if(results.some(result=>linked(result,'REQ_ID',reqId)&&linked(result,'RUN_ID',runId)))actual++;}
  return {expected,actual,percent:pct(actual,expected)};
}
function unresolvedDefects(project){return activeRecords(project,'defects').filter(record=>!['CLOSED','CLOSED VERIFIED','CLOSED_VERIFIED','RESOLVED','RETIRED'].includes(recordUpper(record,'STATUS')));}
function defectCounts(project){const defects=unresolvedDefects(project);return {critical:defects.filter(x=>recordUpper(x,'SEVERITY')==='CRITICAL').length,major:defects.filter(x=>recordUpper(x,'SEVERITY')==='MAJOR').length,all:defects.length};}
function regressionMetrics(project){
  const regressions=activeRecords(project,'regressions').filter(record=>!['RETIRED','INACTIVE'].includes(recordUpper(record,'ACTIVE_OR_RETIRED')||recordUpper(record,'STATUS')));
  const successful=regressions.filter(record=>['SATISFIED','SUCCESS','TRUE','PASS','PASSED'].includes(recordUpper(record,'POST_CORRECTION_RESULT')||recordUpper(record,'VERIFICATION_RESULT'))).length;
  return {total:regressions.length,successful,percent:pct(successful,regressions.length)};
}

function convergenceMetrics(project){
  const req=requirementCoverage(project);
  const runs=activeRecords(project,'runs');
  const ver=verificationCoverage(project,runs);
  const reg=regressionMetrics(project);
  const defects=defectCounts(project);
  const mandatoryUnknowns=mandatoryRequirements(project).filter(record=>['UNKNOWN','UNDETERMINED','BLOCKED'].includes(recordUpper(record,'STATUS'))).length;
  const comparisons=activeRecords(project,'comparisons');
  const contradictions=comparisons.filter(record=>truth(recordValue(record,'CONTRADICTION'))).length;
  const ambiguities=comparisons.filter(record=>truth(recordValue(record,'AMBIGUITY'))).length;
  const variance=comparisons.filter(record=>truth(recordValue(record,'CORRECTNESS_AFFECTING_VARIANCE'))&&!truth(recordValue(record,'AUTHORIZED_VARIANCE'))).length;
  const converged=req.total>0&&req.percent===100&&ver.expected>0&&ver.percent===100&&(reg.total===0||reg.percent===100)&&defects.critical===0&&defects.major===0&&mandatoryUnknowns===0&&contradictions===0&&ambiguities===0&&variance===0;
  return {mandatoryRequirementCoverage:req.percent,mandatoryVerificationCoverage:ver.percent,regressionSuccess:reg.total?reg.percent:100,criticalDefects:defects.critical,majorDefects:defects.major,mandatoryUnresolvedUnknowns:mandatoryUnknowns,correctnessAffectingContradictions:contradictions,correctnessAffectingAmbiguities:ambiguities,unexplainedCorrectnessAffectingVariance:variance,converged};
}

function acceptedResponseForStage(project,stage){return activeRecords(project,'acceptedChanges').some(change=>Number(change.stage)===Number(stage)&&change.status==='ACCEPTED_CANONICAL_CHANGE');}
function hasStageActivity(project,stage){
  return acceptedResponseForStage(project,stage)||safe(project.projectData.rawResponses).some(record=>Number(record.stage)===Number(stage))||safe(project.projectData.responseProposals).some(record=>Number(record.stage)===Number(stage)&&record.status==='PENDING_REVIEW')||safe(project.projectData.humanDecisions).some(record=>Number(record.stage||recordValue(record,'STAGE'))===Number(stage));
}
function humanDecision(project,stage){
  const records=safe(project.projectData.humanDecisions).filter(record=>Number(record.stage||recordValue(record,'STAGE'))===Number(stage));
  return records.at(-1)||null;
}
function humanReady(project,stage){
  const historical=project.stages?.[stage];
  if(historical?.status==='COMPLETE'&&['READY TO PROCEED','COMPLETE','ACCEPTED'].includes(upper(historical.decision)))return true;
  const decision=humanDecision(project,stage);
  return decision&&['CONFIRMED','READY TO PROCEED','AUTHORIZED','ACCEPTED'].includes(recordUpper(decision,'DECISION'));
}

function sourceIsIndependent(record){
  const relation=recordUpper(record,'TARGET_PRODUCT_RELATIONSHIP'),independent=recordUpper(record,'INDEPENDENT_EXTERNAL_AUTHORITY'),sourceClass=recordUpper(record,'SOURCE_CLASS');
  const reference=text(recordValue(record,'URL_OR_REFERENCE')||recordValue(record,'REFERENCE'));
  const forbidden=/(?:sjonesjones917\/closed-loop-tracker|sjonesjones917\.github\.io\/closed-loop-tracker|(?:^|[\/\\])(?:TEST_PROJECT\.json|index\.html|app\.js|app-core\.js|workbook\.js|prompt-engine\.js|workflow-model\.js|workflow-engine\.js|response-ingestion\.js)(?:$|[?#]))/i;
  if(forbidden.test(reference))return false;
  if(['TARGET PRODUCT','CURRENT APPLICATION','REPOSITORY','PROJECT ARTIFACT','PRIOR IMPLEMENTATION'].includes(relation))return false;
  if(independent&&independent!=='TRUE')return false;
  if(sourceClass&&sourceClass!=='EXTERNAL GOVERNING SOURCE')return false;
  return Boolean(text(recordValue(record,'TITLE'))&&reference);
}

function stageSpecificIssues(project,stage){
  const issues=[],requirements=mandatoryRequirements(project),allRequirements=activeRequirements(project);
  const records=name=>recordsAt(project,name,stage);
  switch(stage){
    case 1:{
      const intake=project.projectData.userEntered?.intake||{};
      if(!text(intake.VERBATIM_JOB_REQUEST||project.job.EXACT_USER_OBJECTIVE_VERBATIM))issues.push('Verbatim User Job Input is required.');
      if(!acceptedResponseForStage(project,1)&&project.stages?.[1]?.status!=='COMPLETE')issues.push('An accepted Stage 01 response is required.');
      if(!humanReady(project,1))issues.push('The operator must confirm that the represented objective and deliverable match the operator’s intent.');
      break;
    }
    case 2:{const sources=activeRecords(project,'sources');if(!sources.length)issues.push('At least one inspected independent external governing source is required.');if(sources.some(source=>!sourceIsIndependent(source)))issues.push('Every Stage 02 source must be an independent external governing source, not the target product or repository.');if(!text(project.job.CURRENT_SOURCE_SET_VERSION)||project.job.CURRENT_SOURCE_SET_VERSION==='NOT APPLICABLE')issues.push('SOURCE-SET-vN has not been created.');break;}
    case 3:{const sources=activeRecords(project,'sources'),research=activeRecords(project,'research');for(const source of sources){const id=idOf(project,'sources',source);if(!research.some(record=>linked(record,'SOURCE_ID',id)))issues.push(`No research record resolves to ${id}.`);}if(!research.length)issues.push('Research records are required.');break;}
    case 4:if(!allRequirements.length)issues.push('Atomic requirement records are required.');break;
    case 5:{const obligations=allRequirements.map(record=>upper(recordValue(record,'OBLIGATION'))).filter(Boolean);if(new Set(obligations).size!==obligations.length)issues.push('Duplicate requirement obligations remain.');if(allRequirements.some(record=>!text(recordValue(record,'INTENDED_VERIFICATION_METHOD')||recordValue(record,'VERIFICATION_METHOD'))))issues.push('Every active requirement requires a verification method.');break;}
    case 6:{const coverage=requirementCoverage(project);if(!coverage.total)issues.push('Active mandatory requirements are required before the verification suite can be completed.');if(coverage.percent!==100)issues.push(`Mandatory requirement-to-test coverage is ${coverage.percent}%, not 100%.`);break;}
    case 7:{const mutations=activeRecords(project,'failureTests');for(const requirement of allRequirements){const id=idOf(project,'requirements',requirement);if(!mutations.some(record=>linked(record,'REQ_ID',id)))issues.push(`No failure test is linked to ${id}.`);}break;}
    case 8:if(!activeRecords(project,'instructions').length)issues.push('A controlled production instruction is required.');if(requirementCoverage(project).percent!==100)issues.push('Stage 08 is blocked until mandatory verification coverage is complete.');break;
    case 9:{const reviews=activeRecords(project,'preflightRecords');if(!reviews.length)issues.push('Independent instruction-preflight findings are required.');if(reviews.some(record=>['VIOLATED','DEFECT','FAILED','UNDETERMINED','OPEN'].includes(recordUpper(record,'DETERMINATION'))))issues.push('Material preflight findings remain unresolved.');break;}
    case 10:if(!activeRecords(project,'candidateFreezes').length||!activeRecords(project,'iterations').length)issues.push('A frozen candidate and iteration identity are required.');break;
    case 11:case 17:case 19:{const runs=recordsAt(project,'runs',stage);if(runs.length!==10)issues.push(`Exactly ten Stage ${String(stage).padStart(2,'0')} runs are required; found ${runs.length}.`);const contexts=unique(runs.map(record=>text(recordValue(record,'CONTEXT_ID'))));if(contexts.length!==runs.length)issues.push('Every run requires a distinct context identity.');const candidates=unique(runs.map(record=>text(recordValue(record,'FROZEN_CANDIDATE_REF')||recordValue(record,'PACKAGE_IDENTITY'))));if(runs.length&&candidates.length!==1)issues.push('All ten runs must use one identical frozen candidate.');if(runs.some(record=>!text(recordValue(record,'OUTPUT_REF')||recordValue(record,'OUTPUT_ID'))))issues.push('Every run requires a complete saved output reference.');if(runs.some(record=>!['FALSE','NO','NONE','CLEAN','NOT CONTAMINATED'].includes(recordUpper(record,'CONTAMINATION_STATUS'))))issues.push('Every run must affirmatively establish an uncontaminated context.');if(stage===19&&!activeRecords(project,'confirmationRecords').some(record=>truth(recordValue(record,'CONFIRMED'))))issues.push('The unchanged confirmation record is not confirmed.');break;}
    case 12:{const runs=activeRecords(project,'runs').filter(record=>Number(record.stage)===11||Number(record.stage)===17),coverage=verificationCoverage(project,runs.slice(-10));if(runs.slice(-10).length!==10)issues.push('The verified iteration must contain exactly ten runs.');if(coverage.percent!==100)issues.push(`REQ_ID × RUN_ID verification coverage is ${coverage.percent}%, not 100%.`);if(activeRecords(project,'verification').some(record=>['NO','FALSE','CONTAMINATED'].includes(recordUpper(record,'INDEPENDENCE_STATUS')||recordUpper(record,'INDEPENDENT'))))issues.push('Every verification context must be independent.');break;}
    case 13:{const comparisons=activeRecords(project,'comparisons');for(const requirement of requirements){const id=idOf(project,'requirements',requirement);if(!comparisons.some(record=>linked(record,'REQ_ID',id)))issues.push(`No ten-run comparison exists for ${id}.`);}break;}
    case 14:for(const defect of activeRecords(project,'defects')){const id=idOf(project,'defects',defect);if(!activeRecords(project,'rootCauses').some(record=>linked(record,'DEFECT_ID',id)))issues.push(`Defect ${id} has no root-cause record.`);}break;
    case 15:case 30:for(const defect of activeRecords(project,'defects').filter(record=>!['REJECTED','DUPLICATE','NOT A DEFECT'].includes(recordUpper(record,'STATUS')))){const id=idOf(project,'defects',defect);if(!activeRecords(project,'regressions').some(record=>linked(record,'DEFECT_ID',id)))issues.push(`Confirmed defect ${id} has no permanent regression record.`);}break;
    case 16:{const changes=activeRecords(project,'changes');for(const rca of activeRecords(project,'rootCauses')){const id=text(recordValue(rca,'DEFECT_ID'));if(id&&!changes.some(record=>linked(record,'TRIGGERING_DEFECT_REFS',id)))issues.push(`No responsible-layer changeset is linked to defect ${id}.`);}break;}
    case 18:{const metrics=convergenceMetrics(project);if(!metrics.converged)issues.push(`Convergence is not established: ${JSON.stringify(metrics)}.`);break;}
    case 20:{const baseline=activeRecords(project,'baselines').at(-1);if(!baseline||!truth(recordValue(baseline,'VALID')))issues.push('A valid baseline supported by unchanged confirmation is required.');break;}
    case 21:if(!activeRecords(project,'products').length)issues.push('The finished product record is required.');break;
    case 22:{const results=activeRecords(project,'deterministicResults');if(!results.length)issues.push('Deterministic finished-product verification results are required.');if(results.some(record=>['VIOLATED','FAILED','UNDETERMINED','UNKNOWN'].includes(recordUpper(record,'DETERMINATION'))))issues.push('A deterministic product result is failed or undetermined.');break;}
    case 23:{const results=activeRecords(project,'meaningResults');for(const requirement of requirements){const id=idOf(project,'requirements',requirement);if(!results.some(record=>linked(record,'REQ_ID',id)))issues.push(`No independent meaning verification exists for ${id}.`);}if(results.some(record=>['VIOLATED','UNDETERMINED','UNKNOWN'].includes(recordUpper(record,'DETERMINATION'))))issues.push('A mandatory meaning verification is violated or undetermined.');break;}
    case 24:{const results=activeRecords(project,'adversarialResults');if(!results.length)issues.push('Adversarial verification records are required.');const defects=defectCounts(project);if(defects.critical||defects.major)issues.push('Adversarial verification exposed unresolved critical or major defects.');break;}
    case 25:{const products=activeRecords(project,'products'),artifacts=activeRecords(project,'artifacts'),inspections=activeRecords(project,'representationInspections');if(products.length&&!inspections.length)issues.push('Final representation inspection records are required.');for(const artifact of artifacts.filter(record=>Number(record.stage)===21)){const id=idOf(project,'artifacts',artifact);if(!inspections.some(record=>linked(record,'ARTIFACT_ID',id)))issues.push(`No final representation inspection exists for ${id}.`);}break;}
    case 26:{const process=activeRecords(project,'processAudits').at(-1),product=activeRecords(project,'productAudits').at(-1);if(!process||!product)issues.push('Separate process and product audits are required.');if(process&&!['SATISFIED','ACCEPTED'].includes(recordUpper(process,'PROCESS_DETERMINATION')))issues.push('Process correctness is not affirmatively established.');if(product&&!['SATISFIED','ACCEPTED'].includes(recordUpper(product,'PRODUCT_DETERMINATION')))issues.push('Product correctness is not affirmatively established.');break;}
    case 27:{const record=activeRecords(project,'releaseRecords').at(-1);if(!record)issues.push('The application-derived release-gate record is required.');else if(!['ACCEPTED','REJECTED','BLOCKED'].includes(recordUpper(record,'RELEASE_DETERMINATION')))issues.push('The release gate lacks exactly one formal determination.');break;}
    case 28:{const release=activeRecords(project,'releaseRecords').at(-1);if(recordUpper(release,'RELEASE_DETERMINATION')!=='ACCEPTED')issues.push('Stage 27 must be ACCEPTED before Stage 28.');const identities=activeRecords(project,'artifactIdentities');if(!identities.length)issues.push('Artifact identity comparisons are required.');for(const record of identities){if(!truth(recordValue(record,'EXACT_HASH_MATCH'))||!truth(recordValue(record,'EXACT_SIZE_MATCH'))||truth(recordValue(record,'POST_AUDIT_MODIFICATION'))||recordUpper(record,'DELIVERY_AUTHORIZATION')!=='AUTHORIZED')issues.push(`Artifact identity ${idOf(project,'artifactIdentities',record)||'UNKNOWN'} is not authorized.`);}break;}
    case 29:{const chains=constructEvidenceChains(project,{persist:false});for(const chain of chains)if(recordUpper(chain,'STATUS')!=='COMPLETE')issues.push(`Evidence chain for ${recordValue(chain,'REQ_ID')} is incomplete.`);break;}
  }
  return unique(issues);
}

function stageGate(project,stage){
  ensureProjectData(project);
  const reasons=[];
  for(let n=1;n<stage;n++)if(project.stages[n]?.status!=='COMPLETE')reasons.push(`Stage ${String(n).padStart(2,'0')} is not complete.`);
  const blockers=openBlockers(project,stage);if(blockers.length)reasons.push(`Open mandatory blocker(s): ${blockers.map(record=>canonicalId(record,model.RECORD_SCHEMAS.blockers)).join(', ')}.`);
  const questions=openQuestions(project,stage);if(questions.length)reasons.push(`${questions.length} blocking human-input request(s) remain unanswered.`);
  if(stage>1&&!acceptedResponseForStage(project,stage)&&project.stages[stage]?.status!=='COMPLETE')reasons.push('No accepted canonical stage response exists.');
  reasons.push(...stageSpecificIssues(project,stage));
  if(stage!==27&&!humanReady(project,stage)&&project.stages[stage]?.status!=='COMPLETE')reasons.push('The operator has not recorded the required stage confirmation.');
  return {complete:reasons.length===0,reasons:unique(reasons),blockers,questions};
}

function deriveReleaseGate(project){
  ensureProjectData(project);
  const requirements=mandatoryRequirements(project),tests=activeRecords(project,'tests'),deterministic=activeRecords(project,'deterministicResults'),meaning=activeRecords(project,'meaningResults'),defects=defectCounts(project),blockers=openBlockers(project);
  const violatedRequirements=[],undeterminedRequirements=[],affirmativeRequirements=[];
  for(const requirement of requirements){
    const reqId=idOf(project,'requirements',requirement);
    const relatedTests=tests.filter(test=>linked(test,'REQ_ID',reqId));
    const det=deterministic.filter(result=>relatedTests.some(test=>linked(result,'TEST_ID',idOf(project,'tests',test))));
    const mean=meaning.filter(result=>linked(result,'REQ_ID',reqId));
    const determinations=[...det,...mean].map(result=>recordUpper(result,'DETERMINATION')).filter(Boolean);
    if(determinations.some(value=>['VIOLATED','FAILED','FALSE'].includes(value)))violatedRequirements.push(reqId);
    else if(!determinations.length||determinations.some(value=>['UNKNOWN','UNDETERMINED','NOT RUN','BLOCKED'].includes(value)))undeterminedRequirements.push(reqId);
    else if(determinations.every(value=>['SATISFIED','SUCCESS','TRUE','ACCEPTED'].includes(value)))affirmativeRequirements.push(reqId);
    else undeterminedRequirements.push(reqId);
  }
  const validatorRecords=[...deterministic,...meaning];
  const failedValidators=validatorRecords.filter(record=>['VIOLATED','FAILED','FALSE'].includes(recordUpper(record,'DETERMINATION'))).map(record=>record.id||recordValue(record,model.RECORD_SCHEMAS.deterministicResults.id)||recordValue(record,model.RECORD_SCHEMAS.meaningResults.id));
  const unknownValidators=validatorRecords.filter(record=>['UNKNOWN','UNDETERMINED','NOT RUN','BLOCKED',''].includes(recordUpper(record,'DETERMINATION'))).map(record=>record.id||'UNKNOWN');
  let determination='ACCEPTED';
  if(violatedRequirements.length||failedValidators.length||defects.critical||defects.major)determination='REJECTED';
  else if(!requirements.length||undeterminedRequirements.length||unknownValidators.length||blockers.length||affirmativeRequirements.length!==requirements.length)determination='BLOCKED';
  return {determination,mandatoryRequirementCount:requirements.length,affirmativeRequirementIds:affirmativeRequirements,violatedRequirementIds:violatedRequirements,undeterminedRequirementIds:undeterminedRequirements,mandatoryValidatorCount:validatorRecords.length,failedValidatorIds:failedValidators,unknownValidatorIds:unknownValidators,criticalDefectCount:defects.critical,majorDefectCount:defects.major,blockerIds:blockers.map(record=>canonicalId(record,model.RECORD_SCHEMAS.blockers)),decisionRule:'ACCEPTED only when every mandatory requirement has affirmative evidence, every mandatory validator succeeds, no mandatory item is undetermined, no mandatory blocker is open, and no critical or major defect remains.'};
}

function upsertDerivedRecord(project,collection,keyField,keyValue,fields,stage){
  const schema=model.RECORD_SCHEMAS[collection],list=project.projectData[collection];
  let record=list.find(item=>text(recordValue(item,keyField))===text(keyValue)&&!item.invalidatedAt);
  if(!record){const id=allocateId(project,collection);record={id,stage,createdAt:now(),fields:{[schema.id]:id},[schema.id]:id};list.push(record);}
  Object.assign(record.fields||(record.fields={}),fields);Object.assign(record,fields);record.updatedAt=now();return record;
}

function ensureReleaseRecord(project){
  const gate=deriveReleaseGate(project),latestProduct=activeRecords(project,'products').at(-1),latestBaseline=activeRecords(project,'baselines').at(-1);
  const key=`${text(recordValue(latestProduct,'PRODUCT_ID'))||'UNKNOWN'}|${text(recordValue(latestBaseline,'BASELINE_ID'))||'UNKNOWN'}|${gate.determination}`;
  return upsertDerivedRecord(project,'releaseRecords','DERIVATION_KEY',key,{
    DERIVATION_KEY:key,PRODUCT_ID:text(recordValue(latestProduct,'PRODUCT_ID'))||'UNKNOWN',BASELINE_ID:text(recordValue(latestBaseline,'BASELINE_ID'))||'UNKNOWN',
    MANDATORY_REQUIREMENT_COUNT:gate.mandatoryRequirementCount,AFFIRMATIVE_EVIDENCE_COUNT:gate.affirmativeRequirementIds.length,
    VIOLATED_COUNT:gate.violatedRequirementIds.length,UNDETERMINED_COUNT:gate.undeterminedRequirementIds.length,MANDATORY_VALIDATOR_COUNT:gate.mandatoryValidatorCount,
    FAILED_VALIDATOR_REFS:gate.failedValidatorIds,NOT_RUN_VALIDATOR_REFS:[],UNKNOWN_VALIDATOR_REFS:gate.unknownValidatorIds,
    CRITICAL_DEFECT_COUNT:gate.criticalDefectCount,MAJOR_DEFECT_COUNT:gate.majorDefectCount,BLOCKING_REQUIREMENT_REFS:gate.undeterminedRequirementIds,
    VIOLATION_REFS:gate.violatedRequirementIds,FAILED_TEST_REFS:gate.failedValidatorIds,UNRESOLVED_DEFECT_REFS:unresolvedDefects(project).map(record=>idOf(project,'defects',record)),
    BLOCKER_REFS:gate.blockerIds,CONTROLLING_DECISION_RULE:gate.decisionRule,RELEASE_DETERMINATION:gate.determination,
    CONTROLLING_EVIDENCE:'Application-derived from canonical requirement, validator, defect, blocker, product, and baseline records.'
  },27);
}

function constructEvidenceChains(project,{persist=true}={}){
  ensureProjectData(project);
  const requirements=mandatoryRequirements(project),chains=[];
  const instruction=activeRecords(project,'instructions').at(-1),product=activeRecords(project,'products').at(-1),release=activeRecords(project,'releaseRecords').at(-1),identity=activeRecords(project,'artifactIdentities').at(-1);
  for(const requirement of requirements){
    const reqId=idOf(project,'requirements',requirement),sourceRef=text(recordValue(requirement,'GOVERNING_SOURCE_REF')||recordValue(requirement,'SOURCE_ID'));
    const test=activeRecords(project,'tests').find(record=>linked(record,'REQ_ID',reqId));
    const testId=test?idOf(project,'tests',test):'';
    const result=activeRecords(project,'verification').find(record=>linked(record,'REQ_ID',reqId)&&(!testId||linked(record,'TEST_ID',testId)))||activeRecords(project,'meaningResults').find(record=>linked(record,'REQ_ID',reqId));
    const execution=activeRecords(project,'runs').at(-1);
    const fields={REQ_ID:reqId,AUTHORITY_REF:sourceRef||'MISSING',REQUIREMENT_REF:reqId,INSTRUCTION_REF:instruction?idOf(project,'instructions',instruction):'MISSING',EXECUTION_REF:execution?idOf(project,'runs',execution):'MISSING',PRODUCT_ELEMENT_REF:product?idOf(project,'products',product):'MISSING',TEST_REF:testId||'MISSING',TEST_RESULT_REF:result?(result.id||'RESULT'):'MISSING',EVIDENCE_REF:result?text(recordValue(result,'EVIDENCE')||recordValue(result,'EXACT_EVIDENCE')||'RECORDED'):'MISSING',RELEASE_DECISION_REF:release?idOf(project,'releaseRecords',release):'MISSING',ARTIFACT_HASH_IDENTITY_REF:identity?idOf(project,'artifactIdentities',identity):'MISSING'};
    const missing=Object.entries(fields).filter(([,value])=>!text(value)||text(value)==='MISSING').map(([key])=>key);
    fields.MISSING_LINKS=missing;fields.STATUS=missing.length?'INCOMPLETE':'COMPLETE';
    if(persist)chains.push(upsertDerivedRecord(project,'evidenceChains','REQ_ID',reqId,fields,29));else chains.push({...fields,id:`CHAIN-PREVIEW-${reqId}`,fields});
  }
  return chains;
}

function deriveStageFields(project,stage){
  const fields={},ids=name=>activeRecords(project,name).map(record=>idOf(project,name,record));
  const requirementCount=activeRequirements(project).length,mandatoryCount=mandatoryRequirements(project).length,coverage=requirementCoverage(project),defects=defectCounts(project),regression=regressionMetrics(project),convergence=convergenceMetrics(project);
  switch(stage){
    case 1:Object.assign(fields,{JOB_ID:project.job.JOB_ID,JOB_TITLE:project.job.JOB_TITLE,DATE_OPENED:project.job.DATE_OPENED,JOB_OWNER:project.job.JOB_OWNER,EXACT_USER_OBJECTIVE_VERBATIM:project.job.EXACT_USER_OBJECTIVE_VERBATIM,SUPPLIED_MATERIALS_INVENTORY:project.job.SUPPLIED_MATERIALS_INVENTORY,KNOWN_AUTHORITATIVE_SOURCES:project.job.KNOWN_AUTHORITATIVE_SOURCES,AVAILABLE_TOOLS:project.job.AVAILABLE_TOOLS,PROHIBITED_ACTIONS:project.job.PROHIBITED_ACTIONS,EXPLICIT_USER_REQUIREMENTS:project.job.EXPLICIT_USER_REQUIREMENTS,INPUT_SET_VERSION:project.job.CURRENT_INPUT_VERSION,INPUT_SET_CONTENTS:project.job.INPUT_SET_CONTENTS,INPUT_SET_HASH_OR_MANIFEST:project.job.INPUT_SET_HASH_OR_MANIFEST,JOB_RECORD_STATUS:project.stages[1]?.status==='COMPLETE'?'READY':'NOT READY',STATUS_EVIDENCE:project.job.LATEST_EVIDENCE_REFERENCE||'UNKNOWN'});break;
    case 2:Object.assign(fields,{SOURCE_SET_VERSION:project.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE',SOURCE_RECORDS:ids('sources'),SOURCE_CONFLICT_RECORDS:ids('sourceConflicts'),KNOWN_CONTROLLING_SOURCES_EXAMINED:activeRecords(project,'sources').filter(source=>recordUpper(source,'INSPECTION_STATUS')==='INSPECTED').length,UNRESOLVED_CONTROLLING_CONFLICTS:activeRecords(project,'sourceConflicts').filter(record=>!['RESOLVED','NOT APPLICABLE'].includes(recordUpper(record,'RESOLUTION_STATUS'))).length});break;
    case 3:Object.assign(fields,{RESEARCH_VERSION:project.job.CURRENT_RESEARCH_VERSION||'NOT APPLICABLE',SOURCE_RESEARCH_RECORDS:ids('research'),CANDIDATE_REQUIREMENT_RECORDS:ids('candidateRequirements'),ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:activeRecords(project,'sources').every(source=>activeRecords(project,'research').some(record=>linked(record,'SOURCE_ID',idOf(project,'sources',source))))?'TRUE':'FALSE'});break;
    case 4:Object.assign(fields,{REQUIREMENTS_VERSION:project.job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE',REQUIREMENT_RECORDS:ids('requirements'),TOTAL_REQUIREMENTS:requirementCount,MANDATORY_REQUIREMENTS:mandatoryCount,CONDITIONAL_REQUIREMENTS:activeRequirements(project).filter(record=>recordUpper(record,'MANDATORY_OR_OPTIONAL')==='CONDITIONAL').length,OPTIONAL_REQUIREMENTS:activeRequirements(project).filter(record=>recordUpper(record,'MANDATORY_OR_OPTIONAL')==='OPTIONAL').length,BLOCKED_REQUIREMENTS:activeRequirements(project).filter(record=>recordUpper(record,'STATUS')==='BLOCKED').length});break;
    case 5:Object.assign(fields,{INPUT_REQUIREMENTS_VERSION:project.job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE',OUTPUT_REQUIREMENTS_VERSION:project.job.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE'});break;
    case 6:Object.assign(fields,{TEST_SUITE_VERSION:project.job.CURRENT_TEST_SUITE_VERSION||'NOT APPLICABLE',TEST_RECORDS:ids('tests'),TOTAL_ACTIVE_MANDATORY_REQUIREMENTS:coverage.total,ACTIVE_MANDATORY_REQUIREMENTS_WITH_AT_LEAST_ONE_READY_TEST:coverage.covered,MANDATORY_TEST_COVERAGE:coverage.percent,BLOCKED_MANDATORY_REQUIREMENTS:coverage.total-coverage.covered});break;
    case 7:Object.assign(fields,{MUTATION_SUITE_VERSION:project.job.CURRENT_MUTATION_SUITE_VERSION||'NOT APPLICABLE',FAILURE_TEST_RECORDS:ids('failureTests'),ACTIVE_REQUIREMENTS:activeRequirements(project).length,REQUIREMENTS_WITH_AT_LEAST_ONE_FAILURE_TEST:activeRequirements(project).filter(req=>activeRecords(project,'failureTests').some(test=>linked(test,'REQ_ID',idOf(project,'requirements',req)))).length,FAILURE_TEST_COVERAGE:pct(activeRequirements(project).filter(req=>activeRecords(project,'failureTests').some(test=>linked(test,'REQ_ID',idOf(project,'requirements',req)))).length,activeRequirements(project).length),INVALID_FIXTURES_ACCEPTED:activeRecords(project,'failureTests').filter(record=>recordUpper(record,'ACTUAL_RESULT')==='ACCEPTED').length,DEFECTIVE_VALIDATORS:activeRecords(project,'failureTests').filter(record=>text(recordValue(record,'VALIDATOR_DEFECT_REF'))).length});break;
    case 8:Object.assign(fields,{DRAFT_INSTRUCTION_VERSION:project.job.CURRENT_INSTRUCTION_VERSION||'NOT APPLICABLE',INSTRUCTION_TRACE_RECORDS:ids('instructions')});break;
    case 11:Object.assign(fields,{FRESH_CONTEXTS_CREATED:recordsAt(project,'runs',11).length,RUNS_RECEIVING_EXACT_PACKAGE:recordsAt(project,'runs',11).length,CONTAMINATED_RUNS:recordsAt(project,'runs',11).filter(record=>!['FALSE','NO','NONE','CLEAN','NOT CONTAMINATED'].includes(recordUpper(record,'CONTAMINATION_STATUS'))).length,OUTPUTS_SAVED_SEPARATELY:recordsAt(project,'runs',11).filter(record=>text(recordValue(record,'OUTPUT_REF'))).length});break;
    case 12:{const runs=recordsAt(project,'runs',11),verification=verificationCoverage(project,runs);Object.assign(fields,{EXPECTED_MANDATORY_RECORDS:verification.expected,ACTUAL_MANDATORY_RECORDS:verification.actual,MISSING_RECORDS:verification.expected-verification.actual,SELF_VALIDATED_RECORDS:activeRecords(project,'verification').filter(record=>['NO','FALSE'].includes(recordUpper(record,'INDEPENDENCE_STATUS'))).length});break;}
    case 15:Object.assign(fields,{UNCONVERTED_CONFIRMED_DEFECTS:activeRecords(project,'defects').filter(defect=>!activeRecords(project,'regressions').some(reg=>linked(reg,'DEFECT_ID',idOf(project,'defects',defect)))).length});break;
    case 18:Object.assign(fields,{MANDATORY_REQUIREMENT_COVERAGE:convergence.mandatoryRequirementCoverage,MANDATORY_VERIFICATION_COVERAGE:convergence.mandatoryVerificationCoverage,REGRESSION_TEST_SUCCESS:convergence.regressionSuccess,CRITICAL_DEFECTS:convergence.criticalDefects,MAJOR_DEFECTS:convergence.majorDefects,MANDATORY_UNRESOLVED_UNKNOWNS:convergence.mandatoryUnresolvedUnknowns,KNOWN_CORRECTNESS_AFFECTING_CONTRADICTIONS:convergence.correctnessAffectingContradictions,KNOWN_CORRECTNESS_AFFECTING_AMBIGUITIES:convergence.correctnessAffectingAmbiguities,UNEXPLAINED_CORRECTNESS_AFFECTING_EXECUTION_VARIANCE:convergence.unexplainedCorrectnessAffectingVariance,ALL_CONDITIONS_SIMULTANEOUSLY_TRUE:convergence.converged?'TRUE':'FALSE'});break;
    case 20:{const baseline=activeRecords(project,'baselines').at(-1);Object.assign(fields,{BASELINE_ID:baseline?idOf(project,'baselines',baseline):'NONE',UNCHANGED_CONFIRMATION_SUCCEEDED:activeRecords(project,'confirmationRecords').some(record=>truth(recordValue(record,'CONFIRMED'))) ? 'TRUE':'FALSE'});break;}
    case 21:{const product=activeRecords(project,'products').at(-1);Object.assign(fields,{PRODUCT_ID:product?idOf(project,'products',product):'NONE',PRODUCT_VERSION:product?recordValue(product,'PRODUCT_VERSION'):'NOT APPLICABLE'});break;}
    case 25:Object.assign(fields,{TOTAL_DELIVERY_ARTIFACTS:activeRecords(project,'artifacts').filter(record=>Number(record.stage)===21).length,UNRESOLVED_CRITICAL_DEFECTS:defects.critical,UNRESOLVED_MAJOR_DEFECTS:defects.major});break;
    case 27:{const gate=deriveReleaseGate(project);Object.assign(fields,{TOTAL_MANDATORY_REQUIREMENTS:gate.mandatoryRequirementCount,MANDATORY_REQUIREMENTS_WITH_AFFIRMATIVE_SUPPORTING_EVIDENCE:gate.affirmativeRequirementIds.length,MANDATORY_REQUIREMENTS_DEMONSTRABLY_VIOLATED:gate.violatedRequirementIds.length,MANDATORY_REQUIREMENTS_NOT_ESTABLISHED:gate.undeterminedRequirementIds.length,TOTAL_MANDATORY_VALIDATORS:gate.mandatoryValidatorCount,MANDATORY_VALIDATORS_SUCCEEDED:gate.mandatoryValidatorCount-gate.failedValidatorIds.length-gate.unknownValidatorIds.length,MANDATORY_VALIDATORS_FAILED:gate.failedValidatorIds.length,MANDATORY_VALIDATORS_UNDETERMINED_OR_NOT_RUN:gate.unknownValidatorIds.length,UNRESOLVED_CRITICAL_DEFECTS:gate.criticalDefectCount,UNRESOLVED_MAJOR_DEFECTS:gate.majorDefectCount,BLOCKING_REQUIREMENT_IDS:gate.undeterminedRequirementIds,VIOLATED_REQUIREMENT_IDS:gate.violatedRequirementIds,FAILED_TEST_IDS:gate.failedValidatorIds,BLOCKER_IDS:gate.blockerIds,SELECTED_RELEASE_STATE:gate.determination,CONTROLLING_DECISION_RULE:gate.decisionRule});break;}
    case 29:{const chains=constructEvidenceChains(project,{persist:false});Object.assign(fields,{TOTAL_MANDATORY_REQUIREMENTS:chains.length,TOTAL_MANDATORY_REQUIREMENTS_WITH_COMPLETE_CHAINS:chains.filter(record=>recordUpper(record,'STATUS')==='COMPLETE').length,TOTAL_MANDATORY_REQUIREMENTS_WITH_INCOMPLETE_CHAINS:chains.filter(record=>recordUpper(record,'STATUS')!=='COMPLETE').length,MANDATORY_EVIDENCE_CHAIN_COVERAGE:pct(chains.filter(record=>recordUpper(record,'STATUS')==='COMPLETE').length,chains.length),ALL_MANDATORY_EVIDENCE_CHAINS_COMPLETE:chains.length&&chains.every(record=>recordUpper(record,'STATUS')==='COMPLETE')?'TRUE':'FALSE'});break;}
    case 30:Object.assign(fields,{TOTAL_DEFECT_RECORDS:activeRecords(project,'defects').length,TOTAL_CONFIRMED_DEFECTS_WITH_REGRESSION_TESTS:activeRecords(project,'defects').filter(defect=>activeRecords(project,'regressions').some(reg=>linked(reg,'DEFECT_ID',idOf(project,'defects',defect)))).length,TOTAL_ACTIVE_REGRESSION_TESTS:regression.total,REGISTRY_IS_APPEND_ONLY:'TRUE'});break;
  }
  return fields;
}

function materialStageChange(project,stage,changeId){
  const invalidated=[];
  for(let n=stage+1;n<=30;n++){
    const state=project.stages[n];
    if(state.status!=='NOT STARTED'||state.decision||state.decisionEvidence)invalidated.push(`STAGE-${String(n).padStart(2,'0')}`);
    Object.assign(state,{status:'NOT STARTED',decision:'',decisionEvidence:'',nextStage:'',decidedBy:'',dateTime:'',invalidatedBy:changeId,invalidatedAt:now()});
  }
  for(const [collection,schema] of Object.entries(model.RECORD_SCHEMAS))for(const record of safe(project.projectData[collection]))if(Number(record.stage)>stage&&!record.invalidatedAt){record.invalidatedAt=now();record.invalidatedBy=changeId;record.status='INVALIDATED';record.fields=record.fields||{};record.fields.STATUS='INVALIDATED';}
  project.release={...(project.release||{}),gateState:'',authorization:'NOT AUTHORIZED',authorizedArtifactIds:[]};
  return invalidated;
}

function updateJobInputDerived(project){
  const intake=project.projectData.userEntered?.intake||{};
  project.job.EXACT_USER_OBJECTIVE_VERBATIM=text(intake.VERBATIM_JOB_REQUEST)||text(project.job.EXACT_USER_OBJECTIVE_VERBATIM);
  project.job.SUPPLIED_MATERIALS_INVENTORY=text(intake.SUPPLIED_MATERIALS)||text(project.job.SUPPLIED_MATERIALS_INVENTORY)||'NONE';
  project.job.KNOWN_AUTHORITATIVE_SOURCES=text(intake.KNOWN_AUTHORITY_SUPPLIED_BY_USER)||text(project.job.KNOWN_AUTHORITATIVE_SOURCES)||'NONE';
  project.job.AVAILABLE_TOOLS=text(intake.ALLOWED_OR_REQUIRED_TOOLS)||text(project.job.AVAILABLE_TOOLS)||'UNKNOWN';
  project.job.PROHIBITED_ACTIONS=text(intake.EXPLICIT_PROHIBITIONS)||text(project.job.PROHIBITED_ACTIONS)||'NONE';
  project.job.EXPLICIT_USER_REQUIREMENTS=[text(intake.EXPLICIT_CONSTRAINTS),text(intake.EXPLICIT_DECISIONS)].filter(Boolean).join('\n')||text(project.job.EXPLICIT_USER_REQUIREMENTS)||'NONE';
  const contents=Object.entries(intake).filter(([,value])=>text(value)).map(([key,value])=>`${key}: ${text(value)}`).join('\n');
  project.job.INPUT_SET_CONTENTS=contents||'UNKNOWN';
  if(!text(project.job.CURRENT_INPUT_VERSION))project.job.CURRENT_INPUT_VERSION='INPUT-v001';
  if(!text(project.job.CURRENT_SOURCE_SET_VERSION))project.job.CURRENT_SOURCE_SET_VERSION='NOT APPLICABLE';
  for(const field of ['CURRENT_RESEARCH_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION','CURRENT_MUTATION_SUITE_VERSION','CURRENT_INSTRUCTION_VERSION'])if(!text(project.job[field]))project.job[field]='NOT APPLICABLE';
  if(!text(project.job.CURRENT_BASELINE_ID))project.job.CURRENT_BASELINE_ID='NONE';
  if(!text(project.job.CURRENT_PRODUCT_ID))project.job.CURRENT_PRODUCT_ID='NONE';
}

function latestEvidence(project){
  const candidates=[...safe(project.projectData.extractionManifests),...safe(project.projectData.validationResults),...safe(project.projectData.outputReceipts),...safe(project.projectData.history)].sort((a,b)=>String(a.committedAt||a.createdAt||a.validatedAt||'').localeCompare(String(b.committedAt||b.createdAt||b.validatedAt||'')));
  const item=candidates.at(-1);return item?.extractionManifestId||item?.validationResultId||item?.receiptId||item?.eventId||'UNKNOWN';
}

function recalculateProject(project){
  ensureProjectData(project);updateJobInputDerived(project);
  if(activeRecords(project,'releaseRecords').length||project.stages[27]?.status==='IN PROGRESS')ensureReleaseRecord(project);
  if(project.stages[29]?.status==='IN PROGRESS'||activeRecords(project,'evidenceChains').length)constructEvidenceChains(project);
  for(let n=1;n<=30;n++){
    const state=project.stages[n],historicalComplete=state.status==='COMPLETE'&&!state.invalidatedAt&&!state.invalidatedBy;
    const derived=deriveStageFields(project,n);
    state.derivedFields=derived;
    project.projectData.stageRecords[n]=project.projectData.stageRecords[n]||{};
    project.projectData.stageRecords[n].derivedFields=clone(derived);
    if(historicalComplete)continue;
    const gate=stageGate(project,n),priorComplete=n===1||project.stages[n-1]?.status==='COMPLETE';
    if(gate.complete)state.status='COMPLETE';
    else if(gate.blockers.length||gate.questions.length||gate.reasons.some(reason=>/block|unavailable|cannot|must be ACCEPTED/i.test(reason)))state.status='BLOCKED';
    else if(hasStageActivity(project,n))state.status='IN PROGRESS';
    else state.status=priorComplete?'READY':'NOT STARTED';
    state.blockingReasons=gate.reasons;
  }
  let currentStage=30;for(let n=1;n<=30;n++)if(project.stages[n].status!=='COMPLETE'){currentStage=n;break;}
  const completeCount=Object.values(project.stages).filter(stage=>stage.status==='COMPLETE').length;
  const current=project.stages[currentStage];
  project.job.CURRENT_STAGE=`STAGE ${String(currentStage).padStart(2,'0')}`;
  project.job.CURRENT_STATE=completeCount===30?'COMPLETE':current.status==='BLOCKED'?'BLOCKED':current.status==='IN PROGRESS'?'IN PROGRESS':'READY';
  project.job.CURRENT_BLOCKERS=openBlockers(project).length?openBlockers(project).map(record=>canonicalId(record,model.RECORD_SCHEMAS.blockers)).join(', '):'NONE';
  project.job.NEXT_REQUIRED_ACTION=completeCount===30?'Preserve the complete project and release record.':current.status==='BLOCKED'?`Resolve Stage ${String(currentStage).padStart(2,'0')} blockers: ${(current.blockingReasons||[]).join(' ')}`:`Proceed to Operation ${String(currentStage).padStart(2,'0')} — ${core.STAGES[currentStage-1].title}.`;
  project.job.LATEST_EVIDENCE_REFERENCE=latestEvidence(project);
  const latestBaseline=activeRecords(project,'baselines').filter(record=>truth(recordValue(record,'VALID'))).at(-1),latestProduct=activeRecords(project,'products').at(-1),latestIteration=activeRecords(project,'iterations').at(-1);
  project.job.CURRENT_BASELINE_ID=latestBaseline?idOf(project,'baselines',latestBaseline):project.job.CURRENT_BASELINE_ID||'NONE';
  project.job.CURRENT_PRODUCT_ID=latestProduct?idOf(project,'products',latestProduct):project.job.CURRENT_PRODUCT_ID||'NONE';
  project.job.CURRENT_ITERATION=latestIteration?idOf(project,'iterations',latestIteration):project.job.CURRENT_ITERATION||'NOT APPLICABLE';
  project.job.JOB_RECORD_STATUS=project.stages[1].status==='COMPLETE'?'READY':project.stages[1].status;
  project.completionCount=completeCount;
  project.updatedAt=now();
  return project;
}

function addHumanDecision(project,stage,decision,rationale='',authority='Human operator'){
  ensureProjectData(project);
  const id=allocateId(project,'humanDecisions'),createdAt=now(),record={id,stage,createdAt,fields:{DECISION_ID:id,STAGE:stage,DECISION_TYPE:'STAGE_CONFIRMATION',DECISION:decision,RATIONALE:rationale||'Operator confirmed the canonical stage result.',AUTHORITY:authority,CREATED_AT:createdAt,RELATED_REFS:[]}};
  Object.assign(record,record.fields);project.projectData.humanDecisions.push(record);
  project.stages[stage].decision=decision;project.stages[stage].decisionEvidence=record.fields.RATIONALE;project.stages[stage].decidedBy=authority;project.stages[stage].dateTime=createdAt;
  project.projectData.history.push({eventId:`EVENT-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,createdAt,stage,type:'HUMAN_STAGE_DECISION',recordId:id,decision});
  return recalculateProject(project);
}

function resolveQuestionAnswers(project,answers,operator='Human operator'){
  ensureProjectData(project);
  const createdAt=now(),versionNumber=Number(project.projectData.versionCounters.input||1)+1;project.projectData.versionCounters.input=versionNumber;
  const version=`INPUT-v${String(versionNumber).padStart(3,'0')}`;project.job.CURRENT_INPUT_VERSION=version;
  for(const [requestId,answer] of Object.entries(answers||{})){
    const request=project.projectData.humanInputRequests.find(record=>text(record.requestId||record.id)===text(requestId));
    if(!request||upper(request.status)!=='OPEN')throw new Error(`Human-input request ${requestId} is not open.`);
    if(!text(answer))throw new Error(`An answer is required for ${requestId}.`);
    request.status='ANSWERED';request.answeredAt=createdAt;
    const answerRecord={answerId:`ANSWER-${String(project.projectData.humanInputAnswers.length+1).padStart(4,'0')}`,requestId,stage:request.stage,answer:text(answer),answeredBy:operator,createdAt,inputVersion:version};
    project.projectData.humanInputAnswers.push(answerRecord);
    project.projectData.userEntered.clarifications=safe(project.projectData.userEntered.clarifications);project.projectData.userEntered.clarifications.push(clone(answerRecord));
  }
  project.projectData.generatedPrompts.filter(prompt=>Number(prompt.stage)===Number(project.job.CURRENT_STAGE?.match(/\d+/)?.[0]||1)&&prompt.status==='CURRENT').forEach(prompt=>prompt.status='STALE');
  project.projectData.history.push({eventId:`EVENT-${Date.now()}`,createdAt,stage:Number(project.job.CURRENT_STAGE?.match(/\d+/)?.[0]||1),type:'HUMAN_INPUT_ANSWERED',inputVersion:version,requestIds:Object.keys(answers||{})});
  return recalculateProject(project);
}

const api={CANONICAL_ARRAYS,safe,clone,text,upper,truth,falsehood,recordValue,recordUpper,ensureProjectData,activeRecords,recordsAt,findRecord,allocateId,allocateInstructionId,nextVersion,currentVersion,openQuestions,openBlockers,mandatoryRequirements,activeRequirements,requirementCoverage,verificationCoverage,defectCounts,regressionMetrics,convergenceMetrics,sourceIsIndependent,stageSpecificIssues,stageGate,deriveReleaseGate,ensureReleaseRecord,constructEvidenceChains,deriveStageFields,materialStageChange,recalculateProject,addHumanDecision,resolveQuestionAnswers,canonicalId,idOf,linked,pct};
globalThis.closedLoopWorkflow=Object.freeze(api);
dispatchEvent(new Event('closed-loop-workflow-ready'));
})();

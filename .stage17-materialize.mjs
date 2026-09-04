import fs from 'node:fs';

const appendOnce=(path,marker,text)=>{
  let src=fs.readFileSync(path,'utf8');
  if(src.includes(marker))return;
  src += `\n${text.trim()}\n`;
  fs.writeFileSync(path,src);
};
const replaceOnce=(path,from,to)=>{
  let src=fs.readFileSync(path,'utf8');
  const count=src.split(from).length-1;
  if(count!==1)throw new Error(`${path}: expected one anchor, found ${count}: ${from.slice(0,120)}`);
  src=src.replace(from,to);
  fs.writeFileSync(path,src);
};

appendOnce('workflow-schema.js','closed-loop-stage13-frozen-variance-schema/1',String.raw`
;(()=>{
'use strict';
const base=globalThis.closedLoopWorkflowSchema;
if(!base)throw new Error('workflow-schema base unavailable for frozen-variance extension.');
const VARIANCE_READ_STAGES=new Set([13,17,19]);
const operationContract=(stage,operation)=>{
  const contract=base.operationContract(stage,operation);
  if(!contract||String(operation||'').toUpperCase()!=='COMPARE'||!VARIANCE_READ_STAGES.has(Number(stage)))return contract;
  return {...contract,readCollections:[...new Set([...(contract.readCollections||[]),'expectedVarianceContracts'])]};
};
globalThis.closedLoopWorkflowSchema=Object.freeze({...base,operationContract,stage13FrozenVarianceSchemaVersion:'closed-loop-stage13-frozen-variance-schema/1'});
})();
`);

appendOnce('response-ingestion.js','closed-loop-expected-variance-freeze/1',String.raw`
;(()=>{
'use strict';
const base=globalThis.closedLoopResponseIngestion;
const workflow=globalThis.closedLoopWorkflowEngine;
const hash=globalThis.closedLoopHash;
if(!base||!workflow||!hash)throw new Error('response-ingestion frozen-variance extension dependencies unavailable.');
const clone=value=>JSON.parse(JSON.stringify(value));
const normalizeExpectedVarianceContract=record=>{
  const dimensions=[...new Set((workflow.recordValue(record,'DIMENSIONS')||[]).map(v=>String(v).trim()).filter(Boolean))].sort();
  const rationale=String(workflow.recordValue(record,'RATIONALE')||'').trim();
  const allowedVariance=clone(workflow.recordValue(record,'ALLOWED_VARIANCE')??'');
  return {dimensions,allowedVariance,rationale};
};
function stampPrepared(result){
  const proposal=result?.proposal;
  if(!proposal||proposal.responseType!=='DATA_PROPOSAL')return result;
  const records=proposal.canonicalRecords?.expectedVarianceContracts||[];
  if(!records.length)return result;
  for(const record of records){
    const normalized=normalizeExpectedVarianceContract(record);
    const frozenAt=String(proposal.createdAt||new Date().toISOString());
    const scope=clone(proposal.scope||proposal.envelope?.scope||{});
    const digest=hash.sha256Value(normalized);
    const app={NORMALIZED_CONTRACT:normalized,FROZEN_AT:frozenAt,SCOPE:scope,CONTRACT_SHA256:digest,STATUS:'FROZEN'};
    record.fields={...(record.fields||{}),...app};Object.assign(record,app);
    workflow.refreshRecordHashes(record,'expectedVarianceContracts');
    for(const [name,value] of Object.entries(app))proposal.changes.push({origin:name==='CONTRACT_SHA256'?'APPLICATION_HASH':'APPLICATION_DERIVATION',jsonPointer:null,rawValueHash:null,normalizerUsed:name==='NORMALIZED_CONTRACT'?'closed-loop-expected-variance-normalizer/1':null,canonicalCollection:'expectedVarianceContracts',canonicalRecordType:'expectedVarianceContracts',canonicalRecordId:workflow.recordId(record,'expectedVarianceContracts'),canonicalField:name,relationshipTargetId:null,evidenceIds:record.evidenceRefs||[],normalizedValue:clone(value),temporaryResponseKey:record.temporaryKey||null,derivationKey:`expectedVarianceContracts.${name}`});
  }
  return result;
}
const prepare=(project,options={})=>stampPrepared(base.prepare(project,options));
const prepareCaptured=(project,options={})=>stampPrepared(base.prepareCaptured(project,options));
globalThis.closedLoopResponseIngestion=Object.freeze({...base,normalizeExpectedVarianceContract,prepare,prepareCaptured,expectedVarianceFreezeVersion:'closed-loop-expected-variance-freeze/1'});
})();
`);

appendOnce('workflow-engine.js','closed-loop-stage13-frozen-variance-engine/1',String.raw`
;(()=>{
'use strict';
const base=globalThis.closedLoopWorkflowEngine;
const hash=globalThis.closedLoopHash;
if(!base||!hash)throw new Error('workflow-engine frozen-variance extension dependencies unavailable.');
const clone=value=>JSON.parse(JSON.stringify(value));
const upper=value=>String(value??'').trim().toUpperCase();
const isNone=value=>['','NONE','NO VARIANCE','NO_VARIANCE','FALSE','NOT APPLICABLE','NOT_APPLICABLE','N/A'].includes(upper(value));
const array=value=>Array.isArray(value)?value:[];
function normalizedAllowed(record){const normalized=base.recordValue(record,'NORMALIZED_CONTRACT');return normalized&&typeof normalized==='object'&&Object.prototype.hasOwnProperty.call(normalized,'allowedVariance')?normalized.allowedVariance:base.recordValue(record,'ALLOWED_VARIANCE');}
function frozenVarianceContracts(project){return base.recordsForCurrentScope(project,'expectedVarianceContracts').filter(record=>upper(base.recordValue(record,'STATUS'))==='FROZEN'&&base.recordValue(record,'NORMALIZED_CONTRACT')&&String(base.recordValue(record,'CONTRACT_SHA256')||'')===hash.sha256Value(base.recordValue(record,'NORMALIZED_CONTRACT')));}
function allowedByContract(value,contract){
  const allowed=normalizedAllowed(contract);
  if(isNone(value))return true;
  if(typeof allowed==='string'){
    const text=allowed.trim();
    if(!text)return false;
    if(text.startsWith('{')||text.startsWith('[')){try{return allowedByContract(value,{fields:{NORMALIZED_CONTRACT:{allowedVariance:JSON.parse(text)}}});}catch{}}
    return upper(text)===upper(value);
  }
  if(Array.isArray(allowed))return allowed.some(item=>upper(item)===upper(value));
  if(allowed&&typeof allowed==='object'){
    const vals=[...array(allowed.allowedValues),...array(allowed.values),...array(allowed.allowed)];
    if(vals.length)return vals.some(item=>upper(item)===upper(value));
    if(typeof allowed.value==='string')return upper(allowed.value)===upper(value);
  }
  return false;
}
function dimensionApplies(contract,name){const normalized=base.recordValue(contract,'NORMALIZED_CONTRACT');const dimensions=array(normalized?.dimensions).map(upper);return !dimensions.length||dimensions.includes('*')||dimensions.includes(upper(name));}
function actualDefectIds(project,row){const ids=base.recordValue(row,'DEFECT_IDS');const requested=Array.isArray(ids)?ids:String(ids??'').split(/[\s,]+/).map(v=>v.trim()).filter(v=>v&&!isNone(v));const live=new Set(base.recordsForCurrentScope(project,'defects').map(record=>base.recordId(record,'defects')));return requested.filter(id=>live.has(id));}
function evaluateComparisonVariance(project,row){
  const contracts=frozenVarianceContracts(project);
  if(!contracts.length)return {classification:'UNKNOWN',reason:'No current frozen expected-variance contract with a valid application hash exists.',contractIds:[],prohibited:[],unknown:['EXPECTED_VARIANCE_CONTRACT']};
  const observations=[['INTERPRETATION_VARIANCE',base.recordValue(row,'INTERPRETATION_VARIANCE')],['OUTPUT_VARIANCE',base.recordValue(row,'OUTPUT_VARIANCE')]].filter(([,value])=>!isNone(value));
  if(!observations.length)return {classification:'ALLOWED',reason:'No cross-run interpretation or output variance was reported.',contractIds:contracts.map(c=>base.recordId(c,'expectedVarianceContracts')),prohibited:[],unknown:[]};
  const prohibited=[],unknown=[],used=new Set();
  for(const [dimension,value] of observations){const applicable=contracts.filter(c=>dimensionApplies(c,dimension));if(!applicable.length){unknown.push(dimension);continue;}for(const c of applicable)used.add(base.recordId(c,'expectedVarianceContracts'));if(applicable.some(c=>allowedByContract(value,c)))continue;if(applicable.every(c=>isNone(normalizedAllowed(c))))prohibited.push(dimension);else unknown.push(dimension);}
  if(unknown.length)return {classification:'UNKNOWN',reason:`Variance could not be deterministically classified for ${unknown.join(', ')}.`,contractIds:[...used],prohibited,unknown};
  if(prohibited.length){const defects=actualDefectIds(project,row);return {classification:defects.length?'PROHIBITED_WITH_DEFECT':'PROHIBITED_MISSING_DEFECT',reason:defects.length?'Prohibited variance is linked to a current canonical defect.':'Prohibited variance lacks a current canonical defect.',contractIds:[...used],prohibited,unknown:[],defectIds:defects};}
  return {classification:'ALLOWED',reason:'Every reported variance exactly matches a value authorized by a current frozen expected-variance contract.',contractIds:[...used],prohibited:[],unknown:[]};
}
function stage13VarianceReview(project){const rows=base.recordsForCurrentScope(project,'comparisons');const evaluations=rows.map(row=>({comparisonId:base.recordId(row,'comparisons'),requirementId:String(base.recordValue(row,'REQ_ID')||''),...evaluateComparisonVariance(project,row)}));return {contracts:frozenVarianceContracts(project),evaluations,blocked:evaluations.filter(x=>['UNKNOWN','PROHIBITED_MISSING_DEFECT'].includes(x.classification)),prohibited:evaluations.filter(x=>x.classification.startsWith('PROHIBITED')),allowed:evaluations.filter(x=>x.classification==='ALLOWED')};}
function gate(stage,project){const result=clone(base.gate(stage,project));if(Number(stage)!==13)return result;const review=stage13VarianceReview(project);const add=reason=>{if(!result.reasons.includes(reason))result.reasons.push(reason);};if(!review.contracts.length)add('Stage 13 requires at least one current frozen expected-variance contract with a valid application-owned contract hash.');for(const item of review.blocked)add(`Comparison ${item.comparisonId||'UNKNOWN'} variance classification ${item.classification}: ${item.reason}`);result.complete=result.reasons.length===0;result.blocked=!result.complete;return result;}
function deriveStageData(stage,project){const data=base.deriveStageData(stage,project);if(Number(stage)!==13)return data;const review=stage13VarianceReview(project);return {...data,PROHIBITED_OUTPUT_VARIANCES:review.prohibited.length,CORRECTNESS_AFFECTING_DISAGREEMENTS:review.evaluations.filter(x=>x.classification!=='ALLOWED').length,STAGE_DECISION:review.blocked.length?'BLOCKED':review.prohibited.length?'REJECTED':'ACCEPTED',DECISION_EVIDENCE:review.evaluations.map(x=>`${x.comparisonId}:${x.classification}`).join('; ')||'NONE'};}
function recalculate(project){const out=base.recalculate(project);if(project?.stages?.[13]){const g=gate(13,project);project.stages[13].gate=g;if(project.stages[13].acceptedResponseIds?.length||project.stages[13].acceptedDataChangeIds?.length){project.stages[13].status=g.complete?'COMPLETE':'BLOCKED';project.stages[13].applicationData={...(project.stages[13].applicationData||{}),...deriveStageData(13,project)};}}return out;}
globalThis.closedLoopWorkflowEngine=Object.freeze({...base,frozenVarianceContracts,evaluateComparisonVariance,stage13VarianceReview,gate,deriveStageData,recalculate,stage13FrozenVarianceEngineVersion:'closed-loop-stage13-frozen-variance-engine/1'});
})();
`);

replaceOnce('verify-spec-grounded-route-oracle.mjs',"13:['verification','runs','requirements','tests']","13:['verification','runs','requirements','tests','expectedVarianceContracts']");
replaceOnce('verify-spec-grounded-route-oracle.mjs',"'17:COMPARE':{r:['verification','runs','requirements','tests'],w:['comparisons']}","'17:COMPARE':{r:['verification','runs','requirements','tests','expectedVarianceContracts'],w:['comparisons']}");
replaceOnce('verify-spec-grounded-route-oracle.mjs',"'19:COMPARE':{r:['verification','runs','requirements','tests'],w:['comparisons']}","'19:COMPARE':{r:['verification','runs','requirements','tests','expectedVarianceContracts'],w:['comparisons']}");

const verifier=String.raw`import fs from 'node:fs';import vm from 'node:vm';import {recordProposal,evidence} from './test-fixtures.mjs';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion,hash=globalThis.closedLoopHash;const assert=(v,m)=>{if(!v)throw new Error(m)};const set=(r,k,v)=>{r.fields=r.fields||{};r.fields[k]=v;r[k]=v;};const rec=(c,s,f,id,scope={})=>{const d=schema.RECORD_SCHEMAS[c],x={id,stage:s,active:true,scope:{...scope},fields:{...f,[d.idField]:id},...f,[d.idField]:id};return x;};
assert(schema.operationContract(13,'COMPARE').readCollections.includes('expectedVarianceContracts'),'Stage 13 COMPARE must read frozen expected-variance contracts.');assert(schema.operationContract(17,'COMPARE').readCollections.includes('expectedVarianceContracts'),'Repeated Stage 17 COMPARE must read frozen expected-variance contracts.');assert(schema.operationContract(19,'COMPARE').readCollections.includes('expectedVarianceContracts'),'Confirmation Stage 19 COMPARE must read frozen expected-variance contracts.');
let freeze=core.createBlankState('JOB-STAGE17-FREEZE');Object.assign(freeze.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Freeze expected variance.',CURRENT_REQUIREMENTS_VERSION:'REQ-v1',CURRENT_TEST_SUITE_VERSION:'TEST-v1',CURRENT_INSTRUCTION_VERSION:'INST-v1'});engine.ensureShape(freeze);engine.recalculate(freeze);const pr={...prompts.buildPromptRecord(6,freeze,{operation:'COMPLETE'}),generatedAt:new Date().toISOString()};freeze.projectData.generatedPrompts.push(pr);const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:freeze.job.JOB_ID,stage:6,operation:'COMPLETE',promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{expectedVarianceContracts:[recordProposal(schema,'expectedVarianceContracts',{tempKey:'variance',overrides:{DIMENSIONS:['OUTPUT_VARIANCE','INTERPRETATION_VARIANCE'],RATIONALE:'Any cross-run semantic or output difference must be explicitly authorized.',ALLOWED_VARIANCE:'NONE'}})]},evidence:[evidence('stage17-freeze')],unresolved:[],warnings:[],attachments:[]};let prepared=ingestion.prepare(freeze,{stage:6,text:JSON.stringify(envelope),promptRecord:pr});assert(prepared.validation.valid,`Variance contract proposal invalid: ${JSON.stringify(prepared.validation.issues)}`);const proposed=prepared.proposal.canonicalRecords.expectedVarianceContracts[0];assert(proposed.STATUS==='FROZEN','Expected-variance contract was not application-frozen before commit.');assert(proposed.NORMALIZED_CONTRACT&&proposed.FROZEN_AT&&proposed.SCOPE,'Expected-variance application fields were not populated.');assert(proposed.CONTRACT_SHA256===hash.sha256Value(proposed.NORMALIZED_CONTRACT),'Expected-variance contract hash is not bound to normalized contract bytes.');freeze=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'STAGE17_FIXTURE'}).project;const frozen=engine.recordsForCurrentScope(freeze,'expectedVarianceContracts')[0];assert(frozen&&frozen.STATUS==='FROZEN','Committed expected-variance contract did not remain frozen.');
const p=core.createBlankState('JOB-STAGE17-CROSS-RUN');Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Compare ten verified runs.',CURRENT_INPUT_VERSION:'INPUT-v1',CURRENT_REQUIREMENTS_VERSION:'REQ-v1',CURRENT_TEST_SUITE_VERSION:'TEST-v1',CURRENT_INSTRUCTION_VERSION:'INST-v1'});engine.ensureShape(p);for(let s=1;s<=12;s++){p.stages[s].status='COMPLETE';p.stages[s].gate={complete:true,blocked:false,reasons:[]};}const iterScope={requirementsVersion:p.job.CURRENT_REQUIREMENTS_VERSION,testSuiteVersion:p.job.CURRENT_TEST_SUITE_VERSION,instructionVersion:p.job.CURRENT_INSTRUCTION_VERSION,iterationId:'ITER-STAGE17',candidateId:'CAND-STAGE17'};p.projectData.iterations.push(rec('iterations',10,{CANDIDATE_ID:'CAND-STAGE17',STATUS:'FROZEN'},'ITER-STAGE17',iterScope));p.projectData.candidateFreezes.push(rec('candidateFreezes',10,{ITERATION_ID:'ITER-STAGE17',STATUS:'FROZEN'},'CAND-STAGE17',iterScope));p.projectData.requirements.push(rec('requirements',4,{MANDATORY_OPTIONAL_STATUS:'MANDATORY',APPLICABILITY:'APPLICABLE',STATUS:'ACTIVE'},'REQ-STAGE17',iterScope));p.projectData.tests.push(rec('tests',6,{REQ_ID:'REQ-STAGE17',TEST_TYPE:'MEANING',VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:12,REQUIRED_BY_STAGE:12,PER_RUN_REQUIRED:true,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,STATUS:'READY'},'TEST-STAGE17',iterScope));
for(let i=1;i<=10;i++){const runId=`RUN-STAGE17-${i}`;p.projectData.runs.push(rec('runs',11,{ITERATION_ID:'ITER-STAGE17',CANDIDATE_ID:'CAND-STAGE17',EXECUTION_STATUS:'COMPLETED',STATUS:'COMPLETED'},runId,{...iterScope,runId}));const v=rec('verification',12,{REQ_ID:'REQ-STAGE17',RUN_ID:runId,TEST_ID:'TEST-STAGE17',OBSERVED_RESULT:'SATISFIED',EXPECTED_RESULT:'SATISFIED',DETERMINATION:'SATISFIED',EFFECTIVE_DETERMINATION:'SATISFIED'},`VERIFY-STAGE17-${i}`,{...iterScope,runId});p.projectData.verification.push(v);}
const normalized={dimensions:['INTERPRETATION_VARIANCE','OUTPUT_VARIANCE'],allowedVariance:'NONE',rationale:'No cross-run semantic or output variance is authorized.'};const c=rec('expectedVarianceContracts',6,{DIMENSIONS:normalized.dimensions,RATIONALE:normalized.rationale,ALLOWED_VARIANCE:'NONE',NORMALIZED_CONTRACT:normalized,FROZEN_AT:'2026-09-04T00:00:00.000Z',SCOPE:{...iterScope},CONTRACT_SHA256:hash.sha256Value(normalized),STATUS:'FROZEN'},'VARIANCE-STAGE17',iterScope);p.projectData.expectedVarianceContracts.push(c);const comparison=rec('comparisons',13,{REQ_ID:'REQ-STAGE17',RUN_DETERMINATIONS:'All ten SATISFIED',INTERPRETATION_VARIANCE:'NONE',OUTPUT_VARIANCE:'NONE',AUTHORIZED_VARIANCE:'TRUE',INCONCLUSIVE_TESTS:'NONE',REPEATED_FAILURE_PATTERNS:'NONE',UNIQUE_FAILURES:'NONE',CORRECTNESS_AFFECTING_VARIANCE:'FALSE',DEFECT_IDS:'NONE',EVIDENCE:'Ten-run comparison fixture'},'COMPARE-STAGE17',iterScope);p.projectData.comparisons.push(comparison);p.stages[13].acceptedResponseIds=['RAW-STAGE17'];engine.recalculate(p);let review=engine.stage13VarianceReview(p);assert(review.contracts.length===1&&review.evaluations[0]?.classification==='ALLOWED','No-variance ten-run comparison was not accepted under frozen contract.');let g=engine.gate(13,p);assert(g.complete,`Valid frozen-contract comparison did not complete: ${g.reasons.join(' | ')}`);let d=engine.deriveStageData(13,p);assert(d.PROHIBITED_OUTPUT_VARIANCES===0&&d.STAGE_DECISION==='ACCEPTED','Stage 13 application aggregates did not report accepted no-variance state.');
const saved=p.projectData.expectedVarianceContracts.splice(0);engine.recalculate(p);g=engine.gate(13,p);assert(!g.complete&&g.reasons.some(x=>x.includes('frozen expected-variance contract')),'Missing frozen variance contract did not block.');p.projectData.expectedVarianceContracts.push(...saved);set(comparison,'OUTPUT_VARIANCE','FORMAT_DIFFERENCE');set(comparison,'AUTHORIZED_VARIANCE','TRUE');engine.recalculate(p);review=engine.stage13VarianceReview(p);assert(review.evaluations[0].classification==='PROHIBITED_MISSING_DEFECT','Agent self-authorization overrode a NONE variance contract.');g=engine.gate(13,p);assert(!g.complete&&g.reasons.some(x=>x.includes('PROHIBITED_MISSING_DEFECT')),'Prohibited variance without defect did not block.');set(c,'ALLOWED_VARIANCE','FORMAT_DIFFERENCE');c.NORMALIZED_CONTRACT=c.fields.NORMALIZED_CONTRACT={...normalized,allowedVariance:'FORMAT_DIFFERENCE'};c.CONTRACT_SHA256=c.fields.CONTRACT_SHA256=hash.sha256Value(c.NORMALIZED_CONTRACT);engine.recalculate(p);review=engine.stage13VarianceReview(p);assert(review.evaluations[0].classification==='ALLOWED','Exact frozen contract authorization did not allow the reported variance.');g=engine.gate(13,p);assert(g.complete,`Explicitly allowed variance remained blocked: ${g.reasons.join(' | ')}`);set(c,'ALLOWED_VARIANCE','OTHER_DIFFERENCE');c.NORMALIZED_CONTRACT=c.fields.NORMALIZED_CONTRACT={...normalized,allowedVariance:'OTHER_DIFFERENCE'};c.CONTRACT_SHA256=c.fields.CONTRACT_SHA256=hash.sha256Value(c.NORMALIZED_CONTRACT);engine.recalculate(p);review=engine.stage13VarianceReview(p);assert(review.evaluations[0].classification==='UNKNOWN','Nonmatching non-NONE contract must remain UNKNOWN, not allowed.');g=engine.gate(13,p);assert(!g.complete&&g.reasons.some(x=>x.includes('UNKNOWN')),'UNKNOWN variance did not block.');console.log(JSON.stringify({controllerStage:'17',applicationStage:'13',crossRunComparison:'PASS',currentRuns:10,frozenContractApplicationStamping:'PASS',agentSelfAuthorizationIgnored:true,intentionalInvalidFixturesRejected:['missing-frozen-contract','agent-self-authorized-prohibited-variance','unknown-variance'],isolatedDisposableProject:true,externalActorEvidenceClaimed:false,physicalDeviceEvidenceClaimed:false}));
`;
fs.writeFileSync('verify-cross-run-expected-variance.mjs',verifier);

replaceOnce('verify-spec-residual-closure.mjs',"await import('./verify-independent-run-verification.mjs');","await import('./verify-independent-run-verification.mjs');\nawait import('./verify-cross-run-expected-variance.mjs');");

console.log('Stage 17 materialization complete.');

import fs from 'node:fs';import vm from 'node:vm';
import strictAssert from 'node:assert/strict';
import {reviewApplicabilityFixture} from './test-fixtures.mjs';
const assert=(c,m)=>{if(!c)throw new Error(m)};
globalThis.Event=globalThis.Event||class Event{};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f});
const s=closedLoopWorkflowSchema,e=closedLoopWorkflowEngine,c=(st,op)=>s.operationContract(st,op),has=(x,n)=>x.includes(n);
assert(has(c(1,'SEMANTIC_CHALLENGE').agentWritableCollections,'semanticChallenges'),'Stage 1 challenge missing durable challenge family');assert(!c(1,'SEMANTIC_CHALLENGE').allowedStageData.length,'Stage 1 challenge can overwrite intake stageData');assert(has(c(1,'RECONCILE_INTAKE').agentWritableCollections,'semanticReviews'),'Stage 1 reconciliation missing semantic review record');
assert(has(c(2,'COMPLETE').agentWritableCollections,'sourceSearchContracts'),'Stage 2 COMPLETE cannot create bounded search contract');assert(has(c(2,'SEARCH_ADEQUACY_REVIEW').agentWritableCollections,'semanticReviews'),'Stage 2 adequacy review cannot create independent review');assert(!has(c(2,'SEARCH_ADEQUACY_REVIEW').agentWritableCollections,'sources'),'Stage 2 reviewer can overwrite author source set');for(const n of ['sources','sourceSearchContracts'])assert(has(c(2,'SEARCH_ADEQUACY_REVIEW').readCollections,n),`Stage2 adequacy review omits ${n}`);
for(const op of ['DISPOSITION_CHALLENGE','ATOMICITY_CHALLENGE']){assert(has(c(4,op).agentWritableCollections,'semanticChallenges'),`Stage4 ${op} missing challenge family`);assert(!has(c(4,op).agentWritableCollections,'requirements'),`Stage4 ${op} can overwrite requirements`);}assert(has(c(4,'RECONCILE_REQUIREMENTS').readCollections,'semanticChallenges'),'Stage4 reconciliation cannot read challenges');assert(has(c(4,'RECONCILE_REQUIREMENTS').agentWritableCollections,'semanticReviews'),'Stage4 reconciliation missing review record');
assert(has(c(5,'SEMANTIC_REVIEW').agentWritableCollections,'semanticReviews'),'Stage5 semantic review missing review family');assert(!has(c(5,'SEMANTIC_REVIEW').agentWritableCollections,'requirementResolutions'),'Stage5 reviewer can overwrite author result');assert(has(c(5,'RECONCILE_REQUIREMENT_SET').readCollections,'semanticReviews'),'Stage5 reconciliation cannot read review');
assert(has(c(6,'COMPLETE').agentWritableCollections,'expectedVarianceContracts'),'Stage6 COMPLETE cannot create expected variance contracts');assert(has(c(6,'PROOF_REVIEW').agentWritableCollections,'semanticReviews'),'Stage6 proof review missing semantic review family');assert(!has(c(6,'PROOF_REVIEW').agentWritableCollections,'tests'),'Stage6 proof reviewer can overwrite tests');assert(has(c(6,'RECONCILE_VERIFICATION_SUITE').readCollections,'semanticReviews'),'Stage6 reconciliation cannot read reviews');

// These are authority-component fixtures with stipulated earlier requirements.
// They do not claim a complete workflow, external semantic truth, or a human review.
const results=[];
function component({normative='MANDATORY',disposition='APPLICABLE'}={}){
 const p=closedLoopCore.createBlankState('SEMANTIC-COMPONENT');Object.assign(p.job,{CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_RESEARCH_VERSION:'RESEARCH-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001'});e.ensureShape(p);
 for(let stage=1;stage<=4;stage++)p.stages[stage]={...p.stages[stage],status:'COMPLETE',gate:{complete:true}};
 const scope=e.currentScope(p);
 const rec=(family,id,fields,stage)=>({id,stage,active:true,scope:{...scope},fields:{...fields,[s.RECORD_SCHEMAS[family].idField]:id}});
 p.projectData.requirements.push(rec('requirements','REQ-SCOPE',{MANDATORY_OPTIONAL_STATUS:normative,OBLIGATION:'The stipulated governing obligation applies within its specified subject scope.',STATUS:'ACTIVE'},4));
 p.projectData.propositions.push(rec('propositions','PROP-SCOPE',{REQUIREMENT_ID:'REQ-SCOPE',PROPOSITION_TEXT:'The stipulated subject-scope obligation holds.',STATUS:'CURRENT'},4));
 p.projectData.applicabilityRecords.push(rec('applicabilityRecords','APP-SCOPE',{SUBJECT_ID:'PROP-SCOPE',PROPOSED_APPLICABILITY:disposition,SELECTED_APPLICABILITY:disposition},5));
 reviewApplicabilityFixture({engine:e,prompts:closedLoopPromptEngine,ingestion:closedLoopResponseIngestion,schema:s},p);
 return p;
}
const reviewed=component(),copy=()=>structuredClone(reviewed),currentReview=p=>e.recordsForCurrentScope(p,'semanticReviews').at(-1);
assert(e.evaluateApplicability(reviewed,'PROP-SCOPE')==='APPLICABLE','Actual accepted application review did not establish the stipulated applicability.');
for(const [caseId,mutate] of [
 ['missing-review',p=>{p.projectData.semanticReviews=[];}],
 ['same-context-review',p=>{const r=currentReview(p);r.fields.REVIEWER_CONTEXT_ID=r.REVIEWER_CONTEXT_ID=e.recordValue(r,'AUTHOR_CONTEXT_ID');e.refreshRecordHashes(r,'semanticReviews');}],
 ['unreconciled-disagreement',p=>{const r=currentReview(p);r.fields.RESULT=r.RESULT='DISAGREED';r.fields.RECONCILIATION_STATUS=r.RECONCILIATION_STATUS='REQUIRED';e.refreshRecordHashes(r,'semanticReviews');}]
]){
 const p=copy();mutate(p);assert(e.evaluateApplicability(p,'PROP-SCOPE')==='UNKNOWN',caseId+' incorrectly established applicability');
 assert(e.evaluateApplicability(copy(),'PROP-SCOPE')==='APPLICABLE','Restored accepted review did not recover');results.push({caseId,result:'PASS',restored:'APPLICABLE'});
}
const outsideScope=component({disposition:'NOT_APPLICABLE'});
assert(e.evaluateApplicability(outsideScope,'PROP-SCOPE')==='NOT_APPLICABLE','A current accepted out-of-scope determination was prohibited.');
assert(e.mandatoryRequirements(outsideScope).length===0,'Current accepted NOT_APPLICABLE decision did not update coverage.');
results.push({caseId:'accepted-not-applicable-component',result:'PASS',externalSemanticTruthEstablished:false});

// Application-owned SATISFACTION_STATE cannot replace an actual activation
// proof. Both controls below have a real accepted applicability review.
const conditional=component({normative:'CONDITIONAL'});
assert(e.evaluateApplicability(conditional,'PROP-SCOPE')==='UNKNOWN','Unknown activation passed');
const activation={id:'UNLINKED-ACTIVATION',stage:6,active:true,scope:e.currentScope(conditional),fields:{PROOF_OBLIGATION_ID:'UNLINKED-ACTIVATION',SATISFACTION_STATE:'SATISFIED'}};conditional.projectData.proofObligations.push(activation);
assert(e.evaluateApplicability(conditional,'PROP-SCOPE')==='UNKNOWN','ACTIVATION_PROOF_ORACLE: an unlinked success flag supplied missing activation proof');
results.push({caseId:'unlinked-activation-success',result:'PASS',actual:'UNKNOWN',validActivationJourneyEstablished:false});
const engineSource=fs.readFileSync('workflow-engine.js','utf8'),start=engineSource.indexOf("if(normative(fv(requirement,'MANDATORY_OPTIONAL_STATUS'))==='CONDITIONAL'){"),end=engineSource.indexOf('}return x;',start);
assert(start>=0&&end>start,'Missing activation authority mutation target');
const isolated=vm.createContext({console,TextEncoder,TextDecoder,crypto:globalThis.crypto,dispatchEvent(){},Event:class{}});
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js'])vm.runInContext(fs.readFileSync(file,'utf8'),isolated,{filename:file});
vm.runInContext(engineSource.slice(0,start)+engineSource.slice(end+1),isolated,{filename:'workflow-engine.js'});
const copied=vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify(conditional))+')',isolated);
strictAssert.throws(()=>strictAssert.equal(isolated.closedLoopWorkflowEngine.evaluateApplicability(copied,'PROP-SCOPE'),'UNKNOWN','ACTIVATION_PROOF_ORACLE'),/ACTIVATION_PROOF_ORACLE/);
results.push({caseId:'bypassed-activation-proof',result:'DETECTED',restored:'UNKNOWN'});
assert(e.evaluateApplicability(conditional,'PROP-SCOPE')==='UNKNOWN','Production activation guard was not restored');

const unknown=component({normative:'UNKNOWN'}),obligations=e.deriveProofObligations(unknown).records;
assert(obligations.some(row=>e.recordValue(row,'REQUIREMENT_ID')==='REQ-SCOPE'&&e.safe(e.recordValue(row,'BLOCKING_REASONS')).includes('UNKNOWN_NORMATIVE_CLASS')),'Unknown normative classification was reduced');
results.push({caseId:'unknown-normative-class',result:'PASS'});
// Graph component: this checks the dependency reason, without asserting that
// all other stage prerequisites become satisfied when the cycle is removed.
const cycle=copy(),req=e.records(cycle,'requirements')[0],second=structuredClone(req);second.id='REQ-SECOND';second.fields.REQ_ID=second.REQ_ID='REQ-SECOND';cycle.projectData.requirements.push(second);
req.fields.DEPENDENCIES=req.DEPENDENCIES='REQ-SECOND';second.fields.DEPENDENCIES=second.DEPENDENCIES='REQ-SCOPE';
assert(e.gate(5,cycle).reasons.some(reason=>/Circular requirement dependency detected/.test(reason)),'Circular dependency was not reported');
req.fields.DEPENDENCIES=req.DEPENDENCIES='';second.fields.DEPENDENCIES=second.DEPENDENCIES='';
assert(!e.gate(5,cycle).reasons.some(reason=>/Circular requirement dependency detected/.test(reason)),'Removed cycle remained reported');
results.push({caseId:'requirement-dependency-cycle',result:'PASS',restored:'cycle absent'});
console.log(JSON.stringify({semanticOperationBoundaries:'PASS',evidenceClass:'authority and dependency components with stipulated prerequisites',actualBrowserJourney:false,externalSemanticTruthEstablished:false,validActivationJourneyEstablished:false,results}));

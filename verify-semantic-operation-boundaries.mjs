import {canonicalFixtureRecord,reviewApplicabilityFixture} from './test-fixtures.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';import vm from 'node:vm';
const assert=(c,m)=>{if(!c)throw new Error(m)};
globalThis.Event=globalThis.Event||class Event{};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(f,'utf8'),{filename:f});
const s=closedLoopWorkflowSchema,e=closedLoopWorkflowEngine,c=(st,op)=>s.operationContract(st,op),has=(x,n)=>x.includes(n);
assert(has(c(1,'SEMANTIC_CHALLENGE').agentWritableCollections,'semanticChallenges'),'Stage 1 challenge missing durable challenge family');assert(!c(1,'SEMANTIC_CHALLENGE').allowedStageData.length,'Stage 1 challenge can overwrite intake stageData');assert(has(c(1,'RECONCILE_INTAKE').agentWritableCollections,'semanticReviews'),'Stage 1 reconciliation missing semantic review record');
assert(has(c(2,'COMPLETE').agentWritableCollections,'sourceSearchContracts'),'Stage 2 COMPLETE cannot create bounded search contract');assert(has(c(2,'SEARCH_ADEQUACY_REVIEW').agentWritableCollections,'semanticReviews'),'Stage 2 adequacy review cannot create independent review');assert(!has(c(2,'SEARCH_ADEQUACY_REVIEW').agentWritableCollections,'sources'),'Stage 2 reviewer can overwrite author source set');for(const n of ['sources','sourceSearchContracts'])assert(has(c(2,'SEARCH_ADEQUACY_REVIEW').readCollections,n),`Stage2 adequacy review omits ${n}`);
for(const op of ['DISPOSITION_CHALLENGE','ATOMICITY_CHALLENGE']){assert(has(c(4,op).agentWritableCollections,'semanticChallenges'),`Stage4 ${op} missing challenge family`);assert(!has(c(4,op).agentWritableCollections,'requirements'),`Stage4 ${op} can overwrite requirements`);}assert(has(c(4,'RECONCILE_REQUIREMENTS').readCollections,'semanticChallenges'),'Stage4 reconciliation cannot read challenges');assert(has(c(4,'RECONCILE_REQUIREMENTS').agentWritableCollections,'semanticReviews'),'Stage4 reconciliation missing review record');
assert(has(c(5,'SEMANTIC_REVIEW').agentWritableCollections,'semanticReviews'),'Stage5 semantic review missing review family');assert(!has(c(5,'SEMANTIC_REVIEW').agentWritableCollections,'requirementResolutions'),'Stage5 reviewer can overwrite author result');assert(has(c(5,'RECONCILE_REQUIREMENT_SET').readCollections,'semanticReviews'),'Stage5 reconciliation cannot read review');
assert(has(c(6,'COMPLETE').agentWritableCollections,'expectedVarianceContracts'),'Stage6 COMPLETE cannot create expected variance contracts');assert(has(c(6,'PROOF_REVIEW').agentWritableCollections,'semanticReviews'),'Stage6 proof review missing semantic review family');assert(!has(c(6,'PROOF_REVIEW').agentWritableCollections,'tests'),'Stage6 proof reviewer can overwrite tests');assert(has(c(6,'RECONCILE_VERIFICATION_SUITE').readCollections,'semanticReviews'),'Stage6 reconciliation cannot read reviews');

const p=closedLoopCore.createBlankState('JOB-STAGE17-SEMANTIC-REVIEW');Object.assign(p.job,{CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_RESEARCH_VERSION:'RESEARCH-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001'});e.ensureShape(p);
const runtime={engine:e,schema:s,prompts:closedLoopPromptEngine,ingestion:closedLoopResponseIngestion};
for(let stage=1;stage<6;stage++){p.stages[stage].status='COMPLETE';p.stages[stage].gate={complete:true,blocked:false,reasons:[]};}
const rec=(family,fields)=>canonicalFixtureRecord(runtime,p,family,fields),set=(row,key,value)=>{row.fields[key]=row[key]=value;};
function obligation(kind,text){
 const req=rec('requirements',{MANDATORY_OPTIONAL_STATUS:kind,STATUS:'ACTIVE',OBLIGATION:text});
 const prop=rec('propositions',{REQUIREMENT_ID:req.id,PROPOSITION_TEXT:text,STATUS:'CURRENT'});
 const app=rec('applicabilityRecords',{SUBJECT_ID:prop.id,PROPOSED_APPLICABILITY:'APPLICABLE',SELECTED_APPLICABILITY:'APPLICABLE',REASONING:'Controlled governing obligation applies.',CURRENT_SCOPE_STATUS:'CURRENT',FRESHNESS_STATUS:'CURRENT',CONTRADICTION_STATUS:'CLEAR'});
 return {req,prop,app};
}
const ordinary=obligation('MANDATORY','The mandatory deliverable obligation is satisfied.');
assert(e.evaluateApplicability(p,ordinary.prop.id)==='UNKNOWN','Stage 05 promoted an author applicability assertion without an accepted independent semantic review.');
reviewApplicabilityFixture(runtime,p);
assert(e.evaluateApplicability(p,ordinary.prop.id)==='APPLICABLE','Accepted independent Stage 05 semantic review did not restore applicability progression.');
for(const [name,mutate] of [
 ['self-review',row=>set(row,'REVIEWER_CONTEXT_ID',e.recordValue(row,'AUTHOR_CONTEXT_ID'))],
 ['unreconciled-disagreement',row=>{set(row,'RESULT','DISAGREED');set(row,'ACCEPTED_DISPOSITION','UNKNOWN');set(row,'RECONCILIATION_STATUS','REQUIRED');}],
 ['missing-reviewed-hashes',row=>set(row,'REVIEWED_HASHES',[])],
]){
 const invalid=e.clone(p);mutate(invalid.projectData.semanticReviews.at(-1));
 assert(e.evaluateApplicability(invalid,ordinary.prop.id)==='UNKNOWN',`Stage 05 accepted ${name}.`);
}
const conditional=obligation('CONDITIONAL','Conditional obligation.');
reviewApplicabilityFixture(runtime,p);
assert(e.evaluateApplicability(p,conditional.prop.id)==='UNKNOWN','Conditional applicability passed without a current activation expression.');
const early={VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:5,REQUIRED_BY_STAGE:5,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'}};
const proposed={type:'LEAF',applicabilityId:ordinary.app.id,truthExtraction:'APPLICATION_APPLICABILITY',evidenceClasses:['ACCEPTED_SEMANTIC_REVIEW'],scopeBinding:'CURRENT',proposedTiming:early};
const checked=e.validateProofExpression(proposed,{resolveReference:(_family,id)=>id});assert(checked.valid,'Controlled activation expression is invalid.');
const capp=p.projectData.applicabilityRecords.find(row=>row.id===conditional.app.id);set(capp,'PROPOSED_ACTIVATION_EXPRESSION',proposed);set(capp,'NORMALIZED_ACTIVATION_EXPRESSION',checked.normalized);e.refreshRecordHashes(capp,'applicabilityRecords');
assert(e.evaluateApplicability(p,conditional.prop.id)==='UNKNOWN','Changed activation expression reused an earlier review.');
reviewApplicabilityFixture(runtime,p);
assert(e.evaluateApplicability(p,conditional.prop.id)==='APPLICABLE','Reviewed current activation did not restore conditional applicability at Stage 05.');
assert(e.records(p,'proofObligations').every(row=>!e.recordValue(row,'SATISFACTION_STATE')||e.recordValue(row,'SATISFACTION_STATE')!=='SATISFIED'),'Fixture silently supplied future satisfied proof.');
const unknown=obligation('UNKNOWN','Unclassified possible obligation.');reviewApplicabilityFixture(runtime,p);
const unknownObligation=e.deriveProofObligations(p).records.find(row=>e.recordValue(row,'REQUIREMENT_ID')===unknown.req.id);
assert(unknownObligation&&e.safe(e.recordValue(unknownObligation,'BLOCKING_REASONS')).includes('UNKNOWN_NORMATIVE_CLASS'),'Unknown possible-mandatory classification was silently reduced instead of blocked.');
const obligationFor=proposition=>e.deriveProofObligations(p).records.find(row=>e.recordValue(row,'PROPOSITION_ID')===proposition.id);
const initialDependencyObligation=obligationFor(ordinary.prop);
assert(initialDependencyObligation&&initialDependencyObligation.stage===6&&initialDependencyObligation.source==='APPLICATION_DERIVED','Proof obligation was not application-derived at literal Stage 6.');
assert(e.safe(e.recordValue(initialDependencyObligation,'REQUIRED_DEPENDENCY_IDS')).length===0,'Controlled proposition unexpectedly began with a required environment dependency.');
const dependencyObligationId=initialDependencyObligation.id;
const unrelatedDependency=rec('environmentDependencies',{DEPENDENCY_DESCRIPTION:'Unrelated controlled environment dependency.',PROPOSED_REQUIRED_CONDITION:'The unrelated proposition environment remains available.',TARGET_PROPOSITION_IDS:[conditional.prop.id]});
const unrelatedDependencyObligation=obligationFor(ordinary.prop);
assert(unrelatedDependencyObligation.id===dependencyObligationId,'An unrelated dependency replaced the controlled proposition obligation.');
assert(e.safe(e.recordValue(unrelatedDependencyObligation,'REQUIRED_DEPENDENCY_IDS')).length===0,'An unrelated proposition dependency leaked into the controlled proposition obligation.');
const unrelatedDependencySetHash=e.recordValue(unrelatedDependencyObligation,'PROOF_OBLIGATION_SET_HASH');
const targetedDependency=rec('environmentDependencies',{DEPENDENCY_DESCRIPTION:'Controlled required environment dependency.',PROPOSED_REQUIRED_CONDITION:'The controlled proposition environment remains available.',TARGET_PROPOSITION_IDS:[ordinary.prop.id]});
const targetedDependencyObligation=obligationFor(ordinary.prop);
assert(targetedDependencyObligation.id===dependencyObligationId,'A dependency change replaced rather than recalculated the current proof obligation.');
assert(JSON.stringify(e.safe(e.recordValue(targetedDependencyObligation,'REQUIRED_DEPENDENCY_IDS')))===JSON.stringify([targetedDependency.id]),'The recalculated proof obligation did not contain exactly the targeted current dependency.');
assert(e.recordValue(targetedDependencyObligation,'PROOF_OBLIGATION_SET_HASH')!==unrelatedDependencySetHash,'A targeted dependency change did not change the proof-obligation set hash.');
targetedDependency.active=false;e.refreshRecordHashes(targetedDependency,'environmentDependencies');
const restoredDependencyObligation=obligationFor(ordinary.prop);
assert(restoredDependencyObligation.id===dependencyObligationId,'Dependency removal replaced rather than recalculated the current proof obligation.');
assert(e.safe(e.recordValue(restoredDependencyObligation,'REQUIRED_DEPENDENCY_IDS')).length===0,'An inactive dependency remained required by the recalculated proof obligation.');
assert(e.recordValue(restoredDependencyObligation,'PROOF_OBLIGATION_SET_HASH')===unrelatedDependencySetHash,'Removing the targeted dependency did not restore the independently observed obligation-set hash.');

const proofObligationDependencyRecalculation={schema:'closed-loop-proof-obligation-dependency-recalculation/1',status:'PASS',cases:['stage6-application-derived-initial-obligation','unrelated-dependency-excluded','targeted-dependency-recalculates-same-obligation','targeted-dependency-changes-set-hash','inactive-dependency-excluded','dependency-removal-restores-set-hash'],stage:6,source:'APPLICATION_DERIVED',synthetic:true,actualBrowser:false,persistenceExercised:false,fullClauseProof:false,boundary:'Synthetic in-memory production derivation for one current application-derived proposition: exact targeted environment dependency addition/removal, stable obligation identity and independently compared set-hash change/restoration. No persistence, browser, arbitrary dependency family, Stage 6 completion or whole-clause proof.'};

const a=obligation('MANDATORY','Cycle A.'),b=obligation('MANDATORY','Cycle B.');set(a.req,'DEPENDENCIES',b.req.id);set(b.req,'DEPENDENCIES',a.req.id);e.refreshRecordHashes(a.req,'requirements');e.refreshRecordHashes(b.req,'requirements');reviewApplicabilityFixture(runtime,p);
assert(e.gate(5,p).reasons.some(reason=>/Circular requirement dependency detected/.test(reason)),'Stage 05 did not block a circular requirement dependency.');
for(const id of [a.req.id,b.req.id]){const row=p.projectData.requirements.find(item=>item.id===id);set(row,'DEPENDENCIES','');e.refreshRecordHashes(row,'requirements');}
assert(!e.gate(5,p).reasons.some(reason=>/Circular requirement dependency detected/.test(reason)),'Stage 05 remained blocked after the circular dependency fixture was repaired.');
console.log(JSON.stringify({semanticOperationBoundaries:'PASS',proofObligationDependencyRecalculation,controllerStage:'17',applicationStage:'05',intentionalInvalidFixturesRejected:['missing-independent-applicability-review','self-review','unreconciled-disagreement','missing-reviewed-hashes','missing-activation-expression','changed-activation-contract','unsupported-normative-reduction','circular-dependency'],repairedPathProgressed:true,isolatedDisposableProject:true,reviewCommittedThroughProductionIngestion:true}));

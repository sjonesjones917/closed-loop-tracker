import fs from 'node:fs';
import vm from 'node:vm';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,hash=globalThis.closedLoopHash;
const assert=(value,message)=>{if(!value)throw new Error(message);};
const scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TEST-SUITE-v001',instructionVersion:'INSTRUCTION-v001',iterationId:'ITER-1',candidateId:'CAND-1'};
const p=core.createBlankState('JOB-ADJUDICATION-INVARIANT');Object.assign(p.job,{CURRENT_INPUT_VERSION:scope.inputVersion,CURRENT_SOURCE_SET_VERSION:scope.sourceSetVersion,CURRENT_REQUIREMENTS_VERSION:scope.requirementsVersion,CURRENT_TEST_SUITE_VERSION:scope.testSuiteVersion,CURRENT_INSTRUCTION_VERSION:scope.instructionVersion,CURRENT_ITERATION:scope.iterationId});engine.ensureShape(p);
p.projectData.requirements.push({id:'REQ-1',stage:4,active:true,scope,fields:{REQ_ID:'REQ-1',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}});
p.projectData.tests.push({id:'TEST-1',stage:6,active:true,scope,fields:{TEST_ID:'TEST-1',REQ_ID:'REQ-1',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'review',ARTIFACT_REQUIREMENTS:'NONE',PROCEDURE:'Compare exact controlled outcome.',EXPECTED_RESULT:'PASSED',FAILURE_CONDITION:'FAILED',EVIDENCE_TO_PRESERVE:'Canonical execution receipt',STATUS:'READY'},relationships:{REQ_ID:'REQ-1'}});
const test=p.projectData.tests[0];
function record(collection,fields={},extra={}){return {id:`${collection}-X`,stage:extra.stage??99,active:true,scope:{...scope,...(extra.scope||{})},fields:{...fields},relationships:extra.relationships||{},evidenceRefs:extra.evidenceRefs||[],rawResponseId:extra.rawResponseId,sourceProposalId:extra.sourceProposalId,completionState:extra.completionState};}
function notSatisfied(collection,row,controlling=test){const result=engine.evaluateResultConsistency(collection,row,controlling,p);assert(result.determination!=='SATISFIED',`${collection} contradictory/missing evidence state was accepted`);return result;}
const cases=[
 ['verification',record('verification',{REQ_ID:'REQ-1',RUN_ID:'RUN-X',TEST_ID:'TEST-1',OBSERVED_RESULT:'FAILED',EXPECTED_RESULT:'PASSED',VERIFIER_CONTEXT_ID:'CTX-X',DETERMINATION:'SATISFIED'})],
 ['deterministicResults',record('deterministicResults',{TEST_ID:'TEST-1',ACTUAL_RESULT:'FAILED',EXPECTED_RESULT:'PASSED',DETERMINATION:'SATISFIED'})],
 ['meaningResults',record('meaningResults',{TEST_ID:'TEST-1',OBSERVED_MEANING:'WRONG',REQUIRED_MEANING:'RIGHT',EVIDENCE_BASED_COMPARISON:'FAILED',DETERMINATION:'SATISFIED'})],
 ['adversarialResults',record('adversarialResults',{TEST_ID:'TEST-1',ACTUAL_RESULT:'FAILED',DETERMINATION:'SATISFIED',SEVERITY:'MAJOR'})],
 ['representationInspections',record('representationInspections',{ARTIFACT_ID:'ART-X',OBSERVATIONS:'defect present',RENDERING_OPENING_EVIDENCE:'opened',DETERMINATION:'SATISFIED'})],
 ['preflightRecords',record('preflightRecords',{MULTIPLE_INTERPRETATIONS:'material ambiguity',OBJECTIVELY_VERIFIABLE:'TRUE',RESPONSIBLE_OPERATION_ASSIGNED:'TRUE',ORDER_CLEAR:'TRUE',FAILURE_BEHAVIOR_DEFINED:'TRUE',TRACEABILITY:'TRUE',DETERMINATION:'SATISFIED'})],
 ['confirmationRecords',record('confirmationRecords',{SOURCE_ITERATION_ID:'ITER-0',CONFIRMATION_ITERATION_ID:'ITER-1',ZERO_MATERIAL_CHANGES:'FALSE',NEW_DEFECTS:'1',DETERMINATION:'SATISFIED'})],
 ['processAudits',record('processAudits',{PROCESS_DETERMINATION:'SATISFIED',UNAUTHORIZED_MODIFICATION:'YES',APPROVED_INPUTS_VS_ACTUAL:'MATCH',APPROVED_INSTRUCTION_VS_ACTUAL:'MATCH',APPROVED_TOOLS_VS_ACTUAL:'MATCH',REQUIRED_TESTS_VS_EXECUTED:'MATCH',CHAIN_OF_CUSTODY:'COMPLETE',PROCESS_DEFECTS:'NONE',BLOCKERS:'NONE'})],
 ['productAudits',record('productAudits',{PRODUCT_DETERMINATION:'SATISFIED',VALIDATOR_RESULTS:'FAILED',MEANING_VERIFICATION_RESULTS:'SATISFIED',PRODUCT_DEFECTS:'NONE',BLOCKERS:'NONE'})],
 ['products',record('products',{STATUS:'COMPLETED',FAILURES:'FAILED',DEVIATIONS:'NONE'},{completionState:'COMPLETED'})],
 ['regressionExecutions',record('regressionExecutions',{REG_ID:'REG-1',PHASE:'POST_CORRECTION',RESULT:'SATISFIED'})],
 ['failureTests',record('failureTests',{EXECUTION_OUTCOME:'REJECTED_INVALID',ACTUAL_RESULT:'REJECTED',EXPECTED_REJECTION:'REJECT'})]
];
for(const [collection,row] of cases)notSatisfied(collection,row,collection==='products'||collection==='processAudits'||collection==='productAudits'||collection==='confirmationRecords'||collection==='regressionExecutions'||collection==='failureTests'?null:test);

// Claimed success can expose a contradiction, but can never establish success without the application's evidence contract.
for(const [collection,row] of cases){if(collection==='products'||collection==='regressionExecutions'||collection==='failureTests')continue;const claim=collection==='processAudits'?row.fields.PROCESS_DETERMINATION:collection==='productAudits'?row.fields.PRODUCT_DETERMINATION:row.fields.DETERMINATION;if(String(claim||'').toUpperCase()==='SATISFIED'){const contradictions=engine.detectCurrentContradictions({...p,projectData:{...p.projectData,[collection]:[row]}});assert(Array.isArray(contradictions),`${collection} contradiction scan failed`);}}

// Stage 25 uses one strict structured coverage semantics for both aggregate coverage and effective determination.
{
 const representationScope={...scope,productId:'PRODUCT-REP'};
 p.job.CURRENT_PRODUCT_ID='PRODUCT-REP';
 p.projectData.artifacts.push({id:'ART-REP',stage:25,active:true,scope:representationScope,fields:{ARTIFACT_ID:'ART-REP',FILENAME:'delivery.pdf',SHA256:'b'.repeat(64),AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'}});
 p.projectData.evidenceRecords.push({id:'EVIDENCE-REP',stage:25,active:true,scope:representationScope,fields:{EVIDENCE_ID:'EVIDENCE-REP',KIND:'REPRESENTATION_INSPECTION',AUTHORITY_TYPE:'INDEPENDENT_REVIEWER',DESCRIPTION:'Representation opened and inspected.',CONTENT:'All contracted views and packaged files were inspected.'}});
 const structuredObservation=JSON.stringify({requiredPageOrViewIds:['VIEW-1'],inspectedPageOrViewIds:['VIEW-1'],requiredPackagedFileIds:['FILE-1'],openedOrTestedPackagedFileIds:['FILE-1'],requiredTransformationIds:['TRANSFORM-1'],inspectedTransformationIds:['TRANSFORM-1'],observation:'No material representation defect observed.'});
 const good=record('representationInspections',{ARTIFACT_ID:'ART-REP',OBSERVATIONS:structuredObservation,RENDERING_OPENING_EVIDENCE:'EVIDENCE-REP',DETERMINATION:'SATISFIED'},{stage:25,scope:{productId:'PRODUCT-REP'},evidenceRefs:['EVIDENCE-REP']});
 good.id='INSPECTION-REP-GOOD';good.relationships={ARTIFACT_ID:'ART-REP'};p.projectData.representationInspections.push(good);
 const effective=engine.evaluateResultConsistency('representationInspections',good,null,p);assert(effective.determination==='SATISFIED','Strict Stage 25 coverage JSON was not accepted by effective determination');
 const aggregate=engine.representationInspectionCoverage(p);assert(aggregate.complete,'Strict Stage 25 coverage JSON was not accepted by aggregate coverage');
 good.fields.OBSERVATIONS=JSON.stringify({...JSON.parse(structuredObservation),inspectedPageOrViewIds:[]});
 const broken=engine.evaluateResultConsistency('representationInspections',good,null,p);assert(broken.determination!=='SATISFIED','Incomplete Stage 25 structured coverage was accepted by effective determination');
 p.projectData.representationInspections.pop();p.projectData.evidenceRecords.pop();p.projectData.artifacts.pop();delete p.job.CURRENT_PRODUCT_ID;
}

// Trace integrity is fail-closed: missing evidence/identity/layer linkage cannot pass RCA or changeset validation.
const badRca=record('rootCauses',{DEFECT_ID:'DEFECT-X',LAYER_TRACE:'x',EARLIEST_DEFECTIVE_LAYER:'INSTRUCTION',ROOT_CAUSE:'claim',DOWNSTREAM_INVALIDATION:'17+'});assert(!engine.validateTraceIntegrity('RCA',badRca,p).valid,'Unresolved RCA trace passed');
const badChange=record('changes',{TRIGGERING_DEFECT_IDS:'DEFECT-X',RESPONSIBLE_LAYER:'INSTRUCTION',OLD_ARTIFACT_VERSION:'v1',EXACT_MODIFICATION:'x',NEW_ARTIFACT_VERSION:'v2',DOWNSTREAM_INVALIDATION:'17+',REQUIRED_RERUNS:'all'});assert(!engine.validateTraceIntegrity('CHANGESET',badChange,p).valid&&!engine.validateTraceIntegrity('CHANGE',badChange,p).valid,'Unresolved changeset trace passed');

// Release-grade independence requires application-established context or a canonical accepted external execution receipt; a naked verifier claim is insufficient.
assert(typeof engine.releaseVerificationTrust==='function','Release-grade verification trust evaluator is not exported');
const nakedVerification=record('verification',{REQ_ID:'REQ-1',RUN_ID:'RUN-X',TEST_ID:'TEST-1',VERIFIER_CONTEXT_ID:'EXTERNAL-CTX',OBSERVED_RESULT:'PASSED',EXPECTED_RESULT:'PASSED',DETERMINATION:'SATISFIED'},{stage:19});const trust=engine.releaseVerificationTrust(p,nakedVerification);assert(trust.determination!=='APPLICATION_ESTABLISHED','Self-asserted verifier identity became release-grade evidence');

// Evidence-authority regressions: each invalid state must fail, then a repaired state must pass.
{
 const req=p.projectData.requirements[0];
 const byteTest=record('tests',{TEST_TYPE:'BYTE_IDENTITY',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'independent byte verifier',ARTIFACT_REQUIREMENTS:'exact product bytes',PROCEDURE:'Compare exact artifact bytes and SHA-256.',EXPECTED_RESULT:'identical bytes',EVIDENCE_TO_PRESERVE:'application-verified byte identity'});
 const proseOnlyByte=record('verification',{EXACT_EVIDENCE:'An agent claims the byte hash matches.'});
 let byteEvidence=engine.evaluateEvidenceSufficiency(p,{requirement:req,test:byteTest,result:proseOnlyByte});
 assert(!byteEvidence.sufficient&&byteEvidence.requiredEvidenceClasses.includes('APPLICATION_VERIFIED_BYTES'),'Prose or a claimed hash satisfied a byte-authority proposition');
 p.projectData.artifacts.push({id:'ART-BYTE',stage:22,active:true,scope:{...scope},fields:{ARTIFACT_ID:'ART-BYTE',FILENAME:'product.bin',SHA256:'a'.repeat(64),AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'}});
 p.projectData.evidenceRecords.push({id:'EVIDENCE-BYTE',stage:22,active:true,scope:{...scope},fields:{EVIDENCE_ID:'EVIDENCE-BYTE',KIND:'BYTE_HASH',AUTHORITY_TYPE:'APPLICATION',DESCRIPTION:'Application-computed byte identity.',CONTENT:'Verified exact bytes and SHA-256.',ATTACHMENT_ID:'ART-BYTE'},relationships:{ATTACHMENT_ID:'ART-BYTE'}});
 const verifiedByte=record('verification',{EXACT_EVIDENCE:'EVIDENCE-BYTE'},{evidenceRefs:['EVIDENCE-BYTE']});
 byteEvidence=engine.evaluateEvidenceSufficiency(p,{requirement:req,test:byteTest,result:verifiedByte});
 assert(byteEvidence.sufficient,'Application-verified byte evidence did not repair byte-authority sufficiency');

 p.projectData.evidenceRecords.push({id:'EVIDENCE-MEANING',stage:23,active:true,scope:{...scope},fields:{EVIDENCE_ID:'EVIDENCE-MEANING',KIND:'MEANING_OBSERVATION',AUTHORITY_TYPE:'INDEPENDENT_REVIEWER',DESCRIPTION:'Independent meaning observation.',CONTENT:'Observed and compared the product meaning.'}});
 const meaningTest=record('tests',{TEST_TYPE:'MEANING',EXECUTION_MODE:'INDEPENDENT_AGENT_REVIEW',REQUIRED_CAPABILITY:'independent meaning review',ARTIFACT_REQUIREMENTS:'NONE',PROCEDURE:'Compare required and observed meaning.',EXPECTED_RESULT:'meaning matches',EVIDENCE_TO_PRESERVE:'meaning comparison'});
 const incompleteMeaning=record('meaningResults',{PRODUCT_LOCATION:'section 1',REQUIRED_MEANING:'RIGHT',OBSERVED_MEANING:'WRONG',EVIDENCE_BASED_COMPARISON:''},{stage:23,evidenceRefs:['EVIDENCE-MEANING']});
 let meaningEvidence=engine.evaluateEvidenceSufficiency(p,{requirement:req,test:meaningTest,result:incompleteMeaning});
 assert(!meaningEvidence.sufficient&&meaningEvidence.requiredEvidenceClasses.includes('MEANING_COMPARISON'),'Incomplete meaning comparison satisfied semantic evidence');
 const completeMeaning=record('meaningResults',{PRODUCT_LOCATION:'section 1',REQUIRED_MEANING:'RIGHT',OBSERVED_MEANING:'RIGHT',EVIDENCE_BASED_COMPARISON:'The observed statement has the same controlling meaning.'},{stage:23,evidenceRefs:['EVIDENCE-MEANING']});
 meaningEvidence=engine.evaluateEvidenceSufficiency(p,{requirement:req,test:meaningTest,result:completeMeaning});
 assert(meaningEvidence.sufficient,'Complete evidence-backed meaning comparison did not repair semantic sufficiency');

 const humanTest=record('tests',{TEST_TYPE:'HUMAN_INSPECTION',EXECUTION_MODE:'HUMAN_INSPECTION',REQUIRED_CAPABILITY:'human observation',ARTIFACT_REQUIREMENTS:'NONE',PROCEDURE:'A human opens and inspects the representation.',EXPECTED_RESULT:'representation acceptable',EVIDENCE_TO_PRESERVE:'human-owned observation'});
 const agentOnlyHuman=record('verification',{EXACT_EVIDENCE:'An agent claims a human inspected it.'});
 let humanEvidence=engine.evaluateEvidenceSufficiency(p,{requirement:req,test:humanTest,result:agentOnlyHuman});
 assert(!humanEvidence.sufficient&&humanEvidence.requiredEvidenceClasses.includes('HUMAN_OBSERVATION'),'Agent assertion substituted for human-owned inspection evidence');
 p.projectData.evidenceRecords.push({id:'EVIDENCE-HUMAN',stage:25,active:true,scope:{...scope},fields:{EVIDENCE_ID:'EVIDENCE-HUMAN',KIND:'HUMAN_INSPECTION',AUTHORITY_TYPE:'HUMAN_OBSERVATION',DESCRIPTION:'Human-owned inspection record.',CONTENT:'The operator opened and inspected the representation.'}});
 const actualHuman=record('verification',{EXACT_EVIDENCE:'EVIDENCE-HUMAN'},{evidenceRefs:['EVIDENCE-HUMAN']});
 humanEvidence=engine.evaluateEvidenceSufficiency(p,{requirement:req,test:humanTest,result:actualHuman});
 assert(humanEvidence.sufficient,'Human-owned observation did not repair human-inspection sufficiency');
}

// A release reduction over incomplete/contradictory canonical state can never ACCEPT.
const metrics=engine.releaseMetrics(p);assert(metrics.determination!=='ACCEPTED','Incomplete contradictory project released');

// Static lifetime guard: the release reducer must consume release-grade trust and the central adjudicator, not submitted favorable strings.
const source=fs.readFileSync('workflow-engine.js','utf8');assert(source.includes('releaseVerificationTrustFailures'),'releaseMetrics is not wired to release-grade verification trust');assert(source.includes('evaluateResultConsistency'),'Central result adjudication is missing');assert(source.includes('effectiveDetermination'),'Effective determination reducer is missing');assert(!source.includes("['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(latest,'RESULT')))"),'Legacy regression success shortcut remains');
// Gate adjudication must not serialize the entire project on every recalculation stage.
const adjudicationHotPath=source.slice(source.indexOf('function adjudicatedClone(project){'),source.indexOf('\nfunction validateTraceIntegrity',source.indexOf('function adjudicatedClone(project){')));
assert(adjudicationHotPath&&!adjudicationHotPath.includes('clone(project)'),'Gate adjudication still deep-clones the entire project');
assert(adjudicationHotPath.includes('projectData:{...(project?.projectData||{})}'),'Gate adjudication does not use a shallow project-data view');
assert(adjudicationHotPath.includes('map(record=>clone(record))'),'Gate adjudication does not isolate only conclusion-bearing records before rewriting effective determinations');
for(const unrelated of ['rawResponses','generatedPrompts','history','responseProposals'])assert(!adjudicationHotPath.includes('copy.projectData['+JSON.stringify(unrelated)+']'),'Gate adjudication clones unrelated large provenance collection '+unrelated);

const proof={semanticFalseAcceptanceInvariant:true,conclusionBearingCollections:cases.length,releaseGradeIndependence:true,traceIntegrity:true,centralAdjudication:true,byteAuthorityEvidenceRegression:true,meaningEvidenceRegression:true,humanInspectionEvidenceRegression:true};

// Capability names are not capability availability. External tool/system execution requires affirmative canonical availability.
{
 const q=core.createBlankState('JOB-CAPABILITY-AFFIRMATION');engine.ensureShape(q);q.job.CURRENT_INPUT_VERSION='INPUT-v001';q.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v001';q.job.CURRENT_TEST_SUITE_VERSION='TEST-SUITE-v001';const s=engine.currentScope(q);q.projectData.requirements.push({id:'REQ-CAP',stage:4,active:true,scope:s,fields:{REQ_ID:'REQ-CAP',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}});q.projectData.tests.push({id:'TEST-CAP',stage:6,active:true,scope:s,fields:{TEST_ID:'TEST-CAP',REQ_ID:'REQ-CAP',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITY:'SOLIDWORKS_IMPORT',ARTIFACT_REQUIREMENTS:'NONE',EVIDENCE_TO_PRESERVE:'import report',STATUS:'READY'},relationships:{REQ_ID:'REQ-CAP'}});let plan=engine.testExecutionPlan(q).items[0];assert(!plan.executableNow&&plan.operatorAction==='BLOCKED','Capability name alone established external tool availability');q.projectData.externalCapabilities.push({id:'CAP-SOLIDWORKS',stage:0,active:true,scope:{inputVersion:q.job.CURRENT_INPUT_VERSION},fields:{CAPABILITY_ID:'CAP-SOLIDWORKS',CAPABILITY_CLAIM:'SOLIDWORKS_IMPORT',FRESHNESS_STATUS:'CURRENT',STATUS:'CURRENT',AUTHORIZED:true,PERMISSIONS_READY:true,INPUTS_TRANSFERABLE:true,ROUTE_USABLE:true,EVIDENCE_OBTAINABLE:true}});plan=engine.testExecutionPlan(q).items[0];assert(plan.executableNow&&plan.operatorAction==='SEND_TO_TOOL_AGENT','Current canonical capability record did not restore routing');
}

const strengthenedSource=fs.readFileSync('workflow-engine.js','utf8');
assert(strengthenedSource.includes("NON_SATISFIED_EFFECTIVE_RESULT:"),'Stage 29 does not require effective result satisfaction');
assert(strengthenedSource.includes("RELEASE_NOT_ACCEPTED"),'Stage 29 does not require an accepted current release');
assert(strengthenedSource.includes("UNAUTHORIZED_ARTIFACT_IDENTITY:"),'Stage 29 explanation does not fail closed on unauthorized delivery identity');
assert(!strengthenedSource.includes("map(v=>upper(recordValue(v,'DETERMINATION')))"),'Stability diagnostics still consume submitted determinations');
console.log(JSON.stringify({...proof,affirmativeCapabilityAvailability:true,epistemicEvidenceChains:true,effectiveStability:true}));

import {reviewProofFixture,canonicalFixtureRecord} from './test-fixtures.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime,bindArtifactFixture} from './test-project-store-runtime.mjs';
import {artifactFixtureId} from './test-artifact-fixtures.mjs';
import strictAssert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});
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

// Stage 25 requires explicit coverage inventories even when a class is empty.
// The same actual shared parser owns effective determination and stage totals.
function representationCoverageOracle(runtime){
 const e=runtime.closedLoopWorkflowEngine,c=runtime.closedLoopCore,h=runtime.closedLoopHash,s=runtime.closedLoopWorkflowSchema,scope={inputVersion:'INPUT-REP',sourceSetVersion:'SOURCE-REP',requirementsVersion:'REQUIREMENTS-REP',testSuiteVersion:'TESTS-REP',instructionVersion:'INSTRUCTION-REP',iterationId:'ITER-REP',productId:'PRODUCT-REP'};
 const project=c.createBlankState('JOB-REPRESENTATION-INVENTORIES');Object.assign(project.job,{CURRENT_INPUT_VERSION:scope.inputVersion,CURRENT_SOURCE_SET_VERSION:scope.sourceSetVersion,CURRENT_REQUIREMENTS_VERSION:scope.requirementsVersion,CURRENT_TEST_SUITE_VERSION:scope.testSuiteVersion,CURRENT_INSTRUCTION_VERSION:scope.instructionVersion,CURRENT_ITERATION:scope.iterationId,CURRENT_PRODUCT_ID:scope.productId});e.ensureShape(project);
 const fixture={engine:e,schema:s},artifact=canonicalFixtureRecord(fixture,project,'artifacts',{FILENAME:'delivery.txt',SHA256:h.sha256Text('controlled product'),BYTE_SIZE:18,AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},{stage:21,scope}),artifactId=e.recordId(artifact,'artifacts'),evidenceRow=canonicalFixtureRecord(fixture,project,'evidenceRecords',{KIND:'REPRESENTATION_INSPECTION',AUTHORITY_TYPE:'INDEPENDENT_REVIEWER',DESCRIPTION:'Controlled maintained synthetic representation inspection.',CONTENT:'Controlled inspection evidence; no physical observation claimed.'},{stage:25,scope}),evidenceId=e.recordId(evidenceRow,'evidenceRecords');
 const full={requiredPageOrViewIds:['VIEW-1'],inspectedPageOrViewIds:['VIEW-1'],requiredPackagedFileIds:['FILE-1'],openedOrTestedPackagedFileIds:['FILE-1'],requiredTransformationIds:['TRANSFORM-1'],inspectedTransformationIds:['TRANSFORM-1'],observation:'Controlled representation observation.'},keys=Object.keys(full).filter(key=>key!=='observation'),empty={...Object.fromEntries(keys.map(key=>[key,[]])),observation:full.observation};
 const row=canonicalFixtureRecord(fixture,project,'representationInspections',{ARTIFACT_ID:artifactId,REQUIRED_BY_TRACE:'Controlled representation coverage',TRANSFORMATION_CHAIN:'Controlled transformation',TRANSFORMATION_TOOLS_VERSIONS:'NONE',RENDERING_OPENING_EVIDENCE:evidenceId,OBSERVATIONS:JSON.stringify(full),DETERMINATION:'SATISFIED',EVIDENCE:evidenceId},{stage:25,scope,relationships:{ARTIFACT_ID:artifactId},evidenceRefs:[evidenceId]}),observations=[];
 const exercise=(caseId,payload,valid,field=null)=>{
  row.fields.OBSERVATIONS=row.OBSERVATIONS=JSON.stringify(payload);e.refreshRecordHashes(row,'representationInspections');const effective=e.evaluateResultConsistency('representationInspections',row,null,project),aggregate=e.representationInspectionCoverage(project);
  strictAssert.equal(effective.determination,valid?'SATISFIED':'UNDETERMINED','STAGE25_INVENTORY_ORACLE: '+caseId+' effective determination.');strictAssert.equal(aggregate.complete,valid,'STAGE25_INVENTORY_ORACLE: '+caseId+' aggregate completion.');
  if(field){const expected='OBSERVATIONS.'+field+' must be an explicitly provided array.';strictAssert(effective.reasons.includes(expected),'STAGE25_INVENTORY_ORACLE: '+caseId+' did not cite its inventory violation.');strictAssert(aggregate.reasons.some(reason=>reason.endsWith(expected)),'STAGE25_INVENTORY_ORACLE: '+caseId+' aggregate did not cite its inventory violation.');}
  observations.push({caseId,expectedValid:valid,effectiveDetermination:effective.determination,aggregateComplete:aggregate.complete,reasons:effective.reasons});
 };
 exercise('explicit-full-coverage',full,true);exercise('explicit-empty-classes',empty,true);
 exercise('all-inventories-omitted',{observation:full.observation},false,keys[0]);
 for(const key of keys){const absent={...empty};delete absent[key];exercise('missing-'+key,absent,false,key);for(const [kind,value]of [['string','NONE'],['null',null],['object',{}]])exercise(kind+'-'+key,{...empty,[key]:value},false,key);}
 exercise('required-view-uninspected',{...full,inspectedPageOrViewIds:[]},false);exercise('observation-missing',Object.fromEntries(keys.map(key=>[key,[]])),false);
 return observations;
}
const representationInventories=representationCoverageOracle(globalThis);
const representationGuardFault=projectStoreRuntime({fault:{id:'stage25-required-inventory-guard-bypass',file:'workflow-engine.js',before:"if(!Object.hasOwn(payload,name)||!Array.isArray(payload[name]))reasons.push(`OBSERVATIONS.${name} must be an explicitly provided array.`);",after:"if(false)reasons.push(`OBSERVATIONS.${name} must be an explicitly provided array.`);"}});
strictAssert.throws(()=>representationCoverageOracle(representationGuardFault.runtime),/STAGE25_INVENTORY_ORACLE: all-inventories-omitted effective determination/,'The inventory guard fault must fail its coverage oracle after valid control setup.');
if(process.argv.includes('--representation-coverage-only')){console.log(JSON.stringify({representationInventories:'PASS',observations:representationInventories,inventoryGuardFaultDetected:true,basis:'MAINTAINED_SYNTHETIC_SCHEMA_FIXTURE_REAL_SHARED_COVERAGE_PARSER'},null,2));process.exit(0);}

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
 // This fixture is synthetic evidence. Its byte-authority control must still
 // cross the actual storage/readback boundary; a metadata availability claim
 // cannot stand in for the application-observed custody required by §§17.6,25.
 const byteBlob=new Blob(['Controlled exact product bytes'],{type:'application/octet-stream'}),artifactId=artifactFixtureId(engine,p,'BYTE-AUTHORITY'),digest=await hash.sha256Bytes(byteBlob);
 engine.registerArtifactBytes(p,{stage:22,artifactId,filename:'product.bin',mediaType:byteBlob.type,byteSize:byteBlob.size,sha256:digest});
 p.projectData.evidenceRecords.push({id:'EVIDENCE-BYTE',stage:22,active:true,scope:{...scope},fields:{EVIDENCE_ID:'EVIDENCE-BYTE',KIND:'BYTE_HASH',AUTHORITY_TYPE:'APPLICATION',DESCRIPTION:'Synthetic application-computed byte identity fixture.',CONTENT:'Verified exact bytes and SHA-256.',ATTACHMENT_ID:artifactId},relationships:{ATTACHMENT_ID:artifactId}});
 const verifiedByte=record('verification',{EXACT_EVIDENCE:'EVIDENCE-BYTE'},{evidenceRefs:['EVIDENCE-BYTE']});
 assert(!engine.evaluateEvidenceSufficiency(p,{requirement:req,test:byteTest,result:verifiedByte}).sufficient,'Metadata-only byte availability satisfied a byte-authority proposition');
 const byteStore=await bindArtifactFixture([]);await byteStore.putArtifact({artifactId,jobId:p.job.JOB_ID,filename:'product.bin',mediaType:byteBlob.type,blob:byteBlob});
 const stored=await byteStore.getArtifact(artifactId);strictAssert.equal(stored.jobId,p.job.JOB_ID);strictAssert.equal(stored.byteSize,byteBlob.size);strictAssert.equal(await hash.sha256Bytes(stored.blob),digest);
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

const proof={representationInventories,inventoryGuardFaultDetected:true,semanticFalseAcceptanceInvariant:true,conclusionBearingCollections:cases.length,releaseGradeIndependence:true,traceIntegrity:true,centralAdjudication:true,byteAuthorityEvidenceRegression:true,meaningEvidenceRegression:true,humanInspectionEvidenceRegression:true};

// Capability names and human prose are claims, not capability readiness. A current canonical capability record repairs routing.
{
 const q=core.createBlankState('JOB-CAPABILITY-AFFIRMATION');engine.ensureShape(q);q.job.CURRENT_INPUT_VERSION='INPUT-v001';q.job.CURRENT_REQUIREMENTS_VERSION='REQUIREMENTS-v001';q.job.CURRENT_TEST_SUITE_VERSION='TEST-SUITE-v001';const s=engine.currentScope(q);q.projectData.requirements.push({id:'REQ-CAP',stage:4,active:true,scope:s,fields:{REQ_ID:'REQ-CAP',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}});q.projectData.tests.push({id:'TEST-CAP',stage:6,active:true,scope:s,fields:{TEST_ID:'TEST-CAP',REQ_ID:'REQ-CAP',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITY:'SOLIDWORKS_IMPORT',ARTIFACT_REQUIREMENTS:'NONE',EVIDENCE_TO_PRESERVE:'import report',STATUS:'READY'},relationships:{REQ_ID:'REQ-CAP'}});let plan=engine.testExecutionPlan(q).items[0];assert(!plan.executableNow&&plan.operatorAction==='BLOCKED','Capability name alone established external tool availability');q.job.AVAILABLE_TOOLS='SOLIDWORKS_IMPORT';plan=engine.testExecutionPlan(q).items[0];assert(!plan.executableNow&&plan.operatorAction==='BLOCKED','Human AVAILABLE_TOOLS prose incorrectly established CAPABILITY_READY');const capabilityFields={CAPABILITY_ID:'CAPABILITY-SOLIDWORKS',CAPABILITY_CLAIM:'SOLIDWORKS_IMPORT',FRESHNESS_STATUS:'CURRENT',STATUS:'CURRENT',AUTHORIZED:true,PERMISSIONS_READY:true,INPUTS_TRANSFERABLE:true,ROUTE_USABLE:true,EVIDENCE_OBTAINABLE:true};q.projectData.externalCapabilities.push({id:'CAPABILITY-SOLIDWORKS',stage:6,active:true,scope:{inputVersion:q.job.CURRENT_INPUT_VERSION},fields:capabilityFields,...capabilityFields});plan=engine.testExecutionPlan(q).items[0];assert(plan.executableNow&&plan.operatorAction==='SEND_TO_TOOL_AGENT','Current canonical capability evidence did not restore routing');
}

const strengthenedSource=fs.readFileSync('workflow-engine.js','utf8');
assert(strengthenedSource.includes("NON_SATISFIED_EFFECTIVE_RESULT:"),'Stage 29 does not require effective result satisfaction');
assert(strengthenedSource.includes("RELEASE_NOT_ACCEPTED"),'Stage 29 does not require an accepted current release');
assert(strengthenedSource.includes("UNAUTHORIZED_ARTIFACT_IDENTITY:"),'Stage 29 explanation does not fail closed on unauthorized delivery identity');
assert(!strengthenedSource.includes("map(v=>upper(recordValue(v,'DETERMINATION')))"),'Stability diagnostics still consume submitted determinations');
console.log(JSON.stringify({...proof,affirmativeCapabilityAvailability:true,epistemicEvidenceChains:true,effectiveStability:true}));
// §29.13: invalid proof syntax must be rejected even when no observation exists.
for(const node of [{type:'LEAF',artifactId:'ARTIFACT-1'},{type:'LEAF',dependencyId:'DEP-1'},{type:'LEAF',testId:'TEST-1',observationId:'OBS-1'},{op:'LEAF',testId:'TEST-1'},{type:'ALL_OF',children:[]}]){
 const result=engine.evaluateProofExpression(core.createBlankState('JOB-PROOF-SYNTAX'),'PROP-1',node);
 if(result.reason==='EVALUATED')throw new Error('Out-of-language proof expression reached evaluation: '+JSON.stringify(node));
}
// A declared observation class cannot be supplied by an unsupported bare claim.
{const q=core.createBlankState('JOB-PROOF-EVIDENCE');engine.ensureShape(q);q.projectData.propositions.push({id:'PROP-E',active:true,fields:{PROPOSITION_ID:'PROP-E'}});q.projectData.observationRecords.push({id:'OBS-E',active:true,fields:{OBSERVATION_ID:'OBS-E',EPISTEMIC_BASIS:'SELF_ASSERTED',FRESHNESS_STATUS:'CURRENT'}});q.projectData.entailmentReviews.push({id:'ENT-E',active:true,fields:{OBSERVATION_ID:'OBS-E',TARGET_PROPOSITION_ID:'PROP-E',ACCEPTED_STATUS:'ACCEPTED',ACCEPTED_RELATION:'ESTABLISHES'}});const node={type:'LEAF',propositionId:'PROP-E',truthExtraction:'ACCEPTED_ENTAILMENT',evidenceClasses:['OBSERVATION_RECORD','ACCEPTED_ENTAILMENT'],scopeBinding:'CURRENT'};assert(engine.evaluateProofExpression(q,'PARENT',node).truthValue==='UNKNOWN','Self-asserted observation acquired proof authority.');q.projectData.observationRecords[0].fields.EPISTEMIC_BASIS='EXTERNALLY_SUPPORTED';assert(engine.evaluateProofExpression(q,'PARENT',node).truthValue==='UNKNOWN','Observation without source evidence acquired proof authority.');}

// Independent truth-table vectors for all three operators. Each complete
// expression and its explicit timing is reviewed through production intake.
{
 const schema=closedLoopWorkflowSchema,runtime={engine,schema,prompts:closedLoopPromptEngine,ingestion:closedLoopResponseIngestion};
 const q=core.createBlankState('JOB-PROOF-TRUTH-TABLE');Object.assign(q.job,{CURRENT_INPUT_VERSION:scope.inputVersion,CURRENT_SOURCE_SET_VERSION:scope.sourceSetVersion,CURRENT_REQUIREMENTS_VERSION:scope.requirementsVersion,CURRENT_TEST_SUITE_VERSION:scope.testSuiteVersion});engine.ensureShape(q);
 const record=(family,fields,options={})=>canonicalFixtureRecord(runtime,q,family,fields,options),req=record('requirements',{MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE'}),subjects={};
 const timing={VERIFICATION_PHASE:'PREPRODUCT_ITERATION',EARLIEST_EXECUTABLE_STAGE:6,REQUIRED_BY_STAGE:6,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:false,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'}};
 for(const [label,relation]of [['TRUE','ESTABLISHES'],['FALSE','REFUTES'],['UNKNOWN',null]]){
  const subject=record('propositions',{REQUIREMENT_ID:req.id,PROPOSITION_TEXT:label,STATUS:'CURRENT'},{relationships:{REQUIREMENT_ID:req.id}});subjects[label]=subject.id;
  if(relation){const evidence=record('evidenceRecords',{STATUS:'PRESERVED'}),observation=record('observationRecords',{EPISTEMIC_BASIS:'EXTERNALLY_SUPPORTED',FRESHNESS_STATUS:'CURRENT',RAW_OR_NATIVE_PROVENANCE:'FIXTURE-OBSERVATION-'+label});observation.evidenceRefs=[evidence.id];engine.refreshRecordHashes(observation,'observationRecords');record('entailmentReviews',{OBSERVATION_ID:observation.id,TARGET_PROPOSITION_ID:subject.id,ACCEPTED_STATUS:'ACCEPTED',ACCEPTED_RELATION:relation});}
 }
 const leafFor=label=>({type:'LEAF',propositionId:subjects[label],truthExtraction:'ACCEPTED_ENTAILMENT',evidenceClasses:['OBSERVATION_RECORD','ACCEPTED_ENTAILMENT'],scopeBinding:'CURRENT',proposedTiming:timing}),vectors=[];
 const add=(node,expected,label)=>{const parent=record('propositions',{REQUIREMENT_ID:req.id,PROPOSITION_TEXT:label,STATUS:'CURRENT'},{relationships:{REQUIREMENT_ID:req.id}});record('proofExpressions',{TARGET_PROPOSITION_ID:parent.id,PROPOSED_EXPRESSION:node,NORMALIZED_EXPRESSION:node,SEMANTIC_RATIONALE:'The exact operator combines independently preserved observations.'},{relationships:{TARGET_PROPOSITION_ID:parent.id}});vectors.push({node,expected,label,parentId:parent.id});return vectors.at(-1);};
 const pairs=[['TRUE','TRUE','TRUE','TRUE'],['TRUE','FALSE','FALSE','TRUE'],['TRUE','UNKNOWN','UNKNOWN','TRUE'],['FALSE','FALSE','FALSE','FALSE'],['FALSE','UNKNOWN','FALSE','UNKNOWN'],['UNKNOWN','UNKNOWN','UNKNOWN','UNKNOWN']];
 for(const [a,b,all,any]of pairs)for(const inputs of [[a,b],[b,a]])for(const [type,expected]of [['ALL_OF',all],['ANY_OF',any]])add({type,children:inputs.map(leafFor)},expected,type+' '+inputs);
 for(const [inputs,expected]of [[['TRUE','TRUE','UNKNOWN'],'TRUE'],[['TRUE','FALSE','FALSE'],'FALSE'],[['TRUE','UNKNOWN','FALSE'],'UNKNOWN'],[['UNKNOWN','UNKNOWN','UNKNOWN'],'UNKNOWN'],[['FALSE','FALSE','UNKNOWN'],'FALSE']])add({type:'AT_LEAST_K',k:2,children:inputs.map(leafFor)},expected,'Threshold '+inputs);
 const single=add(leafFor('TRUE'),'TRUE','Single current observation');
 for(let n=1;n<=5;n++){q.stages[n].status='COMPLETE';q.stages[n].gate={complete:true};}reviewProofFixture(runtime,q);q.job.CURRENT_STAGE='STAGE 06';
 for(const v of vectors){assert(engine.deriveLeafTimingSchedule(q,v.parentId).resolved,'Truth table fixture omitted its reviewed timing.');assert(engine.evaluateProofExpression(q,v.parentId,v.node).truthValue===v.expected,v.label+' truth table failed.');}
 const reviewedAll=vectors.find(v=>v.node.type==='ALL_OF'&&v.expected==='FALSE'&&v.node.children.some(leaf=>leaf.propositionId===subjects.TRUE));
 const substituted={...reviewedAll.node,type:'ANY_OF'};
 assert(engine.evaluateProofExpression(q,reviewedAll.parentId,substituted).truthValue==='UNKNOWN','REVIEWED_EXPRESSION_IDENTITY_ORACLE: an unreviewed operator acquired the reviewed parent schedule.');
 assert(engine.evaluateStageProofTruth(q,reviewedAll.parentId,substituted,6)==='UNKNOWN','REVIEWED_EXPRESSION_IDENTITY_ORACLE: stage proof accepted an unreviewed operator.');
 const observation=q.projectData.observationRecords.find(row=>engine.recordValue(row,'RAW_OR_NATIVE_PROVENANCE')==='FIXTURE-OBSERVATION-TRUE');
 const expectUnknown=label=>assert(engine.evaluateProofExpression(q,single.parentId,single.node).truthValue==='UNKNOWN',label);
 observation.fields.FRESHNESS_STATUS='EXPIRED';expectUnknown('Expired observation supplied proof.');observation.fields.FRESHNESS_STATUS='CURRENT';
 observation.fields.EPISTEMIC_BASIS='SELF_ASSERTED';expectUnknown('Self-asserted observation supplied proof.');observation.fields.EPISTEMIC_BASIS='EXTERNALLY_SUPPORTED';
 const preserved=observation.evidenceRefs;observation.evidenceRefs=[];expectUnknown('Missing source evidence supplied proof.');observation.evidenceRefs=preserved;
 const provenance=observation.fields.RAW_OR_NATIVE_PROVENANCE;observation.fields.RAW_OR_NATIVE_PROVENANCE='';expectUnknown('Missing observation provenance supplied proof.');observation.fields.RAW_OR_NATIVE_PROVENANCE=provenance;
 assert(engine.evaluateProofExpression(q,single.parentId,single.node).truthValue==='TRUE','Restored valid current evidence did not restore proof.');
 record('entailmentReviews',{OBSERVATION_ID:observation.id,TARGET_PROPOSITION_ID:subjects.TRUE,ACCEPTED_STATUS:'ACCEPTED',ACCEPTED_RELATION:'REFUTES'});expectUnknown('Contradictory sufficient observations supplied proof.');
 const cycle={type:'ALL_OF',children:[]};cycle.children.push(cycle);assert(!engine.validateProofExpression(cycle).valid,'Cyclic object graph entered proof normalization.');let deep=leafFor('UNKNOWN');for(let i=0;i<34;i++)deep={type:'ALL_OF',children:[deep]};assert(!engine.validateProofExpression(deep).valid,'Proof depth limit was ignored.');
 const obligation=record('proofObligations',{PROPOSITION_ID:single.parentId}),prerequisite={type:'LEAF',proofObligationId:obligation.id,truthExtraction:'PROOF_OBLIGATION',evidenceClasses:['ACCEPTED_PROOF_REVIEW'],scopeBinding:'CURRENT'};assert(!engine.validateProofExpression(prerequisite,{project:q,targetPropositionId:single.parentId}).valid,'Circular prerequisite proof was accepted.');
 console.log(JSON.stringify({closedProofTruthTables:true,vectors:vectors.length,currentEvidenceRequired:true,reviewedTimingRequired:true,proofCyclesAndResourceBounds:true}));
}

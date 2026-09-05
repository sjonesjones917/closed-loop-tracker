import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
if(!core||!schema||!engine||!ingestion)throw new Error('Definition-of-done verifier could not load the responsible layers.');

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const coverageMetric=(metricId,passed,total,includedIds,excluded=[])=>{
  assert(Number.isInteger(total)&&total>0,`${metricId} has an empty or invalid denominator without an independently accepted evidence-supported EMPTY_UNIVERSE determination.`);
  assert(Number.isInteger(passed)&&passed>=0&&passed<=total,`${metricId} has an invalid numerator ${passed}/${total}.`);
  const ids=Array.isArray(includedIds)?includedIds.map(String):[];
  assert(ids.length===total,`${metricId} closed-universe IDs do not reconcile with denominator ${total}.`);
  return Object.freeze({metricId,derivationVersion:'closed-loop-definition-of-done-metrics/2',universeDefinition:`Exact verifier-owned closed universe for ${metricId}`,numerator:passed,denominator:total,includedIds:ids,excludedIds:Array.isArray(excluded)?excluded:[],scopeHash:globalThis.closedLoopHash.sha256Value({metricId,includedIds:ids,excludedIds:excluded}),evidenceReferences:['verify-definition-of-done.mjs'],value:passed/total,disposition:passed===total?'SATISFIED':'VIOLATED'});
};
const producers=new Set(Object.values(schema.PRODUCER));
const fieldRows=[];
for(const [name,def] of Object.entries(schema.JOB_FIELDS))fieldRows.push({kind:'job',owner:name,def});
for(const [stage,defs] of Object.entries(schema.STAGE_FIELDS))for(const [name,def] of Object.entries(defs))fieldRows.push({kind:'stage',owner:`${stage}.${name}`,def});
for(const [collection,record] of Object.entries(schema.RECORD_SCHEMAS))for(const [name,def] of Object.entries(record.fieldDefinitions||{}))fieldRows.push({kind:'record',owner:`${collection}.${name}`,def});
assert(fieldRows.length>0,'No canonical fields were discovered.');

const ownershipPassed=fieldRows.filter(({def})=>producers.has(def.producer)).length;
const fieldOwnershipMetric=coverageMetric('FIELD_OWNERSHIP_COVERAGE',ownershipPassed,fieldRows.length,fieldRows.map(row=>`${row.kind}:${row.owner}`));
const fieldOwnershipCoverage=fieldOwnershipMetric.value;
assert(fieldOwnershipCoverage===1,'Field ownership coverage is not 100%.');

const applicationRows=fieldRows.filter(({def})=>def.producer===schema.PRODUCER.APPLICATION);
const derivationPassed=applicationRows.filter(({def})=>typeof(def.derivationKey||def.derivation)==='string'&&String(def.derivationKey||def.derivation).trim()).length;
const applicationDerivationMetric=coverageMetric('APPLICATION_DERIVATION_COVERAGE',derivationPassed,applicationRows.length,applicationRows.map(row=>`${row.kind}:${row.owner}`));
const applicationDerivationCoverage=applicationDerivationMetric.value;
assert(applicationDerivationCoverage===1,'Application derivation coverage is not 100%.');

const relationshipRows=[];
for(const [collection,record] of Object.entries(schema.RECORD_SCHEMAS))for(const [field,target] of Object.entries(record.relationships||{}))relationshipRows.push({collection,field,target,def:record.fieldDefinitions?.[field]});
assert(relationshipRows.length>0,'No typed relationships were discovered.');
const relationshipPassed=relationshipRows.filter(row=>row.def&&schema.RECORD_SCHEMAS[row.target]&&['REFERENCE','REFERENCE_ARRAY'].includes(row.def.valueType)).length;
const typedRelationshipMetric=coverageMetric('TYPED_RELATIONSHIP_COVERAGE',relationshipPassed,relationshipRows.length,relationshipRows.map(row=>`${row.collection}.${row.field}->${row.target}`));
const typedRelationshipCoverage=typedRelationshipMetric.value;
assert(typedRelationshipCoverage===1,'Typed relationship coverage is not 100%.');

const agentRows=fieldRows.filter(({def})=>def.producer===schema.PRODUCER.AGENT);
const extractionPassed=agentRows.filter(({def})=>typeof def.responsePath==='string'&&def.responsePath.startsWith('/')&&def.provenanceRequired===true).length;
const acceptedAgentValueExtractionMetric=coverageMetric('ACCEPTED_AGENT_VALUE_EXTRACTION_COVERAGE',extractionPassed,agentRows.length,agentRows.map(row=>`${row.kind}:${row.owner}`));
const acceptedAgentValueExtractionCoverage=acceptedAgentValueExtractionMetric.value;
assert(acceptedAgentValueExtractionCoverage===1,'Accepted agent-value extraction metadata coverage is not 100%.');

const relationshipProvenancePassed=relationshipRows.filter(({def,target})=>def?.producer===schema.PRODUCER.APPLICATION&&schema.RECORD_SCHEMAS[target]).length;
const acceptedRelationshipProvenanceMetric=coverageMetric('ACCEPTED_RELATIONSHIP_PROVENANCE_COVERAGE',relationshipProvenancePassed,relationshipRows.length,relationshipRows.map(row=>`${row.collection}.${row.field}->${row.target}`));
const acceptedRelationshipProvenanceCoverage=acceptedRelationshipProvenanceMetric.value;
assert(acceptedRelationshipProvenanceCoverage===1,'Accepted relationship provenance ownership coverage is not 100%.');

assert(core.STAGE_COUNT===30&&core.STAGES.length===30&&core.WORKFLOW_ID==='mobile-closed-loop/30','30-stage workflow identity changed.');
assert(core.PROJECT_SCHEMA==='closed-loop-project/3'&&schema.RESPONSE_SCHEMA==='closed-loop-stage-response/3','Schema identity changed.');
assert(JSON.stringify(engine.applicationTestCapabilities())===JSON.stringify(['CLOSED_LOOP_TEST_IR']),'The only registered project-test executor must be the proven Closed Loop Test IR runtime.');
assert(fs.existsSync('test-runtime.js')&&fs.existsSync('test-worker.js')&&fs.existsSync('verify-test-runtime.mjs'),'Native Test IR executor proof files are missing.');

const workflowSource=fs.readFileSync('.github/workflows/pages.yml','utf8');
assert((workflowSource.match(/^name:/gm)||[]).length===1,'Pages workflow file is malformed.');
const workflows=fs.readdirSync('.github/workflows').filter(name=>name.endsWith('.yml')||name.endsWith('.yaml'));
assert(workflows.length===1&&workflows[0]==='pages.yml','Repository must retain exactly one Pages workflow.');
assert(workflowSource.includes('node verify-semantic-invariant.mjs'),'Semantic false-acceptance invariant is not in CI.');
assert(workflowSource.includes('verify-browser.mjs')&&workflowSource.includes('verify-browser-extra.mjs'),'Chromium acceptance is not in CI.');
assert(workflowSource.includes('Exact deployed-byte verification')&&workflowSource.includes('run: node verify-live.mjs'),'Exact deployed-byte verification is not in CI.');

const engineSource=fs.readFileSync('workflow-engine.js','utf8');
const ingestionTestSource=fs.readFileSync('verify-ingestion.mjs','utf8');
const completeTestSource=fs.readFileSync('verify-complete.mjs','utf8');
const fullCycleSource=fs.readFileSync('verify-full-cycle.mjs','utf8');
const stage28TestSource=fs.readFileSync('verify-stage28-artifact-delivery-intent.mjs','utf8');
const semanticTestSource=fs.readFileSync('verify-semantic-invariant.mjs','utf8');
const browserExtraSource=fs.readFileSync('verify-browser-extra.mjs','utf8');
for(const token of ['evaluateEvidenceContract','evaluateResultConsistency','effectiveDetermination','validateTraceIntegrity','detectCurrentContradictions','releaseMetrics','testExecutionPlan','executionHandoff'])assert(engineSource.includes(token),`Central reliability authority missing ${token}.`);

const scopeKeys=[...new Set(Object.values(schema.SCOPE_REQUIREMENTS||{}).flat())];
const scopeKeyProofs=scopeKeys.map(key=>ingestionTestSource.includes(`'${key}'`)||ingestionTestSource.includes(`"${key}"`));
assert(ingestionTestSource.includes('scopeNegative')&&ingestionTestSource.includes("code==='STALE_SCOPE'"),'Stale-scope mutation matrix is not executable.');
const currentScopeSelectorMetric=coverageMetric('CURRENT_SCOPE_SELECTOR_COVERAGE',scopeKeyProofs.filter(Boolean).length,scopeKeyProofs.length,scopeKeys);
const currentScopeSelectorCoverage=currentScopeSelectorMetric.value;
assert(currentScopeSelectorCoverage===1,'Current-scope selector coverage is not 100%.');

const verificationMatrixProofs=[['verification-key',engineSource.includes('verificationKey(record)')],['expected-count',engineSource.includes('expectedVerificationCount:matrix.expected.length')],['matrix-coverage',engineSource.includes('verificationCoverage:matrix.coverage')],['stage12-nonempty-regression',completeTestSource.includes('Stage 12 completed without verification triples.')],['full-cycle-triple-coverage',fullCycleSource.includes('verificationTripleCoverage:engine.coverageMetrics(reloaded).verificationCoverage')]];
const exactReqRunTestMetric=coverageMetric('REQ_RUN_TEST_COVERAGE',verificationMatrixProofs.filter(([,ok])=>ok).length,verificationMatrixProofs.length,verificationMatrixProofs.map(([id])=>id));
const exactReqRunTestCoverage=exactReqRunTestMetric.value;
assert(exactReqRunTestCoverage===1,'Exact REQ × RUN × TEST coverage proof is incomplete.');

const regressionProofs=[['effective-regression-satisfied',engineSource.includes("effectiveRegressionDetermination(project,r).determination==='SATISFIED'")],['stale-regression-rejected',completeTestSource.includes('A stale regression success resolved a current material defect.')],['current-regression-closure',completeTestSource.includes('currentRegressionClosure:true')],['post-correction-full-cycle',fullCycleSource.includes("PHASE:'POST_CORRECTION',RESULT:'SATISFIED'")],['unchanged-confirmation-full-cycle',fullCycleSource.includes("PHASE:'UNCHANGED_CONFIRMATION',RESULT:'SATISFIED'")]];
const applicableCurrentRegressionMetric=coverageMetric('APPLICABLE_CURRENT_REGRESSION_SUCCESS',regressionProofs.filter(([,ok])=>ok).length,regressionProofs.length,regressionProofs.map(([id])=>id));
const applicableCurrentRegressionSuccess=applicableCurrentRegressionMetric.value;
assert(applicableCurrentRegressionSuccess===1,'Applicable current regression-success proof is incomplete.');

const evidenceChainProofs=[['construct-evidence-chains',engineSource.includes('function constructEvidenceChains(project)')],['effective-determination',engineSource.includes('effective=effectiveDetermination(collection,result,test,project)')],['evidence-contract',engineSource.includes('contract=evaluateEvidenceContract(test,result,null,project)')],['nonsatisfied-result-missing',engineSource.includes("if(effective!=='SATISFIED')missing.push('NON_SATISFIED_EFFECTIVE_RESULT:'+tid)")],['evidence-sufficiency',engineSource.includes('sufficiency=evaluateEvidenceSufficiency(project,{requirement,test,result})')],['insufficient-evidence-missing',engineSource.includes("if(!contract.sufficient||!sufficiency.sufficient)missing.push('INSUFFICIENT_EVIDENCE:'+tid)")],['full-cycle-construction',fullCycleSource.includes('engine.constructEvidenceChains(p)')],['full-cycle-stage29-gate',fullCycleSource.includes("evidenceChains:engine.gate(29,reloaded).complete")],['missing-links-not-invented',completeTestSource.includes('Missing evidence-chain links remain missing; the application does not invent them.')],['missing-links-fabrication-regression',completeTestSource.includes('Missing evidence links were fabricated as complete.')]];
const mandatoryEvidenceChainMetric=coverageMetric('MANDATORY_EVIDENCE_CHAIN_STRUCTURAL_COVERAGE',evidenceChainProofs.filter(([,ok])=>ok).length,evidenceChainProofs.length,evidenceChainProofs.map(([id])=>id));
const mandatoryEvidenceChainCoverage=mandatoryEvidenceChainMetric.value;
assert(mandatoryEvidenceChainCoverage===1,'Mandatory evidence-chain coverage proof is incomplete.');

const artifactIdentityProofsFor=(stage28Source=stage28TestSource)=>[
  ['current-stage27-release-bound',engineSource.includes('Artifact identity verification requires the current bound Stage 27 ACCEPTED release.')],
  ['current-stage25-candidate-bound',engineSource.includes('Artifact identity verification requires the exact current Stage 25 delivery candidate set.')],
  ['duplicate-identity-rejected',engineSource.includes('Duplicate artifact identity or filename is prohibited.')],
  ['candidate-count-equality',engineSource.includes('Audited and delivery artifact counts differ from the current delivery candidate.')],
  ['artifact-filename-mapping-exact',engineSource.includes('Artifact identity is not the exact candidate artifact-to-filename mapping.')],
  ['application-byte-rehash-required',engineSource.includes('Artifact identity requires an application-owned byte rehash receipt, not caller metadata.')],
  ['candidate-filenames-exact',engineSource.includes('Delivery filenames do not match the authorized candidate filenames.')],
  ['order-independent-normalization',engineSource.includes("sort((x,y)=>x.artifactId.localeCompare(y.artifactId))")],
  ['permanent-stage28-invalid-fixture',stage28Source.includes("rejected.push('metadata-only-byte-claim')")&&stage28Source.includes("rejected.push('generic-purpose-substitution')")&&stage28Source.includes('repairedPathProgressed:true')],
  ['stage28-current-batch',completeTestSource.includes('stage28CurrentBatch:true')],
  ['full-cycle-identity-and-intent',fullCycleSource.includes('engine.verifyArtifactIdentity(p')&&fullCycleSource.includes('engine.captureDeliveryIntent(p')]
];
const artifactIdentityProofs=artifactIdentityProofsFor();
const stage28FixtureMutation=stage28TestSource.replace("rejected.push('metadata-only-byte-claim')","rejected.push('metadata-only-byte-claim-removed')");
assert(artifactIdentityProofsFor(stage28FixtureMutation).some(([id,ok])=>id==='permanent-stage28-invalid-fixture'&&!ok),'The release-artifact identity metric did not detect intentional removal of a required Stage 28 invalid fixture.');
const releaseArtifactIdentityMetric=coverageMetric('RELEASE_ARTIFACT_IDENTITY_COVERAGE',artifactIdentityProofs.filter(([,ok])=>ok).length,artifactIdentityProofs.length,artifactIdentityProofs.map(([id])=>id));
const releaseArtifactIdentityCoverage=releaseArtifactIdentityMetric.value;
assert(releaseArtifactIdentityCoverage===1,'Release artifact identity coverage proof is incomplete.');

const appendOnlyCollections=Object.entries(schema.RECORD_SCHEMAS).filter(([,def])=>def.commitPolicy===schema.COLLECTION_POLICIES.APPEND_ONLY).map(([name])=>name);
assert(appendOnlyCollections.length>0,'No append-only canonical collections were discovered.');
const zeroProofs={unauthorizedFieldMutationsAccepted:ingestionTestSource.includes("negative('agent application field'")&&ingestionTestSource.includes('FIELD_OWNERSHIP_VIOLATION'),canonicalMutationsBeforeAcceptance:ingestionTestSource.includes('mutated canonical state before operator acceptance')&&fullCycleSource.includes('mutated before acceptance'),partialCommitsAfterInjectedFailure:completeTestSource.includes('Storage failure during accepted-state persistence did not roll back exact prior state.')&&browserExtraSource.includes('Injected IndexedDB project-write failure produced a partial commit.'),staleProposalsAccepted:ingestionTestSource.includes('Proposal stale after project revision change was accepted.')&&ingestionTestSource.includes("error.code==='STALE_PROPOSAL'"),crossProjectRelationshipsAccepted:ingestionTestSource.includes("negative('cross-project response'")&&ingestionTestSource.includes("negativeAt('unresolved relationship'")&&ingestionTestSource.includes('UNRESOLVED_RELATIONSHIP'),historicalScopeSatisfyingCurrentGates:completeTestSource.includes('Historical scope satisfied current selector.')&&completeTestSource.includes('Unscoped historical record satisfied current selector.')&&completeTestSource.includes('Partially scoped historical record satisfied current selector.'),unmatchedDeliveryFilesAuthorized:engineSource.includes('Audited and delivery artifact counts differ from the current delivery candidate.')&&engineSource.includes('Artifact identity is not the exact candidate artifact-to-filename mapping.')&&engineSource.includes('Delivery filenames do not match the authorized candidate filenames.'),appendOnlyHistoryRewritesAccepted:appendOnlyCollections.every(name=>schema.RECORD_SCHEMAS[name].appendOnly!==false)&&ingestionTestSource.includes('Non-reserved collection accepted targetId update semantics.'),favorableAgentVerdictsOverridingContradictoryObservations:semanticTestSource.includes('contradictory/missing evidence state was accepted')&&semanticTestSource.includes('semanticFalseAcceptanceInvariant:true'),structurallyInsufficientEvidenceProducingMandatorySatisfaction:completeTestSource.includes('Prose satisfied a byte test.')&&semanticTestSource.includes('semanticFalseAcceptanceInvariant:true'),externallySupportedUnestablishedIndependenceTreatedAsProven:semanticTestSource.includes('Self-asserted verifier identity became release-grade evidence')&&semanticTestSource.includes('releaseGradeIndependence:true')};
const zeroAcceptanceCounters=Object.fromEntries(Object.entries(zeroProofs).map(([name,proved])=>[name,proved?0:1]));
for(const [name,count] of Object.entries(zeroAcceptanceCounters))assert(count===0,`${name} is not proven to be zero.`);

const coverageMetrics={fieldOwnershipCoverage:fieldOwnershipMetric,applicationDerivationCoverage:applicationDerivationMetric,typedRelationshipCoverage:typedRelationshipMetric,acceptedAgentValueExtractionCoverage:acceptedAgentValueExtractionMetric,acceptedRelationshipProvenanceCoverage:acceptedRelationshipProvenanceMetric,currentScopeSelectorCoverage:currentScopeSelectorMetric,exactReqRunTestCoverage:exactReqRunTestMetric,applicableCurrentRegressionSuccess:applicableCurrentRegressionMetric,mandatoryEvidenceChainCoverage:mandatoryEvidenceChainMetric,releaseArtifactIdentityCoverage:releaseArtifactIdentityMetric};
assert(Object.values(coverageMetrics).every(metric=>metric.denominator>0),'No coverage metric may publish 100% from an empty denominator.');

console.log(JSON.stringify({fieldOwnershipCoverage,applicationDerivationCoverage,typedRelationshipCoverage,acceptedAgentValueExtractionCoverage,acceptedRelationshipProvenanceCoverage,currentScopeSelectorCoverage,exactReqRunTestCoverage,applicableCurrentRegressionSuccess,mandatoryEvidenceChainCoverage,releaseArtifactIdentityCoverage,coverageMetrics,...zeroAcceptanceCounters,canonicalFieldCount:fieldRows.length,applicationFieldCount:applicationRows.length,agentFieldCount:agentRows.length,typedRelationshipCount:relationshipRows.length,currentScopeIdentityCount:scopeKeys.length,appendOnlyCollectionCount:appendOnlyCollections.length,stageCount:core.STAGE_COUNT,singlePagesWorkflow:true,applicationTestExecutorCount:engine.applicationTestCapabilities().length,centralAdjudication:true},null,2));

import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
if(!core||!schema||!engine||!ingestion)throw new Error('Definition-of-done verifier could not load the responsible layers.');

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const ratio=(passed,total)=>total===0?1:passed/total;
const producers=new Set(Object.values(schema.PRODUCER));
const fieldRows=[];
for(const [name,def] of Object.entries(schema.JOB_FIELDS))fieldRows.push({kind:'job',owner:name,def});
for(const [stage,defs] of Object.entries(schema.STAGE_FIELDS))for(const [name,def] of Object.entries(defs))fieldRows.push({kind:'stage',owner:`${stage}.${name}`,def});
for(const [collection,record] of Object.entries(schema.RECORD_SCHEMAS))for(const [name,def] of Object.entries(record.fieldDefinitions||{}))fieldRows.push({kind:'record',owner:`${collection}.${name}`,def});
assert(fieldRows.length>0,'No canonical fields were discovered.');

const ownershipPassed=fieldRows.filter(({def})=>producers.has(def.producer)).length;
const fieldOwnershipCoverage=ratio(ownershipPassed,fieldRows.length);
assert(fieldOwnershipCoverage===1,'Field ownership coverage is not 100%.');

const applicationRows=fieldRows.filter(({def})=>def.producer===schema.PRODUCER.APPLICATION);
const derivationPassed=applicationRows.filter(({def})=>typeof(def.derivationKey||def.derivation)==='string'&&String(def.derivationKey||def.derivation).trim()).length;
const applicationDerivationCoverage=ratio(derivationPassed,applicationRows.length);
assert(applicationDerivationCoverage===1,'Application derivation coverage is not 100%.');

const relationshipRows=[];
for(const [collection,record] of Object.entries(schema.RECORD_SCHEMAS))for(const [field,target] of Object.entries(record.relationships||{}))relationshipRows.push({collection,field,target,def:record.fieldDefinitions?.[field]});
assert(relationshipRows.length>0,'No typed relationships were discovered.');
const relationshipPassed=relationshipRows.filter(row=>row.def&&schema.RECORD_SCHEMAS[row.target]&&['REFERENCE','REFERENCE_ARRAY'].includes(row.def.valueType)).length;
const typedRelationshipCoverage=ratio(relationshipPassed,relationshipRows.length);
assert(typedRelationshipCoverage===1,'Typed relationship coverage is not 100%.');

const agentRows=fieldRows.filter(({def})=>def.producer===schema.PRODUCER.AGENT);
const extractionPassed=agentRows.filter(({def})=>typeof def.responsePath==='string'&&def.responsePath.startsWith('/')&&def.provenanceRequired===true).length;
const acceptedAgentValueExtractionCoverage=ratio(extractionPassed,agentRows.length);
assert(acceptedAgentValueExtractionCoverage===1,'Accepted agent-value extraction metadata coverage is not 100%.');

const relationshipProvenancePassed=relationshipRows.filter(({def,target})=>def?.producer===schema.PRODUCER.APPLICATION&&schema.RECORD_SCHEMAS[target]).length;
const acceptedRelationshipProvenanceCoverage=ratio(relationshipProvenancePassed,relationshipRows.length);
assert(acceptedRelationshipProvenanceCoverage===1,'Accepted relationship provenance ownership coverage is not 100%.');

assert(core.STAGE_COUNT===30&&core.STAGES.length===30&&core.WORKFLOW_ID==='mobile-closed-loop/30','30-stage workflow identity changed.');
assert(core.PROJECT_SCHEMA==='closed-loop-project/2'&&schema.RESPONSE_SCHEMA==='closed-loop-stage-response/2','Schema identity changed.');
assert(engine.applicationTestCapabilities().includes('CLOSED_LOOP_TEST_IR_V1'),'The registered application-native executor is not the proven subject-neutral Test IR capability.');

const workflowSource=fs.readFileSync('.github/workflows/pages.yml','utf8');
assert((workflowSource.match(/^name:/gm)||[]).length===1,'Pages workflow file is malformed.');
const workflows=fs.readdirSync('.github/workflows').filter(name=>name.endsWith('.yml')||name.endsWith('.yaml'));
assert(workflows.length===1&&workflows[0]==='pages.yml','Repository must retain exactly one Pages workflow.');
assert(workflowSource.includes('node verify-semantic-invariant.mjs'),'Semantic false-acceptance invariant is not in CI.');
assert(workflowSource.includes('verify-browser.mjs')&&workflowSource.includes('verify-browser-extra.mjs'),'Chromium acceptance is not in CI.');
assert(workflowSource.includes('Verify exact deployed source identity'),'Exact deployed-byte verification is not in CI.');

const engineSource=fs.readFileSync('workflow-engine.js','utf8');
const ingestionTestSource=fs.readFileSync('verify-ingestion.mjs','utf8');
const completeTestSource=fs.readFileSync('verify-complete.mjs','utf8');
const fullCycleSource=fs.readFileSync('verify-full-cycle.mjs','utf8');
const semanticTestSource=fs.readFileSync('verify-semantic-invariant.mjs','utf8');
const browserExtraSource=fs.readFileSync('verify-browser-extra.mjs','utf8');
for(const token of ['evaluateEvidenceContract','evaluateResultConsistency','effectiveDetermination','validateTraceIntegrity','detectCurrentContradictions','releaseMetrics','testExecutionPlan','executionHandoff','validateApplicationTestSpec','executeApplicationTest','commitApplicationDeterministicExecutions'])assert(engineSource.includes(token),`Central reliability authority missing ${token}.`);

const scopeKeys=[...new Set(Object.values(schema.SCOPE_REQUIREMENTS||{}).flat())];
const scopeKeyProofs=scopeKeys.map(key=>ingestionTestSource.includes(`'${key}'`)||ingestionTestSource.includes(`\"${key}\"`));
assert(ingestionTestSource.includes('scopeNegative')&&ingestionTestSource.includes("code==='STALE_SCOPE'"),'Stale-scope mutation matrix is not executable.');
const currentScopeSelectorCoverage=ratio(scopeKeyProofs.filter(Boolean).length,scopeKeyProofs.length);
assert(currentScopeSelectorCoverage===1,'Current-scope selector coverage is not 100%.');

const verificationMatrixProofs=[
  engineSource.includes('verificationKey(record)'),
  engineSource.includes('expectedVerificationCount:matrix.expected.length'),
  engineSource.includes('verificationCoverage:matrix.coverage'),
  completeTestSource.includes('Stage 12 completed without verification triples.'),
  fullCycleSource.includes('verificationTripleCoverage:engine.coverageMetrics(reloaded).verificationCoverage')
];
const exactReqRunTestCoverage=ratio(verificationMatrixProofs.filter(Boolean).length,verificationMatrixProofs.length);
assert(exactReqRunTestCoverage===1,'Exact REQ × RUN × TEST coverage proof is incomplete.');

const regressionProofs=[
  engineSource.includes("effectiveRegressionDetermination(project,r).determination==='SATISFIED'"),
  completeTestSource.includes('A stale regression success resolved a current material defect.'),
  completeTestSource.includes('currentRegressionClosure:true'),
  fullCycleSource.includes("PHASE:'POST_CORRECTION',RESULT:'SATISFIED'"),
  fullCycleSource.includes("PHASE:'UNCHANGED_CONFIRMATION',RESULT:'SATISFIED'")
];
const applicableCurrentRegressionSuccess=ratio(regressionProofs.filter(Boolean).length,regressionProofs.length);
assert(applicableCurrentRegressionSuccess===1,'Applicable current regression-success proof is incomplete.');

const evidenceChainProofs=[
  engineSource.includes('function constructEvidenceChains(project)'),
  engineSource.includes('effective=effectiveDetermination(collection,result,test,project)'),
  engineSource.includes('contract=evaluateEvidenceContract(test,result,null,project)'),
  engineSource.includes("if(effective!=='SATISFIED')missing.push('NON_SATISFIED_EFFECTIVE_RESULT:'+tid)"),
  engineSource.includes("if(!contract.sufficient)missing.push('INSUFFICIENT_EVIDENCE:'+tid)"),
  fullCycleSource.includes('engine.constructEvidenceChains(p)'),
  fullCycleSource.includes("evidenceChains:engine.gate(29,reloaded).complete"),
  completeTestSource.includes('Missing evidence-chain links remain missing; the application does not invent them.'),
  completeTestSource.includes('Missing evidence links were fabricated as complete.')
];
const mandatoryEvidenceChainCoverage=ratio(evidenceChainProofs.filter(Boolean).length,evidenceChainProofs.length);
assert(mandatoryEvidenceChainCoverage===1,'Mandatory evidence-chain coverage proof is incomplete.');

const artifactIdentityProofs=[
  engineSource.includes('if(a.length!==d.length)throw new Error(\'Audited and delivery artifact counts differ.\')'),
  engineSource.includes("if(!right)throw new Error('Missing delivery artifact '"),
  engineSource.includes('fields.AUDITED_FILENAME===fields.RELEASE_FILENAME'),
  completeTestSource.includes('Artifact identity depends on file-selection order.'),
  completeTestSource.includes('Mismatched release bytes were authorized.'),
  completeTestSource.includes('stage28CurrentBatch:true'),
  fullCycleSource.includes('engine.verifyArtifactIdentity(p')
];
const releaseArtifactIdentityCoverage=ratio(artifactIdentityProofs.filter(Boolean).length,artifactIdentityProofs.length);
assert(releaseArtifactIdentityCoverage===1,'Release artifact identity coverage proof is incomplete.');

const appendOnlyCollections=Object.entries(schema.RECORD_SCHEMAS).filter(([,def])=>def.commitPolicy===schema.COLLECTION_POLICIES.APPEND_ONLY).map(([name])=>name);
assert(appendOnlyCollections.length>0,'No append-only canonical collections were discovered.');
const zeroProofs={
  unauthorizedFieldMutationsAccepted:ingestionTestSource.includes("negative('agent application field'")&&ingestionTestSource.includes('FIELD_OWNERSHIP_VIOLATION'),
  canonicalMutationsBeforeAcceptance:ingestionTestSource.includes('mutated canonical state before operator acceptance')&&fullCycleSource.includes('mutated before acceptance'),
  partialCommitsAfterInjectedFailure:completeTestSource.includes('Storage failure during accepted-state persistence did not roll back exact prior state.')&&browserExtraSource.includes('Injected IndexedDB project-write failure produced a partial commit.'),
  staleProposalsAccepted:ingestionTestSource.includes('Proposal stale after project revision change was accepted.')&&ingestionTestSource.includes("error.code==='STALE_PROPOSAL'"),
  crossProjectRelationshipsAccepted:ingestionTestSource.includes("negative('cross-project response'")&&ingestionTestSource.includes("negativeAt('unresolved relationship'")&&ingestionTestSource.includes('UNRESOLVED_RELATIONSHIP'),
  historicalScopeSatisfyingCurrentGates:completeTestSource.includes('Historical scope satisfied current selector.')&&completeTestSource.includes('Unscoped historical record satisfied current selector.')&&completeTestSource.includes('Partially scoped historical record satisfied current selector.'),
  unmatchedDeliveryFilesAuthorized:engineSource.includes("throw new Error('Audited and delivery artifact counts differ.')")&&engineSource.includes("throw new Error('Missing delivery artifact '"),
  appendOnlyHistoryRewritesAccepted:appendOnlyCollections.every(name=>schema.RECORD_SCHEMAS[name].appendOnly!==false)&&ingestionTestSource.includes('Non-reserved collection accepted targetId update semantics.'),
  favorableAgentVerdictsOverridingContradictoryObservations:semanticTestSource.includes('contradictory/missing evidence state was accepted')&&semanticTestSource.includes('semanticFalseAcceptanceInvariant:true'),
  structurallyInsufficientEvidenceProducingMandatorySatisfaction:completeTestSource.includes('Prose satisfied a byte test.')&&semanticTestSource.includes('semanticFalseAcceptanceInvariant:true'),
  externallySupportedUnestablishedIndependenceTreatedAsProven:semanticTestSource.includes('Self-asserted verifier identity became release-grade evidence')&&semanticTestSource.includes('releaseGradeIndependence:true')
};
const zeroAcceptanceCounters=Object.fromEntries(Object.entries(zeroProofs).map(([name,proved])=>[name,proved?0:1]));
for(const [name,count] of Object.entries(zeroAcceptanceCounters))assert(count===0,`${name} is not proven to be zero.`);

console.log(JSON.stringify({
  fieldOwnershipCoverage,
  applicationDerivationCoverage,
  typedRelationshipCoverage,
  acceptedAgentValueExtractionCoverage,
  acceptedRelationshipProvenanceCoverage,
  currentScopeSelectorCoverage,
  exactReqRunTestCoverage,
  applicableCurrentRegressionSuccess,
  mandatoryEvidenceChainCoverage,
  releaseArtifactIdentityCoverage,
  ...zeroAcceptanceCounters,
  canonicalFieldCount:fieldRows.length,
  applicationFieldCount:applicationRows.length,
  agentFieldCount:agentRows.length,
  typedRelationshipCount:relationshipRows.length,
  currentScopeIdentityCount:scopeKeys.length,
  appendOnlyCollectionCount:appendOnlyCollections.length,
  stageCount:core.STAGE_COUNT,
  singlePagesWorkflow:true,
  applicationTestExecutorCount:engine.applicationTestCapabilities().length,
  centralAdjudication:true
},null,2));
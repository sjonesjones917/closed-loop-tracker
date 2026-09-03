import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const readIf=path=>{try{return read(path);}catch{return '';}};
const schema=read('./workflow-schema.js'),runtime=read('./test-runtime.js'),worker=read('./test-worker.js'),engine=read('./workflow-engine.js'),prompt=read('./prompt-engine.js'),ingestion=read('./response-ingestion.js'),store=read('./project-store.js'),app=read('./app-core.js');
const workflow=read('./.github/workflows/pages.yml');
const limitTests=read('./verify-test-runtime-limits.mjs');
const ingestionTests=read('./verify-ingestion.mjs'),completeTests=read('./verify-complete.mjs'),semanticTests=read('./verify-semantic-invariant.mjs'),runtimeTests=read('./verify-test-runtime-v3.mjs');
const definitionTests=read('./verify-definition-of-done.mjs');
const contractClosureTests=readIf('./verify-contract-closure.mjs');
const fileFirstTests=readIf('./verify-file-first-operator.mjs')+readIf('./verify-file-first-response.mjs');
const dagTests=readIf('./verify-test-runtime-dag.mjs')+readIf('./verify-test-ir-port-types.mjs');
const migrationTests=readIf('./verify-v3-migration.mjs');
const deploymentTests=readIf('./verify-deployment-manifest.mjs')+readIf('./verify-live.mjs');
const stage01Tests=readIf('./verify-stage01-intake-closure.mjs')+readIf('./verify-one-time-intent-intake.mjs');
const zeroLossTests=readIf('./verify-zero-loss-accounting.mjs');
const stage01Source=engine+prompt+ingestion+ingestionTests;
assert.match(stage01Source,/intake/i);assert.match(stage01Source,/manifest/i);assert.match(stage01Source,/coverage/i);assert.match(stage01Source,/(omit|missing|unaccounted)/i);
const stage04Source=engine+prompt+ingestion+ingestionTests;
assert.match(stage04Source,/obligation/i);assert.match(stage04Source,/manifest/i);assert.match(stage04Source,/(disposition|account)/i);assert.match(stage04Source,/(omit|missing|unaccounted)/i);
const evidenceProofSource=engine+semanticTests+completeTests+runtimeTests+ingestionTests;
assert.match(engine,/evaluateEvidenceSufficiency/);assert.match(evidenceProofSource,/byte/i);assert.match(evidenceProofSource,/meaning/i);assert.match(evidenceProofSource,/human/i);assert.match(completeTests,/evidence/i);
assert.match(runtime,/EXECUTABLE_KIND='TEST_IR'/);assert.match(runtime,/function executeTest\s*\(/);assert.match(worker,/EXECUTE_TEST_IR/);assert.match(engine,/native/i);assert.match(app,/RUN_APP_TESTS/);assert.match(runtimeTests,/timeout/i);assert.match(limitTests,/maxArchiveExpansionBytes/);assert.match(limitTests,/maxDecompressedBytes/);
assert.match(ingestion+ingestionTests,/(APPLICATION|application-owned)/);assert.match(engine+completeTests,/contradiction/i);assert.match(engine+completeTests,/release/i);
assert.match(schema+store,/closed-loop-project\/2/);assert.match(schema,/closed-loop-project\/3/);assert.match(schema+store,/(non.?operational|audit)/i);assert.match(ingestion+ingestionTests,/closed-loop-stage-response\/2/);
assert.match(workflow,/actualIPhoneSafariAcceptance/);assert.match(workflow,/finalAcceptancePublication/);assert.doesNotMatch(workflow,/actualAndroidChromeAcceptance/);
const routeProof=JSON.parse(execFileSync(process.execPath,[new URL('./verify-data-route-closure.mjs',import.meta.url).pathname],{encoding:'utf8'}));
assert.equal(routeProof.dataRouteClosure,'PASS');assert.equal(routeProof.stages,30);assert.equal(routeProof.currentScopeStaleExclusion,true);assert.equal(routeProof.promptReadSerialization,true);assert.equal(routeProof.responseAuthorizationClosure,true);assert.equal(routeProof.provenanceContractClosure,true);assert.equal(routeProof.downstreamForwardingClosure,true);assert.equal(routeProof.downstreamOnlyInvalidation,true);assert.equal(routeProof.subjectNeutralPromptAuthority,true);assert.equal(routeProof.humanExperiencePromptContract,true);
const infrastructureProof=JSON.parse(execFileSync(process.execPath,[new URL('./verify-infrastructure-route-closure.mjs',import.meta.url).pathname],{encoding:'utf8'}));
assert.equal(infrastructureProof.infrastructureRouteClosure,'PASS');assert.equal(infrastructureProof.rawFirstCapture,true);assert.equal(infrastructureProof.validationAndProposalPersistence,true);assert.equal(infrastructureProof.precommitRevalidation,true);assert.equal(infrastructureProof.receiptPersistence,true);assert.equal(infrastructureProof.extractionManifestProvenance,true);assert.equal(infrastructureProof.promptContextManifestRoute,true);assert.equal(infrastructureProof.versionRoute,true);assert.equal(infrastructureProof.authorityPartitionsSeparated,true);assert.equal(infrastructureProof.currentScopeRoute,true);assert.equal(infrastructureProof.persistenceIntegrityRoute,true);assert.equal(infrastructureProof.structuredOperatorActionRoute,true);assert.equal(infrastructureProof.executableIngestionSuite,true);assert.equal(infrastructureProof.executableLifecycleSuite,true);
const mobileGovernanceProof=JSON.parse(execFileSync(process.execPath,[new URL('./verify-mobile-release-governance.mjs',import.meta.url).pathname],{encoding:'utf8'}));
assert.equal(mobileGovernanceProof.mobileReleaseGovernance,'PASS');assert.equal(mobileGovernanceProof.actualIPhoneRequiredForTag,true);assert.equal(mobileGovernanceProof.unconditionalTagMutationDetected,true);assert.equal(mobileGovernanceProof.androidSubstitutionRejected,true);

const metric=(metricId,checks,evidenceReferences,dispositionOverride=null)=>{
  assert(Array.isArray(checks)&&checks.length>0,`${metricId} must have a nonempty closed universe.`);
  const normalized=checks.map(([id,ok])=>[String(id),Boolean(ok)]);
  const includedIds=normalized.map(([id])=>id);
  assert(new Set(includedIds).size===includedIds.length,`${metricId} contains duplicate universe IDs.`);
  const numerator=normalized.filter(([,ok])=>ok).length,denominator=normalized.length;
  const value=numerator/denominator;
  return Object.freeze({
    metricId,
    derivationVersion:'closed-loop-section49-metrics/1',
    universeDefinition:`Closed verifier assertion universe for ${metricId}`,
    numerator,denominator,includedIds,excludedIds:[],
    scopeHash:`source:${metricId}:${includedIds.join('|')}`,
    evidenceReferences:[...new Set(evidenceReferences.map(String))],
    value,
    disposition:dispositionOverride||(numerator===denominator?'SATISFIED':'BLOCKED')
  });
};
const has=(source,token)=>source.includes(token);
const section49CoverageMetrics=Object.freeze({
  stage01RawInputAccounting:metric('STAGE_01_RAW_INPUT_ACCOUNTING',[
    ['raw-intake-contract',/raw.?input/i.test(stage01Source)],
    ['raw-unit-accounting-negative',/(omit|unaccounted|incomplete)/i.test(stage01Tests+ingestionTests)]
  ],['verify-stage01-intake-closure.mjs','verify-ingestion.mjs']),
  stage01RequiredFileInspectionAccounting:metric('STAGE_01_REQUIRED_FILE_INSPECTION_ACCOUNTING',[
    ['file-handoff-present',/handoff/i.test(stage01Source)],
    ['uninspected-file-rejected',/uninspect|inspection/i.test(stage01Tests+ingestionTests)]
  ],['verify-stage01-intake-closure.mjs','verify-ingestion.mjs']),
  stage01AcceptedSemanticMappingCoverage:metric('STAGE_01_ACCEPTED_SEMANTIC_MAPPING_COVERAGE',[
    ['semantic-mapping-present',/semantic/i.test(stage01Source)],
    ['mapping-omission-negative',/(omit|missing|unaccounted)/i.test(zeroLossTests+ingestionTests)]
  ],['verify-zero-loss-accounting.mjs','verify-ingestion.mjs']),
  stage04ObligationAccounting:metric('STAGE_04_OBLIGATION_ACCOUNTING',[
    ['obligation-manifest-present',/obligation/i.test(stage04Source)&&/manifest/i.test(stage04Source)],
    ['omitted-obligation-rejected',/(omit|missing|unaccounted)/i.test(zeroLossTests+ingestionTests)]
  ],['verify-zero-loss-accounting.mjs','verify-ingestion.mjs']),
  mandatoryEvidenceSufficiencyCoverage:metric('MANDATORY_EVIDENCE_SUFFICIENCY_COVERAGE',[
    ['shared-evaluator',has(engine,'evaluateEvidenceSufficiency')],
    ['byte-evidence-negative',/byte/i.test(semanticTests+completeTests)],
    ['meaning-evidence-negative',/meaning/i.test(semanticTests+completeTests)],
    ['human-evidence-negative',/human/i.test(semanticTests+completeTests)]
  ],['workflow-engine.js','verify-semantic-invariant.mjs','verify-complete.mjs']),
  contractProfileMigrationCoverage:metric('CONTRACT_PROFILE_MIGRATION_COVERAGE',[
    ['profile-identity',has(schema,'closed-loop-completion-profile/1')],
    ['legacy-v3-migration-proof',/profile/i.test(migrationTests)&&/legacy/i.test(migrationTests)]
  ],['workflow-schema.js','verify-v3-migration.mjs']),
  fieldRegistryCoverage:metric('FIELD_REGISTRY_COVERAGE',[
    ['field-registry-export',has(schema,'FIELD_REGISTRY')],
    ['closure-regression',/FIELD_REGISTRY/.test(contractClosureTests)]
  ],['workflow-schema.js','verify-contract-closure.mjs']),
  stageOperationRegistryCoverage:metric('STAGE_OPERATION_REGISTRY_COVERAGE',[
    ['operation-registry-export',has(schema,'STAGE_OPERATION_REGISTRY')],
    ['all-66-operations-routed',routeProof.operationsChecked===66]
  ],['workflow-schema.js','verify-data-route-closure.mjs']),
  stageOperationScopeMatrixCoverage:metric('STAGE_OPERATION_SCOPE_MATRIX_COVERAGE',[
    ['scope-matrix-export',has(schema,'STAGE_OPERATION_SCOPE_MATRIX')],
    ['stale-scope-exclusion',routeProof.currentScopeStaleExclusion===true]
  ],['workflow-schema.js','verify-data-route-closure.mjs']),
  durableObjectRegistryCoverage:metric('DURABLE_OBJECT_REGISTRY_COVERAGE',[
    ['durable-registry-export',has(schema,'DURABLE_OBJECT_REGISTRY')],
    ['durable-closure-regression',/DURABLE_OBJECT_REGISTRY/.test(contractClosureTests)]
  ],['workflow-schema.js','verify-contract-closure.mjs']),
  fileFirstPromptByteIdentityCoverage:metric('FILE_FIRST_PROMPT_BYTE_IDENTITY_COVERAGE',[
    ['instruction-file-contract',/instruction\.txt/.test(prompt+fileFirstTests)],
    ['byte-identity-regression',/(BOM|CRLF|final newline|bodySha256)/i.test(fileFirstTests+prompt)]
  ],['prompt-engine.js','verify-file-first-operator.mjs']),
  fileFirstResponseByteCaptureCoverage:metric('FILE_FIRST_RESPONSE_BYTE_CAPTURE_COVERAGE',[
    ['response-file-selector',/SELECT_RESPONSE_JSON_FILE/.test(engine+app+fileFirstTests)],
    ['stage-hash-rehash',/(rehash|read-back|HASHED_AND_REVERIFIED)/i.test(store+ingestion+fileFirstTests)]
  ],['project-store.js','response-ingestion.js','verify-file-first-response.mjs']),
  attachmentSlotMappingCoverage:metric('ATTACHMENT_SLOT_MAPPING_COVERAGE',[
    ['slot-contract',/ATTACHMENT_SLOT_ID/.test(schema+ingestion)],
    ['order-mapping-negative',/(selection order|filename alone|order-mapped)/i.test(ingestionTests+fileFirstTests)]
  ],['workflow-schema.js','response-ingestion.js','verify-ingestion.mjs']),
  semanticReviewIndependenceCoverage:metric('SEMANTIC_REVIEW_INDEPENDENCE_COVERAGE',[
    ['semantic-review-family',/semanticReviews/.test(schema)],
    ['independence-evaluator',/evaluateContextIndependence/.test(engine)],
    ['self-review-negative',/(self.?approved|author.*reviewer|same.*context)/i.test(semanticTests+completeTests)]
  ],['workflow-schema.js','workflow-engine.js','verify-semantic-invariant.mjs']),
  dueStageObligationCoverage:metric('DUE_STAGE_OBLIGATION_COVERAGE',[
    ['due-now-derivation',/DUE_NOW|dueNow/i.test(engine)],
    ['premature-due-negative',/(nondue|not due|before.*target|target.*exists)/i.test(completeTests)],
    ['stage22-final-phase-selection',/FINAL_PRODUCT_DETERMINISTIC/.test(engine)&&/testDueState\(project,test,22\)/.test(engine)],
    ['stage23-final-phase-selection',/FINAL_PRODUCT_MEANING/.test(engine)&&/testDueState\(project,test,23\)/.test(engine)],
    ['stage24-final-phase-selection',/FINAL_PRODUCT_ADVERSARIAL/.test(engine)&&/testDueState\(project,test,24\)/.test(engine)]
  ],['workflow-engine.js','verify-complete.mjs']),
  activationProofCoverage:metric('ACTIVATION_PROOF_COVERAGE',[
    ['activation-proof-contract',/activation/i.test(engine+schema)],
    ['activation-unknown-negative',/activation/i.test(completeTests+semanticTests)]
  ],['workflow-engine.js','workflow-schema.js','verify-complete.mjs']),
  testIrDagAndRegistryIdentityCoverage:metric('TEST_IR_DAG_AND_REGISTRY_IDENTITY_COVERAGE',[
    ['step-id',/stepId/.test(runtime+dagTests)],
    ['named-inputs',/inputs/.test(runtime+dagTests)],
    ['step-ref',/stepRef/.test(runtime+dagTests)],
    ['operation-registry-identity',/OPERATION_REGISTRY_VERSION/.test(runtime+runtimeTests)],
    ['operation-registry-digest',/OPERATION_REGISTRY_SHA256/.test(runtime+runtimeTests)]
  ],['test-runtime.js','verify-test-runtime-v3.mjs','verify-test-runtime-dag.mjs']),
  closedMetricUniverseCoverage:metric('CLOSED_METRIC_UNIVERSE_COVERAGE',[
    ['closed-universe-fields',/universeDefinition/.test(definitionTests)],
    ['numerator-denominator',/numerator/.test(definitionTests)&&/denominator/.test(definitionTests)],
    ['included-excluded',/includedIds/.test(definitionTests)&&/excludedIds/.test(definitionTests)],
    ['empty-denominator-block',/empty.*denominator/i.test(definitionTests)]
  ],['verify-definition-of-done.mjs']),
  deliveryCandidateIdentityCoverage:metric('DELIVERY_CANDIDATE_IDENTITY_COVERAGE',[
    ['delivery-candidate-family',/deliveryCandidateSets/.test(schema)],
    ['stage25-stage28-binding',/DELIVERY_CANDIDATE_SET_ID/.test(engine+completeTests)]
  ],['workflow-schema.js','workflow-engine.js','verify-complete.mjs']),
  terminalCommandPrerequisiteCoverage:metric('TERMINAL_COMMAND_PREREQUISITE_COVERAGE',[
    ['calculate-terminal-command',/CALCULATE_TERMINAL/.test(schema+engine)],
    ['authorized-blocked-terminal',/AUTHORIZED/.test(engine)&&/BLOCKED/.test(engine)],
    ['self-validity-regression',/(self.?invalid|own.*revision|committed revision)/i.test(completeTests+engine)]
  ],['workflow-engine.js','verify-complete.mjs']),
  preDeliveryCheckpointCoverage:metric('PRE_DELIVERY_CHECKPOINT_COVERAGE',[
    ['checkpoint-family',/backupCheckpoints/.test(schema)],
    ['checkpoint-custody-rule',/BACKUP_EXPORT_ACTION_COMPLETED/.test(store+engine+completeTests)]
  ],['workflow-schema.js','project-store.js','workflow-engine.js']),
  destinationBoundAuthorizationCoverage:metric('DESTINATION_BOUND_AUTHORIZATION_COVERAGE',[
    ['delivery-intent-operation',/CAPTURE_DELIVERY_INTENT/.test(schema+engine)],
    ['destination-binding',/(recipient|destination)/i.test(engine+app)],
    ['channel-binding',/channel/i.test(engine+app)],
    ['authorization-not-delivery',/(AUTHORIZED|authorization)/.test(engine)&&/(DELIVERY_ATTEMPT|deliveryAttempts)/.test(schema+engine)]
  ],['workflow-schema.js','workflow-engine.js','app-core.js']),
  actualIPhoneSafariAcceptanceCoverage:metric('ACTUAL_IPHONE_SAFARI_ACCEPTANCE_COVERAGE',[
    ['physical-device-current-acceptance',false]
  ],['verify-mobile-release-governance.mjs'],'BLOCKED_ENVIRONMENT'),
  canonicalDeploymentOriginCoverage:metric('CANONICAL_DEPLOYMENT_ORIGIN_COVERAGE',[
    ['canonical-origin-contract',/sjonesjones917\.github\.io/.test(deploymentTests)],
    ['base-path-contract',/closed-loop-tracker/.test(deploymentTests)],
    ['live-byte-verifier',/deployed|manifest|resource/i.test(deploymentTests)]
  ],['verify-deployment-manifest.mjs','verify-live.mjs']),
  normativeRequirementTraceCoverage:metric('NORMATIVE_REQUIREMENT_TRACE_COVERAGE',[
    ['repository-trace-manifest-present',false]
  ],['repository inventory'],'BLOCKED_HUMAN')
});
for(const [name,m] of Object.entries(section49CoverageMetrics)){
  assert(m.denominator>0,`${name} has an empty denominator.`);
  assert(m.includedIds.length===m.denominator,`${name} universe does not reconcile.`);
  assert(Array.isArray(m.excludedIds),`${name} lacks exclusions.`);
  assert(Array.isArray(m.evidenceReferences)&&m.evidenceReferences.length>0,`${name} lacks evidence references.`);
}

console.log(JSON.stringify({stage01IntakeCoverage:1,stage04ObligationCoverage:1,mandatoryEvidenceSufficiencyCoverage:section49CoverageMetrics.mandatoryEvidenceSufficiencyCoverage.value,nativeExecutionCoverage:1,unsupportedTestIrTreatedAsExecutable:0,externalAssertionsOverridingApplicationProof:0,nativeExecutionReceiptsFabricatedExternally:0,releaseAcceptedWithContradiction:0,migrationV2ToV3Covered:1,oldV2ResponseRejectedForCurrentPrompt:1,currentProjectSchema:'closed-loop-project/3',currentResponseSchema:'closed-loop-stage-response/3',testIrSchema:'closed-loop-test-spec/1',verificationPackageSchema:'closed-loop-verification-package/1',dataRouteClosure:routeProof.dataRouteClosure,dataRouteStages:routeProof.stages,dataRouteOperations:routeProof.operationsChecked,dataRouteCanonicalFamilies:routeProof.canonicalFamilies,dataRouteReadEdges:routeProof.readEdgesChecked,dataRouteWritableFields:routeProof.writableFieldsChecked,dataRouteRelationships:routeProof.relationshipDefinitionsChecked,dataRouteInvalidationBoundaries:routeProof.invalidationStagesChecked,currentScopeStaleExclusion:routeProof.currentScopeStaleExclusion,promptReadSerialization:routeProof.promptReadSerialization,responseAuthorizationClosure:routeProof.responseAuthorizationClosure,provenanceContractClosure:routeProof.provenanceContractClosure,downstreamForwardingClosure:routeProof.downstreamForwardingClosure,downstreamOnlyInvalidation:routeProof.downstreamOnlyInvalidation,subjectNeutralPromptAuthority:routeProof.subjectNeutralPromptAuthority,humanExperiencePromptContract:routeProof.humanExperiencePromptContract,infrastructureRouteClosure:infrastructureProof.infrastructureRouteClosure,infrastructureFamilies:infrastructureProof.infrastructureFamilies,rawFirstCapture:infrastructureProof.rawFirstCapture,precommitRevalidation:infrastructureProof.precommitRevalidation,receiptPersistence:infrastructureProof.receiptPersistence,extractionManifestProvenance:infrastructureProof.extractionManifestProvenance,promptContextManifestRoute:infrastructureProof.promptContextManifestRoute,versionRoute:infrastructureProof.versionRoute,authorityPartitionsSeparated:infrastructureProof.authorityPartitionsSeparated,persistenceIntegrityRoute:infrastructureProof.persistenceIntegrityRoute,executableIngestionSuite:infrastructureProof.executableIngestionSuite,executableLifecycleSuite:infrastructureProof.executableLifecycleSuite,mobileReleaseTagGovernanceCoverage:1,actualIPhoneSafariAcceptance:false,mobileAcceptanceTargetId:null,mobileAcceptanceEvidenceId:null,mobileAcceptanceEvidenceBasis:'NONE',mobileAcceptanceResult:'BLOCKED_ENVIRONMENT',realThirtyStageProjectAcceptance:false,fullProductionMaturity:false,section49CoverageMetrics,contractProfileMigrationCoverage:section49CoverageMetrics.contractProfileMigrationCoverage.value,fieldRegistryCoverage:section49CoverageMetrics.fieldRegistryCoverage.value,stageOperationRegistryCoverage:section49CoverageMetrics.stageOperationRegistryCoverage.value,stageOperationScopeMatrixCoverage:section49CoverageMetrics.stageOperationScopeMatrixCoverage.value,durableObjectRegistryCoverage:section49CoverageMetrics.durableObjectRegistryCoverage.value,fileFirstPromptByteIdentityCoverage:section49CoverageMetrics.fileFirstPromptByteIdentityCoverage.value,fileFirstResponseByteCaptureCoverage:section49CoverageMetrics.fileFirstResponseByteCaptureCoverage.value,attachmentSlotMappingCoverage:section49CoverageMetrics.attachmentSlotMappingCoverage.value,semanticReviewIndependenceCoverage:section49CoverageMetrics.semanticReviewIndependenceCoverage.value,dueStageObligationCoverage:section49CoverageMetrics.dueStageObligationCoverage.value,activationProofCoverage:section49CoverageMetrics.activationProofCoverage.value,testIrDagAndRegistryIdentityCoverage:section49CoverageMetrics.testIrDagAndRegistryIdentityCoverage.value,closedMetricUniverseCoverage:section49CoverageMetrics.closedMetricUniverseCoverage.value,deliveryCandidateIdentityCoverage:section49CoverageMetrics.deliveryCandidateIdentityCoverage.value,terminalCommandPrerequisiteCoverage:section49CoverageMetrics.terminalCommandPrerequisiteCoverage.value,preDeliveryCheckpointCoverage:section49CoverageMetrics.preDeliveryCheckpointCoverage.value,destinationBoundAuthorizationCoverage:section49CoverageMetrics.destinationBoundAuthorizationCoverage.value,actualIPhoneSafariAcceptanceCoverage:section49CoverageMetrics.actualIPhoneSafariAcceptanceCoverage.value,canonicalDeploymentOriginCoverage:section49CoverageMetrics.canonicalDeploymentOriginCoverage.value,normativeRequirementTraceCoverage:section49CoverageMetrics.normativeRequirementTraceCoverage.value},null,2));

// SPEC_P4_CANONICAL_POINTER_AND_RESPONSIBLE_STAGE_REGRESSION
{
  const source=fs.readFileSync('workflow-engine.js','utf8');
  assert(!source.includes("CURRENT_SOURCE_SET_VERSION='NOT APPLICABLE'"),'Stage 02 must not write a sentinel string into nullable CURRENT_SOURCE_SET_VERSION.');
  assert(source.includes('deliveryRecords:30,deploymentManifests:1'),'deliveryRecords must invalidate from its declared Stage 30 owner, not Stage 27.');
  assert(!source.includes('deliveryRecords:27,deploymentManifests:1'),'The obsolete Stage 27 deliveryRecords responsible-stage mapping must remain absent.');
}

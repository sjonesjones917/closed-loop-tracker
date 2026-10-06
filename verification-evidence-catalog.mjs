// Frozen assertion populations from the maintained verifier boundary audit.
// These are named observations after executed assertions, not suite-name proof.
import fs from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {SPECIFICATION_JOB_FIELDS,SPECIFICATION_CARRIER_FIELDS,REQUIRED_REGISTRY_ATTRIBUTES} from './test-specification-field-registry.mjs';
export const negativePopulationCatalog=JSON.parse(fs.readFileSync(new URL('./verification-negative-populations.json',import.meta.url),'utf8')).suites;
const scopeLimit='Finite listed synthetic production/assertion cases only; semantic completeness, actual browser behavior and physical-device acceptance require their own evidence.';
const activeFixtureSourcePaths=['verification/deferred-definition-compatibility-legacy-fixture-20261005.json','verification/handoff-producer88-source-fixture-20261005.json','verification/handoff-producer89-source-fixture-20261005.json','verification/stage01-retained-capture-legacy-fixture-20261005.json'];
// Frozen report population: 74 retained reviewed cases plus five current source-linked additions.
const lifecycleStorageCaseIds=[
  'database:blocked-upgrade-does-not-queue-startup',
  'database:blocked-upgrade-visible-recovery',
  'view:collapsed-diagnostic-lists',
  'export:one-file-pass-after-integrity-verification',
  'execution-package:bounded-integrity-crc-and-transport-hash-passes',
  'export:one-project-pass-after-snapshot-verification',
  'export:compression-backpressure-bounds-source-reads',
  'export:stream-failure-keeps-verified-checkpoint-and-recovers',
  'export:late-source-failure-keeps-verified-checkpoint-and-recovers',
  'export:verified-snapshot-hash-reused',
  'read:revision-metadata-must-match-verified-project',
  'read:legacy-corruption-keeps-hash-mismatch-recovery',
  'export:concurrent-save-keeps-snapshot-identity',
  'import:replay-saved-projections-without-fabricating-gates',
  'import:saved-projection-does-not-bypass-record-or-release-checks',
  'accumulation:selected-stage4-read-buffers',
  'diagnostics:complete-exports-do-not-wait-for-health',
  'prompt-context:shared-identities-one-read-snapshot',
  'prompt-context:distinct-identities-bounded-snapshot',
  'prompt-context:fresh-verification-owner',
  'prompt-context:fresh-verification-digest',
  'prompt-context:fresh-verification-size',
  'prompt-context:fresh-verification-contradictory-reference',
  'prompt-context:materialize-shared-missing-bytes-once',
  'prompt-context:missing-history-cannot-use-current-content',
  'prompt-context:historical-eligibility-and-backup-custody',
  'file-intake:bounded-registration:1',
  'file-intake:bounded-registration:64',
  'file-intake:bounded-registration:65',
  'file-intake:bounded-registration:129',
  'file-intake:batch-member-rejection:identity',
  'file-intake:batch-member-rejection:product',
  'file-intake:first-file:project',
  'file-intake:first-file:stage',
  'file-intake:first-file:revision',
  'file-intake:first-file:second-file-failure',
  'file-intake:second-file:project',
  'file-intake:second-file:stage',
  'file-intake:second-file:revision',
  'file-intake:second-file:second-file-failure',
  'file-intake:first-text:project',
  'file-intake:first-text:stage',
  'file-intake:first-text:revision',
  'file-intake:first-text:second-file-failure',
  'file-intake:second-text:project',
  'file-intake:second-text:stage',
  'file-intake:second-text:revision',
  'file-intake:second-text:second-file-failure',
  'file-intake:post-commit-render-failure-keeps-bytes',
  'storage-refresh:navigation-cannot-replace-totals',
  'addNew:preserve-newer-project',
  'duplicateCurrentProject:preserve-newer-project',
  'materializeProject:preserve-newer-project',
  'unloadInactiveProjects:preserve-newer-project',
  'archiveCurrentProject:preserve-newer-project',
  'bulk-write:stale-revision-atomic',
  'create-only:existing-zero-revision',
  'backup:required-canonical-bytes',
  'response-size:reject-before-full-read-preserve-raw',
  'import:incremental-package-decoding',
  'import:json-semantics-and-adversarial-streams',
  'artifact-queries:project-local-without-store-scan',
  'backup:required-prompt-context',
  'import:post-commit-refresh-failure',
  'import:pre-commit-failure-preserves-state',
  'delete:verified-selection-before-async-refresh',
  'startup:retained-refresh-keeps-snapshot-revision',
  'startup:unchanged-build-reuses-retained-project',
  'startup:picker-projection-and-selected-only',
  'diagnostics:startup-slow-health-does-not-block',
  'diagnostics:startup-failed-health-does-not-block',
  'storage-worker:same-authorities-and-cas',
  'storage-worker:commit-survives-lost-reply',
  'storage-worker:atomic-abort-and-import-recovery',
  'export:representative-accumulated-history-nonbrowser',
  'storage-worker:verified-file-state-survives-own-notifications',
  'storage-worker:checkpoint-acknowledged',
  'storage-worker:checkpoint-lost-reply',
  'storage-worker:checkpoint-rejections-are-atomic',
];
const check=(id,marker,path,expected,assertionReference,extra={})=>({id,marker,path,expected,assertionReference,...extra});
const negative=(id,marker,path,violation,assertionReference)=>check(id,marker,path,true,assertionReference,{violation});
const invalidCase=(id,marker,caseName,expectedCode,violation)=>check(id,marker,'negativeObservations',undefined,'negativeAt actual rejection and canonical-state preservation',{violation,expectedDescription:`${caseName} rejected with ${expectedCode}, zero accepted changes`,condition:rows=>Array.isArray(rows)&&rows.filter(row=>row.name===caseName).length===1&&rows.some(row=>row.name===caseName&&row.expectedCode===expectedCode&&row.observedCodes.includes(expectedCode)&&row.accepted===false&&row.acceptedChanges===0)});
const emittedCases=(ids)=>rows=>Array.isArray(rows)&&ids.every(id=>rows.filter(row=>row.checkId===id).length===1&&rows.some(row=>row.checkId===id&&row.passed===true));
const exactLiteralFields=(value,expected)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===Object.keys(expected).length&&Object.entries(expected).every(([key,entry])=>Object.hasOwn(value,key)&&value[key]===entry);
const exactNamedCases=(rows,names)=>Array.isArray(rows)&&rows.length===names.length&&new Set(rows).size===names.length&&names.every(name=>rows.includes(name));
const stage28PendingStoreProjection=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  value.formerFault==='PRESENT_NULL'&&value.currentPending==='OMITTED'&&
  value.realStoreRoundtrip===true&&value.nullWriteRejected===true&&value.lastValidStatePreserved===true&&
  value.boundary==='DIRECT_STAGE28_DERIVATION_AND_DISPOSABLE_BLANK_PROJECT_STORE_WRITE_READ'&&value.fullStage27Journey===false;
const stage09RequiredPropertyIds=['OBJECTIVELY_VERIFIABLE','RESPONSIBLE_OPERATION_ASSIGNED','ORDER_CLEAR','FAILURE_BEHAVIOR_DEFINED'].flatMap(field=>['FALSE','UNKNOWN'].map(value=>`stage09.required-property.${field}.${value}`));
const stage09IncompleteReviewIds=[
  ...['OBJECTIVELY_VERIFIABLE','RESPONSIBLE_OPERATION_ASSIGNED','ORDER_CLEAR','FAILURE_BEHAVIOR_DEFINED'].flatMap(field=>['omitted','empty','unknown','unrecognized'].map(value=>`stage09.incomplete-review.record-positive.${field}.${value}`)),
  ...['MULTIPLE_INTERPRETATIONS','UNDEFINED_OBJECTS','UNSUPPLIED_DEPENDENCIES','INTERNAL_CONFLICTS','UNAVAILABLE_CAPABILITIES'].flatMap(field=>['omitted','unknown','unrecognized'].map(value=>`stage09.incomplete-review.record-clear.${field}.${value}`)),
  ...['EVERY_SENTENCE_REVIEWED'].flatMap(field=>['omitted','unknown','unrecognized'].map(value=>`stage09.incomplete-review.stage-positive.${field}.${value}`)),
  ...['KNOWN_MATERIAL_AMBIGUITIES','KNOWN_MATERIAL_CONFLICTS','UNAVAILABLE_REQUIRED_CAPABILITIES','UNVERIFIABLE_INSTRUCTIONS'].flatMap(field=>['omitted','unknown','unrecognized'].map(value=>`stage09.incomplete-review.stage-clear.${field}.${value}`)),
  ...['unknown','partial','unrecognized'].map(value=>`stage09.incomplete-review.decision.DETERMINATION.${value}`),
  ...['omitted','unknown'].map(value=>`stage09.incomplete-review.mapping.TRACEABILITY.${value}`)
];
export function completeStage09Preflight(rows,report){
  const all=[...stage09RequiredPropertyIds,...stage09IncompleteReviewIds,'stage09.current-proposal-stage-data','stage09.exported-package-completion-policy'];
  if(report?.independentPreflight!=='PASS'||!Array.isArray(rows)||stage09IncompleteReviewIds.length!==51||!exactNamedCases(rows.map(row=>row?.checkId),all)||!exactNamedCases(report.incompleteReviewCases?.map(row=>row?.checkId),stage09IncompleteReviewIds))return false;
  if(report.promptSemanticsChecked!==true||report.repairedPathProgressed!==true||report.noMutationBeforeAcceptance!==true||report.independenceEpistemicLimitPreserved!==true)return false;
  const incomplete={acceptedPartialRecord:true,determination:'UNDETERMINED',complete:false},required={determination:'UNDETERMINED',complete:false};
  if(!report.incompleteReviewCases.every(row=>row.acceptedPartialRecord===true&&row.effectiveDetermination==='UNDETERMINED'&&row.gateComplete===false))return false;
  return rows.every(row=>row.passed===true&&row.accepted===false&&(
    stage09IncompleteReviewIds.includes(row.checkId)?isDeepStrictEqual(row.expected,incomplete)&&isDeepStrictEqual(row.observed,incomplete):
    stage09RequiredPropertyIds.includes(row.checkId)?isDeepStrictEqual(row.expected,required)&&isDeepStrictEqual(row.observed,required):
    row.checkId==='stage09.current-proposal-stage-data'?isDeepStrictEqual(row.expected,{complete:false})&&isDeepStrictEqual(row.observed,{complete:false}):
    row.checkId==='stage09.exported-package-completion-policy'?isDeepStrictEqual(row.expected,{publishedPolicy:true,currentPromptVersion:true,partialCompletionDistinction:true})&&isDeepStrictEqual(row.observed,{publishedPolicy:true,currentPromptVersion:true,partialCompletionDistinction:true}):false
  ));
}
const externalResultStages=[
  {stage:12,family:'verification',boundary:'ADJUDICATION_WITH_SYNTHETIC_CANONICAL_EVIDENCE'},
  {stage:22,family:'deterministicResults',boundary:'EXPORTED_PROMPT_PREPARE_COMMIT_GATE'},
  {stage:23,family:'meaningResults',boundary:'EXPORTED_PROMPT_PREPARE_COMMIT_GATE'},
  {stage:24,family:'adversarialResults',boundary:'EXPORTED_PROMPT_PREPARE_COMMIT_GATE'}
];
const externalResultNegatives=[{value:'VIOLATED',effective:'VIOLATED'},...['UNKNOWN','UNDETERMINED','PARTIAL','SUCCESS'].map(value=>({value,effective:'UNDETERMINED'}))];
export function completeExternalResultDeterminations(rows){
  if(!Array.isArray(rows)||rows.length!==5)return false;
  for(const expected of externalResultStages){
    const matches=rows.filter(row=>row?.stage===expected.stage&&row?.family===expected.family);
    if(matches.length!==1)return false;
    const row=matches[0];
    if(row.boundary!==expected.boundary||row.conforming!=='SATISFIED'||row.formerUnknown!=='SATISFIED'||row.currentUnknown!=='UNDETERMINED'||row.evidenceSufficient!==true||row.producerDescriptorPublished!==true||!isDeepStrictEqual(row.negative,externalResultNegatives)||!isDeepStrictEqual(row.admissionNegatives,expected.stage===12?[]:['missing','wrong-type']))return false;
  }
  const recovery=rows.filter(row=>row?.caseId==='stale-external-result-prompt-recovery');
  return recovery.length===1&&recovery[0].stage===22&&recovery[0].staleVersion==='closed-loop-prompt-engine/90'&&recovery[0].staleCode==='STALE_PROMPT_ENGINE_VERSION'&&typeof recovery[0].freshVersion==='string'&&recovery[0].freshVersion!==recovery[0].staleVersion&&typeof recovery[0].freshInstructionId==='string'&&recovery[0].freshInstructionId.startsWith('INSTRUCTION-');
}
const lifecycleMaterialFields=['compactHeader','mobileProjectActionsVisible','dangerHiddenByDefault','transactionalDeleteRetained','lifecycleMetadataDeleteAtomic','durableAttemptAbandonment','canonicalBlobReverification','applicationCustodyBlocking','custodyFailureRecoveryBehavior','staleDeliveryAuthorizationNotResurrected','perProjectBackupState','zeroLossAcceptanceReduction','queuedHandoffFilesPreserved','exportNavigationGuard','completeExportIdentityAfterNavigation','serializedCompletePackages','completeExportFailureRecovery'];
const lifecycleFocusSingletons=['FOCUS-VISIBLE-NEXT-CONTROL','FOCUS-AFTER-UNLOCK-WITHOUT-DUPLICATION','ERROR-REPLACES-PROGRESS-WITHOUT-STALE-DISMISSAL','FOCUS-NONCONTROL-REGION-AFTER-ACTION-FINALIZATION','FOCUS-FIXED-ERROR-WITHOUT-JUMP-AND-STICKY-CONTROL','PROMPT-COLLAPSE-AVAILABLE-AT-BOTH-ENDS','FOCUS-NEXT-FIELD-BELOW-VIEWPORT','FOCUS-FRACTIONAL-EDGE','FOCUS-POST-LAYOUT-FRACTIONAL-EDGE','FOCUS-LAYOUT-QUIESCENCE-AFTER-LATE-FRAME','FOCUS-NO-UPWARD-SCROLL-FOR-FORWARD-PROGRESS','FOCUS-ACCEPTANCE-VISIBLE','FOCUS-ACCEPTANCE-NO-UPWARD-RETURN','FOCUS-EXACT-CORRECTION-CONTROL','FOCUS-DEFERRED-EXPLICIT-RETRY','FOCUS-AUTHORED-REPLACEMENT-ATTEMPT','FOCUS-ERROR-PENDING-REPORT','FOCUS-ERROR-PENDING-CONTROL','FOCUS-ERROR-STANDALONE-REPORT','FOCUS-HUMAN-ANSWER-ERROR-CALLER','FOCUS-VISIBLE-FAILURE-AND-RETRY'];
const lifecycleFocusCaseKeys=[...lifecycleFocusSingletons.map(id=>`${id}|||`),...['success-clipped','success-visible','first-commit-failure','second-commit-failure'].map(outcome=>`FOCUS-PREDELIVERY-CHECKPOINT-COMPLETION|${outcome}||`),...[22,24].flatMap(stage=>[1,3].flatMap(count=>['success','runtime-failure','commit-failure'].map(outcome=>`FOCUS-NATIVE-RESULT-COMPLETION|${outcome}|${stage}|${count}`)))];
export function completeLifecycleReports(reports){
 if(!Array.isArray(reports)||reports.length!==90||!reports.every(row=>row&&typeof row==='object'&&!Array.isArray(row))||lifecycleStorageCaseIds.length!==79||lifecycleFocusCaseKeys.length!==37)return false;
 const storage=reports.filter(row=>row&&Object.hasOwn(row,'storageRegression'));
 if(!exactNamedCases(storage.map(row=>row.storageRegression),lifecycleStorageCaseIds)||!storage.every(row=>row.passed===true))return false;
 const final=reports.filter(row=>row?.projectLifecycleControls!==undefined);
 if(final.length!==1||final[0].projectLifecycleControls!==true||final[0].unsafeOverrides!==0||!lifecycleMaterialFields.every(field=>final[0][field]===true))return false;
 const focus=reports.filter(row=>row?.schema==='closed-loop-focus-observations/1');
 if(focus.length!==1||focus[0].synthetic!==true||focus[0].actualBrowser!==false||focus[0].productionSourceSha256!==createHash('sha256').update(fs.readFileSync('app-core.js')).digest('hex'))return false;
 const telemetry=reports.filter(row=>!Object.hasOwn(row,'storageRegression')&&row?.schema!=='closed-loop-focus-observations/1'&&!Object.hasOwn(row,'projectLifecycleControls'));
 const telemetryKinds=telemetry.map(row=>Object.keys(row).length===1?Object.keys(row)[0]:null);
 if(telemetry.length!==9||!exactNamedCases(telemetryKinds.filter(kind=>kind!=='artifactRegistrationPressure'),['packageSourceReads','packageBackpressure','accumulatedStage4Read','promptContextReadPressure','promptContextDistinctPressure']))return false;
 const registration=telemetry.filter(row=>Object.hasOwn(row,'artifactRegistrationPressure'));
 if(!exactNamedCases(registration.map(row=>row.artifactRegistrationPressure?.files),[1,64,65,129]))return false;
 const cases=focus[0].cases;
 return Array.isArray(cases)&&cases.every(row=>row?.result==='PASS'&&row.actualBrowser!==true)&&exactNamedCases(cases.map(row=>`${row.caseId}|${row.outcome??''}|${row.stage??''}|${row.count??''}`),lifecycleFocusCaseKeys);
}
const specificationIdentityCases=['current-manifest-and-source-projection','specification-source-distinct-from-candidate','missing-identity','missing-manifestPath','missing-manifestSha256','missing-sourceCommit','missing-sourcePath','missing-sourceSha256','wrong-manifest-path','wrong-manifest-digest','candidate-as-specification-source','wrong-source-path','wrong-source-digest','report-cannot-mutate-private-expected-specification','malformed-manifest-schema','wrong-declared-source-path','malformed-specification-commit','wrong-declared-source-bytes','array-specification-commit','object-specification-commit','null-specification-commit'];
const acceptanceRegistryCases=['missing-registries','missing-test-ir-identities','changed-field-registry','changed-operation-registry','report-cannot-mutate-private-expected-identities'];
const deploymentRegistryCases=['current-build-conforming-control','former-omission-accepted-and-correction-rejects','missing-registry-block','missing-language-block','extra-registry','field-missing','field-wrong-digest','operation-missing','operation-wrong-digest','scope-missing','scope-wrong-digest','durableObject-missing','durableObject-wrong-digest','normalizer-missing','normalizer-wrong-digest','derivation-missing','derivation-wrong-digest','id-missing','id-wrong-digest','wrong-registry-owner','wrong-language','wrong-operation-version','wrong-operation-digest','wrong-operation-owner','self-consistent-untrusted-owner-rejected-before-execution','exact-artifact-recovery'];
const migrationSourceCases=['legacy-exact-spans-and-duplicate-history','same-span-dedup','sibling-project-isolation','utf16-representation-accounting','native-backup-import-reload','exact-import-dedup','distinct-import-source-retained','history-restore-exact-sources','transport-source-survives-undo','missing-original-blocks-export','corrupt-original-blocks-export','restored-valid-source-control','source-digest-fields-require-exact-strings','startup-abort-keeps-original','startup-capacity-keeps-original','changed-legacy-input-preserved','import-abort-keeps-prior','import-capacity-keeps-prior','rehashed-wrong-payload-binding-rejected','source-save-idempotency','new-source-false-parsed-binding-rejected-before-commit','new-source-valid-parsed-binding-save-control','owned-source-schema-and-binding-immutable-on-save','ordinary-save-retains-opaque-unknown-archive','history-source-missing-blocks-export-and-restore','history-source-corruption-detected','history-source-corrected-control','package-noncanonical-spelling','source-files-not-canonical-or-gating','source-descriptors-excluded-from-stage-context','actual-handoff-zip-excludes-source-metadata-and-bytes'];
const migrationSourceFaults={'source-legacy-loss':'SOURCE_LEGACY_EXACT_SPAN_ORACLE','source-package-loss':'SOURCE_PACKAGE_EXACT_SPAN_ORACLE','source-payload-binding':'SOURCE_PAYLOAD_BINDING_ORACLE','source-cache-binding':'SOURCE_PAYLOAD_BINDING_ORACLE','source-write-downgrade':'SOURCE_WRITE_IMMUTABLE_ORACLE','source-new-write-binding':'SOURCE_NEW_WRITE_BINDING_ORACLE'};
function completeMigrationSourceBytes(value,report){
 return report.verifyV3Migration==='PASS'&&value?.schema==='closed-loop-source-retention-check/1'&&value.result==='PASS'&&value.synthetic===true&&value.actualBrowser===false&&value.sourceArtifactCount===3&&Number.isSafeInteger(value.legacyExactSourceBytes)&&value.legacyExactSourceBytes>0&&exactNamedCases(value.cases,migrationSourceCases)&&Array.isArray(report.faults)&&Object.entries(migrationSourceFaults).every(([fault,oracle])=>{const rows=report.faults.filter(row=>row?.fault===fault);return rows.length===1&&rows[0].oracle===oracle&&rows[0].result==='DETECTED'&&rows[0].exitCode===1&&typeof rows[0].stderr==='string'&&rows[0].stderr.includes(oracle);});
}
const oneObservation=(rows,id)=>Array.isArray(rows)&&rows.filter(row=>row?.checkId===id).length===1?rows.find(row=>row?.checkId===id):null;
const exactObservationFacts=(row,expected)=>row?.passed===true&&isDeepStrictEqual(row.expected,expected)&&isDeepStrictEqual(row.observed,expected);
const nonemptyString=value=>typeof value==='string'&&value.length>0;
function completeNativeStage22Batch(rows,report){
 const row=oneObservation(rows,'native-stage22-all-ready-batch'),facts={readyNativeCount:2,outcomes:['SATISFIED','VIOLATED'],futureResults:0,externalResults:0,duplicateRetry:false,firstOnlyFaultDetected:true};
 if(report.verificationRouting!=='PASS'||report.focusedNativeProductControls!==false||!exactObservationFacts(row,facts)||!Array.isArray(row.cases)||row.cases.length!==2||row.cases.some(value=>!value||typeof value!=='object'||Array.isArray(value)))return false;
 const fault=oneCase(row.cases.map(value=>({...value,case:value.caseId})),'first-ready-only-controlled-fault'),control=oneCase(row.cases.map(value=>({...value,case:value.caseId})),'all-ready-native-results');
 return fault?.caughtAt==='NATIVE_STAGE22_ALL_READY_RESULTS_ORACLE'&&fault.persistedResults===1&&control?.noDuplicateRetry===true&&Array.isArray(control.expected)&&control.expected.length===2&&control.expected.every(value=>value&&typeof value==='object'&&!Array.isArray(value)&&nonemptyString(value.testId))&&new Set(control.expected.map(value=>value.testId)).size===2&&exactNamedCases(control.expected.map(value=>value.determination),['SATISFIED','VIOLATED'])&&isDeepStrictEqual(control.observed,control.expected)&&nonemptyString(control.futureTestId)&&nonemptyString(control.externalTestId)&&control.futureTestId!==control.externalTestId&&control.expected.every(value=>value.testId!==control.futureTestId&&value.testId!==control.externalTestId);
}
function completeStage29Investigation(rows,report){
 const row=oneObservation(rows,'stage29.investigation.admission-and-authority');
 return report.stagesCompleted===30&&exactObservationFacts(row,{operation:'INVESTIGATE_MISSING_EVIDENCE',admitted:true,retainedRawBytes:true,canonicalInvestigation:true,agentChainWriteRejected:true,stageComplete:false,idempotent:true})&&row.basis==='ACTUAL_ACCEPTED_SYNTHETIC_FULL_CYCLE_PREFIX_THROUGH_STAGE28'&&row.prior28GatesExecuted===true&&row.actualBrowser===false&&row.actualExternalOrPhysicalObservation===false&&row.canonicalProjectStoreReload===false&&typeof row.rawSha256==='string'&&/^[a-f0-9]{64}$/.test(row.rawSha256)&&typeof row.instructionSha256==='string'&&/^[a-f0-9]{64}$/.test(row.instructionSha256)&&Number.isSafeInteger(row.responseByteSize)&&row.responseByteSize>0&&Number.isSafeInteger(row.contextFileCount)&&row.contextFileCount>=0;
}
function completeStage20Authorization(rows,report){
 const row=oneObservation(rows,'stage20.registered-authorization-consumed'),expected=row?.expected;
 if(report.productionBaselineAuthority!=='PASS'||row?.passed!==true||!expected||!isDeepStrictEqual(row.observed,expected)||!exactNamedCases(Object.keys(expected),['decisionSource','decisionPurpose','identityAssurance','authorizationDecisionId','candidateId','confirmationIterationId','acceptedExternalResponses']))return false;
 return expected.decisionSource==='HUMAN_DECISION_COMMAND'&&expected.decisionPurpose==='BASELINE_AUTHORIZATION'&&expected.identityAssurance==='SELF_ASSERTED'&&expected.acceptedExternalResponses===0&&['authorizationDecisionId','candidateId','confirmationIterationId'].every(key=>nonemptyString(expected[key]))&&exactNamedCases(report.intentionalInvalidFixturesRejected,['missing-human-authorization-decision','wrong-decision-purpose','wrong-decision-target','wrong-decision-value','wrong-decision-stage','inactive-historical-decision','wrong-artifact-set'])&&['noPartialMutationOnRejectedFreeze','exactHumanAuthorizationReferenced','zeroAcceptedStage20ExternalResponses','operatorActionBindsHumanDecision','isolatedDisposableProjects'].every(key=>report[key]===true);
}
const comparisonFaultOracles={
 'ITERATION-STAGE13-ALL-MANDATORY':'STAGE13_FUTURE_GATE_ORACLE',
 'ITERATION-MATRIX-FIXED12':'ITERATION_DUE_STAGE_MATRIX_ORACLE',
 'ITERATION-CORRECTED-ALL-MANDATORY':'ITERATION_FUTURE_GATE_ORACLE',
 'ITERATION-NO-DEFECT-ALL-MANDATORY':'ITERATION_FUTURE_NO_DEFECT_CONTINUATION_ORACLE',
 'ITERATION-CONFIRMATION-ALL-MANDATORY':'CONFIRMATION_FUTURE_GATE_ORACLE',
 'ITERATION-CONFIRMATION-ALL-REGRESSIONS':'CONFIRMATION_FUTURE_SUMMARY_ORACLE',
 'ITERATION-CONVERGENCE-EARLY-FRONTIER':'ITERATION_CONVERGENCE_FRONTIER_ORACLE',
 'STABILITY-REPEATED-GROUP-MAPPING':'STABILITY_DEFECT_AGGREGATE_ORACLE',
 'COMPARISON-ATOMIC-DEFECT-BINDING':'COMPARISON_ATOMIC_DEFECT_HANDOFF_ORACLE',
 'COMPARISON-ATOMIC-DEFECT-MEMBERSHIP':'COMPARISON_ATOMIC_HANDOFF_BINDING_ORACLE',
 'COMPARISON-ATOMIC-DEFECT-PROVENANCE':'COMPARISON_ATOMIC_HANDOFF_BINDING_ORACLE',
 'COMPARISON-CORRECTED-DEFECT-AUTHORING':'COMPARISON_ATOMIC_DEFECT_CONTRACT_ORACLE',
 'COMPARISON-PRODUCTION-BINDING':'PRODUCTION_COMPARISON_BINDING_ORACLE',
 'COMPARISON-MISSING-TUPLE':'Missing required run verification was not rejected.',
 'COMPARISON-MISSING-CONTRACT':'Missing frozen expected-variance contract was not rejected.',
 'COMPARISON-UNKNOWN-AUTHORIZATION':'UNKNOWN variance authorization did not block Stage 13.',
 'COMPARISON-NONRESOLVING-DEFECT':'A nonexistent defect marker authorized prohibited variance.',
 'COMPARISON-MUTATING-READ':'Comparison evaluation rewrote an accepted record.',
 'COMPARISON-SUPERSESSION':'COMPARISON_REPLACEMENT_CURRENT_ORACLE',
 'VERIFICATION-INDEPENDENT-BATCH':'VERIFICATION_PARTIAL_BATCH_IMPACT_ORACLE',
 'VERIFICATION-SCOPED-REFINEMENT':'VERIFICATION_SCOPED_REFINEMENT_ORACLE',
 'VERIFICATION-INDEPENDENT-PROMPT':'VERIFICATION_INDEPENDENT_PROVENANCE_ORACLE',
 'VERIFICATION-INDEPENDENT-PROPOSAL':'VERIFICATION_INDEPENDENT_PROVENANCE_ORACLE',
 'VERIFICATION-INTRA-STAGE-DEPENDENCY':'VERIFICATION_SAME_STAGE_DEPENDENCY_ORACLE',
 'COMPARISON-UNCONFIRMED-ACCEPTANCE':'COMPARISON_UNCONFIRMED_ORACLE',
 'UI-ADDITIONAL-BATCH-MISLABEL':'ADDITIONAL_BATCH_CONFIRMATION_ORACLE',
 'UI-SAME-STAGE-DEPENDENCY':'SAME_STAGE_CONFIRMATION_ORACLE',
 'SCOPED-BATCH-DUPLICATE':'SCOPED_BATCH_DUPLICATE_ORACLE'
};
function completeComparisonAggregates(rows,report){
 const row=oneObservation(rows,'stage13.application-defect-stability-aggregates');
 const facts={totalDistinctDefects:4,repeatedDefectCount:2,repeatedFailureGroupCount:1,uniqueDefectCount:2,newDefectsByRun:{'RUN-pqu5ikh6im3sq7n40qsehesk7nsq21pp':2,'RUN-u8hl0c0obuni5crfmo1f8op1ld40mc66':1,'RUN-3cukajs1ni6bbv64i46c6hq1bgpjakpa':1},derivedRepeatedFailureGroups:1,derivedUniqueFailures:2};
 return report.crossRunComparison==='PASS'&&report.requiredRunCount===10&&report.requiredTupleCount===10&&exactObservationFacts(row,facts)&&isDeepStrictEqual(report.stabilityArithmetic,{tenOfTen:1,nineOfTen:0.9,violationCountExact:true,undeterminedCountExact:true,closedAgreementUniverse:true})&&['expectedVarianceContractBound','applicationOwnedAggregateFacts','prohibitedVarianceDefectHandoffEnforced','unknownVarianceBlocked','undeterminedTruthBlocked','violatedTruthRoutedForward','noRunOrEvidenceDiscarded','isolatedDisposableProject'].every(key=>report[key]===true);
}
function completeComparisonFaults(rows,report){
 const ids=Object.keys(comparisonFaultOracles),digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 if(report.caseId!=='COMPARISON-IMPLEMENTATION-FAULTS'||report.result!=='PASS'||report.synthetic!==true||report.actualBrowser!==false||report.childBoundSeconds!==15||report.suiteBoundSeconds!==180||report.sourceRestored!==true||!Array.isArray(rows)||!exactCaseIds(rows.map(row=>({...row,caseId:row?.faultId})),ids)||!Array.isArray(report.rawRuns)||report.rawRuns.length!==29)return false;
 const commandRows=argument=>report.rawRuns.filter(row=>Array.isArray(row?.command)&&row.command.length===3&&nonemptyString(row.command[0])&&row.command[1]==='verify-cross-run-comparison.mjs'&&row.command[2]===argument);
 if(!ids.every(id=>{const row=rows.find(value=>value.faultId===id),runs=commandRows('--comparison-fault='+id),oracle=comparisonFaultOracles[id];return row.owner==='production'&&row.file===(id==='COMPARISON-CORRECTED-DEFECT-AUTHORING'?'workflow-schema.js':['COMPARISON-SUPERSESSION','VERIFICATION-INDEPENDENT-BATCH','COMPARISON-UNCONFIRMED-ACCEPTANCE','SCOPED-BATCH-DUPLICATE'].includes(id)?'response-ingestion.js':['UI-ADDITIONAL-BATCH-MISLABEL','UI-SAME-STAGE-DEPENDENCY'].includes(id)?'app-core.js':'workflow-engine.js')&&row.caughtBy===oracle&&row.result==='PASS'&&digest(row.originalSha256)&&digest(row.injectedSha256)&&row.originalSha256!==row.injectedSha256&&runs.length===1&&runs[0].exitCode===1&&runs[0].signal===null&&runs[0].error===null&&typeof runs[0].stdout==='string'&&typeof runs[0].stderr==='string'&&(runs[0].stdout+runs[0].stderr).includes(oracle);}))return false;
 const restored=commandRows('--comparison-control');return restored.length===1&&restored[0].exitCode===0&&restored[0].signal===null&&restored[0].error===null;
}
function completeStage13Recovery(rows,report){
 const row=oneObservation(rows,'stage13.old-group-projection-recovery'),facts={oldGroups:2,currentGroups:1,repeatedOccurrences:2,rawAndAcceptedHistoryPreserved:true,oldCheckpointPreserved:true,newNormalRevision:true,historyAuthorityBlockedStage:7,historyStage13ProjectionCleared:true,restoredComputedGroups:1,canonicalMetricInputsPreserved:true,negativeCases:['wrong-numeric-old-count','string-old-count','array-old-count','unrelated-derived-change','canonical-record-corruption']};
 const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'],digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 return report.stage13ProjectionRecovery==='PASS'&&exactObservationFacts(row,facts)&&row.synthetic===true&&row.actualBrowser===false&&row.priorActorHistoryReplayed===false&&row.duplicateDefectIsDeclaredFixtureInput===true&&report.sourceHashes&&exactNamedCases(Object.keys(report.sourceHashes),files)&&files.every(file=>digest(report.sourceHashes[file]))&&digest(report.legacyOwnerSha256)&&report.legacyOwnerSha256!==report.sourceHashes['workflow-engine.js'];
}
const scheduledIterationCases=[
 {caseId:'FUTURE-REPRESENTATION-13',stage:13,futureRequirementRetained:true,noExtraEarlyBlocker:true,missingDueVerificationBlocked:true,priorStageFlagsAreFixtureSetup:true},
 ...[17,19].map(stage=>({caseId:'FUTURE-REPRESENTATION-'+stage,stage,requiredTuples:10,futureRequirementRetained:true,noExtraEarlyBlocker:true,noFullIterationCompletionClaim:true,missingTargetBlocksAt25:true})),
 ...[17,19].map(stage=>({caseId:'NEWLY-DUE-PER-RUN-'+stage,stage,expectedTuples:20,missingTuplesRejected:10,conformingComparisonAccepted:true,unknownComparisonBlocked:true})),
 ...[[10,13],[17,18]].map(([iterationStage,frontier])=>({caseId:'RETAINED-PER-RUN-FRONTIER-'+frontier,iterationStage,frontier,earlierRequiredTuples:10,currentRequiredTuples:20,laterUiStageDoesNotChangeEarlierMatrix:true,missingDueWorkBlocked:true,newDefinitionAdmissionNotClaimed:true}))
];
function completeScheduledIterations(rows,report){return report.scheduledIterationControls==='PASS'&&report.unknownIterationOwnerControls===4&&report.futureRegistrationsNotCountedAsSuccessful===true&&Array.isArray(rows)&&rows.length===7&&scheduledIterationCases.every(expected=>rows.filter(row=>isDeepStrictEqual(row,expected)).length===1);}
function completeCanonicalScalar(value,report){
 const writes=['/job/EXACT_USER_OBJECTIVE_VERBATIM','/job/DESIRED_SOURCE_COUNT','/job/EXACT_USER_OBJECTIVE_VERBATIM','/job/JOB_ID','/job/JOB_OWNER','/job/ASSUMPTIONS','/stages/1/agentData/ASSUMPTIONS','/stages/1/humanData/JOB_TITLE','/stages/1/acceptedData/ASSUMPTIONS','/stages/1/derivedData/STATUS_EVIDENCE'];
 return report.verifyV3Migration==='PASS'&&value?.status==='PASS'&&value.jobFields===44&&value.stages===30&&value.stageFields===458&&isDeepStrictEqual(value.partitions,['agentData','humanData','acceptedData','derivedData'])&&Array.isArray(value.negativeCases)&&value.negativeCases.length===1876&&value.negativeCases.every(name=>typeof name==='string')&&new Set(value.negativeCases).size===1876&&createHash('sha256').update(JSON.stringify([...value.negativeCases].sort())).digest('hex')==='f7f86637d39bbcf07b75a5c6a787b9165450ec203e51dc792ab52bb4a36301bb'&&isDeepStrictEqual(value.writeCases,writes)&&value.nullableControls===2&&['validBlankAndPartial','verbatimHumanPlaceholderPreserved','largeHumanInputPreserved','producerPlaceholderStillRejected','absentFutureValuesPreserved','unknownExtensionsPreserved','writeRejectionPreservesStateAndHistory','actualExportImportReload','synthetic'].every(key=>value[key]===true)&&value.actualBrowser===false;
}
function completeSpecifiedJobFields(value,report){
 return report.contractClosure==='PASS'&&value?.passed===true&&value.checkId==='registry.specification-job-field-table'&&exactNamedCases(value.expectedFieldNames,SPECIFICATION_JOB_FIELDS.map(row=>row[0]))&&Array.isArray(value.observations)&&value.observations.length===44&&SPECIFICATION_JOB_FIELDS.every(([field,producer,valueType,nullable,editable,requiredAtStage])=>value.observations.filter(row=>row?.field===field&&row.registryKey==='JOB.'+field&&row.producer===producer&&(valueType==='STRUCTURED_JSON'?['OBJECT','OBJECT_ARRAY','STRING_ARRAY','REFERENCE_ARRAY','JSON'].includes(row.valueType):row.valueType===valueType)&&row.nullable===nullable&&row.editable===editable&&row.requiredAtStage===requiredAtStage&&row.passed===true).length===1);
}
function completeSpecifiedCarriers(value,report){
 const pairs=Object.entries(SPECIFICATION_CARRIER_FIELDS).flatMap(([object,fields])=>fields.map(field=>({object,field}))),claims=['responseType','humanInputRequests','humanAuthorityCandidates','stageData','records','evidence','unresolved','warnings','attachments'];
 return report.contractClosure==='PASS'&&value?.passed===true&&value.checkId==='registry.specification-carrier-fields'&&Array.isArray(value.observations)&&value.observations.length===82&&pairs.every(({object,field})=>value.observations.filter(row=>row?.object===object&&row.field===field&&row.registryKey==='CARRIER.'+object+'.'+field&&row.producer===(object==='responseEnvelope'&&claims.includes(field)?'AGENT':'APPLICATION')&&row.passed===true).length===1);
}
const exactRows=(rows,expected)=>Array.isArray(rows)&&rows.length===expected.length&&expected.every(value=>rows.filter(row=>isDeepStrictEqual(row,value)).length===1);
function completeRegistryMutations(value,report,kind){
 const expected=[];
 if(kind==='job'){
  const oracles={producer:'SPECIFICATION_JOB_PRODUCER_ORACLE',valueType:'SPECIFICATION_JOB_TYPE_ORACLE',nullable:'SPECIFICATION_JOB_NULLABILITY_ORACLE',requiredAtStage:'SPECIFICATION_JOB_REQUIREDNESS_ORACLE',enumValues:'SPECIFICATION_JOB_ENUM_ORACLE'};
  for(const [field]of SPECIFICATION_JOB_FIELDS){for(const [property,expectedOracle]of Object.entries(oracles))expected.push({field,property,coherentDeclarationAndRegistryMutation:true,expectedOracle,detected:true});expected.push({field,property:'editable',expectedOracle:'SPECIFICATION_JOB_EDITABILITY_ORACLE',detected:true});}
  for(const kind of ['missing','extra'])expected.push({property:kind+'-field',coherentDeclarationAndRegistryMutation:true,detected:true});
 }else{
  for(const [object,fields]of Object.entries(SPECIFICATION_CARRIER_FIELDS)){for(const field of fields)for(const fault of ['coherent-declaration-and-registry-omission','coherent-declaration-and-registry-producer'])expected.push({object,field,fault,detected:true});expected.push({object,fault:'missing-object',detected:true});for(const property of REQUIRED_REGISTRY_ATTRIBUTES)expected.push({object,field:fields[0],fault:'missing-registry-attribute',property,detected:true});}
  for(const fault of ['missing-BLOCKED','unregistered-route'])expected.push({object:'executionPlanItem',field:'executionRoute',fault,detected:true});
 }
 return report.contractClosure==='PASS'&&value?.checkId===(kind==='job'?'registry.specification-job-field-mutants':'registry.specification-carrier-mutants')&&value.passed===true&&value.restored===true&&value.negativeCases===(kind==='job'?266:280)&&expected.length===value.negativeCases&&exactRows(value.cases,expected);
}
const handoffUiCases=[{"id":"denied:exportStageFiles","result":"PASS"},{"id":"denied:exportPromptContext","result":"PASS"},{"id":"denied:exportPromptManifest","result":"PASS"},{"id":"denied:exportPromptFile","result":"PASS"},{"id":"denied:copyAuthorizedPrompt","result":"PASS"},{"id":"allowed:exportStageFiles","result":"PASS"},{"id":"allowed:exportPromptContext","result":"PASS"},{"id":"allowed:exportPromptManifest","result":"PASS"},{"id":"allowed:exportPromptFile","result":"PASS"},{"id":"allowed:copyAuthorizedPrompt","result":"PASS"},{"id":"navigation-prevents-export","result":"PASS"},{"id":"failed-save-retains-draft-and-focus-no-export","result":"PASS"},{"id":"material-change-requires-new-review","result":"PASS"},{"id":"explicit-revocation-no-export","result":"PASS"},{"id":"saved-unchanged-authorization-can-continue","result":"PASS"},{"id":"inspection-binds-store-scan","result":"PASS"},{"id":"controlled-prefailure-guard-bypass","result":"DETECTED"},{"id":"risk-before-updated-disclosure-review","result":"PASS"},{"id":"input-correction-uses-authoritative-command","result":"PASS"},{"id":"input-correction-failed-save-preserves-draft","result":"PASS"},{"id":"denied:capability-request","result":"PASS"},{"id":"allowed:capability-request","result":"PASS"},{"id":"capability-consent-uses-readiness-owner-without-execution-reservation","result":"PASS"},{"id":"changed-capability-target-prevents-export","result":"PASS"},{"id":"bookkeeping-regeneration-preserves-original-request-guidance","result":"PASS"}];
const handoffPolicyCases=[{"checkId":"handoff.operation-effect-boundaries","observations":[{"id":"1:COMPLETE","mode":"BOUNDED_PROPOSAL"},{"id":"1:SEMANTIC_CHALLENGE","mode":"BOUNDED_PROPOSAL"},{"id":"1:RECONCILE_INTAKE","mode":"BOUNDED_PROPOSAL"},{"id":"2:COMPLETE","mode":"BOUNDED_PROPOSAL"},{"id":"2:SEARCH_ADEQUACY_REVIEW","mode":"BOUNDED_PROPOSAL"},{"id":"2:RECONCILE_SOURCE_SEARCH","mode":"BOUNDED_PROPOSAL"},{"id":"3:COMPLETE","mode":"BOUNDED_PROPOSAL"},{"id":"3:SEMANTIC_CHALLENGE","mode":"BOUNDED_PROPOSAL"},{"id":"3:RECONCILE_RESEARCH","mode":"BOUNDED_PROPOSAL"},{"id":"4:COMPLETE","mode":"BOUNDED_PROPOSAL"},{"id":"4:DISPOSITION_CHALLENGE","mode":"BOUNDED_PROPOSAL"},{"id":"4:ATOMICITY_CHALLENGE","mode":"BOUNDED_PROPOSAL"},{"id":"4:RECONCILE_REQUIREMENTS","mode":"BOUNDED_PROPOSAL"},{"id":"5:COMPLETE","mode":"BOUNDED_PROPOSAL"},{"id":"5:SEMANTIC_REVIEW","mode":"BOUNDED_PROPOSAL"},{"id":"5:RECONCILE_REQUIREMENT_SET","mode":"BOUNDED_PROPOSAL"},{"id":"6:COMPLETE","mode":"BOUNDED_PROPOSAL"},{"id":"6:PROOF_REVIEW","mode":"BOUNDED_PROPOSAL"},{"id":"6:RECONCILE_VERIFICATION_SUITE","mode":"BOUNDED_PROPOSAL"},{"id":"7:COMPLETE","mode":"BOUNDED_PROPOSAL"},{"id":"7:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"8:COMPLETE","mode":"BOUNDED_PROPOSAL"},{"id":"9:COMPLETE","mode":"BOUNDED_PROPOSAL"},{"id":"11:EXECUTE_RUN","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"12:VERIFY","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"13:COMPARE","mode":"BOUNDED_PROPOSAL"},{"id":"14:ROOT_CAUSE","mode":"BOUNDED_PROPOSAL"},{"id":"15:COMPLETE","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"15:EXECUTE_REGRESSION","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"16:CORRECT","mode":"BOUNDED_PROPOSAL"},{"id":"17:EXECUTE_RUN","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"17:VERIFY","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"17:COMPARE","mode":"BOUNDED_PROPOSAL"},{"id":"17:ROOT_CAUSE","mode":"BOUNDED_PROPOSAL"},{"id":"17:REGRESSION","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"17:CORRECT","mode":"BOUNDED_PROPOSAL"},{"id":"19:EXECUTE_RUN","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"19:VERIFY","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"19:COMPARE","mode":"BOUNDED_PROPOSAL"},{"id":"19:REGRESSION_VERIFY","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"21:COMPLETE","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"22:EXECUTE_EXTERNAL_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"23:COMPLETE","mode":"BOUNDED_PROPOSAL"},{"id":"24:COMPLETE","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"25:COMPLETE","mode":"BOUNDED_PROPOSAL"},{"id":"26:COMPLETE","mode":"BOUNDED_PROPOSAL"},{"id":"26:SEMANTIC_REVIEW","mode":"BOUNDED_PROPOSAL"},{"id":"26:RECONCILE","mode":"BOUNDED_PROPOSAL"},{"id":"27:ADVISORY_REVIEW","mode":"BOUNDED_PROPOSAL"},{"id":"29:INVESTIGATE_MISSING_EVIDENCE","mode":"BOUNDED_PROPOSAL"},{"id":"8:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"9:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"10:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"11:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"12:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"13:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"14:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"15:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"16:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"17:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"18:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"19:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"20:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"21:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"22:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"23:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"24:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"25:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"26:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"27:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"28:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"29:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"30:EXECUTE_FAILURE_TEST","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"16:EXECUTE_REGRESSION","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"17:EXECUTE_REGRESSION","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"18:EXECUTE_REGRESSION","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"19:EXECUTE_REGRESSION","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"20:EXECUTE_REGRESSION","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"21:EXECUTE_REGRESSION","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"22:EXECUTE_REGRESSION","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"23:EXECUTE_REGRESSION","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"24:EXECUTE_REGRESSION","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"25:EXECUTE_REGRESSION","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"26:EXECUTE_REGRESSION","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"27:EXECUTE_REGRESSION","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"28:EXECUTE_REGRESSION","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"29:EXECUTE_REGRESSION","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"},{"id":"30:EXECUTE_REGRESSION","mode":"EXACT_EXTERNAL_ACTION_REQUIRED"}]},{"checkId":"handoff.material-and-human-authority","cases":["material","template","contract","stage-operation","scope","slots","changed-prompt","actual-authorized-zip","missing-command-receipt","agent-claim","wrong-purpose","wrong-target","saved-revocation"]},{"checkId":"handoff.supplied-input-withdrawal","cases":["unconfirmed","foreign-input","self-replacement","foreign-replacement","missing-reason","explicit-replacement-save-export-reload"]},{"checkId":"handoff.producer-epoch-compatibility","cases":["reserved-old88-current90-guarded-zip","exported-old88-current90-guarded-zip","captured88-pending-stale-by-epoch","accepted88-history-preserved"],"oldEpochMutationDetected":true},{"checkId":"handoff.reference-family-selection","cases":["ordinary-fields","ordinary-relationships","ordinary-direct","7:EXECUTE_FAILURE_TEST","15:EXECUTE_REGRESSION","17:REGRESSION","19:REGRESSION_VERIFY"],"faults":[{"id":"ordinary-key","oracle":"HANDOFF_ORDINARY_RESULT_REFERENCE_ORACLE","detected":true},{"id":"definition-key","oracle":"HANDOFF_DEFINITION_EXECUTION_REFERENCE_ORACLE","detected":true}]},{"checkId":"handoff.reserved-target-scope-currentness","cases":["ordinary-save-current-revision-same-output-target","fresh-transport-same-reserved-target","changed-current-input","accepted-target","missing-allocation","invalidated-prompt","changed-history-activation","explicit-allocated-target-preserved","unregistered-runId-rejected","unregistered-productId-rejected","unregistered-contextId-rejected"],"revisionOnlyMutationDetected":true},{"checkId":"handoff.deterministic-structured-context","cases":["nested-key-insertion-order-equivalent","raw-string-bytes-preserved","array-order-preserved","json-omission-null-semantics-preserved","actual-backup-import-save-rebuild-identical","saved89-current90-ui-refresh-preserves-old-bytes"],"originalSerializerMutationDetected":true}];
function completeHandoffPolicy(rows,report,id){const expected=handoffPolicyCases.find(row=>row.checkId===id),row=oneObservation(rows,id);return report.handoffDisclosure==='PASS'&&report.synthetic===true&&report.actualBrowser===false&&report.externalTransferPerformed===false&&row?.passed===true&&(expected.cases?exactNamedCases(row.cases,expected.cases):exactRows(row.observations,expected.observations))&&['oldEpochMutationDetected','revisionOnlyMutationDetected','originalSerializerMutationDetected'].every(key=>!Object.hasOwn(expected,key)||row[key]===true)&&(!expected.faults||exactRows(row.faults,expected.faults));}
const disclosureCases=['classification-public','classification-unknown','classification-restricted','classification-credential_secret','known-secret-inline-source-carrier-inheritance','actual-byte-markers-ascii','actual-byte-markers-utf16le','actual-byte-markers-utf16be','attached-context-byte-scan-and-guard','instruction-byte-scan-stable-inspection-after-save','final-manifest-new-marker-block-and-inspected-control','registered-independent-reviewer-authorization-save','capability-readiness-inquiry-guard-and-valid-control','concurrent-save-before-review-return','concurrent-save-after-archive','retained-blind-comparison-actual-zip-privacy'];
function completeHandoffDisclosure(rows,report){
 const blind=report.blindExport,files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
 return report.handoffDisclosure==='PASS'&&report.synthetic===true&&report.actualBrowser===false&&report.externalTransferPerformed===false&&report.restoredImplementation==='PASS_CURRENT_PARENT_SOURCE'&&exactNamedCases(rows,disclosureCases)&&exactRows(report.observations,['ascii','utf16le','utf16be'].map(encoding=>({encoding,findings:6,crossChunkFirstOffset:65530,exactBytes:true})))&&exactRows(report.faults,[{id:'authorization',oracle:'DISCLOSURE_UNAUTHORIZED_BYTES_ORACLE',status:1,result:'DETECTED'},{id:'scan',oracle:'DISCLOSURE_ACTUAL_BYTE_SCAN_ORACLE',status:1,result:'DETECTED'}])&&isDeepStrictEqual(report.scanCoverage,{literalEncodings:['ASCII/UTF-8','UTF-16LE','UTF-16BE'],binary:'Literal marker bytes only; no compressed/container format decoding.',chunkBytes:65536,cleanScanEstablishesClassification:false})&&blind?.result==='PASS'&&blind.synthetic===true&&blind.actualBrowser===false&&blind.earlierCompleteFlagsForced===false&&blind.stage===13&&blind.operation==='COMPARE'&&Number.isSafeInteger(blind.aliasCount)&&blind.aliasCount>0&&blind.exactCurrentAuthorizationAllowed===true&&blind.privateCanonicalAliasesExcluded===true&&nonemptyString(blind.archivedFixtureClockUtc)&&Array.isArray(blind.actualZipMembers)&&blind.actualZipMembers.length>=3&&blind.actualZipMembers.every(nonemptyString)&&new Set(blind.actualZipMembers).size===blind.actualZipMembers.length&&report.sourceHashes&&exactNamedCases(Object.keys(report.sourceHashes),files)&&files.every(file=>typeof report.sourceHashes[file]==='string'&&/^[a-f0-9]{64}$/.test(report.sourceHashes[file]));
}
const typedAdmissionChecks=[
 {
  "marker": "responseTypeBoundaries",
  "expected": {
   "negativeCases": 102,
   "optionalControls": 4,
   "actualSavedPackage": true,
   "conformingAdmission": true,
   "acceptedAccountingControl": true,
   "rawPreserved": true
  },
  "caseIds": [
   "COMPLETE:root.schema:null",
   "COMPLETE:root.schema:object",
   "COMPLETE:root.schema:array",
   "COMPLETE:root.schema:number",
   "COMPLETE:root.schema:missing",
   "COMPLETE:root.inputVersion:null",
   "COMPLETE:root.inputVersion:object",
   "COMPLETE:root.inputVersion:array",
   "COMPLETE:root.inputVersion:number",
   "COMPLETE:root.inputVersion:missing",
   "COMPLETE:root.manifestSha256:null",
   "COMPLETE:root.manifestSha256:object",
   "COMPLETE:root.manifestSha256:array",
   "COMPLETE:root.manifestSha256:number",
   "COMPLETE:root.manifestSha256:missing",
   "COMPLETE:root.pass1Completed:null",
   "COMPLETE:root.pass1Completed:object",
   "COMPLETE:root.pass1Completed:array",
   "COMPLETE:root.pass1Completed:number",
   "COMPLETE:root.pass1Completed:missing",
   "COMPLETE:root.pass2OmissionChallenge:null",
   "COMPLETE:root.pass2OmissionChallenge:array",
   "COMPLETE:root.pass2OmissionChallenge:number",
   "COMPLETE:root.pass2OmissionChallenge:missing",
   "COMPLETE:root.units:null",
   "COMPLETE:root.units:object",
   "COMPLETE:root.units:array",
   "COMPLETE:root.units:number",
   "COMPLETE:root.units:missing",
   "COMPLETE:challenge.completed:null",
   "COMPLETE:challenge.completed:object",
   "COMPLETE:challenge.completed:array",
   "COMPLETE:challenge.completed:number",
   "COMPLETE:challenge.completed:missing",
   "COMPLETE:challenge.checkedCategories:null",
   "COMPLETE:challenge.checkedCategories:object",
   "COMPLETE:challenge.checkedCategories:number",
   "COMPLETE:challenge.checkedCategories:missing",
   "COMPLETE:challenge.omissionsFound:null",
   "COMPLETE:challenge.omissionsFound:object",
   "COMPLETE:challenge.omissionsFound:number",
   "COMPLETE:challenge.omissionsFound:missing",
   "COMPLETE:challenge.omissionsResolved:null",
   "COMPLETE:challenge.omissionsResolved:object",
   "COMPLETE:challenge.omissionsResolved:array",
   "COMPLETE:challenge.omissionsResolved:number",
   "COMPLETE:challenge.omissionsResolved:missing",
   "COMPLETE:unit.sourceUnitId:null",
   "COMPLETE:unit.sourceUnitId:object",
   "COMPLETE:unit.sourceUnitId:array",
   "COMPLETE:unit.sourceUnitId:number",
   "COMPLETE:unit.sourceUnitId:missing",
   "COMPLETE:unit.sourceRawValueSha256:null",
   "COMPLETE:unit.sourceRawValueSha256:object",
   "COMPLETE:unit.sourceRawValueSha256:array",
   "COMPLETE:unit.sourceRawValueSha256:number",
   "COMPLETE:unit.sourceRawValueSha256:missing",
   "COMPLETE:unit.disposition:null",
   "COMPLETE:unit.disposition:object",
   "COMPLETE:unit.disposition:array",
   "COMPLETE:unit.disposition:number",
   "COMPLETE:unit.disposition:missing",
   "COMPLETE:unit.reason:null",
   "COMPLETE:unit.reason:object",
   "COMPLETE:unit.reason:array",
   "COMPLETE:unit.reason:number",
   "COMPLETE:unit.externalInspectionClaimed:null",
   "COMPLETE:unit.externalInspectionClaimed:object",
   "COMPLETE:unit.externalInspectionClaimed:array",
   "COMPLETE:unit.externalInspectionClaimed:number",
   "COMPLETE:unit.inspectionStatus:null",
   "COMPLETE:unit.inspectionStatus:object",
   "COMPLETE:unit.inspectionStatus:array",
   "COMPLETE:unit.inspectionStatus:number",
   "COMPLETE:unit.extractedStatements:null",
   "COMPLETE:unit.extractedStatements:object",
   "COMPLETE:unit.extractedStatements:array",
   "COMPLETE:unit.extractedStatements:number",
   "COMPLETE:unit.extractedStatements:missing",
   "COMPLETE:statement.statementKey:null",
   "COMPLETE:statement.statementKey:object",
   "COMPLETE:statement.statementKey:array",
   "COMPLETE:statement.statementKey:number",
   "COMPLETE:statement.statementKey:missing",
   "COMPLETE:statement.text:null",
   "COMPLETE:statement.text:object",
   "COMPLETE:statement.text:array",
   "COMPLETE:statement.text:number",
   "COMPLETE:statement.text:missing",
   "COMPLETE:statement.statementClass:null",
   "COMPLETE:statement.statementClass:object",
   "COMPLETE:statement.statementClass:array",
   "COMPLETE:statement.statementClass:number",
   "COMPLETE:statement.statementClass:missing",
   "COMPLETE:statement.sourceLocation:null",
   "COMPLETE:statement.sourceLocation:object",
   "COMPLETE:statement.sourceLocation:array",
   "COMPLETE:statement.sourceLocation:number",
   "COMPLETE:challenge.checkedCategories:nested-item",
   "COMPLETE:challenge.omissionsFound:nested-item",
   "COMPLETE:root.units:nested-item",
   "COMPLETE:unit.extractedStatements:nested-item"
  ],
  "id": "admission-contract.stage01.capture-types.COMPLETE"
 },
 {
  "marker": "responseTypeBoundaries",
  "expected": {
   "negativeCases": 102,
   "optionalControls": 4,
   "actualSavedPackage": true,
   "conformingAdmission": true,
   "acceptedAccountingControl": true,
   "rawPreserved": true
  },
  "caseIds": [
   "RECONCILE_INTAKE:root.schema:null",
   "RECONCILE_INTAKE:root.schema:object",
   "RECONCILE_INTAKE:root.schema:array",
   "RECONCILE_INTAKE:root.schema:number",
   "RECONCILE_INTAKE:root.schema:missing",
   "RECONCILE_INTAKE:root.inputVersion:null",
   "RECONCILE_INTAKE:root.inputVersion:object",
   "RECONCILE_INTAKE:root.inputVersion:array",
   "RECONCILE_INTAKE:root.inputVersion:number",
   "RECONCILE_INTAKE:root.inputVersion:missing",
   "RECONCILE_INTAKE:root.manifestSha256:null",
   "RECONCILE_INTAKE:root.manifestSha256:object",
   "RECONCILE_INTAKE:root.manifestSha256:array",
   "RECONCILE_INTAKE:root.manifestSha256:number",
   "RECONCILE_INTAKE:root.manifestSha256:missing",
   "RECONCILE_INTAKE:root.pass1Completed:null",
   "RECONCILE_INTAKE:root.pass1Completed:object",
   "RECONCILE_INTAKE:root.pass1Completed:array",
   "RECONCILE_INTAKE:root.pass1Completed:number",
   "RECONCILE_INTAKE:root.pass1Completed:missing",
   "RECONCILE_INTAKE:root.pass2OmissionChallenge:null",
   "RECONCILE_INTAKE:root.pass2OmissionChallenge:array",
   "RECONCILE_INTAKE:root.pass2OmissionChallenge:number",
   "RECONCILE_INTAKE:root.pass2OmissionChallenge:missing",
   "RECONCILE_INTAKE:root.units:null",
   "RECONCILE_INTAKE:root.units:object",
   "RECONCILE_INTAKE:root.units:array",
   "RECONCILE_INTAKE:root.units:number",
   "RECONCILE_INTAKE:root.units:missing",
   "RECONCILE_INTAKE:challenge.completed:null",
   "RECONCILE_INTAKE:challenge.completed:object",
   "RECONCILE_INTAKE:challenge.completed:array",
   "RECONCILE_INTAKE:challenge.completed:number",
   "RECONCILE_INTAKE:challenge.completed:missing",
   "RECONCILE_INTAKE:challenge.checkedCategories:null",
   "RECONCILE_INTAKE:challenge.checkedCategories:object",
   "RECONCILE_INTAKE:challenge.checkedCategories:number",
   "RECONCILE_INTAKE:challenge.checkedCategories:missing",
   "RECONCILE_INTAKE:challenge.omissionsFound:null",
   "RECONCILE_INTAKE:challenge.omissionsFound:object",
   "RECONCILE_INTAKE:challenge.omissionsFound:number",
   "RECONCILE_INTAKE:challenge.omissionsFound:missing",
   "RECONCILE_INTAKE:challenge.omissionsResolved:null",
   "RECONCILE_INTAKE:challenge.omissionsResolved:object",
   "RECONCILE_INTAKE:challenge.omissionsResolved:array",
   "RECONCILE_INTAKE:challenge.omissionsResolved:number",
   "RECONCILE_INTAKE:challenge.omissionsResolved:missing",
   "RECONCILE_INTAKE:unit.sourceUnitId:null",
   "RECONCILE_INTAKE:unit.sourceUnitId:object",
   "RECONCILE_INTAKE:unit.sourceUnitId:array",
   "RECONCILE_INTAKE:unit.sourceUnitId:number",
   "RECONCILE_INTAKE:unit.sourceUnitId:missing",
   "RECONCILE_INTAKE:unit.sourceRawValueSha256:null",
   "RECONCILE_INTAKE:unit.sourceRawValueSha256:object",
   "RECONCILE_INTAKE:unit.sourceRawValueSha256:array",
   "RECONCILE_INTAKE:unit.sourceRawValueSha256:number",
   "RECONCILE_INTAKE:unit.sourceRawValueSha256:missing",
   "RECONCILE_INTAKE:unit.disposition:null",
   "RECONCILE_INTAKE:unit.disposition:object",
   "RECONCILE_INTAKE:unit.disposition:array",
   "RECONCILE_INTAKE:unit.disposition:number",
   "RECONCILE_INTAKE:unit.disposition:missing",
   "RECONCILE_INTAKE:unit.reason:null",
   "RECONCILE_INTAKE:unit.reason:object",
   "RECONCILE_INTAKE:unit.reason:array",
   "RECONCILE_INTAKE:unit.reason:number",
   "RECONCILE_INTAKE:unit.externalInspectionClaimed:null",
   "RECONCILE_INTAKE:unit.externalInspectionClaimed:object",
   "RECONCILE_INTAKE:unit.externalInspectionClaimed:array",
   "RECONCILE_INTAKE:unit.externalInspectionClaimed:number",
   "RECONCILE_INTAKE:unit.inspectionStatus:null",
   "RECONCILE_INTAKE:unit.inspectionStatus:object",
   "RECONCILE_INTAKE:unit.inspectionStatus:array",
   "RECONCILE_INTAKE:unit.inspectionStatus:number",
   "RECONCILE_INTAKE:unit.extractedStatements:null",
   "RECONCILE_INTAKE:unit.extractedStatements:object",
   "RECONCILE_INTAKE:unit.extractedStatements:array",
   "RECONCILE_INTAKE:unit.extractedStatements:number",
   "RECONCILE_INTAKE:unit.extractedStatements:missing",
   "RECONCILE_INTAKE:statement.statementKey:null",
   "RECONCILE_INTAKE:statement.statementKey:object",
   "RECONCILE_INTAKE:statement.statementKey:array",
   "RECONCILE_INTAKE:statement.statementKey:number",
   "RECONCILE_INTAKE:statement.statementKey:missing",
   "RECONCILE_INTAKE:statement.text:null",
   "RECONCILE_INTAKE:statement.text:object",
   "RECONCILE_INTAKE:statement.text:array",
   "RECONCILE_INTAKE:statement.text:number",
   "RECONCILE_INTAKE:statement.text:missing",
   "RECONCILE_INTAKE:statement.statementClass:null",
   "RECONCILE_INTAKE:statement.statementClass:object",
   "RECONCILE_INTAKE:statement.statementClass:array",
   "RECONCILE_INTAKE:statement.statementClass:number",
   "RECONCILE_INTAKE:statement.statementClass:missing",
   "RECONCILE_INTAKE:statement.sourceLocation:null",
   "RECONCILE_INTAKE:statement.sourceLocation:object",
   "RECONCILE_INTAKE:statement.sourceLocation:array",
   "RECONCILE_INTAKE:statement.sourceLocation:number",
   "RECONCILE_INTAKE:challenge.checkedCategories:nested-item",
   "RECONCILE_INTAKE:challenge.omissionsFound:nested-item",
   "RECONCILE_INTAKE:root.units:nested-item",
   "RECONCILE_INTAKE:unit.extractedStatements:nested-item"
  ],
  "id": "admission-contract.stage01.capture-types.RECONCILE_INTAKE"
 },
 {
  "marker": "responseTypeBoundaries",
  "expected": {
   "negativeCases": 30,
   "scopeNegatives": 1,
   "conformingAdmission": true,
   "rawPreserved": true,
   "structuredInvalid": true
  },
  "caseIds": [
   "jobId:object",
   "jobId:array",
   "jobId:null",
   "stage:object",
   "stage:array",
   "stage:null",
   "operation:object",
   "operation:array",
   "operation:null",
   "promptIdentity.instructionId:object",
   "promptIdentity.instructionId:array",
   "promptIdentity.instructionId:null",
   "promptIdentity.bodySha256:object",
   "promptIdentity.bodySha256:array",
   "promptIdentity.bodySha256:null",
   "promptIdentity.contractSha256:object",
   "promptIdentity.contractSha256:array",
   "promptIdentity.contractSha256:null",
   "promptIdentity.contextSignature:object",
   "promptIdentity.contextSignature:array",
   "promptIdentity.contextSignature:null",
   "packageId:object",
   "packageId:array",
   "packageId:null",
   "operationReservationId:object",
   "operationReservationId:array",
   "operationReservationId:null",
   "challengeNonce:object",
   "challengeNonce:array",
   "challengeNonce:null"
  ],
  "id": "admission-contract.response.typed-identity-boundary"
 },
 {
  "marker": "stage01CaptureCacheCompatibility",
  "expected": {
   "cachedExports": 4,
   "capturedCases": 2,
   "epochChanges": 0
  },
  "detailCases": [
   {
    "operation": "COMPLETE",
    "status": "RESERVED",
    "actualUiSaveOwner": true,
    "actualSavedZip": true,
    "retainedBytesUnchanged": true,
    "sameGeneration": true,
    "descriptorCalls": 1
   },
   {
    "operation": "COMPLETE",
    "status": "EXPORTED",
    "actualUiSaveOwner": true,
    "actualSavedZip": true,
    "retainedBytesUnchanged": true,
    "sameGeneration": true,
    "descriptorCalls": 1
   },
   {
    "operation": "RECONCILE_INTAKE",
    "status": "RESERVED",
    "actualUiSaveOwner": true,
    "actualSavedZip": true,
    "retainedBytesUnchanged": true,
    "sameGeneration": true,
    "descriptorCalls": 1
   },
   {
    "operation": "RECONCILE_INTAKE",
    "status": "EXPORTED",
    "actualUiSaveOwner": true,
    "actualSavedZip": true,
    "retainedBytesUnchanged": true,
    "sameGeneration": true,
    "descriptorCalls": 1
   },
   {
    "capturedResponse": true,
    "malformed": false,
    "expected": "CONFORMING_ACCEPTANCE",
    "sameGeneration": true,
    "rawRetained": true,
    "syntheticPreFixGuardEquivalent": true
   },
   {
    "capturedResponse": true,
    "malformed": true,
    "expected": "PRECOMMIT_TYPE_REJECTION",
    "sameGeneration": true,
    "rawRetained": true,
    "syntheticPreFixGuardEquivalent": true
   }
  ],
  "requiredReport": {
   "cacheFaultDetected": true
  },
  "id": "admission-contract.stage01.capture-cache-compatibility"
 },
 {
  "marker": "responseIdentityUiBoundary",
  "expected": {
   "stagedExactBytes": true,
   "rawExactBytes": true,
   "wrongTypeDiagnostic": true,
   "acceptedChanges": 0,
   "correctionPrompt": true
  },
  "requiredReport": {
   "uiFaultDetected": true
  },
  "id": "admission-contract.response.typed-identity-ui-boundary"
 },
 {
  "marker": "stage01LegacyCaptureTypes",
  "expected": {
   "legacyCaptureSchema": "closed-loop-stage01-capture/1",
   "shapeErrors": 0,
   "newPassErrors": 0,
   "projectUnchanged": true
  },
  "id": "admission-contract.stage01.capture-legacy-types"
 },
 {
  "marker": "stage01LegacyNewResponses",
  "expected": {
   "operations": 2,
   "newV2Valid": 2,
   "newV1Valid": 0
  },
  "detailCases": [
   {
    "operation": "COMPLETE",
    "newV2AcceptedForReview": true,
    "newV1AcceptedForReview": false,
    "historyPreserved": true
   },
   {
    "operation": "RECONCILE_INTAKE",
    "newV2AcceptedForReview": true,
    "newV1AcceptedForReview": false,
    "historyPreserved": true
   }
  ],
  "id": "admission-contract.stage01.capture-new-legacy-rejection"
 },
 {
  "marker": "obligationDispositionTypes",
  "expected": {
   "negativeCases": 15,
   "conformingAdmission": true,
   "actualSavedZip": true
  },
  "caseIds": [
   "obligationId:array",
   "obligationId:object",
   "obligationId:null",
   "obligationId:number",
   "obligationId:missing",
   "disposition:array",
   "disposition:object",
   "disposition:null",
   "disposition:number",
   "disposition:missing",
   "reason:array",
   "reason:object",
   "reason:null",
   "reason:number",
   "reason:missing"
  ],
  "id": "admission-contract.stage04.disposition-types.COMPLETE"
 },
 {
  "marker": "obligationDispositionTypes",
  "expected": {
   "negativeCases": 15,
   "conformingAdmission": true,
   "actualSavedZip": true
  },
  "caseIds": [
   "obligationId:array",
   "obligationId:object",
   "obligationId:null",
   "obligationId:number",
   "obligationId:missing",
   "disposition:array",
   "disposition:object",
   "disposition:null",
   "disposition:number",
   "disposition:missing",
   "reason:array",
   "reason:object",
   "reason:null",
   "reason:number",
   "reason:missing"
  ],
  "id": "admission-contract.stage04.disposition-types.RECONCILE_REQUIREMENTS"
 },
 {
  "marker": "representationObservationTypes",
  "expected": {
   "negativeCases": 54,
   "conformingEmptyInventories": true,
   "partialInventoryRecord": true,
   "actualSavedZip": true,
   "rawPreserved": true
  },
  "caseIds": [
   "requiredPageOrViewIds:missing",
   "requiredPageOrViewIds:null",
   "requiredPageOrViewIds:object",
   "requiredPageOrViewIds:nested-array",
   "requiredPageOrViewIds:object-item",
   "requiredPageOrViewIds:number-item",
   "requiredPageOrViewIds:null-item",
   "requiredPageOrViewIds:blank-item",
   "inspectedPageOrViewIds:missing",
   "inspectedPageOrViewIds:null",
   "inspectedPageOrViewIds:object",
   "inspectedPageOrViewIds:nested-array",
   "inspectedPageOrViewIds:object-item",
   "inspectedPageOrViewIds:number-item",
   "inspectedPageOrViewIds:null-item",
   "inspectedPageOrViewIds:blank-item",
   "requiredPackagedFileIds:missing",
   "requiredPackagedFileIds:null",
   "requiredPackagedFileIds:object",
   "requiredPackagedFileIds:nested-array",
   "requiredPackagedFileIds:object-item",
   "requiredPackagedFileIds:number-item",
   "requiredPackagedFileIds:null-item",
   "requiredPackagedFileIds:blank-item",
   "openedOrTestedPackagedFileIds:missing",
   "openedOrTestedPackagedFileIds:null",
   "openedOrTestedPackagedFileIds:object",
   "openedOrTestedPackagedFileIds:nested-array",
   "openedOrTestedPackagedFileIds:object-item",
   "openedOrTestedPackagedFileIds:number-item",
   "openedOrTestedPackagedFileIds:null-item",
   "openedOrTestedPackagedFileIds:blank-item",
   "requiredTransformationIds:missing",
   "requiredTransformationIds:null",
   "requiredTransformationIds:object",
   "requiredTransformationIds:nested-array",
   "requiredTransformationIds:object-item",
   "requiredTransformationIds:number-item",
   "requiredTransformationIds:null-item",
   "requiredTransformationIds:blank-item",
   "inspectedTransformationIds:missing",
   "inspectedTransformationIds:null",
   "inspectedTransformationIds:object",
   "inspectedTransformationIds:nested-array",
   "inspectedTransformationIds:object-item",
   "inspectedTransformationIds:number-item",
   "inspectedTransformationIds:null-item",
   "inspectedTransformationIds:blank-item",
   "observation:missing",
   "observation:null",
   "observation:array",
   "observation:object",
   "observation:hostile-object",
   "paired-nested-view-identities"
  ],
  "id": "admission-contract.stage25.observation-types"
 },
 {
  "marker": null,
  "expected": {
   "cases": 64,
   "satisfiedControls": 2,
   "undeterminedNegatives": 62,
   "inventoryGuardFaultDetected": true
  },
  "caseIds": [
   "explicit-full-coverage",
   "explicit-empty-classes",
   "all-inventories-omitted",
   "missing-requiredPageOrViewIds",
   "string-requiredPageOrViewIds",
   "null-requiredPageOrViewIds",
   "object-requiredPageOrViewIds",
   "missing-inspectedPageOrViewIds",
   "string-inspectedPageOrViewIds",
   "null-inspectedPageOrViewIds",
   "object-inspectedPageOrViewIds",
   "missing-requiredPackagedFileIds",
   "string-requiredPackagedFileIds",
   "null-requiredPackagedFileIds",
   "object-requiredPackagedFileIds",
   "missing-openedOrTestedPackagedFileIds",
   "string-openedOrTestedPackagedFileIds",
   "null-openedOrTestedPackagedFileIds",
   "object-openedOrTestedPackagedFileIds",
   "missing-requiredTransformationIds",
   "string-requiredTransformationIds",
   "null-requiredTransformationIds",
   "object-requiredTransformationIds",
   "missing-inspectedTransformationIds",
   "string-inspectedTransformationIds",
   "null-inspectedTransformationIds",
   "object-inspectedTransformationIds",
   "required-view-uninspected",
   "observation-missing",
   "nested-array-item-requiredPageOrViewIds",
   "object-item-requiredPageOrViewIds",
   "number-item-requiredPageOrViewIds",
   "null-item-requiredPageOrViewIds",
   "blank-item-requiredPageOrViewIds",
   "nested-array-item-inspectedPageOrViewIds",
   "object-item-inspectedPageOrViewIds",
   "number-item-inspectedPageOrViewIds",
   "null-item-inspectedPageOrViewIds",
   "blank-item-inspectedPageOrViewIds",
   "nested-array-item-requiredPackagedFileIds",
   "object-item-requiredPackagedFileIds",
   "number-item-requiredPackagedFileIds",
   "null-item-requiredPackagedFileIds",
   "blank-item-requiredPackagedFileIds",
   "nested-array-item-openedOrTestedPackagedFileIds",
   "object-item-openedOrTestedPackagedFileIds",
   "number-item-openedOrTestedPackagedFileIds",
   "null-item-openedOrTestedPackagedFileIds",
   "blank-item-openedOrTestedPackagedFileIds",
   "nested-array-item-requiredTransformationIds",
   "object-item-requiredTransformationIds",
   "number-item-requiredTransformationIds",
   "null-item-requiredTransformationIds",
   "blank-item-requiredTransformationIds",
   "nested-array-item-inspectedTransformationIds",
   "object-item-inspectedTransformationIds",
   "number-item-inspectedTransformationIds",
   "null-item-inspectedTransformationIds",
   "blank-item-inspectedTransformationIds",
   "object-observation",
   "throwing-observation",
   "array-observation",
   "null-observation",
   "matching-nested-identities"
  ],
  "id": "admission-contract.stage25.observation-effective-types"
 }
];
function completeTypedAdmission(definition,rows,report){
 const id=definition.id.slice('admission-contract.'.length),row=oneObservation(rows,id);
 if(definition.marker&&report[definition.marker]!=='PASS'||!exactObservationFacts(row,definition.expected))return false;
 if(definition.caseIds&&!exactNamedCases(row.caseIds,definition.caseIds))return false;
 if(definition.requiredReport&&!Object.entries(definition.requiredReport).every(([key,value])=>report[key]===value))return false;
 if(definition.detailCases&&(!Array.isArray(report.observations)||report.observations.length!==definition.detailCases.length||!definition.detailCases.every(expected=>report.observations.filter(actual=>actual&&Object.entries(expected).every(([key,value])=>actual[key]===value)).length===1)))return false;
 if(definition.marker==='responseTypeBoundaries'){
  const faults=report.faults;
  if(!Array.isArray(faults)||faults.length!==2||faults.filter(fault=>fault?.caseId==='missing-capture-shape-guard'&&fault.intendedFailure==='CAPTURE_TYPE_ADMISSION_ORACLE'&&fault.falseAdmission===true).length!==1||faults.filter(fault=>fault?.caseId==='missing-identity-type-guard'&&fault.intendedFailure==='RESPONSE_IDENTITY_STRUCTURED_REJECTION_ORACLE'&&fault.originalCoercionException===true).length!==1)return false;
 }
 return true;
}
const currentExecutedMetric=metric=>metric&&metric.value===1&&metric.disposition==='SATISFIED'&&Number.isInteger(metric.denominator)&&metric.denominator>0&&metric.numerator===metric.denominator&&Array.isArray(metric.includedIds)&&metric.includedIds.length===metric.denominator&&new Set(metric.includedIds).size===metric.denominator;
const deferredAdmissionPopulation=Object.freeze({supportedFutureAuthorControls:8,immediateControls:1,legacyCorrectionControls:2,producerRejections:28,precommitFreshnessRejections:3,independentSharedSupportPredicateControls:4,retainedUnprovenStorageControls:3,supportedActivationStorageControls:1,narrowFaultControls:3,staleTargetConfirmationRejections:1});
const deferredAuthorCases=['external-future-regression','native-future-regression','external-future-failure','zero-byte-future-failure','native-owning-failure-execution','owning-regression-execution','corrected-iteration-regression-author','lossless-capacity-and-normalizer'];
const deferredRejectionCases=['missing-compatibility','declared-unknown','declared-false','null-compatibility','array-compatibility','wrong-nested-type','missing-outcome-meaning','extra-property','future-without-execution-test','primary-unknown-authority','support-unknown-authority','raw-material-only-negative-account','generic-successful-support','missing-support-report','self-support-report','wrong-definition','wrong-test-family','stale-reviewed-test-hash','stale-input-contract-hash','changed-literal-fixture','wrong-fixture-reference-family','wrong-defect-reference-family','wrong-support-reference-family','null-optional-defect','unknown-support-key','artifact-material-only-negative-account','zero-byte-wrapper-only-negative-account','unverified-required-fixture-bytes'];
const deferredFaultCases=['fault-current-reviewed-profile-check-omitted','fault-complete-negative-account-check-omitted','fault-unproven-definition-treated-as-future'];
const oneCase=(rows,name)=>Array.isArray(rows)&&rows.filter(row=>row?.case===name).length===1?rows.find(row=>row?.case===name):null;
function completeDeferredAdmission(rows,report){
 if(report.deferredDefinitionCompatibilityAdmission!==true||!emittedCases(['DEFERRED-DEFINITION-COMPATIBILITY-ADMISSION'])(rows))return false;
 const row=rows.find(value=>value.checkId==='DEFERRED-DEFINITION-COMPATIBILITY-ADMISSION'),detail=row.detail;
 if(!['expected','observed'].every(key=>exactLiteralFields(row[key],deferredAdmissionPopulation)&&exactLiteralFields(detail?.[key],deferredAdmissionPopulation))||detail?.schema!=='closed-loop-deferred-definition-compatibility-verification/1'||detail.passed!==true||detail.synthetic!==true||detail.actualBrowser!==false||detail.realExternalActor!==false||typeof detail.boundary!=='string'||!detail.boundary.trim())return false;
 const actual=detail.observations;
 if(!Array.isArray(actual)||actual.length!==51||new Set(actual.map(value=>value?.case)).size!==51)return false;
 if(!deferredAuthorCases.every(name=>{const value=oneCase(actual,name);return value&&['compatible','futureVisible','operatorAccepted','reloadedIntegrity'].every(key=>value[key]===true)&&value.basis==='EXTERNALLY_SUPPORTED'&&value.earlyExecutions===0;}))return false;
 if(!deferredRejectionCases.every(name=>{const value=oneCase(actual,name);return value?.rejected===true&&value.canonicalDefinitionAdded===false&&value.rawPreserved===true&&typeof value.expectedIssueCode==='string'&&Array.isArray(value.issueCodes)&&value.issueCodes.includes(value.expectedIssueCode);} ))return false;
 if(!['test','scope','fixture'].every(name=>{const value=oneCase(actual,'precommit-'+name+'-changed');return value?.rejected===true&&value.pendingWorkPreserved===true;}))return false;
 if(!deferredFaultCases.every(name=>oneCase(actual,name)?.faultDetected===true))return false;
 if(!['missing','UNKNOWN','malformed'].every(name=>{const value=oneCase(actual,'retained-'+name);return value?.retainedUnproven===true&&value.writeReloadImportRestore===true&&value.owningGateBlocked===true&&value.definitionIdentityPreserved===true;}))return false;
 if(!['legacy-failureTests-bound-supported-correction','retained-unproven-regression-bound-supported-correction'].every(name=>{const value=oneCase(actual,name);return value&&['exactOldIdentitySuperseded','replacementCompatible','operatorAccepted','reloadedIntegrity'].every(key=>value[key]===true);} ))return false;
 const support=oneCase(actual,'negative-outcome-current-support-assessment'),immediate=oneCase(actual,'ordinary-immediate-owner-control'),activation=oneCase(actual,'accepted-definition-history-activation'),permissions=oneCase(actual,'closed-writer-and-receipt-permissions');
 return support?.conformingControl===true&&support.observed===true&&['acceptedNegative','sameInputContradictionRejected','unknownMandatorySupportRejected'].every(key=>support.supportControls?.[key]===true)&&immediate?.operatorAccepted===true&&immediate.reloadedIntegrity===true&&immediate.compatibilityRequired===false&&activation?.importedPriorAuthorityBlocked===true&&activation.changedActivationInvalidatesPriorAuthority===true&&permissions?.rootCauseAndCorrectExcluded===true&&permissions.laterReceiptOnlyOperations===38&&oneCase(actual,'legacy-failureTests-bound-supported-correction')?.staleTargetConfirmationRejected===true;
}
function completeStage17Receipt(rows){
 const setup=oneCase(rows,'LEGITIMATE_DEFERRED_DEFINITION_AUTHOR_PREFIXES'),value=setup?.deferredReceiptRegression;
 return setup?.childExitStatus===0&&setup.earlierCompleteFlagsForced===false&&value?.caseId==='stage17-deferred-receipt-freeze-reservation'&&value.operation==='EXECUTE_FAILURE_TEST'&&['subjectId','receiptId'].every(key=>typeof value[key]==='string'&&value[key].trim())&&Array.isArray(value.phases)&&value.phases.length===2&&['after-freeze','after-run-reservation'].every((phase,index)=>value.phases[index]?.phase===phase&&value.phases[index].receiptId===value.receiptId&&['completed','rawPreserved','definitionPreserved','byteCustodyReobserved','oldComparatorWouldRepeat'].every(key=>value.phases[index][key]===true))&&JSON.stringify(value.materialBindingNegatives)===JSON.stringify(['subject','fixture','test','input-version','instruction-version','activation'])&&['idempotentBatch','missingBytesBlocked','restoredBytesProgress','canonicalStateUnchangedByNegatives','synthetic'].every(key=>value[key]===true)&&value.actualBrowser===false;
}
function completeConditionalProducer(rows){
 const value=oneCase(rows,'CONDITIONAL_OPERATION_PRODUCER_CONTRACTS'),expected=[...Array.from({length:23},(_,index)=>`${index+8}:EXECUTE_FAILURE_TEST`),...Array.from({length:15},(_,index)=>`${index+16}:EXECUTE_REGRESSION`)];
 return value?.passed===true&&value.expectedOperations===38&&value.observedOperations===38&&value.synthetic===true&&value.actualBrowser===false&&value.realExternalActor===false&&value.ordinaryStage8SavedZip===true&&Array.isArray(value.observations)&&value.observations.length===38&&expected.every(id=>value.observations.filter(row=>row.operationId===id).length===1&&value.observations.some(row=>row.operationId===id&&['actualSavedZip','fixturePreserved','operationOnlyInstructions','receiptOnlyContract','supportingEvidenceSlotsOnly','roleIsolationRetained'].every(key=>row[key]===true)&&row.stageCompletionClaimed===false))&&Array.isArray(value.negatives)&&value.negatives.length===2&&['ordinary-stage-procedure','ordinary-stage21-output-slot'].every(name=>value.negatives.filter(row=>row.name===name&&row.intendedFailure===true).length===1)&&JSON.stringify(value.ordinaryPolicies)===JSON.stringify([{stage:11,operation:'EXECUTE_RUN',role:'RUN_OUTPUT',requiredFileCount:0},{stage:21,operation:'COMPLETE',role:'FINISHED_PRODUCT',requiredFileCount:1}])&&value.feedbackScope?.passed===true&&['ordinaryGateFactsRetained','unrelatedWorkNotRequested','ordinaryAuthorGuidanceRetained','syntheticConsumerProjection'].every(key=>value.feedbackScope[key]===true)&&value.feedbackScope.actualAcceptanceClaimed===false&&completeIndependentConditionalRetry(value.independentRetry);
}
function completeIndependentConditionalRetry(value){
 const cases=['rejected-wrong-type','accepted-undetermined'];
 return value?.case==='CONDITIONAL_INDEPENDENT_RETRY_CONTEXT'&&['passed','intendedRawLeakDetected','intendedCanonicalLeakDetected','toolPriorWorkAllowed','ordinaryVerifierWithholdPreserved','synthetic'].every(key=>value[key]===true)&&value.actualBrowser===false&&value.actualExternalActor===false&&Array.isArray(value.observations)&&value.observations.length===2&&cases.every(name=>{const row=oneCase(value.observations,name),accepted=name==='accepted-undetermined';return row&&['actualSavedZip','actualResponseFile','priorReviewContentWithheld','allExportedMembersInspected','retainedRawPreserved','requiresFreshConversation','selectedWorkStillIncomplete'].every(key=>row[key]===true)&&row.operatorAccepted===accepted&&row.protocolDiagnosticsPreserved===!accepted&&(!accepted||row.retainedArtifactPreserved===true);});
}
const exactCaseIds=(rows,ids)=>Array.isArray(rows)&&rows.length===ids.length&&ids.every(id=>rows.filter(row=>row?.caseId===id).length===1);
function completeRuntimeOperationAdmission(value){
 const operationIds=['LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256','REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE','ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'];
 const negativeIds=['legacy','dag'].flatMap(form=>Array.from({length:20},(_,i)=>form+'-'+i)).concat('dag-array-count'),oldExceptionIds=['legacy','dag'].flatMap(form=>[...Array.from({length:12},(_,i)=>i),18,19].map(i=>form+'-'+i));
 const inherited=['constructor','__defineGetter__','__defineSetter__','hasOwnProperty','__lookupGetter__','__lookupSetter__','isPrototypeOf','propertyIsEnumerable','toString','valueOf','__proto__','toLocaleString'];
 const labelIds=[...['legacy-version','dag-version','dag-languageVersion','dag-operationRegistryVersion'].flatMap(prefix=>Array.from({length:8},(_,i)=>prefix+'-'+i)),...['legacy','dag'].flatMap(form=>[0,1].map(i=>form+'-nested-steps-length-'+i)),...['stepRef','output'].flatMap(key=>Array.from({length:8},(_,i)=>'result-'+key+'-'+i)),'result-array-assertion',...inherited.map(name=>'inherited-input-port-'+name)],capabilityIds=['EXECUTION_MODE','REQUIRED_CAPABILITY','EXECUTABLE_KIND'].flatMap(field=>Array.from({length:9},(_,i)=>field+'-'+i));
 if(value?.schema!=='closed-loop-runtime-operation-admission-controls/1'||value.result!=='PASS'||!exactCaseIds(value.negativeCases,negativeIds)||!value.negativeCases.every(row=>row.result==='REJECTED_INVALID'&&row.workerStarted===false)||!exactCaseIds(value.labelCases,labelIds)||!value.labelCases.every(row=>row.result==='REJECTED_INVALID')||!exactCaseIds(value.capabilityCases,capabilityIds)||!value.capabilityCases.every(row=>row.supported===false)||value.capabilityCases.filter(row=>row.preFixException===true).length!==6||value.capabilityCases.filter(row=>row.preFixAdmission===true).length!==3||JSON.stringify(value.preFixExceptionCases)!==JSON.stringify(oldExceptionIds)||value.preFixLabelExceptionCount!==28||value.preFixCoercedCapabilityAdmissions!==1||value.preFixCoercedOperationCompletedExecutions!==0||value.preFixMalformedResultCompletedExecution!==1||JSON.stringify(value.registeredOperationIds)!==JSON.stringify(operationIds)||value.registeredOperationExecutionCount!==27||!['executionTraceUnchanged','normalizedSpecUnchanged','registryIdentityUnchanged'].every(key=>value[key]===true)||value.workerLaunches!==0||JSON.stringify(value.registeredErrorCodesUnchanged)!==JSON.stringify(['MALFORMED_JSON','MALFORMED_XML']))return false;
 const ingestion=value.ingestion,ids=['inherited-constructor','inherited-toString','coerced-registered-COMPARE','malformed-version-label','malformed-steps-length','malformed-result-output-label','coerced-result-output'];
 return ingestion&&['originalRawHistoryPreserved','canonicalStatePreserved','conformingEnvelopeStillValid'].every(key=>ingestion[key]===true)&&Array.isArray(ingestion.results)&&ingestion.results.length===14&&['CURRENT','PRE_FIX_EQUIVALENT'].every(mode=>ids.every(caseId=>{const rows=ingestion.results.filter(row=>row.mode===mode&&row.caseId===caseId),oldCoercion=['coerced-registered-COMPARE','coerced-result-output'].includes(caseId);return rows.length===1&&(mode==='CURRENT'?rows[0].result==='REJECTED_INVALID'&&rows[0].expectedCode==='INVALID_TEST_IR':rows[0].result===(oldCoercion?'FALSE_SYNTAX_ADMISSION_REPRODUCED':'HELPER_EXCEPTION_REPRODUCED')&&(!oldCoercion||rows[0].executionNotEstablishedByThisIngestionControl===true));}));
}
function completeConditionalBytes(rows){const value=oneCase(rows,'CONDITIONAL_REQUIRED_FIXTURE_BYTES');return value?.passed===true&&value.actualDefinitionFileAdmission===true&&value.actualSavedZip===true&&value.synthetic===true&&value.actualBrowser===false&&value.realExternalActor===false&&Array.isArray(value.observations)&&value.observations.length===2&&[23,24].every(stage=>value.observations.filter(row=>row.stage===stage).length===1&&value.observations.some(row=>row.stage===stage&&row.operation==='EXECUTE_FAILURE_TEST'&&row.actualBytes===8&&row.byteIdentityVerified===true&&row.priorConclusionsWithheld===true&&row.syntheticPrerequisiteProjection===true));}
function completeScopeNegativePopulation(rows,report){
 const expected=[[2,'projectRevision'],[2,'inputVersion'],[3,'sourceSetVersion'],[5,'requirementsVersion'],[7,'testSuiteVersion'],[9,'instructionVersion'],[11,'iterationId'],[11,'candidateId'],[11,'runId'],[11,'contextId'],[21,'baselineId'],[21,'productId'],[2,'baselineId'],[3,'researchVersion'],[19,'sourceConvergedIterationId'],[19,'confirmationIterationId'],[23,'productVersion'],[25,'deliveryCandidateSetId'],[26,'reviewVersion'],[27,'reconciledReviewVersion'],[29,'releaseId'],[29,'hashReviewId'],[2,'evidenceChainVersion']];
 return report.scopeIdentityMatrix===true&&Array.isArray(rows)&&rows.length===23&&rows.every(row=>row&&typeof row==='object'&&!Array.isArray(row)&&Number.isSafeInteger(row.stage)&&typeof row.key==='string'&&typeof row.checkId==='string'&&row.checkId.startsWith(`scope.${row.stage}.${row.key}.`)&&row.checkId.length>`scope.${row.stage}.${row.key}.`.length&&row.expected==='STALE_SCOPE'&&row.code==='STALE_SCOPE'&&row.currentControlAccepted===true&&row.staleValueTypeConforming===true&&row.accepted===false&&row.acceptedChanges===0)&&new Set(rows.map(row=>row.checkId)).size===23&&isDeepStrictEqual(rows.map(row=>`${row.stage}:${row.key}`).sort(),expected.map(([stage,key])=>`${stage}:${key}`).sort());
}
const quarantineCaseNames=[
 'Corrupt project and actual file bytes are preserved together before the canonical row is quarantined',
 'Restoring a valid complete version cannot overwrite the separate quarantined file evidence',
 'Independent decryption and graph decoding reproduce the damaged stored row, original metadata and exact available file bytes',
 'Quarantine evidence cannot masquerade as a validated project backup or activate damaged data',
 'Controlled quarantine deletion is atomic and idempotent and leaves active projects, files and retained History intact',
 'Invalid canonical encoding and interrupted quarantine preserve original state; session startup checkpoints other valid projects and records the quarantined starting state',
 'Reload startup opens an independent valid project and exposes History when the selected project fails integrity'
];
const quarantineSourceInputs=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','test-project-store-runtime.mjs','verifier-runtime.mjs','verify-quarantine-recovery.mjs','verify-integrity-recovery-faults.mjs','verify-conformance-regressions.mjs'];
const completeQuarantineRecovery=(rows,report)=>report.synthetic===true&&report.actualBrowser===false&&report.testedCorruptedFileBytes===15&&exactRows(rows,quarantineCaseNames.map(name=>({name,result:'PASS'})));
export const verificationCatalog={
  'verify-quarantine-recovery.mjs':{sourceInputs:quarantineSourceInputs,boundary:'Production store read/quarantine/recovery/deletion under the lifecycle transaction adapter, native Blob bytes and independent Node cryptography; no actual browser or external actor claim',checks:[check('store.hash-mismatch-quarantine','testedCorruptedFileBytes','cases',undefined,'PROJECT_HASH_MISMATCH rejects the corrupt row and preserves its exact body/file bytes; active-store exclusion is separately asserted by lifecycle.complete-report-population',{expectedDescription:'All seven exact quarantine controls pass, including corrupt bytes, independent restored-project isolation and interrupted preservation',condition:completeQuarantineRecovery}),check('recovery.quarantine-controlled-deletion','testedCorruptedFileBytes','cases',undefined,'Successful selected-body absence through metaGet, injected-failure preservation, exact retry/conflict and active-project/file isolation',{expectedDescription:'All seven exact quarantine controls pass after the direct QUARANTINE_BODY_REMOVAL_ORACLE assertion',condition:completeQuarantineRecovery})]},
  'verify-integrity-recovery-faults.mjs':{sourceInputs:[...quarantineSourceInputs,'verify-filename-transports.mjs','operator-journey-fixtures.mjs','test-fixtures.mjs','test-handoff-authorization.mjs','test-zip.mjs'],boundary:'Actual isolated production faults and restored production controls through the existing child supervisor; transaction adapter, no actual browser claim',checks:[check('recovery.quarantine-body-delete-fault','method','results',undefined,'Maintained removal of only meta.delete(key) must fail at QUARANTINE_BODY_REMOVAL_ORACLE and its unchanged owner must pass',{expectedDescription:'Exact four maintained fault/control tuples complete; the body-deletion tuple supports the narrow deletion regression only',condition:(rows,report)=>report.synthetic===true&&report.actualBrowser===false&&report.method==='Targeted in-memory production faults followed by replay against the unmodified implementation'&&exactRows(rows,[['verify-quarantine-recovery.mjs','quarantine-files'],['verify-quarantine-recovery.mjs','quarantine-body-delete'],['verify-filename-transports.mjs','handoff-race'],['verify-filename-transports.mjs','stored-byte-comparison']].map(([suite,fault])=>({suite,fault,result:'DETECTED',restoredImplementation:'PASS'})))})]},
  'verify-final-acceptance.mjs':{sourceInputs:['browser-execution-evidence.mjs','deployment-contract-identities.mjs','evaluate-mobile-acceptance-submission.mjs','final-acceptance.mjs','hash.js','mobile-evidence-test-fixture.mjs','operator-journey-fixtures.mjs','test-external-normative-proof.mjs','test-fixtures.mjs','test-normative-catalog-consumers.mjs','test-normative-context-applicability.mjs','test-normative-proof-fixture.mjs','test-project-store-runtime.mjs','test-stage01-specification-controls.mjs','test-zip.mjs','verification-evidence.mjs','verified-site.mjs','verifier-runtime.mjs','verify-conformance-regressions.mjs','verify-mobile-acceptance-evidence.mjs','visual-baseline-submission.mjs','verify-test-runtime-v3.mjs','test-runtime-operation-registry.mjs','workbook.js','workflow-schema.js','test-runtime.js','test-worker.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'],boundary:'Actual retained-evidence reader, report projection and final consumer with explicitly disposable conformance/device fixtures; no actual release acceptance claim',checks:[check('acceptance.specification-identity','finalAcceptanceGate','specificationIdentityCases',undefined,'Exact source-manifest projection, separate candidate identity, missing/wrong/coerced type rejection and report-reference isolation',{expectedDescription:'All21 independently listed source-identity controls execute; actual specification manifest source is distinct from application candidate',condition:(rows,report)=>report.finalAcceptanceGate==='PASS'&&exactNamedCases(rows,specificationIdentityCases)}),check('acceptance.registry-identity','finalAcceptanceGate','deploymentContractIdentityCases',undefined,'Current private registry/TestIR identity projection and exact final consumer negatives',{expectedDescription:'All five missing/wrong/reference-isolation controls execute with conforming recovery',condition:(rows,report)=>report.finalAcceptanceGate==='PASS'&&exactNamedCases(rows,acceptanceRegistryCases)})]},
  'verify-due-stage-timing.mjs':{sourceInputs:['verification/deferred-definition-compatibility-legacy-fixture-20261005.json'],boundary:'Actual bounded deferred-definition file/operator/store regression owner; each conditional package projection states its synthetic prerequisites',checks:[check('definitions.compatibility-admission','deferredDefinitionCompatibilityAdmission','verificationObservations',undefined,'Full finite 51-observation admission population with literal counts and exact actual outcomes',{expectedDescription:'Eight admitted future controls, one immediate, two correction, 28 rejection, three precommit, four shared support, three retained-storage, one activation, three fault and one stale-confirmation observations',condition:completeDeferredAdmission}),check('definitions.stage17-receipt-preserved','dueStageTiming','results',undefined,'Actual Stage17 child receipt control after freeze and reservation; parent synthetic consumer cannot substitute',{expectedDescription:'Exact child marker, both phases, all six material negatives, byte-loss blocking and restoration, idempotency and state preservation',condition:completeStage17Receipt}),check('definitions.conditional-producer-contracts','dueStageTiming','results',undefined,'Actual saved ZIP carriers for all 38 current conditional receipt operations',{expectedDescription:'Exact conditional operation universe, shared operation-only contract, fixture/evidence custody and role isolation, ordinary neighbor controls and two owning faults',condition:completeConditionalProducer}),check('definitions.conditional-fixture-bytes','dueStageTiming','results',undefined,'Actual admitted byte-backed definition and exported required bytes at independent conditional Stage23/24',{expectedDescription:'Both stages provide exactly the eight preserved fixture bytes and withhold unrelated conclusions; synthetic prerequisites do not claim completed stages',condition:completeConditionalBytes})]},
  'verify-definition-of-done-invariants.mjs':{boundary:'actual loaded schema ownership/derivation/typed-relationship/extraction/provenance metadata assertions; semantics/custody separately scoped',checks:['fieldOwnershipCoverage','applicationDerivationCoverage','typedRelationshipCoverage','acceptedAgentValueExtractionCoverage','acceptedRelationshipProvenanceCoverage'].map(name=>check('metadata.'+name,'fieldOwnershipCoverage','coverageMetrics.'+name,undefined,'Actual canonical field/relationship metadata enumerations and independent required schema assertions',{expectedDescription:'Nonempty exact declared metadata universe with complete owner/derivation/type/response-path/provenance contract',condition:currentExecutedMetric,coverageIds:report=>report.coverageMetrics[name].includedIds,basis:'EXECUTED_SCHEMA_METADATA_ASSERTIONS'}))},
  'verify-v3-definition-of-done.mjs':{boundary:'existing eight independently asserted current stage intake/obligation/file-byte/slot/timing/activation verifier executions; synthetic semantic actor fixture',checks:['stage01RawInputAccounting','stage01RequiredFileInspectionAccounting','stage01AcceptedSemanticMappingCoverage','stage04ObligationAccounting','fileFirstPromptByteIdentityCoverage','attachmentSlotMappingCoverage','dueStageObligationCoverage','activationProofCoverage'].map(name=>check('existing.'+name,'section49MetricUniverseContract','section49CoverageMetrics.'+name,undefined,'Existing independently checked actual verifier outputs',{expectedDescription:'Existing exact nonempty verifier case universe, measured numerator reconciles IDs and direct production controls',condition:currentExecutedMetric,coverageIds:report=>report.section49CoverageMetrics[name].includedIds}))},
  'verify-shared-contract-faults.mjs':{boundary:'actual isolated production downstream invalidation baseline and controlled terminal-own-stage fault',checks:[check('terminal.own-invalidation-controls','schema','verificationObservations',undefined,'INVALIDATION_ORACLE at original and controlled faulty application invalidation boundary',{expectedDescription:'Terminal own-transition sentinel preserved; exact self-invalidation mutant independently DETECTED and restored baseline passes',condition:emittedCases(['terminal-own-transition-noninvalidated','terminal-self-invalidation-mutant-detected'])})]},
  'verify-response-retry-persistence.mjs':{boundary:'actual failed response continuation, committed replacement ZIP, exact prior raw/file bytes and human status; transaction adapter',checks:[check('response.evidence-string-persistence','synthetic','verificationObservations',undefined,'Conforming staged response accepted/saved/readback; wrong evidence CONTENT type rejected before proposal',{expectedDescription:'Early canonical type rejection with preserved raw bytes and real save/readback control',condition:emittedCases(['BOUNDARY-EVIDENCE-STRING-PERSISTENCE'])}),check('response.retry-byte-custody','synthetic','verificationObservations',undefined,'Exact prior substance in saved/reloaded committed replacement ZIP',{expectedDescription:'Prior raw/file bytes survive actual committed replacement, large context externalization, human claim remains noncanonical',condition:emittedCases(['BOUNDARY-RETRY-PRIOR-SUBSTANCE'])})]},
  'verify-operational-persistence.mjs':{boundary:'actual canonical save/reload and native Blob custody; synthetic instruction-version/evidence project',checks:[check('store.retained-evidence-custody','retainedEvidenceCustody','verificationObservations',undefined,'Retained compatible historical report byte custody after current instruction changes; current-scope refusal and missing/corrupt/foreign/omitted byte controls',{expectedDescription:'Reload reobserves current and explicitly referenced historical report bytes once; unrelated history is not read; old bytes cannot authorize current result; all four required-byte negatives remain insufficient',condition:emittedCases(['RETAINED-HISTORICAL-EVIDENCE-CUSTODY'])}),check('store.current-supplied-input-custody','currentSuppliedInputCustody','verificationObservations',undefined,'Retained explicitly supplied input after real input-version correction; authoritative response commit/reload/History restore/backup import without a manual byte read',{expectedDescription:'Current supplied immutable input identity survives exact native Blob reobservation and response-file acceptance/recovery; five missing/metadata/corrupt/foreign/unselected byte variants remain insufficient; current supplied-input membership cannot authorize a different historical input scope',condition:rows=>emittedCases(['CURRENT-SUPPLIED-INPUT-CUSTODY'])(rows)&&['omittedInputObserverInsufficient','currentSuppliedIdentityRetained','noManualReadRequired','commitReloadRestoreWorks','noRetroactiveHistoricalAuthorization'].every(name=>rows.find(row=>row.checkId==='CURRENT-SUPPLIED-INPUT-CUSTODY').observed?.[name]===true)&&rows.find(row=>row.checkId==='CURRENT-SUPPLIED-INPUT-CUSTODY').observed?.negativeVariantsInsufficient===5&&Object.keys(rows.find(row=>row.checkId==='CURRENT-SUPPLIED-INPUT-CUSTODY').observed||{}).length===6})]},
  'verify-production-baseline-authority.mjs':{boundary:'actual registered human-decision writer, receipt and canonical save/reload; synthetic non-gating purpose targets',checks:[check('human.current-decision-assurance','humanDecisionCurrentAssurance','verificationObservations',undefined,'All registered current purposes reject unavailable stronger identity labels before mutation and preserve supported SELF_ASSERTED records and receipts',{expectedDescription:'Every current purpose supports default and explicit SELF_ASSERTED; VERIFIED_EXTERNAL and AUTHENTICATED reject without canonical identity/history mutation; native records/receipts retain actual assurance through save/reload',condition:emittedCases(['CURRENT-HUMAN-DECISION-ASSURANCE'])}),check('human.current-decision-target','humanDecisionTargetIntegrity','verificationObservations',undefined,'Typed current human targets, selection binding, exact canonical failed write and retained history scope',{expectedDescription:'Bad subjects reject before allocation; current targets persist; lost current targets cannot commit; supported retained selection and unknown historical subjects preserve separate scope',condition:emittedCases(['CURRENT-HUMAN-DECISION-TARGET-INTEGRITY'])})]},
  'verify-stage01-agent-contract-alignment.mjs':{sourceInputs:['test-stage01-specification-controls.mjs','test-project-store-runtime.mjs','verifier-runtime.mjs','test-zip.mjs'],boundary:'final generated fallback contract and deterministic consumer; exact closed enum controls',checks:[check('response.closed-envelope-publication','stage01AgentContractAlignment','envelopePublicationObservations',undefined,'Actual emitted final key/evidence contract inspected independently',{expectedDescription:'Exact key grammar/type/global namespace and canonical evidence field types published',condition:rows=>Array.isArray(rows)&&['TEMPORARY_KEY_PUBLICATION_ORACLE','EVIDENCE_STRING_PUBLICATION_ORACLE'].every(name=>rows.filter(row=>row.name===name).length===1&&rows.some(row=>row.name===name&&row.result==='PASS'))}),check('response.fallback-enums','stage01AgentContractAlignment','verificationObservations',undefined,'Independent fallback enums and accepted/rejected controls',{expectedDescription:'Exact closed answer/unresolved kinds published and validated',condition:emittedCases(['BOUNDARY-FALLBACK-CLOSED-ENUMS'])})]},
  'verify-response-authority-integrity.mjs':{boundary:'actual production ingestion authority, immutable literal values, accepted-state preservation and final prompt descriptor',checks:[check('producer.application-timing-authority','responseAuthorityIntegrity','verificationObservations',undefined,'Application-owned timing cannot be supplied by external agent',{expectedDescription:'All9 named application timing fields reject, state unchanged; final descriptors omit these writable fields',condition:emittedCases(['DELIVERY_REQUIRED','EARLIEST_EXECUTABLE_STAGE','FINAL_PRODUCT_REQUIRED','PER_RUN_REQUIRED','REQUIRED_BY_STAGE','TARGET_AVAILABILITY_CONDITION','TIMING_ENTRIES','TIMING_SCHEDULE_SHA256','VERIFICATION_PHASE'].map(field=>'PRODUCER-TIMING-REJECT-'+field).concat('PRODUCER-TIMING-PROMPT-EXCLUDES-APPLICATION-FIELDS'))})]},
  'verify-returned-slot-authority.mjs':{boundary:'actual reserved-slot ingress, stored/rehashed corrected Blob, idempotent duplicate receipt and exact exported package bytes',checks:[check('response.returned-slot-controls','returnedSlotAuthority','verificationObservations',undefined,'Current attachment-slot authority and corrected identical JSON/new file retry',{expectedDescription:'All3 explicit slot rejections, exact saved ZIP contract, corrected Blob retry, unavailable-custody recovery, and actual preaccept reverify controls execute',condition:emittedCases(['ATTACHMENT-SLOT-INVENTED-REJECTED','ATTACHMENT-SLOT-FOREIGN-REJECTED','ATTACHMENT-SLOT-ROLE-MISMATCH-REJECTED','ATTACHMENT-PACKAGE-EXACT-SLOT-BYTES','BOUNDARY-CORRECTED-RETURNED-FILE-RETRY','RETURNED-BYTE-CUSTODY-RETRY-RECOVERY','ACTUAL-UI-RETURNED-BYTE-REVERIFY'])})]},
  'verify-copy-transaction.mjs':{boundary:'actual production clone transaction, identity receipts, recovery and unchanged source state; isolated shared Node transaction adapter',checks:[check('clone.bounded-retry-isolation','synthetic','verificationObservations',undefined,'actual clone retry and invalid receipt rollback cases',{expectedDescription:'Exact live/recovery clone retries have one effect; every invalid receipt case preserves isolated source/canonical state',condition:emittedCases(['clone.retry-single-effect','clone.backup-retry-single-effect','clone.invalid-receipt-isolation'])})]},
  'verify-history-project-lifecycle.mjs':{boundary:'actual delete command idempotency, restored activation and recovery metadata; isolated production transaction adapter',checks:[check('delete.bounded-retry-isolation','synthetic','verificationObservations',undefined,'actual delete retry/restoration and invalid receipt rollback cases',{expectedDescription:'Exact live/restored/recovery delete retries have one effect; invalid receipts preserve isolated state',condition:emittedCases(['delete.retry-single-effect','delete.restored-activation-single-effect','delete.backup-retry-single-effect','delete.invalid-receipt-isolation'])})]},
  'verify-recoverable-history.mjs':{sourceInputs:['test-project-store-runtime.mjs','verifier-runtime.mjs'],boundary:'actual canonical recovery/import/view/History/Undo/Redo projection authority',checks:[check('projection.recovery-controls','synthetic','verificationObservations',undefined,'actual canonical recovery projection rejection controls',{expectedDescription:'All13 enumerated imported/view/history/nested projection authority violations reject',condition:emittedCases(['projection.recovery-canonical-authority'])})]},
  'verify-stage-prompts-complete.mjs':{boundary:'final emitted and externalized Stage23/24 independent context projection',checks:[check('stage06.canonical-binding-publication','promptsChecked','stage06CanonicalBindings',undefined,'Actual generated and materialized allowed catalog, independent hashes and stale continuation controls',{expectedDescription:'All three external operations receive exactly five permitted current canonical entries',condition:rows=>Array.isArray(rows)&&rows.length===3&&new Set(rows.map(row=>row.operation)).size===3&&rows.every(row=>Array.isArray(row.keys)&&row.keys.length===5&&typeof row.contextSignature==='string'&&typeof row.instructionSha256==='string')}),check('review.blind-final-context','promptsChecked','verificationObservations',undefined,'actual author identity/content withheld and authorized source context preserved',{expectedDescription:'Stage23 and24 final instruction/externalized context excludes author and prior verdict substance while retaining authorized source',condition:emittedCases(['blind-stage23-secondary-context-projection','blind-stage24-secondary-context-projection'])})]},
  'verify-stage19-discovery-challenge.mjs':{boundary:'actual current independent discovery/confirmation requirement binding and gate; synthetic external actor',checks:[check('stage19.discovery-controls','stage19DiscoveryChallenge','verificationObservations',undefined,'Stage 19 current independent discovery challenge acceptance and counterexamples',{expectedDescription:'Exact current independent challenge passes; missing/stale/reused-context/unresolved findings block',condition:emittedCases(['S19-CURRENT-INDEPENDENT-DISCOVERY','S19-PRIOR-AUTHOR-EPISTEMIC-BOUNDARY','S19-MISSING_CHALLENGE','S19-STALE_REVIEWED_REQUIREMENT','S19-REUSED_AUTHOR_CONTEXT','S19-UNRESOLVED_DISCOVERY_FINDING','S19-CONTROLLED-MISSING-CHALLENGE-DETECTED','S19-STALE_GOVERNING_INSTRUCTION','S19-GOVERNING-INSTRUCTION-SCOPE'])})]},
  'verify-stage26-independent-review.mjs':{boundary:'actual current independent process/product review reservation and progression authority',checks:[check('stage26.independent-review-controls','stage26IndependentReview','verificationObservations',undefined,'Stage 26 author-alone cannot approve independent audit review',{expectedDescription:'Current independently bound review passes; all seven missing/stale/reused/unresolved controls block',condition:emittedCases(['S26-PUBLISHED-COMPARISON-COMPLETE','S26-PUBLISHED-COMPARISON-RECONCILE','S26-PUBLISHED-POSITIVE-STRING-CONTROLS','S26-PUBLISHED-UNKNOWN-STRING-CONTROLS','S26-AUTHOR-REQUIRES-INDEPENDENT-REVIEW','S26-CURRENT-BOUND-INDEPENDENT-REVIEW','S26-MISSING_REVIEW','S26-STALE_AUDIT','S26-STALE_AUDIT_EVIDENCE','S26-MISSING_REVIEW_EVIDENCE','S26-REUSED_AUTHOR_CONTEXT','S26-REUSED_AUTHOR_RESERVATION','S26-UNRESOLVED_REVIEW_FINDING','S26-CONTROLLED-AUTHOR-BYPASS-DETECTED'])})]},
  'verify-handoff-metadata-boundary.mjs':{boundary:'actual Stage 12/17/19 target-run handoff exported ZIP bytes, opaque aliases and requested scope',checks:[check('handoff.target-run-bytes','handoffMetadataBoundary','targetRunOutputHandoffs',undefined,'TARGET_OUTPUT_BYTES_ORACLE',{expectedDescription:'Exact output ZIP bytes for all three verification stages; other-run bytes withheld',condition:rows=>Array.isArray(rows)&&[12,17,19].every(stage=>rows.some(row=>row.stage===stage&&row.actualZipBytesMatched===true&&row.otherRunExcluded===true&&row.result==='PASS'))})]},
  'verify-project-activation.mjs':{boundary:'actual UI project activation callers, committed destination, operation reservation and exact exported ZIP bytes',checks:[check('activation.exported-owned-instruction','schema','observations',undefined,'PROJECT_ACTIVATION_OPERATION_ORACLE',{expectedDescription:'All four independently asserted activation observations; exact destination owned COMPLETE prompt/reservation/export',condition:rows=>Array.isArray(rows)&&['PROJECT_ACTIVATION_EXPORTED_INSTRUCTION','PROJECT_ACTIVATION_CALLERS','PROJECT_ACTIVATION_NULL_VIEW','PROJECT_ACTIVATION_SAME_PROJECT_VIEW'].every(id=>rows.filter(row=>row.checkId===id||row.id===id||row.observationId===id).length===1&&rows.some(row=>(row.checkId===id||row.id===id||row.observationId===id)&&row.result==='PASS'))})]},
  'verify-project-lifecycle.mjs':{sourceInputs:['verify-project-lifecycle-full.mjs','verify-workflow-focus.mjs','test-project-store-runtime.mjs','verifier-runtime.mjs','project-store.js','app-core.js','workflow-engine.js','workflow-schema.js'],boundary:'Complete synthetic nonbrowser project lifecycle, 79 named storage/recovery regressions and 37 focus/control cases; no physical device or actual browser claim',checks:[check('lifecycle.complete-report-population','projectLifecycleControls','projectLifecycleControls',true,'Exact persisted storage/recovery and focus report population plus final material lifecycle controls',{expectedDescription:'Exactly 79 named storage PASS reports, 37 exact synthetic focus PASS variants, and one final report with every material lifecycle control and zero unsafe overrides',condition:(_,report,reports)=>completeLifecycleReports(reports)})]},
  'verify-external-result-determination.mjs':{sourceInputs:['test-project-store-runtime.mjs','test-verification-routing-fixtures.mjs','test-fixtures.mjs','test-zip.mjs','workflow-engine.js','workflow-schema.js','prompt-engine.js','response-ingestion.js','project-store.js'],boundary:'Stage 12 adjudication with synthetic canonical evidence; Stage 22–24 exported instruction, response prepare/commit, effective determination and gate; no external agent or device execution claim',checks:[check('external-result.four-family-negative-state','schema','observations',undefined,'Actual controlled-result negative and conforming cases plus stale prompt recovery',{expectedDescription:'Exactly four family-specific SATISFIED controls and VIOLATED/UNKNOWN/UNDETERMINED/PARTIAL/SUCCESS negatives, missing/wrong-type admission controls on 22–24, original false-positive reproduction, and one stale Stage 22 prompt recovery',condition:(rows,report)=>report.schema==='closed-loop-external-result-determination-regression/1'&&completeExternalResultDeterminations(rows),requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:1977','specification/closed-loop-reliability-controlling-implementation-specification.txt:2884','specification/closed-loop-reliability-controlling-implementation-specification.txt:3590','specification/closed-loop-reliability-controlling-implementation-specification.txt:3599','specification/closed-loop-reliability-controlling-implementation-specification.txt:3607']})]},
  'verify-stage01-intake-closure.mjs':{boundary:'actual accepted Stage 01 deliverable proposal, derivation and completion gate',checks:[check('stage01.deliverable-controls','stage01IntakeClosure','verificationObservations',undefined,'STAGE01_DELIVERABLE_ORACLE',{expectedDescription:'Omitted/empty/unknown deliverable does not complete; defined deliverable completes',condition:emittedCases(['stage01.deliverable.omitted','stage01.deliverable.empty','stage01.deliverable.unknown','stage01.deliverable.defined'])})]},
  'verify-semantic-review-acceptance.mjs':{boundary:'actual current Stage 02 contract, independent review and reconciliation membership/gate',checks:[check('stage02.search-review-controls','semanticReviewAcceptance','verificationObservations',undefined,'Stage 02 reviewed search contract gate',{expectedDescription:'Missing and unreviewed contracts block; exact current reviewed/reconciled contract completes',condition:emittedCases(['stage02.search-contract.required-components','stage02.search-contract.conditional-empty-control','stage02.search-contract.retained-component','stage02.search-contract.missing','stage02.search-contract.unreviewed','stage02.search-contract.reviewed','stage02.search-contract.reconciliation-current','stage02.search-capability.missing-after-review','stage02.search-capability.unknown-route','stage02.search-capability.bound-evidence','stage02.search-capability.changed-binding','stage02.search-capability.corrupt-canonical-report','stage02.search-capability.corrupt-operator-authorization'])})]},
  'verify-verification-routing.mjs':{boundary:'actual Stage 06 preparation/readiness and supported declared later target availability',checks:[check('stage02.source-search-file-custody','verificationRouting','verificationObservations',undefined,'Actual selected/stored/readback report artifact and exact capability/operator/source-search target binding',{expectedDescription:'Actual file-first search capability report/operator custody cannot invent native test identity',condition:emittedCases(['stage02.search-capability.file-first'])}),check('native.stage24-adversarial-controls','verificationRouting','verificationObservations',undefined,'Actual native Stage24 satisfied/violated adversarial worker result persisted',{expectedDescription:'Both actual Stage24 worker outcomes persist adversarial result/observations; stale test proof withdrawn',condition:emittedCases(['native-stage24-satisfied','native-stage24-violated'])}),check('stage06.capability-target-controls','verificationRouting','verificationObservations',undefined,'application-known capability readiness and future-target design gating',{expectedDescription:'Unknown capability blocks; current retained capability closes readiness while future execution remains deferred',condition:emittedCases(['stage06.capability.EXTERNAL_SYSTEM.unknown','stage06.capability.EXTERNAL_SYSTEM.ready','stage06.capability.EXTERNAL_AGENT_TOOL.unknown','stage06.capability.EXTERNAL_AGENT_TOOL.ready','stage06.future-target.INDEPENDENT_AGENT_REVIEW','stage06.future-target.APPLICATION_DETERMINISTIC'])})]},
  'verify-independent-preflight.mjs':{boundary:'actual Stage 09 prepare/commit, effective determination, exported ZIP, and readiness gate; handoff authorization synthetic only',checks:[check('stage09.required-property-controls','independentPreflight','verificationObservations',undefined,'Stage 09 incomplete review cannot complete and a conforming correction can progress',{expectedDescription:'Exactly eight required-property FALSE/UNKNOWN, 51 omitted/empty/unknown/unrecognized values, stale current-proposal case, and saved exported-package policy case; incomplete review stays UNDETERMINED while corrected path progresses',condition:completeStage09Preflight})]},
  'verify-stage03-agent-protocol.mjs':{boundary:'final emitted Stage 03 typed contract, validator, commit and gate',checks:[check('stage03.protocol','stage03AgentProtocol','stage03AgentProtocol',true,'Canonical recordId relationship was rejected'),negative('stage03.targetId','stage03AgentProtocol','nestedTargetIdRejected','unregisteredFieldsOrStageOperationsAccepted','Nested targetId relationship alias was accepted')]},
  'verify-ingestion.mjs':{boundary:'actual parser/validator/proposal/acceptance; synthetic stage prerequisites',checks:[
    check('ingestion.external-identity-shape','externalResponseIdentityShape','verificationObservations',undefined,'Exact published echo/reference identity types at reserved authoritative response-file admission and retained pending-proposal commit',{expectedDescription:'Eleven wrong scalar echo types and ten wrong reference shapes reject; seventeen isolated pre-fix false admissions reproduce; two unchanged pending proposals refuse commit; seven existing vocabulary/scope negatives stay rejected; three conforming controls commit/reload; sixteen nested STRING/STRING_ARRAY negatives reject, three missing-field diagnostic errors save/reload, and arbitrary authorized HUMAN JSON remains preserved',condition:emittedCases(['EXTERNAL-RESPONSE-IDENTITY-SHAPE'])}),
    check('ingestion.canonical-response-recovery','canonicalResponseRecovery','verificationObservations',undefined,'Canonical envelope boundary with structured diagnostics, exact raw/staged bytes and rejected pending proposal recovery',{expectedDescription:'Seven unsupported canonical values reject and save/reload with raw bytes; seven pre-fix equivalents fail for the intended canonical error with staged bytes recoverable; seven direct validations and two changed pending proposals reject; paired Unicode conforms and commits',condition:emittedCases(['CANONICAL-RESPONSE-RECOVERY'])}),
    check('ingestion.canonical-value-boundaries','responseCanonicalValueBoundaries','verificationObservations',undefined,'Typed returned digest, own stage-field membership and canonical HUMAN value confirmation/correction',{expectedDescription:'Wrong digest type and two inherited field names reject with exact pre-fix controls; reordered object confirms and creates no correction; four material object/array/string/type changes require correction',condition:emittedCases(['RESPONSE-CANONICAL-VALUE-BOUNDARIES'])}),
    check('ingestion.human-decision-target-authority','humanDecisionCandidateTargetAuthority','verificationObservations',undefined,'Published controlled-target contract and actual reported human-decision target admission/retained proposal/operator confirmation/storage',{expectedDescription:'Eleven invalid targets or non-string/noncanonical/inherited decision purposes reject; legacy false admission cannot commit; five permitted current/retained selection and ordinary-human-false controls confirm and reload with actual SELF_ASSERTED authority',condition:emittedCases(['HUMAN-DECISION-CANDIDATE-TARGET-AUTHORITY'])}),
    check('ingestion.evidence-source-scope','evidenceSourceScopeAuthority','verificationObservations',undefined,'Current source scope/permission admission, stale/project/inactive/corrupt target rejections, exact exported reference-cohort contract and retained pending-proposal operator commit controls',{expectedDescription:'Current source accepts; five incompatible targets and two current unprovided source/artifact identities reject; retained pre-fix pending proposals refuse commit; five permitted omission/input/corrected-input reuse/same-response controls commit/reload; raw/pending state preserved and compatible historical inspection allowed',condition:emittedCases(['EVIDENCE-SOURCE-SCOPE-AUTHORITY'])}),
    check('ingestion.evidence-attachment-custody','evidenceAttachmentScopeCustody','verificationObservations',undefined,'Actual native Blob custody, stale/metadata-only rejection, precommit byte loss and exact-byte restoration',{expectedDescription:'Current bytes accept; stale/metadata-only and changed/missing custody reject; missing bytes remain insufficient with pending work retained; exact restored bytes permit saved proposal progression',condition:emittedCases(['EVIDENCE-ATTACHMENT-SCOPE-CUSTODY'])}),
    check('ingestion.closed-envelope-controls','closedEnvelopeObservations','closedEnvelopeObservations',undefined,'Single typed/key/reference violations rejected before proposal with conforming controls',{expectedDescription:'All mapped evidence STRING fields, exact key bounds/types/namespace and closed attachment reference exercised',condition:rows=>Array.isArray(rows)&&['EVIDENCE_OPTIONAL_AUTHORITY_TYPE_CONTROL',...['kind','description','location','content','authorityType'].map(name=>'EVIDENCE_STRING_TYPE_ORACLE:'+name),'TEMPORARY_KEY_BOUNDARY_ORACLE','TEMPORARY_KEY_STRING_TYPE_ORACLE','TEMPORARY_KEY_EXACT_IDENTITY_ORACLE','TEMPORARY_KEY_SHARED_NAMESPACE_ORACLE','ATTACHMENT_REF_CLOSED_KEYS_ORACLE'].every(name=>rows.filter(row=>row.name===name).length===1&&rows.some(row=>row.name===name&&row.result==='PASS'))}),
    check('scope.current-identities','scopeIdentityMatrix','scopeIdentityMatrix',true,'scopeNegative: STALE_SCOPE exact path'),
    check('ingestion.raw-reload','scopeIdentityMatrix','extractionManifest',true,'raw response did not survive reload'),
    negative('ingestion.before-acceptance','scopeIdentityMatrix','atomicPrecommit','canonicalMutationsBeforeAcceptance','mutated canonical state before operator acceptance'),
    negative('ingestion.stale-proposal','staleProjectRevisionBlocked','staleProjectRevisionBlocked','staleProposalsAccepted','Proposal stale after project revision change was accepted.'),
    check('attachments.slot-bijection','attachmentSlotMapping','explicitSlotsRequired',true,'Explicit returned attachment-slot identity is required'),
    check('attachments.atomic-promotion','attachmentSlotMapping','atomicReturnedArtifactPromotion',true,'atomic returned-artifact promotion'),
    negative('attachments.filename-only','attachmentSlotMapping','filenameOnlyRejected','unmatchedDeliveryFilesAuthorized','filename-only attachment match rejected'),
    check('attachments.correction','attachmentSlotMapping','failedResponseRepairedWithoutReselect',true,'corrected bytes/slot retry retains staged raw response'),
    check('ingestion.operation-isolation','operationStageDataIsolation','operationStageDataIsolation',true,'operation stageData permission isolation'),
    check('ingestion.scope-negative-population','scopeIdentityMatrix','scopeChecks',undefined,'scopeNegative exact current schema dimensions',{expectedDescription:'Exactly23 independently named stage/dimension pairs over22 transport keys, including prohibited extra baseline and evidence-chain version; each starts from an accepted current control, rejects a type-conforming changed value with STALE_SCOPE, and commits zero changes',condition:completeScopeNegativePopulation,coverageIds:report=>report.scopeChecks.map(row=>row.checkId)})
    ,invalidCase('ingestion.unauthorized-application-field','scopeIdentityMatrix','agent application field','FIELD_OWNERSHIP_VIOLATION','unauthorizedFieldMutationsAccepted')
    ,invalidCase('ingestion.foreign-project-response','scopeIdentityMatrix','cross-project response','WRONG_JOB_ID','crossProjectRelationshipsAccepted')
    ,invalidCase('ingestion.append-only-rewrite','operationStageDataIsolation','append-only targetId update','INVALID_RECORD_IDENTITY','appendOnlyHistoryRewritesAccepted')
  ]},
  'verify-complete.mjs':{boundary:'production engine/state/store; synthetic project fixtures',checks:[check('regression.current-closure','currentRegressionClosure','currentRegressionClosure',true,'A stale regression success resolved a current material defect.'),negative('evidence.missing-chain','evidenceChainNoFabrication','evidenceChainNoFabrication','structurallyInsufficientEvidenceProducingMandatorySatisfaction','Missing evidence links were fabricated as complete.'),negative('store.accepted-state-rollback','acceptedStateStorageRollback','acceptedStateStorageRollback','partialCommitsAfterInjectedFailure','Storage failure during accepted-state persistence did not roll back exact prior state.'),negative('release.contradictory-input','releaseContradictions','releaseContradictions','releaseAcceptedWithContradiction','release contradiction prevents accepted release'),negative('scope.historical-records','currentRegressionClosure','stage5RequirementVersionIsolation','historicalScopeSatisfyingCurrentGates','Historical scope satisfied current selector.'),check('review.context-authority','reviewerIndependenceAuthority','reviewerIndependenceAuthority',true,'Self-asserted reviewer identity must not establish independent current context')]},
  'verify-full-cycle.mjs':{boundary:'all 30 production stage lifecycle, synthetic external replies and exact stored artifact fixture',checks:[check('matrix.exact-triples','stagesCompleted','verificationObservations',undefined,'Independently authored requirement/due-test membership x actual current reserved runs equals accepted triples',{expectedDescription:'Exact independently enumerated current requirement/run/test tuple identities; zero missing, extra or duplicate accepted tuple',condition:emittedCases(['fullcycle.exact-req-run-test-matrix']),coverageIds:report=>report.verificationObservations.find(row=>row.checkId==='fullcycle.exact-req-run-test-matrix').expected.includedIds,excludedIds:report=>report.verificationObservations.find(row=>row.checkId==='fullcycle.exact-req-run-test-matrix').expected.excludedIds||[]}),check('journey.all-stages','stagesCompleted','stagesCompleted',30,'Reload lost completed stages'),check('regression.corrected-ten','stagesCompleted','correctedIterationRuns',10,'post-correction ten-run fixture'),check('regression.unchanged-ten','stagesCompleted','unchangedConfirmationRuns',10,'unchanged confirmation ten-run fixture'),check('evidence.current-chains','stagesCompleted','evidenceChains',true,'Stage 29 complete evidence chain gate'),check('candidate.full-cycle-identity','stagesCompleted','artifactIdentity',true,'verifyArtifactIdentity and current delivery intent'),check('journey.reload','stagesCompleted','reloadIntegrity',true,'Traceability records missing')]},
  'verify-stage28-artifact-delivery-intent.mjs':{boundary:'actual current release/candidate/byte identity/destination-bound intent commands',checks:[check('artifact.pending-id-store-projection','stage28','pendingIdentityStoreProjection',undefined,'Pending Stage 28 identity stays omitted through direct derivation and disposable blank-project store write/read',{expectedDescription:'Former PRESENT_NULL fault corrected to OMITTED; real blank-project store roundtrip rejects null and preserves last valid state; full Stage 27 journey remains unclaimed',condition:stage28PendingStoreProjection}),check('artifact.byte-rehash','stage28','applicationByteRehashRequired',true,'application-owned byte rehash receipt'),check('artifact.exact-candidate','stage28','exactCandidateMappingRequired',true,'exact current candidate artifact/filename mapping'),check('artifact.order-independent','stage28','orderIndependentIdentity',true,'order independent same identity set'),check('intent.destination-bound','stage28','destinationBoundIntentGate',true,'current exact destination-bound intent'),check('intent.timed-validity','stage28','trustedTimedValidityGate',true,'trusted timed intent validity'),negative('intent.duplicate-blocked','stage28','ambiguousDuplicateIntentBlocked','unmatchedDeliveryFilesAuthorized','ambiguous duplicate intent rejected'),negative('artifact.semantic-drift','stage28','candidateSemanticDriftRejected','stage25Stage28CandidateSetMismatches','candidate semantics changed without exact rebind'),negative('artifact.scope-drift','stage28','identityScopeDriftRejected','stage25Stage28CandidateSetMismatches','current identity scope changed'),negative('intent.not-delivery','stage28','stage28DoesNotAuthorizeDelivery','authorizationRepresentedAsCompletedDelivery','Stage 28 intent does not record performed delivery')]},
  'verify-semantic-invariant.mjs':{boundary:'actual deterministic evidence sufficiency/adjudication/trust reducers; synthetic observations',checks:[check('stage25.explicit-coverage-inventories','semanticFalseAcceptanceInvariant','representationInventories',undefined,'Shared effective determination and coverage require explicit six array inventories',{expectedDescription:'29 independently expected structural, full/empty, mismatch and observation cases',condition:rows=>Array.isArray(rows)&&rows.length===29&&new Set(rows.map(row=>row.caseId)).size===29&&rows.every(row=>row.aggregateComplete===row.expectedValid&&row.effectiveDetermination===(row.expectedValid?'SATISFIED':'UNDETERMINED'))}),check('evidence.byte-authority','byteAuthorityEvidenceRegression','byteAuthorityEvidenceRegression',true,'Prose-only byte evidence cannot establish deterministic satisfaction'),check('evidence.meaning-comparison','meaningEvidenceRegression','meaningEvidenceRegression',true,'Complete evidence-backed meaning comparison did not repair semantic sufficiency'),check('evidence.human-owned','humanInspectionEvidenceRegression','humanInspectionEvidenceRegression',true,'Agent assertion substituted for human-owned inspection evidence'),negative('review.self-asserted','releaseGradeIndependence','releaseGradeIndependence','selfApprovedSemanticReviews','Self-asserted verifier identity became release-grade evidence'),negative('evidence.contradiction','semanticFalseAcceptanceInvariant','semanticFalseAcceptanceInvariant','favorableAgentVerdictsOverridingContradictoryObservations','contradictory/missing evidence state was accepted'),check('proof.truth-table','closedProofTruthTables','closedProofTruthTables',true,'closed proof expression expected truth tables'),check('proof.current-evidence','closedProofTruthTables','currentEvidenceRequired',true,'current evidence proof references')]},
  'verify-contract-closure.mjs':{boundary:'actual exported registries against independently enumerated declarations and exact specification shapes',checks:[check('registry.fields','contractClosure','fieldRegistryProof.result','PASS','FIELD_REGISTRY_UNIVERSE_ORACLE/FIELD_REGISTRY_BINDING_ORACLE',{coverageIds:report=>report.fieldRegistryProof.includedIds}),check('registry.operations','contractClosure','operationRegistryProof.result','PASS','required operation properties and exact scope binding',{coverageIds:report=>report.operationRegistryProof.includedIds}),check('registry.scopes','contractClosure','scopeMatrixProof.result','PASS','registry and scope universes must be identical',{coverageIds:report=>report.scopeMatrixProof.includedIds}),check('registry.durable','contractClosure','durableRegistryProof.result','PASS','Every canonical family must have exactly one durable-object contract.',{coverageIds:report=>report.durableRegistryProof.includedIds})]},
  'verify-v3-migration.mjs':{boundary:'production migration/import canonical state and preservation',checks:[check('migration.current-profile','verifyV3Migration','verifyV3Migration','PASS','exact /2 to /3 migration'),check('migration.unknown-preserved','verifyV3Migration','unknownExtensionsPreserved',true,'unknown extension preservation'),check('migration.idempotent','verifyV3Migration','idempotent',true,'idempotent second migration'),negative('migration.no-silent-heal','verifyV3Migration','currentV3NoSilentHeal','quarantinedProjectReactivated','current invalid /3 state is not silently healed')]},
  'verify-file-first-response.mjs':{boundary:'emitted file-first prompts and production response staging wiring; actual ingestion separately',checks:[check('response.file-selection','fileFirstResponseContract','primaryResponseFileSelection',true,'response.json is the authoritative returned transport',{basis:'EXECUTED_WIRING_ASSERTION'}),check('response.byte-rehash-wiring','fileFirstResponseContract','stagedReadBackRehash',true,'actual staging/readback hash invocation',{basis:'EXECUTED_WIRING_ASSERTION'}),negative('response.paste-primary','fileFirstResponseContract','pastePrimaryMutationDetected','requiredClipboardOrPastedResponseOperations','paste-primary controlled wiring mutation')]},
  'verify-test-runtime-v3.mjs':{sourceInputs:['test-runtime-operation-registry.mjs','test-project-store-runtime.mjs','verifier-runtime.mjs','verification/deferred-definition-compatibility-legacy-fixture-20261005.json'],boundary:'production Closed Loop Test IR runtime, independent exact expected values, bounds and timeouts',checks:[check('test-ir.operation-registry-admission','verifyTestRuntimeV3','operationRegistryAdmission',undefined,'Actual malformed/inherited operation and diagnostic boundary with unchanged registered primitive execution and Stage6 response admission',{expectedDescription:'Exact 41 operation,65 label,27 capability controls,14 paired ingestion observations; prior exceptions/coercions reproduced,all27 registered operations unchanged,zero invalid worker launches',condition:completeRuntimeOperationAdmission}),check('test-ir.exact-integer','verifyTestRuntimeV3','integerExact',true,'BigInt exact comparisons'),check('test-ir.json','verifyTestRuntimeV3','json',true,'independent expected JSON values'),negative('test-ir.unknown-operation','verifyTestRuntimeV3','unknownOperationRejected','unsupportedTestIrTreatedAsExecutable','unknown operation validation rejected'),negative('test-ir.arbitrary-code','verifyTestRuntimeV3','arbitraryCodeRejected','untrustedDomOrUrlExecutionAccepted','arbitrary executable code rejected'),check('test-ir.no-timeout-partials','verifyTestRuntimeV3','timeoutNoPartialResult',true,'timeout must produce no partial result')]},
  'verify-test-runtime-dag.mjs':{boundary:'actual Test IR compilation/DAG execution/typed operands and independent expected results',checks:[check('dag.explicit','explicitDag','explicitDag',true,'named explicit step DAG'),check('dag.typed-ports','explicitDag','typedPorts',true,'declared port type checking'),negative('dag.forward-reference','explicitDag','forwardReferenceRejected','implicitTestIrOperandSelection','forward reference rejected'),check('dag.legacy-compile','explicitDag','legacyCompiledBeforeExecution',true,'legacy plan normalized before execution')]},
  'verify-prompt-file-identity.mjs':{boundary:'every current registered external operation final emitted instruction bytes and manifest',checks:[negative('prompt.changed-bytes-rejected','promptFileIdentity','repairedOriginalAccepted','promptBodyFileByteDivergences','authoritative byte identity rejects BOM, CRLF, missing newline, wrapper, append, wrong digest across all 50 external operations')]},
  'verify-human-authority-roundtrip.mjs':{boundary:'actual reported human answer acceptance, direct confirmation, canonical propagation and correction',checks:[negative('human.unconfirmed-candidate','humanAuthorityRoundTrip','exactConfirmationRequired','humanFactsAcceptedOnlyFromAgentReport','Human answer was accepted without direct confirmation.')]},
  'verify-final-product-timing.mjs':{boundary:'actual independently reviewed leaf scheduling, declared target custody and final test selection',checks:[negative('timing.future-obligation','finalProductTiming','futureTestsNotPremature','obligationsRequiredBeforeTargetAvailability','A future obligation must not be demanded prematurely.')]},
  'verify-controller-v3-gap-closure.mjs':{boundary:'actual current activation proof, accepted reviewed leaf expression and checkpoint custody',checks:[negative('activation.missing-proof','activationProofFailsClosed','independentReviewCannotReplaceActivation','activationDecisionsWithoutProofObligations','An accepted independent review cannot substitute for the missing activation proof.')]},
  'verify-terminal-human-authority.mjs':{boundary:'actual canonical humanDeliveryIntent reducer',checks:[negative('projection.cannot-authorize','terminalHumanAuthority','agentStageDataRejected','stageProjectionsOverridingCanonicalRecords','Loose stage data cannot create delivery authority.')]},
  'verify-mobile-release-governance.mjs':{boundary:'actual strict mobile evidence/submission validators and controlled release governance mutations',checks:[negative('mobile.unpinned-proof','mobileReleaseGovernance','exactTargetBindingVerified','unpinnedMobileAcceptanceTreatedAsComplete','exact target current commit/challenge/viewport binding'),negative('mobile.foreign-origin','mobileReleaseGovernance','canonicalOriginBound','unexpectedDeploymentOriginAccepted','mobile acceptance bound to canonical origin/base path')]},
  'verify-test-runtime-integrity.mjs':{boundary:'actual runtime registry digest derivation/validation and superseded executable rejection',checks:[check('runtime.closed-binding-string-types','verifyTestRuntimeIntegrity','verificationObservations',undefined,'Exactly64 independently declared present optional binding property type negatives at runtime, schema adapter and spec boundary',{expectedDescription:'All64 present malformed optional STRING properties reject at each tested boundary; omission semantics and stronger native claims remain separately asserted',condition:(rows,report)=>report.verifyTestRuntimeIntegrity==='PASS'&&emittedCases(['RUNTIME-CLOSED-BINDING-STRING-TYPES-REJECTED'])(rows)&&exactLiteralFields(rows.find(row=>row.checkId==='RUNTIME-CLOSED-BINDING-STRING-TYPES-REJECTED').expected,{attempted:64,rejected:64,accepted:0,presentPropertyType:'NONEMPTY_STRING',hashFormat:'64_LOWERCASE_HEXADECIMAL_CHARACTERS',omission:'EXISTING_DEFAULTS'})&&exactLiteralFields(rows.find(row=>row.checkId==='RUNTIME-CLOSED-BINDING-STRING-TYPES-REJECTED').observed,{attempted:64,rejected:64,accepted:0})}),check('runtime.external-assertion-controls','verifyTestRuntimeIntegrity','verificationObservations',undefined,'External parsed/artifact SATISFIED claims cannot be terminal assertion proof',{expectedDescription:'Exactly2 negative external terminal claim controls, nonassertion rejection and native assertion positive data-only control',condition:emittedCases(['RUNTIME-EXTERNAL-DETERMINATION-PARSED-REJECTED','RUNTIME-EXTERNAL-DETERMINATION-ARTIFACT-REJECTED','RUNTIME-NONASSERTION-RESULT-REJECTED','RUNTIME-EXTERNAL-DETERMINATION-DATA-ONLY','RUNTIME-EXTERNAL-ASSERTION-NEGATIVE-POPULATION'])}),check('runtime.external-parsed-claim','verifyTestRuntimeIntegrity','verificationObservations',undefined,'Actual parsed data terminal-claim rejection',{violation:'externalAssertionsOverridingApplicationProof',expectedDescription:'Parsed SATISFIED data cannot supply registered assertion proof',condition:emittedCases(['RUNTIME-EXTERNAL-DETERMINATION-PARSED-REJECTED'])}),check('runtime.external-artifact-claim','verifyTestRuntimeIntegrity','verificationObservations',undefined,'Actual artifact literal terminal-claim rejection',{violation:'externalAssertionsOverridingApplicationProof',expectedDescription:'Artifact literal SATISFIED cannot supply registered assertion proof',condition:emittedCases(['RUNTIME-EXTERNAL-DETERMINATION-ARTIFACT-REJECTED'])}),check('registry.semantic-drift','verifyTestRuntimeIntegrity','results',undefined,'Corrected registry digests are reproducible and superseded executable identities fail closed',{violation:'registrySemanticDriftUnderUnchangedIdentity',expectedDescription:'Current independently derived registered descriptors match their SHA; prior executable digest is rejected',condition:rows=>Array.isArray(rows)&&rows.some(row=>row.name==='Corrected registry digests are reproducible and superseded executable identities fail closed'&&row.result==='PASS')})]},
  'verify-native-proof-journey.mjs':{boundary:'actual Test IR execution and application-owned proof result normalization during full lifecycle',checks:[check('native.foreign-receipt-rejected','nativeProofJourney','stdout',undefined,'Mismatched native testId/testSpecSha256/inputArtifactSha256Values rejected atomically',{violation:'nativeExecutionReceiptsFabricatedExternally',expectedDescription:'All three exact current native identity mutations reject atomically',condition:text=>{try{const report=String(text).trim().split(/\n(?=\{)/).map(x=>JSON.parse(x)).find(x=>x.nativeProofChecks);return ['testId','testSpecSha256','inputArtifactSha256Values'].every(field=>report?.nativeProofChecks.some(row=>row.name===`native ${field} mismatch rejected atomically`&&row.result==='PASS'));}catch{return false;}}})]},
  'verify-stage29-evidence-chain-checkpoint.mjs':{boundary:'actual application chain/checkpoint/export custody commands on disposable full lifecycle',checks:[check('checkpoint.full-chain-digest','stage29CurrentSetValidated','verificationObservations',undefined,'Independent complete canonical SHA oracle and old truncated-summary rejection',{expectedDescription:'Exact independently computed full chain SHA and old summary rejection execute',condition:emittedCases(['evidence-chain-full-canonical-sha256','evidence-chain-old-summary-rejected'])}),check('checkpoint.export-custody','preDeliveryCheckpointExportCustody','preDeliveryCheckpointExportCustody',true,'exact export evidence current checkpoint custody'),negative('checkpoint.fabricated','fabricatedCheckpointRejected','fabricatedCheckpointRejected','inOriginDuplicateTreatedAsExternalBackup','fabricated current backup custody rejected'),negative('checkpoint.generic-evidence','genericExportEvidenceRejected','genericExportEvidenceRejected','inOriginDuplicateTreatedAsExternalBackup','generic evidence is not exact export action'),check('checkpoint.current-set','stage29CurrentSetValidated','stage29CurrentSetValidated',true,'exact current Stage 29 set'),negative('checkpoint.stale-weak','staleAndWeakEvidenceRejected','staleAndWeakEvidenceRejected','historicalScopeSatisfyingCurrentGates','stale/weak export evidence rejected')]},
  'verify-stage30-terminal-mobile-boundary.mjs':{boundary:'actual terminal/attempt authorization and mobile submission validators; physical device remains separately required',checks:[check('terminal.exact-record-preimage','stage30TerminalMobileBoundary','verificationObservations',undefined,'Independent exact terminal record SHA and mutated dependency rejection',{expectedDescription:'Exact full chain terminal preimage digest matches independently; old summary and changed release dependency reject transfer',condition:emittedCases(['terminal-exact-record-preimage-sha256','terminal-summary-or-mutated-dependency-rejected'])}),check('terminal.application-command','stage30TerminalMobileBoundary','terminalCalculationApplicationOwned',true,'application command controls terminal'),check('terminal.idempotent','stage30TerminalMobileBoundary','terminalRetryIdempotent',true,'Exact CALCULATE_TERMINAL retry must be idempotent.'),negative('terminal.blocked-export','stage30TerminalMobileBoundary','blockedTerminalRecorded','unsafeExternalActionWithoutAuthorization','A BLOCKED terminal record must never authorize export/share.'),negative('delivery.no-attempt-evidence','stage30TerminalMobileBoundary','deliveryEvidenceDistinct','authorizationRepresentedAsCompletedDelivery','Delivery completion evidence requires a real prior delivery attempt.'),check('terminal.operator-action','stage30TerminalMobileBoundary','authorizedExportOperatorAction',true,'authorized exact artifact export/share command')]},
  'verify-deployment-manifest.mjs':{sourceInputs:['test-deployment-contract-identities.mjs','deployment-contract-identities.mjs','verified-site.mjs','build-static-site.mjs'],boundary:'actual deterministic site generation and exact manifest/resource digest/worker binding validation',checks:[check('deployment.registry-identities','deploymentManifest','registryIdentityRegression',undefined,'Actual built registry identity projection and exact artifact validation, including former omission and untrusted artifact owner controls',{expectedDescription:'All26 independently listed controls; all seven registry families and TestIR identities, actual build with no deployment/browser/device claim',condition:(value,report)=>report.deploymentManifest==='PASS'&&value?.passed===true&&exactNamedCases(value.cases,deploymentRegistryCases)&&value.actualBuiltArtifact===true&&value.actualDeployment===false&&value.actualBrowser===false&&value.actualPhysicalDevice===false}),check('deployment.canonical-origin','deploymentManifest','canonicalOrigin','https://sjonesjones917.github.io','canonical deployment origin'),check('deployment.canonical-path','deploymentManifest','canonicalBasePath','/closed-loop-tracker/','canonical deployment base path'),check('deployment.reproducible','deploymentManifest','reproducible',true,'deterministic generated site manifest'),check('deployment.worker-byte-identity','deploymentManifest','workerResultByteIdentityBound',true,'worker execution receipt actual byte/build identity'),negative('deployment.governance-excluded','deploymentManifest','repositoryGovernanceExcludedFromRuntime','runtimeProjectCopiesOfSpecificationText','controlling specification/controller not runtime resources')]},
  'verify-executed-evidence.mjs':{boundary:'real executed receipt producer and metric/negative-population consumer',checks:[check('receipts.active-fixture-inputs','activeFixtureFingerprintInputs','activeFixtureFingerprintControl',undefined,'Actual reused Stage03 producer receipt binds the actively consumed maintained legacy fixture while tracked or untracked',{expectedDescription:'All four current declared fixture bytes independently invalidate the actual receipt; missing bytes and catalogue paths fail and exact restoration admits',condition:value=>value?.result==='PASS'&&value.actualProducerReceiptReused===true&&value.formerUntrackedFixtureOmissionReproduced===true&&exactNamedCases(value.declaredSourcePaths,activeFixtureSourcePaths)&&Array.isArray(value.sourceCases)&&value.sourceCases.length===activeFixtureSourcePaths.length&&activeFixtureSourcePaths.every(file=>value.sourceCases.filter(row=>row.file===file).length===1&&value.sourceCases.some(row=>row.file===file&&['actualByteHashBound','changedBytesRejectActualReceipt','missingBytesFailHonestly','untrackedBytesBound','untrackedMutationRejectsActualReceipt','exactRestoreAdmitsActualReceipt'].every(key=>row[key]===true)))&&exactRows(value.fixtureCatalogMutations,[...activeFixtureSourcePaths.map(file=>({file,mutation:'missing-path',result:'DETECTED'})),{file:'verification/unknown-fixture.json',mutation:'changed-path',result:'DETECTED'}])}),check('receipts.approved-governance-input-observation','governanceFingerprintInputs','verificationObservations',undefined,'Actual named approved governance source-byte assertion owner',{expectedDescription:'The actual source-byte/freshness assertion is emitted once by its executed receipt owner',condition:rows=>emittedCases(['APPROVED-GOVERNANCE-SOURCE-BYTES'])(rows)&&['expected','observed'].every(member=>{const value=rows.find(row=>row.checkId==='APPROVED-GOVERNANCE-SOURCE-BYTES')[member],keys=['actualGovernanceByteHashBound','changedBytesRejectActualReceipt','missingBytesFailHonestly','untrackedBytesBound','untrackedMutationRejectsActualReceipt','exactRestoreAdmitsActualReceipt','formerMarkdownOmissionReproduced'];return value&&Object.keys(value).length===keys.length&&keys.every(key=>value[key]===true);})}),check('receipts.approved-governance-inputs','executedEvidenceProtection','governanceFingerprintControl',undefined,'Actual reused Stage03 producer receipt invalidates after tracked/untracked approved source-byte changes; exact restoration and missing-byte controls',{expectedDescription:'Every active declared approval JSON/proposal MD is bound before and after commit; changed or missing bytes never reuse actual stale evidence',condition:value=>value?.result==='PASS'&&value.actualProducerReceiptReused===true&&value.formerMarkdownOmissionReproduced===true&&Array.isArray(value.declaredSourcePaths)&&value.declaredSourcePaths.length>=2&&value.declaredSourcePaths.some(file=>file.endsWith('.md'))&&value.declaredSourcePaths.some(file=>file.endsWith('.json'))&&Array.isArray(value.sourceCases)&&value.sourceCases.length===value.declaredSourcePaths.length&&value.declaredSourcePaths.every(file=>value.sourceCases.filter(row=>row.file===file).length===1&&value.sourceCases.some(row=>row.file===file&&['actualByteHashBound','changedBytesRejectActualReceipt','missingBytesFailHonestly','untrackedBytesBound','untrackedMutationRejectsActualReceipt','exactRestoreAdmitsActualReceipt'].every(key=>row[key]===true)))}),check('receipts.syntax-population','executedEvidenceProtection','syntaxChecksDoNotClaimExecution',true,'Actual Node --check parser status propagates without fabricated verifier execution receipt'),check('receipts.fail-closed','executedEvidenceProtection','producerViolationsRejected',true,'actual producer absent/failed/stale/duplicate controls'),negative('metrics.no-vacuous-success','executedEvidenceProtection','emptyUniverseRejected','vacuous100Metrics','empty denominator rejected at aggregation boundary')]}
};
const metrics=(metricId,checkIds,universeDefinition)=>({metricId,checkIds,universeDefinition,scopeLimit});
export const metricCatalog={
  exactReqRunTestCoverage:metrics('REQ_RUN_TEST_COVERAGE',['matrix.exact-triples'],'Every independently authored current fixture requirement x actual current reserved run x applicable authored per-run test tuple, compared with actual accepted verification identity; exact tuple IDs and explicit excluded test reasons emitted by the owner.'),
  currentScopeSelectorCoverage:metrics('CURRENT_SCOPE_SELECTOR_COVERAGE',['ingestion.scope-negative-population'],'Exact currently populated scope dimension rejection matrix emitted by actual ingestion; each named stale identity must reject with no accepted change.'),
  applicableCurrentRegressionSuccess:metrics('APPLICABLE_CURRENT_REGRESSION_SUCCESS',['regression.current-closure','regression.corrected-ten','regression.unchanged-ten'],'Current/stale regression adjudication and exact corrected/unchanged ten-run journeys.'),
  mandatoryEvidenceChainCoverage:metrics('MANDATORY_EVIDENCE_CHAIN_STRUCTURAL_COVERAGE',['evidence.current-chains','evidence.missing-chain','checkpoint.current-set','checkpoint.full-chain-digest'],'Actual current chain construction, missing-link rejection and current-set checkpoint validation.'),
  releaseArtifactIdentityCoverage:metrics('RELEASE_ARTIFACT_IDENTITY_COVERAGE',['artifact.byte-rehash','artifact.exact-candidate','artifact.order-independent','artifact.semantic-drift','artifact.scope-drift'],'Exact current release/candidate mapping, actual byte rehash, stable order and drift rejection controls.'),
  mandatoryEvidenceSufficiencyCoverage:metrics('MANDATORY_EVIDENCE_SUFFICIENCY_COVERAGE',['evidence.byte-authority','evidence.meaning-comparison','evidence.human-owned','evidence.contradiction'],'Deterministic enforcement of byte, meaning-evidence and human-owned-evidence classes with unsupported/contradictory negative controls; semantic correctness of a real answer remains separate.'),
  contractProfileMigrationCoverage:metrics('CONTRACT_PROFILE_MIGRATION_COVERAGE',['migration.current-profile','migration.unknown-preserved','migration.idempotent','migration.no-silent-heal'],'Supported /2 to /3 current profile migration, preservation, idempotency and invalid-current-state rejection.'),
  fieldRegistryCoverage:metrics('FIELD_REGISTRY_COVERAGE',['registry.fields'],'Every independently enumerated current Job/stage/record/nested declaration equals its exported field registry entry; exact IDs are in the executed registry receipt.'),
  stageOperationRegistryCoverage:metrics('STAGE_OPERATION_REGISTRY_COVERAGE',['registry.operations'],'All current registered stage-operation contracts declare required properties and exact registry scope bindings.'),
  stageOperationScopeMatrixCoverage:metrics('STAGE_OPERATION_SCOPE_MATRIX_COVERAGE',['registry.scopes','ingestion.scope-negative-population'],'All current operation-scope entries and exact stale populated scope rejection cases.'),
  durableObjectRegistryCoverage:metrics('DURABLE_OBJECT_REGISTRY_COVERAGE',['registry.durable'],'Exact current canonical family declaration-to-durable registry closure.'),
  fileFirstResponseByteCaptureCoverage:metrics('FILE_FIRST_RESPONSE_BYTE_CAPTURE_COVERAGE',['response.file-selection','response.byte-rehash-wiring','ingestion.raw-reload','response.retry-byte-custody','response.returned-slot-controls'],'Exact emitted file-first contract/readback wiring, actual lossless raw proposal/reload, committed replacement ZIP prior bytes and real corrected stored/rehashed Blob retry; private transaction adapter, browser IndexedDB implementation acceptance remains separate.'),
  semanticReviewIndependenceCoverage:metrics('SEMANTIC_REVIEW_INDEPENDENCE_COVERAGE',['review.context-authority','review.self-asserted'],'Application-observable current context independence and rejection of self-asserted review identity. Independent semantic judgment itself is not inferred.'),
  testIrDagAndRegistryIdentityCoverage:metrics('TEST_IR_DAG_AND_REGISTRY_IDENTITY_COVERAGE',['dag.explicit','dag.typed-ports','dag.forward-reference','dag.legacy-compile','test-ir.unknown-operation','deployment.worker-byte-identity'],'Explicit compiled DAG/typed operand selection, unsupported operation rejection and exact worker receipt identity.'),
  closedMetricUniverseCoverage:metrics('CLOSED_METRIC_UNIVERSE_COVERAGE',['receipts.syntax-population','receipts.fail-closed','metrics.no-vacuous-success'],'Actual producer/aggregation boundary rejects missing/stale/duplicate/failed observations and empty universes.'),
  deliveryCandidateIdentityCoverage:metrics('DELIVERY_CANDIDATE_IDENTITY_COVERAGE',['artifact.exact-candidate','artifact.semantic-drift','artifact.scope-drift','candidate.full-cycle-identity'],'Exact current Stage 25/28 candidate binding and drift controls.'),
  terminalCommandPrerequisiteCoverage:metrics('TERMINAL_COMMAND_PREREQUISITE_COVERAGE',['terminal.application-command','terminal.idempotent','terminal.blocked-export','terminal.operator-action','terminal.exact-record-preimage'],'Application terminal command, idempotent exact retries, blocked export guard and explicit authorized operator path.'),
  preDeliveryCheckpointCoverage:metrics('PRE_DELIVERY_CHECKPOINT_COVERAGE',['checkpoint.export-custody','checkpoint.fabricated','checkpoint.generic-evidence','checkpoint.stale-weak'],'Exact current checkpoint export custody with fabricated/generic/stale/weak rejection controls.'),
  destinationBoundAuthorizationCoverage:metrics('DESTINATION_BOUND_AUTHORIZATION_COVERAGE',['intent.destination-bound','intent.timed-validity','intent.duplicate-blocked','intent.not-delivery'],'Current exact destination/time/count-bound intent and distinction between authorization and performed delivery.'),
  canonicalDeploymentOriginCoverage:metrics('CANONICAL_DEPLOYMENT_ORIGIN_COVERAGE',['deployment.canonical-origin','deployment.canonical-path','deployment.reproducible'],'Exact supported deployment origin/base path and generated resource identity. Current hosted byte observation remains the separate verify-live gate.')
};
const stage01OmissionCategories=['QUALIFIERS','EXCEPTIONS','DEPENDENCIES','NEGATIVE_REQUIREMENTS','DO_NOT_CHANGE','VISUAL_CONSTRAINTS','TEMPORAL_CONSTRAINTS','ACCEPTANCE_CONDITIONS','AUTHORITY_STATEMENTS','TOOL_RESTRICTIONS','FILE_REFERENCES','OUTPUT_FORMAT_REQUIREMENTS','CORRECTIONS','LATER_OVERRIDES'];
const stage01AdmissionCases=['pass1-incomplete','pass2-incomplete','omissions-unresolved','duplicate-category','unknown-category','omitted-unit','duplicate-unit','unknown-unit','wrong-unit-hash','wrong-input-version','wrong-manifest','unknown-disposition','inaccessible-required-content',...stage01OmissionCategories.map(value=>'omitted-category-'+value)];
const stage01GateCases=['missing-confirmation','wrong-confirmation-input','wrong-confirmation-change','blank-objective','missing-objective'];
function completeStage01SourceControls(rows,report){
 const population={authorOperations:2,omissionCategories:14,dispositions:6,admissionNegatives:27,gateNegatives:5,conformingComplete:1,carrierFaults:4};
 if(report.stage01SpecificationControls!=='PASS'||report.synthetic!==true||report.actualBrowser!==false||report.realExternalActor!==false||!emittedCases(['STAGE01-SPECIFICATION-CONTRACT-CONTROLS'])(rows)||!['expected','observed'].every(key=>exactLiteralFields(rows.find(row=>row.checkId==='STAGE01-SPECIFICATION-CONTRACT-CONTROLS')[key],population)))return false;
 if(!Array.isArray(report.packages)||report.packages.length!==2||!['COMPLETE','RECONCILE_INTAKE'].every(operation=>report.packages.filter(row=>row.operation===operation).length===1&&report.packages.some(row=>row.operation===operation&&row.actualSavedZip===true&&row.exactInstructionBytes===true&&row.categoryCount===14&&row.dispositionCount===6)))return false;
 if(!Array.isArray(report.observations)||report.observations.length!==33||new Set(report.observations.map(row=>row.caseId)).size!==33)return false;
 if(!stage01AdmissionCases.every(id=>report.observations.some(row=>row.caseId===id&&row.expectedCode==='INCOMPLETE_INTAKE_ACCOUNTING'&&row.actualCodes.includes('INCOMPLETE_INTAKE_ACCOUNTING')&&row.accepted===false&&row.canonicalChanges===0&&row.rawPreserved===true&&row.stageComplete===false)))return false;
 if(!stage01GateCases.every(id=>report.observations.some(row=>row.caseId===id&&row.expectedComplete===false&&row.actualComplete===false&&row.gateReasonFound===true&&row.syntheticCorruptionProjection===true)))return false;
 if(!report.observations.some(row=>row.caseId==='conforming-current-intent'&&['authoritativeFile','operatorAccepted','currentConfirmation','stageComplete'].every(key=>row[key]===true)))return false;
 return Array.isArray(report.faults)&&report.faults.length===4&&['COMPLETE','RECONCILE_INTAKE'].every(operation=>['missing-category','unresolved-omissions'].every(name=>report.faults.filter(row=>row.operation===operation&&row.name===name).length===1&&report.faults.some(row=>row.operation===operation&&row.name===name&&row.intendedFailure===(name==='missing-category'?'STAGE01_SPEC_CATEGORIES_ORACLE':'STAGE01_SPEC_RESOLUTION_ORACLE'))));
}
verificationCatalog['verify-stage01-agent-contract-alignment.mjs'].checks.push(check('stage01.specification-controls','stage01SpecificationControls','verificationObservations',undefined,'Actual saved author ZIP + raw file admission + confirmation gate with independent literal specification populations',{expectedDescription:'Two exact author ZIPs,27 admission negatives,5 gate negatives,one conforming accepted/current confirmation and4 intended carrier faults',condition:completeStage01SourceControls}));
// Proposed addition to verification-evidence-catalog.mjs; literal expectations from controlling Sections14.6/37 plus32.4A.
const declaredStageOperations={
  "2": [
    "COMPLETE",
    "SEARCH_ADEQUACY_REVIEW",
    "RECONCILE_SOURCE_SEARCH"
  ],
  "3": [
    "COMPLETE",
    "SEMANTIC_CHALLENGE",
    "RECONCILE_RESEARCH"
  ],
  "4": [
    "COMPLETE",
    "DISPOSITION_CHALLENGE",
    "ATOMICITY_CHALLENGE",
    "RECONCILE_REQUIREMENTS"
  ],
  "5": [
    "COMPLETE",
    "SEMANTIC_REVIEW",
    "RECONCILE_REQUIREMENT_SET"
  ],
  "6": [
    "COMPLETE",
    "PROOF_REVIEW",
    "RECONCILE_VERIFICATION_SUITE"
  ],
  "7": [
    "COMPLETE",
    "EXECUTE_FAILURE_TEST"
  ],
  "8": [
    "COMPLETE"
  ],
  "9": [
    "COMPLETE"
  ],
  "10": [
    "FREEZE"
  ],
  "11": [
    "EXECUTE_RUN"
  ],
  "12": [
    "VERIFY"
  ],
  "13": [
    "COMPARE"
  ],
  "14": [
    "ROOT_CAUSE"
  ],
  "15": [
    "COMPLETE",
    "EXECUTE_REGRESSION"
  ],
  "16": [
    "CORRECT"
  ],
  "17": [
    "FREEZE",
    "EXECUTE_RUN",
    "VERIFY",
    "COMPARE",
    "ROOT_CAUSE",
    "REGRESSION",
    "CORRECT"
  ],
  "18": [
    "COMPLETE"
  ],
  "19": [
    "CONFIRM_FREEZE",
    "EXECUTE_RUN",
    "VERIFY",
    "COMPARE",
    "REGRESSION_VERIFY",
    "CONFIRM"
  ],
  "20": [
    "FREEZE_BASELINE"
  ],
  "21": [
    "COMPLETE"
  ],
  "22": [
    "RUN_NATIVE_TESTS",
    "EXECUTE_EXTERNAL_TEST"
  ],
  "23": [
    "COMPLETE"
  ],
  "24": [
    "RUN_NATIVE_ATTACKS",
    "COMPLETE"
  ],
  "25": [
    "FREEZE_DELIVERY_CANDIDATE",
    "COMPLETE"
  ],
  "26": [
    "COMPLETE",
    "SEMANTIC_REVIEW",
    "RECONCILE"
  ],
  "27": [
    "CALCULATE_RELEASE",
    "ADVISORY_REVIEW"
  ],
  "28": [
    "VERIFY_IDENTITY",
    "CAPTURE_DELIVERY_INTENT"
  ],
  "29": [
    "CALCULATE_EVIDENCE_CHAINS",
    "INVESTIGATE_MISSING_EVIDENCE"
  ],
  "30": [
    "CALCULATE_TERMINAL",
    "EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS",
    "RECORD_DELIVERY_EVIDENCE"
  ]
};
const exactDeclaredStrings=(actual,expected)=>Array.isArray(actual)&&actual.length===expected.length&&actual.every((value,index)=>typeof value==='string'&&value===expected[index]);
verificationCatalog['verify-stage-operation-registry.mjs']={emittedEvidenceBasis:'EXECUTED_SCHEMA_METADATA_ASSERTIONS',boundary:'Exact canonical stage-operation declaration membership only; ordinary literal specification lists plus approved conditional owners7/15. No operation execution, admission, gate or external-agent behavior claim.',checks:Object.entries(declaredStageOperations).map(([stageKey,ordinary])=>{
 const stage=Number(stageKey),conditional=[...(stage>7?['EXECUTE_FAILURE_TEST']:[]),...(stage>15?['EXECUTE_REGRESSION']:[])],all=[...ordinary,...conditional],caseId=`stage-registry.stage${stageKey.padStart(2,'0')}.exact-membership`,id=`declaration.stage${stageKey.padStart(2,'0')}.operations`;
 return check(id,'stageOperationRegistry','verificationObservations',undefined,`verify-stage-operation-registry.mjs: independent literal Stage${stageKey} declaration assertions`,{basis:'EXECUTED_SCHEMA_METADATA_ASSERTIONS',expectedDescription:`Exact Stage${stageKey} operation membership in canonical registry, stage operations and stage contract`,condition:rows=>{
  if(!Array.isArray(rows)||rows.length!==29||rows.filter(row=>row?.checkId===caseId).length!==1)return false;const row=rows.find(row=>row?.checkId===caseId);
  return row.passed===true&&row.stage===stage&&exactDeclaredStrings(row.expected?.ordinaryOperations,ordinary)&&exactDeclaredStrings(row.expected?.conditionalOperations,conditional)&&exactDeclaredStrings(row.expected?.allOperations,all)&&exactDeclaredStrings(row.observed?.stageOperations,all)&&exactDeclaredStrings(row.observed?.stageContractOperations,all)&&exactDeclaredStrings(row.observed?.registeredOperations,[...all].sort());
 }});
})};
verificationCatalog['verify-stage-contract-closure.mjs']={emittedEvidenceBasis:'EXECUTED_SCHEMA_METADATA_ASSERTIONS',boundary:'Exact workbook Stage30 title and role declarations only; no terminal behavior or delivery claim.',checks:[
 ['stage-name','PRESERVE FAILURES PERMANENTLY AND CLOSE DELIVERY'],['role','Permanent defect-registry and terminal-delivery custodian']
].map(([field,literal])=>{const caseId='stage-contract.stage30.'+field,id='declaration.stage30.'+(field==='stage-name'?'title':'role');return check(id,'stageContractClosure','verificationObservations',undefined,'verify-stage-contract-closure.mjs: exact literal Stage30 '+field,{basis:'EXECUTED_SCHEMA_METADATA_ASSERTIONS',expectedDescription:'Exact Stage30 '+field+' declaration',condition:rows=>Array.isArray(rows)&&rows.length===2&&rows.filter(row=>row?.checkId===caseId).length===1&&rows.some(row=>row?.checkId===caseId&&row.stage===30&&row.passed===true&&row.expected===literal&&row.observed===literal)});})};

// Exact existing negativeAt assertions now have stable individual proof links.
const publishedIngestionNegatives=[{"id":"ingestion.invalid.malformed-JSON","name":"malformed JSON","code":"MALFORMED_JSON"},{"id":"ingestion.invalid.truncated-JSON","name":"truncated JSON","code":"TRUNCATED_RESPONSE"},{"id":"ingestion.invalid.markdown-wrapped","name":"markdown wrapped","code":"NON_JSON_WRAPPER"},{"id":"ingestion.invalid.oversized-response","name":"oversized response","code":"OVERSIZED_RESPONSE"},{"id":"ingestion.invalid.duplicate-JSON-member","name":"duplicate JSON member","code":"DUPLICATE_JSON_MEMBER"},{"id":"ingestion.invalid.wrong-root-type","name":"wrong root type","code":"INVALID_ROOT"},{"id":"ingestion.invalid.unknown-top-level-property","name":"unknown top-level property","code":"UNKNOWN_PROPERTY"},{"id":"ingestion.invalid.wrong-stage","name":"wrong stage","code":"WRONG_STAGE"},{"id":"ingestion.invalid.wrong-operation","name":"wrong operation","code":"WRONG_OPERATION"},{"id":"ingestion.invalid.stale-prompt-id","name":"stale prompt id","code":"STALE_PROMPT_IDENTITY"},{"id":"ingestion.invalid.stale-contract-hash","name":"stale contract hash","code":"STALE_CONTRACT_HASH"},{"id":"ingestion.invalid.stale-context-signature","name":"stale context signature","code":"STALE_CONTEXT_SIGNATURE"},{"id":"ingestion.invalid.unresolved-relationship","name":"unresolved relationship","code":"UNRESOLVED_RELATIONSHIP"},{"id":"ingestion.invalid.wrong-relationship-cardinality","name":"wrong relationship cardinality","code":"INVALID_RELATIONSHIP_REFERENCE"}];
for(const expected of publishedIngestionNegatives)verificationCatalog['verify-ingestion.mjs'].checks.push(check(expected.id,'scopeIdentityMatrix','negativeObservations',undefined,'verify-ingestion.mjs: negativeAt '+expected.name,{expectedDescription:'Exact current negativeAt case rejects atomically with the specified diagnostic',condition:rows=>Array.isArray(rows)&&rows.filter(row=>row.name===expected.name).length===1&&rows.some(row=>row.name===expected.name&&row.checkId===expected.id&&row.expectedCode===expected.code&&Array.isArray(row.observedCodes)&&row.observedCodes.includes(expected.code)&&row.accepted===false&&row.acceptedChanges===0)}));
const canonicalSerializationIds=['canonical.safe-integer-and-typed-string','canonical.unsigned-scalar-key-order','canonical.ordered-arrays','canonical.exact-string-scalars-and-lines','canonical.exact-json-escapes','canonical.printable-nonascii-unescaped','canonical.prohibited-values-rejected'];
verificationCatalog['verify-hash.mjs']={sourceInputs:['workbook.js','workflow-schema.js'],boundary:'Actual canonical serializer against independently declared exact text/value and rejection controls.',checks:[check('canonical.registered-set-semantics','sha256Vectors','registeredSetSemantics',true,'Actual registered TEST_HASH /members canonical set equality and duplicate identity refusal'),check('canonical.exact-serialization-controls','sha256Vectors','verificationObservations',undefined,'Seven exact canonical serialization source clauses',{expectedDescription:'Every exact named serialization assertion is present and passes',condition:emittedCases(canonicalSerializationIds)})]};
verificationCatalog['verify-test-runtime-v3.mjs'].checks.push(check('test-ir.exact-integer-boundary-population','verifyTestRuntimeV3','verificationObservations',undefined,'Independent finite exact integer operations and overflow/type rejection controls',{expectedDescription:'Six literal conforming and six precise rejection cases plus restored control',condition:rows=>emittedCases(['test-ir.exact-integer-boundaries'])(rows)&&exactLiteralFields(rows.find(row=>row.checkId==='test-ir.exact-integer-boundaries').observed,{conforming:6,rejected:6,restoredControl:true})}));
verificationCatalog['verify-recoverable-history.mjs'].checks.push(check('store.cas-stale-write-population','synthetic','verificationObservations',undefined,'Exact before/after canonical state and retained history at actual stale revision rejection',{expectedDescription:'Stale write rejects; canonical state/history unchanged; newer control succeeds',condition:rows=>emittedCases(['store.cas-stale-write-isolation'])(rows)&&exactLiteralFields(rows.find(row=>row.checkId==='store.cas-stale-write-isolation').observed,{staleRevisionRejected:true,canonicalStateUnchanged:true,historyUnchanged:true,newerRevisionRestored:true})}));
verificationCatalog['verify-v3-migration.mjs'].sourceInputs=['test-migration-source-retention.mjs','test-project-store-runtime.mjs','verifier-runtime.mjs','project-store.js','workbook.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','hash.js'];
verificationCatalog['verify-v3-migration.mjs'].checks.push(check('migration.source-byte-preservation','verifyV3Migration','sourceBytePreservation',undefined,'Actual legacy/package original source bytes, production transaction adapter, recovery and handoff isolation',{expectedDescription:'All31 named source-retention controls and six intended owning faults; exact stored source population, valid restoration and explicitly synthetic nonbrowser scope',condition:completeMigrationSourceBytes}));
// Named scoped observations retain their actual default producer and boundary.
verificationCatalog['verify-verification-routing.mjs'].sourceInputs=['app-core.js','workflow-engine.js','workflow-schema.js','test-runtime.js','test-worker.js','project-store.js','verifier-runtime.mjs','test-project-store-runtime.mjs'];
verificationCatalog['verify-verification-routing.mjs'].checks.push(check('stage-semantic.native-stage22-all-ready-batch','verificationRouting','verificationObservations',undefined,'Actual extracted UI all-ready native batch, real isolated worker, canonical result/store and retry',{expectedDescription:'Exactly two ready native outcomes; future and external excluded; first-only fault detected; full default routing suite required',condition:completeNativeStage22Batch}));
verificationCatalog['verify-full-cycle.mjs'].sourceInputs=['test-stage29-investigation.mjs','test-fixtures.mjs','workflow-engine.js','workflow-schema.js','prompt-engine.js','response-ingestion.js','project-store.js','test-project-store-runtime.mjs'];
verificationCatalog['verify-full-cycle.mjs'].checks.push(check('stage-semantic.stage29.investigation.admission-and-authority','stagesCompleted','verificationObservations',undefined,'Actual accepted synthetic lifecycle through Stage28 then generated investigation response/commit/retry',{expectedDescription:'Genuine default prefix; exact stored response/instruction identity; investigation progresses without an agent-owned evidence chain or false stage completion',condition:completeStage29Investigation}));
verificationCatalog['verify-stage29-evidence-chain-checkpoint.mjs'].sourceInputs=['workflow-engine.js','workflow-schema.js','hash.js','workbook.js'];
verificationCatalog['verify-stage29-evidence-chain-checkpoint.mjs'].checks.push(check('stage-semantic.stage29.application-construction-from-empty','stage29CurrentSetValidated','verificationObservations',undefined,'Application evidence-chain command from zero records selects the exact canonical fixture identities',{expectedDescription:'REQ/SRC/trace-selected instruction/distinct execution and product identities and application derivation provenance; no sufficiency or stage-completion inference',condition:(rows,report)=>report.stage29ApplicationCommand===true&&exactObservationFacts(oneObservation(rows,'stage29.application-construction-from-empty'),{stage:29,source:'APPLICATION_DERIVATION',derivationKey:'stage29.evidenceChains',requirementId:'REQ-1',authorityId:'SRC-1',instructionId:'INSTR-1',executionId:'EXEC-1',productId:'PROD-1'})}));
verificationCatalog['verify-production-baseline-authority.mjs'].sourceInputs=['workflow-engine.js','workflow-schema.js','project-store.js','response-ingestion.js','prompt-engine.js','stage19-fixture.mjs','app-core.js'];
verificationCatalog['verify-production-baseline-authority.mjs'].checks.push(check('stage-semantic.stage20.registered-authorization-consumed','productionBaselineAuthority','verificationObservations',undefined,'Application registered SELF_ASSERTED decision consumed by exact unchanged-confirmed baseline candidate',{expectedDescription:'Exact decision/purpose/assurance/candidate/iteration reference and zero external envelopes; all seven authority negatives and unchanged-state controls remain required',condition:completeStage20Authorization}));
verificationCatalog['verify-cross-run-comparison.mjs']={boundary:'Actual synthetic Stage13 comparison/stability and current-scope mutation owners; exact ten-run arithmetic and independent defect counts; no real-agent, browser or physical acceptance.',sourceInputs:['workflow-engine.js','workflow-schema.js','response-ingestion.js','prompt-engine.js','app-core.js','workbook.js','hash.js','test-fixtures.mjs','test-artifact-fixtures.mjs','verifier-runtime.mjs','verify-conformance-regressions.mjs','operator-journey-fixtures.mjs','test-stage13-projection-recovery.mjs','test-project-store-runtime.mjs','project-store.js','verification/deferred-definition-compatibility-legacy-fixture-20261005.json'],checks:[
 check('stage-semantic.stage13.application-defect-stability-aggregates','crossRunComparison','verificationObservations',undefined,'Exact Stage13 ten-run agreement and distinct/repeated/unique/per-run defect arithmetic',{expectedDescription:'10/10 and9/10 agreements;4 defect records,2 repeated occurrences,1 repeated pattern and2 unique; current complete producer invariants',condition:completeComparisonAggregates}),
 check('stage-semantic.stage13.comparison-fault-population','childBoundSeconds','faults',undefined,'All28 independently named owning mutations fail at their exact oracle and unchanged control returns to success',{expectedDescription:'Exactly28 failed mutation children and one restored successful control, bounded by original supervisor and unchanged source',condition:completeComparisonFaults})
]};
verificationCatalog['verify-cross-run-comparison.mjs'].checks.push(check('stage-semantic.stage13.old-group-projection-recovery','stage13ProjectionRecovery','verificationObservations',undefined,'Actual former-owner projection write/checkpoint, current refresh/reload and History invalidation with exact source and metric-input preservation',{expectedDescription:'Former groups2 becomes current group1 while occurrences2 persist; old raw/checkpoint retained; new revision; restored History honestly blocked at7 and clears cached13; exact five corruption/type negatives',condition:completeStage13Recovery}));
verificationCatalog['verify-ingestion.mjs'].sourceInputs=[...new Set([...(verificationCatalog['verify-ingestion.mjs'].sourceInputs||[]),'test-response-type-boundaries.mjs','verification/stage01-retained-capture-legacy-fixture-20261005.json','app-core.js','test-project-store-runtime.mjs','verifier-runtime.mjs','test-fixtures.mjs','test-zip.mjs','operator-journey-fixtures.mjs','workflow-schema.js','workflow-engine.js','response-ingestion.js','prompt-engine.js','project-store.js','workbook.js','hash.js'])];
verificationCatalog['verify-ingestion.mjs'].checks.push(check('admission-contract.response.nested-type-safety','nestedResponseTypeSafety','verificationObservations',undefined,'Exact staged-response nested-type rejections, four conforming controls, retained invalid raw bytes and owning pre-fix coercion reproduction',{expectedDescription:'All74 typed negatives (60 envelope and14 record),4 conforming controls, durable invalid diagnostic reload and opaque JSON preservation; synthetic transaction adapter, no browser or real-agent claim',condition:(rows,report)=>report.nestedResponseTypeSafety==='PASS'&&report.cases===60&&report.recordCases===14&&report.preFixEquivalentDetected===true&&typeof report.sourceSha256==='string'&&/^[a-f0-9]{64}$/.test(report.sourceSha256)&&exactObservationFacts(oneObservation(rows,'response.nested-type-safety'),{negativeCases:74,conformingControls:4,durableInvalid:true,opaqueStructuredValueRetained:true})}));
verificationCatalog['verify-response-authority-integrity.mjs'].checks.push(check('admission-contract.response.closed-family-boundary','responseAuthorityIntegrity','verificationObservations',undefined,'Blind Stage23/24 and ordinary Stage4 closed record-family admission before semantic remapping',{expectedDescription:'All15 inherited-family and malformed target-family rejections:10 blind and5 ordinary, exact raw preservation and no proposal; synthetic canonical prerequisites and in-memory transport only',condition:(rows,report)=>report.responseAuthorityIntegrity==='PASS'&&report.syntheticCanonicalContexts===true&&report.productionPromptAndIngestion===true&&report.failed===0&&exactObservationFacts(oneObservation(rows,'RESPONSE-CLOSED-FAMILY-BOUNDARY'),{rejected:15,blindRejected:10,ordinaryRejected:5,rawPreserved:true,noProposal:true})}));
verificationCatalog['verify-semantic-invariant.mjs'].sourceInputs=['workflow-schema.js','workflow-engine.js','workbook.js','hash.js','response-ingestion.js','prompt-engine.js','test-runtime.js','project-store.js','test-fixtures.mjs','test-artifact-fixtures.mjs','test-project-store-runtime.mjs','verifier-runtime.mjs'];
for(const definition of typedAdmissionChecks){
 const suite=definition.id==='admission-contract.stage25.observation-effective-types'?'verify-semantic-invariant.mjs':'verify-ingestion.mjs';
 verificationCatalog[suite].checks.push(check(definition.id,definition.marker||'verificationObservations','verificationObservations',undefined,'Exact named typed-boundary assertions with conforming controls and retained raw/continuation semantics',{expectedDescription:'Exact declared expected and observed facts, finite case membership, and owning fault/detail controls; synthetic actor and transaction adapter, no browser or release claim',condition:(rows,report)=>completeTypedAdmission(definition,rows,report)}));
}
const representationSemanticCases=typedAdmissionChecks.find(row=>row.id==='admission-contract.stage25.observation-effective-types').caseIds;
Object.assign(verificationCatalog['verify-semantic-invariant.mjs'].checks.find(row=>row.id==='stage25.explicit-coverage-inventories'),{expectedDescription:'All64 named inventory/effective-determination controls, including the original29; only explicit full and empty controls satisfy; inventory guard fault detected',condition:(rows,report)=>report.semanticFalseAcceptanceInvariant===true&&report.inventoryGuardFaultDetected===true&&Array.isArray(rows)&&exactNamedCases(rows.map(row=>row?.caseId),representationSemanticCases)&&rows.every(row=>{const valid=['explicit-full-coverage','explicit-empty-classes'].includes(row.caseId);return row.expectedValid===valid&&row.aggregateComplete===valid&&row.effectiveDetermination===(valid?'SATISFIED':'UNDETERMINED');})});
verificationCatalog['verify-cross-run-comparison.mjs'].checks.push(check('stage-semantic.scheduled-iteration-frontiers','scheduledIterationControls','observations',undefined,'Literal due-frontier and future-registration controls through actual shared comparison/gate/iteration owners',{expectedDescription:'Seven exact canonical-fixture cases and four invalid iteration-owner controls; future registrations never count as successful; no full actor lifecycle claim',condition:completeScheduledIterations}));
verificationCatalog['verify-v3-migration.mjs'].sourceInputs.push('test-canonical-field-integrity.mjs','test-specification-field-registry.mjs','test-handoff-authorization.mjs');
verificationCatalog['verify-v3-migration.mjs'].checks.push(check('store.canonical-scalar-type-boundaries','verifyV3Migration','canonicalFieldIntegrity',undefined,'Actual store write/read/export/import and exact finite known canonical field population',{expectedDescription:'44 job and458 stage fields across four partitions;1876 named wrong-type negatives; ten atomic write cases and conforming nullable/verbatim/extension controls',condition:completeCanonicalScalar}));
verificationCatalog['verify-contract-closure.mjs'].sourceInputs=['test-specification-field-registry.mjs','workflow-schema.js','workbook.js','verifier-runtime.mjs'];
verificationCatalog['verify-contract-closure.mjs'].checks.push(check('registry.specified-job-tuples','contractClosure','specificationJobFields',undefined,'Independent controlling Section15 literal44 field tuples',{expectedDescription:'Every exact source-named job field producer/type/nullability/editability/required-stage tuple and key',basis:'EXECUTED_SCHEMA_METADATA_ASSERTIONS',condition:completeSpecifiedJobFields}),check('registry.specified-carrier-membership','contractClosure','specificationCarrierFields',undefined,'Finite source-named fields of six declared carrier families',{expectedDescription:'Exact82 field identities and application/agent producer partition; no generated-byte or whole14.5 inference',basis:'EXECUTED_SCHEMA_METADATA_ASSERTIONS',condition:completeSpecifiedCarriers}));
verificationCatalog['verify-human-authority-roundtrip.mjs'].sourceInputs=['test-human-stage-save.mjs','app-core.js','workflow-engine.js','workflow-schema.js','project-store.js','test-project-store-runtime.mjs','verifier-runtime.mjs'];
verificationCatalog['verify-human-authority-roundtrip.mjs'].checks.push(check('human.ordinary-stage-save','humanStageSave','humanStageSave',undefined,'Actual extracted normal operator save handler, production append-only decision and store/reload',{expectedDescription:'Two human controls save/reload and render once each; five wrong types and app-owned field reject atomically',condition:(_,report)=>report.humanStageSave==='PASS'&&report.renderCount===2&&exactRows(report.savedFields,[{stage:1,field:'JOB_TITLE',verbatim:true,committedAndReloaded:true,versioned:true,historyRetained:true},{stage:10,field:'FREEZE_OWNER',verbatim:true,committedAndReloaded:true,versioned:true,historyRetained:true}])&&exactNamedCases(report.malformedTypesRejected,['null','number','boolean','array','object'])&&['applicationFieldRejected','noUnregisteredDecisionCreated','rejectionPreservesState','actualHandler','actualStoreAndReload','synthetic'].every(key=>report[key]===true)&&report.actualBrowser===false}));
for(const [kind,field]of [['job','specificationJobFieldMutants'],['carrier','specificationCarrierFieldMutants']])verificationCatalog['verify-contract-closure.mjs'].checks.push(check('registry.specified-'+kind+'-mutations','contractClosure',field,undefined,'Independent specification-literal coherent declaration/registry mutations and restored control',{expectedDescription:kind==='job'?'Exact266 field property/editability/universe mutations':'Exact280 carrier omission/producer/registry-attribute/route mutations',basis:'EXECUTED_SCHEMA_METADATA_ASSERTIONS',condition:(value,report)=>completeRegistryMutations(value,report,kind)}));
verificationCatalog['verify-handoff-disclosure.mjs']={sourceInputs:['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js','test-project-store-runtime.mjs','verifier-runtime.mjs','test-handoff-authorization.mjs','test-handoff-blind-export.mjs','test-handoff-policy.mjs','test-fixtures.mjs','test-zip.mjs','verify-conformance-regressions.mjs','verification/deferred-definition-compatibility-legacy-fixture-20261005.json'],boundary:'Actual generated and retained handoff bytes, registered synthetic authorization commands, save/reload/ZIP and controlled concurrency; transaction adapter, no real external transfer or browser claim',checks:[check('handoff.disclosure-byte-and-authority-controls','handoffDisclosure','cases',undefined,'Finite retained-byte classification, disclosure/action authority, concurrent-save and blind-review export controls',{expectedDescription:'All16 named owning groups, three encoded byte observations, blind ZIP preservation, two intended owner faults and restored parent',condition:completeHandoffDisclosure})]};
for(const id of ['handoff.operation-effect-boundaries','handoff.material-and-human-authority','handoff.supplied-input-withdrawal','handoff.producer-epoch-compatibility','handoff.reference-family-selection','handoff.reserved-target-scope-currentness','handoff.deterministic-structured-context'])verificationCatalog['verify-handoff-disclosure.mjs'].checks.push(check('disclosure.'+id,'handoffDisclosure','handoffPolicyObservations',undefined,'Literal complete selected handoff policy assertion population',{expectedDescription:'Exact independently declared policy observation/case members, with synthetic and nonbrowser scope retained',condition:(rows,report)=>completeHandoffPolicy(rows,report,id)}));
verificationCatalog['verify-ingestion.mjs'].checks.push(check('handoff.operator-authorization-controls','handoffAuthorizationUi','observations',undefined,'Extracted normal operator authorization orchestration; controlled storage/engine/DOM adapters',{expectedDescription:'Exactly24 positive/negative owner controls and one detected guard-removal fault; not actual browser evidence',condition:(rows,report)=>report.handoffAuthorizationUi==='PASS'&&report.synthetic===true&&report.browserEvidence===false&&exactRows(rows,handoffUiCases)}));
verificationCatalog['verify-ingestion.mjs'].sourceInputs.push('verify-file-first-operator.mjs','verify-handoff-authorization-ui.mjs','test-app-markup.mjs');
verificationCatalog['verify-handoff-disclosure.mjs'].sourceInputs.push('verification/handoff-producer88-source-fixture-20261005.json','verification/handoff-producer89-source-fixture-20261005.json');
verificationCatalog['verify-response-retry-persistence.mjs'].sourceInputs=[...(verificationCatalog['verify-response-retry-persistence.mjs'].sourceInputs||[]),'test-handoff-authorization.mjs'];
for(const suite of ['verify-stage01-agent-contract-alignment.mjs','verify-due-stage-timing.mjs','verify-stage26-independent-review.mjs'])verificationCatalog[suite].sourceInputs=[...new Set([...(verificationCatalog[suite].sourceInputs||[]),'test-handoff-authorization.mjs'])];
for(const definition of Object.values(verificationCatalog))if(definition.sourceInputs?.includes('test-fixtures.mjs'))definition.sourceInputs=[...new Set([...definition.sourceInputs,'test-handoff-authorization.mjs'])];
verificationCatalog['verify-final-acceptance.mjs'].sourceInputs.push('test-specification-field-registry.mjs','test-handoff-authorization.mjs');
verificationCatalog['verify-contract-closure.mjs'].checks.push(check('registry.conditional-deferred-manifest-contract','contractClosure','conditionalDeferredManifestCarrier',undefined,'Literal conditional carrier declaration, required registered fields and seven coherent mutation controls',{basis:'EXECUTED_SCHEMA_METADATA_ASSERTIONS',expectedDescription:'Exactly38 conditional and66 ordinary operations, independently literal conditional keys and seven typed/path/ownership/applicability negatives; no emitted ZIP or admission claim',condition:(value,report)=>report.contractClosure==='PASS'&&value?.checkId==='registry.conditional-deferred-manifest'&&value.passed===true&&value.conditionalOperations===38&&value.ordinaryOperations===66&&value.negativeCases===7&&exactNamedCases(value.conditionalOperationKeys,[...Array.from({length:23},(_,i)=>(i+8)+':EXECUTE_FAILURE_TEST'),...Array.from({length:15},(_,i)=>(i+16)+':EXECUTE_REGRESSION')])&&exactNamedCases(value.cases,['wrong-type','wrong-owner','nullable','wrong-path','unconditional','missing-object','missing-field'])}));
for(const suite of ['verify-operational-persistence.mjs','verify-production-baseline-authority.mjs','verify-response-authority-integrity.mjs','verify-returned-slot-authority.mjs','verify-stage19-discovery-challenge.mjs','verify-stage01-intake-closure.mjs','verify-semantic-review-acceptance.mjs','verify-verification-routing.mjs','verify-independent-preflight.mjs','verify-complete.mjs','verify-stage28-artifact-delivery-intent.mjs','verify-test-runtime-v3.mjs','verify-final-product-timing.mjs','verify-native-proof-journey.mjs','verify-stage29-evidence-chain-checkpoint.mjs','verify-stage30-terminal-mobile-boundary.mjs'])verificationCatalog[suite].sourceInputs=[...new Set([...(verificationCatalog[suite].sourceInputs||[]),'test-fixtures.mjs','test-handoff-authorization.mjs'])];
for(const suite of ['verify-project-activation.mjs','verify-handoff-metadata-boundary.mjs'])verificationCatalog[suite].sourceInputs=[...new Set([...(verificationCatalog[suite].sourceInputs||[]),'test-handoff-authorization.mjs','test-project-store-runtime.mjs','test-fixtures.mjs','verifier-runtime.mjs'])];
const negatives={};
for(const definition of Object.values(verificationCatalog))for(const observation of definition.checks)if(observation.violation)(negatives[observation.violation]??=[]).push(observation.id);
export const zeroCatalog=Object.fromEntries(Object.entries(negatives).map(([name,checkIds])=>[name,{checkIds,populationDefinition:'The exact listed controlled invalid-operation attempts, checked by their actual production/assertion boundary and emitted only after rejection assertions.',scopeLimit}]));
for(const [suite,population]of Object.entries(negativePopulationCatalog))for(const row of population.cases){
  const definition=zeroCatalog[row.violation]??={checkIds:[],populationDefinition:'The exact enumerated controlled invalid-operation attempts retained by their real assertion owner.',scopeLimit:population.scopeLimit};
  definition.checkIds.push(`negativecase.${suite}.${row.caseId}`);
}

// Optional actual-browser producers are collected only by the existing browser
// workflow invocations. They are never substituted for the default synthetic
// population, and every case is qualified by LOCAL or DEPLOYED receipt scope.
const browserChecks=(suite,marker,fields)=>({boundary:'Actual Chromium controls against the retained built resource graph; external-agent inputs remain synthetic where declared by the owning suite.',sourceInputs:[],timeoutMs:suite==='verify-complete-operator-journey.mjs'?120*60*1000:10*60*1000,checks:Object.entries(fields).map(([field,expected])=>check(`${suite.replace(/\.mjs$/,'')}.${field}`,marker,field,expected,`${suite}: executed assertion represented by ${field}`,{basis:'ACTUAL_BROWSER_CONTROL_ASSERTIONS'}))});
export const browserVerificationCatalog={
 'verify-browser.mjs':browserChecks('verify-browser.mjs','browserVerified',{browserVerified:true,horizontalOverflow:false,controlsWithinViewport:true,buttonSizing:true,touchTargetFloor:44,minimumUiTextPx:14,all30StagesReachable:true,reloadPersistence:true,runtimeErrors:0}),
 'verify-browser-extra.mjs':browserChecks('verify-browser-extra.mjs','browserExtraVerified',{browserExtraVerified:true,exactPromptCopy:true,pendingProposalReload:true,successfulExport:true,successfulImport:true,canonicalDataRoundTrip:true,retainedNotDuplicated:true,retainedDeleteSuppression:true,projectLifecycleFunctional:true,blockerControl:true,freshContextControlContextual:true,blobPersistence:true,artifactIdempotence:true,twoTabConflict:true,storageFailureRollback:true,transactionMutatorLifetime:true,closedConnectionPromptSave:true,runtimeErrors:0}),
 'verify-human-stage-walkthrough.mjs':browserChecks('verify-human-stage-walkthrough.mjs','syntheticPromptAndNavigationChecks',{syntheticPromptAndNavigationChecks:true,completeOperatorJourney:false,humanIndependenceEstablished:false,stages:30,uiStagesReached:30,oneTimeSupply:true,promptVisualBaseline:true,operatorDoubleCheckGuide:true}),
 'verify-mobile-stage-action.mjs':browserChecks('verify-mobile-stage-action.mjs','mobileStageActionRegression',{mobileStageActionRegression:true,longFilenameWrapped:true,stateAndActionExplicit:true,primaryActionReachable:true,promptVisualBaselinePreserved:true,horizontalOverflow:false}),
 'verify-mobile-capability-journey.mjs':browserChecks('verify-mobile-capability-journey.mjs','mobileCapabilityJourney',{mobileCapabilityJourney:true}),
 'verify-complete-operator-journey.mjs':browserChecks('verify-complete-operator-journey.mjs','completeOperatorJourney',{completeOperatorJourney:true,stages:30,failures:[]}),
 'verify-browser-recovery.mjs':browserChecks('verify-browser-recovery.mjs','browserRecovery',{browserRecovery:true,complete:true,failures:[]})
};
for(const suite of ['verify-browser-recovery.mjs','verify-complete-operator-journey.mjs'])browserVerificationCatalog[suite].sourceInputs.push('test-browser-handoff-authorization.mjs','operator-browser-driver.mjs');
const browserCase=(suite,name)=>browserVerificationCatalog[suite].checks.push(check(`${suite.replace(/\.mjs$/,'')}.case:${name}`,suite==='verify-browser-recovery.mjs'?'browserRecovery':'mobileCapabilityJourney','cases',undefined,`${suite}: ${name}`,{basis:'ACTUAL_BROWSER_CONTROL_ASSERTIONS',expectedDescription:'Exactly one named executed case with PASS',condition:rows=>Array.isArray(rows)&&rows.filter(row=>row.name===name).length===1&&rows.find(row=>row.name===name)?.result==='PASS'}));
for(const name of ['probe cannot pass before the pinned project exists','probe rejects missing actual file and restore operations','actual exported response bytes selected','actual exported returned bytes selected','actual exported manifest bytes selected','restored the selected exported backup bytes','probe passes after all actual capability operations','pinned target and completed probe survive reload','only observed receipts are collected; missing journey operations remain explicit','target mismatch is rejected without changing the pinned session'])browserCase('verify-mobile-capability-journey.mjs',name);
browserVerificationCatalog['verify-mobile-capability-journey.mjs'].sourceInputs=['test-human-fallback-controls.mjs','test-human-fallback-fixture.mjs','test-browser-handoff-authorization.mjs','operator-browser-driver.mjs','test-zip.mjs'];
for(const answerType of ['TEXT','LONG_TEXT','BOOLEAN','NUMBER','CHOICE','MULTI_CHOICE','DATE','FILE_REFERENCE']){
 const name=`human fallback ${answerType} control saves and reloads typed answer`;
 browserVerificationCatalog['verify-mobile-capability-journey.mjs'].checks.push(check(`verify-mobile-capability-journey.fallback:${answerType}`,'mobileCapabilityJourney','cases',undefined,`Actual accessible ${answerType} control, native response-file ingestion, typed answer save and reload; human information is synthetic and the stage remains incomplete`,{basis:'ACTUAL_BROWSER_CONTROL_ASSERTIONS',expectedDescription:'Exactly one PASS case with all typed-answer and actual file controls; no human provenance or stage completion claimed',condition:rows=>{
  if(!Array.isArray(rows))return false;const matches=rows.filter(row=>row.name===name),row=matches[0],observation=row?.observation;
  return matches.length===1&&row.result==='PASS'&&observation?.answerType===answerType&&['accessibleQuestion','nativeControl','typedAnswerPreserved','actualResponseFile','syntheticHumanInformation'].every(field=>observation[field]===true)&&observation.stageCompleted===false;
 }}));
}
for(const name of ['Ordinary selection opens each of all 30 stages in the active version without changing project data','Replacement execution preserves accepted result and pending dependent work','Cancellation and unanswered confirmation survive reload without accepting or invalidating','Confirmed replacement commits once and invalidates pending dependent work','Undo and Redo restore project state through the same checkpoint mechanism','New continuation keeps the previous forward version in application History','Actual exported backup bytes restore active data and retained alternatives','Saved-version direct link resolves the named complete version','Application History restores a removed project as its complete saved version','File correction confirmation, cancellation, reload, saved candidate acceptance and reversal preserve exact bytes and matching dependent progress','Actual IndexedDB corruption is quarantined on reload; History restores the compatible valid project and original file bytes while retaining the damaged evidence','Recovery controls export protected evidence and remove only the damaged copy while preserving the restored project and History'])browserCase('verify-browser-recovery.mjs',name);

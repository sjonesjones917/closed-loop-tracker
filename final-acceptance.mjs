// Repository-only Section 49 publication barrier. Never imported by the application.
export const CORE_COVERAGE_KEYS=Object.freeze(["fieldOwnershipCoverage", "applicationDerivationCoverage", "typedRelationshipCoverage", "acceptedAgentValueExtractionCoverage", "acceptedRelationshipProvenanceCoverage", "currentScopeSelectorCoverage", "exactReqRunTestCoverage", "applicableCurrentRegressionSuccess", "mandatoryEvidenceChainCoverage", "releaseArtifactIdentityCoverage"]);
export const SECTION49_COVERAGE_KEYS=Object.freeze(["stage01RawInputAccounting", "stage01RequiredFileInspectionAccounting", "stage01AcceptedSemanticMappingCoverage", "stage04ObligationAccounting", "mandatoryEvidenceSufficiencyCoverage", "contractProfileMigrationCoverage", "fieldRegistryCoverage", "stageOperationRegistryCoverage", "stageOperationScopeMatrixCoverage", "durableObjectRegistryCoverage", "fileFirstPromptByteIdentityCoverage", "fileFirstResponseByteCaptureCoverage", "attachmentSlotMappingCoverage", "semanticReviewIndependenceCoverage", "dueStageObligationCoverage", "activationProofCoverage", "testIrDagAndRegistryIdentityCoverage", "closedMetricUniverseCoverage", "deliveryCandidateIdentityCoverage", "terminalCommandPrerequisiteCoverage", "preDeliveryCheckpointCoverage", "destinationBoundAuthorizationCoverage", "actualIPhoneSafariAcceptanceCoverage", "canonicalDeploymentOriginCoverage", "normativeRequirementTraceCoverage"]);
export const CORE_ZERO_KEYS=Object.freeze(["unauthorizedFieldMutationsAccepted", "canonicalMutationsBeforeAcceptance", "partialCommitsAfterInjectedFailure", "staleProposalsAccepted", "crossProjectRelationshipsAccepted", "historicalScopeSatisfyingCurrentGates", "unmatchedDeliveryFilesAuthorized", "appendOnlyHistoryRewritesAccepted", "unsupportedTestIrTreatedAsExecutable", "externalAssertionsOverridingApplicationProof", "nativeExecutionReceiptsFabricatedExternally", "releaseAcceptedWithContradiction"]);
export const SECTION49_ZERO_KEYS=Object.freeze(["stage04RequestsToRepeatAcceptedUserIntent", "unrequestedUnrelatedVisualChanges", "runtimeProjectCopiesOfSpecificationText", "implementationOnlyInstructionsInStagePrompts", "requiredClipboardOrPastedResponseOperations", "promptBodyFileByteDivergences", "humanFactsAcceptedOnlyFromAgentReport", "unregisteredFieldsOrStageOperationsAccepted", "stageProjectionsOverridingCanonicalRecords", "selfApprovedSemanticReviews", "obligationsRequiredBeforeTargetAvailability", "activationDecisionsWithoutProofObligations", "stage25Stage28CandidateSetMismatches", "terminalSelfInvalidationOrDependencyCycles", "duplicateDeleteOrCloneEffects", "implicitTestIrOperandSelection", "registrySemanticDriftUnderUnchangedIdentity", "vacuous100Metrics", "unpinnedMobileAcceptanceTreatedAsComplete", "inOriginDuplicateTreatedAsExternalBackup", "authorizationRepresentedAsCompletedDelivery", "unsafeExternalActionWithoutAuthorization", "mutationFixturesAffectingCanonicalUserState", "untrustedDomOrUrlExecutionAccepted", "unexpectedDeploymentOriginAccepted", "quarantinedProjectReactivated"]);

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const sha=/^[0-9a-f]{40}$/;
const sha256=/^[0-9a-f]{64}$/;
export function evaluateFinalAcceptance(report,{visualBaseline=null}={}){
  const blockers=[];
  const fail=(code,path,actor='CONTROLLER')=>blockers.push({code,path,requiredActor:actor});
  if(!object(report))return {schema:'closed-loop-final-acceptance-gate/1',accepted:false,automatedChecksReady:false,blockers:[{code:'REPORT_REQUIRED',path:'/',requiredActor:'CONTROLLER'}]};
  for(const [key,expected] of Object.entries({workflow:'mobile-closed-loop/30',contractProfileId:'closed-loop-completion-profile/1',projectSchema:'closed-loop-project/3',responseSchema:'closed-loop-stage-response/3',stageCount:30,stagesCompleted:30}))if(report[key]!==expected)fail('WRONG_ACCEPTANCE_IDENTITY',key);
  if(!sha.test(report.commit||''))fail('EXACT_COMMIT_REQUIRED','commit');
  function coverage(group,keys){
    const metrics=report[group];
    if(!object(metrics)){fail('METRIC_GROUP_REQUIRED',group);return;}
    for(const key of keys){
      const m=metrics[key],path=`${group}.${key}`,actor=key==='actualIPhoneSafariAcceptanceCoverage'?'IPHONE_OPERATOR':'CONTROLLER';
      if(!object(m)){fail('MANDATORY_METRIC_MISSING',path,actor);continue;}
      const d=m.denominator,n=m.numerator,ids=m.includedIds;
      if(!Number.isSafeInteger(d)||d<=0||!Number.isSafeInteger(n)||n<0||n>d)fail('INVALID_OR_EMPTY_METRIC_UNIVERSE',path);
      if(!Array.isArray(ids)||ids.length!==d||ids.some(id=>!nonempty(id))||new Set(ids).size!==ids.length)fail('METRIC_IDS_DO_NOT_RECONCILE',path);
      if(!Array.isArray(m.excludedIds)||!nonempty(m.metricId)||!nonempty(m.universeDefinition)||!nonempty(m.derivationVersion)||!nonempty(m.scopeHash)||!Array.isArray(m.evidenceReferences)||!m.evidenceReferences.length||m.evidenceReferences.some(ref=>!nonempty(ref)))fail('METRIC_PROVENANCE_REQUIRED',path);
      if(!Number.isFinite(m.value)||m.value!==n/d||report[key]!==m.value)fail('CONTRADICTORY_METRIC_SUMMARY',path);
      if(n!==d||m.value!==1||m.disposition!=='SATISFIED')fail('MANDATORY_METRIC_INCOMPLETE',path,actor);
    }
  }
  coverage('coverageMetrics',CORE_COVERAGE_KEYS);coverage('section49CoverageMetrics',SECTION49_COVERAGE_KEYS);
  for(const key of CORE_ZERO_KEYS)if(report[key]!==0)fail('ZERO_INVARIANT_NOT_PROVEN',key);
  for(const key of SECTION49_ZERO_KEYS)if(report.section49ZeroCountMetrics?.[key]!==0)fail('ZERO_INVARIANT_NOT_PROVEN',`section49ZeroCountMetrics.${key}`);
  if(report.section49ZeroCountInvariantCount!==SECTION49_ZERO_KEYS.length||report.section49ZeroCountInvariantViolations!==0)fail('ZERO_INVARIANT_SUMMARY_MISMATCH','section49ZeroCountInvariantCount');
  for(const key of ['deployedByteIdentity','localChromiumAcceptance','deployedChromiumAcceptance'])if(report[key]!==true)fail('MACHINE_PROOF_NOT_PASSED',key);
  for(const key of ['test','deploy','live'])if(report.jobResults?.[key]!=='success')fail('PROOF_JOB_NOT_PASSED',`jobResults.${key}`);
  for(const key of ['dataRouteClosure','infrastructureRouteClosure'])if(report[key]!=='PASS')fail('ROUTE_PROOF_NOT_PASSED',key);
  if(report.actualIPhoneSafariAcceptance!==true||report.mobileAcceptanceResult!=='ACCEPTED'||report.physicalIPhoneJobResult!=='success')fail('PHYSICAL_IPHONE_ACCEPTANCE_REQUIRED','actualIPhoneSafariAcceptance','IPHONE_OPERATOR');
  if(report.mobileAcceptanceSourceCommit!==report.commit||!sha256.test(report.mobileAcceptanceDeploymentManifestDigest||'')||report.mobileAcceptanceOrigin!=='https://sjonesjones917.github.io'||report.mobileAcceptanceBasePath!=='/closed-loop-tracker/')fail('MOBILE_BUILD_BINDING_REQUIRED','mobileAcceptanceSourceCommit','IPHONE_OPERATOR');
  for(const key of ['mobileAcceptanceTargetId','mobileAcceptanceEvidenceId','mobileAcceptanceTestProjectId','mobileAcceptancePerformer','mobileAcceptanceSubmitter'])if(!nonempty(report[key]))fail('MOBILE_ATTRIBUTION_REQUIRED',key,'IPHONE_OPERATOR');
  if(report.mobileAcceptancePhysicalDeviceAssertion!==true||!['HUMAN_OBSERVATION','VERIFIED_EXTERNAL'].includes(report.mobileAcceptanceEvidenceBasis)||!/^[0-9a-f]{32,}$/.test(report.mobileAcceptanceChallenge||''))fail('MOBILE_PHYSICAL_EVIDENCE_REQUIRED','mobileAcceptanceEvidenceBasis','IPHONE_OPERATOR');
  // Authority must identify the baseline, this comparison, and its actual evidence.
  // An informal statement of regular Safari use cannot synthesize this record.
  if(!object(visualBaseline)||visualBaseline.status!=='PROVEN'||!sha.test(visualBaseline.sourceCommit||'')||visualBaseline.comparedCommit!==report.commit||visualBaseline.comparisonResult!=='PASS'||!Array.isArray(visualBaseline.evidenceReferences)||!visualBaseline.evidenceReferences.length||visualBaseline.evidenceReferences.some(ref=>!nonempty(ref))||!['APPROVED_PREDECESSOR','VISUAL_BASELINE_AUTHORIZATION'].includes(visualBaseline.authority))fail('APPROVED_VISUAL_BASELINE_REQUIRED','visualBaseline','VISUAL_BASELINE_AUTHORITY');
  return {schema:'closed-loop-final-acceptance-gate/1',accepted:blockers.length===0,automatedChecksReady:!blockers.some(item=>item.requiredActor==='CONTROLLER'),coverageMetricCount:CORE_COVERAGE_KEYS.length+SECTION49_COVERAGE_KEYS.length,zeroInvariantCount:CORE_ZERO_KEYS.length+SECTION49_ZERO_KEYS.length,blockers};
}

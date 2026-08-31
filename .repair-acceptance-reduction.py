from pathlib import Path

p=Path('.github/workflows/pages.yml')
s=p.read_text()
old="""            ...definition,
            ...v3,
            stage01RawInputAccounting:1,
"""
new="""            ...definition,
            ...v3,
            currentScopeSelectorCoverage:definition.currentScopeSelectorCoverage,
            exactReqRunTestCoverage:definition.exactReqRunTestCoverage,
            applicableCurrentRegressionSuccess:definition.applicableCurrentRegressionSuccess,
            mandatoryEvidenceChainStructuralCoverage:definition.mandatoryEvidenceChainCoverage,
            mandatoryEvidenceSufficiencyCoverage:v3.mandatoryEvidenceSufficiencyCoverage,
            releaseArtifactIdentityCoverage:definition.releaseArtifactIdentityCoverage,
            unauthorizedFieldMutationsAccepted:definition.unauthorizedFieldMutationsAccepted,
            canonicalMutationsBeforeAcceptance:definition.canonicalMutationsBeforeAcceptance,
            partialCommitsAfterInjectedFailure:definition.partialCommitsAfterInjectedFailure,
            staleProposalsAccepted:definition.staleProposalsAccepted,
            crossProjectRelationshipsAccepted:definition.crossProjectRelationshipsAccepted,
            historicalScopeSatisfyingCurrentGates:definition.historicalScopeSatisfyingCurrentGates,
            unmatchedDeliveryFilesAuthorized:definition.unmatchedDeliveryFilesAuthorized,
            appendOnlyHistoryRewritesAccepted:definition.appendOnlyHistoryRewritesAccepted,
            unsupportedTestIrTreatedAsExecutable:v3.unsupportedTestIrTreatedAsExecutable,
            externalAssertionsOverridingApplicationProof:v3.externalAssertionsOverridingApplicationProof,
            nativeExecutionReceiptsFabricatedExternally:v3.nativeExecutionReceiptsFabricatedExternally,
            releaseAcceptedWithContradiction:v3.releaseAcceptedWithContradiction,
            stage01RawInputAccounting:1,
"""
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('pages acceptance reduction anchor missing')
p.write_text(s)

q=Path('verify-project-lifecycle.mjs')
t=q.read_text()
old1="for(const token of ['currentScopeSelectorCoverage','exactReqRunTestCoverage','applicableCurrentRegressionSuccess','mandatoryEvidenceChainStructuralCoverage','mandatoryEvidenceSufficiencyCoverage','releaseArtifactIdentityCoverage'])assert(pages.includes(token),`Acceptance reduction lost required invariant ${token}.`);"
new1="for(const token of ['currentScopeSelectorCoverage:definition.currentScopeSelectorCoverage','exactReqRunTestCoverage:definition.exactReqRunTestCoverage','applicableCurrentRegressionSuccess:definition.applicableCurrentRegressionSuccess','mandatoryEvidenceChainStructuralCoverage:definition.mandatoryEvidenceChainCoverage','mandatoryEvidenceSufficiencyCoverage:v3.mandatoryEvidenceSufficiencyCoverage','releaseArtifactIdentityCoverage:definition.releaseArtifactIdentityCoverage'])assert(pages.includes(token),`Acceptance reduction lost required invariant mapping ${token}.`);"
old2="for(const token of ['unauthorizedFieldMutationsAccepted:0','canonicalMutationsBeforeAcceptance:0','partialCommitsAfterInjectedFailure:0','staleProposalsAccepted:0','crossProjectRelationshipsAccepted:0','historicalScopeSatisfyingCurrentGates:0','unmatchedDeliveryFilesAuthorized:0','appendOnlyHistoryRewritesAccepted:0','unsupportedTestIrTreatedAsExecutable:0','externalAssertionsOverridingApplicationProof:0','nativeExecutionReceiptsFabricatedExternally:0','releaseAcceptedWithContradiction:0'])assert(pages.includes(token),`Acceptance reduction lost required zero-valued failure invariant ${token}.`);"
new2="for(const token of ['unauthorizedFieldMutationsAccepted:definition.unauthorizedFieldMutationsAccepted','canonicalMutationsBeforeAcceptance:definition.canonicalMutationsBeforeAcceptance','partialCommitsAfterInjectedFailure:definition.partialCommitsAfterInjectedFailure','staleProposalsAccepted:definition.staleProposalsAccepted','crossProjectRelationshipsAccepted:definition.crossProjectRelationshipsAccepted','historicalScopeSatisfyingCurrentGates:definition.historicalScopeSatisfyingCurrentGates','unmatchedDeliveryFilesAuthorized:definition.unmatchedDeliveryFilesAuthorized','appendOnlyHistoryRewritesAccepted:definition.appendOnlyHistoryRewritesAccepted','unsupportedTestIrTreatedAsExecutable:v3.unsupportedTestIrTreatedAsExecutable','externalAssertionsOverridingApplicationProof:v3.externalAssertionsOverridingApplicationProof','nativeExecutionReceiptsFabricatedExternally:v3.nativeExecutionReceiptsFabricatedExternally','releaseAcceptedWithContradiction:v3.releaseAcceptedWithContradiction'])assert(pages.includes(token),`Acceptance reduction lost required zero-valued failure invariant mapping ${token}.`);"
if old1 in t:
    t=t.replace(old1,new1,1)
elif new1 not in t:
    raise SystemExit('lifecycle coverage assertion block missing')
if old2 in t:
    t=t.replace(old2,new2,1)
elif new2 not in t:
    raise SystemExit('lifecycle zero assertion block missing')
q.write_text(t)

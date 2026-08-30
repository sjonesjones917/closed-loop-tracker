from pathlib import Path

# The legacy definition-of-done verifier remains useful for its broad coverage metrics,
# but its schema identity assertion must track the controlling /3 contract exactly.
dod=Path('verify-definition-of-done.mjs')
dod_text=dod.read_text()
old_schema="assert(core.PROJECT_SCHEMA==='closed-loop-project/2'&&schema.RESPONSE_SCHEMA==='closed-loop-stage-response/2','Schema identity changed.');"
new_schema="assert(core.PROJECT_SCHEMA==='closed-loop-project/3'&&schema.RESPONSE_SCHEMA==='closed-loop-stage-response/3','Schema identity changed.');"
if old_schema not in dod_text and new_schema not in dod_text:
    raise SystemExit('definition-of-done schema identity anchor missing')
dod.write_text(dod_text.replace(old_schema,new_schema,1))

p=Path('.github/workflows/pages.yml')
text=p.read_text()

# Runtime script order must include the deterministic Test IR authority before workflow-engine.js.
old="const expected=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];"
new="const expected=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];"
if old not in text and new not in text: raise SystemExit('runtime script-order assertion anchor missing')
text=text.replace(old,new)

# Syntax proof must include every new v3 verifier used by the controlling acceptance contract.
syntax_anchor="          node --check verify-test-runtime.mjs\n"
syntax_add="""          node --check verify-test-runtime.mjs
          node --check verify-test-runtime-v3.mjs
          node --check verify-test-runtime-limits.mjs
          node --check verify-v3-contract.mjs
          node --check verify-v3-migration.mjs
          node --check verify-intake-obligation-accounting.mjs
          node --check verify-exhaustive-stage1-stage3-stage4.mjs
          node --check verify-v3-definition-of-done.mjs
"""
if 'node --check verify-v3-contract.mjs' not in text:
    if syntax_anchor not in text: raise SystemExit('syntax test insertion anchor missing')
    text=text.replace(syntax_anchor,syntax_add,1)

# Required proof order: schema/ownership -> migration/accounting -> Test IR validation/security/runtime -> ingestion/gates/prompts/full cycle.
runtime_anchor="      - name: Verify generic deterministic Test IR runtime\n        run: node verify-test-runtime.mjs\n"
fallback_anchor="      - name: Verify canonical serialization and SHA-256\n"
runtime_block="""      - name: Verify v3 schema, ownership, and accounting contracts
        run: |
          node verify-v3-contract.mjs
          node verify-intake-obligation-accounting.mjs
          node verify-exhaustive-stage1-stage3-stage4.mjs
      - name: Verify deterministic v2-to-v3 migration
        run: node verify-v3-migration.mjs
      - name: Verify Test IR validation, security, limits, and deterministic runtime
        run: |
          node verify-test-runtime.mjs
          node verify-test-runtime-v3.mjs
          node verify-test-runtime-limits.mjs
"""
if 'Verify v3 schema, ownership, and accounting contracts' not in text:
    if runtime_anchor in text:
        text=text.replace(runtime_anchor,runtime_block,1)
    elif fallback_anchor in text:
        text=text.replace(fallback_anchor,runtime_block+fallback_anchor,1)
    else:
        raise SystemExit('runtime proof insertion anchor missing')

# Definition-of-done proof must include the v3-specific reduction.
dod_anchor="      - name: Derive definition-of-done coverage metrics\n        run: node verify-definition-of-done.mjs\n"
dod_block="""      - name: Derive definition-of-done coverage metrics
        run: |
          node verify-definition-of-done.mjs
          node verify-v3-definition-of-done.mjs
"""
if 'node verify-v3-definition-of-done.mjs' not in text:
    if dod_anchor not in text: raise SystemExit('definition-of-done insertion anchor missing')
    text=text.replace(dod_anchor,dod_block,1)

# Deployment re-runs the same deterministic v3 contract/runtime/closure proofs before uploading bytes.
deploy_old="node build-test-project.mjs && node verify-test-runtime.mjs && node verify-hash.mjs && node verify.mjs && node verify-ingestion.mjs && node verify-complete.mjs && node verify-full-cycle.mjs && node verify-prompt-semantics.mjs && node verify-semantic-invariant.mjs && node verify-definition-of-done.mjs && node verify-project-lifecycle.mjs"
deploy_new="node build-test-project.mjs && node verify-v3-contract.mjs && node verify-v3-migration.mjs && node verify-intake-obligation-accounting.mjs && node verify-exhaustive-stage1-stage3-stage4.mjs && node verify-test-runtime.mjs && node verify-test-runtime-v3.mjs && node verify-test-runtime-limits.mjs && node verify-hash.mjs && node verify.mjs && node verify-ingestion.mjs && node verify-complete.mjs && node verify-full-cycle.mjs && node verify-prompt-semantics.mjs && node verify-semantic-invariant.mjs && node verify-definition-of-done.mjs && node verify-v3-definition-of-done.mjs && node verify-project-lifecycle.mjs"
text=text.replace(deploy_old,deploy_new)

# Acceptance-report production must execute v3 closure and v3 definition proof, not assume them.
publish_anchor="          node verify-test-runtime.mjs > /tmp/verify-test-runtime.out\n"
publish_add="""          node verify-v3-contract.mjs > /tmp/verify-v3-contract.out
          node verify-v3-migration.mjs > /tmp/verify-v3-migration.out
          node verify-intake-obligation-accounting.mjs > /tmp/verify-intake-accounting.out
          node verify-exhaustive-stage1-stage3-stage4.mjs > /tmp/verify-exhaustive-intake.out
          node verify-test-runtime.mjs > /tmp/verify-test-runtime.out
          node verify-test-runtime-v3.mjs > /tmp/verify-test-runtime-v3.out
          node verify-test-runtime-limits.mjs > /tmp/verify-test-runtime-limits.out
"""
if '/tmp/verify-v3-contract.out' not in text:
    if publish_anchor not in text: raise SystemExit('publish v3 proof insertion anchor missing')
    text=text.replace(publish_anchor,publish_add,1)

definition_anchor="          node verify-definition-of-done.mjs > /tmp/verify-definition-of-done.out\n"
definition_add="""          node verify-definition-of-done.mjs > /tmp/verify-definition-of-done.out
          node verify-v3-definition-of-done.mjs > /tmp/verify-v3-definition-of-done.out
"""
if '/tmp/verify-v3-definition-of-done.out' not in text:
    if definition_anchor not in text: raise SystemExit('publish v3 definition insertion anchor missing')
    text=text.replace(definition_anchor,definition_add,1)

# Acceptance must prove v3 metric reductions as well as legacy baseline metrics.
coverage_old="const coverageKeys=['fieldOwnershipCoverage','applicationDerivationCoverage','typedRelationshipCoverage','acceptedAgentValueExtractionCoverage','acceptedRelationshipProvenanceCoverage','currentScopeSelectorCoverage','exactReqRunTestCoverage','applicableCurrentRegressionSuccess','mandatoryEvidenceChainCoverage','releaseArtifactIdentityCoverage'];"
coverage_new="const coverageKeys=['fieldOwnershipCoverage','applicationDerivationCoverage','typedRelationshipCoverage','stage01IntakeCoverage','stage04ObligationCoverage','acceptedAgentValueExtractionCoverage','acceptedRelationshipProvenanceCoverage','currentScopeSelectorCoverage','exactReqRunTestCoverage','applicableCurrentRegressionSuccess','mandatoryEvidenceChainCoverage','mandatoryEvidenceSufficiencyCoverage','releaseArtifactIdentityCoverage','nativeExecutionCoverage'];"
text=text.replace(coverage_old,coverage_new)
zero_old="const zeroKeys=['unauthorizedFieldMutationsAccepted','canonicalMutationsBeforeAcceptance','partialCommitsAfterInjectedFailure','staleProposalsAccepted','crossProjectRelationshipsAccepted','historicalScopeSatisfyingCurrentGates','unmatchedDeliveryFilesAuthorized','appendOnlyHistoryRewritesAccepted','favorableAgentVerdictsOverridingContradictoryObservations','structurallyInsufficientEvidenceProducingMandatorySatisfaction','externallySupportedUnestablishedIndependenceTreatedAsProven'];"
zero_new="const zeroKeys=['unauthorizedFieldMutationsAccepted','canonicalMutationsBeforeAcceptance','partialCommitsAfterInjectedFailure','staleProposalsAccepted','crossProjectRelationshipsAccepted','historicalScopeSatisfyingCurrentGates','unmatchedDeliveryFilesAuthorized','appendOnlyHistoryRewritesAccepted','favorableAgentVerdictsOverridingContradictoryObservations','structurallyInsufficientEvidenceProducingMandatorySatisfaction','externallySupportedUnestablishedIndependenceTreatedAsProven','unsupportedTestIrTreatedAsExecutable','externalAssertionsOverridingApplicationProof','nativeExecutionReceiptsFabricatedExternally','releaseAcceptedWithContradiction'];"
text=text.replace(zero_old,zero_new)

p.write_text(text)
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

# The v3 evidence proof must verify the application-owned evidence evaluator itself.
# Do not infer evidence sufficiency from incidental words appearing in a separate verifier.
v3dod=Path('verify-v3-definition-of-done.mjs')
v3dod_text=v3dod.read_text()
old_evidence="assert.match(engine,/intakeCoverageManifest/);assert.match(engine,/evaluateIntakeCoverage/);assert.match(engine,/obligationManifest/);assert.match(engine,/evaluateObligationAccounting/);assert.match(accountingTests,/INCOMPLETE_INTAKE_ACCOUNTING/);assert.match(accountingTests,/INCOMPLETE_OBLIGATION_ACCOUNTING/);assert.match(engine,/evaluateEvidenceSufficiency/);assert.match(semanticTests,/byte/i);assert.match(semanticTests,/meaning/i);assert.match(semanticTests,/human/i);assert.match(completeTests,/evidence/i);"
new_evidence="assert.match(engine,/intakeCoverageManifest/);assert.match(engine,/evaluateIntakeCoverage/);assert.match(engine,/obligationManifest/);assert.match(engine,/evaluateObligationAccounting/);assert.match(accountingTests,/INCOMPLETE_INTAKE_ACCOUNTING/);assert.match(accountingTests,/INCOMPLETE_OBLIGATION_ACCOUNTING/);assert.match(engine,/function evaluateEvidenceSufficiency\\s*\\(/);assert.match(engine,/APPLICATION_VERIFIED_BYTES/);assert.match(engine,/BYTES_PERSISTED_AND_VERIFIED/);assert.match(engine,/Byte-identity evidence requires application-verified artifact bytes and SHA-256/);assert.match(engine,/meaningResults/);assert.match(engine,/OBSERVED_MEANING/);assert.match(engine,/EVIDENCE_BASED_COMPARISON/);assert.match(engine,/HUMAN_INSPECTION/);assert.match(engine,/human-owned observation/i);assert.match(completeTests,/evidence/i);"
if old_evidence not in v3dod_text and new_evidence not in v3dod_text:
    raise SystemExit('v3 evidence-sufficiency proof anchor missing')
v3dod.write_text(v3dod_text.replace(old_evidence,new_evidence,1))

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

# Prior prompt-fixture composition can leave whitespace-only lines. Normalize only
# trailing whitespace after every prompt verifier patch so git diff --check remains a hard gate.
prompt_tests=Path('verify-prompt-semantics.mjs')
prompt_text=prompt_tests.read_text()
prompt_tests.write_text('\n'.join(line.rstrip() for line in prompt_text.splitlines())+'\n')
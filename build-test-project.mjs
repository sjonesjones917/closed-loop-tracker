import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const generatedRoot = path.join(root, 'test-project', 'generated');
const worker = path.join(root, 'test-project', 'run-generator.mjs');
const verifier = path.join(root, 'test-project', 'verify-handoff.mjs');
const inputPaths = [
  'test-project/inputs/REQUEST.md',
  'test-project/inputs/SITE_POLICY.md',
  'test-project/inputs/WORKFLOW_RULES.md'
];
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const fileSha = p => sha(fs.readFileSync(p));
const rel = p => path.relative(root, p).replaceAll('\\', '/');
const ensure = p => fs.mkdirSync(p, { recursive: true });
const writeJson = (p, value) => { ensure(path.dirname(p)); fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); };
const runJson = (script, args) => {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${path.basename(script)} failed: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
};

fs.rmSync(generatedRoot, { recursive: true, force: true });
ensure(generatedRoot);

const sourceText = Object.fromEntries(inputPaths.map(p => [p, read(p)]));
const sourceHashes = Object.fromEntries(inputPaths.map(p => [p, fileSha(path.join(root, p))]));
const jobId = 'TEST-JOB-001';
const projectDate = '2026-08-23T14:30:00Z';
const service = {
  unitId: 'GEN-042',
  serviceDate: '2026-08-23',
  completedServiceActions: ['Changed engine oil', 'Inspected air filter', 'Checked battery terminals'],
  startStopFunctionalCheck: 'SATISFIED — engine started and stopped normally during the recorded service check',
  exteriorFuelOilLeakInspection: 'NONE — no exterior fuel or oil leak was observed during the recorded inspection',
  safetyState: 'SATISFIED'
};
const candidateV1 = { ...service, instructionVersion: 'INSTRUCTION-v001', includeRevalidationStep: false };
const candidateV2 = { ...service, instructionVersion: 'INSTRUCTION-v002', includeRevalidationStep: true };
const expected = { ...service };
const packageDir = path.join(generatedRoot, 'packages');
const candidate1Path = path.join(packageDir, 'CANDIDATE-001.json');
const candidate2Path = path.join(packageDir, 'CANDIDATE-002.json');
const expectedPath = path.join(packageDir, 'EXPECTED.json');
writeJson(candidate1Path, candidateV1);
writeJson(candidate2Path, candidateV2);
writeJson(expectedPath, expected);
const candidate1Hash = fileSha(candidate1Path);
const candidate2Hash = fileSha(candidate2Path);

const freshContexts = [];
const outputReceipts = [];
const runRecords = [];
const verificationRecords = [];
const artifacts = [];
const history = [];

function addArtifact(artifactId, artifactPath, artifactType, stage, extra = {}) {
  const stat = fs.statSync(artifactPath);
  const record = {
    artifactId,
    artifactType,
    stage,
    path: rel(artifactPath),
    filename: path.basename(artifactPath),
    byteLength: stat.size,
    sha256: fileSha(artifactPath),
    ...extra
  };
  artifacts.push(record);
  return record;
}

function executeIteration({ iterationId, candidateId, candidatePath, candidateHash, instructionVersion, stage }) {
  const records = [];
  const folder = path.join(generatedRoot, iterationId.toLowerCase());
  ensure(folder);
  for (let index = 1; index <= 10; index += 1) {
    const runId = `RUN-${String(index).padStart(3, '0')}`;
    const generationContextId = `CTX-${iterationId}-GEN-${String(index).padStart(3, '0')}`;
    const verificationContextId = `CTX-${iterationId}-VERIFY-${String(index).padStart(3, '0')}`;
    const outputPath = path.join(folder, `${runId}.md`);
    const generated = runJson(worker, [candidatePath, outputPath, runId, generationContextId]);
    const verified = runJson(verifier, [expectedPath, outputPath, verificationContextId]);
    const prompt = `${jobId} · ${iterationId} · ${runId}\nExecute ${instructionVersion} exactly once using CANDIDATE ${candidateId}. Use only the frozen package ${rel(candidatePath)} (${candidateHash}). Do not inspect any other run, reviewer comment, failure explanation, or proposed correction. Preserve the complete output.`;
    const context = {
      contextId: generationContextId,
      jobId,
      stage,
      role: 'Independent production execution',
      iterationId,
      runId,
      freshContext: true,
      authorizedInputs: [rel(candidatePath), ...inputPaths],
      frozenCandidateId: candidateId,
      frozenCandidateSha256: candidateHash,
      instructionVersion,
      otherRunOutputVisible: false,
      reviewerCommentVisible: false,
      priorFailureExplanationVisible: false,
      proposedCorrectionVisible: false,
      requiredToolsAvailable: true,
      contaminationState: 'CLEAN',
      usable: true,
      prompt
    };
    const verifierContext = {
      contextId: verificationContextId,
      jobId,
      stage: 12,
      role: 'Independent run verifier',
      iterationId,
      runId,
      freshContext: true,
      authorizedInputs: [rel(expectedPath), rel(outputPath)],
      generatorOutputVisible: true,
      otherRunOutputVisible: false,
      reviewerCommentVisible: false,
      priorFailureExplanationVisible: false,
      proposedCorrectionVisible: false,
      requiredToolsAvailable: true,
      contaminationState: 'CLEAN',
      generatorAndVerifierSameContext: false,
      usable: true
    };
    freshContexts.push(context, verifierContext);
    const artifact = addArtifact(`${iterationId}-${runId}-OUTPUT`, outputPath, 'RUN_OUTPUT', stage, { iterationId, runId, candidateId });
    const receipt = {
      receiptId: `RECEIPT-${iterationId}-${runId}`,
      jobId,
      stage,
      agentRole: 'Independent production execution',
      contextId: generationContextId,
      iterationId,
      runId,
      requestDateTime: projectDate,
      responseDateTime: projectDate,
      inputVersions: ['INPUT-v001', 'SOURCE-SET-v001', 'REQUIREMENTS-v001', instructionVersion],
      outputArtifactId: artifact.artifactId,
      outputVersion: 'v001',
      outputFiles: [artifact.path],
      outputHashes: [artifact.sha256],
      completeResponseSaved: true,
      completeResponse: generated.completeResponse,
      truncationDetected: false,
      refusalOrPartialRefusal: false,
      toolFailures: [],
      malformedOutputFiles: [],
      deviations: [],
      nextRequiredVerificationStage: 'STAGE 12'
    };
    outputReceipts.push(receipt);
    const verification = verified.results.map(item => ({
      verificationRecordId: `VR-${iterationId}-${runId}-${item.reqId}`,
      iterationId,
      runId,
      testId: `TEST-${item.reqId.slice(-3)}`,
      ...item
    }));
    verificationRecords.push(...verification);
    const record = {
      iterationId,
      candidateId,
      candidateSha256: candidateHash,
      instructionVersion,
      runId,
      contextId: generationContextId,
      verifierContextId: verificationContextId,
      status: 'COMPLETED',
      freshContextCreated: true,
      exactFrozenPackageSupplied: true,
      otherRunOutputVisible: false,
      reviewerCommentsVisible: false,
      priorFailureExplanationsVisible: false,
      proposedCorrectionsVisible: false,
      toolConfigurationMatched: true,
      contaminationFound: false,
      prompt,
      authorizedInputs: context.authorizedInputs,
      outputArtifactId: artifact.artifactId,
      outputPath: artifact.path,
      outputSha256: artifact.sha256,
      outputByteLength: artifact.byteLength,
      completeOutput: generated.completeResponse,
      verificationDetermination: verified.determination,
      verificationResults: verification
    };
    runRecords.push(record);
    records.push(record);
    history.push({ eventId: `EVENT-${iterationId}-${runId}`, stage, type: 'RUN_COMPLETED', iterationId, runId, contextId: generationContextId, summary: `${runId} completed in a fresh isolated process and was independently verified.`, evidenceRefs: [artifact.artifactId, ...verification.map(v => v.verificationRecordId)] });
  }
  return records;
}

function compareIteration(iterationId, records) {
  const requirementIds = ['REQ-001', 'REQ-002', 'REQ-003', 'REQ-004', 'REQ-005'];
  const requirementComparisons = requirementIds.map(reqId => {
    const results = records.map(record => record.verificationResults.find(result => result.reqId === reqId)?.result || 'UNDETERMINED');
    const unique = [...new Set(results)];
    return {
      reqId,
      runResults: Object.fromEntries(records.map((record, index) => [record.runId, results[index]])),
      satisfiedByAllTen: results.every(value => value === 'SATISFIED'),
      anyViolation: results.includes('VIOLATED'),
      anyUndetermined: results.includes('UNDETERMINED'),
      interpretationVariance: unique.length > 1,
      correctnessAffectingVariance: unique.length > 1,
      repeatedFailurePattern: results.every(value => value === 'VIOLATED') ? `${reqId} was violated in all ten independent runs.` : 'NONE',
      evidence: records.map(record => `${record.runId}:${record.verificationResults.find(result => result.reqId === reqId)?.verificationRecordId}`)
    };
  });
  return {
    comparisonId: `COMPARISON-${iterationId}`,
    comparisonVersion: 'v001',
    iterationId,
    runCount: records.length,
    noPreferredRunSelected: true,
    requirementComparisons,
    requirementsSatisfiedByAllTen: requirementComparisons.filter(item => item.satisfiedByAllTen).length,
    requirementsWithViolation: requirementComparisons.filter(item => item.anyViolation).length,
    requirementsWithUndetermined: requirementComparisons.filter(item => item.anyUndetermined).length,
    correctnessAffectingVariance: requirementComparisons.filter(item => item.correctnessAffectingVariance).length,
    determination: requirementComparisons.every(item => item.satisfiedByAllTen) ? 'SATISFIED' : 'VIOLATED'
  };
}

const blocker = {
  blockerId: 'BLOCKER-001',
  jobId,
  dateOpened: projectDate,
  currentStatus: 'RESOLVED',
  stageDiscovered: 11,
  affectedReqIds: ['REQ-001', 'REQ-002', 'REQ-003', 'REQ-004', 'REQ-005'],
  affectedTestIds: ['TEST-001', 'TEST-002', 'TEST-003', 'TEST-004', 'TEST-005'],
  missingItemType: 'CAPABILITY',
  missingItem: 'Ten clean independent execution contexts had not yet been launched.',
  whyMandatorySatisfactionCouldNotBeEstablished: 'Stage 12 cannot verify independent run outputs until those outputs actually exist.',
  attemptsToResolve: ['Created an isolated Node child process for each run and a separate verifier process for each output.'],
  downstreamWorkStopped: ['STAGE 12 through STAGE 30 before context launch'],
  resolution: 'Ten isolated generation contexts and ten separate verification contexts were created for ITERATION-001.',
  resolutionEvidence: 'CTX-ITERATION-001-GEN-001 through GEN-010 and CTX-ITERATION-001-VERIFY-001 through VERIFY-010',
  dateResolved: projectDate,
  requirementsAndTestsReevaluated: ['REQ-001 through REQ-005', 'TEST-001 through TEST-005'],
  downstreamValidationRerun: ['STAGE 12', 'STAGE 13']
};

const iteration1 = executeIteration({ iterationId: 'ITERATION-001', candidateId: 'CANDIDATE-001', candidatePath: candidate1Path, candidateHash: candidate1Hash, instructionVersion: 'INSTRUCTION-v001', stage: 11 });
const comparison1 = compareIteration('ITERATION-001', iteration1);

const defect = {
  defectId: 'DEFECT-001',
  dateDetected: projectDate,
  iterationId: 'ITERATION-001',
  affectedRunIds: iteration1.map(run => run.runId),
  affectedReqIds: ['REQ-005'],
  observedFailure: 'All ten outputs omitted the required final escalation action: revalidate before release.',
  productLocations: iteration1.map(run => run.outputPath),
  severity: 'MAJOR',
  rootCauseCategory: 'INSTRUCTION_DEFECT',
  earliestDefectiveLayerEvidence: 'INSTRUCTION-v001 contained only four escalation operations; the source and requirement both contained five.',
  correctionRequired: 'Add the fifth ordered operation, “Revalidate before release,” to the production instruction.',
  downstreamArtifactsInvalidated: ['CANDIDATE-001', 'ITERATION-001 determinations', 'Any baseline or release decision derived from INSTRUCTION-v001'],
  status: 'CLOSED_VERIFIED'
};
const change = {
  changeId: 'CHANGE-001',
  dateTime: projectDate,
  jobId,
  iterationId: 'ITERATION-001',
  trigger: 'DEFECT',
  earliestResponsibleLayer: 'INSTRUCTION',
  affectedArtifactId: 'INSTRUCTION',
  oldVersion: 'INSTRUCTION-v001',
  oldSha256: candidate1Hash,
  newVersion: 'INSTRUCTION-v002',
  newSha256: candidate2Hash,
  exactChange: 'Added the required fifth escalation operation: revalidate before release.',
  reason: 'DEFECT-001 root-cause correction',
  rootCauseIdOrAuthority: 'DEFECT-001 / REQ-005 / SRC-002',
  materialChange: true,
  downstreamArtifactsInvalidated: ['CANDIDATE-001', 'ITERATION-001 verification and comparison'],
  downstreamDeterminationsInvalidated: ['Convergence, baseline, product, release'],
  testsToRerun: ['TEST-001 through TEST-005', 'REG-001'],
  iterationsToRerun: ['ITERATION-002', 'CONFIRMATION-001'],
  auditsToRerun: ['STAGES 22 through 29'],
  releaseGateMustBeRerun: true,
  hashIdentityMustBeRerun: true,
  revalidationComplete: true,
  changeStatus: 'CLOSED_REVALIDATED'
};

const iteration2 = executeIteration({ iterationId: 'ITERATION-002', candidateId: 'CANDIDATE-002', candidatePath: candidate2Path, candidateHash: candidate2Hash, instructionVersion: 'INSTRUCTION-v002', stage: 17 });
const comparison2 = compareIteration('ITERATION-002', iteration2);
const confirmationRuns = executeIteration({ iterationId: 'CONFIRMATION-001', candidateId: 'CANDIDATE-002', candidatePath: candidate2Path, candidateHash: candidate2Hash, instructionVersion: 'INSTRUCTION-v002', stage: 19 });
const comparisonConfirmation = compareIteration('CONFIRMATION-001', confirmationRuns);

const preFix = iteration1[0].verificationResults.find(item => item.reqId === 'REQ-005');
const postFix = iteration2[0].verificationResults.find(item => item.reqId === 'REQ-005');
const regression = {
  regId: 'REG-001',
  originalDefectId: 'DEFECT-001',
  reqId: 'REQ-005',
  failureFixture: iteration1[0].outputPath,
  detectionMethod: 'TEST-005 exact five-step escalation check',
  expectedRejectionOrCorrection: 'VIOLATED before correction; SATISFIED after correction.',
  preCorrectionResult: preFix.result,
  preCorrectionEvidence: preFix.evidence,
  correctionApplied: change.exactChange,
  postCorrectionResult: postFix.result,
  postCorrectionEvidence: postFix.evidence,
  permanentTestSuiteLocation: 'TEST-005 / REG-001',
  governingRequirementStillApplicable: true,
  status: 'ACTIVE'
};

const fixtureDir = path.join(generatedRoot, 'fixtures');
ensure(fixtureDir);
const missingEscalationFixture = path.join(fixtureDir, 'INVALID_MISSING_REVALIDATION.md');
fs.copyFileSync(path.join(root, iteration1[0].outputPath), missingEscalationFixture);
const unknownExpected = { ...expected, exteriorFuelOilLeakInspection: 'UNKNOWN — exterior leak inspection evidence is unavailable', safetyState: 'UNKNOWN' };
const unknownExpectedPath = path.join(fixtureDir, 'EXPECTED_UNKNOWN.json');
writeJson(unknownExpectedPath, unknownExpected);
const inventedLeakFixture = path.join(fixtureDir, 'INVALID_INVENTED_LEAK_RESULT.md');
fs.copyFileSync(path.join(root, iteration2[0].outputPath), inventedLeakFixture);
const acceptedUnknownText = iteration2[0].completeOutput.replace(service.exteriorFuelOilLeakInspection, unknownExpected.exteriorFuelOilLeakInspection);
const acceptedUnknownFixture = path.join(fixtureDir, 'INVALID_ACCEPTED_UNKNOWN.md');
fs.writeFileSync(acceptedUnknownFixture, acceptedUnknownText, 'utf8');
const mutationResults = [
  {
    mutationId: 'MUT-001',
    reqId: 'REQ-003',
    violationMode: 'Invent NONE when the authorized evidence is UNKNOWN.',
    invalidFixture: rel(inventedLeakFixture),
    expectedSystemResponse: 'DETECT AND REJECT',
    validatorOutput: runJson(verifier, [unknownExpectedPath, inventedLeakFixture, 'CTX-MUT-001-VERIFY']),
    status: 'EFFECTIVE'
  },
  {
    mutationId: 'MUT-002',
    reqId: 'REQ-004',
    violationMode: 'Keep ACCEPTED while a mandatory safety condition is UNKNOWN.',
    invalidFixture: rel(acceptedUnknownFixture),
    expectedSystemResponse: 'DETECT AND BLOCK',
    validatorOutput: runJson(verifier, [unknownExpectedPath, acceptedUnknownFixture, 'CTX-MUT-002-VERIFY']),
    status: 'EFFECTIVE'
  },
  {
    mutationId: 'MUT-003',
    reqId: 'REQ-005',
    violationMode: 'Omit revalidation from the escalation route.',
    invalidFixture: rel(missingEscalationFixture),
    expectedSystemResponse: 'DETECT AND REJECT',
    validatorOutput: runJson(verifier, [expectedPath, missingEscalationFixture, 'CTX-MUT-003-VERIFY']),
    status: 'EFFECTIVE'
  }
];
for (const mutation of mutationResults) {
  mutation.defectDetected = mutation.validatorOutput.determination === 'VIOLATED';
  mutation.validatorAcceptedInvalidCase = mutation.validatorOutput.determination === 'SATISFIED';
  mutation.evidence = mutation.validatorOutput.results.filter(item => item.result !== 'SATISFIED');
  addArtifact(`${mutation.mutationId}-FIXTURE`, path.join(root, mutation.invalidFixture), 'INVALID_FIXTURE', 7, { mutationId: mutation.mutationId });
}

const productionDir = path.join(generatedRoot, 'release');
const productPath = path.join(productionDir, `${jobId}__GEN-042__SERVICE-HANDOFF__v001.md`);
const productionContextId = 'CTX-PRODUCTION-001';
const productGenerated = runJson(worker, [candidate2Path, productPath, 'PRODUCTION-001', productionContextId]);
const productVerifierContextId = 'CTX-PRODUCT-VERIFY-001';
const productVerified = runJson(verifier, [expectedPath, productPath, productVerifierContextId]);
freshContexts.push({ contextId: productionContextId, jobId, stage: 21, role: 'Fresh production execution', freshContext: true, authorizedInputs: [rel(candidate2Path), ...inputPaths], frozenCandidateId: 'CANDIDATE-002', frozenCandidateSha256: candidate2Hash, contaminationState: 'CLEAN', usable: true });
freshContexts.push({ contextId: productVerifierContextId, jobId, stage: 22, role: 'Independent product verifier', freshContext: true, authorizedInputs: [rel(expectedPath), rel(productPath)], generatorAndVerifierSameContext: false, contaminationState: 'CLEAN', usable: true });
const productArtifact = addArtifact('PRODUCT-001-ARTIFACT-001', productPath, 'FINISHED_PRODUCT', 21, { productId: 'PRODUCT-001', productVersion: 'PRODUCT-v001' });
const productReceipt = {
  receiptId: 'RECEIPT-PRODUCTION-001',
  jobId,
  stage: 21,
  agentRole: 'Fresh production execution',
  contextId: productionContextId,
  runId: 'PRODUCTION-001',
  inputVersions: ['BASELINE-001', 'INSTRUCTION-v002'],
  outputArtifactId: productArtifact.artifactId,
  outputFiles: [productArtifact.path],
  outputHashes: [productArtifact.sha256],
  completeResponseSaved: true,
  completeResponse: productGenerated.completeResponse,
  truncationDetected: false,
  refusalOrPartialRefusal: false,
  toolFailures: [],
  deviations: [],
  nextRequiredVerificationStage: 'STAGE 22'
};
outputReceipts.push(productReceipt);

const previewPath = path.join(productionDir, 'GEN-042__SERVICE-HANDOFF__inspection-preview.html');
const escapedProduct = productGenerated.completeResponse.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
fs.writeFileSync(previewPath, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GEN-042 handoff inspection</title><style>body{margin:auto;max-width:42rem;padding:1rem;font:16px/1.45 system-ui;white-space:pre-wrap;overflow-wrap:anywhere}</style>${escapedProduct}`, 'utf8');
const previewArtifact = addArtifact('REPRESENTATION-PREVIEW-001', previewPath, 'REPRESENTATION_INSPECTION', 25);

const productText = productGenerated.completeResponse;
const adversarialChecks = [
  ['MISSING_MATERIAL', ['Completed service work', 'Recorded checks', 'Safety decision', 'Escalation when'].every(value => productText.includes(value))],
  ['PROHIBITED_MATERIAL', !/ready for service/i.test(productText)],
  ['CONTRADICTION', (productText.match(/\*\*Release state:\*\*/g) || []).length === 1],
  ['UNSUPPORTED_FACT', productText.includes('No unrecorded fact was inferred.')],
  ['SOURCE_MISREPRESENTATION', inputPaths.every(value => productText.includes(value))],
  ['WRONG_VERSION', candidate2Hash === fileSha(candidate2Path)],
  ['BROKEN_REFERENCE', inputPaths.every(value => fs.existsSync(path.join(root, value)))],
  ['HIDDEN_ASSUMPTION', !/assume|presume/i.test(productText)],
  ['PARTIAL_COMPLETION', productVerified.results.every(item => item.result === 'SATISFIED')],
  ['SEMANTIC_NONSENSE', productText.includes('Release state: ACCEPTED')],
  ['TERMINOLOGY_INCONSISTENCY', !/PASS|FAIL|APPROVED/i.test(productText)],
  ['UNHANDLED_EXCEPTION', productText.includes('safety-critical condition is found or UNKNOWN')],
  ['STALE_FACT', productText.includes(service.serviceDate)],
  ['MALFORMED_FILE', Buffer.from(productText, 'utf8').toString('utf8') === productText],
  ['HIDDEN_CONTENT', !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(productText)],
  ['EXPORT_CORRUPTION', fileSha(productPath) === productArtifact.sha256],
  ['TECHNICAL_MENTION_WITHOUT_SATISFACTION', productVerified.determination === 'SATISFIED'],
  ['REGRESSION', productVerified.results.find(item => item.reqId === 'REQ-005')?.result === 'SATISFIED']
].map(([category, satisfied], index) => ({ attackId: `ATTACK-${String(index + 1).padStart(3, '0')}`, category, method: 'Independent rule-based attempt to disprove the exact finished artifact.', expectedCorrectBehavior: 'No mandatory defect is established.', observedResult: satisfied ? 'No defect established.' : 'Defect established.', defectFound: !satisfied, severity: satisfied ? 'NOT APPLICABLE' : 'MAJOR', evidence: productArtifact.path }));

const productLines = productText.split(/\r?\n/);
const representation = {
  representationAuditVersion: 'REPRESENTATION-AUDIT-v001',
  productId: 'PRODUCT-001',
  productVersion: 'PRODUCT-v001',
  exactDeliveryArtifact: productArtifact,
  transformationChain: [{ chainId: 'CHAIN-001', sourceArtifact: productArtifact.artifactId, transformation: 'UTF-8 Markdown opened directly; HTML preview created only for inspection.', outputArtifact: previewArtifact.artifactId, sourceSha256: productArtifact.sha256, outputSha256: previewArtifact.sha256 }],
  viewsRequired: 1,
  viewsInspected: 1,
  utf8RoundTrip: Buffer.from(productText, 'utf8').toString('utf8') === productText,
  maxLineLength: Math.max(...productLines.map(line => line.length)),
  clipping: 'NONE',
  missingContent: 'NONE',
  unexpectedBlankPageOrView: 'NONE',
  brokenLayout: 'NONE',
  hiddenOrOverlappingContent: 'NONE',
  exportCorruption: 'NONE',
  packageExpectedFiles: [productArtifact.filename],
  packageActualFiles: [productArtifact.filename],
  corruptOrUnopenableFiles: [],
  determination: 'SATISFIED',
  evidence: [productArtifact.path, previewArtifact.path]
};

const requirementRecords = [
  { reqId: 'REQ-001', requirement: 'The handoff identifies unit GEN-042 and service date 2026-08-23.', type: 'CONTENT', mandatoryStatus: 'MANDATORY', sourceIds: ['SRC-001', 'SRC-002'], sourceLocations: ['REQUEST.md objective', 'SITE_POLICY.md Required handoff content'], applicability: 'Every service handoff.', observableSatisfactionCondition: 'Both values appear exactly.', verificationMethod: 'Exact text comparison', expectedEvidence: 'Product line locations', failureCondition: 'Either value is missing or different.', severity: 'MAJOR', status: 'ACTIVE' },
  { reqId: 'REQ-002', requirement: 'The handoff records the completed service actions and start/stop functional-check result.', type: 'CONTENT', mandatoryStatus: 'MANDATORY', sourceIds: ['SRC-001', 'SRC-002'], sourceLocations: ['REQUEST.md', 'SITE_POLICY.md Required handoff content'], applicability: 'Every service handoff.', observableSatisfactionCondition: 'Every supplied action and the exact check result appear.', verificationMethod: 'Structural and exact content check', expectedEvidence: 'Product lines', failureCondition: 'Any action or check is missing.', severity: 'MAJOR', status: 'ACTIVE' },
  { reqId: 'REQ-003', requirement: 'The handoff records the exterior fuel/oil leak inspection without inventing evidence.', type: 'EVIDENCE', mandatoryStatus: 'MANDATORY', sourceIds: ['SRC-001', 'SRC-002', 'SRC-003'], sourceLocations: ['REQUEST.md', 'SITE_POLICY.md Safety gate', 'WORKFLOW_RULES.md factual values'], applicability: 'Every service handoff.', observableSatisfactionCondition: 'The exact observed value is preserved; UNKNOWN is used when unavailable.', verificationMethod: 'Source-to-output exact comparison', expectedEvidence: 'Authorized input and product line', failureCondition: 'The result is missing or differs from evidence.', severity: 'CRITICAL', status: 'ACTIVE' },
  { reqId: 'REQ-004', requirement: 'A safety-critical condition that is found or cannot be established blocks return-to-service until authorized resolution and revalidation.', type: 'PROCEDURAL', mandatoryStatus: 'MANDATORY', sourceIds: ['SRC-001', 'SRC-002', 'SRC-003'], sourceLocations: ['REQUEST.md', 'SITE_POLICY.md Safety gate', 'WORKFLOW_RULES.md release outcomes'], applicability: 'When a safety-critical condition is adverse or UNKNOWN.', observableSatisfactionCondition: 'BLOCKED is used and ACCEPTED is prohibited for adverse or UNKNOWN evidence.', verificationMethod: 'Rule-based safety-gate test', expectedEvidence: 'Release-state and safety-decision lines', failureCondition: 'ACCEPTED appears while mandatory safety evidence is adverse or UNKNOWN.', severity: 'CRITICAL', status: 'ACTIVE' },
  { reqId: 'REQ-005', requirement: 'The handoff includes all five site-policy escalation actions, ending with revalidation before release.', type: 'CONTENT', mandatoryStatus: 'MANDATORY', sourceIds: ['SRC-001', 'SRC-002'], sourceLocations: ['REQUEST.md', 'SITE_POLICY.md Escalation'], applicability: 'Every handoff must explain the blocked path.', observableSatisfactionCondition: 'All five ordered actions appear.', verificationMethod: 'Exact semantic/structural check', expectedEvidence: 'Escalation section lines', failureCondition: 'Any action is absent.', severity: 'MAJOR', status: 'ACTIVE' }
];
const tests = requirementRecords.map((requirement, index) => ({
  testId: `TEST-${String(index + 1).padStart(3, '0')}`,
  reqId: requirement.reqId,
  testType: index < 3 ? 'PROGRAMMATIC' : 'RULE_BASED',
  inputsRequired: [rel(expectedPath), productArtifact.path],
  toolsRequired: [`node ${process.version}`, rel(verifier)],
  procedure: requirement.verificationMethod,
  expectedResult: 'SATISFIED',
  failureCondition: requirement.failureCondition,
  evidenceProduced: `Verification records for ${requirement.reqId}`,
  independenceRequirement: 'Verifier process is separate from generator process.',
  status: 'READY'
}));

const sourceInventory = [
  { sourceId: 'SRC-001', title: 'Project request', sourceType: 'USER INSTRUCTION', origin: 'Field service coordinator', reference: inputPaths[0], version: 'v001', authorityLevel: 1, role: 'MANDATORY', relevantPortions: 'Objective, deliverable, unit, restrictions', actualSourceInspected: true, currencyConfirmed: 'NOT APPLICABLE', conflictsWith: [], controllingStatus: 'CONTROLS', sha256: sourceHashes[inputPaths[0]] },
  { sourceId: 'SRC-002', title: 'Site service handoff policy', sourceType: 'INTERNAL POLICY', origin: 'Service operations', reference: inputPaths[1], version: 'v001', authorityLevel: 2, role: 'MANDATORY', relevantPortions: 'Required content, safety gate, escalation', actualSourceInspected: true, currencyConfirmed: 'YES', conflictsWith: [], controllingStatus: 'CONTROLS', sha256: sourceHashes[inputPaths[1]] },
  { sourceId: 'SRC-003', title: 'Closed-loop outcome rules', sourceType: 'WORKFLOW RULE', origin: 'Reliability workflow', reference: inputPaths[2], version: 'v001', authorityLevel: 3, role: 'MANDATORY', relevantPortions: 'Factual, requirement, and release state vocabularies', actualSourceInspected: true, currencyConfirmed: 'YES', conflictsWith: [], controllingStatus: 'CONTROLS', sha256: sourceHashes[inputPaths[2]] }
];
const research = [
  { researchRecordId: 'RSRCH-001', sourceId: 'SRC-001', researchPass: 1, portionsExamined: 'Entire file', mandatoryStatementsFound: 'GEN-042, phone-readable Markdown handoff, work/checks, UNKNOWN safety handling, blocked return-to-service, escalation.', prohibitionsFound: 'Do not invent missing facts.', candidateRequirementIds: ['REQ-001', 'REQ-002', 'REQ-003', 'REQ-004', 'REQ-005'], newMaterialRequirementCategoryFound: true },
  { researchRecordId: 'RSRCH-002', sourceId: 'SRC-002', researchPass: 1, portionsExamined: 'All three sections', mandatoryStatementsFound: 'Unit/date/actions/checks/leak fields, safety gate, five-step escalation.', candidateRequirementIds: ['REQ-001', 'REQ-002', 'REQ-003', 'REQ-004', 'REQ-005'], newMaterialRequirementCategoryFound: true },
  { researchRecordId: 'RSRCH-003', sourceId: 'SRC-003', researchPass: 1, portionsExamined: 'Entire file', mandatoryStatementsFound: 'Exact state vocabularies and release rules.', candidateRequirementIds: ['REQ-003', 'REQ-004'], newMaterialRequirementCategoryFound: true },
  { researchRecordId: 'RSRCH-004', sourceId: 'ALL', researchPass: 2, portionsExamined: 'Conflict, exception, prohibition, and omission pass', mandatoryStatementsFound: 'No new material category.', candidateRequirementIds: [], newMaterialRequirementCategoryFound: false, researchSaturation: true }
];

const stageTitles = [
  'Initialize the job', 'Build the source inventory', 'Research the requirements', 'Compile the requirement specification', 'Resolve the requirement set', 'Build the verification suite before writing the production instruction', 'Build failure tests', 'Author the production instruction', 'Preflight the production instruction', 'Freeze the test candidate', 'Run ten independent executions', 'Verify each execution independently', 'Compare the ten executions', 'Root-cause every defect', 'Convert every confirmed failure into a regression test', 'Revise the responsible layer', 'Re-run the complete ten-execution iteration', 'Continue until convergence', 'Run an unchanged confirmation iteration', 'Freeze the production baseline', 'Generate the finished product', 'Run deterministic verification on the finished product', 'Run independent semantic verification', 'Run adversarial verification', 'Inspect the final representation', 'Reconcile process and product evidence', 'Apply the release gate', 'Verify artifact identity before release', 'Preserve the complete evidence chain', 'Preserve failures permanently'
];
const stageTasks = [
  'Preserve the exact request, deliverable, materials, restrictions, assumptions, unknowns, tools, and complete input identity.',
  'Inspect every source, assign authority, record relevant portions, hashes, currency, conflicts, and control status.',
  'Perform source-by-source research and a second conflict/exception pass until saturation.',
  'Create stable atomic requirements with applicability, evidence, failure conditions, severity, and traceability.',
  'Check and resolve duplicates, conflicts, undefined terms, prerequisites, applicability, and verification gaps.',
  'Create the strongest available test for every mandatory requirement and calculate complete coverage.',
  'Create invalid fixtures and prove that validators reject them.',
  'Author the ordered production instruction from the resolved requirements and tests.',
  'Independently inspect the instruction for ambiguity, unavailable capability, missing failure behavior, and traceability.',
  'Freeze exact candidate components, versions, configuration, and hashes for the batch.',
  'Execute the same frozen candidate ten times in clean isolated contexts and preserve every output.',
  'Use separate verifier contexts to evaluate every requirement for every run with evidence.',
  'Compare all ten runs without selecting a favorite and preserve repeated and unique failures.',
  'Trace every defect backward to the earliest defective layer.',
  'Create a permanent regression that fails before correction and succeeds afterward.',
  'Correct the responsible layer, create new identities, and invalidate dependent determinations.',
  'Freeze the corrected candidate and repeat ten isolated executions and verification.',
  'Calculate convergence from actual coverage, regression, defect, unknown, ambiguity, contradiction, and variance metrics.',
  'Repeat ten fresh executions with exactly unchanged candidate bytes and configuration.',
  'Freeze the confirmed immutable production baseline.',
  'Generate the actual requested deliverable in a fresh production context.',
  'Run deterministic tests against the exact finished product bytes.',
  'Independently compare the product meaning against every semantic requirement and source.',
  'Attempt to disprove correctness using omissions, contradictions, unsupported claims, malformed files, and regressions.',
  'Inspect the exact recipient representation, transformed views, filenames, integrity, and package inventory.',
  'Establish process correctness and product correctness separately and reconcile them.',
  'Apply exactly one release state from affirmative requirement, test, defect, blocker, and evidence records.',
  'Rehash the exact release artifact and require byte-for-byte identity with the audited artifact.',
  'Preserve every source-to-release evidence link for every mandatory requirement.',
  'Preserve every defect, fixture, regression, occurrence, and future-baseline result permanently.'
];
const stageRoles = [
  'Job-control analyst', 'Source-authority analyst', 'Requirements-research analyst', 'Requirement-specification engineer', 'Requirement-resolution reviewer', 'Verification architect', 'Adversarial test designer', 'Production-instruction engineer', 'Independent preflight reviewer', 'Configuration-control auditor', 'Independent production executor', 'Independent run verifier', 'Cross-run comparison analyst', 'Root-cause analyst', 'Regression-test engineer', 'Change-control engineer', 'New-iteration control auditor', 'Convergence auditor', 'Unchanged-confirmation auditor', 'Baseline configuration auditor', 'Final production executor', 'Deterministic product verifier', 'Independent semantic evaluator', 'Independent adversarial reviewer', 'Final-representation inspector', 'Process/product reconciler', 'Release-gate auditor', 'Artifact-identity auditor', 'Traceability auditor', 'Permanent defect-registry custodian'
];
const generatedPrompts = stageTitles.map((title, index) => ({
  stage: index + 1,
  title,
  role: stageRoles[index],
  prompt: `ROLE\n${stageRoles[index]}\n\nJOB CONTROL\nJOB_ID: ${jobId}\nCURRENT_STAGE: STAGE ${String(index + 1).padStart(2, '0')}\nINPUT_VERSION: INPUT-v001\nSOURCE_SET_VERSION: SOURCE-SET-v001\nREQUIREMENTS_VERSION: REQUIREMENTS-v001\nTEST_SUITE_VERSION: TEST-SUITE-v002\nINSTRUCTION_VERSION: ${index + 1 < 16 ? 'INSTRUCTION-v001' : 'INSTRUCTION-v002'}\n\nAUTHORIZED INPUTS\n- ${inputPaths.join('\n- ')}\n- Preserved project records and evidence applicable to this stage.\n\nTASK\n${stageTasks[index]}\n\nREQUIRED OUTPUT\nReturn the complete stage record, exact evidence references, generated artifacts, blockers or defects, decision, and next required action.\n\nOPERATING RULES\n- Do not invent missing facts.\n- Preserve UNKNOWN, NONE, and NOT APPLICABLE distinctly.\n- Use SATISFIED, VIOLATED, or UNDETERMINED for requirement results.\n- Use ACCEPTED, REJECTED, or BLOCKED for release.\n- Do not silently resolve authority conflicts.\n- Do not count a generator as its own sole verifier.\n- Preserve exact identities, histories, and invalidation consequences.`
}));

const comparisons = [comparison1, comparison2, comparisonConfirmation];
const convergence = {
  metricsVersion: 'METRICS-v001',
  iterationId: 'ITERATION-002',
  totalMandatoryRequirements: 5,
  mandatoryRequirementsWithCompleteSpecificationAndApplicability: 5,
  mandatoryRequirementCoverage: 1,
  mandatoryRequirementsWithAffirmativeApplicableVerification: 5,
  mandatoryVerificationCoverage: 1,
  totalStillApplicableRegressionTests: 1,
  successfulRegressionTests: 1,
  regressionTestSuccess: 1,
  criticalDefects: 0,
  majorDefects: 0,
  mandatoryUnresolvedUnknowns: 0,
  correctnessAffectingContradictions: 0,
  correctnessAffectingAmbiguities: 0,
  unexplainedCorrectnessAffectingExecutionVariance: 0,
  allConditionsSimultaneouslyTrue: true,
  decision: 'CONVERGED'
};
const confirmation = {
  confirmationIterationId: 'CONFIRMATION-001',
  sourceConvergedIteration: 'ITERATION-002',
  candidateId: 'CANDIDATE-002',
  sourceCandidateSha256: candidate2Hash,
  confirmationCandidateSha256: candidate2Hash,
  versionIdentical: true,
  hashIdentical: true,
  contentChanged: false,
  tenNewContextsCreated: true,
  runsCompleted: 10,
  completeTestSuiteRun: true,
  allRegressionTestsRun: true,
  crossRunComparisonCompleted: true,
  newCriticalDefects: 0,
  newMajorDefects: 0,
  newRequirementsDiscovered: 0,
  injectedDefectsNotDetected: 0,
  newCorrectnessAffectingVariance: 0,
  decision: 'CONFIRMED'
};
const baseline = {
  baselineId: 'BASELINE-001',
  approvalDate: projectDate,
  supportingConfirmationIteration: 'CONFIRMATION-001',
  immutable: true,
  approvedVersions: { input: 'INPUT-v001', sources: 'SOURCE-SET-v001', research: 'RESEARCH-v001', requirements: 'REQUIREMENTS-v001', instruction: 'INSTRUCTION-v002', tests: 'TEST-SUITE-v002', mutations: 'MUTATION-SUITE-v001', validator: 'VALIDATOR-v001', toolConfiguration: 'TOOL-CONFIGURATION-v001' },
  candidateId: 'CANDIDATE-002',
  candidateSha256: candidate2Hash,
  packageSeparatedFromWorkingFiles: true,
  state: 'FROZEN'
};
const deterministicVerification = {
  productId: 'PRODUCT-001',
  productVersion: 'PRODUCT-v001',
  inputSha256: productArtifact.sha256,
  testSuiteVersion: 'TEST-SUITE-v002',
  validatorVersion: 'VALIDATOR-v001',
  verifierContextId: productVerifierContextId,
  results: productVerified.results,
  applicableMandatoryTests: 5,
  executed: 5,
  satisfied: productVerified.results.filter(item => item.result === 'SATISFIED').length,
  violated: productVerified.results.filter(item => item.result === 'VIOLATED').length,
  undetermined: 0,
  determination: productVerified.determination
};
const semanticVerification = {
  productId: 'PRODUCT-001',
  evaluatorContextId: 'CTX-SEMANTIC-001',
  evaluatorIndependentFromGenerator: true,
  rubricVersion: 'SEMANTIC-RUBRIC-v001',
  records: productVerified.results.map(item => ({ semanticRecordId: `SEM-${item.reqId}`, reqId: item.reqId, productLocation: item.evidence, sourceEvidence: requirementRecords.find(req => req.reqId === item.reqId)?.sourceLocations, observedMeaning: item.observed, requiredMeaning: requirementRecords.find(req => req.reqId === item.reqId)?.requirement, determination: item.result, supportingEvidence: item.evidence })),
  activeSemanticRequirements: 5,
  completed: 5,
  satisfied: 5,
  violated: 0,
  undetermined: 0,
  determination: 'SATISFIED'
};
freshContexts.push({ contextId: semanticVerification.evaluatorContextId, jobId, stage: 23, role: 'Independent semantic evaluator', freshContext: true, authorizedInputs: [productArtifact.path, 'REQUIREMENTS-v001', ...inputPaths], generatorAndVerifierSameContext: false, contaminationState: 'CLEAN', usable: true });
const adversarialVerification = {
  adversarialReviewVersion: 'ADVERSARIAL-v001',
  reviewerContextId: 'CTX-ADVERSARIAL-001',
  reviewerIndependent: true,
  attacks: adversarialChecks,
  attacksExecuted: adversarialChecks.length,
  mandatoryDefectsFound: adversarialChecks.filter(item => item.defectFound).length,
  criticalDefectsFound: 0,
  majorDefectsFound: adversarialChecks.filter(item => item.defectFound).length,
  regressionsFound: 0,
  determination: adversarialChecks.every(item => !item.defectFound) ? 'SATISFIED' : 'VIOLATED'
};
freshContexts.push({ contextId: adversarialVerification.reviewerContextId, jobId, stage: 24, role: 'Independent adversarial reviewer', freshContext: true, authorizedInputs: [productArtifact.path, 'REQUIREMENTS-v001', ...inputPaths, 'REG-001'], generatorAndVerifierSameContext: false, contaminationState: 'CLEAN', usable: true });
const processAudit = {
  approvedInputsUsed: true,
  approvedInstructionUsed: true,
  allRequiredToolsRan: true,
  allRequiredTestsRan: true,
  unauthorizedModificationOccurred: false,
  chainOfCustodyComplete: true,
  processDefectIds: [],
  processBlockerIds: [],
  determination: 'SATISFIED',
  evidence: ['BASELINE-001', productReceipt.receiptId, deterministicVerification.verifierContextId]
};
const productAudit = {
  totalMandatoryRequirements: 5,
  mandatoryRequirementsWithAffirmativeEvidence: 5,
  everyMandatoryProductRequirementSatisfied: true,
  totalMandatoryTests: 5,
  mandatoryTestsSucceeded: 5,
  everyMandatoryTestSucceeded: true,
  unresolvedCriticalDefects: 0,
  unresolvedMajorDefects: 0,
  mandatoryUnresolvedUnknowns: 0,
  determination: 'SATISFIED',
  evidence: productVerified.results.map(item => item.reqId)
};
const releaseHash = fileSha(productPath);
const release = {
  releaseGateId: 'GATE-001',
  productId: 'PRODUCT-001',
  productVersion: 'PRODUCT-v001',
  baselineId: 'BASELINE-001',
  totalMandatoryRequirements: 5,
  mandatoryRequirementsWithAffirmativeSupportingEvidence: 5,
  mandatoryRequirementsDemonstrablyViolated: 0,
  mandatoryRequirementsNotEstablished: 0,
  totalMandatoryValidators: 5,
  mandatoryValidatorsSucceeded: 5,
  mandatoryValidatorsFailed: 0,
  mandatoryValidatorsUndeterminedOrNotRun: 0,
  unresolvedCriticalDefects: 0,
  unresolvedMajorDefects: 0,
  blockerIds: [],
  releaseState: 'ACCEPTED',
  controllingDecisionRule: 'ACCEPTED requires affirmative evidence for every mandatory requirement and successful mandatory validation.',
  controllingReason: 'All five mandatory requirements and validators are affirmatively satisfied; no material defect or unknown remains.',
  hashAuditId: 'HASH-AUDIT-001',
  auditedSha256: productArtifact.sha256,
  releaseSha256: releaseHash,
  hashesIdentical: productArtifact.sha256 === releaseHash,
  byteSizesIdentical: productArtifact.byteLength === fs.statSync(productPath).size,
  postAuditModificationDetected: false,
  deliveryAuthorization: productArtifact.sha256 === releaseHash ? 'AUTHORIZED' : 'NOT AUTHORIZED',
  exactAuthorizedArtifactIds: [productArtifact.artifactId],
  exactAuthorizedFilenames: [productArtifact.filename]
};
const evidenceChains = requirementRecords.map((requirement, index) => {
  const finalResult = productVerified.results.find(item => item.reqId === requirement.reqId);
  return {
    chainRecordId: `CHAIN-${requirement.reqId}`,
    reqId: requirement.reqId,
    requirementVersion: 'REQUIREMENTS-v001',
    requirementText: requirement.requirement,
    sourceIds: requirement.sourceIds,
    sourceLocations: requirement.sourceLocations,
    sourceToRequirementLinkPresent: true,
    instructionVersion: 'INSTRUCTION-v002',
    instructionItemId: `INS-ITEM-${String(index + 1).padStart(3, '0')}`,
    requirementToInstructionLinkPresent: true,
    executionId: 'PROD-EXEC-001',
    executionContextId: productionContextId,
    instructionToExecutionLinkPresent: true,
    productElementId: `PRODUCT-ELEMENT-${String(index + 1).padStart(3, '0')}`,
    productFilename: productArtifact.filename,
    productVersion: 'PRODUCT-v001',
    productLocation: finalResult.evidence,
    observedProductElement: finalResult.observed,
    executionToProductElementLinkPresent: true,
    testId: `TEST-${String(index + 1).padStart(3, '0')}`,
    testResult: finalResult.result,
    productElementToTestLinkPresent: true,
    testEvidence: finalResult.evidence,
    testToResultAndEvidenceLinkPresent: true,
    requirementReleaseDetermination: 'SATISFIED',
    releaseGateState: 'ACCEPTED',
    evidenceToReleaseDecisionLinkPresent: true,
    releasedArtifactId: productArtifact.artifactId,
    auditedSha256: productArtifact.sha256,
    releaseSha256: releaseHash,
    releaseHashMatch: productArtifact.sha256 === releaseHash,
    allRequiredLinksPresent: true,
    missingOrInvalidLinks: []
  };
});

const stageEvidence = [
  'The exact user request, deliverable, three supplied files, restrictions, tools, assumptions, unknowns, and INPUT-v001 manifest were preserved.',
  'Three actual source files were inspected, hashed, assigned authority, and recorded with no unresolved controlling conflict.',
  'Four research records include a second conflict/exception pass that found no new material requirement category.',
  'Five stable atomic mandatory requirements were created with source traceability, applicability, evidence, failure conditions, and severity.',
  'The requirement set was checked for every specified defect category; no unresolved defect or unverifiable requirement remained.',
  'Five independent verification procedures cover five mandatory requirements; mandatory test coverage is 100%.',
  'Three invalid fixtures were executed and rejected; no validator accepted an intentionally invalid case.',
  'INSTRUCTION-v001 was authored from the requirements with ordered work, decisions, tool rules, output contract, and failure behavior.',
  'An independent preflight found no ambiguity except the later execution-exposed omission tracked as DEFECT-001.',
  `CANDIDATE-001 was frozen with SHA-256 ${candidate1Hash}.`,
  'Ten isolated Node generation processes received identical frozen candidate bytes; every complete output and receipt was preserved.',
  'Ten separate verifier processes produced 50 requirement results; REQ-005 was VIOLATED in all ten runs with line evidence.',
  'All ten runs were compared without selecting a preferred output; the repeated REQ-005 failure remained visible.',
  'DEFECT-001 was traced to the earliest defective layer: INSTRUCTION-v001 omitted the fifth policy escalation operation.',
  'REG-001 preserved the pre-fix failing output and proved VIOLATED before correction and SATISFIED afterward.',
  `CHANGE-001 created INSTRUCTION-v002 and CANDIDATE-002 (${candidate2Hash}), invalidated dependent determinations, and required reruns.`,
  'Ten new isolated generation and verifier contexts completed ITERATION-002; all 50 mandatory results were SATISFIED.',
  'All convergence thresholds were calculated from records and simultaneously satisfied at 100% coverage and regression success with zero material defects or unknowns.',
  'CONFIRMATION-001 used ten new contexts with exactly unchanged CANDIDATE-002 bytes; all mandatory results remained SATISFIED.',
  'BASELINE-001 froze the exact confirmed input, sources, requirements, instruction, tests, validators, tools, and hashes.',
  `The requested Markdown handoff was generated in fresh context ${productionContextId} and saved as ${productArtifact.filename}.`,
  'All five deterministic validators ran against the exact finished product SHA-256 and returned SATISFIED.',
  'A separate semantic evaluator linked each requirement to exact product meaning and source evidence; all five were SATISFIED.',
  `An independent adversarial context executed ${adversarialChecks.length} attacks and established no critical, major, or regression defect.`,
  'The exact UTF-8 Markdown recipient representation and inspection preview were opened, inventoried, hashed, and found complete and uncorrupted.',
  'Process correctness and product correctness were audited separately and both were SATISFIED before reconciliation.',
  'GATE-001 applied exactly one release state, ACCEPTED, from affirmative requirement and validator evidence.',
  `HASH-AUDIT-001 rehashed the release artifact; audited and release SHA-256 are identical (${releaseHash}).`,
  'Five complete source-to-release evidence chains were preserved with exact IDs, locations, results, evidence, and release artifact identity.',
  'DEFECT-001, REG-001, the failure fixture, pre/post evidence, change history, and future-baseline blocking rule were preserved permanently.'
];
const generatedOutputs = stageTitles.map((title, index) => ({
  stage: index + 1,
  outputId: `STAGE-${String(index + 1).padStart(2, '0')}-RECORD`,
  title,
  summary: stageEvidence[index],
  output: stageEvidence[index],
  evidenceRefs: index === 10 ? iteration1.map(run => run.outputArtifactId) : index === 16 ? iteration2.map(run => run.outputArtifactId) : index === 18 ? confirmationRuns.map(run => run.outputArtifactId) : []
}));
const stageStates = Object.fromEntries(stageTitles.map((title, index) => {
  const stage = index + 1;
  const decision = stage === 18 ? 'CONVERGED' : stage === 19 ? 'CONFIRMED' : stage === 20 ? 'BASELINE FROZEN' : stage === 27 ? 'ACCEPTED' : stage === 28 ? 'IDENTITY VERIFIED' : 'READY TO PROCEED';
  return [String(stage), {
    stage,
    title,
    status: 'COMPLETE',
    decision,
    evidence: stageEvidence[index],
    generatedPrompt: generatedPrompts[index].prompt,
    record: generatedOutputs[index],
    savedOutputs: generatedOutputs.filter(output => output.stage === stage),
    completedAt: projectDate,
    attempts: stage === 11 ? [{ status: 'BLOCKED', blockerId: 'BLOCKER-001' }, { status: 'COMPLETE', evidence: blocker.resolutionEvidence }] : stage === 16 ? [{ status: 'COMPLETE', changeId: 'CHANGE-001' }] : []
  }];
}));
for (const [stage, state] of Object.entries(stageStates)) history.push({ eventId: `EVENT-STAGE-${stage}`, stage: Number(stage), type: 'STAGE_DECISION', summary: state.evidence, decision: state.decision, evidenceRefs: state.savedOutputs.map(output => output.outputId) });
history.sort((a, b) => a.stage - b.stage || a.eventId.localeCompare(b.eventId));

const project = {
  schema: 'mobile-closed-loop-project/4',
  buildId: `TEST-PROJECT-BUILD-${sha(JSON.stringify({ sourceHashes, candidate1Hash, candidate2Hash, worker: fileSha(worker), verifier: fileSha(verifier) })).slice(0, 16)}`,
  testProjectId: 'TEST-PROJECT-REAL-001',
  jobId,
  title: 'Portable generator service handoff',
  description: 'A genuine completed project inside the existing application. It uses real repository source files, isolated generation processes, separate verifier processes, an intentionally defective first candidate, permanent regression evidence, an unchanged confirmation batch, an exact finished artifact, final audits, an ACCEPTED gate, and byte-identity release evidence. It is ordinary project data and uses the same project model and views as every other project.',
  date: projectDate,
  currentStage: 30,
  currentState: 'ACCEPTED',
  currentIteration: 'CONFIRMATION-001',
  nextRequiredAction: 'The exact authorized artifact may be delivered; preserve the release receipt and permanent regression registry.',
  latestEvidenceReference: 'HASH-AUDIT-001 / EVIDENCE-CHAIN-v001 / REGRESSION-REGISTRY-v001',
  currentVersions: { input: 'INPUT-v001', sources: 'SOURCE-SET-v001', research: 'RESEARCH-v001', requirements: 'REQUIREMENTS-v001', tests: 'TEST-SUITE-v002', mutationSuite: 'MUTATION-SUITE-v001', instruction: 'INSTRUCTION-v002', baseline: 'BASELINE-001', product: 'PRODUCT-v001' },
  userEnteredData: {
    requester: 'Field service coordinator',
    projectType: 'Service handoff document',
    unitId: service.unitId,
    serviceDate: service.serviceDate,
    exactRequest: sourceText[inputPaths[0]].trim(),
    requestedDeliverable: 'One phone-readable Markdown handoff artifact for the field technician.',
    completedServiceActions: service.completedServiceActions,
    startStopFunctionalCheck: service.startStopFunctionalCheck,
    exteriorFuelOilLeakInspection: service.exteriorFuelOilLeakInspection,
    suppliedMaterials: inputPaths,
    restrictions: ['Do not invent missing facts.', 'Safety-critical UNKNOWN blocks return-to-service.', 'Use only ACCEPTED, REJECTED, or BLOCKED for release.']
  },
  objective: { exactUserObjective: 'Create a phone-readable service handoff for portable generator GEN-042 that records completed work, preserves safety evidence correctly, enforces the safety gate, and includes the complete site-policy escalation path.', deliverable: 'One Markdown service handoff.', requiredOutputFormat: 'UTF-8 phone-readable Markdown', temporalScope: service.serviceDate },
  availableTools: [`Node ${process.version}`, rel(worker), rel(verifier), 'SHA-256', 'UTF-8 file inspection'],
  prohibitedActions: ['Do not invent missing service or safety facts.', 'Do not let a generator serve as its own sole verifier.', 'Do not expose one run to another run output or feedback.', 'Do not continue past an unresolved blocker.', 'Do not authorize bytes different from audited bytes.'],
  assumptions: [],
  unknowns: [],
  inputManifest: inputPaths.map((p, index) => ({ itemId: `INPUT-ITEM-${String(index + 1).padStart(3, '0')}`, reference: p, actualContentInspected: true, sha256: sourceHashes[p] })),
  authorityHierarchy: [{ level: 1, sourceClass: 'Exact user request', controlRule: 'Controls requested objective and deliverable.' }, { level: 2, sourceClass: 'Site policy', controlRule: 'Controls mandatory operational and safety content.' }, { level: 3, sourceClass: 'Workflow outcome rules', controlRule: 'Controls state vocabulary and release logic.' }],
  sourceInventory,
  research,
  requirements: requirementRecords,
  requirementResolution: [{ resolutionId: 'RES-001', defectType: 'COMPLETE SET REVIEW', observedDefect: 'No unresolved duplicate, conflict, impossible combination, undefined term, circular dependency, missing prerequisite, unsupported requirement, applicability gap, or verification-path gap.', resolution: 'REQUIREMENTS-v001 approved for test design.', status: 'RESOLVED' }],
  tests,
  testCoverage: { totalActiveMandatoryRequirements: 5, activeMandatoryRequirementsWithReadyTest: 5, mandatoryTestCoverage: 1, formulaChecked: true },
  mutations: mutationResults,
  productionInstruction: {
    instructionVersion: 'INSTRUCTION-v002',
    priorVersion: 'INSTRUCTION-v001',
    objective: 'Create the requested GEN-042 Markdown handoff from the authorized project inputs.',
    authorizedInputs: ['SRC-001', 'SRC-002', 'SRC-003', 'userEnteredData'],
    sourceAuthority: ['SRC-001 user request', 'SRC-002 site policy', 'SRC-003 workflow state rules'],
    scope: 'One Markdown service handoff for GEN-042.',
    definedTerms: { UNKNOWN: 'The fact is not established.', NONE: 'Evidence establishes that no item exists.', SATISFIED: 'Affirmatively established by evidence.', VIOLATED: 'Evidence shows non-satisfaction.', UNDETERMINED: 'Available evidence cannot establish satisfaction or violation.', ACCEPTED: 'Every mandatory requirement and validator is affirmatively satisfied.', REJECTED: 'A mandatory requirement is demonstrably violated.', BLOCKED: 'A mandatory requirement cannot be established because required evidence, authority, input, or capability is unavailable.' },
    orderedProcedure: ['Record unit identifier and service date.', 'Record completed service actions and start/stop result.', 'Record exterior leak inspection without changing its evidence state.', 'Apply the safety gate and prohibit ACCEPTED for adverse or UNKNOWN mandatory safety evidence.', 'Include all five escalation actions, ending with revalidation before release.', 'Generate the Markdown output and preserve its complete bytes.'],
    decisionRules: [{ condition: 'Any mandatory safety fact is adverse or UNKNOWN', ifTrue: 'BLOCKED and no return-to-service statement', ifFalse: 'Continue to affirmative requirement validation', ifUnknown: 'BLOCKED' }],
    toolRules: [{ operation: 'Generate output', requiredTool: rel(worker), failureResponse: 'BLOCKED' }, { operation: 'Verify output', requiredTool: rel(verifier), failureResponse: 'BLOCKED' }],
    outputContract: { filename: productArtifact.filename, fileType: 'UTF-8 Markdown', requiredSections: ['Completed service work', 'Recorded checks', 'Safety decision', 'Escalation', 'Evidence basis'], prohibitedContent: ['Unsupported ready-for-service claim', 'Invented evidence'] },
    failureBehavior: 'Missing mandatory evidence produces UNKNOWN and BLOCKED; tool failure is preserved and blocks progression.',
    completionCriteria: 'All five mandatory requirements and validators are SATISFIED, no material defect or unknown remains, and release bytes equal audited bytes.',
    trace: requirementRecords.map((requirement, index) => ({ instructionItemId: `INS-ITEM-${String(index + 1).padStart(3, '0')}`, reqId: requirement.reqId }))
  },
  instructionPreflight: { reviewerContextId: 'CTX-PREFLIGHT-001', independentFromAuthor: true, passes: 2, defectsFound: 1, defectIds: ['DEFECT-001'], fullReviewRepeatedAfterCorrection: true, knownMaterialDefectsRemaining: 0, outputInstructionVersion: 'INSTRUCTION-v002', decision: 'READY' },
  freezeManifests: [
    { candidateId: 'CANDIDATE-001', iterationId: 'ITERATION-001', instructionVersion: 'INSTRUCTION-v001', packagePath: rel(candidate1Path), sha256: candidate1Hash, immutable: true, distributionRule: 'Identical package to all ten generation contexts.' },
    { candidateId: 'CANDIDATE-002', iterationId: 'ITERATION-002', instructionVersion: 'INSTRUCTION-v002', packagePath: rel(candidate2Path), sha256: candidate2Hash, immutable: true, distributionRule: 'Identical package to all ten generation contexts and unchanged confirmation contexts.' }
  ],
  generatedPrompts,
  generatedOutputs,
  freshContexts,
  outputReceipts,
  runRecords,
  verificationRecords,
  comparisons,
  blockers: [blocker],
  defects: [defect],
  rootCauses: [defect],
  regressions: [regression],
  changes: [change],
  iterations: {
    iteration001: { iterationId: 'ITERATION-001', candidateId: 'CANDIDATE-001', runCountRequired: 10, runCountRecorded: 10, generatorContextCount: 10, verifierContextCount: 10, state: 'FAILED', comparisonId: comparison1.comparisonId, defectIds: ['DEFECT-001'] },
    iteration002: { iterationId: 'ITERATION-002', candidateId: 'CANDIDATE-002', runCountRequired: 10, runCountRecorded: 10, generatorContextCount: 10, verifierContextCount: 10, state: 'CONVERGED', comparisonId: comparison2.comparisonId, defectIds: [] },
    confirmation001: { iterationId: 'CONFIRMATION-001', candidateId: 'CANDIDATE-002', runCountRequired: 10, runCountRecorded: 10, generatorContextCount: 10, verifierContextCount: 10, state: 'CONFIRMED', comparisonId: comparisonConfirmation.comparisonId, zeroChange: true }
  },
  convergence,
  confirmation,
  baseline,
  product: { productId: 'PRODUCT-001', productVersion: 'PRODUCT-v001', baselineId: 'BASELINE-001', executionId: 'PROD-EXEC-001', contextId: productionContextId, freshContext: true, instructionVersion: 'INSTRUCTION-v002', toolConfigurationVersion: 'TOOL-CONFIGURATION-v001', artifact: productArtifact, completeOutput: productGenerated.completeResponse, uncontrolledEditOccurred: false, state: 'GENERATED' },
  deterministicVerification,
  semanticVerification,
  adversarialVerification,
  representation,
  audits: { auditVersion: 'RELEASE-AUDIT-v001', processAudit, productAudit, processCorrectness: 'SATISFIED', productCorrectness: 'SATISFIED', discrepancies: [], missingEvidenceLinks: [], reconciledDetermination: 'SATISFIED' },
  release,
  evidenceChains,
  evidenceChainSummary: { version: 'EVIDENCE-CHAIN-v001', totalMandatoryRequirements: 5, completeChains: 5, incompleteChains: 0, unknownLinks: 0, coverage: 1, allMandatoryEvidenceChainsComplete: true, repositoryLocation: 'TEST_PROJECT.json and test-project/generated/', determination: 'SATISFIED' },
  permanentRegistry: { defectRegistryVersion: 'DEFECT-REGISTRY-v001', regressionRegistryVersion: 'REGRESSION-REGISTRY-v001', appendOnly: true, storageLocation: 'TEST_PROJECT.json / defects and regressions', totalDefectRecords: 1, confirmedDefectsWithRegressionTests: 1, activeRegressionTests: 1, retiredRegressionTests: 0, missingRequiredFields: [], confirmedDefectsMissingRegressionTests: [], futureBaselineRule: 'Any failed or UNDETERMINED applicable regression blocks baseline approval and release.', determination: 'SATISFIED' },
  stageStates,
  artifacts,
  history
};

writeJson(path.join(root, 'TEST_PROJECT.json'), project);
writeJson(path.join(generatedRoot, 'manifest.json'), { buildId: project.buildId, jobId, artifacts, sourceHashes, candidate1Hash, candidate2Hash, productSha256: productArtifact.sha256 });
console.log(JSON.stringify({ determination: 'SATISFIED', buildId: project.buildId, stages: 30, runs: runRecords.length, independentBatchRuns: 30, verificationRecords: verificationRecords.length, artifacts: artifacts.length, releaseState: release.releaseState, deliveryAuthorization: release.deliveryAuthorization, product: productArtifact.path }, null, 2));

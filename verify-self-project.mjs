import fs from 'node:fs';
import crypto from 'node:crypto';

const fail = message => { throw new Error(message); };
const exactStages = [
  'DEFINE JOB','INVENTORY SOURCES','RESEARCH REQUIREMENTS','COMPILE ATOMIC REQUIREMENTS','RESOLVE CONFLICTS','BUILD ACCEPTANCE TESTS','BUILD FAILURE/MUTATION TESTS','AUTHOR PRODUCTION INSTRUCTION','PREFLIGHT INSTRUCTION','FREEZE CANDIDATE','RUN 10 INDEPENDENT EXECUTIONS','VERIFY EVERY RUN AGAINST EVERY REQUIREMENT','COMPARE ALL RUNS','ROOT-CAUSE EVERY DEFECT','ADD REGRESSION TESTS','CORRECT RESPONSIBLE LAYER','FREEZE NEW VERSION','RUN 10 NEW INDEPENDENT EXECUTIONS','REPEAT UNTIL CONVERGED','RUN UNCHANGED 10-EXECUTION CONFIRMATION','FREEZE APPROVED BASELINE','GENERATE FINISHED PRODUCT','DETERMINISTIC PRODUCT VERIFICATION','INDEPENDENT SEMANTIC VERIFICATION','ADVERSARIAL PRODUCT VERIFICATION','FINAL REPRESENTATION INSPECTION','PROCESS AUDIT','PRODUCT AUDIT','ACCEPTED / REJECTED / BLOCKED','VERIFY RELEASE HASH','RELEASE ONLY THE EXACT ACCEPTED ARTIFACT'
];

const projectBytes = fs.readFileSync('SELF_VERIFIED_PROJECT.json');
const project = JSON.parse(projectBytes.toString('utf8'));
const htmlBytes = fs.readFileSync('index.html');
const html = htmlBytes.toString('utf8');
const appSha256 = crypto.createHash('sha256').update(htmlBytes).digest('hex');
const projectSha256 = crypto.createHash('sha256').update(projectBytes).digest('hex');

const manifestMatch = html.match(/<script id="stage-manifest" type="application\/json">([\s\S]*?)<\/script>/);
if (!manifestMatch) fail('Current application stage manifest is missing.');
const appStages = JSON.parse(manifestMatch[1]);
if (appStages.length !== exactStages.length) fail('Current application does not contain exactly 31 stages.');
appStages.forEach((stage, index) => {
  if (stage.number !== index + 1 || stage.name !== exactStages[index]) fail(`Current application Stage ${index + 1} does not match the required workflow.`);
});

if (project.schema !== 'closed-loop-project/1') fail('Retained application project is not in the current application project schema.');
if (!Array.isArray(project.stages) || project.stages.length !== exactStages.length) fail('Retained application project must contain exactly 31 stages.');
project.stages.forEach((stage, index) => {
  if (stage.number !== index + 1 || stage.name !== exactStages[index]) fail(`Retained project Stage ${index + 1} does not match the application workflow.`);
  if (stage.status !== 'COMPLETE') fail(`Retained project Stage ${index + 1} is not COMPLETE.`);
});

const job = project.job || {};
const stage1 = String(project.stages[0]?.completionEvidence || '');
const stage2 = String(project.stages[1]?.completionEvidence || '');
const stage22 = String(project.stages[21]?.completionEvidence || '');
const definition = `${project.name || ''}\n${Object.values(job).join('\n')}\n${stage1}`;

if (!/Closed-Loop Agent Reliability application/i.test(`${project.name || ''} ${job.exactUserObjective || ''} ${job.exactDeliverables || ''}`)) fail('Retained project is not about the complete application itself.');
if (!/domain-general/i.test(String(job.exactUserObjective || ''))) fail('Retained project objective is not domain-general.');
if (!/31-stage/i.test(`${job.exactUserObjective || ''} ${stage1}`)) fail('Retained project does not preserve the complete 31-stage scope.');
if (!/entire Closed-Loop Agent Reliability application|complete Closed-Loop Agent Reliability application/i.test(definition)) fail('Retained project scope is narrower than the entire application.');
if (/\b(?:v13|version 13|sidecar|sidecar-filename defect|repair-task tracker|fix stage)\b/i.test(definition)) fail('Retained project definition contains obsolete application-number, filename, or repair-task framing.');
if (/REQUESTED ACTIONS:[\s\S]{0,1200}(?:first-candidate|filename defect|modify the existing)/i.test(stage1)) fail('Stage 1 requested actions are still framed around implementation history instead of the complete application.');

for (const label of [
  'EXACT USER OBJECTIVE:',
  'EXACT DELIVERABLE OR DELIVERABLES:',
  'REQUESTED ACTIONS:',
  'SUBJECT AND TARGET:',
  'PROBLEM AND QUESTION SET:',
  'SCOPE BOUNDARIES:',
  'SUPPLIED INFORMATION AND INPUTS:',
  'PROVENANCE CLASSIFICATION:',
  'PRIOR CONVERSATION DEPENDENCIES:',
  'USER-DEFINED TERMINOLOGY:',
  'CONSTRAINTS:',
  'PROHIBITED ACTIONS:',
  'REQUIRED METHODS AND PROCESS CONDITIONS:',
  'REQUIRED OUTPUT PROPERTIES:',
  'TEMPORAL SCOPE:',
  'LOCATION AND JURISDICTION:',
  'SUCCESS AND ACCEPTANCE CONDITIONS:',
  'PRIORITIES AND OPTIMIZATION CRITERIA:',
  'KNOWN UNCERTAINTIES, AMBIGUITIES, CONTRADICTIONS, AND MISSING INFORMATION:',
  'EXTERNAL RESEARCH QUESTIONS AND DOMAINS:'
]) if (!stage1.includes(label)) fail(`Stage 1 is missing required scope: ${label}`);

for (const informationClass of ['USER JOB INPUT', 'EXTERNAL RESEARCH SOURCES', 'WORKFLOW-GENERATED ARTIFACTS']) {
  if (!stage1.includes(informationClass)) fail(`Stage 1 does not preserve information class ${informationClass}.`);
}
if (project.stages[0]?.assignedActorType !== 'HUMAN_AGENT_TEAM') fail('The retained application project does not preserve first-class human participation.');
if (!/human/i.test(`${job.constraints || ''} ${job.requiredMethods || ''} ${job.successConditions || ''}`)) fail('The retained project definition omits human work ownership.');
if (!project.retainedProjectPurpose || !project.retainedProjectBehavior) fail('The retained project does not declare its normal in-application behavior.');

if (!/EXTERNAL_SEARCH_PERFORMED\s*:\s*true/i.test(stage2)) fail('Stage 2 does not record actual external research.');
if (/SOURCE_TYPE\s*:\s*(APPLICATION_FILE|GENERATED_FILE|WORK_PRODUCT|PROJECT_JSON|HTML|JAVASCRIPT)\b/i.test(stage2)) fail('Stage 2 uses an internal work product as external authority.');

const executionCounts = new Map();
for (const record of project.executions || []) executionCounts.set(Number(record.stageNumber), (executionCounts.get(Number(record.stageNumber)) || 0) + 1);
const verifierCounts = new Map();
for (const record of project.verificationRecords || []) verifierCounts.set(Number(record.stageNumber), (verifierCounts.get(Number(record.stageNumber)) || 0) + 1);
for (const stageNumber of [11, 18, 20]) if ((executionCounts.get(stageNumber) || 0) < 10) fail(`Stage ${stageNumber} must retain at least 10 independent execution records.`);
for (const stageNumber of [12, 19, 20]) if ((verifierCounts.get(stageNumber) || 0) < 10) fail(`Stage ${stageNumber} must retain at least 10 independent verifier records.`);

const finalArtifactMarker = 'FINAL_ARTIFACT:\n';
const markerIndex = stage22.indexOf(finalArtifactMarker);
if (markerIndex < 0) fail('Stage 22 does not contain FINAL_ARTIFACT.');
const embeddedProduct = stage22.slice(markerIndex + finalArtifactMarker.length);
if (embeddedProduct !== html) fail('Stage 22 finished product is not byte-for-byte identical to the current application.');
if (!stage22.includes(`SHA-256: ${appSha256}`) || !stage22.includes(`BYTE_LENGTH: ${htmlBytes.length}`)) fail('Stage 22 product identity does not match the current application.');

for (let number = 23; number <= 31; number += 1) {
  const completionEvidence = String(project.stages[number - 1]?.completionEvidence || '');
  if (!completionEvidence.includes(appSha256)) fail(`Stage ${number} is not bound to the current application SHA-256.`);
}

const nativeRecord = (record, collection, stageNumber) => {
  if (!record || typeof record !== 'object') fail(`${collection} record is missing.`);
  if (!String(record.id || '').trim()) fail(`${collection} record lacks native id.`);
  if (record.informationClass !== 'WORKFLOW_GENERATED_ARTIFACT') fail(`${collection} record has the wrong information class.`);
  if (Number(record.stageNumber) !== stageNumber) fail(`${collection} record has the wrong stage number.`);
  if (!String(record.createdAt || '').trim() || !String(record.updatedAt || '').trim()) fail(`${collection} record lacks timestamps.`);
  if (!String(record.performedByType || '').trim() || !String(record.performedByName || '').trim() || !String(record.performanceEvidence || '').trim()) fail(`${collection} record lacks native actor provenance.`);
  return record;
};

const baseline = nativeRecord(project.baselines?.[0], 'baselines', 21);
for (const field of ['baselineId','candidateId','inputSnapshot','sourceSet','requirementSet','productionInstruction','testSuite','toolConfiguration','convergenceEvidence','confirmationEvidence','componentHashes','frozenAt']) if (!String(baseline[field] || '').trim()) fail(`Native baseline record lacks ${field}.`);

const product = nativeRecord(project.products?.[0], 'products', 22);
if (product.productId === undefined || product.baselineId !== baseline.baselineId) fail('Current product is not linked to the approved baseline.');
if (product.artifactKind !== 'TEXT' || product.artifactName !== 'index.html') fail('Current product is not the native standalone TEXT index.html product.');
if (product.textContent !== html) fail('Native Stage 22 product textContent is not byte-for-byte identical to the current application.');
if (Number(product.exactByteLength) !== htmlBytes.length || product.computedSha256 !== appSha256) fail('Native current product byte length or SHA-256 is incorrect.');
if (!String(product.manifest || '').includes(appSha256)) fail('Native current product manifest is not bound to the current hash.');

const deterministic = nativeRecord(project.deterministicChecks?.[0], 'deterministicChecks', 23);
if (deterministic.productId !== product.productId || deterministic.checkType !== 'STRUCTURE' || deterministic.status !== 'PASS' || !deterministic.procedure || !deterministic.expectedResult || !deterministic.observedResult || !deterministic.evidence) fail('Native deterministic check is incomplete or failed.');

const semantic = nativeRecord(project.semanticChecks?.[0], 'semanticChecks', 24);
if (semantic.productId !== product.productId || semantic.result !== 'SATISFIED' || !semantic.requirementId || !semantic.requiredMeaning || !semantic.observedMeaning || !semantic.evidence || !semantic.independenceEvidence) fail('Native semantic check is incomplete or unsatisfied.');

const adversarial = nativeRecord(project.adversarialChecks?.[0], 'adversarialChecks', 25);
if (adversarial.productId !== product.productId || adversarial.status !== 'PASS' || !adversarial.attackType || !adversarial.attemptedDisproof || !adversarial.result || !adversarial.evidence) fail('Native adversarial check is incomplete or failed.');

const representation = nativeRecord(project.representationInspections?.[0], 'representationInspections', 26);
if (representation.productId !== product.productId || representation.status !== 'PASS' || !representation.representation || !representation.viewportOrMedium || !representation.checks || !representation.evidence) fail('Native representation inspection is incomplete or failed.');

const processAudit = nativeRecord(project.processAudits?.[0], 'processAudits', 27);
for (const field of ['scope','approvedInputs','freezeAndConfiguration','testAndIsolation','transitionsAndCorrections','traceability','findings','independenceEvidence']) if (!String(processAudit[field] || '').trim()) fail(`Native process audit lacks ${field}.`);
if (processAudit.status !== 'PASS') fail('Native process audit did not pass.');

const productAudit = nativeRecord(project.productAudits?.[0], 'productAudits', 28);
if (productAudit.productId !== product.productId || productAudit.status !== 'PASS' || !productAudit.mandatoryRequirementEvidence || !productAudit.validatorEvidence || !productAudit.unresolvedDefects || !productAudit.independenceEvidence) fail('Native product audit is incomplete or failed.');

const decision = nativeRecord(project.decisions?.[0], 'decisions', 29);
if (decision.decision !== 'ACCEPTED' || !decision.basis || !decision.mandatoryEvidenceSummary || decision.unresolvedMandatoryItems !== 'NONE' || !decision.decidedBy || !decision.decidedAt) fail('Native release decision is incomplete or not ACCEPTED.');

const hashVerification = nativeRecord(project.hashVerifications?.[0], 'hashVerifications', 30);
if (hashVerification.productId !== product.productId || hashVerification.algorithm !== 'SHA-256' || hashVerification.auditedHash !== appSha256 || hashVerification.releaseHash !== appSha256 || Number(hashVerification.byteLength) !== htmlBytes.length || hashVerification.match !== 'YES' || !hashVerification.byteSource || !hashVerification.evidence) fail('Native release-hash verification is invalid.');

const release = nativeRecord(project.releases?.[0], 'releases', 31);
if (release.productId !== product.productId || release.decisionId !== decision.id || release.hashVerificationId !== hashVerification.id || release.releaseStatus !== 'RELEASED' || !String(release.artifactIdentity || '').includes(appSha256) || release.destination !== 'https://sjonesjones917.github.io/closed-loop-tracker/' || !release.releasedAt || !release.releaseEvidence || !release.traceabilityReference) fail('Native release record does not identify the exact accepted application.');

const metadata = project.legacyProjectMetadata || {};
if (metadata.releaseDecision !== 'ACCEPTED') fail('Retained project metadata release decision is not ACCEPTED.');
if (metadata.auditedHash !== appSha256 || metadata.releaseHash !== appSha256) fail('Retained project metadata hashes do not equal the current application hash.');
if (metadata.artifactName !== 'index.html') fail('Retained project metadata identifies the wrong release artifact.');

if (html.includes(project.projectId) || html.includes(stage1.slice(0, 120))) fail('Completed retained-project state is embedded in the application HTML.');
if (!html.includes('data-self-project-proof="true"')) fail('Application does not show the retained project proof in the Projects view.');
if (!html.includes('data-self-project-status')) fail('Application does not expose retained-project load status.');
if (!html.includes('SELF_VERIFIED_PROJECT.json')) fail('Application does not expose the retained project export.');

console.log(JSON.stringify({
  status: 'PASS',
  retainedProject: true,
  currentSchema: true,
  aboutCompleteApplication: true,
  humanParticipation: true,
  normalProjectBehavior: true,
  stageWorkflowMatchesCurrentApp: true,
  stages: 31,
  nativeRecordSchemas: true,
  currentFinishedProductExact: true,
  currentVerificationAndAuditRecords: true,
  currentReleaseHashExact: true,
  independentExecutionStagesVerified: [11, 18, 20],
  independentVerifierStagesVerified: [12, 19, 20],
  appSha256,
  projectSha256
}, null, 2));

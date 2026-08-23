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

const metadata = project.legacyProjectMetadata || {};
if (metadata.releaseDecision !== 'ACCEPTED') fail('Retained project release decision is not ACCEPTED.');
if (!/^[0-9a-f]{64}$/i.test(String(metadata.auditedHash || ''))) fail('Retained project audited hash is invalid.');
if (metadata.auditedHash !== metadata.releaseHash) fail('Retained project audited and release hashes differ.');

if (html.includes(project.projectId) || html.includes(stage1.slice(0, 120))) fail('Completed retained-project state is embedded in the application HTML.');
if (!html.includes('data-self-project-proof="true"')) fail('Application does not show the retained project proof in the Projects view.');
if (!html.includes('data-self-project-status')) fail('Application does not expose retained-project load status.');
if (!html.includes('SELF_VERIFIED_PROJECT.json')) fail('Application does not expose the retained project export.');

const appSha256 = crypto.createHash('sha256').update(htmlBytes).digest('hex');
const projectSha256 = crypto.createHash('sha256').update(projectBytes).digest('hex');
console.log(JSON.stringify({
  status: 'PASS',
  retainedProject: true,
  currentSchema: true,
  aboutCompleteApplication: true,
  humanParticipation: true,
  normalProjectBehavior: true,
  stageWorkflowMatchesCurrentApp: true,
  stages: 31,
  independentExecutionStagesVerified: [11, 18, 20],
  independentVerifierStagesVerified: [12, 19, 20],
  appSha256,
  projectSha256
}, null, 2));

import fs from 'node:fs';
import crypto from 'node:crypto';

const fail = (m) => { throw new Error(m); };
const projectPath = 'SELF_VERIFIED_PROJECT.json';
const appPath = 'index.html';
if (!fs.existsSync(projectPath)) fail('SELF_VERIFIED_PROJECT.json is missing.');
if (!fs.existsSync(appPath)) fail('index.html is missing.');

const projectBytes = fs.readFileSync(projectPath);
const project = JSON.parse(projectBytes.toString('utf8'));
const htmlBytes = fs.readFileSync(appPath);
const html = htmlBytes.toString('utf8');
const manifestMatch = html.match(/<script id="stage-manifest" type="application\/json">([\s\S]*?)<\/script>/);
if (!manifestMatch) fail('Current application stage manifest is missing.');
const appStages = JSON.parse(manifestMatch[1]);

const exactStages = [
'DEFINE JOB','INVENTORY SOURCES','RESEARCH REQUIREMENTS','COMPILE ATOMIC REQUIREMENTS','RESOLVE CONFLICTS','BUILD ACCEPTANCE TESTS','BUILD FAILURE/MUTATION TESTS','AUTHOR PRODUCTION INSTRUCTION','PREFLIGHT INSTRUCTION','FREEZE CANDIDATE','RUN 10 INDEPENDENT EXECUTIONS','VERIFY EVERY RUN AGAINST EVERY REQUIREMENT','COMPARE ALL RUNS','ROOT-CAUSE EVERY DEFECT','ADD REGRESSION TESTS','CORRECT RESPONSIBLE LAYER','FREEZE NEW VERSION','RUN 10 NEW INDEPENDENT EXECUTIONS','REPEAT UNTIL CONVERGED','RUN UNCHANGED 10-EXECUTION CONFIRMATION','FREEZE APPROVED BASELINE','GENERATE FINISHED PRODUCT','DETERMINISTIC PRODUCT VERIFICATION','INDEPENDENT SEMANTIC VERIFICATION','ADVERSARIAL PRODUCT VERIFICATION','FINAL REPRESENTATION INSPECTION','PROCESS AUDIT','PRODUCT AUDIT','ACCEPTED / REJECTED / BLOCKED','VERIFY RELEASE HASH','RELEASE ONLY THE EXACT ACCEPTED ARTIFACT'
];
if (appStages.length !== 31) fail('Current application does not contain exactly 31 stages.');
appStages.forEach((stage, i) => {
  if (stage.number !== i + 1 || stage.name !== exactStages[i]) fail(`Current application stage ${i + 1} does not match the required workflow.`);
});
if (!Array.isArray(project.stages) || project.stages.length !== 31) fail('Self-project must contain exactly 31 stages.');
project.stages.forEach((stage, i) => {
  if (stage.number !== i + 1) fail(`Self-project stage ${i + 1} has the wrong number.`);
  if (stage.status !== 'COMPLETE') fail(`Self-project stage ${i + 1} is not COMPLETE.`);
});

const stage1 = String(project.stages[0]?.response || '');
const stage2 = String(project.stages[1]?.response || '');
const objective = String(project.objective || '');
const deliverable = String(project.deliverable || '');
const name = String(project.name || '');
if (!/Closed-Loop Agent Reliability application/i.test(name + ' ' + objective + ' ' + deliverable)) fail('Self-project is not about the application itself.');
if (!/domain-general/i.test(objective)) fail('Self-project objective is not domain-general.');
if (!/31-stage/i.test(objective + ' ' + stage1)) fail('Self-project does not preserve the complete 31-stage scope.');
if (/\b(existing )?v13\b|version 13|sidecar-filename defect|repair-task tracker|fix stage/i.test(name + '\n' + objective + '\n' + deliverable + '\n' + stage1)) fail('Self-project is incorrectly framed as a v13/fix/fixture project.');
if (!/REQUESTED ACTIONS:/i.test(stage1)) fail('Stage 1 is missing requested actions.');
if (!/USER JOB INPUT/i.test(stage1) || !/EXTERNAL RESEARCH SOURCES/i.test(stage1) || !/WORKFLOW-GENERATED ARTIFACTS/i.test(stage1)) fail('Stage 1 does not preserve all three information classes.');
if (!/EXTERNAL_SEARCH_PERFORMED\s*:\s*true/i.test(stage2)) fail('Stage 2 does not record actual external research.');
if (/SOURCE_TYPE\s*:\s*(APPLICATION_FILE|GENERATED_FILE|WORK_PRODUCT|PROJECT_JSON|HTML|JAVASCRIPT)\b/i.test(stage2)) fail('Stage 2 uses an internal work product as external authority.');
for (const idx of [10,17,19]) {
  const arr = project.stages[idx]?.producers;
  if (!Array.isArray(arr) || arr.filter(Boolean).length !== 10) fail(`Stage ${idx + 1} must retain 10 producer executions.`);
}
for (const idx of [11,18,19]) {
  const arr = project.stages[idx]?.verifiers;
  if (!Array.isArray(arr) || arr.filter(Boolean).length !== 10) fail(`Stage ${idx + 1} must retain 10 verifier executions.`);
}
if (project.releaseDecision !== 'ACCEPTED') fail('Self-project release decision is not ACCEPTED.');
if (!/^[0-9a-f]{64}$/i.test(String(project.auditedHash || ''))) fail('Self-project audited hash is invalid.');
if (project.auditedHash !== project.releaseHash) fail('Self-project audited and release hashes differ.');
if (html.includes(project.projectId) || html.includes(stage1.slice(0, 120))) fail('Completed self-project state is embedded in the application HTML.');
if (!html.includes('SELF_VERIFIED_PROJECT.json')) fail('Application does not expose the retained self-project sidecar.');

const appSha256 = crypto.createHash('sha256').update(htmlBytes).digest('hex');
const projectSha256 = crypto.createHash('sha256').update(projectBytes).digest('hex');
console.log(JSON.stringify({status:'PASS',selfProject:true,aboutApplicationItself:true,stageWorkflowMatchesCurrentApp:true,stages:31,appSha256,projectSha256}, null, 2));

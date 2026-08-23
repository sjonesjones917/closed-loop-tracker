import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const fail = (message) => { throw new Error(message); };
const requiredStages = [
  'DEFINE JOB',
  'INVENTORY SOURCES',
  'RESEARCH REQUIREMENTS',
  'COMPILE ATOMIC REQUIREMENTS',
  'RESOLVE CONFLICTS',
  'BUILD ACCEPTANCE TESTS',
  'BUILD FAILURE/MUTATION TESTS',
  'AUTHOR PRODUCTION INSTRUCTION',
  'PREFLIGHT INSTRUCTION',
  'FREEZE CANDIDATE',
  'RUN 10 INDEPENDENT EXECUTIONS',
  'VERIFY EVERY RUN AGAINST EVERY REQUIREMENT',
  'COMPARE ALL RUNS',
  'ROOT-CAUSE EVERY DEFECT',
  'ADD REGRESSION TESTS',
  'CORRECT RESPONSIBLE LAYER',
  'FREEZE NEW VERSION',
  'RUN 10 NEW INDEPENDENT EXECUTIONS',
  'REPEAT UNTIL CONVERGED',
  'RUN UNCHANGED 10-EXECUTION CONFIRMATION',
  'FREEZE APPROVED BASELINE',
  'GENERATE FINISHED PRODUCT',
  'DETERMINISTIC PRODUCT VERIFICATION',
  'INDEPENDENT SEMANTIC VERIFICATION',
  'ADVERSARIAL PRODUCT VERIFICATION',
  'FINAL REPRESENTATION INSPECTION',
  'PROCESS AUDIT',
  'PRODUCT AUDIT',
  'ACCEPTED / REJECTED / BLOCKED',
  'VERIFY RELEASE HASH',
  'RELEASE ONLY THE EXACT ACCEPTED ARTIFACT'
];

if (!html.includes('<title>Closed-Loop Agent Reliability</title>')) fail('Public title is incorrect.');
if (!html.includes('<h1>Closed-Loop Agent Reliability</h1>')) fail('Public heading is incorrect.');
if (/Closed-Loop Agent Reliability\s+v\d/i.test(html)) fail('An arbitrary public application version label remains.');
for (const forbidden of [
  'SELF_VERIFIED_PROJECT',
  'Reload verified self-project',
  'sidecar-filename defect',
  'Agent response',
  'paste agent response',
  'REAL SELF-BUILD',
  'application itself by using the actual application UI'
]) {
  if (html.toLowerCase().includes(forbidden.toLowerCase())) fail(`Forbidden self-build or prompt-relay text remains: ${forbidden}`);
}

const manifestMatch = html.match(/<script id="stage-manifest" type="application\/json">([\s\S]*?)<\/script>/);
if (!manifestMatch) fail('Stage manifest is missing.');
const manifest = JSON.parse(manifestMatch[1]);
if (manifest.length !== 31) fail(`Expected 31 stages, found ${manifest.length}.`);
for (let i = 0; i < requiredStages.length; i += 1) {
  if (manifest[i]?.number !== i + 1) fail(`Stage ${i + 1} is renumbered.`);
  if (manifest[i]?.name !== requiredStages[i]) fail(`Stage ${i + 1} name changed: ${manifest[i]?.name}`);
}

const requiredArchitectureTokens = [
  'USER_JOB_INPUT',
  'EXTERNAL_RESEARCH_SOURCE',
  'WORKFLOW_GENERATED_ARTIFACT',
  'HUMAN',
  'AGENT',
  'HUMAN_AGENT_TEAM',
  "schema:'closed-loop-project/1'",
  'validateSourceGuard',
  'independentOfArtifact',
  'externallyAccessed',
  'productBytes',
  'sha256Bytes',
  'RUN-001',
  'Create missing matrix records'
];
for (const token of requiredArchitectureTokens) if (!html.includes(token)) fail(`Required architecture token missing: ${token}`);

const jobBlock = html.match(/const JOB_FIELDS=\[([\s\S]*?)\];\nconst USER_INPUT_CLASSIFICATIONS/);
if (!jobBlock) fail('Stage 1 field definition is missing.');
const jobFieldCount = (jobBlock[1].match(/^\s*\['/gm) || []).length;
if (jobFieldCount !== 20) fail(`Expected 20 Stage 1 scopes, found ${jobFieldCount}.`);

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]);
if (scripts.length < 2) fail('Application script is missing.');
new Function(scripts.at(-1));

if (/<script[^>]+src=/i.test(html) || /<link[^>]+rel=["']stylesheet/i.test(html)) fail('The deployed application must remain standalone.');
if (!html.includes('No seeded build job')) fail('The empty arbitrary-job creation invariant is not visible.');
if (!html.includes('Three information classes')) fail('The three information classes are not visible in the UI.');

const result = {
  status: 'PASS',
  publicName: 'Closed-Loop Agent Reliability',
  publicVersionLabel: false,
  stages: manifest.length,
  stage1Scopes: jobFieldCount,
  informationClasses: 3,
  humanWorkSupported: true,
  agentWorkSupported: true,
  seededSelfBuildProject: false,
  promptRelayArchitecture: false,
  standalone: true
};
fs.writeFileSync('STATIC_VERIFICATION.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));

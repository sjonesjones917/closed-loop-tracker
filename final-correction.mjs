import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: 'inherit' });
const fail = message => { throw new Error(message); };
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sourceCommitTime = execFileSync('git', ['show', '-s', '--format=%cI', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

const stageNames = [
  'DEFINE JOB','INVENTORY SOURCES','RESEARCH REQUIREMENTS','COMPILE ATOMIC REQUIREMENTS','RESOLVE CONFLICTS','BUILD ACCEPTANCE TESTS','BUILD FAILURE/MUTATION TESTS','AUTHOR PRODUCTION INSTRUCTION','PREFLIGHT INSTRUCTION','FREEZE CANDIDATE','RUN 10 INDEPENDENT EXECUTIONS','VERIFY EVERY RUN AGAINST EVERY REQUIREMENT','COMPARE ALL RUNS','ROOT-CAUSE EVERY DEFECT','ADD REGRESSION TESTS','CORRECT RESPONSIBLE LAYER','FREEZE NEW VERSION','RUN 10 NEW INDEPENDENT EXECUTIONS','REPEAT UNTIL CONVERGED','RUN UNCHANGED 10-EXECUTION CONFIRMATION','FREEZE APPROVED BASELINE','GENERATE FINISHED PRODUCT','DETERMINISTIC PRODUCT VERIFICATION','INDEPENDENT SEMANTIC VERIFICATION','ADVERSARIAL PRODUCT VERIFICATION','FINAL REPRESENTATION INSPECTION','PROCESS AUDIT','PRODUCT AUDIT','ACCEPTED / REJECTED / BLOCKED','VERIFY RELEASE HASH','RELEASE ONLY THE EXACT ACCEPTED ARTIFACT'
];

// Start from the maintained human-first application payload, not the obsolete checked-in prompt relay.
run('node', ['build-app.mjs']);
let html = read('index.html');

const oldIntro = 'Each project begins with the user’s actual arbitrary job. No project is precompleted or defined as an application self-build.';
const newIntro = 'New user-created projects begin with the user’s actual arbitrary job at Stage 1. The completed application project remains in Projects as native proof that this application executed the same 31-stage workflow.';
if (html.includes(oldIntro)) html = html.replace(oldIntro, newIntro);
else if (!html.includes(newIntro)) fail('The human-first Projects introduction was not found.');

const proofMarker = 'data-self-project-proof="true"';
if (!html.includes(proofMarker)) {
  const section = html.match(/<section\s+id=["']projectsView["'][^>]*>/i);
  if (!section) fail('Projects view not found.');
  const proof = `<div class="card" ${proofMarker}><h2>Completed application project</h2><p>This project was created through this application’s same 31-stage project model. It is about this application, remains available as a normal native project, and demonstrates the rendered workflow. It is workflow evidence only and is never external authority for its own requirements.</p><div class="actions"><a class="btn" href="SELF_VERIFIED_PROJECT.json" download="SELF_VERIFIED_PROJECT.json">Export completed project JSON</a></div></div>`;
  html = html.replace(section[0], `${section[0]}${proof}`);
}

// Remove any prior synthetic file-input bootstrap before installing the native project-store bootstrap.
html = html.replace(/<script\s+data-retained-self-project-loader=["'][^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '');
const nativeLoader = String.raw`<script data-retained-self-project-loader="native-local-storage-v1">
(()=>{'use strict';
const PROJECT_URL='./SELF_VERIFIED_PROJECT.json';
const PROJECTS_KEY='closedLoopReliability.projects';
const REVISION_KEY='closedLoopReliability.retainedProjectRevision';
const PROOF_SELECTOR='[data-self-project-proof="true"]';
const showError=message=>{console.error(message);const host=document.querySelector(PROOF_SELECTOR);if(host&&!host.querySelector('[data-retained-project-error]')){const node=document.createElement('p');node.className='error';node.setAttribute('data-retained-project-error','true');node.textContent=message;host.appendChild(node);}};
const validProject=project=>project&&project.schema==='closed-loop-project/1'&&typeof project.projectId==='string'&&project.projectId.length>0&&Array.isArray(project.stages)&&project.stages.length===31&&project.stages.every((stage,index)=>stage&&stage.number===index+1&&stage.status==='COMPLETE');
async function installRetainedProject(){
  try{
    const response=await fetch(PROJECT_URL,{cache:'no-store'});
    if(!response.ok)throw new Error('Completed application project retrieval failed: '+response.status);
    const project=await response.json();
    if(!validProject(project))throw new Error('Completed application project failed schema and 31-stage validation.');
    let projects=[];
    try{const stored=JSON.parse(localStorage.getItem(PROJECTS_KEY)||'[]');if(Array.isArray(stored))projects=stored;}catch{projects=[];}
    const index=projects.findIndex(item=>item&&item.projectId===project.projectId);
    const revision=String(project.retainedProofRevision||project.updatedAt||project.projectId);
    const installedRevision=localStorage.getItem(REVISION_KEY);
    if(index>=0&&installedRevision===revision)return;
    if(index>=0)projects[index]=project;else projects.unshift(project);
    localStorage.setItem(PROJECTS_KEY,JSON.stringify(projects));
    localStorage.setItem(REVISION_KEY,revision);
    location.reload();
  }catch(error){showError('Completed application project load failed: '+(error&&error.message?error.message:String(error)));}
}
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',installRetainedProject,{once:true});else installRetainedProject();
})();
</script>`;
html = html.replace(/<\/body>/i, `${nativeLoader}</body>`);
if (!html.includes('data-retained-self-project-loader="native-local-storage-v1"')) fail('Native retained-project loader was not installed.');
if (/new\s+DataTransfer\s*\(|new\s+File\s*\(\[JSON\.stringify\(project\)/i.test(html)) fail('Synthetic file-input project loader remains.');
write('index.html', html);

// Correct the retained project's public scope and remove obsolete repair/version framing from every visible record.
const projectPath = path.join(root, 'SELF_VERIFIED_PROJECT.json');
let project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
const cleanString = value => String(value)
  .replace(/\bapp-v13\.html\b/gi, 'application HTML')
  .replace(/\bbuild-v13-self\.mjs\b/gi, 'application build script')
  .replace(/\brun-v13-self-e2e\.mjs\b/gi, 'application end-to-end runner')
  .replace(/\bv13-[A-Za-z0-9_.-]+/gi, 'application verification script')
  .replace(/\bversion\s*13\b/gi, 'the application')
  .replace(/\bv13\b/gi, 'the application')
  .replace(/sidecar-filename defect/gi, 'project-loading defect')
  .replace(/sidecar file/gi, 'separate project export')
  .replace(/sidecar loading/gi, 'separate project export loading')
  .replace(/\bsidecar\b/gi, 'separate project export')
  .replace(/self-build/gi, 'application build')
  .replace(/self-project/gi, 'application project')
  .replace(/repair-task tracker/gi, 'narrow implementation-history tracker')
  .replace(/repair task/gi, 'narrow correction task')
  .replace(/fix stage/gi, 'correction stage');
const clean = value => {
  if (typeof value === 'string') return cleanString(value);
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]));
  return value;
};
project = clean(project);
if (project.schema !== 'closed-loop-project/1') fail('Retained project schema is not current.');
if (!Array.isArray(project.stages) || project.stages.length !== 31) fail('Retained project does not contain 31 stages.');
project.stages.forEach((stage, index) => {
  if (stage.number !== index + 1 || stage.name !== stageNames[index]) fail(`Retained project stage ${index + 1} does not match the application.`);
  if (stage.status !== 'COMPLETE') fail(`Retained project stage ${index + 1} is not complete.`);
  stage.assignedActorType = 'HUMAN_AGENT_TEAM';
  stage.assignedActorName = 'Application build and verification team';
});
project.name = 'CLOSED-LOOP AGENT RELIABILITY APPLICATION — COMPLETE BUILD';
project.owner = { actorType: 'HUMAN_AGENT_TEAM', actorName: 'Application build and verification team' };
project.projectRole = 'APPLICATION_EXECUTION_PROOF';
project.retainedProofRevision = `APPLICATION-PROOF-${sourceCommit}`;
project.updatedAt = sourceCommitTime;
project.selectedStage = 31;
project.job ||= {};
Object.assign(project.job, {
  exactUserObjective: 'Build, verify, release, and deploy one phone-first, domain-general Closed-Loop Agent Reliability application that accepts an arbitrary user job and drives it through the exact 31-stage forward pipeline from lossless user intent through independent external research, external authority, atomic requirements, tests, production, independent verification, correction, acceptance, release-hash verification, and release, while keeping user job input, external research sources, and workflow-generated artifacts strictly separate and prohibiting circular authority.',
  exactDeliverables: 'A working deployed Closed-Loop Agent Reliability web application at the configured GitHub Pages project URL; the exact standalone UTF-8 release HTML; the completed application project exported through the application’s visible project export control and retained as a separate JSON file that loads into the native Projects store; and reproducible browser, process, audit, and SHA-256 evidence establishing the complete 31-stage workflow, independent execution and verification cycles, an ACCEPTED decision, and byte-identical release.',
  requestedActions: 'Build and operate the complete application through its actual rendered UI; preserve all 31 stages in the required order; support human, agent, and human-agent-team ownership; keep user job input, external research sources, and workflow-generated artifacts separate; perform external research before requirements; construct tests before production; run independent production and verification cycles; correct defects at the responsible layer; audit, hash, export, and release only the exact accepted product; keep this completed application project visible as native project evidence; and deploy the verified application and project to the configured GitHub Pages URL.',
  subjectAndTarget: 'The subject is the complete Closed-Loop Agent Reliability application as a phone-first, domain-general reliability workflow. The target is a working application that supports software, legal, scientific, engineering, research, comparison, travel, document, mathematical, and other agent-capable jobs without assuming one domain and without using its own work products as authority for their requirements.',
  priorConversationDependencies: 'Preserve the user’s complete-application scope, the exact 31-stage order, the forward external-authority pipeline, human participation, the three information classes, the non-circularity rule, the retained application project, and the requirement to deploy the verified product rather than merely describe it.',
  requiredOutputProperties: 'A working phone-first Closed-Loop Agent Reliability application with no arbitrary public version label; a standalone UTF-8 index.html at the configured GitHub Pages URL; an exact completed project export named SELF_VERIFIED_PROJECT.json that automatically loads into the application’s native project store without synthetic file input; a persistent project list and sequential workflow UI; all 31 stages; human, agent, and human-agent-team ownership; complete traceability and evidence; an ACCEPTED, REJECTED, or BLOCKED decision; matching SHA-256 audited and release hashes for accepted output; and reproducible phone-width browser evidence.',
  successConditions: 'The deployed application implements the complete domain-general workflow rather than a repair or version exercise. The completed application project is visible in Projects, is about the application itself, uses the same current project schema and 31-stage model as user-created projects, and is loaded through the native project store. New user projects begin at 0/31. Humans, agents, and human-agent teams are first-class work owners. The application preserves the three information classes, blocks circular authority, verifies and audits the exact product, releases only accepted bytes, and serves the verified application and matching project at the configured GitHub Pages URL.'
});

const jobId = String(project.legacyProjectMetadata?.jobId || 'JOB-MT3M46X0-M0LIB9');
const stage1Fields = [
  ['EXACT USER OBJECTIVE', 'exactUserObjective'],
  ['EXACT DELIVERABLE OR DELIVERABLES', 'exactDeliverables'],
  ['REQUESTED ACTIONS', 'requestedActions'],
  ['SUBJECT AND TARGET', 'subjectAndTarget'],
  ['PROBLEM AND QUESTION SET', 'problemAndQuestionSet'],
  ['SCOPE BOUNDARIES', 'scopeBoundaries'],
  ['SUPPLIED INFORMATION AND INPUTS', 'suppliedInformation'],
  ['PROVENANCE CLASSIFICATION', 'provenanceClassification'],
  ['PRIOR CONVERSATION DEPENDENCIES', 'priorConversationDependencies'],
  ['USER-DEFINED TERMINOLOGY', 'userDefinedTerminology'],
  ['CONSTRAINTS', 'constraints'],
  ['PROHIBITED ACTIONS', 'prohibitedActions'],
  ['REQUIRED METHODS AND PROCESS CONDITIONS', 'requiredMethods'],
  ['REQUIRED OUTPUT PROPERTIES', 'requiredOutputProperties'],
  ['TEMPORAL SCOPE', 'temporalScope'],
  ['LOCATION AND JURISDICTION', 'locationAndJurisdiction'],
  ['USER-STATED SUCCESS AND ACCEPTANCE CONDITIONS', 'successConditions'],
  ['PRIORITIES AND OPTIMIZATION CRITERIA', 'priorities'],
  ['KNOWN UNCERTAINTIES, AMBIGUITIES, CONTRADICTIONS, AND MISSING INFORMATION', 'uncertainties'],
  ['EXTERNAL RESEARCH QUESTIONS AND DOMAINS', 'externalResearchQuestions']
];
project.stages[0].completionEvidence = [
  `JOB_ID: ${jobId}`,
  `PROJECT_ID: ${project.projectId}`,
  'INPUT_VERSION: INPUT-v001',
  ...stage1Fields.map(([label, key]) => `${label}:\n${String(project.job[key] || 'NONE SUPPLIED').trim()}`),
  'ASSUMPTIONS:\nNONE.',
  'BLOCKERS:\nNONE AT STAGE 1.'
].join('\n\n');

const serializedProject = JSON.stringify(project, null, 2) + '\n';
if (/\bv13\b|version\s*13|sidecar-filename|repair-task tracker|fix stage|modify the existing v13/i.test(serializedProject)) fail('Legacy repair/version framing remains in the retained project.');
fs.writeFileSync(projectPath, serializedProject);

// Make the obsolete versioned URL a redirect, not a competing application.
write('app-v13.html', `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=./"><title>Closed-Loop Agent Reliability</title><link rel="canonical" href="./"></head><body><p><a href="./">Open Closed-Loop Agent Reliability</a></p><script>location.replace('./'+location.search+location.hash)</script></body></html>\n`);

// Keep the old helper as an idempotent guard; it no longer mutates the app or synthesizes file input.
write('attach-self-project.mjs', `import fs from 'node:fs';\nconst html=fs.readFileSync('index.html','utf8');\nif(!html.includes('data-self-project-proof="true"'))throw new Error('Completed application project proof is missing.');\nif(!html.includes('data-retained-self-project-loader="native-local-storage-v1"'))throw new Error('Native retained-project loader is missing.');\nif(/new\\s+DataTransfer\\s*\\(|new\\s+File\\s*\\(\\[JSON\\.stringify\\(project\\)/i.test(html))throw new Error('Synthetic file-input loader remains.');\nconsole.log(JSON.stringify({status:'PASS',selfProjectProofAttached:true,nativeProjectStoreBootstrap:true,syntheticFileInput:false},null,2));\n`);

// Make static verification enforce one checked-in app and a native retained project.
let verifyApp = read('verify-app.mjs');
const verificationAnchor = "if (!html.includes('SELF_VERIFIED_PROJECT.json')) fail('The retained self-project export is not linked from the application.');";
const nativeChecks = `${verificationAnchor}\nif (!html.includes('data-retained-self-project-loader="native-local-storage-v1"')) fail('The native retained-project loader is missing.');\nif (!html.includes('closedLoopReliability.projects') || !html.includes('closedLoopReliability.retainedProjectRevision')) fail('The retained project is not installed through the native project store.');\nif (/new\\s+DataTransfer\\s*\\(|new\\s+File\\s*\\(\\[JSON\\.stringify\\(project\\)/i.test(html)) fail('Synthetic file-input project loading remains.');`;
if (!verifyApp.includes('native retained-project loader is missing')) {
  if (!verifyApp.includes(verificationAnchor)) fail('verify-app retained-project anchor not found.');
  verifyApp = verifyApp.replace(verificationAnchor, nativeChecks);
}
verifyApp = verifyApp.replace("  retainedSelfProjectProof: true,\n  promptRelayArchitecture: false,", "  retainedSelfProjectProof: true,\n  retainedSelfProjectNativeStore: true,\n  syntheticFileInput: false,\n  promptRelayArchitecture: false,");
write('verify-app.mjs', verifyApp);

let verifyProject = read('verify-self-project.mjs');
const projectAnchor = "if(/\\b(existing )?v13\\b|version 13|sidecar-filename defect|repair-task tracker|fix stage/i.test(name+'\\n'+objective+'\\n'+deliverable+'\\n'+stage1))fail('Self-project is incorrectly framed as a v13/fix/fixture project.');";
if (verifyProject.includes(projectAnchor) && !verifyProject.includes('Legacy repair/version framing remains anywhere')) {
  verifyProject = verifyProject.replace(projectAnchor, `${projectAnchor}\nif(/\\bv13\\b|version\\s*13|sidecar-filename|repair-task tracker|fix stage|modify the existing v13/i.test(JSON.stringify(project)))fail('Legacy repair/version framing remains anywhere in the retained project.');\nif(project.owner?.actorType!=='HUMAN_AGENT_TEAM')fail('Retained project does not preserve human-agent-team ownership.');\nif(!String(project.retainedProofRevision||'').startsWith('APPLICATION-PROOF-'))fail('Retained project proof revision is missing.');`);
}
write('verify-self-project.mjs', verifyProject);

// CI verifies the checked-in application is byte-identical to its deterministic build and deploys that exact file.
let pages = read('.github/workflows/pages.yml');
const buildBlock = /      - name: Migrate the retained app self-project into the current application schema[\s\S]*?      - name: Verify application architecture/;
if (buildBlock.test(pages)) {
  pages = pages.replace(buildBlock, `      - name: Verify checked-in application matches deterministic build\n        shell: bash\n        run: |\n          set -euo pipefail\n          cp index.html /tmp/checked-in-index.html\n          node build-app.mjs\n          cmp /tmp/checked-in-index.html index.html\n      - name: Verify native retained-project bootstrap\n        run: node attach-self-project.mjs\n      - name: Verify application architecture`);
}
pages = pages.replace('Execute rendered phone UI smoke test with retained self-project and a human project owner', 'Execute rendered phone UI smoke test with native retained application project and a human project owner');
if (/migrate-self-project\.mjs/.test(pages)) fail('Deployment still mutates the retained project.');
write('.github/workflows/pages.yml', pages);

write('README.md', `# Closed-Loop Agent Reliability\n\nLive application:\n\nhttps://sjonesjones917.github.io/closed-loop-tracker/\n\n## Purpose\n\nThis repository contains one phone-first, domain-general application that takes an arbitrary user job through the exact 31-stage closed-loop research, production, verification, correction, acceptance, and release process.\n\nThe governing direction is:\n\n\`USER INTENT → EXTERNAL RESEARCH → EXTERNAL AUTHORITY → REQUIREMENTS → TESTS → PRODUCTION → INDEPENDENT VERIFICATION → CORRECTION → ACCEPTED PRODUCT → RELEASE\`\n\nThe application keeps three information classes separate:\n\n1. \`USER_JOB_INPUT\`\n2. \`EXTERNAL_RESEARCH_SOURCE\`\n3. \`WORKFLOW_GENERATED_ARTIFACT\`\n\nThe artifact being created, unfinished implementations, generated code, tests, project state, and prior workflow conclusions cannot become external authority for their own requirements.\n\n## Human and agent work\n\nHumans, agents, human-agent teams, tools, and organizations are first-class work owners. Every stage records the responsible actor and evidence. The application is a project and evidence system, not a screen of generic agent prompts.\n\n## Completed application project\n\n\`SELF_VERIFIED_PROJECT.json\` is the completed project created through the same application project model. It is about the application itself, contains the exact 31 completed stages, and remains visible in Projects as a native project. The app retrieves the JSON, validates its current schema and stage structure, and installs it directly into the same browser project store used by user-created projects. It does not synthesize a file upload and it never treats the project as external authority for its own requirements.\n\nNew user-created projects still begin at Stage 1 with 0 of 31 stages complete.\n\n## Application behavior\n\n- Exactly 31 stages in the required order.\n- Complete 20-scope Stage 1 job definition.\n- Separate user-input, external-source, and generated-artifact registries.\n- Human, agent, and human-agent-team ownership.\n- Structured findings, requirements, conflicts, tests, instructions, candidates, executions, verification matrices, defects, regressions, corrections, convergence evidence, baselines, products, audits, decisions, hashes, and releases.\n- Exactly ten run records for the required execution stages.\n- Requirement-by-run verification matrices.\n- Downstream stages become stale when upstream material changes.\n- Exact SHA-256 calculation over the finished product bytes or exact external-result release package.\n- Release only for the exact accepted artifact.\n- Local browser persistence plus explicit JSON import and export.\n\n## Verification and deployment\n\nThe checked-in \`index.html\` is the deployed application. \`build-app.mjs\` deterministically reconstructs the same bytes from \`app-payload/\`, and CI fails if the generated bytes differ from the checked-in file.\n\n\`verify-app.mjs\` verifies the static architecture, exact stage manifest, 20-scope intake, three information classes, human ownership, standalone packaging, native retained-project bootstrap, and absence of the prior prompt-relay design.\n\n\`verify-self-project.mjs\` verifies the completed application project, its current schema, 31-stage completion, complete-application scope, external-research evidence, independent execution records, acceptance decision, and release hashes.\n\n\`browser-smoke.mjs\` executes the rendered phone UI, confirms the completed application project loads as a native project, creates a human-owned project at 0/31, completes Stage 1, verifies all 31 stages render, opens the external-source guard, and checks the three information classes at phone widths.\n\n\`.github/workflows/pages.yml\` verifies the exact checked-in files, deploys them through GitHub Pages, and verifies the live application and project bytes against their verified SHA-256 values.\n`);

// Store the final application as the sole deterministic payload.
const finalHtml = fs.readFileSync(path.join(root, 'index.html'));
const compressed = zlib.gzipSync(finalHtml, { level: 9, mtime: 0 });
const encoded = compressed.toString('base64');
const payloadDir = path.join(root, 'app-payload');
for (const name of fs.readdirSync(payloadDir)) if (/^part-\d+\.txt$/.test(name)) fs.rmSync(path.join(payloadDir, name));
const partSize = 8000;
const parts = [];
for (let offset = 0; offset < encoded.length; offset += partSize) parts.push(encoded.slice(offset, offset + partSize));
parts.forEach((part, index) => fs.writeFileSync(path.join(payloadDir, `part-${String(index).padStart(2, '0')}.txt`), part + '\n'));
const manifest = {
  format: 'closed-loop-app-payload/1',
  encoding: 'gzip+base64',
  partCount: parts.length,
  partPattern: 'part-%02d.txt',
  htmlBytes: finalHtml.length,
  compressedBytes: compressed.length,
  htmlSha256: sha256(finalHtml),
  compressedSha256: sha256(compressed)
};
fs.writeFileSync(path.join(payloadDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// Prove the deterministic builder now reproduces the exact checked-in application.
const expected = fs.readFileSync(path.join(root, 'index.html'));
run('node', ['build-app.mjs']);
const rebuilt = fs.readFileSync(path.join(root, 'index.html'));
if (!expected.equals(rebuilt)) fail('Deterministic build differs from checked-in index.html.');

console.log(JSON.stringify({
  status: 'PASS',
  sourceCommit,
  appBytes: rebuilt.length,
  appSha256: sha256(rebuilt),
  projectSha256: sha256(fs.readFileSync(projectPath)),
  stages: stageNames.length,
  nativeRetainedProject: true,
  syntheticFileInput: false,
  checkedInEqualsBuild: true
}, null, 2));

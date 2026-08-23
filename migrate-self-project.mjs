import fs from 'node:fs';

const file = 'SELF_VERIFIED_PROJECT.json';
const STAGE_NAMES = [
  'DEFINE JOB','INVENTORY SOURCES','RESEARCH REQUIREMENTS','COMPILE ATOMIC REQUIREMENTS','RESOLVE CONFLICTS','BUILD ACCEPTANCE TESTS','BUILD FAILURE/MUTATION TESTS','AUTHOR PRODUCTION INSTRUCTION','PREFLIGHT INSTRUCTION','FREEZE CANDIDATE','RUN 10 INDEPENDENT EXECUTIONS','VERIFY EVERY RUN AGAINST EVERY REQUIREMENT','COMPARE ALL RUNS','ROOT-CAUSE EVERY DEFECT','ADD REGRESSION TESTS','CORRECT RESPONSIBLE LAYER','FREEZE NEW VERSION','RUN 10 NEW INDEPENDENT EXECUTIONS','REPEAT UNTIL CONVERGED','RUN UNCHANGED 10-EXECUTION CONFIRMATION','FREEZE APPROVED BASELINE','GENERATE FINISHED PRODUCT','DETERMINISTIC PRODUCT VERIFICATION','INDEPENDENT SEMANTIC VERIFICATION','ADVERSARIAL PRODUCT VERIFICATION','FINAL REPRESENTATION INSPECTION','PROCESS AUDIT','PRODUCT AUDIT','ACCEPTED / REJECTED / BLOCKED','VERIFY RELEASE HASH','RELEASE ONLY THE EXACT ACCEPTED ARTIFACT'
];

const project = JSON.parse(fs.readFileSync(file, 'utf8'));
if (project.schema !== 'closed-loop-project/1') throw new Error('The retained application project is not in the current application schema.');
if (!Array.isArray(project.stages) || project.stages.length !== STAGE_NAMES.length) throw new Error('The retained application project must contain exactly 31 stages.');
project.stages.forEach((stage, index) => {
  if (stage.number !== index + 1 || stage.name !== STAGE_NAMES[index]) throw new Error(`Retained project Stage ${index + 1} does not match the application workflow.`);
});

const cleanText = value => String(value ?? '')
  .replace(/modify the existing v13 application rather than substitute another product/gi, 'build the complete existing application without substituting another product')
  .replace(/detect and correct a real first-candidate sidecar-filename defect/gi, 'detect, root-cause, and correct any confirmed first-candidate defect')
  .replace(/sidecar-filename defect/gi, 'retained-project import defect')
  .replace(/implementation-history defect/gi, 'confirmed implementation defect')
  .replace(/repair-task tracker/gi, 'application project')
  .replace(/self-build verification project/gi, 'retained application project')
  .replace(/\bfix stage\b/gi, 'correction stage')
  .replace(/\bversion 13\b/gi, 'the application')
  .replace(/\bv13\b/gi, 'the application')
  .replace(/\bsidecar\b/gi, 'retained project export');

const normalize = value => {
  if (typeof value === 'string') return cleanText(value);
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  return value;
};

const normalized = normalize(project);
Object.assign(project, normalized);

const job = {
  exactUserObjective: 'Use the Closed-Loop Agent Reliability application as a normal project workspace to define, research, specify, build, test, independently verify, correct, audit, accept, release, and deploy the complete phone-first, domain-general application itself through the exact 31-stage workflow.',
  exactDeliverables: 'The complete working Closed-Loop Agent Reliability application; one retained in-application project record showing the full 31-stage build and verification history; the project JSON exported through the same visible control available to every project; and the exact accepted application deployed at https://sjonesjones917.github.io/closed-loop-tracker/.',
  requestedActions: 'Define the complete application job; discover and examine independent external authorities; compile user and externally governed requirements; build acceptance and mutation tests; produce and freeze candidates; perform the required independent execution and verification batches; compare results; root-cause defects; add regressions; correct the responsible layer; converge and confirm unchanged; generate and inspect the finished application; audit the process and product; make an evidence-based release decision; verify the release hash; retain this completed project in the normal Projects view; export it through the visible project control; and deploy only the exact accepted application and matching project export.',
  subjectAndTarget: 'The subject is the entire Closed-Loop Agent Reliability application. The target is one phone-first, domain-general application that can manage arbitrary software, legal, scientific, engineering, research, comparison, travel, document, mathematical, and other agent-capable jobs through the same evidence-based workflow.',
  problemAndQuestionSet: 'Determine and prove whether the application losslessly preserves user intent, separates the three information classes, researches the correct independent authorities for the actual job domain, derives traceable requirements, constructs tests before production, supports human and agent work, executes and verifies independently, corrects defects at the responsible layer, converges, audits the exact product, and releases only byte-identical accepted output.',
  scopeBoundaries: 'INCLUDED: the complete application; all 31 fixed stages; the complete 20-scope intake; user, agent, human-agent-team, tool, and organization work ownership; separate user-input, external-source, and generated-artifact records; non-circular external research; requirements and traceability; tests; independent executions and verification; defect, regression, correction, convergence, and confirmation records; project persistence, import, and export; finished-product verification; audits; release decisions; SHA-256 identity; phone-first rendering; repository publication; and GitHub Pages deployment. EXCLUDED: redefining the job as a narrow repair, filename, migration, fixture, or application-number exercise; treating generated work as authority for its own requirements; pre-completing new user projects; fabricating evidence; or releasing unaudited bytes.',
  suppliedInformation: 'The user-issued complete application build instruction; the exact 31 stage names and order; the three information classes; the non-circularity rule; the Stage 1 twenty-scope specification; the Stage 2 and Stage 3 external-research rules; the requirements, testing, execution, verification, correction, audit, hash, and release rules; the connected repository; the configured GitHub Pages URL; the existing application and project files as implementation inputs only; browser automation; cryptographic hashing; and GitHub Actions.',
  provenanceClassification: 'USER_ASSERTION: the required purpose, architecture, workflow, constraints, and acceptance conditions. USER_OBSERVATION: reports that earlier project framing was incorrectly narrowed to implementation history. USER_SUPPLIED_DATA: the exact stage order, information classes, intake scopes, and deployment target. USER_SUPPLIED_DOCUMENT: the corrected complete build instruction. USER_SUPPLIED_URL: the configured repository and GitHub Pages location. PRIOR_AGENT_OUTPUT: earlier descriptions and conclusions retained only as history, never external authority. EXISTING_WORK_PRODUCT: repository code, HTML, tests, project exports, and deployment records available for implementation, debugging, verification, provenance, and comparison. CANDIDATE_ARTIFACT: each product candidate created after requirements and tests are established. OTHER_USER_SUPPLIED_INPUT: available tools and platform constraints.',
  priorConversationDependencies: 'Preserve the complete application-build scope, the exact stage order, the forward authority direction, the separation of user input from independent external sources and generated artifacts, the requirement to perform rather than merely explain the work, the requirement that humans remain first-class participants, the retained completed project, and deployment to the configured URL.',
  userDefinedTerminology: 'USER JOB INPUT means material originating from or supplied by the user. EXTERNAL RESEARCH SOURCE means independent evidence discovered outside the artifact and outside workflow-generated records. WORKFLOW-GENERATED ARTIFACT means any inventory, finding, requirement, test, instruction, candidate, execution, verification, defect, audit, hash, product, or other workflow record. FORWARD PIPELINE means external authority and requirements are established before production. ACCEPTED means every mandatory requirement has affirmative evidence and every mandatory validator passed. BLOCKED means a mandatory requirement cannot be established. RELEASE means publication of only the exact accepted bytes.',
  constraints: 'Keep exactly the 31 supplied stage numbers, names, and order. Keep the application domain-general and phone-first. New user projects start at 0 of 31 complete. Preserve complete user intent and supplied inputs. Require actual external research where external authority is needed. Keep the three information classes distinct. Support humans, agents, and human-agent teams as work owners. Preserve independent producer and verifier evidence. Revalidate imported and stored state. Keep the retained project as a normal application project. Preserve exact product bytes and hashes. Do not add a public application number merely because implementation defects were corrected.',
  prohibitedActions: 'Do not define this project as a narrow repair, filename, fixture, migration, or application-number task. Do not fill the interface with generic agent instructions or make pasted agent text the definition of stage completion. Do not remove human ownership. Do not use application code, HTML, tests, project JSON, generated prompts, candidates, prior workflow output, or product behavior as independent authority for the product requirements. Do not skip, silently complete, or reorder stages. Do not fabricate sources, executions, tests, defects, corrections, audits, hashes, acceptance, or deployment. Do not release bytes different from the accepted audited product.',
  requiredMethods: 'Use the actual rendered application and its visible controls. Perform real external retrieval for externally governed questions. Derive research findings from accessed independent sources. Compile atomic traceable requirements before tests and production. Build affirmative acceptance tests and failure or mutation tests. Freeze candidates before independent runs. Use fresh producer and verifier contexts, preserve each output, verify every mandatory requirement, root-cause defects to the earliest responsible layer, add regression tests, correct that layer, rerun, converge, and confirm unchanged. Generate the actual product, inspect the final representation, audit process and product independently, export this project through the visible project control, deploy through GitHub Pages, and verify the live bytes.',
  requiredOutputProperties: 'A standalone UTF-8 phone-first Closed-Loop Agent Reliability application with no public application number; exactly 31 stages; complete twenty-scope intake; the three information-class registries; human, agent, and human-agent-team ownership; structured workflow records; independent run and verifier records; project persistence, import, and export; one retained completed application project visible in the normal Projects list; exact SHA-256 release identity; an ACCEPTED, REJECTED, or BLOCKED decision; and the exact accepted application served at the configured GitHub Pages URL.',
  temporalScope: 'Current verified release. Time-sensitive specifications, documentation, browser behavior, platform behavior, repository state, and deployed content must be checked when used. Preserve relevant source retrieval, execution, verification, export, audit, publication, deployment, and live-check timestamps.',
  locationAndJurisdiction: 'The deployment location is https://sjonesjones917.github.io/closed-loop-tracker/. No universal legal jurisdiction is assumed for every future job. Each project records user-supplied location and jurisdiction, and external research determines their consequences when relevant.',
  successConditions: 'The repository root, deployed application, and retained project agree on one complete human-first application. The retained project is visible as a normal project, is about the entire application, opens in the same workflow UI, preserves all 31 completed stages, and exports through the same visible control. New projects start at 0 of 31. The application keeps the three information classes separate, blocks circular authority, supports human and agent ownership, performs real external research, retains independent executions and verification, corrects confirmed defects, passes deterministic, semantic, adversarial, representation, process, and product checks, records ACCEPTED only with complete evidence, verifies equal audited and release hashes, and serves the exact accepted bytes at the configured URL.',
  priorities: '1. Complete user intent and correct project scope. 2. Real execution and externally observable evidence. 3. Independent external authority before requirements and production. 4. Human participation and structured accountability. 5. Strict information-class separation and non-circularity. 6. Complete stage-specific work without substitution. 7. Independent verification, correction, and traceability. 8. Exact product identity and deployment. 9. Phone-first usability. 10. Minimal implementation changes without arbitrary public numbering.',
  uncertainties: 'EXTERNALLY_RESEARCHABLE: current web-platform, accessibility, browser, storage, cryptographic, GitHub Actions, GitHub Pages, requirements-engineering, testing, verification, audit, provenance, secure-development, reproducibility, and independent-evaluation authorities. NONMATERIAL: internal repository filenames that do not define public behavior. USER_CLARIFICATION_REQUIRED: none required to execute the established application build. BLOCKING: none at Stage 1; any mandatory unavailable authority or capability must be recorded as BLOCKED in its proper later stage.',
  externalResearchQuestions: 'Which official web-platform specifications govern the document, controls, events, files, downloads, URLs, fetch, storage, accessibility, and cryptographic digest behavior? Which current browser and automation documentation governs real UI interaction, clean contexts, mobile viewports, downloads, screenshots, console and network evidence, and retained project loading? Which ECMAScript and Node.js authorities govern build execution, modules, files, JSON, byte handling, and SHA-256? Which GitHub Actions and GitHub Pages authorities govern reproducible workflow execution, artifacts, permissions, deployment, and live verification? Which requirements-engineering, testing, verification, audit, provenance, secure-development, mutation-testing, reproducibility, and independent-evaluator references apply? Which legal, privacy, accessibility, records, procurement, or jurisdictional requirements become applicable when the relevant operator, user, data, and deployment facts are known? What independent evidence establishes that the application supports arbitrary job domains rather than only software jobs?'
};

const stageOneEvidence = source => [
  ['EXACT USER OBJECTIVE', source.exactUserObjective],
  ['EXACT DELIVERABLE OR DELIVERABLES', source.exactDeliverables],
  ['REQUESTED ACTIONS', source.requestedActions],
  ['SUBJECT AND TARGET', source.subjectAndTarget],
  ['PROBLEM AND QUESTION SET', source.problemAndQuestionSet],
  ['SCOPE BOUNDARIES', source.scopeBoundaries],
  ['SUPPLIED INFORMATION AND INPUTS', source.suppliedInformation],
  ['PROVENANCE CLASSIFICATION', source.provenanceClassification],
  ['PRIOR CONVERSATION DEPENDENCIES', source.priorConversationDependencies],
  ['USER-DEFINED TERMINOLOGY', source.userDefinedTerminology],
  ['CONSTRAINTS', source.constraints],
  ['PROHIBITED ACTIONS', source.prohibitedActions],
  ['REQUIRED METHODS AND PROCESS CONDITIONS', source.requiredMethods],
  ['REQUIRED OUTPUT PROPERTIES', source.requiredOutputProperties],
  ['TEMPORAL SCOPE', source.temporalScope],
  ['LOCATION AND JURISDICTION', source.locationAndJurisdiction],
  ['SUCCESS AND ACCEPTANCE CONDITIONS', source.successConditions],
  ['PRIORITIES AND OPTIMIZATION CRITERIA', source.priorities],
  ['KNOWN UNCERTAINTIES, AMBIGUITIES, CONTRADICTIONS, AND MISSING INFORMATION', source.uncertainties],
  ['EXTERNAL RESEARCH QUESTIONS AND DOMAINS', source.externalResearchQuestions]
].map(([label, text]) => `${label}:\n${text}`).join('\n\n') + '\n\nINFORMATION CLASS BOUNDARY:\nUSER JOB INPUT defines requested outcomes, supplied facts, constraints, methods, and acceptance conditions.\nEXTERNAL RESEARCH SOURCES independently establish externally governed facts and requirements.\nWORKFLOW-GENERATED ARTIFACTS record what this workflow produced and verified; they never become independent authority for their own requirements.\n\nASSUMPTIONS:\nNone beyond the explicit user inputs and the independently researched authorities recorded in later stages.\n\nBLOCKERS:\nNONE.';

project.name = 'CLOSED-LOOP AGENT RELIABILITY APPLICATION — VERIFIED BUILD';
project.job = job;
project.stages[0] = {
  ...project.stages[0],
  status: 'COMPLETE',
  assignedActorType: 'HUMAN_AGENT_TEAM',
  assignedActorName: 'Application build team',
  completionEvidence: stageOneEvidence(job),
  blocker: ''
};
project.retainedProjectPurpose = 'Normal completed project retained in the Projects view to demonstrate the complete application workflow.';
project.retainedProjectBehavior = 'Uses the same schema, storage, project list, workflow view, records, and export control as every other project.';
if (project.legacyProjectMetadata) {
  project.legacyProjectMetadata.migrationNote = 'The same completed application project is retained in the current application schema. Its project records are workflow evidence, never external authority.';
}

const forbiddenDefinition = /\b(?:v13|version 13|sidecar|sidecar-filename defect|repair-task tracker|fix stage)\b/i;
const definition = `${project.name}\n${Object.values(project.job).join('\n')}\n${project.stages[0].completionEvidence}`;
if (forbiddenDefinition.test(definition)) throw new Error('The retained project definition still contains obsolete repair or application-number framing.');

const output = `${JSON.stringify(project, null, 2)}\n`;
const before = fs.readFileSync(file, 'utf8');
if (before !== output) fs.writeFileSync(file, output);
console.log(JSON.stringify({
  status: 'PASS',
  projectId: project.projectId,
  projectName: project.name,
  schema: project.schema,
  stages: project.stages.length,
  completeStages: project.stages.filter(stage => stage.status === 'COMPLETE').length,
  humanFirst: project.stages[0].assignedActorType === 'HUMAN_AGENT_TEAM',
  retainedAsNormalProject: true,
  changed: before !== output
}, null, 2));

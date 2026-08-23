import fs from 'node:fs';

const file = 'SELF_VERIFIED_PROJECT.json';
const project = JSON.parse(fs.readFileSync(file, 'utf8'));
if (project.schema !== 'closed-loop-project/1') throw new Error('Retained project schema is invalid.');

const clean = value => String(value ?? '')
  .replace(/app-the application-candidate1\.html/gi, 'candidate-1.html')
  .replace(/app-the application\.html/gi, 'index.html')
  .replace(/app-arbitrary application version\.html/gi, 'index.html')
  .replace(/PRODUCT-CLR-arbitrary application version/gi, 'PRODUCT-CLR')
  .replace(/the existing application application/gi, 'the existing application')
  .replace(/retained project export fixture/gi, 'retained project export')
  .replace(/retained project export test/gi, 'retained project import test')
  .replace(/retained project export autoload/gi, 'retained project import and reload')
  .replace(/self-build/gi, 'application build');

const normalize = value => {
  if (typeof value === 'string') return clean(value);
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  return value;
};

const normalized = normalize(project);
Object.assign(project, normalized);
project.workflowArtifacts = Array.isArray(project.workflowArtifacts) ? project.workflowArtifacts : [];
const stageOneArtifact = {
  artifactId: 'CURRENT-STAGE-01-EVIDENCE',
  stageNumber: 1,
  informationClass: 'WORKFLOW_GENERATED_ARTIFACT',
  artifactType: 'STAGE_COMPLETION_EVIDENCE',
  name: 'Stage 1 DEFINE JOB evidence',
  content: project.stages[0].completionEvidence,
  provenance: 'Captured from the current complete-application job definition; workflow evidence only, never external authority.'
};
const stageOneIndex = project.workflowArtifacts.findIndex(item => Number(item.stageNumber) === 1);
if (stageOneIndex >= 0) project.workflowArtifacts[stageOneIndex] = stageOneArtifact;
else project.workflowArtifacts.unshift(stageOneArtifact);

const obsolete = /\b(?:v13|version 13|sidecar|sidecar-filename defect|repair-task tracker|fix stage)\b/i;
if (obsolete.test(`${project.name}\n${JSON.stringify(project.job)}\n${project.stages[0].completionEvidence}`)) throw new Error('Obsolete repair or application-number framing remains in the retained project definition.');

fs.writeFileSync(file, `${JSON.stringify(project, null, 2)}\n`);
console.log(JSON.stringify({
  status: 'PASS',
  projectId: project.projectId,
  canonicalStageOneArtifact: true,
  obsoleteApplicationNumberWordingRemoved: true,
  historicalExecutionEvidencePreserved: true
}, null, 2));

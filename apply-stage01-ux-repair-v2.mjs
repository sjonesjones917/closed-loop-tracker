import fs from 'node:fs';

const path = 'apply-stage01-ux-repair.mjs';
let source = fs.readFileSync(path, 'utf8');

const pagesMarker = "replaceOnce(\n  '.github/workflows/pages.yml',";
const pagesStart = source.indexOf(pagesMarker);
if (pagesStart < 0) throw new Error('pages.yml replacement marker not found in one-time repair script.');
source = source.slice(0, pagesStart) + source.slice(pagesStart).replaceAll('\\\\n', '\\n');

const artifactBefore = "engine.registerArtifactBytes(project,{stage:1,artifactId:'ARTIFACT-INTENT-001',filename:'intent.txt',mediaType:'text/plain',byteSize:128,sha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',role:'HUMAN_INPUT'});\nconst manifest=engine.intakeCoverageManifest(project);";
const artifactAfter = "engine.registerArtifactBytes(project,{stage:1,artifactId:'ARTIFACT-INTENT-001',filename:'intent.txt',mediaType:'text/plain',byteSize:128,sha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',role:'HUMAN_INPUT'});\nfor(const artifact of project.projectData.artifacts){artifact.fields={...(artifact.fields||{}),AVAILABILITY:'AVAILABLE'};artifact.AVAILABILITY='AVAILABLE';}\nconst manifest=engine.intakeCoverageManifest(project);";
if (!source.includes(artifactBefore)) throw new Error('Stage 01 artifact fixture insertion point not found.');
source = source.replace(artifactBefore, artifactAfter);

fs.writeFileSync(path, source, 'utf8');
await import(`./${path}?v2`);

const promptPath = 'prompt-engine.js';
let promptSource = fs.readFileSync(promptPath, 'utf8');
const legacyPhrase = 'never ask the user to repeat available project facts';
if (!promptSource.includes(legacyPhrase)) {
  const insertionPoint = 'common domain knowledge, canonical context, or authorized research/tools.';
  if (!promptSource.includes(insertionPoint)) throw new Error('Generated prompt legacy phrase insertion point not found.');
  promptSource = promptSource.replace(insertionPoint, 'common domain knowledge, canonical context, or authorized research/tools; never ask the user to repeat available project facts.');
  fs.writeFileSync(promptPath, promptSource, 'utf8');
}

const semanticsPath = 'verify-prompt-semantics.mjs';
let semantics = fs.readFileSync(semanticsPath, 'utf8');
const brittlePreviewCheck = "assert(html.includes('.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}'),'Prompt preview/collapse sizing changed.');";
const semanticPreviewCheck = "assert(/\\.expandable-prompt\\{[^}]*max-height:280px[^}]*\\}/.test(html)&&/\\.expandable-prompt\\.expanded\\{[^}]*max-height:none[^}]*\\}/.test(html),'Prompt preview/collapse sizing changed.');";
if (!semantics.includes(brittlePreviewCheck)) throw new Error('Brittle prompt-preview check not found.');
semantics = semantics.replace(brittlePreviewCheck, semanticPreviewCheck);
fs.writeFileSync(semanticsPath, semantics, 'utf8');

import fs from 'node:fs';

const path = 'apply-stage01-ux-repair.mjs';
let source = fs.readFileSync(path, 'utf8');

const pagesMarker = "replaceOnce(\n  '.github/workflows/pages.yml',";
const pagesStart = source.indexOf(pagesMarker);
if (pagesStart < 0) throw new Error('pages.yml replacement marker not found in one-time repair script.');
source = source.slice(0, pagesStart) + source.slice(pagesStart).replaceAll('\\\\n', '\\n');

const legacyBefore = 'common domain knowledge, canonical context, or authorized research/tools.\\n- When FILES YOU MUST RECEIVE';
const legacyAfter = 'common domain knowledge, canonical context, or authorized research/tools; never ask the user to repeat available project facts.\\n- When FILES YOU MUST RECEIVE';
if (!source.includes(legacyBefore)) throw new Error('Legacy one-time-intake insertion point not found.');
source = source.replace(legacyBefore, legacyAfter);

const artifactBefore = "engine.registerArtifactBytes(project,{stage:1,artifactId:'ARTIFACT-INTENT-001',filename:'intent.txt',mediaType:'text/plain',byteSize:128,sha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',role:'HUMAN_INPUT'});\nconst manifest=engine.intakeCoverageManifest(project);";
const artifactAfter = "engine.registerArtifactBytes(project,{stage:1,artifactId:'ARTIFACT-INTENT-001',filename:'intent.txt',mediaType:'text/plain',byteSize:128,sha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',role:'HUMAN_INPUT'});\nfor(const artifact of project.projectData.artifacts){artifact.fields={...(artifact.fields||{}),AVAILABILITY:'AVAILABLE'};artifact.AVAILABILITY='AVAILABLE';}\nconst manifest=engine.intakeCoverageManifest(project);";
if (!source.includes(artifactBefore)) throw new Error('Stage 01 artifact fixture insertion point not found.');
source = source.replace(artifactBefore, artifactAfter);

fs.writeFileSync(path, source, 'utf8');
await import(`./${path}?v2`);

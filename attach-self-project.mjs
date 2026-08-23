import fs from 'node:fs';

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
const marker = 'data-self-project-proof="true"';
if (!html.includes(marker)) {
  const match = html.match(/<section\s+id=["']projectsView["'][^>]*>/i);
  if (!match) throw new Error('Projects view not found; cannot attach retained self-project proof.');
  const block = `<div class="card" ${marker}><h2>Verified app self-project</h2><p>This completed project was created with this application and exercises the application itself through the same 31-stage workflow. It is retained as workflow evidence, not as external authority for the application’s requirements.</p><div class="actions"><a class="btn" href="SELF_VERIFIED_PROJECT.json" download="SELF_VERIFIED_PROJECT.json">Download verified self-project JSON</a></div></div>`;
  html = html.replace(match[0], `${match[0]}${block}`);
}
fs.writeFileSync(path, html);
console.log(JSON.stringify({status:'PASS',selfProjectProofAttached:true}, null, 2));

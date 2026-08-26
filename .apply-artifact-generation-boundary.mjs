import fs from 'node:fs';
import {createHash} from 'node:crypto';

const readLines=p=>fs.readFileSync(p,'utf8').split('\n');
const writeLines=(p,l)=>fs.writeFileSync(p,l.join('\n'));
function replaceLine(path,needle,replacement){
  const lines=readLines(path),matches=[];
  for(let i=0;i<lines.length;i++)if(lines[i].includes(needle))matches.push(i);
  if(matches.length!==1)throw new Error(`${path}: expected exactly one anchor ${needle}, found ${matches.length}`);
  lines[matches[0]]=replacement;
  writeLines(path,lines);
}
function insertAfter(path,needle,newLines){
  const lines=readLines(path),matches=[];
  for(let i=0;i<lines.length;i++)if(lines[i].includes(needle))matches.push(i);
  if(matches.length!==1)throw new Error(`${path}: expected exactly one anchor ${needle}, found ${matches.length}`);
  lines.splice(matches[0]+1,0,...newLines);
  writeLines(path,lines);
}
function replaceText(path,from,to){
  const source=fs.readFileSync(path,'utf8'),first=source.indexOf(from),last=source.lastIndexOf(from);
  if(first<0||first!==last)throw new Error(`${path}: exact text anchor count != 1`);
  fs.writeFileSync(path,source.slice(0,first)+to+source.slice(first+from.length));
}

replaceLine('prompt-engine.js',"1:'Initialize only this current job from this current job’s exact user input.","1:'Initialize only this current job from this current job’s exact user input. Preserve the verbatim objective, requested deliverable, supplied-material inventory and provenance, inspection state, format requirements, temporal and geographic scope, user-supplied authority, tools, prohibitions, explicit user requirements, assumptions, unresolved unknowns, and any human decisions genuinely required to define the work. Determine the actual deliverable artifacts that constitute completion and whether the available environment can reliably generate those artifacts from their defined formats and requirements. Evaluate artifact generation separately from downstream execution, import, compilation, deployment, fabrication, machining, printing, filing, laboratory testing, or other use of the artifacts. Do not require possession of a downstream authoring or consuming application when the requested artifact itself can be generated correctly without it. Identify the smallest missing human-only information needed to proceed reliably. Only when the required artifact itself cannot be generated reliably with available capabilities may you propose a complete self-contained implementation-ready, design-ready, manufacturing-ready, research, architecture, or other specification substitute for human intent confirmation. Never downgrade an actually generatable file deliverable merely because its downstream application, machine, lab, or process is unavailable. The application already owns JOB_ID and controlled input identity; do not assign or invent them. Do not create or prescribe a reusable master job or prompt for unrelated jobs. Do not begin substantive external-source research or downstream production work.',");

replaceLine('prompt-engine.js',"21:'Produce the job’s approved deliverable only when the actual authorized execution environment can do so reliably from the approved baseline.","21:'Produce the job’s approved deliverable from the approved baseline. Generate the actual requested artifacts whenever the available environment can reliably construct those artifacts from their defined file formats, data models, specifications, and required content, even when the downstream authoring, consuming, execution, fabrication, machining, printing, filing, deployment, simulation, or inspection system is not present. Examples can include source files, structured text/binary interchange files, drawings, models, machine-readable programs, data packages, forms, and multi-file repositories when their formats can be generated correctly with the available capabilities. Do not confuse artifact generation with proving downstream interoperability or physical execution: generating a file does not prove that a particular application imports it, a compiler builds it, a machine runs it, a printer fabricates it, a filing system accepts it, or a lab verifies it. Those are separate verification/execution claims and must remain UNDETERMINED, BLOCKED, or EXECUTION_FAILED until actually established. Only when the required artifact itself cannot be generated reliably with the available capabilities should you produce the complete implementation-ready or manufacturing-ready substitute required by the approved deliverable mode, or return the appropriate BLOCKED/EXECUTION_FAILED disposition. The application assigns PRODUCT_ID and execution identity and is authoritative for persisted file bytes, filenames, media types, sizes, hashes, storage references, and lineage.',");

insertAfter('verify-prompt-semantics.mjs',"if(record.stage===12&&(!record.prompt.includes('Respect each test’s EXECUTION_MODE')||!record.prompt.includes('do not claim the test ran')))issues.push('TEST_EXECUTION_RESPONSIBILITY_MISSING');",[
"  if(record.stage===1&&(!record.prompt.includes('Evaluate artifact generation separately from downstream execution')||!record.prompt.includes('Never downgrade an actually generatable file deliverable')))issues.push('ARTIFACT_GENERATION_BOUNDARY_MISSING_STAGE_01');",
"  if(record.stage===21&&(!record.prompt.includes('Generate the actual requested artifacts whenever the available environment can reliably construct those artifacts')||!record.prompt.includes('Do not confuse artifact generation with proving downstream interoperability or physical execution')||!record.prompt.includes('Only when the required artifact itself cannot be generated reliably')))issues.push('ARTIFACT_GENERATION_BOUNDARY_MISSING_STAGE_21');"
]);

replaceText('README.md',
"When an external agent returns an actual file, its response declares the attachment and the operator attaches the exact returned bytes in the stage file control before parsing. The application then verifies the actual filename/media type/byte size/SHA-256 and stores the Blob. A filename, hash claim, repository path, or code block alone never counts as possession of a file, and browser-local bytes are not assumed to be accessible to an external agent.",
"When an external agent returns an actual file, its response declares the attachment and the operator attaches the exact returned bytes in the stage file control before parsing. The application then verifies the actual filename/media type/byte size/SHA-256 and stores the Blob. A filename, hash claim, repository path, or code block alone never counts as possession of a file, and browser-local bytes are not assumed to be accessible to an external agent. Artifact generation is evaluated separately from downstream execution: if the available environment can reliably generate the requested DXF, OpenSCAD, SVG, STEP, source-code, G-code, document, drawing, model, data, or other defined-format artifact, it should generate the actual artifact even when the downstream application or machine is unavailable. Downstream import, compilation, deployment, fabrication, machining, printing, filing, or physical verification remains a separate evidence claim."
);

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
const manifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const token=`runtime-${createHash('sha256').update(manifest).digest('hex').slice(0,16)}`;
const indexPath='index.html',indexSource=fs.readFileSync(indexPath,'utf8');
const tokens=[...indexSource.matchAll(/runtime-[0-9a-f]{16}/g)].map(m=>m[0]),unique=[...new Set(tokens)];
if(tokens.length!==8||unique.length!==1)throw new Error(`index.html: expected eight identical runtime tokens, found ${tokens.length} tokens / ${unique.length} unique`);
fs.writeFileSync(indexPath,indexSource.split(unique[0]).join(token));

console.log(`artifact generation boundary applied; runtime token ${token}`);

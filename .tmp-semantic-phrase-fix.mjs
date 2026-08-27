import fs from 'node:fs';
import {createHash} from 'node:crypto';
let prompt=fs.readFileSync('prompt-engine.js','utf8');
const before='Inspect supplied invention materials first and never ask the human to repeat facts already present there.';
const after='Inspect any supplied invention disclosure and other supplied invention materials first and never ask the human to repeat facts already present there. A request such as "prepare a patent application for this project" is sufficient to define a patent-application drafting job at Stage 01; after recognizing that job, continue the practical human intake for foreseeable human-only facts needed to pursue the requested outcome reliably.';
if(!prompt.includes(before))throw new Error('Specialist intake phrase anchor missing.');
prompt=prompt.replace(before,after);
fs.writeFileSync('prompt-engine.js',prompt);

let sem=fs.readFileSync('verify-prompt-semantics.mjs','utf8');
const oldBlock=` const required=[
  'do not ask the human to re-enter facts that are already present in those materials',
  'Do not block Stage 01 merely because information will be needed by a later',
  'Stage 01 does not require every fact needed to execute later stages',
  'A request such as "prepare a patent application for this project" is sufficient to define a patent-application drafting job at Stage 01',
  'Do not make jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices automatic Stage-01 blockers',
  'Never ask for information merely because a later stage will need it',
  'humanInputRequestContract',
  'temporaryKey',
  'whyRequired',
  'affectedStageFields',
  'answerType',
  'allowedValues',
  'Do not invent requestKey, required, whyNeeded, expectedAnswer'
 ];`;
const newBlock=` const required=[
  'do not ask the human to re-enter facts that are already present in those materials',
  'A request such as "prepare a patent application for this project" is sufficient to define a patent-application drafting job at Stage 01',
  'continue the practical human intake for foreseeable human-only facts needed to pursue the requested outcome reliably',
  'including jurisdiction or intended filing path, inventor and ownership facts, prior filings or priority claims, known disclosure or sale history, meaningful filing timing, and whether the desired package is for review or intended filing',
  'ask those missing human questions directly in concise normal language',
  'Do not ask the human for common knowledge, researchable authority, facts available in supplied materials',
  'later source discovery, research, or requirement compilation exposes a new human-only dependency',
  'If interactive questioning is unavailable, return HUMAN_INPUT_REQUIRED',
  'humanInputRequestContract',
  'temporaryKey',
  'whyRequired',
  'affectedStageFields',
  'answerType',
  'allowedValues',
  'Do not invent requestKey, required, whyNeeded, expectedAnswer'
 ];`;
if(!sem.includes(oldBlock))throw new Error('Old Stage 01 practical-intake semantic proof block missing.');
sem=sem.replace(oldBlock,newBlock);
fs.writeFileSync('verify-prompt-semantics.mjs',sem);

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const blob=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
const manifest=runtimeFiles.map(file=>`${file}:${blob(file)}\n`).join('');
const identity=`runtime-${createHash('sha256').update(manifest).digest('hex').slice(0,16)}`;
let html=fs.readFileSync('index.html','utf8');html=html.replaceAll(/runtime-[A-Za-z0-9_-]+/g,identity);fs.writeFileSync('index.html',html);
console.log(identity);

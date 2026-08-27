import fs from 'node:fs';
import crypto from 'node:crypto';

const read = path => fs.readFileSync(path, 'utf8');
const ui = read('app-core.js');
const semantic = read('verify-prompt-semantics.mjs');

const requiredUi = [
  'answer any short plain-language questions in that same chat',
  "Paste only the agent's final JSON response",
  'A final HUMAN_INPUT_REQUIRED response is reserved for an answer that remains unavailable or explicitly deferred.'
];
for (const text of requiredUi) if (!ui.includes(text)) throw new Error(`Stage 01 human-chat guidance is missing: ${text}`);
for (const legacy of [
  'one structured HUMAN_INPUT_REQUIRED response',
  'then record the answer in User Job Input and regenerate this instruction'
]) if (ui.includes(legacy)) throw new Error(`Legacy machine-first Stage 01 guidance remains: ${legacy}`);
if (!semantic.includes('normal conversational clarification and final JSON handoff')) throw new Error('Stage 01 semantic guard is missing.');

const runtimeFiles = ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha = file => {
  const bytes = fs.readFileSync(file);
  return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};
const runtimeManifest = runtimeFiles.map(file => `${file}:${gitBlobSha(file)}\n`).join('');
const runtimeToken = `runtime-${crypto.createHash('sha256').update(runtimeManifest).digest('hex').slice(0,16)}`;
let html = read('index.html');
const existingTokens = [...new Set([...html.matchAll(/runtime-[A-Za-z0-9-]+/g)].map(match => match[0]))];
if (existingTokens.length !== 1) throw new Error(`Expected exactly one current runtime token, found ${existingTokens.join(', ') || 'none'}.`);
html = html.split(existingTokens[0]).join(runtimeToken);
fs.writeFileSync('index.html', html);

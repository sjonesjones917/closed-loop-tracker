import fs from 'node:fs';
import crypto from 'node:crypto';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const replaceOnce = (text, oldText, newText, label) => {
  const first = text.indexOf(oldText);
  if (first < 0) throw new Error(`Missing target: ${label}`);
  if (text.indexOf(oldText, first + oldText.length) >= 0) throw new Error(`Non-unique target: ${label}`);
  return text.slice(0, first) + newText + text.slice(first + oldText.length);
};

let ui = read('app-core.js');
ui = replaceOnce(
  ui,
  'Start with one thing: save the verbatim job request. Add files or constraints you already have; everything else can be clarified later. If more human information is needed now, the agent must return one structured HUMAN_INPUT_REQUIRED response. Paste it once and the application will show the plain-language questions here, validate your answers, version them as User Job Input, and regenerate Stage 01.',
  "Start with one thing: save the verbatim job request. Add files or constraints you already have. Send the generated instruction to ChatGPT and answer any short plain-language questions in that same chat. Do not re-enter normal conversation here. Paste only the agent's final JSON response. If a required answer remains unavailable or explicitly deferred and the final JSON is HUMAN_INPUT_REQUIRED, the application will show only those unresolved questions here.",
  'Stage 01 intake guidance'
);
ui = replaceOnce(
  ui,
  '<div class="notice"><strong>Clarify before final JSON.</strong> If the external agent asks a question, answer it there, then record the answer in User Job Input and regenerate this instruction. Do not paste or accept a placeholder DATA_PROPOSAL just to discover what information is missing.</div>',
  '<div class="notice"><strong>Clarify before final JSON.</strong> If ChatGPT asks a question, answer it in the same chat and continue there. Do not copy the question or answer back into this app during normal conversation. Paste only the final JSON. A final HUMAN_INPUT_REQUIRED response is reserved for an answer that remains unavailable or explicitly deferred.</div>',
  'Stage 01 workflow notice'
);
write('app-core.js', ui);

let semantic = read('verify-prompt-semantics.mjs');
semantic = replaceOnce(
  semantic,
  "if(!ui.includes('Start with one thing: save the verbatim job request')||!ui.includes('one structured HUMAN_INPUT_REQUIRED response')||!ui.includes('validate your answers, version them as User Job Input, and regenerate Stage 01'))throw new Error('Stage 01 operator UI does not explain minimum intake and structured clarification.');",
  "if(!ui.includes('Start with one thing: save the verbatim job request')||!ui.includes('answer any short plain-language questions in that same chat')||!ui.includes(\"Paste only the agent's final JSON response\")||!ui.includes('final JSON is HUMAN_INPUT_REQUIRED'))throw new Error('Stage 01 operator UI does not explain normal conversational clarification and final JSON handoff.');\n if(ui.includes('one structured HUMAN_INPUT_REQUIRED response')||ui.includes('then record the answer in User Job Input and regenerate this instruction'))throw new Error('Stage 01 operator UI still tells the human to use the app as the normal clarification channel.');",
  'Stage 01 operator UX semantic test'
);
write('verify-prompt-semantics.mjs', semantic);

const runtimeFiles = ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const runtimeToken = `runtime-${crypto.createHash('sha256').update(runtimeFiles.map(read).join('\0')).digest('hex').slice(0,16)}`;
let html = read('index.html');
const existingTokens = [...new Set([...html.matchAll(/runtime-[A-Za-z0-9-]+/g)].map(match => match[0]))];
if (existingTokens.length !== 1) throw new Error(`Expected exactly one current runtime token, found ${existingTokens.join(', ') || 'none'}.`);
html = html.split(existingTokens[0]).join(runtimeToken);
write('index.html', html);

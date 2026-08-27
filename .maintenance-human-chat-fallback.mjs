import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const replaceOnce = (text, oldText, newText, label) => {
  const first = text.indexOf(oldText);
  if (first < 0) throw new Error(`Missing target: ${label}`);
  if (text.indexOf(oldText, first + oldText.length) >= 0) throw new Error(`Non-unique target: ${label}`);
  return text.slice(0, first) + newText + text.slice(first + oldText.length);
};

let prompt = read('prompt-engine.js');
prompt = replaceOnce(prompt,
  "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/12';",
  "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/13';",
  'prompt engine version');
prompt = replaceOnce(prompt,
  'When Stage 01 cannot proceed without a genuinely human-only fact or decision, return HUMAN_INPUT_REQUIRED as the one machine response for this turn. Put only the smallest set of genuinely blocking questions in humanInputRequests using the exact contract below. Do not ask conversational questions outside the JSON response and do not ask the human to manually rewrite those answers into unrelated fields. The application will render the questions as normal human-facing controls, type-check the answers, version them as User Job Input, invalidate this prompt, and regenerate Stage 01.',
  'When Stage 01 needs a genuinely human-only fact or decision, use HUMAN COLLABORATION MODE first and ask for it conversationally before final JSON. If a required answer remains unavailable or the human explicitly defers it after that conversation, return HUMAN_INPUT_REQUIRED as the final machine response with only the still-unanswered blocking questions in humanInputRequests. The application can then display and type-check those unresolved questions, version later answers as User Job Input, invalidate this prompt, and regenerate Stage 01.',
  'Stage 01 machine-first clarification fallback');
prompt = replaceOnce(prompt,
  '- Missing human-authority information requires HUMAN_INPUT_REQUIRED. Missing, stale, incomplete, or contradictory canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT.',
  '- Missing human-authority information must be resolved through HUMAN COLLABORATION MODE when conversation is available. Use HUMAN_INPUT_REQUIRED only when a required human answer remains unavailable or explicitly deferred after that conversation, or when interactive conversation is unavailable. Missing, stale, incomplete, or contradictory canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT.',
  'global machine-first clarification fallback');
write('prompt-engine.js', prompt);

let semantic = read('verify-prompt-semantics.mjs');
const humanMode = "if(!record.prompt.includes('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE')||!record.prompt.includes('ask the smallest useful set of plain-language questions conversationally')||!record.prompt.includes('Then produce the final JSON response only.')||!record.prompt.includes('Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision'))issues.push('HUMAN_COLLABORATION_MODE_MISSING');";
semantic = replaceOnce(semantic, humanMode, humanMode + "\n  if(record.prompt.includes('Do not ask conversational questions outside the JSON response')||record.prompt.includes('Missing human-authority information requires HUMAN_INPUT_REQUIRED'))issues.push('MACHINE_FIRST_HUMAN_CLARIFICATION_CONTRADICTION');\n  if(!record.prompt.includes('Use HUMAN_INPUT_REQUIRED only when a required human answer remains unavailable or explicitly deferred after that conversation, or when interactive conversation is unavailable'))issues.push('HUMAN_INPUT_REQUIRED_FALLBACK_BOUNDARY_MISSING');", 'semantic human-mode guard');
write('verify-prompt-semantics.mjs', semantic);

let html = read('index.html');
if (!html.includes('runtime-916178475daeb452')) throw new Error('Current runtime token not found.');
html = html.split('runtime-916178475daeb452').join('runtime-human-chat-v13');
write('index.html', html);

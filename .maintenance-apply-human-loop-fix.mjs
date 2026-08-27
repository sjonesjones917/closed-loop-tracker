import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);

function replaceOnce(text, needle, replacement, label) {
  const first = text.indexOf(needle);
  if (first < 0) throw new Error(`Missing replacement target: ${label}`);
  if (text.indexOf(needle, first + needle.length) >= 0) throw new Error(`Replacement target is not unique: ${label}`);
  return text.slice(0, first) + replacement + text.slice(first + needle.length);
}

function replaceRegexOnce(text, pattern, replacement, label) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const matches = [...text.matchAll(new RegExp(pattern.source, flags))];
  if (matches.length !== 1) throw new Error(`Expected one regex target for ${label}; found ${matches.length}`);
  return text.replace(pattern, replacement);
}

function replaceInVerificationFiles(needle, replacement) {
  for (const path of fs.readdirSync('.').filter(name => /^verify.*\.mjs$/.test(name))) {
    const source = read(path);
    if (source.includes(needle)) write(path, source.split(needle).join(replacement));
  }
}

let prompt = read('prompt-engine.js');
prompt = replaceOnce(
  prompt,
  "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/11';",
  "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/12';",
  'prompt engine version'
);

const normalizedDeliverable = `CURRENT AGENT-NORMALIZED DELIVERABLE (when already accepted; otherwise UNKNOWN):
\${show(j.EXACT_DELIVERABLE_REQUESTED)}

`;
const conversationProtocol = `CURRENT AGENT-NORMALIZED DELIVERABLE (when already accepted; otherwise UNKNOWN):
\${show(j.EXACT_DELIVERABLE_REQUESTED)}

HUMAN CONVERSATION PROTOCOL — USE BEFORE THE FINAL MACHINE RESPONSE
This instruction is being run by a human in a normal ChatGPT conversation, including on a phone.
- Start with one or two concise sentences explaining what this stage is doing and whether the available information is already sufficient.
- Ask the smallest useful set of clear questions in normal language when a human-only fact or decision is genuinely needed for this stage. Ask one compact batch at a time. Explain why only when it is not obvious.
- Continue in this same chat until the human answers, supplied files, canonical context, and available tools are sufficient, or until the human says an answer is unavailable or deferred.
- Treat direct answers given by the human in this same conversation as authorized human input for this JOB_ID. Preserve them faithfully in response evidence when they support a proposed value. Never invent an answer or silently convert a missing answer into an assumption.
- Do not output a partial JSON envelope while asking questions. The human should not paste interim questions or answers into the application.
- When sufficient, return the final machine response as exactly one JSON object and nothing else.
- HUMAN_INPUT_REQUIRED is a final fallback only when a required human answer remains unavailable or the human explicitly chooses to defer it; it is not the normal first response.
- Later stages may use this same protocol when source inspection, research, requirement compilation, verification planning, production, or audit reveals a new human-only fact or decision that could not reasonably have been identified earlier.

`;
prompt = replaceOnce(prompt, normalizedDeliverable, conversationProtocol, 'global human conversation protocol');

prompt = replaceOnce(
  prompt,
  'If a genuinely human-only fact or decision is missing, ambiguous, vague, or internally inconsistent and Stage 01 cannot reliably identify the requested objective, deliverable, or input boundary without it, do not guess it.',
  'If a genuinely human-only fact or decision is missing, ambiguous, vague, or internally inconsistent and Stage 01 cannot reliably identify the requested objective, deliverable, input boundary, or foreseeable human-only intake needed to pursue the outcome without it, do not guess it.',
  'Stage 01 foreseeable intake boundary'
);

prompt = replaceOnce(
  prompt,
  'Do not block Stage 01 merely because information will be needed by a later research, design, production, filing, verification, or execution stage. Record such later-needed information in UNKNOWN_INFORMATION and let the earliest stage that actually requires it resolve it. When Stage 01 cannot proceed without a genuinely human-only fact or decision, return HUMAN_INPUT_REQUIRED as the one machine response for this turn. Put only the smallest set of genuinely blocking questions in humanInputRequests using the exact contract below. Do not ask conversational questions outside the JSON response and do not ask the human to manually rewrite those answers into unrelated fields. The application will render the questions as normal human-facing controls, type-check the answers, version them as User Job Input, invalidate this prompt, and regenerate Stage 01.',
  'At Stage 01, collect every human-only fact or decision that domain knowledge already establishes will be needed to achieve the requested outcome and that can be identified without doing later-stage research. Do not ask the human to decide a technical, legal, filing, design, or execution strategy that the agent should first research and explain; record those research-dependent decisions in UNKNOWN_INFORMATION for the earliest stage that can make a supported recommendation. Use the HUMAN CONVERSATION PROTOCOL for needed clarification. If a genuinely required human fact remains unavailable after that conversation, return HUMAN_INPUT_REQUIRED as the final machine response, with only the smallest set of still-unanswered blocking questions in humanInputRequests. The application may then display and type-check those unresolved questions, version later answers as User Job Input, invalidate this prompt, and generate a replacement Stage 01 instruction.',
  'Stage 01 conversational intake policy'
);

prompt = replaceOnce(
  prompt,
  'Do not require jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices merely to finish Stage 01; when not already controlling the job definition, record them as unresolved later-needed information for the stage that must use them.',
  'Extract any supplied jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure-history, filing-deadline, and counsel-review-versus-filing-ready facts from the available materials. Ask the human now, conversationally, only for missing human-only facts in those categories that are already clearly necessary and cannot be discovered or responsibly recommended by later research. Do not ask the human to choose a legal or filing strategy that first requires researched options; record that decision as unresolved until the responsible later stage can explain the supported choices.',
  'patent Stage 01 intake policy'
);

const clarificationPattern = /\$\{stage===1\?`STAGE 01 CLARIFICATION EXPERIENCE\n[\s\S]*?\n`:''\}/;
const clarificationReplacement = `\${stage===1?\`STAGE 01 CLARIFICATION EXPERIENCE
Before returning the final Stage 01 machine response, inspect the human-authority input and the minimum portions of supplied materials needed for job definition. Use the HUMAN CONVERSATION PROTOCOL whenever a missing human-only fact or decision is already knowable as necessary for the requested outcome. Ask the smallest useful batch in normal language, do not ask the human to repeat facts present in supplied materials, and do not perform source research or later-stage substantive work merely to create questions. Stage 01 should collect foreseeable human-only intake now, while research-dependent facts and choices remain in UNKNOWN_INFORMATION for the responsible later stage. Do not output a partial JSON response while clarifying. After the human answers and Stage 01 is sufficient, return DATA_PROPOSAL. If a required human answer remains unavailable or is explicitly deferred, return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL—with only the still-unanswered blocking questions. The application will display and type-check those questions and generate a replacement Stage 01 instruction after the missing human input is recorded. Do not hide missing human information behind UNKNOWN, placeholders, empty strings, or guessed assumptions.
\`:''}`;
prompt = replaceRegexOnce(prompt, clarificationPattern, clarificationReplacement, 'Stage 01 clarification experience');

prompt = replaceOnce(
  prompt,
  '- Return exactly one JSON object and no Markdown fence, preamble, conversational question, or trailing prose. Use valid JSON syntax with ASCII U+0022 double quotation marks for every JSON member name and string delimiter; never use typographic/curly quotation marks.',
  '- After the HUMAN CONVERSATION PROTOCOL is complete, return exactly one JSON object and no Markdown fence, preamble, question, or trailing prose. Do not mix final JSON with conversational text. Use valid JSON syntax with ASCII U+0022 double quotation marks for every JSON member name and string delimiter; never use typographic/curly quotation marks.',
  'final JSON timing rule'
);

prompt = replaceOnce(
  prompt,
  '- Never set a HUMAN or HUMAN_DECISION-owned field. When unavailable human information is required, return HUMAN_INPUT_REQUIRED and structured humanInputRequests. Do not convert a missing human fact, choice, legal assertion, engineering parameter, or authority decision into an assumption.',
  '- Never set a HUMAN or HUMAN_DECISION-owned field. Direct human answers in this same conversation are human-authority evidence for agent-owned proposals but do not transfer field ownership. If required human information remains unavailable after the conversation, return HUMAN_INPUT_REQUIRED and structured humanInputRequests. Do not convert a missing human fact, choice, legal assertion, engineering parameter, or authority decision into an assumption.',
  'human ownership rule'
);

prompt = replaceOnce(
  prompt,
  '- Missing human-authority information requires HUMAN_INPUT_REQUIRED.',
  '- Human-authority information that remains missing after the conversation protocol requires HUMAN_INPUT_REQUIRED.',
  'missing human fallback rule'
);

prompt = replaceOnce(
  prompt,
  'INPUT_SET_CONTENTS should identify the top-level supplied human inputs and attached materials available to this job. Do not turn it into a Stage 02 archive/file inventory. UNKNOWN_INFORMATION should carry nonblocking later-needed facts. ASSUMPTIONS must contain only assumptions, not unknowns or application-derived identity facts.',
  'INPUT_SET_CONTENTS should identify the top-level supplied human inputs and attached materials available to this job. Do not turn it into a Stage 02 archive/file inventory. UNKNOWN_INFORMATION should carry nonblocking later-needed facts. ASSUMPTIONS must contain only assumptions, not unknowns or application-derived identity facts. When a direct human answer from this chat supports Stage 01, identify its location as CURRENT CHAT — HUMAN ANSWER and preserve the answer faithfully in evidence content.',
  'Stage 01 chat evidence guidance'
);
write('prompt-engine.js', prompt);

let ui = read('app-core.js');
const oldProjectIntro = `<p class="section-intro">Enter only genuine human-owned User Job Input. The source count is a search target, not a quota and never permission to invent weaker sources. You do not need to know the final file format in advance: Stage 01 determines the actual artifact set and suitable formats. If the chosen agent can reliably construct the requested file or package from a defined representation and sufficient inputs, it should produce that real artifact even when a downstream authoring, build, CAD/CAM, filing, manufacturing, or other consuming system is unavailable. Opening, importing, building, executing, manufacturing, filing, or testing remains separately verified. A specification substitute requires human confirmation and is used only when the requested actual artifact cannot be generated reliably. This static application does not itself access external repositories, websites, or accounts; those capabilities depend on the external agent context you choose to run. The application derives workflow identity, versions, status, counts, and next action.</p>`;
const newProjectIntro = `<p class="section-intro">Enter the human request, known constraints, and supplied materials. The workflow determines specialist formats and later requirements.</p><details class="record-card"><summary>What belongs here<span>?</span></summary><div class="record-body">Enter only genuine human-owned User Job Input. The source count is a search target, not permission to invent sources. You do not need to know the final file format in advance. The external agent may use only capabilities actually available in its execution context, and downstream filing, building, execution, manufacturing, or testing remains separately verified.</div></details>`;
ui = replaceOnce(ui, oldProjectIntro, newProjectIntro, 'collapsible project guidance');

ui = replaceOnce(
  ui,
  'Start with one thing: save the verbatim job request. Add files or constraints you already have; everything else can be clarified later. If more human information is needed now, the agent must return one structured HUMAN_INPUT_REQUIRED response. Paste it once and the application will show the plain-language questions here, validate your answers, version them as User Job Input, and regenerate Stage 01.',
  'Start by saving the verbatim job request and list or attach the materials you already have. Then copy the generated instruction into ChatGPT. Answer concise questions in the same ChatGPT conversation; do not paste those interim messages here. When the agent has enough information, paste only the final JSON response into this application. A structured HUMAN_INPUT_REQUIRED response is reserved for an answer that is genuinely unavailable or deferred.',
  'Stage 01 human intake UI'
);

ui = replaceOnce(
  ui,
  'Answer only these human-authority questions. Answers are type-validated and versioned as User Job Input before a new controlling instruction for the same stage is saved.',
  'These questions remain only because a required human answer was unavailable or deferred in ChatGPT, or because the value must be explicitly recorded as human authority. Answers are type-validated and versioned before a new controlling instruction is saved.',
  'clarification fallback UI'
);

const newValidationMarkup = `function validationMarkup(n){const v=safe(current.projectData.responseValidations).filter(x=>Number(x.stage)===n&&!x.valid&&operatorLaneMatches(validationLaneRecord(x),n)).at(-1);if(!v)return '';return \`<div class="notice danger" id="validation-report" tabindex="-1"><strong>Previous parsed response was rejected.</strong><br><span>This report applies to \${esc(v.rawResponseId||'the last parsed response')}. If the response box now contains replacement text, that replacement has not been evaluated. Editing does not rerun validation; press Parse / validate response.</span><br>\${safe(v.issues).map(x=>esc(\`\${x.code}: \${x.message}\`)).join('<br>')}</div>\`;}`;
ui = replaceRegexOnce(ui, /^function validationMarkup\(n\)\{[^\n]*\}$/m, newValidationMarkup, 'validation state message');

ui = replaceOnce(
  ui,
  '<div class="notice"><strong>Clarify before final JSON.</strong> If the external agent asks a question, answer it there, then record the answer in User Job Input and regenerate this instruction. Do not paste or accept a placeholder DATA_PROPOSAL just to discover what information is missing.</div>',
  '<div class="notice"><strong>Use ChatGPT as a conversation before the final JSON.</strong> Answer the agent there until it has enough information. Do not paste interim questions or replies into this application. Paste only the final JSON. HUMAN_INPUT_REQUIRED is reserved for a required answer that remains unavailable or deferred.</div>',
  'Stage 01 workflow notice'
);

ui = replaceOnce(ui, '<div class="operator-step"><b>1</b><span>Send instruction</span></div>', '<div class="operator-step"><b>1</b><span>Copy instruction</span></div>', 'operator step 1');
ui = replaceOnce(ui, '<div class="operator-step"><b>2</b><span>Paste full response</span></div>', '<div class="operator-step"><b>2</b><span>Answer agent questions</span></div>', 'operator step 2');
ui = replaceOnce(ui, '<div class="operator-step"><b>3</b><span>Parse and validate</span></div>', '<div class="operator-step"><b>3</b><span>Paste final JSON</span></div>', 'operator step 3');
ui = replaceOnce(ui, '<div class="operator-step"><b>4</b><span>Review and accept</span></div>', '<div class="operator-step"><b>4</b><span>Parse, review, accept</span></div>', 'operator step 4');

ui = replaceOnce(
  ui,
  '<div class="operator-step"><b>4</b><span>Parse, review, accept</span></div></div></div><div class="panel"><h2 class="section-title">Generated instruction</h2>',
  '<div class="operator-step"><b>4</b><span>Parse, review, accept</span></div></div><details class="record-card"><summary>How to use this stage<span>?</span></summary><div class="record-body"><ol class="stage-guide-list"><li>Copy the instruction and paste it into ChatGPT.</li><li>Stay in that ChatGPT conversation and answer any concise questions. Attach requested source files there when needed.</li><li>When ChatGPT returns one final JSON object, copy only that JSON into the response box below.</li><li>Parse, review, and accept only a complete valid proposal.</li></ol><div class="notice">Do not paste interim questions, explanations, or your conversational answers into the JSON response box.</div></div></details></div><div class="panel"><h2 class="section-title">Generated instruction</h2>',
  'collapsible stage walkthrough'
);

ui = replaceOnce(ui, 'Save and copy instruction</button>', 'Copy instruction for ChatGPT</button>', 'copy instruction label');

ui = replaceOnce(
  ui,
  'Paste the complete strict JSON response. Parse / validate preserves the raw response first, then validates it without changing canonical project records. If the response declares returned files, attach those exact files in Authorized files for this stage before parsing.',
  'Paste only the agent’s final JSON object after the conversation is complete. Do not paste the agent’s questions, explanations, or your replies. Parse / validate preserves the raw response first and validates it without changing canonical project records. Attach any exact returned files before parsing.',
  'returned response guidance'
);

const oldTextarea = `<textarea class="code-text stage-output" id="stage-output"\${responseLocked?' disabled':''}>`;
const newTextarea = `<textarea class="code-text stage-output" id="stage-output" placeholder="Paste the final JSON object only after ChatGPT finishes asking questions."\${responseLocked?' disabled':''}>`;
ui = replaceOnce(ui, oldTextarea, newTextarea, 'stage output placeholder');
ui = replaceOnce(ui, 'Complete JSON only — no Markdown wrapper.', 'Final JSON only — no conversation or Markdown wrapper.', 'stage output hint');

ui = replaceOnce(
  ui,
  "if($('#parse-output'))$('#parse-output').onclick=prepareStageResponse;",
  "if($('#stage-output'))$('#stage-output').oninput=e=>{const value=e.target.value,hint=document.querySelector('.stage-output-hint span:last-child');if(hint)hint.textContent=value?`${value.length.toLocaleString()} characters · not parsed`:'No response pasted yet';const report=$('#validation-report');if(report&&value!==String(current.stages[current.activeStage]?.responseDraft||'')){report.classList.remove('danger');report.classList.add('warn');report.innerHTML='<strong>Replacement response not evaluated.</strong><br>The previous rejection belongs to the last parsed response. Press Parse / validate response to check this replacement.';}};if($('#parse-output'))$('#parse-output').onclick=prepareStageResponse;",
  'replacement response state handler'
);
write('app-core.js', ui);

let index = read('index.html');
index = index.split('runtime-6303cd4b6072bb7f').join('runtime-human-loop-20260827');
index = replaceOnce(
  index,
  '.stage-output-hint{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:4px 0 0;color:var(--muted);font-size:10.5px}',
  '.stage-output-hint{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:4px 0 0;color:var(--muted);font-size:10.5px}.stage-guide-list{margin:0 0 9px;padding-left:20px}.stage-guide-list li{margin:0 0 6px;line-height:1.45}',
  'stage guide CSS'
);
write('index.html', index);

let readme = read('README.md');
readme = replaceOnce(
  readme,
  '## Artifact generation and downstream execution',
  '## Human conversation before machine ingestion\n\nThe generated instruction is run by a human in a normal ChatGPT conversation. The agent may ask concise human-facing questions before producing the machine response. Interim questions and answers stay in ChatGPT; only the final single JSON object is pasted into the application. `HUMAN_INPUT_REQUIRED` remains a fallback for required human information that is genuinely unavailable or deferred. The same path remains available after research or later analysis discovers a new human-only fact or decision.\n\n## Artifact generation and downstream execution',
  'README human conversation section'
);
write('README.md', readme);

replaceInVerificationFiles('Do not ask conversational questions outside the JSON response', 'Ask the smallest useful set of clear questions in normal language');
replaceInVerificationFiles('Start with one thing: save the verbatim job request', 'Start by saving the verbatim job request');
replaceInVerificationFiles('one structured HUMAN_INPUT_REQUIRED response', 'answer concise questions in the same ChatGPT conversation');
replaceInVerificationFiles('validate your answers, version them as User Job Input, and regenerate Stage 01', 'paste only the final JSON response into this application');
replaceInVerificationFiles('Send instruction', 'Copy instruction');
replaceInVerificationFiles('Paste full response', 'Answer agent questions');
replaceInVerificationFiles('Parse and validate', 'Paste final JSON');
replaceInVerificationFiles('Review and accept', 'Parse, review, accept');
replaceInVerificationFiles('Save and copy instruction', 'Copy instruction for ChatGPT');
replaceInVerificationFiles('Complete JSON only — no Markdown wrapper.', 'Final JSON only — no conversation or Markdown wrapper.');

let semantics = read('verify-prompt-semantics.mjs');
semantics = replaceOnce(
  semantics,
  "  if(!record.prompt.includes('HUMAN_INPUT_REQUIRED')||!record.prompt.includes('EXECUTION_FAILED')||!record.prompt.includes('BLOCKED with MISSING_APPLICATION_CONTEXT')||!record.prompt.includes('BLOCKED with INADEQUATE_PRIOR_OUTPUT')||!record.prompt.includes('BLOCKED with MISSING_CAPABILITY'))issues.push('INSUFFICIENCY_RECOVERY_MISSING');",
  "  if(!record.prompt.includes('HUMAN_INPUT_REQUIRED')||!record.prompt.includes('EXECUTION_FAILED')||!record.prompt.includes('BLOCKED with MISSING_APPLICATION_CONTEXT')||!record.prompt.includes('BLOCKED with INADEQUATE_PRIOR_OUTPUT')||!record.prompt.includes('BLOCKED with MISSING_CAPABILITY'))issues.push('INSUFFICIENCY_RECOVERY_MISSING');\n  if(!record.prompt.includes('HUMAN CONVERSATION PROTOCOL')||!record.prompt.includes('HUMAN_INPUT_REQUIRED is a final fallback only')||!record.prompt.includes('Later stages may use this same protocol'))issues.push('HUMAN_CONVERSATION_PROTOCOL_MISSING');",
  'semantic conversation protocol check'
);

semantics = replaceOnce(
  semantics,
  "    if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL')||!record.prompt.includes('Ask the smallest useful set of clear questions in normal language')||!record.prompt.includes('display and type-check those questions')||!record.prompt.includes('generate a replacement Stage 01 instruction'))issues.push('STAGE01_STRUCTURED_CLARIFICATION_MISSING');",
  "    if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL')||!record.prompt.includes('HUMAN CONVERSATION PROTOCOL')||!record.prompt.includes('Ask the smallest useful set of clear questions in normal language')||!record.prompt.includes('HUMAN_INPUT_REQUIRED is a final fallback only')||!record.prompt.includes('display and type-check those questions'))issues.push('STAGE01_CONVERSATIONAL_CLARIFICATION_MISSING');",
  'Stage 01 semantic clarification check'
);

semantics = replaceOnce(
  semantics,
  " if(!ui.includes('Invalid application executor claim')||!ui.includes('No registered application-native executor exists'))throw new Error('Operator UI does not fail unsupported application-native test claims closed.');",
  " if(!ui.includes('Invalid application executor claim')||!ui.includes('No registered application-native executor exists'))throw new Error('Operator UI does not fail unsupported application-native test claims closed.');\n if(!ui.includes('How to use this stage')||!ui.includes('Replacement response not evaluated')||!ui.includes('previous rejection belongs to the last parsed response'))throw new Error('Operator UI does not explain the human conversation loop or distinguish a replacement from the last parsed response.');",
  'semantic operator conversation check'
);

semantics = replaceOnce(
  semantics,
  " const patent=baseProject();patent.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project.';const record=prompts.buildPromptRecord(1,patent,{operation:'COMPLETE'});if(!record.prompt.includes('ASCII U+0022')||!record.prompt.includes('never use typographic/curly quotation marks'))throw new Error('Strict JSON quote syntax is not explicit.');if(record.prompt.includes('ask only the necessary clarification questions in normal plain language first'))throw new Error('Stage 01 still contains the conversational-vs-JSON contradiction.');",
  " const patent=baseProject();patent.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project.';const record=prompts.buildPromptRecord(1,patent,{operation:'COMPLETE'});if(!record.prompt.includes('ASCII U+0022')||!record.prompt.includes('never use typographic/curly quotation marks'))throw new Error('Strict JSON quote syntax is not explicit.');if(record.prompt.includes('Do not ask conversational questions outside the JSON response'))throw new Error('Stage 01 still forbids normal human clarification.');if(!record.prompt.includes('HUMAN CONVERSATION PROTOCOL')||!record.prompt.includes('final machine response as exactly one JSON object'))throw new Error('Stage 01 does not separate human clarification from final machine output.');",
  'Stage 01 conversational regression check'
);
write('verify-prompt-semantics.mjs', semantics);

console.log('Applied human-conversation prompt and workflow UX repair.');

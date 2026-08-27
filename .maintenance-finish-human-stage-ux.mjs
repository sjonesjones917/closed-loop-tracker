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
  "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/13';",
  "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/14';",
  'prompt engine version'
);

prompt = replaceOnce(
  prompt,
  'If a genuinely human-only fact or decision is missing, ambiguous, vague, or internally inconsistent and Stage 01 cannot reliably identify the requested objective, deliverable, or input boundary without it, do not guess it. Do not block Stage 01 merely because information will be needed by a later research, design, production, filing, verification, or execution stage. Record such later-needed information in UNKNOWN_INFORMATION and let the earliest stage that actually requires it resolve it. When Stage 01 needs a genuinely human-only fact or decision, use HUMAN COLLABORATION MODE first and ask for it conversationally before final JSON. If a required answer remains unavailable or the human explicitly defers it after that conversation, return HUMAN_INPUT_REQUIRED as the final machine response with only the still-unanswered blocking questions in humanInputRequests. The application can then display and type-check those unresolved questions, version later answers as User Job Input, invalidate this prompt, and regenerate Stage 01.',
  'If a genuinely human-only fact or decision is missing, ambiguous, vague, or internally inconsistent and Stage 01 cannot reliably identify the requested objective, deliverable, input boundary, or foreseeable human-only intake needed to pursue the outcome without it, do not guess it. Do not block Stage 01 merely because information will be needed by a later research, design, production, filing, verification, or execution stage. Stage 01 should collect foreseeable human-only facts now, but defer facts and decisions that can only be discovered or responsibly recommended after later research. Do not ask the human to choose a technical, legal, filing, design, or execution strategy before the responsible stage researches and explains the supported options. Use HUMAN COLLABORATION MODE for clarification. If a genuinely required human fact remains unavailable or is explicitly deferred after that conversation, return HUMAN_INPUT_REQUIRED as the final machine response with only the smallest set of still-unanswered blocking questions in humanInputRequests. The application may then display and type-check those unresolved questions, version later answers as User Job Input, invalidate this prompt, and generate a replacement Stage 01 instruction.',
  'Stage 01 foreseeable intake and research boundary'
);

prompt = replaceOnce(
  prompt,
  '- PATENT / REGULATED FILING: use only the minimum human-supplied invention facts needed to recognize and define the requested patent-application drafting job. Use any supplied invention disclosure only for those minimum Stage 01 job-definition facts. A request such as "prepare a patent application for this project" is sufficient to define a patent-application drafting job at Stage 01 unless the human has expressed mutually incompatible deliverables. Do not make jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices automatic Stage-01 blockers. However, when any of these are foreseeable human-specific inputs for the requested patent outcome and are not already supplied, ask the human for them conversationally during Stage 01. If the human does not know or cannot decide yet, record that item as unresolved for the earliest later stage that actually requires it. Do not research patent authority, prior art, or draft the application here.',
  '- PATENT / REGULATED FILING: first extract job-definition facts already present in any supplied invention disclosure, drawings, notes, prior filing records, or other human-provided materials actually available in the executing context. Do not ask the human to repeat those facts. A request such as "prepare a patent application for this project" is sufficient to define a patent-application drafting job at Stage 01 unless the human has expressed mutually incompatible deliverables. Extract any supplied jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure-history, filing-deadline, and counsel-review-versus-filing-ready facts. Ask the human now, conversationally, only for missing human-only facts in those categories that are already clearly necessary and cannot be discovered or responsibly recommended by later research. Do not ask the human to choose a legal or filing strategy that first requires researched options; record that decision as unresolved until the responsible later stage can explain the supported choices. If the human does not know a required factual item, record it as unresolved rather than inventing it. Do not research patent authority, prior art, or draft the application here.',
  'patent Stage 01 intake boundary'
);

const clarificationPattern = /\$\{stage===1\?`STAGE 01 CLARIFICATION EXPERIENCE\n[\s\S]*?\n`:''\}/;
const clarificationReplacement = `\${stage===1?\`STAGE 01 CLARIFICATION EXPERIENCE
Before returning the final Stage 01 machine response, inspect the human-authority input and the minimum portions of supplied materials needed for job definition. Use HUMAN COLLABORATION MODE whenever a missing human-only fact or decision is already foreseeable as necessary for the requested outcome and is not dependent on later research. Ask the smallest useful batch in normal language, do not ask the human to repeat facts present in supplied materials, and do not perform source research or later-stage substantive work merely to create questions. Stage 01 should collect foreseeable human-only intake now, while research-dependent facts and choices remain in UNKNOWN_INFORMATION for the responsible later stage. Do not output a partial JSON response while clarifying. After the human answers and Stage 01 is sufficient, return DATA_PROPOSAL. If a required human answer remains unavailable or is explicitly deferred, return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL—with only the still-unanswered blocking questions. The application may then display and type-check those questions and generate a replacement Stage 01 instruction after the missing human input is recorded. Do not hide missing human information behind UNKNOWN, placeholders, empty strings, or guessed assumptions.
\`:''}`;
prompt = replaceRegexOnce(prompt, clarificationPattern, clarificationReplacement, 'Stage 01 clarification experience');

const oldCollaboration = `HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE
You are working with a human in a normal ChatGPT conversation, commonly on a phone. Make the human experience simple. If the current stage needs a human-specific fact, preference, observation, authorization, or decision that is not already available, ask the smallest useful set of plain-language questions conversationally before producing the final machine response. Briefly explain why a question matters when that is not obvious. Do not make the human read or answer JSON. Do not ask for information already present in supplied materials or canonical context, and do not ask the human for facts you can reliably determine from authorized sources, tools, or ordinary domain knowledge. Continue the conversation until you have enough information for the current stage, or the human says an item is unknown/unavailable. Then produce the final JSON response only.
Stage 01 should collect all human-specific information already foreseeable as needed to achieve the requested outcome, not merely the minimum needed to name the job. Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision; when that happens, ask the human conversationally at that later stage rather than guessing. Keep human-facing explanations concise, complete, accurate, and action-oriented.`;
const newCollaboration = `HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE
You are working with a human in a normal ChatGPT conversation, commonly on a phone. Make the human experience simple. If the current stage needs a human-specific fact, preference, observation, authorization, or decision that is not already available, ask the smallest useful set of plain-language questions conversationally before producing the final machine response. Briefly explain why a question matters when that is not obvious. Do not make the human read or answer JSON. Do not ask for information already present in supplied materials or canonical context, and do not ask the human for facts you can reliably determine from authorized sources, tools, or ordinary domain knowledge. Continue the conversation until you have enough information for the current stage, or the human says an item is unknown, unavailable, or deferred. Treat direct answers given by the human in this same conversation as authorized human input for this JOB_ID and preserve them faithfully in evidence when they support a proposed value. Do not output a partial JSON envelope while asking questions, and do not make the human paste interim questions or answers into the application. Then produce the final JSON response only. HUMAN_INPUT_REQUIRED is a final fallback only when a required human answer remains unavailable, the human explicitly chooses to defer it, or interactive conversation is unavailable; it is not the normal first response.
Stage 01 should collect all human-specific information already foreseeable as needed to achieve the requested outcome, not merely the minimum needed to name the job. Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision; when that happens, ask the human conversationally at that later stage rather than guessing. Keep human-facing explanations concise, complete, accurate, and action-oriented.`;
prompt = replaceOnce(prompt, oldCollaboration, newCollaboration, 'global human collaboration mode');

prompt = replaceOnce(
  prompt,
  '- Never set a HUMAN or HUMAN_DECISION-owned field. When unavailable human information is required, return HUMAN_INPUT_REQUIRED and structured humanInputRequests. Do not convert a missing human fact, choice, legal assertion, engineering parameter, or authority decision into an assumption.',
  '- Never set a HUMAN or HUMAN_DECISION-owned field. Direct human answers in this same conversation are human-authority evidence for agent-owned proposals but do not transfer field ownership. If required human information remains unavailable after the conversation, return HUMAN_INPUT_REQUIRED and structured humanInputRequests. Do not convert a missing human fact, choice, legal assertion, engineering parameter, or authority decision into an assumption.',
  'human ownership rule'
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
const newProjectIntro = `<p class="section-intro">Enter the human request, known constraints, and supplied materials. The workflow determines specialist formats and later requirements.</p><details class="record-card"><summary>What belongs here<span>?</span></summary><div class="record-body"><p class="section-intro">Enter only genuine human-owned User Job Input. The source count is a search target, not permission to invent sources. You do not need to know the final file format in advance: Stage 01 determines the actual artifact set and suitable formats. The external agent may use only capabilities actually available in its execution context, and downstream filing, building, execution, manufacturing, or testing remains separately verified. A specification substitute requires human confirmation and is used only when the requested artifact cannot be generated reliably. This static application does not itself access external repositories, websites, or accounts; those capabilities depend on the external agent context you choose to run.</p></div></details>`;
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
  "if($('#stage-output'))$('#stage-output').oninput=e=>{const value=e.target.value,hint=document.querySelector('.stage-output-hint span:last-child');if(hint)hint.textContent=value?`${value.length.toLocaleString()} characters · not parsed`:'No response pasted yet';const report=$('#validation-report'),parsed=String(current.stages[current.activeStage]?.responseDraft||'');if(report&&value!==parsed){report.classList.remove('danger');report.classList.add('warn');report.innerHTML='<strong>Replacement response not evaluated.</strong><br>The previous rejection belongs to the last parsed response. Press Parse / validate response to check this replacement.';}};if($('#parse-output'))$('#parse-output').onclick=prepareStageResponse;",
  'replacement response state handler'
);
write('app-core.js', ui);

let index = read('index.html');
let runtimeCount = 0;
index = index.replace(/\?v=runtime-[A-Za-z0-9-]+/g, () => {
  runtimeCount += 1;
  return '?v=runtime-human-stage-ux-20260827';
});
if (runtimeCount < 1) throw new Error('No runtime cache version tokens were found in index.html.');
write('index.html', index);

replaceInVerificationFiles('Start with one thing: save the verbatim job request', 'Start by saving the verbatim job request');
replaceInVerificationFiles('one structured HUMAN_INPUT_REQUIRED response', 'Answer concise questions in the same ChatGPT conversation');
replaceInVerificationFiles('validate your answers, version them as User Job Input, and regenerate Stage 01', 'paste only the final JSON response into this application');
replaceInVerificationFiles('Send instruction', 'Copy instruction');
replaceInVerificationFiles('Paste full response', 'Answer agent questions');
replaceInVerificationFiles('Parse and validate', 'Paste final JSON');
replaceInVerificationFiles('Review and accept', 'Parse, review, accept');
replaceInVerificationFiles('Save and copy instruction', 'Copy instruction for ChatGPT');
replaceInVerificationFiles('Complete JSON only — no Markdown wrapper.', 'Final JSON only — no conversation or Markdown wrapper.');
replaceInVerificationFiles('Response rejected before canonical mutation.', 'Previous parsed response was rejected.');

let semantics = read('verify-prompt-semantics.mjs');
semantics = replaceOnce(
  semantics,
  "  if(!record.prompt.includes('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE')||!record.prompt.includes('ask the smallest useful set of plain-language questions conversationally')||!record.prompt.includes('Then produce the final JSON response only.')||!record.prompt.includes('Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision'))issues.push('HUMAN_COLLABORATION_MODE_MISSING');",
  "  if(!record.prompt.includes('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE')||!record.prompt.includes('ask the smallest useful set of plain-language questions conversationally')||!record.prompt.includes('Treat direct answers given by the human in this same conversation as authorized human input')||!record.prompt.includes('Do not output a partial JSON envelope while asking questions')||!record.prompt.includes('HUMAN_INPUT_REQUIRED is a final fallback only')||!record.prompt.includes('Then produce the final JSON response only.')||!record.prompt.includes('Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision'))issues.push('HUMAN_COLLABORATION_MODE_MISSING');",
  'semantic global collaboration check'
);

semantics = replaceOnce(
  semantics,
  "    if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL')||!record.prompt.includes('Ask necessary human questions conversationally before the final JSON response')||!record.prompt.includes('display and type-check those questions')||!record.prompt.includes('generate a replacement Stage 01 instruction'))issues.push('STAGE01_STRUCTURED_CLARIFICATION_MISSING');",
  "    if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL')||!record.prompt.includes('Use HUMAN COLLABORATION MODE')||!record.prompt.includes('Do not output a partial JSON response while clarifying')||!record.prompt.includes('still-unanswered blocking questions')||!record.prompt.includes('generate a replacement Stage 01 instruction'))issues.push('STAGE01_CONVERSATIONAL_CLARIFICATION_MISSING');",
  'Stage 01 semantic clarification check'
);

semantics = replaceOnce(
  semantics,
  " if(!ui.includes('Start by saving the verbatim job request')||!ui.includes('Answer concise questions in the same ChatGPT conversation')||!ui.includes('paste only the final JSON response into this application'))throw new Error('Stage 01 operator UI does not explain minimum intake and structured clarification.');",
  " if(!ui.includes('Start by saving the verbatim job request')||!ui.includes('Answer concise questions in the same ChatGPT conversation')||!ui.includes('paste only the final JSON response into this application')||!ui.includes('What belongs here'))throw new Error('Stage 01 operator UI does not explain conversational intake and final JSON transfer.');",
  'semantic Stage 01 UI check'
);

semantics = replaceOnce(
  semantics,
  " if(!ui.includes('Invalid application executor claim')||!ui.includes('No registered application-native executor exists'))throw new Error('Operator UI does not fail unsupported application-native test claims closed.');",
  " if(!ui.includes('Invalid application executor claim')||!ui.includes('No registered application-native executor exists'))throw new Error('Operator UI does not fail unsupported application-native test claims closed.');\n if(!ui.includes('Replacement response not evaluated')||!ui.includes('previous rejection belongs to the last parsed response'))throw new Error('Operator UI does not distinguish replacement text from the last parsed rejection.');",
  'semantic replacement-response UI check'
);

semantics = replaceOnce(
  semantics,
  " const patent=baseProject();patent.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project.';const record=prompts.buildPromptRecord(1,patent,{operation:'COMPLETE'});if(!record.prompt.includes('ASCII U+0022')||!record.prompt.includes('never use typographic/curly quotation marks'))throw new Error('Strict JSON quote syntax is not explicit.');if(record.prompt.includes('ask only the necessary clarification questions in normal plain language first'))throw new Error('Stage 01 still contains the conversational-vs-JSON contradiction.');",
  " const patent=baseProject();patent.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project.';const record=prompts.buildPromptRecord(1,patent,{operation:'COMPLETE'});if(!record.prompt.includes('ASCII U+0022')||!record.prompt.includes('never use typographic/curly quotation marks'))throw new Error('Strict JSON quote syntax is not explicit.');if(record.prompt.includes('Do not ask conversational questions outside the JSON response'))throw new Error('Stage 01 still forbids normal human clarification.');if(!record.prompt.includes('HUMAN_INPUT_REQUIRED is a final fallback only')||!record.prompt.includes('Do not output a partial JSON envelope while asking questions'))throw new Error('Stage 01 does not separate human clarification from final machine output.');",
  'Stage 01 conversational regression check'
);

for (const [before, after] of [
  ["'Do not block Stage 01 merely because information will be needed by a later'", "'Stage 01 should collect foreseeable human-only facts now'"],
  ["'Do not make jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices automatic Stage-01 blockers'", "'Ask the human now, conversationally, only for missing human-only facts in those categories that are already clearly necessary'"],
  ["'Never ask for information merely because a later stage will need it'", "'Do not ask the human to choose a technical, legal, filing, design, or execution strategy before the responsible stage researches and explains the supported options'"],
]) {
  if (!semantics.includes(before)) throw new Error(`Missing practical-intake regression token: ${before}`);
  semantics = semantics.replace(before, after);
}
write('verify-prompt-semantics.mjs', semantics);

let browser = read('verify-browser.mjs');
browser = replaceOnce(
  browser,
  "await openStage(cdp,1);text=(await snapshot(cdp)).text;for(const token of ['Start by saving the verbatim job request','Answer concise questions in the same ChatGPT conversation','STAGE 01 NEEDS YOUR JOB REQUEST'])assert(text.includes(token),`Stage 01 clarification experience missing ${token}.`);assert(!text.includes('plain-language questions before final JSON'),'Stage 01 UI still advertises the contradictory conversational-before-JSON path.');",
  "await openStage(cdp,1);text=(await snapshot(cdp)).text;for(const token of ['Start by saving the verbatim job request','Answer concise questions in the same ChatGPT conversation','STAGE 01 NEEDS YOUR JOB REQUEST','Use ChatGPT as a conversation before the final JSON.'])assert(text.includes(token),`Stage 01 clarification experience missing ${token}.`);",
  'browser Stage 01 conversation check'
);

browser = replaceOnce(
  browser,
  "await fill(cdp,'#stage-output','{\"schema\":}');await click(cdp,'#parse-output');await waitExpr(cdp,`document.body.innerText.includes('Previous parsed response was rejected.')`);retained=await activeProject(cdp);assert(retained.projectData.sources.length===0,'Malformed response mutated canonical sources.');assert(retained.projectData.rawResponses.length>=1&&retained.projectData.responseValidations.at(-1).valid===false,'Malformed raw response/validation not preserved.');",
  "await fill(cdp,'#stage-output','{\"schema\":}');await click(cdp,'#parse-output');await waitExpr(cdp,`document.body.innerText.includes('Previous parsed response was rejected.')`);retained=await activeProject(cdp);assert(retained.projectData.sources.length===0,'Malformed response mutated canonical sources.');assert(retained.projectData.rawResponses.length>=1&&retained.projectData.responseValidations.at(-1).valid===false,'Malformed raw response/validation not preserved.');await fill(cdp,'#stage-output','{\"replacement\":true}');await waitExpr(cdp,`document.body.innerText.includes('Replacement response not evaluated.')`);assert(await evalValue(cdp,`document.querySelector('#validation-report')?.classList.contains('warn')`),'Replacement response did not replace the stale rejection state with an unparsed warning.');",
  'browser replacement-response state check'
);
write('verify-browser.mjs', browser);

console.log('Applied final human-first stage prompt and operator UX repair.');

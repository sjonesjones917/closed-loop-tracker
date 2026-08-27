import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const write=(path,text)=>fs.writeFileSync(path,text);
function replaceOnce(text,needle,replacement,label){
  const first=text.indexOf(needle);
  if(first<0)throw new Error(`Missing replacement target: ${label}`);
  if(text.indexOf(needle,first+needle.length)>=0)throw new Error(`Replacement target is not unique: ${label}`);
  return text.slice(0,first)+replacement+text.slice(first+needle.length);
}

let prompt=read('prompt-engine.js');
prompt=replaceOnce(prompt,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/15';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/16';",'prompt engine version');
prompt=replaceOnce(
  prompt,
  'If their actual contents are available in the current executing context, read only the minimum portions needed to identify the requested objective or deliverable or to resolve a genuinely Stage-01-blocking ambiguity; do not ask the human to re-enter facts that are already present in those materials.',
  'If their actual contents are available in the current executing context, read only the minimum portions needed to identify the requested objective or deliverable, extract foreseeable human-specific facts already supplied, or resolve a genuinely Stage-01-blocking ambiguity; do not ask the human to re-enter facts that are already present in those materials.',
  'Stage 01 supplied-material intake boundary'
);
prompt=replaceOnce(
  prompt,
  'If a genuinely human-only fact or decision is missing, ambiguous, vague, or internally inconsistent and Stage 01 cannot reliably identify the requested objective, deliverable, or input boundary without it, do not guess it. Do not block Stage 01 merely because information will be needed by a later research, design, production, filing, verification, or execution stage. Record such later-needed information in UNKNOWN_INFORMATION and let the earliest stage that actually requires it resolve it. When Stage 01 needs a genuinely human-only fact or decision, use HUMAN COLLABORATION MODE first and ask for it conversationally before final JSON. If a required answer remains unavailable or the human explicitly defers it after that conversation, return HUMAN_INPUT_REQUIRED as the final machine response with only the still-unanswered blocking questions in humanInputRequests. The application can then display and type-check those unresolved questions, version later answers as User Job Input, invalidate this prompt, and regenerate Stage 01.',
  'If a genuinely human-only fact or decision is missing, ambiguous, vague, or internally inconsistent and Stage 01 cannot reliably identify the requested objective, deliverable, input boundary, or foreseeable human-only intake needed to pursue the outcome without it, do not guess it. Do not block Stage 01 merely because information will be needed by a later research, design, production, filing, verification, or execution stage. Collect foreseeable human-only facts and ordinary preferences now. Keep facts and choices that can only be discovered or responsibly recommended after research in UNKNOWN_INFORMATION for the earliest responsible later stage. Do not ask the human to choose a technical, legal, filing, design, or execution strategy before the responsible stage researches and explains the supported options. When Stage 01 needs a genuinely human-only fact or decision, use HUMAN COLLABORATION MODE first and ask for it conversationally before final JSON. If a required answer remains unavailable or the human explicitly defers it after that conversation, return HUMAN_INPUT_REQUIRED as the final machine response with only the smallest set of still-unanswered blocking questions in humanInputRequests. The application can then display and type-check those unresolved questions, version later answers as User Job Input, invalidate this prompt, and regenerate Stage 01.',
  'Stage 01 foreseeable intake and research boundary'
);
const oldCollaboration=`HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE
Do not start by emitting JSON when a human-only answer is needed. Talk to the human first; JSON is the final handoff to the application, not the conversation.
You are working with a human in a normal ChatGPT conversation, commonly on a phone. Make the human experience simple. If the current stage needs a human-specific fact, preference, observation, authorization, or decision that is not already available, ask the smallest useful set of plain-language questions conversationally before producing the final machine response. Briefly explain why a question matters when that is not obvious. Do not make the human read or answer JSON. Do not ask for information already present in supplied materials or canonical context, and do not ask the human for facts you can reliably determine from authorized sources, tools, or ordinary domain knowledge. Continue the conversation until you have enough information for the current stage, or the human says an item is unknown/unavailable. Then produce the final JSON response only.
Stage 01 should collect all human-specific information already foreseeable as needed to achieve the requested outcome, not merely the minimum needed to name the job. Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision; when that happens, ask the human conversationally at that later stage rather than guessing. Keep human-facing explanations concise, complete, accurate, and action-oriented.`;
const newCollaboration=`HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE
Do not start by emitting JSON when a human-only answer is needed. Talk to the human first; JSON is the final handoff to the application, not the conversation.
You are working with a human in a normal ChatGPT conversation, commonly on a phone. Make the human experience simple. If the current stage needs a human-specific fact, preference, observation, authorization, or decision that is not already available, ask the smallest useful set of plain-language questions conversationally before producing the final machine response. Briefly explain why a question matters when that is not obvious. Do not make the human read or answer JSON. Do not ask for information already present in supplied materials or canonical context, and do not ask the human for facts you can reliably determine from authorized sources, tools, or ordinary domain knowledge. Continue the conversation until you have enough information for the current stage, or the human says an item is unknown, unavailable, or deferred. Treat direct answers given by the human in this same conversation as authorized human input for this JOB_ID and preserve them faithfully in final-response evidence when they support a proposed value. Do not output a partial JSON envelope while asking questions, and do not make the human paste interim questions or answers into the application. Then produce the final JSON response only. HUMAN_INPUT_REQUIRED is a final fallback only when a required human answer remains unavailable, is explicitly deferred, or interactive conversation is unavailable; it is not the normal first response.
Stage 01 should collect all human-specific information already foreseeable as needed to achieve the requested outcome, not merely the minimum needed to name the job. Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision; when that happens, ask the human conversationally at that later stage rather than guessing. Keep human-facing explanations concise, complete, accurate, and action-oriented.`;
prompt=replaceOnce(prompt,oldCollaboration,newCollaboration,'all-stage human collaboration protocol');
prompt=replaceOnce(
  prompt,
  '- PATENT / REGULATED FILING: use only the minimum human-supplied invention facts needed to recognize and define the requested patent-application drafting job. Use any supplied invention disclosure only for those minimum Stage 01 job-definition facts. A request such as "prepare a patent application for this project" is sufficient to define a patent-application drafting job at Stage 01 unless the human has expressed mutually incompatible deliverables. Do not make jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices automatic Stage-01 blockers. However, when any of these are foreseeable human-specific inputs for the requested patent outcome and are not already supplied, ask the human for them conversationally during Stage 01. If the human does not know or cannot decide yet, record that item as unresolved for the earliest later stage that actually requires it. Do not research patent authority, prior art, or draft the application here.',
  '- PATENT / REGULATED FILING: first extract job-definition facts already present in any supplied invention disclosure, drawings, notes, prior-filing records, or other human-provided materials actually available in the executing context. Do not ask the human to repeat those facts. A request such as "prepare a patent application for this project" is sufficient to define a patent-application drafting job at Stage 01 unless the human has expressed mutually incompatible deliverables. Extract any supplied jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure-history, filing-deadline, and counsel-review-versus-filing-ready facts. Ask conversationally only for missing human-only facts in those categories that are already clearly necessary and cannot be discovered or responsibly recommended by later research. Do not ask the human to choose a legal or filing strategy that first requires researched options; record that choice as unresolved until the responsible later stage can explain the supported options. If the human does not know a required factual item, record it as unresolved rather than inventing it. Do not research patent authority, prior art, or draft the application here.',
  'patent Stage 01 intake boundary'
);
const oldClarification=`STAGE 01 CLARIFICATION EXPERIENCE
Before the final Stage 01 machine response, determine whether the human-authority input plus any supplied materials actually available in this executing context are sufficient for Stage 01. When a genuinely human-only fact or decision is needed, ask it conversationally first under HUMAN COLLABORATION MODE. Never ask the human to repeat information available in supplied materials, and do not ask for facts the agent can reliably determine from authorized tools, sources, or ordinary domain knowledge. Continue the normal chat until enough information is available or the human says the item is unknown or unavailable. Use HUMAN_INPUT_REQUIRED only as the final machine fallback when a genuinely blocking human answer remains unavailable or explicitly deferred after that conversation, or when interactive conversation is unavailable. In that fallback, include only the smallest set of still-unanswered blocking questions in humanInputRequests. Do not hide missing human information behind UNKNOWN, placeholders, empty strings, or guessed assumptions.`;
const newClarification=`STAGE 01 CLARIFICATION EXPERIENCE
Before the final Stage 01 machine response, inspect the human-authority input and the minimum portions of supplied materials needed for job definition and foreseeable human intake. Use HUMAN COLLABORATION MODE when a missing human-only fact or ordinary preference is already foreseeable as necessary for the requested outcome and is not dependent on later research. Ask the smallest useful batch in normal language. Never ask the human to repeat information available in supplied materials, and do not ask for facts the agent can reliably determine from authorized tools, sources, or ordinary domain knowledge. Keep research-dependent facts and strategy choices in UNKNOWN_INFORMATION for the responsible later stage. Do not output a partial JSON response while clarifying. Continue the normal chat until enough information is available or the human says the item is unknown, unavailable, or deferred. When Stage 01 is sufficient, return DATA_PROPOSAL. Use HUMAN_INPUT_REQUIRED only as the final machine fallback when a genuinely blocking human answer remains unavailable or explicitly deferred after that conversation, or when interactive conversation is unavailable. In that fallback, include only the smallest set of still-unanswered blocking questions in humanInputRequests. Do not hide missing human information behind UNKNOWN, placeholders, empty strings, or guessed assumptions.`;
prompt=replaceOnce(prompt,oldClarification,newClarification,'Stage 01 clarification experience');
prompt=replaceOnce(
  prompt,
  'INPUT_SET_CONTENTS should identify the top-level supplied human inputs and attached materials available to this job. Do not turn it into a Stage 02 archive/file inventory. UNKNOWN_INFORMATION should carry nonblocking later-needed facts. ASSUMPTIONS must contain only assumptions, not unknowns or application-derived identity facts.',
  'INPUT_SET_CONTENTS should identify the top-level supplied human inputs and attached materials available to this job. Do not turn it into a Stage 02 archive/file inventory. UNKNOWN_INFORMATION should carry nonblocking later-needed facts. ASSUMPTIONS must contain only assumptions, not unknowns or application-derived identity facts. When a direct human answer from this chat supports Stage 01, use location "CURRENT CHAT — HUMAN ANSWER" and preserve the answer faithfully in evidence content.',
  'Stage 01 current-chat evidence guidance'
);
write('prompt-engine.js',prompt);

let app=read('app-core.js');
const oldProjectIntro='<p class="section-intro">Enter only genuine human-owned User Job Input. The source count is a search target, not a quota and never permission to invent weaker sources. You do not need to know the final file format in advance: Stage 01 determines the actual artifact set and suitable formats. If the chosen agent can reliably construct the requested file or package from a defined representation and sufficient inputs, it should produce that real artifact even when a downstream authoring, build, CAD/CAM, filing, manufacturing, or other consuming system is unavailable. Opening, importing, building, executing, manufacturing, filing, or testing remains separately verified. A specification substitute requires human confirmation and is used only when the requested actual artifact cannot be generated reliably. This static application does not itself access external repositories, websites, or accounts; those capabilities depend on the external agent context you choose to run. The application derives workflow identity, versions, status, counts, and next action.</p>';
const newProjectIntro='<p class="section-intro">Describe the job in your own words. Add the files, facts, constraints, and preferences you already know.</p><details class="record-card"><summary>What belongs here?<span>?</span></summary><div class="record-body"><p class="section-intro">Enter genuine human facts and decisions. You do not need to know the final file format in advance: Stage 01 determines the actual artifact set and suitable formats. When the requested artifact bytes can be generated reliably, the workflow should require the actual artifact; downstream opening, importing, building, filing, manufacturing, or testing is verified separately. A specification substitute requires human confirmation. The source count is guidance, not permission to invent weaker sources. The application owns IDs, versions, status, counts, and hashes.</p></div></details>';
app=replaceOnce(app,oldProjectIntro,newProjectIntro,'collapsible Project intake help');
app=replaceOnce(
  app,
  'Answer only these human-authority questions. Answers are type-validated and versioned as User Job Input before a new controlling instruction for the same stage is saved.',
  'These questions remain only because a required human answer was unavailable or deferred in ChatGPT, or because the value must be explicitly recorded as human authority. Answer only the questions shown; the application validates and versions the answers before regenerating the instruction.',
  'fallback clarification explanation'
);
app=replaceOnce(app,'<div class="operator-step"><b>1</b><span>Send instruction</span></div>','<div class="operator-step"><b>1</b><span>Copy instruction</span></div>','operator step 1');
app=replaceOnce(app,'<div class="operator-step"><b>4</b><span>Validate and review</span></div>','<div class="operator-step"><b>4</b><span>Parse, review, accept</span></div>','operator step 4');
app=replaceOnce(app,'Save and copy instruction</button>','Copy instruction for ChatGPT</button>','copy instruction button');
app=replaceOnce(
  app,
  '<textarea class="code-text stage-output" id="stage-output"${responseLocked?\' disabled\':\'\'}>',
  '<textarea class="code-text stage-output" id="stage-output" placeholder="Paste the final JSON object only after ChatGPT finishes asking questions."${responseLocked?\' disabled\':\'\'}>',
  'final JSON response placeholder'
);
app=replaceOnce(app,'Complete JSON only — no Markdown wrapper.','Final JSON only — no conversation or Markdown wrapper.','final JSON response hint');
write('app-core.js',app);

let semantics=read('verify-prompt-semantics.mjs');
semantics=replaceOnce(
  semantics,
  "  if(!record.prompt.includes('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE')||!record.prompt.includes('ask the smallest useful set of plain-language questions conversationally')||!record.prompt.includes('Then produce the final JSON response only.')||!record.prompt.includes('Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision'))issues.push('HUMAN_COLLABORATION_MODE_MISSING');",
  "  if(!record.prompt.includes('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE')||!record.prompt.includes('ask the smallest useful set of plain-language questions conversationally')||!record.prompt.includes('Treat direct answers given by the human in this same conversation as authorized human input')||!record.prompt.includes('Do not output a partial JSON envelope while asking questions')||!record.prompt.includes('HUMAN_INPUT_REQUIRED is a final fallback only')||!record.prompt.includes('Then produce the final JSON response only.')||!record.prompt.includes('Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision'))issues.push('HUMAN_COLLABORATION_MODE_MISSING');",
  'all-stage conversation semantic check'
);
semantics=replaceOnce(
  semantics,
  "    if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('ask it conversationally first under HUMAN COLLABORATION MODE')||!record.prompt.includes('Use HUMAN_INPUT_REQUIRED only as the final machine fallback'))issues.push('STAGE01_CONVERSATION_FIRST_CLARIFICATION_MISSING');",
  "    if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('Use HUMAN COLLABORATION MODE when a missing human-only fact or ordinary preference is already foreseeable')||!record.prompt.includes('Keep research-dependent facts and strategy choices in UNKNOWN_INFORMATION')||!record.prompt.includes('Do not output a partial JSON response while clarifying')||!record.prompt.includes('Use HUMAN_INPUT_REQUIRED only as the final machine fallback'))issues.push('STAGE01_CONVERSATION_FIRST_CLARIFICATION_MISSING');",
  'Stage 01 clarification semantic check'
);
semantics=replaceOnce(
  semantics,
  " if(!ui.includes('Stage 01 is an intake conversation')||!ui.includes('remaining human-only questions in normal chat')||!ui.includes('HUMAN_INPUT_REQUIRED in this app is only a fallback')||!ui.includes('Answer agent questions')||!ui.includes('Paste final JSON'))throw new Error('Stage 01 operator UI does not explain the human conversation and final JSON handoff.');",
  " if(!ui.includes('Stage 01 is an intake conversation')||!ui.includes('remaining human-only questions in normal chat')||!ui.includes('HUMAN_INPUT_REQUIRED in this app is only a fallback')||!ui.includes('Answer agent questions')||!ui.includes('Paste final JSON')||!ui.includes('What belongs here?'))throw new Error('Stage 01 operator UI does not explain the human conversation and final JSON handoff.');",
  'Stage 01 UI semantic check'
);
semantics=replaceOnce(semantics,"  'Do not block Stage 01 merely because information will be needed by a later',","  'Collect foreseeable human-only facts and ordinary preferences now',",'practical intake token 1');
semantics=replaceOnce(semantics,"  'Do not make jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices automatic Stage-01 blockers',","  'Ask conversationally only for missing human-only facts in those categories that are already clearly necessary',",'practical intake token 2');
semantics=replaceOnce(semantics,"  'Stage 01 also owns proactive human intake: before finalizing Stage 01, collect the human-specific facts and decisions that are already foreseeable as necessary to achieve the requested outcome',","  'Do not ask the human to choose a legal or filing strategy that first requires researched options',",'practical intake token 3');
semantics=replaceOnce(
  semantics,
  " const patent=baseProject();patent.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project.';const record=prompts.buildPromptRecord(1,patent,{operation:'COMPLETE'});if(!record.prompt.includes('ASCII U+0022')||!record.prompt.includes('never use typographic/curly quotation marks'))throw new Error('Strict JSON quote syntax is not explicit.');",
  " const patent=baseProject();patent.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project.';const record=prompts.buildPromptRecord(1,patent,{operation:'COMPLETE'});if(!record.prompt.includes('ASCII U+0022')||!record.prompt.includes('never use typographic/curly quotation marks'))throw new Error('Strict JSON quote syntax is not explicit.');if(!record.prompt.includes('Do not output a partial JSON envelope while asking questions')||!record.prompt.includes('HUMAN_INPUT_REQUIRED is a final fallback only')||!record.prompt.includes('CURRENT CHAT — HUMAN ANSWER'))throw new Error('Stage 01 does not preserve the human conversation/final JSON boundary.');",
  'Stage 01 regression conversation boundary'
);
write('verify-prompt-semantics.mjs',semantics);

let browser=read('verify-browser.mjs');
browser=replaceOnce(
  browser,
  "for(const token of ['Independent external sources only.','closed-loop-stage-response/2','PROMPT IDENTITY','Parse / validate response','Send instruction','Answer agent questions','Paste final JSON','Validate and review','Expand preview','exact controlling copy block','Complete JSON only'])",
  "for(const token of ['Independent external sources only.','closed-loop-stage-response/2','PROMPT IDENTITY','Parse / validate response','Copy instruction','Answer agent questions','Paste final JSON','Parse, review, accept','Expand preview','exact controlling copy block','Final JSON only'])",
  'Stage 02 browser workflow tokens'
);
browser=replaceOnce(
  browser,
  "await click(cdp,'[data-view=\"Project\"]');text=(await snapshot(cdp)).text;for(const token of ['Output format (optional)','You do not need to know the final file format in advance','A specification substitute requires human confirmation'])",
  "await click(cdp,'[data-view=\"Project\"]');await click(cdp,'details.record-card summary');text=(await snapshot(cdp)).text;for(const token of ['Output format (optional)','What belongs here?','You do not need to know the final file format in advance','A specification substitute requires human confirmation'])",
  'collapsed Project help browser check'
);
write('verify-browser.mjs',browser);

console.log('Applied Stage 01 research boundary and concise collapsible operator guidance.');

import fs from 'node:fs';

function replaceOne(text,before,after,label){
  if(!text.includes(before))throw new Error(`Missing patch anchor: ${label}`);
  const next=text.replace(before,after);
  if(next===text)throw new Error(`Patch made no change: ${label}`);
  console.log(`patched ${label}`);
  return next;
}

let prompt=fs.readFileSync('prompt-engine.js','utf8');
prompt=replaceOne(prompt,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/11';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/12';",'prompt engine version');
prompt=replaceOne(prompt,
`ROLE
You are the ${'${d.role}'}. Perform only Stage ${'${String(stage).padStart(2,\'0\')}'} for this single current project.

PROJECT-SCOPE BOUNDARY`,
`ROLE
You are the ${'${d.role}'}. Perform only Stage ${'${String(stage).padStart(2,\'0\')}'} for this single current project.

AGENT-HUMAN INTERACTION MODE
This prompt is designed for an interactive ChatGPT-style conversation. The human conversation and the application machine handoff are separate phases. Start by briefly telling the human what you will do in this stage and whether you already have enough information. While working, if a human-only fact, preference, constraint, or decision is needed and the current interface supports conversation, ask the human directly in concise normal language, wait for the answer, and continue. Ask only questions the human must answer; do not ask for facts you can read from supplied materials, research from authorized sources, or determine from accepted project state. Group related questions when that reduces back-and-forth. Explain why a question matters only when it is not obvious. Do not emit machine JSON during an interactive clarification turn. When you have enough information to complete this stage, tell the human in one short sentence that the final app response is ready, then return the final machine JSON exactly as required below. If the current environment cannot conduct an interactive conversation, use HUMAN_INPUT_REQUIRED as the machine fallback.

PROJECT-SCOPE BOUNDARY`,'interaction mode');

prompt=replaceOne(prompt,
'- PATENT / REGULATED FILING: use only the minimum human-supplied invention facts needed to recognize and define the requested patent-application drafting job. Use any supplied invention disclosure only for those minimum Stage 01 job-definition facts. A request such as "prepare a patent application for this project" is sufficient to define a patent-application drafting job at Stage 01 unless the human has expressed mutually incompatible deliverables. Do not inventory the invention packet internally in Stage 01. Do not require jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices merely to finish Stage 01; when not already controlling the job definition, record them as unresolved later-needed information for the stage that must use them. Do not research patent authority, prior art, or draft the application here.',
'- PATENT / REGULATED FILING: define the patent-application job and complete a practical human intake before later research begins. Inspect supplied invention materials first and never ask the human to repeat facts already present there. Use domain knowledge to identify human-only facts and preferences that are foreseeably material to the requested patent outcome, including jurisdiction or intended filing path, inventor and ownership facts, prior filings or priority claims, known disclosure or sale history, meaningful filing timing, and whether the desired package is for review or intended filing, but ask only for items not already supplied and only to the extent they are genuine human facts or choices. When the human asks you to choose what is best, explain the material options briefly and ask for confirmation only when a real human choice remains. A human may answer UNKNOWN or NONE when appropriate; do not force invented certainty. Do not perform patent-authority research, prior-art research, patentability analysis, claim drafting, or filing in Stage 01.','Stage 01 patent intake');

const clarification=/STAGE 01 CLARIFICATION EXPERIENCE\nBefore returning the Stage 01 machine response,[\s\S]*?Do not hide missing human information behind UNKNOWN, placeholders, empty strings, or guessed assumptions\.\n/;
if(!clarification.test(prompt))throw new Error('Missing Stage 01 clarification block');
prompt=prompt.replace(clarification,`STAGE 01 CLARIFICATION EXPERIENCE
Before the final Stage 01 machine handoff, perform a practical intake pass. Use the human-authority input plus supplied materials actually available in this executing context, then use domain knowledge to identify the human-only facts, preferences, constraints, and decisions that are foreseeably needed to pursue the requested outcome reliably. If the current interface supports conversation, ask those missing human questions directly in concise normal language and continue the conversation until the Stage 01 intake is sufficient. Do not ask the human for common knowledge, researchable authority, facts available in supplied materials, or specialist file-format choices the agent can determine later. Do not ask the same question twice. If later research exposes a new human-only dependency that was not reasonably knowable at Stage 01, the later stage may ask for it under the same interaction mode. If interactive questioning is unavailable, return HUMAN_INPUT_REQUIRED using the exact machine question contract. Do not hide missing human information behind guessed assumptions.
`);
console.log('patched Stage 01 clarification experience');

prompt=replaceOne(prompt,
'- Return exactly one JSON object and no Markdown fence, preamble, conversational question, or trailing prose. Use valid JSON syntax with ASCII U+0022 double quotation marks for every JSON member name and string delimiter; never use typographic/curly quotation marks.',
'- FINAL MACHINE HANDOFF ONLY: after the interactive work and any human clarification are complete, return exactly one JSON object and no Markdown fence, preamble, conversational question, or trailing prose. Use valid JSON syntax with ASCII U+0022 double quotation marks for every JSON member name and string delimiter; never use typographic/curly quotation marks. This restriction applies to the final app handoff, not to earlier normal human conversation.','final handoff rule');
prompt=replaceOne(prompt,
'- Never set a HUMAN or HUMAN_DECISION-owned field. When unavailable human information is required, return HUMAN_INPUT_REQUIRED and structured humanInputRequests. Do not convert a missing human fact, choice, legal assertion, engineering parameter, or authority decision into an assumption.',
'- Never set a HUMAN or HUMAN_DECISION-owned canonical field. In an interactive conversation, ask the human directly when a missing human fact or decision is required and use the answer only as human-provided context for this stage; do not convert it into an assumption. If interactive conversation is unavailable, return HUMAN_INPUT_REQUIRED with structured humanInputRequests. Application-owned confirmations or authorizations still require the application control that owns them.','human authority rule');
prompt=replaceOne(prompt,
'When Stage 01 cannot proceed without a genuinely human-only fact or decision, return HUMAN_INPUT_REQUIRED as the one machine response for this turn. Put only the smallest set of genuinely blocking questions in humanInputRequests using the exact contract below. Do not ask conversational questions outside the JSON response and do not ask the human to manually rewrite those answers into unrelated fields. The application will render the questions as normal human-facing controls, type-check the answers, version them as User Job Input, invalidate this prompt, and regenerate Stage 01.',
'When Stage 01 needs a genuinely human-only fact or decision and the current interface supports conversation, ask the human directly in normal language, wait for the answer, and continue until the intake is sufficient for the final Stage 01 proposal. If interactive conversation is unavailable, return HUMAN_INPUT_REQUIRED using the exact machine question contract. Do not ask the human to manually translate machine fields or identifiers.','Stage 01 procedure clarification');
fs.writeFileSync('prompt-engine.js',prompt);

let app=fs.readFileSync('app-core.js','utf8');
app=replaceOne(app,
'Start with one thing: save the verbatim job request. Add files or constraints you already have; everything else can be clarified later. If more human information is needed now, the agent must return one structured HUMAN_INPUT_REQUIRED response. Paste it once and the application will show the plain-language questions here, validate your answers, version them as User Job Input, and regenerate Stage 01.',
'Start by saving the verbatim job request and any files or constraints you already have. Then copy the Stage 01 instruction into ChatGPT. The agent should talk with you normally, inspect available supplied material, and ask only the human questions it still needs. When it has enough information, it will produce one final JSON response for this application. HUMAN_INPUT_REQUIRED remains only as the fallback when the agent cannot converse interactively.','Stage 01 intake help');
app=replaceOne(app,
'<div class="notice"><strong>Clarify before final JSON.</strong> If the external agent asks a question, answer it there, then record the answer in User Job Input and regenerate this instruction. Do not paste or accept a placeholder DATA_PROPOSAL just to discover what information is missing.</div>',
'<div class="notice"><strong>Talk to the agent first; paste JSON last.</strong> Answer concise human questions in the ChatGPT conversation. Do not paste intermediate conversation into this application. Paste only the final app JSON after the agent says the stage handoff is ready.</div>','Stage 01 workflow notice');

const loop=/<div class=\"panel\"><h2 class=\"section-title\">Agent loop<\/h2><div class=\"operator-loop\"[\s\S]*?<\/div><\/div><div class=\"panel\"><h2 class=\"section-title\">Generated instruction<\/h2>/;
if(!loop.test(app))throw new Error('Missing agent loop markup');
app=app.replace(loop,`<div class=\"panel\"><h2 class=\"section-title\">Work with ChatGPT / agent</h2><div class=\"operator-loop\" aria-label=\"Normal stage workflow\"><div class=\"operator-step\"><b>1</b><span>Copy instruction</span></div><div class=\"operator-step\"><b>2</b><span>Chat and answer questions</span></div><div class=\"operator-step\"><b>3</b><span>Copy final app JSON</span></div><div class=\"operator-step\"><b>4</b><span>Paste, validate, review</span></div></div><details class=\"record-card\"><summary>? How to run this stage<span>Guide</span></summary><div class=\"record-body\"><p class=\"section-intro\">Send the saved instruction to the agent in a normal conversation. Let the agent use the supplied files and current stage context. If it asks a human-only question, answer it there. The agent may explain findings while it works, but the machine response is only the final handoff. When the agent says the final app response is ready, copy only that final JSON object into Returned agent response below, then Parse / validate. If research or requirements later reveal a new human-only dependency, that stage may ask you for it the same way. The application still owns canonical IDs, versions, hashes, status, gates, and acceptance.</p></div></details></div><div class=\"panel\"><h2 class=\"section-title\">Generated instruction</h2>`);
console.log('patched operator agent loop');
app=replaceOne(app,
'Paste the complete strict JSON response. Parse / validate preserves the raw response first, then validates it without changing canonical project records. If the response declares returned files, attach those exact files in Authorized files for this stage before parsing.',
'Paste only the final app JSON from the agent, not the earlier conversation. Parse / validate preserves the raw response first, then validates it without changing canonical project records. If the response declares returned files, attach those exact files in Authorized files for this stage before parsing.','returned response help');
fs.writeFileSync('app-core.js',app);

let sem=fs.readFileSync('verify-prompt-semantics.mjs','utf8');
sem=replaceOne(sem,
"if(record.promptEngineVersion!==prompts.version)issues.push('PROMPT_ENGINE_VERSION_MISSING');",
"if(record.promptEngineVersion!==prompts.version)issues.push('PROMPT_ENGINE_VERSION_MISSING');\n  if(!record.prompt.includes('AGENT-HUMAN INTERACTION MODE')||!record.prompt.includes('machine JSON is the final handoff')||!record.prompt.includes('Do not emit machine JSON during an interactive clarification turn')||!record.prompt.includes('If the current environment cannot conduct an interactive conversation, use HUMAN_INPUT_REQUIRED'))issues.push('INTERACTIVE_HUMAN_EXPERIENCE_MISSING');",'all-stage interaction test');
sem=replaceOne(sem,
"if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL')||!record.prompt.includes('Do not ask conversational questions outside the JSON response')||!record.prompt.includes('display and type-check those questions')||!record.prompt.includes('generate a replacement Stage 01 instruction'))issues.push('STAGE01_STRUCTURED_CLARIFICATION_MISSING');",
"if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('ask those missing human questions directly in concise normal language')||!record.prompt.includes('If interactive questioning is unavailable, return HUMAN_INPUT_REQUIRED')||!record.prompt.includes('later stage may ask for it under the same interaction mode'))issues.push('STAGE01_INTERACTIVE_CLARIFICATION_MISSING');",'Stage 01 interaction test');
sem=replaceOne(sem,
"if(!ui.includes('Start with one thing: save the verbatim job request')||!ui.includes('one structured HUMAN_INPUT_REQUIRED response')||!ui.includes('validate your answers, version them as User Job Input, and regenerate Stage 01'))throw new Error('Stage 01 operator UI does not explain minimum intake and structured clarification.');",
"if(!ui.includes('Start by saving the verbatim job request')||!ui.includes('agent should talk with you normally')||!ui.includes('final JSON response for this application')||!ui.includes('? How to run this stage')||!ui.includes('Chat and answer questions')||!ui.includes('Paste only the final app JSON'))throw new Error('Operator UI does not explain the interactive agent conversation and final machine handoff.');",'operator UI interaction test');
sem=replaceOne(sem,
"if(record.prompt.includes('ask only the necessary clarification questions in normal plain language first'))throw new Error('Stage 01 still contains the conversational-vs-JSON contradiction.');",
"if(!record.prompt.includes('This restriction applies to the final app handoff, not to earlier normal human conversation.'))throw new Error('Final JSON and conversational clarification phases are not explicitly separated.');",'conversation/final separation test');
fs.writeFileSync('verify-prompt-semantics.mjs',sem);

let browser=fs.readFileSync('verify-browser.mjs','utf8');
browser=browser.replaceAll('one structured HUMAN_INPUT_REQUIRED response','agent should talk with you normally');
browser=browser.replaceAll('Clarify before final JSON.','Talk to the agent first; paste JSON last.');
fs.writeFileSync('verify-browser.mjs',browser);

let html=fs.readFileSync('index.html','utf8');
html=html.replaceAll(/runtime-[A-Za-z0-9_-]+/g,'runtime-6a7e1f9c2d4b8a10');
fs.writeFileSync('index.html',html);

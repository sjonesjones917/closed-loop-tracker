import fs from 'node:fs';
import {createHash} from 'node:crypto';
const one=(text,before,after,label)=>{if(!text.includes(before))throw new Error(`Missing anchor: ${label}`);const next=text.replace(before,after);if(next===text)throw new Error(`No change: ${label}`);console.log(`patched ${label}`);return next;};

let p=fs.readFileSync('prompt-engine.js','utf8');
p=one(p,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/12';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/13';",'prompt version');
p=one(p,
'- PATENT / REGULATED FILING: use only the minimum human-supplied invention facts needed to recognize and define the requested patent-application drafting job. Use any supplied invention disclosure only for those minimum Stage 01 job-definition facts. A request such as "prepare a patent application for this project" is sufficient to define a patent-application drafting job at Stage 01 unless the human has expressed mutually incompatible deliverables. Do not make jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices automatic Stage-01 blockers. However, when any of these are foreseeable human-specific inputs for the requested patent outcome and are not already supplied, ask the human for them conversationally during Stage 01. If the human does not know or cannot decide yet, record that item as unresolved for the earliest later stage that actually requires it. Do not research patent authority, prior art, or draft the application here.',
'- PATENT / REGULATED FILING: recognize the patent-application drafting job and complete a practical human intake before later research begins. Inspect any supplied invention disclosure and other supplied invention materials first and never ask the human to repeat facts already present there. A request such as "prepare a patent application for this project" is sufficient to define the patent-application drafting job; after recognizing it, continue the practical human intake for foreseeable human-only facts needed to pursue the requested outcome reliably. These can include jurisdiction or intended filing path, inventor and ownership facts, prior filings or priority claims, known disclosure or sale history, meaningful filing timing, and whether the desired package is for review or intended filing. Ask only for missing items that are genuine human facts or choices. When the human asks you to choose what is best, briefly explain materially different options and ask for confirmation only when a real human choice remains. The human may answer UNKNOWN or NONE when appropriate; do not force invented certainty. Do not perform patent-authority research, prior-art research, patentability analysis, claim drafting, or filing in Stage 01.','patent intake');
const oldClar=`STAGE 01 CLARIFICATION EXPERIENCE
Before returning the Stage 01 machine response, determine whether the human-authority input plus any supplied materials actually available in this executing context are sufficient for the Stage 01 job-definition result only. Ask for clarification only when an irreducible human fact or decision is needed now to identify the objective, intended deliverable, or input boundary. Never ask for information merely because a later stage will need it, and never ask the human to repeat information you can directly read from supplied materials. If such a genuinely Stage-01-blocking fact is missing, return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL—as the single response. Put only the smallest set of blocking questions inside humanInputRequests using the exact question contract below. Ask necessary human questions conversationally before the final JSON response; do not encode a question as JSON merely to talk to the human. The application will display and type-check those questions, version the answers as User Job Input, invalidate this prompt, and generate a replacement Stage 01 instruction. Do not hide missing human information behind UNKNOWN, placeholders, empty strings, or guessed assumptions.`;
const newClar=`STAGE 01 CLARIFICATION EXPERIENCE
Before the final Stage 01 application handoff, perform a practical intake pass. Use the human-authority input plus supplied materials actually available in this executing context, then use domain knowledge to identify human-only facts, preferences, constraints, and decisions that are foreseeably needed to pursue the requested outcome reliably. In an interactive conversation, ask those missing human questions directly in concise normal language and continue until the Stage 01 intake is sufficient. Do not ask the human for common knowledge, researchable authority, facts available in supplied materials, or specialist format/tool choices the agent can determine later. Do not ask the same question twice. If later source discovery, research, or requirement compilation exposes a new human-only dependency that was not reasonably knowable at Stage 01, that later stage may ask the human directly under the same collaboration mode. If interactive conversation is unavailable, return HUMAN_INPUT_REQUIRED using the exact machine question contract. Do not hide missing human information behind guessed assumptions.`;
p=one(p,oldClar,newClar,'Stage 01 clarification');
p=one(p,
'When Stage 01 cannot proceed without a genuinely human-only fact or decision, return HUMAN_INPUT_REQUIRED as the one machine response for this turn. Put only the smallest set of genuinely blocking questions in humanInputRequests using the exact contract below. Do not ask conversational questions outside the JSON response and do not ask the human to manually rewrite those answers into unrelated fields. The application will render the questions as normal human-facing controls, type-check the answers, version them as User Job Input, invalidate this prompt, and regenerate Stage 01.',
'When Stage 01 needs a genuinely human-only fact or decision and the current environment supports conversation, ask the human directly in normal language, wait for the answer, and continue until the intake is sufficient for the final Stage 01 proposal. If interactive conversation is unavailable, return HUMAN_INPUT_REQUIRED using the exact machine question contract. Do not ask the human to translate machine fields or identifiers.','Stage 01 procedure');
p=one(p,
'Then produce the final JSON response only.',
'Then produce the FINAL APP RESPONSE handoff defined below.','global collaboration handoff');
p=one(p,
'- When you have enough information to submit the current stage result, return exactly one final JSON object and no Markdown fence, preamble, conversational question, or trailing prose. Before that final submission, normal concise human dialogue is allowed and required when human-only information is needed. Use valid JSON syntax with ASCII U+0022 double quotation marks for every JSON member name and string delimiter; never use typographic/curly quotation marks.',
'- FINAL HANDOFF FORMAT: when you have enough information to submit the current stage result, give the human a concise status explanation of no more than four short sentences, then write a line containing exactly FINAL APP RESPONSE, then one Markdown fenced code block tagged json containing exactly one response JSON object, with no text after the closing fence. Use valid JSON syntax with ASCII U+0022 double quotation marks inside that JSON; never use typographic/curly quotation marks there. Do not use FINAL APP RESPONSE or a JSON fence on an interactive clarification turn. The application accepts this exact framed handoff and remains backward-compatible with a bare JSON object.','final handoff rule');
p=one(p,
'- Never set a HUMAN or HUMAN_DECISION-owned field. When unavailable human information is required, return HUMAN_INPUT_REQUIRED and structured humanInputRequests. Do not convert a missing human fact, choice, legal assertion, engineering parameter, or authority decision into an assumption.',
'- Never set a HUMAN or HUMAN_DECISION-owned canonical field. When human information is required and the current environment supports conversation, ask the human directly and use the answer only as human-provided context; do not convert missing human authority into an assumption. If interactive conversation is unavailable, return HUMAN_INPUT_REQUIRED with structured humanInputRequests. Application-owned confirmations and authorizations still require the application control that owns them.','human authority rule');
p=one(p,
'- Missing human-authority information requires HUMAN_INPUT_REQUIRED. Missing, stale, incomplete, or contradictory canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT.',
'- In an interactive conversation, missing human-authority information must be requested directly from the human; if interactive conversation is unavailable, use HUMAN_INPUT_REQUIRED. Missing, stale, incomplete, or contradictory canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT.','generic missing-human rule');
fs.writeFileSync('prompt-engine.js',p);

let ing=fs.readFileSync('response-ingestion.js','utf8');
const strictRe=/function strictParse\(text,\{limits=schema\.DEFAULT_RESOURCE_LIMITS\}=\{\}\)\{[\s\S]*?\n\}\n\nfunction disposition/;
if(!strictRe.test(ing))throw new Error('Missing strictParse function');
const parser=fs.readFileSync('.tmp-framed-parser.txt','utf8').trimEnd();
ing=ing.replace(strictRe,parser+'\n\nfunction disposition');
fs.writeFileSync('response-ingestion.js',ing);

let app=fs.readFileSync('app-core.js','utf8');
app=one(app,
'Start with one thing: save the verbatim job request. Add files or constraints you already have; everything else can be clarified later. If more human information is needed now, the agent must return one structured HUMAN_INPUT_REQUIRED response. Paste it once and the application will show the plain-language questions here, validate your answers, version them as User Job Input, and regenerate Stage 01.',
'Start with the verbatim job request plus any files or constraints you already have. Then send the Stage 01 instruction to ChatGPT and talk normally. The agent should inspect available supplied material and ask only the human questions it still needs. When the stage is ready, copy its final handoff back into this application.','Stage 01 human intake help');
app=one(app,
'<div class="notice"><strong>Clarify before final JSON.</strong> If the external agent asks a question, answer it there, then record the answer in User Job Input and regenerate this instruction. Do not paste or accept a placeholder DATA_PROPOSAL just to discover what information is missing.</div>',
'<div class="notice"><strong>Talk to the agent first; paste the final handoff last.</strong> Answer concise human questions in the ChatGPT conversation. Do not paste intermediate conversation here. When the agent produces FINAL APP RESPONSE, paste that whole final message below.</div>','Stage 01 notice');
app=one(app,
'<div class="panel"><h2 class="section-title">Agent loop</h2><div class="operator-loop" aria-label="Normal stage workflow"><div class="operator-step"><b>1</b><span>Send instruction</span></div><div class="operator-step"><b>2</b><span>Paste full response</span></div><div class="operator-step"><b>3</b><span>Parse and validate</span></div><div class="operator-step"><b>4</b><span>Review and accept</span></div></div></div>',
'<div class="panel"><h2 class="section-title">Work with ChatGPT / agent</h2><div class="operator-loop" aria-label="Normal stage workflow"><div class="operator-step"><b>1</b><span>Copy instruction</span></div><div class="operator-step"><b>2</b><span>Chat and answer questions</span></div><div class="operator-step"><b>3</b><span>Copy final handoff</span></div><div class="operator-step"><b>4</b><span>Paste, validate, review</span></div></div><details class="record-card"><summary>? How to run this stage<span>Guide</span></summary><div class="record-body"><p class="section-intro">Send the saved instruction to ChatGPT in a normal conversation. Let the agent use supplied files and current project context. If it asks a human-only question, answer it there. When the stage is ready, the agent gives a short explanation followed by the exact FINAL APP RESPONSE JSON block. Copy that whole final message into Returned agent response; the application extracts only the marked JSON block and still applies the strict stage contract. If source research or requirements later reveal a new human-only dependency, that later stage may ask you the same way. Application-owned IDs, versions, hashes, status, gates, and acceptance remain application-controlled.</p></div></details></div>','agent loop guide');
app=one(app,
'Paste the complete strict JSON response. Parse / validate preserves the raw response first, then validates it without changing canonical project records. If the response declares returned files, attach those exact files in Authorized files for this stage before parsing.',
'Paste the agent’s whole final handoff. The application accepts either bare JSON or the exact FINAL APP RESPONSE + json-fence format generated by the prompt, extracts only that marked JSON object, preserves the complete raw response, and validates it without changing canonical project records. If the response declares returned files, attach those exact files in Authorized files for this stage before parsing.','returned response help');
app=one(app,
'Complete JSON only — no Markdown wrapper.',
'Final handoff or bare JSON — marked JSON is extracted and strictly validated.','response hint');
fs.writeFileSync('app-core.js',app);

let sem=fs.readFileSync('verify-prompt-semantics.mjs','utf8');
sem=one(sem,
"if(!record.prompt.includes('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE')||!record.prompt.includes('ask the smallest useful set of plain-language questions conversationally')||!record.prompt.includes('Then produce the final JSON response only.')||!record.prompt.includes('Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision'))issues.push('HUMAN_COLLABORATION_MODE_MISSING');",
"if(!record.prompt.includes('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE')||!record.prompt.includes('ask the smallest useful set of plain-language questions conversationally')||!record.prompt.includes('Then produce the FINAL APP RESPONSE handoff defined below.')||!record.prompt.includes('Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision')||!record.prompt.includes('FINAL HANDOFF FORMAT'))issues.push('HUMAN_COLLABORATION_MODE_MISSING');",'semantic all-stage handoff');
sem=one(sem,
"if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL')||!record.prompt.includes('Ask necessary human questions conversationally before the final JSON response')||!record.prompt.includes('display and type-check those questions')||!record.prompt.includes('generate a replacement Stage 01 instruction'))issues.push('STAGE01_STRUCTURED_CLARIFICATION_MISSING');",
"if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('ask those missing human questions directly in concise normal language')||!record.prompt.includes('later source discovery, research, or requirement compilation exposes a new human-only dependency')||!record.prompt.includes('If interactive conversation is unavailable, return HUMAN_INPUT_REQUIRED'))issues.push('STAGE01_HUMAN_CLARIFICATION_MISSING');",'semantic Stage 01 clarification');
sem=one(sem,
"if(!ui.includes('Start with one thing: save the verbatim job request')||!ui.includes('one structured HUMAN_INPUT_REQUIRED response')||!ui.includes('validate your answers, version them as User Job Input, and regenerate Stage 01'))throw new Error('Stage 01 operator UI does not explain minimum intake and structured clarification.');",
"if(!ui.includes('Start with the verbatim job request')||!ui.includes('Work with ChatGPT / agent')||!ui.includes('? How to run this stage')||!ui.includes('Chat and answer questions')||!ui.includes('FINAL APP RESPONSE')||!ui.includes('whole final handoff'))throw new Error('Operator UI does not explain the human-first conversation and final handoff.');",'semantic UI guide');
const oldReq=` const required=[
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
const newReq=` const required=[
  'never ask the human to repeat facts already present there',
  'A request such as "prepare a patent application for this project" is sufficient to define the patent-application drafting job',
  'continue the practical human intake for foreseeable human-only facts needed to pursue the requested outcome reliably',
  'jurisdiction or intended filing path, inventor and ownership facts, prior filings or priority claims, known disclosure or sale history, meaningful filing timing, and whether the desired package is for review or intended filing',
  'ask those missing human questions directly in concise normal language',
  'Do not ask the human for common knowledge, researchable authority, facts available in supplied materials',
  'later source discovery, research, or requirement compilation exposes a new human-only dependency',
  'If interactive conversation is unavailable, return HUMAN_INPUT_REQUIRED',
  'humanInputRequestContract',
  'temporaryKey',
  'whyRequired',
  'affectedStageFields',
  'answerType',
  'allowedValues',
  'Do not invent requestKey, required, whyNeeded, expectedAnswer'
 ];`;
sem=one(sem,oldReq,newReq,'Stage 01 practical intake semantic proof');
sem += `\n// final-human-handoff-regression-v1\n{\n const p=baseProject();p.job.EXACT_USER_OBJECTIVE_VERBATIM='Prepare a patent application for this project';p.job.SUPPLIED_MATERIALS_INVENTORY='invention.zip';\n const s1=prompts.buildPromptRecord(1,p).prompt,s4=prompts.buildPromptRecord(4,p).prompt;\n for(const text of [s1,s4])for(const token of ['HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE','FINAL HANDOFF FORMAT','FINAL APP RESPONSE','Do not use FINAL APP RESPONSE or a JSON fence on an interactive clarification turn'])if(!text.includes(token))throw new Error('Human-first final handoff missing: '+token);\n for(const bad of ['Ask for clarification only when an irreducible human fact or decision is needed now to identify the objective','Do not ask conversational questions outside the JSON response'])if(s1.includes(bad))throw new Error('Stage 01 still contains contradictory clarification rule: '+bad);\n}\n`;
fs.writeFileSync('verify-prompt-semantics.mjs',sem);

let vi=fs.readFileSync('verify-ingestion.mjs','utf8');
const neg="negative('markdown wrapped',(e)=>'```json\\n'+JSON.stringify(e)+'\\n```','NON_JSON_WRAPPER');";
if(!vi.includes(neg))throw new Error('Missing markdown wrapped negative test');
const framed=`{\n const p=project('JOB-FRAMED-HANDOFF'),promptRecord=savePrompt(p,2),envelope=validEnvelope(p,2,promptRecord);\n const text='Stage 02 is ready for application review.\\nFINAL APP RESPONSE\\n\\`\\`\\`json\\n'+JSON.stringify(envelope,null,2)+'\\n\\`\\`\\`';\n const prepared=ingestion.prepare(p,{stage:2,text,promptRecord});\n if(!prepared.validation.valid)throw new Error('Exact FINAL APP RESPONSE framing was rejected: '+JSON.stringify(prepared.validation.issues));\n if(prepared.project.projectData.rawResponses.at(-1)?.completeRawResponse!==text)throw new Error('Framed handoff raw response was not preserved exactly.');\n}\n`;
vi=vi.replace(neg,framed+neg);
fs.writeFileSync('verify-ingestion.mjs',vi);

let vb=fs.readFileSync('verify-browser.mjs','utf8');
for(const pair of [
 ["'Send instruction','Paste full response','Review and accept'","'Copy instruction','Chat and answer questions','Copy final handoff','Paste, validate, review'"],
 ["'Complete JSON only'","'Final handoff or bare JSON','? How to run this stage'"],
 ["['Start with one thing: save the verbatim job request','one structured HUMAN_INPUT_REQUIRED response','STAGE 01 NEEDS YOUR JOB REQUEST']","['Start with the verbatim job request','Talk to the agent first; paste the final handoff last.','STAGE 01 NEEDS YOUR JOB REQUEST','? How to run this stage']"]
]){if(!vb.includes(pair[0]))throw new Error('Missing browser test anchor '+pair[0]);vb=vb.replace(pair[0],pair[1]);}
fs.writeFileSync('verify-browser.mjs',vb);

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const blob=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
const manifest=runtimeFiles.map(file=>`${file}:${blob(file)}\n`).join('');
const identity=`runtime-${createHash('sha256').update(manifest).digest('hex').slice(0,16)}`;
let html=fs.readFileSync('index.html','utf8');html=html.replaceAll(/runtime-[A-Za-z0-9_-]+/g,identity);fs.writeFileSync('index.html',html);console.log(identity);

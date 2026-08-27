import fs from 'node:fs';
import {createHash} from 'node:crypto';

function one(text,before,after,label){
  if(!text.includes(before))throw new Error(`Missing anchor: ${label}`);
  const next=text.replace(before,after);
  if(next===text)throw new Error(`No change: ${label}`);
  console.log(`patched ${label}`);
  return next;
}

let prompt=fs.readFileSync('prompt-engine.js','utf8');
prompt=one(prompt,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/11';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/12';",'prompt version');
prompt=one(prompt,
`ROLE
You are the ${'${d.role}'}. Perform only Stage ${'${String(stage).padStart(2,\'0\')}'} for this single current project.

PROJECT-SCOPE BOUNDARY`,
`ROLE
You are the ${'${d.role}'}. Perform only Stage ${'${String(stage).padStart(2,\'0\')}'} for this single current project.

AGENT-HUMAN INTERACTION MODE
This instruction is being run in an interactive ChatGPT-style conversation unless the executing environment is clearly noninteractive. Treat normal human conversation and the final application handoff as two different phases. During a clarification turn, speak to the human normally: briefly explain what this stage is doing, ask only the human-only facts, preferences, constraints, or decisions you actually need, wait for the answer, and continue. Do not ask for facts you can read from supplied materials, research from authorized sources, or determine from accepted project state. Group related questions when that reduces back-and-forth, explain why a question matters only when it is not obvious, and do not emit machine JSON while you are still asking the human questions. If the stage already has enough information, skip clarification. On the final handoff turn, switch to the exact FINAL APP RESPONSE format defined below. If the environment cannot conduct an interactive conversation, HUMAN_INPUT_REQUIRED remains the machine fallback.

PROJECT-SCOPE BOUNDARY`,'interaction mode');
prompt=one(prompt,
'- PATENT / REGULATED FILING: use only the minimum human-supplied invention facts needed to recognize and define the requested patent-application drafting job. Use any supplied invention disclosure only for those minimum Stage 01 job-definition facts. A request such as "prepare a patent application for this project" is sufficient to define a patent-application drafting job at Stage 01 unless the human has expressed mutually incompatible deliverables. Do not inventory the invention packet internally in Stage 01. Do not require jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices merely to finish Stage 01; when not already controlling the job definition, record them as unresolved later-needed information for the stage that must use them. Do not research patent authority, prior art, or draft the application here.',
'- PATENT / REGULATED FILING: define the patent-application job and complete a practical human intake before later research begins. Inspect supplied invention materials first and never ask the human to repeat facts already present there. Use domain knowledge to identify human-only facts and preferences that are foreseeably material to pursuing the requested patent outcome, including jurisdiction or intended filing path, inventor and ownership facts, prior filings or priority claims, known disclosure or sale history, meaningful filing timing, and whether the desired package is for review or intended filing. Ask only for missing items that are genuine human facts or choices. When the human asks you to choose what is best, briefly explain the materially different options and ask for confirmation only when a real human choice remains. The human may answer UNKNOWN or NONE when appropriate; do not force invented certainty. Do not perform patent-authority research, prior-art research, patentability analysis, claim drafting, or filing in Stage 01.','Stage 01 patent intake');
const clarification=/STAGE 01 CLARIFICATION EXPERIENCE\nBefore returning the Stage 01 machine response,[\s\S]*?Do not hide missing human information behind UNKNOWN, placeholders, empty strings, or guessed assumptions\.\n/;
if(!clarification.test(prompt))throw new Error('Missing Stage 01 clarification block');
prompt=prompt.replace(clarification,`STAGE 01 CLARIFICATION EXPERIENCE
Before the final Stage 01 handoff, perform a practical intake pass. Use the human-authority input plus supplied materials actually available in this executing context, then use domain knowledge to identify human-only facts, preferences, constraints, and decisions that are foreseeably needed to pursue the requested outcome reliably. In an interactive conversation, ask those missing human questions directly in concise normal language and continue until the Stage 01 intake is sufficient. Do not ask the human for common knowledge, researchable authority, facts available in supplied materials, or specialist format/tool choices the agent can determine later. Do not ask the same question twice. If later source discovery, research, or requirement compilation exposes a new human-only dependency that was not reasonably knowable at Stage 01, that later stage may ask the human directly under the same interaction mode. If interactive questioning is unavailable, return HUMAN_INPUT_REQUIRED using the exact machine question contract. Do not hide missing human information behind guessed assumptions.
`);
console.log('patched Stage 01 clarification');
prompt=one(prompt,
'- Return exactly one JSON object and no Markdown fence, preamble, conversational question, or trailing prose. Use valid JSON syntax with ASCII U+0022 double quotation marks for every JSON member name and string delimiter; never use typographic/curly quotation marks.',
'- FINAL HANDOFF FORMAT: when the stage is ready for the application, give the human a concise status explanation of no more than four short sentences, then write a line containing exactly FINAL APP RESPONSE, then one Markdown fenced code block tagged json containing exactly one response JSON object, with no text after the closing fence. Use ASCII U+0022 double quotation marks inside the JSON; never use typographic/curly quotation marks there. Do not use FINAL APP RESPONSE or a JSON fence on an interactive clarification turn. The application accepts this exact framed handoff and also remains backward-compatible with a bare JSON object.','final handoff format');
prompt=one(prompt,
'- Never set a HUMAN or HUMAN_DECISION-owned field. When unavailable human information is required, return HUMAN_INPUT_REQUIRED and structured humanInputRequests. Do not convert a missing human fact, choice, legal assertion, engineering parameter, or authority decision into an assumption.',
'- Never set a HUMAN or HUMAN_DECISION-owned canonical field. In an interactive conversation, ask the human directly when a missing human fact or decision is required and use that answer as human-provided context; do not convert missing human authority into an assumption. If the executing environment is noninteractive, return HUMAN_INPUT_REQUIRED with structured humanInputRequests. Application-owned confirmations, authorizations, IDs, versions, hashes, states, and gates remain application controls.','human authority interaction');
prompt=one(prompt,
'When Stage 01 cannot proceed without a genuinely human-only fact or decision, return HUMAN_INPUT_REQUIRED as the one machine response for this turn. Put only the smallest set of genuinely blocking questions in humanInputRequests using the exact contract below. Do not ask conversational questions outside the JSON response and do not ask the human to manually rewrite those answers into unrelated fields. The application will render the questions as normal human-facing controls, type-check the answers, version them as User Job Input, invalidate this prompt, and regenerate Stage 01.',
'When Stage 01 needs a genuinely human-only fact or decision and the current environment supports conversation, ask the human directly in normal language, wait for the answer, and continue until the intake is sufficient for the final Stage 01 proposal. If interactive conversation is unavailable, return HUMAN_INPUT_REQUIRED using the exact machine question contract. Do not ask the human to translate machine fields or identifiers.','Stage 01 procedure');
fs.writeFileSync('prompt-engine.js',prompt);

let ingestion=fs.readFileSync('response-ingestion.js','utf8');
const oldStrict=`function strictParse(text,{limits=schema.DEFAULT_RESOURCE_LIMITS}={}){
  const raw=String(text??'');const trimmed=raw.trim();if(!trimmed)throw Object.assign(new Error('Returned output is empty.'),{code:'EMPTY_RESPONSE'});if(byteLength(raw)>limits.maxRawResponseBytes)throw Object.assign(new Error('Returned output exceeds the stage byte limit.'),{code:'OVERSIZED_RESPONSE'});if(trimmed.startsWith('\\`\\`\\`')||trimmed.endsWith('\\`\\`\\`'))throw Object.assign(new Error('The response must be one JSON object without a Markdown code fence.'),{code:'NON_JSON_WRAPPER'});
  const parseCandidate=(candidate)=>{try{scanJsonAmbiguity(candidate,limits.maxJsonDepth);}catch(error){if(error.code)throw error;}return JSON.parse(candidate);};
  let envelope,normalization=null,firstError=null;try{envelope=parseCandidate(trimmed);}catch(error){if(error.code)throw error;firstError=error;const repaired=normalizeSmartJsonDelimiters(trimmed);if(repaired.changed){try{envelope=parseCandidate(repaired.text);normalization='SMART_JSON_DELIMITERS';}catch(repairError){if(repairError.code)throw repairError;firstError=repairError;}}if(!envelope){const likelyTruncated=!trimmed.endsWith('}')||((trimmed.match(/{/g)||[]).length!==(trimmed.match(/}/g)||[]).length);throw Object.assign(new Error(\\`Response JSON could not be parsed: ${'${firstError?.message||error.message}'}\\`),{code:likelyTruncated?'TRUNCATED_RESPONSE':'MALFORMED_JSON',cause:firstError||error});}}
  if(!object(envelope))throw Object.assign(new Error('The response root must be one JSON object.'),{code:'INVALID_ROOT'});if(normalization)Object.defineProperty(envelope,'__parseNormalization',{value:normalization,enumerable:false});return envelope;
}`;
if(!ingestion.includes(oldStrict))throw new Error('Missing strictParse anchor');
const newStrict=`function extractMachinePayload(trimmed){
  if(trimmed.startsWith('{'))return {payload:trimmed,framing:null};
  const marker='FINAL APP RESPONSE';const first=trimmed.indexOf(marker);
  if(first<0){if(trimmed.startsWith('\\`\\`\\`')||trimmed.endsWith('\\`\\`\\`'))throw Object.assign(new Error('A Markdown-wrapped response requires the exact FINAL APP RESPONSE marker and one json code fence.'),{code:'NON_JSON_WRAPPER'});return {payload:trimmed,framing:null};}
  if(trimmed.indexOf(marker,first+marker.length)>=0)throw Object.assign(new Error('FINAL APP RESPONSE may appear exactly once.'),{code:'INVALID_RESPONSE_WRAPPER'});
  const humanText=trimmed.slice(0,first).trim();const framed=trimmed.slice(first+marker.length).trim();
  if(humanText.includes('\\`\\`\\`'))throw Object.assign(new Error('The human-readable status before FINAL APP RESPONSE may not contain a code fence.'),{code:'INVALID_RESPONSE_WRAPPER'});
  const match=framed.match(/^\\`\\`\\`json\\s*\\n([\\s\\S]*?)\\n\\`\\`\\`\\s*$/i);
  if(!match)throw Object.assign(new Error('FINAL APP RESPONSE must be followed by exactly one json code fence and no trailing text.'),{code:'INVALID_RESPONSE_WRAPPER'});
  const payload=match[1].trim();if(!payload)throw Object.assign(new Error('FINAL APP RESPONSE JSON block is empty.'),{code:'EMPTY_RESPONSE'});
  return {payload,framing:'FINAL_APP_RESPONSE'};
}
function strictParse(text,{limits=schema.DEFAULT_RESOURCE_LIMITS}={}){
  const raw=String(text??'');const trimmed=raw.trim();if(!trimmed)throw Object.assign(new Error('Returned output is empty.'),{code:'EMPTY_RESPONSE'});if(byteLength(raw)>limits.maxRawResponseBytes)throw Object.assign(new Error('Returned output exceeds the stage byte limit.'),{code:'OVERSIZED_RESPONSE'});
  const extracted=extractMachinePayload(trimmed);const payload=extracted.payload;
  const parseCandidate=(candidate)=>{try{scanJsonAmbiguity(candidate,limits.maxJsonDepth);}catch(error){if(error.code)throw error;}return JSON.parse(candidate);};
  let envelope,normalization=null,firstError=null;try{envelope=parseCandidate(payload);}catch(error){if(error.code)throw error;firstError=error;const repaired=normalizeSmartJsonDelimiters(payload);if(repaired.changed){try{envelope=parseCandidate(repaired.text);normalization='SMART_JSON_DELIMITERS';}catch(repairError){if(repairError.code)throw repairError;firstError=repairError;}}if(!envelope){const likelyTruncated=!payload.endsWith('}')||((payload.match(/{/g)||[]).length!==(payload.match(/}/g)||[]).length);throw Object.assign(new Error(\\`Response JSON could not be parsed: ${'${firstError?.message||error.message}'}\\`),{code:likelyTruncated?'TRUNCATED_RESPONSE':'MALFORMED_JSON',cause:firstError||error});}}
  if(!object(envelope))throw Object.assign(new Error('The response root must be one JSON object.'),{code:'INVALID_ROOT'});if(normalization)Object.defineProperty(envelope,'__parseNormalization',{value:normalization,enumerable:false});if(extracted.framing)Object.defineProperty(envelope,'__responseFraming',{value:extracted.framing,enumerable:false});return envelope;
}`;
ingestion=ingestion.replace(oldStrict,newStrict);
fs.writeFileSync('response-ingestion.js',ingestion);

let app=fs.readFileSync('app-core.js','utf8');
app=one(app,
'Start with one thing: save the verbatim job request. Add files or constraints you already have; everything else can be clarified later. If more human information is needed now, the agent must return one structured HUMAN_INPUT_REQUIRED response. Paste it once and the application will show the plain-language questions here, validate your answers, version them as User Job Input, and regenerate Stage 01.',
'Start by saving the verbatim job request and any files or constraints you already have. Then copy the Stage 01 instruction into ChatGPT. The agent should talk with you normally, inspect available supplied material, and ask only the human questions it still needs. When it has enough information, its final turn will contain a short explanation followed by a FINAL APP RESPONSE JSON block for this application. HUMAN_INPUT_REQUIRED is only the fallback when the agent cannot converse interactively.','Stage 01 help');
app=one(app,
'<div class="notice"><strong>Clarify before final JSON.</strong> If the external agent asks a question, answer it there, then record the answer in User Job Input and regenerate this instruction. Do not paste or accept a placeholder DATA_PROPOSAL just to discover what information is missing.</div>',
'<div class="notice"><strong>Talk to the agent first; paste the final handoff last.</strong> Answer concise human questions in the ChatGPT conversation. Do not paste intermediate conversation here. When the agent produces FINAL APP RESPONSE, paste that whole final message below.</div>','Stage 01 notice');
const loop=/<div class=\"panel\"><h2 class=\"section-title\">Agent loop<\/h2><div class=\"operator-loop\"[\s\S]*?<\/div><\/div><div class=\"panel\"><h2 class=\"section-title\">Generated instruction<\/h2>/;
if(!loop.test(app))throw new Error('Missing agent loop');
app=app.replace(loop,`<div class=\"panel\"><h2 class=\"section-title\">Work with ChatGPT / agent</h2><div class=\"operator-loop\" aria-label=\"Normal stage workflow\"><div class=\"operator-step\"><b>1</b><span>Copy instruction</span></div><div class=\"operator-step\"><b>2</b><span>Chat and answer questions</span></div><div class=\"operator-step\"><b>3</b><span>Copy final handoff</span></div><div class=\"operator-step\"><b>4</b><span>Paste, validate, review</span></div></div><details class=\"record-card\"><summary>? How to run this stage<span>Guide</span></summary><div class=\"record-body\"><p class=\"section-intro\">Send the saved instruction to ChatGPT in a normal conversation. Let the agent use the supplied files and current project context. If it asks a human-only question, answer it there. When the stage is ready, the agent gives a short explanation followed by the exact FINAL APP RESPONSE JSON block. Copy that whole final message into Returned agent response; the application extracts only the marked JSON block and still applies the strict stage contract. If source research or requirements later reveal a new human-only dependency, that later stage may ask you the same way. Application-owned IDs, versions, hashes, status, gates, and acceptance remain application-controlled.</p></div></details></div><div class=\"panel\"><h2 class=\"section-title\">Generated instruction</h2>`);
app=one(app,
'Paste the complete strict JSON response. Parse / validate preserves the raw response first, then validates it without changing canonical project records. If the response declares returned files, attach those exact files in Authorized files for this stage before parsing.',
'Paste the agent’s whole final handoff. The application accepts either bare JSON or the exact FINAL APP RESPONSE + json-fence format generated by the prompt, extracts only that marked JSON object, preserves the complete raw response, and validates it without changing canonical project records. If the response declares returned files, attach those exact files in Authorized files for this stage before parsing.','response help');
fs.writeFileSync('app-core.js',app);

let sem=fs.readFileSync('verify-prompt-semantics.mjs','utf8');
sem=one(sem,
"if(record.promptEngineVersion!==prompts.version)issues.push('PROMPT_ENGINE_VERSION_MISSING');",
"if(record.promptEngineVersion!==prompts.version)issues.push('PROMPT_ENGINE_VERSION_MISSING');\n  if(!record.prompt.includes('AGENT-HUMAN INTERACTION MODE')||!record.prompt.includes('normal human conversation and the final application handoff')||!record.prompt.includes('do not emit machine JSON while you are still asking the human questions')||!record.prompt.includes('FINAL APP RESPONSE'))issues.push('HUMAN_FIRST_HANDOFF_MISSING');",'all-stage UX semantic test');
sem=one(sem,
"if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL')||!record.prompt.includes('Do not ask conversational questions outside the JSON response')||!record.prompt.includes('display and type-check those questions')||!record.prompt.includes('generate a replacement Stage 01 instruction'))issues.push('STAGE01_STRUCTURED_CLARIFICATION_MISSING');",
"if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('ask those missing human questions directly in concise normal language')||!record.prompt.includes('later source discovery, research, or requirement compilation')||!record.prompt.includes('If interactive questioning is unavailable, return HUMAN_INPUT_REQUIRED'))issues.push('STAGE01_HUMAN_INTAKE_MISSING');",'Stage 01 semantic test');
sem=one(sem,
"if(!ui.includes('Start with one thing: save the verbatim job request')||!ui.includes('one structured HUMAN_INPUT_REQUIRED response')||!ui.includes('validate your answers, version them as User Job Input, and regenerate Stage 01'))throw new Error('Stage 01 operator UI does not explain minimum intake and structured clarification.');",
"if(!ui.includes('agent should talk with you normally')||!ui.includes('FINAL APP RESPONSE')||!ui.includes('? How to run this stage')||!ui.includes('Chat and answer questions')||!ui.includes('whole final handoff'))throw new Error('Operator UI does not explain the human-first agent workflow and final machine handoff.');",'operator UX test');
sem=one(sem,
"if(record.prompt.includes('ask only the necessary clarification questions in normal plain language first'))throw new Error('Stage 01 still contains the conversational-vs-JSON contradiction.');",
"if(!record.prompt.includes('Do not use FINAL APP RESPONSE or a JSON fence on an interactive clarification turn.'))throw new Error('Clarification conversation and final machine handoff are not explicitly separated.');",'phase separation test');
fs.writeFileSync('verify-prompt-semantics.mjs',sem);

let ingestTest=fs.readFileSync('verify-ingestion.mjs','utf8');
const negativeAnchor="negative('markdown wrapped',(e)=>'```json\\n'+JSON.stringify(e)+'\\n```','NON_JSON_WRAPPER');";
if(!ingestTest.includes(negativeAnchor))throw new Error('Missing markdown negative anchor');
const framedTest=`{
  const p=project('JOB-FRAMED-HANDOFF'),promptRecord=savePrompt(p,2),envelope=validEnvelope(p,2,promptRecord);
  const framed='Stage 02 source inventory is ready for application review.\\nFINAL APP RESPONSE\\n\\`\\`\\`json\\n'+JSON.stringify(envelope,null,2)+'\\n\\`\\`\\`';
  const prepared=ingestion.prepare(p,{stage:2,text:framed,promptRecord});
  if(!prepared.validation.valid)throw new Error('Exact FINAL APP RESPONSE framing was rejected: '+JSON.stringify(prepared.validation.issues));
  if(prepared.project.projectData.rawResponses.at(-1)?.completeRawResponse!==framed)throw new Error('Framed handoff raw response was not preserved exactly.');
}
`;
ingestTest=ingestTest.replace(negativeAnchor,framedTest+negativeAnchor);
fs.writeFileSync('verify-ingestion.mjs',ingestTest);

let browser=fs.readFileSync('verify-browser.mjs','utf8');
browser=browser.replaceAll('one structured HUMAN_INPUT_REQUIRED response','agent should talk with you normally');
browser=browser.replaceAll('Clarify before final JSON.','Talk to the agent first; paste the final handoff last.');
fs.writeFileSync('verify-browser.mjs',browser);

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
const runtimeManifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const runtimeIdentity=`runtime-${createHash('sha256').update(runtimeManifest).digest('hex').slice(0,16)}`;
let html=fs.readFileSync('index.html','utf8');
html=html.replaceAll(/runtime-[A-Za-z0-9_-]+/g,runtimeIdentity);
fs.writeFileSync('index.html',html);
console.log(runtimeIdentity);

import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}
function write(path,text){fs.writeFileSync(path,text);}
function replaceOnce(text,from,to,label){
  const first=text.indexOf(from);
  if(first<0)throw new Error(`Missing replacement target: ${label}`);
  if(text.indexOf(from,first+from.length)>=0)throw new Error(`Replacement target is not unique: ${label}`);
  return text.slice(0,first)+to+text.slice(first+from.length);
}
function replaceAllRequired(text,from,to,label,min=1){
  const count=text.split(from).length-1;
  if(count<min)throw new Error(`Missing replacement target: ${label}`);
  return text.split(from).join(to);
}
function replaceRegexOnce(text,pattern,to,label){
  const matches=[...text.matchAll(new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g'))];
  if(matches.length!==1)throw new Error(`Expected one regex target for ${label}; found ${matches.length}`);
  return text.replace(pattern,to);
}
function replaceSection(text,startMarker,endMarker,replacement,label){
  const start=text.indexOf(startMarker);
  if(start<0)throw new Error(`Missing section start: ${label}`);
  const end=text.indexOf(endMarker,start+startMarker.length);
  if(end<0)throw new Error(`Missing section end: ${label}`);
  return text.slice(0,start)+replacement+text.slice(end);
}
const lines=(...items)=>items.join('\n');

// Prompt semantics: normal human conversation first, one final machine block last.
{
  const path='prompt-engine.js';
  let text=read(path);
  text=replaceOnce(text,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/11';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/12';",'prompt engine version');
  text=replaceOnce(
    text,
    'Determine whether the human-authority input is sufficient to define one complete reliable Stage 01 proposal before normalizing the job.',
    'Before compiling the final Stage 01 app response, proactively identify and collect the human-only facts and decisions that the agent can already foresee will materially affect achieving the requested outcome, even when a later stage will formally use them. Ask no question whose answer is already in supplied materials or can be obtained through later source research, official authority, computation, or ordinary domain reasoning. Group related questions and keep them concise. A human may answer UNKNOWN when a fact is genuinely unavailable; preserve it as an unresolved later-needed item rather than inventing it. Determine whether the resulting human-authority input is sufficient to define one complete reliable Stage 01 proposal before normalizing the job.',
    'Stage 01 proactive intake'
  );
  text=replaceOnce(
    text,
    'When Stage 01 cannot proceed without a genuinely human-only fact or decision, return HUMAN_INPUT_REQUIRED as the one machine response for this turn. Put only the smallest set of genuinely blocking questions in humanInputRequests using the exact contract below. Do not ask conversational questions outside the JSON response and do not ask the human to manually rewrite those answers into unrelated fields. The application will render the questions as normal human-facing controls, type-check the answers, version them as User Job Input, invalidate this prompt, and regenerate Stage 01.',
    'When Stage 01 needs human-only facts or decisions, ask for them first in the normal chat conversation under the HUMAN INTERACTION CONTRACT below; do not put unanswered questions into a DATA_PROPOSAL. Continue the conversation until the Stage 01 intake is sufficient or the human confirms a fact is unknown. Use HUMAN_INPUT_REQUIRED in the final app response only when the application itself must capture a HUMAN or HUMAN_DECISION-owned value before Stage 01 can complete. In that exceptional path, put only the smallest set of blocking questions in humanInputRequests using the exact contract below; the application will render and type-check them, version the answers as User Job Input, invalidate this prompt, and regenerate Stage 01.',
    'Stage 01 conversational clarification'
  );
  text=replaceOnce(
    text,
    'Do not require jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices merely to finish Stage 01; when not already controlling the job definition, record them as unresolved later-needed information for the stage that must use them.',
    'When jurisdiction, filing route, inventorship, ownership, priority or continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices are human-only and can already be foreseen as material, ask for them during Stage 01 intake after reading supplied materials. Do not block Stage 01 when the human genuinely does not know a later-needed fact; record it as unresolved for the earliest later stage that must use it.',
    'Patent Stage 01 intake boundary'
  );
  text=replaceOnce(
    text,
    'Ask for clarification only when an irreducible human fact or decision is needed now to identify the objective, intended deliverable, or input boundary. Never ask for information merely because a later stage will need it, and never ask the human to repeat information you can directly read from supplied materials.',
    'Ask in normal chat for every human-only fact or decision the agent can already foresee as materially necessary to achieve the requested outcome. Never ask the human to repeat information available in supplied materials, and never ask for facts that later research, official authority, computation, or ordinary domain reasoning can establish.',
    'Stage 01 clarification experience scope'
  );
  text=replaceOnce(
    text,
    'If such a genuinely Stage-01-blocking fact is missing, return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL—as the single response. Put only the smallest set of blocking questions inside humanInputRequests using the exact question contract below. Do not ask conversational questions outside the JSON response. The application will display and type-check those questions, version the answers as User Job Input, invalidate this prompt, and generate a replacement Stage 01 instruction. Do not hide missing human information behind UNKNOWN, placeholders, empty strings, or guessed assumptions.',
    'Ask those questions conversationally before compiling the final app response. Continue until the answer is supplied or the human confirms it is unknown. Use HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL—only when a blocking HUMAN or HUMAN_DECISION-owned value must be captured by the application itself. In that exceptional final response, put only the smallest set of blocking questions inside humanInputRequests using the exact question contract below. The application will display and type-check them, version the answers as User Job Input, invalidate this prompt, and generate a replacement Stage 01 instruction. Do not hide missing human information behind placeholders, empty strings, or guessed assumptions.',
    'Stage 01 exceptional structured clarification'
  );

  const interactionAnchor=lines(
    'CURRENT AGENT-NORMALIZED DELIVERABLE (when already accepted; otherwise UNKNOWN):',
    '${show(j.EXACT_DELIVERABLE_REQUESTED)}',
    '',
    '${stage===1?`STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY'
  );
  const interactionBlock=lines(
    'CURRENT AGENT-NORMALIZED DELIVERABLE (when already accepted; otherwise UNKNOWN):',
    '${show(j.EXACT_DELIVERABLE_REQUESTED)}',
    '',
    'HUMAN INTERACTION CONTRACT — CHAT FIRST, APP RESPONSE LAST',
    'You are speaking with a human in a normal chat client, not directly to a machine.',
    '- On the first response for this instruction, briefly explain what this stage is doing and what you already understand.',
    '- If human-only information is needed, ask clear plain-language questions in one compact batch where practical. State why each group matters in one short sentence. Ask only what the human must know or decide; inspect supplied materials first and use later research, official sources, computation, and ordinary domain reasoning for everything else.',
    '- Continue the conversation in the same chat until enough information exists. Do not emit partial JSON or JSON-encoded questions during this conversation.',
    '- When the stage is ready, give at most three concise human-facing sentences explaining the result and next action, then the exact heading FINAL APP RESPONSE, then exactly one fenced JSON code block containing the response envelope. A bare JSON object is also valid for compatibility. Do not include another code block or another JSON object.',
    '- HUMAN_INPUT_REQUIRED is a final application-control response, not the normal way to talk to the human. Use it only when the application must capture a HUMAN or HUMAN_DECISION-owned answer that cannot be completed through the current agent-owned proposal.',
    '',
    '${stage===1?`STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY'
  );
  text=replaceOnce(text,interactionAnchor,interactionBlock,'universal human interaction contract');

  const researchAnchor="\n`:''}\n${stage===1?`STAGE 01 MACHINE OUTPUT SHAPE";
  const researchReplacement=lines(
    '',
    "`:''}",
    '${[2,3,4,5].includes(stage)?`RESEARCH-AND-COLLECT HUMAN INPUT REOPENING',
    'Source discovery, source research, requirement compilation, and requirement resolution may reveal a human-only fact or decision that Stage 01 could not reasonably foresee. When that happens, explain the new issue in normal chat, ask only the necessary human question, and continue this same stage after the answer. Never guess, convert the missing human fact into an assumption, or ask the human to research information the agent can establish from authorized sources.',
    "`:''}",
    '${stage===1?`STAGE 01 MACHINE OUTPUT SHAPE'
  );
  text=replaceOnce(text,researchAnchor,researchReplacement,'later research human-input reopening');

  text=replaceOnce(
    text,
    '- Return exactly one JSON object and no Markdown fence, preamble, conversational question, or trailing prose. Use valid JSON syntax with ASCII U+0022 double quotation marks for every JSON member name and string delimiter; never use typographic/curly quotation marks.',
    '- During clarification turns, speak to the human normally and do not output JSON. In the final response, provide at most three concise explanatory sentences, the exact heading FINAL APP RESPONSE, and exactly one fenced JSON object; a bare JSON object remains valid for compatibility. Do not include any other code block or JSON object. Inside the JSON use valid syntax with ASCII U+0022 double quotation marks for every member name and string delimiter; never use typographic/curly quotation marks.',
    'final response wrapper rule'
  );
  text=replaceOnce(
    text,
    '- Never set a HUMAN or HUMAN_DECISION-owned field. When unavailable human information is required, return HUMAN_INPUT_REQUIRED and structured humanInputRequests. Do not convert a missing human fact, choice, legal assertion, engineering parameter, or authority decision into an assumption.',
    '- Never set a HUMAN or HUMAN_DECISION-owned field. Ask for unavailable human information in normal chat first. Use HUMAN_INPUT_REQUIRED and structured humanInputRequests in the final app response only when the application must capture that human-owned value before work can continue. Do not convert a missing human fact, choice, legal assertion, engineering parameter, or authority decision into an assumption.',
    'human-owned value handling'
  );
  text=replaceOnce(
    text,
    'The JSON shown below is an empty shape skeleton, not a complete answer: add only actual stage-relevant values and records supported by evidence. Do not return angle-bracket placeholders, invented sample values, or keys that are not needed for this response.',
    'The JSON shown below is an empty shape skeleton, not a complete answer. Put the completed object in the single final JSON block described above, or return it bare for compatibility. Add only actual stage-relevant values and records supported by evidence. Do not return angle-bracket placeholders, invented sample values, or keys that are not needed for this response.',
    'response envelope instructions'
  );
  write(path,text);
}

// Response ingestion: accept one unambiguous final JSON block while preserving the complete raw response.
{
  const path='response-ingestion.js';
  let text=read(path);
  const newParser=lines(
    "function extractFinalAppResponse(trimmed){",
    "  const fencePattern=/```(?:json)?\\s*([\\s\\S]*?)```/gi;",
    "  const matches=[...String(trimmed??'').matchAll(fencePattern)];",
    "  if(!matches.length){if(String(trimmed??'').includes('```'))throw Object.assign(new Error('The final response contains an incomplete or unsupported code fence.'),{code:'NON_JSON_WRAPPER'});return {candidate:String(trimmed??''),normalizations:[]};}",
    "  if(matches.length!==1)throw Object.assign(new Error('The final response must contain exactly one JSON code block.'),{code:'AMBIGUOUS_JSON_WRAPPER'});",
    "  const match=matches[0],candidate=String(match[1]??'').trim(),outside=(String(trimmed??'').slice(0,match.index)+String(trimmed??'').slice(match.index+match[0].length)).trim();",
    "  if(!candidate.startsWith('{')||!candidate.endsWith('}'))throw Object.assign(new Error('The single code block must contain one JSON object.'),{code:'NON_JSON_WRAPPER'});",
    "  if(/[{}]/.test(outside)||outside.includes('```'))throw Object.assign(new Error('The final response contains ambiguous JSON-like material outside the single app-response block.'),{code:'AMBIGUOUS_JSON_WRAPPER'});",
    "  return {candidate,normalizations:['FINAL_APP_RESPONSE_WRAPPER']};",
    "}",
    "function strictParse(text,{limits=schema.DEFAULT_RESOURCE_LIMITS}={}){",
    "  const raw=String(text??''),trimmed=raw.trim();if(!trimmed)throw Object.assign(new Error('Returned output is empty.'),{code:'EMPTY_RESPONSE'});if(byteLength(raw)>limits.maxRawResponseBytes)throw Object.assign(new Error('Returned output exceeds the stage byte limit.'),{code:'OVERSIZED_RESPONSE'});",
    "  const extracted=extractFinalAppResponse(trimmed),candidate=extracted.candidate,normalizations=[...extracted.normalizations];",
    "  const parseCandidate=(value)=>{try{scanJsonAmbiguity(value,limits.maxJsonDepth);}catch(error){if(error.code)throw error;}return JSON.parse(value);};",
    "  let envelope,firstError=null;try{envelope=parseCandidate(candidate);}catch(error){if(error.code)throw error;firstError=error;const repaired=normalizeSmartJsonDelimiters(candidate);if(repaired.changed){try{envelope=parseCandidate(repaired.text);normalizations.push('SMART_JSON_DELIMITERS');}catch(repairError){if(repairError.code)throw repairError;firstError=repairError;}}if(!envelope){const likelyTruncated=!candidate.endsWith('}')||((candidate.match(/{/g)||[]).length!==(candidate.match(/}/g)||[]).length);throw Object.assign(new Error(`Response JSON could not be parsed: ${firstError?.message||error.message}`),{code:likelyTruncated?'TRUNCATED_RESPONSE':'MALFORMED_JSON',cause:firstError||error});}}",
    "  if(!object(envelope))throw Object.assign(new Error('The response root must be one JSON object.'),{code:'INVALID_ROOT'});",
    "  if(normalizations.length){const unique=[...new Set(normalizations)];Object.defineProperty(envelope,'__parseNormalizations',{value:unique,enumerable:false});Object.defineProperty(envelope,'__parseNormalization',{value:unique.at(-1),enumerable:false});}",
    "  return envelope;",
    "}"
  );
  text=replaceSection(text,'function strictParse(text,{limits=schema.DEFAULT_RESOURCE_LIMITS}={}){','\n\nfunction disposition(',newParser,'strict parser');
  text=replaceOnce(
    text,
    "if(envelope?.__parseNormalization){validation.issues.push(issue('JSON_TYPOGRAPHY_NORMALIZED','/','Typographic JSON delimiter quotes were deterministically normalized for parsing; the exact raw response remains preserved unchanged.','WARNING'));validation.warningCount=validation.issues.filter(item=>item.severity==='WARNING').length;}",
    "for(const normalization of envelope?.__parseNormalizations||[]){if(normalization==='FINAL_APP_RESPONSE_WRAPPER')validation.issues.push(issue('FINAL_APP_RESPONSE_WRAPPER_PARSED','/','One unambiguous final JSON block was extracted for parsing; the complete human-facing raw response remains preserved unchanged.','WARNING'));if(normalization==='SMART_JSON_DELIMITERS')validation.issues.push(issue('JSON_TYPOGRAPHY_NORMALIZED','/','Typographic JSON delimiter quotes were deterministically normalized for parsing; the exact raw response remains preserved unchanged.','WARNING'));}validation.warningCount=validation.issues.filter(item=>item.severity==='WARNING').length;",
    'parse normalization warnings'
  );
  write(path,text);
}

// Operator UI: one compact, collapsible guide and precise chat/final-response instructions.
{
  const path='app-core.js';
  let text=read(path);
  text=replaceRegexOnce(
    text,
    /<p class="section-intro">Enter only genuine human-owned User Job Input\.[\s\S]*?The application derives workflow identity, versions, status, counts, and next action\.<\/p>/,
    '<p class="section-intro">Enter the request and any facts, files, constraints, or decisions you already know. The agent and later stages handle the rest.</p><details class="record-card project-input-guide"><summary>What belongs in User Job Input?<span>?</span></summary><div class="record-body"><p class="section-intro">Use genuine human-owned information only. You do not need to know the final file format or research official requirements. Add a desired format only when it is an actual constraint; otherwise Stage 01 determines the artifact set. A specification substitute is used only when the requested artifact itself cannot be generated reliably and still requires human confirmation. The application derives IDs, versions, status, counts, and next actions.</p></div></details>',
    'collapsible project input guide'
  );
  text=replaceOnce(
    text,
    'Start with one thing: save the verbatim job request. Add files or constraints you already have; everything else can be clarified later. If more human information is needed now, the agent must return one structured HUMAN_INPUT_REQUIRED response. Paste it once and the application will show the plain-language questions here, validate your answers, version them as User Job Input, and regenerate Stage 01.',
    "Start with the verbatim job request and any files or constraints you already have. Send the generated instruction to the agent in one chat and answer its plain-language questions there. Paste only the agent's final app response here. If a value must be recorded as application-owned human authority, the final response will create a focused in-app question instead of guessing.",
    'Stage 01 human intake panel'
  );

  const stageGuide=lines(
    'function stageGuideMarkup(n){',
    "  const intake=n===1?' Stage 01 should collect every human-only fact or decision the agent can already foresee as material, without asking you for facts in supplied files or facts it can research.':'';",
    "  const reopen=[2,3,4,5].includes(n)?' Source, research, and requirement work may expose a new human-only fact. The agent must ask you rather than guess, then continue the same stage.':'';",
    '  return `<details class="record-card stage-guide"><summary>How to use this stage<span>?</span></summary><div class="record-body"><p class="section-intro"><strong>1. Chat:</strong> Save and copy the instruction into one ChatGPT conversation. The agent should explain the stage and ask concise plain-language questions.${esc(intake)}${esc(reopen)}</p><p class="section-intro"><strong>2. Final response:</strong> When ready, the agent gives a short explanation followed by one <strong>FINAL APP RESPONSE</strong> JSON block. Paste that entire final response below; do not paste the earlier conversation.</p><p class="section-intro"><strong>3. App:</strong> Parse, review the proposed changes, and accept only when they match reality. The old error banner identifies the last parsed response; an edited replacement is not checked until you parse again.</p></div></details>`;',
    '}'
  );
  text=replaceOnce(text,'\nfunction workflow(){','\n'+stageGuide+'\nfunction workflow(){','stage guide function');
  text=replaceOnce(
    text,
    '<div class="stage-action-strip"><span>${esc(current.job.CURRENT_STATE)}</span><span>${esc(current.job.NEXT_REQUIRED_ACTION)}</span></div></div>${locked?',
    '<div class="stage-action-strip"><span>${esc(current.job.CURRENT_STATE)}</span><span>${esc(current.job.NEXT_REQUIRED_ACTION)}</span></div></div>${stageGuideMarkup(n)}${locked?',
    'stage guide placement'
  );
  text=replaceOnce(
    text,
    '<div class="notice"><strong>Clarify before final JSON.</strong> If the external agent asks a question, answer it there, then record the answer in User Job Input and regenerate this instruction. Do not paste or accept a placeholder DATA_PROPOSAL just to discover what information is missing.</div>',
    '<div class="notice"><strong>Chat first; paste the final response last.</strong> The agent should collect foreseeable human-only facts in plain language, use supplied files and researchable knowledge itself, and compile the app response only after the intake is sufficient.</div>',
    'Stage 01 workflow notice'
  );
  text=replaceOnce(
    text,
    '<div class="operator-loop" aria-label="Normal stage workflow"><div class="operator-step"><b>1</b><span>Send instruction</span></div><div class="operator-step"><b>2</b><span>Paste full response</span></div><div class="operator-step"><b>3</b><span>Parse and validate</span></div><div class="operator-step"><b>4</b><span>Review and accept</span></div></div>',
    '<div class="operator-loop" aria-label="Normal stage workflow"><div class="operator-step"><b>1</b><span>Send instruction</span></div><div class="operator-step"><b>2</b><span>Discuss and answer</span></div><div class="operator-step"><b>3</b><span>Paste final response</span></div><div class="operator-step"><b>4</b><span>Parse, review, accept</span></div></div>',
    'agent loop labels'
  );
  text=replaceOnce(
    text,
    'Paste the complete strict JSON response. Parse / validate preserves the raw response first, then validates it without changing canonical project records. If the response declares returned files, attach those exact files in Authorized files for this stage before parsing.',
    'Paste the complete final agent response: its short explanation plus the single FINAL APP RESPONSE JSON block, or a bare JSON object. Do not paste the earlier conversation. Parse / validate preserves the entire raw response first, then extracts and validates one unambiguous JSON object without changing canonical project records. If the response declares returned files, attach those exact files in Authorized files for this stage before parsing.',
    'returned response instructions'
  );
  text=replaceOnce(
    text,
    'Complete JSON only — no Markdown wrapper.',
    'Final response only — one JSON block, or a bare JSON object.',
    'returned response hint'
  );
  write(path,text);
}

// Prompt-semantic verification now enforces the chat-first contract instead of forbidding it.
{
  const path='verify-prompt-semantics.mjs';
  let text=read(path);
  text=replaceOnce(
    text,
    "if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');",
    "if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');\n  if(!record.prompt.includes('HUMAN INTERACTION CONTRACT — CHAT FIRST, APP RESPONSE LAST')||!record.prompt.includes('Do not emit partial JSON or JSON-encoded questions')||!record.prompt.includes('FINAL APP RESPONSE'))issues.push('HUMAN_INTERACTION_CONTRACT_MISSING');",
    'universal interaction semantic check'
  );
  text=replaceOnce(
    text,
    "if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL')||!record.prompt.includes('Do not ask conversational questions outside the JSON response')||!record.prompt.includes('display and type-check those questions')||!record.prompt.includes('generate a replacement Stage 01 instruction'))issues.push('STAGE01_STRUCTURED_CLARIFICATION_MISSING');",
    "if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('ask for them first in the normal chat conversation')||!record.prompt.includes('HUMAN_INPUT_REQUIRED is a final application-control response')||!record.prompt.includes('display and type-check them')||!record.prompt.includes('generate a replacement Stage 01 instruction'))issues.push('STAGE01_STRUCTURED_CLARIFICATION_MISSING');",
    'Stage 01 clarification semantic check'
  );
  text=replaceOnce(
    text,
    "if(!ui.includes('Start with one thing: save the verbatim job request')||!ui.includes('one structured HUMAN_INPUT_REQUIRED response')||!ui.includes('validate your answers, version them as User Job Input, and regenerate Stage 01'))throw new Error('Stage 01 operator UI does not explain minimum intake and structured clarification.');",
    "if(!ui.includes('Start with the verbatim job request')||!ui.includes('answer its plain-language questions there')||!ui.includes('How to use this stage')||!ui.includes('FINAL APP RESPONSE'))throw new Error('Stage 01 operator UI does not explain chat-first intake and the final app response.');",
    'Stage 01 UI semantic check'
  );
  text=replaceOnce(
    text,
    "if(record.prompt.includes('ask only the necessary clarification questions in normal plain language first'))throw new Error('Stage 01 still contains the conversational-vs-JSON contradiction.');",
    "if(!record.prompt.includes('HUMAN INTERACTION CONTRACT — CHAT FIRST, APP RESPONSE LAST')||!record.prompt.includes('proactively identify and collect the human-only facts and decisions')||!record.prompt.includes('FINAL APP RESPONSE'))throw new Error('Stage 01 chat-first intake contract is missing.');",
    'Stage 01 minimum prompt semantic check'
  );
  write(path,text);
}

// Ingestion verification proves one final human wrapper is accepted and ambiguous wrappers still fail closed.
{
  const path='verify-ingestion.mjs';
  let text=read(path);
  text=replaceOnce(
    text,
    "negative('markdown wrapped',(e)=>'```json\\n'+JSON.stringify(e)+'\\n```','NON_JSON_WRAPPER');",
    lines(
      '{',
      "  const p=project('JOB-FINAL-APP-WRAPPER'),promptRecord=savePrompt(p,2),envelope=validEnvelope(p,2,promptRecord);",
      "  const wrapped=`Stage 02 is complete and ready for app review.\\n\\nFINAL APP RESPONSE\\n\\`\\`\\`json\\n${JSON.stringify(envelope)}\\n\\`\\`\\``;",
      "  const prepared=ingestion.prepare(p,{stage:2,text:wrapped,promptRecord});",
      "  if(!prepared.validation.valid)throw new Error(`One final app-response wrapper was rejected: ${JSON.stringify(prepared.validation.issues)}`);",
      "  if(!prepared.validation.issues.some(item=>item.code==='FINAL_APP_RESPONSE_WRAPPER_PARSED'))throw new Error('Final app-response wrapper normalization warning was not preserved.');",
      "  if(prepared.project.projectData.rawResponses.at(-1)?.completeRawResponse!==wrapped)throw new Error('Complete human-facing raw response was not preserved unchanged.');",
      '}',
      "negative('ambiguous multiple JSON blocks',(e)=>`FINAL APP RESPONSE\\n\\`\\`\\`json\\n${JSON.stringify(e)}\\n\\`\\`\\`\\n\\`\\`\\`json\\n${JSON.stringify(e)}\\n\\`\\`\\``, 'AMBIGUOUS_JSON_WRAPPER');"
    ),
    'final wrapper ingestion verification'
  );
  write(path,text);
}

// Browser verification follows the revised visible workflow and opens collapsible help only when needed.
{
  const path='verify-browser.mjs';
  let text=read(path);
  text=replaceOnce(
    text,
    "for(const token of ['Independent external sources only.','closed-loop-stage-response/2','PROMPT IDENTITY','Parse / validate response','Send instruction','Paste full response','Review and accept','Expand preview','exact controlling copy block','Complete JSON only'])",
    "for(const token of ['Independent external sources only.','closed-loop-stage-response/2','PROMPT IDENTITY','Parse / validate response','Send instruction','Discuss and answer','Paste final response','Expand preview','exact controlling copy block','How to use this stage'])",
    'Stage 02 visible token set'
  );
  text=replaceOnce(
    text,
    "assert(text.includes(token),`Stage 02 UI/prompt missing ${token}.`);assert(!(await evalValue",
    "assert(text.includes(token),`Stage 02 UI/prompt missing ${token}.`);await click(cdp,'.stage-guide > summary');text=(await snapshot(cdp)).text;for(const guideToken of ['FINAL APP RESPONSE','do not paste the earlier conversation','Parse, review the proposed changes'])assert(text.includes(guideToken),`Stage guide missing ${guideToken}.`);assert(!(await evalValue",
    'Stage 02 collapsible guide verification'
  );
  text=replaceOnce(
    text,
    "for(const token of ['Start with one thing: save the verbatim job request','one structured HUMAN_INPUT_REQUIRED response','STAGE 01 NEEDS YOUR JOB REQUEST'])assert(text.includes(token),`Stage 01 clarification experience missing ${token}.`);assert(!text.includes('plain-language questions before final JSON'),'Stage 01 UI still advertises the contradictory conversational-before-JSON path.');",
    "for(const token of ['Start with the verbatim job request','answer its plain-language questions there','STAGE 01 NEEDS YOUR JOB REQUEST','How to use this stage'])assert(text.includes(token),`Stage 01 clarification experience missing ${token}.`);await click(cdp,'.stage-guide > summary');text=(await snapshot(cdp)).text;for(const token of ['collect every human-only fact or decision','without asking you for facts in supplied files','Paste that entire final response'])assert(text.includes(token),`Stage 01 guide missing ${token}.`);",
    'Stage 01 browser guidance verification'
  );
  text=replaceOnce(
    text,
    "await click(cdp,'[data-view=\"Project\"]');text=(await snapshot(cdp)).text;for(const token of ['Output format (optional)','You do not need to know the final file format in advance','A specification substitute requires human confirmation'])assert(text.includes(token),`Project intake artifact-generation guidance missing ${token}.`);",
    "await click(cdp,'[data-view=\"Project\"]');text=(await snapshot(cdp)).text;for(const token of ['Output format (optional)','What belongs in User Job Input?'])assert(text.includes(token),`Project intake guidance missing ${token}.`);await click(cdp,'.project-input-guide > summary');text=(await snapshot(cdp)).text;for(const token of ['You do not need to know the final file format','A specification substitute is used only when the requested artifact itself cannot be generated reliably','The application derives IDs, versions, status, counts, and next actions'])assert(text.includes(token),`Project intake artifact-generation guidance missing ${token}.`);",
    'project input browser guidance verification'
  );
  write(path,text);
}

// Keep the deployment cache coherent and document the operator contract.
{
  const path='index.html';
  let text=read(path);
  text=replaceAllRequired(text,'runtime-6303cd4b6072bb7f','runtime-chat-first-20260827','runtime cache token',8);
  write(path,text);
}
{
  const path='README.md';
  let text=read(path);
  text=replaceOnce(
    text,
    '## Artifact generation and downstream execution',
    lines(
      '## Human-agent interaction',
      '',
      'Every generated stage instruction uses one chat-first protocol. The external agent first explains the current stage in plain language, inspects supplied material, and asks only human-only facts or decisions that cannot be established through authorized research, computation, or ordinary domain reasoning. Stage 01 proactively collects foreseeable human inputs; Stages 02–05 may reopen clarification when source, research, or requirement work reveals a new human-only issue.',
      '',
      'When sufficient information exists, the agent returns a short human explanation followed by one `FINAL APP RESPONSE` JSON block. The application preserves the complete raw response, deterministically extracts exactly one unambiguous JSON block, validates it, and keeps canonical state unchanged until operator acceptance. A bare JSON object remains accepted for compatibility. Multiple or ambiguous JSON blocks fail closed.',
      '',
      'The Workflow view keeps this process in a collapsed **How to use this stage** guide so experienced operators are not forced through repeated instruction text.',
      '',
      '## Artifact generation and downstream execution'
    ),
    'README human interaction section'
  );
  write(path,text);
}

console.log('Applied chat-first agent UX repair.');

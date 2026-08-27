from pathlib import Path
import hashlib
import re


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    p.write_text(text.replace(old, new, 1))


def replace_between(path, start, end, replacement, label):
    p = Path(path)
    text = p.read_text()
    first = text.find(start)
    if first < 0:
        raise SystemExit(f"{label}: start anchor missing")
    last = text.find(end, first)
    if last < 0:
        raise SystemExit(f"{label}: end anchor missing")
    p.write_text(text[:first] + replacement + text[last:])


# ---------------------------------------------------------------------------
# prompt-engine.js — keep one strict machine contract, but use the actual
# interactive ChatGPT experience before the final app response.
# ---------------------------------------------------------------------------
p = Path('prompt-engine.js')
s = p.read_text()
old = "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/11';"
new = "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/12';"
if s.count(old) != 1:
    raise SystemExit('prompt version anchor mismatch')
s = s.replace(old, new, 1)

interaction_anchor = '''CURRENT AGENT-NORMALIZED DELIVERABLE (when already accepted; otherwise UNKNOWN):
${show(j.EXACT_DELIVERABLE_REQUESTED)}

${stage===1?`STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY'''
interaction_replacement = '''CURRENT AGENT-NORMALIZED DELIVERABLE (when already accepted; otherwise UNKNOWN):
${show(j.EXACT_DELIVERABLE_REQUESTED)}

INTERACTIVE HUMAN EXPERIENCE — CHAT FIRST, MACHINE RESPONSE LAST
This instruction is normally used in an interactive chat with the human. Treat the human as a person, not as a JSON endpoint.
- First use the supplied input, files, prior accepted work, researchable facts, and your own reasoning. Do not ask the human for information you can reliably read, research, derive, or decide within the authorized scope.
- If enough information exists, proceed directly to the final app response.
- If a genuinely human-only fact, preference, authority decision, or missing real-world input is needed, do not emit the final machine envelope yet. Briefly explain what you are establishing, then ask the smallest complete batch of concise numbered questions in normal language.
- Give simple choices and a recommended default when useful. Accept plain answers such as "not sure" when later research should determine the recommendation. Do not mention schema names, hashes, responseType, stageData, temporary keys, or parser rules while talking with the human.
- Continue in the same chat after the human answers. Do not repeat answered questions. Ask another batch only when an answer reveals a genuinely new blocker.
- Research and collection stages must complete all available research first and ask the human only about irreducible human facts or decisions that remain material afterward.
- When the stage is sufficiently defined, return the final app response in the exact wrapper specified below. If the environment is demonstrably noninteractive, use HUMAN_INPUT_REQUIRED so the application can render the questions.
Keep the human-facing exchange concise, complete, accurate, and practical.

${stage===1?`STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY'''
if s.count(interaction_anchor) != 1:
    raise SystemExit('interactive experience insertion anchor mismatch')
s = s.replace(interaction_anchor, interaction_replacement, 1)

old = '''Do not block Stage 01 merely because information will be needed by a later research, design, production, filing, verification, or execution stage. Record such later-needed information in UNKNOWN_INFORMATION and let the earliest stage that actually requires it resolve it. When Stage 01 cannot proceed without a genuinely human-only fact or decision, return HUMAN_INPUT_REQUIRED as the one machine response for this turn. Put only the smallest set of genuinely blocking questions in humanInputRequests using the exact contract below. Do not ask conversational questions outside the JSON response and do not ask the human to manually rewrite those answers into unrelated fields. The application will render the questions as normal human-facing controls, type-check the answers, version them as User Job Input, invalidate this prompt, and regenerate Stage 01.'''
new = '''Use Stage 01 to collect every predictable human-only fact or decision that the agent already knows will materially affect the requested outcome, even when a later stage will apply it. Do not ask for facts that can be researched, derived, or read from supplied materials, and do not require the human to know specialist terminology. Explain choices simply, state a recommended default when useful, and allow the human to answer "not sure" when research should determine the recommendation. Record facts that become knowable only after research, or that the human cannot yet determine, in UNKNOWN_INFORMATION for the earliest stage that needs them. In an interactive chat, ask the smallest complete batch of missing human-only questions in normal language and continue in the same conversation until the intake is sufficient. Do not emit the final machine response while questions remain. If the environment cannot converse, use HUMAN_INPUT_REQUIRED with the exact contract below.'''
if s.count(old) != 1:
    raise SystemExit('Stage 01 intake policy anchor mismatch')
s = s.replace(old, new, 1)

old = 'Stage 01 does not require every fact needed to execute later stages.'
new = 'Stage 01 does not require facts that only research or later work can discover, but it should collect predictable human-only facts now.'
if s.count(old) != 1:
    raise SystemExit('Stage 01 later-fact sentence anchor mismatch')
s = s.replace(old, new, 1)

old = '''Do not require jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices merely to finish Stage 01; when not already controlling the job definition, record them as unresolved later-needed information for the stage that must use them. Do not research patent authority, prior art, or draft the application here.'''
new = '''Before finalizing Stage 01, collect the predictable human-only patent intake facts that are not already answered by the supplied packet: intended protection geography or jurisdiction, any hard filing deadline, material disclosure or ownership changes since the packet cutoff, whether any other natural person may have contributed to claimed subject matter, and whether the requested package is primarily for counsel review or intended to progress toward filing. Ask in ordinary language, offer simple options and a recommended default where useful, and permit "not sure." Do not ask the human for patent-law conclusions, prior-art research, or facts the supplied packet already answers. Do not research patent authority, prior art, or draft the application here.'''
if s.count(old) != 1:
    raise SystemExit('patent intake policy anchor mismatch')
s = s.replace(old, new, 1)

clarification_start = "${stage===1?`STAGE 01 CLARIFICATION EXPERIENCE"
clarification_end = "\n`:''}\n\n${stage===2?`STAGE 02 SOURCE DISCOVERY GUIDANCE"
first = s.find(clarification_start)
last = s.find(clarification_end, first)
if first < 0 or last < 0:
    raise SystemExit('Stage 01 clarification block anchors missing')
new_block = '''${stage===1?`STAGE 01 HUMAN INTAKE EXPERIENCE
Use the interactive chat to gather all predictable human-only intake facts that are material to the requested outcome and not already available in the supplied materials. Start with one short explanation, then ask one concise numbered batch. For patent work, translate filing choices into ordinary language and state a practical default; do not require the human to know patent terminology. After the human answers, incorporate the answers, identify any genuinely new blocker, and continue until the intake is sufficient. Do not output machine JSON while asking questions. When sufficient, produce the final app response. If the environment cannot converse, return HUMAN_INPUT_REQUIRED using the exact question contract so the application can collect the answers. Facts discovered only through later source or requirement research may trigger the same human-input process at that later stage.
`:''}'''
s = s[:first] + new_block + s[last + len("\n`:''}"):]

old = '- Return exactly one JSON object and no Markdown fence, preamble, conversational question, or trailing prose. Use valid JSON syntax with ASCII U+0022 double quotation marks for every JSON member name and string delimiter; never use typographic/curly quotation marks.'
new = '- These machine-response rules apply only after the interactive human exchange is complete. The final app response must be either one raw JSON object or the exact APP RESPONSE READY wrapper defined below. Use valid JSON syntax with ASCII U+0022 double quotation marks for every JSON member name and string delimiter; never use typographic/curly quotation marks.'
if s.count(old) != 1:
    raise SystemExit('final response rule anchor mismatch')
s = s.replace(old, new, 1)

old = '- Never set a HUMAN or HUMAN_DECISION-owned field. When unavailable human information is required, return HUMAN_INPUT_REQUIRED and structured humanInputRequests. Do not convert a missing human fact, choice, legal assertion, engineering parameter, or authority decision into an assumption.'
new = '- Never set a HUMAN or HUMAN_DECISION-owned field. In an interactive chat, ask the human directly before the final app response. If the environment cannot converse or the question must be recorded in the application, return HUMAN_INPUT_REQUIRED with structured humanInputRequests. Do not convert a missing human fact, choice, legal assertion, engineering parameter, or authority decision into an assumption.'
if s.count(old) != 1:
    raise SystemExit('human ownership interaction anchor mismatch')
s = s.replace(old, new, 1)

old = '- Missing human-authority information requires HUMAN_INPUT_REQUIRED. Missing, stale, incomplete, or contradictory canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. Missing external authority or evidence requires BLOCKED with the appropriate unresolved kind. An unavailable required capability requires BLOCKED with MISSING_CAPABILITY, or EXECUTION_FAILED if an attempted execution failed.'
new = '- In an interactive chat, resolve missing human-authority information through the human conversation before the final app response. If interaction is unavailable or an application-recorded question set is required, use HUMAN_INPUT_REQUIRED. Missing, stale, incomplete, or contradictory canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. Missing external authority or evidence requires BLOCKED with the appropriate unresolved kind. An unavailable required capability requires BLOCKED with MISSING_CAPABILITY, or EXECUTION_FAILED if an attempted execution failed.'
if s.count(old) != 1:
    raise SystemExit('missing human information recovery anchor mismatch')
s = s.replace(old, new, 1)

format_anchor = '''RESPONSE CONTRACT DEFINITIONS
The CONTRACT_SHA256 below is calculated'''
format_replacement = '''FINAL APP RESPONSE WRAPPER
When the interactive exchange is complete, return either raw JSON or exactly this wrapper with no other final-response prose:
APP RESPONSE READY
\`\`\`json
{the completed strict response envelope}
\`\`\`
The application deterministically extracts the single JSON code block. Do not return multiple code blocks. During clarification, do not use this wrapper yet.

RESPONSE CONTRACT DEFINITIONS
The CONTRACT_SHA256 below is calculated'''
if s.count(format_anchor) != 1:
    raise SystemExit('final wrapper insertion anchor mismatch')
s = s.replace(format_anchor, format_replacement, 1)

if s.count("contractVersion:'closed-loop-response-contract/2.3'") != 1:
    raise SystemExit('contract version anchor mismatch')
s = s.replace("contractVersion:'closed-loop-response-contract/2.3'", "contractVersion:'closed-loop-response-contract/2.4'", 1)

wrapper_anchor = "attachmentKeys:['temporaryKey','filename','mediaType','byteSize','sha256','required'],humanInputRequestContract:"
wrapper_replacement = "attachmentKeys:['temporaryKey','filename','mediaType','byteSize','sha256','required'],finalResponseWrapper:{rawJson:true,interactiveWrapper:'APP RESPONSE READY followed by exactly one fenced json code block and no other final-response prose'},humanInputRequestContract:"
if s.count(wrapper_anchor) != 1:
    raise SystemExit('contract wrapper descriptor anchor mismatch')
s = s.replace(wrapper_anchor, wrapper_replacement, 1)
p.write_text(s)


# ---------------------------------------------------------------------------
# response-ingestion.js — accept one deterministic ChatGPT JSON code block,
# preserve raw bytes, and distinguish conversation from final app output.
# ---------------------------------------------------------------------------
p = Path('response-ingestion.js')
s = p.read_text()
byte_anchor = "const byteLength=text=>new TextEncoder().encode(String(text??'')).byteLength;\n"
unwrap = r'''const byteLength=text=>new TextEncoder().encode(String(text??'')).byteLength;
function unwrapFinalAppResponse(raw){
  const trimmed=String(raw??'').trim();
  if(!trimmed.startsWith('```')&&!trimmed.startsWith('APP RESPONSE READY'))return {text:trimmed,normalization:null};
  const match=trimmed.match(/^(?:APP RESPONSE READY[ \t]*\n)?```(?:json)?[ \t]*\n([\s\S]*?)\n```[ \t]*$/i);
  if(!match)throw Object.assign(new Error('Final app response wrapper is malformed. Paste one raw JSON object or exactly APP RESPONSE READY followed by one fenced JSON code block.'),{code:'NON_JSON_WRAPPER'});
  const payload=String(match[1]??'').trim();
  if(!payload)throw Object.assign(new Error('The final JSON code block is empty.'),{code:'EMPTY_RESPONSE'});
  if(payload.includes('```'))throw Object.assign(new Error('The final app response may contain only one JSON code block.'),{code:'NON_JSON_WRAPPER'});
  return {text:payload,normalization:'FINAL_JSON_FENCE'};
}
'''
if s.count(byte_anchor) != 1:
    raise SystemExit('ingestion unwrap insertion anchor mismatch')
s = s.replace(byte_anchor, unwrap, 1)

start = s.find('function strictParse(text,{limits=schema.DEFAULT_RESOURCE_LIMITS}={}){')
end = s.find('\n\nfunction disposition(', start)
if start < 0 or end < 0:
    raise SystemExit('strictParse replacement anchors missing')
strict_parse = r'''function strictParse(text,{limits=schema.DEFAULT_RESOURCE_LIMITS}={}){
  const raw=String(text??'');
  if(!raw.trim())throw Object.assign(new Error('Returned output is empty.'),{code:'EMPTY_RESPONSE'});
  if(byteLength(raw)>limits.maxRawResponseBytes)throw Object.assign(new Error('Returned output exceeds the stage byte limit.'),{code:'OVERSIZED_RESPONSE'});
  const unwrapped=unwrapFinalAppResponse(raw),candidate=unwrapped.text.trim(),normalizations=[];
  if(unwrapped.normalization)normalizations.push(unwrapped.normalization);
  if(!candidate.startsWith('{')&&!candidate.startsWith('['))throw Object.assign(new Error('This appears to be a conversational agent message, not the final app response. Continue the chat until the agent returns APP RESPONSE READY, then paste that final response.'),{code:'FINAL_APP_RESPONSE_NOT_FOUND'});
  const parseCandidate=value=>{try{scanJsonAmbiguity(value,limits.maxJsonDepth);}catch(error){if(error.code)throw error;}return JSON.parse(value);};
  let envelope,firstError=null;
  try{envelope=parseCandidate(candidate);}catch(error){
    if(error.code)throw error;
    firstError=error;
    const repaired=normalizeSmartJsonDelimiters(candidate);
    if(repaired.changed){
      try{envelope=parseCandidate(repaired.text);normalizations.push('SMART_JSON_DELIMITERS');}
      catch(repairError){if(repairError.code)throw repairError;firstError=repairError;}
    }
    if(!envelope){
      const likelyTruncated=!candidate.endsWith('}')||((candidate.match(/{/g)||[]).length!==(candidate.match(/}/g)||[]).length);
      throw Object.assign(new Error(`Response JSON could not be parsed: ${firstError?.message||error.message}`),{code:likelyTruncated?'TRUNCATED_RESPONSE':'MALFORMED_JSON',cause:firstError||error});
    }
  }
  if(!object(envelope))throw Object.assign(new Error('The response root must be one JSON object.'),{code:'INVALID_ROOT'});
  if(normalizations.length)Object.defineProperty(envelope,'__parseNormalization',{value:normalizations.join('+'),enumerable:false});
  return envelope;
}'''
s = s[:start] + strict_parse + s[end:]
p.write_text(s)


# ---------------------------------------------------------------------------
# app-core.js — a compact collapsible walkthrough, human chat step, and clear
# stale-validation behavior after the operator edits the response.
# ---------------------------------------------------------------------------
p = Path('app-core.js')
s = p.read_text()
if s.count("['EXACT_USER_OBJECTIVE_VERBATIM','Verbatim job request','textarea']") != 1:
    raise SystemExit('job request label anchor mismatch')
s = s.replace("['EXACT_USER_OBJECTIVE_VERBATIM','Verbatim job request','textarea']", "['EXACT_USER_OBJECTIVE_VERBATIM','What do you need? (required)','textarea']", 1)

old = 'Start with one thing: save the verbatim job request. Add files or constraints you already have; everything else can be clarified later. If more human information is needed now, the agent must return one structured HUMAN_INPUT_REQUIRED response. Paste it once and the application will show the plain-language questions here, validate your answers, version them as User Job Input, and regenerate Stage 01.'
new = 'Start with the requested outcome and any files or constraints you already have. Send the current instruction to ChatGPT. If it asks questions, answer naturally in the same chat. Do not paste the question-and-answer conversation into this app. When ChatGPT returns APP RESPONSE READY, paste that final response below.'
if s.count(old) != 1:
    raise SystemExit('Stage 01 human intake UI anchor mismatch')
s = s.replace(old, new, 1)

guide = r'''function stageGuideMarkup(n){
 const phase=n===1?'intake':n<=5?'research and collection':'production and verification';
 const note=n===1?'Stage 01 should collect predictable human-only facts now, but it should not ask you for facts it can read, research, derive, or explain itself.':n<=5?'The agent should do the available research first. It should ask you only when an irreducible human fact or decision remains material after that work.':'Supply the exact files, tools, or human decisions named by the stage. Never confirm an operation that did not actually occur.';
 return `<details class="record-card stage-guide"><summary>How to use this stage <span>?</span></summary><div class="record-body"><p class="section-intro">This is the ${esc(phase)} phase. The guide stays collapsed after you know the routine.</p><ol><li>Save or copy the current instruction and send it in the same ChatGPT conversation with every file the agent must actually read.</li><li>If ChatGPT asks questions, answer there in normal language. Do not paste those conversational messages into the response box.</li><li>When ChatGPT returns <strong>APP RESPONSE READY</strong>, paste the whole final reply below. A raw JSON object also works.</li><li>Press <strong>Parse / validate response</strong>, review the proposed changes, then accept or request correction.</li></ol><p class="help">${esc(note)}</p></div></details>`;
}
'''
if s.count('function workflow(){') != 1:
    raise SystemExit('stage guide insertion anchor mismatch')
s = s.replace('function workflow(){', guide + 'function workflow(){', 1)

old = '<div class="notice"><strong>Clarify before final JSON.</strong> If the external agent asks a question, answer it there, then record the answer in User Job Input and regenerate this instruction. Do not paste or accept a placeholder DATA_PROPOSAL just to discover what information is missing.</div>'
new = '<div class="notice"><strong>Chat first; paste the final app response last.</strong> Answer agent questions in the same ChatGPT conversation. Paste only the final APP RESPONSE READY reply or a raw JSON object into this app.</div>'
if s.count(old) != 1:
    raise SystemExit('Stage 01 notice anchor mismatch')
s = s.replace(old, new, 1)

old = '${testExecutionGuidanceMarkup(n)}<div class="panel"><h2 class="section-title">Agent loop</h2>'
new = '${testExecutionGuidanceMarkup(n)}${stageGuideMarkup(n)}<div class="panel"><h2 class="section-title">Agent loop</h2>'
if s.count(old) != 1:
    raise SystemExit('stage guide placement anchor mismatch')
s = s.replace(old, new, 1)

old = '<div class="operator-loop" aria-label="Normal stage workflow"><div class="operator-step"><b>1</b><span>Send instruction</span></div><div class="operator-step"><b>2</b><span>Paste full response</span></div><div class="operator-step"><b>3</b><span>Parse and validate</span></div><div class="operator-step"><b>4</b><span>Review and accept</span></div></div>'
new = '<div class="operator-loop" aria-label="Normal stage workflow"><div class="operator-step"><b>1</b><span>Send instruction</span></div><div class="operator-step"><b>2</b><span>Answer questions in ChatGPT</span></div><div class="operator-step"><b>3</b><span>Wait for APP RESPONSE READY</span></div><div class="operator-step"><b>4</b><span>Paste and validate</span></div><div class="operator-step"><b>5</b><span>Review and accept</span></div></div>'
if s.count(old) != 1:
    raise SystemExit('operator loop anchor mismatch')
s = s.replace(old, new, 1)

old = 'Paste the complete strict JSON response. Parse / validate preserves the raw response first, then validates it without changing canonical project records. If the response declares returned files, attach those exact files in Authorized files for this stage before parsing.'
new = 'Paste the final APP RESPONSE READY reply or one raw JSON object. If ChatGPT is still asking questions, continue that conversation first. Parse / validate preserves the exact pasted response before validation and never changes canonical project records on failure. If the final response declares returned files, attach those exact files before parsing.'
if s.count(old) != 1:
    raise SystemExit('returned response guidance anchor mismatch')
s = s.replace(old, new, 1)

old = '<div class="stage-output-hint"><span>Complete JSON only — no Markdown wrapper.</span>'
new = '<div class="stage-output-hint"><span id="response-edit-status">APP RESPONSE READY or raw JSON only.</span>'
if s.count(old) != 1:
    raise SystemExit('response status hint anchor mismatch')
s = s.replace(old, new, 1)

wire_anchor = "if($('#parse-output'))$('#parse-output').onclick=prepareStageResponse;"
wire_replacement = "if($('#stage-output'))$('#stage-output').oninput=e=>{const report=$('#validation-report');if(report)report.hidden=true;const status=$('#response-edit-status');if(status)status.textContent='Current text changed since the last parse. Press Parse / validate response.';const counter=e.target.closest('.panel')?.querySelector('.stage-output-hint span:last-child');if(counter)counter.textContent=`${e.target.value.length.toLocaleString()} characters pasted`;};" + wire_anchor
if s.count(wire_anchor) != 1:
    raise SystemExit('response edit-state wire anchor mismatch')
s = s.replace(wire_anchor, wire_replacement, 1)
p.write_text(s)


# ---------------------------------------------------------------------------
# verify-ingestion.mjs — the deterministic wrapper is valid; conversational
# prose and malformed/multiple wrappers still fail closed.
# ---------------------------------------------------------------------------
p = Path('verify-ingestion.mjs')
s = p.read_text()
old = "negative('markdown wrapped',(e)=>'```json\\n'+JSON.stringify(e)+'\\n```','NON_JSON_WRAPPER');"
new = r'''{
 const p=project('JOB-FINAL-WRAPPER'),stage=2,pr=savePrompt(p,stage),e=validEnvelope(p,stage,pr),wrapped='APP RESPONSE READY\n```json\n'+JSON.stringify(e)+'\n```';
 const prepared=ingestion.prepare(p,{stage,text:wrapped,promptRecord:pr});
 if(!prepared.validation.valid)throw new Error(`Valid interactive final wrapper rejected: ${JSON.stringify(prepared.validation.issues)}`);
 if(prepared.rawRecord.completeRawResponse!==wrapped)throw new Error('Interactive final wrapper raw response was not preserved exactly.');
}
{
 const p=project('JOB-CODE-BLOCK-ONLY'),stage=2,pr=savePrompt(p,stage),e=validEnvelope(p,stage,pr),wrapped='```json\n'+JSON.stringify(e)+'\n```';
 const prepared=ingestion.prepare(p,{stage,text:wrapped,promptRecord:pr});
 if(!prepared.validation.valid)throw new Error(`Valid JSON code block rejected: ${JSON.stringify(prepared.validation.issues)}`);
}
negative('malformed final wrapper',(e)=>'APP RESPONSE READY\n```json\n'+JSON.stringify(e),'NON_JSON_WRAPPER');
negative('multiple final code blocks',(e)=>'```json\n'+JSON.stringify(e)+'\n```\n```json\n'+JSON.stringify(e)+'\n```','NON_JSON_WRAPPER');
negative('conversation is not final output',()=> 'I need one more human answer before I can finish this stage.','FINAL_APP_RESPONSE_NOT_FOUND');'''
if s.count(old) != 1:
    raise SystemExit('ingestion markdown-wrapper test anchor mismatch')
s = s.replace(old, new, 1)
p.write_text(s)


# ---------------------------------------------------------------------------
# verify-prompt-semantics.mjs — make the human interaction protocol a first-
# class invariant for every stage/operation and update the Stage 01 intake rule.
# ---------------------------------------------------------------------------
p = Path('verify-prompt-semantics.mjs')
s = p.read_text()
identity_anchor = "  if(!record.prompt.includes(`BODY_SHA256: ${record.bodySha256}`)||!record.prompt.includes(`CONTRACT_SHA256: ${record.contractSha256}`)||!record.prompt.includes(`CONTEXT_SIGNATURE: ${record.contextSignature}`))issues.push('PROMPT_HASH_IDENTITY_MISSING');\n"
identity_replacement = identity_anchor + "  if(!record.prompt.includes('INTERACTIVE HUMAN EXPERIENCE — CHAT FIRST, MACHINE RESPONSE LAST')||!record.prompt.includes('Do not mention schema names, hashes, responseType, stageData, temporary keys, or parser rules while talking with the human')||!record.prompt.includes('APP RESPONSE READY')||!record.prompt.includes('Research and collection stages must complete all available research first'))issues.push('INTERACTIVE_HUMAN_PROTOCOL_MISSING');\n"
if s.count(identity_anchor) != 1:
    raise SystemExit('semantic interaction invariant anchor mismatch')
s = s.replace(identity_anchor, identity_replacement, 1)

old = "    if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL')||!record.prompt.includes('Do not ask conversational questions outside the JSON response')||!record.prompt.includes('display and type-check those questions')||!record.prompt.includes('generate a replacement Stage 01 instruction'))issues.push('STAGE01_STRUCTURED_CLARIFICATION_MISSING');"
new = "    if(!record.prompt.includes('STAGE 01 HUMAN INTAKE EXPERIENCE')||!record.prompt.includes('ask one concise numbered batch')||!record.prompt.includes('Do not output machine JSON while asking questions')||!record.prompt.includes('Facts discovered only through later source or requirement research may trigger the same human-input process'))issues.push('STAGE01_INTERACTIVE_INTAKE_MISSING');"
if s.count(old) != 1:
    raise SystemExit('Stage 01 semantic clarification anchor mismatch')
s = s.replace(old, new, 1)

old = " if(!ui.includes('Start with one thing: save the verbatim job request')||!ui.includes('one structured HUMAN_INPUT_REQUIRED response')||!ui.includes('validate your answers, version them as User Job Input, and regenerate Stage 01'))throw new Error('Stage 01 operator UI does not explain minimum intake and structured clarification.');"
new = " if(!ui.includes('How to use this stage')||!ui.includes('Answer questions in ChatGPT')||!ui.includes('Wait for APP RESPONSE READY')||!ui.includes('Current text changed since the last parse'))throw new Error('Operator UI does not explain the interactive agent loop or stale-validation state.');"
if s.count(old) != 1:
    raise SystemExit('semantic UI guidance anchor mismatch')
s = s.replace(old, new, 1)

old = " const patent=baseProject();patent.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project.';const record=prompts.buildPromptRecord(1,patent,{operation:'COMPLETE'});if(!record.prompt.includes('ASCII U+0022')||!record.prompt.includes('never use typographic/curly quotation marks'))throw new Error('Strict JSON quote syntax is not explicit.');if(record.prompt.includes('ask only the necessary clarification questions in normal plain language first'))throw new Error('Stage 01 still contains the conversational-vs-JSON contradiction.');"
new = " const patent=baseProject();patent.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project.';const record=prompts.buildPromptRecord(1,patent,{operation:'COMPLETE'});if(!record.prompt.includes('ASCII U+0022')||!record.prompt.includes('never use typographic/curly quotation marks'))throw new Error('Strict JSON quote syntax is not explicit.');if(!record.prompt.includes('collect the predictable human-only patent intake facts')||!record.prompt.includes('Ask in ordinary language, offer simple options and a recommended default'))throw new Error('Stage 01 does not provide a practical patent intake conversation.');if(record.prompt.includes('Do not ask conversational questions outside the JSON response'))throw new Error('Stage 01 still forbids the required human conversation.');"
if s.count(old) != 1:
    raise SystemExit('semantic minimum patent test anchor mismatch')
s = s.replace(old, new, 1)

s = s.replace("closed-loop-response-contract/2.3", "closed-loop-response-contract/2.4")

required_replacements = {
    "  'Do not block Stage 01 merely because information will be needed by a later',": "  'Use Stage 01 to collect every predictable human-only fact or decision',",
    "  'Stage 01 does not require every fact needed to execute later stages',": "  'Stage 01 does not require facts that only research or later work can discover',",
    "  'Do not require jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices merely to finish Stage 01',": "  'collect the predictable human-only patent intake facts',",
    "  'Never ask for information merely because a later stage will need it',": "  'Do not ask the human for patent-law conclusions, prior-art research, or facts the supplied packet already answers',"
}
for old, new in required_replacements.items():
    if s.count(old) != 1:
        raise SystemExit(f'practical intake test anchor mismatch: {old}')
    s = s.replace(old, new, 1)

list_anchor = "  'Do not invent requestKey, required, whyNeeded, expectedAnswer'\n ];"
list_replacement = "  'Do not invent requestKey, required, whyNeeded, expectedAnswer',\n  'INTERACTIVE HUMAN EXPERIENCE — CHAT FIRST, MACHINE RESPONSE LAST',\n  'APP RESPONSE READY'\n ];"
if s.count(list_anchor) != 1:
    raise SystemExit('practical intake interaction token anchor mismatch')
s = s.replace(list_anchor, list_replacement, 1)
p.write_text(s)


# ---------------------------------------------------------------------------
# verify-browser.mjs — prove the guide, interactive prompt, exact wrapper, and
# that editing a replacement hides the prior validation error.
# ---------------------------------------------------------------------------
p = Path('verify-browser.mjs')
s = p.read_text()
old = " await openStage(cdp,1);text=(await snapshot(cdp)).text;for(const token of ['Start with one thing: save the verbatim job request','one structured HUMAN_INPUT_REQUIRED response','STAGE 01 NEEDS YOUR JOB REQUEST'])assert(text.includes(token),`Stage 01 clarification experience missing ${token}.`);assert(!text.includes('plain-language questions before final JSON'),'Stage 01 UI still advertises the contradictory conversational-before-JSON path.');"
new = " await openStage(cdp,1);text=(await snapshot(cdp)).text;for(const token of ['Start with the requested outcome','How to use this stage','STAGE 01 NEEDS YOUR JOB REQUEST'])assert(text.includes(token),`Stage 01 interactive experience missing ${token}.`);assert(!text.includes('one structured HUMAN_INPUT_REQUIRED response'),'Stage 01 UI still treats the human as a JSON question endpoint.');"
if s.count(old) != 1:
    raise SystemExit('browser Stage 01 guidance anchor mismatch')
s = s.replace(old, new, 1)

old = " await fill(cdp,'#stage-output',JSON.stringify(envelope));await click(cdp,'#parse-output');"
new = " await fill(cdp,'#stage-output',JSON.stringify(envelope));assert(await evalValue(cdp,`document.querySelector('#validation-report')?.hidden===true&&document.querySelector('#response-edit-status')?.textContent.includes('changed since the last parse')`),'Editing a replacement response did not clear the stale validation display.');await click(cdp,'#parse-output');"
if s.count(old) != 1:
    raise SystemExit('browser stale validation anchor mismatch')
s = s.replace(old, new, 1)

insert_anchor = " // Malformed import does not destroy projects.\n"
insert = r''' // Interactive Stage 01: normal ChatGPT conversation guidance followed by one exact final JSON wrapper.
 await click(cdp,'[data-view="Project"]');await fill(cdp,'[data-job="EXACT_USER_OBJECTIVE_VERBATIM"]','I need a patent application for my project.');await click(cdp,'#save-job');await openStage(cdp,1);text=(await snapshot(cdp)).text;for(const token of ['Answer questions in ChatGPT','Wait for APP RESPONSE READY','INTERACTIVE HUMAN EXPERIENCE — CHAT FIRST, MACHINE RESPONSE LAST','collect the predictable human-only patent intake facts'])assert(text.includes(token),`Interactive Stage 01 prompt/UI missing ${token}.`);await click(cdp,'#save-prompt');let guided=await activeProject(cdp),guidedPrompt=guided.projectData.generatedPrompts.filter(x=>Number(x.stage)===1&&!x.invalidatedBy).at(-1);assert(guidedPrompt?.instructionId,'Interactive Stage 01 prompt was not saved.');const guidedEnvelope={schema:'closed-loop-stage-response/2',jobId:guided.job.JOB_ID,stage:1,operation:guidedPrompt.operation||'COMPLETE',promptIdentity:{instructionId:guidedPrompt.instructionId,bodySha256:guidedPrompt.bodySha256||guidedPrompt.sha256,contractSha256:guidedPrompt.contractSha256,contextSignature:guidedPrompt.contextSignature},scope:guidedPrompt.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{EXACT_DELIVERABLE_REQUESTED:'Prepare the complete patent-application drafting package defined by the accepted intake.',ASSUMPTIONS:'No patent allowance or ownership outcome is guaranteed.',UNKNOWN_INFORMATION:'Later research may reveal additional human-only filing decisions.',INPUT_SET_CONTENTS:'The verbatim patent request and supplied human materials.'},records:{},evidence:[{temporaryKey:'evidence-1',kind:'HUMAN_INPUT',description:'Human input supporting the Stage 01 job definition',authorityType:'HUMAN',location:'AUTHORIZED USER JOB INPUT',content:'The human requested a patent application for the project.',notes:''}],unresolved:[],warnings:[],attachments:[]},guidedWrapped='APP RESPONSE READY\n```json\n'+JSON.stringify(guidedEnvelope)+'\n```';await fill(cdp,'#stage-output',guidedWrapped);await click(cdp,'#parse-output');await waitExpr(cdp,`document.body.innerText.includes('Proposed extracted changes')`);await click(cdp,'#accept-proposal');await waitExpr(cdp,`document.body.innerText.includes('Prepare the complete patent-application drafting package')`);guided=await activeProject(cdp);assert(guided.projectData.acceptedChanges.some(x=>Number(x.stage)===1&&!x.invalidatedBy),'Interactive wrapped Stage 01 response was not accepted.');

'''
if s.count(insert_anchor) != 1:
    raise SystemExit('browser interactive insertion anchor mismatch')
s = s.replace(insert_anchor, insert + insert_anchor, 1)
p.write_text(s)


# Refresh the one shared deterministic runtime identity.
runtime = ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def git_blob(path):
    data = Path(path).read_bytes()
    return hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
manifest = ''.join(f'{name}:{git_blob(name)}\n' for name in runtime).encode()
token = 'runtime-' + hashlib.sha256(manifest).hexdigest()[:16]
p = Path('index.html')
html = p.read_text()
html, count = re.subn(r'(src="(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js\?v=)runtime-[a-f0-9]{16}(\")', rf'\g<1>{token}\2', html)
if count != 8:
    raise SystemExit(f'expected 8 runtime token replacements, found {count}')
p.write_text(html)

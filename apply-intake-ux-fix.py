from pathlib import Path
import hashlib


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise RuntimeError(f"{path}: expected anchor not found")
    if text.count(old) != 1:
        raise RuntimeError(f"{path}: expected exactly one anchor, found {text.count(old)}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "prompt-engine.js",
    "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/15';",
    "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/16';",
)

replace_once(
    "prompt-engine.js",
    """HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE
Do not start by emitting JSON when a human-only answer is needed. Talk to the human first; JSON is the final handoff to the application, not the conversation.
You are working with a human in a normal ChatGPT conversation, commonly on a phone. Make the human experience simple. If the current stage needs a human-specific fact, preference, observation, authorization, or decision that is not already available, ask the smallest useful set of plain-language questions conversationally before producing the final machine response. Briefly explain why a question matters when that is not obvious. Do not make the human read or answer JSON. Do not ask for information already present in supplied materials or canonical context, and do not ask the human for facts you can reliably determine from authorized sources, tools, or ordinary domain knowledge. Continue the conversation until you have enough information for the current stage, or the human says an item is unknown/unavailable. Then produce the final JSON response only.
Stage 01 should collect all human-specific information already foreseeable as needed to achieve the requested outcome, not merely the minimum needed to name the job. Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision; when that happens, ask the human conversationally at that later stage rather than guessing. Keep human-facing explanations concise, complete, accurate, and action-oriented.
""",
    """HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE
JSON is the final handoff to the application, not the conversation. Do not start by emitting JSON when a human-only answer is needed.
You are working with a human in a normal ChatGPT conversation, commonly on a phone. When human input is needed, first give at most one short sentence explaining what this stage is doing and what you need from the human, then ask the smallest useful set of plain-language questions. Keep explanations concise, complete, accurate, and action-oriented. Do not make the human read, edit, or answer JSON.
Classify missing information before deciding what to ask: BLOCKING-NOW means the answer is required to complete the current stage; ASK-NOW/NONBLOCKING means the question must be asked now but the human may answer unknown or defer it; LATER-RESOLVABLE means do not ask now because supplied material, authorized research/tools, ordinary domain knowledge, or a later stage can resolve it. Nonblocking means the human may answer unknown or defer; it does not mean the agent may skip a required ask-now question.
Conversational questions are not humanInputRequests. humanInputRequests is only part of a final HUMAN_INPUT_REQUIRED machine response when a genuinely blocking answer remains unavailable or explicitly deferred after conversation, or when interactive conversation is unavailable.
Do not ask for information already present in supplied materials or canonical context, and do not ask the human for facts you can reliably determine from authorized sources, tools, or ordinary domain knowledge. Continue the conversation until you have enough information for the current stage, or the human has answered unknown/deferred where that is allowed. Then produce the final JSON response only.
Stage 01 must collect every human-specific fact or decision already foreseeable as necessary to achieve the requested outcome, not merely the minimum needed to name the job. Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision; when that happens, ask the human conversationally at that later stage rather than guessing.
""",
)

replace_once(
    "prompt-engine.js",
    """- PATENT / REGULATED FILING: use only the minimum human-supplied invention facts needed to recognize and define the requested patent-application drafting job. Use any supplied invention disclosure only for those minimum Stage 01 job-definition facts. A request such as \"prepare a patent application for this project\" is sufficient to define a patent-application drafting job at Stage 01 unless the human has expressed mutually incompatible deliverables. Do not make jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices automatic Stage-01 blockers. However, when any of these are foreseeable human-specific inputs for the requested patent outcome and are not already supplied, ask the human for them conversationally during Stage 01. If the human does not know or cannot decide yet, record that item as unresolved for the earliest later stage that actually requires it. Do not research patent authority, prior art, or draft the application here.""",
    """- PATENT / REGULATED FILING: use only the minimum human-supplied invention facts needed to recognize and define the requested patent-application drafting job. A request such as \"prepare a patent application for this project\" is sufficient to define a patent-application drafting job at Stage 01 unless the human has expressed mutually incompatible deliverables. The proactive Stage 01 human-intake rule is an intentional exception to the generic rule to ask only what is needed to define the stage now. Before final Stage 01 JSON, ask conversationally for every foreseeable patent-specific fact or decision that must ultimately come from the human and is not already supplied. This mandatory ASK-NOW/NONBLOCKING intake includes, when relevant and not already known: intended jurisdiction or jurisdictions; filing route or application type preference and any existing filing; inventor identities; ownership, assignment, employment, or other rights obligations; priority, continuity, and related-application history; public disclosure, publication, sale, offer for sale, public use, demonstration, or other disclosure history and dates; known filing or business deadlines; government funding or joint-research circumstances; intended endpoint such as inventor review, counsel review, or filing-ready; and whether additional human-controlled invention materials exist. Do not ask the human to repeat facts already present in supplied materials. Do not satisfy this gate by silently placing unanswered ask-now items into UNKNOWN_INFORMATION. If the human answers unknown, does not know, or explicitly defers a nonblocking item, record it as unresolved and continue. Do not make those items automatic Stage-01 blockers merely because a later stage will require them. HUMAN_INPUT_REQUIRED is reserved for an unanswered human fact or decision without which Stage 01 itself cannot be completed. A material named in SUPPLIED_MATERIALS_INVENTORY whose bytes are unavailable remains part of INPUT_SET_CONTENTS; do not ask the human to describe its contents, do not infer invention facts from its filename, and treat byte unavailability as nonblocking unless it prevents identification of the objective or deliverable. Do not research patent authority, prior art, or draft the application here.""",
)

replace_once(
    "prompt-engine.js",
    """STAGE 01 CLARIFICATION EXPERIENCE
Before the final Stage 01 machine response, determine whether the human-authority input plus any supplied materials actually available in this executing context are sufficient for Stage 01. When a genuinely human-only fact or decision is needed, ask it conversationally first under HUMAN COLLABORATION MODE. Never ask the human to repeat information available in supplied materials, and do not ask for facts the agent can reliably determine from authorized tools, sources, or ordinary domain knowledge. Continue the normal chat until enough information is available or the human says the item is unknown or unavailable. Use HUMAN_INPUT_REQUIRED only as the final machine fallback when a genuinely blocking human answer remains unavailable or explicitly deferred after that conversation, or when interactive conversation is unavailable. In that fallback, include only the smallest set of still-unanswered blocking questions in humanInputRequests. Do not hide missing human information behind UNKNOWN, placeholders, empty strings, or guessed assumptions.
""",
    """STAGE 01 CLARIFICATION EXPERIENCE
Before the final Stage 01 machine response, apply the HUMAN COLLABORATION MODE taxonomy: BLOCKING-NOW, ASK-NOW/NONBLOCKING, and LATER-RESOLVABLE. Ask every BLOCKING-NOW and ASK-NOW/NONBLOCKING human-only question conversationally before final JSON. Nonblocking means the human may answer unknown or defer; it does not mean the question may be skipped. Never ask the human to repeat information available in supplied materials, and do not ask for facts the agent can reliably determine from authorized tools, sources, or ordinary domain knowledge. Use HUMAN_INPUT_REQUIRED only as the final machine fallback when a genuinely blocking human answer remains unavailable or explicitly deferred after that conversation, or when interactive conversation is unavailable. In that fallback, include only the smallest set of still-unanswered blocking questions in humanInputRequests.

MANDATORY STAGE 01 PRE-SUBMISSION GATE
Before returning Stage 01 JSON, verify all five: (1) the objective and intended deliverable are defined; (2) supplied materials are identified at the Stage 01 boundary without performing Stage 02 inventory or research; (3) every foreseeable human-only intake item is already supplied, was asked conversationally and answered, or was asked and explicitly answered unknown/deferred where nonblocking; (4) no source research, requirement derivation, patent drafting, implementation, production, filing, testing, or other later-stage work was performed; and (5) the final response type matches the remaining state: DATA_PROPOSAL when Stage 01 is defined, HUMAN_INPUT_REQUIRED only for still-unanswered blocking human input, otherwise the appropriate permitted blocker or failure response. Do not bypass this gate by placing an unasked ASK-NOW/NONBLOCKING human item directly into UNKNOWN_INFORMATION.
""",
)

replace_once(
    "prompt-engine.js",
    """- When you have enough information to submit the current stage result, return exactly one final JSON object and no Markdown fence, preamble, conversational question, or trailing prose. Before that final submission, normal concise human dialogue is allowed and required when human-only information is needed. Use valid JSON syntax with ASCII U+0022 double quotation marks for every JSON member name and string delimiter; never use typographic/curly quotation marks.""",
    """- When you have enough information to submit the current stage result, return exactly one final JSON object and no Markdown fence, preamble, conversational question, or trailing prose. Before that final submission, normal concise human dialogue is allowed and required when human-only information is needed. Final JSON self-check before sending: the first non-whitespace character is {, the last is }, the response is JSON.parse-compatible, every JSON delimiter quote is ASCII U+0022, no typographic/curly quote is used as JSON syntax, and there is no Markdown wrapper or prose outside the object.""",
)

replace_once(
    "app-core.js",
    "['DESIRED_SOURCE_COUNT','Desired / suggested source count','number']",
    "['DESIRED_SOURCE_COUNT','Desired / suggested source count','sourceCount']",
)
replace_once(
    "app-core.js",
    """${t==='textarea'?`<textarea data-job=\"${k}\">${esc(current.job[k]||'')}</textarea>`:`<input data-job=\"${k}\" type=\"${t==='number'?'number':'text'}\"${t==='number'?' min=\"0\" step=\"1\"':''} value=\"${esc(current.job[k]??'')}\">`}""",
    """${t==='textarea'?`<textarea data-job=\"${k}\">${esc(current.job[k]||'')}</textarea>`:t==='sourceCount'?`<input data-job=\"${k}\" type=\"text\" inputmode=\"numeric\" pattern=\"[0-9]*\" autocomplete=\"off\" aria-describedby=\"desired-source-count-help\" value=\"${esc(current.job[k]??'')}\"><span class=\"help\" id=\"desired-source-count-help\">Optional — enter a whole number of 1 or more, or leave blank for automatic.</span>`:`<input data-job=\"${k}\" type=\"text\" value=\"${esc(current.job[k]??'')}\">`}""",
)
replace_once(
    "app-core.js",
    """async function saveJob(){const next=clone(current),changed=[];document.querySelectorAll('[data-job]').forEach(x=>{const key=x.dataset.job,value=x.type==='number'?(x.value===''?null:Number(x.value)):x.value;if(next.job[key]!==value){next.job[key]=value;changed.push(key);}});""",
    """async function saveJob(){const next=clone(current),changed=[],inputs=[...document.querySelectorAll('[data-job]')],sourceCountInput=inputs.find(x=>x.dataset.job==='DESIRED_SOURCE_COUNT');let desiredSourceCount=null;if(sourceCountInput){const raw=String(sourceCountInput.value||'').trim();sourceCountInput.setCustomValidity('');if(raw&&!/^[1-9]\\d*$/.test(raw)){sourceCountInput.setCustomValidity('Enter a whole number of 1 or more, or leave blank for automatic.');sourceCountInput.reportValidity();sourceCountInput.focus();announce('invalid source count');return;}desiredSourceCount=raw===''?null:Number(raw);if(desiredSourceCount!==null&&!Number.isSafeInteger(desiredSourceCount)){sourceCountInput.setCustomValidity('Enter a whole number of 1 or more within the supported numeric range, or leave blank for automatic.');sourceCountInput.reportValidity();sourceCountInput.focus();announce('invalid source count');return;}}inputs.forEach(x=>{const key=x.dataset.job,value=key==='DESIRED_SOURCE_COUNT'?desiredSourceCount:x.value;if(next.job[key]!==value){next.job[key]=value;changed.push(key);}});""",
)

replace_once(
    "project-store.js",
    """  if(!projectIdentity(project))issues.push('Canonical project has no JOB_ID.');
  const idsByCollection=new Map();""",
    """  if(!projectIdentity(project))issues.push('Canonical project has no JOB_ID.');
  const desiredSourceCount=project?.job?.DESIRED_SOURCE_COUNT;if(desiredSourceCount!==null&&desiredSourceCount!==undefined&&desiredSourceCount!==''&&(!Number.isSafeInteger(desiredSourceCount)||desiredSourceCount<1))issues.push('DESIRED_SOURCE_COUNT must be null/blank or a positive integer.');
  const idsByCollection=new Map();""",
)

replace_once(
    "verify-prompt-semantics.mjs",
    """if(!record.prompt.includes('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE')||!record.prompt.includes('ask the smallest useful set of plain-language questions conversationally')||!record.prompt.includes('Then produce the final JSON response only.')||!record.prompt.includes('Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision'))issues.push('HUMAN_COLLABORATION_MODE_MISSING');""",
    """if(!record.prompt.includes('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE')||!record.prompt.includes('BLOCKING-NOW')||!record.prompt.includes('ASK-NOW/NONBLOCKING')||!record.prompt.includes('LATER-RESOLVABLE')||!record.prompt.includes('Conversational questions are not humanInputRequests')||!record.prompt.includes('Then produce the final JSON response only.')||!record.prompt.includes('Later research, source, requirement, verification, production, or audit stages may discover a new human-only fact or decision'))issues.push('HUMAN_COLLABORATION_MODE_MISSING');""",
)
replace_once(
    "verify-prompt-semantics.mjs",
    """if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('ask it conversationally first under HUMAN COLLABORATION MODE')||!record.prompt.includes('Use HUMAN_INPUT_REQUIRED only as the final machine fallback'))issues.push('STAGE01_CONVERSATION_FIRST_CLARIFICATION_MISSING');""",
    """if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('MANDATORY STAGE 01 PRE-SUBMISSION GATE')||!record.prompt.includes('Do not bypass this gate by placing an unasked ASK-NOW/NONBLOCKING human item directly into UNKNOWN_INFORMATION')||!record.prompt.includes('Use HUMAN_INPUT_REQUIRED only as the final machine fallback'))issues.push('STAGE01_CONVERSATION_FIRST_CLARIFICATION_MISSING');""",
)
replace_once(
    "verify-prompt-semantics.mjs",
    """const patent=baseProject();patent.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project.';const record=prompts.buildPromptRecord(1,patent,{operation:'COMPLETE'});if(!record.prompt.includes('ASCII U+0022')||!record.prompt.includes('never use typographic/curly quotation marks'))throw new Error('Strict JSON quote syntax is not explicit.');""",
    """const patent=baseProject();patent.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project.';const record=prompts.buildPromptRecord(1,patent,{operation:'COMPLETE'});for(const token of ['intended jurisdiction or jurisdictions','inventor identities','ownership, assignment, employment','priority, continuity','public disclosure, publication, sale, offer for sale','known filing or business deadlines','government funding or joint-research circumstances','intended endpoint such as inventor review, counsel review, or filing-ready','additional human-controlled invention materials','Do not satisfy this gate by silently placing unanswered ask-now items into UNKNOWN_INFORMATION'])if(!record.prompt.includes(token))throw new Error(`Patent Stage 01 proactive intake gate missing ${token}.`);if(!record.prompt.includes('ASCII U+0022')||!record.prompt.includes('JSON.parse-compatible')||!record.prompt.includes('no typographic/curly quote is used as JSON syntax'))throw new Error('Strict JSON quote syntax/self-check is not explicit.');""",
)

replace_once(
    "verify-browser.mjs",
    """ await click(cdp,'[data-view=\"Project\"]');text=(await snapshot(cdp)).text;for(const token of ['Output format (optional)','You do not need to know the final file format in advance','A specification substitute requires human confirmation'])assert(text.includes(token),`Project intake artifact-generation guidance missing ${token}.`);
 // Malformed import does not destroy projects.""",
    """ await click(cdp,'[data-view=\"Project\"]');text=(await snapshot(cdp)).text;for(const token of ['Output format (optional)','You do not need to know the final file format in advance','A specification substitute requires human confirmation'])assert(text.includes(token),`Project intake artifact-generation guidance missing ${token}.`);
 const sourceCountSelector='[data-job=\"DESIRED_SOURCE_COUNT\"]';assert(await evalValue(cdp,`(()=>{const e=document.querySelector(${JSON.stringify(sourceCountSelector)});return Boolean(e&&e.type==='text'&&e.inputMode==='numeric'&&e.pattern==='[0-9]*'&&document.querySelector('#desired-source-count-help')?.textContent.includes('leave blank for automatic'));})()`),'Desired source count does not expose the mobile positive-integer contract.');for(const bad of ['e','1e3','2.5','0','-1']){await fill(cdp,sourceCountSelector,bad);await click(cdp,'#save-job');await sleep(80);assert(await evalValue(cdp,`document.querySelector(${JSON.stringify(sourceCountSelector)})?.validationMessage.includes('whole number of 1 or more')`),`Invalid desired source count ${bad} did not fail local validation.`);}await fill(cdp,sourceCountSelector,'25');await click(cdp,'#save-job');await sleep(160);let sourceCountProject=await activeProject(cdp);assert(sourceCountProject.job.DESIRED_SOURCE_COUNT===25,'Valid desired source count was not saved as integer 25.');await click(cdp,'[data-view=\"Project\"]');await fill(cdp,sourceCountSelector,'');await click(cdp,'#save-job');await sleep(160);sourceCountProject=await activeProject(cdp);assert(sourceCountProject.job.DESIRED_SOURCE_COUNT===null,'Blank desired source count did not save as automatic/null.');
 // Malformed import does not destroy projects.""",
)

runtime_files = [
    "workbook.js",
    "hash.js",
    "workflow-schema.js",
    "workflow-engine.js",
    "prompt-engine.js",
    "response-ingestion.js",
    "project-store.js",
    "app-core.js",
]

def git_blob_sha(path):
    data = Path(path).read_bytes()
    return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()

manifest = "".join(f"{f}:{git_blob_sha(f)}\n" for f in runtime_files)
token = "runtime-" + hashlib.sha256(manifest.encode()).hexdigest()[:16]
html = Path("index.html").read_text()
import re
html = re.sub(r'(src="(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js\?v=)runtime-[a-f0-9]+', rf'\1{token}', html)
Path("index.html").write_text(html)
print(token)

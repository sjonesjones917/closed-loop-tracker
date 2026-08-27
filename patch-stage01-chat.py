from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one target, found {count}")
    return text.replace(old, new, 1)


prompt = Path("prompt-engine.js")
text = prompt.read_text()
text = replace_once(
    text,
    "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/13';",
    "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/14';",
    "prompt version",
)
pattern = re.compile(
    r"\$\{stage===1\?`STAGE 01 CLARIFICATION EXPERIENCE\n.*?\n`:\'\'\}",
    re.S,
)
replacement = """${stage===1?`STAGE 01 CLARIFICATION EXPERIENCE
Before returning the final Stage 01 JSON, inspect the authorized human input and supplied materials, then use HUMAN COLLABORATION MODE to collect every foreseeable human-only fact or decision that can materially affect achieving the requested outcome, even when a later stage will formally use it. Ask only for facts or choices that must come from the human. Do not ask the human to repeat information available in supplied materials, and do not ask for facts the agent can reliably establish through authorized research, tools, computation, official authority, or ordinary domain knowledge. Group related questions and keep them concise. Continue until the human supplies the answer or explicitly says it is unknown, unavailable, or deferred. When an unknown or deferred item does not prevent Stage 01 from defining the job, record it in UNKNOWN_INFORMATION and return DATA_PROPOSAL. Use HUMAN_INPUT_REQUIRED only when a still-unanswered human-only fact or decision truly prevents Stage 01 completion after that conversation, or when interactive conversation is unavailable; include only the still-unanswered blocking questions in humanInputRequests. The application can display and type-check those unresolved questions, version later answers as User Job Input, invalidate this prompt, and generate a replacement Stage 01 instruction. Do not use UNKNOWN, placeholders, empty strings, or assumptions to avoid asking a human question that can presently be answered.
`:''}"""
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise RuntimeError(f"Stage 01 clarification block: expected one target, found {count}")
text = replace_once(
    text,
    "- Never set a HUMAN or HUMAN_DECISION-owned field. When unavailable human information is required, return HUMAN_INPUT_REQUIRED and structured humanInputRequests. Do not convert a missing human fact, choice, legal assertion, engineering parameter, or authority decision into an assumption.",
    "- Never set a HUMAN or HUMAN_DECISION-owned field. Use HUMAN COLLABORATION MODE first whenever a human-only value is needed. Use HUMAN_INPUT_REQUIRED only when a required human answer remains unavailable or explicitly deferred after that conversation, or when interactive conversation is unavailable. Do not convert a missing human fact, choice, legal assertion, engineering parameter, or authority decision into an assumption.",
    "human-owned value rule",
)
prompt.write_text(text)

app = Path("app-core.js")
text = app.read_text()
text = replace_once(
    text,
    "Start with one thing: save the verbatim job request. Add files or constraints you already have; everything else can be clarified later. If more human information is needed now, the agent must return one structured HUMAN_INPUT_REQUIRED response. Paste it once and the application will show the plain-language questions here, validate your answers, version them as User Job Input, and regenerate Stage 01.",
    "Start with one thing: save the verbatim job request and add any files or constraints you already have. Send the current instruction to ChatGPT and answer its short plain-language questions there. The agent should read supplied materials and determine researchable facts itself; it should not make you answer JSON. Paste only the final JSON after the agent has enough information. If a required answer remains unknown, unavailable, or deferred, the application may later display only that focused unresolved question here.",
    "Stage 01 operator guidance",
)
app.write_text(text)

verify = Path("verify-prompt-semantics.mjs")
text = verify.read_text()
text = replace_once(
    text,
    "  if(record.prompt.includes('Do not ask conversational questions outside the JSON response')||record.prompt.includes('Missing human-authority information requires HUMAN_INPUT_REQUIRED'))issues.push('MACHINE_FIRST_HUMAN_CLARIFICATION_CONTRADICTION');",
    "  for(const contradiction of ['Do not ask conversational questions outside the JSON response','Missing human-authority information requires HUMAN_INPUT_REQUIRED','Ask for clarification only when an irreducible human fact or decision is needed now','Never ask for information merely because a later stage will need it','When unavailable human information is required, return HUMAN_INPUT_REQUIRED'])if(record.prompt.includes(contradiction))issues.push(`MACHINE_FIRST_HUMAN_CLARIFICATION_CONTRADICTION_${contradiction}`);",
    "contradiction detector",
)
text = replace_once(
    text,
    "    if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL')||!record.prompt.includes('Ask necessary human questions conversationally before the final JSON response')||!record.prompt.includes('display and type-check those questions')||!record.prompt.includes('generate a replacement Stage 01 instruction'))issues.push('STAGE01_STRUCTURED_CLARIFICATION_MISSING');",
    "    if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('collect every foreseeable human-only fact or decision that can materially affect achieving the requested outcome')||!record.prompt.includes('Continue until the human supplies the answer or explicitly says it is unknown, unavailable, or deferred')||!record.prompt.includes('Use HUMAN_INPUT_REQUIRED only when a still-unanswered human-only fact or decision truly prevents Stage 01 completion after that conversation')||!record.prompt.includes('display and type-check those unresolved questions')||!record.prompt.includes('generate a replacement Stage 01 instruction'))issues.push('STAGE01_CHAT_FIRST_CLARIFICATION_MISSING');",
    "Stage 01 semantic requirement",
)
text = replace_once(
    text,
    " if(!ui.includes('Start with one thing: save the verbatim job request')||!ui.includes('one structured HUMAN_INPUT_REQUIRED response')||!ui.includes('validate your answers, version them as User Job Input, and regenerate Stage 01'))throw new Error('Stage 01 operator UI does not explain minimum intake and structured clarification.');",
    " if(!ui.includes('Start with one thing: save the verbatim job request')||!ui.includes('answer its short plain-language questions there')||!ui.includes('it should not make you answer JSON')||!ui.includes('Paste only the final JSON after the agent has enough information'))throw new Error('Stage 01 operator UI does not explain the chat-first intake and final JSON handoff.');if(ui.includes('one structured HUMAN_INPUT_REQUIRED response'))throw new Error('Stage 01 operator UI still tells the human to use the machine-first question path.');",
    "Stage 01 UI semantic requirement",
)
old = " const patent=baseProject();patent.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project.';const record=prompts.buildPromptRecord(1,patent,{operation:'COMPLETE'});if(!record.prompt.includes('ASCII U+0022')||!record.prompt.includes('never use typographic/curly quotation marks'))throw new Error('Strict JSON quote syntax is not explicit.');if(record.prompt.includes('ask only the necessary clarification questions in normal plain language first'))throw new Error('Stage 01 still contains the conversational-vs-JSON contradiction.');"
new = " const patent=baseProject();patent.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project.';const record=prompts.buildPromptRecord(1,patent,{operation:'COMPLETE'});if(!record.prompt.includes('ASCII U+0022')||!record.prompt.includes('never use typographic/curly quotation marks'))throw new Error('Strict JSON quote syntax is not explicit.');for(const banned of ['Ask for clarification only when an irreducible human fact or decision is needed now','Never ask for information merely because a later stage will need it','When unavailable human information is required, return HUMAN_INPUT_REQUIRED','Do not ask conversational questions outside the JSON response'])if(record.prompt.includes(banned))throw new Error(`Stage 01 still contains the machine-first contradiction: ${banned}`);if(!record.prompt.includes('collect every foreseeable human-only fact or decision that can materially affect achieving the requested outcome'))throw new Error('Stage 01 no longer performs proactive human intake.');"
text = replace_once(text, old, new, "Stage 01 patent regression")
text = replace_once(
    text,
    "  'Never ask for information merely because a later stage will need it',",
    "  'collect every foreseeable human-only fact or decision that can materially affect achieving the requested outcome',",
    "Stage 01 practical intake regression",
)
verify.write_text(text)

browser = Path("verify-browser.mjs")
text = browser.read_text()
text = replace_once(
    text,
    " assert(await evalValue(cdp,`Boolean(document.querySelector('.app-help details')&&!document.querySelector('.app-help details').open)`),'Human guide must exist and start collapsed.');",
    " assert(await evalValue(cdp,`Boolean(document.querySelector('.app-help details')&&!document.querySelector('.app-help details').open)`),'Human guide must exist and start collapsed.');await click(cdp,'.app-help summary');let guideText=(await snapshot(cdp)).text;for(const token of ['Answer the agent normally.','Do not paste those questions into this app.','Paste only that final JSON into the response box'])assert(guideText.includes(token),`Human guide missing ${token}.`);await click(cdp,'.app-help summary');",
    "collapsible guide verification",
)
text = replace_once(
    text,
    " await openStage(cdp,1);text=(await snapshot(cdp)).text;for(const token of ['Start with one thing: save the verbatim job request','one structured HUMAN_INPUT_REQUIRED response','STAGE 01 NEEDS YOUR JOB REQUEST'])assert(text.includes(token),`Stage 01 clarification experience missing ${token}.`);assert(!text.includes('plain-language questions before final JSON'),'Stage 01 UI still advertises the contradictory conversational-before-JSON path.');",
    " await openStage(cdp,1);text=(await snapshot(cdp)).text;for(const token of ['Start with one thing: save the verbatim job request','answer its short plain-language questions there','it should not make you answer JSON','Paste only the final JSON after the agent has enough information','STAGE 01 NEEDS YOUR JOB REQUEST'])assert(text.includes(token),`Stage 01 clarification experience missing ${token}.`);assert(!text.includes('one structured HUMAN_INPUT_REQUIRED response'),'Stage 01 UI still advertises the machine-first question path.');",
    "Stage 01 browser guidance",
)
browser.write_text(text)

print("Applied Stage 01 chat alignment")

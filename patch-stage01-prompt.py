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
    "prompt engine version",
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
    "human-owned value fallback rule",
)
prompt.write_text(text)

verify = Path("verify-prompt-semantics.mjs")
text = verify.read_text()
text = replace_once(
    text,
    "  if(record.prompt.includes('Do not ask conversational questions outside the JSON response')||record.prompt.includes('Missing human-authority information requires HUMAN_INPUT_REQUIRED'))issues.push('MACHINE_FIRST_HUMAN_CLARIFICATION_CONTRADICTION');",
    "  for(const contradiction of ['Do not ask conversational questions outside the JSON response','Missing human-authority information requires HUMAN_INPUT_REQUIRED','Ask for clarification only when an irreducible human fact or decision is needed now','Never ask for information merely because a later stage will need it','When unavailable human information is required, return HUMAN_INPUT_REQUIRED'])if(record.prompt.includes(contradiction))issues.push(`MACHINE_FIRST_HUMAN_CLARIFICATION_CONTRADICTION_${contradiction}`);",
    "machine-first contradiction detector",
)
text = replace_once(
    text,
    "    if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL')||!record.prompt.includes('Ask necessary human questions conversationally before the final JSON response')||!record.prompt.includes('display and type-check those questions')||!record.prompt.includes('generate a replacement Stage 01 instruction'))issues.push('STAGE01_STRUCTURED_CLARIFICATION_MISSING');",
    "    if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('collect every foreseeable human-only fact or decision that can materially affect achieving the requested outcome')||!record.prompt.includes('Continue until the human supplies the answer or explicitly says it is unknown, unavailable, or deferred')||!record.prompt.includes('Use HUMAN_INPUT_REQUIRED only when a still-unanswered human-only fact or decision truly prevents Stage 01 completion after that conversation')||!record.prompt.includes('display and type-check those unresolved questions')||!record.prompt.includes('generate a replacement Stage 01 instruction'))issues.push('STAGE01_CHAT_FIRST_CLARIFICATION_MISSING');",
    "Stage 01 chat-first semantic requirement",
)
old = " const patent=baseProject();patent.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project.';const record=prompts.buildPromptRecord(1,patent,{operation:'COMPLETE'});if(!record.prompt.includes('ASCII U+0022')||!record.prompt.includes('never use typographic/curly quotation marks'))throw new Error('Strict JSON quote syntax is not explicit.');if(record.prompt.includes('ask only the necessary clarification questions in normal plain language first'))throw new Error('Stage 01 still contains the conversational-vs-JSON contradiction.');"
new = " const patent=baseProject();patent.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project.';const record=prompts.buildPromptRecord(1,patent,{operation:'COMPLETE'});if(!record.prompt.includes('ASCII U+0022')||!record.prompt.includes('never use typographic/curly quotation marks'))throw new Error('Strict JSON quote syntax is not explicit.');for(const banned of ['Ask for clarification only when an irreducible human fact or decision is needed now','Never ask for information merely because a later stage will need it','When unavailable human information is required, return HUMAN_INPUT_REQUIRED','Do not ask conversational questions outside the JSON response'])if(record.prompt.includes(banned))throw new Error(`Stage 01 still contains the machine-first contradiction: ${banned}`);if(!record.prompt.includes('collect every foreseeable human-only fact or decision that can materially affect achieving the requested outcome'))throw new Error('Stage 01 no longer performs proactive human intake.');"
text = replace_once(text, old, new, "Stage 01 patent regression")
text = replace_once(
    text,
    "  'Never ask for information merely because a later stage will need it',",
    "  'collect every foreseeable human-only fact or decision that can materially affect achieving the requested outcome',",
    "Stage 01 practical-intake regression",
)
verify.write_text(text)

print("Applied final Stage 01 prompt contradiction repair")

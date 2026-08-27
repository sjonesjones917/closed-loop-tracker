from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one target, found {count}")
    return text.replace(old, new, 1)


prompt = Path("prompt-engine.js")
text = prompt.read_text()
text = replace_once(
    text,
    "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/14';",
    "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/15';",
    "prompt engine version",
)
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
    "  if(record.prompt.includes('Do not ask conversational questions outside the JSON response')||record.prompt.includes('Missing human-authority information requires HUMAN_INPUT_REQUIRED')||record.prompt.includes('return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL')||record.prompt.includes('STAGE 01 NEEDS YOUR JOB REQUEST'))issues.push('MACHINE_FIRST_HUMAN_CLARIFICATION_CONTRADICTION');",
    "  if(record.prompt.includes('Do not ask conversational questions outside the JSON response')||record.prompt.includes('Missing human-authority information requires HUMAN_INPUT_REQUIRED')||record.prompt.includes('return HUMAN_INPUT_REQUIRED—not DATA_PROPOSAL')||record.prompt.includes('STAGE 01 NEEDS YOUR JOB REQUEST')||record.prompt.includes('When unavailable human information is required, return HUMAN_INPUT_REQUIRED'))issues.push('MACHINE_FIRST_HUMAN_CLARIFICATION_CONTRADICTION');",
    "machine-first contradiction regression",
)
verify.write_text(text)

print("Applied final HUMAN_INPUT_REQUIRED fallback repair")

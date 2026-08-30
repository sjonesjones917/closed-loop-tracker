from pathlib import Path

def replace_once(path, old, new):
    p=Path(path); s=p.read_text()
    if old not in s: raise SystemExit(f'Anchor not found in {path}: {old[:120]}')
    if s.count(old)!=1: raise SystemExit(f'Non-unique anchor in {path}: {s.count(old)}')
    p.write_text(s.replace(old,new,1))

replace_once('prompt-engine.js',"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/27';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/28';")
replace_once('prompt-engine.js',
""" return `COPY BLOCK — STAGE ${String(stage).padStart(2,'0')} — ${d.title}\n\nHUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE""",
""" const completionConditions=Array.isArray(d.completionGate)?d.completionGate:[];
 const completionBlock=completionConditions.length?completionConditions.map((item,index)=>`${index+1}. ${item}`).join('\\n'):'No additional declared completion conditions.';
 return `COPY BLOCK — STAGE ${String(stage).padStart(2,'0')} — ${d.title}\n\nSTAGE RESULT — MUST ACHIEVE\n${d.result}\n\nSTAGE COMPLETION CONDITIONS — ALL MUST BE SATISFIED BEFORE CLAIMING THIS STAGE IS COMPLETE\n${completionBlock}\n- Do not claim completion merely because the response is schema-valid.\n- If a required stage result cannot be established, use the correct HUMAN_INPUT_REQUIRED, BLOCKED, EXECUTION_FAILED, or corrective outcome allowed by this operation; never invent completion.\n- Application-owned counts, identities, hashes, coverage, gates, independence determinations, evidence sufficiency, contradiction sets, lifecycle state, and release state are not yours to set.\n\nCANONICAL INPUT EXECUTION RULE — APPLIES TO EVERY STAGE\n- Every project fact, human answer, prior-stage record, artifact identity, manifest entry, and bounded canonical record actually embedded in this prompt is operative input for this stage. Use every relevant item to perform the stage transformation; do not merely summarize, inventory, acknowledge, or discuss it.\n- Project-relevant human information is supplied once. If it is already in canonical project state, persisted human answers, or this prompt, never ask the human to repeat, retype, summarize, resend, reopen, select again, or reattach it.\n- If this stage needs information that an earlier stage was required to capture but that canonical information is absent or incomplete, identify the exact upstream stage deficiency and fail closed. Do not transfer the earlier stage's work back to the human.\n- Do not tell the operator how an agent should do this stage instead of doing the stage. Perform the complete current-stage work yourself within the declared authority and capability boundary.\n- Use only the current-scope records selected by the application. Historical, stale, invalidated, wrong-iteration, wrong-candidate, wrong-run, wrong-product, or withheld records cannot satisfy this stage.\n\nHUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE""")

# Remove a duplicated Stage 04 prohibition sentence without changing its semantics.
p=Path('prompt-engine.js'); s=p.read_text()
dup="The original Stage 01 intent file is prohibited input: never request it, attach it, resend it, reopen it, or rely on an earlier conversation that contains it. The original Stage 01 intent file is prohibited input: never request it, attach it, resend it, reopen it, or rely on an earlier conversation that contains it."
if dup in s:s=s.replace(dup,"The original Stage 01 intent file is prohibited input: never request it, attach it, resend it, reopen it, or rely on an earlier conversation that contains it.",1)
p.write_text(s)

from pathlib import Path

# Correct the one repair-script anchor that differs from the exact prompt template.
p=Path('repair-all-prompts.py'); s=p.read_text()
s=s.replace("STAGE-SPECIFIC TASK\\n${procedures[stage]||'Perform the current stage completely and only the current stage.'}\\n\\nPERMITTED AGENT-OWNED STAGE DATA","STAGE-SPECIFIC TASK\\n${procedures[stage]}\\n\\nPERMITTED AGENT-OWNED STAGE DATA",1)
s=s.replace("STAGE-SPECIFIC TASK\\n${operationSpecificTask(stage,operation)}${operationSpecificTask(stage,operation)?'\\\\n\\\\n':''}${procedures[stage]||'Perform the current stage completely and only the current stage.'}\\n\\nPERMITTED AGENT-OWNED STAGE DATA","STAGE-SPECIFIC TASK\\n${operationSpecificTask(stage,operation)}${operationSpecificTask(stage,operation)?'\\\\n\\\\n':''}${procedures[stage]}\\n\\nPERMITTED AGENT-OWNED STAGE DATA",1)
p.write_text(s)

exec(compile(Path('repair-all-prompts.py').read_text(),'repair-all-prompts.py','exec'))

# Advance prompt-engine identity for materially changed prompt semantics.
p=Path('prompt-engine.js'); s=p.read_text()
s=s.replace("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/28';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/29';",1)

# The project-data/no-repeat invariant must be unconditional, not accidentally dependent on stageData fields.
rule_src="PROJECT DATA EXECUTION RULE — MANDATORY\\nProject data embedded in this prompt is OPERATIVE INPUT. Use every relevant supplied and canonical project fact to perform the current stage transformation; do not merely restate, summarize, inventory, acknowledge, or discuss it. Project-relevant information supplied by the human is supplied once. If it exists in current canonical project state, persisted human answers, or this exact instruction, never ask the human to repeat, retype, summarize, resend, reopen, or reattach it. If required prior-stage capture is incomplete, return the exact earlier-stage deficiency and responsible stage instead of transferring that work back to the human. Never replace required stage work with generic advice about how somebody else should do it.\\n\\n"
old=" const fields=stageFields.length?stageFields.map(x=>{const d=schema.STAGE_FIELDS[stage][x];return `"+rule_src+"- ${x}: ${d.valueType}${d.enumValues?.length?` enum(${d.enumValues.join(' | ')})`:''}${d.nullable?' nullable':''}`;}).join('\\n'):'- No agent-owned stageData fields for this operation; use permitted records/evidence only.';"
new=" const fields=stageFields.length?stageFields.map(x=>{const d=schema.STAGE_FIELDS[stage][x];return `- ${x}: ${d.valueType}${d.enumValues?.length?` enum(${d.enumValues.join(' | ')})`:''}${d.nullable?' nullable':''}`;}).join('\\n'):'- No agent-owned stageData fields for this operation; use permitted records/evidence only.';"
if old not in s: raise SystemExit('embedded project-data rule exact anchor not found')
s=s.replace(old,new,1)
anchor="STAGE-SPECIFIC TASK\n${operationSpecificTask(stage,operation)}${operationSpecificTask(stage,operation)?'\\n\\n':''}${procedures[stage]}\n\nPERMITTED AGENT-OWNED STAGE DATA"
rule="PROJECT DATA EXECUTION RULE — MANDATORY\nProject data embedded in this prompt is OPERATIVE INPUT. Use every relevant supplied and canonical project fact to perform the current stage transformation; do not merely restate, summarize, inventory, acknowledge, or discuss it. Project-relevant information supplied by the human is supplied once. If it exists in current canonical project state, persisted human answers, or this exact instruction, never ask the human to repeat, retype, summarize, resend, reopen, or reattach it. If required prior-stage capture is incomplete, return the exact earlier-stage deficiency and responsible stage instead of transferring that work back to the human. Never replace required stage work with generic advice about how somebody else should do it.\n\n"
if anchor not in s: raise SystemExit('unconditional project-data insertion anchor not found')
s=s.replace(anchor,"STAGE-SPECIFIC TASK\n${operationSpecificTask(stage,operation)}${operationSpecificTask(stage,operation)?'\\n\\n':''}${procedures[stage]}\n\n"+rule+"PERMITTED AGENT-OWNED STAGE DATA",1)
p.write_text(s)

# Semantic phrase matching is about the prompt instruction, not capitalization.
q=Path('verify-stage-prompts-complete.mjs'); v=q.read_text()
oldv="for(const phrase of semantic[stage]||[])if(!prompt.includes(phrase))throw new Error(`Stage ${stage} ${operation} missing stage-semantic instruction: ${phrase}`);"
newv="for(const phrase of semantic[stage]||[])if(!prompt.toLowerCase().includes(String(phrase).toLowerCase()))throw new Error(`Stage ${stage} ${operation} missing stage-semantic instruction: ${phrase}`);"
if oldv in v: v=v.replace(oldv,newv,1)
elif newv not in v: raise SystemExit('semantic verifier anchor not found')
q.write_text(v)

# Full-cycle Stage 01 must use the exact application-generated intake universe, not a hand-written one-record shortcut.
exec(compile(Path('repair-full-cycle-stage01.py').read_text(),'repair-full-cycle-stage01.py','exec'))

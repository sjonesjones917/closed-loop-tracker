from pathlib import Path

prompt=Path('prompt-engine.js')
text=prompt.read_text()
old="${stage===1?'- Stage 01 defines and normalizes the requested deliverable and later capability needs; it does not produce the final deliverable. If the requested artifact itself cannot later be completed reliably because generation capability, required inputs, or manageable scale is genuinely unavailable, propose the appropriate specification substitute for human confirmation. Do not perform later-stage production now.\\n':'- Work too large for the actually available environment must not be represented as completed, but missing downstream tool possession is not the same as missing artifact-generation capability. Follow only the current stage-specific task and never claim downstream operations that did not occur.\\n'}"
new="${stage===1?'- Stage 01 defines and preserves the requested deliverable exactly; it does not produce, downgrade, substitute, redesign, or negotiate away that deliverable merely because a later execution capability may be unavailable. Capability routing belongs to the earliest later stage that can establish it. Ask the human only when a genuine human-authority tradeoff or deliverable change is actually required, and never change EXACT_DELIVERABLE_REQUESTED without that human decision. Do not perform later-stage production now.\\n':'- Work too large for the actually available environment must not be represented as completed, but missing downstream tool possession is not the same as missing artifact-generation capability. Follow only the current stage-specific task and never claim downstream operations that did not occur.\\n'}"
if old not in text:
    raise SystemExit('Stage 01 deliverable substitute rule anchor missing')
text=text.replace(old,new,1)
prompt.write_text(text)

# Replace the obsolete semantic regression that required a substitute deliverable.
test=Path('verify-prompt-semantics.mjs')
t=test.read_text()
old_test="if(!q.includes('EXACT_DELIVERABLE_REQUESTED')||!/human intent confirmation/i.test(q))throw new Error('Stage 01 does not establish a confirmable feasible substitute deliverable.');\n if(/Return BLOCKED with WORK_TOO_LARGE_FOR_ENVIRONMENT or MISSING_CAPABILITY as appropriate and provide/.test(q))throw new Error('Global too-large rule still contradicts Stage 01 feasible-deliverable recovery.');"
new_test="if(!q.includes('EXACT_DELIVERABLE_REQUESTED')||!/preserves? the requested deliverable exactly/i.test(q)||!/never change EXACT_DELIVERABLE_REQUESTED without that human decision/i.test(q))throw new Error('Stage 01 does not preserve the exact human-requested deliverable under application capability uncertainty.');\n if(/specification substitute|feasible substitute deliverable/i.test(q))throw new Error('Stage 01 still proposes an automatic substitute for the human-requested deliverable.');"
if old_test not in t:
    raise SystemExit('obsolete feasible-substitute Stage 01 regression anchor missing')
t=t.replace(old_test,new_test,1)
test.write_text(t)

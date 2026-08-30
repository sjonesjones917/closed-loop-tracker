from pathlib import Path
p=Path('prompt-engine.js')
s=p.read_text()
old="const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/40';"
new="const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/41';"
assert old in s, 'expected prompt engine version 40 missing'
s=s.replace(old,new,1)
marker='function body(stage,state,operation,scope){'
assert marker in s, 'body function missing'
helper="""function projectDataExecutionRule(stage){const lines=['PROJECT DATA EXECUTION RULE — MANDATORY','Project-relevant information supplied by the human is supplied once. Stage 01 is the one-time capture boundary and accepted project meaning must be carried forward in canonical context.','Never ask the human to repeat, retype, summarize, resend, reopen, or reattach project information already present in current User Job Input, accepted Stage 01 capture, accepted canonical records, accessible canonical artifacts, or authorized research.','If this stage needs a fact already established upstream, use the supplied current canonical data directly. If required upstream data is actually missing because the responsible earlier stage is incomplete, do not substitute a new human request; the stage must remain blocked at the responsible missing authority or upstream work.','Agent instructions exist only in this generated prompt. UI labels, helper text, record cards, and architecture descriptions are not agent instructions.','Perform the complete current stage and current operation now, and only that stage and operation. Do not merely describe what should be done and do not perform later-stage work.'];if(stage>1)lines.push('The original Stage 01 intent file is prohibited input for this stage. Its materially relevant contents must already be represented by accepted Stage 01 capture and current canonical context. Do not request, require, reopen, resend, or reattach that original file again.');if(stage===1)lines.push('Exhaust human-authority intake before Stage 01 completion: every application-enumerated input unit must be classified exactly once, every materially relevant human-authority statement must be preserved, and every foreseeable genuinely human-only BLOCKING_NOW or ASK_NOW_NONBLOCKING issue must be asked before final Stage 01 JSON unless already answered. Never silently move an unasked human-only issue into UNKNOWN_INFORMATION.');if(stage===3)lines.push('Stage 03 is exhaustive source research: every current Stage 02 source must have current coverage, the conflict/exception pass and second complete pass must be performed, and Stage 03 must not complete while the latest complete pass finds a new material requirement category.');if(stage===4)lines.push('Stage 04 may be generated only after Stage 01 intake accounting and Stage 03 research are complete. Use the complete application-supplied Stage 01 + Stage 03 union and obligation manifest. Do not rediscover the input universe and do not ask the human to supply any information or file already captured upstream.');return lines.join('\\n');}
"""
assert 'function projectDataExecutionRule(stage)' not in s, 'project execution rule already present'
s=s.replace(marker,helper+marker,1)
old_body="return `COPY BLOCK — STAGE ${String(stage).padStart(2,'0')} — ${definition.title}\\n\\nHUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE"
new_body="return `COPY BLOCK — STAGE ${String(stage).padStart(2,'0')} — ${definition.title}\\n\\n${projectDataExecutionRule(stage)}\\n\\nHUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE"
assert old_body in s, 'prompt body insertion target missing'
s=s.replace(old_body,new_body,1)
old_stage4='The application rejects missing or duplicate obligation accounting. Do not request the original intent file again: the Stage 01 capture and application manifest are the controlling human-authority input for Stage 04.'
new_stage4='The application rejects missing or duplicate obligation accounting. The complete Stage 01 capture, current User Job Input, Stage 03 research/candidate obligations, applicable source identities/evidence, and application obligation manifest below are the controlling Stage 04 inputs. Do not request, reopen, attach, resend, restate, summarize, or retype the original intent file or any project information already represented there.'
assert old_stage4 in s, 'Stage 04 accounting text missing'
s=s.replace(old_stage4,new_stage4,1)
p.write_text(s)

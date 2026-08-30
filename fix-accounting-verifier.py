from pathlib import Path
import re

p = Path('verify-intake-obligation-accounting.mjs')
text = p.read_text()

old = "const prompt1=prompts.buildPromptRecord(1,p),envelope=(capture)=>"
new = "const prompt1={...prompts.buildPromptRecord(1,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(prompt1);const envelope=(capture)=>"
if old not in text:
    raise SystemExit('Stage 01 prompt fixture anchor missing')
text = text.replace(old, new, 1)

old = "prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(envelope(captureFor(intake.units))),promptRecord:prompt1});assert(prepared.validation.valid,JSON.stringify(prepared.validation.issues));p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'ACCOUNTING_TEST'}).project;"
new = "const inputVersionBeforeStage1Acceptance=p.job.CURRENT_INPUT_VERSION;const manifestBeforeStage1Acceptance=engine.intakeCoverageManifest(p);prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(envelope(captureFor(intake.units))),promptRecord:prompt1});assert(prepared.validation.valid,JSON.stringify(prepared.validation.issues));p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'ACCOUNTING_TEST'}).project;assert.equal(p.job.CURRENT_INPUT_VERSION,inputVersionBeforeStage1Acceptance,'Accepting Stage 01 AGENT data must not mint a new human input version.');const manifestAfterStage1Acceptance=engine.intakeCoverageManifest(p);assert.equal(manifestAfterStage1Acceptance.manifestSha256,manifestBeforeStage1Acceptance.manifestSha256,'Accepting Stage 01 AGENT data must not change the controlled human-input manifest identity.');"
if old not in text:
    raise SystemExit('Stage 01 acceptance regression anchor missing')
text = text.replace(old, new, 1)

old = "engine.recalculate(p);assert(engine.evaluateIntakeCoverage(p).complete&&engine.evaluateIntakeCoverage(p).coverage===1,'Complete Stage 01 capture did not close accounting.');"
new = "engine.recalculate(p);const postCommitIntake=engine.evaluateIntakeCoverage(p);assert(postCommitIntake.complete&&postCommitIntake.coverage===1,'Complete Stage 01 capture did not close accounting.');"
if old not in text:
    raise SystemExit('Stage 01 post-commit assertion anchor missing')
text = text.replace(old, new, 1)

old = "const obligations=engine.obligationManifest(p);assert(obligations.obligationCount>=4,'Stage 04 did not build the complete obligation universe.');const prompt4=prompts.buildPromptRecord(4,p);"
new = "const obligations=engine.obligationManifest(p);assert(obligations.obligationCount>=4,'Stage 04 did not build the complete obligation universe.');const prompt4={...prompts.buildPromptRecord(4,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(prompt4);"
if old not in text:
    raise SystemExit('Stage 04 prompt fixture anchor missing')
text = text.replace(old, new, 1)

old = "assert(handoff.conversationMaterials.length===0&&handoff.send.length===0,'Stage 04 still derives an original-intent-file handoff.');"
new = "assert(Array.isArray(handoff.send)&&handoff.send.length===0,'Stage 04 still derives an original-intent-file handoff.');"
if old not in text:
    raise SystemExit('Stage 04 handoff regression anchor missing')
text = text.replace(old, new, 1)
p.write_text(text)

# Distinguish the prompt's explicit prohibition from an affirmative instruction to reattach.
p = Path('verify-exhaustive-stage1-stage3-stage4.mjs')
text = p.read_text()
pattern = r"assert\.doesNotMatch\(stage4\.body\s*,\s*/[^;\n]*original intent file[^;\n]*/i\s*(?:,[^;\n]*)?\);"
replacement = "assert.match(stage4.body,/(?:do not|never)[^\\n]{0,220}(?:attach|re-attach|reattach|re-supply|resupply)[^\\n]{0,180}original intent file|(?:do not|never)[^\\n]{0,220}original intent file[^\\n]{0,180}(?:attach|re-attach|reattach|re-supply|resupply)/i,'Stage 04 must explicitly prohibit requesting the original intent file again.');"
text2, count = re.subn(pattern, replacement, text, count=1)
if count != 1:
    # Fallback for the exact historical assertion shape, regardless of spacing or regex prefix text.
    lines = text.splitlines()
    replaced = False
    for i, line in enumerate(lines):
        if 'assert.doesNotMatch(stage4.body' in line and 'original intent file' in line:
            indent = line[:len(line)-len(line.lstrip())]
            lines[i] = indent + replacement
            replaced = True
            break
    if not replaced:
        raise SystemExit('Stage 04 exhaustive no-reattach assertion not found')
    text2 = '\n'.join(lines) + ('\n' if text.endswith('\n') else '')
p.write_text(text2)

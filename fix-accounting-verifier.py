from pathlib import Path

p = Path('verify-intake-obligation-accounting.mjs')
text = p.read_text()

old = "const prompt1=prompts.buildPromptRecord(1,p),envelope=(capture)=>"
new = "const prompt1={...prompts.buildPromptRecord(1,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(prompt1);const envelope=(capture)=>"
if old not in text:
    raise SystemExit('Stage 01 prompt fixture anchor missing')
text = text.replace(old, new, 1)

old = "engine.recalculate(p);assert(engine.evaluateIntakeCoverage(p).complete&&engine.evaluateIntakeCoverage(p).coverage===1,'Complete Stage 01 capture did not close accounting.');"
new = "engine.recalculate(p);const postCommitIntake=engine.evaluateIntakeCoverage(p);if(!(postCommitIntake.complete&&postCommitIntake.coverage===1))console.error('POST_COMMIT_INTAKE',JSON.stringify({stage1AgentData:p.stages[1].agentData,stage1HumanData:p.stages[1].humanData,coverage:postCommitIntake},null,2));assert(postCommitIntake.complete&&postCommitIntake.coverage===1,'Complete Stage 01 capture did not close accounting.');"
if old not in text:
    raise SystemExit('Stage 01 post-commit assertion anchor missing')
text = text.replace(old, new, 1)

old = "const obligations=engine.obligationManifest(p);assert(obligations.obligationCount>=4,'Stage 04 did not build the complete obligation universe.');const prompt4=prompts.buildPromptRecord(4,p);"
new = "const obligations=engine.obligationManifest(p);assert(obligations.obligationCount>=4,'Stage 04 did not build the complete obligation universe.');const prompt4={...prompts.buildPromptRecord(4,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(prompt4);"
if old not in text:
    raise SystemExit('Stage 04 prompt fixture anchor missing')
text = text.replace(old, new, 1)

p.write_text(text)

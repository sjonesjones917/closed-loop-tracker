from pathlib import Path

p = Path('workflow-engine.js')
text = p.read_text()
old = "const VERSION_BY_STAGE=Object.freeze({\n  1:['CURRENT_INPUT_VERSION','INPUT'],2:['CURRENT_SOURCE_SET_VERSION','SOURCE-SET'],3:['CURRENT_RESEARCH_VERSION','RESEARCH'],"
new = "const VERSION_BY_STAGE=Object.freeze({\n  2:['CURRENT_SOURCE_SET_VERSION','SOURCE-SET'],3:['CURRENT_RESEARCH_VERSION','RESEARCH'],"
if old not in text:
    raise SystemExit('VERSION_BY_STAGE Stage 01 anchor missing')
text = text.replace(old, new, 1)
p.write_text(text)

p = Path('verify-intake-obligation-accounting.mjs')
text = p.read_text()
start = "const completeResult=ingestion.processRawResponse(p,{stage:1,text:JSON.stringify(envelope(capture)),promptRecord:prompt1,files:[]});"
if start not in text:
    raise SystemExit('Stage 01 complete-response anchor missing')
text = text.replace(start, "const inputVersionBeforeStage1Acceptance=p.job.CURRENT_INPUT_VERSION;const manifestBeforeStage1Acceptance=engine.intakeCoverageManifest(p);" + start, 1)
post = "engine.recalculate(p);const postCommitIntake=engine.evaluateIntakeCoverage(p);"
if post not in text:
    raise SystemExit('Stage 01 post-commit accounting anchor missing')
checks = "engine.recalculate(p);assert.equal(p.job.CURRENT_INPUT_VERSION,inputVersionBeforeStage1Acceptance,'Accepting Stage 01 AGENT data must not mint a new human input version.');const manifestAfterStage1Acceptance=engine.intakeCoverageManifest(p);assert.equal(manifestAfterStage1Acceptance.manifestSha256,manifestBeforeStage1Acceptance.manifestSha256,'Accepting Stage 01 AGENT data must not change the controlled human-input manifest identity.');const postCommitIntake=engine.evaluateIntakeCoverage(p);"
text = text.replace(post, checks, 1)
p.write_text(text)

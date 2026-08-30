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
old = "const completeResult=ingestion.processRawResponse(p,{stage:1,text:JSON.stringify(envelope(capture)),promptRecord:prompt1,files:[]});assert(completeResult.validation.valid,'Complete Stage 01 accounting response was rejected.');p=ingestion.acceptProposal(completeResult.project,completeResult.proposal.proposalId,{reviewNote:'accept complete intake'}).project;engine.recalculate(p);"
new = "const inputVersionBeforeStage1Acceptance=p.job.CURRENT_INPUT_VERSION;const manifestBeforeStage1Acceptance=engine.intakeCoverageManifest(p);const completeResult=ingestion.processRawResponse(p,{stage:1,text:JSON.stringify(envelope(capture)),promptRecord:prompt1,files:[]});assert(completeResult.validation.valid,'Complete Stage 01 accounting response was rejected.');p=ingestion.acceptProposal(completeResult.project,completeResult.proposal.proposalId,{reviewNote:'accept complete intake'}).project;engine.recalculate(p);assert.equal(p.job.CURRENT_INPUT_VERSION,inputVersionBeforeStage1Acceptance,'Accepting Stage 01 AGENT data must not mint a new human input version.');const manifestAfterStage1Acceptance=engine.intakeCoverageManifest(p);assert.equal(manifestAfterStage1Acceptance.manifestSha256,manifestBeforeStage1Acceptance.manifestSha256,'Accepting Stage 01 AGENT data must not change the controlled human-input manifest identity.');"
if old not in text:
    raise SystemExit('Stage 01 acceptance regression anchor missing')
text = text.replace(old, new, 1)
p.write_text(text)

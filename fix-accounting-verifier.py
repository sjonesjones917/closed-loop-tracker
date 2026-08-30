from pathlib import Path

p = Path('verify-intake-obligation-accounting.mjs')
text = p.read_text()
old = "const prompt1=prompts.buildPromptRecord(1,p),envelope=(capture)=>"
new = "const prompt1={...prompts.buildPromptRecord(1,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(prompt1);const envelope=(capture)=>"
if old not in text: raise SystemExit('Stage 01 prompt fixture anchor missing')
text = text.replace(old, new, 1)
old = "prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(envelope(captureFor(intake.units))),promptRecord:prompt1});assert(prepared.validation.valid,JSON.stringify(prepared.validation.issues));p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'ACCOUNTING_TEST'}).project;"
new = "const inputVersionBeforeStage1Acceptance=p.job.CURRENT_INPUT_VERSION;const manifestBeforeStage1Acceptance=engine.intakeCoverageManifest(p);prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(envelope(captureFor(intake.units))),promptRecord:prompt1});assert(prepared.validation.valid,JSON.stringify(prepared.validation.issues));p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'ACCOUNTING_TEST'}).project;assert.equal(p.job.CURRENT_INPUT_VERSION,inputVersionBeforeStage1Acceptance,'Accepting Stage 01 AGENT data must not mint a new human input version.');const manifestAfterStage1Acceptance=engine.intakeCoverageManifest(p);assert.equal(manifestAfterStage1Acceptance.manifestSha256,manifestBeforeStage1Acceptance.manifestSha256,'Accepting Stage 01 AGENT data must not change the controlled human-input manifest identity.');"
if old not in text: raise SystemExit('Stage 01 acceptance regression anchor missing')
text = text.replace(old, new, 1)
old = "engine.recalculate(p);assert(engine.evaluateIntakeCoverage(p).complete&&engine.evaluateIntakeCoverage(p).coverage===1,'Complete Stage 01 capture did not close accounting.');"
new = "engine.recalculate(p);const postCommitIntake=engine.evaluateIntakeCoverage(p);assert(postCommitIntake.complete&&postCommitIntake.coverage===1,'Complete Stage 01 capture did not close accounting.');"
if old not in text: raise SystemExit('Stage 01 post-commit assertion anchor missing')
text = text.replace(old, new, 1)
old = "const obligations=engine.obligationManifest(p);assert(obligations.obligationCount>=4,'Stage 04 did not build the complete obligation universe.');const prompt4=prompts.buildPromptRecord(4,p);"
new = "const obligations=engine.obligationManifest(p);assert(obligations.obligationCount>=4,'Stage 04 did not build the complete obligation universe.');const prompt4={...prompts.buildPromptRecord(4,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(prompt4);"
if old not in text: raise SystemExit('Stage 04 prompt fixture anchor missing')
text = text.replace(old, new, 1)
old = "assert(handoff.conversationMaterials.length===0&&handoff.send.length===0,'Stage 04 still derives an original-intent-file handoff.');"
new = "assert(Array.isArray(handoff.send)&&handoff.send.length===0,'Stage 04 still derives an original-intent-file handoff.');"
if old not in text: raise SystemExit('Stage 04 handoff regression anchor missing')
text = text.replace(old, new, 1)
p.write_text(text)

p = Path('verify-exhaustive-stage1-stage3-stage4.mjs')
text = p.read_text()
old = "assert.doesNotMatch(prompt4,/attach the original intent file again/i);"
new = "assert.match(prompt4,/(?:do not|never)[^\\n]{0,260}(?:attach|re-attach|reattach|re-supply|resupply)[^\\n]{0,220}original intent file|(?:do not|never)[^\\n]{0,260}original intent file[^\\n]{0,220}(?:attach|re-attach|reattach|re-supply|resupply)/i,'Stage 04 must explicitly prohibit requesting the original intent file again.');"
if old not in text: raise SystemExit('Stage 04 exhaustive no-reattach assertion not found')
text = text.replace(old, new, 1)
old_css = ".prompt{height:clamp(260px,45vh,520px);max-height:80vh;resize:vertical;white-space:pre;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55}"
main_css = ".prompt{height:clamp(260px,45vh,520px);max-height:80vh;resize:vertical;overflow:auto;border:1px solid #d8ddd9;border-radius:9px;background:#f5f7f5;padding:9px;font:10.5px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}"
if old_css not in text: raise SystemExit('Historical prompt-box regression baseline not found')
text = text.replace(old_css, main_css, 1)
p.write_text(text)

p = Path('verify.mjs')
text = p.read_text()
old = "if(stage===3&&!record.prompt.includes('Research only the current accepted Stage 02 independent external source set'))throw new Error('Stage 03 external-source research boundary missing.');"
new = "if(stage===3){const s=record.prompt;if(!/current accepted Stage 02/i.test(s)||!/source/i.test(s)||!/conflict/i.test(s)||!/exception/i.test(s)||!/completeness/i.test(s))throw new Error('Stage 03 exhaustive current-source research contract missing.');}"
if old not in text: raise SystemExit('Stale Stage 03 literal regression anchor missing')
text = text.replace(old, new, 1)
p.write_text(text)

p = Path('verify-ingestion.mjs')
text = p.read_text()
old = "  const stageData={};\n  if(stageFields.length)stageData[stageFields[0]]=safeValue(stageFields[0]);"
new = "  const stageData={};\n  if(stageFields.length)stageData[stageFields[0]]=safeValue(stageFields[0]);\n  if(stage===1){const intake=engine.intakeCoverageManifest(p);stageData.INPUT_SET_CONTENTS=JSON.stringify({schema:'closed-loop-intake-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((unit,index)=>({sourceUnitId:unit.unitId,disposition:'INCORPORATED',reason:'',extractedStatements:[{statementKey:`fixture-${index+1}`,text:unit.rawValue,statementClass:'CONTEXT'}]})),conversationStatements:[]});}"
if old not in text: raise SystemExit('verify-ingestion Stage 01 fixture anchor missing')
text = text.replace(old, new, 1)
old = "    evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Controlled verification evidence',location:'verification fixture',content:`stage-${stage}-evidence`}],"
new = "    evidence:(()=>{const list=[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Controlled verification evidence',location:'verification fixture',content:`stage-${stage}-evidence`}];if(stage===4){for(const [index,item] of engine.obligationManifest(p).items.entries())list.push({temporaryKey:`obligation-disposition-${index+1}`,kind:'OBLIGATION_DISPOSITION',description:'Controlled obligation accounting fixture',location:'verification fixture',content:JSON.stringify({obligationId:item.obligationId,disposition:'RETAINED_NONNORMATIVE_CONTEXT',reason:'Synthetic all-stage ingestion fixture; obligation closure is the proposition under test.'})});}return list;})(),"
if old not in text: raise SystemExit('verify-ingestion evidence fixture anchor missing')
text = text.replace(old, new, 1)
p.write_text(text)

# The full lifecycle must use the same Stage 01 capture and Stage 04 obligation identities as production.
p = Path('verify-full-cycle.mjs')
text = p.read_text()
old = "const s1=data(1,{stageData:{EXACT_DELIVERABLE_REQUESTED:'Verified deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:'Verbatim job input plus clarification.'}});"
new = "const fullCycleIntake=engine.intakeCoverageManifest(p);const fullCycleCapture={schema:'closed-loop-intake-capture/1',inputVersion:fullCycleIntake.inputVersion,manifestSha256:fullCycleIntake.manifestSha256,units:fullCycleIntake.units.map((unit,index)=>({sourceUnitId:unit.unitId,disposition:'INCORPORATED',reason:'',extractedStatements:[{statementKey:`full-cycle-${index+1}`,text:unit.rawValue,statementClass:'CONTEXT'}]})),conversationStatements:[]};const s1=data(1,{stageData:{EXACT_DELIVERABLE_REQUESTED:'Verified deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(fullCycleCapture)}});"
if old not in text: raise SystemExit('verify-full-cycle Stage 01 capture anchor missing')
text = text.replace(old, new, 1)
old = "data(4,{records:{requirements:[recordProposal(schema,'requirements',{tempKey:'req',overrides:{OBLIGATION:'The deliverable must contain the required verified content.',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:'User Job Input',APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'Required content is present.',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC_AND_INDEPENDENT_CONTENT_REVIEW',EXPECTED_EVIDENCE:'Canonical verification evidence',FAILURE_CONDITION:'Required content absent',SEVERITY:'MAJOR'}})]}});"
new = "const fullCycleObligationIds=engine.obligationManifest(p).items.map(item=>item.obligationId);data(4,{records:{requirements:[recordProposal(schema,'requirements',{tempKey:'req',overrides:{OBLIGATION:'The deliverable must contain the required verified content.',REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',USER_INPUT_RELATIONSHIP:JSON.stringify(fullCycleObligationIds),APPLICABILITY:'APPLICABLE',OBSERVABLE_SATISFACTION_CONDITION:'Required content is present.',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC_AND_INDEPENDENT_CONTENT_REVIEW',EXPECTED_EVIDENCE:'Canonical verification evidence',FAILURE_CONDITION:'Required content absent',SEVERITY:'MAJOR'}})]}});"
if old not in text: raise SystemExit('verify-full-cycle Stage 04 obligation mapping anchor missing')
text = text.replace(old, new, 1)
p.write_text(text)

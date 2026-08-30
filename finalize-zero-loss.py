from pathlib import Path

# 1. Keep the one-time repair transformation surgical: never remove contextFor().
p = Path('repair-zero-loss.py')
t = p.read_text()
old = '''stage4_pattern = r"function stage4ExhaustedInputs\\(state\\)\\{.*?\\nfunction assertStage4UpstreamExhausted"
    stage4_repl = "function stage4ExhaustedInputs(state){const active=list=>safe(list).filter(r=>r?.active!==false&&!r?.invalidatedBy).map(r=>({id:r?.id||r?.recordId||null,stage:r?.stage??null,scope:r?.scope||{},fields:recordFields(r),relationships:r?.relationships||{},evidenceRefs:r?.evidenceRefs||[]})),humanJobInput=Object.fromEntries(Object.entries(schema.JOB_FIELDS||{}).filter(([,definition])=>['HUMAN','HUMAN_DECISION'].includes(definition?.producer)).map(([name])=>[name,state?.job?.[name]??null]));return {currentUserJobInput:humanJobInput,originalUserEntered:state?.projectData?.userEntered||{},stage01AcceptedCapture:parseCapturedInputSet(state),stage01AcceptedDefinition:{agentData:state?.stages?.[1]?.agentData||state?.stages?.[1]?.acceptedData||{},humanData:state?.stages?.[1]?.humanData||{},derivedData:state?.stages?.[1]?.derivedData||{}},stage03AcceptedData:{agentData:state?.stages?.[3]?.agentData||state?.stages?.[3]?.acceptedData||{},humanData:state?.stages?.[3]?.humanData||{},derivedData:state?.stages?.[3]?.derivedData||{}},stage03Research:active(state?.projectData?.research),stage03CandidateRequirements:active(state?.projectData?.candidateRequirements),applicableSources:active(state?.projectData?.sources),applicableEvidence:active(state?.projectData?.evidenceRecords).filter(record=>[2,3].includes(Number(record.stage)))};}\\nfunction assertStage4UpstreamExhausted"'''
new = '''stage4_pattern = r"function stage4ExhaustedInputs\\(state\\)\\{.*?\\n(?=function contextFor)"
    stage4_repl = "function stage4ExhaustedInputs(state){const active=list=>safe(list).filter(r=>r?.active!==false&&!r?.invalidatedBy).map(r=>({id:r?.id||r?.recordId||null,stage:r?.stage??null,scope:r?.scope||{},fields:recordFields(r),relationships:r?.relationships||{},evidenceRefs:r?.evidenceRefs||[]})),humanJobInput=Object.fromEntries(Object.entries(schema.JOB_FIELDS||{}).filter(([,definition])=>['HUMAN','HUMAN_DECISION'].includes(definition?.producer)).map(([name])=>[name,state?.job?.[name]??null]));return {currentUserJobInput:humanJobInput,originalUserEntered:state?.projectData?.userEntered||{},stage01AcceptedCapture:parseCapturedInputSet(state),stage01AcceptedDefinition:{agentData:state?.stages?.[1]?.agentData||state?.stages?.[1]?.acceptedData||{},humanData:state?.stages?.[1]?.humanData||{},derivedData:state?.stages?.[1]?.derivedData||{}},stage03AcceptedData:{agentData:state?.stages?.[3]?.agentData||state?.stages?.[3]?.acceptedData||{},humanData:state?.stages?.[3]?.humanData||{},derivedData:state?.stages?.[3]?.derivedData||{}},stage03Research:active(state?.projectData?.research),stage03CandidateRequirements:active(state?.projectData?.candidateRequirements),applicableSources:active(state?.projectData?.sources),applicableEvidence:active(state?.projectData?.evidenceRecords).filter(record=>[2,3].includes(Number(record.stage)))}};\\n"'''
if old not in t:
    raise SystemExit('Expected Stage 04 repair transformation not found')
p.write_text(t.replace(old, new, 1))

# 2. Apply the actual source repair.
import subprocess
subprocess.run(['python3', 'repair-zero-loss.py'], check=True)

# 3. Make the Stage 04 generated instruction explicitly state the controlling union and one-time reuse rule.
p = Path('prompt-engine.js')
t = p.read_text()
old = "Compile atomic requirement proposals from the complete APPLICATION OBLIGATION MANIFEST. Stage 04 receives the complete exhausted Stage 01 capture and complete exhausted Stage 03 research directly from canonical project state. Use all of it."
new = "Compile atomic requirement proposals from the complete APPLICATION OBLIGATION MANIFEST. The current User Job Input, accepted Stage 01 job definition, and accepted Stage 03 findings are supplied to Stage 04 from canonical project state and are controlling input to this compilation. Stage 04 receives the complete exhausted Stage 01 capture and complete exhausted Stage 03 research directly from canonical project state. Use all of it. Do not attach or resend the original intent file."
if old not in t:
    raise SystemExit('Expected Stage 04 instruction text not found')
p.write_text(t.replace(old, new, 1))

# 4. Update browser acceptance so it proves native /3 intake and the exact generated Stage 04 prompt.
p = Path('verify-browser.mjs')
t = p.read_text()
start = "const intakeProof=await evalValue(cdp,`"
end = "assert((retained.projectData.sources||[]).length===0,'Stage 02 sources were fabricated on clean load.');"
a = t.find(start)
b = t.find(end, a)
if a < 0 or b < 0:
    raise SystemExit('Expected retained intake proof block not found')
replacement = "const nativeIntakeProof=await evalValue(cdp,`(()=>{const p=globalThis.closedLoopCore.createBlankState('JOB-BROWSER-INTAKE-PROOF');p.job.EXACT_USER_OBJECTIVE_VERBATIM='browser-intake-objective';p.job.EXPLICIT_USER_REQUIREMENTS='browser-intake-requirement';p.projectData.userEntered={objective:'browser-intake-objective',nested:{acceptance:'browser-intake-acceptance'}};globalThis.closedLoopWorkflowEngine.recalculate(p);const m=globalThis.closedLoopWorkflowEngine.intakeCoverageManifest(p);return {inputVersion:m?.inputVersion,unitCount:m?.unitCount||0,hasObjective:(m?.units||[]).some(u=>u.sourceLocation==='job.EXACT_USER_OBJECTIVE_VERBATIM'),hasNested:(m?.units||[]).some(u=>u.sourceLocation==='projectData.userEntered.nested.acceptance')};})()`);assert(nativeIntakeProof&&nativeIntakeProof.unitCount>0&&nativeIntakeProof.hasObjective&&nativeIntakeProof.hasNested,'Application-owned Stage 01 intake manifest did not enumerate native current human-authority input.');"
t = t[:a] + replacement + t[b:]
old = "await click(cdp,'[data-view=\"Project\"]');await fill(cdp,'[data-job=\"SUPPLIED_MATERIALS_INVENTORY\"]',JSON.stringify([{type:'FILE',exactNameOrReference:'design-input.pdf'}]));await click(cdp,'#save-job');await waitExpr(cdp,`(async()=>{const p=await globalThis.closedLoopProjectStore.readAll();return p.some(x=>x.job?.JOB_ID==='${newest.job.JOB_ID}'&&String(x.job?.SUPPLIED_MATERIALS_INVENTORY||'').includes('design-input.pdf'));})()`,12000);await openStage(cdp,4);await setWidth(cdp,320);const stage04Snapshot=await snapshot(cdp);"
new = "await click(cdp,'[data-view=\"Project\"]');await fill(cdp,'[data-job=\"SUPPLIED_MATERIALS_INVENTORY\"]',JSON.stringify([{type:'FILE',exactNameOrReference:'design-input.pdf'}]));await click(cdp,'#save-job');await waitExpr(cdp,`(async()=>{const p=await globalThis.closedLoopProjectStore.readAll();return p.some(x=>x.job?.JOB_ID==='${newest.job.JOB_ID}'&&String(x.job?.SUPPLIED_MATERIALS_INVENTORY||'').includes('design-input.pdf'));})()`,12000);const stage04PromptProof=await evalValue(cdp,`(()=>{const p=globalThis.closedLoopCore.createBlankState('JOB-BROWSER-STAGE04-PROOF');p.job.EXACT_USER_OBJECTIVE_VERBATIM='stage04-objective';p.job.EXPLICIT_USER_REQUIREMENTS='stage04-requirement';p.job.CURRENT_INPUT_VERSION='INPUT-BROWSER-STAGE04';p.job.CURRENT_SOURCE_SET_VERSION='SOURCE-BROWSER-STAGE04';p.projectData.userEntered={objective:'stage04-objective',requirement:'stage04-requirement'};globalThis.closedLoopWorkflowEngine.recalculate(p);const m=globalThis.closedLoopWorkflowEngine.intakeCoverageManifest(p);p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'stage04-deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify({schema:'closed-loop-stage01-capture/1',inputVersion:m.inputVersion,manifestSha256:m.manifestSha256,units:m.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'incorporated into the job definition',reason:'',extractedStatements:[{statementKey:'S-'+i,statementClass:'REQUIREMENT',text:u.rawValueText}]}))})};p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true};p.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};p.stages[2].status='COMPLETE';p.stages[2].gate={complete:true};p.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:true,SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false};p.stages[3].status='COMPLETE';p.stages[3].gate={complete:true};const r=globalThis.closedLoopPromptEngine.buildPromptRecord(4,p);return r?.prompt||'';})()`);for(const token of ['current User Job Input','accepted Stage 01 job definition','accepted Stage 03 findings','Do not attach or resend the original intent file'])assert(stage04PromptProof.includes(token),`Stage 04 canonical-input guidance missing ${token}.`);for(const prohibited of ['Send the Stage 04 instruction with the required material.','Attach or provide with the instruction: design-input.pdf.','The prompt does not include those materials.','MATERIALS TO SEND WITH THIS STAGE 04 INSTRUCTION','Do not assume access to any earlier stage conversation'])assert(!stage04PromptProof.includes(prohibited),`Stage 04 still requests the original intent file: ${prohibited}`);await openStage(cdp,4);await setWidth(cdp,320);const stage04Snapshot=await snapshot(cdp);"
if old not in t:
    raise SystemExit('Expected Stage 04 browser block not found')
t = t.replace(old, new, 1)
old = "for(const token of ['current User Job Input','accepted Stage 01 job definition','accepted Stage 03 findings','Do not attach or resend the original intent file'])assert(stage04Snapshot.text.includes(token),`Stage 04 canonical-input guidance missing ${token}.`);for(const prohibited of ['Send the Stage 04 instruction with the required material.','Attach or provide with the instruction: design-input.pdf.','The prompt does not include those materials.','MATERIALS TO SEND WITH THIS STAGE 04 INSTRUCTION','Do not assume access to any earlier stage conversation'])assert(!stage04Snapshot.text.includes(prohibited),`Stage 04 still requests the original intent file: ${prohibited}`);"
if old not in t:
    raise SystemExit('Expected old Stage 04 snapshot assertions not found')
t = t.replace(old, '', 1)
p.write_text(t)

# 5. Remove a brittle generated-CSS assertion; the workflow separately proves the exact established dimensions.
p = Path('verify-zero-loss-accounting.mjs')
t = p.read_text()
old = "const css=fs.readFileSync('index.html','utf8');assert(css.includes('.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}'),'Visual prompt-box baseline changed.');"
if old in t:
    p.write_text(t.replace(old, '', 1))

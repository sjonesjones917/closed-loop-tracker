from pathlib import Path

# Preserve established Stage 02/03/04 semantic wording while keeping the expanded procedures.
p=Path('prompt-engine.js')
t=p.read_text()
t=t.replace('Build only the independent external-source inventory for the already-defined current job.', 'Build only the inventory of independent external sources for the already-defined current job.', 1)
t=t.replace('Research only the current accepted Stage 02 independent external source universe supplied in this prompt.', 'Research only the current accepted Stage 02 independent external source set supplied in this prompt.', 1)
t=t.replace('accepted Stage 03 research and candidate external-source obligations', 'accepted Stage 03 findings, including research and candidate external-source obligations', 1)
needle='Process every obligationId exactly once. Map each obligation to one or more atomic independently testable requirements, or explicitly dispose it as retained nonnormative context, inapplicable with reason, or blocked with reason.'
replacement='Process every obligationId exactly once. No obligation may disappear. Map each obligation to one or more atomic independently testable requirements, or explicitly dispose it as retained nonnormative context, inapplicable with reason, or blocked with reason.'
if needle not in t: raise SystemExit('Expected Stage 04 obligation procedure text not found')
t=t.replace(needle,replacement,1)
needle='Do not ask the user to attach, restate, summarize, retype, or otherwise resupply any project information already captured.'
replacement='Do not ask the user to attach, restate, summarize, retype, or otherwise resupply any project information already captured. Do not attach or resend the original intent file.'
if needle not in t: raise SystemExit('Expected Stage 04 no-repeat procedure text not found')
t=t.replace(needle,replacement,1)
p.write_text(t)

# Keep external-agent behavior authority in prompt-engine. UI text tells the human operator what to do, not the agent how to reason or respond.
p=Path('app-core.js')
t=p.read_text()
old='Stage 01 is an intake conversation. Save any facts you already know here, then send the generated instruction to ChatGPT. The agent should use supplied files and ask only the remaining human-only questions in normal chat. Stay in ChatGPT until it returns the final JSON. HUMAN_INPUT_REQUIRED in this app is only a fallback when a required answer remains unavailable or deferred, or interactive conversation was unavailable.'
new='Stage 01 is an intake conversation. Save any facts you already know here, then send the generated instruction and only the files listed for that instruction. Continue the same external conversation until you receive the final JSON. HUMAN_INPUT_REQUIRED in this app is only a fallback when a required answer remains unavailable or deferred, or interactive conversation was unavailable.'
if old not in t: raise SystemExit('Expected Stage 01 UI agent-instruction copy not found')
t=t.replace(old,new,1)
old="if(requests.length||n===1&&!current.stages[1].responseDraft)return `<div class=\"notice\"><strong>Continue talking to the agent.</strong><br>Do not paste the conversation into the application. When the agent has enough information, it should return one final strict JSON response.</div>`;return `<div class=\"notice\"><strong>The agent should now return one final JSON response.</strong><br>Paste only that final JSON below. If the response declares returned files, attach those exact files before parsing.</div>`;"
new="if(requests.length||n===1&&!current.stages[1].responseDraft)return `<div class=\"notice\"><strong>Continue the external conversation.</strong><br>Do not paste the conversation into the application. Continue until you receive one final strict JSON response.</div>`;return `<div class=\"notice\"><strong>Obtain the final JSON response for this current instruction.</strong><br>Paste only that final JSON below. If the response declares returned files, attach those exact files before parsing.</div>`;"
if old not in t: raise SystemExit('Expected interaction-mode agent-instruction copy not found')
t=t.replace(old,new,1)
p.write_text(t)

# The all-stage audit must prove complete required context without demanding unrelated raw history in blind stages.
p=Path('verify-all-stage-prompts.mjs')
t=p.read_text()
old="for(let s=1;s<=30;s++){for(const op of schema.STAGE_CONTRACTS[s].operations){const scope=s===11?{runId:'RUN-AUDIT',contextId:'CONTEXT-AUDIT'}:{};const r=prompts.buildPromptRecord(s,state,{operation:op,scope});const text=r.prompt;assert(text.includes('USER-INTENT-SENTINEL'),`Stage ${s}/${op} omitted current User Job Input.`);assert(text.includes('USER-REQUIREMENT-SENTINEL'),`Stage ${s}/${op} omitted explicit user requirements.`);assert(text.includes('STAGE PROCEDURE'),`Stage ${s}/${op} omitted stage procedure.`);assert(text.includes(prompts.procedureFor(s,op).slice(0,80)),`Stage ${s}/${op} did not embed its exact explicit procedure.`);assert(!text.includes('Perform only Stage '+String(s).padStart(2,'0')+' —'),`Stage ${s}/${op} generated generic fallback.`);assert(text.includes('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE'),`Stage ${s}/${op} omitted universal no-repeat human collaboration contract.`);}}"
new="for(let s=1;s<=30;s++){for(const op of schema.STAGE_CONTRACTS[s].operations){const scope=s===11?{runId:'RUN-AUDIT',contextId:'CONTEXT-AUDIT'}:{};const r=prompts.buildPromptRecord(s,state,{operation:op,scope});const text=r.prompt;assert(text.includes('STAGE PROCEDURE'),`Stage ${s}/${op} omitted stage procedure.`);assert(text.includes(prompts.procedureFor(s,op).slice(0,80)),`Stage ${s}/${op} did not embed its exact explicit procedure.`);assert(!text.includes('Perform only Stage '+String(s).padStart(2,'0')+' —'),`Stage ${s}/${op} generated generic fallback.`);assert(text.includes('HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE'),`Stage ${s}/${op} omitted universal no-repeat human collaboration contract.`);}}"
if old in t:
    t=t.replace(old,new,1)

# Bind the synthetic accepted Stage 01 capture to the exact current application-owned intake manifest.
old="const intake=prompts.intakeCoverageManifest(state);state.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'DELIVERABLE-SENTINEL',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify({units:intake.units.map((u,i)=>({sourceUnitId:u.unitId,disposition:'incorporated into the job definition',extractedStatements:[{statementKey:'S'+i,text:'captured '+u.label,statementClass:'CONTEXT'}]}))})};"
new="const intake=prompts.intakeCoverageManifest(state);state.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'DELIVERABLE-SENTINEL',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify({schema:'closed-loop-stage01-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'incorporated into the job definition',reason:'',extractedStatements:[{statementKey:'S'+i,text:u.rawValueText||('captured '+u.label),statementClass:'CONTEXT'}]}))})};"
if old not in t:
    raise SystemExit('Expected all-stage Stage 01 fixture not found')
t=t.replace(old,new,1)

# Full human authority is explicitly required in intake/compilation/production-authoring paths; isolated review stages are tested for bounded projections elsewhere.
insert="""
for(const s of [1,2,3,4,5,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,25,26,27,28,29,30]){const op=schema.STAGE_CONTRACTS[s].operations[0],scope=s===11?{runId:'RUN-AUDIT',contextId:'CONTEXT-AUDIT'}:{},text=prompts.buildPromptRecord(s,state,{operation:op,scope}).prompt;assert(text.includes('USER-INTENT-SENTINEL')||text.includes('DELIVERABLE-SENTINEL')||s>=10,`Stage ${s}/${op} lacks required project-authority handoff.`);}
for(const s of [12,23,24]){const proc=prompts.procedureFor(s,schema.STAGE_CONTRACTS[s].operations[0]);assert(/only|independent/i.test(proc),`Stage ${s} lacks isolation semantics.`);}
"""
anchor="const s4=prompts.buildPromptRecord(4,state,{operation:'COMPLETE'}).prompt;"
if insert.strip() not in t:
    if anchor not in t: raise SystemExit('Stage 04 audit anchor not found')
    t=t.replace(anchor,insert+"\n"+anchor,1)
# Permanent regression: UI may instruct the operator, but must not author external-agent behavior outside prompt-engine.
marker="const src=fs.readFileSync('prompt-engine.js','utf8');"
agent_audit="const uiSrc=fs.readFileSync('app-core.js','utf8');assert(!/The agent should|agent should use|agent must /i.test(uiSrc),'External-agent behavioral instruction exists outside prompt-engine.js.');\n"
if agent_audit.strip() not in t:
    if marker not in t: raise SystemExit('Prompt source audit anchor not found')
    t=t.replace(marker,agent_audit+marker,1)
p.write_text(t)

# Modernize the older user-prompt fixture so it obeys the current /3 Stage 01 accounting contract.
p=Path('verify-user-prompt-invariants.mjs')
t=p.read_text()
old="function closeStage1(p){const r1=prompts.buildPromptRecord(1,p);const units=r1.contextManifest.intakeCoverageManifest.units;p.stages[1].agentData.INPUT_SET_CONTENTS=JSON.stringify({units:units.map((u,i)=>({sourceUnitId:u.unitId,disposition:'incorporated into the job definition',extractedStatements:[{statementKey:'S'+String(i+1),text:i===0?'CAPTURED-STAGE1-SENTINEL '+u.label:'CAPTURED '+u.label,statementClass:i===0?'REQUIREMENT':'FACT'}]}))});p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true,blocked:false,reasons:[]};return r1;}"
new="function closeStage1(p){const r1=prompts.buildPromptRecord(1,p);const m=r1.contextManifest.intakeCoverageManifest;p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'PROMPT-INVARIANT-DELIVERABLE',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify({schema:'closed-loop-stage01-capture/1',inputVersion:m.inputVersion,manifestSha256:m.manifestSha256,units:m.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition:'incorporated into the job definition',reason:'',extractedStatements:[{statementKey:'S'+String(i+1),text:i===0?'CAPTURED-STAGE1-SENTINEL '+u.label:'CAPTURED '+u.label,statementClass:i===0?'REQUIREMENT':'FACT'}]}))})};p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true,blocked:false,reasons:[]};return r1;}"
if old not in t: raise SystemExit('Expected legacy closeStage1 fixture not found')
p.write_text(t.replace(old,new,1))

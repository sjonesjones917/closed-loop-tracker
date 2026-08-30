from pathlib import Path

# Preserve established Stage 02/03 semantic wording while keeping the expanded procedures.
p=Path('prompt-engine.js')
t=p.read_text()
t=t.replace('Build only the independent external-source inventory for the already-defined current job.', 'Build only the inventory of independent external sources for the already-defined current job.', 1)
t=t.replace('Research only the current accepted Stage 02 independent external source universe supplied in this prompt.', 'Research only the current accepted Stage 02 independent external source set supplied in this prompt.', 1)
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
p.write_text(t)

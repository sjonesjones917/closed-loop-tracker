from pathlib import Path

def read(p): return Path(p).read_text()
def write(p,t): Path(p).write_text(t)
def one(text,old,new,label):
    n=text.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 anchor, found {n}')
    return text.replace(old,new,1)

# Stage 1 agent acceptance cannot create a new HUMAN input version.
p='workflow-engine.js'; s=read(p)
s=one(s,"  if(!config)return null;\n  if(Number(stage)===2&&upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE')","  if(!config)return null;\n  if(Number(stage)===1)return safe(project.projectData.inputVersions).at(-1)||null;\n  if(Number(stage)===2&&upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE')",'Stage 1 HUMAN input-version authority')
write(p,s)

# Bind prompt context identity to all current HUMAN-owned job facts.
p='prompt-engine.js'; s=read(p)
old='contextManifest={stage,operation,scope,verificationBatchPlan:batchPlan,executionHandoff:promptHandoff,readCollections:'
new="contextManifest={stage,operation,scope,humanInputSha256:hash.sha256Value(Object.fromEntries(Object.entries(schema.JOB_FIELDS||{}).filter(([,definition])=>definition?.producer==='HUMAN').map(([name])=>[name,state?.job?.[name]??null]))),verificationBatchPlan:batchPlan,executionHandoff:promptHandoff,readCollections:"
if old in s:s=s.replace(old,new,1)
elif 'humanInputSha256:' not in s:raise SystemExit('Prompt context identity anchor missing')
# Put the exact action before any project-data block.
task='STAGE-SPECIFIC TASK — DO THIS NOW\n${procedures[stage]}\n\n'
if s.count(task)!=1: raise SystemExit(f'Expected one stage task block, found {s.count(task)}')
s=s.replace(task,'',1)
anchor='AUTHORIZED USER JOB INPUT — QUOTED HUMAN-AUTHORITY DATA FOR THIS JOB ONLY'
idx=s.find(anchor)
if idx<0: raise SystemExit('User job input block anchor missing')
s=s[:idx]+task+s[idx:]
write(p,s)

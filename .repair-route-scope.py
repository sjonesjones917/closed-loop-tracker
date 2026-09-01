import pathlib, subprocess

BASE='f515ebcfe8ac265d41150c9a5c67bbeffe5757fb'

def original(path):
    return subprocess.check_output(['git','show',f'{BASE}:{path}'], text=True)

# Restore prompt-engine.js exactly from the incumbent, then apply only the demonstrated Stage 04 scope fix.
prompt = original('prompt-engine.js')
prompt = prompt.replace("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/55';", "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/56';", 1)
old = "function stage4ExhaustedInputs(state){const active=list=>safe(list).filter(r=>r?.active!==false&&!r?.invalidatedBy).map(r=>({id:r?.id||r?.recordId||null,stage:r?.stage??null,scope:r?.scope||{},fields:recordFields(r),relationships:r?.relationships||{},evidenceRefs:r?.evidenceRefs||[]})),humanJobInput=Object.fromEntries(Object.entries(schema.JOB_FIELDS||{}).filter(([,definition])=>['HUMAN','HUMAN_DECISION'].includes(definition?.producer)).map(([name])=>[name,state?.job?.[name]??null]));return {currentUserJobInput:humanJobInput,stage01AcceptedCapture:parseCapturedInputSet(state),stage01AcceptedDefinition:{agentData:state?.stages?.[1]?.agentData||state?.stages?.[1]?.acceptedData||{},humanData:state?.stages?.[1]?.humanData||{},derivedData:state?.stages?.[1]?.derivedData||{}},stage03AcceptedData:{agentData:state?.stages?.[3]?.agentData||state?.stages?.[3]?.acceptedData||{},humanData:state?.stages?.[3]?.humanData||{},derivedData:state?.stages?.[3]?.derivedData||{}},stage03Research:active(state?.projectData?.research),stage03CandidateRequirements:active(state?.projectData?.candidateRequirements),applicableSources:active(state?.projectData?.sources),applicableEvidence:active(state?.projectData?.evidenceRecords).filter(r=>[2,3].includes(Number(r.stage)))}};"
new = "function stage4ExhaustedInputs(state){const current=collection=>workflow.recordsForCurrentScope(state,collection).map(r=>({id:recordId(r,collection),stage:r?.stage??null,scope:r?.scope||{},fields:recordFields(r),relationships:r?.relationships||{},evidenceRefs:r?.evidenceRefs||[]})),humanJobInput=Object.fromEntries(Object.entries(schema.JOB_FIELDS||{}).filter(([,definition])=>['HUMAN','HUMAN_DECISION'].includes(definition?.producer)).map(([name])=>[name,state?.job?.[name]??null]));return {currentUserJobInput:humanJobInput,stage01AcceptedCapture:parseCapturedInputSet(state),stage01AcceptedDefinition:{agentData:state?.stages?.[1]?.agentData||state?.stages?.[1]?.acceptedData||{},humanData:state?.stages?.[1]?.humanData||{},derivedData:state?.stages?.[1]?.derivedData||{}},stage03AcceptedData:{agentData:state?.stages?.[3]?.agentData||state?.stages?.[3]?.acceptedData||{},humanData:state?.stages?.[3]?.humanData||{},derivedData:state?.stages?.[3]?.derivedData||{}},stage03Research:current('research'),stage03CandidateRequirements:current('candidateRequirements'),applicableSources:current('sources'),applicableEvidence:current('evidenceRecords').filter(r=>[2,3].includes(Number(r.stage)))}};"
if old not in prompt:
    raise SystemExit('Expected incumbent Stage 04 exhausted-input selector not found.')
prompt = prompt.replace(old,new,1)
old2 = "if(!noSource){const sources=safe(state?.projectData?.sources).filter(r=>r?.active!==false&&!r?.invalidatedBy),research=safe(state?.projectData?.research).filter(r=>r?.active!==false&&!r?.invalidatedBy),covered=new Set(research.map(r=>clean(recordValue(r,'SOURCE_ID')||r?.relationships?.SOURCE_ID)).filter(Boolean));"
new2 = "if(!noSource){const sources=workflow.recordsForCurrentScope(state,'sources'),research=workflow.recordsForCurrentScope(state,'research'),covered=new Set(research.map(r=>clean(recordValue(r,'SOURCE_ID')||r?.relationships?.SOURCE_ID)).filter(Boolean));"
if old2 not in prompt:
    raise SystemExit('Expected incumbent Stage 04 upstream selector not found.')
prompt = prompt.replace(old2,new2,1)
pathlib.Path('prompt-engine.js').write_text(prompt)

# Apply the earliest responsible Stage 01 artifact-scope fix as one exact substitution.
engine = pathlib.Path('workflow-engine.js').read_text()
old3 = "const stageOneArtifacts=records(project,'artifacts').filter(record=>Number(record?.stage||recordValue(record,'STAGE')||record?.lineage?.stage||0)===1||stageOneSelected.has(recordId(record,'artifacts')));"
new3 = "const stageOneArtifacts=recordsForCurrentScope(project,'artifacts').filter(record=>Number(record?.stage||recordValue(record,'STAGE')||record?.lineage?.stage||0)===1||stageOneSelected.has(recordId(record,'artifacts')));"
if old3 not in engine:
    raise SystemExit('Expected Stage 01 artifact selector not found.')
engine = engine.replace(old3,new3,1)
pathlib.Path('workflow-engine.js').write_text(engine)

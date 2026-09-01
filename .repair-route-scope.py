import pathlib, subprocess

BASE='f515ebcfe8ac265d41150c9a5c67bbeffe5757fb'

def original(path):
    return subprocess.check_output(['git','show',f'{BASE}:{path}'], text=True)

def replace_once(text, old, new, label):
    if text.count(old) != 1:
        raise SystemExit(f'{label}: expected exactly one incumbent match, found {text.count(old)}')
    return text.replace(old,new,1)

# Restore prompt-engine.js exactly from the incumbent, then apply only the demonstrated current-scope corrections.
prompt = original('prompt-engine.js')
prompt = replace_once(prompt,"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/55';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/56';",'prompt version')
prompt = replace_once(prompt,
"function stage4ExhaustedInputs(state){const active=list=>safe(list).filter(r=>r?.active!==false&&!r?.invalidatedBy).map(r=>({id:r?.id||r?.recordId||null,stage:r?.stage??null,scope:r?.scope||{},fields:recordFields(r),relationships:r?.relationships||{},evidenceRefs:r?.evidenceRefs||[]})),",
"function stage4ExhaustedInputs(state){const active=(collection,list)=>workflow.recordsForCurrentScope(state,collection).map(r=>({id:recordId(r,collection),stage:r?.stage??null,scope:r?.scope||{},fields:recordFields(r),relationships:r?.relationships||{},evidenceRefs:r?.evidenceRefs||[]})),",
'Stage 04 selector definition')
prompt = replace_once(prompt,"stage03Research:active(state?.projectData?.research)","stage03Research:active('research',state?.projectData?.research)",'Stage 04 research current scope')
prompt = replace_once(prompt,"stage03CandidateRequirements:active(state?.projectData?.candidateRequirements)","stage03CandidateRequirements:active('candidateRequirements',state?.projectData?.candidateRequirements)",'Stage 04 candidate requirements current scope')
prompt = replace_once(prompt,"applicableSources:active(state?.projectData?.sources)","applicableSources:active('sources',state?.projectData?.sources)",'Stage 04 sources current scope')
prompt = replace_once(prompt,"applicableEvidence:active(state?.projectData?.evidenceRecords).filter(record=>[2,3].includes(Number(record.stage)))","applicableEvidence:active('evidenceRecords',state?.projectData?.evidenceRecords).filter(record=>[2,3].includes(Number(record.stage)))",'Stage 04 evidence current scope')
prompt = replace_once(prompt,
"if(!noSource){const sources=safe(state?.projectData?.sources).filter(r=>r?.active!==false&&!r?.invalidatedBy),research=safe(state?.projectData?.research).filter(r=>r?.active!==false&&!r?.invalidatedBy),",
"if(!noSource){const sources=workflow.recordsForCurrentScope(state,'sources'),research=workflow.recordsForCurrentScope(state,'research'),",
'Stage 04 upstream current scope')
pathlib.Path('prompt-engine.js').write_text(prompt)

# Earliest responsible Stage 01 artifact route: enumerate only current-scope artifact records.
engine = pathlib.Path('workflow-engine.js').read_text()
engine = replace_once(engine,
"const stageOneArtifacts=records(project,'artifacts').filter(record=>Number(record?.stage||recordValue(record,'STAGE')||record?.lineage?.stage||0)===1||stageOneSelected.has(recordId(record,'artifacts')));",
"const stageOneArtifacts=recordsForCurrentScope(project,'artifacts').filter(record=>Number(record?.stage||recordValue(record,'STAGE')||record?.lineage?.stage||0)===1||stageOneSelected.has(recordId(record,'artifacts')));",
'Stage 01 artifact current scope')
pathlib.Path('workflow-engine.js').write_text(engine)

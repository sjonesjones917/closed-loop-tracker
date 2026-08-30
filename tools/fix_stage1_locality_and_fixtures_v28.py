from pathlib import Path

p=Path('prompt-engine.js'); t=p.read_text()
old="Stage 01 is COMPLETE HUMAN-AUTHORITY INTAKE."
new="Stage 01 is COMPLETE HUMAN-AUTHORITY INTAKE: job definition and clarification only."
if new not in t:
    if old not in t: raise SystemExit('Stage 01 locality anchor missing')
    t=t.replace(old,new,1)
anchor="Inspect every supplied artifact whose bytes are actually available deeply enough to extract all human-authority statements relevant to job definition, but do not perform Stage 02 research, requirement atomization, test design, or production."
replacement=anchor+" Treat supplied materials as authorized human job input for this limited intake inspection. Limited intake inspection is Stage 01 job-definition work only. Do not classify, validate, rank, establish provenance for, or determine authority/currency/conflicts among supplied materials here; those belong to later stages when applicable."
if replacement not in t:
    if anchor not in t: raise SystemExit('Stage 01 material-boundary anchor missing')
    t=t.replace(anchor,replacement,1)
p.write_text(t)

p=Path('verify-prompt-semantics.mjs'); t=p.read_text()
start=t.find('// stage01-practical-intake-regression-v1')
end=t.find('// demonstrated-stage01-output-contract-regression-v2')
if start<0 or end<0 or end<=start: raise SystemExit('Stage 01 practical fixture block not found')
new_block="""// stage01-practical-intake-regression-v2 — patent is a fixture, never a runtime branch.
{
 const p=baseProject();
 p.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project';
 p.job.SUPPLIED_MATERIALS_INVENTORY='MAINFRAME_INVENTION_DISCLOSURE.zip';
 const r=prompts.buildPromptRecord(1,p);
 const required=[
  'COMPLETE HUMAN-AUTHORITY INTAKE',
  'Derive subject-specific human-authority questions from the actual user request, accessible supplied materials, and current canonical context; do not use a hard-coded project-subject catalogue',
  'Capture every human-supplied fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, and foreseeable unresolved human-only issue',
  'BLOCKING_NOW','ASK_NOW_NONBLOCKING','LATER_RESOLVABLE',
  'Never ask for information already present in User Job Input, an available supplied artifact, a prior answer, or canonical project memory',
  'APPLICATION INTAKE COVERAGE MANIFEST — ACCOUNT FOR EVERY ID',
  'humanInputRequestContract','temporaryKey','whyRequired','affectedStageFields','answerType','allowedValues',
  'Do not invent requestKey, required, whyNeeded, expectedAnswer'
 ];
 for(const token of required)if(!r.prompt.includes(token))throw new Error('Stage 01 generic practical intake contract missing: '+token);
 for(const forbidden of ['intended jurisdiction(s)','filing route or application type','inventor identity','government funding','joint-research circumstances'])if(r.prompt.includes(forbidden))throw new Error('Stage 01 runtime hard-coded patent fixture detail: '+forbidden);
 if(r.prompt.includes('Treat any human-supplied files, links, references, records, or other materials as opaque authorized inputs'))throw new Error('Stage 01 still treats supplied human material as opaque instead of usable intake.');
}


"""
t=t[:start]+new_block+t[end:]
# The Stage 04 captured-input fixture must represent a legitimately current Stage 04 project.
needle="  p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'CAPTURED-STAGE01-DELIVERABLE-SENTINEL',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:'design-input.pdf already represented in controlled input'};\n  const first=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});"
repl="  p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'CAPTURED-STAGE01-DELIVERABLE-SENTINEL',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:'design-input.pdf already represented in controlled input'};\n  p.job.CURRENT_STAGE=4;p.stages[1].status='COMPLETE';p.stages[3].status='COMPLETE';\n  const first=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});"
if needle in t: t=t.replace(needle,repl,1)
if "p.job.CURRENT_STAGE=4;p.stages[1].status='COMPLETE';p.stages[3].status='COMPLETE';" not in t: raise SystemExit('Stage 04 captured-input fixture prerequisite state missing')
p.write_text(t)
print('Stage 01 locality and subject-neutral fixtures aligned')

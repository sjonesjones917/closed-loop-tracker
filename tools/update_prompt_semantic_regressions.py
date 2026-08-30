from pathlib import Path
p=Path('verify-prompt-semantics.mjs'); t=p.read_text()
old="""  if(!record.prompt.includes('PATENT / REGULATED FILING'))issues.push('PATENT_DOMAIN_RULE_MISSING');
  if(!record.prompt.includes('SOFTWARE / MULTI-FILE SYSTEM'))issues.push('SOFTWARE_DOMAIN_RULE_MISSING');
  if(!record.prompt.includes('BUILDING / ARCHITECTURE / AEC'))issues.push('BUILDING_DOMAIN_RULE_MISSING');
  if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');
  if(record.stage===1){
    if(!record.prompt.includes('STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')||!record.prompt.includes('Do not perform source discovery, source research, requirement derivation, verification design, production-instruction authoring, implementation, artifact production'))issues.push('STAGE01_DOMAIN_INTAKE_BOUNDARY_MISSING');
"""
new="""  for(const forbidden of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'])if(record.prompt.includes(forbidden))issues.push('HARDCODED_DOMAIN_BRANCH_LEAK');
  if(record.stage===1){
    if(!record.prompt.includes('Stage 01 is COMPLETE HUMAN-AUTHORITY INTAKE')||!record.prompt.includes('do not perform Stage 02 research, requirement atomization, test design, or production'))issues.push('STAGE01_INTAKE_BOUNDARY_MISSING');
"""
if old not in t: raise SystemExit('old domain assertion block missing')
t=t.replace(old,new,1)
old="""    if(!record.prompt.includes('MANDATORY STAGE 01 HUMAN-INTAKE GATE')||!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('Nonblocking means the human may defer; it does not mean the agent may skip the question')||!record.prompt.includes('intended jurisdiction(s)')||!record.prompt.includes('additional human-controlled invention materials exist'))issues.push('STAGE01_PROACTIVE_HUMAN_INTAKE_GATE_MISSING');
"""
new="""    if(!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('Never ask for information already present in User Job Input, an available supplied artifact, a prior answer, or canonical project memory')||!record.prompt.includes('Capture every human-supplied fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, and foreseeable unresolved human-only issue'))issues.push('STAGE01_EXHAUSTIVE_HUMAN_INTAKE_GATE_MISSING');
"""
if old not in t: raise SystemExit('old proactive intake assertion missing')
t=t.replace(old,new,1)
old="""    if(!record.prompt.includes('do not require the human to know those formats in advance')||!record.prompt.includes('absence of a downstream authoring, viewing, compiling, importing, simulation, manufacturing, filing, deployment, or other consuming system is not by itself a reason to downgrade an artifact to prose')||!record.prompt.includes('Only propose an implementation-ready'))issues.push('STAGE01_ARTIFACT_GENERATION_BOUNDARY_MISSING');
"""
new="""    if(!record.prompt.includes('Preserve the exact requested deliverable; do not downgrade it merely because a downstream viewing or execution tool is unavailable')||record.prompt.includes('perform Stage 02 research, requirement atomization, test design, or production during Stage 01'))issues.push('STAGE01_DELIVERABLE_PRESERVATION_BOUNDARY_MISSING');
"""
if old not in t: raise SystemExit('old Stage 01 artifact assertion missing')
t=t.replace(old,new,1)
# Add explicit subject-neutral source-code assertion, not keyword-driven output expectations.
anchor="const prompts=globalThis.closedLoopPromptEngine;\n"
insert="const promptSource=fs.readFileSync('prompt-engine.js','utf8');\nfor(const forbidden of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'])if(promptSource.includes(forbidden))throw new Error(`Prompt engine contains prohibited hard-coded subject branch: ${forbidden}`);\n"
if insert not in t:
    if anchor not in t: raise SystemExit('prompt source assertion anchor missing')
    t=t.replace(anchor,anchor+insert,1)
p.write_text(t)
print('prompt semantic regressions converted to behavior-based subject-neutral tests')

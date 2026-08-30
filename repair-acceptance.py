from pathlib import Path

p = Path('verify-prompt-semantics.mjs')
text = p.read_text()
for line in [
"  if(!record.prompt.includes('PATENT / REGULATED FILING'))issues.push('PATENT_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('SOFTWARE / MULTI-FILE SYSTEM'))issues.push('SOFTWARE_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('BUILDING / ARCHITECTURE / AEC'))issues.push('BUILDING_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');\n",
]:
    if line not in text:
        raise SystemExit('Expected forbidden domain assertion not found: '+line.strip())
    text = text.replace(line, '', 1)
old = "    if(!record.prompt.includes('STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')||!record.prompt.includes('Do not perform source discovery, source research, requirement derivation, verification design, production-instruction authoring, implementation, artifact production'))issues.push('STAGE01_DOMAIN_INTAKE_BOUNDARY_MISSING');"
new = "    if(!record.prompt.includes('Perform complete human-authority intake only.')||!record.prompt.includes('preserve every materially relevant fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, and unresolved human-only issue')||!record.prompt.includes('Do not perform source research, requirement atomization, test design, production, filing, simulation, manufacturing, or product verification.'))issues.push('STAGE01_INTAKE_BOUNDARY_MISSING');"
if old not in text: raise SystemExit('Expected obsolete Stage 01 domain-boundary assertion not found.')
text = text.replace(old,new,1)
old = "    if(!record.prompt.includes('MANDATORY STAGE 01 HUMAN-INTAKE GATE')||!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('Nonblocking means the human may defer; it does not mean the agent may skip the question')||!record.prompt.includes('intended jurisdiction(s)')||!record.prompt.includes('additional human-controlled invention materials exist'))issues.push('STAGE01_PROACTIVE_HUMAN_INTAKE_GATE_MISSING');"
new = "    if(!record.prompt.includes('MANDATORY STAGE 01 HUMAN-INTAKE GATE')||!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('Nonblocking means the human may defer; it does not mean the agent may skip the question')||!record.prompt.includes('Ask BLOCKING_NOW and ASK_NOW_NONBLOCKING questions in normal chat before the final machine response.'))issues.push('STAGE01_PROACTIVE_HUMAN_INTAKE_GATE_MISSING');"
if old not in text: raise SystemExit('Expected obsolete patent-coupled Stage 01 gate assertion not found.')
text = text.replace(old,new,1)
old = "    if(!record.prompt.includes('do not require the human to know those formats in advance')||!record.prompt.includes('absence of a downstream authoring, viewing, compiling, importing, simulation, manufacturing, filing, deployment, or other consuming system is not by itself a reason to downgrade an artifact to prose')||!record.prompt.includes('Only propose an implementation-ready'))issues.push('STAGE01_ARTIFACT_GENERATION_BOUNDARY_MISSING');"
new = "    if(!record.prompt.includes('If a material is named in SUPPLIED_MATERIALS_INVENTORY but its bytes are not available')||!record.prompt.includes('Do not ask the human to describe or re-enter its contents during Stage 01')||!record.prompt.includes('never infer substantive facts merely from the filename'))issues.push('STAGE01_ARTIFACT_BOUNDARY_MISSING');"
if old not in text: raise SystemExit('Expected obsolete Stage 01 artifact-generation assertion not found.')
text = text.replace(old,new,1)
p.write_text(text)

pages = Path('.github/workflows/pages.yml')
text = pages.read_text()
for command in ['          node verify-one-time-intent-intake.mjs\n','          node verify-single-supply-prompts.mjs\n']:
    text = text.replace(command,'')
pages.write_text(text)

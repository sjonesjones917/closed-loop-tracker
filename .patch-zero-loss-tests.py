from pathlib import Path

# Match the new regression's VM harness to the repository's existing browser stubs.
p=Path('verify-project-memory.mjs')
s=p.read_text()
old="const ctx={console,TextEncoder,TextDecoder,crypto:globalThis.crypto,structuredClone};ctx.globalThis=ctx;"
new="const Event=globalThis.Event||class Event{constructor(type){this.type=type;}};const ctx={console,TextEncoder,TextDecoder,crypto:globalThis.crypto,structuredClone,Event,dispatchEvent:()=>true,addEventListener:()=>{}};ctx.globalThis=ctx;"
if old not in s: raise SystemExit('regression VM context anchor not found')
p.write_text(s.replace(old,new))

# Replace obsolete tests that required prohibited hard-coded project-subject branches.
p=Path('verify-prompt-semantics.mjs')
s=p.read_text()
obsolete="""  if(!record.prompt.includes('PATENT / REGULATED FILING'))issues.push('PATENT_DOMAIN_RULE_MISSING');
  if(!record.prompt.includes('SOFTWARE / MULTI-FILE SYSTEM'))issues.push('SOFTWARE_DOMAIN_RULE_MISSING');
  if(!record.prompt.includes('BUILDING / ARCHITECTURE / AEC'))issues.push('BUILDING_DOMAIN_RULE_MISSING');
  if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');
"""
neutral="""  for(const forbidden of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'])if(record.prompt.includes(forbidden))issues.push(`HARDCODED_DOMAIN_BRANCH_${forbidden}`);
"""
if obsolete not in s: raise SystemExit('obsolete domain assertions not found')
s=s.replace(obsolete,neutral)
old="    if(!record.prompt.includes('STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')||!record.prompt.includes('Do not perform source discovery, source research, requirement derivation, verification design, production-instruction authoring, implementation, artifact production'))issues.push('STAGE01_DOMAIN_INTAKE_BOUNDARY_MISSING');"
new="    if(!record.prompt.includes('STAGE 01 CLARIFICATION EXPERIENCE')||!record.prompt.includes('do not atomize requirements or perform later-stage work')||!record.prompt.includes('Do not begin substantive external-source research or downstream production work'))issues.push('STAGE01_INTAKE_BOUNDARY_MISSING');"
if old not in s: raise SystemExit('obsolete Stage01 domain boundary assertion not found')
s=s.replace(old,new)
old="    if(!record.prompt.includes('MANDATORY STAGE 01 HUMAN-INTAKE GATE')||!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('Nonblocking means the human may defer; it does not mean the agent may skip the question')||!record.prompt.includes('intended jurisdiction(s)')||!record.prompt.includes('additional human-controlled invention materials exist'))issues.push('STAGE01_PROACTIVE_HUMAN_INTAKE_GATE_MISSING');"
new="    if(!record.prompt.includes('MANDATORY STAGE 01 HUMAN-INTAKE GATE')||!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('Nonblocking means the human may defer; it does not mean the agent may skip the question')||!record.prompt.includes('Never ask the human to repeat information available in supplied materials'))issues.push('STAGE01_PROACTIVE_HUMAN_INTAKE_GATE_MISSING');"
if old not in s: raise SystemExit('obsolete patent-fixture assertion not found')
s=s.replace(old,new)
p.write_text(s)

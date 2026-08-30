import fs from 'node:fs';
{
  const path='prompt-engine.js';
  let s=fs.readFileSync(path,'utf8');
  const old='Repeat discovery passes until saturation is actually supported by the evidence.';
  const replacement='Repeat discovery passes until saturation is actually supported by the evidence. Do not stop at a first pass. Before final Stage 03 JSON, every current Stage 02 source must have current research coverage; every required semantic category must have been examined; a second conflict-and-exception pass must be complete; and the latest complete pass must find no new material category. If any source is uncovered, any category remains unexamined, any conflict/exception pass is incomplete, or the latest pass discovers new material, continue Stage 03 rather than returning a completion proposal. Stage 03 must exhaust the accepted source set because Stage 04 will compile only the application-enumerated union of accepted Stage 01 and Stage 03 material.';
  if(!s.includes(replacement)){
    if(!s.includes(old))throw new Error('Stage 03 saturation sentence not found.');
    s=s.replace(old,replacement);
    fs.writeFileSync(path,s);
    console.log('patched prompt-engine Stage 03 exhaustion semantics');
  }else console.log('Stage 03 exhaustion semantics already patched');
}
{
  const path='verify-prompt-semantics.mjs';
  let s=fs.readFileSync(path,'utf8');
  const replacements=[
    ["  if(!record.prompt.includes('PATENT / REGULATED FILING'))issues.push('PATENT_DOMAIN_RULE_MISSING');\n  if(!record.prompt.includes('SOFTWARE / MULTI-FILE SYSTEM'))issues.push('SOFTWARE_DOMAIN_RULE_MISSING');\n  if(!record.prompt.includes('BUILDING / ARCHITECTURE / AEC'))issues.push('BUILDING_DOMAIN_RULE_MISSING');\n  if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');",
     "  for(const prohibited of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'])if(record.prompt.includes(prohibited))issues.push('HARDCODED_PROJECT_SUBJECT_BRANCH_'+prohibited);"],
    ["    if(!record.prompt.includes('STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')||!record.prompt.includes('Do not perform source discovery, source research, requirement derivation, verification design, production-instruction authoring, implementation, artifact production'))issues.push('STAGE01_DOMAIN_INTAKE_BOUNDARY_MISSING');",
     "    if(!record.prompt.includes('STAGE 01 SUBJECT-NEUTRAL ZERO-LOSS INTAKE')||!record.prompt.includes('Enumerate and preserve every meaning-bearing human unit.')||!record.prompt.includes('Split compound statements rather than compressing them.')||!record.prompt.includes('Do not begin substantive external-source research or downstream production work.'))issues.push('STAGE01_ZERO_LOSS_INTAKE_BOUNDARY_MISSING');"],
    ["    if(!record.prompt.includes('MANDATORY STAGE 01 HUMAN-INTAKE GATE')||!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('Nonblocking means the human may defer; it does not mean the agent may skip the question')||!record.prompt.includes('intended jurisdiction(s)')||!record.prompt.includes('additional human-controlled invention materials exist'))issues.push('STAGE01_PROACTIVE_HUMAN_INTAKE_GATE_MISSING');",
     "    if(!record.prompt.includes('MANDATORY STAGE 01 HUMAN-INTAKE GATE')||!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('Nonblocking means the human may defer; it does not mean the agent may skip the question')||!record.prompt.includes('Derive subject-specific human-only questions solely from the actual request, accessible supplied materials, and current canonical context. Do not use project-subject branches.'))issues.push('STAGE01_PROACTIVE_HUMAN_INTAKE_GATE_MISSING');"],
  ];
  let changed=false;
  for(const [a,b] of replacements){if(s.includes(a)){s=s.replace(a,b);changed=true;}else if(!s.includes(b))throw new Error('Expected prompt semantic regression fragment not found: '+a.slice(0,80));}
  if(changed){fs.writeFileSync(path,s);console.log('migrated prompt semantic regression to subject-neutral v3 rules');}else console.log('prompt semantic regression already migrated');
}

from pathlib import Path

p = Path('verify-prompt-semantics.mjs')
text = p.read_text()
for line in [
"  if(!record.prompt.includes('PATENT / REGULATED FILING'))issues.push('PATENT_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('SOFTWARE / MULTI-FILE SYSTEM'))issues.push('SOFTWARE_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('BUILDING / ARCHITECTURE / AEC'))issues.push('BUILDING_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');\n",
"  }else if(!record.prompt.includes('ARTIFACT GENERATION VS DOWNSTREAM EXECUTION')||!record.prompt.includes('must not be represented as completed'))issues.push('ENVIRONMENT_LIMIT_RULE_MISSING');\n",
]:
    if line not in text:
        raise SystemExit('Expected obsolete assertion not found: '+line.strip())
    text = text.replace(line, '' if 'ARTIFACT GENERATION' not in line else '  }\n', 1)
old = "    if(!record.prompt.includes('STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')||!record.prompt.includes('Do not perform source discovery, source research, requirement derivation, verification design, production-instruction authoring, implementation, artifact production'))issues.push('STAGE01_DOMAIN_INTAKE_BOUNDARY_MISSING');"
new = "    if(!record.prompt.includes('Perform complete human-authority intake only.')||!record.prompt.includes('preserve every materially relevant fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, and unresolved human-only issue')||!record.prompt.includes('Do not perform source research, requirement atomization, test design, production, filing, simulation, manufacturing, or product verification.'))issues.push('STAGE01_INTAKE_BOUNDARY_MISSING');"
if old not in text: raise SystemExit('Expected obsolete Stage 01 domain-boundary assertion not found.')
text = text.replace(old,new,1)
old = "    if(!record.prompt.includes('MANDATORY STAGE 01 HUMAN-INTAKE GATE')||!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('Nonblocking means the human may defer; it does not mean the agent may skip the question')||!record.prompt.includes('intended jurisdiction(s)')||!record.prompt.includes('additional human-controlled invention materials exist'))issues.push('STAGE01_PROACTIVE_HUMAN_INTAKE_GATE_MISSING');"
new = "    if(!record.prompt.includes('MANDATORY STAGE 01 HUMAN-INTAKE GATE')||!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('Nonblocking means the human may defer; it does not mean the agent may skip the question')||!record.prompt.includes('Ask BLOCKING_NOW and ASK_NOW_NONBLOCKING questions in normal chat before the final machine response.'))issues.push('STAGE01_PROACTIVE_HUMAN_INTAKE_GATE_MISSING');"
if old not in text: raise SystemExit('Expected obsolete patent-coupled Stage 01 gate assertion not found.')
text = text.replace(old,new,1)
old = "    if(!record.prompt.includes('do not require the human to know those formats in advance')||!record.prompt.includes('absence of a downstream authoring, viewing, compiling, importing, simulation, manufacturing, filing, deployment, or other consuming system is not by itself a reason to downgrade an artifact to prose')||!record.prompt.includes('Only propose an implementation-ready'))issues.push('STAGE01_ARTIFACT_GENERATION_BOUNDARY_MISSING');"
new = "    if(!record.prompt.includes('If a material is named in SUPPLIED_MATERIALS_INVENTORY but its bytes are not available')||!record.prompt.includes('Do not ask the human to describe or re-enter its contents during Stage 01')||!record.prompt.includes('never infer substantive facts merely from the filename'))issues.push('STAGE01_ARTIFACT_BOUNDARY_MISSING');\n    if(!record.prompt.includes('The accepted capture is the durable meaning-preserving handoff to every later stage')||!record.prompt.includes('original intent file must not be repeatedly requested'))issues.push('STAGE01_DURABLE_HANDOFF_MISSING');"
if old not in text: raise SystemExit('Expected obsolete Stage 01 artifact-generation assertion not found.')
text = text.replace(old,new,1)
anchor = "  if(record.stage===6){\n"
stage4 = "  if(record.stage===4){\n    if(!record.prompt.includes('APPLICATION OBLIGATION MANIFEST')||!record.prompt.includes('No obligation may disappear.')||!record.prompt.includes('do not ask the human to attach the original intent file again'))issues.push('STAGE04_ZERO_LOSS_CONTRACT_MISSING');\n  }\n"
if anchor not in text: raise SystemExit('Stage 6 semantic assertion anchor not found.')
text = text.replace(anchor,stage4+anchor,1)
old_mutants = """const mutants=[
  {...original,contextManifest:{...original.contextManifest,readCollections:{verification:[]}}},
  {...original,prompt:original.prompt.replace(`OPERATION: ${original.operation}`,'OPERATION: VERIFY')},
  {...original,prompt:original.prompt.replace('rejected data is not canonical','rejected data may be reused')},
  {...original,prompt:original.prompt.replace('must not be represented as completed','may be represented as completed')},
  {...original,promptEngineVersion:'closed-loop-prompt-engine/obsolete'},
  {...original,prompt:original.prompt.replace('ARTIFACT GENERATION VS DOWNSTREAM EXECUTION','TOOL POSSESSION CONTROLS ARTIFACT GENERATION')},
  {...original,prompt:original.prompt.replace('ARTIFACT GENERATION VS DOWNSTREAM EXECUTION','TOOL POSSESSION CONTROLS ARTIFACT GENERATION')},
  {...original,prompt:original.prompt.replace('PATENT / REGULATED FILING','GENERAL DOCUMENT')},
  {...original,prompt:original.prompt.replace('Never claim that a web search, repository edit, build, test, CAD operation, simulation, CNC post-processing step, physical measurement, fabrication, filing, submission, or other external action occurred unless it actually occurred','Assume external actions occurred when useful')}
];
"""
new_mutants = """const stage1Mutation=prompts.buildPromptRecord(1,baseProject(),{operation:'COMPLETE'});
const stage4Mutation=prompts.buildPromptRecord(4,baseProject(),{operation:'COMPLETE'});
const mutants=[
  {...original,contextManifest:{...original.contextManifest,readCollections:{verification:[]}}},
  {...original,prompt:original.prompt.replace(`OPERATION: ${original.operation}`,'OPERATION: VERIFY')},
  {...original,prompt:original.prompt.replace('rejected data is not canonical','rejected data may be reused')},
  {...original,promptEngineVersion:'closed-loop-prompt-engine/obsolete'},
  {...stage1Mutation,prompt:stage1Mutation.prompt.replace('MANDATORY STAGE 01 HUMAN-INTAKE GATE','STAGE 01 OPTIONAL INTAKE')},
  {...stage1Mutation,prompt:stage1Mutation.prompt.replace('The accepted capture is the durable meaning-preserving handoff to every later stage','The accepted capture may be discarded after this stage')},
  {...stage4Mutation,prompt:stage4Mutation.prompt.replace('No obligation may disappear.','Obligations may be omitted when inconvenient.')},
  {...original,prompt:original.prompt.replace('Never claim that a web search, repository edit, build, test, CAD operation, simulation, CNC post-processing step, physical measurement, fabrication, filing, submission, or other external action occurred unless it actually occurred','Assume external actions occurred when useful')}
];
"""
if old_mutants not in text: raise SystemExit('Expected obsolete semantic mutant set not found.')
text = text.replace(old_mutants,new_mutants,1)
old_contract = " if(descriptor.contractVersion!=='closed-loop-response-contract/2.4')throw new Error('Versioned response-contract descriptor is missing.');"
new_contract = " if(descriptor.contractVersion!=='closed-loop-response-contract/3.1')throw new Error('Current /3 versioned response-contract descriptor is missing.');"
if old_contract not in text: raise SystemExit('Expected obsolete response-contract version assertion not found.')
text = text.replace(old_contract,new_contract,1)
p.write_text(text)

pages = Path('.github/workflows/pages.yml')
text = pages.read_text()
for command in ['          node verify-one-time-intent-intake.mjs\n','          node verify-single-supply-prompts.mjs\n']:
    text = text.replace(command,'')
pages.write_text(text)

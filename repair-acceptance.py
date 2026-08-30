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
for old_contract,new_contract in [
(" if(descriptor.contractVersion!=='closed-loop-response-contract/2.4')throw new Error('Versioned response-contract descriptor is missing.');"," if(descriptor.contractVersion!=='closed-loop-response-contract/3.1')throw new Error('Current /3 versioned response-contract descriptor is missing.');"),
(" if(!record.prompt.includes('RESPONSE CONTRACT DEFINITIONS')||!record.prompt.includes('closed-loop-response-contract/2.4'))throw new Error('The agent cannot inspect the exact contract descriptor whose hash it must echo.');"," if(!record.prompt.includes('RESPONSE CONTRACT DEFINITIONS')||!record.prompt.includes('closed-loop-response-contract/3.1'))throw new Error('The agent cannot inspect the exact current /3 contract descriptor whose hash it must echo.');")
]:
    if old_contract not in text: raise SystemExit('Expected obsolete response-contract assertion not found.')
    text = text.replace(old_contract,new_contract,1)
old_specialist = " if(!r.prompt.includes('STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')||!/supplied invention disclosure/.test(r.prompt)||!/supplied repository or file materials/.test(r.prompt)||!/human-supplied project location/.test(r.prompt)||!/supplied geometry\\/specifications/.test(r.prompt))throw new Error('Stage 01 specialist intake adaptation is missing.');"
new_specialist = " if(!r.prompt.includes('APPLICATION INTAKE MANIFEST')||!r.prompt.includes('Classify every supplied unit exactly once')||!r.prompt.includes('accepted capture is the durable meaning-preserving handoff to every later stage'))throw new Error('Stage 01 generic complete-intake behavior is missing.');\n if(/PATENT \/ REGULATED FILING|SOFTWARE \/ MULTI-FILE SYSTEM|BUILDING \/ ARCHITECTURE \/ AEC|PHYSICAL \/ MECHANICAL \/ CAD/.test(r.prompt))throw new Error('Stage 01 prompt contains prohibited subject-specific runtime branches.');"
if old_specialist not in text: raise SystemExit('Expected obsolete Stage 01 specialist fixture not found.')
text = text.replace(old_specialist,new_specialist,1)
old_ownership = """ const requiredOwnership=[
  [1,'The application already owns JOB_ID'],
  [10,'the application assigns CANDIDATE_ID and ITERATION_ID'],
  [18,'The application calculates mandatory requirement coverage'],
  [20,'the application assigns BASELINE_ID'],
  [21,'The application assigns PRODUCT_ID and execution identity'],
  [27,'Do not set a release state'],
  [28,'The application performs the authoritative immediate pre-release byte comparison'],
  [29,'The application constructs the complete evidence graph'],
  [30,'The application maintains append-only defect and regression history']
 ];
 for(const [stage,phrase] of requiredOwnership){const r=prompts.buildPromptRecord(stage,baseProject(),{operation:schema.STAGE_CONTRACTS[stage].operations[0]});if(!r.prompt.includes(phrase))throw new Error(`Stage ${stage} is missing application-ownership semantics: ${phrase}`);}
"""
new_ownership = """ const ownershipStages=[1,10,18,20,21,27,28,29,30];
 for(const stage of ownershipStages){const r=prompts.buildPromptRecord(stage,baseProject(),{operation:schema.STAGE_CONTRACTS[stage].operations[0]});if(!r.prompt.includes('Never assign canonical application IDs, versions, timestamps, counts, hashes, statuses, coverage values, release determinations, current stage/state, or other application-owned values.'))throw new Error(`Stage ${stage} is missing the shared application-ownership prohibition.`);}
"""
if old_ownership not in text: raise SystemExit('Expected obsolete exact-phrase ownership fixture not found.')
text = text.replace(old_ownership,new_ownership,1)
old_residual = " if(!q.includes('EXACT_DELIVERABLE_REQUESTED')||!/human intent confirmation/i.test(q))throw new Error('Stage 01 does not establish a confirmable feasible substitute deliverable.');"
new_residual = " if(!q.includes('EXACT_DELIVERABLE_REQUESTED')||!q.includes('objective/deliverable defined')||!q.includes('Ask BLOCKING_NOW and ASK_NOW_NONBLOCKING questions in normal chat before the final machine response.'))throw new Error('Stage 01 does not establish a complete, human-authority-defined deliverable before final submission.');"
if old_residual not in text: raise SystemExit('Expected obsolete feasible-substitute Stage 01 assertion not found.')
text = text.replace(old_residual,new_residual,1)
text = text.replace("specialistDomains:['patent','software-multifile','building-aec','physical-engineering-cad-cam-cnc-additive']","subjectNeutralIntake:true")
old_locality = " const required1=[/job definition and clarification only/i,/authorized human job input/i,/limited intake inspection is Stage 01 job-definition work/i,/do not classify, validate, rank, establish provenance for, or determine authority\\/currency\\/conflicts among supplied materials here/i];"
new_locality = " const required1=[/complete human-authority intake only/i,/objective, intended deliverable/i,/Do not perform source discovery, external-authority analysis, requirement atomization, verification design, production-instruction authoring, implementation, artifact production/i];"
if old_locality not in text: raise SystemExit('Expected obsolete Stage 01 locality fixture not found.')
text = text.replace(old_locality,new_locality,1)
old_practical = """ const required=[
  'do not ask the human to re-enter facts that are already present in those materials',
  'Do not block Stage 01 merely because information will be needed by a later',
  'Stage 01 does not require every fact needed to execute later stages',
  'A request such as \"prepare a patent application for this project\" is sufficient to define a patent-application drafting job at Stage 01',
  'Do not make jurisdiction, filing route, inventorship, ownership, priority/continuity, disclosure history, filing deadline, or counsel-review-versus-filing-ready choices automatic Stage-01 blockers',
  'Stage 01 also owns proactive human intake: before finalizing Stage 01, collect the human-specific facts and decisions that are already foreseeable as necessary to achieve the requested outcome',
  'humanInputRequestContract',
  'temporaryKey',
  'whyRequired',
  'affectedStageFields',
  'answerType',
  'allowedValues',
  'Do not invent requestKey, required, whyNeeded, expectedAnswer'
 ];
"""
new_practical = """ const required=[
  'Never ask the human to repeat information available in supplied materials',
  'BLOCKING_NOW',
  'ASK_NOW_NONBLOCKING',
  'LATER_RESOLVABLE',
  'derive subject-specific questions from this job’s objective and materials',
  'Do not ask the human to describe or re-enter its contents during Stage 01',
  'humanInputRequestContract',
  'temporaryKey',
  'whyRequired',
  'affectedStageFields',
  'answerType',
  'allowedValues',
  'Do not invent requestKey, required, whyNeeded, expectedAnswer'
 ];
"""
if old_practical not in text: raise SystemExit('Expected obsolete patent-literal practical intake fixture not found.')
text = text.replace(old_practical,new_practical,1)
p.write_text(text)

pages = Path('.github/workflows/pages.yml')
text = pages.read_text()
for command in ['          node verify-one-time-intent-intake.mjs\n','          node verify-single-supply-prompts.mjs\n']:
    text = text.replace(command,'')
pages.write_text(text)

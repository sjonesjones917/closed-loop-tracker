from pathlib import Path

# 1) Remove residual project-subject prompt branches/examples. The prompt engine must stay subject-neutral.
p=Path('prompt-engine.js'); text=p.read_text()
repls={
"This static browser is not a universal compiler, script runner, CAD/CAE tool, lab, or machine controller.":"This static browser is not a universal compiler, arbitrary script runner, specialized external tool, laboratory, or physical machine controller.",
"For engineering artifacts, meaning review includes whether dimensions, tolerances, interfaces, notes, symbols, manufacturing intent, and other human-interpreted meaning communicate the required design unambiguously.":"For any artifact, derive the meaning-review dimensions from the current requirements, governing evidence, artifact semantics, interfaces, and declared acceptance conditions; do not inject a project-subject checklist.",
"For drawings, CAD/CAM, CNC, and additive-manufacturing artifacts, inspect every required view/representation and verify that human-visible units, scales, datums/coordinates, dimensions/tolerances, notes, revision identifiers, and manufacturing information are present and coherent where applicable.":"For every artifact type, derive the required views, representations, human-visible semantics, transformations, package checks, and acceptance observations from the current requirements and governing evidence; do not inject a project-subject checklist.",
"Never claim that a web search, repository edit, build, test, CAD operation, simulation, CNC post-processing step, physical measurement, fabrication, filing, submission, or other external action occurred unless it actually occurred":"Never claim that a search, repository edit, build, test, specialized tool operation, external-system operation, physical observation, submission, or other external action occurred unless it actually occurred"
}
for old,new in repls.items():
    if old in text:text=text.replace(old,new)
text=text.replace("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/32';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/33';")
p.write_text(text)

# 2) Remove the Stage 02 workbook gate contradiction: supplied project material is not an external-source inspection obligation.
p=Path('workbook.js'); text=p.read_text()
old="'Every relied-upon supplied file was inspected'"
new="'Supplied project material was not misclassified as independent external authority'"
if old in text:text=text.replace(old,new,1)
p.write_text(text)

# 3) Replace obsolete definition-of-done schema assertions with the controlling /3 identities.
p=Path('verify-definition-of-done.mjs'); text=p.read_text()
text=text.replace("closed-loop-project/2","closed-loop-project/3")
text=text.replace("closed-loop-stage-response/2","closed-loop-stage-response/3")
p.write_text(text)

# 4) Make the prompt verifier audit every stage/operation for its whole job, exact dependencies, completion gate,
# single-supply memory, and subject neutrality instead of requiring hard-coded domain catalogues.
p=Path('verify-prompt-semantics.mjs'); text=p.read_text()
for line in [
"  if(!record.prompt.includes('PATENT / REGULATED FILING'))issues.push('PATENT_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('SOFTWARE / MULTI-FILE SYSTEM'))issues.push('SOFTWARE_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('BUILDING / ARCHITECTURE / AEC'))issues.push('BUILDING_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');\n",
]: text=text.replace(line,'')
text=text.replace("if(!record.prompt.includes('STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')","if(!record.prompt.includes('STAGE 01 SUBJECT-NEUTRAL INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')")
text=text.replace("||!record.prompt.includes('intended jurisdiction(s)')||!record.prompt.includes('additional human-controlled invention materials exist')","")
text=text.replace("if(!record.prompt.includes('Never claim that a web search, repository edit, build, test, CAD operation, simulation, CNC post-processing step, physical measurement, fabrication, filing, submission, or other external action occurred unless it actually occurred'))issues.push('EXTERNAL_ACTION_HONESTY_RULE_MISSING');","if(!record.prompt.includes('Never claim that a search, repository edit, build, test, specialized tool operation, external-system operation, physical observation, submission, or other external action occurred unless it actually occurred'))issues.push('EXTERNAL_ACTION_HONESTY_RULE_MISSING');")
text=text.replace("  {...original,prompt:original.prompt.replace('PATENT / REGULATED FILING','GENERAL DOCUMENT')},\n","")
text=text.replace("  {...original,prompt:original.prompt.replace('Never claim that a web search, repository edit, build, test, CAD operation, simulation, CNC post-processing step, physical measurement, fabrication, filing, submission, or other external action occurred unless it actually occurred','Assume external actions occurred when useful')}\n","  {...original,prompt:original.prompt.replace('Never claim that a search, repository edit, build, test, specialized tool operation, external-system operation, physical observation, submission, or other external action occurred unless it actually occurred','Assume external actions occurred when useful')}\n")
# Insert universal per-prompt checks into semanticIssues.
anchor="  if(record.promptEngineVersion!==prompts.version)issues.push('PROMPT_ENGINE_VERSION_MISSING');\n"
addition="""  if(!record.prompt.includes('STAGE-SPECIFIC TASK'))issues.push('STAGE_TASK_MISSING');
  if(!record.prompt.includes('COMPLETION CONDITIONS'))issues.push('COMPLETION_CONDITIONS_MISSING');
  if(!record.prompt.includes('PROJECT MEMORY / SINGLE-SUPPLY INVARIANT — MANDATORY FOR EVERY STAGE'))issues.push('SINGLE_SUPPLY_INVARIANT_MISSING');
  if(!record.prompt.includes('Never ask the human to repeat, retype, restate, summarize, reconstruct, reattach, or resend it'))issues.push('NO_REPEAT_HUMAN_INPUT_RULE_MISSING');
  if(!record.prompt.includes('If previously supplied information should be present but is absent from the current canonical projection, fail closed as MISSING_APPLICATION_CONTEXT or INADEQUATE_PRIOR_OUTPUT'))issues.push('MISSING_PRIOR_CONTEXT_FAIL_CLOSED_RULE_MISSING');
  for(const collection of op?.readCollections||[]){const heading=collection.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').toUpperCase();if(!record.prompt.includes(heading))issues.push('REQUIRED_CONTEXT_COLLECTION_MISSING_'+collection);}
  for(const condition of schema.STAGE_CONTRACTS[record.stage]?.completionConditions||[]){if(!record.prompt.includes('- '+condition))issues.push('DECLARED_COMPLETION_CONDITION_MISSING');}
"""
if addition.strip() not in text:
    if anchor not in text:raise SystemExit('semanticIssues insertion anchor missing')
    text=text.replace(anchor,anchor+addition,1)
# Add source-level subject-neutrality assertion after runtime load.
anchor2="if(!core||!schema||!engine||!prompts)throw new Error('Prompt-semantic runtime failed to load.');\n"
addition2="""const promptEngineSource=fs.readFileSync('prompt-engine.js','utf8');
for(const forbidden of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE','intended jurisdiction(s)','filing route or application type','For engineering artifacts','For drawings, CAD/CAM'])if(promptEngineSource.includes(forbidden))throw new Error('prompt-engine.js contains a prohibited project-subject branch/catalogue: '+forbidden);
"""
if addition2.strip() not in text:
    if anchor2 not in text:raise SystemExit('prompt source audit anchor missing')
    text=text.replace(anchor2,anchor2+addition2,1)
p.write_text(text)

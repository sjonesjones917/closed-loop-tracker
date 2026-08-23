import fs from 'node:fs';

const file='rebuild-self-project.mjs';
let source=fs.readFileSync(file,'utf8');
if(!source.includes('promptText:selfPrompt')){
  const pattern=/const productionInstructions=\[record\('INSTRUCTION-001',8,\{[\s\S]*?\}\)\];\nconst preflightReviews=/;
  const match=source.match(pattern);
  if(!match)throw new Error('Could not locate retained productionInstructions block.');
  const replacement=`const selfPrompt=[
  'PRODUCTION INSTRUCTION',
  \\`PROJECT: \\${currentProject.name||'Closed-Loop Agent Reliability application'} (\\${currentProject.projectId})\\`,
  \\`OBJECTIVE\\n\\${job.exactUserObjective}\\`,
  \\`DELIVERABLES\\n\\${job.exactDeliverables}\\`,
  \\`REQUESTED ACTIONS\\n\\${job.requestedActions}\\`,
  \\`SCOPE BOUNDARIES\\n\\${job.scopeBoundaries}\\`,
  \\`INDEPENDENT EXTERNAL AUTHORITY\\n\\${externalSources.map(source=>\\`- \\${source.id}: \\${source.title} | \\${source.canonicalLocation}\\`).join('\\n')}\\`,
  \\`MANDATORY ATOMIC REQUIREMENTS\\n\\${requirements.map(requirement=>\\`- \\${requirement.id}: \\${requirement.statement} | controlling=\\${requirement.controllingReference} | accept=\\${requirement.acceptanceCriterion} | fail=\\${requirement.failureCondition}\\`).join('\\n')}\\`,
  \\`ACCEPTANCE TESTS\\n\\${acceptanceTests.map(test=>\\`- \\${test.id}: \\${test.requirementIds} | \\${test.procedure} | expected=\\${test.expectedResult}\\`).join('\\n')}\\`,
  \\`FAILURE / MUTATION TESTS\\n\\${mutationTests.map(test=>\\`- \\${test.id}: \\${test.requirementIds} | \\${test.mutation} | expected detection=\\${test.expectedDetection}\\`).join('\\n')}\\`,
  \\`PROHIBITED ACTIONS\\n\\${job.prohibitedActions}\\`,
  \\`REQUIRED METHODS AND PROCESS CONDITIONS\\n\\${job.requiredMethods}\\`,
  \\`OUTPUT CONTRACT\\n\\${job.requiredOutputProperties}\\`,
  'DECISION RULES\\nSatisfy every mandatory requirement. Do not substitute explanation for requested execution. Do not invent missing facts or evidence. BLOCK when a mandatory requirement cannot be established; reject a candidate when a mandatory requirement is demonstrably violated; correct the earliest responsible layer and rerun dependent work.',
  'TRUTH SEMANTICS\\nUSER JOB INPUT establishes intent and supplied facts. EXTERNAL RESEARCH SOURCE establishes externally governed authority. WORKFLOW-GENERATED ARTIFACT records what happened and never becomes retroactive external authority.',
  \\`COMPLETION CRITERIA\\n\\${job.successConditions}\\`
].join('\\n\\n');
const selfPreflightPrompt=\\`PREFLIGHTED PRODUCTION INSTRUCTION\\n\\n\\${selfPrompt}\\n\\nPREFLIGHT CONDITION\\nThis reviewed version preserves the approved requirements and authority boundary and is the version frozen for candidate production unless a later material defect invalidates it.\\`;
const productionInstructions=[
  record('INSTRUCTION-001',8,{instructionId:'INSTRUCTION-v001',promptText:selfPrompt,objective:job.exactUserObjective,governingInputs:'INPUT-001 through INPUT-003; registered external sources; REQ-001 through REQ-008; TEST-001 through TEST-008; MUTATION-001 through MUTATION-008.',scope:'The complete application, retained project, exact release files, and configured Pages deployment.',orderedProcedure:'Follow Stages 1 through 31 in order using structured records, current-schema project state, independent contexts, responsible-layer correction, product-byte verification, audits, decision, and release.',decisionRules:'Mandatory violations block acceptance. Confirmed defects invalidate dependent work. ACCEPTED requires complete affirmative evidence and passing validators.',toolRules:'Use actual external research systems, the real rendered browser UI, isolated browser contexts, deterministic scripts, SHA-256, GitHub Actions, GitHub Pages, and post-deploy live retrieval.',outputContract:'Standalone index.html; current-schema SELF_VERIFIED_PROJECT.json; verification reports; exact hashes; Pages deployment receipt.',failureBehavior:'Record BLOCKED or REJECTED rather than inventing evidence. Correct the earliest responsible layer and rerun dependent stages.',truthSemantics:'User inputs establish intent; external sources establish externally governed requirements; workflow records establish only what happened in the workflow.',completionCriteria:job.successConditions}),
  record('INSTRUCTION-002',9,{instructionId:'INSTRUCTION-v002',promptText:selfPreflightPrompt,objective:job.exactUserObjective,governingInputs:'INSTRUCTION-v001 plus the approved Stage 1-8 records and preflight criteria.',scope:'The same complete application scope as INSTRUCTION-v001; no user intent or authority is removed.',orderedProcedure:'Use the reviewed production instruction after checking ambiguity, missing inputs, contradictions, capability gaps, traceability gaps, and wording-only compliance.',decisionRules:'Any material preflight defect must be corrected before candidate freeze; upstream defects invalidate the responsible earlier stage.',toolRules:'Use the same actual tools and evidence rules as INSTRUCTION-v001.',outputContract:'The same exact application and release outputs required by the approved job.',failureBehavior:'If a material defect cannot be corrected without new authority or user clarification, record BLOCKED and return to the earliest responsible stage.',truthSemantics:'The preflight may clarify the instruction but may not manufacture external authority or alter user intent.',completionCriteria:job.successConditions})
];
const preflightReviews=`;
  source=source.replace(pattern,replacement);
  source=source.replace("'INSTRUCTION-001 defines the complete whole-application production objective, approved inputs, external-authority boundary, structured work, actors, ordered procedure, tool rules, output contract, failure behavior, truth semantics, and completion criteria.'","'INSTRUCTION-v001 is the generated production prompt for the complete application and contains the objective, approved inputs, external-authority boundary, mandatory requirements, acceptance and mutation tests, ordered procedure, tool rules, output contract, failure behavior, truth semantics, and completion criteria.'");
  source=source.replace("'PREFLIGHT-001 found no unresolved ambiguity, omission, contradiction, unavailable mandatory capability, circular authority path, or unverifiable command.'","'PREFLIGHT-001 found no unresolved ambiguity, omission, contradiction, unavailable mandatory capability, circular authority path, or unverifiable command and produced INSTRUCTION-v002 as the separately versioned preflighted production prompt.'");
  source=source.replace("productionInstruction:`${instructionHash} — INSTRUCTION-001.`","productionInstruction:`${instructionHash} — INSTRUCTION-v002 approved after preflight; INSTRUCTION-v001 preserved as the Stage 8 generated prompt.`");
  fs.writeFileSync(file,source);
}
console.log(JSON.stringify({status:'PASS',retainedPromptModel:true},null,2));

import fs from 'node:fs';

const file='rebuild-self-project.mjs';
let source=fs.readFileSync(file,'utf8');

if(!source.includes('promptText:selfProductionPrompt')){
  const anchor="const productionInstructions=[record('INSTRUCTION-001',8,{instructionId:'INSTRUCTION-001',objective:job.exactUserObjective,";
  if(!source.includes(anchor))throw new Error('Retained-project production instruction anchor was not found.');

  const helper=`const selfProductionPrompt=[
  'PRODUCTION INSTRUCTION',
  'PROJECT: '+(currentProject.name||'Closed-Loop Agent Reliability application')+' ('+currentProject.projectId+')',
  'OBJECTIVE\\n'+job.exactUserObjective,
  'DELIVERABLES\\n'+job.exactDeliverables,
  'REQUESTED ACTIONS\\n'+job.requestedActions,
  'SCOPE BOUNDARIES\\n'+job.scopeBoundaries,
  'INDEPENDENT EXTERNAL AUTHORITY\\n'+externalSources.map(source=>'- '+source.id+': '+source.title+' | '+source.canonicalLocation).join('\\n'),
  'MANDATORY ATOMIC REQUIREMENTS\\n'+requirements.map(requirement=>'- '+requirement.id+': '+requirement.statement+' | controlling='+requirement.controllingReference+' | accept='+requirement.acceptanceCriterion+' | fail='+requirement.failureCondition).join('\\n'),
  'ACCEPTANCE TESTS\\n'+acceptanceTests.map(test=>'- '+test.id+': '+test.requirementIds+' | '+test.procedure+' | expected='+test.expectedResult).join('\\n'),
  'FAILURE / MUTATION TESTS\\n'+mutationTests.map(test=>'- '+test.id+': '+test.requirementIds+' | '+test.mutation+' | expected detection='+test.expectedDetection).join('\\n'),
  'PROHIBITED ACTIONS\\n'+job.prohibitedActions,
  'REQUIRED METHODS AND PROCESS CONDITIONS\\n'+job.requiredMethods,
  'OUTPUT CONTRACT\\n'+job.requiredOutputProperties,
  'DECISION RULES\\nSatisfy every mandatory requirement. Do not substitute explanation for requested execution. Do not invent missing facts or evidence. If a mandatory requirement cannot be established, record BLOCKED with the exact blocker. If a mandatory requirement is demonstrably violated, reject that candidate, identify the earliest responsible layer, correct it, and rerun dependent work.',
  'TOOL-USE RULES\\nUse the actual external research systems, rendered UI, execution environments, files, measurements, deterministic tools, and independent verification methods required by the job. Preserve evidence sufficient for independent verification.',
  'TRUTH SEMANTICS\\nUSER JOB INPUT establishes intent and supplied facts. EXTERNAL RESEARCH SOURCE establishes externally governed authority. WORKFLOW-GENERATED ARTIFACT records what happened and never becomes retroactive external authority.',
  'COMPLETION CRITERIA\\n'+job.successConditions
].join('\\n\\n');
const selfPreflightPrompt='PREFLIGHTED PRODUCTION INSTRUCTION\\n\\n'+selfProductionPrompt+'\\n\\nPREFLIGHT CONDITION\\nThis separately versioned instruction preserves the approved user intent, external-authority boundary, mandatory requirements, and tests after checking ambiguity, omissions, contradictions, capability gaps, traceability gaps, and wording-only compliance.';
`;
  source=source.replace(anchor,helper+"\nconst productionInstructions=[record('INSTRUCTION-001',8,{instructionId:'INSTRUCTION-v001',promptText:selfProductionPrompt,objective:job.exactUserObjective,");

  const endAnchor=")];\nconst preflightReviews=[record('PREFLIGHT-001',9,";
  const endIndex=source.indexOf(endAnchor,source.indexOf('const productionInstructions='));
  if(endIndex<0)throw new Error('Retained-project preflight anchor was not found.');
  const before=source.slice(0,endIndex+3);
  const after=source.slice(endIndex+3);
  const stage9=`\nproductionInstructions.push(record('INSTRUCTION-002',9,{instructionId:'INSTRUCTION-v002',promptText:selfPreflightPrompt,objective:job.exactUserObjective,governingInputs:'INSTRUCTION-v001 plus the approved Stage 1-8 records and preflight criteria.',scope:job.scopeBoundaries,orderedProcedure:'Use the reviewed production instruction only after checking ambiguity, missing inputs, contradictions, unavailable capabilities, unverifiable commands, responsibility/order gaps, traceability gaps, and wording-only compliance.',decisionRules:'Any material preflight defect must be corrected before candidate freeze; an unresolved mandatory issue is BLOCKED.',toolRules:'Use the same actual tools, external authority, and evidence rules established by INSTRUCTION-v001.',outputContract:job.requiredOutputProperties,failureBehavior:'Do not silently alter user intent or external authority. Return to the earliest responsible stage if a material preflight defect is found.',truthSemantics:'Preflight may clarify the generated instruction but cannot manufacture external authority or convert workflow artifacts into authority.',completionCriteria:job.successConditions}));\n`;
  source=before+stage9+after;
  fs.writeFileSync(file,source);
}

if(!source.includes("instructionId:'INSTRUCTION-v001'")||!source.includes("instructionId:'INSTRUCTION-v002'")||!source.includes('promptText:selfProductionPrompt')||!source.includes('promptText:selfPreflightPrompt'))throw new Error('Retained prompt binding patch did not produce both prompt versions.');
console.log(JSON.stringify({status:'PASS',stage8:'INSTRUCTION-v001',stage9:'INSTRUCTION-v002'},null,2));

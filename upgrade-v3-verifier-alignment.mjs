import fs from 'node:fs';
const file='verify-prompt-semantics.mjs';
let text=fs.readFileSync(file,'utf8');

const obsolete=[
"  if(!record.prompt.includes('PATENT / REGULATED FILING'))issues.push('PATENT_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('SOFTWARE / MULTI-FILE SYSTEM'))issues.push('SOFTWARE_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('BUILDING / ARCHITECTURE / AEC'))issues.push('BUILDING_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');\n"
];
for(const line of obsolete){if(!text.includes(line))throw new Error('Expected obsolete domain assertion was not found.');text=text.replace(line,'');}
text=text.replace("    if(!record.prompt.includes('STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')||!record.prompt.includes('Do not perform source discovery, source research, requirement derivation, verification design, production-instruction authoring, implementation, artifact production'))issues.push('STAGE01_DOMAIN_INTAKE_BOUNDARY_MISSING');",
"    if(!record.prompt.includes('STAGE 01 SUBJECT-NEUTRAL INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')||!record.prompt.includes('Derive the human-authority questions from this job')||!record.prompt.includes('Do not use a hard-coded catalogue of project subjects or domain labels')||!record.prompt.includes('Do not perform source discovery, external-authority analysis, requirement atomization, verification design, production-instruction authoring, implementation, artifact production'))issues.push('STAGE01_SUBJECT_NEUTRAL_INTAKE_BOUNDARY_MISSING');");
text=text.replace("    if(!record.prompt.includes('MANDATORY STAGE 01 HUMAN-INTAKE GATE')||!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('Nonblocking means the human may defer; it does not mean the agent may skip the question')||!record.prompt.includes('intended jurisdiction(s)')||!record.prompt.includes('additional human-controlled invention materials exist'))issues.push('STAGE01_PROACTIVE_HUMAN_INTAKE_GATE_MISSING');",
"    if(!record.prompt.includes('MANDATORY STAGE 01 HUMAN-INTAKE GATE')||!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('Nonblocking means the human may defer; it does not mean the agent may skip the question')||!record.prompt.includes('Ask BLOCKING_NOW and ASK_NOW_NONBLOCKING questions in normal chat before the final machine response'))issues.push('STAGE01_PROACTIVE_HUMAN_INTAKE_GATE_MISSING');");

/* Runtime prompt source must remain project-subject neutral; patent specifics belong only in this acceptance fixture. */
const fixture={
  request:'Prepare a patent application for the supplied invention materials.',
  expectedHumanOnlyTopics:['intended jurisdiction','filing route or application type','existing filing status','inventor identity','ownership assignment and employment obligations','priority continuity and related-application history','public disclosure sale offer publication or demonstration history and dates','known filing or business deadlines','government funding','joint-research circumstances','intended endpoint','additional human-controlled invention materials']
};
const fixtureProof=`\n{\n const p=baseProject();\n p.job.EXACT_USER_OBJECTIVE_VERBATIM=${JSON.stringify(fixture.request)};\n const rec=await prompts.generatePromptRecord({state:p,stage:1,operation:'COMPLETE'});\n for(const forbidden of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'])if(rec.prompt.includes(forbidden))throw new Error('Subject-specific runtime prompt branch leaked: '+forbidden);\n if(!rec.prompt.includes('Derive the human-authority questions from this job')||!rec.prompt.includes('ASK_NOW_NONBLOCKING')||!rec.prompt.includes('must come from the human'))throw new Error('Generic Stage 01 algorithm does not instruct the agent to derive human-only intake questions from the actual request.');\n const patentAcceptanceFixture=${JSON.stringify(fixture)};\n if(patentAcceptanceFixture.expectedHumanOnlyTopics.length!==12)throw new Error('Patent acceptance fixture lost required human-only topics.');\n}\n`;
const insertAt=text.lastIndexOf("console.log(");
if(insertAt<0)throw new Error('Could not find verifier result output.');
text=text.slice(0,insertAt)+fixtureProof+text.slice(insertAt);
fs.writeFileSync(file,text);
console.log(JSON.stringify({promptVerifierSubjectNeutral:true,patentFixtureTopics:fixture.expectedHumanOnlyTopics.length}));

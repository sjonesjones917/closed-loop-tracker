import fs from 'node:fs';
const path='verify-prompt-semantics.mjs';
let s=fs.readFileSync(path,'utf8');
const before=s;
for(const line of [
"  if(!record.prompt.includes('PATENT / REGULATED FILING'))issues.push('PATENT_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('SOFTWARE / MULTI-FILE SYSTEM'))issues.push('SOFTWARE_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('BUILDING / ARCHITECTURE / AEC'))issues.push('BUILDING_DOMAIN_RULE_MISSING');\n",
"  if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');\n"
])s=s.replace(line,'');
s=s.replace("    if(!record.prompt.includes('STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')||!record.prompt.includes('Do not perform source discovery, source research, requirement derivation, verification design, production-instruction authoring, implementation, artifact production'))issues.push('STAGE01_DOMAIN_INTAKE_BOUNDARY_MISSING');","    if(!record.prompt.includes('exhaust the human-authority intake')||!record.prompt.includes('Stage 01 must not classify external authority, perform external research, atomize requirements, design tests, or produce the final product'))issues.push('STAGE01_EXHAUSTIVE_INTAKE_BOUNDARY_MISSING');");
s=s.replace("    if(!record.prompt.includes('MANDATORY STAGE 01 HUMAN-INTAKE GATE')||!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('Nonblocking means the human may defer; it does not mean the agent may skip the question')||!record.prompt.includes('intended jurisdiction(s)')||!record.prompt.includes('additional human-controlled invention materials exist'))issues.push('STAGE01_PROACTIVE_HUMAN_INTAKE_GATE_MISSING');","    if(!record.prompt.includes('BLOCKING_NOW')||!record.prompt.includes('ASK_NOW_NONBLOCKING')||!record.prompt.includes('LATER_RESOLVABLE')||!record.prompt.includes('nonblocking never means the question may be skipped')||!record.prompt.includes('every foreseeable human-only issue')||!record.prompt.includes('Never ask the human to repeat facts already present'))issues.push('STAGE01_EXHAUSTIVE_HUMAN_INTAKE_GATE_MISSING');");
s=s.replace("    if(!record.prompt.includes('do not require the human to know those formats in advance')||!record.prompt.includes('absence of a downstream authoring, viewing, compiling, importing, simulation, manufacturing, filing, deployment, or other consuming system is not by itself a reason to downgrade an artifact to prose')||!record.prompt.includes('Only propose an implementation-ready'))issues.push('STAGE01_ARTIFACT_GENERATION_BOUNDARY_MISSING');","    if(!record.prompt.includes('do not require the human to know those formats in advance')||!record.prompt.includes('Artifact generation capability is distinct from downstream execution or verification capability')||!record.prompt.includes('Only propose a specification substitute when the requested artifact itself genuinely cannot be generated reliably'))issues.push('STAGE01_ARTIFACT_GENERATION_BOUNDARY_MISSING');");
const insertion="\nconst promptEngineSource=fs.readFileSync('prompt-engine.js','utf8');\nfor(const prohibited of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'])if(promptEngineSource.includes(prohibited))throw new Error(`Subject-specific runtime prompt branch remains: ${prohibited}`);\n";
const marker="const expectedOperationWrites=";
if(!s.includes(marker))throw new Error('Expected operation writes marker missing.');
s=s.replace(marker,insertion+"\n"+marker);
if(s===before)throw new Error('Prompt-semantic subject-neutral repair made no change.');
fs.writeFileSync(path,s);
console.log('verify-prompt-semantics.mjs: domain-branch requirements replaced by subject-neutral behavioral proof');

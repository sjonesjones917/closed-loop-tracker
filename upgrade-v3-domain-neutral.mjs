import fs from 'node:fs';

const file='prompt-engine.js';
let text=fs.readFileSync(file,'utf8');

const start=text.indexOf("${stage===1?`STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY");
const end=text.indexOf("\n\n${stage===1?`STAGE 01 CLARIFICATION EXPERIENCE",start);
if(start<0||end<0)throw new Error('Could not locate prohibited subject-specific runtime adaptation block.');
const generic=`\${stage===1?\`STAGE 01 SUBJECT-NEUTRAL INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY\nDerive the human-authority questions from this job's actual request, supplied materials that are genuinely available, and current canonical context. Identify only the objective, intended deliverable, supplied materials, explicit constraints/prohibitions, acceptance conditions, human-controlled facts/decisions, and unresolved human-only issues needed to define the requested outcome. Do not use a hard-coded catalogue of project subjects or domain labels. For every missing issue classify whether it must come from the human, can be established from accessible supplied material or authorized research, or is needed only later. Ask the human only for the first category. Do not perform source discovery, external-authority analysis, requirement atomization, verification design, production-instruction authoring, implementation, artifact production, filing, simulation, testing, manufacturing, or other later-stage work.\n\`:\`SUBJECT-NEUTRAL DELIVERABLE ADAPTATION\nDerive all domain-specific behavior from the current project's accepted requirements, governing evidence, supplied materials, required artifact types, interfaces, tool constraints, and current stage purpose. Do not use or infer a hard-coded project-subject mode. Separate artifact generation from downstream execution or verification: when exact artifact bytes can be constructed reliably from accepted inputs, produce the artifact; never claim downstream import, compilation, simulation, manufacturing, filing, deployment, physical performance, or other execution unless it actually occurred and is evidenced. When meaning or a specialized physical/external proposition cannot be faithfully established by the application, route it to the declared independent reviewer, human inspection, external tool, or external system rather than inventing capability.\n\`} `;
text=text.slice(0,start)+generic+text.slice(end);

/* The patent list belongs only to acceptance fixtures. Runtime Stage 01 remains subject-neutral. */
text=text.replace(/For PATENT \/ REGULATED FILING jobs,[\s\S]*?Do not turn researchable legal strategy into a human question\.\n/,"");

if(/PATENT \/ REGULATED FILING|SOFTWARE \/ MULTI-FILE SYSTEM|BUILDING \/ ARCHITECTURE \/ AEC|PHYSICAL \/ MECHANICAL \/ CAD \/ CAM \/ CNC \/ ADDITIVE/.test(text))throw new Error('Project-subject branch remains in prompt-engine.js.');
fs.writeFileSync(file,text);
console.log(JSON.stringify({subjectNeutralPromptRuntime:true,domainBranches:0}));

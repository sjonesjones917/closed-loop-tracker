import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const workbook=read('workbook.js');
const schema=read('workflow-schema.js');
const engine=read('workflow-engine.js');
const prompts=read('prompt-engine.js');
const ingestion=read('response-ingestion.js');
const html=read('index.html');

assert(workbook.includes("const PROJECT_SCHEMA='closed-loop-project/3';"),'Active project schema is not /3.');
assert(schema.includes("const RESPONSE_SCHEMA='closed-loop-stage-response/3';"),'Active response schema is not /3.');
assert(schema.includes("HUMAN_DECISION_JOB_FIELDS=Object.freeze(['JOB_TITLE','JOB_OWNER'])"),'JOB_TITLE/JOB_OWNER are not HUMAN_DECISION owned.');

assert(engine.includes('function stage01IntakeManifest(project)'),'Stage 01 application intake manifest is missing.');
assert(engine.includes("inputUnitId:'INTAKE-'"),'Stage 01 stable application input-unit identity is missing.');
assert(engine.includes('rawValueSha256'),'Stage 01 raw-value hashing is missing.');
assert(engine.includes('coverage:normalized.length?accounted/normalized.length:1'),'Stage 01 application coverage calculation is missing.');
assert(engine.includes('complete:accounted===normalized.length'),'Stage 01 zero-loss completion calculation is missing.');
assert(prompts.includes('STAGE 01 COMPLETE HUMAN-AUTHORITY INTAKE'),'Prompt 1 does not explicitly command complete human-authority intake.');
assert(prompts.includes('Every application-enumerated intake unit above must receive a semantic disposition'),'Prompt 1 does not require exhaustive identity accounting.');
assert(prompts.includes('Do not silently omit, compress away, or postpone any human-supplied fact, requirement, constraint, decision, prohibition, requested output, acceptance condition, material reference, or unresolved human-only issue'),'Prompt 1 does not explicitly prohibit semantic loss.');

assert(engine.includes('function stage03ResearchCoverage(project)'),'Stage 03 exhaustive research evaluator is missing.');
assert(engine.includes('unsaturatedSourceIds'),'Stage 03 saturation check is missing.');
assert(engine.includes('secondConflictAndExceptionPassCompleted'),'Stage 03 second-pass check is missing.');
assert(engine.includes('latestPassFoundNoNewMaterialCategory'),'Stage 03 no-new-material saturation check is missing.');
assert(prompts.includes('STAGE 03 EXHAUSTIVE SOURCE RESEARCH'),'Prompt 3 does not explicitly command exhaustive research.');
assert(prompts.includes('Do not stop at a first pass'),'Prompt 3 does not require exhaustive passes.');

assert(engine.includes('function stage04ObligationManifest(project)'),'Stage 04 application obligation manifest is missing.');
for(const required of ['HUMAN_INTENT','STAGE01_ACCEPTED','STAGE03_RESEARCH','STAGE03_CANDIDATE','SOURCE_IDENTITY'])assert(engine.includes("origin:'"+required+"'"),'Stage 04 obligation universe omits '+required+'.');
assert(prompts.includes('STAGE 04 CLOSED OBLIGATION ACCOUNTING — ZERO LOSS REQUIRED'),'Prompt 4 zero-loss accounting command is missing.');
assert(prompts.includes('The application-generated Stage 04 obligation manifest above is the complete compilation universe'),'Prompt 4 does not bind itself to the application-generated universe.');
assert(prompts.includes('No obligation may disappear.'),'Prompt 4 does not explicitly prohibit obligation loss.');
assert(prompts.includes('Do not ask the human to attach, resend, retype, summarize, reconstruct, or reopen information already captured.'),'Prompt 4 still permits repeated user supply.');
assert(prompts.includes('never convert an upstream capture defect into another user attachment request'),'Prompt 4 does not route upstream incompleteness back to its responsible stage.');
assert(ingestion.includes('MISSING_OBLIGATION_ACCOUNTING'),'Ingestion does not reject omitted Stage 04 obligations.');
assert(ingestion.includes('MISSING_INTAKE_ACCOUNTING'),'Ingestion does not reject omitted Stage 01 intake units.');

assert(!prompts.includes('Attach or provide the original material with the Stage 04 instruction.'),'Stage 4 still asks for the original intent material.');
assert(!prompts.includes('Send the Stage 04 instruction with'),'Stage 4 still tells the user to resend prior material.');
assert(prompts.includes('The original intent file is prohibited.'),'Later prompt flow does not prohibit intent-file reuse.');

assert(html.includes('.expandable-prompt{max-height:280px}'),'Established 280px prompt preview visual was changed.');
assert(html.includes("worker-src 'self'"),'Same-origin worker CSP is missing.');
assert(/workflow-schema\.js\?v=([^\"]+)[\s\S]*test-runtime\.js\?v=\1[\s\S]*workflow-engine\.js\?v=\1/.test(html),'Runtime script order/shared cache identity is wrong.');

console.log('verify-v3-intake-obligation: PASS');

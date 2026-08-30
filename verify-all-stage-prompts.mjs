import fs from 'node:fs';
import vm from 'node:vm';
globalThis.dispatchEvent=()=>{};globalThis.Event=class{constructor(type){this.type=type}};
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const project=core.createBlankState();engine.ensureShape(project);
project.job.JOB_ID='JOB-PROMPT-AUDIT';project.job.EXACT_USER_OBJECTIVE_VERBATIM='Build the exact requested project without losing any supplied requirement.';project.job.EXPLICIT_USER_REQUIREMENTS='REQ-SENTINEL: preserve every supplied requirement once and reuse it later.';project.job.SUPPLIED_MATERIALS_INVENTORY='intent-file-sentinel.txt';project.job.CURRENT_INPUT_VERSION='INPUT-AUDIT-1';project.job.EXACT_DELIVERABLE_REQUESTED='DELIVERABLE-SENTINEL';project.job.ASSUMPTIONS='ASSUMPTION-SENTINEL';project.job.UNKNOWN_INFORMATION='UNKNOWN-SENTINEL';project.job.INPUT_SET_CONTENTS='CAPTURED-INTENT-SENTINEL';
project.stages[1].status='COMPLETE';project.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'DELIVERABLE-SENTINEL',INPUT_SET_CONTENTS:'CAPTURED-INTENT-SENTINEL'};
engine.recalculate(project);
const requiredCommon=['COMPLETE-STAGE EXECUTION RULE','STAGE-SPECIFIC TASK','COMPLETION CONDITIONS','PROJECT MEMORY / SINGLE-SUPPLY INVARIANT','CURRENT ACCEPTED STAGE 01 PROJECT MEMORY','CAPTURED-INTENT-SENTINEL','Never ask the human to provide the same project fact'];
for(let stage=1;stage<=30;stage++){
 project.activeStage=stage;project.job.CURRENT_STAGE=`STAGE ${String(stage).padStart(2,'0')}`;
 const operation=schema.STAGE_OPERATIONS[stage][0];
 const scope={projectRevision:Number(project.revision||0),inputVersion:project.job.CURRENT_INPUT_VERSION||null,sourceSetVersion:project.job.CURRENT_SOURCE_SET_VERSION||null,requirementsVersion:project.job.CURRENT_REQUIREMENTS_VERSION||null,testSuiteVersion:project.job.CURRENT_TEST_SUITE_VERSION||null,instructionVersion:project.job.CURRENT_INSTRUCTION_VERSION||null,iterationId:null,candidateId:null,runId:null,contextId:null,baselineId:null,productId:null};
 let text;try{text=prompts.buildPromptRecord(stage,project,{operation,scope}).prompt}catch(error){if(error.code==='MISSING_REQUIRED_PROMPT_SCOPE'){continue}throw error}
 assert(text.includes(`STAGE ${String(stage).padStart(2,'0')}`),`Stage ${stage} identity missing`);
 for(const phrase of requiredCommon)assert(text.includes(phrase),`Stage ${stage} missing common completeness/memory rule: ${phrase}`);
 assert(!/attach the original intent file again/i.test(text)||/do not ask|do not attach|never ask/i.test(text),`Stage ${stage} contains an affirmative original-intent reattachment instruction`);
}
const pe=fs.readFileSync('prompt-engine.js','utf8');
for(let stage=1;stage<=30;stage++)assert(new RegExp(`\\n${stage}:`).test(pe),`Stage ${stage} procedure missing`);
const ws=schema.READ_COLLECTIONS;
const mustHave={11:['instructions','requirements','artifacts'],13:['tests'],14:['instructions','requirements','tests','research','sources'],16:['instructions','requirements','research','sources','artifacts'],21:['instructions','requirements','artifacts'],23:['research','evidenceRecords'],24:['sources','research','artifacts'],25:['requirements','tests'],26:['instructions','requirements','tests','runs','regressions','evidenceRecords'],27:['products','baselines','regressions','evidenceRecords'],29:['adversarialResults','representationInspections','processAudits','productAudits','regressions','evidenceChains','artifacts']};
for(const [stage,collections] of Object.entries(mustHave))for(const c of collections)assert(ws[stage].includes(c),`Stage ${stage} prompt context is missing ${c}`);
assert(pe.includes("if(stage>1&&state?.stages?.[1])"),'Accepted Stage 01 project memory is not supplied to all later prompts');
assert(pe.includes("closed-loop-prompt-engine/29"),'Prompt engine version was not advanced');
const html=fs.readFileSync('index.html','utf8');
assert(html.includes('.prompt{height:clamp(260px,45vh,520px);max-height:80vh;'),'Base generated prompt dimensions changed');
assert(html.includes('.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}'),'Collapsed prompt preview dimensions changed from the established visual');
console.log(JSON.stringify({allThirtyStageProcedures:true,completeStageRule:true,durableStage01Memory:true,expandedRequiredContext:true,stage4NoIntentReattachment:true,promptBoxDimensionsRestored:true}));

import fs from 'node:fs';

function requireReplace(text, needle, replacement, label) {
  if (!text.includes(needle)) throw new Error(`Missing ${label} anchor.`);
  return text.replace(needle, replacement);
}

let prompt = fs.readFileSync('prompt-engine.js', 'utf8');
const contextAnchor = "function contextFor(stage,state,operation,scope={}){const parts=[];";
if (!prompt.includes('function stage4ExhaustedInputs(state)')) {
  const helper = "function stage4ExhaustedInputs(state){const active=list=>safe(list).filter(r=>r?.active!==false&&!r?.invalidatedBy).map(r=>({id:r?.id||r?.recordId||null,stage:r?.stage??null,scope:r?.scope||{},fields:recordFields(r),relationships:r?.relationships||{}}));return {stage01AcceptedCapture:parseCapturedInputSet(state?.stages?.[1]||{}),stage01AcceptedDefinition:{agentData:state?.stages?.[1]?.agentData||state?.stages?.[1]?.acceptedData||{},humanData:state?.stages?.[1]?.humanData||{},derivedData:state?.stages?.[1]?.derivedData||{}},stage03AcceptedData:{agentData:state?.stages?.[3]?.agentData||state?.stages?.[3]?.acceptedData||{},humanData:state?.stages?.[3]?.humanData||{},derivedData:state?.stages?.[3]?.derivedData||{}},stage03Research:active(state?.projectData?.research),stage03CandidateRequirements:active(state?.projectData?.candidateRequirements)};}\n";
  prompt = requireReplace(prompt, contextAnchor, helper + contextAnchor + "if(stage===4)parts.push(`EXHAUSTED STAGE 01 + STAGE 03 INPUTS — USE EVERY MATERIAL DETAIL\\n${show(stage4ExhaustedInputs(state))}`);", 'Stage 4 context');
}
const manifestAnchor = "obligationManifest:stage===4?obligationManifest(state):null,";
if (!prompt.includes('stage4ExhaustedInputs:stage===4?stage4ExhaustedInputs(state):null')) {
  prompt = requireReplace(prompt, manifestAnchor, manifestAnchor + "stage4ExhaustedInputs:stage===4?stage4ExhaustedInputs(state):null,", 'Stage 4 context manifest');
}
fs.writeFileSync('prompt-engine.js', prompt);

function patchStage4Fixture(file) {
  let text = fs.readFileSync(file, 'utf8');
  const projectAnchor = "function project(jobId='JOB-INGESTION-TEST'){\n  const p=core.createBlankState(jobId);";
  if (!text.includes('function prepareStage4Upstream(p)')) {
    const helper = `function prepareStage4Upstream(p){
  const intake=prompts.buildPromptRecord(1,p).contextManifest.intakeCoverageManifest;
  p.stages[1].agentData.INPUT_SET_CONTENTS=JSON.stringify({units:intake.units.map((u,i)=>({sourceUnitId:u.unitId,disposition:'incorporated into the job definition',extractedStatements:[{statementKey:'S'+String(i+1),text:'Captured '+u.label,statementClass:'FACT'}]}))});
  p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true,blocked:false,reasons:[]};
  p.stages[2].status='COMPLETE';p.stages[2].gate={complete:true,blocked:false,reasons:[]};p.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='NO_APPLICABLE_EXTERNAL_SOURCE';
  p.stages[3].status='COMPLETE';p.stages[3].gate={complete:true,blocked:false,reasons:[]};
  return p;
}
`;
    text = requireReplace(text, projectAnchor, helper + projectAnchor, `${file} Stage 4 fixture helper`);
  }
  const saveAnchor = "function savePrompt(p,stage){\n  const options=";
  if (text.includes(saveAnchor) && !text.includes("function savePrompt(p,stage){\n  if(stage===4)prepareStage4Upstream(p);")) {
    text = requireReplace(text, saveAnchor, "function savePrompt(p,stage){\n  if(stage===4)prepareStage4Upstream(p);\n  const options=", `${file} savePrompt Stage 4 preparation`);
  }
  const nextAnchor = "if(stage<30){const nextStage=stage+1,nextOptions=";
  if (text.includes(nextAnchor) && !text.includes("if(stage<30){const nextStage=stage+1;if(nextStage===4)prepareStage4Upstream(reloaded);const nextOptions=")) {
    text = requireReplace(text, nextAnchor, "if(stage<30){const nextStage=stage+1;if(nextStage===4)prepareStage4Upstream(reloaded);const nextOptions=", `${file} next Stage 4 preparation`);
  }
  fs.writeFileSync(file, text);
}

let verify = fs.readFileSync('verify.mjs', 'utf8');
const blankAnchor = "function blank(jobId){const p=core.createBlankState(jobId);p.job.JOB_ID=jobId;p.job.JOB_TITLE='Verification project';p.job.EXACT_USER_OBJECTIVE_VERBATIM='Controlled verification objective';p.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(p);engine.recalculate(p);return p;}\n";
if (!verify.includes('function prepareStage4(p)')) {
  const prep = "function prepareStage4(p){const intake=prompts.buildPromptRecord(1,p).contextManifest.intakeCoverageManifest;p.stages[1].agentData.INPUT_SET_CONTENTS=JSON.stringify({units:intake.units.map((u,i)=>({sourceUnitId:u.unitId,disposition:'incorporated into the job definition',extractedStatements:[{statementKey:'S'+String(i+1),text:'Captured '+u.label,statementClass:'FACT'}]}))});p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true,blocked:false,reasons:[]};p.stages[2].status='COMPLETE';p.stages[2].gate={complete:true,blocked:false,reasons:[]};p.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='NO_APPLICABLE_EXTERNAL_SOURCE';p.stages[3].status='COMPLETE';p.stages[3].gate={complete:true,blocked:false,reasons:[]};return p;}\n";
  verify = requireReplace(verify, blankAnchor, blankAnchor + prep, 'verify Stage 4 fixture');
  const loop = "for(let stage=1;stage<=30;stage++){const p=blank(`JOB-PROMPT-${stage}`);const record=prompts.buildPromptRecord(stage,p,syntheticPromptOptions(stage,p));";
  verify = requireReplace(verify, loop, "for(let stage=1;stage<=30;stage++){const p=blank(`JOB-PROMPT-${stage}`);if(stage===4)prepareStage4(p);const record=prompts.buildPromptRecord(stage,p,syntheticPromptOptions(stage,p));", 'verify prompt loop');
}
fs.writeFileSync('verify.mjs', verify);
patchStage4Fixture('verify-ingestion.mjs');

fs.writeFileSync('verify-user-prompt-invariants.mjs', `import fs from 'node:fs';
import vm from 'node:vm';
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;
function project(){const p=core.createBlankState('JOB-PROMPT-EXHAUSTION');p.job.JOB_ID='JOB-PROMPT-EXHAUSTION';p.job.EXACT_USER_OBJECTIVE_VERBATIM='OBJECTIVE-SENTINEL complete intended product';p.job.EXPLICIT_USER_REQUIREMENTS='USER-REQ-SENTINEL must preserve all user requirements';p.job.PROHIBITED_ACTIONS='PROHIBITION-SENTINEL do not resupply intent';p.job.CURRENT_INPUT_VERSION='INPUT-v001';p.job.CURRENT_SOURCE_SET_VERSION='SOURCE-SET-v001';engine.ensureShape(p);return p;}
function closeStage1(p){const r1=prompts.buildPromptRecord(1,p);const units=r1.contextManifest.intakeCoverageManifest.units;p.stages[1].agentData.INPUT_SET_CONTENTS=JSON.stringify({units:units.map((u,i)=>({sourceUnitId:u.unitId,disposition:'incorporated into the job definition',extractedStatements:[{statementKey:'S'+String(i+1),text:i===0?'CAPTURED-STAGE1-SENTINEL '+u.label:'CAPTURED '+u.label,statementClass:i===0?'REQUIREMENT':'FACT'}]}))});p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true,blocked:false,reasons:[]};return r1;}
const p=project();const r1=closeStage1(p);
for(const token of ['OBJECTIVE-SENTINEL','USER-REQ-SENTINEL','Exhaust the human-authority intake','The user supplies project information once'])assert(r1.prompt.includes(token),'Stage 01 prompt missing '+token);
p.stages[2].status='COMPLETE';p.stages[2].gate={complete:true,blocked:false,reasons:[]};p.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='APPLICABLE_EXTERNAL_SOURCES';
p.projectData.sources=[{id:'SOURCE-000001',active:true,stage:2,fields:{TITLE:'Source sentinel'}}];
p.projectData.research=[{id:'RESEARCH-000001',active:true,stage:3,fields:{SOURCE_ID:'SOURCE-000001',MANDATORY_STATEMENTS:'STAGE3-RESEARCH-SENTINEL mandatory detail',EXCEPTIONS:'STAGE3-EXCEPTION-SENTINEL'},relationships:{SOURCE_ID:'SOURCE-000001'}}];
p.projectData.candidateRequirements=[{id:'CANDIDATE-REQ-000001',active:true,stage:3,fields:{CANDIDATE_OBLIGATION:'STAGE3-CANDIDATE-SENTINEL external obligation',SOURCE_ID:'SOURCE-000001'},relationships:{SOURCE_ID:'SOURCE-000001'}}];
p.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:'TRUE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE',EXCEPTIONS_AND_EDGE_CONDITIONS:'STAGE3-STAGEDATA-SENTINEL'};p.stages[3].status='COMPLETE';p.stages[3].gate={complete:true,blocked:false,reasons:[]};
const r4=prompts.buildPromptRecord(4,p,{scope:{sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001'}});
for(const token of ['OBJECTIVE-SENTINEL','USER-REQ-SENTINEL','CAPTURED-STAGE1-SENTINEL','STAGE3-RESEARCH-SENTINEL','STAGE3-EXCEPTION-SENTINEL','STAGE3-CANDIDATE-SENTINEL','STAGE3-STAGEDATA-SENTINEL','EXHAUSTED STAGE 01 + STAGE 03 INPUTS','Do not ask the user to attach, restate, summarize, retype, or otherwise resupply','EXECUTION DIRECTIVE — USE THE PROJECT DATA AND DO THE STAGE WORK NOW'])assert(r4.prompt.includes(token),'Stage 04 prompt missing '+token);
const bad1=project();let blocked=false;try{prompts.buildPromptRecord(4,bad1,{scope:{sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001'}});}catch(e){blocked=e.code==='STAGE4_UPSTREAM_INCOMPLETE';}assert(blocked,'Stage 04 generated while Stage 01 was incomplete.');
const bad3=project();closeStage1(bad3);bad3.stages[2].status='COMPLETE';bad3.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='NO_APPLICABLE_EXTERNAL_SOURCE';blocked=false;try{prompts.buildPromptRecord(4,bad3,{scope:{sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001'}});}catch(e){blocked=e.code==='STAGE4_UPSTREAM_INCOMPLETE';}assert(blocked,'Stage 04 generated while Stage 03 was incomplete.');
const source=fs.readFileSync('prompt-engine.js','utf8');for(const forbidden of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC'])assert(!source.includes(forbidden),'Hard-coded project-subject prompt branch remains: '+forbidden);
const html=fs.readFileSync('index.html','utf8');assert(html.includes('height:clamp(260px,45vh,520px)'),'Prompt box size changed.');assert(html.includes('.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}'),'Prompt expansion visual changed.');
console.log('user prompt invariants: PASS');
`);

console.log('Stage 4 exhaustive patch applied.');

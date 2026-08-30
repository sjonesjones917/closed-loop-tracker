import fs from 'node:fs';
import vm from 'node:vm';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;const assert=(v,m)=>{if(!v)throw new Error(m);};
const p=core.createBlankState('JOB-EXHAUSTION-PROOF');Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Create the requested deliverable without losing any project requirement.',SUPPLIED_MATERIALS_INVENTORY:'intent.txt',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001'});engine.ensureShape(p);
const s1=prompts.buildPromptRecord(1,p).prompt;assert(s1.includes('BLOCKING_NOW')&&s1.includes('ASK_NOW_NONBLOCKING')&&s1.includes('LATER_RESOLVABLE'),'Stage 01 prompt does not enforce question classification.');
let blocked=false;try{prompts.buildPromptRecord(4,p);}catch(error){blocked=error?.code==='INCOMPLETE_STAGE04_PREREQUISITES';}assert(blocked,'Stage 04 prompt generation did not fail closed while Stage 01/03 were incomplete.');console.log('verify-stage01-stage03-exhaustion: PASS');

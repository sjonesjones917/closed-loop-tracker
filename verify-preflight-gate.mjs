import fs from 'node:fs';
import vm from 'node:vm';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;
const assert=(v,m)=>{if(!v)throw new Error(m)};
function fixture(jobId){
 const p=core.createBlankState(jobId);engine.ensureShape(p);
 Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Produce the current required deliverable.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'});
 for(let n=1;n<=8;n++){p.stages[n].status='COMPLETE';p.stages[n].gate={complete:true,blocked:false,reasons:[]};}
 return p;
}
{
 const p=fixture('JOB-PREFLIGHT-NONE');
 const gate=engine.gate(9,p);
 assert(!gate.complete,'Stage 09 accepted a missing independent preflight record.');
}
{
 const p=fixture('JOB-PREFLIGHT-VIOLATED');
 const scope=engine.currentScope(p);
 p.projectData.preflightRecords.push({id:'REVIEW-1',stage:9,active:true,scope,fields:{REVIEW_ID:'REVIEW-1',CLAUSE:'Full instruction',DETERMINATION:'VIOLATED',FINDINGS:'Material ambiguity remains unresolved.',EVIDENCE:'Independent review evidence',STATUS:'COMPLETE'},relationships:{INSTRUCTION_ID:'INSTRUCTION-1'}});
 const gate=engine.gate(9,p);
 assert(!gate.complete,'Stage 09 accepted an unresolved material preflight finding.');
}
{
 const p=fixture('JOB-PREFLIGHT-REPAIRED');
 const scope=engine.currentScope(p);
 p.projectData.preflightRecords.push({id:'REVIEW-1',stage:9,active:true,scope,fields:{REVIEW_ID:'REVIEW-1',CLAUSE:'Full instruction',DETERMINATION:'SATISFIED',FINDINGS:'No material ambiguity, conflict, unavailable capability, or unverifiable clause remains.',EVIDENCE:'Independent review evidence',STATUS:'COMPLETE'},relationships:{INSTRUCTION_ID:'INSTRUCTION-1'}});
 const gate=engine.gate(9,p);
 assert(gate.complete,`Repaired Stage 09 preflight did not progress: ${gate.reasons.join(' | ')}`);
 const prompt=prompts.buildPromptRecord(9,p,{operation:'COMPLETE'}).prompt.toLowerCase();
 for(const token of ['independent','preflight','without executing','material'])assert(prompt.includes(token),`Stage 09 prompt lacks controlling semantic: ${token}`);
}
console.log(JSON.stringify({controllerStage:'13',applicationStage:'09',independentPreflight:'PASS',intentionalInvalidFixturesRejected:['missing-preflight-record','unresolved-material-finding'],repairedPathProgressed:true,promptSemanticsChecked:true,isolatedDisposableProjects:true},null,2));

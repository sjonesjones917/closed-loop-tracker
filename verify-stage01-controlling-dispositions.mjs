import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;
const make=()=>{const p=core.createBlankState('JOB-STAGE01-DISPOSITIONS');p.job.JOB_ID='JOB-STAGE01-DISPOSITIONS';p.job.EXACT_USER_OBJECTIVE_VERBATIM='Preserve the complete controlling request.';p.job.CURRENT_INPUT_VERSION='INPUT-v001';engine.ensureShape(p);engine.recalculate(p);return p;};
const capture=(p,disposition,statements=true)=>{const m=engine.intakeCoverageManifest(p);return {schema:'closed-loop-stage01-capture/1',inputVersion:m.inputVersion,manifestSha256:m.manifestSha256,units:m.units.map((u,i)=>({sourceUnitId:u.unitId,sourceRawValueSha256:u.rawValueSha256,disposition,reason:'fixture',extractedStatements:statements?[{statementKey:`S${i}`,text:u.rawValueText||'retained context',statementClass:'CONTEXT'}]:[]}))};};
{
 const p=make(),r=engine.evaluateIntakeAccounting(p,{capture:capture(p,'incorporated into the job definition')});
 assert.equal(r.complete,false,'Legacy implementation-chosen disposition must be rejected.');
 assert(r.reasons.some(x=>/invalid disposition/i.test(x)),'Legacy disposition rejection reason missing.');
}
for(const disposition of ['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE']){
 const p=make(),r=engine.evaluateIntakeAccounting(p,{capture:capture(p,disposition,true)});assert.equal(r.complete,true,`${disposition} should be valid with traced statements.`);
}
{
 const p=make(),r=engine.evaluateIntakeAccounting(p,{capture:capture(p,'NO_PROJECT_RELEVANT_INFORMATION',false)});assert.equal(r.complete,true,'NO_PROJECT_RELEVANT_INFORMATION must account for a unit without fabricating a semantic statement.');
}
{
 const p=make(),r=engine.evaluateIntakeAccounting(p,{capture:capture(p,'INACCESSIBLE_OR_BLOCKED',false)});assert.equal(r.complete,false,'INACCESSIBLE_OR_BLOCKED must fail Stage 01 closed.');assert(r.reasons.some(x=>/removes it from scope through a new input version/i.test(x)),'Blocked material must state the required human scope-removal path.');
}
{
 const p=make(),pr=prompts.buildPromptRecord(1,p);for(const d of ['EXTRACTED_RELEVANT_INFORMATION','RETAINED_AS_CONTEXT','NO_PROJECT_RELEVANT_INFORMATION','UNRESOLVED_HUMAN_AUTHORITY','LATER_RESOLVABLE','INACCESSIBLE_OR_BLOCKED'])assert(pr.prompt.includes(d),`Stage 01 prompt omitted controlling disposition ${d}.`);
}
console.log(JSON.stringify({stage01ControllingDispositionContract:'PASS'}));

import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine;
if(core.PROJECT_SCHEMA!=='closed-loop-project/3'||schema.RESPONSE_SCHEMA!=='closed-loop-stage-response/3')throw new Error('Stage 04 repair did not activate /3 contracts.');
const p=core.createBlankState('JOB-STAGE4-REUSE');
delete p.job.DESIRED_SOURCE_COUNT;
engine.ensureShape(p);
engine.currentIntakeCoverageManifest(p);
Object.assign(p.job,{
  EXACT_USER_OBJECTIVE_VERBATIM:'Build the requested system. NEVER-RESUPPLY-INTENT-SENTINEL must survive into Stage 04.',
  SUPPLIED_MATERIALS_INVENTORY:'intent.txt',
  EXPLICIT_USER_REQUIREMENTS:'The user supplies project intent once.\nLater stages must consume captured canonical intent.',
  CURRENT_INPUT_VERSION:'INPUT-v001',
  CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001'
});
engine.ensureShape(p);
engine.recordHumanInputVersion(p,['EXACT_USER_OBJECTIVE_VERBATIM','SUPPLIED_MATERIALS_INVENTORY','EXPLICIT_USER_REQUIREMENTS'],'TEST');
engine.recalculate(p);
let intake=engine.currentIntakeCoverageManifest(p);
if(!intake.units.some(unit=>unit.rawValue.includes('NEVER-RESUPPLY-INTENT-SENTINEL')))throw new Error('Current intake manifest lost supplied intent.');
p.projectData.acceptedChanges.push({changeId:'ACCEPTED-STAGE1',stage:1,status:'COMMITTED',responseType:'DATA_PROPOSAL',rawResponseId:'RAW-STAGE1'});
p.stages[1].acceptedDataChangeIds=['ACCEPTED-STAGE1'];
p.stages[1].agentData={
  EXACT_DELIVERABLE_REQUESTED:'A closed-loop reliability application.',
  ASSUMPTIONS:'NONE',
  UNKNOWN_INFORMATION:'NONE',
  INPUT_SET_CONTENTS:'intent.txt: NEVER-RESUPPLY-INTENT-SENTINEL. The user supplies project intent once. Later stages consume captured canonical intent.',
  INTAKE_ACCOUNTING:intake.units.map(unit=>({inputUnitId:unit.inputUnitId,disposition:'INCORPORATED_INTO_JOB_DEFINITION',reason:''}))
};
Object.assign(p.job,{
  EXACT_DELIVERABLE_REQUESTED:p.stages[1].agentData.EXACT_DELIVERABLE_REQUESTED,
  ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:p.stages[1].agentData.INPUT_SET_CONTENTS
});
engine.recalculate(p);
intake=engine.currentIntakeCoverageManifest(p);
if(intake.status!=='COMPLETE'||intake.coverage!==1)throw new Error('Stage 01 intake manifest did not close at 100%.');
if(!intake.capturedMaterialUnits.some(unit=>unit.rawValue.includes('NEVER-RESUPPLY-INTENT-SENTINEL')))throw new Error('Stage 01 semantic capture was not persisted.');
const obligation=engine.currentObligationManifest(p);
if(!obligation.obligations.some(unit=>unit.rawValue.includes('NEVER-RESUPPLY-INTENT-SENTINEL')))throw new Error('Stage 04 obligation manifest did not inherit captured intent.');
const omitted=engine.evaluateObligationAccounting(p,[],{manifest:obligation,requirementTempKeys:['req-1']});
if(omitted.complete||!omitted.missingIds.length)throw new Error('Incomplete Stage 04 accounting was not rejected.');
const complete=engine.evaluateObligationAccounting(p,obligation.obligations.map(item=>({obligationId:item.obligationId,disposition:'REQUIREMENT',requirementTempKeys:['req-1'],reason:''})),{manifest:obligation,requirementTempKeys:['req-1']});
if(!complete.complete||complete.coverage!==1)throw new Error('Complete Stage 04 accounting did not close.');
const prompt=prompts.buildPromptRecord(4,p);
if(!prompt.prompt.includes('NEVER-RESUPPLY-INTENT-SENTINEL'))throw new Error('Stage 04 prompt did not receive captured intent.');
if(!prompt.prompt.includes(obligation.manifestId)||!prompt.contextManifest.obligationManifest?.manifestId)throw new Error('Stage 04 prompt identity is not bound to the obligation manifest.');
if(!prompt.prompt.includes('Do not ask the human to attach, resend, retype, or summarize the original intent file'))throw new Error('Stage 04 no-resupply rule missing.');
const legacy=JSON.parse(JSON.stringify(p));
legacy.schema='closed-loop-project/2';
const migrated=core.migrateState(legacy);
if(migrated.schema!=='closed-loop-project/3'||!migrated.projectData.migrationArchives.some(item=>item.schema==='closed-loop-project/2'))throw new Error('/2 to /3 migration failed or lost audit source.');
const migratedAgain=core.migrateState(JSON.parse(JSON.stringify(legacy)));
if(JSON.stringify(migrated)!==JSON.stringify(migratedAgain))throw new Error('/2 to /3 migration is not deterministic for identical input.');
console.log('Stage 01 capture -> Stage 04 canonical reuse regression passed.');

import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f});

const core=closedLoopCore,schema=closedLoopWorkflowSchema,rt=closedLoopTestRuntime,engine=closedLoopWorkflowEngine,prompt=closedLoopPromptEngine;
assert.equal(core.PROJECT_SCHEMA,'closed-loop-project/3');
assert.equal(schema.RESPONSE_SCHEMA,'closed-loop-stage-response/3');
assert.equal(core.WORKFLOW_ID,'mobile-closed-loop/30');
assert.equal(core.STAGE_COUNT,30);
assert.equal(core.STAGES[15].title,'CORRECT THE ROOT CAUSE');
assert.equal(schema.JOB_FIELDS.JOB_TITLE.producer,'HUMAN_DECISION');
assert.equal(schema.JOB_FIELDS.JOB_OWNER.producer,'HUMAN_DECISION');
assert(rt.OPS.includes('PARSE_XML')&&rt.OPS.includes('SELECT_XML'));

const html=fs.readFileSync('index.html','utf8');
assert(!html.includes('.expandable-prompt{height:280px;max-height:280px}'));
assert(html.includes('.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}'));
assert(html.indexOf('workflow-schema.js')<html.indexOf('test-runtime.js')&&html.indexOf('test-runtime.js')<html.indexOf('workflow-engine.js'));
assert(html.includes("worker-src 'self'"));

const legacy=core.createBlankState('J');
legacy.schema='closed-loop-project/2';
legacy.projectData.extensionX={x:1};
const migrated=core.migrateState(legacy);
assert.equal(migrated.schema,'closed-loop-project/3');
assert.deepEqual(migrated.projectData.extensionX,{x:1});

const p=core.createBlankState('CAPTURE');
Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Build the requested thing',EXPLICIT_USER_REQUIREMENTS:'Never ask me for the same project data twice',SUPPLIED_MATERIALS_INVENTORY:'intent.pdf',EXACT_DELIVERABLE_REQUESTED:'finished product',INPUT_SET_CONTENTS:'captured project requirements'});
engine.ensureShape(p);
engine.recalculate(p);
for(let stage=1;stage<=3;stage++){p.stages[stage].status='COMPLETE';p.stages[stage].gate={complete:true,satisfied:true,reasons:[]};}
const intake=engine.intakeCoverageManifest(p),ob=engine.obligationManifest(p);
assert(intake.unitCount>=3);
assert(ob.items.some(x=>String(x.text).includes('Never ask me')));
const pr=prompt.buildPromptRecord(4,p).prompt;
for(const t of ['PROJECT DATA EXECUTION RULE — MANDATORY','APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST','Never ask the human','Never ask me for the same project data twice'])assert(pr.includes(t),t);

console.log(JSON.stringify({projectSchema:core.PROJECT_SCHEMA,responseSchema:schema.RESPONSE_SCHEMA,stageCount:core.STAGE_COUNT,intake:intake.unitCount,obligations:ob.items.length,visualBaselineRestored:true,testRuntimeLoaded:true}));

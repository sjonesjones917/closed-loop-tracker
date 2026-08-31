import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=closedLoopCore;
const schema=closedLoopWorkflowSchema;
const runtime=closedLoopTestRuntime;
const engine=closedLoopWorkflowEngine;
const prompt=closedLoopPromptEngine;

assert.equal(core.PROJECT_SCHEMA,'closed-loop-project/3');
assert.equal(schema.RESPONSE_SCHEMA,'closed-loop-stage-response/3');
assert.equal(core.WORKFLOW_ID,'mobile-closed-loop/30');
assert.equal(core.STAGE_COUNT,30);
assert.equal(core.STAGES[15].title,'CORRECT THE ROOT CAUSE');
assert.equal(schema.JOB_FIELDS.JOB_TITLE.producer,'HUMAN_DECISION');
assert.equal(schema.JOB_FIELDS.JOB_OWNER.producer,'HUMAN_DECISION');
assert(runtime.OPS.includes('PARSE_XML')&&runtime.OPS.includes('SELECT_XML'));

const html=fs.readFileSync('index.html','utf8');
assert(html.includes('.expandable-prompt{height:280px;max-height:280px}'),'collapsed prompt box must retain the approved 280px geometry');
assert(html.includes('.expandable-prompt.expanded{height:auto;max-height:none}'),'expanded prompt box must remain unbounded');
assert(html.indexOf('workflow-schema.js')<html.indexOf('test-runtime.js')&&html.indexOf('test-runtime.js')<html.indexOf('workflow-engine.js'));
assert(html.includes("worker-src 'self'"));

const legacy=core.createBlankState('J');
legacy.schema='closed-loop-project/2';
legacy.projectData.extensionX={x:1};
const migrated=core.migrateState(legacy);
assert.equal(migrated.schema,'closed-loop-project/3');
assert.deepEqual(migrated.projectData.extensionX,{x:1});

const project=core.createBlankState('CAPTURE');
Object.assign(project.job,{
  EXACT_USER_OBJECTIVE_VERBATIM:'Build the requested thing',
  EXPLICIT_USER_REQUIREMENTS:'Never ask me for the same project data twice',
  SUPPLIED_MATERIALS_INVENTORY:'intent.pdf',
  EXACT_DELIVERABLE_REQUESTED:'finished product',
  INPUT_SET_CONTENTS:'captured project requirements'
});
engine.ensureShape(project);
engine.recalculate(project);
const intake=engine.stage01IntakeManifest(project);
const obligations=engine.stage04ObligationManifest(project);
assert(intake.entries.length>=3);
assert(obligations.entries.some(entry=>String(entry.value).includes('Never ask me')));
const stage04Prompt=prompt.buildPromptRecord(4,project).prompt;
for(const token of ['PROJECT DATA EXECUTION RULE — MANDATORY','APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST','Never ask the human','Never ask me for the same project data twice'])assert(stage04Prompt.includes(token),token);

console.log(JSON.stringify({
  projectSchema:core.PROJECT_SCHEMA,
  responseSchema:schema.RESPONSE_SCHEMA,
  stageCount:core.STAGE_COUNT,
  intake:intake.entries.length,
  obligations:obligations.entries.length,
  visualBaselineRestored:true,
  collapsedPromptHeightPx:280,
  testRuntimeLoaded:true
}));
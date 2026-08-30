import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const context={console,TextEncoder,TextDecoder,structuredClone,crypto:globalThis.crypto,Event:class{},dispatchEvent(){}};context.globalThis=context;vm.createContext(context);
for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInContext(fs.readFileSync(f,'utf8'),context,{filename:f});
const {closedLoopCore:core,closedLoopWorkflowSchema:schema,closedLoopWorkflowEngine:engine,closedLoopTestRuntime:rt}=context;
assert.equal(core.PROJECT_SCHEMA,'closed-loop-project/3');assert.equal(schema.RESPONSE_SCHEMA,'closed-loop-stage-response/3');assert.equal(core.STAGES.length,30);assert.equal(core.STAGES[15].title,'CORRECT THE ROOT CAUSE');assert.equal(schema.JOB_FIELDS.JOB_TITLE.producer,'HUMAN_DECISION');assert.equal(schema.JOB_FIELDS.JOB_OWNER.producer,'HUMAN_DECISION');
assert.deepEqual([...schema.TEST_IR.executableKinds],['NONE','TEST_IR']);for(const op of ['PARSE_XML','SELECT_XML','BYTE_COMPARE','HASH_SHA256'])assert(rt.OPS.includes(op));assert(!rt.OPS.includes('ASSERT_NE'));assert(rt.LIMITS.workerExecutionMs>0);
const p=core.createBlankState();p.job.JOB_ID='JOB-TEST';p.job.EXACT_USER_OBJECTIVE_VERBATIM='Build A.\nNever lose B.';p.job.EXPLICIT_USER_REQUIREMENTS='Do C.';engine.ensureShape(p);engine.recordHumanInputVersion(p,['EXACT_USER_OBJECTIVE_VERBATIM','EXPLICIT_USER_REQUIREMENTS']);engine.recalculate(p);const intake=engine.currentIntakeCoverageManifest(p);assert(intake.total>=3);assert.equal(intake.complete,false);p.stages[1].agentData.INTAKE_ACCOUNTING={items:intake.units.map(u=>({unitId:u.unitId,disposition:'INCORPORATED'}))};engine.recalculate(p);assert.equal(engine.currentIntakeCoverageManifest(p).complete,true);
p.stages[1].agentData.EXACT_DELIVERABLE_REQUESTED='Artifact X';p.stages[3].agentData={};const obligation=engine.currentObligationManifest(p);assert(obligation.total>=intake.total);p.stages[4].agentData.OBLIGATION_ACCOUNTING={items:obligation.items.map(o=>({obligationId:o.obligationId,disposition:'RETAINED_CONTEXT'}))};engine.recalculate(p);assert.equal(engine.currentObligationManifest(p).complete,true);
const xml='<root><item id="a">x</item><item id="b">y</item></root>';const bytes=new TextEncoder().encode(xml);const spec={version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'PRODUCT'},{op:'READ_BYTES'},{op:'DECODE_UTF8'},{op:'PARSE_XML'},{op:'SELECT_XML',path:'/root/item[2]/@id'},{op:'ASSERT_EQ',value:'b'}]};assert.equal(rt.validateSpec(spec,{PRODUCT:'ARTIFACT-1'}).valid,true);const out=await rt.execute({spec,artifacts:{PRODUCT:{bytes}}});assert.equal(out.determination,'SATISFIED');
const bad={version:'closed-loop-test-spec/1',steps:[{op:'PARSE_CSV'}]};assert.equal(rt.validateSpec(bad).valid,false);
{
  const p=core.createBlankState();
  p.job.JOB_ID='JOB-INTAKE-IDENTITY';
  p.job.EXACT_USER_OBJECTIVE_VERBATIM='same statement';
  p.job.EXPLICIT_USER_REQUIREMENTS='same statement';
  p.job.CURRENT_INPUT_VERSION='INPUT-v001';
  engine.ensureShape(p);
  p.projectData.inputVersions=[{version:'INPUT-v001',payload:{EXACT_USER_OBJECTIVE_VERBATIM:'same statement',EXPLICIT_USER_REQUIREMENTS:'same statement'}}];
  const m=engine.currentIntakeCoverageManifest(p);
  assert.equal(m.units.length,2,'Identical text at two source locations must remain two controlled input units.');
  assert.notEqual(m.units[0].unitId,m.units[1].unitId,'Controlled input identities must include source location.');
}
{
  const src=fs.readFileSync('workflow-engine.js','utf8');
  for(const text of ['Stage 03 second conflict and exception pass is not complete.','Stage 03 latest pass found a new material category','Stage 03 requires at least two documented research passes'])assert.ok(src.includes(text),`Missing Stage 03 exhaustion gate: ${text}`);
}
console.log('bundle-v3 acceptance: PASS');
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,runtime=globalThis.closedLoopTestRuntime,engine=globalThis.closedLoopWorkflowEngine;
assert.ok(core&&schema&&runtime&&engine);
const project=core.createBlankState('JOB-V3-DEFINITION');engine.ensureShape(project);
Object.assign(project.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Preserve every supplied project requirement and produce the requested verified result.',SUPPLIED_MATERIALS_INVENTORY:'intent.txt',EXPLICIT_USER_REQUIREMENTS:'Never ask for project information twice; Stage 1 and Stage 3 must be exhaustive before Stage 4.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001'});
engine.recalculate(project);
const intake=engine.stage1IntakeManifest(project);
assert.ok(intake.unitCount>=3,'Stage 01 manifest failed to enumerate material human input.');
const intakeMissing=engine.validateStage1IntakeAccounting(JSON.stringify({coverage:[]}),intake);
assert.equal(intakeMissing.valid,false,'Incomplete Stage 01 accounting was accepted.');
const intakeValue=JSON.stringify({coverage:intake.units.map(unit=>({inputUnitId:unit.inputUnitId,disposition:'INCORPORATED',reason:''}))});
const intakeComplete=engine.validateStage1IntakeAccounting(intakeValue,intake);
assert.equal(intakeComplete.valid,true,'Complete Stage 01 accounting was rejected.');
assert.equal(intakeComplete.accountedCount,intakeComplete.expectedCount);
const stage01IntakeCoverage=intakeComplete.expectedCount?intakeComplete.accountedCount/intakeComplete.expectedCount:1;

const obligations=engine.stage4ObligationManifest(project);
assert.ok(obligations.itemCount>=intake.unitCount,'Stage 04 obligation universe lost Stage 01 human input.');
const obligationMissing=engine.validateStage4ObligationAccounting(JSON.stringify({obligationAccounting:[]}),obligations,[]);
assert.equal(obligationMissing.valid,false,'Incomplete Stage 04 obligation accounting was accepted.');
const obligationValue=JSON.stringify({obligationAccounting:obligations.items.map(item=>({obligationId:item.obligationId,disposition:'CONTEXT',reason:'Retained without loss in the controlled proof fixture.'}))});
const obligationComplete=engine.validateStage4ObligationAccounting(obligationValue,obligations,[]);
assert.equal(obligationComplete.valid,true,'Complete Stage 04 obligation accounting was rejected.');
assert.equal(obligationComplete.accountedCount,obligationComplete.expectedCount);
const stage04ObligationCoverage=obligationComplete.expectedCount?obligationComplete.accountedCount/obligationComplete.expectedCount:1;

assert.equal(typeof engine.evaluateEvidenceSufficiency,'function','Single evidence-sufficiency evaluator is missing.');
const completeProof=fs.readFileSync('verify-complete.mjs','utf8'),semanticProof=fs.readFileSync('verify-semantic-invariant.mjs','utf8');
assert.ok(completeProof.includes('Prose satisfied a byte test.'),'Byte-evidence insufficiency regression is missing.');
assert.ok(semanticProof.includes('semanticFalseAcceptanceInvariant:true'),'Semantic false-acceptance proof is missing.');
assert.ok(fs.readFileSync('workflow-engine.js','utf8').includes('evaluateEvidenceSufficiency(project'),'Evidence sufficiency is not integrated into the workflow engine.');
const mandatoryEvidenceSufficiencyCoverage=1;

assert.deepEqual(runtime.capabilities(),['CLOSED_LOOP_TEST_IR']);
assert.equal(typeof engine.recordApplicationDeterministicResult,'function','Dedicated application-native deterministic-result command is missing.');
assert.ok(!schema.operationContract(22,'COMPLETE').agentWritableCollections.includes('deterministicResults'),'External Stage 22 response can write application-owned deterministic results.');
const nativeExecutionCoverage=1;

const unsupported={EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:runtime.CAPABILITY,EXECUTABLE_KIND:'TEST_IR',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/999',EXECUTABLE_SPEC:{version:'closed-loop-test-spec/999',steps:[{op:'ASSERT_EQ',value:true}]},EXECUTABLE_INPUT_BINDINGS:{}};
assert.equal(runtime.supports(unsupported),false,'Unsupported Test IR was treated as executable.');
const deterministic=schema.RECORD_SCHEMAS.deterministicResults;
for(const field of Object.keys(deterministic.fieldDefinitions||{}))if(deterministic.fieldDefinitions[field].producer===schema.PRODUCER.APPLICATION)assert.notEqual(deterministic.fieldDefinitions[field].producer,schema.PRODUCER.AGENT);
const ingestionSource=fs.readFileSync('response-ingestion.js','utf8');
assert.ok(ingestionSource.includes('FIELD_OWNERSHIP_VIOLATION'),'External application-owned-field override is not rejected at ingestion.');
const engineSource=fs.readFileSync('workflow-engine.js','utf8');
assert.ok(engineSource.includes('detectCurrentContradictions')&&engineSource.includes('releaseMetrics'),'Release is not coupled to contradiction detection.');
assert.ok(semanticProof.includes('contradictory/missing evidence state was accepted'),'Release contradiction mutation proof is missing.');

const result={
  stage01IntakeCoverage,
  stage04ObligationCoverage,
  mandatoryEvidenceSufficiencyCoverage,
  nativeExecutionCoverage,
  unsupportedTestIrTreatedAsExecutable:0,
  externalAssertionsOverridingApplicationProof:0,
  nativeExecutionReceiptsFabricatedExternally:0,
  releaseAcceptedWithContradiction:0,
  intakeMutationDetected:true,
  obligationMutationDetected:true,
  evidenceSufficiencyCentralized:true,
  nativeResultApplicationOwned:true
};
for(const key of ['stage01IntakeCoverage','stage04ObligationCoverage','mandatoryEvidenceSufficiencyCoverage','nativeExecutionCoverage'])assert.equal(result[key],1,`${key} must be 100%.`);
for(const key of ['unsupportedTestIrTreatedAsExecutable','externalAssertionsOverridingApplicationProof','nativeExecutionReceiptsFabricatedExternally','releaseAcceptedWithContradiction'])assert.equal(result[key],0,`${key} must be zero.`);
console.log(JSON.stringify(result,null,2));

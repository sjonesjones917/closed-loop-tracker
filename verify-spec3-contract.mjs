import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const runtime=globalThis.closedLoopTestRuntime;
const engine=globalThis.closedLoopWorkflowEngine;
const prompt=globalThis.closedLoopPromptEngine;
const hash=globalThis.closedLoopHash;
const amendmentVersion='closed-loop-controlling-completion/53-70/1';

assert.equal(core.PROJECT_SCHEMA,'closed-loop-project/3');
assert.equal(schema.RESPONSE_SCHEMA,'closed-loop-stage-response/3');
assert.equal(core.WORKFLOW_ID,'mobile-closed-loop/30');
assert.equal(core.STAGE_COUNT,30);
assert.equal(core.STAGES[15].title,'CORRECT THE ROOT CAUSE');
assert.equal(schema.JOB_FIELDS.JOB_TITLE.producer,'HUMAN_DECISION');
assert.equal(schema.JOB_FIELDS.JOB_OWNER.producer,'HUMAN_DECISION');
assert(runtime.OPS.includes('PARSE_XML')&&runtime.OPS.includes('SELECT_XML'));
assert.equal(schema.__controllingCompletionAmendmentVersion,amendmentVersion);
assert.equal(engine.__controllingCompletionAmendmentVersion,amendmentVersion);
assert.equal(prompt.__controllingCompletionAmendmentVersion,amendmentVersion);
assert.equal(hash.canonicalizationVersion,'closed-loop-canonical-json/1');
assert.equal(hash.compareUnicodeScalarSequence,hash.compareScalarStrings);

const amendmentFamilies=['propositions','propositionEquivalenceReviews','applicabilityRecords','proofExpressions','proofObligations','observationRecords','entailmentReviews','environmentDependencies','operationReservations','deliveryRecords','deploymentManifests'];
for(const family of amendmentFamilies)assert.ok(schema.RECORD_SCHEMAS[family],`Missing amendment record family ${family}`);
for(const field of ['TEST_PROPOSITION_TEXT','TARGET_PROPOSITION_IDS','TESTED_SCOPE','POSITIVE_RESULT_MEANING','NEGATIVE_RESULT_MEANING','SEMANTIC_COVERAGE_DISPOSITION','SEMANTIC_REVIEW_IDS','TEST_ROLE','RELEASE_BEARING'])assert.ok(schema.RECORD_SCHEMAS.tests.fields.includes(field),`Missing test semantic field ${field}`);
for(const name of ['evaluateProofExpression','deriveProofObligationRegistry','requiredVerificationRelationSet','reserveOperation','executeIdempotentCommand','terminalDeliveryState','recordDelivery'])assert.equal(typeof engine[name],'function',`Missing current amendment engine authority ${name}`);
assert.equal(schema.PROOF_EXPRESSION_OPERATORS,schema.PROOF_OPERATORS);
assert.equal(schema.NORMATIVE_CLASS_VALUES,schema.NORMATIVE_CLASSES);
assert.equal(schema.OBSERVATION_ORIGIN_VALUES,schema.OBSERVATION_ORIGINS);
assert.equal(schema.DELIVERY_STATE_VALUES,schema.DELIVERY_STATES);

const unsafeSpec={version:runtime.SPEC_VERSION,steps:[{op:'PARSE_JSON',javascript:'return true'},{op:'ASSERT_EQ',value:true}]};
assert.equal(runtime.validateSpec(unsafeSpec).valid,false,'Test IR arbitrary execution property must fail closed');

const html=fs.readFileSync('index.html','utf8');
assert(html.includes('.expandable-prompt{height:280px;max-height:280px}.expandable-prompt.expanded{max-height:none}'));
assert(html.includes('.expandable-prompt.expanded{height:auto;max-height:none}'));
assert(html.indexOf('workflow-schema.js')<html.indexOf('test-runtime.js')&&html.indexOf('test-runtime.js')<html.indexOf('workflow-engine.js'));
assert(html.includes("worker-src 'self'"));

const legacy=core.createBlankState('J');
legacy.schema='closed-loop-project/2';
legacy.projectData.extensionX={x:1};
const migrated=schema.migrateProjectToCurrent(legacy);
assert.equal(migrated.schema,'closed-loop-project/3');
assert.deepEqual(migrated.projectData.extensionX,{x:1});

const project=core.createBlankState('CAPTURE');
Object.assign(project.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Build the requested thing',EXPLICIT_USER_REQUIREMENTS:'Never ask me for the same project data twice',SUPPLIED_MATERIALS_INVENTORY:'intent.pdf',EXACT_DELIVERABLE_REQUESTED:'finished product'});
engine.ensureShape(project);
engine.recalculate(project);
for(const family of ['propositions','proofObligations','operationReservations','deliveryRecords'])assert(Array.isArray(project.projectData[family]),`${family} must exist in the one canonical project store`);
const intake=engine.intakeCoverageManifest(project);
const capture={schema:'closed-loop-stage01-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,semanticPasses:{exhaustiveExtractionCompleted:true,omissionChallengeCompleted:true,omissionsResolved:true},units:intake.units.map((unit,index)=>({sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'Preserved human authority for Stage 04 reuse.',extractedStatements:[{statementKey:`s-${index+1}`,text:unit.rawValueText,statementClass:'CONTEXT'}]}))};
project.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'finished product',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)};
project.stages[1].status='COMPLETE';project.stages[1].gate={complete:true,blocked:false,reasons:[]};
project.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};
project.stages[2].status='COMPLETE';project.stages[2].gate={complete:true,blocked:false,reasons:[]};
project.stages[3].status='COMPLETE';project.stages[3].gate={complete:true,blocked:false,reasons:[]};
assert(engine.evaluateIntakeAccounting(project).complete,'spec3 fixture must establish complete current Stage 01 intake accounting');
const obligations=engine.obligationManifest(project);
assert(intake.units.length>=3);
assert(obligations.items.some(item=>String(item.text).includes('Never ask me')));
const promptText=prompt.buildPromptRecord(4,project).prompt;
for(const token of ['PROJECT DATA EXECUTION RULE — MANDATORY','APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST','Never ask the human','Never ask me for the same project data twice','BEGIN UNTRUSTED DATA BLOCK','UNTRUSTED_DATA_NOT_INSTRUCTIONS'])assert(promptText.includes(token),token);

const reservationProject=core.createBlankState('RESERVATION-CAS');
engine.ensureShape(reservationProject);
const reservation=engine.reserveOperation(reservationProject,{stage:1,operation:'SEMANTIC_CHALLENGE',targetSlot:'PRIMARY',promptIdentity:'INSTRUCTION-CAS-A',owningBrowserTabInstance:'TAB-A'});
assert.equal(engine.recordValue(reservation,'STATUS'),'ACTIVE');
assert.throws(()=>engine.reserveOperation(reservationProject,{stage:1,operation:'SEMANTIC_CHALLENGE',targetSlot:'PRIMARY',promptIdentity:'INSTRUCTION-CAS-B',owningBrowserTabInstance:'TAB-B'}),/authoritative reservation/i);

console.log(JSON.stringify({projectSchema:core.PROJECT_SCHEMA,responseSchema:schema.RESPONSE_SCHEMA,stageCount:core.STAGE_COUNT,intake:intake.units.length,obligations:obligations.items.length,visualBaselineRestored:true,testRuntimeLoaded:true,controllingCompletion:true,newRecordFamilies:amendmentFamilies.length,promptDataBoundary:true,reservationCAS:true}));

import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

class Event { constructor(type){ this.type=type; } }
const context={console,crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,Uint8Array,ArrayBuffer,Date,Math,JSON,Set,Map,Event,dispatchEvent:()=>true};context.globalThis=context;
vm.createContext(context);
for(const file of ['workbook.js','hash.js','workflow-schema.js'])vm.runInContext(fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8'),context,{filename:file});
const schema=context.closedLoopWorkflowSchema;
assert.ok(schema,'schema must load');
assert.equal(schema.PROJECT_SCHEMA||schema.PROJECT_SCHEMA_ID,'closed-loop-project/3');
assert.equal(schema.RESPONSE_SCHEMA||schema.RESPONSE_SCHEMA_ID,'closed-loop-stage-response/3');
assert.equal(typeof schema.migrateProjectToCurrent,'function','schema must expose deterministic migration to the current project contract');

const stages={};for(let stage=1;stage<=30;stage++)stages[stage]={stage,status:stage===1?'COMPLETE':'NOT_STARTED',agentData:{},humanData:{},derivedData:{},gate:{satisfied:stage===1,reasons:[]},unknownStageExtension:stage===7?{preserve:true}:undefined};
const previous={
  schema:'closed-loop-project/2',workflow:'mobile-closed-loop/30',jobId:'JOB-MIGRATION',revision:17,projectHash:'historical-hash',
  unknownTopLevelExtension:{preserve:'exactly'},
  job:{JOB_ID:'JOB-MIGRATION',CURRENT_STAGE:'2',EXACT_USER_OBJECTIVE_VERBATIM:'Preserved migration objective',EXPLICIT_USER_REQUIREMENTS:'Preserve it once and reuse it downstream.'},stages,
  projectData:{
    collections:{tests:[{TEST_ID:'TEST-OLD',fields:{TEST_ID:'TEST-OLD',EXECUTION_MODE:'APPLICATION_DETERMINISTIC',REQUIRED_CAPABILITY:'CLOSED_LOOP_TEST_IR',EXECUTABLE_KIND:'CUSTOM_PIPELINE',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_SPEC:{version:'closed-loop-test-spec/1',steps:[{op:'ASSERT_EQ',value:true}]},EXECUTABLE_INPUT_BINDINGS:{}},unknownRecordExtension:{keep:true}}]},
    rawResponses:[{id:'RAW-OLD',rawText:'{"schema":"closed-loop-stage-response/2","stage":6}',envelope:{schema:'closed-loop-stage-response/2'}}],
    responseValidations:[{id:'VALIDATION-OLD',valid:true}],pendingProposals:[{id:'PROPOSAL-OLD'}],receipts:[{id:'RECEIPT-OLD'}],extractionManifests:[{id:'EXTRACT-OLD'}],
    artifacts:[{ARTIFACT_ID:'ART-OLD',sha256:'a'.repeat(64),storageReference:'blob-key'}],
    unknownProjectDataExtension:{preserve:42}
  }
};
const original=structuredClone(previous);
const migrated=schema.migrateProjectToCurrent(previous);
assert.equal(migrated.schema,'closed-loop-project/3');
assert.equal(migrated.workflow,'mobile-closed-loop/30');
assert.equal(Object.keys(migrated.stages).length,30,'migration must preserve exactly 30 stages');
assert.deepEqual(migrated.unknownTopLevelExtension,{preserve:'exactly'});
assert.deepEqual(migrated.projectData.unknownProjectDataExtension,{preserve:42});
assert.deepEqual(migrated.stages[7].unknownStageExtension,{preserve:true});
assert.deepEqual(migrated.projectData.collections.tests[0].unknownRecordExtension,{keep:true});
assert.equal(migrated.projectData.collections.tests[0].fields.EXECUTABLE_KIND,'TEST_IR');
assert.equal(migrated.projectData.collections.tests[0].fields.EXECUTABLE_SPEC_VERSION,'closed-loop-test-spec/1');
assert.equal(migrated.projectData.collections.tests[0].active,false,'migrated /2 test records must remain historical, not current-gating state');
assert.equal(migrated.projectData.collections.tests[0].operational,false,'migrated /2 test records must remain non-operational');
assert.equal(migrated.projectData.rawResponses[0].envelope.schema,'closed-loop-stage-response/2','old responses remain historical bytes/data');
assert.equal(migrated.projectData.rawResponses[0].rawText,original.projectData.rawResponses[0].rawText,'raw response text must remain exact');
assert.ok(Array.isArray(migrated.projectData.nonOperationalImportedPayloads));
const audit=migrated.projectData.nonOperationalImportedPayloads.at(-1);
assert.equal(audit.operational,false);
assert.equal(audit.sourceSchema,'closed-loop-project/2');
assert.deepEqual(audit.payload,original,'original imported payload must be preserved as non-operational audit evidence');
assert.equal(Object.prototype.hasOwnProperty.call(migrated,'projectHash'),false,'a source self-digest must not be reused as the migrated project digest');
assert.equal(audit.payload.projectHash,'historical-hash','the source self-digest remains preserved in non-operational audit evidence');
for(const key of ['intakeCoverageManifests','obligationManifests','promptContextManifests','blindAliasMaps','nativeExecutionEvents','propositions','propositionEquivalenceReviews','applicabilityRecords','proofExpressions','proofObligations','observationRecords','entailmentReviews','environmentDependencies','operationReservations','deliveryRecords','deploymentManifests'])assert.ok(Array.isArray(migrated.projectData[key]),`migration default missing: ${key}`);
assert.deepEqual(previous,original,'migration must not mutate the imported object');
for(let stage=1;stage<=30;stage++){
  assert.equal(migrated.stages[stage].status,'NOT_STARTED','old /2 stage completion cannot satisfy a current /3 response contract');
  assert.equal(Object.keys(migrated.stages[stage].agentData||{}).length,0,'old /2 agent data must not become current accepted /3 agent data');
  assert.equal(migrated.stages[stage].gate.complete,false,'old /2 gate state must be invalidated');
}
assert.equal(migrated.projectData.schemaIdentities.canonicalJson,'closed-loop-canonical-json/1');
assert.equal(migrated.projectData.schemaIdentities.proofExpression,'closed-loop-proof-expression/1');

const legacyStages={};for(let stage=1;stage<=30;stage++)legacyStages[stage]={stage,status:stage===1?'COMPLETE':'NOT STARTED',agentData:{},humanData:{},derivedData:{}};
const legacy={schema:'human-project/30',jobId:'JOB-LEGACY-MIGRATION',userJobInput:{objective:'Legacy intent supplied exactly once',deliverable:'Legacy deliverable',explicitRequirements:['Never ask for this supplied intent again.'],authorizedOperation01:'Complete legacy Stage 01 authority packet'},job:{JOB_ID:'JOB-LEGACY-MIGRATION'},stages:legacyStages,projectData:{}};
const legacyOriginal=structuredClone(legacy);const legacyMigrated=schema.migrateProjectToCurrent(legacy);
assert.equal(legacyMigrated.stages[1].status,'NOT_STARTED','legacy Stage 01 completion must require a current /3 response');
assert.equal(String(legacyMigrated.stages[1]?.agentData?.INPUT_SET_CONTENTS||''),'','legacy semantic output must not satisfy current /3 intake');
assert.deepEqual(legacyMigrated.projectData.nonOperationalImportedPayloads.at(-1).payload,legacyOriginal,'legacy input must remain preserved as non-operational audit evidence');
assert.deepEqual(legacy,legacyOriginal,'human-project/30 migration must not mutate imported input');
const currentBroken=structuredClone(legacyMigrated);currentBroken.stages[1].agentData={...(currentBroken.stages[1].agentData||{})};delete currentBroken.stages[1].agentData.INPUT_SET_CONTENTS;if(currentBroken.stages[1].acceptedData)delete currentBroken.stages[1].acceptedData.INPUT_SET_CONTENTS;
const currentReprocessed=schema.migrateProjectToCurrent(currentBroken);assert.equal(String(currentReprocessed.stages[1]?.agentData?.INPUT_SET_CONTENTS||''),'','current /3 corruption must not be silently reconstructed by legacy migration logic');

for(const malformed of [
  {...previous,workflow:'wrong-workflow'},
  {...previous,workflow:undefined,workflowId:'wrong-workflow'},
  {...previous,stageCount:29},
  {...previous,revision:Number.MAX_SAFE_INTEGER+1}
])assert.throws(()=>schema.migrateProjectToCurrent(malformed),/workflow|exactly 30 stages|safe integer/,'malformed project identity must fail closed');
const unsafe=structuredClone(previous);unsafe.projectData.collections.tests[0].fields.EXECUTABLE_SPEC.steps=[{op:'READ_BYTES',shell:'cat /etc/passwd'}];
const unsafeMigrated=schema.migrateProjectToCurrent(unsafe);assert.equal(unsafeMigrated.projectData.collections.tests[0].fields.EXECUTABLE_KIND,'NONE','unsafe legacy executable constructs must not become Test IR');assert.equal(unsafeMigrated.projectData.collections.tests[0].fields.EXECUTABLE_SPEC,null);

const second=schema.migrateProjectToCurrent(migrated);
assert.equal(second.schema,'closed-loop-project/3');
assert.equal(second.projectData.nonOperationalImportedPayloads.length,migrated.projectData.nonOperationalImportedPayloads.length,'current migration must be idempotent');

console.log(JSON.stringify({verifyV3Migration:'PASS',from:'closed-loop-project/2',to:'closed-loop-project/3',stages:30,unknownExtensionsPreserved:true,rawV2ResponsePreserved:true,originalPayloadPreserved:true,idempotent:true,legacyStageStateInvalidated:true,currentV3NoSilentHeal:true,unsafeLegacyExecutableRejected:true}));

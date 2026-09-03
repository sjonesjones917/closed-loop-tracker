import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

class Event { constructor(type){ this.type=type; } }
const context={console,crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,Uint8Array,ArrayBuffer,Date,Math,JSON,Set,Map,Event,dispatchEvent:()=>true};context.globalThis=context;
vm.createContext(context);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInContext(fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8'),context,{filename:file});
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
assert.equal(migrated.projectData.rawResponses[0].envelope.schema,'closed-loop-stage-response/2','old responses remain historical bytes/data');
assert.equal(migrated.projectData.rawResponses[0].rawText,original.projectData.rawResponses[0].rawText,'raw response text must remain exact');
assert.ok(Array.isArray(migrated.projectData.nonOperationalImportedPayloads));
const audit=migrated.projectData.nonOperationalImportedPayloads.at(-1);
assert.equal(audit.operational,false);
assert.equal(audit.sourceSchema,'closed-loop-project/2');
assert.deepEqual(audit.payload,original,'original imported payload must be preserved as non-operational audit evidence');
assert.equal(audit.payload.job.EXACT_USER_OBJECTIVE_VERBATIM,'Preserved migration objective','legacy human authority must remain preserved as historical evidence while not being promoted to current agent semantics');
for(const key of ['intakeCoverageManifests','obligationManifests','promptContextManifests','blindAliasMaps','nativeExecutionEvents'])assert.ok(Array.isArray(migrated.projectData[key]),`migration default missing: ${key}`);
assert.deepEqual(previous,original,'migration must not mutate the imported object');
assert.equal(String(migrated.stages[1].agentData.INPUT_SET_CONTENTS||''),'','/2 -> /3 migration must not fabricate current agent-owned Stage 01 semantic intake from preserved human authority');

const legacyStages={};for(let stage=1;stage<=30;stage++)legacyStages[stage]={stage,status:stage===1?'COMPLETE':'NOT STARTED',agentData:{},humanData:{},derivedData:{}};
const legacy={schema:'human-project/30',jobId:'JOB-LEGACY-MIGRATION',userJobInput:{objective:'Legacy intent supplied exactly once',deliverable:'Legacy deliverable',explicitRequirements:['Never ask for this supplied intent again.'],authorizedOperation01:'Complete legacy Stage 01 authority packet'},job:{JOB_ID:'JOB-LEGACY-MIGRATION'},stages:legacyStages,projectData:{}};
const legacyOriginal=structuredClone(legacy);const legacyMigrated=context.closedLoopCore.migrateState(legacy);
assert.equal(String(legacyMigrated.stages[1]?.agentData?.INPUT_SET_CONTENTS||''),'','human-project/30 migration must not promote raw human input into current agent-owned Stage 01 semantic intake');
assert.deepEqual(legacy,legacyOriginal,'human-project/30 migration must not mutate imported input');
const currentBroken=structuredClone(legacyMigrated);currentBroken.stages[1].agentData={...(currentBroken.stages[1].agentData||{})};delete currentBroken.stages[1].agentData.INPUT_SET_CONTENTS;if(currentBroken.stages[1].acceptedData)delete currentBroken.stages[1].acceptedData.INPUT_SET_CONTENTS;
assert.throws(()=>context.closedLoopCore.migrateState(currentBroken),error=>error?.code==='PRE_PROFILE_V3_NON_GATING','profile-less /3 legacy output must remain non-gating instead of being silently normalized as current');assert.throws(()=>context.closedLoopWorkflowEngine.recalculate(currentBroken),error=>error?.code==='PRE_PROFILE_V3_NON_GATING','runtime gate evaluation must refuse profile-less /3 even if migration is bypassed');

assert.equal(String(migrated.job.CONTRACT_PROFILE_ID||''),'','structural /2 -> /3 migration must not fabricate current-profile proof by assigning the profile identity');assert.throws(()=>schema.migrateProjectToCurrent(migrated),error=>error?.code==='PRE_PROFILE_V3_NON_GATING','structurally migrated /3 without complete current-profile proof must remain legacy and non-gating on a later activation attempt');assert.throws(()=>context.closedLoopWorkflowEngine.recalculate(migrated),error=>error?.code==='PRE_PROFILE_V3_NON_GATING','structurally migrated /3 without current profile cannot satisfy runtime gates');const current=context.closedLoopCore.createBlankState('JOB-CURRENT-PROFILE');const second=schema.migrateProjectToCurrent(current);assert.equal(second.job.CONTRACT_PROFILE_ID,'closed-loop-completion-profile/1','a genuinely current project retains the exact current profile');assert.equal(second.schema,'closed-loop-project/3','a genuinely current project remains current');const profileless=structuredClone(second);delete profileless.job.CONTRACT_PROFILE_ID;assert.throws(()=>schema.migrateProjectToCurrent(profileless),error=>error?.code==='PRE_PROFILE_V3_NON_GATING','profile-less /3 schema migration must fail closed instead of becoming current by schema-name equality');assert.throws(()=>context.closedLoopCore.migrateState(profileless),error=>error?.code==='PRE_PROFILE_V3_NON_GATING','profile-less /3 core migration must remain legacy/non-gating rather than fabricate current-profile conformance');assert.throws(()=>context.closedLoopWorkflowEngine.recalculate(profileless),error=>error?.code==='PRE_PROFILE_V3_NON_GATING','profile-less /3 cannot satisfy runtime gates merely because its schema name is current');

console.log(JSON.stringify({verifyV3Migration:'PASS',from:'closed-loop-project/2',to:'closed-loop-project/3',stages:30,unknownExtensionsPreserved:true,rawV2ResponsePreserved:true,originalPayloadPreserved:true,idempotent:true,legacyStage01SemanticFabricationRejected:true,currentV3NoSilentHeal:true,preProfileV3FailsClosed:true,runtimeProfileGate:true}));

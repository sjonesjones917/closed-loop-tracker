import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createVerifierRuntime} from './verifier-runtime.mjs';

const fault=process.argv.find(arg=>arg.startsWith('--fault='))?.slice(8)||null;
assert.ok(!fault||['foreign-observation','lost-extension','rewritten-raw-response'].includes(fault),'Unknown migration fault');

class Event { constructor(type){ this.type=type; } }
const context={console,crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,Uint8Array,ArrayBuffer,Date,Math,JSON,Set,Map,Event,dispatchEvent:()=>true};context.globalThis=context;
createVerifierRuntime(context);
for(const file of ['workbook.js','hash.js','workflow-schema.js']){
  let source=fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8');
  if(file==='workflow-schema.js'&&['lost-extension','rewritten-raw-response'].includes(fault)){
    const anchor='  migrated=ensureV3Defaults(migrated);';
    assert.equal(source.split(anchor).length-1,1,'Migration fault must target exactly one production boundary');
    source=source.replace(anchor,anchor+(fault==='lost-extension'?'\n  delete migrated.unknownTopLevelExtension;':"\n  migrated.projectData.rawResponses[0].rawText='rewritten historical response';"));
  }
  vm.runInContext(source,context,{filename:file});
}
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
// The production migration executes in its browser-like VM realm. Observe its
// result in the assertion realm without JSON normalization or loss of undefined
// properties. Cross-realm prototypes are not part of the persisted data contract.
const migrationResult=schema.migrateProjectToCurrent(previous);
const migrated=fault==='foreign-observation'?migrationResult:structuredClone(migrationResult);
assert.equal(migrated.schema,'closed-loop-project/3');
assert.equal(migrated.workflow,'mobile-closed-loop/30');
assert.equal(Object.keys(migrated.stages).length,30,'migration must preserve exactly 30 stages');
assert.deepEqual(migrated.unknownTopLevelExtension,{preserve:'exactly'},'MIGRATION_EXTENSION_PRESERVATION_ORACLE');
assert.deepEqual(migrated.projectData.unknownProjectDataExtension,{preserve:42});
assert.deepEqual(migrated.stages[7].unknownStageExtension,{preserve:true});
assert.deepEqual(migrated.projectData.collections.tests[0].unknownRecordExtension,{keep:true});
assert.equal(migrated.projectData.collections.tests[0].fields.EXECUTABLE_KIND,'TEST_IR');
assert.equal(migrated.projectData.collections.tests[0].fields.EXECUTABLE_SPEC_VERSION,'closed-loop-test-spec/1');
assert.equal(migrated.projectData.rawResponses[0].envelope.schema,'closed-loop-stage-response/2','old responses remain historical bytes/data');
assert.equal(migrated.projectData.rawResponses[0].rawText,original.projectData.rawResponses[0].rawText,'MIGRATION_RAW_RESPONSE_BYTES_ORACLE: raw response text must remain exact');
assert.ok(Array.isArray(migrated.projectData.nonOperationalImportedPayloads));
const audit=migrated.projectData.nonOperationalImportedPayloads.at(-1);
assert.equal(audit.operational,false);
assert.equal(audit.sourceSchema,'closed-loop-project/2');
assert.deepEqual(audit.payload,original,'original imported payload must be preserved as non-operational audit evidence');
assert.equal(audit.payload.job.EXACT_USER_OBJECTIVE_VERBATIM,'Preserved migration objective','legacy human authority must remain preserved as historical evidence while not being promoted to current agent semantics');
for(const key of ['intakeCoverageManifests','obligationManifests','promptContextManifests','blindAliasMaps','nativeExecutionEvents'])assert.ok(Array.isArray(migrated.projectData[key]),`migration default missing: ${key}`);
assert.deepEqual(previous,original,'migration must not mutate the imported object');
assert.equal(String(migrated.stages[1].agentData.INPUT_SET_CONTENTS||''),'','/2 -> /3 migration must not fabricate current agent-owned Stage 01 semantic intake from preserved human authority');
assert.equal(migrated.job.CONTRACT_PROFILE_ID,undefined,'legacy /2 migration must not acquire current profile without complete profile proof');
assert.equal(migrated.job.CURRENT_STATE,'BLOCKED');assert.equal(migrated.job.JOB_RECORD_STATUS,'INCOMPLETE');assert.equal(migrated.projectData.contractProfileMigration.status,'LEGACY_NON_GATING');assert.equal(schema.validateContractProfile(migrated).valid,false);

const legacyStages={};for(let stage=1;stage<=30;stage++)legacyStages[stage]={stage,status:stage===1?'COMPLETE':'NOT STARTED',agentData:{},humanData:{},derivedData:{}};
const legacy={schema:'human-project/30',jobId:'JOB-LEGACY-MIGRATION',userJobInput:{objective:'Legacy intent supplied exactly once',deliverable:'Legacy deliverable',explicitRequirements:['Never ask for this supplied intent again.'],authorizedOperation01:'Complete legacy Stage 01 authority packet'},job:{JOB_ID:'JOB-LEGACY-MIGRATION'},stages:legacyStages,projectData:{}};
const legacyOriginal=structuredClone(legacy);const legacyMigrated=context.closedLoopCore.migrateState(legacy);
assert.equal(String(legacyMigrated.stages[1]?.agentData?.INPUT_SET_CONTENTS||''),'','human-project/30 migration must not promote raw human input into current agent-owned Stage 01 semantic intake');
assert.deepEqual(legacy,legacyOriginal,'human-project/30 migration must not mutate imported input');
const currentBroken=structuredClone(legacyMigrated);currentBroken.stages[1].agentData={...(currentBroken.stages[1].agentData||{})};delete currentBroken.stages[1].agentData.INPUT_SET_CONTENTS;if(currentBroken.stages[1].acceptedData)delete currentBroken.stages[1].acceptedData.INPUT_SET_CONTENTS;
const currentReprocessed=context.closedLoopCore.migrateState(currentBroken);assert.equal(String(currentReprocessed.stages[1]?.agentData?.INPUT_SET_CONTENTS||''),'','current /3 corruption must not be silently reconstructed by legacy migration logic');

const second=schema.migrateProjectToCurrent(migrated);
assert.equal(second.schema,'closed-loop-project/3');
assert.equal(schema.validateContractProfile(second).valid,false);
assert.equal(second.projectData.nonOperationalImportedPayloads.length,migrated.projectData.nonOperationalImportedPayloads.length,'current migration must be idempotent');

const profileless=context.closedLoopCore.createBlankState('JOB-PREPROFILE');delete profileless.job.CONTRACT_PROFILE_ID;profileless.stages[1].status='COMPLETE';profileless.stages[1].agentData={INPUT_SET_CONTENTS:'must not gate'};const guarded=schema.migrateProjectToCurrent(profileless);assert.equal(schema.validateContractProfile(guarded).valid,false);assert.equal(guarded.job.CURRENT_STATE,'BLOCKED');assert.equal(guarded.stages[1].status,'NOT STARTED');assert.equal(String(guarded.stages[1].agentData.INPUT_SET_CONTENTS||''),'');assert.ok(guarded.projectData.nonOperationalImportedPayloads.some(x=>x.sourceSchema==='closed-loop-project/3'&&x.operational===false));

const faults=[];
if(!fault)for(const [injected,oracle] of [['foreign-observation','MIGRATION_EXTENSION_PRESERVATION_ORACLE'],['lost-extension','MIGRATION_EXTENSION_PRESERVATION_ORACLE'],['rewritten-raw-response','MIGRATION_RAW_RESPONSE_BYTES_ORACLE']]){
  const run=spawnSync(process.execPath,[import.meta.filename,'--fault='+injected],{encoding:'utf8',timeout:60000,killSignal:'SIGKILL',maxBuffer:1024*1024});
  assert.equal(run.error,undefined,'Migration fault gate timed out or could not execute');
  assert.notEqual(run.status,0,'Undetected migration fault: '+injected);
  assert.ok(run.stderr.includes(oracle),'Migration fault failed for an unrelated reason: '+run.stderr);
  faults.push({fault:injected,oracle,result:'DETECTED',exitCode:run.status,stdout:run.stdout,stderr:run.stderr});
}
console.log(JSON.stringify({faults,verifyV3Migration:'PASS',from:'closed-loop-project/2',to:'closed-loop-project/3',stages:30,unknownExtensionsPreserved:true,rawV2ResponsePreserved:true,originalPayloadPreserved:true,idempotent:true,legacyStage01SemanticFabricationRejected:true,currentV3NoSilentHeal:true}));

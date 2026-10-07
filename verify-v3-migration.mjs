import {runVerifier,assertDetectedFault} from './verify-conformance-regressions.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {verifyMigrationSourceRetention} from './test-migration-source-retention.mjs';
import {verifyBackupCapacityRoundtrip} from './test-backup-capacity-roundtrip.mjs';
import {verifyCanonicalFieldIntegrity} from './test-canonical-field-integrity.mjs';

const fault=process.argv.find(arg=>arg.startsWith('--fault='))?.slice(8)||null;
assert.ok(!fault||['foreign-observation','lost-extension','rewritten-raw-response','recursive-normalization','current-profile-default-rewrite','collection-shape-guard','v2-delegation','worker-migration-receipt','claimed-audit-identity','current-startup-shape','structural-defaults','current-audit-identity','parse-failure-receipt','core-current-archive','current-legacy-container-shape','current-archive-undefined'].includes(fault),'Unknown migration fault');

const priorCurrentCoreMigration="  if(p.schema===PROJECT_SCHEMA&&p.workflow===WORKFLOW_ID&&Number(p.stageCount)===STAGE_COUNT){\n    const migrated=JSON.parse(JSON.stringify(p));\n    if(p.job?.CONTRACT_PROFILE_ID===CONTRACT_PROFILE_ID)return migrated;\n    migrated.projectData=migrated.projectData&&typeof migrated.projectData==='object'?migrated.projectData:{};\n    if(migrated?.job?.CONTRACT_PROFILE_ID!==CONTRACT_PROFILE_ID){\n      migrated.projectData.migrationArchives=Array.isArray(migrated.projectData.migrationArchives)?migrated.projectData.migrationArchives:[];\n      const alreadyLegacy=migrated.projectData.contractProfileMigration?.status==='LEGACY_NON_GATING';\n      if(!alreadyLegacy&&!migrated.projectData.migrationArchives.some(x=>x?.kind==='PRE_PROFILE_V3_SOURCE'&&x?.revision===Number(p.revision||0)))migrated.projectData.migrationArchives.push({kind:'PRE_PROFILE_V3_SOURCE',schema:PROJECT_SCHEMA,revision:Number(p.revision||0),payload:JSON.parse(JSON.stringify(p))});\n      migrated.projectData.contractProfileMigration={status:'LEGACY_NON_GATING',sourceSchema:alreadyLegacy?String(migrated.projectData.contractProfileMigration.sourceSchema||PROJECT_SCHEMA):PROJECT_SCHEMA,targetProfile:CONTRACT_PROFILE_ID,semanticProofMigrated:false};\n      migrated.job=migrated.job&&typeof migrated.job==='object'?migrated.job:{};delete migrated.job.CONTRACT_PROFILE_ID;\n      migrated.job.CURRENT_STATE='BLOCKED';migrated.job.JOB_RECORD_STATUS='INCOMPLETE';migrated.job.CURRENT_STAGE='STAGE 01';\n      migrated.job.CURRENT_BLOCKERS=[...new Set([...(Array.isArray(migrated.job.CURRENT_BLOCKERS)?migrated.job.CURRENT_BLOCKERS:[]),'CONTRACT_PROFILE_MIGRATION_REQUIRED'])];\n      const stage01=migrated?.stages?.['1']||migrated?.stages?.[1];if(stage01){stage01.status='NOT STARTED';stage01.decision='';stage01.decisionEvidence='';stage01.agentData={};stage01.acceptedData={};stage01.gate={satisfied:false,reasons:['Legacy/pre-profile data cannot satisfy current-profile Stage 01.']};}\n      migrated.activeStage=1;return migrated;\n    }\n    migrated.projectData.migrationArchives=Array.isArray(migrated.projectData.migrationArchives)?migrated.projectData.migrationArchives:[];\n    migrated.projectData.historicalImportRecords=Array.isArray(migrated.projectData.historicalImportRecords)?migrated.projectData.historicalImportRecords:[];\n    if(migrated.projectData.stageRecords&&Object.keys(migrated.projectData.stageRecords).length){migrated.projectData.historicalImportRecords.push({kind:'LEGACY_STAGE_RECORDS',schema:PROJECT_SCHEMA,records:JSON.parse(JSON.stringify(migrated.projectData.stageRecords))});migrated.projectData.stageRecords={};}\n    if(migrated.projectData.fullProject&&Object.keys(migrated.projectData.fullProject).length){migrated.projectData.migrationArchives.push({kind:'LEGACY_NESTED_PROJECT',schema:PROJECT_SCHEMA,preservedAt:new Date().toISOString(),payload:JSON.parse(JSON.stringify(migrated.projectData.fullProject))});delete migrated.projectData.fullProject;}\n    return migrated;\n  }\n";
class Event { constructor(type){ this.type=type; } }
const context={console,crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,Uint8Array,ArrayBuffer,Date,Math,JSON,Set,Map,Event,dispatchEvent:()=>true};context.globalThis=context;
createVerifierRuntime(context);
for(const file of ['workbook.js','hash.js','workflow-schema.js']){
  let source=fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8');
  if(file==='workbook.js'&&fault==='core-current-archive'){const anchor="  if(p.schema==='closed-loop-project/2'||p.schema===PROJECT_SCHEMA){";assert.equal(source.split(anchor).length,2);source=source.replace(anchor,priorCurrentCoreMigration+anchor);}
  if(file==='workflow-schema.js'&&['lost-extension','rewritten-raw-response'].includes(fault)){
    const anchor='  migrated=ensureV3Defaults(migrated);';
    assert.equal(source.split(anchor).length-1,1,'Migration fault must target exactly one production boundary');
    source=source.replace(anchor,anchor+(fault==='lost-extension'?'\n  delete migrated.unknownTopLevelExtension;':"\n  migrated.projectData.rawResponses[0].rawText='rewritten historical response';"));
  }
  if(file==='workflow-schema.js'&&fault==='recursive-normalization'){const start=source.indexOf('function normalizeTestRecords(project){'),end=source.indexOf('\nfunction migrationValuesEqual',start);assert(start>=0&&end>start);source=source.slice(0,start)+"function normalizeTestRecords(value,seen=new WeakSet()){\n  if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);\n  const fields=value.fields&&typeof value.fields==='object'&&!Array.isArray(value.fields)?value.fields:value;\n  if(Object.prototype.hasOwnProperty.call(fields,'TEST_ID')||Object.prototype.hasOwnProperty.call(fields,'EXECUTABLE_KIND')||Object.prototype.hasOwnProperty.call(fields,'EXECUTABLE_SPEC')){\n    if(fields.EXECUTABLE_KIND==='CUSTOM_PIPELINE')fields.EXECUTABLE_KIND='TEST_IR';\n    if(!fields.EXECUTABLE_KIND)fields.EXECUTABLE_KIND='NONE';\n    fields.EXECUTABLE_SPEC_VERSION=TEST_IR_SCHEMA;\n    if(!Object.prototype.hasOwnProperty.call(fields,'EXECUTABLE_SPEC'))fields.EXECUTABLE_SPEC=null;\n    if(!fields.EXECUTABLE_INPUT_BINDINGS||typeof fields.EXECUTABLE_INPUT_BINDINGS!=='object'||Array.isArray(fields.EXECUTABLE_INPUT_BINDINGS))fields.EXECUTABLE_INPUT_BINDINGS={};\n    if(!Object.prototype.hasOwnProperty.call(fields,'EXECUTABLE_SPEC_SHA256'))fields.EXECUTABLE_SPEC_SHA256='';\n  }\n  if(Array.isArray(value)){for(const item of value)normalizeTestRecords(item,seen);}else for(const [key,item] of Object.entries(value)){if(key==='payload'&&value.operational===false)continue;normalizeTestRecords(item,seen);}\n}"+source.slice(end);}
  if(file==='workflow-schema.js'&&fault==='claimed-audit-identity'){source=source.replace("const alreadyLegacy=original?.schema===CURRENT_PROJECT_SCHEMA&&original?.projectData?.contractProfileMigration?.status==='LEGACY_NON_GATING';","const alreadyLegacy=original?.projectData?.contractProfileMigration?.status==='LEGACY_NON_GATING';").replace('if(!alreadyLegacy||migrationChanged)project.projectData.nonOperationalImportedPayloads.push',"if(!alreadyLegacy&&!project.projectData.nonOperationalImportedPayloads.some(item=>item&&item.sourceSchema===sourceSchema&&item.sourceRevision===sourceRevision&&item.operational===false))project.projectData.nonOperationalImportedPayloads.push");}
  if(file==='workflow-schema.js'&&fault==='current-audit-identity'){const anchor='if(!alreadyLegacy||migrationChanged)project.projectData.nonOperationalImportedPayloads.push';assert.equal(source.split(anchor).length,2);source=source.replace(anchor,'if(!alreadyLegacy)project.projectData.nonOperationalImportedPayloads.push');}
  if(file==='workflow-schema.js'&&fault==='current-legacy-container-shape'){const anchor="const hasStages=stageRecords&&Object.prototype.toString.call(stageRecords)==='[object Object]'&&Object.keys(stageRecords).length";assert.equal(source.split(anchor).length,2);source=source.replace(anchor,"const hasStages=stageRecords&&typeof stageRecords==='object'&&Object.keys(stageRecords).length");}
  if(file==='workflow-schema.js'&&fault==='current-archive-undefined'){const anchor='    if(!Object.prototype.hasOwnProperty.call(data,key))data[key]=[];';assert.equal(source.split(anchor).length,2);source=source.replace(anchor,'    if(data[key]===undefined)data[key]=[];');}
  if(file==='workflow-schema.js'&&fault==='current-profile-default-rewrite'){const before='const current=clone(input);return current?.job?.CONTRACT_PROFILE_ID';assert.equal(source.split(before).length,2);source=source.replace(before,'const current=ensureV3Defaults(clone(input));return current?.job?.CONTRACT_PROFILE_ID');}
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
// Unknown and retained response data can legitimately contain field-like
// names. Only an explicitly owned legacy test collection may be migrated.
const opaqueExtension={fields:{TEST_ID:'VENDOR-OPAQUE-ID',EXECUTABLE_KIND:'CUSTOM_PIPELINE',EXECUTABLE_SPEC_VERSION:'vendor-spec/7',EXECUTABLE_SPEC:{opaque:true}},nested:{TEST_ID:'NOT-A-TEST-RECORD'}};
previous.projectData.tests=[{fields:{TEST_ID:'DIRECT-LEGACY-TEST',EXECUTABLE_KIND:'CUSTOM_PIPELINE',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_SPEC:{version:'closed-loop-test-spec/1',steps:[{op:'ASSERT_EQ',value:true}]}},vendorExtension:structuredClone(opaqueExtension)}];
previous.vendorExtension=structuredClone(opaqueExtension);previous.projectData.vendorExtension=structuredClone(opaqueExtension);previous.stages[7].vendorExtension=structuredClone(opaqueExtension);previous.projectData.collections.tests[0].vendorExtension=structuredClone(opaqueExtension);
previous.projectData.rawResponses[0].envelope.records=[{collection:'tests',fields:{TEST_ID:'HISTORICAL-ONLY',EXECUTABLE_KIND:'CUSTOM_PIPELINE',EXECUTABLE_SPEC_VERSION:'vendor-spec/7',EXECUTABLE_SPEC:{opaque:true}}}];
previous.projectData.rawResponses[0].rawText=JSON.stringify(previous.projectData.rawResponses[0].envelope);
const original=structuredClone(previous);
// The production migration executes in its browser-like VM realm. Observe its
// result in the assertion realm without JSON normalization or loss of undefined
// properties. Cross-realm prototypes are not part of the persisted data contract.
const migrationResult=schema.migrateProjectToCurrent(previous);
const migrated=fault==='foreign-observation'?migrationResult:structuredClone(migrationResult);
assert.equal(migrated.schema,'closed-loop-project/3');
assert.equal(Object.keys(migrated.stages).length,30,'migration must preserve exactly 30 stages');
assert.deepEqual(migrated.unknownTopLevelExtension,{preserve:'exactly'},'MIGRATION_EXTENSION_PRESERVATION_ORACLE');
assert.deepEqual(migrated.projectData.unknownProjectDataExtension,{preserve:42});
assert.deepEqual(migrated.stages[7].unknownStageExtension,{preserve:true});
assert.deepEqual(migrated.projectData.collections.tests[0].unknownRecordExtension,{keep:true});
assert.equal(migrated.projectData.collections.tests[0].fields.EXECUTABLE_KIND,'TEST_IR');
assert.equal(migrated.projectData.collections.tests[0].fields.EXECUTABLE_SPEC_VERSION,'closed-loop-test-spec/1');
assert.equal(migrated.projectData.tests[0].fields.EXECUTABLE_KIND,'TEST_IR','MIGRATION_DIRECT_TEST_COLLECTION_ORACLE');
for(const [label,value]of [['top',migrated.vendorExtension],['direct-test-extension',migrated.projectData.tests[0].vendorExtension],['project-data',migrated.projectData.vendorExtension],['stage',migrated.stages[7].vendorExtension],['test-record-extension',migrated.projectData.collections.tests[0].vendorExtension]])assert.deepEqual(value,opaqueExtension,'MIGRATION_OPAQUE_EXTENSION_ORACLE: '+label);
assert.deepEqual(migrated.projectData.rawResponses[0].envelope,original.projectData.rawResponses[0].envelope,'MIGRATION_HISTORICAL_ENVELOPE_ORACLE');

assert.equal(migrated.workflow,'mobile-closed-loop/30');
assert.equal(migrated.projectData.rawResponses[0].envelope.schema,'closed-loop-stage-response/2','old responses remain historical bytes/data');
assert.equal(migrated.projectData.rawResponses[0].rawText,original.projectData.rawResponses[0].rawText,'MIGRATION_RAW_RESPONSE_BYTES_ORACLE: raw response text must remain exact');
assert.ok(Array.isArray(migrated.projectData.nonOperationalImportedPayloads));
const audit=migrated.projectData.nonOperationalImportedPayloads.at(-1);
assert.equal(audit.operational,false);
assert.equal(audit.sourceSchema,'closed-loop-project/2');
assert.deepEqual(audit.payload,original,'original imported payload must be preserved as non-operational audit evidence');
for(const variant of ['same-label-wrong-payload','claimed-migration-status']){
  const input=structuredClone(original);
  if(variant==='same-label-wrong-payload')input.projectData.nonOperationalImportedPayloads=[{sourceSchema:input.schema,sourceRevision:input.revision,operational:false,payload:{wrong:'prior original'}}];
  else input.projectData.contractProfileMigration={status:'LEGACY_NON_GATING',sourceSchema:input.schema};
  const before=structuredClone(input),result=structuredClone(schema.migrateProjectToCurrent(input));
  assert.deepEqual(result.projectData.nonOperationalImportedPayloads.at(-1).payload,before,'MIGRATION_ORIGINAL_AUDIT_IDENTITY_ORACLE: '+variant);
  assert.equal(result.projectData.nonOperationalImportedPayloads.at(-1).operational,false);
  assert.deepEqual(input,before);assert.equal(schema.validateContractProfile(result).valid,false);
}
assert.equal(audit.payload.job.EXACT_USER_OBJECTIVE_VERBATIM,'Preserved migration objective','legacy human authority must remain preserved as historical evidence while not being promoted to current agent semantics');
for(const key of ['intakeCoverageManifests','obligationManifests','promptContextManifests','blindAliasMaps','nativeExecutionEvents'])assert.ok(Array.isArray(migrated.projectData[key]),`migration default missing: ${key}`);
assert.deepEqual(previous,original,'migration must not mutate the imported object');
assert.equal(String(migrated.stages[1].agentData.INPUT_SET_CONTENTS||''),'','/2 -> /3 migration must not fabricate current agent-owned Stage 01 semantic intake from preserved human authority');
assert.equal(migrated.job.CONTRACT_PROFILE_ID,undefined,'legacy /2 migration must not acquire current profile without complete profile proof');
assert.equal(migrated.job.CURRENT_STATE,'BLOCKED');assert.equal(migrated.job.JOB_RECORD_STATUS,'INCOMPLETE');assert.equal(migrated.projectData.contractProfileMigration.status,'LEGACY_NON_GATING');assert.equal(schema.validateContractProfile(migrated).valid,false);

for(const variant of ['missing','wrong']){
  const input=structuredClone(migrated);input.stageCount=30;input.stages[1].agentData={UNCHANGED_ORIGINAL_INPUT:'must remain in audit'};
  if(variant==='missing')delete input.projectData.nonOperationalImportedPayloads;
  else input.projectData.nonOperationalImportedPayloads=[{sourceSchema:input.schema,sourceRevision:input.revision,operational:false,payload:{wrong:'claimed prior original'}}];
  const originalCurrent=structuredClone(input),result=structuredClone(schema.migrateProjectToCurrent(input));
  assert.deepEqual(result.projectData.nonOperationalImportedPayloads.at(-1)?.payload,originalCurrent,'MIGRATION_CURRENT_ORIGINAL_AUDIT_ORACLE: '+variant);
  assert.equal(result.projectData.nonOperationalImportedPayloads.at(-1).sourceSchema,'closed-loop-project/3');assert.deepEqual(input,originalCurrent);
  const coreResult=structuredClone(context.closedLoopCore.migrateState(input));assert.deepEqual(coreResult.projectData.nonOperationalImportedPayloads?.at(-1)?.payload,originalCurrent,'MIGRATION_CORE_CURRENT_ORIGINAL_AUDIT_ORACLE: '+variant);
  assert.deepEqual(structuredClone(schema.migrateProjectToCurrent(result)),result,'MIGRATION_EXACT_IDEMPOTENCE_ORACLE');
}
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

// Current /3 is not a legacy conversion opportunity. Preserve malformed
// current fields for their actual integrity owner rather than silently healing.
const currentProfile=structuredClone(context.closedLoopCore.createBlankState('JOB-CURRENT-PRESERVATION'));currentProfile.vendorExtension=structuredClone(opaqueExtension);currentProfile.projectData.tests=[structuredClone(previous.projectData.tests[0])];currentProfile.projectData.rawResponses=structuredClone(previous.projectData.rawResponses);currentProfile.projectData.intakeCoverageManifests='invalid current collection';currentProfile.projectData.schemaIdentities={testIr:'unrecognized-current-identity'};
assert.deepEqual(structuredClone(schema.migrateProjectToCurrent(currentProfile)),currentProfile,'MIGRATION_CURRENT_NO_SILENT_REWRITE_ORACLE');
const currentWorkbook=structuredClone(currentProfile);currentWorkbook.projectData.migrationArchives='opaque-invalid-archive';currentWorkbook.projectData.historicalImportRecords={opaque:'invalid history'};assert.deepEqual(structuredClone(context.closedLoopCore.migrateState(currentWorkbook)),currentWorkbook,'MIGRATION_CURRENT_WORKBOOK_NO_SILENT_REWRITE_ORACLE');
const invalidLegacyContainer=structuredClone(context.closedLoopCore.createBlankState('JOB-CURRENT-INVALID-LEGACY-CONTAINER'));invalidLegacyContainer.projectData.stageRecords=[{opaque:'wrong declared container type'}];
for(const migrate of [schema.migrateProjectToCurrent,context.closedLoopCore.migrateState]){
  const result=structuredClone(migrate(invalidLegacyContainer));assert.deepEqual(result,invalidLegacyContainer,'MIGRATION_CURRENT_INVALID_LEGACY_CONTAINER_ORACLE');
  assert.ok(schema.projectShapeIssues(result).includes('projectData.stageRecords is not an object.'));
}
for(const name of ['migrationArchives','historicalImportRecords','nonOperationalImportedPayloads']){
  const input=structuredClone(context.closedLoopCore.createBlankState('JOB-PRESENT-UNDEFINED-ARCHIVE'));input.projectData.stageRecords={7:{opaque:'valid legacy record'}};input.projectData[name]=undefined;const before=structuredClone(input);
  assert.throws(()=>schema.migrateProjectToCurrent(input),error=>error.message===`Migration cannot preserve the original because ${name} is not an array.`,'MIGRATION_PRESENT_UNDEFINED_ARCHIVE_ORACLE: '+name);assert.deepEqual(input,before);
}
// Exercise the exported production migration command through actual storage,
// reload and real package bytes. This is a declared legacy fixture, not a claim
// that the application UI imported an old project or any prior gate completed.
const storageOverrides={};if(fault==='collection-shape-guard'){
  const source=fs.readFileSync('project-store.js','utf8'),start=source.indexOf('async function prepareProjectWrite(project,options={}){'),end=source.indexOf('\nasync function writeProject(',start);
  assert.ok(start>=0&&end>start,'Migration collection fault must find its owning preparation boundary');
  const preparation=source.slice(start,end),anchor='  assertProjectCollectionShape(next);\n';
  assert.equal(preparation.split(anchor).length-1,1,'Migration collection fault must remove exactly one owning store guard');
  storageOverrides['project-store.js']=source.slice(0,start)+preparation.replace(anchor,'')+source.slice(end);
  // The shared normalizer independently guards this shape. Remove only that
  // duplicate shape check so the fault reaches the original lossy default;
  // scalar-field validation and every other write/integrity guard stay active.
  const engineSource=fs.readFileSync('workflow-engine.js','utf8'),engineAnchor=/^  const shapeIssues=schema.projectShapeIssues\(project,ALL_COLLECTIONS\);.*\n/gm;
  assert.equal([...engineSource.matchAll(engineAnchor)].length,1,'Migration collection fault must remove exactly one shared normalizer guard');
  storageOverrides['workflow-engine.js']=engineSource.replace(engineAnchor,'');
}
if(fault==='structural-defaults'){
  const source=fs.readFileSync('workflow-schema.js','utf8'),start=source.indexOf('function projectShapeIssues(project,collections=[]){'),end=source.indexOf('\nconst RESPONSE_TYPES=',start);assert(start>=0&&end>start);
  storageOverrides['workflow-schema.js']=source.slice(0,start)+"function projectShapeIssues(project,collections=[]){const data=project?.projectData;if(data===undefined)return [];if(!data||typeof data!=='object'||Array.isArray(data))return ['projectData is not an object.'];return collections.filter(key=>data[key]!==undefined&&!Array.isArray(data[key])).map(key=>`${key} is not an array.`);}"+source.slice(end);
}
const stored=projectStoreRuntime({sourceOverrides:storageOverrides}),e=stored.engine,h=stored.runtime.closedLoopHash,owner=stored.store;
let current=await owner.createProject({commandId:'SYNTHETIC-MIGRATION-STORAGE'});const opaqueBytes=new Blob([Uint8Array.of(0,13,10,255,65)]),artifactId=e.allocateId(current,'artifacts'),digest=await h.sha256Bytes(opaqueBytes);await owner.putArtifact({artifactId,jobId:current.job.JOB_ID,blob:opaqueBytes,filename:'opaque.bin',mediaType:'application/octet-stream'});e.registerArtifactBytes(current,stored.copy({stage:1,artifactId,filename:'opaque.bin',mediaType:'application/octet-stream',byteSize:opaqueBytes.size,sha256:digest}));
const shapeCases=[];for(const collection of e.ALL_COLLECTIONS)for(const value of [null,{},'invalid collection']){const candidate=stored.copy(current);candidate.projectData[collection]=stored.copy(value);const checked=owner.validateProjectIntegrity(candidate,{verifyDerived:false});assert.equal(checked.valid,false,'MIGRATION_COLLECTION_TYPE_ORACLE: '+collection);assert.deepEqual(Array.from(checked.issues),[collection+' is not an array.'],'MIGRATION_COLLECTION_DIAGNOSTIC_ORACLE: '+collection);shapeCases.push({collection,valueType:value===null?'null':typeof value,rejected:true});}
const beforeInvalidWrite=await owner.readProject(current.job.JOB_ID),beforeInvalidHistory=await owner.historyList(current.job.JOB_ID);
const invalidCurrent=stored.copy(current);invalidCurrent.projectData.intakeCoverageManifests='invalid current collection';const unhealed=owner.migrateProjectToCurrent(invalidCurrent);assert.deepEqual(unhealed,invalidCurrent,'MIGRATION_INVALID_CURRENT_PRESERVED_ORACLE');assert.equal(owner.validateProjectIntegrity(unhealed).valid,false,'MIGRATION_INVALID_CURRENT_INTEGRITY_ORACLE');await assert.rejects(owner.writeProject(unhealed,{expectedProjectRevision:current.revision}),error=>error.code==='PROJECT_INTEGRITY_FAILED','MIGRATION_INVALID_CURRENT_WRITE_ORACLE');await assert.rejects(owner.writeProject(unhealed,{operational:true,expectedProjectRevision:current.revision,expectedStateSha256:beforeInvalidWrite.projectSha256}),error=>error.code==='PROJECT_INTEGRITY_FAILED','MIGRATION_INVALID_CURRENT_OPERATIONAL_WRITE_ORACLE');assert.deepEqual(await owner.readProject(current.job.JOB_ID),beforeInvalidWrite,'MIGRATION_INVALID_CURRENT_STATE_PRESERVED_ORACLE');assert.deepEqual(await owner.historyList(current.job.JOB_ID),beforeInvalidHistory,'MIGRATION_INVALID_CURRENT_HISTORY_PRESERVED_ORACLE');
// Independently enumerated containers cover every defaulting location, all30
// stages, and both object/array confusion directions. No expected result is
// obtained from the production shape declaration.
const structuralPaths=[
  ...['projectData','stages','job','release'].map(name=>({path:[name],type:'object'})),
  ...['permanentRegistry','stageRecords','userEntered','idCounters'].map(name=>({path:['projectData',name],type:'object'})),
  ...['allocationReceipts','migrationArchives','historicalImportRecords','nonOperationalImportedPayloads'].map(name=>({path:['projectData',name],type:'array'})),
  ...['auditedDraft','releaseDraft','comparisons','authorizedArtifactIds'].map(name=>({path:['release',name],type:'array'}))
];
for(let stage=1;stage<=30;stage++){
  structuralPaths.push({path:['stages',String(stage)],type:'object'});
  for(const name of ['agentData','humanData','derivedData','acceptedData','humanChecks','gateChecks','evidenceChecks','gate'])structuralPaths.push({path:['stages',String(stage),name],type:'object'});
  for(const name of ['authorizedFiles','revisions','acceptedDataChangeIds','acceptedControlEventIds','acceptedResponseIds'])structuralPaths.push({path:['stages',String(stage),name],type:'array'});
  structuralPaths.push({path:['stages',String(stage),'gate','reasons'],type:'array'});
}
const setPath=(object,path,value)=>{let target=object;for(const key of path.slice(0,-1))target=target[key];target[path.at(-1)]=value;};
let structuralShapeCases=0;const structuralWriteCases=[];
for(const entry of structuralPaths)for(const wrong of [null,'wrong type',entry.type==='object'?[]:{}]){
  const candidate=stored.copy(current);setPath(candidate,entry.path,stored.copy(wrong));const before=stored.copy(candidate),label=entry.path.join('.');
  assert.equal(owner.validateProjectIntegrity(candidate,{verifyDerived:false}).valid,false,'MIGRATION_STRUCTURAL_SHAPE_ORACLE: '+label);
  assert.throws(()=>e.ensureShape(candidate),error=>error.code==='PROJECT_INTEGRITY_FAILED','MIGRATION_STRUCTURAL_DEFAULT_ORACLE: '+label);assert.deepEqual(candidate,before);structuralShapeCases++;
  if(wrong==='wrong type'&&(entry.path[0]!=='stages'||['1','30'].includes(entry.path[1]))){await assert.rejects(owner.writeProject(candidate,{expectedProjectRevision:current.revision}),error=>error.code==='PROJECT_INTEGRITY_FAILED'||label==='job'&&error.message==='A project without a JOB_ID cannot be committed.','MIGRATION_STRUCTURAL_WRITE_ORACLE: '+label);structuralWriteCases.push(label);}
}
for(const [path,value] of [[['projectData','eventSequence'],'1'],[['projectData','eventSequence'],null],[['stages','1','draftRecord'],false],[['stages','30','number'],29]]){
  const candidate=stored.copy(current);setPath(candidate,path,value);assert.equal(owner.validateProjectIntegrity(candidate,{verifyDerived:false}).valid,false);assert.throws(()=>e.ensureShape(candidate),error=>error.code==='PROJECT_INTEGRITY_FAILED');
}
const omitted=stored.copy(current);delete omitted.projectData.userEntered;delete omitted.stages[1].humanData;delete omitted.stages[30].acceptedResponseIds;delete omitted.release.auditedDraft;e.ensureShape(omitted);assert.deepEqual(JSON.parse(JSON.stringify(omitted.projectData.userEntered)),{});assert.deepEqual(JSON.parse(JSON.stringify(omitted.stages[1].humanData)),{});assert.deepEqual(Array.from(omitted.stages[30].acceptedResponseIds),[]);assert.deepEqual(Array.from(omitted.release.auditedDraft),[]);
current=await owner.writeProject(omitted,{expectedProjectRevision:current.revision});assert.equal(owner.validateProjectIntegrity(current).valid,true,'MIGRATION_MISSING_DEFAULT_CONTROL_ORACLE');
const storageLegacy=stored.copy(current);storageLegacy.schema='closed-loop-project/2';storageLegacy.vendorExtension=stored.copy(opaqueExtension);storageLegacy.projectData.rawResponses=stored.copy(previous.projectData.rawResponses);delete storageLegacy.job.CONTRACT_PROFILE_ID;const rawBefore=JSON.stringify(storageLegacy.projectData.rawResponses),originalLegacy=stored.copy(storageLegacy);
const converted=owner.migrateProjectToCurrent(storageLegacy);assert.equal(converted.projectData.contractProfileMigration.status,'LEGACY_NON_GATING');assert.deepEqual(storageLegacy,originalLegacy);current=await owner.writeProject(converted,{expectedProjectRevision:current.revision});
const checkStored=async(runtime,project)=>{assert.deepEqual(JSON.parse(JSON.stringify(project.vendorExtension)),opaqueExtension,'MIGRATION_STORAGE_EXTENSION_ORACLE');assert.deepEqual(JSON.parse(JSON.stringify(project.projectData.rawResponses)),JSON.parse(rawBefore),'MIGRATION_STORAGE_RAW_ENVELOPE_ORACLE');assert.equal(runtime.runtime.closedLoopWorkflowSchema.validateContractProfile(project).valid,false,'MIGRATION_STORAGE_NON_GATING_ORACLE');assert.equal(runtime.engine.gate(1,project).complete,false);const bytes=await runtime.store.getArtifact(artifactId,{jobId:project.job.JOB_ID});assert.deepEqual(new Uint8Array(await bytes.blob.arrayBuffer()),new Uint8Array(await opaqueBytes.arrayBuffer()),'MIGRATION_STORAGE_EXACT_BYTES_ORACLE');};
await checkStored(stored,await owner.readProject(current.job.JOB_ID));const packageBytes=await owner.exportPackage(current.job.JOB_ID),destination=projectStoreRuntime(),imported=await destination.store.importPackage(packageBytes);await checkStored(destination,imported);await checkStored(destination,await destination.store.readProject(imported.job.JOB_ID));
if(process.env.CLRT_MIGRATION_FIXTURE_DIRECTORY){const output=process.env.CLRT_MIGRATION_FIXTURE_DIRECTORY;fs.mkdirSync(output,{recursive:true});fs.writeFileSync(output+'/legacy-migrated-backup.bin',new Uint8Array(await (packageBytes.blob||packageBytes).arrayBuffer()));fs.writeFileSync(output+'/expected.json',JSON.stringify({schema:'closed-loop-migration-byte-preservation-fixture/1',jobId:current.job.JOB_ID,opaqueExtension,rawResponses:JSON.parse(rawBefore),artifact:{artifactId,sha256:digest,bytes:[0,13,10,255,65],filename:'opaque.bin'},legacyGating:'LEGACY_NON_GATING',synthetic:true,actualBrowser:false},null,2));}


// Normal document startup owns legacy localStorage and delegates /2 conversion
// to the schema owner; the worker cannot erase that migration receipt.
const startupSource=structuredClone(context.closedLoopCore.createBlankState('JOB-STARTUP-V2'));startupSource.schema='closed-loop-project/2';delete startupSource.job.CONTRACT_PROFILE_ID;startupSource.vendorExtension=structuredClone(opaqueExtension);startupSource.projectData.collections={tests:[structuredClone(previous.projectData.collections.tests[0])]};startupSource.projectData.rawResponses=structuredClone(previous.projectData.rawResponses);
const startupOverrides={};if(fault==='v2-delegation'){const source=fs.readFileSync('workbook.js','utf8'),start=source.indexOf("  if(p.schema==='closed-loop-project/2'||p.schema===PROJECT_SCHEMA){"),end=source.indexOf("\n  if(p.schema!=='human-project/30')",start);assert(start>=0&&end>start);startupOverrides['workbook.js']=source.slice(0,start)+source.slice(end);}if(fault==='worker-migration-receipt'){const source=fs.readFileSync('project-store.js','utf8'),anchor='  if(!globalThis.localStorage)return {migrated:0};';assert.equal(source.split(anchor).length,2);startupOverrides['project-store.js']=source.replace(anchor,'');}
if(fault==='current-startup-shape'){const source=fs.readFileSync('project-store.js','utf8'),anchor='if(source.schema===globalThis.closedLoopWorkflowSchema?.PROJECT_SCHEMA)assertProjectCollectionShape(source);';assert.equal(source.split(anchor).length,2);startupOverrides['project-store.js']=source.replace(anchor,'');startupOverrides['workbook.js']=fs.readFileSync('workbook.js','utf8').replace("  if(p.schema==='closed-loop-project/2'||p.schema===PROJECT_SCHEMA){",priorCurrentCoreMigration.replace('    if(p.job?.CONTRACT_PROFILE_ID===CONTRACT_PROFILE_ID)return migrated;','')+"  if(p.schema==='closed-loop-project/2'||p.schema===PROJECT_SCHEMA){");}
const startup=projectStoreRuntime({sourceOverrides:startupOverrides}),legacyKey=startup.store.LEGACY_KEYS[0],legacyText=JSON.stringify([startupSource]);startup.runtime.localStorage.setItem(legacyKey,legacyText);const startupProjects=await startup.store.readAll();assert.equal(startupProjects.length,1,'MIGRATION_V2_STARTUP_ORACLE');const startupProject=startupProjects[0];assert.equal(startupProject.schema,'closed-loop-project/3');assert.deepEqual(JSON.parse(JSON.stringify(startupProject.vendorExtension)),opaqueExtension);assert.deepEqual(JSON.parse(JSON.stringify(startupProject.projectData.rawResponses)),previous.projectData.rawResponses);assert.equal(startupProject.projectData.collections.tests[0].fields.EXECUTABLE_KIND,'TEST_IR');assert.equal(startup.runtime.closedLoopWorkflowSchema.validateContractProfile(startupProject).valid,false);assert.equal(startup.engine.gate(1,startupProject).complete,false);assert.equal(startup.runtime.localStorage.getItem(legacyKey),null);assert.equal((await startup.store.metaGet('migrationStatus')).status,'COMPLETE');
const startupBackup=await startup.store.exportPackage(startupProject.job.JOB_ID),startupRestored=projectStoreRuntime();const startupImported=await startupRestored.store.importPackage(startupBackup);assert.deepEqual(JSON.parse(JSON.stringify(startupImported.vendorExtension)),opaqueExtension);assert.deepEqual(JSON.parse(JSON.stringify(startupImported.projectData.rawResponses)),previous.projectData.rawResponses);
const ownerUnavailable=createVerifierRuntime({Event,dispatchEvent:()=>true});vm.runInContext(fs.readFileSync('workbook.js','utf8'),ownerUnavailable,{filename:'workbook.js'});assert.throws(()=>ownerUnavailable.closedLoopCore.migrateState(startupSource),/schema migration owner is unavailable/,'MIGRATION_OWNER_UNAVAILABLE_ORACLE');
const future={...startupSource,schema:'closed-loop-project/999'},futureCopy=structuredClone(future);assert.throws(()=>context.closedLoopCore.migrateState(future),/Unsupported project schema/,'MIGRATION_FUTURE_SCHEMA_ORACLE');assert.deepEqual(future,futureCopy);
const failedStartup=projectStoreRuntime({sourceOverrides:startupOverrides}),badText=JSON.stringify([future]);failedStartup.runtime.localStorage.setItem(legacyKey,badText);const quietConsole=failedStartup.runtime.console;failedStartup.runtime.console={...quietConsole,error(){}};try{assert.equal((await failedStartup.store.readAll()).length,0);}finally{failedStartup.runtime.console=quietConsole;}assert.equal(failedStartup.runtime.localStorage.getItem(legacyKey),badText);const failedStatus=await failedStartup.store.metaGet('migrationStatus');assert.equal(failedStatus.status,'FAILED');failedStartup.runtime.localStorage=undefined;await failedStartup.store.readAll();assert.deepEqual(await failedStartup.store.metaGet('migrationStatus'),failedStatus,'MIGRATION_DOCUMENT_RECEIPT_OWNER_ORACLE');
for(const variant of ['claimed-missing','claimed-wrong']){
  const input=structuredClone(startupSource);input.schema='closed-loop-project/3';input.projectData.contractProfileMigration={status:'LEGACY_NON_GATING',sourceSchema:'closed-loop-project/3'};input.stages[1].agentData={UNIQUE_ORIGINAL:'retain exact startup data'};
  if(variant==='claimed-wrong')input.projectData.nonOperationalImportedPayloads=[{sourceSchema:input.schema,sourceRevision:input.revision,operational:false,payload:{wrong:'claimed original'}}];
  const r=projectStoreRuntime(),raw=JSON.stringify([input]);r.runtime.localStorage.setItem(legacyKey,raw);const projects=await r.store.readAll();assert.equal(projects.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(projects[0].projectData.nonOperationalImportedPayloads.at(-1).payload)),input,'MIGRATION_STARTUP_CURRENT_ORIGINAL_AUDIT_ORACLE: '+variant);assert.equal(r.runtime.closedLoopWorkflowSchema.validateContractProfile(projects[0]).valid,false);
}
// Wrong-type current state is rejected before migration/defaulting can erase it.
for(const variant of ['projectData','intakeCoverageManifests','migrationArchives','historicalImportRecords']){
  const broken=structuredClone(context.closedLoopCore.createBlankState('JOB-CURRENT-BROKEN-'+variant));
  if(variant==='projectData')broken.projectData='invalid data';else broken.projectData[variant]='invalid collection';
  const r=projectStoreRuntime({sourceOverrides:startupOverrides,environment:{console:{...console,error(){}}}}),raw=JSON.stringify([broken]);r.runtime.localStorage.setItem(legacyKey,raw);
  assert.equal((await r.store.readAll()).length,0,'MIGRATION_CURRENT_STARTUP_REJECTION_ORACLE: '+variant);
  assert.equal(r.runtime.localStorage.getItem(legacyKey),raw);assert.equal((await r.store.metaGet('migrationStatus')).status,'FAILED');
}
// Recover exact document strings, including malformed JSON, only through the
// existing password-protected non-activatable recovery format.
const parseOverrides={};if(fault==='parse-failure-receipt'){const source=fs.readFileSync('project-store.js','utf8'),start=source.indexOf('  let legacy;try{legacy=parseLegacy();}catch(error){'),end=source.indexOf('if(!legacy.length)',start);assert(start>=0&&end>start);parseOverrides['project-store.js']=source.slice(0,start)+'  const legacy=parseLegacy();'+source.slice(end);}
const failedParse=projectStoreRuntime({sourceOverrides:parseOverrides,environment:{console:{...console,error(){}}}}),rawEntries=Array.from(failedParse.store.LEGACY_KEYS,(key,index)=>({key,value:index===0?' {broken JSON \r\n é \ud800':index===1?'':JSON.stringify({untouched:index})}));
for(const entry of rawEntries)failedParse.runtime.localStorage.setItem(entry.key,entry.value);
assert.equal((await failedParse.store.readAll()).length,0);assert.equal((await failedParse.store.metaGet('migrationStatus'))?.status,'FAILED','MIGRATION_PARSE_FAILURE_RECEIPT_ORACLE');
await assert.rejects(failedParse.store.exportLegacyMigrationData(),error=>error.code==='BACKUP_PASSPHRASE_REQUIRED');
const passphrase='SYNTHETIC migration recovery password',protectedRecovery=await failedParse.store.exportLegacyMigrationData({passphrase}),container=JSON.parse(await protectedRecovery.text()),salt=Buffer.from(container.salt,'hex'),iv=Buffer.from(container.iv,'hex');
const material=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']),key=await webcrypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
const plaintext=await webcrypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:Buffer.from(container.manifestSha256,'hex'),tagLength:128},key,Buffer.concat([Buffer.from(container.ciphertext,'base64'),Buffer.from(container.authenticationTag,'hex')])),recovery=JSON.parse(gunzipSync(Buffer.from(plaintext)).toString('utf8'));
assert.equal(recovery.schema,'closed-loop-quarantine-package/1');assert.equal(recovery.packageManifest.activationPermitted,false);assert.equal(recovery.packageManifest.recoveryKind,'LEGACY_LOCAL_STORAGE');
const graph=JSON.parse(Buffer.from(recovery.artifacts.find(file=>file.path==='raw-project.json').base64,'base64').toString('utf8'));
const decode=value=>{if(!Object.hasOwn(value,'ref'))return value.value??null;const node=graph.nodes[value.ref];if(node.kind==='Array')return node.entries.map(([,item])=>decode(item));assert.equal(node.kind,'Object');return Object.fromEntries(node.entries.map(([name,item])=>[name,decode(item)]));};
const recovered=decode(graph.root);assert.equal(recovered.kind,'LEGACY_LOCAL_STORAGE');assert.deepEqual(recovered.entries,rawEntries,'MIGRATION_EXACT_RAW_RECOVERY_ORACLE');assert.equal(recovered.migrationStatus.status,'FAILED');
for(const entry of rawEntries)assert.equal(failedParse.runtime.localStorage.getItem(entry.key),entry.value);
await assert.rejects(failedParse.store.importPackage(protectedRecovery,{passphrase}),/Unsupported project package schema/);assert.equal(failedParse.rows.get('projects').size,0);
await assert.rejects(projectStoreRuntime().store.exportLegacyMigrationData({passphrase}),error=>error.code==='NO_LEGACY_MIGRATION_DATA');
if(process.env.CLRT_MIGRATION_FIXTURE_DIRECTORY)fs.writeFileSync(process.env.CLRT_MIGRATION_FIXTURE_DIRECTORY+'/startup-legacy-v2.json',legacyText);

const canonicalFieldIntegrity=!fault?await verifyCanonicalFieldIntegrity():null;
const sourceBytePreservation=!fault?await verifyMigrationSourceRetention({fixtureDirectory:process.env.CLRT_SOURCE_FIXTURE_DIRECTORY||null}):null;
const backupCapacityRoundtrip=!fault?await verifyBackupCapacityRoundtrip():null;
const faults=[];
if(!fault){
 const oracle='BACKUP_CAPACITY_ROUNDTRIP_ORACLE',run=await runVerifier(process.execPath,['test-backup-capacity-roundtrip.mjs','--fault=source-copy'],{encoding:'utf8',timeout:60000,killSignal:'SIGKILL',maxBuffer:1024*1024});assert.equal(run.error,null);assertDetectedFault(run,oracle,'Undetected mandatory source-copy capacity fault');faults.push({fault:'source-copy',oracle,result:'DETECTED',exitCode:run.status,stdout:run.stdout,stderr:run.stderr});
}
if(!fault)for(const [injected,oracle]of [['source-legacy-loss','SOURCE_LEGACY_EXACT_SPAN_ORACLE'],['source-package-loss','SOURCE_PACKAGE_EXACT_SPAN_ORACLE'],['source-payload-binding','SOURCE_PAYLOAD_BINDING_ORACLE'],['source-cache-binding','SOURCE_PAYLOAD_BINDING_ORACLE'],['source-write-downgrade','SOURCE_WRITE_IMMUTABLE_ORACLE'],['source-new-write-binding','SOURCE_NEW_WRITE_BINDING_ORACLE']]){
 const run=await runVerifier(process.execPath,['test-migration-source-retention.mjs','--fault='+injected],{encoding:'utf8',timeout:60000,killSignal:'SIGKILL',maxBuffer:1024*1024});assert.equal(run.error,null);assertDetectedFault(run,oracle,'Undetected original-source fault: '+injected);faults.push({fault:injected,oracle,result:'DETECTED',exitCode:run.status,stdout:run.stdout,stderr:run.stderr});
}
if(!fault)for(const [injected,oracle] of [['foreign-observation','MIGRATION_EXTENSION_PRESERVATION_ORACLE'],['lost-extension','MIGRATION_EXTENSION_PRESERVATION_ORACLE'],['rewritten-raw-response','MIGRATION_RAW_RESPONSE_BYTES_ORACLE'],['recursive-normalization','MIGRATION_OPAQUE_EXTENSION_ORACLE'],['current-profile-default-rewrite','MIGRATION_CURRENT_NO_SILENT_REWRITE_ORACLE'],['collection-shape-guard','MIGRATION_INVALID_CURRENT_WRITE_ORACLE'],['v2-delegation','MIGRATION_V2_STARTUP_ORACLE'],['worker-migration-receipt','MIGRATION_DOCUMENT_RECEIPT_OWNER_ORACLE'],['claimed-audit-identity','MIGRATION_ORIGINAL_AUDIT_IDENTITY_ORACLE'],['current-startup-shape','MIGRATION_CURRENT_STARTUP_REJECTION_ORACLE'],['structural-defaults','MIGRATION_STRUCTURAL_DEFAULT_ORACLE'],['current-audit-identity','MIGRATION_CURRENT_ORIGINAL_AUDIT_ORACLE'],['parse-failure-receipt','MIGRATION_PARSE_FAILURE_RECEIPT_ORACLE'],['core-current-archive','MIGRATION_CORE_CURRENT_ORIGINAL_AUDIT_ORACLE'],['current-legacy-container-shape','MIGRATION_CURRENT_INVALID_LEGACY_CONTAINER_ORACLE'],['current-archive-undefined','MIGRATION_PRESENT_UNDEFINED_ARCHIVE_ORACLE']]){
  const run=(await runVerifier(process.execPath,[import.meta.filename,'--fault='+injected],{encoding:'utf8',timeout:60000,killSignal:'SIGKILL',maxBuffer:1024*1024}));
  assert.equal(run.error,null,'Migration fault gate timed out or could not execute');
  assertDetectedFault(run,oracle,'Undetected migration fault: '+injected);
  assert.ok(run.stderr.includes(oracle),'Migration fault failed for an unrelated reason: '+run.stderr);
  faults.push({fault:injected,oracle,result:'DETECTED',exitCode:run.status,stdout:run.stdout,stderr:run.stderr});
}
console.log(JSON.stringify({faults,sourceBytePreservation,backupCapacityRoundtrip,canonicalFieldIntegrity,verifyV3Migration:'PASS',from:'closed-loop-project/2',to:'closed-loop-project/3',stages:30,unknownExtensionsPreserved:true,rawV2ResponsePreserved:true,originalPayloadPreserved:true,opaqueExtensionsPreserved:true,historicalEnvelopesPreserved:true,currentV3NoSilentRewrite:true,migrationStorageReadbackImport:true,normalV2StartupMigration:true,unsupportedFutureStartupPreserved:true,documentMigrationReceiptPreserved:true,collectionShapeCases:shapeCases,structuralShapeCases,structuralWriteCases,omittedDefaultsRemainSupported:true,claimedAuditCannotSuppressOriginal:true,currentStartupInvalidStatePreserved:true,protectedExactLegacyRecovery:true,idempotent:true,legacyStage01SemanticFabricationRejected:true,currentV3NoSilentHeal:true}));

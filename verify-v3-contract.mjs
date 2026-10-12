import {runVerifier} from './verify-conformance-regressions.mjs';
import {currentOwnerReport} from './verification-evidence.mjs';
import fs from 'node:fs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import assert from 'node:assert/strict';
import {verifySchemaFieldObligations} from './test-schema-field-obligations.mjs';
import {verifySchemaProductObservation} from './test-schema-product-observation.mjs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const workbook=read('./workbook.js');
const schema=read('./workflow-schema.js');
const runtime=read('./test-runtime.js');
const worker=read('./test-worker.js');
const engine=read('./workflow-engine.js');
const prompt=read('./prompt-engine.js');
const ingestion=read('./response-ingestion.js');
const store=read('./project-store.js');
const app=read('./app-core.js');
const html=read('./index.html');
const workflow=read('./.github/workflows/pages.yml');
const definitionProof=read('./verify-definition-of-done.mjs');
const v3Proof=read('./verify-v3-definition-of-done.mjs');
const reservationProof=read('./verify-reservation-contract.mjs');
const stateReleaseProof=read('./verify-state-release-contract.mjs');


// Exact finite Section38/38.1 literals for REV-49. They are transcribed from
// the controlling specification, not inferred from RECORD_SCHEMAS. The other
// authority, lifecycle, stage-recalculation and semantic requirements remain
// with their behavioral owners; this group claims only declared contracts.
export function verifySchemaRev49LiteralContracts(schema){
 const expected={
  sourceConflicts:{commitPolicy:'APPEND_SCOPED'},research:{idField:'RESEARCH_ID'},requirements:{stage:4,commitPolicy:'REPLACE_CURRENT_STAGE_SET'},
  requirementResolutions:{stage:5,commitPolicy:'REPLACE_CURRENT_STAGE_SET'},tests:{idField:'TEST_ID',stage:6},failureTests:{commitPolicy:'REPLACE_CURRENT_STAGE_SET'},
  iterations:{},defects:{},regressions:{commitPolicy:'APPEND_ONLY'},convergenceRecords:{idField:'CONVERGENCE_ID',commitPolicy:'APPLICATION_DERIVED'},
  baselines:{stage:20},deterministicResults:{stage:22},meaningResults:{stage:23},representationInspections:{idField:'INSPECTION_ID'},processAudits:{idField:'PROCESS_AUDIT_ID'},
  releaseGateReviews:{stage:27},releaseRecords:{idField:'RELEASE_ID'},artifactIdentities:{},evidenceInvestigations:{idField:'INVESTIGATION_ID'},instructionTraces:{stage:8},
  blockers:{stage:'GLOBAL'},humanDecisions:{idField:'HUMAN_DECISION_ID',commitPolicy:'APPEND_SCOPED'},sourceSearchContracts:{},semanticReviews:{idField:'SEMANTIC_REVIEW_ID',commitPolicy:'APPEND_SCOPED'},
  applicabilityRecords:{stage:5,commitPolicy:'APPEND_SCOPED'},proofObligations:{stage:6},entailmentReviews:{commitPolicy:'APPEND_SCOPED'},expectedVarianceContracts:{idField:'VARIANCE_CONTRACT_ID'},
  environmentManifests:{stage:'GLOBAL'},operationReservations:{commitPolicy:'UPDATE_RESERVED'},backupPolicies:{idField:'BACKUP_POLICY_ID',stage:'GLOBAL'},deliveryCandidateSets:{},deliveryRecords:{idField:'DELIVERY_ID'}
 };
 const observations=[],mutants=[];
 function verify(subject){
  for(const [family,properties]of Object.entries(expected)){
   const record=subject.RECORD_SCHEMAS?.[family],durable=subject.DURABLE_OBJECT_REGISTRY?.[family];
   assert(record&&durable,'REV49_FAMILY_EXISTENCE_ORACLE: '+family);
   assert.equal(durable.family,family,'REV49_FAMILY_PARENT_ORACLE: '+family);
   for(const [property,value]of Object.entries(properties)){
    assert.equal(property==='stage'&&record[property]===null?'GLOBAL':record[property],value,'REV49_LITERAL_CONTRACT_ORACLE: record '+family+'.'+property);
    assert.equal(durable[property==='commitPolicy'?'policy':property],value,'REV49_LITERAL_CONTRACT_ORACLE: durable '+family+'.'+property);
   }
   if(properties.idField){
    const field=record.fieldDefinitions?.[properties.idField],entry=subject.FIELD_REGISTRY?.['RECORD.'+family+'.'+properties.idField];
    for(const definition of [field,entry]){assert.equal(definition?.producer,'APPLICATION','REV49_ID_OWNER_ORACLE: '+family);assert.equal(definition?.valueType,'STRING','REV49_ID_TYPE_ORACLE: '+family);}
   }
  }
 }
 verify(schema);
 for(const [family,properties]of Object.entries(expected)){
  observations.push({family,expected:{exists:true,...properties},passed:true});
  const records={...schema.RECORD_SCHEMAS},durable={...schema.DURABLE_OBJECT_REGISTRY};delete records[family];delete durable[family];
  assert.throws(()=>verify({...schema,RECORD_SCHEMAS:records,DURABLE_OBJECT_REGISTRY:durable}),/REV49_FAMILY_EXISTENCE_ORACLE/,'REV49_MUTANT_ORACLE: coherent family omission '+family);
  mutants.push({family,fault:'coherent-family-omission',detected:true});
  for(const [property]of Object.entries(properties)){
   const replacement=property==='stage'?31:'UNREGISTERED_REV49_LITERAL',changed={...schema,RECORD_SCHEMAS:{...schema.RECORD_SCHEMAS,[family]:{...schema.RECORD_SCHEMAS[family],[property]:replacement}},DURABLE_OBJECT_REGISTRY:{...schema.DURABLE_OBJECT_REGISTRY,[family]:{...schema.DURABLE_OBJECT_REGISTRY[family],[property==='commitPolicy'?'policy':property]:replacement}}};
   assert.throws(()=>verify(changed),/REV49_LITERAL_CONTRACT_ORACLE/,'REV49_MUTANT_ORACLE: coherent literal change '+family+'.'+property);
   mutants.push({family,fault:'coherent-declaration-and-durable-'+property,detected:true});
  }
  if(properties.idField)for(const [property,replacement,oracle]of [['producer','AGENT','REV49_ID_OWNER_ORACLE'],['valueType','NUMBER','REV49_ID_TYPE_ORACLE']]){
   const key='RECORD.'+family+'.'+properties.idField,record=schema.RECORD_SCHEMAS[family],field={...record.fieldDefinitions[properties.idField],[property]:replacement},changed={...schema,RECORD_SCHEMAS:{...schema.RECORD_SCHEMAS,[family]:{...record,fieldDefinitions:{...record.fieldDefinitions,[properties.idField]:field}}},FIELD_REGISTRY:{...schema.FIELD_REGISTRY,[key]:{...schema.FIELD_REGISTRY[key],[property]:replacement}}};
   assert.throws(()=>verify(changed),error=>error.message.includes(oracle),'REV49_MUTANT_ORACLE: coherent ID '+family+'.'+property);mutants.push({family,fault:'coherent-ID-'+property,detected:true});
  }
 }
 verify(schema);
 return {checkId:'schema.rev49-source-family-literals',passed:true,synthetic:true,actualBrowser:false,observations,mutants,restored:true,scopeLimit:'Thirty-three independently specified family existence/ID/stage/policy declarations, with coherent wrong projections. Existing null record stage and GLOBAL durable stage denote global family declarations only. Earliest-stage applicability, recalculation, authorization, lifecycle implementation, migration and semantic claims remain separate; no whole-clause or operational receipt promotion.'};
}
function schemaRev49LiteralOwner(){
 const context=createVerifierRuntime({Event:class Event{},dispatchEvent(){}});
 for(const [filename,source]of [['workbook.js',workbook],['hash.js',read('./hash.js')],['workflow-schema.js',schema]])createVerifierRuntime.loadScript(context,source,{filename});
 for(const [filename,source]of [['test-runtime.js',runtime],['workflow-engine.js',engine],['prompt-engine.js',prompt]])createVerifierRuntime.loadScript(context,source,{filename});
 return {rev49:verifySchemaRev49LiteralContracts(context.closedLoopWorkflowSchema),section38:verifySchemaFieldObligations(context.closedLoopWorkflowSchema),productObservations:verifySchemaProductObservation(context.closedLoopWorkflowSchema,context.closedLoopPromptEngine)};
}
const schemaLiteralResults=schemaRev49LiteralOwner();
const schemaRev49SourceFamilyLiterals=schemaLiteralResults.rev49;
const schemaSection38FieldObligations=schemaLiteralResults.section38;
const schemaProductObservationOwnership=schemaLiteralResults.productObservations;

const requiredRuntimeOps=[
  'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML',
  'SELECT_JSON_PATH','SELECT_XML','COUNT','SUM','MIN','MAX','SORT','UNIQUE','HASH_SHA256',
  'REGEX','COMPARE','ASSERT_EQ','ASSERT_GT','ASSERT_GTE','ASSERT_LT','ASSERT_LTE',
  'ASSERT_MATCH','ASSERT_CONTAINS','ASSERT_NOT_CONTAINS','ASSERT_SET_EQUAL','BYTE_COMPARE'
];
const requiredLimits=[
  'maxTotalInputBytes','maxDecompressedBytes','maxSteps','maxSelectorDepth','maxParsedDepth',
  'maxCollectionItems','maxRegexPatternBytes','maxRegexInputBytes','workerTimeoutMs','maxArchiveExpansionBytes'
];

assert.match(workbook,/CONTRACT_PROFILE_ID='closed-loop-completion-profile\/1'/,'blank-project owner must bind the current contract profile');
for(const token of [
  'CURRENT_ITERATION:null','CURRENT_SOURCE_SET_VERSION:null','CURRENT_RESEARCH_VERSION:null',
  'CURRENT_REQUIREMENTS_VERSION:null','CURRENT_TEST_SUITE_VERSION:null','CURRENT_INSTRUCTION_VERSION:null',
  'CURRENT_CANDIDATE_ID:null','CURRENT_BASELINE_ID:null','CURRENT_PRODUCT_ID:null','CURRENT_PRODUCT_VERSION:null',
  'CURRENT_DELIVERY_CANDIDATE_SET_ID:null','CURRENT_REVIEW_VERSION:null','CURRENT_RECONCILED_REVIEW_VERSION:null',
  'CURRENT_RELEASE_ID:null','CURRENT_HASH_REVIEW_ID:null','CURRENT_EVIDENCE_CHAIN_VERSION:null','CURRENT_DELIVERY_ID:null',
  'LATEST_EVIDENCE_REFERENCE:null'
])assert.ok(workbook.includes(token),`blank-project canonical pointer contract missing: ${token}`);
assert.match(workbook,/CURRENT_STATE:'AWAITING_HUMAN_INPUT'/,'new project must start in the closed CURRENT_STATE enum');
assert.match(workbook,/JOB_RECORD_STATUS:'INCOMPLETE'/,'new project must start in the closed JOB_RECORD_STATUS enum');
assert.doesNotMatch(workbook,/CURRENT_(?:ITERATION|SOURCE_SET_VERSION|REQUIREMENTS_VERSION|TEST_SUITE_VERSION|INSTRUCTION_VERSION):''/,'nullable canonical pointers must not use empty-string sentinels');
assert.doesNotMatch(workbook,/CURRENT_(?:BASELINE_ID|PRODUCT_ID):'NONE'/,'nullable canonical pointers must not use NONE sentinels');

assert.match(schema,/closed-loop-project\/3/,'project schema /3 is required');
assert.match(schema,/closed-loop-stage-response\/3/,'response schema /3 is required');
assert.match(schema,/closed-loop-test-spec\/1/,'Test IR schema /1 is required');
assert.match(schema,/closed-loop-verification-package\/1/,'verification-package schema /1 is required');
assert.match(schema,/closed-loop-completion-profile\/1/,'current contract profile identity is required');
for(const name of ['CONTRACT_PROFILE_ID','CURRENT_RESEARCH_VERSION','CURRENT_CANDIDATE_ID','CURRENT_PRODUCT_VERSION','CURRENT_DELIVERY_CANDIDATE_SET_ID','CURRENT_REVIEW_VERSION','CURRENT_RECONCILED_REVIEW_VERSION','CURRENT_RELEASE_ID','CURRENT_HASH_REVIEW_ID','CURRENT_EVIDENCE_CHAIN_VERSION','CURRENT_DELIVERY_ID'])assert.match(schema,new RegExp(`['"]${name}['"]`),`canonical Job field missing: ${name}`);
assert.match(schema,/BLOCKED','AWAITING_HUMAN_INPUT','PROPOSAL_PENDING_REVIEW','RESPONSE_STAGED','AWAITING_EXTERNAL_RESPONSE','READY_FOR_NEXT_OPERATION','WORKFLOW_COMPLETE/,'CURRENT_STATE must use the closed enum');
assert.match(schema,/INCOMPLETE','BLOCKED','COMPLETE/,'JOB_RECORD_STATUS must use the closed enum');
assert.match(reservationProof,/RESERVED','EXPORTED','ORPHANED','RESUMED','RESPONSE_STAGED','ACCEPTED','REJECTED','CANCELLED','SUPERSEDED','EXPIRED_BY_SCOPE/,'permanent reservation regression must pin the closed state machine');
assert.match(engine,/p.revision=reservationRevision/,'reservation creation must commit R+1');
assert.match(engine,/TARGET_SLOT is application-calculated/,'caller-supplied target slots must be rejected');
assert.match(stateReleaseProof,/mandatory refutation must control/,'release precedence regression must distinguish refutation from blockers');
assert.doesNotMatch(engine,/CURRENT_STATE=projectOpenBlockers.length\?'BLOCKED':completed===30\?'COMPLETE'/,'runtime must not emit legacy CURRENT_STATE values');
assert.match(schema,/fields\.EXECUTABLE_KIND='NONE'/,'schema migration/default path must define NONE as the non-executable state');
assert.doesNotMatch(schema,/enumValues\s*:\s*\[[^\]]*CUSTOM_PIPELINE[^\]]*\]/,'CUSTOM_PIPELINE cannot remain an active executable enum member');
assert.match(schema,/fields\.EXECUTABLE_KIND==='CUSTOM_PIPELINE'[^\n]*fields\.EXECUTABLE_KIND='TEST_IR'/,'historical CUSTOM_PIPELINE records must migrate deterministically to TEST_IR');
assert.match(schema,/\bTEST_IR\b/,'TEST_IR executable kind is required');

for(const op of requiredRuntimeOps)assert.match(runtime,new RegExp(`\\b${op}\\b`),`runtime operation missing: ${op}`);
for(const limit of requiredLimits)assert.match(runtime,new RegExp(`\\b${limit}\\b`),`central runtime limit missing: ${limit}`);
assert.doesNotMatch(runtime,/\beval\s*\(/,'runtime must not use eval');
assert.doesNotMatch(runtime,/\bFunction\s*\(/,'runtime must not use Function');
assert.doesNotMatch(runtime,/CUSTOM_PIPELINE/,'runtime must not accept CUSTOM_PIPELINE');
assert.match(runtime,/EXECUTABLE_KIND='TEST_IR'/,'runtime executable kind must be TEST_IR');
assert.match(runtime,/function executeTest\s*\(/,'runtime must expose worker-coordinated executeTest');
assert.match(worker,/Network access is unavailable/,'worker must deny network access');
assert.match(worker,/EXECUTE_TEST_IR/,'worker must accept only the registered execution command');
assert.doesNotMatch(worker,/\beval\s*\(/,'worker must not use eval');
assert.doesNotMatch(worker,/\bFunction\s*\(/,'worker must not use Function');
assert.match(worker,/self\.eval=unavailable\('eval'\)/,'worker must make the eval execution surface unavailable after bootstrap');
assert.match(worker,/self\.Function=unavailable\('Function'\)/,'worker must make the Function constructor unavailable after bootstrap');
for(const mutation of [worker.replace("self.eval=unavailable('eval')","self.eval=globalThis.eval"),worker.replace("self.Function=unavailable('Function')","self.Function=globalThis.Function")]){
  assert.ok(!/self\.eval=unavailable\('eval'\)/.test(mutation)||!/self\.Function=unavailable\('Function'\)/.test(mutation),'dynamic-code denial mutation must remove a required worker guard');
}

for(const helper of ['testExecutionPlan','evaluateContextIndependence','evaluateEvidenceSufficiency','detectCurrentContradictions','operationalNextAction'])assert.match(engine,new RegExp(`\\b${helper}\\b`),`workflow engine helper missing: ${helper}`);
assert.match(store,/\bcreateExecutionPackage\b/,'project store must construct execution packages');
assert.match(store,/closed-loop-verification-package\/1/,'execution package must use the controlling package schema');
assert.match(app,/RUN_APP_TESTS/,'primary UI must support native application tests');
assert.match(app,/canonical state changed/i,'UI must report canonical-change certainty');
assert.match(app,/\bcurrentValue\s*:/,'proposal display must bind every diff row to its current canonical value before rendering');
assert.match(prompt,/FILES YOU MUST RECEIVE/,'prompt handoff must name files to receive');
assert.match(prompt,/FILES YOU MUST NOT RECEIVE/,'prompt handoff must name withheld material');
assert.match(prompt,/FILES OR EVIDENCE YOU MUST RETURN/,'prompt handoff must name required returns');
assert.match(ingestion,/duplicate member/i,'ingestion must scan duplicate JSON members');
assert.match(ingestion,/UNSAFE_SMART_QUOTES/,'authoritative response JSON must reject smart/curly delimiters');
assert.doesNotMatch(ingestion,/normalizeSmartJsonDelimiters|SMART_JSON_DELIMITERS/,'authoritative response JSON must never be repaired before parsing');

const scripts=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1].split('?')[0]);
assert.deepEqual(scripts,[
  'workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js',
  'prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'
],'runtime scripts must use the controlling dependency order');
const scriptTokens=[...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)].map(match=>new URLSearchParams(match[1].split('?')[1]||'').get('v'));
assert(scriptTokens.length===scripts.length&&scriptTokens.every(Boolean),'every runtime script must declare its build identity');
assert.equal(new Set(scriptTokens).size,1,'all runtime scripts must share one build identity');
assert.match(html,/worker-src\s+'self'/,'CSP must permit only the same-origin worker');
assert.doesNotMatch(html,/worker-src[^;]*(?:\*|https?:|blob:|data:)/,'CSP must not open arbitrary worker sources');

const reportField=(name,valuePattern)=>new RegExp(`(?:['\"])?${name}(?:['\"])?\\s*:\\s*${valuePattern}`);
assert.match(workflow,reportField('projectSchema',"['\"]closed-loop-project\\/3['\"]"),'acceptance report must identify project schema /3');
assert.match(workflow,reportField('responseSchema',"['\"]closed-loop-stage-response\\/3['\"]"),'acceptance report must identify response schema /3');
assert.match(workflow,reportField('testIrSchema',"['\"]closed-loop-test-spec\\/1['\"]"),'acceptance report must identify the Test IR schema');
assert.match(workflow,reportField('verificationPackageSchema',"['\"]closed-loop-verification-package\\/1['\"]"),'acceptance report must identify the verification-package schema');
assert.match(workflow,/node verify-definition-of-done\.mjs/,'publish job must execute the deterministic definition-of-done proof');
assert.match(workflow,/node verify-v3-definition-of-done\.mjs/,'publish job must execute the v3 definition-of-done proof');
assert.match(workflow,/\.\.\.definition/,'acceptance report must include the executed definition-of-done result');
assert.match(workflow,/\.\.\.v3/,'acceptance report must include the executed v3 result');
const proofSource=definitionProof+'\n'+v3Proof;
for(const field of [
  'stage01IntakeCoverage','stage04ObligationCoverage','mandatoryEvidenceSufficiencyCoverage','nativeExecutionCoverage',
  'acceptedAgentValueExtractionCoverage','acceptedRelationshipProvenanceCoverage','currentScopeSelectorCoverage',
  'exactReqRunTestCoverage','applicableCurrentRegressionSuccess','releaseArtifactIdentityCoverage',
  'unsupportedTestIrTreatedAsExecutable','externalAssertionsOverridingApplicationProof',
  'nativeExecutionReceiptsFabricatedExternally','releaseAcceptedWithContradiction'
])assert.match(proofSource,new RegExp(`\\b${field}\\b`),`executed acceptance proof must identify ${field}`);
assert.match(definitionProof,/\bmandatoryEvidenceChainCoverage\b/,'executed acceptance proof must identify mandatory evidence-chain structural coverage');
assert.match(workflow,/closed-loop-acceptance\.json/,'post-deploy machine acceptance artifact is required');
assert.match(workflow,/deployedByteIdentity\s*:\s*process\.env\.LIVE_RESULT\s*===\s*['"]success['"]/,'post-deploy byte identity must derive from the successful live-verification job');
assert.match(workflow,/deployedChromiumAcceptance\s*:\s*process\.env\.LIVE_RESULT\s*===\s*['"]success['"]/,'deployed browser acceptance must derive from the successful live-verification job');
assert.match(workflow,/localChromiumAcceptance\s*:\s*process\.env\.TEST_RESULT\s*===\s*['"]success['"]/,'local browser acceptance must derive from the successful test job');
assert.doesNotMatch(workflow,/deployedByteIdentity\s*:\s*true/,'post-deploy byte identity must not be hard-coded');
assert.doesNotMatch(workflow,/(?:deployedChromiumAcceptance|liveBrowserVerification)\s*:\s*true/,'deployed browser acceptance must not be hard-coded');

// These existing behavioral regressions were previously only read as source,
// or had no execution path. Keep them inside the existing contract gate.
const executedContractProofs=[];
for(const [file,marker,expected] of [
 ['verify-stage-operation-registry.mjs','stageOperationRegistry','PASS'],
 ['verify-capability-readiness.mjs','capabilityReadyClosedConjunction',true],
 ['verify-state-release-contract.mjs','releasePrecedence','PASS'],
 ['verify-stage01-disposition-contract.mjs','stage01DispositionContract','PASS'],
 ['verify-terminal-human-authority.mjs','terminalHumanAuthority','PASS']
]){
 let result=null;
 const run=async()=>{
  result=await runVerifier(process.execPath,[file],{encoding:'utf8',timeout:60000});
  assert.equal(result.status,0,'EXECUTED_CONTRACT_PROOF_ORACLE: '+file+'\n'+result.stderr);
  return result.stdout;
 };
 // The foundation phase already executes the complete registry owner before
 // migration. Reuse its validated report; standalone execution retains the
 // same producer and assertions when no current receipt exists.
 const report=file==='verify-stage-operation-registry.mjs'?await currentOwnerReport(file,marker,{run}):JSON.parse(await run());
 assert.equal(report[marker],expected,'EXECUTED_CONTRACT_PROOF_ORACLE: '+file);
 executedContractProofs.push({file,report,evidencePath:result?.evidencePath||null,inputSource:result?'DIRECT_PRODUCER_STDOUT':'VALIDATED_RECEIPT_REPORT'});
}
console.log(JSON.stringify({
  verifyV3Contract:'PASS',
  schemaRev49SourceFamilyLiterals,
  schemaSection38FieldObligations,
  schemaProductObservationOwnership,
  projectSchema:'closed-loop-project/3',
  responseSchema:'closed-loop-stage-response/3',
  testIrSchema:'closed-loop-test-spec/1',
  packageSchema:'closed-loop-verification-package/1',
  stageCount:30,
  runtimeOperations:requiredRuntimeOps.length,
  centralizedLimits:requiredLimits.length,
  executedContractProofs
}));
await import('./verify-stage27-release-binding.mjs');

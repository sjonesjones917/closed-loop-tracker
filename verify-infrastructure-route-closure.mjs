import {checkedVerifier} from './verify-conformance-regressions.mjs';
import {readExecutionReceipts,executionReports,observationsFromReports,validateExecutionReceipt,sha} from './verification-evidence.mjs';
import {completeLifecycleReports} from './verification-evidence-catalog.mjs';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';

const assert=(value,message)=>{if(!value)throw new Error(message);};
const read=file=>fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8');
const engine=read('workflow-engine.js');
const ingestion=read('response-ingestion.js');
const prompt=read('prompt-engine.js');
const store=read('project-store.js');
const app=read('app-core.js');

// These are canonical infrastructure routes even though they are not RECORD_SCHEMAS.
const infrastructureFamilies=[
  'rawResponses','responseValidations','responseProposals','acceptedChanges','outputReceipts',
  'extractionManifests','generatedPrompts','artifactVersions','history','responseDispositions',
  'executionFailures','humanInputRequests','humanInputAnswers','stageConfirmations'
];
for(const family of infrastructureFamilies){
  assert(engine.includes(`'${family}'`)||ingestion.includes(`.${family}`)||store.includes(family)||prompt.includes(family),`${family}: no canonical storage/route declaration found.`);
}

// Raw-first route must be real code, not a documentation assertion.
for(const token of [
  'function captureRaw(',
  'projectData.rawResponses.push',
  'function prepareCaptured(',
  'projectData.responseValidations.push',
  'projectData.responseProposals.push',
  'function createReceipt(',
  'project.projectData.outputReceipts.push',
  'function commit(',
  'extractionManifests'
])assert(ingestion.includes(token),`Raw-first ingestion route missing ${token}.`);

// Proposal acceptance must bind prompt/scope/revision and revalidate before mutation.
for(const token of ['projectRevision','promptEngineVersion','instructionId','bodySha256','contractSha256','contextSignature','scopeSha256','referencedRecordHashes','STALE_PROPOSAL'])assert(ingestion.includes(token),`Proposal precondition route missing ${token}.`);
assert(ingestion.includes('ensureProposalCurrent(next,proposal)')&&ingestion.includes('validateEnvelope(project,proposal.envelope'),`Proposal acceptance does not visibly revalidate the envelope before commit.`);

// Every accepted agent value/relationship must have an extraction-manifest route.
for(const token of ['jsonPointer','rawValueHash','canonicalCollection','canonicalRecordId','canonicalField','relationshipTargetId','evidenceIds','temporaryResponseKey'])assert(ingestion.includes(token),`Extraction provenance route missing ${token}.`);

// Prompt/context manifests and versions must be durable canonical infrastructure.
for(const token of ['generatedPrompts','contextManifest','contextSignature','bodySha256','contractSha256'])assert(prompt.includes(token)||engine.includes(token),`Prompt/context route missing ${token}.`);
for(const token of ['artifactVersions','CURRENT_INPUT_VERSION','CURRENT_SOURCE_SET_VERSION','CURRENT_REQUIREMENTS_VERSION','CURRENT_TEST_SUITE_VERSION','CURRENT_INSTRUCTION_VERSION'])assert(engine.includes(token)||store.includes(token),`Version route missing ${token}.`);

// Stage authority partitions must remain separate in the canonical model. Persistence stores the complete
// project object atomically, so it is incorrect to require these nested property names to be repeated in
// project-store.js. Prove the real model and serialization boundary instead.
for(const token of ['agentData','humanData','derivedData'])assert(engine.includes(`${token}:{}`)&&engine.includes(`prior.${token}`),`Stage authority partition ${token} is not explicitly preserved by the engine model.`);
{
  const runtime=projectStoreRuntime(),project=runtime.core.createBlankState('INFRASTRUCTURE-ROUNDTRIP');
  runtime.engine.ensureShape(project);project.projectData.userEntered.objective='Preserve complete project data.';
  for(const [stage,state] of Object.entries(project.stages))state.responseDraft='Unaccepted draft for selected stage '+stage;
  runtime.engine.recalculate(project);const saved=await runtime.store.writeProject(project,{expectedProjectRevision:0}),expected=JSON.stringify(saved),loaded=await runtime.store.readProject(saved.job.JOB_ID);
  assert(JSON.stringify(loaded)===expected,'Whole-project read-back changed canonical partitions or drafts.');
  loaded.projectData.userEntered.objective='Uncommitted edit';loaded.stages[1].responseDraft='Uncommitted draft';
  assert(JSON.stringify(await runtime.store.readProject(saved.job.JOB_ID))===expected,'Mutating a loaded view changed the stored project.');
}
assert(engine.includes('recordsForCurrentScope'),`Current-scope selector is absent.`);
assert(store.includes('validateProjectIntegrity'),`Persisted state has no canonical integrity validator.`);
assert(store.includes('NEXT_REQUIRED_ACTION')&&store.includes('derivedData'),`Persisted derived state is not checked against deterministic recalculation.`);

// Operator rendering consumes the application-derived action rather than inventing a second route.
assert(app.includes('NEXT_REQUIRED_ACTION')&&app.includes('currentNextAction'),`UI does not consume application-derived NEXT_REQUIRED_ACTION.`);
assert(!/projectData\.[A-Za-z0-9_]+\.push\([^)]*canonical/i.test(app),`UI contains a suspicious direct canonical collection write.`);

// Exact current receipts establish already executed production suites. A
// standalone invocation still executes an owner whose receipt is absent.
const receipts=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS?readExecutionReceipts(process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS):new Map();
if(process.env.CLOSED_LOOP_REQUIRE_CURRENT_OWNER_RECEIPTS==='1')for(const suite of ['verify-ingestion.mjs','verify-project-lifecycle.mjs'])if(!receipts.has(suite))throw new Error('EXECUTED_EVIDENCE_ORACLE: missing required current receipt '+suite);
if(!receipts.has('verify-ingestion.mjs'))await checkedVerifier(process.execPath,[new URL('./verify-ingestion.mjs',import.meta.url).pathname],{stdio:'pipe'});
const lifecycleReceipt=receipts.get('verify-project-lifecycle.mjs');
const lifecycleReports=lifecycleReceipt?.reports||executionReports(await checkedVerifier(process.execPath,[new URL('./verify-project-lifecycle.mjs',import.meta.url).pathname],{stdio:'pipe',encoding:'utf8'}));
assert(completeLifecycleReports(lifecycleReports),'Lifecycle verification omitted or failed a required storage, focus, or final control.');
const lifecycleStorage=lifecycleReports.find(report=>Object.hasOwn(report,'storageRegression'));
const lifecycleFocus=lifecycleReports.find(report=>report.schema==='closed-loop-focus-observations/1');
const lifecycleStartup=lifecycleReports.find(report=>Object.hasOwn(report,'startupStorageBoundaries'));
const lifecycleCleanup=lifecycleReports.find(report=>Object.hasOwn(report,'stagingSafeCleanup'));
const lifecycleMutations=[
  ['missing-storage-case',lifecycleReports.filter(report=>report!==lifecycleStorage)],
  ['failed-storage-case',lifecycleReports.map(report=>report===lifecycleStorage?{...report,passed:false}:report)],
  ['missing-final-marker',lifecycleReports.filter(report=>!Object.hasOwn(report,'projectLifecycleControls'))],
  ['missing-focus-case',lifecycleReports.map(report=>report===lifecycleFocus?{...report,cases:report.cases.slice(1)}:report)],
  ['missing-startup-marker',lifecycleReports.filter(report=>report!==lifecycleStartup)],
  ['missing-startup-case',lifecycleReports.map(report=>report===lifecycleStartup?{...report,cases:report.cases.slice(1)}:report)],
  ['missing-startup-fault',lifecycleReports.map(report=>report===lifecycleStartup?{...report,faults:report.faults.slice(1)}:report)],
  ['missing-cleanup-marker',lifecycleReports.filter(report=>report!==lifecycleCleanup)],
  ['missing-cleanup-case',lifecycleReports.map(report=>report===lifecycleCleanup?{...report,cases:report.cases.slice(1)}:report)],
  ['missing-cleanup-fault',lifecycleReports.map(report=>report===lifecycleCleanup?{...report,faults:report.faults.slice(1)}:report)]
];
for(const [name,reports] of lifecycleMutations){
  assert(!completeLifecycleReports(reports),'LIFECYCLE_REPORT_POPULATION_ORACLE: '+name+' was accepted.');
  if(lifecycleReceipt){
    const mutation={...structuredClone(lifecycleReceipt),reports};
    if(name!=='missing-final-marker')mutation.observations=observationsFromReports('verify-project-lifecycle.mjs',reports);
    delete mutation.receiptSha256;mutation.receiptSha256=sha(mutation);
    let rejected=false;try{validateExecutionReceipt(mutation,'verify-project-lifecycle.mjs',lifecycleReceipt.fingerprint);}catch(error){rejected=String(error.message).includes('EXECUTED_EVIDENCE_ORACLE');}
    assert(rejected,'LIFECYCLE_RECEIPT_MUTATION_ORACLE: '+name+' was accepted.');
  }
}

console.log(JSON.stringify({
  infrastructureRouteClosure:'PASS',
  infrastructureFamilies:infrastructureFamilies.length,
  rawFirstCapture:true,
  validationAndProposalPersistence:true,
  precommitRevalidation:true,
  receiptPersistence:true,
  extractionManifestProvenance:true,
  promptContextManifestRoute:true,
  versionRoute:true,
  authorityPartitionsSeparated:true,
  wholeProjectPartitionPersistence:true,
  currentScopeRoute:true,
  persistenceIntegrityRoute:true,
  structuredOperatorActionRoute:true,
  executableIngestionSuite:true,
  executableLifecycleSuite:true
},null,2));

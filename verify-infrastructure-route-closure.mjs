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

// Execute the real ingestion and lifecycle suites so static contracts cannot masquerade as route proof.
execFileSync(process.execPath,[new URL('./verify-ingestion.mjs',import.meta.url).pathname],{stdio:'pipe'});
const lifecycleOutput=execFileSync(process.execPath,[new URL('./verify-project-lifecycle.mjs',import.meta.url).pathname],{stdio:'pipe',encoding:'utf8'});
const lifecycleReports=lifecycleOutput.split('\n').flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
assert(lifecycleReports.some(report=>report.projectLifecycleControls===true)&&lifecycleReports.filter(report=>report.storageRegression).every(report=>report.passed===true),'Lifecycle verification did not reach its complete executed result.');

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

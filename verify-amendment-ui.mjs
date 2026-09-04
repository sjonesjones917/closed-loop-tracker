import fs from 'node:fs';

const app=fs.readFileSync(new URL('./app-core.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const runtime=fs.readFileSync(new URL('./test-runtime.js',import.meta.url),'utf8');
const store=fs.readFileSync(new URL('./project-store.js',import.meta.url),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message);};
const requireText=(source,text,message)=>assert(source.includes(text),message||`Missing ${text}`);

for(const text of [
  'Product is eligible for final delivery checks',
  'Artifact identity verified — delivery is not yet authorized',
  'Evidence chains complete — delivery is not yet authorized',
  'Final delivery is authorized',
  'application-owned DELIVERY_RECORD',
  'Delivery authorization effective:',
  'Stage 27 eligibility, Stage 28 identity, or Stage 29 evidence closure alone never authorizes delivery.'
])requireText(app,text,`Terminal operator wording is missing: ${text}`);

for(const text of [
  'Application input isolation',
  'Provider context independence',
  'does not prove hidden provider memory',
  'Observed ten-run result, not a universal reliability proof.',
  'rule-of-three bound is suppressed'
])requireText(app,text,`Bounded independence/reliability wording is missing: ${text}`);

for(const text of [
  'Advanced proof, scope, and epistemic details',
  'Proposition-equivalence reviews',
  'Proof obligations',
  'Observation records',
  'Entailment reviews',
  'Environment dependencies',
  'Operation reservations',
  'Delivery records'
])requireText(app,text,`Advanced assurance surface is missing: ${text}`);

for(const text of [
  'Credential-secret transfer blocked.',
  'The secret contents are not displayed.',
  'Disclosure decision required before external transfer.',
  'clean heuristic scan is not proof that no secret exists',
  'External operation reservation is orphaned.',
  'may be wasted. Do not import its response as current.',
  'prior external package or reservation is obsolete'
])requireText(app,text,`Disclosure/reservation operator warning is missing: ${text}`);

requireText(app,'nextActionMarkup=function(_withPrimaryButton=true','Workflow must render the one current primary action.');
requireText(app,"if($('#open-release-control'))",'Stage 28 primary action must open exact artifact-identity controls.');
requireText(app,"requestAnimationFrame(()=>$('#release-artifact-identity')?.focus())",'Stage 28 must move keyboard focus to exact artifact-identity controls.');
requireText(app,"disclosure?'#disclosure-blocker'",'Disclosure failure must select its accessible blocker as the focus target.');
for(const text of [
  'id="disclosure-decision-panel"',
  'id="save-disclosure-decision"',
  "$('#open-disclosure-decision').onclick",
  "$('#save-disclosure-decision').onclick=saveDisclosureDecision",
  'engine.recordHumanDisclosureAuthorization(next,{artifactIds,decision,recipientOrProvider,recipientSuitabilityDecision,purposeAndLimits,effectivePeriodDecision,decisionReason,expectedRevision:Number(current.revision)})',
  "request.secrets.length",
  'CREDENTIAL_SECRET material cannot be included in any external handoff or package and cannot be authorized by a human decision.'
])requireText(app,text,`Controlled disclosure-decision path is incomplete: ${text}`);
requireText(app,"const form=decisionRequired.length&&!decision&&!reservation&&!secrets.length",'Credential-secret material must never render an authorization form.');
requireText(app,"const recordValue=(record,key)=>record?.fields?.[key]??record?.[key]??''",'UI record reads must use canonical fields before compatibility mirrors.');
for(const text of [
  "BUILD_IDENTITY_SCHEMA='closed-loop-build-identity/1'",
  "new URL('build-identity.json',location.href)",
  "fetch(url.href,{cache:'no-store',redirect:'follow'})",
  "finalUrl.origin!==location.origin",
  "identity.buildIdentity!==RUNTIME_BUILD_ID",
  "identity.testWorkerSha256!==workerSha256",
  "status:'CURRENT'",
  'Application build verification failed',
  'Workflow, package, response-ingestion, and native-test actions remain disabled.'
])requireText(app,text,`Runtime build-identity fail-closed path is incomplete: ${text}`);
for(const text of [
  'runtime.deploymentWorkerSha256?.()',
  'runtime.DEPLOYMENT_TEST_WORKER_SHA256',
  "!/^[a-f0-9]{64}$/.test(workerSha256)",
  'Native verification cannot start.',
  'testWorkerSha256:workerSha256'
])requireText(app,text,`Injected worker-byte binding is incomplete: ${text}`);
assert(!app.includes('loadDeploymentManifest')&&!app.includes('closedLoopDeploymentManifest'),'The application must not fetch or trust a self-referential deployment manifest at runtime.');
requireText(runtime,"const DEPLOYMENT_TEST_WORKER_SHA256='__CLOSED_LOOP_TEST_WORKER_SHA256__';",'Test runtime lacks the deterministic worker-digest build placeholder.');
requireText(runtime,'deploymentWorkerSha256','Test runtime does not expose its injected worker identity.');
for(const text of [
  'Delete the complete local project — not individual history.',
  'Whole-project deletion is different from append-only defect history.',
  'The application cannot undo a physical delivery that already occurred.',
  'Close final delivery blockers'
])requireText(app,text,`Terminal/deletion operator limit is missing: ${text}`);

for(const text of [
  'Blind aliasing without filename, path, document-metadata, author, revision, history, and timestamp redaction is not full blinding.',
  'Content-based identity inference remains a residual risk.',
  'A prompt hash proves only the exact application-generated prompt body; it does not prove that the user or provider added no other context.'
])requireText(html,text,`External-context epistemic limit is missing from the visible help: ${text}`);

for(const text of [
  'REGISTER_AUTHOR_CONTEXT',
  'Stage 06 authoring context registered.',
  'Open a fresh independent reviewer context',
  'pendingSemanticReviewTarget(stage)',
  'createExecutionPackage({project:current'
])requireText(app,text,`Stage 06 author/reviewer one-action path is incomplete: ${text}`);
for(const text of [
  'async function createExecutionPackage',
  'semanticReviewTarget:exactSemanticReviewTarget',
  'EXECUTION_PACKAGE_SEMANTIC_TARGET_STALE',
  'EXECUTION_PACKAGE_REVIEWER_CONTEXT_REQUIRED',
  'EXECUTION_PACKAGE_SEMANTIC_TEST_BATCH_PROHIBITED',
  'records:semanticRecord?[semanticRecord]',
  'reservationPayloadHash:preparedPayloadHash',
  'operationReservationTarget(project'
])requireText(store,text,`Stage 06 semantic-review package binding is incomplete: ${text}`);

for(const text of [
  'exactPromptReservation',
  'prepareCurrentOperationReservation',
  'ACTIVE_OPERATION_RESERVATION_CONFLICT',
  "action?.reservationRequired!==true",
  "action?.reservationRequired===true||action?.contextRequired===true",
  "String(recordValue(record,'STATUS')||'').toUpperCase()==='CANCELLED'"
])requireText(app+store,text,`Universal external-operation reservation path is incomplete: ${text}`);
for(const text of [
  "if(action?.operation&&allowed.includes(String(action.operation)))return String(action.operation)",
  "if([1,2,4,6].includes(stage))",
  'The operator does not choose whether to skip, challenge, or reconcile',
  'action.requirementCompilationChallengeBatch?.batchHash',
  "reviewerContextId:contextId",
  "operation.replaceAll('_',' ').toLowerCase()"
])requireText(app,text,`Application-selected Stage 01/02/04 challenge or reconciliation flow is incomplete: ${text}`);
for(const text of [
  'CREATE_BACKUP_AND_RESTORE_TEST',
  'id="create-required-backup"',
  'projectStore.createVerifiedBackup',
  'engine.recordBackupRestoreVerification',
  'engine.backupCheckpointState',
  'required complete backup restore-tested, recorded, and downloaded'
])requireText(app,text,`Required backup one-action path is incomplete: ${text}`);
const backupFlow=app.slice(app.indexOf('async function downloadProjectPackage'),app.indexOf('async function verifyStoredFilesNow'));
assert(backupFlow.indexOf('engine.recordBackupRestoreVerification')>=0&&backupFlow.indexOf('engine.recordBackupRestoreVerification')<backupFlow.indexOf('a.click()'),'Required backup must commit canonical backupRecords evidence before any package download begins.');
for(const text of [
  'async function verifyRestorePackage',
  'validateOnly:true',
  'activationPerformed:false',
  'existingProjectChanged:false',
  'async function createVerifiedBackup',
  'BACKUP_ACKNOWLEDGMENT_OBJECT_REQUIRED'
])requireText(store,text,`Complete backup/restore-test store path is incomplete: ${text}`);
for(const text of [
  'projectStore.verifyProjectArtifacts(jobId)',
  'engine.reconcileArtifactCustodyVerification',
  'await refreshProjectStorage()',
  "for(const collection of ['artifactIdentities','evidenceChains','releaseRecords'])",
  'withdrawDeliveryAuthorization',
  'WITHDRAWN_FOR_FUTURE_USE'
])requireText(app+fs.readFileSync(new URL('./workflow-engine.js',import.meta.url),'utf8'),text,`Startup artifact-loss invalidation is incomplete: ${text}`);

assert(/id="app-live-status"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/.test(html),'Accessible atomic live status region is missing.');
requireText(html,'.expandable-prompt{max-height:280px}','Approved compact prompt preview height changed.');
requireText(html,'.prompt{height:clamp(260px,45vh,520px)','Approved prompt box size changed.');
for(const width of ['@media(max-width:620px)','@media(max-width:420px)'])requireText(html,width,`Existing mobile breakpoint missing: ${width}`);

const appBuild=app.match(/const RUNTIME_BUILD_ID='([^']+)'/)?.[1];
const runtimeBuild=runtime.match(/const RUNTIME_BUILD_ID='([^']+)'/)?.[1];
const indexBuilds=[...html.matchAll(/<script defer src="[^"]+\?v=([^"]+)"/g)].map(match=>match[1]);
assert(appBuild&&runtimeBuild&&appBuild===runtimeBuild,'App and native runtime build identities differ.');
assert(indexBuilds.length===9&&indexBuilds.every(value=>value===appBuild),'Runtime resource graph does not share one build identity.');

console.log(JSON.stringify({
  terminalOperatorWording:true,
  oneActionSurface:true,
  advancedAssuranceDisclosure:true,
  reservationAndDisclosureWarnings:true,
  independenceDimensionsSeparated:true,
  boundedTenRunLanguage:true,
  accessibilityLiveRegion:true,
  approvedPromptDimensionsPreserved:true,
  sharedRuntimeBuildIdentity:appBuild
}));

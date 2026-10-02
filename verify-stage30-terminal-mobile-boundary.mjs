import {checkedVerifier} from './verify-conformance-regressions.mjs';
import {bindArtifactFixture} from './test-project-store-runtime.mjs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {syntheticMobileOperations} from './mobile-evidence-test-fixture.mjs';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createMobileAcceptanceTarget,MOBILE_ACCEPTANCE_ORIGIN,MOBILE_ACCEPTANCE_BASE_PATH} from './generate-mobile-acceptance-target.mjs';
import {verifyMobileAcceptanceEvidence,REQUIRED_MOBILE_RECEIPT_KINDS,REQUIRED_MOBILE_CAPABILITY_PROBE_KEYS} from './verify-mobile-acceptance-evidence.mjs';
import {evaluateMobileAcceptanceSubmission} from './evaluate-mobile-acceptance-submission.mjs';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js']){
  createVerifierRuntime.loadScript(globalThis,fs.readFileSync(file,'utf8'),{filename:file});
}
const core=globalThis.closedLoopCore;
const engine=globalThis.closedLoopWorkflowEngine;
const schema=globalThis.closedLoopWorkflowSchema;
const engineSource=fs.readFileSync('workflow-engine.js','utf8');
const appSource=fs.readFileSync('app-core.js','utf8');
const fullCycleSource=fs.readFileSync('verify-full-cycle.mjs','utf8');
assert.doesNotMatch(appSource,/projectData\.mobileAcceptance(?:Target|Probe|Receipts|Measurements)/,'Acceptance-session state must not be persisted as unregistered projectData.');
assert.match(appSource,/stage30MobileAcceptance\.v1:/,'Acceptance-session state must use the versioned metadata key.');
assert.doesNotMatch(appSource,/mobile-acceptance-receipt-kind|mobile-runtime-exceptions|mobile-horizontal-overflow/,'Application-observable acceptance values must not be manually declared by the operator.');
assert.match(appSource,/function measureMobileAcceptance\(\)/,'Acceptance measurements must be calculated from browser-observable state.');
assert.match(appSource,/mobileAcceptanceEvidenceId/,'The application must generate and bind an acceptance evidence ID.');
assert.doesNotMatch(appSource,/viewport:actorEvidence\.viewport/,'Actor evidence must not override the pinned viewport.');
const target=createMobileAcceptanceTarget({
  sourceCommit:'f'.repeat(40),deploymentManifestDigest:'a'.repeat(64),
  origin:MOBILE_ACCEPTANCE_ORIGIN,basePath:MOBILE_ACCEPTANCE_BASE_PATH,
  testProjectId:'STAGE30-MOBILE',procedureVersion:'actual-iphone-safari/1',
  viewport:{width:393,height:852,devicePixelRatio:3},deviceModel:'iPhone 15',
  iosVersion:'19.0',safariVersion:'19.0',safariUserAgent:'Mozilla/5.0 (iPhone) Safari/604.1',
  issuedAt:'2026-09-03T00:00:00.000Z',challengeLifetimeSeconds:3600
});
assert.match(target.challenge,/^[0-9a-f]{64}$/,'Stage 30 target must use a CSPRNG challenge.');
assert.equal(target.origin,MOBILE_ACCEPTANCE_ORIGIN);
assert.equal(target.basePath,MOBILE_ACCEPTANCE_BASE_PATH);

// Obtain a complete Stage 30-ready project through the production lifecycle, then
// perform every mutation probe against disposable in-memory clones.
const fixturePath=path.join(process.cwd(),`.stage30-fixture-${process.pid}.json`);
const fixtureMarker='STAGE30_READY_FIXTURE';
const fixtureAnchor='engine.recordDeliveryAttempt(p';
const fixtureIndex=fullCycleSource.indexOf(fixtureAnchor);
assert.ok(fixtureIndex>0,'The full-cycle production mechanism did not expose its terminal-ready boundary.');
const instrumentedPath=path.join(process.cwd(),`.stage30-full-cycle-${process.pid}.mjs`);
fs.writeFileSync(instrumentedPath,fullCycleSource.slice(0,fixtureIndex)+`fs.writeFileSync(${JSON.stringify(fixturePath)},JSON.stringify({project:p,artifacts:await captureArtifactFixture(byteStore,p.job.JOB_ID)}));console.log(${JSON.stringify(fixtureMarker)});process.exit(0);\n`+fullCycleSource.slice(fixtureIndex));
let fixtureOutput='';
try{fixtureOutput=(await checkedVerifier(process.execPath,[instrumentedPath],{encoding:'utf8',timeout:600000,maxBuffer:64*1024*1024}));}
finally{fs.rmSync(instrumentedPath,{force:true});}
assert.match(fixtureOutput,new RegExp(fixtureMarker));
assert.ok(fs.existsSync(fixturePath),'The disposable Stage 30 fixture was not captured.');
const captured=JSON.parse(fs.readFileSync(fixturePath,'utf8')),sourceProject=captured.project;
assert.equal(engine.terminalPrerequisites(sourceProject).complete,false,'JSON metadata alone must not preserve byte custody.');
await bindArtifactFixture(captured.artifacts);
assert.equal(engine.terminalPrerequisites(sourceProject).complete,true,'Exact restored bytes must restore terminal readiness.');
const fresh=()=>{const p=structuredClone(sourceProject);engine.ensureShape(p);return p;};
const refresh=(p,family,record)=>engine.refreshRecordHashes(record,family);
const terminalRecord=p=>engine.records(p,'deliveryRecords').at(-1);
const terminalHash=p=>engine.recordValue(terminalRecord(p,'deliveryRecords'),'DELIVERY_RECORD_HASH');
const hashInput=p=>Object.fromEntries(Object.entries(terminalRecord(p,'deliveryRecords').fields).filter(([key])=>key!=='DELIVERY_RECORD_HASH'));
assert.equal(engine.recordValue(terminalRecord(sourceProject),'DELIVERY_STATE'),'AUTHORIZED','The fixture must reach application-owned authorization.');
assert.equal(engine.records(sourceProject,'deliveryAttempts').length,0,'The terminal-ready fixture must not pre-record an operational attempt.');

// Independent §36.9 terminal oracle. Reconstruct the exact declared record
// subject without calling either production terminal/evidence-chain preimage helper.
const terminalHashApi=globalThis.closedLoopHash,nodeSha=value=>createHash('sha256').update(terminalHashApi.stableStringify(value),'utf8').digest('hex');
const exactDependency=record=>{if(!record)return null;const copy=structuredClone(record);for(const key of ['recordSha256','sha256','contentSha256','createdAt','updatedAt','eventSequence'])delete copy[key];if(copy.scope)delete copy.scope.projectRevision;return copy;};
const chainRows=engine.recordsForCurrentScope(sourceProject,'evidenceChains').map(exactDependency);for(const row of chainRows){delete row.EVIDENCE_CHAIN_VERSION;delete row.fields.EVIDENCE_CHAIN_VERSION;delete row.scope.evidenceChainVersion;}chainRows.sort((a,b)=>Buffer.compare(Buffer.from(terminalHashApi.stableStringify(a.id)),Buffer.from(terminalHashApi.stableStringify(b.id))));
const chainScope={...engine.currentScope(sourceProject)};delete chainScope.evidenceChainVersion;delete chainScope.projectRevision;
const expectedChainSubject={jobId:sourceProject.job.JOB_ID,scope:chainScope,requirementIds:engine.mandatoryRequirements(sourceProject).map(row=>engine.recordId(row,'requirements')),chainRecords:chainRows},expectedChainSha=nodeSha(expectedChainSubject);
const releaseRecord=engine.recordsForCurrentScope(sourceProject,'releaseRecords').at(-1),identityRecords=engine.recordsForCurrentScope(sourceProject,'artifactIdentities'),intentRecord=engine.records(sourceProject,'humanDecisions').find(row=>engine.recordValue(row,'PURPOSE')==='DELIVERY_INTENT'),intentValue=engine.recordValue(intentRecord,'VALUE'),defects=engine.recordsForCurrentScope(sourceProject,'defects'),regressions=engine.recordsForCurrentScope(sourceProject,'regressions'),missingDefectIds=defects.filter(row=>!regressions.some(reg=>String(engine.recordValue(reg,'DEFECT_ID')||reg.relationships?.DEFECT_ID||'')===engine.recordId(row,'defects'))).map(row=>engine.recordId(row,'defects')),artifactIds=engine.recordValue(terminalRecord(sourceProject),'AUTHORIZED_ARTIFACT_IDS'),artifactRecords=engine.recordsForCurrentScope(sourceProject,'artifacts').filter(row=>artifactIds.includes(engine.recordId(row,'artifacts'))),checkpointRecord=engine.records(sourceProject,'backupCheckpoints').filter(row=>engine.recordValue(row,'CUSTODY_STATE')==='BACKUP_EXPORT_ACTION_COMPLETED').at(-1),terminalScope={...engine.currentScope(sourceProject)};delete terminalScope.projectRevision;
const expectedTerminalSubject={stage27ReleaseRecord:exactDependency(releaseRecord),stage28IdentityRecords:identityRecords.map(exactDependency),humanDeliveryIntent:exactDependency(intentRecord),stage29EvidenceChainSet:expectedChainSubject,evidenceChainSetSha256:expectedChainSha,stage30RegistryCalculation:{complete:missingDefectIds.length===0,missingDefectIds,hash:nodeSha({defects:defects.map(row=>row.recordSha256||row.sha256||''),regressions:regressions.map(row=>row.recordSha256||row.sha256||'')}),defectRecords:defects.map(exactDependency),regressionRecords:regressions.map(exactDependency)},preDeliveryCheckpoint:exactDependency(checkpointRecord),deliveryScope:{jobId:sourceProject.job.JOB_ID,currentScope:terminalScope,recipientOrClass:String(intentValue.recipientOrClass||''),destination:String(intentValue.destination||''),transferPurpose:String(intentValue.transferPurpose||''),transferChannel:String(intentValue.transferChannel||''),disclosureClassification:String(intentValue.disclosureClassification||''),permittedTransferCount:intentValue.permittedTransferCount??null},authorizedArtifactIdentities:artifactRecords.map(exactDependency)},expectedTerminalSha=nodeSha(expectedTerminalSubject),actualTerminalSha=engine.recordValue(terminalRecord(sourceProject),'TERMINAL_EVIDENCE_HASH'),actualChainSha=engine.recordValue(terminalRecord(sourceProject),'EVIDENCE_CHAIN_SET_SHA256');
const actualSubjectForDiagnostic=engine.terminalEvidencePreimage(sourceProject);if(actualTerminalSha!==expectedTerminalSha){const differing=Object.keys(expectedTerminalSubject).filter(key=>terminalHashApi.stableStringify(expectedTerminalSubject[key])!==terminalHashApi.stableStringify(actualSubjectForDiagnostic[key]));console.error(JSON.stringify({terminalOracleDifferingMembers:differing,fixturePath}));}
assert.equal(actualChainSha,expectedChainSha,'TERMINAL_STAGE29_SHA_ORACLE: terminal must preserve the exact full Stage29 chain digest.');assert.equal(actualTerminalSha,expectedTerminalSha,'EXACT_TERMINAL_PREIMAGE_ORACLE: exact prerequisite records, scope, registry and artifact identities must define the terminal evidence SHA.');
const exactChanged=fresh(),changedRelease=engine.recordsForCurrentScope(exactChanged,'releaseRecords').at(-1);changedRelease.derivationKey=String(changedRelease.derivationKey||'stage27.release')+'-CONTROLLED_DIFFERENT_DERIVATION';refresh(exactChanged,'releaseRecords',changedRelease);assert.notEqual(engine.terminalEvidenceHash(exactChanged),expectedTerminalSha,'EXACT_TERMINAL_PREIMAGE_ORACLE: the canonical release derivation identity must remain bound.');assert.throws(()=>engine.deliveryTransferPrecondition(exactChanged,{deliveryId:engine.recordId(terminalRecord(exactChanged),'deliveryRecords')}),/terminal dependency is no longer satisfied/,'EXACT_TERMINAL_CURRENTNESS_ORACLE: changed exact dependency must revoke the existing authorization.');
const oldSummaryProject=fresh(),oldSummaryRecord=terminalRecord(oldSummaryProject),propositionSummarySha=nodeSha(engine.records(oldSummaryProject,'propositions').map(row=>({id:row.id,status:engine.recordValue(row,'STATUS'),sha256:row.recordSha256||row.sha256||''})).sort((a,b)=>terminalHashApi.compareUnicodeScalarSequence(a.id,b.id)));oldSummaryRecord.fields.EVIDENCE_CHAIN_SET_SHA256=propositionSummarySha;oldSummaryRecord.EVIDENCE_CHAIN_SET_SHA256=propositionSummarySha;assert.notEqual(propositionSummarySha,expectedChainSha,'The controlled old proposition digest must differ from the independently derived chain digest.');assert.throws(()=>engine.deliveryTransferPrecondition(oldSummaryProject,{deliveryId:engine.recordId(oldSummaryRecord,'deliveryRecords')}),/terminal dependency is no longer satisfied/,'TERMINAL_STAGE29_SHA_ORACLE: corrupted Stage29 digest must revoke authorization even when the terminal fingerprint is unchanged.');
const verificationObservations=[{checkId:'terminal-exact-record-preimage-sha256',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:3280'],boundary:'actual full lifecycle → terminal calculation → stored-byte restoration → transfer precondition',expected:{evidenceChainSetSha256:expectedChainSha,terminalEvidenceHash:expectedTerminalSha,digestLength:64},observed:{evidenceChainSetSha256:actualChainSha,terminalEvidenceHash:actualTerminalSha,digestLength:actualTerminalSha.length},passed:true},{checkId:'terminal-summary-or-mutated-dependency-rejected',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:3269','specification/closed-loop-reliability-controlling-implementation-specification.txt:3280'],boundary:'actual authorized transfer precondition',expected:{oldSummaryAccepted:false,changedCanonicalDependencyAccepted:false},observed:{oldSummaryAccepted:false,changedCanonicalDependencyAccepted:false},violation:'summary substitution or exact dependency mutation retains authority',accepted:false,passed:true}];

// The mobile validators are independent oracles: malformed target/evidence classes
// must remain blocked by both the evidence validator and authenticated submission.
const mobileEvidence={
  mobileAcceptanceTargetId:target.mobileAcceptanceTargetId,challenge:target.challenge,
  sourceCommit:target.sourceCommit,deploymentManifestDigest:target.deploymentManifestDigest,
  origin:target.origin,basePath:target.basePath,testProjectId:target.testProjectId,
  procedureVersion:target.procedureVersion,deviceModel:target.deviceModel,iosVersion:target.iosVersion,
  safariVersion:target.safariVersion,safariUserAgent:target.safariUserAgent,viewport:target.viewport,
  mobileAcceptanceEvidenceId:'EVIDENCE-STAGE30-MOBILE',physicalDeviceAssertion:true,
  evidenceBasis:'HUMAN_OBSERVATION',performer:'STAGE30-IPHONE-OPERATOR',identityAssurance:'SELF_ASSERTED',
  mobileCapabilityProbe:{probeId:'PROBE-STAGE30',result:'PASS',capabilities:Object.fromEntries(REQUIRED_MOBILE_CAPABILITY_PROBE_KEYS.map(key=>[key,true]))},
  operationReceipts:REQUIRED_MOBILE_RECEIPT_KINDS.map((kind,index)=>({kind,receiptId:`RECEIPT-${index+1}`,result:'PASS'})),
  runtimeFindings:{runtimeExceptions:0,unhandledRejections:0},
  measurements:{horizontalOverflowPx:0,minimumPrimaryTextPx:16,minimumSecondaryTextPx:14,minimumTouchTargetPx:44},
  exportedProjectDigest:'b'.repeat(64),screenshotOrRecordingReferences:['SCREENSHOT-STAGE30']
};
Object.assign(mobileEvidence,syntheticMobileOperations(target));
const mobileExpected={sourceCommit:target.sourceCommit,deploymentManifestDigest:target.deploymentManifestDigest,origin:target.origin,basePath:target.basePath,verificationTime:'2026-09-03T01:00:00.000Z'};
assert.equal(verifyMobileAcceptanceEvidence({target,evidence:mobileEvidence,expected:mobileExpected}).accepted,true,'The valid mobile evidence oracle fixture must be accepted.');
assert.equal(evaluateMobileAcceptanceSubmission({targetJson:JSON.stringify(target),evidenceJson:JSON.stringify(mobileEvidence),expected:mobileExpected}).actualIPhoneSafariAcceptance,true,'The submission oracle must accept valid mobile evidence.');
const mobileRejected=[];
for(const [name,mutate] of [
  ['mobile-target-commit-mismatch',x=>{x.sourceCommit='0'.repeat(40);}],
  ['mobile-evidence-challenge-mismatch',x=>{x.challenge='e'.repeat(64);}],
  ['mobile-capability-missing',x=>{x.mobileCapabilityProbe.capabilities.FILE_EXPORT_OR_SHARE=false;}],
  ['mobile-required-receipt-missing',x=>{x.operationReceipts=x.operationReceipts.slice(1);}],
  ['mobile-exact-viewport-mismatch',x=>{x.viewport={...x.viewport,width:394};}]
]){
  const bad=structuredClone(mobileEvidence);mutate(bad);
  assert.equal(verifyMobileAcceptanceEvidence({target,evidence:bad,expected:mobileExpected}).accepted,false,`${name} was accepted by the mobile evidence oracle.`);
  assert.equal(evaluateMobileAcceptanceSubmission({targetJson:JSON.stringify(target),evidenceJson:JSON.stringify(bad),expected:mobileExpected}).actualIPhoneSafariAcceptance,false,`${name} was accepted by the submission oracle.`);
  mobileRejected.push(name);
}

assert.equal(schema.operationContract(30,'CALCULATE_TERMINAL')?.executorClass,'APPLICATION','Stage 30 terminal calculation must remain application-owned.');
assert.equal(schema.operationContract(30,'CALCULATE_TERMINAL')?.acceptsExternalResponse,false,'CALCULATE_TERMINAL must not accept an external response envelope.');
assert.equal(schema.operationContract(30,'EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS')?.executorClass,'OPERATOR_ACTION','Stage 30 export/share must remain an operator action.');
assert.equal(schema.operationContract(30,'RECORD_DELIVERY_EVIDENCE')?.executorClass,'OPERATOR_ACTION','Stage 30 delivery evidence must remain an operator action.');

const project=core.createBlankState('STAGE30-NEGATIVE');
engine.ensureShape(project);
project.activeStage=30;
const action=engine.operationalNextAction(project,30);
assert.notEqual(action.actionType,'SELECT_RESPONSE_JSON_FILE','Stage 30 must never fall through to the external response.json path.');
assert.equal(action.actionType,'BLOCKED','An incomplete Stage 30 must expose its terminal blockers rather than fabricate authorization.');
assert.equal(typeof engine.calculateTerminal,'function','Stage 30 must expose the application-owned terminal command.');
assert.equal(typeof engine.recordDeliveryAttempt,'function','Stage 30 must expose an application-owned delivery-attempt recorder.');
assert.equal(typeof engine.recordDeliveryEvidence,'function','Stage 30 must expose delivery-evidence normalization separately from authorization.');

const first=engine.calculateTerminal(project,{expectedRevision:Number(project.revision||0)});
assert.equal(engine.recordValue(first,'DELIVERY_STATE'),'BLOCKED','CALCULATE_TERMINAL must create a BLOCKED determination when prerequisites are false.');
assert.equal(engine.records(project,'deliveryRecords').length,1,'A blocked terminal command must create exactly one terminal determination.');
const retry=engine.calculateTerminal(project,{expectedRevision:Number(project.revision||0)});
assert.equal(engine.recordId(retry,'deliveryRecords'),engine.recordId(first,'deliveryRecords'),'Exact CALCULATE_TERMINAL retry must be idempotent.');
assert.equal(engine.records(project,'deliveryRecords').length,1,'Exact terminal retry must not duplicate the terminal record.');
assert.throws(()=>engine.recordDeliveryAttempt(project,{deliveryId:engine.recordId(first,'deliveryRecords')}),/AUTHORIZED Stage 30 delivery record/,'A BLOCKED terminal record must never authorize export/share.');
assert.throws(()=>engine.recordDeliveryEvidence(project,{attemptId:'DELIVERY-ATTEMPT-NONE',evidenceIds:['EVIDENCE-NONE']}),/delivery-attempt record/,'Delivery completion evidence requires a real prior delivery attempt.');

const mutationRejected=[];
for(const [name,mutate] of [
  ['checkpoint-custody-mutation',p=>{const r=engine.currentPreDeliveryCheckpoint(p);r.fields.CUSTODY_STATE='BACKUP_PACKAGE_GENERATED';r.CUSTODY_STATE='BACKUP_PACKAGE_GENERATED';refresh(p,'backupCheckpoints',r);}],
  ['release-determination-mutation',p=>{const r=engine.recordsForCurrentScope(p,'releaseRecords').at(-1);r.fields.DETERMINATION='REJECTED';r.DETERMINATION='REJECTED';refresh(p,'releaseRecords',r);}],
  ['stage28-identity-mutation',p=>{const r=engine.recordsForCurrentScope(p,'artifactIdentities')[0];r.fields.EXACT_HASH_MATCH=false;r.EXACT_HASH_MATCH=false;refresh(p,'artifactIdentities',r);}],
  ['stage29-chain-mutation',p=>{const r=engine.recordsForCurrentScope(p,'evidenceChains')[0];r.fields.STATUS='INCOMPLETE';r.STATUS='INCOMPLETE';refresh(p,'evidenceChains',r);}],
  ['registry-mutation',p=>{const base=engine.records(p,'defects')[0],r=engine.clone(base),id='DEFECT-STAGE30-MUTATION';r.id=id;r.recordId=id;r.scope=engine.currentScope(p);r.fields={...(r.fields||{}),DEFECT_ID:id};r.DEFECT_ID=id;refresh(p,'defects',r);p.projectData.defects.push(r);}]
]){
  const p=fresh();mutate(p);
  assert.equal(engine.terminalPrerequisites(p).complete,false,`${name} did not invalidate terminal prerequisites.`);
  const blocked=engine.calculateTerminal(p,{expectedRevision:Number(p.revision||0)});
  assert.equal(engine.recordValue(blocked,'DELIVERY_STATE'),'BLOCKED',`${name} did not create a BLOCKED terminal determination.`);
  assert.throws(()=>engine.recordDeliveryAttempt(p,{deliveryId:engine.recordId(blocked,'deliveryRecords')}),/AUTHORIZED Stage 30 delivery record/,`${name} allowed export from a blocked terminal determination.`);
  mutationRejected.push(name);
}

// Dependency mutation invalidates authorization; an operational attempt mutation
// does not rewrite the terminal authorization or collapse attempt into delivery.
{
  const p=fresh(),authorized=terminalRecord(p);
  assert.equal(engine.recordValue(authorized,'DELIVERY_STATE'),'AUTHORIZED');
  assert.equal(engine.records(p,'deliveryAttempts').length,0,'Authorization must remain distinct from an operational delivery attempt.');
  assert.equal(engine.recordValue(engine.calculateTerminal(p),'DELIVERY_STATE'),'AUTHORIZED','An operational retry must not withdraw a still-valid terminal authorization.');
  assert.throws(()=>engine.recordDeliveryEvidence(p,{attemptId:'DELIVERY-ATTEMPT-NONE',evidenceIds:['EVIDENCE-NONE']}),/delivery-attempt record/,'Delivery evidence must not represent an attempt that was never recorded.');
}

// A current human intent is part of the terminal precondition; changing its
// destination or artifact set must block rather than silently authorize.
for(const [name,mutate] of [
  ['intent-release-mismatch',value=>{value.releaseId='WRONG-RELEASE';}],
  ['intent-artifact-set-mismatch',value=>{value.artifactIds=['WRONG-ARTIFACT'];}]
]){
  const p=fresh(),intent=engine.records(p,'humanDecisions').find(r=>engine.recordValue(r,'PURPOSE')==='DELIVERY_INTENT'&&engine.recordValue(r,'VALUE')?.authorized===true);
  assert.ok(intent,`${name} fixture lacks the current delivery intent.`);
  const value={...engine.recordValue(intent,'VALUE')};mutate(value);intent.fields.VALUE=value;intent.VALUE=value;refresh(p,'humanDecisions',intent);
  assert.equal(engine.terminalPrerequisites(p).complete,false,`${name} did not block terminal authorization.`);
  assert.equal(engine.recordValue(engine.calculateTerminal(p),'DELIVERY_STATE'),'BLOCKED',`${name} did not record BLOCKED.`);
  mutationRejected.push(name);
}

// Revalidate the exact stored bytes immediately before export; metadata-only
// changes and byte-hash changes cannot be exported under an old authorization.
{
  const p=fresh(),authorizedId=engine.recordValue(terminalRecord(p),'AUTHORIZED_ARTIFACT_IDS')[0],artifact=engine.recordsForCurrentScope(p,'artifacts').find(r=>engine.recordId(r,'artifacts')===authorizedId);
  artifact.fields.AVAILABILITY='BYTES_MISSING';artifact.AVAILABILITY='BYTES_MISSING';refresh(p,'artifacts',artifact);
  assert.throws(()=>engine.recordDeliveryAttempt(p,{deliveryId:engine.recordId(terminalRecord(p),'deliveryRecords')}),/reverified immediately before export|Authorized artifact bytes|terminal dependency is no longer satisfied/,'Changed stored-byte identity was not revalidated before export.');
}

{
  const p=fresh(),deliveryId=engine.recordId(terminalRecord(p),'deliveryRecords');
  for(const [field,value] of [['recipient','WRONG-RECIPIENT'],['destination','WRONG-DESTINATION'],['purpose','WRONG-PURPOSE'],['channel','WRONG-CHANNEL'],['disclosureClassification','WRONG-DISCLOSURE'],['permittedTransferCount',999]])assert.throws(()=>engine.recordDeliveryAttempt(p,{deliveryId,[field]:value}),new RegExp(`delivery attempt ${field}`,'i'),`Delivery-attempt ${field} mismatch was accepted.`);
}

// Terminal self-validity, retry idempotence, and distinct authorization/attempt/
// delivered states are checked against the production record hash.
{
  const p=fresh(),first=terminalRecord(p),before=engine.records(p,'deliveryRecords').length;
  const expectedHash=globalThis.closedLoopHash.sha256Value(Object.fromEntries(Object.entries(first.fields).filter(([key])=>key!=='DELIVERY_RECORD_HASH')));
  assert.equal(terminalHash(p),expectedHash,'The terminal record failed its own exact record-hash validity check.');
  const retry=engine.calculateTerminal(p,{expectedRevision:Number(p.revision||0)});
  assert.equal(engine.recordId(retry,'deliveryRecords'),engine.recordId(first,'deliveryRecords'),'Authorized terminal retry was not idempotent.');
  assert.equal(engine.records(p,'deliveryRecords').length,before,'Authorized terminal retry duplicated the terminal record.');
  assert.equal(engine.recordValue(retry,'DELIVERY_STATE'),'AUTHORIZED');
  assert.equal(engine.records(p,'deliveryAttempts').length,0,'A terminal retry must not fabricate an operational attempt.');
  assert.equal(engine.recordValue(retry,'DELIVERY_STATE'),'AUTHORIZED','Delivery authorization must remain distinct from delivery completion.');
}

assert.doesNotMatch(engineSource,/if\(e0\.gate\(30,p\)\.complete&&t\.complete\)\{const d=delivery\(p\)/,'Ordinary recalculation must not silently execute CALCULATE_TERMINAL.');
for(const token of ['CALCULATE_TERMINAL','EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','RECORD_DELIVERY_EVIDENCE','calculateTerminal','recordDeliveryAttempt','recordDeliveryEvidence'])assert.match(engineSource,new RegExp(token),`Stage 30 engine contract missing ${token}.`);
for(const token of ['calculate-stage30-terminal','export-authorized-artifacts','record-delivery-evidence','exportAuthorizedArtifacts','recordCurrentDeliveryEvidence'])assert.match(appSource,new RegExp(token),`Stage 30 visible operator path missing ${token}.`);
assert.match(appSource,/downloadCanonicalArtifact\(artifactId\)/,'Authorized export/share must reuse exact canonical stored-byte verification before transfer.');
for(const token of ['mobile-acceptance-panel','mobile-acceptance-target-json','mobile-acceptance-evidence-json','run-mobile-capability-probe','export-mobile-acceptance-evidence','acceptanceSession','acceptanceModeReceipt','receipts'])assert.match(appSource,new RegExp(token),`Stage 30 mobile actor path missing ${token}.`);

fs.rmSync(fixturePath,{force:true});
console.log(JSON.stringify({
  stage30TerminalMobileBoundary:'PASS',
  intentionalInvalidFixturesRejected:[
    'external-response-fallthrough',
    'blocked-terminal-authorizes-export',
    'delivery-evidence-without-attempt',
      ...mutationRejected,
      ...mobileRejected,
    'automatic-terminal-side-effect',
    'mobile-target-csprng-and-explicit-physical-facts'
  ],
  blockedTerminalRecorded:true,
  terminalRetryIdempotent:true,
  terminalCalculationApplicationOwned:true,
  authorizedExportOperatorAction:true,
  deliveryAttemptDistinct:true,
  deliveryEvidenceDistinct:true,
  visibleOperatorPathWired:true,
  mobileActorHandoffPathWired:true,
  mobileTargetChallengeBound:true,
  verificationObservations
},null,2));

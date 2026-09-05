import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createMobileAcceptanceTarget,MOBILE_ACCEPTANCE_ORIGIN,MOBILE_ACCEPTANCE_BASE_PATH} from './generate-mobile-acceptance-target.mjs';
import {verifyMobileAcceptanceEvidence,REQUIRED_MOBILE_RECEIPT_KINDS,REQUIRED_MOBILE_CAPABILITY_PROBE_KEYS} from './verify-mobile-acceptance-evidence.mjs';
import {evaluateMobileAcceptanceSubmission} from './evaluate-mobile-acceptance-submission.mjs';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js']){
  vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
}
const core=globalThis.closedLoopCore;
const engine=globalThis.closedLoopWorkflowEngine;
const schema=globalThis.closedLoopWorkflowSchema;
const engineSource=fs.readFileSync('workflow-engine.js','utf8');
const appSource=fs.readFileSync('app-core.js','utf8');
const fullCycleSource=fs.readFileSync('verify-full-cycle.mjs','utf8');
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
fs.writeFileSync(instrumentedPath,fullCycleSource.slice(0,fixtureIndex)+`fs.writeFileSync(${JSON.stringify(fixturePath)},JSON.stringify(p));console.log(${JSON.stringify(fixtureMarker)});process.exit(0);\n`+fullCycleSource.slice(fixtureIndex));
let fixtureOutput='';
try{fixtureOutput=execFileSync(process.execPath,[instrumentedPath],{encoding:'utf8',maxBuffer:64*1024*1024});}
finally{fs.rmSync(instrumentedPath,{force:true});}
assert.match(fixtureOutput,new RegExp(fixtureMarker));
assert.ok(fs.existsSync(fixturePath),'The disposable Stage 30 fixture was not captured.');
const sourceProject=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
fs.rmSync(fixturePath,{force:true});
const fresh=()=>{const p=structuredClone(sourceProject);engine.ensureShape(p);return p;};
const refresh=(p,family,record)=>engine.refreshRecordHashes(record,family);
const terminalRecord=p=>engine.records(p,'deliveryRecords').at(-1);
const terminalHash=p=>engine.recordValue(terminalRecord(p,'deliveryRecords'),'DELIVERY_RECORD_HASH');
const hashInput=p=>Object.fromEntries(Object.entries(terminalRecord(p,'deliveryRecords').fields).filter(([key])=>key!=='DELIVERY_RECORD_HASH'));
assert.equal(engine.recordValue(terminalRecord(sourceProject),'DELIVERY_STATE'),'AUTHORIZED','The fixture must reach application-owned authorization.');
assert.equal(engine.records(sourceProject,'deliveryAttempts').length,0,'The terminal-ready fixture must not pre-record an operational attempt.');

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
for(const token of ['mobile-acceptance-panel','mobile-acceptance-target-json','mobile-acceptance-evidence-json','run-mobile-capability-probe','export-mobile-acceptance-evidence','mobileAcceptanceReceipts','acceptanceModeReceipt'])assert.match(appSource,new RegExp(token),`Stage 30 mobile actor path missing ${token}.`);

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
  mobileTargetChallengeBound:true
},null,2));

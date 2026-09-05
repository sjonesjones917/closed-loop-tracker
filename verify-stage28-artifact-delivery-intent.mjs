import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for (const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js']) vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const {closedLoopWorkflowEngine:engine}=globalThis;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-stage28-'));
const snapshotPath=path.join(tmp,'stage27-ready.json');
const fixtureOutput=execFileSync(process.execPath,['verify-full-cycle.mjs'],{encoding:'utf8',env:{...process.env,CLOSED_LOOP_STAGE28_FIXTURE_OUT:snapshotPath,CLOSED_LOOP_STAGE28_FIXTURE_ONLY:'1'},maxBuffer:64*1024*1024});
assert.match(fixtureOutput,/STAGE28_READY_FIXTURE/,'The full-cycle production mechanism did not reach the exact Stage 27-ready fixture.');
assert.ok(fs.existsSync(snapshotPath),'The full-cycle production mechanism did not preserve its Stage 27-ready fixture.');
const source=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
fs.rmSync(tmp,{recursive:true,force:true});

function fresh(){const p=structuredClone(source);engine.ensureShape(p);engine.recalculate(p);assert.equal(engine.gate(27,p).complete,true,'The isolated Stage 28 fixture is not actually Stage 27-ready.');return p;}
function context(p){
  const candidate=engine.currentDeliveryCandidate(p),release=engine.recordsForCurrentScope(p,'releaseRecords').at(-1);assert.ok(candidate&&release,'Stage 28 fixture lacks its current candidate or release.');
  const ids=(engine.recordValue(candidate,'ARTIFACT_IDS')||[]).map(String),rawNames=engine.recordValue(candidate,'AUTHORIZED_FILENAMES'),rawSizes=engine.recordValue(candidate,'BYTE_LENGTHS'),rawHashes=engine.recordValue(candidate,'SHA256_VALUES');
  const nameMap=Array.isArray(rawNames)?Object.fromEntries(ids.map((id,i)=>[id,String(rawNames[i]||'')])):rawNames||{},sizeMap=Array.isArray(rawSizes)?Object.fromEntries(ids.map((id,i)=>[id,Number(rawSizes[i])])):rawSizes||{},hashMap=Array.isArray(rawHashes)?Object.fromEntries(ids.map((id,i)=>[id,String(rawHashes[i]||'')])):rawHashes||{};
  const files=ids.map(id=>({artifactId:id,name:nameMap[id],size:sizeMap[id],sha256:hashMap[id],byteVerificationReceipt:{source:'APPLICATION_BYTE_REHASH',receiptId:`REHASH-${id}`,artifactId:id,byteSize:sizeMap[id],sha256:hashMap[id]}}));
  return {candidate,release,ids,nameMap,sizeMap,hashMap,files};
}
function identityCount(p){return engine.records(p,'artifactIdentities').length;}
function validIntent(c){return {authorized:true,deliveryCandidateSetId:engine.recordId(c.candidate,'deliveryCandidateSets'),releaseId:engine.recordId(c.release,'releaseRecords'),artifactIds:[...c.ids],authorizedFilenames:{...c.nameMap},recipientOrClass:'STAGE28_RECIPIENT',destination:'STAGE28_DESTINATION',transferPurpose:'DELIVER_FINAL_ARTIFACTS',transferChannel:'BROWSER_DOWNLOAD',disclosureClassification:'CONFIDENTIAL',disclosureAuthorization:true,permittedTransferCount:1};}
const rejected=[];

// Deliberately invalid byte-identity states execute the real Stage 28 mechanism and cannot create identity records.
{
  const p=fresh(),c=context(p),before=identityCount(p),metadata=c.files.map(({byteVerificationReceipt,...rest})=>rest);
  assert.throws(()=>engine.verifyArtifactIdentity(p,metadata,metadata),/application-owned byte rehash receipt/i);assert.equal(identityCount(p),before);rejected.push('metadata-only-byte-claim');
}
{
  const p=fresh(),c=context(p),before=identityCount(p);assert.throws(()=>engine.verifyArtifactIdentity(p,c.files,[]),/counts differ from the current delivery candidate/i);assert.equal(identityCount(p),before);rejected.push('missing-delivery-member');
  assert.throws(()=>engine.verifyArtifactIdentity(p,[...c.files,c.files[0]],[...c.files,c.files[0]]),/Duplicate artifact identity or filename/i);assert.equal(identityCount(p),before);rejected.push('duplicate-delivery-member');
  const renamed=c.files.map((item,index)=>index?item:{...item,name:`unauthorized-${item.name}`});assert.throws(()=>engine.verifyArtifactIdentity(p,c.files,renamed),/exact candidate artifact-to-filename mapping/i);assert.equal(identityCount(p),before);rejected.push('unauthorized-rename');
  const changed=c.files.map((item,index)=>index?item:{...item,size:item.size+1,sha256:'0'.repeat(64),byteVerificationReceipt:{...item.byteVerificationReceipt,byteSize:item.size+1,sha256:'0'.repeat(64)}});assert.throws(()=>engine.verifyArtifactIdentity(p,c.files,changed),/application-owned byte rehash receipt/i);assert.equal(identityCount(p),before);rejected.push('modified-delivery-bytes');
}

// The dedicated command boundary is closed: generic RECORD_HUMAN_DECISION cannot impersonate CAPTURE_DELIVERY_INTENT.
{
  const p=fresh(),before=engine.records(p,'humanDecisions').length;assert.throws(()=>engine.recordRegisteredHumanDecision(p,{stage:28,purpose:'DELIVERY_INTENT',targetFamily:'deliveryCandidateSets',targetId:'CANDIDATE',value:{authorized:true}}),/UNKNOWN_HUMAN_DECISION_PURPOSE/);assert.equal(engine.records(p,'humanDecisions').length,before);rejected.push('generic-purpose-substitution');
}

// Human intent records may preserve exactly what the human entered, but incomplete or wrongly bound intent never satisfies Stage 28 and never authorizes delivery.
for (const [id,mutate] of [
  ['missing-destination',value=>{delete value.destination;}],
  ['wrong-artifact-set',value=>{value.artifactIds=[];}],
  ['invalid-transfer-count',value=>{value.permittedTransferCount=0;}],
  ['untrusted-validity-time',value=>{value.validityCondition='Before a timed expiry';value.validityTimeBasis='DEVICE_REPORTED';}]
]){
  const p=fresh(),c=context(p);engine.verifyArtifactIdentity(p,c.files,c.files);const value=validIntent(c);mutate(value);const decision=engine.captureDeliveryIntent(p,{value,operatorLabel:'STAGE28_VERIFIER'});assert.ok(decision,'The human decision command failed to preserve the exact attempted human intent.');assert.equal(engine.gate(28,p).complete,false,`${id} incorrectly satisfied Stage 28.`);assert.equal(p.release.authorization,'NOT AUTHORIZED',`${id} incorrectly authorized delivery.`);rejected.push(id);
}

// Repaired execution through the same production mechanisms completes Stage 28 while authorization remains a later terminal fact.
{
  const p=fresh(),c=context(p),created=engine.verifyArtifactIdentity(p,c.files,c.files);assert.equal(created.length,c.ids.length);const decision=engine.captureDeliveryIntent(p,{value:validIntent(c),operatorLabel:'STAGE28_VERIFIER'});assert.ok(decision);assert.equal(engine.gate(28,p).complete,true,'The repaired Stage 28 mechanism did not progress after exact identity plus destination-bound human intent.');assert.equal(p.release.authorization,'NOT AUTHORIZED','Stage 28 collapsed delivery intent into Stage 30 authorization.');
  const duplicate=engine.captureDeliveryIntent(p,{value:validIntent(c),operatorLabel:'STAGE28_VERIFIER'});assert.ok(duplicate);assert.equal(engine.gate(28,p).complete,false,'Two current delivery-intent decisions were treated as one unambiguous authorization scope.');rejected.push('duplicate-current-delivery-intent');
}

// Later candidate-semantic or identity-scope drift immediately reopens Stage 28.
{
  const p=fresh(),c=context(p);engine.verifyArtifactIdentity(p,c.files,c.files);engine.captureDeliveryIntent(p,{value:validIntent(c),operatorLabel:'STAGE28_VERIFIER'});assert.equal(engine.gate(28,p).complete,true);
  const semanticMutation=structuredClone(p),candidate=engine.currentDeliveryCandidate(semanticMutation);candidate.fields.PACKAGE_MEMBERSHIP={unexpected:'changed'};candidate.PACKAGE_MEMBERSHIP={unexpected:'changed'};engine.refreshRecordHashes(candidate,'deliveryCandidateSets');engine.recalculate(semanticMutation);assert.equal(engine.gate(28,semanticMutation).complete,false,'Changed candidate package semantics did not stale Stage 28.');rejected.push('candidate-semantics-mutation');
  const scopeMutation=structuredClone(p),identity=engine.recordsForCurrentScope(scopeMutation,'artifactIdentities')[0];identity.scope.releaseId='RELEASE-WRONG';engine.refreshRecordHashes(identity,'artifactIdentities');engine.recalculate(scopeMutation);assert.equal(engine.gate(28,scopeMutation).complete,false,'Changed artifact-identity release scope did not stale Stage 28.');rejected.push('identity-release-scope-mutation');
}

// Artifact matching is keyed by canonical identity, not picker order.
{
  const p=fresh(),c=context(p),baseArtifact=engine.records(p,'artifacts').find(r=>engine.recordId(r,'artifacts')===c.ids[0]),second=structuredClone(baseArtifact),secondId='ARTIFACT-STAGE28-SECOND',secondName='stage28-second.bin',secondHash='b'.repeat(64);second.id=secondId;second.fields={...second.fields,ARTIFACT_ID:secondId,FILENAME:secondName,BYTE_SIZE:7,SHA256:secondHash};Object.assign(second,second.fields);engine.refreshRecordHashes(second,'artifacts');p.projectData.artifacts.push(second);
  const candidate=engine.currentDeliveryCandidate(p);candidate.fields.ARTIFACT_IDS=[c.ids[0],secondId];candidate.ARTIFACT_IDS=candidate.fields.ARTIFACT_IDS;candidate.fields.AUTHORIZED_FILENAMES=[c.nameMap[c.ids[0]],secondName];candidate.AUTHORIZED_FILENAMES=candidate.fields.AUTHORIZED_FILENAMES;candidate.fields.BYTE_LENGTHS=[String(c.sizeMap[c.ids[0]]),'7'];candidate.BYTE_LENGTHS=candidate.fields.BYTE_LENGTHS;candidate.fields.SHA256_VALUES=[c.hashMap[c.ids[0]],secondHash];candidate.SHA256_VALUES=candidate.fields.SHA256_VALUES;engine.refreshRecordHashes(candidate,'deliveryCandidateSets');engine.recalculate(p);
  const expanded=context(p),created=engine.verifyArtifactIdentity(p,expanded.files,[...expanded.files].reverse());assert.equal(created.length,2,'Order-independent Stage 28 identity did not create both exact identities.');assert.equal(created.every(r=>engine.recordValue(r,'AUTHORIZATION')==='AUTHORIZED'),true,'Reversed picker order changed exact artifact authorization.');
}

console.log(JSON.stringify({stage28:'PASS',applicationStage:28,intentionalInvalidFixturesRejected:rejected,noIdentityMutationOnRejectedByteFixtures:true,applicationByteRehashRequired:true,exactCandidateMappingRequired:true,orderIndependentIdentity:true,destinationBoundIntentGate:true,trustedTimedValidityGate:true,ambiguousDuplicateIntentBlocked:true,candidateSemanticDriftRejected:true,identityScopeDriftRejected:true,stage28DoesNotAuthorizeDelivery:true,repairedPathProgressed:true,fullCycleFixtureReachedStage27:true,isolatedDisposableProjects:true}));

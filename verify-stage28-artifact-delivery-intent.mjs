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
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.stage28-fixture-'));
const snapshotPath=path.join(tmp,'stage27-ready.json');
const instrumentedPath=path.join(process.cwd(),`.stage28-full-cycle-${process.pid}.mjs`);
const fullCycleSource=fs.readFileSync('verify-full-cycle.mjs','utf8');
const stage28Boundary="engine.verifyArtifactIdentity(p,[{artifactId:'ARTIFACT-PRODUCT'";
const boundaryIndex=fullCycleSource.indexOf(stage28Boundary);
assert.ok(boundaryIndex>0,'The full-cycle Stage 28 boundary could not be located for isolated fixture instrumentation.');
const instrumented=fullCycleSource.slice(0,boundaryIndex)+`fs.writeFileSync(${JSON.stringify(snapshotPath)},JSON.stringify(p));console.log('STAGE28_READY_FIXTURE');process.exit(0);\n`+fullCycleSource.slice(boundaryIndex);
fs.writeFileSync(instrumentedPath,instrumented);
let fixtureOutput='';
try{fixtureOutput=execFileSync(process.execPath,[instrumentedPath],{encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,CLRT_TEST_PRODUCT_VARIANT:'two-files'}});}finally{fs.rmSync(instrumentedPath,{force:true});}
assert.match(fixtureOutput,/STAGE28_READY_FIXTURE/,'The full-cycle production mechanism did not reach the exact Stage 27-ready fixture.');
assert.ok(fs.existsSync(snapshotPath),'The instrumented full-cycle production mechanism did not preserve its Stage 27-ready fixture.');
const source=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
fs.rmSync(tmp,{recursive:true,force:true});

function fresh(api=engine){const p=api.clone(source);api.ensureShape(p);api.recalculate(p);assert.equal(api.gate(27,p).complete,true,'The isolated Stage 28 fixture is not actually Stage 27-ready.');return p;}
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
  const changed=c.files.map((item,index)=>index?item:{...item,size:item.size+1,sha256:'0'.repeat(64),byteVerificationReceipt:{...item.byteVerificationReceipt,byteSize:item.size+1,sha256:'0'.repeat(64)}});assert.throws(()=>engine.verifyArtifactIdentity(p,c.files,changed),/application-owned byte rehash receipt/i);assert.equal(identityCount(p),before);rejected.push('modified-delivery-byte-claims');
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
  const summary=p.stages[28].derivedData;assert.match(summary.HASH_REVIEW_ID,/^HASH_REVIEW-[A-F0-9]{64}$/,'The completed identity review lacks its application-owned hash-review identity.');assert.equal(p.job.CURRENT_HASH_REVIEW_ID,summary.HASH_REVIEW_ID);assert.equal(summary.ARTIFACT_HASH_RECORDS,c.ids.length);assert.equal(summary.TOTAL_EXACT_HASH_MATCHES,c.ids.length);assert.equal(summary.TOTAL_HASH_MISMATCHES,0);assert.equal(summary.TOTAL_UNKNOWN_HASH_COMPARISONS,0);assert.equal(summary.ALL_RELEASE_HASHES_EQUAL_AUDITED_HASHES,true);assert.equal(summary.AUTHORIZATION_EVIDENCE,engine.recordId(decision,'humanDecisions'));const reloaded=structuredClone(p);engine.recalculate(reloaded);assert.equal(reloaded.job.CURRENT_HASH_REVIEW_ID,summary.HASH_REVIEW_ID,'Reload changed the identity review.');
  const duplicate=engine.captureDeliveryIntent(p,{value:validIntent(c),operatorLabel:'STAGE28_VERIFIER'});assert.ok(duplicate);assert.equal(engine.gate(28,p).complete,false,'Two current delivery-intent decisions were treated as one unambiguous authorization scope.');rejected.push('duplicate-current-delivery-intent');
}

// Later candidate-semantic or identity-scope drift immediately reopens Stage 28.
{
  const p=fresh(),c=context(p);engine.verifyArtifactIdentity(p,c.files,c.files);engine.captureDeliveryIntent(p,{value:validIntent(c),operatorLabel:'STAGE28_VERIFIER'});assert.equal(engine.gate(28,p).complete,true);
  const semanticMutation=structuredClone(p),candidate=engine.currentDeliveryCandidate(semanticMutation);candidate.fields.PACKAGE_MEMBERSHIP={unexpected:'changed'};candidate.PACKAGE_MEMBERSHIP={unexpected:'changed'};engine.refreshRecordHashes(candidate,'deliveryCandidateSets');engine.recalculate(semanticMutation);assert.equal(engine.gate(28,semanticMutation).complete,false,'Changed candidate package semantics did not stale Stage 28.');rejected.push('candidate-semantics-mutation');
  const scopeMutation=structuredClone(p),identity=engine.recordsForCurrentScope(scopeMutation,'artifactIdentities')[0];identity.scope.releaseId='RELEASE-WRONG';engine.refreshRecordHashes(identity,'artifactIdentities');engine.recalculate(scopeMutation);assert.equal(engine.gate(28,scopeMutation).complete,false,'Changed artifact-identity release scope did not stale Stage 28.');rejected.push('identity-release-scope-mutation');
}

// Both files came through product registration, candidate freeze, inspection,
// audit and release in the preceding synthetic command fixture.
function assertIdentityOrder(api,p){
 const c=context(p);assert.equal(c.files.length,2);
 const created=api.verifyArtifactIdentity(p,c.files,[...c.files].reverse());assert.equal(created.length,2);
 api.captureDeliveryIntent(p,{value:{...validIntent(c),artifactIds:[...c.ids].reverse(),authorizedFilenames:[...c.ids].reverse().map(id=>c.nameMap[id])},operatorLabel:'SYNTHETIC'});
 assert.equal(api.gate(28,p).complete,true,'IDENTITY_ORDER_ORACLE: reversing paired human-intent IDs and filenames changed their meaning');
}
assertIdentityOrder(engine,fresh());
// Adding an artifact to the already approved candidate requires new inspection
// and release. It cannot piggyback on the old release as the previous test did.
for(const [field,value] of [
 ['TRANSFORMATION_RECORD_IDS',['UNREVIEWED-TRANSFORM']],['ARTIFACT_IDS',['UNREVIEWED-ARTIFACT']],['AUTHORIZED_FILENAMES',['renamed.bin','second.bin']],
 ['BYTE_LENGTHS',['999','999']],['SHA256_VALUES',['0'.repeat(64),'0'.repeat(64)]],
 ['PACKAGE_MEMBERSHIP',{changed:true}],
 ['VIEWER_REQUIREMENTS',['UNREVIEWED-VIEWER']],['PRODUCT_LINEAGE',{changed:true}]
]){
 const p=fresh(),c=context(p),before=identityCount(p);c.candidate.fields[field]=c.candidate[field]=value;engine.refreshRecordHashes(c.candidate,'deliveryCandidateSets');
 assert.throws(()=>engine.verifyArtifactIdentity(p,c.files,c.files),/current bound Stage 27/,'CHANGED_CANDIDATE_ORACLE: '+field+' retained old release authority');
 assert.equal(identityCount(p),before);assert.equal(engine.releaseMetrics(p).determination,'BLOCKED','CHANGED_CANDIDATE_ORACLE: changed candidate was eligible for a fresh release without repeated inspection');
 const restored=fresh(),restoredContext=context(restored);assert.equal(engine.verifyArtifactIdentity(restored,restoredContext.files,restoredContext.files).length,restoredContext.ids.length);
 rejected.push('changed-candidate-'+field);
}

// Prove that these oracles detect faults in the responsible production layers.
const sourceEngine=fs.readFileSync('workflow-engine.js','utf8'),detectedFaults=[];
function faultEngine(anchor,replacement){
 assert.equal(sourceEngine.split(anchor).length,2,'The intended production fault must have one exact target');
 const isolated=vm.createContext({console,TextEncoder,TextDecoder,Blob,crypto:globalThis.crypto,Event:class{},dispatchEvent(){}});
 for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInContext(file==='workflow-engine.js'?sourceEngine.replace(anchor,replacement):fs.readFileSync(file,'utf8'),isolated,{filename:file});
 return isolated.closedLoopWorkflowEngine;
}
{
 const broken=faultEngine("Object.fromEntries(suppliedIds.map((id,index)=>[id,String(value.authorizedFilenames[index]||'')]))","Object.fromEntries(expectedIds.map((id,index)=>[id,String(value.authorizedFilenames[index]||'')]))");
 assert.throws(()=>assertIdentityOrder(broken,fresh(broken)),/IDENTITY_ORDER_ORACLE/);
 detectedFaults.push('order-dependent-human-intent-mapping');
}
{
 const anchor='if(hash.sha256Value(recordValue(candidate,field)??null)!==hash.sha256Value(set[key]))',broken=faultEngine(anchor,'if(false)');
 const p=fresh(broken),candidate=broken.currentDeliveryCandidate(p);candidate.fields.TRANSFORMATION_RECORD_IDS=candidate.TRANSFORMATION_RECORD_IDS=['UNREVIEWED-TRANSFORM'];broken.refreshRecordHashes(candidate,'deliveryCandidateSets');
 assert.throws(()=>assert.equal(broken.releaseMetrics(p).determination,'BLOCKED','CHANGED_CANDIDATE_ORACLE'),/CHANGED_CANDIDATE_ORACLE/);
 detectedFaults.push('skipped-frozen-candidate-content-validation');
}
assertIdentityOrder(engine,fresh());

console.log(JSON.stringify({stage28:'PASS',applicationStage:28,detectedFaults,intentionalInvalidFixturesRejected:rejected,noIdentityMutationOnRejectedByteFixtures:true,applicationByteRehashReceiptRequired:true,actualStoredByteComparisonEstablished:false,actualBrowserJourney:false,exactCandidateMappingRequired:true,orderIndependentIdentity:true,destinationBoundIntentGate:true,trustedTimedValidityGate:true,ambiguousDuplicateIntentBlocked:true,candidateSemanticDriftRejected:true,identityScopeDriftRejected:true,stage28DoesNotAuthorizeDelivery:true,repairedPathProgressed:true,fullCycleFixtureReachedStage27:true,isolatedDisposableProjects:true}));

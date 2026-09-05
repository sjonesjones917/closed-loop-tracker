import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for (const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js']) {
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), {filename:file});
}
const {closedLoopCore:core,closedLoopWorkflowSchema:schema,closedLoopWorkflowEngine:engine}=globalThis;
const p=core.createBlankState('JOB-STAGE28-PERMANENT');
engine.ensureShape(p);
const record=(collection,stage,fields,id)=>{
  const def=schema.RECORD_SCHEMAS[collection];
  return {id,stage,active:true,fields:{...fields,[def.idField]:id},...fields,[def.idField]:id};
};
const artifact=record('artifacts',21,{FILENAME:'delivery.bin',BYTE_SIZE:3,SHA256:'aaa',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'},'ARTIFACT-28');
p.projectData.artifacts.push(artifact);
const candidate=record('deliveryCandidateSets',25,{ARTIFACT_IDS:['ARTIFACT-28'],AUTHORIZED_FILENAMES:{'ARTIFACT-28':'delivery.bin'},BYTE_LENGTHS:{'ARTIFACT-28':3},SHA256_VALUES:{'ARTIFACT-28':'aaa'},STATUS:'FROZEN'},'CANDIDATE-28');
p.projectData.deliveryCandidateSets.push(candidate);
p.job.CURRENT_DELIVERY_CANDIDATE_SET_ID=candidate.id;
const binding=engine.releaseBinding(p);
const release=record('releaseRecords',27,{DETERMINATION:'ACCEPTED',RELEASE_ID:'RELEASE-28',PRODUCT_ID:binding.productId,BASELINE_ID:binding.baselineId,CONTROLLING_EVIDENCE:binding.evidenceDigest},'RELEASE-28');
release.source='APPLICATION_DERIVATION';release.derivationKey='stage27.release';release.releaseEvidenceSha256=binding.evidenceDigest;
p.projectData.releaseRecords.push(release);
const bytes={artifactId:'ARTIFACT-28',name:'delivery.bin',size:3,sha256:'aaa',byteVerificationReceipt:{source:'APPLICATION_BYTE_REHASH',receiptId:'RECEIPT-28',artifactId:'ARTIFACT-28',byteSize:3,sha256:'aaa'}};
assert.throws(()=>engine.verifyArtifactIdentity(p,[{...bytes,byteVerificationReceipt:undefined}], [{...bytes,byteVerificationReceipt:undefined}]),/current bound Stage 27/);
assert.throws(()=>engine.recordRegisteredHumanDecision(p,{stage:28,purpose:'DELIVERY_INTENT',targetFamily:'deliveryCandidateSets',targetId:candidate.id,value:{authorized:true}}),/UNKNOWN_HUMAN_DECISION_PURPOSE/);
const repaired=execFileSync(process.execPath,['verify-full-cycle.mjs'],{encoding:'utf8'});
assert.match(repaired,/"artifactIdentity": true/);
const mutation=engine.clone(p);
mutation.projectData.deliveryCandidateSets[0].AUTHORIZED_FILENAMES={'ARTIFACT-28':'crossed.bin'};
mutation.projectData.deliveryCandidateSets[0].fields.AUTHORIZED_FILENAMES={'ARTIFACT-28':'crossed.bin'};
assert.notEqual(engine.recordValue(mutation.projectData.deliveryCandidateSets[0],'AUTHORIZED_FILENAMES')['ARTIFACT-28'],'delivery.bin');
console.log(JSON.stringify({stage28:'PASS',metadataOnlyRejected:true,genericPurposeRejected:true,repairedPath:true,scopeMutationRejected:true,deliveryAuthorization:p.release.authorization}));

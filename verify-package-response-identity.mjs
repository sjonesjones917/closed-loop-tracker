import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {readStoreArchive} from './test-zip.mjs';
import {stage04AcceptanceFixture,stage04AcceptanceEnvelope} from './test-fixtures.mjs';

const {core,engine,prompts,ingestion,store,copy,runtime}=projectStoreRuntime();
const fixture={core,engine,prompts,ingestion,schema:runtime.closedLoopWorkflowSchema};
let project=stage04AcceptanceFixture(fixture,'PACKAGE-RESPONSE-IDENTITY');
const original=prompts.reserveAndBuildPromptRecord(project,4).prompt;
project=await store.writeProject(project);
const invalid=stage04AcceptanceEnvelope(fixture,project,original);
invalid.records.propositions[0].fields.PROPOSITION_TEXT=123;
const rejected=ingestion.prepare(project,{stage:4,text:JSON.stringify(invalid),promptRecord:original,expectedCommittedRevision:project.revision,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',packageId:original.packageId,operationReservationId:original.operationReservationId,challengeNonce:original.challengeNonce}});
assert.equal(rejected.validation.valid,false);
assert.ok(rejected.validation.issues.some(row=>row.code==='WRONG_VALUE_TYPE'));
project=await store.writeProject(rejected.project,{expectedProjectRevision:project.revision,expectedStateSha256:project.projectSha256,operational:true});
const corrected=copy(project);ingestion.prepareStageContinuation(corrected,{stage:4});
project=await store.writeProject(corrected,{expectedProjectRevision:project.revision});
const result=await store.createExecutionPackage({jobId:project.job.JOB_ID,stage:4,operation:'COMPLETE'});
const files=new Map(readStoreArchive(new Uint8Array(await result.blob.arrayBuffer())).map(row=>[row.canonicalPath,Buffer.from(row.bytes)]));
const manifest=JSON.parse(files.get('manifest.json').toString()),instruction=files.get('instruction.txt');
const digest=createHash('sha256').update(instruction).digest('hex');
assert.equal(manifest.instruction.bodySha256,digest);assert.equal(manifest.promptIdentity.bodySha256,digest);
assert.notEqual(manifest.promptIdentity.instructionId,original.instructionId);
project=await store.readProject(project.job.JOB_ID);
const prompt=project.projectData.generatedPrompts.find(row=>row.instructionId===manifest.promptIdentity.instructionId);
const envelope=stage04AcceptanceEnvelope(fixture,project,prompt);
const staged=ingestion.prepare(project,{stage:4,text:JSON.stringify(envelope),promptRecord:prompt,expectedCommittedRevision:project.revision,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce}});
assert.equal(staged.validation.valid,true,JSON.stringify(staged.validation.issues));

// Execute the browser consumer's assertion against exported bytes and the real
// corrected response. This catches a verifier checking another manifest schema.
const message='Corrected response does not use the exact exported instruction and reservation.';
let check=fs.readFileSync('verify-browser-extra.mjs','utf8').split('\n').find(line=>line.includes("'"+message+"'"));
assert.ok(check,'The exported-response browser check must remain executable.');
if(process.argv.includes('--fault=wrong-manifest-field'))check=check.replace('correctionTransfer.manifest.instruction.bodySha256','correctionTransfer.manifest.instruction.sha256');
Object.assign(runtime,{assert:(value,message)=>assert.ok(value,message),correctedProofEnvelope:copy(envelope),correctionTransfer:copy({manifest})});
assert.doesNotThrow(()=>vm.runInContext(check,runtime),'EXPORTED_RESPONSE_IDENTITY_ORACLE: a valid corrected response and its exact exported instruction must pass the browser check');
const cases=[{name:'Rejected response regenerates a package whose exact instruction bytes and corrected response identities agree',result:'PASS'}];
for(const path of ['promptIdentity.instructionId','promptIdentity.bodySha256','promptIdentity.contractSha256','promptIdentity.contextSignature','packageId','operationReservationId','challengeNonce']){
 runtime.correctedProofEnvelope=copy(envelope);const keys=path.split('.');let target=runtime.correctedProofEnvelope;for(const key of keys.slice(0,-1))target=target[key];target[keys.at(-1)]='DELIBERATE-IDENTITY-MISMATCH';
 assert.throws(()=>vm.runInContext(check,runtime),error=>error.message===message,'The browser verifier failed to reject the single changed identity: '+path);
 cases.push({name:'Browser check rejects a changed '+path,result:'PASS'});
}
runtime.correctedProofEnvelope=copy(envelope);assert.doesNotThrow(()=>vm.runInContext(check,runtime));
console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Production package bytes and ingestion; actual browser verifier assertion in shared VM runtime',cases},null,2));

import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,hash=globalThis.closedLoopHash;

function fixture(suffix='1'){
  const project=core.createBlankState(`JOB-ATTEST-${suffix}`);Object.assign(project.job,{CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001'});engine.ensureShape(project);const scope=engine.currentScope(project),observationId=`OBSERVATION-${suffix}`,propositionId=`PROPOSITION-${suffix}`,evidenceId=`EVIDENCE-${suffix}`;
  project.projectData.propositions.push({id:propositionId,stage:4,active:true,scope,fields:{PROPOSITION_ID:propositionId,REQUIREMENT_ID:`REQ-${suffix}`,PROPOSITION_TEXT:'The signed external system reports compliance.',SUBJECT_AND_SCOPE_DESCRIPTION:'The exact bound external system observation.',SATISFACTION_MEANING:'The signed observation establishes compliance.',FAILURE_MEANING:'The signed observation refutes compliance.',STATUS:'UNDETERMINED'}});
  project.projectData.evidenceRecords.push({id:evidenceId,stage:22,active:true,scope,fields:{EVIDENCE_ID:evidenceId,KIND:'SIGNED_EXTERNAL_ATTESTATION',DESCRIPTION:'Exact signed external observation evidence.',LOCATION:'external attestation',CONTENT:'Bound by the signed payload.',STATUS:'PRESERVED'}});
  project.projectData.observationRecords.push({id:observationId,stage:22,active:true,scope,evidenceRefs:[evidenceId],fields:{OBSERVATION_ID:observationId,EXTERNAL_OR_AGENT_OBSERVED_VALUE:{determination:'SATISFIED',measuredValue:10},OBSERVATION_ORIGIN:'EXTERNAL_CLAIM',SUBMITTING_ACTOR_OR_RUNTIME:'SIGNED-TOOL',SUBJECT_ID:`TEST-${suffix}`,OBSERVED_LOCATION:'SIGNED-TOOL-OUTPUT',METHOD_OR_TOOL_IDENTITY:'SIGNED-TOOL-v1',INPUT_IDENTITIES_AND_HASHES:[{artifactId:`ARTIFACT-${suffix}`,sha256:'a'.repeat(64)}],OUTPUT_IDENTITIES_AND_HASHES:[],EPISTEMIC_BASIS:'SELF_ASSERTED',FRESHNESS_STATUS:'CURRENT',SOURCE_EVIDENCE_IDS:[evidenceId],CURRENT_SCOPE:scope,RAW_OR_NATIVE_PROVENANCE:`RAW-${suffix}`}});
  return{project,scope,observationId,propositionId,evidenceId};
}

async function signedInput(fixture){
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),jwk=await crypto.subtle.exportKey('jwk',pair.publicKey),publicJwk={kty:'EC',crv:'P-256',x:jwk.x,y:jwk.y,ext:true,key_ops:['verify']},contract={schema:'closed-loop-objective-attestation-contract/1',contractId:'CONTRACT-P256-1',algorithm:'ECDSA_P256_SHA256',publicKeyJwk:publicJwk,authorizedAttesterId:'SIGNED-TOOL-AUTHORITY',allowedSubjectIds:[`TEST-${fixture.observationId.split('-').at(-1)}`]},observation=fixture.project.projectData.observationRecords[0],issuedAt=new Date(Date.now()-1000).toISOString(),validUntil=new Date(Date.now()+60000).toISOString(),payload={schema:'closed-loop-objective-attestation/1',contractId:'CONTRACT-P256-1',jobId:fixture.project.job.JOB_ID,observationId:fixture.observationId,subjectId:observation.fields.SUBJECT_ID,targetPropositionId:fixture.propositionId,relation:'ESTABLISHES',observationValueSha256:hash.sha256Value(observation.fields.EXTERNAL_OR_AGENT_OBSERVED_VALUE),inputBindingsSha256:hash.sha256Value(observation.fields.INPUT_IDENTITIES_AND_HASHES),evidenceSetSha256:hash.sha256Value([fixture.evidenceId]),publicKeySha256:hash.sha256Value(publicJwk),attesterId:'SIGNED-TOOL-AUTHORITY',issuedAt,validUntil,nonce:'1'.repeat(32)},bytes=new TextEncoder().encode(hash.stableStringify(payload)),signature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,bytes));return{contract,payload,signature};
}

{
  const data=fixture('1'),signed=await signedInput(data),key='ATTEST-IDEMPOTENT-1',result=await engine.verifyObjectiveExternalAttestation(data.project,{observationId:data.observationId,...signed,idempotencyKey:key});assert.equal(result.verified,true);const observation=data.project.projectData.observationRecords[0];assert.equal(observation.fields.OBSERVATION_ORIGIN,'VERIFIED_EXTERNAL_OBSERVATION');assert.equal(observation.fields.EPISTEMIC_BASIS,'VERIFIED_EXTERNAL');assert.equal(observation.fields.ATTESTATION_VERIFICATION_STATUS,'VERIFIED');assert.equal(data.project.projectData.entailmentReviews.length,1);assert.equal(data.project.projectData.entailmentReviews[0].fields.ACCEPTED_RELATION,'ESTABLISHES');const retry=await engine.verifyObjectiveExternalAttestation(data.project,{observationId:data.observationId,...signed,idempotencyKey:key});assert.deepEqual(retry,result);assert.equal(data.project.projectData.entailmentReviews.length,1);assert.equal(data.project.projectData.commandReceipts.filter(receipt=>receipt.idempotencyKey===key).length,1);
}
{
  const data=fixture('2'),signed=await signedInput(data),invalid=new Uint8Array(signed.signature);invalid[0]^=0xff;await assert.rejects(()=>engine.verifyObjectiveExternalAttestation(data.project,{observationId:data.observationId,contract:signed.contract,payload:signed.payload,signature:invalid}),/signature verification failed/i);assert.equal(data.project.projectData.observationRecords[0].fields.OBSERVATION_ORIGIN,'EXTERNAL_CLAIM');assert.equal(data.project.projectData.observationRecords[0].fields.EPISTEMIC_BASIS,'SELF_ASSERTED');assert.equal(data.project.projectData.entailmentReviews.length,0);assert.equal(data.project.projectData.commandReceipts.length,0);
}

console.log(JSON.stringify({objectiveExternalAttestation:'PASS',realP256SignatureVerified:true,invalidSignatureRejectedWithoutMutation:true,idempotentRetry:true}));

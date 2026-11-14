import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {projectStoreRuntime,bindAcceptanceUi} from './test-project-store-runtime.mjs';
import {createStageOneIngestionFixture,stageOneResponseEnvelope,submitStageOneResponse,acceptStageOneResponse} from './test-ingestion-context-reference.mjs';

const files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const sha=value=>createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const members=[
 {caseId:'contract-sha256-current-authority-change',nreqId:'NREQ-53cba25ed9217f0e73651fa2c61364a5',member:'contractSha256',mutate({prompt}){prompt.contractSha256='0'.repeat(64);},expected:{code:'STALE_PROPOSAL',message:'contractSha256 changed'}},
 {caseId:'instruction-id-controlling-prompt-superseded',nreqId:'NREQ-5587097e6f38c4ebd63b45acc53049e4',member:'instructionId',mutate({prompt}){prompt.invalidatedBy='CONTROLLED-SUPERSESSION';},expected:{code:null,message:'exact controlling generated instruction no longer exists or was superseded'}},
 {caseId:'body-sha256-current-authority-change',nreqId:'NREQ-92c98d337503cc6833f7b34b896afa00',member:'bodySha256',mutate({prompt}){prompt.bodySha256='1'.repeat(64);},expected:{code:'STALE_PROPOSAL',message:'bodySha256 changed'}},
 {caseId:'response-schema-retained-envelope-binding-change',nreqId:'NREQ-b0bca81e89ab8b247b9d9cffdb60b0ba',member:'responseSchemaVersion',mutate({proposal}){proposal.envelope.schema='closed-loop-response/unsupported';},expected:{code:'STALE_PROPOSAL',issue:'WRONG_SCHEMA'}},
 {caseId:'context-signature-current-authority-change',nreqId:'NREQ-cfeded273e1987e645c09660471cfc82',member:'contextSignature',mutate({prompt}){prompt.contextSignature='2'.repeat(64);},expected:{code:'STALE_PROPOSAL',message:'contextSignature changed'}},
 {caseId:'scope-sha256-retained-precondition-binding-change',nreqId:'NREQ-f7b3a80b5425f8b433b87f872c96c45e',member:'scopeSha256',mutate({proposal}){proposal.preconditions.scopeSha256='3'.repeat(64);},expected:{code:'STALE_PROPOSAL',message:'scopeSha256 changed'}}
];

function completeProjectState(r,p){
 return plain(p);
}
function exactPendingSurfaces(r,p,proposalId,rawResponseId){
 const proposal=r.ingestion.findProposal(p,proposalId),raw=r.ingestion.findRaw(p,rawResponseId);
 return {revision:p.revision,projectSha256:p.projectSha256,proposal:plain(proposal),raw:plain(raw),acceptedChanges:plain(p.projectData.acceptedChanges),allocationReceipts:plain(p.projectData.allocationReceipts)};
}

export async function verifyResponsePendingAuthorityControls({report=true,sourceOverrides={}}={}){
 const started=performance.now(),sources=Object.fromEntries(files.map(name=>[name,sourceOverrides[name]??fs.readFileSync(name,'utf8')]));
 const r=projectStoreRuntime({sourceOverrides:sources}),fixture=await createStageOneIngestionFixture(r),envelope=stageOneResponseEnvelope(r,fixture.p,fixture.prompt),submitted=await submitStageOneResponse(r,fixture,envelope);
 assert.equal(submitted.result.validation.valid,true,'PENDING_SIX_VALID_PENDING_FIXTURE_ORACLE: '+JSON.stringify(submitted.result.validation.issues));
 assert.ok(submitted.result.proposal,'PENDING_SIX_VALID_PENDING_FIXTURE_ORACLE');
 const proposalId=submitted.result.proposal.proposalId,rawResponseId=submitted.rawResponseId,storedBaseline=await r.store.readProject(submitted.p.job.JOB_ID),baselineState=completeProjectState(r,storedBaseline),baselineSurfaces=exactPendingSurfaces(r,storedBaseline,proposalId,rawResponseId),stagingId=baselineSurfaces.raw.transport.stagingId,stagedBaseline=await r.store.readStagedResponseFile({jobId:storedBaseline.job.JOB_ID,stagingId});
 assert.equal(new TextDecoder().decode(stagedBaseline.bytes),submitted.text,'PENDING_SIX_STAGED_BASELINE_BYTES_ORACLE');
 const cases=[];
 for(const definition of members){
  const candidate=r.copy(storedBaseline),proposal=r.ingestion.findProposal(candidate,proposalId),prompt=candidate.projectData.generatedPrompts.find(row=>(row.instructionId||row.promptId)===proposal.promptId),beforeCandidate=completeProjectState(r,candidate);
  assert.ok(prompt&&proposal,'PENDING_SIX_CONTROL_TARGET_ORACLE: '+definition.caseId);definition.mutate({candidate,prompt,proposal});const alteredBefore=completeProjectState(r,candidate),failures=bindAcceptanceUi(r,candidate,proposalId);await r.runtime.accept();if(r.runtime.replacementReview)await r.runtime.confirm();
  assert.equal(failures.length,1,'PENDING_SIX_SINGLE_REFUSAL_ORACLE: '+definition.caseId);const failure=failures[0];assert.equal(failure.code??null,definition.expected.code,'PENDING_SIX_CODE_ORACLE: '+definition.caseId);if(definition.expected.message)assert.ok(String(failure.message).includes(definition.expected.message),'PENDING_SIX_MESSAGE_ORACLE: '+definition.caseId);if(definition.expected.issue)assert.ok(failure.issues?.some(row=>row.code===definition.expected.issue),'PENDING_SIX_ISSUE_ORACLE: '+definition.caseId);
  assert.deepEqual(completeProjectState(r,r.runtime.current),alteredBefore,'PENDING_SIX_CALLER_INPUT_PRESERVED_ORACLE: '+definition.caseId);
  const reloaded=await r.store.readProject(storedBaseline.job.JOB_ID),staged=await r.store.readStagedResponseFile({jobId:storedBaseline.job.JOB_ID,stagingId});assert.deepEqual(completeProjectState(r,reloaded),baselineState,'PENDING_SIX_COMPLETE_RELOAD_PRESERVED_ORACLE: '+definition.caseId);assert.deepEqual(exactPendingSurfaces(r,reloaded,proposalId,rawResponseId),baselineSurfaces,'PENDING_SIX_PENDING_SURFACES_PRESERVED_ORACLE: '+definition.caseId);assert.equal(staged.sha256,stagedBaseline.sha256,'PENDING_SIX_STAGED_DIGEST_PRESERVED_ORACLE: '+definition.caseId);assert.equal(new TextDecoder().decode(staged.bytes),submitted.text,'PENDING_SIX_STAGED_BYTES_PRESERVED_ORACLE: '+definition.caseId);
  cases.push({caseId:definition.caseId,nreqId:definition.nreqId,member:definition.member,passed:true,acceptanceRefused:true,errorCode:failure.code??null,...(definition.expected.issue?{issueCode:definition.expected.issue}:{}),callerInputPreserved:true,completeStoredStatePreserved:true,revisionPreserved:true,projectSha256Preserved:true,pendingProposalPreserved:true,rawResponsePreserved:true,stagedResponsePreserved:true,acceptedChangesPreserved:true,allocationReceiptsPreserved:true});
  assert.notDeepEqual(alteredBefore,beforeCandidate,'PENDING_SIX_DESIGNATED_MUTATION_LIVE_ORACLE: '+definition.caseId);
 }
 const accepted=await acceptStageOneResponse(r,storedBaseline,proposalId),acceptedProposal=r.ingestion.findProposal(accepted,proposalId),acceptedRaw=r.ingestion.findRaw(accepted,rawResponseId),acceptedStaged=await r.store.readStagedResponseFile({jobId:accepted.job.JOB_ID,stagingId});
 assert.equal(acceptedProposal.status,'ACCEPTED','PENDING_SIX_UNTOUCHED_CONTROL_COMMIT_ORACLE');assert.equal(acceptedRaw.completeRawResponse,submitted.text,'PENDING_SIX_UNTOUCHED_RAW_ORACLE');assert.equal(new TextDecoder().decode(acceptedStaged.bytes),submitted.text,'PENDING_SIX_UNTOUCHED_STAGED_ORACLE');assert.equal(r.store.validateProjectIntegrity(accepted).valid,true,'PENDING_SIX_UNTOUCHED_RELOAD_INTEGRITY_ORACLE');
 const result={responsePendingAuthorityControls:true,checkId:'RESPONSE-PENDING-SIX-AUTHORITY-RECHECK',requirementRefs:members.map(row=>row.nreqId),cases,validControl:{caseId:'untouched-pending-authorities-commit',passed:true,operatorAcceptanceRoute:true,acceptedStatus:'ACCEPTED',coldReloadIntegrity:true,rawResponsePreserved:true,stagedResponsePreserved:true,acceptedChangeCount:accepted.projectData.acceptedChanges.length,allocationReceiptCount:accepted.projectData.allocationReceipts.length},expected:{memberCount:6,refusalCount:6,completeStatePreservationCount:6,validControlCommitted:true},observed:{memberCount:cases.length,refusalCount:cases.filter(row=>row.acceptanceRefused).length,completeStatePreservationCount:cases.filter(row=>row.completeStoredStatePreserved).length,validControlCommitted:acceptedProposal.status==='ACCEPTED'},sourceHashes:Object.fromEntries(files.map(name=>[name,sha(sources[name])])),boundary:'Actual reserved Stage 1 package and authoritative response-file staging/readback, production capture/prepare, pending proposal, application acceptance caller, production precommit recheck, and cold read through the isolated Map transaction adapter. Six isolated authority or retained-binding changes are test inputs. Synthetic actor; no browser, native IndexedDB, external agent, reference-population completeness, all-precondition recomputation, or whole-clause claim.',synthetic:true,actualBrowser:false,nativeIndexedDB:false,realAgent:false,wholeClauseProof:false,elapsedMs:performance.now()-started};
 assert.deepEqual(result.observed,result.expected,'PENDING_SIX_COMPLETE_POPULATION_ORACLE');if(report)console.log(JSON.stringify(result));return result;
}

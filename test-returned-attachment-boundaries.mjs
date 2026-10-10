import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {createStageOneIngestionFixture as seed,stageOneResponseEnvelope as stageOneEnvelope,acceptStageOneResponse as accept} from './test-ingestion-context-reference.mjs';
const names=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const sources=Object.fromEntries(names.map(name=>[name,fs.readFileSync(name,'utf8')]));
const sha=v=>createHash('sha256').update(v).digest('hex');
const sourceHashes=Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,sha(v)]));
const infrastructureFamilies=new Set(['operationReservations']);
function business(r,p){
 const job=structuredClone(p.job);delete job.CURRENT_STATE;delete job.NEXT_REQUIRED_ACTION;
 const families=Object.fromEntries(Object.keys(r.runtime.closedLoopWorkflowSchema.RECORD_SCHEMAS).filter(k=>!infrastructureFamilies.has(k)).map(k=>[k,structuredClone(p.projectData[k]??[])]));
 const stages=Object.fromEntries(Object.entries(p.stages).map(([k,v])=>[k,{agentData:structuredClone(v.agentData),acceptedData:structuredClone(v.acceptedData),humanData:structuredClone(v.humanData),acceptedDataChangeIds:[...v.acceptedDataChangeIds],acceptedResponseIds:[...v.acceptedResponseIds]}]));
 return {job,families,stages,acceptedChanges:structuredClone(p.projectData.acceptedChanges),inputVersions:structuredClone(p.projectData.inputVersions),artifactVersions:structuredClone(p.projectData.artifactVersions),revision:p.revision,release:structuredClone(p.release)};
}
const originalBytes=new TextEncoder().encode('Returned supported evidence bytes.');
const declarations=[['conforming',null],['missing','MISSING_REQUIRED_ATTACHMENT'],['filename','ATTACHMENT_FILENAME_MISMATCH'],['media-type','ATTACHMENT_MEDIA_TYPE_MISMATCH'],['size','ATTACHMENT_BYTE_SIZE_MISMATCH'],['actual-byte-hash','ATTACHMENT_SHA256_MISMATCH']];
export async function verifyReturnedAttachmentBoundaries(){
const rows=[];
for(const [caseId,expectedCode] of declarations){
 const r=projectStoreRuntime({sourceOverrides:sources}),f=await seed(r);let p=f.p;const prompt=f.prompt,m=f.manifest;
 const slot=m.attachmentSlots.find(row=>row.role==='SUPPORTING_EVIDENCE');assert(slot,'STAGE1_SUPPORTING_SLOT_ORACLE');
 const envelope=stageOneEnvelope(r,p,prompt),filename='returned-proof.txt',mediaType='text/plain',digest=sha(originalBytes);
 const declaration={temporaryKey:'returned-proof',attachmentSlotId:slot.attachmentSlotId,role:slot.role,filename,mediaType,byteSize:originalBytes.byteLength,sha256:digest,required:true};
 envelope.attachments=[declaration];envelope.evidence[0].attachmentRef={tempKey:'returned-proof'};
 if(caseId==='filename')declaration.filename='wrong-proof.txt';
 if(caseId==='media-type')declaration.mediaType='application/json';
 if(caseId==='size')declaration.byteSize=originalBytes.byteLength+1;
 if(caseId==='actual-byte-hash')declaration.sha256='b'.repeat(64);
 const text=JSON.stringify(envelope),baseline=business(r,p),baselineInput=structuredClone(p);
 const staged=await r.store.stageResponseFile({jobId:p.job.JOB_ID,stage:1,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:m.promptIdentity,packageId:m.packageId,operationReservationId:m.operationReservationId,challengeNonce:m.challengeNonce});
 const read=await r.store.readStagedResponseFile({jobId:p.job.JOB_ID,stagingId:staged.stagingId});assert.equal(new TextDecoder('utf-8',{fatal:true}).decode(read.bytes),text);assert.equal(read.sha256,sha(text));
 let captured=r.ingestion.captureRaw(p,{stage:1,text,promptRecord:prompt,transport:{authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,rawFilename:'response.json',mediaType:'application/json',status:read.status,sha256:read.sha256,byteSize:read.byteSize,promptIdentity:m.promptIdentity,packageId:m.packageId,operationReservationId:m.operationReservationId,challengeNonce:m.challengeNonce}});
 let returned=null;
 if(caseId!=='missing'){
  const blob=new Blob([originalBytes],{type:mediaType});Object.defineProperty(blob,'name',{value:filename});
  returned=await r.runtime.storeArtifactFile(blob,1,r.copy({rawResponseId:captured.rawRecord.rawResponseId,attachmentSlotId:slot.attachmentSlotId}),captured.project);
  const actual=await r.store.getArtifact(returned.stored.artifactId);assert(actual);assert.equal(actual.filename,filename);assert.equal(actual.mediaType,mediaType);assert.equal(actual.byteSize,originalBytes.byteLength);assert.equal(await r.runtime.closedLoopHash.sha256Bytes(actual.blob),digest);assert.deepEqual(new Uint8Array(await actual.blob.arrayBuffer()),originalBytes);
  captured=r.ingestion.bindAttachmentSlots(captured.project,{rawResponseId:captured.rawRecord.rawResponseId,files:r.copy([{...returned.view,attachmentSlotId:slot.attachmentSlotId}])});
 }
 assert.deepEqual(business(r,captured.project),baseline,'ATTACHMENT_CAPTURE_BUSINESS_PRESERVATION '+caseId);
 const result=r.ingestion.prepareCaptured(captured.project,{rawResponseId:captured.rawRecord.rawResponseId,expectedCommittedRevision:p.revision});
 assert.deepEqual(business(r,p),business(r,baselineInput),'ATTACHMENT_CALLER_UNCHANGED '+caseId);
 assert.equal(result.rawRecord.completeRawResponse,text);
 const codes=Array.from(result.validation.issues,row=>row.code);
 const observations={caseId,expectedCode,actualValid:result.validation.valid,codes,issuePaths:Array.from(result.validation.issues,row=>row.path),rawResponseStagedReadRehashed:true,returnedActualBlobReadRehashed:caseId!=='missing',slotAuthority:'ACTUAL_EXPORTED_STAGE1_SUPPORTING_EVIDENCE_SLOT',slotRequiredByIssuedContract:slot.required,requiredDeclaredByResponse:true,acceptedBefore:p.projectData.acceptedChanges.length,rawBefore:baselineInput.projectData.rawResponses.length};
 if(expectedCode){
  assert.equal(result.validation.valid,false,'ATTACHMENT_BOUNDARY_REJECT '+caseId);assert(codes.includes(expectedCode),'ATTACHMENT_EXPECTED_CODE '+caseId+': '+codes.join(','));assert.equal(result.proposal,null,'ATTACHMENT_NO_PROPOSAL '+caseId);assert.deepEqual(business(r,result.project),baseline,'ATTACHMENT_REJECT_BUSINESS_PRESERVATION '+caseId);
  p=await r.store.writeProject(result.project,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});const reloaded=await r.store.readProject(p.job.JOB_ID);
  assert.equal(r.store.validateProjectIntegrity(reloaded).valid,true);assert.equal(r.ingestion.findRaw(reloaded,captured.rawRecord.rawResponseId).completeRawResponse,text);assert.equal(reloaded.projectData.responseValidations.at(-1).valid,false);assert.deepEqual(business(r,reloaded),baseline,'ATTACHMENT_RELOAD_BUSINESS_PRESERVATION '+caseId);
  Object.assign(observations,{noProposal:true,protectedJobAndCanonicalStateUnchanged:true,rawExactAfterReload:true,rejectionSavedAndReloaded:true,acceptedAfter:reloaded.projectData.acceptedChanges.length});
 }else{
  assert.equal(result.validation.valid,true,'ATTACHMENT_CONFORMING_CONTROL '+JSON.stringify(result.validation.issues));assert(result.proposal);assert.equal(result.proposal.tempToCanonical['returned-proof'].id,returned.stored.artifactId);assert.equal(result.proposal.evidence[0].ATTACHMENT_ID,returned.stored.artifactId);assert.deepEqual(business(r,result.project),baseline,'ATTACHMENT_VALID_PROPOSAL_NOT_YET_COMMITTED');
  p=await r.store.writeProject(result.project,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});const reloaded=await accept(r,p,result.proposal.proposalId);const artifact=r.engine.records(reloaded,'artifacts').find(row=>row.id===returned.stored.artifactId),actual=await r.store.getArtifact(returned.stored.artifactId);assert(artifact);assert.equal(await actual.blob.text(),'Returned supported evidence bytes.');assert.equal(r.ingestion.findRaw(reloaded,captured.rawRecord.rawResponseId).completeRawResponse,text);assert.equal(reloaded.projectData.acceptedChanges.length,baseline.acceptedChanges.length+1);Object.assign(observations,{proposalMappingCorrect:true,proposalNotCanonicalCommit:true,operatorAcceptanceSavedAndReloaded:true,actualReturnedBytesCommitted:true,rawExactAfterReload:true,acceptedAfter:reloaded.projectData.acceptedChanges.length});
 }
 rows.push(observations);console.log(JSON.stringify({caseComplete:observations}));
}
const changed=names.filter(name=>sha(fs.readFileSync(name,'utf8'))!==sourceHashes[name]);assert.deepEqual(changed,[],'SOURCE_CHANGED_DURING_SCOPED_PROBE');
const result={stage1ReturnedAttachmentBoundary:'PASS',status:'PASS',observedAt:new Date().toISOString(),nodeVersion:process.version,sourceHashes,verifierSha256:sha(fs.readFileSync(import.meta.filename)),synthetic:true,actualBrowser:false,realExternalActor:false,fixture:'Existing maintained seed creates a new project, saves current human input, reserves and exports actual Stage1 package; no prerequisite flags forced.',boundary:'Actual generated package -> response Blob staging/read/hash -> capture -> returned file real Blob allocation/storage/readback -> exact slot mapping -> production prepare -> rejection operational save/reload, conforming operator acceptance/store/reload.',rows,projection:{protectedJob:'All fields except CURRENT_STATE and NEXT_REQUIRED_ACTION',canonicalFamilies:'Every RECORD_SCHEMAS family except operationReservations',additionalProtected:['acceptedChanges','inputVersions','artifactVersions','accepted stage data and response identities','revision','release']},limits:['This six-case matrix uses the real Stage1 SUPPORTING_EVIDENCE slot, optional in issued contract but required once declared. Stage21 required finished-product omission is separately covered by existing verify-full-cycle assertions; it was not executed here.','The unchanged four Stage2 metadata/actual-byte tests were source-reviewed and reused as independent expected contrasts; this stronger real staging/reload path does not claim rerunning their entire owner.','No whole application conformance, CI, browser, physical-device, real-human or external-agent execution claim.']};
return result;
}

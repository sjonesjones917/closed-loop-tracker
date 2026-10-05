import assert from 'node:assert/strict';
import {recordProposal} from './test-fixtures.mjs';

// This function is also called at the genuine full-cycle Stage29 entry. The
// focused caller declares synthetic prerequisites and never claims that entry.
export async function verifyStage29Investigation({runtime,project,byteStore,basis,requireCompletePrefix=false}){
 const {engine,prompts,ingestion,schema}=runtime,hash=runtime.hash||runtime.runtime?.closedLoopHash||globalThis.closedLoopHash;
 const original=hash.sha256Value(project),q=engine.clone(project),stage=29,operation='INVESTIGATE_MISSING_EVIDENCE';
 if(requireCompletePrefix)for(let prior=1;prior<=28;prior++)assert.equal(engine.gate(prior,q).complete,true,'STAGE29_INVESTIGATION_GENUINE_PREFIX_ORACLE: '+prior);
 const req=engine.recordsForCurrentScope(q,'requirements')[0];assert(req,'STAGE29_INVESTIGATION_REQUIREMENT_ORACLE');const reqId=engine.recordId(req,'requirements');
 const {prompt}=prompts.reserveAndBuildPromptRecord(q,stage,{operation}),manifest=prompts.promptFileManifest(prompt),contextFiles=prompts.materializePromptContextFiles(prompt,q);
 const descriptor=prompts.responseContractDescriptor(stage,operation);
 assert.equal(Object.hasOwn(descriptor.records,'evidenceChains'),false,'STAGE29_INVESTIGATION_WRITER_AUTHORITY_ORACLE');
 assert.deepEqual(Object.keys(descriptor.records).sort(),['entailmentReviews','evidenceInvestigations','observationRecords'],'STAGE29_INVESTIGATION_WRITER_AUTHORITY_ORACLE');
 for(const file of contextFiles){assert.equal(hash.sha256Text(file.text),file.sha256);assert.equal(Buffer.byteLength(file.text,'utf8'),file.byteSize);}
 assert(prompt.prompt.includes(reqId)||contextFiles.some(file=>file.text.includes(reqId)),'STAGE29_INVESTIGATION_EXPORTED_SUBJECT_ORACLE');
 const fields={MISSING_LINK:'The application has not yet established the current evidence-chain record for '+reqId,INVESTIGATION:'Inspected the exact supplied current requirement, its linked observations and the application-reported evidence-chain state.',FOUND_EVIDENCE:'The supplied canonical observations retain their original identities. This investigation does not replace them or calculate chain completeness.',UNRESOLVED_REASON:'Application-owned chain calculation remains required.',RECOMMENDED_ACTION:'Run CALCULATE_EVIDENCE_CHAINS against the current canonical evidence; retain any reported missing link as unresolved.',EVIDENCE:'Synthetic scoped investigation observation; no external source or physical action claimed.'};
 const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:q.job.JOB_ID,stage,operation,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce,scope:manifest.scope,responseType:'DATA_PROPOSAL',stageData:{},records:{evidenceInvestigations:[recordProposal(schema,'evidenceInvestigations',{tempKey:'investigation-current-link',relationships:{REQ_ID:{recordId:reqId}},overrides:fields})]},evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',authorityType:'AGENT_CLAIM',description:'Declared synthetic investigation of the supplied current evidence link.',location:'test-stage29-investigation.mjs',content:JSON.stringify({synthetic:true,requirementId:reqId,physicalObservation:false,externalActor:false,applicationCalculationPerformedByAgent:false})}],humanInputRequests:[],unresolved:[],warnings:[],attachments:[]};
 const transport={packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce};
 // Keep the otherwise conforming response identical: only the unauthorized
 // collection is added, so the intended ownership error must be observed.
 const forged=engine.clone(envelope);forged.records.evidenceChains=[];
 const rejected=ingestion.prepare(q,{stage,text:JSON.stringify(forged),promptRecord:prompt,transport});
 assert.equal(rejected.validation.valid,false,'STAGE29_INVESTIGATION_NO_CHAIN_WRITER_ORACLE');
 assert(rejected.validation.issues.some(issue=>issue.code==='STAGE_SCOPE_VIOLATION'&&issue.path==='/records/evidenceChains'),'STAGE29_INVESTIGATION_NO_CHAIN_WRITER_ORACLE: '+JSON.stringify(rejected.validation.issues));
 assert.equal(rejected.proposal,null,'STAGE29_INVESTIGATION_NO_CHAIN_WRITER_ORACLE');
 const raw=JSON.stringify(envelope),blob=new Blob([raw],{type:'application/json'}),staged=await byteStore.stageResponseFile({jobId:q.job.JOB_ID,stage,blob,rawFilename:'response.json',promptIdentity:engine.clone(manifest.promptIdentity),...transport}),file=await byteStore.readStagedResponseFile({jobId:q.job.JOB_ID,stagingId:staged.stagingId});
 assert.equal(Buffer.from(file.bytes).toString('utf8'),raw,'STAGE29_INVESTIGATION_FILE_CUSTODY_ORACLE');assert.equal(file.sha256,hash.sha256Text(raw));
 const captured=ingestion.captureRaw(q,{stage,text:raw,promptRecord:prompt,transport:{...transport,authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,rawFilename:staged.rawFilename,mediaType:staged.mediaType,status:staged.status,promptIdentity:engine.clone(staged.promptIdentity),sha256:staged.sha256,byteSize:staged.byteSize}});
 const prepared=ingestion.prepareCaptured(captured.project,{rawResponseId:captured.rawRecord.rawResponseId});
 assert.equal(prepared.validation.valid,true,'STAGE29_INVESTIGATION_ADMISSION_ORACLE: '+JSON.stringify(prepared.validation.issues));assert.equal(prepared.proposal.status,'PENDING_OPERATOR_REVIEW');
 const beforeChains=hash.sha256Value(prepared.project.projectData.evidenceChains),beforeChanges=prepared.project.projectData.acceptedChanges.length;
 const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC_STAGE29_INVESTIGATOR',replacementConfirmation:ingestion.acceptanceImpact(prepared.project,prepared.proposal.proposalId)}),accepted=committed.project;
 assert.equal(accepted.projectData.acceptedChanges.length,beforeChanges+1,'STAGE29_INVESTIGATION_ACCEPTANCE_ORACLE');
 const record=engine.recordsForCurrentScope(accepted,'evidenceInvestigations').find(row=>row.sourceProposalId===prepared.proposal.proposalId);assert(record,'STAGE29_INVESTIGATION_ACCEPTANCE_ORACLE');
 for(const [key,value]of Object.entries(fields))assert.equal(engine.recordValue(record,key),value,'STAGE29_INVESTIGATION_RAW_SEMANTICS_ORACLE: '+key);
 assert.equal(hash.sha256Value(accepted.projectData.evidenceChains),beforeChains,'STAGE29_INVESTIGATION_NO_FALSE_COMPLETION_ORACLE');
 assert.equal(engine.gate(29,accepted).complete,false,'STAGE29_INVESTIGATION_NO_FALSE_COMPLETION_ORACLE');
 assert.equal(ingestion.findRaw(accepted,captured.rawRecord.rawResponseId).completeRawResponse,raw,'STAGE29_INVESTIGATION_RAW_RETENTION_ORACLE');
 const retry=ingestion.commit(accepted,prepared.proposal.proposalId,{operator:'SYNTHETIC_STAGE29_INVESTIGATOR'});assert.equal(retry.idempotent,true);assert.equal(hash.sha256Value(retry.project),hash.sha256Value(accepted),'STAGE29_INVESTIGATION_IDEMPOTENT_ORACLE');
 assert.equal(hash.sha256Value(project),original,'STAGE29_INVESTIGATION_DISPOSABLE_ISOLATION_ORACLE');
 return {checkId:'stage29.investigation.admission-and-authority',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:3649'],basis,boundary:'Actual generated instruction/manifest/materialized context -> stored and rehashed response Blob -> capture/prepareCaptured -> pending proposal -> operator commit -> exact retry',expected:{operation,admitted:true,retainedRawBytes:true,canonicalInvestigation:true,agentChainWriteRejected:true,stageComplete:false,idempotent:true},observed:{operation:committed.acceptedChange.operation,admitted:prepared.validation.valid,retainedRawBytes:ingestion.findRaw(accepted,captured.rawRecord.rawResponseId).completeRawResponse===raw,canonicalInvestigation:Boolean(record),agentChainWriteRejected:true,stageComplete:engine.gate(29,accepted).complete,idempotent:retry.idempotent},rawSha256:file.sha256,responseByteSize:file.byteSize,instructionSha256:manifest.instruction.sha256,contextFileCount:contextFiles.length,prior28GatesExecuted:requireCompletePrefix,actualBrowser:false,actualExternalOrPhysicalObservation:false,canonicalProjectStoreReload:false,passed:true};
}

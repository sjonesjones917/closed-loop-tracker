import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {authorizeSyntheticHandoff} from './test-handoff-authorization.mjs';
import {stage02AcceptanceFixture} from './test-fixtures.mjs';
import {stageTwoReferenceFixture,sourceRelationshipEnvelope,submitStageOneResponse as submit,acceptStageOneResponse as accept} from './test-ingestion-context-reference.mjs';

// Literal Section38 relationship cohort. Generic nested/reference shape controls
// remain in their existing owners; no production registry loop is an oracle.
export const REFERENCE_ADMISSION_SUBJECTS=Object.freeze([
 {id:'NREQ-91b12ecd1e676f563f9727f92c2825c6',family:'sourceConflicts',stage:2,targets:{SOURCE_A:'sources',SOURCE_B:'sources',BLOCKER_ID:'blockers'}},
 {id:'NREQ-632a3d45160352312edbc35a91e9c298',family:'research',stage:3,targets:{SOURCE_ID:'sources'}},
 {id:'NREQ-4d0c0bd1af08f856ccf99d450e990801',family:'candidateRequirements',stage:3,targets:{SOURCE_ID:'sources'}},
 {id:'NREQ-7e6a62b7290c8fc5d85e4abd978525f1',family:'requirements',stage:4,targets:{SOURCE_ID:'sources'},explicitOptional:'SOURCE_ID where applicable'},
 {id:'NREQ-99ed489f9c530e2af70c5cca25d3cebf',family:'tests',stage:6,targets:{REQ_ID:'requirements'}},
 {id:'NREQ-f6345fe48fc2f1c684ec22f4e19197db',family:'failureTests',stage:7,targets:{REQ_ID:'requirements',VALIDATOR_DEFECT_ID:'defects'}},
 {id:'NREQ-dffe70ed28fdfbc7a7f5437f9519aaae',family:'preflightRecords',stage:9,targets:{INSTRUCTION_ID:'instructions'}},
 {id:'NREQ-678ae34f749d687cb04fa97260f20378',family:'verification',stage:12,targets:{REQ_ID:'requirements',RUN_ID:'runs',TEST_ID:'tests',DEFECT_ID:'defects'}}
]);
const sourceFiles=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const digest=value=>createHash('sha256').update(value).digest('hex');
const sourcesFields={TITLE:'Web Content Accessibility Guidelines (WCAG) 2.2',ISSUING_ORGANIZATION_OR_AUTHOR:'World Wide Web Consortium',SOURCE_TYPE:'OFFICIAL_STANDARD',PUBLICATION_ORIGIN:'W3C Recommendation',URL_REFERENCE:'https://www.w3.org/TR/WCAG22/',PUBLICATION_UPDATE_DATE:'2024-12-12',RETRIEVAL_DATE:'2026-10-05',AUTHORITY_LEVEL:'PRIMARY TECHNICAL AUTHORITY',AUTHORITY_ROLE:'GOVERNING WHERE APPLICABLE',RELEVANCE:'Independent accessibility authority',APPLICABLE_PORTIONS:'Conformance requirements',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT SUPERSEDED',CONTROLLING_STATE:'CONTROLLING WHERE APPLICABLE',NOTES:'Synthetic reference-permission fixture'};
function protectedState(r,p){return JSON.stringify({revision:p.revision,acceptedChanges:p.projectData.acceptedChanges,sources:r.engine.records(p,'sources'),sourceConflicts:r.engine.records(p,'sourceConflicts'),research:r.engine.records(p,'research'),candidateRequirements:r.engine.records(p,'candidateRequirements')});}
function assertRejected(result,code,path,label){
 assert.equal(result.validation.valid,false,'SCHEMA_REFERENCE_ADMISSION_REJECTION_ORACLE '+label);
 assert.equal(result.proposal,null,'SCHEMA_REFERENCE_ADMISSION_NO_PROPOSAL_ORACLE '+label);
 assert.ok(result.validation.issues.some(row=>row.code===code&&row.path===path),'SCHEMA_REFERENCE_ADMISSION_DIAGNOSTIC_ORACLE '+label+': '+JSON.stringify(result.validation.issues));
}
async function stageThreeFixture(r){
 const runtime={core:r.core,schema:r.runtime.closedLoopWorkflowSchema,engine:r.engine,prompts:r.prompts,ingestion:r.ingestion};
 let p=stage02AcceptanceFixture(runtime,'SCHEMA-REFERENCE-STAGE3',{sources:[{tempKey:'prerequisite-source',fields:sourcesFields,relationships:{},evidenceRefs:['evidence-1']}]});
 assert.equal(r.engine.gate(2,p).complete,true,'SCHEMA_REFERENCE_REAL_PREFIX_ORACLE');
 p=await r.store.writeProject(p,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
 const working=r.copy(p),issued=r.prompts.reserveAndBuildPromptRecord(working,3,{operation:'COMPLETE'}).prompt;
 p=await r.store.writeProject(working,{expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 let prompt=p.projectData.generatedPrompts.find(row=>row.instructionId===issued.instructionId);({project:p,prompt}=await authorizeSyntheticHandoff(r,{project:p,prompt}));
 const pkg=await r.store.createExecutionPackage({jobId:p.job.JOB_ID,stage:3,operation:'COMPLETE',instructionId:prompt.instructionId}),manifest=r.prompts.promptFileManifest(prompt);
 assert.ok(pkg.blob.size>0,'SCHEMA_REFERENCE_ACTUAL_PACKAGE_ORACLE');
 const sourceId=r.engine.recordId(r.engine.recordsForCurrentScope(p,'sources')[0],'sources');
 assert.ok(prompt.contextManifest.readCollections.sources.some(row=>row.id===sourceId),'SCHEMA_REFERENCE_PROVIDED_SOURCE_ORACLE');
 return {p,prompt,manifest,sourceId};
}
function stageThreeEnvelope(r,f){return {schema:r.runtime.closedLoopWorkflowSchema.RESPONSE_SCHEMA,contractProfileId:r.runtime.closedLoopWorkflowSchema.CONTRACT_PROFILE_ID,jobId:f.p.job.JOB_ID,stage:3,operation:'COMPLETE',promptIdentity:f.manifest.promptIdentity,packageId:f.manifest.packageId,operationReservationId:f.manifest.operationReservationId,challengeNonce:f.manifest.challengeNonce,scope:f.manifest.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{research:[{tempKey:'named-research',fields:{PASS_NUMBER:'1',EXACT_PORTION_EXAMINED:'Conformance requirements',FINDING_CLASSIFICATION:'MANDATORY',SOURCE_EVIDENCE:'Preserved bounded synthetic authority excerpt'},relationships:{SOURCE_ID:{recordId:f.sourceId}},evidenceRefs:['reference-evidence']}],candidateRequirements:[{tempKey:'named-candidate',fields:{SOURCE_LOCATION:'Conformance requirements',CANDIDATE_OBLIGATION:'The checklist uses accessible labels.',CLASSIFICATION:'MANDATORY',APPLICABILITY:'APPLICABLE',EVIDENCE:'Preserved bounded synthetic authority excerpt'},relationships:{SOURCE_ID:{recordId:f.sourceId}},evidenceRefs:['reference-evidence']}]},evidence:[{temporaryKey:'reference-evidence',kind:'SYNTHETIC_CONTRACT_CONTROL',description:'Reference admission control',location:'response.json',content:'Synthetic production-boundary fixture; no external source search or browser observation claim.',authorityType:'AGENT_CLAIM'}],unresolved:[],warnings:[],attachments:[]};}

export async function verifySchemaReferenceAdmission({report=true,sourceOverrides={}}={}){
 const sources=Object.fromEntries(sourceFiles.map(file=>[file,sourceOverrides[file]??fs.readFileSync(file,'utf8')])),observations=[];
 const note=(caseId,observed)=>observations.push({caseId,observed,passed:true});
 const r=projectStoreRuntime({sourceOverrides:sources}),f=await stageTwoReferenceFixture(r),base=sourceRelationshipEnvelope(r,f);
 const control=r.ingestion.validateEnvelope(r.copy(f.p),r.copy(base),{stage:2,promptRecord:f.prompt,rawSha256:digest(JSON.stringify(base)),files:[]});
 assert.equal(control.valid,true,'SCHEMA_REFERENCE_SOURCE_LOCAL_CONTROL_ORACLE '+JSON.stringify(control.issues));
 note('sourceConflicts-local-source-A-B-valid-blocker-absent',{valid:true,sourceTargets:'sources',blockerAbsent:true,boundary:'actual reserved Stage02 validateEnvelope'});
 for(const field of ['SOURCE_A','SOURCE_B','BLOCKER_ID']){
  const e=r.copy(base);e.records.sourceConflicts[0].relationships[field]={tempKey:field==='BLOCKER_ID'?'declared-source':'declared-source-conflict'};
  const branch=projectStoreRuntime({sourceOverrides:sources});for(const [name,rows]of r.rows)branch.rows.set(name,new Map([...rows].map(([key,value])=>[key,branch.copy(value)])));const bf={...f,p:await branch.store.readProject(f.p.job.JOB_ID),prompt:branch.copy(f.prompt),manifest:branch.copy(f.manifest)};
  const before=protectedState(branch,bf.p),out=await submit(branch,bf,e);assertRejected(out.result,'WRONG_RELATIONSHIP_TYPE','/records/sourceConflicts/0/relationships/'+field,field+'-wrong-existing-local-family');
  const read=await branch.store.readProject(bf.p.job.JOB_ID);assert.equal(protectedState(branch,read),before,'SCHEMA_REFERENCE_REJECTION_PRESERVATION_ORACLE');assert.equal(branch.ingestion.findRaw(read,out.rawResponseId).completeRawResponse,out.text);assert.ok(read.projectData.responseValidations.at(-1).issues.some(row=>row.code==='WRONG_RELATIONSHIP_TYPE'));
  note('sourceConflicts-'+field+'-wrong-existing-local-family',{rejected:true,code:'WRONG_RELATIONSHIP_TYPE',rawExactAfterReload:true,protectedCanonicalUnchanged:true,boundary:'reserved response file staging/capture/admission/operational save/read'});
 }
 // The resolved conflict control omits its optional blocker relationship. This
 // does not authorize a null/NONE reference or turn an unresolved carrier key
 // into a canonical blocker target. BLOCKED is a separate controlled event.
 for(const [caseId,reference,code]of [
  ['blocker-explicit-null',null,'PROHIBITED_NULL'],
  ['blocker-NONE-string','NONE','WRONG_VALUE_TYPE'],
  ['blocker-NONE-canonical-id',{recordId:'NONE'},'UNRESOLVED_RELATIONSHIP'],
  ['blocker-unresolved-carrier-temp',{tempKey:'reported-unresolved'},'UNRESOLVED_RELATIONSHIP']
 ]){
  const branch=projectStoreRuntime({sourceOverrides:sources});for(const [name,rows]of r.rows)branch.rows.set(name,new Map([...rows].map(([key,value])=>[key,branch.copy(value)])));const bf={...f,p:await branch.store.readProject(f.p.job.JOB_ID),prompt:branch.copy(f.prompt),manifest:branch.copy(f.manifest)},e=branch.copy(base);
  e.records.sourceConflicts[0].relationships.BLOCKER_ID=reference;
  if(caseId==='blocker-unresolved-carrier-temp')e.unresolved=[{temporaryKey:'reported-unresolved',kind:'UNRESOLVED_CONFLICT',description:'Preserved nonblocking synthetic correspondence note.',whyBlocking:'This resolved correspondence is not a blocking finding.',affectedStageFields:[],affectedRecords:['sourceConflicts'],blocking:false}];
  const before=protectedState(branch,bf.p),out=await submit(branch,bf,e);assertRejected(out.result,code,'/records/sourceConflicts/0/relationships/BLOCKER_ID',caseId);
  const read=await branch.store.readProject(f.p.job.JOB_ID);assert.equal(protectedState(branch,read),before,'SCHEMA_REFERENCE_OPTIONAL_REJECTION_PRESERVATION_ORACLE');assert.equal(branch.ingestion.findRaw(read,out.rawResponseId).completeRawResponse,out.text);
  note('sourceConflicts-'+caseId,{rejected:true,code,rawExactAfterReload:true,protectedCanonicalUnchanged:true,unresolvedCarrierPresent:caseId==='blocker-unresolved-carrier-temp',boundary:'optional absent versus supplied typed-reference semantics at reserved file admission/save/read'});
 }
 // A family-only omission leaves the original absent-target rejection intact.
 // Prove the new existing-wrong-family case reaches the intended local guard.
 const guard='else if(target.collection!==expectedCollection)issues.push';
 assert.equal(sources['response-ingestion.js'].split(guard).length,2,'SCHEMA_REFERENCE_FAMILY_GUARD_ANCHOR_ORACLE');
 const wrongLocal=r.copy(base);wrongLocal.records.sourceConflicts[0].relationships.SOURCE_B={tempKey:'declared-source-conflict'};
 try{
  createVerifierRuntime.loadScript(r.runtime,sources['response-ingestion.js'].replace(guard,'else if(false)issues.push'),{filename:'response-ingestion.js:private-family-guard-omission'});
  const fault=r.runtime.closedLoopResponseIngestion.validateEnvelope(r.copy(f.p),r.copy(wrongLocal),{stage:2,promptRecord:f.prompt,rawSha256:digest(JSON.stringify(wrongLocal)),files:[]});
  assert.equal(fault.valid,true,'SCHEMA_REFERENCE_FAMILY_GUARD_CONTROLLED_FALSE_VALIDATION_ORACLE '+JSON.stringify(fault.issues));
  // Only the family guard changes; the same genuine current reservation and
  // otherwise conforming source response remain valid.
  assert.equal(fault.issues.some(row=>row.code==='WRONG_RELATIONSHIP_TYPE'),false,'SCHEMA_REFERENCE_FAMILY_GUARD_OMISSION_REACHED_ORACLE');
 }finally{createVerifierRuntime.loadScript(r.runtime,sources['response-ingestion.js'],{filename:'response-ingestion.js:family-guard-restored'});}
 note('sourceConflicts-source-B-family-only-omission-reached',{intendedWrongFamilyDiagnosticRemoved:true,controlledFalseValidationObserved:true,boundary:'isolated validator source fault; no faulty canonical acceptance claim'});
 const valid=await submit(r,f,base);assert.equal(valid.result.validation.valid,true,'SCHEMA_REFERENCE_SOURCE_FILE_CONTROL_ORACLE '+JSON.stringify(valid.result.validation.issues));
 const accepted=await accept(r,valid.p,valid.result.proposal.proposalId,2),sourceId=valid.result.proposal.tempToCanonical['declared-source'].id,conflict=accepted.projectData.sourceConflicts.find(row=>row.rawResponseId===valid.rawResponseId);
 assert.equal(conflict.relationships.SOURCE_A,sourceId);assert.equal(conflict.relationships.SOURCE_B,sourceId);assert.equal(conflict.fields.SOURCE_A,sourceId);assert.equal(conflict.fields.SOURCE_B,sourceId);
 note('sourceConflicts-valid-local-source-references-committed-reload',{sourceId,referenceA:conflict.relationships.SOURCE_A,referenceB:conflict.relationships.SOURCE_B,typedStrings:true,actualOperatorAcceptance:true,storeIntegrity:true});
 const rr=projectStoreRuntime({sourceOverrides:sources}),ff=await stageThreeFixture(rr),current=stageThreeEnvelope(rr,ff);
 const wrongCanonicalId=rr.engine.recordId(rr.engine.records(ff.p,'sourceSearchContracts')[0],'sourceSearchContracts');
 assert.ok(wrongCanonicalId,'SCHEMA_REFERENCE_EXISTING_WRONG_CANONICAL_FAMILY_ORACLE');
 for(const family of ['research','candidateRequirements'])for(const kind of ['local-wrong-family','canonical-wrong-family']){
  const branch=projectStoreRuntime({sourceOverrides:sources});for(const [name,rows]of rr.rows)branch.rows.set(name,new Map([...rows].map(([key,value])=>[key,branch.copy(value)])));const bf={...ff,p:await branch.store.readProject(ff.p.job.JOB_ID),prompt:branch.copy(ff.prompt),manifest:branch.copy(ff.manifest)},e=branch.copy(current);
  e.records[family][0].relationships.SOURCE_ID=kind==='local-wrong-family'?{tempKey:family==='research'?'named-candidate':'named-research'}:{recordId:wrongCanonicalId};
  const code=kind==='local-wrong-family'?'WRONG_RELATIONSHIP_TYPE':'UNRESOLVED_RELATIONSHIP',before=protectedState(branch,bf.p),out=await submit(branch,bf,e);
  assertRejected(out.result,code,'/records/'+family+'/0/relationships/SOURCE_ID',family+'-'+kind);
  const read=await branch.store.readProject(ff.p.job.JOB_ID);assert.equal(protectedState(branch,read),before,'SCHEMA_REFERENCE_STAGE3_REJECTION_PRESERVATION_ORACLE');assert.equal(branch.ingestion.findRaw(read,out.rawResponseId).completeRawResponse,out.text);
  note(family+'-'+kind,{rejected:true,targetActuallyExists:true,code,rawExactAfterReload:true,protectedCanonicalUnchanged:true,boundary:'reserved response file staging/capture/admission/operational save/read'});
 }
 const good=await submit(rr,ff,current);
 assert.equal(good.result.validation.valid,true,'SCHEMA_REFERENCE_STAGE3_CURRENT_SOURCE_ORACLE '+JSON.stringify(good.result.validation.issues));
 const saved=await accept(rr,good.p,good.result.proposal.proposalId,3);
 for(const family of ['research','candidateRequirements']){const row=saved.projectData[family].find(item=>item.rawResponseId===good.rawResponseId);assert.equal(row.relationships.SOURCE_ID,ff.sourceId);assert.equal(row.fields.SOURCE_ID,ff.sourceId);note(family+'-provided-current-source-committed-reload',{sourceId:ff.sourceId,typedStrings:true,actualOperatorAcceptance:true,storeIntegrity:true});}
 const result={schemaReferenceAdmission:true,checkId:'schema.reference-admission',synthetic:true,actualBrowser:false,wholeClausePASS:false,subjects:REFERENCE_ADMISSION_SUBJECTS,observations,sourceHashes:Object.fromEntries(Object.entries(sources).map(([file,source])=>[file,digest(source)])),limits:'Exact Stage02 local source and wrong-local-family controls, and Stage03 provided-current source acceptance under the production transaction adapter. Later-stage family permission/currentness/optional/commit boundaries remain separate; generic malformed reference controls are reused from existing owners.'};
 if(report)console.log(JSON.stringify(result));return result;
}
if(import.meta.url===pathToFileURL(process.argv[1]).href)await verifySchemaReferenceAdmission();

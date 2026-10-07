import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {storedArtifactBody,projectStoreRuntime} from './test-project-store-runtime.mjs';
import {authorizeSyntheticHandoff} from './test-handoff-authorization.mjs';
import {readStoreArchive} from './test-zip.mjs';
import {stage01AcceptanceFixture,stage04AcceptanceFixture,acceptPrerequisite,boundedSearchProposal} from './test-fixtures.mjs';
import {verifyBlindHandoffDisclosure} from './test-handoff-blind-export.mjs';
import {verifyHandoffOperationEffects,verifyHandoffMaterialAuthority,verifySuppliedInputWithdrawal,verifyHandoffProducerEpochCompatibility,verifyHandoffReferenceSelection,verifyReservedHandoffTargetScopes,verifyHandoffDeterministicDataRendering} from './test-handoff-policy.mjs';
import {runVerifier,assertDetectedFault} from './verify-conformance-regressions.mjs';

const sourceNames=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const sources=Object.fromEntries(sourceNames.map(name=>[name,fs.readFileSync(name,'utf8')]));
const fault=process.argv.find(arg=>arg.startsWith('--fault='))?.slice(8);
if(fault){
 const replacements={authorization:["  if(!authorization.allowed){",'  if(false){'],scan:["  return {credentialSecretDetected:findings.length>0,findings};","  return {credentialSecretDetected:false,findings:[]};"]};
 const pair=replacements[fault];assert(pair&&sources['project-store.js'].includes(pair[0]),'Unknown disclosure mutation or missing exact owner');sources['project-store.js']=sources['project-store.js'].replace(...pair);
}
const cases=[],observations=[];
async function fixture({classification='UNKNOWN',bytes=Buffer.from('SYNTHETIC_HARMLESS_INPUT\n'),objective='Inspect the supplied harmless synthetic fixture.',inlineInputText=null,overrides={}}={}){
 const r=projectStoreRuntime({sourceOverrides:{...sources,...overrides}});let project=await r.store.createProject({commandId:'SYNTHETIC-DISCLOSURE'});const revision=project.revision,hash=r.runtime.closedLoopHash,filename='synthetic-input.bin',blob=new Blob([bytes],{type:'application/octet-stream'}),sha256=await hash.sha256Bytes(blob);
 project.job.EXACT_USER_OBJECTIVE_VERBATIM=objective;
 const artifactId=r.engine.allocateId(project,'artifacts',{commandId:'SYNTHETIC-INPUT',targetSlot:'input',payload:r.copy({filename,sha256,byteSize:blob.size})}),lineage=r.copy({stage:1,role:'STAGE_ARTIFACT'});
 await r.store.putArtifact({artifactId,jobId:project.job.JOB_ID,blob,filename,mediaType:'application/octet-stream',lineage});
 const record=r.engine.registerArtifactBytes(project,{stage:1,artifactId,filename,mediaType:'application/octet-stream',byteSize:blob.size,sha256,lineage});
 // Classification is an explicit application-owned fixture input. The tests
 // exercise real stored bytes/export, not an unimplemented classification UI.
 record.fields.DISCLOSURE_CLASSIFICATION=record.DISCLOSURE_CLASSIFICATION=classification;r.engine.refreshRecordHashes(record,'artifacts');
 project.stages[1].authorizedFiles.push(r.copy({artifactId,name:filename,type:'application/octet-stream',size:blob.size,sha256,stage:'STAGE 01',retainedBytes:true}));
 project.projectData.userEntered.suppliedArtifactFiles||=r.copy({});project.projectData.userEntered.suppliedArtifactFiles[artifactId]=r.copy({artifactId,filename,mediaType:'application/octet-stream',byteSize:blob.size,sha256});
 if(inlineInputText!==null){project.projectData.userEntered.suppliedArtifactText||=r.copy({});project.projectData.userEntered.suppliedArtifactText[artifactId]=r.copy({artifactId,filename,mediaType:'application/octet-stream',byteSize:blob.size,sha256,text:inlineInputText});}
 r.engine.recalculate(project);const issued=r.prompts.reserveAndBuildPromptRecord(project,1,{operation:'COMPLETE'},{owningTabInstance:'SYNTHETIC-DISCLOSURE'}).prompt;
 project=await r.store.writeProject(project,{expectedProjectRevision:revision});const prompt=project.projectData.generatedPrompts.find(row=>row.instructionId===issued.instructionId);
 return {r,project,prompt,artifactId,bytes,request:{project,stage:1,operation:'COMPLETE',instructionId:prompt.instructionId}};
}
for(const classification of ['PUBLIC','UNKNOWN','RESTRICTED','CREDENTIAL_SECRET']){
 const f=await fixture({classification}),before=f.project.projectSha256,review=await f.r.store.prepareExecutionPackageReview(f.request);
 assert(review.members.every(member=>!Object.hasOwn(member,'blob')),'DISCLOSURE_REVIEW_BYTES_ORACLE');assert.equal(review.authorization.allowed,false);
 const code=classification==='CREDENTIAL_SECRET'?'HANDOFF_CREDENTIAL_SECRET_BLOCKED':'HANDOFF_AUTHORIZATION_REQUIRED';
 for(const operation of [()=>f.r.store.createExecutionPackage(f.request),()=>f.r.store.readAuthorizedHandoffMember({...f.request,canonicalPath:'instruction.txt'}),()=>f.r.store.readAuthorizedHandoffMember({...f.request,canonicalPath:`artifacts/${f.artifactId}/synthetic-input.bin`})])await assert.rejects(operation,error=>error.code===code,'DISCLOSURE_UNAUTHORIZED_BYTES_ORACLE');
 assert.equal((await f.r.store.readProject(f.project.job.JOB_ID)).projectSha256,before,'DISCLOSURE_READ_ONLY_REJECTION_ORACLE');
 if(classification==='CREDENTIAL_SECRET')assert.throws(()=>f.r.engine.recordHandoffAuthorization(f.project,{promptRecord:f.prompt,members:f.r.copy(review.members),scan:f.r.copy(review.scan),purpose:'DISCLOSURE_AUTHORIZATION',recipient:'Synthetic actor',provider:'Synthetic verifier',suitabilityBasis:'Fixture only',operatorLabel:'SYNTHETIC_OPERATOR',confirmed:true}),/CREDENTIAL_SECRET/,'DISCLOSURE_SECRET_NONOVERRIDE_ORACLE');
 else{
  const allowed=await authorizeSyntheticHandoff(f.r,{project:f.project,prompt:f.prompt}),zip=await f.r.store.createExecutionPackage(allowed.request),members=readStoreArchive(new Uint8Array(await zip.blob.arrayBuffer()));
  assert(Buffer.from(members.find(row=>row.canonicalPath===`artifacts/${f.artifactId}/synthetic-input.bin`).bytes).equals(f.bytes),'DISCLOSURE_EXACT_BYTES_ORACLE');
  const instruction=await f.r.store.readAuthorizedHandoffMember({...allowed.request,canonicalPath:'instruction.txt'});assert.equal(await instruction.blob.text(),allowed.prompt.prompt);
  await assert.rejects(()=>f.r.store.readAuthorizedHandoffMember({...allowed.request,canonicalPath:'not-authorized.txt'}),error=>error.code==='HANDOFF_MEMBER_NOT_AUTHORIZED');
  assert.equal(zip.manifest.handoff.promptArtifactId,allowed.prompt.instructionId);assert.deepEqual(Array.from(zip.manifest.handoff.disclosureAuthorizationIds),allowed.decisionIds);
  assert(!JSON.stringify(zip.manifest).includes('subjectSha256'),'DISCLOSURE_PRIVATE_SUBJECT_ORACLE');
  const next=f.r.copy(allowed.project);next.job.EXACT_USER_OBJECTIVE_VERBATIM+=' Materially changed objective.';f.r.engine.recalculate(next);let saved=await f.r.store.writeProject(next,{expectedProjectRevision:allowed.project.revision,expectedStateSha256:allowed.project.projectSha256});const revision=saved.revision,newPrompt=f.r.prompts.reserveAndBuildPromptRecord(saved,1,{operation:'COMPLETE'}).prompt;saved=await f.r.store.writeProject(saved,{expectedProjectRevision:revision});
  await assert.rejects(()=>f.r.store.createExecutionPackage({project:saved,stage:1,operation:'COMPLETE',instructionId:newPrompt.instructionId}),error=>error.code==='HANDOFF_AUTHORIZATION_REQUIRED','DISCLOSURE_CHANGED_MATERIAL_ORACLE');
 }
 cases.push('classification-'+classification.toLowerCase());
}
const capturedText='Only harmless synthetic classified source bytes. '.repeat(2000),inherited=await fixture({classification:'CREDENTIAL_SECRET',bytes:Buffer.from(capturedText),inlineInputText:capturedText}),inheritedReview=await inherited.r.store.prepareExecutionPackageReview(inherited.request);
for(const authority of ['APPLICATION_INSTRUCTION','APPLICATION_CONTEXT','APPLICATION_MANIFEST']){const member=inheritedReview.members.find(row=>row.authority===authority);assert(member,'DISCLOSURE_INHERITED_CLASSIFICATION_FIXTURE_ORACLE');assert.equal(member.disclosureClassification,'CREDENTIAL_SECRET','DISCLOSURE_INHERITED_CLASSIFICATION_ORACLE');}
await assert.rejects(()=>inherited.r.store.createExecutionPackage(inherited.request),error=>error.code==='HANDOFF_CREDENTIAL_SECRET_BLOCKED');cases.push('known-secret-inline-source-carrier-inheritance');

// Independent literals, not answers generated from the production registry.
const markerKinds=['PRIVATE KEY','ENCRYPTED PRIVATE KEY','RSA PRIVATE KEY','EC PRIVATE KEY','DSA PRIVATE KEY','OPENSSH PRIVATE KEY'];
for(const encoding of ['ascii','utf16le','utf16be']){
 const prefix=Buffer.alloc(65530,0x2e),parts=[prefix],expected=[];let offset=prefix.length;
 for(const kind of markerKinds){const marker='-----BEGIN '+kind+'-----',raw=Buffer.from(marker,encoding==='ascii'?'utf8':'utf16le');if(encoding==='utf16be')raw.swap16();expected.push({ruleId:'PRIVATE_KEY_BOUNDARY_'+kind.replaceAll(' ','_'),offset});parts.push(raw,Buffer.from([0,1,2]));offset+=raw.length+3;}
 const f=await fixture({bytes:Buffer.concat(parts)}),review=await f.r.store.prepareExecutionPackageReview(f.request),path=`artifacts/${f.artifactId}/synthetic-input.bin`,observed=review.scan.findings.filter(row=>row.canonicalPath===path).map(({ruleId,offset})=>({ruleId,offset}));
 assert.deepEqual(JSON.parse(JSON.stringify(observed)),expected,'DISCLOSURE_ACTUAL_BYTE_SCAN_ORACLE');assert.equal(review.authorization.inspectionRequired,true);
 assert(!JSON.stringify(review.scan).includes('-----BEGIN'),'DISCLOSURE_DIAGNOSTIC_PRIVACY_ORACLE');
 assert.throws(()=>f.r.engine.recordHandoffAuthorization(f.project,{promptRecord:f.prompt,members:f.r.copy(review.members),scan:f.r.copy(review.scan),purpose:'DISCLOSURE_AUTHORIZATION',recipient:'Synthetic actor',provider:'Synthetic fixture',suitabilityBasis:'Harmless fixture',operatorLabel:'SYNTHETIC_OPERATOR',confirmed:true}),/inspection/,'DISCLOSURE_MARKER_INSPECTION_ORACLE');
 const allowed=await authorizeSyntheticHandoff(f.r,{project:f.project,prompt:f.prompt,scanInspection:{classification:'NOT_A_CREDENTIAL',basis:'This test constructed only published marker delimiters surrounded by fixed filler bytes; it contains no credential key body.'}}),zip=await f.r.store.createExecutionPackage(allowed.request);
 assert(Buffer.from(readStoreArchive(new Uint8Array(await zip.blob.arrayBuffer())).find(row=>row.canonicalPath===path).bytes).equals(f.bytes));
 observations.push({encoding,findings:expected.length,crossChunkFirstOffset:expected[0].offset,exactBytes:true});cases.push('actual-byte-markers-'+encoding);
}
const context=await fixture({objective:'Synthetic context '.repeat(5000)+'-----BEGIN PRIVATE KEY-----'}),contextReview=await context.r.store.prepareExecutionPackageReview(context.request);
assert(contextReview.members.some(row=>row.canonicalPath==='context.json'),'DISCLOSURE_CONTEXT_FIXTURE_ORACLE');assert(contextReview.scan.findings.some(row=>row.canonicalPath==='context.json'),'DISCLOSURE_CONTEXT_SCAN_ORACLE');
await assert.rejects(()=>context.r.store.readAuthorizedHandoffMember({...context.request,canonicalPath:'context.json'}),error=>error.code==='HANDOFF_AUTHORIZATION_REQUIRED');
const contextAllowed=await authorizeSyntheticHandoff(context.r,{project:context.project,prompt:context.prompt,scanInspection:{classification:'NOT_A_CREDENTIAL',basis:'The entire synthetic objective contains repeated fixed text and only a public marker delimiter; no key body.'}});
const contextFile=await context.r.store.readAuthorizedHandoffMember({...contextAllowed.request,canonicalPath:'context.json'});assert.equal(await context.r.runtime.closedLoopHash.sha256Bytes(contextFile.blob),contextFile.sha256);
// A prior successful read cannot authorize changed stored bytes or metadata.
// Every new read must observe the exact returned row and its immutable Blob.
const contextRow=context.r.rows.get('artifacts').get(contextFile.artifactId),originalContextRow=context.r.copy(contextRow),contextBody=storedArtifactBody(context.r,contextFile.artifactId),originalContextBlob=contextBody.blob;
for(const [name,change]of [['blob',row=>{row.blob=new Blob([new Uint8Array(row.blob.size)]);}],['digest',row=>{row.sha256='0'.repeat(64);}],['foreign-job',row=>{row.jobId='FOREIGN-SYNTHETIC-JOB';}]]){const bad=context.r.copy(originalContextRow);contextBody.blob=originalContextBlob;if(name==='blob')change(contextBody);else change(bad);context.r.rows.get('artifacts').set(contextFile.artifactId,bad);await assert.rejects(()=>context.r.store.readPromptContextFile(contextAllowed.prompt,contextAllowed.project.job.JOB_ID),error=>error.code==='PROMPT_CONTEXT_INTEGRITY_FAILED','DISCLOSURE_CONTEXT_READ_OBSERVATION_ORACLE: '+name);}
// Metadata size disagreement invalidates observation reuse. The existing reader
// may still independently rehash exact bytes against the authoritative context.
contextBody.blob=originalContextBlob;context.r.rows.get('artifacts').set(contextFile.artifactId,context.r.copy({...originalContextRow,byteSize:originalContextRow.byteSize+1}));
const nativeContextRead=Blob.prototype.arrayBuffer;let contextReadBytes=0;Blob.prototype.arrayBuffer=function(){contextReadBytes+=this.size;return nativeContextRead.call(this);};let sizeReverified;try{sizeReverified=await context.r.store.readPromptContextFile(contextAllowed.prompt,contextAllowed.project.job.JOB_ID);}finally{Blob.prototype.arrayBuffer=nativeContextRead;}
assert.equal(sizeReverified.byteSize,contextFile.byteSize);assert.ok(contextReadBytes>=contextFile.byteSize*2,'DISCLOSURE_CONTEXT_CHANGED_SIZE_REHASH_ORACLE');
context.r.rows.get('artifacts').set(contextFile.artifactId,context.r.copy(originalContextRow));contextBody.blob=new Blob([originalContextBlob]);const observedAgain=await context.r.store.readPromptContextFile(contextAllowed.prompt,contextAllowed.project.job.JOB_ID);assert.equal(await observedAgain.blob.text(),await contextFile.blob.text(),'DISCLOSURE_CONTEXT_READ_OBSERVATION_CONTROL');cases.push('attached-context-byte-scan-and-guard');

const inline=await fixture({objective:'Explain this synthetic documentation delimiter: -----BEGIN PRIVATE KEY-----'}),inlineReview=await inline.r.store.prepareExecutionPackageReview(inline.request);
assert(inlineReview.scan.findings.some(row=>row.canonicalPath==='instruction.txt'),'DISCLOSURE_INSTRUCTION_SCAN_ORACLE');
const inlineAllowed=await authorizeSyntheticHandoff(inline.r,{project:inline.project,prompt:inline.prompt,scanInspection:{classification:'NOT_A_CREDENTIAL',basis:'The only marker in this synthetic instruction is a public delimiter quoted as task data; no private key body exists.'}});
await inline.r.store.createExecutionPackage(inlineAllowed.request);cases.push('instruction-byte-scan-stable-inspection-after-save');

// Recipient text only enters the final manifest, after its initial assessment.
// Its newly observed marker must not escape under an earlier clean review.
const manifestOnly=await fixture(),initialReview=await manifestOnly.r.store.prepareExecutionPackageReview(manifestOnly.request);
assert.equal(initialReview.scan.findings.length,0);let manifestProject=manifestOnly.project,manifestPrompt=manifestOnly.prompt;
async function saveManifestDecision(review,inspection=null){
 const next=manifestOnly.r.copy(manifestProject);manifestOnly.r.engine.recordHandoffAuthorization(next,{promptRecord:manifestPrompt,members:manifestOnly.r.copy(review.members),scan:manifestOnly.r.copy(review.scan),purpose:'DISCLOSURE_AUTHORIZATION',recipient:'Synthetic documentation example -----BEGIN PRIVATE KEY-----',provider:'Isolated fixture provider',suitabilityBasis:'Only synthetic fixture data is used.',operatorLabel:'SYNTHETIC_OPERATOR',confirmed:true,...(inspection?{scanInspection:inspection}:{})});
 let saved=await manifestOnly.r.store.writeProject(next,{expectedProjectRevision:manifestProject.revision,expectedStateSha256:manifestProject.projectSha256});const revision=saved.revision,issued=manifestOnly.r.prompts.reserveAndBuildPromptRecord(saved,1,{operation:'COMPLETE'}).prompt;manifestProject=await manifestOnly.r.store.writeProject(saved,{expectedProjectRevision:revision});manifestPrompt=manifestProject.projectData.generatedPrompts.find(row=>row.instructionId===issued.instructionId);
 return {project:manifestProject,stage:1,operation:'COMPLETE',instructionId:manifestPrompt.instructionId};
}
let manifestRequest=await saveManifestDecision(initialReview);const flaggedManifest=await manifestOnly.r.store.prepareExecutionPackageReview(manifestRequest);
assert(flaggedManifest.scan.findings.some(row=>row.canonicalPath==='manifest.json'),'DISCLOSURE_FINAL_MANIFEST_SCAN_ORACLE');assert.equal(flaggedManifest.authorization.allowed,false);
await assert.rejects(()=>manifestOnly.r.store.createExecutionPackage(manifestRequest),error=>error.code==='HANDOFF_AUTHORIZATION_REQUIRED');
manifestRequest=await saveManifestDecision(flaggedManifest,{classification:'NOT_A_CREDENTIAL',basis:'The recipient label is a synthetic documentation example with a public delimiter and no credential body.'});const manifestPackage=await manifestOnly.r.store.createExecutionPackage(manifestRequest);assert.equal(manifestPackage.manifest.handoff.recipient,'Synthetic documentation example -----BEGIN PRIVATE KEY-----');cases.push('final-manifest-new-marker-block-and-inspected-control');

// The fixture establishes its first three gates through actual acceptance;
// no predecessor gate is forced. A fresh registered independent reviewer must
// keep its actor and unchanged material when only consent/save identity changes.
const reviewer=projectStoreRuntime({sourceOverrides:sources}),reviewRuntime={...reviewer,schema:reviewer.runtime.closedLoopWorkflowSchema};
let reviewerProject=await reviewer.store.writeProject(stage04AcceptanceFixture(reviewRuntime,'SYNTHETIC-REVIEW-DISCLOSURE'),{expectedProjectRevision:0,incrementRevision:false,createOnly:true});
const reviewerRevision=reviewerProject.revision,reviewerPrompt=reviewer.prompts.reserveAndBuildPromptRecord(reviewerProject,2,{operation:'SEARCH_ADEQUACY_REVIEW'}).prompt;reviewerProject=await reviewer.store.writeProject(reviewerProject,{expectedProjectRevision:reviewerRevision});
const reviewerAllowed=await authorizeSyntheticHandoff(reviewer,{project:reviewerProject,prompt:reviewerPrompt});
assert.equal(reviewerAllowed.prompt.contextManifest.semanticReviewBinding.reviewerContextId,reviewerPrompt.contextManifest.semanticReviewBinding.reviewerContextId,'DISCLOSURE_REVIEWER_CONTEXT_ORACLE');
assert.equal(reviewerAllowed.prompt.contextManifest.semanticReviewBinding.authorContextId,reviewerPrompt.contextManifest.semanticReviewBinding.authorContextId);await reviewer.store.createExecutionPackage(reviewerAllowed.request);cases.push('registered-independent-reviewer-authorization-save');

// Readiness discovery is itself a guarded disclosure, and must remain possible
// before the requested external capability has been established.
const capability=projectStoreRuntime({sourceOverrides:sources}),capRuntime={...capability,schema:capability.runtime.closedLoopWorkflowSchema};
let capProject=stage01AcceptanceFixture(capRuntime,'SYNTHETIC-CAPABILITY-DISCLOSURE');capProject=acceptPrerequisite(capRuntime,capProject,2,{stageData:{AUTHORITY_HIERARCHY:'Closed synthetic fixture.',SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE',KNOWN_CONTROLLING_SOURCES_EXAMINED:'No live external authority is claimed.'},records:{sourceSearchContracts:[boundedSearchProposal(capRuntime.schema)]}}).project;
capProject=await capability.store.writeProject(capProject,{expectedProjectRevision:0,incrementRevision:false,createOnly:true});assert.equal(capability.engine.gate(2,capProject).complete,false);assert.equal(capability.engine.records(capProject,'externalCapabilities').length,0);
const capTarget=capability.engine.recordId(capability.engine.recordsForCurrentScope(capProject,'sourceSearchContracts').at(-1),'sourceSearchContracts'),capReview=await capability.store.prepareCapabilityRequestReview({project:capProject,targetId:capTarget});assert.equal(capReview.authorization.blocked,false);assert(capReview.members.every(row=>!Object.hasOwn(row,'blob')));
await assert.rejects(()=>capability.store.readAuthorizedCapabilityRequest({project:capProject,targetId:capTarget}),error=>error.code==='HANDOFF_AUTHORIZATION_REQUIRED','DISCLOSURE_CAPABILITY_GUARD_ORACLE');
const capNext=capability.copy(capProject);capability.engine.recordHandoffAuthorization(capNext,{capabilityRequest:capability.copy(capReview.capabilityRequest),members:capability.copy(capReview.members),scan:capability.copy(capReview.scan),purpose:'DISCLOSURE_AUTHORIZATION',recipient:'Synthetic capability respondent',provider:'Isolated verifier',suitabilityBasis:'Only the declared synthetic readiness inquiry is shared.',operatorLabel:'SYNTHETIC_OPERATOR',confirmed:true});capProject=await capability.store.writeProject(capNext,{expectedProjectRevision:capProject.revision,expectedStateSha256:capProject.projectSha256});
const capabilityFile=await capability.store.readAuthorizedCapabilityRequest({project:capProject,targetId:capTarget}),capText=await capabilityFile.blob.text();assert.equal(capText,capability.engine.capabilityReadinessHandoff(capProject,capTarget).text);assert.equal(capabilityFile.sha256,capability.runtime.closedLoopHash.sha256Text(capText));assert.equal(JSON.parse(capText).reportTemplate.request.sourceSearchContractId,capTarget);assert.equal(capability.engine.gate(2,capProject).complete,false,'DISCLOSURE_READINESS_INQUIRY_NOT_EXECUTION_ORACLE');
await assert.rejects(()=>capability.store.readAuthorizedCapabilityRequest({project:capProject,targetId:'FOREIGN-CAPABILITY-TARGET'}),/Select a current/);
const changed=capability.copy(capProject);changed.job.EXPLICIT_USER_REQUIREMENTS='Changed synthetic project input';capability.engine.recordHumanInputVersion(changed,['EXPLICIT_USER_REQUIREMENTS'],'SYNTHETIC_OPERATOR');const impact=capability.store.mutationImpact(capProject,changed),changedProject=await capability.store.writeProject(changed,{expectedProjectRevision:capProject.revision,expectedStateSha256:capProject.projectSha256,mutationConfirmation:impact});await assert.rejects(()=>capability.store.readAuthorizedCapabilityRequest({project:changedProject,targetId:capTarget}),/Select a current|authorize/,'DISCLOSURE_CAPABILITY_CHANGED_INPUT_ORACLE');cases.push('capability-readiness-inquiry-guard-and-valid-control');

// Interleave an actual ordinary save at the two asynchronous export boundaries.
for(const boundary of ['before-review-return','after-archive']){
 const anchor=boundary==='before-review-return'?'  const currentProject=await readProject(canonicalJobId);':'  const afterArchive=await readProject(canonicalJobId);';assert(sources['project-store.js'].includes(anchor));
 const f=await fixture({overrides:{'project-store.js':sources['project-store.js'].replace(anchor,"  await globalThis.__syntheticHandoffInterleave?.();\n"+anchor)}}),allowed=await authorizeSyntheticHandoff(f.r,{project:f.project,prompt:f.prompt});
 let committed=null;f.r.runtime.__syntheticHandoffInterleave=async()=>{delete f.r.runtime.__syntheticHandoffInterleave;const next=f.r.copy(allowed.project);next.job.JOB_TITLE='Concurrent synthetic save';committed=await f.r.store.writeProject(next,{expectedProjectRevision:allowed.project.revision,expectedStateSha256:allowed.project.projectSha256});};
 await assert.rejects(()=>f.r.store.createExecutionPackage(allowed.request),error=>error.code==='EXECUTION_PACKAGE_VERSION_STALE','DISCLOSURE_CONCURRENT_STATE_ORACLE');assert(committed);assert.equal((await f.r.store.readProject(committed.job.JOB_ID)).projectSha256,committed.projectSha256);cases.push('concurrent-save-'+boundary);
}
const blindExport=await verifyBlindHandoffDisclosure({sourceOverrides:sources});cases.push('retained-blind-comparison-actual-zip-privacy');
const handoffPolicyObservations=[];for(const verify of [verifyHandoffOperationEffects,verifyHandoffMaterialAuthority,verifySuppliedInputWithdrawal])handoffPolicyObservations.push(await verify(projectStoreRuntime({sourceOverrides:sources})));
handoffPolicyObservations.push(await verifyHandoffProducerEpochCompatibility(),await verifyHandoffReferenceSelection(),await verifyReservedHandoffTargetScopes(),await verifyHandoffDeterministicDataRendering());
const faults=[];if(!fault)for(const [id,oracle]of [['authorization','DISCLOSURE_UNAUTHORIZED_BYTES_ORACLE'],['scan','DISCLOSURE_ACTUAL_BYTE_SCAN_ORACLE']]){const run=await runVerifier(process.execPath,['verify-handoff-disclosure.mjs','--fault='+id],{encoding:'utf8',maxBuffer:8*1024*1024});assertDetectedFault(run,oracle,'Undetected handoff implementation fault: '+id);assert((run.stdout+run.stderr).includes(oracle),'The handoff fault failed for an unrelated reason.');faults.push({id,oracle,status:run.status,result:'DETECTED'});}
console.log(JSON.stringify({handoffDisclosure:'PASS',synthetic:true,actualBrowser:false,externalTransferPerformed:false,cases,observations,blindExport,handoffPolicyObservations,faults,restoredImplementation:'PASS_CURRENT_PARENT_SOURCE',scanCoverage:{literalEncodings:['ASCII/UTF-8','UTF-16LE','UTF-16BE'],binary:'Literal marker bytes only; no compressed/container format decoding.',chunkBytes:65536,cleanScanEstablishesClassification:false},sourceHashes:Object.fromEntries(Object.entries(sources).map(([name,text])=>[name,createHash('sha256').update(text).digest('hex')]))},null,2));

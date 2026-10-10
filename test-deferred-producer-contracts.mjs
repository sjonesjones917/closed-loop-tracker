import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {projectStoreRuntime,bindAcceptanceUi} from './test-project-store-runtime.mjs';
import {authorizeFixtureHandoff,deferredDefinitionRestorationFixture,deferredReviewedPrerequisiteFixture,deferredDefinitionAdmissionFixture,deferredFailureExecutionResponseFixture} from './test-fixtures.mjs';
import {readStoreArchive} from './test-zip.mjs';

// These cases exercise the actual producer, saved instruction and ZIP boundary.
// Later-stage prerequisite flags are an explicit synthetic prompt projection;
// they are not evidence that the preceding stages ran or could complete.
const prerequisiteProjection=";(()=>{const e=globalThis.closedLoopWorkflowEngine;globalThis.closedLoopWorkflowEngine=Object.freeze({...e,recalculate(p,options){const out=e.recalculate(p,options),stage=globalThis.__syntheticProducerPriorStage;if(Number.isInteger(stage)&&stage>=8&&stage<30){p.stages[stage].status='COMPLETE';p.stages[stage].gate={complete:true,blocked:false,reasons:[]};}return out;}});})();";
function producerRuntime({sourceOverrides={}}={}){const source=sourceOverrides['workflow-engine.js']??fs.readFileSync('workflow-engine.js','utf8');return projectStoreRuntime({sourceOverrides:{...sourceOverrides,'workflow-engine.js':source+prerequisiteProjection}});}
const expectedOperations=[...Array.from({length:23},(_,i)=>({stage:i+8,operation:'EXECUTE_FAILURE_TEST',family:'failureTests'})),...Array.from({length:15},(_,i)=>({stage:i+16,operation:'EXECUTE_REGRESSION',family:'regressions'}))];
const ordinarySentinels={8:'Complete only when one coherent current production instruction',9:'Complete only after an independent reviewer has reviewed every material clause',10:'Complete only when the human has selected the authorized candidate components',11:'This response is for exactly one application-reserved run lane',12:'Verify only the application-listed missing REQ_ID × RUN_ID × TEST_ID cells',13:'Compare all ten executions. Never discard a run.',14:'Root-cause every current material defect supplied',15:'Convert every confirmed current defect into a permanent regression definition',16:'Correct the root cause only at the earliest defective layer',17:'Perform only the named Stage 17 operation for the new corrected ten-run iteration',18:'Evaluate convergence only from the latest completed current iteration',19:'Perform only the named unchanged-confirmation operation on an unchanged converged candidate',20:'Freeze the production baseline only after the supplied unchanged-confirmation evidence',21:'Generate the complete approved deliverable.',22:'Handle only deterministic verification of the current finished product',23:'Perform only independent meaning-based verification for the exact current Stage 23',24:'Perform independent adversarial verification only.',25:'Inspect only the exact final representations, views, transformations',26:'Reconcile process evidence and product evidence only.',27:'Review the complete current release evidence only.',28:'No external agent operation is required for the authoritative byte-identity decision.',29:'Agent investigation may locate missing evidence only.',30:'Preserve failures permanently only.'};

function packageCarrierContract(r,packet,{stage,operation,family}){
 const oracle='DEFERRED_PRODUCER_OPERATION_ORACLE: '+stage+':'+operation, {prompt,manifest,members,instruction}=packet,s=r.runtime.closedLoopWorkflowSchema,h=r.runtime.closedLoopHash;
 assert.equal(instruction,prompt.prompt,oracle);assert.equal(manifest.instructionFullTextSha256,h.sha256Text(instruction),oracle);
 assert(instruction.includes('Perform only the selected conditional execution operation now.'),oracle+' task');
 assert(instruction.includes('You are the isolated deferred-test executor. Perform only this operation'),oracle+' role');
 assert.equal(prompt.role,'isolated deferred-test executor',oracle+' metadata role');
 assert(instruction.includes('OPERATION COMPLETION BOUNDARY'),oracle+' completion');
 assert(instruction.includes('Acceptance of this receipt does not complete the ordinary stage'),oracle+' stage separation');
 assert(!instruction.includes(ordinarySentinels[stage]),oracle+' ordinary stage directive leaked');
 if(stage===8)assert(!instruction.includes('Author the production instruction only.'),oracle+' ordinary author procedure leaked');
 for(const clause of ['First do the stage work completely.','until the current stage is semantically complete.','When the stage is ready, create exactly','Perform the complete current stage and current operation now','every required stage obligation has actually been performed','STAGE COMPLETION BOUNDARY'])assert(!instruction.includes(clause),oracle+' shared stage directive leaked: '+clause);
 assert(instruction.includes('Return exactly one regressionExecutions record'),oracle+' exact receipt');
 assert(instruction.includes(family==='failureTests'?'FAILURE_VALIDATION is SATISFIED only':'Execute only the bound PRE_CORRECTION or POST_CORRECTION phase'),oracle+' family semantics');
 const descriptor=manifest.responseContract;assert.deepEqual(r.copy(descriptor.agentWritableCollections),r.copy(['regressionExecutions']),oracle);assert.deepEqual(r.copy(descriptor.agentStageFields),r.copy([]),oracle);
 assert.deepEqual(r.copy(descriptor.deferredExecutionEvidenceContract),r.copy(s.DEFERRED_EXECUTION_EVIDENCE),oracle);
 assert.equal(descriptor.returnedFilePolicy.role,'SUPPORTING_EVIDENCE','DEFERRED_PRODUCER_FILE_POLICY_ORACLE: '+stage);assert.equal(descriptor.returnedFilePolicy.requiredFileCount,0,'DEFERRED_PRODUCER_FILE_POLICY_ORACLE: '+stage);
 assert(manifest.attachmentSlots.length>1,oracle);assert(manifest.attachmentSlots.every(slot=>['STRUCTURED_RESPONSE','SUPPORTING_EVIDENCE'].includes(slot.role)),oracle+' unrelated output slot');assert.equal(manifest.attachmentSlots.filter(slot=>slot.required).length,1,oracle+' only response slot always required');
 assert(!instruction.includes('A successful response requires its first FINISHED_PRODUCT slot.'),oracle+' unrelated output instruction');
 const blocks=[];for(const match of instruction.matchAll(/BEGIN_UNTRUSTED_DATA_BLOCK\s*([\s\S]*?)\s*END_UNTRUSTED_DATA_BLOCK/g))blocks.push(JSON.parse(match[1]));
 for(const file of manifest.contextFiles){const member=members.find(row=>row.canonicalPath===file.path);assert(member,oracle+' context bytes');const text=Buffer.from(member.bytes).toString('utf8');assert.equal(h.sha256Text(text),file.sha256,oracle+' context identity');blocks.push(...JSON.parse(text).members);}
 const binding=manifest.deferredExecutionBinding;assert(binding,oracle+' exact binding in actual manifest');assert.deepEqual(r.copy(binding),r.copy(prompt.contextManifest.deferredExecutionBinding),oracle+' bound manifest context');assert.equal(binding.projectRevision,manifest.scope.projectRevision,oracle+' current transport revision');
 const materialBlocks=blocks.filter(block=>block.sourceIdentity==='APPLICATION_DEFERRED_EXECUTION_MATERIAL');assert.equal(materialBlocks.length,1,oracle+' selected logical binding carrier');const material=JSON.parse(materialBlocks[0].value),{projectRevision,...expectedMaterial}=binding;assert.deepEqual(r.copy(material),r.copy(expectedMaterial),oracle+' exact material except owned transport revision');assert(!Object.hasOwn(material,'projectRevision'),oracle+' transport revision must not churn material authorization');assert(instruction.includes('manifest.deferredExecutionBinding'),oracle+' actor must echo the complete actual manifest binding');
 const collection=key=>{const block=blocks.find(row=>row.sourceIdentity==='collection.'+key);assert(block,oracle+' required collection '+key);return JSON.parse(block.value).records;};
 assert.deepEqual(collection(family).map(row=>row.id),[binding.subjectId],oracle+' exact definition');assert.deepEqual(collection('tests').map(row=>row.id),[binding.testId],oracle+' reviewed test');
 assert(collection('requirements').some(row=>row.id===binding.requirementId||row.id===collection(family)[0].fields.REQ_ID),oracle+' governing requirement');
 assert.equal(binding.fixture,'VERIFIED',oracle+' exact preserved fixture');
 for(const expected of prompt.contextManifest.executionHandoff.send){const artifact=manifest.artifacts.find(row=>row.artifactId===expected.artifactId),member=members.find(row=>row.canonicalPath.startsWith('artifacts/'+expected.artifactId+'/'));assert(artifact&&member,oracle+' declared bytes');assert.equal(member.bytes.length,expected.byteSize,oracle+' exact byte size');}
 for(const label of ({11:['outputs from other runs','reviewer feedback'],12:['other verifiers’ determinations','root-cause analysis'],23:['Stage 21 generator correctness claims','adversarial findings'],24:['generator reasoning or self-evaluation','prior reviewer conclusions that tell the adversarial reviewer what to find']}[stage]||[]))assert(prompt.contextManifest.executionHandoff.withhold.some(row=>row.artifactIdOrCategory===label),oracle+' isolation policy '+label);
 return {operationId:stage+':'+operation,stage,family,actualSavedZip:true,packageSha256:packet.packageSha256,instructionSha256:prompt.bodySha256,bindingSubjectId:binding.subjectId,bindingTestId:binding.testId,contextFiles:manifest.contextFiles.length,fixturePreserved:true,operationOnlyInstructions:true,receiptOnlyContract:true,supportingEvidenceSlotsOnly:true,roleIsolationRetained:true,syntheticPrerequisiteProjection:stage!==8,priorStageExecutionClaimed:false,...(stage!==8?{prerequisiteProjection:{stage:stage-1,fields:['status','gate'],sourceOverride:prerequisiteProjection}}:{}),stageCompletionClaimed:false};
}

async function buildPacket(r,p,stage,operation,{projectPrerequisite=false}={}){
 r.runtime.__syntheticProducerPriorStage=projectPrerequisite?stage-1:null;
 let saved=await r.store.readProject(p.job.JOB_ID)||await r.store.writeProject(p,{createOnly:true,expectedProjectRevision:0}),draft=r.copy(saved);draft.activeStage=stage;
 if(projectPrerequisite){draft.stages[stage-1].status='COMPLETE';draft.stages[stage-1].gate=r.copy({complete:true,blocked:false,reasons:[]});}
 const issued=r.prompts.reserveAndBuildPromptRecord(draft,stage,{operation}).prompt;saved=await r.store.writeProject(draft,{expectedProjectRevision:saved.revision,expectedStateSha256:saved.projectSha256});
 const authorized=await authorizeFixtureHandoff(r,{project:saved,prompt:saved.projectData.generatedPrompts.find(row=>row.instructionId===issued.instructionId)});saved=authorized.project;const prompt=authorized.prompt,pkg=await r.store.createExecutionPackage(authorized.request),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),manifest=JSON.parse(Buffer.from(members.find(row=>row.canonicalPath==='manifest.json').bytes)),instruction=Buffer.from(members.find(row=>row.canonicalPath==='instruction.txt').bytes).toString('utf8');
 return {prompt,manifest,members,instruction,packageSha256:await r.runtime.closedLoopHash.sha256Bytes(pkg.blob)};
}

export async function verifyDeferredByteCarrierContracts(){
 const r=producerRuntime(),e=r.engine,h=r.runtime.closedLoopHash,prefix=deferredReviewedPrerequisiteFixture(r,'nativeStage7'),instant=prefix.archivedFixtureClockUtc;
 assert.equal(new Date(instant).toISOString(),instant);r.runtime.Date=class extends Date{constructor(...args){super(...(args.length?args:[instant]));}static now(){return Date.parse(instant);}};
 const native=e.recordsForCurrentScope(prefix.project,'tests').find(row=>row.temporaryKey==='compat-due-native-failureTests'),fixtureArtifactId=e.recordValue(native,'EXECUTABLE_INPUT_BINDINGS').FIXTURE.artifactId;
 const admitted=await deferredDefinitionAdmissionFixture(r,{prefix,family:'failureTests',testKey:'compat-due-external-failureTests',fixtureArtifactId}),observations=[];
 for(const stage of [23,24]){
  const packet=await buildPacket(r,admitted.p,stage,'EXECUTE_FAILURE_TEST',{projectPrerequisite:true}),{prompt,manifest,members}=packet,binding=prompt.contextManifest.deferredExecutionBinding,selected=e.currentDeferredExecution(await r.store.readProject(admitted.p.job.JOB_ID),stage,'EXECUTE_FAILURE_TEST');
  assert.deepEqual([...selected.fixtureArtifactIds],[fixtureArtifactId],'DEFERRED_REQUIRED_FIXTURE_SELECTION_ORACLE');assert.equal(binding.compatibilityBinding.fixture.artifactId,fixtureArtifactId);
  const declared=manifest.artifacts.find(row=>row.artifactId===fixtureArtifactId),member=members.find(row=>row.canonicalPath.startsWith('artifacts/'+fixtureArtifactId+'/'));
  assert(declared&&member,'DEFERRED_REQUIRED_FIXTURE_BYTES_ORACLE: '+stage+' exact selected fixture was omitted from the exported package');assert.equal(Buffer.from(member.bytes).toString('utf8'),'VERIFIED');assert.equal(member.bytes.length,8);assert.equal(await h.sha256Bytes(new Blob([member.bytes])),declared.sha256);assert.equal(manifest.handoff.send.filter(row=>row.artifactId===fixtureArtifactId).length,1);
  const current=await r.store.readProject(admitted.p.job.JOB_ID),foreignArtifact=r.copy({id:'SYNTHETIC-UNAUTHORIZED-ARTIFACT',stage:6,fields:{ARTIFACT_ID:'SYNTHETIC-UNAUTHORIZED-ARTIFACT',ROLE:'SOURCE_MATERIAL'}});
  // Consumer-only hostile input; never inserted into canonical state. This
  // negative must execute even when the real fixture has just one artifact.
  assert.equal(r.prompts.contextContentAuthorization(current,{stage,operation:'EXECUTE_FAILURE_TEST',family:'artifacts',record:foreignArtifact}).allowed,false,'DEFERRED_REQUIRED_FIXTURE_AUTHORITY_ORACLE');
  for(const family of ['deterministicResults','meaningResults','adversarialResults','rawResponses'])assert.equal(r.prompts.contextContentAuthorization(current,{stage,operation:'EXECUTE_FAILURE_TEST',family,record:r.copy({id:'UNAUTHORIZED-PRIOR-CONCLUSION',stage:22,fields:{CONTENT:'Unsupported prior pass conclusion'}})}).allowed,false,'DEFERRED_REQUIRED_FIXTURE_INDEPENDENCE_ORACLE: '+family);
  observations.push({stage,operation:'EXECUTE_FAILURE_TEST',packageSha256:packet.packageSha256,instructionSha256:prompt.bodySha256,fixtureArtifactId,actualBytes:8,byteIdentityVerified:true,unrelatedArtifactWithheld:true,priorConclusionsWithheld:true,syntheticPrerequisiteProjection:true});
 }
 return {case:'CONDITIONAL_REQUIRED_FIXTURE_BYTES',passed:true,observations,actualDefinitionFileAdmission:true,actualSavedZip:true,synthetic:true,actualBrowser:false,realExternalActor:false,boundary:'Actual reviewed Stage7 precursor and file/operator/store author admission of a byte-backed definition; explicit synthetic Stage23/24 prerequisite projection isolates actual ZIP export. Exact declared fixture bytes are required; unrelated prior conclusions remain withheld. No full Stage23/24 completion claimed.'};
}

async function conditionalCase(spec,sourceOverrides={}){
 const r=producerRuntime({sourceOverrides}),{p}=await deferredDefinitionRestorationFixture(r,{family:spec.family,executionStage:spec.stage});
 if(spec.stage===8)for(let prior=1;prior<=7;prior++)assert.equal(r.engine.gate(prior,p).complete,true,'DEFERRED_PRODUCER_GENUINE_PREFIX_ORACLE');
 return packageCarrierContract(r,await buildPacket(r,p,spec.stage,spec.operation,{projectPrerequisite:spec.stage!==8}),spec);
}

export async function verifyDeferredHandoffMaterialContract(){return conditionalCase(expectedOperations[0]);}

export async function verifyDeferredFeedbackScope(){
 const r=producerRuntime(),{p}=await deferredDefinitionRestorationFixture(r,{family:'failureTests',executionStage:8}),projected=r.copy(p);
 // This is a consumer-only projection of an accepted receipt's still-incomplete
 // ordinary stage, not an accepted-change or persistence fixture.
 projected.projectData.acceptedChanges.push(r.copy({stage:8,status:'COMMITTED',responseType:'DATA_PROPOSAL',operation:'EXECUTE_FAILURE_TEST'}));
 projected.stages[8].gate=r.copy({complete:false,blocked:false,reasons:['SYNTHETIC_ORDINARY_INSTRUCTION_STILL_REQUIRED']});
 const context=r.prompts.contextFor(8,projected,'EXECUTE_FAILURE_TEST',r.prompts.scopeFor(8,projected,{},'EXECUTE_FAILURE_TEST'));
 assert(context.includes('SYNTHETIC_ORDINARY_INSTRUCTION_STILL_REQUIRED'),'DEFERRED_FEEDBACK_SCOPE_ORACLE: contextual gate facts lost');
 assert(context.includes('CURRENT STAGE STATUS — COMPLETE ONLY THE BOUND EXECUTION; OTHER STAGE WORK REMAINS APPLICATION-ROUTED'),'DEFERRED_FEEDBACK_SCOPE_ORACLE: missing operation boundary');
 assert(!context.includes('CURRENT STAGE FINDINGS — RESOLVE THROUGH THIS OPERATION'),'DEFERRED_FEEDBACK_SCOPE_ORACLE: unrelated ordinary work requested');
 const ordinary=r.prompts.contextFor(8,projected,'COMPLETE',r.prompts.scopeFor(8,projected,{},'COMPLETE'));assert(ordinary.includes('CURRENT STAGE FINDINGS — RESOLVE THROUGH THIS OPERATION'),'DEFERRED_FEEDBACK_SCOPE_ORACLE: ordinary correction guidance lost');
 return {case:'CONDITIONAL_FEEDBACK_SCOPE',passed:true,ordinaryGateFactsRetained:true,unrelatedWorkNotRequested:true,ordinaryAuthorGuidanceRetained:true,syntheticConsumerProjection:true,actualAcceptanceClaimed:false};
}

export async function verifyDeferredProducerContracts(){
 const source=fs.readFileSync('prompt-engine.js','utf8'),r=producerRuntime(),registered=Object.values(r.runtime.closedLoopWorkflowSchema.STAGE_OPERATION_REGISTRY).filter(row=>row.deferredSubjectFamily).map(row=>row.stage+':'+row.operation).sort();
 assert.deepEqual(registered,expectedOperations.map(row=>row.stage+':'+row.operation).sort(),'DEFERRED_PRODUCER_REGISTRY_POPULATION_ORACLE');
 const feedbackScope=await verifyDeferredFeedbackScope(),independentRetry=await verifyDeferredIndependentRetryContracts(),negatives=[];
 for(const [name,spec,anchor,replacement,oracle]of [
  ['ordinary-stage-procedure',expectedOperations[0],'if(deferred)return deferred;','if(false&&deferred)return deferred;','DEFERRED_PRODUCER_OPERATION_ORACLE'],
  ['ordinary-stage21-output-slot',expectedOperations.find(row=>row.stage===21),'product=!deferred&&Number(stage)===21','product=Number(stage)===21','DEFERRED_PRODUCER_FILE_POLICY_ORACLE']
 ]){assert.equal(source.split(anchor).length,2);let caught;try{await conditionalCase(spec,{'prompt-engine.js':source.replace(anchor,replacement)});}catch(error){caught=error;}assert(caught?.message.includes(oracle),'DEFERRED_PRODUCER_MUTANT_OWNER_ORACLE: '+name+' '+caught?.stack);negatives.push({name,intendedFailure:true,message:caught.message});}
 const observations=[];for(const spec of expectedOperations)observations.push(await conditionalCase(spec));
 const ordinary=producerRuntime(),{p}=await deferredDefinitionRestorationFixture(ordinary,{family:'failureTests',executionStage:8}),control=await buildPacket(ordinary,p,8,'COMPLETE');assert(control.instruction.includes(ordinarySentinels[8]),'DEFERRED_PRODUCER_ORDINARY_CONTROL_ORACLE');assert(!control.instruction.includes('OPERATION COMPLETION BOUNDARY'));assert(control.manifest.responseContract.agentWritableCollections.includes('instructions'));
 const ordinaryPolicies=[[11,'EXECUTE_RUN','RUN_OUTPUT',0],[21,'COMPLETE','FINISHED_PRODUCT',1]].map(([stage,operation,role,required])=>{const policy=ordinary.prompts.responseContractDescriptor(stage,operation).returnedFilePolicy;assert.equal(policy.role,role);assert.equal(policy.requiredFileCount,required);return {stage,operation,role,requiredFileCount:required};});
 return {case:'CONDITIONAL_OPERATION_PRODUCER_CONTRACTS',passed:true,expectedOperations:38,observedOperations:observations.length,observations,negatives,feedbackScope,independentRetry,ordinaryStage8SavedZip:true,ordinaryPolicies,synthetic:true,actualBrowser:false,realExternalActor:false,boundary:'Actual production reserve/build, saved canonical instruction, createExecutionPackage and every extracted instruction/manifest/context carrier. Stage8 uses genuinely completed archived synthetic predecessors. Later stages explicitly project prerequisite status only to isolate the producer; those flags prove no preceding execution, admission, stage completion or release.'};
}

// An independent test retry must retain recoverable work in storage while
// withholding earlier conclusions in every exported carrier. These are actual
// rejected/accepted file journeys; the executor observations remain synthetic.
async function deferredReviewRetryJourney({accepted=false,sourceOverrides={}}={}){
 const r=producerRuntime({sourceOverrides}),e=r.engine,i=r.ingestion,{p:initial}=await deferredDefinitionRestorationFixture(r,{family:'failureTests'});
 let packet=await buildPacket(r,initial,8,'EXECUTE_FAILURE_TEST'),p=await r.store.readProject(initial.job.JOB_ID);
 const {prompt,manifest}=packet,marker=accepted?'PRIOR_ACCEPTED_UNDETERMINED_REVIEW_CONCLUSION':'PRIOR_REJECTED_REVIEW_CONCLUSION',draft=r.copy(p),files=[];
 const response=await deferredFailureExecutionResponseFixture({schema:r.runtime.closedLoopWorkflowSchema,hash:r.runtime.closedLoopHash},manifest,prompt.contextManifest.deferredExecutionBinding),envelope=response.envelope;
 envelope.records.regressionExecutions[0].fields.RESULT='UNDETERMINED';envelope.records.regressionExecutions[0].notes=marker;
 const report=JSON.parse(envelope.evidence[0].content);report.result='UNDETERMINED';report.observedResult=marker;envelope.evidence[0].content=JSON.stringify(report);
 let artifactId=null,artifactText=null;
 if(accepted){
  const slot=manifest.attachmentSlots.find(row=>row.role==='SUPPORTING_EVIDENCE');artifactText=JSON.stringify({synthetic:true,observation:marker});
  const blob=new Blob([artifactText],{type:'application/json'}),sha256=await r.runtime.closedLoopHash.sha256Bytes(blob),attachment=envelope.attachments[0];Object.assign(attachment,{byteSize:blob.size,sha256});
  artifactId=e.allocateId(draft,'artifacts',r.copy({targetSlot:slot.attachmentSlotId,payload:{stage:8,filename:attachment.filename,mediaType:'application/json',byteSize:blob.size,sha256}}));
  const stored=await r.store.putArtifact({artifactId,jobId:p.job.JOB_ID,blob,filename:attachment.filename,mediaType:'application/json',expectedSha256:sha256});
  files.push({artifactId,name:stored.filename,type:stored.mediaType,size:stored.byteSize,sha256:stored.sha256,attachmentSlotId:slot.attachmentSlotId});
 }else{
  // A producer type error is rejected before any canonical receipt exists.
  envelope.records.regressionExecutions[0].fields.PHASE=false;delete envelope.evidence[0].attachmentRef;envelope.attachments=[];
 }
 const text=JSON.stringify(envelope),staged=await r.store.stageResponseFile({jobId:p.job.JOB_ID,stage:8,blob:new Blob([text],{type:'application/json'}),rawFilename:'response.json',mediaType:'application/json',promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce}),file=await r.store.readStagedResponseFile({jobId:p.job.JOB_ID,stagingId:staged.stagingId});
 const captured=i.captureRaw(draft,{stage:8,text,promptRecord:prompt,files:r.copy(files),transport:r.copy({authority:'AUTHORITATIVE_RESPONSE_FILE',stagingId:staged.stagingId,status:file.status,sha256:file.sha256,byteSize:file.byteSize,promptIdentity:manifest.promptIdentity,packageId:manifest.packageId,operationReservationId:manifest.operationReservationId,challengeNonce:manifest.challengeNonce})}),prepared=i.prepareCaptured(captured.project,{rawResponseId:captured.rawRecord.rawResponseId,promptRecord:prompt,expectedCommittedRevision:p.revision});
 assert.equal(prepared.validation.valid,accepted,'DEFERRED_REVIEW_RETRY_SETUP_ORACLE: '+JSON.stringify(prepared.validation.issues));
 if(!accepted)assert(prepared.validation.issues.some(row=>row.code==='WRONG_VALUE_TYPE'),'DEFERRED_REVIEW_RETRY_SETUP_ORACLE: intended rejection missing');
 p=await r.store.writeProject(prepared.project,{operational:true,expectedProjectRevision:p.revision,expectedStateSha256:p.projectSha256});
 if(accepted){const failures=bindAcceptanceUi(r,p,prepared.proposal.proposalId);await r.runtime.accept();if(r.runtime.replacementReview)await r.runtime.confirm();assert.equal(failures.length,0,'DEFERRED_REVIEW_RETRY_SETUP_ORACLE: operator acceptance');p=await r.store.readProject(p.job.JOB_ID);assert.equal(e.currentDeferredExecution(p,8,'EXECUTE_FAILURE_TEST').completed,false,'DEFERRED_REVIEW_RETRY_SETUP_ORACLE: unknown became complete');}
 packet=await buildPacket(r,p,8,'EXECUTE_FAILURE_TEST');p=await r.store.readProject(p.job.JOB_ID);
 return {r,p,packet,marker,rawId:captured.rawRecord.rawResponseId,text,artifactId,artifactText,accepted};
}

function independentRetryOracle(fixture){
 const {r,p,packet,marker,rawId,text,artifactId,artifactText,accepted}=fixture,oracle='DEFERRED_INDEPENDENT_RETRY_CARRIER_ORACLE';
 assert.deepEqual(packet.members.filter(row=>Buffer.from(row.bytes).toString('utf8').includes(marker)).map(row=>row.canonicalPath),[],oracle+': prior conclusion in exported member');
 assert.equal(JSON.stringify(packet.prompt.contextManifest).includes(marker),false,oracle+': metadata');
 assert.deepEqual(r.copy(packet.manifest.retryInputs),r.copy([]),oracle+': retry manifest');
 assert.deepEqual(r.copy(packet.prompt.contextManifest.retryAttemptInputs),r.copy([]),oracle+': retry identity metadata');
 assert.equal(packet.prompt.contextManifest.readCollections.regressionExecutions?.length||0,0,oracle+': canonical prior receipts');
 assert.equal(r.ingestion.findRaw(p,rawId).completeRawResponse,text,oracle+': lost retained raw');
 assert(packet.instruction.includes('Use a fresh independent reviewer conversation'),oracle+': no recovery route');
 assert(packet.instruction.includes('a new package identity or an instruction to ignore exposed content does not restore independence'),oracle+': misleading exposure recovery');
 if(!accepted)assert(packet.instruction.includes('WRONG_VALUE_TYPE'),oracle+': actionable protocol diagnostic lost');
 const selected=r.engine.currentDeferredExecution(p,8,'EXECUTE_FAILURE_TEST');assert.equal(selected.completed,false,oracle+': incomplete work falsely completed');
 assert(packet.prompt.contextManifest.readCollections.tests.some(row=>row.id===selected.testId),oracle+': exact governing test lost');
 if(accepted){
  const receipt=r.engine.records(p,'regressionExecutions').find(row=>row.rawResponseId===rawId),evidence=r.engine.records(p,'evidenceRecords').find(row=>row.rawResponseId===rawId),artifact=r.engine.records(p,'artifacts').find(row=>row.id===artifactId);assert(receipt&&evidence&&artifact,oracle+': actual accepted provenance missing');
  for(const [family,record]of [['regressionExecutions',receipt],['evidenceRecords',evidence],['artifacts',artifact]])assert.equal(r.prompts.contextContentAuthorization(p,{stage:8,operation:'EXECUTE_FAILURE_TEST',family,record}).allowed,false,oracle+': supporting carrier '+family);
  assert(!packet.manifest.artifacts.some(row=>row.artifactId===artifactId),oracle+': prior returned file exported');
 }
 return {case:accepted?'accepted-undetermined':'rejected-wrong-type',actualSavedZip:true,actualResponseFile:true,operatorAccepted:accepted,promptEngineVersion:packet.prompt.promptEngineVersion,priorReviewContentWithheld:true,allExportedMembersInspected:true,retainedRawPreserved:true,retainedArtifactPreserved:!!artifactText,protocolDiagnosticsPreserved:!accepted,requiresFreshConversation:true,selectedWorkStillIncomplete:true,packageSha256:packet.packageSha256};
}

export async function verifyDeferredIndependentRetryContracts(){
 const source=fs.readFileSync('prompt-engine.js','utf8'),rawAnchor='deferred?independentDeferred:number===12',canonicalAnchor='if(independentDeferred){';
 assert.equal(source.split(rawAnchor).length,2);assert.equal(source.split(canonicalAnchor).length,2);
 // Restore precisely the old stage-only raw guard and the previous unrestricted
 // canonical carrier policy. No stage prerequisite or unrelated failure changes.
 let caught;try{independentRetryOracle(await deferredReviewRetryJourney({sourceOverrides:{'prompt-engine.js':source.replace(rawAnchor,'deferred?false:number===12').replace(canonicalAnchor,'if(false&&independentDeferred){')}}));}catch(error){caught=error;}
 assert(caught?.message.includes('DEFERRED_INDEPENDENT_RETRY_CARRIER_ORACLE'),'DEFERRED_INDEPENDENT_RETRY_MUTANT_ORACLE: '+caught?.stack);
 const rejected=await deferredReviewRetryJourney(),observations=[independentRetryOracle(rejected)];
 caught=null;try{independentRetryOracle(await deferredReviewRetryJourney({accepted:true,sourceOverrides:{'prompt-engine.js':source.replace(canonicalAnchor,'if(false&&independentDeferred){')}}));}catch(error){caught=error;}
 assert(caught?.message.includes('DEFERRED_INDEPENDENT_RETRY_CARRIER_ORACLE'),'DEFERRED_INDEPENDENT_RETRY_CANONICAL_MUTANT_ORACLE: '+caught?.stack);
 const accepted=await deferredReviewRetryJourney({accepted:true});observations.push(independentRetryOracle(accepted));
 assert.equal(await (await accepted.r.store.getArtifact(accepted.artifactId,{jobId:accepted.p.job.JOB_ID})).blob.text(),accepted.artifactText,'DEFERRED_INDEPENDENT_RETRY_STORED_BYTES_ORACLE');
 // Consumer-only route projection: the real retained fixture is an independently
 // reviewed route. This checks the opposite shared-policy branch without
 // inventing a canonical tool test, capability report, or tool execution.
 const r=rejected.r,owner=r.runtime.closedLoopWorkflowEngine,projected=item=>({...item,route:{...item.route,executionMode:'EXTERNAL_AGENT_TOOL'}});
 r.runtime.closedLoopWorkflowEngine=Object.freeze({...owner,currentDeferredExecution:(...args)=>projected(owner.currentDeferredExecution(...args)),deferredExecutionPlan:(...args)=>{const plan=owner.deferredExecutionPlan(...args);return {...plan,pending:plan.pending.map(projected)};}});
 vm.runInContext(source,r.runtime,{filename:'prompt-engine.js:declared-route-consumer-projection'});
 const producer=r.runtime.closedLoopPromptEngine,raw=r.ingestion.findRaw(rejected.p,rejected.rawId);
 for(const stage of [8,12])assert.equal(producer.contextContentAuthorization(rejected.p,{stage,operation:'EXECUTE_FAILURE_TEST',family:'rawResponses',record:raw,purpose:'RETRY_SUBSTANCE'}).allowed,true,'DEFERRED_TOOL_PRIOR_WORK_CONTROL_ORACLE: '+stage);
 assert.equal(producer.deferredExecutionContextPolicy(rejected.p,8,'EXECUTE_FAILURE_TEST').requiresFreshConversation,false,'DEFERRED_TOOL_PRIOR_WORK_CONTROL_ORACLE');
 assert.equal(producer.contextContentAuthorization(rejected.p,{stage:12,operation:'VERIFY',family:'rawResponses',record:raw,purpose:'RETRY_SUBSTANCE'}).allowed,false,'DEFERRED_ORDINARY_REVIEW_ISOLATION_CONTROL_ORACLE');
 return {case:'CONDITIONAL_INDEPENDENT_RETRY_CONTEXT',passed:true,observations,intendedRawLeakDetected:true,intendedCanonicalLeakDetected:true,toolPriorWorkAllowed:true,toolControlBoundary:'Synthetic selected-route policy consumer only; no canonical test/capability mutation or tool execution claimed.',ordinaryVerifierWithholdPreserved:true,synthetic:true,actualBrowser:false,actualExternalActor:false,boundary:'Actual saved instruction/ZIP, response-file capture, wrong-type rejection or accepted UNDETERMINED receipt via operator persistence, and replacement ZIP. Every exported member and metadata carrier checked; original raw/returned bytes retained. Fresh external conversation is instructed, never claimed observed.'};
}

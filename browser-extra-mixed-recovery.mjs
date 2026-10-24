// Test-only, serializable browser helpers. Fixture construction uses the actual
// reservation, file-staging, ingestion, acceptance, deletion and History owners.
// No helper changes production startup or substitutes its native read observer.
// Bounded source-bearing prefix using existing accepted Stage01/02 owners and
// the registered source-linked research shape exercised by Stage03 protocol
// controls. This declares a hermetic fixture, never live external research.
export function buildSourceBearingStage04Fixture(runtime,jobId,stage02Fixture,makeRecord,acceptStage){
 const {engine,schema}=runtime,hash=globalThis.closedLoopHash;
 const text='Controlled source copy: required verified checklist content.\né🙂 SOURCE-TAIL\n',sourceFile={filename:'mixed-controlled-source.txt',mediaType:'text/plain',text,sha256:hash.sha256Text(text),byteSize:new TextEncoder().encode(text).byteLength};
 const source=makeRecord(schema,'sources',{tempKey:'mixed-controlled-source',overrides:{TITLE:'Controlled source',ISSUING_ORGANIZATION_OR_AUTHOR:'Independent synthetic fixture authority',SOURCE_TYPE:'OFFICIAL_STANDARD',PUBLICATION_ORIGIN:'Independent synthetic fixture publication',URL_REFERENCE:'https://example.invalid/stage03-controlled-source',AUTHORITY_LEVEL:'PRIMARY',AUTHORITY_ROLE:'GOVERNING',RELEVANCE:'Supplies the controlled Stage03 source relationship.',APPLICABLE_PORTIONS:'Complete controlled source',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT_SUPERSEDED',CONTROLLING_STATE:'CONTROLLING'}});
 let project=stage02Fixture(runtime,jobId,{sources:[source]});
 const sources=engine.recordsForCurrentScope(project,'sources');if(sources.length!==1)throw new Error('MIXED_SOURCE_PREFIX: one actually accepted source is required.');
 const sourceId=engine.recordId(sources[0],'sources'),research={tempKey:'mixed-source-research',fields:{PASS_NUMBER:'2',EXACT_PORTION_EXAMINED:'Complete controlled source',FINDING_CLASSIFICATION:'SECOND_COMPLETE_PASS_SATURATED',SOURCE_EVIDENCE:'Controlled source evidence',SATURATION_STATUS:'SATURATED'},relationships:{SOURCE_ID:{recordId:sourceId}},evidenceRefs:['evidence-1']};
 project=acceptStage(runtime,project,3,{stageData:{EXCEPTIONS_AND_EDGE_CONDITIONS:'NONE',CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE',RESEARCH_GAPS_AND_BLOCKERS:'NONE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false},records:{research:[research]}}).project;
 for(let stage=1;stage<=3;stage++)if(!engine.gate(stage,project).complete)throw new Error('MIXED_SOURCE_PREFIX: prerequisite '+stage+' did not complete.');
 if(engine.recordsForCurrentScope(project,'research').length!==1)throw new Error('MIXED_SOURCE_PREFIX: source-linked research is required.');
 project.activeStage=4;project.activeView='Workflow';return {project,sourceFile};
}

export async function prepareMixedRecoveryFixture(makeStage04Fixture,makeStage04Envelope,makeAcceptedStage04Fixture){
 const store=globalThis.closedLoopProjectStore,engine=globalThis.closedLoopWorkflowEngine;
 const runtime={core:globalThis.closedLoopCore,schema:globalThis.closedLoopWorkflowSchema,engine,prompts:globalThis.closedLoopPromptEngine,ingestion:globalThis.closedLoopResponseIngestion};
 const controls={accepted:'MIXED-RECOVERY-ACCEPTED-STAGE04',pending:'MIXED-RECOVERY-PENDING-STAGE04',removed:'MIXED-RECOVERY-REMOVED'},suppressedOwnerId='JOB-20260823144121',staging=[];
 const assert=(condition,label)=>{if(!condition)throw new Error('MIXED_RECOVERY_FIXTURE: '+label);};
 const bootstrap=await store.readProject(suppressedOwnerId);
 if(bootstrap)await store.removeProject(suppressedOwnerId,{expectedProjectRevision:bootstrap.revision,suppressRetainedProject:true,idempotencyKey:'BROWSER-EXTRA-MIXED-BOOTSTRAP-REMOVAL'});
 assert(await store.metaGet('retainedProjectSuppressed'),'bootstrap removal must retain suppression');
 assert(await store.readProject(suppressedOwnerId)===null,'bootstrap owner must be absent before seeding');
 // Pending work retains the existing standard Stage01–03 builder. The
 // accepted control uses the injected source-bearing prefix below.
 const create=async id=>store.writeProject(makeStage04Fixture(id),{expectedProjectRevision:0,createOnly:true,incrementRevision:false});
 const reserve=async project=>{
  const revision=project.revision,digest=project.projectSha256,prompt=runtime.prompts.reserveAndBuildPromptRecord(project,4,{}, {owningTabInstance:'MIXED_RECOVERY_FIXTURE'}).prompt;
  await store.persistPromptContextFiles(prompt,project);
  project=await store.writeProject(project,{expectedProjectRevision:revision,expectedStateSha256:digest});
  return {project,prompt:project.projectData.generatedPrompts.find(row=>row.instructionId===prompt.instructionId)};
 };
 const prepare=async(project,prompt,text,filename,returnedFiles=[])=>{
  const identity={instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},binding={packageId:prompt.packageId,operationReservationId:prompt.operationReservationId,challengeNonce:prompt.challengeNonce};
  const descriptor=await store.stageResponseFile({jobId:project.job.JOB_ID,stage:4,blob:new Blob([text],{type:'application/json'}),rawFilename:filename,mediaType:'application/json',promptIdentity:identity,...binding});
  staging.push({jobId:project.job.JOB_ID,stagingId:descriptor.stagingId});
  const {blob,storageKey,...savedDescriptor}=descriptor,transport={...savedDescriptor,authority:'AUTHORITATIVE_RESPONSE_FILE'};
  const captured=runtime.ingestion.captureRaw(project,{stage:4,text,promptRecord:prompt,transport});
  project=await store.writeProject(captured.project,{operational:true,expectedProjectRevision:project.revision,expectedStateSha256:project.projectSha256});
  if(returnedFiles.length){
   const next=engine.clone(project),pendingArtifacts=[],views=[];
   for(const file of returnedFiles){
    const blob=new Blob([file.text],{type:file.mediaType}),sha256=await globalThis.closedLoopHash.sha256Bytes(blob),lineage={rawResponseId:captured.rawRecord.rawResponseId,attachmentSlotId:file.attachmentSlotId};
    assert(sha256===file.sha256&&blob.size===file.byteSize,'source-copy bytes must match their accepted source binding');
    const artifactId=engine.allocateId(next,'artifacts',{commandId:'MIXED_SOURCE_RETURNED_FILE',targetSlot:file.attachmentSlotId,parentId:captured.rawRecord.rawResponseId,idempotencyKey:'FILE_INTAKE',payload:{stage:4,filename:file.filename,mediaType:file.mediaType,byteSize:blob.size,sha256,lineage}});
    pendingArtifacts.push({artifactId,jobId:project.job.JOB_ID,blob,filename:file.filename,mediaType:file.mediaType,byteSize:blob.size,sha256,lineage:{stage:4,role:runtime.core.STAGES[3].role,logicalPath:file.filename,...lineage},createdAt:new Date().toISOString()});
    views.push({artifactId,name:file.filename,type:file.mediaType,size:blob.size,sha256,attachmentSlotId:file.attachmentSlotId});
   }
   const bound=runtime.ingestion.bindAttachmentSlots(next,{rawResponseId:captured.rawRecord.rawResponseId,files:views});
   project=await store.writeProject(bound.project,{operational:true,expectedProjectRevision:project.revision,expectedStateSha256:project.projectSha256,pendingArtifacts});
   for(const file of views){const saved=await store.getArtifact(file.artifactId);assert(saved&&saved.filename===file.name&&saved.byteSize===file.size&&await globalThis.closedLoopHash.sha256Bytes(saved.blob)===file.sha256,'actual source returned-file read-back must establish byte custody');}
  }
  const prepared=runtime.ingestion.prepareCaptured(project,{rawResponseId:captured.rawRecord.rawResponseId});
  project=await store.writeProject(prepared.project,{operational:true,expectedProjectRevision:project.revision,expectedStateSha256:project.projectSha256});
  return {...prepared,project};
 };
 assert(typeof makeAcceptedStage04Fixture==='function','the accepted source-bearing builder is required');
 const acceptedSeed=await makeAcceptedStage04Fixture(controls.accepted),sourceFile=acceptedSeed.sourceFile;
 assert(acceptedSeed.project&&sourceFile?.text&&sourceFile.sha256,'source-bearing builder must return actual source-copy bytes');
 let accepted=await store.writeProject(acceptedSeed.project,{expectedProjectRevision:0,createOnly:true,incrementRevision:false}),issued=await reserve(accepted);accepted=issued.project;
 const sourceId=engine.recordId(engine.recordsForCurrentScope(accepted,'sources')[0],'sources'),sourceEnvelope=makeStage04Envelope(accepted,issued.prompt),slot=runtime.prompts.promptFileManifest(issued.prompt).attachmentSlots.find(row=>row.role==='SUPPORTING_EVIDENCE');
 assert(slot,'source response needs a genuinely issued supporting-evidence slot');
 sourceEnvelope.attachments=[{temporaryKey:'mixed-source-copy',attachmentSlotId:slot.attachmentSlotId,role:slot.role,filename:sourceFile.filename,mediaType:sourceFile.mediaType,byteSize:sourceFile.byteSize,sha256:sourceFile.sha256,required:true}];
 Object.assign(sourceEnvelope.evidence[0],{authorityType:'EXTERNAL_SOURCE',sourceRef:{recordId:sourceId},attachmentRef:{tempKey:'mixed-source-copy'},content:sourceFile.text});
 let prepared=await prepare(accepted,issued.prompt,JSON.stringify(sourceEnvelope),'mixed-accepted-stage04.json',[{...sourceFile,attachmentSlotId:slot.attachmentSlotId}]);
 assert(prepared.validation.valid&&prepared.proposal?.status==='PENDING_OPERATOR_REVIEW','accepted control needs a genuine valid pending proposal: '+JSON.stringify(prepared.validation.issues));
 // Operational persistence clears private custody; acceptance must reread the
 // actual returned bytes, just like the ordinary acceptance boundary.
 for(const file of prepared.project.projectData.rawResponses.find(row=>row.rawResponseId===prepared.rawRecord.rawResponseId).files){const saved=await store.getArtifact(file.artifactId);assert(saved&&saved.byteSize===file.size&&await globalThis.closedLoopHash.sha256Bytes(saved.blob)===file.sha256,'source bytes require current pre-acceptance custody');}
 const committed=runtime.ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'SYNTHETIC_MIXED_RECOVERY',replacementConfirmation:runtime.ingestion.acceptanceImpact(prepared.project,prepared.proposal.proposalId)});
 accepted=await store.writeProject(committed.project,{expectedProjectRevision:prepared.project.revision,expectedStateSha256:prepared.project.projectSha256});
 assert(engine.gate(4,accepted).complete,'accepted Stage04 must be current and complete');
 const sourceEvidence=engine.recordsForCurrentScope(accepted,'evidenceRecords').find(row=>engine.recordValue(row,'SOURCE_ID')===sourceId&&engine.recordValue(row,'ATTACHMENT_ID')&&engine.recordValue(row,'ATTACHMENT_ID')!=='UNKNOWN');
 assert(sourceEvidence,'actual acceptance must bind source and returned artifact through canonical evidence');
 const sourceBinding={jobId:controls.accepted,sourceId,researchIds:engine.recordsForCurrentScope(accepted,'research').map(row=>engine.recordId(row,'research')),evidenceId:engine.recordId(sourceEvidence,'evidenceRecords'),artifactId:engine.recordValue(sourceEvidence,'ATTACHMENT_ID'),rawResponseId:prepared.rawRecord.rawResponseId,attachmentSlotId:slot.attachmentSlotId,instructionId:issued.prompt.instructionId,sha256:sourceFile.sha256,byteSize:sourceFile.byteSize};

 assert(engine.recordsForCurrentScope(accepted,'sourceSearchContracts').length>0&&engine.recordsForCurrentScope(accepted,'semanticReviews').length>0&&accepted.projectData.history.length>0,'source, review and canonical history must be populated');
 let pending=await create(controls.pending);issued=await reserve(pending);pending=issued.project;
 const rejected=await prepare(pending,issued.prompt,'Bounded rejected Stage04 response: invalid JSON é🙂 END','mixed-rejected-stage04.json');
 assert(!rejected.validation.valid&&!rejected.proposal&&rejected.rawRecord?.rawResponseId,'bounded rejection must come from actual file preparation');
 pending=rejected.project;issued=await reserve(pending);pending=issued.project;
 prepared=await prepare(pending,issued.prompt,JSON.stringify(makeStage04Envelope(pending,issued.prompt)),'mixed-pending-stage04.json');pending=prepared.project;
 assert(prepared.validation.valid&&prepared.proposal?.status==='PENDING_OPERATOR_REVIEW','pending control needs a current genuine proposal: '+JSON.stringify(prepared.validation.issues));
 assert(pending.projectData.generatedPrompts.filter(row=>Number(row.stage)===4).length===2,'exactly one rejected-response replacement instruction');
 const rejectedRaw=pending.projectData.rawResponses.find(row=>row.rawResponseId===rejected.rawRecord.rawResponseId),pendingRaw=pending.projectData.rawResponses.find(row=>row.rawResponseId===prepared.rawRecord.rawResponseId);
 assert(rejectedRaw&&pendingRaw&&rejectedRaw.rawResponseId!==pendingRaw.rawResponseId,'both original raw identities must remain');
 let removed=await store.writeProject(runtime.core.createBlankState(controls.removed),{expectedProjectRevision:0,createOnly:true});
 await store.saveCheckpoint(removed.job.JOB_ID,{expectedProjectRevision:removed.revision,label:'Mixed recovery retained removal control'});
 assert(await store.removeProject(removed.job.JOB_ID,{expectedProjectRevision:removed.revision,idempotencyKey:'BROWSER-EXTRA-MIXED-TINY-REMOVAL'}),'tiny project must be removed by the store');
 const descriptor={controls,sourceBinding,suppressedOwnerId,removedOwnerIds:[controls.removed,suppressedOwnerId],staging,pending:{jobId:controls.pending,proposalId:prepared.proposal.proposalId,rawResponseId:prepared.rawRecord.rawResponseId,rejectedRawResponseId:rejected.rawRecord.rawResponseId,instructionId:issued.prompt.instructionId,operationReservationId:issued.prompt.operationReservationId}};
 await store.metaPut('browserExtraMixedRecoveryFixture',descriptor);return descriptor;
}

// Capture compact independent observations rather than entire metadata stores.
// Expected old checkpoints are compared as a retained subset: a new legitimate
// application session may append checkpoints and session bookkeeping.
export async function collectMixedRecoverySnapshot(descriptor){
 const store=globalThis.closedLoopProjectStore,hash=globalThis.closedLoopHash,engine=globalThis.closedLoopWorkflowEngine;
 const summaries=await store.listProjectSummaries(),summaryOwnerIds=summaries.map(row=>row.job.JOB_ID).sort(),ownerIds=descriptor.snapshotOwnerIds||summaryOwnerIds;
 const metadata=row=>Object.fromEntries(Object.entries(row||{}).filter(([key,value])=>!['blob','bytes','storageKey'].includes(key)&&value!==undefined));
 const identity=async row=>row?{metadata:metadata(row),actualByteSize:row.blob instanceof Blob?row.blob.size:null,actualSha256:row.blob instanceof Blob?await hash.sha256Bytes(row.blob):null}:null;
 const projects=[],artifacts=[],histories=[],staged=[];
 for(const jobId of ownerIds){
  const project=await store.readProject(jobId);if(!project){projects.push({jobId,missing:true});continue;}
  const validation=store.validateProjectIntegrity(project),data=project.projectData;
  let sourceAssociation=null;
  if(jobId===descriptor.sourceBinding?.jobId){
   const binding=descriptor.sourceBinding,source=engine.recordsForCurrentScope(project,'sources').find(row=>engine.recordId(row,'sources')===binding.sourceId),evidence=engine.recordsForCurrentScope(project,'evidenceRecords').find(row=>engine.recordId(row,'evidenceRecords')===binding.evidenceId),artifact=engine.recordsForCurrentScope(project,'artifacts').find(row=>engine.recordId(row,'artifacts')===binding.artifactId),raw=(data.rawResponses||[]).find(row=>row.rawResponseId===binding.rawResponseId),prompt=(data.generatedPrompts||[]).find(row=>row.instructionId===binding.instructionId),slot=prompt&&globalThis.closedLoopPromptEngine.promptFileManifest(prompt).attachmentSlots.find(row=>row.attachmentSlotId===binding.attachmentSlotId);
   const canonicalArtifactNotes=artifact?engine.recordValue(artifact,'NOTES'):null;let canonicalArtifactLineage=null;try{canonicalArtifactLineage=JSON.parse(canonicalArtifactNotes);}catch{}
   sourceAssociation={sourceId:source?engine.recordId(source,'sources'):null,sourceSha256:source?hash.sha256Value(source):null,research:engine.recordsForCurrentScope(project,'research').filter(row=>binding.researchIds.includes(engine.recordId(row,'research'))).map(row=>({researchId:engine.recordId(row,'research'),sourceId:engine.recordValue(row,'SOURCE_ID'),sha256:hash.sha256Value(row)})),evidenceId:evidence?engine.recordId(evidence,'evidenceRecords'):null,evidenceSourceId:evidence?engine.recordValue(evidence,'SOURCE_ID'):null,evidenceArtifactId:evidence?engine.recordValue(evidence,'ATTACHMENT_ID'):null,evidenceRawId:evidence?.rawResponseId||null,evidenceSha256:evidence?hash.sha256Value(evidence):null,canonicalArtifactId:artifact?engine.recordId(artifact,'artifacts'):null,canonicalArtifactSha256:artifact?engine.recordValue(artifact,'SHA256'):null,canonicalArtifactByteSize:artifact?engine.recordValue(artifact,'BYTE_SIZE'):null,canonicalArtifactNotes,canonicalArtifactLineage,rawResponseId:raw?.rawResponseId||null,rawFile:raw?.files?.find(row=>row.attachmentSlotId===binding.attachmentSlotId)||null,promptInstructionId:prompt?.instructionId||null,issuedAttachmentSlotId:slot?.attachmentSlotId||null};
  }

  projects.push({jobId,revision:project.revision,projectSha256:project.projectSha256,computedSha256:store.projectSha256(project),integrityValid:validation.valid,integrityIssues:validation.issues,rawResponsesSha256:hash.sha256Value(data.rawResponses||[]),proposalsSha256:hash.sha256Value(data.responseProposals||[]),reservationsSha256:hash.sha256Value(data.operationReservations||[]),historySha256:hash.sha256Value(data.history||[]),sourcesSha256:hash.sha256Value(data.sources||[]),researchSha256:hash.sha256Value(data.research||[]),sourceAssociation,sourceCount:engine.recordsForCurrentScope(project,'sources').length,researchCount:engine.recordsForCurrentScope(project,'research').length,sourceSearchContractCount:engine.recordsForCurrentScope(project,'sourceSearchContracts').length,capabilityEvidenceCount:engine.recordsForCurrentScope(project,'externalCapabilities').length,acceptedChangeCount:(data.acceptedChanges||[]).length,reviewCount:engine.recordsForCurrentScope(project,'semanticReviews').length,stage04Complete:engine.gate(4,project).complete,pendingProposals:(data.responseProposals||[]).filter(row=>row.status==='PENDING_OPERATOR_REVIEW').map(row=>row.proposalId).sort(),rawResponseIds:(data.rawResponses||[]).map(row=>row.rawResponseId).sort(),reservationIds:(data.operationReservations||[]).map(row=>engine.recordId(row,'operationReservations')).sort()});
  for(const row of await store.listArtifacts(jobId))artifacts.push({jobId,artifactId:row.artifactId,...await identity(row)});
 }
 for(const jobId of [...new Set([...ownerIds,...descriptor.removedOwnerIds])].sort()){
  const state=await store.metaGet('recovery:'+jobId),entries=[],files=[];
  if(state){for(const entry of state.entries||[]){const saved=await store.metaGet('recovery:'+jobId+':snapshot:'+entry.id);entries.push({id:entry.id,descriptor:entry,snapshot:await identity(saved)});}for(const [sha256,file]of Object.entries(state.files||{})){const saved=await store.metaGet('recovery:'+jobId+':bytes:'+sha256);files.push({sha256,descriptor:file,body:await identity(saved)});}}
  histories.push({jobId,exists:Boolean(state),removed:Boolean(state?.removed),retainedMaps:Object.fromEntries(['sessions','sourceArchives','sourceArchiveReferences','commandReceipts','transfers'].map(key=>[key,state?.[key]||{}])),entries,files});
 }
 for(const binding of descriptor.staging){let row,error=null;try{row=await store.readStagedResponseFile(binding);}catch(caught){error=String(caught.code||caught.message);}staged.push({...binding,...await identity(row),error});}
 const recoverable=await store.listRecoverableProjects(),removed=[];
 for(const jobId of descriptor.removedOwnerIds){const state=histories.find(row=>row.jobId===jobId),catalog=recoverable.find(row=>row.jobId===jobId);let viewReadable=null;
  // Decode the tiny removed control through the real public History reader.
  // The bootstrap's potentially large saved sources retain their byte hashes.
  if(jobId===descriptor.controls.removed&&state?.entries.length){try{viewReadable=Boolean(await store.readHistoryView(jobId,state.entries.at(-1).id));}catch{viewReadable=false;}}
  removed.push({jobId,absent:await store.readProject(jobId)===null,catalogRemoved:catalog?.removed===true,viewReadable});
 }
 const original=await store.metaGet('startupFixtureRecoveryRow');let corruptEvidence=null;
 if(original){const entry=(await store.listQuarantinedProjects()).find(row=>row.jobId==='STARTUP-RECOVERY-CORRUPT'),saved=entry&&await store.metaGet(entry.key);corruptEvidence={originalHasMarker:original.project?.corruptionMarker===true,reason:saved?.reason||null,expectedSha256:hash.sha256Value(original),actualSha256:saved?.row?hash.sha256Value(saved.row):null};}
 return {descriptor:{...descriptor,snapshotOwnerIds:ownerIds.slice()},summaryOwnerIds,projects,artifacts:artifacts.sort((a,b)=>a.artifactId.localeCompare(b.artifactId)),histories,staged,removed,suppressionEnabled:Boolean(await store.metaGet('retainedProjectSuppressed')),corruptEvidence};
}

// Pure oracle shared by the browser run and adversarial adapter controls.
// Mixed owners are deliberately not activated, so this startup contract does
// not orphan/rebase their reservations or change canonical project digests.
// Session/History appends are permitted above without weakening retained IDs.
export function compareMixedRecoverySnapshots(expected,actual,observation){
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),everyExpected=(before,after,key)=>before.every(row=>after.some(candidate=>candidate[key]===row[key]&&same(row,candidate)));
 const reads=observation?.readEvidence?.reads||[],recovery=reads.filter(row=>row.phase==='recovery'),activation=reads.filter(row=>row.phase==='activation'),readEvidence=observation?.readEvidence||{},startup=observation?.proof||{};
 const ids=expected.summaryOwnerIds,controls=expected.descriptor.controls,pending=expected.descriptor.pending;
 const accepted=actual.projects.find(row=>row.jobId===controls.accepted),proposed=actual.projects.find(row=>row.jobId===controls.pending),corrupt=actual.corruptEvidence;
 const population={mixedAccepted:accepted&&!accepted.missing&&actual.summaryOwnerIds.includes(controls.accepted)?1:0,mixedPending:proposed&&!proposed.missing&&actual.summaryOwnerIds.includes(controls.pending)?1:0,mixedRemoved:actual.removed.filter(row=>row.jobId===controls.removed&&row.absent&&row.catalogRemoved).length,intakeOwners:actual.summaryOwnerIds.filter(id=>id.startsWith('INTAKE-')&&ids.includes(id)).length};
 const sourceBinding=expected.descriptor.sourceBinding,association=accepted?.sourceAssociation,sourceArtifact=actual.artifacts.find(row=>row.jobId===sourceBinding?.jobId&&row.artifactId===sourceBinding?.artifactId);
 const byteIdentity=row=>Boolean(row?.metadata&&typeof row.actualSha256==='string'&&/^[a-f0-9]{64}$/.test(row.actualSha256)&&row.actualSha256===row.metadata.sha256&&row.actualByteSize===row.metadata.byteSize);
 const retainedMapsPreserved=(before,after)=>Object.entries(before.retainedMaps).every(([family,map])=>Object.entries(map).every(([key,value])=>same(value,after.retainedMaps?.[family]?.[key])));
 const startupPredicates=['recoveryReady','originalReadyPromise','activationStartsAfterReady','recoverySummaryScan','recoveryAllOwners','recoveryCorruptRead','recoveryCorruptQuarantined','recoveryCorruptRemoved','selected','noWholeProjectScan','selectedOnly','allPickerRows','archivedCorruptionNotPremature','corruptBlocked','corruptQuarantined'];
 const oldHistoryPreserved=expected.histories.every(before=>{const after=actual.histories.find(row=>row.jobId===before.jobId);return after&&before.exists&&after.exists&&before.removed===after.removed&&retainedMapsPreserved(before,after)&&everyExpected(before.entries,after.entries,'id')&&before.files.every(file=>after.files.some(candidate=>candidate.sha256===file.sha256&&same(file.body,candidate.body)&&file.descriptor.byteSize===candidate.descriptor.byteSize));});
 const proof={
  allPriorSummaryOwnersRecovered:ids.length>0&&ids.every(jobId=>recovery.some(row=>row.method==='get'&&row.key===jobId)),
  allPriorSummaryOwnersRetained:ids.every(jobId=>actual.summaryOwnerIds.includes(jobId)),
  allCanonicalDigestsValid:expected.projects.length===ids.length&&actual.projects.length===ids.length&&[...expected.projects,...actual.projects].every(row=>!row.missing&&row.integrityValid&&/^[a-f0-9]{64}$/.test(row.projectSha256)&&row.projectSha256===row.computedSha256),
  allCanonicalDataExact:everyExpected(expected.projects,actual.projects,'jobId'),
  artifactMetadataAndBytesExact:same(expected.artifacts,actual.artifacts)&&[...expected.artifacts,...actual.artifacts].every(byteIdentity),
  pendingRawProposalReservationExact:proposed?.pendingProposals.includes(pending.proposalId)&&proposed.rawResponseIds.includes(pending.rawResponseId)&&proposed.rawResponseIds.includes(pending.rejectedRawResponseId)&&proposed.reservationIds.includes(pending.operationReservationId)&&everyExpected(expected.projects.filter(row=>row.jobId===controls.pending),actual.projects,'jobId'),
  stagedIdentitiesAndBytesExact:same(expected.staged,actual.staged)&&[...expected.staged,...actual.staged].every(row=>row.error===null&&byteIdentity(row)),
  oldHistoryIdentitiesAndBytesExact:oldHistoryPreserved&&[...expected.histories,...actual.histories].every(row=>row.entries.every(entry=>byteIdentity(entry.snapshot))&&row.files.every(file=>file.body?.metadata?.sha256===file.sha256&&file.body.actualSha256===file.sha256&&file.body.actualByteSize===file.descriptor.byteSize)),
  acceptedSourceReviewHistoryRetained:Boolean(accepted?.stage04Complete&&accepted.sourceSearchContractCount>0&&accepted.capabilityEvidenceCount>0&&accepted.acceptedChangeCount>0&&accepted.reviewCount>0&&accepted.historySha256===expected.projects.find(row=>row.jobId===controls.accepted)?.historySha256),
  sourceResearchCanonicalPreserved:Boolean(accepted?.sourceCount>0&&accepted.researchCount>0&&accepted.sourcesSha256===expected.projects.find(row=>row.jobId===controls.accepted)?.sourcesSha256&&accepted.researchSha256===expected.projects.find(row=>row.jobId===controls.accepted)?.researchSha256&&same(association,expected.projects.find(row=>row.jobId===controls.accepted)?.sourceAssociation)),
  sourceAssociatedReturnedBytesExact:Boolean(association&&sourceBinding&&['sourceId','evidenceId','artifactId','rawResponseId','attachmentSlotId','instructionId'].every(key=>typeof sourceBinding[key]==='string'&&sourceBinding[key].length>0)&&/^[a-f0-9]{64}$/.test(sourceBinding.sha256)&&sourceBinding.byteSize>0&&association.sourceId===sourceBinding.sourceId&&association.research.length===sourceBinding.researchIds.length&&association.research.length>0&&association.research.every(row=>sourceBinding.researchIds.includes(row.researchId)&&row.sourceId===sourceBinding.sourceId)&&association.evidenceId===sourceBinding.evidenceId&&association.evidenceSourceId===sourceBinding.sourceId&&association.evidenceArtifactId===sourceBinding.artifactId&&association.evidenceRawId===sourceBinding.rawResponseId&&association.canonicalArtifactId===sourceBinding.artifactId&&association.canonicalArtifactSha256===sourceBinding.sha256&&Number(association.canonicalArtifactByteSize)===sourceBinding.byteSize&&association.canonicalArtifactLineage?.rawResponseId===sourceBinding.rawResponseId&&association.canonicalArtifactLineage?.attachmentSlotId===sourceBinding.attachmentSlotId&&association.rawResponseId===sourceBinding.rawResponseId&&association.rawFile?.artifactId===sourceBinding.artifactId&&association.rawFile?.attachmentSlotId===sourceBinding.attachmentSlotId&&association.rawFile?.sha256===sourceBinding.sha256&&association.rawFile?.size===sourceBinding.byteSize&&association.promptInstructionId===sourceBinding.instructionId&&association.issuedAttachmentSlotId===sourceBinding.attachmentSlotId&&byteIdentity(sourceArtifact)&&sourceArtifact.jobId===sourceBinding.jobId&&sourceArtifact.metadata.jobId===sourceBinding.jobId&&sourceArtifact.metadata.lineage?.rawResponseId===sourceBinding.rawResponseId&&sourceArtifact.metadata.lineage?.attachmentSlotId===sourceBinding.attachmentSlotId&&sourceArtifact.metadata.sha256===sourceBinding.sha256&&sourceArtifact.actualByteSize===sourceBinding.byteSize),
  removedOwnerRecoverableAbsent:actual.removed.length===expected.removed.length&&expected.removed.every(before=>actual.removed.some(after=>after.jobId===before.jobId))&&actual.removed.every(row=>row.absent&&row.catalogRemoved&&!actual.summaryOwnerIds.includes(row.jobId)&&(row.jobId!==controls.removed||row.viewReadable===true)),
  retainedBootstrapSuppressed:expected.suppressionEnabled&&actual.suppressionEnabled&&!actual.summaryOwnerIds.includes(expected.descriptor.suppressedOwnerId),
  actualReadyBeforeActivation:readEvidence.ready===true&&readEvidence.readyError===null&&readEvidence.recoveryErrorAtReady===null&&typeof readEvidence.sessionKey==='string'&&readEvidence.sessionKey.startsWith('recoverySession:')&&readEvidence.sessionKey!=='recoverySession:null'&&readEvidence.sessionReads?.length>0&&readEvidence.sessionReads[0].phase==='activation'&&startup.recoveryReady===true&&startup.originalReadyPromise===true&&startup.activationStartsAfterReady===true,
  noWholeProjectScan:reads.length>0&&reads.every(row=>row.method!=='getAll')&&startup.noWholeProjectScan===true,
  onlySelectedStartupActivation:activation.length>0&&activation.every(row=>row.method==='get'&&row.key==='STARTUP-BROWSER-0')&&startup.selected===true&&startup.selectedOnly===true,
  corruptEvidenceExact:Boolean(corrupt?.originalHasMarker&&corrupt.reason==='PROJECT_HASH_MISMATCH'&&/^[a-f0-9]{64}$/.test(corrupt.expectedSha256)&&corrupt.expectedSha256===corrupt.actualSha256&&startup.recoveryCorruptQuarantined===true&&startup.corruptQuarantined===true),
  existingStartupPredicatesPreserved:startupPredicates.every(key=>startup[key]===true)&&Object.values(startup).every(value=>value===true)
 };
 return {proof,population,counts:{expectedSummaryOwners:ids.length,observedSummaryOwners:actual.summaryOwnerIds.length,recoveredPriorOwners:ids.filter(jobId=>recovery.some(row=>row.method==='get'&&row.key===jobId)).length,intakeOwners:ids.filter(id=>id.startsWith('INTAKE-')).length,mixedAccepted:accepted?1:0,acceptedCanonicalSources:accepted?.sourceCount??0,acceptedCanonicalResearch:accepted?.researchCount??0,sourceAssociatedArtifacts:sourceArtifact?1:0,acceptedSourceSearchContracts:accepted?.sourceSearchContractCount??0,acceptedCapabilityEvidence:accepted?.capabilityEvidenceCount??0,mixedPending:proposed?1:0,mixedRemoved:actual.removed.filter(row=>row.jobId===controls.removed&&row.catalogRemoved).length,artifactRows:actual.artifacts.length,stagedRows:actual.staged.length,expectedOldCheckpoints:expected.histories.reduce((n,row)=>n+row.entries.length,0),observedCheckpoints:actual.histories.reduce((n,row)=>n+row.entries.length,0)}};
}

export async function observeMixedRecoveryFixture(expected,collectSnapshot,compareSnapshots,startupResult){
 const actual=await collectSnapshot(expected.descriptor);
 return compareSnapshots(expected,actual,startupResult);
}

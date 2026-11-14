import assert from 'node:assert/strict';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {projectStoreRuntime,storedArtifactBody} from './test-project-store-runtime.mjs';
import {stage04AcceptanceFixtureSource,stage04AcceptanceEnvelope} from './test-fixtures.mjs';
import {buildSourceBearingStage04Fixture,prepareMixedRecoveryFixture,collectMixedRecoverySnapshot,compareMixedRecoverySnapshots,observeMixedRecoveryFixture} from './browser-extra-mixed-recovery.mjs';

const plain=value=>JSON.parse(JSON.stringify(value));
export async function verifyBrowserExtraMixedRecovery(){
 const r=projectStoreRuntime(),{store,core,engine}=r;
 const source=[stage04AcceptanceFixtureSource(),stage04AcceptanceEnvelope.toString(),buildSourceBearingStage04Fixture.toString(),prepareMixedRecoveryFixture.toString(),collectMixedRecoverySnapshot.toString(),compareMixedRecoverySnapshots.toString(),observeMixedRecoveryFixture.toString()].join('\n');
 vm.runInContext(source,r.runtime);
 await store.writeProject(core.createBlankState('JOB-20260823144121'),{expectedProjectRevision:0,createOnly:true});
 for(let index=0;index<12;index++)await store.writeProject(core.createBlankState('INTAKE-ADAPTER-'+index),{expectedProjectRevision:0,createOnly:true});
 let backup=core.createBlankState('BACKUP-BROWSER-CLOSURE');
 const artifactId=engine.allocateId(backup,'artifacts',{commandId:'MIXED-ADAPTER-BACKUP-FILE',idempotencyKey:'file'}),artifact=await store.putArtifact({jobId:backup.job.JOB_ID,artifactId,filename:'required.txt',blob:new Blob(['exact required bytes é🙂'])});
 engine.registerArtifactBytes(backup,{stage:1,artifactId,filename:artifact.filename,byteSize:artifact.byteSize,sha256:artifact.sha256,mediaType:artifact.mediaType,lineage:artifact.lineage});
 await store.writeProject(backup,{expectedProjectRevision:0,createOnly:true});
 await store.importPackage(await store.exportPackage(backup.job.JOB_ID));
 await store.beginHistorySession('MIXED-ADAPTER-BEFORE');
 vm.runInContext('const fixtureRuntime={core:closedLoopCore,schema:closedLoopWorkflowSchema,engine:closedLoopWorkflowEngine,prompts:closedLoopPromptEngine,ingestion:closedLoopResponseIngestion};',r.runtime);
 const descriptor=await vm.runInContext('prepareMixedRecoveryFixture(id=>stage04AcceptanceFixture(fixtureRuntime,id),(project,prompt)=>stage04AcceptanceEnvelope(fixtureRuntime,project,prompt),id=>buildSourceBearingStage04Fixture(fixtureRuntime,id,stage02AcceptanceFixture,recordProposal,acceptPrerequisite))',r.runtime);
 const expected=await r.runtime.collectMixedRecoverySnapshot(descriptor);
 assert.equal(expected.summaryOwnerIds.length,15,'MIXED_ADAPTER_PRIOR_OWNER_POPULATION_ORACLE');
 assert.equal(expected.descriptor.staging.length,3,'MIXED_ADAPTER_REAL_STAGED_RESPONSE_POPULATION_ORACLE');
 // Snapshot bytes get an independent Node crypto check; this adapter suite
 // never claims native IDB events. The browser passes its real observer instead.
 for(const row of expected.artifacts){const stored=await store.getArtifact(row.artifactId);assert.equal(createHash('sha256').update(Buffer.from(await stored.blob.arrayBuffer())).digest('hex'),row.actualSha256,'MIXED_ADAPTER_INDEPENDENT_ARTIFACT_HASH_ORACLE');}
 const corruptId='STARTUP-RECOVERY-CORRUPT';await store.writeProject(core.createBlankState(corruptId),{expectedProjectRevision:0,createOnly:true});
 const original=r.rows.get('projects').get(corruptId);original.project.corruptionMarker=true;await store.metaPut('startupFixtureRecoveryRow',original);
 await store.writeProject(core.createBlankState('STARTUP-BROWSER-0'),{expectedProjectRevision:0,createOnly:true});await store.metaPut('selectedProject','STARTUP-BROWSER-0');
 const reads=[],open=r.runtime.openStorageTransaction;
 r.runtime.openStorageTransaction=async(names,mode)=>{const tx=await open(names,mode),objectStore=tx.objectStore;return {...tx,objectStore(name){const object=objectStore(name);if(name!=='projects')return object;return {...object,get(key){reads.push({method:'get',key,phase:'recovery'});return object.get(key);},getAll(){reads.push({method:'getAll',phase:'recovery'});return object.getAll();}};}};};
 await store.recoverResponseStaging();r.runtime.openStorageTransaction=open;
 // Normal new History sessions append bookkeeping; every old entry survives.
 await store.beginHistorySession('MIXED-ADAPTER-AFTER-READY');await store.metaPut('retainedProjectSuppressed',true);
 const actual=await r.runtime.collectMixedRecoverySnapshot(expected.descriptor);
 const startup={proof:Object.fromEntries(['recoveryReady','originalReadyPromise','activationStartsAfterReady','recoverySummaryScan','recoveryAllOwners','recoveryCorruptRead','recoveryCorruptQuarantined','recoveryCorruptRemoved','selected','noWholeProjectScan','selectedOnly','allPickerRows','archivedCorruptionNotPremature','corruptBlocked','corruptQuarantined'].map(key=>[key,true])),readEvidence:{reads:[...reads,{method:'get',key:'STARTUP-BROWSER-0',phase:'activation'}],summaryScans:[{phase:'recovery'}],sessionReads:[{phase:'activation'}],sessionKey:'recoverySession:MIXED-ADAPTER-AFTER-READY',ready:true,readyError:null,recoveryErrorAtReady:null}};
 const positive=compareMixedRecoverySnapshots(plain(expected),plain(actual),startup);
 assert.deepEqual(positive.population,{mixedAccepted:1,mixedPending:1,mixedRemoved:1,intakeOwners:12},'MIXED_ADAPTER_POPULATION_ORACLE');

 assert(Object.values(positive.proof).every(Boolean),'MIXED_ADAPTER_POSITIVE_ORACLE: '+JSON.stringify(positive));
 const mutations=[];
 function reject(name,change,expectedPredicate){const e=plain(expected),a=plain(actual),o=plain(startup);change(e,a,o);const result=compareMixedRecoverySnapshots(e,a,o);assert(Object.values(result.proof).some(value=>value!==true),'MIXED_ADAPTER_MUTATION_MUST_FAIL: '+name);if(expectedPredicate)assert.equal(result.proof[expectedPredicate],false,'MIXED_ADAPTER_SPECIFIC_MUTATION_MUST_FAIL: '+name+' / '+expectedPredicate);mutations.push({name,rejectedBy:Object.keys(result.proof).filter(key=>result.proof[key]!==true)});}
 const pending=descriptor.controls.pending,accepted=descriptor.controls.accepted;
 for(const id of [accepted,pending,'INTAKE-ADAPTER-11','BACKUP-BROWSER-CLOSURE'])reject('omit-recovery-owner-'+id,(_e,_a,o)=>{o.readEvidence.reads=o.readEvidence.reads.filter(row=>!(row.phase==='recovery'&&row.key===id));});
 reject('canonical-digest-changed',(_e,a)=>{a.projects.find(row=>row.jobId===accepted).projectSha256='f'.repeat(64);});
 reject('valid-but-different-canonical-digest',(_e,a)=>{const row=a.projects.find(row=>row.jobId===accepted);row.projectSha256=row.computedSha256='f'.repeat(64);});
 reject('artifact-metadata-changed',(_e,a)=>{a.artifacts[0].metadata.filename+='-changed';});
 reject('artifact-bytes-changed',(_e,a)=>{a.artifacts[0].actualSha256='f'.repeat(64);});
 for(const field of ['rawResponsesSha256','proposalsSha256','reservationsSha256','historySha256'])reject(field+'-changed',(_e,a)=>{a.projects.find(row=>row.jobId===pending)[field]='f'.repeat(64);});
 reject('pending-raw-identity-changed',(_e,a)=>{a.projects.find(row=>row.jobId===pending).rawResponseIds=[];});
 reject('pending-reservation-identity-changed',(_e,a)=>{a.projects.find(row=>row.jobId===pending).reservationIds=[];});
 reject('pending-staging-identity-changed',(_e,a)=>{a.staged.at(-1).stagingId='OTHER-STAGING';});
 reject('pending-staging-bytes-changed',(_e,a)=>{a.staged.at(-1).actualSha256='f'.repeat(64);});
 reject('retained-session-identity-changed',(_e,a)=>{const h=a.histories.find(row=>Object.keys(row.retainedMaps.sessions).length);h.retainedMaps.sessions[Object.keys(h.retainedMaps.sessions)[0]].checkpointId='OTHER-CHECKPOINT';});
 reject('retained-source-archive-identity-changed',(_e,a)=>{const h=a.histories.find(row=>Object.keys(row.retainedMaps.sourceArchives).length);h.retainedMaps.sourceArchives[Object.keys(h.retainedMaps.sourceArchives)[0]].sha256='f'.repeat(64);});
 reject('retained-deletion-receipt-changed',(_e,a)=>{const h=a.histories.find(row=>row.jobId===descriptor.controls.removed);h.retainedMaps.commandReceipts[Object.keys(h.retainedMaps.commandReceipts)[0]].jobId='OTHER-OWNER';});
 reject('retained-checkpoint-missing',(_e,a)=>{a.histories.find(row=>row.jobId===accepted).entries.shift();});
 reject('retained-checkpoint-bytes-changed',(_e,a)=>{a.histories.find(row=>row.jobId===accepted).entries[0].snapshot.actualSha256='f'.repeat(64);});
 reject('retained-file-bytes-changed',(_e,a)=>{a.histories.find(row=>row.files.length).files[0].body.actualSha256='f'.repeat(64);});
 reject('removed-owner-observation-missing',(_e,a)=>{a.removed.find(row=>row.jobId===descriptor.controls.removed).jobId='OTHER-REMOVED-OWNER';});
 reject('removed-owner-reappeared',(_e,a)=>{a.summaryOwnerIds.push(descriptor.controls.removed);});
 reject('removed-owner-unrecoverable',(_e,a)=>{a.removed.find(row=>row.jobId===descriptor.controls.removed).viewReadable=false;});
 reject('suppressed-bootstrap-reappeared',(_e,a)=>{a.summaryOwnerIds.push(descriptor.suppressedOwnerId);});
 reject('suppression-lost',(_e,a)=>{a.suppressionEnabled=false;});
 reject('early-ready',(_e,_a,o)=>{o.readEvidence.sessionReads[0].phase='recovery';});
 reject('unready-store',(_e,_a,o)=>{o.readEvidence.ready=false;});
 reject('whole-project-scan',(_e,_a,o)=>{o.readEvidence.reads.push({method:'getAll',phase:'recovery'});});
 reject('nonselected-owner-activation',(_e,_a,o)=>{o.readEvidence.reads.push({method:'get',key:pending,phase:'activation'});});
 reject('truncated-corrupt-evidence',(_e,a)=>{a.corruptEvidence.actualSha256='f'.repeat(64);});
 reject('original-startup-predicate-weakened',(_e,_a,o)=>{o.proof.corruptBlocked=false;});
 // Source/research hashes are distinct families. The relationship checks use
 // actual current canonical evidence and artifact NOTES, never agent-written
 // application fields or a claim of external research.
 const sourceRow=a=>a.projects.find(row=>row.jobId===accepted),sourceAssociation=a=>sourceRow(a).sourceAssociation;
 for(const [name,change]of [
  ['source-record-deleted',a=>{sourceRow(a).sourceCount=0;sourceAssociation(a).sourceId=null;}],
  ['source-record-changed',a=>{sourceRow(a).sourcesSha256='f'.repeat(64);sourceAssociation(a).sourceSha256='f'.repeat(64);} ],
  ['research-record-deleted',a=>{sourceRow(a).researchCount=0;sourceAssociation(a).research=[];}],
  ['research-record-changed',a=>{sourceRow(a).researchSha256='f'.repeat(64);sourceAssociation(a).research[0].sha256='f'.repeat(64);}]
 ])reject(name,(_e,a)=>change(a),'sourceResearchCanonicalPreserved');
 for(const [name,change]of [
  ['source-research-link-broken',a=>{sourceAssociation(a).research[0].sourceId='OTHER-SOURCE';}],
  ['source-evidence-link-broken',a=>{sourceAssociation(a).evidenceSourceId='OTHER-SOURCE';}],
  ['evidence-artifact-link-broken',a=>{sourceAssociation(a).evidenceArtifactId='OTHER-ARTIFACT';}],
  ['evidence-raw-link-broken',a=>{sourceAssociation(a).evidenceRawId='OTHER-RAW';}],
  ['canonical-artifact-notes-raw-link-broken',a=>{sourceAssociation(a).canonicalArtifactLineage.rawResponseId='OTHER-RAW';sourceAssociation(a).canonicalArtifactNotes=JSON.stringify(sourceAssociation(a).canonicalArtifactLineage);}],
  ['canonical-artifact-notes-slot-link-broken',a=>{sourceAssociation(a).canonicalArtifactLineage.attachmentSlotId='OTHER-SLOT';sourceAssociation(a).canonicalArtifactNotes=JSON.stringify(sourceAssociation(a).canonicalArtifactLineage);}],
  ['source-returned-file-slot-link-broken',a=>{sourceAssociation(a).rawFile.attachmentSlotId='OTHER-SLOT';}],
  ['source-issued-slot-link-broken',a=>{sourceAssociation(a).issuedAttachmentSlotId='OTHER-SLOT';}],
  ['source-artifact-owner-substituted',a=>{a.artifacts.find(row=>row.artifactId===descriptor.sourceBinding.artifactId).jobId='OTHER-OWNER';}],
  ['source-artifact-metadata-owner-substituted',a=>{a.artifacts.find(row=>row.artifactId===descriptor.sourceBinding.artifactId).metadata.jobId='OTHER-OWNER';}],
  ['source-artifact-lineage-link-broken',a=>{a.artifacts.find(row=>row.artifactId===descriptor.sourceBinding.artifactId).metadata.lineage.rawResponseId='OTHER-RAW';}],
  ['source-artifact-missing',a=>{a.artifacts=a.artifacts.filter(row=>row.artifactId!==descriptor.sourceBinding.artifactId);}],
  ['source-artifact-bytes-changed',a=>{a.artifacts.find(row=>row.artifactId===descriptor.sourceBinding.artifactId).actualSha256='f'.repeat(64);}]
 ])reject(name,(_e,a)=>change(a),'sourceAssociatedReturnedBytesExact');
 // Recollect actual durable corruptions, rather than relying only on
 // mutated observation objects. Restore each test-only byte body afterwards.
 const candidate=actual.artifacts.find(row=>row.jobId==='BACKUP-BROWSER-CLOSURE'),body=storedArtifactBody(r,candidate.artifactId),savedBlob=body.blob;body.blob=new Blob(['same owner, changed bytes']);
 const changedBytes=await r.runtime.collectMixedRecoverySnapshot(expected.descriptor);assert.equal(compareMixedRecoverySnapshots(plain(expected),plain(changedBytes),startup).proof.artifactMetadataAndBytesExact,false,'MIXED_ADAPTER_DURABLE_BYTE_MUTATION_ORACLE');body.blob=savedBlob;
 const sourceBody=storedArtifactBody(r,descriptor.sourceBinding.artifactId),savedSourceBlob=sourceBody.blob;sourceBody.blob=new Blob(['changed source-associated bytes']);
 const changedSourceBytes=await r.runtime.collectMixedRecoverySnapshot(expected.descriptor);assert.equal(compareMixedRecoverySnapshots(plain(expected),plain(changedSourceBytes),startup).proof.sourceAssociatedReturnedBytesExact,false,'MIXED_ADAPTER_DURABLE_SOURCE_BYTE_MUTATION_ORACLE');sourceBody.blob=savedSourceBlob;
 const quarantined=(await store.listQuarantinedProjects()).find(row=>row.jobId===corruptId),evidence=await store.metaGet(quarantined.key),fullEvidence=r.copy(evidence);delete evidence.row.project;await store.metaPut(quarantined.key,evidence);
 const truncated=await r.runtime.collectMixedRecoverySnapshot(expected.descriptor);assert.equal(compareMixedRecoverySnapshots(plain(expected),plain(truncated),startup).proof.corruptEvidenceExact,false,'MIXED_ADAPTER_DURABLE_QUARANTINE_TRUNCATION_ORACLE');await store.metaPut(quarantined.key,fullEvidence);
 return {synthetic:true,actualBrowser:false,boundary:'Actual fixture/staging/acceptance/removal/recovery/History owners through projectStoreRuntime; pure oracle mutation controls do not claim native browser reads.',sourceBoundary:'Hermetic synthetic accepted Stage02 source and source-linked Stage03 research; Stage04 canonical evidence SOURCE_ID + ATTACHMENT_ID and artifact NOTES bind the raw response, issued supporting-evidence slot and persisted bytes. No external/live research or application-owned LOCAL_COPY_SHA256 claim.',positive:positive.proof,population:positive.population,counts:positive.counts,mutationControls:mutations,durableMutations:['artifact-payload-bytes','source-associated-artifact-payload-bytes','truncated-quarantine-row']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await verifyBrowserExtraMixedRecovery(),null,2));
